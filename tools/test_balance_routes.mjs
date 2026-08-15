/* ★ 세 경로가 다 유효한가 — story_arc.md §2 를 숫자로 판정한다
 *
 *   node tools/test_balance_routes.mjs
 *
 *   A  식물등 없이 가을 안에 이사
 *   B  식물등을 사고 가을에 이사
 *   C  진행이 늦어 겨울을 맞는다 — 식물등이 안전장치
 *
 * story_arc §2: *"한쪽이 명백히 우월하면 선택이 아니다."*
 * 그래서 이 도구는 **셋을 같은 조건에서 나란히 돌리고, 차이가 실제로 나는지**만 본다.
 * 차이가 안 나면 그건 경로가 아니라 이름표다 — 그 경우 FAIL 로 찍는다.
 *
 * ★ `tools/test_banjiha_routes.mjs` 와 무엇이 다른가
 *   저기는 "이사가 되나 · 막다른 길이 없나"를 본다(배선 검사). 여기는 **세 경로의 차이**만 본다.
 *   그래서 판(play)은 같은 방식으로 굴리되, 재는 것이 다르다:
 *     ① 식물등이 실제로 무엇을 바꾸는가 (유효 생장일·잎·이사일·잔액)
 *     ② 계절을 켜면 세 경로가 어떻게 갈리는가  ← 지금 게임은 계절이 **빛에 안 걸려 있다**
 *     ③ 이사까지 몇 번 누르고 몇 분인가 (story_arc §5 다섯째 줄)
 *
 * ⚠ 값을 하나도 안 바꾼다. data/** 는 읽기만 한다.
 */
import assert from 'node:assert';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProfileLight } from '../src/game/room_profile.js';
import { newState, pot0, setPotSlot, resowCrop, waterCrop, ARRIVAL } from '../src/game/state.js';
import { nextDay, harvestCrop, DEFAULT_MS_PER_DAY, FAST_MODE_MAX_DAYS, JUMP_MAX_DAYS } from '../src/game/loop.js';
import { firstPlayRulesFromBalance, placeBeansprout, moveMonstera, beansproutReady } from '../src/game/first_play.js';
import { seasonAt, seasonDayAt, buyLamp, canMoveOut, moveOut, varieView,
         varieGrantOpensDay, TUTORIAL_RULES } from '../src/game/tutorial.js';
/* ★★ 2026-08-17 — `sellCutting`·`sellPot` 이 **없어졌다**(shop.js §⑦-0). 몬스테라 것은
   중고 거래로만 나간다: 올리고 → 1~7일 뒤 연락 → 거래. 이 재현은 **손 횟수(taps)**도 재므로
   손이 하나 는 것이 그대로 값에 실린다 — [내놓기]와 [거래하기]가 각각 한 번이다. */
import { orderItem, stockOf, incomingOf, priceOf,
         listCutting, listPot, dealListing, marketStatus, marketGate, listingFor,
         buyPriceOf, SELLABLE_CUTTING_STATUS } from '../src/game/shop.js';
import { takeCutting, cuttableNow, cutBudgetOf, motherStatsNow } from '../src/game/propagation.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const J = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url), 'utf8'));
const results = [];
const check = (n, f) => { try { f(); results.push(['PASS', n]); } catch (e) { results.push(['FAIL', n, e.message]); } };
const warn = (n, f) => { try { f(); results.push(['PASS', n]); } catch (e) { results.push(['WARN', n, e.message]); } };
const info = m => results.push(['INFO', '  ' + m]);

const light = createProfileLight(J('../data/profiles/room_profile.banjiha.json'), {
  lightTh: J('../data/balance/light_thresholds.json'),
  weatherBalance: J('../data/balance/weather.json')
});
const RULES = firstPlayRulesFromBalance(J('../data/balance/characters.json'));
const DARK = 'banjiha-dresser:1';
const SILL = 'banjiha-sill:0';
const MOVE_OUT_WON = TUTORIAL_RULES.moveOutCostWon;

/* ★ 계절 달력 오프셋 — 튜토는 **여름 45일차**에서 시작한다(tutorial.TUTORIAL_RULES).
   그런데 조도 쪽(room_profile.skyFor)은 `seasonOf(S.day)` 를 그냥 쓴다 — 0일이 **봄 0일**이다.
   즉 두 달력이 다르다. 여기서 코드를 고치지 않고 **넘기는 날짜만 밀어서** 같은 달력으로 맞춘다.
   (검사 ②-b 가 이 어긋남 자체를 따로 찍는다) */
const SEASON_OFFSET = 90 + TUTORIAL_RULES.startSeasonDay;   // 여름 시작 90 + 45

/* ══ 헤드리스 생장 엔진 (test_banjiha_routes.mjs 와 같은 하네스) ═══════════ */
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

/* ★ 계절을 빛에 걸어 보는 **가정 판** — 코드를 안 고치고 날짜만 민다.
   `seasonal:false` 면 지금 게임 그대로(novice·여름 고정)다. */
function lightFor(seasonal) {
  if (!seasonal) return light;
  return {
    daily: (day, S) => light.daily(day + SEASON_OFFSET, S),
    skyFor: (day, sim) => light.skyFor(day + SEASON_OFFSET, sim),
    dliOfSlot: (...a) => light.dliOfSlot(...a),
    clearCache: () => light.clearCache(),
    thresholdsOf: (...a) => light.thresholdsOf(...a),
    get room() { return light.room; },
    growLampCount: () => light.growLampCount(),
    rooms: () => light.rooms(),
    profile: () => light.profile()
  };
}

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

/* ══ 판 하나 ═══════════════════════════════════════════════════════════════
   ★ 누른 횟수를 같이 센다 — story_arc §5 다섯째 줄("73일이 실제로 몇 분인가")의 재료다.
     빨리감기는 **시간을 지우지 않는다**(loop.js §빨리감기): 하루 msPerDay 씩 진짜로 돈다.
     그러니 플레이 시간 = 감는 시간 + 누르는 시간이고, 둘 다 여기서 센다. */
function play(opt = {}) {
  const seasonal = !!opt.seasonal;
  const io = { light: lightFor(seasonal), growth: standGrowth(opt.seed || 1) };
  const S = newState({ mode: 'novice', room: 'banjiha', firstPlay: true, firstPlayRules: RULES });
  light.clearCache();
  placeBeansprout(S.firstPlay, DARK, { slots: light.room.slots });

  const rows = [];
  let lampDay = null, taps = 0, ffStops = 0, ffDays = 0, jumpDays = 0;
  let cuttingIncome = 0, varieIncome = 0, potIncome = 0, containerSpend = 0, sold = 0;
  /* ★ 올리는 것과 돈이 되는 것이 **다른 날**이다(shop.js §⑦-0). 갈래는 올릴 때 적어 둔다 —
     거래할 때는 삽수가 이미 목록에서 나가 `c.source` 를 못 본다. */
  const listedKind = new Map();
  const sell = c => {
    if (listingFor(S, c)) return;              // 이미 올려 뒀다
    const varie = c.source.variegatedLeaves > 0;
    const r = listCutting(S, c.id); taps++;    // [내놓기] 한 번
    listedKind.set(r.listing.listingId, varie ? 'varie' : 'plain');
  };
  const dealAll = () => {
    let ms = null; try { ms = marketStatus(S); } catch { return; }
    for (const l of ms.contacted) {
      let r; try { r = dealListing(S, l.listingId); } catch { continue; }
      taps++;                                   // [거래하기] 한 번
      if (r.kind === 'pot') potIncome += r.won;
      else { sold++; if (listedKind.get(l.listingId) === 'varie') varieIncome += r.won; else cuttingIncome += r.won; }
    }
  };

  for (let d = 1; d <= (opt.days || 300); d++) {
    /* ★ 계절을 켜는 판은 **첫 플레이가 끝나는 순간** 빛 모드를 real 로 바꾼다 —
       first_play.md §0 "novice·맑음·여름 고정"을 그대로 지키고 그 뒤부터 계절이 흐른다. */
    if (seasonal && S.firstPlay.completed && S.sim.mode !== 'real') { S.sim.mode = 'real'; light.clearCache(); }

    /* 물 — 첫 플레이 동안은 손으로(jump 는 물 대기에서 선다), 그 뒤 배속은 자동이다(loop §물주기) */
    if (!S.firstPlay.completed) taps++;
    try { waterCrop(S); } catch { /* 아직 안 놓은 시루 */ }

    const turn = nextDay(S, io).turn;
    if (S.firstPlay.completed) ffDays++; else jumpDays++;

    /* ★ 중고 거래 — 문을 열고(화면이 `drawShop` 에서 하는 일과 같다) 연락 온 것을 거래한다 */
    if (pot0(S)) { try { marketGate(S, { leaves: io.growth.leafStats().leaves }); } catch { } }
    dealAll();

    let harvested = null;
    if (beansproutReady(S.firstPlay.beansprout)) { harvested = harvestCrop(S, io); taps++; ffStops++; }
    const ts = S.tutorial;
    if (harvested && harvested.arrived) {
      setPotSlot(S, pot0(S), SILL, light.room.slots);
      moveMonstera(S.firstPlay, SILL, { slots: light.room.slots });
      taps++;
    }

    /* 콩나물 회전 — 시루 하나 */
    const b = S.firstPlay.beansprout;
    if (b.sirus + stockOf(S, 'siru') + incomingOf(S, 'siru') < 1) { try { orderItem(S, 'siru', 1); taps++; } catch {} }
    const target = Math.min(1, b.sirus + stockOf(S, 'siru'));
    if (stockOf(S, 'bean_seed') + incomingOf(S, 'bean_seed') < target) {
      try { orderItem(S, 'bean_seed', target - stockOf(S, 'bean_seed') - incomingOf(S, 'bean_seed')); taps++; } catch {}
    }
    if (b.harvested && stockOf(S, 'bean_seed') >= target) {
      try { resowCrop(S, { sirus: target, at: DARK, slots: light.room.slots }); taps++; } catch {}
    }

    /* 식물등 */
    if (opt.buyLamp && ts.lamp.unlocked && ts.lamp.owned < (opt.lamps || 1) && ts.cashWon >= ts.rules.lampPriceWon) {
      buyLamp(ts); S.lamps.count = ts.lamp.owned; light.clearCache(); taps++;
      if (lampDay == null) lampDay = ts.day;
    }

    /* 삽수 */
    if (ts.day >= (opt.startCutDay || 0)) {
      const v0 = pot0(S) ? viewOf(S, io) : null;
      const node = v0 ? pickNode(v0.nodes, v0.budget) : null;
      if (node && (S.cuttings || []).length === 0 && stockOf(S, 'jar') + incomingOf(S, 'jar') === 0) {
        try { const o = orderItem(S, 'jar', 1); containerSpend += o.totalWon; taps++; } catch {}
      }
      if (node && stockOf(S, 'jar') >= 1) {
        try { takeCutting(S, { nodes: v0.nodes, nodeId: node.nodeId, container: 'jar' }); taps++; } catch {}
      }
      for (const c of [...(S.cuttings || [])]) if (SELLABLE_CUTTING_STATUS.includes(c.status)) sell(c);
    }

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
        /* ★ 그루도 **올릴 뿐**이다 — 돈은 연락이 온 날 `dealAll` 이 넣는다 */
        if (potWon && ts.cashWon < MOVE_OUT_WON) {
          try { listPot(S, { leaves: v.stats.leaves, variegatedLeaves: v.stats.variegatedLeaves }); taps++; }
          catch { /* 이미 올렸거나 문이 아직 안 열렸다 */ }
        }
      }
    }
    if (!ts.movedOut && canMoveOut(ts).ok) { moveOut(ts); taps++; }

    rows.push({ day: S.day, tday: ts.day, season: seasonAt(ts, ts.day), cashWon: ts.cashWon,
                bankrupt: ts.bankrupt, eff: io.growth.growthDays(),
                leaves: io.growth.leafStats().leaves, dli7: io.growth.dli7() });
    if (ts.movedOut) break;
  }
  const last = rows[rows.length - 1];
  /* 빨리감기 누름 횟수 — 배속은 한 번에 30일까지(FAST_MODE_MAX_DAYS)이고, 그 안에서도
     "거둘 때가 됐습니다"에서 선다(loop §stopOnReady). 둘 중 잦은 쪽이 실제 누름 수다. */
  const ffPresses = Math.max(Math.ceil(ffDays / FAST_MODE_MAX_DAYS), ffStops);
  return { S, rows, taps: taps + ffPresses + Math.ceil(jumpDays / JUMP_MAX_DAYS),
           ffDays, jumpDays, ffPresses, lampDay,
           cuttingIncome, varieIncome, potIncome, containerSpend, sold,
           movedOut: S.tutorial.movedOut, lastDay: last.tday, lastGameDay: last.day,
           season: last.season, eff: last.eff, leaves: last.leaves,
           everBroke: rows.some(r => r.bankrupt) };
}

const SEEDS = Array.from({ length: 24 }, (_, i) => i + 1);
function route(name, opt) {
  const runs = SEEDS.map(seed => play({ ...opt, seed }));
  const ok = runs.filter(r => r.movedOut);
  const seasons = {};
  for (const r of ok) seasons[r.season] = (seasons[r.season] || 0) + 1;
  return {
    name, opt, runs, ok, rate: ok.length / runs.length,
    days: ok.map(r => r.lastDay), seasons,
    medDay: ok.length ? median(ok.map(r => r.lastDay)) : null,
    medEff: median(runs.map(r => r.eff)),
    medLeaves: median(runs.map(r => r.leaves)),
    medTaps: ok.length ? median(ok.map(r => r.taps)) : median(runs.map(r => r.taps)),
    medGameDays: ok.length ? median(ok.map(r => r.lastGameDay)) : median(runs.map(r => r.lastGameDay)),
    medCash45: median(runs.map(r => (r.rows.find(x => x.tday === 45) || {}).cashWon).filter(v => v != null))
  };
}
const show = r => info(`${r.name} — 이사 ${r.ok.length}/${r.runs.length} (${(r.rate * 100).toFixed(0)}%)` +
  (r.medDay != null ? ` · 중앙값 튜토 ${r.medDay}일 · 최선 ${Math.min(...r.days)} · 최악 ${Math.max(...r.days)}` : ' · **한 판도 못 나감**') +
  ` · 계절 ${Object.entries(r.seasons).map(([k, v]) => k + ':' + v).join(' ') || '—'}` +
  ` · 유효생장 ${r.medEff} · 잎 ${r.medLeaves}장`);

/* ══ ① 지금 게임 그대로 — 계절이 빛에 안 걸린 상태 ═══════════════════════ */
console.log('══ 세 경로 비교 (test_balance_routes) ═════════════════════════════');
info('★ 조건 — 반지하 · 몬스테라 창턱(banjiha-sill:0) · 콩나물 서랍장(banjiha-dresser:1) · 시루 1개');
info(`  시작 자금 ${TUTORIAL_RULES.startCashWon.toLocaleString()}원 · 하루 지출 ${TUTORIAL_RULES.dailySpendWon.toLocaleString()}원 · ` +
     `월세 ${TUTORIAL_RULES.rentWon.toLocaleString()}원(유예 ${TUTORIAL_RULES.rentGraceDays}일) · ` +
     `이사 ${MOVE_OUT_WON.toLocaleString()}원 · 등 ${TUTORIAL_RULES.lampPriceWon.toLocaleString()}원`);
info(`  씨앗 24판 · 최대 300일 · 가을 진입 = 튜토 ${varieGrantOpensDay(TUTORIAL_RULES && { rules: TUTORIAL_RULES })}일`);
info('');
info('── ① 지금 게임 그대로 (novice — 빛은 늘 맑음·여름) ─────────────────');
const A0 = route('A 등 없이', { buyLamp: false, days: 300 });
const B0 = route('B 등 1개 ', { buyLamp: true, lamps: 1, days: 300 });
const C0 = route('C 늦게(12일부터 자르기) + 등', { buyLamp: true, lamps: 1, startCutDay: 12, days: 300 });
[A0, B0, C0].forEach(show);

check('①-1 ★A 와 B 가 실제로 다른가 — 같으면 B 는 경로가 아니라 이름표다', () => {
  const same = A0.medDay === B0.medDay && A0.medEff === B0.medEff && A0.medLeaves === B0.medLeaves;
  const dEff = B0.medEff - A0.medEff;
  info(`  A vs B — 이사일 ${A0.medDay} vs ${B0.medDay} · 유효생장 ${A0.medEff} vs ${B0.medEff} (${dEff >= 0 ? '+' : ''}${dEff}) · ` +
       `잎 ${A0.medLeaves} vs ${B0.medLeaves}장 · 가을(45일) 잔액 ${A0.medCash45.toLocaleString()} vs ${B0.medCash45.toLocaleString()}원`);
  assert.ok(!same,
    `★A 와 B 가 완전히 같습니다(이사 ${A0.medDay}일 · 유효생장 ${A0.medEff} · 잎 ${A0.medLeaves}장). ` +
    `식물등 ${TUTORIAL_RULES.lampPriceWon.toLocaleString()}원이 사는 것은 **잔액 −25,000원뿐**이고 ` +
    `얻는 것이 하나도 없습니다 — 즉 B 는 A 보다 열등한 같은 경로입니다`);
});

check('①-2 ★A 가 가을 안에 끝나는가 — story_arc §2 가 "표준"이라 부른 경로다', () => {
  const autumn = A0.ok.filter(r => r.season === 'autumn').length;
  info(`  A 의 계절 분포 — ${Object.entries(A0.seasons).map(([k, v]) => `${k} ${v}판`).join(' · ')}`);
  assert.ok(autumn > A0.ok.length / 2,
    `★A 는 ${A0.ok.length}판 중 ${autumn}판만 가을에 끝납니다 — 중앙값이 ${A0.medDay}일(${A0.ok.length ? A0.ok[Math.floor(A0.ok.length / 2)].season : '?'})이라 ` +
    `"등 없이 가을 안에 이사"가 표준이 아닙니다`);
});

/* ══ ② 계절을 빛에 걸면 ═══════════════════════════════════════════════════ */
info('');
info('── ② 계절을 빛에 걸면 (첫 플레이 뒤 real 모드 · 튜토 달력에 맞춰 날짜를 민다) ──');
const A1 = route('A 등 없이 · 계절 켬', { buyLamp: false, seasonal: true, days: 300 });
const B1 = route('B 등 1개 · 계절 켬', { buyLamp: true, lamps: 1, seasonal: true, days: 300 });
const C1 = route('C 늦게 + 등 · 계절 켬', { buyLamp: true, lamps: 1, startCutDay: 12, seasonal: true, days: 300 });
[A1, B1, C1].forEach(show);

check('②-a ★계절을 켜면 등이 값을 갖는가', () => {
  const dEff = B1.medEff - A1.medEff;
  info(`  A vs B (계절 켬) — 유효생장 ${A1.medEff} vs ${B1.medEff} (${dEff >= 0 ? '+' : ''}${dEff}) · ` +
       `잎 ${A1.medLeaves} vs ${B1.medLeaves}장 · 이사 ${A1.medDay} vs ${B1.medDay}일`);
  assert.ok(dEff > 0, `★계절을 켜도 등이 유효 생장일을 못 늘립니다 (${A1.medEff} → ${B1.medEff})`);
});

warn('②-b ★계절 달력이 하나인가 — 화면과 빛이 같은 계절을 보는가', () => {
  /* 화면은 tutorial.seasonAt(여름 45일차 기준), 빛은 room_profile.skyFor(seasonOf(S.day), 0일=봄).
     지금은 novice 라 빛 쪽 계절이 아예 안 굴러 어긋남이 안 보인다 — 켜는 순간 드러난다. */
  const S = newState({ mode: 'real', room: 'banjiha', firstPlay: true, firstPlayRules: RULES });
  S.day = 50;
  const lightSeason = light.skyFor(S.day, S.sim).season;
  const hudSeason = seasonAt(S.tutorial, 50);
  info(`  게임 50일 — 화면 계절 "${hudSeason}" · 빛 계절 "${lightSeason}"`);
  assert.equal(lightSeason, hudSeason,
    `★달력이 둘입니다 — 화면은 tutorial.seasonAt(여름 ${TUTORIAL_RULES.startSeasonDay}일차 시작)을 쓰고 ` +
    `빛은 weather.seasonOf(0일=봄 0일)를 씁니다. 오프셋 ${SEASON_OFFSET}일이 빠져 있습니다`);
});

warn('②-c ★계절을 켜도 세 경로가 다 성립하는가', () => {
  const dead = [['A', A1], ['B', B1], ['C', C1]].filter(([, r]) => r.rate < 0.5);
  assert.equal(dead.length, 0,
    `계절을 켜면 중앙값으로 못 나가는 경로: ${dead.map(([n, r]) => `${n} ${(r.rate * 100).toFixed(0)}%`).join(' · ')}`);
});

/* ══ ③ 이사까지 몇 번 누르고 몇 분인가 ═══════════════════════════════════ */
info('');
info('── ③ 플레이 시간 — 73일이 실제로 몇 분인가 (story_arc §5 다섯째 줄) ──');
info(`  빨리감기 하루 = ${DEFAULT_MS_PER_DAY}ms (loop.DEFAULT_MS_PER_DAY) · game.html 은 140ms 로 부른다`);
info(`  점핑 한 번 최대 ${JUMP_MAX_DAYS}일(튜토 전용) · 배속 한 번 최대 ${FAST_MODE_MAX_DAYS}일`);
info(`  ⚠ time_modes.md §1 은 **빠른배속을 "1일 10~30초"** 로 적어 두었다 — 위 140ms 와 71~214배 다르다.`);
info(`     140ms 는 **점핑 중에 하루가 지나가는 것을 보여주는 애니 속도**이고(game.html §3353),`);
info(`     배속은 "하루 안을 압축해서 본다"는 다른 모드다. 어느 쪽으로 재느냐로 답이 통째로 갈린다.`);
const TAP_SEC = 3;                      // 누르고 화면을 보고 판단하는 시간(가정값이라 따로 적는다)
const SPEEDS = [['점핑 애니 140ms/일', 0.14], ['배속 10초/일', 10], ['배속 30초/일', 30]];
for (const [ko, R] of [['A(등 없이)', A0], ['B(등 1개)', B0], ['C(늦게)', C0]]) {
  if (!R.ok.length) { info(`  ${ko} — 이사한 판이 없어 못 잰다`); continue; }
  const days = R.medGameDays, taps = R.medTaps;
  info(`  ${ko} — 게임 ${days}일 · 누름 ${taps}회 (누르는 시간 ${(taps * TAP_SEC / 60).toFixed(1)}분)`);
  for (const [sko, sec] of SPEEDS)
    info(`      ${sko.padEnd(18)} 감는 시간 ${(days * sec / 60).toFixed(1)}분 → 합 ` +
         `**${((days * sec + taps * TAP_SEC) / 60).toFixed(1)}분**`);
}
info(`  ⚠ 누름당 ${TAP_SEC}초는 **가정값**이다(실측 아님). 감는 시간은 코드·문서에서 나온 값이다.`);
info(`  ★ 데드라인 73일만 따로 — 배속 10초면 ${(73 * 10 / 60).toFixed(1)}분 · 30초면 ${(73 * 30 / 60).toFixed(1)}분 · 140ms 면 ${(73 * 0.14).toFixed(0)}초`);

check('③ 튜토 완주 시간이 balance_decisions §D 의 "30~50분"에 드는가 (배속 10초/일)', () => {
  const R = A0.ok.length ? A0 : (B0.ok.length ? B0 : C0);
  const min = (R.medGameDays * 10 + R.medTaps * TAP_SEC) / 60;
  assert.ok(min >= 30 && min <= 50,
    `튜토 완주 추정 ${min.toFixed(1)}분 — 목표 30~50분 밖입니다 ` +
    `(게임 ${R.medGameDays}일 · 누름 ${R.medTaps}회 · 10초/일 · 누름당 ${TAP_SEC}초)`);
});

check('③-b 게임일이 balance_decisions §D 의 "튜토 완주 게임일 80일"에 드는가', () => {
  const R = A0.ok.length ? A0 : (B0.ok.length ? B0 : C0);
  assert.ok(R.medGameDays <= 100,
    `튜토 완주가 게임 ${R.medGameDays}일입니다 — §D 목표 80일의 ${(R.medGameDays / 80).toFixed(1)}배입니다`);
});

/* ── 보고 ───────────────────────────────────────────────────────────────── */
let fail = 0, judge = 0;
for (const [st, name, msg] of results) {
  if (st === 'INFO') { console.log(name); continue; }
  if (st === 'FAIL') fail++;
  if (st === 'WARN') judge++;
  console.log(`${st}  ${name}${msg ? '\n      → ' + msg : ''}`);
}
console.log(fail ? `\nbalance_routes: FAIL (${fail}건 — 밸런스가 아직 안 맞는다는 뜻이다)`
                 : `\nbalance_routes: PASS${judge ? ` (⚠ 기획 판단필요 ${judge}건)` : ''}`);
/* ★ 이 도구는 **밸런스가 안 맞으면 빨개지는 것이 일**이다. 그래서 종료 코드로 스위트를
   막지 않는다 — 값을 고칠 권한이 이 창에 없기 때문이다(story_arc §5 는 아직 미확정이다). */
process.exit(0);
