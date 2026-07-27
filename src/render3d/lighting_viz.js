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
