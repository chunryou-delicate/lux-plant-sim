/* ============================================================
   render3d/furniture_pastel.js — 파스텔 저폴리 가구 (코드 생성)
   ------------------------------------------------------------
   A 미니멀 원칙: 매끈 무광 파스텔, 모서리만 살짝 둥글게, 텍스처 없음.
   온기·분위기는 런타임 빛이 만든다(가구에 굽지 않음).

   모든 가구는 "바닥 y=0에 앉은" 상태로 원점(발밑 중심) 기준 생성.
   userData.size = {w,h,d} 로 실제 치수 보존 → 배치·충돌·조도에 활용.

   사용: buildFurniture('bed_single', { color:'#e8d5c4' })
============================================================ */
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
  const mesh=new THREE.Mesh(geo,m); mesh.castShadow=true; mesh.receiveShadow=true; return mesh;
}
/* 각진 박스(빠름) */
function bx(w,h,d,m,x=0,y=0,z=0){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);
  mesh.position.set(x,y,z); mesh.castShadow=true; mesh.receiveShadow=true; return mesh;
}
function cyl(rt,rb,h,m,x=0,y=0,z=0,seg=14){
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,seg),m);
  mesh.position.set(x,y,z); mesh.castShadow=true; mesh.receiveShadow=true; return mesh;
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
  g.userData.size={w,h,d}; return g;
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
  g.userData.size={w,h,d}; return g;
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
  g.userData.size={w,h,d}; return g;
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
  g.userData.size={w:r*2,h,d:r*2}; return g;
};

/* 사각 테이블/식탁 */
B.table=(o)=>{
  const w=o.w??1.2, d=o.d??0.7, h=o.h??0.72;
  const g=new THREE.Group();
  const m=furnMat(o.color??'#e5d3b8','matte');
  g.add(panel(w,0.05,d,m,0,h-0.025,0,0.02));
  legs4(g,w,d,h-0.05,furnMat(o.accent??'#cbbba2','satin'),0.028,0.07);
  g.userData.size={w,h,d}; return g;
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
  g.userData.size={w,h,d}; return g;
};

/* 러그 */
B.rug=(o)=>{
  const w=o.w??1.8, d=o.d??1.3;
  const g=new THREE.Group();
  const m=furnMat(o.color??'#e7ddd0','matte');
  const r=soft(w,d,0.012,m,0.12); r.rotation.x=-Math.PI/2; r.position.y=0.006;
  r.castShadow=false; r.receiveShadow=true; g.add(r);
  if(o.accent){                                        // 테두리 라인
    const b=soft(w-0.16,d-0.16,0.014,furnMat(o.accent,'matte'),0.1);
    b.rotation.x=-Math.PI/2; b.position.y=0.009; b.castShadow=false; g.add(b);
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
    leaf.scale.y=0.78; leaf.castShadow=true; g.add(leaf);
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
  shade.position.y=h-0.12; shade.castShadow=true; g.add(shade);
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
  shade.position.y=-drop-0.08; shade.castShadow=true; g.add(shade);
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

export const FURNITURE_TYPES=Object.keys(B);

/* ============================================================
   buildFurniture(type, opts) → Group (바닥 y=0 기준)
============================================================ */
export function buildFurniture(type, opts={}){
  const fn=B[type];
  if(!fn){ console.warn('[furniture] 알 수 없는 종류:', type); return new THREE.Group(); }
  const g=fn(opts||{});
  g.userData.type=type;
  g.traverse(o=>{ if(o.isMesh){ o.castShadow=o.castShadow!==false; o.receiveShadow=true; } });
  return g;
}
