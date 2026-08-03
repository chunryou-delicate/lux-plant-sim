/* ============================================================
   game/room_view.js — 방 3D 뷰 (폰 세로 전용 모듈)
   ------------------------------------------------------------
   게임 화면의 본체다. 방을 캔버스에 그리고, 슬롯에 화분을 놓고,
   탭을 밖으로 내보낸다. 게임 규칙·경제·성장은 하나도 모른다.

   만든 게 아니라 이어붙인 것이다. 방은 render3d/house.js 가 이미 짓고 있고
   조명은 render3d/scene.js 가 이미 하고 있다. 여기서 새로 만든 것은
     ① 폰 세로 화면에 맞는 카메라 프레이밍
     ② 화분 배치·이동 — slotId(추천 자리) **와** 자유 좌표(at) 둘 다
     ③ 탭 판정(플레이어가 화분을 만지는 유일한 통로)
     ④ 놀 때는 안 그리는 렌더 루프 (폰 배터리)
     ⑤ 가구 옮기기 — 유령으로 끌고, 손 뗄 때 한 번만 방을 다시 조립
   다섯뿐이다.

   ★ 자유 좌표 (2026-08-03)
     배치 규칙은 game/place.js 한 벌만 쓴다. 좌표 하나 = `at = {x,y,z,rotY,onUid,occIdx}`.
       surfaceAt(px,py)         화면 좌표 → 놓을 수 있는 면 (벽·천장은 거절)
       setPlantAt(potId,at,spec) 그 좌표에 세운다. **옛 자리는 반드시 지운다**
       previewAt(at,{valid})    반투명 유령
       showSlotRings(on,{potD}) 추천 자리 원형 가이드 — 안내지 제약이 아니다
     추천 자리(slotId) 경로는 그대로 남는다. 세이브·조도 계약이 그 이름을 쓴다.

   ★ 이 파일은 render3d/** 를 읽기만 한다. 고치지 않는다.

   쓰는 법
     const view = await createRoomView(canvas, {
       roomId:'banjiha', lightEngine, onSlotTap, onPlantTap, onReady, onError });
     view.setPlant('banjiha-sill:0', { kind:'monstera', progress01:0.4, band:'good' });

   좌표계는 house.js 그대로다 — 방은 원점 중심, 바닥 y=0.
============================================================ */

import { createScene, updateLight } from '../render3d/scene.js';
import { faintGrainTexture } from '../render3d/textures.js';
import { buildHouse, updateShellVisibility } from '../render3d/house.js';
import { winFromHouse } from '../engine/daylight_lux.js';
/* BAND_LOOK 은 밴드별 색·처짐 표다. 조립본에도 같은 표를 쓴다 —
   방과 확대가 같은 그루라면 "빛이 나쁘다"는 표시도 같아야 한다. */
import { createPlantSample, applyBand, BAND_LOOK } from '../render3d/plant_sample.js';
import { getPlantAssembler } from '../render3d/plant_assemble.js';
/* 걷는 길은 render3d/character.js 가 쓰던 것과 **같은 한 벌**을 쓴다.
   복사하면 방과 방 도구에서 통행 판정이 어긋난다(floor_nav.js 머리말). */
import { createFloorNav } from '../render3d/floor_nav.js';
/* ★ 배치 규칙은 game/place.js 한 벌만 쓴다.
   place.js 는 THREE 도 DOM 도 없이 도는 순수 모듈이라, 화면과 Node 테스트가
   **같은 식**으로 판정한다. 여기서 다시 짜면 두 벌이 되고 두 벌은 반드시 어긋난다
   (미리보기는 파란데 놓으면 거절 — previewMove 에서 이미 한 번 겪은 종류다). */
import { nearestSlot, slotHolds, freeSlotId, isFreeSlotId, FREE_PREFIX,
         samePoint, distanceXZ, inRoom, makeAt, atFromSlot } from './place.js';

/* ── 경로는 이 파일 기준으로 푼다 ──
   호스트 페이지가 저장소 뿌리에 있든 tools/ 아래에 있든 같은 곳을 가리켜야 한다.
   (참고: render3d/plant_sample.js 는 페이지 상대 경로 './assets/monstera' 를 쓴다.
    그래서 뿌리가 아닌 페이지에 얹으면 몬스테라만 404 가 난다 — 보고서에 적었다.) */
const AT = p => new URL(p, import.meta.url).href;

/* ============================================================
   폰 세로 기준값 — 기준 화면 390×844
============================================================ */
const PHONE = { w: 390, h: 844 };
const FOV_PORTRAIT = 38;     // 세로일 때 수직 화각[도]. 방 전경이 화면 폭을 채우는 값
const FOV_LANDSCAPE = 34;    // 가로/정사각이면 scene.js 기본값과 같게
const FIT_MARGIN = 1.03;     // 방이 화면 끝에 딱 붙지 않게 하는 여유
const FRAME_BIAS = 0.07;     // 방을 화면 한가운데보다 살짝 위에 둔다(아래는 UI 자리)
const TAP_PX = 12;           // 이만큼 안 움직이면 탭
const TAP_MS = 600;
const SLOT_HIT_PX = 30;      // 슬롯은 점이라 화면거리로 잡는다. 손가락 크기
/* ★ 캐릭터도 같은 방법으로 잡는다 — 방 전경에서 자취녀는 화면에서 40px 남짓이라
   레이캐스트만 두면 손가락으로는 거의 못 짚는다(폰에서 실제로 못 짚었다).
   슬롯보다 조금 넉넉하게 둔다. 사람이 슬롯보다 크게 보이기 때문이다. */
const CHAR_HIT_PX = 36;
const WALK_SPEED = 1.15;     // m/s. 1.5 는 5×4m 반지하에서 뛰어다니는 것처럼 보인다
const ARRIVE_EPS = 0.10;     // 이만큼 가까워지면 그 웨이포인트는 지난 것
const CAM_TWEEN_MS = 560;
const SNAP_MS = 260;         // 손 뗀 뒤 8방으로 정돈되는 시간

/* ★ 카메라 제약 (2026-08-03 박사님 지시 · docs/byeot_plan.md "8방회전 + pitch2")
   ------------------------------------------------------------
   방 도구(index.html)는 뭐든 볼 수 있어야 해서 el ±83°, r 4~40 이다.
   게임은 아니다 — 그 범위면 바닥 밑에서 천장을 올려다보고, 가까이 가면 벽 속에 들어간다.

   회전  자유롭게 돌리되 손을 떼면 가장 가까운 45°(8방)로 정돈된다.
         8방 고정만 하면 "내 방을 둘러본다"가 약하고, 자유회전만 두면 폰에서 방향을 잃는다.
   상하  16°~54° 에서 턱에 걸린다. 턱 너머로는 고무줄처럼 끌리다 손을 떼면 돌아온다
         (끝에서 뚝 끊기면 고장처럼 느껴진다).
   줌    방이 화면에 들어오는 거리(fit) 기준으로만 움직인다. 화면 비율마다 fit 이
         다르므로 절대값(7~20m)을 박으면 세로/가로 중 한쪽이 깨진다. */
const EL_MIN = 0.28, EL_MAX = 0.95;      // 약 16°~54°
const SNAP = Math.PI / 4;                // 8방
const RUBBER = 0.28;                     // 턱 너머로 끌리는 비율
const ZOOM_IN = 0.58, ZOOM_OUT = 1.15;   // fit 거리 대비 줌 한계

/* 기본 상하각은 화면 비율에 따라 다르다.
   세로 화면에서는 위에서 내려다볼수록 방 바닥이 세로로 길게 맺혀 화면을 더 채운다
   (5×4m 방을 45°에서 보면 가로 6.4m·세로 5.2m, 50°에서 보면 6.4×6.4 — 26% 더 크다).
   가로 화면에서는 반대로 낮게 봐야 방이 옆으로 눕지 않는다. 둘 다 턱(0.28~0.95) 안이다. */
const BASE_EL_PORTRAIT = 0.86;   // 약 49°
const BASE_EL_LANDSCAPE = 0.55;  // 약 32°
const FOCUS_EL = 0.30;
const YAW_OFFSET = SNAP;     // 창을 정면으로 두되 45° 튼 3/4 시점. 8방 격자 위의 한 칸이다

/* ============================================================
   작은 도구들
============================================================ */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp = (a, b, t) => a + (b - a) * t;

/* 턱걸림 — 한계를 넘어가면 그만큼 다 안 가고 조금만 따라간다(고무줄).
   손을 떼면 한계로 되돌아간다. 끝에서 그냥 멈추면 화면이 굳은 것처럼 느껴진다. */
const softClamp = (v, min, max, k = RUBBER) =>
  v < min ? min - (min - v) * k : v > max ? max + (v - max) * k : v;

/* 각도는 짧은 쪽으로 돈다 — 안 그러면 카메라가 방을 한 바퀴 돌아간다 */
function lerpAngle(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

/* ★ 회전 무관 지름 = 2 × max √(x²+z²)
   ------------------------------------------------------------
   bbox 로 재면 안 된다. pots/pot_concrete_square.glb 는 bbox 0.200 이라
   창턱 한도 0.21 을 통과하는 것처럼 보이는데 대각선이 0.275 라 실제로는 못 올라간다.
   네모 화분은 돌리면 안 들어간다. 그래서 회전에 무관한 지름으로만 비교한다.
   (core-to-house.md 2026-08-02 ④) */
/* space 는 '어느 좌표계에서 잰 지름인가' 다. 화분 메시 자기 좌표계에서 재면 GLB 원본
   크기(0.98m)가 나온다 — 화분을 줄인 배율이 그 메시의 scale 에 들어 있기 때문이다.
   실제로 자리를 차지하는 크기는 화분 그룹 좌표계에서 재야 나온다. 여기를 틀리면
   "0.99m 화분을 0.21m 창턱에 놓으려 했다"는 엉뚱한 경고가 뜬다(실제로 떴다). */
export function rotationSafeDiameter(obj, space) {
  const ref = space || obj;
  ref.updateWorldMatrix(true, true);
  obj.updateWorldMatrix(true, true);
  const inv = new THREE.Matrix4().copy(ref.matrixWorld).invert();
  const m = new THREE.Matrix4();
  const v = new THREE.Vector3();
  let maxR2 = 0;
  obj.traverse(o => {
    if (!o.isMesh || !o.geometry || !o.geometry.attributes || !o.geometry.attributes.position) return;
    m.multiplyMatrices(inv, o.matrixWorld);
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m);
      const r2 = v.x * v.x + v.z * v.z;
      if (r2 > maxR2) maxR2 = r2;
    }
  });
  return 2 * Math.sqrt(maxR2);
}

/* 화분만 잰다 — 잎은 화분 밖으로 나가는 게 정상이라 같이 재면 안 된다 */
function potPartOf(group) {
  /* 생장 모듈이 조립한 그루는 화분이 어느 자식인지 스스로 알려 준다.
     마디 트리라 "잎이 아닌 첫 자식" 규칙으로는 줄기가 잡힌다 — 그러면 화분 지름이
     줄기 굵기(2cm)로 나와 어떤 자리든 통과해 버린다. 티가 안 나는 종류의 사고다. */
  if (group.userData.potPart) return group.userData.potPart;
  const leaves = group.userData.leaves || [];
  return group.children.find(c => !leaves.includes(c)) || group;
}

async function loadJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`데이터를 못 읽었습니다: ${url} (${r.status})`);
  return r.json();
}

/* GLB 는 같은 파일을 여러 번 쓰므로 한 번만 받아서 복제한다 */
const _glbCache = new Map();
function loadGLB(url) {
  if (!_glbCache.has(url)) {
    if (!THREE.GLTFLoader) throw new Error('GLTFLoader 미로드 — 호스트 페이지의 script 태그를 확인하십시오');
    const ld = new THREE.GLTFLoader();
    _glbCache.set(url, new Promise((res, rej) => ld.load(url, g => res(g.scene), undefined,
      () => rej(new Error(`GLB 로드 실패: ${url}`)))));
  }
  return _glbCache.get(url).then(s => s.clone(true));
}

/* ============================================================
   createRoomView(canvas, opts) → view
   ------------------------------------------------------------
   opts
     roomId       처음 지을 방. 기본 'banjiha'
     lightEngine  game/light_adapter.js 의 createLightEngine() 결과(선택).
                  주면 그 조립 결과를 그대로 그린다 — 계산과 화면이 같은 방을 본다.
                  안 주면 이 모듈이 data/*.json 을 직접 읽어 혼자 짓는다.
     onSlotTap(slotId)   빈 자리를 눌렀다
     onPlantTap(slotId)  그 자리 화분을 눌렀다
     onSlotHover(slotId|null, type)  ★ PC 전용. 마우스가 자리 위에 올라왔다.
                  폰에서는 안 불린다(hover: hover 인 기기에서만). 이름·밝기 표시는 호스트 몫이다
     onCharacterTap(selected, tapped)  캐릭터를 눌렀다.
                  selected  누른 **결과** 골라진 id ('jachwi' | 'moni' | null)
                  tapped    실제로 눌린 id
                  ★ 첫 인자가 '누른 id' 가 아니라 '골라진 결과'다. 호스트가 흔히 쓰는
                    onCharacterTap: id => view.selectCharacter(id) 한 줄이 **양방향으로**
                    맞게 하려고 그렇게 뒀다. 같은 캐릭터를 다시 누르면 해제인데(아래),
                    첫 인자가 누른 id 면 호스트가 방금 푼 것을 도로 골라 버린다.
                  ★ 같은 캐릭터를 다시 누르면 **해제**된다(화분의 [✕]와 결이 같다).
                  ★ 이 콜백을 주든 안 주든 링(고르기)은 이 모듈이 알아서 켠다 —
                    호스트가 아무것도 안 해도 눌러서 걷게는 된다
     onProgress({phase, ko, done, total})  ★ 무엇을 기다리는 중인지.
                  검은 화면 40초는 고장으로 읽힌다. 진행 표시가 제일 값싼 개선이다
     onReady()           첫 프레임까지 다 그렸다
     onError(err)        조립·에셋 로딩이 깨졌다. ★ 조용히 넘기지 않는다
     orbit        돌리기·줌을 켤지. 기본 true
     maxPixelRatio 기본 1.75 (폰에서 2.0 은 픽셀이 두 배 넘게 든다)
     deferPlantAssets  몬스테라 조립 모듈(plant_grow.html + GLB 27MB)을 **방이 뜬 뒤에**
                  싣는다. ★ 기본은 false — 예전 그대로다.
                  재 보니 이것만으로는 0.3초밖에 안 줄었다(tools/test_boot_profile.mjs).
                  대신 첫 화분이 그만큼 늦게 나오므로 기본으로 켜지 않는다.
                  ★ 호스트가 확대 iframe(plant_grow.html)을 **늦게 싣도록** 바꾸면
                    그때는 켜는 게 맞다 — 그 경우 27MB 가 첫 화면의 유일한 짐이 된다
============================================================ */
/* ★방 재질을 한 단계 어둡게 (박사님 2026-08-03, 세 번째 요청 — "여전히 밝아").
   노출·채움광·배경을 다 낮췄는데도 방 안이 흰 이유는 **재질 자체가 거의 흰색**이라서다.
   ACES 톤매핑은 밝은 쪽을 눌러 주지만 흰 벽은 눌러도 흰 벽이다. 색을 직접 내려야 한다.

   ⚠ 재질 데이터(room_finishes.json)는 house 창 소유다. 파일은 안 건드리고
     **게임 뷰에서 조립된 결과만** 곱한다 — 방 도구(index.html)는 그대로 밝다.
   ⚠ 곱하기라 무늬·질감은 살아 있다. 단색으로 덮으면 벽지 결이 죽는다.
   ⚠ 유리는 건드리지 않는다 — 창은 "밖이 밝다"는 정보다. */
const ROOM_DIM = 0.62, FURN_DIM = 0.78;
function isDescendant(node, root) {
  for (let p = node; p; p = p.parent) if (p === root) return true;
  return false;
}
function dimRoomMaterials(b) {
  if (!b || !b.room) return;
  const seen = new Set();
  b.room.traverse(o => {
    if (!o.isMesh || !o.material) return;
    /* 가구는 방보다 덜 누른다 — 다 같이 내리면 형태가 뭉개져 무엇이 무엇인지 안 보인다 */
    const k = (b.furniture && isDescendant(o, b.furniture)) ? FURN_DIM : ROOM_DIM;
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    ms.forEach(m => {
      if (!m || !m.color || seen.has(m.uuid)) return;
      if (m.transparent && m.opacity < 0.95) return;      // 유리는 그대로
      seen.add(m.uuid);
      m.color.multiplyScalar(k);
    });
  });
}

export async function createRoomView(canvas, opts = {}) {
  const O = {
    roomId: 'banjiha', lightEngine: null,
    onSlotTap: null, onPlantTap: null, onSlotHover: null, onCharacterTap: null,
    onProgress: null, onReady: null, onError: null,
    orbit: true, maxPixelRatio: 1.75, deferPlantAssets: false, ...opts
  };
  const fail = (e) => {
    const err = e instanceof Error ? e : new Error(String(e));
    console.error('[방뷰]', err);
    try { O.onError && O.onError(err); } catch (_) { /* 콜백까지 깨지면 더 할 게 없다 */ }
    return err;
  };

  if (!canvas) throw fail(new Error('canvas 가 없습니다'));
  if (typeof THREE === 'undefined') throw fail(new Error('THREE 미로드 — 호스트 페이지의 script 태그를 확인하십시오'));

  /* ── 렌더러 컨텍스트 속성 ──
     scene.js 는 antialias:true 로 렌더러를 만든다. 폰(DPR≥2)에서는 MSAA 가
     그냥 낭비라 끄고 싶은데 createScene 이 인자를 안 받는다.
     캔버스에 컨텍스트를 먼저 만들어 두면 브라우저가 같은 컨텍스트를 돌려주므로
     scene.js 를 고치지 않고 속성만 바꿀 수 있다. (보고서 5번에 개선 요청을 적었다) */
  const dpr = window.devicePixelRatio || 1;
  if (dpr >= 2) {
    try {
      canvas.getContext('webgl2', { antialias: false, alpha: false, stencil: false,
                                    powerPreference: 'high-performance', depth: true });
    } catch (_) { /* 실패하면 그냥 scene.js 기본값으로 간다 */ }
  }

  const ctx = createScene(canvas);
  const GRAIN = faintGrainTexture();

  /* 폰 기준 그림자 예산 — scene.js 기본은 데스크톱 기준(2048)이라 폰에선 과하다 */
  ctx.sunLight.shadow.mapSize.set(1024, 1024);
  ctx.ceilingBulb.shadow.mapSize.set(512, 512);
  ctx.renderer.shadowMap.type = THREE.PCFShadowMap;   // Soft 는 폰에서 눈에 띄게 비싸다

  /* ── 상태 ── */
  const houseGroup = new THREE.Group();
  ctx.scene.add(houseGroup);

  let data = null;             // lightEngine 없이 혼자 지을 때만 채운다
  let furnNames = {};          // 프리셋 → {name_ko} — 자리 이름을 한글로 내주려고만 쓴다
  let roomId = null, roomDef = null, built = null;
  let slotById = new Map();    // slotId → 슬롯(월드좌표)
  let plants = new Map();      // slotId → { group, spec, potD, days }
  let rings = new Map();       // slotId → 하이라이트 링 메시
  let highlighted = new Set();
  let focused = null;
  let daylightT = 0.5;
  let disposed = false;
  /* 플레이어가 돌려 놓은 화분 각도(Y축). ★ 화분이 다시 조립돼도 유지해야 한다 —
     안 그러면 며칠 지나 형태가 바뀔 때 방향이 저절로 되돌아간다. */
  let plantYaw = new Map();    // slotId → radian
  let chars = new Map();       // 'jachwi' | 'moni' → { id, root, update(dt), dispose() }
  let preview = null;          // { fromId, toId, group } — 옮기기 미리보기(반투명 복제)
  let selChar = null;          // 지금 고른 캐릭터 id. null 이면 아무도 안 골랐다
  let walkGhost = null;        // { mesh, ring, ok } — 걸어갈 자리 미리보기
  /* 바닥 길 찾기 — 방을 지을 때마다 colliders 를 다시 물린다.
     반지름은 BODY_R(0.38). 3.5등신 치비라 어깨가 넓다. */
  const nav = createFloorNav({ radius: 0.38 });

  /* ── 자유 좌표 배치 (2026-08-03) ────────────────────────────────────────
     ★ plants 의 열쇠는 두 가지뿐이다. 섞이면 같은 화분이 두 번 그려진다("복사 버그").
         추천 자리 위  →  그 자리의 안정 slotId (`{가구 uid}:{단}`) — 예전 그대로
         자유 좌표     →  place.freeSlotId(화분 id) = `free:{화분 id}`
       state.js·light_adapter.js 가 세이브·조도에서 쓰는 이름과 **같은 규약**이다.
       그래야 화면과 계산이 같은 자리를 같은 이름으로 부른다. */
  let guideGroup = null;       // 추천 자리 원형 가이드. ★ 한 번 만들고 보이기만 껐다 켠다
  let guideRings = new Map();  // slotId → 링 메시
  let guideMat = null, guideGeo = null;
  let guideNear = null;        // 지금 굵게 칠한 자리(커서에 제일 가까운 것)
  let furnGhost = null;        // { uid, group, mat, line, ok } — 가구 옮기기 유령
  /* lightEngine 없이 혼자 지을 때 쓰는 가구 덮어쓰기 표.
     엔진이 있으면 light_adapter 쪽이 정본이고 여기는 안 쓴다(두 벌을 만들지 않는다). */
  let localFurn = {};

  /* ★ 부팅 이정표 — "무엇을 몇 초 기다렸나"를 남긴다.
     밖에서 재는 것보다 이게 정확하다(네트워크 시간과 조립 시간이 갈린다). */
  const T0 = performance.now();
  const timings = {};
  function progress(phase, ko, done, total) {
    if (timings[phase] == null) timings[phase] = Math.round(performance.now() - T0);
    try { O.onProgress && O.onProgress({ phase, ko, done, total, ms: Math.round(performance.now() - T0) }); }
    catch (e) { /* 진행 표시가 깨져서 부팅이 멈추면 본말전도다 */ }
  }

  const cam = { az: 0, el: BASE_EL_PORTRAIT, dist: 8, target: new THREE.Vector3(0, 1, 0), look: new THREE.Vector3() };
  let tween = null;            // { from, to, t0, ms }
  /* 플레이어가 만져 놓은 시점 — 방을 바꾸거나 화면이 돌아가도 유지한다 */
  let userYaw = 0;             // 기본 방위에서 튼 각(스냅되어 45° 배수)
  let userEl = null;           // 상하각. null 이면 화면 비율에 맞춘 기본값을 쓴다
  let zoomK = 1;               // fit 거리 대비 배율
  let fitDist = 8;             // 지금 화면 비율에서 방이 다 들어오는 거리

  let needsRender = true;      // 놀 때는 안 그린다
  let raf = 0;
  /* navPaths·nudges 는 진단용 계수기다 — "걸을 때 왜 느린가"를 짐작이 아니라
     횟수로 답하려고 둔다(tools/test_roomview_perf.mjs 가 구간별 차분을 읽는다). */
  const stats = { fps: 0, frames: 0, drawn: 0, last: performance.now(), worstMs: 0,
                  navPaths: 0, nudges: 0 };
  let forceContinuous = false; // 데모/측정용

  /* ============================================================
     ① 방 조립
  ============================================================ */
  async function ensureData() {
    if (data) return data;
    progress('data', '방 데이터를 읽는 중');
    const [houseRooms, winPresets, doorPresets, finishes, furnPresets, lightPresets, shadePresets] =
      await Promise.all([
        loadJSON(AT('../../data/house_rooms.json')),
        loadJSON(AT('../../data/window_presets.json')),
        loadJSON(AT('../../data/door_presets.json')),
        loadJSON(AT('../../data/room_finishes.json')),
        loadJSON(AT('../../data/furniture_presets.json')),
        loadJSON(AT('../../data/lighting_presets.json')),
        loadJSON(AT('../../data/shading_presets.json'))
      ]);
    data = {
      houseRooms,
      winPresets: winPresets.presets || winPresets,
      doorPresets: doorPresets.presets || doorPresets,
      finishes,
      furnPresets: furnPresets.presets || furnPresets,
      lightPresets, shadePresets
    };
    /* ★ 화분 슬롯을 내는 가구는 uid 가 있어야 한다(core-to-house.md ②).
       없으면 조용히 메꾸지 않고 소리내어 알린다 — 저장된 화분이 남의 자리로 가는 사고다. */
    for (const [rk, rv] of Object.entries(data.houseRooms.rooms || {})) {
      const bad = (rv.furniture || []).filter(f => !f.uid);
      if (bad.length) console.warn(`[방뷰] ${rk}: uid 없는 가구 ${bad.length}개 — slotId 가 흔들립니다`);
    }
    return data;
  }

  /* lightEngine 없이 혼자 지을 때만 쓴다 — 플레이어가 옮긴 가구를 얹은 **사본**을 만든다.
     ⚠ data/house_rooms.json 은 절대 안 고친다(light_adapter.defWithOverrides 와 같은 사상:
       "기본값 + 차이". 세이브를 지우면 원래 방으로 돌아와야 한다). */
  function applyLocalFurn(def) {
    const ids = Object.keys(localFurn);
    if (!ids.length || !def.furniture) return def;
    return { ...def, furniture: def.furniture.map((f, i) => {
      /* uid 가 없는 가구는 house.js 가 `{프리셋}#{인덱스}` 를 붙인다 — 같은 식으로 찾는다 */
      const uid = f.uid || (f.preset + '#' + i);
      return localFurn[uid] ? { ...f, ...localFurn[uid] } : f;
    }) };
  }

  /* opt.prebuilt = { built, def, wins } — 이미 조립된 결과를 그대로 쓴다.
     ★ 가구를 옮기면 light_adapter.moveFurniture 가 이미 방을 다시 지었다. 그걸 안 받으면
       여기서 buildHouse 를 **한 번 더** 돌게 된다(재조립은 비싸다 — 손 뗄 때 한 번뿐이어야 한다). */
  async function assemble(id, opt = {}) {
    /* 이전 방 정리 */
    disposePreview();
    disposeFurnGhost();
    disposeWalkGhost();
    selChar = null;
    /* 캐릭터도 이 그룹에 들어 있다. 그냥 비우면 치워지지 않은 채 씬에서만 사라져
       mixer 와 GLB 가 그대로 남는다 — 방을 몇 번 바꾸면 그게 그대로 메모리다.
       치우되 **누가 있었는지는 기억해** 새 방에 다시 세운다. */
    const wasHere = [...chars.keys()];
    for (const [, c] of chars) { try { c.dispose(); } catch (e) { /* 나머지는 계속 치운다 */ } }
    chars.clear();
    clearPlants();
    clearRings();
    clearGuideRings();
    while (houseGroup.children.length) houseGroup.remove(houseGroup.children[0]);

    /* 가구 한글 이름표는 가볍다(수십 KB). lightEngine 을 받아 방을 안 짓는 경우에도
       자리 이름은 사람 말로 내줘야 하니 이것만 따로 읽는다. */
    if (!Object.keys(furnNames).length) {
      try { furnNames = await loadJSON(AT('../../data/furniture_presets.json')).then(d => d.presets || d); }
      catch (e) { console.warn('[방뷰] 가구 이름표를 못 읽었습니다 — 자리 이름이 영문 프리셋 id 로 나옵니다'); }
    }

    progress('room', '방을 짓는 중');
    let wins;
    if (opt.prebuilt && opt.prebuilt.built) {
      /* 이미 지어진 것을 받았다 — 두 번 짓지 않는다 */
      built = opt.prebuilt.built; roomDef = opt.prebuilt.def; wins = opt.prebuilt.wins;
    } else if (O.lightEngine && typeof O.lightEngine.build === 'function') {
      /* ★ 조도 계산과 같은 방을 그린다. 두 번 짓지 않는다(폰에서 조립 비용이 아깝다). */
      const r = O.lightEngine.build(id);
      built = r.built; roomDef = r.def; wins = r.wins;
    } else {
      const d = await ensureData();
      const raw = (d.houseRooms.rooms || {})[id];
      if (!raw) throw new Error(`모르는 방: ${id}`);
      roomDef = applyLocalFurn(raw);
      built = buildHouse(GRAIN, roomDef, d.winPresets, d.doorPresets, d.finishes,
                         d.furnPresets, d.lightPresets, d.shadePresets);
      wins = (built.luxWins || [])
        .map(w => winFromHouse(w.wall, w.cu, w.cy, w.w, w.h, built.size, w.tau, w.evScale, w.cz))
        .filter(Boolean);
    }
    if (!built || !built.room) throw new Error(`방 조립 결과가 비었습니다: ${id}`);
    dimRoomMaterials(built);

    roomId = id;
    houseGroup.add(built.room);
    /* 걸어 다닐 바닥을 다시 물린다 — 방이 바뀌면 벽도 가구도 다 다르다 */
    nav.setWorld({ colliders: built.colliders || [], size: built.size });

    /* 창 확산광 — main.js 와 같은 방식으로 넓은 창은 토막 내서 넘긴다.
       창 하나를 점광원 하나로 두면 창 한가운데만 밝아진다(발코니 통창 문제). */
    const SEG = 2.2;
    ctx.skyWins = [];
    for (const w of (wins || [])) {
      const n = Math.max(1, Math.min(4, Math.round(w.width / SEG)));
      const ux = w.ux || 0, uy = w.uy || 0, uz = w.uz || 0;
      for (let i = 0; i < n; i++) {
        const t = (i - (n - 1) / 2) * (w.width / n);
        ctx.skyWins.push({
          x: w.cx + ux * t, y: w.cy + uy * t, z: w.cz + uz * t,
          nx: w.nx || 0, ny: w.ny || 0, nz: w.nz || 0,
          area: (w.width / n) * w.height, tau: w.tau, ev: w.evScale
        });
      }
    }
    ctx.winPos = built.winPos;
    ctx.glassMeshes = built.glassMeshes;
    ctx.clShade = null;
    built.furniture.traverse(o => {
      if (o.parent && o.parent.userData && o.parent.userData.lampShade === o) ctx.clShade = o;
    });

    /* 슬롯 — ★ slotId 로만 다룬다. 전역 순번은 폐기됐다(core-to-house.md ②) */
    slotById = new Map();
    for (const s of (built.plantSlots || [])) {
      if (slotById.has(s.slotId))
        console.error(`[방뷰] slotId 중복 — ${id}: ${s.slotId}. house_rooms.json 의 uid 가 겹칩니다`);
      slotById.set(s.slotId, s);
    }
    if (!slotById.size) console.warn(`[방뷰] ${id}: 화분 슬롯이 없습니다`);

    frameRoom(true);
    applyDaylight();
    needsRender = true;

    /* 있던 사람은 새 방에도 세운다. 자리는 새 방 기준으로 다시 고른다.
       기다리지 않는다 — 캐릭터를 싣느라 방이 안 뜨면 안 된다. */
    for (const k of wasHere)
      setCharacter(k).catch(e => console.warn('[방뷰] 방을 바꾼 뒤 캐릭터를 다시 못 세웠습니다:', e.message));
  }

  /* ============================================================
     ② 카메라 — 폰 세로가 기준이다
     ------------------------------------------------------------
     세로 화면(390×844, 종횡비 0.46)에 방 하나를 통째로 채울 방법은 없다.
     5×4m 짜리 방을 어느 각도에서 봐도 화면에 맺히는 모양은 가로로 넓다.
     억지로 세로를 채우려면 방 일부를 잘라야 하는데, 그러면 화분 자리가 화면 밖으로 나간다.

     그래서 **가로를 채우고 세로는 남긴다.** 방은 화면 폭을 꽉 채운 띠로 가운데
     조금 위에 앉고, 위/아래 빈 자리는 게임 UI(상단 정보·하단 버튼)가 쓴다.
     벽은 house.js 의 시야자동 컷어웨이로 열리므로 인형의 집처럼 보인다.
     방을 크게 보고 싶으면 focusSlot() 으로 들어간다 — 그게 이 화면의 줌이다.
  ============================================================ */
  function roomBox() {
    const s = built.size;
    return { w: s.w, d: s.d, h: s.h };
  }

  const defaultEl = () => (ctx.cam.aspect < 0.95 ? BASE_EL_PORTRAIT : BASE_EL_LANDSCAPE);

  /* 창이 있는 벽을 마주 보는 방위각. 창이 게임의 주인공이라 창이 보여야 한다. */
  function windowAzimuth() {
    const ws = (built.luxWins || []).filter(w => w.wall && w.wall !== 'ceiling');
    if (!ws.length) return 0;
    let big = ws[0], area = 0;
    for (const w of ws) { const a = (w.w || 0) * (w.h || 0); if (a > area) { area = a; big = w; } }
    // 카메라는 창 반대편(방 안쪽)에 선다. az=0 이면 카메라가 +z 쪽이다.
    switch (big.wall) {
      case 'back': return 0;                 // 창 z=-D/2 → 카메라 +z
      case 'front': return Math.PI;
      case 'left': return Math.PI / 2;       // 창 x=-W/2 → 카메라 +x
      case 'right': return -Math.PI / 2;
    }
    return 0;
  }

  /* 방 상자 8꼭짓점이 다 들어오는 가장 가까운 거리.
     ------------------------------------------------------------
     삼각함수로 어림잡으면(각 꼭짓점의 가로/세로 성분을 tan 으로 나누는 식) 안전한 대신
     늘 필요 이상으로 멀어진다 — 세로 화면에서는 그 여유가 그대로 "방이 작다"가 된다.
     그래서 실제로 투영해 보고 이분법으로 최소 거리를 찾는다. 프레이밍이 바뀔 때만 돈다. */
  const _probe = new THREE.PerspectiveCamera();
  const _pv = new THREE.Vector3();
  function fitDistance(target, az, el) {
    const b = roomBox();
    const corners = [];
    for (const sx of [-1, 1]) for (const sy of [0, 1]) for (const sz of [-1, 1])
      corners.push(new THREE.Vector3(sx * b.w / 2, sy * b.h, sz * b.d / 2));
    const dir = new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
    const tanV = Math.tan(THREE.MathUtils.degToRad(ctx.cam.fov) / 2);
    const lim = 1 / FIT_MARGIN;

    _probe.fov = ctx.cam.fov; _probe.aspect = ctx.cam.aspect;
    _probe.near = ctx.cam.near; _probe.far = ctx.cam.far;

    const look = new THREE.Vector3();
    const fits = d => {
      _probe.position.copy(target).addScaledVector(dir, d);
      look.copy(target); look.y -= d * tanV * FRAME_BIAS;      // 화면에서 위로 밀어 둔 만큼
      _probe.lookAt(look);
      _probe.updateMatrixWorld(true);
      _probe.updateProjectionMatrix();
      for (const c of corners) {
        _pv.copy(c).applyMatrix4(_probe.matrixWorldInverse);
        if (_pv.z > -_probe.near) return false;                // 카메라 뒤로 넘어간 꼭짓점
        _pv.applyMatrix4(_probe.projectionMatrix);
        if (Math.abs(_pv.x) > lim || Math.abs(_pv.y) > lim) return false;
      }
      return true;
    };

    let hi = Math.max(12, (b.w + b.d + b.h) * 8);
    if (!fits(hi)) return hi;                                  // 여기까지 멀어도 안 들어오면 포기
    let lo = 0.2;
    for (let i = 0; i < 26; i++) { const mid = (lo + hi) / 2; if (fits(mid)) hi = mid; else lo = mid; }
    return hi;
  }

  /* 방 전체 보기. userYaw·userEl·zoomK 는 플레이어가 만져 놓은 시점이다 — 화면이
     돌아가거나 방이 바뀌어도 유지한다(다시 볼 때마다 시점이 리셋되면 화난다). */
  function frameRoom(snap) {
    const b = roomBox();
    const az = windowAzimuth() + YAW_OFFSET + userYaw;
    // 눈높이를 방 한가운데보다 조금 위로 — 선반 위 화분이 바닥에 묻히지 않는다
    const target = new THREE.Vector3(0, b.h * 0.42, 0);
    const el = clamp(userEl == null ? defaultEl() : userEl, EL_MIN, EL_MAX);
    fitDist = fitDistance(target, az, el);
    const dist = clamp(fitDist * zoomK, fitDist * ZOOM_IN, fitDist * ZOOM_OUT);
    focused = null;
    setCam({ az, el, dist, target }, snap);
  }

  /* 지금 프레이밍에서의 줌 한계. 화면 비율마다 fit 이 달라 절대값으로 박으면 안 된다. */
  function zoomRange() {
    const f = fitDist || cam.dist;
    return [f * ZOOM_IN, f * ZOOM_OUT];
  }

  /* 손을 떼면 정돈한다 — 8방으로 스냅하고, 턱 너머로 끌려간 값은 턱으로 되돌린다 */
  function settleCam() {
    if (focused) {                       // 자리에 들어가 있을 땐 스냅하지 않는다
      const [lo, hi] = [0.5, 3.6];
      const el = clamp(cam.el, EL_MIN, EL_MAX), dist = clamp(cam.dist, lo, hi);
      if (Math.abs(el - cam.el) > 1e-3 || Math.abs(dist - cam.dist) > 1e-3)
        setCam({ az: cam.az, el, dist, target: cam.target }, false, SNAP_MS);
      return;
    }
    const base = windowAzimuth() + YAW_OFFSET;
    const snapped = base + Math.round((cam.az - base) / SNAP) * SNAP;
    const el = clamp(cam.el, EL_MIN, EL_MAX);
    const [lo, hi] = zoomRange();
    const dist = clamp(cam.dist, lo, hi);
    userYaw = snapped - base;
    userEl = el;
    zoomK = dist / (fitDist || dist);
    setCam({ az: snapped, el, dist, target: cam.target }, false, SNAP_MS);
    /* 시점이 바뀌면 누가 무엇을 가리는지도 바뀐다. 카메라가 다 정돈된 뒤에 본다 —
       도는 중에 재면 매 프레임 다른 답이 나와 캐릭터가 안절부절못한다. */
    clearTimeout(settleCam._nudge);
    settleCam._nudge = setTimeout(() => { if (!disposed) nudgeIfOccluding(); }, SNAP_MS + 80);
  }

  function setCam(goal, snap, ms) {
    if (snap) {
      cam.az = goal.az; cam.el = goal.el; cam.dist = goal.dist; cam.target.copy(goal.target);
      tween = null;
    } else {
      tween = { from: { az: cam.az, el: cam.el, dist: cam.dist, target: cam.target.clone() },
                to: { az: goal.az, el: goal.el, dist: goal.dist, target: goal.target.clone() },
                t0: performance.now(), ms: ms || CAM_TWEEN_MS };
    }
    needsRender = true;
  }

  function stepTween(now) {
    if (!tween) return false;
    const t = clamp((now - tween.t0) / (tween.ms || CAM_TWEEN_MS), 0, 1);
    const k = ease(t);
    cam.az = lerpAngle(tween.from.az, tween.to.az, k);
    cam.el = lerp(tween.from.el, tween.to.el, k);
    cam.dist = lerp(tween.from.dist, tween.to.dist, k);
    cam.target.lerpVectors(tween.from.target, tween.to.target, k);
    if (t >= 1) tween = null;
    return true;
  }

  function updateCam() {
    const { az, el, dist } = cam;
    ctx.cam.position.set(
      cam.target.x + dist * Math.cos(el) * Math.sin(az),
      cam.target.y + dist * Math.sin(el),
      cam.target.z + dist * Math.cos(el) * Math.cos(az));
    /* 화면 한가운데보다 살짝 위에 방을 둔다 — 아래쪽은 UI 자리다.
       카메라를 옮기는 대신 보는 점을 내린다(방은 위로 밀린다). */
    const tanV = Math.tan(THREE.MathUtils.degToRad(ctx.cam.fov) / 2);
    cam.look.copy(cam.target);
    cam.look.y -= dist * tanV * FRAME_BIAS;
    ctx.cam.lookAt(cam.look);
    if (built) updateShellVisibility(built.shells, ctx.cam, 'auto', built.trims);
  }

  /* ============================================================
     ③ 화분
  ============================================================ */
  const MONSTERA_POT_D = 0.20;    // assets/monstera/pot.glb 회전무관 지름 0.202
  const SIRU_D = 0.24;            // 열린 콩나물 시루

  function slotOrThrow(slotId) {
    const s = slotById.get(slotId);
    if (!s) throw new Error(`모르는 슬롯: ${slotId} (방 ${roomId})`);
    return s;
  }

  /* 슬롯이 받아 줄 화분 지름. maxPotD 가 없으면 제한 없음으로 본다. */
  function slotPotLimit(s) {
    return Number.isFinite(s.maxPotD) ? s.maxPotD : Infinity;
  }

  /* ★ 방의 몬스테라 = 탭했을 때 보는 몬스테라 (2026-08-03 박사님 지시)
     ------------------------------------------------------------
     plant_sample.js 는 잎 5장을 고정 배치표로 놓는 자리채움이라 "크는 게" 안 보였다.
     이제 plant_grow.html 의 buildPlant 를 그대로 불러 쓴다(render3d/plant_assemble.js).
     실패하면 조용히 빈 화면을 내지 않고 옛 샘플로 내려앉되, 왜 내려앉았는지는 남긴다. */
  let asmPromise = null, asmWarned = false;
  function assembler() {
    if (asmPromise === null) {
      asmPromise = getPlantAssembler({}).catch(e => {
        if (!asmWarned) {
          asmWarned = true;
          console.warn('[방뷰] 생장 모듈을 못 실었습니다 — 옛 샘플(plant_sample.js)로 그립니다:', e.message);
        }
        return null;
      });
    }
    return asmPromise;
  }

  /* 창이 있는 방향(라디안). 굴광성이 그쪽으로 기울어야 방과 확대가 같은 그루가 된다. */
  function lightAzimuth() {
    const ws = (built && built.luxWins || []).filter(w => w.wall && w.wall !== 'ceiling');
    if (!ws.length) return Math.PI * 0.5;
    let big = ws[0], area = 0;
    for (const w of ws) { const a = (w.w || 0) * (w.h || 0); if (a > area) { area = a; big = w; } }
    switch (big.wall) {                       // 방 안에서 창을 바라보는 방위
      case 'back': return Math.PI;            // 창이 z=-D/2 → 빛은 -z 에서 온다
      case 'front': return 0;
      case 'left': return -Math.PI / 2;
      case 'right': return Math.PI / 2;
    }
    return Math.PI * 0.5;
  }

  /* 유효 생장일 — 형태를 정하는 유일한 값.
     ① spec.growthDays 가 있으면 그것. **이게 정확한 길이다** — 호출부가 생장 창의
        growthDays() 를 그대로 넘기면 방과 확대가 같은 날의 같은 그루가 된다
     ② 없으면 phaseId 로 되짚는다. 지금 그 자리에 서 있는 날을 하한으로 줘서
        되풀이되는 단계(spear_furled 등)가 어느 바퀴인지 정해지게 한다
     ③ 둘 다 없으면(데모·수동 조작) 0..1 을 첫 해(365일)에 펼친다 */
  const DEMO_SPAN_DAYS = 365;
  function growthDaysOf(spec, asm, minDay) {
    if (Number.isFinite(spec.growthDays)) return Math.max(0, Math.round(spec.growthDays));
    if (asm && spec.phaseId) {
      const d = asm.daysForPhase(spec.phaseId, spec.progress01, minDay);
      if (d != null) return d;
    }
    return Math.round(clamp(spec.progress01 ?? 1, 0, 1) * DEMO_SPAN_DAYS);
  }

  /* days 는 호출부(setPlant)가 이미 정한 유효 생장일이다.
     여기서 다시 구하면 안 된다 — 단조 되짚기의 하한이 달라져 값이 어긋난다. */
  /* limit 은 **화분 지름 상한[m]** 이다(자리 한도이거나 호출부가 정한 값).
     ★ 예전에는 슬롯 객체를 받았다. 자유 좌표에는 슬롯이 없으므로 숫자로 낮췄다 —
       이 함수가 슬롯을 알 이유가 없었다는 뜻이기도 하다. */
  async function buildPlantGroup(spec, limit, days) {
    const kind = spec.kind || 'monstera';
    const p01 = clamp(spec.progress01 ?? 1, 0, 1);

    if (kind === 'monstera') {
      /* 화분 지름은 자리 한도 안에서 고른다. 성장은 잎·마디로만 보인다 —
         화분이 같이 자라면 자리 한도 계약이 무너진다. */
      const potD = Math.min(MONSTERA_POT_D, limit === Infinity ? MONSTERA_POT_D : limit);
      const asm = await assembler();
      if (asm) {
        try {
          const g = asm.assemble({ growthDays: days, seed: spec.seed, potD,
                                   lightAz: lightAzimuth(), photo: 0.5 });
          g.userData.growthDays = days;
          return g;
        } catch (e) {
          if (!asmWarned) { asmWarned = true; console.warn('[방뷰] 몬스테라 조립 실패 — 옛 샘플로 그립니다:', e.message); }
        }
      }
      /* 폴백 — 생장 모듈이 없을 때만. 자라는 게 잘 안 보이지만 화면은 빈 채로 두지 않는다 */
      const H = Math.max(potD * 1.4, potD * 3.4 * (0.42 + 0.58 * p01));
      const g = await createPlantSample({ potD, height: H });
      g.userData.kind = 'monstera';
      g.userData.growthDays = days;
      return g;
    }

    if (kind === 'beansprout') {
      /* 시루 + 콩나물. 콩나물은 어두울수록 좋은 작물이라 밴드 해석이 몬스테라와 반대다.
         여기서는 '자란 정도'만 그린다 — 판정은 게임 쪽 몫이다. */
      const g = new THREE.Group();
      const siru = await loadGLB(AT('../../assets/crops/container_siru_open.glb'));
      const bb = new THREE.Box3().setFromObject(siru);
      const cur = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) || SIRU_D;
      const want = Math.min(SIRU_D, limit === Infinity ? SIRU_D : limit);
      siru.scale.setScalar(want / cur);
      const bb2 = new THREE.Box3().setFromObject(siru);
      siru.position.y -= bb2.min.y;
      g.add(siru);
      const rim = bb2.max.y - bb2.min.y;

      const stage = p01 < 0.34 ? 's' : p01 < 0.7 ? 'm' : 'l';
      const body = await loadGLB(AT(`../../assets/crops/beansprout_${stage}.glb`));
      const n = Math.round(lerp(4, 11, p01));
      for (let i = 0; i < n; i++) {
        const c = i === 0 ? body : body.clone(true);
        const a = (i / n) * Math.PI * 2 + i * 0.7;
        const r = want * 0.30 * Math.sqrt((i + 0.4) / n);
        c.scale.setScalar(want / SIRU_D);
        c.position.set(Math.cos(a) * r, rim * 0.55, Math.sin(a) * r);
        c.rotation.y = a;
        c.rotation.z = (Math.random() - 0.5) * 0.18;
        g.add(c);
      }
      g.userData.kind = 'beansprout';
      g.userData.leaves = [];
      return g;
    }

    throw new Error(`모르는 식물 종류: ${kind}`);
  }

  /* 밴드·시듦 표현.
     ------------------------------------------------------------
     옛 샘플은 잎 5장이 pivot 으로 묶여 있어 applyBand 가 색과 처짐을 다 줄 수 있었다.
     생장 모듈이 조립한 그루는 마디 트리라 그런 pivot 이 없다. 대신 그루 색이 이미
     씨앗·나이로 정해져 있으므로 **덧칠이 아니라 그 색을 밴드 쪽으로 끌어당긴다** —
     setHex 로 갈아치우면 개체마다 다른 색이 전부 같은 색이 되어 그루 구분이 사라진다. */
  function applyLook(group, spec) {
    const band = spec.band || 'unknown';
    if (group.userData.isPlantAssembled) {
      const look = BAND_LOOK[band] || BAND_LOOK.unknown;
      const tint = new THREE.Color(look.tint);
      /* 좋은 빛(tint 흰색)이면 아무것도 안 한다 — 원래 색이 정답이다 */
      const k = look.tint === 0xffffff ? 0 : 0.55;
      group.traverse(o => {
        if (!o.isMesh || !o.material || !o.material.color) return;
        if (!o.userData.baseColor) o.userData.baseColor = o.material.color.clone();
        o.material.color.copy(o.userData.baseColor);
        if (k > 0) o.material.color.lerp(tint, k);
      });
      group.userData.band = band;
    } else if (group.userData.kind === 'monstera') {
      applyBand(group, band);
    }
    const fade = clamp(spec.fade ?? 0, 0, 1);
    if (fade > 0.001) {
      /* 밴드 위에 얹는다 — 색을 마른 잎 쪽으로 끌고, 조금 더 처지게 한다 */
      const dry = new THREE.Color(0x8a7350);
      group.traverse(o => {
        if (o.isMesh && o.material && o.material.color) o.material.color.lerp(dry, fade * 0.8);
      });
      for (const pivot of (group.userData.leaves || [])) {
        pivot.rotation.x += fade * 0.45;
        pivot.scale.multiplyScalar(1 - fade * 0.18);
      }
    }
    group.userData.spec = spec;
  }

  /* ★ 재질을 이 그루 것으로 만든다.
     ------------------------------------------------------------
     생장 모듈의 화분·줄기 GLB 는 THREE 의 clone(true) 로 복제되는데 **재질은 공유된다.**
     그대로 두면 두 가지가 조용히 터진다.
       ① 한 그루에 밴드 색을 얹으면 방 안의 모든 그루가 같이 변한다
       ② 한 그루를 치울 때 disposeObject 가 그 재질을 버려, 원본(ASSETS)까지 못 쓰게 된다
     한 번만 복제하고 표시해 둔다. */
  function ownMaterials(group) {
    group.traverse(o => {
      if (!o.isMesh || !o.material) return;
      const one = m => {
        if (m && m.userData && m.userData.__rvOwned) return m;
        const c = m.clone();
        c.userData = { ...(m.userData || {}), __rvOwned: true };
        return c;
      };
      o.material = Array.isArray(o.material) ? o.material.map(one) : one(o.material);
    });
  }

  function disposeObject(obj) {
    obj.traverse(o => {
      if (o.isMesh) {
        /* ★ 원본과 나눠 쓰는 기하는 안 버린다(plant_assemble 이 표시해 준다).
           버리면 다음 그루가 GPU 에 다시 올려야 한다 — 매일 다시 짓는 화면에서는
           그게 그대로 프레임 값이 된다. */
        if (!o.userData.sharedGeometry) o.geometry && o.geometry.dispose && o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
        for (const m of mats) m.dispose && m.dispose();
      }
    });
  }

  function removePlant(slotId) {
    const p = plants.get(slotId);
    if (!p) return;
    houseGroup.remove(p.group);
    disposeObject(p.group);
    plants.delete(slotId);
    needsRender = true;
  }

  function clearPlants() {
    for (const id of [...plants.keys()]) removePlant(id);
  }

  /* ── 화분을 '자리'가 아니라 '개체'로 찾는다 ──────────────────────────────
     자유 좌표 배치가 들어오면서 한 화분이 열쇠를 갈아탈 수 있게 됐다
     (`{가구 uid}:{단}` ↔ `free:{화분 id}`). 그때 옛 열쇠를 안 지우면 화면에 두 그루가
     남는다 — 이게 예전 "복사처럼 보이던" 버그의 정체다. 그래서 찾기·지우기를
     **개체 기준**으로 한 곳에 모아 둔다. */
  const potIdOfKey = k => (isFreeSlotId(k) ? String(k).slice(FREE_PREFIX.length) : k);

  function plantOf(potId) {
    const k = freeSlotId(potId);
    if (plants.has(k)) return plants.get(k);
    for (const [, p] of plants) if (p.potId && p.potId === potId) return p;
    /* 옛 경로 — 호출부가 화분을 그 자리 이름(slotId)으로 부르던 시절과의 다리 */
    return plants.get(potId) || null;
  }
  function keyOfPlant(entry) {
    for (const [k, p] of plants) if (p === entry) return k;
    return null;
  }
  /* 그 화분을 **어느 열쇠로 놓여 있든** 전부 걷어낸다. 몇 개를 걷었는지 돌려준다. */
  function removePlantOf(potId) {
    const free = freeSlotId(potId);
    let n = 0;
    for (const [k, p] of [...plants]) {
      if (k !== free && k !== potId && p.potId !== potId) continue;
      removePlant(k); plantYaw.delete(k); clearPreviewFor(k); n++;
    }
    return n;
  }
  /* ★★ 열쇠 해석은 **여기 하나뿐이다** (2026-08-03 · 코어 창 지적).
     ------------------------------------------------------------
     같은 개체를 셋 중 아무 이름으로나 부를 수 있다.
       ① 추천 자리 slotId   'banjiha-desk:0'   (빈 자리일 수도, 화분이 있을 수도)
       ② 자유 좌표 열쇠     'free:pot_01'
       ③ 화분 id            'pot_01'
     screenPosOf·setPlantYaw·plantYaw·highlightSlots 가 각자 풀면 반드시 어긋난다 —
     실제로 어긋났다(자유 좌표 화분은 화면 위치가 null 이고 회전은 던졌다).
     그래서 푸는 곳을 하나로 모은다. 새 API 를 더할 때도 여기만 쓰면 된다.

     반환 { key, plant, slot, pos } · 못 찾으면 **null** (0 으로 메꾸지 않는다)
       key    이 개체의 정본 열쇠 — plants·plantYaw·rings 가 쓰는 그 이름
       plant  놓여 있는 화분(없으면 null)
       slot   추천 자리(자유 좌표면 null)
       pos    월드 좌표 {x,y,z} — 화분이 있으면 **화분 발밑**, 없으면 자리 점 */
  function resolveKey(x) {
    if (x == null) return null;
    const id = String(x);
    const of = (key, plant, slot) => ({
      key, plant: plant || null, slot: slot || null,
      pos: plant ? { x: plant.group.position.x, y: plant.group.position.y, z: plant.group.position.z }
                 : { x: slot.x, y: slot.y, z: slot.z }
    });
    /* ① 이미 놓인 화분의 열쇠 그대로 (슬롯 열쇠·free: 열쇠 둘 다) */
    if (plants.has(id)) return of(id, plants.get(id), slotById.get(id));
    /* ② 화분 id — free:{id} 이거나 potId 로 적어 둔 그루 */
    const p = plantOf(id);
    if (p) { const k = keyOfPlant(p); return of(k, p, slotById.get(k)); }
    /* ③ 빈 추천 자리 */
    const s = slotById.get(id);
    if (s) return of(id, null, s);
    /* ④ 'free:pot_01' 인데 그 화분이 없다 — 없는 것은 없다고 한다 */
    return null;
  }

  /* 그 추천 자리가 차 있나 — 슬롯 열쇠뿐 아니라 **그 점 위에 선 자유 좌표 화분**도 본다.
     안 보면 링이 "비었다"고 말하는 자리에 이미 화분이 서 있게 된다. */
  function slotOccupied(slotId) {
    if (plants.has(slotId)) return true;
    const s = slotById.get(slotId);
    if (!s) return false;
    for (const [, p] of plants) if (p.at && samePoint(p.at, s, 0.05)) return true;
    return false;
  }

  /* 자리 한도에 안 들어가면 줄인다. **줄였다는 사실은 반드시 남긴다.**
     그냥 두면 화분이 선반 밖으로 걸쳐진 채 게임이 돈다. */
  function fitPotToLimit(g, limit, label) {
    const d = rotationSafeDiameter(potPartOf(g), g);
    if (Number.isFinite(limit) && d > limit + 1e-4) {
      const k = limit / d;
      g.scale.multiplyScalar(k);
      console.warn(`[방뷰] ${label}: 화분 회전무관 지름 ${d.toFixed(3)} > 한도 ${limit} — ${(k * 100) | 0}% 로 줄였습니다`);
      return limit;
    }
    return d;
  }

  /* 그루에 '누구의 어느 자리인지'를 새긴다 — 탭 판정이 이걸로 되짚는다.
     ★ userData 를 **갈아 끼운다**(o.userData.x = ... 로 고치지 않는다).
       ------------------------------------------------------------
       생장 모듈이 조립한 그루는 **노드들이 userData 객체를 나눠 쓴다**(재서 확인했다 —
       두 그루를 놓고 각각을 세어 보면 41개·51개가 서로의 이름표를 달고 있었다).
       그래서 예전처럼 제자리에서 고치면 **다른 그루의 이름표까지 같이 바뀐다.**
       ownMaterials 가 재질에 대해 이미 같은 일을 하고 있다 — 이름표도 그루 것이어야 한다.
       (이걸 안 하면 화분을 탭했을 때 엉뚱한 자리가 잡히고, applyLook 의 baseColor 도 섞인다) */
  function tagPlant(g, key, potId) {
    const id = potId || null;
    g.traverse(o => { o.userData = { ...(o.userData || {}), plantSlotId: key, potId: id }; });
  }

  /* 다시 지을 필요가 있나.
     ------------------------------------------------------------
     예전 정책은 progress01 이 0.05 칸 바뀔 때만 다시 지었다. 이제 형태는 **유효 생장일**이
     정하므로 그 값이 바뀌면 다시 짓는다 — 하루가 가면 새순이 돋고 잎이 펴져야 하고,
     빨리감기의 볼거리가 바로 그것이다. 하루는 한 턴에 한 번뿐이라 비싸지 않다.

     대신 두 가지로 막는다.
       ① 같은 날이면 절대 안 짓는다 (밴드·시듦만 바뀌면 색만 얹는다)
       ② 슬라이더를 끄는 것처럼 연달아 들어오면 REBUILD_MIN_MS 안에는 안 짓는다.
          데모에서 progress 슬라이더를 끌면 하루가 초당 수십 번 바뀐다 — 그걸 다 지으면
          폰에서 그대로 프레임 드롭이다.
          ★ 60ms 다. 빨리감기 최고 배속이 하루 140ms 라 **한 턴도 안 빠진다**
            (조립은 재 보니 3~12ms). 이보다 크게 잡으면 빨리감기에서 하루가 통째로 씹힌다. */
  const REBUILD_MIN_MS = 60;
  function needsRebuild(prev, spec, days) {
    if (!prev) return true;
    if ((prev.spec.kind || 'monstera') !== (spec.kind || 'monstera')) return true;
    if ((prev.days ?? null) !== days) {
      if (performance.now() - (prev.builtAt || 0) < REBUILD_MIN_MS) return false;
      return true;
    }
    return false;
  }

  async function setPlant(slotId, spec) {
    const s = slotOrThrow(slotId);
    /* 치우면 각도도 같이 버린다 — 남겨 두면 나중에 그 자리에 놓은 **다른** 화분이
       옛 각도로 돌아간 채 나온다. "새로 놓으면 0 부터"가 계약이다. */
    if (!spec) { removePlant(slotId); plantYaw.delete(slotId); clearPreviewFor(slotId); return null; }

    const kind = spec.kind || 'monstera';
    /* 어느 그루를 지을지 판단하려면 유효 생장일이 먼저 필요하다. 몬스테라만 해당된다 —
       콩나물은 예전대로 progress01 을 쓴다(단계가 셋뿐이라 날짜가 없다). */
    const prev = plants.get(slotId);
    /* ★ 단조 하한은 '지금 서 있는 날'이 아니라 '마지막으로 요청받은 날'이다.
       위 ②로 조립을 건너뛴 요청도 시간은 갔다 — 그걸 안 세면 하한이 멈춰 서서
       다음 단계를 늘 한 바퀴 전으로 되짚는다. */
    const days = kind === 'monstera'
      ? growthDaysOf(spec, await assembler(), prev && (prev.wantDays ?? prev.days))
      : Math.round(clamp(spec.progress01 ?? 1, 0, 1) * 100);

    const cur = plants.get(slotId);
    if (cur && !needsRebuild(cur, spec, days)) {
      applyLook(cur.group, spec);
      cur.spec = { ...spec };
      cur.wantDays = days;
      needsRender = true;
      return cur.group;
    }

    let g;
    try {
      g = await buildPlantGroup(spec, slotPotLimit(s), days);
    } catch (e) {
      throw fail(new Error(`화분을 못 만들었습니다 (${slotId}): ${e.message}`));
    }
    if (disposed) { disposeObject(g); return null; }
    ownMaterials(g);

    /* ★ 자리에 들어가나 — 회전 무관 지름으로만 본다 */
    const limit = slotPotLimit(s);
    const d = fitPotToLimit(g, limit, slotId);

    const hadPlant = plants.has(slotId);
    removePlant(slotId);
    /* ★ 같은 화분이 다른 열쇠(자유 좌표)로도 놓여 있으면 그것도 걷는다.
       안 걷으면 좌표 배치 ↔ 자리 배치를 오갈 때 화분이 복사된 것처럼 보인다. */
    if (spec.potId) for (const [k, p] of [...plants])
      if (k !== slotId && p.potId === spec.potId) { removePlant(k); plantYaw.delete(k); }
    g.position.set(s.x, s.y, s.z);
    /* ★ 돌려 놓은 각도는 형태가 바뀌어도 유지한다. 새로 놓는 것이면 0 부터.
       (Y 회전만 쓴다 — 눕히거나 기울이면 화분이 넘어진다) */
    if (!hadPlant && !plantYaw.has(slotId)) plantYaw.set(slotId, 0);
    g.rotation.y = plantYaw.get(slotId) || 0;
    tagPlant(g, slotId, spec.potId || null);
    applyLook(g, spec);
    houseGroup.add(g);
    plants.set(slotId, { group: g, spec: { ...spec }, potD: Math.min(d, limit),
                         potId: spec.potId || null, at: atOfSlot(s, g.rotation.y),
                         days, wantDays: days, builtAt: performance.now() });
    if (preview && (preview.fromId === slotId || preview.toId === slotId)) refreshPreview();
    /* 새 화분이 놓이면 그 앞을 막고 선 사람이 생길 수 있다 — 그때 비켜선다 */
    nudgeIfOccluding();
    needsRender = true;
    return g;
  }

  /* 추천 자리를 place.js 의 자리(at)로 옮긴다. 좌표가 이상하면 던지지 않고 null 을 준다 —
     자리 자체는 house.js 가 낸 것이라 여기서 부팅을 멈출 이유가 없다. */
  function atOfSlot(s, rotY) {
    try { return atFromSlot(s, { rotY: rotY || 0 }); }
    catch (e) { return null; }
  }

  /* ============================================================
     ③-b ★ 자유 좌표 배치 — setPlantAt (2026-08-03)
     ------------------------------------------------------------
     setPlant(slotId, ...) 는 그대로 남는다. 추천 자리 위 화분은 예전 길을 탄다.
     이쪽은 **자리 번호가 없는 곳**(방바닥 한가운데·선반 끄트머리·침대 위)에 놓는다.

       potId  그 화분의 안정된 이름. 열쇠는 place.freeSlotId(potId) = `free:{potId}` 다
       at     { x, y, z, rotY?, onUid?, occIdx? } — place.js 가 정본으로 정한 모양
       spec   setPlant 과 같은 그림 명세. 여기에만 있는 것 두 가지
                potD      이 화분이 차지할 지름 상한[m]. 넘으면 줄이고 경고를 남긴다
                plantId   kind 의 다른 이름(계약 쪽 용어). kind 가 있으면 kind 가 이긴다

     ★★ 옛 자리는 **반드시** 지운다.
        같은 화분이 어느 열쇠로 놓여 있든 전부 걷어내고 새로 세운다(removePlantOf).
        예전에 이걸 안 해서 옮길 때마다 화분이 늘어났다 — 테스트로 못 박아 뒀다
        (tools/test_roomview_place.mjs "옮기면 옛 자리에 아무것도 안 남는다").
  ============================================================ */
  async function setPlantAt(potId, at, spec) {
    const id = String(potId ?? '');
    if (!id) throw fail(new TypeError('[방뷰] setPlantAt: 화분 id(문자열)가 필요합니다'));
    if (!at || !spec) { removePlantOf(id); return null; }
    if (!built) throw fail(new Error('[방뷰] 방이 아직 없습니다'));

    /* 좌표 검증은 place.js 한 벌만 쓴다 — NaN·방 밖을 조용히 0 으로 메꾸지 않는다 */
    let A;
    try { A = makeAt(at, { size: built.size }); }
    catch (e) { throw fail(new Error(`화분을 그 자리에 못 놓습니다 (${id}): ${e.message}`)); }
    /* ★ 각도는 **명시했을 때만** 갈아 끼운다.
       makeAt 은 rotY 가 없으면 0 으로 채운다(그게 자리 객체의 정본 모양이다).
       그 0 을 그대로 쓰면 좌표만 옮길 때마다 플레이어가 돌려 놓은 각도가 되돌아간다 —
       끄는 동안 매 프레임 부르는 함수라 화분이 계속 제자리로 홱 돌아간다. */
    const gaveRot = at.rotY != null;

    const key = freeSlotId(id);
    const kind = spec.kind || spec.plantId || 'monstera';
    const limit = Number.isFinite(spec.potD) ? spec.potD : Infinity;
    const prev = plantOf(id);
    const days = kind === 'monstera'
      ? growthDaysOf(spec, await assembler(), prev && (prev.wantDays ?? prev.days))
      : Math.round(clamp(spec.progress01 ?? 1, 0, 1) * 100);

    /* ★ 끄는 동안 같은 그루를 매 프레임 다시 조립하지 않는다. 같은 날이면 **옮기기만** 한다.
       (몬스테라 조립은 3~12ms 다. 손가락 이벤트마다 돌면 폰이 그 자리에서 멈춘다) */
    if (prev && !needsRebuild(prev, { ...spec, kind }, days)) {
      const old = keyOfPlant(prev);
      applyLook(prev.group, { ...spec, kind });
      prev.spec = { ...spec, kind };
      prev.wantDays = days;
      prev.potId = id;
      prev.group.position.set(A.x, A.y, A.z);
      if (gaveRot) prev.group.rotation.y = A.rotY;
      A.rotY = prev.group.rotation.y || 0;
      prev.at = A;
      if (old !== key) {
        plants.delete(old);
        plantYaw.delete(old);
        plants.set(key, prev);
        tagPlant(prev.group, key, id);
      }
      plantYaw.set(key, A.rotY);
      moveHighlightRing(key, A);
      needsRender = true;
      return prev.group;
    }

    let g;
    try { g = await buildPlantGroup({ ...spec, kind }, limit, days); }
    catch (e) { throw fail(new Error(`화분을 못 만들었습니다 (${id}): ${e.message}`)); }
    if (disposed) { disposeObject(g); return null; }
    ownMaterials(g);
    const d = fitPotToLimit(g, limit, id);

    /* 돌려 놓은 각도는 그루가 다시 지어져도 유지한다. at.rotY 를 **준 경우에만** 그게 이긴다. */
    const yaw = gaveRot ? A.rotY
              : plantYaw.has(key) ? plantYaw.get(key)
              : prev ? (prev.group.rotation.y || 0) : 0;
    removePlantOf(id);                      // ★ 옛 자리는 반드시 지운다
    g.position.set(A.x, A.y, A.z);
    g.rotation.y = yaw;
    A.rotY = yaw;
    plantYaw.set(key, yaw);
    tagPlant(g, key, id);
    applyLook(g, { ...spec, kind });
    houseGroup.add(g);
    plants.set(key, { group: g, spec: { ...spec, kind }, potId: id, at: A,
                      potD: Math.min(d, limit === Infinity ? d : limit),
                      days, wantDays: days, builtAt: performance.now() });
    moveHighlightRing(key, A);
    nudgeIfOccluding();
    needsRender = true;
    return g;
  }

  /* 옮기기 — 실패하면 던진다. 조용히 안 옮기면 플레이어는 옮긴 줄 안다. */
  function movePlant(fromId, toId) {
    const a = slotOrThrow(fromId), b = slotOrThrow(toId);
    const p = plants.get(fromId);
    if (!p) throw new Error(`옮길 화분이 없습니다: ${fromId}`);
    if (fromId === toId) return;
    if (plants.has(toId)) throw new Error(`이미 화분이 있는 자리입니다: ${toId}`);

    const limit = slotPotLimit(b);
    const d = rotationSafeDiameter(potPartOf(p.group), p.group);
    if (Number.isFinite(limit) && d > limit + 1e-4)
      throw new Error(`화분이 안 들어갑니다: ${toId} 한도 ${limit}m, 화분 회전무관 지름 ${d.toFixed(3)}m`);

    plants.delete(fromId);
    plants.set(toId, p);
    /* 각도도 화분을 따라간다. 안 그러면 옮기자마자 방향이 튄다. */
    const yaw = plantYaw.get(fromId) || 0;
    plantYaw.delete(fromId); plantYaw.set(toId, yaw);
    clearPreviewFor(fromId);
    tagPlant(p.group, toId, p.potId);
    p.at = atOfSlot(b, yaw);

    /* 살짝 들었다 놓는다 — 순간이동하면 어디로 갔는지 눈이 못 쫓는다 */
    const from = new THREE.Vector3(a.x, a.y, a.z), to = new THREE.Vector3(b.x, b.y, b.z);
    const lift = Math.max(0.12, from.distanceTo(to) * 0.18);
    const t0 = performance.now(), dur = 380;
    const anim = () => {
      if (disposed || plants.get(toId) !== p) return;
      const t = clamp((performance.now() - t0) / dur, 0, 1), k = ease(t);
      p.group.position.lerpVectors(from, to, k);
      p.group.position.y += Math.sin(k * Math.PI) * lift;
      needsRender = true;
      if (t < 1) requestAnimationFrame(anim);
    };
    anim();
    if (highlighted.size) highlightSlots([...highlighted]);   // 링 상태(빈 자리) 갱신
  }

  /* ============================================================
     ④ 놓을 수 있는 자리 표시
  ============================================================ */
  function ringMaterial() {
    return new THREE.MeshBasicMaterial({ color: 0xffd479, transparent: true, opacity: 0.6,
                                         side: THREE.DoubleSide, depthWrite: false, toneMapped: false });
  }

  function clearRings() {
    for (const [, m] of rings) { houseGroup.remove(m); disposeObject(m); }
    rings.clear();
    highlighted.clear();
    needsRender = true;
  }

  /* ★ 추천 자리뿐 아니라 **자유 좌표 화분**도 빛낼 수 있다 (2026-08-03).
     열쇠 해석은 resolveKey 한 곳만 쓴다 — 슬롯 id · `free:` 열쇠 · 화분 id 다 받는다.
     (탭해서 고른 자유 배치 화분을 표시할 길이 없으면 "무엇을 고른 건지"가 안 보인다) */
  function highlightSlots(slotIds) {
    const want = new Map();                 // 정본 열쇠 → { pos, r }
    for (const raw of (slotIds || [])) {
      const t = resolveKey(raw);
      if (!t) continue;                     // 없는 열쇠는 예전처럼 조용히 뺀다
      const r = t.slot
        ? clamp((Number.isFinite(t.slot.maxPotD) ? t.slot.maxPotD : 0.22) * 0.55, 0.05, 0.30)
        : clamp(((t.plant && t.plant.potD) || 0.22) * 0.75, 0.05, 0.30);
      want.set(t.key, { pos: t.pos, r });
    }
    for (const [id, m] of [...rings]) {
      if (want.has(id)) continue;
      houseGroup.remove(m); disposeObject(m); rings.delete(id);
    }
    for (const [id, w] of want) {
      if (rings.has(id)) { rings.get(id).position.set(w.pos.x, w.pos.y + 0.004, w.pos.z); continue; }
      const m = new THREE.Mesh(new THREE.RingGeometry(w.r * 0.72, w.r, 24), ringMaterial());
      m.rotation.x = -Math.PI / 2;
      m.position.set(w.pos.x, w.pos.y + 0.004, w.pos.z);
      m.renderOrder = 5;
      m.userData.highlightSlotId = id;
      houseGroup.add(m);
      rings.set(id, m);
    }
    for (const [id, m] of rings) {
      /* 슬롯이면 '찼나', 자유 좌표 열쇠면 그 자체가 화분이다 */
      const occ = slotById.has(id) ? slotOccupied(id) : true;
      m.userData.occupied = occ;
      m.material.color.setHex(occ ? 0x9fd0ff : 0xffd479);   // 찬 자리는 파랗게
    }
    highlighted = new Set(want.keys());
    needsRender = true;
  }

  /* 빛내 둔 화분이 움직이면 링도 따라간다. 링을 새로 만들지 않는다(끄는 동안 부른다). */
  function moveHighlightRing(key, at) {
    const m = rings.get(key);
    if (m) { m.position.set(at.x, at.y + 0.004, at.z); needsRender = true; }
  }

  function pulseRings(now) {
    if (!rings.size) return false;
    const k = 0.42 + 0.32 * (0.5 + 0.5 * Math.sin(now / 320));
    for (const [, m] of rings) { m.material.opacity = k; m.scale.setScalar(1 + (k - 0.5) * 0.12); }
    return true;
  }

  /* ============================================================
     ④-b ★ 추천 자리 원형 가이드 — showSlotRings (2026-08-03)
     ------------------------------------------------------------
     박사님 지시: "배치는 어디든 될 수 있도록 하되 추천지점을 지금처럼 선반 위나
     그런 데 원형으로 가이딩 표시".
     ★ 원은 **안내지 제약이 아니다.** 원 밖에도 놓을 수 있다 — 그 판단은 surfaceAt 이
       하고, 여기 링은 "여기가 좋다"는 말만 한다.

     성능 — 링은 방을 지을 때 한 벌만 만들고 그 뒤로는 **보이기만 껐다 켠다.**
     매 프레임 만들면 끄는 동안 그대로 프레임 값이 된다(끄는 중이 제일 바쁜 구간이다).
     재질은 세 벌(들어감·못들어감·커서근처)만 나눠 쓰고, 링마다 만들지 않는다.
     맥박(pulseRings)도 안 걸었다 — 그건 매 프레임 렌더를 깨우기 때문이다.
  ============================================================ */
  const RING_FIT = 0xffd479;    // 이 화분이 올라가는 자리
  const RING_NG  = 0x6b5a3e;    // 못 올라가는 자리(어둡게) — 지우지 않는다. 자리 자체는 있으니까
  const RING_NEAR = 0xfff1c8;   // 커서에 제일 가까운 자리 — 굵고 밝게

  function clearGuideRings() {
    if (guideGroup) houseGroup.remove(guideGroup);
    /* 기하·재질은 **나눠 쓰는 것**이라 링 하나씩 버리면 안 된다. 아래에서 한 번만 버린다. */
    guideRings.clear();
    if (guideGeo) { guideGeo.thin.dispose(); guideGeo.thick.dispose(); }
    if (guideMat) for (const k in guideMat) guideMat[k].dispose();
    guideGroup = null; guideGeo = null; guideMat = null; guideNear = null;
    needsRender = true;
  }

  function buildGuideRings() {
    clearGuideRings();
    guideGroup = new THREE.Group();
    guideGroup.visible = false;
    houseGroup.add(guideGroup);
    /* 반지름 1 짜리 링 두 벌만 만들고 자리마다 scale 로 키운다 */
    guideGeo = { thin: new THREE.RingGeometry(0.74, 1, 26), thick: new THREE.RingGeometry(0.50, 1, 26) };
    const mk = (color, opacity, depthTest) => new THREE.MeshBasicMaterial({
      color, transparent: true, opacity, side: THREE.DoubleSide,
      depthWrite: false, depthTest, toneMapped: false });
    guideMat = {
      /* 보통 링은 깊이 검사를 켠다 — 선반에 가려야 "그 선반 위 자리"로 읽힌다.
         커서 근처 링만 깊이 검사를 끈다. 그건 지금 겨냥하는 자리라 늘 보여야 한다. */
      fit: mk(RING_FIT, 0.55, true),
      ng: mk(RING_NG, 0.34, true),
      near: mk(RING_NEAR, 0.95, false)
    };
    for (const s of slotById.values()) {
      const m = new THREE.Mesh(guideGeo.thin, guideMat.fit);
      m.rotation.x = -Math.PI / 2;
      m.position.set(s.x, s.y + 0.006, s.z);   // 상판에서 살짝 띄운다(z-파이팅 방지)
      m.renderOrder = 4;
      m.userData.guideSlotId = s.slotId;
      guideGroup.add(m);
      guideRings.set(s.slotId, m);
    }
    return guideRings.size;
  }

  const guideRadius = s => clamp((Number.isFinite(s.maxPotD) ? s.maxPotD : 0.22) * 0.62, 0.05, 0.32);

  /* on=false 면 감춘다(지우지 않는다).
       opt.potD     이 화분 지름. 못 올라가는 자리는 어둡게 칠한다
       opt.plantId  potD 를 안 줄 때 쓰는 종류 이름('beansprout' 이면 시루 지름)
       opt.near     { x, z } 커서 위치. 제일 가까운 자리를 굵고 밝게
       opt.nearMax  이 거리를 넘으면 아무것도 굵게 하지 않는다[m]
     돌려주는 값은 '올라갈 수 있는 자리 수' 다. */
  function showSlotRings(on, opt = {}) {
    if (!built) return 0;
    if (!on) {
      if (guideGroup) guideGroup.visible = false;
      guideNear = null; needsRender = true;
      return 0;
    }
    if (!guideRings.size) buildGuideRings();
    const potD = Number.isFinite(opt.potD) ? opt.potD
               : (opt.plantId === 'beansprout' ? SIRU_D : MONSTERA_POT_D);
    let nearId = null, nearD = Infinity;
    if (opt.near && Number.isFinite(opt.near.x) && Number.isFinite(opt.near.z)) {
      for (const id of guideRings.keys()) {
        const s = slotById.get(id);
        if (!s || !potFits(potD, { slot: s }).ok) continue;   // 못 올라가는 자리는 겨냥 대상이 아니다
        const d = distanceXZ(opt.near, s);
        if (d < nearD) { nearD = d; nearId = id; }
      }
      if (Number.isFinite(opt.nearMax) && nearD > opt.nearMax) nearId = null;
    }
    guideNear = nearId;
    let fits = 0;
    for (const [id, m] of guideRings) {
      const s = slotById.get(id);
      /* ★ surfaceAt 과 **같은 함수**를 부른다. 여기서 따로 판정하면 또 어긋난다 —
         실제로 어긋나서 링은 14칸 다 "된다"인데 surfaceAt 은 13칸을 거절했다. */
      const holds = potFits(potD, { slot: s }).ok;
      if (holds) fits++;
      const isNear = id === nearId;
      m.material = isNear ? guideMat.near : (holds ? guideMat.fit : guideMat.ng);
      m.geometry = isNear ? guideGeo.thick : guideGeo.thin;
      const r = guideRadius(s);
      m.scale.setScalar(isNear ? r * 1.18 : r);
      m.renderOrder = isNear ? 6 : 4;
    }
    guideGroup.visible = true;
    needsRender = true;
    return fits;
  }

  /* 검증·진단용 — 지금 링이 어떤 상태인가 */
  function slotRingState() {
    return [...guideRings].map(([id, m]) => ({
      slotId: id, near: id === guideNear,
      fits: m.material === guideMat.fit || m.material === guideMat.near,
      color: '#' + m.material.color.getHexString(),
      visible: !!(guideGroup && guideGroup.visible)
    }));
  }

  /* ============================================================
     ⑤ 탭 — 플레이어가 화분을 만지는 유일한 통로
  ============================================================ */
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const tmp = new THREE.Vector3();

  function ndcOf(cx, cy) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    return ndc;
  }

  /* 월드 한 점이 화면 어디에 찍히나 — **캔버스 기준** CSS 픽셀. 카메라 뒤면 null.
     (이름은 슬롯 시절 그대로지만 {x,y,z} 면 무엇이든 받는다 — 자유 좌표 화분도 이걸 쓴다) */
  function slotScreenPos(s) {
    const r = canvas.getBoundingClientRect();
    tmp.set(s.x, s.y, s.z).project(ctx.cam);
    if (tmp.z > 1) return null;
    return { x: (tmp.x * 0.5 + 0.5) * r.width, y: (-tmp.y * 0.5 + 0.5) * r.height };
  }

  /* 화분은 덩치가 있으니 광선으로 정확히 잡는다 */
  function pickPlantRay(cx, cy) {
    if (!plants.size) return null;
    ray.setFromCamera(ndcOf(cx, cy), ctx.cam);
    const hits = ray.intersectObjects([...plants.values()].map(p => p.group), true);
    if (!hits.length) return null;
    let o = hits[0].object;
    while (o && !o.userData.plantSlotId) o = o.parent;
    return o ? { type: 'plant', slotId: o.userData.plantSlotId } : null;
  }

  /* 빈 슬롯은 점이라 광선으로는 손가락에 안 잡힌다 — 화면 거리로 가장 가까운 것.
     하이라이트 중이면 그 자리들만 본다(놓기 모드에서 엉뚱한 자리가 잡히지 않게). */
  function pickSlotFuzzy(cx, cy) {
    const r = canvas.getBoundingClientRect();
    const px = cx - r.left, py = cy - r.top;
    const pool = highlighted.size ? [...highlighted] : [...slotById.keys()];
    let best = null, bestD = SLOT_HIT_PX;
    for (const id of pool) {
      /* ★ 빛낸 것 중에 자유 좌표 화분이 섞여 있을 수 있다 — 그것도 짚을 수 있어야 한다.
         (예전에는 slotById 만 봐서 조용히 빠졌다) */
      const t = resolveKey(id); if (!t) continue;
      const p = slotScreenPos(t.pos); if (!p) continue;
      const d = Math.hypot(p.x - px, p.y - py);
      if (d < bestD) { bestD = d; best = t.key; }
    }
    return best ? { type: plants.has(best) ? 'plant' : 'slot', slotId: best } : null;
  }

  function pickAt(cx, cy) {
    return pickPlantRay(cx, cy) || pickSlotFuzzy(cx, cy);
  }

  /* ============================================================
     ⑤-b ★ 표면 레이캐스트 — surfaceAt (2026-08-03)
     ------------------------------------------------------------
     화면 좌표를 쏘아 **놓을 수 있는 면**을 찾는다. 자유 배치의 유일한 입구다.

     규칙
       ① 대상은 **위를 향한 면 전부** — 바닥·러그·선반 단·책상 상판·창턱·침대 위.
          벽·천장은 거절한다(면 법선의 y 성분으로 가른다. 목록으로 관리하면 새 가구가
          생길 때마다 빠진다 — house.js 가 그림자에서 똑같은 실수를 두 번 했다).
       ② 판정은 **눈에 보이는 첫 면**으로 한다. 컷어웨이로 내려간 벽(visible=false)과
          유리는 없는 셈 치고 지나간다 — 화면에서 안 보이는 것에 막히면 안 된다.
       ③ 바닥 높이(8cm 아래)는 무조건 '바닥'으로 본다. 러그 위를 찍어도 바닥이다 —
          러그 판때기 크기로 자리를 재면 러그 가장자리에 화분을 못 놓는다.
       ④ 겹침은 소리 내어 거절한다(ok:false + 한국어 이유). 조용히 두면 화분이
          가구 속에 박힌 채 게임이 돈다.
       ⑤ nearest 는 place.nearestSlot() 결과다. **붙일지 말지는 호출부가 정한다** —
          여기서 붙여 버리면 "원 밖에는 못 놓는다"가 되어 지시와 어긋난다.

     반환 { x, y, z, onUid, occIdx, surfaceTop, maxPotD, ok, reason, nearest }
  ============================================================ */
  const SURF_UP_MIN = 0.6;      // 면 법선의 y. 이보다 누우면 '위를 향한 면'이 아니다
  const FLOOR_Y = 0.08;         // 이 아래는 무조건 바닥으로 본다(러그 포함)
  const _nmat = new THREE.Matrix3();
  const _nrm = new THREE.Vector3();
  const _wp = new THREE.Vector3(), _wq = new THREE.Quaternion(), _ws = new THREE.Vector3();
  const _weu = new THREE.Euler();

  function hiddenInScene(obj) {
    for (let p = obj; p; p = p.parent) if (p.visible === false) return true;
    return false;
  }
  function faceUpY(hit) {
    if (!hit.face) return 0;
    _nmat.getNormalMatrix(hit.object.matrixWorld);
    _nrm.copy(hit.face.normal).applyMatrix3(_nmat).normalize();
    return _nrm.y;
  }
  /* 그 메시가 만드는 **상판 사각형**. 월드 AABB 로 재면 돌려 놓은 책상이 실제보다
     커져서 모서리 밖에도 놓을 수 있게 된다 — 로컬 bbox + Y회전으로 정확히 잰다.
     좌표 규약은 house.js 의 슬롯 변환과 같다: X = x0 + u·cos + v·sin, Z = z0 − u·sin + v·cos */
  function meshRect(obj) {
    if (!obj.geometry) return null;
    if (!obj.geometry.boundingBox) obj.geometry.computeBoundingBox();
    const bb = obj.geometry.boundingBox;
    obj.updateWorldMatrix(true, false);
    obj.matrixWorld.decompose(_wp, _wq, _ws);
    _weu.setFromQuaternion(_wq, 'YXZ');
    const rot = _weu.y;
    const c = Math.cos(rot), s = Math.sin(rot);
    const cu = (bb.max.x + bb.min.x) / 2 * _ws.x, cv = (bb.max.z + bb.min.z) / 2 * _ws.z;
    return {
      x: _wp.x + cu * c + cv * s,
      z: _wp.z - cu * s + cv * c,
      w: (bb.max.x - bb.min.x) * Math.abs(_ws.x),
      d: (bb.max.z - bb.min.z) * Math.abs(_ws.z),
      rot
    };
  }
  /* 사각형 안으로 몇 m 여유가 남나. 음수면 그만큼 삐져나온다. */
  function rectMargin(x, z, r, potD) {
    const c = Math.cos(r.rot), s = Math.sin(r.rot);
    const dx = x - r.x, dz = z - r.z;
    const u = dx * c - dz * s, v = dx * s + dz * c;
    return Math.min(r.w / 2 - Math.abs(u), r.d / 2 - Math.abs(v)) - potD / 2;
  }
  /* uid 로 가구 그룹을 찾는다 — 붙박이·벽걸이까지 전부(furnNodes 와 달리 안 거른다) */
  function furnByUid(uid) {
    if (!built || !built.furniture) return null;
    return built.furniture.children.find(g => g.userData && g.userData.uid === uid) || null;
  }

  /* 맞은 메시에서 부모로 거슬러 올라가 가구를 찾는다. 바닥이면 null. */
  function ownerOf(obj) {
    for (let p = obj; p; p = p.parent) {
      if (p === built.room) return null;
      if (p.userData && p.userData.uid) return p;
    }
    return null;
  }

  /* ★★ 화분이 그 자리에 서나 — **링의 fits 와 surfaceAt 이 같은 이 함수 하나를 부른다.**
     ------------------------------------------------------------
     두 곳이 각자 판정하던 것이 실제로 어긋났다(2026-08-03 코어 창 지적 · 재서 확인).
       링   showSlotRings 는 slotHolds(자리 한도)만 봤다 → 반지하 14칸 전부 "올라간다"
       면   surfaceAt 은 판때기 발자국을 다시 쟀다   → 같은 점에서 13칸이 "0.01m 모자란다"
     어느 쪽이 맞나 — **자리 한도가 정본이다.** 슬롯은 house.js 가 "여기 놓으라"고 낸
     점이고, 격자로 놓이다 보니 화분이 판때기 가장자리에 1cm쯤 걸치는 게 정상이다
     (실제 선반도 그렇다). 거기서 거절하면 슬롯 정본이 거짓말을 하게 된다.

     그래서 규칙은 둘이 아니라 하나다:
       · 추천 자리 위        → 그 자리의 maxPotD 계약이 정한다 (발자국은 다시 안 잰다)
       · 자리 번호가 없는 곳 → 발자국으로 잰다. 다만 **가장자리에 걸치는 것까지 막지 않는다** —
                              반지름의 절반(OVERHANG)까지는 면 밖으로 나가도 된다
     반환 { ok, reason, margin } */
  const OVERHANG = 0.5;
  function potFits(potD, { slot, rect, point } = {}) {
    if (slot) {
      if (!slotHolds(slot, potD))
        return { ok: false, margin: null,
                 reason: `이 자리는 지름 ${slot.maxPotD}m 까지만 올라갑니다 (이 화분 ${potD.toFixed(2)}m)` };
      return { ok: true, reason: null, margin: null };
    }
    if (rect && point) {
      const m = rectMargin(point.x, point.z, rect, potD);
      if (m < -potD * OVERHANG / 2)
        return { ok: false, margin: +m.toFixed(4), reason: `면 밖으로 ${(-m).toFixed(2)}m 삐져나옵니다` };
      return { ok: true, reason: null, margin: +m.toFixed(4) };
    }
    return { ok: true, reason: null, margin: null };
  }

  /* 이 점을 **지배하는** 추천 자리 — 사실상 그 자리 한가운데를 찍은 경우다.
     ★ 이게 불변식을 지킨다: 추천 자리 정중앙은 무엇에 가려 있든 반드시 통과한다.
       (창턱 받침은 창틀과 같은 높이에 겹쳐 있어서 레이캐스트가 창틀을 먼저 맞는다 —
        그때 "구조물 위"로 거절하면 반지하에서 제일 밝은 자리가 통째로 막힌다) */
  const SLOT_GOVERN_R = 0.04;   // 자리 중심에서 이 안이면 그 자리로 본다[m]
  function governingSlot(p) {
    let best = null, bestD = SLOT_GOVERN_R;
    for (const s of slotById.values()) {
      if (Math.abs(s.y - p.y) > 0.06) continue;
      const d = Math.hypot(s.x - p.x, s.z - p.z);
      if (d <= bestD) { bestD = d; best = s; }
    }
    return best;
  }

  /* 놓을 수 있는 면을 가진 가구인가. 매달린 조명·벽걸이 장식은 면이 아니다.
     ★ 다만 **화분 자리를 내는 벽걸이 선반**(창턱 받침 shelf_sill_pot1)은 면이다 —
       mount 만 보고 자르면 반지하 튜토리얼 자리가 사라진다. slots 유무로 가른다. */
  function surfaceKindOf(own) {
    const u = own.userData || {};
    if (u.hangFromCeiling) return '매달린 조명 위에는 못 놓습니다';
    if (u.mount && !(u.slots && u.slots.length)) return '벽걸이·붙박이 위에는 못 놓습니다';
    return null;
  }

  function surfaceAt(px, py, opt = {}) {
    const potD = Number.isFinite(opt.potD) ? opt.potD : MONSTERA_POT_D;
    const out = { x: null, y: null, z: null, onUid: null, occIdx: null,
                  surfaceTop: null, maxPotD: null, ok: false, reason: null, nearest: null };
    if (!built || !built.room) { out.reason = '방이 아직 없습니다'; return out; }

    ray.setFromCamera(ndcOf(px, py), ctx.cam);
    const hits = ray.intersectObject(built.room, true);
    const usable = h => h.face && h.object.isMesh && !hiddenInScene(h.object) && (() => {
      const m = Array.isArray(h.object.material) ? h.object.material[0] : h.object.material;
      return !(m && (m.colorWrite === false || (m.transparent && m.opacity < 0.95)));  // 유리·그림자전용
    })();
    const list = [];
    for (let i = 0; i < hits.length && list.length < 12; i++) if (usable(hits[i])) list.push(hits[i]);

    /* ★ 눈에 보이는 첫 '위를 향한 면'을 쓴다. 다만 **바로 뒤(BEHIND_MAX)** 까지는 더 본다.
       왜 — 선반 앞면·창틀처럼 **얇은 것**이 자리 바로 앞에 서 있는 경우가 많다. 그걸
       그대로 '벽'으로 읽으면 그 선반 한 칸이 통째로 못 쓰는 자리가 된다(재서 확인했다:
       원룸 shelf#5 6칸·투룸 shelf_low#6 4칸이 전부 그렇게 막혀 있었다).
       벽 하나를 통째로 뚫고 들어가지는 않는다 — 40cm 까지만 본다. */
    const BEHIND_MAX = 0.4;
    let hit = null, hitIdx = -1, blockedBy = null, firstD = null, back = null, backIdx = -1;
    for (let i = 0; i < list.length; i++) {
      const h = list[i];
      const ceil = built.shells && isDescendant(h.object, built.shells.ceiling);
      const up = !ceil && faceUpY(h) > SURF_UP_MIN;
      if (firstD == null) { firstD = h.distance; if (!up) blockedBy = ceil ? '천장' : '벽'; }
      if (!up) continue;
      if (h.distance - firstD > BEHIND_MAX) break;
      /* 놓을 수 있는 면인가 — 가구 위 · 바닥 · 추천 자리 셋 중 하나.
         (싼 것부터 본다. governingSlot 은 자리 수만큼 도는데 학원교실은 128칸이다) */
      if (ownerOf(h.object) || h.point.y < FLOOR_Y || governingSlot(h.point)) {
        hit = h; hitIdx = i; blockedBy = null; break;
      }
      if (!back) { back = h; backIdx = i; }      // 구조물 — 아무것도 못 찾으면 이유를 여기서 낸다
    }
    if (!hit && back) { hit = back; hitIdx = backIdx; blockedBy = null; }
    if (!hit) {
      out.reason = blockedBy === '천장' ? '천장에는 못 놓습니다'
                 : blockedBy === '벽' ? '벽에는 못 놓습니다 — 위를 향한 면이 아닙니다'
                 : '놓을 수 있는 면이 없습니다';
      return out;
    }

    const p = hit.point;
    const b = roomBox();
    /* ★ 같은 높이에 구조물과 가구가 겹쳐 있으면 **가구 쪽을 본다.**
       창턱 받침(shelf_sill_pot1)은 창틀 안에 끼워져 있어 창틀 상단을 먼저 맞는다 —
       그걸 '구조물'로 읽으면 반지하에서 제일 밝은 자리가 통째로 막힌다(재서 확인했다). */
    let own = ownerOf(hit.object), ownHit = hit;
    if (!own) {
      for (let i = hitIdx + 1, seen = 0; i < hits.length && seen < 4; i++) {
        const h = hits[i];
        if (!usable(h)) continue;
        seen++;
        if (Math.abs(h.point.y - p.y) > 0.02) continue;
        const o = ownerOf(h.object);
        if (o) { own = o; ownHit = h; break; }
      }
    }
    /* 이 점을 지배하는 추천 자리 — 있으면 그 자리 계약이 정본이다 */
    const gov = governingSlot(p);
    if (gov && !own) {
      /* 자리는 있는데 메시로는 못 찾았다(창틀에 가린 경우). slotId 가 곧 그 가구다. */
      const cut = String(gov.slotId).lastIndexOf(':');
      own = cut > 0 ? furnByUid(String(gov.slotId).slice(0, cut)) : null;
    }

    out.x = +p.x.toFixed(4); out.y = +p.y.toFixed(4); out.z = +p.z.toFixed(4);
    out.surfaceTop = out.y;
    /* 러그처럼 **바닥에 깔린 납작한 것** 위는 그냥 바닥이다 — 러그 판때기 크기로 자리를
       재면 러그 가장자리에 화분을 못 놓는다.
       ⚠ '납작하다'만 보면 안 된다. 벽걸이 선반(창턱 받침)도 판때기라 납작한데 그건 바닥이
         아니다. 그리고 '높다'만 봐도 안 된다 — 선반 맨 아랫단은 y 0.03 이라 바닥으로
         오인된다(실제로 둘 다 겪었다). 그래서 **납작하고 또 바닥 높이일 때**만 바닥이다. */
    const flat = !!(own && own.userData.size && own.userData.size.h <= 0.06 && p.y < FLOOR_Y);
    const isFloor = !own || flat;
    out.onUid = (own && !flat) ? (own.userData.uid || null) : null;
    /* occIdx 는 자가차폐 제외 번호다. 그 가구가 차폐체가 아니면 null 이 정답이다 —
       지어내면 남의 그림자를 지운다(place.validateAt 이 그래서 바닥+occIdx 를 막는다). */
    out.occIdx = out.onUid && Number.isInteger(own.userData.occIdx) ? own.userData.occIdx : null;
    if (gov) {
      out.maxPotD = Number.isFinite(gov.maxPotD) ? gov.maxPotD : null;
      if (Number.isInteger(gov.occIdx) && out.onUid) out.occIdx = gov.occIdx;
    } else if (out.onUid && own.userData.tier_max_pot_d && own.userData.tier_max_pot_d.length) {
      out.maxPotD = Math.max(...own.userData.tier_max_pot_d);
    }

    /* 추천 자리는 늘 같이 낸다 — 붙일지 말지는 호출부 몫이다 */
    const near = nearestSlot({ x: out.x, y: out.y, z: out.z }, [...slotById.values()],
                             { maxDist: opt.maxDist, potD });
    if (near) out.nearest = { slotId: near.slot.slotId, dist: +near.dist.toFixed(4),
                              distXZ: +near.distXZ.toFixed(4),
                              pos: { x: near.slot.x, y: near.slot.y, z: near.slot.z },
                              maxPotD: Number.isFinite(near.slot.maxPotD) ? near.slot.maxPotD : null };

    /* ── 여기 놓을 수 있나 ── */
    if (own && !gov) {
      /* 매달린 조명·벽걸이 장식은 면이 아니다. 추천 자리가 지배하면 그건 이미 면이다. */
      const bad = surfaceKindOf(own);
      if (bad) { out.reason = bad; return out; }
    }
    /* 바닥도 가구도 아닌 위쪽 면 = 벽 밑동 상자·창틀 같은 구조물이다 */
    if (!own && !gov && p.y > FLOOR_Y) { out.reason = '벽 밑동·구조물 위에는 못 놓습니다'; return out; }
    if (!inRoom({ x: out.x, y: out.y, z: out.z }, b)) { out.reason = '방 밖입니다'; return out; }

    /* ★ 판정은 potFits 한 곳뿐이다 — 링의 fits 와 같은 함수다 */
    if (gov) {
      const f = potFits(potD, { slot: gov });
      if (!f.ok) { out.reason = f.reason; return out; }
    } else if (isFloor) {
      /* 바닥이면 가구·벽에 걸리는지 본다. 판정은 floor_nav 한 벌만 쓴다 —
         걷기와 다른 식을 쓰면 "설 수는 없는데 화분은 놓이는 자리"가 생긴다. */
      if (nav.blocked(out.x, out.z, potD / 2)) { out.reason = '가구·벽에 걸립니다'; return out; }
    } else {
      if (Number.isFinite(out.maxPotD) && potD > out.maxPotD + 1e-9) {
        out.reason = `이 면에는 지름 ${out.maxPotD}m 까지만 올라갑니다 (이 화분 ${potD.toFixed(2)}m)`;
        return out;
      }
      const f = potFits(potD, { rect: meshRect(ownHit.object), point: { x: out.x, z: out.z } });
      if (!f.ok) { out.reason = f.reason; return out; }
    }
    /* 다른 화분과 겹치나 — 같은 높이대(±8cm)만 본다.
       선반 위 화분과 그 아래 바닥 화분은 화면에서 겹쳐 보여도 서로 자리를 안 뺏는다. */
    for (const [k, q] of plants) {
      const g = q.group.position;
      if (Math.abs(g.y - out.y) > 0.08) continue;
      if (opt.ignore && (k === opt.ignore || q.potId === opt.ignore)) continue;
      const need = ((q.potD || MONSTERA_POT_D) + potD) / 2 * 0.9;
      const d = Math.hypot(g.x - out.x, g.z - out.z);
      if (d < need) { out.reason = `다른 화분과 겹칩니다 (${(need - d).toFixed(2)}m 모자랍니다)`; return out; }
    }
    out.ok = true;
    return out;
  }

  /* ★ 무엇을 눌렀나 — 한 곳에서만 정한다.
     순서가 규칙이다. 정확한 판정을 먼저 쓰고, 손가락 오차를 감안한 판정을 뒤에 쓴다.
       ① 캐릭터 픽 상자 (광선·정확)
       ② 화분           (광선·정확)
       ③ 캐릭터         (화면거리 36px)
       ④ 자리           (화면거리 30px)
       ⑤ 고른 캐릭터가 있으면 → 바닥
     ③을 ②보다 앞에 두면, 화분 뒤에 선 캐릭터가 화분 탭을 계속 가로챈다. */
  function resolveTap(cx, cy) {
    const c1 = pickCharacterAt(cx, cy, false);
    if (c1) return { type: 'character', id: c1 };
    const p = pickPlantRay(cx, cy);
    if (p) return p;
    const c2 = pickCharacterAt(cx, cy, true);
    if (c2) return { type: 'character', id: c2 };
    const s = pickSlotFuzzy(cx, cy);
    if (s) return s;
    if (selChar && chars.get(selChar) && chars.get(selChar).walkable) {
      const t = walkTargetAt(cx, cy);
      if (t) return { type: 'floor', target: t };
    }
    return null;
  }

  /* ── 포인터 ──
     폰   한 손가락 = 회전(손 떼면 8방 스냅) · 두 손가락 = 줌 · 탭 = 선택
     PC   좌드래그 = 회전 · 휠 = 줌 · 호버 = 자리 미리보기
     패닝은 넣지 않는다. 방은 고정 대상이라 옮길 이유가 없고, 있으면 길을 잃는다. */
  let down = null, dragging = false, pinch = 0;
  let walkDrag = null;         // ★ 고른 캐릭터가 있을 때만 만들어진다. 이게 곧 규칙이다
  const canHover = !window.matchMedia || window.matchMedia('(hover: hover)').matches;
  let hoverId = null;

  const onDown = e => {
    const t = e.touches ? e.touches[0] : e;
    down = { x: t.clientX, y: t.clientY, t: performance.now(), az: cam.az, el: cam.el };
    dragging = false;
    walkDrag = null;
    /* ★ 여기가 카메라와 걷기를 가르는 유일한 자리다.
       고른 캐릭터가 있을 때**만** 끌기를 걷기로 읽는다. 아무도 안 골랐으면
       walkDrag 가 null 이라 아래 onMove 는 예전 그대로 카메라를 돌린다. */
    const c = selChar && chars.get(selChar);
    if (c && c.walkable) {
      /* 상대 이동이다 — 손가락 위치로 순간이동시키지 않는다(game.html 화분 조작과 같은 사상).
         지금 서 있는 자리가 기준점이고, 끈 만큼 옮겨진 자리로 간다.
         그래서 캐릭터를 정확히 짚을 필요가 없고 화면 아무 데나 잡아도 된다. */
      const r = canvas.getBoundingClientRect();
      const p = charScreenPos(c);
      walkDrag = { originX: r.left + (p ? p.x : r.width / 2),
                   originY: r.top + (p ? p.y : r.height / 2),
                   moved: false, target: null };
    }
  };
  const onMove = e => {
    if (!down) { if (canHover && e.clientX != null) onHover(e); return; }
    if (e.touches && e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dd = Math.hypot(dx, dy);
      if (pinch) {
        const [lo, hi] = focused ? [0.5, 3.6] : zoomRange();
        cam.dist = softClamp(cam.dist * (1 - (dd - pinch) * 0.004), lo, hi);
        needsRender = true;
      }
      /* 두 손가락이면 걷기가 아니라 줌이다 — 미리보기를 걷어 준다 */
      if (walkDrag) { walkDrag = null; pendingDrag = null; disposeWalkGhost(); }
      pinch = dd; dragging = true; e.preventDefault();
      return;
    }
    const t = e.touches ? e.touches[0] : e;
    const dx = t.clientX - down.x, dy = t.clientY - down.y;
    if (!dragging && Math.hypot(dx, dy) < TAP_PX) return;

    if (walkDrag) {                       // 고른 뒤에만 여기로 온다
      dragging = true; walkDrag.moved = true;
      /* ★ 여기서 광선을 쏘지 않는다. 폰의 touchmove 는 초당 60~120번 온다 —
         그때마다 바닥 광선 + 길찾기 + 한 장 그리기를 하면 손가락이 미끄러진다.
         자리만 적어 두고 loop 이 프레임당 한 번만 계산한다. */
      walkDrag.px = walkDrag.originX + dx; walkDrag.py = walkDrag.originY + dy;
      pendingDrag = walkDrag;
      needsRender = true;
      e.preventDefault && e.preventDefault();
      return;
    }

    if (!O.orbit) return;
    dragging = true;
    tween = null;
    /* 좌우는 자유롭게 돈다 — 손을 떼면 가까운 45°(8방)로 정돈된다(settleCam).
       위아래는 16°~54° 에서 턱에 걸리고, 넘겨 끌면 고무줄처럼 저항한다. */
    cam.az = down.az - dx * 0.006;
    cam.el = softClamp(down.el + dy * 0.004, EL_MIN, EL_MAX);
    needsRender = true;
    e.preventDefault && e.preventDefault();
  };
  const onUp = e => {
    pinch = 0;
    if (!down) return;
    const wasDrag = dragging, d0 = down, wd = walkDrag;
    down = null; dragging = false; walkDrag = null; pendingDrag = null;

    /* ① 고른 캐릭터를 끌었다 → 손을 뗀 자리로 걸어간다
       ★ 마지막 손가락 자리로 **여기서 한 번** 다시 계산한다. 프레임당 한 번만 계산하게
         미뤄 뒀으므로, 손을 떼는 순간의 자리가 아직 반영되지 않았을 수 있다. */
    if (wd && wd.moved) {
      const t = wd.px != null ? walkTargetAt(wd.px, wd.py) : wd.target;
      disposeWalkGhost();
      if (t && t.ok) doWalk(selChar, t);
      return;
    }
    if (wasDrag) { settleCam(); return; }
    if (performance.now() - d0.t > TAP_MS) return;

    /* ② 탭 */
    const hit = resolveTap(d0.x, d0.y);
    if (!hit) { selectCharacter(null); return; }   // 빈 데를 누르면 고르기 해제
    try {
      if (hit.type === 'character') {
        /* 같은 캐릭터를 다시 누르면 해제 — main.js 의 setSelected(!selected) 그대로 */
        const now = selectCharacter(selChar === hit.id ? null : hit.id);
        /* ★ 첫 인자는 **누른 결과 골라진 것**이다(해제됐으면 null). 누른 id 는 둘째다.
           ------------------------------------------------------------
           왜 이렇게 두나 — 호스트가 대개 이렇게 쓴다:
             onCharacterTap: (id) => roomView.selectCharacter(id)     ← game.html
           여기에 '누른 id' 를 주면, 방금 해제한 것을 호스트가 곧바로 다시 골라 버린다.
           그래서 폰에서 재선택이 안 풀렸다(박사님 지적). 결과를 주면 그 한 줄이
           **양쪽 다** 맞는다 — 고르면 고른 것으로, 풀면 null 로 따라온다.
           누가 눌렸는지가 필요하면 둘째 인자를 보십시오. */
        O.onCharacterTap && O.onCharacterTap(now, hit.id);
      } else if (hit.type === 'floor') {
        doWalk(selChar, hit.target);
      } else if (hit.type === 'plant') {
        selectCharacter(null);
        O.onPlantTap && O.onPlantTap(hit.slotId);
      } else {
        selectCharacter(null);
        O.onSlotTap && O.onSlotTap(hit.slotId);
      }
    } catch (err) { fail(err); }
  };

  /* 실제로 보낸다. 못 가는 자리면 조용히 삼키지 않고 남긴다. */
  function doWalk(id, t) {
    const c = id && chars.get(id);
    if (!c || !c.walkable || !t) return null;
    const r = c.goTo(t.x, t.z, { manual: true });
    if (!r.ok) console.warn(`[방뷰] ${id} 를 그 자리로 못 보냅니다 — ${r.reason || '길이 없습니다'}`);
    return r;
  }

  /* 휠 줌 (PC). 폰의 두 손가락과 같은 한계를 쓴다. */
  const onWheel = e => {
    if (!O.orbit) return;
    e.preventDefault();
    const [lo, hi] = focused ? [0.5, 3.6] : zoomRange();
    cam.dist = softClamp(cam.dist * (1 + Math.sign(e.deltaY) * 0.08), lo, hi);
    needsRender = true;
    clearTimeout(onWheel._t);
    onWheel._t = setTimeout(() => { if (!disposed) settleCam(); }, 160);
  };

  /* 호버 (PC 전용). 자리 이름·밝기를 띄우는 건 호스트 몫이고, 여기선 어느 자리인지만 알린다. */
  function onHover(e) {
    const hit = pickAt(e.clientX, e.clientY);
    const id = hit ? hit.slotId : null;
    canvas.style.cursor = hit ? 'pointer' : '';
    if (id === hoverId) return;
    hoverId = id;
    try { O.onSlotHover && O.onSlotHover(id, hit ? hit.type : null); } catch (err) { fail(err); }
  }
  const onLeave = () => {
    canvas.style.cursor = '';
    if (hoverId !== null) { hoverId = null; try { O.onSlotHover && O.onSlotHover(null, null); } catch (e) { fail(e); } }
  };

  canvas.addEventListener('mousedown', onDown);
  canvas.addEventListener('touchstart', onDown, { passive: true });
  window.addEventListener('mousemove', onMove);
  canvas.addEventListener('touchmove', onMove, { passive: false });
  window.addEventListener('mouseup', onUp);
  canvas.addEventListener('touchend', onUp);
  canvas.addEventListener('touchcancel', () => { down = null; dragging = false; pinch = 0;
                                                 walkDrag = null; pendingDrag = null; disposeWalkGhost(); });
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('mouseleave', onLeave);

  /* ============================================================
     ⑥ 빛
  ============================================================ */
  /* ★ 그림자 예산 (2026-08-03 지시 — 빨리감기에서 하루가 눈에 보여야 한다)
     ------------------------------------------------------------
     하루가 140ms 다. 그 안에 setDaylight 가 여러 번 불리는데, scene.js 의 updateLight 는
     부를 때마다 그림자맵을 **넉 장** 다시 굽는다(해 1 + 창확산광 2 + 천장등 큐브 1).
     천장등은 점광원이라 큐브맵 6면 = 장면을 6번 더 그린다. 이게 제일 비싸다.

     세 가지를 재 봤다(반지하·연속 렌더·아래 setShadowBudget 로 전환).
       full  scene.js 기본 그대로              — 해+창확산광2+천장등큐브
       lean  해만 굽는다. 그림자 카메라를 방 크기로 조인다 ★ 채택
       none  그림자 없음. 빛 웅덩이가 사라져 시간이 흐르는 게 안 보인다 — 목적에 어긋난다

     lean 을 고른 이유는 **없앤 셋이 시간 표현에 기여하지 않기 때문**이다.
     창틀 그림자가 바닥을 훑고 지나가는 건 전부 해(방향광)가 그리는 것이고,
     창확산광 그림자는 부드러워 움직임이 안 읽히며 천장등은 낮에 꺼져 있다.
     여기에 그림자 카메라를 방 크기로 좁혀(기본은 아파트 기준 24m 폭) 같은 1024 로
     훨씬 또렷한 창틀 무늬를 얻는다 — 오히려 더 잘 읽힌다. */
  let shadowMode = 'lean';
  const _lastSunDir = new THREE.Vector3(0, 0, 0);

  function applyShadowBudget() {
    const lean = shadowMode !== 'full';
    for (const sp of (ctx.skyPortals || [])) if (sp.castShadow !== !lean) sp.castShadow = !lean;
    ctx.ceilingBulb.castShadow = !lean;         // 점광원 큐브맵 — 6면이라 제일 비싸다
    ctx.sunLight.castShadow = shadowMode !== 'none';

    /* 그림자 카메라를 이 방에 맞춘다. scene.js 는 제일 큰 방(아파트) 기준 ±12m 로
       두는데, 5×4m 반지하에 그대로 쓰면 1024 한 픽셀이 2.3cm 라 창틀이 뭉갠다.
       updateLight 가 매번 ±12 로 되돌리므로 그 뒤에 다시 조인다. */
    if (built && ctx.sunLight.castShadow) {
      const b = roomBox();
      const half = Math.max(2.5, Math.hypot(b.w, b.d) / 2 + 0.6);
      const sc = ctx.sunLight.shadow.camera;
      if (Math.abs(sc.left + half) > 0.01) {
        sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half;
        sc.updateProjectionMatrix();
      }
    }
  }

  function applyDaylight() {
    /* ★천장등은 **낮에 아예 안 켠다** (박사님 2026-08-03: "낮에는 안 켜지게").
       scene.js 의 자동 모드(0)는 해가 약하면 켜는데, 반지하는 낮에도 해가 약해서
       한낮에 천장등이 같이 켜졌다 — 방이 통째로 하얘지고 창으로 드는 빛이 묻혔다.
       이 게임에서 창빛은 볼거리이자 정보다. 그걸 덮는 조명은 낮에 있으면 안 된다.
       0.30~0.78 을 낮으로 본다(아침 해 뜬 뒤 ~ 저녁 해 지기 전). */
    const isDay = daylightT > 0.30 && daylightT < 0.78;
    const label = updateLight(ctx, daylightT * 100, isDay ? 2 : 0);

    /* ★밤에도 낮춘다 ("보이는 광원이 너무 밝어").
       scene.js 는 갓의 emissiveIntensity 를 0.9, 전구를 4.5 로 둔다 — 방 도구에서는
       천장등 자체를 검수하는 화면이라 맞지만, 게임에서는 갓이 하얗게 타서
       식물이 그 옆에서 안 보인다. 화면 주인공은 방과 식물이지 조명이 아니다. */
    if (ctx.ceilingBulb.intensity > 0) {
      ctx.ceilingBulb.intensity *= 0.42;
      if (ctx.clShade && ctx.clShade.material)
        ctx.clShade.material.emissiveIntensity = 0.22;   // 0.9 → 은은하게 켜진 정도
    }
    /* ★방 전체를 한 톤 낮춘다 ("방이 너무 밝다").
       채움광(hemi·ambient)이 세면 그림자가 옅어지고, 창으로 드는 빛 웅덩이가
       배경에 묻힌다 — 빛이 자리를 가르는 게임에서 그건 정보가 사라지는 것이다.
       해는 그대로 두어 창빛의 대비를 오히려 키운다. */
    ctx.hemi.intensity *= 0.62;
    ctx.ambient.intensity *= 0.58;

    /* ★그래도 밝다 (박사님 2026-08-03, 폰 실측). 채움광만 줄여서는 부족했다 —
       방 재질 자체가 밝은 파스텔이라 빛을 그대로 되돌려준다.
       노출을 내리면 **재질을 안 건드리고** 전체가 한 단계 가라앉는다. ACESFilmic 이라
       밝은 쪽이 먼저 눌리므로, 흰 벽이 타는 것부터 잡히고 그림자는 덜 뭉갠다.
       ⚠ scene.js 기본값(1.1)은 그대로 둔다 — 방 도구는 검수 화면이라 밝아야 한다. */
    ctx.renderer.toneMappingExposure = 0.60;

    /* ★방 **바깥**을 어둡게 한다. 화면의 절반쯤이 배경인데 scene.js 는 그걸 하늘색으로
       칠한다 — 방 도구에서는 맞지만(바깥에서 방을 들여다보는 화면이다), 게임에서는
       그 밝은 면이 눈을 끌어 방이 상대적으로 어두워 보이지 않는다.
       배경을 UI 바탕색으로 낮추면 방만 밝은 섬이 되고, 같은 노출에서도 훨씬 차분해진다.
       ⚠ 창으로 보이는 하늘(skyPortals)은 안 건드린다 — 그건 "밖이 밝다"는 정보다. */
    if (ctx.scene.background && ctx.scene.background.isColor)
      ctx.scene.background.lerp(new THREE.Color(0x14101c), 0.72);
    if (ctx.scene.fog && ctx.scene.fog.color)
      ctx.scene.fog.color.lerp(new THREE.Color(0x14101c), 0.72);

    /* updateLight 는 부른 김에 그림자 넉 장을 다 다시 굽게 표시한다. 일단 전부 내리고
       필요한 것만 다시 올린다 — 아래 정책이 유일한 결정권자가 되게. */
    ctx.sunLight.shadow.needsUpdate = false;
    ctx.ceilingBulb.shadow.needsUpdate = false;
    for (const sp of (ctx.skyPortals || [])) if (sp.castShadow) sp.shadow.needsUpdate = false;
    applyShadowBudget();

    /* 해가 움직인 만큼만 다시 굽는다. 아주 조금 움직였으면 어차피 눈에 안 보인다. */
    if (ctx.sunLight.castShadow) {
      const d = ctx.sunLight.position;
      const moved = _lastSunDir.lengthSq() === 0 || _lastSunDir.angleTo(d) > 0.004;
      if (moved) { ctx.sunLight.shadow.needsUpdate = true; _lastSunDir.copy(d); }
      if (shadowMode === 'full') {
        ctx.ceilingBulb.shadow.needsUpdate = true;
        for (const sp of (ctx.skyPortals || [])) if (sp.castShadow) sp.shadow.needsUpdate = true;
      }
    }

    /* ★ 낮에는 채움광을 조금 낮추고 해를 조금 올린다.
       빨리감기에서 눈이 잡는 건 '창으로 든 빛 웅덩이가 움직인다'는 것 하나다.
       방향 없는 채움광이 세면 웅덩이가 배경에 묻혀 하루가 지나가도 화면이 안 변한다.
       (방 도구 index.html 은 조도를 눈으로 읽는 화면이라 지금 균형이 맞다 — 게임만 다르다) */
    const day = clamp(ctx.sunLight.intensity / 1.55, 0, 1);
    ctx.hemi.intensity *= (1 - 0.20 * day);
    ctx.ambient.intensity *= (1 - 0.25 * day);
    ctx.sunLight.intensity *= 1.18;

    /* ★ 밤을 캄캄하게 두지 않는다.
       scene.js 의 밤은 hemi 0.16 · ambient 0.07 이라 식물이 안 보인다.
       빨리감기에서 화면이 까매지면 "하루가 지나갔다"가 아니라 "꺼졌다"로 읽힌다.
       밤일수록 푸른 채움광을 얹어 어둑한 정도까지만 내려가게 한다. */
    const dark = 1 - clamp(ctx.sunLight.intensity / 1.2, 0, 1);
    ctx.hemi.intensity = Math.max(ctx.hemi.intensity, 0.16 + dark * 0.30);
    ctx.ambient.intensity = Math.max(ctx.ambient.intensity, 0.07 + dark * 0.16);

    /* 안개는 scene.js 가 매번 새로 만든다(30~120m). 폰 세로는 방을 통째로 담느라
       카메라가 멀리 서므로 그대로 두면 방이 뿌옇게 죽는다. 카메라 거리에 맞춘다. */
    if (ctx.scene.fog) {
      ctx.scene.fog.near = Math.max(30, cam.dist * 1.35);
      ctx.scene.fog.far = Math.max(120, cam.dist * 4.5);
    }
    /* 방에 놓인 조명 기구 — 어두우면 켠다. 화면 연출만이고 판정은 조도 엔진 몫이다.
       그림자 없는 점광원이라도 개수가 늘면 셰이더가 무거워지니 4개에서 자른다. */
    const lampsOn = daylightT < 0.30 || daylightT > 0.86;
    let on = 0;
    for (const r of (built && built.lightRigs) || []) {
      if (!r.light) continue;
      const want = r.grow ? (r.schedule && r.schedule !== 'off') : lampsOn;
      r.light.intensity = (want && on < 4) ? (r.grow ? 1.6 : 2.4) : 0;
      if (r.light.intensity > 0) on++;
      if (r.shade && r.shade.material) r.shade.material.emissiveIntensity = want ? 0.85 : 0;
    }
    needsRender = true;
    return label;
  }

  /* ============================================================
     ⑦ 렌더 루프 — 놀 때는 안 그린다
     ------------------------------------------------------------
     방은 대부분 가만히 있다. 매 프레임 다시 그리면 폰이 뜨거워지고 배터리만 먹는다.
     움직일 때(카메라 트윈·하이라이트 맥박·화분 이동)만 그린다.
  ============================================================ */
  let lastFpsAt = performance.now(), framesSince = 0;
  /* 캐릭터가 있으면 idle 이 계속 돌아야 한다 — 그동안은 놀 수가 없다.
     대신 30fps 로 잘라 둔다. 폰에서 방 하나 때문에 60fps 를 계속 태울 이유는 없고,
     idle 은 30fps 로도 충분히 부드럽다. */
  const CHAR_FPS = 30;
  let lastCharAt = performance.now();

  /* ★★ 한 장 그리는 간격을 30fps 로 자른다 (2026-08-03 · "이동할 때 프레임이 겁나 떨어져")
     ------------------------------------------------------------
     재 보고 넣었다(tools/test_roomview_perf.mjs · 390×844 dpr2 · CPU 4배).
       가만히 있을 때  22.6 장/초
       **끌고 있을 때  48.6 장/초**   ← 손가락 이벤트마다 needsRender 가 켜졌다
       걷는 중        23.0 장/초
     끄는 동안만 그리는 양이 두 배였다. 폰의 touchmove 는 초당 60~120번 온다 —
     그때마다 방 한 장(드로우콜 103 · 삼각형 7.6만)을 통째로 다시 그리고 있었던 것이다.
     캐릭터는 어차피 30fps 로만 갱신하므로 그 사이 프레임은 **같은 그림을 한 번 더**
     그리는 것이고, 폰에서는 그게 곧 손가락이 미끄러지는 느낌(=렉)이 된다.
     ⚠ setContinuous(true)(데모·측정)일 때는 자르지 않는다 — 재는 화면까지 자르면
       무엇을 재고 있는지 알 수 없게 된다. */
  const MIN_FRAME_MS = 1000 / CHAR_FPS - 4;
  let lastFrameAt = 0;
  /* 끄는 동안 마지막 손가락 자리만 적어 둔다. 광선·길찾기는 프레임당 한 번만 한다. */
  let pendingDrag = null;

  function stepCharacters(now, force) {
    if (!chars.size) { lastCharAt = now; return false; }
    const dt = (now - lastCharAt) / 1000;
    /* 0.9 배로 여유를 둔다 — 위 MIN_FRAME_MS 와 문턱이 딱 붙어 있으면 프레임이 조금만
       흔들려도 한 번씩 걸러져 캐릭터가 20fps 로 뚝뚝 끊긴다(딱 붙여 두고 봤다). */
    if (!force && dt < 0.9 / CHAR_FPS) return false;
    lastCharAt = now;
    for (const [, c] of chars) {
      try { c.update(Math.min(dt, 0.1)); } catch (e) { fail(e); }
    }
    return true;
  }

  function loop(now) {
    if (disposed) return;
    raf = requestAnimationFrame(loop);
    /* 아직 이르면 아무것도 안 한다. needsRender 는 그대로 켜져 있으니 다음 프레임에 그린다. */
    if (!forceContinuous && now - lastFrameAt < MIN_FRAME_MS) return;
    lastFrameAt = now;
    /* 끄는 중이면 여기서 딱 한 번 목적지를 계산한다(이벤트마다 하지 않는다) */
    if (pendingDrag) {
      const d = pendingDrag; pendingDrag = null;
      if (d === walkDrag) d.target = showWalkGhost(walkTargetAt(d.px, d.py));
    }
    const moving = stepTween(now) | pulseRings(now) | stepCharacters(now);
    if (!needsRender && !moving && !forceContinuous) {
      /* ★ 노는 동안은 fps 를 세지 않는다. 여기서 세면 "가만히 있어서 1초에 두 장만
         그렸다"가 "1초에 두 장밖에 못 그린다"로 읽혀 화질을 멋대로 떨어뜨린다.
         실제로 그랬다 — 픽셀비가 1.75에서 1.25로 내려가 있었다. */
      lastFpsAt = now; framesSince = 0;
      return;
    }
    needsRender = false;
    const t0 = performance.now();
    updateCam();
    ctx.renderer.render(ctx.scene, ctx.cam);
    const ms = performance.now() - t0;
    if (ms > stats.worstMs) stats.worstMs = ms;
    stats.drawn++;
    framesSince++;
    if (now - lastFpsAt >= 500) {
      /* '안 바쁜 것'과 '느린 것'을 가른다 — 노는 프레임이 하나라도 있으면 위에서
         framesSince·lastFpsAt 을 통째로 되돌리므로, 여기까지 온 창은 **500ms 내내 바빴던 창**이다.
         ★ 그래서 표본 문턱은 낮아도 된다. 예전 20장은 두 번 잘못됐다.
           ① 위에서 30fps 로 자르니 한 창에 많아야 15장 — 영영 안 찼다.
           ② 정작 느릴 때(6fps)는 3장뿐이라, **느릴수록 판정이 안 되는** 거꾸로 된 문턱이었다.
           그래서 못 따라갈 때 해상도를 내리는 안전장치가 한 번도 안 돌았다.
         4장이면 노는 창은 걸러지고 느린 창은 잡힌다. 튐 방지는 autoQuality 의 연속 2창이 맡는다. */
      if (framesSince >= 4) { stats.fps = Math.round(framesSince * 1000 / (now - lastFpsAt)); autoQuality(); }
      framesSince = 0; lastFpsAt = now;
    }
  }

  /* 못 따라가면 해상도를 내린다. 무엇을 줄였는지 stats 에 남긴다. */
  let pxRatio = Math.min(O.maxPixelRatio, dpr);
  const PX_STEPS = [1.75, 1.5, 1.25, 1.0, 0.85];
  let slowWindows = 0;
  function autoQuality() {
    /* 목표는 '노리는 만큼'이다 — 30fps 로 자르는 화면에 55fps 를 요구하면 늘 불합격이라
       픽셀비가 바닥까지 내려간다(예전 55 는 60fps 를 노리던 시절의 값이다). */
    const target = CHAR_FPS - 6;               // 30 을 노리는데 24 도 못 내면 무거운 것이다
    if (forceContinuous || !(stats.fps > 0)) return;
    /* ★ 한 번 느렸다고 바로 안 내린다. 부팅 직후·화분 조립 같은 한 번짜리 걸림에
       화질을 영구히 깎아 먹으면 안 된다 — 연속 두 창(1초)이 느릴 때만 내린다. */
    slowWindows = stats.fps < target ? slowWindows + 1 : 0;
    if (slowWindows >= 2) {
      slowWindows = 0;
      const i = PX_STEPS.findIndex(v => v <= pxRatio + 1e-3);
      const next = PX_STEPS[Math.min(PX_STEPS.length - 1, (i < 0 ? 0 : i) + 1)];
      if (next < pxRatio - 1e-3) {
        pxRatio = next;
        ctx.renderer.setPixelRatio(pxRatio);
        stats.reduced = `픽셀비 ${pxRatio}`;
        needsRender = true;
      }
    }
  }

  function resize() {
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width || canvas.width || PHONE.w));
    const h = Math.max(1, Math.round(r.height || canvas.height || PHONE.h));
    const aspect = w / h;
    ctx.cam.fov = aspect < 0.95 ? FOV_PORTRAIT : FOV_LANDSCAPE;
    ctx.cam.aspect = aspect;
    ctx.cam.updateProjectionMatrix();
    ctx.renderer.setPixelRatio(Math.min(pxRatio, dpr));
    ctx.renderer.setSize(w, h, false);            // CSS 크기는 호스트가 정한다
    if (built) {
      if (focused) focusSlot(focused, true);
      else frameRoom(true);
    }
    needsRender = true;
  }

  let ro = null;
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(() => resize());
    ro.observe(canvas);
  }
  window.addEventListener('resize', resize);

  /* ============================================================
     ⑧ 옮기기 미리보기 — "놓으면 이렇게 된다"
     ------------------------------------------------------------
     링은 "여기 놓을 수 있다"는 말이지 "놓으면 이렇게 된다"는 말이 아니다.
     창턱처럼 좁은 자리는 들어가는지 안 들어가는지가 링만으로는 안 보인다.
     그래서 그 화분의 **반투명 복제**를 목표 자리에 띄운다. 원본은 제자리 그대로다.

     ★ 생김새·색은 render3d/decorate.js 의 가구 고스트를 그대로 따른다
       (GH_OK 0x4aa3ff · GH_NG 0xe8615a · opacity 0.28 · 윤곽선 · renderOrder 997/998
        · 바닥 링 999). 두 화면이 다르게 생기면 플레이어가 다른 조작으로 오해한다.
     개선한 곳은 하나 — decorate 는 **상자**를 띄우지만 여기서는 **그 식물의 복제**를
     띄운다. 창턱처럼 좁은 자리에서 "이게 들어가나"는 실루엣이 있어야 판단된다.

     지키는 것
       · 복제는 **하나만** 유지한다. 목표가 바뀌면 옮기기만 한다(끄는 내내 새로 만들면
         GLB 복제 비용이 계속 든다)
       · 그림자는 안 건다. 끄는 동안 매 프레임 그림자맵을 다시 구우면 폰이 죽는다
       · 실제로 놓일 **크기·회전** 그대로 보인다. 크기가 다르면 미리보기의 뜻이 없다
       · 안 들어가는 자리면 붉게 — 판정은 bbox 가 아니라 회전 무관 지름이다
  ============================================================ */
  const GH_OK = 0x4aa3ff, GH_NG = 0xe8615a;      // decorate.js 와 같은 값

  function disposePreview() {
    if (!preview) return;
    houseGroup.remove(preview.group);
    /* 여기서 새로 만든 것은 윤곽선 기하와 재질 두 벌뿐이다. 그것만 버린다 —
       메시 기하는 진짜 화분 것이라 disposeObject 가 건너뛴다(sharedGeometry). */
    preview.group.traverse(o => { if (o.isLineSegments && o.geometry) o.geometry.dispose(); });
    disposeObject(preview.group);
    preview.mat && preview.mat.dispose();
    preview.line && preview.line.dispose();
    if (preview.marker) {
      houseGroup.remove(preview.marker);
      preview.marker.geometry.dispose(); preview.marker.material.dispose();
    }
    preview = null;
    needsRender = true;
  }
  function clearPreviewFor(slotId) {
    if (preview && (preview.fromId === slotId || preview.toId === slotId)) disposePreview();
  }

  /* 목표 자리에 이 화분이 들어가나 — movePlant 와 **같은 식**을 쓴다.
     여기와 저기가 다른 식을 쓰면 "미리보기는 파란데 놓으면 거절"이 난다. */
  function fitsInSlot(group, toSlot) {
    const limit = slotPotLimit(toSlot);
    if (!Number.isFinite(limit)) return true;
    return rotationSafeDiameter(potPartOf(group), group) <= limit + 1e-4;
  }

  /* 유령 한 벌을 만든다 — previewMove 와 previewAt 이 **같은 것**을 쓴다.
       src   그 화분의 그룹. 있으면 실루엣이 그대로 복제된다
             (창턱처럼 좁은 자리에서 "이게 들어가나"는 실루엣이 있어야 판단된다)
       potD  src 가 없을 때 세울 대역 원기둥의 지름. 아직 놓을 화분이 없는 경우다 */
  function buildGhost(src, potD) {
    /* 반투명 · 그림자 없음 · 윤곽선. decorate.js 고스트와 같은 값. */
    const gm = new THREE.MeshBasicMaterial({ color: GH_OK, transparent: true,
                                             opacity: 0.28, depthWrite: false });
    const gl = new THREE.LineBasicMaterial({ color: GH_OK, transparent: true, opacity: 0.9,
                                             depthTest: false });
    let g;
    if (src) {
      g = src.clone(true);
      /* ★ 탭 판정에 안 걸리게 — 미리보기를 눌러 화분이 선택되면 안 된다.
         clone 은 userData 를 얕게 나눠 쓰므로 통째로 새로 만들어 끊는다. */
      g.userData = { ...src.userData, isPreview: true, plantSlotId: undefined, potId: undefined };
      /* ★ potPart 는 **원본의** 화분을 가리킨다. 그대로 두면 자리 판정이 복제본이 아니라
         원본을 원본과 다른 기준 좌표계로 재게 되어 늘 "안 들어간다"가 나온다(실제로 그랬다).
         복제본 안에서 다시 찾는다. */
      g.userData.potPart = null;
      g.traverse(o => { if (!g.userData.potPart && o.userData && o.userData.assetKey === 'pot') g.userData.potPart = o; });
      if (!g.userData.potPart) g.userData.potPart = null;   // 없으면 potPartOf 의 옛 규칙으로 내려간다
      /* ★ 복제는 기하를 원본 화분과 **통째로 나눠 쓴다.** 미리보기를 지울 때
         geometry.dispose() 를 부르면 제자리에 있던 진짜 화분이 사라진다(실제로 그런다).
         전부 '공유'로 표시해 disposeObject 가 건너뛰게 한다. */
      g.traverse(o => { o.userData = { ...o.userData, plantSlotId: undefined, potId: undefined,
                                       isPreview: true, sharedGeometry: true }; });
      const edges = [];
      g.traverse(o => {
        if (!o.isMesh) return;
        o.castShadow = false; o.receiveShadow = false;   // 그림자맵을 다시 굽게 하지 않는다
        o.material = gm;                                  // 재질 한 벌만 쓴다(색 바꾸기가 한 줄)
        o.renderOrder = 997;
        /* 윤곽선은 잎처럼 정점이 많은 메시에는 안 붙인다 — 끄는 동안 EdgesGeometry 를
           수만 개 만들면 그 자리에서 멈춘다. 화분(잎이 아닌 것)에만 붙인다. */
        if (o.geometry && o.geometry.attributes.position.count <= 900) edges.push(o);
      });
      for (const o of edges) {
        const e = new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry), gl);
        e.renderOrder = 998;
        o.add(e);
      }
    } else {
      /* 대역 유령 — 사람 미리보기(walkGhost)와 같은 사상이다. "여기 이만한 게 선다"만 전한다. */
      const r = Math.max(0.03, potD / 2);
      g = new THREE.Group();
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(r, r, r * 2.2, 20, 1, true), gm);
      cyl.position.y = r * 1.1;
      cyl.renderOrder = 997;
      g.add(cyl);
      g.userData = { isPreview: true, generic: true };
    }
    /* 바닥(자리)에 링 — decorate.js 의 marker 와 같은 모양 */
    const marker = new THREE.Mesh(
      new THREE.RingGeometry(0.28, 0.36, 28),
      new THREE.MeshBasicMaterial({ color: GH_OK, transparent: true, opacity: 0.85,
                                    side: THREE.DoubleSide, depthTest: false }));
    marker.rotation.x = -Math.PI / 2;
    marker.renderOrder = 999;
    houseGroup.add(marker);
    houseGroup.add(g);
    return { group: g, marker, mat: gm, line: gl, ok: null };
  }

  function setGhostOk(ok) {
    if (!preview || ok === preview.ok) return;
    preview.ok = ok;
    const hex = ok ? GH_OK : GH_NG;
    preview.mat.color.setHex(hex);
    preview.line.color.setHex(hex);
    preview.marker.material.color.setHex(hex);
  }

  function previewMove(fromId, toId) {
    if (toId == null) { disposePreview(); return null; }
    const p = plants.get(fromId);
    if (!p) throw new Error(`미리보기할 화분이 없습니다: ${fromId}`);
    const to = slotOrThrow(toId);

    /* 이미 같은 화분의 복제가 있으면 **옮기기만** 한다 */
    if (!preview || preview.srcKey !== fromId || preview.kind !== 'move') {
      disposePreview();
      preview = buildGhost(p.group, p.potD || MONSTERA_POT_D);
      preview.kind = 'move'; preview.srcKey = fromId; preview.fromId = fromId;
    }
    preview.toId = toId;
    preview.at = null;

    /* 위치·회전·크기는 **실제로 놓일 그대로** */
    preview.group.position.set(to.x, to.y, to.z);
    preview.group.rotation.y = p.group.rotation.y;
    preview.group.scale.copy(p.group.scale);
    const r = clamp((Number.isFinite(to.maxPotD) ? to.maxPotD : 0.22) * 1.5, 0.12, 0.55);
    preview.marker.scale.setScalar(r / 0.32);
    preview.marker.position.set(to.x, to.y + 0.004, to.z);

    setGhostOk(fitsInSlot(preview.group, to));
    needsRender = true;
    return { fromId, toId, ok: preview.ok };
  }

  /* ★ 좌표 미리보기 — previewAt (2026-08-03)
     ------------------------------------------------------------
     자유 배치용. previewMove 와 **한 벌의 유령**을 나눠 쓴다(둘이 동시에 뜨면
     화분이 두 개인 것처럼 보인다 — 미리보기가 거짓말을 하는 셈이다).

       at            { x, y, z, rotY? } 세울 자리
       opt.potD      대역 유령을 세울 때의 지름. 원본이 있으면 그쪽이 이긴다
       opt.valid     false 면 붉게. ★ 판정은 호출부 몫이다 — surfaceAt().ok 를 그대로 넣으면 된다
       opt.fromId    이 열쇠의 화분 실루엣으로 띄운다(옮기는 중인 화분)
       opt.potId     같은 뜻. 화분 이름으로 찾는다
     at 이 null 이면 지운다. */
  function previewAt(at, opt = {}) {
    if (!at) { disposePreview(); return null; }
    if (!built) throw new Error('방이 아직 없습니다');
    /* ★ 여기서는 방 경계를 안 본다 — 유령은 **판정 결과를 보여주는 것**이지 배치가 아니다.
       방 밖을 겨냥했으면 surfaceAt 이 ok:false 를 주고, 그 자리에 붉은 유령이 떠야
       "여기는 안 된다"가 눈에 보인다. 여기서 던지면 화면이 그냥 멈춘다.
       (NaN·무한대는 그대로 던진다. 그건 배선이 틀린 것이라 보여 줄 값이 없다) */
    const A = makeAt(at);
    const src = opt.fromId != null ? plants.get(opt.fromId)
              : opt.potId != null ? plantOf(opt.potId) : null;
    const potD = Number.isFinite(opt.potD) ? opt.potD : (src ? src.potD : MONSTERA_POT_D);
    /* 같은 유령이면 다시 만들지 않는다 — 끄는 내내 GLB 를 복제하면 폰이 죽는다 */
    const srcKey = src ? keyOfPlant(src) : `generic:${potD.toFixed(3)}`;
    if (!preview || preview.srcKey !== srcKey || preview.kind !== 'at') {
      disposePreview();
      preview = buildGhost(src ? src.group : null, potD);
      preview.kind = 'at'; preview.srcKey = srcKey;
      preview.fromId = src ? keyOfPlant(src) : null;
      if (src) preview.group.scale.copy(src.group.scale);
    }
    preview.toId = null;
    preview.at = A;
    preview.potD = potD;
    preview.group.position.set(A.x, A.y, A.z);
    preview.group.rotation.y = A.rotY || 0;
    const r = clamp(potD * 1.5, 0.12, 0.55);
    preview.marker.scale.setScalar(r / 0.32);
    preview.marker.position.set(A.x, A.y + 0.004, A.z);
    setGhostOk(opt.valid !== false);
    needsRender = true;
    return { at: A, potD, ok: preview.ok };
  }

  /* 화분이 다시 조립됐을 때 미리보기도 그 모습으로 따라간다 */
  function refreshPreview() {
    if (!preview) return;
    const { kind, fromId, toId, at, potD } = preview;
    disposePreview();
    try {
      if (kind === 'at' && at) previewAt(at, { fromId: plants.has(fromId) ? fromId : undefined, potD });
      else if (plants.has(fromId) && slotById.has(toId)) previewMove(fromId, toId);
    } catch (e) { /* 사라진 자리 — 미리보기가 없어질 뿐이다 */ }
  }

  /* ============================================================
     ⑧-b ★ 가구 옮기기 (2026-08-03)
     ------------------------------------------------------------
     ⚠ 재조립이 비싸다. 그래서 조작이 두 단계다.
        끄는 동안  previewFurnitureAt — **유령만** 움직인다. 방은 안 건드린다
        손 뗄 때   commitFurnitureAt  — 여기서 **한 번만** 방을 다시 짓는다
       이 순서를 뒤집으면(끄는 동안 커밋하면) 손가락 한 번에 buildHouse 가 수십 번 돈다.

     ★★ 가구를 옮기면 그 위 화분은 어떻게 되나 — 확정 규칙 (조용히 허공에 두지 않는다)
       ① 추천 자리(slotId) 위 화분 — **가구를 따라간다.**
          slotId 는 `{가구 uid}:{단}` 이라 가구가 움직여도 이름이 안 바뀐다. 다시 조립된
          그 자리의 새 좌표에 세우면 그게 곧 "같이 옮겨졌다"가 된다.
       ② 자유 좌표 화분 중 at.onUid 가 그 가구인 것 — **가구를 따라간다.**
          가구 좌표계에서의 상대 위치·각도를 그대로 보존한다(followFurniture).
       ③ 바닥 화분(onUid=null)과 다른 가구 위 화분 — **제자리에 그대로 있다.**
          옮긴 가구가 바닥 화분을 덮치면 화분은 안 움직이고 **경고만** 남긴다.
          거기서 화분을 제멋대로 옮기면 플레이어가 고른 자리를 잃는다 — 알리고 맡긴다.
       ④ ①~③ 을 해 봤는데 방 밖이거나 받치던 가구가 사라졌으면 — **회수한다.**
          제일 가까운 빈 추천 자리로 옮기고 콘솔에 남긴다.
       (state.js 의 rehomePot 과 같은 사상이다: 자유 좌표는 그대로 두되, 근거가 사라지면 회수)

     ★ 창턱(sill)은 못 옮긴다. house.js 가 userData.fixed 를 달아 둔 건축 구조다.
  ============================================================ */
  /* ★★ '바닥에 서 있는 가구'와 '무엇에 얹힌 물건'을 가르는 유일한 규칙 (2026-08-03)
     ------------------------------------------------------------
     ⚠ 먼저 확인했다: **house_rooms.json 에도 house.js 에도 부착 관계를 적는 칸이 없다.**
       (가구 한 칸이 가진 열쇠는 preset·uid·x·z·y·rot·spectrum·schedule·note 뿐이다)
     그래서 데이터가 **이미 하고 있는 표시**를 규칙으로 삼는다 —
       바닥에 서는 가구는 y 를 안 적는다(=0). 무엇에 얹히거나 물린 것만 y 를 적는다.
         반지하 클립등  y 0.75  ← 책상 상판 0.74 에 물려 있다
         반지하 바 등   y 1.02  ← 선반 단 밑에 붙어 있다
       house.js 의 mount·hangFromCeiling 도 같은 뜻이다(벽걸이·천장등).
     ⇒ **y>0 이거나 mount·hangFromCeiling 이면 '얹힌 것'이다.**
        얹힌 것은 ① 바닥 장애물이 아니고 ② 혼자 못 움직이며 ③ 받친 가구를 따라간다.

     이걸 안 지키면 어떻게 되나 — 실제로 그랬다:
       책상에 물린 클립등을 장애물로 세어 **책상이 자기가 지금 있는 자리조차 거절**당했다.
       판정이 현재 상태를 거절하면 그건 판정이 아니라 고장이다. */
  const RAISED_Y = 0.02;
  const isRider = u => !!(u && (u.mount || u.hangFromCeiling));
  function riderNode(g) {
    return !!g && (isRider(g.userData) || g.position.y > RAISED_Y);
  }

  /* 옮길 수 있는 가구 = 바닥에 서 있고 붙박이가 아닌 것.
     (조명 PointLight 도 같은 그룹의 자식이지만 size 가 없어 저절로 빠진다) */
  function furnNodes() {
    if (!built || !built.furniture) return [];
    return built.furniture.children.filter(g => g.userData && g.userData.uid && g.userData.size
      && !g.userData.fixed && !riderNode(g));
  }

  /* 그 가구에 얹히거나 물려 있는 것들 — 겹침 판정에서 빼고, 옮길 때 같이 데려간다.
     판단은 위 규칙 + **XZ 발자국이 겹치는가** 다(부착 관계가 데이터에 없으니 좌표로 본다).
     ⚠ 벽걸이·천장등은 뺀다 — 그건 벽·천장 것이지 이 가구 것이 아니다. */
  function ridersOf(g) {
    if (!built || !built.furniture || !g || !g.userData.size) return [];
    const sz = g.userData.size;
    const base = { x: g.position.x, z: g.position.z, w: sz.w, d: sz.d, rot: g.rotation.y || 0 };
    const out = [];
    for (const n of built.furniture.children) {
      if (n === g || !n.userData || !n.userData.uid || !n.userData.size) continue;
      if (n.userData.fixed || n.userData.hangFromCeiling) continue;
      if (n.userData.mount === 'wall' || n.userData.mount === 'window') continue;
      if (!riderNode(n)) continue;
      const s2 = n.userData.size;
      if (!rectOverlap(base, { x: n.position.x, z: n.position.z, w: s2.w, d: s2.d,
                               rot: n.rotation.y || 0 }, 0.05)) continue;
      out.push(n);
    }
    return out;
  }
  function furnNode(uid) { return furnNodes().find(g => g.userData.uid === uid) || null; }
  /* 그 uid 가 지금 이 방에 있나 — 붙박이(창턱)까지 본다. 화분 회수 판정이 쓴다. */
  const hasFurnUid = uid => !!(built && built.furniture &&
    built.furniture.children.some(g => g.userData && g.userData.uid === uid));

  /* rot 는 **도(°)** 다 — house_rooms.json·place.validateFurnitureAt 과 같은 단위.
     (화분 rotY 는 라디안이다. 섞이면 가구가 57배 돌아간다 — place.js 머리말 참고) */
  function furnInfo(g) {
    const uid = g.userData.uid;
    const f = roomDef && (roomDef.furniture || []).find(x => x.uid === uid);
    const presetId = f ? f.preset : (String(uid).includes('#') ? String(uid).split('#')[0] : null);
    return {
      uid, preset: presetId,
      name: (presetId && (furnNames[presetId] || {}).name_ko) || presetId || uid,
      size: { ...g.userData.size },
      x: +g.position.x.toFixed(4), y: +g.position.y.toFixed(4), z: +g.position.z.toFixed(4),
      rot: +((g.rotation.y || 0) * 180 / Math.PI).toFixed(2),
      moved: !!localFurn[uid]
    };
  }

  function pickFurnitureAt(px, py) {
    const nodes = furnNodes();
    if (!nodes.length) return null;
    ray.setFromCamera(ndcOf(px, py), ctx.cam);
    const hits = ray.intersectObjects(nodes, true);
    for (const h of hits) {
      if (!h.object.isMesh || hiddenInScene(h.object)) continue;
      let o = h.object;
      while (o && !(o.userData && o.userData.uid)) o = o.parent;
      if (o) return furnInfo(o);
    }
    return null;
  }

  /* 회전 사각형 네 꼭짓점 — house.js 슬롯 변환과 같은 규약 */
  function rectCorners(r) {
    const c = Math.cos(r.rot), s = Math.sin(r.rot), hw = r.w / 2, hd = r.d / 2;
    return [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]]
      .map(([u, v]) => ({ x: r.x + u * c + v * s, z: r.z - u * s + v * c }));
  }
  /* 겹치나 — 분리축 정리(SAT). 회전 사각형 둘이면 축 네 개만 보면 된다.
     pad 가 음수면 그만큼은 스쳐도 봐 준다(가구끼리 딱 붙여 놓는 것을 막지 않는다). */
  function rectOverlap(a, b, pad = 0) {
    const A = rectCorners({ ...a, w: a.w + pad * 2, d: a.d + pad * 2 });
    const B = rectCorners(b);
    for (const r of [a, b]) {
      const c = Math.cos(r.rot), s = Math.sin(r.rot);
      for (const ax of [{ x: c, z: -s }, { x: s, z: c }]) {
        let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
        for (const p of A) { const t = p.x * ax.x + p.z * ax.z; a0 = Math.min(a0, t); a1 = Math.max(a1, t); }
        for (const p of B) { const t = p.x * ax.x + p.z * ax.z; b0 = Math.min(b0, t); b1 = Math.max(b1, t); }
        if (a1 <= b0 || b1 <= a0) return false;          // 이 축에서 갈렸다 = 안 겹친다
      }
    }
    return true;
  }

  /* 그 자리에 가구를 놓을 수 있나. 못 놓으면 **한국어 이유**를 준다. */
  function furnitureFit(uid, pos) {
    const g = furnNode(uid);
    if (!g) return { ok: false, reason: `못 옮기는 가구입니다: ${uid}` };
    if (!Number.isFinite(pos.x) || !Number.isFinite(pos.z))
      return { ok: false, reason: `좌표가 유한한 숫자가 아닙니다: (${pos.x}, ${pos.z})` };
    const sz = g.userData.size;
    const rot = (pos.rot == null ? (g.rotation.y || 0) * 180 / Math.PI : pos.rot) * Math.PI / 180;
    const me = { x: pos.x, z: pos.z, w: sz.w, d: sz.d, rot };
    /* ★★ 불변식: 가구는 **자기가 지금 있는 자리**를 반드시 통과한다.
       ------------------------------------------------------------
       방 데이터에는 원래부터 겹쳐 놓은 것들이 있다 — 소파 밑 러그, 침대에 밀어 넣은 의자,
       교탁에 붙인 사물함, 벽에 바짝 댄 옷장(벽 두께의 절반만큼 물린다).
       그걸 새 위반으로 세면 그 가구는 영영 못 움직인다. 현재 상태를 거절하는 판정은
       판정이 아니라 고장이다(추천 자리에서 똑같은 실수를 한 번 했다).
       ⇒ **지금도 겹쳐 있는 것은 장애물로 세지 않는다.**
       재서 확인: 이 규칙 없이는 투룸 2·아파트 4·학원교실 2·온실 4개가 제자리조차 거절당했다.
       ⚠ 대신 "이미 겹친 것 속으로 더 밀어 넣기"는 막지 못한다. 원래 그렇게 놓인 방이라
         새 규칙으로 되돌릴 수는 없다 — 막는 대신 **새로 생기는 겹침만** 막는다. */
    const cur = { x: g.position.x, z: g.position.z, w: sz.w, d: sz.d, rot: g.rotation.y || 0 };
    const already = r2 => rectOverlap(cur, r2, -0.01);
    /* 러그처럼 납작한 것은 무엇 밑으로든 들어간다(소파 밑 러그가 방 데이터의 기본 구성이다) */
    const flatMe = sz.h <= 0.05;

    const b = roomBox();
    for (const c of rectCorners(me))
      if (Math.abs(c.x) > b.w / 2 + 1e-4 || Math.abs(c.z) > b.d / 2 + 1e-4)
        return { ok: false, reason: '벽 밖으로 나갑니다' };
    if (!flatMe) for (const n of furnNodes()) {
      if (n === g) continue;                             // ★ 자기 자신은 장애물이 아니다
      const s2 = n.userData.size;
      if (!s2 || s2.h <= 0.05) continue;                 // 러그처럼 납작한 것 위로는 지나가도 된다
      /* 얹힌 것(클립등·바 등)은 furnNodes 에 없다 — 애초에 바닥 장애물이 아니다 */
      const r2 = { x: n.position.x, z: n.position.z, w: s2.w, d: s2.d, rot: n.rotation.y || 0 };
      if (already(r2)) continue;
      if (rectOverlap(me, r2, -0.01))
        return { ok: false, reason: `${furnInfo(n).name} 와(과) 겹칩니다` };
    }
    /* 창턱·칸막이 같은 붙박이는 colliders 로 본다 — 그 그룹은 원점에 있고 상자만 옮겨져
       있어서 position 으로 재면 틀린다(house.js sill 조립 참고). */
    for (const c of (built.colliders || [])) {
      if (c.kind === 'furn') continue;                   // 움직이는 가구는 위에서 이미 봤다
      const r2 = { x: c.x, z: c.z, w: c.w, d: c.d, rot: c.rot || 0 };
      if (already(r2)) continue;
      if (rectOverlap(me, r2, -0.01))
        return { ok: false, reason: c.kind === 'sill' ? '창턱과 겹칩니다' : '벽·칸막이와 겹칩니다' };
    }
    return { ok: true, reason: null };
  }

  function disposeFurnGhost() {
    if (!furnGhost) return;
    houseGroup.remove(furnGhost.group);
    furnGhost.group.traverse(o => { if (o.isLineSegments && o.geometry) o.geometry.dispose(); });
    disposeObject(furnGhost.group);
    furnGhost.mat.dispose(); furnGhost.line.dispose();
    furnGhost = null;
    needsRender = true;
  }

  /* 가구 유령 — 화분 유령과 같은 색·같은 값(decorate.js GH_OK/GH_NG).
     ★ uid 마다 **한 번만** 복제한다. 끄는 동안에는 위치·각도만 바꾼다. */
  function makeFurnGhost(g) {
    const gm = new THREE.MeshBasicMaterial({ color: GH_OK, transparent: true,
                                             opacity: 0.30, depthWrite: false });
    const gl = new THREE.LineBasicMaterial({ color: GH_OK, transparent: true, opacity: 0.9,
                                             depthTest: false });
    const c = g.clone(true);
    c.userData = { isPreview: true };
    const edges = [];
    c.traverse(o => {
      o.userData = { ...o.userData, uid: undefined, isPreview: true, sharedGeometry: true };
      if (!o.isMesh) return;
      o.castShadow = false; o.receiveShadow = false;
      o.material = gm;
      o.renderOrder = 997;
      if (o.geometry && o.geometry.attributes.position.count <= 900) edges.push(o);
    });
    for (const o of edges) {
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry), gl);
      e.renderOrder = 998;
      o.add(e);
    }
    houseGroup.add(c);
    return { uid: g.userData.uid, group: c, mat: gm, line: gl, ok: null };
  }

  /* uid 가 null 이면 지운다. 돌려주는 값의 ok 가 false 면 못 놓는 자리다(유령이 붉게 뜬다). */
  function previewFurnitureAt(uid, pos) {
    if (uid == null || !pos) { disposeFurnGhost(); return null; }
    const g = furnNode(uid);
    if (!g) throw new Error(`못 옮기는 가구입니다: ${uid}`);
    if (!furnGhost || furnGhost.uid !== uid) { disposeFurnGhost(); furnGhost = makeFurnGhost(g); }
    const rot = pos.rot == null ? (g.rotation.y || 0) * 180 / Math.PI : pos.rot;
    const y = pos.y == null ? g.position.y : pos.y;
    furnGhost.group.position.set(pos.x, y, pos.z);
    furnGhost.group.rotation.y = rot * Math.PI / 180;
    const fit = furnitureFit(uid, { x: pos.x, z: pos.z, rot });
    if (fit.ok !== furnGhost.ok) {
      furnGhost.ok = fit.ok;
      const hex = fit.ok ? GH_OK : GH_NG;
      furnGhost.mat.color.setHex(hex);
      furnGhost.line.color.setHex(hex);
    }
    needsRender = true;
    return { uid, x: pos.x, z: pos.z, rot, y, ok: fit.ok, reason: fit.reason };
  }

  /* 가구 좌표계의 상대 위치를 보존한 채 새 자리로 옮긴다 — **화분도 얹힌 기구도 이 한 식**을 쓴다.
     (house.js 규약: X = x0 + u·cos + v·sin · Z = z0 − u·sin + v·cos)
     from·to 의 rot 은 도(°) 다. 돌려주는 rotDeg 도 도, rotY 는 라디안 — 쓰는 쪽이 골라 쓴다. */
  function moveWithFurniture(p, from, to) {
    const fr = (from.rot || 0) * Math.PI / 180, tr = (to.rot || 0) * Math.PI / 180;
    const c = Math.cos(fr), s = Math.sin(fr);
    const dx = p.x - from.x, dz = p.z - from.z;
    const u = dx * c - dz * s, v = dx * s + dz * c;
    const c2 = Math.cos(tr), s2 = Math.sin(tr);
    const dy = (to.y == null ? from.y : to.y) - (from.y || 0);
    return {
      x: to.x + u * c2 + v * s2,
      z: to.z - u * s2 + v * c2,
      y: (p.y || 0) + dy,
      rotDeg: (p.rotDeg || 0) + ((to.rot || 0) - (from.rot || 0)),
      rotY: (p.rotY || 0) + (tr - fr)
    };
  }
  /* 화분 자리(at) 판 */
  function followFurniture(at, from, to) {
    const m = moveWithFurniture({ x: at.x, y: at.y, z: at.z, rotY: at.rotY || 0 }, from, to);
    return { ...at, x: m.x, y: m.y, z: m.z, rotY: m.rotY };
  }

  /* 방을 다시 짓고 화분을 되돌린다. ★ 여기가 유일한 재조립 통로다. */
  async function rebuildRoom(opt = {}) {
    /* 화분을 먼저 적어 둔다 — assemble 이 방을 비우면서 다 치운다 */
    const snap = [...plants].map(([key, p]) => ({
      key, potId: p.potId || potIdOfKey(key), spec: { ...p.spec },
      at: p.at ? { ...p.at } : null, yaw: p.group.rotation.y || 0, free: isFreeSlotId(key)
    }));
    await assemble(roomId, { prebuilt: opt.prebuilt });
    const moved = opt.moved || null;
    for (const p of snap) {
      try {
        if (!p.free && slotById.has(p.key)) {   // ① 추천 자리 — 가구를 따라간다
          plantYaw.set(p.key, p.yaw);
          await setPlant(p.key, p.spec);
          continue;
        }
        let at = p.at;
        if (at && moved && at.onUid === moved.uid) at = followFurniture(at, moved.from, moved.to);
        const gone = at && at.onUid && !hasFurnUid(at.onUid);
        const outside = at && !inRoom(at, built.size);
        if (!at || gone || outside) {           // ④ 회수
          const dest = [...slotById.values()].find(s => !slotOccupied(s.slotId));
          if (!dest) { console.warn(`[방뷰] ${p.key}: 되돌릴 자리가 없어 화분을 못 세웠습니다`); continue; }
          console.warn(`[방뷰] ${p.key}: ${gone ? '받치던 가구가 사라져' : outside ? '자리가 방 밖이라' : '좌표가 없어'} ` +
                       `${dest.slotId} 로 회수했습니다`);
          plantYaw.set(dest.slotId, p.yaw);
          await setPlant(dest.slotId, p.spec);
          continue;
        }
        await setPlantAt(p.potId, at, p.spec);  // ②③ 좌표 그대로(또는 가구를 따라간 좌표)
      } catch (e) {
        console.warn(`[방뷰] ${p.key} 를 다시 못 세웠습니다: ${e.message}`);
      }
    }
    /* 옮긴 가구가 바닥 화분을 덮쳤나 — 옮기지는 않고 알리기만 한다(위 규칙 ③) */
    if (moved) for (const [k, p] of plants) {
      if (!p.at || p.at.onUid) continue;
      if (nav.blocked(p.at.x, p.at.z, (p.potD || MONSTERA_POT_D) / 2))
        console.warn(`[방뷰] 옮긴 가구가 바닥 화분 ${k} 자리를 덮었습니다 — 화분은 그대로 두었습니다`);
    }
    return snap.length;
  }

  /* 손을 뗄 때 한 번만 부른다. 방을 다시 조립하고 3D 를 갱신한다. */
  async function commitFurnitureAt(uid, pos) {
    if (!built) throw new Error('방이 아직 없습니다');
    const g = furnNode(uid);
    if (!g) throw new Error(`못 옮기는 가구입니다: ${uid}`);
    const rot = pos.rot == null ? (g.rotation.y || 0) * 180 / Math.PI : pos.rot;
    const fit = furnitureFit(uid, { x: pos.x, z: pos.z, rot });
    if (!fit.ok) throw new Error(`가구를 못 놓습니다 — ${fit.reason}`);
    const from = { x: g.position.x, z: g.position.z, y: g.position.y,
                   rot: +((g.rotation.y || 0) * 180 / Math.PI).toFixed(4) };
    const to = { x: pos.x, z: pos.z, rot, y: pos.y == null ? from.y : pos.y };
    disposeFurnGhost();

    /* ★ 얹힌 기구도 같이 간다 — 책상에 물린 클립등이 제자리에 남으면 등만 허공에 뜬다.
       ⚠ 등이 움직이면 그 자리 PPFD 가 바뀐다. 그래서 화면만 옮기지 않고 **조립 정의(def)를**
         고쳐서 방을 다시 짓는다 — buildHouse 가 lightRigs 를 그 정의로 다시 만들므로
         조도 계산(ppfdSum)과 화면이 같은 자리의 같은 등을 본다. 둘이 갈릴 틈이 없다. */
    const moves = { [uid]: { x: to.x, z: to.z, rot: to.rot } };
    const riders = [];
    for (const n of ridersOf(g)) {
      const m = moveWithFurniture(
        { x: n.position.x, y: n.position.y, z: n.position.z,
          rotDeg: (n.rotation.y || 0) * 180 / Math.PI }, from, to);
      moves[n.userData.uid] = { x: +m.x.toFixed(4), z: +m.z.toFixed(4),
                                rot: +m.rotDeg.toFixed(4), y: +m.y.toFixed(4) };
      riders.push(n.userData.uid);
    }

    let prebuilt = null;
    if (O.lightEngine && typeof O.lightEngine.setFurnitureOverrides === 'function'
        && typeof O.lightEngine.furnitureOverrides === 'function') {
      /* ★ 조도 엔진이 방을 다시 짓는다. 그 결과를 그대로 그린다 —
         여기서 또 지으면 buildHouse 가 한 번에 두 번 돈다.
         ★★ 얹힌 것까지 **한 번에** 얹는다. moveFurniture 를 개수만큼 부르면 그만큼 재조립한다. */
      const merged = { ...O.lightEngine.furnitureOverrides(), ...moves };
      O.lightEngine.setFurnitureOverrides(merged);
      const r = O.lightEngine.room;
      if (r) prebuilt = { built: r.built, def: r.def, wins: r.wins };
    } else if (O.lightEngine && typeof O.lightEngine.moveFurniture === 'function') {
      const r = O.lightEngine.moveFurniture(uid, { x: to.x, z: to.z, rot: to.rot });
      if (r && r.room) prebuilt = { built: r.room.built, def: r.room.def, wins: r.room.wins };
    } else {
      Object.assign(localFurn, moves);
    }
    await rebuildRoom({ prebuilt, moved: { uid, from, to } });
    return { uid, from, to, riders };
  }

  /* ============================================================
     ⑨ 캐릭터와 마스코트
     ------------------------------------------------------------
     ★ 지침은 전부 assets/characters/README.md · docs/handoff/char-to-house.md 에서 온다.
       여기서 새로 정한 것은 **어디에 세울지** 하나뿐이다.

       크기   GLB 에 이미 구워져 있다 — 엔진에서 추가 스케일 **금지**.
              자취녀 1.40m · 몬이 0.375m(고정, 키에 연동 안 함)
       메시   lq/ 를 쓴다. 원본은 평균 22.5만 삼각형이라 방과 같이 돌리면 버벅인다
              (char 창 확정). idle 파일 하나에 메시+동작이 다 들어 있어 리깅본을 따로 안 받는다
       컬링   frustumCulled=false. 스킨드 메시는 노드 변환이 invBind 에 baked 되어
              three 가 0.017m 상자로 판정한다 — 카메라를 붙이면 통째로 사라진다
       방향   기본이 뒷모습이다. rotation.y 로 돌린다
       변주   char-to-house.md 의 IDLE_BREAK 배정표·재생 코드를 그대로 쓴다
       루트   변주 클립은 루트가 Hips 높이 대비 최대 42% 움직인다 — 걷기와 같이 XZ 를 고정한다
  ============================================================ */
  const CHAR_MESH = '../../assets/characters/3d/lq';
  const CHAR_ANIM = '../../assets/characters/3d/anim';

  /* 첫 플레이는 자취생 고정이다(직업 선택은 초보 엔딩 뒤 — docs/story_arc.md).
     'jachwi' 는 게임이 부르는 이름이고, 뒤의 것이 에셋 id 다. */
  const CHAR_ASSET = { jachwi: 'jachwi_f', jachwi_f: 'jachwi_f', namja_jachwi: 'namja_jachwi' };

  /* 캐릭터별 성격 = 기본 idle 공용 + 간헐 변주 (박사님 확정 ㉮안, 2026-08-01)
     ★ char-to-house.md 배정표 그대로. 새 모션 생성 0건 · 크레딧 0. */
  const IDLE_BREAK = {
    namja_jachwi: ['scratch'], jachwi_f: ['scratch'],
    namja_gajang: ['listen'], yeoja_gajang: ['listen'],
    namja_jubu: ['pickup', 'harvest'], yeoja_jubu: ['pickup', 'harvest'],
    namja_researcher: ['opendoor'], yeoja_researcher: ['opendoor']
  };

  /* 몬이 추적 파라미터 — char-to-house.md 그대로 */
  const MON = { floatHeight: 0.221, bobAmplitude: 0.103, bobPeriod_sec: 2.5,
                followDistance: 0.774, followDamping: 4.1, tiltDegrees: 4.0 };

  /* 사람이 차지하는 반지름[m]. 3.5등신 치비라 어깨가 넓다 — 0.30 으로 두면
     벽에 붙었을 때 팔이 벽에 묻힌다(실제로 묻혔다). */
  const BODY_R = 0.38;

  /* ★★ 캐릭터의 '앞'은 로컬 **+Z** 다 — 짐작이 아니라 재서 확인했다.
     ------------------------------------------------------------
     char-to-house.md 는 "캐릭터는 기본 방향이 뒷모습입니다 · model.rotation.y = Math.PI"
     라고 적어 두었고, 여기 걷기·서기가 그 말을 믿고 π 를 더하고 있었다.
     그런데 lq/char_*_idle.glb 를 실제로 재 보면 (model.rotation 은 0 인 상태에서)
       발끝 방향(LeftFoot → LeftToeBase)  자취녀 (x 0.000, z +0.068) · 자취남 (x 0.000, z +0.068)
     즉 **발끝이 +Z 를 가리킨다**. 사람은 발끝 쪽으로 걷는다 — 그러니 앞은 +Z 다.
     render3d/character.js 도 π 없이 atan2(d.x, d.z) 를 쓴다(그쪽이 맞았다).
     여기 있던 +π 하나 때문에 방 뷰에서만 캐릭터가 **뒷걸음질**로 갔다.

       yaw = atan2(가고 싶은 dx, dz)    ← π 를 더하지 않는다
     ⚠ 이 규칙을 다시 뒤집고 싶으면 먼저 재십시오(도구: 발끝 벡터 한 줄이면 된다). */
  const yawTo = (dx, dz) => Math.atan2(dx, dz);

  /* 몸을 돌리는 속도[1/s]. 홱 돌면 인형이 튀는 것처럼 보인다 — 몇 프레임에 걸쳐 돈다.
     9 면 180° 반대편으로 돌아서는 데 0.4초쯤 걸린다. */
  const TURN_RATE = 9;

  /* ★ 서 있을 때·도착했을 때 어디를 보나 — **카메라(플레이어) 쪽**이다.
     ------------------------------------------------------------
     고른 두 후보는 '마지막 진행 방향'과 '카메라 쪽'이었다. 카메라 쪽을 골랐다.
       · 마지막 진행 방향은 사람이 고른 방향이 아니다. 경로의 마지막 한 칸은 가구를
         돌아 나오는 옆걸음인 경우가 많아서, 도착하면 30cm 앞의 벽을 보고 서게 된다
         (반지하처럼 좁은 방일수록 자주 그렇다).
       · 플레이어가 "여기로 가"라고 시켜서 간 것이다. 도착해서 플레이어를 보고 서면
         "다 왔습니다"가 되고, 다음 지시를 기다리는 자세로 읽힌다.
       · 카메라는 늘 방 **밖에서 안을** 본다. 그래서 카메라 쪽 = 방 안쪽이기도 하다.
         원래 자리 잡기(standSpot)가 "가운데 바닥을 비우고 벽을 등진다"로 노리던 그림과 같다.
     ⚠ 계속 따라 보게 하지는 않는다. 도착한 그 순간의 카메라 방향으로 한 번 돌아설 뿐이다 —
       시점을 돌릴 때마다 고개가 따라오면 인형이 노려보는 것처럼 된다. */
  function faceCameraYaw(x, z) {
    return yawTo(ctx.cam.position.x - x, ctx.cam.position.z - z);
  }

  /* 벽·가구 판정은 floor_nav 한 벌만 쓴다 — 여기와 걷기가 다른 식을 쓰면
     "설 수는 있는데 걸어갈 수는 없는 자리"가 생긴다. */
  const blockedAt = (x, z, r) => nav.blocked(x, z, r);

  /* ★ 어디에 세울까 — 이 파일이 새로 정하는 유일한 것.
     ------------------------------------------------------------
     "가구·화분·통행을 가리면 안 된다. 주인공은 방과 식물이다."
     그래서 방 한가운데가 아니라 **벽을 등지고 창을 보는** 자리를 고른다.
       ① 가구·벽에서 몸 반지름만큼 떨어져 설 수 있는 칸만 후보
       ② 화분 자리에서 멀수록 좋다(화분을 가리지 않는다)
       ③ 벽에 가까울수록 좋다(가운데 바닥을 비워 둔다)
       ④ 창에서 멀수록 좋다(창턱 화분 앞을 막지 않는다) */
  function standSpot() {
    const b = roomBox(), STEP = 0.20, EDGE = 0.34;
    const win = (built.luxWins || []).filter(w => w.wall && w.wall !== 'ceiling');
    let wx = 0, wz = -b.d / 2;                       // 창의 대략 위치(없으면 뒤벽)
    if (win.length) {
      let big = win[0], area = 0;
      for (const w of win) { const a = (w.w || 0) * (w.h || 0); if (a > area) { area = a; big = w; } }
      if (big.wall === 'back') { wx = big.cu || 0; wz = -b.d / 2; }
      else if (big.wall === 'front') { wx = big.cu || 0; wz = b.d / 2; }
      else if (big.wall === 'left') { wx = -b.w / 2; wz = big.cu || 0; }
      else { wx = b.w / 2; wz = big.cu || 0; }
    }
    const slots = [...slotById.values()];
    let best = null, bestScore = -Infinity;
    for (let x = -b.w / 2 + EDGE; x <= b.w / 2 - EDGE; x += STEP)
      for (let z = -b.d / 2 + EDGE; z <= b.d / 2 - EDGE; z += STEP) {
        if (blockedAt(x, z, BODY_R)) continue;
        let dSlot = Infinity;
        for (const s of slots) dSlot = Math.min(dSlot, Math.hypot(s.x - x, s.z - z));
        if (dSlot < 0.55) continue;                             // 화분 코앞에는 안 선다
        const dWall = Math.min(b.w / 2 - Math.abs(x), b.d / 2 - Math.abs(z));
        const dWin = Math.hypot(wx - x, wz - z);
        const score = Math.min(dSlot, 2.0) * 1.0 + Math.min(dWin, 3.0) * 0.55 - dWall * 0.9;
        if (score > bestScore) { bestScore = score; best = { x, z, wx, wz }; }
      }
    return best || { x: 0, z: 0, wx, wz };
  }

  const charLoad = url => new Promise((res, rej) =>
    new THREE.GLTFLoader().load(AT(url), res, undefined, () => rej(new Error(`캐릭터 GLB 실패: ${url}`))));

  /* ============================================================
     고르기 표시 · 클릭 판정 — src/main.js 「선택 & 상호작용」 그대로
     ------------------------------------------------------------
     ★ 새로 만든 게 아니다. main.js 가 이미 쓰던 발밑 주황 링(0xffb454 · 0.26~0.34
       · depthTest:false · renderOrder 998)과 보이지 않는 픽 상자를 그대로 옮겼다.
       두 화면이 다르게 생기면 플레이어가 다른 조작으로 오해한다.

     픽 상자가 왜 필요한가 (main.js 주석 그대로)
       스킨드 메시는 정점이 뼈 행렬로 움직이는데 three 의 레이캐스트는 바인드 포즈와
       메시 노드 행렬만 본다 → 캐릭터를 클릭해도 안 맞는다(실제로 안 맞았다).
  ============================================================ */
  function makeSelectRing(r0, r1) {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(r0, r1, 26),
      new THREE.MeshBasicMaterial({ color: 0xffb454, transparent: true, opacity: 0.9,
                                    side: THREE.DoubleSide, depthTest: false }));
    m.rotation.x = -Math.PI / 2;
    m.renderOrder = 998;
    m.visible = false;
    return m;
  }
  function makePickBox(w, h, d, y) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
                             new THREE.MeshBasicMaterial({ visible: false }));
    b.position.y = y;
    b.userData.isCharacterPick = true;
    return b;
  }

  /* ── 걷는 클립 ──
     ★ lq/char_*_walking.glb 는 2.4MB 다. 메시를 통째로 다시 담고 있기 때문인데,
       메시는 idle 을 실을 때 이미 받았다. 같은 것을 두 번 받을 이유가 없다.
       assets/derived/char_clips/ 에 **클립만 뽑아 둔 35KB 짜리**가 있다
       (render3d/character.js 가 쓰는 그것). 68배 가볍고 뼈 이름으로 붙으므로
       경량 메시에도 그대로 물린다. 없으면 그때만 원본으로 내려간다. */
  const CHAR_CLIPS = '../../assets/derived/char_clips';
  const _walkClip = new Map();
  async function walkClipOf(id) {
    if (_walkClip.has(id)) return _walkClip.get(id);
    const p = (async () => {
      for (const url of [`${CHAR_CLIPS}/char_${id}_walking.glb`, `${CHAR_MESH}/char_${id}_walking.glb`]) {
        try {
          const g = await charLoad(url);
          const c = (g.animations || [])[0];
          if (c) { c.name = 'walking'; return c; }
        } catch (e) { /* 다음 후보로 */ }
      }
      throw new Error(`걷기 클립이 없습니다: ${id} — tools/char/strip_anim_glb.py 를 돌렸나?`);
    })();
    _walkClip.set(id, p);
    return p;
  }

  async function makePerson(gameId) {
    const id = CHAR_ASSET[gameId] || 'jachwi_f';
    /* idle 파일 하나에 메시와 동작이 다 들어 있다 — 리깅본을 따로 안 받는다(char 창 §3) */
    const g = await charLoad(`${CHAR_MESH}/char_${id}_idle.glb`);
    const model = g.scene;
    /* ★ 크기는 절대 안 건드린다. GLB 에 1.40m 가 구워져 있다(README §1).
       여기서 다시 정규화하면 그 위에 곱해져 1.36m 같은 값이 된다. */
    model.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = true;
      o.frustumCulled = false;                       // 스킨드 메시 컬링 오류 — 지우지 말 것
      if (o.material && o.material.map) o.material.map.encoding = THREE.sRGBEncoding;
    });

    const root = new THREE.Group();
    root.add(model);
    const spot = standSpot();
    root.position.set(spot.x, 0, spot.z);
    /* 처음 서는 방향도 도착했을 때와 같은 규칙을 쓴다 — 카메라(플레이어) 쪽.
       ★ 예전에는 '창 쪽을 보되 방 안으로 조금 튼' 각에 π 를 더했는데, +Z 가 앞이라
         그 π 때문에 실제로는 **창을 등지고** 서 있었다. 규칙이 두 벌이면 반드시 어긋난다 —
         한 벌로 합쳤다. (standSpot 이 창에서 멀리 세우는 것은 그대로다. 그건 자리 얘기지
          방향 얘기가 아니다.) */
    root.rotation.y = faceCameraYaw(spot.x, spot.z);

    /* 고르기 링 · 픽 상자 (main.js 와 같은 값) */
    const ring = makeSelectRing(0.26, 0.34);
    ring.position.y = 0.02;
    root.add(ring);
    const pick = makePickBox(0.62, 1.55, 0.62, 0.78);
    root.add(pick);

    houseGroup.add(root);

    const mixer = new THREE.AnimationMixer(model);
    const idleClip = (g.animations || [])[0];
    if (!idleClip) throw new Error(`idle 클립이 없습니다: char_${id}_idle.glb`);
    idleClip.name = 'idle';
    const base = mixer.clipAction(idleClip);
    base.play();

    /* ★ 루트 고정 — 변주 클립은 루트가 Hips 높이 대비 최대 42% 움직인다.
       걷기와 같이 Hips 의 XZ 를 매 프레임 되돌린다(char-to-house.md). */
    let hips = null;
    model.traverse(o => { if (!hips && /hips/i.test(o.name || '')) hips = o; });
    const hips0 = hips ? [hips.position.x, hips.position.z] : null;

    /* 이 사람이 아직 방에 있나. 치운 뒤에 늦게 도착한 GLB·타이머가
       사라진 캐릭터를 다시 세우지 않게 하는 표시다. */
    let alive = true, timer = 0;

    /* ── 걷기 ──
       ★ 클립은 처음 걸을 때 싣는다. 방이 뜨는 데 필요한 것이 아니다 —
         부팅에 얹으면 첫 화면이 그만큼 늦어진다(35KB 라도 요청 하나는 요청 하나다). */
    let walkAct = null, walking = false;
    let path = [], pathI = 0, stuck = 0;
    const goal = new THREE.Vector3();
    let arriveAt = 0;                 // 도착한 시각 — 비켜서기 유예에 쓴다
    let manualUntil = 0;              // 이때까지는 자동으로 안 비켜선다(플레이어가 보낸 자리다)
    let settleYaw = null;             // 도착한 뒤 돌아설 각. 다 돌면 null 로 내린다

    /* 목표 각으로 조금 돌린다. 돌고 남은 각[rad]을 돌려준다(부호 있음).
       ★ 한 프레임에 다 돌리지 않는다 — 인형이 튀는 것처럼 보인다. */
    function turnToward(y, dt) {
      let diff = y - root.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const k = Math.min(1, dt * TURN_RATE);
      root.rotation.y += diff * k;
      return diff * (1 - k);
    }

    async function ensureWalkClip() {
      if (walkAct) return walkAct;
      const cl = await walkClipOf(id);
      if (!alive) return null;
      walkAct = mixer.clipAction(cl);
      walkAct.setLoop(THREE.LoopRepeat, Infinity);
      return walkAct;
    }
    function playWalk() {
      if (!walkAct || walking) return;
      walking = true;
      walkAct.reset(); walkAct.enabled = true; walkAct.setEffectiveWeight(1);
      walkAct.crossFadeFrom(base, 0.22, false).play();
    }
    function playIdle() {
      if (!walking) return;
      walking = false;
      base.reset().crossFadeFrom(walkAct, 0.24, false).play();
    }

    /* 바닥 (x,z) 로 걸어간다. 갈 수 있는 데까지만 간다(막힌 주머니면 최대한 다가간다). */
    function goTo(x, z, opt2 = {}) {
      const p = nav.nearestFree(x, z);
      stats.navPaths++;
      path = nav.path(root.position.x, root.position.z, p.x, p.z);
      pathI = 0; stuck = 0; settleYaw = null;
      if (!path.length) { playIdle(); return { ok: false, x: p.x, z: p.z, reason: '갈 수 없는 자리입니다' }; }
      goal.set(path[0].x, 0, path[0].z);
      if (opt2.manual) manualUntil = performance.now() + 8000;
      /* 클립을 아직 안 실었으면 실으면서 걷는다 — 다 실릴 때까지 idle 로 미끄러지느니
         조금 늦게 다리가 움직이는 게 낫다(멈춰 서 있는 것보다 훨씬 덜 이상하다). */
      ensureWalkClip().then(() => { if (alive && path.length) playWalk(); })
        .catch(e => console.warn('[방뷰] 걷기 클립을 못 실었습니다 — 미끄러지듯 이동합니다:', e.message));
      needsRender = true;
      const last = path[path.length - 1];
      return { ok: true, x: last.x, z: last.z, steps: path.length };
    }

    /* idle 을 돌리다 8~20초마다 변주를 한 번 끼운다. 끝자세=시작자세인 클립만
       배정표에 들어 있어 crossfade 0.3s 면 안 튄다.
       ★ 걷는 동안은 끼우지 않는다 — 걸어가다 갑자기 머리를 긁으면 다리가 멈춘다. */
    const pool = IDLE_BREAK[id] || [];
    const clips = {};
    function schedule() {
      if (!alive || !pool.length) return;
      timer = setTimeout(async () => {
        if (!alive) return;
        if (walking) { schedule(); return; }
        const name = pool[(Math.random() * pool.length) | 0];
        try {
          if (!clips[name]) {
            const c = await charLoad(`${CHAR_ANIM}/char_${id}_${name}.glb`);
            const cl = (c.animations || [])[0];
            if (!cl) throw new Error('클립 없음');
            cl.name = name; clips[name] = cl;
          }
          if (!alive || walking) { schedule(); return; }
          const a = mixer.clipAction(clips[name]);
          a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = false;
          a.reset().crossFadeFrom(base, 0.3, false).play();
          mixer.addEventListener('finished', function done(e) {
            if (e.action !== a) return;
            mixer.removeEventListener('finished', done);
            base.reset().crossFadeFrom(a, 0.3, false).play();
          });
        } catch (e) {
          console.warn(`[방뷰] idle 변주 '${name}' 을 못 실었습니다 — 기본 idle 만 돕니다:`, e.message);
        }
        schedule();
      }, 8000 + Math.random() * 12000);
    }
    schedule();

    return {
      kind: 'person', assetId: id, root, walkable: true,
      get pickTarget() { return pick; },
      get selected() { return ring.visible; },
      setSelected(v) { ring.visible = !!v; needsRender = true; },
      get walking() { return path.length > 0; },
      get idleSince() { return path.length ? 0 : performance.now() - arriveAt; },
      get manualHold() { return performance.now() < manualUntil; },
      goTo,
      /* 걷기 클립을 미리 실어 둔다. 고를 때 부른다 — 첫 걸음에서 GLB 를 받고 뼈에
         물리느라 한 번 걸리던 것을 없앤다(폰에서 눈에 띈다). */
      warmWalk() { return ensureWalkClip().catch(() => null); },
      stop() {
        path = []; pathI = 0; playIdle();
        settleYaw = faceCameraYaw(root.position.x, root.position.z);
        needsRender = true;
      },
      update(dt) {
        mixer.update(dt);
        /* ★ Hips XZ 고정 — 변주 클립은 루트가 Hips 높이 대비 최대 42% 움직인다.
           안 잡으면 캐릭터가 제자리에서 미끄러지거나 방 밖으로 걸어 나간다
           (char-to-house.md §4). 실제 이동은 아래에서 root 를 움직여서 한다.
           (파생 걷기 클립 자체는 제자리 모션이라 걷기에는 이 고정이 필요 없지만,
            변주 클립 때문에 어차피 있어야 한다 — 재서 확인했다) */
        if (hips && hips0) { hips.position.x = hips0[0]; hips.position.z = hips0[1]; }

        if (!path.length) {
          /* 도착한 뒤 돌아서는 중 */
          if (settleYaw != null) {
            const rest = turnToward(settleYaw, dt);
            if (Math.abs(rest) < 0.01) { root.rotation.y = settleYaw; settleYaw = null; }
            needsRender = true;
          }
          return;
        }

        const dx = goal.x - root.position.x, dz = goal.z - root.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist < ARRIVE_EPS) {
          if (pathI < path.length - 1) { pathI++; goal.set(path[pathI].x, 0, path[pathI].z); return; }
          path = []; pathI = 0; arriveAt = performance.now();
          settleYaw = faceCameraYaw(root.position.x, root.position.z);   // 플레이어를 보고 선다
          playIdle();
          needsRender = true;
          return;
        }

        /* ★ 먼저 몸을 돌리고, **돌아선 만큼만** 나아간다.
           걷기 클립은 앞으로 걷는 동작이다. 몸이 덜 돌았는데 그대로 밀면 게걸음·
           뒷걸음질로 보인다 — 뒤로 보내면 특히 그렇다. cos 을 곱하면 반대편으로
           보냈을 때 그 자리에서 돌아선 다음 걸어 나간다(0.4초쯤). */
        const rest = turnToward(yawTo(dx, dz), dt);
        const align = Math.max(0, Math.cos(rest));
        const step = Math.min(WALK_SPEED * dt * align, dist);

        if (step > 1e-5) {
          const nx = root.position.x + (dx / dist) * step;
          const nz = root.position.z + (dz / dist) * step;
          const fixed = nav.pushOut(nx, nz);          // 벽에 걸리면 따라 미끄러진다
          const moved = Math.hypot(fixed.x - root.position.x, fixed.z - root.position.z);
          root.position.x = fixed.x; root.position.z = fixed.z;

          /* 거의 못 움직였으면(구석에 낀 것) 다음 웨이포인트로 건너뛰고, 그래도 안 되면 포기.
             포기를 안 넣으면 벽에 붙어 영원히 걷는 시늉을 한다(실제로 그랬다). */
          if (moved < step * 0.12) {
            stuck += dt;
            if (stuck > 0.35) {
              stuck = 0;
              if (pathI < path.length - 1) { pathI++; goal.set(path[pathI].x, 0, path[pathI].z); }
              else {
                path = []; pathI = 0; arriveAt = performance.now();
                settleYaw = faceCameraYaw(root.position.x, root.position.z);
                playIdle();
              }
            }
          } else stuck = 0;
        }
        needsRender = true;
      },
      dispose() {
        alive = false; clearTimeout(timer);
        mixer.stopAllAction();
        houseGroup.remove(root);
        disposeObject(root);
      }
    };
  }

  async function makeMascot() {
    const g = await charLoad(`${CHAR_MESH}/char_mascot_sprout.glb`);
    const model = g.scene;
    /* 몬이도 0.375m 가 GLB 에 구워져 있다. 리깅이 없어 트랜스폼만 움직인다. */
    /* ★몬이 채도를 한 눈금 낮춘다 (2026-08-03).
       방은 벽·가구를 0.62/0.78 로 눌러 뒀는데(게임 조명 정책) 몬이만 원본 채도라
       혼자 스티커처럼 떠 보였다. 재질을 **제 것으로 만든 뒤** 회색과 섞는다 —
       공유 재질을 제자리에서 고치면 같은 GLB 를 쓰는 다른 것까지 같이 바랜다.
       ⚠ 밝기가 아니라 채도만 낮춘다. 어둡게 하면 마스코트가 안 보인다.
       되돌리려면 MONI_SAT 만 1 로 두면 된다. */
    const MONI_SAT = 0.78;
    model.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
      if (o.material) {
        o.material = Array.isArray(o.material) ? o.material.map(m => m.clone()) : o.material.clone();
        for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
          if (m.map) m.map.encoding = THREE.sRGBEncoding;
          if (m.color) {
            const hsl = m.color.getHSL({ h: 0, s: 0, l: 0 });
            m.color.setHSL(hsl.h, hsl.s * MONI_SAT, hsl.l);
          }
        }
      }
    });
    const root = new THREE.Group();
    root.add(model);
    /* 몬이도 눌러서 고를 수 있다. 다만 **따로 보낼 수는 없다** — 사람을 따라다니는 게
       몬이의 규칙이라(char-to-house.md 추적 파라미터) 목적지를 주면 다음 프레임에
       바로 되돌아온다. 그래서 walkable 은 false 고 링만 뜬다. */
    const ring = makeSelectRing(0.11, 0.15);
    ring.position.y = -MON.floatHeight + 0.02;      // 몬이 root 는 공중이라 바닥까지 내린다
    root.add(ring);
    /* 몬이는 0.375m 짜리가 root(공중 0.221m) 위에 서 있다 — 상자도 그만큼 올린다 */
    const pick = makePickBox(0.34, 0.42, 0.34, 0.19);
    root.add(pick);
    houseGroup.add(root);

    /* 어디에 뜨나 — 사람이 있으면 그 뒤를 졸졸, 없으면 화분 옆.
       ★ 가구·화분을 가리지 않게 화분에서 한 뼘 옆으로 비켜 세운다. */
    function homeXZ() {
      const person = chars.get('jachwi');
      if (person) {
        const r = person.root;
        return { x: r.position.x - Math.sin(r.rotation.y) * MON.followDistance,
                 z: r.position.z - Math.cos(r.rotation.y) * MON.followDistance };
      }
      const p = [...plants.values()][0];
      if (p) {
        const a = Math.atan2(p.group.position.x, p.group.position.z);
        return { x: p.group.position.x + Math.cos(a) * 0.34, z: p.group.position.z - Math.sin(a) * 0.34 };
      }
      const s = standSpot();
      return { x: s.x, z: s.z };
    }
    const h = homeXZ();
    root.position.set(h.x, MON.floatHeight, h.z);
    let t = 0;
    const pos = new THREE.Vector3(h.x, MON.floatHeight, h.z);

    return {
      kind: 'mascot', assetId: 'mascot_sprout', root, walkable: false,
      get pickTarget() { return pick; },
      get selected() { return ring.visible; },
      setSelected(v) { ring.visible = !!v; needsRender = true; },
      get walking() { return false; },
      get idleSince() { return Infinity; },
      get manualHold() { return false; },
      stop() { },
      update(dt) {
        t += dt;
        const g2 = homeXZ();
        /* 수평 추적은 프레임레이트 무관하게(char-to-house.md) */
        pos.lerp(new THREE.Vector3(g2.x, MON.floatHeight, g2.z), 1 - Math.exp(-MON.followDamping * dt));
        root.position.x = pos.x; root.position.z = pos.z;
        root.position.y = MON.floatHeight + Math.sin(t * Math.PI * 2 / MON.bobPeriod_sec) * MON.bobAmplitude;
        root.rotation.z = Math.sin(t * Math.PI * 2 / MON.bobPeriod_sec) * (MON.tiltDegrees * Math.PI / 180);
        root.rotation.y += (Math.PI - root.rotation.y) * Math.min(1, dt * 2);
        /* 링은 바닥에 있어야 한다 — root 가 위아래로 흔들리므로 그만큼 되돌린다.
           (안 하면 링이 몬이를 따라 공중에서 같이 출렁인다) */
        ring.position.y = -root.position.y + 0.02;
      },
      dispose() { houseGroup.remove(root); disposeObject(root); }
    };
  }

  /* ============================================================
     ⑨-b 캐릭터를 눌러 고르고 걸어 보내기
     ------------------------------------------------------------
     ★ 조작 사상은 두 곳에서 그대로 가져왔다. 새로 정한 규칙은 없다.
       · src/main.js 「선택 & 상호작용」  — "캐릭터 클릭 → 선택(주황 링).
         그 뒤 바닥 클릭하면 걸어간다"
       · game.html 의 화분 조작        — 고른 뒤 **화면 아무 데나 끌면** 상대값으로
         움직이고 손을 떼면 간다. 캐릭터가 작아 정확히 짚을 수 없기 때문에
         화분에서 쓴 그 방법이 여기서는 더 필요하다.

     ★★ 카메라와 안 부딪치게 하는 규칙 (제일 중요하다)
       고르기 **전**에 끌면 카메라가 돈다. 고른 **뒤**에만 끌기가 걷기로 읽힌다.
       이 한 줄이 안 지켜지면 방을 둘러보려던 손짓이 캐릭터를 엉뚱한 데로 보낸다.
  ============================================================ */
  const GHOST_H = 1.40;                 // 자취녀 키. 미리보기 기둥 높이

  function disposeWalkGhost() {
    if (!walkGhost) return;
    houseGroup.remove(walkGhost.mesh); houseGroup.remove(walkGhost.ring);
    walkGhost.mesh.geometry.dispose(); walkGhost.mesh.material.dispose();
    walkGhost.ring.geometry.dispose(); walkGhost.ring.material.dispose();
    walkGhost = null;
    needsRender = true;
  }

  /* 갈 자리 미리보기 — 반투명 기둥 + 바닥 링.
     ★ 캐릭터를 복제해 띄우지 않는다. 스킨드 메시 복제는 뼈까지 따라오고, 끄는 내내
       매 프레임 복제하면 폰이 그 자리에서 멈춘다. 사람 크기의 기둥이면 "여기 서 있게
       된다"는 뜻은 다 전해진다.
     색은 decorate.js·previewMove 와 같다 — 파랑=갈 수 있다 · 빨강=못 간다. */
  function ensureWalkGhost() {
    if (walkGhost) return walkGhost;
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(BODY_R * 0.72, BODY_R * 0.72, GHOST_H, 18, 1, true),
      new THREE.MeshBasicMaterial({ color: GH_OK, transparent: true, opacity: 0.22,
                                    side: THREE.DoubleSide, depthWrite: false }));
    mesh.renderOrder = 997;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(BODY_R * 0.72, BODY_R * 0.92, 28),
      new THREE.MeshBasicMaterial({ color: GH_OK, transparent: true, opacity: 0.85,
                                    side: THREE.DoubleSide, depthTest: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.renderOrder = 999;
    houseGroup.add(mesh); houseGroup.add(ring);
    walkGhost = { mesh, ring, ok: null };
    return walkGhost;
  }

  /* 화면 좌표(뷰포트 기준 — pointer 이벤트의 clientX/clientY 그대로) → 바닥 위 한 점.
     ★ 슬롯이 아니다. 바닥 어디든 찍을 수 있다. */
  const _floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const _floorHit = new THREE.Vector3();
  function floorAt(cx, cy) {
    ray.setFromCamera(ndcOf(cx, cy), ctx.cam);
    if (!ray.ray.intersectPlane(_floorPlane, _floorHit)) return null;
    return { x: _floorHit.x, z: _floorHit.z };
  }

  /* 그 점에 설 수 있나 + 어디에 서게 되나. 가구·벽 안으로는 못 간다. */
  function walkTargetAt(cx, cy) {
    if (!built) return null;
    const f = floorAt(cx, cy);
    if (!f) return null;
    const b = roomBox();
    const inRoom = Math.abs(f.x) <= b.w / 2 + 0.5 && Math.abs(f.z) <= b.d / 2 + 0.5;
    const p = nav.nearestFree(f.x, f.z);
    /* 찍은 곳에서 너무 멀리 끌려가면 "여기 못 간다"고 말해 주는 게 맞다.
       조용히 딴 데로 보내면 플레이어는 자기가 찍은 자리를 못 믿게 된다. */
    const pulled = Math.hypot(p.x - f.x, p.z - f.z);
    return { x: p.x, z: p.z, rawX: f.x, rawZ: f.z, ok: inRoom && pulled < 0.9 };
  }

  function showWalkGhost(t) {
    if (!t) { disposeWalkGhost(); return null; }
    const g = ensureWalkGhost();
    g.mesh.position.set(t.x, GHOST_H / 2, t.z);
    g.ring.position.set(t.x, 0.02, t.z);
    if (t.ok !== g.ok) {
      g.ok = t.ok;
      const hex = t.ok ? GH_OK : GH_NG;
      g.mesh.material.color.setHex(hex);
      g.ring.material.color.setHex(hex);
    }
    needsRender = true;
    return t;
  }

  /* 캐릭터를 눌렀나.
     ① 픽 상자를 광선으로 정확히 — 크게 보일 때는 이게 제일 정확하다
     ② 안 맞으면 **화면 거리로 가장 가까운 캐릭터**(CHAR_HIT_PX 안).
        방 전경에서 자취녀는 40px 남짓이라 ①만으로는 폰에서 거의 못 짚는다
        (빈 슬롯을 30px 로 잡는 것과 같은 방법이다). */
  /* ★ 두 점을 가른다. 헷갈리면 조작이 통째로 어긋난다.
       발밑(y=0)  — **바닥과 맞바꿀 수 있는 점.** 상대 끌기의 기준점이 이것이다.
                    몸통을 기준으로 잡으면 손가락을 하나도 안 움직였는데도
                    "지금 서 있는 곳"이 아닌 데로 가 버린다(실제로 그랬다).
       몸통       — **눈이 보는 점.** 탭 판정은 이걸 쓴다. 발밑은 가구에 잘 가린다. */
  function charAnchor(c, up) {
    const r = canvas.getBoundingClientRect();
    tmp.set(c.root.position.x, up, c.root.position.z).project(ctx.cam);
    if (tmp.z > 1) return null;
    return { x: (tmp.x * 0.5 + 0.5) * r.width, y: (-tmp.y * 0.5 + 0.5) * r.height };
  }
  const charFootPos = c => charAnchor(c, 0);                                  // 바닥과 맞바꾸는 점
  const charBodyPos = c => charAnchor(c, c.kind === 'person' ? 0.62 : 0.30);  // 눈이 보는 점
  const charScreenPos = charFootPos;

  function pickCharacterAt(cx, cy, fuzzy) {
    if (!chars.size) return null;
    if (!fuzzy) {
      ray.setFromCamera(ndcOf(cx, cy), ctx.cam);
      const boxes = [...chars.values()].map(c => c.pickTarget).filter(Boolean);
      const hits = boxes.length ? ray.intersectObjects(boxes, false) : [];
      if (hits.length) {
        for (const [id, c] of chars) if (c.pickTarget === hits[0].object) return id;
      }
      return null;
    }
    const r = canvas.getBoundingClientRect();
    const px = cx - r.left, py = cy - r.top;
    let best = null, bestD = CHAR_HIT_PX;
    for (const [id, c] of chars) {
      const p = charBodyPos(c); if (!p) continue;
      const d = Math.hypot(p.x - px, p.y - py);
      if (d < bestD) { bestD = d; best = id; }
    }
    return best;
  }

  /* ── 화분·가구를 가리면 비켜선다 ──
     "캐릭터가 화분·가구를 가리면 안 됩니다. 겹치면 비켜서게 하십시오."
     화면에서 캐릭터 몸통과 화분이 겹치고, 캐릭터가 **더 앞에** 있으면 가린 것이다.
     그때 가까운 빈 자리 중 안 가리는 데로 한 걸음 걸어 보낸다.
     ★ 플레이어가 방금 보낸 자리에서는 안 비킨다(8초). 시켜서 간 자리를 제멋대로
       옮기면 조작이 안 먹은 것처럼 보인다. */
  const OCCLUDE_PX = 44;
  function occludes(c) {
    if (!plants.size) return false;
    const cp = charBodyPos(c); if (!cp) return false;
    const camPos = ctx.cam.position;
    const dChar = Math.hypot(c.root.position.x - camPos.x, c.root.position.z - camPos.z);
    for (const [, p] of plants) {
      const s = { x: p.group.position.x, y: p.group.position.y + 0.15, z: p.group.position.z };
      const sp = slotScreenPos(s); if (!sp) continue;
      const dPlant = Math.hypot(s.x - camPos.x, s.z - camPos.z);
      if (dChar >= dPlant - 0.05) continue;                 // 화분보다 뒤에 있으면 안 가린다
      if (Math.hypot(sp.x - cp.x, sp.y - cp.y) < OCCLUDE_PX) return true;
    }
    return false;
  }

  /* force 면 "방금 플레이어가 보낸 자리" 유예도 무시한다 — 호스트가 대놓고
     "지금 비켜세워라"라고 부른 경우다(view.nudgeCharacters). 저절로 도는 쪽은 유예를 지킨다. */
  /* ★ 자주 부르지 않는다. setPlant 에서도 부르는데, 빨리감기는 하루가 140ms 라
     턴마다 들어온다. 안 가리고 있으면 값이 싸지만(투영 몇 번), 가리고 있는데
     비킬 데가 없으면 매번 둘레 48칸을 훑게 된다 — 그건 그냥 낭비다.
     force(호스트가 대놓고 부른 것)는 언제나 돈다. */
  const NUDGE_MIN_MS = 900;
  let lastNudge = 0;
  function nudgeIfOccluding(force) {
    if (!built || !plants.size) return 0;
    const now = performance.now();
    if (!force && now - lastNudge < NUDGE_MIN_MS) return 0;
    lastNudge = now;
    stats.nudges++;
    let moved = 0;
    for (const [, c] of chars) {
      if (!c.walkable || c.walking || (!force && c.manualHold)) continue;
      if (!occludes(c)) continue;
      /* 둘레를 훑어 안 가리는 자리를 찾는다. 가까운 데부터 본다 —
         멀리 보내면 "왜 갑자기 저기로 갔지"가 된다. */
      const x0 = c.root.position.x, z0 = c.root.position.z;
      let found = null;
      for (const r of [0.45, 0.75, 1.05, 1.4]) {
        for (let k = 0; k < 12 && !found; k++) {
          const a = (k / 12) * Math.PI * 2;
          const x = x0 + Math.cos(a) * r, z = z0 + Math.sin(a) * r;
          if (nav.blocked(x, z)) continue;
          const probe = { root: { position: { x, y: 0, z } }, kind: 'person' };
          if (!occludes(probe)) found = { x, z };
        }
        if (found) break;
      }
      if (found) { c.goTo(found.x, found.z); moved++; }
    }
    return moved;
  }

  /* 고르기 — 한 번에 한 명. 링은 이 함수만 켜고 끈다. */
  function selectCharacter(id) {
    const want = id != null && chars.has(id) ? id : null;
    if (want === selChar) return selChar;
    selChar = want;
    for (const [k, c] of chars) c.setSelected && c.setSelected(k === want);
    /* ★ 고르는 순간 걷기 클립을 미리 받아 둔다. 예전에는 첫 걸음에서 GLB 를 받고
       뼈에 물리느라 한 번 걸렸다 — 걷기 시작이 제일 눈에 띄는 순간인데 하필 거기였다.
       고르기와 첫 걸음 사이에는 손가락을 끄는 시간이 있으니 그 틈에 받는다. */
    const sel = want && chars.get(want);
    if (sel && sel.warmWalk) sel.warmWalk();
    if (!want) disposeWalkGhost();
    needsRender = true;
    return selChar;
  }

  /* 놓기·치우기. 자리·포즈는 안에서 정한다 — 밖에서 좌표를 주지 않는다. */
  let charSeq = 0;
  async function setCharacter(who, opt = {}) {
    const my = ++charSeq;
    if (who == null) {                                  // null 이면 놓인 것을 전부 치운다
      for (const [k, c] of [...chars]) { c.dispose(); chars.delete(k); }
      selectCharacter(null);
      needsRender = true;
      return null;
    }
    const key = who === 'moni' ? 'moni' : 'jachwi';
    const old = chars.get(key);
    if (old) { old.dispose(); chars.delete(key); if (selChar === key) selectCharacter(null); needsRender = true; }
    let c;
    progress('character:' + key, key === 'moni' ? '몬이를 부르는 중' : '캐릭터를 세우는 중');
    try {
      c = who === 'moni' ? await makeMascot() : await makePerson(who);
    } catch (e) {
      throw fail(new Error(`캐릭터를 못 놓았습니다 (${who}): ${e.message}`));
    }
    if (disposed || my !== charSeq) { c.dispose(); return null; }
    chars.set(key, c);
    progress('character_done:' + key, '캐릭터 준비 완료');
    needsRender = true;
    return c.root;
  }

  /* ============================================================
     ⑩ 자리로 들어가기
  ============================================================ */
  function focusSlot(slotId, snap) {
    if (slotId == null) { frameRoom(!!snap); return; }
    /* ★ 자유 좌표 화분도 확대할 수 있어야 한다 — game.html 의 onPlantTap 이 그대로 부른다.
       열쇠 해석은 resolveKey 한 곳만 쓴다. */
    const t = resolveKey(slotId);
    if (!t) throw new Error(`모르는 슬롯: ${slotId} (방 ${roomId})`);
    const s = t.pos;
    focused = t.key;
    const p = t.plant;
    /* 화분이 있으면 그 키에 맞춰 거리를 잡는다. 없으면 자리만 보여주면 된다.
       ★ 잎이 벌어진 몬스테라는 bbox 가 실제 키보다 훨씬 크게 나온다. 그대로 쓰면
         카메라가 천장을 뚫고 올라가 하얀 벽만 찍혔다 — 위아래를 잘라 둔다. */
    /* ★ 예전에는 키의 0.62 배를 0.45m 로 잘라 썼다. 잎 5장짜리 옛 샘플(키 0.3m 안팎)
       기준이었기 때문이다. 이제 방의 몬스테라는 생장 모델이 조립해서 1년이면 0.6m,
       2년이면 0.85m 다 — 그 어림으로는 확대해도 위가 잘려 나가
       "탭했을 때와 같은 그루인가"를 확인할 수가 없다(실제로 잘렸다).
       화분이 있으면 **그 개체의 bbox 를 그대로** 담는다. */
    let hh = 0.22;                                   // 담을 반높이
    let cy = s.y + 0.22;                             // 담을 한가운데 높이
    if (p) {
      const bb = new THREE.Box3().setFromObject(p.group);
      const h = Math.max(0.12, bb.max.y - bb.min.y);
      hh = clamp(h / 2 * 1.25, 0.12, 0.95);          // 1.25 = 위아래 여유(FRAME_BIAS 몫 포함)
      cy = (bb.min.y + bb.max.y) / 2;
    }
    const tanV = Math.tan(THREE.MathUtils.degToRad(ctx.cam.fov) / 2);
    const tanH = tanV * Math.max(0.2, ctx.cam.aspect);
    // 자리에서는 지금 보고 있던 방위를 유지한다(갑자기 방이 돌면 어디인지 못 찾는다)
    const az = windowAzimuth() + YAW_OFFSET + userYaw;
    const target = new THREE.Vector3(s.x, cy, s.z);
    /* ★ 너무 확대되지 않게, 그리고 방 밖으로 나가지 않게.
       화분에 코를 박으면 어디에 있는 자리인지 알 수 없고, 멀어지면 벽·천장 속으로 들어간다. */
    const want = clamp(Math.max(hh / tanV, (hh * 0.75) / tanH), 0.5, 3.6);
    /* 높은 자리(반지하 창턱 1.6m)는 내려다볼 수가 없다 — 천장이 0.7m 위에 있다.
       그대로 각도를 유지하면 거리만 줄어 화분에 코를 박는다. 각도를 눕혀서 거리를 지킨다. */
    const head = roomBox().h - 0.25 - target.y;
    const el = Math.max(0.02, Math.min(FOCUS_EL, Math.asin(clamp(head / want, 0, 1))));
    const dist = insideRoomDistance(target, az, el, want);
    setCam({ az, el, dist, target }, !!snap);
    needsRender = true;
  }

  /* 그 방향으로 얼마까지 물러설 수 있나 — 벽·천장 안쪽에 머무는 최대 거리 */
  function insideRoomDistance(target, az, el, want) {
    const b = roomBox(), m = 0.30;
    const dir = { x: Math.cos(el) * Math.sin(az), y: Math.sin(el), z: Math.cos(el) * Math.cos(az) };
    let d = want;
    for (const ax of ['x', 'z']) {
      const half = (ax === 'x' ? b.w : b.d) / 2 - m;
      if (Math.abs(dir[ax]) < 1e-4) continue;
      const t = ((dir[ax] > 0 ? half : -half) - target[ax]) / dir[ax];
      if (t > 0) d = Math.min(d, t);
    }
    if (dir.y > 1e-4) d = Math.min(d, (b.h - m - target.y) / dir.y);
    return Math.max(0.35, d);
  }

  /* ============================================================
     ⑨ 바깥에 내주는 것
  ============================================================ */
  /* 자리 이름 — 배치 UI 가 사람에게 보여 줄 말.
     slotId 는 `{가구 uid}:{단}` 이고, uid 는 방 데이터에 적힌 것이거나
     없으면 house.js 가 붙인 `{프리셋}#{인덱스}` 다. 둘 다에서 프리셋 이름을 찾는다. */
  function slotName(slotId, s) {
    const uid = String(slotId).split(':')[0];
    const tier = +String(slotId).split(':')[1] || 0;
    let tiers = 0;
    for (const k of slotById.keys()) if (k.startsWith(uid + ':')) tiers++;
    const f = (roomDef && (roomDef.furniture || []).find(x => x.uid === uid));
    const sill = (roomDef && (roomDef.sills || []).find((x, i) => (x.uid || ('sill_' + x.wall + (i ? '_' + i : ''))) === uid));
    const presetId = f ? f.preset : (uid.includes('#') ? uid.split('#')[0] : null);
    let base;
    if (sill) base = '창턱';
    else if (presetId) base = (furnNames[presetId] || {}).name_ko || presetId;
    else base = s.owner || '자리';
    return tiers > 1 ? `${base} ${tier + 1}칸` : base;
  }

  const view = {
    /* 방 교체 */
    async setRoom(id) {
      try {
        zoomK = 1;              // 방 크기가 달라지므로 줌만 되돌린다(회전·상하각은 유지)
        await assemble(id);
      } catch (e) { throw fail(new Error(`방을 못 지었습니다 (${id}): ${e.message}`)); }
      return view;
    },
    /* 화분 놓기·치우기. plant=null 이면 치운다. */
    setPlant(slotId, plant) { return setPlant(slotId, plant); },
    /* 옮기기. 실패하면 throw */
    movePlant(a, b) { movePlant(a, b); },

    /* ══ 자유 좌표 배치 (2026-08-03) ══════════════════════════════════════
       ★ 화면 좌표는 전부 **뷰포트 기준 CSS 픽셀**이다 — pointer 이벤트의
         clientX/clientY 를 그대로 넣으면 된다. (screenPosOf 만 캔버스 기준이다) */

    /* 화면 좌표를 쏘아 놓을 수 있는 면을 찾는다.
         opt.potD    이 화분의 회전무관 지름[m] (기본 몬스테라 0.20)
         opt.ignore  겹침 판정에서 뺄 화분(옮기는 중인 자기 자신). 열쇠나 화분 id
         opt.maxDist 추천 자리를 이 거리 안에서만 찾는다[m]
       반환 { x, y, z, onUid, occIdx, surfaceTop, maxPotD, ok, reason, nearest }
         ok:false 면 reason 이 **한국어 이유**다. nearest 는 붙일 후보일 뿐 —
         ★ 스냅 판단은 호출부가 한다. 원 밖에도 놓을 수 있어야 하기 때문이다. */
    surfaceAt(px, py, opt) { try { return surfaceAt(px, py, opt || {}); } catch (e) { throw fail(e); } },

    /* 임의 좌표에 화분을 세운다. spec 이 null 이면 그 화분을 치운다.
       ★ 같은 potId 가 어디에 놓여 있든 옛 자리를 지우고 옮긴다(복사되지 않는다). */
    setPlantAt(potId, at, spec) { return setPlantAt(potId, at, spec); },
    /* 그 화분을 치운다. 몇 개를 걷었는지 돌려준다(정상이면 0 또는 1) */
    removePlantOf(potId) { return removePlantOf(potId); },
    /* 지금 방에 놓인 화분 전부 — 검증·UI 목록용 */
    plants() {
      return [...plants].map(([key, p]) => ({
        key, potId: p.potId || null, free: isFreeSlotId(key),
        kind: (p.spec && p.spec.kind) || null,
        pos: { x: p.group.position.x, y: p.group.position.y, z: p.group.position.z },
        yaw: p.group.rotation.y || 0,
        at: p.at ? { ...p.at } : null,
        potD: p.potD ?? null
      }));
    },
    /* 반투명 유령을 그 좌표에 세운다. opt.valid=false 면 붉게.
       previewMove 와 유령 한 벌을 나눠 쓴다 — 둘이 동시에 뜨지 않는다. */
    previewAt(at, opt) { try { return previewAt(at, opt || {}); } catch (e) { throw fail(e); } },
    clearPreview() { disposePreview(); },

    /* 추천 자리 원형 가이드. on=false 면 감춘다(지우지 않는다 — 다시 켤 때 값싸다).
         opt.potD/plantId  못 올라가는 자리를 어둡게 구분한다
         opt.near {x,z}    커서에 제일 가까운 자리를 굵고 밝게
       ★ 원은 안내지 제약이 아니다. 원 밖에도 놓을 수 있다.
       돌려주는 값은 이 화분이 올라갈 수 있는 자리 수. */
    showSlotRings(on, opt) { return showSlotRings(!!on, opt || {}); },
    slotRings() { return slotRingState(); },

    /* ── 가구 옮기기 ──
       ⚠ 끄는 동안에는 previewFurnitureAt 만 부른다. commit 은 손 뗄 때 한 번이다. */
    pickFurnitureAt(px, py) { try { return pickFurnitureAt(px, py); } catch (e) { throw fail(e); } },
    furniture() { return furnNodes().map(furnInfo); },
    /* 그 가구에 얹히거나 물려 있는 것들(클립등 등) — 옮기면 같이 간다 */
    ridersOf(uid) {
      const g = furnNode(uid);
      return g ? ridersOf(g).map(n => n.userData.uid) : [];
    },
    /* 방에 놓인 조명 기구의 **지금 자리** — 등이 가구를 따라왔는지 확인하는 창구.
       ⚠ 이 좌표는 buildHouse 가 조립 정의로 만든 것이라 조도 계산(ppfdSum)이 쓰는 것과 같다. */
    lightRigs() {
      return ((built && built.lightRigs) || []).map(r => ({
        id: r.id, grow: !!r.grow, schedule: r.schedule,
        pos: { x: +r.pos.x.toFixed(4), y: +r.pos.y.toFixed(4), z: +r.pos.z.toFixed(4) }
      }));
    },
    /* 그 자리에 놓을 수 있나 — { ok, reason }. rot 는 도(°) */
    furnitureFit(uid, pos) { return furnitureFit(uid, pos || {}); },
    previewFurnitureAt(uid, pos) { try { return previewFurnitureAt(uid, pos); } catch (e) { throw fail(e); } },
    clearFurniturePreview() { disposeFurnGhost(); },
    /* 실제로 옮긴다 — 방을 다시 조립하고 화분을 규칙대로 되돌린다(위 ⑧-b 주석).
       Promise 를 돌려준다. 못 놓는 자리면 reject 한다. */
    commitFurnitureAt(uid, pos) { return commitFurnitureAt(uid, pos || {}); },
    /* ★ 화분을 세로축으로 돌린다. Y 회전만 — 눕히거나 기울이면 화분이 넘어진다.
       회전무관 지름(2×max√(x²+z²))은 Y 회전에 불변이라 maxPotD 판정이 안 바뀐다.
       다시 조립돼도(진행도가 바뀌어 새로 지어도) 각도는 유지된다. */
    /* ★ 슬롯 id · `free:` 열쇠 · 화분 id 셋 다 받는다(resolveKey). 없으면 예전처럼 던진다. */
    setPlantYaw(slotId, rad) {
      const t = resolveKey(slotId);
      if (!t) throw fail(new Error(`모르는 슬롯: ${slotId} (방 ${roomId})`));
      const y = Number.isFinite(+rad) ? +rad : 0;
      plantYaw.set(t.key, y);
      if (t.plant) {
        t.plant.group.rotation.y = y;
        /* 자리(at)에도 적어 둔다 — 방을 다시 조립해도(가구 이동) 각도가 살아남는 길이다 */
        if (t.plant.at) t.plant.at = { ...t.plant.at, rotY: y };
      }
      if (preview && preview.fromId === t.key) preview.group.rotation.y = y;
      needsRender = true;
      return y;
    },
    /* 던지지 않는다 — 모르는 것이면 0 이다(예전 그대로) */
    plantYaw(slotId) {
      const t = resolveKey(slotId);
      if (!t) return 0;
      return t.plant ? (t.plant.group.rotation.y || 0) : (plantYaw.get(t.key) || 0);
    },
    /* ★ 옮기기 미리보기 — 그 화분의 반투명 복제를 목표 자리에 띄운다.
       원본은 제자리 그대로. toSlotId 가 null 이면 지운다.
       돌려주는 값의 ok 가 false 면 안 들어가는 자리다(미리보기가 붉게 뜬다). */
    previewMove(fromId, toId) { try { return previewMove(fromId, toId); } catch (e) { throw fail(e); } },
    /* 놓을 수 있는 자리 빛내기. [] 면 해제 */
    highlightSlots(ids) { if (!ids || !ids.length) clearRings(); else highlightSlots(ids); },
    /* 카메라를 그 자리로. null 이면 방 전체로.
       snap=true 면 부드럽게 가지 않고 바로 간다(스크린샷·헤드리스 검증용). */
    focusSlot(id, snap) { try { focusSlot(id, !!snap); } catch (e) { throw fail(e); } },
    /* 한 장 지금 그린다. 평소엔 rAF 루프가 알아서 하지만, 헤드리스처럼 rAF 가
       안 도는 환경에서 화면을 확정지어야 할 때 쓴다. */
    /* ★ 캐릭터도 한 칸 걸어 준다. rAF 가 안 도는 곳(헤드리스·숨은 탭)에서 이걸 안 하면
       사람이 바인드 자세(팔 벌린 A포즈) 그대로 찍힌다 — 실제로 그렇게 찍혔다. */
    redraw() { stepCharacters(performance.now(), true); updateCam(); ctx.renderer.render(ctx.scene, ctx.cam); needsRender = false; },
    /* 0..1 하루 시간대. 시간대 이름('아침'·'한낮'…)을 돌려준다.
       ★ 빨리감기는 이 함수를 하루에 한 바퀴 돌리는 것으로 표현한다 —
         해의 방향·색온도·창으로 든 빛 웅덩이가 같이 움직인다. */
    setDaylight(t01) { daylightT = clamp(+t01 || 0, 0, 1); return applyDaylight(); },
    get daylight() { return daylightT; },
    /* 그림자 예산 — 'lean'(기본) · 'full'(scene.js 기본) · 'none'. 측정·비교용이다. */
    setShadowBudget(mode) { shadowMode = mode; applyDaylight(); return shadowMode; },
    resize,
    /* 배치 UI 가 읽는다 */
    slots() {
      return [...slotById.values()].map(s => ({
        slotId: s.slotId,
        name: slotName(s.slotId, s),
        pos: { x: s.x, y: s.y, z: s.z },
        occupied: slotOccupied(s.slotId),
        maxPotD: Number.isFinite(s.maxPotD) ? s.maxPotD : null
      }));
    },
    /* ★ 계약에 없지만 필요해서 더한 것들 — 아래 셋은 배치 UI 가 '미리' 물어보는 통로다 */
    /* 그 자리에 이 화분이 들어가나. 회전 무관 지름으로 본다 */
    fitCheck(slotId, plantOrDiameter) {
      const t = resolveKey(slotId);
      if (!t) throw fail(new Error(`모르는 슬롯: ${slotId} (방 ${roomId})`));
      /* 자유 좌표 자리에는 '자리 한도'가 없다 — 그건 면이 정한다(surfaceAt.maxPotD) */
      const limit = t.slot ? slotPotLimit(t.slot) : Infinity;
      let d = null;
      if (typeof plantOrDiameter === 'number') d = plantOrDiameter;
      else if (plantOrDiameter && plantOrDiameter.kind)
        d = plantOrDiameter.kind === 'beansprout' ? SIRU_D : MONSTERA_POT_D;
      else if (t.plant) d = rotationSafeDiameter(potPartOf(t.plant.group), t.plant.group);
      return { slotId: t.key, maxPotD: Number.isFinite(limit) ? limit : null, diameter: d,
               ok: d == null ? null : !Number.isFinite(limit) || d <= limit + 1e-4 };
    },
    plantDiameter(slotId) {
      const t = resolveKey(slotId);
      return t && t.plant ? rotationSafeDiameter(potPartOf(t.plant.group), t.plant.group) : null;
    },
    /* ★ 열쇠 하나를 풀어 본다 — UI 가 "이 이름이 무엇을 가리키나"를 물어보는 창구.
       슬롯 id · `free:` 열쇠 · 화분 id 셋 다 받는다. 모르면 null. */
    resolveKey(x) {
      const t = resolveKey(x);
      if (!t) return null;
      return { key: t.key, slotId: t.slot ? t.slot.slotId : null,
               potId: t.plant ? (t.plant.potId || null) : null,
               free: isFreeSlotId(t.key), hasPlant: !!t.plant,
               pos: { ...t.pos }, screen: slotScreenPos(t.pos) };
    },
    /* ★ 그 자리가 화면 어디에 찍히나 — 뒤에 있으면 null.
       ★★ 좌표계는 **캔버스 기준 CSS 픽셀**이다(뷰포트 기준이 아니다).
          캔버스 왼쪽 위가 (0,0) 이고 오른쪽 아래가 (캔버스 CSS 폭, 높이) 다.
          뷰포트 좌표가 필요하면 canvas.getBoundingClientRect() 의 left/top 을 더하십시오.
          (드래그 중 마우스 좌표와 비교할 때 이 보정을 빼먹으면 자리가 어긋난다) */
    /* ★ 슬롯 id · `free:` 열쇠 · 화분 id 셋 다 받는다(resolveKey).
       화분이 있으면 **그 화분 발밑**을, 빈 자리면 자리 점을 돌려준다.
       발밑을 주는 이유는 캐릭터의 characterScreenPos 와 같다 — 바닥·상판과 맞바꿀 수 있는
       유일한 점이라 **상대 드래그의 기준점**으로 그대로 쓸 수 있다(손가락을 안 움직이면 제자리).
       ★★ 좌표계 규약은 안 바뀐다: **캔버스 기준 CSS 픽셀**. 카메라 뒤면 null 이다(0 으로 안 메꾼다). */
    screenPosOf(slotId) {
      const t = resolveKey(slotId);
      return t ? slotScreenPos(t.pos) : null;
    },
    /* 지금 시점 — 저장했다 복원하거나 검증할 때 쓴다 */
    camera() {
      return { az: cam.az, el: cam.el, dist: cam.dist, fit: fitDist,
               baseAz: windowAzimuth() + YAW_OFFSET,
               target: { x: cam.target.x, y: cam.target.y, z: cam.target.z } };
    },
    /* 측정용 — fps · 무엇을 줄였는지 */
    stats() { return { ...stats, pixelRatio: pxRatio, plants: plants.size, slots: slotById.size,
                       triangles: ctx.renderer.info.render.triangles, calls: ctx.renderer.info.render.calls }; },
    setContinuous(v) { forceContinuous = !!v; needsRender = true; },
    /* ★ 캐릭터·마스코트 — 자리와 포즈는 안에서 정한다.
         'jachwi'(자취생 1.40m) · 'moni'(마스코트 0.375m) · null(전부 치우기)
       GLB 를 싣느라 Promise 를 돌려준다. .catch 를 붙이십시오. */
    setCharacter(id, opt) { return setCharacter(id, opt || {}); },
    characters() {
      return [...chars].map(([id, c]) => ({
        id, kind: c.kind, assetId: c.assetId, walkable: !!c.walkable,
        selected: id === selChar, walking: !!c.walking,
        pos: { x: c.root.position.x, y: c.root.position.y, z: c.root.position.z },
        yaw: c.root.rotation.y
      }));
    },

    /* ══ 캐릭터를 눌러 고르고 걸어 보내기 ══════════════════════════════
       ★ 좌표는 전부 **뷰포트 기준 CSS 픽셀**이다 — pointer 이벤트의 clientX/clientY
         를 그대로 넣으면 된다. (screenPosOf 만 캔버스 기준이라는 점에 주의하십시오.
          그 값을 여기 넣으려면 canvas.getBoundingClientRect().left/top 을 더해야 한다) */

    /* 캐릭터를 눌렀을 때 부를 함수. createRoomView 의 opts.onCharacterTap 과 같은 것이고,
       나중에 갈아 끼우고 싶을 때 쓴다. null 이면 해제. */
    setCharacterTapHandler(fn) { O.onCharacterTap = (typeof fn === 'function') ? fn : null; },

    /* 고르기. 링이 뜬다. null 이면 해제. 돌려주는 값은 실제로 골라진 id(없으면 null) */
    selectCharacter(id) { return selectCharacter(id); },
    selectedCharacter() { return selChar; },

    /* 화면 좌표 → 바닥 위 한 점으로 걸어간다. **슬롯이 아니다.**
       가구·벽 안으로는 못 간다(floor_nav 가 막는다. 근처 빈 자리로 당겨 준다).
       돌려주는 값 { ok, x, z, steps } — ok:false 면 길이 없다. */
    walkTo(id, screenX, screenY) {
      const t = walkTargetAt(screenX, screenY);
      if (!t) return { ok: false, reason: '바닥을 못 찾았습니다(카메라가 바닥을 안 보고 있습니다)' };
      if (!t.ok) return { ok: false, x: t.x, z: t.z, reason: '거기에는 못 섭니다' };
      return doWalk(id, t) || { ok: false, reason: `걸을 수 있는 캐릭터가 아닙니다: ${id}` };
    },
    /* 갈 자리를 반투명 기둥·링으로 미리 보여준다. screenY 가 null 이면 지운다.
       파랑=갈 수 있다 · 빨강=못 간다 (decorate.js·previewMove 와 같은 색) */
    previewWalk(id, screenX, screenY) {
      const c = id && chars.get(id);
      if (!c || !c.walkable || screenY == null || screenX == null) { disposeWalkGhost(); return null; }
      return showWalkGhost(walkTargetAt(screenX, screenY));
    },
    /* 그 캐릭터가 화면 어디에 있나 — **캔버스 기준** CSS 픽셀(screenPosOf 와 같은 기준).
       ★ 돌려주는 것은 **발밑**이다. 이게 바닥과 맞바꿀 수 있는 유일한 점이라
         상대 끌기의 기준점으로 그대로 쓸 수 있다(손가락을 안 움직이면 제자리).
       뒤에 있으면 null. */
    characterScreenPos(id) {
      const c = id && chars.get(id);
      return c ? charFootPos(c) : null;
    },
    /* 지금 걷고 있나 */
    isWalking(id) { const c = id && chars.get(id); return !!(c && c.walking); },
    /* 걷던 것을 세운다 */
    stopWalk(id) { const c = id && chars.get(id); if (c && c.stop) c.stop(); },
    /* 화분을 가리고 선 사람이 있으면 비켜서게 한다. 평소엔 시점이 정돈될 때·화분을
       놓을 때 저절로 돈다 — 호스트가 직접 부를 일은 드물다(검증용으로 낸다).
       몇 명을 움직였는지 돌려준다. */
    nudgeCharacters() { return nudgeIfOccluding(true); },
    /* 그 사람이 지금 화분을 가리고 있나 — 검증·진단용 */
    isOccludingPlant(id) { const c = id && chars.get(id); return c ? occludes(c) : false; },

    /* ★ 부팅 이정표 — 무엇을 몇 ms 기다렸나. 느릴 때 짐작하지 말고 이걸 보십시오. */
    bootTimings() { return { ...timings, now: Math.round(performance.now() - T0) }; },
    /* 몬스테라 조립 모듈을 지금 싣는다(deferPlantAssets 를 켜 두고 미리 데우고 싶을 때).
       기다리지 않아도 된다 — 첫 setPlant 가 어차피 기다린다. */
    warmPlantAssets() { return assembler().then(a => !!a); },
    /* 방의 실제 크기[m]. 걷기 판정·검증이 방 밖을 물어볼 때 기준이 된다. */
    roomSize() { return built ? { ...roomBox() } : null; },

    /* ── 가구 보이기·숨기기 (2026-08-03) ──────────────────────────────────
       ★조명 계산은 **안 건드린다.** 여기서 하는 것은 그리기뿐이다 —
       숨긴 가구도 조도에는 그대로 들어간다. 화면과 계산이 갈리면 안 되므로,
       실제로 안 켜진 것(count 0)만 숨기는 것이 호출부의 몫이다. */
    setFurnitureVisible(uid, visible) {
      if (!built || !built.furniture) return false;
      let hit = false;
      built.furniture.children.forEach(g => {
        if (g.userData && g.userData.uid === uid) { g.visible = !!visible; hit = true; }
      });
      if (hit) needsRender = true;
      return hit;
    },
    /* 식물등을 앞에서부터 n개만 보이게 한다. 아직 안 산 등이 방에 놓여 있으면
       "이미 있는데 왜 또 사나"가 된다 — 사면 나타나는 편이 뜻이 맞다.
       ★state.js 의 lamps.count 규약과 같은 순서다("앞에서부터 n개를 켠다"). */
    setGrowLights(n) {
      if (!built || !built.furniture || !roomDef) return 0;
      const grows = (roomDef.furniture || [])
        .map((f, i) => ({ f, i }))
        .filter(({ f }) => {
          /* ⚠ data 는 lightEngine 없이 혼자 지을 때만 찬다. game.html 은 엔진을 넘기므로
             항상 실리는 furnNames(=프리셋 표)를 먼저 본다. 표가 없으면 이름으로 넘어간다. */
          const p = (furnNames && furnNames[f.preset])
                 || (data && data.furnPresets && data.furnPresets[f.preset]) || null;
          return p ? !!p.grow : /^growlight/.test(String(f.preset || ''));
        });
      const want = Math.max(0, Math.min(grows.length, n | 0));
      grows.forEach(({ f, i }, k) => {
        const uid = f.uid || (f.preset + '#' + i);
        built.furniture.children.forEach(g => {
          if (g.userData && g.userData.uid === uid) g.visible = k < want;
        });
      });
      needsRender = true;
      return want;
    },
    /* 지금 무엇을 보고 있나 */
    get roomId() { return roomId; },
    get focusedSlot() { return focused; },
    get three() { return ctx; },

    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(raf);
      canvas.removeEventListener('mousedown', onDown);
      canvas.removeEventListener('touchstart', onDown);
      window.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('touchmove', onMove);
      window.removeEventListener('mouseup', onUp);
      canvas.removeEventListener('touchend', onUp);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('mouseleave', onLeave);
      window.removeEventListener('resize', resize);
      ro && ro.disconnect();
      clearTimeout(settleCam._nudge);
      disposePreview();
      disposeFurnGhost();
      clearGuideRings();
      disposeWalkGhost();
      for (const [, c] of chars) { try { c.dispose(); } catch (e) { /* 치우다 난 오류로 나머지를 못 치우면 안 된다 */ } }
      chars.clear();
      clearPlants(); clearRings();
      disposeObject(ctx.scene);
      ctx.renderer.dispose();
    }
  };

  /* ── 시작 ── */
  try {
    progress('start', '3D 준비');
    /* 몬스테라 GLB 는 27MB 다. 방을 짓는 동안 같이 받아 두지 않으면 첫 화분에서
       그만큼 멈춘다. 기다리지는 않는다 — 실패해도 방은 떠야 한다.

       ★ 재 본 결과 (2026-08-03 · tools/test_boot_profile.mjs)
         이걸 방 뒤로 미뤄 봤다(deferPlantAssets). 방이 뜨는 시각은 **0.3초**밖에
         안 당겨졌다 — 8Mbps 로 조여도 차이가 없었다. 방이 쓰는 파일은 다 작아서
         27MB 와 회선을 다투지 않기 때문이다. 대신 첫 화분이 1초쯤 늦어진다.
         그래서 기본은 예전 그대로 두고, 켤 수 있게만 남긴다.
         부팅이 느린 진짜 이유는 따로 있다 — 확대 iframe 이 **잎 무늬 스킨 450MB** 를
         부팅 때 통째로 받는다(보고서 ② 참조). 여기서 고칠 수 있는 것이 아니다. */
    if (!O.deferPlantAssets) assembler();
    resize();
    await assemble(O.roomId);
    resize();
    applyDaylight();
    updateCam();
    ctx.renderer.render(ctx.scene, ctx.cam);
    raf = requestAnimationFrame(loop);
    progress('ready', '방이 떴습니다');
    try { O.onReady && O.onReady(view); } catch (e) { fail(e); }
    /* 방이 뜬 다음 프레임부터 식물 에셋을 받는다. 실패해도 방은 그대로 있다. */
    if (O.deferPlantAssets) setTimeout(() => {
      if (disposed) return;
      progress('plant', '식물 에셋을 받는 중');
      assembler().then(a => progress('plant_done', a ? '식물 에셋 준비 완료' : '식물 에셋 없이 갑니다'));
    }, 0);
  } catch (e) {
    fail(e);
    throw e;         // ★ 조용히 반쯤 살아 있는 뷰를 돌려주지 않는다
  }

  return view;
}
