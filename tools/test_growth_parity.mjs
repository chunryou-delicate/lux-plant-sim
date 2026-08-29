/* ============================================================
   test_growth_parity.mjs — 헤드리스 plant_grow 와 «브라우저» plant_grow 가
   같은 수를 내나 ([growth] 소유)
   ------------------------------------------------------------
   ★ 왜 이 검사가 있나 (2026-08-29)

   내 표는 «거의 다» 헤드리스로 냈다. 그 헤드리스는 THREE 를 **스텁**으로 바꿔
   돌린다([core] 가 만든 것이다). ⇒ 스텁이 진짜 THREE 와 다르게 굴면
   **내가 낸 수와 사람이 화면에서 보는 수가 갈린다.**

   ⚠ 그런데 그것이 «갈리는지» 아무도 안 쟀다. 넉 달 동안.
     ⇒ 갈려 있었다면 내 표 전부가 「그럴듯한데 틀린 것」이다.

   ★ 그래서 같은 씨앗·같은 빛·같은 진행도를 두 쪽에 주고 «맞대 본다».
     형태(축·마디)는 THREE 를 타므로 여기가 갈릴 자리다.

   ⚠ 서버가 떠 있어야 한다:  python tools/serve.py 8971
     BYEOT_URL=http://localhost:8971 node tools/test_growth_parity.mjs
============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';
import { launch } from './test_cdp.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
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

/* 두 쪽에 똑같이 물어볼 것 — 형태·잎·무늬·성숙 */
const CASES = [
  { seed: 92158, dli: 3.68, growth: 45  },
  { seed: 92158, dli: 3.68, growth: 143 },
  { seed: 4242,  dli: 8.00, growth: 200 },
  { seed: 777,   dli: 2.78, growth: 300 },
];
const SNAP = `(function(cs){
  /* ⚠ 헤드리스는 3D 무대가 없어 buildPlant 가 던진다. 씨앗·리셋은 그 «앞»에서
     끝나므로(plant_grow §plantSeed) 삼키고 간다. 그리는 것만 못 하고 «정하는 것»은 다 된다. */
  /* ★★ 차례가 중요하다 — «빛을 먼저» 세운다.
     브라우저에서는 plantSeed 가 곧바로 buildPlant 를 돌리고, 그 안에서 varieRoll 이
     «그때의 빛»으로 무늬를 굴려 VARIE_STATE 에 못박는다. 빛을 나중에 주면
     «앞 판의 빛»으로 굴린 것이 남는다(2026-08-29 에 이 검사가 그걸로 갈렸다).
     ⚠ 헤드리스는 buildPlant 가 던져서 그 굴림이 «안» 일어난다 — 그래서 차례가 어긋나면
       두 쪽이 «다른 수»를 낸다. 그건 스텁 탓이 아니라 «부르는 차례» 탓이다. */
  try { setDailyLightSteady(cs.dli); } catch (e) { }
  try { plantSeed(cs.seed >>> 0); } catch (e) { }
  try { setDailyLightSteady(cs.dli); } catch (e) { }
  try { setGrowth(cs.growth); } catch (e) { }
  const st = leafStats();
  const on = leafOnPlantAll().map(r => [r.leafBirth, r.onPlant ? 1 : 0, +r.leafM.toFixed(4)]);
  const vs = varieStateAll().map(v => [v.leafBirth, v.varie ? 1 : 0]).sort((a,b)=>a[0]-b[0]);
  const ms = matStateAll().map(m => [m.leafBirth, m.matured ? 1 : 0, m.rolls|0]).sort((a,b)=>a[0]-b[0]);
  const ph = (typeof growthPhase === 'function') ? growthPhase() : null;
  return JSON.stringify({ st, on, vs, ms,
    phase: ph && { id: ph.phaseId, p: +Number(ph.progress01).toFixed(4) },
    age: +ageOf(cs.growth).toFixed(4) });
})`;

const G = loadGrowth();
for (let i = 0; i < 400 && !G.thLoaded(); i++) await new Promise(r => setImmediate(r));
assert.ok(G.thLoaded(), '헤드리스가 정본을 못 읽었습니다');

const BASE = process.env.BYEOT_URL || 'http://localhost:8971';
const page = await launch({ width: 900, height: 700, dpr: 1, mobile: false });
await page.goto(`${BASE}/plant_grow.html?embed=game`);
await page.waitFor('typeof thLoaded === "function" && thLoaded() === true', 180000, 300);

let fail = 0;
console.log('══ 헤드리스 plant_grow  vs  브라우저 plant_grow');
console.log('   같은 씨앗 · 같은 빛 · 같은 진행도를 주고 맞댄다\n');
for (const cs of CASES) {
  const head = JSON.parse(vm.runInContext(`(${SNAP})(${JSON.stringify(cs)})`, G));
  const brow = JSON.parse(await page.eval(`(${SNAP})(${JSON.stringify(cs)})`));
  const label = `씨앗 ${cs.seed} · DLI ${cs.dli} · GROWTH ${cs.growth}`;
  const same = JSON.stringify(head) === JSON.stringify(brow);
  if (same) {
    console.log(`PASS  ${label}`);
    console.log(`        잎 ${head.st.leaves} · 무늬 ${head.st.variegatedLeaves} · 갈라짐 ${head.st.matureLeaves} · g ${head.age}`);
  } else {
    fail++;
    console.log(`FAIL  ⛔ ${label} — 두 쪽이 «다른 수»를 냅니다`);
    for (const k of Object.keys(head)) {
      const a = JSON.stringify(head[k]), b = JSON.stringify(brow[k]);
      if (a !== b) {
        console.log(`        ${k}`);
        console.log(`          헤드리스 ${a.slice(0, 150)}`);
        console.log(`          브라우저 ${b.slice(0, 150)}`);
      }
    }
  }
}
console.log(`\ngrowth_parity: ${fail ? `FAIL (${fail}건)` : 'PASS'}`);
process.exitCode = fail ? 1 : 0;
await page.close();
