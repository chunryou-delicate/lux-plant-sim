/* ============================================================
   render3d/textures.js — 절차적 텍스처 (벽돌·나무·천)
   저폴리지만 재질감으로 퀄리티 (기획 원칙: 폴리곤 ❌ 조명·재질·색 ⭕)
============================================================ */
import { hx } from './util.js';

export function brickTexture(){
  const c=document.createElement('canvas'); c.width=256; c.height=256; const x=c.getContext('2d');
  x.fillStyle='#6b4a3a'; x.fillRect(0,0,256,256);
  const bw=52,bh=22,gap=4;
  for(let row=0; row*(bh+gap)<256; row++){ const off=(row%2)*(bw/2);
    for(let cx=-bw; cx<256+bw; cx+=bw+gap){ const px=cx+off, py=row*(bh+gap);
      const v=0.85+Math.random()*0.3; const base=hx('#8a5a44');
      x.fillStyle=`rgb(${base[0]*v|0},${base[1]*v|0},${base[2]*v|0})`; x.fillRect(px,py,bw,bh);
      x.fillStyle='rgba(255,220,190,0.06)'; x.fillRect(px,py,bw,3);
      x.fillStyle='rgba(0,0,0,0.12)'; x.fillRect(px,py+bh-3,bw,3); } }
  const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; return t;
}

export function woodTexture(dark){
  const c=document.createElement('canvas'); c.width=256; c.height=256; const x=c.getContext('2d');
  x.fillStyle=dark?'#6a4630':'#b8895c'; x.fillRect(0,0,256,256);
  for(let i=0;i<40;i++){ const y=Math.random()*256;
    x.strokeStyle=`rgba(${dark?'40,26,18':'120,85,55'},${0.1+Math.random()*0.15})`;
    x.lineWidth=1+Math.random()*2; x.beginPath(); x.moveTo(0,y);
    for(let px=0;px<256;px+=20) x.lineTo(px,y+Math.sin(px*0.05+i)*3); x.stroke(); }
  const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; return t;
}

export function fabricTexture(hexColor){
  const c=document.createElement('canvas'); c.width=128; c.height=128; const x=c.getContext('2d');
  const b=hx(hexColor); x.fillStyle=hexColor; x.fillRect(0,0,128,128);
  for(let i=0;i<2000;i++){ const v=0.9+Math.random()*0.2;
    x.fillStyle=`rgba(${b[0]*v|0},${b[1]*v|0},${b[2]*v|0},0.3)`;
    x.fillRect(Math.random()*128,Math.random()*128,2,2); }
  return new THREE.CanvasTexture(c);
}

export function initTextures(){
  const TEX={};
  TEX.brick=brickTexture(); TEX.brick.repeat.set(3,2);
  TEX.woodFloor=woodTexture(false); TEX.woodFloor.repeat.set(4,4);
  TEX.woodDark=woodTexture(true);
  return TEX;
}

/* ============================================================
   실제 집 텍스처 (assets/house/textures/house_tex_*.png)
   ------------------------------------------------------------
   - 6종 전부 seamless 후처리 완료 → RepeatWrapping.
   - 벽/바닥은 1m 모듈 패널마다 '한 타일'을 입히므로 repeat=1(기본).
   - 베이스컬러만 sRGB. 노멀/러프니스는 재질 균일값(house.js).
   key = house_asset_direction.md의 텍스처 이름과 1:1.
============================================================ */
const HOUSE_TEX_FILES={
  wall_white : 'house_tex_wall_white.png',
  wall_pastel: 'house_tex_wall_pastel.png',
  wall_cement: 'house_tex_wall_cement.png',
  floor_wood : 'house_tex_floor_wood.png',
  floor_tile : 'house_tex_floor_tile.png',
  floor_cement:'house_tex_floor_cement.png',
};

/* ★ A 미니멀 표면 결: 거의 단색인데 아주 옅은 매트지(paper) 질감만.
   near-white(245~255) 저대비 노이즈 → 재질 color(파스텔)에 곱해져 '매끈 파스텔'.
   거친 리얼 텍스처(시멘트/타일) 대신 이걸 벽·바닥·천장 공용으로 쓴다. */
export function faintGrainTexture(){
  const c=document.createElement('canvas'); c.width=c.height=128; const x=c.getContext('2d');
  x.fillStyle='#ffffff'; x.fillRect(0,0,128,128);
  // 2px 블록 단위 옅은 얼룩 → 정적(static)보다 종이결 느낌
  for(let py=0; py<128; py+=2) for(let px=0; px<128; px+=2){
    const n=247+Math.random()*8;                 // 247~255 (거의 흰색)
    x.fillStyle=`rgb(${n|0},${n|0},${n|0})`; x.fillRect(px,py,2,2);
  }
  const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping;
  t.anisotropy=4; return t;
}

export function loadHouseTextures(base='./assets/house/textures/'){
  const L=new THREE.TextureLoader();
  const HT={};
  for(const [key,file] of Object.entries(HOUSE_TEX_FILES)){
    const t=L.load(base+file);
    t.wrapS=t.wrapT=THREE.RepeatWrapping;
    t.encoding=THREE.sRGBEncoding;
    t.anisotropy=4;
    HT[key]=t;
  }
  return HT;   // { wall_white, wall_pastel, ..., floor_cement }
}
