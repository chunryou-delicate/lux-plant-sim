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
  /* 벽 '밑동만 보이기'에 쓴다. 클리핑은 렌더만 자르고 그림자는 전체 높이로 남으므로
     벽을 낮춰 보여도 빛은 그대로 막힌다(기하를 줄이면 그림자까지 줄어 해가 새 들어온다). */
  renderer.localClippingEnabled=true;
  renderer.outputEncoding=THREE.sRGBEncoding;
  renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.1;

  const scene=new THREE.Scene();
  const cam=new THREE.PerspectiveCamera(34,1,0.1,200);   // far 넓힘(줌아웃 대응)

  const hemi=new THREE.HemisphereLight(0x9ab0d0,0x40342e,0.12); scene.add(hemi);
  const ambient=new THREE.AmbientLight(0xffffff,0.04); scene.add(ambient);

  const sunLight=new THREE.DirectionalLight(0xfff0d8,1.6);
  sunLight.castShadow=true; sunLight.shadow.mapSize.set(2048,2048);
  sunLight.shadow.autoUpdate=false;   // 성능: 매 프레임 재생성 금지(updateLight에서 1회 갱신)
  sunLight.shadow.camera.near=0.5; sunLight.shadow.camera.far=50;
  const d=9; sunLight.shadow.camera.left=-d; sunLight.shadow.camera.right=d;
  sunLight.shadow.camera.top=d; sunLight.shadow.camera.bottom=-d;
  sunLight.shadow.bias=-0.0004; sunLight.shadow.radius=11;   // 그림자 더 부드럽게(A미니멀)
  scene.add(sunLight,sunLight.target);

  /* ★ 창 보조 스포트라이트 — 껐다. 남겨두면 안 되는 물건이었다.
     창이 하나뿐이던 시절에 '창에서 빛이 쏟아지는 느낌'을 내려고 넣은 가짜 조명이다.
     그런데 위치가 '첫 창'에 붙어 있어서, 창이 여럿인 방에서는 첫 창이 있는 방에만
     조명이 하나 더 서 있는 꼴이 된다. 투룸 침실이 시간과 무관하게 계속 밝았던 이유다.
     (방향만 해에 맞춰봤지만 위치가 그대로라 소용이 없었다 — 절반짜리 수정이었다.)
     해가 제대로 된 지향광이 됐고 창 개구부로 그림자가 지나가므로 이 가짜는 불필요하다.
     객체는 ctx 소비자를 위해 남기되 빛을 내지 않는다. */
  const winLight1=new THREE.SpotLight(0xfff2d8,0,14,Math.PI/3,0.5,1.5);
  winLight1.castShadow=false;      // 해와 다른 방향의 그림자를 하나 더 던지고 있었다
  scene.add(winLight1,winLight1.target);

  const ceilingBulb=new THREE.PointLight(0xffe4b0,0,14,1.2);
  ceilingBulb.position.set(0,3.4,0); ceilingBulb.castShadow=true;
  ceilingBulb.shadow.mapSize.set(1024,1024);
  ceilingBulb.shadow.autoUpdate=false; scene.add(ceilingBulb);

  // ctx: 렌더 상태 묶음 (room 빌드 후 winPos/glass/clShade 주입됨)
  /* ★ 창 확산광(sky portal) — 창 하나당 하나씩.
     조도 엔진은 하늘을 '창 면적을 가진 램버시안 면광원'으로 본다. 그래서 거실처럼
     직사광이 안 닿는 곳도 창에서 멀어질수록 서서히 어두워지는 분포가 나온다.
     그런데 렌더러엔 그 확산광이 없었다 — 해(직사광) + 균일 환경광뿐이라
     "발코니엔 볕이 들고 거실엔 아무것도 안 들어온다"로 보였다.
     한낮엔 해가 높아 볕이 발코니에서 멈추는 게 맞지만(고도 66도 -> 1.03m),
     거실이 받는 확산광까지 안 보이면 계산(거실 DLI 1.36)과 화면이 갈린다.
     ★ winLight1 과 다른 점: '첫 창'이 아니라 모든 창에 똑같이 붙는다.
       그래서 특정 방만 편애하지 않는다. */
  const skyPortals=[];
  /* 16개 — 온실이 3면 유리+천창이라 토막이 16개 나온다(다른 방은 1~5개).
     그림자를 던지는 건 앞의 둘뿐이라 나머지는 셰이더 비용만 든다. */
  for(let i=0;i<16;i++){
    /* 거리를 9m 로 제한한다 — 확산광은 창 근처를 밝히는 것이지 집 전체를 관통하면 안 된다.
       그림자는 앞의 둘만(512) — 전부 켜면 그림자맵이 16장이라 감당이 안 된다. */
    const sp=new THREE.SpotLight(0xeaf2ff, 0, 9, 1.2, 0.95, 1.6);
    sp.castShadow = i<2;
    if(sp.castShadow){ sp.shadow.mapSize.set(512,512); sp.shadow.autoUpdate=false;
                       sp.shadow.bias=-0.0012; }
    scene.add(sp, sp.target); skyPortals.push(sp);
  }

  return { renderer, scene, cam, hemi, ambient, sunLight, winLight1, ceilingBulb, skyPortals,
           winPos:null, glass:null, glassMeshes:null, clShade:null };
}

/* 시간(t) + 천장등 모드(0자동/1상시/2끄기) → 조명 갱신. 라벨 반환. */
export function updateLight(ctx, t, ceilingMode){
  const s=daylight(t);
  ctx.scene.background=col(mix(s.sky,hx('#14101c'),0.15));
  ctx.scene.fog=new THREE.Fog(col(s.sky),30,120);   // 멀리 봐도 방 안 흐리게

  const wp=ctx.winPos||new THREE.Vector3(0.6,2.2,-3.4);
  const el=0.25+s.alt*0.9;
  /* ★ 해는 무한히 멀리 있다 — 방향만으로 정한다.
     예전엔 위치를 '첫 창' 기준으로 잡고 타깃을 (1.2,0.5,1.5)에 하드코딩했다.
     그러면 창이 여럿인 방에서 빛이 한쪽으로 쏠린다 — 투룸 왼쪽 작은방은
     자기 창으로 들어온 빛이 오른쪽으로 쏠려 칸막이에 막혀 바닥 자국이 아예 없었다.
     조도 계산(창별 균일 천공)과 화면(단일 지향광)이 어긋난 것이다.
     이제 태양은 방위·고도만 쓰고, 타깃은 방 중심이라 창이 몇 개든 같은 방향으로 든다. */
  const dist=18;
  const ca=Math.cos(el);
  const dir=new THREE.Vector3(Math.sin(s.az)*ca, Math.sin(el), -Math.cos(s.az)*ca);
  ctx.sunLight.target.position.set(0,0,0);
  ctx.sunLight.position.copy(dir).multiplyScalar(dist);
  /* 그림자 카메라가 제일 큰 방(아파트 12×10, 대각 15.6m)을 덮어야 한다.
     해가 낮으면 투영 폭이 늘어나므로 여유를 둔다. */
  const half=12;
  const sc=ctx.sunLight.shadow.camera;
  if(sc.left!==-half){ sc.left=-half; sc.right=half; sc.top=half; sc.bottom=-half; sc.updateProjectionMatrix(); }
  ctx.sunLight.intensity=s.intensity*1.55;   // 살짝 낮춰 그림자 대비↓(무겁지 않게). 밤엔 0
  ctx.sunLight.color=col(mix(hx('#fff3e2'),hx('#ff9d5c'),s.warm));

  /* ★ 창 보조광도 해와 '같은 방향'으로 쏴야 한다.
     여기만 옛 방식이 남아 있었다 — 첫 창에 세워두고 (1.5,0,2) 를 겨누게 해서,
     세기만 해 높이를 따라가고 방향은 절대 안 바뀌었다.
     투룸은 첫 창이 침실 창이라 침실에 '해가 움직여도 그대로인 빛 자국'이 생겼다.
     태양 수정 때 sunLight 만 고치고 이건 놓쳤다. */
  ctx.winLight1.intensity=0;                 // 위 참조 — 첫 창에만 붙는 가짜 조명이라 껐다

  /* 창 확산광 갱신 — 큰 창부터 채운다.
     세기는 조도 엔진과 같은 인자를 쓴다: 면적 x 투과율(tau) x 향 계수(evScale).
     면적을 그대로 곱하면 발코니 통창(22제곱m)이 폭주하므로 6에서 자른다 —
     실제로도 창이 커질수록 밝기가 선형으로 늘지는 않는다(입체각이 포화). */
  const portals=(ctx.skyPortals||[]);
  const list=(ctx.skyWins||[]).slice().sort((a,b)=>(b.area*b.ev)-(a.area*a.ev));
  for(let i=0;i<portals.length;i++){
    const sp=portals[i], w=list[i];
    if(!w){ sp.intensity=0; continue; }
    const inx=w.nx||0, iny=w.ny||0, inz=w.nz||0;         // 실내를 향하는 법선
    sp.position.set(w.x+inx*0.12, w.y+iny*0.12, w.z+inz*0.12);
    sp.target.position.set(w.x+inx*4, w.y+iny*4-1.2, w.z+inz*4);
    sp.intensity = 0.30 * Math.min(w.area,6) * (w.tau??0.8) * (w.ev??1) * s.intensity;
    sp.color=col(mix(hx('#eaf2ff'),hx('#ffd9ae'),s.warm));
  }

  // 환경광(채움): 낮엔 넉넉히 올려 그림자 바닥을 밝게 → 부드럽고 밝은 파스텔.
  // 밤엔 낮되 완전 0은 아님(칙칙함 방지). 온기는 sunLight.warm으로만.
  /* 창 확산광이 생겼으므로 환경광은 낮게 유지 — 방향 없는 빛이 세면
     방 안쪽이 창가와 구분이 안 돼서 "어디가 밝은지" 자체가 안 보인다. */
  ctx.hemi.intensity=0.16+s.intensity*0.44;
  ctx.hemi.color=col(mix(hx('#bcd0e6'),s.sky,0.35));
  ctx.ambient.intensity=0.07+s.intensity*0.20;

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

  // 조명이 바뀐 프레임에만 그림자맵 재생성 (autoUpdate=false 이므로 수동)
  ctx.sunLight.shadow.needsUpdate=true;
  for(const sp of (ctx.skyPortals||[])) if(sp.castShadow) sp.shadow.needsUpdate=true;
  ctx.ceilingBulb.shadow.needsUpdate=true;

  return s.label;
}
