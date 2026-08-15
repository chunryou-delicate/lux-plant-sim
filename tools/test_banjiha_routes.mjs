/* 반지하 세 경로 재현 — "이사 자금을 실제로 모을 수 있나 · 막다른 길이 없나"
 *
 *   node tools/test_banjiha_routes.mjs
 *
 * ★ 설계 정본은 `docs/story_arc.md` §2(세 경로)·`docs/shop.md`(상점·잭팟 역산)·
 *   `docs/propagation.md`(삽수). 박사님 확정(2026-08-03):
 *
 *     "꾸준수입도 가능하지. 삽수 팔거나 하는 걸로. 시점의 차이인 거지.
 *      근데 튜토는 어느 정도 꾸준수입 + 임의 확정 성숙 무늬로 마무리하는 걸로 하자."
 *
 *   ⇒ 돈이 들어오는 길은 둘뿐이다 — ① 뿌리내린 삽수를 판다(꾸준수입) ② 튜토 확정 무늬
 *     한 장을 잘라 판다(마무리). **하루 수입을 주입하지 않는다.**
 *
 * ★★ 2026-08-03 개편 — **대역(스텁)을 버리고 진짜 생장 엔진을 돌린다.**
 *   예전 판은 plant_grow.html 이 브라우저 전용이라며 잎 수를 표(NODE_TABLE)로 흉내 냈다.
 *   그 표는 **마디 수**였고 살아 있는 **잎 수**가 아니었다 — 실제로 재 보니 도착 개체의
 *   잎은 6장이 아니다(검사 0 이 그 숫자를 찍는다). 값이 잎 수로 매겨지므로(shop.priceOf)
 *   그 차이가 이사 성립 여부를 통째로 바꾼다.
 *   `tools/test_cuttable.mjs` 가 이미 헤드리스로 엔진을 올리고 있었으므로 같은 방식을 쓴다.
 */
import assert from 'node:assert';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProfileLight } from '../src/game/room_profile.js';
import { newState, pot0, setPotSlot, resowCrop, waterCrop, waterPot,
         cropWaterStatus, ARRIVAL } from '../src/game/state.js';
import { nextDay, harvestCrop } from '../src/game/loop.js';
import { firstPlayRulesFromBalance, placeBeansprout, moveMonstera, beansproutReady,
         FIRST_PLAY_RULES, CROP_KINDS,
         /* ★ 2026-08-16 · 그램 셈 (first_play §그램) */
         cropCycleSavedWon } from '../src/game/first_play.js';
import { seasonAt, seasonDayAt, buyLamp, canMoveOut, moveOut, TUTORIAL_RULES,
         varieView, varieGrantCheck, stepVarieGrant, varieGrantOpensDay } from '../src/game/tutorial.js';
import { orderItem, stockOf, incomingOf, priceOf, varieLeavesNeededFor,
         sellCutting, sellPot, CATALOG, buyPriceOf, SELLABLE_CUTTING_STATUS } from '../src/game/shop.js';
import { takeCutting, cuttableNow, cutBudgetOf, motherStatsNow, METHODS } from '../src/game/propagation.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const U = p => new URL(p, import.meta.url);
const J = p => JSON.parse(fs.readFileSync(U(p), 'utf8'));

const results = [];
const check = (name, fn) => { try { fn(); results.push(['PASS', name]); }
                              catch (e) { results.push(['FAIL', name, e.message]); } };
/* ★ WARN — **고장이 아니라 판단 대기**다. 여기 걸리는 것은 코드가 틀린 게 아니라
   기획 수치가 아직 안 맞는 것이라 스위트를 빨갛게 만들지 않는다. 대신 크게 찍는다. */
const warn = (name, fn) => { try { fn(); results.push(['PASS', name]); }
                             catch (e) { results.push(['WARN', name, e.message]); } };
const info = m => results.push(['INFO', '  ' + m]);

const light = createProfileLight(J('../data/profiles/room_profile.banjiha.json'), {
  lightTh: J('../data/balance/light_thresholds.json'),
  weatherBalance: J('../data/balance/weather.json')
});
const RULES = firstPlayRulesFromBalance(J('../data/balance/characters.json'));
const TH = J('../data/balance/light_thresholds.json');
const GT = J('../data/growth_tuning.json');

const DARK = 'banjiha-dresser:1';        // peak DLI 0.04 — 콩나물 자리
const SILL = 'banjiha-sill:0';           // peak DLI 3.77 (등 1개 5.61) — 몬스테라 자리
/* ★ 이사비는 **정본에서 읽는다**. 여기 숫자를 박아 두면 값이 바뀔 때 조용히 어긋난다 —
   2026-08-09 에 실제로 그랬다: 이사비를 150만 → 180만으로 올렸는데 이 상수가 150만에
   머물러, 「이사 자금이 찼는데도 확정 무늬가 열린다」는 **엉뚱한 실패**가 났다.
   검사가 지키려던 규칙은 멀쩡했고 **재는 자가 낡았던 것**이다. */
const MOVE_OUT_WON = TUTORIAL_RULES.moveOutCostWon;

/* ══ 진짜 생장 엔진 — plant_grow.html 을 헤드리스로 올린다 ═══════════════
   tools/test_cuttable.mjs 의 방식 그대로다(3D 만 걷어낸다). 한 번 올려 두고
   판마다 씨앗을 다시 심는다 — plant_grow 는 한 그루 전용이라 그게 유일한 길이다. */
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
    crossVectors(a, b) {
      return this.set(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
    }
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
  assert.notEqual(src, main, 'init() 호출부를 못 찾았습니다 — 파일 끝이 바뀌었습니다');
  const tuning = fs.readFileSync(path.join(ROOT, 'data', 'growth_tuning.json'), 'utf8');
  const el = () => ({
    value: '', textContent: '', checked: false, dataset: {}, style: {}, classList: { add() {}, remove() {}, toggle() {} },
    appendChild() {}, addEventListener() {}, removeEventListener() {}, setAttribute() {}, getAttribute() { return null; },
    querySelector() { return null; }, querySelectorAll() { return []; }, insertAdjacentHTML() {}, focus() {}, remove() {}
  });
  const ctx = {
    THREE: makeThree(),
    console: { log() {}, warn() {}, error() {} },
    document: {
      getElementById() { return null; }, createElement: el, querySelector() { return null; },
      querySelectorAll() { return []; }, addEventListener() {}, body: el(), documentElement: el()
    },
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

/* 판 하나를 세운다 — 씨앗을 바꾸면 **개체가 바뀐다**(가지·잎·무늬 굴림이 전부 그 씨앗의 것).
   그게 이 재현의 난수다. 코어가 따로 난수를 굴리지 않는다. */
function standGrowth(seed) {
  /* ⚠ 그리기는 헤드리스에서 터진다(무대가 없다) — 논리는 그 전에 다 끝나므로 삼킨다.
     test_cuttable.mjs 의 seedTo 와 같은 처리다. */
  try { G.plantSeed(seed); } catch { /* 3D 무대 없음 */ }
  G.matResetAll();
  G.resetDailyLight();
  /* 도착 개체 — 숫자를 여기 베끼지 않는다. state.ARRIVAL 이 정본이고 코어가 실제로 넘기는 값이다
     (예전엔 143 이 박혀 있어서 정본이 바뀌면 재현만 옛 개체로 조용히 남았다). */
  G.setGrowth(ARRIVAL.growthDays);
  return {
    assertContract() { return true; },
    has: (n) => typeof G[n] === 'function',
    setDailyLight(d) { return G.setDailyLight(d); },
    /* ⚠ `drawn` 을 참으로 바꿔 낸다 — 헤드리스라 3D 무대가 **처음부터 없다.**
       그리기 실패가 아니라 그릴 무대를 안 만든 것이라, 그대로 넘기면 loop 이 매일 던진다.
       논리 진행(달력·유효 생장·무늬 굴림)은 실제 엔진 것 그대로다. */
    advanceTo(d) { const r = G.advanceTo(d); return { ...r, drawn: true, drawError: null }; },
    setGrowth(d) { const r = G.setGrowth(d); return { ...r, drawn: true, drawError: null }; },
    calendarDay: () => G.calendarDay(),
    growthDays: () => G.growthDays(),
    growthBlocked: () => G.growthBlocked(),
    growthPhase: () => G.growthPhase(),
    dli7: () => G.dli7(), dliCV: () => G.dliCV(), ageOf: (d) => G.ageOf(d),
    cuttableNodes: () => G.cuttableNodes(),
    leafStats: () => G.leafStats()
  };
}

/* ══ 플레이어가 하는 일 ═════════════════════════════════════════════════
   여기 있는 것은 전부 **버튼 하나에 대응하는 동작**이다. 코어 API 말고는 안 쓴다. */

/* 지금 이 그루의 마디·잎 — **코어의 확정 무늬를 덧씌우고, 잘라낸 만큼을 뺀 값**이다.
   ★ 이 두 줄이 게임 화면이 반드시 해야 하는 일이다(둘 중 하나만 빼먹으면 값이 틀린다). */
function viewOf(S, io) {
  const raw = io.growth.cuttableNodes();
  const stats = io.growth.leafStats();
  const v = varieView(S, { nodes: raw, stats });
  return {
    nodes: cuttableNow(S, v.nodes || []),
    stats: motherStatsNow(S, v.stats),
    budget: cutBudgetOf(S, v.nodes || [])
  };
}

/* 팔 수 있는 삽수(뿌리내린 것)의 값 합계 */
function cuttingValueOf(S) {
  let won = 0, n = 0;
  for (const c of S.cuttings || []) {
    if (!SELLABLE_CUTTING_STATUS.includes(c.status)) continue;
    won += priceOf({ leaves: c.source.leaves, variegatedLeaves: c.source.variegatedLeaves }).won;
    n++;
  }
  return { won, n };
}

/* 오늘 자를 마디를 고른다.
     ① 무늬 잎을 품은 마디가 있으면 **그것부터** — 그게 이사 자금이다
     ② 없으면 잎 1장짜리 마디 (단가 12,000원/잎으로 성체(10,000)보다 낫다 · docs/propagation.md §6)
   ⚠ 초보에서는 모주를 끝내는 자르기가 막혀 있으므로(propagation.md §2) 여기서 또 안 막는다. */
function pickNode(nodes, opt = {}, budget = null) {
  /* ★ 무늬는 **모주에 한 장만 남기면** 자른다 — 그게 이사 자금이라 아낄 이유가 없다 */
  const varie = nodes.filter(n => n.variegatedLeaves > 0 &&
                                  (!budget || n.leaves <= budget.leftLeaves - 1))
                     .sort((a, b) => a.leaves - b.leaves);
  if (varie.length) return varie[0];
  if (opt.varieOnly) return null;
  /* ★ 민무늬는 **예비를 남기고** 자른다. 잎을 끝까지 뽑아 쓰면 확정 무늬가 왔을 때
     "자르면 모주가 끝난다"로 막혀 그 무늬를 영영 못 판다 — 재현에서 실제로 그랬다. */
  const keep = opt.keep ?? 1;
  const one = nodes.filter(n => n.leaves === 1 && (!budget || budget.leftLeaves - 1 >= keep));
  return one.length ? one[0] : null;
}

function median(a) { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; }

/* ══ 판 굴리기 ═════════════════════════════════════════════════════════ */
function play(opt = {}) {
  const S = newState({ mode: 'novice', room: 'banjiha', firstPlay: true, firstPlayRules: RULES });
  light.clearCache();
  const growth = standGrowth(opt.seed || 1);
  const io = { light, growth };
  placeBeansprout(S.firstPlay, opt.cropSlot || DARK, { slots: light.room.slots });

  const rows = [];
  let lampDay = null, grantDay = null, grantNode = null;
  let cuttingIncome = 0, varieIncome = 0, potIncome = 0, containerSpend = 0, cuttingsSold = 0;
  let firstCutDay = null, firstSellDay = null;

  const sell = (c) => {
    const varie = c.source.variegatedLeaves > 0;
    const r = sellCutting(S, c.id);
    cuttingsSold++;
    if (varie) varieIncome += r.won; else cuttingIncome += r.won;
    return r;
  };

  for (let d = 1; d <= (opt.days || 240); d++) {
    /* ★★ 물주기 = **회전 시작** (2026-08-04 새 규칙 · first_play.js §물주기).
       한 번 누르면 **시루 하나**가 그날을 0일차로 잡는다. 그래서 하루에 한 번 누르는 이 재현은
       시루가 여럿이면 **저절로 하루씩 어긋난다** — 그것이 표준 플레이다.
       `opt.waterAll` 이면 그날 대기를 전부 시작한다(= 겹치는 판. B-2 가 그 대조군을 쓴다). */
    if (opt.water !== false) {
      try { waterCrop(S, { all: !!opt.waterAll }); } catch { /* 아직 안 놓은 시루 */ }
      try { waterPot(S); } catch { /* 아직 없거나 안 놓은 화분 — 그런 날은 물이 안 든다 */ }
    }

    let turn;
    try { turn = nextDay(S, io).turn; }
    catch (e) { throw new Error(`Day ${S.day} 에서 턴이 터졌습니다 — ${e.message}`); }

    /* ★★ 수확 (2026-08-04) — **[수확하기] 를 눌러야 곳간에 들어간다**(first_play.js §수확).
       재현이 자동으로 거두게 두면 **검사가 게임과 다른 것을 재게 된다.** 그래서 여기서
       사람이 누르는 그 자리·그 순서로 부른다: [다음 날] 뒤 · [다시 심기] 앞.
       ★ 첫 수확의 몬스테라 선물도 이 함수가 준다(turn.plantArrived 가 아니다). */
    let harvested = null;
    if (opt.harvest !== false && beansproutReady(S.firstPlay.beansprout)) {
      try { harvested = harvestCrop(S, io); }
      catch (e) { throw new Error(`Day ${S.day} 에서 수확이 터졌습니다 — ${e.message}`); }
    }
    const ts = S.tutorial;

    /* ★ 대조군 — 코어가 준 확정 무늬를 매일 걷어 낸다(규칙이 없는 세계를 흉내 낸다).
       growth 의 13% 굴림은 그대로 둔다 — 그게 대조군의 내용이다. */
    if (opt.noGrant) ts.varieGrant.nodeIds = [];
    else if (turn.varieGrant && turn.varieGrant.granted && grantDay == null) {
      grantDay = ts.day; grantNode = turn.varieGrant.nodeId;
    }

    /* ★ 도착은 이제 **수확의 반환값**으로 온다 (2026-08-04) — turn.plantArrived 가 아니다 */
    if (harvested && harvested.arrived && opt.plantSlot) {
      setPotSlot(S, pot0(S), opt.plantSlot, light.room.slots);
      moveMonstera(S.firstPlay, opt.plantSlot, { slots: light.room.slots });
    }

    /* ── ① 콩나물 회전 — 씨앗을 미리 시켜 두고, 오면 다시 심는다 ────────── */
    /* ★★ 2026-08-04 — `farm: false` 여도 **첫 플레이 동안은 돌린다.**
       몬스테라가 3회전째에 오게 바뀌면서(first_play.monsteraArrivalDue), 회전을 아예 안 돌리면
       선물이 영영 안 오고 → 첫 플레이가 안 끝나고 → **튜토 시계가 시작조차 안 한다.**
       그러면 "아무것도 안 하면 파산한다"(검사 D)가 파산이 아니라 **아무 일도 없음**이 된다.
       `farm: false` 가 재려던 것은 "튜토를 사는 동안 콩나물을 안 돌리면"이므로 거기서만 끈다.
       ★ `farm: 'never'` 는 첫 플레이에서도 안 돌린다 — **재고 규칙 자체**를 재는 검사용이다. */
    const farmNow = opt.farm === 'never' ? false
                  : opt.farm !== false ? true
                  : !S.firstPlay.completed;
    if (farmNow) {
      const b = S.firstPlay.beansprout;
      /* ★★ 2026-08-04 — 시루를 **더 사지 않는다.** 같은 작물은 몇 시루를 심어도 절감이 안 는다
         (first_play.js §작물 종류 — 체감은 개수가 아니라 종류에 걸린다). 예전에는 셋까지 늘렸는데
         이제 그건 씨앗값만 세 배로 내는 손해다. 늘리려면 **다른 작물**이라야 하고, 지금은 없다. */
      const want = Math.min(opt.sirus ?? 1, 3);
      if (b.sirus + stockOf(S, 'siru') + incomingOf(S, 'siru') < want)
        try { orderItem(S, 'siru', 1); } catch { /* 돈이 모자라면 다음 날 */ }
      const target = Math.min(want, b.sirus + stockOf(S, 'siru'));
      if (stockOf(S, 'bean_seed') + incomingOf(S, 'bean_seed') < target)
        try { orderItem(S, 'bean_seed', target - stockOf(S, 'bean_seed') - incomingOf(S, 'bean_seed')); }
        catch { /* 돈이 모자라면 다음 날 */ }
      if (b.harvested && stockOf(S, 'bean_seed') >= target)
        try { resowCrop(S, { sirus: target, at: opt.cropSlot || DARK, slots: light.room.slots }); }
        catch { /* 재고가 딱 안 맞으면 다음 날 */ }
    }

    /* ── ② 식물등 — 경로 B·C 만 산다 ─────────────────────────────────── */
    if (opt.buyLamp && ts.lamp.unlocked && ts.lamp.owned === 0 && ts.cashWon >= ts.rules.lampPriceWon) {
      buyLamp(ts); S.lamps.count = ts.lamp.owned; light.clearCache(); lampDay = ts.day;
    }

    /* ── ③ ★삽수 — 자르고 · 뿌리내리고 · 판다 ───────────────────────────
       박사님 확정의 그 세 동작이 여기 그대로 있다. 지름길이 하나도 없다:
       병은 이틀 걸려 오고, 뿌리는 12일 걸리고, 뿌리 없는 조각은 안 팔린다. */
    if (opt.propagate !== false && ts.day >= (opt.startCutDay || 0)) {
      /* ★ 병은 **필요할 때 하나씩**. 팔면 돌아오므로(CONTAINERS.returnsOnSale) 보통 한 개로 돈다.
         비어 있는데 자를 것이 있을 때만 시킨다 — 미리 쟁여 두면 병값이 순액을 갉아먹는다. */
      const v0 = pot0(S) ? viewOf(S, io) : null;
      const node = v0 ? pickNode(v0.nodes, { varieOnly: !!opt.varieOnly, keep: opt.keep ?? 1 }, v0.budget) : null;
      /* 병은 **돌아온다**. 진행 중인 삽수가 없고 재고도 배송도 없을 때만 산다 — 쟁이지 않는다. */
      if (node && (S.cuttings || []).length === 0 &&
          stockOf(S, 'jar') + incomingOf(S, 'jar') === 0) {
        try { const o = orderItem(S, 'jar', 1); containerSpend += o.totalWon; }
        catch { /* 돈이 모자라면 다음 날 */ }
      }
      if (node && stockOf(S, 'jar') >= 1) {
        try {
          takeCutting(S, { nodes: v0.nodes, nodeId: node.nodeId, container: 'jar' });
          if (firstCutDay == null) firstCutDay = S.day;
        } catch { /* 모주에 잎이 한 장도 안 남는 자르기 등 — 규칙대로 막힌 것이다 */ }
      }
      for (const c of [...(S.cuttings || [])]) {
        if (!SELLABLE_CUTTING_STATUS.includes(c.status)) continue;
        if (firstSellDay == null) firstSellDay = S.day;
        sell(c);
      }
    }

    /* ── ④ 이사 — 팔 수 있는 것을 다 팔면 닿나 ─────────────────────────── */
    /* ★★★ 2026-08-09 — **배움이 다 끝난 뒤에만 판다.** 이 한 줄이 없으면 재현이 무너진다.
       ------------------------------------------------------------
       시작돈이 1,300,000 → **1,500,000원**이 되면서 `moveOutCostWon`(1,500,000)과 **같아졌다.**
       그러자 이 블록이 **몬스테라가 도착한 그날** 걸렸다: 현금 1,492,700 + 어린 포기 12,000
       ≥ 1,500,000 이라, 재현이 **막 받은 모주를 12,000원에 팔아 버렸다.**
       모주가 없으니 말린 새순도·삽수도·확정 무늬도 영영 안 오고, 첫 플레이가 안 끝나 **튜토
       시계가 아예 안 돌았다**(달력 180일에 튜토 0일). 검사 D·P·H·G 가 한꺼번에 무너진 이유가 이것이다.
       ⇒ 재는 자가 틀린 것이다. `canMoveOut` 은 **배움 넷을 다 채워야** 열리므로, 배움이 남았는데
         모주를 파는 것은 사람이 하지 않을 선택이다 — 나갈 수도 없는데 나갈 밑천을 없애는 짓이다.
       ★ 예전 판에서는 이 줄이 있으나 없으나 같았다. 현금이 문턱보다 한참 아래라 모주가 크게
         자란 뒤에야(잎 3장 · 1,830,000원) 이 블록이 걸렸고, 그때는 배움이 이미 끝나 있었다.
         **시작돈 = 이사비**가 되면서 비로소 갈렸다 — 그 사실 자체는 plan 이 판단할 것이다. */
    if (!ts.movedOut && pot0(S) && canMoveOut(ts).learningLeft.length === 0) {
      const v = viewOf(S, io);
      const cut = cuttingValueOf(S);
      const potWon = v.stats && v.stats.leaves >= 1
        ? priceOf({ leaves: v.stats.leaves, variegatedLeaves: v.stats.variegatedLeaves }).won : 0;
      if (ts.cashWon + cut.won + potWon >= MOVE_OUT_WON) {
        for (const c of [...(S.cuttings || [])])
          if (SELLABLE_CUTTING_STATUS.includes(c.status)) sell(c);
        if (potWon && ts.cashWon < MOVE_OUT_WON) {
          sellPot(S, { leaves: v.stats.leaves, variegatedLeaves: v.stats.variegatedLeaves });
          potIncome += potWon;
        }
      }
    }
    /* ★★ 2026-08-13 — **모주를 판 뒤에도 삽수는 판다.**
       ------------------------------------------------------------
       위 블록은 통째로 `pot0(S)` 안에 있다. 모주를 파는 순간 그 조건이 거짓이 되어
       **손에 남은 삽수를 다시는 안 팔았다.** 옛 조건(돈 × 배움)에서는 모주만 팔면 문이
       열려서 이 구멍이 안 보였는데, 둘째 축이 「무늬 삽수를 판 적이 있다」로 바뀌자
       그대로 드러났다 — 뿌리내리는 중이던 무늬 삽수가 손에 남아 **영영 못 나가는 판**이 됐다.
       ⚠ 실측으로 그 구멍이 이 재현의 성공률을 A 78% → 20% 로 끌어내렸다.
         **판이 그런 것이 아니라 재는 자가 그랬다**(START-HERE §2). 고치면 되돌아온다. */
    if (!ts.movedOut && !pot0(S)) {
      for (const c of [...(S.cuttings || [])])
        if (SELLABLE_CUTTING_STATUS.includes(c.status)) sell(c);
    }
    if (!ts.movedOut && canMoveOut(ts).ok) moveOut(ts);

    rows.push({ day: S.day, tday: ts.day, season: seasonAt(ts, ts.day),
                seasonDay: seasonDayAt(ts, ts.day), cashWon: ts.cashWon,
                bankrupt: ts.bankrupt, leaves: io.growth.leafStats() });
    if (ts.movedOut) break;
  }
  const last = rows[rows.length - 1];
  return { S, rows, growth: io.growth, lampDay, grantDay, grantNode,
           cuttingIncome, varieIncome, potIncome, containerSpend, cuttingsSold,
           firstCutDay, firstSellDay,
           movedOut: S.tutorial.movedOut, lastDay: last.tday,
           season: last.season, everBroke: rows.some(r => r.bankrupt) };
}

/* ══ 0 · ★먼저 — 이 개체가 실제로 잎이 몇 장인가 ═════════════════════════ */
check('0 ★도착 개체의 잎 수 — 값의 크기는 여기서 나온다 (지어낸 표가 아니다)', () => {
  const g = standGrowth(1);
  const st0 = g.leafStats();
  assert.ok(Number.isInteger(st0.leaves) && st0.leaves >= 1, `잎 집계가 이상합니다: ${JSON.stringify(st0)}`);
  const marks = [];
  let cal = ARRIVAL.growthDays;
  for (let d = 1; d <= 120; d++) { g.setDailyLight(3.77); g.advanceTo(++cal);
    if (d % 30 === 0) marks.push(`${d}일 뒤 ${g.leafStats().leaves}장`); }
  info(`도착(유효 ${ARRIVAL.growthDays}일): 잎 ${st0.leaves}장 · 마디 ${g.cuttableNodes().length}개 → ` + marks.join(' · '));
  info(`민무늬 값: 잎1 ${priceOf({ leaves: 1, variegatedLeaves: 0 }).won.toLocaleString()}원 · ` +
       `잎${st0.leaves} ${priceOf({ leaves: st0.leaves, variegatedLeaves: 0 }).won.toLocaleString()}원 · ` +
       `★무늬 잎1(v=1) ${priceOf({ leaves: 1, variegatedLeaves: 1 }).won.toLocaleString()}원`);
  /* ★★ [고침 2026-08-03] 도착 개체는 **무늬 없이** 온다 (docs/propagation.md §7 "첫 몬스테라는
     normal 고정"). 예전에는 40개 시드 중 13개(33%)가 무늬를 달고 왔고, 잎 2장이 다 무늬면
     그루 값이 1,464,000원이라 **받자마자 팔면 튜토가 첫날에 끝났다.**
     원인이 둘이었고 둘 다 plant_grow.html 에서 고쳤다:
       ① `calcVarieProb` 이 **빛 이력이 없을 때** varieProb(0.20)을 그대로 돌려줬다 → 0 으로
       ② 무늬 굴림이 **다시 그릴 때마다 다시 돌았다** → VARIE_STATE 가 잎마다 한 번만 기억한다
     ②가 없으면 ①만으로는 못 막는다 — 도착 다음 날 빛이 들어오는 순간 **이미 있던 잎이
     소급해서 무늬로 뒤집혔다**(실측 seed 13: 잎 3장 무늬 0 → 하루 뒤 무늬 1). */
  let varieArrival = 0, varieFlip = 0;
  for (let s = 1; s <= 40; s++) {
    const gg = standGrowth(s);
    if (gg.leafStats().variegatedLeaves > 0) varieArrival++;
    /* 도착 다음 날 창턱 빛이 들어와도 **있던 잎이 뒤집히지 않는다** */
    const before = gg.leafStats();
    gg.setDailyLight(3.77); gg.advanceTo(ARRIVAL.growthDays + 1);
    if (gg.leafStats().variegatedLeaves > before.variegatedLeaves) varieFlip++;
  }
  assert.equal(varieArrival, 0,
    `★도착 개체 40판 중 ${varieArrival}판이 무늬를 달고 왔습니다 — propagation.md §7(normal 고정) 위반입니다`);
  assert.equal(varieFlip, 0,
    `★도착 다음 날 ${varieFlip}판에서 있던 잎이 무늬로 뒤집혔습니다 — 무늬 굴림이 소급하고 있습니다`);
  info('★도착 개체 40판 전부 민무늬 · 다음 날 빛이 들어와도 소급해서 안 뒤집힌다');
});

/* ══ A · 상점 — 주문하면 하루 이틀 뒤에 온다 ════════════════════════════ */
check('A 상점 — 결제는 지금, 물건은 1~2일 뒤. 도착 전에는 못 쓴다', () => {
  const S = newState({ mode: 'novice', room: 'banjiha', firstPlay: true, firstPlayRules: RULES });
  light.clearCache();
  const io = { light, growth: standGrowth(1) };
  placeBeansprout(S.firstPlay, DARK, { slots: light.room.slots });

  const before = S.tutorial.cashWon;
  const o = orderItem(S, 'bean_seed', 2);
  assert.equal(S.tutorial.cashWon, before - buyPriceOf('bean_seed') * 2, '주문한 날 돈이 안 빠졌습니다');
  assert.equal(stockOf(S, 'bean_seed'), 0, '★주문하자마자 물건이 왔습니다 — 배송이 없습니다');
  assert.equal(o.arrivesOnDay, S.day + CATALOG.bean_seed.leadDays);

  nextDay(S, io);
  assert.equal(stockOf(S, 'bean_seed'), 2, `배송 ${CATALOG.bean_seed.leadDays}일인데 안 왔습니다`);

  const S2 = newState({ mode: 'novice', room: 'banjiha', firstPlay: true, firstPlayRules: RULES });
  const io2 = { light, growth: standGrowth(1) };
  placeBeansprout(S2.firstPlay, DARK, { slots: light.room.slots });
  orderItem(S2, 'siru', 1);
  nextDay(S2, io2); assert.equal(stockOf(S2, 'siru'), 0, '시루가 하루 만에 왔습니다');
  nextDay(S2, io2); assert.equal(stockOf(S2, 'siru'), 1, '시루가 이틀 뒤에도 안 왔습니다');

  info(`상점: ${Object.values(CATALOG).map(c => `${c.ko} ${buyPriceOf(c.id).toLocaleString()}원/${c.leadDays}일`).join(' · ')}`);
});

check('A-2 재고 없이 다시 심을 수 없다 — 공짜로 무한히 나오지 않는다', () => {
  const r = play({ seed: 7, days: 6, farm: 'never', propagate: false, cropSlot: DARK, plantSlot: SILL });
  assert.equal(r.S.firstPlay.beansprout.harvested, true, '첫 수확이 안 났습니다');
  assert.throws(() => resowCrop(r.S, {}), /먼저 주문|배송 중/, '★씨앗 없이 다시 심어졌습니다');
});

check('A-3 용기 없이 못 자른다 — 병은 이틀 걸려 온다', () => {
  const S = newState({ mode: 'novice', room: 'banjiha', firstPlay: true, firstPlayRules: RULES });
  light.clearCache();
  const io = { light, growth: standGrowth(1) };
  placeBeansprout(S.firstPlay, DARK, { slots: light.room.slots });
  /* ★ [물 주기] → [다음 날] → (거둘 때가 되면) [수확하기] → (거뒀으면) 씨앗 주문·다시 심기.
     게임과 같은 순서다 (2026-08-04). ★ 선물은 **3회전째**에 오므로 거기까지 돈다. */
  for (let i = 0; i < 40 && !pot0(S); i++) {
    const b = S.firstPlay.beansprout;
    if (b.harvested) {
      if (stockOf(S, 'bean_seed') < 1 && incomingOf(S, 'bean_seed') < 1)
        try { orderItem(S, 'bean_seed', 1); } catch { /* 다음 날 */ }
      if (stockOf(S, 'bean_seed') >= 1)
        try { resowCrop(S, { at: DARK, slots: light.room.slots }); } catch { /* 다음 날 */ }
    }
    try { waterCrop(S); } catch { /* 이미 준 날 */ }
    try { waterPot(S); } catch { /* 아직 없거나 안 놓은 화분 — 그런 날은 물이 안 든다 */ }
    nextDay(S, io);
    if (beansproutReady(S.firstPlay.beansprout)) harvestCrop(S, io);
  }
  assert.ok(pot0(S), '몬스테라가 안 왔습니다 — 세 번 거둬야 옵니다');
  /* ★★ 2026-08-04 — 도착 개체는 **잎이 한 장**이다(줄기 1개). 잎 한 장짜리 그루에서는
     어느 마디를 잘라도 그루가 통째로 딸려와 초보 규칙(모주가 끝난다)에 먼저 걸린다 —
     그건 용기 규칙이 아니다. 그래서 창턱에서 잎이 두 장이 될 때까지 키운 뒤에 잰다.
     (유효 61에 2개째 줄기의 첫 잎이 난다 — tools/probe_arrival_stems.mjs) */
  setPotSlot(S, pot0(S), SILL, light.room.slots);
  moveMonstera(S.firstPlay, SILL, { slots: light.room.slots });
  for (let i = 0; i < 40 && (io.growth.leafStats().leaves < 2); i++) {
    try { waterCrop(S); } catch { /* 이미 준 날 */ }
    try { waterPot(S); } catch { /* 아직 없거나 안 놓은 화분 — 그런 날은 물이 안 든다 */ }
    nextDay(S, io);
    if (beansproutReady(S.firstPlay.beansprout)) harvestCrop(S, io);
  }
  assert.ok(io.growth.leafStats().leaves >= 2, '★창턱에서 40일이 지나도 잎이 두 장이 안 됐습니다');
  const nodes = cuttableNow(S, io.growth.cuttableNodes());
  const one = nodes.filter(n => n.leaves === 1);
  assert.ok(one.length, '잎 1장짜리 마디가 없습니다');
  /* ★ 밑동(n0#0)은 자르면 그루가 통째로 딸려와 **모주가 끝난다** — 초보 모드가 따로 막는 규칙이다.
     여기서 재려는 것은 "병이 없으면 못 자른다" 하나이므로 그 규칙에 안 걸리는 **위쪽 마디**를 고른다.
     (도착 개체가 줄기 1개로 작아지면서 잎 1장짜리 마디의 첫 자리가 밑동이 됐다 — 2026-08-04) */
  const target = one[one.length - 1];
  assert.notEqual(target.nodeId, nodes[0].nodeId, '밑동 말고 자를 마디가 없습니다');
  assert.throws(() => takeCutting(S, { nodes, nodeId: target.nodeId, container: 'jar' }),
    /먼저 주문|배송 중|필요한데/, '★병 없이 삽수가 잘렸습니다 — 용기가 공짜입니다');
});

/* ══ B · 콩나물 회전 ═════════════════════════════════════════════════ */
check('B 콩나물 — 다시 심을 수 있고 회전이 이어진다 · 절감이 매일 걸린다', () => {
  const r = play({ seed: 3, days: 40, propagate: false, cropSlot: DARK, plantSlot: SILL });
  const b = r.S.firstPlay.beansprout;
  /* ★ 회전이 4일 → **5일**로 늘었다(2026-08-04) — 40일이면 일곱 번 남짓이다 */
  assert.ok(b.harvestCount >= 6, `40일에 수확이 ${b.harvestCount}번뿐입니다 — 회전이 안 돕니다`);
  /* ★★ 2026-08-04 — 하루 상한이 600원에서 **한 회전분(3,000원)** 으로 올랐다(§dailyCropSaveWon).
     그래서 "매일 걸리나"를 날수 × 상한으로 재면 안 된다 — 시루 하나로는 그 상한을 못 채운다.
     ★ 옛 검사가 지키려던 것은 **"거둔 것이 곳간에서 안 새 나가나"** 다. 그건 그대로 잰다:
       거둔 값의 합 = 이미 먹은 것 + 곳간에 남은 것 + 쉬어서 버린 것. 한 푼도 안 새야 한다. */
  const fpS = r.S.firstPlay;
  /* ⚠⚠ 2026-08-16 — 여기서 읽던 `cropKindSavedWon[0]` 의 **뜻이 바뀌었다.**
     예전에는 「콩나물 최상 품질 한 회전분」이었는데, g 셈이 들어오면서 그 표는
     **중간 품질**(300g · 3,000원)을 가리키게 됐다. 이 판은 어두운 자리(DARK)라
     최상 품질이 나오므로 400g = 4,000원이다(first_play §그램).
     ⇒ 「그 시루가 실제로 낸 값」을 묻는다 — 품질을 화면 밖에서 짐작하지 않는다. */
  const cycleWon = cropCycleSavedWon(fpS.rules, fpS.rules.qualityMaxMeals, 0, 0);
  const gotWon = b.harvestCount * cycleWon;                 // 시루 하나 = 겹칠 일이 없다
  const eaten = fpS.food.totalFoodSavedWon;
  /* ⚠⚠ 2026-08-17 — **이 줄이 지키던 등식이 깨졌다.** 옛 줄은
       `먹은 밥값 + 곳간 ≈ 거둔 값` 이었고, 그건 **밥값과 물건 값이 같은 수**일 때만 성립한다.
     확정문 §1 이 둘을 갈랐다(first_play §몫) — 콩나물 300g 은 곳간에서 3,000원이 빠지고
     밥값은 2,500원이 준다. ⇒ 지키려던 것(**거둔 것이 어디로도 안 샌다**)은 그대로 잰다.
     자를 **물건 값**으로 바꾸고, 밥값이 그 g 에 몫 값으로 정확히 맞물리는지를 같이 본다. */
  const drainedWon = gotWon - fpS.food.pantryWon;           // 곳간에서 빠진 물건 값
  assert.ok(drainedWon >= 0 && drainedWon <= gotWon,
    `거둔 ${gotWon}원 · 곳간 ${fpS.food.pantryWon}원 — 곳간이 거둔 것보다 많습니다`);
  const perGram = fpS.rules.cropMealPortionWon / fpS.rules.dailyCropGrams;   // 8.33원/g
  const expectSaved = (drainedWon / 10) * perGram;
  assert.ok(Math.abs(eaten - expectSaved) <= 50,
    `곳간에서 ${drainedWon}원어치가 빠졌는데 밥값은 ${eaten}원입니다 ` +
    `(몫 규칙대로면 ${Math.round(expectSaved)}원) — 어디론가 샜습니다`);
  /* 회전이 5일이므로 40일이면 대략 (40−5)/5 번의 **첫 몫**이 밥값에서 빠져야 한다 */
  const expectMin = fpS.rules.cropMealPortionWon *
    Math.floor((40 - fpS.rules.harvestDays) / fpS.rules.harvestDays) * 0.9;
  assert.ok(eaten > expectMin,
    `총 절감이 ${eaten}원 (기대 ${Math.round(expectMin)}원 이상) — 회전이 안 걸리고 있습니다`);
  info(`회전: 40일에 수확 ${b.harvestCount}번 · 총 절감 ${r.S.firstPlay.food.totalFoodSavedWon.toLocaleString()}원 ` +
       `· 씨앗·시루값 ${r.S.tutorial.crop.spentWon.toLocaleString()}원 ` +
       `(씨앗 ${buyPriceOf('bean_seed').toLocaleString()}원/시루)`);
});

/* ══ B-2 · ★★ 시루를 늘리면 **짜임새**를 사는 것이다 (2026-08-04 박사님 확정) ══════
   ------------------------------------------------------------
   옛 검사는 "시루를 늘려도 절감이 아예 안 는다"였다. 그 규칙은 시루를 살 이유를 없앴다.
   지금 지키는 것은 그 자리에 들어온 새 규칙이다:
     거두는 날이 **어긋나면** 시루마다 온전히 3,000원 · **겹치면** 3,000 → 2,000 → 1,000 → 0원.
   ★ 이 재현은 하루에 [물 주기]를 **한 번** 누른다 = 시루가 하루씩 어긋나게 시작한다.
     그래서 시루를 늘린 판은 저절로 시차가 생긴다 — 그것이 표준 플레이다.

   ══ ⚠⚠ 2026-08-17 — **마지막 단언이 지키던 약속이 뒤집혔다** ═══════════════════
   옛 줄(이 절 맨 끝):
     const same = play({ …, sirus: 3, waterAll: true });
     assert.ok(same.…totalFoodSavedWon < s3,
       '★셋을 같은 날 시작했는데 어긋나게 돌린 것과 절감이 같습니다 — 겹침이 안 물립니다');
   그 줄이 지키던 것은 **「겹치면 밥값 절감이 준다」** 였다.
   박사님이 겹침의 벌을 걷으셨다(first_play §겹침 2026-08-17) —
     *"하루 수확량을 개수에 따라 조절하라는 게 아니었는데… 식량으로 사용할 수 있는
       G수를 조절하란 거지.. 최대 300G로."*
   ⇒ 거두는 양이 같으면 **밥값 절감도 같다.** 하루에 먹는 것이 300g 으로 고정이라
     몰아 거두든 나눠 거두든 매일 300g 씩 먹는다. **그래서 이 부등호는 이제 거짓이다.**
   ★ 그러면 시차의 이득은 어디로 갔나 — **없어지지 않고 자리를 옮겼다.**
     몰아 거두면 하루 300g 을 넘는 몫이 **팔려야** 하고, 팔면 85%다(§잉여 판매의 그 값).
     ⇒ 그래서 부등호를 **밥값 절감이 아니라 「총액(밥값 + 판 돈)」**으로 옮겨야 맞는데,
       그 총액을 이 하네스가 안 센다(판매는 손 동작이고 재현이 안 누른다).
     ⇒ **여기서는 「같다」만 못 박고**, 시차의 값어치는 `tools/probe_crop_grams.mjs` 가 잰다.
       ⚠ 「같다」를 안 적고 지우면, 겹침의 벌이 실수로 되살아나도 아무도 안 잡는다. */
check('B-2 ★시루를 늘리고 어긋나게 돌리면 절감이 는다 — 겹쳐도 이제 안 깎인다', () => {
  const one   = play({ seed: 3, days: 40, propagate: false, cropSlot: DARK, plantSlot: SILL, sirus: 1 });
  const three = play({ seed: 3, days: 40, propagate: false, cropSlot: DARK, plantSlot: SILL, sirus: 3 });
  const s1 = one.S.firstPlay.food.totalFoodSavedWon;
  const s3 = three.S.firstPlay.food.totalFoodSavedWon;
  assert.ok(s3 > s1 * 1.5,
    `★시루를 셋 돌렸는데 절감이 ${s1} → ${s3} 원뿐입니다 — 시차가 값을 못 만들고 있습니다`);
  assert.ok(three.S.tutorial.crop.spentWon > one.S.tutorial.crop.spentWon,
    '★시루를 셋 돌렸는데 씨앗·시루값이 안 늘었습니다 — 늘리는 것이 공짜가 되면 안 됩니다');
  info(`짜임새: 시루 1개 절감 ${s1.toLocaleString()}원 → 시루 3개(하루씩 어긋남) ${s3.toLocaleString()}원 ` +
       `(씨앗·시루값 ${one.S.tutorial.crop.spentWon.toLocaleString()} → ` +
       `${three.S.tutorial.crop.spentWon.toLocaleString()}원)`);
  info(`  ⤷ ⚠ 2026-08-17 — 그날 순번도 작물 종류 순번도 값을 **안 깎는다**(first_play §겹침·§질림). ` +
       `질림은 §몫 의 「같은 작물 둘째 몫 1,200원」이 대신한다. 작물별 한 회전분: ` +
       `${FIRST_PLAY_RULES.cropKindSavedWon.map(w => w.toLocaleString()).join(' → ')}원/회전. ` +
       `★「${RULES.harvestDays}일 주기 = ${RULES.harvestDays}개가 천장」도 같이 없어졌다 — ` +
       `남은 천장은 하루 몫(300g)과 손(체력)이다`);
  /* ★★ 겹쳐도 **안 깎인다** — 같은 판을 **한꺼번에 시작**시켜 확인한다(위 머리말) */
  const same = play({ seed: 3, days: 40, propagate: false, cropSlot: DARK, plantSlot: SILL,
                      sirus: 3, waterAll: true });
  const ss = same.S.firstPlay.food.totalFoodSavedWon;
  /* ⚠⚠ **「같다」로 못 박으면 안 된다 — 재 보고 알았다.** 이 하네스는 시차 판에서
     [물 주기]를 **하루에 하나씩** 누르므로 셋째 시루가 사흘 늦게 출발한다. 같은 40일 안에
     도는 회전 수가 달라서, 겹침의 벌이 없어도 두 값이 안 같다(실측 76,000 vs 68,000).
     ⇒ 여기서 지킬 수 있는 것은 **부등호의 방향**이다: 벌이 살아 있으면 몰아 준 판이
       **더 적었다.** 그 방향이 뒤집힌 것이 이번 변경의 자국이다. */
  assert.ok(ss >= s3,
    `★같은 날 셋을 시작한 판(${ss})이 어긋나게 돌린 판(${s3})보다 밥값 절감이 적습니다 — ` +
    `겹침의 벌이 어디선가 아직 물립니다(2026-08-17 에 걷었다)`);
  info(`  ⤷ 같은 날 셋을 다 시작하면 ${ss.toLocaleString()}원 — 어긋나게 돌린 ` +
       `${s3.toLocaleString()}원보다 **적지 않다**(몰아 주면 회전이 일찍 시작돼 오히려 많다). ` +
       `시차의 값어치는 이제 「하루 300g 을 넘긴 몫을 85%에 팔아야 하는가」에만 남는다`);
});

/* ══ B-3 · ★★ 물은 **회전 시작**이다 (2026-08-04 새 규칙) ══════════════════
   옛 검사가 지키려던 것("물이 회전을 가른다 · 그래도 안 죽는다")을 새 규칙에서 그대로 지킨다.
   달라진 것은 벌의 모양이다: 마른 날이 아니라 **아직 시작을 안 한 것**이다. */
check('B-3 ★물을 줘야 회전이 시작된다 — 안 주면 아무 일도 안 나고, 죽지도 않는다', () => {
  const wet = play({ seed: 3, days: 40, propagate: false, cropSlot: DARK, plantSlot: SILL });
  const never = play({ seed: 3, days: 40, propagate: false, cropSlot: DARK, plantSlot: SILL, water: false });
  const nb = never.S.firstPlay.beansprout;
  assert.equal(nb.ageDays, 0, '★물을 안 줬는데 자랐습니다');
  assert.equal(nb.harvested, false);
  assert.equal(never.S.firstPlay.food.totalFoodSavedWon, 0, '★물을 안 줬는데 절감이 났습니다');
  /* ★ 시들지 않는다 — 시루는 그대로 놓여 있고 **시작을 기다린다** */
  assert.equal(nb.pots.length, 1, '★안 준 시루가 사라졌습니다 — 죽으면 안 됩니다');
  assert.equal(nb.pots[0].startedOnDay, null, '★안 줬는데 시작한 것으로 잡혔습니다');
  const ws = cropWaterStatus(never.S);
  assert.equal(ws.waiting, 1, '★시작을 기다리는 시루가 안 세어졌습니다');
  assert.ok(ws.idleDays >= 39,
    `★며칠째 안 줬는지가 ${ws.idleDays}일뿐입니다 — 화면이 "N일째 물을 안 줬습니다"를 못 말합니다`);
  assert.ok(wet.S.firstPlay.food.totalFoodSavedWon > 0);
  info(`물 = 회전 시작: 주면 40일에 수확 ${wet.S.firstPlay.beansprout.harvestCount}번 · ` +
       `한 번도 안 주면 0번(${ws.idleDays}일째 대기) — 시들지 않고 그대로 기다린다`);
});

/* ══ C · ★막다른 길이 없다 ═══════════════════════════════════════════════ */
check('C 밝은 자리에서 첫 수확을 해도 만회할 수 있다 (cropDark 재시도)', () => {
  const r = play({ seed: 5, days: 60, propagate: false, cropSlot: SILL, plantSlot: SILL });
  assert.equal(r.S.firstPlay.beansprout.harvestCount >= 2, true, '회전이 안 돌았습니다');
  assert.equal(r.S.tutorial.learned.cropDark, false,
    '★밝은 자리에만 뒀는데 cropDark 가 켜졌습니다 — 판정이 헐렁합니다');

  const S = r.S;
  const io = { light, growth: r.growth };
  let got = false;
  for (let i = 0; i < 30 && !got; i++) {
    const b = S.firstPlay.beansprout;
    if (stockOf(S, 'bean_seed') + incomingOf(S, 'bean_seed') < b.sirus)
      try { orderItem(S, 'bean_seed', b.sirus); } catch { /* 파산이면 다음 날 */ }
    if (b.harvested && stockOf(S, 'bean_seed') >= b.sirus)
      resowCrop(S, { at: DARK, slots: light.room.slots });
    try { waterCrop(S); } catch { /* 아직 안 놓은 시루 */ }
    try { waterPot(S); } catch { /* 아직 없거나 안 놓은 화분 — 그런 날은 물이 안 든다 */ }
    nextDay(S, io);
    /* ★ 거둬야 배움이 켜진다 (2026-08-04) — 배움 ①·②의 증거는 거두는 순간에만 온전하다 */
    if (beansproutReady(S.firstPlay.beansprout)) harvestCrop(S, io);
    got = S.tutorial.learned.cropDark;
  }
  assert.equal(got, true, '★어두운 자리로 옮겨 다시 심었는데도 cropDark 가 안 켜졌습니다 — 막다른 길입니다');
  info('막다른 길 없음: 밝은 데서 첫 수확 → 어두운 데로 재파종 → cropDark 회복');
});

check('C-2 자동으로 채워 주지 않는다 — 다시 심어도 어두운 데라야 켜진다', () => {
  const r = play({ seed: 11, days: 60, propagate: false, cropSlot: SILL, plantSlot: SILL });
  assert.equal(r.S.tutorial.learned.cropDark, false, '★재파종만으로 배움이 켜졌습니다');
});

/* ══ D · 아무것도 안 하면 파산한다 (위험이 남아 있다) ═════════════════════ */
check('D 아무것도 안 하면 파산한다 — 다만 게임이 끝나지는 않는다', () => {
  /* ★★ 2026-08-09 — **창을 달력 120 → 140일로 넓혔다.** 파산이 늦어졌기 때문이다.
       시작돈 1,300,000 → 1,500,000원 · 하루 지출 20,000 → 16,667원(월세 30만 → 20만)
       ⇒ 실측 파산일 **튜토 61일(달력 91일) → 튜토 91일(달력 121일)**.
       달력 120일 창은 그 하루 전에서 끊겨 「파산 없음」으로 찍혔다 — 위험이 사라진 것이 아니라
       **자가 짧아진 것**이다. 셈으로도 맞는다: 1,500,000 ÷ 16,667 ≒ 90일.
     ⚠ 창을 넓히는 것으로 끝내지 않는다. 아래 `rows.length >= 100` 이 「파산해도 하루가
       계속된다」를 재는데, 창이 파산일에 딱 붙으면 그것도 못 잰다. 140 이면 19일이 남는다. */
  const r = play({ seed: 2, days: 140, farm: false, propagate: false, cropSlot: DARK, plantSlot: SILL });
  assert.equal(r.everBroke, true, '★아무것도 안 했는데 파산하지 않았습니다 — 위험이 사라졌습니다');
  const broke = r.rows.find(x => x.bankrupt);
  assert.equal(r.rows.length >= 100, true, '★파산으로 하루가 멈췄습니다 — 초보 모드는 죽지 않습니다');
  const after = r.rows[r.rows.length - 1].leaves.leaves;
  assert.ok(after >= broke.leaves.leaves,
    `★파산한 뒤로 그루가 줄었습니다(${broke.leaves.leaves} → ${after})`);
  info(`파산: 튜토 ${broke.tday}일째(게임 ${broke.day}일) · 그 뒤에도 잎 ${broke.leaves.leaves} → ${after}장`);
});

check('D-2 콩나물을 돌리면 돈이 덜 준다 — 그게 콩나물의 값어치다', () => {
  const bare = play({ seed: 2, days: 120, farm: false, propagate: false, cropSlot: DARK, plantSlot: SILL });
  const farm = play({ seed: 2, days: 120, propagate: false, cropSlot: DARK, plantSlot: SILL });
  const at = t => (bare.rows.find(r => r.tday === t) || {}).cashWon;
  const bt = t => (farm.rows.find(r => r.tday === t) || {}).cashWon;
  /* ★★ 2026-08-04 — **본전을 뽑는 날을 찾는다.** 예전에는 튜토 29일 한 지점만 봤는데,
     새 수치(5일 3,000원)에서는 순액이 하루 180원뿐이라 초반에는 씨앗값이 앞선다.
     첫 플레이 구간(살림이 멈춘 며칠)에는 절감이 지갑에 안 실리는데 씨앗값은 나가기 때문이다.
     그래서 "언제부터 이득인가"를 재고, **튜토가 끝나기 전에 그날이 오는지**를 검사한다. */
  let cross = null;
  for (let t = 1; t <= 90; t++) { if (at(t) != null && bt(t) != null && bt(t) > at(t)) { cross = t; break; } }
  assert.ok(cross != null && cross <= 57,
    `★콩나물이 90일 안에(또는 이사 전에) 본전을 못 뽑습니다 — 돌릴 이유가 없습니다 ` +
    `(튜토 29일: 맨몸 ${at(29)} vs 회전 ${bt(29)})`);
  const D = 57;                                     // 이사 중앙값 — 튜토를 다 산 시점
  const net = Math.round((bt(D) - at(D)) / D);
  info(`콩나물 값어치: 튜토 ${cross}일부터 이득으로 돌아서고, ${D}일에 ` +
       `${(bt(D) - at(D)).toLocaleString()}원 더 남는다 ` +
       `(하루 ${net.toLocaleString()}원 · 씨앗값 낸 뒤 순액)`);
  /* ★★ 씨앗값을 1,500 → 1,000원으로 내린 뒤(2026-08-04) 순액이 얼마가 됐나를 **재서** 낸다.
     ⚠ 지갑에서 나가는 씨앗값의 정본은 `shop.CATALOG.bean_seed.listWon` 이다
       (first_play 의 seedWonPerSiru 는 표시용이라 그것만 고치면 순액이 안 바뀐다). */
  info(`  ⤷ ★씨앗 ${buyPriceOf('bean_seed').toLocaleString()}원/시루 기준 순액 ` +
       `**하루 ${net.toLocaleString()}원** — 하루 지출 20,000원의 ${(net / 20000 * 100).toFixed(1)}%. ` +
       `(1,500원이던 때 하루 100원 = 0.5%. 보고 ① 참고)`);
});

/* ══ E · 값 공식 — 잎 한 장씩 매기고 무늬 잎 장수가 등급을 정한다 (shop.js §6) ══
   ★ 2026-08-04 전면 개편. 옛 공식(`× (1+60·v²)`, v=무늬 잎 **비율**)은 잎이 적을수록 값이
     올라서 **잘 키우는 것이 손해**였다 — 잎 1장짜리 무늬 삽수가 732,000원이었다.
     여기서 재는 것은 그 병이 실제로 뒤집혔나다. */
check('E 값 — 잎 2장 이하로는 이사비가 안 된다 · 키워서 팔기가 떼어 팔기보다 이득이다', () => {
  assert.equal(priceOf({ leaves: 1, variegatedLeaves: 0 }).won, 12_000, '민무늬 삽수 잎1');
  /* ★ 정본(sale_economy.md)이 원래 적어 둔 「몬스테라 삽수(알보) 80,000」 그 값이다.
     옛 공식은 같은 물건을 732,000원으로 읽었다 — 정본에 없던 값이었다. */
  assert.equal(priceOf({ leaves: 1, variegatedLeaves: 1 }).won, 80_000, '무늬 삽수 잎1 (산반)');
  /* ★ 2026-08-09 — **1,830,000 → 2,133,333원.** 하프문 배수를 61 → 640/9(≈71.11) 로 올려서다.
     ⚠ 값이 오른 게 아니라 **사다리가 제 모양이 된 것**이다 — 산반 8 과 섹터 320/9 는 실제
       시장가인데 하프문 61 만 옛 공식의 상한(`1+60·1²`)을 물려받은 값이었고, 그래서
       산반→섹터가 4.4배 뛰는데 섹터→하프문은 1.7배뿐이었다. 이제 섹터의 정확히 두 배다.
     ⚠ 왜 지금 올렸나 — **이사비 200만을 하프문 하나로 넘기기 위해서다.** 61 이면 191만이라
       9만원이 모자라 `G-3` 이 이사 성공 0/40 으로 잡았다. */
  assert.equal(priceOf({ leaves: 3, variegatedLeaves: 3 }).won, 2_133_333, '무늬 성체 잎3(하프문)');
  /* ★ 잎 2장은 아무리 무늬여도 이사비에 못 닿는다 — 「마지막 한 장이 이사를 만든다」의 근거다 */
  assert.ok(priceOf({ leaves: 2, variegatedLeaves: 2 }).won < TUTORIAL_RULES.moveOutCostWon,
    '★잎 2장(섹터)으로 이사비에 닿습니다 — 하프문이 필요 없어집니다');

  /* ★★ ① 잎 수에 우상향이다 — 잎이 늘어서 값이 **주는** 자리가 하나도 없어야 한다 */
  for (let v = 0; v <= 6; v++)
    for (let n = Math.max(1, v); n < 12; n++) {
      const a = priceOf({ leaves: n, variegatedLeaves: v }).won;
      const b = priceOf({ leaves: n + 1, variegatedLeaves: v }).won;
      assert.ok(b > a, `★잎 ${n}→${n + 1}장(무늬 ${v})에서 값이 ${a}→${b} 로 떨어집니다 — 잘 키운 벌입니다`);
    }
  /* ② 무늬 잎이 늘어서 값이 주는 자리도 없어야 한다 */
  for (let n = 1; n <= 12; n++)
    for (let v = 0; v < n; v++)
      assert.ok(priceOf({ leaves: n, variegatedLeaves: v + 1 }).won >
                priceOf({ leaves: n, variegatedLeaves: v }).won,
        `★잎 ${n}장에서 무늬 ${v}→${v + 1}장인데 값이 안 늘었습니다`);

  /* ★★ ③ 떼어 팔기가 통째로 파는 것을 **절대 못 이긴다** — 이 개편의 목적이다.
     그루를 두 조각으로 나누는 모든 방법을 다 해 본다. */
  let worstGain = -Infinity, worstAt = null;
  for (let n = 2; n <= 8; n++)
    for (let v = 0; v <= n; v++) {
      const whole = priceOf({ leaves: n, variegatedLeaves: v }).won;
      for (let n1 = 1; n1 < n; n1++)
        for (let v1 = Math.max(0, v - (n - n1)); v1 <= Math.min(v, n1); v1++) {
          const split = priceOf({ leaves: n1, variegatedLeaves: v1 }).won +
                        priceOf({ leaves: n - n1, variegatedLeaves: v - v1 }).won;
          if (split - whole > worstGain) { worstGain = split - whole; worstAt = `잎${n}·무늬${v} → ${n1}+${n - n1}`; }
        }
    }
  /* ★ 0 이 아니라 **용기값**을 기준으로 잰다. 소품 하한(shop.js §소품 하한) 때문에 아주 작은
     그루에서만 몇 천 원이 남는데, 자르려면 용기가 하나 들어서 실제로는 손해다.
     하한을 없애면 정확히 0 이 되지만 정본의 「몬스테라 삽수 12,000」이 깨진다 — 그 판단은
     shop.js 에 적어 뒀다. 여기서 재는 것은 **실비를 넘는 이득이 있나**다. */
  const JAR = buyPriceOf('jar');
  assert.ok(worstGain < JAR,
    `★떼어 팔기가 ${worstGain.toLocaleString()}원 더 남습니다(${worstAt}) — 용기값 ${JAR.toLocaleString()}원을 넘으면 ` +
    `뜯어 파는 것이 실제로 최적이 됩니다`);
  info(`떼어 팔기 최대 이득 ${worstGain.toLocaleString()}원 (${worstAt}) — 용기값 ${JAR.toLocaleString()}원보다 작아야 ` +
       `"키워서 팔기"가 성립한다 (옛 공식에서는 잎3·무늬3 을 쪼개면 ${(3 * 732_000 - 1_830_000).toLocaleString()}원 더 남았다)`);

  const rows = [];
  for (const n of [1, 2, 3, 6, 9, 12]) {
    const r = varieLeavesNeededFor(MOVE_OUT_WON, { leaves: n });
    rows.push(`잎${n}:${r.needVarieLeaves === null ? '불가' : r.needVarieLeaves + '장'}`);
    if (n <= 2) assert.equal(r.needVarieLeaves, null, `★잎 ${n}장 삽수로 150만이 나왔습니다`);
    else assert.ok(r.wonAtNeed >= MOVE_OUT_WON, `잎 ${n}장 역산이 목표에 못 미칩니다`);
  }
  info('150만 역산 — ' + rows.join(' · '));
});

/* ══ F · 무늬 확률 — 자리와 등이 실제로 확률을 가른다 ════════════════════ */
check('F 무늬 확률 — 반지하는 등을 켜도 무늬 최적 대역에 못 들어간다', () => {
  const MON = TH.plants.monstera_deliciosa;
  const NEED_MULT = TH.need_mult ?? 1.4;
  const F = GT.f_light;
  const fLightOf = d => (d < MON.min ? F.below_min
    : d < MON.best_lo * NEED_MULT ? F.below_best
    : d <= MON.best_hi * NEED_MULT ? F.best
    : d <= MON.max ? F.below_max : F.over);
  const p = d => Math.min(1, 0.20 * fLightOf(d) * GT.f_stable.mult_stable);
  info(`무늬 대역(최적) = ${(MON.best_lo * NEED_MULT).toFixed(1)} ~ ${(MON.best_hi * NEED_MULT).toFixed(1)} DLI`);
  info(`잎당 무늬 확률 — 창턱 3.77: ${(p(3.77) * 100).toFixed(1)}% · 등1개 5.61: ${(p(5.61) * 100).toFixed(1)}% · ` +
       `등2개 5.76: ${(p(5.76) * 100).toFixed(1)}% · (참고) 최적 8.0: ${(p(8.0) * 100).toFixed(1)}%`);
  assert.ok(p(5.76) < p(8.0),
    '반지하 등 2개가 최적 대역과 같은 확률입니다 — 프로파일이 바뀌었으면 이 검사를 고쳐 주세요');
  info('★그래서 이사 자금을 확률에 맡기지 않는다 — 튜토는 확정 무늬로 마무리한다(검사 H)');
});

/* ══ P · ★삽수 판매 — 얼마에 · 얼마나 자주 · 남는가 ══════════════════════ */
const P90 = play({ seed: 4, days: 90, cropSlot: DARK, plantSlot: SILL, noGrant: true });

check('P-1 삽수는 **뿌리내려야** 팔린다 — 자른 날 바로 못 판다', () => {
  assert.ok(P90.firstCutDay != null, '삽수를 한 번도 못 잘랐습니다 — 병이 안 왔거나 마디가 없습니다');
  assert.ok(P90.firstSellDay != null, '삽수가 뿌리를 못 내 팔리지 않았습니다');
  const gap = P90.firstSellDay - P90.firstCutDay;    // ★게임일로 잰다(튜토 일자는 첫 플레이 동안 안 간다)
  assert.equal(gap, METHODS.water.rootDays,
    `자르고 판 사이가 ${gap}일 — 물꽂이 ${METHODS.water.rootDays}일이라야 합니다`);
  info(`삽수 회전: 병 주문(${CATALOG.jar.leadDays}일) → 자르기(튜토 ${P90.firstCutDay}일) → ` +
       `뿌리 ${METHODS.water.rootDays}일 → 판매(튜토 ${P90.firstSellDay}일) = 한 개에 ` +
       `${CATALOG.jar.leadDays + METHODS.water.rootDays}일`);
});

check('P-2 ★무한 증식이 안 된다 — 잘라낸 잎의 합이 모주의 잎을 못 넘는다', () => {
  const S = P90.S, pot = pot0(S);
  assert.ok(pot, '모주가 없습니다');
  const raw = P90.growth.leafStats();
  const lost = (pot.pendingCutLoss || {}).leaves || 0;
  assert.ok(lost <= raw.leaves,
    `★잘라낸 잎 ${lost}장 > 모주가 낸 잎 ${raw.leaves}장 — 없는 잎이 팔렸습니다`);
  const v = varieView(S, { nodes: P90.growth.cuttableNodes(), stats: raw });
  const b = cutBudgetOf(S, v.nodes);
  for (const n of cuttableNow(S, v.nodes))
    assert.ok(n.leaves <= b.leftLeaves,
      `★남은 잎 ${b.leftLeaves}장인데 잎 ${n.leaves}장짜리 마디가 열려 있습니다`);
  info(`유한성: 90일에 삽수 ${P90.cuttingsSold}개 · 잘라낸 잎 ${lost}장 / 모주가 낸 잎 ${raw.leaves}장 ` +
       `(남은 잎 ${b.leftLeaves}장)`);
});

check('P-3 ★용기값·시간을 빼고도 남는다 — 다만 하루 지출에 견주면 아주 작다', () => {
  const gross = P90.cuttingIncome;                     // 민무늬 삽수만
  const net = gross - P90.containerSpend;
  assert.ok(P90.cuttingsSold >= 1, '90일에 삽수를 한 개도 못 팔았습니다');
  assert.ok(net > 0, `★용기값을 빼면 ${net}원 — 팔아도 안 남습니다`);
  info(`꾸준수입: 90일에 민무늬 삽수 ${P90.cuttingsSold}개 ${gross.toLocaleString()}원 − ` +
       `병값 ${P90.containerSpend.toLocaleString()}원 = 순 ${net.toLocaleString()}원 ` +
       `(하루 ${Math.round(net / 90).toLocaleString()}원)`);
  info(`  ⤷ 하루 지출 ${TUTORIAL_RULES.dailySpendWon.toLocaleString()}원의 ` +
       `${(net / 90 / TUTORIAL_RULES.dailySpendWon * 100).toFixed(1)}% — ` +
       `**꾸준수입만으로는 반지하를 못 나간다**(sale_economy.md §0 과 같은 결론)`);
});

/* ══ H · ★튜토 확정 무늬 ═══════════════════════════════════════════════ */
check('H-1 확정 무늬는 **플레이어가 한 일**에 붙는다 — 조건 다섯을 다 봐야 열린다', () => {
  const S = newState({ mode: 'novice', room: 'banjiha', firstPlay: true, firstPlayRules: RULES });
  let c = varieGrantCheck(S, {});
  assert.equal(c.ok, false, '★아무것도 안 했는데 확정 무늬가 열렸습니다');
  assert.match(c.why, /못 해 본 것/, `사유가 배움이 아닙니다: ${c.why}`);

  for (const k of Object.keys(S.tutorial.learned)) S.tutorial.learned[k] = true;
  c = varieGrantCheck(S, {});
  assert.equal(c.ok, false, '★배움만으로 확정 무늬가 열렸습니다 — 삽수 조건이 없습니다');
  assert.match(c.why, /잘라 보지/, `사유가 삽수가 아닙니다: ${c.why}`);

  /* 모주에서 한 번 잘라 봤다 — 모주가 그 사실을 적어 둔다(propagation.takeCutting) */
  S.pots.push({ id: 'pot_01', slotId: SILL, at: null, plantId: 'monstera_deliciosa',
                cuts: [{ day: 1, cuttingId: 'cut_01', nodeId: 'n0#2', stem: 'pink', leaves: 1 }],
                pendingCutLoss: { leaves: 1, nodes: 1 } });

  /* ★★★ 2026-08-09 — **지갑을 문턱 아래로 내려놓고 잰다.** 안 그러면 계절을 못 잰다.
     시작돈이 1,500,000원이 되면서 `moveOutCostWon`(1,500,000)과 **같아졌다.** 그래서
     아무것도 안 한 새 판이 이미 「다 팔면 이사 자금에 닿는 상태」이고, `varieGrantCheck` 가
     계절을 보기도 전에 그 사유로 막는다. 여기서 재려는 것은 **계절 게이트**이므로
     다른 게이트를 먼저 열어 둬야 한다 — 아래 §다 팔면 닿는 상태 검사가 이미 쓰는 수법이다.
     ⚠ 이건 재현 편의가 아니라 **실제 게임에서 일어나는 일**이다: 시작돈 = 이사비라서
       확정 무늬가 첫날부터 「필요 없음」으로 닫혀 있다. plan 이 판단할 것으로 인계에 적었다. */
  S.tutorial.cashWon = MOVE_OUT_WON - 1;

  /* ★ 가을 게이트 (2026-08-03) — 배움·삽수를 다 채워도 **여름에는 안 온다.**
     이게 없으면 튜토가 여름 안에 끝나 가을·식물등·겨울 콘텐츠를 아무도 못 본다. */
  const OPEN = varieGrantOpensDay(S.tutorial);
  assert.ok(OPEN > 0, `가을 진입일이 ${OPEN}일입니다 — 게이트가 아무 일도 안 합니다`);
  S.tutorial.day = OPEN - 1;
  let sc = varieGrantCheck(S, {});
  assert.equal(sc.ok, false, '★여름인데 확정 무늬가 열렸습니다 — 가을 게이트가 없습니다');
  assert.match(sc.why, /가을/, `사유가 계절이 아닙니다: ${sc.why}`);
  assert.equal(seasonAt(S.tutorial, S.tutorial.day), 'summer', '게이트 하루 전이 여름이 아닙니다');

  S.tutorial.day = OPEN;
  assert.equal(seasonAt(S.tutorial, S.tutorial.day), 'autumn',
    `튜토 ${OPEN}일이 가을이 아닙니다 — 게이트 날짜가 계절과 어긋났습니다`);
  assert.equal(varieGrantCheck(S, {}).ok, true, '조건을 다 채웠는데 안 열립니다');

  const cash = S.tutorial.cashWon;
  S.tutorial.cashWon = MOVE_OUT_WON;
  assert.equal(varieGrantCheck(S, {}).ok, false, '★이사 자금이 찼는데도 확정 무늬가 열립니다');
  S.tutorial.cashWon = cash;

  /* 다 팔면 닿는 상태면 안 준다 — 필요한 만큼만 주고 한 장도 더 안 준다.
     ★ 잎 4장 중 4장 무늬로 잡는다. 위에서 이미 한 마디(잎 1장)를 잘라 뒀으므로
       실제로 세는 것은 잎 3장·무늬 3장 = 1,830,000원 이고 이사 자금(150만)을 넘는다.
       ⚠ 예전에는 잎 3장으로 잡았는데(=세는 것은 잎 2장), 값 개편(2026-08-04)으로
         잎 2장짜리는 아무리 무늬여도 160,000원이라 더 이상 닿지 않는다. 그게 이 개편의
         목적 자체다 — **작은 그루로는 150만이 안 된다.** 그래서 검사가 재는 뜻은 그대로 두고
         「닿는 상태」를 지금 값으로 다시 잡았다. */
  assert.equal(varieGrantCheck(S, { stats: { leaves: 4, variegatedLeaves: 4 } }).ok, false,
    '★다 팔면 이사 자금에 닿는데도 무늬를 또 줍니다');
  /* 방금 받았으면 12일은 안 준다 */
  S.tutorial.varieGrant.lastDay = S.tutorial.day;
  assert.equal(varieGrantCheck(S, {}).ok, false, '★받자마자 또 줍니다 — 간격이 안 걸립니다');
  S.tutorial.day += 12;
  assert.equal(varieGrantCheck(S, {}).ok, true, '12일이 지났는데도 안 옵니다');
  info(`확정 무늬 조건: 튜토 중 · 배움 넷 · 삽수를 한 번 잘라 봤다 · 다 팔아도 이사 자금에 못 닿는다 · ` +
       `★가을 진입(튜토 ${OPEN}일) · 12일 간격`);
});

check('H-2 ★정식 모드로 새지 않는다 — 튜토가 없으면 상태도 덧씌우기도 없다', () => {
  const nodes = [{ nodeId: 'n0#0', stem: 'pink', leaves: 2, variegatedLeaves: 0, growthDays: 100 }];
  const stats = { leaves: 2, variegatedLeaves: 0, matureLeaves: 0, growthDays: 143 };

  /* ① 튜토가 꺼진 판 */
  const free = newState({ mode: 'real', room: 'banjiha' });
  assert.equal(varieGrantCheck(free, {}).ok, false, '★튜토가 아닌데 확정 무늬가 열립니다');
  const vFree = varieView(free, { nodes, stats });
  assert.deepEqual(vFree.stats, stats, '★튜토가 아닌데 잎 집계가 덧씌워졌습니다');
  assert.equal(vFree.granted.length, 0);
  assert.equal(stepVarieGrant(free, { nodes, stats }).granted, false, '★정식 모드에서 무늬가 주어졌습니다');

  /* ② 이사한 뒤 — 확정 무늬는 반지하에서 끝난다 */
  const done = newState({ mode: 'novice', room: 'banjiha', firstPlay: true, firstPlayRules: RULES });
  for (const k of Object.keys(done.tutorial.learned)) done.tutorial.learned[k] = true;
  done.tutorial.varieGrant.nodeIds = ['n0#0'];
  done.tutorial.movedOut = true;
  assert.equal(varieGrantCheck(done, {}).ok, false, '★이사한 뒤에도 확정 무늬가 열립니다');
  assert.deepEqual(varieView(done, { nodes, stats }).stats, stats,
    '★이사한 뒤에도 잎 집계가 덧씌워집니다');
  assert.equal(stepVarieGrant(done, { nodes, stats }).granted, false, '★이사한 뒤에도 무늬가 주어집니다');

  /* ③ growth 는 아무 영향도 안 받는다 — 같은 씨앗·같은 날이면 잎 집계가 똑같다 */
  const before = (() => { const g = standGrowth(31); let c = ARRIVAL.growthDays;
    for (let i = 0; i < 60; i++) { g.setDailyLight(3.77); g.advanceTo(++c); }
    return JSON.stringify(g.leafStats()); })();
  const r = play({ seed: 31, days: 60, cropSlot: DARK, plantSlot: SILL });
  const after = (() => { const g = standGrowth(31); let c = ARRIVAL.growthDays;
    for (let i = 0; i < 60; i++) { g.setDailyLight(3.77); g.advanceTo(++c); }
    return JSON.stringify(g.leafStats()); })();
  assert.equal(after, before,
    '★확정 무늬가 돈 뒤로 growth 의 잎 집계가 달라졌습니다 — 확률을 건드렸습니다');
  info('누출 없음: 정식 모드·이사 뒤에는 상태도 덧씌우기도 없고, growth 굴림은 한 글자도 안 바뀐다');
});

check('H-3 저장·복원을 해도 확정 무늬가 두 번 나지 않는다', async () => {
  /* 세이브 왕복은 tools/test_save.mjs 가 본다. 여기서는 **화이트리스트에 실렸는지**만 본다 —
     안 실리면 저장 한 번에 잭팟이 두 번 난다. */
  const { serialize } = await import('../src/game/save.js');
  const S = newState({ mode: 'novice', room: 'banjiha', firstPlay: true, firstPlayRules: RULES });
  S.tutorial.varieGrant.nodeIds = ['n0#2'];
  S.tutorial.varieGrant.count = 1;
  const packed = serialize(S, { now: new Date('2026-08-03T00:00:00Z') }).state.tutorial.varieGrant;
  assert.deepEqual(packed.nodeIds, ['n0#2'], '★확정 무늬 마디가 세이브에서 사라졌습니다');
  assert.equal(packed.count, 1, '★준 횟수가 세이브에서 사라졌습니다');
});

/* ══ G · ★세 경로 — 시드 40판 ═══════════════════════════════════════════ */
const SEEDS = Array.from({ length: 40 }, (_, i) => i + 1);
function runRoute(name, opt) {
  const runs = SEEDS.map(seed => play({ ...opt, seed }));
  const ok = runs.filter(r => r.movedOut);
  const days = ok.map(r => r.lastDay);
  const rate = ok.length / runs.length;
  const seasons = {};
  for (const r of ok) seasons[r.season] = (seasons[r.season] || 0) + 1;
  const grant = ok.map(r => r.grantDay).filter(v => v != null);
  info(`${name} — 이사 성공 ${ok.length}/${runs.length} (${(rate * 100).toFixed(0)}%)` +
       (days.length ? ` · 중앙값 튜토 ${median(days)}일 · 최선 ${Math.min(...days)}일 · 최악 ${Math.max(...days)}일` +
                      ` · 계절 ${Object.entries(seasons).map(([k, v]) => k + ':' + v).join(' ')}` +
                      (grant.length ? ` · 확정 무늬 중앙값 ${median(grant)}일` : '')
                    : ' · **한 판도 못 나갔다**'));
  if (ok.length)
    info(`  ⤷ 수입 내역(중앙값) — 민무늬 삽수 ${median(ok.map(r => r.cuttingIncome)).toLocaleString()}원 · ` +
         `★확정 무늬 삽수 ${median(ok.map(r => r.varieIncome)).toLocaleString()}원 · ` +
         `모주 ${median(ok.map(r => r.potIncome)).toLocaleString()}원 · ` +
         `병값 ${median(ok.map(r => r.containerSpend)).toLocaleString()}원`);
  return { runs, ok, days, rate };
}

const A = runRoute('경로 A (등 없이 · 바로 삽수)', { cropSlot: DARK, plantSlot: SILL, buyLamp: false, days: 240 });
const B = runRoute('경로 B (등 사고 · 바로 삽수)', { cropSlot: DARK, plantSlot: SILL, buyLamp: true, days: 240 });
const C = runRoute('경로 C (한 박자 늦게 · 튜토 12일부터 · 겨울까지 달린다)',
  { cropSlot: DARK, plantSlot: SILL, buyLamp: true, startCutDay: 12, days: 360 });

check('G-1 경로 C — 한 박자 늦게 시작해도 막히지 않는다', () => {
  const r = C.runs[0];
  const last = r.rows[r.rows.length - 1];
  assert.ok(r.firstCutDay == null || r.firstCutDay >= 12,
    `삽수를 12일부터 시작하기로 했는데 ${r.firstCutDay}일에 잘랐습니다`);
  assert.ok(last.tday >= 12 || r.movedOut, `튜토 ${last.tday}일에서 멈췄습니다`);
});

check('G-2 잭팟이 나면 실제로 이사가 된다 — 수입이 주입되지 않았다', () => {
  assert.ok(A.ok.length + B.ok.length + C.ok.length > 0,
    '★한 판도 못 나갔습니다 — 판매·이사 배선이 끊겼습니다');
  const r = (A.ok[0] || B.ok[0] || C.ok[0]);
  assert.equal(r.S.tutorial.movedOut, true);
  const total = r.varieIncome + r.cuttingIncome + r.potIncome;
  assert.ok(total > 0, '★판 돈이 0인데 이사했습니다 — 수입이 주입되고 있습니다');
  assert.equal(r.S.shop.earnedWon, total, '상점 장부와 재현이 센 수입이 다릅니다');
  info(`예: 튜토 ${r.grantDay}일에 확정 무늬(${r.grantNode}) → ${r.lastDay}일에 이사 ` +
       `(확정 무늬 ${r.varieIncome.toLocaleString()}원 + 민무늬 삽수 ${r.cuttingIncome.toLocaleString()}원 ` +
       `+ 모주 ${r.potIncome.toLocaleString()}원)`);
});

check('G-2b ★세 경로가 중앙값 안에 성립한다', () => {
  const bad = [['A', A], ['B', B], ['C', C]].filter(([, r]) => r.rate < 0.5);
  assert.equal(bad.length, 0,
    `중앙값으로 이사하지 못하는 경로: ${bad.map(([n, r]) => `${n} ${(r.rate * 100).toFixed(0)}%`).join(' · ')}`);
});

/* ★★ [해결 2026-08-03] 예전에는 셋 다 **여름 안에** 끝나서 WARN(판단필요)으로 남겨 두었다.
   확정 무늬에 **가을 게이트**를 걸어(tutorial.varieGrantOpensDay) 해결했다 —
   확정 수치(자금 100만·하루 2만·월세 30만·유예 30일·이사 150만)는 한 글자도 안 바꿨다.
   이제는 검사다. 여기가 빨개지면 가을·식물등·겨울 콘텐츠를 아무도 못 보는 상태로 돌아간 것이다. */
check('G-2c ★세 경로가 여름을 넘겨 끝난다 — 가을·식물등·겨울 콘텐츠를 실제로 만난다', () => {
  const all = [...A.ok, ...B.ok, ...C.ok];
  const summer = all.filter(r => r.season === 'summer');
  assert.equal(summer.length, 0,
    `★이사한 판 ${all.length}개 중 ${summer.length}개가 아직 여름에 끝납니다 ` +
    `(가장 빠른 것 튜토 ${Math.min(...summer.map(r => r.lastDay))}일) — ` +
    `그 판은 계절 전환도 식물등 해금도 못 봅니다`);
  /* 확정 무늬가 실제로 가을 이후에만 온다 — 게이트가 살아 있다는 증거 */
  const OPEN = varieGrantOpensDay(A.ok[0].S.tutorial);
  const early = all.filter(r => r.grantDay != null && r.grantDay < OPEN);
  assert.equal(early.length, 0,
    `★확정 무늬가 가을(튜토 ${OPEN}일) 전에 온 판이 ${early.length}개 있습니다`);
  const seasons = {};
  for (const r of all) seasons[r.season] = (seasons[r.season] || 0) + 1;
  info(`계절 분포(세 경로 합계 ${all.length}판) — ` +
       Object.entries(seasons).map(([k, v]) => `${k}:${v}`).join(' ') +
       ` · 가을 진입은 튜토 ${OPEN}일`);
});

/* ★★ 가을 게이트를 걸면 **돈이 버티는가** — 확정 수치를 안 바꾸고 산수만 다시 재는 자리다.
   시작 100만 · 하루 지출 2만(월세 몫 포함) · 30일마다 월세 30만 · 이사 150만.
   ⚠ 파산해도 하루는 계속 간다(story_arc.md §0). 다만 파산하면 병(7,000원)을 못 사서
     **자를 수가 없어지므로**, "파산 전에 자르기·확정 무늬가 도는가"가 진짜 질문이다. */
check('G-2d ★돈이 버틴다 — 가을(튜토 45일)에 잔액이 남고, 파산 전에 잭팟이 돈다', () => {
  const OPEN = varieGrantOpensDay(A.ok[0].S.tutorial);
  const at = (r, t) => { const x = r.rows.find(v => v.tday === t); return x ? x.cashWon : null; };
  for (const [name, R] of [['A', A], ['B', B], ['C', C]]) {
    const cash = t => median(R.ok.map(r => at(r, t)).filter(v => v != null));
    const brokeBefore = R.ok.filter(r => {
      const b = r.rows.find(v => v.bankrupt);
      return b && r.grantDay != null && b.tday < r.grantDay;
    }).length;
    info(`${name} 잔액 중앙값 — 튜토 29일 ${(cash(29) || 0).toLocaleString()}원 · ` +
         `30일(첫 월세) ${(cash(30) || 0).toLocaleString()}원 · ` +
         `${OPEN}일(가을·확정 무늬) ${(cash(OPEN) || 0).toLocaleString()}원 · ` +
         `57일 ${(cash(57) || 0).toLocaleString()}원 · ` +
         `이사한 판 중 확정 무늬 전에 파산한 판 ${brokeBefore}/${R.ok.length}`);
    assert.ok((cash(OPEN) || 0) > 0,
      `★${name}: 가을(튜토 ${OPEN}일)에 잔액 중앙값이 ${cash(OPEN)}원입니다 — 게이트까지 돈이 안 버팁니다`);
    assert.equal(brokeBefore, 0,
      `★${name}: ${brokeBefore}판이 확정 무늬가 오기 전에 파산했습니다 — 병을 못 사 자르지 못합니다`);
  }
  /* ★ 잭팟 뒤에 실제로 150만을 넘는가 — 넘겨야 이사가 성립한다 */
  const over = A.ok.filter(r => r.S.tutorial.cashWon >= 0 &&
    (r.varieIncome + r.cuttingIncome + r.potIncome) > 0).length;
  assert.equal(over, A.ok.length, '★판 돈 없이 이사한 판이 있습니다');
  const gross = median(A.ok.map(r => r.varieIncome + r.cuttingIncome + r.potIncome));
  info(`잭팟 총액 중앙값 ${gross.toLocaleString()}원 (이사 자금 ${MOVE_OUT_WON.toLocaleString()}원)`);
  assert.ok(gross >= MOVE_OUT_WON - 1_000_000,
    `★잭팟 총액 중앙값이 ${gross}원 — 이사 자금에 견주어 너무 작습니다`);
});

check('G-3 ★확정 무늬가 이사를 만든다 — 없으면 못 나간다 (대조군)', () => {
  const off = SEEDS.slice(0, 20).map(seed =>
    play({ seed, days: 240, cropSlot: DARK, plantSlot: SILL, noGrant: true }));
  const okOff = off.filter(r => r.movedOut).length;
  info(`대조군(확정 무늬를 매일 걷어 냄) — 이사 성공 ${okOff}/20 vs 경로 A ${A.ok.length}/40 ` +
       `(${(A.rate * 100).toFixed(0)}%)`);
  assert.ok(okOff / 20 < A.rate,
    `★확정 무늬가 없어도 같은 비율로 나갑니다(${okOff}/20) — 이 규칙이 아무 일도 안 하고 있습니다`);
});

check('G-4 ★삽수를 안 팔면 확정 무늬도 안 온다 — 꾸준수입이 전제조건이다', () => {
  const noSell = SEEDS.slice(0, 20).map(seed =>
    play({ seed, days: 240, cropSlot: DARK, plantSlot: SILL, varieOnly: true }));
  const okNo = noSell.filter(r => r.movedOut);
  const withSell = A.runs.slice(0, 20).filter(r => r.movedOut);
  info(`꾸준수입 유무 — 자르며 감 ${withSell.length}/20 (중앙값 ${median(withSell.map(r => r.lastDay))}일) · ` +
       `안 자르고 기다림 ${okNo.length}/20` +
       (okNo.length ? ` (중앙값 ${median(okNo.map(r => r.lastDay))}일)` : ' — **영영 못 나간다**'));
  assert.ok(withSell.length > okNo.length,
    '★삽수를 안 팔아도 같은 비율로 나갑니다 — 꾸준수입이 아무 일도 안 하고 있습니다');
});

/* ── 보고 ─────────────────────────────────────────────────────────────── */
let fail = 0, judge = 0;
for (const [st, name, msg] of results) {
  if (st === 'INFO') { console.log(name); continue; }
  if (st === 'FAIL') fail++;
  if (st === 'WARN') judge++;
  console.log(`${st}  ${name}${msg ? '\n      → ' + msg : ''}`);
}
console.log(fail ? `\nbanjiha_routes: FAIL (${fail}건)`
                 : `\nbanjiha_routes: PASS${judge ? ` (⚠ 기획 판단필요 ${judge}건 — 위 WARN)` : ''}`);
process.exit(fail ? 1 : 0);
