/* ============================================================
   test_growth_fallback.mjs — 코드 폴백이 정본과 같은가 ([growth] 소유)
   ------------------------------------------------------------
   ★ 왜 이 파일이 있나 — 2026-08-22 에 [growth] 가 하루를 잃은 구멍이다.

   `plant_grow.html` 은 정본(`data/growth_tuning.json`)이 안 실렸을 때 **조용히 멈추지 않으려고**
   같은 값을 코드 안에 폴백으로 들고 있다. 그 자체는 옳다. 문제는 **한쪽만 바뀌어도
   아무도 안 잡는다**는 것이고, 어긋남이 **정본이 안 실린 판에서만** 드러나므로 제일 늦게 발견된다.

   실제로 이렇게 물렸다 — 옛 축과 새 축을 견주려 정본에서 `leaf_interval` 을 지웠는데
   코드 폴백 `LEAF_DAYS` 가 표를 살려 **세상이 안 바뀌었다.** 같은 것을 두 번 재 놓고
   *"두 축이 같다"* 고 쓸 뻔했다. 두 출력이 **한 글자도 안 달랐던 것**이 유일한 단서였다.
   ⇒ START-HERE §2.9 · team-map §7 에 규칙으로 박혀 있다:
     **폴백이 있는 값은 「입력을 지우는 것」으로 못 끈다.**

   ★ 세는 방법 — **정규식으로 글자를 훑지 않는다**(§2.9 ⑮ 글자로 훑으면 딴 게 잡힌다).
     `plant_grow.html` 을 vm 으로 **실제로 돌려서** 폴백값을 그 자리에서 읽는다.
     그리고 정본을 **안 실은 채로** 돌린다 — 실으면 폴백이 덮여 비교 자체가 뜻을 잃는다.

     node tools/test_growth_fallback.mjs
============================================================ */
import assert from 'node:assert';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/* THREE 대역 — tools/test_growth_speed.mjs 의 것을 그대로 쓴다(새로 짓지 않는다) */
function makeThree() {
  const V3 = function (x, y, z) { this.x = x || 0; this.y = y || 0; this.z = z || 0; };
  V3.prototype = { clone() { return new V3(this.x, this.y, this.z); }, set() { return this; },
    copy() { return this; }, add() { return this; }, addScaledVector() { return this; },
    sub() { return this; }, multiplyScalar() { return this; }, normalize() { return this; },
    length() { return 1; }, lengthSq() { return 1; }, crossVectors() { return this; },
    lerp() { return this; }, applyQuaternion() { return this; }, distanceTo() { return 1; }, dot() { return 0; } };
  const h = { get(t, k) { if (k in t) return t[k];
    const f = function () { return new Proxy({}, h); }; f.prototype = {};
    return new Proxy(f, { get: h.get, construct() { return new Proxy({}, h); }, apply() { return new Proxy({}, h); } }); } };
  return new Proxy({ Vector3: V3, Vector2: V3 }, h);
}

/* ★ 정본을 **안 실은** plant_grow — fetch 를 일부러 거절시킨다.
   그래야 코드 폴백이 그대로 남아 그 값을 읽을 수 있다(file:// 로 열었을 때와 같은 상태). */
function loadGrowthWithoutTuning() {
  const html = fs.readFileSync(path.join(ROOT, 'plant_grow.html'), 'utf8');
  const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  const main = blocks[blocks.length - 1];
  assert.ok(main && main.length > 20000, 'plant_grow.html 본문 스크립트를 못 찾았습니다');
  const src = main.replace(/\n\s*init\(\);\s*updateCam\(\);\s*$/, '\n/* init() 제거(헤드리스) */\n');
  assert.notEqual(src, main, 'init() 호출부를 못 찾았습니다 — 파일 끝이 바뀌었습니다');
  const el = () => ({ value: '', textContent: '', checked: false, dataset: {}, style: {},
    classList: { add() {}, remove() {}, toggle() {} }, appendChild() {}, addEventListener() {},
    removeEventListener() {}, setAttribute() {}, getAttribute() { return null; },
    querySelector() { return null; }, querySelectorAll() { return []; }, insertAdjacentHTML() {},
    focus() {}, remove() {} });
  const ctx = {
    THREE: makeThree(), console: { log() {}, warn() {}, error() {} },
    document: { getElementById() { return null; }, createElement: el, querySelector() { return null; },
      querySelectorAll() { return []; }, addEventListener() {}, body: el(), documentElement: el() },
    location: { search: '', href: 'http://localhost/plant_grow.html' },
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    requestAnimationFrame() { return 0; }, cancelAnimationFrame() {},
    setTimeout, clearTimeout, setInterval() { return 0; }, clearInterval() {},
    fetch: () => Promise.reject(new Error('정본 없음(일부러)')),
    Math, JSON, Date, Object, Array, Number, String, Boolean, Map, Set, Error,
    isFinite, isNaN, parseFloat, parseInt
  };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(src, ctx, { filename: 'plant_grow.html' });
  return ctx;
}

const results = [];
const check = (name, fn) => { try { fn(); results.push(['PASS', name]); }
                              catch (e) { results.push(['FAIL', name + ' — ' + e.message]); } };

const TUN = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'growth_tuning.json'), 'utf8'));
const G = loadGrowthWithoutTuning();
/* fetch 를 거절했으니 정본은 안 실렸어야 한다 — 그 거절이 끝나기를 기다린다 */
for (let i = 0; i < 200; i++) await new Promise(r => setImmediate(r));

check('A 정본을 안 실은 상태가 맞다 — 그래야 폴백을 읽는 뜻이 있다', () => {
  assert.equal(G.thLoaded(), false,
    'thLoaded() 가 true 입니다 — 정본이 실렸으면 폴백이 덮여 이 검사가 아무것도 안 잡습니다');
});

check('B ★잎 간격표 폴백이 정본과 같다 (leaf_interval.days)', () => {
  assert.equal(typeof G.leafDaysFallback, 'function',
    'plant_grow 에 leafDaysFallback() 이 없습니다 — 폴백을 물을 창구가 없습니다');
  const code = Array.from(G.leafDaysFallback());
  const canon = TUN.leaf_interval && TUN.leaf_interval.days;
  assert.ok(Array.isArray(canon) && canon.length, 'growth_tuning.json 에 leaf_interval.days 가 없습니다');
  assert.deepEqual(code, canon,
    `코드 폴백 LEAF_DAYS 가 정본과 다릅니다 — 코드 ${code.join('·')} / 정본 ${canon.join('·')}\n` +
    `  ⚠ 이 어긋남은 정본이 안 실린 판(file:// 등)에서만 드러납니다. 제일 늦게 발견되는 종류입니다.`);
  results.push(['INFO', `  잎 간격 폴백 ${code.join('·')} = 정본 ${canon.join('·')}`]);
});

check('C ★임계값 폴백이 정본과 같다 (thresholds)', () => {
  assert.equal(typeof G.thresholdsFallback, 'function',
    'plant_grow 에 thresholdsFallback() 이 없습니다');
  const code = G.thresholdsFallback();
  const canon = TUN.thresholds;
  const keys = ['die', 'survive', 'min', 'fenestrate', 'best_lo', 'best_hi', 'max'];
  const bad = keys.filter(k => Number(code[k]) !== Number(canon[k]));
  assert.equal(bad.length, 0,
    '코드 폴백 TH_MONSTERA 가 정본과 다릅니다 — 어긋난 키: ' +
    bad.map(k => `${k} 코드 ${code[k]} / 정본 ${canon[k]}`).join(' · '));
  results.push(['INFO', `  임계값 폴백 ${keys.map(k => k + ' ' + code[k]).join(' · ')}`]);
});

check('D ★무늬 광량 계수 폴백이 정본과 같다 (variegated.need_mult)', () => {
  assert.equal(typeof G.varieMultFallback, 'function', 'plant_grow 에 varieMultFallback() 이 없습니다');
  const code = G.varieMultFallback();
  const canon = TUN.variegated && TUN.variegated.need_mult;
  assert.ok(Number.isFinite(canon), 'growth_tuning.json 에 variegated.need_mult 가 없습니다');
  assert.equal(code, canon, `코드 폴백 VARIE_MULT ${code} 가 정본 ${canon} 과 다릅니다`);
  results.push(['INFO', `  무늬 계수 폴백 ${code} = 정본 ${canon}`]);
});

/* ★ 집·코어가 보는 표와도 같아야 한다 — 같은 숫자가 두 파일에 있고 동기화 주인이 없다 */
check('E ★light_thresholds.json 과도 같다 (집·코어가 보는 표)', () => {
  const p = path.join(ROOT, 'data', 'balance', 'light_thresholds.json');
  if (!fs.existsSync(p)) { results.push(['INFO', '  light_thresholds.json 없음 — 넘어감']); return; }
  const lt = JSON.parse(fs.readFileSync(p, 'utf8'));
  const m = lt.plants && lt.plants.monstera_deliciosa;
  assert.ok(m, 'light_thresholds.json 에 plants.monstera_deliciosa 가 없습니다');
  const keys = ['die', 'survive', 'min', 'fenestrate', 'best_lo', 'best_hi', 'max'];
  const bad = keys.filter(k => Number(TUN.thresholds[k]) !== Number(m[k]));
  assert.equal(bad.length, 0,
    'growth_tuning.thresholds 와 light_thresholds 가 다릅니다 — ' +
    bad.map(k => `${k} growth ${TUN.thresholds[k]} / light ${m[k]}`).join(' · ') +
    '\n  ⚠ 어긋나면 「집이 말하는 밝기」와 「식물이 판정하는 밝기」가 갈립니다.');
  const nm = lt.variegated && lt.variegated.need_mult;
  assert.equal(Number(nm), Number(TUN.variegated.need_mult),
    `variegated.need_mult 가 다릅니다 — light ${nm} / growth ${TUN.variegated.need_mult}`);
  results.push(['INFO', `  두 표가 일곱 값 + 무늬 계수까지 일치 (min ${m.min})`]);
});

let fail = 0;
for (const [tag, name] of results) {
  if (tag === 'INFO') { console.log(name); continue; }
  if (tag === 'FAIL') fail++;
  console.log(`${tag}  ${name}`);
}
console.log(`\ngrowth_fallback: ${fail ? 'FAIL ' + fail + '건' : 'PASS'}`);
process.exitCode = fail ? 1 : 0;
