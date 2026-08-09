/* ★ 등 값과 전기세 — 손잡이가 되나 (docs/growlight_aim.md §4 · §6-6)
 *
 *   node tools/probe_lamp_econ.mjs            (12판 · 빠름)
 *   node tools/probe_lamp_econ.mjs --seeds 24 (24판 · test_balance_routes 와 같은 표본)
 *   node tools/probe_lamp_econ.mjs --only 1   (§1 만)
 *
 * 박사님 지시: *"등 사면 전기세 개념을 통해 밸런스 조절. 등 세기·성능에 따라 구매 가격 조정."*
 *
 * ══ 이 도구가 하는 일 ═══════════════════════════════════════════════════════
 * 후보값을 **메모리 위에서만** 넣어 보고 세 가지를 잰다:
 *     ① 파산일   — 첫 「돈이 다 떨어졌습니다」가 며칠에 오나
 *     ② 이사일   — 반지하를 언제 뜨나 (A 등 없이 / B 등 1개 / B2 등 2개)
 *     ③ 등 이득비 — medDay(A) ÷ medDay(B). **이게 합격선이다**
 *                   ×1.00 등이 죽었다 · 지금 ×1.17 · ×2.00 이상 안 사면 바보
 *
 * ══ ★★ 코드를 한 글자도 안 고친다 ══════════════════════════════════════════
 *   · 규칙   `TUTORIAL_RULES` 의 **사본**을 만들어 `S.tutorial.rules` 에 꽂는다.
 *            (`state.newState` 가 rules 를 안 받으므로 만든 뒤에 갈아 끼운다)
 *            등마다 값·전력이 다른 후보는 **게터**로 낸다 —
 *            `lampPriceWon` 은 *다음에 살 등*의 값, `lampWatt` 는 *지금 켠 등들의 합*÷개수.
 *            `tutorial.lampElectricityWon` 이 `lampWatt × owned × litHours` 라
 *            합÷개수를 주면 곱이 정확히 합이 된다. 식을 안 고치고 값만 바꾼다.
 *   · 조도   `data/profiles/room_profile.banjiha.json` 을 **깊은 사본**으로 뜬 뒤
 *            `slots[].ppfd` · `lampWatts` 를 바꿔 `createProfileLight` 에 넘긴다.
 *   ⇒ `src/**` · `data/**` · `game.html` · `plant_grow.html` 은 읽기만 한다.
 *
 * ══ ★ 프로파일에서 등 하나를 떼어내는 법 (빛은 더해진다) ════════════════════
 *   프로파일은 자리마다 `ppfd[등0개, 등1개, 등2개]` 를 굳혀 두었다.
 *   PPFD 는 선형으로 더해지므로 **집게 혼자 = ppfd[2] − ppfd[1]** 이다. 지어낸 값이 아니다.
 *   그래서 「집게를 먼저 사는 판」을 프로파일을 다시 뽑지 않고 만들 수 있다.
 *
 *   ⚠ **스탠드는 반지하 프로파일에 없다.** 그래서 스탠드 판만은 근사다 —
 *     바가 달린 그 자리에 스탠드를 달았다고 보고 `ppfd_ref × ref_dist²` 비로 키운다
 *     (스탠드 250×0.4² = 40.0 / 바 180×0.3² = 16.2 → ×2.469).
 *     `coverage_r`(0.5 → 0.7)로 넓어지는 몫은 **못 반영한다** — 프로파일에 굳어 있어서다.
 *     즉 스탠드 줄은 **아래로 치우친 추정**이다. 표에 그렇게 적는다.
 *
 * ⚠ 하네스(headless growth · play 루프)는 `tools/test_balance_routes.mjs` 것을 그대로 쓴다.
 *   두 도구가 다른 판을 굴리면 여기 결과를 저기 합격선(×1.19)과 비교할 수 없다.
 */
import assert from 'node:assert';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProfileLight } from '../src/game/room_profile.js';
import { newState, pot0, setPotSlot, resowCrop, waterCrop, ARRIVAL } from '../src/game/state.js';
import { nextDay, harvestCrop } from '../src/game/loop.js';
import { firstPlayRulesFromBalance, placeBeansprout, moveMonstera, beansproutReady } from '../src/game/first_play.js';
import { seasonAt, buyLamp, canMoveOut, moveOut, varieView, TUTORIAL_RULES,
         dailyCashOutWon, lampElectricityWon } from '../src/game/tutorial.js';
import { orderItem, stockOf, incomingOf, priceOf, sellCutting, sellPot,
         SELLABLE_CUTTING_STATUS } from '../src/game/shop.js';
import { takeCutting, cuttableNow, cutBudgetOf, motherStatsNow } from '../src/game/propagation.js';

const T0 = Date.now();
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const J = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url), 'utf8'));
const argv = process.argv.slice(2);
const argOf = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const SEED_N = Number(argOf('--seeds', 12));
const ONLY = argOf('--only', null);
const SEEDS = Array.from({ length: SEED_N }, (_, i) => i + 1);

const PRESETS = J('../data/lighting_presets.json');
const FIX = PRESETS.fixtures;
const BASE_PROFILE = J('../data/profiles/room_profile.banjiha.json');
const LIGHT_TH = J('../data/balance/light_thresholds.json');
const WEATHER_BAL = J('../data/balance/weather.json');
const RULES = firstPlayRulesFromBalance(J('../data/balance/characters.json'));
const DARK = 'banjiha-dresser:1';
const SILL = 'banjiha-sill:0';
const MOVE_OUT_WON = TUTORIAL_RULES.moveOutCostWon;
const DAILY_SPEND = TUTORIAL_RULES.dailySpendWon;

/* ══ 헤드리스 생장 엔진 (test_balance_routes.mjs 와 같은 하네스) ═══════════ */
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

/* ══ ★ 등 판(rig) — 프로파일에서 등 하나씩을 떼어낸다 ═══════════════════════
   PPFD 는 더해진다. 그래서 바 = ppfd[1], 집게 = ppfd[2] − ppfd[1] 이 **정확**하다.
   스탠드만 근사다(위 머리말 ⚠). */
const BAR_PPFD  = BASE_PROFILE.slots.map(s => s.ppfd[1]);
const CLIP_PPFD = BASE_PROFILE.slots.map(s => s.ppfd[2] - s.ppfd[1]);
/* ppfd_ref × ref_dist² — 같은 거리에서의 출력 비. 감쇠식(역제곱)에서 떨어진다 */
const OUT = id => FIX[id].ppfd_ref * FIX[id].ref_dist_m ** 2;
const STAND_K = OUT('growlight_stand') / OUT('growlight_bar');
const STAND_PPFD = BAR_PPFD.map(v => +(v * STAND_K).toFixed(2));

/* 등 판 = [1번째 등, 2번째 등] 각각 { ko, ppfd[], watts, priceWon } */
const RIG = {
  bar:   { ko: '바',     ppfd: BAR_PPFD,   watts: FIX.growlight_bar.watts,   price: FIX.growlight_bar.price },
  clip:  { ko: '집게',   ppfd: CLIP_PPFD,  watts: FIX.growlight_clip.watts,  price: FIX.growlight_clip.price },
  stand: { ko: '스탠드', ppfd: STAND_PPFD, watts: FIX.growlight_stand.watts, price: FIX.growlight_stand.price,
           approx: true }
};

/* 등 판 목록 → 메모리 프로파일. `scale` 은 「등을 세게 + 전력도 같이」(㉢) 용이다. */
function profileFor(rigIds, { scale = 1 } = {}) {
  const p = structuredClone(BASE_PROFILE);
  const rigs = rigIds.map(id => RIG[id]);
  p.lampCounts = Array.from({ length: rigs.length + 1 }, (_, i) => i);   // [0,1,2]
  p.lampWatts = p.lampCounts.map(n => rigs.slice(0, n).reduce((a, r) => a + r.watts * scale, 0));
  p.slots = p.slots.map((s, si) => ({
    ...s,
    ppfd: p.lampCounts.map(n => +rigs.slice(0, n).reduce((a, r) => a + r.ppfd[si] * scale, 0).toFixed(2))
  }));
  return p;
}
function pricesFor(rigIds, { scale = 1, flatPrice = null } = {}) {
  if (flatPrice != null) return rigIds.map(() => flatPrice);
  return rigIds.map(id => Math.round(RIG[id].price * scale));
}

/* ══ ★ 규칙 사본 — 게터로 등마다 다른 값·전력을 낸다 (코드를 안 고친다) ═════ */
function makeRules(ts, { prices, watts, kwhWon, lampHours }) {
  const R = { ...TUTORIAL_RULES };
  R.kwhWon = kwhWon;
  R.lampHours = lampHours;
  /* 다음에 살 등의 값. `buyLamp` 도 play 루프도 이 한 곳만 읽는다. */
  Object.defineProperty(R, 'lampPriceWon', {
    enumerable: true,
    get() { return prices[Math.min(ts.lamp.owned, prices.length - 1)]; }
  });
  /* ★★ 2026-08-09 — `TUTORIAL_RULES` 가 **등 순서대로의 와트 표**를 갖게 됐다
     (tutorial.js §lampWattsByOrder — 예전 `lampWatt: 12` 고정값을 대신한다).
     후보값을 그 표로 그대로 준다. 아래 `lampWatt` 게터는 표가 없는 옛 경로를 위해 남긴다 —
     `lampWattsOn` 이 표를 먼저 보므로 실제로 도는 것은 이 줄이다. */
  R.lampWattsByOrder = [...watts];
  /* `lampElectricityWon` 이 `lampWatt × owned × litHours` 라, 합÷개수를 주면 곱이 합이 된다.
     0개면 0 이라 나누지 않는다(어차피 owned 를 곱해 0). */
  Object.defineProperty(R, 'lampWatt', {
    enumerable: true,
    get() {
      const n = ts.lamp.owned;
      if (!n) return 0;
      return watts.slice(0, n).reduce((a, w) => a + w, 0) / n;
    }
  });
  return R;
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

function play(opt = {}) {
  const rigIds = opt.rigs || ['bar', 'clip'];
  const scale = opt.scale || 1;
  const litHours = opt.litHours || 12;
  const profile = profileFor(rigIds, { scale });
  const light = createProfileLight(profile, { lightTh: LIGHT_TH, weatherBalance: WEATHER_BAL });
  const io = { light, growth: standGrowth(opt.seed || 1) };

  const S = newState({ mode: 'novice', room: 'banjiha', firstPlay: true, firstPlayRules: RULES });
  const ts = S.tutorial;
  /* ★ 메모리 주입 — 여기가 이 도구의 전부다 */
  ts.rules = makeRules(ts, {
    prices: pricesFor(rigIds, { scale, flatPrice: opt.flatPrice }),
    watts: rigIds.map(id => RIG[id].watts * scale),
    kwhWon: opt.kwhWon == null ? TUTORIAL_RULES.kwhWon : opt.kwhWon,
    lampHours: litHours
  });
  ts.lamp.litHours = litHours;
  S.lamps.litHours = litHours;

  placeBeansprout(S.firstPlay, DARK, { slots: light.room.slots });

  const rows = [];
  let lampDay = null, brokeDay = null, powerSum = 0, lampSpend = 0;
  const sell = c => { const r = sellCutting(S, c.id); return r.won; };

  for (let d = 1; d <= (opt.days || 300); d++) {
    try { waterCrop(S); } catch { /* 아직 안 놓은 시루 */ }
    const turn = nextDay(S, io).turn;

    let harvested = null;
    if (beansproutReady(S.firstPlay.beansprout)) harvested = harvestCrop(S, io);
    if (harvested && harvested.arrived) {
      setPotSlot(S, pot0(S), SILL, light.room.slots);
      moveMonstera(S.firstPlay, SILL, { slots: light.room.slots });
    }

    const b = S.firstPlay.beansprout;
    if (b.sirus + stockOf(S, 'siru') + incomingOf(S, 'siru') < 1) { try { orderItem(S, 'siru', 1); } catch {} }
    const target = Math.min(1, b.sirus + stockOf(S, 'siru'));
    if (stockOf(S, 'bean_seed') + incomingOf(S, 'bean_seed') < target) {
      try { orderItem(S, 'bean_seed', target - stockOf(S, 'bean_seed') - incomingOf(S, 'bean_seed')); } catch {}
    }
    if (b.harvested && stockOf(S, 'bean_seed') >= target) {
      try { resowCrop(S, { sirus: target, at: DARK, slots: light.room.slots }); } catch {}
    }

    /* 식물등 — 값이 등마다 다르면 `ts.rules.lampPriceWon` 게터가 다음 등 값을 낸다 */
    if (opt.buyLamp && ts.lamp.unlocked && ts.lamp.owned < (opt.lamps || 1) &&
        ts.cashWon >= ts.rules.lampPriceWon) {
      lampSpend += ts.rules.lampPriceWon;
      buyLamp(ts); S.lamps.count = ts.lamp.owned; light.clearCache();
      if (lampDay == null) lampDay = ts.day;
    }
    powerSum += lampElectricityWon(ts);

    /* 삽수 */
    const v0 = pot0(S) ? viewOf(S, io) : null;
    const node = v0 ? pickNode(v0.nodes, v0.budget) : null;
    if (node && (S.cuttings || []).length === 0 && stockOf(S, 'jar') + incomingOf(S, 'jar') === 0) {
      try { orderItem(S, 'jar', 1); } catch {}
    }
    if (node && stockOf(S, 'jar') >= 1) {
      try { takeCutting(S, { nodes: v0.nodes, nodeId: node.nodeId, container: 'jar' }); } catch {}
    }
    for (const c of [...(S.cuttings || [])]) if (SELLABLE_CUTTING_STATUS.includes(c.status)) sell(c);

    /* 이사 */
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
        if (potWon && ts.cashWon < MOVE_OUT_WON)
          sellPot(S, { leaves: v.stats.leaves, variegatedLeaves: v.stats.variegatedLeaves });
      }
    }
    if (!ts.movedOut && canMoveOut(ts).ok) moveOut(ts);

    if (brokeDay == null && ts.bankrupt) brokeDay = ts.day;
    rows.push({ tday: ts.day, cashWon: ts.cashWon, bankrupt: ts.bankrupt });
    if (ts.movedOut) break;
  }
  const last = rows[rows.length - 1];
  return { movedOut: ts.movedOut, lastDay: last.tday, season: seasonAt(ts, ts.day),
           lampDay, brokeDay, lampSpend, powerSum,
           eff: io.growth.growthDays(), leaves: io.growth.leafStats().leaves,
           /* ★★ 확정 무늬를 몇 장 받았나 — 「전기세로 뺀 돈이 무늬로 돌아오나」의 증거다.
              tutorial.varieGrantCheck 는 `가진 것 다 팔아도 < 이사비` 일 때만 준다.
              돈을 잃을수록 조건이 더 오래 참이라 무늬가 더 온다 — 자동 보상기다. */
           varieGrants: (ts.varieGrant || {}).count || 0,
           /* ★★ 0원으로 산 날 — `tutorialDay` 가 `cashWon` 을 0 아래로 안 내린다.
              즉 지갑이 빈 날에는 **지출이 아무 것도 아니다**(clamp 가 삼킨다).
              전기세를 올려도 이사일이 안 움직이는 이유가 여기 있는지 이 숫자가 말한다. */
           brokeDays: rows.filter(r => r.bankrupt).length,
           /* 「등을 살 돈이 없어서 못 샀다」와 「안 샀다」를 가른다 */
           boughtLamps: ts.lamp.owned };
}

function route(opt) {
  const runs = SEEDS.map(seed => play({ ...opt, seed, days: 300 }));
  const ok = runs.filter(r => r.movedOut);
  const broke = runs.map(r => r.brokeDay).filter(v => v != null);
  return {
    runs, ok, rate: ok.length / runs.length,
    medDay: ok.length ? median(ok.map(r => r.lastDay)) : null,
    medBroke: broke.length ? median(broke) : null,
    brokeRate: broke.length / runs.length,
    medLampDay: median(runs.map(r => r.lampDay).filter(v => v != null)),
    medLamps: median(runs.map(r => r.boughtLamps)),
    medEff: median(runs.map(r => r.eff)),
    medPower: median(runs.map(r => r.powerSum)),
    medLampSpend: median(runs.map(r => r.lampSpend)),
    medGrants: median(runs.map(r => r.varieGrants)),
    medBrokeDays: median(runs.map(r => r.brokeDays))
  };
}

/* 하루 전기세 — `tutorial.lampElectricityWon` 과 **같은 식**이다(숫자를 안 짓는다) */
const dayPower = (wattsSum, hours, kwhWon) => Math.round(wattsSum * hours / 1000 * kwhWon);
const pct = (a, b) => (a / b * 100).toFixed(1) + '%';
const won = v => v == null ? '—' : Math.round(v).toLocaleString();

/* ★ 후보 하나 = A(등 없이) · B(등 1개) · B2(등 2개) 를 나란히 */
function candidate(name, opt, note) {
  const A = route({ ...opt, buyLamp: false });
  const B = route({ ...opt, buyLamp: true, lamps: 1 });
  const B2 = route({ ...opt, buyLamp: true, lamps: 2 });
  const gain = (A.medDay != null && B.medDay) ? A.medDay / B.medDay : null;
  return { name, opt, note, A, B, B2, gain };
}
function showCand(c) {
  const g = c.gain == null ? '  —  ' : '×' + c.gain.toFixed(2);
  const verdict = c.gain == null ? '못 잼'
    : c.gain < 1.02 ? '★등이 죽었다'
    : c.gain > 2.00 ? '★너무 세다'
    : '살아 있다';
  console.log(
    `| ${c.name.padEnd(26)} | ${String(c.A.medDay ?? '못나감').padStart(6)} | ${String(c.B.medDay ?? '못나감').padStart(6)} | ` +
    `${String(c.B2.medDay ?? '못나감').padStart(6)} | ${g} | ${verdict.padEnd(12)} | ` +
    `${String(c.A.medBroke ?? '—').padStart(5)} / ${String(c.B.medBroke ?? '—').padStart(5)} | ` +
    `${(c.A.rate * 100).toFixed(0)}/${(c.B.rate * 100).toFixed(0)}/${(c.B2.rate * 100).toFixed(0)}% | ` +
    `${String(c.B.medLampDay ?? '못삼').padStart(4)} | ${String(c.B2.medLamps ?? 0).padStart(2)} | ` +
    `${String(c.A.medGrants).padStart(2)}/${String(c.B.medGrants).padStart(2)}/${String(c.B2.medGrants).padStart(2)} | ` +
    `${String(c.A.medBrokeDays).padStart(3)}/${String(c.B.medBrokeDays).padStart(3)} |`);
}
const HEAD =
`| 후보                       | A이사  | B이사  | B2이사 | 등이득 | 판정         | 파산 A/B    | 이사율A/B/B2 | 등산날 | B2등 | 무늬A/B/B2 | 0원날A/B |
|----------------------------|--------|--------|--------|--------|--------------|-------------|--------------|--------|------|------------|----------|`;

/* ══════════════════════════════════════════════════════════════════════════ */
console.log('══ 등 값 · 전기세 (probe_lamp_econ) ═══════════════════════════════');
console.log(`★ 표본 ${SEED_N}판 · 반지하 · 몬스테라 창턱 · 콩나물 서랍장 · 최대 300일`);
console.log(`★ 등 이득비 = medDay(A 등 없이) ÷ medDay(B 등 1개). 합격선: 1.02 ~ 2.00`);
console.log(`★ 파산 = 「돈이 다 떨어졌습니다」 첫날(튜토일). 0원 아래로는 안 내려간다(초보 모드)`);
console.log('');

/* ── §0 지금 코드가 실제로 무엇을 떼는가 ─────────────────────────────────── */
console.log('── §0 지금 코드가 실제로 무엇을 떼는가 ─────────────────────────────');
console.log(`  TUTORIAL_RULES.lampPriceWon = ${won(TUTORIAL_RULES.lampPriceWon)}원 (등 종류와 무관하게 하나)`);
console.log(`  TUTORIAL_RULES.lampWatt     = ${TUTORIAL_RULES.lampWatt}W  ← ★등 1개든 2개든 개당 12W 로 센다`);
console.log(`  프로파일 lampWatts          = [${BASE_PROFILE.lampWatts.join(', ')}]W  ← 실제 기구는 바 20W + 집게 12W`);
console.log(`  ⇒ 지금 게임이 떼는 전기세(lampElectricityWon):`);
for (const n of [1, 2]) {
  const codeW = TUTORIAL_RULES.lampWatt * n;
  const realW = BASE_PROFILE.lampWatts[n];
  console.log(`     등 ${n}개 — 코드 ${codeW}W → ${won(dayPower(codeW, 12, 160))}원/일 · ` +
              `프로파일 ${realW}W → ${won(dayPower(realW, 12, 160))}원/일 ` +
              `(하루 지출 ${won(DAILY_SPEND)}원의 ${pct(dayPower(codeW, 12, 160), DAILY_SPEND)} / ${pct(dayPower(realW, 12, 160), DAILY_SPEND)})`);
}
console.log(`  ⚠ 두 값이 갈린다. docs/growlight_aim.md §4 의 「38원·61원」은 **프로파일 와트**로 잰 것이고,`);
console.log(`     실제로 지갑에서 나가는 것은 **23원·46원**이다(코드가 12W 로 센다).`);
console.log(`  ⚠ 또 하나 — room_profile 이 내는 report.energy.won 은 loop.js 761줄에서`);
console.log(`     "S.ledger.electricityWon += … // 표시만. 차감 없음". 즉 전기세 계산이 **두 벌**이고`);
console.log(`     지갑에 닿는 것은 tutorial.lampElectricityWon 하나뿐이다.`);
console.log(`  하루 살림 — dailySpendWon ${won(DAILY_SPEND)}원 · 실제 차감 dailyCashOutWon ` +
            `${won(dailyCashOutWon({ rules: TUTORIAL_RULES, movedOut: false }))}원 + 월세 ${won(TUTORIAL_RULES.rentWon)}원/30일`);
console.log('');

/* ── §0-b 등 판 실측 — 프로파일에서 떼어낸 값 ───────────────────────────── */
console.log('── §0-b 등마다 자리에 얼마나 꽂히나 (프로파일에서 떼어낸 PPFD · 12h DLI) ──');
console.log(`  | 자리${' '.repeat(14)}| 바(20W)         | 집게(12W)       | 스탠드(36W·추정) |`);
const SHOW_SLOTS = [SILL, 'banjiha-etagere:7', 'banjiha-etagere:6', 'banjiha-desk:0', 'banjiha-desk:1', DARK];
const dliOf = (ppfd, h = 12) => (ppfd * h * 3600 / 1e6).toFixed(2);
const cell = (v) => `${v.toFixed(2).padStart(6)} (DLI ${dliOf(v).padStart(5)})`;
for (const id of SHOW_SLOTS) {
  const i = BASE_PROFILE.slots.findIndex(s => s.slotId === id);
  console.log(`  | ${id.padEnd(18)}| ${cell(BAR_PPFD[i])} | ${cell(CLIP_PPFD[i])} | ${cell(STAND_PPFD[i])}  |`);
}
console.log(`  ★ 스탠드 배율 ×${STAND_K.toFixed(3)} = (250×0.4²)÷(180×0.3²). 바가 달린 자리에 스탠드를 단 가정이다.`);
console.log(`  ★★ 몬스테라가 앉는 자리는 창턱(${SILL})이다 — 거기서 집게는 ${CLIP_PPFD[0].toFixed(2)} 로`);
console.log(`     바(${BAR_PPFD[0].toFixed(2)})의 ${(CLIP_PPFD[0] / BAR_PPFD[0] * 100).toFixed(0)}% 뿐이다. 약해서가 아니라 **책상 쪽을 보고 있어서**다.`);
{
  const th = LIGHT_TH.plants.monstera_deliciosa;
  const sill = 4.80;   // docs/growlight_aim.md §3 — 창턱 자연광 7일평균
  console.log(`  ★★★ 갈라짐 문턱 ${th.fenestrate} · 창턱 자연광 ${sill}(growlight_aim §3). 등을 더하면:`);
  for (const [ko, ppfd] of [['등 없이', 0], ['바', BAR_PPFD[0]], ['집게', CLIP_PPFD[0]], ['스탠드', STAND_PPFD[0]]]) {
    const total = sill + +dliOf(ppfd);
    console.log(`     ${ko.padEnd(8)} ${total.toFixed(2)}  ${total >= th.fenestrate ? '✔ 넘는다' : '✕ 못 넘는다'}`);
  }
  console.log(`  ⇒ **넘기만 하면 끝이다.** 문턱은 하나뿐이라 그 위로 더 세게 해도 갈라짐은 안 더 온다.`);
}
console.log('');

/* ── §1 값을 프리셋대로 바꾸면 (㉠) ──────────────────────────────────────── */
const cands1 = [];
if (!ONLY || ONLY === '1') {
  console.log('── §1 값을 프리셋대로 바꾸면 무엇이 움직이나 (㉠) ──────────────────');
  console.log(HEAD);
  cands1.push(candidate('P0 지금(전부 25,000)', { rigs: ['bar', 'clip'], flatPrice: 25000 },
    '기준선. test_balance_routes 와 같은 판'));
  cands1.push(candidate('P1 프리셋값·바 먼저', { rigs: ['bar', 'clip'] },
    '바 34,000 → 집게 18,000. 지금 방 기구 순서 그대로'));
  cands1.push(candidate('P2 프리셋값·집게 먼저', { rigs: ['clip', 'bar'] },
    '집게 18,000 → 바 34,000'));
  cands1.push(candidate('P3 프리셋값·스탠드 먼저', { rigs: ['stand', 'clip'] },
    '스탠드 72,000(36W·추정) → 집게 18,000'));
  cands1.forEach(showCand);
  for (const c of cands1)
    console.log(`  · ${c.name} — ${c.note} · B 가 낸 등값 ${won(c.B.medLampSpend)}원 · ` +
                `B2 가 낸 등값 ${won(c.B2.medLampSpend)}원 · ` +
                `이사까지 낸 전기세 B ${won(c.B.medPower)}원 · B2 ${won(c.B2.medPower)}원`);
  console.log('');
}

/* ── §2 전기세 손잡이 — 세 갈래 (㉡) ────────────────────────────────────── */
if (!ONLY || ONLY === '2') {
  console.log('── §2-㉮ kWh 값을 올리면 ───────────────────────────────────────────');
  console.log(`  ⚠ 160원/kWh 는 실제 한국 가정용 요금대다. 올리면 「실제 요금」이라는 근거가 사라진다.`);
  console.log(HEAD);
  for (const k of [160, 480, 1600, 4800, 9600]) {
    const c = candidate(`K ${k}원/kWh`, { rigs: ['bar', 'clip'], kwhWon: k });
    showCand(c);
    console.log(`  · 하루 전기세 등1 ${won(dayPower(20, 12, k))}원(${pct(dayPower(20, 12, k), DAILY_SPEND)}) · ` +
                `등2 ${won(dayPower(32, 12, k))}원(${pct(dayPower(32, 12, k), DAILY_SPEND)}) ` +
                `[코드 와트로는 ${won(dayPower(12, 12, k))}·${won(dayPower(24, 12, k))}원]`);
  }
  console.log('');

  console.log('── §2-㉯ 켜는 시간을 늘리면 (★DLI 도 같이 오른다) ─────────────────');
  console.log(`  ⚠ 광주기 페널티(light_thresholds.photoperiod.growth_mult)는 계약에 실리지만`);
  console.log(`     loop.js·plant_grow.html 어디서도 **안 읽는다**. 즉 지금 시뮬에서 24h 는 순이득이다.`);
  console.log(HEAD);
  for (const h of [12, 16, 20, 24]) {
    const c = candidate(`H ${h}시간`, { rigs: ['bar', 'clip'], litHours: h });
    showCand(c);
    console.log(`  · 하루 전기세 등1 ${won(dayPower(20, h, 160))}원(${pct(dayPower(20, h, 160), DAILY_SPEND)}) · ` +
                `등2 ${won(dayPower(32, h, 160))}원(${pct(dayPower(32, h, 160), DAILY_SPEND)}) · ` +
                `창턱 등1 DLI ${(BAR_PPFD[0] * h * 3600 / 1e6).toFixed(2)}`);
  }
  console.log('');

  console.log('── §2-㉰ 등을 세게 + 전력·값도 같은 비로 (효율 그대로, 규모만) ────');
  console.log(HEAD);
  for (const k of [1, 2, 4, 8]) {
    const c = candidate(`S ×${k} (ppfd·W·값)`, { rigs: ['bar', 'clip'], scale: k });
    showCand(c);
    console.log(`  · 바 ${20 * k}W·${won(FIX.growlight_bar.price * k)}원 · 하루 전기세 등1 ` +
                `${won(dayPower(20 * k, 12, 160))}원(${pct(dayPower(20 * k, 12, 160), DAILY_SPEND)}) · ` +
                `등2 ${won(dayPower(32 * k, 12, 160))}원(${pct(dayPower(32 * k, 12, 160), DAILY_SPEND)}) · ` +
                `창턱 등1 DLI ${(BAR_PPFD[0] * k * 12 * 3600 / 1e6).toFixed(2)}`);
  }
  console.log('');
}

/* ── §3 전기세가 하루 지출의 몇 %가 되려면 ──────────────────────────────── */
console.log('── §3 「느껴지는 몫」을 만들려면 각 갈래가 얼마여야 하나 ────────────');
console.log(`  하루 지출 ${won(DAILY_SPEND)}원 기준. 등 1개(바 20W)를 12h 켠 값이 목표 %가 되려면:`);
console.log(`  | 목표 몫 | 하루 전기세 | ㉮ kWh 값   | ㉯ 켜는 시간 | ㉰ 규모 배수 |`);
console.log(`  |---------|-------------|-------------|--------------|--------------|`);
for (const share of [0.005, 0.01, 0.02, 0.05, 0.10]) {
  const targetWon = DAILY_SPEND * share;
  const kwh = targetWon / (20 * 12 / 1000);
  const hours = targetWon / (20 / 1000 * 160);
  const scale = targetWon / dayPower(20, 12, 160);
  console.log(`  | ${(share * 100).toFixed(1).padStart(6)}% | ${won(targetWon).padStart(11)}원 | ` +
              `${won(kwh).padStart(9)}원 | ${hours.toFixed(1).padStart(10)}h | ` +
              `×${scale.toFixed(1).padStart(11)} |`);
}
console.log(`  ⚠ ㉯는 **24h 가 상한**이라 여기서 만들 수 있는 최대가 ` +
            `${won(dayPower(20, 24, 160))}원(${pct(dayPower(20, 24, 160), DAILY_SPEND)})이다 — 1% 도 못 넘는다.`);
console.log(`  ⚠ ㉮ 를 625원/kWh 로 올리면 실제 요금(160원)의 ${(625 / 160).toFixed(1)}배다. 「실비」라는 근거가 사라진다.`);
console.log('');

/* ── §3-b 「쓰는 값이 사는 값만큼」이 되려면 ─────────────────────────────── */
console.log('── §3-b 다른 재는 자 — 「쓰는 값」이 「사는 값」의 몇 %인가 ─────────');
{
  const HOLD = 161 - 45;   // 등을 사는 날(가을 진입 45) ~ 이사(중앙값 161) = 등을 쥐고 있는 날
  console.log(`  등을 쥐고 있는 기간 = 가을 진입 45일 ~ 이사 161일 = **${HOLD}일**(실측 중앙값)`);
  console.log(`  | 배수 | 등값(바)   | 하루 전기세 | ${HOLD}일 전기세 | 전기세÷등값 |`);
  console.log(`  |------|------------|-------------|--------------|-------------|`);
  for (const k of [1, 2, 4, 8, 16]) {
    const price = FIX.growlight_bar.price * k;
    const day = dayPower(20 * k, 12, 160);
    console.log(`  | ×${String(k).padStart(2)}  | ${won(price).padStart(10)}원 | ${won(day).padStart(9)}원 | ` +
                `${won(day * HOLD).padStart(12)}원 | ${(day * HOLD / price * 100).toFixed(1).padStart(10)}% |`);
  }
  console.log(`  ⇒ **규모를 키워도 이 비는 안 바뀐다**(값·전력이 같은 비로 크므로). ` +
              `지금 ${(dayPower(20, 12, 160) * HOLD / FIX.growlight_bar.price * 100).toFixed(1)}% 로 고정이다.`);
  console.log(`  ⇒ 이 비를 움직이는 것은 **㉮(kWh 값)뿐**이다 — 값은 그대로 두고 쓰는 값만 올리니까.`);
  const need = FIX.growlight_bar.price / HOLD;      // 하루 전기세가 이만큼이면 116일에 등값과 같아진다
  console.log(`  ★ ${HOLD}일 전기세가 등값(${won(FIX.growlight_bar.price)}원)과 같아지는 지점 — ` +
              `하루 ${won(need)}원(${pct(need, DAILY_SPEND)}) = kWh ${won(need / (20 * 12 / 1000))}원`);
}
console.log('');

console.log(`★ 이 도구는 값을 하나도 안 고쳤다. git status 가 깨끗해야 한다(새 파일 둘 제외).`);
console.log(`  걸린 시간 ${((Date.now() - T0) / 1000).toFixed(1)}초 · 표본 ${SEED_N}판`);
