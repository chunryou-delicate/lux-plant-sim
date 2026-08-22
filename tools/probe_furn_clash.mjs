/* ============================================================
   tools/probe_furn_clash.mjs — **방 데이터의 가구가 서로 박혀 있나** (house)
   ------------------------------------------------------------
   왜 있나
     `room_view.furnitureFit` 은 겹침을 막는다. 그런데 그 자는 **플레이어가 옮길 때만** 돈다.
     **처음부터 그렇게 적힌 데이터는 아무도 안 본다.** 그래서 방을 짓고 나서 한 번 훑는다.

   무엇이 겹침인가 — `furnitureFit` 과 같은 규칙이다:
     XZ 가 겹치고 **높이도 겹치면** 두 물건이 같은 자리를 차지한다.
     위아래로 갈렸으면(vClear) 겹친 것이 아니다 — 그건 「쌓은 것」이다.
     납작한 것(h <= 0.05)은 아예 뺀다 — 그건 겹치라고 있는 물건이다(판·러그).

   ⚠⚠ **붙박이를 빼야 한다 — 안 빼면 거짓 겹침이 쏟아진다.**
     창턱·칸막이는 **그룹이 원점에 있고 상자만 옮겨져 있다**
     (`room_view §furnitureFit`: *"그 그룹은 원점에 있고 상자만 옮겨져 있어서
     position 으로 재면 틀린다"*). position 으로 재면 방 한가운데에 7.2×1.0 짜리가
     있는 셈이 되어 **가까운 것이 전부 겹친 것으로 나온다.**
     ⇒ 실제로 학원교실에서 **9건이 그렇게 떴다.** `house_rooms.json` 의 `furniture`
       배열에 있는 uid 만 본다. 그러면 **12건 → 3건**이다.
     ★ 오늘 여섯 번째다 — **자를 먼저 의심하라.** 틀린 자는 큰 답도 준다.

     node tools/probe_furn_clash.mjs
============================================================ */
import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataOf = r => JSON.parse(fs.readFileSync(path.join(ROOT,'data',r),'utf8'));
const stubCtx = () => new Proxy({}, { get: (t,k) => {
  if (k==='createImageData'||k==='getImageData') return (w=1,h=1)=>({data:new Uint8ClampedArray(Math.max(1,w*h*4)),width:w,height:h});
  if (k==='createLinearGradient'||k==='createRadialGradient') return ()=>({addColorStop(){}});
  if (k==='measureText') return ()=>({width:0});
  return ()=>{}; } });
const stubEl = () => ({ style:{}, dataset:{}, appendChild(){}, setAttribute(){}, getContext:()=>stubCtx(), width:0, height:0 });
globalThis.document = { createElement: stubEl, body: stubEl(), getElementById: ()=>stubEl() };
globalThis.window = globalThis;
vm.runInThisContext(fs.readFileSync(path.join(ROOT,'vendor/three/three.min.js'),'utf8'));
const { createLightEngine } = await import(pathToFileURL(path.join(ROOT,'src/game/light_adapter.js')).href);
const HOUSE = dataOf('house_rooms.json'), TH = dataOf('balance/light_thresholds.json');
const mk = mutate => { const hr = JSON.parse(JSON.stringify(HOUSE)); mutate(hr);
  return createLightEngine({ houseRooms:hr, winPresets:dataOf('window_presets.json').presets,
    doorPresets:dataOf('door_presets.json').presets, finishes:dataOf('room_finishes.json'),
    furnPresets:dataOf('furniture_presets.json').presets, lightPresets:dataOf('lighting_presets.json'),
    shadePresets:dataOf('shading_presets.json'), lightTh:TH, weatherBalance:dataOf('balance/weather.json') }); };
const SKY = { weather:'clear', season:'summer' };
const read = eng => { const r = eng.build('banjiha');
  return r.slots.map(s => { eng.clearCache(); return [s.slotId, +eng.dliOfSlot(s.slotId,{...SKY,lampCount:2}).toFixed(4)]; }); };


const eng = mk(() => {});
const HR = dataOf('house_rooms.json');
/* !! 창턱·칸막이 같은 «붙박이»는 그룹이 원점에 있고 상자만 옮겨져 있다
   (room_view §furnitureFit: "그 그룹은 원점에 있고 상자만 옮겨져 있어서 position 으로 재면 틀린다").
   ⇒ position 으로 재면 방 한가운데에 7.2x1.0 짜리가 있는 셈이 되어 **거짓 겹침이 쏟아진다.**
     실제로 학원교실에서 9건이 그렇게 떴다. `furniture` 배열에 있는 것만 본다. */
const realFurn = room => new Set((HR.rooms[room].furniture || []).map(f => f.uid).filter(Boolean));
const rectHit = (a, b) => {
  /* 회전을 되돌려 견준다 — 둘 중 하나만 돌아 있어도 맞다(보수적으로 AABB 로 본다) */
  const ax0 = a.x - a.w / 2, ax1 = a.x + a.w / 2, az0 = a.z - a.d / 2, az1 = a.z + a.d / 2;
  const bx0 = b.x - b.w / 2, bx1 = b.x + b.w / 2, bz0 = b.z - b.d / 2, bz1 = b.z + b.d / 2;
  const ix = Math.min(ax1, bx1) - Math.max(ax0, bx0);
  const iz = Math.min(az1, bz1) - Math.max(az0, bz0);
  return (ix > 1e-4 && iz > 1e-4) ? { ix, iz } : null;
};
let total = 0;
for (const room of ['banjiha', 'oneroom', 'classroom', 'tworoom', 'apartment', 'greenhouse']) {
  const r = eng.build(room);
  r.built.room.updateMatrixWorld(true);
  const N = [];
  const OK = realFurn(room);
  for (const g of r.built.furniture.children) {
    const u = g.userData; if (!u || !u.uid || !u.size) continue;
    if (!OK.has(u.uid)) continue;                   // 붙박이는 뺀다(위 !!)
    if ((u.size.h || 0) <= 0.05) continue;          // 납작한 판은 겹쳐도 되는 물건이다
    const rot = Math.abs((g.rotation.y || 0) % Math.PI);
    const swap = Math.abs(rot - Math.PI / 2) < 0.01;   // 90° 돌면 w·d 가 바뀐다
    N.push({ uid: u.uid, x: g.position.x, z: g.position.z,
             w: swap ? u.size.d : u.size.w, d: swap ? u.size.w : u.size.d,
             y0: g.position.y, y1: g.position.y + (u.size.h || 0) });
  }
  const hits = [];
  for (let i = 0; i < N.length; i++) for (let j = i + 1; j < N.length; j++) {
    const a = N[i], b = N[j];
    if (a.y1 <= b.y0 + 1e-6 || b.y1 <= a.y0 + 1e-6) continue;   // 위아래로 갈렸다
    const o = rectHit(a, b);
    if (!o) continue;
    const iy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
    hits.push({ a: a.uid, b: b.uid, ix: o.ix, iz: o.iz, iy });
  }
  total += hits.length;
  console.log(room.padEnd(11) + ' 가구 ' + String(N.length).padStart(3) + '개 · 서로 박힌 짝 ' + hits.length);
  for (const t of hits.sort((p, q) => (q.ix * q.iz) - (p.ix * p.iz)))
    console.log('    ' + t.a.padEnd(34) + ' × ' + t.b.padEnd(34) +
                '  겹침 ' + t.ix.toFixed(3) + ' × ' + t.iz.toFixed(3) + ' × ' + t.iy.toFixed(3) + ' m');
}
console.log('');
console.log(total ? '★ 서로 박힌 짝 ' + total + '개' : '박힌 가구 없음');
