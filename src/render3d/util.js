/* ============================================================
   render3d/util.js — 3D 공용 헬퍼
   THREE는 index.html에서 <script>로 로드된 전역(r128)을 사용.
============================================================ */

import { markShadow, SHADOW_ROLE } from './shadow_policy.js';

// hex → [r,g,b] (0~255)
export function hx(h){ h=h.replace('#',''); return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]; }
// 두 [r,g,b] 선형보간
export function mix(a,b,t){ return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t]; }
// hex 문자열 또는 [r,g,b] → THREE.Color
export function col(c){ return Array.isArray(c) ? new THREE.Color(c[0]/255,c[1]/255,c[2]/255) : new THREE.Color(c); }

// 표준 재질 (텍스처 있으면 색은 흰색으로)
export function mat(hex, rough=0.85, tex){
  const o={ color:col(hex), roughness:rough, metalness:0.0 };
  if(tex){ o.map=tex; o.color=col('#ffffff'); }
  return new THREE.MeshStandardMaterial(o);
}
// 박스 메시 (그림자 on)
export function box(w,h,d,m,x,y,z,shadow=true){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);
  mesh.position.set(x,y,z);
  /* ★ castShadow 를 직접 켜지 않는다 — 정책 루프(applyShadowPolicy)가 유일한 주체다.
     여기서 켜면 정책이 그 뒤에 안 돌 때 그대로 샌다(창틀이 실제로 그랬다).
     shadow=false 는 '빛을 막지 않는 것'(러그·유리)이라는 뜻이다. */
  markShadow(mesh, shadow ? SHADOW_ROLE.BLOCK : SHADOW_ROLE.CLEAR);
  return mesh;
}
