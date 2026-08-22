/* ============================================================
   test_growth_speed.mjs — 밝기가 생장 「속도」도 정한다 (core 소유)
   ------------------------------------------------------------
   증명하려는 것은 둘이고, 둘째가 더 중요하다.

     ① 밝으면 실제로 빨라진다        — 밴드별 계수가 진짜로 걸리는가
     ★② **곡선은 한 글자도 안 바뀌었다** — 같은 밝기면 옛 코드와 **완전히 같은 결과**인가

   ②가 이 파일의 존재 이유다. `plant_grow.html` 의 `GROWTH +1` · 143 · 146 · `spawnStep` ·
   `matSpan` · `timeCurve` 는 다른 창의 정본이고 첫 플레이 재현이 거기 걸려 있다.
   코어가 바꾼 것은 **그 곡선 위를 걷는 속도**뿐이라는 것을, 곡선을 직접 굴려서 못 박는다.

     A  정본이 실렸는가 — 숫자가 코드가 아니라 data/growth_tuning.json 에 있다
     B  표가 규약을 지키는가 — 1 미만 계수는 못 쓴다(세이브 재생이 못 따라온다)
     C  ★밴드 판정이 growth 와 같은가 — judgeDLI(코어) vs bandOf(plant_grow) 를 0~20 DLI 전수 대조
     D  ★회귀 — slow 밴드(계수 1.0)에서 루프가 **엔진 직접 굴림과 한 걸음도 안 다르다**
     E  ★곡선 불변 — 143 → 3걸음 → 146 spear_furled (test_maturation G 와 같은 안전선)
     F  best 밴드에서 실제로 빨라진다 — 계수만큼, 그 이상도 이하도 아니다
     G  ★빛 한 칸 = 하루 한 걸음 — dliHist 와 advanceTo 가 1:1 이다(세이브 재생의 전제)
     H  ★세이브 왕복 — 밝은 자리에서 저장·복원해도 유효 생장일이 같다
     I  엔진이 막는 날은 코어가 가로채지 않는다 — 어두운 자리에서도 하루가 그대로 간다

     node tools/test_growth_speed.mjs
============================================================ */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProfileLight } from '../src/game/room_profile.js';
import { newState, pot0, ARRIVAL } from '../src/game/state.js';
import { nextDay, growthSpeedOf, GROWTH_STEPS_MAX } from '../src/game/loop.js';
import { restoreGrowth } from '../src/game/save.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const J = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url), 'utf8'));
const results = [];
const check = (n, f) => { try { f(); results.push(['PASS', n]); } catch (e) { results.push(['FAIL', n, e.message]); } };
const info = m => results.push(['INFO', '  ' + m]);

const TUNING = J('../data/growth_tuning.json');
const SPEED = TUNING.growth_speed && TUNING.growth_speed.by_band;
const TH = J('../data/balance/light_thresholds.json');
const light = createProfileLight(J('../data/profiles/room_profile.banjiha.json'),
                                { lightTh: TH, weatherBalance: J('../data/balance/weather.json') });
const SILL = 'banjiha-sill:0';
const th = light.thresholdsOf('monstera_deliciosa', false);

/* ══ 헤드리스 생장 엔진 — test_balance_routes.mjs 와 같은 하네스 ══════════ */
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

/* growth 계약 — 부른 것을 다 적는다(G 검사가 그 목록을 본다) */
function stand(seed = 1) {
  try { G.plantSeed(seed); } catch { /* 3D 무대 없음 */ }
  G.matResetAll(); G.resetDailyLight(); G.setGrowth(ARRIVAL.growthDays);
  const calls = [];
  return {
    calls,
    assertContract: () => true,
    setDailyLight(d) { calls.push(['setDailyLight', d]); return G.setDailyLight(d); },
    advanceTo(d) { calls.push(['advanceTo', d]); const r = G.advanceTo(d); return { ...r, drawn: true, drawError: null }; },
    setGrowth(d) { calls.push(['setGrowth', d]); const r = G.setGrowth(d); return { ...r, drawn: true, drawError: null }; },
    calendarDay: () => G.calendarDay(), growthDays: () => G.growthDays(),
    growthBlocked: () => G.growthBlocked(), growthPhase: () => G.growthPhase(),
    dli7: () => G.dli7(), dliCV: () => G.dliCV(), ageOf: d => G.ageOf(d)
  };
}
/* 창턱 자리의 DLI 를 원하는 값으로 못 박은 조도 계약. 나머지는 전부 진짜다 —
   밴드만 골라 보려는 것이지 조도 엔진을 흉내 내려는 것이 아니다. */
function lightAt(dli) {
  return {
    daily(day, S) {
      const r = light.daily(day, S);
      for (const s of r.report.slots) if (s.slotId === SILL) s.dli = dli;
      return r;
    },
    skyFor: (...a) => light.skyFor(...a),
    dliOfSlot: (...a) => light.dliOfSlot(...a),
    clearCache: () => light.clearCache(),
    thresholdsOf: (...a) => light.thresholdsOf(...a),
    get room() { return light.room; },
    growLampCount: () => light.growLampCount(),
    rooms: () => light.rooms(), profile: () => light.profile()
  };
}
function game(dli, seed = 1) {
  const io = { light: lightAt(dli), growth: stand(seed) };
  const S = newState({ room: 'banjiha', mode: 'novice' });
  S.pots.push({ id: 'pot_01', slotId: SILL, plantId: 'monstera_deliciosa', variegated: false,
                daysPlanted: 0, arrivalGrowthDays: ARRIVAL.growthDays, arrivedOnDay: 0,
                at: null });
  return { S, io };
}
/* 루프를 n일 돌린다 */
function run(dli, n, seed = 1) {
  const { S, io } = game(dli, seed);
  const turns = [];
  for (let i = 0; i < n; i++) turns.push(nextDay(S, io).turn);
  return { S, io, turns };
}

/* 밴드별 대표값 — thresholds 에서 뽑는다. 여기서 새 숫자를 만들지 않는다. */
const SAMPLE = {
  critical: th.die / 2, poor: (th.die + th.survive) / 2, stagnant: (th.survive + th.min) / 2,
  slow: (th.min + th.best_lo) / 2, best: (th.best_lo + th.best_hi) / 2,
  good: (th.best_hi + th.max) / 2, over: th.max + 2
};

/* ══ A · 정본이 실렸는가 ══════════════════════════════════════════════════ */
check('A 계수 정본이 data/growth_tuning.json 에서 실린다 (코드에 숫자를 안 박았다)', () => {
  assert.ok(SPEED, 'growth_tuning.json 에 growth_speed.by_band 가 없습니다');
  const r = growthSpeedOf(SAMPLE.best, th);
  assert.equal(r.source, 'tuning',
    `밝은 밴드의 계수를 정본에서 못 읽었습니다 — source=${r.source}. ` +
    `이 값이 'default' 면 게임은 예전 밸런스로 돌고 아무도 모릅니다`);
  assert.equal(r.mult, Math.min(SPEED.best, GROWTH_STEPS_MAX),
    `정본은 ${SPEED.best} 인데 코어가 ${r.mult} 를 씁니다`);
  info(`계수표 — ${Object.entries(SPEED).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
});

/* ══ B · 표가 규약을 지키는가 ═════════════════════════════════════════════ */
check('B 1 미만 계수는 못 쓴다 — 세이브 재생이 못 따라오기 때문이다', () => {
  for (const [band, v] of Object.entries(SPEED)) {
    assert.ok(v === 0 || (v >= 1 && v <= GROWTH_STEPS_MAX),
      `${band} 계수가 ${v} 입니다 — 0(엔진이 막는 밴드) 이거나 1~${GROWTH_STEPS_MAX} 여야 합니다. ` +
      `1 미만은 코어가 하루를 삼키는 것이고, save.restoreGrowth 는 그 삼킨 하루를 모릅니다`);
  }
  /* 정본이 규약을 어겨도 코어는 조용히 안 따른다 — 그 사실이 source 에 실린다 */
  const bad = growthSpeedOf(SAMPLE.slow, th);
  assert.ok(['tuning', 'default', 'unsupported'].includes(bad.source), `모르는 source: ${bad.source}`);
});

/* ══ C · ★밴드 판정이 growth 와 같은가 ═══════════════════════════════════ */
check('C ★밴드 판정이 plant_grow.bandOf 와 한 칸도 안 다르다 (0~20 DLI 전수)', () => {
  let n = 0;
  for (let d = 0; d <= 20.0001; d += 0.05) {
    const dli = +d.toFixed(2);
    const mine = growthSpeedOf(dli, th).band;
    const theirs = G.bandOf(dli, false).band;
    assert.equal(mine, theirs,
      `DLI ${dli} — 코어는 '${mine}', growth 는 '${theirs}' 로 봅니다. ` +
      `밴드가 갈리면 "밝은데 왜 안 빨라지지"가 오류 없이 일어납니다`);
    n++;
  }
  info(`밴드 대조 ${n}점 일치 (die ${th.die} · survive ${th.survive} · min ${th.min} · ` +
       `best ${th.best_lo}~${th.best_hi} · max ${th.max})`);
});

/* ══ D · ★회귀 — 계수 1.0 이면 옛 코드와 완전히 같다 ════════════════════ */
check('D ★slow 밴드(계수 1.0) — 루프가 엔진 직접 굴림과 한 걸음도 안 다르다', () => {
  const DAYS = 40, dli = SAMPLE.slow;
  assert.equal(growthSpeedOf(dli, th).mult, 1,
    `이 검사는 계수 1.0 을 전제로 합니다 — 지금 slow 계수가 ${growthSpeedOf(dli, th).mult} 입니다`);

  /* ① 루프로 산 40일 */
  const r = run(dli, DAYS);
  /* ② "옛 코드" = 엔진을 하루씩 직접 굴린 40일. 계수 개념이 없던 그 경로 그대로다. */
  const g = stand(1);
  const direct = [];
  for (let i = 0; i < DAYS; i++) { g.setDailyLight(dli); direct.push(g.advanceTo(g.calendarDay() + 1).growth); }

  assert.deepEqual(r.turns.map(t => t.effectiveGrowthDays), direct,
    '★유효 생장일 열이 다릅니다 — 계수 1.0 인데 루프가 곡선 위를 다르게 걸었습니다');
  assert.deepEqual([...new Set(r.turns.map(t => t.growthSteps))], [1], '하루에 한 걸음이 아닙니다');
  assert.equal(r.S.dliHist.length, DAYS, `빛 이력이 ${r.S.dliHist.length}칸 — 하루 한 칸이어야 합니다`);
  info(`회귀 — slow ${dli} DLI · ${DAYS}일 · 유효 생장 ${direct[0] - 1} → ${direct.at(-1)} (루프 = 엔진 직접)`);
});

/* ══ E · ★곡선 불변 — 첫 플레이 안전선 ═══════════════════════════════════ */
/* ★★ 2026-08-23 — **숫자를 지웠다.** 이 검사는 「117 → 120」을 손으로 박고 있었고,
   2026-08-09 에 143·146 에서 그 값으로 **사람이 손으로 옮겨 적어야** 했다. 그게 낡는 자리다.
   ⇒ 이제 못박는 것은 **숫자가 아니라 규칙**이다:
       「셋째 잎이 나는 날은 표의 누적이고, 그 SPEAR_READY_DAYS 걸음 앞부터 spear_ready 다」
     표(`data/growth_tuning.json · leaf_interval.days`)를 고치면 이 검사가 **저절로 따라간다.**
     표를 안 고쳤는데 깨지면 그때가 진짜 회귀다 — 기계가 깨진 것이다.
   ★ 모범은 바로 아래 E2 다. 거기도 표에서 유도한다.
   ⚠ 기준선을 조용히 옮긴 것이 아니다 — 바꾸기 전 값(117·120)과 유도한 값이 같은 것을
     먼저 찍어서 확인했다(2026-08-23 [growth]). 아래 info 가 그 값을 매번 찍는다. */
check('E ★곡선 안전선 — 표에서 유도한 「새순 3걸음 전」 → 새순 (test_maturation G 와 같은 안전선)', () => {
  const days = (TUNING.leaf_interval && TUNING.leaf_interval.days) || null;
  assert.ok(Array.isArray(days) && days.length >= 3,
    'growth_tuning.json 의 leaf_interval.days 가 없습니다 — 안전선을 유도할 정본이 없습니다');
  /* ★ 숫자를 여기 베껴 적지 않는다 — plant_grow 가 내주는 창구에서 받는다(§2.9 ⑪ 자는 재라, 짓지 마라) */
  assert.equal(typeof G.spearReadyDays, 'function',
    'plant_grow 에 spearReadyDays() 가 없습니다 — 안전선 길이를 물을 창구가 없습니다');
  const lead = G.spearReadyDays();
  assert.ok(Number.isFinite(lead) && lead >= 1, `spearReadyDays() 가 이상합니다: ${lead}`);
  const spearDay = days[0] + days[1] + days[2];      // 셋째 잎이 나는 유효 생장일 (누적)
  const readyDay = spearDay - lead;                  // 그 앞 lead 걸음이 준비 구간
  try { G.plantSeed(92158); } catch { /* 3D 무대 없음 — 씨앗은 세워진다 */ }
  G.matResetAll();
  G.setGrowth(readyDay); G.setDailyLightSteady(SAMPLE.slow);
  assert.equal(G.growthPhase().phaseId, 'spear_ready', `${readyDay} 이 spear_ready 가 아닙니다`);
  const seen = [];
  for (let i = 0; i < lead; i++) { G.setDailyLightSteady(SAMPLE.slow); G.advanceTo(G.calendarDay() + 1);
                                   seen.push(G.growthPhase().phaseId); }
  assert.equal(G.growthDays(), spearDay, `${lead}걸음 뒤 유효 생장이 ${spearDay} 가 아닙니다: ${G.growthDays()}`);
  assert.equal(seen[lead - 1], 'spear_furled', `${spearDay} 이 spear_furled 가 아닙니다: ${seen[lead - 1]}`);
  /* 마지막 걸음 전까지는 계속 준비 중이어야 한다 — 중간에 딴 단계가 끼면 기계가 깨진 것이다 */
  for (let i = 0; i < lead - 1; i++)
    assert.equal(seen[i], 'spear_ready', `${readyDay + i + 1} 이 spear_ready 가 아닙니다: ${seen[i]}`);
  info(`안전선 ${readyDay} → ${lead}걸음 → ${spearDay} spear_furled (표 누적 ${days[0]}+${days[1]}+${days[2]})`);
});

/* ══ E2 · ★잎 간격표가 실제로 그 날에 잎을 낸다 (2026-08-09 신설) ═════════
   E 는 셋째 잎 하나만 못 박는다. 표 전체가 지켜지는지는 여기서 본다 —
   표를 고치면 이 검사가 그 자리에서 갈라진다. */
check('E2 ★잎 간격표대로 잎이 난다 — 누적 30·70·120·190·290·440·640·940', () => {
  const days = (TUNING.leaf_interval && TUNING.leaf_interval.days) || null;
  assert.ok(Array.isArray(days) && days.length,
    'growth_tuning.json 에 leaf_interval.days 가 없습니다 — 잎 간격표가 정본입니다');
  const want = [];
  let acc = 0;
  for (const d of days) { acc += d; want.push(acc); }
  /* ★ 본줄기(생장점) 차례로 센다 — `axisTimeline` 이 그 정본이다.
     ⚠ `topologyNow` 로 세지 않는다: 쌍혹(doubleBud 0.15)이 한 번에 가지 둘을 내므로
       시드에 따라 같은 날 잎이 두 장 나기도 한다. 그건 **덤**이지 표가 어긋난 것이 아니다. */
  /* ⚠ Array.from 으로 이 쪽 실행 영역의 배열로 옮긴다 — vm 안에서 만든 배열은
     프로토타입이 달라 deepEqual 이 값이 같아도 실패한다(한 번 여기서 헤맸다). */
  const got = Array.from(G.axisTimeline(20000)).map(a => Math.round(G.dayOfAge(a.leafBirth) * 1000) / 1000);
  assert.deepEqual(got.slice(0, want.length), want,
    `잎이 나는 날이 표와 다릅니다 — 표 ${want.join('·')} / 실측 ${got.slice(0, want.length).join('·')}`);
  info(`잎 간격 ${days.join('·')} → 누적 ${want.join('·')} (유효 생장일)`);
});

/* ══ F · 밝으면 실제로 빨라진다 ═══════════════════════════════════════════ */
check('F ★best 밴드 — 계수만큼 빨라진다. 그 이상도 이하도 아니다', () => {
  const DAYS = 40, mult = growthSpeedOf(SAMPLE.best, th).mult;
  const slow = run(SAMPLE.slow, DAYS);
  const fast = run(SAMPLE.best, DAYS);
  const dSlow = slow.turns.at(-1).effectiveGrowthDays - ARRIVAL.growthDays;
  const dFast = fast.turns.at(-1).effectiveGrowthDays - ARRIVAL.growthDays;
  assert.equal(dSlow, DAYS, `기준선이 ${dSlow}일 — 40일이어야 합니다`);
  assert.equal(dFast, Math.floor(DAYS * mult),
    `밝은 쪽이 ${dFast}일 자랐습니다 — 계수 ${mult} 면 ${Math.floor(DAYS * mult)}일이어야 합니다`);
  assert.ok(dFast > dSlow, '★밝은데 안 빨라졌습니다 — 이 파일이 존재하는 이유가 사라집니다');
  info(`속도 — slow ${SAMPLE.slow} DLI 는 40일에 ${dSlow}일 · best ${SAMPLE.best} DLI 는 ${dFast}일 (×${mult})`);
});

/* ══ G · ★빛 한 칸 = 하루 한 걸음 ════════════════════════════════════════ */
check('G ★빛 한 칸 = 하루 한 걸음 — dliHist 와 advanceTo 가 1:1 이다', () => {
  const DAYS = 20;
  const r = run(SAMPLE.best, DAYS);
  const fed = r.io.growth.calls.filter(c => c[0] === 'setDailyLight').length;
  const stepped = r.io.growth.calls.filter(c => c[0] === 'advanceTo').length;
  assert.equal(fed, stepped,
    `빛을 ${fed}번 넘기고 ${stepped}번 걸었습니다 — 짝이 안 맞으면 세이브 재생이 다른 형태를 세웁니다`);
  assert.equal(r.S.dliHist.length, fed,
    `이력이 ${r.S.dliHist.length}칸인데 빛은 ${fed}번 넘겼습니다 — save.js §growth 의 1:1 계약이 깨졌습니다`);
  assert.equal(r.turns.reduce((a, t) => a + t.growthSteps, 0), fed, 'turn.growthSteps 합이 실제와 다릅니다');
  info(`밝은 자리 ${DAYS}일 — 빛 ${fed}칸 · 걸음 ${stepped}번 (하루보다 많은 것이 정상이다)`);
});

/* ══ H · ★세이브 왕복 ════════════════════════════════════════════════════ */
check('H ★밝은 자리에서 저장·복원해도 유효 생장일이 같다 (재생이 속도까지 재현한다)', () => {
  const DAYS = 20;
  const r = run(SAMPLE.best, DAYS);
  const want = r.io.growth.growthDays();

  /* 새 growth 창에 이력만 다시 건다 — save.restoreGrowth 가 하는 그대로다 */
  const g2 = stand(1);
  const out = restoreGrowth(r.S, g2);
  assert.equal(out.growthDays, want,
    `★복원한 유효 생장일이 ${out.growthDays} — 저장 전 ${want} 와 다릅니다. ` +
    `재생은 dliHist 한 칸당 하루씩 되밟으므로, 코어가 넘긴 칸 수가 곧 답이어야 합니다`);
  info(`세이브 왕복 — 이력 ${out.replayedDays}칸 → 유효 ${out.growthDays}일 (저장 전과 같다)`);
});

/* ══ I · 엔진이 막는 날은 가로채지 않는다 ═════════════════════════════════ */
check('I 어두운 자리 — 하루는 그대로 간다(잎 건강이 돌아야 하므로 걸음을 거르지 않는다)', () => {
  const DAYS = 15;
  for (const band of ['stagnant', 'poor', 'critical']) {
    const r = run(SAMPLE[band], DAYS);
    const stepped = r.io.growth.calls.filter(c => c[0] === 'advanceTo').length;
    assert.equal(stepped, DAYS,
      `${band} 밴드에서 ${DAYS}일 중 ${stepped}일만 걸었습니다 — 안 자라는 것과 하루를 안 주는 것은 다릅니다`);
    assert.equal(r.turns.at(-1).effectiveGrowthDays, ARRIVAL.growthDays,
      `${band} 밴드인데 형태가 자랐습니다`);
    assert.ok(r.turns.at(-1).growthBlocked, `${band} 밴드인데 정지 사유가 비었습니다`);
  }
  info('정지는 엔진(growthBlockReason)이 판정한다 — 코어는 밴드 이름으로 죽이지 않는다');
});

/* ── 출력 ─────────────────────────────────────────────────────────────── */
let fails = 0;
for (const r of results) {
  if (r[0] === 'INFO') { console.log(r[1]); continue; }
  if (r[0] === 'FAIL') fails++;
  console.log(`${r[0]}  ${r[1]}${r[2] ? '\n      → ' + r[2] : ''}`);
}
console.log(`\ngrowth_speed: ${fails ? `FAIL (${fails}건)` : 'PASS'}`);
process.exit(fails ? 1 : 0);
