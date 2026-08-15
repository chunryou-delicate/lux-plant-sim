/* ============================================================
   test_multiplant_core.mjs — 코어가 그루 여럿을 굴리나 (2026-08-15)
   ------------------------------------------------------------
     node tools/test_multiplant_core.mjs

   설계 정본: docs/handoff/growth-multiplant-design.md (걸음 2)

   ★ `test_multiplant.mjs` 는 **엔진**을 잰다(브라우저). 여기는 그 위의 **배선**을 잰다:
     `loop.nextDay` 가 `S.pots` 를 전부 도는가 · 화분마다 제 자리 빛을 받는가 ·
     세이브가 두 그루를 다 되세우는가 · 그리고 **한 그루짜리 판이 안 달라졌는가**.

     A  한 그루 판 — 옛 길 그대로다(`select` 를 아예 안 부른다)
     B  두 그루 — 자리가 다르면 **유효 생장일이 갈린다**
     C  빛 이력이 화분마다 따로 쌓인다 (`turn.plants` · `fedDays`)
     D  하루가 안 가는 유령이 없다 — 모든 화분이 같은 달력을 산다
     E  세이브 왕복 — 두 그루가 각자 제 형태로 되세워진다
     F  한 그루짜리 세이브는 **예전과 같은 글자**다 (pots[0] 에 dliHist 를 안 적는다)
     G  그루를 못 고르는 옛 생장 창에 화분 둘을 물리면 **던진다**
     H  ★씨앗을 심으면 두 번째 그루가 실제로 생긴다 (걸음 3)
     I  ★심기는 원자적이다 — 못 심으면 씨앗도 그릇도 안 없어진다
============================================================ */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProfileLight } from '../src/game/room_profile.js';
import { newState, ARRIVAL, MAIN_GROWTH_ID, plantMonsteraSeed,
         SEED_ITEM_ID, SEED_POT_ITEM_ID, SEED_START_GROWTH_DAYS } from '../src/game/state.js';
import { stockOf } from '../src/game/shop.js';
import { nextDay } from '../src/game/loop.js';
import { serialize, deserialize } from '../src/game/save.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const J = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url), 'utf8'));
const results = [];
const check = (n, f) => { try { f(); results.push(['PASS', n]); } catch (e) { results.push(['FAIL', n, e.message]); } };
const info = m => results.push(['INFO', '  ' + m]);

const TH = J('../data/balance/light_thresholds.json');
const light0 = createProfileLight(J('../data/profiles/room_profile.banjiha.json'),
                                 { lightTh: TH, weatherBalance: J('../data/balance/weather.json') });
const SILL = 'banjiha-sill:0';
const DARK = 'banjiha-etagere:0';   // 어두운 자리(값은 아래에서 못 박는다)

/* ══ 헤드리스 생장 엔진 — test_growth_speed.mjs 와 **같은 하네스**다 ══════ */
function makeThree() {
  class V3 {
    constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
    set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
    clone() { return new V3(this.x, this.y, this.z); }
    copy(v) { return this.set(v.x, v.y, v.z); }
    add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
    sub(v) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; }
    addScaledVector(v, s) { this.x += v.x * s; this.y += v.y * s; this.z += v.z * s; return this; }
    multiplyScalar(s) { this.x *= s; this.y *= s; this.z *= s; return this; }
    lengthSq() { return this.x ** 2 + this.y ** 2 + this.z ** 2; }
    length() { return Math.sqrt(this.lengthSq()); }
    normalize() { const l = this.length() || 1; return this.multiplyScalar(1 / l); }
    crossVectors(a, b) { return this.set(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x); }
    lerp(v, t) { this.x += (v.x - this.x) * t; this.y += (v.y - this.y) * t; this.z += (v.z - this.z) * t; return this; }
    applyAxisAngle() { return this; }
    distanceTo(v) { return this.clone().sub(v).length(); }
  }
  const nop = function () { return new Proxy({}, handler); };
  const handler = {
    get(t, k) {
      if (k === 'then') return undefined;
      if (k === Symbol.toPrimitive) return () => 0;
      if (!(k in t)) t[k] = new Proxy(nop, handler);
      return t[k];
    },
    apply() { return new Proxy({}, handler); },
    construct() { return new Proxy({ position: new V3(), rotation: new V3(), scale: new V3(1, 1, 1) }, handler); }
  };
  return new Proxy({ Vector3: V3, Vector2: V3 }, handler);
}
function loadGrowth() {
  const html = fs.readFileSync(path.join(ROOT, 'plant_grow.html'), 'utf8');
  const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  const main = blocks[blocks.length - 1];
  assert.ok(main && main.length > 20000, 'plant_grow.html 본문 스크립트를 못 찾았습니다');
  const src = main.replace(/\n\s*init\(\);\s*updateCam\(\);\s*$/, '\n/* init() 제거(헤드리스) */\n');
  assert.notEqual(src, main, 'init() 호출부를 못 찾았습니다');
  const tuning = fs.readFileSync(path.join(ROOT, 'data', 'growth_tuning.json'), 'utf8');
  const el = () => ({
    value: '', textContent: '', checked: false, dataset: {}, style: {}, classList: { add() {}, remove() {}, toggle() {} },
    appendChild() {}, addEventListener() {}, removeEventListener() {}, setAttribute() {}, getAttribute() { return null; },
    querySelector() { return null; }, querySelectorAll() { return []; }, insertAdjacentHTML() {}, focus() {}, remove() {}
  });
  const ctx = {
    THREE: makeThree(), console: { log() {}, warn() {}, error() {} },
    document: { getElementById() { return null; }, createElement: el, querySelector() { return null; },
      querySelectorAll() { return []; }, addEventListener() {}, body: el(), documentElement: el() },
    location: { search: '', href: 'http://localhost/plant_grow.html' },
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    requestAnimationFrame() { return 0; }, cancelAnimationFrame() {},
    setTimeout, clearTimeout, setInterval() { return 0; }, clearInterval() {},
    fetch: () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(tuning)) }),
    Math, JSON, Date, Object, Array, Number, String, Boolean, Map, Set, Error, isFinite, isNaN, parseFloat, parseInt
  };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(src, ctx, { filename: 'plant_grow.html' });
  return ctx;
}
const G = loadGrowth();
for (let i = 0; i < 200 && !G.thLoaded(); i++) await new Promise(r => setImmediate(r));
assert.ok(G.thLoaded(), '임계값 정본(data/growth_tuning.json)이 안 실렸습니다');

/* growth 계약. **다개체 창구를 그대로 낸다** — 어댑터가 브라우저에서 하는 일과 같다. */
function stand(opt = {}) {
  /* 기본 그루를 처음 상태로 되돌린다(판을 새로 여는 것과 같다) */
  for (const id of G.plantIds()) if (id !== MAIN_GROWTH_ID) { try { G.removePlant(id); } catch { } }
  G.selectPlant(MAIN_GROWTH_ID);
  try { G.plantSeed(opt.seed ?? 1); } catch { /* 3D 무대 없음 */ }
  G.matResetAll(); G.resetDailyLight(); G.setGrowth(ARRIVAL.growthDays);
  const calls = [];
  const draw = r => ({ ...r, drawn: true, drawError: null, hudError: null });
  return {
    calls,
    assertContract: () => true,
    multi: () => (opt.noMulti ? false : true),
    select(id) { calls.push(['select', id]); return G.selectPlant(id); },
    addPlant(spec) { calls.push(['addPlant', spec && spec.id]); return G.addPlant(spec); },
    removePlant: id => G.removePlant(id),
    plantIds: () => G.plantIds(),
    setDailyLight(d) { return G.setDailyLight(d); },
    advanceTo(d) { return draw(G.advanceTo(d)); },
    setGrowth(d) { return draw(G.setGrowth(d)); },
    calendarDay: () => G.calendarDay(), growthDays: () => G.growthDays(),
    growthBlocked: () => G.growthBlocked(), growthPhase: () => G.growthPhase(),
    dli7: () => G.dli7(), dliCV: () => G.dliCV(), ageOf: d => G.ageOf(d),
    leafStats: () => G.leafStats()
  };
}
/* 자리마다 DLI 를 못 박은 조도 계약. 나머지는 전부 진짜다. */
function lightWith(map) {
  return {
    daily(day, S) {
      const r = light0.daily(day, S);
      for (const s of r.report.slots) if (map[s.slotId] != null) s.dli = map[s.slotId];
      return r;
    },
    skyFor: (...a) => light0.skyFor(...a),
    dliOfSlot: (...a) => light0.dliOfSlot(...a),
    clearCache: () => light0.clearCache(),
    thresholdsOf: (...a) => light0.thresholdsOf(...a),
    get room() { return light0.room; },
    growLampCount: () => light0.growLampCount(),
    rooms: () => light0.rooms(), profile: () => light0.profile()
  };
}
function mkPot(id, slotId, growthId, extra = {}) {
  return { id, slotId, plantId: 'monstera_deliciosa', variegated: false,
           daysPlanted: 0, fedDays: 0, arrivalGrowthDays: ARRIVAL.growthDays,
           arrivedOnDay: 0, wateredOnDay: 0, at: null,
           growthId, dliHist: [], ...extra };
}
function board(pots, dliMap, opt = {}) {
  const io = { light: lightWith(dliMap), growth: stand(opt) };
  const S = newState({ room: 'banjiha', mode: 'novice' });
  for (const p of pots) S.pots.push(p);
  S.dliHist = S.pots[0].dliHist;
  /* 둘째부터는 생장 창에 그루를 만들어 도착 형태를 세운다 — 게임에서 「심기」가 할 일이다 */
  for (const p of S.pots) {
    if (p.growthId === MAIN_GROWTH_ID) continue;
    io.growth.addPlant({ id: p.growthId, seed: p.growthSeed, day: 0 });
    io.growth.select(p.growthId);
    io.growth.setGrowth(p.arrivalGrowthDays);
  }
  io.growth.select(MAIN_GROWTH_ID);
  return { S, io };
}
function run(b, n) {
  const turns = [];
  /* ⚠ 물이 마르면 하루가 안 세어진다 — 이 검사가 재는 것은 빛이므로 매일 채워 둔다 */
  for (let i = 0; i < n; i++) {
    for (const p of b.S.pots) p.wateredOnDay = b.S.day;
    turns.push(nextDay(b.S, b.io).turn);
  }
  return turns;
}

/* ══ A · 한 그루 판은 옛 길 그대로다 ═════════════════════════════════════ */
check('A 한 그루짜리 판은 `select` 를 아예 안 부른다 (옛 길 그대로)', () => {
  const b = board([mkPot('pot_01', SILL, MAIN_GROWTH_ID)], { [SILL]: 8 });
  b.io.growth.calls.length = 0;
  const t = run(b, 20);
  assert.equal(b.io.growth.calls.filter(c => c[0] === 'select').length, 0,
    '한 그루뿐인데 select 를 불렀다');
  assert.equal(t.at(-1).plants.length, 1);
  assert.equal(t.at(-1).effectiveGrowthDays, t.at(-1).plants[0].effectiveGrowthDays,
    '옛 칸과 plants[0] 이 다르다');
  info(`한 그루 20일: 유효 ${t.at(-1).effectiveGrowthDays}일 · 이력 ${b.S.dliHist.length}칸`);
  assert.equal(b.S.dliHist, b.S.pots[0].dliHist, 'S.dliHist 가 첫 화분의 이력과 다른 배열이다');
});

/* ══ B · 두 그루는 제 자리 빛으로 갈린다 ═════════════════════════════════ */
let two = null;
check('B ★두 그루 — 밝은 자리는 자라고 어두운 자리는 안 자란다 (각자 제 빛)', () => {
  const b = board([mkPot('pot_01', SILL, MAIN_GROWTH_ID),
                   mkPot('pot_02', DARK, 'g:pot_02', { growthSeed: 777 })],
                  { [SILL]: 9, [DARK]: 0.5 });
  const t = run(b, 30);
  const last = t.at(-1);
  assert.equal(last.plants.length, 2, '턴에 그루가 둘 실리지 않았다');
  const A = last.plants[0], B = last.plants[1];
  info(`창턱(9.0) 유효 ${A.effectiveGrowthDays}일 / 바닥(0.5) 유효 ${B.effectiveGrowthDays}일`);
  assert.ok(A.effectiveGrowthDays > ARRIVAL.growthDays,
    `밝은 자리 그루가 안 자랐다 (${A.effectiveGrowthDays})`);
  assert.equal(B.effectiveGrowthDays, ARRIVAL.growthDays,
    `어두운 자리 그루가 자랐다 (${B.effectiveGrowthDays}) — 남의 빛을 먹었다`);
  assert.ok(B.growthBlocked, '어두운 자리 그루에 정지 사유가 없다');
  assert.equal(A.growthBlocked, null, '밝은 자리 그루가 막혔다');
  two = b;
});

/* ══ C · 이력이 화분마다 따로 쌓인다 ═════════════════════════════════════ */
check('C 빛 이력·먹인 날이 화분마다 따로 쌓인다', () => {
  const [p0, p1] = two.S.pots;
  info(`이력 ${p0.dliHist.length}칸 / ${p1.dliHist.length}칸 · 먹인 날 ${p0.fedDays} / ${p1.fedDays}`);
  assert.notEqual(p0.dliHist, p1.dliHist, '두 화분이 같은 배열을 쓰고 있다');
  assert.equal(p0.dliHist.length, p0.fedDays, '첫 화분의 이력과 먹인 날이 1:1 이 아니다');
  assert.equal(p1.dliHist.length, p1.fedDays, '둘째 화분의 이력과 먹인 날이 1:1 이 아니다');
  assert.ok(p0.dliHist.every(v => v === 9), '첫 화분 이력에 남의 빛이 섞였다');
  assert.ok(p1.dliHist.every(v => v === 0.5), '둘째 화분 이력에 남의 빛이 섞였다');
  assert.equal(two.S.dliHist, p0.dliHist, 'S.dliHist(대표 칸)가 첫 화분을 안 가리킨다');
});

/* ══ D · 하루가 안 가는 유령이 없다 ══════════════════════════════════════ */
check('D ★모든 화분이 같은 달력을 산다 (하루가 안 가는 유령이 없다)', () => {
  const days = two.S.pots.map(p => p.daysPlanted);
  info(`돌본 날 ${days.join(' / ')} · 코어 ${two.S.day}일`);
  assert.deepEqual(days, [30, 30], `화분마다 돌본 날이 다르다 (${days.join('/')})`);
  assert.ok(days.every(d => d === two.S.day), '어떤 화분은 하루를 안 갔다');
  /* ⚠ 생장 창의 **달력**은 그루마다 다를 수 있다 — 밝은 자리는 하루에 두 걸음을 걷고
     한 걸음이 곧 그 창의 하루이기 때문이다(loop §걷는 속도). 한 그루짜리 판에서도
     이미 「코어 30일 / 생장 창 82일」이라 새로 생긴 성질이 아니다.
     ★ 유령을 재는 자는 **돌본 날**이다 — 그건 코어의 날과 반드시 같아야 한다. */
  const cal = two.io.growth.plantIds().map(id => { two.io.growth.select(id); return two.io.growth.calendarDay(); });
  info(`생장 창 달력 ${cal.join(' / ')} (밝기 속도만큼 갈린다 — 코어의 날이 아니다)`);
});

/* ══ E · 세이브 왕복 ═════════════════════════════════════════════════════ */
check('E ★세이브 왕복 — 두 그루가 각자 제 형태로 되세워진다', () => {
  const before = two.S.pots.map(p => {
    two.io.growth.select(p.growthId); return two.io.growth.growthDays();
  });
  const raw = serialize(two.S);
  const fresh = stand();                                   // 판을 새로 연다(그루가 하나뿐인 상태)
  const rep = [];
  const S2 = deserialize(raw, {
    slots: light0.room.slots, size: light0.room.size, surfaces: light0.room.surfaces,
    growth: fresh, report: rep
  });
  const after = S2.pots.map(p => { fresh.select(p.growthId); return fresh.growthDays(); });
  info(`저장 전 ${before.join(' / ')} → 복원 뒤 ${after.join(' / ')}`);
  assert.deepEqual(after, before, '복원한 유효 생장일이 저장 때와 다르다');
  assert.equal(rep[0].growth.plants.length, 2, '복원 보고서에 그루가 둘 안 실렸다');
  assert.deepEqual(S2.pots.map(p => p.dliHist.length),
                   two.S.pots.map(p => p.dliHist.length), '복원한 이력 길이가 다르다');
  assert.equal(S2.dliHist, S2.pots[0].dliHist, '복원 뒤 대표 칸이 첫 화분을 안 가리킨다');
});

/* ══ F · 한 그루짜리 세이브는 예전 글자 그대로다 ═════════════════════════ */
check('F ★한 그루짜리 세이브에 새 이력 칸이 안 생긴다 (옛 판이 그대로 읽힌다)', () => {
  const b = board([mkPot('pot_01', SILL, MAIN_GROWTH_ID)], { [SILL]: 8 });
  run(b, 10);
  const o = serialize(b.S);          // ⚠ serialize 는 객체를 낸다(문자열이 아니다)
  const pot = o.state.pots[0];
  assert.equal(pot.dliHist, undefined,
    '첫 화분에 dliHist 를 적었다 — 세이브에 같은 이력이 두 번 들어간다');
  assert.equal(pot.growthId, MAIN_GROWTH_ID, `첫 화분의 그루 이름이 ${pot.growthId} 다`);
  assert.equal(pot.growthSeed, null, '첫 화분에 씨앗을 적었다 — 그 씨앗은 생장 창 소유다');
  /* ⚠ 10일을 돌았다고 10칸이 아니다 — 밝은 날은 하루에 두 걸음을 걷고, 그때 이력도 두 칸이다.
     짝은 `fedDays` 다(save.js §fedDays). 그 등식이 곧 복원의 계약이다. */
  assert.equal(o.state.dliHist.length, b.S.pots[0].fedDays,
    `대표 칸 이력 ${o.state.dliHist.length}칸 ≠ 먹인 날 ${b.S.pots[0].fedDays}일`);
  info(`한 그루 10일 세이브: 대표 칸 ${o.state.dliHist.length}칸 · pots[0].dliHist 없음`);
});

/* ══ G · 옛 생장 창을 물리면 던진다 ══════════════════════════════════════ */
check('G ★그루를 못 고르는 생장 창에 화분 둘을 물리면 던진다 (조용히 겹쳐 쓰지 않는다)', () => {
  const io = { light: lightWith({ [SILL]: 9, [DARK]: 9 }), growth: stand({ noMulti: true }) };
  const S = newState({ room: 'banjiha', mode: 'novice' });
  S.pots.push(mkPot('pot_01', SILL, MAIN_GROWTH_ID), mkPot('pot_02', DARK, 'g:pot_02'));
  S.dliHist = S.pots[0].dliHist;
  assert.throws(() => nextDay(S, io), /하나만 굴립니다/,
    '옛 생장 창인데 두 화분이 그냥 굴렀다');
  assert.equal(S.day, 0, '던졌는데 날짜가 갔다 — 반쯤 진행된 턴이 남는다');
});

/* ══ H · 씨앗 심기 (걸음 3) ═════════════════════════════════════════════ */
check('H ★씨앗을 심으면 두 번째 그루가 실제로 생기고 0일부터 자란다', () => {
  const b = board([mkPot('pot_01', SILL, MAIN_GROWTH_ID)], { [SILL]: 9, [DARK]: 9 });
  b.S.shop.stock[SEED_ITEM_ID] = 1;
  b.S.shop.stock[SEED_POT_ITEM_ID] = 1;
  const pot = plantMonsteraSeed(b.S, b.io, { log: () => {} });
  info(`심은 화분 ${pot.id} · 그루 ${pot.growthId} · 씨앗 ${pot.growthSeed}`);
  assert.equal(b.S.pots.length, 2, '화분이 안 늘었다');
  assert.equal(pot.arrivalGrowthDays, SEED_START_GROWTH_DAYS,
    '씨앗이 0일부터 시작하지 않는다 — 사면 빨라지는 판이 된다');
  assert.equal(stockOf(b.S, SEED_ITEM_ID), 0, '씨앗이 안 없어졌다');
  assert.equal(stockOf(b.S, SEED_POT_ITEM_ID), 0, '그릇이 안 없어졌다');
  pot.slotId = DARK;                                   // 밝은 자리에 놓아 실제로 굴려 본다
  const t = run(b, 20);
  const [A, B] = t.at(-1).plants;
  info(`선물(도착 45일) 유효 ${A.effectiveGrowthDays}일 / 실생(0일부터) 유효 ${B.effectiveGrowthDays}일`);
  assert.ok(B.effectiveGrowthDays > 0, '심은 그루가 하루도 안 자랐다');
  assert.ok(B.effectiveGrowthDays < A.effectiveGrowthDays,
    '★씨앗이 선물보다 앞섰다 — 돈으로 병렬화하면 빨라지는 판이 된다');
  assert.equal(b.S.pots[1].dliHist.length, b.S.pots[1].fedDays,
    '심은 그루의 이력과 먹인 날이 1:1 이 아니다');
});

/* ══ I · 심기는 원자적이다 ══════════════════════════════════════════════ */
check('I ★못 심으면 씨앗도 그릇도 안 없어진다 (반쯤 심긴 판이 없다)', () => {
  const b = board([mkPot('pot_01', SILL, MAIN_GROWTH_ID)], { [SILL]: 9 });
  b.S.shop.stock[SEED_ITEM_ID] = 1;
  b.S.shop.stock[SEED_POT_ITEM_ID] = 0;               // 그릇이 없다
  assert.throws(() => plantMonsteraSeed(b.S, b.io, { log: () => {} }), /검은 모종포트/,
    '그릇이 없는데 그냥 심었다');
  assert.equal(stockOf(b.S, SEED_ITEM_ID), 1, '못 심었는데 씨앗이 없어졌다');
  assert.equal(b.S.pots.length, 1, '못 심었는데 화분이 생겼다');
  assert.equal(b.io.growth.plantIds().length, 1, '못 심었는데 생장 창에 그루가 남았다');

  /* 그루를 못 고르는 생장 창이면 **심기 전에** 막는다 */
  const b2 = board([mkPot('pot_01', SILL, MAIN_GROWTH_ID)], { [SILL]: 9 }, { noMulti: true });
  b2.S.shop.stock[SEED_ITEM_ID] = 1; b2.S.shop.stock[SEED_POT_ITEM_ID] = 1;
  assert.throws(() => plantMonsteraSeed(b2.S, b2.io, { log: () => {} }), /하나만 굴립니다/,
    '옛 생장 창인데 씨앗을 심었다');
  assert.equal(stockOf(b2.S, SEED_ITEM_ID), 1, '막혔는데 씨앗이 없어졌다');
});

/* ══ 결과 ══════════════════════════════════════════════════════════════ */
let bad = 0;
for (const [k, n, m] of results) {
  if (k === 'INFO') console.log(n);
  else { console.log(`${k}  ${n}${m ? '\n      ' + m : ''}`); if (k === 'FAIL') bad++; }
}
console.log(bad ? `\nmultiplant_core: FAIL (${bad})` : '\nmultiplant_core: PASS');
process.exit(bad ? 1 : 0);
