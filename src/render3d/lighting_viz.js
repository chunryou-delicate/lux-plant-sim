/* ============================================================
   render3d/lighting_viz.js — 엔진 조도(lx) → 3D 바닥 히트맵
   ------------------------------------------------------------
   ★ Three.js 조명 = 보기용 / 엔진 격자 lx = 진짜 판정용 (둘 구분)
   바닥 평면의 각 정점을 world (x,z) → 방좌표 (u,v) → field.at(u,v)
   색으로 칠한다 (텍스처 UV 왜곡 없이 정점색으로 직접 매핑).
============================================================ */
import { GRID } from '../engine/lighting.js';

// 0~1 → 파랑→시안→초록→노랑→빨강 (jet 계열)
function colormap(t){
  t=Math.max(0,Math.min(1,t));
  return [
    Math.min(1,Math.max(0,1.5-Math.abs(4*t-3))),
    Math.min(1,Math.max(0,1.5-Math.abs(4*t-2))),
    Math.min(1,Math.max(0,1.5-Math.abs(4*t-1))),
  ];
}

// 방 바닥 크기(RW×RD)에 맞춘 히트맵 메시. 처음엔 색 없음 → update로 칠함.
export function buildFloorHeatmap(RW, RD){
  const geo=new THREE.PlaneGeometry(RW, RD, GRID, GRID);
  geo.rotateX(-Math.PI/2);   // XZ 평면(바닥)으로 눕힘 → position에 반영됨
  const n=geo.attributes.position.count;
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n*3), 3));
  /* ★ depthTest 를 끈다 — 진단용 오버레이는 가려지면 안 된다.
     높이를 0.75m 로 올릴 수 있게 되면서, 그보다 높은 가구(선반 1.16m·1.3m)가
     판을 가려 '가구 모양대로 구멍이 뚫린' 것처럼 보였다.
     값이 낮은 것(선반 안이라 실제로 어두움)과 안 보이는 것은 다른 문제인데
     화면에선 똑같이 '빈 곳'으로 보여 구별이 안 됐다. */
  const mat=new THREE.MeshBasicMaterial({ vertexColors:true, transparent:true, opacity:0.5,
                                          depthWrite:false, depthTest:false });
  const mesh=new THREE.Mesh(geo, mat);
  mesh.position.y=0.04;   // 기본은 바닥 살짝 위 (main.js 가 heatY 로 올린다)
  mesh.renderOrder=999;   // 항상 맨 위에
  return mesh;
}

// 조도 필드로 정점색 갱신 (최대값 기준 상대 밝기)
export function updateFloorHeatmap(mesh, field, RW, RD){
  const pos=mesh.geometry.attributes.position;
  const colr=mesh.geometry.attributes.color;
  const max=Math.max(field.max,1);
  for(let k=0;k<pos.count;k++){
    const x=pos.getX(k), z=pos.getZ(k);      // rotateX 후 world x,z
    const u=(x/RW)+0.5, v=(z/RD)+0.5;
    const [r,g,b]=colormap(field.at(u,v)/max);
    colr.setXYZ(k, r,g,b);
  }
  colr.needsUpdate=true;
}

/* ============================================================
   ★ 여기서부터 게임 방(room_view)용 — 「칸 히트맵」 (2026-08-16)
   ------------------------------------------------------------
   왜 위의 buildFloorHeatmap 을 그대로 안 쓰나
     시뮬레이터(main.js)의 판때기는 **PlaneGeometry 정점색**이라 색이 정점 사이에서
     번진다. 그 화면에는 숫자가 없으니 그래도 됐다. 그런데 게임에서는 박사님 지시대로
     **칸마다 숫자**를 얹는다 — 번진 색 위에 숫자를 얹으면 「이 숫자가 이 색인가」가
     어긋난다(정점은 칸 **모서리**에 있고 숫자는 칸 **한가운데**에 있다. 반 칸 밀린다).
     그래서 게임 쪽은 **칸마다 납작한 네모 한 장**으로 칠한다. 한 칸 = 한 색 = 한 숫자다.
   왜 격자 눈금(0.25m)에 맞추나
     방바닥 배치 격자가 이미 0.25m 로 깔려 있다(room_view §gridSpan). 조도 격자를
     따로 22칸으로 깔면 **선 두 벌**이 겹쳐 보인다 — 박사님이 「그리드 살리면서」라
     하셨으므로 살아야 하는 것은 그 배치 격자다. 그래서 조도도 **같은 칸**에 낸다.
   ⚠ 위의 두 함수(buildFloorHeatmap·updateFloorHeatmap)는 **한 글자도 안 바꿨다.**
     main.js 는 그대로 돈다.
============================================================ */

/* 칸 격자 하나를 재서 담는다.
     nx,nz   칸 수      x0,z0  격자 왼쪽·안쪽 끝 모서리[m]   cell 한 칸[m]
     probeAt (x,z) => { value, y, onUid, occIdx } 또는 { skip:true }
             ★ **여기서 아무것도 지어내지 않는다.**
             value  그 칸의 값(엔진이 낸다)
             y      그 칸의 **표면 높이**[m] — 가구가 있으면 그 윗면, 없으면 바닥
             onUid  그 표면을 낸 가구(없으면 null) — 「가구 위인가」를 재는 자가 쓴다
             skip   이 칸은 **상판 칸**(아래 extras)이 대신 그린다 ⇒ 바닥 격자에서 뺀다
     valueAt (x,z) => 값                     y 가 다 같은 옛 길(호환용)
     keep    (i,j) => bool  안 그릴 칸(벽 속). 없으면 전부 그린다.
     extras  ★ 격자 밖의 칸들 — **가구 상판의 제 눈금 칸**이다(아래 ★★★).
             [{ x, y, z, cw, cd, rot, onUid, occIdx, tier, value }] · 값까지 재서 넘긴다
   반환에는 at(u,v) 가 있어 위의 updateFloorHeatmap 과 같은 규약으로도 읽힌다.

   ★★ 왜 칸마다 높이가 다른가 (2026-08-16 · 박사님)
     *"화분 높이를 기본으로 하고, 표면 높이를 보여줘. 특히 가구가 있는 위치는 바닥이 아닌
       가구 위 식물 두는 곳의 빛 결과가 보여야지."*
     반지하 **바닥**은 DLI 0.00~0.32 라 온 방이 파랗다. 그런데 사람이 화분을 놓는 곳은
     바닥이 아니라 **창턱·책상·서랍장 위**다. 한 높이로 재면 그 자리들이 화면에 아예 안 나온다.
     ⇒ 칸마다 「그 칸의 표면」에서 잰다. 그리고 색칠도 그 높이에 얹는다 —
       그러면 가구에 가려서 안 보이던 문제도 같이 없어진다(가구 **위**에 칠하니까).

   ★★★ 왜 「격자 하나」로는 모자랐나 (2026-08-17 · 박사님이 화면 보고 셋을 짚으심)
     ══════════════════════════════════════════════════════════════════
     *"창턱에 꺼는 왜 안 나오는 거야?" · "3단에는 3단에 다 나오도록" ·
      "책상은 2*5인데 빛은 2*4로 나와"*
     셋 다 **뿌리가 하나**다 — 바닥 격자는 **방 원점**에 물려 있는데, 사람이 화분을 놓는
     칸은 **그 상판 한가운데**에 물려 있다(room_view §surfaceAxis). 둘이 안 맞는다.
       · 창턱  받침이 z −2.07~−1.83 인데 바닥 격자 뒷끝이 z −1.875 이고 첫 줄 한가운데가
               −1.75 다 ⇒ **창턱을 지나는 칸 한가운데가 하나도 없다.** 값이 안 나온 게 아니라
               **잴 자리가 없었다.**
       · 3단   한 칸(i,j)에 값은 하나뿐이라 위에서 쏜 광선이 집는 **맨 윗단만** 남는다.
       · 책상  상판 칸은 x 0.80~1.80 · z −1.625/−1.375 인데 바닥 격자는 x 0.75~1.75 ·
               z −1.75/−1.50/−1.25 다. 0.05m·0.125m 씩 어긋나 **가장자리 한 줄이 샌다.**
     ⇒ 상판은 **제 눈금으로** 따로 그린다(extras). 방이 `cellsOfRect(상판사각형)` 로 재서
       넘긴다 — 화분 놓을 때 화면에 뜨는 그 칸과 **같은 함수·같은 칸**이다. 두 벌로 안 짓는다.
     ⇒ 그리고 한 자리에 값이 **여럿**일 수 있게 된다(3단 = 단마다 한 벌). */
export function sampleLightGrid({ nx, nz, x0, z0, cell, probeAt, valueAt, keep, extras }) {
  if (!(nx > 0 && nz > 0 && cell > 0)) throw new Error(`[히트맵] 격자가 이상합니다: ${nx}×${nz} @${cell}`);
  const probe = probeAt || (valueAt ? ((x, z) => ({ value: valueAt(x, z), y: 0, onUid: null })) : null);
  if (!probe) throw new Error('[히트맵] probeAt 이 없습니다 — 값과 높이는 방이 냅니다');
  const cells = new Float64Array(nx * nz);
  const ys = new Float64Array(nx * nz);
  const owners = new Array(nx * nz).fill(null);
  const on = new Uint8Array(nx * nz);
  /* ★ 그리는 것의 정본은 이제 **이 목록**이다. 바닥 칸은 (i,j) 를 달고 들어오고
     상판 칸은 (i,j) 가 null 이다. 판도 숫자도 이 목록 하나만 훑는다 — 두 층이
     따로 돌면 「색은 있는데 숫자는 없는 칸」이 반드시 생긴다. */
  const list = [];
  let max = -Infinity, min = Infinity, n = 0, yMax = 0;
  const take = (e) => {
    if (!Number.isFinite(e.value)) throw new Error(`[히트맵] (${e.x},${e.z}) 값이 숫자가 아닙니다: ${e.value}`);
    if (!Number.isFinite(e.y)) throw new Error(`[히트맵] (${e.x},${e.z}) 표면 높이가 숫자가 아닙니다: ${e.y}`);
    e.k = list.length; list.push(e); n++;
    if (e.value > max) max = e.value;
    if (e.value < min) min = e.value;
    if (e.y > yMax) yMax = e.y;
  };
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const k = j * nx + i;
    if (keep && !keep(i, j)) continue;
    const x = x0 + (i + 0.5) * cell, z = z0 + (j + 0.5) * cell;
    const r = probe(x, z);
    /* 상판 칸이 대신 그리는 자리다 — 두 겹으로 칠하면 **어긋난 두 벌**이 겹쳐 보인다 */
    if (r && r.skip) continue;
    const v = r && r.value, y = r ? (r.y || 0) : 0;
    /* 조용히 0 으로 메꾸지 않는다 — 0 은 「어두운 자리」로 읽히고, 그건 거짓말이다 */
    cells[k] = v; ys[k] = y; owners[k] = (r && r.onUid) || null; on[k] = 1;
    take({ i, j, x, y, z, cw: cell, cd: cell, rot: 0, value: v,
           onUid: (r && r.onUid) || null,
           occIdx: r && Number.isInteger(r.occIdx) ? r.occIdx : null, tier: null });
  }
  for (const e of (extras || [])) {
    if (!e) continue;
    take({ i: null, j: null, x: e.x, y: e.y, z: e.z,
           cw: e.cw > 0 ? e.cw : cell, cd: e.cd > 0 ? e.cd : cell, rot: e.rot || 0,
           value: e.value, onUid: e.onUid || null,
           occIdx: Number.isInteger(e.occIdx) ? e.occIdx : null,
           tier: e.tier || null });
  }
  if (!n) throw new Error('[히트맵] 그릴 칸이 하나도 없습니다');
  const span = { x0, z0, w: nx * cell, d: nz * cell,
                 cx: x0 + nx * cell / 2, cz: z0 + nz * cell / 2 };
  return {
    nx, nz, x0, z0, cell, cells, ys, owners, on, count: n,
    list, lattice: list.filter(e => e.j !== null).length, extra: (extras || []).length,
    max, min: min === Infinity ? 0 : min, yMax, span,
    /* 가구 위에 앉은 칸이 몇 개인가 — 높이 지도가 실제로 도는지 재는 자가 본다 */
    onFurniture: list.reduce((a, e) => a + (e.onUid ? 1 : 0), 0),
    /* 「단이 몇 개 그려졌나」 — 3단 선반이 정말 세 벌로 나오는지 재는 자가 본다 */
    tiers: new Set(list.filter(e => e.tier).map(e => e.tier)).size,
    has: (i, j) => (i >= 0 && j >= 0 && i < nx && j < nz && on[j * nx + i] === 1),
    value: (i, j) => cells[j * nx + i],
    yAt: (i, j) => ys[j * nx + i],
    ownerAt: (i, j) => owners[j * nx + i],
    centerOf: (i, j) => ({ x: x0 + (i + 0.5) * cell, z: z0 + (j + 0.5) * cell,
                           y: ys[j * nx + i] }),
    /* 격자 span 안의 (u,v)∈[0,1] */
    at(u, v) {
      const i = Math.max(0, Math.min(nx - 1, Math.floor(u * nx)));
      const j = Math.max(0, Math.min(nz - 1, Math.floor(v * nz)));
      return cells[j * nx + i];
    }
  };
}

/* 격자 모양대로 납작한 네모를 깐다. **칸마다 제 표면 높이에 앉는다**(grid.yAt).
   색·높이는 updateCellHeatmap 이 칠하고 올린다.
     opt.y            표면에서 더 띄우는 높이[m]. 기본 0.0022
                      ⚠ room_view 의 배치 격자 선이 0.004, 막힌 칸이 0.003 에 있다.
                        바닥 칸은 그 **아래**에 깔려야 「그리드가 살아 있는」 화면이 된다.
     opt.renderOrder  기본 1 (막힌 칸 2 · 눈금선 3 보다 앞이다 = 먼저 그린다)
     opt.opacity      기본 0.45
     opt.depthTest    기본 true — 가구에 가려도 된다. 이건 진단창이 아니라 **표면 그림**이다.
                      (시뮬레이터 판때기는 0.75m 에 떠 있어서 depthTest 를 껐다) */
export function buildCellHeatmap(grid, opt = {}) {
  const { nx, nz } = grid;
  const pos = [], idx = [];
  /* ★ 칸마다 크기·방향이 다를 수 있다 — 바닥 칸은 0.25×0.25 정방이지만 상판 칸은
     그 면을 딱 나눈 것이라 협탁이 0.21×0.36 이고, 돌려 놓은 가구는 회전까지 붙는다. */
  for (const e of grid.list) {
    const b = pos.length / 3;
    quadInto(pos, e);
    idx.push(b, b + 2, b + 1, b, b + 3, b + 2);
  }
  const geo = new THREE.BufferGeometry();
  const pa = new THREE.Float32BufferAttribute(pos, 3);
  pa.setUsage(THREE.DynamicDrawUsage);   // 가구를 옮기면 높이가 바뀐다 — 매번 다시 안 짓는다
  geo.setAttribute('position', pa);
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(pos.length), 3));
  geo.setIndex(idx);
  const mat = new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, opacity: opt.opacity ?? 0.45,
    side: THREE.DoubleSide, depthWrite: false,
    depthTest: opt.depthTest === undefined ? true : !!opt.depthTest,
    toneMapped: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = opt.y ?? 0.0022;
  mesh.renderOrder = opt.renderOrder ?? 1;
  mesh.userData.heatCount = grid.list.length;   // 칸 k → 정점 4k (목록 차례 그대로다)
  mesh.userData.heatDims = { nx, nz };
  return mesh;
}

/* 칸 하나를 네 꼭짓점으로 편다 — **크기(cw·cd)와 방향(rot)을 그대로 쓴다.**
   ⚠ 정방 0.25 로 박아 두면 협탁(0.21×0.36)·돌려 놓은 서랍장에서 색판이 상판 밖으로 나간다. */
function quadInto(out, e) {
  const hu = (e.cw > 0 ? e.cw : 0.25) / 2, hv = (e.cd > 0 ? e.cd : 0.25) / 2;
  const rot = e.rot || 0, c = Math.cos(rot), s = Math.sin(rot);
  /* room_view §cellsOfRect 와 **같은 회전 규약**이다: x = u·cos + v·sin · z = −u·sin + v·cos */
  for (const [u, v] of [[-hu, -hv], [hu, -hv], [hu, hv], [-hu, hv]])
    out.push(e.x + u * c + v * s, e.y, e.z - u * s + v * c);
}

/* 값으로 칸을 칠하고, **그 칸의 표면 높이로 올린다.**
     opt.max / opt.min  색의 양 끝. 안 주면 격자 자신의 max/min 을 쓴다(= 상대 밝기).
   ★ 색은 **상대**고 숫자는 **절대**다. 그래서 화면에 「빨강 = 얼마」를 같이 적어야 한다 —
     그건 light_grid_labels 의 머리글이 한다.
   ⚠ 높이도 같이 쓴다. 가구를 옮기면 같은 칸의 표면이 책상 위에서 바닥으로 내려앉는데,
     색만 고치고 높이를 그대로 두면 **판이 허공에 뜬 채로** 남는다. */
export function updateCellHeatmap(mesh, grid, opt = {}) {
  const cnt = mesh.userData.heatCount;
  const d = mesh.userData.heatDims;
  if (!Number.isInteger(cnt) || cnt !== grid.list.length || !d || d.nx !== grid.nx || d.nz !== grid.nz)
    throw new Error('[히트맵] 판과 격자의 칸 수가 다릅니다 — 방이 바뀌었으면 다시 지어야 합니다');
  const colr = mesh.geometry.attributes.color;
  const posa = mesh.geometry.attributes.position;
  const hi = opt.max ?? grid.max, lo = opt.min ?? grid.min;
  const denom = (hi - lo) > 1e-9 ? (hi - lo) : 1;
  /* ⚠ **x·z 도 다시 쓴다.** 가구를 옮기면 상판 칸의 자리 자체가 옮겨 가는데(높이만
     바뀌는 바닥 칸과 다르다) 높이만 갈아 끼우면 색판이 **옛 자리에** 남는다. */
  const pt = [];
  for (const e of grid.list) {
    const b = e.k * 4;
    const [r, g, bl] = colormap((e.value - lo) / denom);
    pt.length = 0; quadInto(pt, e);
    for (let k = 0; k < 4; k++) {
      colr.setXYZ(b + k, r, g, bl);
      posa.setXYZ(b + k, pt[k * 3], pt[k * 3 + 1], pt[k * 3 + 2]);
    }
  }
  colr.needsUpdate = true;
  posa.needsUpdate = true;
  mesh.geometry.computeBoundingSphere();   // 높이가 바뀌면 절두체 자르기가 어긋난다
  return mesh;
}

/* 색 눈금 — 화면 머리글이 「빨강이 무엇인가」를 말할 때 쓴다. t∈[0,1] → '#rrggbb' */
export function heatColorHex(t) {
  const [r, g, b] = colormap(t);
  const h = v => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}
