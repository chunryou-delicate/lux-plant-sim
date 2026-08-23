/* ============================================================
   tools/wall_mounts.mjs — **벽에 붙일 수 있는 자리** (house 소유)
   ------------------------------------------------------------
   박사님 2026-08-23: *"벽부등은 **바닥 및 벽 모든 곳에** 붙을 수 있게 (**벽에도 격자가 생기게**)"*

   ★ 나누기 — [house] 는 **면을 낸다**, [core] 는 **칸으로 그리고 손짓을 붙인다**.
     여기서 내는 것은 「어느 벽의 어느 사각형이 비어 있나」와 그 위의 0.25m 격자다.
     화면에 어떻게 그릴지·어떻게 집을지는 `game/room_view.js` 몫이라 여기서 안 정한다.

   ★★ 왜 격자인가 — 예전에 벽등을 옮기면 **높이를 그대로 들고 가서 허공에 떴다**
     (박사님: *"처음에 주는 식물등이 저 하늘로 가버려"*). 그래서 `game.html §showConfirm` 이
     벽등의 [옮기기]를 **아예 안 줬다.** ⇒ **격자 칸에만 붙으면 허공에 못 뜬다.**
     곧 이 격자가 그 버그의 해법이기도 하다.

   벽 좌표 규약 (`house.js §wallPlacement` 와 같다)
     wall  back(z=-D/2) · front(z=+D/2) · left(x=-W/2) · right(x=+W/2)
     u     그 벽을 따라가는 가로 좌표 (back/front 는 x · left/right 는 z)
     v     높이(y)
   ⚠ 벽 «안쪽 면»에 붙인다 — 벽 두께 0.1m 만큼 방 쪽으로 들어온 자리다.

   ⛔ **여기서 자리를 «만들지» 않는다.** 어디에 붙일 수 있는지만 낸다.
     실제로 등을 놓는 것은 `house_rooms.json` 을 고치는 일이고 그건 밸런스다.

     node tools/wall_mounts.mjs                 (여섯 방 요약)
     node tools/wall_mounts.mjs banjiha --cells (칸 하나씩)
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


const ROOM = process.argv.find(a => !a.startsWith('-') && a !== process.argv[0] && a !== process.argv[1]);
const SHOW_CELLS = process.argv.includes('--cells');
const CELL = 0.25;          // 바닥 격자와 같은 눈금 (game/place.js §GRID_CELL)
const WALL_T = 0.1;         // 벽 두께 — 안쪽 면까지 (house.js 규약)
const HR = dataOf('house_rooms.json');
const eng = mk(() => {});

/* 그 벽의 u 범위 — house.js §wallSpan 과 같다 */
const spanOf = (wall, W, D) => (wall === 'back' || wall === 'front') ? [-W / 2, W / 2] : [-D / 2, D / 2];
/* 벽 위 (u,v) → 월드 (x,y,z). 안쪽 면에 붙인다 */
function toWorld(wall, u, v, W, D) {
  if (wall === 'back')  return { x: u, y: v, z: -D / 2 + WALL_T };
  if (wall === 'front') return { x: u, y: v, z:  D / 2 - WALL_T };
  if (wall === 'left')  return { x: -W / 2 + WALL_T, y: v, z: u };
  return { x: W / 2 - WALL_T, y: v, z: u };
}
/* 그 벽에 뚫린 것들 — 창·문·유리벽. [u0,u1,v0,v1] 로 낸다 */
function holesOf(def, wall) {
  const out = [];
  for (const w of (def.windows || [])) {
    if (w.wall !== wall) continue;
    out.push({ kind: '창', u0: (w.cu ?? 0) - w.w / 2, u1: (w.cu ?? 0) + w.w / 2,
               v0: (w.cy ?? 1.2) - w.h / 2, v1: (w.cy ?? 1.2) + w.h / 2 });
  }
  for (const d of (def.doors || [])) {
    if (d.wall !== wall) continue;
    out.push({ kind: '문', u0: (d.cu ?? 0) - d.w / 2, u1: (d.cu ?? 0) + d.w / 2, v0: 0, v1: d.h });
  }
  for (const g of (def.glassWalls || [])) {
    if (g.wall !== wall) continue;
    out.push({ kind: '유리벽', u0: g.from, u1: g.to, v0: 0, v1: 99 });
  }
  return out;
}

const ROOMS = ROOM ? [ROOM] : ['banjiha', 'oneroom', 'classroom', 'tworoom', 'apartment', 'greenhouse'];
const WALLS = ['back', 'right', 'front', 'left'];
console.log('벽 격자 ' + CELL + 'm · 벽 안쪽 면(두께 ' + WALL_T + 'm) · 높이는 칸 한가운데');
console.log('⛔ 자리를 만들지 않는다 — «어디에 붙일 수 있나»만 낸다.');
console.log('');
for (const id of ROOMS) {
  const def = HR.rooms[id];
  if (!def) { console.log('모르는 방: ' + id); continue; }
  const W = def.size.w, D = def.size.d, H = def.size.h;
  console.log('== ' + id + ' == ' + W + ' x ' + D + ' x ' + H);
  let tot = 0, blocked = 0;
  for (const wall of WALLS) {
    const [a, b] = spanOf(wall, W, D);
    const len = b - a;
    const nu = Math.max(1, Math.round(len / CELL));
    const nv = Math.max(1, Math.round(H / CELL));
    const holes = holesOf(def, wall);
    const rows = [];
    let free = 0, hit = 0;
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
      const u = a + (i + 0.5) * (len / nu), v = (j + 0.5) * (H / nv);
      tot++;
      const inHole = holes.find(o => u > o.u0 && u < o.u1 && v > o.v0 && v < o.v1);
      if (inHole) { hit++; blocked++; continue; }
      free++;
      if (SHOW_CELLS) rows.push({ u: +u.toFixed(3), v: +v.toFixed(3), w: toWorld(wall, u, v, W, D) });
    }
    console.log('  ' + wall.padEnd(6) + len.toFixed(2) + 'm · 칸 ' + nu + '×' + nv +
                ' = ' + (nu * nv) + ' · 뚫린 칸 ' + String(hit).padStart(3) +
                ' · **붙일 수 있는 칸 ' + String(free).padStart(3) + '**' +
                (holes.length ? '   (' + holes.map(o => o.kind).join('·') + ')' : ''));
    if (SHOW_CELLS) for (const r of rows.slice(0, 8))
      console.log('        u ' + r.u.toFixed(2).padStart(6) + ' 높이 ' + r.v.toFixed(2).padStart(5) +
                  '  → 월드 (' + r.w.x.toFixed(2) + ', ' + r.w.y.toFixed(2) + ', ' + r.w.z.toFixed(2) + ')');
    if (SHOW_CELLS && rows.length > 8) console.log('        … 그 밖 ' + (rows.length - 8) + '칸');
  }
  console.log('  ⇒ 네 벽 합 ' + tot + '칸 중 뚫린 것 ' + blocked + ' · **붙일 수 있는 칸 ' + (tot - blocked) + '**');
  console.log('');
}
