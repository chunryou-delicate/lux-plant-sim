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
const CELL = +(process.argv.find(a => a.startsWith('--cell='))||'').split('=')[1] || 0.25;
/* 기본 0.25 — 바닥 격자와 같은 눈금 (game/place.js §GRID_CELL).
   ⚠ **벽만 다른 눈금을 쓰면 어색하다.** 바닥이 0.25 인데 벽이 0.5 면 같은 방에 자가 둘이다.
     `--cell=0.5` 로 견줘 볼 수는 있게 열어 두되, 고르는 것은 기획 몫이다. */
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
function holesOf(def, wall, W, D) {
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
  /* ⚠ `glassWalls` 는 두 모양이다 (house.js:325):
       "left"                       → **벽 전체**가 유리
       {wall:"left", from:-6, to:1} → 그 구간만
     처음에 `from`/`to` 를 그냥 읽었더니 전체 유리인 벽에서 `undefined` 와 견주게 되어
     **하나도 안 걸렀다** — 온실 뒷벽이 통째로 유리인데 「붙일 수 있는 칸 440」이 나왔다.
     ★ 없으면 «그 벽 전체»로 읽는다. */
  const [wa, wb] = spanOf(wall, W, D);
  for (const g0 of (def.glassWalls || [])) {
    const g = (typeof g0 === 'string') ? { wall: g0 } : g0;
    if (g.wall !== wall) continue;
    out.push({ kind: '유리벽', u0: Number.isFinite(g.from) ? g.from : wa,
               u1: Number.isFinite(g.to) ? g.to : wb, v0: 0, v1: 99 });
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
    const holes = holesOf(def, wall, W, D);
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

/* ══ 칸 크기 견주기 — 「608칸은 너무 잘다」에 답하려면 ═══════════════════════
   ★ 화분 때와 같은 물음이다: **물건이 한 칸에 들어가나.**
     바닥 격자는 화분 지름을 보고 칸을 나눈다(`room_view §surfaceAxis`).
     벽도 같아야 한다 — 등이 칸보다 크면 「칸 한가운데」가 뜻을 잃는다. */
if (process.argv.includes('--sizes')) {
  const FP = dataOf('furniture_presets.json').presets;
  const lamps = ['growlight_bar', 'growlight_clip', 'lamp_wall'];
  console.log('');
  console.log('== 벽에 붙일 물건의 크기 ==');
  for (const id of lamps) {
    const P = FP[id] || {}, sm = P.size_m || {};
    console.log('  ' + id.padEnd(18) + (sm.w ?? P.w ?? '?') + ' x ' + (sm.d ?? P.d ?? '?') +
                ' x ' + (sm.h ?? P.h ?? '?') + '   ' + (P.name_ko || ''));
  }
  /* 실제로 조립된 크기도 본다 — 프리셋 w·d 가 빌더가 내는 크기와 다를 수 있다(84d3a3f) */
  const rb = eng.build('banjiha');
  rb.built.room.updateMatrixWorld(true);
  for (const g of rb.built.furniture.children) {
    const u = g.userData; if (!u || !/growlight-bar/.test(String(u.uid))) continue;
    const bb = new THREE.Box3().setFromObject(g);
    console.log('  ★ 조립된 벽부등 실제 크기 ' +
                (bb.max.x - bb.min.x).toFixed(3) + ' x ' + (bb.max.z - bb.min.z).toFixed(3) +
                ' x ' + (bb.max.y - bb.min.y).toFixed(3) + ' m');
  }
  console.log('');
  console.log('== 칸 크기별 — 반지하 네 벽 ==');
  console.log('  칸 크기   붙일 수 있는 칸   등(가로 0.70)이 차지하는 칸 수');
  const def0 = HR.rooms['banjiha'];
  for (const cs of [0.25, 0.5, 1.0]) {
    let free = 0;
    for (const wall of WALLS) {
      const [a, b] = spanOf(wall, def0.size.w, def0.size.d);
      const len = b - a, nu = Math.max(1, Math.round(len / cs)), nv = Math.max(1, Math.round(def0.size.h / cs));
      const hs = holesOf(def0, wall, def0.size.w, def0.size.d);
      for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
        const u = a + (i + 0.5) * (len / nu), v = (j + 0.5) * (def0.size.h / nv);
        if (hs.some(o => u > o.u0 && u < o.u1 && v > o.v0 && v < o.v1)) continue;
        free++;
      }
    }
    console.log('  ' + cs.toFixed(2) + 'm' + String(free).padStart(14) +
                String(Math.ceil(0.70 / cs)).padStart(22) + '칸');
  }
  console.log('');
  console.log('  ⚠ 바닥 격자는 0.25m 다(game/place.js §GRID_CELL). **벽만 다른 눈금이면 자가 둘이다.**');
  console.log('  ⚠ 등이 가로 0.70m 라 0.25 칸에는 **안 들어간다** — 세 칸을 걸친다.');
  console.log('     화분은 그래서 `surfaceAxis` 가 «화분 지름을 보고» 칸을 나눈다.');
  console.log('     벽도 같은 셈이 필요하다: 칸을 나누는 자가 «등 크기»를 봐야 한다.');
  console.log('  ⇒ 고르는 것은 기획 몫이다. 여기서는 수만 낸다.');
}
