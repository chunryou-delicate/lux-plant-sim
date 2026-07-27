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
/* shadow 인자는 '그림자 렌더를 생략한다'는 옛 성능 힌트다. **빛을 안 막는다는 뜻이 아니다.**
   ★ 한 번 혼동해서 사고가 났다 — 바닥·천장·걸레받이가 box(...,false) 로 만들어지는데
     그걸 transparent 로 매핑했더니 천장이 빛을 안 막아 해가 위에서 그냥 들어왔다.
     빛을 안 막는 건 유리뿐이고, 그건 호출부에서 명시적으로 CLEAR 를 붙인다. */
export function box(w,h,d,m,x,y,z,shadow=true){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);
  mesh.position.set(x,y,z);
  /* castShadow 는 건드리지 않는다 — 정책 루프(applyShadowPolicy)가 유일한 주체다. */
  markShadow(mesh, SHADOW_ROLE.BLOCK);
  return mesh;
}
