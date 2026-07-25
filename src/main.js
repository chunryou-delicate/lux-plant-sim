/* ============================================================
   볕 · 조립 (main.js) — v3 Three.js 3D
   ------------------------------------------------------------
   엔진(lighting.js)은 렌더와 독립. 여기선 render3d 모듈들을 묶어
   3D 방을 그린다. STEP4에서 엔진 격자 lx ↔ 3D 연결 예정.
============================================================ */
import { createScene, updateLight } from './render3d/scene.js';
import { initTextures, faintGrainTexture } from './render3d/textures.js';
import { buildHouse, updateShellVisibility, RW, RD } from './render3d/house.js';
// 가구는 이제 house.js가 방 데이터(roomDef.furniture)로 배치한다 — 옛 furniture.js(임시 박스)는 미사용.
import { sunState, computeLux } from './engine/lighting.js';
import { buildFloorHeatmap, updateFloorHeatmap } from './render3d/lighting_viz.js';

// 데이터: 카탈로그 + 엔진 방(창) 모델 + 집 모듈 프리셋
const catalog = await fetch('./data/catalog.json').then(r=>r.json()).catch(()=>({}));
const roomPresets = await fetch('./data/room_presets.json').then(r=>r.json()).catch(()=>({presets:{},default:''}));
const roomModel = roomPresets.presets[roomPresets.default];
const houseRooms = await fetch('./data/house_rooms.json').then(r=>r.json()).catch(()=>({rooms:{},default:''}));
const winPresets = await fetch('./data/window_presets.json').then(r=>r.json()).then(d=>d.presets||d).catch(()=>({}));
const doorPresets = await fetch('./data/door_presets.json').then(r=>r.json()).then(d=>d.presets||d).catch(()=>({}));
const finishes   = await fetch('./data/room_finishes.json').then(r=>r.json()).catch(()=>null);
const furnPresets= await fetch('./data/furniture_presets.json').then(r=>r.json()).then(d=>d.presets||d).catch(()=>({}));
const lightPresets=await fetch('./data/lighting_presets.json').then(r=>r.json()).catch(()=>({}));

const cv=document.getElementById('cv');
const ctx=createScene(cv);
const GRAIN=faintGrainTexture();          // A미니멀 표면 결(벽·바닥·천장 공용)

// ===== 집(모듈 조립) — 프리셋 전환 가능 =====
let shells;
let curRoom=houseRooms.default||'oneroom';
const houseGroup=new THREE.Group(); ctx.scene.add(houseGroup);

async function buildRoomPreset(name){
  // 이전 방 정리
  while(houseGroup.children.length) houseGroup.remove(houseGroup.children[0]);
  curRoom=name;
  const roomDef=houseRooms.rooms[name];
  const built=buildHouse(GRAIN, roomDef, winPresets, doorPresets, finishes, furnPresets, lightPresets);
  shells=built.shells;
  houseGroup.add(built.room);
  // 방 크기가 바뀌면 바닥 히트맵도 그 크기로 다시 (방마다 5×4, 3×4 등)
  RSIZE=built.size;
  ctx.scene.remove(heatMesh);
  heatMesh=buildFloorHeatmap(RSIZE.w, RSIZE.d); heatMesh.visible=showHeat; ctx.scene.add(heatMesh);
  ctx.winPos=built.winPos; ctx.glassMeshes=built.glassMeshes;

  // 천장등 갓 = 밤에 발광시킬 대상(가구 중 lamp_ceiling)
  ctx.clShade=null; plants=[];
  built.furniture.traverse(o=>{ if(o.parent&&o.parent.userData&&o.parent.userData.lampShade===o) ctx.clShade=o; });

  applyLight();
  // 방 라벨 표시
  const rp=document.getElementById('roomPill');
  if(rp) rp.textContent=`${roomDef.label} · ${roomDef.light}`;
}

// ===== STEP4: 엔진 조도(lx) ↔ 3D 연결 =====
let heatMesh=buildFloorHeatmap(RW, RD); heatMesh.visible=false; ctx.scene.add(heatMesh);
let RSIZE={ w:RW, d:RD };   // 현재 방 실제 치수(방마다 다름) — 히트맵·조도 격자에 사용
let showHeat=false;
// 조도 판정 대상 — buildRoomPreset()에서 방마다 재바인딩. RW=RD=7
let plants=[];

// ===== 카메라 궤도 =====
let orbit={ az:0.72, el:0.55, r:15, tx:0, ty:2, tz:0 };   // r 기본 12→15 (방이 덜 크게)
let autoRotate=false, ceilingMode=0;

function updateCam(){
  if(autoRotate) orbit.az+=0.003;
  const { az,el,r,tx,ty,tz }=orbit;
  ctx.cam.position.set(tx+r*Math.cos(el)*Math.sin(az), ty+r*Math.sin(el), tz+r*Math.cos(el)*Math.cos(az));
  ctx.cam.lookAt(tx,ty,tz);
  if(shells) updateShellVisibility(shells, ctx.cam);   // 심즈2 컷어웨이
}
function resize(){
  const w=innerWidth, h=innerHeight;
  ctx.renderer.setSize(w,h); ctx.cam.aspect=w/h; ctx.cam.updateProjectionMatrix();
}
function animate(){ requestAnimationFrame(animate); updateCam(); ctx.renderer.render(ctx.scene, ctx.cam); }

// ===== 컨트롤 =====
const sunEl=document.getElementById('sun');
function applyLight(){
  document.getElementById('timePill').textContent=updateLight(ctx, +sunEl.value, ceilingMode);
  engineRefresh();   // 엔진 조도(진짜 판정) 갱신
}

// 엔진 격자 lx 계산 → 히트맵 · 수치 · 식물 반응
function engineRefresh(){
  if(!roomModel) return;
  const t=+sunEl.value;
  const items=[];
  if(ceilingMode!==2) items.push({ type:'ceiling', u:0.5, v:0.5 });   // 천장등(끄기면 제외)
  const field=computeLux({ room:roomModel, catalog, items, sun:sunState(t), lampManual:(ceilingMode===1) });

  if(showHeat){ updateFloorHeatmap(heatMesh, field, RSIZE.w, RSIZE.d); heatMesh.visible=true; }
  else heatMesh.visible=false;

  for(const p of plants){
    const lx=field.at(p.u,p.v);
    const glow = lx>=p.needLux ? Math.min(0.7, 0.25+(lx-p.needLux)/p.needLux*0.5) : 0;
    p.leafMats.forEach(m=>{ m.emissiveIntensity=glow; });
  }

  const lp=document.getElementById('luxPill');
  if(lp) lp.textContent=`창가 ${Math.round(field.windowAvg)} · 최대 ${Math.round(field.max)} lx`;
}

function bindControls(){
  let drag=false, px=0, py=0;
  const pt=e=>(e.touches&&e.touches[0])?{x:e.touches[0].clientX,y:e.touches[0].clientY}:{x:e.clientX,y:e.clientY};
  const down=e=>{ drag=true; autoRotate=false; const p=pt(e); px=p.x; py=p.y;
    document.getElementById('autorotate').classList.remove('on'); };
  const move=e=>{ if(!drag)return; const p=pt(e);
    orbit.az-=(p.x-px)*0.008; orbit.el+=(p.y-py)*0.006;
    // 상/하 대칭(±1.45): 위로 내려다보는 만큼 아래로도 올려다봄. 밑으로 가면 바닥이 컷어웨이돼 방을 올려다봄.
    orbit.el=Math.max(-1.45,Math.min(1.45,orbit.el)); px=p.x; py=p.y; e.preventDefault(); };
  const up=()=>drag=false;
  cv.addEventListener('mousedown',down); cv.addEventListener('touchstart',down,{passive:false});
  window.addEventListener('mousemove',move); window.addEventListener('touchmove',move,{passive:false});
  window.addEventListener('mouseup',up); window.addEventListener('touchend',up);
  cv.addEventListener('wheel',e=>{ e.preventDefault();
    orbit.r*=(1+Math.sign(e.deltaY)*0.08); orbit.r=Math.max(4,Math.min(40,orbit.r)); },{passive:false});   // 줌아웃 40까지
  let pd=0;
  cv.addEventListener('touchmove',e=>{ if(e.touches.length===2){
    const dx=e.touches[0].clientX-e.touches[1].clientX, dy=e.touches[0].clientY-e.touches[1].clientY;
    const dd=Math.hypot(dx,dy); if(pd) orbit.r*=(1-(dd-pd)*0.005);
    orbit.r=Math.max(4,Math.min(40,orbit.r)); pd=dd; } },{passive:false});
  cv.addEventListener('touchend',()=>pd=0);

  sunEl.addEventListener('input',applyLight);
  document.getElementById('reset').onclick=()=>{ orbit.az=0.72; orbit.el=0.55; orbit.r=15; };
  document.getElementById('autorotate').onclick=function(){ autoRotate=!autoRotate; this.classList.toggle('on',autoRotate); };
  document.getElementById('ceiling').onclick=function(){
    ceilingMode=(ceilingMode+1)%3;
    this.textContent=['천장광: 자동','천장광: 상시','천장광: 끄기'][ceilingMode];
    this.classList.toggle('on',ceilingMode!==2);
    applyLight();
  };
  document.getElementById('heat').onclick=function(){
    showHeat=!showHeat; this.classList.toggle('on',showHeat);
    engineRefresh();
  };
  // 방 전환(5종 모듈 프리셋)
  document.querySelectorAll('.roombtn[data-room]').forEach(b=>{
    if(b.dataset.room===curRoom) b.classList.add('on');
    b.onclick=async ()=>{
      if(b.dataset.room===curRoom) return;
      document.querySelectorAll('.roombtn').forEach(x=>x.classList.remove('on'));
      b.classList.add('on');
      const loading=document.getElementById('loading');
      if(loading){ loading.textContent='방을 바꾸는 중…'; loading.style.display='flex'; }
      await buildRoomPreset(b.dataset.room);
      if(loading) loading.style.display='none';
    };
  });
  window.addEventListener('resize',resize);
}

// ===== 시작 =====
bindControls();
resize();
await buildRoomPreset(curRoom);      // 방 조립(비동기 GLB 로드) — animate 전에 shells 확보
animate();
const loading=document.getElementById('loading'); if(loading) loading.style.display='none';
setTimeout(()=>{ const h=document.getElementById('hint'); if(h) h.style.opacity='0'; },5500);
