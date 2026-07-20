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

   좌표: 방을 원점 중심에 둔다. 바닥 y=0, 천장 y=RH.
   벽 바깥법선(outward)으로 컷어웨이 판정.
============================================================ */
import { mat, box, col } from './util.js';
import { buildWindowFrame, buildDoor, glassMaterial, glassGeometry, frameMaterial,
         resolveWindowPreset, FRAME_DEFAULTS } from './window_frame.js';

export const RW=7, RD=7, RH=4;           // 발판 폭·깊이·높이 (프리셋 공통, 엔진 호환)
const WT=0.2;                            // 벽 두께
const GRID=1;                            // ★ 1m 모듈 단위

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

/* 벽면을 1m 격자로 쪼갠 뒤 각 셀에서 개구부를 빼 조각 리스트 반환.
   → 진짜 '1m 모듈' 벽. u:[uMin,uMax], v:[vMin,vMax], openings in (u,v). */
function panelRects(uMin,uMax,vMin,vMax, openings){
  const out=[];
  for(let u=uMin; u<uMax-1e-6; u+=GRID){
    const cx1=Math.min(u+GRID,uMax);
    for(let v=vMin; v<vMax-1e-6; v+=GRID){
      const cy1=Math.min(v+GRID,vMax);
      const cell={ x0:u, y0:v, x1:cx1, y1:cy1 };
      for(const r of rectMinus(cell, openings)) out.push(r);
    }
  }
  return out;
}

/* 벽-local (u,v) 조각 → 월드 박스. 벽마다 축 매핑이 다르다. */
function panelToBox(wall, r, m){
  const cu=(r.x0+r.x1)/2, cv=(r.y0+r.y1)/2, du=r.x1-r.x0, dv=r.y1-r.y0;
  if(wall==='back')  return box(du,dv,WT, m, cu, cv, -RD/2);
  if(wall==='front') return box(du,dv,WT, m, cu, cv,  RD/2);
  if(wall==='left')  return box(WT,dv,du, m, -RW/2, cv, cu);
  if(wall==='right') return box(WT,dv,du, m,  RW/2, cv, cu);
}

/* 벽 좌표계 범위 (u축 길이·범위) */
function wallURange(wall){
  return (wall==='back'||wall==='front') ? [-RW/2, RW/2] : [-RD/2, RD/2];
}

/* 프레임/유리를 벽에 앉히는 변환 (위치 + Y회전). cu=벽 local u중심 */
function wallPlacement(wall, cu, cy){
  if(wall==='back')  return { pos:[cu, cy, -RD/2],  roty:0 };
  if(wall==='front') return { pos:[cu, cy,  RD/2],  roty:Math.PI };
  if(wall==='left')  return { pos:[-RW/2, cy, cu],  roty:Math.PI/2 };
  if(wall==='right') return { pos:[ RW/2, cy, cu],  roty:-Math.PI/2 };
}

/* ============================================================
   메인: 방 조립. async (GLB 로드 대기).
   반환: { room, shells, windows, glassMeshes, winPos }
============================================================ */
export function buildHouse(GRAIN, roomDef, winPresets){
  const room=new THREE.Group();
  const shells={};              // 컷어웨이 대상(벽·바닥·천장). 유리벽/프레임 제외.
  const glassMeshes=[];         // 하늘색 틴트 갱신 대상
  const winWorld=[];            // 창 월드 위치(엔진 winPos 계산)

  const glassWalls = roomDef.glassWalls || [];

  // ---------- 바닥: 1m 타일 격자 ----------
  {
    const floorMat=surfaceMat(roomDef.floorColor, roomDef.floorRough??0.8, GRAIN);
    const g=new THREE.Group();
    for(let x=-RW/2; x<RW/2-1e-6; x+=GRID){ const w=Math.min(GRID,RW/2-x);
      for(let z=-RD/2; z<RD/2-1e-6; z+=GRID){ const d=Math.min(GRID,RD/2-z);
        g.add(box(w,WT,d, floorMat, x+w/2, -WT/2, z+d/2, false));
      }}
    g.userData={ normal:[0,-1,0], center:[0,0,0] };
    shells.floor=g; room.add(g);
  }

  // ---------- 천장: 유리 or 1m 솔리드 타일 ----------
  if(roomDef.ceiling==='glass'){
    const gm=makeGlassMaterial();
    const glass=new THREE.Mesh(new THREE.PlaneGeometry(RW-0.1,RD-0.1), gm);
    glass.rotation.x=Math.PI/2; glass.position.set(0,RH,0);
    glassMeshes.push(glass); room.add(glass);
    // 지붕 뼈대(코드 격자 살) 얹기
    tileGlassFrames(room, 'ceiling');
  }else{
    const ceilMat=surfaceMat(roomDef.ceilColor||'#f6f2ea',0.95, GRAIN);
    const g=new THREE.Group();
    for(let x=-RW/2; x<RW/2-1e-6; x+=GRID){ const w=Math.min(GRID,RW/2-x);
      for(let z=-RD/2; z<RD/2-1e-6; z+=GRID){ const d=Math.min(GRID,RD/2-z);
        g.add(box(w,WT,d, ceilMat, x+w/2, RH+WT/2, z+d/2, false));
      }}
    g.userData={ normal:[0,1,0], center:[0,RH,0] };
    shells.ceiling=g; room.add(g);
  }

  // ---------- 벽 4면 ----------
  const wallNormals={ back:[0,0,-1], front:[0,0,1], left:[-1,0,0], right:[1,0,0] };
  const wallCenters={ back:[0,RH/2,-RD/2], front:[0,RH/2,RD/2], left:[-RW/2,RH/2,0], right:[RW/2,RH/2,0] };

  for(const wall of ['back','front','left','right']){
    const kind=glassWalls.includes(wall)?'glass':'solid';
    const [uMin,uMax]=wallURange(wall);
    const g=new THREE.Group();
    g.userData={ normal:wallNormals[wall], center:wallCenters[wall] };

    // 이 벽의 개구부(창+문) → local (u,v) 사각형
    const openings=[];
    for(const w of (roomDef.windows||[])) if(w.wall===wall)
      openings.push({ x0:w.cu-w.w/2, y0:w.cy-w.h/2, x1:w.cu+w.w/2, y1:w.cy+w.h/2, spec:w });
    for(const d of (roomDef.doors||[])) if(d.wall===wall)
      openings.push({ x0:d.cu-d.w/2, y0:0, x1:d.cu+d.w/2, y1:d.h, spec:{...d, module:'door'} });

    if(kind==='glass'){
      // 유리벽: 솔리드 패널 없이 큰 유리 + 코드 격자 살(문서: 온실 유리벽)
      buildGlassWall(room, glassMeshes, wall, uMin, uMax);
      tileGlassFrames(room, wall, uMin, uMax);
    }else{
      // 솔리드 벽: 1m 모듈 파스텔 패널 - 개구부
      const wmat=surfaceMat(roomDef.wallColor, roomDef.wallRough??0.9, GRAIN);
      for(const r of panelRects(uMin,uMax, 0,RH, openings)){
        g.add(panelToBox(wall, r, wmat));
      }
      // 걸레받이(개구부 아닌 바닥 라인만)
      addSkirting(g, wall, uMin, uMax, openings);
    }
    shells[wall]=g; room.add(g);

    // 개구부에 코드 프레임 + 유리 끼우기 (문/창 공통). 프리셋 룩 적용.
    for(const op of openings){
      const spec=op.spec;
      if(spec.module==='door'){
        const door=buildDoor(spec.w, spec.h, {});   // 재질 자체 clone → 컷어웨이 격리
        placeInWall(door, wall, spec.cu, spec.h/2);
        g.add(door);                                // 문은 벽과 함께 컷어웨이
      }else{
        const p=resolveWindowPreset(spec, winPresets);   // 프리셋 id + 인라인 룩 병합
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

  // 그림자: 껍데기 6면 모두 던지고/받게 (숨겨도 빛 막게)
  for(const k in shells) shells[k].traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; } });

  // 엔진 winPos = 첫 창(없으면 뒷벽 기본)
  const winPos = winWorld[0] || new THREE.Vector3(0.6,2.2,-RD/2+0.05);

  return { room, shells, windows:winWorld, glassMeshes, winPos };
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
  const glass=new THREE.Mesh(new THREE.PlaneGeometry(width-0.1, RH-0.1), gm);
  const p=wallPlacement(wall, (uMin+uMax)/2, RH/2);
  glass.position.set(...p.pos); glass.rotation.y=p.roty;
  glassMeshes.push(glass); room.add(glass);
}

/* ---- 온실 격자 살: 큰 코드 프레임(커튼월 3×2) 하나로 멀리언 ---- */
function tileGlassFrames(room, wall, uMin, uMax){
  const fmat=frameMaterial(FRAME_DEFAULTS.frameColor, 'satin');
  const opts={ cols:3, rows:2, pattern:'curtainwall', material:fmat };
  if(wall==='ceiling'){
    // 천장 유리 격자: XY평면 프레임을 눕힌다.
    const frame=buildWindowFrame(RW-0.1, RD-0.1, opts);
    frame.rotation.x=Math.PI/2; frame.position.set(0, RH-0.01, 0);
    room.add(frame); return;
  }
  // 수직 유리벽: 벽 전체 크기 프레임
  const width=uMax-uMin;
  const frame=buildWindowFrame(width-0.02, RH-0.02, opts);
  placeInWall(frame, wall, (uMin+uMax)/2, RH/2);
  room.add(frame);
}

/* ---- 걸레받이: 벽 하단, 개구부(문) 자리는 비움 ---- */
function addSkirting(g, wall, uMin, uMax, openings){
  const skirt=mat('#efeae1',0.7);   // 연한 크림 걸레받이
  const doorHoles=openings.filter(o=>o.spec.module==='door');
  for(const r of rectMinus({x0:uMin,y0:0,x1:uMax,y1:0.22},
      doorHoles.map(o=>({x0:o.x0,y0:0,x1:o.x1,y1:0.22})))){
    const cu=(r.x0+r.x1)/2, du=r.x1-r.x0;
    if(wall==='back')  g.add(box(du,0.22,0.06,skirt,cu,0.11,-RD/2+0.13,false));
    if(wall==='front') g.add(box(du,0.22,0.06,skirt,cu,0.11, RD/2-0.13,false));
    if(wall==='left')  g.add(box(0.06,0.22,du,skirt,-RW/2+0.13,0.11,cu,false));
    if(wall==='right') g.add(box(0.06,0.22,du,skirt, RW/2-0.13,0.11,cu,false));
  }
}

/* ============================================================
   컷어웨이(심즈2): 카메라가 가리는 면만 투명화. 그림자는 유지.
   room.js와 동일 규약. 유리벽/창프레임은 shells에 없으므로 안 가림.
============================================================ */
export function updateShellVisibility(shells, cam){
  const cp=cam.position;
  for(const key in shells){
    const sh=shells[key]; const { normal, center }=sh.userData;
    const dot=(cp.x-center[0])*normal[0]+(cp.y-center[1])*normal[1]+(cp.z-center[2])*normal[2];
    const hide = dot >= 0.3;
    sh.traverse(o=>{
      if(!o.isMesh || !o.material) return;
      o.visible=true;
      const set=mm=>{
        if(hide){ mm.transparent=true; mm.opacity=0; mm.depthWrite=false; }
        else    { mm.opacity=1; mm.depthWrite=true; mm.transparent=false; }
      };
      Array.isArray(o.material)?o.material.forEach(set):set(o.material);
      o.castShadow=true;
    });
  }
}
