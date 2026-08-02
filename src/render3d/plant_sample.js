/* ============================================================
   render3d/plant_sample.js — 몬스테라 정지 샘플 (임시)
   ------------------------------------------------------------
   ★ 이건 '자라지 않는' 샘플이다. 성장 단계 재현은 하지 않는다.

   진짜 조립 로직은 plant_grow.html 안에 인라인으로 있고(buildPlant/setGrowth),
   그 파일은 생장 작업창 담당이라 여기서 건드리지 않는다.
   나중에 생장 창이 assemble(growthDays) → THREE.Group 형태로 모듈을 빼주면
   이 파일을 그걸로 갈아끼우면 된다. 그때까지의 자리채움.

   조도 연동도 '표현'만 한다 — 밴드에 따라 잎 색·처짐만 바꾼다.
   자라거나 죽는 판정은 계약 객체(daily_light)를 받은 생장 창 몫이다.

   ※ assets/monstera 는 잎 작업창 담당이라 읽기만 한다.
============================================================ */

const BASE = './assets/monstera';

/* 에셋은 전부 1m 안팎의 유닛 스케일로 뽑혀 있다(잎 mature가 2.0m).
   실제 화분에 맞추려면 줄여야 한다. */
const SRC_LEAF_H = 1.99;      // monstera_leaf_mature 의 y 크기
const SRC_POT_W  = 0.98;      // pot_c1 의 x 크기

let _loader = null;
const loader = () => (_loader ||= new THREE.GLTFLoader());
const load = url => new Promise((res, rej) => loader().load(url, res, undefined, rej));

/* 같은 GLB를 여러 번 쓰므로 한 번만 받아서 복제한다 */
const _cache = new Map();
async function part(name) {
  if (!_cache.has(name)) _cache.set(name, load(`${BASE}/${name}.glb`).then(g => g.scene));
  const src = await _cache.get(name);
  return src.clone(true);
}

/* 밴드별 잎 표현 — 색조와 처짐. 자라는 게 아니라 '상태가 보이는' 정도. */
export const BAND_LOOK = {
  /* 키는 daily_light.js 의 BANDS 와 같아야 한다. 어긋나면 조용히 unknown(흰색·꼿꼿)이
     되어 "빛이 부족한데 멀쩡해 보이는" 상태가 된다 — 티가 안 나는 종류의 버그다. */
  critical: { tint: 0x9a8f5a, droop: 0.55, scale: 0.85 },  // 누렇게 · 축 처짐
  poor:     { tint: 0xa8a862, droop: 0.40, scale: 0.90 },
  stagnant: { tint: 0xa9b878, droop: 0.22, scale: 0.95 },  // 옅은 초록 · 살짝 처짐
  slow:    { tint: 0xbcd39a, droop: 0.10, scale: 1.00 },
  good:    { tint: 0xffffff, droop: 0.00, scale: 1.00 },   // 원래 색
  best:    { tint: 0xffffff, droop: -0.05, scale: 1.05 },  // 살짝 치켜듦
  over:    { tint: 0xe8dfa8, droop: 0.15, scale: 0.95 },   // 과광 = 탈색
  unknown: { tint: 0xffffff, droop: 0.00, scale: 1.00 }
};

/* 잎 배치 — [파일, 높이비, 방위각(°), 기울기(°), 크기비] */
const LAYOUT = [
  ['monstera_leaf_mid1',   0.30,   20, 62, 0.70],
  ['monstera_leaf_young',  0.42,  145, 55, 0.60],
  ['monstera_leaf_mature', 0.62,  255, 44, 1.00],
  ['monstera_leaf_mid2',   0.78,   75, 38, 0.78],
  ['monstera_bud_furled',  0.90,  190, 14, 0.45]
];

/* ============================================================
   createPlantSample({ potD, height }) → Group (바닥 y=0 기준)
     potD   화분 지름[m] — 슬롯의 maxPotD를 넣으면 딱 맞는다
     height 식물 전체 높이[m]
============================================================ */
export async function createPlantSample(opt = {}) {
  const potD = opt.potD ?? 0.18;
  const H    = opt.height ?? Math.max(0.28, potD * 3.2);

  const g = new THREE.Group();
  g.userData.leaves = [];

  // ---- 화분 ----
  const pot = await part('pot_c1');
  const kPot = potD / SRC_POT_W;
  pot.scale.setScalar(kPot);
  const potBB = new THREE.Box3().setFromObject(pot);
  pot.position.y -= potBB.min.y;
  g.add(pot);
  const rim = (potBB.max.y - potBB.min.y);      // 화분 높이 = 잎이 시작하는 곳

  /* ---- 줄기 ----
     ★ [추가 2026-08-03] 배치표에 잎만 있어서 **줄기가 아예 안 그려졌다.**
       잎이 허공에 붙어 "식물이 날아다닌다"로 보였다(박사님 지적).
       assets/monstera 에 stem_* 다섯 개가 이미 있는데 하나도 안 쓰고 있었다.
       샘플이라 마디 트리는 만들지 않는다 — 곧은 줄기 하나로 잎을 이어 준다.
       (진짜 마디 조립은 plant_grow.html 의 buildPlant 몫이다.) */
  let stemTop = rim;
  try {
    const stem = await part('stem_mid_1');
    const sbb0 = new THREE.Box3().setFromObject(stem);
    const srcH = Math.max(1e-4, sbb0.max.y - sbb0.min.y);
    const kStem = (H - rim) * 0.92 / srcH;          // 맨 위 잎이 줄기 끝보다 조금 위로 나오게
    stem.scale.setScalar(kStem);
    const sbb = new THREE.Box3().setFromObject(stem);
    stem.position.y = rim - sbb.min.y;              // 밑동을 화분 입구에
    g.add(stem);
    g.userData.stem = stem;
    stemTop = rim + (sbb.max.y - sbb.min.y);
  } catch { /* 줄기가 없으면 잎만 그린다 — 예전 동작 그대로다 */ }

  // ---- 잎 ----
  const leafK = (H - rim) / SRC_LEAF_H * 1.25;
  for (const [name, hRatio, az, tilt, sz] of LAYOUT) {
    let leaf;
    try { leaf = await part(name); }
    catch { continue; }                          // 없는 파트는 건너뛴다
    const k = leafK * sz;
    leaf.scale.setScalar(k);

    const pivot = new THREE.Group();             // 잎자루 밑동을 회전 중심으로
    pivot.add(leaf);
    const bb = new THREE.Box3().setFromObject(leaf);
    leaf.position.y -= bb.min.y;                 // 잎 밑을 pivot 원점에

    /* ★줄기를 따라 퍼뜨린다. 예전 ×0.35 는 잎을 전부 아래 3분의 1에 뭉쳐 놓아
       줄기가 없던 것과 겹쳐 "잎 뭉치"로 보였다. 줄기 길이를 그대로 쓴다. */
    pivot.position.y = rim + (stemTop - rim) * hRatio;
    pivot.rotation.y = az * Math.PI / 180;
    pivot.rotation.x = tilt * Math.PI / 180;
    pivot.userData.baseTiltX = pivot.rotation.x;
    g.add(pivot);
    g.userData.leaves.push(pivot);
  }

  /* ★ [수정 2026-08-03] 조립 뒤 실제 높이를 재서 요청값에 맞춘다.
     전에는 leafK 가 **잎 한 장을** (H-rim)×1.25 로 키웠다. LAYOUT 의 크기비가 1.00 인
     monstera_leaf_mature 는 그래서 식물 전체보다 커졌고 — 화분 지름의 4.9배 —
     화면에서 잎 한 장이 방을 가로질러 날아다녔다(나머지 잎은 1.6~1.9배로 정상).
     조립 결과도 요청 0.71m 에 실제 1.04m 로 46% 넘쳐 자리 한도 계약이 깨졌다.

     상수를 다시 맞추는 대신 **재서 맞춘다** — 잎 GLB 가 바뀌어도 다시 안 깨진다.
     화분은 건드리지 않는다. potD 는 슬롯 한도라 줄이면 안 되는 값이다. */
  {
    const leaves = g.userData.leaves;
    if (leaves.length) {
      const bb = new THREE.Box3().setFromObject(g);
      const grown = bb.max.y - rim;                    // 화분 위로 올라간 실제 높이
      const want  = H - rim;
      if (grown > 1e-4 && want > 0) {
        const k = want / grown;
        for (const pivot of leaves) {
          pivot.scale.multiplyScalar(k);
          pivot.position.y = rim + (pivot.position.y - rim) * k;
        }
      }
    }
  }

  g.traverse(o => {
    if (o.isMesh) {
      o.castShadow = true; o.receiveShadow = true;
      if (o.material) {
        o.material = o.material.clone();         // 개체마다 색을 따로 주려면 복제 필요
        if (o.material.map) o.material.map.encoding = THREE.sRGBEncoding;
      }
    }
  });

  g.userData.size = { w: potD, d: potD, h: H };
  g.userData.isPlantSample = true;
  return g;
}

/* 밴드 적용 — 색·처짐. 자라는 게 아니다. */
export function applyBand(plant, band) {
  const look = BAND_LOOK[band] || BAND_LOOK.unknown;
  for (const pivot of (plant.userData.leaves || [])) {
    pivot.rotation.x = pivot.userData.baseTiltX + look.droop;
    pivot.scale.setScalar(look.scale);
    pivot.traverse(o => {
      if (o.isMesh && o.material && o.material.color) o.material.color.setHex(look.tint);
    });
  }
  plant.userData.band = band;
}
