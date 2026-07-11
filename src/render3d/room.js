/* ============================================================
   render3d/room.js — 방 (밀폐 6면 + 창 개구부 + 심즈2 컷어웨이)
   ------------------------------------------------------------
   ★ 필수 스펙:
   - 방은 6면 다 존재 (겉엔 안 보여도 그림자로 빛을 막아야 함)
   - 빛은 창(개구부)으로만 → 뒷벽은 창 구멍 뺀 4조각
   - 카메라가 가리는 면은 '투명화'(opacity 0)하되 castShadow 유지
     → visible=false 로 숨기면 그림자도 꺼져 빛이 새어들어옴 (금지)
============================================================ */
import { mat, box } from './util.js';

export const RW=7, RD=7, RH=4;            // 방 폭·깊이·높이
// 창 개구부 파라미터 (뒷벽 구멍과 창틀이 공유)
const WIN={ cx:0.6, cy:2.2, w:2.6, h:2.4 };

export function buildRoom(TEX){
  const room=new THREE.Group();
  const shells={};

  const brickMat=mat('#8a5a44',0.95,TEX.brick);
  const floorMat=mat('#b8895c',0.9,TEX.woodFloor);
  const ceilMat =mat('#e8e0d4',0.95);
  const wt=0.2; // 벽 두께

  // ===== 6면 껍데기 (카메라 각도로 숨김 대상) =====
  shells.floor = box(RW,wt,RD,floorMat,0,-wt/2,0);
  shells.floor.userData={ normal:[0,-1,0], center:[0,0,0] };
  room.add(shells.floor);

  shells.ceiling = box(RW,wt,RD,ceilMat,0,RH+wt/2,0);
  shells.ceiling.userData={ normal:[0,1,0], center:[0,RH,0] };
  room.add(shells.ceiling);

  buildBackWallWithHole(room, shells, brickMat, wt);   // 뒷벽(-z): 창 구멍 뺀 4조각

  shells.front = box(RW,RH,wt,brickMat,0,RH/2,RD/2);
  shells.front.userData={ normal:[0,0,1], center:[0,RH/2,RD/2] };
  room.add(shells.front);

  shells.left = box(wt,RH,RD,brickMat,-RW/2,RH/2,0);
  shells.left.userData={ normal:[-1,0,0], center:[-RW/2,RH/2,0] };
  room.add(shells.left);

  shells.right = box(wt,RH,RD,brickMat,RW/2,RH/2,0);
  shells.right.userData={ normal:[1,0,0], center:[RW/2,RH/2,0] };
  room.add(shells.right);

  // 걸레받이
  const skirt=mat('#e8ddd0',0.7);
  room.add(box(RW,0.25,0.1,skirt,0,0.12,-RD/2+0.12,false));
  room.add(box(0.1,0.25,RD,skirt,-RW/2+0.12,0.12,0,false));

  // 창틀 + 유리
  const { winPos, glass } = buildWindow(room);

  // 껍데기 6면 모두 그림자 던지고 받게 (숨겨도 빛 막게)
  for(const key in shells){
    shells[key].traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; } });
  }

  return { room, shells, winPos, glass };
}

function buildBackWallWithHole(room, shells, brickMat, wt){
  const wz=-RD/2;
  const g=new THREE.Group();
  const wl=WIN.cx-WIN.w/2, wr=WIN.cx+WIN.w/2;
  const wb=WIN.cy-WIN.h/2, wtop=WIN.cy+WIN.h/2;
  // 좌측 조각 (벽 왼끝 ~ 창 왼쪽)
  const leftW=wl-(-RW/2);
  g.add(box(leftW,RH,wt,brickMat, -RW/2+leftW/2, RH/2, wz));
  // 우측 조각 (창 오른쪽 ~ 벽 오른끝)
  const rightW=(RW/2)-wr;
  g.add(box(rightW,RH,wt,brickMat, wr+rightW/2, RH/2, wz));
  // 창 위
  const topH=RH-wtop;
  g.add(box(WIN.w,topH,wt,brickMat, WIN.cx, wtop+topH/2, wz));
  // 창 아래
  const botH=wb;
  g.add(box(WIN.w,botH,wt,brickMat, WIN.cx, botH/2, wz));
  g.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; } });
  g.userData={ normal:[0,0,-1], center:[0,RH/2,wz] };
  shells.back=g;
  room.add(g);
}

function buildWindow(room){
  const g=new THREE.Group();
  const fw=WIN.w, fh=WIN.h, fy=WIN.cy, fz=-RD/2+0.05;
  const winPos=new THREE.Vector3(WIN.cx,fy,fz);
  // 유리 (하늘색 발광 — updateLight에서 하늘색 갱신)
  const glass=new THREE.Mesh(new THREE.PlaneGeometry(fw,fh),
    new THREE.MeshBasicMaterial({ color:0xcfe8f5, transparent:true, opacity:0.55 }));
  glass.position.set(WIN.cx,fy,fz+0.03); g.add(glass);
  // 프레임
  const fm=mat('#5a4436',0.7); const t=0.16;
  g.add(box(fw+0.3,t,0.24,fm,WIN.cx,fy+fh/2,fz));
  g.add(box(fw+0.3,t,0.24,fm,WIN.cx,fy-fh/2,fz));
  g.add(box(t,fh,0.24,fm,WIN.cx-fw/2,fy,fz));
  g.add(box(t,fh,0.24,fm,WIN.cx+fw/2,fy,fz));
  g.add(box(0.1,fh,0.18,fm,WIN.cx,fy,fz));
  g.add(box(fw,0.1,0.18,fm,WIN.cx,fy,fz));
  g.add(box(fw+0.5,0.14,0.44,mat('#c8b89a',0.7),WIN.cx,fy-fh/2-0.07,fz+0.12,false)); // 창턱
  room.add(g);
  return { winPos, glass };
}

// ===== 심즈2 컷어웨이: 카메라가 가리는 면 투명화 (그림자는 유지) =====
export function updateShellVisibility(shells, cam){
  const cp=cam.position;
  for(const key in shells){
    const sh=shells[key]; const { normal, center }=sh.userData;
    const toCam=[cp.x-center[0], cp.y-center[1], cp.z-center[2]];
    const dot=toCam[0]*normal[0]+toCam[1]*normal[1]+toCam[2]*normal[2];
    const hide = dot >= 0.3;   // 카메라가 면 바깥쪽 = 앞을 가림 → 투명화
    sh.traverse(o=>{
      if(!o.isMesh || !o.material) return;
      o.visible=true;           // 항상 렌더 대상 (그림자 위해)
      const setMat=(mm)=>{
        if(hide){ mm.transparent=true; mm.opacity=0; mm.depthWrite=false; }
        else    { mm.opacity=1; mm.depthWrite=true; mm.transparent=false; }
      };
      if(Array.isArray(o.material)) o.material.forEach(setMat); else setMat(o.material);
      o.castShadow=true;        // hide여도 그림자는 계속 던짐
    });
  }
}
