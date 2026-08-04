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
const { serialize, deserialize } = await import(toUrl('src/game/save.js'));
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
function runDays(S, n, logs) {
  const out = [];
  for (let i = 0; i < n; i++) {
    S.day++;
    out.push(P.stepCuttings(S, { log: m => (logs ? logs.push(m) : null) }));
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
  const c = P.takeCutting(S, { nodes: NODES(), nodeId: 'ax0#1', container: 'jar', at: FLOOR(0.5, 0.5), ...PLACE });

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

  /* ★ 갈래는 자를 때 정해지되 **뿌리내리기 전에는 안 드러난다**(정보 있는 판단 ≠ 결과 미리보기) */
  assert.ok(['revert', 'chimera', 'ghost'].includes(c.lineage), `모르는 갈래 ${c.lineage}`);
  assert.equal(c.lineageKnown, false, '자르자마자 결과가 드러났습니다');
  assert.equal(P.cuttingSnapshot(S, c).lineage, null, '화면에 결과가 미리 새어 나갑니다');

  /* ★ 민무늬 마디(w=0)는 **반드시 원복**이다 — 물려줄 흰 조직이 없다.
     ★ 밑동(ax0#0·잎 3장)이 아니라 잎 1장 마디를 자른다 — ax0#1 로 이미 2장이 나갔고
       모주에 1장만 남았다. 없는 잎은 못 자른다(propagation.js §유한성). */
  const c2 = P.takeCutting(S, { nodes: NODES(), nodeId: 'ax1#0', container: 'jar', at: FLOOR(0.8, 0.5), ...PLACE });
  assert.equal(c2.cutW, 0, '민무늬 마디인데 w 가 0 이 아닙니다');
  assert.equal(c2.lineage, 'revert', `민무늬 마디에서 ${c2.lineage} 가 나왔습니다 — w=0 이면 원복만 납니다`);
  assert.equal(c2.varieChance, 0, `원복인데 새 잎 무늬율이 ${c2.varieChance}`);
  assert.equal(c2.variegated, false);

  /* ★ plain 모주는 복제해도 영원히 0 이다 — 무늬 잎이 없으니 w 가 언제나 0 이다 */
  const Sp = newFree({ variegated: false });
  const c3 = P.takeCutting(Sp, { nodes: NODES(), nodeId: 'ax0#0', container: 'jar' });
  assert.equal(c3.varieChance, 0, `plain 모주의 삽수 무늬율이 ${c3.varieChance} — 0 이라야 합니다`);
  runDays(Sp, 12);                                   // 뿌리내림 = 갈래가 드러나는 날
  assert.equal(c3.lineageKnown, true, '뿌리를 냈는데 갈래가 안 드러났습니다');
  assert.equal(c3.variegated, false, 'plain 계통에서 무늬가 나왔습니다');
  info(`상속: ${c.source.nodeId} → 잎 ${c.source.leaves}장(무늬 ${c.source.variegatedLeaves}) · ` +
       `w ${c.cutW} · 갈래 ${c.lineage} · 새 잎 무늬율 ${c.varieChance}`);
});

/* ══ C · ★★ 키메라 세 갈래 — 원복 / 유지 / 고스트 ══════════════ */
check('C 소질은 자른 마디의 무늬 짙기(w)가 정한다 — 천장은 고스트가 만든다', () => {
  /* 확률 셋의 합은 언제나 1이다 — 두 층을 각각 뽑은 것이라 그렇게 나온다 */
  for (const w of [0, 0.2, 1 / 3, 0.5, 0.75, 1]) {
    const o = P.chimeraOddsOf(w);
    assert.ok(Math.abs(o.revert + o.chimera + o.ghost - 1) < 1e-9, `w=${w} 에서 합이 1이 아닙니다`);
  }
  /* ★ 양끝이 규칙에서 저절로 막힌다 — 여기가 「천장」이다 */
  assert.equal(P.chimeraOddsOf(0).revert, 1, 'w=0 인데 원복이 100% 가 아닙니다');
  assert.equal(P.chimeraOddsOf(1).ghost, 1, 'w=1 인데 고스트가 100% 가 아닙니다 — 천장이 사라집니다');
  /* ★ 유지가 가장 잘 되는 곳이 반반이다 — 육종가가 반반을 고르는 이유가 식에서 나온다 */
  const half = P.chimeraOddsOf(0.5).chimera;
  for (const w of [0.1, 0.3, 0.7, 0.9])
    assert.ok(P.chimeraOddsOf(w).chimera < half, `w=${w} 의 유지율이 반반보다 높습니다`);
  assert.equal(half, 0.5, `반반의 유지율이 ${half} — 2w(1-w) 의 꼭짓점은 0.5 입니다`);

  /* 소질은 **남은 거리의 일부만** 오른다 — 절대 1을 못 넘고, 오를수록 덜 오른다 */
  const base = P.VARIE.variegatedMother;
  assert.equal(P.varieChanceRise(base, 0, 1), base, 'w=0 인데 소질이 올랐습니다');
  assert.ok(P.varieChanceRise(base, 1, 1) <= 1, '소질이 1을 넘었습니다');
  let prev = base, gap0 = 1 - base;
  for (let g = 0; g < 8; g++) {
    const next = P.varieChanceRise(prev, 0.5, 1);
    assert.ok(next > prev, `${g}대에서 소질이 안 올랐습니다`);
    assert.ok(next < 1, `${g}대에서 소질이 1에 닿았습니다`);
    assert.ok(1 - next < 1 - prev, '남은 거리가 안 줄었습니다');
    prev = next;
  }
  assert.ok(1 - prev < gap0, '수확체감이 없습니다');

  /* 유리병(개별)은 감쇠가 없다 — 세대 감쇠(0.8ⁿ)는 키메라 모델로 대체됐다 */
  assert.equal(P.gradeMultOf('jar'), 1.0, '개별(individual) 등급 계수가 1.0 이 아닙니다');
  const S = newFree({ variegated: true });
  const c1 = P.takeCutting(S, { nodes: NODES(), nodeId: 'ax0#0', container: 'jar' });
  assert.equal(c1.gen, 1, `세대가 ${c1.gen}`);

  /* ★ 굴림은 결정적이다 — 같은 씨앗·같은 id 면 언제 굴려도 같은 답 */
  const a = P.cuttingHash(12345, 'cut_01', 2);
  const b = P.cuttingHash(12345, 'cut_01', 2);
  assert.equal(a, b, '같은 입력인데 굴림 결과가 다릅니다 — 세이브 복원이 흔들립니다');
  assert.notEqual(P.cuttingHash(12345, 'cut_02', 2), a, '다른 삽수인데 같은 굴림이 나왔습니다');

  /* 갈래가 실제로 그 비율로 나오는가 — 씨앗 800개로 w=0.5 를 굴린다 */
  const N = 800, cnt = { revert: 0, chimera: 0, ghost: 0 };
  for (let i = 0; i < N; i++) cnt[P.rollLineage(0.5, P.cuttingHash(i, 'cut_01', 2))]++;
  for (const [k, want] of [['revert', 0.25], ['chimera', 0.5], ['ghost', 0.25]]) {
    const got = cnt[k] / N;
    assert.ok(Math.abs(got - want) < 0.05,
      `w=0.5 에서 ${k} 기대 ${want} 인데 실측 ${got.toFixed(3)} — 굴림이 확률을 안 따릅니다`);
  }
  info(`w=0.5 실측 ${N}판 — 원복 ${(cnt.revert / N * 100).toFixed(1)}% · ` +
       `유지 ${(cnt.chimera / N * 100).toFixed(1)}% · 고스트 ${(cnt.ghost / N * 100).toFixed(1)}%`);
});

/* ══ D · ★★ 물꽂이가 화분보다 12일 빠르다 ═════════════════════════════ */
check('D 물꽂이 12일 · 화분 직삽 24일 — 정확히 12일 차이', () => {
  assert.equal(P.METHODS.water.rootDays, 12);
  assert.equal(P.METHODS.pot.rootDays, 24);

  const S = newFree();
  const w = P.takeCutting(S, { nodes: NODES(), nodeId: 'ax0#1', container: 'jar',  at: FLOOR(0.5, 0.5), ...PLACE });
  const d = P.takeCutting(S, { nodes: NODES(), nodeId: 'ax1#0', container: 'soil', at: FLOOR(0.9, 0.5), ...PLACE });

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
  info(`물꽂이 ${wRooted}일 · 화분 직삽 ${dRooted}일 → 물꽂이가 ${dRooted - wRooted}일 빠르다`);
});

/* ══ E · ★★ 기한 안에 분갈이하면 산다 / 안 하면 죽어서 사라진다 ════════ */
check('E 혹 32일 → 유예 8일 → 40일에 죽는다. 기한 안에 분갈이하면 산다', () => {
  assert.equal(P.METHODS.water.nodeDays, 32);
  assert.equal(P.METHODS.water.graceDays, 8);

  /* ① 내버려 둔다 → 40일째에 사라진다 */
  const S = newFree();
  const c = P.takeCutting(S, { nodes: NODES(), nodeId: 'ax0#0', container: 'jar', at: FLOOR(0.5, 0.5), ...PLACE });
  const cutDay = S.day;
  assert.equal(P.deadlineDayOf(c, false), cutDay + 40, '기한이 자른 날 +40 이 아닙니다');

  const logs = [];
  let nodeAt = null, diedAt = null;
  for (let i = 1; i <= 45; i++) {
    const [r] = runDays(S, 1, logs);
    if (nodeAt == null && r.events.some(e => e.id === 'cutting_node')) nodeAt = i;
    if (diedAt == null && r.events.some(e => e.id === 'cutting_died')) diedAt = i;
  }
  assert.equal(nodeAt, 32, `혹이 ${nodeAt}일에 났습니다`);
  assert.equal(diedAt, 40, `${diedAt}일에 죽었습니다 — 40 이어야 합니다`);
  /* ★ "죽어서 없어진다" — 배열에서 빠진다 */
  assert.equal(S.cuttings.length, 0, `죽었는데 ${S.cuttings.length}개가 남아 있습니다`);
  assert.equal(placedItems(S).length, 1, '죽은 삽수가 아직 자리를 차지하고 있습니다(화분 1개만 남아야 합니다)');

  /* ② 기한 안에 분갈이하면 산다 */
  const S2 = newFree();
  const c2 = P.takeCutting(S2, { nodes: NODES(), nodeId: 'ax0#0', container: 'jar', at: FLOOR(0.5, 0.5), ...PLACE });
  runDays(S2, 35);                                  // 혹(32일)이 난 뒤 3일째
  assert.equal(c2.status, 'node', `35일째 상태가 ${c2.status}`);
  P.repotCutting(S2, c2.id, { at: FLOOR(0.9, 0.9), ...PLACE, log: m => null });
  assert.equal(c2.status, 'established');
  assert.equal(c2.potted, true);
  assert.equal(c2.deadlineDay, null, '분갈이했는데 기한이 남아 있습니다');
  runDays(S2, 200);
  assert.equal(S2.cuttings.length, 1, '★ 분갈이한 삽수가 사라졌습니다');

  /* ③ 뿌리 나기 전에는 못 옮긴다 · 죽은 뒤에는 되돌릴 수 없다 */
  const S3 = newFree();
  const c3 = P.takeCutting(S3, { nodes: NODES(), nodeId: 'ax0#0', container: 'jar' });
  assert.throws(() => P.repotCutting(S3, c3.id), /아직 뿌리가 없습니다/);
  runDays(S3, 40);
  assert.throws(() => P.repotCutting(S3, c3.id), /모르는 삽수/, '죽은 삽수를 되살렸습니다');
  info(`물꽂이: 뿌리 12일 → 혹 32일 → 기한 40일(유예 8일). 분갈이하면 그 자리에서 안전해진다`);
});

/* ══ F · ★★ 죽기 전에 경고가 있었다 ══════════════════════════════════ */
check('F 죽기 전에 경고가 최소 3번 나간다 — 마지막 경고는 기한 하루 전', () => {
  const S = newFree();
  P.takeCutting(S, { nodes: NODES(), nodeId: 'ax0#0', container: 'jar', at: FLOOR(0.5, 0.5), ...PLACE });

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
  assert.ok(warnDays[0] === 32, `첫 경고가 ${warnDays[0]}일 — 혹이 난 날(32일)에 바로 나야 합니다`);

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
  const c = P.takeCutting(S, { nodes: NODES(), nodeId: 'ax0#1', container: 'jar', at: FLOOR(0.5, 0.5), ...PLACE });
  assert.equal(P.deadlineDayOf(c, true), S.day + 48, '초보 기한이 자른 날 +48 이 아닙니다');

  let warns = 0, diedDay = null;
  for (let i = 1; i <= 60; i++) {
    const [r] = runDays(S, 1);
    warns += r.warnings.length;
    if (r.events.some(e => e.id === 'cutting_died')) { diedDay = i; break; }
  }
  assert.equal(diedDay, 48, `초보에서 ${diedDay}일에 죽었습니다 — 48 이어야 합니다`);
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
  info(`초보: 유예 16일 · 기한 48일 · 경고 ${warns}회 · 화분 직삽은 300일 뒤에도 산다`);
});

/* ══ H · 모주가 받는 영향 ═════════════════════════════════════════════ */
check('H 잘라낸 사실이 모주에 기록된다 — 형태 반영은 "대기 중"이라고 말한다', () => {
  const S = newFree();
  const logs = [];
  P.takeCutting(S, { nodes: NODES(), nodeId: 'ax0#1', container: 'jar', log: m => logs.push(m) });
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
  P.takeCutting(S2, { nodes: NODES(), nodeId: 'ax0#1', container: 'jar' });
  assert.equal(S2.pots[0].motherEnded, false, '예비혹이 남았는데 모주가 끝났다고 적혔습니다');
  info(`모주 pot_01 — 잘린 마디 ${pot.cuts.length}개 · 대기 손실 잎 ${pot.pendingCutLoss.leaves}장`);
});

/* ══ I · 저장·복원 왕복 ═══════════════════════════════════════════════ */
check('I 저장·복원 — 삽수가 굴림 결과·경고 이력·모주 기록까지 그대로 살아난다', () => {
  const S = newFree({ variegated: true });
  const a = P.takeCutting(S, { nodes: NODES(), nodeId: 'ax0#1', container: 'jar',  at: FLOOR(0.5, 0.5), ...PLACE });
  const b = P.takeCutting(S, { nodes: NODES(), nodeId: 'ax1#0', container: 'soil', at: FLOOR(0.9, 0.5), ...PLACE });
  runDays(S, 34);                                    // a 는 혹이 나서 경고가 한 번 나간 뒤
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
                   'variegated', 'varieRolled', 'deadlineDay', 'cutOnDay', 'slotId'])
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
    if (r.events.some(e => e.id === 'cutting_died')) diedAfter = 34 + i;
  }
  assert.equal(diedAfter, 40, `복원 뒤 ${diedAfter}일에 죽었습니다 — 40 이어야 합니다`);

  /* 새 게임은 삽수가 비어 있고, 그래도 저장이 통과한다(새 칸 가드) */
  const fresh = newState({ room: 'banjiha' });
  assert.deepEqual(fresh.cuttings, [], '새 게임에 삽수가 있습니다');
  assert.equal(serialize(fresh).state.cuttings.length, 0);
});

/* ══ J · ★ 유령 방지 ═════════════════════════════════════════════════ */
check('J 방이 바뀌거나 받치던 가구가 사라져도 삽수가 유령이 안 된다', () => {
  const S = newFree();
  const c = P.takeCutting(S, { nodes: NODES(), nodeId: 'ax0#0', container: 'jar',
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
  const c2 = P.takeCutting(S2, { nodes: NODES(), nodeId: 'ax0#0', container: 'jar',
                                 at: FLOOR(2.4, 1.9), size: room.size, slots: room.slots });
  P.rehomeCuttings(S2, { ...eng.room, size: { w: 2, d: 2, h: 2.3 } }, null);
  assert.ok(place.inRoom(c2.at, room.size), '방 밖 좌표를 그대로 뒀습니다');

  /* ⑤ ★ 모주가 사라져도 삽수는 유령이 안 된다 — 삽수는 모주를 참조로 안 들고 이름만 든다 */
  const S3 = newFree();
  const c3 = P.takeCutting(S3, { nodes: NODES(), nodeId: 'ax0#0', container: 'jar',
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
  const c = P.takeCutting(S, { nodes: NODES(), nodeId: 'ax0#0', container: 'jar', at: FLOOR(0.5, 0.5), ...PLACE });
  const vm2 = P.cuttingViewModel(c);
  assert.equal(vm2.assetId, 'pots/pot_glassjar.glb', `유리 수경병 에셋이 ${vm2.assetId}`);
  assert.equal(P.cuttingViewModel({ ...c, container: 'soil' }).assetId, null,
    '없는 에셋을 있다고 했습니다');
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
