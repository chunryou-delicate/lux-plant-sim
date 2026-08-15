/* ============================================================
   test_propagation.mjs — 삽수(번식) (core 소유)
   ------------------------------------------------------------
   증명하려는 것은 하나다: **삽수는 지어낸 개체가 아니라 실제 자란 것에서 잘라낸 조각이다.**
   그래서 무늬도 잎도 "굴려서 만든 값"이 아니라 **원본에서 딸려온 값**이어야 하고,
   두 갈래(화분/물꽂이)의 차이가 **숫자로** 나와야 한다.

     A  자를 수 있는 마디 — 잎꽂이·petiole 은 막힌다 · 마디 목록 없이는 자르는 것 자체가 안 된다
     B  ★ 원본 상속 — 무늬 잎을 품은 조각은 **굴리지 않고** 무늬다(물리적으로 같은 잎)
     C  ★ 확률 상속 — 새 잎 무늬율이 세대마다 ×0.8(batch) / ×1.0(individual)
     D  ★★ 물꽂이가 화분보다 **정확히 12일** 빠르다
     E  ★★ 혹이 난 뒤 기한 안에 분갈이하면 산다 / 안 하면 죽어서 **배열에서 사라진다**
     F  ★★ 죽기 전에 **경고가 있었다** — 경고 없는 죽음은 실패로 본다
     G  초보 모드 — 유예 2배 · 경고 더 많음 · 모주를 끝내는 자르기는 **실행 자체가 없다**
     H  모주가 받는 영향 — 잘라낸 사실이 기록되고, 형태 반영은 **대기 중이라고 말한다**
     I  저장·복원 왕복 — 삽수가 그대로 살아난다(굴림 결과·경고 이력까지)
     J  ★ 유령 방지 — 방이 바뀌거나 받치던 가구가 사라져도 삽수가 유령이 안 된다
     K  못 하는 것에 선을 긋는다 — 두 번째 화분 승격은 **던진다**

   ★ 마디 목록은 **주입**한다. plant_grow.html 은 한 그루 전용이고 마디 접근자도 없어서
     (growth_adapter.cuttableNodes 주석) 진짜 모주에서 읽어올 수 없다.
     그 사실 자체를 A 에서 고정한다 — 코어가 잎 수를 지어내면 그 자리에서 던져야 한다.

   ★ 집 조립(THREE)을 헤드리스로 돌린다(test_free_place.mjs 와 같은 방식).
     J 를 진짜로 재려면 방과 계약이 실제로 돌아야 한다.

     node tools/test_propagation.mjs
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
const place = await import(toUrl('src/game/place.js'));
const { newState, placedItems, setPotAt } = await import(toUrl('src/game/state.js'));
const P = await import(toUrl('src/game/propagation.js'));
const { serialize, deserialize, migrateCuttingRules } = await import(toUrl('src/game/save.js'));
const { createGrowthAdapter } = await import(toUrl('src/game/growth_adapter.js'));

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
const eng = makeEngine();
const room = eng.build('banjiha');

const results = [];
const check = (name, fn) => { try { fn(); results.push(['PASS', name]); }
                              catch (e) { results.push(['FAIL', name, e.message]); } };
const info = (m) => results.push(['INFO', '  ' + m]);

/* ── 모주와 마디 목록 ──────────────────────────────────────────────────
   ★ 여기가 "실제 자란 것"의 자리다. 지금은 테스트가 주입하지만, 값의 출처는
     언제나 **모주를 굴린 쪽**이라야 한다(코어가 아니다). 그래서 모양을 여기서 고정한다. */
const NODES = () => ([
  { nodeId: 'ax0#0', stem: 'pink',    leaves: 3, variegatedLeaves: 0, growthDays: 60 },
  { nodeId: 'ax0#1', stem: 'thick',   leaves: 2, variegatedLeaves: 1, growthDays: 100 },
  { nodeId: 'ax1#0', stem: 'main',    leaves: 1, variegatedLeaves: 0, growthDays: 140 },
  { nodeId: 'tip',   stem: 'petiole', leaves: 1, variegatedLeaves: 0, growthDays: 150 }
]);
/* ★★ 2026-08-17 — **잎 1장짜리 무늬 마디.** 새 규칙에서 물꽂이는 잎 1장만 받으므로
   「무늬를 물꽂이로 띄운다」를 재려면 그런 마디가 하나 있어야 한다. 위 목록의 `ax0#1` 은
   잎 2장이라 이제 흙으로만 간다 — 그것도 그대로 재고, 이 마디로 물꽂이를 잰다. */
const V1 = () => ([
  { nodeId: 'v0#0', stem: 'pink', leaves: 3, variegatedLeaves: 2, growthDays: 90 },
  { nodeId: 'v0#1', stem: 'pink', leaves: 1, variegatedLeaves: 1, growthDays: 120 },
  { nodeId: 'v0#2', stem: 'pink', leaves: 1, variegatedLeaves: 1, growthDays: 125 }
]);
/* ★ 빛을 물어보는 창구 — 코어는 밴드를 **받아** 쓴다(loop.cuttingLightOf 가 진짜다).
   여기서는 그 계약 모양만 흉내 낸다: `(c) => { dli, band, grows }`. */
const LIGHT = (band, dli = 4.8) =>
  () => ({ dli, band, grows: !['critical', 'poor', 'stagnant'].includes(band) });

/* 자유 모드(초보 아님) — 삽수는 ③ 원룸 콘텐츠라 튜토가 꺼져 있는 상태가 기본이다 */
function newFree(opt = {}) {
  const S = newState({ room: 'banjiha', mode: 'real' });
  S.day = 10;
  S.sim.seed = 12345;
  S.pots.push({ id: 'pot_01', slotId: null, at: null, plantId: 'monstera_deliciosa',
                variegated: !!opt.variegated, daysPlanted: 0, arrivedOnDay: 0, arrivalGrowthDays: 143 });
  setPotAt(S, 'pot_01', { x: 0, y: 1.2, z: -1.6 }, { size: room.size, slots: room.slots });
  /* ★ 용기 재고 (2026-08-03) — 자르기가 용기를 **실제로 쓴다**(propagation.js §용기값).
     여기서 미리 채워 두는 이유는 이 파일이 재는 것이 "상점"이 아니라 "삽수"이기 때문이다.
     재고가 없을 때 던지는지는 아래 검사 A 가 따로 본다. */
  S.shop = { schema: 'shop/1', seq: 0, orders: [], stock: { jar: 20, pot: 20 }, spentWon: 0, earnedWon: 0 };
  return S;
}
/* 초보(스토리) — sim.mode = novice */
function newNovice(opt = {}) {
  const S = newFree(opt);
  S.sim.mode = 'novice';
  return S;
}

const FLOOR = (x, z) => ({ x, y: 0, z });
const PLACE = { size: room.size, slots: room.slots, snapDist: 0.05 };

/* 하루씩 진행 — 조도·growth 없이 삽수만 돌린다(뿌리내림은 빛과 무관하므로 이게 맞다) */
function runDays(S, n, logs, lightOf) {
  const out = [];
  for (let i = 0; i < n; i++) {
    S.day++;
    out.push(P.stepCuttings(S, { log: m => (logs ? logs.push(m) : null), lightOf: lightOf || null }));
  }
  return out;
}

/* ══ A · 자를 수 있는 마디 ════════════════════════════════════════════ */
check('A 잎꽂이·petiole 은 막힌다 · 마디 목록 없이는 자르는 것 자체가 안 된다', () => {
  const S = newFree();

  /* ★ 코어가 잎 수를 지어내지 않는다 — 마디 목록이 없으면 던진다 */
  assert.throws(() => P.takeCutting(S, { nodeId: 'ax0#0', container: 'jar' }),
    /마디 목록/, '마디 목록 없이 삽수가 생겼습니다 — 코어가 잎 수를 지어냈습니다');

  assert.throws(() => P.takeCutting(S, { nodes: NODES(), nodeId: 'tip', container: 'jar' }),
    /잎꽂이는 안 됩니다/, 'petiole 마디가 잘렸습니다');
  assert.throws(() => P.takeCutting(S, { nodes: NODES(), nodeId: '없는마디', container: 'jar' }),
    /모르는 마디/);
  assert.throws(() => P.takeCutting(S, { nodes: NODES(), nodeId: 'ax0#0', container: 'tray' }),
    /아직 못 씁니다/, '에셋이 없는 트레이가 조용히 열렸습니다');
  assert.throws(() => P.takeCutting(S, { nodes: NODES(), nodeId: 'ax0#0', container: '없는용기' }),
    /모르는 용기/);

  /* 잎이 없는 조각도 막힌다 — 뿌리 낼 에너지가 없다 */
  assert.throws(() => P.takeCutting(S, {
    nodes: [{ nodeId: 'x', stem: 'pink', leaves: 0, variegatedLeaves: 0 }],
    nodeId: 'x', container: 'jar' }), /잎이 없습니다/);

  /* 마디 모양이 깨졌으면 0 으로 메꾸지 않고 던진다 */
  assert.throws(() => P.assertCutNode({ nodeId: 'a', stem: 'pink', leaves: 1 }),
    /variegatedLeaves/, '빠진 칸이 0 으로 메꿔졌습니다');
  assert.throws(() => P.assertCutNode({ nodeId: 'a', stem: 'pink', leaves: 1, variegatedLeaves: 2 }),
    /많습니다/);

  assert.equal(P.isCuttableStem('pink'), true);
  assert.equal(P.isCuttableStem('thick'), true);
  assert.equal(P.isCuttableStem('main'), true);
  assert.equal(P.isCuttableStem('petiole'), false);
  assert.equal(S.cuttings.length, 0, '막혔어야 하는데 삽수가 남았습니다');
});

/* ══ B · ★ 원본 상속 — 딸려간 잎은 굴리지 않는다 ═══════════════════════ */
check('B 무늬 잎을 품은 조각은 굴림 없이 무늬다 — 잎 수·무늬 잎 수가 원본 그대로 따라온다', () => {
  const S = newFree({ variegated: true });
  /* ⚠ 2026-08-17 — 잎 2장짜리라 **물꽂이가 안 된다.** 흙으로 심는다(§WATER_LEAF_MAX) */
  const c = P.takeCutting(S, { nodes: NODES(), nodeId: 'ax0#1', container: 'soil', at: FLOOR(0.5, 0.5), ...PLACE });

  assert.equal(c.source.nodeId, 'ax0#1', '어느 마디를 잘랐는지가 안 따라왔습니다');
  assert.equal(c.source.stem, 'thick');
  assert.equal(c.source.leaves, 2, `잎 수가 ${c.source.leaves} — 원본 2장이 안 따라왔습니다`);
  assert.equal(c.source.variegatedLeaves, 1, '무늬 잎 수가 안 따라왔습니다');
  assert.equal(c.source.growthDays, 100, '자란 유효 생장일이 안 따라왔습니다');

  /* ★ 굴린 게 아니다 — 물리적으로 같은 잎이 딸려간 것이라 그 자리에서 확정이다 */
  assert.equal(c.variegated, true, '무늬 잎을 품었는데 무늬 개체가 아닙니다');
  /* ★ 무늬 잎은 **위쪽(생장점 쪽)** 에 놓인다 — propagation.js §키메라 ②.
     아래쪽에 놓으면 자를 수 있는 마디(i≥1)에 무늬가 하나도 안 실려 대를 잇는 길이 막힌다. */
  assert.deepEqual(c.leafVarie, [false, true],
    '딸려온 잎의 무늬 여부·자리가 안 따라왔습니다 — 그 배열이 곧 다음 세대의 w 입니다');
  assert.equal(c.leaves, 2);
  assert.equal(c.variegatedLeaves, 1);

  /* ★★ 2026-08-17 — **자를 때 주사위를 안 던진다.** 갈래(`lineage`)를 안 적는다.
     예전에는 여기서 revert/chimera/ghost 중 하나가 이미 정해져 있었다(그리고 그것이
     뿌리내릴 때 드러났다). 박사님이 그 규칙을 걷으셨다. */
  assert.equal(c.lineage, null, `새 삽수에 갈래(${c.lineage})가 적혔습니다 — 굴림이 남아 있습니다`);
  assert.equal(P.cuttingSnapshot(S, c).lineage, null, '화면에 갈래가 나옵니다');
  /* ★ 무늬 마디에서 떴다는 사실만 적힌다 — 소질은 **빛이 정할 때까지 미정**이다 */
  assert.equal(c.varieFromCut, true, '무늬 마디에서 떴는데 그 사실이 안 적혔습니다');
  assert.equal(c.varieLightBand, null, '자르자마자 빛이 정해졌습니다 — 아직 안 놓아 봤습니다');
  assert.equal(P.cuttingSnapshot(S, c).varieLightPending, true, '화면이 「빛 대기」를 말 못 합니다');

  /* ★★ 무지 마디는 **모주 값 그대로**다(박사님 ⑤ — "안 오르고 안 내린다").
     ⚠ 예전에는 여기서 `varieChance = 0`(원복) 이었다. 그게 바뀐 자리다.
     ★ 밑동(ax0#0·잎 3장)이 아니라 잎 1장 마디를 자른다 — ax0#1 로 이미 2장이 나갔고
       모주에 1장만 남았다. 없는 잎은 못 자른다(propagation.js §유한성). */
  const c2 = P.takeCutting(S, { nodes: NODES(), nodeId: 'ax1#0', container: 'jar', at: FLOOR(0.8, 0.5), ...PLACE });
  assert.equal(c2.cutW, 0, '민무늬 마디인데 w 가 0 이 아닙니다');
  assert.equal(c2.lineage, null, '민무늬 마디에 갈래가 적혔습니다');
  assert.equal(c2.varieFromCut, false, '민무늬 마디인데 빛 판정 대상이 됐습니다');
  assert.equal(c2.varieChance, P.VARIE.variegatedMother,
    `무지 삽수의 무늬율이 ${c2.varieChance} — 모주 값(${P.VARIE.variegatedMother}) 그대로라야 합니다`);
  assert.equal(c2.variegated, false);
  /* ★ 그리고 **빛을 아무리 밝게 줘도 안 오른다** — 변이인 줄기만 영향받는다(박사님 ⑤) */
  runDays(S, 30, null, LIGHT('good'));
  assert.equal(c2.varieLightBand, null, '★무지 삽수가 빛으로 소질을 받았습니다 — ⑤ 가 깨졌습니다');
  assert.equal(c2.varieChance, P.VARIE.variegatedMother, '무지 삽수의 무늬율이 빛으로 움직였습니다');

  /* ★ plain 모주는 복제해도 영원히 0 이다 — 물려줄 값 자체가 0 이다 */
  const Sp = newFree({ variegated: false });
  const c3 = P.takeCutting(Sp, { nodes: NODES(), nodeId: 'ax1#0', container: 'jar' });
  assert.equal(c3.varieChance, 0, `plain 모주의 삽수 무늬율이 ${c3.varieChance} — 0 이라야 합니다`);
  runDays(Sp, 12, null, LIGHT('good'));              // 뿌리내림
  assert.equal(c3.status, 'rooted', `뿌리를 안 냈습니다: ${c3.status}`);
  assert.equal(c3.varieChance, 0, 'plain 계통이 빛으로 무늬를 얻었습니다');
  assert.equal(c3.variegated, false, 'plain 계통에서 무늬가 나왔습니다');
  info(`상속: ${c.source.nodeId} → 잎 ${c.source.leaves}장(무늬 ${c.source.variegatedLeaves}) · ` +
       `w ${c.cutW} · 갈래 없음(2026-08-17) · 무지 삽수 무늬율 ${c2.varieChance}(모주 값 그대로)`);
});

/* ══ C · ★★ 무늬 소질은 **빛**이 정한다 (2026-08-17 박사님 확정) ══════ */
check('C 무늬 마디를 떼면 뿌리내리는 자리의 빛이 소질을 정한다 — 어두움 20% · 중간 50% · 밝음 80%', () => {
  /* ① 표 자체 — 박사님이 정하신 셋. **다른 데서 지어낸 문턱이 아니다** */
  assert.deepEqual(P.VARIE_LIGHT, { dark: 0.20, mid: 0.50, bright: 0.80 });

  /* ② ★★ 밴드 → 셋. **몬스테라 축(daily_light.judgeDLI)의 이름을 묶은 것**이고
     새 문턱을 하나도 안 만들었다. 어두움 셋은 loop.js §NO_GROW_BANDS 와 같은 묶음이다. */
  for (const b of ['critical', 'poor', 'stagnant'])
    assert.equal(P.varieLightStepOf(b), 'dark', `${b} 가 어두움이 아닙니다`);
  assert.equal(P.varieLightStepOf('slow'), 'mid', 'slow 가 중간이 아닙니다');
  for (const b of ['best', 'good', 'over'])
    assert.equal(P.varieLightStepOf(b), 'bright', `${b} 가 밝음이 아닙니다`);
  /* ★ 모르는 밴드는 **안 정한다** — 0 으로도 「중간」으로도 안 메꾼다 */
  assert.equal(P.varieLightStepOf('unknown'), null, '모르는 밴드에 값을 지어냈습니다');
  assert.equal(P.varieLightStepOf(null), null);
  assert.equal(P.varieChanceFromLight(null, {}), null);

  /* ★ 밝을수록 높다 — 단조롭다. 꺾이면 자리 고르기가 설명이 안 된다 */
  assert.ok(P.VARIE_LIGHT.dark < P.VARIE_LIGHT.mid && P.VARIE_LIGHT.mid < P.VARIE_LIGHT.bright);
  /* ★ 천장이 80% 다(박사님 "천정 80%") */
  assert.equal(P.VARIE_LIGHT.bright, 0.80, '천장이 80% 가 아닙니다');

  /* ③ ★★ 실제로 판을 굴려 본다 — 자리마다 소질이 갈린다 */
  for (const [band, want] of [['stagnant', 0.20], ['slow', 0.50], ['good', 0.80]]) {
    const S = newFree({ variegated: true });
    const c = P.takeCutting(S, { nodes: V1(), nodeId: 'v0#1', container: 'jar',
                                 at: FLOOR(0.5, 0.5), ...PLACE });
    assert.equal(c.varieLightBand, null, '자르자마자 정해졌습니다');
    runDays(S, P.METHODS.water.rootDays, null, LIGHT(band));
    assert.equal(c.varieLightBand, P.varieLightStepOf(band),
      `${band} 에서 ${c.varieLightBand} 로 정해졌습니다`);
    assert.equal(c.varieChance, want, `${band} 에서 무늬율이 ${c.varieChance} — ${want} 라야 합니다`);
    assert.equal(c.variegated, true);
  }

  /* ④ ★ 한 번 정해지면 **안 바뀐다** — 밝은 데서 뿌리내린 뒤 어두운 데로 옮겨도 그대로다.
     안 그러면 자리를 내준 값어치가 사라진다(옮겨 다니며 최댓값만 취하는 판이 된다). */
  {
    const S = newFree({ variegated: true });
    const c = P.takeCutting(S, { nodes: V1(), nodeId: 'v0#1', container: 'jar',
                                 at: FLOOR(0.5, 0.5), ...PLACE });
    runDays(S, P.METHODS.water.rootDays, null, LIGHT('good'));
    assert.equal(c.varieChance, 0.80);
    runDays(S, 5, null, LIGHT('critical'));
    assert.equal(c.varieChance, 0.80, '자리를 옮기자 소질이 깎였습니다 — 한 번 정해지면 안 바뀝니다');
  }

  /* ⑤ ★ 빛을 못 재면 **미룬다.** 잴 수 있는 날에 정한다 — 모르는 것으로 벌하지 않는다 */
  {
    const S = newFree({ variegated: true });
    const c = P.takeCutting(S, { nodes: V1(), nodeId: 'v0#1', container: 'jar',
                                 at: FLOOR(0.5, 0.5), ...PLACE });
    runDays(S, P.METHODS.water.rootDays);            // lightOf 없음 = 못 잼
    assert.equal(c.status, 'rooted', '빛이 없다고 뿌리내림이 멈췄습니다 — 뿌리는 빛과 무관합니다');
    assert.equal(c.varieLightBand, null, '빛을 못 쟀는데 소질을 지어냈습니다');
    runDays(S, 1, null, LIGHT('slow'));
    assert.equal(c.varieChance, 0.50, '잴 수 있게 됐는데도 안 정했습니다');
  }

  /* ⑥ ★★ 손잡이 — 「대마다 오른다」는 **기본이 꺼짐**이다(박사님 ④) */
  assert.equal(P.VARIE_RULES.genRise, 0, '★세대 상승 손잡이의 기본이 꺼짐이 아닙니다');
  assert.equal(P.varieGenRiseOf({}), 0);
  assert.equal(P.varieChanceFromLight('slow', { gen: 5 }), 0.50,
    '손잡이가 꺼졌는데 대를 이을수록 올랐습니다');
  /* 켜면 오른다 — 그리고 **천장을 안 넘는다** */
  assert.equal(P.varieGenRiseOf({ rules: { cuttingVarieGenRise: 0.5 } }), 0.5);
  const up = P.varieChanceFromLight('slow', { gen: 3, genRise: 0.5 });
  assert.ok(up > 0.50, `손잡이를 켰는데 ${up} — 안 올랐습니다`);
  assert.ok(up <= P.VARIE_LIGHT.bright, `손잡이를 켜자 ${up} — 천장(0.8)을 넘었습니다`);

  /* ⑦ 유리병(개별)은 감쇠가 없다 · 세대 세기는 그대로 돈다 */
  assert.equal(P.gradeMultOf('jar'), 1.0, '개별(individual) 등급 계수가 1.0 이 아닙니다');
  const S = newFree({ variegated: true });
  const c1 = P.takeCutting(S, { nodes: NODES(), nodeId: 'ax1#0', container: 'jar' });
  assert.equal(c1.gen, 1, `세대가 ${c1.gen}`);

  /* ⑧ 해시는 여전히 결정적이다 — 새 잎 무늬 굴림이 그것을 쓴다 */
  const a = P.cuttingHash(12345, 'cut_01', 2);
  assert.equal(a, P.cuttingHash(12345, 'cut_01', 2), '같은 입력인데 굴림 결과가 다릅니다');
  assert.notEqual(P.cuttingHash(12345, 'cut_02', 2), a, '다른 삽수인데 같은 굴림이 나왔습니다');

  info(`빛 → 무늬율: 어두움 ${P.VARIE_LIGHT.dark * 100}% · 중간 ${P.VARIE_LIGHT.mid * 100}% · ` +
       `밝음 ${P.VARIE_LIGHT.bright * 100}% (몬스테라 밴드 축 · 새 문턱 0개) · 세대 상승 손잡이 꺼짐`);
});

/* ══ C-2 · ⏸ 옛 규칙(키메라)은 **대체됐다** — 함수는 살아 있되 게임이 안 탄다 ══ */
check('C-2 ⏸키메라 세 갈래는 2026-08-17 에 대체됐다 — 함수는 남았고 게임은 안 부른다', () => {
  /* ★ 순수 함수 자체는 그대로다(옛 세이브를 설명할 때 쓴다) */
  assert.equal(P.chimeraOddsOf(0).revert, 1);
  assert.equal(P.chimeraOddsOf(1).ghost, 1);
  assert.equal(P.chimeraOddsOf(0.5).chimera, 0.5);
  assert.ok(P.varieChanceRise(0.2, 0.5, 1) > 0.2);
  assert.equal(typeof P.rollLineage(0.5, 0.1), 'string');

  /* ★★ 그런데 **게임은 안 부른다** — 200판을 자르면 갈래가 하나도 안 적힌다 */
  let withLineage = 0;
  for (let i = 0; i < 200; i++) {
    const S = newFree({ variegated: true });
    S.sim.seed = i;
    const c = P.takeCutting(S, { nodes: V1(), nodeId: 'v0#1', container: 'jar' });
    if (c.lineage) withLineage++;
  }
  assert.equal(withLineage, 0, `★200판 중 ${withLineage}판에 갈래가 적혔습니다 — 굴림이 안 걷혔습니다`);

  /* ★★ 그리고 **고스트로 죽지 않는다.** 예전에는 w=1 이면 100% 고스트였고 32일 뒤 시들었다.
     지금 그 마디(잎 1장 전부 무늬)는 그냥 밝은 자리를 원하는 무늬 삽수다. */
  const S = newFree({ variegated: true });
  const c = P.takeCutting(S, { nodes: V1(), nodeId: 'v0#1', container: 'jar',
                               at: FLOOR(0.5, 0.5), ...PLACE });
  assert.equal(c.cutW, 1, `w 가 ${c.cutW} — 잎 1장이 전부 무늬면 1 입니다`);
  runDays(S, P.METHODS.water.rootDays, null, LIGHT('good'));
  P.repotCutting(S, c.id, { at: FLOOR(0.9, 0.9), ...PLACE });
  const days = runDays(S, 200, null, LIGHT('good'));
  assert.equal(S.cuttings.length, 1, '★w=1 삽수가 사라졌습니다 — 고스트 죽음이 안 걷혔습니다');
  assert.ok(!days.some(r => r.events.some(e => e.cause === 'ghost')), '고스트 죽음 사건이 났습니다');
  assert.ok(c.grewLeaves >= 1, `200일 동안 잎을 ${c.grewLeaves}장 냈습니다 — 자라야 합니다`);
  info(`⏸ w=1(전부 무늬) 마디 — 예전에는 100% 고스트로 시들었다. 지금은 밝은 자리 80% 개체로 산다 ` +
       `(200일에 잎 ${c.leaves}장 중 무늬 ${c.variegatedLeaves}장)`);
});

/* ══ D · ★★ 물꽂이가 화분보다 12일 빠르다 ═════════════════════════════ */
check('D 물꽂이 12일 · 화분 직삽 24일 — 정확히 12일 차이', () => {
  assert.equal(P.METHODS.water.rootDays, 12);
  assert.equal(P.METHODS.pot.rootDays, 24);

  const S = newFree();
  /* ⚠ 2026-08-17 — 물꽂이는 **잎 1장**(ax1#0), 흙은 여러 장도 된다(ax0#1 · 2장) */
  const w = P.takeCutting(S, { nodes: NODES(), nodeId: 'ax1#0', container: 'jar',  at: FLOOR(0.5, 0.5), ...PLACE });
  const d = P.takeCutting(S, { nodes: NODES(), nodeId: 'ax0#1', container: 'soil', at: FLOOR(0.9, 0.5), ...PLACE });

  let wRooted = null, dRooted = null;
  for (let i = 1; i <= 30; i++) {
    runDays(S, 1);
    if (wRooted == null && w.status !== 'rooting') wRooted = i;
    if (dRooted == null && d.status !== 'rooting') dRooted = i;
  }
  assert.equal(wRooted, 12, `물꽂이가 ${wRooted}일에 뿌리를 냈습니다`);
  assert.equal(dRooted, 24, `화분 직삽이 ${dRooted}일에 자리를 잡았습니다`);
  assert.equal(dRooted - wRooted, 12, '두 갈래의 차이가 12일이 아닙니다');

  /* ★ 화분 직삽은 뿌리가 곧 활착이다 — 기한도 죽음도 없다 */
  assert.equal(d.status, 'established', `화분 직삽 상태가 ${d.status}`);
  assert.equal(P.deadlineDayOf(d, false), null, '화분 직삽에 기한이 생겼습니다');
  assert.equal(P.METHODS.pot.canDie, false);
  runDays(S, 200);
  assert.ok(S.cuttings.some(c => c.id === d.id), '★ 화분 직삽 삽수가 200일 뒤 사라졌습니다');

  /* ★★ 2026-08-17 — **화분 직삽에도 혹이 난다**(45일). 기한만 없다.
     예전에는 `nodeDays` 가 null 이라 혹이 영영 안 났다 — 그래서 화분이 「죽은 길」이었다. */
  assert.equal(P.METHODS.pot.nodeDays, 45, '화분 직삽의 혹이 45일이 아닙니다');
  assert.equal(d.nodeOnDay, d.cutOnDay + P.METHODS.pot.nodeDays,
    `화분 직삽의 혹이 ${d.nodeOnDay == null ? '안 났습니다' : d.nodeOnDay + '일에 났습니다'}`);
  assert.equal(d.status, 'established', '혹이 났다고 화분 직삽이 분갈이 대기가 됐습니다');
  assert.equal(d.deadlineDay, null, '★혹이 나자 화분 직삽에 기한이 생겼습니다 — 안 죽는 길입니다');

  /* ★ 물꽂이가 혹까지 25일 빠르다 — 이게 「쪼개서 물에 꽂을 이유」다 */
  assert.equal(P.METHODS.pot.nodeDays - P.METHODS.water.nodeDays, 25,
    '두 갈래의 혹 차이가 25일이 아닙니다');
  info(`물꽂이 ${wRooted}일 · 화분 직삽 ${dRooted}일 → 물꽂이가 ${dRooted - wRooted}일 빠르다 · ` +
       `혹은 ${P.METHODS.water.nodeDays}일 대 ${P.METHODS.pot.nodeDays}일 ` +
       `(${P.METHODS.pot.nodeDays - P.METHODS.water.nodeDays}일 차이)`);
});

/* ══ D-2 · ★★ 물꽂이는 **잎 1장이라야** 한다 (2026-08-17 박사님) ═══════ */
check('D-2 잎이 여러 장이면 물꽂이가 안 된다 — 흙으로만 심는다', () => {
  assert.equal(P.WATER_LEAF_MAX, 1, '물꽂이가 받는 잎 수가 1장이 아닙니다');

  /* ① 잎 2장짜리를 병에 꽂으려 하면 **막힌다** */
  const S = newFree({ variegated: true });
  assert.throws(() => P.takeCutting(S, { nodes: NODES(), nodeId: 'ax0#1', container: 'jar' }),
    /잎 1장짜리 조각만/, '★잎 2장짜리가 물꽂이로 들어갔습니다');
  assert.equal(S.cuttings.length, 0, '막혔는데 삽수가 남았습니다');
  /* ★ 막힌 것은 **고장이 아니라 안내**다 — 다른 용기를 고르면 된다(game.html isRecoverable) */
  let err = null;
  try { P.takeCutting(S, { nodes: NODES(), nodeId: 'ax0#1', container: 'jar' }); } catch (e) { err = e; }
  assert.equal(err.tutorialInput, true, '★잎 수 안내가 「고장」으로 던져집니다 — 판이 잠깁니다');
  /* ★ 용기 재고도 안 빠졌다 — 던지기 전에 아무것도 안 바꾼다 */
  assert.equal(S.shop.stock.jar, 20, '막혔는데 병 재고가 빠졌습니다');

  /* ② 같은 마디가 흙에는 들어간다 */
  const c = P.takeCutting(S, { nodes: NODES(), nodeId: 'ax0#1', container: 'soil' });
  assert.equal(c.method, 'pot');
  assert.equal(c.leaves, 2);

  /* ③ 잎 1장짜리는 둘 다 된다 · 흙에는 제한이 없다 */
  assert.equal(P.methodLeafBlock('water', 1), null);
  assert.equal(P.methodLeafBlock('pot', 1), null);
  assert.equal(P.methodLeafBlock('pot', 9), null, '흙에 잎 수 제한이 생겼습니다');

  /* ④ ★ 화면이 「왜 병 단추가 회색인가」를 물어볼 데가 있다 — 사유는 **한 곳**에서 낸다 */
  const S2 = newFree({ variegated: true });
  assert.equal(P.cutBlockedReason(S2, NODES(), 'ax0#1', { potId: 'pot_01' }), null,
    '용기를 안 물었는데 잎 수로 막혔습니다 — 옛 호출부가 깨집니다');
  assert.match(P.cutBlockedReason(S2, NODES(), 'ax0#1', { potId: 'pot_01', container: 'jar' }),
    /잎 1장짜리 조각만/, '★용기를 물어도 사유를 안 냅니다 — 화면이 회색을 못 만듭니다');
  assert.equal(P.cutBlockedReason(S2, NODES(), 'ax0#1', { potId: 'pot_01', container: 'soil' }), null,
    '흙인데 잎 수로 막혔습니다');

  /* ⑤ ★ 자르기 전에 보이는 것 — 며칠·자리별 무늬율까지 (cutRiskOf 를 대신한다) */
  const plan = P.cutPlanOf(S2, NODES()[1], 'jar', { novice: false });
  assert.equal(plan.ok, false, '잎 2장짜리 병 계획이 열려 있습니다');
  const plan2 = P.cutPlanOf(S2, V1()[1], 'jar', { novice: false });
  assert.equal(plan2.ok, true, '잎 1장짜리 병 계획이 막혔습니다');
  assert.equal(plan2.variegated, true);
  assert.equal(plan2.nodeDays, P.METHODS.water.nodeDays);
  assert.equal(plan2.lightTable.length, 3, '자리별 표가 셋이 아닙니다');
  assert.match(plan2.ko, /밝음 80%/, '자리별 무늬율이 화면 문구에 안 실립니다');
  info(`물꽂이 = 잎 ${P.WATER_LEAF_MAX}장뿐 · 잎 여러 장은 흙으로 · 자르기 전 안내: ${plan2.ko}`);
});


/* ══ E · ★★ 기한 안에 분갈이하면 산다 / 안 하면 죽어서 사라진다 ════════ */
check('E 혹 20일 → 유예 8일 → 28일에 죽는다. 기한 안에 분갈이하면 산다', () => {
  /* ⚠⚠ 2026-08-17 — 혹이 **32 → 20** 으로 당겨졌다(박사님 · 씨앗 30일보다 빠르게).
     유예 8일은 **안 바뀌었다.** 그래서 기한이 40 → 28 로 같이 움직였다. */
  assert.equal(P.METHODS.water.nodeDays, 20);
  assert.equal(P.METHODS.water.graceDays, 8);
  const DEAD = P.METHODS.water.nodeDays + P.METHODS.water.graceDays;   // 28
  assert.equal(DEAD, 28);

  /* ① 내버려 둔다 → 40일째에 사라진다 */
  const S = newFree();
  const c = P.takeCutting(S, { nodes: NODES(), nodeId: 'ax1#0', container: 'jar', at: FLOOR(0.5, 0.5), ...PLACE });
  const cutDay = S.day;
  assert.equal(P.deadlineDayOf(c, false), cutDay + DEAD, `기한이 자른 날 +${DEAD} 가 아닙니다`);

  const logs = [];
  let nodeAt = null, diedAt = null;
  for (let i = 1; i <= 45; i++) {
    const [r] = runDays(S, 1, logs);
    if (nodeAt == null && r.events.some(e => e.id === 'cutting_node')) nodeAt = i;
    if (diedAt == null && r.events.some(e => e.id === 'cutting_died')) diedAt = i;
  }
  assert.equal(nodeAt, P.METHODS.water.nodeDays, `혹이 ${nodeAt}일에 났습니다`);
  assert.equal(diedAt, DEAD, `${diedAt}일에 죽었습니다 — ${DEAD} 이어야 합니다`);
  /* ★ "죽어서 없어진다" — 배열에서 빠진다 */
  assert.equal(S.cuttings.length, 0, `죽었는데 ${S.cuttings.length}개가 남아 있습니다`);
  assert.equal(placedItems(S).length, 1, '죽은 삽수가 아직 자리를 차지하고 있습니다(화분 1개만 남아야 합니다)');

  /* ② 기한 안에 분갈이하면 산다 */
  const S2 = newFree();
  const c2 = P.takeCutting(S2, { nodes: NODES(), nodeId: 'ax1#0', container: 'jar', at: FLOOR(0.5, 0.5), ...PLACE });
  runDays(S2, P.METHODS.water.nodeDays + 3);        // 혹(20일)이 난 뒤 3일째
  assert.equal(c2.status, 'node', `${P.METHODS.water.nodeDays + 3}일째 상태가 ${c2.status}`);
  P.repotCutting(S2, c2.id, { at: FLOOR(0.9, 0.9), ...PLACE, log: m => null });
  assert.equal(c2.status, 'established');
  assert.equal(c2.potted, true);
  assert.equal(c2.deadlineDay, null, '분갈이했는데 기한이 남아 있습니다');
  runDays(S2, 200);
  assert.equal(S2.cuttings.length, 1, '★ 분갈이한 삽수가 사라졌습니다');

  /* ③ 뿌리 나기 전에는 못 옮긴다 · 죽은 뒤에는 되돌릴 수 없다 */
  const S3 = newFree();
  const c3 = P.takeCutting(S3, { nodes: NODES(), nodeId: 'ax1#0', container: 'jar' });
  assert.throws(() => P.repotCutting(S3, c3.id), /아직 뿌리가 없습니다/);
  runDays(S3, DEAD);
  assert.throws(() => P.repotCutting(S3, c3.id), /모르는 삽수/, '죽은 삽수를 되살렸습니다');
  info(`물꽂이: 뿌리 ${P.METHODS.water.rootDays}일 → 혹 ${P.METHODS.water.nodeDays}일 → ` +
       `기한 ${DEAD}일(유예 ${P.METHODS.water.graceDays}일). 분갈이하면 그 자리에서 안전해진다`);
});

/* ══ F · ★★ 죽기 전에 경고가 있었다 ══════════════════════════════════ */
check('F 죽기 전에 경고가 최소 3번 나간다 — 마지막 경고는 기한 하루 전', () => {
  const S = newFree();
  P.takeCutting(S, { nodes: NODES(), nodeId: 'ax1#0', container: 'jar', at: FLOOR(0.5, 0.5), ...PLACE });

  const logs = [];
  const warnDays = [], warnLeft = [];
  let diedDay = null;
  for (let i = 1; i <= 45; i++) {
    const [r] = runDays(S, 1, logs);
    for (const w of r.warnings) { warnDays.push(i); warnLeft.push(w.daysLeft); }
    if (r.events.some(e => e.id === 'cutting_died')) { diedDay = i; break; }
  }
  assert.ok(warnDays.length >= 3, `경고가 ${warnDays.length}번 — 3번 이상이라야 합니다`);
  assert.ok(Math.max(...warnDays) < diedDay,
    `마지막 경고(${Math.max(...warnDays)}일)가 죽은 날(${diedDay}일)보다 늦습니다`);
  assert.ok(warnLeft.includes(1), '"내일 죽습니다" 경고가 없습니다');
  assert.equal(warnDays[0], P.METHODS.water.nodeDays,
    `첫 경고가 ${warnDays[0]}일 — 혹이 난 날(${P.METHODS.water.nodeDays}일)에 바로 나야 합니다`);

  /* ★ 경고도 죽음도 전부 로그에 남는다 — 조용히 사라지지 않는다 */
  assert.ok(logs.some(m => m.includes('사라졌습니다')), '죽음이 로그에 없습니다');
  assert.ok(logs.filter(m => m.startsWith('⚠')).length >= 3, '경고가 로그에 안 남았습니다');
  info(`경고 ${warnDays.length}회 (D+${warnDays.join(', D+')}) → 죽음 D+${diedDay}`);
});

/* ══ G · 초보 모드 — "안 죽는다" 원칙과의 관계 ════════════════════════ */
check('G 초보 — 유예 2배(16일) · 경고 더 많음 · 모주를 끝내는 자르기는 실행 자체가 없다', () => {
  assert.equal(P.METHODS.water.graceDaysNovice, 16, '초보 유예가 16일이 아닙니다');
  assert.equal(P.graceDaysOf('water', true), 16);
  assert.equal(P.graceDaysOf('water', false), 8);

  const S = newNovice();
  assert.equal(P.isNoviceMode(S), true);
  /* 밑동(ax0#0)은 잎 3장 = 그루 전체라 초보에서는 막힌다(아래에서 따로 본다) — 잎 2장 마디를 쓴다 */
  const NOV = P.METHODS.water.nodeDays + P.METHODS.water.graceDaysNovice;   // 20 + 16 = 36
  assert.equal(NOV, 36);
  const c = P.takeCutting(S, { nodes: NODES(), nodeId: 'ax1#0', container: 'jar', at: FLOOR(0.5, 0.5), ...PLACE });
  assert.equal(P.deadlineDayOf(c, true), S.day + NOV, `초보 기한이 자른 날 +${NOV} 가 아닙니다`);

  let warns = 0, diedDay = null;
  for (let i = 1; i <= 60; i++) {
    const [r] = runDays(S, 1);
    warns += r.warnings.length;
    if (r.events.some(e => e.id === 'cutting_died')) { diedDay = i; break; }
  }
  assert.equal(diedDay, NOV, `초보에서 ${diedDay}일에 죽었습니다 — ${NOV} 이어야 합니다`);
  assert.ok(warns >= 5, `초보 경고가 ${warns}번 — 5번 이상이라야 합니다(마지막 3일 매일)`);

  /* ★ 초보에서는 모주를 끝내는 자르기가 **실행 자체가 없다**(propagation.md §2) */
  const only = [{ nodeId: 'last', stem: 'pink', leaves: 1, variegatedLeaves: 0 }];
  const Sn = newNovice();
  assert.throws(() => P.takeCutting(Sn, { nodes: only, nodeId: 'last', container: 'jar' }),
    /초보 모드에서는 이 마디를 자를 수 없습니다/, '초보에서 모주가 끝나는 자르기가 통과했습니다');
  assert.equal(Sn.cuttings.length, 0);

  /* 자유 모드에서는 열린다 — 경고만 하고 플레이어가 정한다 */
  const Sf = newFree();
  const cf = P.takeCutting(Sf, { nodes: only, nodeId: 'last', container: 'jar' });
  assert.ok(cf, '자유 모드에서도 막혔습니다');
  assert.equal(Sf.pots[0].motherEnded, true, '모주가 끝난 사실이 안 적혔습니다');

  /* ★ 초보라도 화분 직삽은 절대 안 죽는다 — 죽음이 있는 길은 선택지일 뿐이다 */
  const Ss = newNovice();
  P.takeCutting(Ss, { nodes: NODES(), nodeId: 'ax0#1', container: 'soil', at: FLOOR(0.5, 0.5), ...PLACE });
  runDays(Ss, 300);
  assert.equal(Ss.cuttings.length, 1, '★ 초보에서 화분 직삽 삽수가 죽었습니다 — 안전한 길이 아닙니다');
  info(`초보: 유예 ${P.METHODS.water.graceDaysNovice}일 · 기한 ${NOV}일 · 경고 ${warns}회 · ` +
       `화분 직삽은 300일 뒤에도 산다`);
});

/* ══ H · 모주가 받는 영향 ═════════════════════════════════════════════ */
check('H 잘라낸 사실이 모주에 기록된다 — 형태 반영은 "대기 중"이라고 말한다', () => {
  const S = newFree();
  const logs = [];
  P.takeCutting(S, { nodes: NODES(), nodeId: 'ax0#1', container: 'soil', log: m => logs.push(m) });
  const pot = S.pots[0];
  assert.equal(pot.cuts.length, 1, '자른 기록이 없습니다');
  assert.equal(pot.cuts[0].nodeId, 'ax0#1');
  assert.equal(pot.cuts[0].leaves, 2);
  assert.deepEqual(pot.pendingCutLoss, { leaves: 2, nodes: 1 }, '모주 손실이 안 쌓였습니다');

  P.takeCutting(S, { nodes: NODES(), nodeId: 'ax1#0', container: 'jar', log: m => logs.push(m) });
  assert.deepEqual(pot.pendingCutLoss, { leaves: 3, nodes: 2 }, '두 번째 자르기가 안 쌓였습니다');

  /* ★ 여기서 끝이다 — 모주 잎 3장을 다 잘라냈으므로 더는 못 자른다(무한 증식 차단) */
  assert.throws(() => P.takeCutting(S, { nodes: NODES(), nodeId: 'tip2', container: 'jar' }),
    /모르는 마디|남았습니다/, '잎을 다 잘라낸 모주에서 또 잘렸습니다');
  assert.equal(P.cuttableNow(S, NODES()).length, 0,
    '★남은 잎이 0인데 자를 수 있는 마디가 남아 있습니다 — 무한 증식이 열립니다');

  /* ★ "줄였다"고 말하지 않는다 — growth 가 자기 형태를 깎을 창구가 없다 */
  assert.ok(logs.some(m => m.includes('대기 중')),
    '모주 형태 반영이 대기 중이라는 사실을 아무 데도 안 알렸습니다');
  /* ★ 잎 3장을 다 잘라냈으므로 모주가 끝났다고 적혀야 한다 — 자유 모드는 막지 않고 적는다.
     (첫 자르기 뒤에는 아직 안 끝났었다: 아래에서 그 순서를 같이 고정한다) */
  assert.equal(pot.motherEnded, true, '잎을 다 잘라냈는데 모주가 끝났다고 안 적혔습니다');
  assert.equal(pot.cuts.length, 2);
  const S2 = newFree();
  P.takeCutting(S2, { nodes: NODES(), nodeId: 'ax0#1', container: 'soil' });
  assert.equal(S2.pots[0].motherEnded, false, '예비혹이 남았는데 모주가 끝났다고 적혔습니다');
  info(`모주 pot_01 — 잘린 마디 ${pot.cuts.length}개 · 대기 손실 잎 ${pot.pendingCutLoss.leaves}장`);
});

/* ══ I · 저장·복원 왕복 ═══════════════════════════════════════════════ */
check('I 저장·복원 — 삽수가 굴림 결과·경고 이력·모주 기록까지 그대로 살아난다', () => {
  const S = newFree({ variegated: true });
  const a = P.takeCutting(S, { nodes: NODES(), nodeId: 'ax1#0', container: 'jar',  at: FLOOR(0.5, 0.5), ...PLACE });
  const b = P.takeCutting(S, { nodes: NODES(), nodeId: 'ax0#1', container: 'soil', at: FLOOR(0.9, 0.5), ...PLACE });
  /* ⚠ 2026-08-17 — 혹 20일 · 기한 28일. 「혹이 나고 경고가 한 번 나간 뒤」가 22일째다 */
  const HOLD = P.METHODS.water.nodeDays + 2, DEAD = P.METHODS.water.nodeDays + P.METHODS.water.graceDays;
  runDays(S, HOLD);
  assert.equal(a.status, 'node');
  assert.ok(a.warned.length >= 1, '경고 이력이 안 쌓였습니다');

  const save = serialize(S, { now: new Date('2026-08-03T00:00:00Z') });
  assert.equal(JSON.parse(JSON.stringify(save)).state.cuttings.length, 2,
    '★ 세이브에 삽수가 안 실렸습니다');

  const S2 = deserialize(JSON.stringify(save), {
    slots: room.slots, size: room.size, surfaces: room.surfaces,
    allowMissingGrowth: true, allowUnappliedFurniture: true
  });
  assert.equal(S2.cuttings.length, 2, '복원 뒤 삽수 수가 다릅니다');
  const a2 = S2.cuttings.find(c => c.id === a.id);
  for (const k of ['method', 'container', 'status', 'days', 'gen', 'varieChance',
                   'variegated', 'varieRolled', 'deadlineDay', 'cutOnDay', 'slotId',
                   /* ★ 2026-08-17 새 칸 둘 — 안 실리면 빛 판정이 저장 한 번에 다시 열린다 */
                   'varieLightBand', 'varieFromCut'])
    assert.deepEqual(a2[k], a[k], `복원 뒤 ${k} 가 ${a2[k]} (저장 전 ${a[k]})`);
  assert.deepEqual(a2.source, a.source, '★ 원본에서 딸려온 값이 안 살아났습니다');
  assert.deepEqual(a2.warned, a.warned, '경고 이력이 안 살아났습니다 — 경고가 다시 나갑니다');
  assert.deepEqual({ x: a2.at.x, y: a2.at.y, z: a2.at.z }, { x: a.at.x, y: a.at.y, z: a.at.z },
    '좌표가 안 살아났습니다');
  assert.deepEqual(S2.pots[0].pendingCutLoss, S.pots[0].pendingCutLoss,
    '★ 모주의 잘린 기록이 저장 한 번에 사라졌습니다');
  assert.equal(S2.pots[0].cuts.length, 2);

  /* ★ 복원 뒤에도 같은 날 죽는다 — 이어서 굴려도 결과가 안 흔들린다 */
  let diedAfter = null;
  for (let i = 1; i <= 20 && diedAfter == null; i++) {
    const [r] = runDays(S2, 1);
    if (r.events.some(e => e.id === 'cutting_died')) diedAfter = HOLD + i;
  }
  assert.equal(diedAfter, DEAD, `복원 뒤 ${diedAfter}일에 죽었습니다 — ${DEAD} 이어야 합니다`);

  /* 새 게임은 삽수가 비어 있고, 그래도 저장이 통과한다(새 칸 가드) */
  const fresh = newState({ room: 'banjiha' });
  assert.deepEqual(fresh.cuttings, [], '새 게임에 삽수가 있습니다');
  assert.equal(serialize(fresh).state.cuttings.length, 0);
});

/* ══ J · ★ 유령 방지 ═════════════════════════════════════════════════ */
check('J 방이 바뀌거나 받치던 가구가 사라져도 삽수가 유령이 안 된다', () => {
  const S = newFree();
  const c = P.takeCutting(S, { nodes: NODES(), nodeId: 'ax1#0', container: 'jar',
                               at: { x: 0.5, y: 0.74, z: -1.5, onUid: 'banjiha-desk', occIdx: 2 },
                               size: room.size, slots: room.slots });
  assert.equal(c.slotId, 'free:cut_01');

  /* ① 자리가 멀쩡하면 안 건드린다 */
  const logs = [];
  assert.equal(P.rehomeCuttings(S, eng.room, m => logs.push(m)).length, 0, '멀쩡한 자리를 회수했습니다');

  /* ② 계약에 정확히 한 번 실린다 — 자리를 차지하는 물건이므로 */
  const { report, check: k } = eng.daily(1, S);
  assert.equal(k.ok, true, '계약 검증에 걸렸습니다: ' + k.problems.join(' / '));
  const ids = report.slots.map(s => s.slotId);
  assert.equal(new Set(ids).size, ids.length, '계약에 같은 slotId 가 두 번 실렸습니다');
  assert.equal(ids.filter(i => i === 'free:cut_01').length, 1, '★ 삽수가 계약에 없거나 두 번 실렸습니다');
  /* 뿌리내리는 동안 삽수는 빛과 무관하다 — 그 자리에 밴드 판정을 걸 근거가 없다 */
  assert.equal(report.slots.find(s => s.slotId === 'free:cut_01').plantId, null,
    '삽수 자리에 plantId 가 실렸습니다 — 밴드가 몬스테라 기준으로 판정됩니다');

  /* ③ 받치던 가구가 사라지면 회수하고 로그를 남긴다(죽이지는 않는다) */
  const gone = { ...eng.room, surfaces: new Set([...eng.room.surfaces].filter(u => u !== 'banjiha-desk')) };
  const r = P.rehomeCuttings(S, gone, m => logs.push(m));
  assert.equal(r.length, 1, '가구가 사라졌는데 안 옮겼습니다');
  assert.equal(S.cuttings.length, 1, '★ 자리를 잃었다고 삽수를 죽였습니다');
  assert.ok(logs.length >= 1, '조용히 옮겼습니다');

  /* ④ 방이 바뀌어 좌표가 방 밖이면 회수한다 */
  const S2 = newFree();
  const c2 = P.takeCutting(S2, { nodes: NODES(), nodeId: 'ax1#0', container: 'jar',
                                 at: FLOOR(2.4, 1.9), size: room.size, slots: room.slots });
  P.rehomeCuttings(S2, { ...eng.room, size: { w: 2, d: 2, h: 2.3 } }, null);
  assert.ok(place.inRoom(c2.at, room.size), '방 밖 좌표를 그대로 뒀습니다');

  /* ⑤ ★ 모주가 사라져도 삽수는 유령이 안 된다 — 삽수는 모주를 참조로 안 들고 이름만 든다 */
  const S3 = newFree();
  const c3 = P.takeCutting(S3, { nodes: NODES(), nodeId: 'ax1#0', container: 'jar',
                                 at: FLOOR(0.5, 0.5), ...PLACE });
  S3.pots.length = 0;                       // 모주가 사라졌다
  runDays(S3, 12);
  assert.equal(c3.status, 'rooted', `모주가 사라지자 삽수가 ${c3.status} 가 됐습니다`);
  assert.equal(eng.daily(2, S3).check.ok, true, '모주가 없는데 삽수 계약이 깨졌습니다');
  const snap = P.cuttingSnapshot(S3, c3);
  assert.equal(snap.motherPotId, 'pot_01', '어느 모주에서 나왔는지가 사라졌습니다');
  info('삽수는 자리를 차지하되 밝기 판정은 안 받는다 · 자리를 잃어도 죽지 않는다');
});

/* ══ K · 못 하는 것에 선을 긋는다 ═════════════════════════════════════ */
check('K 두 번째 화분 승격은 던진다 — 하루가 안 가는 유령 화분을 만들지 않는다', () => {
  assert.throws(() => P.promoteToPot(), /한 그루 전용/,
    '★ 삽수가 조용히 두 번째 화분이 됐습니다 — loop.nextDay 는 pot0 만 굴립니다');

  /* 생장 창에 마디 접근자가 없으면 **null 이지 지어낸 값이 아니다** */
  const fakeIframe = { contentWindow: { setDailyLight() {}, advanceTo() {}, calendarDay: () => 0,
                                        growthDays: () => 0, growthBlocked: () => null,
                                        growthPhase: () => ({}), setGrowth() {}, thLoaded: () => true } };
  const g = createGrowthAdapter(fakeIframe);
  assert.equal(g.cuttableNodes(), null,
    '마디 접근자가 없는데 목록을 지어냈습니다 — 삽수가 "실제 자란 것"이 아니게 됩니다');

  /* 접근자가 생기면 그대로 흐른다 */
  fakeIframe.contentWindow.cuttableNodes = () => NODES();
  assert.equal(createGrowthAdapter(fakeIframe).cuttableNodes().length, 4);

  /* 표시 모형은 THREE 없이 나온다 — 에셋이 없으면 null 로 말한다(빈 그림을 그리지 않게) */
  const S = newFree();
  const c = P.takeCutting(S, { nodes: NODES(), nodeId: 'ax1#0', container: 'jar', at: FLOOR(0.5, 0.5), ...PLACE });
  const vm2 = P.cuttingViewModel(c);
  assert.equal(vm2.assetId, 'pots/pot_glassjar.glb', `유리 수경병 에셋이 ${vm2.assetId}`);
  assert.equal(P.cuttingViewModel({ ...c, container: 'soil' }).assetId, null,
    '없는 에셋을 있다고 했습니다');
});

/* ══ L · ★★★ 옛 세이브가 열린다 — 키메라 판(`cutting/1`)을 그대로 연다 ═══ */
check('L ★옛 세이브(키메라·고스트)가 열린다 — 고스트가 안 죽고, 무늬율이 천장으로 맞춰진다', () => {
  /* 지금 판으로 세이브를 하나 만든 다음 **손으로 옛 모양으로 되돌린다.**
     이게 제일 정직한 자다 — 옛 판에 실제로 적혀 있던 칸을 그대로 넣는다. */
  const S = newFree({ variegated: true });
  const a = P.takeCutting(S, { nodes: V1(), nodeId: 'v0#1', container: 'jar',
                               at: FLOOR(0.5, 0.5), ...PLACE });
  const b = P.takeCutting(S, { nodes: V1(), nodeId: 'v0#2', container: 'soil',
                               at: FLOOR(0.9, 0.5), ...PLACE });
  const save = JSON.parse(JSON.stringify(serialize(S, { now: new Date('2026-08-03T00:00:00Z') })));

  /* ── 옛 판으로 되돌린다 ─────────────────────────────────────────
     ① `schema` 를 `cutting/1` 로  ② `lineage` 를 되살리고  ③ 고스트 기한을 걸고
     ④ 고스트의 무늬율을 1 로  ⑤ **2026-08-17 에 생긴 칸 둘을 통째로 지운다** */
  const old = save.state.cuttings;
  old[0].schema = 'cutting/1';
  old[0].lineage = 'ghost'; old[0].lineageKnown = true;
  old[0].ghostDeadlineDay = 60; old[0].varieChance = 1;
  delete old[0].varieLightBand; delete old[0].varieFromCut;
  old[1].schema = 'cutting/1';
  old[1].lineage = 'chimera'; old[1].lineageKnown = true; old[1].varieChance = 0.42;
  delete old[1].varieLightBand; delete old[1].varieFromCut;

  /* ★ 안 던지고 열려야 한다. 여기서 던지면 이번 일이 실패다 */
  const S2 = deserialize(JSON.stringify(save), {
    slots: room.slots, size: room.size, surfaces: room.surfaces,
    allowMissingGrowth: true, allowUnappliedFurniture: true
  });
  assert.equal(S2.cuttings.length, 2, '★옛 세이브의 삽수가 사라졌습니다');

  const g = S2.cuttings.find(c => c.id === a.id), h = S2.cuttings.find(c => c.id === b.id);
  /* ① 고스트 시계가 꺼진다 — 없어진 규칙으로 죽으면 안 된다 */
  assert.equal(g.ghostDeadlineDay, null, '★고스트 기한이 살아 있습니다 — 옛 규칙으로 죽습니다');
  /* ② 무늬율 1 이 천장(0.80)으로 맞춰진다 */
  assert.equal(g.varieChance, P.VARIE_LIGHT.bright,
    `고스트 무늬율이 ${g.varieChance} — 천장 ${P.VARIE_LIGHT.bright} 로 맞춰야 합니다`);
  /* ③ `lineage` 는 **안 지운다** — 「예전 판에서 무엇이었나」는 사실이다 */
  assert.equal(g.lineage, 'ghost', '옛 갈래 기록이 지워졌습니다');
  assert.equal(h.lineage, 'chimera');
  assert.equal(h.varieChance, 0.42, '★키메라 삽수의 소질이 조용히 바뀌었습니다');
  /* ④ 없던 칸이 **세이브에 적힌 것으로만** 되메워진다 */
  assert.equal(g.varieFromCut, true, '무늬 잎이 딸려온 옛 삽수인데 빛 판정 대상이 안 됐습니다');
  assert.equal(g.varieLightBand, null, '★빛을 잰 적이 없는데 잰 척했습니다');

  /* ⑤ ★★ 그리고 **실제로 안 죽는다.** 옛 규칙이면 60일에 시들었을 판을 200일 굴린다.
     ⚠ 물꽂이는 여전히 「분갈이 안 하면 죽는다」다 — 그건 안 바뀐 규칙이라 제대로 옮겨 심는다.
       여기서 재는 것은 **고스트로 죽지 않는다**이지 「아무것도 안 해도 산다」가 아니다. */
  runDays(S2, P.METHODS.water.rootDays, null, LIGHT('slow'));
  P.repotCutting(S2, g.id, { at: FLOOR(1.2, 0.5), ...PLACE });
  const died = runDays(S2, 200, null, LIGHT('slow'));
  assert.equal(S2.cuttings.length, 2, `★옛 판의 삽수가 ${2 - S2.cuttings.length}개 사라졌습니다`);
  assert.ok(!died.some(r => r.events.some(e => e.id === 'cutting_died')), '옛 판에서 삽수가 죽었습니다');
  /* ⑥ 미정이던 소질이 그 자리의 빛으로 정해진다 */
  assert.equal(g.varieLightBand, 'mid', `옛 고스트의 소질이 ${g.varieLightBand} 로 정해졌습니다`);
  assert.equal(g.varieChance, P.VARIE_LIGHT.mid);

  /* ⑦ 다시 저장해도 값이 안 흔들린다 — 이관은 **한 번만** 돈다 */
  const again = deserialize(JSON.stringify(serialize(S2, { now: new Date('2026-08-04T00:00:00Z') })), {
    slots: room.slots, size: room.size, surfaces: room.surfaces,
    allowMissingGrowth: true, allowUnappliedFurniture: true
  });
  const g2 = again.cuttings.find(c => c.id === a.id);
  assert.equal(g2.varieLightBand, 'mid', '★저장 한 번에 빛 판정이 다시 열렸습니다');
  assert.equal(g2.varieChance, P.VARIE_LIGHT.mid);
  assert.equal(g2.lineage, 'ghost', '두 번째 왕복에서 옛 기록이 사라졌습니다');

  /* ⑧ 이관 함수 자체 — 지금 판은 **안 건드린다** */
  const fresh = newFree();
  const cf = P.takeCutting(fresh, { nodes: V1(), nodeId: 'v0#1', container: 'jar' });
  cf.varieLightBand = 'bright'; cf.varieChance = 0.8;
  assert.deepEqual(migrateCuttingRules(fresh), [], '지금 판을 이관했습니다');
  assert.equal(cf.varieChance, 0.8, '지금 판의 값이 이관에 흔들렸습니다');
  info(`옛 세이브(cutting/1) — 고스트 기한 껐고 · 무늬율 1 → ${P.VARIE_LIGHT.bright}(천장) · ` +
       `갈래 기록은 남기고 · 200일 굴려도 안 죽는다`);
});

/* ── 보고 ─────────────────────────────────────────────────────────────── */
let fail = 0;
for (const [st, name, msg] of results) {
  if (st === 'INFO') { console.log(name); continue; }
  if (st === 'FAIL') fail++;
  console.log(`${st}  ${name}${msg ? '\n      → ' + msg : ''}`);
}
console.log(fail ? `\npropagation: FAIL (${fail}건)` : '\npropagation: PASS');
process.exit(fail ? 1 : 0);
