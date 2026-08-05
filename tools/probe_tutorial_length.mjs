/* ★ 219일을 줄이는 길이 몇 개고, 각각 무엇을 대가로 내는가 — 재기만 한다
 *
 *   node tools/probe_tutorial_length.mjs              전체(후보 × 세 경로 + 딸린 검사)
 *   node tools/probe_tutorial_length.mjs --quick      세 경로만 (딸린 검사 생략)
 *   node tools/probe_tutorial_length.mjs --only=㉠a3  후보 하나만
 *
 * `test_balance_routes.mjs ①-2 · ③-b` 두 FAIL 은 사실 한 문제다 — "튜토가 통째로 길다".
 * 이 도구는 **그 길이를 줄이는 손잡이를 하나씩 돌려 보고 무엇이 같이 움직이는지**만 잰다.
 * 고르지 않는다. 값을 고치지도 않는다.
 *
 * ══ 저장소를 한 글자도 안 건드리는 방법 ══════════════════════════════════
 * 손잡이 중 둘은 **파일 안에 박혀 있어** 메모리로 못 바꾼다:
 *   · `growth_speed.by_band` — `loop.js` 가 모듈 최상단에서 `import ... json` 으로 한 번 읽는다.
 *     한 프로세스에 한 값뿐이라 후보마다 **새 프로세스**라야 한다.
 *   · `TUTORIAL_RULES` — `Object.freeze` 된 소스 상수다.
 * 그래서 이 도구는 **임시 폴더에 저장소 사본(run root)을 하나 만들고** 거기서만 값을 갈아 끼운다.
 * 진짜 `src/**` · `data/**` 는 **읽기만** 한다. 사본은 끝나면 지운다.
 * 딸린 검사(`test_save` 등)도 같은 사본에서 돌린다 — 그래야 "그 값일 때" 깨지는지가 재진다.
 *
 * ⚠ 못 재는 것 — `GROWTH_STEPS_MAX = 2` 가 loop.js 의 상수라 **계수 2.0 이 천장**이다.
 *   그 위를 재려면 그 상수도 같이 올려야 하는데, 그건 "속도"가 아니라 "다른 곡선"이다
 *   (loop.js 주석이 그렇게 적어 뒀다). 여기서는 안 넘는다.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const IS_WORKER = process.argv.includes('--worker');

/* ══════════════════════════════════════════════════════════════════════════
   후보표 — 손잡이 네 갈래와 섞은 것
   ────────────────────────────────────────────────────────────────────────
   speed  : data/growth_tuning.json  growth_speed.by_band
   move   : TUTORIAL_RULES.moveOutCostWon
   rent   : TUTORIAL_RULES.rentWon · rentGraceDays · dailySpendWon
   crop   : characters.json _meta.cropMealCapPerPerson (하루 저감 상한 = cap × 2,500원)
            sirus 는 값이 아니라 **플레이 방식**이라 따로 표시한다
   ══════════════════════════════════════════════════════════════════════ */
const BASE_SPEED = { slow: 1, best: 1.25, good: 1.25, over: 1 };
const CANDIDATES = [
  { id: '기준',  ko: '지금 그대로', 기준: true, cost: '—' },

  /* ㉠ 속도 계수 — slow 를 1 위로 올린다 (아직 아무도 안 재 본 방향) */
  { id: '㉠a1', ko: 'slow 1.25 · best 1.5',  speed: { slow: 1.25, best: 1.5,  good: 1.5,  over: 1 },
    cost: '어두운 자리가 25% 빨라진다 — 「자리」의 값이 그만큼 준다' },
  { id: '㉠a2', ko: 'slow 1.5 · best 1.75',  speed: { slow: 1.5,  best: 1.75, good: 1.75, over: 1 },
    cost: '어두운 자리가 50% 빨라진다' },
  { id: '㉠a3', ko: 'slow 1.5 · best 2.0',   speed: { slow: 1.5,  best: 2,    good: 2,    over: 1 },
    cost: '어두운 자리 50% 빨라짐. 밝은 자리는 천장(2.0)이라 더 못 벌린다' },
  { id: '㉠a4', ko: 'slow 1.75 · best 2.0',  speed: { slow: 1.75, best: 2,    good: 2,    over: 1 },
    cost: '어두운 자리 75% 빨라짐. A 와 B 가 14%밖에 안 벌어진다' },
  { id: '㉠a5', ko: 'slow 2.0 · best 2.0',   speed: { slow: 2,    best: 2,    good: 2,    over: 1 },
    cost: '★자리가 속도를 안 바꾼다 — 등이 다시 이름표가 된다' },

  /* ㉡ 이사 목표 금액 — ★ 값의 사다리가 **계단**이라 아무 데나 내려도 안 듣는다(아래 §벼랑) */
  { id: '㉡b1', ko: '이사 120만',  move: 1_200_000, cost: '원룸 실비 근거(보증금+이사비)를 20% 깎는다' },
  { id: '㉡b2', ko: '이사 100만',  move: 1_000_000, cost: '시작 자금과 같아진다 — "모아서 나간다"가 흐려진다' },
  { id: '㉡b3', ko: '이사 90만',   move:   900_000, cost: '시작 자금보다 적다' },
  { id: '㉡b4', ko: '이사 80만',   move:   800_000, cost: '위와 같음 · 더 심함' },
  { id: '㉡b5', ko: '이사 72만(잎3·무늬2 값)', move: 721_111,
    cost: '★여전히 **잎 3장**을 기다린다 — 72만도 1,83만도 같은 유효 249일이다' },
  { id: '㉡b6', ko: '이사 60만',   move:   600_000, cost: '이사가 목표가 아니게 된다' },

  /* ㉢ 작물 수입 — 하루 저감 상한 */
  { id: '㉢c1', ko: '끼니상한 3끼(7,500원)', crop: 3, cost: '하루 식비 7,500원 전부를 콩나물로 — food_economy §4 의 "질림" 근거를 버린다' },
  { id: '㉢c2', ko: '끼니상한 4끼(10,000원)', crop: 4, cost: '식비보다 저감이 커진다(현실 아님)' },
  { id: '㉢c3', ko: '시루 3개(값이 아니라 플레이)', sirus: 3, cost: '값을 안 바꾼다. 플레이어가 시루를 상한(cropSirusForCap 3)까지 돌린 경우' },

  /* ㉣ 데드라인·월세 */
  { id: '㉣d1', ko: '월세 20만',        rent: 200_000, cost: '반지하 월세 실비 근거를 깎는다' },
  { id: '㉣d2', ko: '월세 15만',        rent: 150_000, cost: '위와 같음 · 더 심함' },
  { id: '㉣d3', ko: '유예 60일',        grace: 60,     cost: '값이 아니라 서사 장치. 초반만 늦춰지고 총량은 그대로일 것' },
  { id: '㉣d4', ko: '하루지출 15,000원', spend: 15_000, cost: '월 60만 → 45만. 반지하 살림의 빡빡함이 준다' },

  /* ㉤ 플레이 방식 — 값이 아니다. 재는 하네스가 **잎을 잘라 버리고 있다**(아래 §벼랑 ③) */
  { id: '㉤e1', ko: '삽수를 한 번만 자른다', cutMax: 1,
    cost: '값을 안 바꾼다. 모주 잎을 안 깎는 플레이 — varieGrant 조건이 삽수 1회라 0회는 못 한다' },

  /* ㉦ ★80일이 애초에 닿는 값인가 — 「잎 2장으로 나간다」를 살려 보는 유일한 꼴.
       잎 3장(유효 249)을 안 기다리려면 목표가 **잎2·무늬2 = 160,000원** 아래라야 하고,
       그러려면 시작 자금도 같이 내려야 한다(안 그러면 1일차에 이미 들고 있다 — ㉡b3~b6). */
  { id: '㉦f1', ko: '★시작 10만 + 이사 15만(잎2로 나간다)', cash: 100_000, move: 150_000,
    cost: '이사비가 15만원이 된다. 원룸 실비 근거가 통째로 사라진다' },
  { id: '㉦f2', ko: '★시작 10만 + 이사 15만 + slow1.25', cash: 100_000, move: 150_000,
    speed: { slow: 1.25, best: 1.5, good: 1.5, over: 1 }, cost: '위 + 속도 한 칸 — ③-b 에 닿는지 보는 값' },

  /* 섞은 것 */
  { id: '★m1', ko: 'slow1.25/best1.5 + 이사 120만',
    speed: { slow: 1.25, best: 1.5, good: 1.5, over: 1 }, move: 1_200_000,
    cost: '속도와 목표를 조금씩 — 어느 쪽도 근거를 크게 안 깎는다' },
  { id: '★m2', ko: 'slow1.5/best2.0 + 이사 120만',
    speed: { slow: 1.5, best: 2, good: 2, over: 1 }, move: 1_200_000, cost: '위보다 더 센 조합' },
  { id: '★m3', ko: '이사 120만 + 월세 20만',
    move: 1_200_000, rent: 200_000, cost: '속도는 안 건드린다 — 「자리」의 교훈이 온전하다' },
  { id: '★m4', ko: 'slow1.25/best1.5 + 이사 72만',
    speed: { slow: 1.25, best: 1.5, good: 1.5, over: 1 }, move: 721_111, cost: '벼랑 + 약한 속도' },
  { id: '★m5', ko: 'slow1.5/best2.0 + 이사 72만',
    speed: { slow: 1.5, best: 2, good: 2, over: 1 }, move: 721_111,
    cost: '벼랑 + 센 속도. ★③-b 를 통과시킬 수 있는 유일한 꼴로 보인다' },
  { id: '★m6', ko: '이사 72만 + 삽수 1회',
    move: 721_111, cutMax: 1, cost: '값 하나 + 플레이 하나' },
  { id: '★m7', ko: 'slow1.25/best1.5 + 이사 72만 + 삽수 1회',
    speed: { slow: 1.25, best: 1.5, good: 1.5, over: 1 }, move: 721_111, cutMax: 1,
    cost: '속도를 제일 덜 건드리면서 벼랑을 쓴다' }
];

/* ══ 딸린 검사 — 그 값으로 무엇이 같이 깨지나 ══════════════════════════ */
const COLLATERAL = ['test_save', 'test_maturation', 'test_first_play', 'test_first_play_attacks',
                    'test_headroom', 'test_banjiha_routes', 'test_growth_speed', 'test_tutorial',
                    'test_propagation', 'test_fastforward', 'test_oneroom'];

/* ══════════════════════════════════════════════════════════════════════════
                              워커 — 세 경로를 잰다
   ══════════════════════════════════════════════════════════════════════ */
if (IS_WORKER) {
  const opt = JSON.parse(process.env.PROBE_OPTS || '{}');
  const out = await measure(opt);
  process.stdout.write('__RESULT__' + JSON.stringify(out) + '\n');
  process.exit(0);
}

async function measure(OPT) {
  const assert = (await import('node:assert')).default;
  const vm = await import('node:vm');
  const { createProfileLight } = await import('../src/game/room_profile.js');
  const { newState, pot0, setPotSlot, resowCrop, waterCrop, ARRIVAL } = await import('../src/game/state.js');
  const { nextDay, harvestCrop, FAST_MODE_MAX_DAYS, JUMP_MAX_DAYS } = await import('../src/game/loop.js');
  const { firstPlayRulesFromBalance, placeBeansprout, moveMonstera, beansproutReady } =
    await import('../src/game/first_play.js');
  const { seasonAt, buyLamp, canMoveOut, moveOut, varieView, TUTORIAL_RULES } =
    await import('../src/game/tutorial.js');
  const { orderItem, stockOf, incomingOf, priceOf, sellCutting, sellPot, SELLABLE_CUTTING_STATUS } =
    await import('../src/game/shop.js');
  const { takeCutting, cuttableNow, cutBudgetOf, motherStatsNow } = await import('../src/game/propagation.js');

  const J = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
  const light = createProfileLight(J('data/profiles/room_profile.banjiha.json'), {
    lightTh: J('data/balance/light_thresholds.json'),
    weatherBalance: J('data/balance/weather.json')
  });
  const RULES = firstPlayRulesFromBalance(J('data/balance/characters.json'));
  const DARK = 'banjiha-dresser:1';
  const SILL = 'banjiha-sill:0';
  const MOVE_OUT_WON = TUTORIAL_RULES.moveOutCostWon;
  const SIRUS = OPT.sirus || 1;
  const CUT_MAX = OPT.cutMax == null ? Infinity : OPT.cutMax;

  /* ── 헤드리스 생장 엔진 (test_balance_routes.mjs 와 같은 하네스) ── */
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

  /* ── 판 하나 — test_balance_routes.play() 그대로. 시루 개수만 열었다 ── */
  function play(o = {}) {
    const io = { light, growth: standGrowth(o.seed || 1) };
    const S = newState({ mode: 'novice', room: 'banjiha', firstPlay: true, firstPlayRules: RULES });
    light.clearCache();
    placeBeansprout(S.firstPlay, DARK, { slots: light.room.slots });

    const rows = [];
    let taps = 0, ffStops = 0, ffDays = 0, jumpDays = 0, cutsTaken = 0;
    /* ★ 무늬잎이 n장이 된 날 — 이 게임의 실제 시계다(아래 §벼랑). */
    const varieDay = {};
    let cuttingIncome = 0, varieIncome = 0, potIncome = 0, sold = 0;
    const sell = c => {
      const varie = c.source.variegatedLeaves > 0;
      const r = sellCutting(S, c.id); sold++; taps++;
      if (varie) varieIncome += r.won; else cuttingIncome += r.won;
    };

    for (let d = 1; d <= (o.days || 300); d++) {
      if (!S.firstPlay.completed) taps++;
      try { waterCrop(S); } catch { /* 아직 안 놓은 시루 */ }

      const turn = nextDay(S, io).turn;
      if (S.firstPlay.completed) ffDays++; else jumpDays++;

      let harvested = null;
      if (beansproutReady(S.firstPlay.beansprout)) { harvested = harvestCrop(S, io); taps++; ffStops++; }
      const ts = S.tutorial;
      if (harvested && harvested.arrived) {
        setPotSlot(S, pot0(S), SILL, light.room.slots);
        moveMonstera(S.firstPlay, SILL, { slots: light.room.slots });
        taps++;
      }

      const b = S.firstPlay.beansprout;
      if (b.sirus + stockOf(S, 'siru') + incomingOf(S, 'siru') < SIRUS) {
        try { orderItem(S, 'siru', SIRUS - b.sirus - stockOf(S, 'siru') - incomingOf(S, 'siru')); taps++; } catch {}
      }
      const target = Math.min(SIRUS, b.sirus + stockOf(S, 'siru'));
      if (stockOf(S, 'bean_seed') + incomingOf(S, 'bean_seed') < target) {
        try { orderItem(S, 'bean_seed', target - stockOf(S, 'bean_seed') - incomingOf(S, 'bean_seed')); taps++; } catch {}
      }
      if (b.harvested && stockOf(S, 'bean_seed') >= target) {
        try { resowCrop(S, { sirus: target, at: DARK, slots: light.room.slots }); taps++; } catch {}
      }

      if (o.buyLamp && ts.lamp.unlocked && ts.lamp.owned < (o.lamps || 1) && ts.cashWon >= ts.rules.lampPriceWon) {
        buyLamp(ts); S.lamps.count = ts.lamp.owned; light.clearCache(); taps++;
      }

      if (ts.day >= (o.startCutDay || 0) && cutsTaken < CUT_MAX) {
        const v0 = pot0(S) ? viewOf(S, io) : null;
        const node = v0 ? pickNode(v0.nodes, v0.budget) : null;
        if (node && (S.cuttings || []).length === 0 && stockOf(S, 'jar') + incomingOf(S, 'jar') === 0) {
          try { orderItem(S, 'jar', 1); taps++; } catch {}
        }
        if (node && stockOf(S, 'jar') >= 1) {
          try { takeCutting(S, { nodes: v0.nodes, nodeId: node.nodeId, container: 'jar' }); cutsTaken++; taps++; } catch {}
        }
      }
      /* 파는 것은 자르기 상한과 무관하다 — 이미 자른 것은 판다 */
      if (ts.day >= (o.startCutDay || 0))
        for (const c of [...(S.cuttings || [])]) if (SELLABLE_CUTTING_STATUS.includes(c.status)) sell(c);

      /* 무늬잎 n장 도달일 — 이사 조건이 실제로 기다리는 것. **파는 것보다 먼저 읽는다** */
      if (!ts.movedOut && pot0(S)) {
        const st = viewOf(S, io).stats;
        if (st) for (let n = 1; n <= 4; n++)
          if (st.variegatedLeaves >= n && varieDay[n] == null) varieDay[n] = ts.day;
      }

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
            sellPot(S, { leaves: v.stats.leaves, variegatedLeaves: v.stats.variegatedLeaves });
            potIncome += potWon; taps++;
          }
        }
      }
      if (!ts.movedOut && canMoveOut(ts).ok) { moveOut(ts); taps++; }

      rows.push({ day: S.day, tday: ts.day, season: seasonAt(ts, ts.day), cashWon: ts.cashWon,
                  bankrupt: ts.bankrupt, eff: io.growth.growthDays(),
                  leaves: io.growth.leafStats().leaves });
      if (ts.movedOut) break;
    }
    const last = rows[rows.length - 1];
    const ffPresses = Math.max(Math.ceil(ffDays / FAST_MODE_MAX_DAYS), ffStops);
    return { taps: taps + ffPresses + Math.ceil(jumpDays / JUMP_MAX_DAYS),
             cuttingIncome, varieIncome, potIncome, sold, varieDay,
             movedOut: S.tutorial.movedOut, lastDay: last.tday, lastGameDay: last.day,
             season: last.season, eff: last.eff, leaves: last.leaves,
             everBroke: rows.some(r => r.bankrupt) };
  }

  const SEEDS = Array.from({ length: 24 }, (_, i) => i + 1);
  function route(name, o) {
    const runs = SEEDS.map(seed => play({ ...o, seed }));
    const ok = runs.filter(r => r.movedOut);
    const seasons = {};
    for (const r of ok) seasons[r.season] = (seasons[r.season] || 0) + 1;
    return {
      name, n: runs.length, okN: ok.length, rate: ok.length / runs.length, seasons,
      autumn: ok.filter(r => r.season === 'autumn').length,
      medDay: ok.length ? median(ok.map(r => r.lastDay)) : null,
      best: ok.length ? Math.min(...ok.map(r => r.lastDay)) : null,
      worst: ok.length ? Math.max(...ok.map(r => r.lastDay)) : null,
      medEff: median(runs.map(r => r.eff)),
      medLeaves: median(runs.map(r => r.leaves)),
      medTaps: ok.length ? median(ok.map(r => r.taps)) : median(runs.map(r => r.taps)),
      medGameDays: ok.length ? median(ok.map(r => r.lastGameDay)) : median(runs.map(r => r.lastGameDay)),
      medVarie: median(runs.map(r => r.varieIncome)), medCut: median(runs.map(r => r.cuttingIncome)),
      medPot: median(runs.map(r => r.potIncome)),
      broke: runs.filter(r => r.everBroke).length,
      /* ★ 무늬잎 n장이 된 날의 중앙값 — 이사 조건이 실제로 기다리는 시계 */
      varie: [1, 2, 3].map(n => median(runs.map(r => r.varieDay[n]).filter(v => v != null)))
    };
  }
  const A = route('A', { buyLamp: false, days: 300 });
  const B = route('B', { buyLamp: true, lamps: 1, days: 300 });
  const C = route('C', { buyLamp: true, lamps: 1, startCutDay: 12, days: 300 });

  /* 판정 — test_balance_routes 와 **같은 식**이라야 한다 */
  const R = A.okN ? A : (B.okN ? B : C);
  return {
    A, B, C, moveOutWon: MOVE_OUT_WON,
    p11: !(A.medDay === B.medDay && A.medEff === B.medEff && A.medLeaves === B.medLeaves),
    p12: A.autumn > A.okN / 2,
    p3b: R.medGameDays != null && R.medGameDays <= 100,
    judgeGameDays: R.medGameDays
  };
}

/* ══════════════════════════════════════════════════════════════════════════
                          부모 — 사본을 만들고 값을 갈아 끼운다
   ══════════════════════════════════════════════════════════════════════ */
const argOnly = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7);
const QUICK = process.argv.includes('--quick');

const RUN = fs.mkdtempSync(path.join(os.tmpdir(), 'byeot-tutlen-'));
process.on('exit', () => { try { fs.rmSync(RUN, { recursive: true, force: true }); } catch {} });

console.log(`══ 튜토 길이 후보 실측 (probe_tutorial_length) ═══════════════════════`);
console.log(`  사본: ${RUN}`);
console.log(`  ★ 진짜 src/** · data/** 는 읽기만 한다. 값은 이 사본에서만 갈아 끼운다.`);

for (const d of ['src', 'data']) fs.cpSync(path.join(ROOT, d), path.join(RUN, d), { recursive: true });
fs.mkdirSync(path.join(RUN, 'tools'), { recursive: true });
/* game.html · index.html 은 딸린 검사가 읽는다(test_first_play_attacks 가 화면 배선을 본다) */
for (const f of ['plant_grow.html', 'game.html', 'index.html'])
  if (fs.existsSync(path.join(ROOT, f))) fs.copyFileSync(path.join(ROOT, f), path.join(RUN, f));
fs.copyFileSync(path.join(HERE, path.basename(fileURLToPath(import.meta.url))),
                path.join(RUN, 'tools', 'probe_tutorial_length.mjs'));
if (!QUICK) {
  for (const t of COLLATERAL) {
    const s = path.join(ROOT, 'tools', `${t}.mjs`);
    if (fs.existsSync(s)) fs.copyFileSync(s, path.join(RUN, 'tools', `${t}.mjs`));
  }
  for (const extra of ['assets', 'docs', 'vendor'])
    if (fs.existsSync(path.join(ROOT, extra)))
      try { fs.symlinkSync(path.join(ROOT, extra), path.join(RUN, extra), 'junction'); } catch {}
}

const TUNE = path.join(RUN, 'data', 'growth_tuning.json');
const TUTO = path.join(RUN, 'src', 'game', 'tutorial.js');
const CHAR = path.join(RUN, 'data', 'balance', 'characters.json');
const TUNE0 = fs.readFileSync(TUNE, 'utf8');
const TUTO0 = fs.readFileSync(TUTO, 'utf8');
const CHAR0 = fs.readFileSync(CHAR, 'utf8');

function applyCandidate(c) {
  /* growth_speed */
  const t = JSON.parse(TUNE0);
  if (!t.growth_speed) t.growth_speed = {};
  t.growth_speed.by_band = { ...(t.growth_speed.by_band || BASE_SPEED), ...(c.speed || {}) };
  fs.writeFileSync(TUNE, JSON.stringify(t, null, 2));

  /* TUTORIAL_RULES */
  let s = TUTO0;
  const put = (key, v) => {
    const re = new RegExp(`(${key}:\\s*)[\\d_]+`);
    if (!re.test(s)) throw new Error(`tutorial.js 에서 ${key} 를 못 찾았습니다`);
    s = s.replace(re, `$1${v}`);
  };
  if (c.cash != null)  put('startCashWon', c.cash);
  if (c.move != null)  put('moveOutCostWon', c.move);
  if (c.rent != null)  put('rentWon', c.rent);
  if (c.grace != null) put('rentGraceDays', c.grace);
  if (c.spend != null) put('dailySpendWon', c.spend);
  fs.writeFileSync(TUTO, s);

  /* 끼니 상한 */
  const ch = JSON.parse(CHAR0);
  if (c.crop != null) ch._meta.cropMealCapPerPerson = c.crop;
  fs.writeFileSync(CHAR, JSON.stringify(ch, null, 1));
}

function runWorker(c) {
  const r = spawnSync(process.execPath, [path.join(RUN, 'tools', 'probe_tutorial_length.mjs'), '--worker'], {
    env: { ...process.env, PROBE_OPTS: JSON.stringify({ sirus: c.sirus || 1, cutMax: c.cutMax ?? null }) },
    encoding: 'utf8', maxBuffer: 1 << 26
  });
  const m = (r.stdout || '').match(/__RESULT__(.*)/);
  if (!m) throw new Error(`워커 실패 (${c.id}):\n${(r.stderr || '').slice(-1500)}`);
  return JSON.parse(m[1]);
}

function runCollateral() {
  const broken = [], detail = [];
  for (const t of COLLATERAL) {
    const f = path.join(RUN, 'tools', `${t}.mjs`);
    if (!fs.existsSync(f)) continue;
    const r = spawnSync(process.execPath, [f], { cwd: RUN, encoding: 'utf8', maxBuffer: 1 << 26 });
    const out = (r.stdout || '') + (r.stderr || '');
    const lines = (out.match(/^FAIL\s+.*$/gm) || []);
    const said = /^\w[\w_]*:\s*FAIL/m.test(out);
    if (lines.length || said || r.status !== 0) {
      broken.push(`${t}${lines.length ? `(${lines.length})` : ''}`);
      for (const l of lines.slice(0, 3)) detail.push(`${t} — ${l.replace(/^FAIL\s+/, '').slice(0, 96)}`);
      if (!lines.length) detail.push(`${t} — 종료코드 ${r.status} (${(out.match(/Error:.*/) || ['사유 미상'])[0].slice(0, 80)})`);
    }
  }
  return { broken, detail };
}

const only = argOnly ? argOnly.split(',') : null;
const list = CANDIDATES.filter(c => !only || only.includes(c.id));
const rows = [];
for (const c of list) {
  applyCandidate(c);
  process.stderr.write(`  … ${c.id} ${c.ko}\n`);
  const m = runWorker(c);
  const col = QUICK ? null : runCollateral();
  rows.push({ c, m, broken: col && col.broken, detail: col && col.detail });
}

/* ── 표 ───────────────────────────────────────────────────────────────── */
const pad = (s, n) => { s = String(s); let w = 0; for (const ch of s) w += ch.charCodeAt(0) > 0x2000 ? 2 : 1;
                        return s + ' '.repeat(Math.max(0, n - w)); };
const pct = v => `${(v * 100).toFixed(0)}%`;
const yn = b => b ? 'PASS' : 'FAIL';

console.log('');
console.log('── ① 세 경로 (씨앗 24판 · 반지하 · 최대 300일) ─────────────────────────');
console.log(pad('후보', 30) + pad('A 등없이', 30) + pad('B 등1개', 30) + pad('C 늦게', 26) + '파산 A/B/C');
for (const { c, m } of rows) {
  const f = r => `${pct(r.rate)} ${r.medDay == null ? '—' : r.medDay + '일'} 잎${r.medLeaves} 유효${r.medEff}`;
  console.log(pad(c.id + ' ' + c.ko, 30) + pad(f(m.A), 30) + pad(f(m.B), 30) + pad(f(m.C), 26) +
              `${m.A.broke}/${m.B.broke}/${m.C.broke} of ${m.A.n}`);
}

console.log('');
console.log('── ② 판정 · 계절 · 딸린 검사 ────────────────────────────────────────');
console.log(pad('후보', 26) + pad('①-1', 6) + pad('①-2', 6) + pad('③-b', 6) +
            pad('게임일', 8) + pad('A 계절', 22) + pad('B 이득', 16) + '깨진 검사');
for (const { c, m, broken } of rows) {
  const seas = Object.entries(m.A.seasons).map(([k, v]) => `${k}${v}`).join(' ') || '—';
  const gain = (m.A.medDay != null && m.B.medDay != null)
    ? `−${m.A.medDay - m.B.medDay}일 ×${(m.A.medDay / m.B.medDay).toFixed(2)}` : '—';
  console.log(pad(c.id + ' ' + c.ko, 26) + pad(yn(m.p11), 6) + pad(yn(m.p12), 6) + pad(yn(m.p3b), 6) +
              pad(m.judgeGameDays ?? '—', 8) + pad(seas, 22) + pad(gain, 16) +
              (broken == null ? '(--quick)' : (broken.length ? broken.join(' ') : '없음')));
}

console.log('');
console.log('── ③ 이사 자금이 실제로 어디서 오나 · 무늬잎 시계 (A 경로 중앙값) ───');
console.log(pad('후보', 26) + pad('모주판매', 11) + pad('삽수판매', 10) +
            pad('무늬1장', 9) + pad('무늬2장', 9) + pad('무늬3장', 9) + '이사일');
for (const { c, m } of rows) {
  const v = m.A.varie.map(x => x == null ? '—' : x + '일');
  console.log(pad(c.id + ' ' + c.ko, 26) + pad(m.A.medPot.toLocaleString(), 11) +
              pad(m.A.medCut.toLocaleString(), 10) +
              pad(v[0], 9) + pad(v[1], 9) + pad(v[2], 9) + (m.A.medDay ?? '—'));
}

console.log('');
console.log('── ④ 대가 ──────────────────────────────────────────────────────────');
for (const { c } of rows) console.log('  ' + pad(c.id + ' ' + c.ko, 28) + c.cost);

if (!QUICK) {
  console.log('');
  console.log('── ⑤ 깨진 검사가 정확히 무엇을 말하나 ──────────────────────────────');
  for (const { c, detail } of rows) {
    if (!detail || !detail.length) continue;
    console.log(`  ${c.id} ${c.ko}`);
    for (const d of detail) console.log('      ' + d);
  }
}

console.log(`
★★ 이 게임의 시계는 「돈」이 아니라 「모주의 잎 3장」이다 ────────────────────
  이사 자금 1,500,000원은 **모주 한 그루를 팔아** 채운다(위 ③ 모주판매 열은 전부 1,830,000).
  콩나물·삽수가 버는 돈은 12,000원 — 이사 자금의 0.8%다. 살림 손잡이가 길이를 못 바꾸는 이유다.

  값의 사다리(shop.priceOf)는 **잎 수가 먼저이고 무늬가 나중**이다:
      잎2·무늬2 →   160,000원
      잎3·무늬2 →   721,111원        잎3·무늬3 → 1,830,000원
  ★ 721,111원도 1,830,000원도 **똑같이 잎 3장**을 요구한다. 그래서 이사 목표를
    160,001원 ~ 시작자금(1,000,000원) 사이 **어디로 내려도 끝나는 날이 안 바뀐다**
    — 120만·100만·90만·80만·72만이 전부 같은 날인 이유다.
    그 아래로 내리면 시작 자금만으로 1일차에 나가 버려 튜토가 통째로 사라진다.
    ⇒ **이사 목표 금액에는 쓸 수 있는 구간이 없다.**

  잎은 **유효 생장일**로 온다 — 잎2 ≈ 146 · 잎3 ≈ 249.
  즉 튜토 길이 = **유효 생장일 249 에 닿는 데 걸리는 달력일**이고,
  속도 계수는 정확히 그 나눗셈의 분모다. **속도만이 이 나눗셈을 바꾼다.**

  ⚠ VARIE_GRANT_INTERVAL_DAYS(12일)를 줄이는 것은 **아무것도 안 바꾼다.**
     문은 이미 여러 번 열리고(45·57·70·134·168일…), 받을 **잎이 없어서** 그냥 지나간다.
     안 잰 것이 아니라 잴 것이 없다 — 그래서 후보로 안 올렸다.

  ⚠ 파산 열을 보라 — 지금은 A·B·C 24판이 **전부** 파산한다(중앙값 60일쯤).
     그런데도 이사가 찍히는 이유는 하네스(test_balance_routes.play)가 파산에서 **안 멈추기**
     때문이다. 즉 "189일"은 *파산을 무시했을 때*의 값이다. 이건 이 창이 못 정하는 문제다.

★ 「자리가 결과를 바꾼다」의 크기 = 위 ② 의 「B 이득」이다.
  ×1.00 이면 등이 아무것도 안 산다(①-1 FAIL). 기준(지금)은 ×1.17 이다.
★ 고르는 것은 이 도구의 일이 아니다 — docs/handoff/tutlength-to-plan.md 참고.`);
