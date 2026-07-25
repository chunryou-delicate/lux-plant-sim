/* ============================================================
   render3d/house.js — 집/방 모듈 조립기 (실제 에셋 기반)
   ------------------------------------------------------------
   house_asset_direction.md 구현체. 절차적 room.js를 대체한다.

   방침(문서 §2·§3):
   - 뼈대(벽·바닥·천장) = 코드 생성. 1m 모듈 격자로 패널을 깔고,
     창·문 개구부는 rectMinus(사각형 빼기)로 정확히 도려낸다.
     → 6면 밀폐 유지(빛은 개구부로만 샘) + 컷어웨이용 독립 재질.
   - 벽지·바닥재 = A미니멀 파스텔 단색면 + 옅은 결(surfaceMat + faintGrainTexture).
     (거친 리얼 PNG는 loadHouseTextures로 남겨둠 — 나중 필요 시.)
   - 창호·문 = ★코드 생성 프레임(박스 지오메트리). Meshy GLB 대신.
     → 선 반듯·두께 균일·격자수 파라메트릭(cols×rows). 벽과 같은 파스텔 재질.
   - ★ 유리 = 프레임 안쪽에 코드로 quad 생성 + 투명 셰이더(§3).

   좌표: 방을 원점 중심에 둔다. 바닥 y=0, 천장 y=CH.
   벽 바깥법선(outward)으로 컷어웨이 판정.
============================================================ */
import { mat, box, col } from './util.js';
import { buildFurniture } from './furniture_pastel.js';
import { buildWindowFrame, buildDoor, glassMaterial, glassGeometry, frameMaterial,
         resolveWindowPreset, FRAME_DEFAULTS, drawArch } from './window_frame.js';
import { wallOrient, orientK } from '../engine/daylight_lux.js';

export const RW=7, RD=7, RH=4;           // 기본 치수(방에 size 없으면 이 값)
// ★ 현재 조립 중인 방의 실제 치수. buildHouse 시작 시 roomDef.size로 세팅된다.
let CW=RW, CD=RD, CH=RH;
export function roomSize(){ return { w:CW, d:CD, h:CH }; }
const WT=0.2;                            // 벽 두께
export const GRID=1;                     // ★ 1m 모듈 단위 (창·문 위치/크기 스냅 기준)

/* ---- A 미니멀 표면 재질: 파스텔 단색 + 옅은 결(grain). 매끈·밝게. ---- */
function surfaceMat(hex, rough=0.9, grain){
  const o={ color:col(hex), roughness:rough, metalness:0.0 };
  if(grain) o.map=grain;              // near-white 결이 color에 곱해짐 → 파스텔 유지
  return new THREE.MeshStandardMaterial(o);
}

/* ---- 유리 셰이더 재질 (문서 §3) ---- */
export function makeGlassMaterial(){
  return new THREE.MeshPhysicalMaterial({
    transmission:1.0, roughness:0.0, thickness:0.5,
    transparent:true, ior:1.5, opacity:0.18, metalness:0.0,
    color:0xcfe8ff, side:THREE.DoubleSide,
    depthWrite:false,
  });
}

/* ============================================================
   사각형 빼기: 벽 사각(a)에서 개구부들(holes)을 도려낸 나머지 조각들.
   a,hole = {x0,y0,x1,y1}.  → 벽에 창/문 구멍을 뚫는 핵심.
============================================================ */
function rectMinus(a, holes){
  let rects=[a];
  for(const h of holes){
    const next=[];
    for(const r of rects){
      // 겹치지 않으면 그대로
      if(h.x1<=r.x0||h.x0>=r.x1||h.y1<=r.y0||h.y0>=r.y1){ next.push(r); continue; }
      const ox0=Math.max(r.x0,h.x0), oy0=Math.max(r.y0,h.y0);
      const ox1=Math.min(r.x1,h.x1), oy1=Math.min(r.y1,h.y1);
      if(oy1<r.y1) next.push({x0:r.x0,y0:oy1, x1:r.x1,y1:r.y1});   // 위
      if(oy0>r.y0) next.push({x0:r.x0,y0:r.y0,x1:r.x1,y1:oy0});    // 아래
      if(ox0>r.x0) next.push({x0:r.x0,y0:oy0,x1:ox0, y1:oy1});     // 왼
      if(ox1<r.x1) next.push({x0:ox1, y0:oy0,x1:r.x1,y1:oy1});     // 오
    }
    rects=next;
  }
  return rects;
}

/* 벽면에서 개구부(창·문)만 도려낸 조각 리스트.
   ※ 1m 격자로 쪼개면 조각끼리 맞닿은 면에서 z-fighting(점선 이음새)이 생겨서
      벽은 통면으로 만들고 '1m 모듈'은 개구부 위치·크기 기준으로만 유지한다. */
function panelRects(uMin,uMax,vMin,vMax, openings){
  return rectMinus({ x0:uMin, y0:vMin, x1:uMax, y1:vMax }, openings);
}

/* 벽-local (u,v) 조각 → 월드 박스. 벽마다 축 매핑이 다르다. */
function panelToBox(wall, r, m){
  const cu=(r.x0+r.x1)/2, cv=(r.y0+r.y1)/2, du=r.x1-r.x0, dv=r.y1-r.y0;
  if(wall==='back')  return box(du,dv,WT, m, cu, cv, -CD/2);
  if(wall==='front') return box(du,dv,WT, m, cu, cv,  CD/2);
  if(wall==='left')  return box(WT,dv,du, m, -CW/2, cv, cu);
  if(wall==='right') return box(WT,dv,du, m,  CW/2, cv, cu);
}

/* 벽 좌표계 범위 (u축 길이·범위) */
function wallURange(wall){
  return (wall==='back'||wall==='front') ? [-CW/2, CW/2] : [-CD/2, CD/2];
}

/* 프레임/유리를 벽에 앉히는 변환 (위치 + Y회전). cu=벽 local u중심 */
function wallPlacement(wall, cu, cy){
  if(wall==='back')  return { pos:[cu, cy, -CD/2],  roty:0 };
  if(wall==='front') return { pos:[cu, cy,  CD/2],  roty:Math.PI };
  if(wall==='left')  return { pos:[-CW/2, cy, cu],  roty:Math.PI/2 };
  if(wall==='right') return { pos:[ CW/2, cy, cu],  roty:-Math.PI/2 };
}

/* ============================================================
   바닥 마감 텍스처 (원목마루 판/타일 줄눈). 자체 구현 — 외부 모듈 의존 없음.
   near-white 로 그려서 재질 color(오크·월넛 등)에 곱해짐 = 색은 팔레트가, 결은 여기가.
============================================================ */
/* ★ 원목마루: 길쭉한 직사각 판(가로로 긴 널). 2m×2m 기준 = 널폭 0.2m × 길이 1m.
   결(그레인)이 판 길이 방향으로 흐르고, 행마다 이음새를 엇갈리게(스태거) 배치. */
function plankTex(){
  const S=1024, ROWS=10, BH=S/ROWS, PL=S/2;   // BH=널 폭(0.2m), PL=널 길이(1m)
  const c=document.createElement('canvas'); c.width=c.height=S;
  const x=c.getContext('2d'); x.fillStyle='#ffffff'; x.fillRect(0,0,S,S);
  for(let r=0; r<ROWS; r++){
    const Y=r*BH, off=-(r*PL*0.37)%PL;          // 행마다 다르게 밀어 이음새 엇갈림
    for(let px=-PL; px<S+PL; px+=PL){
      const X=px+off, v=234+Math.random()*21;   // 널마다 색 편차
      x.save(); x.beginPath(); x.rect(X,Y,PL,BH); x.clip();
      x.fillStyle=`rgb(${v|0},${v|0},${v|0})`; x.fillRect(X,Y,PL,BH);
      // 나뭇결 — 길이 방향(가로)으로 길게 흐르는 선
      for(let i=0;i<14;i++){
        const gy=Y+2+Math.random()*(BH-4);
        x.strokeStyle=`rgba(172,150,120,${0.10+Math.random()*0.2})`;
        x.lineWidth=0.7+Math.random()*1.3;
        x.beginPath(); x.moveTo(X,gy);
        for(let sx=X; sx<X+PL; sx+=18) x.lineTo(sx, gy+Math.sin(sx*0.012+i*1.7)*1.6);
        x.stroke();
      }
      // 옹이/무늬결 살짝
      if(Math.random()<0.35){
        const kx=X+PL*(0.2+Math.random()*0.6), ky=Y+BH*0.5;
        x.strokeStyle='rgba(165,142,110,.28)'; x.lineWidth=1.1;
        for(let k=1;k<=3;k++){ x.beginPath(); x.ellipse(kx,ky,k*7,k*3.2,0,0,Math.PI*2); x.stroke(); }
      }
      x.restore();
      // 널 세로 이음새(끝단)
      x.strokeStyle='rgba(132,112,86,.55)'; x.lineWidth=2;
      x.beginPath(); x.moveTo(X,Y); x.lineTo(X,Y+BH); x.stroke();
    }
    // 널 가로 이음새(행 경계)
    x.strokeStyle='rgba(132,112,86,.45)'; x.lineWidth=1.8;
    x.beginPath(); x.moveTo(0,Y); x.lineTo(S,Y); x.stroke();
  }
  const t=new THREE.CanvasTexture(c);
  t.wrapS=t.wrapT=THREE.RepeatWrapping; t.anisotropy=8; t.encoding=THREE.sRGBEncoding; return t;
}

/* 타일2 = 엇갈린 정사각 블록(예전 '원목'이던 패턴을 타일로 승격) */
function tile2Tex(){
  const S=512, PW=S/4, c=document.createElement('canvas'); c.width=c.height=S;
  const x=c.getContext('2d'); x.fillStyle='#ffffff'; x.fillRect(0,0,S,S);
  for(let row=0; row<4; row++){
    const off=(row%2)*(PW/2);                          // 엇갈린 블록 배열
    for(let px=-PW; px<S+PW; px+=PW){
      const X=px+off, Y=row*PW, v=236+Math.random()*19;
      x.fillStyle=`rgb(${v|0},${v|0},${v|0})`; x.fillRect(X,Y,PW,PW);
      x.strokeStyle='rgba(150,136,116,.55)'; x.lineWidth=2.2;
      x.strokeRect(X+1,Y+1,PW-2,PW-2);
    }
  }
  const t=new THREE.CanvasTexture(c);
  t.wrapS=t.wrapT=THREE.RepeatWrapping; t.anisotropy=8; t.encoding=THREE.sRGBEncoding; return t;
}
function tileTex(){
  const S=512, T=S/4, c=document.createElement('canvas'); c.width=c.height=S;
  const x=c.getContext('2d'); x.fillStyle='#ffffff'; x.fillRect(0,0,S,S);
  for(let i=0;i<4;i++) for(let j=0;j<4;j++){
    const v=248+Math.random()*7; x.fillStyle=`rgb(${v|0},${v|0},${v|0})`;
    x.fillRect(i*T,j*T,T,T);
    x.strokeStyle='rgba(170,175,180,.55)'; x.lineWidth=2.2; x.strokeRect(i*T+1,j*T+1,T-2,T-2);
  }
  const t=new THREE.CanvasTexture(c);
  t.wrapS=t.wrapT=THREE.RepeatWrapping; t.anisotropy=8; t.encoding=THREE.sRGBEncoding; return t;
}
const _finCache={};
function finishTexture(pattern, meters=7){
  if(!pattern || pattern==='plain') return null;
  const key=pattern+'@'+meters;
  if(_finCache[key]) return _finCache[key];
  let t=null;
  if(pattern==='plank'){ t=plankTex(); t.repeat.set(meters/2, meters/2); }        // 널 0.2m×1m (2m 타일)
  else if(pattern==='tile'){ t=tileTex(); t.repeat.set(meters/1.6, meters/1.6); } // 타일 0.4m
  else if(pattern==='tile2'){ t=tile2Tex(); t.repeat.set(meters/2, meters/2); }   // 엇갈린 블록 0.5m
  if(t) _finCache[key]=t;
  return t;
}

/* ---- 마감재 id → 색/거칠기 (room_finishes.json). id 없으면 원본 유지 ---- */
export function applyFinishes(roomDef, finishes){
  if(!finishes) return roomDef;
  const pick=(list,id)=>(list||[]).find(x=>x.id===id);
  const r={ ...roomDef };
  const w=pick(finishes.wall, roomDef.wall);
  const f=pick(finishes.floor, roomDef.floor);
  const c=pick(finishes.ceil, roomDef.ceil);
  if(w){ r.wallColor=w.hex;  r.wallRough=w.rough; }
  if(f){ r.floorColor=f.hex; r.floorRough=f.rough; r.floorPattern=f.pattern; }
  if(c){ r.ceilColor=c.hex; }
  return r;
}

/* 창 형태가 사각이 아닌가? (원형·아치·라운드모서리) */
function isShaped(p){ return p.shape==='circle' || p.shape==='arch' || p.corner==='round'; }

/* ---- ★ 형태 구멍 벽조각(filler) ----
   1m 모듈 벽은 창 bbox를 통째로 비운다. 그 bbox 자리에 '형태대로 뚫린' 벽조각을 끼워
   원형/아치 창도 벽이 그 모양으로 뚫리게 한다. (사각 창은 filler 불필요)      */
function shapedFiller(wall, spec, p, m){
  const w=spec.w, h=spec.h, ins=(p.FT??0.09)*0.4;   // 프레임이 벽 가장자리를 덮게 살짝 안쪽
  const outer=new THREE.Shape();
  outer.moveTo(-w/2,-h/2); outer.lineTo(w/2,-h/2); outer.lineTo(w/2,h/2); outer.lineTo(-w/2,h/2); outer.closePath();
  const hole=new THREE.Path();
  if(p.shape==='circle')      hole.absarc(0,0, Math.min(w,h)/2-(p.FT??0.09)*0.55, 0, Math.PI*2, true);
  else if(p.shape==='arch')   drawArch(hole, w-ins*2, h-ins*2, 0, 0);
  else {                                            // 라운드 모서리 사각
    const r=Math.min(w,h)*0.1, x0=-w/2+ins, x1=w/2-ins, y0=-h/2+ins, y1=h/2-ins;
    hole.moveTo(x0+r,y0); hole.lineTo(x1-r,y0); hole.quadraticCurveTo(x1,y0,x1,y0+r);
    hole.lineTo(x1,y1-r); hole.quadraticCurveTo(x1,y1,x1-r,y1);
    hole.lineTo(x0+r,y1); hole.quadraticCurveTo(x0,y1,x0,y1-r);
    hole.lineTo(x0,y0+r); hole.quadraticCurveTo(x0,y0,x0+r,y0); hole.closePath();
  }
  outer.holes.push(hole);
  const geo=new THREE.ExtrudeGeometry(outer,{ depth:WT, bevelEnabled:false, curveSegments:28 });
  geo.translate(0,0,-WT/2);
  const mesh=new THREE.Mesh(geo,m); mesh.castShadow=true; mesh.receiveShadow=true;
  placeInWall(mesh, wall, spec.cu, spec.cy);
  return mesh;
}

/* ============================================================
   메인: 방 조립. async (GLB 로드 대기).
   반환: { room, shells, windows, glassMeshes, winPos }
============================================================ */
export function buildHouse(GRAIN, roomDefIn, winPresets, doorPresets={}, finishes=null, furnPresets={}, lightPresets={}, shadePresets={}){
  // 마감재 id(wall/floor/ceil) → 색·거칠기로 확장 (id 없으면 기존 wallColor 등 그대로)
  const roomDef=applyFinishes(roomDefIn, finishes);
  // ★ 이 방의 치수 적용 (없으면 기본 7×7×4)
  const sz=roomDef.size||{};
  CW=sz.w||RW; CD=sz.d||RD; CH=sz.h||RH;
  let shellPartIdx=0;                     // 내벽 shell 키 자동번호
  const occluders=[];                     // ★ 조도 차폐체(OBB) — 칸막이 조각 + 가구
  const room=new THREE.Group();
  const shells={};              // 컷어웨이 대상(벽·바닥·천장). 유리벽/프레임 제외.
  const glassMeshes=[];         // 하늘색 틴트 갱신 대상
  const glazedPanes=[];         // ★ 실내 반투과 유리(베란다 거실창) — 조도 감쇠용
  const winWorld=[];            // 창 월드 위치(엔진 winPos 계산)

  const glassWalls = roomDef.glassWalls || [];

  /* ★ 윤곽 — 직사각 껍데기에서 도려낼 구역들.
     T자·L자 평면을 만들려고 쓴다. 도려낸 자리는 '집 밖'이라
     바닥·천장을 안 깔고, 그 자리에 닿는 외벽 구간도 없앤다.
     cut = { x0,z0,x1,z1 } (m, 방 중심 원점) */
  const cutouts = (roomDef.cutouts || []).map(c => ({
    x0: Math.min(c.x0, c.x1), x1: Math.max(c.x0, c.x1),
    z0: Math.min(c.z0, c.z1), z1: Math.max(c.z0, c.z1)
  }));
  /* 외벽 안쪽면 기준 사각형. 마감(ㄱ자)을 위해 벽 두께 절반만큼 밖으로 넓힌다. */
  const HW = CW/2 + WT/2, HD = CD/2 + WT/2;
  /* 도려낼 구역도 방 경계에 닿으면 같이 넓혀야 바깥에 띠가 안 남는다 */
  const cutSlab = cutouts.map(c => ({
    x0: c.x0 <= -CW/2 + 1e-6 ? -HW : c.x0,
    x1: c.x1 >=  CW/2 - 1e-6 ?  HW : c.x1,
    y0: c.z0 <= -CD/2 + 1e-6 ? -HD : c.z0,
    y1: c.z1 >=  CD/2 - 1e-6 ?  HD : c.z1
  }));
  /* 슬래브 조각들 — 1m 타일로 쪼개면 z-fighting 점선이 생기므로 '큰 조각'만 만든다 */
  const slabPieces = cutouts.length
    ? rectMinus({ x0:-HW, y0:-HD, x1:HW, y1:HD }, cutSlab)
    : [{ x0:-HW, y0:-HD, x1:HW, y1:HD }];

  /* 어떤 외벽의 어느 u구간이 도려내졌는지 — 그 구간엔 벽을 안 세운다 */
  function cutSpansOn(wall){
    const out=[];
    for(const c of cutouts){
      if(wall==='back'  && c.z0 <= -CD/2 + 1e-6) out.push([c.x0, c.x1]);
      if(wall==='front' && c.z1 >=  CD/2 - 1e-6) out.push([c.x0, c.x1]);
      if(wall==='left'  && c.x0 <= -CW/2 + 1e-6) out.push([c.z0, c.z1]);
      if(wall==='right' && c.x1 >=  CW/2 - 1e-6) out.push([c.z0, c.z1]);
    }
    return out;
  }

  /* ★ 조도 엔진이 볼 창 목록. roomDef.windows(진짜 창) + glassWalls(유리벽)를 합친다.
     유리벽을 여기 안 넣으면 온실처럼 '화면엔 유리인데 조도 0'인 방이 생긴다.
     ※ 지붕 유리(ceiling:'glass')는 아직 못 넣는다 — 엔진 창 법선에 y성분이 없다.
        docs/greenhouse_plan.md의 C단계에서 해결. */
  const facing = roomDef.facing || 'south';       // back 벽 바깥이 향하는 방위
  /* 차광 — 창유리(τ0.92 = -8%)와 자릿수가 다르다(0.30~0.55 = -45~70%).
     창별로 따로 걸 수 있어야 "동쪽만 가리고 서쪽은 열어둔다"가 된다. */
  const shadeMult = id => {
    if(!id || id==='none') return 1;
    const sp=(shadePresets.presets||shadePresets)[id];
    if(!sp) return 1;
    return sp.mult!=null ? sp.mult : 1;           // 자동 블라인드(mult:null)는 런타임에서 정한다
  };
  const luxWins=[];
  for(const w of (roomDef.windows||[])){
    const p=winPresets[w.preset]||{};
    // 창 스펙의 tau가 프리셋보다 우선(베란다 새시처럼 유리만 다른 경우)
    const tau = w.tau ?? ((p.glass&&p.glass.transmittance)!=null ? p.glass.transmittance : 0.85);
    const orient=w.orient||wallOrient(facing, w.wall);
    const sh=shadeMult(w.shade);
    luxWins.push({ wall:w.wall, cu:w.cu, cy:w.cy, w:w.w, h:w.h, tau,
                   orient, shade:w.shade||'none', shadeMult:sh,
                   evScale:orientK(orient)*sh, from:'window' });
  }
  /* ★ 천창 — ceiling:'glass' 인 방은 지붕 전체가 개구부다.
     수평면은 하늘 반구를 통째로 봐서 벽 유리보다 훨씬 세다. */
  if(roomDef.ceiling==='glass'){
    const go=wallOrient(facing,'ceiling');
    const sh=shadeMult(roomDef.ceilingShade);
    luxWins.push({ wall:'ceiling', cu:0, cy:CH, w:CW-0.1, h:CD-0.1,
                   tau:roomDef.ceilingTau ?? 0.85,
                   orient:go, shade:roomDef.ceilingShade||'none', shadeMult:sh,
                   evScale:orientK(go)*sh, from:'skylight' });
  }

  // ---------- 바닥: 통판 1장 (조각 이음새 z-fighting 방지). 결/칸은 텍스처로 ----------
  {
    const ftex=finishTexture(roomDef.floorPattern, CW) || GRAIN;
    const floorMat=surfaceMat(roomDef.floorColor, roomDef.floorRough??0.8, ftex);
    const g=new THREE.Group();
    // ★ 벽 바깥면까지 늘려 ㄱ자로 마감(±(CW/2+WT/2)).
    //   cutouts가 있으면 그 자리는 빼고 큰 조각으로만 깐다(타일로 쪼개면 점선 이음새가 생김).
    for(const r of slabPieces)
      g.add(box(r.x1-r.x0, WT, r.y1-r.y0, floorMat, (r.x0+r.x1)/2, -WT/2, (r.y0+r.y1)/2, false));
    g.userData={ normal:[0,-1,0], center:[0,0,0] };
    shells.floor=g; room.add(g);
  }

  // ---------- 천장: 유리 or 1m 솔리드 타일 ----------
  if(roomDef.ceiling==='glass'){
    const gm=makeGlassMaterial();
    const glass=new THREE.Mesh(new THREE.PlaneGeometry(CW-0.1,CD-0.1), gm);
    glass.rotation.x=Math.PI/2; glass.position.set(0,CH,0);
    glassMeshes.push(glass); room.add(glass);
    // 지붕 뼈대(코드 격자 살) 얹기
    tileGlassFrames(room, 'ceiling');
  }else{
    const ceilMat=surfaceMat(roomDef.ceilColor||'#f6f2ea',0.95, GRAIN);
    const g=new THREE.Group();
    for(const r of slabPieces)                                     // 통판 + ㄱ자 마감 - 도려낸 자리
      g.add(box(r.x1-r.x0, WT, r.y1-r.y0, ceilMat, (r.x0+r.x1)/2, CH+WT/2, (r.y0+r.y1)/2, false));
    g.userData={ normal:[0,1,0], center:[0,CH,0] };
    shells.ceiling=g; room.add(g);
  }

  // ---------- 벽 4면 ----------
  const wallNormals={ back:[0,0,-1], front:[0,0,1], left:[-1,0,0], right:[1,0,0] };
  const wallCenters={ back:[0,CH/2,-CD/2], front:[0,CH/2,CD/2], left:[-CW/2,CH/2,0], right:[CW/2,CH/2,0] };

  for(const wall of ['back','front','left','right']){
    const kind=glassWalls.includes(wall)?'glass':'solid';
    const [uMin,uMax]=wallURange(wall);
    // ★ 유리벽도 조도 엔진엔 '창'이다. buildGlassWall이 실제로 만드는 유리판과
    //   같은 치수(-0.1)를 쓴다 — 겉(유리판)과 속(조도)이 어긋나지 않게.
    if(kind==='glass'){
      const go=wallOrient(facing, wall);
      const sh=shadeMult((roomDef.glassWallShade||{})[wall] || roomDef.glassWallShade);
      luxWins.push({ wall, cu:(uMin+uMax)/2, cy:CH/2, w:(uMax-uMin)-0.1, h:CH-0.1,
                     tau:0.85, orient:go, shade:'none', shadeMult:sh,
                     evScale:orientK(go)*sh, from:'glassWall' });
    }
    const g=new THREE.Group();
    g.userData={ normal:wallNormals[wall], center:wallCenters[wall] };

    // 이 벽의 개구부(창+문) → local (u,v) 사각형
    const openings=[];
    for(const w of (roomDef.windows||[])) if(w.wall===wall)
      openings.push({ x0:w.cu-w.w/2, y0:w.cy-w.h/2, x1:w.cu+w.w/2, y1:w.cy+w.h/2, spec:w });
    for(const d of (roomDef.doors||[])) if(d.wall===wall)
      openings.push({ x0:d.cu-d.w/2, y0:0, x1:d.cu+d.w/2, y1:d.h, spec:{...d, module:'door'} });
    /* ★ 윤곽에서 도려낸 구간 — 천장까지 통으로 빼서 벽을 안 세운다(집 밖이므로).
       spec이 없으니 아래 프레임/걸레받이 루프에서도 자동으로 건너뛴다. */
    const cutSpans = cutSpansOn(wall);
    for(const [a,b] of cutSpans) openings.push({ x0:a, y0:0, x1:b, y1:CH });

    if(kind==='glass'){
      // 유리벽: 솔리드 패널 없이 큰 유리 + 코드 격자 살(문서: 온실 유리벽)
      buildGlassWall(room, glassMeshes, wall, uMin, uMax);
      tileGlassFrames(room, wall, uMin, uMax);
    }else{
      // 솔리드 벽: 1m 모듈 파스텔 패널 - 개구부
      const wmat=surfaceMat(roomDef.wallColor, roomDef.wallRough??0.9, GRAIN);
      for(const r of panelRects(uMin,uMax, 0,CH, openings)){
        g.add(panelToBox(wall, r, wmat));
      }
      // ★ 원형·아치·라운드 창은 bbox 자리에 '형태대로 뚫린' 벽조각을 끼움
      for(const op of openings){
        const spec=op.spec; if(!spec || spec.module==='door') continue;
        const p=resolveWindowPreset(spec, winPresets);
        if(isShaped(p)) g.add(shapedFiller(wall, spec, p, wmat));
      }
      // 걸레받이(개구부 아닌 바닥 라인만)
      addSkirting(g, wall, uMin, uMax, openings);
    }
    shells[wall]=g; room.add(g);

    // 개구부에 코드 프레임 + 유리 끼우기 (문/창 공통). 프리셋 룩 적용.
    for(const op of openings){
      const spec=op.spec;
      if(!spec) continue;                       // 윤곽 도려내기 구간 — 창틀 없음
      if(spec.module==='door'){
        // 문 프리셋(doorPresets) + 인라인 병합. 유리문이면 유리 quad도 끼움.
        const dp={ ...(doorPresets[spec.preset]||{}), ...spec };
        const door=buildDoor(spec.w, spec.h, { frameColor:dp.frameColor||'#f4efe4', gloss:dp.gloss||'satin' });
        placeInWall(door, wall, spec.cu, spec.h/2);
        g.add(door);                                // 문은 벽과 함께 컷어웨이
        if(dp.glass && dp.glass.type && dp.glass.type!=='none'){
          const gm=glassMaterial(dp.glass);
          if(gm){ const gl=makeGlassPane(wall, spec.cu, spec.h*0.62, spec.w*0.55, spec.h*0.45, gm, 'rect');
            glassMeshes.push(gl.mesh); g.add(gl.mesh); }
        }
      }else{
        const p=resolveWindowPreset(spec, winPresets);   // 프리셋 id + 인라인 룩 병합
        if(spec.color) p.frameColor=spec.color;          // 방에서 프레임 색 오버라이드
        if(spec.gloss) p.gloss=spec.gloss;
        const frame=buildWindowFrame(spec.w, spec.h, p);
        placeInWall(frame, wall, spec.cu, spec.cy);
        room.add(frame);                            // 창틀은 항상 보이게
        const gmat=glassMaterial(p.glass);          // type별 유리(none이면 null=뻥 뚫림)
        if(gmat){
          const gl=makeGlassPane(wall, spec.cu, spec.cy, spec.w-2*p.FT, spec.h-2*p.FT, gmat, p.shape);
          glassMeshes.push(gl.mesh); room.add(gl.mesh);
        }
        winWorld.push(new THREE.Vector3(...wallPlacement(wall, spec.cu, spec.cy).pos));
      }
    }
  }

  // ---------- ★ 내벽(칸막이) = 공간 분획 (투룸·아파트) ----------
  // partitions: [{ axis:'x'|'z', at:위치, from,to:구간, door:{at,w,h}, arch:bool }]
  // axis 'x' = x=at 에 세워지는 세로벽(z방향으로 뻗음), 'z' = z=at 가로벽(x방향)
  for(const pt of (roomDef.partitions||[])){
    const g=new THREE.Group();
    const pw=surfaceMat(roomDef.wallColor, roomDef.wallRough??0.9, GRAIN);
    const along=(pt.axis==='x') ? CD : CW;                 // 벽이 뻗는 축 길이
    // from/to 생략 = 벽~벽 전체. 지정 시에도 방 밖으로 나가지 않게 클램프하고,
    // 끝이 외벽에 거의 닿으면(0.3m 이내) 딱 붙여 '떠 있는 벽' 틈을 없앤다.
    let uMin=(pt.from!=null)?Math.max(pt.from,-along/2):-along/2;
    let uMax=(pt.to  !=null)?Math.min(pt.to,  along/2): along/2;
    if(uMin> -along/2 && uMin < -along/2+0.3) uMin=-along/2;
    if(uMax<  along/2 && uMax >  along/2-0.3) uMax= along/2;
    const holes=[];
    if(pt.door){                                          // 통로(문틀) 뚫기
      const dw=pt.door.w??0.95, dh=pt.door.h??Math.min(2.05, CH-0.35), da=pt.door.at??0;
      holes.push({ x0:da-dw/2, y0:0, x1:da+dw/2, y1:dh });
    }
    /* ★ 개구부.
       glazing.full 이면 '벽에 창 몇 개'가 아니라 **전면이 유리**다.
       실제 아파트 거실↔베란다가 그렇다 — 전창이고 그중 좌우 몇 짝만 미닫이로 열린다.
       빛은 유리 전면으로 들어오므로 벽 조각(차폐체)을 두면 안 된다. */
    const GY0 = (pt.glazing && pt.glazing.y0) ?? 0.05;
    const GY1 = (pt.glazing && pt.glazing.y1) ?? Math.min(2.30, CH - 0.25);
    if(pt.glazing && pt.glazing.full){
      holes.push({ x0:uMin, y0:GY0, x1:uMax, y1:GY1 });     // 전폭이 통유리
    }else{
      for(const op of (pt.openings||[]))
        holes.push({ x0:(op.at??0)-(op.w??2)/2, y0:op.y0??GY0,
                     x1:(op.at??0)+(op.w??2)/2, y1:op.y1??GY1 });
    }
    for(const r of rectMinus({x0:uMin,y0:0,x1:uMax,y1:CH}, holes)){
      const cu=(r.x0+r.x1)/2, cv=(r.y0+r.y1)/2, du=r.x1-r.x0, dv=r.y1-r.y0;
      if(du<0.001||dv<0.001) continue;
      g.add( pt.axis==='x' ? box(WT*0.7,dv,du, pw, pt.at, cv, cu)
                           : box(du,dv,WT*0.7, pw, cu, cv, pt.at) );
      // ★ 조도 차폐체: 문 구멍을 뺀 '조각'만 넣으므로 통로로는 빛이 지난다.
      //   (외벽은 창 개구부가 있어 통짜 박스로 넣으면 창빛까지 막히므로 제외)
      occluders.push(pt.axis==='x'
        ? { x:pt.at-WT*0.35, z:cu-du/2, w:WT*0.7, d:du, h:r.y1, y0:r.y0, rot:0 }
        : { x:cu-du/2, z:pt.at-WT*0.35, w:du, d:WT*0.7, h:r.y1, y0:r.y0, rot:0 });
    }
    // 열린 끝단(외벽에 안 닿는 쪽)엔 기둥 마감 — 벽이 잘려 떠 있는 것처럼 안 보이게
    const CAP=WT*1.15;
    if(uMin > -along/2+0.001)
      g.add( pt.axis==='x' ? box(CAP,CH,CAP, pw, pt.at, CH/2, uMin+CAP/2)
                           : box(CAP,CH,CAP, pw, uMin+CAP/2, CH/2, pt.at) );
    if(uMax <  along/2-0.001)
      g.add( pt.axis==='x' ? box(CAP,CH,CAP, pw, pt.at, CH/2, uMax-CAP/2)
                           : box(CAP,CH,CAP, pw, uMax-CAP/2, CH/2, pt.at) );

    // ★ 유리 끼우기 + 조도용 반투과 판 등록
    if(pt.glazing){
      const tau = pt.glazing.tau ?? 0.92;
      const bands = pt.glazing.full
        ? [[uMin, uMax]]                                        // 전창
        : (pt.openings||[]).map(op=>[(op.at??0)-(op.w??2)/2, (op.at??0)+(op.w??2)/2]);
      for(const [a0,a1] of bands){
        const wid=a1-a0, mid=(a0+a1)/2, cy=(GY0+GY1)/2, ht=GY1-GY0;
        const gl=new THREE.Mesh(new THREE.PlaneGeometry(wid-0.04, ht-0.04), makeGlassMaterial());
        if(pt.axis==='x'){ gl.rotation.y=Math.PI/2; gl.position.set(pt.at, cy, mid); }
        else             { gl.position.set(mid, cy, pt.at); }
        glassMeshes.push(gl); g.add(gl);
        /* 조도: 이 판을 지나는 광선만 tau만큼 약해진다(차폐가 아니라 감쇠). */
        glazedPanes.push({ axis:pt.axis, at:pt.at, tau, u0:a0, u1:a1, y0:GY0, y1:GY1 });

        /* 미닫이 짝을 나누는 중간 프레임(멀리언). 유리 전면이라 이게 없으면
           그냥 뻥 뚫린 것처럼 보인다. openings 위치를 짝 경계로 쓴다. */
        if(pt.glazing.full){
          const fm=frameMaterial(pt.glazing.frameColor||'#e9eef0','satin');
          const cuts=[a0, ...(pt.openings||[]).flatMap(op=>{
            const w=(op.w??1.5)/2; return [(op.at??0)-w, (op.at??0)+w];
          }).filter(v=>v>a0+0.05&&v<a1-0.05).sort((x,y)=>x-y), a1];
          for(const c of cuts){
            const t=0.055;
            g.add( pt.axis==='x' ? box(WT*0.8, ht, t, fm, pt.at, cy, c)
                                 : box(t, ht, WT*0.8, fm, c, cy, pt.at) );
          }
          // 상·하 프레임
          for(const yy of [GY0, GY1]){
            g.add( pt.axis==='x' ? box(WT*0.8, 0.06, wid, fm, pt.at, yy, mid)
                                 : box(wid, 0.06, WT*0.8, fm, mid, yy, pt.at) );
          }
        }
      }
    }

    // 통로 문틀(케이싱) — 있으면 개구부 가장자리 마감
    if(pt.door && pt.door.frame!==false){
      const dw=pt.door.w??0.95, dh=pt.door.h??Math.min(2.05, CH-0.35), da=pt.door.at??0, ft=0.07;
      const cas=frameMaterial(pt.door.color||'#f4efe4', 'satin');
      const put=(du,dv,cu,cv)=> g.add( pt.axis==='x' ? box(WT*0.75,dv,du, cas, pt.at, cv, cu)
                                                     : box(du,dv,WT*0.75, cas, cu, cv, pt.at) );
      put(ft, dh, da-dw/2+ft/2, dh/2);
      put(ft, dh, da+dw/2-ft/2, dh/2);
      put(dw, ft, da, dh-ft/2);
    }
    g.userData={ normal:pt.axis==='x'?[1,0,0]:[0,0,1], center:pt.axis==='x'?[pt.at,CH/2,0]:[0,CH/2,pt.at], partition:true };
    shells['part_'+(pt.id||shellPartIdx++)]=g; room.add(g);
  }

  // ---------- 가구 배치 (roomDef.furniture) ----------
  // [{ preset, x, z, y(선택: 벽걸이/조명 높이), rot(도), color, spectrum, schedule }]
  const furnGroup=new THREE.Group();
  const lightRigs=[];      // 조명 기구 목록 — 요금·PPFD·스케줄 계산에 사용
  for(const [furnIdx, f] of (roomDef.furniture||[]).entries()){
    const p={ ...(furnPresets[f.preset]||{}), ...f };
    const type=p.type||f.preset;
    const g=buildFurniture(type, p);
    g.userData.furnIdx=furnIdx;      // ★ 집꾸미기: 클릭한 메시 → 원본 배열 인덱스 역추적용
    const hang=g.userData.hangFromCeiling;
    const yBase = f.y!=null ? f.y : (hang ? CH : 0);       // 천장 매달림/벽걸이 높이
    g.position.set(f.x??0, yBase, f.z??0);
    if(f.rot) g.rotation.y=f.rot*Math.PI/180;
    furnGroup.add(g);
    // ★ 조도 차폐체로 등록 (러그·조명처럼 빛을 막지 않는 것은 제외)
    const fsz=g.userData.size;
    if(fsz && fsz.h>0.25 && !/^rug|^lamp|light|^picture|^wall_clock|^mirror/.test(type)){
      g.userData.occIdx = occluders.length;   // 자기 자신은 자기 슬롯을 가리지 않게(자가차폐 방지)
      occluders.push({ x:(f.x??0)-fsz.w/2, z:(f.z??0)-fsz.d/2,
                       w:fsz.w, d:fsz.d, h:fsz.h, y0:yBase, rot:(f.rot||0)*Math.PI/180 });
    }

    // ★ 조명 기구면 실제 광원 생성 (밤 연출·거리감쇠 시각화)
    const fxSpec=(lightPresets.fixtures||{})[f.preset];
    if(fxSpec){
      const specId=f.spectrum||fxSpec.spectrum||'full';
      const sp=(lightPresets.spectra||{})[specId]||{color:'#fff4e2'};
      const emitY = yBase + (hang ? -(g.userData.size?.h||0.4)*0.8 : (g.userData.size?.h||0.4)*0.92);
      const L=new THREE.PointLight(col(sp.color), 0, (fxSpec.coverage_r||0.5)*6, 2);
      L.position.set(f.x??0, emitY, f.z??0);
      L.castShadow=false;                                  // 보조광 — 그림자맵 절약
      furnGroup.add(L);
      lightRigs.push({ id:f.preset, fx:fxSpec, spec:sp, specId,
        schedule:f.schedule||fxSpec.default_schedule||'off',
        light:L, shade:g.userData.lampShade||null,
        pos:{x:f.x??0,y:emitY,z:f.z??0}, grow:!!fxSpec.grow });
    }
  }
  if(furnGroup.children.length) room.add(furnGroup);

  // 가구 위 화분 슬롯을 월드좌표로 수집 (조도 계산·배치용)
  const plantSlots=[];
  furnGroup.traverse(o=>{
    if(!o.userData||!o.userData.slots) return;
    const base=o.position, rot=o.rotation.y||0, c=Math.cos(rot), s=Math.sin(rot);
    o.userData.slots.forEach((sl,i)=>{
      plantSlots.push({
        owner:o.userData.type, idx:i,
        x:+(base.x + sl.x*c + sl.z*s).toFixed(3),
        y:+(base.y + sl.y).toFixed(3),
        z:+(base.z - sl.x*s + sl.z*c).toFixed(3),
        maxPotD:(o.userData.tier_max_pot_d||[])[Math.min(i,(o.userData.tier_max_pot_d||[]).length-1)],
        occIdx:o.userData.occIdx
      });
    });
  });

  // 그림자: 껍데기 6면 모두 던지고/받게 (숨겨도 빛 막게)
  for(const k in shells) shells[k].traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; } });

  // 엔진 winPos = 첫 창(없으면 뒷벽 기본)
  const winPos = winWorld[0] || new THREE.Vector3(0.6,2.2,-CD/2+0.05);

  return { room, shells, windows:winWorld, glassMeshes, winPos, size:{ w:CW, d:CD, h:CH },
           furniture:furnGroup, lightRigs, plantSlots, occluders, luxWins, glazedPanes, facing };
}

/* ---- 원점 중심 그룹을 벽에 앉힌다 (위치 + Y회전) ---- */
function placeInWall(obj, wall, cu, cy){
  const p=wallPlacement(wall, cu, cy);
  obj.position.set(...p.pos); obj.rotation.y=p.roty;
}

/* ---- 유리 quad (프레임 안쪽, gw×gh = 안쪽 개구부 크기). gm=프리셋 유리 재질, shape=형태 ---- */
function makeGlassPane(wall, cu, cy, gw, gh, gm, shape){
  const mesh=new THREE.Mesh(glassGeometry(shape, gw, gh), gm||makeGlassMaterial());
  const p=wallPlacement(wall, cu, cy);
  mesh.position.set(...p.pos); mesh.rotation.y=p.roty;
  return { mesh, world:new THREE.Vector3(...p.pos) };
}

/* ---- 온실 유리벽: 벽 전체를 덮는 큰 유리 + 하단 낮은 문턱 ---- */
function buildGlassWall(room, glassMeshes, wall, uMin, uMax){
  const width=uMax-uMin;
  const gm=makeGlassMaterial();
  const glass=new THREE.Mesh(new THREE.PlaneGeometry(width-0.1, CH-0.1), gm);
  const p=wallPlacement(wall, (uMin+uMax)/2, CH/2);
  glass.position.set(...p.pos); glass.rotation.y=p.roty;
  glassMeshes.push(glass); room.add(glass);
}

/* ---- 온실 격자 살: 큰 코드 프레임(커튼월 3×2) 하나로 멀리언 ---- */
function tileGlassFrames(room, wall, uMin, uMax){
  const fmat=frameMaterial(FRAME_DEFAULTS.frameColor, 'satin');
  const opts={ cols:3, rows:2, pattern:'curtainwall', material:fmat };
  if(wall==='ceiling'){
    // 천장 유리 격자: XY평면 프레임을 눕힌다.
    const frame=buildWindowFrame(CW-0.1, CD-0.1, opts);
    frame.rotation.x=Math.PI/2; frame.position.set(0, CH-0.01, 0);
    room.add(frame); return;
  }
  // 수직 유리벽: 벽 전체 크기 프레임
  const width=uMax-uMin;
  const frame=buildWindowFrame(width-0.02, CH-0.02, opts);
  placeInWall(frame, wall, (uMin+uMax)/2, CH/2);
  room.add(frame);
}

/* ---- 걸레받이: 벽 하단, 개구부(문) 자리는 비움 ---- */
function addSkirting(g, wall, uMin, uMax, openings){
  const skirt=mat('#efeae1',0.7);   // 연한 크림 걸레받이
  // spec 없는 항목 = 윤곽 도려내기 구간. 거기도 걸레받이를 비운다.
  const doorHoles=openings.filter(o=>!o.spec || o.spec.module==='door');
  for(const r of rectMinus({x0:uMin,y0:0,x1:uMax,y1:0.22},
      doorHoles.map(o=>({x0:o.x0,y0:0,x1:o.x1,y1:0.22})))){
    const cu=(r.x0+r.x1)/2, du=r.x1-r.x0;
    if(wall==='back')  g.add(box(du,0.22,0.06,skirt,cu,0.11,-CD/2+0.13,false));
    if(wall==='front') g.add(box(du,0.22,0.06,skirt,cu,0.11, CD/2-0.13,false));
    if(wall==='left')  g.add(box(0.06,0.22,du,skirt,-CW/2+0.13,0.11,cu,false));
    if(wall==='right') g.add(box(0.06,0.22,du,skirt, CW/2-0.13,0.11,cu,false));
  }
}

/* ============================================================
   컷어웨이(심즈2): 카메라가 가리는 면만 투명화. 그림자는 유지.
   room.js와 동일 규약. 유리벽/창프레임은 shells에 없으므로 안 가림.
============================================================ */
export function updateShellVisibility(shells, cam){
  const cp=cam.position;
  for(const key in shells){
    const sh=shells[key]; const { normal, center, partition }=sh.userData;
    const dot=(cp.x-center[0])*normal[0]+(cp.y-center[1])*normal[1]+(cp.z-center[2])*normal[2];
    // 내벽(칸막이)은 방 안쪽이라 숨기지 않는다 — 공간 분획이 보여야 함
    const hide = partition ? false : (dot >= 0.3);

    // ★ 성능: 상태가 바뀔 때만 재질을 건드린다.
    //   material.transparent 를 매 프레임 토글하면 three가 셰이더 프로그램을
    //   다시 고르게 되어(재컴파일) 카메라를 돌릴 때 눈에 띄게 버벅인다.
    if(sh.userData._hidden === hide) continue;
    sh.userData._hidden = hide;

    sh.traverse(o=>{
      if(!o.isMesh || !o.material) return;
      o.visible=true;
      const set=mm=>{
        if(hide){ mm.transparent=true; mm.opacity=0; mm.depthWrite=false; }
        else    { mm.opacity=1; mm.depthWrite=true; mm.transparent=false; }
        mm.needsUpdate=true;
      };
      Array.isArray(o.material)?o.material.forEach(set):set(o.material);
      o.castShadow=true;      // 숨겨도 그림자는 계속 던져 빛을 막는다
    });
  }
}
