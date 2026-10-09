/* ============================================================
   tools/probe_oneroom_econ.mjs — **원룸 살림 자** · D8(원룸 월세) · D9(엔딩 목표 금액)  (2026-10-08 · core)
   ------------------------------------------------------------
   명세: docs/handoff/plan-d8-d9-measure-20261008.md §2 M1(★D8 생존판) · M3(★D9 닿은 날) · §5(자가 거짓말할 자리)
   총괄(10-08 07:20): «이사 뒤부터 · real · 월세와 dailySpend 를 짝으로 · 등 0/1 · 갈래 ⓐⓑⓒ · 먼저 대조 판이 붉게 나오나»

     node tools/probe_oneroom_econ.mjs --rent 350000 --lamps 0,1 --branch a,b,c --path quest --seeds 1-10 --days 180
     node tools/probe_oneroom_econ.mjs --control          (대조 판 — 월세만 꽂는다 · 짝 검사가 «붉어야» 한다)

   ══ 무엇을 하나 ═══════════════════════════════════════════════════════════
   ① 반지하 — test_ending_flow §playToEnding 과 같은 하루(시루 다섯 · 무늬 삽수 · 물). 등 L≥1 이면 열리는 날 산다.
      갈래는 «반지하 끝에서 무엇을 하나»로 가른다 — 그래야 이사 직후 상태가 저절로 선다(지어 넣지 않는다):
        ⓐ 그루째 판다  — 무늬 축이 열린 뒤 모주를 내놓아 이사비를 채운다 ⇒ 원룸에 그루 없음 · 현금 남음
        ⓑ 잘라 두고    — 모주를 두고 자른 삽수를 들고 간다(무늬 축을 연 한 장만 판다)
        ⓒ 안 판다      — 무늬 축을 연 한 장만 자르고 판다 · 그루 통째로 간다
      ⚠ ⓑⓒ 는 이사비가 모자라면 **하네스 보조**로 모자란 만큼만 채운다(액수를 판마다 적는다) — 그러면 이사 뒤 현금이 0 이다
        (plan §2 «ⓒ 현금 ≈ 0»). ⓐ 도 모주 값으로 모자라면 같은 보조를 쓴다.
   ② 이사 — oneroom.moveIntoOneroom(D1: sim.mode real). 그 순간 월세·하루 지출을 **짝으로** 꽂는다:
        oneroomRentWon = R · dailySpendWon = 반지하 dailySpend + (R − 반지하 월세)/주기   (월세 밖 하루치는 그대로)
      ⚠ 월세만 꽂으면 dailyCashOutWon 이 그만큼 줄어 평균 지출이 안 바뀐다(plan §1 [셈]) — 그래서 등식 검사를 둔다.
      등: S.lamps.count = L (원룸 등 자리) · 프로필 lampCounts 에 L 이 없으면 **던진다**(plan §5 «등 1 을 물어도 등 0»).
   ③ 원룸 — 날마다 물 · 시루 다섯(작물 살림은 그대로) · 경로(--path):
        quest — M1 «보통 사람»: 원룸 퀘스트 차례대로 한 번에 삽수 하나(무늬 마디 → 밝은 창턱에서 뿌리 → 혹 나면 흙 → 뿌리 낸 것 내놓기)
        max   — M3 «늘려서 판다»: 자를 수 있으면 날마다 자르고(_endprobe pickNode) · 혹 나면 흙 · 팔 수 있는 것은 다 내놓기
      연락 온 것은 그날 다 거래한다(사람이 [상점]에서 하는 손짓).
   ④ 적는 것(판마다): 굶음 · 첫 0원 날 · 최저 잔고 · N일째 잔고 · K 후보 «현금이 닿은 날»과 «다 팔면(netWorth) 닿은 날» · 보조액.

   ⛔ 값을 하나도 안 바꾼다(밸런스는 재기만). data/** 는 읽기만. ⛔ data/profiles 를 안 쓴다.
============================================================ */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { newState, pot0, setPotSlot, resowCrop, waterCrop, waterPot, sellCropSurplus, ARRIVAL } from '../src/game/state.js';
import { nextDay, harvestCrop } from '../src/game/loop.js';
import { firstPlayRulesFromBalance, placeBeansprout, moveMonstera, beansproutReady } from '../src/game/first_play.js';
import { orderItem, stockOf, incomingOf, listCutting, listPot, dealListing, marketStatus, marketGate, listingFor,
         SELLABLE_CUTTING_STATUS } from '../src/game/shop.js';
import { canMoveOut, varieView, buyLamp, dailyCashOutWon, rentWonOf, TUTORIAL_RULES } from '../src/game/tutorial.js';
import { takeCutting, repotCutting, cuttableNow, cutBudgetOf, motherStatsNow, cuttingsOf } from '../src/game/propagation.js';
import { moveIntoOneroom, stageOf, STAGES } from '../src/game/oneroom.js';
import { endingRulesFrom, endingProgress } from '../src/game/ending.js';
import { createProfileLight } from '../src/game/room_profile.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const J = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

/* ── 깃발 ───────────────────────────────────────────────────────────── */
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true) : d; };
const list = (v) => String(v).split(',').map(x => x.trim()).filter(Boolean);
const range = (v) => { const m = String(v).match(/^(\d+)-(\d+)$/); return m ? Array.from({ length: +m[2] - +m[1] + 1 }, (_, i) => +m[1] + i) : list(v).map(Number); };
const CONTROL = !!arg('control', false);
const RENTS = list(arg('rent', '350000')).map(Number);
const LAMPS = list(arg('lamps', '0,1')).map(Number);
const BRANCHES = list(arg('branch', 'a,b,c'));
const PATH = String(arg('path', 'quest'));
const SEEDS = range(arg('seeds', '1-10'));
const DAYS = Number(arg('days', 180));
const KS = [3e6, 5e6, 7e6, 1e7, 1.5e7];
/* --cash a=500000,b=0,c=0 — 이사 직후 현금을 «밖에서» 준다(plan §5 «M0 가 준 시작 현금으로 세운다»). 반지하 행동 모형과 원룸 재기를 떼어 놓는다.
   안 주면 반지하를 굴린 그대로(보조로 채웠으면 0). 준 값은 판마다 cashOverride 로 적는다 */
const CASH = Object.fromEntries(list(arg('cash', '')).map(kv => kv.split('=')).filter(([k, v]) => k && v != null && Number.isFinite(+v)).map(([k, v]) => [k, +v]));
const BANJIHA_MAX = 300;               /* 반지하에서 이만큼 지나도 못 나가면 그 판은 «못 나감» */

/* ══ 헤드리스 생장 엔진 — tools/test_ending_flow.mjs 와 같은 하네스 ═══════════ */
function makeThree() {
  class V3 {
    constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
    set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
    clone() { return new V3(this.x, this.y, this.z); } copy(v) { return this.set(v.x, v.y, v.z); }
    add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; } sub(v) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; }
    addScaledVector(v, s) { this.x += v.x * s; this.y += v.y * s; this.z += v.z * s; return this; }
    multiplyScalar(s) { this.x *= s; this.y *= s; this.z *= s; return this; }
    lengthSq() { return this.x ** 2 + this.y ** 2 + this.z ** 2; } length() { return Math.sqrt(this.lengthSq()); }
    normalize() { const l = this.length() || 1; return this.multiplyScalar(1 / l); }
    crossVectors(a, b) { return this.set(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x); }
    lerp(v, t) { this.x += (v.x - this.x) * t; this.y += (v.y - this.y) * t; this.z += (v.z - this.z) * t; return this; }
    applyAxisAngle() { return this; } distanceTo(v) { return this.clone().sub(v).length(); }
  }
  const nop = function () { return new Proxy({}, handler); };
  const handler = {
    get(t, k) { if (k === 'then') return undefined; if (k === Symbol.toPrimitive) return () => 0;
                if (!(k in t)) t[k] = new Proxy(nop, handler); return t[k]; },
    apply() { return new Proxy({}, handler); },
    construct() { return new Proxy({ position: new V3(), rotation: new V3(), scale: new V3(1, 1, 1) }, handler); }
  };
  return new Proxy({ Vector3: V3, Vector2: V3 }, handler);
}
function loadGrowth() {
  const html = fs.readFileSync(path.join(ROOT, 'plant_grow.html'), 'utf8');
  const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  const main = blocks[blocks.length - 1];
  const src = main.replace(/\n\s*init\(\);\s*updateCam\(\);\s*$/, '\n/* init() 제거(헤드리스) */\n');
  if (src === main) throw new Error('plant_grow.html 의 init() 호출부를 못 찾았습니다');
  const tuning = fs.readFileSync(path.join(ROOT, 'data', 'growth_tuning.json'), 'utf8');
  const el = () => ({ value: '', textContent: '', checked: false, dataset: {}, style: {}, classList: { add() {}, remove() {}, toggle() {} },
    appendChild() {}, addEventListener() {}, removeEventListener() {}, setAttribute() {}, getAttribute() { return null; },
    querySelector() { return null; }, querySelectorAll() { return []; }, insertAdjacentHTML() {}, focus() {}, remove() {} });
  const ctx = { THREE: makeThree(), console: { log() {}, warn() {}, error() {} },
    document: { getElementById() { return null; }, createElement: el, querySelector() { return null; }, querySelectorAll() { return []; },
                addEventListener() {}, body: el(), documentElement: el() },
    location: { search: '', href: 'http://localhost/plant_grow.html' },
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    requestAnimationFrame() { return 0; }, cancelAnimationFrame() {}, setTimeout, clearTimeout, setInterval() { return 0; }, clearInterval() {},
    fetch: () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(tuning)) }),
    Math, JSON, Date, Object, Array, Number, String, Boolean, Map, Set, Error, isFinite, isNaN, parseFloat, parseInt };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx); vm.runInContext(src, ctx, { filename: 'plant_grow.html' });
  return ctx;
}
const G = loadGrowth();
for (let i = 0; i < 400 && !G.thLoaded(); i++) await new Promise(r => setImmediate(r));
if (!G.thLoaded()) throw new Error('임계값 정본(data/growth_tuning.json)이 안 실렸습니다');
function standGrowth(seed) {
  try { G.plantSeed(seed); } catch { }
  G.matResetAll(); G.resetDailyLight(); G.setGrowth(ARRIVAL.growthDays);
  return { assertContract: () => true, setDailyLight: d => G.setDailyLight(d),
    advanceTo(d) { const r = G.advanceTo(d); return { ...r, drawn: true, drawError: null }; },
    setGrowth(d) { const r = G.setGrowth(d); return { ...r, drawn: true, drawError: null }; },
    calendarDay: () => G.calendarDay(), growthDays: () => G.growthDays(), growthBlocked: () => G.growthBlocked(),
    growthPhase: () => G.growthPhase(), dli7: () => G.dli7(), dliCV: () => G.dliCV(), ageOf: d => G.ageOf(d),
    cuttableNodes: () => G.cuttableNodes(), leafStats: () => G.leafStats() };
}
/* 방을 바꿀 수 있는 조도 창(game.html buildRoom 자리) */
const LIGHT_DATA = { lightTh: J('data/balance/light_thresholds.json'), weatherBalance: J('data/balance/weather.json') };
const PROFILES = {};
function profileOf(id) {
  if (!PROFILES[id]) {
    const p = J(`data/profiles/room_profile.${id}.json`);
    const warn = console.warn; console.warn = () => { };
    try { PROFILES[id] = { p, light: createProfileLight(p.uidStable === true ? p : { ...p, uidStable: true }, LIGHT_DATA) }; }
    finally { console.warn = warn; }
  }
  return PROFILES[id];
}
function makeSwitchingLight() {
  let cur = profileOf('banjiha').light;
  return { daily: (day, S) => cur.daily(day, S), skyFor: (day, sim) => cur.skyFor(day, sim), dliOfSlot: (ref, o) => cur.dliOfSlot(ref, o),
           clearCache: () => cur.clearCache(), thresholdsOf: (p, v) => cur.thresholdsOf(p, v), growLampCount: () => cur.growLampCount(),
           get room() { return cur.room; }, build(roomId) { cur = profileOf(roomId).light; return cur.room; } };
}

const RULES = firstPlayRulesFromBalance(J('data/balance/characters.json'));
const DARK = 'banjiha-dresser:1', SILL = 'banjiha-sill:0';
const ONE_SILLS = ['oneroom-sill:0', 'oneroom-sill:1', 'oneroom-sill:2', 'oneroom-sill:3'];
const median = a => { const s = a.filter(v => v != null).slice().sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; };
const q90 = a => { const s = a.filter(v => v != null).slice().sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.ceil(s.length * 0.9) - 1)] : null; };
const won = v => (v == null ? '—' : Math.round(v).toLocaleString());
function viewOf(S, io) {
  const v = varieView(S, { nodes: io.growth.cuttableNodes(), stats: io.growth.leafStats() });
  /* ⚠ 2026-10-09 (총괄 · b5ba10df 구멍) — all = growth 가 낸 «전체» 마디. takeCutting 에는 이것을 넘긴다(game.html §cutNodesNow 와 같게).
       거른 목록(nodes)을 넘기면 takeCutting 이 모주 잎 수를 밑동 마디 없이 세어(§motherLeavesOf) 자르기가 거의 다 던진다 */
  return { nodes: cuttableNow(S, v.nodes || []), all: v.nodes || [], stats: motherStatsNow(S, v.stats), budget: cutBudgetOf(S, v.nodes || []) };
}
function pickNode(nodes, budget, varieOnly) {
  const varie = nodes.filter(n => n.variegatedLeaves > 0 && (!budget || n.leaves <= budget.leftLeaves - 1)).sort((a, b) => a.leaves - b.leaves);
  if (varie.length) return varie[0];
  if (varieOnly) return null;
  const one = nodes.filter(n => n.leaves === 1 && (!budget || budget.leftLeaves - 1 >= 1));
  return one.length ? one[0] : null;
}
const atOf = (light, id) => { const s = (light.room.slots || []).find(x => x.slotId === id); return s ? { x: s.x, y: s.y, z: s.z } : null; };

/* ══ 월세·하루 지출 «짝» ═════════════════════════════════════════════════
   oneroomRentWon = R · dailySpendWon = 반지하 dailySpend + (R − 반지하 월세)/주기. 월세 «밖» 하루치(dailyCashOutWon)는 그대로다.
   control 이면 월세만 꽂는다(대조 판 — 아래 등식 검사가 붉어야 자가 산 것이다). */
function pairRules(base, R, control) {
  const per = base.rentPeriodDays || 30;
  return Object.freeze({ ...base, oneroomRentWon: R,
                         ...(control ? {} : { dailySpendWon: Math.round(base.dailySpendWon + (R - base.rentWon) / per) }) });
}
/* 등식 — 이사 뒤 «평균 하루 지출 = 하루 현금 + 월세/주기»가 반지하보다 (R − 반지하 월세)/주기 만큼 늘었나 */
function pairCheck(tsBefore, tsAfter) {
  const per = tsAfter.rules.rentPeriodDays || 30;
  const avg = ts => dailyCashOutWon(ts) + rentWonOf(ts) / per;
  const want = (rentWonOf(tsAfter) - rentWonOf(tsBefore)) / per;
  const got = avg(tsAfter) - avg(tsBefore);
  return { ok: Math.abs(got - want) <= 1, want: Math.round(want), got: Math.round(got),
           cashOutBefore: dailyCashOutWon(tsBefore), cashOutAfter: dailyCashOutWon(tsAfter), avgAfter: Math.round(avg(tsAfter)) };
}

/* ══ 판 하나 ════════════════════════════════════════════════════════════ */
function play({ seed, rent, lamps, branch, path: pathMode, days, control }) {
  const light = makeSwitchingLight();
  const io = { light, growth: standGrowth(seed) };
  const S = newState({ mode: 'novice', room: 'banjiha', firstPlay: true, firstPlayRules: RULES });
  S.sim.seed = seed;
  light.clearCache();
  placeBeansprout(S.firstPlay, DARK, { slots: light.room.slots });
  const ts = S.tutorial;
  const out = { seed, rent, lamps, branch, path: pathMode, moved: false, moveDay: null, assistWon: 0, cashAtMove: null,
                motherAtMove: null, cutsAtMove: 0, pair: null, modeAfter: null,
                starved: false, starvedDay: null, firstBrokeDay: null, minCash: null, cashAt: {}, reachCash: {}, reachNet: {},
                cutsTaken: 0, cuttingsSold: 0, potSold: false, incomeWon: 0 };
  let axisCutDone = false;            /* ⓑⓒ — 무늬 축을 연 «한 장» */

  /* ── ① 반지하 ─────────────────────────────────────────────────────── */
  for (let d = 1; d <= BANJIHA_MAX && !ts.movedOut; d++) {
    try { waterPot(S); } catch { }
    nextDay(S, io);
    try { if (S.pots && S.pots.length) marketGate(S, { leaves: io.growth.leafStats().leaves }); } catch { }
    const b = S.firstPlay.beansprout, want = 5;
    const needSiru = want - b.sirus - stockOf(S, 'siru') - incomingOf(S, 'siru');
    if (needSiru > 0) { try { orderItem(S, 'siru', needSiru); } catch { } }
    const target = Math.min(want, b.sirus + stockOf(S, 'siru'));
    const needSeed = target * 2 - stockOf(S, 'bean_seed') - incomingOf(S, 'bean_seed');
    if (needSeed > 0) { try { orderItem(S, 'bean_seed', needSeed); } catch { } }
    let hv = null; if (beansproutReady(S.firstPlay)) { try { hv = harvestCrop(S, io); } catch { } }
    if (hv && hv.arrived) { setPotSlot(S, pot0(S), SILL, light.room.slots); moveMonstera(S.firstPlay, SILL, { slots: light.room.slots }); }
    try { resowCrop(S, { sirus: target, at: DARK, slots: light.room.slots }); } catch { }
    try { waterCrop(S, { all: true }); } catch { }
    /* 「못 받은 몫」 잉여 채소 — 화면이 배너로 [상점]에서 넘기라고 알린다(game.html §surplusBannerOf) · 사람은 넘긴다 */
    try { sellCropSurplus(S); out.surplusDays = (out.surplusDays || 0) + 1; } catch { }
    /* 등 — 열리면 산다(L 개까지) */
    if (lamps >= 1 && ts.lamp.unlocked && (ts.lamp.owned || 0) < lamps && ts.cashWon >= (ts.rules.lampPriceWon || 0)) {
      try { buyLamp(ts); S.lamps.count = ts.lamp.owned; light.clearCache(); } catch { }
    }
    /* 삽수 — ⓐ 는 무늬 축만 · ⓑ 는 무늬부터 계속 잘라 들고 간다 · ⓒ 는 무늬 축 한 장만 */
    if (pot0(S)) {
      if (stockOf(S, 'jar') + incomingOf(S, 'jar') < 1) { try { orderItem(S, 'jar', 1); } catch { } }
      if (stockOf(S, 'pot') + incomingOf(S, 'pot') < 1) { try { orderItem(S, 'pot', 1); } catch { } }
      const keepCutting = branch === 'b' || !axisCutDone;
      if (keepCutting) {
        const v = viewOf(S, io);
        const node = pickNode(v.nodes, v.budget, branch !== 'b');
        if (node && stockOf(S, 'jar') >= 1) {
          try { takeCutting(S, { nodes: v.all, nodeId: node.nodeId, container: 'jar', at: atOf(light, SILL), slots: light.room.slots });
                if (node.variegatedLeaves > 0) axisCutDone = true; } catch { }
        }
      }
      for (const c of [...cuttingsOf(S)]) if (c.status === 'node' && stockOf(S, 'pot') >= 1) { try { repotCutting(S, c.id); } catch { } }
    }
    /* 무늬 삽수(축)만 판다 — 둘째 축(tutorial §두 축)을 연다 */
    for (const c of [...cuttingsOf(S)]) {
      if (!SELLABLE_CUTTING_STATUS.includes(c.status) || (c.variegatedLeaves || 0) < 1 || listingFor(S, c)) continue;
      if (branch !== 'a' && ts.varieSale && ts.varieSale.count >= 1) continue;     /* ⓑⓒ — 축은 한 장이면 된다 */
      try { listCutting(S, c.id); } catch { }
    }
    /* ⓐ — 무늬 축이 열렸는데 돈이 모자라면 모주를 내놓는다 */
    const cm = canMoveOut(ts);
    if (branch === 'a' && cm.varie && !cm.ok && pot0(S) && !listingFor(S, pot0(S))) {
      try { const st = io.growth.leafStats(); listPot(S, { leaves: st.leaves, variegatedLeaves: st.variegatedLeaves }); } catch { }
    }
    for (const l of (() => { try { return marketStatus(S).contacted; } catch { return []; } })()) {
      if (l.kind === 'cutting' && l.variegatedLeaves < 1 && branch !== 'b') continue;
      try { dealListing(S, l.listingId); } catch { }
    }
    /* 보조 — 무늬 축이 열렸고(진짜로 판 뒤) 돈만 모자라면 모자란 만큼. ⓐ 는 모주가 팔린 뒤(또는 못 판 채 120일) */
    const c2 = canMoveOut(ts);
    const aReady = branch !== 'a' || !pot0(S) || d >= 120;
    if (!c2.ok && c2.varie && c2.shortWon > 0 && aReady && d >= 60) { ts.cashWon += c2.shortWon; out.assistWon += c2.shortWon; }
    if (canMoveOut(ts).ok) {
      const before = { rules: ts.rules, movedOut: false };
      ts.rules = pairRules(ts.rules, rent, control);
      moveIntoOneroom(S, io);
      out.pair = pairCheck(before, ts);
      out.moved = true; out.moveDay = S.day; out.cashAtMove = ts.cashWon; out.modeAfter = S.sim.mode;
      const st = pot0(S) ? io.growth.leafStats() : null;
      out.motherAtMove = st ? { leaves: st.leaves, varie: st.variegatedLeaves } : null;
      out.cutsAtMove = cuttingsOf(S).filter(c => c.status !== 'dead').length;
    }
  }
  if (!out.moved) return out;
  if (Number.isFinite(CASH[branch])) { out.cashOverride = { from: ts.cashWon, to: CASH[branch] }; ts.cashWon = CASH[branch]; }

  /* ── ② 원룸 차림 — 등 · 모주 자리 ─────────────────────────────────── */
  const prof = profileOf('oneroom').p;
  if (!(prof.lampCounts || []).includes(lamps))
    throw new Error(`[자] 원룸 프로필 lampCounts ${JSON.stringify(prof.lampCounts)} 에 등 ${lamps} 이 없다 — 물어도 등 0 이 나온다(plan §5)`);
  S.lamps.count = Math.min(lamps, ts.lamp.owned || 0); if (ts.lamp) ts.lamp.placed = S.lamps.count; light.clearCache();
  if (pot0(S)) { try { setPotSlot(S, pot0(S), ONE_SILLS[0], light.room.slots); } catch { } }
  const eRules = endingRulesFrom({ targetWon: 1e12 });      /* «다 팔면»만 읽는다 — 닿음 판정은 아래 K 로 */
  const ONE_DARK = 'banjiha-dresser:1';

  /* ── ③ 원룸 날들 ──────────────────────────────────────────────────── */
  for (let k = 1; k <= days; k++) {
    try { waterPot(S); } catch { }
    nextDay(S, io);
    try { if (S.pots && S.pots.length) marketGate(S, { leaves: io.growth.leafStats().leaves }); } catch { }
    /* 작물 — 반지하와 같은 살림 */
    const b = S.firstPlay.beansprout, want = 5;
    const needSiru = want - b.sirus - stockOf(S, 'siru') - incomingOf(S, 'siru');
    if (needSiru > 0) { try { orderItem(S, 'siru', needSiru); } catch { } }
    const target = Math.min(want, b.sirus + stockOf(S, 'siru'));
    const needSeed = target * 2 - stockOf(S, 'bean_seed') - incomingOf(S, 'bean_seed');
    if (needSeed > 0) { try { orderItem(S, 'bean_seed', needSeed); } catch { } }
    if (beansproutReady(S.firstPlay)) { try { harvestCrop(S, io); } catch { } }
    try { resowCrop(S, { sirus: target, at: ONE_DARK, slots: light.room.slots }); } catch { }
    try { waterCrop(S, { all: true }); } catch { }
    try { const r = sellCropSurplus(S); out.surplusOneroomWon = (out.surplusOneroomWon || 0) + (r.won || 0); } catch { }
    /* 삽수 */
    const live = cuttingsOf(S).filter(c => c.status !== 'dead' && !c.sold);
    const inFlight = live.filter(c => !SELLABLE_CUTTING_STATUS.includes(c.status));
    if (pot0(S)) {
      const canCut = pathMode === 'max' || inFlight.length === 0;
      if (canCut) {
        if (stockOf(S, 'jar') + incomingOf(S, 'jar') < 1) { try { orderItem(S, 'jar', 1); } catch { } }
        const v = viewOf(S, io);
        const node = pickNode(v.nodes, v.budget, pathMode === 'quest');
        const freeSill = ONE_SILLS.slice(1).find(id => !live.some(c => c.slotId === id)) || ONE_SILLS[1];
        if (node && stockOf(S, 'jar') >= 1) {
          try { takeCutting(S, { nodes: v.all, nodeId: node.nodeId, container: 'jar', at: atOf(light, freeSill), slots: light.room.slots }); out.cutsTaken++; }
          catch (e) { out.cutBlocked = out.cutBlocked || {}; const m = String(e && e.message || e).replace(/n\d+#\d+/g, '마디').slice(0, 60); out.cutBlocked[m] = (out.cutBlocked[m] || 0) + 1; }
        } else if (process.env.TRACE) { out.noCut = out.noCut || {}; const why = !node ? (v.nodes.length ? '무늬 마디 없음(예산·무늬)' : '자를 마디 0') : '병 없음';
          out.noCut[why] = (out.noCut[why] || 0) + 1; }
      }
    }
    for (const c of [...cuttingsOf(S)]) {
      if (c.status === 'node') {
        if (stockOf(S, 'pot') + incomingOf(S, 'pot') < 1) { try { orderItem(S, 'pot', 1); } catch { } }
        if (stockOf(S, 'pot') >= 1) { try { repotCutting(S, c.id); } catch { } }
      }
      if (SELLABLE_CUTTING_STATUS.includes(c.status) && !listingFor(S, c)) { try { listCutting(S, c.id); } catch { } }
    }
    /* ⓐ — 이사 전에 못 판 모주가 남았으면 여기서 내놓는다 */
    if (branch === 'a' && pot0(S) && !listingFor(S, pot0(S))) {
      try { const st = io.growth.leafStats(); listPot(S, { leaves: st.leaves, variegatedLeaves: st.variegatedLeaves }); } catch { }
    }
    for (const l of (() => { try { return marketStatus(S).contacted; } catch { return []; } })()) {
      try { const r = dealListing(S, l.listingId); out.incomeWon += r.won || 0; if (r.kind === 'pot') out.potSold = true; else out.cuttingsSold++; } catch { }
    }
    /* 적기 */
    const cash = ts.cashWon;
    out.minCash = out.minCash == null ? cash : Math.min(out.minCash, cash);
    if (out.firstBrokeDay == null && (ts.bankrupt || cash <= 0)) out.firstBrokeDay = k;
    if (ts.starved && !out.starved) { out.starved = true; out.starvedDay = k; }
    if ([30, 60, 90, 120, 180, 270, 360].includes(k)) out.cashAt[k] = cash;
    if (process.env.TRACE && seed === SEEDS[0]) console.log(`    [${branch}·등${lamps}·${rent / 1e4}만] 원룸 ${k}일 — 현금 ${won(cash)} · 하루 현금 ${won(dailyCashOutWon(ts))} · 월세 ${won(rentWonOf(ts))} · 시루 ${S.firstPlay.beansprout.sirus} · 삽수 ${cuttingsOf(S).map(c => c.status).join(',')}`);
    let net = null; try { net = endingProgress(S, io, { rules: eRules, nodes: io.growth.cuttableNodes(), stats: pot0(S) ? io.growth.leafStats() : null }).netWorthWon; } catch { net = null; }
    for (const K of KS) {
      if (out.reachCash[K] == null && cash >= K) out.reachCash[K] = k;
      if (out.reachNet[K] == null && net != null && net >= K) out.reachNet[K] = k;
    }
  }
  out.cashEnd = ts.cashWon;
  if (process.env.TRACE) console.log(`    씨앗 ${seed} 자르기 — 막힘 ${JSON.stringify(out.cutBlocked || {})} · 안 자름 ${JSON.stringify(out.noCut || {})} · 모주 ${pot0(S) ? JSON.stringify(io.growth.leafStats()) : '없음'}`);
  return out;
}

/* ══ 머리 — 모드 · 등 · 자 · 프로필(plan §2 «표 머리에 넷») ═══════════════════ */
const prof1 = profileOf('oneroom').p;
console.log('■ 원룸 살림 자 — probe_oneroom_econ');
console.log(`  모드: 반지하 novice → 이사(D1) 뒤 real · 자: 지갑(ts.cashWon) 날마다 · 프로필: room_profile.oneroom.json roomRev「${String(prof1.roomRev).slice(0, 60)}…」 lampCounts ${JSON.stringify(prof1.lampCounts)} measuredAt ${prof1.measured && prof1.measured.measuredAt}`);
console.log(`  월세 후보 ${RENTS.map(won).join(' · ')} · 등 ${LAMPS.join('/')} · 갈래 ${BRANCHES.join('')} · 경로 ${PATH} · 씨앗 ${SEEDS[0]}~${SEEDS[SEEDS.length - 1]}(${SEEDS.length}) · 원룸 ${DAYS}일${CONTROL ? ' · ★대조 판(월세만 꽂음)' : ''}`);
console.log(`  반지하 규칙: 월세 ${won(TUTORIAL_RULES.rentWon)} · dailySpend ${won(TUTORIAL_RULES.dailySpendWon)} · 이사비 ${won(TUTORIAL_RULES.moveOutCostWon)}` +
            (Object.keys(CASH).length ? ` · ★이사 직후 현금을 밖에서 줌 ${JSON.stringify(CASH)}` : ' · 이사 직후 현금 = 반지하를 굴린 그대로'));

let pairFail = 0;
const all = [];
for (const rent of RENTS) for (const lamps of LAMPS) for (const branch of BRANCHES) {
  const runs = SEEDS.map(seed => play({ seed, rent, lamps, branch, path: PATH, days: DAYS, control: CONTROL }));
  all.push(...runs);
  const mv = runs.filter(r => r.moved);
  const pf = mv.filter(r => r.pair && !r.pair.ok);
  pairFail += pf.length;
  const p0 = mv[0] && mv[0].pair;
  console.log(`\n■ 월세 ${won(rent)} · 등 ${lamps} · 갈래 ${branch} — 이사 ${mv.length}/${runs.length}` +
              (p0 ? ` · 짝 ${p0.ok ? 'OK' : 'FAIL'}(하루 현금 ${won(p0.cashOutBefore)} → ${won(p0.cashOutAfter)} · 평균 하루 지출 ${won(p0.avgAfter)} · 는 몫 ${won(p0.got)}/${won(p0.want)})` : '') +
              ` · 이사 뒤 모드 ${[...new Set(mv.map(r => r.modeAfter))].join('/')}`);
  if (!mv.length) continue;
  console.log(`  이사 날 중앙값 ${median(mv.map(r => r.moveDay))} · 보조 든 판 ${mv.filter(r => r.assistWon > 0).length}/${mv.length}(중앙값 ${won(median(mv.map(r => r.assistWon)))}원) · 이사 뒤 현금 중앙값 ${won(median(mv.map(r => r.cashAtMove)))}` +
              ` · 모주 든 판 ${mv.filter(r => r.motherAtMove).length} · 들고 간 삽수 중앙값 ${median(mv.map(r => r.cutsAtMove))}`);
  console.log(`  ★ 굶음 ${mv.filter(r => r.starved).length}/${mv.length} · 첫 0원 ${mv.filter(r => r.firstBrokeDay != null).length}/${mv.length}(중앙값 ${median(mv.map(r => r.firstBrokeDay))}일째)` +
              ` · 최저 잔고 중앙값 ${won(median(mv.map(r => r.minCash)))} · ${DAYS}일째 잔고 중앙값 ${won(median(mv.map(r => r.cashEnd)))}` +
              ` · 자른 삽수 중앙값 ${median(mv.map(r => r.cutsTaken))} · 판 ${median(mv.map(r => r.cuttingsSold))} · 그루 판 판 ${mv.filter(r => r.potSold).length}`);
  console.log('  K 닿은 날(원룸 며칠째 · 현금/다 팔면) — ' + KS.map(K => {
    const c = mv.map(r => r.reachCash[K] ?? null), n = mv.map(r => r.reachNet[K] ?? null);
    const nc = c.filter(v => v != null).length, nn = n.filter(v => v != null).length;
    return `${K / 1e4}만: 현금 ${nc}/${mv.length}${nc ? ` 중앙 ${median(c)} 90% ${q90(c)}` : ''} · 다팔면 ${nn}/${mv.length}${nn ? ` 중앙 ${median(n)}` : ''}`;
  }).join(' | '));
}
try {
  const outF = path.join(ROOT, 'tools', '_out', `oneroom_econ_${CONTROL ? 'control' : PATH}.json`);
  fs.mkdirSync(path.dirname(outF), { recursive: true });
  fs.writeFileSync(outF, JSON.stringify({ args: { RENTS, LAMPS, BRANCHES, PATH, SEEDS, DAYS, CONTROL }, roomRev: prof1.roomRev, runs: all }, null, 1));
  console.log(`\n  판별 기록 — ${path.relative(ROOT, outF)}`);
} catch (e) { console.log('  ⚠ 기록 파일을 못 썼다 —', e.message); }
/* ★ 대조 판은 «붉어야» 한다 — 월세만 꽂으면 평균 하루 지출이 안 는다. 붉지 않으면 이 자가 짝을 못 본다는 뜻이다 */
if (CONTROL) {
  console.log(pairFail > 0 ? `\n  OK   대조 판이 붉다 — 월세만 꽂은 판 ${pairFail}개를 짝 검사가 잡았다` : '\n  FAIL 대조 판이 안 붉다 — 짝 검사가 눈감고 있다');
  process.exit(pairFail > 0 ? 0 : 1);
}
console.log(pairFail ? `\nprobe_oneroom_econ: FAIL — 짝 검사 ${pairFail}판` : '\nprobe_oneroom_econ: 짝 검사 PASS');
process.exit(pairFail ? 1 : 0);
