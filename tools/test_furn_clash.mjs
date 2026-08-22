/* ============================================================
   tools/test_furn_clash.mjs — **방 데이터의 가구가 서로 박혀 있나** (house 소유)
   ------------------------------------------------------------
   2026-08-23 신설.

   ★ 왜 이 자가 없었나 — `room_view.furnitureFit` 이 겹침을 막는다. 그런데 그 자는
     **플레이어가 옮길 때만** 돈다. **처음부터 그렇게 적힌 데이터는 그 자를 안 거친다.**
     막는 자가 있는데 **그 자를 안 지나고 들어온 것**이라 아무도 안 던졌다.
     실제로 셋이 박힌 채로 서 있었다 — 교탁이 사물함 속에 **1.05m** 들어가 있다.

   ★ 무엇을 재나 — **「겹침이 0건이다」가 아니라 「가구가 서로 안 박힌다」**를 잰다.
     숫자를 못박으면 다음에 하나 더 늘 때 「기대값을 고치면」 되는 자가 된다.
     규칙은 `furnitureFit` 과 같다: XZ 가 겹치고 **높이도 겹치면** 박힌 것이다.
       · 위아래로 갈렸으면 겹친 것이 아니다 — 그건 **쌓은 것**이다(vClear)
       · 납작한 것(h <= 0.05)은 뺀다 — **겹치라고 있는 물건**이다(판·러그)

   ⚠⚠ **붙박이를 빼야 한다.** 창턱·칸막이는 그룹이 원점에 있고 상자만 옮겨져 있다
     (`room_view §furnitureFit` 이 그렇게 적어 뒀다). `position` 으로 재면 방 한가운데에
     7.2×1.0 짜리가 있는 셈이 되어 **학원교실에서 9건이 거짓으로 떴다**(12건 → 3건).
     `house_rooms.json` 의 `furniture` 배열에 있는 uid 만 본다.

   ⛔ **「알려진 것은 봐준다」 목록을 넣지 마라.** 넣는 순간 이 자가 죽는다.
     지금 **3건이라 붉다. 그게 맞다.** 고치면 초록이 된다.

     node tools/test_furn_clash.mjs
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

/* ══ 잰다 ═══════════════════════════════════════════════════════════════ */
const ROOMS = ['banjiha', 'oneroom', 'classroom', 'tworoom', 'apartment', 'greenhouse'];
let fail = 0, pass = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('PASS  ' + name); }
  else { fail++; console.log('FAIL  ' + name + (extra ? '\n      ' + extra : '')); }
};

/* 한 방을 재서 박힌 짝을 낸다. 방 데이터를 갈아끼울 수 있게 엔진을 받는다. */
function clashesOf(engine, room, hr) {
  const r = engine.build(room);
  r.built.room.updateMatrixWorld(true);
  const OK = new Set((hr.rooms[room].furniture || []).map(f => f.uid).filter(Boolean));
  const N = [];
  for (const g of r.built.furniture.children) {
    const u = g.userData; if (!u || !u.uid || !u.size) continue;
    if (!OK.has(u.uid)) continue;
    if ((u.size.h || 0) <= 0.05) continue;
    const rot = Math.abs((g.rotation.y || 0) % Math.PI);
    const swap = Math.abs(rot - Math.PI / 2) < 0.01;
    N.push({ uid: u.uid, x: g.position.x, z: g.position.z,
             w: swap ? u.size.d : u.size.w, d: swap ? u.size.w : u.size.d,
             y0: g.position.y, y1: g.position.y + (u.size.h || 0) });
  }
  const out = [];
  for (let i = 0; i < N.length; i++) for (let j = i + 1; j < N.length; j++) {
    const a = N[i], b = N[j];
    if (a.y1 <= b.y0 + 1e-6 || b.y1 <= a.y0 + 1e-6) continue;
    const o = rectHit(a, b);
    if (!o) continue;
    const iy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
    out.push(`${a.uid} × ${b.uid}  겹침 ${o.ix.toFixed(3)} × ${o.iz.toFixed(3)} × ${iy.toFixed(3)}m`);
  }
  return out;
}

const all = [];
for (const room of ROOMS) {
  const c = clashesOf(eng, room, HR);
  all.push(...c.map(t => room + ': ' + t));
  ok(`${room} — 가구가 서로 안 박힌다`, c.length === 0, c.join('\n      '));
}

/* ★ 떨어질 수 있는가 — 반지하 가구 하나를 일부러 겹치게 옮겨 본다.
   반지하는 지금 0건이라 좋은 대조군이다. 여기서 안 붉어지면 이 자는 아무것도 안 재는 것이다. */
{
  const hr = JSON.parse(JSON.stringify(HR));
  const bed = hr.rooms.banjiha.furniture.find(f => f.uid === 'banjiha-bed');
  const desk = hr.rooms.banjiha.furniture.find(f => f.uid === 'banjiha-desk');
  bed.x = desk.x; bed.z = desk.z;                    // 침대를 책상 위로 겹쳐 놓는다
  const e2 = mk(o => Object.assign(o, hr));
  const c = clashesOf(e2, 'banjiha', hr);
  ok('★ 이 자가 떨어질 수 있다 — 반지하 침대를 책상에 겹치면 잡는다',
     c.length > 0, '겹치게 옮겼는데 아무것도 안 잡았습니다 — 이 검사는 아무것도 안 재고 있습니다');
}

console.log('');
if (all.length) {
  console.log('★ 박힌 짝 ' + all.length + '개 — 좌표를 고치면 초록이 된다');
  console.log('  ⛔ 「알려진 것은 봐준다」 목록을 넣어 초록으로 만들지 마라. 그러면 이 자가 죽는다.');
}
console.log(`furn_clash: ${fail ? 'FAIL' : 'PASS'} — ${pass}/${pass + fail}`);
process.exit(fail ? 1 : 0);
