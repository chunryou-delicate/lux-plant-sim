/* ★ 살림을 다시 짠다 — 세 층이 각자 제 일을 하나 (2026-08-09 · 박사님 지시)
 *
 *   node tools/probe_econ.mjs              (8판 · 빠름)
 *   node tools/probe_econ.mjs --seeds 16
 *   node tools/probe_econ.mjs --only 1     (§1 산수만 — 즉시)
 *
 * 박사님 지시 원문:
 *   *"시작돈을 130만원으로 일단하자. 월세가 지금 30만원이잖아? 30일 기준으로 해서, 바로
 *     시작날이 바로 30일기준 마지막날인거야. 다음날 누르면 월세 30만원이 쓱 빠지게, 그리고
 *     식대도 빠지게 해서 돈에 대한 설명을 먼저 하고 가는게 좋겠어. 식비까지 하면 3달도
 *     빠듯하겠다는 식으로. (…) 채소로 다량을 하면 월세랑 식대 유지정도가 가능하도록 밸런스를
 *     맞추고, 몬스테라는 이사를 위한 발판, 그리고 가구를 사서 칸수를 늘릴수있는거야."*
 *
 * ══ 세 층을 따로 잰다 ═════════════════════════════════════════════════════
 *   생존 — 채소(시루). **월세+식대가 유지되나.** 유지가 안 되면 이사까지 못 간다
 *   성장 — 몬스테라·삽수. **이사 자금이 며칠에 모이나**
 *   투자 — 시루(칸)를 늘리는 값. **몇 일 만에 회수되나.** 회수가 안 되면 아무도 안 산다
 *
 * ══ ★ 이 도구가 재는 것 ═══════════════════════════════════════════════════
 *   §1 산수     — 작물 없이 며칠에 마르나 (계산 · 즉시)
 *   §2 시루 수  — 시루를 N개 돌리면 **하루 순현금**이 얼마인가 (실측)
 *   §3 전체     — 파산일 · 이사일 · 등 이득비 (실측)
 *   §4 회수     — 시루값이 며칠에 돌아오나 (실측에서 유도)
 *   §5 전기세   — 그 안에서 몇 %인가
 *
 * ══ ★★ 시루가 돈이 되는 길은 둘이다 (first_play.js §잉여 판매) ═══════════
 *   ① **곳간** — 그날 첫째 수확 3,000원 · 둘째 2,000 · 셋째 1,000 · 넷째부터 0.
 *      게다가 곳간 자체에 하루 상한이 있다(`cropMealCapWon` = 2끼 × 2,500 = 5,000원).
 *   ② **잉여 판매** — ①에서 못 받은 몫(겹침 손실 + 곳간 초과)이 `surplusWon` 에 쌓이고
 *      `sellCropSurplus` 가 **정가의 70%** 로 바꾼다(`cropSurplusSaleRate`, ⚠ 미확정값).
 *   ⇒ 그래서 시루를 늘리면 ①은 5,000원에서 막히고 **②만 늘어난다.**
 *     「다량으로 하면 유지된다」가 성립하는지는 전적으로 ②에 달려 있다. 그것을 잰다.
 *
 * ══ ⚠⚠ 함정 — **달력일로 나누면 안 된다** (2026-08-09에 실제로 틀렸다) ══════
 * 처음 이 도구는 「달력 90일」을 돌리고 그 90으로 나눠 하루 순현금을 냈다. **그게 틀렸다.**
 *
 * 살림(월세·식비)은 **튜토 시계가 돌 때만** 나간다. 튜토 시계는 첫 플레이가 끝나야 시작한다
 * (`tutorial.tutorialDay` 첫 줄 — `if (!firstPlayDone) return`). 그런데 시루가 많을수록
 * 첫 플레이가 길어져서, **같은 달력 90일 안에 든 튜토일이 시루 1개면 90일, 30개면 68일**이었다.
 * ⇒ 분모가 후보마다 달랐다. 시루를 늘릴수록 이득이 짧은 기간에 눌려 담겨
 *   **곡선이 납작해 보였다** — 시루 30개의 하루 순현금이 −12,049원인데 −17,569원으로 찍혔다.
 *
 * ★ 그래서 「시루를 늘려도 −19,740 → −17,569 밖에 안 간다, 천장에 막혔다」는 결론이 나왔다.
 *   **그 결론이 통째로 틀렸다.** 천장은 없다. 기울기가 완만할 뿐이다(측정 261원/시루/일).
 *   둘은 처방이 정반대다 — 「천장」이면 상한을 풀어야 하고, 「기울기」면 회전분·판매가·주기를
 *   올려야 한다. 재는 자가 틀려서 처방이 뒤집힐 뻔했다.
 *
 * ⇒ **`play({ tutorialDays: N })` 을 써라.** 튜토 시계가 N일에 닿을 때까지 돈다.
 *   달력일로 도는 것은 이사일을 재는 §5 뿐이다 — 거기서는 「며칠에 나가나」가 곧 답이라 분모가 없다.
 *
 * ⚠ 코드를 안 고친다. 규칙 사본을 `S.tutorial.rules` 에 꽂을 뿐이다.
 *   하네스는 `tools/probe_elec.mjs`(= test_banjiha_routes) 것을 그대로 썼다.
 */
import assert from 'node:assert';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProfileLight } from '../src/game/room_profile.js';
import { newState, pot0, setPotSlot, resowCrop, waterCrop, waterPot,
         sellCropSurplus, ARRIVAL } from '../src/game/state.js';
import { nextDay, harvestCrop } from '../src/game/loop.js';
import { firstPlayRulesFromBalance, placeBeansprout, placeCrop, moveMonstera,
         beansproutReady, cropSites, CROP_SITE_IDS } from '../src/game/first_play.js';
import { seasonAt, buyLamp, canMoveOut, moveOut, varieView, TUTORIAL_RULES,
         dailyCashOutWon, lampElectricityWon, lampWattsOn, electricityWonOf } from '../src/game/tutorial.js';
import { orderItem, stockOf, incomingOf, priceOf, sellCutting, sellPot,
         SELLABLE_CUTTING_STATUS } from '../src/game/shop.js';
import { takeCutting, cuttableNow, cutBudgetOf, motherStatsNow } from '../src/game/propagation.js';

const T0 = Date.now();
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const J = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url), 'utf8'));
const argv = process.argv.slice(2);
const argOf = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const SEED_N = Number(argOf('--seeds', 8));
const ONLY = argOf('--only', null);
const SEEDS = Array.from({ length: SEED_N }, (_, i) => i + 1);

const PRESETS = J('../data/lighting_presets.json');
const BASE_PROFILE = J('../data/profiles/room_profile.banjiha.json');
const LIGHT_TH = J('../data/balance/light_thresholds.json');
const WEATHER_BAL = J('../data/balance/weather.json');
const HOMES = J('../data/balance/homes.json');
const CHARS = J('../data/balance/characters.json');
const RULES = firstPlayRulesFromBalance(CHARS);
const DARK = 'banjiha-dresser:1';
const SILL = 'banjiha-sill:0';
const R0 = TUTORIAL_RULES;
const MOVE_OUT_WON = R0.moveOutCostWon;
const DAILY_OUT = dailyCashOutWon({ rules: R0, movedOut: false });
const SIRU_WON = 7_000;      // shop.CATALOG.siru — 아래 §2 가 실제 값을 다시 읽어 확인한다

/* ══ 헤드리스 생장 엔진 (probe_lamp_econ.mjs · test_balance_routes.mjs 와 같은 하네스) ══ */
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


/* ══ 판 하나 ═══════════════════════════════════════════════════════════════ */
function viewOf(S, io) {
  const raw = io.growth.cuttableNodes();
  const stats = io.growth.leafStats();
  const v = varieView(S, { nodes: raw, stats });
  return { nodes: cuttableNow(S, v.nodes || []), stats: motherStatsNow(S, v.stats),
           budget: cutBudgetOf(S, v.nodes || []) };
}
function pickNode(nodes, budget) {
  const varie = nodes.filter(n => n.variegatedLeaves > 0 && (!budget || n.leaves <= budget.leftLeaves - 1))
                     .sort((a, b) => a.leaves - b.leaves);
  if (varie.length) return varie[0];
  const one = nodes.filter(n => n.leaves === 1 && (!budget || budget.leftLeaves - 1 >= 1));
  return one.length ? one[0] : null;
}
const median = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };

/* ★★ 물주기 = 회전 시작. **하루에 하나씩만** 시작해야 거두는 날이 어긋난다
   (first_play.js §겹침 — 5일 주기면 5개까지 매일 3,000원이 나온다).
   `waterCrop(S, { all: true })` 로 다 주면 같은 날 다 거둬 둘째부터 깎인다.
   ⇒ 이 재현은 **표준 플레이**를 흉내낸다: 하루에 하나씩. */
function play(opt = {}) {
  const sirus = Math.max(0, opt.sirus ?? 1);
  const litHours = opt.litHours || 12;
  const light = createProfileLight(structuredClone(BASE_PROFILE), { lightTh: LIGHT_TH, weatherBalance: WEATHER_BAL });
  const io = { light, growth: standGrowth(opt.seed || 1) };

  const S = newState({ mode: 'novice', room: 'banjiha', firstPlay: true,
                       firstPlayRules: opt.fpRules || RULES });
  const ts = S.tutorial;
  if (opt.rules) ts.rules = opt.rules;
  ts.lamp.litHours = litHours;
  S.lamps.litHours = litHours;

  placeBeansprout(S.firstPlay, DARK, { slots: light.room.slots });

  const rows = [];
  let lampDay = null, brokeDay = null, moveDay = null;
  let powerNominal = 0, powerPaid = 0;
  let surplusCash = 0, foodSaved = 0, seedSpend = 0, siruSpend = 0, siruBought = 0;
  let cuttingCash = 0, potCash = 0, maxSirus = 0;
  const sell = c => { const r = sellCutting(S, c.id); cuttingCash += r.won; return r.won; };

  /* ★★ **튜토일로 멈춘다 — 달력일이 아니다** (2026-08-09 정정. 아래 머리말 §함정 참고).
     `opt.tutorialDays` 를 주면 튜토 시계가 그 날에 닿을 때까지 돈다. 안 주면 예전처럼 달력으로 돈다
     (이사일을 재는 §5 는 그쪽이 맞다 — 거기서는 「며칠에 나가나」가 곧 답이라 분모가 없다). */
  const stopAt = Number.isFinite(opt.tutorialDays) ? opt.tutorialDays : Infinity;
  for (let d = 1; d <= (opt.days || 300) && ts.day < stopAt; d++) {
    /* ★★ 「채소를 다량으로」는 **한 번 눌러 다 주는 것**이다.
       `waterCrop(S)` 는 시루 **하나**만 시작한다 — 하루에 하나씩 시작하면 거두는 날이 어긋나
       매일 3,000원(그날 첫째)이 들어오는 대신 **하루 한 회전이 처리 상한**이 된다.
       그래서 시루를 아무리 늘려도 잉여가 한 푼도 안 났다(첫 실측에서 실제로 0원이었다).
       `{ all: true }` 면 대기 중인 것을 전부 시작한다 — 같은 날 다 거둬 **겹치고**, 그 겹친 몫이
       잉여가 되어 팔린다. 체력도 한 번치(1)만 든다(stamina.ACT_COST.water). */
    /* ★★ 2026-08-09 정정 — 「다량으로」에는 **두 가지 손놀림**이 있고 결과가 아주 다르다.
         waterAll  한 버튼으로 다 준다 → 같은 날 거둔다 → 겹쳐서 3,000/2,000/1,000 으로 깎이고
                   나머지는 잉여로 샌다
         spread    하루에 `ceil(N/5)` 개씩 시작한다 → 거두는 날이 흩어진다 → 온전히 받는다
       ⚠ 예전에는 `waterCrop(S)` 를 하루 **한 번**만 부르는 것을 「분배」라고 불렀는데, 그러면
         회전 시작이 하루 1개로 막혀 **다섯 갈래만 차고 나머지 시루는 아예 안 돈다.**
         ★ 검산법 — **시루 N개 판의 곳간절감이 시루 5개 판과 같으면 흩기가 안 된 것이다.** */
    if (opt.spread) {
      const cap = Math.ceil(sirus / 5);
      for (let k = 0; k < cap; k++) {
        let ok = false;
        try { ok = !!waterCrop(S).watered; } catch { break; }
        if (!ok) break;
      }
    } else {
      try { waterCrop(S, { all: !!opt.waterAll }); } catch { /* 아직 안 놓은 시루 · 이미 준 날 */ }
    }
    try { waterPot(S); } catch { /* 아직 없거나 안 놓은 화분 */ }
    const cashBefore = ts.cashWon;
    const turn = nextDay(S, io).turn;
    const t = turn && turn.tutorial;
    const nominal = (t && t.electricityWon) || 0;
    powerNominal += nominal;
    powerPaid += Math.min(nominal, Math.max(0, cashBefore - ts.cashWon));
    if (t) foodSaved += t.savedWon || 0;

    let harvested = null;
    if (beansproutReady(S.firstPlay.beansprout)) harvested = harvestCrop(S, io);
    if (harvested && harvested.arrived) {
      setPotSlot(S, pot0(S), SILL, light.room.slots);
      moveMonstera(S.firstPlay, SILL, { slots: light.room.slots });
    }

    /* ── ★ 잉여 팔기 — 「다량으로 하면 유지된다」가 성립하는지가 여기 달렸다 ── */
    try { const r = sellCropSurplus(S); if (r && r.won > 0) surplusCash += r.won; } catch { /* 팔 것 없음 */ }

    /* ── 작물 회전 — 시루를 opt.sirus 개까지 늘려 돌린다 ─────────────────── */
    if (sirus > 0) {
      const b = S.firstPlay.beansprout;
      const have = (b.sirus || 0) + stockOf(S, 'siru') + incomingOf(S, 'siru');
      if (have < sirus) {
        try { const o = orderItem(S, 'siru', 1); siruSpend += o.totalWon; siruBought++; }
        catch { /* 돈이 모자라면 다음 날 */ }
      }
      const target = Math.min(sirus, (b.sirus || 0) + stockOf(S, 'siru'));
      const needSeed = target - stockOf(S, 'bean_seed') - incomingOf(S, 'bean_seed');
      if (needSeed > 0) { try { const o = orderItem(S, 'bean_seed', needSeed); seedSpend += o.totalWon; } catch {} }
      if (b.harvested && stockOf(S, 'bean_seed') >= 1) {
        try { resowCrop(S, { sirus: target, at: DARK, slots: light.room.slots }); } catch { /* 다음 날 */ }
      }
      maxSirus = Math.max(maxSirus, b.sirus || 0);
    }

    if (opt.buyLamp && ts.lamp.unlocked && ts.lamp.owned < (opt.lamps || 1) &&
        ts.cashWon >= ts.rules.lampPriceWon) {
      buyLamp(ts); S.lamps.count = ts.lamp.owned; light.clearCache();
      if (lampDay == null) lampDay = ts.day;
    }

    /* ── 몬스테라·삽수 — 「성장」 층 ─────────────────────────────────────── */
    if (opt.propagate !== false) {
      const v0 = pot0(S) ? viewOf(S, io) : null;
      const node = v0 ? pickNode(v0.nodes, v0.budget) : null;
      if (node && (S.cuttings || []).length === 0 && stockOf(S, 'jar') + incomingOf(S, 'jar') === 0) {
        try { orderItem(S, 'jar', 1); } catch {}
      }
      if (node && stockOf(S, 'jar') >= 1) {
        try { takeCutting(S, { nodes: v0.nodes, nodeId: node.nodeId, container: 'jar' }); } catch {}
      }
      for (const c of [...(S.cuttings || [])]) if (SELLABLE_CUTTING_STATUS.includes(c.status)) sell(c);

      if (!ts.movedOut && pot0(S)) {
        const v = viewOf(S, io);
        const potWon = v.stats && v.stats.leaves >= 1
          ? priceOf({ leaves: v.stats.leaves, variegatedLeaves: v.stats.variegatedLeaves }).won : 0;
        let cut = 0;
        for (const c of S.cuttings || [])
          if (SELLABLE_CUTTING_STATUS.includes(c.status))
            cut += priceOf({ leaves: c.source.leaves, variegatedLeaves: c.source.variegatedLeaves }).won;
        if (ts.cashWon + cut + potWon >= MOVE_OUT_WON) {
          for (const c of [...(S.cuttings || [])]) if (SELLABLE_CUTTING_STATUS.includes(c.status)) sell(c);
          if (potWon && ts.cashWon < MOVE_OUT_WON) {
            const r = sellPot(S, { leaves: v.stats.leaves, variegatedLeaves: v.stats.variegatedLeaves });
            potCash += (r && r.won) || 0;
          }
        }
      }
      if (!ts.movedOut && canMoveOut(ts).ok) { moveOut(ts); moveDay = ts.day; }
    }

    if (brokeDay == null && ts.bankrupt) brokeDay = ts.day;
    rows.push({ tday: ts.day, cashWon: ts.cashWon, bankrupt: ts.bankrupt });
    if (ts.movedOut) break;
  }
  const last = rows[rows.length - 1] || { tday: 0, cashWon: ts.cashWon };
  return { movedOut: ts.movedOut, moveDay, lastDay: last.tday, brokeDay, lampDay,
           powerNominal, powerPaid, surplusCash, foodSaved, seedSpend, siruSpend, siruBought,
           cuttingCash, potCash, maxSirus, cashEnd: ts.cashWon, days: rows.length,
           tutorialDays: ts.day,
           brokeDays: rows.filter(r => r.bankrupt).length,
           varieGrants: (ts.varieGrant || {}).count || 0 };
}

function route(opt) {
  const runs = SEEDS.map(seed => play({ ...opt, seed }));
  const ok = runs.filter(r => r.movedOut);
  const broke = runs.map(r => r.brokeDay).filter(v => v != null);
  const M = k => median(runs.map(r => r[k]));
  return { runs, rate: ok.length / runs.length,
           medMove: ok.length ? median(ok.map(r => r.lastDay)) : null,
           medBroke: broke.length ? median(broke) : null, brokeRate: broke.length / runs.length,
           medSurplus: M('surplusCash'), medFood: M('foodSaved'), medSeed: M('seedSpend'),
           medSiruSpend: M('siruSpend'), medSiru: M('maxSirus'), medDays: M('days'),
           medCutting: M('cuttingCash'), medPowerNominal: M('powerNominal'), medPowerPaid: M('powerPaid'),
           medBrokeDays: M('brokeDays'), medGrants: M('varieGrants'),
           medTutorialDays: M('tutorialDays') };
}

const won = v => v == null ? '—' : Math.round(v).toLocaleString();
const pct = (a, b) => b ? (a / b * 100).toFixed(1) + '%' : '—';

/* ══════════════════════════════════════════════════════════════════════════ */
console.log('══ 살림을 다시 짠다 (probe_econ) ═══════════════════════════════════');
console.log(`★ 표본 ${SEED_N}판 · 반지하 · 콩나물 서랍장 · 몬스테라 창턱 · 최대 300일`);
console.log('');

/* ── §1 산수 — 작물 없이 며칠에 마르나 ─────────────────────────────────── */
console.log('── §1 살림 산수 (계산) ─────────────────────────────────────────────');
const BANJIHA = (HOMES.homes || []).find(h => h.id === 'banjiha') || {};
{
  console.log(`  시작돈        ${won(R0.startCashWon)}원`);
  console.log(`  월세          ${won(R0.rentWon)}원 / ${R0.rentPeriodDays}일   ← homes.json banjiha.rent = ${won(BANJIHA.rent)}원`);
  console.log(`  첫 청구       튜토 ${R0.rentFirstDueDay}일차 — 유예 없음`);
  console.log(`  하루 지출 합  ${won(R0.dailySpendWon)}원 = 월세 ${won(R0.rentWon / R0.rentPeriodDays)}` +
              ` + 공과 ${won((BANJIHA.utility || 0) / R0.rentPeriodDays)} + 식비 ${won(RULES.dailyFoodWon)}`);
  console.log(`  하루 현금차감 ${won(DAILY_OUT)}원 (월세 몫을 뺀 것 — 월세는 목돈으로 따로)`);
  console.log(`  곳간 하루상한 ${won(RULES.cropMealCapWon)}원 · 지금 작물 ${RULES.cropKinds || 2}종의 한 회전 절감 합 ${won(RULES.dailyCropSaveWon)}원`);
  console.log(`  잉여 판매가   정가의 ${(RULES.cropSurplusSaleRate * 100).toFixed(0)}%   ⚠ 미확정값`);
  console.log('');
  const dry = (save) => {
    let cash = R0.startCashWon, due = R0.rentFirstDueDay, day = 0;
    while (cash > 0 && day < 500) {
      day++;
      cash -= Math.max(0, DAILY_OUT - save);
      if (day >= due) { cash -= R0.rentWon; due += R0.rentPeriodDays; }
    }
    return day;
  };
  console.log(`  작물 없이                     → 0원까지 **${dry(0)}일**`);
  console.log(`  곳간 상한까지(하루 ${won(RULES.cropMealCapWon)})     → 0원까지 **${dry(RULES.cropMealCapWon)}일**`);
  console.log(`  ★유지(순유출 0)에 필요한 하루 벌이 = ${won(DAILY_OUT + R0.rentWon / R0.rentPeriodDays)}원`);
  console.log(`   그중 곳간이 낼 수 있는 최대가 ${won(RULES.cropMealCapWon)}원 ⇒ **모자란 ${won(DAILY_OUT + R0.rentWon / R0.rentPeriodDays - RULES.cropMealCapWon)}원은 잉여 판매가 내야 한다**`);
}
if (ONLY === '1') { console.log(`\n(${((Date.now() - T0) / 1000).toFixed(0)}초)`); process.exit(0); }


/* ★ 잉여 판매가·끼니 상한을 바꾼 **첫 플레이 규칙 사본**.
   ⚠ 코드를 안 고친다 — `firstPlayRulesFromBalance` 가 이미 `characters.json._meta` 의
     `cropSurplusSaleRate` · `cropMealCapPerPerson` 을 **먼저 읽는다**(first_play.js §잉여 판매).
     즉 이 둘은 **`data/balance/characters.json` 만 고치면 바뀌는 값**이다. 여기서는 그 파일을
     메모리 위에서만 바꿔 넘긴다. */
function fpRulesFor({ rate, capMeals, fullWon } = {}) {
  const meta = { ...CHARS._meta };
  if (rate != null) meta.cropSurplusSaleRate = rate;
  if (capMeals != null) meta.cropMealCapPerPerson = capMeals;
  const R = firstPlayRulesFromBalance({ ...CHARS, _meta: meta });
  if (fullWon == null) return R;
  /* ★ 회전분(`cropKindSavedWon`)만은 `data/balance` 에서 못 읽는다 — first_play.js 안에 있다
     (econ-to-plan.md §7 이 그 이동을 요청하고 있다). 여기서는 규칙 사본에 덮어쓴다:
     `cropCycleSavedWon`·`overlapSavedWon` 이 둘 다 `rules.cropKindSavedWon` 을 **먼저** 보므로
     이 한 줄로 실제 셈이 바뀐다. 파생값(합계·곳간 상한)도 같이 다시 낸다 — 안 그러면
     한 회전분은 커졌는데 곳간이 옛 값으로 막는 반쪽짜리 판이 된다. */
  const table = Object.freeze([fullWon, Math.round(fullWon * 2 / 3), Math.round(fullWon / 3)]);
  const perCycle = table.slice(0, R.cropKinds).reduce((a, b) => a + b, 0);
  return Object.freeze({ ...R, cropKindSavedWon: table, cropSavedWonPerCycle: perCycle,
                         dailyCropSaveWon: Math.min(perCycle, R.cropMealCapWon),
                         cropCapBinding: perCycle > R.cropMealCapWon });
}

/* ── §2 시루를 늘리면 — 「생존」 층 ─────────────────────────────────────── */
const NEED = DAILY_OUT + R0.rentWon / R0.rentPeriodDays;     // 유지에 필요한 하루 벌이
const TDAYS = 90;                                            // ★튜토일 고정 (머리말 §함정)
console.log('');
console.log('── §2 ★시루 수 — 「채소를 다량으로」가 유지를 만드나 (지금 값) ─────');
console.log(`  (몬스테라·삽수를 끄고 **튜토 ${TDAYS}일 고정**. 물은 한 번에 다 준다 = 한 버튼)`);
console.log('| 시루 | 달력일 | 식비절감 | 잉여판매 | 씨앗 | 시루값 | 하루벌이 | ★하루 순현금 | ↑한 개당 | 0원날 |');
console.log('|------|--------|----------|----------|------|--------|----------|--------------|----------|-------|');
const SIRU_CASES = [1, 3, 5, 10, 20, 30, 40];
const cropRows = [];
let prevRow = null;
for (const n of SIRU_CASES) {
  const r = route({ sirus: n, propagate: false, days: 400, tutorialDays: TDAYS, buyLamp: false, waterAll: true });
  const gain = (r.medFood + r.medSurplus - r.medSeed - r.medSiruSpend) / TDAYS;
  const net = gain - NEED;
  const dN = prevRow ? (net - prevRow.net) / (n - prevRow.n) : null;
  cropRows.push({ n, r, net, gain });
  console.log(`| ${String(n).padStart(4)} | ${String(r.medDays).padStart(6)} | ${won(r.medFood).padStart(8)} | ` +
    `${won(r.medSurplus).padStart(8)} | ${won(r.medSeed).padStart(4)} | ${won(r.medSiruSpend).padStart(6)} | ` +
    `${(won(gain) + '원').padStart(8)} | ${((net >= 0 ? '+' : '') + won(net) + '원').padStart(12)} | ` +
    `${(dN == null ? '—' : (dN >= 0 ? '+' : '') + won(dN) + '원').padStart(8)} | ${String(r.medBrokeDays).padStart(5)} |`);
  prevRow = { n, net };
}
console.log(`  ★하루 순현금 = (식비절감 + 잉여판매 − 씨앗 − 시루값) ÷ ${TDAYS} − ${won(NEED)}원(하루 살림)`);
console.log('    0 이상이면 「채소만으로 유지된다」. 음수면 그만큼 매일 마른다.');
{
  const a = cropRows[0], b = cropRows[cropRows.length - 1];
  const slope = (b.gain - a.gain) / (b.n - a.n);
  console.log(`  ★★ 기울기 ${won(slope)}원/시루/일 — **꺾이는 데가 없다.** 천장이 있어서가 아니라`);
  console.log(`     기울기가 완만해서 안 닿는 것이다. 0 이 되는 지점 = 시루 ` +
              `**${Math.ceil(a.n + (NEED - a.gain) / slope)}개**`);
  console.log('     ⚠ 앞쪽(시루 1~3)이 들쭉날쭉한 것은 천장이 아니라 **0원이라 씨앗을 못 산 것**이다.');
}

/* ── §3 회전 경제 — 씨앗값·시루값을 갚나 (계산) ─────────────────────────── */
console.log('');
console.log('── §3 ★잉여 판매가 후보 — 세 문턱을 순서대로 넘나 (계산) ───────────');
console.log('  ① 한 회전 순익 > 0 (씨앗값을 넘나)  ② 시루값 7,000원을 N회전에 갚나');
console.log('  ③ 그 뒤로 남나  ④ ⚠ 밥으로 먹는 것보다 파는 게 나아지면 뼈대가 뒤집힌다');
{
  const FULL = 3_000;                    // 콩나물 한 회전분 (cropKindSavedWon[0])
  const SEED = 700;                      // buyPriceOf('bean_seed')
  const SIRU = SIRU_WON;
  console.log('');
  console.log('| 판매가율 | 한 회전 현금 | 순익(−씨앗) | 시루값 회수 | 그게 며칠 | 밥(3,000) 대비 | 판정 |');
  console.log('|----------|--------------|-------------|-------------|-----------|----------------|------|');
  for (const rate of [0.233, 0.35, 0.50, 0.70, 0.85, 1.00, 1.20]) {
    const cash = Math.round(FULL * rate);
    const net = cash - SEED;
    const nCycles = net > 0 ? Math.ceil(SIRU / net) : null;
    const verdict = rate < 0.234 ? '★씨앗값도 못 건진다'
                  : rate >= 1.00 ? '⚠팔이 밥보다 낫다 — 뼈대가 뒤집힌다'
                  : '쓸 수 있다';
    console.log(`| ${(rate * 100).toFixed(1).padStart(7)}% | ${(won(cash) + '원').padStart(12)} | ` +
      `${((net >= 0 ? '+' : '') + won(net) + '원').padStart(11)} | ` +
      `${(nCycles ? nCycles + '회전' : '★영영').padStart(11)} | ` +
      `${(nCycles ? nCycles * 5 + '일' : '—').padStart(9)} | ` +
      `${(rate * 100).toFixed(0).padStart(13)}% | ${verdict} |`);
  }
  console.log('');
  console.log(`  손익분기 — 콩나물 ${(SEED / FULL * 100).toFixed(1)}% · 무순 ${(600 / 2000 * 100).toFixed(1)}%` +
              '  (씨앗 실구매가 ÷ 한 회전분. shop.cropBreakEvenRate 와 같은 식)');
  console.log('  ⚠ 이 표는 **잉여로 넘어간 몫**의 셈이다. 곳간 상한 안에 들어간 몫은 밥이지 돈이 아니다.');
}

/* ── §4 후보 — 판매가율 × 끼니 상한을 실제로 굴려 본다 ───────────────────── */
console.log('');
console.log(`── §4 ★후보 실측 — 판매가율 × 끼니 상한 (시루 20개 · 튜토 ${TDAYS}일) ────`);
console.log('| 후보 | 판매가율 | 끼니상한 | 곳간상한원 | 식비절감 | 잉여판매 | ★하루 순현금 | 유지? | 파산일 |');
console.log('|------|----------|----------|------------|----------|----------|--------------|-------|--------|');
const CANDS = [
  { id: 'C0', rate: null, cap: null, ko: '지금 (70% · 2끼)' },
  { id: 'C1', rate: 0.85, cap: null, ko: '판매가 85%' },
  { id: 'C2', rate: null, cap: 4,    ko: '끼니 상한 4끼' },
  { id: 'C3', rate: 0.85, cap: 4,    ko: '85% + 4끼' },
  { id: 'C4', rate: 0.70, cap: 8,    ko: '70% + 8끼' },
  { id: 'C5', rate: 0.99, cap: 8,    ko: '99% + 8끼 (⚠상한선)' }
];
const candRows = [];
for (const c of CANDS) {
  const fp = fpRulesFor({ rate: c.rate, capMeals: c.cap });
  const r = route({ sirus: 20, propagate: false, days: 400, tutorialDays: TDAYS,
                    buyLamp: false, waterAll: true, fpRules: fp });
  const net = (r.medFood + r.medSurplus - r.medSeed - r.medSiruSpend) / TDAYS - NEED;
  candRows.push({ c, r, net, fp });
  console.log(`| ${c.id.padEnd(4)} | ${((fp.cropSurplusSaleRate * 100).toFixed(0) + '%').padStart(8)} | ` +
    `${(fp.dailyCropMealCap + '끼').padStart(8)} | ${(won(fp.cropMealCapWon) + '원').padStart(10)} | ` +
    `${won(r.medFood).padStart(8)} | ${won(r.medSurplus).padStart(8)} | ` +
    `${((net >= 0 ? '+' : '') + won(net) + '원').padStart(12)} | ${(net >= 0 ? ' 유지 ' : ' 마름 ').padStart(5)} | ` +
    `${String(r.medBroke ?? '—').padStart(6)} |  ${c.ko}`);
}

/* ── §5 전체 판 — 파산일 · 이사일 · 등 이득비 ────────────────────────────── */
console.log('');
console.log('── §5 전체 판 — 파산일 · 이사일 · 등 이득비 (시루 20 · 300일) ──────');
console.log('| 후보 | 등 | 이사일 | 이사율 | 파산일 | 0원날 | 잉여판매 | 삽수수입 | 모주판매 | 무늬 |');
console.log('|------|----|--------|--------|--------|-------|----------|----------|----------|------|');
const full = {};
for (const c of [CANDS[0], CANDS[3], CANDS[4]]) {
  const fp = fpRulesFor({ rate: c.rate, capMeals: c.cap });
  for (const lamp of [false, true]) {
    const r = route({ sirus: 20, buyLamp: lamp, lamps: 1, days: 300, waterAll: true, fpRules: fp });
    full[`${c.id}/${lamp ? 1 : 0}`] = r;
    console.log(`| ${c.id.padEnd(4)} | ${lamp ? '있' : '없'} | ${String(r.medMove ?? '못나감').padStart(6)} | ` +
      `${((r.rate * 100).toFixed(0) + '%').padStart(6)} | ${String(r.medBroke ?? '—').padStart(6)} | ` +
      `${String(r.medBrokeDays).padStart(5)} | ${won(r.medSurplus).padStart(8)} | ` +
      `${won(r.medCutting).padStart(8)} | ${won(median(r.runs.map(x => x.potCash))).padStart(8)} | ` +
      `${String(r.medGrants).padStart(4)} |`);
  }
}
for (const c of [CANDS[0], CANDS[3], CANDS[4]]) {
  const A = full[`${c.id}/0`], B = full[`${c.id}/1`];
  const g = (A.medMove && B.medMove) ? A.medMove / B.medMove : null;
  console.log(`  ${c.id} — 등 이득비 ${g == null ? '못 잼' : '×' + g.toFixed(2)}` +
    `${g != null && g < 1.02 ? '  ★등이 죽었다' : ''}`);
}

/* ── §6 「몬스테라 = 이사 발판」 층이 실제로 지탱하나 ────────────────────── */
console.log('');
console.log('── §6 ★성장 층 — 이사 자금 1,500,000원이 어디서 오나 ───────────────');
{
  const B = full['C0/1'];
  const cut = B.medCutting, pot = median(B.runs.map(x => x.potCash)), sur = B.medSurplus;
  const tot = cut + pot + sur;
  console.log(`  삽수(증식체) 판매  ${won(cut).padStart(10)}원  ${pct(cut, tot).padStart(6)}`);
  console.log(`  모주(화분) 판매    ${won(pot).padStart(10)}원  ${pct(pot, tot).padStart(6)}`);
  console.log(`  잉여 채소 판매     ${won(sur).padStart(10)}원  ${pct(sur, tot).padStart(6)}`);
  console.log(`  ─────────────────────────────────`);
  console.log(`  합계               ${won(tot).padStart(10)}원  (이사 자금 ${won(MOVE_OUT_WON)}원)`);
  console.log('');
  console.log(`  ★확정 무늬를 받은 횟수(중앙값) ${B.medGrants}회 — 이사 자금은 사실상 **모주 한 번**으로 온다.`);
  console.log('   증식체(삽수) 판매는 금액으로는 작지만 **확정 무늬가 오는 조건**이다');
  console.log('   (tutorial.varieGrantCheck — "삽수를 한 번도 안 잘라 봤으면 안 준다").');
  console.log('   ⇒ 막혀 있지 않다. 다만 **돈이 아니라 열쇠로** 일하고 있다.');
}

/* ── §7 전기세 몫 ───────────────────────────────────────────────────────── */
console.log('');
console.log('── §7 전기세가 이 살림에서 차지하는 몫 ─────────────────────────────');
{
  for (const [n, h] of [[1, 12], [2, 24]]) {
    const w = Math.round(electricityWonOf(R0, lampWattsOn(R0, n) * h / 1000));
    console.log(`  등 ${n}개 ${h}h — 하루 ${won(w)}원 = 하루 현금차감 ${won(DAILY_OUT)}원의 ${pct(w, DAILY_OUT)}` +
                ` · 하루 살림 ${won(NEED)}원의 ${pct(w, NEED)}`);
  }
  const B = full['C0/1'];
  console.log(`  전체 판 — 명목 전기세 ${won(B.medPowerNominal)}원 · ★실제로 낸 것 ${won(B.medPowerPaid)}원 ` +
              `(0원 clamp 가 ${B.medPowerNominal ? (100 - B.medPowerPaid / B.medPowerNominal * 100).toFixed(0) : 0}% 를 삼켰다)`);
}
console.log('');

/* ── §8 ★역산 — 「유지」가 되려면 무엇이 얼마여야 하나 ───────────────────── */
console.log('');
console.log('── §8 ★역산 — 「채소로 월세+식대 유지」에 필요한 값 ─────────────────');
console.log('  한 번에 다 물을 주면 5일마다 N개를 한꺼번에 거둔다. 그때 하루 벌이는');
console.log('    [ 곳간 6,000 + (N−3) × 회전분 × 판매가율 − N × 씨앗값 ] ÷ 5');
console.log(`  이 값이 ${won(NEED)}원이 되어야 「유지」다. 필요한 시루 수를 역산한다.`);
console.log('');
console.log('| 회전분 | 씨앗값 | 판매가율 | 필요 시루 | 자리가 되나 |');
console.log('|--------|--------|----------|-----------|-------------|');
{
  const SLOTS = (BASE_PROFILE.slots || []).length;
  for (const [full, seed] of [[3000, 700], [3000, 300], [6000, 700], [10000, 700]]) {
    for (const rate of [0.70, 0.85, 0.99]) {
      const per = full * rate - seed;                 // 시루 하나가 5일에 내는 순현금
      const need = per > 0 ? Math.ceil((NEED * 5 - 6000 + 3 * full * rate) / per) : null;
      console.log(`| ${(won(full) + '원').padStart(6)} | ${(won(seed) + '원').padStart(6)} | ` +
        `${((rate * 100).toFixed(0) + '%').padStart(8)} | ${(need ? need + '개' : '★불가').padStart(9)} | ` +
        `${need && need <= SLOTS ? '○ 방 자리 ' + SLOTS + '칸 안' : '✕ 방 자리는 ' + SLOTS + '칸뿐'} |`);
    }
  }
  console.log('');
  console.log(`  ⚠ 반지하 자리는 ${SLOTS}칸이다(room_profile.banjiha §slots). 몬스테라·가구가 그중 몇을 쓴다.`);
  console.log('  ⇒ ★「월세+식대 유지」를 그대로 두면 어느 조합도 방에 안 들어간다.');
  console.log('    목표를 **식대만**(하루 ' + won(RULES.dailyFoodWon) + '원)으로 낮추면 어떻게 되는지도 같이 낸다:');
  console.log('');
  console.log('| 목표 | 회전분 | 판매가율 | 필요 시루 |');
  console.log('|------|--------|----------|-----------|');
  for (const [ko, target] of [['식대만 ' + won(RULES.dailyFoodWon), RULES.dailyFoodWon],
                              ['하루 현금차감 ' + won(DAILY_OUT), DAILY_OUT],
                              ['월세+식대 ' + won(NEED), NEED]]) {
    for (const rate of [0.70, 0.85]) {
      const per = 3000 * rate - 700;
      const need = Math.ceil((target * 5 - 6000 + 3 * 3000 * rate) / per);
      console.log(`| ${ko.padEnd(16)} | 3,000원 | ${((rate * 100).toFixed(0) + '%').padStart(8)} | ${(need + '개').padStart(9)} |`);
    }
  }
}
console.log('');
console.log('  ★ 왜 끼니 상한을 올려도 아무 일이 없었나(§4 C2·C4) —');
console.log(`    곳간 상한은 min(한 회전분 합계 ${won(RULES.cropSavedWonPerCycle)}, 끼니상한) 이다.`);
console.log('    지금 **이기고 있는 것은 끼니 상한이 아니라 「한 회전분 합계」**이고,');
console.log('    그 값은 first_play.js 의 cropKindSavedWon [3,000 · 2,000 · 1,000] 이 정한다.');
console.log('    ⇒ 그 표는 data/balance 에 없다. **거기부터 옮겨야 손잡이가 생긴다.**');


/* ── §9 ★★ 기울기 손잡이 — 무엇을 얼마로 올리면 몇 칸에 닿나 ─────────────── */
console.log('');
console.log('── §9 ★★ 기울기 손잡이 — 박사님이 고르실 재료 ──────────────────────');
console.log('  §2 가 보였듯 **천장은 없다. 기울기가 완만할 뿐이다**(지금 261원/시루/일).');
console.log('  그러면 처방은 「상한을 푼다」가 아니라 **「기울기를 올린다」** 다. 손잡이는 셋이다.');
console.log('');
console.log(`  ⚠⚠ **시루 N개 = 방 자리 N칸이다.** 시루를 「무리」에서 「하나하나」로 바꾸는 작업이`);
console.log(`     끝나면 시루 하나가 한 칸을 먹는다. 반지하는 **${(BASE_PROFILE.slots || []).length}칸**이고`);
console.log('     그중 몬스테라·가구가 몇을 쓴다. 아래 「필요 칸」은 그 안에 들어와야 답이다.');
console.log('');

const SLOTS = (BASE_PROFILE.slots || []).length;
const T_FOOD = RULES.dailyFoodWon;                 // 식대만 유지
const T_ALL = NEED;                                // 월세+식대 유지

/* 손잡이 하나를 꽂고 **기울기를 실측한다** — 시루 10개와 30개를 굴려 그 차를 잰다.
   ★ 두 점 다 「0원이라 씨앗을 못 사는」 구간 밖이라(§2 0원날 참고) 기울기가 깨끗하다. */
function slopeOf(fp) {
  const lo = route({ sirus: 10, propagate: false, days: 400, tutorialDays: TDAYS,
                     buyLamp: false, waterAll: true, fpRules: fp });
  const hi = route({ sirus: 30, propagate: false, days: 400, tutorialDays: TDAYS,
                     buyLamp: false, waterAll: true, fpRules: fp });
  const g = r => (r.medFood + r.medSurplus - r.medSeed - r.medSiruSpend) / TDAYS;
  const slope = (g(hi) - g(lo)) / 20;
  return { slope, gainAt10: g(lo) };
}
const needSirus = (s, target) => s.slope > 0 ? Math.ceil(10 + (target - s.gainAt10) / s.slope) : null;
const fits = n => n != null && n <= SLOTS;
const cell = n => n == null ? '★불가' : `${n}칸${fits(n) ? ' ○' : ' ✕'}`;

function leverRow(ko, fp, believable) {
  const s = slopeOf(fp);
  const a = needSirus(s, T_FOOD), b = needSirus(s, T_ALL);
  console.log(`| ${ko.padEnd(24)} | ${(won(s.slope) + '원').padStart(9)} | ${cell(a).padStart(8)} | ` +
    `${cell(b).padStart(8)} | ${believable} |`);
  return { ko, slope: s.slope, food: a, all: b };
}

/* ══ 손잡이 ㉠ 회전분 — 한 시루가 한 회전에 내는 값 ═══════════════════════ */
console.log('  ── ㉠ 회전분 (`cropKindSavedWon` 의 첫 값) ─────────────────────────');
console.log('| 회전분 | 기울기 | 식대만 7,500 | 월세+식대 20,000 | 현실감 |');
console.log('|--------|--------|--------------|------------------|--------|');
for (const [full, believable] of [
  [3_000,  '○ 지금. 콩나물 한 봉지 1,500~2,000원 × 두 봉지쯤'],
  [4_500,  '○ 세 봉지쯤. 시루가 크다고 하면 된다'],
  [6_000,  '△ 네 봉지. **여기가 위끝**이다'],
  [10_000, '✕ 한 시루에 여섯 봉지 — **안 믿긴다**'],
  [16_500, '✕✕ 열 봉지. 콩나물이 아니라 다른 물건이다']
]) leverRow(`${won(full)}원`, fpRulesFor({ fullWon: full }), believable);

/* ══ 손잡이 ㉡ 잉여 판매가율 ═══════════════════════════════════════════ */
console.log('');
console.log('  ── ㉡ 잉여 판매가율 (`cropSurplusSaleRate`) ────────────────────────');
console.log('| 판매가율 | 기울기 | 식대만 7,500 | 월세+식대 20,000 | 현실감 |');
console.log('|----------|--------|--------------|------------------|--------|');
for (const [rate, believable] of [
  [0.50, '○ 떨이. 손익분기 23.3% 위'],
  [0.70, '○ 지금'],
  [0.85, '○ 「씨앗값보다는 살짝 이득」의 위끝'],
  [0.99, '△ 제값에 가깝다. 떨이라는 말이 무색해진다'],
  [1.50, '✕✕ **밥으로 먹는 것보다 파는 게 낫다 — 뼈대가 뒤집힌다**']
]) leverRow(`${(rate * 100).toFixed(0)}%`, fpRulesFor({ rate }), believable);

/* ══ 손잡이 ㉢ 수확 주기 — ⚠ 유도값이다 ════════════════════════════════ */
console.log('');
console.log('  ── ㉢ 수확 주기 (`CROP_KINDS[0].harvestDays`, 지금 5일) ─────────────');
console.log('  ⚠ **이것만 실측이 아니라 유도값이다.** 주기는 `CROP_KINDS` 에 얼어 있어');
console.log('     규칙 사본으로 못 바꾼다(first_play.js:547 이 그 표에서 직접 읽는다).');
console.log('     회전이 C일마다 돌면 처리량이 5/C 배가 되므로 기울기도 그 배다 — 그 셈이다.');
console.log('| 주기 | 기울기(유도) | 식대만 7,500 | 월세+식대 20,000 | 현실감 |');
console.log('|------|--------------|--------------|------------------|--------|');
{
  const base = slopeOf(fpRulesFor({}));
  for (const [c, believable] of [
    [7, '○ 무순이 그렇다'],
    [5, '○ 지금. 콩나물 실제가 4~7일'],
    [4, '○ 따뜻하게 키우면'],
    [3, '△ 실제 콩나물의 아래끝'],
    [2, '✕ **안 믿긴다**']
  ]) {
    const k = 5 / c;
    const s = { slope: base.slope * k, gainAt10: base.gainAt10 * k };
    const a = needSirus(s, T_FOOD), b = needSirus(s, T_ALL);
    console.log(`| ${(c + '일').padStart(4)} | ${(won(s.slope) + '원').padStart(12)} | ${cell(a).padStart(8)} | ` +
      `${cell(b).padStart(8)} | ${believable} |`);
  }
}

/* ══ 손잡이를 같이 올리면 — ★현실감 안에 남는 길 ═══════════════════════ */
console.log('');
console.log('  ── ㉣ 둘을 같이 올리면 (현실감 ○ 인 값만 섞었다) ───────────────────');
console.log('| 조합 | 기울기 | 식대만 7,500 | 월세+식대 20,000 | 현실감 |');
console.log('|------|--------|--------------|------------------|--------|');
for (const [ko, opt, believable] of [
  ['회전분 4,500 + 85%',  { fullWon: 4_500, rate: 0.85 }, '○ 둘 다 위끝 안'],
  ['회전분 6,000 + 85%',  { fullWon: 6_000, rate: 0.85 }, '△ 회전분이 위끝'],
  ['회전분 6,000 + 99%',  { fullWon: 6_000, rate: 0.99 }, '△ 떨이가 제값이 된다'],
  ['회전분 4,500 + 3종',  { fullWon: 4_500, capMeals: 4 }, '○ 끼니 상한을 같이 푼 것']
]) leverRow(ko, fpRulesFor(opt), believable);

console.log('');
console.log(`  ★ 읽는 법 — ○ 는 반지하 ${SLOTS}칸 안에 들어온다는 뜻이고 ✕ 는 방을 넘는다는 뜻이다.`);
console.log('  ★ 손잡이는 **곱해진다.** 회전분 4,500원 + 판매가율 85% 처럼 둘을 같이 올리면');
console.log('    각각을 크게 올리지 않고도 닿는다 — 현실감이 깨지는 후보를 안 쓰는 길이 거기 있다.');
console.log('  ⚠ 「월세+식대 유지」는 어느 손잡이도 **혼자서는 현실감 안에서 못 닿는다.**');
console.log('    「식대만 유지」는 여러 후보가 방 안에 들어온다.');

console.log(`(${((Date.now() - T0) / 1000).toFixed(0)}초 · 표본 ${SEED_N}판)`);
