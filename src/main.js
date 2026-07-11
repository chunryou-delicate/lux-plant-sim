/* ============================================================
   볕 · 조립 (main.js)
   ------------------------------------------------------------
   조도 엔진(engine/lighting.js)을 import해서 실제 화면에 꽂는다.
   여기 있는 것: 데이터(ROOM/CATALOG/TRAY) · 렌더 · 상호작용 · 상태.
   → 렌더/데이터는 다음 단계(B-1/B-2)에서 별도 모듈로 분리 예정.
   조도 계산은 전부 엔진에 위임 (여기선 computeLux 결과 field만 사용).
============================================================ */

import { sunState, computeLux, GRID } from './engine/lighting.js';

// ---------- 뷰 상태 ----------
const VIEW = { dir:0, pitch:0, size:0 };   // dir: 0~7(45°), pitch: 0=45° 1=60°
const PITCH_SQUASH = [0.52, 0.36];

// ---------- 데이터: 방 정의 ----------
const ROOM = {
  windows:[
    { id:'w1', side:'u0', pos:0.5, width:0.4, sky:1.0 },  // 뒤쪽 벽A 중앙 창
    { id:'w2', side:'v0', pos:0.5, width:0.4, sky:1.0 },  // 뒤쪽 벽B 중앙 창
  ],
  wallColorA:'#efe4d2', wallColorB:'#e6d8c2', floorColor:'#e9d9bf'
};

// ---------- 데이터: 아이템 카탈로그 ----------
const CATALOG = {
  plant_basil: {kind:'plant', label:'바질', ico:'🌿', needLux:450, art:'plant', h:0.15},
  plant_cactus:{kind:'plant', label:'선인장', ico:'🌵', needLux:600, art:'cactus', h:0.2},
  plant_fern:  {kind:'plant', label:'고사리', ico:'🪴', needLux:250, art:'fern', h:0.15},
  tomato:      {kind:'plant', label:'토마토', ico:'🍅', needLux:700, art:'plant', h:0.25},
  sofa:  {kind:'furn', label:'소파', ico:'🛋️', art:'sofa', h:0.28},
  bed:   {kind:'furn', label:'침대', ico:'🛏️', art:'bed', h:0.24},
  table: {kind:'furn', label:'테이블', ico:'🪑', art:'table', h:0.22},
  rug:   {kind:'furn', label:'러그', ico:'🟫', art:'rug', h:0.01},
  lamp:  {kind:'light', label:'스탠드', ico:'💡', art:'lamp', h:0.6, flux:2600},
  ceiling:{kind:'light', label:'천장등', ico:'🔆', art:'ceilinglamp', h:0.95, flux:4200},
  avatar:{kind:'avatar', label:'나', ico:'🧍', art:'avatar', h:0.5},
};
const TRAY = ['plant_basil','tomato','plant_cactus','plant_fern','sofa','bed','table','rug','lamp','ceiling','avatar'];

// ---------- 상태 ----------
const S = { t:50, lampManual:false, showHeat:false };
let items = []; let uid = 1;
let field = null;   // 최신 조도 필드 (엔진 computeLux 결과)

/* ------------------------------------------------------------
   시간대 → 하늘 표현 (색·라벨). 물리는 엔진 sunState, 표현은 여기.
   → 나중에 "환경 제공자"로 교체하면 실기상 데이터로 갈아끼움.
------------------------------------------------------------ */
function skyAppearance(t){
  let sky,label;
  if(t<12){sky=lerpCol('#232c46','#3a4a6b',t/12);label='한밤';}
  else if(t<26){sky=lerpCol('#3a4a6b','#f7c9a8',(t-12)/14);label='새벽';}
  else if(t<44){sky=lerpCol('#f7c9a8','#bfe4f5',(t-26)/18);label='아침';}
  else if(t<58){sky='#bfe4f5';label='한낮';}
  else if(t<74){sky=lerpCol('#bfe4f5','#f6c98a',(t-58)/16);label='늦은 오후';}
  else if(t<88){sky=lerpCol('#f6c98a','#e9a6b0',(t-74)/14);label='해질녘';}
  else{sky=lerpCol('#e9a6b0','#232c46',(t-88)/12);label='한밤';}
  return {sky,label};
}
// 현재 시각의 태양(물리) + 하늘(표현)을 합친 객체 (렌더용)
function currentSun(){ return Object.assign(sunState(S.t), skyAppearance(S.t)); }

function lerpCol(a,b,t){t=Math.max(0,Math.min(1,t));const pa=hx(a),pb=hx(b);
  return `rgb(${Math.round(pa[0]+(pb[0]-pa[0])*t)},${Math.round(pa[1]+(pb[1]-pa[1])*t)},${Math.round(pa[2]+(pb[2]-pa[2])*t)})`;}
function hx(h){h=h.replace('#','');return[parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];}
function clamp(v){return Math.max(0,Math.min(255,Math.round(v)))}

/* ============================================================
   뷰 투영: 방 좌표 (u,v,h) + dir/pitch → 화면 픽셀
============================================================ */
function project(u,v,h){
  const s=VIEW.size, cu=u-0.5, cv=v-0.5;
  const ang=VIEW.dir*Math.PI/4;
  const ru=cu*Math.cos(ang)-cv*Math.sin(ang);
  const rv=cu*Math.sin(ang)+cv*Math.cos(ang);
  const sq=PITCH_SQUASH[VIEW.pitch];
  const x=s*0.5 + (ru-rv)*s*0.40;
  const y=s*0.34 + (ru+rv)*s*0.40*sq - h*s*0.30;
  return {x,y};
}
// 화면 → 방좌표 역변환 (h=0 바닥 가정, 드래그용)
function unproject(px,py){
  const s=VIEW.size;
  const X=(px - s*0.5)/(s*0.40);
  const Y=(py - s*0.34)/(s*0.40*PITCH_SQUASH[VIEW.pitch]);
  const ru=(X+Y)/2, rv=(Y-X)/2;
  const ang=-VIEW.dir*Math.PI/4;
  const cu=ru*Math.cos(ang)-rv*Math.sin(ang);
  const cv=ru*Math.sin(ang)+rv*Math.cos(ang);
  return {u:cu+0.5, v:cv+0.5};
}

/* ============================================================
   렌더링
============================================================ */
const cv=document.getElementById('boardCanvas');
const ctx=cv.getContext('2d');
const boardEl=document.getElementById('board');

function resize(){
  const r=boardEl.getBoundingClientRect();
  const s=Math.min(r.width,r.height);
  VIEW.size=s;
  cv.width=s*devicePixelRatio; cv.height=s*devicePixelRatio;
  cv.style.width=s+'px'; cv.style.height=s+'px';
  ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
  redraw();
}
function colormap(t){t=Math.max(0,Math.min(1,t));
  return [Math.round(255*Math.min(1,Math.max(0,1.5-Math.abs(4*t-3)))),
          Math.round(255*Math.min(1,Math.max(0,1.5-Math.abs(4*t-2)))),
          Math.round(255*Math.min(1,Math.max(0,1.5-Math.abs(4*t-1))))];}

function redraw(){
  const s=VIEW.size; if(!s)return;
  const sun=currentSun();
  ctx.clearRect(0,0,s,s);

  drawWalls(sun);
  drawFloor(sun);
  if(S.showHeat) drawHeat();
  drawItems(sun);

  document.getElementById('sky').style.background=
    `linear-gradient(180deg,${sun.sky} 0%,${lerpCol(sun.sky,'#fbf6ec',0.5)} 100%)`;
  document.getElementById('timeLabel').textContent=sun.label;
}
function shade(hex,sun,face){
  const [r,g,b]=hx(hex);
  const lit=0.55+0.45*sun.intensity*face;
  const warmR=sun.warm?14:0, warmB=sun.warm?-10:0, night=sun.intensity<0.1?-38:0;
  return `rgb(${clamp(r*lit+warmR+night)},${clamp(g*lit+night)},${clamp(b*lit+warmB+night)})`;
}
function drawFloor(sun){
  const c0=project(0,0,0),c1=project(1,0,0),c2=project(1,1,0),c3=project(0,1,0);
  ctx.beginPath();ctx.moveTo(c0.x,c0.y);ctx.lineTo(c1.x,c1.y);ctx.lineTo(c2.x,c2.y);ctx.lineTo(c3.x,c3.y);ctx.closePath();
  ctx.fillStyle=shade(ROOM.floorColor,sun,1);ctx.fill();
  ctx.strokeStyle='rgba(74,64,56,.12)';ctx.lineWidth=1;
  for(let k=1;k<5;k++){const a=project(k/5,0,0),b=project(k/5,1,0);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
    const e=project(0,k/5,0),f=project(1,k/5,0);ctx.beginPath();ctx.moveTo(e.x,e.y);ctx.lineTo(f.x,f.y);ctx.stroke();}
}
function drawWalls(sun){
  const corners=[project(0,0,0),project(1,0,0),project(1,1,0),project(0,1,0)];
  const edges=[[0,1,ROOM.wallColorA],[1,2,ROOM.wallColorB],[2,3,ROOM.wallColorA],[3,0,ROOM.wallColorB]];
  const withMid=edges.map(e=>({e,my:(corners[e[0]].y+corners[e[1]].y)/2}));
  withMid.sort((a,b)=>a.my-b.my);
  const back=withMid.slice(0,2);
  const wallTop=VIEW.size*0.30;
  back.forEach(({e})=>{
    const a=corners[e[0]], b=corners[e[1]];
    ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);
    ctx.lineTo(b.x,b.y-wallTop);ctx.lineTo(a.x,a.y-wallTop);ctx.closePath();
    ctx.fillStyle=shade(e[2],sun,0.85);ctx.fill();
    ctx.strokeStyle='rgba(74,64,56,.1)';ctx.stroke();
    drawWindowOnEdge(e,a,b,wallTop,sun);
  });
}
function drawWindowOnEdge(edge,a,b,wallTop,sun){
  const map={'0,1':'u0','1,2':'v1','2,3':'u1','3,0':'v0'};
  const key=edge[0]+','+edge[1];
  const side=map[key]; if(!side)return;
  const w=ROOM.windows.find(x=>x.side===side); if(!w)return;
  const t0=w.pos-w.width/2, t1=w.pos+w.width/2;
  const lerp=(p,q,t)=>({x:p.x+(q.x-p.x)*t,y:p.y+(q.y-p.y)*t});
  const wa=lerp(a,b,t0), wb=lerp(a,b,t1);
  const top=wallTop*0.66, bot=wallTop*0.16;
  ctx.beginPath();
  ctx.moveTo(wa.x,wa.y-bot);ctx.lineTo(wb.x,wb.y-bot);ctx.lineTo(wb.x,wb.y-top);ctx.lineTo(wa.x,wa.y-top);ctx.closePath();
  ctx.fillStyle=sun.sky;ctx.fill();
  if(sun.daytime&&sun.intensity>0.15){
    const match=(side==='u0'&&sun.azimuth<0.3)||(side==='v0'&&sun.azimuth>-0.3);
    if(match){const sx=(wa.x+wb.x)/2,sy=(wa.y+wb.y)/2-top+(1-sun.altitude)*(top-bot);
      ctx.beginPath();ctx.arc(sx,sy,6,0,7);ctx.fillStyle='rgba(255,242,190,.95)';ctx.fill();}
  }
  ctx.strokeStyle='#c9b89a';ctx.lineWidth=2.5;
  ctx.beginPath();ctx.moveTo(wa.x,wa.y-bot);ctx.lineTo(wb.x,wb.y-bot);ctx.lineTo(wb.x,wb.y-top);ctx.lineTo(wa.x,wa.y-top);ctx.closePath();ctx.stroke();
}
function drawHeat(){
  if(!field)return;
  for(let i=0;i<GRID;i++)for(let j=0;j<GRID;j++){
    const u0=i/GRID,v0=j/GRID,u1=(i+1)/GRID,v1=(j+1)/GRID;
    const t=field.cells[i][j]/field.max;
    const [r,g,b]=colormap(t);
    const p0=project(u0,v0,0),p1=project(u1,v0,0),p2=project(u1,v1,0),p3=project(u0,v1,0);
    ctx.beginPath();ctx.moveTo(p0.x,p0.y);ctx.lineTo(p1.x,p1.y);ctx.lineTo(p2.x,p2.y);ctx.lineTo(p3.x,p3.y);ctx.closePath();
    ctx.fillStyle=`rgba(${r},${g},${b},0.5)`;ctx.fill();
  }
}
function drawItems(sun){
  const sorted=items.map(it=>({it,p:project(it.u,it.v,0)})).sort((a,b)=>a.p.y-b.p.y);
  for(const {it,p} of sorted){
    const C=CATALOG[it.type];
    const b=field?field.at(it.u,it.v)/Math.max(field.max,1):0;   // 0~1 상대밝기
    drawSprite(it,C,p,b,sun);
  }
}
function drawSprite(it,C,p,b,sun){
  const s=VIEW.size, sc=s/440;
  ctx.save();ctx.translate(p.x,p.y);
  ctx.beginPath();ctx.ellipse(0,0,20*sc,7*sc,0,0,7);ctx.fillStyle='rgba(74,64,56,.16)';ctx.fill();
  const bright=0.55+b*0.6;
  const tint=(v)=>`rgb(${clamp(hx(v)[0]*bright+(sun.warm?12:0))},${clamp(hx(v)[1]*bright)},${clamp(hx(v)[2]*bright-(sun.warm?6:0))})`;
  const art=C.art;
  if(art==='plant'||art==='fern'||art==='cactus'){
    ctx.fillStyle=tint('#c98a5e');
    ctx.beginPath();ctx.moveTo(-11*sc,-2*sc);ctx.lineTo(11*sc,-2*sc);ctx.lineTo(8*sc,-16*sc);ctx.lineTo(-8*sc,-16*sc);ctx.closePath();ctx.fill();
    const leaf=tint(art==='cactus'?'#5f9e6a':'#7cae7a');
    ctx.fillStyle=leaf;
    const grow=it.growth||0.6;
    if(art==='cactus'){ctx.beginPath();ctx.ellipse(0,-(24+8*grow)*sc,7*sc,(16+8*grow)*sc,0,0,7);ctx.fill();
      ctx.beginPath();ctx.ellipse(-8*sc,-24*sc,4*sc,9*sc,0,0,7);ctx.fill();}
    else{for(let k=-1;k<=1;k++){ctx.beginPath();
      ctx.ellipse(k*7*sc,-(22+10*grow)*sc,5*sc,(14+8*grow)*sc,k*0.4,0,7);ctx.fill();}}
    if(it.happy){ctx.beginPath();ctx.arc(0,-26*sc,26*sc,0,7);
      const g=ctx.createRadialGradient(0,-26*sc,0,0,-26*sc,26*sc);
      g.addColorStop(0,'rgba(255,220,120,.5)');g.addColorStop(1,'rgba(255,220,120,0)');ctx.fillStyle=g;ctx.fill();}
  } else if(art==='sofa'){ctx.fillStyle=tint('#e6a4a0');roundRect(-30*sc,-24*sc,60*sc,20*sc,7*sc);ctx.fill();
    ctx.fillStyle=tint('#d98f8b');roundRect(-32*sc,-30*sc,12*sc,24*sc,6*sc);ctx.fill();roundRect(20*sc,-30*sc,12*sc,24*sc,6*sc);ctx.fill();
  } else if(art==='bed'){ctx.fillStyle=tint('#9fb8d6');roundRect(-34*sc,-22*sc,68*sc,20*sc,6*sc);ctx.fill();
    ctx.fillStyle=tint('#bcd0e8');roundRect(-34*sc,-30*sc,68*sc,12*sc,5*sc);ctx.fill();
    ctx.fillStyle='#fff';roundRect(-30*sc,-28*sc,22*sc,10*sc,4*sc);ctx.fill();
  } else if(art==='table'){ctx.fillStyle=tint('#caa06e');ctx.beginPath();ctx.ellipse(0,-16*sc,30*sc,12*sc,0,0,7);ctx.fill();
    ctx.fillStyle=tint('#b07e4e');ctx.fillRect(-18*sc,-16*sc,4*sc,16*sc);ctx.fillRect(14*sc,-16*sc,4*sc,16*sc);
  } else if(art==='rug'){ctx.fillStyle=tint('#e8d4a8');ctx.beginPath();ctx.ellipse(0,-2*sc,44*sc,20*sc,0,0,7);ctx.fill();
    ctx.strokeStyle=tint('#d8bd85');ctx.lineWidth=3*sc;ctx.beginPath();ctx.ellipse(0,-2*sc,32*sc,14*sc,0,0,7);ctx.stroke();
  } else if(art==='lamp'){ctx.strokeStyle=tint('#b7a48c');ctx.lineWidth=4*sc;ctx.beginPath();ctx.moveTo(0,-2*sc);ctx.lineTo(0,-38*sc);ctx.stroke();
    const on=true;ctx.fillStyle=on?'#ffe39a':tint('#d9c48a');
    ctx.beginPath();ctx.moveTo(-13*sc,-38*sc);ctx.lineTo(13*sc,-38*sc);ctx.lineTo(9*sc,-56*sc);ctx.lineTo(-9*sc,-56*sc);ctx.closePath();ctx.fill();
    if(on){ctx.beginPath();ctx.arc(0,-42*sc,26*sc,0,7);const g=ctx.createRadialGradient(0,-42*sc,0,0,-42*sc,26*sc);
      g.addColorStop(0,'rgba(255,225,140,.5)');g.addColorStop(1,'rgba(255,225,140,0)');ctx.fillStyle=g;ctx.fill();}
  } else if(art==='ceilinglamp'){const on=(S.lampManual||sunState(S.t).lampAuto);
    ctx.strokeStyle=tint('#b7a48c');ctx.lineWidth=3*sc;ctx.beginPath();ctx.moveTo(0,-40*sc);ctx.lineTo(0,-58*sc);ctx.stroke();
    ctx.fillStyle=on?'#ffe39a':tint('#cbbf9a');ctx.beginPath();ctx.ellipse(0,-38*sc,16*sc,8*sc,0,0,7);ctx.fill();
    if(on){ctx.beginPath();ctx.arc(0,-34*sc,34*sc,0,7);const g=ctx.createRadialGradient(0,-34*sc,0,0,-34*sc,34*sc);
      g.addColorStop(0,'rgba(255,225,140,.45)');g.addColorStop(1,'rgba(255,225,140,0)');ctx.fillStyle=g;ctx.fill();}
  } else if(art==='avatar'){ctx.fillStyle=tint('#f4a259');roundRect(-10*sc,-34*sc,20*sc,32*sc,8*sc);ctx.fill();
    ctx.fillStyle=tint('#ffd9b3');ctx.beginPath();ctx.arc(0,-44*sc,14*sc,0,7);ctx.fill();
    ctx.fillStyle=tint('#5a4632');ctx.beginPath();ctx.arc(0,-48*sc,14*sc,Math.PI,0);ctx.fill();
    ctx.fillStyle='#4a4038';ctx.beginPath();ctx.arc(-5*sc,-44*sc,2*sc,0,7);ctx.arc(5*sc,-44*sc,2*sc,0,7);ctx.fill();}
  ctx.restore();
}
function roundRect(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}

/* ============================================================
   식물 성장 & 패널 (엔진 field 사용)
============================================================ */
function updatePlants(){
  if(!field)return;
  items.forEach(it=>{
    const C=CATALOG[it.type];
    if(C.kind!=='plant')return;
    const lx=field.at(it.u,it.v);
    it.happy = lx>=C.needLux;
    if(it.growth===undefined)it.growth=0.5;
    if(it.happy)it.growth=Math.min(1,it.growth+0.04);
    else it.growth=Math.max(0.3,it.growth-0.01);
  });
}
// 조도 1회 계산 → 성장 → 렌더 → 패널
function tickLight(){
  const sun=sunState(S.t);
  field=computeLux({ room:ROOM, catalog:CATALOG, items, sun, lampManual:S.lampManual });
  updatePlants();
  redraw();
  updatePanel();
}
function updatePanel(){
  if(!field)return;
  document.getElementById('pWindow').textContent=Math.round(field.windowAvg)+' lx';
  document.getElementById('pInner').textContent=Math.round(field.innerAvg)+' lx';
  document.getElementById('pMax').textContent=Math.round(field.max)+' lx';
  const plants=items.filter(i=>CATALOG[i.type].kind==='plant');
  const el=document.getElementById('pPlant');
  if(!plants.length){el.textContent='식물 없음';el.className='chip';}
  else{const h=plants.filter(p=>p.happy).length;
    if(h===plants.length){el.textContent='아주 좋음 🌿';el.className='chip good';}
    else if(h>0){el.textContent=`${h}/${plants.length} 좋음`;el.className='chip';}
    else{el.textContent='빛이 부족해요';el.className='chip';}}
}

/* ============================================================
   상호작용: 추가 / 드래그 / 회전 / pitch
============================================================ */
function addItem(type){
  const it={id:uid++,type,u:0.4+Math.random()*0.2,v:0.4+Math.random()*0.2};
  if(CATALOG[type].kind==='plant')it.growth=0.5;
  items.push(it); tickLight();
  flashHint(CATALOG[type].label+' 추가! 끌어서 옮겨요');
  return it;
}
let drag=null;
function pickItem(px,py){
  const uv=unproject(px,py);
  let best=null,bd=0.09;
  for(const it of items){const du=it.u-uv.u,dv=it.v-uv.v;const d=Math.sqrt(du*du+dv*dv);
    if(d<bd){bd=d;best=it;}}
  return best;
}
function onDown(e){
  const pt=getPt(e); const r=cv.getBoundingClientRect();
  const px=pt.x-r.left, py=pt.y-r.top;
  const it=pickItem(px,py);
  if(it){drag={it,moved:false};
    const now=Date.now();
    if(it._lastTap&&now-it._lastTap<320){removeItem(it);drag=null;}
    it._lastTap=now;}
  e.preventDefault();
}
function onMove(e){
  if(!drag)return;
  const pt=getPt(e);const r=cv.getBoundingClientRect();
  const uv=unproject(pt.x-r.left,pt.y-r.top);
  drag.it.u=Math.max(0.04,Math.min(0.96,uv.u));
  drag.it.v=Math.max(0.04,Math.min(0.96,uv.v));
  drag.moved=true; tickLight(); e.preventDefault();
}
function onUp(){drag=null;}
function getPt(e){if(e.touches&&e.touches[0])return{x:e.touches[0].clientX,y:e.touches[0].clientY};return{x:e.clientX,y:e.clientY};}
function removeItem(it){items=items.filter(x=>x!==it);tickLight();}

cv.addEventListener('mousedown',onDown);cv.addEventListener('touchstart',onDown,{passive:false});
window.addEventListener('mousemove',onMove);window.addEventListener('touchmove',onMove,{passive:false});
window.addEventListener('mouseup',onUp);window.addEventListener('touchend',onUp);

document.getElementById('rotL').onclick=()=>{VIEW.dir=(VIEW.dir+7)%8;redraw();flashHint('왼쪽으로 돌림');};
document.getElementById('rotR').onclick=()=>{VIEW.dir=(VIEW.dir+1)%8;redraw();flashHint('오른쪽으로 돌림');};
document.getElementById('pitchBtn').onclick=()=>{VIEW.pitch=(VIEW.pitch+1)%2;redraw();
  flashHint(VIEW.pitch?'높은 시점 (60°)':'기본 시점 (45°)');};

// 트레이
const dock=document.getElementById('dock');
TRAY.forEach(type=>{const C=CATALOG[type];const b=document.createElement('button');
  b.className='tray-btn';b.innerHTML=`<div>${C.ico}</div><span>${C.label}</span>`;
  b.onclick=()=>addItem(type);dock.appendChild(b);});

// 시간 슬라이더
document.getElementById('sunSlider').addEventListener('input',function(){S.t=+this.value;tickLight();});
// 상세설정
const panel=document.getElementById('panel');
document.getElementById('gearBtn').onclick=()=>panel.classList.toggle('open');
document.getElementById('tLamp').onclick=function(){S.lampManual=!S.lampManual;this.classList.toggle('on',S.lampManual);tickLight();};
document.getElementById('bHeat').onclick=function(){S.showHeat=!S.showHeat;this.classList.toggle('on',S.showHeat);
  this.textContent=S.showHeat?'ON':'OFF';redraw();};

// 힌트
let hintTimer;
function flashHint(txt){const h=document.getElementById('hint');h.textContent=txt;h.classList.add('show');
  clearTimeout(hintTimer);hintTimer=setTimeout(()=>h.classList.remove('show'),1600);}

// 성장 타이머 (이지 배속)
setInterval(()=>{ if(items.some(i=>CATALOG[i.type].kind==='plant')){updatePlants();redraw();updatePanel();} },1500);

// 창 크기 변화 대응
window.addEventListener('resize',resize);

// ---------- 시작 ----------
setTimeout(()=>{
  resize();
  items=[
    {id:uid++,type:'rug',u:0.5,v:0.55},
    {id:uid++,type:'bed',u:0.28,v:0.6},
    {id:uid++,type:'sofa',u:0.66,v:0.32},
    {id:uid++,type:'table',u:0.52,v:0.5},
    {id:uid++,type:'plant_basil',u:0.16,v:0.2,growth:0.5},
    {id:uid++,type:'tomato',u:0.8,v:0.16,growth:0.5},
    {id:uid++,type:'avatar',u:0.62,v:0.68},
  ];
  tickLight();
  flashHint('↺↻ 로 방을 8방향 돌려보세요 ☀️');
},60);
