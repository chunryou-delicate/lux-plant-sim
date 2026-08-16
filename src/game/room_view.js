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
                                ★ 2026-08-11 부터 **가구 윗면 전체 칸**도 같이 켠다(§guideCells)
       guideCells({potD})       그 칸들의 상태(진단용). `slotRings()` 와 **다른 층**이다
     추천 자리(slotId) 경로는 그대로 남는다. 세이브·조도 계약이 그 이름을 쓴다.

   ★ 이 파일은 render3d/** 를 읽기만 한다. 고치지 않는다.

   쓰는 법
     const view = await createRoomView(canvas, {
       roomId:'banjiha', lightEngine, onSlotTap, onPlantTap, onReady, onError });
     view.setPlant('banjiha-sill:0', { kind:'monstera', progress01:0.4, band:'good' });

   ★ 몬스테라 명세에 **`leafState`** 를 같이 넘기면 갈라짐·무늬·바램이 정본과 같아진다
     (없으면 방이 스스로 굴리는데, 그 굴림은 빛 이력이 없어 **갈라짐이 거의 안 난다** —
      실측: 유효 1000일에도 0장. `growth_adapter.leafState()` 가 그 목록을 낸다).

   좌표계는 house.js 그대로다 — 방은 원점 중심, 바닥 y=0.
============================================================ */

import { createScene, updateLight } from '../render3d/scene.js';
import { faintGrainTexture } from '../render3d/textures.js';
import { buildHouse, updateShellVisibility } from '../render3d/house.js';
/* ★ 창밖 골목 — **보이는 것일 뿐** 빛의 근원이 아니다.
   무광원(MeshBasicMaterial) + castShadow/receiveShadow 없음이라
   sunLight·skyPortals·조도 엔진 어느 쪽도 이 기하를 보지 않는다.
   (그래서 이걸 켜고 꺼도 test_banjiha_profile 의 숫자는 한 자리도 안 움직인다) */
import { attachOutside, attachNeighbors } from './outside.js';
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
         samePoint, distanceXZ, inRoom, makeAt, atFromSlot,
         GRID_UNIT, GRID_CELL, unitsFor, snapSpan, snapAngleDeg,
         cellBox, cellBoxOverlap } from './place.js';

/* ── 경로는 이 파일 기준으로 푼다 ──
   호스트 페이지가 저장소 뿌리에 있든 tools/ 아래에 있든 같은 곳을 가리켜야 한다.
   (참고: render3d/plant_sample.js 는 페이지 상대 경로 './assets/monstera' 를 쓴다.
    그래서 뿌리가 아닌 페이지에 얹으면 몬스테라만 404 가 난다 — 보고서에 적었다.) */
const AT = p => new URL(p, import.meta.url).href;

/* ============================================================
   ★ 옮길 때의 걸음 — SNAP_DIV (박사님 2026-08-06)
   ------------------------------------------------------------
   지시: "이동을 한 격자 단위나 1/2 격자 단위로 옮겨지게 하자."

   크기를 세는 칸(place.GRID_UNIT 0.05m)은 안 건드린다. 굵게 하는 것은 **놓는 걸음**뿐이다.
   0.05 로 끌면 5m 방에서 한 칸이 폰 2px 이라 손이 가는 대로 서고, 그래서 줄이 안 맞는다.
   눈에 보이는 칸은 0.25m(place.GRID_CELL)다 — 그 칸이나 반 칸에 떨어져야 사람 눈에
   '맞았다'고 읽힌다. 걸음을 새로 지어내지 않고 이미 그리고 있는 칸을 나눠 쓴다.

     SNAP_DIV = 1   한 칸  0.25m
     SNAP_DIV = 2   반 칸  0.125m   ← 기본

   ⚠ 0.125 는 0.05 의 배수가 아니다. place.cellBox 는 좌표를 0.05 칸으로 반올림해 겹침을
     정수로 보므로, 반 칸에 선 물건은 **겹침 판정이 최대 0.025m 어긋난다.**
     벽 밖 판정은 실수 좌표를 그대로 쓰므로(furnitureFit 의 rectCorners) 영향이 없다.
     칸 정수를 한 치도 안 틀리게 하려면 SNAP_DIV = 1 로 두면 된다 — 0.25 는 0.05 의 배수다.

   ── ★ 2026-08-07 : 놓는 걸음도 같은 반 칸이다 ──────────────────────────
   박사님: "그 배치 스냅 간격이 너무 촘촘한 거 같아. 밑에 그리드의 절반 정도로 해줘."

   ⚠ 「스냅이 없다」가 아니었다 — **재서 확인했다.** 가방에서 끌어 놓는 길은 예전부터
     surfaceAt 이 격자에 앉히고 있었다. 다만 걸음이 **GRID_UNIT 0.05m** 이라
     5m 방에서 한 칸이 폰 화면 2px 다. 그러면 눈으로는 연속이나 다름없고,
     그게 「촘촘하다」의 정체다. 옮기는 길(MOVE_STEP)만 반 칸이고 놓는 길은 0.05 였다 —
     **같은 손짓인데 걸음이 두 벌**이었던 셈이다.

   ⇒ 놓는 걸음의 기본값을 MOVE_STEP(=보이는 칸의 절반 0.125m)으로 맞춘다.
     새 상수를 만들지 않는다. 두 벌이 되면 반드시 어긋난다.
     ★ 가구를 앉히는 stepOf 의 기본값은 **안 건드린다**(0.05 그대로) — 가구는 놓는 길에서
       화면이 늘 step 을 넘겨 주고, 기본값을 바꾸면 `snapFurniture` 를 step 없이 부르는
       옛 길(테스트 Z-7 포함)이 조용히 반 칸으로 옮겨 간다.
============================================================ */
export const SNAP_DIV = 2;
export const MOVE_STEP = GRID_CELL / SNAP_DIV;

/* 발자국 한 변을 걸음에 맞춘다. 규약은 place.snapSpan 그대로다 —
   칸 중심이 아니라 **앞 모서리**를 선에 맞춘다(홀수·짝수 어느 쪽이든 점유 칸이 정수).
   다른 것은 그 선의 간격(step) 하나뿐이고, 크기는 여전히 GRID_UNIT 으로 센다.
   ★ step 을 안 주면 place.snapSpan 과 **같은 값**이 나온다 — 예전 길이 그대로다. */
export function snapSpanStep(center, sizeM, step = GRID_UNIT) {
  if (!Number.isFinite(center)) throw new RangeError(`[격자] 중심이 유한하지 않습니다: ${center}`);
  if (!(step > 0)) throw new RangeError(`[격자] 걸음이 0 보다 커야 합니다: ${step}`);
  const half = unitsFor(sizeM, GRID_UNIT) * GRID_UNIT / 2;
  return Math.round((center - half) / step) * step + half;
}
/* 걸음 값 고르기 — 안 주면 예전대로 0.05 다. 옮기는 길만 MOVE_STEP 을 준다.
   ★ 가구(snapFurniture)가 쓴다. 화분을 놓는 길은 아래 placeStepOf 다. */
const stepOf = v => (Number.isFinite(v) && v > 0 ? v : GRID_UNIT);
/* ★ 화분·시루를 **놓는** 걸음 — 안 주면 반 칸(MOVE_STEP 0.125m)이다.
   화면이 opt.step 을 안 넘겨도 손버릇이 같아지라고 기본값 쪽을 옮겼다(머리말 2026-08-07).
   더 잘게 놓고 싶으면 opt.step 으로 내려 줄 수 있고, 아예 안 앉히려면 opt.grid:false 다. */
const placeStepOf = v => (Number.isFinite(v) && v > 0 ? v : MOVE_STEP);

/* ============================================================
   폰 세로 기준값 — 기준 화면 390×844
============================================================ */
const PHONE = { w: 390, h: 844 };
const FOV_PORTRAIT = 38;     // 세로일 때 수직 화각[도]. 방 전경이 화면 폭을 채우는 값
const FOV_LANDSCAPE = 34;    // 가로/정사각이면 scene.js 기본값과 같게
const FIT_MARGIN = 1.03;     // 방이 화면 끝에 딱 붙지 않게 하는 여유
/* ★ 방을 화면 세로 어디에 두나. `look` 점을 내리면 방이 **위로** 밀린다(양수 = 위).
   ------------------------------------------------------------
   ⚠ 넓은 화면과 폰 세로는 **아래 띠의 성격이 다르다.**
     넓은 화면 `#bottom{position:absolute;bottom:0}` 이라 아래 띠가 무대를 **덮는다** →
                방을 위로 밀어야 띠에 안 가린다. 그래서 +0.07 그대로 둔다.
     폰 세로   아래 띠가 무대 **밖**(flex 형제)이다. 덮지 않는다 → 위로 밀 이유가 없는데
                밀고 있었다. 그 결과 방 밑에 배경색뿐인 띠가 남았다.

   ★ 재서 고른 값이다(2026-08-15 · 390×844 dpr2 실측).
     방은 **가로에 걸려 있다** — 방 상자의 좌우 꼭짓점이 FIT_MARGIN 턱에 딱 닿고
     세로는 절반(0.56)밖에 안 쓴다. 그래서 **캔버스를 세로로 늘려도 방은 한 픽셀도 안 커진다.**
     남는 세로는 없앨 수 없고 **위로 옮길 수만** 있다 — 위는 창밖(골목)이 채우고 아래는 배경색뿐이라,
     옮기면 그만큼이 그림이 된다.
     −0.20 은 아래 빈 띠를 390×844 에서 167 → 103px 로 줄이면서, 제일 좁은 360×780 에
     시루를 놓은 판(캔버스 529px)에서도 방 밑에 58px 이 남는 값이다(잘리지 않는다). */
const FRAME_BIAS = 0.07;              // 넓은 화면·가로
const FRAME_BIAS_PORTRAIT = -0.20;    // 폰 세로
const TAP_PX = 12;           // 이만큼 안 움직이면 탭 (손가락)
/* ★ 마우스는 누르는 동안 늘 몇 px 이 흔들린다 — 12 는 손가락 기준이라 마우스에서는
   그냥 누른 것도 회전으로 읽힌다. 28 은 「손목 떨림」이지 「끌려는 뜻」이 아니다. */
const TAP_PX_MOUSE = 28;
const TAP_MS = 600;
const SLOT_HIT_PX = 30;      // 슬롯은 점이라 화면거리로 잡는다. 손가락 크기
/* ★ 캐릭터도 같은 방법으로 잡는다 — 방 전경에서 자취녀는 화면에서 40px 남짓이라
   레이캐스트만 두면 손가락으로는 거의 못 짚는다(폰에서 실제로 못 짚었다).
   슬롯보다 조금 넉넉하게 둔다. 사람이 슬롯보다 크게 보이기 때문이다. */
const CHAR_HIT_PX = 36;
/* ★ 걷는 속도 — 1.15 → 1.45 (박사님 "걷는것 쫌만더 빠르게", 2026-08-04)
   1.5 는 5×4m 반지하에서 뛰어다니는 것처럼 보인다. 그 선은 그대로 두고 그 **바로 아래**로 올렸다. */
const WALK_SPEED = 1.45;
/* ⚠⚠ 속도만 올리면 **발이 미끄러진다.** 걷기 클립은 제자리 걸음이라(루트모션이 빠져 있다)
   보폭이라는 게 없고, 바닥 속도만 올라가면 다리는 그대로인데 몸만 앞으로 밀린다.
   그래서 클립 배속(timeScale)을 같이 올린다. 값은 짐작이 아니라 재서 골랐다 —
   ★ 클립이 제 속도로 돌 때의 **지면 속도 0.871 m/s**
     (assets/derived/char_clips/char_jachwi_f_walking.glb 를 순운동학으로 풀어 디딤 구간에서
      발끝이 몸 기준으로 뒤로 흐르는 속도를 쟀다. 양발이 0.001 이내로 같게 나왔다.)
   ★ 걸음당 미끄러지는 거리 = (WALK_SPEED − 0.871×배속) × 디딤시간(0.48s ÷ 배속)
       배속 1.00 → 33.2cm   속도만 올리고 클립은 그대로 둔 경우. 확 티가 난다
       배속 1.26 → 13.4cm   **예전(1.15 m/s·배속 1.0)과 똑같은 값**. 즉 예전에도 이만큼 밀렸다
       배속 1.40 →  7.9cm   ← 여기로 정했다. 예전보다 41% 덜 밀린다
       배속 1.66 →     0cm   안 밀린다. 그런데 초당 3.1걸음이라 **뛰는 걸음**이 된다
     1.40 이면 초당 2.6걸음이다. 키 1.4m 인 사람이 1.45 m/s 로 걸을 때 걸음수가 그쯤이라
     생체적으로도 맞고, "쫌만 더 빠르게"의 범위 안이다.
   ⚠ WALK_SPEED 를 다시 손대면 배속은 아래 식이 알아서 따라간다. 상수를 또 고치지 말 것. */
const WALK_CLIP_MPS = 0.871;   // 클립의 지면 속도[m/s] — 재서 넣은 값
const WALK_SLIP_OK = 0.23;     // 눈감아 주는 미끄러짐[m/s]. 0 으로 두면 뛰는 걸음이 된다
const ARRIVE_EPS = 0.10;     // 이만큼 가까워지면 그 웨이포인트는 지난 것
const CAM_TWEEN_MS = 560;
const SNAP_MS = 260;         // 손 뗀 뒤 턱으로 되돌아가는 시간(방위는 안 건드린다)

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
const ZOOM_IN = 0.58;
/* ★★ 줄 아웃 한계는 **화면 비율마다 다르다** (2026-08-06)
   박사님(PC): "피씨일 때 좀 더 멀리 떨어지게 하자 화면이.
                    지금 최대 원경이 최소고, 좀 더 멀게 해야 최대 멀리가 되도록 해 줘."
   ★ 폰 세로는 **그대로 1.15** 다. 거기서 더 멀어지면 390px 폭에서 화분이
     손톱만 해져 무엇을 놓는지가 안 보인다 — 넓은 화면에서만 푸는 것이 맞다.
   ★ 가르는 문턱은 이미 쓰던 것 그대로 쓴다(aspect 0.95 — FOV·기본 상하각과 같은 문턱이다).
   ⚠ fit 거리 대비 배율이다. 절대값(m)을 박으면 방 크기마다 맞지 않는다. */
const ZOOM_OUT_PORTRAIT = 1.15, ZOOM_OUT_WIDE = 2.00;

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

/* ★★ 네모 테두리 — squareFrameGeometry (2026-08-06)
   ══════════════════════════════════════════════════════════════════
   박사님: "밑에 물품들 이동칸 표시가 약간 네모로 표기됐으면 좋겠어.
            동그라미여서 밑에 네모 격자랑 뭔가 안 맞아"

   RingGeometry 를 그대로 갈아 끼울 수 있게 **같은 규약**으로 만든다.
     · XY 평면에 눕혀 있다(쓰는 쪽이 rotation.x = −π/2 로 눕힌다 — 예전 그대로)
     · 바깥 반지름이 1 이다(쓰는 쪽이 scale 로 키운다 — 예전 그대로)
   그래서 색·맥박·깊이검사·renderOrder 규약은 한 줄도 안 바뀐다. 모양만 바뀐다.

   ★ 크기는 **격자에 물린다**(§squareHalf). 모양만 네모로 바꾸고 크기가 0.25m 격자와
     어긋나면 오히려 더 어색하다 — 박사님이 지적하신 것이 정확히 그 어긋남이다.
   @param inner 안쪽 반(半)너비 (0..1). 바깥은 1 */
function squareFrameGeometry(inner) {
  const a = Math.max(0, Math.min(0.98, inner)), b = 1;
  const o = [[-b, -b], [b, -b], [b, b], [-b, b]];
  const i4 = [[-a, -a], [a, -a], [a, a], [-a, a]];
  const pos = [], idx = [];
  for (const p of o) pos.push(p[0], p[1], 0);
  for (const p of i4) pos.push(p[0], p[1], 0);
  for (let k = 0; k < 4; k++) {
    const k2 = (k + 1) % 4;
    /* 바깥 k → 바깥 k2 → 안쪽 k2 → 안쪽 k 로 이어지는 띠 하나 */
    idx.push(k, k2, 4 + k2, k, 4 + k2, 4 + k);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

/* 반지름[m] → **격자 칸에 물린 반너비[m]**.
   ★ 0.25m 격자 위에 얹히는 네모여야 한다. 화분 지름 0.22 짜리 자리는 한 칸(0.25),
     0.6 짜리 상판은 두 칸(0.50) 이 된다. 최소 한 칸 — 0.5칸짜리 네모는 격자에 안 맞는다. */
function squareHalf(r) {
  const cells = Math.max(1, Math.round((r * 2) / GRID_CELL));
  return cells * GRID_CELL / 2;
}

/* ★★ 유령 밑 네모의 반너비 — **지름을 그대로 받는다** (2026-08-07 버그 고침).
   ══════════════════════════════════════════════════════════════════
   ⚠⚠ 여기가 한 번 크게 틀렸다. 박사님이 폰 사진으로 잡아 주셨다 —
     시루 하나를 끄는데 방 절반을 덮는 초록 판이 떴다.

   원인: 자리 표시가 **원에서 네모로 바뀐 날**(2026-08-06) 이 자리만 안 따라왔다.
     · 원 시절  : 기하가 반지름 0.32 짜리 `RingGeometry` → `scale = r / 0.32` 가 맞았다
     · 네모 지금: 기하가 **바깥 반너비 1** 짜리(`squareFrameGeometry`) → 같은 식을 쓰면
                  배율이 곧 반너비[m] 가 된다. r 최대 0.55 → 0.55/0.32 = **1.72**,
                  즉 한 변 3.4m 짜리 네모다. 방보다 크다.

   ⇒ 뜻으로 다시 세운다: 네모는 **그 물건이 실제로 먹는 자리**여야 하고,
     격자 칸(0.25m)에 물려야 한다(박사님 "밑에 네모 격자랑 안 맞아").
     시루 한 개(0.24m)는 정확히 **한 칸**, 시루 12개 무리(0.97m)는 네 칸이 된다.
   ★ `* 1.5` 부풀림도 뺐다. 그건 원이 화분보다 커 보이게 하려던 값인데,
     네모는 격자에 물리는 순간 저절로 화분보다 한 뼘 커진다(0.24 → 0.25). */
function markerHalf(potD) {
  return squareHalf((Number.isFinite(potD) ? potD : 0.22) / 2);
}

/* ★★ 스킨드 메시의 **실제 최저점** — skinLowestY (2026-08-06)
   ══════════════════════════════════════════════════════════════════
   ⚠⚠ `new THREE.Box3().setFromObject(캐릭터)` 는 **쓰면 안 된다.**
     스킨드 메시의 정점은 뼈 행렬이 움직이는데 three 의 Box3 는 기하의 바인드 상자에
     메시 노드 행렬만 곱한다. 재 보면 그 값이 [0, 0.014]m 로 나온다 — 1.4m 짜리 사람이다.
     (실제로 이걸로 재다가 "캐릭터 키 0.02m" 라는 검사 결과를 받았다.)

   그래서 뼈를 실제로 풀어서 잰다. three r128 의 SkinnedMesh.boneTransform 이 그 일을 한다.
   ⚠ 앞에 `skeleton.update()` 가 반드시 있어야 한다 — 안 부르면 뼈 행렬이 바인드 포즈라
     **늘 0 이 나온다**(그렇게 나와서 "클립은 멀쩡하다"는 잘못된 결론을 한 번 냈다).

   ★ 전부 세지 않는다. 메시마다 GROUND_VERTS 점만 고른다 — 발바닥은 정점이 촘촘해서
     성기게 훑어도 최저점이 몇 mm 안에서 잡힌다. 클립마다 한 번만 부르는 함수다. */
const GROUND_VERTS = 220;
function skinLowestY(root) {
  let lo = Infinity;
  const v = new THREE.Vector3();
  root.updateMatrixWorld(true);
  root.traverse(n => {
    if (!n.isSkinnedMesh || !n.geometry || !n.geometry.attributes || !n.geometry.attributes.position) return;
    if (typeof n.boneTransform !== 'function') return;
    n.skeleton.update();
    const pos = n.geometry.attributes.position;
    const step = Math.max(1, Math.floor(pos.count / GROUND_VERTS));
    for (let i = 0; i < pos.count; i += step) {
      n.boneTransform(i, v);
      v.applyMatrix4(n.matrixWorld);
      if (v.y < lo) lo = v.y;
    }
  });
  return lo;
}

/* ★★ 접지 그림자 (blob) — "물건이 바닥에 붙어 보이게" (2026-08-06)
   ══════════════════════════════════════════════════════════════════
   박사님: "약간 그림자가 없으니 애매하네. 살짝 빛에 따른 가구나 사람 그림자 대충 나오게"
   ★ 핵심은 **"대충"** 이다. 정밀한 그림자맵이 아니라 "붙어 보이는 정도"면 된다.

   왜 그림자맵을 더 켜지 않았나 — 재 봤다(tools/test_perf_budget.mjs §그림자).
     지금(lean) 해 하나만 굽는다. full 로 올리면 천장등 큐브맵 6면 + 창확산광 2장이
     늘어 프레임 시간이 크게 뛴다. 그리고 **반지하는 해가 약해서** 그림자맵을 다 켜도
     바닥에 아무것도 안 보인다 — 값을 치르고 얻는 게 없다.
   접지 그림자는 빛과 무관하게 늘 보이고, 값이 텍스처 한 장 + 판때기 하나다.

   ⚠⚠ **이것은 그림이지 계산이 아니다.** 조도(DLI)에 한 톨도 안 들어간다 —
     조도는 light_adapter 가 방 정의로 내고, 이 판때기는 houseGroup 에만 붙는다.
     tools/test_ground.mjs 가 그 사실을 숫자로 못 박는다. */
let _blobTex = null;
function blobTexture() {
  if (_blobTex) return _blobTex;
  const N = 64;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d');
  /* 가운데가 짙고 가장자리로 부드럽게 사라진다. 가장자리를 완전히 0 으로 떨어뜨려야
     판때기 네모가 안 보인다(0.02 만 남아도 사각형 자국이 보인다 — 실제로 보였다). */
  /* ★★ RGB 를 **흰색**으로 둔다 (2026-08-07 · §설 초록빛). 예전에는 검정이었다.
     그림은 **한 톨도 안 바뀐다** — 재질의 기본 `color` 가 검정이라
     흰색 × 검정 = 검정이고, 알파는 손대지 않았다. 곱셈의 항등원을 옮겼을 뿐이다.
     ⚠ 검정으로 두면 `material.color` 가 **아무 일도 안 한다**(0 × 무엇 = 0).
       그래서 「식물 아래 원이 빛 따라 초록으로」를 색으로 못 낸다. 흰색이라야 색이 먹는다. */
  const grd = g.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
  grd.addColorStop(0.00, 'rgba(255,255,255,0.78)');
  grd.addColorStop(0.42, 'rgba(255,255,255,0.66)');
  grd.addColorStop(0.72, 'rgba(255,255,255,0.30)');
  grd.addColorStop(0.90, 'rgba(255,255,255,0.07)');
  grd.addColorStop(1.00, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, N, N);
  _blobTex = new THREE.CanvasTexture(c);
  _blobTex.minFilter = THREE.LinearFilter;
  _blobTex.magFilter = THREE.LinearFilter;
  return _blobTex;
}

/* 판때기 하나. 지름 d[m] · 진하기 a. XZ 평면에 눕혀 돌려준다.
   ★ userData.isBlobShadow 로 표시한다 — 검사(test_ground)가 bb 를 잴 때 이걸 빼야
     "min.y 가 0 이다"가 그림자 때문에 늘 참이 되는 거짓 통과를 막는다. */
function makeBlobShadow(d, a = 1) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, opacity: a,
                                  depthWrite: false, toneMapped: false,
                                  color: 0x000000, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2;
  m.scale.set(d, d, 1);
  m.renderOrder = 1;                 // 격자(2·3)·링(4~6)보다 아래
  m.userData.isBlobShadow = true;
  m.matrixAutoUpdate = true;
  return m;
}

/* 화분만 잰다 — 잎은 화분 밖으로 나가는 게 정상이라 같이 재면 안 된다 */
function potPartOf(group) {
  /* 생장 모듈이 조립한 그루는 화분이 어느 자식인지 스스로 알려 준다.
     마디 트리라 "잎이 아닌 첫 자식" 규칙으로는 줄기가 잡힌다 — 그러면 화분 지름이
     줄기 굵기(2cm)로 나와 어떤 자리든 통과해 버린다. 티가 안 나는 종류의 사고다. */
  if (group.userData.potPart) return group.userData.potPart;
  const leaves = group.userData.leaves || [];
  /* ⚠ 접지 그림자는 이제 그루의 자식이 아니다(§syncPlantBlob) — 그래도 두 겹으로 막아 둔다.
     자식으로 넣었던 때 이 규칙이 판때기를 화분으로 읽어 0.2m 화분의 지름이 0.48m 가 됐다. */
  return group.children.find(c => !leaves.includes(c) && !c.userData.isBlobShadow) || group;
}

/* ★★ 무리 짓기 — 한 자리에 용기 N개를 늘어놓는 자리표 (2026-08-05)
   ══════════════════════════════════════════════════════════════════
   ★ 왜 필요한가 — **시루를 12개 사도 방에는 한 그루만 섰다.**
     작물 자리(site)는 좌표가 하나고 그 위에서 시루 N개가 돈다(first_play §pots[]).
     그런데 방뷰는 그 좌표에 그루를 **하나만** 세운다. 플레이어는 7,000원짜리 시루를
     열두 번 사고 화면에서는 아무것도 안 바뀌는 것을 본다 —
     「사면 돈만 없어진다」와 같은 종류의 사고다. 겹쳐 쌓고 숫자만 적어 두는 길도 있지만
     그러면 "12개"가 눈으로 안 읽힌다. **늘어놓아야 산 것이 보인다.**

   ★ 자리표는 **정육각 격자**에서 고른다.
     이 파일의 자리 판정은 전부 회전무관 지름(= 외접원) 하나로만 돈다(§rotationSafeDiameter).
     그러니 무리도 **둥글게** 뭉쳐야 값이 싸다. 골라내는 규칙은 셋뿐이다.
       ① 격자점을 넉넉히 깔고
       ② 격자의 대칭 중심 셋(격자점 · 변의 중점 · 삼각형 무게중심)을 후보로 두고
       ③ 각 후보에서 가까운 n점을 골라 **외접원이 제일 작은** 후보를 쓴다
     ①~③ 에 난수가 없다. 하루가 갈 때마다 다시 짓는데 그때마다 자리가 바뀌면
     시루가 들썩인다(§buildMusun 의 황금각과 같은 이유다).

   ★ 얼마나 좋은가 — 이 격자가 내는 폭은 **실제로 세워 놓고 정점을 훑어 쟀고**,
     원 안에 원 n개 채우기의 **문헌 최적값**(R/r · n=3 은 1+2/√3, n=4 는 1+√2, n=12 는 4.0294)을
     견줄 자로 썼다.
       n=12  이 격자 0.973m · 최적 0.967m — 0.6% 차이
       n=3·6·7 은 최적과 **같다**. 제일 나쁜 n=4 가 13% 다.
     표를 베끼지 않고 이만큼 나온다. 표를 들이면 표에 없는 n 에서 규칙이 끊긴다
     (체력 계통이 말하는 노가다의 폭이 시루 15개다 — stamina.js §STAMINA_MAX).

   ⚠ 돌려주는 좌표·폭은 **용기 지름 1 기준**이다. 실제 지름을 곱해서 쓴다 —
     그래야 자리 한도에 맞춰 무리를 통째로 줄일 때 자리표를 다시 안 짜도 된다. */
const _clusterCache = new Map();
function clusterUnit(n) {
  const k = Math.max(1, Math.round(Number(n)) || 1);
  if (_clusterCache.has(k)) return _clusterCache.get(k);
  let out;
  if (k === 1) out = { offs: [{ x: 0, z: 0 }], span: 1 };
  else {
    const H = Math.sqrt(3) / 2;                       // 격자 줄 간격
    const R = Math.ceil(Math.sqrt(k)) + 2;            // 이만큼만 깔면 n점이 반드시 안에 든다
    const lat = [];
    for (let a = -R; a <= R; a++) for (let b = -R; b <= R; b++)
      lat.push({ x: a + b * 0.5, z: b * H });
    const cands = [{ x: 0, z: 0 }, { x: 0.5, z: 0 }, { x: 0.5, z: 1 / (2 * Math.sqrt(3)) }];
    let best = null;
    for (const c of cands) {
      const near = lat.map(p => ({ x: p.x - c.x, z: p.z - c.z }))
        .map(p => ({ p, d2: p.x * p.x + p.z * p.z }))
        /* 같은 거리면 각도로 가른다 — 정렬이 흔들리면 같은 n 이 판마다 다른 모양이 된다 */
        .sort((u, v) => u.d2 - v.d2 || Math.atan2(u.p.z, u.p.x) - Math.atan2(v.p.z, v.p.x))
        .slice(0, k);
      const r = Math.sqrt(near[near.length - 1].d2);
      if (!best || r < best.r - 1e-12) best = { r, offs: near.map(u => u.p) };
    }
    out = { offs: best.offs, span: 2 * best.r + 1 };
  }
  _clusterCache.set(k, out);
  return out;
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
     onLampTap(uid, on, state)  ★ 등을 눌렀다 (2026-08-08).
                  ⚠ **방뷰가 먼저 껐다 켠 뒤에** 부른다 — 손가락이 닿는 즉시 방이 밝아져야
                    하기 때문이다. 호스트가 막을 일이면 setLampOn(uid, !on) 으로 되돌린다.
                  on     누른 결과 켜졌나
                  state  lampSwitches().lamps 한 줄과 같은 모양(watts·hours 포함)
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

/* ★ 게임 화면의 빛 손잡이 — 값은 전부 **재서** 정했다(tools/probe_room_light.mjs).
   눈으로 조이지 마라. 그 도구를 돌리면 낮·밤·창가·안쪽·등아래·구석이 숫자로 나온다.
     SUN_BOOST     직사광만 올린다. 창으로 드는 햇살 기둥·바닥 자국이 이걸로 산다
     PORTAL_BOOST  창 확산광(창가 밝기). 방 안쪽에는 거의 안 닿는다
     DAY_FILL_CUT  낮에 방향 없는 채움광을 더 깎는다 — 창빛이 배경에 안 묻히게
     NIGHT_*_MIN   밤 채움광 바닥값. ★ scene.js 의 밤값(0.16·0.07)보다 **낮아야** 한다
     BULB_*        천장등. 거리·감쇠를 방 크기에 맞춰 **웅덩이**를 만든다 */
const SUN_BOOST = 4.20, PORTAL_BOOST = 4.20;
const DAY_FILL_CUT = { hemi: 0.50, amb: 0.55 };
const NIGHT_HEMI_MIN = 0.055, NIGHT_AMB_MIN = 0.020;
const GAME_EXPOSURE = 0.72;
/* ★★ 2026-08-16 — **화면 밝기(사람이 맞추는 값).** 위 0.72 에 곱해진다.
   ------------------------------------------------------------
   박사님(2026-08-16): *"낮이고 불도 켰는데 방이 너무 어두워 까매"* — 그리고
   *"폰에서만 그래, PC 는 괜찮음."*
   ⚠ 값이 틀린 게 아니다. 0.72 는 2026-08-03 에 박사님이 *"방이 너무 밝다"* 하셔서
     **폰으로 재서** 내린 값이다. 그때 폰과 지금 폰이 다르다 — 기기·화면·주변 밝기가 다르면
     같은 노출이 다르게 보인다. **한 값으로 둘 다 맞출 수 없다.**
   ⇒ 그래서 코드가 정하지 않고 **사람이 맞춘다.** 이 배수는 `localStorage` 에 남는다.
   ★ 밑값 1.0 = 지금까지와 **한 톨도 안 다르다**. 안 만진 사람에게는 아무것도 안 바뀐다. */
const BRIGHT_KEY = 'byeot.brightness';
const BRIGHT_MIN = 0.6, BRIGHT_MAX = 2.2;
let userBright = 1;
try {
  const v = parseFloat(localStorage.getItem(BRIGHT_KEY));
  if (Number.isFinite(v)) userBright = Math.min(BRIGHT_MAX, Math.max(BRIGHT_MIN, v));
} catch { /* 사생활 모드 등 — 못 읽으면 밑값 */ }
/* 밤 광원 — 화면 연출값이다. 판정(PPFD·DLI)은 조도 엔진 몫이고 여기서 안 건드린다.
   ★ 재서 정했다: 이 값들이 크면 "밤이 낮보다 밝은" 화면이 된다(실제로 166% 였다).

   ★★ 2026-08-17 — **천장등을 올렸다.** 박사님: *"밤에 방 천장 중앙 메인등 밝기를
     살짝 더 밝게 해 줄래? 너무 어두워. **그냥 가시적 밝기만**"*
     ------------------------------------------------------------
     ⚠ **세기(K)만 올려서는 거의 안 움직인다.** 재 봤다 — K 를 0.30 → 0.80 으로 2.7배
       올려도 방 안 밤 평균이 32.3 → 35.5 였다(+10%). 막고 있던 것은 세기가 아니라
       **감쇠(decay 2.2)** 다. 점광원은 거리의 `decay` 제곱으로 떨어지므로,
       2.3m 짜리 방에서도 2.2 면 등에서 한 걸음만 벗어나도 확 죽는다.
     ⇒ **둘을 같이 움직였다** (K 0.30 → 0.45 · decay 2.2 → 1.6). 실측:
         방 안 밤 평균  32.3 → **38.8** (낮의 36% → 43%)
         등 아래(상위10%) 56 → **80** (+43%)
         구석(하위10%)  11 → **11** ← ★ **안 움직였다**
     ★ 그래서 「등 아래는 밝고 구석은 어둡다」는 밤의 그림이 **그대로 산다.** 아래 §밤 웅덩이
       머리말이 세운 그 뜻을 안 깬다 — 웅덩이를 없앤 게 아니라 웅덩이를 **더 또렷하게** 했다.
   ⚠ 이 값을 더 올리려면 **구석(하위10%)이 같이 오르는지**부터 재라. 그게 오르면
     방이 평평해지고 "밤이 낮 같다"로 돌아간다. */
const BULB_K = 0.45, BULB_DECAY = 1.6, BULB_EMISSIVE = 0.14;
/* ★ 밤 밝기의 주범은 scene.js 의 ceilingBulb 가 아니라 **방에 놓인 조명 기구**였다.
   재서 갈랐다(t=0.95 · 반지하 바닥 평균 130.9):
     천장등(scene.js)만 끔        130.4   ← 0.5 밖에 기여 안 한다
     기구 3개까지 끔(채움광만)      38.3   ← **기구가 92를 만들고 있었다**
     채움광까지 끔                  1.2
   그동안 BULB_K 만 조여 온 것이 헛손질이었던 이유다. 기구를 줄여야 밤이 밤이 된다. */
/* ★ 식물등 세기 0.20 → 0.34 (2026-08-08 · 박사님 "등 켰을 때 밝기를 살짝만 올려줘")
   ------------------------------------------------------------
   눈으로 고른 값이 아니다. **화면 픽셀 밝기를 재서** 골랐다
   (`tools/probe_lampswitch.mjs` · 반지하 · 390×844 dpr2 · 휘도 0..255 · 식물등 2개만 조작).

     세기      화면평균   방바닥   등아래 두 자리      탄 픽셀(≥240)
     ── 낮 t=0.50 ────────────────────────────────────────────────
     0(끔)       74.65    106.83   103.2 / 78.2        0.65%
     0.20        75.25    108.27   117.5 / 104.0       0.65%   ← 예전 값
     **0.34**    75.63    109.21   126.0 / 118.6       0.65%   ← 지금
     0.60        76.26    110.86   139.5 / 140.3       0.66%
     1.00        77.09    113.13   155.7 / 164.0       0.66%
     ── 밤 t=0.90 ────────────────────────────────────────────────
     0(끔)       41.85     34.76    43.5 / 34.3        0%
     0.20        42.72     37.29    67.8 / 70.3        0%
     **0.34**    43.25     38.93    82.0 / 90.1        0%
     1.00        45.29     45.56   129.2 / 149.4       0%

   ⇒ 끔 → 0.34 은 **화면 전체로는 낮 +1.3% · 밤 +3.4%** 밖에 안 움직인다.
     그런데 **등 바로 아래는 낮 +22~52% · 밤 +89~163%** 다. 그것이 「살짝」의 뜻이다 —
     방을 통째로 들어 올리는 게 아니라 **등 밑에 웅덩이가 생기는 것**이다.
     탄 픽셀은 0.65% 그대로 — 방이 하얘지지 않는다.
   ⚠ 이 값은 **그림뿐**이다. 조도(DLI)는 lighting_sim.ppfdSum 이 따로 낸다 —
     추천 자리 14곳 DLI 가 변경 전후로 **소수 넷째 자리까지 같다**(같은 도구가 같이 잰다). */
const RIG_GROW = 0.34, RIG_LAMP = 0.55;
/* ★ 접지 그림자 진하기 (2026-08-06 · §makeBlobShadow).
   ⚠ 이것은 **그림**이다. 조도(DLI)에 안 들어간다 — 값을 바꿔도 자리 판정은 안 바뀐다.
   ★ 왜 서로 다른가
     사람   0.55  방에서 제일 크고, 안 붙어 보이던 그 물건이다
     가구   0.40  한 판에 합쳐 그린다(드로우콜 1). 세면 방바닥이 얼룩덜룩해진다
     화분   0.45  작아서 조금 진해야 보인다
     몬이   0.30  **일부러 떠 있는** 마스코트다. 진하면 붙어 있는 것처럼 읽힌다 */
const BLOB_A_CHAR = 0.55, BLOB_A_FURN = 0.40, BLOB_A_PLANT = 0.45, BLOB_A_MASCOT = 0.30;
/* 밤에는 방향 없는 채움광을 한 번 더 깎는다 — 채움광이 남아 있으면 등 웅덩이가 안 보인다 */
const NIGHT_FILL_CUT = 0.60;
function isDescendant(node, root) {
  for (let p = node; p; p = p.parent) if (p === root) return true;
  return false;
}
/* ★ 원래 색을 재질에 적어 두고 **곱이 아니라 대입**으로 칠한다 (2026-08-03).
   예전에는 multiplyScalar 로 눌렀다 — 두 번 부르면 두 번 눌리고, 되돌릴 수가 없었다.
   원래 색을 들고 있으면 house 기본(=index.html)과 게임 화면을 **같은 카메라에서 번갈아**
   재서 비교할 수 있다. 밝기를 눈이 아니라 숫자로 다루려면 이게 먼저 필요하다. */
function dimRoomMaterials(b, roomK = ROOM_DIM, furnK = FURN_DIM) {
  if (!b || !b.room) return;
  const seen = new Set();
  b.room.traverse(o => {
    if (!o.isMesh || !o.material) return;
    /* 가구는 방보다 덜 누른다 — 다 같이 내리면 형태가 뭉개져 무엇이 무엇인지 안 보인다 */
    const k = (b.furniture && isDescendant(o, b.furniture)) ? furnK : roomK;
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    ms.forEach(m => {
      if (!m || !m.color || seen.has(m.uuid)) return;
      if (m.transparent && m.opacity < 0.95) return;      // 유리는 그대로
      seen.add(m.uuid);
      if (!m.userData.__rvBaseColor) m.userData.__rvBaseColor = m.color.clone();
      m.color.copy(m.userData.__rvBaseColor).multiplyScalar(k);
    });
  });
}

export async function createRoomView(canvas, opts = {}) {
  const O = {
    roomId: 'banjiha', lightEngine: null,
    onSlotTap: null, onPlantTap: null, onSlotHover: null, onCharacterTap: null,
    /* ★ 등을 눌렀다 (2026-08-08). **누르는 순간 방뷰가 이미 켜고 껐다** — 여기는 알림이다.
       호스트는 이걸 받아 S.lamps 를 맞추고 조도 캐시를 비우면 된다(§등 스위치). */
    onLampTap: null,
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

  /* ══ ★★★ 문맥을 못 만들면 **한 단계씩 낮춰 다시 해 본다** (2026-08-16) ══════════════
     박사님 폰에서 **`Error creating WebGL context`** 로 방이 통째로 안 떴다.
     ⚠ 코드가 틀린 게 아니다 — **기기가 문맥을 못 내준 것**이다. 흔한 까닭 셋:
       ① 탭이 여럿 열려 있어 브라우저의 WebGL 문맥 수가 한도에 닿았다(박사님 폰: 탭 13개)
       ② `powerPreference:'high-performance'` 를 못 맞춰 준다(저사양·절전 모드)
       ③ webgl2 자체가 없다(옛 기기)
     ⇒ **한 번 실패했다고 포기하지 않는다.** 요구를 하나씩 내려놓으며 네 번 해 본다.
       ★ 여기서 성공한 문맥은 브라우저가 기억하므로 아래 `createScene` 이 그대로 받는다.
     ⚠ 그래도 안 되면 예전처럼 실패한다 — **없는 것을 있다고 하지 않는다.**
       다만 그때는 무엇을 해 봤는지가 오류에 남아 다음 사람이 헤매지 않는다. */
  if (!canvas.getContext('webgl2') && !canvas.getContext('webgl')) {
    const tries = [
      { name: 'webgl2 · 기본',            type: 'webgl2', attr: {} },
      { name: 'webgl2 · 저전력',          type: 'webgl2', attr: { powerPreference: 'low-power', antialias: false } },
      { name: 'webgl1 · 저전력',          type: 'webgl',  attr: { powerPreference: 'low-power', antialias: false } },
      { name: 'webgl1 · 최소',            type: 'webgl',  attr: { antialias: false, alpha: false, depth: true,
                                                                 stencil: false, failIfMajorPerformanceCaveat: false } }
    ];
    const tried = [];
    let got = null;
    for (const t of tries) {
      tried.push(t.name);
      try { got = canvas.getContext(t.type, t.attr); } catch (_) { got = null; }
      if (got) { console.warn(`[방뷰] WebGL 문맥을 «${t.name}» 로 다시 얻었습니다`); break; }
    }
    if (!got) throw fail(new Error(
      'WebGL 문맥을 못 만들었습니다 — 다른 탭을 닫고 새로고침해 보세요. ' +
      `(해 본 것: ${tried.join(' · ')})`));
  }

  const ctx = createScene(canvas);
  const GRAIN = faintGrainTexture();

  /* 폰 기준 그림자 예산 — scene.js 기본은 데스크톱 기준(2048)이라 폰에선 과하다 */
  ctx.sunLight.shadow.mapSize.set(1024, 1024);
  ctx.ceilingBulb.shadow.mapSize.set(512, 512);
  ctx.renderer.shadowMap.type = THREE.PCFShadowMap;   // Soft 는 폰에서 눈에 띄게 비싸다

  /* ★★ 2026-08-16 — **바닥과 벽이 만나는 자리에 밝은 줄**이 있었다 (박사님: *"바닥 벽
     모서리 쪽이 살짝 이상하긴 하네. 빛이랑 이런 게"*)
     ------------------------------------------------------------
     ⚠ 재질도 채움광(hemi)도 아니었다. **그림자가 벽 밑동에서 떨어져 있었다**(peter-panning).
     재서 짚었다(`tools/probe_corner.mjs` · 반지하 · 390×844 dpr2 · 한낮 t=0.50):
       · 그림자를 끄면 그 자리 바닥이 휘도 **208** 이다 — 이 방 안이 어두운 것은
         재질이 아니라 **그림자맵 하나**가 만드는 것이다. 그러니 그림자맵이 조금만
         어긋나도 어두운 바닥에 **햇빛 한 줄**이 그대로 드러난다.
       · 새던 자리를 광선으로 찍어 보니 벽 안쪽 면(x=−2.400)에서 **9mm 안쪽**인
         바닥 점이었다. 벽이 제 발밑을 못 덮고 있었다.
     ★ 왜 2cm 나 새나 — `scene.js` 가 `shadow.bias = −0.0004` 를 쓰는데, 그 값은
       **깊이 비율**이라 그림자 카메라의 near~far 폭을 곱해야 실제 길이가 된다.
       near 0.5 · far 50 → 폭 49.5m ⇒ **−0.0004 × 49.5 ≈ 20mm**.
       해 고도 37° 에서 바닥으로는 20mm ÷ tan37° ≈ **26mm** 물러난다.
       실측한 띠 폭(4 화소 ≈ 28mm)과 맞는다.
     ⇒ **부호를 뒤집는다.** 음수는 그림자를 caster 에서 떼어내(샘) 이 줄을 만들고,
       작은 양수는 그림자를 caster 쪽으로 조금 밀어 넣어 발밑을 덮는다.
       실측(모서리 선 위 182 점 · 「튐」= 봉우리 − 양옆 바탕):
         −0.0004(전) 중앙값 23.6 · 상위10% 90.0 · 튐>20 인 점 94/182
         +0.0002(후) 중앙값  2.0 · 상위10% 69.1 · 튐>20 인 점 54/182   ← 채택
       (남은 54 점은 **책상이 가린 구간**이다 — 자가 벽 대신 책상 상판을 잰다)
     ⚠ **near/far 를 방 크기로 조이거나 bias 를 0 에 붙이면 안 된다.** 둘 다 해 봤다:
       · near/far 를 조이면 실효 bias 가 20mm → 3.6mm 로 줄어드는데, 그러면
         **벽 윗머리(천장 밑 2cm)의 밝은 테**가 점점이 부서진다(사진으로 확인).
         그 테도 같은 샘이지만 지금 방 윤곽을 그리는 그림이라 부수면 안 된다.
       · bias 를 0 으로 두면 **방이 통째로 새까맣게** 그려진다(색 가짓수 3,204 — 두 번 재현).
     ⚠ 이건 **그림뿐**이다. 조도(DLI)는 lighting_sim 이 따로 낸다 — 반지하 14칸 DLI 가
       전·후로 소수 둘째 자리까지 같다(`tools/probe_place_dli.mjs`). */
  ctx.sunLight.shadow.bias = 0.0002;

  /* ★ 재는 자가 붙잡는 손잡이 — `tools/probe_corner.mjs` 가 이 셋을 쓴다.
     `__cam` 은 모서리 선의 월드 좌표를 화면 좌표로 옮기는 데(눈으로 화소를 집지 않으려고),
     `__sunShadow`·`__sunLight` 는 위 값을 다시 재보는 데 쓴다. 읽기만 하는 참조다. */
  try { window.__sunShadow = ctx.sunLight.shadow; window.__sunLight = ctx.sunLight;
        window.__cam = ctx.cam; } catch { /* 창이 없는 환경 */ }

  /* ── 상태 ── */
  const houseGroup = new THREE.Group();
  ctx.scene.add(houseGroup);

  let data = null;             // lightEngine 없이 혼자 지을 때만 채운다
  let furnNames = {};          // 프리셋 → {name_ko} — 자리 이름을 한글로 내주려고만 쓴다
  let roomId = null, roomDef = null, built = null;
  /* 창밖 골목. 방마다 다시 짓고, 창이 없으면 null 이다. */
  let outside = null;
  /* 'auto'(반지하만) · true(어느 방이든) · false(끔). opts.outside 로 덮어쓸 수 있다 */
  let outsideMode = (O.outside === undefined ? 'auto' : O.outside);
  /* 이웃 방(우리 방 양옆). ★ 창밖과 **따로** 산다 — setOutside(false) 로 골목만 꺼도
     이웃은 남는다. 그래야 「창밖이 얼마나 무거운가」를 재는 자가 안 흔들린다. */
  let neighbors = null;
  let neighborsMode = (O.neighbors === undefined ? 'auto' : O.neighbors);
  let slotById = new Map();    // slotId → 슬롯(월드좌표)
  let plants = new Map();      // slotId → { group, spec, potD, days }
  let rings = new Map();       // slotId → 하이라이트 링 메시
  let highlighted = new Set();
  let highlightRank = new Map();   // 열쇠 → 'good'|'ok'|'bad'. rank 를 받은 자리만 들어 있다
  let focused = null;
  let daylightT = 0.5;
  let disposed = false;
  /* ★ 등 스위치 — uid → true(켬)/false(끔). **없으면 「자동」**이다(§⑧-e).
     applyDaylight 이 이 표를 읽으므로 선언이 그 위에 있어야 한다(let 은 안 끌어올려진다). */
  let lampSw = new Map();
  /* 켠 시간 장부 — uid → 게임 시간(h). 하루가 넘어가면 호스트가 resetLampHours() 로 닫는다 */
  let lampClock = { t: null, h: new Map() };
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
  let guideFills = new Map();  // slotId → 그 안을 채우는 판(추천 자리 녹색 투명면)
  let guideMat = null, guideGeo = null;
  let guideNear = null;        // 지금 굵게 칠한 자리(커서에 제일 가까운 것)
  /* ★★ 2026-08-11 — **가구 윗면 전체 칸** (박사님: "테이블이나 가구 위 전체 칸을 보여주던지해야지")
     추천 자리(위 guideRings)와 **다른 층**이다. 아래 §guideCells 머리말을 읽어라.
       cellRings  칸 열쇠 → 링 메시.  cellInfo  칸 열쇠 → { x,y,z, rect, uid, occIdx, maxPotD } */
  let cellRings = new Map();
  let cellInfo  = new Map();
  /* ★★ 2026-08-16 — **추천 자리가 앉아 있는 칸의 크기** (slotId → {cw, cd}).
     박사님 사진: *"책상은 얼추 된거같은데, 사이드 쪽 2개가 이상하고. 서랍장은 여전히 안되고."*
     ------------------------------------------------------------
     칸과 추천 자리는 **다른 층**인데 **다른 자로 그리고 있었다** —
       칸      `info.cw × info.cd`  (그 상판을 나눈 실제 칸 크기. 책상 0.24 × 0.30)
       추천 자리 `markerHalf(potD)`   (끌고 있는 **물건의 발자국**. 0.25 정사각)
     그래서 상판을 한 줄로 훑으면 대부분은 칸 크기인데 **추천 자리 자리만 크기가 달라**
     튀어 보인다. 책상은 추천 자리가 둘이라 「사이드 쪽 2개가 이상」했고,
     서랍장은 칸이 3개뿐인데 그중 둘이 추천 자리라 **성한 칸이 하나만 남아** 아예 안 맞아 보였다.
     ⇒ 추천 자리도 **자기가 앉은 칸의 크기**로 그린다. 그러면 한 상판의 네모가 전부 같은 자다.
     ★ 초록 면(「여기가 좋다」)은 그대로다 — 뜻을 지우는 게 아니라 **크기만** 맞춘다.
     ⚠ 겨누고 있는 자리(isNear)는 예전대로 **발자국 크기**다. 「놓으면 이만큼 먹는다」는
       다른 말이고, 그 둘을 가른 것이 2026-08-14 의 요지였다. */
  let slotCellSize = new Map();
  let cellNear = null;
  let tierRects = null;        // 상판 사각형 목록. 광선을 쏴서 캐므로 **한 번만** 만든다
  let cellSpan = 0;            // 지금 깔아 둔 칸이 몇 칸짜리 물건 기준인가
  let furnGhost = null;        // { uid, group, mat, line, ok } — 가구 옮기기 유령
  let gridGroup = null;        // 바닥 격자. ★ 배치·이동 중에만 보인다(방을 보는 게 이 화면이다)
  let gridKey = '';            // 지금 그려 둔 격자가 어떤 조건으로 만들어졌나
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

  /* ============================================================
     ①-2 창밖 골목
     ------------------------------------------------------------
     창이 이 게임의 중심인데 그 너머가 비어 있으면 창은 그냥 밝은 사각형이다.
     반지하는 눈높이가 지면이라 골목 바닥과 담벼락 아래쪽이 보인다 —
     그 한 장면이 "반지하에 산다"를 말한다.

     ★ 빛은 절대 안 건드린다. game/outside.js 머리말 참조 —
       무광원 재질에 그림자를 안 던지고 안 받는다. 조도 계산(winFromHouse ·
       daily_light)은 물론 렌더 조명도 이 기하를 보지 않는다.
     ★ 기본은 반지하만이다. 위층 방(아파트·온실)에 골목 바닥을 깔면 거짓말이 된다.

     ★★ 2026-08-15 — 창밖이 **두 벌** 있었다. 여기서 부르던 render3d/outside_alley.js 와,
       아무도 안 부르던 game/outside.js 다. 뒤엣것이 훨씬 자세한데 git 에도 없이
       굴러다녔다. 둘 다 켜면 담벼락이 두 겹으로 서므로 **하나로 합쳤다** —
       game/outside.js 만 남기고 outside_alley.js 는 지웠다.
       바뀐 것 셋:
         · 낮밤을 여기서 안 먹인다. outside.js 가 dayGet 콜백으로 스스로 읽는다
           (그래야 그리기 직전에 색이 올라간다 — 그 파일 §updateMatrixWorld 참조)
         · 벽 바깥 판정은 outside.updateCamera(camPos) 하나로 옮겼다
         · 창 크기로 자르지 않는다. **거리로 푼다**(그 파일 머리글 ★★) —
           그래서 축소하면 골목과 건너편 빌라가 방 뒤로 보인다
  ============================================================ */
  const OUTSIDE_ROOMS = new Set(['banjiha']);
  function outsideWanted(id) {
    if (outsideMode === false) return false;
    if (outsideMode === true) return true;
    return OUTSIDE_ROOMS.has(id);
  }
  function disposeOutside() {
    if (!outside) return;
    try { outside.dispose(); } catch (e) { console.warn('[방뷰] 창밖을 치우다 났습니다:', e.message); }
    outside = null;
  }
  function buildOutside(id) {
    disposeOutside();
    if (!outsideWanted(id) || !built) return null;
    try {
      /* ★ 씬에 **직접** 붙는다(houseGroup 이 아니다). houseGroup 은 방을 갈아 끼울 때
         통째로 비우는 자리라, 거기에 두면 outside.js 가 쥔 손잡이와 씬의 실제 내용이
         갈린다. 대신 dispose 를 반드시 먼저 부른다 — 위 disposeOutside 가 그것이다.
         레이캐스트는 built.room 에만 쏘고, 그래도 mesh.raycast 를 비워 뒀다(두 겹). */
      outside = attachOutside(ctx, built, id, () => daylightT);
    } catch (e) {
      /* 배경이 안 떠서 방이 안 뜨면 본말전도다 */
      console.warn('[방뷰] 창밖 골목을 못 지었습니다 — 창밖 없이 갑니다:', e.message);
      outside = null;
    }
    if (outside) outside.updateCamera(ctx.cam.position);
    return outside;
  }
  /* ============================================================
     ①-3 이웃 방 — 우리 방 양옆
     ------------------------------------------------------------
     박사님(2026-08-15): *"집 주변에도 집을 몇개더 배치하자. 물론 그 바라보는 방향은
     투명되게해서 .. 뭔지알지?"* — 지금 방 양옆이 텅 빈 배경이라 방이 허공에 떠 있다.

     ★ 「투명」은 house.js 가 우리 방 벽에 하는 것과 **같은 것**이다 — 카메라를 향한 벽을
       밑동만 남기고 감춘다. 이웃 방도 같은 함수(house.js §wallIsStub)를 쓴다.
     ★ 빛은 안 건드린다. 창밖과 같은 문(outside.js §makeLayer)을 지나므로
       무광원 · 그림자 없음 · 레이캐스트 없음이 자동으로 걸린다.
     ⚠ 방을 갈아 끼울 때마다 다시 짓는다 — 방 크기가 바뀌면 이웃 자리도 바뀐다.
  ============================================================ */
  const NEIGHBOR_ROOMS = new Set(['banjiha']);
  function neighborsWanted(id) {
    if (neighborsMode === false) return false;
    if (neighborsMode === true) return true;
    return NEIGHBOR_ROOMS.has(id);
  }
  function disposeNeighbors() {
    if (!neighbors) return;
    try { neighbors.dispose(); } catch (e) { console.warn('[방뷰] 이웃 방을 치우다 났습니다:', e.message); }
    neighbors = null;
  }
  function buildNeighbors(id) {
    disposeNeighbors();
    if (!neighborsWanted(id) || !built) return null;
    try {
      neighbors = attachNeighbors(ctx, built, id, () => daylightT);
    } catch (e) {
      /* 배경이 안 떠서 방이 안 뜨면 본말전도다 */
      console.warn('[방뷰] 이웃 방을 못 지었습니다 — 이웃 없이 갑니다:', e.message);
      neighbors = null;
    }
    if (neighbors) neighbors.updateCamera(ctx.cam.position);
    return neighbors;
  }

  /* 창밖이 선 벽 — outside.js 가 고르는 기준(제일 큰 벽창)과 같은 자다 */
  function outsideWall() {
    const ws = ((built && built.luxWins) || []).filter(w => w.wall && w.wall !== 'ceiling');
    if (!ws.length) return null;
    let big = ws[0], area = -1;
    for (const w of ws) { const a = (w.w || 0) * (w.h || 0); if (a > area) { area = a; big = w; } }
    return big.wall;
  }

  /* opt.prebuilt = { built, def, wins } — 이미 조립된 결과를 그대로 쓴다.
     ★ 가구를 옮기면 light_adapter.moveFurniture 가 이미 방을 다시 지었다. 그걸 안 받으면
       여기서 buildHouse 를 **한 번 더** 돌게 된다(재조립은 비싸다 — 손 뗄 때 한 번뿐이어야 한다). */
  async function assemble(id, opt = {}) {
    /* 이전 방 정리 */
    disposePreview();
    disposeFurnGhost();
    clearFurnHighlight();        // ★ 방을 다시 지으면 밝혀 둔 메시가 사라진다 — 먼저 되돌린다
    spanCache = null;            // 방이 바뀌면 「어느 칸이 벽 속인가」도 다시 센다
    clearGrid();
    disposeWalkGhost();
    selChar = null;
    /* 캐릭터도 이 그룹에 들어 있다. 그냥 비우면 치워지지 않은 채 씬에서만 사라져
       mixer 와 GLB 가 그대로 남는다 — 방을 몇 번 바꾸면 그게 그대로 메모리다.
       치우되 **누가 있었는지는 기억해** 새 방에 다시 세운다. */
    /* ★ 사람을 먼저 적는다 — 몬이는 사람 뒤에 서므로 사람이 먼저 세워져야 제자리다 */
    const wasHere = [...chars.keys()].sort((a, b) => (a === 'moni') - (b === 'moni'));
    for (const [, c] of chars) { try { c.dispose(); } catch (e) { /* 나머지는 계속 치운다 */ } }
    chars.clear();
    clearPlants();
    for (const k of [...plantBlobs.keys()]) dropPlantBlob(k);   // 남은 접지 그림자까지
    clearRings();
    clearGuideRings();
    disposeOutside();               // 방마다 다시 짓는다 — 창 자리가 다르다
    disposeNeighbors();             // 이웃 방도 방 크기를 따라간다
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

    /* ★ 방을 갈아타면 등 스위치·시간 장부를 비운다 (2026-08-08 · §⑧-e).
       uid 는 방마다 다르므로 들고 가면 남의 방 등을 가리키는 표가 된다.
       ⚠ **같은 방을 다시 조립하는 것(가구·등 옮기기)은 안 비운다** — uid 가 그대로라
         켜 둔 등이 가구 하나 옮겼다고 꺼지면 안 된다. */
    if (roomId !== id) { lampSw = new Map(); lampClock = { t: null, h: new Map() }; }
    roomId = id;
    houseGroup.add(built.room);
    buildOutside(id);                       // 창밖 골목 (창 없는 방이면 조용히 아무것도 안 한다)
    buildNeighbors(id);                     // 양옆 이웃 방 (기본은 반지하만)
    /* 걸어 다닐 바닥을 다시 물린다 — 방이 바뀌면 벽도 가구도 다 다르다.
       ★ 2026-08-09 — 놓인 그루도 같이 물린다(§놓은 것이 길을 막는다). */
    nav.setWorld({ colliders: navColliders(), size: built.size });

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

    buildFurnitureBlobs();                  // ★ 가구 접지 그림자 한 판 (§buildFurnitureBlobs)

    frameRoom(true);
    applyDaylight();
    needsRender = true;

    /* 있던 사람은 새 방에도 세운다. 자리는 새 방 기준으로 다시 고른다.
       기다리지 않는다 — 캐릭터를 싣느라 방이 안 뜨면 안 된다.
       ★ 다만 **서로는 줄을 세운다** (2026-08-16). 예전에는 여기서 둘을 한꺼번에 던졌고,
         그 때문에 자취생이 방 재조립마다 사라졌다(§setCharacter 의 ★★ 를 읽어라).
         순번을 자리마다 세도록 고쳐서 이제는 겹쳐 불러도 안 죽지만, 순서는 여전히 뜻이 있다 —
         **몬이는 사람 뒤에 선다.** 사람이 아직 없을 때 몬이가 서면 첫 자리를 화분 옆에 잡고
         거기서부터 걸어와야 한다. 사람부터 세우면 처음부터 제자리다. */
    (async () => {
      for (const k of wasHere) {
        try { await setCharacter(k); }
        catch (e) { console.warn('[방뷰] 방을 바꾼 뒤 캐릭터를 다시 못 세웠습니다:', e.message); }
      }
    })();
  }

  /* ============================================================
     ①-3 ★ 가구 접지 그림자 — buildFurnitureBlobs (2026-08-06)
     ------------------------------------------------------------
     박사님: "살짝 빛에 따른 가구나 사람 그림자 대충 나오게 해 줘"

     ★★ **드로우콜 1개**다. 가구마다 판때기를 만들면 반지하만 해도 10장이 늘고
       학원교실은 30장이 넘는다 — 렉을 잡으랬는데 렉을 만드는 셈이다.
       그래서 모든 가구의 발자국을 **한 기하로 합치고** 텍스처 하나를 UV 로 반복해 쓴다.
       (합쳐도 부드러운 가장자리가 나오는 이유가 이것이다 — 사각형 네 점에 0~1 UV 를
        그대로 물리므로 판마다 방사형 그라디언트가 제자리에 맺힌다.)

     ★ 방을 지을 때 한 번만 만든다. 가구를 옮기면 방이 다시 조립되므로 여기도 다시 돈다.
     ⚠ **바닥에 선 가구만** 깐다. 벽걸이 선반·집게등·천장등 밑에 바닥 그림자를 깔면
       공중에 뜬 물건이 바닥에 붙은 것처럼 보여 오히려 거짓말이 된다.
     ⚠⚠ 조도는 한 톨도 안 바뀐다 — 이건 houseGroup 에 붙는 무광원 판때기고,
       조도는 light_adapter 가 **방 정의**로 낸다. tools/test_ground.mjs 가 못 박는다.
  ============================================================ */
  let furnBlobs = null;
  /* 접지 그림자를 켜 둘까 — 기본은 켠다. setBlobShadows 로 끄면 새로 만드는 것도 꺼진 채 난다
     (재는 도구가 before/after 를 찍는 동안 새 화분이 혼자 그림자를 달고 나오면 안 된다). */
  let blobsOn = true;
  function clearFurnitureBlobs() {
    if (!furnBlobs) return;
    houseGroup.remove(furnBlobs);
    disposeObject(furnBlobs);
    furnBlobs = null;
  }
  /* 바닥에 붙어 선 가구로 본다 — 밑동이 바닥에서 이만큼 안쪽이면 '바닥에 선 것' */
  const BLOB_FLOOR_EPS = 0.06;
  function buildFurnitureBlobs() {
    clearFurnitureBlobs();
    if (!built || !built.furniture) return 0;
    const pos = [], uv = [], idx = [];
    let n = 0;
    const bb = new THREE.Box3();
    for (const g of built.furniture.children) {
      if (!g.visible) continue;
      bb.makeEmpty();
      bb.setFromObject(g);
      if (!isFinite(bb.min.y)) continue;
      if (bb.min.y > BLOB_FLOOR_EPS) continue;             // 공중에 달린 것 — 바닥 그림자 없음
      const w = bb.max.x - bb.min.x, d = bb.max.z - bb.min.z;
      if (!(w > 0.02 && d > 0.02)) continue;
      if (w > 6 || d > 6) continue;                        // 러그처럼 방을 덮는 것은 뺀다
      const cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2;
      /* 발자국보다 조금 넓게 — 그라디언트가 가장자리에서 0 이라 딱 맞추면 그림자가 안 보인다 */
      const hw = w * 0.88, hd = d * 0.88;
      const k = pos.length / 3;
      pos.push(cx - hw, 0, cz - hd,  cx + hw, 0, cz - hd,
               cx + hw, 0, cz + hd,  cx - hw, 0, cz + hd);
      uv.push(0, 0,  1, 0,  1, 1,  0, 1);
      idx.push(k, k + 2, k + 1, k, k + 3, k + 2);
      n++;
    }
    if (!n) return 0;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      map: blobTexture(), transparent: true, opacity: BLOB_A_FURN, color: 0x000000,
      depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    m.position.y = 0.0025;
    m.renderOrder = 1;
    m.userData.isBlobShadow = true;
    m.userData.blobCount = n;
    m.visible = blobsOn;
    m.raycast = () => {};                 // 배치·걷기 광선에 안 걸린다
    furnBlobs = m;
    houseGroup.add(m);
    needsRender = true;
    return n;
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

  /* ★ 방 **안쪽** 사각형 — 벽 속을 뺀 진짜 바닥 (2026-08-08)
     ------------------------------------------------------------
     roomBox 는 **바깥 치수**다. 반지하는 5×4m 인데 벽이 두께 0.2m 로 그 선을 타고 서 있어
     (house.js blockLine: at=±CW/2 에 두께 WT 를 걸친다) 안쪽 면은 ∓2.40 / ∓1.90 이다.
     즉 바깥 치수 위에 격자를 깔면 제일 바깥 한 줄은 절반이 **벽 속**이다.
     그 줄은 「막힌 칸」이 아니라 「방이 아닌 칸」이다 — 뜻이 다르다.

     두께를 0.2 로 적어 두지 않는 이유: house.js 가 값을 바꾸면 여기가 조용히 안 맞는다.
     그래서 **벽 조각(콜라이더)에서 재서** 쓴다. 네 변마다,
       · 축에 나란하고(rot≈0) · 그 변 위에 중심이 있고 · 그 변에 대해 얇은 조각
     의 반두께 중 **제일 큰 값**을 안쪽으로 밀어낸다. 문 자리(구멍)에는 조각이 없지만
     한 변에 조각이 하나라도 있으면 그 변의 두께를 알 수 있으므로 문 자리도 같이 밀린다.
     ⚠ 칸막이·도려내기 경계는 여기서 안 본다 — 그건 방 안의 장애물이라 「막힌 칸」이 맞다. */
  /* 바깥 경계 네 변 위에 서 있는 벽 조각만 골라 준다.
     ⚠ 칸막이·도려내기 경계는 **안 고른다** — 그건 방 안의 장애물이라 「막힌 칸」이 맞다.
       바깥 벽만이 「방이 아니다」다. */
  function perimeterWalls() {
    const b = roomBox();
    const cs = (built && built.colliders) || [];
    const x0 = -b.w / 2, x1 = b.w / 2, z0 = -b.d / 2, z1 = b.d / 2;
    const out = [];
    for (const c of cs) {
      if (!c || c.kind === 'furn') continue;
      if (Math.abs(c.rot || 0) > 1e-3) continue;              // 벽 조각은 축에 나란하다
      const vert = c.w <= c.d && (Math.abs(c.x - x0) < 1e-3 || Math.abs(c.x - x1) < 1e-3);
      const horz = c.d <= c.w && (Math.abs(c.z - z0) < 1e-3 || Math.abs(c.z - z1) < 1e-3);
      if (vert || horz) out.push(c);
    }
    return out;
  }

  /* 방 **안쪽** 사각형 — 바깥 벽의 안쪽 면. 두께는 벽 조각에서 재서 쓴다. */
  function roomInner() {
    const b = roomBox();
    const x0 = -b.w / 2, x1 = b.w / 2, z0 = -b.d / 2, z1 = b.d / 2;
    const in0 = { x0: 0, x1: 0, z0: 0, z1: 0 };
    for (const c of perimeterWalls()) {
      if (c.w <= c.d) {
        if (Math.abs(c.x - x0) < 1e-3) in0.x0 = Math.max(in0.x0, c.w / 2);
        if (Math.abs(c.x - x1) < 1e-3) in0.x1 = Math.max(in0.x1, c.w / 2);
      }
      if (c.d <= c.w) {
        if (Math.abs(c.z - z0) < 1e-3) in0.z0 = Math.max(in0.z0, c.d / 2);
        if (Math.abs(c.z - z1) < 1e-3) in0.z1 = Math.max(in0.z1, c.d / 2);
      }
    }
    /* 그 변에 벽 조각이 하나도 없으면 밀지 않는다 — 짐작으로 방을 좁히지 않는다(예전 그대로) */
    return { x0: x0 + in0.x0, x1: x1 - in0.x1, z0: z0 + in0.z0, z1: z1 - in0.z1,
             w: +(b.w - in0.x0 - in0.x1).toFixed(4), d: +(b.d - in0.z0 - in0.z1).toFixed(4) };
  }

  /* 어느 칸을 그리나 — 칸 선은 예전 그대로 방 원점 기준 GRID_CELL 배수에 있고
     (앉는 자리가 0.125 배수라 선과 눈금이 맞는다), 그중 **바깥 벽에 물리는 칸만 뺀다.**
     ★ 문 자리는 벽 조각이 없어서 그대로 남는다 — 거기는 실제로 놓을 수 있는 바닥이다.
       (재 봤다: 반지하 문 앞 칸 셋이 그렇다. 벽이라고 지워 버리면 놓을 자리가 준다.) */
  let spanCache = null;                 // 방마다 한 번만 센다(방을 다시 지으면 assemble 이 버린다)
  function gridSpan() {
    if (spanCache) return spanCache;
    /* ★★ 2026-08-16 — **격자를 바깥 상자가 아니라 「안쪽 벽」 기준으로 깐다.**
       ------------------------------------------------------------
       박사님: *"방 사이즈 밑 그리드랑 가구 옮길 수 있는 위치랑 매칭이 정확히 안 돼."*
               *"방의 사이즈를 조절해서 아다리 맞춰. 키우든 줄이든."*

       예전에는 바깥 상자(5.0×4.0)에 격자를 깔고 벽에 닿는 칸을 버렸다. 그런데
       벽이 0.1m 라 **안쪽이 4.8×3.8** 이고 4.8/0.25 = 19.2 — **칸에 안 떨어진다.**
       그래서 가장자리마다 0.15m 가 남거나 잘려 격자와 방이 어긋나 보였다.
       ⇒ **격자를 안쪽 벽 기준으로 깐다.** 안쪽이 칸에 안 떨어지면 **칸 수를 내림**하고
         남는 자투리를 양쪽에 **반씩** 나눠 가운데로 민다. 4.8m 면 19칸(4.75m)이 서고
         양쪽에 2.5cm 씩 남는다 — 4.8m 에 견주면 **0.5%** 라 눈에 안 띈다.

       ⚠⚠ **2026-08-16 밤 — 방을 5.2×4.2 로 키웠다가 되돌렸다.**
         안쪽을 5.0×4.0 으로 만들면 딱 떨어지지만, **벽만 밖으로 가고 가구·자리는
         제자리에 남았다.** 그래서 창턱이 창에서 0.15m 멀어졌고
         **자연광이 4.80 → 3.68 로 23% 내려앉았다**(실측 `probe_lamphome`).
         빛이 이 게임의 전부인데 격자 눈금 때문에 그것을 깎을 수는 없다.
       ★ 되돌린 뒤 다시 재서 **4.80 으로 돌아온 것을 확인했다.** */
    const inner0 = roomInner();
    /* ★ 안 떨어지면 **내림**하고 남는 것을 양쪽에 반씩 나눈다 — 격자가 방 가운데 앉는다 */
    const nx = Math.max(1, Math.floor(inner0.w / GRID_CELL + 1e-6));
    const nz = Math.max(1, Math.floor(inner0.d / GRID_CELL + 1e-6));
    const x0 = inner0.x0 + (inner0.w - nx * GRID_CELL) / 2;
    const z0 = inner0.z0 + (inner0.d - nz * GRID_CELL) / 2;
    /* 바깥 벽은 축에 나란한 것만 골라 왔으므로(perimeterWalls) 겹침은 구간 두 개면 끝난다.
       SAT(rectOverlap)까지 쓸 일이 아니다 — 방마다 칸 수천 개 × 벽 조각 수십 개를 돈다. */
    /* ★★ 2026-08-16 — **벽을 한 칸씩 부풀리던 것을 걷었다.**
       ------------------------------------------------------------
       박사님: *"방 사이즈 밑 그리드랑 가구 옮길 수 있는 위치랑 매칭이 정확히 안 돼.
                 **반 칸씩 더 붙이고 추가 한 칸을 살려서** 만들면 방바닥에 딱 맞게 떨어질 것 같은데?"*

       예전 식 `hx = (c.w + GRID_CELL)/2` 는 벽 반너비에 **반 칸(0.125m)을 더** 얹었다.
       그러면 벽에 **조금이라도 닿는 칸이 통째로** 버려진다. 실측(반지하 5.0×4.0):
         벽 두께 0.1m · 벽 중심 x=±2.45 · 맨 바깥 칸 중심 x=∓2.375
         옛 문턱 0.175 > 거리 0.075  ⇒ **버려진다**
       그 칸은 0.25m 중 **0.10m 만 벽**이고 나머지 0.15m 는 진짜 바닥이다.
       가장자리 네 줄에서 그만큼이 통째로 사라져 **격자가 방보다 안쪽으로 물러나 보였다.**

       ⇒ 이제 **칸 중심이 벽 안에 들어간 것만** 버린다(부풀리지 않는다).
         박사님 말씀의 「추가 한 칸을 살려서」가 이 한 줄이다.
       ⚠ 그래도 「벽에 걸친 칸」에 물건이 반쯤 박히지는 않는다 — 놓을 때는
         `snapSpan`·`cellBox` 가 발자국 전체로 다시 판정한다(§place.js). 여기서 정하는 것은
         **격자를 어디까지 그리나**뿐이다. */
    const walls = perimeterWalls().map(c => ({ x: c.x, z: c.z,
                                               hx: c.w / 2, hz: c.d / 2 }));
    const keep = new Uint8Array(nx * nz);
    let cells = 0;
    for (let i = 0; i < nx; i++) {
      const cx = x0 + (i + 0.5) * GRID_CELL;
      for (let j = 0; j < nz; j++) {
        const cz = z0 + (j + 0.5) * GRID_CELL;
        let inWall = false;
        for (const c of walls)
          if (Math.abs(cx - c.x) < c.hx && Math.abs(cz - c.z) < c.hz) { inWall = true; break; }
        if (!inWall) { keep[j * nx + i] = 1; cells++; }
      }
    }
    spanCache = { x0, z0, nx, nz, keep, cells, inner: roomInner(),
                  at: (i, j) => (i >= 0 && j >= 0 && i < nx && j < nz && keep[j * nx + i] === 1) };
    return spanCache;
  }

  const defaultEl = () => (ctx.cam.aspect < 0.95 ? BASE_EL_PORTRAIT : BASE_EL_LANDSCAPE);
  /* 방을 화면 세로 어디에 두나 — §FRAME_BIAS. 가르는 문턱은 FOV·기본 상하각과 **같은 0.95** 다 */
  const frameBias = () => (ctx.cam.aspect < 0.95 ? FRAME_BIAS_PORTRAIT : FRAME_BIAS);

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
      look.copy(target); look.y -= d * tanV * frameBias();     // 화면에서 밀어 둔 만큼
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
    const dist = clamp(fitDist * zoomK, fitDist * ZOOM_IN, fitDist * zoomOutK());
    focused = null;
    setCam({ az, el, dist, target }, snap);
  }

  /* 지금 프레이밍에서의 줌 한계. 화면 비율마다 fit 이 달라 절대값으로 박으면 안 된다. */
  function zoomRange() {
    const f = fitDist || cam.dist;
    return [f * ZOOM_IN, f * zoomOutK()];
  }
  /* 넓은 화면(PC·가로)에서만 더 멀리 물러난다 (§ZOOM_OUT_WIDE) */
  function zoomOutK() {
    return ctx.cam.aspect < 0.95 ? ZOOM_OUT_PORTRAIT : ZOOM_OUT_WIDE;
  }

  /* 손을 떼면 **턱만** 되돌린다. 방위는 놓은 자리에 그대로 선다(아래 ★★, 2026-08-06) */
  function settleCam() {
    if (focused) {                       // 자리에 들어가 있을 땐 스냅하지 않는다
      const [lo, hi] = [0.5, 3.6];
      const el = clamp(cam.el, EL_MIN, EL_MAX), dist = clamp(cam.dist, lo, hi);
      if (Math.abs(el - cam.el) > 1e-3 || Math.abs(dist - cam.dist) > 1e-3)
        setCam({ az: cam.az, el, dist, target: cam.target }, false, SNAP_MS);
      return;
    }
    /* ★★ **손을 뗀 자리에 선다** (2026-08-06 박사님: "각도가 8방으로 자동 이동해 버려.
       내가 멈춘 곳에 멈추게 해 줘").
       ⚠ 예전에는 45°(8방)로 끌어당겼다. 2026-08-03 지시였는데, 실제로 돌려 보니
         **내가 놓은 데서 화면이 저 혼자 미끄러지는** 것이 거슬린다는 것이 박사님 판단이다.
       ⇒ 방위(az)는 안 건드린다. **상하각·거리 턱은 그대로 지킨다** —
         그건 "정돈"이 아니라 **못 가는 데를 막는 것**이라 뜻이 다르다
         (위로 넘어가면 천장 위에서 보게 되고, 너무 당기면 벽을 뚫는다).
       ★ `SNAP` 상수는 남겨 둔다 — `YAW_OFFSET`(시작 각도)이 그 격자 위의 한 칸이라
         지우면 시작 시점이 바뀐다. */
    const snapped = cam.az;
    const base = windowAzimuth() + YAW_OFFSET;
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
    /* 방을 화면 세로 어디에 둘지 — §FRAME_BIAS. 카메라를 옮기는 대신 **보는 점**을 올리거나
       내린다(내리면 방이 위로 밀린다). 넓은 화면은 위로, 폰 세로는 아래로 민다. */
    const tanV = Math.tan(THREE.MathUtils.degToRad(ctx.cam.fov) / 2);
    cam.look.copy(cam.target);
    cam.look.y -= dist * tanV * frameBias();
    ctx.cam.lookAt(cam.look);
    if (built) updateShellVisibility(built.shells, ctx.cam, 'auto', built.trims);
    /* 벽이 밑동만 남으면(카메라가 그 벽 바깥이면) 골목이 카메라와 방 사이에 끼어 방을 덮는다 */
    if (outside) outside.updateCamera(ctx.cam.position);
    /* 이웃 방 벽도 우리 방 벽과 **같은 순간에** 밑동이 된다(같은 wallIsStub 을 쓴다).
       한쪽만 늦으면 옆방 벽이 우리 방을 막은 프레임이 한 장 나온다 */
    if (neighbors) neighbors.updateCamera(ctx.cam.position);
  }

  /* ============================================================
     ③ 화분
  ============================================================ */
  const MONSTERA_POT_D = 0.20;    // assets/monstera/pot.glb 회전무관 지름 0.202
  /* ══ ★★ 콩나물 시루 지름 — **0.24 → 0.20** (2026-08-16 박사님 확정) ═══════════════
     박사님: *"시루 이동이 3단 테이블에 왜 안 올라감? **시루 사이즈가 커서 못 올라가면
             시루 사이즈를 줄여서 올라가도록** 해 주고."*
     ★ 재서 확인했다 — 시루 **0.24m** · 3단 선반 한도 **0.22m** · 창턱 한도 **0.21m**.
       **2~3cm 가 모자라** 밝은 자리 열 곳(선반 아홉 + 창턱)에 통째로 못 올라갔다.
       ⇒ 콩나물은 **어두운 데 두는 작물**이지만, 그렇다고 「못 올리는 자리」가
         열 곳이나 되면 그건 규칙이 아니라 **막힌 길**이다.
     ⇒ 무순과 **같은 0.20** 으로 맞춘다. 그러면 창턱(0.21)·선반(0.22) 둘 다 올라간다.
     ⚠ 이것은 **그림 크기**다 — 조도·수확량·자리 판정에 쓰는 값이 아니다.
       그래도 `maxPotD` 판정에 쓰이므로 **어디에 올라가나**는 바뀐다. 그게 이 고침의 목적이다.
     ⚠ 무리(여러 개)의 지름은 이 값 × 무리 폭이라 **같이 줄어든다** — 시루를 늘려도
       가구 위 자리가 덜 사라진다(multisiru §6 이 걱정한 그것이 완화된다). */
  const SIRU_D = 0.20;            // 열린 콩나물 시루 (무순 재배판과 같은 폭)

  /* ★ 새싹 재배판(소) — assets/crops/container_tray_s.glb (manifest id 441)
     ------------------------------------------------------------
     size_m 0.36 × 0.055 × 0.24 · 슬롯 12칸 · blocks_light **false**.
     시루(0.24 원형·blocks_light true)와 두 가지가 다르다.
       ① 네모다. 폭과 깊이가 달라 "지름 하나"로 못 잰다 — §buildMusun 의 limit 주석 참고
       ② 빛을 안 막는다. 무순은 밝아야 좋은 작물이라 그게 맞다 — 방뷰는 화분을
          가림막으로 넣지 않으므로(조도는 light_adapter 몫) 여기서 **아무것도 안 한다**.
          그 '안 함'이 계약이라 tools/test_musun_view.mjs 가 숫자로 못 박아 둔다. */
  const TRAY_S_W = 0.36, TRAY_S_DEPTH = 0.24;
  /* 재배판의 '자리 지름' = **대각선**. 이 값 하나가 potFits·maxPotD·fitPotToLimit 을 다 탄다 */
  const TRAY_S_D = Math.hypot(TRAY_S_W, TRAY_S_DEPTH);   // 0.4327
  /* ★★ 무순 판은 **0.20m 로 세운다** (2026-08-05 박사님 확정 · ㉮ 작은 재배판).
     ------------------------------------------------------------
     GLB 원본대로 0.4327 로 세웠더니 반지하 14칸 중 받아 주는 곳이 **책상 2칸뿐**이었다.
     그런데 무순은 밝아야 좋은 작물이고 이 방에서 밝은 곳은 창턱(DLI 4.80) 하나인데
     창턱은 0.21m 다. 즉 **제일 좋은 자리에 못 올라가는 작물**이 되어 있었다.

     ★ 왜 0.20 인가 — 격자가 0.05m 라 **정확히 4칸**이다. 몬스테라 화분(0.20)이 창턱에
       딱 맞는 것과 같은 값이고, 새 눈금을 만들지 않는다. 실제 판은 16.6 × 11.1cm 가 되는데
       그건 실물 새싹 재배판(소형)의 치수 범위 안이다.
     ★ 에셋을 새로 안 만들었다. `container_tray_s.glb` 를 **그릴 때** 줄인다 —
       assets/ 는 이 창 소유가 아니고, 줄이는 것만으로 답이 나오는데 파일을 늘릴 이유가 없다.
     ⚠ 대신 **무순 포기는 판을 따라 줄이지 않는다.** 같이 줄이면 한 포기가 7mm 가 되어
       "작은 판"이 아니라 "인형 집"이 된다. 포기는 실물 크기로 두고,
       제 칸을 넘칠 때만 칸에 맞춘다(§buildMusun 의 bodyK). */
  const MUSUN_D = 0.20;
  /* manifest 의 slots 12칸을 그대로 옮긴 것이다(재배판 자기 좌표계[m]).
     x 4열 × z 3행 · y 0.026 은 판 안쪽 흙 높이다. 숫자를 여기서 지어내지 않았다. */
  const TRAY_S_SLOTS = Object.freeze([
    { x: -0.108, y: 0.026, z: -0.06 }, { x: -0.108, y: 0.026, z: 0 }, { x: -0.108, y: 0.026, z: 0.06 },
    { x: -0.036, y: 0.026, z: -0.06 }, { x: -0.036, y: 0.026, z: 0 }, { x: -0.036, y: 0.026, z: 0.06 },
    { x:  0.036, y: 0.026, z: -0.06 }, { x:  0.036, y: 0.026, z: 0 }, { x:  0.036, y: 0.026, z: 0.06 },
    { x:  0.108, y: 0.026, z: -0.06 }, { x:  0.108, y: 0.026, z: 0 }, { x:  0.108, y: 0.026, z: 0.06 }
  ]);

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

  /* ══════════════════════════════════════════════════════════════════════
     ★★ §방에도 무늬 잎이 난다 (2026-08-18 · 박사님: "방에 무늬 보여주기 OK")
     ------------------------------------------------------------
     그전까지 무늬는 **확대창에서만** 보였다. 방은 `spec.leafState` 로 정본의 잎 상태를
     이미 받고 있었고(`varie` 칸까지 들어 있었다) 조립기도 그 칸을 읽고 있었는데,
     조립기가 `skins/` 를 ASSET_FILES 에서 **통째로 지우고** 열어서 `ensureSkin` 이
     그 자리에서 거짓을 돌려주었다 — 그래서 무늬 잎이 조용히 기본잎으로 내려앉았다.

     ⚠ 그 「지우기」는 **부팅을 가볍게 하려던 것**이었는데, 2026-08-17 부터는 원본
       `loadAssets` 가 skins/ 를 스스로 건너뛴다. 즉 지우기는 무게에 아무 몫이 없고
       「무늬를 받을 수 없게」만 하고 있었다(plant_assemble.js §한계에 실측이 있다).

     ★ 늦게 오는 것이 문제다 — 무늬는 그 잎이 처음 그려질 때 요청되므로, **처음 한 번은
       기본잎으로 그려진다.** 도착하면 그 그루만 다시 짓는다. 그 사이 화면이 조용하면
       「무늬가 안 나온다」와 구별이 안 되므로(이 저장소의 지병) 한 마디 띄운다. */
  const SKIN_TIP_DELAY_MS = 400;   // 이보다 빨리 오면 아무 말도 안 한다(깜빡임이 더 시끄럽다)
  let skinOff = null, skinTipEl = null, skinTipT = null, skinRebuildT = null;

  function hasVarieLeaf(list) {
    return Array.isArray(list) && list.some(s => s && s.varie);
  }

  /* 무늬가 도착할 때마다 부른다. 조립기 하나에 한 번만 건다. */
  function watchSkins(asm) {
    if (skinOff || !asm || typeof asm.onSkinChange !== 'function') return;
    skinOff = asm.onSkinChange(() => { noteSkinTip(asm); rebuildVariePlants(); });
  }

  /* 「🎨 무늬 잎을 받는 중…」 — 확대창(plant_grow.html §noteSkinLoading)과 같은 말투다.
     ⚠ 자리를 **오른쪽 위(? 단추 아래)** 로 잡았다. 왼쪽 아래에 뒀더니 게임에서 **[다음 날]
       단추를 덮었다**(실측 그림 varie_room/ingame_loading.png 의 첫 판). 누를 것을 가리는
       알림은 알림이 아니라 방해다. 왼쪽 위는 확대창 것이 쓰고, 왼쪽 아래·아래 가운데는
       게임 단추가 쓴다 — 남는 곳이 여기다.
     ⚠ 400ms 안에 끝나면 안 띄운다 — 로컬에서는 대개 그렇다(실측은 보고서에 적었다). */
  function noteSkinTip(asm) {
    let n = 0;
    try { n = asm.skinsPending(); } catch (e) { n = 0; }
    if (!n) {
      if (skinTipT) { clearTimeout(skinTipT); skinTipT = null; }
      if (skinTipEl) skinTipEl.style.display = 'none';
      return;
    }
    if (skinTipEl) { skinTipEl.textContent = `🎨 무늬 잎을 받는 중… (${n}장)`; return; }
    if (skinTipT) return;
    skinTipT = setTimeout(() => {
      skinTipT = null;
      let m = 0;
      try { m = asm.skinsPending(); } catch (e) { m = 0; }
      if (!m || disposed) return;
      try {
        const el = document.createElement('div');
        el.id = 'rvSkinTip';
        el.style.cssText = 'position:fixed;right:10px;top:124px;z-index:60;pointer-events:none;' +
          'font:600 12px/1.4 system-ui,-apple-system,sans-serif;color:#e9e2d4;' +
          'background:rgba(24,20,16,.78);border:1px solid rgba(255,255,255,.14);' +
          'border-radius:999px;padding:5px 11px;backdrop-filter:blur(3px)';
        el.textContent = `🎨 무늬 잎을 받는 중… (${m}장)`;
        (document.body || document.documentElement).appendChild(el);
        skinTipEl = el;
      } catch (e) { /* 화면이 없는 자리(검사)에서는 알릴 데가 없다 */ }
    }, SKIN_TIP_DELAY_MS);
  }

  function dropSkinTip() {
    if (skinTipT) { clearTimeout(skinTipT); skinTipT = null; }
    if (skinRebuildT) { clearTimeout(skinRebuildT); skinRebuildT = null; }
    if (skinOff) { try { skinOff(); } catch (e) { } skinOff = null; }
    if (skinTipEl) { try { skinTipEl.remove(); } catch (e) { } skinTipEl = null; }
  }

  /* 무늬가 온 그루만 다시 짓는다.
     ⚠ **무늬가 난 잎이 있는 그루만** 본다 — 무늬가 안 난 그루는 다시 지어도 그림이 같다.
     ⚠ 여러 장이 잇달아 오므로 한 번에 모아서 짓는다(잎마다 지으면 한 프레임에 여러 번이다). */
  function rebuildVariePlants() {
    if (disposed || skinRebuildT) return;
    skinRebuildT = setTimeout(async () => {
      skinRebuildT = null;
      if (disposed) return;
      for (const [key, rec] of [...plants]) {
        if ((rec.spec.kind || 'monstera') !== 'monstera') continue;
        if (!hasVarieLeaf(rec.spec.leafState)) continue;
        rec.skinDirty = true;                       // needsRebuild 가 이 표를 본다
        try {
          if (rec.potId && key === freeSlotId(rec.potId)) await setPlantAt(rec.potId, rec.at, rec.spec);
          else await setPlant(key, rec.spec);
        } catch (e) {
          console.warn('[방뷰] 무늬 잎이 온 뒤 그루를 다시 못 지었습니다:', e && e.message);
        }
      }
    }, 90);
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
    const def = PLANT_KINDS[kind];
    if (!def) throw new Error(`모르는 식물 종류: ${kind} ` +
                              `(아는 것: ${Object.keys(PLANT_KINDS).join(', ')})`);
    return def.build(spec, limit, days);
  }

  async function buildMonstera(spec, limit, days) {
    const p01 = clamp(spec.progress01 ?? 1, 0, 1);
    /* 화분 지름은 자리 한도 안에서 고른다. 성장은 잎·마디로만 보인다 —
       화분이 같이 자라면 자리 한도 계약이 무너진다. */
    const potD = Math.min(MONSTERA_POT_D, limit === Infinity ? MONSTERA_POT_D : limit);
    const asm = await assembler();
    if (asm) {
      try {
        /* ★★ 잎별 상태(갈라짐·무늬·바램)는 **방이 안 정한다** (2026-08-16).
           ------------------------------------------------------------
           조립기는 빛 이력이 없는 인스턴스라 스스로 굴리면 답이 정해져 있다 —
           실측(seed 92158): 방 조립은 **유효 1000일에도 갈라진 잎 0장**, 무늬 0장.
           같은 시드를 확대창에서 하루씩 걸으면 창턱(DLI 4.8)에서도 유효 300일에
           5장 중 2장이 갈라진다(plant_assemble.js §한계에 표가 있다).
           ⇒ 호출부가 정본의 잎 상태를 넘겨 주면 그대로 그린다. 안 넘기면 예전 그대로다.
           ★ **무늬도 이제 방에 나온다** (2026-08-18 · §방에도 무늬 잎이 난다).
             그 잎이 그 무늬를 쓸 때 한 장씩 온다 — 처음 한 번은 기본잎으로 그려지고,
             도착하면 이 그루만 다시 짓는다. */
        watchSkins(asm);
        const g = asm.assemble({ growthDays: days, seed: spec.seed, potD,
                                 leafState: spec.leafState,
                                 lightAz: lightAzimuth(), photo: 0.5 });
        g.userData.growthDays = days;
        if (g.userData.skinsPending) noteSkinTip(asm);
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

  /* 시루 + 콩나물. 콩나물은 어두울수록 좋은 작물이라 밴드 해석이 몬스테라와 반대다.
     여기서는 '자란 정도'만 그린다 — 판정은 게임 쪽 몫이다.

     ★ 시루가 **여럿**일 수 있다 (2026-08-05 · §clusterUnit).
       `spec.count` 가 시루 수다. 안 주거나 1 이면 **예전 식이 글자 그대로 남는다**
       (span=1 이라 곱해도 안 바뀌고, 자리표는 원점 한 점뿐이다).
     ★★ `limit` 의 뜻은 **안 바꾼다** — 여전히 「이 자리가 받아 줄 회전무관 지름[m]」이고,
       그 지름은 **무리 전체**의 것이다. 뜻을 "시루 한 개"로 바꾸면 potFits·surfaceAt·
       fitPotToLimit 이 전부 무리보다 작은 값으로 판정하게 되어, 12개짜리 무리가
       창턱을 통과한 뒤 방바닥까지 삐져나온다 — §rotationSafeDiameter 가 적어 둔
       "네모 화분을 폭으로 재서 창턱을 통과시킨" 사고의 판박이다.
       ⇒ 화면이 넣을 값은 방뷰에 묻는다: `plantPotD('beansprout', n)`.
     ⚠ 무리가 한도보다 크면 **통째로 줄인다.** 무순 재배판과 같은 규칙이다 —
       "안 들어가면 조용히 걸쳐 두지 않는다". 대신 시루 한 개도 같이 작아진다. */
  async function buildBeansprout(spec, limit) {
    const p01 = clamp(spec.progress01 ?? 1, 0, 1);
    const g = new THREE.Group();
    const cl = clusterUnit(countOf('beansprout', spec.count));
    /* 무리 전체의 지름 → 시루 한 개의 지름. n=1 이면 span=1 이라 예전 want 와 같다. */
    const full = SIRU_D * cl.span;
    const want = Math.min(full, limit === Infinity ? full : limit) / cl.span;

    /* ★ 시루들은 한 그룹에 모아 두고 그걸 potPart 로 못 박는다.
       안 그러면 potPartOf 가 "잎이 아닌 첫 자식" 규칙으로 **시루 하나만** 잡아
       12개짜리 무리의 지름이 0.24 로 나온다. 티가 안 나는 종류의 거짓말이다. */
    const pots = new THREE.Group();
    const siru0 = await loadGLB(AT('../../assets/crops/container_siru_open.glb'));
    const bb = new THREE.Box3().setFromObject(siru0);
    const cur = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) || SIRU_D;
    siru0.scale.setScalar(want / cur);
    const bb2 = new THREE.Box3().setFromObject(siru0);
    const rim = bb2.max.y - bb2.min.y;
    cl.offs.forEach((o, i) => {
      const s = i === 0 ? siru0 : siru0.clone(true);
      s.position.set(o.x * want, -bb2.min.y, o.z * want);
      /* 검사가 **실제로 선 시루를 센다**. 상태를 되읽는 게 아니라 장면을 센다 */
      s.userData = { ...(s.userData || {}), containerIndex: i };
      pots.add(s);
    });
    g.add(pots);
    g.userData.potPart = pots;

    /* ★★ **아직 안 심은 시루는 빈 용기다** (2026-08-16 · 박사님: "콩나물 시루가 콩씨앗이
       없어도 설치되게 … 용기에 씨 심기 해서 심도록").
       ------------------------------------------------------------
       콩나물도 이제 **빈 시루를 먼저 놓고** 방에서 [🌱 심기]를 누른다. 그 사이 동안 시루는
       화면에 서 있는데 콩나물은 아직 없다. 아래 `lerp(4, 11, p01)` 을 그대로 태우면
       **안 심은 시루에 콩나물이 네 포기 나 있어** 화면이 거짓말을 한다.
       ⚠ `progress01 === 0` 으로 가르지 **않는다.** 심어 놓고 물을 안 준 시루도 0 이라
         「안 심음」과 「물 안 줌」이 화면에서 안 갈린다 — 그 둘을 갈라 보이게 한 것이
         이번 변경의 요지였다. 그래서 **말로 받는다**(`sown:false`).
       ★ `undefined` 는 예전 그대로 「심은 것」이다 — 옛 호출부·옛 세이브가 안 깨진다.
       ★ §buildMusun 의 `spec.sown === false` 가지와 **같은 규칙·같은 자리**다.
       ⚠ 넣는 자리가 중요하다 — `potPart` 대입 **뒤**여야 한다. 앞에 넣으면 무리 지름이
         시루 하나 것으로 나온다(`__potPart` 가 무리 전체를 못 찾는다). */
    if (spec.sown === false) {
      g.userData.kind = 'beansprout';
      g.userData.leaves = [];
      g.userData.containerCount = cl.offs.length;
      return g;
    }

    const stage = p01 < 0.34 ? 's' : p01 < 0.7 ? 'm' : 'l';
    const body = await loadGLB(AT(`../../assets/crops/beansprout_${stage}.glb`));
    const n = Math.round(lerp(4, 11, p01));
    let made = 0;
    for (const o of cl.offs) for (let i = 0; i < n; i++) {
      const c = made++ === 0 ? body : body.clone(true);
      const a = (i / n) * Math.PI * 2 + i * 0.7;
      const r = want * 0.30 * Math.sqrt((i + 0.4) / n);
      c.scale.setScalar(want / SIRU_D);
      c.position.set(o.x * want + Math.cos(a) * r, rim * 0.55, o.z * want + Math.sin(a) * r);
      c.rotation.y = a;
      c.rotation.z = (Math.random() - 0.5) * 0.18;
      g.add(c);
    }
    g.userData.kind = 'beansprout';
    g.userData.leaves = [];
    g.userData.containerCount = cl.offs.length;
    return g;
  }

  /* ★ 재배판 + 무순 (2026-08-05)
     ------------------------------------------------------------
     ★★ limit 을 어떻게 읽었나 — 재배판은 **네모**다.
       시루는 원형이라 "폭 = 회전무관 지름" 이 그냥 성립했다. 재배판은 아니다:
         폭 0.36 · 깊이 0.24 · **대각선 0.4327**
       이 방뷰의 자리 판정(potFits · maxPotD · fitPotToLimit · surfaceAt)은 **전부**
       회전무관 지름 하나로만 본다. 그렇게 정한 이유가 §rotationSafeDiameter 에 적혀 있다 —
       네모 화분을 bbox 폭으로 재서 창턱을 통과시켰다가, 돌리니 대각선이 걸린 사고였다.
       재배판은 그 사고의 판박이다. 게다가 setPlantYaw 로 플레이어가 판을 실제로 돌린다.
       ⇒ 그래서 **폭(0.36)이 아니라 대각선(0.4327)** 을 이 판의 지름으로 잡는다.
         limit 은 그 대각선에 걸고, 모자라면 판 전체를 그 비율로 줄인다.
         want = min(0.4327, limit) 로 맞춰 두면 fitPotToLimit 이 다시 재도 정확히 want 라
         **두 번 줄지 않고 경고도 안 뜬다**(콩나물이 want/cur 로 하는 것과 같은 사상이다).
       ⚠ 대신 좁은 자리에서는 판이 통째로 작아진다. 그것도 시루와 같은 규칙이다 —
         "안 들어가면 조용히 걸쳐 두지 않는다"가 이 파일의 계약이다.
     ★ 무순은 **격자**로 선다. 시루처럼 원형으로 흩뿌리면 재배판이 아니라 화분이 된다.
       칸 좌표는 TRAY_S_SLOTS(= manifest 의 slots 12칸)를 그대로 쓴다. */
  async function buildMusun(spec, limit) {
    /* ★ progress01 은 **유한한 수일 때만** 믿는다.
       콩나물에서 lerp(4, 11, undefined) → NaN → 0포기(빈 그릇)가 실제로 났다.
       여기서는 NaN·null·undefined 가 들어와도 '다 자란 것'으로 떨어지게 막는다. */
    const p01 = clamp(Number.isFinite(spec.progress01) ? spec.progress01 : 1, 0, 1);
    const g = new THREE.Group();

    const tray = await loadGLB(AT('../../assets/crops/container_tray_s.glb'));
    /* ★ fitPotToLimit 이 나중에 쓰는 것과 **같은 자**로 잰다. 여기서 bbox 로 재면
       원점이 가운데가 아닐 때 두 값이 갈려 판이 한 번 더 줄어든다. */
    const cur = rotationSafeDiameter(tray, tray) || TRAY_S_D;
    const want = Math.min(MUSUN_D, limit === Infinity ? MUSUN_D : limit);
    const k = want / cur;
    tray.scale.setScalar(k);
    const bb = new THREE.Box3().setFromObject(tray);
    tray.position.y -= bb.min.y;          // 판 바닥을 그루 원점에 맞춘다
    g.add(tray);

    /* ★★ **아직 안 심은 판은 흙만 있다** (2026-08-11 · 박사님: "재배판 배치 후 무순 심기").
       ------------------------------------------------------------
       무순은 이제 **빈 판을 먼저 놓고** 방에서 [🌱 심기]를 누른다. 그 사이 동안 판은
       화면에 서 있는데 싹은 아직 없다. 아래 최소 3포기 규칙을 그대로 태우면
       **안 심은 판에 싹이 세 포기 나 있어** 화면이 거짓말을 한다.
       ⚠ `progress01 === 0` 으로 가르지 **않는다.** 심어 놓고 물을 안 준 판도 0 이라
         「안 심음」과 「물 안 줌」이 화면에서 안 갈린다 — 그 둘을 갈라 보이게 한 것이
         이번 변경의 요지였다. 그래서 **말로 받는다**(`sown:false`).
       ★ `undefined` 는 예전 그대로 「심은 것」이다 — 옛 호출부와 `test_musun_view ③-D`
         (progress01 이 NaN·문자열이어도 빈 판이 안 나온다)가 안 깨진다. */
    if (spec.sown === false) {
      g.userData.kind = 'musun';
      g.userData.leaves = [];
      return g;
    }

    const stage = p01 < 0.34 ? 's' : p01 < 0.7 ? 'm' : 'l';
    const body = await loadGLB(AT(`../../assets/crops/sprout_radish_${stage}.glb`));
    /* 몇 칸이 텄나 — 3칸에서 시작해 12칸(slot_count)까지 찬다.
       선형의 반올림이라 progress01 이 늘면 포기 수가 **줄지 않는다**.
       ⚠ 0칸에서 시작하지 않는다. 빈 판은 위 NaN 사고와 눈으로 구별이 안 된다. */
    const n = clamp(Math.round(lerp(3, TRAY_S_SLOTS.length, p01)), 1, TRAY_S_SLOTS.length);
    /* ★★ 한 포기의 크기 — **판을 따라 줄이지 않는다** (2026-08-05 · §MUSUN_D).
       판은 0.20m 로 줄였지만 무순은 실물이다(소 1.5cm · 중 2.8cm · 대 4.4cm 폭).
       같이 줄이면 대 단계가 7mm 가 되어 재배판이 인형 소품이 된다.
       ★ 다만 **제 칸을 넘지는 않게** 한다 — 규칙은 그거 하나다. 칸 간격은 판 좌표계의
         가로 간격(0.072m)에 판 배율 k 를 곱한 값이고, 대 단계 폭이 그보다 크면 그만큼만 줄인다.
         상수를 새로 안 짓는다: 칸이 자를 정한다.
       ⚠ `bodyW` 는 GLB 에서 **실제로 재서** 쓴다. manifest 값을 여기 베끼면
         에셋이 바뀔 때 조용히 겹친다. */
    const cellX = 0.072 * k;                                  // 이웃한 두 칸의 가로 거리[m]
    const bodyW = rotationSafeDiameter(body, body) || cellX;
    const bodyK = Math.min(1, cellX / bodyW);
    for (let i = 0; i < n; i++) {
      const c = i === 0 ? body : body.clone(true);
      const s = TRAY_S_SLOTS[i];
      c.scale.setScalar(bodyK);
      /* 칸 좌표는 판 좌표계 값이다 — 판을 줄인 배율 k 를 곱하고, 판을 내린 만큼 따라 내린다 */
      c.position.set(s.x * k, s.y * k + tray.position.y, s.z * k);
      /* 뿌린 씨앗이라 향이 제각각이다. **난수를 안 쓴다** — 하루가 갈 때마다 다시 짓는데
         그때마다 방향이 바뀌면 판이 들썩인다. 황금각으로 칸마다 다른 향을 준다. */
      c.rotation.y = i * 2.39996;
      c.rotation.z = ((i % 3) - 1) * 0.05;
      g.add(c);
    }
    g.userData.kind = 'musun';
    g.userData.leaves = [];
    return g;
  }

  /* ★ 종류표 — 삼항을 늘리지 않기 위한 한 벌 (2026-08-05)
     ------------------------------------------------------------
     예전에는 종류가 갈리는 곳이 네 군데였고 전부 `x === 'beansprout' ? … : …` 였다.
     작물이 하나 늘 때마다 네 군데를 같이 고쳐야 했고, 한 군데를 빠뜨리면
     "링은 된다는데 놓으면 줄어든다" 같은 어긋남이 난다. 여기 한 줄로 모은다.
       potD          그 종류가 차지하는 **회전무관 지름[m]**. potD 를 안 준 호출부의 기본값이다
       growthByDays  true = 형태를 '유효 생장일'이 정한다(몬스테라)
                     false = progress01 이 정한다(작물). days 는 progress01×100 으로만 쓴다
       clustered     true = 한 자리에 용기 **여럿**을 늘어놓을 수 있다(spec.count · §clusterUnit)
       build         실제 조립. 던지는 것은 buildPlantGroup 한 곳뿐이다
     ⚠ 없는 이름의 기본값은 **예전 그대로**다 — 지름은 몬스테라 화분, 생장은 progress01. */
  /* ══ ★★ 빈 화분 — **놓기와 심기가 두 걸음이 됐다** (2026-08-16 박사님) ═══════════
     박사님: *"씨앗이 자동으로 안 들어가고 **화분만 놓이게** 해 줘."*
     ⚠ 예전에는 화분을 놓는 순간 씨앗이 같이 나갔다. 시루·재배판은 이미 두 걸음인데
       (놓기 → [🌱 심기]) 화분만 한 걸음이라 **같은 손짓에 다른 규칙**이었다.
     ★ 그림은 몬스테라 화분 GLB **그대로**다. 흙만 보이고 아무것도 안 자란 모습이다 —
       새 에셋을 안 만들었다. 「심기 전」이 곧 그 그림이다. */
  async function buildEmptyPot(spec, limit) {
    const g = new THREE.Group();
    const want = Math.min(MONSTERA_POT_D, limit === Infinity ? MONSTERA_POT_D : limit);
    const pot = await loadGLB(AT('../../assets/monstera/pot.glb'));
    const bb = new THREE.Box3().setFromObject(pot);
    const cur = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) || MONSTERA_POT_D;
    pot.scale.setScalar(want / cur);
    const bb2 = new THREE.Box3().setFromObject(pot);
    pot.position.y = -bb2.min.y;               /* 바닥에 앉힌다 */
    g.add(pot);
    /* ⚠ `potPart` 를 못 박는다 — 안 그러면 「잎이 아닌 첫 자식」 규칙이 엉뚱한 것을 잡는다 */
    g.userData.potPart = pot;
    g.userData.kind = 'emptypot';
    g.userData.leaves = [];
    return g;
  }

  const PLANT_KINDS = Object.freeze({
    monstera:   { potD: MONSTERA_POT_D, growthByDays: true,  clustered: false, build: buildMonstera },
    /* ★ 2026-08-16 — 빈 화분(위 §buildEmptyPot). 자라지 않으므로 `growthByDays` 는 거짓이다 */
    emptypot:   { potD: MONSTERA_POT_D, growthByDays: false, clustered: false, build: buildEmptyPot },
    beansprout: { potD: SIRU_D,         growthByDays: false, clustered: true,  build: buildBeansprout },
    musun:      { potD: MUSUN_D,        growthByDays: false, clustered: false, build: buildMusun }
  });
  /* ★ 그 종류가 실제로 세울 용기 수. **무리를 못 짓는 종류는 무조건 1 이다** —
     여기서 count 를 그냥 믿으면 몬스테라에 count:3 을 준 호출부가 3배 넓은 자리를
     차지한다고 통보받는데 방에는 한 그루만 선다. 안 지을 것의 자리를 잡아 두지 않는다. */
  const countOf = (kind, count) => (PLANT_KINDS[kind] && PLANT_KINDS[kind].clustered)
    ? Math.max(1, Math.round(Number(count)) || 1) : 1;
  /* 모르는 이름은 몬스테라 화분 지름으로 떨어진다 — 옛 삼항의 else 가지와 같은 값이다.
     ★ count 를 주면 **무리 전체**의 지름이다. 안 주면 예전과 같은 한 개 지름이다. */
  const potDOf = (kind, count) =>
    (PLANT_KINDS[kind] || PLANT_KINDS.monstera).potD * clusterUnit(countOf(kind, count)).span;
  /* 옛 `kind === 'monstera'` 와 **정확히** 같다(모르는 이름은 false) */
  const usesGrowthDays = kind => !!(PLANT_KINDS[kind] && PLANT_KINDS[kind].growthByDays);

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
        /* ⚠ 접지 그림자는 그루가 아니다 — 밴드 색을 입히면 **검은 판이 밝은 원판**이 된다
           (색이 0x000000 이라 tint 로 55% 끌면 그대로 회색 접시가 나온다) */
        if (o.userData.isBlobShadow) return;
        /* ⚠⚠ **무늬 잎은 안 덮는다** (캐논 · 2026-08-18).
           "무늬 텍스처는 그 자체가 무늬이므로 절대 단색 틴트를 씌우지 않는다."
           확대창은 `KEEP_TEX` 로 그 잎을 tintObj 에서 빼 둔다. 방에는 그 위에 **밴드 색**이
           한 겹 더 얹히는데, 그것까지 걸면 흰 무늬가 밴드색 한 덩어리가 되어
           캐논이 방에서만 깨진다(그리고 화면으로는 "무늬가 안 나온다"와 구별이 안 된다).
           표는 plant_assemble 이 단다(§markSkin).
           ⚠ 그래도 **원색은 여기서 되돌린다.** 아래 시듦이 색을 곱하는데, 되돌리지 않으면
             applyLook 이 불릴 때마다 곱이 쌓여 무늬가 점점 까매진다(같은 그루에 여러 번 불린다). */
        if (o.userData.varieSkin) {
          if (!o.userData.baseColor) o.userData.baseColor = o.material.color.clone();
          o.material.color.copy(o.userData.baseColor);
          return;
        }
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
        if (o.userData.isBlobShadow) return;          // 그림자는 시들지 않는다
        /* ★ 무늬 잎은 **덮지 않고 곱한다** — 확대창의 `fadeObj` 와 같은 사고다.
           three.js 는 map 에 material.color 를 곱하므로 어두워지되 무늬는 살아 있다.
           lerp 로 마른 색을 향해 끌면 흰 무늬가 통째로 갈색이 된다. */
        if (o.userData.varieSkin) {
          if (o.isMesh && o.material && o.material.color) o.material.color.multiplyScalar(1 - fade * 0.35);
          return;
        }
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

  /* ══════════════════════════════════════════════════════════════════════
     ★★★ §놓은 것이 길을 막는다 (2026-08-09 · 박사님: "막는거 경고는 해주되,
          막히면 뭐 재배치하면 되지 그 식물을")
     ------------------------------------------------------------
     ⚠ 그전까지 **놓인 화분·시루는 길찾기의 장애물이 아니었다.** `nav.setWorld` 가 받는 것은
       방을 지을 때 나온 벽·가구(`built.colliders`)뿐이라, 시루를 아무리 깔아도 캐릭터가
       그대로 **통과**했다. 시루 하나(24cm)일 때는 티가 안 났는데 각개로 열댓 개를 깔면
       눈에 띈다(multisiru §9 ③ 이 "이 작업이 만든 것은 아니지만 드러나게 했다"고 적어 둔 그것).
     ⇒ 놓인 그루를 상자로 바꿔 같이 물린다. 그러면 「여기 놓으면 저기 못 간다」가
       **실제로 참인 말**이 된다 — 경고가 거짓말을 안 한다.

     ★ 막지는 않는다. 이 파일은 **길을 계산할 뿐**이고, 무엇을 막을지·말지는 화면이 정한다.
     ★ 상자 크기는 그루의 `potD`(회전무관 지름) 그대로다. 새 숫자를 안 만든다.
     ⚠ 그루가 늘 때마다 격자를 다시 짓는다(`setWorld` 가 grid 를 비운다). 시루 16개에서
       재 보면 한 번에 1ms 미만이라 하루 넘길 때 몇 번 도는 것은 값이 싸다. */
  function navColliders() {
    const base = (built && built.colliders) || [];
    const out = base.slice();
    for (const [, p] of plants) {
      if (!p || !p.group) continue;
      const d = Math.max(0.05, p.potD || 0.2);
      out.push({ x: p.group.position.x, z: p.group.position.z, w: d, d, rot: 0, plant: true });
    }
    return out;
  }
  function refreshNavObstacles() {
    if (!built) return;
    nav.setWorld({ colliders: navColliders(), size: built.size });
  }

  function removePlant(slotId) {
    const p = plants.get(slotId);
    if (!p) return;
    houseGroup.remove(p.group);
    disposeObject(p.group);
    dropPlantBlob(slotId);            // 접지 그림자는 그루 밖에 달려 있다 (§syncPlantBlob)
    plants.delete(slotId);
    refreshNavObstacles();            // 걷어냈으니 그 자리 길이 다시 열린다
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
  /* ★★ 화분을 그 면에 **앉힌다** (2026-08-06 · 박사님 "화분도 선반 옆 공중에 떠 있다")
     ------------------------------------------------------------
     지금까지는 `g.position.y = 면의 y` 였다. 그건 "그룹 원점이 곧 화분 바닥"일 때만
     맞는 식이다. 시루·재배판은 지을 때 스스로 보정하고 있었지만(`-bb.min.y`),
     몬스테라 조립본은 원점 규약이 조립 모듈 쪽에 있어 여기서 보장되지 않았다.
     ⇒ 실제로 재서 어긋난 만큼만 내린다. 이미 맞으면 **한 톨도 안 움직인다**.

     ⚠ **화분 부분만** 잰다. 그루 전체로 재면 늘어진 잎끝이 바닥이 되어 화분이 떠오른다
       (몬스테라 잎은 화분보다 아래로 내려온다 — 그게 정상이다).
     ⚠ 크기는 안 건드린다. y 만 옮긴다.
     @returns 실제로 옮긴 양[m] */
  function seatPlantY(g, y) {
    const want = supportY(g, y);
    g.position.y = want;
    g.updateMatrixWorld(true);
    const pot = potPartOf(g);
    if (!pot) return want - y;
    const bb = new THREE.Box3().setFromObject(pot);
    if (!isFinite(bb.min.y)) return want - y;
    const d = bb.min.y - want;
    if (Math.abs(d) <= 0.003) return +(want - y).toFixed(5);
    g.position.y = want - d;
    g.updateMatrixWorld(true);
    return +(want - d - y).toFixed(5);
  }

  /* ★ 안전망 — "화분은 무엇인가 **위에** 있어야 한다" (2026-08-06)
     ------------------------------------------------------------
     ⚠ 방뷰가 스스로 내는 자리는 안 뜬다 — 반지하 화면 48점을 훑어 확인했다
       (tools/test_ground.mjs §H). 그런데 자리(at)는 **세이브에서도** 온다.
       가구를 옮기면 상판 높이가 바뀌는데 저장된 at.y 는 옛 높이 그대로다 —
       그때 화분이 그 자리에 그대로 남으면 **선반 옆 공중에 뜬다.**
     그래서 놓기 직전에 한 번 아래를 본다. 받쳐 주는 면이 3cm 넘게 아래에 있으면
     거기로 내려앉힌다. 받쳐 주는 게 아예 없으면(방 밖) 그대로 둔다 —
     조용히 0 으로 메꾸면 화분이 방 반대편 바닥으로 순간이동한다.
     ⚠ 3cm 문턱 아래로는 한 톨도 안 움직인다. 정상 배치는 gap 이 정확히 0 이다. */
  const POT_DROP_EPS = 0.03;
  const _dropRay = new THREE.Raycaster();
  function supportY(g, y) {
    if (!built || !built.room) return y;
    const x = g.position.x, z = g.position.z;
    if (!Number.isFinite(x) || !Number.isFinite(z)) return y;
    _dropRay.set(new THREE.Vector3(x, y + 0.02, z), new THREE.Vector3(0, -1, 0));
    const hits = _dropRay.intersectObject(built.room, true);
    let top = null;
    for (const h of hits) {
      if (!h.object.isMesh || !h.object.visible) continue;
      const m = Array.isArray(h.object.material) ? h.object.material[0] : h.object.material;
      if (m && (m.colorWrite === false || (m.transparent && m.opacity < 0.95))) continue;  // 유리·그림자전용
      top = h.point.y; break;
    }
    if (top == null) return y;                       // 받쳐 주는 게 없다 — 건드리지 않는다
    if (y - top <= POT_DROP_EPS) return y;           // 이미 붙어 있다
    console.warn(`[방뷰] 화분이 받쳐지지 않은 자리에 있었습니다 — y ${y.toFixed(3)} → ` +
                 `${top.toFixed(3)} 로 내려앉힙니다 (가구를 옮긴 뒤 옛 좌표가 남은 경우입니다)`);
    return +top.toFixed(4);
  }

  /* 그루 발밑 접지 그림자.
     ★★ **그루의 자식으로 안 넣는다.** 넣어 봤더니 `group.children.length` 가 하나 늘어
       `test_multisiru` 의 「콩나물 12가지가 예전 값과 완전히 같다」가 통째로 깨졌고,
       `potPartOf` 의 "잎이 아닌 첫 자식" 규칙과 `rotationSafeDiameter` 도 판때기를 화분으로
       읽을 수 있다(0.2m 화분의 지름이 0.48m 가 된다). 그루의 모양은 그루만의 것이어야 한다.
     ⇒ houseGroup 에 따로 달고 **열쇠로 짝지어** 자리만 맞춘다. */
  const plantBlobs = new Map();          // 열쇠 → 접지 그림자 메시(houseGroup 소속)

  /* ══ 설 초록빛 — 「자리가 좋을수록 발밑이 살짝 초록으로」 (박사님 2026-08-07) ══
     박사님 원문: *"위에 식물이 있으면 좀 더 좋아질수록(빛이) 약간 식물 아래 원형이
     살짝 초록색으로 점점 변하게 하자."*

     ★★ **이건 미리보기가 아니라 결과다.** 그래서 첫 플레이에도 켜진다 —
       `rankSlots` 가 튜토에서 자리 색을 안 내는 것과 **어긋나지 않는다.** 그쪽은 **놓기 전에**
       답을 알려주는 것이라 배움이 색 읽기로 바뀌지만, 이쪽은 **이미 놓은 뒤** 그 자리가
       돌려주는 답이다. 「자리가 결과를 바꾼다」를 결과로 배우게 하는 자리가 바로 여기다.

     ★ **얼마나 좋은가는 방뷰가 모른다.** 몬스테라는 밝아야 좋고 콩나물은 어두워야 좋다 —
       판정은 game.html 이 제 표(밴드·끼니)로 하고, 여기는 0~1 을 받아 **칠하기만** 한다
       (`highlightSlots` 가 색만 칠하는 것과 같은 경계).

     ⚠ 조도에 한 톨도 안 들어간다. 판때기는 houseGroup 에만 붙고 DLI 는 light_adapter 것이다. */
  const GLOW_RGB = [0.243, 0.639, 0.286];   // #3ea349 — 잎 초록. 알파 0.45 라 이 값이 곧 「살짝」이다
  const plantGlow = new Map();              // 열쇠 → 0~1 (판때기가 다시 만들어져도 살아남는다)

  function applyGlow(b, v) {
    /* v=0 이면 검정 = 예전 그대로의 그림자다. 커질수록 초록이 올라온다. */
    b.material.color.setRGB(GLOW_RGB[0] * v, GLOW_RGB[1] * v, GLOW_RGB[2] * v);
  }

  function syncPlantBlob(key, g, d) {
    let b = plantBlobs.get(key);
    if (!b) {
      b = makeBlobShadow(1, BLOB_A_PLANT);
      b.visible = blobsOn;
      houseGroup.add(b);
      plantBlobs.set(key, b);
      /* ★ 다시 지어진 판때기에 **예전 초록을 되씌운다.** 안 하면 하루가 갈 때마다
         (그루를 다시 조립할 때마다) 초록이 깜빡 꺼졌다 켜진다. */
      applyGlow(b, plantGlow.get(key) || 0);
    }
    /* 화분 **바닥**에 깐다. 그루 원점이 화분 바닥과 같다는 보장이 없으므로 재서 맞춘다 */
    const pot = potPartOf(g);
    let baseY = g.position.y;
    if (pot) {
      g.updateMatrixWorld(true);
      const bb = new THREE.Box3().setFromObject(pot);
      if (isFinite(bb.min.y)) baseY = bb.min.y;
    }
    /* ★ 크기 — 1.45배로 두었더니 **화분이 그림자를 통째로 덮어** 화면에서 아무것도
       안 보였다(직접 찍어 확인했다). 2.4배면 화분 밖으로 한 두레기가 남는다. */
    const w = Math.max(0.16, (Number.isFinite(d) ? d : 0.20) * 2.40);
    b.scale.set(w, w, 1);
    b.position.set(g.position.x, baseY + 0.004, g.position.z);
    needsRender = true;
    return b;
  }

  function dropPlantBlob(key) {
    const b = plantBlobs.get(key);
    if (!b) return;
    houseGroup.remove(b);
    disposeObject(b);
    plantBlobs.delete(key);
    needsRender = true;
  }

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
  /* 잎 상태 한 줄 요약 — 같으면 같은 그림이다. 바램은 0.1 칸까지만 본다(0.05 씩 움직여
     매일 다시 짓게 하면 이득 없이 비싸다. 눈에 띄는 변화가 0.1 보다 잘다). */
  function leafStateKey(list) {
    if (!Array.isArray(list) || !list.length) return '';
    return list.map(s => `${s.leafBirth}${s.varie ? 'v' : ''}${s.matured ? 'm' : ''}` +
                         `${s.dropped ? 'x' : ''}${s.fade ? '.' + Math.round(s.fade * 10) : ''}`).join(',');
  }
  function needsRebuild(prev, spec, days) {
    if (!prev) return true;
    /* ★ 무늬 잎 GLB 가 늦게 도착했다 — 날도 상태도 안 바뀌었지만 **그림이 달라진다**
       (2026-08-18 · §방에도 무늬 잎이 난다). 이걸 빠뜨리면 받아 놓고 안 그린다. */
    if (prev.skinDirty) return true;
    if ((prev.spec.kind || 'monstera') !== (spec.kind || 'monstera')) return true;
    /* ★ 용기 수가 바뀌면 **날이 안 가도** 다시 짓는다 (2026-08-05 · §clusterUnit).
       이걸 빠뜨리면 시루를 산 그날은 화면이 안 바뀐다 — 고치려던 바로 그 증상이
       "하루 뒤에야 보인다"로 모습만 바꿔 남는다. */
    if (countOf(spec.kind, prev.spec.count) !== countOf(spec.kind, spec.count)) return true;
    /* ★ 심었나가 바뀌면 **날이 안 가도** 다시 짓는다 (2026-08-11 · §buildMusun sown).
       심는 것은 하루를 안 쓰는 동작이라, 이걸 빠뜨리면 [🌱 심기]를 눌러도 판이
       빈 채로 남아 있다가 **다음 날에야** 싹이 돋는다 — 위 count 규칙과 같은 이유다. */
    if ((prev.spec.sown === false) !== (spec.sown === false)) return true;
    /* ★ 잎 상태가 바뀌면 **날이 안 가도** 다시 짓는다 (2026-08-16 · §leafState).
       위 둘과 같은 함정이다. 특히 **바램**은 유효 생장일이 멈춘 채로 움직인다 —
       어두운 자리에 둔 그루는 GROWTH 가 안 오르므로(실측: 서랍장에서 70일 동안 +0),
       days 만 보면 잎이 노랗게 바래도 화면이 영영 안 바뀐다. */
    if (leafStateKey(prev.spec.leafState) !== leafStateKey(spec.leafState)) return true;
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
    const days = usesGrowthDays(kind)
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
    seatPlantY(g, s.y);                  // ★ 상판에 앉힌다 (§seatPlantY)
    syncPlantBlob(slotId, g, d);         // ★ 접지 그림자 (그루 밖에 달린다)
    tagPlant(g, slotId, spec.potId || null);
    applyLook(g, spec);
    houseGroup.add(g);
    plants.set(slotId, { group: g, spec: { ...spec }, potD: Math.min(d, limit),
                         potId: spec.potId || null, at: atOfSlot(s, g.rotation.y),
                         days, wantDays: days, builtAt: performance.now() });
    if (preview && (preview.fromId === slotId || preview.toId === slotId)) refreshPreview();
    refreshNavObstacles();               /* ★ 놓인 그루는 길을 막는다(§놓은 것이 길을 막는다) */
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
                          ★ count 를 줄 때는 **무리 전체**의 상한이다(§clusterUnit)
                plantId   kind 의 다른 이름(계약 쪽 용어). kind 가 있으면 kind 가 이긴다
              ★ count — 그 자리에 세울 용기 수(콩나물 시루). 안 주거나 1 이면 예전과
                **완전히 같다.** 넣을 지름은 방뷰에 묻는다: plantPotD(kind, count)

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
    const days = usesGrowthDays(kind)
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
      seatPlantY(prev.group, A.y);       // ★ 옮겨도 그 면에 앉는다 (§seatPlantY)
      if (gaveRot) prev.group.rotation.y = A.rotY;
      A.rotY = prev.group.rotation.y || 0;
      prev.at = A;
      if (old !== key) {
        plants.delete(old);
        plantYaw.delete(old);
        plants.set(key, prev);
        tagPlant(prev.group, key, id);
        dropPlantBlob(old);
      }
      syncPlantBlob(key, prev.group, prev.potD);   // 그림자도 따라간다
      refreshNavObstacles();                      /* ★ 옆으로 옴겼으면 막는 자리도 옴긴다 */
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
    seatPlantY(g, A.y);                     // ★ 그 면에 앉힌다 (§seatPlantY)
    syncPlantBlob(key, g, Math.min(d, limit === Infinity ? d : limit));   // ★ 접지 그림자
    A.rotY = yaw;
    plantYaw.set(key, yaw);
    tagPlant(g, key, id);
    applyLook(g, { ...spec, kind });
    houseGroup.add(g);
    plants.set(key, { group: g, spec: { ...spec, kind }, potId: id, at: A,
                      potD: Math.min(d, limit === Infinity ? d : limit),
                      days, wantDays: days, builtAt: performance.now() });
    moveHighlightRing(key, A);
    refreshNavObstacles();               /* ★ 자유 좌표로 선 그루도 길을 막는다 */
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
    dropPlantBlob(fromId);
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
      /* ★ 그림자는 **바닥에 남는다** — 들린 만큼 따라 올라가면 화분이 안 들려 보인다.
         자리만 따라가고 높이는 목표 면에 둔다. */
      const bl = plantBlobs.get(toId);
      if (bl) { bl.position.x = p.group.position.x; bl.position.z = p.group.position.z; }
      needsRender = true;
      if (t < 1) requestAnimationFrame(anim);
      else syncPlantBlob(toId, p.group, p.potD);
    };
    anim();
    syncPlantBlob(toId, p.group, p.potD);
    /* ★ rank 를 붙여서 다시 부른다. 열쇠만 넘기면 갱신할 때마다 색이 예전 두 색으로
       되돌아간다(화분이 자랄 때마다 초록이 호박색으로 바뀌는 셈이다). */
    if (highlighted.size) highlightSlots(rehighlightArg());   // 링 상태(빈 자리) 갱신
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
    highlightRank.clear();
    needsRender = true;
  }

  /* ★ 추천 자리뿐 아니라 **자유 좌표 화분**도 빛낼 수 있다 (2026-08-03).
     열쇠 해석은 resolveKey 한 곳만 쓴다 — 슬롯 id · `free:` 열쇠 · 화분 id 다 받는다.
     (탭해서 고른 자유 배치 화분을 표시할 길이 없으면 "무엇을 고른 건지"가 안 보인다) */
  /* ★ 원소는 두 가지를 다 받는다 (2026-08-05)
       'shelf#1:0'                       예전 그대로 — 색도 예전 그대로다
       { slotId:'shelf#1:0', rank:'good' } 새로 — rank 로 세 색을 칠한다
     rank 는 'good'(초록) · 'ok'(노랑) · 'bad'(빨강). 위 RANK_HEX 머리말 참조.
     ★ 판정은 게임 쪽 몫이다. 여기는 받은 대로 칠하기만 한다. */
  function highlightSlots(slotIds) {
    const want = new Map();                 // 정본 열쇠 → { pos, r, rank }
    for (const raw of (slotIds || [])) {
      /* 문자열이면 예전 규약, 객체면 { slotId | id | key, rank } */
      const isObj = raw && typeof raw === 'object';
      const key = isObj ? (raw.slotId != null ? raw.slotId
                         : raw.id != null ? raw.id : raw.key) : raw;
      const t = resolveKey(key);
      if (!t) continue;                     // 없는 열쇠는 예전처럼 조용히 뺀다
      /* ★★ **`markerHalf` 와 같은 자를 쓴다** (박사님 2026-08-08: "여전히 책상 위랑 서랍장 위는 저래").
         ══════════════════════════════════════════════════════════════════
         2026-08-08 에 `guideRadius`(끌 때 뜨는 네모)를 「끌고 있는 것 크기」로 고쳤는데
         **여기는 안 고쳤다.** 그래서 이 네모만 옛 공식(`maxPotD * 0.55`)으로 남아,
         책상(maxPotD 0.57)에서 0.5m 짜리 금색 네모가 상판을 덮고 있었다.
         자리 표시를 그리는 곳이 둘인데 자가 하나만 바뀐 것이다 — 한쪽만 고치면 이렇게 남는다.

         ★ 자리(slot)는 **한 칸**으로 그린다. 이 표시의 뜻은 「여기 놓을 수 있다」이고
           그 단위는 격자 한 칸이다. 「이 자리가 얼마나 넉넉한가」는 크기가 아니라
           **색**(RANK_HEX)이 말한다 — 크기로도 말하면 두 가지가 같은 것을 두 번 말한다.
         ★ 놓인 물건(plant)은 제 지름으로 그린다. 그건 실제로 그만큼 먹고 있으니까. */
      const r = t.slot
        ? 0.22 / 2                                   // 한 칸 — markerHalf 가 0.25 로 올린다
        : ((t.plant && t.plant.potD) || 0.22) / 2;
      want.set(t.key, { pos: t.pos, r, rank: isObj ? normRank(raw.rank) : null });
    }
    for (const [id, m] of [...rings]) {
      if (want.has(id)) continue;
      houseGroup.remove(m); disposeObject(m); rings.delete(id);
    }
    for (const [id, w] of want) {
      if (rings.has(id)) { rings.get(id).position.set(w.pos.x, w.pos.y + 0.004, w.pos.z); continue; }
      /* ★ 네모다 (2026-08-06 · 박사님 "동그라미여서 밑에 네모 격자랑 안 맞아").
         크기는 격자 칸에 물린다 — 색 규약(RANK_HEX)·맥박은 예전 그대로다. */
      /* `w.r` 은 반지름이다 — `markerHalf` 는 지름을 받으므로 두 배로 되돌려 넘긴다.
         자를 하나로 묶는 것이 요점이라 여기서 `squareHalf` 를 직접 부르지 않는다. */
      const half = markerHalf(w.r * 2);
      const m = new THREE.Mesh(squareFrameGeometry(0.72), ringMaterial());
      m.rotation.x = -Math.PI / 2;
      m.scale.setScalar(half);
      m.position.set(w.pos.x, w.pos.y + 0.004, w.pos.z);
      m.renderOrder = 5;
      m.userData.highlightSlotId = id;
      m.userData.baseScale = half;      // 맥박(pulseRings)이 이 값에 곱한다
      houseGroup.add(m);
      rings.set(id, m);
    }
    for (const [id, m] of rings) {
      /* 슬롯이면 '찼나', 자유 좌표 열쇠면 그 자체가 화분이다 */
      const occ = slotById.has(id) ? slotOccupied(id) : true;
      m.userData.occupied = occ;
      const rank = (want.get(id) || {}).rank;
      m.userData.rank = rank || null;
      /* rank 를 받았으면 그 색이 이긴다 — 그게 이 표시의 뜻이니까.
         못 받았으면 예전 그대로(찬 자리 파랑 · 빈 자리 호박색). */
      m.material.color.setHex(rank ? RANK_HEX[rank] : (occ ? 0x9fd0ff : 0xffd479));
    }
    highlighted = new Set(want.keys());
    highlightRank.clear();
    for (const [id, w] of want) if (w.rank) highlightRank.set(id, w.rank);
    needsRender = true;
  }

  /* 지금 빛나는 자리를 **rank 를 붙인 채로** 다시 넘길 인자.
     안에서 스스로 갱신할 때(화분이 다시 조립될 때) 색을 잃지 않게 하는 유일한 길이다. */
  function rehighlightArg() {
    return [...highlighted].map(id =>
      highlightRank.has(id) ? { slotId: id, rank: highlightRank.get(id) } : id);
  }

  /* 빛내 둔 화분이 움직이면 링도 따라간다. 링을 새로 만들지 않는다(끄는 동안 부른다). */
  function moveHighlightRing(key, at) {
    const m = rings.get(key);
    if (m) { m.position.set(at.x, at.y + 0.004, at.z); needsRender = true; }
  }

  function pulseRings(now) {
    if (!rings.size) return false;
    const k = 0.42 + 0.32 * (0.5 + 0.5 * Math.sin(now / 320));
    /* ★ 네모가 된 뒤로 기하는 반너비 1 짜리다 — 실제 크기는 baseScale 에 있다.
       여기서 setScalar(1+…) 로 덮으면 표시가 방 크기만 해진다(그렇게 만들어 봤다). */
    for (const [, m] of rings) {
      m.material.opacity = k;
      m.scale.setScalar((m.userData.baseScale || 1) * (1 + (k - 0.5) * 0.12));
    }
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
  /* ★ 추천 자리를 채우는 초록 (박사님 2026-08-08). 발밑 초록빛(#3ea349)과 **같은 계열**로
     맞췄다 — 「초록 = 이 식물에게 좋다」가 게임 안에서 한 가지 뜻이어야 한다. */
  const GUIDE_FILL = 0x4fc463;

  function clearGuideRings() {
    if (guideGroup) houseGroup.remove(guideGroup);
    /* 기하·재질은 **나눠 쓰는 것**이라 링 하나씩 버리면 안 된다. 아래에서 한 번만 버린다. */
    guideRings.clear();
    guideFills.clear();
    cellRings.clear();
    cellInfo.clear();
    slotCellSize.clear();
    cellNear = null;
    tierRects = null;
    cellSpan = 0;
    if (guideGeo) { guideGeo.thin.dispose(); guideGeo.thick.dispose(); guideGeo.fill.dispose(); }
    if (guideMat) for (const k in guideMat) guideMat[k].dispose();
    guideGroup = null; guideGeo = null; guideMat = null; guideNear = null;
    needsRender = true;
  }

  function buildGuideRings() {
    clearGuideRings();
    guideGroup = new THREE.Group();
    guideGroup.visible = false;
    houseGroup.add(guideGroup);
    /* 반너비 1 짜리 **네모 테두리** 두 벌만 만들고 자리마다 scale 로 키운다.
       ★ 2026-08-06 네모로 바꿨다(§squareFrameGeometry). 색·굵기 규약은 그대로다. */
    /* ★ `fill` — 테두리 안을 채우는 판. 반너비 1 로 테두리와 **같은 자**를 쓴다
       (2026-08-08 · 박사님 "격자들 중 추천 지점은 살짝 녹색 투명면이 보였으면"). */
    guideGeo = { thin: squareFrameGeometry(0.74), thick: squareFrameGeometry(0.50),
                 fill: new THREE.PlaneGeometry(2, 2) };
    const mk = (color, opacity, depthTest) => new THREE.MeshBasicMaterial({
      color, transparent: true, opacity, side: THREE.DoubleSide,
      depthWrite: false, depthTest, toneMapped: false });
    guideMat = {
      /* 보통 링은 깊이 검사를 켠다 — 선반에 가려야 "그 선반 위 자리"로 읽힌다.
         커서 근처 링만 깊이 검사를 끈다. 그건 지금 겨냥하는 자리라 늘 보여야 한다. */
      fit: mk(RING_FIT, 0.55, true),
      ng: mk(RING_NG, 0.34, true),
      near: mk(RING_NEAR, 0.95, false),
      /* ★★ 추천 자리의 **녹색 투명면**. 「살짝」이 지시라 0.16 이다 —
         이보다 진하면 상판 무늬가 죽어 무엇 위에 놓는지가 안 보인다.
         겨냥한 자리만 조금 더 밝힌다(아래 fillNear). */
      fill: mk(GUIDE_FILL, 0.16, true),
      fillNear: mk(GUIDE_FILL, 0.30, false)
    };
    for (const s of slotById.values()) {
      /* ══ ★★ 2026-08-16 — **상판 위 추천 자리는 강조하지 않는다** (박사님) ═══════════
         박사님: *"책상 서랍장 위에 각 2곳이 **강조 그리드**되어 있는데 그거 없애 줘."*
         ⚠ 그 초록 두 칸은 **옛 모델의 흔적**이다 — 상판이 「점 두 개」이던 시절
           그 점을 가리키던 표시다. 지금은 상판 전체가 칸으로 깔리므로(2026-08-16 B-1)
           **같은 자리를 두 겹으로 말한다.** 칸 위에 칸이 얹혀 어느 쪽이 참인지 헷갈린다.
         ⇒ 바닥 위(자유 배치)에서는 그대로 두고, **가구 상판에 얹힌 자리만** 안 그린다.
           가르는 자는 **높이**다 — 바닥에 앉은 자리는 y 가 거의 0 이다.
         ⚠ 자리 자체는 그대로 산다(세이브·조도가 그 이름을 쓴다). **그림만 안 그린다.** */
      const onSurface = Number.isFinite(s.y) && s.y > 0.05;
      if (onSurface) continue;
      /* ★ 채움을 **먼저** 넣는다 — 같은 높이면 나중에 넣은 것이 위로 온다.
         테두리가 채움 위에 와야 칸의 경계가 안 뭉갠다. */
      const f = new THREE.Mesh(guideGeo.fill, guideMat.fill);
      f.rotation.x = -Math.PI / 2;
      f.position.set(s.x, s.y + 0.005, s.z);
      f.renderOrder = 3;
      f.visible = false;                       // 올라가는 자리에서만 켠다
      guideGroup.add(f);
      guideFills.set(s.slotId, f);

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

  /* ============================================================
     ④-c ★ 가구 윗면 **전체 칸** — guideCells (2026-08-11)
     ------------------------------------------------------------
     박사님: *"테이블이나 가구 위 전체 칸을 보여주던지해야지"*

     ── 무엇이 문제였나 ──────────────────────────────────────────────
     책상 상판은 1.20 × 0.60 m 인데 **노란 네모가 둘**이었다. 그 둘은
     `furniture_pastel.tierSlots` 가 가로 한 줄에 박아 넣은 상수(`w>1.4?3:2`)이고,
     깊이(d)는 아예 안 쓴다. 즉 「자리가 둘」은 상판의 성질이 아니라 **빌더의 상수**다.
     그래서 화면이 「여기 둘뿐」이라고 거짓말을 하고 있었다.

     ── 왜 슬롯을 늘리지 않았나 (★ 이게 이 절의 핵심이다) ─────────────
     슬롯을 늘리면 `slotId = uid + ':' + i` 의 **번호 뜻이 바뀐다.** 그러면
       · `save.js` 여섯 곳이 이름을 그대로 저장하므로 **옛 판의 화분이 조용히 다른 자리로 간다**
       · `data/profiles/room_profile.*.json` 의 슬롯별 DLI 표가 통째로 어긋난다
       · 검사 아홉 개가 「반지하 14칸」과 그 DLI 를 박아 두었다
       · `game.html` 의 드롭다운(`fillSlots`/`fillMusunSlots`)이 자리마다 한 줄이라
         14 → 60 이면 목록이 못 쓸 물건이 되고 `slotLabel` 이 「책상 37번 칸」이 된다
     ⇒ 그래서 **계약(슬롯)은 한 톨도 안 건드리고 화면만 고친다.** 놓는 길은 이미
       자유 좌표로 상판 전체를 받는다(`surfaceAt` → `snapOnSurface`, 2026-08-07).
       없던 것은 **놓을 수 있다는 표시**뿐이었다.

     ── 칸을 어디에 놓나 ────────────────────────────────────────────
       크기  `place.GRID_CELL` 0.25 m — 창턱(house.SILL_GRID)·바닥 격자가 쓰는 눈금이다
       원점  **그 상판 한가운데**. 칸 수 n = floor(면 길이 / 0.25) 로 가운데 정렬한다
     ★ 이렇게 하면 칸 한가운데가 면 중심에서 `(i − (n−1)/2)·0.25` 인데, n 이 홀수면
       0.25 의 배수이고 짝수면 0.125 + 0.25k 다 — **어느 쪽이든 0.125 의 배수**다.
       놓는 걸음(`snapInSpan`)이 면 중심 기준 0.125 배수라 **칸 한가운데가 곧 놓이는 자리**다.
       (재서 확인할 것: 아래 `guideCells()` 의 `snapErr` 가 그 어긋남을 그대로 낸다)

     ── 큰 물건이 갈 곳을 잃지 않는다 ────────────────────────────────
     칸을 잘게 나눠도 큰 화분은 **여러 칸을 차지하면 된다**(박사님). 칸 수가 짝수인
     물건은 칸 **경계**에 앉고 홀수면 칸 **한가운데**에 앉는데, 걸음이 0.125 라 둘 다 있다.
     그래서 이 표시가 늘어도 놓을 수 있는 자리가 줄지 않는다.

     ── 추천 자리와 **다른 층**이다 ─────────────────────────────────
       추천 자리(guideRings)  「여기가 좋다」 — 녹색 투명면 + 굵은 테두리. **14칸 그대로**
       윗면 칸(cellRings)     「여기 놓을 수 있다」 — 얇은 테두리. 새로 생긴 것
     `slotRings()` 는 예전대로 **추천 자리만** 낸다(검사 여럿이 그 수를 본다).
     칸은 `guideCells()` 로 따로 묻는다.
  ============================================================ */
  const CELL_SAME = 0.09;      // 추천 자리와 이만큼 안이면 같은 칸으로 본다 — 네모를 겹쳐 그리지 않는다
  const _cellDown = new THREE.Vector3(0, -1, 0);
  const _cellFrom = new THREE.Vector3();

  /* 그 슬롯이 앉은 **단의 상판 사각형**. 슬롯 바로 위에서 아래로 광선을 쏴서 찾는다 —
     `surfaceAt` 이 쓰는 것과 **같은 자**(meshRect)라야 격자와 판정이 안 어긋난다.
     못 찾으면 null 이다. 지어내지 않는다. */
  function tierRectOf(slot) {
    if (!built || !built.room) return null;
    _cellFrom.set(slot.x, slot.y + 0.12, slot.z);
    const near0 = ray.near, far0 = ray.far;
    ray.set(_cellFrom, _cellDown);
    ray.near = 0; ray.far = 0.26;
    let hits = [];
    try { hits = ray.intersectObject(built.room, true); } catch { hits = []; }
    ray.near = near0; ray.far = far0;
    for (const h of hits) {
      if (!h.face || !h.object.isMesh || hiddenInScene(h.object)) continue;
      if (Math.abs(h.point.y - slot.y) > 0.06) continue;
      if (faceUpY(h) <= SURF_UP_MIN) continue;
      const own = ownerOf(h.object);
      if (!own) continue;
      const rect = meshRect(h.object);
      if (!rect || !(rect.w > 0) || !(rect.d > 0)) continue;
      return { rect, own };
    }
    return null;
  }

  /* ★ 상판 사각형 → **span 칸짜리 물건이 앉을 수 있는 자리들**(면 좌표 u,v + 월드 x,z).
     ------------------------------------------------------------
     ⚠ 여기서 span 을 안 보면 표시가 거짓말을 한다. 재서 확인한 것:
       새싹 재배판(0.4327m = 2칸)을 끌 때 칸 한가운데(v=±0.125)를 그렸더니,
       실제로 앉는 자리는 두 칸의 **경계**(v=0) 라 **0.125m 어긋났다.**
     칸 수가 짝수인 물건은 칸 경계에, 홀수면 칸 한가운데에 앉는다 — 걸음(0.125m)이
     칸(0.25m)의 절반이라 둘 다 격자 위다. 그래서 span 을 받아 **묶음의 한가운데**를 낸다.
     이것이 박사님 말씀의 "1개 반 2개 칸 4칸 차지하면 되잖아" 를 화면에 옮긴 것이다. */
  /* 면을 칸으로 남김없이 나눈다 — 칸 하나가 곧 「이 물건 하나가 갈 수 있는 자리」다.
     ★ 「몇 칸을 먹나」를 따로 세지 않는다. 칸이 이미 물건보다 크거나 같기 때문이다(§surfaceAxis).
       그래서 칸이 겹치지도, 사이가 벌어지지도 않는다 — 상판을 **딱** 채운다. */
  function cellsOfRect(rect, potD) {
    const U = surfaceAxis(rect.w, potD), V = surfaceAxis(rect.d, potD);
    const c = Math.cos(rect.rot || 0), s = Math.sin(rect.rot || 0);
    const out = [];
    for (let j = 0; j < V.n; j++) for (let i = 0; i < U.n; i++) {
      const u = U.at(i), v = V.at(j);
      out.push({ u, v, x: rect.x + u * c + v * s, z: rect.z - u * s + v * c,
                 cw: U.cell, cd: V.cell });
    }
    return out;
  }

  /* 슬롯이 앉은 단들의 상판 사각형 — **방을 지을 때 한 번만** 캔다(광선을 쏘는 일이라 비싸다). */
  function collectTierRects() {
    const tiers = new Map();
    for (const s of slotById.values()) {
      const t = tierRectOf(s);
      if (!t) continue;
      /* ⚠ 열쇠에 **높이(y)를 넣어야 한다.** 3단 선반은 단마다 판때기가 같은 x·z·w·d 라
         y 를 빼면 세 단이 한 단으로 뭉쳐 위 두 단의 칸이 통째로 사라진다(그렇게 만들어 봤다). */
      const key = [t.own.userData.uid || 'x', s.y.toFixed(3),
                   t.rect.x.toFixed(3), t.rect.z.toFixed(3),
                   t.rect.w.toFixed(3), t.rect.d.toFixed(3), (t.rect.rot || 0).toFixed(4)].join('|');
      if (!tiers.has(key)) tiers.set(key, { rect: t.rect, own: t.own, y: s.y, slots: [] });
      tiers.get(key).slots.push(s);
    }
    return [...tiers.values()];
  }

  /* 칸 메시를 span 에 맞춰 다시 깐다. span 이 안 바뀌면 아무것도 안 한다. */
  function layoutGuideCells(span, potD) {
    if (!guideGroup) return 0;
    if (!tierRects) tierRects = collectTierRects();
    /* ⚠ 열쇠를 **potD 로** 잡는다. 예전엔 span(=ceil(potD/0.25))이었는데, 칸이 면마다
       달라진 뒤로는 span 이 같아도 칸 배치가 다르다 — 서랍장 칸 0.225 에서
       0.20 은 한 칸, 0.24 는 두 칸이다. span 으로 캐시하면 그 둘이 서로의 칸을 쓴다. */
    const cellKey = span + ':' + (Number.isFinite(potD) ? potD.toFixed(4) : 'x');
    if (cellSpan === cellKey && cellRings.size) return cellRings.size;
    for (const [, m] of cellRings) guideGroup.remove(m);
    cellRings.clear(); cellInfo.clear(); slotCellSize.clear(); cellNear = null;
    cellSpan = cellKey;
    for (const t of tierRects) {
      const u = t.own.userData || {};
      /* 면이 정한 한도 — `surfaceAt` 이 자리 없는 점에 쓰는 것과 **같은 값**이다 */
      const maxPotD = (u.tier_max_pot_d && u.tier_max_pot_d.length)
        ? Math.max(...u.tier_max_pot_d) : null;
      /* ★ 칸 무리는 **면마다** 다르다 — 여기서 통짜 span 을 넘기지 않고 potD 를 넘긴다.
         span 은 이제 「다시 깔아야 하나」를 가리는 열쇠로만 쓴다(§surfaceAxis). */
      /* ★★ 2026-08-16 — **이 상판의 칸 크기를 그 위 추천 자리 전부에 먼저 알려 준다.**
         ------------------------------------------------------------
         처음엔 「칸이 추천 자리와 겹쳐 안 그려질 때만」 넘겼는데, 그러면 겹치지 **않는**
         추천 자리는 여전히 발자국 크기로 남는다. 실제로 그랬다 —
           potD 0.202 서랍장 : 칸 0.225 인데 추천 자리만 0.25
           potD 0.97  책상   : 칸 1.20×0.60(상판 통째로 한 칸)인데 추천 자리는 1.00×1.00
         ⇒ **겹치든 말든 상판마다 한 번** 기록한다. 한 상판 위의 네모는 전부 같은 자여야 한다.
         ★ 칸이 하나도 안 나오는 상판(물건이 너무 커서)은 기록하지 않는다 —
           그때는 예전대로 발자국 크기가 맞다. 없는 칸의 크기를 지어내지 않는다. */
      const rectCells = cellsOfRect(t.rect, potD);
      if (rectCells.length) {
        const cw = rectCells[0].cw, cd = rectCells[0].cd;
        for (const s of t.slots) if (s.slotId) slotCellSize.set(s.slotId, { cw, cd });
      }
      for (const c0 of rectCells) {
        /* ★★ **그린 자리가 곧 앉는 자리다** (2026-08-11 · 박사님 "더 쪼개").
           ------------------------------------------------------------
           칸을 반 칸(0.125)으로 잘게 깔았더니 그린 한가운데와 실제로 앉는 자리가
           **최대 0.0625m 어긋났다**(재서 확인). 훑어 보니 앉는 자리는 0.125 간격이 맞는데
           **위상이 상판 한가운데가 아니고**, 가장자리에서 한 번 더 붙어(clamp) 자투리 간격
           (0.135 · 0.09 · 0.035)이 섞여 있었다. 격자 식을 아무리 고쳐도 그 둘은 안 만난다.
           ⇒ 격자로 **후보만** 뽑고, 그 점을 `snapOnSurface` 에 그대로 물어 **돌아온 자리에** 그린다.
             이러면 `snapErr` 이 계산이 아니라 **구조적으로** 0 이다.
           ⚠ 같은 자리로 떨어진 후보는 하나로 합친다 — 안 그러면 가장자리에 네모가 겹쳐 쌓인다. */
        let c = c0;
        if (Number.isFinite(potD)) {
          const sn = snapOnSurface(c0.x, c0.z, potD, t.rect, placeStepOf());
          if (sn && Number.isFinite(sn.x) && Number.isFinite(sn.z)) c = { ...c0, x: sn.x, z: sn.z };
        }
        /* 추천 자리와 사실상 같은 점이면 안 그린다 — 한 자리에 네모가 둘 겹친다
           (크기는 위 §slotCellSize 가 이미 상판 단위로 알려 줬다) */
        if (t.slots.some(s => Math.hypot(s.x - c.x, s.z - c.z) < CELL_SAME)) continue;
        /* 열쇠는 **앉는 자리**로 짓는다. 후보(u·v)로 지으면 같은 자리에 떨어진 둘이
           다른 열쇠를 받아 겹쳐 그려진다. */
        const id = '#cell:' + (u.uid || 'x') + ':' + t.y.toFixed(3) +
                   ':' + c.x.toFixed(3) + ':' + c.z.toFixed(3);
        if (cellRings.has(id)) continue;
        const m = new THREE.Mesh(guideGeo.thin, guideMat.fit);
        /* ★ 칸을 **상판과 같이 돌린다.** 전에는 `rotation.x` 만 줬는데, 칸이 정사각형이던
           때는 티가 안 났고 지금은 축마다 크기가 달라(0.24 × 0.30) 안 돌리면 어긋난다.
           order 를 YXZ 로 두면 Y(방위) → X(눕히기) 차례라 상판 방위가 그대로 먹는다. */
        m.rotation.order = 'YXZ';
        m.rotation.set(-Math.PI / 2, t.rect.rot || 0, 0);
        m.position.set(c.x, t.y + 0.006, c.z);
        m.renderOrder = 4;
        m.userData.guideCellId = id;
        guideGroup.add(m);
        cellRings.set(id, m);
        cellInfo.set(id, { x: c.x, y: t.y, z: c.z, u: c.u, v: c.v, span,
                           /* 이 칸이 실제로 덮는 넓이 — 그림도 이 값으로 그린다(§surfaceAxis) */
                           cw: c.cw, cd: c.cd,
                           uid: u.uid || null, occIdx: Number.isInteger(u.occIdx) ? u.occIdx : null,
                           rect: t.rect, maxPotD });
      }
    }
    return cellRings.size;
  }

  /* 지름 → 그 물건이 먹는 칸 수. **네모 크기(markerHalf/squareHalf)와 같은 자**다 —
     여기서 다르게 세면 그린 네모와 앉는 자리가 또 어긋난다. */
  /* ★★ 가구 윗면 칸의 눈금 — **바닥·창턱과 같은 `GRID_CELL` 0.25m** 다.
     ------------------------------------------------------------
     ★★ 2026-08-15 — **0.125 에서 0.25 로 되돌렸다.** 박사님이 화면을 보고 짚으셨다:
       *"저 그리드에 빨간색 표기가 실제 크기랑 안 맞는 거 같어. 예를 들면 시루는 1칸
         차지해야 되는데 4칸 차지하는 거로 나와."*
       맞는 말이다. 0.125 로 깔면 시루(0.24m)가 `ceil(0.24/0.125)` = **2칸 → 2×2 = 4칸**이다.
       칸이 「물건 하나가 먹는 자리」로 안 읽히고 그냥 눈금 종이가 된다.

     ⇒ **칸은 물건의 자다.** 0.25 로 재면 실물이 이렇게 읽힌다:
         콩나물 시루 0.24 · 무순 재배판 0.20 · 몬스테라 화분 0.20 → **1칸**
         큰 화분 0.57 → 3칸 · 시루 무리 0.97 → **4칸**
       박사님이 2026-08-11 에 못 박으신 그림 그대로다 —
       *"큰화분이 왜 갈곳을잃어? 1개 반 2개 칸 4칸 차지하먄 되자나."*

     ⚠ **「더 쪼개」와 어긋나지 않는다.** 2026-08-11 의 "더 쪼개"는 **놓는 걸음** 얘기였고
       걸음은 `MOVE_STEP` 0.125 그대로다 — 물건은 여전히 반 칸에도 앉는다.
       바뀐 것은 **그려서 보여 주는 눈금**뿐이다. 둘은 다른 것이다.
     ★ 표시가 거짓말이 안 되는 이유는 그대로다 — 칸 한가운데가 면 중심에서
       `(i − (n−1)/2)·0.25` 라 **늘 0.125 의 배수**이고, 놓는 걸음이 0.125 라
       **칸 한가운데가 곧 앉는 자리**다. (`guideCells().snapErr` 가 그 어긋남을 낸다. 0 이다.) */
  const TOP_CELL = GRID_CELL;

  /* ★★★ 면 한 축을 **딱 나눠 덮는다** (2026-08-15 · 박사님이 화면 보고 두 번 짚으심)
     ══════════════════════════════════════════════════════════════════
     박사님: *"칸수가 더 엉망이 됬는데 저게 어려워? 좀 잘해줘."*

     ■ 무엇이 잘못돼 있었나
     칸이 0.25m **고정**이고 개수가 `floor(면길이/0.25)` 였다. 책상 상판 1.20 × 0.60 이면
     4 × 2 = 8칸이고 칸이 덮는 것은 **1.00 × 0.50** 이다 — 가장자리 0.10/0.05 가 빈다.
     ⚠ 그 빈 자리가 **낭비였던 것은 아니다.** 놓는 자리를 `snapInSpan` 이
       `kMax = floor((span/2 − potD/2)/step)` 로 잘랐고 책상 가로면 `(0.60−0.12)/0.125 = 3.84 → 3`
       이라 갈 수 있는 제일 바깥이 0.375 였다. 즉 **칸은 갈 수 있는 자리를 하나도 안 빠뜨리고
       다 그리고 있었다.** 남는 가장자리는 「화분이 상판 밖으로 나가서 못 가는 자리」였다.
     ⇒ 그러니 **칸만 더 그리면 표시가 거짓말이 된다.** 고쳐야 하는 것은 **놓는 자리 쪽**이다.

     ■ 그래서 뒤집었다 — **칸이 정본이고 놓는 자리가 칸 한가운데다**
         n    = max(1, round(면길이 / 0.25))     ← floor 가 아니라 **round**
         cell = 면길이 / n                        ← 면을 **딱** 채운다
         한가운데 = (i + 0.5)·cell − 면길이/2
     책상 가로 `round(1.20/0.25) = 5` → cell 0.24 · 한가운데 ±0.48 · ±0.24 · 0.
     바깥 칸 ±0.48 에 0.24 짜리를 놓으면 0.36~0.60 — **상판에 딱 들어간다.**
     세로 `round(0.60/0.25) = 2` → cell 0.30 · ±0.15 · 화분이 0.03~0.27 로 들어간다.
     ⇒ 버려지던 가장자리가 **쓸 수 있는 자리로 살아난다.** 책상이 5 × 2 다.
       (박사님이 처음에 빨갛게 그려 보내신 그림이 정확히 그것이었다)

     ⚠ **칸이 정사각형이 아니게 된다**(책상 0.24 × 0.30). 마커를 축마다 따로 늘린다.
     ⚠ 이 자는 **면이 있을 때만**이다. 바닥은 방 원점 0.125 격자가 정본이라 안 건드린다
       (`snapOnSurface` 가 `frame` 없으면 예전 길로 간다).
     ⚠⚠ **round 만으로는 안 됐다 — 재서 알았다.**
       서랍장 상판 0.90 은 `round(0.90/0.25) = 4` → 칸 0.225 인데 **시루가 0.24** 다.
       칸보다 물건이 크니 가장자리 칸에 놓으면 상판 밖으로 나가고, 그 칸이 후보에서 빠져
       놓을 자리가 **3 → 2 로 줄었다.** 「칸을 채우려다 자리를 뺏은」 것이다.
     ⇒ 규칙을 하나 더 얹는다: **칸은 그 물건보다 작아지지 않는다.**
           n = min( round(면길이/0.25),  floor(면길이/물건지름) )
       서랍장이면 `min(4, floor(0.90/0.24)=3) = 3` → 칸 0.30 · 한가운데 ±0.30 · 0 — **3칸 그대로**이고
       이번엔 상판을 **남김없이** 덮는다. 책상은 `min(5, floor(1.20/0.24)=5) = 5` 라 5칸 그대로다.
     ★★ 이 규칙 하나로 **버려지는 칸이 없어진다.** 칸 한가운데의 제일 바깥값이
       `(면길이 − 칸)/2` 이고 칸 ≥ 물건이므로 `≤ (면길이 − 물건)/2` — 즉 **모든 칸이 늘 들어간다.**
       그래서 「그려 놓고 못 앉는 칸」이 구조적으로 생길 수 없다(snapErr 0 과 같은 결의 보장이다).
     ⚠ 칸은 **끌고 있는 물건마다 다시 깔린다.** 시루(0.24)와 몬스테라(0.20)가 서랍장에서
       각각 3칸·4칸이 된다. 「칸 = 이 물건이 갈 수 있는 자리」니까 그게 맞다. */
  function surfaceAxis(len, potD) {
    const L = Number.isFinite(len) && len > 0 ? len : TOP_CELL;
    let n = Math.max(1, Math.round(L / TOP_CELL));
    const P = Number.isFinite(potD) && potD > 0 ? potD : 0;
    if (P > 0) n = Math.min(n, Math.max(1, Math.floor(L / P + 1e-9)));
    const cell = L / n;
    return { n, cell, len: L, at: i => (i + 0.5) * cell - L / 2 };
  }
  /* 그 물건이 걸음 몇 개를 차지하나 — **올림**이다. 내림·반올림을 쓰면 0.4327m 짜리가
     3칸(0.375m)으로 잡혀 그린 네모가 실물보다 작아진다. `place.snapSpan` 이 쓰는
     `unitsFor`(= 올림)와 **같은 셈**이라야 그린 자리와 앉는 자리가 안 갈린다. */
  const cellSpanFor = potD => Math.max(1, Math.ceil(((Number.isFinite(potD) ? potD : 0.22) / TOP_CELL) - 1e-9));

  /* 그 칸에 이 지름이 올라가나 — `surfaceAt` 의 「자리 번호가 없는 가구 위」 가지와
     **같은 두 판정**이다. 여기서 따로 만들면 표시와 실제가 또 어긋난다(§potFits 머리말). */
  function cellHolds(potD, info) {
    if (!info) return false;
    if (Number.isFinite(info.maxPotD) && potD > info.maxPotD + 1e-9) return false;
    return potFits(potD, { rect: info.rect, point: { x: info.x, z: info.z } }).ok;
  }

  /* ★★ 자리 네모의 크기 — **끌고 있는 것**으로 잰다 (2026-08-08 버그 고침)
     ══════════════════════════════════════════════════════════════════
     박사님이 폰 사진으로 잡아 주셨다: *"책상이랑 서랍장 위에는 여전히 저래."*
     금색 네모가 상판을 통째로 덮고 있었다.

     원인은 자리마다 다른 `maxPotD` 로 크기를 잰 것이다. 그 값은 **그 자리가 받아 줄 수
     있는 최대 지름**이지 지금 끌고 있는 물건의 지름이 아니다. 재 보면:
       책상   maxPotD 0.57 → 0.57×0.62 = 0.353 → 상한 0.32 → 네모 한 변 **0.75m**
       서랍장 maxPotD 0.42 → 0.42×0.62 = 0.260              → 네모 한 변 **0.50m**
     시루 한 개(0.24m)를 끌고 있어도 저 크기로 그렸다. 상판보다 크거나 맞먹는다.

     ⇒ 뜻으로 다시 세운다 — 네모는 **그 물건이 실제로 먹는 자리**다. 유령 밑 네모
       (§markerHalf)와 **같은 자 하나**를 쓴다. 두 벌이 되면 또 어긋난다.
       시루 한 개면 어느 자리든 한 칸, 12개 무리(0.97m)면 네 칸이다.
     ★ `* 0.62` 부풀림과 `상한 0.32` 도 뺐다 — 둘 다 원 시절 값이다.
     ⚠ squareHalf 가 **반올림**이라 지름이 칸 경계보다 조금 큰 경우(시루 3개 0.517m,
       8개 0.875m — 재서 확인했다)에는 네모가 물건보다 **작게** 나온다. 올림으로 바꾸면
       사라지지만 유령 밑 네모까지 같이 커지므로 여기서 혼자 안 옮겼다
       (docs/handoff/placegrid-to-plan.md §7-1 — 박사님 판단을 기다린다).
     ⚠ 「이 자리가 넉넉하다」를 크기로 말하던 것이 사라지는데, 그건 **색**이 이미 말한다
       (못 올라가는 자리는 guideMat.ng 로 어둡게 — 그 규약은 그대로다).
     ⚠ 겨냥한 자리를 1.18배로 키우던 것도 뺐다. 격자에 물린 네모를 1.18배 하면 다시
       칸에서 벗어난다 — 박사님이 지적하신 어긋남이 바로 그것이다. 굵기(guideGeo.thick)와
       색(guideMat.near)이 이미 그 자리를 도드라지게 한다. */

  /* on=false 면 감춘다(지우지 않는다).
       opt.potD     이 화분 지름. 못 올라가는 자리는 어둡게 칠한다
       opt.plantId  potD 를 안 줄 때 쓰는 종류 이름. 지름은 PLANT_KINDS 표가 정한다
                    ('beansprout' → 시루 0.24 · 'musun' → 재배판 0.20 · 그 밖 → 0.20)
       opt.near     { x, z } 커서 위치. 제일 가까운 자리를 굵고 밝게
       opt.nearMax  이 거리를 넘으면 아무것도 굵게 하지 않는다[m]
     돌려주는 값은 '올라갈 수 있는 자리 수' 다. */
  function showSlotRings(on, opt = {}) {
    if (!built) return 0;
    if (!on) {
      if (guideGroup) guideGroup.visible = false;
      guideNear = null; cellNear = null; needsRender = true;
      return 0;
    }
    if (!guideRings.size) buildGuideRings();
    /* ★ opt.count 를 주면 **무리 전체**로 잰다 — 시루 12개를 끌고 있는데 "한 개는
       들어갑니다"로 원을 밝히면, 놓는 순간 무리가 통째로 줄어든다(§clusterUnit) */
    const potD = Number.isFinite(opt.potD) ? opt.potD : potDOf(opt.plantId, opt.count);
    /* ★ 가구 윗면 칸을 지금 끌고 있는 것의 **칸 수**에 맞춰 깐다 (§guideCells).
       2칸짜리는 칸 경계에 앉으므로 칸 한가운데를 그리면 표시가 거짓말이 된다. */
    layoutGuideCells(cellSpanFor(potD), potD);
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
    /* ★ 윗면 칸 중에서도 제일 가까운 것을 찾는다. **추천 자리보다 확실히 가까울 때만**
       칸이 이긴다 — 그래야 추천 자리를 정확히 겨눴을 때의 예전 동작이 한 톨도 안 바뀐다.
       (검사 test_roomview_place E-3 이 그 동작을 지킨다) */
    let cellNearId = null, cellNearD = Infinity;
    if (cellRings.size && opt.near && Number.isFinite(opt.near.x) && Number.isFinite(opt.near.z)) {
      for (const [id, info] of cellInfo) {
        if (!cellHolds(potD, info)) continue;
        const d = distanceXZ(opt.near, info);
        if (d < cellNearD) { cellNearD = d; cellNearId = id; }
      }
      if (Number.isFinite(opt.nearMax) && cellNearD > opt.nearMax) cellNearId = null;
      if (cellNearId && !(cellNearD < nearD)) cellNearId = null;
      if (cellNearId) nearId = null;
    }
    guideNear = nearId;
    cellNear = cellNearId;
    /* ★★ 유령이 앉은 칸의 **네모만 감춘다** (박사님 2026-08-07 확정 · 3㉮).
       한 자리에 네모(어디에) + 유령(무엇이) + 라벨(어떻게 될지) 셋이 겹쳐 안 읽혔다.
       ★ 셋 다 하는 일이 달라서 **하나를 없애면 그 질문의 답이 사라진다** — 그래서
         감추는 것이 아니라 층을 가른다. 유령이 이미 "여기"를 말하고 있으므로 그 칸의
         네모만 중복이고, **나머지 칸의 네모는 그대로 둔다**(후보가 어디인지는 계속 보여야 한다).
       ⚠ `visible` 은 매번 되돌린다 — 안 그러면 한 번 감춘 칸이 드래그가 끝나도 안 돌아온다. */
    const hideId = opt.hideRing || null;
    /* 크기는 자리마다가 아니라 **끌고 있는 것** 하나로 정해진다(위 ★★). 한 번만 잰다. */
    const half = markerHalf(potD);
    let fits = 0;
    for (const [id, m] of guideRings) {
      m.visible = (id !== hideId);
      const s = slotById.get(id);
      /* ★ surfaceAt 과 **같은 함수**를 부른다. 여기서 따로 판정하면 또 어긋난다 —
         실제로 어긋나서 링은 14칸 다 "된다"인데 surfaceAt 은 13칸을 거절했다. */
      const holds = potFits(potD, { slot: s }).ok;
      if (holds) fits++;
      const isNear = id === nearId;
      m.material = isNear ? guideMat.near : (holds ? guideMat.fit : guideMat.ng);
      m.geometry = isNear ? guideGeo.thick : guideGeo.thin;
      /* ★★ 2026-08-16 — **자기가 앉은 칸 크기로 그린다**(§slotCellSize).
         겨누고 있을 때(isNear)만 발자국 크기다 — 「놓으면 이만큼 먹는다」는 다른 말이다. */
      const cz = !isNear && slotCellSize.get(id);
      if (cz) m.scale.set(cz.cw / 2, cz.cd / 2, 1);
      else m.scale.setScalar(half);
      m.renderOrder = isNear ? 6 : 4;
      /* ★★ 추천 자리에 **녹색 투명면**을 깐다 (박사님 2026-08-08:
         "옮기기 눌렀을 때 격자들 중 추천 지점은 살짝 녹색 투명면이 보였으면 좋겠어").
         ★ **올라가는 자리에만** 켠다 — 못 올라가는 자리까지 초록이면 그건 추천이 아니라
           그냥 격자 색칠이고, 「초록 = 여기 놓아도 된다」가 거짓말이 된다.
         ★ 네모가 격자 칸에 물려 있으므로(markerHalf) 이 면이 곧 「그 칸」이다.
         ⚠ 유령이 앉은 칸은 네모와 **같이** 감춘다 — 유령 밑에 초록이 비치면 색이 섞여
           유령이 무슨 색인지(놓을 수 있나) 안 읽힌다. */
      const f = guideFills.get(id);
      if (f) {
        f.visible = holds && id !== hideId;
        f.material = isNear ? guideMat.fillNear : guideMat.fill;
        /* 초록 면도 네모와 **같은 크기**여야 한다 — 안 맞추면 초록이 테두리 밖으로 삐져나온다 */
        if (cz) f.scale.set(cz.cw / 2, cz.cd / 2, 1);
        else f.scale.setScalar(half);
      }
    }
    /* ★★ 가구 윗면 **전체 칸** (§guideCells). 추천 자리와 다른 층이라 따로 돈다.
       ⚠ 돌려주는 값(fits)에는 **안 섞는다** — 그 수를 검사 여럿이 「추천 자리 몇 칸」으로
         읽고 있고(test_musun_view ①-C · test_multisiru ②-E), 뜻이 다른 것을 한 수로
         합치면 그 검사들이 지키던 뜻이 사라진다. 칸은 `guideCells()` 로 따로 묻는다.
       ★ 칸에는 **녹색 면을 안 깐다.** 초록은 「여기가 좋다」(추천)의 색이다 —
         칸까지 초록이면 색이 뜻을 잃는다. 칸은 「놓을 수 있다」까지만 말한다. */
    /* ★★★ 2026-08-14 — **칸은 칸 크기로 그린다** (박사님 폰 사진: *"옮기기시 칸이 저렇게
       이상하게나와"*).
       ══════════════════════════════════════════════════════════════════
       ⚠ 여기 있던 것: 칸도 추천 자리와 똑같이 `half`(= 끌고 있는 물건의 **발자국**)로 그렸다.
         칸 간격이 0.25 이던 때는 그 둘이 같아서 안 드러났다. 그런데 08-13 에 칸을
         **반 칸(0.125)** 으로 쪼개면서 간격만 줄고 네모 크기는 그대로라, 네모가
         **가로세로 2배씩 겹쳐** 상판이 바둑판·줄무늬로 뭉갰다. 내가 쪼갤 때 같이 안 고쳤다.
       ⇒ 보통 칸은 **칸 크기**로, 지금 **겨누고 있는 칸 하나만** 발자국 크기로 그린다.
         그래야 「여기 놓을 수 있다」(잔 칸)와 「놓으면 이만큼 먹는다」(겨눈 칸)가 갈린다.
       ★ 격자와 커서를 가르는 흔한 방식이고, 잔 칸이 겹치지 않으므로 무늬가 안 생긴다. */
    /* ★ 칸 크기는 이제 **면마다 다르다**(§surfaceAxis). 축마다 따로 늘린다 —
       `setScalar` 하나로 두면 0.24 × 0.30 짜리 칸이 정사각형으로 그려져
       가로로는 겹치고 세로로는 틈이 벌어진다(그렇게 그려 봤다). */
    for (const [id, m] of cellRings) {
      const info = cellInfo.get(id);
      const holds = cellHolds(potD, info);
      const isNear = id === cellNearId;
      /* `opt.cells:false` — 칸 층만 끈다. 전/후를 같은 카메라로 찍어 견주려고 남긴 문이다. */
      m.visible = opt.cells !== false;
      m.material = isNear ? guideMat.near : (holds ? guideMat.fit : guideMat.ng);
      m.geometry = isNear ? guideGeo.thick : guideGeo.thin;
      if (isNear) m.scale.set(half, half, 1);
      else m.scale.set((info && info.cw ? info.cw : TOP_CELL) / 2,
                       (info && info.cd ? info.cd : TOP_CELL) / 2, 1);
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
      /* 네모 반너비[m] — 크기가 자리(maxPotD)를 타는지 물건(potD)을 타는지 검사가 이걸로 잰다.
         ★ 2026-08-16 — 네모가 **정사각이 아닐 수 있다**(자기가 앉은 칸 크기로 그린다 ·
           §slotCellSize). 그래서 세로 반너비를 `halfV` 로 따로 낸다 — 하나로만 내면
           「한 상판 안에서 다 같은 크기인가」를 재는 검사가 세로 어긋남을 못 본다. */
      half: +m.scale.x.toFixed(4),
      halfV: +m.scale.y.toFixed(4),
      visible: !!(guideGroup && guideGroup.visible)
    }));
  }

  /* 검증·진단용 — 가구 윗면 칸이 어떤 상태인가 (§guideCells).
     ★ `snapErr` 은 「이 칸 한가운데를 겨누면 화분이 실제로 여기 앉나」를 m 로 낸다.
       놓는 걸음(snapOnSurface)에 그대로 물어서 잰다 — 표시와 실제가 어긋나면 여기서 보인다. */
  function guideCellState(opt = {}) {
    const potD = Number.isFinite(opt.potD) ? opt.potD : potDOf(opt.plantId, opt.count);
    const step = placeStepOf(opt.step);
    if (guideGroup) layoutGuideCells(cellSpanFor(potD), potD);
    return [...cellRings].map(([id, m]) => {
      const info = cellInfo.get(id) || {};
      const sn = info.rect ? snapOnSurface(info.x, info.z, potD, info.rect, step) : null;
      return {
        cellId: id, uid: info.uid || null, near: id === cellNear,
        x: +(info.x || 0).toFixed(4), y: +(info.y || 0).toFixed(4), z: +(info.z || 0).toFixed(4),
        u: info.u, v: info.v, maxPotD: info.maxPotD ?? null,
        /* 이 칸이 덮는 넓이와 그 면의 크기 — 「칸이 면을 딱 채우나」를 밖에서 검산할 수 있게 */
        cw: Number.isFinite(info.cw) ? +info.cw.toFixed(4) : null,
        cd: Number.isFinite(info.cd) ? +info.cd.toFixed(4) : null,
        rectW: info.rect ? +info.rect.w.toFixed(4) : null,
        rectD: info.rect ? +info.rect.d.toFixed(4) : null,
        fits: cellHolds(potD, info),
        snapErr: sn ? +Math.hypot(sn.x - info.x, sn.z - info.z).toFixed(6) : null,
        color: '#' + m.material.color.getHexString(),
        half: +m.scale.x.toFixed(4),
        visible: !!(guideGroup && guideGroup.visible)
      };
    });
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
     하이라이트 중이면 그 자리들만 본다(놓기 모드에서 엉뚱한 자리가 잡히지 않게).

     ★★ 2026-08-10 — **놓여 있는 그루도 이 그물에 넣는다** (박사님 "콩나물이 안 눌러진다").
     ------------------------------------------------------------
     ⚠ 예전 그물은 `slotById` 뿐이었다. 그런데 시루는 **자유 좌표**로 서므로
       `slotById` 에 없다 — 즉 자유 좌표로 놓인 것은 `pickPlantRay` 의 **정확한 광선**
       하나로만 잡혔고, 퍼지 30px 은 한 톨도 못 받았다.
     ⚠ 재서 확인한 것(폰 390px · tools/probe_siru_tap.mjs):
         시루 발밑 그대로 → 잡힌다 · 발밑에서 **위로 10px** → 안 잡힌다
         **옆으로 8px** → 안 잡힌다.  즉 표적이 사실상 ±6px 이다(손가락은 40px 을 덮는다).
       그러면서 **못 잡은 탭은 아무 신호도 안 낸다**(resolveTap 이 null 을 내면 호스트는
       고르기를 그대로 둔다) — 그래서 화면에는 **직전에 고른 것이 계속 남는다.**
       박사님이 보신 "계속 몬스테라만 지정됨"이 그 두 가지가 겹친 그림이다.
     ⇒ 자유 좌표 그루도 슬롯과 **같은 30px** 을 받는다. 정확히 짚은 것이 먼저라는
       원칙(§resolveTap)은 그대로다 — 광선이 앞이고 이 그물은 뒤다. */
  function pickSlotFuzzy(cx, cy) {
    const r = canvas.getBoundingClientRect();
    const px = cx - r.left, py = cy - r.top;
    const pool = highlighted.size ? [...highlighted]
               : [...slotById.keys(), ...plants.keys()];
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

  /* ★ 등을 짚는다 — **광선으로 정확히** (2026-08-08 · §⑧-e).
     퍼지(화면거리)로 안 잡는 이유: 등은 자리 바로 위에 달려 있다. 퍼지로 잡으면
     선반 칸을 누르려는 손가락을 등이 계속 가로챈다. 「등 그림을 정확히 짚었을 때만」이다.
     ⚠ 안 보이는 등(안 산 등·컷어웨이로 내려간 것)은 못 짚는다 — 화면에 없는 것을
       누를 수는 없다. */
  function pickLampRay(cx, cy) {
    const rigs = (built && built.lightRigs) || [];
    if (!rigs.length || !built.furniture) return null;
    const nodes = [];
    for (const r of rigs) { const g = lampNode(r.uid); if (g && g.visible) nodes.push(g); }
    if (!nodes.length) return null;
    ray.setFromCamera(ndcOf(cx, cy), ctx.cam);
    for (const h of ray.intersectObjects(nodes, true)) {
      if (!h.object.isMesh || hiddenInScene(h.object)) continue;
      let o = h.object;
      while (o && !(o.userData && o.userData.uid)) o = o.parent;
      if (o && lampRig(o.userData.uid)) return { type: 'lamp', uid: o.userData.uid };
    }
    return null;
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
  /* ★★ 격자에 앉히기 (2026-08-03 박사님 지시 — "바닥에 그리드를 통한 칸수로 조절")
     ------------------------------------------------------------
     한 칸 0.05m·보이는 칸 0.25m·올림·90° 회전은 전부 place.js 가 정하고 근거도 거기 있다.
     여기서 정하는 것은 **격자를 어느 좌표계에 붙이나** 하나뿐이다.

       바닥      방 좌표계 (방이 원점 중심이라 격자도 원점 기준)
       가구 상판 **그 가구의 좌표계** — 상판이 돌아가 있으면 격자도 같이 돈다
     왜 — 선반 상판은 깊이가 0.28m(5.6칸)뿐이다. 방 격자를 그대로 얹으면 칸이 판때기
     가장자리를 가로질러 상판 한가운데가 칸 경계에 걸린다. 격자를 면에 붙이면 그 면에서
     늘 같은 자리에 떨어진다. (문서: docs/handoff/roomview-grid.md)

     ★ 보이는 격자는 **바닥에만** 그린다. 선반마다 격자를 얹으면 방이 안 보인다.

     ── ★ 2026-08-07 : 상판 격자의 원점은 **그 가구 한가운데**다 ──────────────
     박사님: "바닥 그리드 간격만치 책상 위나 가구 위에 배치도 그만큼 많이 배치할 수 있게,
              가구 크기만큼 또는 살짝 더 작게 맞게 그리드를 배치해줘."

     예전에는 상판에서도 바닥과 **같은 규약**(발자국 앞 모서리를 걸음 선에 맞춤)을 썼다.
     그 선은 면 한가운데에서 시작하는 게 아니라 「발자국 반 칸」만큼 밀려 있어서,
     ① 면 한가운데가 자리가 아닐 때가 있고 ② 마지막 칸이 상판 밖으로 넘어간다.
     상판은 좁다 — 선반 단 깊이가 0.28m 다. 반 칸만 넘겨도 화분이 모서리에 걸친다.

     그래서 상판에서는 격자를 이렇게 깐다.
       원점  면 한가운데 (u=v=0 이 늘 자리다)
       걸음  바닥과 같은 값(step)
       범위  |u| ≤ 면 반폭 − 화분 반지름   ← "가구 크기만큼 또는 살짝 더 작게"
     범위 밖으로는 아예 자리를 안 낸다. 그래서 **격자에 물린 뒤에 삐져나오는 일이 없다.**
     한 칸도 안 들어갈 만큼 좁은 면이면 면 한가운데 하나만 남고, 그래도 안 들어가면
     그건 격자가 아니라 **판정(potFits)이 거절할 일**이다 — 여기서 봐 주지 않는다.

     ── ★ 그리고 바닥도 같은 규약으로 바꿨다 (같은 날) ─────────────────────
     예전 바닥 규약은 「발자국 앞 모서리를 걸음 선에 맞춘다」였다(snapSpanStep).
     그러면 앉는 자리가 **화분 크기마다 달라진다** — 걸음이 0.125m 일 때
       몬스테라(0.202 → 5칸)  자리 = 0.125k          보이는 칸의 선·한가운데에 딱 앉는다
       콩나물 시루(0.18 → 4칸) 자리 = 0.125k + 0.10  같은 방인데 눈금이 어긋난다
     "밑에 그리드의 절반"이라는 지시는 **보이는 칸과 같은 눈금**을 뜻한다. 그러니 화분도
     원점(방 한가운데) 기준 걸음 배수에 앉힌다. 방 치수가 전부 정수 m 이라 0.125 배수는
     보이는 칸선(0.25) 위이거나 그 한가운데다 — 어느 화분이든, 어느 방이든 그렇다.
     ⚠ 이 규약은 **화분·시루 것**이다. 가구는 예전 그대로 발자국 모서리를 맞춘다
       (snapFurniture → snapSpanStep). 가구는 칸 수 정수 점유가 겹침 판정의 근거다. */
  function snapOnSurface(x, z, potD, frame, step) {
    /* 바닥 — 방 원점이 격자 원점이다. 범위는 안 본다(방 경계는 inRoom·nav 가 본다) */
    if (!frame) return { x: snapInSpan(x, potD, step, null), z: snapInSpan(z, potD, step, null) };
    const c = Math.cos(frame.rot || 0), s = Math.sin(frame.rot || 0);
    /* 면 좌표계로 (house.js 규약의 역변환) */
    const dx = x - frame.x, dz = z - frame.z;
    const u = snapInSpan(dx * c - dz * s, potD, step, frame.w);
    const v = snapInSpan(dx * s + dz * c, potD, step, frame.d);
    return { x: frame.x + u * c + v * s, z: frame.z - u * s + v * c };
  }
  /* 원점 기준 걸음 격자에 앉힌다. span 을 주면 **그 안**으로만 앉힌다(상판).
     span 이 없으면 범위를 안 본다 — 면 크기를 모르는 곳에서 지어내지 않는다(바닥). */
  function snapInSpan(v, potD, step, span) {
    /* ── 바닥 — 방 원점 걸음 격자. **예전 그대로다**(여기는 안 건드린다) ── */
    if (!Number.isFinite(span)) return Math.round(v / step) * step;
    /* ── 면 — 그 면을 딱 나눠 덮는 칸의 **한가운데**다 (2026-08-15 · §surfaceAxis) ──
       ★ 뒤집힌 것이 이것이다. 전에는 「0.125 격자 위의 점」이 정본이고 칸이 그걸 따라 그려졌다.
         이제 **칸이 정본이고 놓는 자리가 칸 한가운데**다. 그래서 칸이 면을 남김없이 덮는다.
       ⚠ 화분이 면 밖으로 나가는 칸은 **후보에서 뺀다** — 「그린 자리 = 앉는 자리」를 지키려면
         못 앉는 칸으로 끌어당기면 안 된다. 하나도 없으면 면 한가운데(0)다(예전과 같다). */
    const A = surfaceAxis(span, potD);
    /* 칸이 물건보다 크거나 같으므로 **모든 칸이 들어간다**(§surfaceAxis ★★).
       그래도 걸러는 둔다 — 물건이 면보다 큰 경우(n=1·cell<potD)가 남아 있다. */
    const lim = span / 2 - potD / 2;
    let best = null, bestD = Infinity;
    for (let i = 0; i < A.n; i++) {
      const c = A.at(i);
      if (Math.abs(c) > lim + 1e-9) continue;
      const d = Math.abs(c - v);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best == null ? 0 : best;
  }

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
                  surfaceTop: null, maxPotD: null, ok: false, reason: null, nearest: null,
                  snapped: false, snappedTo: null, cells: null, surface: null };
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
    out.snapped = false;
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

    /* ★★ 격자에 앉힌다 — 다만 **추천 자리가 지배하면 자리가 이긴다.**
       ------------------------------------------------------------
       ⚠ 재서 확인했다: 슬롯 320칸 중 **0.05 격자에 떨어지는 것은 7% 뿐이다.**
         (house.js 가 가구 중심에서 상대 좌표로 슬롯을 내고, 가구 중심 자체가 격자 밖이다)
       그러니 슬롯을 격자로 끌어당기면 창턱·선반 자리가 통째로 어긋나 다시 막힌다 —
       이미 한 번 겪은 사고다(test_roomview_place S-1). **슬롯이 정본이고 격자는 안내다.**
       자리가 없는 곳에서만 칸에 맞춘다. opt.grid:false 면 예전처럼 연속 좌표다. */
    const step = placeStepOf(opt.step);
    /* 상판 사각형은 **한 번만** 잰다 — 격자도 판정(potFits)도 같은 값을 봐야 한다.
       두 번 재던 때 미리보기와 판정이 어긋난 적이 있다(§potFits 머리말). */
    const frame = (!isFloor && ownHit) ? meshRect(ownHit.object) : null;
    if (opt.grid !== false) {
      if (gov) {
        /* 슬롯이 곧 그 면의 '칸'이다 — 칸 중심 대신 **자리 중심**으로 간다 */
        out.x = +gov.x.toFixed(4); out.z = +gov.z.toFixed(4); out.y = +gov.y.toFixed(4);
        out.surfaceTop = out.y;
        out.snapped = true; out.snappedTo = gov.slotId;
      } else {
        /* opt.step 을 안 주면 **반 칸 0.125m**(보이는 칸의 절반)이다 — 머리말 2026-08-07.
           바닥이면 방 격자, 상판이면 그 가구 한가운데를 원점으로 한 격자다(snapOnSurface). */
        const sn = snapOnSurface(out.x, out.z, potD, frame, step);
        if (Math.abs(sn.x - out.x) > 1e-9 || Math.abs(sn.z - out.z) > 1e-9) out.snapped = true;
        out.x = +sn.x.toFixed(4); out.z = +sn.z.toFixed(4);
      }
    }
    /* 이 자리를 낸 격자를 그대로 알린다 — 화면이 칸을 그릴 때도, 검사가 걸음을 잴 때도
       같은 값을 봐야 한다. surface 는 상판 격자의 원점·크기다(바닥이면 null). */
    out.cells = { i: unitsFor(potD), j: unitsFor(potD), unit: GRID_UNIT, step };
    /* ★ 상판이면 **그 면의 칸**도 같이 낸다 (2026-08-15 · §surfaceAxis).
       ⚠ `step` 은 이제 상판에서 「앉는 간격」이 아니다 — 바닥의 걸음이다. 상판의 간격은
         면마다 다른 `cw`·`cd` 이고, 그걸 안 내주면 밖에서는 낡은 `step` 을 보고
         「좌표가 걸음 배수가 아니다」라고 잘못 읽게 된다(실제로 검사가 그렇게 읽었다). */
    if (frame) {
      const AU = surfaceAxis(frame.w, potD), AV = surfaceAxis(frame.d, potD);
      out.cells.nu = AU.n; out.cells.nv = AV.n;
      out.cells.cw = +AU.cell.toFixed(6); out.cells.cd = +AV.cell.toFixed(6);
    }
    out.surface = frame ? { x: +frame.x.toFixed(4), z: +frame.z.toFixed(4),
                            w: +frame.w.toFixed(4), d: +frame.d.toFixed(4),
                            rot: +frame.rot.toFixed(6) } : null;

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
      /* ★ 격자에 물린 **뒤에** 다시 잰다. 물려 놓고 판정을 안 하면 상판 밖에 뜬 화분이
         생긴다(render3d-to-plan ①「공중에 뜬 화분」과 같은 사고다). 격자가 이미 면 안으로만
         자리를 내지만(snapInSpan), 그건 격자의 약속이지 판정이 아니다 — 판정은 여기 한 곳뿐이다. */
      const f = potFits(potD, { rect: frame || meshRect(ownHit.object), point: { x: out.x, z: out.z } });
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
    /* ★ 등 (2026-08-08) — 화분 **뒤**, 퍼지 판정 **앞**이다.
       화분보다 뒤: 잎이 등 밑까지 자라면 물 주려는 손이 등에 먹힌다.
       퍼지보다 앞: 정확히 짚은 것이 대충 가까운 것을 이긴다(이 목록의 원칙 그대로). */
    const lp = pickLampRay(cx, cy);
    if (lp) return lp;
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

  /* ============================================================
     ★ 포인터 모드 — 「바로 그 자리」냐 「끈 만큼」이냐 (2026-08-08)
     ------------------------------------------------------------
     박사님: "클릭을 터치 또는 그 커서를 **상대 이동**으로 움직이게 설정에서 고를 수 있게."

     끌어서 옮기는 조작에는 기준점이 두 가지밖에 없다.
       direct    (기본·지금 그대로)  **손가락 자리**가 기준이다. 물건이 손가락 밑으로 온다.
       relative                      **물건이 지금 있는 자리**가 기준이다. 끈 만큼만 움직인다.

     ⚠ 방 뷰가 스스로 하는 끌기 둘은 **예전부터 상대**다 — 모드와 무관하게 안 바뀐다.
         걷기(walkDrag)  기준점 = 캐릭터 발밑(§onDown). 캐릭터는 폰에서 40px 남짓이라
                         정확히 짚을 수가 없어 애초에 이렇게 만들었다.
         시점 회전       각도를 손가락이 움직인 만큼 더한다. 이건 원래 상대다.
       그래서 이 모드가 실제로 가르는 것은 **화면(game.html)이 기준점을 잡는 끌기**다 —
       가구 끌기·등 끌기가 지금 손가락 자리를 기준으로 잡고 있다(재서 확인했다).
       화면은 아래 dragOrigin 한 줄로 두 조작을 이 모드에 맡길 수 있다.

     ⚠ 기본값은 반드시 direct 다. 바꾸면 폰 손버릇이 통째로 달라진다.
  ============================================================ */
  let ptrMode = 'direct';
  const POINTER_MODES = ['direct', 'relative'];

  /* 끌기의 기준점 — **뷰포트 CSS 픽셀**(clientX/clientY 와 같은 자)로 받고 같은 자로 준다.
     surfaceAt·pickFurnitureAt 이 쓰는 좌표계와 같다. (screenPosOf 만 캔버스 기준이다.)
       id            밝히거나 끄는 대상. 가구 uid · 자리 열쇠 · 화분 id · 캐릭터 id 다 받는다
       tapX, tapY    손가락이 눌린 자리. 안 주면 화면 한가운데
     돌려주는 값 { x, y, mode, from } — from 은 'tap' 또는 'object' 다.
     ★ relative 인데 그 물건이 화면에 안 보이면(카메라 뒤) 손가락 자리로 물러난다.
       그래야 "아무 반응이 없다"가 안 생긴다. */
  function dragOrigin(id, tapX, tapY) {
    const r = canvas.getBoundingClientRect();
    const tap = { x: Number.isFinite(tapX) ? tapX : r.left + r.width / 2,
                  y: Number.isFinite(tapY) ? tapY : r.top + r.height / 2 };
    if (ptrMode !== 'relative' || id == null) return { ...tap, mode: ptrMode, from: 'tap' };
    let p = null;
    const t = (() => { try { return resolveKey(id); } catch (e) { return null; } })();
    if (t) p = slotScreenPos(t.pos);
    else if (chars.has(id)) p = charScreenPos(chars.get(id));
    else p = furnScreenPos(anyFurnNode(id), 0);
    if (!p) return { ...tap, mode: ptrMode, from: 'tap' };
    return { x: +(r.left + p.x).toFixed(1), y: +(r.top + p.y).toFixed(1), mode: ptrMode, from: 'object' };
  }

  /* ── 포인터 ──
     폰   한 손가락 = 회전(손 떼면 8방 스냅) · 두 손가락 = 줌 · 탭 = 선택
     PC   좌드래그 = 회전 · 휠 = 줌 · 호버 = 자리 미리보기
     패닝은 넣지 않는다. 방은 고정 대상이라 옮길 이유가 없고, 있으면 길을 잃는다. */
  let down = null, dragging = false, pinch = 0;
  let walkDrag = null;         // ★ 고른 캐릭터가 있을 때만 만들어진다. 이게 곧 규칙이다
  const canHover = !window.matchMedia || window.matchMedia('(hover: hover)').matches;
  let hoverId = null;

  /* ★★ 유령 마우스 막기 (2026-08-03 · 박사님 "캐릭 이동 안 됨")
     ------------------------------------------------------------
     폰 브라우저는 터치가 끝나면 **호환용 마우스 이벤트**를 뒤따라 쏜다
     (touchend → mousedown → mouseup → click). 옛 사이트를 위한 장치다.
     그래서 손가락 한 번이 **두 번** 처리됐다:
       ① touchend  → resolveTap → 캐릭터를 고른다
       ② 유령 mouseup → resolveTap → 같은 캐릭터를 다시 눌러 **고르기가 풀린다**
     결과는 "아무도 안 골라진 상태". 그 뒤로는 끌어도 걷지 않고 카메라만 돈다 —
     박사님이 겪으신 '캐릭 이동 안 됨'이 이것이다.

     ⚠ 왜 검사에서 안 잡혔나 — 합성 TouchEvent 는 호환 마우스를 만들지 않는다.
       그래서 tools/test_roomview_walk.mjs 가 21/21 을 통과하면서도 폰에서는 막혀 있었다.
       재현하는 블록을 그 파일에 넣어 뒀다(터치 뒤에 마우스를 손으로 쏜다).

     고치는 법은 업계에서 쓰는 그대로다 — **터치 직후에 오는 마우스는 버린다.**
     touchstart 를 passive 로 달아 둬서(스크롤 성능) preventDefault 로는 못 막는다. */
  const GHOST_MS = 700;
  let lastTouchAt = -1e9;
  const fromTouch = e => !!(e && (e.touches || e.changedTouches));
  /* 터치면 시각을 적고 false, 마우스인데 터치 직후면 true(=버릴 것) */
  function ghostMouse(e) {
    if (fromTouch(e)) { lastTouchAt = performance.now(); return false; }
    return performance.now() - lastTouchAt < GHOST_MS;
  }

  const onDown = e => {
    if (ghostMouse(e)) return;                 // 터치가 만든 유령 마우스
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
    if (ghostMouse(e)) return;
    if (!down) { if (canHover && e.clientX != null) onHover(e); return; }
    if (e.touches && e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dd = Math.hypot(dx, dy);
      if (pinch) {
        /* ★ 2026-08-16 — 휠과 같은 까닭으로 **돌던 트윈을 끊는다**(§onWheel ⓐ).
           두 손가락으로 벌리는데 카메라가 도로 끌려가면 그게 「턱」이다. */
        tween = null;
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
    /* ★★ **마우스는 문턱을 더 크게 잡는다** (박사님 2026-08-08: "클릭하면 저렇게 옆으로 가버려").
       ══════════════════════════════════════════════════════════════════
       마우스로 누르면 누르는 동안 몇 px 이 늘 흔들린다(손·휠·바닥 마찰). 12px 은 손가락
       기준으로 고른 값이라 마우스에서는 **그냥 누른 것도 회전으로 읽힌다.**
       그러면 화면이 통째로 돌고, 방 위에 떠 있는 말풍선도 같이 미끄러져
       「버튼이 도망간다」가 된다 — 실제로 그렇게 보였다.
       ⚠ 손가락은 **그대로 12px** 이다. 폰에서 문턱을 올리면 이번엔 회전이 뻑뻑해진다.
         터치는 누를 때 흔들림이 적어 12 로 충분하다는 것이 지금까지의 값이고, 안 건드린다.
       ★ 28px 은 「손목이 떨리는 폭」이지 「끌려는 뜻」이 아니다 — 진짜로 돌리려면
         그보다 훨씬 크게 움직인다. 돌리기 자체는 한 번 시작되면 예전과 똑같이 부드럽다. */
    const slop = e.touches ? TAP_PX : TAP_PX_MOUSE;
    if (!dragging && Math.hypot(dx, dy) < slop) return;

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
    if (ghostMouse(e)) return;
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
      } else if (hit.type === 'lamp') {
        /* ★ **여기서 먼저 켜고 끈다** (2026-08-08 · §⑧-e).
           호스트를 기다렸다 켜면 폰에서 한 박자 늦게 밝아진다 — 손끝의 물건은
           손끝에서 반응해야 한다. 호스트가 막을 일이면 setLampOn 으로 되돌린다. */
        selectCharacter(null);
        const st = toggleLamp(hit.uid);
        O.onLampTap && O.onLampTap(hit.uid, st.on, st);
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
    if (ghostMouse(e)) return;
    if (!O.orbit) return;
    e.preventDefault();
    /* ★★★ 2026-08-16 — **「확대축소가 턱턱 걸린다」의 원인 둘** (박사님 지적) ══════════
       ------------------------------------------------------------
       ⓐ **돌던 트윈을 안 끊었다.** 손을 떼면 `settleCam` 이 160ms 뒤에 트윈을 건다.
         그 트윈이 도는 동안 휠을 굴리면 여기서 `cam.dist` 를 써도 **다음 프레임에
         `stepTween` 이 덮어쓴다.** 내가 당기는데 카메라가 도로 끌려간다 — 그게 「턱」이다.
         ⚠ 끌기(`onDragMove`)는 이미 `tween = null` 을 하고 있었다. **휠·핀치만 빠져 있었다.**
       ⓑ **굴린 양을 안 봤다.** `Math.sign(e.deltaY)` 라 **한 번에 무조건 8%** 였다.
         트랙패드는 작은 값을 잘게 여러 번 보내는데 그 하나하나가 8% 계단이 된다.
       ⇒ 트윈을 끊고, 굴린 양에 비례시키되 한 번에 너무 크지 않게 자른다. */
    tween = null;
    const [lo, hi] = focused ? [0.5, 3.6] : zoomRange();
    /* 줄 단위(deltaMode 1)로 오는 브라우저가 있다 — 그때는 한 줄을 16px 로 친다 */
    const px = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
    /* 100px(휠 한 칸)이 8% 가 되게 맞추고, 한 번에 25% 를 넘지 않게 자른다 */
    const k = clamp(px * 0.0008, -0.25, 0.25);
    cam.dist = softClamp(cam.dist * (1 + k), lo, hi);
    needsRender = true;
    clearTimeout(onWheel._t);
    onWheel._t = setTimeout(() => { if (!disposed) settleCam(); }, 160);
  };

  /* 호버 (PC 전용). 자리 이름·밝기를 띄우는 건 호스트 몫이고, 여기선 어느 자리인지만 알린다. */
  function onHover(e) {
    const hit = pickAt(e.clientX, e.clientY);
    const id = hit ? hit.slotId : null;
    /* ★ 등 위에서도 손가락 커서가 떠야 "누를 수 있다"가 읽힌다 (2026-08-08).
       ⚠ **onSlotHover 로는 안 보낸다** — 그 창구의 인자는 자리 id 다. 등 uid 를 실어 보내면
         호스트가 없는 자리를 찾는다. 여기서 바뀌는 것은 커서뿐이다. */
    canvas.style.cursor = (hit || pickLampRay(e.clientX, e.clientY)) ? 'pointer' : '';
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
  canvas.addEventListener('touchcancel', (e) => { ghostMouse(e); down = null; dragging = false; pinch = 0;
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
  /* ★ 조명 정책 스위치 — 'game'(기본) · 'house'(scene.js 기본 = index.html 과 같은 그림)
     재는 자다. 같은 카메라·같은 시각에서 번갈아 찍어야 "게임이 얼마나 더 어두운가"를
     숫자로 말할 수 있다. 눈으로 두 페이지를 비교하면 카메라가 달라 답이 안 나온다. */
  let lightPolicy = 'game';
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

  /* 창밖 골목의 낮밤 — ★ **여기서 안 먹인다** (2026-08-15).
     outside.js 가 dayGet 콜백으로 daylightT 를 직접 읽고, **그리기 직전**
     (updateMatrixWorld)에 정점색을 갈아 끼운다. 왜 그 자리여야 하는지는 그 파일
     §updateMatrixWorld 에 있다 — 여기서 미리 칠하면 한 프레임 늦게 반영되고,
     이 게임은 "바뀔 때만 그리므로" 그 다음 프레임이 영영 안 오는 일이 흔하다
     (그래서 예전에 낮/밤 창밖 색이 뒤바뀌어 찍혔다).
     ⚠ 그래도 조명 값을 **되돌려 쓰지 않는다**는 원칙은 그대로다 — 방향은 한쪽뿐이다.
     ⇒ 그래서 여기에 아무 함수도 없다. 찾다가 헛걸음하지 않도록 이 주석만 남긴다. */

  function applyDaylight() {
    /* ★천장등은 **낮에 아예 안 켠다** (박사님 2026-08-03: "낮에는 안 켜지게").
       scene.js 의 자동 모드(0)는 해가 약하면 켜는데, 반지하는 낮에도 해가 약해서
       한낮에 천장등이 같이 켜졌다 — 방이 통째로 하얘지고 창으로 드는 빛이 묻혔다.
       이 게임에서 창빛은 볼거리이자 정보다. 그걸 덮는 조명은 낮에 있으면 안 된다.
       0.30~0.78 을 낮으로 본다(아침 해 뜬 뒤 ~ 저녁 해 지기 전). */
    const isDay = daylightT > 0.30 && daylightT < 0.78;
    if (lightPolicy === 'house') {
      /* index.html(집 도구)과 **같은 그림**. scene.js 기본값 그대로 — 아무것도 안 누른다.
         비교용이라 그림자 예산만 게임과 같게 둔다(그건 밝기가 아니라 성능이다). */
      const l0 = updateLight(ctx, daylightT * 100, 0);
      ctx.renderer.toneMappingExposure = 1.1;
      applyShadowBudget();
      if (ctx.sunLight.castShadow) ctx.sunLight.shadow.needsUpdate = true;
      needsRender = true;
      return l0;
    }
    const label = updateLight(ctx, daylightT * 100, isDay ? 2 : 0);

    /* ★★ 밤은 **천장등 하나가 만드는 웅덩이**여야 한다 (2026-08-03 · 박사님 "밤에 등이 아직도 너무 밝다")
       ------------------------------------------------------------
       재 보고 알았다. 문제는 등의 세기가 아니라 **낮밤 대비가 없다**는 것이었다.
         고치기 전 (tools/probe_room_light.mjs · 반지하 · 화면 휘도 0..255)
           낮 t=0.50  방바닥 108
           밤 t=0.95  방바닥 210   ← **밤이 낮보다 93% 더 밝았다**
           밤 웅덩이(등아래/구석) 1.09배  ← 웅덩이가 아예 없다
       원인은 둘이다.
         ① 아래에 있던 '밤을 캄캄하게 두지 않는다' 바닥값(hemi 0.46 · ambient 0.23)이
            **scene.js 의 밤 채움광(0.16 · 0.07)보다 3배 높았다.** 어둠을 막으려던 장치가
            밤을 통째로 들어 올리고 있었다.
         ② 천장등이 PointLight(거리 14 · 감쇠 1.2)라 2.3m 짜리 방에서는 감쇠가 안 보인다.
            방 전체가 고르게 밝아 웅덩이가 안 생긴다.
       그래서 채움광을 내리고 **등의 거리·감쇠를 방 크기에 맞춘다.** 등 아래는 밝고
       구석은 어두운 것이 밤이다. 세기를 더 낮추는 게 아니라 대비를 만드는 게 답이다. */
    if (ctx.ceilingBulb.intensity > 0) {
      ctx.ceilingBulb.intensity *= BULB_K;
      /* ★ 거리·감쇠를 방에 맞춘다 — 이게 웅덩이를 만드는 유일한 손잡이다.
         scene.js 기본(14m · 1.2)은 아파트 거실까지 덮는 값이라 작은 방에서는 평평하다. */
      const b0 = roomBox();
      ctx.ceilingBulb.distance = Math.max(2.4, Math.min(b0.w, b0.d) * 0.70 + b0.h * 0.40);
      ctx.ceilingBulb.decay = BULB_DECAY;
      if (ctx.clShade && ctx.clShade.material)
        ctx.clShade.material.emissiveIntensity = BULB_EMISSIVE;   // 0.9 → 은은하게 켜진 정도
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
    ctx.renderer.toneMappingExposure = GAME_EXPOSURE * userBright;

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

    /* ★★ 방은 어둡되 **창으로 드는 볕은 밝다** (2026-08-03 · 박사님 "외부 태양빛이 너무 안 들어온다")
       ------------------------------------------------------------
       재 보고 알았다. 그동안 "너무 밝다"는 지적에 채움광·노출·재질을 통째로 눌러 왔는데,
       그게 **창으로 들어오는 빛까지 같이 눌렀다.**
         고치기 전 (game / house(=index.html) 비율 · 낮 t=0.50)
           방바닥 51% · **창가 64%** · 안쪽 44% · 벽 60%
       방 안쪽을 44% 로 눌러 어둡게 만든 것은 의도한 것이고 그대로 둔다.
       잘못은 창가까지 64% 로 같이 내려간 것이다 — 햇살이 드는 자리는 눌리면 안 된다.

       손잡이를 갈랐다. 방 안쪽 밝기와 창 밝기는 **다른 빛이 만든다.**
         방 안쪽 ← hemi·ambient (방향 없는 채움광) · 재질 색
         창가    ← sunLight(직사광) · skyPortals(창 확산광)   ← 이 둘만 올린다
       채움광은 그대로 두고 해와 창 확산광만 올리면 **대비가 커진다.**
       햇살 기둥과 창가 바닥의 밝은 자국이 그렇게 산다. 조도 계산은 안 건드린다 —
       dliAt·daylightRatio·창 tau 는 그대로고 여기서 바꾸는 것은 **화면뿐**이다. */
    const day = clamp(ctx.sunLight.intensity / 1.55, 0, 1);
    ctx.hemi.intensity *= (1 - DAY_FILL_CUT.hemi * day);
    ctx.ambient.intensity *= (1 - DAY_FILL_CUT.amb * day);
    ctx.sunLight.intensity *= SUN_BOOST;
    for (const sp of (ctx.skyPortals || [])) sp.intensity *= PORTAL_BOOST;

    /* 밤을 완전한 암흑으로는 두지 않는다 — 빨리감기에서 까매지면 "꺼졌다"로 읽힌다.
       ★ 다만 바닥값은 scene.js 의 밤 채움광(0.16·0.07)보다 **낮아야** 한다.
         예전 값(0.46·0.23)은 그보다 높아서 밤을 낮보다 밝게 만들고 있었다. */
    const dark = 1 - clamp(ctx.sunLight.intensity / (1.2 * SUN_BOOST), 0, 1);
    ctx.hemi.intensity *= (1 - NIGHT_FILL_CUT * dark);
    ctx.ambient.intensity *= (1 - NIGHT_FILL_CUT * dark);
    ctx.hemi.intensity = Math.max(ctx.hemi.intensity, NIGHT_HEMI_MIN * dark);
    ctx.ambient.intensity = Math.max(ctx.ambient.intensity, NIGHT_AMB_MIN * dark);

    /* 안개는 scene.js 가 매번 새로 만든다(30~120m). 폰 세로는 방을 통째로 담느라
       카메라가 멀리 서므로 그대로 두면 방이 뿌옇게 죽는다. 카메라 거리에 맞춘다. */
    if (ctx.scene.fog) {
      ctx.scene.fog.near = Math.max(30, cam.dist * 1.35);
      ctx.scene.fog.far = Math.max(120, cam.dist * 4.5);
    }
    /* 방에 놓인 조명 기구 — **손으로 켠 것**이 먼저고, 안 만진 등만 자동으로 돈다.
       화면 연출만이고 판정은 조도 엔진 몫이다.
       그림자 없는 점광원이라도 개수가 늘면 셰이더가 무거워지니 4개에서 자른다. */
    let on = 0;
    for (const r of (built && built.lightRigs) || []) {
      if (!r.light) continue;
      const want = lampIsOn(r.uid);
      r.light.intensity = (want && on < 4) ? (r.grow ? RIG_GROW : RIG_LAMP) : 0;
      /* ★ 기구도 방 크기에 맞춰 조인다 — 넓게 퍼지면 방 전체가 고르게 밝아 '웅덩이'가 안 생긴다.
         house.js 는 coverage_r×6(최대 수 m)로 두는데 그건 아파트 거실 기준이다. */
      if (r.light.intensity > 0) {
        const b1 = roomBox();
        r.light.distance = Math.max(1.8, Math.min(b1.w, b1.d) * (r.grow ? 0.35 : 0.62) + b1.h * 0.35);
        r.light.decay = 2.0;
        on++;
      }
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

  /* ★★ 캐릭터가 **실제로 움직이는 동안만** 상한을 푼다
     (2026-08-05 · 박사님 "캐릭 움직이거나 하는 게 약간 프레임이 떨어져 보여")
     ------------------------------------------------------------
     ★ 무엇을 재서 알았나
       ① 렌더 자체는 안 무겁다. 헤드리스(SwiftShader·소프트웨어 GL)에서도
          한 장 1.4ms(중앙) 였다 — 60장을 그려도 프레임 예산의 10%다.
          즉 30 은 **못 그려서가 아니라 배터리 때문에 자른 값**이다.
       ② 그런데 캐릭터는 스켈레톤 클립을 AnimationMixer 로 돌린다
          (render3d/character.js · idle·walking GLB). 골격 애니메이션은
          30장에서 눈에 띄게 끊긴다. 몬이의 느린 흔들림(2.5초 주기)과는 다른 물건이다.
       ③ ⚠ **폰의 체감은 헤드리스로 못 잰다** — 화면이 없어 rAF 가 9장/초밖에 안 돈다.
          그래서 "30이 원인이다"를 숫자로 못 박지는 못했다. 아래는 그 사실을 안 채로
          **되돌릴 수 있게** 넣은 변경이다(스스로 30으로 내려간다).

     그래서 상한을 셋으로 나눈다. **배터리를 태우던 두 경우는 그대로 둔다.**
       노는 중(idle)      10  — 그대로. 몬이 흔들림 때문에 방을 22번 다시 그리던 그 값이다
       바쁜 중(busy)      30  — 그대로. 손가락 끌기가 초당 48장을 태우던 그 값이다
       움직이는 중(move)  60  — ★ 여기만 푼다. 걷기·물주기는 짧고 드물다
     그리고 못 따라가면 **스스로 30 으로 내린다**(아래 moveBackoff). 폰이 느리면
     예전 값으로 돌아가므로, 이 변경이 느린 기기를 더 나쁘게 만들 길은 없다. */
  const MOVE_FPS_MAX = 60;
  let moveFps = MOVE_FPS_MAX;      // 못 따라가면 CHAR_FPS 로 내려앉는다
  let slowMoveWindows = 0;
  let moveWindow = false;          // 이 500ms 창에 '움직이는 중' 프레임이 있었나

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
  /* ★★ 노는 동안은 더 낮게 그린다 (2026-08-03 · "가만히 있는 화면이 계속 그린다")
     ------------------------------------------------------------
     재 보고 넣었다(390×844 · 반지하 · 3초 동안 그린 장수).
       캐릭터 없음        0장    ← 놀 때 안 그리는 정책은 원래 잘 돌고 있었다
       자취녀만          37장 (12.3fps)
       **자취녀+몬이     66장 (22.0fps)**  ← 몬이가 늘 흔들려서 두 배가 됐다
     몬이는 공중에서 계속 위아래로 흔들린다(bobPeriod 2.5초). 그 느린 움직임 하나 때문에
     방 한 장(드로우콜 103·삼각형 7.6만)을 초당 22번 다시 그리고 있었다 — 폰 배터리가 그냥 탄다.

     그렇다고 흔들림을 없앨 수는 없다(살아 있다는 표시다). 대신 **그리는 빈도를 나눈다.**
       바쁠 때  걷기·끌기·카메라 트윈·링 맥박·밖에서 뭔가 바뀜  → 30fps
       놀 때    캐릭터 idle 만 도는 중                        → 10fps
     2.5초에 한 바퀴 흔들리는 것이라 10fps 로도 부드럽다(주기당 25장). */
  const IDLE_FPS = 10;
  const IDLE_FRAME_MS = 1000 / IDLE_FPS - 4;

  /* ★★★ 사람이 서 있는 동안만 idle 상한을 올린다 (2026-08-06)
     ══════════════════════════════════════════════════════════════════
     박사님이 렉을 정확히 좁혀 주셨다:
       "이동할 때는 되게 쾌적한데 **가만히 서서 모션할 때** 뭔가 버버벅 한다고 할까나?"
     상한 표와 정확히 맞는다 — 걷는 중은 60, 가만히 서 있는 중은 **10** 이다.

     ★ 왜 10 이었나(그 판단을 뒤집지 않는다)
       몬이가 2.5초 주기로 흔들려서 방 한 장을 초당 22번 다시 그리고 있었다.
       "노는 화면은 안 그린다"가 배터리 정책이고, 그건 그대로 옳다.
     ★ 그런데 사람은 다르다 — **스켈레톤 클립**이다. 앞선 창도 "30에서 눈에 띄게
       끊긴다"고 적었는데 idle 은 그 3분의 1인 10이다. 2.5초짜리 느린 흔들림과
       1초에 여러 번 움직이는 골격 애니메이션을 **같은 상한으로 묶은 것**이 잘못이었다.

     ★ 그래서 가르는 기준은 "노는가"가 아니라 **"스켈레톤이 도는가"** 다.
       사람이 없는 방(확대 중·이사 직후·몬이만 있는 방)은 **예전 그대로 10** 이다.
     ★ 그리고 moveBackoff 와 같은 사상으로 **느린 기기는 스스로 내려앉는다**(idleBackoff).
       한 번 내려가면 그 화면이 사는 동안 10 이다 — 오르내리면 그 자체가 렉으로 보인다.

     ★ 값의 표는 tools/test_perf_budget.mjs §③ 이 낸다 (10 → 10.0 · 18 → 18.0 · 24 → 24.3).

     ★★ 24 → **18** (박사님 2026-08-07 확정).
       끊겨 보이던 것은 fps 가 낮아서가 아니라 **15 아래**였기 때문이다 — 사람 눈이 동작을
       연속으로 읽기 시작하는 문턱이 그 언저리다. 18 은 그 위라 "버버벅"이 사라지고,
       배터리는 예전 대비 2.4배가 아니라 **1.8배**다. 24 와 18 의 차이는 나란히 놓고 봐야
       겨우 보이는데 값은 33% 더 낸다. 사람이 서 있는 동안만 드는 값이라 아껴 둘 자리다. */
  const ANIM_IDLE_FPS = 18;
  let idleFps = IDLE_FPS;          // 지금 쓰는 idle 상한
  let idleForced = null;           // setIdleFps 로 손으로 못 박은 값(재는 도구용)
  let animBackedOff = false;       // 한 번 내려앉았으면 다시 안 올린다
  let slowIdleWindows = 0;
  let animWindow = false;          // 이 500ms 창에 '사람이 서 있는' 프레임이 있었나
  /* 스켈레톤이 도는 사람이 방에 있나 — 마스코트는 트랜스폼만 움직인다(스켈레톤이 없다) */
  function hasSkeletalChar() {
    for (const [, c] of chars) if (c.kind === 'person') return true;
    return false;
  }
  function idleCap() {
    if (idleForced != null) return idleForced;
    if (animBackedOff) return IDLE_FPS;
    return hasSkeletalChar() ? ANIM_IDLE_FPS : IDLE_FPS;
  }
  let lastFrameAt = 0;
  /* ★ 확대(화분 상세보기)처럼 방이 안 보이는 동안 rAF 를 통째로 멈춘다 — setPaused */
  let paused = false;
  /* 이 500ms 창에 **노는 프레임**이 한 장이라도 있었나. autoQuality 가 이걸 본다. */
  let idleWindow = false;

  /* 지금 '바쁜가' — 바쁘면 30fps, 아니면 10fps 로 그린다.
     needsRender 는 **밖에서 뭔가 바뀌었다**는 표시다(setPlant·setDaylight·카메라…).
     캐릭터 idle 은 needsRender 를 안 켠다 — 그래서 이 한 줄로 둘이 갈린다. */
  /* 0 = 노는 중 · 1 = 바쁜 중 · 2 = 캐릭터가 실제로 움직이는 중
     ★ 2 는 **사람의 몸이 움직이는 것**만이다(걷기·물주기 모션). 손가락 끌기나
       카메라 트윈은 1 이다 — 그건 예전에 30 으로 자른 이유가 따로 있다. */
  const LV_IDLE = 0, LV_BUSY = 1, LV_MOVE = 2;
  function busyLevel() {
    for (const [, c] of chars) if (c.walking) return LV_MOVE;
    /* ★ 무언가 하는 중(actAt)도 몸이 움직인다 — 모션과 물줄기가 여기 걸린다.
       끝나면 이펙트를 통째로 치우므로 곧바로 노는 화면(10fps)으로 돌아간다. */
    if (actBusy()) return LV_MOVE;
    if (needsRender || tween || pendingDrag || walkDrag || rings.size) return LV_BUSY;
    return LV_IDLE;
  }
  /* 그 단계에서 한 장 사이의 최소 간격[ms]. 4ms 여유는 예전 값 그대로다
     (문턱이 rAF 주기에 딱 붙으면 한 장씩 걸러져 오히려 절반이 된다). */
  function frameGapFor(level) {
    if (level === LV_MOVE) return 1000 / moveFps - 4;
    if (level === LV_BUSY) return MIN_FRAME_MS;
    idleFps = idleCap();
    return 1000 / idleFps - 4;
  }
  /* 끄는 동안 마지막 손가락 자리만 적어 둔다. 광선·길찾기는 프레임당 한 번만 한다. */
  let pendingDrag = null;

  /* ★ 몸을 갱신하는 빈도는 **그리는 빈도와 같아야** 한다.
     여기만 30 으로 두고 60장을 그리면 같은 자세를 두 번 그리는 것이라
     배터리만 쓰고 부드러워지지는 않는다(예전 창이 끌기에서 짚은 그 낭비다). */
  function stepCharacters(now, force, level) {
    if (!chars.size) { lastCharAt = now; return false; }
    const dt = (now - lastCharAt) / 1000;
    const rate = (level === LV_MOVE) ? moveFps : CHAR_FPS;
    /* 0.9 배로 여유를 둔다 — 위 frameGapFor 와 문턱이 딱 붙어 있으면 프레임이 조금만
       흔들려도 한 번씩 걸러져 캐릭터가 20fps 로 뚝뚝 끊긴다(딱 붙여 두고 봤다). */
    if (!force && dt < 0.9 / rate) return false;
    lastCharAt = now;
    for (const [, c] of chars) {
      try { c.update(Math.min(dt, 0.1)); } catch (e) { fail(e); }
    }
    return true;
  }

  function loop(now) {
    if (disposed || paused) return;
    raf = requestAnimationFrame(loop);
    /* 아직 이르면 아무것도 안 한다. needsRender 는 그대로 켜져 있으니 다음 프레임에 그린다. */
    /* ★ 이 창이 '바쁜 창'이었나를 같이 적어 둔다 — 아래 autoQuality 가 그것만 본다 */
    const level = busyLevel();
    if (!forceContinuous && now - lastFrameAt < frameGapFor(level)) return;
    if (level === LV_IDLE) { idleWindow = true; if (idleFps > IDLE_FPS) animWindow = true; }
    if (level === LV_MOVE) moveWindow = true;
    lastFrameAt = now;
    /* 끄는 중이면 여기서 딱 한 번 목적지를 계산한다(이벤트마다 하지 않는다) */
    if (pendingDrag) {
      const d = pendingDrag; pendingDrag = null;
      if (d === walkDrag) d.target = showWalkGhost(walkTargetAt(d.px, d.py));
    }
    const moving = stepTween(now) | pulseRings(now) | stepCharacters(now, false, level);
    if (!needsRender && !moving && !forceContinuous) {
      /* ★ 노는 동안은 fps 를 세지 않는다. 여기서 세면 "가만히 있어서 1초에 두 장만
         그렸다"가 "1초에 두 장밖에 못 그린다"로 읽혀 화질을 멋대로 떨어뜨린다.
         실제로 그랬다 — 픽셀비가 1.75에서 1.25로 내려가 있었다. */
      lastFpsAt = now; framesSince = 0; idleWindow = false; moveWindow = false; animWindow = false;
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
      /* ★★ '안 바쁜 것'과 '느린 것'을 가르는 문이 하나 더 필요해졌다 (2026-08-03).
         노는 동안 10fps 로 자르기 시작하면서, autoQuality 가 그 10 을 보고
         "못 따라간다"고 판단해 **픽셀비를 0.85 까지 떨어뜨렸다**(실제로 떨어뜨렸다).
         노는 창은 느린 게 아니라 **일부러 덜 그린 창**이다. 판정에서 뺀다.
         (fps 자체는 그대로 남긴다 — 몇 장 그렸는지는 사실이고, 재는 도구가 그걸 읽는다) */
      if (framesSince >= 4) {
        stats.fps = Math.round(framesSince * 1000 / (now - lastFpsAt));
        if (!idleWindow) autoQuality(); else slowWindows = 0;
        moveBackoff();
        idleBackoff();
      }
      framesSince = 0; lastFpsAt = now; idleWindow = false; moveWindow = false; animWindow = false;
    }
  }

  /* ★ 방을 통째로 멈춘다·되돌린다 (2026-08-03 · "화분 상세보기 누르면 렉 걸려")
     ------------------------------------------------------------
     확대(plant_grow iframe)가 열리면 **WebGL 컨텍스트 둘이 동시에** 돈다. 방은 안 보이는데도
     계속 그려서 확대 쪽이 프레임을 못 받는다(회전이 뻑뻑한 이유다).
     setContinuous(false) 로는 안 된다 — 그건 상한만 푸는 것이고 loop 은 계속 돈다.
     여기서는 **rAF 자체를 끊는다.** 그리기도 캐릭터 애니메이션도 멈춘다.

     ⚠ 논리는 안 멈춘다. 하루·성장·경제는 밖에서 돌고, 여기서 멈추는 것은 화면뿐이다.
     ⚠ 풀 때 시각 기준을 **지금으로 되잡는다.** 안 그러면 10초 멈췄다 풀었을 때
       stepCharacters 가 10초치 dt 를 한 번에 받아 캐릭터가 순간이동한다
       (update 안에서 dt 를 0.1초로 자르고 있지만, 그것도 한 프레임에 10cm 튀는 것이다). */
  function setPaused(on) {
    const want = !!on;
    if (want === paused) return paused;
    paused = want;
    if (paused) {
      cancelAnimationFrame(raf);
      raf = 0;
    } else if (!disposed) {
      const now = performance.now();
      lastFrameAt = now; lastCharAt = now; lastFpsAt = now;
      framesSince = 0; stats.fps = 0; slowWindows = 0; slowMoveWindows = 0; moveWindow = false;
      needsRender = true;                      // 멈춰 있는 동안 바뀐 것을 한 장에 반영한다
      raf = requestAnimationFrame(loop);
    }
    return paused;
  }

  /* ★ 움직임 상한을 스스로 내린다 — "빠른 폰에서만 60"
     ------------------------------------------------------------
     캐릭터가 움직이는 500ms 창에서 실제로 그린 장수가 상한의 4분의 3도 안 되면
     그 폰은 60 을 못 낸다. 연속 두 창이 그러면 예전 값(30)으로 내려앉는다.
     ⚠ 다시 안 올린다 — 오르내리면 그 자체가 '프레임이 튄다'로 보인다.
       한 번 30 으로 내려가면 그 화면이 살아 있는 동안 30 이다(예전과 똑같은 화면). */
  /* ★ 서 있는 상한을 스스로 내린다 — "빠른 폰에서만 24"
     ------------------------------------------------------------
     moveBackoff 와 **같은 사상**이다. 사람이 서 있는 500ms 창에서 실제로 그린 장수가
     상한의 4분의 3도 안 되면 그 폰은 24 를 못 낸다. 연속 두 창이 그러면 예전 값(10)으로
     내려앉고 **다시 안 올린다.** 그래서 이 변경이 느린 기기를 더 나쁘게 만들 길은 없다. */
  function idleBackoff() {
    if (forceContinuous || !animWindow || animBackedOff || idleForced != null) return;
    slowIdleWindows = (stats.fps < ANIM_IDLE_FPS * 0.75) ? slowIdleWindows + 1 : 0;
    if (slowIdleWindows >= 2) {
      slowIdleWindows = 0;
      animBackedOff = true;
      stats.idleFps = IDLE_FPS;
      stats.reduced = `서 있는 상한 ${IDLE_FPS}`;
    }
  }

  function moveBackoff() {
    if (forceContinuous || !moveWindow || moveFps <= CHAR_FPS) return;
    slowMoveWindows = (stats.fps < moveFps * 0.75) ? slowMoveWindows + 1 : 0;
    if (slowMoveWindows >= 2) {
      slowMoveWindows = 0;
      moveFps = CHAR_FPS;
      stats.moveFps = moveFps;
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
  /* ★ 세 색 (2026-08-05 · 박사님 "추천하거나 맞는 곳은 초록빛, 별로인 곳은 빨간빛")
     ------------------------------------------------------------
     예전엔 파랑/빨강 두 색이었고 뜻은 **"놓을 수 있다/없다"** 하나뿐이었다.
     그런데 첫 플레이가 가르치는 것은 "자리가 결과를 바꾼다" 하나다 —
     놓을 수 있느냐가 아니라 **좋은 자리냐**를 말해야 그 학습이 된다. 그래서 셋으로 가른다.

       good  초록   놓을 수 있고 그 작물에 좋은 자리
       ok    노랑   놓을 수는 있는데 별로
       bad   빨강   여기는 아니다 — 못 놓거나(크기·점유), 그 작물에 못 쓸 자리
     ★ 'bad' 는 **어디서든 빨강**이다. 이유가 물리(크기)든 빛이든 플레이어에게는
       "여기는 아니다" 한 가지다 — 박사님 말도 "별로인 곳은 빨간빛" 이었다.

     ★★ 좋은 자리인지는 **여기서 판정하지 않는다.** 몬스테라는 밝아야 좋고 콩나물은
       어두워야 좋다 — 작물마다 반대다. 그건 게임 쪽(loop·first_play)이 아는 값이라
       rank 로 **받아서 칠하기만** 한다. 방뷰가 판정하면 작물이 늘 때마다 여기가 틀린다.

     ⚠ rank 를 안 주면 예전 그대로다 — 놓을 수 있으면 GH_OK, 아니면 GH_NG.
       (game.html 이 아직 문자열 배열로 부른다. 그 호출을 깨면 안 된다) */
  const GH_OK  = 0x54c98a;                       // 초록 — 놓을 수 있다 / 좋은 자리
  const GH_MID = 0xf2c14e;                       // 노랑 — 놓을 수는 있는데 별로
  const GH_NG  = 0xe8615a;                       // 빨강 — 못 놓는다 (decorate.js 와 같은 값)
  /* rank → 색. 모르는 말이 오면 예전 두 색으로 떨어진다(던지지 않는다 — 색 하나 때문에
     배치가 멈추면 안 된다). */
  const RANK_HEX = { good: GH_OK, ok: GH_MID, bad: GH_NG };
  function rankHex(rank) {
    if (typeof rank === 'string' && RANK_HEX[rank] != null) return RANK_HEX[rank];
    return rank === false ? GH_NG : GH_OK;       // 예전 규약(boolean)
  }
  /* 'good'|'ok'|'bad' 로 정규화. 아무것도 안 주면 null(= 호출부가 정하게 둔다) */
  function normRank(rank) {
    if (rank === true) return 'good';
    if (rank === false) return 'bad';
    return (typeof rank === 'string' && RANK_HEX[rank] != null) ? rank : null;
  }

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
    /* 바닥(자리) 표시 — ★ 2026-08-06 네모로 바꿨다. 격자 한 칸(0.25m) 반너비에 맞춘다
       (박사님 "동그라미여서 밑에 네모 격자랑 안 맞아"). 색·깊이검사 규약은 그대로다. */
    const marker = new THREE.Mesh(
      squareFrameGeometry(0.72),
      new THREE.MeshBasicMaterial({ color: GH_OK, transparent: true, opacity: 0.85,
                                    side: THREE.DoubleSide, depthTest: false }));
    /* ★ 만들 때 값도 **같은 자**를 쓴다 — previewAt/previewMove 가 곧바로 덮어쓰지만,
       두 곳이 다른 식을 쓰면 언젠가 한쪽만 고쳐진다(실제로 그래서 3.4m 네모가 났다). */
    marker.scale.setScalar(markerHalf(potD));
    marker.rotation.x = -Math.PI / 2;
    marker.renderOrder = 999;
    houseGroup.add(marker);
    houseGroup.add(g);
    return { group: g, marker, mat: gm, line: gl, ok: null };
  }

  /* 유령 색을 정한다. ok 는 boolean 또는 'good'|'ok'|'bad' — 예전 호출(boolean)도 그대로 돈다.
     ★ preview.ok 는 **예전 뜻 그대로 "놓을 수 있나"** 다. 색(rank)과 갈라 둔다 —
       밖으로 나가는 값이라 뜻을 바꾸면 부르는 쪽이 조용히 틀린다.
       "빨간데 놓을 수는 있다"(빛이 안 맞는 자리)가 실제로 있는 조합이다. */
  function setGhostOk(ok, placeable) {
    const rank = normRank(ok) || (ok ? 'good' : 'bad');
    if (preview) preview.ok = (placeable == null) ? (rank !== 'bad') : !!placeable;
    if (!preview || rank === preview.rank) return;
    preview.rank = rank;
    const hex = RANK_HEX[rank];
    preview.mat.color.setHex(hex);
    preview.line.color.setHex(hex);
    preview.marker.material.color.setHex(hex);
  }

  /* rank(선택) — 'good'|'ok'|'bad'. 안 주면 예전 그대로 "들어가나"로만 칠한다.
     들어가지 않는 자리는 rank 가 뭐라 오든 빨강이다(못 놓는 게 먼저다). */
  function previewMove(fromId, toId, rank) {
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
    preview.marker.scale.setScalar(markerHalf(Number.isFinite(to.maxPotD) ? to.maxPotD : 0.22));
    preview.marker.position.set(to.x, to.y + 0.004, to.z);

    /* 못 들어가는 자리는 rank 가 뭐라 오든 빨강이다 — 못 놓는 게 먼저다 */
    const fits = fitsInSlot(preview.group, to);
    setGhostOk(fits ? (normRank(rank) || 'good') : 'bad', fits);
    needsRender = true;
    return { fromId, toId, ok: preview.ok, rank: preview.rank };
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
    preview.marker.scale.setScalar(markerHalf(potD));
    preview.marker.position.set(A.x, A.y + 0.004, A.z);
    /* opt.rank 가 있으면 세 색, 없으면 예전 두 색.
       놓을 수 없는 자리(valid:false)는 rank 와 무관하게 빨강이다. */
    setGhostOk(opt.valid === false ? 'bad' : (normRank(opt.rank) || 'good'), opt.valid !== false);
    needsRender = true;
    return { at: A, potD, ok: preview.ok, rank: preview.rank };
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

  /* ============================================================
     ★ 가구 밝히기 — highlightFurniture (2026-08-08)
     ------------------------------------------------------------
     박사님: "가구 클릭 시 … 가구가 **살짝 밝아지면서** 활성화된 것처럼 되면서
             그 옆으로 선택 가능 메뉴들이 뜨게."
     그래서 윤곽선이 아니라 **밝기**다. 재질을 복제해 emissive 를 얹는다.
       · 무늬(map)가 있으면 emissiveMap 에 그 무늬를 그대로 물려 준다 —
         흰 빛을 통으로 얹으면 나뭇결이 사라져 「밝아졌다」가 아니라 「하얘졌다」가 된다.
       · 무늬가 없으면 제 색을 emissive 로 쓴다. 색이 안 변하고 밝기만 오른다.
     ⚠ **원래 재질로 정확히 돌아와야 한다.** 그래서 갈아 끼운 것만 적어 뒀다가
       되돌리고 복제본을 버린다. 원본은 손대지 않는다(공유 재질이라 손대면 방 전체가 밝아진다).
     ⚠ 스스로 빛나는 부품(전구·갓)은 **건너뛴다.** 저 재질의 emissiveIntensity 는 등을
       켜고 끄는 코드가 따로 만진다(§등). 갈아 끼우면 그 조작이 복제본으로 가서
       되돌리는 순간 켜짐 상태가 옛날로 돌아간다.
     ⚠ 이건 **그림만**이다. 조도(DLI)·판정·좌표는 한 줄도 안 건드린다.
  ============================================================ */
  const FURN_HL_K = 0.16;      // 얹는 밝기. 0.16 은 "살짝"이다(1.0 이면 전구처럼 탄다)
  let furnHL = null;           // { uid, swaps:[{mesh, mat}], clones:Set }

  function clearFurnHighlight() {
    if (!furnHL) return;
    for (const s of furnHL.swaps) s.mesh.material = s.mat;
    for (const c of furnHL.clones) { try { c.dispose(); } catch (e) { /* 나머지는 계속 버린다 */ } }
    furnHL = null;
    needsRender = true;
  }

  /* 그 재질을 k 만큼 밝힌 **복제본**. 원본은 안 건드린다. */
  function brightenedMat(m, k) {
    const c = m.clone();
    if (c.emissive) {
      if (c.map) { c.emissiveMap = c.map; c.emissive = new THREE.Color(1, 1, 1); }
      else c.emissive = new THREE.Color().copy(c.color || new THREE.Color(1, 1, 1));
      c.emissiveIntensity = k;
    } else if (c.color) {
      /* MeshBasicMaterial 처럼 빛을 안 받는 재질 — 색을 그만큼 올린다 */
      c.color = new THREE.Color().copy(c.color).multiplyScalar(1 + k);
    }
    return c;
  }

  const glowing = m => !!(m && m.emissive && (m.emissive.r + m.emissive.g + m.emissive.b) > 0.001);

  /* 어느 가구든 uid 로 찾는다 — 옮길 수 있는 것(furnNodes)만이 아니다.
     붙박이·벽걸이도 「누른 것」이 될 수 있고, 밝히는 것은 옮기는 것과 다른 일이다. */
  function anyFurnNode(uid) {
    if (!built || !built.furniture || uid == null) return null;
    return built.furniture.children.find(g => g.userData && g.userData.uid === uid) || null;
  }

  /* uid 를 밝힌다. null 이면 끈다. 돌려주는 값에 **메뉴를 띄울 화면 좌표**가 들어 있다. */
  function highlightFurniture(uid, opt = {}) {
    clearFurnHighlight();
    if (uid == null) return null;
    const g = anyFurnNode(uid);
    if (!g) return null;
    const k = Number.isFinite(opt.strength) && opt.strength > 0 ? opt.strength : FURN_HL_K;
    const swaps = [], clones = new Set(), made = new Map();
    g.traverse(o => {
      if (!o.isMesh || !o.material || o.userData.isPreview) return;
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      if (ms.some(glowing)) return;                     // 스스로 빛나는 부품은 그대로 둔다
      const next = ms.map(m => {
        if (!made.has(m)) { const c = brightenedMat(m, k); made.set(m, c); clones.add(c); }
        return made.get(m);
      });
      swaps.push({ mesh: o, mat: o.material });
      o.material = Array.isArray(o.material) ? next : next[0];
    });
    furnHL = { uid, swaps, clones };
    needsRender = true;
    return { ...furnInfo(g), lit: swaps.length, screen: furnScreenPos(g, 0), top: furnScreenPos(g, 1) };
  }

  /* 그 가구가 화면 어디에 찍히나 — **캔버스 기준 CSS 픽셀**(screenPosOf 와 같은 규약).
     up=0 이면 **발밑**(바닥과 맞바꿀 수 있는 점 — 상대 끌기의 기준점),
     up=1 이면 **머리 위**(메뉴를 띄우기 좋은 점). 카메라 뒤면 null 이다. */
  function furnScreenPos(g, up) {
    if (!g) return null;
    const h = (g.userData.size && g.userData.size.h) || 0;
    tmp.set(g.position.x, g.position.y + h * (up || 0), g.position.z).project(ctx.cam);
    if (tmp.z > 1) return null;
    const r = canvas.getBoundingClientRect();
    return { x: +((tmp.x * 0.5 + 0.5) * r.width).toFixed(1),
             y: +((-tmp.y * 0.5 + 0.5) * r.height).toFixed(1) };
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
    /* ★ 겹침은 **칸 단위 정수 비교**다 (2026-08-03 격자 도입).
       판때기 발자국을 실수로 재던 때는 "0.01m 모자란다" 같은 값이 나왔고, 그걸 봐 주려고
       -0.01 같은 여유값을 달아야 했다. 칸으로 세면 그런 눈금이 아예 없다 — 겹치거나 안 겹치거나다. */
    const cur = { x: g.position.x, z: g.position.z, w: sz.w, d: sz.d, rot: g.rotation.y || 0 };
    const curCell = cellBox(cur), meCell = cellBox(me);
    const already = r2 => cellBoxOverlap(curCell, cellBox(r2));
    const hits = r2 => cellBoxOverlap(meCell, cellBox(r2));
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
      if (hits(r2))
        return { ok: false, reason: `${furnInfo(n).name} 와(과) 겹칩니다` };
    }
    /* 창턱·칸막이 같은 붙박이는 colliders 로 본다 — 그 그룹은 원점에 있고 상자만 옮겨져
       있어서 position 으로 재면 틀린다(house.js sill 조립 참고). */
    for (const c of (built.colliders || [])) {
      if (c.kind === 'furn') continue;                   // 움직이는 가구는 위에서 이미 봤다
      const r2 = { x: c.x, z: c.z, w: c.w, d: c.d, rot: c.rot || 0 };
      if (already(r2)) continue;
      if (hits(r2))
        return { ok: false, reason: c.kind === 'sill' ? '창턱과 겹칩니다' : '벽·칸막이와 겹칩니다' };
    }
    return { ok: true, reason: null };
  }

  /* 가구를 격자에 앉힌다. 회전은 90° 단위(place.snapAngleDeg 의 근거 참고).
     ★ furnitureFit 안에서는 안 한다 — 그러면 "지금 자리 그대로" 물었을 때도 좌표가 흔들려
       제자리 불변식을 스스로 깬다. 스냅은 **놓는 길**(미리보기·커밋)에서만 한다. */
  /* ★★ 방 안쪽 **턱** — 격자 끝에서 막는다 (2026-08-16 · B-2)
     ══════════════════════════════════════════════════════════════════
     박사님: *"방 가구이동 등 할때 **내부 그리드 끝에서 스냅, 턱 막히게** 옆방으로 안 가게"*

     ■ 무엇이 잘못돼 있었나 — 재서 확인했다
       `snapFurniture` 는 격자에만 앉히고 **방 경계를 한 번도 안 봤다.** 그래서
       손가락을 벽 너머로 끌면 광선이 이웃 방 바닥·바깥 지면을 맞고, 그 좌표가 그대로
       유령 자리가 됐다. 실측: 침대를 (−9, 0) 으로 끌면 **앉는 자리도 (−9, 0)** 이고
       판정만 "벽 밖으로 나갑니다"로 붉어졌다 — 물건이 옆방까지 따라간다.
     ⇒ 자리를 **안쪽 벽 면 안으로 물린다.** 그러면 벽에 닿는 순간 유령이 멈춘다(턱).
       판정(furnitureFit)은 한 줄도 안 바꾼다 — 여기서 막는 것은 **어디에 서느냐**뿐이다.

     ⚠ 격자에 앉힌 **뒤** 물린다. 물리고 나서 다시 앉히면 반 칸이 튄다.
       그래서 걸음 단위로만 안쪽으로 민다 — 밀고 나서도 격자 위다.
     ⚠ 물건이 그 축으로 방보다 크면 못 물린다. 그때는 **가운데**에 둔다(그리고 판정이 거절한다).
       억지로 물려서 「들어간다」고 말하지 않는다. */
  function clampAxis(v, half, lo, hi, step) {
    if (!(hi - lo > 1e-9)) return (lo + hi) / 2;              // 벽 사이가 물건보다 좁다
    const min = lo + half, max = hi - half;
    if (min > max) return (lo + hi) / 2;                      // 이 축으로 물건이 방보다 크다
    let out = v;
    if (out < min - 1e-9) out += Math.ceil((min - out) / step - 1e-9) * step;
    if (out > max + 1e-9) out -= Math.ceil((out - max) / step - 1e-9) * step;
    /* 걸음으로 밀다가 반대쪽으로 넘어갔다면 걸음보다 좁은 방이다 — 그때만 한가운데다 */
    if (out < min - 1e-9 || out > max + 1e-9) return (min + max) / 2;
    return out;
  }

  function snapFurniture(uid, pos) {
    const g = furnNode(uid);
    if (!g) throw new Error(`못 옮기는 가구입니다: ${uid}`);
    const sz = g.userData.size;
    const rot = snapAngleDeg(pos.rot == null ? (g.rotation.y || 0) * 180 / Math.PI : pos.rot);
    /* 90° 돌면 폭·깊이가 바뀐다 — 스냅도 돌아간 발자국으로 해야 칸에 맞는다 */
    const swap = Math.round(rot / 90) % 2 !== 0;
    const w = swap ? sz.d : sz.w, d = swap ? sz.w : sz.d;
    /* pos.step 은 **옮기는 길**만 준다(반 칸 0.125m). 안 주면 예전대로 0.05 다. */
    const step = stepOf(pos.step);
    let x = snapSpanStep(pos.x, w, step), z = snapSpanStep(pos.z, d, step);
    /* ★ 턱 — 안쪽 벽 면 안으로 물린다 (위 머리말). 방을 아직 못 지었으면 안 물린다. */
    if (built) {
      const inn = roomInner();
      x = clampAxis(x, w / 2, inn.x0, inn.x1, step);
      z = clampAxis(z, d / 2, inn.z0, inn.z1, step);
    }
    return { x: +x.toFixed(4), z: +z.toFixed(4), rot,
             cells: { i: unitsFor(w), j: unitsFor(d), unit: GRID_UNIT, step } };
  }

  /* ============================================================
     ⑧-c ★ 바닥 격자 보이기 — showGrid (2026-08-03)
     ------------------------------------------------------------
     ★ 배치·이동 중에만 켠다. 늘 켜 두면 방이 안 보인다 — 방을 보는 게 이 게임의 화면이다.
     그리는 것은 둘뿐이다(드로우콜 2개).
       ① 눈금선  0.25m(보이는 칸)마다. 한 줄짜리 LineSegments 하나
       ② 막힌 칸  그 화분·가구가 못 들어가는 칸을 붉게. 한 덩어리로 합친 기하 하나
     ⚠ 0.05(단위 칸)로 선을 그으면 5m 방에서 100줄이라 폰에서 잡음이다. 눈금은 0.25,
       크기·스냅은 0.05 — 둘을 가른 이유가 이것이다(place.js 머리말).
  ============================================================ */
  function clearGrid() {
    if (!gridGroup) return;
    houseGroup.remove(gridGroup);
    gridGroup.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
    gridGroup = null; gridKey = '';
    needsRender = true;
  }

  /* on=false 면 감춘다. opt.potD 면 그 지름 화분 기준으로 막힌 칸을 칠한다.
     opt.uid 면 그 가구 기준(발자국이 커서 막히는 칸이 훨씬 많다). */
  function showGrid(on, opt = {}) {
    if (!built) return 0;
    if (!on) { if (gridGroup) gridGroup.visible = false; needsRender = true; return 0; }
    const potD = Number.isFinite(opt.potD) ? opt.potD : MONSTERA_POT_D;
    const key = `${roomId}|${opt.uid || ''}|${potD}|${plants.size}`;
    if (gridGroup && gridKey === key) { gridGroup.visible = true; needsRender = true; return gridGroup.userData.free; }
    clearGrid();

    /* ★ 격자는 **벽 속 칸을 빼고** 깐다 (2026-08-08 — 벽을 따라 돌던 붉은 띠의 정체)
       예전에는 바깥 치수(반지하 5×4m) 위에 20×16칸을 통째로 깔았다. 벽이 그 선을 걸치고
       서 있어(house.js: at=±CW/2 에 두께 0.2) 제일 바깥 한 줄은 절반이 벽 속이고,
       화분 반지름을 얹으면 **언제나** 막힌다. 그래서 붉은 띠가 한 줄 돌았다 —
       그건 "여기 놓지 마세요"가 아니라 "여기는 벽입니다"였다. 뜻이 다른 것을 같은 색으로
       말하고 있었으므로, 그 칸은 **아예 안 그린다**(placegrid-to-plan §9 ㉯안).
       ⚠ 안 그리는 것과 못 놓는 것은 다르다 — 여기서 판정은 한 줄도 안 바뀐다.
         그래서 **문 자리는 남긴다.** 거기는 벽 조각이 없어 실제로 놓을 수 있는 바닥이다
         (재 봤다: 반지하 문 앞 칸 셋. 사각형으로 잘라내면 그 셋이 사라진다). */
    const sp = gridSpan();
    const g = new THREE.Group();
    const nx = sp.nx, nz = sp.nz, gx0 = sp.x0, gz0 = sp.z0;

    /* ★★ 격자 **바깥 테두리를 벽 안쪽 면에 붙인다** (2026-08-15 · 박사님:
       *"방 바닥 자체 그리드도 끝선에 맞춰서 해줘"*)
       ══════════════════════════════════════════════════════════════════
       재 보니 격자가 x ±2.25 · z −1.75~**+2.00** 에서 끝났다. 벽 안쪽 면은 ±2.30 / ±1.80 이다.
         · x 는 양쪽 다 **0.05 모자랐다** — 벽에 걸치는 칸을 통째로 버리기 때문이다(위 ★)
         · z 는 **한쪽만 0.20 넘쳤다** — 문 자리에는 벽 조각이 없어 그 칸이 살아남고,
           그 칸이 문지방 너머 z=2.00(방 **바깥** 면)까지 뻗는다. 그게 「z 가 비대칭」의 정체다.
           ⇒ **문 때문이 맞다.** 짐작이 아니라 벽 조각 목록으로 확인했다.

       ⚠ **칸을 더 만들어 채우지는 않는다.** 벽 안쪽 면까지 칸을 깔면 0.05 짜리 자투리 줄이
         생기고, 거기엔 아무것도 안 들어가므로 **전부 붉게** 칠해진다 —
         그게 바로 2026-08-08 에 없앤 「벽을 따라 도는 붉은 띠」다. 되돌리면 안 된다.
       ⇒ 그래서 이렇게 한다 — **칸은 한 개도 안 늘리고**:
         ㉮ 0.25 눈금은 **그대로 둔다**(놓는 자리와 같은 눈금이라 옮기면 표시가 거짓말이 된다)
         ㉯ 거기에 **벽 안쪽 면 네모를 한 겹 두른다** — 그것이 「끝선」이다
         ㉰ 눈금선·붉은 네모가 그 밖으로 나가면 잘라 낸다(문 자리 칸이 문지방을 넘었다)
       ⇒ 결과: 격자 테두리가 벽에 닿고, z 가 **좌우 대칭**(±1.90)이 되고,
         `gridSpan().cells` 도 막힌 칸 수도 놓는 자리도 **한 톨도 안 바뀐다.**
       ⚠ 테두리와 마지막 눈금선 사이가 0.15 짜리 자투리 띠로 남는다. 그건 **벽과 격자 사이의
         실제 빈틈**이다 — 0.25 눈금은 방 원점에 매여 있고 벽 안쪽 면(±2.40)은 0.25 배수가
         아니기 때문이다(±2.40 은 0.125 배수도 아니다). 없애려면 방 치수나 벽 두께를
         건드려야 하고 그건 조도가 흔들리는 일이다 — 보고서 §판단필요에 적었다. */
    const inner = sp.inner;
    const fitX = v => Math.min(Math.max(v, inner.x0), inner.x1);
    const fitZ = v => Math.min(Math.max(v, inner.z0), inner.z1);

    /* ① 눈금선 — 그리는 칸의 테두리만. 이어지는 선은 한 토막으로 합친다
       (칸마다 네 변을 따로 쏘면 큰 방에서 선 토막이 수천 개가 된다). */
    const pts = [];
    const line = (x1, z1, x2, z2) => pts.push(fitX(x1), 0, fitZ(z1), fitX(x2), 0, fitZ(z2));
    for (let i = 0; i <= nx; i++) {                    // 세로선: 좌우 두 칸 중 하나라도 그리면 긋는다
      let run = -1;
      for (let j = 0; j <= nz; j++) {
        const on = j < nz && (sp.at(i - 1, j) || sp.at(i, j));
        if (on && run < 0) run = j;
        if (!on && run >= 0) { line(gx0 + i * GRID_CELL, gz0 + run * GRID_CELL,
                                    gx0 + i * GRID_CELL, gz0 + j * GRID_CELL); run = -1; }
      }
    }
    for (let j = 0; j <= nz; j++) {                    // 가로선
      let run = -1;
      for (let i = 0; i <= nx; i++) {
        const on = i < nx && (sp.at(i, j - 1) || sp.at(i, j));
        if (on && run < 0) run = i;
        if (!on && run >= 0) { line(gx0 + run * GRID_CELL, gz0 + j * GRID_CELL,
                                    gx0 + i * GRID_CELL, gz0 + j * GRID_CELL); run = -1; }
      }
    }
    /* ㉯ 끝선 — 벽 안쪽 면에 두르는 네모 한 겹. 격자가 여기서 끝난다는 표시다 */
    line(inner.x0, inner.z0, inner.x1, inner.z0);
    line(inner.x0, inner.z1, inner.x1, inner.z1);
    line(inner.x0, inner.z0, inner.x0, inner.z1);
    line(inner.x1, inner.z0, inner.x1, inner.z1);

    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({
      color: 0x8fd0ff, transparent: true, opacity: 0.22, depthWrite: false, toneMapped: false }));
    lines.position.y = 0.004;
    lines.renderOrder = 3;
    g.add(lines);

    /* ② 막힌 칸 — 한 덩어리로 합쳐 그린다(칸마다 메시를 만들면 수천 개가 된다)

       ★★ 2026-08-16 — **가구를 옮길 때 붉은 칸의 뜻을 바꿨다** (B-3 · 박사님:
          *"가구이동시 나오는 그리드 빨간색 이상"*)
       ══════════════════════════════════════════════════════════════════
       ■ 무엇이 이상했나 — 재서 확인했다(tools/probe_place_b.mjs)
         예전에는 「그 칸 한가운데에 **가구 중심**을 두면 놓을 수 있나」로 칠했다.
         그러면 발자국이 큰 물건일수록 벽에서 반너비만큼이 통째로 붉어진다. 실측:
           침대 1×2   → 320칸 중 **243칸(76%)** 붉음
           책상 1.25×0.5 → 204칸 · 서랍장 → 197칸 · **의자 0.5×0.5 조차 173칸**
         화면은 「방바닥이 거의 다 막혔다」고 말하는데 실제로는 방이 텅 비어 있다.
         그건 2026-08-08 에 화분 격자에서 없앤 **「벽을 따라 도는 붉은 띠」와 같은 거짓말**이다
         (그때 결론: "여기 놓지 마세요"가 아니라 "여기는 벽입니다" — 뜻이 다르면 색이 다르다).
       ■ 그래서 뜻을 이렇게 세운다 — **붉은 칸 = 이미 무언가가 서 있는 칸**
         다른 가구의 발자국 · 창턱 같은 붙박이. 벽 속 칸은 애초에 안 그린다(위 ★).
       ★ 「여기 놓으면 되나 안 되나」는 **유령**이 이미 말한다(파랑/빨강 + `dropLabel`).
         그리고 2026-08-16 부터 벽 너머로는 아예 안 나간다(§턱 · snapFurniture).
         ⇒ 색이 두 가지 뜻을 겹쳐 말하지 않게 갈랐다. 판정(furnitureFit)은 한 줄도 안 바꿨다.
       ⚠ 화분 격자(opt.uid 없이 potD 로 부르는 길)는 **예전 그대로**다 — 거기는 발자국이
         작아 nav.blocked 가 곧 「그 자리에 못 선다」이고, 실제로 그렇게 읽힌다. */
    const r = opt.uid ? null : potD / 2;
    const gu = opt.uid ? furnNode(opt.uid) : null;
    /* 가구를 옮길 때 쓸 장애물 목록 — **자기 자신은 뺀다**(옮겨 갈 물건이다) */
    const obs = [];
    if (gu) {
      for (const n of furnNodes()) {
        if (n === gu) continue;
        const s2 = n.userData.size;
        if (!s2 || s2.h <= 0.05) continue;             // 러그처럼 납작한 것 위로는 지나간다
        obs.push({ x: n.position.x, z: n.position.z, w: s2.w, d: s2.d, rot: n.rotation.y || 0 });
      }
      /* 붙박이(창턱)·칸막이도 장애물이다. 바깥 벽은 같은 kind('wall')지만 **그리는 칸 밖**에
         있어 저절로 안 걸린다 — 격자를 안쪽 면에 깔기 때문이다(§gridSpan).
         그래서 kind 로 거르지 않는다. 거르면 칸막이가 있는 방에서 칸막이가 안 붉어진다. */
      for (const c of (built.colliders || [])) {
        if (c.kind === 'furn') continue;                 // 움직이는 가구는 위에서 이미 넣었다
        obs.push({ x: c.x, z: c.z, w: c.w, d: c.d, rot: c.rot || 0 });
      }
    }
    const half = GRID_CELL / 2 - 0.012;
    const pos = [], idx = [];
    let free = 0, blocked = 0;
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      if (!sp.at(i, j)) continue;                      // 벽 속 칸 — 방이 아니라서 안 센다
      const cx = gx0 + (i + 0.5) * GRID_CELL, cz = gz0 + (j + 0.5) * GRID_CELL;
      let bad;
      if (gu) {
        const cell = { x: cx, z: cz, w: GRID_CELL, d: GRID_CELL, rot: 0 };
        bad = obs.some(o => rectOverlap(cell, o, -0.02));   // 스치는 것은 봐 준다
      } else {
        bad = nav.blocked(cx, cz, r);
      }
      if (!bad) { free++; continue; }
      blocked++;
      const k = pos.length / 3;
      /* 붉은 네모도 테두리를 넘지 않게 자른다 — 문 자리 칸이 문지방 밖으로 삐져나온다 */
      const ax = fitX(cx - half), bx = fitX(cx + half);
      const az = fitZ(cz - half), bz = fitZ(cz + half);
      pos.push(ax, 0, az, bx, 0, az, bx, 0, bz, ax, 0, bz);
      idx.push(k, k + 2, k + 1, k, k + 3, k + 2);
    }
    if (pos.length) {
      const bg = new THREE.BufferGeometry();
      bg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      bg.setIndex(idx);
      const m = new THREE.Mesh(bg, new THREE.MeshBasicMaterial({
        color: GH_NG, transparent: true, opacity: 0.16, side: THREE.DoubleSide,
        depthWrite: false, toneMapped: false }));
      m.position.y = 0.003;
      m.renderOrder = 2;
      g.add(m);
    }
    g.userData = { free, blocked, cell: GRID_CELL, unit: GRID_UNIT, cells: sp.cells };
    gridGroup = g; gridKey = key;
    houseGroup.add(g);
    needsRender = true;
    return free;
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
    /* ★ 격자에 앉힌 뒤 판정한다 — 보이는 유령과 실제로 놓일 자리가 같아야 한다.
       opt.grid:false 로 끄면 예전처럼 연속 좌표다. */
    const sn = pos.grid === false ? { x: pos.x, z: pos.z,
                 rot: pos.rot == null ? (g.rotation.y || 0) * 180 / Math.PI : pos.rot, cells: null }
             : snapFurniture(uid, pos);
    const rot = sn.rot;
    const y = pos.y == null ? g.position.y : pos.y;
    furnGhost.group.position.set(sn.x, y, sn.z);
    furnGhost.group.rotation.y = rot * Math.PI / 180;
    const fit = furnitureFit(uid, { x: sn.x, z: sn.z, rot });
    if (fit.ok !== furnGhost.ok) {
      furnGhost.ok = fit.ok;
      const hex = fit.ok ? GH_OK : GH_NG;
      furnGhost.mat.color.setHex(hex);
      furnGhost.line.color.setHex(hex);
    }
    needsRender = true;
    return { uid, x: sn.x, z: sn.z, rot, y, cells: sn.cells, ok: fit.ok, reason: fit.reason };
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
    /* ★ 미리보기와 **같은 스냅**을 탄다. 여기서만 다르면 "파란 유령을 봤는데 딴 데 놓인다" 가 된다. */
    const sn = pos.grid === false ? { x: pos.x, z: pos.z,
                 rot: pos.rot == null ? (g.rotation.y || 0) * 180 / Math.PI : pos.rot }
             : snapFurniture(uid, pos);
    const rot = sn.rot;
    const fit = furnitureFit(uid, { x: sn.x, z: sn.z, rot });
    if (!fit.ok) throw new Error(`가구를 못 놓습니다 — ${fit.reason}`);
    const from = { x: g.position.x, z: g.position.z, y: g.position.y,
                   rot: +((g.rotation.y || 0) * 180 / Math.PI).toFixed(4) };
    const to = { x: sn.x, z: sn.z, rot, y: pos.y == null ? from.y : pos.y };
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
     ⑧-d ★ 등 옮기기 — 집게등·스탠드등 (2026-08-06)
     ------------------------------------------------------------
     ★ 왜 가구 옮기기로는 안 되나
       `furnNodes()` 는 **바닥에 서 있는 것**만 낸다. 집게등은 책상에 물려 있어
       `riderNode` 로 걸러진다 — 그 모형 자체는 맞다(책상을 옮기면 등도 따라간다).
       ⚠ 그런데 **따로 떼서 옮기는 길이 없었다.** 여기가 그 길이다.

     ★ 왜 옮혀야 하나 — 겨누는 것만으로는 창턱이 안 산다
       반사광 모형(직광의 18%) 뒤로 `banjiha-sill:0` 은 등 1개로 DLI 5.15 다(문턱 6.0).
       집게등은 제자리(1.35, 0.75, −1.5)에서 창턱(0, 1.585, −1.95)까지 **1.65m** 라
       역제곱이 1/30 을 먹는다. 게다가 창턱은 등보다 **위**라 tilt 상한 75° 로는 못 겨눈다.
       ⇒ **거리가 방향을 이긴다.** 옮길 수 있어야 창턱이 산다(잰 표는 tools/test_lampmove.mjs).

     ★★ 세 갈래로 갈린다 — 그 갈림은 **데이터가 이미 하고 있는 표시**를 읽은 것이다
       ① 바닥에 서는 등 (스탠드)  `y` 를 안 적어 바닥에 선다 → riderNode 가 아니다
          ⇒ **이미 `furniture()` 에 나오고 `commitFurnitureAt` 으로 옮겨진다.**
             새로 만들 것이 없다. 여기서는 아무것도 안 한다.
       ② 물려 있는 등 (집게등)    `y>0` 이라 rider 다 → 아래 `lamps()` 가 낸다
       ③ 붙박이 등 (바 등)        `mount:"under-shelf"` → **어느 목록에도 안 나오고,
                                   억지로 부르면 던진다.** 겨누기(setLampAim)와 같은 규약이다.

     ★ 공중에 안 뜬다 — **물릴 데(mount)가 있어야 놓인다**
       집게등은 무엇엔가 물리는 물건이다. 물릴 수 있는 자리는 새로 만들지 않는다 —
       **화분이 올라갈 수 있는 상판**이 곧 집게를 물릴 수 있는 상판이다. 그 목록은
       `built.plantSlots` 가 이미 갖고 있다(창턱·책상·서랍장·선반 단마다). 새 데이터를
       만들면 두 정본이 생기고, 가구를 옮길 때 한쪽만 따라간다.

     ★ 높이 — `adjustable_height` 를 살린다
       물릴 자리를 고르면 밑동 y 의 **바닥**(상판 높이)이 정해지고, 거기서 `lift` 만큼 든다.
       상한은 house.js 가 rig 에 실어 준 `liftRange`(= 그 등의 키). 잰 값으로 확인:
       창턱에 물린 집게등의 창턱 DLI 가 lift 0/0.05/0.10 에서 8.27/7.60/7.12 로 움직인다.

     ⚠ 자리를 저장하는 표는 **가구와 같은 표**다 — `S.home.furniture[uid] = {x,z,rot,y}`.
       등 전용 칸을 새로 만들지 않는다. 세이브 왕복이 저절로 따라온다.
  ============================================================ */
  const LAMP_FIXED_MOUNTS = new Set(['under-shelf', 'wall', 'window']);

  /* 방에 있는 조명 rig 를 uid 로. 붙박이까지 전부 본다(못 옮긴다고 말해 주려면 찾긴 해야 한다) */
  function lampRig(uid) {
    return ((built && built.lightRigs) || []).find(r => r.uid === uid) || null;
  }
  /* 그 rig 의 3D 그룹 */
  function lampNode(uid) {
    if (!built || !built.furniture) return null;
    return built.furniture.children.find(g => g.userData && g.userData.uid === uid) || null;
  }
  /* 밑동 y → 발광점 y. house.js 의 emitY 와 **같은 식**이어야 한다(둘이 갈리면
     화면의 등과 계산의 등이 다른 높이에 있게 된다). 매달린 것은 여기 안 온다. */
  function lampEmitOffset(g) {
    return ((g && g.userData.size && g.userData.size.h) || 0.4) * 0.92;
  }

  /* ============================================================
     ⑧-e ★ 등 스위치 — 손으로 켜고 끈다 · 켠 시간을 센다 (2026-08-08)
     ------------------------------------------------------------
     박사님: "등을 밤에만 자동으로 켜지는 게 아니라 **내가 등을 터치해서 켜고 끌 수 있게**
             해줘. **전기세를 등 켜 둔 시간으로 하루에 부과되게** 해줘."

     ★ 고치기 전에 무엇이 도는지 재서 알아낸 것 (tools/probe_lampswitch.mjs)
       ① **식물등은 켜고 끄는 손이 아예 없었다.** 화면의 세기는
          `r.schedule !== 'off'` 만 봤는데 그 값은 `data/house_rooms.json` 에 박힌
          `photo12`·`photo16` 이라 **언제나 참**이었다. 즉 식물등은 항상 켜져 있었다.
       ② `setGrowLights(n)` 은 **기구 메시만 숨긴다.** 광원 PointLight 는
          house.js 가 `furnGroup`(방 전체 가구 컨테이너)에 넣지 개별 가구 그룹에 안 넣는다
          (house.js §조명 기구 `furnGroup.add(L)`). 그래서 안 산 등도 계속 방을 밝히고 있었다.
       ③ 그 둘이 겹쳐서, 등 2개를 켜도 **화면 평균 밝기가 75.23 → 75.26(+0.0%)** 이었다.
          같은 조작으로 DLI 는 0.48 → 12.41 로 뛴다. 박사님이 "숫자만 바뀌고 눈에 안 든다"고
          하신 것이 정확히 이것이다.

     ★ 그래서 규칙을 하나로 모은다 — **`lampIsOn(uid)` 하나가 정본**이다.
         손으로 만진 등   `lampSw` 의 값 그대로 (켬/끔)
         안 만진 등       예전 자동 그대로 — 식물등은 schedule, 생활등은 밤에만
         숨은 등          **무조건 꺼짐.** 안 산 등(setGrowLights 밖)은 안 켜진다
       그리기도(applyDaylight) 시간 세기도 이 하나를 본다. 둘이 갈리면 "화면은 꺼졌는데
       요금은 나오는" 상태가 생기고, 그건 아무도 못 찾는 유형의 고장이다.

     ★ 상태를 어디에 두나 — **여기(방뷰)에 두고 표를 내준다.**
       근거: `S.lamps` 는 코어 것이고(`src/game/state.js`) 지금 계약은 「앞에서부터 n개」라
       **어느 등인지를 담을 칸이 없다**(light_adapter.rigsOn 이 `slice(0, count)` 다).
       등마다 켜고 끄려면 uid 별 표가 필요한데 그 칸을 여기서 새로 파면 코어 세이브와
       두 정본이 된다. 그래서 방뷰가 **들고만 있고 세이브는 호스트가 한다** —
       `lampSwitches()` 로 읽고 `setLampSwitches()` 로 되돌린다(등 겨누기와 같은 규약).
       ⇒ 코어가 할 일은 인계 문서에 적었다(`docs/handoff/lampswitch-to-plan.md`).

     ⚠ **조도(DLI)는 여기서 한 줄도 안 바뀐다.** 등을 껐다고 계약의 밝기가 안 준다 —
       그 값은 `S.lamps.count` 로 `light_adapter.rigsOn` 이 낸다. 그림과 계산은 다른 길이다
       (test_ground §I 와 같은 규약). 화면만 끄고 계산이 남는 어긋남을 없애는 것은
       코어가 `rigsOn` 을 uid 집합으로 받는 날이다.
  ============================================================ */

  /* 안 만진 등이 저 혼자 도는 규칙 — **예전 그대로**다. 여기서 바꾸면 회귀다. */
  function lampAutoOn(rig) {
    return rig.grow ? !!(rig.schedule && rig.schedule !== 'off')
                    : (daylightT < 0.30 || daylightT > 0.86);
  }

  /* 지금 켜져 있나. 모르는 uid 는 false 다(그리기 루프가 매 프레임 부른다 — 못 찾았다고
     던지면 방이 통째로 멈춘다. 던지는 것은 아래 setLampOn 쪽 일이다). */
  function lampIsOn(uid) {
    const rig = lampRig(uid);
    if (!rig) return false;
    const g = lampNode(uid);
    if (g && !g.visible) return false;          // 안 산 등·숨긴 등은 안 켜진다
    const sw = lampSw.get(uid);
    return sw == null ? lampAutoOn(rig) : !!sw;
  }

  /* 그 등 한 줄 — 화면·호스트가 읽는 모양 하나다 */
  function lampStateOf(rig) {
    const g = lampNode(rig.uid);
    const watts = (rig.fx && rig.fx.watts) || 0;
    const hours = +(lampClock.h.get(rig.uid) || 0).toFixed(3);
    return {
      uid: rig.uid, preset: rig.id, name: lampName(rig.uid), grow: !!rig.grow,
      watts, hours, wh: +(watts * hours).toFixed(3),
      on: lampIsOn(rig.uid),
      manual: lampSw.has(rig.uid),              // false = 아직 자동
      shown: !!(g && g.visible)                 // 산 등인가(setGrowLights)
    };
  }

  /* 켜고 끈다. on 이 null 이면 **자동으로 되돌린다.**
     ⚠ 모르는 등이면 던진다 — 조용히 무시하면 화면은 손잡이를 보여 주는데 아무 일도 안 난다
       (setLampAim 과 같은 규약). */
  function setLampOn(uid, on) {
    const rig = lampRig(uid);
    if (!rig) throw new Error(`[등] 모르는 등입니다: ${uid} (방 ${roomId}). ` +
      `켤 수 있는 등은 lampSwitches().lamps 에 있습니다.`);
    if (on == null) lampSw.delete(uid); else lampSw.set(uid, !!on);
    applyDaylight();                            // 손가락이 닿는 즉시 방이 밝아져야 한다
    return lampStateOf(rig);
  }

  function toggleLamp(uid) { return setLampOn(uid, !lampIsOn(uid)); }

  /* 세이브에서 읽은 표를 통째로 얹는다. **전부 검사한 뒤에 얹는다**(setLampAims 와 같은 규약) —
     한 칸이라도 모르는 등이면 아무것도 안 바뀐 채로 던진다. */
  function setLampSwitches(map) {
    const next = new Map();
    for (const [uid, v] of Object.entries(map || {})) {
      if (v == null) continue;                  // null = 자동. 표에 안 담는다
      if (!lampRig(uid)) throw new Error(`[등] 모르는 등입니다: ${uid} (방 ${roomId})`);
      next.set(uid, !!v);
    }
    lampSw = next;
    applyDaylight();
    return lampSwitches();
  }

  /* ---- 켠 시간 장부 ----
     ★ 세는 자는 **게임 시각(daylightT)** 이다. 실제 초가 아니다 —
       빨리감기(하루 1.6초)와 평소(하루 144초)가 요금이 달라지면 안 되기 때문이다.
       호스트가 setDaylight 를 부를 때마다 그 사이만큼 켜져 있던 등에 더한다.
     ⚠ **되감기·건너뛰기는 안 센다.** 한 번에 6시간 넘게 뛰면 그건 시계가 흐른 게 아니라
       누가 시각을 옮겨 놓은 것이다(검수 도구가 그렇게 한다). 세면 요금이 지어내진다. */
  const LAMP_TICK_MAX = 0.25;                   // 한 번에 인정하는 최대 = 6시간

  function tickLampClock(t01) {
    const prev = lampClock.t;
    lampClock.t = t01;
    if (prev == null) return;
    let d = t01 - prev;
    if (d < 0) d += 1;                          // 자정을 넘었다
    if (!(d > 0) || d > LAMP_TICK_MAX) return;
    const h = d * 24;
    for (const r of (built && built.lightRigs) || [])
      if (lampIsOn(r.uid)) lampClock.h.set(r.uid, (lampClock.h.get(r.uid) || 0) + h);
  }

  /* 지금 상태 + 켠 시간. **이것이 전기세의 재료다.**
       lamps      등마다 { uid, watts, hours, wh, on, manual, shown }
       wh         전부 합친 와트시. 요금 = wh ÷ 1000 × 단가(원/kWh)
       ⚠ **단가는 여기 없다.** 그 값은 `data/lighting_presets.json` 의 tariff 고
         밸런스는 plan 소유다 — 방뷰가 요금을 지어내면 정본이 둘이 된다.
       growLitHours  코어 계약(`S.lamps.litHours`)에 실을 한 값 —
         **켠 식물등들의 시간 평균**이다. 등마다 다르게 켰으면 그 차이는 이 한 칸에
         안 담긴다(계약이 스칼라라서다). 그것도 코어가 할 일로 인계에 적었다. */
  function lampSwitches() {
    const lamps = ((built && built.lightRigs) || []).map(lampStateOf);
    const wh = +lamps.reduce((a, c) => a + c.wh, 0).toFixed(3);
    const lit = lamps.filter(l => l.grow && l.hours > 0);
    return {
      room: roomId,
      lamps,
      switches: Object.fromEntries(lampSw),     // 세이브에 그대로 넣는 표
      wh, kwh: +(wh / 1000).toFixed(6),
      growWh: +lamps.filter(l => l.grow).reduce((a, c) => a + c.wh, 0).toFixed(3),
      growLitHours: lit.length ? +(lit.reduce((a, c) => a + c.hours, 0) / lit.length).toFixed(3) : 0,
      growOn: lamps.filter(l => l.grow && l.on).length
    };
  }

  /* 하루를 닫는다 — 마지막 장부를 돌려주고 0 으로 되돌린다.
     ★ 스위치는 **안 건드린다.** 켜 둔 등은 다음 날도 켜져 있는 게 맞다(그게 요금이 붙는 이유다). */
  function resetLampHours() {
    const closing = lampSwitches();
    lampClock.h = new Map();
    return closing;
  }

  /* 왜 못 옮기나 — 못 옮기면 **한국어 이유**, 옮길 수 있으면 null.
     ★ 조용히 무시하지 않는다. 화면은 `lamps()` 에 안 나오는 것으로 손잡이를 안 그리면 되고,
       던지기는 배선이 틀렸을 때의 안전망이다(setLampAim 과 같은 결). */
  function lampImmovableReason(uid) {
    const rig = lampRig(uid);
    if (!rig) return `모르는 등입니다: ${uid} (방 ${roomId})`;
    const g = lampNode(uid);
    const me = lampName(uid) + topicJosa(lampName(uid));
    const mount = (g && g.userData.mount) || rig.mount || null;
    if (mount && LAMP_FIXED_MOUNTS.has(mount))
      return `${me} 붙박이라 못 옮깁니다 (${mount}). ` +
             `선반 밑에 붙은 등은 자리를 등에 맞추는 물건입니다 — docs/growlight_aim.md §2`;
    if (g && g.userData.hangFromCeiling) return `${me} 천장에 달려 있어 못 옮깁니다`;
    if (!(g && g.userData.movable))
      return `${me} 옮길 수 있는 등이 아닙니다 ` +
             `(data/furniture_presets.json 의 ${rig.id} 에 movable 이 없습니다)`;
    return null;
  }
  /* 은/는 — 이름이 데이터에서 오니 받침을 보고 고른다("천장등 는" 이 되면 안 읽힌다) */
  function topicJosa(name) {
    const s = String(name || '');
    const c = s.charCodeAt(s.length - 1);
    const hangul = c >= 0xAC00 && c <= 0xD7A3;
    return (hangul && (c - 0xAC00) % 28 === 0) ? '는' : '은';
  }
  function lampName(uid) {
    const rig = lampRig(uid);
    const id = rig ? rig.id : null;
    return (id && (furnNames[id] || {}).name_ko) || id || uid;
  }

  /* ★ 물릴 수 있는 자리 — 화분 상판을 단(y)마다 하나로 묶는다.
     한 단에 화분 칸이 셋이어도 물릴 상판은 하나다(집게는 그 단 가장자리에 문다). */
  function lampMounts() {
    if (!built) return [];
    const byKey = new Map();
    for (const s of (built.plantSlots || [])) {
      const ownerUid = String(s.slotId).slice(0, String(s.slotId).lastIndexOf(':'));
      const g = lampNode(ownerUid);
      if (!g || !g.userData.size) continue;
      const key = `${ownerUid}@${s.y.toFixed(3)}`;
      if (!byKey.has(key)) {
        const sz = g.userData.size;
        byKey.set(key, {
          mountId: key, uid: ownerUid, name: furnLabel(g), y: s.y,
          x: +g.position.x.toFixed(4), z: +g.position.z.toFixed(4),
          w: sz.w, d: sz.d, rot: +((g.rotation.y || 0) * 180 / Math.PI).toFixed(2),
          slots: []
        });
      }
      byKey.get(key).slots.push(s.slotId);
    }
    return [...byKey.values()].sort((a, b) => a.y - b.y || a.mountId.localeCompare(b.mountId));
  }
  function furnLabel(g) {
    const uid = g.userData.uid;
    const f = roomDef && (roomDef.furniture || []).find(x => x.uid === uid);
    const pid = f ? f.preset : String(uid).split('#')[0];
    return (pid && (furnNames[pid] || {}).name_ko) || pid || uid;
  }

  /* 지금 이 등이 어느 상판에 물려 있나 — 밑동 y 가 그 상판 높이와 같고 발자국 안이면 그것이다.
     ⚠ 못 찾아도 던지지 않는다. 방 데이터의 기본 자리가 어느 상판과도 딱 안 맞을 수 있다
       (집게등 기본 y 0.75 vs 책상 상판 0.74 — 1cm 차이로 물려 있다). 그건 고장이 아니다. */
  function lampMountOf(uid, mounts) {
    const g = lampNode(uid);
    if (!g) return null;
    const list = mounts || lampMounts();
    let best = null;
    for (const m of list) {
      if (!pointInMountXZ(m, g.position.x, g.position.z, 0.25)) continue;
      const lift = g.position.y - m.y;
      if (lift < -0.02) continue;                       // 상판보다 아래면 그 단이 아니다
      if (!best || lift < best.lift) best = { mount: m, lift: +lift.toFixed(4) };
    }
    return best;
  }
  /* 그 상판 발자국 안인가. pad 는 가장자리 바깥으로 봐 주는 여유(집게는 **가장자리**에 문다) */
  function pointInMountXZ(m, x, z, pad = 0) {
    const r = (m.rot || 0) * Math.PI / 180;
    const c = Math.cos(r), s = Math.sin(r);
    const dx = x - m.x, dz = z - m.z;
    const u = dx * c - dz * s, v = dx * s + dz * c;
    return Math.abs(u) <= m.w / 2 + pad && Math.abs(v) <= m.d / 2 + pad;
  }

  /* 옮길 수 있는 등 목록.
     ⚠ **바닥에 선 등은 여기 없다** — 그건 `furniture()` 에 이미 나오고 가구와 같은 길로 옮긴다.
       여기 나오는 것은 "무엇엔가 물려 있어 가구 목록에서 빠지는 등"뿐이다.
     ⚠ **붙박이 등(바)도 여기 없다.** 그것이 이 설계의 답이다(위 ★★ ③). */
  function lampList() {
    if (!built) return [];
    const mounts = lampMounts();
    const out = [];
    for (const rig of (built.lightRigs || [])) {
      const g = lampNode(rig.uid);
      if (!g) continue;
      if (lampImmovableReason(rig.uid)) continue;       // 붙박이·천장·movable 없음
      if (!riderNode(g)) continue;                      // 바닥에 선 등 = 가구 목록 몫
      const cur = lampMountOf(rig.uid, mounts);
      out.push({
        uid: rig.uid, preset: rig.id, name: lampName(rig.uid), grow: !!rig.grow,
        x: +g.position.x.toFixed(4), y: +g.position.y.toFixed(4), z: +g.position.z.toFixed(4),
        rot: +((g.rotation.y || 0) * 180 / Math.PI).toFixed(2),
        emitY: +(g.position.y + lampEmitOffset(g)).toFixed(4),
        mountId: cur ? cur.mount.mountId : null,
        lift: cur ? cur.lift : null,
        liftRange: rig.liftRange ? { ...rig.liftRange } : null,
        aimable: !!rig.aimRange,
        moved: !!localFurn[rig.uid]
      });
    }
    return out;
  }

  /* 그 자리에 등을 물릴 수 있나. 못 물리면 **한국어 이유**를 준다.
       pos.mountId  물릴 상판을 이름으로 고른다(제일 확실한 길)
       pos.x/pos.z  좌표로 고른다 — 그 좌표를 품는 상판을 찾는다(가구 끌기와 같은 손짓)
       pos.lift     상판에서 얼마나 들까(m). 안 주면 0. `liftRange` 밖이면 막는다 */
  function lampFit(uid, pos = {}) {
    const why = lampImmovableReason(uid);
    if (why) return { ok: false, reason: why, mountId: null };
    const rig = lampRig(uid), g = lampNode(uid);
    const mounts = lampMounts();
    let m = null;
    if (pos.mountId != null) {
      m = mounts.find(k => k.mountId === pos.mountId) || null;
      if (!m) return { ok: false, reason: `모르는 물림 자리입니다: ${pos.mountId}`, mountId: null };
    } else {
      if (!Number.isFinite(pos.x) || !Number.isFinite(pos.z))
        return { ok: false, reason: `좌표가 유한한 숫자가 아닙니다: (${pos.x}, ${pos.z})`, mountId: null };
      /* 여러 단이 겹쳐 보이면(선반) **가장 가까운 높이**를 고른다. 안 주면 지금 높이 기준 */
      const wantY = Number.isFinite(pos.y) ? pos.y : g.position.y;
      const cands = mounts.filter(k => pointInMountXZ(k, pos.x, pos.z, 0.25));
      if (!cands.length)
        return { ok: false, reason:
          `여기엔 물릴 데가 없습니다 — ${lampName(uid)}${topicJosa(lampName(uid))} 상판에 무는 물건입니다 ` +
          `(창턱·책상·서랍장·선반 단). 공중에는 못 답니다.`, mountId: null };
      cands.sort((a, b) => Math.abs(a.y - wantY) - Math.abs(b.y - wantY));
      m = cands[0];
    }
    const lift = pos.lift == null ? 0 : Number(pos.lift);
    if (!Number.isFinite(lift))
      return { ok: false, reason: `높이가 유한한 숫자가 아닙니다: ${pos.lift}`, mountId: m.mountId };
    const lr = rig.liftRange;
    if (!lr && lift !== 0)
      return { ok: false, reason:
        `${lampName(uid)}${topicJosa(lampName(uid))} 높이를 못 바꿉니다 (lighting_presets.json 의 ${rig.id} 에 ` +
        `adjustable_height 가 없습니다)`, mountId: m.mountId };
    if (lr && (lift < lr.min || lift > lr.max))
      return { ok: false, reason: `높이 ${lift}m 는 범위 밖입니다 (${lr.min}~${lr.max}m)`,
               mountId: m.mountId };
    const x = Number.isFinite(pos.x) ? pos.x : m.x;
    const z = Number.isFinite(pos.z) ? pos.z : m.z;
    if (!pointInMountXZ(m, x, z, 0.25))
      return { ok: false, reason: `${m.name} 의 상판 밖입니다 — 거기엔 못 뭅니다`, mountId: m.mountId };
    const y = +(m.y + lift).toFixed(4);
    /* 천장을 뚫지 않는다 — 발광점이 천장 위로 가면 등이 벽 속에 박힌다 */
    const ceil = built && built.size ? built.size.h : Infinity;
    if (y + lampEmitOffset(g) > ceil)
      return { ok: false, reason: `천장에 닿습니다 (천장 ${ceil}m)`, mountId: m.mountId };
    return { ok: true, reason: null, mountId: m.mountId, mount: m,
             x: +x.toFixed(4), y, z: +z.toFixed(4), lift: +lift.toFixed(4),
             emitY: +(y + lampEmitOffset(g)).toFixed(4) };
  }

  /* 유령 — 가구와 **같은 것을 쓴다**(makeFurnGhost). 새로 배울 것을 만들지 않는다. */
  function previewLampAt(uid, pos) {
    if (uid == null || !pos) { disposeFurnGhost(); return null; }
    const why = lampImmovableReason(uid);
    if (why) throw new Error(why);
    const g = lampNode(uid);
    if (!furnGhost || furnGhost.uid !== uid) { disposeFurnGhost(); furnGhost = makeFurnGhost(g); }
    const fit = lampFit(uid, pos);
    const x = fit.ok ? fit.x : (Number.isFinite(pos.x) ? pos.x : g.position.x);
    const z = fit.ok ? fit.z : (Number.isFinite(pos.z) ? pos.z : g.position.z);
    const y = fit.ok ? fit.y : g.position.y;
    furnGhost.group.position.set(x, y, z);
    furnGhost.group.rotation.y = (pos.rot == null ? (g.rotation.y || 0) * 180 / Math.PI : pos.rot)
                                 * Math.PI / 180;
    if (fit.ok !== furnGhost.ok) {
      furnGhost.ok = fit.ok;
      const hex = fit.ok ? GH_OK : GH_NG;
      furnGhost.mat.color.setHex(hex);
      furnGhost.line.color.setHex(hex);
    }
    needsRender = true;
    return { uid, x, y, z, lift: fit.ok ? fit.lift : null,
             mountId: fit.mountId, ok: fit.ok, reason: fit.reason };
  }

  /* 실제로 옮긴다 — 가구와 **같은 통로**(조도 엔진의 덮어쓰기 표 → 재조립)를 탄다.
     그래서 옮긴 뒤 `lightRigs()` 도 `ppfdSum` 도 새 좌표를 본다. 둘이 갈릴 틈이 없다.
     ⚠ 등에는 화분이 안 얹힌다 — rider 를 데려가지 않는다(등에 물린 등은 없다). */
  async function commitLampAt(uid, pos = {}) {
    if (!built) throw new Error('방이 아직 없습니다');
    const why = lampImmovableReason(uid);
    if (why) throw new Error(`등을 못 옮깁니다 — ${why}`);
    const fit = lampFit(uid, pos);
    if (!fit.ok) throw new Error(`등을 못 놓습니다 — ${fit.reason}`);
    const g = lampNode(uid);
    const from = { x: +g.position.x.toFixed(4), y: +g.position.y.toFixed(4),
                   z: +g.position.z.toFixed(4),
                   rot: +((g.rotation.y || 0) * 180 / Math.PI).toFixed(4) };
    const rot = pos.rot == null ? from.rot : snapAngleDeg(pos.rot);
    const to = { x: fit.x, z: fit.z, y: fit.y, rot };
    disposeFurnGhost();

    const moves = { [uid]: { x: to.x, z: to.z, rot: to.rot, y: to.y } };
    let prebuilt = null;
    if (O.lightEngine && typeof O.lightEngine.setFurnitureOverrides === 'function'
        && typeof O.lightEngine.furnitureOverrides === 'function') {
      const merged = { ...O.lightEngine.furnitureOverrides(), ...moves };
      O.lightEngine.setFurnitureOverrides(merged);
      const r = O.lightEngine.room;
      if (r) prebuilt = { built: r.built, def: r.def, wins: r.wins };
    } else if (O.lightEngine && typeof O.lightEngine.moveFurniture === 'function') {
      const r = O.lightEngine.moveFurniture(uid, to);
      if (r && r.room) prebuilt = { built: r.room.built, def: r.room.def, wins: r.room.wins };
    } else {
      Object.assign(localFurn, moves);
    }
    await rebuildRoom({ prebuilt });
    return { uid, from, to, mountId: fit.mountId, lift: fit.lift };
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
  /* ★★ 자취생 변주를 `scratch` → **`heart`** 로 갈았다 (박사님 2026-08-07).
     ══════════════════════════════════════════════════════════════════
     박사님: "머리 쓰다듬을 때 그 모션 할 때 허리 고정하고 발이 공중에 뜨는 듯한 모션이야."

     ⚠ 2026-08-06 의 발바닥 보정으로는 **못 고치는 종류**다. 그 보정은 클립당 **상수 하나**라
       클립을 통째로 내려 붙일 수는 있어도, **클립 안에서** 무게중심을 옮기며 발을 드는 것은
       못 잡는다. ⇒ 상수를 더 만지지 말고 **클립을 바꾼다.**

     ★★ 왜 `scratch` 가 애초에 뽑혔었나 — **거르는 자에 발이 없었다.**
       `tools/char/check_idle_break.py` 는 ① 서 있나(Hips 절대높이) ② 시작=끝인가 둘만 본다.
       루트 이동(drift)은 "Hips XZ 를 고정하면 제자리가 된다"며 **탈락 사유에서 뺐다.**
       그런데 XZ 를 고정해도 **체중이 옮겨 가는 것 자체는 안 없어진다** — 한 발에 실리면
       반대 발이 뜬다. 3.5등신 치비에서 그게 「대롱대롱」으로 읽힌 것이다.
       ⇒ drift 를 **하체가 얼마나 움직이나의 대리 지표**로 다시 읽었다.

     잰 값 (check_idle_break.py · 2026-08-07 · 동작에 이미 쓰는 클립 제외):
       heart      6.2s  drift **15%**  Hips 98→105%   ← 골랐다. 제일 안 움직인다
       listen     9.4s  drift  26%     Hips 107→108%  (가장 캐릭터가 이미 쓴다)
       wave       5.4s  drift  34%     Hips 105→110%
       cheer      9.0s  drift  41%
       scratch   11.5s  drift **42%**  ← 쓰던 것. 통과한 10종 중 **제일 많이 움직였다**
       happyjump  9.9s  drift  55%     (표에 ✗ 발이 뜬다 로 이미 적혀 있다)
     ⚠ `nod` 는 drift 38% 이고 **13초라 도구가 이미 탈락**시켜 뒀다(변주는 짧아야 한다).
       처음에 그걸 고르려다 재 보고 물렀다.
     ★ 새 모션 생성 0건 · 크레딧 0 은 그대로다 — char_*_heart.glb 가 이미 있다. */
  /* ★★ 자취생 변주를 **껐다** (박사님 2026-08-07: "하트 모션인가는 삭제하자. 뒷머리가 귀신처럼 갈라져").
     ══════════════════════════════════════════════════════════════════
     이 자리에서 두 번 실패했다. 실패한 이유가 서로 다르고, 그게 이 결정의 근거다:
       · `scratch` (원래 것) — 체중을 옮기며 **발이 떴다**. drift 42% 로 통과한 10종 중 최다였다
       · `heart`  (2026-08-07 아침) — drift 15% 로 하체는 얌전했는데,
                  **팔이 머리 뒤로 올라가며 뒷머리 메시를 뚫었다.** 3.5등신 치비는 머리가 커서
                  팔을 올리는 동작이면 어떤 클립이든 이 위험이 있다.

     ⇒ **거르는 자에 없던 축이 두 개나 드러났다** — ① 발이 뜨나(체중 이동) ② 메시를 뚫나(머리).
       `check_idle_break.py` 는 「서 있나 / 시작=끝인가」만 본다. 남은 후보(wave·cheer)도
       **둘 다 팔을 머리 위로 올리는 동작**이라 ②에 그대로 걸린다.
       재 보지 않고 또 갈아 끼우면 세 번째로 같은 자리에서 실패한다.

     ⇒ 그래서 **변주를 비운다.** 자취생은 idle 만 돈다. 성격 표현을 잃지만,
       귀신처럼 갈라진 뒷머리보다는 얌전한 idle 이 낫다.
     ★ 표는 지운 게 아니라 **비워 뒀다.** 다른 캐릭터(가장·주부·연구원)는 그대로 돈다 —
       그쪽 클립(listen·pickup·harvest·opendoor)은 팔이 머리 위로 안 간다.
     ★ 다시 넣으려면 **머리 관통까지 재는 검사**가 먼저다: 클립을 8등분해 손·팔뼈와
       머리 메시의 거리를 재면 된다(발 높이를 skinLowestY 로 재는 것과 같은 방법). */
  const IDLE_BREAK = {
    namja_jachwi: [], jachwi_f: [],
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
    b.userData.isPickBox = true;       // 보이지 않는 상자다 — bb 를 잴 때 빼야 한다
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
    /* ★ 접지 그림자 — 발밑에 깔린다. root 의 자식이라 걸으면 저절로 따라간다.
       크기는 어깨 폭(0.62 픽 상자)보다 조금 넓게 둔다 — 딱 맞으면 오히려 떠 보인다. */
    /* 사람 몸통(픽 상자 0.62)보다 넓어야 발밑에 깔린 것으로 읽힌다 — 같거나 좁으면 몸에 가려 안 보인다 */
    const blob = makeBlobShadow(1.05, BLOB_A_CHAR);
    blob.visible = blobsOn;
    blob.position.y = 0.006;
    root.add(blob);
    root.userData.charKind = 'person';

    houseGroup.add(root);

    const mixer = new THREE.AnimationMixer(model);
    const idleClip = (g.animations || [])[0];
    if (!idleClip) throw new Error(`idle 클립이 없습니다: char_${id}_idle.glb`);
    idleClip.name = 'idle';
    const base = mixer.clipAction(idleClip);
    base.play();

    /* ★★★ 발바닥을 바닥에 붙인다 — **클립마다** 잰다 (2026-08-06)
       ══════════════════════════════════════════════════════════════
       박사님(폰 실기): "캐릭이 허리가 공중에 매달려서 대롱대롱해."

       ★ 무엇이 문제였나 — 재서 알았다(tools/test_ground.mjs · 스킨 정점을 실제로 푼 값).
         바인드 포즈는 발바닥이 정확히 y=0 이다. **클립이 그걸 통째로 들어 올린다.**

           캐릭터            바인드   idle 최저점   walking 최저점
           jachwi_f            0      **+0.0857**    −0.0276
           namja_jachwi        0      **+0.0823**    −0.0297
           yeoja_jubu          0      **+0.1006**    −0.0194

         즉 서 있을 때 **8~10cm 떠 있고**, 걸을 때는 2~3cm 파묻힌다.
         "허리가 공중에 매달려" 있다는 말이 정확히 이 8.6cm 다.

       ★ 그래서 한 숫자로 못 고친다. idle 값(−8.6cm)만 빼면 걸을 때 11cm 가 파묻힌다.
         **클립마다 재서 클립마다 다른 값**을 쓴다. 재는 값은 캐시한다(클립당 한 번).
       ★ 옮기는 것은 **model** 이다. root 는 자리(x,z)·걷기·픽 상자·링·접지 그림자가
         쓰는 좌표계라 그걸 움직이면 그 전부가 같이 어긋난다.
       ★ 크기는 한 톨도 안 건드린다 — y 평행이동뿐이다(GLB 의 1.40m 는 그대로).
       ⚠ 클립이 바뀔 때 8~11cm 를 한 프레임에 옮기면 사람이 툭 떨어진다.
         크로스페이드(0.22~0.24초)와 같은 속도로 따라가게 둔다(GROUND_EASE). */
    const GROUND_PHASES = 8;      // 클립을 몇 등분해 재나
    const GROUND_EASE = 9;        // 지수 감쇠 계수 — 1/9초쯤이면 크로스페이드와 비슷하다
    const groundOf = new Map();   // 클립 이름 → model.position.y 가 가야 할 값
    function measureGround(clip, name) {
      if (groundOf.has(name)) return groundOf.get(name);
      const y0 = model.position.y;
      let lo = Infinity;
      try {
        /* ★ 임시 믹서로 잰다. 진짜 믹서를 건드리면 지금 재생 중인 자세가 흐트러진다.
           같은 뼈에 쓰므로 다 재고 나서 진짜 믹서로 한 번 되돌린다(mixer.update). */
        const tm = new THREE.AnimationMixer(model);
        const a = tm.clipAction(clip); a.play();
        for (let i = 0; i < GROUND_PHASES; i++) {
          tm.setTime(clip.duration * i / GROUND_PHASES);
          const y = skinLowestY(root);
          if (y < lo) lo = y;
        }
        tm.stopAllAction();
        if (tm.uncacheRoot) tm.uncacheRoot(model);
      } catch (e) {
        console.warn('[방뷰] 발바닥 높이를 못 쟀습니다 — 보정 없이 갑니다:', e.message);
      }
      /* 못 쟀으면 예전 그대로(보정 0). 조용히 엉뚱한 값으로 내려 꽂지 않는다. */
      const want = isFinite(lo) ? +(y0 - (lo - root.position.y)).toFixed(4) : y0;
      groundOf.set(name, want);
      try { mixer.update(1e-4); } catch (e) { /* 자세 되돌리기 실패는 다음 프레임이 고친다 */ }
      return want;
    }
    let groundY = measureGround(idleClip, 'idle');
    model.position.y = groundY;   // 처음 한 장은 곧바로 붙인다(부드럽게 내려올 이유가 없다)

    /* ★ 루트 고정 — 변주 클립은 루트가 Hips 높이 대비 최대 42% 움직인다.
       걷기와 같이 Hips 의 XZ 를 매 프레임 되돌린다(char-to-house.md). */
    let hips = null;
    model.traverse(o => { if (!hips && /hips/i.test(o.name || '')) hips = o; });
    const hips0 = hips ? [hips.position.x, hips.position.z] : null;

    /* 오른손 뼈 — 물뿌리개를 들려 줄 자리다. 이름은 재서 확인했다(GLB 노드 26개 중
       'RightHand'). 못 찾으면 소품 없이 모션만 낸다. */
    let rHand = null;
    model.traverse(o => { if (!rHand && /^righthand$/i.test(o.name || '')) rHand = o; });

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

    /* ── actAt(가서·하고·끝난다)이 쓰는 약속 세 가지 ──
       ★★ 전부 **update(dt) 위에서** 푼다. setTimeout 을 하나도 안 쓴다.
         setPaused 로 rAF 를 끊으면 그리기도 캐릭터도 멈춘다 — 그때 타이머로 재고 있으면
         **멈춘 화면 뒤에서 물이 다 들어간다.** 연출이 멈추면 논리도 멈춰야 한다
         (박사님: "반쯤 준 물은 없다"). 그래서 시계를 update 의 dt 하나로 통일한다. */
    let walkWait = null;    // { resolve, onTick, total } — 도착하면 푼다
    let faceWait = null;    // { resolve } — 다 돌아서면 푼다
    let clipRun = null;     // { a, sec, t, onTick, resolve, y0 } — 모션 한 번

    function settleWalk(ok, reason) {
      if (!walkWait) return;
      const w = walkWait; walkWait = null;
      w.resolve({ ok: !!ok, x: root.position.x, z: root.position.z, reason: reason || null });
    }
    function settleFace() {
      if (!faceWait) return;
      const f = faceWait; faceWait = null; f.resolve();
    }

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
      /* ★ 다리가 도는 속도를 바닥이 흐르는 속도에 맞춘다 — 이 한 줄이 발 미끄러짐을 줄인다.
         근거와 숫자는 WALK_SPEED 주석에 다 적어 뒀다. 지금 값으로는 1.40 배다. */
      walkAct.timeScale = Math.max(0.6, (WALK_SPEED - WALK_SLIP_OK) / WALK_CLIP_MPS);
      return walkAct;
    }
    function playWalk() {
      if (!walkAct || walking) return;
      walking = true;
      walkAct.reset(); walkAct.enabled = true; walkAct.setEffectiveWeight(1);
      walkAct.crossFadeFrom(base, 0.22, false).play();
      /* ★ 걷기 클립은 idle 보다 11cm 아래에 선다 — 클립을 바꿀 때 접지 높이도 같이 바꾼다 */
      groundY = measureGround(walkAct.getClip(), 'walking');
    }
    function playIdle() {
      if (!walking) return;
      walking = false;
      base.reset().crossFadeFrom(walkAct, 0.24, false).play();
      groundY = measureGround(idleClip, 'idle');
    }

    /* 바닥 (x,z) 로 걸어간다. 갈 수 있는 데까지만 간다(막힌 주머니면 최대한 다가간다). */
    function goTo(x, z, opt2 = {}) {
      const p = nav.nearestFree(x, z);
      stats.navPaths++;
      /* 새 걸음이 시작되면 앞선 약속은 여기서 끝난다 — 안 풀면 actAt 이 영영 기다린다 */
      settleWalk(false, '다른 걸음에 밀렸습니다');
      settleFace();
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

    /* ── 바닥 (x,z) 까지 걸어간다. **도착하면 푸는 약속**을 돌려준다 ──
       돌려주는 값 { ok, x, z, reason }. ok:false 는 길이 없거나 도중에 밀린 것이다.
       ★ '도착했다'가 곧 '거기 섰다'는 아니다 — 구석에 끼면 최대한 다가간 자리에서
         멈춘다(goTo 의 stuck 규칙). 그래서 부르는 쪽이 **거리를 다시 재야** 한다. */
    function walkToXZ(x, z, onTick) {
      const r = goTo(x, z, { manual: true });
      if (!r.ok) return Promise.resolve(r);
      const total = Math.max(0.01, Math.hypot(r.x - root.position.x, r.z - root.position.z));
      return new Promise(resolve => { walkWait = { resolve, onTick: onTick || null, total, gx: r.x, gz: r.z }; });
    }

    /* 그 점을 **바라보고 선다**. 다 돌아서면 푼다. 이미 보고 있으면 그 자리에서 푼다. */
    function faceXZ(x, z) {
      const y = yawTo(x - root.position.x, z - root.position.z);
      let d = y - root.rotation.y;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      if (Math.abs(d) < 0.03) { root.rotation.y = y; needsRender = true; return Promise.resolve(); }
      settleFace();
      settleYaw = y;
      needsRender = true;
      return new Promise(resolve => { faceWait = { resolve }; });
    }

    /* ── 모션 한 번 ──
       clip 이 있으면 그것을 **sec 초에 맞춰** 한 번 돌린다(timeScale 로 맞춘다).
       clip 이 null 이면 **절차적으로** 굽힌다 — 클립이 없다고 아무 일도 안 일어나면
       "버튼이 안 먹었다"가 된다.
       ⚠ 절차적 몸짓은 뼈를 안 건드린다. 뼈를 굽혀 봐야 같은 프레임에 믹서가
         idle 로 되돌려 놓는다(믹서가 나중에 쓴다). 대신 래퍼(root·model)를 움직인다.
       onTick(0..1) 을 매 프레임 부른다. 다 돌면 true 로 푼다(중간에 끊기면 false). */
    function runClip(clip, sec, onTick) {
      if (clipRun) { const c = clipRun; clipRun = null; c.resolve(false); }
      const dur = Math.max(0.2, +sec || 1.6);
      let a = null;
      if (clip) {
        a = mixer.clipAction(clip);
        a.setLoop(THREE.LoopOnce, 1);
        a.clampWhenFinished = true;
        a.timeScale = clip.duration / dur;
        a.reset(); a.enabled = true; a.setEffectiveWeight(1);
        a.crossFadeFrom(base, Math.min(0.26, dur * 0.16), false).play();
        /* 모션 클립도 저마다 다른 높이에 선다 — 같은 규칙으로 잰다(§measureGround) */
        groundY = measureGround(clip, 'clip:' + (clip.name || 'act'));
      }
      needsRender = true;
      return new Promise(resolve => {
        clipRun = { a, sec: dur, t: 0, onTick: onTick || null, resolve, y0: root.position.y };
      });
    }

    /* 하던 것을 전부 끊는다 — 취소·치우기·방 다시 짓기. 약속은 **전부 푼다**(안 풀면 샌다). */
    function abortAct(reason) {
      if (clipRun) {
        const c = clipRun; clipRun = null;
        if (c.a) { c.a.stop(); base.reset().setEffectiveWeight(1).play();
                   groundY = measureGround(idleClip, 'idle'); }
        else { root.position.y = c.y0; model.rotation.x = 0; }
        c.resolve(false);
      }
      path = []; pathI = 0; playIdle();
      settleWalk(false, reason || '취소했습니다');
      settleFace();
      settleYaw = null;
      needsRender = true;
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
        /* ★ 무언가 하는 중에는 안 끼운다 — 물을 주다 머리를 긁으면 물뿌리개가 순간이동한다 */
        if (walking || clipRun) { schedule(); return; }
        const name = pool[(Math.random() * pool.length) | 0];
        try {
          if (!clips[name]) {
            const c = await charLoad(`${CHAR_ANIM}/char_${id}_${name}.glb`);
            const cl = (c.animations || [])[0];
            if (!cl) throw new Error('클립 없음');
            cl.name = name; clips[name] = cl;
          }
          if (!alive || walking || clipRun) { schedule(); return; }
          const a = mixer.clipAction(clips[name]);
          a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = false;
          a.reset().crossFadeFrom(base, 0.3, false).play();
          /* 변주 클립도 저마다 다른 높이에 선다 — 안 재면 머리를 긁는 동안 발이 뜬다 */
          groundY = measureGround(clips[name], 'clip:' + name);
          mixer.addEventListener('finished', function done(e) {
            if (e.action !== a) return;
            mixer.removeEventListener('finished', done);
            base.reset().crossFadeFrom(a, 0.3, false).play();
            groundY = measureGround(idleClip, 'idle');
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
      /* ★ 발바닥 보정을 밖에서 볼 수 있게 낸다 — 검사(tools/test_ground.mjs)가
         "클립마다 재서 주는가"를 숫자로 못 박는 유일한 길이다. */
      get ground() {
        return { y: +model.position.y.toFixed(4), target: +groundY.toFixed(4),
                 clips: Object.fromEntries(groundOf) };
      },
      get pickTarget() { return pick; },
      get selected() { return ring.visible; },
      setSelected(v) { ring.visible = !!v; needsRender = true; },
      get walking() { return path.length > 0; },
      get idleSince() { return path.length ? 0 : performance.now() - arriveAt; },
      get manualHold() { return performance.now() < manualUntil; },
      goTo,
      /* ── actAt 이 쓰는 창구 (위 「약속 세 가지」 참고) ── */
      walkToXZ, faceXZ, runClip, abortAct,
      get handBone() { return rHand; },
      get acting() { return !!clipRun; },
      /* 걷기 클립을 미리 실어 둔다. 고를 때 부른다 — 첫 걸음에서 GLB 를 받고 뼈에
         물리느라 한 번 걸리던 것을 없앤다(폰에서 눈에 띈다). */
      warmWalk() { return ensureWalkClip().catch(() => null); },
      stop() {
        path = []; pathI = 0; playIdle();
        settleWalk(false, '멈췄습니다');
        settleYaw = faceCameraYaw(root.position.x, root.position.z);
        needsRender = true;
      },
      update(dt) {
        mixer.update(dt);

        /* ── 모션 시계 ── ★ 여기 말고 다른 곳에서 재지 않는다(위 「약속 세 가지」) */
        if (clipRun) {
          clipRun.t += dt;
          const p01 = Math.min(1, clipRun.t / clipRun.sec);
          if (!clipRun.a) {
            /* 클립이 없을 때의 절차적 몸짓 — 무릎을 굽혔다 펴고 앞으로 숙인다.
               발이 조금 묻히는 것보다 아무 일도 안 일어나는 게 훨씬 나쁘다. */
            const s = Math.sin(Math.PI * p01);
            root.position.y = clipRun.y0 - 0.10 * s;
            model.rotation.x = 0.24 * s;
          }
          try { clipRun.onTick && clipRun.onTick(p01); } catch (e) { fail(e); }
          needsRender = true;
          if (p01 >= 1) {
            const c = clipRun; clipRun = null;
            if (c.a) { base.reset().crossFadeFrom(c.a, 0.28, false).play();
                       groundY = measureGround(idleClip, 'idle'); }   // 접지 높이도 idle 로
            else { root.position.y = c.y0; model.rotation.x = 0; }
            c.resolve(true);
          }
        }
        /* ★ 발바닥을 바닥에 붙여 둔다 — 클립이 바뀌면 목표가 바뀌고, 여기서 따라간다.
           한 프레임에 옮기면 8~11cm 를 툭 떨어뜨리므로 크로스페이드와 같은 속도로 간다. */
        if (Math.abs(model.position.y - groundY) > 1e-4) {
          model.position.y += (groundY - model.position.y) * (1 - Math.exp(-dt * GROUND_EASE));
          needsRender = true;
        }
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
            if (Math.abs(rest) < 0.01) { root.rotation.y = settleYaw; settleYaw = null; settleFace(); }
            needsRender = true;
          } else settleFace();
          return;
        }

        const dx = goal.x - root.position.x, dz = goal.z - root.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist < ARRIVE_EPS) {
          if (pathI < path.length - 1) { pathI++; goal.set(path[pathI].x, 0, path[pathI].z); return; }
          path = []; pathI = 0; arriveAt = performance.now();
          settleYaw = faceCameraYaw(root.position.x, root.position.z);   // 플레이어를 보고 선다
          playIdle();
          settleWalk(true);
          needsRender = true;
          return;
        }

        /* 걷는 진행률 — 남은 직선거리로 재는 **어림값**이다(경로는 꺾이므로 정확하지 않다).
           게이지의 본체는 모션 쪽이고, 이건 "가고 있다"를 보여주는 용도다. */
        if (walkWait && walkWait.onTick) {
          const left = Math.hypot(walkWait.gx - root.position.x, walkWait.gz - root.position.z);
          try { walkWait.onTick(clamp(1 - left / walkWait.total, 0, 1)); } catch (e) { fail(e); }
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
                /* ★ ok:true 로 푼다 — "갈 수 있는 데까지 갔다"는 뜻이다.
                   여기서 멈춘 게 목표 근처인지는 **부르는 쪽이 거리를 다시 재서** 판정한다. */
                settleWalk(true, '더 못 갑니다');
              }
            }
          } else stuck = 0;
        }
        needsRender = true;
      },
      dispose() {
        alive = false; clearTimeout(timer);
        /* ★ 치우기 전에 하던 약속을 푼다. 안 풀면 actAt 이 영영 기다리고,
           그 뒤에 붙은 논리(물주기·심기·수확)가 **영영 안 돈다**. */
        abortAct('캐릭터가 사라졌습니다');
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
    /* ★ 접지 그림자 — 몬이는 **일부러 뜬 것**이라 그림자가 오히려 필요하다.
       그림자가 없으면 "떠 있다"가 안 읽히고 그냥 어긋난 것으로 보인다.
       링과 같이 바닥까지 내리고, 흔들릴 때 update 가 다시 내린다. */
    const blob = makeBlobShadow(0.42, BLOB_A_MASCOT);
    blob.visible = blobsOn;
    blob.position.y = -MON.floatHeight + 0.006;
    root.add(blob);
    root.userData.charKind = 'mascot';
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

    /* ★★ 몬이가 **바라보면서** 따라온다 (2026-08-16)
       ══════════════════════════════════════════════════════════════════
       박사님: *"일전에는 몬이가 캐릭을 바라보면서 이동했는데 지금은 위치 고정인 거 같아."*

       ⚠ 「되살렸다」가 아니라 **새로 만들었다.** git 을 뒤져 보니 방 뷰의 몬이는
         처음 붙은 날(`2dde74d`)부터 줄곧 `rotation.y → π` 한 줄이었다 — 즉
         **게임 안에서 몬이가 무언가를 바라본 적은 한 번도 없다.**
         박사님이 보신 「바라보면서 이동」은 `assets/characters/mascot_follow_preview.html`
         (원안 미리보기)다. 거기서는 `monPivot.rotation.y = atan2(vel.x, vel.z)` 로
         **가는 쪽**을 봤다. 그 뜻을 방 뷰에 처음으로 옮긴 것이 이 코드다.

       ★ 앞이 어느 쪽인지는 **재서** 정했다 — 짐작하지 않았다.
         `tools/_moni_face.html` 로 몬이를 yaw 0·90·180·-90 로 나란히 세워 +Z 에서 찍었다
         (`docs/handoff/img/char/_moni_yaw_grid.png`). **yaw 0 에서 얼굴이 보인다** —
         즉 몬이의 앞도 사람과 똑같이 **+Z** 이고, `yawTo(dx,dz)` 를 그대로 쓰면 된다.
         ⇒ 그러니 예전의 π 는 **뒤통수를 보여 주던 값**이었다. 되돌리지 마라.

       무엇을 보나 — 사람이 있으면 **사람**, 없으면 **가는 쪽**, 둘 다 없으면 카메라.
       ⚠ 사람이 코앞이면(0.06m 안) 각이 홱홱 뒤집힌다 — 그때는 보던 쪽을 유지한다.
       ⚠ 홱 돌지 않는다. 사람의 TURN_RATE 9 보다 느린 6 이다 — 몬이는 둥둥 떠 있어서
         빠르게 돌면 튄다(사람은 발이 땅에 붙어 있어 9 가 자연스럽다). */
    const MONI_TURN_RATE = 6;
    const MONI_LOOK_MIN = 0.06;     // 이보다 가까우면 각을 새로 안 잡는다[m]
    const MONI_MOVE_EPS = 0.25;     // 「가는 쪽」으로 치는 속력[m/s]
    const TAU = Math.PI * 2;
    /* 처음부터 제자리를 본다 — 세우자마자 한 바퀴 도는 것이 제일 어색하다 */
    const firstLook = (() => {
      const person = chars.get('jachwi');
      if (person) {
        const dx = person.root.position.x - h.x, dz = person.root.position.z - h.z;
        if (Math.hypot(dx, dz) > MONI_LOOK_MIN) return yawTo(dx, dz);
      }
      return faceCameraYaw(h.x, h.z);
    })();
    let mYaw = firstLook;
    root.rotation.y = mYaw;
    let prevX = h.x, prevZ = h.z;

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
        /* ── 어디를 보나 (위 ★★ 몬이가 바라보면서 따라온다) ── */
        const vx = pos.x - prevX, vz = pos.z - prevZ;
        const speed = Math.hypot(vx, vz) / Math.max(dt, 1e-4);
        prevX = pos.x; prevZ = pos.z;
        let want = null;
        const person = chars.get('jachwi');
        if (person) {
          const dx = person.root.position.x - pos.x, dz = person.root.position.z - pos.z;
          if (Math.hypot(dx, dz) > MONI_LOOK_MIN) want = yawTo(dx, dz);
        } else if (speed > MONI_MOVE_EPS) {
          want = yawTo(vx, vz);
        } else if (!plants.size) {
          want = faceCameraYaw(pos.x, pos.z);          // 혼자 남았고 갈 데도 없으면 플레이어를 본다
        }
        if (want != null) {
          /* 최단각으로 돈다 — 안 그러면 359° 를 도느라 한 바퀴 빙 돈다 */
          const d = ((want - mYaw + Math.PI) % TAU + TAU) % TAU - Math.PI;
          mYaw += d * Math.min(1, dt * MONI_TURN_RATE);
          root.rotation.y = mYaw;
        }
        /* 링은 바닥에 있어야 한다 — root 가 위아래로 흔들리므로 그만큼 되돌린다.
           (안 하면 링이 몬이를 따라 공중에서 같이 출렁인다) */
        ring.position.y = -root.position.y + 0.02;
        /* ★ 접지 그림자도 바닥에 남는다. 높이 뜰수록 조금 넓고 옅어진다 —
           그 변화가 곧 "떠 있다"를 읽게 하는 신호다(값은 크기 6%·진하기 18%). */
        blob.position.y = -root.position.y + 0.006;
        const k = root.position.y / Math.max(0.001, MON.floatHeight);
        blob.scale.set(0.42 * (0.97 + 0.06 * k), 0.42 * (0.97 + 0.06 * k), 1);
        blob.material.opacity = BLOB_A_MASCOT * (1.09 - 0.18 * k);
      },
      dispose() { houseGroup.remove(root); disposeObject(root); }
    };
  }

  /* ============================================================
     ⑨-c 가서 · 하고 · 끝난다 — actAt (2026-08-04)
     ------------------------------------------------------------
     박사님: "씨앗심기 / 물주기 / 수확하기는 캐릭이 그 위치로 가서 뭔가 모션하면서
              게이지 차면서 완료되게 해줘."

     ★★ 순서를 정한다 — 연출이 먼저, 논리가 나중이다.
       걸어간다 → 선다(대상을 본다) → 모션(게이지 0→1) → **그제야** onDone().
       중간에 취소되거나 캐릭터가 사라지거나 방이 다시 지어지면 onDone 은 **안 부른다.**
       그래야 "반쯤 준 물"이 안 생긴다. 이 파일은 물을 주지 않는다 — 물 줄 때를 알릴 뿐이다.

     ★★ 시계는 update(dt) 하나뿐이다. setTimeout 을 안 쓴다.
       setPaused(확대 화면)로 rAF 가 끊기면 연출이 멈춘다. 그때 타이머로 재고 있으면
       멈춘 화면 뒤에서 논리가 끝나 버린다. 멈추면 같이 멈춰야 한다.

     ★★ 16종을 **전부** 풀어서 재고 골랐다 (2026-08-04 재조사)
       assets/characters/3d/anim/ 에 캐릭터마다 클립 16종이 있다. 이름만 보고 고르면 틀린다.
       tools/char/probe_anim_hands.py 로 골격을 순운동학으로 풀어 **손이 어디에 있나**를
       프레임마다 쟀다(Hips 높이 · 손이 몸보다 앞에 나간 거리 · 손 높이 · 팔 폄 정도).
       8캐릭터 모두 클립 이름·길이가 같다(sit 만 Chair_Sit_Idle_F/M 로 갈린다).

         파일            클립 이름                              길이   무슨 동작   물주기
         ────────────────────────────────────────────────────────────────────────────
         opendoor        open_door                              4.77  서서 앞으로 손을 뻗는다  ★쓴다
         inspect         Female_Bend_Over_Pick_Up_Inspect       3.87  숙여 집어 들고 살핀다    ✗
         pickup          Male_Bend_Over_Pick_Up                 7.23  숙여서 바닥 것을 집는다  ✗
         repot           Female_Crouch_Pick_Up_Place_Side       9.60  쭈그려 집어 옆에 놓는다  ✗(심기에 쓴다)
         harvest         Female_Stand_Pick_Fruit_Basket         6.23  서서 위쪽 열매를 딴다    ✗(수확에 쓴다)
         harvest_crouch  Female_Crouch_Pick_Fruit_Basket_Stand  7.13  쭈그려 따고 일어선다     ✗(바닥 수확)
         nod             Agree_Gesture                         13.03  끄덕이며 손짓한다        ✗ 손이 가슴 위
         listen          Listening_Gesture                      9.37  듣는 손짓                ✗ 뻗음 0.30m 뿐
         cheer           Motivational_Cheer                     9.03  팔을 들어 응원한다       ✗ 손이 머리 위
         happyjump       Happy_jump_f                           9.87  뛰며 좋아한다            ✗ 발이 뜬다
         heart           Big_Heart_Gesture                      6.20  손하트                   ✗ 손이 가슴에 붙는다
         wave            Big_Wave_Hello                         5.37  크게 손을 흔든다         ✗ 뻗음 0.19m 뿐
         scratch         Confused_Scratch                      11.53  머리를 긁는다            ✗
         sit             Chair_Sit_Idle_F/M                    11.37  앉아 있다                ✗ 앉은 자세
         doze            Sit_and_Doze_Off                      17.33  앉아 존다                ✗ 앉은 자세
         sleep           Sleep_Normally                         1.77  누워 잔다                ✗ 누운 자세

     ★ 물주기를 inspect → **opendoor** 로 갈았다. 근거는 셋 다 잰 값이다.
       ① 물주기는 **서서** 한다. opendoor 는 Hips 낙차 0.1%(사실상 고정), inspect 는 22% 다.
       ② 물뿌리개는 **오른손**(handBone=rHand)에 쥔다. inspect 는 오른손이 되레 **뒤로**
          간다(0.68~1.9s 구간 -0.10~-0.20m). 물건을 다루는 것은 왼손이다 —
          물뿌리개가 몸 뒤로 돌아가고 물줄기가 등 뒤에서 나온다. 앞 작업자가
          "완전히 자연스럽지는 않다"고 적은 것의 정체가 이것이다.
          opendoor 는 오른손이 0.5s 부터 앞으로 나가 1.6s 에 **+0.345m·높이 0.92m** 에
          닿고 2.0s 까지 그대로 멎어 있다 — 물뿌리개를 내밀고 붓는 그 자세다.
       ③ 발이 안 끌린다. check_anim.py 의 루트이동이 opendoor 3.4 로 16종 중 제일 작다
          (inspect 25.3 · harvest_crouch 26.5). 척추·목 비틀림도 1.0/0.7 로 제일 깨끗하다 —
          사람 모캡을 3.5등신 치비에 얹은 것치고 가장 덜 망가진 클립이다.
       ⚠ 문 여는 클립이라 2.2s 부터는 팔을 당겨 문을 젖힌다. **그 앞만** 쓴다(아래 win).

     ★ 씨앗심기·수확은 **안 바꿨다** — 16종을 다 재 봤지만 더 나은 것이 없다.
       심기(repot=쭈그려 집어 옆에 놓는다): 오른손이 0.4s 부터 앞아래로 내려가 2.0~2.6s 에
         높이 0.13m 에 멎었다가 다시 올라온다. '흙에 손을 대고 다독인다'의 모양 그대로다.
         손이 낮게 가는 클립은 이것 말고 inspect·pickup 뿐인데 둘 다 '집어 든다'라 더 멀다.
         ⚠ 남는 흠 하나 — 손이 0.13m 까지 내려가므로 **상판 화분(0.75m)** 에 심을 때는
           발치를 짚는 꼴이 된다. 고치려면 수확처럼 high/low 를 갈라야 하는데, 서서 하는
           '심기' 클립이 opendoor 밖에 없고 그건 지금 물주기가 쓴다 — 같이 쓰면 물주기와
           심기가 **똑같이** 보인다. 새 클립이 오기 전에는 지금이 최선이다.
       수확(harvest=서서 위쪽 열매를 딴다 / harvest_crouch=쭈그려 딴다): 이름 그대로다.
         오른손이 0.9~1.3s 에 앞 0.57m·높이 1.16m 로 올라간다 — 딴다는 동작 그 자체라
         바꿀 후보가 없다.

     ★★ 한 마디만 잘라 쓴다(subclip) — 앞도 뒤도 버린다
       클립이 3.9~9.6초다. 통째로 틀면 물 한 번 주는 데 6초를 기다린다. 그렇다고 6배로
       빨리 돌리면 인형이 경련한다. 그래서 **필요한 마디만** 잘라 쓴다(from~from+win).
       어디서 끊나는 두 가지를 재서 골랐다 — probe_anim_hands.py --cuts (jachwi_f 기준).
         **시작** 은 idle 에서 넘어오는 지점이다. 첫 자세와 멀면 crossfade 가 팔을 낚아챈다.
           네 클립 모두 앞 0.3초는 **가만히 있는 구간**이다(손 위치 차 0.02m 이하 —
           opendoor 는 0.005m 다). 그래서 넷 다 **0.30s 부터** 쓴다. 쉬는 0.3초를 버리는 셈이다.
         **끝** 은 그 순간 **몸이 멎어 있는 지점**이라야 한다(move[m/s] 가 작은 곳).
           움직이는 중에 끊으면 idle 로 되돌아가는 0.28s crossfade 가 홱 낚아챈다.
             opendoor       1.80s  move 0.092  ← 1.2~3.8s 통틀어 제일 조용하다
             repot          2.40s  move 0.225  ← 손이 흙에 닿아 멎는 그 순간이다
             harvest        2.10s  move 0.347
             harvest_crouch 2.40s  move 0.609  ← 이 클립에서 가장 조용한 지점
  ============================================================ */

  /* 동작 시간 — 왜 이 숫자인가 (박사님: "정하고 근거를 대라")
     ① 1.2초 아래면 게이지가 '깜빡'으로 보인다. 차는 게 보여야 게이지다.
     ② 2.5초 위면 기다림이 된다. 물주기는 **매일** 누른다 — 하루 한 번짜리 연출의 상한이다.
     ③ 걷는 시간이 앞에 붙는다. 반지하에서 한두 걸음이 1~3초라 체감은 이미 3~5초다.
     ④ 배속(win/sec)이 2.5 를 넘기면 눈에 '빨리 감았다'로 보인다 — 그 선 안에 넣는다.
     ★★ 셋 다 **1.5초**로 맞췄다 (박사님 "모션은 1.5초로?", 2026-08-04).
       ⚠ 여기서 함정 하나 — **sec 만 줄이면 배속이 튄다.** 옛 값 그대로 sec 만 1.5 로
         내리면 심기가 4.8/1.5 = 3.2배가 되어 위 ④ 선을 넘는다. 그래서 sec 를 줄인 만큼
         **win 도 다시 골랐다.** 통째로 빨리 감는 것과 짧은 마디를 고르는 것은 다른 일이다.
       그 결과 넷 다 배속이 **1.0~1.4** 로, 오히려 옛 값(1.8~2.2배)보다 느긋해졌다.
         물주기 1.50/1.5 = 1.00배   심기 2.10/1.5 = 1.40배
         수확  1.80/1.5 = 1.20배   바닥수확 2.10/1.5 = 1.40배
       ★ 물주기는 배속이 **정확히 1.0** 이다 — 손도 발도 원래 속도 그대로 돈다. */
  const ACT_SPEC = {
    /* from=클립의 몇 초부터 · win=몇 초어치 · sec=화면에서 몇 초에 걸쳐 (배속 = win/sec) */
    water:   { clip: 'opendoor', from: 0.30, win: 1.50, sec: 1.5,
               prop: 'can', fx: 'water', ko: '물 주는 중' },
    sow:     { clip: 'repot',    from: 0.30, win: 2.10, sec: 1.5,
               prop: null,  fx: null,    ko: '씨앗 심는 중' },
    harvest: { clip: 'harvest',  from: 0.30, win: 1.80, sec: 1.5,
               prop: null,  fx: null,    ko: '거두는 중',
               /* 시루가 바닥에 있으면 선 채로 딸 수 없다 — 쭈그리는 클립으로 갈아탄다.
                  기준 0.45m 는 '무릎 높이' 어림이다(방의 서랍장 상판이 0.75m 안팎).
                  ⚠ 이것만 쭈그린 채로 끝난다(끝 자세가 첫 자세에서 제일 멀다). 그래도
                    옛 값(5.2s 에서 끊기)보다 **양쪽 다 낫다** — 끝 자세 거리 1.22 vs 1.47,
                    끊는 순간 속도 0.61 vs 0.86. 일어서는 데까지 담으려면 6.6초가 필요해
                    배속 4.4배가 된다. 못 담는다. */
               low: { clip: 'harvest_crouch', from: 0.30, win: 2.10, sec: 1.5, atY: 0.45 } }
  };
  /* 대상 둘레 어디쯤에 서나. 화분에 손이 닿는 거리부터 훑는다.
     ★ 0.70 부터 시작하는 이유 — 몸 반지름이 0.38 이고 서랍장 깊이가 0.45 안팎이라
       0.62 로 잡으면 상판 화분 앞자리가 **가구 안**으로 판정된다(재서 확인했다). */
  const ACT_STAND_R = [0.70, 0.90, 1.10, 1.35];
  /* ★ '못 갔다'는 **노린 자리**가 아니라 **대상까지의 거리**로 판정한다.
     ------------------------------------------------------------
     floor_nav 의 path 는 못 가는 곳이라도 최대한 다가간 경로를 돌려준다(빈 배열이
     아니다). 그래서 "길이 없다"를 goTo 의 실패로는 못 잡는다 — 잡을 수 있는 자리는
     **다 걷고 난 뒤 어디에 서 있나** 하나뿐이다. 벽 하나를 사이에 두면 여기서 걸린다.
     1.45m 는 ACT_STAND_R 의 끝(1.35)에 격자 한 칸 남짓을 더한 값이다. */
  const ACT_REACH = 1.45;
  /* 이미 이만큼 가까이 서 있으면 걷지 않는다. 한 뼘 옮기자고 걷는 시늉을 하면 우습다. */
  const ACT_NEAR_ENOUGH = 0.28;

  /* 동작 클립 — from 초부터 win 초어치만 잘라 캐시한다. 캐릭터·동작·마디별로 한 번만 받는다.
     ★ subclip 은 잘라낸 마디를 **0초로 당겨 준다**(three 가 알아서 shift 한다).
       그래서 from 이 얼마든 runClip 은 그냥 0부터 sec 초에 걸쳐 틀면 된다. */
  const _actClip = new Map();
  function actClipOf(id, name, from, win) {
    const a = Math.max(0, +from || 0);
    const k = `${id}/${name}/${a}/${win}`;
    if (_actClip.has(k)) return _actClip.get(k);
    const p = (async () => {
      const g = await charLoad(`${CHAR_ANIM}/char_${id}_${name}.glb`);
      let cl = (g.animations || [])[0];
      if (!cl) throw new Error(`클립이 비었습니다: ${name}`);
      const U = THREE.AnimationUtils;
      /* 통째로 쓰라는 뜻(win<=0)이거나 클립이 마디보다 짧으면 자르지 않는다 */
      if (win > 0 && cl.duration > a + win + 0.05 && U && U.subclip)
        cl = U.subclip(cl, `${name}:act`, Math.round(a * 30), Math.round((a + win) * 30), 30);
      cl.name = `${name}:act`;
      return cl;
    })();
    _actClip.set(k, p);
    return p;
  }

  /* ── 어디에 서서 하나 ──
     ★ 대상 **뒤**에 서면 화분이 사람을 가리고, 대상 **바로 앞**(카메라와 화분 사이)에
       서면 사람이 화분을 가린다. 둘 다 볼 게 안 보인다. 그래서 '살짝 앞의 옆'을 노린다
       (카메라 방향과 이루는 각의 cos 가 0.15 쯤인 자리). nudgeIfOccluding 이 재는
       가림과 같은 이야기를, 여기서는 **미리** 피하는 것이다. */
  /* ★★★ **닿을 수 있나** — 놓기 전에 묻는 창구 (2026-08-09).
     ------------------------------------------------------------
     박사님: *"막는거 경고는 해주되, 막히면 뭐 재배치하면 되지 그 식물을."*
     ★ 이 함수는 **판정만 한다. 막지 않는다.** 무엇을 막을지는 화면이 정한다.
     ★ 재는 법은 `runAct` 가 실제로 걷는 방식 그대로다:
       ① 그 그루 곁에 **설 자리**(`standNear`)가 있나
       ② 지금 서 있는 데서 그 자리까지 **길이 잡히나**(`nav.path`)
     ⚠ 이미 그 곁에 서 있으면 `nav.path` 가 빈 배열을 낸다 — 그건 「못 간다」가
       아니라 「이미 와 있다」다(standNear 의 ⚠ 와 같은 함정). 거리로 먼저 가른다. */
  function reachOf(key) {
    const t = resolveKey(key);
    if (!t) return { ok: false, reason: '모르는 자리입니다' };
    const person = (() => {
      const id = (selChar && chars.get(selChar) && chars.get(selChar).walkable ? selChar : null)
                 || (chars.has('jachwi') ? 'jachwi' : null);
      const c = id && chars.get(id);
      return c && c.walkable ? c : null;
    })();
    /* 사람이 없으면 못 간다고 말할 근거가 없다 — 지어내지 않는다 */
    if (!person || !person.root) return { ok: true, reason: null, unknown: true };
    const here = { x: person.root.position.x, z: person.root.position.z };
    const cands = standNear({ x: t.pos.x, z: t.pos.z }, here);
    if (!cands.length) return { ok: false, reason: '곁에 설 자리가 없습니다' };
    for (const c of cands.slice(0, 8)) {
      if (Math.hypot(here.x - c.x, here.z - c.z) <= ACT_NEAR_ENOUGH) return { ok: true, reason: null };
      if (nav.path(here.x, here.z, c.x, c.z).length) return { ok: true, reason: null };
    }
    return { ok: false, reason: '가는 길이 막혔습니다' };
  }
  /* 지금 **닿을 수 없는** 그루들. 화면이 「여기 놓으면 저 시루에 못 갑니다」를
     말할 유일한 근거다. 비어 있으면 다 닿는다. */
  function unreachablePlants() {
    const out = [];
    for (const [key, p] of plants) {
      const r = reachOf(key);
      if (!r.ok) out.push({ key, potId: (p && p.potId) || null, reason: r.reason });
    }
    return out;
  }

  function standNear(t, from) {
    const camA = Math.atan2(ctx.cam.position.x - t.x, ctx.cam.position.z - t.z);
    const cand = [];
    for (const r of ACT_STAND_R) {
      for (let k = 0; k < 24; k++) {
        const a = camA + (k / 24) * Math.PI * 2;
        const x = t.x + Math.sin(a) * r, z = t.z + Math.cos(a) * r;
        if (nav.blocked(x, z, BODY_R)) continue;
        const side = Math.cos(a - camA);                       // 1=카메라 쪽 · -1=화분 뒤
        const score = -Math.abs(side - 0.15) * 1.6
                      - Math.hypot(x - from.x, z - from.z) * 0.35
                      - (r - ACT_STAND_R[0]) * 0.5;
        cand.push({ x, z, score });
      }
    }
    cand.sort((p, q) => q.score - p.score);
    /* ⚠ 여기서 nav.path 로 걸러내지 않는다. path 는 **이미 그 자리에 서 있어도**
       빈 배열을 준다(best===start) — 그걸 "못 간다"로 읽으면 제자리 물주기가 통째로
       막힌다(실제로 막혔다). 갈 수 있나는 다 걷고 나서 거리로 판정한다(ACT_REACH). */
    return cand;
  }

  /* ── 물뿌리개 ──
     ★★ 두 갈래다. **진짜 GLB 가 있으면 그것을, 없으면 원기둥 셋을** 쓴다.
       쓰는 쪽은 어느 쪽인지 몰라도 된다 — 보는 것은 **주둥이 끝(userData.tip) 하나뿐**이다.
     생김새 규약 — 몸통은 +Y, 주둥이는 +X, 원점은 밑면 가운데.
       기울이는 쪽(runAct)이 이 약속을 쓴다. GLB 도 여기 맞춰 다듬어 넣는다.

     ★★ 지금은 **원기둥 판을 쓴다**(CAN_USE_GLB = false). 재고 정한 것이라 근거를 남긴다.
       2026-08-04 assets/props/watering_can.glb 가 들어왔다. tools/probe_watering_can.mjs 로
       둘을 같은 자리·같은 재질로 놓고 재고 찍었다(docs/engine/shots/can_*.png).
         삼각형     GLB 12,170  vs  원기둥 224            → 54배
         화면 삼각형 37,616  vs  25,670                   → 보이는 것의 +47%
         드로우콜   GLB 1 · 원기둥 3                       (여기는 GLB 가 낫다)
         받는 바이트 GLB 559KB · 원기둥 0
         **화면에서 몇 px 인가**  폰 세로(390×844)에서 **18 × 24.5 px**
       ★ 그리고 그 18px 를 8배로 늘려 나란히 붙여 봤다(can_real.png) — **분간이 안 된다.**
         둘 다 흰 덩어리 하나다. 오히려 원기둥 판이 주둥이가 삐죽해 물뿌리개로 더 읽힌다.
       ⇒ 아무도 못 보는 데에 삼각형 1.2만과 559KB 를 쓰는 셈이라 **안 쓴다.**
       ⚠ **파일은 지우지 않았다.** 아래 스위치 한 줄이면 켜진다. 켤 만한 때는 둘이다 —
         ① 삼각형 1천 안팎짜리 저폴리가 오면(그때는 공짜다).
         ② 호스트가 물 주는 동안 focusSlot(자리 확대)로 들어가게 되면.
            그 화면에서는 같은 물뿌리개가 **557 × 662 px** 로 잰다 — 그때는 원기둥이 든다.
            (지금 game.html 은 물 줄 때 focusSlot 을 안 쓴다. 그래서 지금은 18px 이 전부다) */
  const CAN_URL = '../../assets/props/watering_can.glb';
  const CAN_USE_GLB = false;          // ★ 저폴리 물뿌리개가 오면 여기만 true
  /* 손에 쥔 물건의 제일 긴 치수[m]. 캐릭터 키가 1.40m 이고 원기둥 판의 길이가 0.27m 다 —
     같은 덩치로 맞춘다("0.2m 안팎"). GLB 가 어떤 크기로 오든 여기에 맞춰 줄인다. */
  const CAN_MAX = 0.24;
  const CAN_TIP = '__can_tip';        // ★ 이름으로 찾는다. clone 이 userData 는 못 넘긴다
  /* 지금 들어온 GLB 는 **주둥이가 -X 를 본다** — 이름 있는 노드가 없어 물어볼 데가 없어서
     tools/probe_watering_can.mjs 로 0°·90°·180°·270° 를 찍어 눈으로 잡았다
     (docs/engine/shots/can_zoom.png). 규약은 +X 이므로 반 바퀴 돌려서 맞춘다.
     ⚠ 다른 파일로 갈아 끼우면 그 도구로 **다시 찍어서** 이 값을 고쳐라. */
  const CAN_YAW_FIX = Math.PI;

  /* 물뿌리개 색 — GLB 판이 무텍스처(재질 0건)라 색은 코드에서 입힌다.
     방이 파스텔이라 채도를 낮춘 청록으로 맞췄다. 원기둥 판도 같은 색을 쓴다.
     ⚠ 원기둥 판은 **매번 새로 만든다**(끝나면 disposeObject 가 버린다).
       GLB 판은 원본과 나눠 쓰므로 아래 하나짜리를 돌려 쓰고, 버리지 않는다. */
  const CAN_LOOK = { color: 0x8fb6c9, roughness: 0.5, metalness: 0.15, flatShading: true };
  let _canMat = null;
  function canMatShared() {
    if (!_canMat) _canMat = new THREE.MeshStandardMaterial(CAN_LOOK);
    return _canMat;
  }

  /* GLB 한 벌을 '손에 쥘 물건'으로 다듬는다 — 크기·원점·재질·주둥이. 한 번만 한다. */
  function fitCanAsset(scene) {
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3(); box.getSize(size);
    const big = Math.max(size.x, size.y, size.z);
    if (!(big > 1e-4)) throw new Error('빈 모델입니다');
    const k = CAN_MAX / big;
    const g = new THREE.Group();
    /* 안쪽 = 원점·크기 맞추기, 바깥쪽 = 방향 맞추기. 둘을 갈라 놔야 서로 안 엉킨다. */
    const yaw = new THREE.Group();
    yaw.rotation.y = CAN_YAW_FIX;
    yaw.add(scene);
    g.add(yaw);
    scene.scale.multiplyScalar(k);
    /* 원점 약속 맞추기 — XZ 는 가운데, Y 는 밑면(원기둥 판과 같다) */
    scene.position.set(-(box.min.x + box.max.x) * 0.5 * k, -box.min.y * k,
                       -(box.min.z + box.max.z) * 0.5 * k);
    scene.traverse(o => {
      if (!o.isMesh) return;
      o.material = canMatShared();
      o.castShadow = true;
      o.frustumCulled = false;
      /* ★ 원본과 기하를 나눠 쓴다 — disposeObject 가 버리면 다음 물뿌리개가 빈다 */
      o.userData.sharedGeometry = true;
    });
    /* 물이 나오는 점 — **이름 있는 노드가 없어서** 바운딩 박스로 잡는다.
       쓸 때 로컬 +X 가 화분을 보게 돌리므로, 화분 쪽 실루엣 끝(+X 끝)이 곧 주둥이다.
       높이는 몸통 위쪽 3분의 2 — 주둥이는 물이 안 넘치게 위에 달린다. */
    const tip = new THREE.Object3D();
    tip.name = CAN_TIP;
    tip.position.set(size.x * k * 0.5, size.y * k * 0.66, 0);
    g.add(tip);
    return g;
  }

  /* 한 번만 시도한다. 파일이 없으면 **조용히 넘어가지 않고** 한 번 경고하고 만다.
     ★★ 쓰는 쪽은 이 함수를 **기다리지 않는다.** 다 받아 놓은 것(_canReady)만 동기로 읽는다.
       기다리게 두면 느린 회선에서 물주기가 파일을 받는 동안 통째로 멈춘다 —
       심하면 응답이 안 오는 동안 게이지가 영영 안 찬다. 그래서 첫 한 번은 원기둥으로
       그리고, 받아진 다음부터 진짜를 쓴다. 18px 짜리 소품이라 그 차이는 안 보인다. */
  let _canTried = false, _canReady = null;
  function ensureCanAsset() {
    if (!CAN_USE_GLB || _canTried) return;
    _canTried = true;
    loadGLB(AT(CAN_URL)).then(g => { _canReady = fitCanAsset(g); needsRender = true; })
      .catch(e => console.warn(
        `[방뷰] 물뿌리개 GLB 를 못 실었습니다 (${CAN_URL}) — 원기둥으로 그립니다:`, e.message));
  }

  /* proto 가 있으면 그것을 복제하고, 없으면 원기둥 셋으로 그 자리에서 만든다. */
  function makeWateringCan(proto) {
    if (proto) {
      const g = proto.clone(true);
      /* ⚠ clone 은 userData 를 JSON 으로 베낀다 — Object3D 를 못 넘긴다. 이름으로 다시 찾는다. */
      g.userData.tip = g.getObjectByName(CAN_TIP);
      g.userData.shared = true;                 // 기하·재질은 원본 것이다. 버리지 않는다
      return g;
    }
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial(CAN_LOOK);
    /* 크기 — 방 전경에서 캐릭터가 화면 40px 남짓이다. 실물 비례(몸통 9cm)로 만들었더니
       손에 든 것이 무엇인지 안 보였다(찍어서 봤다). 1.4배로 키워 '들고 있는 물건'으로 읽히게 한다.
       3.5등신 치비라 손도 그만큼 크다 — 커진 쪽이 오히려 비례가 맞는다. */
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.078, 0.135, 12), mat);
    body.position.y = 0.068;
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.023, 0.175, 8), mat);
    spout.rotation.z = -Math.PI / 2 - 0.32;                 // 앞으로 뻗고 살짝 든다
    spout.position.set(0.105, 0.110, 0);
    const grip = new THREE.Mesh(new THREE.TorusGeometry(0.046, 0.011, 6, 12), mat);
    grip.rotation.y = Math.PI / 2;
    grip.position.set(-0.064, 0.106, 0);
    g.add(body, spout, grip);
    /* 물이 나오는 점. 쓰는 쪽은 이것만 본다 — 모양이 바뀌어도 여기만 맞으면 된다. */
    const tip = new THREE.Object3D();
    tip.name = CAN_TIP;
    tip.position.set(0.193, 0.138, 0);
    g.add(tip);
    g.userData.tip = tip;
    for (const m of [body, spout, grip]) { m.castShadow = true; m.frustumCulled = false; }
    return g;
  }

  /* ── 물 뿌리기 이펙트 ──
     ★ 물방울 48개를 **점 하나짜리 드로우콜 한 번**으로 낸다. 자리 계산은 전부 정점
       셰이더가 한다 — 자바스크립트는 매 프레임 uniform 두 개만 쓴다(uPhase·uAlpha).
       CPU 로 48개 좌표를 매 프레임 다시 쓰면 폰에서 그게 그대로 프레임이 된다.
     ⚠ 성능 정책을 안 깬다. 이펙트가 도는 동안만 '바쁜 화면'(30fps)이고,
       끝나면 이펙트를 통째로 치워서 다시 노는 화면(10fps)으로 돌아간다. */
  const WATER_N = 48;
  function makeWaterFx() {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(WATER_N * 3);              // 자리는 셰이더가 정한다(전부 0)
    const seed = new Float32Array(WATER_N);
    const jit = new Float32Array(WATER_N * 3);
    for (let i = 0; i < WATER_N; i++) {
      seed[i] = i / WATER_N + (Math.random() - 0.5) * 0.01;
      jit[i * 3] = (Math.random() - 0.5) * 0.075;
      jit[i * 3 + 1] = (Math.random() - 0.5) * 0.02;
      jit[i * 3 + 2] = (Math.random() - 0.5) * 0.075;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    geo.setAttribute('aJit', new THREE.BufferAttribute(jit, 3));
    const uni = {
      uFrom: { value: new THREE.Vector3() }, uTo: { value: new THREE.Vector3() },
      uPhase: { value: 0 }, uAlpha: { value: 0 }, uSize: { value: 40 }, uPx: { value: pxRatio }
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: uni, transparent: true, depthWrite: false,
      vertexShader: `
        attribute float aSeed; attribute vec3 aJit;
        uniform vec3 uFrom; uniform vec3 uTo; uniform float uPhase; uniform float uSize; uniform float uPx;
        varying float vT;
        void main(){
          float t = fract(uPhase + aSeed);
          vT = t;
          vec3 p = mix(uFrom, uTo, t) + aJit * t;
          p.y -= 0.16 * t * t;                    /* 떨어지는 물이라 끝으로 갈수록 처진다 */
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = uSize * uPx / max(0.25, -mv.z);
        }`,
      fragmentShader: `
        precision mediump float;
        uniform float uAlpha; varying float vT;
        void main(){
          vec2 d = gl_PointCoord - 0.5;
          float m = 1.0 - smoothstep(0.20, 0.5, length(d));
          float a = uAlpha * m * smoothstep(0.0, 0.06, vT) * (1.0 - smoothstep(0.82, 1.0, vT));
          if (a < 0.01) discard;
          gl_FragColor = vec4(0.80, 0.91, 1.0, a);
        }`
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;                   // 좌표가 셰이더 안에 있어 bbox 가 원점이다
    pts.renderOrder = 996;
    /* 흙에 떨어진 자국 — 물이 닿았다는 표시. 한 장이면 충분하다. */
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x9fd0e8, transparent: true, opacity: 0,
                                                  side: THREE.DoubleSide, depthWrite: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.03, 0.05, 20), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.renderOrder = 997;
    houseGroup.add(pts); houseGroup.add(ring);
    return {
      /* from=주둥이 끝 · to=흙 */
      aim(from, to) {
        uni.uFrom.value.copy(from); uni.uTo.value.copy(to);
        ring.position.set(to.x, to.y + 0.004, to.z);
      },
      /* t01 은 동작 진행률. 처음·끝을 부드럽게 열고 닫는다(갑자기 물이 끊기면 놀란다) */
      tick(t01, dt) {
        uni.uPhase.value = (uni.uPhase.value + dt * 2.6) % 1;
        uni.uAlpha.value = Math.min(1, t01 / 0.22) * Math.min(1, (1 - t01) / 0.18);
        const pulse = (t01 * 3) % 1;
        ring.scale.setScalar(0.6 + pulse * 1.9);
        ringMat.opacity = uni.uAlpha.value * (1 - pulse) * 0.55;
      },
      dispose() {
        houseGroup.remove(pts); houseGroup.remove(ring);
        geo.dispose(); mat.dispose(); ring.geometry.dispose(); ringMat.dispose();
      }
    };
  }

  /* ── 진행 상태 ── 한 번에 하나만 돈다. 새로 부르면 앞의 것을 취소한다. */
  let curAct = null;          // { token, kind, key, charId, phase, p01 }
  let actInstant = false;     // 빨리감기 — 켜져 있으면 연출을 통째로 건너뛴다
  const actBusy = () => !!curAct;

  function cancelAct(reason) {
    if (!curAct) return false;
    const tk = curAct.token;
    if (tk.cancelled) return true;
    tk.cancelled = true;
    tk.reason = reason || '취소했습니다';
    const c = tk.charId && chars.get(tk.charId);
    if (c && c.abortAct) c.abortAct(tk.reason);
    return true;
  }

  /* 흙의 높이 — 물이 떨어질 자리. 화분 윗면을 재서 쓴다(없으면 자리 점 위 12cm). */
  const _actBox = new THREE.Box3();
  function soilPointOf(t) {
    const p = t.pos;
    if (t.plant && t.plant.group) {
      try {
        _actBox.setFromObject(potPartOf(t.plant.group));
        if (Number.isFinite(_actBox.max.y))
          return new THREE.Vector3(p.x, _actBox.max.y + 0.01, p.z);
      } catch (e) { /* 못 재면 어림으로 */ }
    }
    return new THREE.Vector3(p.x, p.y + 0.12, p.z);
  }

  const _tipV = new THREE.Vector3();

  async function runAct(key, kind, o, token) {
    const K = String(kind || '').toLowerCase();
    const base = ACT_SPEC[K];
    /* 모르는 이름은 **던진다** — 프로그램이 잘못 부른 것이지 게임에서 일어난 일이 아니다 */
    if (!base) throw fail(new Error(`모르는 동작: ${kind} — water·sow·harvest 뿐입니다`));
    const t = resolveKey(key);
    if (!t) throw fail(new Error(`모르는 슬롯: ${key} (방 ${roomId})`));
    /* 소품은 **걷는 동안** 미리 받아 둔다. 다 걷고 나서 받으면 모션 앞이 한 박자 빈다.
       (안 켜져 있거나 파일이 없으면 곧바로 null 이 되어 원기둥으로 간다) */
    if (base.prop === 'can') ensureCanAsset();

    const t0 = performance.now();
    const prog = (p, phase) => {
      if (curAct && curAct.token === token) { curAct.p01 = p; curAct.phase = phase; }
      try { o.onProgress && o.onProgress(clamp(p, 0, 1), phase); } catch (e) { fail(e); }
    };
    const bail = (reason) => {
      try { o.onFail && o.onFail(reason); } catch (e) { fail(e); }
      return { ok: false, kind: K, key: t.key, reason, ms: Math.round(performance.now() - t0) };
    };
    /* ★ 연출이 다 끝난 **뒤에만** 여기 온다. 논리는 이 한 곳에서만 돈다. */
    const finish = async (skipped) => {
      prog(1, 'act');
      if (o.onDone) await o.onDone();          // 던지면 그대로 밖으로 나간다 — 논리 오류는 감추지 않는다
      return { ok: true, kind: K, key: t.key, instant: !!skipped,
               ms: Math.round(performance.now() - t0) };
    };

    /* ── 빨리감기·연출 없음 ──
       ⚠ 빨리감기 중에는 연출을 하지 않는다. 그게 빨리감기의 뜻이다(박사님).
       ★ 캐릭터가 아예 없을 때도 여기로 온다. 사람이 없다고 물이 안 들어가면
         게임이 막힌다 — 못 하는 것과 안 보여주는 것은 다른 얘기다. */
    const person = (() => {
      const id = o.charId || (selChar && chars.get(selChar) && chars.get(selChar).walkable ? selChar : null)
                 || (chars.has('jachwi') ? 'jachwi' : null);
      const c = id && chars.get(id);
      return c && c.walkable && c.walkToXZ ? { id, c } : null;
    })();
    const instant = o.instant != null ? !!o.instant : actInstant;
    if (instant || !person || !built) {
      prog(0, 'act');
      return finish(true);
    }
    token.charId = person.id;

    /* ① 걸어간다 ------------------------------------------------------- */
    prog(0, 'walk');
    const here = () => ({ x: person.c.root.position.x, z: person.c.root.position.z });
    const cands = standNear({ x: t.pos.x, z: t.pos.z }, here());
    if (!cands.length) return bail('그 자리 곁에는 설 데가 없습니다');
    const stand = cands[0];
    if (Math.hypot(here().x - stand.x, here().z - stand.z) > ACT_NEAR_ENOUGH) {
      const w = await person.c.walkToXZ(stand.x, stand.z, p => prog(p, 'walk'));
      if (token.cancelled) return bail(token.reason);
      /* ok:false 는 '길이 아예 안 잡혔다'거나 '다른 걸음에 밀렸다'다. 둘 다 그만둔다 —
         밀린 것을 이어서 하면 플레이어가 방금 시킨 걸음을 이 함수가 되돌리게 된다. */
      if (!w.ok && w.reason !== '갈 수 없는 자리입니다') return bail(w.reason || '걸음이 끊겼습니다');
    }
    /* ★ 여기가 "못 가는 자리면 실패한다"를 재는 유일한 곳이다(위 ACT_REACH 주석) */
    const gap = Math.hypot(here().x - t.pos.x, here().z - t.pos.z);
    if (gap > ACT_REACH) return bail(`거기까지 못 갑니다 (${gap.toFixed(2)}m 떨어져 있습니다)`);
    prog(1, 'walk');

    /* ② 선다 — 대상을 본다 --------------------------------------------- */
    await person.c.faceXZ(t.pos.x, t.pos.z);
    if (token.cancelled) return bail(token.reason);

    /* ③ 모션 ------------------------------------------------------------ */
    /* 바닥에 놓인 것은 쭈그려서 딴다 */
    const spec = (base.low && t.pos.y < base.low.atY) ? { ...base, ...base.low } : base;
    const clip = await actClipOf(person.c.assetId, spec.clip, spec.from, spec.win)
      .catch(e => { console.warn(`[방뷰] 동작 클립 '${spec.clip}' 을 못 실었습니다 — 절차적 몸짓으로 대신합니다:`, e.message); return null; });
    if (token.cancelled) return bail(token.reason);

    /* 소품·이펙트는 여기서 만들고 여기서 치운다. 새는 길을 하나만 둔다. */
    let can = null, fx = null, soil = null, hand = null;
    if (spec.prop === 'can') {
      hand = person.c.handBone;
      /* ★ 받아 놨으면 진짜, 아니면 원기둥. **기다리지 않는다**(ensureCanAsset 주석 참고) */
      if (hand) { can = makeWateringCan(_canReady); can.rotation.order = 'YXZ'; houseGroup.add(can); }
      else console.warn('[방뷰] 오른손 뼈를 못 찾았습니다 — 물뿌리개 없이 이펙트만 냅니다');
    }
    if (spec.fx === 'water') { fx = makeWaterFx(); soil = soilPointOf(t); }
    const cleanup = () => {
      if (can) {
        houseGroup.remove(can);
        /* ★ GLB 판은 원본과 기하·재질을 나눠 쓴다 — 버리면 다음 물뿌리개가 텅 빈다 */
        if (!can.userData.shared) disposeObject(can);
        can = null;
      }
      if (fx) { fx.dispose(); fx = null; }
      needsRender = true;
    };

    let last = performance.now();
    try {
      prog(0, 'act');
      try { o.onArrive && o.onArrive(); } catch (e) { fail(e); }
      const done = await person.c.runClip(clip, spec.sec, p01 => {
        const now = performance.now();
        const dt = Math.min(0.1, (now - last) / 1000); last = now;
        if (can && hand) {
          hand.getWorldPosition(_tipV);
          can.position.copy(_tipV);
          /* 로컬 +X 가 대상을 향하게 돌린다(+X 는 Ry 로 (cos,0,-sin) 이 된다) */
          can.rotation.y = Math.atan2(-(t.pos.z - can.position.z), t.pos.x - can.position.x);
          /* 붓는 각 — **팔이 다 나간 뒤에** 제일 많이 기울인다.
             쓰는 마디(open_door 0.30~1.80s)에서 팔은 p01 0.13 에 나가기 시작해 0.87 에
             닿고 그대로 멎는다(재서 확인했다). sin(πp01) 로 두면 팔이 아직 나가는 중에
             물뿌리개만 먼저 엎어져 허공에 붓는 그림이 된다. 그래서 올라갈 때는 팔을
             따라가고 끝에서만 짧게 세운다 — 물줄기(fx)가 열리고 닫히는 모양과 같은 꼴이다. */
          can.rotation.z = -0.95 * Math.min(1, p01 / 0.65) * Math.min(1, (1 - p01) / 0.13);
        }
        if (fx) {
          if (can) can.userData.tip.getWorldPosition(_tipV);
          else if (hand) hand.getWorldPosition(_tipV);
          else _tipV.set(soil.x, soil.y + 0.55, soil.z);
          fx.aim(_tipV, soil);
          fx.tick(p01, dt);
        }
        prog(p01, 'act');
      });
      if (token.cancelled) return bail(token.reason);
      if (!done) return bail('동작이 끊겼습니다');
    } finally {
      cleanup();
    }

    /* ④ 그제야 논리 ------------------------------------------------------ */
    return finish();
  }

  /* ★ 공개 창구는 actAt 하나다. 돌려주는 Promise 에 .cancel() 이 붙어 있다. */
  function actAt(key, kind, opt) {
    const o = opt || {};
    cancelAct('다른 동작이 시작됐습니다');
    const token = { cancelled: false, reason: null, charId: null };
    const rec = { token, kind: String(kind || '').toLowerCase(), key: String(key), phase: 'walk', p01: 0 };
    curAct = rec;
    const p = runAct(key, kind, o, token)
      .finally(() => { if (curAct === rec) curAct = null; needsRender = true; });
    /* 취소하는 법 — 이 한 줄이다. 취소하면 onDone 은 안 부른다. */
    p.cancel = (reason) => { if (curAct === rec) cancelAct(reason); return p; };
    return p;
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
    /* ★ 무언가 하는 중에는 안 비킨다. 물을 주다 말고 옆으로 걸어가면 그건 비켜선 게
       아니라 그만둔 것이다(실제로 걸어가면 걸음이 모션을 끊는다). */
    if (actBusy()) return 0;
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
  /* ★★ 순번은 **자리(key)마다** 센다 — 하나로 세면 둘 중 하나가 조용히 죽는다 (2026-08-16)
     ══════════════════════════════════════════════════════════════════
     박사님: *"한번씩 캐릭이 사라져."* 사진에는 몬이만 있고 자취생이 없었다.

     예전에는 `charSeq` 가 **하나**였다. 「나보다 나중에 부른 게 있으면 내 것은 버린다」는
     뜻인데, 자취생과 몬이는 **서로 다른 자리**라 나중 것이 앞 것을 무를 이유가 없다.
     그런데 `assemble()` 이 방을 다시 지을 때 있던 사람을 **await 없이 둘 다** 부른다
     (§assemble 아래 `for (const k of wasHere)`). 그러면
       setCharacter('jachwi') → my=1,  setCharacter('moni') → my=2, charSeq=2
     가 되고, 자취생 GLB 가 다 실린 뒤 `my !== charSeq` 가 **반드시 참**이라
     **자취생만 조용히 버려진다.** 실패가 아니라 성공한 뒤에 버리는 것이라
     `.catch` 에도 안 걸리고 콘솔에도 아무 말이 없었다.

     ⇒ 재서 확인했다(`tools/probe_char_moni.mjs` C절): **가구를 한 칸 옮기면**
       (= 방 재조립) `jachwi·moni → moni` 로 100% 사라졌다. 「한 번씩」의 정체가 이것이다.
     ⇒ 그리고 이게 ㉡ 「몬이가 안 따라온다」의 뿌리이기도 하다 — 사람이 없으면
       몬이의 homeXZ 가 화분(없으면 standSpot) 옆으로 떨어지고, 그건 안 움직인다.
       실측 D2절: 사람이 사라진 뒤 몬이 자리 **가짓수 1**. 정말로 못 박혀 있었다.
     ⚠ 되돌리지 마라. 순번을 하나로 합치면 같은 사고가 그대로 돌아온다. */
  const charSeq = new Map();          // key → 그 자리에 대한 최신 요청 번호
  const bumpSeq = key => { const n = (charSeq.get(key) || 0) + 1; charSeq.set(key, n); return n; };
  async function setCharacter(who, opt = {}) {
    if (who == null) {                                  // null 이면 놓인 것을 전부 치운다
      /* 오는 중인 것까지 무른다 — 안 그러면 치운 직후에 도착한 GLB 가 빈 방에 선다 */
      for (const k of ['jachwi', 'moni']) bumpSeq(k);
      for (const [k, c] of [...chars]) { c.dispose(); chars.delete(k); }
      selectCharacter(null);
      needsRender = true;
      return null;
    }
    const key = who === 'moni' ? 'moni' : 'jachwi';
    const my = bumpSeq(key);
    const old = chars.get(key);
    if (old) { old.dispose(); chars.delete(key); if (selChar === key) selectCharacter(null); needsRender = true; }
    let c;
    progress('character:' + key, key === 'moni' ? '몬이를 부르는 중' : '캐릭터를 세우는 중');
    try {
      c = who === 'moni' ? await makeMascot() : await makePerson(who);
    } catch (e) {
      throw fail(new Error(`캐릭터를 못 놓았습니다 (${who}): ${e.message}`));
    }
    if (disposed || my !== charSeq.get(key)) { c.dispose(); return null; }
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
        potD: p.potD ?? null,
        /* 실제로 **세워진** 용기 수다. spec 을 되읽는 게 아니라 그루가 스스로 적어 둔 값이다 */
        count: p.group.userData.containerCount || 1
      }));
    },
    /* 반투명 유령을 그 좌표에 세운다. opt.valid=false 면 붉게.
       previewMove 와 유령 한 벌을 나눠 쓴다 — 둘이 동시에 뜨지 않는다. */
    previewAt(at, opt) { try { return previewAt(at, opt || {}); } catch (e) { throw fail(e); } },
    clearPreview() { disposePreview(); },

    /* 추천 자리 원형 가이드. on=false 면 감춘다(지우지 않는다 — 다시 켤 때 값싸다).
         opt.potD/plantId  못 올라가는 자리를 어둡게 구분한다
         opt.count         용기 여럿을 끌고 있을 때의 수(§clusterUnit). 안 주면 1
         opt.near {x,z}    커서에 제일 가까운 자리를 굵고 밝게
       ★ 원은 안내지 제약이 아니다. 원 밖에도 놓을 수 있다.
       돌려주는 값은 이 화분이 올라갈 수 있는 자리 수. */
    showSlotRings(on, opt) { return showSlotRings(!!on, opt || {}); },
    slotRings() { return slotRingState(); },
    /* ★ 가구 윗면 전체 칸 (§guideCells · 2026-08-11). `slotRings()` 와 **다른 층**이다 —
       거기는 추천 자리 14칸, 여기는 상판을 0.25m 로 나눈 칸이다. 섞어 세지 마라. */
    guideCells(opt) { return guideCellState(opt || {}); },

    /* ── 바닥 격자 (2026-08-03) ──
       ★ 배치·이동 중에만 켠다. 늘 켜 두면 방이 안 보인다.
         opt.potD  그 화분이 못 들어가는 칸을 붉게
         opt.uid   그 가구가 못 들어가는 칸을 붉게(발자국이 커서 훨씬 많다)
       돌려주는 값은 **놓을 수 있는 칸 수**. */
    showGrid(on, opt) { return showGrid(!!on, opt || {}); },
    /* 격자 눈금 — 한 칸 크기와 그 방의 칸 수 */
    grid() {
      const b = built ? roomBox() : null;
      const sp = built ? gridSpan() : null;
      return { unit: GRID_UNIT, cell: GRID_CELL,
               /* 놓는 걸음 = 보이는 칸의 절반. 화면에 그리는 선(cell)과 실제로 앉는 자리가
                  다르다는 것을 화면이 알 수 있게 같이 낸다(머리말 2026-08-07). */
               step: MOVE_STEP,
               /* room.w/d·cols/rows 는 **바깥 치수** 그대로다(예전 뜻을 안 바꾼다).
                  실제로 그리는 칸 수는 room.cells 다 — 바깥 벽에 물리는 칸을 뺀 수다.
                  free+blocked 은 cols*rows 가 아니라 **cells** 와 같다(2026-08-08).
                  inner 는 벽 안쪽 면이 만드는 사각형 — 「방 안쪽이 몇 m 냐」를 재는 자다. */
               /* ⚠ 2026-08-16 — cols·rows 는 **안쪽 기준**이다(격자를 안쪽에 깔므로).
                  바깥 상자로 세면 화면에 깔린 칸 수와 안 맞아 「자가 딴 걸 잰다」가 된다. */
               room: b ? { w: b.w, d: b.d, cols: sp ? sp.nx : Math.round(b.w / GRID_CELL),
                           rows: sp ? sp.nz : Math.round(b.d / GRID_CELL),
                           cells: sp.cells,
                           inner: { w: sp.inner.w, d: sp.inner.d,
                                    x0: +sp.inner.x0.toFixed(4), x1: +sp.inner.x1.toFixed(4),
                                    z0: +sp.inner.z0.toFixed(4), z1: +sp.inner.z1.toFixed(4) } } : null,
               visible: !!(gridGroup && gridGroup.visible),
               free: gridGroup ? gridGroup.userData.free : null,
               blocked: gridGroup ? gridGroup.userData.blocked : null };
    },
    /* 길이[m] → 칸 수(올림). UI 가 "책상 24×12칸" 같은 표시를 만들 때 쓴다 */
    cellsOf(m) { return unitsFor(m); },
    /* ★ 옮길 때의 걸음[m] — 화면이 surfaceAt·previewFurnitureAt 에 그대로 넣는다.
       값과 근거는 이 파일 머리말(SNAP_DIV) 참고. 기본은 반 칸 0.125m 다. */
    moveStep() { return MOVE_STEP; },
    /* 가구를 격자에 앉힌 좌표 — 미리보기 없이 미리 물어볼 때 */
    snapFurniture(uid, pos) { try { return snapFurniture(uid, pos || {}); } catch (e) { throw fail(e); } },

    /* ── 가구 옮기기 ──
       ⚠ 끄는 동안에는 previewFurnitureAt 만 부른다. commit 은 손 뗄 때 한 번이다. */
    pickFurnitureAt(px, py) { try { return pickFurnitureAt(px, py); } catch (e) { throw fail(e); } },
    furniture() { return furnNodes().map(furnInfo); },

    /* ── 가구 밝히기 (2026-08-08) ──
       roomView.highlightFurniture(uid)        그 가구를 살짝 밝힌다(한 번에 하나)
       roomView.highlightFurniture(null)       끈다 — 원래 재질로 정확히 되돌린다
       roomView.highlightFurniture(uid, { strength: 0.16 })   밝기를 손으로 정할 때

       돌려주는 값 = furniture() 한 줄 + 다음 셋. 메뉴를 띄우는 데 필요한 것이 다 들어 있다.
         lit     밝힌 메시 수(0 이면 밝힐 게 없었다는 뜻이다)
         screen  가구 **발밑**의 화면 좌표 { x, y } — 캔버스 기준 CSS 픽셀
         top     가구 **머리 위**의 화면 좌표 — 메뉴는 대개 이 옆에 띄운다
       ⚠ 화면 좌표는 **그 순간의 값**이다. 시점을 돌리면 따라 움직여야 하므로
         프레임마다 screenPosOf(uid) 로 다시 물어야 한다(둘은 같은 규약·같은 점이다).
       ⚠ 조도·판정·좌표는 안 건드린다. 이건 그림이다. */
    highlightFurniture(uid, opt) {
      try { return highlightFurniture(uid == null ? null : uid, opt || {}); }
      catch (e) { throw fail(e); }
    },
    /* 지금 밝혀 둔 가구 uid — 없으면 null */
    highlightedFurniture() { return furnHL ? furnHL.uid : null; },

    /* ── 포인터 모드 (2026-08-08) ──
       roomView.setPointerMode('direct' | 'relative')   기본은 'direct'(지금 그대로)
       roomView.pointerMode()                           지금 모드
       roomView.dragOrigin(id, tapX, tapY)              그 모드에 맞는 **끌기 기준점**

       설정 화면과 저장은 game.html 몫이다. 여기는 값과 기준점만 낸다.
       무엇이 바뀌는지·안 바뀌는지는 위 §포인터 모드 머리말에 적어 뒀다. */
    setPointerMode(m) {
      if (!POINTER_MODES.includes(m)) throw fail(new Error(`모르는 포인터 모드입니다: ${m}`));
      ptrMode = m;
      return ptrMode;
    },
    pointerMode() { return ptrMode; },
    pointerModes() { return [...POINTER_MODES]; },
    dragOrigin(id, tapX, tapY) { try { return dragOrigin(id, tapX, tapY); } catch (e) { throw fail(e); } },
    /* 그 가구에 얹히거나 물려 있는 것들(클립등 등) — 옮기면 같이 간다 */
    ridersOf(uid) {
      const g = furnNode(uid);
      return g ? ridersOf(g).map(n => n.userData.uid) : [];
    },
    /* 방에 놓인 조명 기구의 **지금 자리** — 등이 가구를 따라왔는지 확인하는 창구.
       ⚠ 이 좌표는 buildHouse 가 조립 정의로 만든 것이라 조도 계산(ppfdSum)이 쓰는 것과 같다. */
    lightRigs() {
      return ((built && built.lightRigs) || []).map(r => ({
        /* ★ uid 를 같이 낸다 (2026-08-08) — 등 스위치(§⑧-e)가 uid 로 켜고 끈다.
           id(프리셋 이름)만으로는 같은 종류가 둘일 때 못 가른다. */
        uid: r.uid, id: r.id, grow: !!r.grow, schedule: r.schedule, on: lampIsOn(r.uid),
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

    /* ── ★ 등 옮기기 (2026-08-06 · 위 ⑧-d 주석) ──
       ⚠ **바닥에 선 등(스탠드)은 여기 없다** — 그건 위 `furniture()`·`commitFurnitureAt` 몫이다.
         여기 나오는 것은 무엇엔가 물려 있어 가구 목록에서 빠지는 등뿐이다(집게등).
       ⚠ **붙박이 등(바)은 목록에 안 나오고, 억지로 부르면 던진다.** 겨누기와 같은 규약. */
    lamps() { return lampList(); },

    /* ── ★ 등 스위치 (2026-08-08 · 위 ⑧-e 주석) ──
       ⚠ 여기 나오는 것은 **방에 달린 조명 전부**다(식물등·천장등·플로어 스탠드).
         위 `lamps()`(옮기기 목록)와 다르다 — 못 옮기는 등도 켜고 끌 수는 있다.
       ⚠ **조도(DLI)는 여기서 안 바뀐다.** 계약의 밝기는 `S.lamps.count` 가 낸다. */
    lampOn(uid) { return lampIsOn(uid); },
    setLampOn(uid, on) { try { return setLampOn(uid, on); } catch (e) { throw fail(e); } },
    toggleLamp(uid) { try { return toggleLamp(uid); } catch (e) { throw fail(e); } },
    setLampSwitches(map) { try { return setLampSwitches(map); } catch (e) { throw fail(e); } },
    /* 지금 상태 + 켠 시간(게임 시간 h) + 와트시. 전기세의 재료다 */
    lampSwitches() { return lampSwitches(); },
    /* 하루를 닫는다 — 마지막 장부를 주고 시간을 0 으로. 스위치는 그대로 둔다 */
    resetLampHours() { return resetLampHours(); },
    /* 물릴 수 있는 상판 — 화분이 올라갈 수 있는 상판이 곧 집게를 물릴 수 있는 상판이다.
       [{ mountId, uid, name, x, y, z, w, d, rot, slots }] · y 오름차순 */
    lampMounts() { return lampMounts(); },
    /* 왜 못 옮기나 — 옮길 수 있으면 null, 아니면 한국어 이유(붙박이·천장·movable 없음) */
    lampImmovableReason(uid) { return lampImmovableReason(uid); },
    /* 여기 물릴 수 있나 — { ok, reason, mountId, x, y, z, lift, emitY }.
       pos = { mountId? , x?, z?, lift?, rot? } · lift 는 상판에서 들어 올릴 높이(m) */
    lampFit(uid, pos) { return lampFit(uid, pos || {}); },
    previewLampAt(uid, pos) { try { return previewLampAt(uid, pos); } catch (e) { throw fail(e); } },
    clearLampPreview() { disposeFurnGhost(); },
    /* 실제로 옮긴다. Promise. 못 놓는 자리·못 옮기는 등이면 reject 한다.
       ★ 자리는 가구와 **같은 표**(S.home.furniture[uid] = {x,z,rot,y})에 쌓인다 —
         조도 엔진의 furnitureOverrides() 로 읽어 세이브에 적으면 왕복한다. */
    commitLampAt(uid, pos) { return commitLampAt(uid, pos || {}); },
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
    /* rank(선택) — 'good'|'ok'|'bad'. 안 주면 예전 그대로 "들어가나"로만 칠한다 */
    previewMove(fromId, toId, rank) { try { return previewMove(fromId, toId, rank); } catch (e) { throw fail(e); } },
    /* 놓을 수 있는 자리 빛내기. [] 면 해제.
         highlightSlots(['shelf#1:0', ...])                       예전 그대로
         highlightSlots([{ slotId:'shelf#1:0', rank:'good' }, …])  세 색
       rank: 'good' 초록(좋은 자리) · 'ok' 노랑(놓을 수는 있는데 별로) · 'bad' 빨강(못 놓는다)
       ★ 어디가 좋은 자리인가는 **작물마다 반대**라 여기서 판정하지 않는다 — 받아서 칠할 뿐이다 */
    highlightSlots(ids) { if (!ids || !ids.length) clearRings(); else highlightSlots(ids); },
    /* 지금 어떤 자리를 어떤 rank 로 빛내고 있나 — 검사·복원용 */
    highlighted() {
      return [...highlighted].map(id => ({ slotId: id, rank: highlightRank.get(id) || null }));
    },
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
    /* ★ 켠 시간을 **먼저** 센다 (2026-08-08 · §⑧-e).
       daylightT 를 바꾸기 전에 세야 지나간 구간의 켜짐 상태로 세어진다 —
       뒤에 세면 밤이 된 뒤에야 "밤이라 켜져 있었다"가 되어 하루가 한 칸씩 밀린다. */
    setDaylight(t01) {
      const t = clamp(+t01 || 0, 0, 1);
      tickLampClock(t);
      daylightT = t;
      return applyDaylight();
    },
    get daylight() { return daylightT; },
    /* 그림자 예산 — 'lean'(기본) · 'full'(scene.js 기본) · 'none'. 측정·비교용이다. */
    setShadowBudget(mode) { shadowMode = mode; applyDaylight(); return shadowMode; },
    /* ★ 화면 밝기 — 사람이 맞추는 배수(위 §BRIGHT_KEY). 넣으면 바로 보이고 저장된다.
       ⚠ 인자 없이 부르면 **지금 값을 읽기만** 한다. 화면이 슬라이더 초기값을 그걸로 세운다. */
    brightness(v) {
      if (Number.isFinite(v)) {
        userBright = Math.min(BRIGHT_MAX, Math.max(BRIGHT_MIN, v));
        try { localStorage.setItem(BRIGHT_KEY, String(userBright)); } catch { }
        applyDaylight();               /* 노출은 여기서만 바뀐다 — 두 곳에서 쓰면 갈린다 */
      }
      return { value: userBright, min: BRIGHT_MIN, max: BRIGHT_MAX, base: GAME_EXPOSURE };
    },
    /* ★ 조명 정책 — 'game'(기본) · 'house'(scene.js 기본 = index.html 과 같은 그림).
       밝기를 만질 때 **먼저 재기 위한 자**다. 재질 눌림까지 같이 되돌린다.
       (tools/probe_room_light.mjs 가 이걸로 두 그림을 같은 카메라에서 번갈아 찍는다) */
    setLightPolicy(p) {
      lightPolicy = p === 'house' ? 'house' : 'game';
      if (built) dimRoomMaterials(built, lightPolicy === 'house' ? 1 : ROOM_DIM,
                                         lightPolicy === 'house' ? 1 : FURN_DIM);
      applyDaylight();
      needsRender = true;
      return lightPolicy;
    },
    lightPolicy() { return lightPolicy; },
    /* ★ 창밖 골목 — true · false · 'auto'(반지하만, 기본).
       비교 스크린샷과 성능 측정을 위해 켜고 끌 수 있어야 한다. */
    setOutside(mode) {
      outsideMode = (mode === true || mode === false) ? mode : 'auto';
      buildOutside(roomId);
      needsRender = true;
      return outsideMode;
    },
    /* 무엇이 얼마나 붙어 있나 — 삼각형·드로우콜·어느 벽. 없으면 0 이다.
       ★ walls 는 예전 계약(배열)을 지킨다. 지금 창밖은 **제일 큰 창 하나**에만 선다 —
         벽마다 한 벌씩 세우던 옛 방식은 담이 방을 두 겹으로 둘러싸 보였다. */
    outsideInfo() {
      if (!outside) return { mode: outsideMode, tris: 0, quads: 0, walls: [], far: 0, calls: 0 };
      const st = outside.stats;
      return { mode: outsideMode, tris: st.triangles, quads: Math.round(st.triangles / 2),
               near: st.nearTriangles, far: st.farTriangles, calls: st.drawCalls,
               basement: st.basement, hidden: outside.hidden(),
               walls: [outsideWall()] };
    },
    /* ★ 이웃 방 — true · false · 'auto'(반지하만, 기본).
       창밖과 따로 켜고 끈다. 「이웃이 얼마나 무거운가」를 따로 재기 위해서다. */
    setNeighbors(mode) {
      neighborsMode = (mode === true || mode === false) ? mode : 'auto';
      buildNeighbors(roomId);
      needsRender = true;
      return neighborsMode;
    },
    neighborInfo() {
      if (!neighbors) return { mode: neighborsMode, tris: 0, calls: 0, rooms: 0, walls: [], stubbed: [] };
      const st = neighbors.stats;
      return { mode: neighborsMode, tris: st.triangles, calls: st.drawCalls,
               materials: st.materials, rooms: st.rooms, verts: st.vertices,
               lowH: st.lowH, elMin: st.elMin, yLim: st.yLim, skipped: st.skipped,
               walls: neighbors.partNames(), stubbed: neighbors.stubbed() };
    },
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
        /* ★ count 를 같이 주면 **무리 전체**로 본다 — 시루 12개를 창턱에 올리려는
           물음에 "시루 한 개는 들어갑니다"로 답하지 않는다 */
        d = potDOf(plantOrDiameter.kind, plantOrDiameter.count);
      else if (t.plant) d = rotationSafeDiameter(potPartOf(t.plant.group), t.plant.group);
      return { slotId: t.key, maxPotD: Number.isFinite(limit) ? limit : null, diameter: d,
               ok: d == null ? null : !Number.isFinite(limit) || d <= limit + 1e-4 };
    },
    plantDiameter(slotId) {
      const t = resolveKey(slotId);
      return t && t.plant ? rotationSafeDiameter(potPartOf(t.plant.group), t.plant.group) : null;
    },
    /* ★ 그 종류가 차지하는 **회전무관 지름[m]** — 화면(game.html)이 potD 자리에 넣을 값이다.
       ------------------------------------------------------------
       숫자를 화면 쪽에 베껴 두면 두 곳이 갈린다. 여기가 정본이고 화면은 물어서 쓴다.
         'monstera' 0.20 · 'beansprout' 0.24(시루) · 'musun' 0.20(재배판 — 0.4327 에서 줄였다. §MUSUN_D)
       모르는 이름은 몬스테라 화분 지름으로 떨어진다(예전 삼항의 else 와 같은 값).
       ⚠ 무순이 폭 0.36 이 아니라 0.4327 인 이유는 §buildMusun 머리말에 있다.

       ★ 둘째 인자 `count` — 그 자리에 용기를 **여럿** 세울 때의 무리 전체 지름이다
         (2026-08-05 · §clusterUnit). 안 주거나 1 이면 예전 값 그대로다.
           plantPotD('beansprout')      → 0.240   (시루 1개)
           plantPotD('beansprout', 12)  → 0.973   (시루 12개 무리)
         무리를 못 짓는 종류는 count 를 줘도 안 늘어난다 — 안 지을 것의 자리를 안 잡는다.
       ⇒ 화면은 이 값을 **setPlantAt 의 spec.potD 와 surfaceAt 의 opt.potD 양쪽에** 넣는다.
         한쪽만 넣으면 놓을 때는 통과하고 그릴 때는 줄어든다(또는 그 반대다). */
    plantPotD(kind, count) { return potDOf(kind, count); },
    /* ★★★ 닿을 수 있나 (2026-08-09 · §놓은 것이 길을 막는다).
       `reach(key)`   → { ok, reason }   그 그루 곁으로 갈 수 있나
       `unreachable()` → [{ key, potId, reason }]  지금 못 가는 그루 전부
       ⚠ **막지 않는다.** 무엇을 막을지는 화면이 정한다(박사님 지시). */
    reach(key) { return reachOf(key); },
    unreachable() { return unreachablePlants(); },
    /* 이 방뷰가 그릴 줄 아는 종류들 — 화면이 "심을 수 있나"를 미리 물어보는 창구 */
    plantKinds() {
      return Object.keys(PLANT_KINDS).map(k => ({ kind: k, potD: PLANT_KINDS[k].potD,
                                                  growthByDays: PLANT_KINDS[k].growthByDays }));
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
    /* ★ 2026-08-08 — **가구 uid 도 받는다.** 자리 열쇠로 못 풀면 가구에서 찾는다.
       가구는 **발밑**(y=0 면의 한가운데)을 준다 — 자리·캐릭터와 같은 규약이라
       상대 끌기의 기준점으로 그대로 쓸 수 있다. 머리 위 점이 필요하면
       highlightFurniture 가 돌려주는 top 을 쓰십시오(메뉴는 그쪽이 맞다). */
    screenPosOf(slotId) {
      const t = resolveKey(slotId);
      if (t) return slotScreenPos(t.pos);
      return furnScreenPos(anyFurnNode(slotId), 0);
    },
    /* 지금 시점 — 저장했다 복원하거나 검증할 때 쓴다 */
    camera() {
      return { az: cam.az, el: cam.el, dist: cam.dist, fit: fitDist,
               baseAz: windowAzimuth() + YAW_OFFSET,
               target: { x: cam.target.x, y: cam.target.y, z: cam.target.z } };
    },
    /* 측정용 — fps · 무엇을 줄였는지 */
    stats() { return { ...stats, pixelRatio: pxRatio, plants: plants.size, slots: slotById.size,
                       /* 지금 상한 셋 — 재는 도구가 "무엇에 걸려 있나"를 알아야 한다 */
                       fpsCap: { idle: idleCap(), busy: CHAR_FPS, move: moveFps },
                       /* ★ 서 있는 상한이 왜 그 값인지 — 재는 도구가 알아야 한다 */
                       idleCap: { now: idleCap(), floor: IDLE_FPS, anim: ANIM_IDLE_FPS,
                                  skeletal: hasSkeletalChar(), backedOff: animBackedOff,
                                  forced: idleForced },
                       level: busyLevel(),
                       triangles: ctx.renderer.info.render.triangles, calls: ctx.renderer.info.render.calls }; },
    /* ★ **서 있는** 상한을 손으로 정한다 — 재기·비교용. null 이면 기본으로 돌아간다
       (사람이 있으면 24, 없으면 10, 못 따라가면 스스로 10). */
    setIdleFps(v) {
      /* ⚠ `+null` 은 0 이고 0 은 유한하다 — Number.isFinite 만 보면 null 이 4 로 잘린다
         (실제로 그렇게 잘려서 재는 도구가 상한 4 를 재고 있었다). 먼저 null 을 가른다. */
      idleForced = (v == null || v === '' || !Number.isFinite(+v))
                 ? null : Math.max(4, Math.min(60, +v));
      /* ★ 손으로 되돌리는 것은 **자동 내려앉기와 다른 길**이다 — 재는 도구가 같은 화면에서
         여러 상한을 번갈아 재려면 되돌릴 수 있어야 한다. 자동 경로는 그대로 한 방향이다. */
      animBackedOff = false;
      slowIdleWindows = 0;
      needsRender = true;
      return idleCap();
    },
    /* ★★ 그루 발밑을 **얼마나 초록으로** 물들일지 (박사님 2026-08-07 · §설 초록빛).
       ------------------------------------------------------------
         key   그루 열쇠 — `setPlant` 의 slotId, `setPlantAt` 의 potId. `plants()[i].key` 와 같다
         t     0~1. **「그 식물에게」 자리가 얼마나 좋은가**이지 밝기가 아니다.
               콩나물은 어두울수록 1 에 가깝다 — 판정은 부르는 쪽(game.html)이 한다.
       0 이면 예전 그대로의 검은 그림자다. 안 부르면 아무것도 안 바뀐다.
       ⚠ 값을 기억해 둔다 — 그루가 다시 조립돼도 초록이 안 꺼진다.
       ⚠ 조도(DLI)에 한 톨도 안 들어간다. 이건 그림이다. */
    setPlantGlow(key, t) {
      const v = Number.isFinite(t) ? Math.max(0, Math.min(1, t)) : 0;
      plantGlow.set(key, v);
      const b = plantBlobs.get(key);
      if (b) applyGlow(b, v);
      needsRender = true;
      return v;
    },
    plantGlowOf(key) { return plantGlow.get(key) ?? null; },
    /* ★ 접지 그림자를 켜고 끈다 — **재기·비교용**이다(before/after 스크린샷·값 재기).
       ⚠ 이건 그림이라 조도(DLI)는 켜든 끄든 한 톨도 안 바뀐다. */
    setBlobShadows(on) {
      const want = !!on;
      let n = 0;
      ctx.scene.traverse(o => { if (o.userData && o.userData.isBlobShadow) { o.visible = want; n++; } });
      blobsOn = want;
      needsRender = true;
      return n;
    },
    blobShadows() {
      let n = 0;
      ctx.scene.traverse(o => { if (o.userData && o.userData.isBlobShadow && o.visible) n++; });
      return { on: blobsOn, count: n };
    },
    /* ★ 움직임 상한을 손으로 정한다 — 재기·비교용. null 이면 기본(60, 못 따라가면 30) */
    setMoveFps(v) {
      moveFps = Number.isFinite(+v) ? Math.max(10, Math.min(120, +v)) : MOVE_FPS_MAX;
      slowMoveWindows = 0;
      return moveFps;
    },
    setContinuous(v) { forceContinuous = !!v; needsRender = true; },
    /* ★ 방을 멈춘다 — 확대(화분 상세보기)를 열 때처럼 방이 안 보일 때 쓴다.
       rAF 자체를 끊으므로 그리기도 캐릭터 애니메이션도 안 돈다. **논리는 안 멈춘다.**
       풀면 시각 기준을 지금으로 되잡아 캐릭터가 순간이동하지 않는다. */
    setPaused(on) { return setPaused(on); },
    isPaused() { return paused; },
    /* ★ 캐릭터·마스코트 — 자리와 포즈는 안에서 정한다.
         'jachwi'(자취생 1.40m) · 'moni'(마스코트 0.375m) · null(전부 치우기)
       GLB 를 싣느라 Promise 를 돌려준다. .catch 를 붙이십시오. */
    setCharacter(id, opt) { return setCharacter(id, opt || {}); },
    characters() {
      return [...chars].map(([id, c]) => ({
        id, kind: c.kind, assetId: c.assetId, walkable: !!c.walkable,
        selected: id === selChar, walking: !!c.walking,
        pos: { x: c.root.position.x, y: c.root.position.y, z: c.root.position.z },
        yaw: c.root.rotation.y,
        /* 발바닥 보정 — 클립마다 재서 넣은 값들(사람만 있다) */
        ground: c.ground || null
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

    /* ══ 가서 · 하고 · 끝난다 ═══════════════════════════════════════════
       view.actAt('banjiha-dresser:1', 'water', { onProgress, onArrive, onDone, onFail })
         → Promise<{ ok, kind, key, ms, instant?, reason? }>  (+ .cancel(사유))

       ★★ 순서가 이 함수의 전부다 — **연출 뒤에 논리**다.
         걸어간다 → 대상을 보고 선다 → 모션(게이지 0→1) → **그제야** onDone().
         취소되거나 캐릭터가 사라지면 onDone 은 **안 부른다**. 반쯤 준 물은 없다.
         실제 물주기·심기·수확은 onDone 안에서 게임이 한다. 이 파일은 규칙을 모른다.

       kind  'water' · 'sow' · 'harvest' — 그 밖의 이름은 던진다(잘못 부른 것이다)
       opt
         onProgress(p01, phase)  phase 'walk' 이면 걷는 어림 진행률, 'act' 면 **게이지**다.
                                 ★그리는 것은 game.html 몫이다. 여기서는 숫자만 낸다 —
                                   방 위에 링을 얹으면 카메라를 돌릴 때마다 게이지가 기울고,
                                   폰에서 40px 짜리 캐릭터 발밑에 든 링은 손가락에 가린다.
         onArrive()              모션이 시작될 때 한 번. 게이지를 띄울 순간이 여기다.
         onDone()                ★연출이 끝난 뒤. async 여도 된다 — 기다렸다가 끝낸다.
                                 여기서 던지면 그대로 밖으로 나간다(논리 오류는 안 감춘다).
         onFail(reason)          못 갔거나 취소됐을 때. onDone 은 안 불린다.
         instant:true            연출 없이 즉시. **빨리감기가 이걸 쓴다.**
         charId                  누가 할까. 기본은 고른 캐릭터, 없으면 'jachwi'.

       못 하면 어떻게 되나
         모르는 슬롯·모르는 kind          → **던진다**(프로그램이 잘못 부른 것이다)
         곁에 설 데가 없다 · 길이 막혔다   → { ok:false, reason } + onFail. 안 던진다.
         캐릭터가 아예 없다 · 방이 아직 없다 → instant 와 같은 길로 간다.
           ⚠ 여기서 실패로 만들면 사람이 없는 화면에서 게임이 통째로 막힌다.
             "못 하는 것"과 "안 보여주는 것"은 다르다.

       ⚠ setPaused(확대 화면) 중에는 **멈춘다**. 풀면 이어서 한다. 시계가 update(dt)
         하나뿐이라 그렇다 — 멈춘 화면 뒤에서 논리가 끝나면 안 되기 때문이다. */
    actAt(key, kind, opt) { return actAt(key, kind, opt); },
    /* 하던 동작을 취소한다. 취소하면 onDone 은 안 불린다. 취소할 게 있었으면 true. */
    cancelAct(reason) { return cancelAct(reason); },
    /* 지금 무엇을 하고 있나 — { kind, key, phase, p01 } · 없으면 null */
    actState() {
      return curAct ? { kind: curAct.kind, key: curAct.key, phase: curAct.phase,
                        p01: +curAct.p01.toFixed(3) } : null;
    },
    /* ★ 빨리감기 스위치. 켜면 actAt 이 연출을 통째로 건너뛰고 곧바로 논리를 돌린다.
       빨리감기를 켤 때 한 번, 끌 때 한 번 부르면 된다(호출마다 instant 를 넣어도 된다). */
    setActInstant(on) { actInstant = !!on; return actInstant; },
    isActInstant() { return actInstant; },
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
      /* ★ 광원까지 같이 꺼진다 (2026-08-08 · §⑧-e).
         ------------------------------------------------------------
         예전에는 여기서 **기구 메시만 숨겼다.** 광원 PointLight 는 house.js 가
         개별 가구 그룹이 아니라 `furnGroup`(방 전체 컨테이너)에 넣기 때문에
         (house.js §조명 기구 `furnGroup.add(L)`) 숨긴 뒤에도 계속 방을 밝히고 있었다.
         그래서 등을 0개로 두든 2개로 두든 **화면 평균 밝기가 같았다**(75.23 vs 75.26).
         지금은 lampIsOn 이 `g.visible` 을 보므로 applyDaylight 한 번으로 실제로 꺼진다. */
      applyDaylight();
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
      /* ★ 화면이 죽으면 논리도 안 돈다 — 하던 동작을 먼저 취소한다(반쯤 준 물은 없다) */
      cancelAct('방이 사라졌습니다');
      dropSkinTip();                       /* 무늬 알림·구독을 걷는다 (§방에도 무늬 잎이 난다) */
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
      clearFurnHighlight();
      clearGuideRings();
      clearGrid();
      clearFurnitureBlobs();
      disposeWalkGhost();
      for (const [, c] of chars) { try { c.dispose(); } catch (e) { /* 치우다 난 오류로 나머지를 못 치우면 안 된다 */ } }
      chars.clear();
      clearPlants(); clearRings();
      disposeOutside();
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
