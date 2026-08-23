/* ============================================================
   probe_lamp_when.mjs — 등이 언제 필요한가 · 없으면 얼마나 안 자라나 ([growth] 소유)
   ------------------------------------------------------------
     node tools/probe_lamp_when.mjs          (브라우저 · 서버 필요 없음)

   ★ 무엇을 재나 — 반지하 창턱에 놓은 몬스테라가 **게임 날짜로** 며칠이나 자라나.
     빛은 game 이 쓰는 `createProfileLight` 를 그대로 부르고, 생장은 `plant_grow.html`
     엔진을 그대로 돌린다. 새 셈을 짓지 않는다.

   ⚠⚠ 이 자를 쓸 때 반드시 지킬 것 셋 — 셋 다 내가 한 번씩 틀렸던 자리다:
     ① **게임 0일 = 연중 135일**(여름 90 + 45). `tutorial.yearDay0Of` 가 정본이고
        빛에는 `S.sim.yearDay0` 으로 넘긴다. 안 넘기면 **봄부터 재게 된다.**
     ② **엔진은 하루 값이 아니라 7일 이동평균으로 가른다**(`growthBlockReason`).
        하루 값으로 세면 다른 물음에 답하게 된다 — 실측이 25% 였던 것이 7일평균으로는 5% 였다.
     ③ **임계값 정본이 실릴 때까지 기다려야 한다.** 안 기다리면 게이트가 막아
        **모든 판이 「자란 날 0」** 으로 나온다(내가 그래서 네 판을 버렸다).

   ⚠ 이 표는 **창턱 한 자리** 이야기다. 반지하에서 창턱 다음은 0.58 이라
     **등이 있어도 안 된다.** 「등만 있으면 된다」로 읽지 말 것.
============================================================ */
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
/* ★★ 2026-08-17 — `sellCutting`·`sellPot` 이 **없어졌다**(shop.js §⑦-0). 몬스테라 것은
   중고 거래로만 나간다. 이 재현이 재는 것은 「끝까지 도는가」라 **날짜는 실제로 흘린다** —
   하루 루프가 `stepMarket` 을 돌리므로 연락은 저절로 온다. */
import { orderItem, stockOf, incomingOf, listCutting, listPot, dealListing,
         marketStatus, marketGate, listingFor, MARKET_MIN_LEAVES, priceOf,
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

/* ── [growth] 등을 언제 살 수 있나 · 그 전에 식물이 자라나 (게임 날짜 기준) ──
   ★ 게임 0일 = 연중 135일(여름 90 + 45). tutorial.yearDay0Of 가 정본이고
     빛은 S.sim.yearDay0 으로 받는다. 처음에 이걸 안 넘겨 봄부터 재고 있었다. */
import { createProfileLight as CPL } from '../src/game/room_profile.js';
import { yearDay0Of, TUTORIAL_RULES as TR } from '../src/game/tutorial.js';
const P = J('../data/profiles/room_profile.banjiha.json');
const LD = { thresholds: J('../data/balance/light_thresholds.json'),
             weather: J('../data/balance/weather.json'),
             electricity: J('../data/balance/electricity.json') };
/* ★ 정본이 실릴 때까지 기다린다 — fetch 가 promise 라 한 틱으로는 부족하다.
   ★ 안 기다리면 growthBlockReason 이 「정본이 안 실렸습니다」로 막고 **아무것도 안 자란다.**
     실제로 그래서 첫 판 넷이 통째로 무효였다(자란 날 0). 내가 만든 게이트가 나를 잡았다. */
for (let i = 0; i < 400 && !G.thLoaded(); i++) await new Promise(r => setImmediate(r));
if (!G.thLoaded()) { console.error('정본이 안 실렸습니다 — 잴 수 없습니다'); process.exit(2); }
const YD0 = yearDay0Of(TR);
const SILL = 'banjiha-sill:0';
const MIN = J('../data/growth_tuning.json').thresholds.min;

function run(mode, lampDay, days) {
  days = days || 240;
  const light = CPL({ ...P, uidStable: true }, LD);
  try { G.plantSeed(7); } catch (e) {}
  G.matResetAll(); G.resetDailyLight(); G.setGrowth(45);
  const marks = []; let grew = 0, last = null;
  for (let d = 1; d <= days; d++) {
    const lamps = (lampDay != null && d >= lampDay) ? 1 : 0;
    const S = { sim: { mode: mode, yearDay0: YD0 }, lamps: { count: lamps, litHours: 12 },
                pots: [], placedItems: [] };
    const r = light.daily(d, S);
    const s = (r.report.slots || []).find(x => x.slotId === SILL);
    G.setDailyLight(s ? s.dli : null);
    const st = G.advanceTo(G.calendarDay() + 1);
    if (st.grew) grew++;
    last = st.blocked;
    if ([30, 60, 90, 120, 180, 240].indexOf(d) >= 0)
      marks.push('d' + d + ': 유효 ' + st.growth + '(+' + (st.growth - 45) + ')  ' +
                 G.growthPhase().phaseKo + '  7일평균 ' + (G.dli7() || 0).toFixed(2) +
                 '  철 ' + (r.sky && r.sky.season));
  }
  return { grew: grew, marks: marks, last: last };
}
/* ── [core] 400일 판(novice·지갑)에 붙일 틀 ──
   그쪽은 「돈이 어떻게 도나」, 여기는 「빛이 어떻게 도나」. 게임 날짜를 축으로 맞춘다.
   ⚠ 표를 게임 날짜로 읽으려면 연중 오프셋(YD0=135)이 필요하다 — 그건 여기서 이미 넣었다. */
function curve(mode, lamps, days) {
  const light = CPL({ ...P, uidStable: true }, LD);
  const hist = [], rows = [];
  let worst = { day: null, avg7: 99 }, failDays = 0;
  for (let d = 1; d <= days; d++) {
    const S = { sim: { mode: mode, yearDay0: YD0 }, lamps: { count: lamps, litHours: 12 },
                pots: [], placedItems: [] };
    const r = light.daily(d, S);
    const sl = (r.report.slots || []).find(x => x.slotId === SILL);
    hist.push(sl ? sl.dli : 0);
    const w = hist.slice(-7);
    const avg7 = w.reduce(function (a, b) { return a + b; }, 0) / w.length;
    if (d >= 7) {
      if (avg7 < MIN) failDays++;
      if (avg7 < worst.avg7) worst = { day: d, avg7: avg7, season: r.sky && r.sky.season };
    }
    if (d % 40 === 0) rows.push('d' + String(d).padStart(3) + ' ' + (r.sky && r.sky.season).padEnd(6) +
      ' 7일평균 ' + avg7.toFixed(2) + (avg7 >= MIN ? '  자람' : '  ★정지'));
  }
  return { rows: rows, worst: worst, failDays: failDays, days: days };
}
console.log('── [core] 400일 판에 붙일 틀 · 창턱 7일평균 (게임 날짜)');
[['real', 0], ['real', 1], ['real', 3], ['novice', 0]].forEach(function (x) {
  const c = curve(x[0], x[1], 400);
  console.log('[' + x[0] + ' 등' + x[1] + '] 정지한 날 ' + c.failDays + '/394  ·  연중 최저 7일평균 ' +
    c.worst.avg7.toFixed(2) + ' (d' + c.worst.day + ' ' + c.worst.season + ')  여유 ' +
    (c.worst.avg7 - MIN).toFixed(2));
  c.rows.forEach(function (r) { console.log('   ' + r); });
});
console.log('');
console.log('게임 0일 = 연중 ' + YD0 + '일 · 창턱 ' + SILL + ' · 최소 광량 ' + MIN); console.log('');
['novice', 'real'].forEach(function (mode) {
  [null, 60].forEach(function (lampDay) {
    const r = run(mode, lampDay);
    console.log('[' + mode + '] 등 ' + (lampDay == null ? '안 삼' : 'd' + lampDay + '에 1개') +
                '  ·  240일 중 자란 날 ' + r.grew);
    r.marks.forEach(function (m) { console.log('    ' + m); });
    console.log('    끝 막힘: ' + (r.last || '없음')); console.log('');
  });
});
