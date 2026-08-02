/* ============================================================
   game/room_view.js — 방 3D 뷰 (폰 세로 전용 모듈)
   ------------------------------------------------------------
   게임 화면의 본체다. 방을 캔버스에 그리고, 슬롯에 화분을 놓고,
   탭을 밖으로 내보낸다. 게임 규칙·경제·성장은 하나도 모른다.

   만든 게 아니라 이어붙인 것이다. 방은 render3d/house.js 가 이미 짓고 있고
   조명은 render3d/scene.js 가 이미 하고 있다. 여기서 새로 만든 것은
     ① 폰 세로 화면에 맞는 카메라 프레이밍
     ② slotId 로만 다루는 화분 배치·이동
     ③ 탭 판정(플레이어가 화분을 만지는 유일한 통로)
     ④ 놀 때는 안 그리는 렌더 루프 (폰 배터리)
   넷뿐이다.

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
     onReady()           첫 프레임까지 다 그렸다
     onError(err)        조립·에셋 로딩이 깨졌다. ★ 조용히 넘기지 않는다
     orbit        돌리기·줌을 켤지. 기본 true
     maxPixelRatio 기본 1.75 (폰에서 2.0 은 픽셀이 두 배 넘게 든다)
============================================================ */
export async function createRoomView(canvas, opts = {}) {
  const O = {
    roomId: 'banjiha', lightEngine: null,
    onSlotTap: null, onPlantTap: null, onSlotHover: null, onReady: null, onError: null,
    orbit: true, maxPixelRatio: 1.75, ...opts
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

  const cam = { az: 0, el: BASE_EL_PORTRAIT, dist: 8, target: new THREE.Vector3(0, 1, 0), look: new THREE.Vector3() };
  let tween = null;            // { from, to, t0, ms }
  /* 플레이어가 만져 놓은 시점 — 방을 바꾸거나 화면이 돌아가도 유지한다 */
  let userYaw = 0;             // 기본 방위에서 튼 각(스냅되어 45° 배수)
  let userEl = null;           // 상하각. null 이면 화면 비율에 맞춘 기본값을 쓴다
  let zoomK = 1;               // fit 거리 대비 배율
  let fitDist = 8;             // 지금 화면 비율에서 방이 다 들어오는 거리

  let needsRender = true;      // 놀 때는 안 그린다
  let raf = 0;
  const stats = { fps: 0, frames: 0, drawn: 0, last: performance.now(), worstMs: 0 };
  let forceContinuous = false; // 데모/측정용

  /* ============================================================
     ① 방 조립
  ============================================================ */
  async function ensureData() {
    if (data) return data;
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

  async function assemble(id) {
    /* 이전 방 정리 */
    disposePreview();
    /* 캐릭터도 이 그룹에 들어 있다. 그냥 비우면 치워지지 않은 채 씬에서만 사라져
       mixer 와 GLB 가 그대로 남는다 — 방을 몇 번 바꾸면 그게 그대로 메모리다.
       치우되 **누가 있었는지는 기억해** 새 방에 다시 세운다. */
    const wasHere = [...chars.keys()];
    for (const [, c] of chars) { try { c.dispose(); } catch (e) { /* 나머지는 계속 치운다 */ } }
    chars.clear();
    clearPlants();
    clearRings();
    while (houseGroup.children.length) houseGroup.remove(houseGroup.children[0]);

    /* 가구 한글 이름표는 가볍다(수십 KB). lightEngine 을 받아 방을 안 짓는 경우에도
       자리 이름은 사람 말로 내줘야 하니 이것만 따로 읽는다. */
    if (!Object.keys(furnNames).length) {
      try { furnNames = await loadJSON(AT('../../data/furniture_presets.json')).then(d => d.presets || d); }
      catch (e) { console.warn('[방뷰] 가구 이름표를 못 읽었습니다 — 자리 이름이 영문 프리셋 id 로 나옵니다'); }
    }

    let wins;
    if (O.lightEngine && typeof O.lightEngine.build === 'function') {
      /* ★ 조도 계산과 같은 방을 그린다. 두 번 짓지 않는다(폰에서 조립 비용이 아깝다). */
      const r = O.lightEngine.build(id);
      built = r.built; roomDef = r.def; wins = r.wins;
    } else {
      const d = await ensureData();
      roomDef = (d.houseRooms.rooms || {})[id];
      if (!roomDef) throw new Error(`모르는 방: ${id}`);
      built = buildHouse(GRAIN, roomDef, d.winPresets, d.doorPresets, d.finishes,
                         d.furnPresets, d.lightPresets, d.shadePresets);
      wins = (built.luxWins || [])
        .map(w => winFromHouse(w.wall, w.cu, w.cy, w.w, w.h, built.size, w.tau, w.evScale, w.cz))
        .filter(Boolean);
    }
    if (!built || !built.room) throw new Error(`방 조립 결과가 비었습니다: ${id}`);

    roomId = id;
    houseGroup.add(built.room);

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
  async function buildPlantGroup(spec, s, days) {
    const kind = spec.kind || 'monstera';
    const p01 = clamp(spec.progress01 ?? 1, 0, 1);
    const limit = slotPotLimit(s);

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
      g = await buildPlantGroup(spec, s, days);
    } catch (e) {
      throw fail(new Error(`화분을 못 만들었습니다 (${slotId}): ${e.message}`));
    }
    if (disposed) { disposeObject(g); return null; }
    ownMaterials(g);

    /* ★ 자리에 들어가나 — 회전 무관 지름으로만 본다 */
    const limit = slotPotLimit(s);
    const d = rotationSafeDiameter(potPartOf(g), g);
    if (Number.isFinite(limit) && d > limit + 1e-4) {
      /* 여기서 조용히 놔두면 화분이 선반 밖으로 걸쳐진 채 게임이 돈다.
         자리에 맞게 줄이되, 줄였다는 사실은 반드시 남긴다. */
      const k = limit / d;
      g.scale.multiplyScalar(k);
      console.warn(`[방뷰] ${slotId}: 화분 회전무관 지름 ${d.toFixed(3)} > 자리 한도 ${limit} — ${(k * 100) | 0}% 로 줄였습니다`);
    }

    const hadPlant = plants.has(slotId);
    removePlant(slotId);
    g.position.set(s.x, s.y, s.z);
    /* ★ 돌려 놓은 각도는 형태가 바뀌어도 유지한다. 새로 놓는 것이면 0 부터.
       (Y 회전만 쓴다 — 눕히거나 기울이면 화분이 넘어진다) */
    if (!hadPlant && !plantYaw.has(slotId)) plantYaw.set(slotId, 0);
    g.rotation.y = plantYaw.get(slotId) || 0;
    g.userData.plantSlotId = slotId;
    g.traverse(o => { o.userData.plantSlotId = slotId; });
    applyLook(g, spec);
    houseGroup.add(g);
    plants.set(slotId, { group: g, spec: { ...spec }, potD: Math.min(d, limit),
                         days, wantDays: days, builtAt: performance.now() });
    if (preview && (preview.fromId === slotId || preview.toId === slotId)) refreshPreview();
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
    p.group.userData.plantSlotId = toId;
    p.group.traverse(o => { o.userData.plantSlotId = toId; });

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

  function highlightSlots(slotIds) {
    const want = new Set((slotIds || []).filter(id => slotById.has(id)));
    for (const [id, m] of [...rings]) {
      if (want.has(id)) continue;
      houseGroup.remove(m); disposeObject(m); rings.delete(id);
    }
    for (const id of want) {
      if (rings.has(id)) continue;
      const s = slotById.get(id);
      const r = clamp((Number.isFinite(s.maxPotD) ? s.maxPotD : 0.22) * 0.55, 0.05, 0.30);
      const m = new THREE.Mesh(new THREE.RingGeometry(r * 0.72, r, 24), ringMaterial());
      m.rotation.x = -Math.PI / 2;
      m.position.set(s.x, s.y + 0.004, s.z);
      m.renderOrder = 5;
      m.userData.highlightSlotId = id;
      m.userData.occupied = plants.has(id);
      houseGroup.add(m);
      rings.set(id, m);
    }
    for (const [id, m] of rings) {
      const occ = plants.has(id);
      m.userData.occupied = occ;
      m.material.color.setHex(occ ? 0x9fd0ff : 0xffd479);   // 찬 자리는 파랗게
    }
    highlighted = want;
    needsRender = true;
  }

  function pulseRings(now) {
    if (!rings.size) return false;
    const k = 0.42 + 0.32 * (0.5 + 0.5 * Math.sin(now / 320));
    for (const [, m] of rings) { m.material.opacity = k; m.scale.setScalar(1 + (k - 0.5) * 0.12); }
    return true;
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

  /* 화면에서 그 슬롯이 어디에 찍히나. 뒤에 있으면 null. */
  function slotScreenPos(s) {
    const r = canvas.getBoundingClientRect();
    tmp.set(s.x, s.y, s.z).project(ctx.cam);
    if (tmp.z > 1) return null;
    return { x: (tmp.x * 0.5 + 0.5) * r.width, y: (-tmp.y * 0.5 + 0.5) * r.height };
  }

  function pickAt(cx, cy) {
    /* 1) 화분은 덩치가 있으니 광선으로 정확히 잡는다 */
    if (plants.size) {
      ray.setFromCamera(ndcOf(cx, cy), ctx.cam);
      const hits = ray.intersectObjects([...plants.values()].map(p => p.group), true);
      if (hits.length) {
        let o = hits[0].object;
        while (o && !o.userData.plantSlotId) o = o.parent;
        if (o) return { type: 'plant', slotId: o.userData.plantSlotId };
      }
    }
    /* 2) 빈 슬롯은 점이라 광선으로는 손가락에 안 잡힌다 — 화면 거리로 가장 가까운 것.
       하이라이트 중이면 그 자리들만 본다(놓기 모드에서 엉뚱한 자리가 잡히지 않게). */
    const r = canvas.getBoundingClientRect();
    const px = cx - r.left, py = cy - r.top;
    const pool = highlighted.size ? [...highlighted] : [...slotById.keys()];
    let best = null, bestD = SLOT_HIT_PX;
    for (const id of pool) {
      const s = slotById.get(id); if (!s) continue;
      const p = slotScreenPos(s); if (!p) continue;
      const d = Math.hypot(p.x - px, p.y - py);
      if (d < bestD) { bestD = d; best = id; }
    }
    if (best) return { type: plants.has(best) ? 'plant' : 'slot', slotId: best };
    return null;
  }

  /* ── 포인터 ──
     폰   한 손가락 = 회전(손 떼면 8방 스냅) · 두 손가락 = 줌 · 탭 = 선택
     PC   좌드래그 = 회전 · 휠 = 줌 · 호버 = 자리 미리보기
     패닝은 넣지 않는다. 방은 고정 대상이라 옮길 이유가 없고, 있으면 길을 잃는다. */
  let down = null, dragging = false, pinch = 0;
  const canHover = !window.matchMedia || window.matchMedia('(hover: hover)').matches;
  let hoverId = null;

  const onDown = e => {
    const t = e.touches ? e.touches[0] : e;
    down = { x: t.clientX, y: t.clientY, t: performance.now(), az: cam.az, el: cam.el };
    dragging = false;
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
      pinch = dd; dragging = true; e.preventDefault();
      return;
    }
    const t = e.touches ? e.touches[0] : e;
    const dx = t.clientX - down.x, dy = t.clientY - down.y;
    if (!dragging && Math.hypot(dx, dy) < TAP_PX) return;
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
    const wasDrag = dragging, d0 = down;
    down = null; dragging = false;
    if (wasDrag) { settleCam(); return; }
    if (performance.now() - d0.t > TAP_MS) return;
    const hit = pickAt(d0.x, d0.y);
    if (!hit) return;
    try {
      if (hit.type === 'plant') O.onPlantTap && O.onPlantTap(hit.slotId);
      else O.onSlotTap && O.onSlotTap(hit.slotId);
    } catch (err) { fail(err); }
  };

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
  canvas.addEventListener('touchcancel', () => { down = null; dragging = false; pinch = 0; });
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

  function stepCharacters(now, force) {
    if (!chars.size) { lastCharAt = now; return false; }
    const dt = (now - lastCharAt) / 1000;
    if (!force && dt < 1 / CHAR_FPS) return false;
    lastCharAt = now;
    for (const [, c] of chars) {
      try { c.update(Math.min(dt, 0.1)); } catch (e) { fail(e); }
    }
    return true;
  }

  function loop(now) {
    if (disposed) return;
    raf = requestAnimationFrame(loop);
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
      /* 표본이 적으면 판정하지 않는다 — 몇 장 안 그린 구간은 '느린' 게 아니라 '안 바쁜' 것이다 */
      if (framesSince >= 20) { stats.fps = Math.round(framesSince * 1000 / (now - lastFpsAt)); autoQuality(); }
      framesSince = 0; lastFpsAt = now;
    }
  }

  /* 못 따라가면 해상도를 내린다. 무엇을 줄였는지 stats 에 남긴다. */
  let pxRatio = Math.min(O.maxPixelRatio, dpr);
  const PX_STEPS = [1.75, 1.5, 1.25, 1.0, 0.85];
  function autoQuality() {
    if (!forceContinuous && stats.fps > 0 && stats.fps < 55) {
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

  function previewMove(fromId, toId) {
    if (toId == null) { disposePreview(); return null; }
    const p = plants.get(fromId);
    if (!p) throw new Error(`미리보기할 화분이 없습니다: ${fromId}`);
    const to = slotOrThrow(toId);

    /* 이미 같은 화분의 복제가 있으면 **옮기기만** 한다 */
    if (preview && preview.fromId === fromId) {
      preview.toId = toId;
    } else {
      disposePreview();
      const g = p.group.clone(true);
      /* ★ 탭 판정에 안 걸리게 — 미리보기를 눌러 화분이 선택되면 안 된다.
         clone 은 userData 를 얕게 나눠 쓰므로 통째로 새로 만들어 끊는다. */
      g.userData = { ...p.group.userData, isPreview: true, plantSlotId: undefined };
      /* ★ potPart 는 **원본의** 화분을 가리킨다. 그대로 두면 자리 판정이 복제본이 아니라
         원본을 원본과 다른 기준 좌표계로 재게 되어 늘 "안 들어간다"가 나온다(실제로 그랬다).
         복제본 안에서 다시 찾는다. */
      g.userData.potPart = null;
      g.traverse(o => { if (!g.userData.potPart && o.userData && o.userData.assetKey === 'pot') g.userData.potPart = o; });
      if (!g.userData.potPart) g.userData.potPart = null;   // 없으면 potPartOf 의 옛 규칙으로 내려간다
      /* ★ 복제는 기하를 원본 화분과 **통째로 나눠 쓴다.** 미리보기를 지울 때
         geometry.dispose() 를 부르면 제자리에 있던 진짜 화분이 사라진다(실제로 그런다).
         전부 '공유'로 표시해 disposeObject 가 건너뛰게 한다. */
      g.traverse(o => { o.userData = { ...o.userData, plantSlotId: undefined, isPreview: true, sharedGeometry: true }; });

      /* 반투명 · 그림자 없음 · 윤곽선. decorate.js 고스트와 같은 값. */
      const gm = new THREE.MeshBasicMaterial({ color: GH_OK, transparent: true,
                                               opacity: 0.28, depthWrite: false });
      const gl = new THREE.LineBasicMaterial({ color: GH_OK, transparent: true, opacity: 0.9,
                                               depthTest: false });
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
      /* 바닥(자리)에 링 — decorate.js 의 marker 와 같은 모양 */
      const marker = new THREE.Mesh(
        new THREE.RingGeometry(0.28, 0.36, 28),
        new THREE.MeshBasicMaterial({ color: GH_OK, transparent: true, opacity: 0.85,
                                      side: THREE.DoubleSide, depthTest: false }));
      marker.rotation.x = -Math.PI / 2;
      marker.renderOrder = 999;
      houseGroup.add(marker);
      houseGroup.add(g);
      preview = { fromId, toId, group: g, marker, mat: gm, line: gl, ok: null };
    }

    /* 위치·회전·크기는 **실제로 놓일 그대로** */
    preview.group.position.set(to.x, to.y, to.z);
    preview.group.rotation.y = p.group.rotation.y;
    preview.group.scale.copy(p.group.scale);
    const r = clamp((Number.isFinite(to.maxPotD) ? to.maxPotD : 0.22) * 1.5, 0.12, 0.55);
    preview.marker.scale.setScalar(r / 0.32);
    preview.marker.position.set(to.x, to.y + 0.004, to.z);

    const ok = fitsInSlot(preview.group, to);
    if (ok !== preview.ok) {
      preview.ok = ok;
      const hex = ok ? GH_OK : GH_NG;
      preview.mat.color.setHex(hex);
      preview.line.color.setHex(hex);
      preview.marker.material.color.setHex(hex);
    }
    needsRender = true;
    return { fromId, toId, ok };
  }

  /* 화분이 다시 조립됐을 때 미리보기도 그 모습으로 따라간다 */
  function refreshPreview() {
    if (!preview) return;
    const { fromId, toId } = preview;
    disposePreview();
    if (plants.has(fromId) && slotById.has(toId)) { try { previewMove(fromId, toId); } catch (e) { /* 사라진 자리 */ } }
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
  /* 창을 보고 서되 방 쪽으로 이만큼 튼다. 정면으로 창만 보면 플레이어는 늘 뒤통수만 본다. */
  const FACE_TURN = 0.60;       // 약 34°

  function blockedAt(x, z, r) {
    for (const c of (built.colliders || [])) {
      const rot = c.rot || 0, co = Math.cos(-rot), si = Math.sin(-rot);
      const lx = (x - c.x) * co - (z - c.z) * si;
      const lz = (x - c.x) * si + (z - c.z) * co;
      if (Math.abs(lx) < c.w / 2 + r && Math.abs(lz) < c.d / 2 + r) return true;
    }
    return false;
  }

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
    /* 창 쪽을 보되 방 안쪽으로 조금 튼다. 캐릭터 기본이 뒷모습이라 π 를 더한다
       (char-to-house.md "캐릭터는 기본 방향이 뒷모습입니다"). */
    const toWin = Math.atan2(spot.wx - spot.x, spot.wz - spot.z);
    const toRoom = Math.atan2(-spot.x, -spot.z);
    let d = ((toRoom - toWin + Math.PI) % (Math.PI * 2)) - Math.PI;
    root.rotation.y = toWin + d * FACE_TURN + Math.PI;
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

    /* idle 을 돌리다 8~20초마다 변주를 한 번 끼운다. 끝자세=시작자세인 클립만
       배정표에 들어 있어 crossfade 0.3s 면 안 튄다. */
    const pool = IDLE_BREAK[id] || [];
    let timer = 0, alive = true;
    const clips = {};
    function schedule() {
      if (!alive || !pool.length) return;
      timer = setTimeout(async () => {
        if (!alive) return;
        const name = pool[(Math.random() * pool.length) | 0];
        try {
          if (!clips[name]) {
            const c = await charLoad(`${CHAR_ANIM}/char_${id}_${name}.glb`);
            const cl = (c.animations || [])[0];
            if (!cl) throw new Error('클립 없음');
            cl.name = name; clips[name] = cl;
          }
          if (!alive) return;
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
      kind: 'person', assetId: id, root,
      update(dt) {
        mixer.update(dt);
        if (hips && hips0) { hips.position.x = hips0[0]; hips.position.z = hips0[1]; }
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
    model.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
      if (o.material && o.material.map) o.material.map.encoding = THREE.sRGBEncoding;
    });
    const root = new THREE.Group();
    root.add(model);
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
      kind: 'mascot', assetId: 'mascot_sprout', root,
      update(dt) {
        t += dt;
        const g2 = homeXZ();
        /* 수평 추적은 프레임레이트 무관하게(char-to-house.md) */
        pos.lerp(new THREE.Vector3(g2.x, MON.floatHeight, g2.z), 1 - Math.exp(-MON.followDamping * dt));
        root.position.x = pos.x; root.position.z = pos.z;
        root.position.y = MON.floatHeight + Math.sin(t * Math.PI * 2 / MON.bobPeriod_sec) * MON.bobAmplitude;
        root.rotation.z = Math.sin(t * Math.PI * 2 / MON.bobPeriod_sec) * (MON.tiltDegrees * Math.PI / 180);
        root.rotation.y += (Math.PI - root.rotation.y) * Math.min(1, dt * 2);
      },
      dispose() { houseGroup.remove(root); disposeObject(root); }
    };
  }

  /* 놓기·치우기. 자리·포즈는 안에서 정한다 — 밖에서 좌표를 주지 않는다. */
  let charSeq = 0;
  async function setCharacter(who, opt = {}) {
    const my = ++charSeq;
    if (who == null) {                                  // null 이면 놓인 것을 전부 치운다
      for (const [k, c] of [...chars]) { c.dispose(); chars.delete(k); }
      needsRender = true;
      return null;
    }
    const key = who === 'moni' ? 'moni' : 'jachwi';
    const old = chars.get(key);
    if (old) { old.dispose(); chars.delete(key); needsRender = true; }
    let c;
    try {
      c = who === 'moni' ? await makeMascot() : await makePerson(who);
    } catch (e) {
      throw fail(new Error(`캐릭터를 못 놓았습니다 (${who}): ${e.message}`));
    }
    if (disposed || my !== charSeq) { c.dispose(); return null; }
    chars.set(key, c);
    needsRender = true;
    return c.root;
  }

  /* ============================================================
     ⑩ 자리로 들어가기
  ============================================================ */
  function focusSlot(slotId, snap) {
    if (slotId == null) { frameRoom(!!snap); return; }
    const s = slotOrThrow(slotId);
    focused = slotId;
    const p = plants.get(slotId);
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
    /* ★ 화분을 세로축으로 돌린다. Y 회전만 — 눕히거나 기울이면 화분이 넘어진다.
       회전무관 지름(2×max√(x²+z²))은 Y 회전에 불변이라 maxPotD 판정이 안 바뀐다.
       다시 조립돼도(진행도가 바뀌어 새로 지어도) 각도는 유지된다. */
    setPlantYaw(slotId, rad) {
      slotOrThrow(slotId);
      const y = Number.isFinite(+rad) ? +rad : 0;
      plantYaw.set(slotId, y);
      const p = plants.get(slotId);
      if (p) p.group.rotation.y = y;
      if (preview && preview.fromId === slotId) preview.group.rotation.y = y;
      needsRender = true;
      return y;
    },
    plantYaw(slotId) { return plantYaw.get(slotId) || 0; },
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
        occupied: plants.has(s.slotId),
        maxPotD: Number.isFinite(s.maxPotD) ? s.maxPotD : null
      }));
    },
    /* ★ 계약에 없지만 필요해서 더한 것들 — 아래 셋은 배치 UI 가 '미리' 물어보는 통로다 */
    /* 그 자리에 이 화분이 들어가나. 회전 무관 지름으로 본다 */
    fitCheck(slotId, plantOrDiameter) {
      const s = slotOrThrow(slotId);
      const limit = slotPotLimit(s);
      let d = null;
      if (typeof plantOrDiameter === 'number') d = plantOrDiameter;
      else if (plantOrDiameter && plantOrDiameter.kind)
        d = plantOrDiameter.kind === 'beansprout' ? SIRU_D : MONSTERA_POT_D;
      else if (plants.has(slotId)) d = rotationSafeDiameter(potPartOf(plants.get(slotId).group), plants.get(slotId).group);
      return { slotId, maxPotD: Number.isFinite(limit) ? limit : null, diameter: d,
               ok: d == null ? null : !Number.isFinite(limit) || d <= limit + 1e-4 };
    },
    plantDiameter(slotId) {
      const p = plants.get(slotId);
      return p ? rotationSafeDiameter(potPartOf(p.group), p.group) : null;
    },
    /* ★ 그 자리가 화면 어디에 찍히나 — 뒤에 있으면 null.
       ★★ 좌표계는 **캔버스 기준 CSS 픽셀**이다(뷰포트 기준이 아니다).
          캔버스 왼쪽 위가 (0,0) 이고 오른쪽 아래가 (캔버스 CSS 폭, 높이) 다.
          뷰포트 좌표가 필요하면 canvas.getBoundingClientRect() 의 left/top 을 더하십시오.
          (드래그 중 마우스 좌표와 비교할 때 이 보정을 빼먹으면 자리가 어긋난다) */
    screenPosOf(slotId) {
      const s = slotById.get(slotId);
      return s ? slotScreenPos(s) : null;
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
        id, kind: c.kind, assetId: c.assetId,
        pos: { x: c.root.position.x, y: c.root.position.y, z: c.root.position.z },
        yaw: c.root.rotation.y
      }));
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
      disposePreview();
      for (const [, c] of chars) { try { c.dispose(); } catch (e) { /* 치우다 난 오류로 나머지를 못 치우면 안 된다 */ } }
      chars.clear();
      clearPlants(); clearRings();
      disposeObject(ctx.scene);
      ctx.renderer.dispose();
    }
  };

  /* ── 시작 ── */
  try {
    /* 몬스테라 GLB 는 14MB 다. 방을 짓는 동안 같이 받아 두지 않으면 첫 화분에서
       그만큼 멈춘다. 기다리지는 않는다 — 실패해도 방은 떠야 한다. */
    assembler();
    resize();
    await assemble(O.roomId);
    resize();
    applyDaylight();
    updateCam();
    ctx.renderer.render(ctx.scene, ctx.cam);
    raf = requestAnimationFrame(loop);
    try { O.onReady && O.onReady(view); } catch (e) { fail(e); }
  } catch (e) {
    fail(e);
    throw e;         // ★ 조용히 반쯤 살아 있는 뷰를 돌려주지 않는다
  }

  return view;
}
