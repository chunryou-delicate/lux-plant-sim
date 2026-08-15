/* ============================================================
   tools/test_ending_flow.mjs — ④ 엔딩이 **끝까지 도는가** · 2026-08-06 신설
   ------------------------------------------------------------
     node tools/test_ending_flow.mjs

   ★ 왜 이 재현이 따로 필요했나.
     `tools/test_oneroom.mjs` §G 는 엔딩 함수를 **하나씩** 본다(미확정이면 미확정이라 하나,
     주입하면 그 값으로 도나, 돈이 나가나). 좋은 검사인데 **판을 안 굴린다** —
     상태를 손으로 세워 놓고 함수를 부른다. 그래서 `ending.js` 가
     *"진짜 하루 루프 안에서, 진짜 삽수를 팔아서, 진짜로 끝나는가"* 는 아무도 안 봤다.
     실제로 `game.html` 은 `ending.js` 를 **한 번도 안 부른다**(grep 0). 이 재현이 그 자리를
     대신 서서, 화면이 붙였을 때 도는지를 미리 증명한다.

   ══ 무엇을 보나 ═══════════════════════════════════════════════════════════
     A  ★★ 완주 — 반지하 → 이사 → 원룸 → 삽수를 **팔아서** → 닿음 → 끝냄.
                   전부 `loop.nextDay` 가 도는 진짜 하루 안에서 난다
     B  ★ 지금 게임의 실상 — 목표 금액이 미확정이라 **끝까지 가도 아무 일이 안 난다**
     C  저장·복원 — 엔딩 상태(닿은 날·끝낸 날)가 왕복에서 살아남는다
     D  ★ 엔딩 뒤 — 초보가 꺼지고(유예 16→8) 단계가 ④ 로 굳는다
     E  ★ 화면이 쓸 창구가 다 있나 — `game.html` 이 부를 것들이 실제로 export 되어 있고
         `canMoveOut` 과 **같은 모양**으로 읽히나
     F  실측 — 원룸에서 며칠에 얼마가 모이나. ④ 목표 금액을 정할 근거를 표로 남긴다

   ⚠ **하네스 보조**를 쓴 곳은 그때마다 이름을 적는다(`assist`). 이 재현이 재는 것은
     **배선**이지 살림이 아니다 — 살림(파산일·이사일)은 `tools/probe_economy_gap.mjs` 것이다.
   ⚠ 값을 하나도 안 바꾼다. data/** · plant_grow.html · game.html 은 읽기만 한다.
============================================================ */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { newState, pot0, setPotSlot, resowCrop, waterCrop, waterPot, ARRIVAL } from '../src/game/state.js';
import { nextDay, harvestCrop } from '../src/game/loop.js';
import { firstPlayRulesFromBalance, placeBeansprout, moveMonstera, beansproutReady } from '../src/game/first_play.js';
import { orderItem, stockOf, incomingOf, sellCutting, sellPot, priceOf,
         UNIT_WON, SELLABLE_CUTTING_STATUS } from '../src/game/shop.js';
import { canMoveOut, varieView, TUTORIAL_RULES } from '../src/game/tutorial.js';
import { takeCutting, repotCutting, cuttableNow, cutBudgetOf, motherStatsNow,
         cuttingsOf, graceDaysOf, isNoviceMode } from '../src/game/propagation.js';
import { moveIntoOneroom, stageOf, STAGES, storyOf, storyRunning, storyStatus,
         ONEROOM_ROOM_ID, oneroomRulesFromHomes, withOneroomRent } from '../src/game/oneroom.js';
import { ENDING_RULES, endingRulesFrom, endingRulesFromHomes, endingProgress,
         canFinish, stepEnding, finishEnding, endingGoal, endingView,
         noviceStillOn } from '../src/game/ending.js';
import { serialize, deserialize } from '../src/game/save.js';
import { createProfileLight } from '../src/game/room_profile.js';
import { staminaOf } from '../src/game/stamina.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const J = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url), 'utf8'));

const results = [];
const check = (n, f) => { try { f(); results.push(['PASS', n]); }
                          catch (e) { results.push(['FAIL', n, e.message]); } };
const info = m => results.push(['INFO', '  ' + m]);

/* ══ 헤드리스 생장 엔진 — tools/test_balance_routes.mjs 와 같은 하네스 ═══════ */
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

/* ★★ 방을 바꿀 수 있는 조도 창 — `game.html` 의 `buildRoom(id)` 자리다.
   `moveIntoOneroom` 이 `io.light.build(roomId)` 를 부르는지, 그 뒤 자리 회수가
   **새 방 슬롯**으로 가는지를 이걸로 실제로 잰다(스텁이 아니라 진짜 방 프로파일이다). */
const LIGHT_DATA = { lightTh: J('../data/balance/light_thresholds.json'),
                     weatherBalance: J('../data/balance/weather.json') };

/* ⚠⚠ **하네스 우회 하나 — 이유를 적어 둔다.**
   `data/profiles/room_profile.oneroom.json` 은 **안정 uid 계약(2026-08-02) 이전 파일**이라
   `createProfileLight` 이 거부한다. 지금 `uidStable: true` 가 찍힌 프로파일은 **반지하 하나뿐**이고
   (나머지 다섯은 전부 옛 파일), 다시 뽑으려면 브라우저에서 house 의 `_profile_gen.html` 을
   돌려야 한다 — 이 창이 못 하는 일이고 `data/**` 도 소유 밖이다.

   그래서 **여기서만** 그 깃발을 세워 판을 굴린다. 안에 든 기하(ratio 표)는 진짜 값이고,
   깃발이 막고 있던 것은 *"이 slotId 가 나중에 바뀌어도 세이브가 안 어긋나나"* 다 —
   메모리에서만 도는 재현에는 그 위험이 없다.
   ★ 이 우회가 곧 인계 항목이다(docs/handoff/cutend-to-plan.md §못 한 것). 재현이 매번 찍어 준다. */
const STALE_PROFILES = [];
const PROFILE_WARNS = [];
function makeSwitchingLight(startRoom = 'banjiha') {
  const mk = (id) => {
    const p = J(`../data/profiles/room_profile.${id}.json`);
    /* 경고를 한 번만 받는다 — 같은 방을 여러 판에서 지어서 같은 줄이 예닐곱 번 찍힌다 */
    const warn = console.warn;
    console.warn = (m) => { if (!PROFILE_WARNS.includes(String(m))) PROFILE_WARNS.push(String(m)); };
    try {
      if (p.uidStable !== true) {
        if (!STALE_PROFILES.includes(id)) STALE_PROFILES.push(id);
        return createProfileLight({ ...p, uidStable: true }, LIGHT_DATA);
      }
      return createProfileLight(p, LIGHT_DATA);
    } finally { console.warn = warn; }
  };
  const cacheByRoom = new Map();
  const get = id => { if (!cacheByRoom.has(id)) cacheByRoom.set(id, mk(id)); return cacheByRoom.get(id); };
  let cur = get(startRoom);
  let builds = [];
  return {
    daily: (day, S) => cur.daily(day, S),
    skyFor: (day, sim) => cur.skyFor(day, sim),
    dliOfSlot: (ref, o) => cur.dliOfSlot(ref, o),
    clearCache: () => cur.clearCache(),
    thresholdsOf: (p, v) => cur.thresholdsOf(p, v),
    growLampCount: () => cur.growLampCount(),
    get room() { return cur.room; },
    build(roomId) { builds.push(roomId); cur = get(roomId); return cur.room; },
    builtRooms: () => [...builds]
  };
}

const RULES = firstPlayRulesFromBalance(J('../data/balance/characters.json'));
const HOMES = J('../data/balance/homes.json');
const DARK = 'banjiha-dresser:1';
const SILL = 'banjiha-sill:0';

/* 자를 마디 고르기 — probe_economy_gap.pickNode 와 같은 규칙(무늬 있는 작은 것부터) */
function viewOf(S, io) {
  const v = varieView(S, { nodes: io.growth.cuttableNodes(), stats: io.growth.leafStats() });
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

/* ══════════════════════════════════════════════════════════════════════════
   ★★ 판 하나를 처음부터 끝까지 굴린다
   ------------------------------------------------------------------------
     opt.rules       ending 규칙(목표 금액 주입본). 없으면 ENDING_RULES(미확정)
     opt.days        최대 며칠까지 굴리나
     opt.assistMove  ★하네스 보조 — 이사 자금이 안 모이면 채워 준다(그 사실을 기록한다)
   반환 { S, io, trace, assists, log }
   ══════════════════════════════════════════════════════════════════════ */
function playToEnding(opt = {}) {
  const light = makeSwitchingLight('banjiha');
  const io = { light, growth: standGrowth(opt.seed || 7) };
  /* ★ 기본값이 'novice' 인 것은 **game.html 이 그렇게 열기 때문**이다(§1223). 재현이
     화면과 다른 모드로 돌면 화면에서만 나는 일을 영영 못 본다 — D-1b 가 그것을 잡았다. */
  const S = newState({ mode: opt.simMode || 'novice', room: 'banjiha',
                       firstPlay: true, firstPlayRules: RULES });
  light.clearCache();
  placeBeansprout(S.firstPlay, DARK, { slots: light.room.slots });

  const assists = [];
  const trace = { movedInOnDay: null, firstCutDay: null, firstSellDay: null,
                  reachedOnDay: null, doneOnDay: null, endedOnDay: null,
                  cutsTaken: 0, cuttingsSold: 0, cuttingIncomeWon: 0, cashBeforePayWon: null,
                  /* ★ 2026-08-13 — 반지하에서 판 **무늬 삽수**(탈출 둘째 축). ④ 자금과 갈라서 센다 */
                  varieSoldInBanjiha: 0, varieSoldOnDay: null, varieSoldWon: 0,
                  stepEndingCalls: 0, readyEvents: 0, homeEvents: 0,
                  builtRooms: null, oneroomCash: [] };
  const R = opt.rules || ENDING_RULES;
  const eopt = { rules: R };

  const days = opt.days || 320;
  for (let d = 1; d <= days; d++) {
    /* ★ 몬스테라 물주기 (2026-08-07) — **표준 하루에 늘어난 손**이다.
       마른 날은 하루가 안 세어지므로, 안 주면 이 320일 재현이 형태에서 통째로 멈춘다.
       화면의 [몬스테라에 물 주기]를 누른 것과 같은 함수·같은 결과다. */
    try { waterPot(S); } catch { /* 아직 없거나 안 놓은 화분 */ }
    /* ── ① 진짜 하루 ─────────────────────────────────────────── */
    nextDay(S, io);
    const ts = S.tutorial;
    const moved = stageOf(S) !== STAGES.banjiha;

    /* ── ② 작물 살림 (반지하에서만 — 원룸에서는 삽수가 벌이다) ── */
    if (!moved) {
      const b = S.firstPlay.beansprout;
      const want = 5;
      const needSiru = want - b.sirus - stockOf(S, 'siru') - incomingOf(S, 'siru');
      if (needSiru > 0) { try { orderItem(S, 'siru', needSiru); } catch { /* 돈·배송 */ } }
      const target = Math.min(want, b.sirus + stockOf(S, 'siru'));
      const needSeed = target * 2 - stockOf(S, 'bean_seed') - incomingOf(S, 'bean_seed');
      if (needSeed > 0) { try { orderItem(S, 'bean_seed', needSeed); } catch { /* 돈·배송 */ } }

      let harvested = null;
      if (beansproutReady(S.firstPlay)) { try { harvested = harvestCrop(S, io); } catch { /* 손·자리 */ } }
      if (harvested && harvested.arrived) {
        setPotSlot(S, pot0(S), SILL, light.room.slots);
        moveMonstera(S.firstPlay, SILL, { slots: light.room.slots });
      }
      try { resowCrop(S, { sirus: target, at: DARK, slots: light.room.slots }); } catch { /* 거둔 게 없음 */ }
      try { waterCrop(S, { all: true }); } catch { /* 손이 모자람 */ }
    }

    /* ── ③ 삽수 — 자르고 · 분갈이하고 · 판다 ──────────────────── */
    if (pot0(S)) {
      if (stockOf(S, 'jar') + incomingOf(S, 'jar') < 1) { try { orderItem(S, 'jar', 1); } catch { } }
      if (stockOf(S, 'pot') + incomingOf(S, 'pot') < 1) { try { orderItem(S, 'pot', 1); } catch { } }
      const v = viewOf(S, io);
      const node = pickNode(v.nodes, v.budget);
      if (node && stockOf(S, 'jar') >= 1) {
        try {
          takeCutting(S, { nodes: v.nodes, nodeId: node.nodeId, container: 'jar' });
          trace.cutsTaken++;
          if (trace.firstCutDay == null) trace.firstCutDay = S.day;
        } catch { /* 체력·재고·초보 규칙 */ }
      }
      for (const c of [...cuttingsOf(S)]) {
        if (c.status === 'node' && stockOf(S, 'pot') >= 1) { try { repotCutting(S, c.id); } catch { } }
      }
      /* ★★ 2026-08-13 — **반지하에서는 「무늬 삽수」만 판다.**
         ------------------------------------------------------------
         탈출의 둘째 축이 「무늬 삽수를 판 적이 있다」로 바뀌었다(박사님 확정 · tutorial.js §두 축).
         안 팔면 ②가 영영 안 열려 이 재현이 320일을 반지하에서 보낸다.
         ⚠ **민무늬까지 팔면 안 된다** — 아래 A-2 가 *"마지막 행동이 삽수를 판 것"* 을 재는데
           (`firstSellDay >= movedInOnDay`), 반지하에서 아무거나 팔면 그 계약이 깨진다.
           그래서 여기서 파는 것은 **②의 문을 여는 그 한 장**뿐이고, 장부(`cuttingsSold` ·
           `firstSellDay`)도 안 건드린다 — ④ 의 자금은 여전히 원룸에서 판 것만으로 센다. */
      if (!moved) {
        for (const c of [...cuttingsOf(S)]) {
          if (!SELLABLE_CUTTING_STATUS.includes(c.status)) continue;
          if ((c.variegatedLeaves || 0) < 1) continue;
          try {
            const r = sellCutting(S, c.id);
            trace.varieSoldInBanjiha++; trace.varieSoldOnDay = trace.varieSoldOnDay ?? S.day;
            trace.varieSoldWon += r.won;
          } catch { }
        }
      }
      /* 원룸에서는 **판다** — ④ 는 현금 판정이라 팔아야 닿는다(story_arc §0 ④ 문장 그대로) */
      if (moved) {
        for (const c of [...cuttingsOf(S)]) {
          if (!SELLABLE_CUTTING_STATUS.includes(c.status)) continue;
          try {
            const r = sellCutting(S, c.id);
            trace.cuttingsSold++; trace.cuttingIncomeWon += r.won;
            if (trace.firstSellDay == null) trace.firstSellDay = S.day;
          } catch { }
        }
      }
    }

    /* ── ④ ② 탈출 — 조건이 되면 **방까지** 옮긴다 ─────────────── */
    if (!moved) {
      const c = canMoveOut(ts);
      /* ★ 하네스 보조는 **돈 축만** 채운다. 2026-08-13 부터 조건이 「돈 × 무늬 삽수」라
         `learningLeft` 는 더 이상 문이 아니다 — 대신 **둘째 축이 실제로 참일 때만** 보조한다.
         그래야 「보조 때문에 열린 문」과 「삽수를 팔아 열린 문」이 안 섞인다. */
      if (!c.ok && c.varie && opt.assistMove && c.shortWon > 0 && S.day >= (opt.assistFromDay || 100)) {
        ts.cashWon += c.shortWon;
        assists.push(`day ${S.day}: 이사 자금 ${c.shortWon.toLocaleString()}원 보조 (하네스)`);
      }
      if (canMoveOut(ts).ok) {
        const r = moveIntoOneroom(S, io);
        trace.movedInOnDay = r.movedInOnDay;
        trace.builtRooms = light.builtRooms();
        assert.equal(S.home.room, ONEROOM_ROOM_ID, '이사했는데 방이 안 바뀌었습니다');
      }
      continue;
    }

    /* ── ⑤ ★ ④ 엔딩 — 하루에 한 번. `loop.nextDay` 가 안 부르므로 여기서 부른다 ── */
    const gnodes = io.growth.cuttableNodes();
    const gstats = io.growth.leafStats();
    const r = stepEnding(S, io, { ...eopt, nodes: gnodes, stats: gstats });
    trace.stepEndingCalls++;
    if (r.firstTime) { trace.reachedOnDay = S.day; trace.readyEvents++; }

    trace.oneroomCash.push({ day: S.day, cashWon: ts.cashWon,
                             netWorthWon: endingProgress(S, io, { ...eopt, nodes: gnodes, stats: gstats }).netWorthWon });

    if (canFinish(S, io, { ...eopt, nodes: gnodes, stats: gstats }).ok) {
      trace.cashBeforePayWon = ts.cashWon;
      const f = finishEnding(S, io, { ...eopt, nodes: gnodes, stats: gstats });
      trace.doneOnDay = f.doneOnDay; trace.homeEvents = f.events.length;
      trace.endedOnDay = S.day;
      break;
    }
  }
  return { S, io, trace, assists };
}

/* ══════════════════════════════════════════════════════════════════════════
   A · ★★ 완주
   ------------------------------------------------------------------------
   ★★ 목표 금액을 **재현이 닿을 수 있는 값**으로 둔다 — `shop.UNIT_WON.monstera.cutting`
     (= 삽수 한 개의 하한가 12,000원)이다. **밸런스 값이 아니다.**
     왜 이 값이냐 — 아래 §F 가 재는 그대로, 지금 원룸 판이 실제로 만드는 최고 현금이
     **삽수 한 개 값**이다. 그보다 큰 목표를 걸면 이 재현은 「엔딩이 안 열린다」만 되풀이하고
     `finishEnding` 이 도는지를 **영영 못 본다** — 배선 검사가 밸런스에 인질로 잡힌다.
     ④ 후보(1,000만)와 근거는 `docs/oneroom.md` §5 · `docs/propagation.md` §7 이고
     이 재현은 그 숫자를 정하지 않는다. **두 축을 갈라 둔 것**이 이 파일의 요점이다:
       A = 배선이 도나 (여기)      F = 살림이 닿나 (아래 · 지금은 못 닿는다)
   ══════════════════════════════════════════════════════════════════════ */
const REPRO_TARGET_WON = UNIT_WON.monstera.cutting;      // 12,000 — 재현용 입력이다
const RUN = playToEnding({ rules: endingRulesFrom({ targetWon: REPRO_TARGET_WON }),
                           assistMove: true, days: 320 });
for (const a of RUN.assists) info('하네스 보조 — ' + a);
for (const w of PROFILE_WARNS) info('⚠ 프로파일 경고 — ' + w.replace(/\s+/g, ' '));
if (STALE_PROFILES.length)
  info(`⚠ 옛 프로파일 우회 — ${STALE_PROFILES.join(' · ')} 은 uidStable 이 안 찍혀 있어 ` +
       `이 재현이 깃발을 세워 돌렸다 (house 의 _profile_gen.html 재생성 필요)`);

check('A-1 ★★ 반지하에서 시작해 **④ 내 집 마련까지 끝난다**', () => {
  const t = RUN.trace;
  assert.ok(t.movedInOnDay != null, '원룸으로 이사하지 못했습니다');
  assert.ok(t.doneOnDay != null,
    `엔딩까지 못 갔습니다 — 이사 ${t.movedInOnDay}일 · 자른 삽수 ${t.cutsTaken}개 · ` +
    `판 삽수 ${t.cuttingsSold}개 · 닿은 날 ${t.reachedOnDay}`);
  assert.equal(stageOf(RUN.S), STAGES.ending, '끝냈는데 단계가 ④ 가 아닙니다');
  info(`완주 — 이사 ${t.movedInOnDay}일차 · 첫 자르기 ${t.firstCutDay}일차 · ` +
       `첫 판매 ${t.firstSellDay}일차 · 닿음 ${t.reachedOnDay}일차 · 끝냄 ${t.doneOnDay}일차`);
  info(`자른 삽수 ${t.cutsTaken}개 · 판 삽수 ${t.cuttingsSold}개 · ` +
       `삽수 수입 ${t.cuttingIncomeWon.toLocaleString()}원`);
});

check('A-2 ★ 마지막 행동이 **삽수를 판 것**이다 (story_arc §0 ④ 의 문장)', () => {
  const t = RUN.trace;
  assert.ok(t.cuttingsSold > 0, '삽수를 한 개도 안 팔고 엔딩에 닿았습니다');
  assert.ok(t.cuttingIncomeWon > 0, '삽수 수입이 0입니다');
  assert.ok(t.firstSellDay >= t.movedInOnDay, '원룸 전에 판 것이 엔딩 자금이 됐습니다');
});

check('A-3 ★ 이사가 사건이 아니라 **이동**이었다 — 조도 창이 새 방을 지었다', () => {
  assert.deepEqual(RUN.trace.builtRooms, [ONEROOM_ROOM_ID],
    `moveIntoOneroom 이 조도 창의 build 를 안 불렀습니다: ${JSON.stringify(RUN.trace.builtRooms)}`);
  assert.equal(RUN.io.light.room.id, ONEROOM_ROOM_ID, '조도 창이 아직 반지하를 보고 있습니다');
});

check('A-4 ★ 「닿음」과 「끝냄」이 **다른 날일 수 있다** — 자동으로 안 끝난다', () => {
  const t = RUN.trace;
  assert.ok(t.reachedOnDay != null, '닿은 날이 안 적혔습니다');
  assert.equal(t.readyEvents, 1, `ending_ready 가 ${t.readyEvents}번 났습니다 — 한 번이어야 합니다`);
  assert.ok(t.homeEvents >= 1, 'ending_home 사건이 없습니다');
  assert.ok(t.doneOnDay >= t.reachedOnDay, '닿기 전에 끝났습니다');
});

check('A-5 ★ 계약금이 실제로 나갔다', () => {
  const p = endingProgress(RUN.S, RUN.io, { rules: endingRulesFrom({ targetWon: REPRO_TARGET_WON }) });
  assert.ok(RUN.S.tutorial.cashWon >= 0, `지갑이 음수입니다: ${RUN.S.tutorial.cashWon}`);
  assert.ok(RUN.trace.cashBeforePayWon - RUN.S.tutorial.cashWon === REPRO_TARGET_WON,
    `계약금이 안 빠졌습니다 — ${RUN.trace.cashBeforePayWon} → ${RUN.S.tutorial.cashWon}`);
  info(`끝낸 뒤 지갑 ${RUN.S.tutorial.cashWon.toLocaleString()}원 · ` +
       `가진 것 다 팔면 ${p.netWorthWon.toLocaleString()}원`);
});

/* ══ B · 지금 게임의 실상 — 목표가 미확정이면 아무 일이 안 난다 ═══════════ */
check('B-1 ★ 목표 금액이 미확정이면 **끝까지 가도 엔딩이 안 난다**', () => {
  assert.equal(ENDING_RULES.targetWon, null,
    '★ 목표 금액이 코드에 박혔습니다 — story_arc.md §5 는 아직 미확정입니다');
  const r = playToEnding({ assistMove: true, days: 200 });   // rules 를 안 준다 = 지금 게임 그대로
  assert.ok(r.trace.movedInOnDay != null, '이사조차 못 했습니다');
  assert.equal(r.trace.doneOnDay, null, '★ 미확정인데 엔딩이 났습니다');
  assert.equal(r.trace.reachedOnDay, null, '★ 미확정인데 「닿았다」가 났습니다');
  assert.ok(r.trace.stepEndingCalls > 0, 'stepEnding 을 한 번도 안 불렀습니다');
  assert.equal(stageOf(r.S), STAGES.oneroom, '단계가 ③ 에 안 머물렀습니다');
  info(`미확정 판 — 원룸에서 ${r.trace.stepEndingCalls}일을 굴려도 ④ 가 안 열린다 ` +
       `(stepEnding 은 조용히 지나간다)`);
  info('⇒ ★ game.html 이 ending.js 를 붙여도 **목표 금액이 없으면 화면에 아무것도 안 뜬다.** ' +
       'data/balance/homes.json 의 ending.targetWon 이 정해져야 ④ 가 열린다');
});

check('B-2 ★ 정본에서 읽는 창구가 있다 — 지금은 칸이 없어 **미확정 그대로** 낸다', () => {
  const R = endingRulesFromHomes(HOMES);
  assert.equal(R.targetWon, null,
    'homes.json 에 ending.targetWon 이 생겼습니다 — 그러면 이 검사를 값 검사로 바꿔 주세요');
  /* 칸이 생기면 그 값으로 돈다는 것을 여기서 못 박는다(파일은 안 건드린다) */
  const withField = { ...HOMES, ending: { targetWon: 10_000_000 } };
  assert.equal(endingRulesFromHomes(withField).targetWon, 10_000_000,
    'homes.json 에 값을 적어도 안 읽힙니다');
  assert.throws(() => endingRulesFromHomes({ ...HOMES, ending: { targetWon: -1 } }),
    /0보다 큰 수가 아닙니다/, '음수 목표가 통과했습니다');
});

/* ══ C · 저장·복원 ═══════════════════════════════════════════════════════ */
check('C-1 엔딩 상태가 저장 왕복에서 그대로 살아난다', () => {
  const before = storyStatus(RUN.S);
  const raw = serialize(RUN.S);
  /* ⚠ 형태(생장 창)는 안 붙인다 — 여기서 재는 것은 **스토리 상태의 왕복**이다.
     그 뜻을 명시하는 것이 `allowMissingGrowth` 다(save.js §1026 — 조용히 열지 않는다). */
  const back = deserialize(JSON.parse(JSON.stringify(raw)),
                           { firstPlayRules: RULES, allowMissingGrowth: true });
  const after = storyStatus(back);
  assert.equal(after.stage, before.stage, `단계가 ${before.stage} → ${after.stage}`);
  assert.equal(after.endingDoneOnDay, before.endingDoneOnDay, '끝낸 날이 안 살아났습니다');
  assert.equal(storyOf(back).ending.reachedOnDay, storyOf(RUN.S).ending.reachedOnDay,
    '닿은 날이 안 살아났습니다');
  assert.equal(after.room, ONEROOM_ROOM_ID, '이어하기가 반지하로 돌아갔습니다');
  assert.equal(stageOf(back), STAGES.ending);
  assert.throws(() => finishEnding(back, {}, { rules: endingRulesFrom({ targetWon: 1 }) }),
    /이미 내 집/, '이어하기에서 엔딩을 두 번 끝낼 수 있습니다');
});

/* ══ D · 엔딩 뒤 ═════════════════════════════════════════════════════════ */
check('D-1 ★ ④ 를 보면 **스토리가 끝난다** — storyRunning 이 꺼진다', () => {
  assert.equal(stageOf(RUN.S), STAGES.ending, '단계가 ④ 로 안 굳었습니다');
  assert.equal(storyRunning(RUN.S), false, '④ 를 봤는데 스토리가 아직 돕니다');
  assert.equal(noviceStillOn(RUN.S), false, 'noviceStillOn 이 storyRunning 과 다릅니다');
});

check('D-1b ★★ 그런데 **초보 완충은 안 걷힌다** — 실제 게임에서는 ④ 가 그걸 못 끈다', () => {
  /* ══ 재서 잡은 것 (2026-08-06) ═══════════════════════════════════════════
     `propagation.isNoviceMode` 의 첫 줄이 이렇다:
         if (S.sim && S.sim.mode === 'novice') return true;
     그런데 `S.sim.mode` 는 **날씨·계절 굴림 스위치**다 —
     `state.SIM_MODES.novice` 의 뜻은 *"계수 1.0 고정(맑음·여름)"* 이지 스토리 난이도가 아니다.
     그리고 `game.html` 은 새 판을 **언제나** `mode:'novice'` 로 연다(§1223 · §4018 · §4099).

     ⇒ 실제 게임에서는 첫 줄이 **항상 참**이라 그 아래 스토리 판정이 **한 번도 안 읽힌다.**
       2026-08-05 정정(*"④ 까지 초보다"*)이 노린 「④ 에서 걷힌다」는 지금 **닿지 않는다** —
       삽수 유예가 영원히 16일이고, 모주를 끝내는 자르기도 영원히 막혀 있다.

     ⚠ **여기서 안 고친다.** `sim.mode:'novice'` 가 스토리 초보를 겸하는 것이 뜻인지
       (자유 판에서도 완충을 주려던 것인지) 아닌지는 박사님 판단이다 — 규칙을 바꾸는 일이지
       배선을 잇는 일이 아니다. 재현이 사실만 못 박는다(docs/handoff/cutend-to-plan.md §판단). */
  assert.equal(RUN.S.sim.mode, 'novice', '이 재현이 game.html 과 같은 모드로 안 돌았습니다');
  assert.equal(isNoviceMode(RUN.S), true,
    '★ sim.mode 가 novice 인데 초보가 꺼졌습니다 — 규칙이 바뀌었으면 이 검사를 고쳐 주세요');
  assert.equal(graceDaysOf('water', isNoviceMode(RUN.S)), 16, '초보 유예가 16일이 아닙니다');
  info('⚠ game.html 은 늘 mode:"novice" 로 연다 → ④ 를 봐도 삽수 유예가 16일 그대로다 ' +
       '(isNoviceMode 첫 줄이 스토리 판정을 가린다)');

  /* 스토리 쪽 판정 자체는 멀쩡하다 — sim.mode 가 real 이면 ④ 에서 정확히 걷힌다 */
  const real = playToEnding({ rules: endingRulesFrom({ targetWon: REPRO_TARGET_WON }),
                             assistMove: true, days: 320, simMode: 'real' });
  if (real.trace.doneOnDay != null) {
    assert.equal(isNoviceMode(real.S), false, 'mode:real 인데도 ④ 뒤에 초보입니다');
    assert.equal(graceDaysOf('water', isNoviceMode(real.S)), 8, '유예가 8일로 안 걷혔습니다');
    info('mode:"real" 판에서는 ④ 뒤에 유예가 16일 → 8일로 걷힌다 — 스토리 판정은 멀쩡하다');
  } else {
    info(`mode:"real" 판은 ${320}일 안에 엔딩까지 못 갔다(날씨가 굴러 벌이가 다르다) — ` +
         `스토리 판정은 tools/test_oneroom.mjs §F 가 따로 고정한다`);
  }
});

check('D-2 ★ 다음 장이 무엇인지만 알린다 — 직업 화면을 여기서 만들지 않는다', () => {
  /* 끝낸 판을 다시 끝낼 수는 없으므로 새 판으로 같은 반환을 확인한다 */
  const r = playToEnding({ rules: endingRulesFrom({ targetWon: REPRO_TARGET_WON }), assistMove: true, days: 320 });
  assert.ok(r.trace.doneOnDay != null, '두 번째 판이 엔딩까지 못 갔습니다 — 재현이 흔들립니다');
  assert.equal(r.trace.doneOnDay, RUN.trace.doneOnDay,
    `같은 씨앗인데 끝난 날이 다릅니다: ${RUN.trace.doneOnDay} vs ${r.trace.doneOnDay}`);
});

/* ══ E · 화면이 쓸 창구 ══════════════════════════════════════════════════ */
check('E-1 ★ game.html 이 부를 것이 전부 있다 (함수로 export 되어 있다)', () => {
  const need = { endingRulesFrom, endingRulesFromHomes, endingProgress, canFinish,
                 stepEnding, finishEnding, endingGoal, endingView, noviceStillOn };
  for (const [k, v] of Object.entries(need))
    assert.equal(typeof v, 'function', `ending.js 가 ${k} 를 안 냅니다`);
});

check('E-2 ★ endingView 가 `canMoveOut` 과 **같은 모양**으로 읽힌다', () => {
  const opt = { rules: endingRulesFrom({ targetWon: REPRO_TARGET_WON }) };
  /* ③ 전 — 버튼 자체를 안 보인다 */
  const S0 = newState({ room: 'banjiha', mode: 'novice', firstPlay: true, firstPlayRules: RULES });
  const v0 = endingView(S0, {}, opt);
  assert.equal(v0.visible, false, '반지하에서 ④ 버튼이 보입니다');
  assert.equal(v0.disabled, true);
  assert.equal(v0.done, false);
  /* 끝낸 판 */
  const v2 = endingView(RUN.S, RUN.io, opt);
  assert.equal(v2.visible, true);
  assert.equal(v2.done, true, '끝냈는데 done 이 아닙니다');
  assert.equal(v2.disabled, true, '끝냈는데 버튼이 살아 있습니다');
  assert.equal(v2.stage, 'ending');
  assert.equal(v2.doneOnDay, RUN.trace.doneOnDay);
  assert.ok(v2.buttonKo && v2.title != null, '버튼 글자·설명이 없습니다');
  /* 미확정이면 미확정이라고 말한다 */
  const v3 = endingView(RUN.S, RUN.io, {});
  assert.equal(v3.targetWon, null);
});

check('E-3 ★ endingView 가 세 함수와 **같은 답**을 낸다 (두 곳에서 세지 않는다)', () => {
  /* ★ 아직 **안 닿은** 판으로 잰다 — 끝난 판은 셋이 다 'done' 이라 어긋나도 안 보인다 */
  const opt = { rules: endingRulesFrom({ targetWon: 10_000_000 }) };
  const S = playToEnding({ rules: opt.rules, assistMove: true, days: 160 }).S;
  const v = endingView(S, {}, opt);
  const c = canFinish(S, {}, opt);
  const g = endingGoal(S, {}, opt);
  assert.equal(v.ok, !!c.ok, 'endingView.ok 가 canFinish 와 다릅니다');
  assert.equal(v.why, c.why || null, 'endingView.why 가 canFinish 와 다릅니다');
  assert.equal(v.goal ? v.goal.id : null, g ? g.id : null, 'endingView.goal 이 endingGoal 과 다릅니다');
});

/* ══ F · 실측 — ④ 목표 금액을 정할 근거 ═════════════════════════════════ */
check('F-1 원룸에서 얼마가 모이나 — 목표 금액을 정하는 쪽이 볼 표', () => {
  const r = playToEnding({ assistMove: true, days: 260 });   // 미확정 판 = 안 멈추고 계속 번다
  const rows = r.trace.oneroomCash;
  assert.ok(rows.length > 20, `원룸 날이 ${rows.length}일밖에 안 됩니다`);
  const at = (n) => rows.find(x => x.day - rows[0].day >= n) || rows[rows.length - 1];
  for (const n of [0, 30, 60, 90, 120]) {
    const row = at(n);
    info(`원룸 ${String(n).padStart(3)}일째 (게임 ${row.day}일) — ` +
         `현금 ${row.cashWon.toLocaleString()}원 · 다 팔면 ${row.netWorthWon.toLocaleString()}원`);
  }
  const peak = rows.reduce((a, b) => (b.cashWon > a.cashWon ? b : a));
  info(`★ 원룸 ${rows.length}일 동안의 최고 현금 = ${peak.cashWon.toLocaleString()}원 ` +
       `(게임 ${peak.day}일차) — 이 판의 벌이는 삽수 하나뿐이고 월세는 계속 나간다`);
  info('⇒ ④ 목표 금액을 이 값 위로 잡으면 지금 벌이로는 영영 안 닿는다. ' +
       'docs/propagation.md §7 의 후보 1,000만원과 이 실측을 나란히 놓고 정해야 한다');
  assert.ok(peak.cashWon > 0, '원룸에서 현금이 한 번도 안 올랐습니다');
});

check('F-2 ★ 하루 손(체력)이 삽수 회전을 안 막는다 — 원룸 판에서 잰다', () => {
  const st = staminaOf(RUN.S);
  assert.ok(st.left >= 0 && st.left <= st.max, `체력이 범위 밖입니다: ${st.left}/${st.max}`);
  assert.ok(RUN.trace.cutsTaken > 0, '체력이 붙은 뒤로 한 개도 못 잘랐습니다');
  info(`체력이 붙은 판에서 자른 삽수 ${RUN.trace.cutsTaken}개 — 자르기가 막히지 않았다`);
});

/* ══ 결과 ═══════════════════════════════════════════════════════════════ */
let fail = 0, pass = 0;
for (const [tag, name, msg] of results) {
  if (tag === 'INFO') { console.log(`INFO  ${name}`); continue; }
  if (tag === 'PASS') { pass++; console.log(`PASS  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}\n      → ${msg}`); }
}
console.log(`\nending_flow: ${fail ? 'FAIL' : 'PASS'}  (${pass}/${pass + fail})`);
process.exit(fail ? 1 : 0);
