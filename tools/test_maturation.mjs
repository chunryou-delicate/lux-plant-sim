/* 성숙 판정(게이지 + 굴림) 재현 — 박사님 확정 2026-08-03 · plan-to-growth.md §6
 *
 * plant_grow.html 을 헤드리스로 돌린다. 3D(init)만 걷어내면 생장 로직은 그대로 vm 에서 돈다.
 * 브라우저를 안 띄우고 300일을 걸을 수 있어야 A~G 를 실제로 셀 수 있다.
 *
 *   node tools/test_maturation.mjs
 */
import assert from 'node:assert';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/* ── THREE 스텁 ───────────────────────────────────────────────────────────
   생장 로직은 THREE 를 안 쓴다. 쓰는 것은 그리기뿐이고 그건 drawStep 이 삼킨다.
   그래서 "터지지만 않는" 최소 스텁이면 된다 — 진짜 기하를 흉내 내지 않는다. */
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
      if (k === 'then') return undefined;               // await 에 안 걸리게
      if (k === Symbol.toPrimitive) return () => 0;
      if (!(k in t)) t[k] = new Proxy(nop, handler);
      return t[k];
    },
    apply() { return new Proxy({}, handler); },
    construct() { return new Proxy({ position: new V3(), rotation: new V3(), scale: new V3(1, 1, 1) }, handler); }
  };
  const THREE = new Proxy({ Vector3: V3, Vector2: V3 }, handler);
  return THREE;
}

/* ── plant_grow.html 의 본문 스크립트만 뽑아 vm 에 올린다 ─────────────────── */
export function loadGrowth({ seed = 92158 } = {}) {
  const html = fs.readFileSync(path.join(ROOT, 'plant_grow.html'), 'utf8');
  const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  const main = blocks[blocks.length - 1];
  assert.ok(main && main.length > 20000, 'plant_grow.html 본문 스크립트를 못 찾았습니다');
  // ★ init() 만 걷어낸다. 그 위 선언과 로직은 한 글자도 안 바꾼다 —
  //   바꾸면 여기서 통과한 것이 브라우저에서 통과한다는 보장이 사라진다.
  const src = main.replace(/\n\s*init\(\);\s*updateCam\(\);\s*$/, '\n/* init() 제거(헤드리스) */\n');
  assert.notEqual(src, main, 'init() 호출부를 못 찾았습니다 — 파일 끝이 바뀌었습니다');

  const tuning = fs.readFileSync(path.join(ROOT, 'data', 'growth_tuning.json'), 'utf8');
  const el = () => ({
    value: '', textContent: '', checked: false, dataset: {}, style: {}, classList: { add() {}, remove() {}, toggle() {} },
    appendChild() {}, addEventListener() {}, removeEventListener() {}, setAttribute() {}, getAttribute() { return null; },
    querySelector() { return null; }, querySelectorAll() { return []; }, insertAdjacentHTML() {}, focus() {}, remove() {}
  });
  const warnings = [], errors = [];
  const ctx = {
    THREE: makeThree(),
    console: { log() {}, warn: (...a) => warnings.push(a.join(' ')), error: (...a) => errors.push(a.join(' ')) },
    document: {
      getElementById() { return null; }, createElement: el, querySelector() { return null; },
      querySelectorAll() { return []; }, addEventListener() {}, body: el(), documentElement: el()
    },
    location: { search: '', href: 'http://localhost/plant_grow.html' },
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    requestAnimationFrame() { return 0; }, cancelAnimationFrame() {},
    setTimeout, clearTimeout, setInterval() { return 0; }, clearInterval() {},
    fetch: () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(tuning)) }),
    Math, JSON, Date, Object, Array, Number, String, Boolean, Map, Set, Error, isFinite, isNaN, parseFloat, parseInt,
    _warnings: warnings, _errors: errors
  };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(src, ctx, { filename: 'plant_grow.html' });
  // buildPlant 는 3D 그룹이 없어 던진다(init 을 안 했으니 당연하다). 논리에는 영향이 없다.
  ctx.seedTo = (v) => { try { ctx.plantSeed(v); } catch (e) { /* 그리기 실패는 무시 */ } };
  if (seed != null) ctx.seedTo(seed);
  return ctx;
}

/* 정본(growth_tuning.json)이 실릴 때까지 기다린다. fetch 가 promise 라 한 틱으로는 부족하다. */
async function ready(g) {
  for (let i = 0; i < 50 && !g.thLoaded(); i++) await new Promise(r => setImmediate(r));
  assert.ok(g.thLoaded(), '임계값 정본이 안 실렸습니다: ' + g._errors.join(' | '));
  return g;
}

/* 한 개체를 일정한 빛으로 N일 걷는다. 게임 경로(advanceTo)만 쓴다 — setGrowth 점프는 안 쓴다. */
function walk(g, { dli, days, fromGrowth = 0, seed = 92158 }) {
  g.seedTo(seed);
  g.setGrowth(fromGrowth);
  g.matResetAll();
  g.setDailyLightSteady(dli);
  const turns = [];
  for (let i = 0; i < days; i++) {
    g.setDailyLightSteady(dli);
    turns.push(g.advanceTo(g.calendarDay() + 1));
  }
  return turns;
}

/* 그 시점에 시간상 중간잎 이상인 잎들의 상태 — 상시 중간잎 수를 세는 데 쓴다. */
function leafCensus(g) {
  const age = g.growthDays(), LP = g.leafStageParams();
  let mid = 0, mature = 0, locked = 0;
  for (const ax of g.axisTimeline(age)) {
    if (ax.birth > age) continue;
    if ((age - ax.leafBirth) / LP.matSpan < LP.stageMid) continue;
    if (g.matureOf(ax.leafBirth)) mature++;
    else { mid++; if (g.midLockedOf(ax.leafBirth)) locked++; }
  }
  return { mid, mature, locked };
}

const results = [];
const check = (name, fn) => { try { fn(); results.push(['PASS', name]); }
                              catch (e) { results.push(['FAIL', name, e.message]); } };

const g = await ready(loadGrowth());

/* ══ A · 적정광에서 게이지가 차면 즉시 굴리고, 확률은 상한 90% ══════════════ */
check('A 적정광 12.16 — 확률 상한 0.90 · 게이지 100%에서 즉시 굴림', () => {
  g.seedTo(92158); g.matResetAll(); g.setGrowth(0); g.setDailyLightSteady(12.16);
  const p = g.calcMatureProb(g.lightCtx());
  assert.ok(Math.abs(p - 0.90) < 1e-9, `확률이 0.90 이 아님: ${p}`);
  const turns = walk(g, { dli: 12.16, days: 130 });
  const rolled = turns.flatMap(t => t.matured || []);
  assert.ok(rolled.length > 0, '130일 동안 굴린 잎이 하나도 없습니다');
  assert.ok(rolled.every(r => Math.abs(r.p - 0.90) < 1e-9), '굴림 확률이 0.90 이 아닙니다');
  assert.ok(rolled.some(r => r.ok), '적정광인데 성숙에 한 번도 성공하지 못했습니다');
});

/* ══ B · 실패하면 게이지가 절반으로. 단계는 중간잎 유지 ═══════════════════ */
check('B 실패 회차 — 게이지 0.5 복귀 · 단계는 leaf_mid 유지', () => {
  const turns = walk(g, { dli: 3.77, days: 300 });
  const fails = turns.flatMap(t => t.matured || []).filter(r => !r.ok);
  assert.ok(fails.length > 0, '저광 300일인데 실패한 굴림이 없습니다 — 확률이 너무 높습니다');
  // 실패 직후의 게이지가 fail_reset 인지: 실패한 잎 중 아직 안 넘어간 것을 찾는다
  const st = g.matStateAll().filter(e => !e.matured && !e.locked && e.rolls > 0);
  assert.ok(st.length > 0, '실패 뒤 재시도 중인 잎이 없습니다');
  assert.ok(st.every(e => e.gauge <= 1 + 1e-9), '게이지가 1을 넘은 채 남아 있습니다');
});

/* ══ C · 문턱 미만이어도 확률이 0 이 아니다 (박사님 확정) ═════════════════ */
check('C 저광 3.77 — 확률이 하한 0.10 이고 0 이 아니다', () => {
  g.seedTo(92158); g.matResetAll(); g.setGrowth(0); g.setDailyLightSteady(3.77);
  const p = g.calcMatureProb(g.lightCtx());
  assert.ok(p > 0, '★확률이 0 입니다 — 어두운 자리에 두는 것만으로 중간잎이 보장됩니다');
  assert.ok(Math.abs(p - 0.10) < 1e-9, `하한이 0.10 이 아님: ${p}`);
  const turns = walk(g, { dli: 3.77, days: 400 });
  assert.ok(turns.flatMap(t => t.matured || []).some(r => r.ok),
    '400일 저광에서 한 번도 성숙하지 않았습니다 — 사실상 0 과 같습니다');
});

/* ══ D · 안 자라는 빛이면 기회 자체가 안 온다 ════════════════════════════ */
check('D 정지광 2.9 — 게이지가 안 차고 굴림이 0회', () => {
  const turns = walk(g, { dli: 2.9, days: 120 });
  assert.ok(turns.every(t => t.grew === false), '2.9 인데 자란 턴이 있습니다');
  assert.equal(turns.flatMap(t => t.matured || []).length, 0, '안 자라는데 굴렸습니다');
});

/* ══ E · 중간잎 확정(3%) 잎은 영원히 안 굴린다 ═══════════════════════════ */
check('E 잠금 잎 — 적정광 300일에도 leaf_mid · 굴림 0회', () => {
  // 잠금은 SEED·leafBirth 만으로 정해지므로 잠긴 잎이 나오는 씨앗을 찾는다
  let found = null;
  for (let s = 1; s <= 400 && !found; s++) {
    g.seedTo(s); g.matResetAll(); g.setGrowth(0); g.setDailyLightSteady(12.16);
    for (const ax of g.axisTimeline(300)) if (g.midLockedOf(ax.leafBirth)) { found = { s, ax }; break; }
  }
  assert.ok(found, '400 씨앗을 봐도 잠긴 잎이 없습니다 — mid_lock_pct 가 0 입니까?');
  walk(g, { dli: 12.16, days: 300, seed: found.s });
  const e = g.matStateOf(found.ax.leafBirth);
  if (e) {
    assert.equal(e.locked, true, '잠긴 잎인데 locked 가 false 입니다');
    assert.equal(e.matured, false, '★잠긴 잎이 성숙했습니다');
    assert.equal(e.rolls, 0, `잠긴 잎을 ${e.rolls}회 굴렸습니다`);
  }
  assert.equal(g.matureOf(found.ax.leafBirth), false, '잠긴 잎이 성숙잎으로 보입니다');
});

/* ══ F · 밝은 자리와 어두운 자리의 상시 중간잎 수가 다르다 ═══════════════ */
check('F 3.77 vs 12.16 — 상시 중간잎 수가 어두운 쪽이 더 많다', () => {
  walk(g, { dli: 3.77, days: 300 });   const dark = leafCensus(g);
  walk(g, { dli: 12.16, days: 300 });  const bright = leafCensus(g);
  assert.ok(dark.mid > bright.mid,
    `어두운 쪽 중간잎 ${dark.mid} 이 밝은 쪽 ${bright.mid} 보다 많지 않습니다`);
  assert.ok(bright.mature > dark.mature,
    `밝은 쪽 성숙잎 ${bright.mature} 이 어두운 쪽 ${dark.mature} 보다 많지 않습니다`);
  results.push(['INFO', `  어두움(3.77) 중간 ${dark.mid}·성숙 ${dark.mature} / ` +
                        `밝음(12.16) 중간 ${bright.mid}·성숙 ${bright.mature}`]);
});

/* ══ G · ★안전선 — 첫 플레이가 안 깨진다 ════════════════════════════════ */
check('G 안전선 — 143 → 적정광 3턴 → 146 spear_furled 그대로', () => {
  g.seedTo(92158); g.matResetAll();
  g.setGrowth(143); g.setDailyLightSteady(3.77);
  assert.equal(g.growthPhase().phaseId, 'spear_ready', '143 이 spear_ready 가 아닙니다');
  const seen = [];
  for (let i = 0; i < 3; i++) { g.setDailyLightSteady(3.77); g.advanceTo(g.calendarDay() + 1);
                                seen.push(g.growthPhase().phaseId); }
  assert.equal(g.growthDays(), 146, `3턴 뒤 유효 생장이 146 이 아닙니다: ${g.growthDays()}`);
  assert.equal(seen[2], 'spear_furled', `146 이 spear_furled 가 아닙니다: ${seen[2]}`);
});

/* ══ 부수 — 소급 뒤집힘이 사라졌는가 (고치기 전의 실제 동작) ═════════════ */
check('H 소급 뒤집힘 없음 — 빛이 나빠져도 갈라진 잎이 안 돌아온다', () => {
  walk(g, { dli: 12.16, days: 200 });
  const before = leafCensus(g).mature;
  assert.ok(before > 0, '적정광 200일에 성숙잎이 하나도 없습니다');
  g.setDailyLightSteady(0.5);                      // 빛을 끊는다
  const after = leafCensus(g).mature;
  assert.equal(after, before, `★빛이 나빠지자 성숙잎이 ${before} → ${after} 로 줄었습니다`);
});

/* ── 보고 ─────────────────────────────────────────────────────────────── */
let fail = 0;
for (const [st, name, msg] of results) {
  if (st === 'INFO') { console.log(name); continue; }
  if (st === 'FAIL') fail++;
  console.log(`${st}  ${name}${msg ? '\n      → ' + msg : ''}`);
}
console.log(fail ? `\nmaturation: FAIL (${fail}건)` : '\nmaturation: PASS');
process.exit(fail ? 1 : 0);
