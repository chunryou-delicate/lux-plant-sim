/* ============================================================
   render3d/scene.js — 렌더러·씬·카메라·조명 셋업 + 조명 갱신
   ------------------------------------------------------------
   조명 원칙: 실내 환경광 약하게, 주 빛은 창으로 들어오는 것.
   - 태양   : 창 밖 DirectionalLight (그림자)
   - 창빛   : SpotLight (창 → 방 안으로)
   - 천장등 : PointLight (옵션, 3모드)
============================================================ */
import { col, mix, hx } from './util.js';
import { daylight } from '../engine/daylight.js';

export function createScene(canvas){
  const DPR=Math.min(2,window.devicePixelRatio||1);
  const renderer=new THREE.WebGLRenderer({ canvas, antialias:true });
  renderer.setPixelRatio(DPR);
  renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.outputEncoding=THREE.sRGBEncoding;
  renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.1;

  const scene=new THREE.Scene();
  const cam=new THREE.PerspectiveCamera(34,1,0.1,200);   // far 넓힘(줌아웃 대응)

  const hemi=new THREE.HemisphereLight(0x9ab0d0,0x40342e,0.12); scene.add(hemi);
  const ambient=new THREE.AmbientLight(0xffffff,0.04); scene.add(ambient);

  const sunLight=new THREE.DirectionalLight(0xfff0d8,1.6);
  sunLight.castShadow=true; sunLight.shadow.mapSize.set(2048,2048);
  sunLight.shadow.camera.near=0.5; sunLight.shadow.camera.far=50;
  const d=9; sunLight.shadow.camera.left=-d; sunLight.shadow.camera.right=d;
  sunLight.shadow.camera.top=d; sunLight.shadow.camera.bottom=-d;
  sunLight.shadow.bias=-0.0004; sunLight.shadow.radius=11;   // 그림자 더 부드럽게(A미니멀)
  scene.add(sunLight,sunLight.target);

  const winLight1=new THREE.SpotLight(0xfff2d8,0,14,Math.PI/3,0.5,1.5);
  winLight1.castShadow=true; winLight1.shadow.mapSize.set(1024,1024);
  scene.add(winLight1,winLight1.target);

  const ceilingBulb=new THREE.PointLight(0xffe4b0,0,14,1.2);
  ceilingBulb.position.set(0,3.4,0); ceilingBulb.castShadow=true;
  ceilingBulb.shadow.mapSize.set(1024,1024); scene.add(ceilingBulb);

  // ctx: 렌더 상태 묶음 (room 빌드 후 winPos/glass/clShade 주입됨)
  return { renderer, scene, cam, hemi, ambient, sunLight, winLight1, ceilingBulb,
           winPos:null, glass:null, glassMeshes:null, clShade:null };
}

/* 시간(t) + 천장등 모드(0자동/1상시/2끄기) → 조명 갱신. 라벨 반환. */
export function updateLight(ctx, t, ceilingMode){
  const s=daylight(t);
  ctx.scene.background=col(mix(s.sky,hx('#14101c'),0.15));
  ctx.scene.fog=new THREE.Fog(col(s.sky),30,120);   // 멀리 봐도 방 안 흐리게

  const wp=ctx.winPos||new THREE.Vector3(0.6,2.2,-3.4);
  const dist=10, el=0.25+s.alt*0.9;
  ctx.sunLight.position.set(wp.x+Math.sin(s.az)*dist*0.5, wp.y+Math.sin(el)*dist, wp.z-Math.cos(el)*dist*0.6);
  ctx.sunLight.target.position.set(1.2,0.5,1.5);
  ctx.sunLight.intensity=s.intensity*1.55;   // 살짝 낮춰 그림자 대비↓(무겁지 않게). 밤엔 0
  ctx.sunLight.color=col(mix(hx('#fff3e2'),hx('#ff9d5c'),s.warm));

  ctx.winLight1.position.set(wp.x,wp.y+0.3,wp.z+0.3);
  ctx.winLight1.target.position.set(1.5,0,2);
  ctx.winLight1.intensity=s.intensity*2.0;   // 밤엔 창 스팟도 0
  ctx.winLight1.color=col(mix(hx('#fff6e6'),hx('#ffb874'),s.warm));

  // 환경광(채움): 낮엔 넉넉히 올려 그림자 바닥을 밝게 → 부드럽고 밝은 파스텔.
  // 밤엔 낮되 완전 0은 아님(칙칙함 방지). 온기는 sunLight.warm으로만.
  ctx.hemi.intensity=0.16+s.intensity*0.48;
  ctx.hemi.color=col(mix(hx('#bcd0e6'),s.sky,0.35));
  ctx.ambient.intensity=0.07+s.intensity*0.22;

  // 유리(창·유리벽) 하늘색 틴트 갱신 — clear 유리만(skyTint). 색조/간유리는 자기 색 유지.
  const glasses = ctx.glassMeshes || (ctx.glass?[ctx.glass]:[]);
  for(const gm of glasses){
    if(gm&&gm.material && gm.material.userData.skyTint!==false) gm.material.color=col(s.sky);
  }

  // 천장등 3모드: 0=자동(어두우면) 1=상시 2=끄기
  let lampActive;
  if(ceilingMode===0) lampActive = s.intensity<0.35;
  else if(ceilingMode===1) lampActive = true;
  else lampActive = false;
  ctx.ceilingBulb.intensity = lampActive ? 4.5 : 0;
  if(ctx.clShade) ctx.clShade.material.emissiveIntensity = lampActive ? 0.9 : 0.0;

  return s.label;
}
