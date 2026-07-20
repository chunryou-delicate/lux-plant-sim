/* ============================================================
   render3d/window_frame.js — 코드 창틀/문/유리 프리셋 빌더
   ------------------------------------------------------------
   house.js와 컨택시트(_window_contact.html) 공용. GLB 없이 박스 지오메트리로
   반듯한 창틀을 만든다. 프리셋 = 룩(패턴·두께·색·광택·모서리·창턱) + 유리(빛).

   좌표: 원점 중심. local X=폭(u), Y=높이(v), Z=깊이. 벽 배치는 호출부(placeInWall).

   ★ 원칙(A 미니멀 파스텔): 매끈 무광 위주, 반사 과하지 않게, 결(그레인) 없음.
   ★ 재질 캐싱: 같은 색/광택/유리 조합은 인스턴스 공유(매 창마다 new 금지).
============================================================ */
import { box, col } from './util.js';

export const FRAME_DEFAULTS={
  cols:2, rows:2,
  FT:0.09,          // 바깥틀 두께
  BT:0.045,         // 격자살 두께
  depth:0.14,       // 프레임 깊이
  shape:'rect',     // 'rect' | 'circle'(원형 포트홀)
  corner:'sharp',   // 'sharp' | 'round' (rect 전용)
  pattern:'grid',   // grid | cross | letterbox | slim | curtainwall | none
  sill:false,       // 창턱(선반)
  sillDepth:0.12,   // 창턱 깊이(m). 크게 하면 식물 올리는 인방
  frameColor:'#f8f4ec',
  gloss:'matte',    // matte | satin | gloss
  glass:{ type:'clear', transmittance:0.92, tintColor:null, glossy:0.3 },
};
// shape: 'rect' | 'circle'(포트홀) | 'arch'(아치 상단, 온실/정원창)

/* 아치 외곽선(반원 상단 + 직사각 하단)을 path/shape에 그린다. 중심(cx,cy). */
export function drawArch(p, w, h, cx=0, cy=0){
  const R=w/2, rectH=Math.max(0.05, h-R), x=cx-w/2, yb=cy-h/2, springY=yb+rectH;
  p.moveTo(x, yb);
  p.lineTo(x, springY);
  p.absarc(cx, springY, R, Math.PI, 0, true);   // 좌 스프링 → 상단 반원 → 우 스프링
  p.lineTo(cx+w/2, yb);
  p.lineTo(x, yb);
  p.closePath?.();
  return p;
}

/* 유리 quad 지오메트리(형태별). 안쪽 크기 gw×gh. */
export function glassGeometry(shape, gw, gh){
  if(shape==='circle') return new THREE.CircleGeometry(Math.min(gw,gh)/2, 40);
  if(shape==='arch'){ const s=new THREE.Shape(); drawArch(s, gw, gh); return new THREE.ShapeGeometry(s); }
  return new THREE.PlaneGeometry(gw, gh);
}

// gloss → roughness/metalness (STEP 3-B 표)
const GLOSS={ matte:{r:0.9,m:0.0}, satin:{r:0.55,m:0.0}, gloss:{r:0.2,m:0.05} };

/* ---- 프레임 재질 캐시 (색+광택 조합당 1개) ---- */
const _frameCache={};
export function frameMaterial(frameColor='#f8f4ec', gloss='matte'){
  const key=frameColor+'|'+gloss;
  if(!_frameCache[key]){
    const g=GLOSS[gloss]||GLOSS.matte;
    const m=new THREE.MeshStandardMaterial({
      color:col(frameColor), roughness:g.r, metalness:g.m, flatShading:false });
    m.envMapIntensity=0.4;               // 반사 튀지 않게(파스텔 유지)
    _frameCache[key]=m;
  }
  return _frameCache[key];
}

/* ---- 유리 재질 (type별). transmittance/diffuse는 조도 계산용으로 userData에 보존 ----
   MeshPhysicalMaterial(transmission) 미지원 버전 대비 opacity도 항상 설정 → 폴백 안전. */
const _glassCache={};
export function glassMaterial(glass){
  const gz={ ...FRAME_DEFAULTS.glass, ...(glass||{}) };
  if(gz.type==='none') return null;      // 뻥 뚫림(유리 quad 없음)
  const key=JSON.stringify(gz);
  if(_glassCache[key]) return _glassCache[key];

  const base={ transparent:true, depthWrite:false, side:THREE.DoubleSide, metalness:0.0 };
  let m;
  switch(gz.type){
    case 'green-tint':
      m=new THREE.MeshPhysicalMaterial({ ...base, transmission:0.8, roughness:0.05, opacity:0.30, ior:1.5,
        color:col(gz.tintColor||'#c8ded0') }); break;
    case 'frosted':       // 간유리: 확산·불투명(뒤 흐릿). r128 transmission 약해 opacity로 뿌옇게.
      m=new THREE.MeshPhysicalMaterial({ ...base, transmission:0.4, roughness:0.95, opacity:0.82, ior:1.4,
        color:col(gz.tintColor||'#eef2f0') }); break;
    case 'glassblock':    // 유리블럭: 산란
      m=new THREE.MeshPhysicalMaterial({ ...base, transmission:0.35, roughness:0.8, opacity:0.85, ior:1.4,
        color:col(gz.tintColor||'#dfeaf0') }); break;
    case 'clear':
    default:              // 맑고 투명 — 뿌연 필름 안 끼게 opacity 낮게, 틴트 옅게
      m=new THREE.MeshPhysicalMaterial({ ...base, transmission:0.95, roughness:0.03, opacity:0.12, ior:1.5,
        color:col(gz.tintColor||'#e8f1f6') }); break;
  }
  m.userData.transmittance=gz.transmittance;                       // 조도 계수(값만 보존)
  m.userData.diffuse=(gz.type==='frosted'||gz.type==='glassblock'); // 확산광 플래그
  m.userData.skyTint=(gz.type==='clear');                          // scene.js 하늘색 갱신 여부
  _glassCache[key]=m;
  return m;
}

/* ---- 방 spec(preset id + 인라인 룩) → 완성 opts. 지오메트리 필드(w/h/cu/cy)는 제외 ---- */
export function resolveWindowPreset(spec, presets){
  const base=(spec.preset && presets && presets[spec.preset]) ? presets[spec.preset] : {};
  const { w,h,cu,cy,wall,module,preset, ...inline }=spec;   // 인라인 룩만 남김(하위호환)
  return { ...FRAME_DEFAULTS, ...base, ...inline };
}

/* ---- 둥근 사각(corner:'round') 외곽틀 링 ---- */
function roundedRectShape(w,h,r){
  const s=new THREE.Shape(); const x=-w/2, y=-h/2;
  s.moveTo(x+r,y); s.lineTo(x+w-r,y); s.quadraticCurveTo(x+w,y,x+w,y+r);
  s.lineTo(x+w,y+h-r); s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  s.lineTo(x+r,y+h); s.quadraticCurveTo(x,y+h,x,y+h-r);
  s.lineTo(x,y+r); s.quadraticCurveTo(x,y,x+r,y); s.closePath(); return s;
}
function roundedRectPath(w,h,r){
  const p=new THREE.Path(); const x=-w/2, y=-h/2;
  p.moveTo(x+r,y); p.lineTo(x+w-r,y); p.quadraticCurveTo(x+w,y,x+w,y+r);
  p.lineTo(x+w,y+h-r); p.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  p.lineTo(x+r,y+h); p.quadraticCurveTo(x,y+h,x,y+h-r);
  p.lineTo(x,y+r); p.quadraticCurveTo(x,y,x+r,y); p.closePath(); return p;
}
function roundedRing(w,h,FT,d,m){
  const r=Math.min(0.12, FT*1.2);
  const shape=roundedRectShape(w,h,r);
  shape.holes.push(roundedRectPath(w-2*FT, h-2*FT, Math.max(0.02, r-FT*0.4)));
  const geo=new THREE.ExtrudeGeometry(shape,{ depth:d, bevelEnabled:false, curveSegments:6 });
  geo.translate(0,0,-d/2);
  const mesh=new THREE.Mesh(geo,m); mesh.castShadow=true; mesh.receiveShadow=true; return mesh;
}

/* ============================================================
   ★ buildWindowFrame(w, h, opts) — 프레임 + 격자 살(pattern 분기)
============================================================ */
export function buildWindowFrame(w, h, opts={}){
  const o={ ...FRAME_DEFAULTS, ...opts };
  const m=opts.material || frameMaterial(o.frameColor, o.gloss);
  if(o.shape==='circle') return buildCircleFrame(w, h, o, m);   // ★ 원형 포트홀
  if(o.shape==='arch')   return buildArchFrame(w, h, o, m);     // ★ 아치(온실/정원창)
  const g=new THREE.Group();
  const FT=o.FT, d=o.depth;

  // ---- 외곽틀 ----
  if(o.corner==='round'){
    g.add(roundedRing(w,h,FT,d,m));
  }else{
    g.add(box(FT, h, d, m, -w/2+FT/2, 0, 0));          // 좌
    g.add(box(FT, h, d, m,  w/2-FT/2, 0, 0));          // 우
    g.add(box(w-2*FT, FT, d, m, 0,  h/2-FT/2, 0));     // 상
    g.add(box(w-2*FT, FT, d, m, 0, -h/2+FT/2, 0));     // 하
  }

  // ---- 격자 살 (pattern 분기) ----
  const innerW=w-2*FT, innerH=h-2*FT, bd=d*0.85;
  const bt=(o.pattern==='curtainwall') ? o.BT*1.4 : o.BT;   // 커튼월=멀리언 굵게
  const addV=n=>{ for(let i=1;i<n;i++){ const x=-innerW/2+innerW*i/n; g.add(box(bt, innerH, bd, m, x,0,0)); } };
  const addH=n=>{ for(let j=1;j<n;j++){ const y=-innerH/2+innerH*j/n; g.add(box(innerW, bt, bd, m, 0,y,0)); } };
  switch(o.pattern){
    case 'none':        break;                       // 통유리, 살 없음
    case 'letterbox':   addV(o.cols); break;          // 세로살만(가로 긴 창)
    case 'slim':        addH(o.rows); break;          // 가로살만(세로 좁은 창)
    case 'cross':       addV(2); addH(2); break;      // 정중앙 십자
    case 'curtainwall': addV(o.cols); addH(o.rows); break;
    case 'grid':
    default:            addV(o.cols); addH(o.rows); break;
  }

  // ---- 창턱(선반): 식물 올려두는 자리. sillDepth 크면 인방(깊은 선반) ----
  if(o.sill){
    const st=0.05, sd=o.sillDepth||0.12;
    g.add(box(w+FT, st, d+sd, m, 0, -h/2-st/2, sd/2));            // 상판(벽 안쪽으로 튀어나옴)
    if(sd>0.22){                                                 // 깊은 인방 = 앞턱 마감(fascia)만, 밑 매달림 X
      g.add(box(w+FT, 0.09, 0.04, m, 0, -h/2-st-0.045, sd+d/2-0.02));  // 앞면 마감 보드(살짝만 내려옴)
    }
  }

  g.traverse(x=>{ if(x.isMesh){ x.castShadow=true; x.receiveShadow=true; } });
  return g;
}

/* ---- ★ 아치 프레임: 아치 링(Extrude) + 직선부 세로살 ---- */
function buildArchFrame(w, h, o, m){
  const g=new THREE.Group();
  const FT=o.FT, d=o.depth;
  const shape=new THREE.Shape(); drawArch(shape, w, h);
  const hole=new THREE.Path();   drawArch(hole, w-2*FT, h-2*FT);
  shape.holes.push(hole);
  const geo=new THREE.ExtrudeGeometry(shape,{ depth:d, bevelEnabled:false, curveSegments:26 });
  geo.translate(0,0,-d/2);
  g.add(new THREE.Mesh(geo, m));
  // 살: 직선부(스프링라인 아래)에 세로 + 스프링라인 가로
  const R=w/2, rectH=Math.max(0.05, h-R), springY=-h/2+rectH;
  const innerW=w-2*FT, bt=(o.pattern==='curtainwall')?o.BT*1.4:o.BT, bd=d*0.85;
  if(o.pattern!=='none' && rectH>0.2){
    const y0=-h/2+FT, y1=springY, bh=Math.max(0.05,y1-y0);
    for(let i=1;i<o.cols;i++){ const x=-innerW/2+innerW*i/o.cols; g.add(box(bt,bh,bd,m,x,(y0+y1)/2,0)); }
    for(let j=1;j<o.rows;j++){ const y=y0+bh*j/o.rows; g.add(box(innerW,bt,bd,m,0,y,0)); }
    g.add(box(innerW,bt,bd,m,0,springY,0));   // 스프링라인 가로살
  }
  g.traverse(x=>{ if(x.isMesh){ x.castShadow=true; x.receiveShadow=true; } });
  return g;
}

/* ---- ★ 원형 포트홀 프레임: 링(ExtrudeGeometry) + 선택 십자살 ---- */
function buildCircleFrame(w, h, o, m){
  const g=new THREE.Group();
  const R=Math.min(w,h)/2, FT=o.FT, d=o.depth;
  const shape=new THREE.Shape();  shape.absarc(0,0,R,0,Math.PI*2,false);
  const hole=new THREE.Path();    hole.absarc(0,0,Math.max(0.02,R-FT),0,Math.PI*2,true);
  shape.holes.push(hole);
  const geo=new THREE.ExtrudeGeometry(shape,{ depth:d, bevelEnabled:false, curveSegments:48 });
  geo.translate(0,0,-d/2);
  const ring=new THREE.Mesh(geo,m); g.add(ring);
  // 십자/살 (있으면). 안쪽 지름 안에서만.
  const innerR=R-FT, bd=d*0.85, bt=o.BT;
  if(o.pattern!=='none'){
    if(o.cols>1) g.add(box(bt, innerR*2, bd, m, 0,0,0));   // 세로살
    if(o.rows>1) g.add(box(innerR*2, bt, bd, m, 0,0,0));   // 가로살
  }
  g.traverse(x=>{ if(x.isMesh){ x.castShadow=true; x.receiveShadow=true; } });
  return g;
}

/* ============================================================
   buildDoor(w, h, opts) — 슬래브 + 얇은 문틀 + 손잡이
   문은 벽과 함께 컷어웨이되므로 재질을 독립(clone)해서 opacity 변형 격리.
============================================================ */
export function buildDoor(w, h, opts={}){
  const o={ ...FRAME_DEFAULTS, ...opts };
  const m=opts.material || frameMaterial(o.frameColor, o.gloss).clone();
  const g=new THREE.Group();
  const FT=o.FT, d=o.depth;
  g.add(box(FT, h, d, m, -w/2+FT/2, 0, 0));           // 좌틀
  g.add(box(FT, h, d, m,  w/2-FT/2, 0, 0));           // 우틀
  g.add(box(w-2*FT, FT, d, m, 0, h/2-FT/2, 0));       // 상틀
  g.add(box(w-2*FT, h-FT, 0.05, m, 0, -FT/2, 0.02));  // 문짝 슬래브
  const knob=new THREE.Mesh(new THREE.SphereGeometry(0.045,12,12),
    new THREE.MeshStandardMaterial({ color:col('#c7b596'), roughness:0.3, metalness:0.35 }));
  knob.position.set(w/2-FT-0.18, -0.1, 0.07); g.add(knob);
  g.traverse(x=>{ if(x.isMesh){ x.castShadow=true; x.receiveShadow=true; } });
  return g;
}
