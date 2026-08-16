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
     valueAt (x,z) => 값   ★ 값을 **여기서 지어내지 않는다.** 부르는 쪽(엔진)이 낸다.
     keep    (i,j) => bool  안 그릴 칸(벽 속). 없으면 전부 그린다.
   반환에는 at(u,v) 가 있어 위의 updateFloorHeatmap 과 같은 규약으로도 읽힌다. */
export function sampleLightGrid({ nx, nz, x0, z0, cell, valueAt, keep }) {
  if (!(nx > 0 && nz > 0 && cell > 0)) throw new Error(`[히트맵] 격자가 이상합니다: ${nx}×${nz} @${cell}`);
  if (typeof valueAt !== 'function') throw new Error('[히트맵] valueAt 이 없습니다 — 값은 엔진이 냅니다');
  const cells = new Float64Array(nx * nz);
  const on = new Uint8Array(nx * nz);
  let max = -Infinity, min = Infinity, n = 0;
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const k = j * nx + i;
    if (keep && !keep(i, j)) continue;
    const x = x0 + (i + 0.5) * cell, z = z0 + (j + 0.5) * cell;
    const v = valueAt(x, z);
    /* 조용히 0 으로 메꾸지 않는다 — 0 은 「어두운 자리」로 읽히고, 그건 거짓말이다 */
    if (!Number.isFinite(v)) throw new Error(`[히트맵] (${i},${j}) 값이 숫자가 아닙니다: ${v}`);
    cells[k] = v; on[k] = 1; n++;
    if (v > max) max = v;
    if (v < min) min = v;
  }
  if (!n) throw new Error('[히트맵] 그릴 칸이 하나도 없습니다');
  const span = { x0, z0, w: nx * cell, d: nz * cell,
                 cx: x0 + nx * cell / 2, cz: z0 + nz * cell / 2 };
  return {
    nx, nz, x0, z0, cell, cells, on, count: n,
    max, min: min === Infinity ? 0 : min, span,
    has: (i, j) => (i >= 0 && j >= 0 && i < nx && j < nz && on[j * nx + i] === 1),
    value: (i, j) => cells[j * nx + i],
    centerOf: (i, j) => ({ x: x0 + (i + 0.5) * cell, z: z0 + (j + 0.5) * cell }),
    /* 격자 span 안의 (u,v)∈[0,1] */
    at(u, v) {
      const i = Math.max(0, Math.min(nx - 1, Math.floor(u * nx)));
      const j = Math.max(0, Math.min(nz - 1, Math.floor(v * nz)));
      return cells[j * nx + i];
    }
  };
}

/* 격자 모양대로 납작한 네모를 깐다. 색은 아직 안 칠한다(updateCellHeatmap 이 칠한다).
     opt.y            바닥에서 띄우는 높이[m]. 기본 0.0022
                      ⚠ room_view 의 배치 격자 선이 0.004, 막힌 칸이 0.003 에 있다.
                        그 **아래**에 깔아야 「그리드가 살아 있는」 화면이 된다.
     opt.renderOrder  기본 1 (막힌 칸 2 · 눈금선 3 보다 앞이다 = 먼저 그린다)
     opt.opacity      기본 0.45
     opt.depthTest    기본 true — 가구에 가려도 된다. 이건 진단창이 아니라 **바닥 그림**이다.
                      (시뮬레이터 판때기는 0.75m 에 떠 있어서 depthTest 를 껐다. 여기는 바닥이다) */
export function buildCellHeatmap(grid, opt = {}) {
  const { nx, nz, x0, z0, cell } = grid;
  const pos = [], idx = [], slot = new Int32Array(nx * nz).fill(-1);
  const h = cell / 2;
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    if (!grid.has(i, j)) continue;
    const cx = x0 + (i + 0.5) * cell, cz = z0 + (j + 0.5) * cell;
    const b = pos.length / 3;
    slot[j * nx + i] = b;
    pos.push(cx - h, 0, cz - h,  cx + h, 0, cz - h,  cx + h, 0, cz + h,  cx - h, 0, cz + h);
    idx.push(b, b + 2, b + 1, b, b + 3, b + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
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
  mesh.userData.heatSlot = slot;         // 칸 → 정점 첫 번호
  mesh.userData.heatDims = { nx, nz };
  return mesh;
}

/* 값으로 칸을 칠한다.
     opt.max / opt.min  색의 양 끝. 안 주면 격자 자신의 max/min 을 쓴다(= 상대 밝기).
   ★ 색은 **상대**고 숫자는 **절대**다. 그래서 화면에 「빨강 = 얼마」를 같이 적어야 한다 —
     그건 light_grid_labels 의 머리글이 한다. */
export function updateCellHeatmap(mesh, grid, opt = {}) {
  const slot = mesh.userData.heatSlot;
  const d = mesh.userData.heatDims;
  if (!slot || !d || d.nx !== grid.nx || d.nz !== grid.nz)
    throw new Error('[히트맵] 판과 격자의 칸 수가 다릅니다 — 방이 바뀌었으면 다시 지어야 합니다');
  const colr = mesh.geometry.attributes.color;
  const hi = opt.max ?? grid.max, lo = opt.min ?? grid.min;
  const denom = (hi - lo) > 1e-9 ? (hi - lo) : 1;
  for (let i = 0; i < grid.nx; i++) for (let j = 0; j < grid.nz; j++) {
    const b = slot[j * grid.nx + i];
    if (b < 0) continue;
    const [r, g, bl] = colormap((grid.value(i, j) - lo) / denom);
    for (let k = 0; k < 4; k++) colr.setXYZ(b + k, r, g, bl);
  }
  colr.needsUpdate = true;
  return mesh;
}

/* 색 눈금 — 화면 머리글이 「빨강이 무엇인가」를 말할 때 쓴다. t∈[0,1] → '#rrggbb' */
export function heatColorHex(t) {
  const [r, g, b] = colormap(t);
  const h = v => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}
