/* ★★ 「세 층」을 다 켜고 경제를 잰다 — 채소 · 몬스테라 증식 · 가구(선반)
 *
 *   node tools/probe_three_layers.mjs                 (표 전부 · 400일)
 *   node tools/probe_three_layers.mjs --only A        (§A 만)
 *   node tools/probe_three_layers.mjs --only F        (§F 채소만 어거지 이사)
 *
 * ══ 왜 이 도구가 따로 있나 ═══════════════════════════════════════════════════
 * `probe_stamina_plan.mjs` 는 **채소 한 층만** 켜고 쟀다(econ-to-plan §7.11). 그 표는
 * 「돈이 무너진다」로 끝나는데, 월세를 낼 층(몬스테라)이 꺼져 있었으니 당연한 결과다.
 * 여기서는 **세 층을 다 켜고** 잰다. 그리고 이 판의 진짜 다툼을 잰다 —
 *
 *   ★★ **자르기(cut)·분갈이(repot)도 체력을 쓴다**(stamina.ACT_COST 각 1).
 *      ⇒ 증식을 하면 채소에 쓸 손이 줄어든다. 「오늘 손 다섯을 콩나물에 쓸까 삽수에 쓸까」가
 *        이 게임의 선택이고, 지금까지 잰 어떤 표에도 그 다툼이 없었다.
 *
 * 배분 정책 셋:
 *   ㉮ 채소 우선 — 채소가 체력을 다 쓰도록 시루를 늘리고, 남는 손으로만 증식
 *   ㉯ 증식 우선 — 증식이 먼저 손을 가져가고, 남는 몫에 맞춰 시루를 놓는다
 *   ㉰ 반반     — 체력의 절반까지만 채소에 쓰도록 시루를 놓고, 나머지 절반을 증식에
 *
 * ══ 체력 규칙 (박사님 확정 · probe_stamina_plan 과 같다) ═════════════════════
 *   시작 최대체력 5 · 물/수확/심기 **시루마다 1** · 자르기 1 · 분갈이 1 · 모주 물주기 1
 *   경험치 = 그날 쓴 체력의 총량 · 5→10 은 ⓒ 완만(10·15·20·25·30) · 10→20 은 ⓧ 최대체력×10
 *   퀘스트 「시루 5개 분배로 5주기 완주」 → +1 · 시루 눈금 `3 × ceil(N/5) ≤ 배정된 체력`
 *
 * ══ ★★ 코드를 한 글자도 안 고친다 ═══════════════════════════════════════════
 *   엔진 체력은 막지 않게 풀어 두고 확정 규칙의 예산을 프로브가 직접 셈한다.
 *   밸런스 값은 하나도 안 바꾼다 — 후보값은 **규칙 사본**으로 꽂는다(저장소 값은 그대로).
 *
 * ══ ⚠⚠ 이 하네스가 한 번 크게 틀렸던 자리 — 다음 사람을 위해 ═══════════════
 *   ① **모주가 가뭄으로 멈춰 있었다.** 마름을 직접 셌더니(`wateredOnDay == null`) 한 번 준
 *      뒤로 영영 「촉촉함」이 되어, 400일을 돌려도 유효 생장일이 53일에 얼어붙었다. 마디가
 *      안 늘어 자를 것이 없었고, 하마터면 「증식은 돈이 안 된다」로 갈 뻔했다.
 *      ⇒ `state.potWaterStatus(S, {band, season})` 를 그대로 쓴다.
 *   ② **반지하에서는 등이 없으면 몬스테라가 아예 안 자란다** — 창가 7일평균 DLI 1.52 로
 *      최소 3 에 못 미친다. 등을 켜면 3.36 이 된다. 증식 층의 스위치는 **식물등**이고
 *      등은 `lampUnlockSeason = 가을`에 열린다.
 */
import assert from 'node:assert';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProfileLight } from '../src/game/room_profile.js';
import { newState, pot0, setPotSlot, resowCrop, waterCrop, waterPot, potWaterStatus,
         sellCropSurplus, givePlant, ARRIVAL } from '../src/game/state.js';
import { nextDay, harvestCrop } from '../src/game/loop.js';
import { firstPlayRulesFromBalance, placeBeansprout, placeCrop, moveMonstera, cropPotList,
         cropSiteOf, CROP_KINDS } from '../src/game/first_play.js';
import { TUTORIAL_RULES, dailyCashOutWon, yearDay0Of, varieView, buyLamp,
         sellableWonOf } from '../src/game/tutorial.js';
import { orderItem, stockOf, incomingOf, buyPriceOf, sellCutting,
         SELLABLE_CUTTING_STATUS } from '../src/game/shop.js';
import { takeCutting, cuttableNow, cutBudgetOf, motherStatsNow,
         repotCutting } from '../src/game/propagation.js';

const T0 = Date.now();
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const J = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url), 'utf8'));
const argv = process.argv.slice(2);
const argOf = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const ONLY = argOf('--only', null);
const DAYS = Number(argOf('--days', 400));

const BASE_PROFILE = J('../data/profiles/room_profile.banjiha.json');
const LIGHT_TH = J('../data/balance/light_thresholds.json');
const WEATHER_BAL = J('../data/balance/weather.json');
const CHARS = J('../data/balance/characters.json');
const RULES = firstPlayRulesFromBalance(CHARS);
const DARK = 'banjiha-dresser:1';     // 콩나물 — 어두워야 하얗고 아삭
const SILL = 'banjiha-sill:0';        // 몬스테라 — 반지하에서 제일 밝은 자리
const DESK = 'banjiha-desk:0';        // 무순 — 빛 요구가 콩나물과 정반대다
const CYCLE_DAYS = 5;

const REAL = TUTORIAL_RULES;                       // ★ 계절도 정본(여름 45일차)
const DAILY_OUT = dailyCashOutWon({ rules: REAL, movedOut: false });
const MOVE_OUT_WON = REAL.moveOutCostWon;
const RENT_PER_DAY = REAL.rentWon / REAL.rentPeriodDays;
const FOOD_PER_DAY = RULES.dailyFoodWon;
const UTIL_PER_DAY = REAL.dailySpendWon - FOOD_PER_DAY - RENT_PER_DAY;   // 공과금
const RENT_UTIL_PER_DAY = REAL.dailySpendWon - FOOD_PER_DAY;

/* ══ 헤드리스 생장 엔진 (probe_stamina_plan.mjs 와 같은 하네스) ══════════════ */
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
    bandOf: (dli, v) => G.bandOf(dli, v),
    cuttableNodes: () => G.cuttableNodes(), leafStats: () => G.leafStats()
  };
}

/* ══ 증식 — probe_econ.mjs 의 viewOf/pickNode 를 그대로 가져왔다 ═════════════ */
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

/* ══ 규칙 사본 — **저장소 값은 안 고친다** ═════════════════════════════════
   회전분·판매가율은 `first_play` 규칙, 공과금은 튜토 규칙에 있다. 후보값은 사본으로 꽂는다.
   ⚠ 회전분을 올려도 **하루 곳간 인출 상한은 안 오른다**(§0 참고) — 초과분은 잉여로 샌다.
     그래서 여기서는 `dailyCropSaveWon` 을 원식 그대로 다시 셈해 준다:
       min(도는 종류의 회전분 합, 끼니 상한). 끼니 상한(5,000원)은 안 건드린다. */
function vegRules({ cycleWon = null, saleRate = null } = {}) {
  const base = RULES;
  const table = cycleWon == null ? base.cropKindSavedWon
    : Object.freeze([cycleWon, Math.round(cycleWon * 2 / 3), Math.round(cycleWon / 3)]);
  const perCycle = table.slice(0, base.cropKinds).reduce((a, b) => a + b, 0);
  return Object.freeze({
    ...base,
    cropKindSavedWon: table,
    cropSavedWonPerCycle: perCycle,
    dailyCropSaveWon: Math.min(perCycle, base.cropMealCapWon),
    cropCapBinding: perCycle > base.cropMealCapWon,
    cropSurplusSaleRate: saleRate == null ? base.cropSurplusSaleRate : saleRate
  });
}
/* 공과금만 내린다 — **월세는 안 건드린다**(이 게임의 압박 축이다) */
function homeRules({ utilWon = UTIL_PER_DAY } = {}) {
  return Object.freeze({ ...REAL,
    dailySpendWon: FOOD_PER_DAY + RENT_PER_DAY + utilWon });
}

/* ══ 확정 규칙의 예산 ══════════════════════════════════════════════════════ */
const START_MAX = 5, QUEST_BONUS = 1;
const CURVE_LOW = [10, 15, 20, 25, 30];          // ⓒ 완만 (5→10) — §7.11 에서 간격이 가장 고르다
/* ★★ 2026-08-09 박사님 — *"체력도 상한이 없이 계속 ×10 쓰면 1씩 오른다 치고"*
   ⇒ **상한 20을 없앴다.** 10 위로는 `현재 최대체력 × 10` 경험치마다 +1 이고 끝이 없다.
   ⇒ 그래서 「체력 21이 필요한데 상한 20이라 시루 31개가 구조적으로 불가」는 **없던 문제**가 된다.
     진짜 상한이 체력에서 **자리**로 옮겨간다. */
const QUEST_SIRUS = 5, QUEST_CYCLES = 5;

function levelOf(xp) {
  let lv = START_MAX, need = 0;
  for (const step of CURVE_LOW) { need += step; if (xp >= need) lv++; else return lv; }
  for (;;) { need += lv * 10; if (xp >= need) lv++; else return lv; }
}
function maxOf(sim) { return levelOf(sim.xp) + (sim.quest ? QUEST_BONUS : 0); }
/* ★ 자리 한도 — 반지하 바닥에 놓을 수 있는 칸 수. 체력 상한이 없어지면서 **여기가 진짜 상한**이다.
   ⚠ 이 값은 이 프로브의 가정이다(방 구조는 house 소유). `--slots` 로 바꿔 잰다. */
const SLOT_CAP = Number(argOf('--slots', 178));
function siruForStamina(share, limit = SLOT_CAP) {
  let best = 0;
  for (let n = 1; n <= limit; n++) if (3 * Math.ceil(n / CYCLE_DAYS) <= share) best = n;
  return best;
}

/* ══ 배분 정책 ═════════════════════════════════════════════════════════════
   `vegShareOf(max)` = 채소가 쓸 수 있다고 보고 **시루 목표를 정하는** 체력.
   `order` = 그날 누가 먼저 손을 가져가나. 남은 손은 반대쪽이 이어 쓴다(손을 버리지 않는다).
   ⚠ ㉯ 의 −2 는 「모주 물주기 1 + 자르기 1」이다 — 증식이 하루에 실제로 쓰는 손의 상한이고
     지어낸 값이 아니라 아래 doProp 이 부르는 동작 수다. */
const POLICIES = [
  { id: '㉮', ko: '채소 우선', order: 'veg',  vegShareOf: m => m },
  { id: '㉯', ko: '증식 우선', order: 'prop', vegShareOf: m => Math.max(0, m - 2) },
  { id: '㉰', ko: '반반',      order: 'veg',  vegShareOf: m => Math.ceil(m / 2) }
];
const VEGONLY = { id: '—', ko: '채소만', order: 'veg', vegShareOf: m => m };

/* ══ 한 판 ════════════════════════════════════════════════════════════════ */
function play(pol, { days = DAYS, veg = true, prop = true, seed = 1, jarCap = 24, lamps = 1,
                     rules = REAL, fpRules = RULES, siruFixed = null, musun = 0,
                     staminaFree = false } = {}) {
  let lampDay = null, lastBand = null, lastSeason = null;
  const light = createProfileLight(structuredClone(BASE_PROFILE),
    { lightTh: LIGHT_TH, weatherBalance: WEATHER_BAL });
  const io = { light, growth: standGrowth(seed) };
  const S = newState({ mode: 'real', room: 'banjiha', firstPlay: true, firstPlayRules: fpRules,
                       yearDay0: yearDay0Of(rules), seed });
  const ts = S.tutorial;
  ts.rules = rules;
  S.firstPlay.completed = true;
  placeBeansprout(S.firstPlay, DARK, { slots: light.room.slots });
  try { givePlant(S, io, {}); } catch {}
  try { if (pot0(S)) setPotSlot(S, pot0(S), SILL, light.room.slots); } catch {}
  try { moveMonstera(S.firstPlay, SILL, { slots: light.room.slots }); } catch {}

  const sim = { xp: 0, quest: false, left: START_MAX };
  const rows = [], ups = [];
  let prevMax = START_MAX;
  let died = 0, cuts = 0, sold = 0, cutCash = 0, repots = 0;
  let jarSpend = 0, potSpend = 0, siruSpend = 0, seedSpend = 0, surplusCash = 0, lampSpend = 0;
  let minCash = Infinity, minCashDay = null, brokeDay = null, assetMoveDay = null, cashMoveDay = null;

  for (let d = 1; d <= days; d++) {
    const bs = cropSiteOf(S.firstPlay, 'beansprout');
    /* ★ 무순이 있으면 손을 나눠 쓴다 — 배정된 체력에서 무순 몫을 먼저 뺀다 */
    const share = pol.vegShareOf(maxOf(sim));
    const musunN = veg ? musun : 0;
    const target = !veg ? 0
      : (siruFixed != null ? siruFixed
         : Math.max(0, siruForStamina(Math.max(0, share - 3 * Math.ceil(musunN / 7)))));
    const have = (bs.pots || []).length + stockOf(S, 'siru') + incomingOf(S, 'siru');
    if (have < target) { try { const o = orderItem(S, 'siru', target - have); siruSpend += o.totalWon; } catch {} }
    const needSeed = target - stockOf(S, 'bean_seed') - incomingOf(S, 'bean_seed');
    if (needSeed > 0) { try { const o = orderItem(S, 'bean_seed', needSeed); seedSpend += o.totalWon; } catch {} }
    if (musunN) {
      const ms = cropSiteOf(S.firstPlay, 'musun');
      const haveT = ((ms && ms.pots) || []).length + stockOf(S, 'sprout_tray') + incomingOf(S, 'sprout_tray');
      if (haveT < musunN) { try { const o = orderItem(S, 'sprout_tray', musunN - haveT); siruSpend += o.totalWon; } catch {} }
      const nd = musunN - stockOf(S, 'radish_seed') - incomingOf(S, 'radish_seed');
      if (nd > 0) { try { const o = orderItem(S, 'radish_seed', nd); seedSpend += o.totalWon; } catch {} }
    }
    if (prop) {
      const want = Math.min(jarCap, (S.cuttings || []).length + 2);
      const has = stockOf(S, 'jar') + incomingOf(S, 'jar') + (S.cuttings || []).length;
      if (has < want) { try { const o = orderItem(S, 'jar', want - has); jarSpend += o.totalWon; } catch {} }
    }

    const turn = nextDay(S, io).turn;
    const t = turn && turn.tutorial;
    lastBand = (turn && turn.growthSpeed && turn.growthSpeed.band) || null;
    lastSeason = (turn && turn.sky && turn.sky.season) || null;
    if (turn && turn.cuttings && turn.cuttings.died) died += turn.cuttings.died.length;
    /* ⚠ 엔진 체력은 막지 않게 풀어 둔다 — 확정 규칙은 아래 sim 이 센다(머리말 참고) */
    if (S.stamina) { S.stamina.max = 999; S.stamina.left = 999; }
    /* ★ 식물등 — **증식 층의 스위치다**. 정본대로 가을에 열리고 25,000원이다 */
    if (prop && lamps && ts.lamp.unlocked && ts.lamp.owned < lamps &&
        ts.cashWon >= ts.rules.lampPriceWon) {
      try { const b = ts.cashWon; buyLamp(ts); lampSpend += b - ts.cashWon;
            S.lamps.count = ts.lamp.owned; light.clearCache();
            if (lampDay == null) lampDay = ts.day; } catch {}
    }

    const max = staminaFree ? 9999 : maxOf(sim);
    if (max > prevMax) ups.push({ levelUpAt: t ? t.day : d, from: prevMax, to: max });
    sim.left = max;
    prevMax = max;

    let blocked = 0;
    const spend = (cap) => {
      if (cap != null && cap <= 0) return false;
      return sim.left >= 1 ? (sim.left--, sim.xp++, true) : (blocked++, false);
    };
    let didH = 0, didS = 0, didW = 0, didP = 0, didG = 0, didC = 0, didR = 0;

    /* ── 채소 한 층 ───────────────────────────────────────────────────── */
    const doVeg = (cap) => {
      if (!veg || cap <= 0) return 0;
      let used = 0;
      for (const p of cropPotList(S.firstPlay, S.day).filter(x => x.ready)) {
        if (used >= cap || !spend(cap - used)) break;
        used++;
        try { harvestCrop(S, io, { potIds: [p.id] }); didH++; } catch { sim.left++; sim.xp--; used--; }
      }
      /* ★ 잉여는 손이 안 든다(파는 것은 상점 일이다) */
      try { const r = sellCropSurplus(S); if (r && r.won > 0) surplusCash += r.won; } catch {}
      /* ★★ `at` 을 안 넘긴다 — `potIds` 는 이미 놓인 시루라 자리를 다시 줄 이유가 없고,
         넘기면 「이미 수확한 시루는 옮길 수 없습니다」로 던진다(§7.9 의 그 함정). */
      for (const p of cropPotList(S.firstPlay, S.day).filter(x => x.needsResow)) {
        if (used >= cap || !spend(cap - used)) break;
        used++;
        try { resowCrop(S, { kind: p.kind, potIds: [p.id],
                             slots: light.room.slots, size: light.room.size }); didS++; }
        catch { sim.left++; sim.xp--; used--; }
      }
      /* ★ 새 시루·판을 놓는 것도 「심기」다 — 하나에 한 손 */
      for (const [kindId, tgt, at, item] of
           [['beansprout', target, DARK, 'siru'], ['musun', musunN, DESK, 'sprout_tray']]) {
        if (!tgt) continue;
        for (let g = 0; g < tgt; g++) {
          const site = cropSiteOf(S.firstPlay, kindId);
          const now = ((site && site.pots) || []).length;
          if (now >= tgt || stockOf(S, item) < 1) break;
          if (used >= cap || !spend(cap - used)) break;
          used++;
          try { resowCrop(S, { kind: kindId, sirus: now + 1, at, slots: light.room.slots }); didG++; }
          catch { sim.left++; sim.xp--; used--; break; }
        }
      }
      /* 분배 — 하루 ceil(목표/주기) 개만 물을 준다(§7.7 의 「흩기」) */
      const waterCap = Math.ceil(target / CYCLE_DAYS) + (musunN ? Math.ceil(musunN / 7) : 0);
      for (const p of cropPotList(S.firstPlay, S.day).filter(x => x.needsWater).slice(0, waterCap)) {
        if (used >= cap || !spend(cap - used)) break;
        used++;
        try { waterCrop(S, { kind: p.kind, potIds: [p.id] }); didW++; } catch { sim.left++; sim.xp--; used--; }
      }
      return used;
    };

    /* ── 증식 한 층 ───────────────────────────────────────────────────── */
    const doProp = (cap) => {
      if (!prop || !pot0(S) || cap <= 0) return 0;
      let used = 0;
      /* ★ 모주에 물 주기 — **증식 층의 손이다.** 안 주면 생장이 가뭄으로 멈추고 마디가
         영영 안 늘어 증식 자체가 안 열린다(머리말 ①). 판정은 정본 함수를 그대로 쓴다. */
      const ws = potWaterStatus(S, { band: lastBand, season: lastSeason });
      if (ws && ws.canWater && used < cap && spend(cap - used)) { used++;
        try { waterPot(S); didP++; } catch { sim.left++; sim.xp--; used--; } }
      /* ★ 분갈이 — 혹이 난 삽수는 기한 안에 흙으로 옮겨야 산다. 아래 판매가 12일째에
         데려가므로 보통 여기 걸리는 것이 없지만, 남으면 반드시 옮긴다(안 하면 죽는다). */
      for (const c of [...(S.cuttings || [])]) {
        if (c.status !== 'node') continue;
        if (stockOf(S, 'pot') < 1) { try { const o = orderItem(S, 'pot', 1); potSpend += o.totalWon; } catch {} break; }
        if (used >= cap || !spend(cap - used)) break;
        used++;
        try { repotCutting(S, c); didR++; repots++; } catch { sim.left++; sim.xp--; used--; }
      }
      for (let k = 0; k < 8; k++) {
        if (stockOf(S, 'jar') < 1) break;
        const v = viewOf(S, io);
        const node = pickNode(v.nodes, v.budget);
        if (!node) break;
        if (used >= cap || !spend(cap - used)) break;
        used++;
        try { takeCutting(S, { nodes: v.nodes, nodeId: node.nodeId, container: 'jar' }); didC++; cuts++; }
        catch { sim.left++; sim.xp--; used--; break; }
      }
      return used;
    };

    if (pol.order === 'veg') { doVeg(pol.vegShareOf(max)); doProp(sim.left); doVeg(sim.left); }
    else                     { doProp(max);                doVeg(sim.left); }

    /* ── 판매 — 손이 안 든다 ────────────────────────────────────────────── */
    for (const c of [...(S.cuttings || [])]) {
      if (!SELLABLE_CUTTING_STATUS.includes(c.status)) continue;
      try { const r = sellCutting(S, c.id); cutCash += r.won; sold++; } catch {}
    }

    if (!sim.quest) {
      const bp = cropPotList(S.firstPlay, S.day).filter(p => p.kind === 'beansprout');
      if (bp.length >= QUEST_SIRUS && bp.every(p => (p.cycle || 1) > QUEST_CYCLES)) sim.quest = true;
    }

    let asset = ts.cashWon;
    try { asset = sellableWonOf(S, { nodes: io.growth.cuttableNodes(), stats: io.growth.leafStats() }); }
    catch {}
    const day = t ? t.day : d;
    if (ts.cashWon < minCash) { minCash = ts.cashWon; minCashDay = day; }
    if (brokeDay == null && ts.bankrupt) brokeDay = day;
    if (cashMoveDay == null && ts.cashWon >= rules.moveOutCostWon) cashMoveDay = day;
    if (assetMoveDay == null && asset >= rules.moveOutCostWon) assetMoveDay = day;

    rows.push({
      day, max, used: max - sim.left, xp: sim.xp,
      didH, didS, didW, didP, didG, didC, didR, missed: blocked,
      nSiru: ((bs.pots) || []).length, target, nCut: (S.cuttings || []).length,
      savedWon: (t && t.savedWon) || 0, cashWon: ts.cashWon, asset, bankrupt: !!ts.bankrupt,
      cutCash, sold, died, surplusCash
    });
  }
  const last = rows[rows.length - 1];
  return { pol, rows, ups, died, cuts, sold, cutCash, repots, lampDay,
           jarSpend, potSpend, siruSpend, seedSpend, surplusCash, lampSpend,
           minCash, minCashDay, brokeDay, assetMoveDay, cashMoveDay,
           endCash: last.cashWon, endMax: last.max, endSiru: last.nSiru,
           maxSiru: Math.max(...rows.map(r => r.nSiru)),
           savedWon: rows.reduce((a, r) => a + r.savedWon, 0),
           brokeDays: rows.filter(r => r.bankrupt).length };
}

const won = v => v == null ? '—' : Math.round(v).toLocaleString();
const atLv = (run, n) => { const u = run.ups.find(u => u.to === n); return u ? u.levelUpAt : null; };

/* ══════════════════════════════════════════════════════════════════════════ */
console.log('══ 「세 층」을 다 켜고 잰다 (probe_three_layers) ════════════════════');
console.log('');
console.log('┌ §0 ★★ 하루 곳간 상한의 정체 — **코드에서 읽은 것** ────────────────');
console.log('│ 정하는 함수  first_play.dailyCropSaveWonOf(fp) → rules.dailyCropSaveWon');
console.log('│ 식          min(cropSavedWonPerCycle, cropMealCapPerPerson × mealWon)');
console.log(`│             = min(${won(RULES.cropSavedWonPerCycle)}, ${won(RULES.cropMealCapWon)}) = **${won(RULES.dailyCropSaveWon)}원**`);
console.log(`│ ★ cropSavedWonPerCycle 은 **CROP_KINDS 표에 정의된 종류 수**(${RULES.cropKinds}종)로 셈한다 —`);
console.log('│   실제로 심은 작물이 아니다. 그래서 **콩나물만 심어도 5,000원이다.**');
console.log(`│ ★ 끼니 상한 = ${CHARS._meta.cropMealCapPerPerson}끼 × ${won(RULES.mealWon)}원 = ${won(RULES.cropMealCapWon)}원.`);
console.log(`│   둘이 정확히 같아서 지금은 어느 쪽도 안 이긴다(cropCapBinding = ${RULES.cropCapBinding}).`);
console.log('│ ⇒ **무순은 하루 천장을 안 올린다.** 이미 5,000원으로 서 있다.');
console.log('│ ⇒ 콩나물만으로 하루 5,000원에 닿으려면 **하루 두 번 거둬야** 한다(3,000+2,000).');
console.log('│   5일 주기이므로 **시루 10개**다. 시루 5개는 하루 3,000원까지다. (§E 가 실측한다)');
console.log('└────────────────────────────────────────────────────────────────');
console.log('');
console.log('┌ ★★ 무엇을 켜고 무엇을 껐나 — §A~§C ────────────────────────────────');
console.log('│ 생존 · 콩나물 시루        **켬** (분배 — 하루 ceil(N/5)개만 물을 준다)');
console.log('│ 생존 · 무순(2종째)        **끔**');
console.log('│ 성장 · 몬스테라 물주기    **켬** ← 증식 층의 손. 안 주면 생장이 가뭄으로 멈춘다');
console.log('│ 성장 · 식물등 1개         **켬** ← 정본 해금(가을) · 25,000원. 없으면 증식이 안 열린다');
console.log('│ 성장 · 삽수 자르기·판매   **켬** (유리 수경병 · 물꽂이 · 뿌리내린 12일째에 판다)');
console.log('│ 성장 · 삽수 분갈이        **켬** (혹이 나면 옮긴다 — 죽지 않게)');
console.log('│ 성장 · 모주(화분) 판매    **끔** ← 팔면 증식 엔진이 끝난다. 이사 자금은 「자산」으로 센다');
console.log('│ 투자 · 가구(선반)         **끔** ← 코드에 없다. §D 에서 거꾸로 잰다');
console.log(`│ 계절 — **정본(${REAL.startSeason} ${REAL.startSeasonDay}일차)**. §7.9~7.11 의 봄 사본이 아니다`);
console.log(`│ 살림 — 시작 ${won(REAL.startCashWon)}원 · 하루 ${won(REAL.dailySpendWon)}원 ` +
            `(식대 ${won(FOOD_PER_DAY)} + 월세 ${won(RENT_PER_DAY)} + 공과금 ${won(UTIL_PER_DAY)})`);
console.log(`│ ★ 이사 자금 = rules.moveOutCostWon = **${won(MOVE_OUT_WON)}원** (313만원이 아니다)`);
console.log('│ ★★ **최대체력 상한 없음** (2026-08-09 박사님) — 10 위로는 「최대체력×10」마다 +1, 끝이 없다');
console.log(`│ ★ 자리 한도 = ${SLOT_CAP}칸 (프로브 가정 · --slots 로 바꾼다). 체력 상한이 없어지면 **여기가 상한**이다`);
console.log(`│ ${DAYS}일 · 반지하`);
console.log('└────────────────────────────────────────────────────────────────');
console.log('');

const RUNS = (!ONLY || 'ABC'.includes(ONLY)) ? POLICIES.map(p => ({ pol: p, run: play(p, { days: DAYS }) })) : [];

if (!ONLY || ONLY === 'A') {
  console.log('── §A ★★ 배분 정책 셋 — 세 층 다 켬 ──');
  console.log('| 정책 | 끝 최대체력 | 10 도달 | 15 도달 | 20 도달 | 최대 시루 | 파산일 | 최저 현금(일) | 끝 현금 |');
  console.log('|------|-------------|---------|---------|---------|-----------|--------|---------------|---------|');
  for (const { pol, run } of RUNS)
    console.log(`| ${pol.id} ${pol.ko} | ${String(run.endMax).padStart(11)} | ` +
      `${String(atLv(run, 10) ? atLv(run, 10) + '일' : '★안 닿는다').padStart(7)} | ` +
      `${String(atLv(run, 15) ? atLv(run, 15) + '일' : '★안 닿는다').padStart(7)} | ` +
      `${String(atLv(run, 20) ? atLv(run, 20) + '일' : '★안 닿는다').padStart(7)} | ` +
      `${String(run.maxSiru + '개').padStart(9)} | ${String(run.brokeDay ? run.brokeDay + '일' : '—').padStart(6)} | ` +
      `${(won(run.minCash) + '(' + run.minCashDay + '일)').padStart(13)} | ${won(run.endCash).padStart(7)} |`);
  console.log('');
  console.log('| 정책 | ⚠죽은 삽수 | 자른 것 | 판 것 | 분갈이 | 삽수 수입 | 잉여 채소 | 곳간 절감 | 등 산 날 | ★이사 자금(자산) | 현금만으로 |');
  console.log('|------|-----------|---------|-------|--------|-----------|-----------|-----------|----------|------------------|------------|');
  for (const { pol, run } of RUNS)
    console.log(`| ${pol.id} ${pol.ko} | ${String(run.died).padStart(9)} | ${String(run.cuts).padStart(7)} | ` +
      `${String(run.sold).padStart(5)} | ${String(run.repots).padStart(6)} | ${won(run.cutCash).padStart(9)} | ` +
      `${won(run.surplusCash).padStart(9)} | ${won(run.savedWon).padStart(9)} | ` +
      `${String(run.lampDay ? run.lampDay + '일' : '★못 삼').padStart(8)} | ` +
      `${String(run.assetMoveDay ? run.assetMoveDay + '일' : '★안 닿는다').padStart(16)} | ` +
      `${String(run.cashMoveDay ? run.cashMoveDay + '일' : '★안 닿는다').padStart(10)} |`);
  console.log('');
  console.log('  ⚠ **죽은 삽수가 0 이 아니면 그 줄은 못 믿는다.**');
  console.log('  ★ 「이사 자금(자산)」 = 현금 + 삽수 + 모주를 다 팔았을 때(tutorial.sellableWonOf). 튜토 목표는 80일이다.');
  console.log('');
}

if (!ONLY || ONLY === 'B') {
  console.log('── §B 일자별 (20일 간격) ──');
  for (const { pol, run } of RUNS) {
    console.log(`  ── ${pol.id} ${pol.ko} ──`);
    console.log('| 일 | 최대체력 | 시루 | 쓴 손 | 못 한 손 | 자름 | 도는 삽수 | 삽수수입(누적) | 현금 | 자산 |');
    console.log('|----|----------|------|-------|----------|------|-----------|----------------|------|------|');
    for (const x of run.rows) if (x.day % 20 === 0)
      console.log(`| ${String(x.day).padStart(3)} | ${String(x.max).padStart(8)} | ${String(x.nSiru).padStart(4)} | ` +
        `${String(x.used).padStart(5)} | ${String(x.missed).padStart(8)} | ${String(x.didC).padStart(4)} | ` +
        `${String(x.nCut).padStart(9)} | ${won(x.cutCash).padStart(14)} | ${won(x.cashWon).padStart(9)} | ${won(x.asset).padStart(9)} |`);
    console.log('');
  }
}

if (!ONLY || ONLY === 'C') {
  console.log('── §C ★ 하루 12,500원(월세+공과금)을 증식이 대는가 ──');
  console.log(`  월세 ${won(REAL.rentWon)}원 / ${REAL.rentPeriodDays}일 = 하루 ${won(RENT_PER_DAY)}원 · ` +
              `공과금 ${won(UTIL_PER_DAY)}원 ⇒ 하루 ${won(RENT_UTIL_PER_DAY)}원`);
  console.log('| 정책 | 삽수 수입/일 | 잉여 채소/일 | 현금 수입 합/일 | 12,500 대비 | (참고)곳간 절감/일 |');
  console.log('|------|--------------|--------------|-----------------|-------------|--------------------|');
  for (const { pol, run } of RUNS) {
    const n = run.rows.length;
    const cut = run.cutCash / n, sur = run.surplusCash / n, sav = run.savedWon / n;
    console.log(`| ${pol.id} ${pol.ko} | ${won(cut).padStart(12)} | ${won(sur).padStart(12)} | ` +
      `${won(cut + sur).padStart(15)} | ${((cut + sur) / RENT_UTIL_PER_DAY * 100).toFixed(1).padStart(10)}% | ` +
      `${won(sav).padStart(18)} |`);
  }
  console.log('  ★ 「곳간 절감」은 현금이 아니라 **안 나간 식대**다 — 월세를 못 낸다. 그래서 합에서 뺐다.');
  console.log('');
}

/* ── §D 선반 — 값을 거꾸로 잰다 ──────────────────────────────────────────── */
if (!ONLY || ONLY === 'D') {
  console.log('── §D ★ 선반(가구) — **값이 없다. 거꾸로 잰다** ──');
  console.log('  ┌ 켬/끔 — 채소만 켬(콩나물) · 증식·등·가구 **끔** · 시루 수 **고정** · **체력 안 걸고**(자리의 값만 남게)');
  console.log('  └ 값·칸수는 정해진 것이 없다. 그래서 **시루 한 칸이 하루에 내는 순액**을 재고');
  console.log('    「선반 하나가 3칸을 준다면 값이 얼마일 때 며칠에 회수되나」를 낸다.');
  console.log('');
  const marg = [];
  console.log('| 시루 | 곳간 절감/일 | 잉여 판매/일 | 씨앗값/일 | 순액/일 | 앞 칸과의 차 | 시루 한 칸당 |');
  console.log('|------|--------------|--------------|-----------|---------|--------------|--------------|');
  let prev = null;
  for (const n of [5, 8, 11, 14, 17, 20]) {
    const r = play(VEGONLY, { days: 200, prop: false, lamps: 0, siruFixed: n, staminaFree: true });
    const t = r.rows.slice(50);                       // 첫 50일은 놓는 중이라 뺀다
    const dn = t.length;
    const sav = t.reduce((a, x) => a + x.savedWon, 0) / dn;
    const sur = (r.surplusCash - r.rows[49].surplusCash) / dn;
    const seed = r.seedSpend / r.rows.length;
    const net = sav + sur - seed;
    const d = prev == null ? null : net - prev.net;
    const per = prev == null ? null : d / (n - prev.n);
    if (per != null && n >= 11) marg.push(per);   // 5→8 은 아직 놓는 중이라 뺀다
    console.log(`| ${String(n).padStart(4)} | ${won(sav).padStart(12)} | ${won(sur).padStart(12)} | ` +
      `${won(seed).padStart(9)} | ${won(net).padStart(7)} | ${(d == null ? '—' : won(d)).padStart(12)} | ` +
      `${(per == null ? '—' : won(per)).padStart(12)} |`);
    prev = { n, net };
  }
  const per1 = marg.length ? marg.reduce((a, b) => a + b, 0) / marg.length : 0;
  console.log('');
  console.log(`  ⇒ 시루 한 칸이 하루에 내는 순액(11개 이상 구간의 평균 · 앞 구간은 놓는 중이라 뺐다) = **${won(per1)}원**`);
  console.log(`  ⇒ 선반 하나가 **3칸**이면 하루 **${won(per1 * 3)}원**`);
  console.log('');
  console.log('| 선반 값 | 근거 | 3칸 회수일 | 시루 3개값까지 합친 회수일 |');
  console.log('|---------|------|------------|----------------------------|');
  const siru3 = buyPriceOf('siru') * 3;
  for (const [w, why] of [[10_000, 'plan 후보'],
                          [14_000, 'oneroomfix-to-plan:284 「벽걸이 선반 3칸 14,000원」'],
                          [30_000, 'plan 문서의 임의값'], [50_000, '위쪽 시험값']]) {
    const ok = per1 * 3 > 0;
    console.log(`| ${won(w).padStart(7)}원 | ${why} | ${(ok ? Math.ceil(w / (per1 * 3)) + '일' : '★영영').padStart(10)} | ` +
      `${(ok ? Math.ceil((w + siru3) / (per1 * 3)) + '일' : '★영영').padStart(26)} |`);
  }
  console.log('');
  console.log('  ⚠ 이 회수일은 **자리가 병목일 때만** 뜻이 있다. 지금은 체력이 먼저 막는다 —');
  console.log('    체력 10 이면 시루 15개, 20 이면 30개인데 반지하 자리는 14칸이다.');
  console.log('    ⇒ 선반이 값을 갖기 시작하는 것은 **최대체력이 10을 넘긴 뒤**다.');
  console.log('');
}

/* ── §E 검산 ─────────────────────────────────────────────────────────────── */
if (!ONLY || ONLY === 'E') {
  console.log('── §E 검산 — 흩기가 됐나 · 곳간 천장은 어디서 닿나 ──');
  console.log('  ┌ 켬/끔 — 콩나물만 · 증식·등 **끔** · 시루 수 고정 · **체력 안 걸고**(천장만 보게)');
  console.log('  ★ 검산법(§7.7) — 시루 N개 판의 곳간절감이 시루 5개 판과 같으면 흩기가 안 된 것이다.');
  console.log('| 시루 | 100일 곳간절감 | 하루 평균 | 5개 판과 같나 | 수확/심기/물(100일 합) |');
  console.log('|------|----------------|-----------|---------------|------------------------|');
  let base = null;
  for (const n of [5, 8, 10, 12, 15, 20, 25, 30, 40]) {
    const r = play(VEGONLY, { days: 100, prop: false, lamps: 0, siruFixed: n, staminaFree: true });
    const sav = r.rows.reduce((a, x) => a + x.savedWon, 0);
    if (base == null) base = sav;
    const h = r.rows.reduce((a, x) => a + x.didH, 0);
    const s = r.rows.reduce((a, x) => a + x.didS, 0);
    const w = r.rows.reduce((a, x) => a + x.didW, 0);
    console.log(`| ${String(n).padStart(4)} | ${won(sav).padStart(14)} | ${won(sav / 100).padStart(9)} | ` +
      `${(sav === base && n !== 5 ? '⚠ 같다—흩기실패' : '○ 다르다').padStart(13)} | ` +
      `${(h + '/' + s + '/' + w).padStart(22)} |`);
  }
  console.log('  ★ 하루 평균이 5,000원에서 서면 그게 §0 의 곳간 천장이다.');
  console.log('');
}

/* ── §F 채소만으로 「어거지 이사」가 되나 ────────────────────────────────── */
if (!ONLY || ONLY === 'F') {
  console.log('── §F ★★ 채소만으로 「어거지 이사」 — 축을 하나씩 움직인다 ──');
  console.log('  ┌ 켬/끔 — 콩나물 **켬** · 무순 후보에 따라 · 몬스테라 증식·모주판매·식물등·가구 **전부 끔**');
  console.log('  │ 시루 수는 **체력이 허락하는 만큼**(3×ceil(N/5) ≤ 최대체력) 늘린다 — 상한 20이면 30개');
  console.log('  └ 월세는 **안 건드린다**. 움직이는 것은 회전분·판매가율·공과금·무순 비율뿐이다.');
  console.log('');
  const HORIZON = Number(argOf('--fdays', 1200));
  const rowsF = [];
  const runF = (label, { cycleWon = null, saleRate = null, utilWon = UTIL_PER_DAY, musun = 0 }) => {
    const fp = vegRules({ cycleWon, saleRate });
    const r = play(VEGONLY, { days: HORIZON, prop: false, lamps: 0, veg: true,
                              fpRules: fp, rules: homeRules({ utilWon }), musun });
    /* 하루 순현금 — 마지막 200일의 기울기로 잰다(초반은 놓는 중이라 뺀다) */
    const a = r.rows[Math.max(0, r.rows.length - 200)], b = r.rows[r.rows.length - 1];
    const slope = (b.cashWon - a.cashWon) / (b.day - a.day);
    rowsF.push({ label, r, slope, fp,
      maxSiru: r.maxSiru, endMax: r.endMax,
      move: r.cashMoveDay, broke: r.brokeDay });
    return rowsF[rowsF.length - 1];
  };
  console.log(`  (${HORIZON}일까지 돌린다. 그 안에 못 가면 하루 순현금의 부호로 「영영」을 가른다)`);
  console.log('');
  console.log('| 후보 | 회전분 | 판매가율 | 공과금 | 무순 | 최대 시루 | 끝 최대체력 | 하루 순현금 | ★이사일 | 파산 |');
  console.log('|------|--------|----------|--------|------|-----------|-------------|-------------|---------|------|');
  const CASES = [
    ['기준(지금 값)',      { }],
    ['회전분 4,500',       { cycleWon: 4500 }],
    ['회전분 6,000',       { cycleWon: 6000 }],
    ['판매가율 85%',       { saleRate: 0.85 }],
    ['공과금 0원',         { utilWon: 0 }],
    ['무순 3판',           { musun: 3 }],
    ['무순 7판',           { musun: 7 }],
    ['★85% + 무순 7판',    { saleRate: 0.85, musun: 7 }],
    ['★6,000 + 85%',       { cycleWon: 6000, saleRate: 0.85 }],
    ['★6,000+85%+공과0',   { cycleWon: 6000, saleRate: 0.85, utilWon: 0 }]
  ];
  for (const [label, opt] of CASES) {
    const x = runF(label, opt);
    console.log(`| ${label.padEnd(18)} | ${won(x.fp.cropKindSavedWon[0]).padStart(6)} | ` +
      `${(x.fp.cropSurplusSaleRate * 100).toFixed(0).padStart(7)}% | ` +
      `${won(opt.utilWon ?? UTIL_PER_DAY).padStart(6)} | ${String(opt.musun || 0).padStart(4)} | ` +
      `${String(x.maxSiru + '개').padStart(9)} | ${String(x.endMax).padStart(11)} | ` +
      `${won(x.slope).padStart(11)} | ` +
      `${String(x.move ? x.move + '일' : (x.slope > 0 ? '>' + HORIZON + '일' : '★영영 못 감')).padStart(7)} | ` +
      `${String(x.broke ? x.broke + '일' : '—').padStart(4)} |`);
  }
  console.log('');
  console.log(`  ★ 이사 자금 ${won(MOVE_OUT_WON)}원. 「★영영 못 감」 = 하루 순현금이 음수라 아무리 오래 해도 안 모인다.`);
  console.log('');
  console.log('── §F-2 ★★ 하루 조작 수 — 「되긴 된다」와 「사람이 할 만하다」는 다른 말이다 ──');
  console.log('  체력이 곧 **그날 손으로 눌러야 하는 횟수**다(일괄 버튼도 빨리감기도 없앴다).');
  console.log('| 후보 | 100일째 | 300일째 | 500일째 | 1000일째 | 그때 시루 | 판 전체 누적 조작 수 |  (앞 10일 평균) |');
  console.log('|------|---------|---------|---------|----------|-----------|----------------------|');
  /* ★ 하루 조작 수는 **10일 평균**으로 낸다 — 하루만 뽑으면 차례가 없는 날에 0 이 찍혀 거짓말이 된다 */
  const tapAt = (r, d) => {
    const w = r.rows.filter(y => y.day > d - 10 && y.day <= d);
    return w.length ? Math.round(w.reduce((a, y) => a + y.used, 0) / w.length) : null;
  };
  const siruAt = (r, d) => { const x = r.rows.find(y => y.day >= d); return x ? x.nSiru : null; };
  for (const x of rowsF) {
    const tot = x.r.rows.reduce((a, y) => a + y.used, 0);
    console.log(`| ${x.label.padEnd(18)} | ${String(tapAt(x.r, 100) ?? '—').padStart(7)} | ` +
      `${String(tapAt(x.r, 300) ?? '—').padStart(7)} | ${String(tapAt(x.r, 500) ?? '—').padStart(7)} | ` +
      `${String(tapAt(x.r, 1000) ?? '—').padStart(8)} | ${String((siruAt(x.r, 1000) ?? siruAt(x.r, HORIZON)) + '개').padStart(9)} | ` +
      `${won(tot).padStart(20)} |`);
  }
  console.log('');
  console.log('  ⚠ 이 값이 사람이 못 견딜 크기면 **숫자가 맞아도 통과가 아니다.**');
  console.log('');
}

console.log(`(${((Date.now() - T0) / 1000).toFixed(0)}초)`);
