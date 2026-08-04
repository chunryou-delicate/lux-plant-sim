/* 이사·판매 경제 실측 — story_arc.md §5 의 ③·④·⑤번 줄
 *
 *   node tools/probe_move_econ.mjs
 *
 * 재는 것
 *   ① **데드라인** — 시작 100만이 실제로 며칠에 0 이 되나 (§3 의 "73일"을 검산한다)
 *   ② **잎 생산 속도** — 그루 하나가 며칠에 잎 한 장을 내나 (자리 밝기별). 삽수 수입의 상한이다
 *   ③ **원룸(③단계)** — 슬롯 수·밝기·월세. 판매가 표
 *   ④ **내 집 마련(④단계) 목표 금액** — 위 셋에서 역산한다
 *
 * ⚠ 값을 하나도 안 바꾼다. data/** 는 읽기만 한다. 여기서 나오는 것은 **권고**다.
 */
import assert from 'node:assert';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTutorialState, tutorialDay, TUTORIAL_RULES } from '../src/game/tutorial.js';
import { priceOf, varieLeavesNeededFor, VARIE_GRADES, UNIT_WON, ADULT_MIN_LEAVES,
         CATALOG, buyPriceOf } from '../src/game/shop.js';
import { METHODS } from '../src/game/propagation.js';
import { ARRIVAL } from '../src/game/state.js';
import { createProfileLight } from '../src/game/room_profile.js';
import { daylightDLI } from '../src/engine/daily_light.js';
import { weatherOf, weatherE } from '../src/engine/weather.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const J = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url), 'utf8'));
const HOMES = J('../data/balance/homes.json');
const GT = J('../data/growth_tuning.json');
const B = GT.thresholds;
const won = n => Math.round(n).toLocaleString() + '원';

/* ══ ① 데드라인 — 돈이 며칠에 0 이 되나 ═══════════════════════════════════
   tutorial.tutorialDay 를 그대로 돌린다. 산수를 여기서 다시 쓰지 않는다. */
console.log('══ 이사·판매 경제 실측 (probe_move_econ) ═══════════════════════════');
console.log('── ① 데드라인 — 시작 100만이 며칠에 0 이 되나 ─────────────────────');
console.log(`   확정 수치: 시작 ${won(TUTORIAL_RULES.startCashWon)} · 하루 지출 ${won(TUTORIAL_RULES.dailySpendWon)} ` +
            `· 월세 ${won(TUTORIAL_RULES.rentWon)}/${TUTORIAL_RULES.rentPeriodDays}일 · 유예 ${TUTORIAL_RULES.rentGraceDays}일`);
function deadline({ savedWonPerDay = 0, lamps = 0 } = {}) {
  const ts = createTutorialState({ enabled: true });
  ts.lamp.owned = lamps;
  for (let d = 1; d <= 400; d++) {
    tutorialDay(ts, { firstPlayDone: true, savedWon: savedWonPerDay });
    if (ts.bankrupt) return d;
  }
  return null;
}
/* 콩나물 절감 — 회전 5일에 3,000원(first_play.cropKindSavedWon[0]) = 하루 600원.
   씨앗값은 지갑에서 따로 나가므로 순액은 그보다 작다(test_banjiha_routes D-2 가 하루 379원으로 잰다). */
const rows1 = [
  ['콩나물 없음', deadline({})],
  ['콩나물 순액 379원/일 (실측 · D-2)', deadline({ savedWonPerDay: 379 })],
  ['콩나물 총절감 600원/일 (씨앗값 무시)', deadline({ savedWonPerDay: 600 })],
  ['콩나물 379원 + 등 1개(전기 23원/일)', deadline({ savedWonPerDay: 379, lamps: 1 })]
];
for (const [ko, d] of rows1) console.log(`   ${String(ko).padEnd(38)} → 파산 튜토 ${d}일`);
console.log(`   ★ story_arc §3 은 데드라인을 **73일**로 적어 두었다 — 실측은 위 표다.`);
const base = deadline({ savedWonPerDay: 379 });
console.log(`     차이의 정체: 73 은 "하루 순지출 = 20,000 − 월세몫" 을 **월세 목돈 없이** 나눈 값이다.`);
console.log(`     실제로는 30일·60일에 ${won(TUTORIAL_RULES.rentWon)}씩 목돈이 빠져 ${base}일에 0 이 된다.\n`);

/* 잔액 곡선 — 어디서 꺾이나 */
{
  const ts = createTutorialState({ enabled: true });
  const marks = [];
  for (let d = 1; d <= 90; d++) {
    tutorialDay(ts, { firstPlayDone: true, savedWon: 379 });
    if ([15, 29, 30, 45, 57, 59, 60, 61, 73, 90].includes(d)) marks.push(`${d}일 ${won(ts.cashWon)}`);
  }
  console.log('   잔액 곡선(콩나물 순액 379원/일) — ' + marks.join(' · ') + '\n');
}

/* ══ ② 잎 생산 속도 — 삽수 수입의 상한 ═══════════════════════════════════ */
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
  const src = main.replace(/\n\s*init\(\);\s*updateCam\(\);\s*$/, '\n');
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
assert.ok(G.thLoaded(), '임계값 정본이 안 실렸습니다');

function leafCurve(seed, dli, days) {
  try { G.plantSeed(seed); } catch {}
  G.matResetAll(); G.resetDailyLight(); G.setGrowth(ARRIVAL.growthDays);
  let cal = ARRIVAL.growthDays;
  const at = {};
  for (let d = 1; d <= days; d++) {
    G.setDailyLight(dli); G.advanceTo(++cal);
    if (d % 90 === 0) at[d] = G.leafStats().leaves;
  }
  const st = G.leafStats();
  return { at, leaves: st.leaves, varie: st.variegatedLeaves || 0, mature: st.matureLeaves,
           nodes: G.cuttableNodes().length };
}
console.log('── ② 잎 생산 속도 — 그루 하나가 며칠에 잎 한 장을 내나 ─────────────');
console.log('   (도착 개체 · 씨앗 3판 중앙 · 하루 DLI 고정 · 자르지 않고 그대로 둔 값)');
console.log('   DLI   90일  180일  360일   잎/일     한 장에      삽수값/일(12,000원)');
const med = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
for (const dli of [2.4, 3.0, 3.77, 5.61, 8.0, 12.0]) {
  const rs = [1, 3, 7].map(s => leafCurve(s, dli, 360));
  const l90 = med(rs.map(r => r.at[90])), l180 = med(rs.map(r => r.at[180])), l360 = med(rs.map(r => r.leaves));
  const perDay = (l360 - 1) / 360;
  console.log(`   ${String(dli).padStart(5)} ${String(l90).padStart(5)} ${String(l180).padStart(6)} ` +
    `${String(l360).padStart(6)}   ${perDay.toFixed(4)}  ${perDay ? (1 / perDay).toFixed(0) + '일' : '—'}` +
    `      ${perDay ? won(perDay * UNIT_WON.monstera.cutting) : '0원'}`);
}
console.log('   ★★ DLI 가 3.0(min)만 넘으면 **속도가 같다** — 밝기는 빠르기를 안 바꾸고 ');
console.log('      "자라나 마나"만 가른다. 그래서 식물등의 값은 오직 **문턱을 넘겨 주는 것**뿐이다.');
console.log('   ★ 이 값이 **삽수 수입의 물리적 상한**이다 — 잘라 팔 수 있는 것은 그루가 낸 잎뿐이다');

/* ★ 무늬는 몇 장이나 나나 — ④ 의 자금이 무늬에서 나오므로 이게 진짜 병목이다 */
console.log('\n   무늬 잎 축적 (360일 · 자르지 않음 · 씨앗 12판 평균)');
console.log('   DLI    잎    무늬잎  무늬비율   그 그루 값        비고');
const SEEDS12 = Array.from({ length: 12 }, (_, i) => i * 7 + 1);
for (const dli of [3.77, 5.61, 8.0, 12.0]) {
  const rs = SEEDS12.map(s => leafCurve(s, dli, 360));
  const l = rs.reduce((a, r) => a + r.leaves, 0) / rs.length;
  const v = rs.reduce((a, r) => a + r.varie, 0) / rs.length;
  const vi = Math.round(v), li = Math.max(1, Math.round(l));
  const q = priceOf({ leaves: li, variegatedLeaves: Math.min(li, vi) });
  console.log(`   ${String(dli).padStart(5)} ${l.toFixed(1).padStart(6)} ${v.toFixed(1).padStart(8)} ` +
    `${(l ? v / l * 100 : 0).toFixed(0).padStart(7)}%  ${won(q.won).padStart(12)}   ${q.gradeKo}`);
}
console.log('   ★ 하프문(무늬 잎 3장)이 ④ 의 단위다 — 위 표가 "한 그루로 거기까지 가나"에 답한다.');
console.log(`     (propagation: 물꽂이 뿌리 ${METHODS.water.rootDays}일 · 병 ${won(buyPriceOf('jar'))}/${CATALOG.jar.leadDays}일)\n`);

/* ══ ③ 원룸(③단계) — 슬롯·밝기·월세·판매가 ═══════════════════════════════ */
console.log('── ③ 원룸 이후 — 슬롯 수 · 월세 · 판매가 ────────────────────────');
const banjiha = createProfileLight(J('../data/profiles/room_profile.banjiha.json'),
  { lightTh: J('../data/balance/light_thresholds.json'), weatherBalance: J('../data/balance/weather.json') });
/* ★ 기대 7일평균 = 맑음 하루값 × E[날씨계수]. **해석식**이라 표본 오차가 안 섞인다
   (weather.js §weekStats 주석 — 90일 굴려 평균 내면 ±5%p 가 섞여 결론이 뒤집힌 적이 있다). */
function roomRows(room) {
  const p = J(`../data/profiles/room_profile.${room}.json`);
  const avg7 = (ratio, season) => daylightDLI(ratio, { weather: 'clear', season }) * weatherE(season);
  const summer = p.slots.map(s => avg7(s.ratio, 'summer'));
  const winter = p.slots.map(s => avg7(s.ratio, 'winter'));
  const peak = p.slots.map(s => daylightDLI(s.ratio, { weather: 'clear', season: 'summer' }));
  const home = HOMES.homes.find(h => h.id === room) || {};
  return { room, slots: p.slots.length, peakSummer: Math.max(...peak),
           bestSummer: Math.max(...summer), bestWinter: Math.max(...winter),
           ge3s: summer.filter(v => v >= B.min).length, ge6s: summer.filter(v => v >= B.fenestrate).length,
           ge3w: winter.filter(v => v >= B.min).length,
           rent: home.rent ?? null, deposit: home.deposit ?? null, moveCost: home.moveCost ?? null };
}
console.log('   (avg7 = 맑음 peak × E[k] 0.643 × 계절 — 해석식. 굴림 평균이 아니다)');
console.log('   방        슬롯  peak여름  avg7여름  avg7겨울  ≥3(여름) ≥6(여름) ≥3(겨울)   월세      보증금     이사비');
for (const r of ['banjiha', 'oneroom', 'tworoom', 'apartment'].map(roomRows)) {
  console.log(`   ${r.room.padEnd(10)}${String(r.slots).padStart(4)}  ${r.peakSummer.toFixed(2).padStart(7)}  ` +
    `${r.bestSummer.toFixed(2).padStart(7)}  ` +
    `${r.bestWinter.toFixed(2).padStart(7)}  ${String(r.ge3s).padStart(7)} ${String(r.ge6s).padStart(8)} ` +
    `${String(r.ge3w).padStart(8)}   ${won(r.rent).padStart(9)} ${won(r.deposit).padStart(11)} ${won(r.moveCost).padStart(11)}`);
}
console.log('   ⚠ 반지하 말고는 프로파일에 **등 PPFD 가 없다**(lampCounts:[0]) — 등을 얹은 값은 못 잰다.');
console.log('   ⚠ 반지하 말고는 uidStable 계약 이전 파일이라 **자리 이름을 못 믿는다**(칸 수·분포만 유효).\n');

console.log('   판매가 표 (shop.priceOf · 무늬 등급은 잎 장수가 정한다)');
console.log(`   등급: ${VARIE_GRADES.map(g => `${g.ko} 무늬잎≥${g.minVarieLeaves} ×${g.leafMult.toFixed(1)}`).join(' · ')}`);
console.log(`   잎 ${ADULT_MIN_LEAVES}장부터 성체(등급 상한 해제) · 잎당 ${won(UNIT_WON.monstera.adult)} · 하한 ${won(UNIT_WON.monstera.cutting)}`);
console.log('   잎수  무늬0      무늬1        무늬2         무늬3         전부무늬');
for (const n of [1, 2, 3, 4, 6, 9, 12]) {
  const c = v => v <= n ? won(priceOf({ leaves: n, variegatedLeaves: v }).won).padStart(12) : ''.padStart(12);
  console.log(`   ${String(n).padStart(4)} ${c(0)}${c(1)}${c(2)}${c(3)}${c(n)}`);
}
console.log('');

/* ══ ④ 내 집 마련 목표 금액 — 역산 ═══════════════════════════════════════ */
console.log('── ④ 내 집 마련 목표 금액 — 무엇에서 역산되나 ─────────────────────');
const ONEROOM_SLOTS = roomRows('oneroom').slots;
console.log(`   원룸 슬롯 ${ONEROOM_SLOTS}칸 · 월세 ${won(roomRows('oneroom').rent)}/월 = ${won(roomRows('oneroom').rent / 30)}/일`);
/* 슬롯을 다 채운 민무늬 삽수 수입의 상한 — ②의 잎/일 × 슬롯 × 삽수값 */
const rs = [1, 3, 7].map(s => leafCurve(s, 5.61, 360));
const perDay = (med(rs.map(r => r.leaves)) - 1) / 360;
for (const slots of [ONEROOM_SLOTS, Math.round(ONEROOM_SLOTS / 2)]) {
  const daily = perDay * slots * UNIT_WON.monstera.cutting;
  console.log(`   민무늬 삽수만 — 슬롯 ${slots}칸 전부 몬스테라(DLI 5.61) → 하루 ${won(daily)}` +
    ` (원룸 하루 지출 ${won(TUTORIAL_RULES.dailySpendWon)} 의 ${(daily / TUTORIAL_RULES.dailySpendWon * 100).toFixed(0)}%)`);
}
console.log('   ★ 민무늬만으로는 하루 지출도 못 막는다 — sale_economy.md §0 의 결론이 그대로 유효하다.');
console.log('   ⇒ ④ 의 자금은 **무늬 성체 몇 그루**로 나온다. 얼마짜리인지가 곧 목표 금액이다:');
for (const [n, v] of [[3, 3], [4, 3], [6, 3], [6, 6], [9, 3], [12, 3]]) {
  const q = priceOf({ leaves: n, variegatedLeaves: v });
  console.log(`     잎 ${n}장 · 무늬 ${v}장 (${q.gradeKo}) = ${won(q.won).padStart(12)}`);
}
console.log('');
console.log('   목표 금액 후보 — "무늬 성체 N 그루"로 읽히는 값');
const HALF3 = priceOf({ leaves: 3, variegatedLeaves: 3 }).won;
for (const n of [2, 3, 4, 5]) {
  const target = HALF3 * n;
  console.log(`     하프문 잎3(${won(HALF3)}) × ${n}그루 = ${won(target).padStart(12)}` +
    `   — 잎 한 장에 ${(1 / perDay).toFixed(0)}일이므로 그루당 ${Math.round(3 / perDay)}일`);
}
const need = varieLeavesNeededFor(HALF3 * 3, { leaves: 12 });
console.log(`   역산 예: 잎 12장짜리 한 그루로 ${won(HALF3 * 3)} 을 만들려면 무늬 잎 ${need.needVarieLeaves}장 ` +
            `(그때 값 ${won(need.wonAtNeed)})`);
console.log('');
console.log('★ 조건: 반지하/원룸 프로파일 2026-08-02 · 몬스테라 · 날씨 맑0.55/흐0.30/비0.15 · ' +
            '판정 7일 이동평균 · 잎 생산은 plant_grow.html 실물 · 경제는 tutorial.tutorialDay 실물');
