# musun(방 3D) → plan

> **한눈에 (2026-08-05 · 방뷰 창)**
>
> | | |
> |---|---|
> | **한 일** | `room_view.js` 가 `kind:'musun'` 을 그린다. 재배판(container_tray_s) + 무순 12칸 |
> | **화면이 할 일** | `game.html` 에서 무순 자리를 이 시그니처로 그리면 끝이다(§1). 방뷰 쪽은 더 고칠 것 없다 |
> | **판단 필요** | ① 무순 지름을 **대각선 0.4327** 로 잡았다(§2). 그러면 반지하에서 올라가는 자리가 desk 2칸뿐이다 — 그게 기획 의도인지 |
> | **회귀** | 콩나물 12가지 · 몬스테라 10가지를 숫자로 비교했다. **한 톨도 안 바뀌었다**(§3) |
> | **검사** | `node tools/test_musun_view.mjs` 20/20 · 기존 20개 파일 전부 통과(§4) |

---

## 0. 왜 급했나

상점에서 무 씨앗 + 새싹 재배판을 4,800원에 살 수 있는데 심을 데가 없었다.
코어(`first_play.js`)는 `musun` 을 완전히 지원하는데 방 3D 의 `buildPlant` 가
`monstera`·`beansprout` 둘만 알고 나머지는 `모르는 식물 종류` 로 던졌다. 화면만 없었다.

---

## 1. game.html 이 부를 정확한 시그니처

콩나물(`beansprout`) 블록 바로 아래에 같은 모양으로 한 벌 더 두면 된다.
**새 함수는 없다.** `setPlantAt` / `setPlant` 그대로다.

```js
/* 무순 자리 — 콩나물과 같은 길이다. 다른 것은 kind 와 potD 둘뿐이다. */
import { CROP_SITE_IDS, cropKindOf, cropSiteOf } from './src/game/first_play.js';

const site = cropSiteOf(S.firstPlay, 'musun');        // fp.crops[0] · 자리 이름 'crop_02'
if (site && (site.at || site.slotId)) {
  const days = cropKindOf('musun').harvestDays;       // 7
  /* ★ progress01 을 반드시 넘긴다. 콩나물에서 lerp(4,11,undefined) → NaN → 0포기가 났다.
     (무순 쪽은 방뷰가 유한한 수만 믿게 막아 뒀지만, 넘기는 쪽이 정본이다) */
  const p01 = Math.max(0, Math.min(1, (site.ageDays || 0) / Math.max(1, days)));

  const spec = {
    kind: 'musun',                       // ← 이 한 낱말이 재배판+무순을 부른다
    progress01: p01,                     // 0 → 1. 3포기(소) … 12포기(대)
    potD: roomView.plantPotD('musun'),   // ← ★ potD 자리에 넣을 값. 아래 설명
    potId: CROP_SITE_IDS.musun           // 'crop_02'
  };

  Promise.resolve(site.at && roomView.setPlantAt
    ? roomView.setPlantAt(CROP_SITE_IDS.musun, site.at, spec)
    : roomView.setPlant(site.slotId, spec)).catch(warn('무순'));
}
```

### potD 자리에 무엇을 넣나

**숫자를 베끼지 말고 방뷰에 물어라.** 창구를 새로 냈다.

```js
roomView.plantPotD('musun')       // 0.4326661530556787  (재배판 대각선)
roomView.plantPotD('beansprout')  // 0.24  (예전 그대로)
roomView.plantPotD('monstera')    // 0.20  (예전 그대로)
roomView.plantPotD('없는것')       // 0.20  (예전 그대로 — 모르는 이름의 기본값)
roomView.plantKinds()             // [{kind, potD, growthByDays}, ...] 그릴 줄 아는 종류 전부
```

숫자를 `game.html` 에 베껴 두면 두 곳이 갈린다. 정본은 `room_view.js` 의 `PLANT_KINDS` 표다.

### 배치 UI(끌어다 놓기) 쪽

콩나물이 `OPEN_SIRU.diameterM` 을 쓰던 자리에 **같은 값**을 쓰면 된다.

```js
const potD = roomView.plantPotD('musun');
roomView.surfaceAt(px, py, { potD });
roomView.previewAt(at, { potD, valid: hit.ok, potId: CROP_SITE_IDS.musun });
roomView.showSlotRings(true, { potD, near, nearMax: 0.45 });   // 또는 { plantId: 'musun' }
roomView.showGrid(true, { potD });
```

`showSlotRings` 는 `potD` 를 안 주면 `plantId` 로 표를 찾는다 — `'musun'` 도 이제 안다.

---

## 2. limit(자리 여유 폭)을 어떻게 처리했나, 그리고 왜

### 사실

| | 시루(콩나물) | 재배판(무순) |
|---|---|---|
| 파일 | `crops/container_siru_open.glb` | `crops/container_tray_s.glb` |
| 모양 | 원형 | **네모** |
| size_m | 0.24 × 0.109 × 0.24 | **0.36** × 0.055 × **0.24** |
| 폭 | 0.24 | 0.36 |
| **회전무관 지름(대각선)** | 0.24 | **0.4327** |
| 슬롯 | 15칸 | 12칸 (4열 × 3행) |
| blocks_light | true | **false** |

시루는 원형이라 "폭 = 회전무관 지름" 이 그냥 성립했다. 그래서 `SIRU_D` 하나로 다 됐다.
재배판은 폭과 깊이가 달라서 그 등식이 깨진다.

### 정한 것 — **폭(0.36)이 아니라 대각선(0.4327)** 을 이 판의 지름으로 잡는다

`want = min(0.4327, limit)` 로 두고, 모자라면 판 **전체**를 `want / 지금대각선` 배로 줄인다.

### 근거 세 가지

1. **이 파일의 자리 판정이 전부 회전무관 지름 한 벌이다.**
   `potFits` · `maxPotD` · `fitPotToLimit` · `surfaceAt` 이 전부 그 자를 쓴다.
   그렇게 정한 이유가 `room_view.js` §`rotationSafeDiameter` 에 적혀 있다 —
   네모 화분(`pot_concrete_square.glb`)을 bbox 폭 0.200 으로 재서 창턱 한도 0.21 을
   통과시켰다가, 대각선이 0.275 라 실제로는 못 올라갔던 사고다.
   **재배판은 그 사고의 판박이다.** 폭만 보고 통과시키면 같은 일이 다시 난다.
2. **플레이어가 판을 실제로 돌린다.** `setPlantYaw` 가 있고 게임이 쓴다.
   폭 0.36 으로 통과시킨 판을 45° 돌리면 모서리가 자리 밖으로 3.6cm 나간다.
3. **두 번 안 줄어든다.** `want` 를 대각선에 맞춰 두면 나중에 `fitPotToLimit` 이 같은 자로
   다시 재도 정확히 `want` 라 재축소도, `[방뷰] … 로 줄였습니다` 경고도 안 난다.
   (콩나물이 `want / cur` 로 하는 것과 **같은 사상**이다. 자만 폭에서 대각선으로 바뀌었다)

### 그래서 생기는 결과 — ★ 기획 판단이 필요한 지점

반지하 추천 자리 14칸 중 `maxPotD ≥ 0.4327` 인 곳은 **desk 2칸(0.57)뿐**이다.
(잰 값: 창턱 0.21 · 책상 0.57 ×2 · 서랍장 0.42 ×2 · 선반 0.25 ×9)
★ **서랍장이 0.42 라 1.3cm 차이로 떨어진다.** 폭 0.36 으로 쟀다면 통과했을 자리다 —
아래 근거 ①②를 안 받아들이면 제일 먼저 바뀔 두 칸이 여기다.
나머지 자리에 놓으면 판이 그 한도까지 **통째로 작아진다**.
"안 들어가면 조용히 걸쳐 두지 않는다"가 이 파일의 계약이라 줄이는 것 자체는 맞다.
다만 무순은 밝아야 좋은 작물인데 제일 밝은 창턱(DLI 3.77)이 0.21 이라
**제 크기로는 못 올라간다.** 이게 의도한 긴장인지, 아니면
① 재배판보다 작은 용기를 하나 더 만들지 ② 창턱 `maxPotD` 를 늘릴지는 기획이 정할 일이다.
(둘 다 이 창 소유가 아니다 — `assets/`·`data/` 는 안 건드렸다)

### 자리 안 배치

무순은 **격자**로 선다. 원형으로 흩뿌리지 않았다 — 그러면 재배판이 아니라 화분이 된다.
칸 좌표는 manifest 의 `container_tray_s.slots` 12칸을 그대로 옮겼다
(x ∈ {−0.108, −0.036, 0.036, 0.108} · z ∈ {−0.06, 0, 0.06} · y = 0.026).

| progress01 | 0 | 0.1 | 0.2 | 0.3 | 0.4 | 0.5 | 0.6 | 0.7 | 0.8 | 0.9 | 1.0 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 포기 수 | 3 | 4 | 5 | 6 | 7 | 8 | 8 | 9 | 10 | 11 | 12 |
| 단계 GLB | 소 | 소 | 소 | 소 | 중 | 중 | 중 | 대 | 대 | 대 | 대 |

단계 경계(0.34 · 0.7)는 콩나물과 **같은 눈금**을 썼다.
0칸에서 시작하지 않는다 — 빈 판은 옛 NaN 사고(0포기)와 눈으로 구별이 안 된다.

밑동 높이는 재서 맞췄다: 재배판 GLB 안에 `soil` 상자가 있고 그 **윗면이 정확히 y=0.026**,
곧 manifest 슬롯 y 와 같은 값이다. 무순은 흙 위에 정확히 앉는다(뜨지도 박히지도 않는다).

---

## 3. 회귀 검사 ①의 실제 숫자

무순을 붙이기 **전에** 같은 방(banjiha)·같은 자유 좌표 (0.5, 0.02, 0.5)에서 잰 값을
`tools/test_musun_view.mjs` 의 `GOLD` 표에 못 박고, 붙인 **뒤에** 다시 재서 비교한다.
눈으로 안 본다. 22가지 전부 **차이 0** 이다(허용오차 1e-4 인데 실제 차이는 0).

### 콩나물 — `{ kind:'beansprout', progress01, potD }`

| progress01 | potD | 자식 수 | 포기 | 지름 | 시루 bbox (w×h×d) | 전후 |
|---|---|---|---|---|---|---|
| 0    | — | 5 | 4 | 0.24 | 0.24 × 0.109 × 0.24 | 같음 |
| 0    | 0.18 | 5 | 4 | 0.18 | 0.18 × 0.08175 × 0.18 | 같음 |
| 0.2  | — | 6 | 5 | 0.24 | 0.24 × 0.109 × 0.24 | 같음 |
| 0.2  | 0.18 | 6 | 5 | 0.18 | 0.18 × 0.08175 × 0.18 | 같음 |
| 0.34 | — | 7 | 6 | 0.24 | 0.24 × 0.109 × 0.24 | 같음 |
| 0.34 | 0.18 | 7 | 6 | 0.18 | 0.18 × 0.08175 × 0.18 | 같음 |
| 0.5  | — | 9 | 8 | 0.24 | 0.24 × 0.109 × 0.24 | 같음 |
| 0.5  | 0.18 | 9 | 8 | 0.18 | 0.18 × 0.08175 × 0.18 | 같음 |
| 0.7  | — | 10 | 9 | 0.24 | 0.24 × 0.109 × 0.24 | 같음 |
| 0.7  | 0.18 | 10 | 9 | 0.18 | 0.18 × 0.08175 × 0.18 | 같음 |
| 1    | — | 12 | 11 | 0.24 | 0.24 × 0.109 × 0.24 | 같음 |
| 1    | 0.18 | 12 | 11 | 0.18 | 0.18 × 0.08175 × 0.18 | 같음 |

자리는 12가지 모두 (0.5, 0.02, 0.5) 그대로다.
⚠ 콩나물 **몸통 각도에는 `Math.random` 이 들어 있다**(내가 넣은 게 아니라 원래 그렇다).
그래서 그루 전체 bbox 높이만 매번 ±0.0005 흔들린다 — 회귀는 흔들리지 않는 값
(용기 bbox · 지름 · 포기 수 · 자리)으로 못 박았다.

### 몬스테라 — `{ kind:'monstera', growthDays, seed:7, band:'good', potD }`

| growthDays | potD | 지름 | 화분 bbox (w×h×d) | 그루 높이 | 전후 |
|---|---|---|---|---|---|
| 0   | — | 0.20 | 0.19811 × 0.13321 × 0.19743 | 0.13321 | 같음 |
| 0   | 0.14 | 0.14 | 0.13868 × 0.09324 × 0.1382 | 0.09324 | 같음 |
| 60  | — | 0.20 | 0.19811 × 0.13321 × 0.19743 | 0.37251 | 같음 |
| 60  | 0.14 | 0.14 | 0.13868 × 0.09324 × 0.1382 | 0.26076 | 같음 |
| **143** | — | 0.20 | 0.19811 × 0.13321 × 0.19743 | **0.51354** | 같음 |
| 143 | 0.14 | 0.14 | 0.13868 × 0.09324 × 0.1382 | 0.35947 | 같음 |
| **146** | — | 0.20 | 0.19811 × 0.13321 × 0.19743 | **0.51862** | 같음 |
| 146 | 0.14 | 0.14 | 0.13868 × 0.09324 × 0.1382 | 0.36303 | 같음 |
| 300 | — | 0.20 | 0.19811 × 0.13321 × 0.19743 | 0.6071 | 같음 |
| 300 | 0.14 | 0.14 | 0.13868 × 0.09324 × 0.1382 | 0.42497 | 같음 |

143 · 146 을 일부러 넣었다 — `test_maturation` 의 재현 G(143 → 적정광 3턴 → 146 `spear_furled`)가
지나는 안전선이다. 두 줄 다 소수 다섯째 자리까지 같다.

### 지름을 묻는 창구

| 창구 | 콩나물 | 몬스테라 | 모르는 이름 | 무순(새로) |
|---|---|---|---|---|
| `showSlotRings` 통과 칸 수 (14칸 중) | 13 | 14 | 14 | 2 |
| `fitCheck(slot, {kind})` 지름 | 0.24 | 0.20 | 0.20 | 0.43267 |
| `plantPotD(kind)` | 0.24 | 0.20 | 0.20 | 0.43267 |

앞 세 열이 전부 예전 삼항의 답과 같다. **모르는 이름이 0.20 으로 떨어지는 것까지 같다** —
표로 바꾸면서 이 폴백을 놓치면 삽수(`kind:'monstera'` 로 그리는 것)가 조용히 어긋난다.

### 조도 계약 (검사 ④)

`container_tray_s` 는 `blocks_light:false` 다. 방뷰는 화분을 가림막으로 넣지 않으므로
(조도는 `light_adapter` 한 벌이 낸다) 재배판을 놓아도 DLI 가 안 바뀌어야 한다.
자유 좌표 1점 + 추천 자리 14점, 총 15점을 놓기 전/후로 읽어 **차이 0** 을 확인했다.

| 지점 | 놓기 전 DLI | 놓은 뒤 DLI |
|---|---|---|
| 자유 좌표 (0.5, 0.02, 0.5) | 0.15 | 0.15 |
| `banjiha-sill:0` | 3.77 | 3.77 |
| `banjiha-desk:0` | 0.48 | 0.48 |
| `banjiha-etagere:0`~`5` | 0 | 0 |
| (나머지 8점) | — | 전부 같음 |

---

## 4. 검사

```
python tools/serve.py 8987 .          # ★ 8960·8971·8981·8995 는 다른 것이 쓴다
node tools/test_musun_view.mjs        # 20/20 PASS (스크린샷 3장 포함)
```

- `tools/test_musun_view.mjs` — 20/20
- 기존 `tools/test_*.mjs` 20개 파일 — 전부 통과
- 스크린샷 `docs/engine/shots/musun_{empty,half,full}.png` — 재배판 위 3 → 8 → 12포기

⚠ **`test_outside.mjs` 는 이 가지(worktree)에 없다.** 지시에는 "23개 · `test_outside` 도
방금 들어왔다"고 되어 있는데, 이 작업 가지가 갈라져 나온 시점(`0e2622f`)에는
`test_*.mjs` 가 20개(+ 도구인 `test_cdp.mjs`)뿐이다. 병합은 금지라 그대로 뒀다 —
합칠 때 `test_outside` 도 같이 돌려 주시면 된다.

⚠ `test_roomview_walk.mjs` 의 `K 가는 쪽을 보고 걷는다` 는 **이 작업 전부터 간헐적으로**
`두 표본 사이에 안 움직여 못 쟀습니다` 로 떨어진다(타이밍). 손대기 전 기준 측정에서 한 번
났고 바로 다시 돌리니 44/44 였다. 이 작업과는 무관하다.

---

## 5. 무엇을 고쳤나

| 파일 | 무엇 |
|---|---|
| `src/game/room_view.js` | 재배판 상수·슬롯 12칸 표 · `buildMusun` · `PLANT_KINDS` 표 · 삼항 4곳 정리 · `plantPotD`/`plantKinds` 창구 |
| `tools/test_musun_view.mjs` | 새로 씀 (20검사) |
| `docs/engine/shots/musun_*.png` | 새로 찍음 3장 |

`game.html` · `data/` · `assets/` · `first_play.js` · `loop.js` · `state.js` · `shop.js` ·
`plant_grow.html` · 전역 생장 곡선은 **한 글자도 안 건드렸다.**

### 삼항 → 표

종류가 갈리던 네 군데를 표 한 벌로 모았다. 다음 작물은 이 표에 한 줄이면 된다.

```js
const PLANT_KINDS = Object.freeze({
  monstera:   { potD: MONSTERA_POT_D, growthByDays: true,  build: buildMonstera },
  beansprout: { potD: SIRU_D,         growthByDays: false, build: buildBeansprout },
  musun:      { potD: TRAY_S_D,       growthByDays: false, build: buildMusun }
});
const potDOf        = kind => (PLANT_KINDS[kind] || PLANT_KINDS.monstera).potD;  // 모르면 0.20
const usesGrowthDays = kind => !!(PLANT_KINDS[kind] && PLANT_KINDS[kind].growthByDays);
```

바꾼 곳: `showSlotRings` 의 지름 · `fitCheck` 의 지름 · `setPlant`/`setPlantAt` 의
`kind === 'monstera'` 두 곳 · `buildPlantGroup` 의 분기.
`buildPlantGroup` 은 여전히 모르는 종류를 **던진다**(이제 아는 이름을 같이 말해 준다).

---

## 6. 못 한 것 / 판단이 필요한 것

- [ ] **무순이 제일 밝은 자리에 못 올라간다** (§2 끝). 창턱 `maxPotD` 0.21 < 재배판 0.4327.
      제 크기로 놓으려면 자리 치수나 용기 하나가 더 필요하다 — 둘 다 이 창 소유가 아니다.
- [ ] `showGrid(on, opt)` 는 아직 `plantId` 를 안 받는다(`potD` 만 받는다).
      배치 UI 는 `potD` 를 이미 넘기고 있어 지금은 문제가 없다. 손대면 계약이 넓어져서 안 했다.
- [ ] 무순은 밴드(빛 품질) 색을 안 입는다. `applyLook` 이 `isPlantAssembled` 또는
      `kind==='monstera'` 에서만 도는데, **콩나물도 마찬가지**라 일부러 같은 상태로 뒀다.
      "웃자라 밍밍/파릇하고 알싸"를 색으로 보이게 할지는 기획이 정할 일이다.
- [ ] 세 작물째 자리는 `first_play.js` 가 아직 안 연다(끼니 상한). 방뷰는 준비돼 있다.
