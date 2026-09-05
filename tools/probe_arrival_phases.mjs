/* ============================================================
   probe_arrival_phases.mjs — 도착 뒤 «단계마다 첫날» ([growth] 소유)
   ------------------------------------------------------------
   ★ 왜 (2026-09-06 밤) — [Plan] 이 「아무 일도 안 일어나는 며칠」의 크기를 기다렸다.
     잎 시각(probe_leaf_when)은 «잎이 나는 날»만 낸다. 그 사이 «형태가 바뀌는 날»
     (어린잎→중간잎 · 줄기 오름 · 새순 자리 · 말린 새순)은 이 자가 낸다.

   ★ 지킬 것: ① 도착은 setGrowth(45) — 달력도 45 로 맞춰지므로 advanceTo 는 «달력+1» 로
     ② 빛은 room_profile 이 낸 그 자리의 하루값을 setDailyLight 로 «하루씩» 먹인다(관문을 탄다)
     ③ 머리표: 방 · 자리 · 모드 · 등 개수 · 프로필

     ROOM=banjiha SLOT=banjiha-sill:0 node tools/probe_arrival_phases.mjs
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
const ROOM = process.env.ROOM || 'banjiha';
const SLOT = process.env.SLOT || (ROOM + '-sill:0');
const P = J('data/profiles/room_profile.' + ROOM + '.json');
const light = createProfileLight({ ...P, uidStable:true },
  { thresholds:J('data/balance/light_thresholds.json'),
    weather:J('data/balance/weather.json'), electricity:J('data/balance/electricity.json') });
const G = loadGrowth();
for (let i=0;i<400 && !G.thLoaded();i++) await new Promise(r=>setImmediate(r));
console.log('① 창턱에 선 뒤 «새순이 말리기까지» 며칠 — 조도 이력으로 하루씩');
console.log(`   [${ROOM} · ${SLOT} · 도착 GROWTH 45 · 잎 1장 · advanceTo 로 하루씩 · 프로필 ${String(P.roomRev||'').split(' ')[0]}]`);
console.log('');
for (const [mode,lamps] of [['novice',0],['real',0],['real',1]]) {
  try { G.plantSeed(92158); } catch(e){}
  G.resetDailyLight();
  G.setGrowth(45);
  const start = G.growthPhase();
  const cal0 = G.calendarDay ? G.calendarDay() : 45;   /* setGrowth 가 달력도 맞춘다 */
  let firstFurled=null, firstLeaf2=null, prevLeaves=G.leafStats().leaves, stops=0;
  const seen=[]; const firstOf={};
  for (let d=1; d<=400; d++){
    const S={sim:{mode,yearDay0:135},lamps:{count:lamps,litHours:12},pots:[],placedItems:[]};
    const s=(light.daily(d,S).report.slots||[]).find(x=>x.slotId===SLOT);
    G.setDailyLight(s ? s.dli : null);
    const r=G.advanceTo(cal0 + d);
    if (r && r.blocked) stops++;
    const ph=G.growthPhase().phaseId;
    if (!seen.includes(ph)) { seen.push(ph); firstOf[ph]=d; }
    if (firstFurled===null && ph==='spear_furled') firstFurled=d;
    const lv=G.leafStats().leaves;
    if (firstLeaf2===null && lv>prevLeaves) firstLeaf2=d;
    if (firstFurled!==null && firstLeaf2!==null && d>=firstFurled+3) break;
  }
  console.log(`  [${mode} 등${lamps}]  출발 ${start.phaseId}`);
  console.log(`     ★ 새순(spear_furled) 첫 날   ${firstFurled ?? '400일 안에 «안 옴»'}`);
  console.log(`     둘째 잎 나는 날              ${firstLeaf2 ?? '400일 안에 «안 옴»'}`);
  console.log(`     그 사이 정지일 ${stops} · 지나간 단계: ${seen.join(' → ')}\n`);
  console.log('     ★ 단계마다 첫날(도착 뒤 며칠째): ' + seen.map(k=>k+'@'+(firstOf[k]===undefined?'출발':firstOf[k])).join(' → '));
  console.log('');
}
