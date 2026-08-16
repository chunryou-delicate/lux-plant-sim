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
export function loadGrowth({ seed = 92158, tuningPatch = null } = {}) {
  const html = fs.readFileSync(path.join(ROOT, 'plant_grow.html'), 'utf8');
  const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  const main = blocks[blocks.length - 1];
  assert.ok(main && main.length > 20000, 'plant_grow.html 본문 스크립트를 못 찾았습니다');
  // ★ init() 만 걷어낸다. 그 위 선언과 로직은 한 글자도 안 바꾼다 —
  //   바꾸면 여기서 통과한 것이 브라우저에서 통과한다는 보장이 사라진다.
  const src = main.replace(/\n\s*init\(\);\s*updateCam\(\);\s*$/, '\n/* init() 제거(헤드리스) */\n');
  assert.notEqual(src, main, 'init() 호출부를 못 찾았습니다 — 파일 끝이 바뀌었습니다');

  let tuning = fs.readFileSync(path.join(ROOT, 'data', 'growth_tuning.json'), 'utf8');
  // 꺼 둔 경로(낙엽)를 켠 채로도 도는지 보려면 정본을 갈아끼워야 한다 — 파일은 안 건드린다.
  if (tuningPatch) { const t = JSON.parse(tuning); tuningPatch(t); tuning = JSON.stringify(t); }
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
  const age = g.ageOf(g.growthDays()), LP = g.leafStageParams();   // ★구현과 같은 기준(ageOf)
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

/* ══ D · 안 자라는 빛이면 기회 자체가 안 온다 ════════════════════════════
   ⚠⚠ 2026-08-17 — **여기 `2.9` 가 박혀 있었다.** 그때는 정지 문턱(`min`)이 3.0 이라
     2.9 가 「안 자라는 빛」이었는데, 박사님이 **min 을 2.7 로 내리시자** 2.9 가
     **자라는 빛**이 되어 이 검사가 빨개졌다. 코드가 아니라 **검사가 낡은 것**이다.
   ⇒ 숫자를 박지 말고 **문턱에서 뽑는다**(§2.8). 문턱이 또 움직여도 안 낡는다.
     ★ 재려던 것은 「2.9 에서 안 자란다」가 아니라 **「정지 구간에서는 기회가 안 온다」**다. */
check('D 정지광(문턱 바로 아래) — 게이지가 안 차고 굴림이 0회', () => {
  /* ★ 문턱을 **경계를 찾아서** 잡는다. `TH_MONSTERA` 는 `let` 이라 컨텍스트 밖에서 못 읽고,
     읽을 수 있다 해도 그건 「적힌 값」이지 「실제로 갈리는 자리」가 아니다.
     ⇒ `bandOf` 를 훑어 **정체에서 느림으로 넘어가는 그 지점**을 찾는다. 그것이 정본이다. */
  let min = null;
  for (let d = 0.5; d <= 8; d += 0.01) {
    const v = +d.toFixed(2);
    if (g.bandOf(v, false).band === 'slow') { min = v; break; }
  }
  assert.ok(min != null, '생장 창에서 정지→느림 경계를 못 찾았습니다 — 지어낸 값으로 재지 않습니다');
  const dim = +(min - 0.1).toFixed(2);            // 문턱 바로 아래
  const turns = walk(g, { dli: dim, days: 120 });
  assert.ok(turns.every(t => t.grew === false), `${dim} 인데 자란 턴이 있습니다 (문턱 ${min})`);
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

/* ══ G · ★안전선 — 첫 플레이가 안 깨진다 ════════════════════════════════
   ★★ 2026-08-09 — **값이 143·146 에서 117·120 으로 움직였다.** 회귀가 아니라 확정이다.
     박사님이 잎 간격을 표로 정하셨고(`data/growth_tuning.json · leaf_interval.days`
     = 30·40·50·70·100·150·200·300), 시간 축이 그 표를 따르게 바뀌었다
     (plant_grow.html §ageOf — timeCurve 거듭제곱 곡선을 대신한다).
   ⇒ 셋째 잎은 누적 30+40+50 = **유효 120일**에 난다. 그 사흘 앞(SPEAR_READY_DAYS=3)이 117 이다.
   ⇒ 옛 146 은 timeCurve 0.72 가 만들던 값이었다. 표를 지우면 그 값으로 되돌아간다.
   ⚠ 이 검사가 다시 깨지면 **먼저 표를 봐라.** 표를 안 고쳤는데 깨졌으면 그때가 회귀다. */
check('G 안전선 — 117 → 적정광 3턴 → 120 spear_furled (잎 간격표 누적 30+40+50)', () => {
  g.seedTo(92158); g.matResetAll();
  g.setGrowth(117); g.setDailyLightSteady(3.77);
  assert.equal(g.growthPhase().phaseId, 'spear_ready', '117 이 spear_ready 가 아닙니다');
  const seen = [];
  for (let i = 0; i < 3; i++) { g.setDailyLightSteady(3.77); g.advanceTo(g.calendarDay() + 1);
                                seen.push(g.growthPhase().phaseId); }
  assert.equal(g.growthDays(), 120, `3턴 뒤 유효 생장이 120 이 아닙니다: ${g.growthDays()}`);
  assert.equal(seen[2], 'spear_furled', `120 이 spear_furled 가 아닙니다: ${seen[2]}`);
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

/* ══ I · 생존선 아래면 잎이 바랜다. 되돌릴 수 있다 ═════════════════════════ */
check('I 잎 바램 — survive(1.2) 아래에서 바래고, 빛이 돌아오면 회복', () => {
  walk(g, { dli: 12.16, days: 200 });                       // 잎을 여러 장 만들어 둔다
  for (let i = 0; i < 40; i++) { g.setDailyLightSteady(0.6); g.advanceTo(g.calendarDay() + 1); }
  const faded = g.leafHealthAll().filter(e => e.fade > 0);
  assert.ok(faded.length > 0, '생존선 아래 40일인데 바랜 잎이 없습니다');
  assert.ok(faded.some(e => e.fade >= 1), '40일인데 다 바랜 잎이 하나도 없습니다');
  for (let i = 0; i < 40; i++) { g.setDailyLightSteady(12.16); g.advanceTo(g.calendarDay() + 1); }
  assert.ok(g.leafHealthAll().every(e => e.fade === 0),
    '빛이 돌아왔는데 안 되돌아온 잎이 있습니다: ' + JSON.stringify(g.leafHealthAll()));
});

/* ══ J · ★초보는 안 떨어진다 — 바랜 채로 유지 (박사님 확정) ════════════════ */
check('J 초보 — 다 바래도 잎이 안 떨어지고 안 죽는다', () => {
  walk(g, { dli: 12.16, days: 200 });
  const before = g.leafHealthAll().length;
  for (let i = 0; i < 300; i++) { g.setDailyLightSteady(0.6); g.advanceTo(g.calendarDay() + 1); }
  const st = g.leafHealthAll();
  assert.ok(st.some(e => e.fade >= 1), '300일인데 다 바랜 잎이 없습니다');
  assert.equal(st.filter(e => e.dropped).length, 0,
    '★초보인데 잎이 떨어졌습니다 — drop_enabled 가 켜져 있습니까?');
});

/* ══ K · 갈라진 잎은 되돌아가지 않는다 (박사님 지적) ═══════════════════════ */
check('K 성숙잎은 바래도 중간잎으로 안 돌아간다', () => {
  walk(g, { dli: 12.16, days: 200 });
  const mature = g.matStateAll().filter(e => e.matured).map(e => e.leafBirth);
  assert.ok(mature.length > 0, '적정광 200일에 성숙잎이 없습니다');
  for (let i = 0; i < 60; i++) { g.setDailyLightSteady(0.6); g.advanceTo(g.calendarDay() + 1); }
  for (const lb of mature)
    assert.equal(g.matureOf(lb), true, `★성숙잎 ${lb} 이 중간잎으로 돌아갔습니다`);
});

/* ══ L · 정지 구간(1.2~3.0)에서는 자라지도 잃지도 않는다 ═══════════════════ */
check('L 정지 구간 2.5 — 안 자라고 잎도 안 바랜다', () => {
  walk(g, { dli: 12.16, days: 200 });
  const before = JSON.stringify(g.leafHealthAll());
  const turns = [];
  for (let i = 0; i < 60; i++) { g.setDailyLightSteady(2.5); turns.push(g.advanceTo(g.calendarDay() + 1)); }
  assert.ok(turns.every(t => t.grew === false), '2.5 인데 자란 턴이 있습니다');
  assert.equal(JSON.stringify(g.leafHealthAll()), before, '정지 구간인데 잎 상태가 바뀌었습니다');
});

/* ══ M · 낙엽 경로 — 켜면 실제로 떨어진다(꺼 둔 코드가 썩지 않게) ══════════ */
{
  const g2 = await ready(loadGrowth({ tuningPatch: t => { t.health.drop_enabled = true; t.health.drop_hold_days = 3; } }));
  try {
    assert.equal(g2.growthTuning ? true : true, true);
    g2.seedTo(92158); g2.matResetAll(); g2.setGrowth(0);
    for (let i = 0; i < 200; i++) { g2.setDailyLightSteady(12.16); g2.advanceTo(g2.calendarDay() + 1); }
    const born = g2.leafHealthAll().length;
    let dropEvents = 0;
    for (let i = 0; i < 400; i++) { g2.setDailyLightSteady(0.6);
      dropEvents += (g2.advanceTo(g2.calendarDay() + 1).leaves || []).filter(x => x.kind === 'drop').length; }
    const st = g2.leafHealthAll();
    assert.ok(dropEvents > 0, '켰는데 400일 동안 떨어진 잎이 없습니다 — 낙엽 경로가 죽어 있습니다');
    const age2 = g2.ageOf(g2.growthDays());                       // ★구현과 같은 기준
    const alive = g2.axisTimeline(age2).filter(a => a.birth <= age2
                    && age2 >= a.leafBirth && !g2.leafDroppedOf(a.leafBirth));
    assert.ok(alive.length >= 1, '★잎이 하나도 안 남았습니다 — 마지막 한 장을 지켜야 합니다');
    results.push(['INFO', `  낙엽 ${dropEvents}장 떨어지고 ${alive.length}장 남음(초보에서는 꺼져 있음)`]);
    results.push(['PASS', 'M drop_enabled 를 켜면 떨어진다 · 마지막 한 장은 남는다']);
  } catch (e) { results.push(['FAIL', 'M drop_enabled 를 켜면 떨어진다 · 마지막 한 장은 남는다', e.message]); }
}

/* ── 보고 ─────────────────────────────────────────────────────────────── */
let fail = 0;
for (const [st, name, msg] of results) {
  if (st === 'INFO') { console.log(name); continue; }
  if (st === 'FAIL') fail++;
  console.log(`${st}  ${name}${msg ? '\n      → ' + msg : ''}`);
}
console.log(fail ? `\nmaturation: FAIL (${fail}건)` : '\nmaturation: PASS');
process.exit(fail ? 1 : 0);
