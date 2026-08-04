/* ============================================================
   test_save.mjs — 저장·복원 (core 소유)
   ------------------------------------------------------------
   증명하려는 것은 하나다: **브라우저를 닫아도 그 방이 그대로 있다.**
   날짜·화분 좌표·가구 자리·첫 플레이 단계뿐 아니라, 그 자리의 **밝기까지** 같아야 한다.
   가구 자리표는 조도 창에 얹어야 살아나므로, 좌표만 맞고 그늘이 사라지면 복원이 아니다.

     A  저장 → 복원 → 같은 상태 (day·방·좌표·가구표·첫 플레이 단계·튜토 진행)
     B  자유 좌표 화분과 시루가 좌표까지 그대로
     C  ★ 가구를 옮긴 뒤 저장·복원하면 그 자리 DLI 가 저장 전과 같다
     D  옛 세이브(at 없음)가 좌표로 마이그레이션된다
     E  모르는 스키마·깨진 JSON·빈 값이 조용히 통과하지 않는다
     F  없어진 slotId·방 밖 좌표·사라진 가구가 회수되고 로그가 남는다
     G  저장 객체에 함수·순환참조가 없다(JSON 왕복이 손실 없다)
     H  ★ growth 는 **이력 재생**으로 되세워진다 — 같은 유효 생장일이 나온다
     I  저장소 — 용량 초과·읽기 실패·빈 값·지우기
     J  잊을 수 없는 설계 — 가구·화분·규칙이 있는데 창을 안 주면 던진다

   ★ 집 조립(THREE)을 헤드리스로 돌린다(test_free_place.mjs 와 같은 방식).
     C 를 진짜로 재려면 흉내 낸 기하로는 안 된다 — 브라우저와 같은 코드가 돌아야 한다.

     node tools/test_save.mjs
============================================================ */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/* ── 캔버스·문서 스텁 (조도 계산에 안 쓰이는 자리만 흉내 낸다) ───────────── */
const stubCtx = () => new Proxy({}, {
  get: (t, k) => {
    if (k === 'createImageData' || k === 'getImageData')
      return (w = 1, h = 1) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h });
    if (k === 'createLinearGradient' || k === 'createRadialGradient')
      return () => ({ addColorStop() {} });
    if (k === 'measureText') return () => ({ width: 0 });
    return () => {};
  }
});
const stubEl = () => ({ style: {}, dataset: {}, appendChild() {}, setAttribute() {},
                        addEventListener() {}, getContext: () => stubCtx() });
globalThis.document = {
  createElement: (t) => (t === 'canvas'
    ? { width: 1, height: 1, style: {}, getContext: () => stubCtx(), toDataURL: () => '' }
    : stubEl()),
  createElementNS: () => stubEl(),
  addEventListener() {}, getElementById: () => null,
  querySelector: () => null, querySelectorAll: () => [],
  body: stubEl(), documentElement: stubEl()
};
globalThis.window = globalThis;
globalThis.self = globalThis;

vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'vendor', 'three', 'three.min.js'), 'utf8'));
assert.ok(globalThis.THREE && globalThis.THREE.REVISION, '전역 THREE 를 세우지 못했습니다');

function toUrl(rel) { return 'file:///' + path.join(ROOT, rel).replace(/\\/g, '/'); }
const dataOf = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', rel), 'utf8'));

const { createLightEngine } = await import(toUrl('src/game/light_adapter.js'));
const {
  newState, givePlant, pot0, setPotAt, setCropAt, setFurniturePlacement, ARRIVAL
} = await import(toUrl('src/game/state.js'));
const { firstPlayRulesFromBalance, BEANSPROUT_ID, advanceBeansproutDay, harvestBeansprout } =
  await import(toUrl('src/game/first_play.js'));
const { nullGrowth } = await import(toUrl('src/game/sim.js'));
const { runDays } = await import(toUrl('src/game/loop.js'));
const save = await import(toUrl('src/game/save.js'));
const {
  serialize, deserialize, restoreGrowth, saveTo, loadFrom, clear, peek, describe,
  assertPlainJson, SAVE_SCHEMA, SAVE_KEY, LOG_KEEP
} = save;

function makeEngine() {
  return createLightEngine({
    houseRooms: dataOf('house_rooms.json'),
    winPresets: dataOf('window_presets.json').presets,
    doorPresets: dataOf('door_presets.json').presets,
    finishes: dataOf('room_finishes.json'),
    furnPresets: dataOf('furniture_presets.json').presets,
    lightPresets: dataOf('lighting_presets.json'),
    shadePresets: dataOf('shading_presets.json'),
    lightTh: dataOf('balance/light_thresholds.json'),
    weatherBalance: dataOf('balance/weather.json')
  });
}

const SKY = { weather: 'clear', season: 'summer', lampCount: 0, litHours: 12 };
const eng = makeEngine();
const room = eng.build('banjiha');
const SILL = room.slots.find(s => s.slotId === 'banjiha-sill:0');
assert.ok(SILL, '반지하 창턱 슬롯이 없습니다 — 방 데이터가 바뀌었습니다');

const FP_RULES = firstPlayRulesFromBalance(dataOf('balance/characters.json'));
const GROWTH_MIN = dataOf('balance/light_thresholds.json').plants.monstera_deliciosa.min;
assert.ok(Number.isFinite(GROWTH_MIN), '몬스테라 최소 광량을 못 읽었습니다');

/* 복원 때 넘길 방 정보(조도 창을 안 쓰는 검사용) */
const roomOpt = () => ({ slots: eng.room.slots, size: eng.room.size, surfaces: eng.room.surfaces });

/* 가짜 저장소 — localStorage 를 흉내 낸다. 용량 상한을 걸 수 있다. */
function fakeStorage({ limit = Infinity, failRead = null } = {}) {
  const map = new Map();
  return {
    map,
    getItem(k) { if (failRead) throw failRead; return map.has(k) ? map.get(k) : null; },
    setItem(k, v) {
      const bytes = [...map].reduce((a, [kk, vv]) => a + kk.length + vv.length, 0) + k.length + v.length;
      if (bytes > limit) { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; }
      map.set(k, String(v));
    },
    removeItem(k) { map.delete(k); }
  };
}

/* growth 창 스텁 — 계약은 sim.nullGrowth 그대로 쓰고, **부른 순서**만 기록한다.
   복원이 정말 "growth 계약을 다시 밟는" 것인지 보려면 호출 자체를 봐야 한다. */
function recordingGrowth() {
  const g = nullGrowth(14, { growthMin: GROWTH_MIN });
  const calls = [];
  return {
    ...g,
    calls,
    setGrowth(d) { calls.push(['setGrowth', d]); return g.setGrowth(d); },
    setDailyLight(v) { calls.push(['setDailyLight', v]); return g.setDailyLight(v); },
    advanceTo(d) { calls.push(['advanceTo', d]); return g.advanceTo(d); }
  };
}

/* 첫 플레이·튜토·화분·가구가 다 들어간 '진행 중인 게임' 하나를 손으로 세운다.
   루프를 돌리지 않는 이유: 검사하려는 것은 하루 진행이 아니라 **상태의 왕복**이라
   중간 단계를 정확히 원하는 모양으로 세워 두는 편이 읽기 쉽다. */
function playedGame() {
  const S = newState({ room: 'banjiha', mode: 'novice', firstPlay: true, firstPlayRules: FP_RULES });
  S.day = 6;
  S.sim.seed = 7;
  S.lamps = { count: 1, litHours: 10 };

  /* 시루 — 자유 좌표(어느 추천 자리에도 안 붙는 점) */
  setCropAt(S, { x: -1.2, y: 0.9, z: -1.0 }, { size: eng.room.size, slots: eng.room.slots, snapDist: 0.15 });
  /* ★ 물을 준 날만 자란다 (2026-08-04 · first_play.js §물주기) — 재현도 매일 준다 */
  const CYCLE = FP_RULES.harvestDays;
  for (let i = 0; i < CYCLE; i++) advanceBeansproutDay(S.firstPlay, 0.2, { watered: true });
  /* ★ 자라는 날이 찼다고 저절로 안 거둬진다 (2026-08-04 · §수확) — 손으로 거둔다 */
  assert.equal(S.firstPlay.beansprout.harvested, false, '★저절로 거둬졌습니다');
  harvestBeansprout(S.firstPlay);
  assert.equal(S.firstPlay.beansprout.harvested, true, `${CYCLE}일인데 수확이 안 됐습니다`);
  /* 물 상태도 세이브에 남아야 한다 — 안 남으면 불러오자마자 마른 날이 하루 생긴다 */
  S.firstPlay.beansprout.wateredOnDay = S.day;
  S.firstPlay.beansprout.dryDays = 2;

  /* 화분 — 도착시킨 뒤 자유 좌표로 옮긴다 */
  const g = nullGrowth(14, { growthMin: GROWTH_MIN });
  givePlant(S, { growth: g }, { slotId: 'banjiha-desk:1' });
  setPotAt(S, 'pot_01', { x: 0, y: 1.2, z: -1.6 }, { size: eng.room.size, slots: eng.room.slots });
  pot0(S).daysPlanted = 2;
  S.dliHist = [4.2, null, 5.1];

  /* 가구 — 침대를 옮겼다 */
  setFurniturePlacement(S, 'banjiha-bed', { x: 0.5, z: 0.5, rot: 90 }, { size: eng.room.size });

  /* 튜토리얼 진행 */
  S.tutorial.day = 3;
  S.tutorial.cashWon = 940000;
  S.tutorial.seasonRunning = true;
  S.tutorial.lamp = { unlocked: true, owned: 1, litHours: 12 };
  S.tutorial.rent = { paidCount: 0, nextDueDay: 30 };
  S.tutorial.learned.harvest = true;
  S.tutorial.learned.cropDark = true;
  S.ledger.electricityWon = 46;
  return S;
}

/* 복원본이 원본과 같은 상태인가 — 로그는 복원 기록이 덧붙으므로 따로 본다. */
function sameState(a, b, msg) {
  const A = serialize(a).state, B = serialize(b).state;
  const logA = A.log, logB = B.log;
  delete A.log; delete B.log;
  assert.deepEqual(B, A, msg);
  assert.deepEqual(logB.slice(0, logA.length), logA, '복원이 기존 로그를 건드렸습니다');
}

const results = [];
const check = (name, fn) => { try { fn(); results.push(['PASS', name]); }
                              catch (e) { results.push(['FAIL', name, e.message]); } };

/* ══ A · 왕복 — 같은 상태 ═══════════════════════════════════════════════ */
check('A 저장 → 복원 — day·방·화분 좌표·가구 자리표·첫 플레이·튜토가 그대로', () => {
  const S = playedGame();
  const raw = JSON.stringify(serialize(S, { now: new Date('2026-08-03T09:00:00Z') }));

  eng.setFurnitureOverrides({});                       // 새 세션이라 조도 창은 기본 방이다
  const S2 = deserialize(raw, { light: eng, firstPlayRules: FP_RULES, growth: recordingGrowth() });

  assert.equal(S2.day, 6, `날짜가 ${S2.day}`);
  assert.equal(S2.home.room, 'banjiha');
  assert.equal(S2.sim.mode, 'novice');
  assert.equal(S2.sim.seed, 7);
  assert.deepEqual(S2.lamps, { count: 1, litHours: 10 });
  assert.deepEqual(S2.home.furniture, { 'banjiha-bed': { x: 0.5, z: 0.5, rot: 90 } });
  assert.equal(S2.firstPlay.phase, S.firstPlay.phase, '첫 플레이 단계가 다릅니다');
  assert.equal(S2.firstPlay.beansprout.harvested, true, '수확 기록이 사라졌습니다');
  assert.equal(S2.firstPlay.beansprout.quality, S.firstPlay.beansprout.quality);
  assert.equal(S2.firstPlay.food.totalFoodSavedWon, S.firstPlay.food.totalFoodSavedWon);
  assert.equal(S2.firstPlay.food.pantryWon, S.firstPlay.food.pantryWon, '곳간(원)이 사라졌습니다');
  /* ★ 물 상태 (2026-08-04) — 안 남으면 불러오자마자 마른 날이 하루 생겨 회전이 조용히 늘어난다 */
  assert.equal(S2.firstPlay.beansprout.wateredOnDay, S.firstPlay.beansprout.wateredOnDay,
    '★"오늘 물을 줬다"가 세이브에서 사라졌습니다');
  assert.equal(S2.firstPlay.beansprout.dryDays, S.firstPlay.beansprout.dryDays,
    '★물을 빼먹은 날 수가 세이브에서 사라졌습니다');
  assert.equal(S2.tutorial.day, 3, '튜토 진행이 사라졌습니다');
  assert.equal(S2.tutorial.cashWon, 940000);
  assert.deepEqual(S2.tutorial.learned, S.tutorial.learned, '배운 것이 사라졌습니다');
  assert.equal(S2.tutorial.lamp.owned, 1);
  assert.deepEqual(S2.dliHist, [4.2, null, 5.1], '★ 못 잰 날(null)이 0으로 바뀌었습니다');
  assert.equal(S2.ledger.electricityWon, 46);

  /* 규칙은 세이브가 아니라 **지금 정본**에서 온다 */
  assert.equal(S2.firstPlay.rules, FP_RULES, '첫 플레이 규칙을 세이브에서 되살렸습니다(정본이 둘이 됩니다)');
  assert.ok(S2.tutorial.rules && S2.tutorial.rules.startCashWon, '튜토 규칙이 안 붙었습니다');

  sameState(S, S2, '왕복한 상태가 원본과 다릅니다');
});

/* ══ A-2 · ★보상(perks) — 지금은 늘 꺼져 있지만 **칸이 이미 왕복한다** ════════
   자동수확은 나중에 업적 보상으로 켠다(state.js §perks). 그때 세이브 규약을 같이 넓히는 것을
   잊으면 "보상을 받았는데 껐다 켜면 사라지는" 유형이 난다 — 칸을 먼저 파 두고 여기서 지킨다. */
check('A-2 ★보상 칸(perks.autoHarvest)이 세이브를 왕복한다 · 옛 세이브는 꺼진 채로 열린다', () => {
  const mk = () => newState({ room: 'banjiha', mode: 'novice', firstPlay: true, firstPlayRules: FP_RULES });
  const open = raw => deserialize(raw, { ...roomOpt(), firstPlayRules: FP_RULES });

  const S = mk();
  assert.equal(S.perks.autoHarvest, false, '★자동수확이 기본으로 켜져 있습니다 — 나중 보상입니다');

  S.perks.autoHarvest = true;                       // 보상을 받은 판을 흉내 낸다
  assert.deepEqual(serialize(S).state.perks, { autoHarvest: true }, '★보상이 세이브에 안 실렸습니다');
  assert.equal(open(JSON.stringify(serialize(S))).perks.autoHarvest, true,
    '★보상이 복원에서 사라졌습니다');

  /* 옛 세이브(칸이 없는) — 지어내지 않고 꺼진 채로 연다 */
  const old = serialize(mk());
  delete old.state.perks;
  assert.equal(open(JSON.stringify(old)).perks.autoHarvest, false,
    '★옛 세이브가 보상을 켠 채로 열렸습니다');
});

/* ══ B · 자유 좌표 — 화분도 시루도 좌표까지 그대로 ═══════════════════════ */
check('B 자유 좌표 화분·시루가 좌표(rotY·onUid·occIdx 포함)까지 그대로 돌아온다', () => {
  const S = newState({ room: 'banjiha', mode: 'novice', firstPlay: true, firstPlayRules: FP_RULES });
  const g = nullGrowth(14, { growthMin: GROWTH_MIN });
  givePlant(S, { growth: g }, { slotId: 'banjiha-desk:1' });
  /* 책상 위 자유 좌표 — 올라앉은 가구와 자가차폐 번호까지 붙는다 */
  setPotAt(S, 'pot_01', { x: 0.42, y: 0.74, z: -1.53, rotY: 1.2, onUid: 'banjiha-desk', occIdx: 2 },
           { size: eng.room.size, slots: eng.room.slots });
  setCropAt(S, { x: -1.2, y: 0.9, z: -1.0 }, { size: eng.room.size });

  const S2 = deserialize(JSON.stringify(serialize(S)),
                         { ...roomOpt(), firstPlayRules: FP_RULES, growth: recordingGrowth() });

  assert.equal(pot0(S2).slotId, 'free:pot_01', `화분 slotId 가 ${pot0(S2).slotId}`);
  assert.deepEqual(pot0(S2).at, pot0(S).at, '화분 좌표가 달라졌습니다');
  assert.equal(pot0(S2).at.onUid, 'banjiha-desk', '올라앉은 가구를 잃었습니다');
  assert.equal(pot0(S2).at.occIdx, 2, '자가차폐 번호를 잃었습니다');
  assert.equal(pot0(S2).at.rotY, 1.2, '바라보는 각을 잃었습니다');

  const b = S2.firstPlay.beansprout;
  assert.equal(b.slotId, `free:${BEANSPROUT_ID}`, `시루 slotId 가 ${b.slotId}`);
  assert.deepEqual(b.at, S.firstPlay.beansprout.at, '시루 좌표가 달라졌습니다');

  /* 계약에도 둘 다 한 번씩 실린다 — 복원본으로 하루를 굴려 확인한다 */
  const ids = eng.daily(1, S2).report.slots.map(s => s.slotId);
  assert.equal(new Set(ids).size, ids.length, '복원 뒤 계약에 같은 자리가 두 번 실렸습니다');
  assert.equal(ids.filter(i => i === `free:${BEANSPROUT_ID}`).length, 1, '시루가 계약에 없습니다');
});

/* ══ C · ★★ 가구를 옮긴 뒤 저장·복원하면 그 자리 DLI 가 같다 ═════════════ */
check('C 가구를 옮긴 세이브 — 복원 뒤 그 자리 DLI 가 저장 전과 같다(조도까지 살아난다)', () => {
  eng.setFurnitureOverrides({});
  /* 책상을 창 앞에 놓으면 반쯤 그늘에 드는 점. ★0 이 아닌 값끼리 비교해야 검사가 산다 —
     0 → 0 이면 "자리표를 안 얹어도 통과"할 여지가 생긴다. */
  const shaded = { x: -0.6, y: 0.5, z: -1.4 };
  const plain = eng.dliAt(shaded, SKY).dli;            // 기본 방에서의 밝기

  /* 플레이어가 책상을 창 앞으로 옮긴다 — 상태와 조도 창 양쪽에 적는다 */
  const S = newState({ room: 'banjiha', mode: 'novice' });
  const g = nullGrowth(14, { growthMin: GROWTH_MIN });
  givePlant(S, { growth: g }, { slotId: 'banjiha-desk:1' });
  setPotAt(S, 'pot_01', shaded, { size: eng.room.size, slots: eng.room.slots });
  setFurniturePlacement(S, 'banjiha-desk', { x: 0, z: -1.75, rot: 0 }, { size: eng.room.size });
  eng.moveFurniture('banjiha-desk', { x: 0, z: -1.75, rot: 0 });

  const before = eng.dliAt(shaded, SKY).dli;
  const beforeContract = eng.daily(1, S).report.slots.find(s => s.slotId === 'free:pot_01').dli;
  assert.ok(before > 0 && before < plain * 0.6,
    `가구를 옮겼는데 그늘이 안 졌거나 아예 0 이 됐습니다 — ${plain} → ${before}`);
  assert.equal(beforeContract, before, '계약과 미리보기가 저장 전부터 다릅니다');

  const raw = JSON.stringify(serialize(S));

  /* 브라우저를 닫았다가 다시 연 상황 — 조도 창은 기본 방이다 */
  eng.setFurnitureOverrides({});
  assert.equal(eng.dliAt(shaded, SKY).dli, plain, '되돌리기가 안 됐습니다 — 대조가 성립하지 않습니다');

  const S2 = deserialize(raw, { light: eng, growth: recordingGrowth() });

  assert.deepEqual(S2.home.furniture, { 'banjiha-desk': { x: 0, z: -1.75, rot: 0 } });
  assert.equal(eng.dliAt(shaded, SKY).dli, before,
    `★ 복원 뒤 그 자리 밝기가 ${eng.dliAt(shaded, SKY).dli} — 저장 전 ${before} 와 다릅니다 ` +
    `(가구 자리표가 조도 창에 안 얹혔습니다)`);
  const afterContract = eng.daily(1, S2).report.slots.find(s => s.slotId === 'free:pot_01').dli;
  assert.equal(afterContract, beforeContract, '복원 뒤 하루치 계약의 DLI 가 달라졌습니다');
  results.push(['INFO', `  책상 그늘: 기본 ${plain} · 옮긴 뒤 ${before} · 복원 뒤 ${afterContract}`]);

  /* 추천 자리도 같이 따라왔나 — 옮긴 책상 위 슬롯 좌표가 세이브와 맞아야 한다 */
  const deskSlot = eng.room.slots.find(s => s.slotId === 'banjiha-desk:0');
  assert.ok(Math.abs(deskSlot.z + 1.75) < 0.4, `추천 자리가 안 따라왔습니다 — z=${deskSlot.z}`);
  eng.setFurnitureOverrides({});
});

/* ══ D · 옛 세이브(at 없음) ═════════════════════════════════════════════ */
check('D 옛 세이브 — at 없이 slotId 만 있어도 좌표가 채워진다(화분·시루 둘 다)', () => {
  const S = newState({ room: 'banjiha', mode: 'novice', firstPlay: true, firstPlayRules: FP_RULES });
  const g = nullGrowth(14, { growthMin: GROWTH_MIN });
  givePlant(S, { growth: g }, { slotId: 'banjiha-sill:0' });
  setCropAt(S, 'banjiha-desk:1', { slots: eng.room.slots });

  /* 2026-08-03 이전 모양으로 되돌린다 — 좌표 칸이 아예 없다 */
  const raw = serialize(S);
  raw.state.pots[0].at = null;
  raw.state.firstPlay.beansprout.at = null;

  const S2 = deserialize(raw, { ...roomOpt(), firstPlayRules: FP_RULES, growth: recordingGrowth() });

  const at = pot0(S2).at;
  assert.ok(at, '★ 화분 좌표를 안 채웠습니다');
  assert.deepEqual({ x: at.x, y: at.y, z: at.z }, { x: SILL.x, y: SILL.y, z: SILL.z },
    '채운 좌표가 슬롯과 다릅니다');
  assert.equal(at.onUid, 'banjiha-sill');
  assert.equal(at.occIdx, SILL.occIdx, '자가차폐 번호가 빠졌습니다');
  assert.equal(pot0(S2).slotId, 'banjiha-sill:0', 'slotId 를 버렸습니다(하위호환 파손)');

  const desk = eng.room.slots.find(s => s.slotId === 'banjiha-desk:1');
  const bat = S2.firstPlay.beansprout.at;
  assert.ok(bat, '★ 시루 좌표를 안 채웠습니다');
  assert.deepEqual({ x: bat.x, y: bat.y, z: bat.z }, { x: desk.x, y: desk.y, z: desk.z });
  assert.ok(S2.log.some(e => /좌표/.test(e.msg)), '마이그레이션 기록이 로그에 없습니다');

  /* 복원 뒤 계약이 그 자리를 한 이름으로만 부른다 */
  const ids = eng.daily(1, S2).report.slots.map(s => s.slotId);
  assert.equal(new Set(ids).size, ids.length, '계약에 같은 slotId 가 두 번 실렸습니다');
});

/* ══ E · 모르는 스키마·깨진 JSON·빈 값 ═════════════════════════════════ */
check('E 모르는 스키마·깨진 JSON·빈 값이 조용히 통과하지 않는다', () => {
  const good = serialize(newState({ room: 'banjiha' }));

  const cases = [
    ['빈 문자열', '', 'empty'],
    ['공백만', '   ', 'empty'],
    ['null', null, 'empty'],
    ['깨진 JSON', '{"saveSchema":"game_save/1"', 'broken_json'],
    ['JSON 이 아닌 글자', '이건 세이브가 아닙니다', 'broken_json'],
    ['봉투 없음', JSON.stringify({ day: 3, pots: [] }), 'unknown_schema'],
    ['모르는 세이브 스키마', JSON.stringify({ ...good, saveSchema: 'game_save/9' }), 'unknown_schema'],
    ['모르는 게임 스키마', JSON.stringify({ ...good, gameSchema: 'game_state/9' }), 'unknown_schema'],
    ['state 없음', JSON.stringify({ saveSchema: SAVE_SCHEMA, gameSchema: 'game_state/1' }), 'corrupt']
  ];
  for (const [ko, raw, reason] of cases) {
    let err = null;
    try { deserialize(raw, roomOpt()); } catch (e) { err = e; }
    assert.ok(err, `★ ${ko} 이(가) 조용히 통과했습니다`);
    assert.equal(err.saveReason, reason, `${ko}: 이유가 ${err.saveReason} (기대 ${reason}) — ${err.message}`);
  }

  /* 안이 이상한 것도 반쯤 읽지 않는다 */
  const badMode = JSON.parse(JSON.stringify(good));
  badMode.state.sim.mode = 'godmode';
  assert.throws(() => deserialize(badMode, roomOpt()), /모르는 시뮬 모드/);

  const badDay = JSON.parse(JSON.stringify(good));
  badDay.state.day = -3;
  assert.throws(() => deserialize(badDay, roomOpt()), /day/);

  const badAt = JSON.parse(JSON.stringify(good));
  badAt.state.pots = [{ id: 'pot_01', at: { x: 0, y: null, z: 1 } }];
  assert.throws(() => deserialize(badAt, roomOpt()), /at\.y/);

  const badRoom = JSON.parse(JSON.stringify(good));
  badRoom.state.home.room = '없는방';
  let e2 = null;
  try { deserialize(badRoom, { light: eng }); } catch (e) { e2 = e; }
  assert.equal(e2 && e2.saveReason, 'unknown_room', '모르는 방이 조용히 열렸습니다');
  eng.build('banjiha');

  /* describe 도 같은 기준이다 — '읽을 수 있는 척' 하지 않는다 */
  assert.equal(describe('{망가짐').ok, false);
  assert.equal(describe(JSON.stringify(good)).ok, true);
  assert.equal(describe(JSON.stringify(good)).day, 0);
});

/* ══ F · 회수 — 못 살리는 자리는 되돌리고 로그를 남긴다 ══════════════════ */
check('F 없어진 slotId · 방 밖 좌표 · 사라진 가구 — 회수하고 로그가 남는다', () => {
  const mk = (mutate) => {
    const S = newState({ room: 'banjiha', mode: 'novice', firstPlay: true, firstPlayRules: FP_RULES });
    const g = nullGrowth(14, { growthMin: GROWTH_MIN });
    givePlant(S, { growth: g }, { slotId: 'banjiha-sill:0' });
    setPotAt(S, 'pot_01', { x: 0, y: 1.2, z: -1.6 }, { size: eng.room.size, slots: eng.room.slots });
    const raw = serialize(S);
    mutate(raw.state);
    return deserialize(raw, { ...roomOpt(), firstPlayRules: FP_RULES, growth: recordingGrowth() });
  };

  /* ① 방이 좁아졌다 — 좌표가 방 밖이다 */
  const out = mk(st => { st.pots[0].at.z = 9.5; });
  assert.equal(pot0(out).slotId, eng.room.slots[0].slotId, '방 밖 좌표를 그대로 뒀습니다');
  assert.ok(out.log.some(e => /방 밖/.test(e.msg)), `회수 로그가 없습니다: ${out.log.map(l => l.msg).join(' / ')}`);

  /* ② 받치던 가구가 사라졌다 */
  const gone = mk(st => { st.pots[0].at.onUid = '없는가구'; st.pots[0].at.occIdx = 0; });
  assert.equal(pot0(gone).slotId, eng.room.slots[0].slotId, '사라진 가구 위 화분을 안 옮겼습니다');
  assert.ok(gone.log.some(e => /사라졌습니다/.test(e.msg)), '회수 로그가 없습니다');

  /* ③ 없어진 slotId (좌표도 없는 옛 세이브) */
  const lost = mk(st => { st.pots[0].at = null; st.pots[0].slotId = '없는-자리:0'; });
  assert.equal(pot0(lost).slotId, eng.room.slots[0].slotId, '없어진 슬롯을 그대로 뒀습니다');
  assert.ok(pot0(lost).at, '회수했는데 좌표를 안 세웠습니다');
  assert.ok(lost.log.some(e => /복원/.test(e.msg)), '회수 로그가 없습니다');

  /* ④ 시루도 같은 검사를 받는다 — 안 하면 매일 계약이 던진다 */
  const crop = (() => {
    const S = newState({ room: 'banjiha', mode: 'novice', firstPlay: true, firstPlayRules: FP_RULES });
    setCropAt(S, { x: -1.2, y: 0.9, z: -1.0 }, { size: eng.room.size });
    const raw = serialize(S);
    raw.state.firstPlay.beansprout.at.x = 9.9;
    return deserialize(raw, { ...roomOpt(), firstPlayRules: FP_RULES });
  })();
  assert.equal(crop.firstPlay.beansprout.slotId, eng.room.slots[0].slotId, '방 밖 시루를 안 옮겼습니다');
  assert.ok(crop.log.some(e => /시루 회수/.test(e.msg)), '시루 회수 로그가 없습니다');
  /* 회수했으니 하루가 돌아야 한다(안 돌면 슬롯 검증에서 던진다) */
  assert.doesNotThrow(() => eng.daily(1, crop), '회수하고도 계약이 터집니다');
});

/* ══ G · 순수 JSON ═════════════════════════════════════════════════════ */
check('G 저장 객체에 함수·순환참조가 없다 — JSON 왕복이 손실 없다', () => {
  const S = playedGame();
  /* 상태에 함수·순환참조를 심어도 저장 객체에는 안 실린다(칸을 하나씩 골라 담기 때문) */
  S.pots[0].onTick = () => 1;
  S.self = S;
  const obj = serialize(S);

  assert.doesNotThrow(() => assertPlainJson(obj), '저장 객체가 순수 JSON 이 아닙니다');
  assert.deepEqual(JSON.parse(JSON.stringify(obj)), obj, '★ JSON 왕복에서 값이 바뀌었습니다');
  assert.equal(JSON.stringify(obj).includes('onTick'), false, '함수가 저장 객체에 실렸습니다');

  /* 검사기 자체도 확인한다 */
  const cyc = { a: 1 }; cyc.me = cyc;
  assert.throws(() => assertPlainJson(cyc), /순환참조/);
  assert.throws(() => assertPlainJson({ f() {} }), /함수/);
  assert.throws(() => assertPlainJson({ n: NaN }), /유한한 숫자/);
  assert.throws(() => assertPlainJson({ m: new Map() }), /순수 객체가 아닙니다/);

  /* 상태 쪽 NaN 은 저장 전에 걸린다 — JSON.stringify 는 조용히 null 로 바꾼다 */
  const bad = playedGame();
  bad.dliHist = [1, NaN];
  assert.throws(() => serialize(bad), /유한한 숫자/);

  /* 봉투에 날짜·스키마가 들어 있다 */
  assert.equal(obj.saveSchema, SAVE_SCHEMA);
  assert.equal(obj.gameSchema, 'game_state/1');
  assert.ok(/^\d{4}-\d{2}-\d{2}T/.test(obj.savedAt), `저장 시각이 ${obj.savedAt}`);

  /* 로그 상한 — 메모리 상한과 같은 수라 왕복에서 안 잃는다 */
  const many = playedGame();
  for (let i = 0; i < 500; i++) many.log.push({ day: 1, msg: '줄 ' + i });
  assert.equal(serialize(many).state.log.length, LOG_KEEP, `로그 상한이 ${LOG_KEEP} 이 아닙니다`);
  assert.equal(serialize(many).state.log.at(-1).msg, '줄 499', '마지막 줄이 아니라 앞줄을 남겼습니다');
});

/* ══ H · ★★ growth 되세우기 — 이력 재생 ═══════════════════════════════ */
check('H growth 복원 — 빛 이력을 다시 걸어 같은 유효 생장일이 나온다', () => {
  /* ① 원본 — 진짜 루프로 12일을 산다(밝은 자리라 형태가 실제로 자란다) */
  eng.setFurnitureOverrides({});
  const S = newState({ room: 'banjiha', mode: 'novice' });
  const g1 = nullGrowth(14, { growthMin: GROWTH_MIN });
  const io = { light: eng, growth: g1 };
  givePlant(S, io, { slotId: 'banjiha-sill:0' });
  setPotAt(S, 'pot_01', { x: SILL.x, y: SILL.y, z: SILL.z, onUid: 'banjiha-sill', occIdx: SILL.occIdx },
           { size: eng.room.size, slots: eng.room.slots });
  runDays(S, io, 12);

  const wantGrowth = g1.growthDays(), wantCal = g1.calendarDay();
  assert.equal(S.dliHist.length, 12, `빛 이력이 ${S.dliHist.length}일`);
  assert.equal(pot0(S).daysPlanted, 12);
  assert.ok(wantGrowth > ARRIVAL.growthDays, `밝은 자리인데 형태가 안 자랐습니다 — ${wantGrowth}일`);

  /* ② 복원 — 새 growth 창(형태 0일)에서 시작한다 */
  const g2 = recordingGrowth();
  assert.equal(g2.growthDays(), 0, '스텁이 이미 자라 있습니다');
  const S2 = deserialize(JSON.stringify(serialize(S)), { light: eng, growth: g2 });

  assert.equal(g2.growthDays(), wantGrowth,
    `★ 복원한 유효 생장일이 ${g2.growthDays()} — 저장 전 ${wantGrowth} 와 다릅니다`);
  assert.equal(g2.calendarDay(), wantCal, `달력이 ${g2.calendarDay()} — 저장 전 ${wantCal}`);
  assert.equal(g2.dli7(), g1.dli7(), '7일 평균이 다릅니다 — 이력이 다르게 실렸습니다');

  /* ③ 정말 '계약을 다시 밟았나' — 점프 한 번 + 하루씩 재생이어야 한다 */
  assert.deepEqual(g2.calls[0], ['setGrowth', ARRIVAL.growthDays], '도착 지점 점프가 없습니다');
  assert.equal(g2.calls.filter(c => c[0] === 'setGrowth').length, 1, 'setGrowth 를 두 번 이상 불렀습니다');
  assert.equal(g2.calls.filter(c => c[0] === 'advanceTo').length, 12, '하루씩 재생하지 않았습니다');
  assert.deepEqual(g2.calls.filter(c => c[0] === 'setDailyLight').map(c => c[1]), S.dliHist,
    '재생에 넣은 빛이 저장된 이력과 다릅니다');

  /* ④ 이어서 하루를 더 살아도 두 쪽이 안 어긋난다 */
  runDays(S2, { light: eng, growth: g2 }, 1);
  assert.equal(g2.calendarDay(), wantCal + 1, '복원 뒤 하루가 어긋납니다');
  assert.equal(S2.day, S.day + 1);

  /* ⑤ 어두운 자리 세이브는 형태가 그대로여야 한다 — 재생이 저광 정지까지 재현하는가 */
  const D = newState({ room: 'banjiha', mode: 'novice' });
  const gd = nullGrowth(14, { growthMin: GROWTH_MIN });
  givePlant(D, { light: eng, growth: gd }, { slotId: 'banjiha-sill:0' });
  setPotAt(D, 'pot_01', { x: 0, y: 0.2, z: 1.8 }, { size: eng.room.size, slots: eng.room.slots });
  runDays(D, { light: eng, growth: gd }, 8);
  assert.equal(gd.growthDays(), ARRIVAL.growthDays, '어두운 자리인데 형태가 자랐습니다');
  const gd2 = recordingGrowth();
  deserialize(JSON.stringify(serialize(D)), { light: eng, growth: gd2 });
  assert.equal(gd2.growthDays(), ARRIVAL.growthDays,
    `★ 어두운 자리 세이브를 복원했더니 형태가 ${gd2.growthDays()}일로 자랐습니다 — 재생이 정지를 안 지켰습니다`);
  results.push(['INFO', `  재생 ${S.dliHist.length}일: 유효 ${ARRIVAL.growthDays} → ${wantGrowth}일 ` +
                        `· 어두운 자리 8일: ${ARRIVAL.growthDays}일 그대로`]);

  /* ⑥ 화분이 없으면 되세울 것도 없다 */
  const none = restoreGrowth(newState({ room: 'banjiha' }), recordingGrowth());
  assert.equal(none.needed, false, '화분이 없는데 growth 를 건드렸습니다');
});

/* ══ I · 저장소 ════════════════════════════════════════════════════════ */
check('I 저장소 — 용량 초과·읽기 실패·빈 값·지우기를 각각 다르게 다룬다', () => {
  const S = playedGame();

  const st = fakeStorage();
  const r = saveTo(st, SAVE_KEY, S);
  assert.equal(r.ok, true, `저장 실패: ${r.message}`);
  assert.ok(r.bytes > 100, `저장 바이트가 ${r.bytes}`);

  /* 겉만 보기 — 이어하기 버튼용 */
  const p = peek(st, SAVE_KEY);
  assert.equal(p.ok, true);
  assert.equal(p.day, 6);
  assert.equal(p.room, 'banjiha');
  assert.equal(p.hasPlant, true);

  eng.setFurnitureOverrides({});
  const loaded = loadFrom(st, SAVE_KEY, { light: eng, firstPlayRules: FP_RULES, growth: recordingGrowth() });
  assert.equal(loaded.ok, true, `불러오기 실패: ${loaded.message}`);
  assert.equal(loaded.S.day, 6);
  assert.equal(loaded.report.appliedFurniture, true, '가구 자리표를 안 얹었습니다');

  /* 빈 저장소 */
  const empty = fakeStorage();
  assert.deepEqual([loadFrom(empty, SAVE_KEY).ok, loadFrom(empty, SAVE_KEY).reason], [false, 'empty']);
  assert.equal(peek(empty, SAVE_KEY).reason, 'empty');

  /* 깨진 JSON 이 들어 있는 경우 */
  const broken = fakeStorage();
  broken.map.set(SAVE_KEY, '{망가진');
  const br = loadFrom(broken, SAVE_KEY, roomOpt());
  assert.equal(br.ok, false);
  assert.equal(br.reason, 'broken_json', `이유가 ${br.reason}`);

  /* 용량 초과 — 던지지 않고 이유를 낸다(게임을 멈출 일이 아니다) */
  const tiny = fakeStorage({ limit: 50 });
  const q = saveTo(tiny, SAVE_KEY, S);
  assert.equal(q.ok, false, '용량이 모자란데 저장에 성공했습니다');
  assert.equal(q.reason, 'quota', `이유가 ${q.reason}`);
  assert.ok(/가득/.test(q.message), `문구가 ${q.message}`);
  assert.equal(tiny.map.has(SAVE_KEY), false, '실패했는데 반쯤 써 놨습니다');

  /* 저장소 읽기가 막힌 경우(사생활 보호 모드 등) */
  const blocked = fakeStorage({ failRead: new Error('access denied') });
  const bl = loadFrom(blocked, SAVE_KEY);
  assert.equal(bl.reason, 'storage', `이유가 ${bl.reason}`);

  /* 지우기 */
  assert.equal(clear(st, SAVE_KEY), true, '있던 세이브를 못 지웠습니다');
  assert.equal(clear(st, SAVE_KEY), false, '없는 세이브를 지웠다고 합니다');
  assert.equal(loadFrom(st, SAVE_KEY).reason, 'empty');

  /* 저장소를 안 넘기면 던진다 — 이 모듈은 localStorage 를 직접 안 만진다 */
  assert.throws(() => saveTo(null, SAVE_KEY, S), /저장소가 없습니다/);
  assert.throws(() => loadFrom(undefined, SAVE_KEY), /저장소가 없습니다/);
});

/* ══ J · 잊을 수 없는 설계 ══════════════════════════════════════════════ */
check('J 가구·화분·규칙이 있는데 창을 안 주면 던진다(조용히 반쯤 열지 않는다)', () => {
  const S = playedGame();
  const raw = JSON.stringify(serialize(S));

  /* ① 가구를 옮긴 세이브인데 조도 창이 없다 — 좌표는 맞고 밝기만 틀리는 사고를 막는다 */
  let e1 = null;
  try { deserialize(raw, { ...roomOpt(), firstPlayRules: FP_RULES, allowMissingGrowth: true }); }
  catch (e) { e1 = e; }
  assert.equal(e1 && e1.saveReason, 'needs_light', `★ 가구 자리표를 못 얹은 채로 열렸습니다`);
  assert.ok(/setFurnitureOverrides/.test(e1.message), '무엇을 해야 하는지 안 알려 줍니다');

  /* ② 첫 플레이 세이브인데 밸런스 계약이 없다 */
  let e2 = null;
  try { deserialize(raw, { light: eng, allowMissingGrowth: true }); } catch (e) { e2 = e; }
  assert.equal(e2 && e2.saveReason, 'needs_rules', '규칙 없이 첫 플레이가 열렸습니다');

  /* ③ 화분이 있는데 생장 창이 없다 */
  let e3 = null;
  try { deserialize(raw, { light: eng, firstPlayRules: FP_RULES }); } catch (e) { e3 = e; }
  assert.equal(e3 && e3.saveReason, 'needs_growth', '형태 없이 화분만 열렸습니다');

  /* ④ 명시적으로 포기하면 열린다 — 다만 상태에 그렇게 적힌다 */
  const S4 = deserialize(raw, { light: eng, firstPlayRules: FP_RULES, allowMissingGrowth: true });
  assert.ok(S4.log.some(e => /생장 창 없이/.test(e.msg)), '형태 없이 열었는데 아무 말도 없습니다');

  /* ⑤ 조도 창을 주면 표가 비어 있어도 반드시 얹는다 — 직전 게임의 가구가 남으면 안 된다 */
  eng.moveFurniture('banjiha-bed', { x: 1.2, z: 1.2, rot: 45 });
  const plainSave = JSON.stringify(serialize(newState({ room: 'banjiha' })));
  deserialize(plainSave, { light: eng });
  assert.deepEqual(eng.furnitureOverrides(), {},
    '★ 가구를 안 옮긴 세이브를 열었는데 직전 게임의 가구가 남아 있습니다');
  eng.setFurnitureOverrides({});
});

/* ── 보고 ─────────────────────────────────────────────────────────────── */
let fail = 0;
for (const [st, name, msg] of results) {
  if (st === 'INFO') { console.log(name); continue; }
  if (st === 'FAIL') fail++;
  console.log(`${st}  ${name}${msg ? '\n      → ' + msg : ''}`);
}
console.log(fail ? `\nsave: FAIL (${fail}건)` : '\nsave: PASS');
process.exit(fail ? 1 : 0);
