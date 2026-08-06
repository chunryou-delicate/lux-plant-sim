/* ============================================================
   tools/test_cutstamina.mjs — 삽수 자르기·분갈이가 체력을 쓴다 · 2026-08-06 신설
   ------------------------------------------------------------
     node tools/test_cutstamina.mjs

   정본은 `docs/stamina.md` 와 `src/game/stamina.js` 다. **여기서 새 규칙을 만들지 않는다** —
   `ACT_COST.cut` · `ACT_COST.repot` 이 이미 1 로 적혀 있었는데 `propagation.js` 가
   `spend`/`canAct` 를 한 번도 안 불렀다. 이 검사는 그 배선을 못 박는다.

   ══ 무엇을 보나 ═══════════════════════════════════════════════════════════
     A  붙었나        — 자르기·분갈이가 실제로 체력을 쓴다
     B  ★막히나       — 바닥이면 막히고 **그때 상태가 하나도 안 바뀐다**
                        (삽수도·재고도·모주 장부도. 반쯤 자른 삽수는 없다)
     C  ★안내다       — 막힌 예외에 `tutorialInput` 이 붙는다.
                        안 붙으면 game.html 의 `isRecoverable` 이 판을 통째로 잠근다
     D  실패엔 안 문다 — 던진 동작은 체력을 안 쓴다("아무 일도 안 났는데 오늘이 끝났다" 금지)
     E  ★★ 재서 낸다  — **「콩15는 삽수를 못 자른다」가 실제로 그런가.**
                        `docs/stamina.md §2` · `docs/handoff/econgap-to-plan.md A-3` 의 주장이다.
                        지어내지 않고 **진짜 판을 굴려서** 하루에 실제로 쓰는 손을 센다.

   ★ E 는 헤드리스 생장 엔진(plant_grow.html)을 vm 으로 돌린다 —
     `tools/test_balance_routes.mjs` 와 **같은 하네스**다(새로 짓지 않았다).
   ⚠ 값을 하나도 안 바꾼다. data/** · plant_grow.html 은 읽기만 한다.
============================================================ */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { newState, pot0, setPotSlot, resowCrop, waterCrop, ARRIVAL } from '../src/game/state.js';
import { nextDay, harvestCrop } from '../src/game/loop.js';
import { firstPlayRulesFromBalance, placeBeansprout, moveMonstera,
         beansproutReady, CROP_KINDS } from '../src/game/first_play.js';
import { orderItem, stockOf, incomingOf } from '../src/game/shop.js';
import { createProfileLight } from '../src/game/room_profile.js';
import { STAMINA_MAX, ACT_COST, costOf, canAct, staminaOf } from '../src/game/stamina.js';
import { takeCutting, repotCutting, stepCuttings, cutLossOf } from '../src/game/propagation.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const J = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url), 'utf8'));

const results = [];
const check = (n, f) => { try { f(); results.push(['PASS', n]); }
                          catch (e) { results.push(['FAIL', n, e.message]); } };
const info = m => results.push(['INFO', '  ' + m]);

const RULES = firstPlayRulesFromBalance(J('../data/balance/characters.json'));
const DARK = 'banjiha-dresser:1';
const SILL = 'banjiha-sill:0';

/* ══════════════════════════════════════════════════════════════════════════
   A~D · 배선 — 생장 엔진 없이 잰다
   ------------------------------------------------------------------------
   마디 목록은 **주입**한다(test_propagation.mjs §A 와 같은 이유 —
   plant_grow.html 은 한 그루 전용이라 진짜 모주에서 못 읽어 온다).
   ══════════════════════════════════════════════════════════════════════ */
const NODES = () => ([
  { nodeId: 'ax0#0', stem: 'pink',  leaves: 1, variegatedLeaves: 0, growthDays: 60 },
  { nodeId: 'ax0#1', stem: 'thick', leaves: 2, variegatedLeaves: 1, growthDays: 80 },
  { nodeId: 'ax1#0', stem: 'pink',  leaves: 1, variegatedLeaves: 0, growthDays: 55 },
  { nodeId: 'base',  stem: 'main',  leaves: 6, variegatedLeaves: 2, growthDays: 120 }
]);

/* 자를 수 있는 판 하나. **자유 모드**다 — 초보에서는 모주를 끝내는 자르기가 따로 막히는데
   여기서 재는 것은 체력이지 초보 규칙이 아니다(그건 test_propagation §G 가 본다). */
function cuttable({ jars = 5, pots = 5 } = {}) {
  const S = newState({ room: 'banjiha', mode: 'real' });
  S.pots.push({ id: 'pot_01', plantId: 'monstera_deliciosa', slotId: null, at: null,
                variegated: true, varieChance: 0.2 });
  S.shop.stock.jar = jars;
  S.shop.stock.pot = pots;
  return S;
}

check('A-1 자르기가 체력을 쓴다 (ACT_COST.cut 그대로 · 새 비용을 안 만든다)', () => {
  assert.equal(costOf('cut'), 1, 'stamina.js 의 cut 비용이 1이 아닙니다');
  const S = cuttable();
  const before = staminaOf(S).left;
  takeCutting(S, { nodes: NODES(), nodeId: 'ax0#0', container: 'jar' });
  assert.equal(staminaOf(S).left, before - ACT_COST.cut,
    `잘랐는데 체력이 ${staminaOf(S).left} 입니다 (전 ${before})`);
  assert.equal(staminaOf(S).spentToday, ACT_COST.cut, '오늘 쓴 양이 안 쌓였습니다');
});

check('A-2 분갈이가 체력을 쓴다 (ACT_COST.repot)', () => {
  assert.equal(costOf('repot'), 1, 'stamina.js 의 repot 비용이 1이 아닙니다');
  const S = cuttable();
  const c = takeCutting(S, { nodes: NODES(), nodeId: 'ax0#0', container: 'jar' });
  for (let i = 0; i < 12; i++) { S.day++; stepCuttings(S); }   // 뿌리를 낼 때까지
  staminaOf(S).left = STAMINA_MAX;                             // 자르기 몫을 지운다 — repot 만 잰다
  staminaOf(S).spentToday = 0;
  repotCutting(S, c.id);
  assert.equal(staminaOf(S).left, STAMINA_MAX - ACT_COST.repot,
    `분갈이했는데 체력이 ${staminaOf(S).left} 입니다`);
});

check('B-1 ★바닥이면 자르기가 막힌다 — 그때 상태가 **하나도** 안 바뀐다', () => {
  const S = cuttable();
  staminaOf(S).left = 0;
  const before = {
    cuttings: S.cuttings.length,
    jar: stockOf(S, 'jar'),
    cuts: JSON.stringify(S.pots[0].cuts || null),
    loss: JSON.stringify(cutLossOf(S.pots[0]))
  };
  assert.throws(() => takeCutting(S, { nodes: NODES(), nodeId: 'ax0#0', container: 'jar' }),
    /오늘은 여기까지/, '바닥인데 잘렸습니다');
  assert.equal(S.cuttings.length, before.cuttings, '막혔는데 삽수가 생겼습니다');
  assert.equal(stockOf(S, 'jar'), before.jar,
    '막혔는데 병이 나갔습니다 — 병만 없어지고 삽수는 없는 판이 됩니다');
  assert.equal(JSON.stringify(S.pots[0].cuts || null), before.cuts, '막혔는데 모주 장부가 바뀌었습니다');
  assert.equal(JSON.stringify(cutLossOf(S.pots[0])), before.loss, '막혔는데 잘린 잎이 늘었습니다');
});

check('B-2 ★바닥이면 분갈이가 막힌다 — 포트도 안 나가고 삽수도 병에 그대로다', () => {
  const S = cuttable();
  const c = takeCutting(S, { nodes: NODES(), nodeId: 'ax0#0', container: 'jar' });
  for (let i = 0; i < 12; i++) { S.day++; stepCuttings(S); }
  staminaOf(S).left = 0;
  const before = { pot: stockOf(S, 'pot'), jar: stockOf(S, 'jar'), snap: JSON.stringify(c) };
  assert.throws(() => repotCutting(S, c.id), /오늘은 여기까지/, '바닥인데 분갈이됐습니다');
  assert.equal(stockOf(S, 'pot'), before.pot, '막혔는데 모종포트가 나갔습니다');
  assert.equal(stockOf(S, 'jar'), before.jar, '막혔는데 병이 돌아왔습니다');
  assert.equal(JSON.stringify(c), before.snap, '막혔는데 삽수가 바뀌었습니다');
});

check('C-1 ★막힌 것은 고장이 아니라 안내다 — 자르기·분갈이 둘 다 tutorialInput 이 붙는다', () => {
  const S = cuttable();
  const c = takeCutting(S, { nodes: NODES(), nodeId: 'ax0#0', container: 'jar' });
  for (let i = 0; i < 12; i++) { S.day++; stepCuttings(S); }
  staminaOf(S).left = 0;
  for (const [what, fn] of [
    ['자르기', () => takeCutting(S, { nodes: NODES(), nodeId: 'ax1#0', container: 'jar' })],
    ['분갈이', () => repotCutting(S, c.id)]
  ]) {
    try { fn(); assert.fail(`${what} 가 안 던졌습니다`); }
    catch (e) {
      assert.match(e.message, /오늘은 여기까지/, `${what} 가 다른 사유로 던졌습니다: ${e.message}`);
      assert.equal(e.tutorialInput, true,
        `${what}: tutorialInput 이 없으면 game.html 이 판을 통째로 잠급니다(isRecoverable)`);
    }
  }
});

check('D-1 ★실패한 동작에는 체력을 안 문다 (던진 자르기는 오늘을 안 끝낸다)', () => {
  const S = cuttable({ jars: 0 });
  const before = staminaOf(S).left;
  /* ㉮ 병 재고가 없다 */
  assert.throws(() => takeCutting(S, { nodes: NODES(), nodeId: 'ax0#0', container: 'jar' }));
  assert.equal(staminaOf(S).left, before, '재고가 없어 던졌는데 체력이 줄었습니다');
  /* ㉯ 잎꽂이 마디 · 없는 마디 · 없는 용기 — 사유가 체력에 덮이지 않는다 */
  const S2 = cuttable();
  const b2 = staminaOf(S2).left;
  for (const opt of [{ nodes: NODES(), nodeId: '없는마디', container: 'jar' },
                     { nodes: NODES(), nodeId: 'ax0#0', container: '없는용기' },
                     { nodes: NODES(), nodeId: 'ax0#0', container: 'tray' }])
    assert.throws(() => takeCutting(S2, opt));
  assert.equal(staminaOf(S2).left, b2, '던진 자르기가 체력을 먹었습니다');
});

check('D-2 ★체력이 바닥이어도 **사유는 사유대로** 낸다 (체력이 다른 안내를 안 덮는다)', () => {
  const S = cuttable();
  staminaOf(S).left = 0;
  assert.throws(() => takeCutting(S, { nodes: NODES(), nodeId: 'tip', container: 'jar' }),
    /모르는 마디/, '체력이 "모르는 마디"를 덮었습니다');
  assert.throws(() => takeCutting(S, { nodes: NODES(), nodeId: 'ax0#0', container: 'tray' }),
    /못 씁니다/, '체력이 "트레이는 못 쓴다"를 덮었습니다');
});

check('D-3 하루가 가면 다시 자를 수 있다 (이월도 누적도 없다)', () => {
  const S = cuttable();
  staminaOf(S).left = 1;
  takeCutting(S, { nodes: NODES(), nodeId: 'ax0#0', container: 'jar' });
  assert.equal(canAct(S, 'cut').ok, false, '바닥인데 아직 자를 수 있습니다');
  staminaOf(S).left = STAMINA_MAX;                    // loop.nextDay 의 resetDay 가 하는 그 일
  assert.equal(canAct(S, 'cut').ok, true, '날이 바뀌었는데 못 자릅니다');
});

check('D-4 체력 10 이면 하루에 열 번까지 자를 수 있고 열한 번째가 막힌다', () => {
  const S = cuttable({ jars: 20 });
  /* 모주를 크게 잡는다 — 총량(§유한성)이 아니라 **체력**이 먼저 무는지를 본다 */
  const many = Array.from({ length: 20 },
    (_, i) => ({ nodeId: `n${i}`, stem: 'pink', leaves: 1, variegatedLeaves: 0, growthDays: 60 }));
  many.push({ nodeId: 'base', stem: 'main', leaves: 40, variegatedLeaves: 0, growthDays: 200 });
  let n = 0;
  for (let i = 0; i < 20; i++) {
    try { takeCutting(S, { nodes: many, nodeId: `n${i}`, container: 'jar' }); n++; }
    catch (e) { assert.match(e.message, /오늘은 여기까지/, `${i}번째가 다른 사유로 막혔습니다: ${e.message}`); break; }
  }
  assert.equal(n, STAMINA_MAX / ACT_COST.cut, `하루에 ${n}번 잘렸습니다 — 체력 상한은 ${STAMINA_MAX} 입니다`);
});

/* ══════════════════════════════════════════════════════════════════════════
   E · ★★ 재서 낸다 — 「콩15는 삽수를 못 자른다」가 실제로 그런가
   ------------------------------------------------------------------------
   주장(`docs/stamina.md §2` · `docs/handoff/econgap-to-plan.md` A-3):
     *"콩나물 15개는 5일 주기라 매일 정확히 3회전이고, 하루 손이 10/10 이라 남는 손이 0 이다.
       ⇒ 콩15로 노가다를 돌리면 삽수를 한 번도 못 자른다."*

   그 셈은 **한 회전 = 손 3번**(물 + 수확 + 심기)을 시루마다 따로 센 것이다.
   그런데 코드는 그렇게 안 문다 — 아래 표가 그 차이를 잰다. 셈이 아니라 **판을 굴려서** 잰다.
   ══════════════════════════════════════════════════════════════════════ */
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
for (let i = 0; i < 400 && !G.thLoaded(); i++) await new Promise(r => setImmediate(r));
assert.ok(G.thLoaded(), '임계값 정본(data/growth_tuning.json)이 안 실렸습니다');

const light = createProfileLight(J('../data/profiles/room_profile.banjiha.json'), {
  lightTh: J('../data/balance/light_thresholds.json'),
  weatherBalance: J('../data/balance/weather.json')
});

function standGrowth(seed) {
  try { G.plantSeed(seed); } catch { /* 3D 무대 없음 */ }
  G.matResetAll(); G.resetDailyLight(); G.setGrowth(ARRIVAL.growthDays);
  return {
    assertContract: () => true,
    setDailyLight: d => G.setDailyLight(d),
    advanceTo(d) { const r = G.advanceTo(d); return { ...r, drawn: true, drawError: null }; },
    setGrowth(d) { const r = G.setGrowth(d); return { ...r, drawn: true, drawError: null }; },
    calendarDay: () => G.calendarDay(), growthDays: () => G.growthDays(),
    growthBlocked: () => G.growthBlocked(), growthPhase: () => G.growthPhase(),
    dli7: () => G.dli7(), dliCV: () => G.dliCV(), ageOf: d => G.ageOf(d),
    cuttableNodes: () => G.cuttableNodes(), leafStats: () => G.leafStats()
  };
}

const BEAN = CROP_KINDS.find(k => k.id === 'beansprout');
const CYCLE = BEAN.harvestDays;                 // 5 — 여기 안 박는다, 작물이 갖는다

/* 시루 N개짜리 판을 실제로 굴리고 **하루에 실제로 쓴 손**을 센다.
     policy 'stagger' 완전 시차 — 하루에 한 회전분(⌈N/주기⌉)만 물을 준다. 시루마다 한 번씩 누른다
     policy 'sameday' 겹침 — 그날 물을 줄 수 있는 시루를 **전부** 누른다(게임이 말리는 쪽)
   ★ 돈으로 막히지 않게 지갑을 채운다 — 여기서 재는 것은 **체력**이지 살림이 아니다. */
function measurePlan(sirus, policy, days = 90) {
  const io = { light, growth: standGrowth(1) };
  const S = newState({ mode: 'novice', room: 'banjiha', firstPlay: true, firstPlayRules: RULES });
  light.clearCache();
  placeBeansprout(S.firstPlay, DARK, { slots: light.room.slots });
  S.tutorial.cashWon = 100_000_000;

  const rows = [];
  for (let d = 1; d <= days; d++) {
    nextDay(S, io);                              // 하루가 가면 체력이 가득 찬다(resetDay)
    const b = S.firstPlay.beansprout;
    const needSiru = sirus - b.sirus - stockOf(S, 'siru') - incomingOf(S, 'siru');
    if (needSiru > 0) { try { orderItem(S, 'siru', needSiru); } catch { /* 배송 중 */ } }
    const target = Math.min(sirus, b.sirus + stockOf(S, 'siru'));
    const needSeed = target * 2 - stockOf(S, 'bean_seed') - incomingOf(S, 'bean_seed');
    if (needSeed > 0) { try { orderItem(S, 'bean_seed', needSeed); } catch { /* 배송 중 */ } }

    let harvested = null;
    if (beansproutReady(S.firstPlay)) { try { harvested = harvestCrop(S, io); } catch { /* 손이 모자람 */ } }
    if (harvested && harvested.arrived) {
      setPotSlot(S, pot0(S), SILL, light.room.slots);
      moveMonstera(S.firstPlay, SILL, { slots: light.room.slots });
    }
    try { resowCrop(S, { sirus: target, at: DARK, slots: light.room.slots }); } catch { /* 거둔 게 없음 */ }
    const presses = policy === 'stagger' ? Math.ceil(sirus / CYCLE) : sirus;
    for (let i = 0; i < presses; i++) {
      try { if (!waterCrop(S).watered) break; } catch { break; }
    }
    const st = staminaOf(S);
    rows.push({ pots: (b.pots || []).length, spent: st.spentToday, left: st.left,
                canCut: canAct(S, 'cut').ok });
  }
  /* 앞쪽은 시루를 사 모으는 구간이라 정상 상태가 아니다 — 뒤 절반만 센다 */
  const steady = rows.slice(Math.floor(days / 2));
  const spentMax = Math.max(...steady.map(r => r.spent));
  const spentAvg = steady.reduce((s, r) => s + r.spent, 0) / steady.length;
  const noCut = steady.filter(r => !r.canCut).length;
  return { sirus, policy, pots: steady[steady.length - 1].pots,
           spentMax, spentAvg: +spentAvg.toFixed(2),
           leftMin: Math.min(...steady.map(r => r.left)),
           noCutDays: noCut, days: steady.length, everCut: noCut < steady.length };
}

const PLANS = [5, 10, 13, 15, 17];
const TABLE = [];
for (const policy of ['stagger', 'sameday'])
  for (const n of PLANS) TABLE.push(measurePlan(n, policy));

const row = (r) => `콩${String(r.sirus).padEnd(2)} · ${r.policy === 'stagger' ? '완전시차' : '같은날 '} · ` +
  `시루 ${String(r.pots).padStart(2)}개 · 하루 손 최대 ${String(r.spentMax).padStart(2)} · ` +
  `평균 ${String(r.spentAvg).padStart(5)} · 남는 손 최소 ${String(r.leftMin).padStart(2)} · ` +
  `자를 손이 없는 날 ${r.noCutDays}/${r.days}`;
for (const r of TABLE) info(row(r));

check('E-1 ★★「콩15는 삽수를 못 자른다」— **아니다.** 완전 시차에서 손이 5 남는다', () => {
  const r = TABLE.find(x => x.sirus === 15 && x.policy === 'stagger');
  assert.ok(r.pots >= 15, `시루가 ${r.pots}개밖에 안 섰습니다 — 콩15 판이 아닙니다`);
  assert.equal(r.noCutDays, 0,
    `완전 시차 콩15에서 자를 손이 없는 날이 ${r.noCutDays}일 있습니다`);
  assert.ok(r.spentMax <= STAMINA_MAX - costOf('cut'),
    `하루 손이 최대 ${r.spentMax} 입니다 — 자를 손 ${costOf('cut')} 이 안 남습니다`);
  info(`⇒ 콩15 완전 시차의 하루 손은 최대 ${r.spentMax} · 평균 ${r.spentAvg} 다. ` +
       `문서(docs/stamina.md §2)의 9(+몬스테라 1 = 10)와 다르다`);
});

check('E-2 ★왜 다른가 — 수확·심기는 **시루마다가 아니라 부를 때마다** 한 번 문다', () => {
  /* 문서의 셈은 「한 회전 = 손 3번」을 시루마다 따로 센 것이다.
     코드는 `harvestCrop` 한 번에 익은 시루를 **전부** 거두고 손 1을 문다(loop.js).
     `resowCrop` 도 거둔 시루를 전부 다시 심고 손 1이다(state.js).
     그래서 완전 시차 콩15의 하루는 수확1 + 심기1 + 물 ⌈15/5⌉=3 = **5** 다. */
  const r = TABLE.find(x => x.sirus === 15 && x.policy === 'stagger');
  const expected = 1 /* 수확 */ + 1 /* 심기 */ + Math.ceil(15 / CYCLE) /* 물 */;
  assert.equal(r.spentMax, expected,
    `콩15 완전 시차의 하루 손이 ${r.spentMax} 입니다 — 부를 때마다 한 번이면 ${expected} 여야 합니다`);
});

check('E-3 ★그래도 상한은 있다 — **같은 날에 몰면** 손이 모자란다', () => {
  /* 겹치게 굴리면(게임이 말리는 쪽) 물주기가 시루 수만큼 나서 바닥이 난다.
     ⚠ 이건 시루 수의 상한이 아니라 **겹침의 벌**이다 — 처방은 "사지 마라"가 아니라
       first_play §겹침 그대로 "물을 날을 달리해 줘라" 다. */
  const same = TABLE.filter(x => x.policy === 'sameday');
  const hit = same.filter(x => x.noCutDays > 0).map(x => x.sirus);
  assert.ok(hit.length > 0, '같은 날에 다 몰아도 손이 안 모자랍니다 — 체력이 아무것도 안 막습니다');
  info(`같은 날 몰아주기에서 자를 손이 없는 날이 생기는 계획: 콩${hit.join(' · 콩')}`);
  /* 그래도 **영영 못 자르지는 않는다** — 수확일이 아닌 날은 손이 남는다 */
  for (const r of same)
    assert.ok(r.everCut,
      `콩${r.sirus}(같은 날)에서 ${r.days}일 내내 한 번도 못 잘랐습니다 — 그러면 튜토가 막힙니다`);
});

check('E-4 ★몬스테라 물주기는 **지금 코드에서 체력을 안 쓴다** (문서와 다르다)', () => {
  /* docs/stamina.md §2 의 하루 7번에는 "몬스테라 물 1"이 들어 있는데,
     코드에 몬스테라에 물을 주는 동작 자체가 없다(`ACT_COST.water` 를 무는 곳은
     `state.waterCrop` = 작물 시루뿐이다). 그래서 실제 하루 손은 문서보다 1 적다.
     ⚠ 여기서 만들지 않는다 — 새 동작을 짓는 것은 이 창의 몫이 아니다. 재서 남긴다. */
  const S = newState({ mode: 'novice', room: 'banjiha', firstPlay: true, firstPlayRules: RULES });
  S.pots.push({ id: 'pot_01', plantId: 'monstera_deliciosa', slotId: null, at: null });
  const before = staminaOf(S).left;
  const io = { light, growth: standGrowth(2) };
  nextDay(S, io);
  assert.equal(staminaOf(S).spentToday, 0,
    '하루가 가는 것만으로 체력이 줄었습니다 — 하루 넘기기는 공짜여야 합니다(docs/stamina.md §3)');
  info('몬스테라 물주기는 코드에 동작이 없어 손을 안 쓴다 — 문서의 "하루 7번"은 6번이다');
  assert.equal(before, STAMINA_MAX);
});

/* ══ 결과 ═══════════════════════════════════════════════════════════════ */
let fail = 0, pass = 0;
for (const [tag, name, msg] of results) {
  if (tag === 'INFO') { console.log(`INFO  ${name}`); continue; }
  if (tag === 'PASS') { pass++; console.log(`PASS  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}\n      → ${msg}`); }
}
console.log(`\ncutstamina: ${fail ? 'FAIL' : 'PASS'}  (${pass}/${pass + fail})`);
process.exit(fail ? 1 : 0);
