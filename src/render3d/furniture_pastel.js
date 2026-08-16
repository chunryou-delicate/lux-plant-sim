/* ============================================================
   render3d/furniture_pastel.js — 파스텔 저폴리 가구 (코드 생성)
   ------------------------------------------------------------
   A 미니멀 원칙: 매끈 무광 파스텔, 모서리만 살짝 둥글게, 텍스처 없음.
   온기·분위기는 런타임 빛이 만든다(가구에 굽지 않음).

   모든 가구는 "바닥 y=0에 앉은" 상태로 원점(발밑 중심) 기준 생성.
   userData.size = {w,h,d} 로 실제 치수 보존 → 배치·충돌·조도에 활용.

   사용: buildFurniture('bed_single', { color:'#e8d5c4' })
============================================================ */
import { markShadow, SHADOW_ROLE } from './shadow_policy.js';

import { col } from './util.js';

/* ---- 재질 캐시 (색+광택 조합당 1개) ---- */
const _matCache={};
export function furnMat(hex, gloss='matte'){
  const key=hex+'|'+gloss;
  if(!_matCache[key]){
    const g={ matte:{r:0.92,m:0}, satin:{r:0.55,m:0}, gloss:{r:0.22,m:0.05} }[gloss]||{r:0.92,m:0};
    // ★ r128은 hex를 sRGB로 해석하지 않는다. outputEncoding=sRGB와 맞추려면
    //   재질 색을 선형으로 변환해야 지정한 색 그대로 보인다(안 하면 전부 하얗게 뜸).
    const c=col(hex); if(c.convertSRGBToLinear) c.convertSRGBToLinear();
    const m=new THREE.MeshStandardMaterial({ color:c, roughness:g.r, metalness:g.m });
    m.envMapIntensity=0.25;
    _matCache[key]=m;
  }
  return _matCache[key];
}

/* ---- 모서리 둥근 박스(저폴리 소프트) ---- */
function soft(w,h,d,m,r=0.03){
  r=Math.min(r, w/2-0.001, h/2-0.001);
  const s=new THREE.Shape(), x=-w/2, y=-h/2;
  s.moveTo(x+r,y); s.lineTo(x+w-r,y); s.quadraticCurveTo(x+w,y,x+w,y+r);
  s.lineTo(x+w,y+h-r); s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  s.lineTo(x+r,y+h); s.quadraticCurveTo(x,y+h,x,y+h-r);
  s.lineTo(x,y+r); s.quadraticCurveTo(x,y,x+r,y);
  const geo=new THREE.ExtrudeGeometry(s,{ depth:d, bevelEnabled:false, curveSegments:3 });
  geo.translate(0,0,-d/2);
  const mesh=new THREE.Mesh(geo,m); return mesh;
}
/* 각진 박스(빠름) */
function bx(w,h,d,m,x=0,y=0,z=0){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);
  mesh.position.set(x,y,z); return mesh;
}
function cyl(rt,rb,h,m,x=0,y=0,z=0,seg=14){
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,seg),m);
  mesh.position.set(x,y,z); return mesh;
}
/* 가로놓인 소프트 박스(폭w×높이h×깊이d를 XY평면 라운드 후 Z압출) */
function panel(w,h,d,m,x=0,y=0,z=0,r=0.03){
  const p=soft(w,h,d,m,r); p.position.set(x,y,z); return p;
}
/* 다리 4개 */
function legs4(g,w,d,lh,m,r=0.028,inset=0.07){
  const px=w/2-inset, pz=d/2-inset;
  for(const sx of [-1,1]) for(const sz of [-1,1])
    g.add(cyl(r,r*0.9,lh,m, sx*px, lh/2, sz*pz, 8));
}

/* ============================================================
   ★ 화분 슬롯 규격 (에셋창 GLB 선반과 동일 스키마)
   userData.slots        = [{x,y,z}]  가구 로컬 좌표(m). y = 화분 밑면이 놓일 높이
   userData.tier_heights = [y,...]    단 높이 → 조도 계산 입력
   userData.size_m       = {w,d,h}
   화분 놓는 법: 화분 바운딩박스 y_min 을 슬롯 y에 정렬, x·z는 그대로.
============================================================ */
function addSlots(g, slots, tiers, tierDepths){
  g.userData.slots=slots;
  if(tiers) g.userData.tier_heights=tiers;
  const s=g.userData.size||{};
  g.userData.size_m={ w:s.w, d:s.d, h:s.h };
  // ★ 단별 판 깊이 + 올릴 수 있는 최대 화분 지름 (에셋창 규격: 깊이-0.03)
  const depths = tierDepths || (tiers||[]).map(()=>s.d);
  if(depths.length){
    g.userData.tier_depths_m  = depths.map(d=>+(+d).toFixed(3));
    g.userData.tier_max_pot_d = depths.map(d=>+(d-0.03).toFixed(2));
  }
  return g;
}
/* ============================================================
   ★★ 상판의 «칸» — 추천 자리는 칸 한가운데에 앉는다 (2026-08-15)
   ------------------------------------------------------------
   ── 무엇이 문제였나 ──────────────────────────────────────────
   `tierSlots` 는 상판 가장자리에서 **0.09m** 떨어진 곳에 자리를 냈다. 상수 하나였다.
   상판 길이도, 올릴 화분 지름도 안 봤다. 그래서 두 가지가 같이 틀어졌다:

     ① 화면이 그리는 «칸»(room_view §guideCells)과 **우연히만** 겹쳤다.
        책상 자리는 칸 한가운데에서 0.0671m 어긋나 있었는데, 그 값은
        `SLOT_GOVERN_R` 0.04 보다 커서 **네모를 겨눠도 자리로 안 붙는 거리**다.
     ② 0.09 는 콩나물 시루 반지름 0.12 **보다 작다.** 그래서 가장자리 자리에
        시루를 올리면 상판 밖으로 정확히 3cm 나갔다 — 14칸 중 10칸이 그랬다.

   ── 어떻게 고쳤나 ────────────────────────────────────────────
   가장자리 여백을 상수로 두지 않고 **칸 반쪽**으로 잡는다. 곧, 상판을 칸으로
   나눈 뒤 **칸 한가운데**에 자리를 낸다. 칸 크기가 늘 화분 지름 이상이므로
   (아래 `topAxis` 의 floor 항) ②도 같이 사라진다 — 자리에 놓은 시루가 상판 밖으로
   못 나간다.

   ── ⚠ 기준 화분은 **콩나물 시루 0.24m** 다 ────────────────────
   칸 격자는 **끌고 있는 물건마다 달라진다.** 서랍장(0.90)은 시루면 3칸(0.30),
   몬스테라(0.202)면 4칸(0.225)이고 두 격자의 한가운데는 **교집합이 없다.**
   자리는 상수 하나라 둘 다에 맞출 수 없다. 시루 쪽으로 정한다 —
   반지하의 어두운 자리(서랍장·선반)가 실제로 **콩나물 자리**로 쓰이기 때문이다
   (`house_rooms.json` §darkest_slot 이 `banjiha-dresser:1` 에 열린 시루 0.24 를 앉힌다).

   ⚠⚠ 이 셈은 `game/room_view.js` 의 `surfaceAxis` 와 **같아야 한다.** 지금은 두 벌이다
      (render3d 가 game 을 import 하면 층이 뒤집힌다). 한쪽만 고치면 자리와 칸이 다시
      갈린다 — 고칠 때 **둘 다** 고쳐라. 갈렸는지는 `guideCells().snapErr` 과
      「자리↔칸 한가운데 거리」로 잰다. */
const TOP_CELL_M = 0.25;      // 화면에 그리는 칸(place.GRID_CELL)과 같은 눈금
const SLOT_REF_POT_D = 0.24;  // 기준 화분 = 열린 콩나물 시루

/* 길이 len 인 면을 칸으로 나눈다 — room_view.surfaceAxis(len, 0.24) 와 같은 셈이다 */
function topAxis(len){
  const L = (Number.isFinite(len) && len>0) ? len : TOP_CELL_M;
  const n = Math.max(1, Math.min(Math.round(L/TOP_CELL_M),
                                 Math.max(1, Math.floor(L/SLOT_REF_POT_D + 1e-9))));
  return { n, cell: L/n, at: i => (i+0.5)*(L/n) - L/2 };
}
/* 면의 **앞줄 칸 한가운데** — 깊이(z)를 칸에 맞출 때 쓴다 */
function frontCellZ(d){ const A = topAxis(d); return +A.at(A.n-1).toFixed(3); }

/* 한 단(y)에 n개 슬롯을 폭 w 안에 배치한다.
   margin 을 안 주면 **칸 한가운데**에 앉힌다(위 머리말). 첫 칸부터 마지막 칸까지
   고르게 골라 쓴다 — 자리가 2개면 양끝 칸, 3개면 양끝과 가운데다.
   ⚠ margin 을 명시하면 예전 셈(균등 배치) 그대로다. 칸보다 촘촘히 놓아야 하는
     가구(창턱 확장 선반 4칸 등)가 그것을 쓴다. */
function tierSlots(w, y, n, z=0, margin=null){
  const out=[];
  const A = topAxis(w);
  /* n===1 은 예전대로 한가운데다. 칸이 홀수면 그것이 곧 칸 한가운데고,
     짝수면 칸 경계인데 — 걸음(0.125)이 칸의 절반이라 경계도 앉을 수 있는 자리다.
     여기서 한쪽 칸으로 밀면 창턱 받침 같은 「한가운데가 뜻인」 자리가 틀어진다. */
  if(margin==null && n>1 && A.n>=n){
    for(let i=0;i<n;i++) out.push({ x:+A.at(Math.round(i*(A.n-1)/(n-1))).toFixed(3), y:+y.toFixed(3), z });
    return out;
  }
  /* 자리가 칸보다 많을 때(상판이 좁아 시루 n개가 나란히 못 앉는다) — 칸 한가운데라는 말이
     성립하지 않으므로 예전처럼 고르게 편다.
     ⚠ 여백을 그냥 `A.cell/2` 로 두면 **자리들이 한 점에 겹친다** — 카트 선반(폭 0.46)이
       칸 1개라 여백 0.23 이 되어 2자리가 x=0 에 포개졌다(재서 확인하고 고쳤다).
       그래서 여백을 **시루 반지름**으로 막는다. 그러면 겹치지도 않고, 자리에 놓은 시루가
       상판 밖으로 나가지도 않는다(가장자리에 딱 맞게 선다). */
  const m = (margin==null) ? Math.min(A.cell/2, SLOT_REF_POT_D/2) : margin;
  const usable=Math.max(0, w-m*2);
  for(let i=0;i<n;i++) out.push({ x:+(-usable/2+usable*(n===1?0.5:i/(n-1))).toFixed(3), y:+y.toFixed(3), z });
  return out;
}

/* ============================================================
   가구 빌더 — 각 함수는 바닥 기준 Group 반환
   o = { color, accent, gloss, w,h,d (선택 오버라이드) }
============================================================ */
const B={};

/* 침대 (싱글/더블). 프레임+매트리스+이불+베개 */
B.bed=(o)=>{
  const w=o.w??1.1, d=o.d??2.0, fh=0.26, mh=0.18;
  const g=new THREE.Group();
  const fr=furnMat(o.color??'#d9c3a9','matte');      // 프레임(우드)
  const sh=furnMat(o.accent??'#eef1f4','matte');     // 침구
  g.add(panel(w,fh,d,fr,0,fh/2,0,0.04));             // 프레임
  g.add(panel(w-0.08,mh,d-0.08,furnMat('#f6f5f2'),0,fh+mh/2,0,0.05));  // 매트리스
  g.add(panel(w-0.06,0.10,d*0.62,sh,0,fh+mh+0.04,d*0.16,0.05));        // 이불
  const pw=(w>1.4)?w*0.42:w*0.62;                    // 베개(더블이면 2개)
  if(w>1.4){ g.add(panel(pw,0.11,0.34,furnMat('#ffffff'),-w*0.22,fh+mh+0.05,-d*0.36,0.05));
             g.add(panel(pw,0.11,0.34,furnMat('#ffffff'), w*0.22,fh+mh+0.05,-d*0.36,0.05)); }
  else       g.add(panel(pw,0.11,0.34,furnMat('#ffffff'),0,fh+mh+0.05,-d*0.36,0.05));
  g.add(panel(w,0.44,0.07,fr,0,0.44/2+fh*0.55,-d/2+0.03,0.04));        // 헤드보드
  g.userData.size={w,h:fh+mh+0.5,d};
  return g;
};

/* 책상 */
B.desk=(o)=>{
  const w=o.w??1.2, d=o.d??0.6, h=o.h??0.74, t=0.05;
  const g=new THREE.Group();
  const m=furnMat(o.color??'#e3d3bd','matte');
  g.add(panel(w,t,d,m,0,h-t/2,0,0.02));
  legs4(g,w,d,h-t,furnMat(o.accent??'#cbbfae','satin'),0.026,0.06);
  g.userData.size={w,h,d};
  /* ★ 깊이도 칸에 맞춘다 — 예전 `d*0.15`(0.6 짜리면 0.09)는 앞줄 칸 한가운데 0.15 에서
     0.06 어긋나 있었다. 가로 0.03 과 합쳐 0.0671 이 그 어긋남의 전부였다. */
  return addSlots(g, tierSlots(w, h, w>1.4?3:2, frontCellZ(d)), [h]);   // 책상 위 화분 자리
};

/* 의자 */
B.chair=(o)=>{
  const w=o.w??0.44, d=o.d??0.44, sh=0.44;
  const g=new THREE.Group();
  const m=furnMat(o.color??'#cfd8dc','matte');
  g.add(panel(w,0.05,d,m,0,sh,0,0.03));
  g.add(panel(w,0.42,0.05,m,0,sh+0.22,-d/2+0.03,0.03));
  legs4(g,w,d,sh,furnMat(o.accent??'#b9c2c7','satin'),0.02,0.05);
  g.userData.size={w,h:sh+0.45,d}; return g;
};

/* 옷장 */
B.wardrobe=(o)=>{
  const w=o.w??1.0, d=o.d??0.58, h=o.h??1.9;
  const g=new THREE.Group();
  const m=furnMat(o.color??'#eae2d6','matte');
  g.add(panel(w,h,d,m,0,h/2,0,0.03));
  const line=furnMat('#cfc4b4','satin');
  g.add(bx(0.012,h-0.12,0.01,line,0,h/2,d/2+0.005));                 // 가운데 문틈
  for(const s of [-1,1]){                                            // 세로 손잡이
    const kn=cyl(0.014,0.014,0.16,furnMat(o.accent??'#c8b18a','gloss'),s*0.05,h*0.52,d/2+0.02,8);
    g.add(kn);
  }
  g.userData.size={w,h,d}; return g;
};

/* 서랍장 */
B.dresser=(o)=>{
  const w=o.w??0.9, d=o.d??0.45, h=o.h??0.8, n=3;
  const g=new THREE.Group();
  const m=furnMat(o.color??'#e6dccd','matte');
  g.add(panel(w,h,d,m,0,h/2,0,0.03));
  for(let i=0;i<n;i++){
    const y=h*(i+0.5)/n;
    g.add(bx(w-0.09,0.014,0.008,furnMat('#cdbfab','satin'),0,y+h/(2*n)-0.02,d/2+0.005));
    const knob=cyl(0.045,0.045,0.02,furnMat(o.accent??'#c8b18a','gloss'),0,y,d/2+0.015,10);
    knob.rotation.x=Math.PI/2;                       // 원판 손잡이(문짝을 향하게)
    g.add(knob);
  }
  g.userData.size={w,h,d};
  /* ★★ 2026-08-16 — **깊이도 칸에 맞춘다** (B-1 · 박사님: *"책상 서랍장 위 2곳씩 남아있는거 버그"*)
     ------------------------------------------------------------
     2026-08-15 에 가로(x)는 칸 한가운데로 옮겼는데 **깊이(z)는 0 인 채로 뒀다.**
     서랍장 상판은 0.50m 라 칸이 둘(±0.125)이고, z=0 은 **그 둘의 경계**다.
     그래서 상판에 4×2=8칸이 깔리고 그 위에 추천 자리 2개가 **줄 사이에 걸쳐** 얹혀
     「2곳이 남는」 그림이 됐다(실측: 칸 한가운데에서 0.125m 어긋남).
     책상은 같은 날 `frontCellZ(d)` 로 고쳤는데 서랍장만 안 따라왔다. 같은 자를 쓴다.
     ⚠ 자리의 **월드 좌표가 움직인다** → 밝기도 움직인다. 전·후 표는
       docs/handoff/place-to-plan.md §B-1 에 실었다. */
  return addSlots(g, tierSlots(w, h, 2, frontCellZ(d)), [h]);
};

/* 책장 (오픈 선반) */
B.shelf=(o)=>{
  const w=o.w??0.8, d=o.d??0.3, h=o.h??1.5, n=o.rows??4, t=0.035;
  const g=new THREE.Group();
  const m=furnMat(o.color??'#e8dfd2','matte');
  g.add(bx(t,h,d,m,-w/2+t/2,h/2,0)); g.add(bx(t,h,d,m,w/2-t/2,h/2,0));  // 측판
  g.add(bx(w,t,d,m,0,h-t/2,0)); g.add(bx(w,t,d,m,0,t/2,0));             // 상하판
  g.add(bx(w-2*t,t*0.7,d,m,0,h/2,-d/2+t/2));                            // 뒷판 살짝
  for(let i=1;i<n;i++) g.add(bx(w-2*t,t,d,m,0,h*i/n,0));                // 선반
  // 책 몇 권(파스텔)
  const bookCols=['#d8a7a0','#a9c4d4','#d9c98a','#b3cbb0','#c8b4d4'];
  for(let i=0;i<n;i++){
    let x=-w/2+t+0.04;
    while(x<w/2-t-0.08 && Math.random()<0.82){
      const bw=0.03+Math.random()*0.035, bh=0.16+Math.random()*0.09;
      g.add(bx(bw,bh,d*0.62,furnMat(bookCols[(Math.random()*5)|0],'matte'),x+bw/2,h*i/n+t/2+bh/2,0));
      x+=bw+0.006;
    }
  }
  g.userData.size={w,h,d};
  const tiers=[], sl=[];
  for(let i=0;i<n;i++){ const y=h*i/n+t/2; tiers.push(+y.toFixed(3)); sl.push(...tierSlots(w-2*t, y, w>0.9?3:2)); }
  return addSlots(g, sl, tiers);
};

/* 소파 (2인) */
B.sofa=(o)=>{
  const w=o.w??1.6, d=o.d??0.82, sh=0.38;
  const g=new THREE.Group();
  const m=furnMat(o.color??'#c9d6d2','matte');
  g.add(panel(w,0.22,d,m,0,sh,0,0.06));                       // 좌판
  g.add(panel(w,0.5,0.2,m,0,sh+0.22,-d/2+0.1,0.06));          // 등받이
  for(const s of [-1,1]) g.add(panel(0.18,0.34,d,m,s*(w/2-0.09),sh+0.08,0,0.06));  // 팔걸이
  const cu=furnMat(o.accent??'#eef2f0','matte');
  g.add(panel(w*0.42,0.1,d*0.6,cu,-w*0.2,sh+0.15,0.04,0.05)); // 쿠션
  g.add(panel(w*0.42,0.1,d*0.6,cu, w*0.2,sh+0.15,0.04,0.05));
  legs4(g,w-0.2,d-0.2,sh-0.22,furnMat('#c3b49c','satin'),0.022,0.04);
  g.userData.size={w,h:sh+0.72,d}; return g;
};

/* 원형 테이블 */
B.table_round=(o)=>{
  const r=(o.w??0.8)/2, h=o.h??0.45;
  const g=new THREE.Group();
  const m=furnMat(o.color??'#e5d3b8','matte');
  g.add(cyl(r,r,0.05,m,0,h-0.025,0,24));
  g.add(cyl(0.05,0.06,h-0.05,furnMat(o.accent??'#cbbba2','satin'),0,(h-0.05)/2,0,12));
  g.add(cyl(0.22,0.24,0.03,furnMat(o.accent??'#cbbba2','satin'),0,0.015,0,16));
  g.userData.size={w:r*2,h,d:r*2};
  return addSlots(g, [{x:0,y:+h.toFixed(3),z:0}], [h]);
};

/* 사각 테이블/식탁 */
B.table=(o)=>{
  const w=o.w??1.2, d=o.d??0.7, h=o.h??0.72;
  const g=new THREE.Group();
  const m=furnMat(o.color??'#e5d3b8','matte');
  g.add(panel(w,0.05,d,m,0,h-0.025,0,0.02));
  legs4(g,w,d,h-0.05,furnMat(o.accent??'#cbbba2','satin'),0.028,0.07);
  g.userData.size={w,h,d};
  return addSlots(g, tierSlots(w, h, 2), [h]);
};

/* 협탁 */
B.nightstand=(o)=>{
  const w=o.w??0.42, d=o.d??0.36, h=o.h??0.48;
  const g=new THREE.Group();
  const m=furnMat(o.color??'#e6dccd','matte');
  g.add(panel(w,h*0.72,d,m,0,h*0.64,0,0.03));
  const kn=cyl(0.035,0.035,0.018,furnMat(o.accent??'#c8b18a','gloss'),0,h*0.64,d/2+0.012,10);
  kn.rotation.x=Math.PI/2; g.add(kn);
  legs4(g,w,d,h*0.28,furnMat('#cbbba2','satin'),0.018,0.045);
  g.userData.size={w,h,d};
  return addSlots(g, tierSlots(w, h, 1), [h]);
};

/* 러그 */
B.rug=(o)=>{
  const w=o.w??1.8, d=o.d??1.3;
  const g=new THREE.Group();
  const m=furnMat(o.color??'#e7ddd0','matte');
  const r=soft(w,d,0.012,m,0.12); r.rotation.x=-Math.PI/2; r.position.y=0.006;
  r.userData.noShadow=true; r.receiveShadow=true; g.add(r);   // 바닥 깔개 → 그림자 제외
  if(o.accent){                                        // 테두리 라인
    const b=soft(w-0.16,d-0.16,0.014,furnMat(o.accent,'matte'),0.1);
    b.rotation.x=-Math.PI/2; b.position.y=0.009; b.userData.noShadow=true; g.add(b);
  }
  g.userData.size={w,h:0.012,d}; return g;
};

/* 화분 (h = 화분 자체 높이, 식물 포함 총높이는 약 2.2배) */
B.pot=(o)=>{
  const ph=o.h??0.3, pr=ph*0.42;
  const g=new THREE.Group();
  g.add(cyl(pr,pr*0.78,ph,furnMat(o.color??'#d9a88b','matte'),0,ph/2,0,18));
  g.add(cyl(pr*0.95,pr*0.95,ph*0.06,furnMat('#4a3a2c','matte'),0,ph*1.0,0,18));
  const lm=furnMat(o.accent??'#7fae74','matte');
  for(let i=0;i<5;i++){                                 // 잎 뭉치(저폴리)
    const a=i/5*Math.PI*2, rr=pr*(0.5+Math.random()*0.5);
    const leaf=new THREE.Mesh(new THREE.SphereGeometry(ph*(0.28+Math.random()*0.16),8,6),lm);
    leaf.position.set(Math.cos(a)*rr*0.7, ph*(1.15+Math.random()*0.5), Math.sin(a)*rr*0.7);
    leaf.scale.y=0.78; g.add(leaf);
  }
  g.userData.size={w:pr*2,h:ph*2.1,d:pr*2}; return g;
};

/* 스탠드 조명 (플로어) */
B.lamp_floor=(o)=>{
  const h=o.h??1.45;
  const g=new THREE.Group();
  const m=furnMat(o.color??'#cfc7bb','satin');
  g.add(cyl(0.16,0.18,0.03,m,0,0.015,0,18));
  g.add(cyl(0.018,0.018,h-0.2,m,0,(h-0.2)/2,0,10));
  const shade=new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.21,0.24,18,1,true),
    new THREE.MeshStandardMaterial({ color:col(o.accent??'#f6efdc'), roughness:0.65,
      side:THREE.DoubleSide, emissive:col('#3a2f18'), emissiveIntensity:0.15 }));
  shade.position.y=h-0.12; g.add(shade);
  g.userData.size={w:0.42,h,d:0.42}; g.userData.lampShade=shade; return g;
};

/* 천장등 (ceilY 아래로 매달림) */
B.lamp_ceiling=(o)=>{
  const drop=o.h??0.35;
  const g=new THREE.Group();
  const m=furnMat(o.color??'#cfc7bb','satin');
  g.add(cyl(0.05,0.05,0.02,m,0,-0.01,0,12));
  g.add(cyl(0.008,0.008,drop,m,0,-drop/2,0,8));
  const shade=new THREE.Mesh(new THREE.ConeGeometry(0.22,0.2,20,1,true),
    new THREE.MeshStandardMaterial({ color:col(o.accent??'#f6efdc'), roughness:0.6,
      side:THREE.DoubleSide, emissive:col('#3a2f18'), emissiveIntensity:0.2 }));
  shade.position.y=-drop-0.08; g.add(shade);
  g.userData.size={w:0.44,h:drop+0.2,d:0.44}; g.userData.lampShade=shade;
  g.userData.hangFromCeiling=true; return g;
};

/* 냉장고 */
B.fridge=(o)=>{
  const w=o.w??0.6, d=o.d??0.62, h=o.h??1.6;
  const g=new THREE.Group();
  const m=furnMat(o.color??'#eef0f2','satin');
  g.add(panel(w,h,d,m,0,h/2,0,0.035));
  g.add(bx(w-0.05,0.012,0.008,furnMat('#d3d7db','satin'),0,h*0.62,d/2+0.004));
  for(const y of [h*0.72,h*0.34]) g.add(bx(0.028,0.24,0.03,furnMat(o.accent??'#c2c8cd','gloss'),w/2-0.09,y,d/2+0.02));
  g.userData.size={w,h,d}; return g;
};

/* 주방 카운터(싱크) */
B.kitchen=(o)=>{
  const w=o.w??1.5, d=o.d??0.6, h=o.h??0.88;
  const g=new THREE.Group();
  const body=furnMat(o.color??'#e9e3d8','matte');
  const top=furnMat(o.accent??'#d5d8da','satin');
  g.add(panel(w,h-0.05,d,body,0,(h-0.05)/2,0,0.02));
  g.add(panel(w+0.03,0.05,d+0.03,top,0,h-0.025,0,0.02));
  g.add(bx(w*0.34,0.02,d*0.5,furnMat('#c9ced1','gloss'),-w*0.22,h-0.04,0));  // 싱크볼
  g.add(cyl(0.014,0.014,0.22,furnMat('#b9bfc4','gloss'),-w*0.22,h+0.11,-d*0.2,8));
  for(let i=0;i<3;i++) g.add(bx(w/3-0.04,0.012,0.008,furnMat('#cfc7ba','satin'),-w/3+i*w/3,h*0.52,d/2+0.004));
  g.userData.size={w,h,d}; return g;
};

/* TV / 모니터 */
B.tv=(o)=>{
  const w=o.w??1.0, h=o.h??0.58;
  const g=new THREE.Group();
  const fr=furnMat(o.color??'#3c4046','satin');
  g.add(panel(w,h,0.05,fr,0,h/2+0.06,0,0.02));
  const screen=new THREE.Mesh(new THREE.PlaneGeometry(w-0.05,h-0.05),
    new THREE.MeshStandardMaterial({ color:col('#2a3138'), roughness:0.25 }));
  screen.position.set(0,h/2+0.06,0.028); g.add(screen);
  g.add(cyl(0.02,0.02,0.06,fr,0,0.03,0,8));
  g.add(bx(w*0.4,0.02,0.18,fr,0,0.01,0));
  g.userData.size={w,h:h+0.1,d:0.2}; return g;
};

/* ============================================================
   ★ 식물용 선반 5종 (에셋창 GLB 규격을 코드로 이식 — 슬롯·단높이 포함)
============================================================ */

/* 창턱 확장 선반 (창 아래 벽에 붙임. mount:'window') */
B.shelf_windowsill=(o)=>{
  const w=o.w??1.0, d=o.d??0.16, t=0.03;
  const g=new THREE.Group();
  const m=furnMat(o.color??'#eae2d6','matte');
  g.add(panel(w,t,d,m,0,t/2,0,0.012));
  for(const s of [-1,1]) g.add(bx(0.03,0.10,0.03,m,s*(w/2-0.09),-0.05,d*0.2));  // 브래킷
  g.userData.size={w,h:t,d}; g.userData.mount='window';
  return addSlots(g, tierSlots(w, t, 4, 0, 0.11), [t]);
};

/* 벽걸이 1단 선반 (mount:'wall' — 높이는 배치 시 y로) */
B.shelf_wall=(o)=>{
  const w=o.w??0.8, d=o.d??0.22, t=0.035;
  const g=new THREE.Group();
  const m=furnMat(o.color??'#e8dfd2','matte');
  g.add(panel(w,t,d,m,0,t/2,0,0.014));
  for(const s of [-1,1]){                                   // 삼각 브래킷
    const br=bx(0.028,0.11,d*0.8,furnMat(o.accent??'#cbbfae','satin'),s*(w/2-0.1),-0.055,-d*0.05);
    g.add(br);
  }
  g.userData.size={w,h:t,d}; g.userData.mount='wall';
  /* slots 옵션 — 기본 3은 그대로다(기존 프리셋 영향 없음).
     반지하 창턱처럼 "1칸만" 이 의도인 자리에서 1로 준다. */
  return addSlots(g, tierSlots(w, t, o.slots ?? 3), [t]);
};

/* 스툴 1단 (작은 화분 받침) */
B.shelf_stool=(o)=>{
  const w=o.w??0.28, d=o.d??0.28, h=o.h??0.355, t=0.03;
  const g=new THREE.Group();
  const m=furnMat(o.color??'#e3d3bd','matte');
  g.add(panel(w,t,d,m,0,h-t/2,0,0.02));
  legs4(g,w,d,h-t,furnMat(o.accent??'#cbbfae','satin'),0.018,0.04);
  g.userData.size={w,h,d};
  return addSlots(g, [{x:0,y:+h.toFixed(3),z:0}], [h]);
};

/* 다단 선반 / 사다리형
   ★ 사다리는 기둥이 뒤로 기울므로, 각 단의 z를 기둥 선을 따라가게 계산해
     선반과 지지대가 정확히 붙게 한다(떠 보이지 않게). */
B.shelf_etagere=(o)=>{
  const w=o.w??0.72, d=o.d??0.28, h=o.h??0.794, n=o.tiers??3, t=0.03;
  const ladder=!!o.ladder;
  const g=new THREE.Group();
  const m=furnMat(o.color??'#e8dfd2','matte');
  const side=furnMat(o.accent??'#cbbfae','satin');
  const tiers=[], sl=[];

  // 기둥 기하: 바닥 z0(앞) → 꼭대기 z1(뒤). 사다리면 뒤로 기울어짐.
  const z0 = ladder ?  d*0.42 : 0;
  const z1 = ladder ? -d*0.42 : 0;
  const postZ = y => z0 + (z1-z0)*(y/h);                     // 높이 y에서 기둥의 z
  const postX = w/2-0.03;

  const depths=[];
  for(let i=0;i<n;i++){
    const y=t/2+(h-t)*(n===1?0:i/(n-1));
    const sw=ladder ? w*(1-0.10*i) : w;                      // 위로 갈수록 살짝 좁게
    // 사다리 단 깊이 0.30→0.15 (에셋창 규격). 최상단이 얕아 큰 화분은 못 올림.
    const sd=ladder ? Math.max(0.15, 0.30-0.05*i) : d;
    depths.push(sd);
    // 선반 뒤 모서리를 기둥에 붙임 → 중심 z = 기둥z + 깊이/2
    const cz = ladder ? postZ(y)+sd/2-0.012 : 0;
    g.add(panel(sw,t,sd,m,0,y,cz,0.014));
    tiers.push(+y.toFixed(3));
    // 사다리 슬롯: 3/2/1/1 = 총 7 (에셋창과 합의된 수)
    const nslot = ladder ? [3,2,1,1][Math.min(i,3)] : 3;
    sl.push(...tierSlots(sw, y+t/2, nslot, +cz.toFixed(3)));
  }
  // 기둥 — 기울기만큼 길게 + 각도 맞춰 회전(선반 옆면에 딱 닿음)
  const dz=z1-z0, plen=Math.hypot(h,dz), ang=Math.atan2(dz,h);
  for(const sx of [-1,1]){
    if(ladder){
      const post=cyl(0.016,0.016,plen,side, sx*postX, h/2, (z0+z1)/2, 8);
      // ★ rotation.x가 양수면 위쪽이 +Z로 감. 기둥 꼭대기는 z1(뒤, -Z)이어야 하므로
      //   부호를 뒤집지 않고 ang 그대로 써야 선반 기울기와 방향이 맞는다.
      post.rotation.x=ang;
      g.add(post);
    }else{
      for(const sz of [-1,1]) g.add(cyl(0.017,0.017,h,side, sx*postX, h/2, sz*(d/2-0.03), 8));
    }
  }
  g.userData.size={w,h,d}; if(ladder) g.userData.mount='lean-wall';
  return addSlots(g, sl, tiers, depths);
};

/* 이동식 카트 (바퀴) */
B.shelf_cart=(o)=>{
  const w=o.w??0.46, d=o.d??0.34, h=o.h??0.82, n=o.tiers??3, t=0.026;
  const g=new THREE.Group();
  const m=furnMat(o.color??'#dfe6e4','satin');
  const side=furnMat(o.accent??'#b9c2c7','satin');
  const tiers=[], sl=[];
  for(let i=0;i<n;i++){
    const y=0.10+(h-0.16)*(i/(n-1));
    g.add(panel(w,t,d,m,0,y,0,0.012));
    for(const s of [-1,1]) g.add(bx(w,0.022,0.014,side,0,y+0.03,s*(d/2-0.007)));   // 난간
    tiers.push(+y.toFixed(3)); sl.push(...tierSlots(w,y+t/2,2));
  }
  for(const sx of [-1,1]) for(const sz of [-1,1]){
    g.add(cyl(0.012,0.012,h-0.08,side, sx*(w/2-0.025), (h-0.08)/2+0.06, sz*(d/2-0.025), 8));
    const wheel=cyl(0.028,0.028,0.016,furnMat('#8f959b','gloss'), sx*(w/2-0.025), 0.028, sz*(d/2-0.025), 10);
    wheel.rotation.z=Math.PI/2; g.add(wheel);
  }
  // 손잡이: 양쪽 기둥에서 올라와 수평봉으로 연결(한쪽만 떠 있지 않게)
  for(const sz of [-1,1]) g.add(cyl(0.012,0.012,0.14,side, w/2-0.025, h+0.05, sz*(d/2-0.025), 8));
  const grip=cyl(0.012,0.012,d-0.05,side, w/2-0.025, h+0.12, 0, 8);
  grip.rotation.x=Math.PI/2; g.add(grip);
  g.userData.size={w,h,d}; g.userData.movable=true;
  return addSlots(g, sl, tiers);
};

/* 그로우랙 — 자체 조명 바 포함 (has_light) */
B.shelf_growrack=(o)=>{
  const w=o.w??0.8, d=o.d??0.35, h=o.h??1.16, n=o.tiers??2, t=0.03;
  const g=new THREE.Group();
  const m=furnMat(o.color??'#dfe3e6','satin');
  const post=furnMat(o.accent??'#aeb6bc','satin');
  const tiers=[], sl=[], bars=[];
  for(let i=0;i<n;i++){
    const y=0.06+(h-0.18)*(i/(n-1||1));
    g.add(panel(w,t,d,m,0,y,0,0.012));
    tiers.push(+y.toFixed(3)); sl.push(...tierSlots(w,y+t/2,3));
    // 그 단 위 조명 바(다음 단 밑면에 매달림)
    const by=y+(h-0.18)/(n-1||1)-0.075;
    if(i<n-1||n===1){
      const bar=new THREE.Mesh(new THREE.BoxGeometry(w*0.86,0.035,0.05),
        new THREE.MeshStandardMaterial({ color:col('#f2ead2'), roughness:0.5,
          emissive:col('#b9a86a'), emissiveIntensity:0.55 }));
      bar.position.set(0,by,0); g.add(bar); bars.push({ y:+by.toFixed(3) });
    }
  }
  for(const sx of [-1,1]) for(const sz of [-1,1])
    g.add(cyl(0.016,0.016,h,post, sx*(w/2-0.025), h/2, sz*(d/2-0.025), 8));
  g.userData.size={w,h,d}; g.userData.has_light=true; g.userData.light_bars=bars;
  return addSlots(g, sl, tiers);
};

/* ============================================================
   확장 — 의자류 / 침대류 / 생활 가구
============================================================ */

/* 팔걸이 의자(암체어) */
B.chair_arm=(o)=>{
  const w=o.w??0.62, d=o.d??0.66, sh=0.38;
  const g=new THREE.Group();
  const m=furnMat(o.color??'#cdd9d5','matte');
  g.add(panel(w,0.18,d,m,0,sh,0,0.05));                                  // 좌판
  g.add(panel(w,0.46,0.16,m,0,sh+0.20,-d/2+0.08,0.05));                  // 등받이
  for(const s of [-1,1]) g.add(panel(0.13,0.26,d*0.8,m,s*(w/2-0.065),sh+0.06,0.02,0.05)); // 팔걸이
  const cu=furnMat(o.accent??'#eef2f0','matte');
  g.add(panel(w-0.2,0.08,d-0.22,cu,0,sh+0.12,0.02,0.04));                // 쿠션
  legs4(g,w-0.16,d-0.18,sh-0.18,furnMat('#c3b49c','satin'),0.021,0.04);
  g.userData.size={w,h:sh+0.66,d}; return g;
};

/* 사무용 의자 (5발 바퀴 + 가스리프트) */
B.chair_office=(o)=>{
  const w=o.w??0.52, d=o.d??0.52, sh=0.46;
  const g=new THREE.Group();
  const m=furnMat(o.color??'#cfd8dc','matte');
  const dark=furnMat(o.accent??'#8f959b','satin');
  g.add(panel(w,0.07,d,m,0,sh,0,0.03));
  const back=panel(w-0.06,0.46,0.06,m,0,sh+0.27,-d/2+0.05,0.04);
  back.rotation.x=-0.10; g.add(back);
  for(const s of [-1,1]) g.add(bx(0.04,0.16,d*0.5,dark,s*(w/2-0.02),sh+0.09,0.02));  // 팔걸이
  g.add(cyl(0.028,0.028,sh-0.10,dark,0,(sh-0.10)/2+0.06,0,10));                      // 기둥
  for(let i=0;i<5;i++){                                                              // 5발
    const a=i/5*Math.PI*2;
    const leg=bx(0.22,0.022,0.035,dark,Math.cos(a)*0.12,0.055,Math.sin(a)*0.12);
    leg.rotation.y=-a; g.add(leg);
    const wh=cyl(0.024,0.024,0.014,furnMat('#6f757b','gloss'),Math.cos(a)*0.22,0.026,Math.sin(a)*0.22,10);
    wh.rotation.z=Math.PI/2; g.add(wh);
  }
  g.userData.size={w,h:sh+0.52,d}; return g;
};

/* 스툴 (등받이 없는 앉는 의자) */
B.stool=(o)=>{
  const w=o.w??0.36, h=o.h??0.45;
  const g=new THREE.Group();
  const m=furnMat(o.color??'#e0d5c2','matte');
  g.add(cyl(w/2,w/2,0.05,m,0,h-0.025,0,20));
  legs4(g,w*0.82,w*0.82,h-0.05,furnMat(o.accent??'#c3b49c','satin'),0.019,0.03);
  g.userData.size={w,h,d:w}; return g;
};

/* 벤치 */
B.bench=(o)=>{
  const w=o.w??1.2, d=o.d??0.38, h=o.h??0.44;
  const g=new THREE.Group();
  const m=furnMat(o.color??'#e0d5c2','matte');
  g.add(panel(w,0.06,d,m,0,h-0.03,0,0.025));
  for(const s of [-1,1]) g.add(bx(0.05,h-0.06,d-0.06,furnMat(o.accent??'#c3b49c','satin'),s*(w/2-0.09),(h-0.06)/2,0));
  g.userData.size={w,h,d};
  return addSlots(g, tierSlots(w,h,2), [h]);
};

/* 이층 침대 */
B.bed_bunk=(o)=>{
  const w=o.w??1.05, d=o.d??2.0, h=o.h??1.68;
  const g=new THREE.Group();
  const fr=furnMat(o.color??'#d9c3a9','matte');
  const sh=furnMat(o.accent??'#dce6ea','matte');
  const deck=(y)=>{
    g.add(panel(w,0.10,d,fr,0,y,0,0.03));
    g.add(panel(w-0.1,0.14,d-0.1,furnMat('#f6f5f2'),0,y+0.12,0,0.05));
    g.add(panel(w-0.08,0.08,d*0.55,sh,0,y+0.22,d*0.17,0.05));
    g.add(panel(w*0.6,0.09,0.32,furnMat('#ffffff'),0,y+0.23,-d*0.36,0.05));
  };
  deck(0.36); deck(h-0.34);
  for(const sx of [-1,1]) for(const sz of [-1,1])
    g.add(bx(0.07,h,0.07,fr, sx*(w/2-0.04), h/2, sz*(d/2-0.04)));
  // 사다리: 세로 기둥 2개 + 가로 발판
  const lz0=d*0.2-0.22, lz1=d*0.2+0.22, ltop=h-0.34;
  for(const lz of [lz0,lz1]) g.add(cyl(0.022,0.022,ltop,fr, w/2-0.04, ltop/2, lz, 8));
  for(let i=0;i<4;i++) g.add(bx(0.05,0.04,0.44,fr, w/2-0.04, 0.42+i*0.28, d*0.2));  // 발판
  g.add(bx(0.05,0.7,0.05,fr,-w/2+0.04,h-0.02,d*0.05));                              // 상단 난간
  g.userData.size={w,h,d}; return g;
};

/* 로프트 침대 (아래 책상 공간) */
B.bed_loft=(o)=>{
  const w=o.w??1.05, d=o.d??2.0, h=o.h??1.6;
  const g=new THREE.Group();
  const fr=furnMat(o.color??'#d9c3a9','matte');
  const sh=furnMat(o.accent??'#dce6ea','matte');
  g.add(panel(w,0.10,d,fr,0,h-0.3,0,0.03));
  g.add(panel(w-0.1,0.14,d-0.1,furnMat('#f6f5f2'),0,h-0.18,0,0.05));
  g.add(panel(w-0.08,0.08,d*0.55,sh,0,h-0.08,d*0.17,0.05));
  for(const sx of [-1,1]) for(const sz of [-1,1])
    g.add(bx(0.07,h,0.07,fr, sx*(w/2-0.04), h/2, sz*(d/2-0.04)));
  g.add(bx(w,0.05,0.05,fr,0,h-0.02,-d/2+0.04));
  // 사다리: 세로 기둥 2개 + 가로 발판
  const lz0=d*0.2-0.22, lz1=d*0.2+0.22, ltop=h-0.28;
  for(const lz of [lz0,lz1]) g.add(cyl(0.022,0.022,ltop,fr, w/2-0.04, ltop/2, lz, 8));
  for(let i=0;i<4;i++) g.add(bx(0.05,0.04,0.44,fr, w/2-0.04, 0.42+i*0.28, d*0.2));
  g.userData.size={w,h,d}; return g;
};

/* 바닥 매트리스 (원룸 미니멀) */
B.mattress=(o)=>{
  const w=o.w??1.05, d=o.d??1.95;
  const g=new THREE.Group();
  g.add(panel(w,0.16,d,furnMat(o.color??'#f2efe9','matte'),0,0.08,0,0.06));
  g.add(panel(w-0.05,0.09,d*0.58,furnMat(o.accent??'#dce6ea','matte'),0,0.19,d*0.16,0.05));
  g.add(panel(w*0.6,0.10,0.32,furnMat('#ffffff'),0,0.20,-d*0.35,0.05));
  g.userData.size={w,h:0.28,d}; return g;
};

/* 화장대 (거울 포함) */
B.vanity=(o)=>{
  const w=o.w??0.95, d=o.d??0.42, h=o.h??0.76;
  const g=new THREE.Group();
  const m=furnMat(o.color??'#eae2d6','matte');
  g.add(panel(w,0.05,d,m,0,h-0.025,0,0.02));
  g.add(panel(w*0.45,h-0.1,d-0.04,m,-w*0.24,(h-0.1)/2,0,0.02));                    // 서랍통
  legs4(g,w,d,h-0.05,furnMat(o.accent??'#cbbfae','satin'),0.022,0.06);
  const mir=new THREE.Mesh(new THREE.CircleGeometry(0.21,28),
    new THREE.MeshStandardMaterial({ color:col('#dbe6ec'), roughness:0.08, metalness:0.15 }));
  mir.position.set(w*0.2,h+0.30,-d/2+0.03); g.add(mir);
  const ring=cyl(0.225,0.225,0.02,m,w*0.2,h+0.30,-d/2+0.02,28); ring.rotation.x=Math.PI/2; g.add(ring);
  g.userData.size={w,h:h+0.55,d};
  return addSlots(g, tierSlots(w*0.5,h,1,0), [h]);
};

/* 옷걸이 행거 */
B.clothes_rack=(o)=>{
  const w=o.w??1.0, d=o.d??0.45, h=o.h??1.62;
  const g=new THREE.Group();
  const m=furnMat(o.color??'#cbbfae','satin');
  for(const s of [-1,1]){
    g.add(cyl(0.016,0.016,h,m, s*(w/2-0.03), h/2, 0, 8));
    const foot=bx(0.05,0.025,d,m, s*(w/2-0.03), 0.012, 0); g.add(foot);
  }
  const bar=cyl(0.014,0.014,w-0.06,m,0,h-0.06,0,8); bar.rotation.z=Math.PI/2; g.add(bar);
  const cl=['#dbe3ea','#e8dcd6','#d9e2d6','#e6dced'];
  for(let i=0;i<5;i++){                                                            // 걸린 옷
    const x=-w*0.3+i*w*0.15;
    g.add(panel(0.14,0.52,0.07,furnMat(cl[i%4],'matte'),x,h-0.36,0,0.03));
    g.add(cyl(0.005,0.005,0.10,m,x,h-0.11,0,6));
  }
  g.userData.size={w,h,d}; return g;
};

/* 커피 테이블 (낮은) */
B.coffee_table=(o)=>{
  const w=o.w??0.95, d=o.d??0.52, h=o.h??0.38;
  const g=new THREE.Group();
  const m=furnMat(o.color??'#e5d3b8','matte');
  g.add(panel(w,0.045,d,m,0,h-0.022,0,0.02));
  g.add(panel(w-0.16,0.03,d-0.12,m,0,h*0.42,0,0.02));                              // 하단 선반
  legs4(g,w,d,h-0.045,furnMat(o.accent??'#cbbba2','satin'),0.022,0.06);
  g.userData.size={w,h,d};
  return addSlots(g, [...tierSlots(w,h,2), ...tierSlots(w-0.16,h*0.42+0.015,1)], [h*0.42+0.015,h]);
};

/* 수납 박스 */
B.storage_box=(o)=>{
  const w=o.w??0.42, d=o.d??0.34, h=o.h??0.3;
  const g=new THREE.Group();
  const m=furnMat(o.color??'#dfd6c7','matte');
  g.add(panel(w,h,d,m,0,h/2,0,0.035));
  g.add(bx(w-0.06,0.02,0.008,furnMat(o.accent??'#c3b49c','satin'),0,h*0.62,d/2+0.004));
  g.userData.size={w,h,d};
  return addSlots(g, [{x:0,y:+h.toFixed(3),z:0}], [h]);
};

/* 전신 거울 */
B.mirror=(o)=>{
  const w=o.w??0.45, h=o.h??1.55, d=0.06;
  const g=new THREE.Group();
  const m=furnMat(o.color??'#cbbfae','satin');
  g.add(panel(w,h,d,m,0,h/2,0,0.03));
  const face=new THREE.Mesh(new THREE.PlaneGeometry(w-0.07,h-0.09),
    new THREE.MeshStandardMaterial({ color:col('#dde8ee'), roughness:0.06, metalness:0.2 }));
  face.position.set(0,h/2,d/2+0.005); g.add(face);
  const leg=bx(0.05,0.5,0.3,m,0,0.25,-0.14); leg.rotation.x=0.22; g.add(leg);       // 뒷받침
  g.userData.size={w,h,d:0.3}; return g;
};

/* 책상 조명 */
B.desk_lamp=(o)=>{
  const h=o.h??0.42;
  const g=new THREE.Group();
  const m=furnMat(o.color??'#cfc7bb','satin');
  g.add(cyl(0.09,0.10,0.02,m,0,0.01,0,16));
  g.add(cyl(0.011,0.011,h*0.72,m,0,h*0.36,0,8));
  const arm=cyl(0.010,0.010,0.17,m,0.06,h*0.74,0,8); arm.rotation.z=-0.9; g.add(arm);
  const shade=new THREE.Mesh(new THREE.ConeGeometry(0.075,0.09,16,1,true),
    new THREE.MeshStandardMaterial({ color:col(o.accent??'#f6efdc'), roughness:0.55,
      side:THREE.DoubleSide, emissive:col('#3a2f18'), emissiveIntensity:0.22 }));
  shade.position.set(0.125,h*0.8,0); shade.rotation.z=0.5; g.add(shade);
  g.userData.size={w:0.3,h,d:0.2}; g.userData.lampShade=shade; return g;
};

/* ============================================================
   식물 전용 선반 확장 — 창가·벽·코너·매달기
============================================================ */

/* 창가 물받이 트레이 (창턱 위에 얹음) */
B.plant_tray=(o)=>{
  const w=o.w??0.9, d=o.d??0.18, h=0.05;
  const g=new THREE.Group();
  const m=furnMat(o.color??'#dfe4e0','satin');
  g.add(panel(w,0.012,d,m,0,0.006,0,0.01));
  for(const s of [-1,1]) g.add(bx(w,h,0.012,m,0,h/2,s*(d/2-0.006)));
  for(const s of [-1,1]) g.add(bx(0.012,h,d,m,s*(w/2-0.006),h/2,0));
  g.userData.size={w,h,d}; g.userData.mount='window';
  return addSlots(g, tierSlots(w,0.012,4,0,0.1), [0.012], [d]);
};

/* 코너 3단 선반 (90° 모서리) */
B.shelf_corner=(o)=>{
  const w=o.w??0.5, h=o.h??1.05, n=o.tiers??3, t=0.03;
  const g=new THREE.Group();
  const m=furnMat(o.color??'#e8dfd2','matte');
  const side=furnMat(o.accent??'#cbbfae','satin');
  const tiers=[], sl=[], dep=[];
  for(let i=0;i<n;i++){
    const y=t/2+(h-t)*(i/(n-1));
    const sh=new THREE.Shape();                       // 부채꼴(4분원)
    sh.moveTo(0,0); sh.lineTo(w,0); sh.absarc(0,0,w,0,Math.PI/2,false); sh.lineTo(0,0);
    const geo=new THREE.ExtrudeGeometry(sh,{depth:t,bevelEnabled:false,curveSegments:10});
    geo.rotateX(-Math.PI/2); geo.translate(-w/2,y,-w/2);
    const mesh=new THREE.Mesh(geo,m); g.add(mesh);
    tiers.push(+y.toFixed(3)); dep.push(w*0.7);
    sl.push({x:+(-w*0.16).toFixed(3),y:+(y+t/2).toFixed(3),z:+(-w*0.16).toFixed(3)},
            {x:+(w*0.12).toFixed(3), y:+(y+t/2).toFixed(3),z:+(w*0.12).toFixed(3)});
  }
  g.add(cyl(0.016,0.016,h,side,-w/2+0.02,h/2,-w/2+0.02,8));
  g.add(cyl(0.016,0.016,h,side, w/2-0.03,h/2,-w/2+0.02,8));
  g.add(cyl(0.016,0.016,h,side,-w/2+0.02,h/2, w/2-0.03,8));
  g.userData.size={w,h,d:w}; g.userData.mount='corner';
  return addSlots(g, sl, tiers, dep);
};

/* 계단식 플랜트 스탠드 */
B.plant_step=(o)=>{
  const w=o.w??0.9, d=o.d??0.28, n=o.tiers??3, t=0.03;
  const g=new THREE.Group();
  const m=furnMat(o.color??'#e0d5c2','matte');
  const side=furnMat(o.accent??'#c3b49c','satin');
  const tiers=[], sl=[], dep=[];
  const sw=w/n;
  for(let i=0;i<n;i++){
    const y=0.18+i*0.20, x=-w/2+sw*(i+0.5);
    g.add(panel(sw,t,d,m,x,y,0,0.012));
    for(const sz of [-1,1]) g.add(cyl(0.014,0.014,y,side,x,y/2,sz*(d/2-0.03),8));
    tiers.push(+y.toFixed(3)); dep.push(d);
    sl.push({x:+x.toFixed(3),y:+(y+t/2).toFixed(3),z:0});
  }
  g.userData.size={w,h:0.18+(n-1)*0.20+t,d};
  return addSlots(g, sl, tiers, dep);
};

/* 높은 화분 받침(원형 스탠드) */
B.plant_pedestal=(o)=>{
  const w=o.w??0.26, h=o.h??0.62;
  const g=new THREE.Group();
  const m=furnMat(o.color??'#e0d5c2','matte');
  g.add(cyl(w/2,w/2,0.035,m,0,h-0.018,0,20));
  g.add(cyl(0.035,0.045,h-0.06,furnMat(o.accent??'#c3b49c','satin'),0,(h-0.06)/2+0.02,0,12));
  g.add(cyl(w*0.42,w*0.46,0.03,furnMat(o.accent??'#c3b49c','satin'),0,0.015,0,18));
  g.userData.size={w,h,d:w};
  return addSlots(g, [{x:0,y:+h.toFixed(3),z:0}], [h], [w]);
};

/* 벽 그리드(메쉬 판) + 걸이 화분 자리 */
B.plant_grid=(o)=>{
  const w=o.w??0.9, h=o.h??0.9, t=0.012;
  const g=new THREE.Group();
  const m=furnMat(o.color??'#cfc7bb','satin');
  for(let i=0;i<=6;i++) g.add(bx(t,h,t,m,-w/2+w*i/6,h/2,0));
  for(let j=0;j<=6;j++) g.add(bx(w,t,t,m,0,h*j/6,0));
  const sl=[], hooks=[0.72,0.45];                          // 걸이 높이 2단
  for(const hy of hooks) for(const hx of [-w*0.28,0,w*0.28]){
    g.add(cyl(0.006,0.006,0.05,m,hx,h*hy,0.03,6));
    sl.push({x:+hx.toFixed(3), y:+(h*hy-0.02).toFixed(3), z:0.06});
  }
  g.userData.size={w,h,d:0.08}; g.userData.mount='wall';
  return addSlots(g, sl, hooks.map(v=>+(h*v).toFixed(3)), hooks.map(()=>0.18));
};

/* 천장 행잉 플랜터 (매달림)
   ★ 로프가 천장 마운트에서 화분 '테두리'까지 정확히 이어지도록 방향벡터로 배치.
     (길이를 어림잡으면 줄과 화분이 떨어져 보임) */
B.plant_hanger=(o)=>{
  const drop=o.h??0.75, r=o.w?o.w/2:0.13;
  const g=new THREE.Group();
  const rope=furnMat(o.accent??'#cbbfae','matte');
  g.add(cyl(0.035,0.035,0.02,rope,0,-0.01,0,10));          // 천장 마운트

  const bowlH=r*1.1;
  const rimY=-drop+bowlH;                                   // 화분 테두리 높이
  const rimR=r*0.92;                                        // 로프가 걸리는 테두리 반경
  const topY=-0.02;
  for(let i=0;i<3;i++){
    const a=i/3*Math.PI*2;
    const from=new THREE.Vector3(0, topY, 0);
    const to  =new THREE.Vector3(Math.cos(a)*rimR, rimY, Math.sin(a)*rimR);
    const dir=to.clone().sub(from);
    const len=dir.length();
    const rp=cyl(0.005,0.005,len,rope,0,0,0,6);
    rp.position.copy(from).addScaledVector(dir,0.5);         // 중점에 놓고
    rp.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), dir.clone().normalize()); // 방향 정렬
    g.add(rp);
  }
  // 화분 (바닥이 y=-drop)
  g.add(cyl(r, r*0.72, bowlH, furnMat(o.color??'#d9a88b','matte'), 0, -drop+bowlH/2, 0, 18));
  // 테두리 링 — 로프 끝을 물어 접합이 자연스럽게
  const ring=cyl(r*1.02, r*1.02, 0.018, rope, 0, rimY, 0, 20); g.add(ring);

  g.userData.size={w:r*2,h:drop,d:r*2}; g.userData.hangFromCeiling=true;
  return addSlots(g, [{x:0,y:+rimY.toFixed(3),z:0}], [+rimY.toFixed(3)], [r*1.8]);
};

/* 미니 온실장 (유리문 캐비닛 — 습도·보온) */
B.greenhouse_cabinet=(o)=>{
  const w=o.w??0.7, d=o.d??0.4, h=o.h??1.5, n=o.tiers??3;
  const g=new THREE.Group();
  const fr=furnMat(o.color??'#cfd8dc','satin');
  const glass=new THREE.MeshPhysicalMaterial({ transmission:0.9, roughness:0.06, thickness:0.3,
    transparent:true, opacity:0.16, ior:1.5, color:col('#e8f1f6'), side:THREE.DoubleSide, depthWrite:false });
  for(const sx of [-1,1]) for(const sz of [-1,1]) g.add(cyl(0.02,0.02,h,fr,sx*(w/2-0.02),h/2,sz*(d/2-0.02),8));
  g.add(panel(w,0.03,d,fr,0,0.015,0,0.01)); g.add(panel(w,0.03,d,fr,0,h-0.015,0,0.01));
  const tiers=[], sl=[], dep=[];
  for(let i=1;i<=n;i++){
    const y=h*i/(n+1);
    g.add(panel(w-0.06,0.02,d-0.06,fr,0,y,0,0.01));
    tiers.push(+y.toFixed(3)); dep.push(d-0.06); sl.push(...tierSlots(w-0.06,y+0.01,2));
  }
  const door=new THREE.Mesh(new THREE.PlaneGeometry(w-0.06,h-0.08), glass);
  door.position.set(0,h/2,d/2); g.add(door);
  for(const sx of [-1,1]){                                  // 옆유리
    const sg=new THREE.Mesh(new THREE.PlaneGeometry(d-0.06,h-0.08), glass);
    sg.rotation.y=Math.PI/2; sg.position.set(sx*w/2,h/2,0); g.add(sg);
  }
  g.userData.size={w,h,d}; g.userData.humid=true;
  return addSlots(g, sl, tiers, dep);
};

/* ============================================================
   ★ 조명 — 일반등 + 식물등(grow light)
   식물등은 userData.grow=true, ppfd(광량), coverage(비추는 반경 m)를
   보존해 나중에 조도 계산이 읽는다.
============================================================ */

/* 펜던트 등 (천장 매달림, 갓 모양 선택) */
B.lamp_pendant=(o)=>{
  const drop=o.h??0.55, r=o.w?o.w/2:0.16;
  const g=new THREE.Group();
  const m=furnMat(o.color??'#cfc7bb','satin');
  g.add(cyl(0.05,0.05,0.02,m,0,-0.01,0,12));
  g.add(cyl(0.006,0.006,drop,m,0,-drop/2,0,6));
  const shade=new THREE.Mesh(
    o.dome!==false ? new THREE.SphereGeometry(r,20,10,0,Math.PI*2,0,Math.PI/2)
                   : new THREE.ConeGeometry(r,r*1.1,20,1,true),
    new THREE.MeshStandardMaterial({ color:col(o.accent??'#f6efdc'), roughness:0.55,
      side:THREE.DoubleSide, emissive:col('#3a2f18'), emissiveIntensity:0.2 }));
  shade.rotation.x=Math.PI; shade.position.y=-drop-r*0.1; g.add(shade);
  g.userData.size={w:r*2,h:drop+r,d:r*2}; g.userData.hangFromCeiling=true; g.userData.lampShade=shade;
  return g;
};

/* 벽등(브라켓) */
B.lamp_wall=(o)=>{
  const g=new THREE.Group();
  const m=furnMat(o.color??'#cfc7bb','satin');
  g.add(panel(0.10,0.16,0.04,m,0,0,0,0.02));
  const arm=cyl(0.012,0.012,0.16,m,0,0.02,0.08,8); arm.rotation.x=Math.PI/2; g.add(arm);
  const shade=new THREE.Mesh(new THREE.CylinderGeometry(0.075,0.09,0.11,16,1,true),
    new THREE.MeshStandardMaterial({ color:col(o.accent??'#f6efdc'), roughness:0.55,
      side:THREE.DoubleSide, emissive:col('#3a2f18'), emissiveIntensity:0.25 }));
  shade.position.set(0,0.06,0.16); g.add(shade);
  g.userData.size={w:0.19,h:0.22,d:0.22}; g.userData.mount='wall'; g.userData.lampShade=shade;
  return g;
};

/* 스트링 라이트 (전구줄 — 벽/창가 장식) */
B.string_light=(o)=>{
  const w=o.w??1.6, n=o.bulbs??7, sag=o.sag??0.14;
  const g=new THREE.Group();
  const wire=furnMat(o.color??'#b9b2a6','matte');
  const bulbMat=new THREE.MeshStandardMaterial({ color:col(o.accent??'#f8ecc9'), roughness:0.3,
    emissive:col('#7a6432'), emissiveIntensity:0.7 });
  let prev=null;
  for(let i=0;i<=n;i++){
    const t=i/n, x=-w/2+w*t, y=-Math.sin(Math.PI*t)*sag;
    if(prev){                                              // 줄 세그먼트
      const dx=x-prev.x, dy=y-prev.y, len=Math.hypot(dx,dy);
      const seg=cyl(0.004,0.004,len,wire,(x+prev.x)/2,(y+prev.y)/2,0,5);
      seg.rotation.z=Math.atan2(dx,-dy); g.add(seg);
    }
    if(i<n){
      const b=new THREE.Mesh(new THREE.SphereGeometry(0.032,10,8),bulbMat);
      b.position.set(x,y-0.045,0); g.add(b);
    }
    prev={x,y};
  }
  g.userData.size={w,h:sag+0.1,d:0.08}; g.userData.mount='wall'; g.userData.decorLight=true;
  return g;
};

/* ★ 식물등 — 클립형 */
B.growlight_clip=(o)=>{
  const g=new THREE.Group();
  const m=furnMat(o.color??'#dfe3e6','satin');
  g.add(panel(0.10,0.05,0.07,m,0,0.02,0,0.02));           // 집게
  const neck=cyl(0.012,0.012,0.34,m,0,0.20,0.03,8); neck.rotation.x=0.35; g.add(neck);
  const head=new THREE.Mesh(new THREE.CylinderGeometry(0.075,0.09,0.06,18,1,true),
    new THREE.MeshStandardMaterial({ color:col('#e9edef'), roughness:0.4, side:THREE.DoubleSide }));
  head.position.set(0,0.38,0.14); head.rotation.x=Math.PI*0.86; g.add(head);
  const led=new THREE.Mesh(new THREE.CircleGeometry(0.072,18),
    new THREE.MeshStandardMaterial({ color:col(o.accent??'#f2e6ff'), emissive:col(o.accent??'#c9a8e8'),
      emissiveIntensity:0.9, roughness:0.2 }));
  led.position.set(0,0.352,0.145); led.rotation.x=-Math.PI/2+0.25; g.add(led);
  g.userData.size={w:0.2,h:0.42,d:0.24};
  g.userData.grow=true; g.userData.ppfd=o.ppfd??120; g.userData.coverage=o.coverage??0.35;
  g.userData.lampShade=led;
  return g;
};

/* ★ 식물등 — 바(선반 밑 부착) */
B.growlight_bar=(o)=>{
  const w=o.w??0.7;
  const g=new THREE.Group();
  const m=furnMat(o.color??'#dfe3e6','satin');
  g.add(bx(w,0.035,0.06,m,0,0.018,0));
  const led=new THREE.Mesh(new THREE.BoxGeometry(w-0.06,0.012,0.045),
    new THREE.MeshStandardMaterial({ color:col(o.accent??'#f4ecff'), emissive:col(o.accent??'#cbb0ea'),
      emissiveIntensity:0.95, roughness:0.25 }));
  led.position.y=-0.004; g.add(led);
  g.userData.size={w,h:0.05,d:0.06}; g.userData.mount='under-shelf';
  g.userData.grow=true; g.userData.ppfd=o.ppfd??180; g.userData.coverage=o.coverage??0.5;
  g.userData.lampShade=led;
  return g;
};

/* ★ 식물등 — 스탠드형(키 큰 식물용) */
B.growlight_stand=(o)=>{
  const h=o.h??1.5;
  const g=new THREE.Group();
  const m=furnMat(o.color??'#cfd4d8','satin');
  g.add(cyl(0.17,0.19,0.03,m,0,0.015,0,20));
  g.add(cyl(0.018,0.018,h-0.1,m,0,(h-0.1)/2,0,10));
  const arm=bx(0.34,0.03,0.05,m,0.15,h-0.09,0); g.add(arm);
  const panelL=new THREE.Mesh(new THREE.BoxGeometry(0.30,0.03,0.16),
    new THREE.MeshStandardMaterial({ color:col('#e6eaee'), roughness:0.4 }));
  panelL.position.set(0.28,h-0.12,0); g.add(panelL);
  const led=new THREE.Mesh(new THREE.PlaneGeometry(0.27,0.13),
    new THREE.MeshStandardMaterial({ color:col(o.accent??'#f4ecff'), emissive:col(o.accent??'#c9a8e8'),
      emissiveIntensity:0.9, roughness:0.2, side:THREE.DoubleSide }));
  led.rotation.x=Math.PI/2; led.position.set(0.28,h-0.137,0); g.add(led);
  g.userData.size={w:0.45,h,d:0.38};
  g.userData.grow=true; g.userData.ppfd=o.ppfd??250; g.userData.coverage=o.coverage??0.7;
  g.userData.lampShade=led;
  return g;
};

/* ============================================================
   생활 가구 확장
============================================================ */
B.shoe_cabinet=(o)=>{
  const w=o.w??0.8, d=o.d??0.34, h=o.h??0.9;
  const g=new THREE.Group(); const m=furnMat(o.color??'#e6dccd','matte');
  g.add(panel(w,h,d,m,0,h/2,0,0.03));
  for(let i=0;i<3;i++) g.add(bx(w-0.06,0.012,0.008,furnMat('#cdbfab','satin'),0,h*(i+0.5)/3,d/2+0.005));
  g.userData.size={w,h,d}; return addSlots(g, tierSlots(w,h,2), [h], [d]);
};
B.tv_stand=(o)=>{
  const w=o.w??1.4, d=o.d??0.38, h=o.h??0.45;
  const g=new THREE.Group(); const m=furnMat(o.color??'#e3d3bd','matte');
  g.add(panel(w,h*0.72,d,m,0,h*0.64,0,0.025));
  g.add(bx(w*0.46,0.014,0.008,furnMat('#cdbfab','satin'),-w*0.24,h*0.64,d/2+0.005));
  g.add(bx(w*0.46,0.014,0.008,furnMat('#cdbfab','satin'), w*0.24,h*0.64,d/2+0.005));
  legs4(g,w-0.1,d,h*0.28,furnMat(o.accent??'#c3b49c','satin'),0.02,0.05);
  g.userData.size={w,h,d}; return addSlots(g, tierSlots(w,h,3), [h], [d]);
};
B.cube_storage=(o)=>{
  const w=o.w??0.78, d=o.d??0.32, h=o.h??0.78, t=0.03;
  const g=new THREE.Group(); const m=furnMat(o.color??'#eae2d6','matte');
  g.add(bx(t,h,d,m,-w/2+t/2,h/2,0)); g.add(bx(t,h,d,m,w/2-t/2,h/2,0));
  g.add(bx(w,t,d,m,0,t/2,0)); g.add(bx(w,t,d,m,0,h-t/2,0));
  g.add(bx(w-2*t,t,d,m,0,h/2,0)); g.add(bx(t,h-2*t,d,m,0,h/2,0));
  g.add(bx(w-2*t,h/2-t,t*0.6,m,0,h*0.75,-d/2+t/2));
  const boxCol=['#dfd6c7','#d8e0e4','#e2ddd2','#d9e2da'];
  for(const [bxp,byp] of [[-1,0],[1,1]]){
    const bxm=furnMat(boxCol[(bxp+2+byp)%4],'matte');
    g.add(panel(w/2-t*2, h/2-t*2, d-0.06, bxm, bxp*(w/4), byp?h*0.75:h*0.25, 0.01, 0.025));
  }
  g.userData.size={w,h,d}; return addSlots(g, tierSlots(w,h,2), [h], [d]);
};
B.drying_rack=(o)=>{
  const w=o.w??0.9, d=o.d??0.55, h=o.h??1.0;
  const g=new THREE.Group(); const m=furnMat(o.color??'#cfd4d8','satin');
  for(const sz of [-1,1]) for(const sx of [-1,1]){
    const leg=cyl(0.012,0.012,h,m, sx*(w/2-0.02), h/2, sz*(d/2-0.05), 6);
    leg.rotation.x=sz*0.16; g.add(leg);
  }
  for(let i=0;i<5;i++){
    const bar=cyl(0.008,0.008,w-0.04,m,0,h-0.03,-d/2+0.09+i*((d-0.18)/4),6);
    bar.rotation.z=Math.PI/2; g.add(bar);
  }
  g.userData.size={w,h,d}; g.userData.movable=true; return g;
};
B.room_divider=(o)=>{
  const w=o.w??1.35, h=o.h??1.6, panels=3;
  const g=new THREE.Group(); const m=furnMat(o.color??'#e8dfd2','matte');
  const pw=w/panels;
  for(let i=0;i<panels;i++){
    const p=panel(pw-0.02,h,0.035,m,-w/2+pw*(i+0.5),h/2,(i%2?0.06:-0.06),0.02);
    p.rotation.y=(i%2?1:-1)*0.22; g.add(p);
  }
  g.userData.size={w,h,d:0.3}; g.userData.movable=true; return g;
};
B.laundry_basket=(o)=>{
  const w=o.w??0.42, h=o.h??0.5;
  const g=new THREE.Group(); const m=furnMat(o.color??'#e0d9c9','matte');
  g.add(cyl(w/2,w/2*0.82,h,m,0,h/2,0,18));
  g.add(cyl(w/2*1.02,w/2*1.02,0.03,furnMat(o.accent??'#cbbfae','satin'),0,h,0,18));
  g.userData.size={w,h,d:w}; return g;
};
B.picture_frame=(o)=>{
  const w=o.w??0.42, h=o.h??0.54;
  const g=new THREE.Group(); const m=furnMat(o.color??'#cbbfae','satin');
  g.add(panel(w,h,0.03,m,0,0,0,0.015));
  const art=new THREE.Mesh(new THREE.PlaneGeometry(w-0.07,h-0.07),
    new THREE.MeshStandardMaterial({ color:col(o.accent??'#dfe6ea'), roughness:0.8 }));
  art.position.z=0.017; g.add(art);
  g.userData.size={w,h,d:0.03}; g.userData.mount='wall'; return g;
};
B.wall_clock=(o)=>{
  const r=(o.w??0.3)/2;
  const g=new THREE.Group(); const m=furnMat(o.color??'#e8dfd2','matte');
  const body=cyl(r,r,0.04,m,0,0,0,26); body.rotation.x=Math.PI/2; g.add(body);
  const face=new THREE.Mesh(new THREE.CircleGeometry(r*0.88,26),
    new THREE.MeshStandardMaterial({ color:col('#faf8f4'), roughness:0.85 }));
  face.position.z=0.021; g.add(face);
  const hand=furnMat(o.accent??'#6a6f78','satin');
  const hh=bx(r*0.5,0.012,0.006,hand,r*0.2,0,0.026); g.add(hh);
  const mh=bx(0.012,r*0.72,0.006,hand,0,r*0.3,0.026); g.add(mh);
  g.userData.size={w:r*2,h:r*2,d:0.04}; g.userData.mount='wall'; return g;
};
B.floor_cushion=(o)=>{
  const w=o.w??0.6, h=o.h??0.16;
  const g=new THREE.Group();
  g.add(panel(w,h,w,furnMat(o.color??'#dfe0d4','matte'),0,h/2,0,0.06));
  g.userData.size={w,h,d:w}; return g;
};
B.low_table=(o)=>{
  const w=o.w??0.9, d=o.d??0.55, h=o.h??0.32;
  const g=new THREE.Group(); const m=furnMat(o.color??'#e5d3b8','matte');
  g.add(panel(w,0.04,d,m,0,h-0.02,0,0.02));
  legs4(g,w,d,h-0.04,furnMat(o.accent??'#cbbba2','satin'),0.02,0.05);
  g.userData.size={w,h,d}; return addSlots(g, tierSlots(w,h,2), [h], [d]);
};


/* ============================================================
   학원교실 — 칠판·교탁·학생책상·사물함·게시판
   벽걸이(mount:'wall')는 XY평면에 정면(+z)으로 만든다. house.js가 rot로 돌린다.
============================================================ */

/* 칠판 (화이트보드도 같은 빌더 — color만 바꾸면 됨). 하단 분필받이 포함 */
B.blackboard=(o)=>{
  const w=o.w??3.0, h=o.h??1.2, fr=0.05;
  const g=new THREE.Group();
  const frame=furnMat(o.accent??'#c8b9a4','satin');
  const board=furnMat(o.color??'#4a6152','matte');       // 진초록 (화이트보드는 #f2f4f2)
  g.add(panel(w,h,0.05,frame,0,0,0,0.015));             // 테두리
  g.add(panel(w-fr*2,h-fr*2,0.03,board,0,0,0.028,0.01)); // 판면
  // 분필받이 — 판 아래로 살짝 튀어나옴
  g.add(bx(w-fr*2, 0.035, 0.09, frame, 0, -h/2+0.05, 0.06));
  g.userData.size={w,h,d:0.09}; g.userData.mount='wall'; return g;
};

/* 게시판 (코르크). 압정 몇 개로 질감만 */
B.bulletin_board=(o)=>{
  const w=o.w??1.1, h=o.h??0.8;
  const g=new THREE.Group();
  g.add(panel(w,h,0.04,furnMat(o.accent??'#b9a88c','satin'),0,0,0,0.015));
  g.add(panel(w-0.08,h-0.08,0.02,furnMat(o.color??'#d8c3a0','matte'),0,0,0.025,0.01));
  const pin=furnMat('#e8e4dc','satin');
  for(const [px,py] of [[-0.25,0.18],[0.2,0.1],[0.05,-0.2]])
    g.add(bx(0.16,0.2,0.006,pin, px*w, py*h, 0.037));   // 붙여둔 종이
  g.userData.size={w,h,d:0.04}; g.userData.mount='wall'; return g;
};

/* 교탁 — 상판이 살짝 기운 연단 */
B.lectern=(o)=>{
  const w=o.w??0.8, d=o.d??0.45, h=o.h??1.05;
  const g=new THREE.Group();
  const m=furnMat(o.color??'#ded0b8','matte');
  g.add(panel(w,h-0.06,d*0.8,m,0,(h-0.06)/2,0,0.02));   // 몸통
  const top=panel(w+0.06,0.04,d,furnMat(o.accent??'#cbbba2','satin'),0,h-0.02,0,0.015);
  top.rotation.x=-0.14; g.add(top);                      // 기운 상판
  g.userData.size={w,h,d};
  return addSlots(g, tierSlots(w,h,1,0), [h], [d]);      // 교탁 위 화분 1자리
};

/* 학생 책상 — 상판 + 하부 책 선반(가방칸). 2인용/1인용은 w로 */
B.desk_student=(o)=>{
  const w=o.w??1.2, d=o.d??0.5, h=o.h??0.72, t=0.035;
  const g=new THREE.Group();
  const m=furnMat(o.color??'#e6dcc8','matte');
  const leg=furnMat(o.accent??'#9aa3a8','satin');
  g.add(panel(w,t,d,m,0,h-t/2,0,0.015));                // 상판
  g.add(panel(w-0.12,0.02,d-0.1,furnMat(o.accent??'#9aa3a8','matte'),0,h-0.22,0,0.01)); // 책 선반
  legs4(g,w,d,h-t,leg,0.018,0.05);
  g.userData.size={w,h,d};
  return addSlots(g, tierSlots(w,h,w>1.0?2:1,d*0.18), [h], [d]);
};

/* 사물함 — n칸 격자. 윗면은 화분 자리 */
B.locker=(o)=>{
  const w=o.w??1.2, d=o.d??0.4, h=o.h??1.1;
  const cols=o.cols??3, rows=o.rows??2;
  const g=new THREE.Group();
  const m=furnMat(o.color??'#dfe4e6','matte');
  const dr=furnMat(o.accent??'#c3ccd0','satin');
  g.add(panel(w,h,d,m,0,h/2,0,0.02));                   // 몸체
  const cw=(w-0.06)/cols, ch=(h-0.06)/rows;
  for(let i=0;i<cols;i++) for(let j=0;j<rows;j++){
    const x=-w/2+0.03+cw*(i+0.5), y=0.03+ch*(j+0.5);
    g.add(panel(cw-0.03, ch-0.03, 0.02, dr, x, y, d/2+0.005, 0.01));  // 문짝
    g.add(cyl(0.012,0.012,0.02, furnMat('#8f979c','satin'), x+cw*0.3, y, d/2+0.03, 8));
  }
  g.userData.size={w,h,d};
  return addSlots(g, tierSlots(w,h,cols>2?3:2,0), [h], [d]);
};

export const FURNITURE_TYPES=Object.keys(B);

/* ============================================================
   buildFurniture(type, opts) → Group (바닥 y=0 기준)
============================================================ */
export function buildFurniture(type, opts={}){
  const fn=B[type];
  if(!fn){ console.warn('[furniture] 알 수 없는 종류:', type); return new THREE.Group(); }
  const g=fn(opts||{});
  g.userData.type=type;
  /* ★ 역할만 붙인다. castShadow 는 정책 루프(applyShadowPolicy)가 유일한 주체다.
     빌더가 직접 켜면 정책이 그 뒤에 안 돌 때 그대로 샌다 — 창틀이 실제로 그랬다.
     noShadow 는 '빛을 막지 않는다'(러그·조명 갓)는 뜻이라 transparent 로 간다.
     기본이 blocker 여야 한다 — "명시적으로 켠 것만 켜짐"이 되면 러그처럼 예외인
     것만 표시하면 되는 구조가 무너진다. */
  g.traverse(o=>{ if(o.isMesh) markShadow(o, o.userData.noShadow ? SHADOW_ROLE.CLEAR : SHADOW_ROLE.BLOCK, {force:true}); });
  return g;
}
