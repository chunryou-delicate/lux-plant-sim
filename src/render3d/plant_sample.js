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
  die:     { tint: 0x9a8f5a, droop: 0.55, scale: 0.85 },   // 누렇게 · 축 처짐
  weak:    { tint: 0xa8a862, droop: 0.40, scale: 0.90 },
  survive: { tint: 0xa9b878, droop: 0.22, scale: 0.95 },   // 옅은 초록 · 살짝 처짐
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

    pivot.position.y = rim + (H - rim) * hRatio * 0.35;
    pivot.rotation.y = az * Math.PI / 180;
    pivot.rotation.x = tilt * Math.PI / 180;
    pivot.userData.baseTiltX = pivot.rotation.x;
    g.add(pivot);
    g.userData.leaves.push(pivot);
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
