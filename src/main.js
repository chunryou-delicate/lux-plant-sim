/* ============================================================
   볕 · 조립 (main.js) — v3 Three.js 3D
   ------------------------------------------------------------
   엔진(lighting.js)은 렌더와 독립. 여기선 render3d 모듈들을 묶어
   3D 방을 그린다. STEP4에서 엔진 격자 lx ↔ 3D 연결 예정.
============================================================ */
import { createScene, updateLight } from './render3d/scene.js';
import { initTextures, faintGrainTexture } from './render3d/textures.js';
import { buildHouse, updateShellVisibility, RW, RD, RH } from './render3d/house.js';
// 가구는 이제 house.js가 방 데이터(roomDef.furniture)로 배치한다 — 옛 furniture.js(임시 박스)는 미사용.
import { luxGrid, daylightAt, pointIllum, winFromHouse, skyEv } from './engine/daylight_lux.js';
import { buildFloorHeatmap, updateFloorHeatmap } from './render3d/lighting_viz.js';
import { createCharacter, CHARACTERS, EMOTES } from './render3d/character.js';
import { createDecorator } from './render3d/decorate.js';

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

// 기본 배치 원본 — 집꾸미기 '기본으로' 버튼이 여기로 되돌린다
const DEFAULT_FURN=Object.fromEntries(
  Object.entries(houseRooms.rooms||{}).map(([k,v])=>[k, JSON.parse(JSON.stringify(v.furniture||[]))]));

const cv=document.getElementById('cv');
const ctx=createScene(cv);
const GRAIN=faintGrainTexture();          // A미니멀 표면 결(벽·바닥·천장 공용)

// ===== 집(모듈 조립) — 프리셋 전환 가능 =====
let shells;
let curRoom=houseRooms.default||'oneroom';
const houseGroup=new THREE.Group(); ctx.scene.add(houseGroup);

// ===== 집꾸미기 · 캐릭터 =====
let hero=null;      // 캐릭터 컨트롤러 (안 불러왔으면 null)
let deco=null;      // 집꾸미기 컨트롤러
let curDef=null;    // 현재 방 정의 — 집꾸미기가 이 객체의 furniture를 직접 고친다
let builtRef=null;  // 마지막 buildHouse 결과 (가구 그룹 픽킹용)

async function buildRoomPreset(name){
  // 이전 방 정리
  while(houseGroup.children.length) houseGroup.remove(houseGroup.children[0]);
  curRoom=name;
  const roomDef=curDef=houseRooms.rooms[name];
  const built=builtRef=buildHouse(GRAIN, roomDef, winPresets, doorPresets, finishes, furnPresets, lightPresets);
  shells=built.shells;
  houseGroup.add(built.room);
  // 방 크기가 바뀌면 바닥 히트맵도 그 크기로 다시 (방마다 5×4, 3×4 등)
  RSIZE=built.size;
  ctx.scene.remove(heatMesh);
  heatMesh=buildFloorHeatmap(RSIZE.w, RSIZE.d); heatMesh.visible=showHeat; ctx.scene.add(heatMesh);
  ctx.winPos=built.winPos; ctx.glassMeshes=built.glassMeshes;
  // ★ 조도용: 방 창을 3D 사각 개구부로, 화분 슬롯을 월드좌표로
  // ★ house.js가 진짜 창 + 유리벽(온실)을 합쳐 준다. 여기서 roomDef를 다시 읽지 않는다.
  curWins=(built.luxWins||[]).map(w=>
    winFromHouse(w.wall, w.cu, w.cy, w.w, w.h, built.size, w.tau)).filter(Boolean);
  curSlots=built.plantSlots||[];
  curOcc=built.occluders||[];
  curGlazed=built.glazedPanes||[];

  // 천장등 갓 = 밤에 발광시킬 대상(가구 중 lamp_ceiling)
  ctx.clShade=null; plants=[];
  built.furniture.traverse(o=>{ if(o.parent&&o.parent.userData&&o.parent.userData.lampShade===o) ctx.clShade=o; });

  if(hero) hero.setPosition(0, Math.min(built.size.d/2-0.8, 1.0));   // 새 방 안쪽으로

  applyLight();
  // 방 라벨 표시
  const rp=document.getElementById('roomPill');
  if(rp) rp.textContent=`${roomDef.label} · ${roomDef.light}`;
}

// ===== STEP4: 엔진 조도(lx) ↔ 3D 연결 =====
let heatMesh=buildFloorHeatmap(RW, RD); heatMesh.visible=false; ctx.scene.add(heatMesh);
let RSIZE={ w:RW, d:RD, h:RH };   // 현재 방 실제 치수(방마다 다름) — 히트맵·조도 격자에 사용
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
let _prevT=0;
function animate(t){
  requestAnimationFrame(animate);
  const dt=Math.min(0.05, (t-_prevT)/1000)||0; _prevT=t;
  if(hero) hero.update(dt);
  updateCam(); ctx.renderer.render(ctx.scene, ctx.cam);
}

// ===== 컨트롤 =====
const sunEl=document.getElementById('sun');
function applyLight(){
  document.getElementById('timePill').textContent=updateLight(ctx, +sunEl.value, ceilingMode);
  engineRefresh();   // 엔진 조도(진짜 판정) 갱신
}

/* ============================================================
   엔진 격자 lx → 히트맵 · 수치 · 식물 반응
   ★ 조도는 engine/daylight_lux.js(정밀 물리식) 하나만 쓴다.
     tool.html(정밀 조도툴)과 같은 함수라 두 화면의 값이 어긋나지 않는다.
     (기존 engine/lighting.js 간이식은 같은 조건에서 4배까지 낮게 나왔음)
============================================================ */
let curWins=[];     // 현재 방의 창 사각형(월드 m) — buildRoomPreset에서 갱신
let curSlots=[];    // 화분 슬롯(월드 m) — 높이별 조도 판정에 사용
let curOcc=[];      // ★ 차폐체(가구·칸막이) — 화면 그림자와 조도 계산을 일치시킨다
let curGlazed=[];   // ★ 실내 반투과 유리(베란다 거실창) — 지나는 광선만 tau만큼 약해짐

function engineRefresh(){
  const t=+sunEl.value;
  const Ev=skyEv(t);                                   // 시간 → 천공 조도(lx)

  // 천장등(있으면) — 인공광도 같은 물리식으로
  const lums=[];
  if(ceilingMode!==2){
    const lampOn = (ceilingMode===1) || Ev<1500;        // 자동: 어두우면 켜짐
    if(lampOn) lums.push({ x:0, y:RSIZE.h-0.35, z:0, flux:2400, dist:'wide' });
  }

  const field=luxGrid(curWins, RSIZE, { sky:Ev, lums, grid:22, y:0.75, samples:'auto', occluders:curOcc, glazed:curGlazed });

  if(showHeat){ updateFloorHeatmap(heatMesh, field, RSIZE.w, RSIZE.d); heatMesh.visible=true; }
  else heatMesh.visible=false;

  for(const p of plants){
    const lx=field.at(p.u,p.v);
    const glow = lx>=p.needLux ? Math.min(0.7, 0.25+(lx-p.needLux)/p.needLux*0.5) : 0;
    p.leafMats.forEach(m=>{ m.emissiveIntensity=glow; });
  }

  // ★ 선반 높이별 조도 — 2D 격자로는 못 하던 것(슬롯마다 실제 3D 위치로 계산)
  let slotBest=0, slotName='';
  const up={x:0,y:1,z:0};
  for(const s of curSlots){
    const o={ sky:Ev, samples:'auto', occluders:curOcc, glazed:curGlazed, selfIdx:s.occIdx };
    const lx=daylightAt({x:s.x,y:s.y,z:s.z}, up, curWins, o)
           + (lums.length? pointIllum({x:s.x,y:s.y,z:s.z}, up, lums, o) : 0);
    if(lx>slotBest){ slotBest=lx; slotName=s.owner||''; }
  }

  const lp=document.getElementById('luxPill');
  if(lp) lp.textContent = curSlots.length
    ? `창가 ${Math.round(field.windowAvg)} · 최대 ${Math.round(field.max)} lx · 선반최고 ${Math.round(slotBest)}`
    : `창가 ${Math.round(field.windowAvg)} · 최대 ${Math.round(field.max)} lx`;
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

  /* ============================================================
     집꾸미기 — 가구를 끌어 옮기고, 그 결과를 house_rooms.json과
     같은 형식으로 내보낸다. 사용자가 배치→저장→건네주면 기본이 된다.
  ============================================================ */
  const decoPanel=document.getElementById('decoPanel');
  const decoSel=document.getElementById('decoSel');
  deco=createDecorator(ctx, {
    getRoomDef: ()=>curDef,
    getFurnitureGroup: ()=>builtRef&&builtRef.furniture,
    getSize: ()=>RSIZE,
    rebuild: async ()=>{ await buildRoomPreset(curRoom); },
    onChange: ()=>engineRefresh()
  });
  deco.setEnabled(false);
  deco.onSelect=(i,f)=>{
    decoSel.textContent = i<0 ? '가구를 클릭해 고르고 끌어서 옮기세요'
      : `${(furnPresets[f.preset]||{}).name_ko||f.preset} · x ${f.x?.toFixed(2)} z ${f.z?.toFixed(2)}${f.rot?' · '+f.rot+'°':''}`;
  };

  // 추가 목록 — 화분 놓을 수 있는 것 + 자주 쓰는 것부터
  const addSel=document.getElementById('decoAdd');
  Object.entries(furnPresets)
    .sort((a,b)=>((b[1].tiers||0)-(a[1].tiers||0)) || a[0].localeCompare(b[0]))
    .forEach(([k,v])=>{
      const o=document.createElement('option');
      o.value=k; o.textContent=(v.tiers?'🪴 ':'')+(v.name_ko||k);
      addSel.appendChild(o);
    });
  addSel.onchange=async ()=>{ if(!addSel.value) return;
    const k=addSel.value; addSel.value='';
    await deco.add(k); };

  document.getElementById('decoBtn').onclick=function(){
    const on=deco.setEnabled(!deco.enabled);
    this.classList.toggle('on',on);
    decoPanel.style.display=on?'block':'none';
    document.getElementById('hint').textContent = on
      ? '가구를 클릭해 고르고 끌어서 옮기세요 · 화면 회전은 빈 곳 드래그'
      : '돌리면 가리는 벽이 사라져요 · 빛은 창으로만 들어와요';
    document.getElementById('hint').style.opacity='1';
  };
  document.getElementById('decoRotL').onclick=()=>deco.rotate(-15);
  document.getElementById('decoRotR').onclick=()=>deco.rotate(+15);
  document.getElementById('decoDel').onclick=()=>deco.remove();
  document.getElementById('decoUndo').onclick=()=>deco.undo();
  document.getElementById('decoDown').onclick=()=>deco.download(curRoom);
  document.getElementById('decoSave').onclick=function(){
    deco.saveLocal(curRoom); this.textContent='저장됨 ✓';
    setTimeout(()=>this.textContent='브라우저 저장',1200);
  };
  document.getElementById('decoLoad').onclick=async ()=>{
    if(!deco.hasLocal(curRoom)){ decoSel.textContent='저장된 배치가 없습니다'; return; }
    await deco.loadLocal(curRoom);
  };
  document.getElementById('decoReset').onclick=async ()=>{
    deco.clearLocal(curRoom);
    houseRooms.rooms[curRoom].furniture=JSON.parse(JSON.stringify(DEFAULT_FURN[curRoom]||[]));
    await buildRoomPreset(curRoom);
  };
  document.getElementById('decoFile').onchange=async function(){
    const f=this.files&&this.files[0]; if(!f) return;
    try{ await deco.importJSON(await f.text()); decoSel.textContent='불러왔습니다'; }
    catch(err){ decoSel.textContent='읽기 실패: '+err.message; }
    this.value='';
  };

  /* ============================================================
     캐릭터 — 바닥 클릭 이동 + 감정표현
  ============================================================ */
  const charPick=document.getElementById('charPick');
  CHARACTERS.forEach(c=>{ const o=document.createElement('option');
    o.value=c.id; o.textContent=c.ko; charPick.appendChild(o); });

  const emoteRow=document.getElementById('emoteRow');
  EMOTES.forEach(e=>{
    const b=document.createElement('button');
    b.className='cbtn'; b.textContent=e.ko; b.disabled=true;
    b.onclick=()=>hero&&hero.emote(e.id);
    emoteRow.appendChild(b);
  });
  const setEmotesEnabled=v=>emoteRow.querySelectorAll('button').forEach(b=>b.disabled=!v);

  document.getElementById('charToggle').onclick=async function(){
    if(hero){ hero.dispose(); hero=null; this.textContent='불러오기'; this.classList.remove('on');
      setEmotesEnabled(false); return; }
    this.textContent='불러오는 중…'; this.disabled=true;
    try{
      hero=await createCharacter(ctx.scene, charPick.value);
      hero.setPosition(0, Math.min(RSIZE.d/2-0.8, 1.0));
      this.textContent='치우기'; this.classList.add('on'); setEmotesEnabled(true);
    }catch(err){
      console.error('[볕] 캐릭터 로드 실패', err);
      this.textContent='불러오기 실패';
      setTimeout(()=>this.textContent='불러오기',1500);
    }
    this.disabled=false;
  };
  charPick.onchange=async ()=>{ if(!hero) return;
    hero.dispose(); hero=null;
    document.getElementById('charToggle').onclick.call(document.getElementById('charToggle'));
  };

  // 바닥 클릭 → 캐릭터 이동 (집꾸미기 중엔 배치가 우선)
  cv.addEventListener('click', e=>{
    if(!hero || deco.enabled) return;
    const r=cv.getBoundingClientRect();
    const nd=new THREE.Vector2(((e.clientX-r.left)/r.width)*2-1, -((e.clientY-r.top)/r.height)*2+1);
    const rc=new THREE.Raycaster(); rc.setFromCamera(nd, ctx.cam);
    const hit=new THREE.Vector3();
    if(rc.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0), hit)){
      const m=0.35;
      hero.moveTo(Math.max(-RSIZE.w/2+m, Math.min(RSIZE.w/2-m, hit.x)),
                  Math.max(-RSIZE.d/2+m, Math.min(RSIZE.d/2-m, hit.z)));
    }
  });
}

// ===== 시작 =====
bindControls();
resize();
await buildRoomPreset(curRoom);      // 방 조립(비동기 GLB 로드) — animate 전에 shells 확보
animate();
const loading=document.getElementById('loading'); if(loading) loading.style.display='none';
setTimeout(()=>{ const h=document.getElementById('hint'); if(h) h.style.opacity='0'; },5500);
