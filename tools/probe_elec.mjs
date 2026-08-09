/* ★ 전기세를 얼마나 올리면 실제로 아픈가 (2026-08-09 · 박사님 지시 "전기세를 영향가게")
 *
 *   node tools/probe_elec.mjs             (12판 · 약 2분)
 *   node tools/probe_elec.mjs --seeds 24  (24판 · test_balance_routes 와 같은 표본)
 *   node tools/probe_elec.mjs --only 1    (§1 만 — 하루 요금표는 즉시 나온다)
 *
 * ══ 「아프다」를 무엇으로 재나 ═════════════════════════════════════════════
 * 박사님이 정하신 자: **이사일이 며칠 움직이는가.** 그것과 함께 넷을 더 잰다.
 *
 *     ① 하루 전기세 (등1 / 등2 · 12h / 24h)
 *     ② 하루 지출 대비 몫 · **실제로 지갑에서 나간 총액**
 *     ③ 이사일 A(등 없이) / B(등 1개) / B2(등 2개)
 *     ④ **등 이득비** medDay(A) ÷ medDay(B) — ⚠ 등이 손해가 되면 안 된다
 *     ⑤ ★0원으로 산 날 — 「올렸는데 왜 안 아픈가」의 답이 여기 있다
 *
 * ══ ★★ 이 도구가 확인하려는 진짜 질문 ═════════════════════════════════════
 * `docs/handoff/lampecon-to-plan.md` §4 는 **단가를 60배로 올려도 이사일이 하루도 안 움직인다**고
 * 쟀고, 원인을 「0원인 날의 지출을 clamp 가 삼킨다」로 적었다. 그 clamp 는
 * `tutorialDay` 의 `if (ts.cashWon < 0) ts.cashWon = 0` 이다 — **지금도 그 자리에 있다.**
 * (`Math.max(0, base - saved) + power` 의 clamp 는 그것과 **다른 것**이고, 전기세는
 *  처음부터 그 밖에 있었다 — `git log -L` 로 파일이 생긴 날부터 그랬음을 확인했다.)
 * ⇒ 그래서 이 도구는 후보마다 **「명목 전기세」와 「실제로 낸 전기세」를 따로** 센다.
 *   둘이 갈리는 폭이 곧 clamp 가 삼킨 몫이다. 짐작이 아니라 그 숫자로 말한다.
 *
 * ══ 코드를 안 고친다 ══════════════════════════════════════════════════════
 * 후보값은 `TUTORIAL_RULES` 의 **사본**을 만들어 `S.tutorial.rules` 에 꽂는다.
 * 하네스(헤드리스 생장 · play 루프)는 `tools/probe_lamp_econ.mjs` 것을 그대로 썼다 —
 * 두 도구가 다른 판을 굴리면 결과를 나란히 못 놓는다.
 */
import assert from 'node:assert';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProfileLight } from '../src/game/room_profile.js';
import { newState, pot0, setPotSlot, resowCrop, waterCrop, waterPot, ARRIVAL } from '../src/game/state.js';
import { nextDay, harvestCrop } from '../src/game/loop.js';
import { firstPlayRulesFromBalance, placeBeansprout, moveMonstera, beansproutReady } from '../src/game/first_play.js';
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
const SEED_N = Number(argOf('--seeds', 12));
const ONLY = argOf('--only', null);
const SEEDS = Array.from({ length: SEED_N }, (_, i) => i + 1);

const PRESETS = J('../data/lighting_presets.json');
const BASE_PROFILE = J('../data/profiles/room_profile.banjiha.json');
const LIGHT_TH = J('../data/balance/light_thresholds.json');
const WEATHER_BAL = J('../data/balance/weather.json');
const ELEC_BAL = J('../data/balance/electricity.json');
const RULES = firstPlayRulesFromBalance(J('../data/balance/characters.json'));
const DARK = 'banjiha-dresser:1';
const SILL = 'banjiha-sill:0';
const MOVE_OUT_WON = TUTORIAL_RULES.moveOutCostWon;
const DAILY_OUT = TUTORIAL_RULES.dailySpendWon - TUTORIAL_RULES.rentWon / TUTORIAL_RULES.rentPeriodDays;

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

/* ══ ★ 후보 — 전기세를 어떻게 올리나 ══════════════════════════════════════
   전부 `TUTORIAL_RULES` 사본의 값만 바꾼다. 조도(DLI)는 **한 글자도 안 건드린다** —
   전기세는 돈 이야기고 빛은 다른 축이다. 섞으면 「등을 켰더니 조용히 계산이 달라지는」 사고가 난다.

   ⚠ E0 는 **고친 뒤의 기준선**이다. 고치기 전(12W 고정)은 §1 표에 따로 적는다. */
const KR_TIERS = [                         // 한국 주택용 저압 누진 (3단계)
  { uptoKwhPerMonth: 200, won: 120 },
  { uptoKwhPerMonth: 400, won: 214 },
  { won: 307 }
];
const CANDS = [
  { id: 'E0', ko: '지금 (와트 정정만)', rules: {} },
  { id: 'E1', ko: '단가 ×3 (480원/kWh)', rules: { kwhWon: 480 } },
  { id: 'E2', ko: '단가 ×10 (1,600원/kWh)', rules: { kwhWon: 1600 } },
  { id: 'E3', ko: '실제 식물등 와트 (바 45W·집게 25W)', rules: { lampWattsByOrder: [45, 25] } },
  { id: 'E4', ko: '실제 와트 + 누진(3단계·base 390kWh)',
    rules: { lampWattsByOrder: [45, 25], tariffTiers: KR_TIERS, baseKwhPerMonth: 390 } },
  { id: 'E5', ko: '실제 와트 ×2 (바 90W·집게 50W) + 누진',
    rules: { lampWattsByOrder: [90, 50], tariffTiers: KR_TIERS, baseKwhPerMonth: 390 } }
];
function rulesOf(cand, litHours) {
  const R = { ...TUTORIAL_RULES, ...cand.rules };
  if (litHours != null) R.lampHours = litHours;
  return R;
}
/* 하루 전기세 — `tutorial.electricityWonOf` 를 그대로 쓴다. 숫자를 안 짓는다 */
const dayWon = (R, n, h) => Math.round(electricityWonOf(R, lampWattsOn(R, n) * h / 1000));

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
  const litHours = opt.litHours || 12;
  const light = createProfileLight(structuredClone(BASE_PROFILE), { lightTh: LIGHT_TH, weatherBalance: WEATHER_BAL });
  const io = { light, growth: standGrowth(opt.seed || 1) };

  const S = newState({ mode: 'novice', room: 'banjiha', firstPlay: true, firstPlayRules: RULES });
  const ts = S.tutorial;
  ts.rules = rulesOf(opt.cand, litHours);      /* ★ 메모리 주입 — 여기가 이 도구의 전부다 */
  ts.lamp.litHours = litHours;
  S.lamps.litHours = litHours;

  placeBeansprout(S.firstPlay, DARK, { slots: light.room.slots });

  const rows = [];
  let lampDay = null, brokeDay = null;
  let powerNominal = 0;    // 명목 — 매긴 전기세의 합
  let powerPaid = 0;       // ★실제 — 잔액이 0으로 깎이며 삼켜진 몫을 뺀 값
  const sell = c => { const r = sellCutting(S, c.id); return r.won; };

  for (let d = 1; d <= (opt.days || 300); d++) {
    /* ⚠ **`waterPot` 이 빠지면 아무 일도 안 일어난다.** 물이 안 든 화분은 생장이 통째로 막히고
       (loop.js §dryBlocked), 그러면 첫 플레이가 안 끝나 **튜토 시계가 시작조차 안 한다** —
       실제로 이 도구를 처음 돌렸을 때 300일이 다 지나도 `ts.day` 가 0 이었다.
       `tools/probe_lamp_econ.mjs`(2026-08-06)에는 이 줄이 없다. 물주기가 그 뒤에 규칙이 됐다. */
    try { waterCrop(S); } catch { /* 아직 안 놓은 시루 */ }
    try { waterPot(S); } catch { /* 아직 없거나 안 놓은 화분 */ }
    const cashBefore = ts.cashWon;
    const turn = nextDay(S, io).turn;
    /* ★★ 실제로 낸 전기세 — 「명목 전기세」와 「잔액이 실제로 준 만큼」 중 작은 쪽이다.
       0원으로 사는 날은 지출이 통째로 clamp 에 삼켜지므로 전기세도 공짜가 된다.
       나눠 낼 근거가 없으니 **전기세를 마지막 원으로 친다**(가장 관대한 셈) — 즉 여기서
       나오는 「실제」는 상한이다. 그래도 명목보다 훨씬 작으면 삼켜진 것이 맞다. */
    const t = turn && turn.tutorial;
    const nominal = (t && t.electricityWon) || 0;
    powerNominal += nominal;
    const drop = Math.max(0, cashBefore - ts.cashWon);
    powerPaid += Math.min(nominal, drop);

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

    if (opt.buyLamp && ts.lamp.unlocked && ts.lamp.owned < (opt.lamps || 1) &&
        ts.cashWon >= ts.rules.lampPriceWon) {
      buyLamp(ts); S.lamps.count = ts.lamp.owned; light.clearCache();
      if (lampDay == null) lampDay = ts.day;
    }

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
           lampDay, brokeDay, powerNominal, powerPaid,
           eff: io.growth.growthDays(), leaves: io.growth.leafStats().leaves,
           varieGrants: (ts.varieGrant || {}).count || 0,
           brokeDays: rows.filter(r => r.bankrupt).length,
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
    medNominal: median(runs.map(r => r.powerNominal)),
    medPaid: median(runs.map(r => r.powerPaid)),
    medGrants: median(runs.map(r => r.varieGrants)),
    medBrokeDays: median(runs.map(r => r.brokeDays)),
    medLamps: median(runs.map(r => r.boughtLamps))
  };
}

const won = v => v == null ? '—' : Math.round(v).toLocaleString();
const pct = (a, b) => (a / b * 100).toFixed(1) + '%';

/* ══════════════════════════════════════════════════════════════════════════ */
console.log('══ 전기세를 얼마나 올리면 아픈가 (probe_elec) ═════════════════════');
console.log(`★ 표본 ${SEED_N}판 · 반지하 · 몬스테라 창턱 · 콩나물 서랍장 · 최대 300일`);
console.log(`★ 하루 지출(월세 몫 뺀 실지출) = ${won(DAILY_OUT)}원 · 이사 자금 ${won(MOVE_OUT_WON)}원`);
console.log('');

/* ── §1 하루 전기세 — 후보별 · 즉시 나온다 ─────────────────────────────── */
console.log('── §1 하루 전기세 ──────────────────────────────────────────────────');
{
  const old = { ...TUTORIAL_RULES, lampWattsByOrder: null, lampWatt: 12 };
  console.log(`  ★고치기 전(12W 고정): 등1·12h ${dayWon(old, 1, 12)}원 · 등2·24h ${dayWon(old, 2, 24)}원`);
  console.log(`  ★고친 뒤(바 20W·집게 12W): 등1·12h ${dayWon(TUTORIAL_RULES, 1, 12)}원 · ` +
              `등2·24h ${dayWon(TUTORIAL_RULES, 2, 24)}원  ← 방 프로파일 [${BASE_PROFILE.lampWatts.join(', ')}]W 와 같다`);
  console.log('');
  console.log('| 후보 | 등1·12h | 등2·12h | 등1·24h | 등2·24h | 하루지출 대비(등2·24h) |');
  console.log('|------|---------|---------|---------|---------|------------------------|');
  for (const c of CANDS) {
    const R = rulesOf(c);
    console.log(`| ${(c.id + ' ' + c.ko).padEnd(38)} | ${String(dayWon(R, 1, 12)).padStart(7)} | ` +
      `${String(dayWon(R, 2, 12)).padStart(7)} | ${String(dayWon(R, 1, 24)).padStart(7)} | ` +
      `${String(dayWon(R, 2, 24)).padStart(7)} | ${pct(dayWon(R, 2, 24), DAILY_OUT).padStart(6)} |`);
  }
}
if (ONLY === '1') { console.log(`\n(${((Date.now() - T0) / 1000).toFixed(0)}초)`); process.exit(0); }

/* ── §2 후보별 실측 ───────────────────────────────────────────────────── */
console.log('');
console.log('── §2 실측 — 이사일 · 등 이득비 · 실제로 낸 전기세 ────────────────');
console.log('| 후보 | A이사 | B이사 | B2이사 | 등이득 | 판정 | 파산 A/B | 명목 B2 | ★실제 B2 | 0원날 B2 | 무늬 B2 |');
console.log('|------|-------|-------|--------|--------|------|----------|---------|----------|----------|---------|');
const results = [];
for (const c of CANDS) {
  const A  = route({ cand: c, buyLamp: false, litHours: 12 });
  const B  = route({ cand: c, buyLamp: true, lamps: 1, litHours: 12 });
  const B2 = route({ cand: c, buyLamp: true, lamps: 2, litHours: 24 });   // 최대치로 켠 판
  const gain = (A.medDay != null && B.medDay) ? A.medDay / B.medDay : null;
  const verdict = gain == null ? '못 잼' : gain < 1.02 ? '★등이 죽었다' : gain > 2.00 ? '★너무 세다' : '살아 있다';
  results.push({ c, A, B, B2, gain });
  console.log(
    `| ${(c.id).padEnd(4)} | ${String(A.medDay ?? '못나감').padStart(5)} | ${String(B.medDay ?? '못나감').padStart(5)} | ` +
    `${String(B2.medDay ?? '못나감').padStart(6)} | ${gain == null ? '  —  ' : '×' + gain.toFixed(2)} | ` +
    `${verdict.padEnd(12)} | ${String(A.medBroke ?? '—').padStart(3)}/${String(B.medBroke ?? '—').padStart(3)} | ` +
    `${won(B2.medNominal).padStart(7)} | ${won(B2.medPaid).padStart(8)} | ` +
    `${String(B2.medBrokeDays).padStart(8)} | ${String(B2.medGrants).padStart(7)} |`);
}

/* ── §3 ★올린 것이 어디로 갔나 — clamp 가 삼킨 몫 ─────────────────────── */
console.log('');
console.log('── §3 ★명목과 실제가 갈리는 폭 = 0원 clamp 가 삼킨 몫 ─────────────');
console.log('| 후보 | 명목 전기세(B2) | 실제로 낸 것 | 삼켜진 몫 | 이사일 변화(B 기준선 대비) |');
console.log('|------|-----------------|--------------|-----------|----------------------------|');
const base = results[0];
for (const r of results) {
  const eaten = r.B2.medNominal ? (1 - r.B2.medPaid / r.B2.medNominal) : 0;
  const dB = (r.B.medDay != null && base.B.medDay != null) ? r.B.medDay - base.B.medDay : null;
  console.log(`| ${r.c.id.padEnd(4)} | ${won(r.B2.medNominal).padStart(15)} | ${won(r.B2.medPaid).padStart(12)} | ` +
    `${(eaten * 100).toFixed(0).padStart(8)}% | ${dB == null ? '—' : (dB >= 0 ? '+' : '') + dB + '일'} |`);
}
console.log('');
console.log(`(${((Date.now() - T0) / 1000).toFixed(0)}초 · 표본 ${SEED_N}판)`);
