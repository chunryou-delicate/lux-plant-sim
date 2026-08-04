/* 겨울에 생장이 어떻게 되나 — story_arc.md §5 ②번 줄
 *
 *   node tools/probe_winter_growth.mjs
 *
 * ★ 질문: **"겨울에 생장을 정지시킬지, 위험 구간만 만들지"**
 *   story_arc 는 이걸 "정하는 것"으로 적어 두었는데, 실제로 재 보면 **이미 정해져 있다** —
 *   `growth_tuning.json` 의 밴드(min 3.0)가 그 판정을 이미 하고 있고, 계절을 켜는 순간
 *   반지하 창턱은 등을 켜도 겨울에 그 밑으로 내려간다(tools/probe_season_dli.mjs).
 *   그래서 여기서 재는 것은 "정할까"가 아니라 **"켜면 무슨 일이 나나"** 다.
 *
 * ★ 진짜 생장 엔진(plant_grow.html)을 헤드리스로 올린다 — tools/test_banjiha_routes.mjs 와
 *   같은 방식이다. 대역이 아니라 실제 유효 생장일·잎·단계를 센다.
 *
 * ⚠ 값을 하나도 안 바꾼다. data/** 는 읽기만 한다.
 */
import assert from 'node:assert';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProfileLight } from '../src/game/room_profile.js';
import { ARRIVAL } from '../src/game/state.js';
import { weatherOf, seasonOf } from '../src/engine/weather.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const J = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url), 'utf8'));
const TH = J('../data/balance/light_thresholds.json');
const WB = J('../data/balance/weather.json');
const GT = J('../data/growth_tuning.json');
const B = GT.thresholds;

const light = createProfileLight(J('../data/profiles/room_profile.banjiha.json'),
  { lightTh: TH, weatherBalance: WB });
const SILL = 'banjiha-sill:0';

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

function stand(seed) {
  try { G.plantSeed(seed); } catch { /* 3D 무대 없음 */ }
  G.matResetAll(); G.resetDailyLight(); G.setGrowth(ARRIVAL.growthDays);
  return G;
}

/* ── 한 판 굴리기 — 하루 DLI 를 넣고 유효 생장일·잎을 센다 ────────────────
   dliOfDay(gameDay) 를 넘긴다. 계절을 켜고 끄는 것이 이 함수 하나로 갈린다. */
function run(seed, days, dliOfDay) {
  const g = stand(seed);
  let cal = ARRIVAL.growthDays;
  const bySeason = {};          // 계절별 { days, grew }
  const marks = [];
  let spearDay = null;
  for (let d = 1; d <= days; d++) {
    const { dli, season } = dliOfDay(d);
    g.setDailyLight(dli);
    const before = g.growthDays();
    g.advanceTo(++cal);
    const grew = g.growthDays() > before;
    const s = bySeason[season] || (bySeason[season] = { days: 0, grew: 0 });
    s.days++; if (grew) s.grew++;
    if (spearDay == null && g.growthPhase && g.growthPhase() &&
        g.growthPhase().phaseId === 'spear_furled') spearDay = d;
    if (d % 30 === 0) marks.push({ d, season, dli: +dli.toFixed(2),
      eff: g.growthDays(), leaves: g.leafStats().leaves, dli7: +(g.dli7() || 0).toFixed(2) });
  }
  return { growthDays: g.growthDays(), stats: g.leafStats(),
           nodes: g.cuttableNodes().length, bySeason, marks, spearDay };
}

const SEASON_KO = { spring: '봄', summer: '여름', autumn: '가을', winter: '겨울' };
const START = 90 + 45;   // 여름 45일차 (tutorial.TUTORIAL_RULES)
const pad = (s, n) => String(s).padEnd(n, ' ');
const rpad = (s, n) => String(s).padStart(n, ' ');

/* 세 가지 빛 공급 ─ 계절을 끄고(지금 게임) · 켜고(계절 켰을 때) */
const supply = {
  novice: (lamps) => (d) => ({                       // 지금 코어가 도는 방식(novice: 맑음·여름 고정)
    dli: light.dliOfSlot(SILL, { weather: 'clear', season: 'summer', lampCount: lamps, litHours: 12 }),
    season: 'summer(고정)' }),
  seasonal: (lamps) => (d) => {                      // 계절·날씨를 굴린 방식
    const abs = START + d;
    const season = seasonOf(abs);
    return { dli: light.dliOfSlot(SILL, { weather: weatherOf(abs, { season }), season, lampCount: lamps, litHours: 12 }),
             season };
  }
};

console.log('══ 겨울 생장 실측 (probe_winter_growth) ═══════════════════════════');
console.log(`조건: 반지하 · ${SILL} · 몬스테라 · 도착 유효 ${ARRIVAL.growthDays}일 · 등 12h · 300일`);
console.log(`밴드: die ${B.die} · survive ${B.survive} · **min ${B.min}(이 밑이면 형태가 정지)** · fenestrate ${B.fenestrate}\n`);

console.log('── ① 300일에 유효 생장일이 얼마나 쌓이나 (씨앗 4판 중앙) ──────────');
console.log(pad('빛 공급', 22) + pad('등', 5) + rpad('유효생장일', 11) + rpad('생장한날', 9) +
            rpad('잎', 5) + rpad('마디', 6) + rpad('말린새순', 9));
const SEEDS = [1, 3, 7, 11];
const med = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const table = [];
for (const [key, ko] of [['novice', '계절 끔 (지금 게임)'], ['seasonal', '계절 켬 (날씨 굴림)']])
  for (const lamps of [0, 1, 2]) {
    const rs = SEEDS.map(s => run(s, 300, supply[key](lamps)));
    const r = rs[0];
    const grewDays = med(rs.map(x => Object.values(x.bySeason).reduce((a, b) => a + b.grew, 0)));
    const row = { key, ko, lamps,
      eff: med(rs.map(x => x.growthDays)) - ARRIVAL.growthDays,
      grew: grewDays, leaves: med(rs.map(x => x.stats.leaves)),
      nodes: med(rs.map(x => x.nodes)),
      spear: med(rs.map(x => x.spearDay == null ? 9999 : x.spearDay)),
      bySeason: r.bySeason };
    table.push(row);
    console.log(pad(ko, 22) + pad(lamps + '개', 5) + rpad('+' + row.eff, 11) + rpad(row.grew, 9) +
      rpad(row.leaves, 5) + rpad(row.nodes, 6) + rpad(row.spear === 9999 ? '안 옴' : row.spear + '일', 9));
  }
console.log('★ 유효생장일 = 300일 중 실제로 형태가 나아간 날. 도착값(45)을 뺀 증가분이다.\n');

console.log('── ② 계절마다 며칠이나 자라나 (계절 켬 · 300일) ────────────────');
console.log(pad('등', 5) + ['여름', '가을', '겨울', '봄'].map(x => rpad(x, 14)).join(''));
for (const row of table.filter(r => r.key === 'seasonal')) {
  const cells = ['summer', 'autumn', 'winter', 'spring'].map(s => {
    const v = row.bySeason[s];
    return rpad(v ? `${v.grew}/${v.days}일` : '—', 14);
  });
  console.log(pad(row.lamps + '개', 5) + cells.join(''));
}
console.log('★ "n/m일" = 그 계절에 있던 m 일 중 형태가 나아간 날이 n 일.\n');

/* ── ③ 문턱을 얼마나 내리면 겨울이 "위험 구간"이 되나 ──────────────────
   min 을 안 바꾸고 답을 내려면 **필요한 DLI 를 거꾸로** 재는 것이 정직하다.
   여기서는 "겨울 avg7 이 min 을 넘으려면 등이 몇 개 필요한가"와
   "min 을 얼마로 두면 등 1개 겨울이 통과하나"를 같이 낸다. */
console.log('── ③ 겨울을 통과시키려면 무엇을 얼마나 바꿔야 하나 ────────────────');
for (const lamps of [0, 1, 2]) {
  const w = [];
  for (let i = 0; i < 90; i++) {
    const abs = 270 + i;
    w.push(light.dliOfSlot(SILL, { weather: weatherOf(abs, { season: 'winter' }), season: 'winter', lampCount: lamps, litHours: 12 }));
  }
  const a7 = [];
  for (let i = 0; i + 7 <= w.length; i++) a7.push(w.slice(i, i + 7).reduce((a, b) => a + b, 0) / 7);
  const mean = a7.reduce((a, b) => a + b, 0) / a7.length;
  console.log(`  겨울 등 ${lamps}개 — avg7 평균 ${mean.toFixed(2)} · min ${B.min} 대비 ${(mean / B.min * 100).toFixed(0)}% · ` +
              `min 을 ${(Math.floor(mean * 10) / 10).toFixed(1)} 이하로 내리면 통과`);
}
const litH = [12, 14, 16, 18];
console.log('  ⤷ 점등 시간을 늘리면(등 1개 · 겨울):');
for (const h of litH) {
  const w = [];
  for (let i = 0; i < 90; i++) {
    const abs = 270 + i;
    w.push(light.dliOfSlot(SILL, { weather: weatherOf(abs, { season: 'winter' }), season: 'winter', lampCount: 1, litHours: h }));
  }
  const a7 = [];
  for (let i = 0; i + 7 <= w.length; i++) a7.push(w.slice(i, i + 7).reduce((a, b) => a + b, 0) / 7);
  const mean = a7.reduce((a, b) => a + b, 0) / a7.length;
  console.log(`     ${h}h — avg7 ${mean.toFixed(2)} ${mean >= B.min ? '★통과' : '미달'} · 전기 ` +
              `${Math.round(12 * h / 1000 * 160)}원/일`);
}
console.log('');
console.log('★ 조건: 반지하 · banjiha-sill:0 · 몬스테라(민무늬) · 프로파일 2026-08-02 · ' +
            '날씨 맑0.55/흐0.30/비0.15 · 판정 7일 이동평균 · 생장 엔진 plant_grow.html 실물');
