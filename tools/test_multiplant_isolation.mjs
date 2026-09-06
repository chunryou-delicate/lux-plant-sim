/* ============================================================
   test_multiplant_isolation.mjs — 그루끼리 «상태가 새지 않는가» ([growth] 소유)
   ------------------------------------------------------------
   ★ 왜 (2026-09-06) — 내 색인 ③의 마지막 빈 칸이었다: 「다개체를 판 하나에서 안 돌려 봤다」.
     그런데 `state.js:662` 가 씨앗을 심을 때 실제로 `addPlant` 를 부른다 — 쓰이는 길이다.

   ★ 무엇이 걸려 있나 — 그루마다 «따로» 있어야 하는 것들이 `_plantCapture`/`_plantInstall`
     한 쌍으로 옮겨 다닌다(SEED · GROWTH · CAL_DAY · DLI_HIST · ★DLI_FED · MAT_STATE ·
     LEAF_HEALTH · VARIE_STATE · PROLOGUE_VARIE · LEAF_SKIN_FORCE).
     ⇒ 하나라도 빠지면 ⇒ ⛔ 「A 의 빛 이력으로 B 의 무늬가 굴려진다」가 된다.
        무늬 한 장은 20,000 ⇄ 1,150,000 이다.

   ⚠ 이 검사는 「값이 같나」가 아니라 ★ 「그루를 오갔다 와도 «제 것»인가」를 본다.
     그래서 A→B→A 로 «돌아와서» 다시 본다. 한 번만 보면 install 이 빠져도 안 걸린다.

     node tools/test_multiplant_isolation.mjs
============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';
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
const G = loadGrowth();
for (let i=0;i<400 && !G.thLoaded();i++) await new Promise(r=>setImmediate(r));

let pass=0, fail=0;
const ok=(name,cond,got)=>{ if(cond){pass++;console.log('PASS  '+name);}
                            else{fail++;console.log('FAIL  '+name+'  → '+got);} };

if (typeof G.addPlant !== 'function' || typeof G.selectPlant !== 'function') {
  console.log('skip  다개체 접근자가 없다 — 이 판에서는 못 잰다');
  process.exit(0);
}

/* A: 밝게 키운다 */
G.addPlant({ id:'A', seed:1111, day:0 });
G.selectPlant('A');
G.resetDailyLight();
for (let i=0;i<9;i++) G.setDailyLight(9.0);
G.setGrowth(200);
const A = { fed:G.dliFedCount(), growth:G.leafStats().growthDays, leaves:G.leafStats().leaves,
            varie:G.varieStateAll().filter(v=>v.varie).length,
            keys:G.varieStateAll().map(v=>v.leafBirth).sort((a,b)=>a-b).join(','),
            mature:G.leafStats().matureLeaves,
            matKeys:G.matStateAll().map(m=>m.leafBirth+(m.matured?'*':'')).sort().join(','),
            hist:G.dliHistory().length };

/* B: 어둡게 키운다 */
G.addPlant({ id:'B', seed:2222, day:0 });
G.selectPlant('B');
G.resetDailyLight();
for (let i=0;i<3;i++) G.setDailyLight(2.9);
G.setGrowth(80);
const B = { fed:G.dliFedCount(), growth:G.leafStats().growthDays, leaves:G.leafStats().leaves,
            varie:G.varieStateAll().filter(v=>v.varie).length,
            keys:G.varieStateAll().map(v=>v.leafBirth).sort((a,b)=>a-b).join(','),
            mature:G.leafStats().matureLeaves,
            matKeys:G.matStateAll().map(m=>m.leafBirth+(m.matured?'*':'')).sort().join(','),
            hist:G.dliHistory().length };

ok('① B 로 옮겨도 B 는 «제» 빛 칸 수를 센다 (3)', B.fed===3, 'fed='+B.fed);
ok('② B 의 진행도가 A 것이 아니다 (80)',            B.growth===80, 'growth='+B.growth);
ok('③ B 의 빛 이력이 A 것과 안 섞였다 (3칸)',       B.hist===3, 'hist='+B.hist);

/* ★ 돌아와서 다시 본다 — 한 번만 보면 install 이 빠져도 안 걸린다 */
G.selectPlant('A');
const A2 = { fed:G.dliFedCount(), growth:G.leafStats().growthDays, leaves:G.leafStats().leaves,
             varie:G.varieStateAll().filter(v=>v.varie).length,
            keys:G.varieStateAll().map(v=>v.leafBirth).sort((a,b)=>a-b).join(','),
            mature:G.leafStats().matureLeaves,
            matKeys:G.matStateAll().map(m=>m.leafBirth+(m.matured?'*':'')).sort().join(','),
            hist:G.dliHistory().length };

ok('④ ★ A 로 돌아오면 A 의 빛 칸 수가 되살아난다 (9)', A2.fed===A.fed && A2.fed===9,
   'A '+A.fed+' → 돌아와서 '+A2.fed);
ok('⑤ ★ A 의 진행도가 되살아난다 (200)',              A2.growth===A.growth, A.growth+' → '+A2.growth);
ok('⑥ ★ A 의 잎 수가 되살아난다',                     A2.leaves===A.leaves, A.leaves+' → '+A2.leaves);
ok('⑦ ★ A 의 무늬가 되살아난다 — B 것으로 안 덮인다',  A2.varie===A.varie, A.varie+'장 → '+A2.varie+'장');
/* ⚠ 개수만 보면 «다시 굴려» 같은 수가 나와 안 걸린다(2026-09-06 에 실제로 그랬다).
   그래서 «leafBirth 집합»을 본다 — B 의 잎이 A 에 «섞였는지»는 그것으로만 보인다. */
ok('⑦-b ★★ A 의 무늬 장부에 B 의 잎이 «안 섞였다»', A2.keys===A.keys, 'A ['+A.keys+'] → 돌아와서 ['+A2.keys+']');
ok('⑦-c ★ A 와 B 의 잎 장부가 «다르다» (같으면 한 그루를 두 번 본 것)',
   A.keys!==B.keys, 'A ['+A.keys+'] vs B ['+B.keys+']');
ok('⑧ ★ A 의 빛 이력이 되살아난다',                    A2.hist===A.hist, A.hist+'칸 → '+A2.hist+'칸');
/* ⚠ 성숙 이력도 «개수»로는 못 잡는다 — matCatchUp 이 다시 굴려 같은 수를 낸다.
   그래서 «어느 잎이 갈라졌나»(leafBirth+*)를 본다. varie 와 같은 손이다. */
ok('⑧-b ★★ A 의 성숙 장부가 되살아난다 — B 것으로 안 덮인다', A2.matKeys===A.matKeys,
   'A ['+A.matKeys+'] → 돌아와서 ['+A2.matKeys+']');
ok('⑧-c ★ A 와 B 의 성숙 장부가 «다르다» (같으면 한 그루를 두 번 본 것)',
   A.matKeys!==B.matKeys, 'A ['+A.matKeys+'] vs B ['+B.matKeys+']');

/* ⑨ 밝기가 달랐으니 결과도 달라야 한다 — 「둘 다 같다」면 한 그루를 두 번 본 것이다 */
ok('⑨ ★★ A 와 B 가 «다른 판»이다 (같으면 한 그루를 두 번 본 것)',
   !(A.fed===B.fed && A.growth===B.growth && A.leaves===B.leaves),
   'A '+JSON.stringify(A)+' vs B '+JSON.stringify(B));

/* ⑩ 없는 그루는 null — 0 이 아니다 */
ok('⑩ 없는 그루의 빛 칸 수는 null (0 이 아니다)', G.dliFedCount('없다')===null, String(G.dliFedCount('없다')));

console.log('\nA=' + JSON.stringify(A) + '\nB=' + JSON.stringify(B));
console.log('\nmultiplant_isolation: ' + (fail ? 'FAIL ('+fail+'건)' : 'PASS ('+pass+'건)'));
process.exitCode = fail ? 1 : 0;
