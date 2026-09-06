/* ============================================================
   probe_leaf_health_year.mjs — 잎이 «바랬다가 돌아오나» ([growth] 소유)
   ------------------------------------------------------------
   ★ 왜 (2026-09-06 밤) — 내 색인 ③에 「잎 건강을 real 사계절로 «안» 돌려 봤다.
     검사(test_maturation I~M)는 «고정광»이다」로 적혀 있던 칸이다. 그 칸을 채운다.

   ★ 판정 (growth_tuning.health · 문턱은 light_thresholds 를 그대로 씀)
     7일평균 < survive(1.2)  ⇒ fade_days(10) 에 걸쳐 «바랜다»
     7일평균 ≥ min(2.7)      ⇒ recover_days(6) 에 걸쳐 «돌아온다»
     ⇒ ★ 그 «사이»(1.2~2.7)는 바래지도 돌아오지도 않는다 — 바랜 채로 «멈춘다»
        그래서 「바래는가」보다 ★★ 「돌아올 만큼 밝아지는 해가 있는가」가 갈린다
   ⚠ drop_enabled=false 다 — 스토리 모드 전체가 초보라 «낙엽이 없다». 바래기만 하고 안 잃는다

   ⚠⚠ 반드시 — 「그 프로필에 그 등 개수 표가 있는가」를 먼저 본다.
     원룸 정본은 `lampCounts [0]` 이라 ⇒ 등1 을 물어도 «등0 을 낸다».
     그걸 모르고 등0/등1 을 나란히 찍으면 «같은 판을 두 번» 잰 표가 된다(실제로 그랬다).

     node tools/probe_leaf_health_year.mjs
============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';
import { createProfileLight } from '../src/game/room_profile.js';
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
const J = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const T = J('data/balance/light_thresholds.json').plants.monstera_deliciosa;
const G = loadGrowth();
for (let i=0;i<400 && !G.thLoaded();i++) await new Promise(r=>setImmediate(r));
console.log('잎 건강 — real 사계절로 «하루씩» (검사는 고정광이라 이 칸이 비어 있었다)');
console.log('   문턱: survive ' + T.survive + ' 아래면 바랜다 · min ' + T.min + ' 위면 되돌아온다');
console.log('');
console.log('  방/모드/등        바램 구간일   최대 fade   끝 fade   떨어진 잎   잎 수 끝');
for (const [ROOM,SLOT,mode,lamps,FILE] of [
    ['banjiha','banjiha-sill:0','novice',0,null],
    ['banjiha','banjiha-sill:0','real',0,null],
    ['banjiha','banjiha-sill:0','real',1,null],
    ['oneroom','oneroom-sill:1','real',0,'docs/handoff/_tmp_profile_oneroom_A.json'],
    ['oneroom','oneroom-sill:1','real',1,'docs/handoff/_tmp_profile_oneroom_A.json'],
    ['oneroom','oneroom-sill:0','real',1,'docs/handoff/_tmp_profile_oneroom_A.json']]) {
  const P = J(FILE || ('data/profiles/room_profile.' + ROOM + '.json'));
  /* ⚠ 등을 물으려면 프로필이 그 등 개수를 가져야 한다. 정본 원룸은 lampCounts [0] 이라
     등1 을 물어도 «등0 을 낸다» — 그러면 두 줄이 「같은 판을 두 번」이 된다. */
  if (!(P.lampCounts||[0]).includes(lamps)) { console.log('  ' + (ROOM+'/'+mode+'/등'+lamps).padEnd(20) + '⛔ 이 프로필엔 등'+lamps+' 표가 없다 — 안 잰다'); continue; }
  const light = createProfileLight({ ...P, uidStable:true },
    { thresholds:J('data/balance/light_thresholds.json'),
      weather:J('data/balance/weather.json'), electricity:J('data/balance/electricity.json') });
  try { G.plantSeed(92158); } catch(e){}
  G.resetDailyLight();
  G.setGrowth(143);
  const cal0 = G.calendarDay();
  let below=0, maxFade=0, dropped=0;
  for (let d=1; d<=400; d++){
    const S={sim:{mode,yearDay0:135},lamps:{count:lamps,litHours:12},pots:[],placedItems:[]};
    const s=(light.daily(d,S).report.slots||[]).find(x=>x.slotId===SLOT);
    G.setDailyLight(s ? s.dli : null);
    G.advanceTo(cal0 + d);
    const a = G.dliAvg ? G.dliAvg(7) : null;
    if (a != null && a < T.survive) below++;
    for (const h of (G.leafHealthAll ? G.leafHealthAll() : [])) {
      if (h.fade > maxFade) maxFade = h.fade;
      if (h.dropped) dropped++;
    }
  }
  const end = (G.leafHealthAll ? G.leafHealthAll() : []);
  const endFade = end.length ? Math.max(...end.map(h=>h.fade||0)) : 0;
  const dropNow = end.filter(h=>h.dropped).length;
  console.log('  ' + (ROOM+'/'+mode+'/등'+lamps+(FILE?'*':'')).padEnd(20)
    + String(below).padStart(6) + '일'
    + maxFade.toFixed(2).padStart(11)
    + endFade.toFixed(2).padStart(10)
    + String(dropNow).padStart(10) + '장'
    + String(G.leafStats().leaves).padStart(9) + '장');
}
