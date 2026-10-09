/* ============================================================
   render3d/furniture_dress.js — 보이는 층 v2 · 가구에 «옷» 입히기 (그림만)
   ------------------------------------------------------------
   무엇: 코드로 지은 가구(furniture_pastel) 위에 생성 GLB 를 옷처럼 입힌다.
         방 소품(러그·빨래통·난로·쓰레기·가방·건조대)도 여기서 놓는다.

   ★ 옛 상자는 버리지 않는다 — 보이지 않는 «대리»로 남아 광선을 받는다.
     재질만 visible:false 인 한 벌로 바꾼다(g.visible·colorWrite·투명은 안 건드린다).
       · Raycaster 는 층(layers)만 본다 → 대리가 그대로 맞는다
         ⇒ 배치·상판 칸·앉기/눕기 높이(surfaceTopAt)·가구 집기가 한 톨도 안 바뀐다
       · 그리기 목록과 그림자 패스는 material.visible 을 본다 → 대리는 안 그려진다
   ★ GLB 는 층 1 에만 둔다. 카메라가 층 1 을 켜니 보이고, 광선(층 0)은 안 맞는다.
     그림자 패스는 «주 카메라»의 층으로 거른다(r128 WebGLShadowMap) → 그림자도 던진다.
   ★ 윗면 맞추기 — 화분 자리(userData.slots) 높이에서 GLB 윗면을 재서 세로 배율을 정한다.
     자리가 없는 것(침대·의자)은 대리의 윗면(이불·좌판)을 재서 맞춘다. 가로·깊이는
     userData.size 발자국에 맞춘다(충돌·접지 그림자·칸과 같은 판).
   ⚠ g.userData 는 한 글자도 안 건드린다 — 조도·충돌·자리의 정본이다.
     (userData 는 clone 때 JSON 으로 복사되므로 재질 같은 참조도 안 넣는다 → WeakMap)
   ⚠ 소품은 houseGroup 에 따로 둔다. built.room/furniture 에는 안 넣는다.
     놓인 화분·옮긴 가구와 겹치면 소품이 비켜 준다(숨는다) — 판정은 안 바꾼다.
   ⚠ Node(test_snap)에서도 import 된다 — 맨 위에서 THREE·window 를 만지지 않는다.

   끄기: ?v2=0 (v2 전부) · ?v2furn=0 · localStorage v2='0' / v2furn='0'
         돌면서 끄고 켜기: window.__v2.furn.set(false|true)
============================================================ */

const ASSET = p => new URL('../../assets/v2/' + p, import.meta.url).href;

/* ── v2 스위치 한 벌 (다른 v2 창과 같은 규약) ── */
export function v2Enabled(key) {
  try {
    const q = new URLSearchParams((typeof location !== 'undefined' && location.search) || '');
    let ls = null;
    try { ls = typeof localStorage !== 'undefined' ? localStorage : null; } catch (_) { ls = null; }
    if (q.get('v2') === '0' || (ls && ls.getItem('v2') === '0')) return false;
    if (key) {
      const v = q.get(key);
      if (v != null) return v !== '0';
      if (ls && ls.getItem(key) === '0') return false;
    }
  } catch (_) { /* 창이 없는 환경 — 기본 켬 */ }
  return true;
}

/* ── 프리셋 → 옷 ─────────────────────────────────────────────
   yaw 는 GLB 를 몇 도 돌려야 «앞이 +Z» 가 되나(빌더 규약: 헤드보드·등받이 −Z,
   서랍 손잡이 +Z). 스크린샷으로 확인한 값이다.
   probes 는 윗면을 잴 점(발자국 비율 u,v · 0..1). 자리(slots)가 있으면 자리를 쓴다. */
const FURN = {
  bed_single: { file: 'furniture/bed.glb', yaw: 0,
                probes: [[0.5, 0.55], [0.5, 0.7], [0.3, 0.62], [0.7, 0.62], [0.5, 0.85]] },
  desk:       { file: 'furniture/desk.glb', yaw: 0 },
  chair:      { file: 'furniture/chair.glb', yaw: 0, probes: [[0.5, 0.6], [0.4, 0.66], [0.6, 0.66]] },
  dresser:    { file: 'furniture/drawer.glb', yaw: 0 },
  /* 협탁 r2(10-10 · Higgsfield 원화 k2 → Tripo standard) — 옛 cabinet.glb 는 방 안에서도 갈색 상자로 보였다(서랍이 안 읽힘) */
  nightstand: { file: 'furniture/nightstand_r2.glb', yaw: -90 },   // Tripo 가 서랍을 +X 로 냈다 → 앞(+Z)으로
  /* ★ 2026-10-04 — 소품이 «진짜 가구»가 됐다(박사님 「진짜 가구로」 · [house] 프리셋·uid·크기).
       크기를 GLB 실측 비율 × k 로 뽑았으므로 uniform — 세로도 가로·깊이와 같은 배율(찌그러지지 않게).
       yaw 0: 그림의 방향은 방 정의의 rot 에 들어 있다([house]).
       lazy: 부팅 «미리 받기»에 안 넣는다(난방기 3MB·건조대 1.7MB — 폰 첫 화면을 안 늦춘다). 방이 뜬 뒤 받아 입힌다. */
  drying_rack: { file: 'props/drying_rack.glb', yaw: 0, uniform: true, lazy: true },
  heater:      { file: 'props/heater.glb',      yaw: 0, uniform: true, lazy: true },
  trash:       { file: 'props/trash.glb',       yaw: 0, uniform: true, lazy: true },
  backpack:    { file: 'props/backpack.glb',    yaw: 0, uniform: true, lazy: true },
  /* ★ 2026-10-09 — Meshy 주문표 house 몫(docs/handoff/meshy-plan-20261008.md · [house]).
       방에 처음부터 있는 것이 아니라 가구점에서 사는 것이라 lazy(놓였을 때만 받는다).
       yaw: Meshy 가 «앞 = +Z» 로 내보냈다 — 원화의 앞 방향과 상관없다(가구 13점을 한 장에 찍어 봄 · 10-09).
       크기는 프리셋 그대로(가구점 값) · 가로·깊이는 발자국에, 세로는 자리/대리 윗면에 맞춘다(위 dressOne). */
  plant_pedestal: { file: 'furniture/plant_pedestal.glb', yaw: 0, lazy: true },
  low_table:      { file: 'furniture/low_table.glb',      yaw: 0, lazy: true },
  wardrobe:       { file: 'furniture/wardrobe.glb',       yaw: 0, lazy: true },
  mattress:       { file: 'furniture/mattress.glb',       yaw: 0, lazy: true, probes: [[0.5, 0.5], [0.3, 0.6], [0.7, 0.6]] },
  sofa:           { file: 'furniture/sofa.glb',           yaw: 0, lazy: true, probes: [[0.3, 0.58], [0.7, 0.58]] },   // 좌석 쿠션 윗면
  cube_storage:   { file: 'furniture/cube_storage.glb',   yaw: 0, lazy: true },
  /* 겹단 — 단마다 제 판에 맞춘다(tierFracs) */
  shelf_cart_3tier:   { file: 'furniture/shelf_cart_3tier.glb',   yaw: 0, lazy: true, tiers: true },
  shelf:              { file: 'furniture/bookshelf.glb',          yaw: 0, lazy: true, tiers: true },
  shelf_corner_3tier: { file: 'furniture/shelf_corner_3tier.glb', yaw: 90, lazy: true, tiers: true },  // 직각 꼭짓점이 뒤-왼(판 무게중심으로 맞춤)
  clothes_rack:       { file: 'furniture/clothes_rack.glb',       yaw: 0, lazy: true, box: true },
  laundry_basket:     { file: 'props/laundry.glb',                yaw: 0, lazy: true, box: true },   // 이미 뽑아 둔 v2 소품(빨래 든 바구니)
  tv_crt:             { file: 'props/monitor.glb',                yaw: 0, lazy: true, uniform: true }, // 총괄 D44 — 브라운관 TV(크기를 GLB 비율로 뽑아 uniform)
  /* r3(회색 상자 참조) — 원화를 코드 가구 그림으로 박아 단 수·자리가 맞는다 · 겹단 꺾은 선 */
  plant_step_3:       { file: 'furniture/plant_step_3.glb',       yaw: 0, lazy: true, tiers: true },
  shelf_ladder_4tier: { file: 'furniture/shelf_ladder_4tier.glb', yaw: 0, lazy: true, tiers: true, fitProxyBox: true },
  greenhouse_cabinet: { file: 'furniture/greenhouse_cabinet.glb', yaw: 0, lazy: true, tiers: true, keepGlass: true },
  /* 가구점 v2 아홉(10-09 · docs/handoff/house-shop-v2-order-20261009.md · 회색 상자 길) — 색 바꿈 열넷은 specOf 로 따라온다.
       다단 선반은 반지하 첫 방에 처음부터 있어 lazy 아님(부팅에 받는다 · 첫 화면에 코드 상자가 안 보이게).
       암체어·바닥 쿠션은 GLB 비율이 프리셋과 달라(×1.3 · ×1.2) uniform — 프리셋 크기(=가게 값)는 안 건드린다 */
  shelf_etagere_3tier: { file: 'furniture/shelf_etagere_3tier.glb', yaw: 90, tiers: true },   // GLB 가 Z 로 길다(X 0.63 · Z 1.81)
  stool:               { file: 'furniture/stool.glb',               yaw: 0, lazy: true, tintAll: true },   // 색 변형은 앉음판까지 통째로
  shelf_stool_1:       { file: 'furniture/shelf_stool_1.glb',       yaw: 0, lazy: true },
  chair_arm:           { file: 'furniture/chair_arm.glb',           yaw: 0, lazy: true, uniform: true },
  coffee_table:        { file: 'furniture/coffee_table.glb',        yaw: 0, lazy: true, tiers: true },
  table_round:         { file: 'furniture/table_round.glb',         yaw: 0, lazy: true },
  shelf_low:           { file: 'furniture/shelf_low.glb',           yaw: 0, lazy: true, tiers: true },
  floor_cushion:       { file: 'furniture/floor_cushion.glb',       yaw: 0, lazy: true, uniform: true },
  storage_box:         { file: 'furniture/storage_box.glb',         yaw: 0, lazy: true },
  /* 10-10 Higgsfield 3D(Tripo standard · 가장 긴 변을 1.0 으로 낸다 — yaw·축척은 GLB 마다 잼) */
  bench:               { file: 'furniture/bench.glb',               yaw: 0, lazy: true },
  shop_display:        { file: 'furniture/shop_display.glb',        yaw: -90, lazy: true, tiers: true },  // GLB 가 Z 로 길다(0.62 × 1.0) · +90 이면 앞뒤가 뒤집힌다(앞단 +0.49m)
  order_board:         { file: 'furniture/order_board.glb',         yaw: -90, lazy: true, box: true },    // 가게 주문판(벽 걸이 · 걸이 자리 only) — GLB 가 X 로 얇다(0.16 × 1.0) · +90 이면 뒷면이 방을 본다
  /* 식물등 — 몸통만 옷(LED 는 코드 것 · dressLamp). lazy — 부팅 미리 받기를 안 늘린다(방이 뜬 뒤 입는다) */
  /* 러그 — GLB 가 아니라 «윗면 그림»(topTex · 10-10 · Higgsfield 위에서 본 그림 · 둘레 흰 바탕은 투명으로 · tools/tex_rug_cutout.py).
       1.2cm 깔개라 3D 를 뽑으면 눌려 무늬만 남는다 — 처음부터 무늬만. 코드 러그(대리)는 숨기고 발자국 크기 판 하나를 윗면에 깐다 */
  rug:               { topTex: 'textures/rug/rug.webp' },
  rug_mint:          { topTex: 'textures/rug/rug_mint.webp' },
  rug_check_butter:  { topTex: 'textures/rug/rug_check_butter.webp' },
  rug_leaf_sage:     { topTex: 'textures/rug/rug_leaf_sage.webp' },
  rug_runner_stripe: { topTex: 'textures/rug/rug_runner_stripe.webp' },
  /* 벽 걸이 v1(10-10 · 걸이 자리) — 코드 그림의 artFace 면에만 Higgsfield 그림을 입힌다(종이·테이프·틀은 코드 그대로).
       엽서는 코드 카드 셋을 숨기고 투명 그림 한 장(hideOthers) · 달력은 계절마다 쪽(faceTexSeason · setSeason) */
  poster_monstera:     { faceTex: 'textures/wall/poster_monstera.webp' },
  poster_seaside:      { faceTex: 'textures/wall/poster_seaside.webp' },
  poster_windowcat:    { faceTex: 'textures/wall/poster_windowcat.webp' },
  poster_mountain:     { faceTex: 'textures/wall/poster_mountain.webp' },
  poster_moon:         { faceTex: 'textures/wall/poster_moon.webp' },
  poster_fruit:        { faceTex: 'textures/wall/poster_fruit.webp' },
  poster_plantshelf:   { faceTex: 'textures/wall/poster_plantshelf.webp' },
  poster_shapes:       { faceTex: 'textures/wall/poster_shapes.webp' },
  poster_rainyalley:   { faceTex: 'textures/wall/poster_rainyalley.webp' },
  frame_field:         { faceTex: 'textures/wall/frame_field.webp' },
  frame_tinymonstera:  { faceTex: 'textures/wall/frame_tinymonstera.webp' },
  frame_dog:           { faceTex: 'textures/wall/frame_dog.webp' },
  frame_pressedflower: { faceTex: 'textures/wall/frame_pressedflower.webp' },
  postcards:           { faceTex: 'textures/wall/postcards.webp', hideOthers: true },
  calendar_season:     { faceTexSeason: { spring: 'textures/wall/calendar_spring.webp', summer: 'textures/wall/calendar_summer.webp',
                                          autumn: 'textures/wall/calendar_autumn.webp', winter: 'textures/wall/calendar_winter.webp' } },
  growlight_clip:     { file: 'furniture/growlight_clip.glb',     yaw: 0,  lazy: true, lamp: { band: 0.6 } },
  growlight_stand:    { file: 'furniture/growlight_stand.glb',    yaw: 90, lazy: true, lamp: { band: 0.8 } }
};
/* ── 문 옷 (2026-10-09 · [house]) — 가구가 아니라 집 껍데기(house.js buildDoor · door.userData.doorPreset) ──
   경첩 묶음(piv) 안의 문 그룹에 단다 → 여닫이와 같이 돈다 · 벽 그룹 안이라 컷어웨이(setShadowOnly)가 같이 옅게 한다.
   앞(+Z) = 손잡이 쪽(buildDoor 손잡이 z +0.07 · Meshy 도 앞을 +Z 로 냈다). 크기는 문 구멍 w×h × 문틀 깊이 그대로. */
const DOORS = {
  door_wood: { file: 'house/door_wood.glb', yaw: 0 }
};
/* 창틀 — 벽의 trims 그룹(house.js trimOf)에 있다. 벽이 내려가면 trims 가 통째로 숨어(visible) 옷도 같이 숨는다.
   유리(makeGlassPane)는 창틀 그룹 밖이라 그대로 · 빛은 코드 창 구멍으로만 든다 — GLB 는 틀 그림만.
   ⚠ 넣기 전에 «보이는 유리 = 빛 드는 유리»를 쟀다(정면 광선 · 원룸 76.0% / 코드 76.6% · 살 ×0.97~1.16 · 10-09). */
const WINS = {
  win_studio_cross: { file: 'house/win_studio_cross.glb', yaw: 0 },
  /* 반지하 창 — 3D 에서 세로살 ×1.22~1.31 · 보이는 유리 94%(정한 줄 +25% · 95% 바로 밑). 총괄 D38 «넣는다»(10-09 · 박사님 «묻지 말고 진행»)
     후보였던 것: 넣음 / 코드 유지 / r4. 사진 docs/handoff/img/house_20261009/win_banjiha_code_vs_v2_pending.png */
  win_semi_letterbox: { file: 'house/win_semi_letterbox.glb', yaw: 0 }
};
/* ── 가구 위 소품 (2026-10-09 · [house] · 총괄 «v2 소품 잇기») ──
   이미 뽑아 둔 v2 소품(노트북·컵라면 · 인형·시계 · 밥솥·주전자)을 **가구 상판 위**에 얹는다. 바닥 소품(PROPS)과 달리
   가구 그룹의 자식이라 가구를 옮기면 같이 간다 · 그 상판에 화분을 놓으면 겹치는 소품만 숨는다(§yieldTo) · 그림만(광선 층 1).
   열쇠: 'uid:<가구 uid>' 는 그 방 그 가구만(반지하 첫 방 생활감 · 키프레임 a) · 'preset:<프리셋>' 은 그 프리셋 어디서나.
   u,v = 발자국 안 자리(0..1 · 가구 앞 +Z) · h = 소품 높이(m · 비율 그대로) · yaw = 도. */
const DECOR = {
  'uid:banjiha-desk':    [{ id: 'desk_set',    file: 'props/desk_set.glb',    u: 0.80, v: 0.30, h: 0.20, yaw: 0 }],
  'uid:banjiha-dresser': [{ id: 'plush_clock', file: 'props/plush_clock.glb', u: 0.28, v: 0.32, h: 0.24, yaw: 0 }],
  /* 주방 카운터는 v2 몸이 없다(Meshy kitchen.glb 는 밥솥·주전자다) — 몸은 코드 그대로, 위에 살림만 */
  'preset:kitchen':      [{ id: 'kitchen',     file: 'props/kitchen.glb',     u: 0.74, v: 0.45, h: 0.26, yaw: 0 }]   // 싱크(u 0.28) 반대쪽
};
/* 옷을 안 입히고 색만 바꾸는 것 — 단·자리 계약이 걸려 있다(3단 선반·창턱 받침) */
const RESTYLE = {
  shelf_etagere: { board: 0xc9cccd, post: 0xa9aeb1, rough: 0.5, metal: 0.12 },   // 옅은 회색 칠한 쇠
  shelf_wall:    { board: 0xd8c29c, post: 0xb49a74, rough: 0.7, metal: 0.0 }     // 따뜻한 칠 나무
};

/* ── 소품 자리 (반지하) ──────────────────────────────────────
   x,z 는 방 좌표(m) · yaw 는 도 · h 는 높이(m, 비율 그대로 줄인다).
   ★ 왜 여기인가 (화분 판정은 floor_nav.blocked — 벽·가구 발자국에서 화분 반지름 밖이면
     바닥 어디든 놓인다. 그래서 «놓을 수 없는 바닥»은 가구 밑뿐이다):
       빨래통   책상 밑 오른쪽 — 가구 발자국 안이라 화분이 못 오는 칸
       난로     침대 발치 · 왼벽에 붙여 — 걷는 길(문→방 가운데) 밖
       쓰레기   문 왼쪽 구석 · 가방·신발 문 오른쪽 앞벽 — 문 폭(x −2.05~−1.15)은 비운다
       건조대   침대 머리맡과 3단 선반 사이 창 밑 — 선반 앞에 서는 자리를 안 막는다
       러그     방 가운데 빈 바닥 — 밟고 지나가고 화분도 올라간다(납작해서 바닥으로 친다)
     ⚠ 벽 곁·구석도 화분이 놓일 수는 있다 — 그래서 **놓인 화분·옮긴 가구와 겹치면 소품이
       숨는다**(yieldTo). 판정·길찾기는 소품을 모른다(그림뿐). */
const PROPS = {
  banjiha: [
    // v2 합치기 검토: 러그 그림이 흰 테두리째 비스듬한 제품 사진이라 뺀다 — 알파 있는 위에서 본 그림이 생기면 되살린다
    // { id: 'rug',     rug: true, x: -0.35, z: 0.78, w: 1.5, d: 1.0, yaw: 0 },
    // v2 합치기 검토: 책상 발치를 삐져나와 뺀다
    // { id: 'laundry', file: 'props/laundry.glb',     x: 1.70,  z: -1.50, yaw: 0,   h: 0.30 },
    /* ★ 2026-10-04 — 넷 다 «진짜 가구»가 된다([house] house_rooms §banjiha). 방 정의에 같은 프리셋이 있으면
         여기 그림은 안 놓는다(두 벌 방지 · 집 창 커밋과 어느 쪽이 먼저 들어와도 된다). 가구가 다 들어오면 지운다. */
    { id: 'heater',  file: 'props/heater.glb',      x: -2.19, z: 0.52,  yaw: 90,  h: 0.50, preset: 'heater' },
    { id: 'trash',   file: 'props/trash.glb',       x: -2.21, z: 1.53,  yaw: 0,   h: 0.40, preset: 'trash' },
    { id: 'backpack',file: 'props/backpack.glb',    x: -0.72, z: 1.64,  yaw: 90,  h: 0.36, preset: 'backpack' },
    { id: 'rack',    file: 'props/drying_rack.glb', x: -1.10, z: -1.42, yaw: 90,  h: 0.72, preset: 'drying_rack' }
  ],
  /* ★ 2026-10-10 [house] 가게 입간판(plan D59 단골 10명 보상) — flag 가 켜질 때만(view.setShopSign). 투룸은 5층이라 창밖이 아니라
       가게 방 안 문(앞벽 x −2.4) 오른쪽 옆 바닥 — 앞벽은 기본 카메라에서 깎여 그 자리가 보인다 · 문 앞 길(몸 반지름 0.38)은 비켰다 */
  tworoom: [
    { id: 'shop_sign', file: 'furniture/shop_sign_aframe.glb', x: -1.62, z: 1.98, yaw: 0, h: 0.85, flag: 'shopSign' }
  ]
};

const LAYER = 1;
const deg = d => d * Math.PI / 180;

export function createFurnitureDress(opt = {}) {
  const T = globalThis.THREE;
  let on = v2Enabled('v2furn');
  const loadGLB = opt.loadGLB;
  const furnK = typeof opt.furnK === 'function' ? opt.furnK : () => 0.78;
  const onChange = typeof opt.onChange === 'function' ? opt.onChange : () => {};
  if (opt.cam && opt.cam.layers) opt.cam.layers.enable(LAYER);

  const tpl = new Map();        // file → { scene, box(yaw별), ok } · 한 번만 받는다
  const loading = new Map();    // file → Promise
  const measure = new Map();    // file|yaw|u|v → 높이 비율
  const origMat = new WeakMap();// 대리 메시 → 원래 재질
  const report = new Map();     // uid → 맞춤 결과(진단용)
  let hideMat = null, restyleMats = null, rugMat = null, rugTex = null;
  const rugGeo = new Map();
  let cur = { built: null, roomDef: null, parent: null, roomId: null };
  let propGroup = null, propList = [], propsWanted = false;
  let lastColliders = null, disposed = false;
  /* ★ 잠시 벗기(held) — 빛 분포를 켠 동안. 칸은 «대리 상자 윗면»에 칠해지는데 옷(GLB)은 모양이 달라
       칸이 옷 속에 묻히거나 조각만 삐져나왔다(박사님 폰 · 2026-10-04 「빛분포가 듬성듬성」).
       ⇒ 그동안은 조도가 실제로 보는 상자를 보여 준다. on(사람이 켠 v2)과 따로 둔다 — 끄면 그대로 되돌린다. */
  let held = false;

  const hidden = () => hideMat || (hideMat = new T.MeshBasicMaterial({ visible: false }));

  /* ── GLB 받기 ── */
  function load(file) {
    if (tpl.has(file)) return Promise.resolve(tpl.get(file));
    if (loading.has(file)) return loading.get(file);
    let p;
    try {
      p = Promise.resolve(loadGLB(ASSET(file)));
    } catch (e) { p = Promise.reject(e); }
    p = p.then(scene => {
      scene.updateMatrixWorld(true);
      const t = { scene, ok: true, boxes: new Map() };
      tpl.set(file, t);
      return t;
    }).catch(e => {
      /* ⚠ console.error 금지 — 부팅 오류 0 을 재는 검사가 있다. 옷 없이 간다(옛 상자 그대로). */
      console.warn('[v2 가구] GLB 를 못 받았습니다 — 옛 모양으로 둡니다:', file, e && e.message);
      const t = { scene: null, ok: false, boxes: new Map() };
      tpl.set(file, t);
      return t;
    });
    loading.set(file, p);
    return p;
  }
  const propFiles = id => [...new Set((PROPS[id] || []).filter(p => p.file).map(p => p.file))];
  const bootFiles = () => [...new Set(Object.values(FURN).filter(s => !s.lazy && s.file).map(s => s.file))];   // topTex(러그)는 GLB 가 없다
  const furnReady = () => bootFiles().every(f => tpl.has(f));

  /* 부팅 때 한 번 — 가구 옷을 기다린다(너무 오래면 옛 모양으로 먼저 뜨고 나중에 입는다) */
  function preload(ms = 4000) {
    if (!on || !loadGLB) return Promise.resolve(false);
    const all = Promise.all(bootFiles().map(load)).then(() => true);
    return Promise.race([all, new Promise(r => setTimeout(() => r(false), ms))]);
  }

  /* ── GLB 를 yaw 만큼 돌린 틀에서의 상자와 윗면 높이 ── */
  const _rc = () => { const r = new T.Raycaster(); r.layers.mask = 0xffffffff | 0; return r; };
  function yawBox(t, yaw) {
    if (t.boxes.has(yaw)) return t.boxes.get(yaw);
    const holder = new T.Group();
    const c = t.scene.clone(true);
    c.rotation.y = deg(yaw);
    holder.add(c);
    holder.updateMatrixWorld(true);
    const box = new T.Box3().setFromObject(holder);
    const rec = { box, holder };
    t.boxes.set(yaw, rec);
    return rec;
  }
  function topFrac(file, t, yaw, u, v) {
    const key = `${file}|${yaw}|${u.toFixed(3)}|${v.toFixed(3)}`;
    if (measure.has(key)) return measure.get(key);
    const { box, holder } = yawBox(t, yaw);
    const x = box.min.x + u * (box.max.x - box.min.x);
    const z = box.min.z + v * (box.max.z - box.min.z);
    const rc = _rc();
    rc.set(new T.Vector3(x, box.max.y + 1, z), new T.Vector3(0, -1, 0));
    const hit = rc.intersectObject(holder, true)[0];
    const f = hit ? (hit.point.y - box.min.y) / Math.max(1e-6, box.max.y - box.min.y) : null;
    measure.set(key, f);
    return f;
  }

  /* ── 겹단 맞추기 (2026-10-09 · [house]) ──
     topFrac 은 (u,v) 에서 «맨 위 면» 하나만 잰다. 선반처럼 단이 위아래로 겹치면 아래 단 자리도 맨 위 판에 맞춰져
     배율이 틀어진다 — 그래서 v2 shelf.glb(에타제르)를 못 쓰고 RESTYLE 로 색만 바꿨다.
     또 Meshy 판 높이는 코드 단 높이와 비율이 다르다(책장: 받침대가 있어 판이 5.7/29.9/53.2/77.1% · 코드 1.2/26.2/51.1/76.2%)
     — 배율 하나로는 네 단을 다 못 맞춘다(가장 나은 배율로도 밑단 6.5cm).
     ⇒ ① (u,v) 를 지나는 «위를 보는 면» 높이를 다 모으고(upFracs)
       ② 단(낮은 것부터)과 면을 차례로 짝짓되 «바닥~첫 단 · 단~단 · 끝 단~꼭대기» 구간마다 늘임 비가 가장 고른 짝을 고르고(tierFracs)
       ③ GLB 세로를 그 구간대로 «꺾은 선»으로 늘인다(remapTiers) — 판은 단 높이에 정확히 앉고, 사이 기둥·옆판이 늘거나 준다.
     판 수가 단 수보다 많아도 된다(책장 윗판 · 온실장 밑판 같은 자리 없는 판). g.userData 는 안 건드린다 — 그림만. */
  function upFracs(file, t, yaw, u, v) {
    const key = `up|${file}|${yaw}|${u.toFixed(3)}|${v.toFixed(3)}`;
    if (measure.has(key)) return measure.get(key);
    const { box, holder } = yawBox(t, yaw);
    const x = box.min.x + u * (box.max.x - box.min.x), z = box.min.z + v * (box.max.z - box.min.z);
    const rc = _rc(); rc.set(new T.Vector3(x, box.max.y + 1, z), new T.Vector3(0, -1, 0));
    const H = Math.max(1e-6, box.max.y - box.min.y), nrm = new T.Vector3(), out = [];
    for (const h of rc.intersectObject(holder, true)) {
      if (!h.face) continue;
      nrm.copy(h.face.normal).transformDirection(h.object.matrixWorld);
      if (nrm.y < 0.6) continue;                         // 위를 보는 면만 — 판 밑면(아래를 봄)을 넣으면 짝이 밑면으로 샌다(책장 10-09)
      const f = (h.point.y - box.min.y) / H;
      if (!out.some(q => Math.abs(q - f) < 0.02)) out.push(f);   // 판 두께(윗면·밑면)는 2% 안이면 한 판
    }
    out.sort((a, b) => a - b);
    measure.set(key, out);
    return out;
  }
  function tierFracs(file, t, yaw, pts, topY) {
    const cl = q => Math.min(0.98, Math.max(0.02, q));
    const { box } = yawBox(t, yaw); const H = box.max.y - box.min.y;
    const tierY = [...new Set(pts.map(p => +p.y.toFixed(3)))].sort((a, b) => a - b);
    const cand = tierY.map(y => { const p = pts.find(q => +q.y.toFixed(3) === y); return upFracs(file, t, yaw, cl(p.u), cl(p.v)); });
    let best = null;
    const walk = (i, lo, pick) => {
      if (i === tierY.length) {
        /* 구간 늘임 비 — 바닥~첫 단 · 단~단 · 끝 단~꼭대기(대리 상자 윗면) */
        const gy = [0, ...pick.map(f => f * H)], ty = [0, ...tierY];
        if (H - gy[gy.length - 1] > 1e-3 * H) { gy.push(H); ty.push(Math.max(topY, tierY[tierY.length - 1] + 0.01)); }   // 끝 단이 곧 꼭대기면(코너 선반) 꼭대기 구간이 없다
        let sc = 0, ok = true;
        for (let k = 1; k < gy.length; k++) { const a = gy[k] - gy[k - 1], b = ty[k] - ty[k - 1];
          if (!(a > 1e-4 && b > 1e-4)) { ok = false; break; } const l = Math.log(b / a); sc += l * l; }
        if (ok && (!best || sc < best.sc)) best = { sc, pick: [...pick] };
        return;
      }
      for (const f of cand[i]) if (f > lo && f > 0.001) { pick.push(f); walk(i + 1, f, pick); pick.pop(); }
    };
    walk(0, -1, []);
    if (!best) return null;
    return { tierY, pick: best.pick, fs: pts.map(p => best.pick[tierY.indexOf(+p.y.toFixed(3))]) };
  }
  /* 코드 가구(대리)가 실제로 차지한 상자 — g 로컬 x·z (g 가 돌아 있어도) */
  function localBox(g, meshes) {
    g.updateWorldMatrix(true, true);
    const inv = new T.Matrix4().copy(g.matrixWorld).invert(), b = new T.Box3(), mb = new T.Box3(), m4 = new T.Matrix4();
    for (const m of meshes) {
      if (!m.geometry) continue;
      if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
      m4.multiplyMatrices(inv, m.matrixWorld);
      b.union(mb.copy(m.geometry.boundingBox).applyMatrix4(m4));
    }
    return { x0: b.min.x, w: Math.max(1e-3, b.max.x - b.min.x), z0: b.min.z, d: Math.max(1e-3, b.max.z - b.min.z) };
  }
  /* 옷(dress) 안에서 (lx,lz) 를 지나는 위를 보는 면 중 y 에 가장 가까운 것(g 로컬 m) — 겹단 맞춤 확인용 */
  function surfaceNear(dress, lx, lz, y) {
    const g = dress.parent; g.updateWorldMatrix(true, true);
    const rc = _rc(); rc.set(g.localToWorld(new T.Vector3(lx, 9, lz)), new T.Vector3(0, -1, 0));
    const nrm = new T.Vector3(); let best = null;
    for (const h of rc.intersectObject(dress, true)) {
      if (!h.face) continue;
      nrm.copy(h.face.normal).transformDirection(h.object.matrixWorld); if (nrm.y < 0.6) continue;
      const ly = g.worldToLocal(h.point.clone()).y;
      if (best == null || Math.abs(ly - y) < Math.abs(best - y)) best = ly;
    }
    return best;
  }
  /* 구간대로 세로를 꺾어 늘인 판(틀) — 파일·yaw·마디가 같으면 한 번만 짓고 나눠 쓴다 */
  const remapCache = new Map();
  function remapTiers(file, t, yaw, knots) {
    const key = `${file}|${yaw}|${knots.map(k => k[0].toFixed(4) + ':' + k[1].toFixed(4)).join(',')}`;
    if (remapCache.has(key)) return remapCache.get(key);
    const { box } = yawBox(t, yaw);
    const root = t.scene.clone(true); root.rotation.y = deg(yaw);
    const holder = new T.Group(); holder.add(root); holder.updateMatrixWorld(true);
    const map = y => {                                   // GLB 높이(바닥 기준 m) → 방 높이(m)
      for (let k = 1; k < knots.length; k++) if (y <= knots[k][0] || k === knots.length - 1) {
        const [a0, b0] = knots[k - 1], [a1, b1] = knots[k];
        return b0 + (y - a0) * (b1 - b0) / Math.max(1e-6, a1 - a0);
      }
      return y;
    };
    const v = new T.Vector3(), inv = new T.Matrix4();
    root.traverse(o => {
      if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
      o.geometry = o.geometry.clone();
      inv.copy(o.matrixWorld).invert();
      const pos = o.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
        v.y = map(v.y - box.min.y) + box.min.y;
        v.applyMatrix4(inv); pos.setXYZ(i, v.x, v.y, v.z);
      }
      pos.needsUpdate = true; o.geometry.computeBoundingBox(); o.geometry.computeBoundingSphere();
    });
    holder.remove(root);
    remapCache.set(key, root);
    return root;
  }

  /* 대리 메시(옷이 아닌 것) 모두 */
  function proxiesOf(g) {
    const out = [];
    g.traverse(o => {
      if (!o.isMesh) return;
      for (let p = o; p && p !== g; p = p.parent) if (p.userData && p.userData.v2dress) return;
      out.push(o);
    });
    return out;
  }
  /* 대리의 윗면 높이(g 로컬) — 위에서 아래로 쏜다 */
  function proxyTop(g, proxies, lx, lz) {
    g.updateWorldMatrix(true, true);
    const from = g.localToWorld(new T.Vector3(lx, 5, lz));
    const rc = _rc();
    rc.set(from, new T.Vector3(0, -1, 0));
    const hit = rc.intersectObjects(proxies, false)[0];
    return hit ? g.worldToLocal(hit.point.clone()).y : null;
  }
  const median = a => { const s = a.filter(Number.isFinite).sort((x, y) => x - y);
                        return s.length ? s[(s.length - 1) >> 1] : null; };

  function presetOf(g, roomDef) {
    const fs = (roomDef && roomDef.furniture) || [];
    const u = g.userData || {};
    const byIdx = Number.isInteger(u.furnIdx) ? fs[u.furnIdx] : null;
    const f = (byIdx && (!byIdx.uid || byIdx.uid === u.uid)) ? byIdx : fs.find(x => x.uid === u.uid);
    return f ? f.preset : null;
  }

  /* ── 한 가구에 옷 입히기 ── */
  function dressOne(g, preset) {
    const spec = specOf(preset);
    if (!spec) return false;
    if (g.children.some(c => c.userData && c.userData.v2dress)) return true;     // 이미 입었다
    if (spec.topTex) return dressTopTex(g, preset, spec);
    if (spec.faceTex || spec.faceTexSeason) return dressFaceTex(g, preset, spec);
    const t = tpl.get(spec.file);
    if (!t || !t.ok) return false;
    if (spec.lamp) return dressLamp(g, preset, spec, t);
    const size = g.userData.size || {};
    const w = size.w, d = size.d;
    if (!(w > 0 && d > 0)) return false;
    /* keepGlass: 코드 유리(투명 재질)는 숨기지 않는다 — GLB 는 틀만 받았다(온실장 · Meshy 는 투명 유리를 못 굽는다) */
    const proxies = proxiesOf(g).filter(m => !(spec.keepGlass && m.material && m.material.transparent && m.material.opacity < 0.5));
    if (!proxies.length) return false;

    /* 세로 배율 — 자리(slots) 높이 또는 대리 윗면 = GLB 윗면 */
    /* 가로·깊이를 맞출 틀 — 보통은 발자국(userData.size), fitProxyBox 면 코드 가구가 실제로 차지한 상자
       (사다리 선반: 아래 단이 발자국 앞으로 0.25m 나와 있어 발자국에 맞추면 밑단 자리 밑에 판이 없다 · 10-09) */
    const F = spec.fitProxyBox ? localBox(g, proxies) : { x0: -w / 2, w, z0: -d / 2, d };
    const pts = [];
    const slots = Array.isArray(g.userData.slots) ? g.userData.slots : [];
    if (slots.length) for (const s of slots) pts.push({ u: (s.x - F.x0) / F.w, v: (s.z - F.z0) / F.d, y: s.y });
    else for (const [u, v] of (spec.probes || [[0.5, 0.5]]))
      pts.push({ u, v, y: proxyTop(g, proxies, F.x0 + u * F.w, F.z0 + v * F.d) });
    const { box } = yawBox(t, spec.yaw);
    const H = box.max.y - box.min.y;
    const cl = q => Math.min(0.98, Math.max(0.02, q));
    /* 자리마다 맞출 GLB 면의 높이 비율 f — 보통은 맨 위 면 · 겹단(spec.tiers)이면 단마다 제 면에 «꺾은 선»으로 */
    const pb = new T.Box3(); for (const m of proxies) pb.expandByObject(m);
    g.updateWorldMatrix(true, true);
    const proxyTopY = pb.max.y - g.position.y;
    const tf = spec.tiers && slots.length ? tierFracs(spec.file, t, spec.yaw, pts, proxyTopY) : null;
    const fs = tf ? tf.fs : pts.map(p => topFrac(spec.file, t, spec.yaw, cl(p.u), cl(p.v)));
    const ks = pts.map((p, i) => (fs[i] && p.y > 0) ? p.y / (fs[i] * H) : NaN);
    let sy = median(ks);
    if (!Number.isFinite(sy)) sy = proxyTopY / H;    // 못 쟀다 — 대리 상자 높이로
    const sx = F.w / (box.max.x - box.min.x), sz = F.d / (box.max.z - box.min.z);
    if (spec.uniform) sy = (sx + sz) / 2;           // 비율 그대로(발자국이 GLB 비율에서 나왔다)
    if (spec.box && size.h > 0) sy = size.h / H;     // 크기 상자 그대로(자리 없는 살대 가구 — 가운데 윗면이 봉 하나라 못 잰다)
    /* 겹단: 바닥 0 · 단마다 (GLB 판 높이 → 자리 높이) · 꼭대기(GLB 윗면 → 대리 윗면) 마디로 세로를 꺾는다 → 세로 배율 1 */
    const knots = tf ? [[0, 0], ...tf.pick.map((f, k) => [f * H, tf.tierY[k]])] : null;
    if (knots && H - knots[knots.length - 1][0] > 1e-3 * H) knots.push([H, Math.max(proxyTopY, tf.tierY[tf.tierY.length - 1] + 0.01)]);
    if (knots) sy = 1;

    let glb;
    if (knots) glb = remapTiers(spec.file, t, spec.yaw, knots).clone(true);   // 기하는 틀과 나눠 쓴다(sharedGeometry)
    else { glb = t.scene.clone(true); glb.rotation.y = deg(spec.yaw); }
    if (spec.tint) tintScene(glb, spec.tint, !!spec.tintAll);   // 색 변형 — 같은 옷에 몸 색만(§색 변형) · tintAll 은 통째로
    const mid = new T.Group();
    mid.add(glb);
    mid.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
    const dress = new T.Group();
    dress.name = 'v2dress';
    dress.userData.v2dress = true;
    dress.add(mid);
    dress.scale.set(sx, sy, sz);
    dress.position.set(F.x0 + F.w / 2, 0, F.z0 + F.d / 2);   // 발자국이면 0,0
    /* 벽 걸이(10-10)는 빌더 원점이 물건 가운데다 — 옷 밑을 대리 상자 밑(−h/2)에 맞춘다(바닥 가구는 0 그대로) */
    if (g.userData.mount === 'wall-hang') { g.updateWorldMatrix(true, false); dress.position.y = pb.min.y - g.getWorldPosition(new T.Vector3()).y; }
    markVisual(dress);
    g.add(dress);

    /* 옷을 붙인 **뒤에** 대리를 숨긴다 — 순서를 바꾸면 한 프레임 비어 보인다 */
    const hm = hidden();
    for (const m of proxies) { if (!origMat.has(m)) origMat.set(m, m.material); m.material = hm; }

    /* 진단 — 자리마다 GLB 윗면이 얼마나 어긋나나(m) */
    dress.updateMatrixWorld(true);
    /* 겹단은 같은 자로 «옷 입힌 뒤» 다시 잰다 — 꺾은 판이 정말 자리 높이에 앉았나(셈을 믿지 않는다) */
    const errs = pts.map((p, i) => {
      if (!fs[i] || !Number.isFinite(p.y)) return null;
      if (!knots) return +(fs[i] * H * sy - p.y).toFixed(4);
      const hy = surfaceNear(dress, F.x0 + cl(p.u) * F.w, F.z0 + cl(p.v) * F.d, p.y);
      return hy == null ? null : +(hy - p.y).toFixed(4);
    });
    report.set(g.userData.uid, { preset, file: spec.file, yaw: spec.yaw, uniform: !!(spec.uniform || spec.box), tint: spec.tint || undefined, base: spec.base || undefined,
      scale: [+sx.toFixed(4), +sy.toFixed(4), +sz.toFixed(4)], tiers: knots ? knots.map(k => k.map(v => +v.toFixed(3))) : undefined,
      height: +(knots ? knots[knots.length - 1][1] : H * sy).toFixed(3), targets: pts.map(p => p.y == null ? null : +p.y.toFixed(3)), topErr: errs });
    return true;
  }

  /* ── 윗면 그림 (2026-10-10 · [house] · 러그) ──
     발자국(userData.size w×d) 크기 판 하나를 코드 러그 윗면(size.h) 바로 위에 깐다 · 그림 층(층 1)이라 광선·조도는 안 본다.
     그림은 둘레가 투명(술 사이 포함) — alphaTest 로 자른다(투명 정렬 없이). 대리(코드 러그 몸·테두리)는 숨긴다.
     판 가로 = w(X) · 세로 = d(Z) — 그림의 가로·세로도 그 비율로 뽑았다(러너는 세로 그림). 회전은 가구 그룹이 한다 */
  /* ⚠ 그림을 다 받은 «뒤에» 판을 깔고 대리를 숨긴다 — 받기 전에 깔면 alphaTest 가 빈 그림을 통째로 잘라
       러그 자리가 비었다(10-10 가게 그림이 텅 빔). GLB 처럼 dress() 가 받는 대로 다시 입힌다 */
  const topTexMats = new Map();               // 파일 → 재질(받은 것만 · 나눠 쓴다)
  const topTexLoading = new Map();            // 파일 → Promise
  function loadTopTex(file) {
    if (topTexMats.has(file)) return Promise.resolve(topTexMats.get(file));
    if (topTexLoading.has(file)) return topTexLoading.get(file);
    const p = new Promise(ok => {
      new T.TextureLoader().load(ASSET(file), tex => {
        tex.encoding = T.sRGBEncoding;
        if (opt.renderer && opt.renderer.capabilities) tex.anisotropy = Math.min(4, opt.renderer.capabilities.getMaxAnisotropy());
        const mat = new T.MeshStandardMaterial({ map: tex, roughness: 0.95, metalness: 0, alphaTest: 0.5,
                                                 polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
        topTexMats.set(file, mat); ok(mat);
      }, undefined, () => { console.warn('[v2 가구] 러그 그림을 못 받았습니다 —', file); topTexMats.set(file, null); ok(null); });
    });
    topTexLoading.set(file, p);
    return p;
  }
  function dressTopTex(g, preset, spec) {
    const size = g.userData.size || {};
    if (!(size.w > 0 && size.d > 0)) return false;
    const proxies = proxiesOf(g);
    if (!proxies.length) return false;
    const mat = topTexMats.get(spec.topTex);
    if (!mat) return false;                   // 아직 못 받았거나(dress 가 받으러 간다) 받기 실패 — 코드 러그 그대로
    const key = size.w + 'x' + size.d;
    if (!rugGeo.has(key)) rugGeo.set(key, new T.PlaneGeometry(size.w, size.d));
    const m = new T.Mesh(rugGeo.get(key), mat);
    m.userData.sharedGeometry = true;
    m.rotation.x = -Math.PI / 2;
    m.receiveShadow = true; m.castShadow = false;
    const dress = new T.Group();
    dress.name = 'v2dress'; dress.userData.v2dress = true;
    dress.add(m);
    dress.position.set(0, (size.h > 0 ? size.h : 0.012) * 0.5 + 0.001, 0);   // 코드 러그 두께 가운데쯤 — 숨긴 몸 대신 바닥에서 살짝 뜬다
    markVisual(dress);
    g.add(dress);
    const hm = hidden();
    for (const p of proxies) { if (!origMat.has(p)) origMat.set(p, p.material); p.material = hm; }
    report.set(g.userData.uid, { preset, topTex: spec.topTex, size: [size.w, size.d] });
    return true;
  }

  /* ── 그림 면 (2026-10-10 · [house] · 벽 걸이 v1) ──
     빌더가 artFace 로 표시한 면의 재질만 바꾼다(그림을 받은 뒤 · 러그와 같은 받기 규약). 옛 재질은 origMat 에 —
     벗기면(undress) 돌아온다. 입었다는 표지는 빈 v2dress 묶음 하나(다시 입히지 않게 · 벗길 때 같이 걷힌다) */
  let season = 'spring';
  const flags = new Set();                 // 깃발 소품(가게 입간판 shopSign · 10-10)
  function setFlag(name, on1) {
    const had = flags.has(name); if (on1) flags.add(name); else flags.delete(name);
    if (had === !!on1) return false;
    if (cur.parent && cur.built) { props(cur.parent, cur.built, cur.roomId); onChange('props'); }
    return true;
  }
  const faceFileOf = spec => spec.faceTexSeason ? (spec.faceTexSeason[season] || spec.faceTexSeason.spring) : spec.faceTex;
  function dressFaceTex(g, preset, spec) {
    const file = faceFileOf(spec);
    const mat = topTexMats.get(file);
    if (!mat) return false;                   // 아직 못 받음 — dress 가 받으러 간다
    const faces = [], others = [];
    g.traverse(o => { if (!o.isMesh) return; (o.userData && o.userData.artFace ? faces : others).push(o); });
    if (!faces.length) return false;
    for (const f of faces) { if (!origMat.has(f)) origMat.set(f, f.material); f.material = mat; }
    if (spec.hideOthers) { const hm = hidden(); for (const o of others) { if (!origMat.has(o)) origMat.set(o, o.material); o.material = hm; } }
    const mark = new T.Group(); mark.name = 'v2dress'; mark.userData.v2dress = true; mark.userData.v2face = file;
    g.add(mark);
    report.set(g.userData.uid, { preset, faceTex: file, season: spec.faceTexSeason ? season : undefined });
    return true;
  }
  /* 계절이 바뀌면 달력 쪽만 다시 입힌다 — 다른 옷은 «이미 입었다»로 그대로 */
  function setSeason(s) {
    if (!['spring', 'summer', 'autumn', 'winter'].includes(s) || s === season) return false;
    season = s;
    const b = cur.built;
    if (!b || !b.furniture) return true;
    for (const g of b.furniture.children) {
      const preset = g.userData && g.userData.uid ? presetOf(g, cur.roomDef) : null;
      const spec = preset ? specOf(preset) : null;
      if (!spec || !spec.faceTexSeason) continue;
      for (const c of [...g.children]) if (c.userData && c.userData.v2dress) g.remove(c);
      g.traverse(o => { if (o.isMesh && origMat.has(o)) { o.material = origMat.get(o); origMat.delete(o); } });
    }
    dress(cur.built, cur.roomDef);
    onChange('furniture');
    return true;
  }

  /* ── 색 변형 (2026-10-09 · [house] · 총괄 D39 A) ──────────────────────────────
     가구점의 색 변형(의자 민트·책상 월넛·소파 세이지 …)은 옷 층 표에 없어 **옛 상자 그림**으로 섰다 — 색을 고르면 옛 그림이 되는 셈.
     ⇒ 같은 type 의 옷 있는 프리셋(바탕)과 크기가 거의 같으면(가로·깊이·높이 각각 0.8~1.25배) 바탕 옷을 입히고 **몸 색만** 바꾼다.
       크기가 크게 다른 것(더블 침대 · 넓은 책상 · 낮은 책장 · 3단 에타제르)은 늘이면 찌그러져 옛 그림 그대로 둔다.
     몸 색 바꾸기(셰이더): 텍스처에서 가장 흔한 색(몸 색)과 «빛깔»이 가까운 화소만 변형 색으로 칠하고 밝기 비는 살린다.
       빛깔이 먼 화소(손잡이 놋쇠·다리 쇠 같은 것)는 그대로 — 손잡이까지 물드는 것을 막는다.
     값·크기·자리는 프리셋 그대로다(그림만). 프리셋 표는 room_view 가 opt.presets 로 준다. */
  const variantCache = new Map();
  function specOf(preset) {
    if (FURN[preset]) return FURN[preset];
    if (variantCache.has(preset)) return variantCache.get(preset);
    let out = null;
    const P = typeof opt.presets === 'function' ? opt.presets() : null;
    const p = P && P[preset];
    if (p && p.type && p.color) {
      const sz = q => (q && q.size_m) || {};
      const close = (a, b) => a > 0 && b > 0 && a / b >= 0.8 && a / b <= 1 / 0.8;    // 학생 의자 0.42 = 바탕 0.50 의 0.84
      for (const k of Object.keys(FURN)) {
        const b = P[k];
        if (!b || b.type !== p.type || FURN[k].lamp) continue;
        if (!['w', 'd', 'h'].every(ax => close(sz(p)[ax], sz(b)[ax]))) continue;
        out = { ...FURN[k], tint: p.color, base: k };
        break;
      }
    }
    if (P) variantCache.set(preset, out);       // 표가 아직 없으면 다음에 다시 본다
    return out;
  }
  const tintMats = new Map();                  // 원래 재질 uuid|색 → 칠한 재질(나눠 쓴다)
  const domCache = new WeakMap();              // 텍스처 → 몸 색(선형)
  function domColorOf(tex) {
    if (!tex || !tex.image) return null;
    if (domCache.has(tex)) return domCache.get(tex);
    let out = null;
    try {
      const N = 48, cv = document.createElement('canvas'); cv.width = N; cv.height = N;
      const cx = cv.getContext('2d'); cx.drawImage(tex.image, 0, 0, N, N);
      const px = cx.getImageData(0, 0, N, N).data, bins = new Map();
      const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      let sumL = 0, nL = 0;
      for (let i = 0; i < px.length; i += 4) {
        const r = px[i], gg = px[i + 1], b = px[i + 2], l = (r + gg + b) / 3;
        if (l < 40) continue;                               // 그림 선(짙은 테두리)은 몸 색이 아니다
        sumL += 0.2126 * lin(r) + 0.7152 * lin(gg) + 0.0722 * lin(b); nL++;
        const key = (r >> 4) << 8 | (gg >> 4) << 4 | (b >> 4);
        const e = bins.get(key) || [0, 0, 0, 0]; e[0]++; e[1] += r; e[2] += gg; e[3] += b; bins.set(key, e);
      }
      let best = null; for (const e of bins.values()) if (!best || e[0] > best[0]) best = e;
      /* 빛깔은 가장 흔한 색에서, 밝기 기준은 평균 밝기에서 — 가장 흔한 색이 짙은 나뭇결이면 전체가 밝게 뜬다(월넛 책상 10-09) */
      if (best) out = { c: new T.Color(best[1] / best[0] / 255, best[2] / best[0] / 255, best[3] / best[0] / 255).convertSRGBToLinear(),
                        l: nL ? sumL / nL : 0.5 };
    } catch (_) { out = null; }                      // 창이 없는 환경(Node 검사) — 색을 안 바꾼다
    domCache.set(tex, out);
    return out;
  }
  /* all — 몸 색 가리개 없이 통째로 칠한다(짙은 선만 그대로). 스툴: Meshy 가 앉음판을 크림·다리를 갈색으로 따로 칠해
       블러시가 다리만 분홍이 됐다(10-09 · 앉음판이 위에서 보이는 거의 전부라 «크림 스툴»으로 읽힘) */
  function tintScene(root, hex, all = false) {
    const want = new T.Color(hex).convertSRGBToLinear();
    /* 옅은 색 변형(민트·하늘·블러시·버터·세이지)은 v2 의 밝은 결에서 «흰색»으로 읽혔다(총괄 10-09 — 코드 판은 옅게라도 민트).
       ⇒ 빛깔이 있는 옅은 색(빛깔 폭 10~34)만 채도를 2.2배(밝기는 그대로). 흰색(#f2f0ec · 폭 6) · 버터(폭 49) · 짙은 색(차콜)은 그대로. */
    {
      const c8 = new T.Color(hex), r = c8.r * 255, g = c8.g * 255, b = c8.b * 255;
      const spread = Math.max(r, g, b) - Math.min(r, g, b), mean = (r + g + b) / 3;
      if (spread >= 10 && spread < 35 && mean >= 150) {   // 버터(폭 49)는 원래도 읽혀 그대로 — 2.2배면 진노랑이 된다
        const L = 0.2126 * want.r + 0.7152 * want.g + 0.0722 * want.b, k = 2.2;
        want.setRGB(Math.max(0, L + (want.r - L) * k), Math.max(0, L + (want.g - L) * k), Math.max(0, L + (want.b - L) * k));
      }
    }
    root.traverse(o => {
      if (!o.isMesh || !o.material) return;
      const one = m => {
        const key = m.uuid + '|' + hex + (all ? '|all' : '');
        if (tintMats.has(key)) return tintMats.get(key);
        const dom = domColorOf(m.map);
        if (!dom) { tintMats.set(key, m); return m; }
        const c = m.clone();
        c.userData = { ...(m.userData || {}), v2tint: hex };
        c.onBeforeCompile = sh => {
          sh.uniforms.uTint = { value: want }; sh.uniforms.uDom = { value: dom.c }; sh.uniforms.uDomL = { value: dom.l };
          sh.fragmentShader = 'uniform vec3 uTint;\nuniform vec3 uDom;\nuniform float uDomL;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
  {
    vec3 _c = diffuseColor.rgb;
    float _l = dot(_c, vec3(0.2126, 0.7152, 0.0722));
    float _ld = max(dot(uDom, vec3(0.2126, 0.7152, 0.0722)), 1e-3);
    vec3 _cn = _c / max(_l, 1e-3), _dn = uDom / _ld;          // 밝기를 뺀 «빛깔»
    float _w = ${all ? '1.0' : '1.0 - smoothstep(0.34, 0.62, distance(_cn, _dn))'}; // 몸 색에 가까울수록 1(나뭇결·그늘까지 · 방석·놋쇠는 멀다)
    _w *= smoothstep(0.02, 0.08, _l);                           // 아주 짙은 선은 그대로
    diffuseColor.rgb = mix(_c, uTint * (_l / max(uDomL, 1e-3)), _w);   // 평균 밝기 화소 = 변형 색 그대로
  }`);
        };
        c.customProgramCacheKey = () => (all ? 'v2tint_all' : 'v2tint');
        tintMats.set(key, c);
        return c;
      };
      o.material = Array.isArray(o.material) ? o.material.map(one) : one(o.material);
    });
  }

  /* ── 식물등 옷 (2026-10-09 · [house]) ──
     ★ 계약(master-visual-contracts 5): LED(g.userData.lampShade)는 g 의 직계 자식 · 밤빛·켜기가 그 메시의 emissive 를 만진다.
       ⇒ LED 는 대리로 숨기지 않고 **코드 것 그대로** 둔다. 옷은 몸통만.
     빛(조도)은 이 그림을 안 본다 — rig 발광점은 가구 x,z 와 size.h 에서 나온다(house.js emitY) · 겨누기도 계산만 돈다.
     맞추기는 두 점: GLB 받침(바닥 띠 가운데) → 코드 받침(원점) · GLB 등 머리(위 띠에서 받침과 가장 먼 덩이) → 코드 LED.
       세로는 머리 밑면이 LED 보다 4mm 위에 오게(같은 면이면 LED 가 깜박인다), 가로는 머리가 뻗은 축만 그 거리로 늘이고
       나머지 축은 세로 배율을 따른다(받침·기둥이 찌그러지지 않게). */
  const anchors = new Map();
  function lampAnchors(file, t, yaw, band) {
    const key = `${file}|${yaw}|${band}`;
    if (anchors.has(key)) return anchors.get(key);
    const { box, holder } = yawBox(t, yaw);
    const H = box.max.y - box.min.y, v = new T.Vector3(), P = [];
    holder.updateMatrixWorld(true);
    holder.traverse(o => { if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
      const pos = o.geometry.attributes.position, step = Math.max(1, Math.floor(pos.count / 6000));
      for (let i = 0; i < pos.count; i += step) { v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); P.push([v.x, v.y, v.z]); } });
    const mean = a => a.reduce((s, q) => [s[0] + q[0], s[1] + q[1], s[2] + q[2]], [0, 0, 0]).map(x => x / Math.max(1, a.length));
    const foot = P.filter(q => q[1] < box.min.y + 0.06 * H);
    const [bx, , bz] = mean(foot);
    const top = P.filter(q => q[1] > box.min.y + band * H).map(q => [q, Math.hypot(q[0] - bx, q[2] - bz)]);
    const dmax = Math.max(0, ...top.map(q => q[1]));
    const head = top.filter(q => q[1] > 0.6 * dmax).map(q => q[0]);
    const [hx, , hz] = mean(head);
    const hy = Math.min(...head.map(q => q[1]));
    const out = { base: { x: bx, z: bz }, head: { x: hx, y: hy - box.min.y, z: hz }, minY: box.min.y, H };
    anchors.set(key, out);
    return out;
  }
  function dressLamp(g, preset, spec, t) {
    const led = g.userData.lampShade;
    if (!led || led.parent !== g) return false;            // 계약이 깨진 등은 안 입힌다(옛 모양)
    const proxies = proxiesOf(g).filter(m => m !== led);
    if (!proxies.length) return false;
    const A = lampAnchors(spec.file, t, spec.yaw, spec.lamp.band ?? 0.6);
    const L = led.position, LIFT = 0.004;
    const sy = (L.y + LIFT) / Math.max(1e-6, A.head.y);
    const dx = A.head.x - A.base.x, dz = A.head.z - A.base.z, reach = 0.1 * A.H;
    let sx = Math.abs(dx) > reach ? L.x / dx : sy, sz = Math.abs(dz) > reach ? L.z / dz : sy;
    const sane = q => q > 0 && q / sy > 0.5 && q / sy < 2;
    const fellBack = !(sane(sx) && sane(sz));
    if (fellBack) { sx = sy; sz = sy; }                    // 머리 방향이 코드와 반대거나 너무 다르다 — 고르게(진단에 남긴다)
    const glb = t.scene.clone(true);
    glb.rotation.y = deg(spec.yaw);
    const mid = new T.Group(); mid.add(glb);
    mid.position.set(-A.base.x, -A.minY, -A.base.z);
    const dress = new T.Group(); dress.name = 'v2dress'; dress.userData.v2dress = true;
    dress.add(mid); dress.scale.set(sx, sy, sz);
    /* 머리가 안 뻗은 축(받침과 머리가 거의 한 줄)은 받침 대신 머리를 LED 에 맞춘다 — GLB 판이 기둥 줄에서 1~2cm 비껴 있어
       받침을 맞추면 LED 가 판 가장자리로 밀린다(거치 1.3cm · 10-09). 받침이 그만큼 비키는 것은 안 보인다. */
    if (!(Math.abs(dx) > reach)) dress.position.x = L.x - dx * sx;
    if (!(Math.abs(dz) > reach)) dress.position.z = L.z - dz * sz;
    markVisual(dress);
    g.add(dress);
    const hm = hidden();
    for (const m of proxies) { if (!origMat.has(m)) origMat.set(m, m.material); m.material = hm; }
    /* 진단 — 맞춘 GLB 머리가 LED 에서 얼마나 떨어졌나(m · x,y,z) · 받침이 얼마나 비켰나 */
    const hx = dress.position.x + (A.head.x - A.base.x) * sx, hy = A.head.y * sy, hz = dress.position.z + (A.head.z - A.base.z) * sz;
    report.set(g.userData.uid, { preset, file: spec.file, yaw: spec.yaw, lamp: true, fellBack,
      scale: [+sx.toFixed(4), +sy.toFixed(4), +sz.toFixed(4)], height: +(A.H * sy).toFixed(3),
      targets: [+L.x.toFixed(3), +L.y.toFixed(3), +L.z.toFixed(3)],
      topErr: [+(hx - L.x).toFixed(4), +(hy - L.y - LIFT).toFixed(4), +(hz - L.z).toFixed(4)],
      baseShift: [+dress.position.x.toFixed(4), +dress.position.z.toFixed(4)] });
    return true;
  }

  function markVisual(root) {
    root.traverse(o => {
      o.layers.set(LAYER);
      if (o.isMesh) {
        o.castShadow = true; o.receiveShadow = true;
        o.userData.shadowRole = 'blocker';
        o.userData.sharedGeometry = true;       // 캐시와 나눠 쓴다 — 치울 때 기하를 안 버린다
        o.userData.v2visual = true;
      }
    });
  }

  function restyleOne(g) {
    const st = RESTYLE[g.userData.type];
    if (!st) return false;
    if (!restyleMats) restyleMats = {};
    const key = g.userData.type;
    if (!restyleMats[key]) {
      const mk = hex => {
        const m = new T.MeshStandardMaterial({ color: new T.Color(hex).convertSRGBToLinear(),
                                               roughness: st.rough, metalness: st.metal });
        m.envMapIntensity = 0.25;
        return m;
      };
      restyleMats[key] = { board: mk(st.board), post: mk(st.post) };
    }
    const mats = restyleMats[key];
    g.traverse(o => {
      if (!o.isMesh || !o.material || Array.isArray(o.material)) return;
      if (o === g.userData.lampShade) return;
      const m = o.material;
      if (m.emissive && (m.emissive.r + m.emissive.g + m.emissive.b) > 0.001) return;   // 빛나는 부품은 그대로
      if (m.transparent && m.opacity < 0.95) return;
      if (!origMat.has(o)) origMat.set(o, m);
      /* 판(둥근 모서리 = ExtrudeGeometry)과 기둥·브래킷(원기둥·상자)을 가른다 */
      const isPost = !!(o.geometry && o.geometry.type !== 'ExtrudeGeometry');
      o.material = isPost ? mats.post : mats.board;
    });
    return true;
  }

  /* ── 방 전체 ── (assemble 이 dimRoomMaterials 바로 앞에서 부른다: 옷도 같이 눌린다) */
  function dress(built, roomDef) {
    cur.built = built; cur.roomDef = roomDef;
    report.clear();
    if (!on || held || !built || !built.furniture) return 0;
    let n = 0, missing = false;
    const need = new Set(), needTex = new Set();
    for (const g of built.furniture.children) {
      if (!g.userData || !g.userData.uid) continue;
      try {
        const preset = presetOf(g, roomDef);
        const spec = preset ? specOf(preset) : null;
        /* ★ 옷이 있는 프리셋은 색 바꾸기(RESTYLE · type 단위)보다 먼저 — 사다리 선반은 type 이 shelf_etagere 라 색만 바뀌던 것(10-09) */
        if (!spec) { if (restyleOne(g)) n++; }
        else if (dressOne(g, preset)) n++;
        else if (spec.topTex) { if (!topTexMats.has(spec.topTex)) { missing = true; needTex.add(spec.topTex); } }
        else if (spec.faceTex || spec.faceTexSeason) { const f = faceFileOf(spec); if (!topTexMats.has(f)) { missing = true; needTex.add(f); } }
        else if (!tpl.has(spec.file)) { missing = true; need.add(spec.file); }
      } catch (e) {
        console.warn('[v2 가구] 옷을 못 입혔습니다 —', g.userData.uid, e && e.message);
      }
      /* 가구 위 소품 — 옷이 없는 가구(주방 카운터)에도 얹는다 */
      try { for (const f of decorOne(g, presetOf(g, roomDef))) { missing = true; need.add(f); } }
      catch (e) {
        console.warn('[v2 가구] 소품을 못 얹었습니다 —', g.userData.uid, e && e.message);
      }
    }
    for (const door of doorsOf(built)) {
      try {
        const spec = shellSpecOf(door);
        if (dressDoor(door, spec)) n++;
        else if (!tpl.has(spec.file)) { missing = true; need.add(spec.file); }
      } catch (e) { console.warn('[v2 가구] 문·창 옷을 못 입혔습니다 —', door.userData.doorPreset || door.userData.winPreset, e && e.message); }
    }
    /* 아직 못 받은 옷이 있으면 받는 대로 입히고 알린다(옛 방이면 안 입힌다)
       ★ 2026-10-09 — 방에 놓인 것만 받는다. 가구점 옷이 13벌 늘어, 전부 받으면 소파 하나 사도 5MB 를 받는다([house]). */
    if (missing) {
      const go = () => Promise.all([...[...need].map(load), ...[...needTex].map(loadTopTex)]).then(() => {
        if (disposed || !on || held || cur.built !== built) return;
        dress(built, roomDef);
        onChange('furniture');
      });
      /* 못 받은 것이 «나중 받기»뿐이면 소품처럼 조금 뒤에 받는다(첫 화면을 안 다툰다) */
      if (bootFiles().every(f => tpl.has(f))) setTimeout(go, opt.propDelayMs ?? 1200); else go();
    }
    return n;
  }

  function undress(built) {
    if (!built || !built.furniture) return;
    for (const g of [...built.furniture.children, ...doorsOf(built)]) {
      for (const c of [...g.children]) if (c.userData && c.userData.v2dress) g.remove(c);
      g.traverse(o => { if (o.isMesh && origMat.has(o)) { o.material = origMat.get(o); origMat.delete(o); } });
    }
  }
  /* 가구 위 소품 — 못 받은 파일 목록을 돌려준다 */
  function decorOne(g, preset) {
    const list = [...(DECOR['uid:' + g.userData.uid] || []), ...(preset ? (DECOR['preset:' + preset] || []) : [])];
    const missingFiles = [];
    if (!list.length) return missingFiles;
    const size = g.userData.size || {};
    if (!(size.w > 0 && size.d > 0)) return missingFiles;
    const proxies = proxiesOf(g);
    for (const it of list) {
      if (g.children.some(c => c.userData && c.userData.v2decor === it.id)) continue;      // 이미 얹었다
      const t = tpl.get(it.file);
      if (!t) { missingFiles.push(it.file); continue; }
      if (!t.ok) continue;
      const lx = -size.w / 2 + it.u * size.w, lz = -size.d / 2 + it.v * size.d;
      const top = proxyTop(g, proxies, lx, lz);
      if (top == null) continue;                                    // 그 자리에 상판이 없다 — 안 얹는다
      const { box } = yawBox(t, it.yaw || 0);
      const k = it.h / Math.max(1e-6, box.max.y - box.min.y);
      const glb = t.scene.clone(true); glb.rotation.y = deg(it.yaw || 0);
      const mid = new T.Group(); mid.add(glb);
      mid.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
      const node = new T.Group(); node.name = 'v2decor'; node.userData.v2dress = true; node.userData.v2decor = it.id;
      node.userData.decorHalf = [(box.max.x - box.min.x) * k / 2, (box.max.z - box.min.z) * k / 2];
      node.add(mid); node.scale.setScalar(k); node.position.set(lx, top + 0.002, lz);
      markVisual(node);
      g.add(node);
    }
    return missingFiles;
  }
  /* 화분이 소품 자리에 오면 그 소품만 숨긴다(화분이 이긴다 — 바닥 소품 PROPS 와 같은 규칙) */
  function applyDecorYield() {
    const b = cur.built; if (!b || !b.furniture) return;
    const pots = (lastColliders || []).filter(c => c && c.plant);
    const v = new T.Vector3();
    b.furniture.traverse(o => {
      if (!o.userData || !o.userData.v2decor) return;
      o.getWorldPosition(v);
      const [hx, hz] = o.userData.decorHalf || [0.1, 0.1];
      const r = { x: v.x, z: v.z, w: hx * 2, d: hz * 2, rot: (o.parent && o.parent.rotation && o.parent.rotation.y) || 0 };
      o.visible = !pots.some(c => overlap(r, { x: c.x, z: c.z, w: c.w, d: c.d, rot: c.rot || 0 }));
    });
  }
  /* 방 껍데기(벽) 안의 문 그룹 중 옷이 있는 것 */
  function doorsOf(built) {
    const out = [];
    for (const grp of [built && built.shells, built && built.trims]) {
      if (!grp) continue;
      for (const k in grp) {
        const sh = grp[k]; if (!sh || !sh.traverse) continue;
        sh.traverse(o => { if (o.userData && ((o.userData.isDoor && DOORS[o.userData.doorPreset]) ||
                                              (o.userData.isWinFrame && WINS[o.userData.winPreset]))) out.push(o); });
      }
    }
    return out;
  }
  const shellSpecOf = o => o.userData.isDoor ? DOORS[o.userData.doorPreset] : WINS[o.userData.winPreset];
  function dressDoor(door, spec) {
    if (door.children.some(c => c.userData && c.userData.v2dress)) return true;
    const t = tpl.get(spec.file);
    if (!t || !t.ok) return false;
    const sz = door.userData.doorSize || door.userData.winSize || {};
    if (!(sz.w > 0 && sz.h > 0)) return false;
    const proxies = proxiesOf(door);
    if (!proxies.length) return false;
    const { box } = yawBox(t, spec.yaw);
    const sx = sz.w / (box.max.x - box.min.x), sy = sz.h / (box.max.y - box.min.y), szz = (sz.d || 0.14) / (box.max.z - box.min.z);
    const glb = t.scene.clone(true); glb.rotation.y = deg(spec.yaw);
    const mid = new T.Group(); mid.add(glb);
    const c = box.getCenter(new T.Vector3());
    mid.position.set(-c.x, -c.y, -c.z);                  // 문 그룹 원점 = 문 한가운데(buildDoor 는 가운데 기준)
    const dress = new T.Group(); dress.name = 'v2dress'; dress.userData.v2dress = true;
    dress.add(mid); dress.scale.set(sx, sy, szz);
    markVisual(dress);
    /* ⚠ 컷어웨이는 «바뀔 때만» 재질을 고친다(updateShellVisibility _stub). 옷이 늦게 오면 벽은 이미 내려가 있는데
         문만 서 있게 된다 — 붙일 때 그 벽의 지금 상태를 따른다. */
    let stub = false; for (let p = door.parent; p; p = p.parent) if (p.userData && p.userData._stub != null) { stub = !!p.userData._stub; break; }
    dress.traverse(o => { if (!o.isMesh || !o.material) return;
      for (const mm of (Array.isArray(o.material) ? o.material : [o.material])) { mm.colorWrite = !stub; mm.depthWrite = !stub; mm.needsUpdate = true; } });
    door.add(dress);
    const hm = hidden();
    for (const m of proxies) { if (!origMat.has(m)) origMat.set(m, m.material); m.material = hm; }
    const pid = door.userData.doorPreset || door.userData.winPreset;
    report.set((door.userData.isDoor ? 'door:' : 'win:') + pid, { preset: pid, file: spec.file, yaw: spec.yaw, door: true, stub,
      scale: [+sx.toFixed(4), +sy.toFixed(4), +szz.toFixed(4)], height: +sz.h.toFixed(3), targets: [sz.w, sz.h, sz.d], topErr: [] });
    return true;
  }

  /* ── 소품 ── */
  function clearProps() {
    if (propGroup && propGroup.parent) propGroup.parent.remove(propGroup);
    propGroup = null; propList = [];
  }
  function dimProp(mat, k) {
    if (!mat || !mat.color) return;
    if (!mat.userData.__v2Base) mat.userData.__v2Base = mat.color.clone();
    mat.color.copy(mat.userData.__v2Base).multiplyScalar(k);
  }
  function makeRug(p) {
    if (!rugMat) {
      rugTex = new T.TextureLoader().load(ASSET('textures/rug.webp'), () => onChange('rug'),
        undefined, () => console.warn('[v2 가구] 러그 무늬를 못 받았습니다'));
      rugTex.encoding = T.sRGBEncoding;
      if (opt.renderer && opt.renderer.capabilities)
        rugTex.anisotropy = Math.min(4, opt.renderer.capabilities.getMaxAnisotropy());
      rugMat = new T.MeshStandardMaterial({ map: rugTex, roughness: 0.95, metalness: 0,
                                            polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    }
    const gk = p.w + 'x' + p.d;
    if (!rugGeo.has(gk)) rugGeo.set(gk, new T.PlaneGeometry(p.w, p.d));
    const m = new T.Mesh(rugGeo.get(gk), rugMat);
    m.userData.sharedGeometry = true;
    m.rotation.x = -Math.PI / 2;
    const r = new T.Group();
    r.add(m);
    r.position.set(p.x, 0.004, p.z);
    r.rotation.y = deg(p.yaw || 0);
    m.receiveShadow = true; m.castShadow = false;
    r.traverse(o => o.layers.set(LAYER));
    m.userData.v2visual = true;
    return { node: r, rect: { x: p.x, z: p.z, w: p.w, d: p.d, rot: deg(p.yaw || 0) }, flat: true };
  }
  function makeProp(p) {
    const t = tpl.get(p.file);
    if (!t || !t.ok) return null;
    const { box } = yawBox(t, p.yaw || 0);
    const k = p.h / (box.max.y - box.min.y);
    const glb = t.scene.clone(true);
    glb.rotation.y = deg(p.yaw || 0);
    const mid = new T.Group();
    mid.add(glb);
    mid.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
    const node = new T.Group();
    node.add(mid);
    node.scale.setScalar(k);
    node.position.set(p.x, 0, p.z);
    markVisual(node);
    return { node, rect: { x: p.x, z: p.z, w: (box.max.x - box.min.x) * k, d: (box.max.z - box.min.z) * k, rot: 0 } };
  }
  function props(parent, built, roomId) {
    cur.parent = parent; cur.roomId = roomId; cur.built = built;
    clearProps();
    propsWanted = on && !!PROPS[roomId];
    if (!propsWanted || !parent) return 0;
    propGroup = new T.Group();
    propGroup.name = 'v2props';
    propGroup.userData.v2dress = true;
    parent.add(propGroup);
    const k = furnK();
    const need = [];
    const realPresets = new Set(((cur.roomDef && cur.roomDef.furniture) || []).map(f => f && f.preset));
    for (const p of PROPS[roomId]) {
      if (p.preset && realPresets.has(p.preset)) continue;    // 진짜 가구가 있다 — 그 가구가 옷을 입는다
      if (p.flag && !flags.has(p.flag)) continue;               // 깃발 소품(가게 입간판) — 켜질 때만
      let made = null;
      if (p.rug) made = makeRug(p);
      else if (tpl.has(p.file)) made = makeProp(p);
      else { need.push(p.file); continue; }
      if (!made) continue;
      made.id = p.id;
      made.node.traverse(o => { if (o.isMesh) dimProp(o.material, k); });
      propGroup.add(made.node);
      propList.push(made);
    }
    applyYield();
    if (held) propGroup.visible = false;
    /* 소품은 부팅을 안 막는다 — 방이 뜬 뒤 천천히 받는다 */
    if (need.length) {
      const g0 = propGroup;
      setTimeout(() => Promise.all([...new Set(need)].map(load)).then(() => {
        if (disposed || !on || propGroup !== g0) return;
        props(parent, built, roomId);
        onChange('props');
      }), opt.propDelayMs ?? 1200);
    }
    return propList.length;
  }

  /* ── 비켜 주기 — 놓인 화분·가구와 겹치는 소품은 숨긴다(러그는 납작해 그대로) ── */
  /* 축정렬 반폭(가구 회전은 발자국 w·d 를 돌려서) */
  function extOf(r) {
    const c = Math.abs(Math.cos(r.rot || 0)), s = Math.abs(Math.sin(r.rot || 0));
    return [(r.w * c + r.d * s) / 2, (r.w * s + r.d * c) / 2];
  }
  function overlap(a, b, pad = 0.02) {
    const [ax, az] = extOf(a), [bx, bz] = extOf(b);
    return Math.abs(a.x - b.x) < ax + bx - pad && Math.abs(a.z - b.z) < az + bz - pad;
  }
  /* 가구 발자국이 소품을 **통째로** 품으면(책상 밑 빨래통) 일부러 둔 것이다 — 안 숨긴다 */
  function contains(o, r) {
    const [ox, oz] = extOf(o), [rx, rz] = extOf(r);
    return Math.abs(r.x - o.x) + rx <= ox + 1e-6 && Math.abs(r.z - o.z) + rz <= oz + 1e-6;
  }
  function applyYield() {
    if (!propList.length) return 0;
    const obs = [];
    /* 화분은 받은 목록에서, 가구는 **지금 방**의 충돌 목록에서(받은 목록은 옛 방일 수 있다) */
    for (const c of (lastColliders || [])) if (c && c.plant) obs.push(c);
    const b = cur.built;
    if (b && Array.isArray(b.colliders)) for (const c of b.colliders) if (c.kind === 'furn') obs.push(c);
    let hiddenN = 0;
    for (const p of propList) {
      const hit = !p.flat && obs.some(o => {
        const r = { x: o.x, z: o.z, w: o.w, d: o.d, rot: o.rot || 0 };
        return overlap(p.rect, r) && !(!o.plant && contains(r, p.rect));
      });
      p.node.visible = !hit;
      if (hit) hiddenN++;
    }
    return hiddenN;
  }
  function yieldTo(colliders) {
    lastColliders = colliders || null;
    const decorVis = () => { const a = []; if (cur.built && cur.built.furniture) cur.built.furniture.traverse(o => { if (o.userData && o.userData.v2decor) a.push(o.visible); }); return a.join(); };
    const before = propList.map(p => p.node.visible).join() + '|' + decorVis();
    applyYield();
    applyDecorYield();
    return before !== propList.map(p => p.node.visible).join() + '|' + decorVis();
  }
  /* 접지 그림자 판에 얹을 소품 발자국(보이는 것만 · 러그 빼고) */
  function blobRects() {
    if (held) return [];
    return propList.filter(p => !p.flat && p.node.visible).map(p => ({ ...p.rect }));
  }
  function setHeld(v) {
    v = !!v;
    if (v === held) return held;
    held = v;
    if (on) {
      if (held) undress(cur.built);
      else dress(cur.built, cur.roomDef);
      if (propGroup) propGroup.visible = !held;
      onChange('held');
    }
    return held;
  }

  function setEnabled(v) {
    v = !!v;
    if (v === on) return on;
    on = v;
    if (!on) { undress(cur.built); clearProps(); }
    else {
      dress(cur.built, cur.roomDef);
      if (cur.parent) props(cur.parent, cur.built, cur.roomId);
    }
    onChange('toggle');
    return on;
  }

  const api = {
    get enabled() { return on; },
    furnReady, preload, dress, props, yieldTo, blobRects, setEnabled, setSeason, setFlag,   // setSeason: 달력 쪽 · setFlag: 깃발 소품(10-10)
    hasDress: preset => !!specOf(preset) || !!DECOR['preset:' + preset],   // 이 프리셋에 v2 그림(옷·색 변형·위 소품)이 있나 — 가구점 그림 자(tools/shot_furn_thumbs)가 묻는다
    set: setEnabled,
    hold: setHeld,
    get held() { return held; },
    report() {
      return { on, held, furniture: Object.fromEntries(report),
               props: propList.map(p => ({ id: p.id, visible: p.node.visible,
                 rect: Object.fromEntries(Object.entries(p.rect).map(([k, v]) => [k, +(+v).toFixed(3)])) })) };
    },
    dispose() {
      disposed = true;
      clearProps();
      if (rugTex) rugTex.dispose();
      if (rugMat) rugMat.dispose();
      for (const [, g] of rugGeo) g.dispose();
      for (const [, m] of topTexMats) { if (!m) continue; if (m.map) m.map.dispose(); m.dispose(); }
      topTexMats.clear(); topTexLoading.clear();
      rugGeo.clear();
    }
  };
  try { if (typeof window !== 'undefined') { window.__v2 = window.__v2 || {}; window.__v2.furn = api; } }
  catch (_) { /* 창 없음 */ }
  return api;
}
