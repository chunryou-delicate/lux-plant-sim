# 2026-08-08 · pots → plan (화분 종류를 늘리고, 바꿔 끼는 규칙을 정했다)

박사님 확정(2026-08-08): *"화분 종류를 늘려서 **바꿔 낄 수 있도록** 해줘."*

**새 에셋을 안 만들었다.** 있는 GLB 를 열어 지름을 직접 쟀다.
**새 밸런스 숫자도 안 만들었다.** 값은 `docs/shop.md §2` 가 이미 정한 용기값 5,000원 그대로다.

---

# 한눈에

| | |
|---|---|
| 화분 종류 | **5종** (모양) × 색 3갈래(있는 것만) = 에셋 11장 |
| 지름 | **전부 잰 값이다.** GLB 의 `2 × max √(x²+z²)` × 매니페스트 `scale_to_real`, 0.1mm 올림 |
| 값 | **전부 정가 5,000 / 살 때 7,000원** — 기존 `siru`·`pot`·`jar` 와 같은 줄. 새 숫자 0 |
| 이 일의 핵심 | 겉모습이 아니라 **지름**이다. 지름이 바뀌면 **놓을 수 있는 자리**가 바뀐다 |
| 자리 | 넷은 반지하 14칸 전부 · **콘크리트 사각만 4칸** (창턱 한 칸과 선반 아홉 칸을 잃는다) |
| 바꿔 끼기 | 굵어져서 지금 자리에 못 있게 되면 **막는다. 몰래 안 옮긴다** (`shop.canSwapPot`) |
| 고친 파일 | `src/game/shop.js` · `tools/test_pots.mjs`(새것) — **둘뿐이다** |
| 검사 | `node tools/test_pots.mjs` → **70/70 PASS** (화면·서버 필요 없음) |
| 남은 것 | `game.html` 창구 · **코어(state.js)의 갈아 끼우기 한 함수** · `room_view` 의 그리기 지름 |

## 화분 표 (숫자는 전부 잰 것이다)

| 종류 | 한글 이름 | 에셋 | **잰 지름[m]** | 표의 지름[m] | 살 때 | 반지하 자리 | 색 |
|---|---|---|---|---|---|---|---|
| `nursery` | 검은 모종포트 | `pots/pot_nursery_black.glb` | 0.131304 | **0.1314** | 7,000 | 14/14 | 검정 |
| `concrete_round` | 회색 콘크리트 화분 | `pots/pot_concrete_round.glb` | 0.180070 | **0.1801** | 7,000 | 14/14 | 회색·민트·핑크 |
| `terracotta` | 테라코타 화분 (나무받침) | `pots/pot_terracotta_wood.glb` | 0.200907 | **0.2010** | 7,000 | 14/14 | 테라코타·민트·핑크 |
| `ceramic` ★ | 크림도자기 화분 (나무받침) | `monstera/pot.glb` | 0.201983 | **0.2020** | 7,000 | 14/14 | 크림·민트·핑크 |
| `concrete_square` | 콘크리트 사각 화분 | `pots/pot_concrete_square.glb` | 0.275434 | **0.2755** | 7,000 | **4/14** | 콘크리트 |

★ `ceramic` 이 **지금 몬스테라가 신고 오는 화분**이다(`state.ARRIVAL.potAsset`).

---

# 1. 지금 어떻게 도나 — 읽고 적은 것

## 1-1. 화분은 한 종류밖에 없다. 그런데 **세이브는 이미 왕복하고 있었다**

```
state.js §ARRIVAL       potAsset: 'monstera/pot.glb'      ← 못 박혀 있다
state.givePlant:261     potAsset: ARRIVAL.potAsset        ← 고를 데가 없다
save.js  §packPot:188   potAsset: optStr(p.potAsset, …)   ← ★ 이미 저장·복원된다
```

⇒ **그릇을 담을 칸은 처음부터 있었다.** 없던 것은 「고르는 창구」와 「그 그릇이 몇 cm 인가」다.

## 1-2. 지름은 상태에 없다 — **상수 하나**가 그 자리에 서 있다

`first_play.FIRST_PLAY_ASSETS.monsteraPotDiameterM = 0.202` 하나다. 자리 판정 전부가 그것을 본다.

| 어디 | 무엇을 하나 |
|---|---|
| `first_play.slotFitsDiameter(slot, d)` | `maxPotD` 가 **숫자로 확인된** 슬롯만 받는다. 모르면 못 받는다 |
| `place.slotHolds` · `place.fitsOn` | 면 한도(`maxPotD`)와 견주고, 면 밖으로 삐져나오는지 본다 |
| `room_view.rotationSafeDiameter` · `potFits` | 실제 메시로 **다시 잰다**(회전 무관 지름) |
| `loop.js:1018` | 몬스테라가 도착할 자리를 그 지름으로 거른다. **0칸이면 던진다** |
| `game.html:1492` `ARRIVAL_POT_D` | 자리 목록·방뷰에 넘기는 `potD` |

## 1-3. ★★ 그래서 이 일의 핵심은 **지름**이다

화분을 바꾸면 지름이 바뀐다 → 자리 판정이 달라진다 → **놓을 수 있는 자리가 바뀐다.**

반지하 14칸의 한도(`data/profiles/room_profile.banjiha.json`):

| 한도 | 칸 수 | 무엇 |
|---|---|---|
| 0.21 m | 1 | **창턱** — 이 방에서 제일 밝은 자리(DLI 4.80) |
| 0.25 m | 9 | 선반(etagere) |
| 0.42 m | 2 | 서랍장 |
| 0.57 m | 2 | 책상 |

⇒ **0.2755m 짜리 네모 화분은 창턱 한 칸과 선반 아홉 칸을 잃고 4칸만 남는다.**
「예뻐 보여서 갈아 꼈더니 안 자란다」가 실제로 일어난다. 그래서 값이 아니라 **자리**가
이 화분이 치르는 값이다.

## 1-4. ⚠ 지금 방뷰는 화분을 **자리에 맞춰 줄여서 그린다**

`room_view.buildMonstera` 는 `potD = Math.min(MONSTERA_POT_D, limit)` 이고,
`plant_assemble.assemble` 은 **화분 지름이 `potD` 가 되도록 그루를 통째로 줄인다.**
즉 지금은 화분이 창턱에 맞춰 오그라든다.

⇒ 종류를 늘려도 **`MONSTERA_POT_D` 를 안 고치면 네모 화분이 0.20 으로 그려져 크림도자기와
같은 크기로 보인다.** 판정은 다른데 그림은 같은 상태가 된다 — 조용히 틀리는 유형이다.
`room_view.js` 는 다른 워커가 들고 있어 §5 에 「붙일 코드」로만 적었다.

---

# 2. 에셋 목록 — 매니페스트에 **이미 있는 것**을 세었다

`assets/manifest.json` 에서 `category/type` 이 「화분」인 항목은 **31개**, 그중 GLB 가 **15개**다.
GLB 15개를 전부 열어 재고, 쓸 수 있는 것만 골랐다.

## 2-1. 쓴 것 (11장 · 모양 5 × 색)

| 파일 | `name_ko` | 원본 회전지름 | `scale_to_real` | **실제[m]** |
|---|---|---|---|---|
| `monstera/pot.glb` | (없음 · 원화는 「화분-크림도자기-나무받침」) | 0.9911 | 0.2038 | **0.201983** |
| `monstera/pot_c1.glb` | 화분-크림도자기-나무받침-민트 | 0.9911 | 0.2038 | 0.201983 |
| `monstera/pot_c2.glb` | 화분-크림도자기-나무받침-핑크 | 0.9911 | 0.2038 | 0.201983 |
| `pots/pot_nursery_black.glb` | (없음 · 원화는 「검은 모종포트」) | 2.0201 | 0.065 | **0.131304** |
| `pots/pot_concrete_round.glb` | (없음 · 원화는 「회색 콘크리트 화분」) | 2.0008 | 0.09 | **0.180070** |
| `pots/pot_concrete_round_c1.glb` | 회색 콘크리트 화분-민트 | 2.0008 | 0.09 | 0.180070 |
| `pots/pot_concrete_round_c2.glb` | 회색 콘크리트 화분-핑크 | 2.0008 | 0.09 | 0.180070 |
| `pots/pot_terracotta_wood.glb` | 화분-테라코타-나무받침 | 2.0091 | 0.1 | **0.200907** |
| `pots/pot_terracotta_wood_c1.glb` | 화분-테라코타-나무받침-민트 | 2.0091 | 0.1 | 0.200907 |
| `pots/pot_terracotta_wood_c2.glb` | 화분-테라코타-나무받침-핑크 | 2.0091 | 0.1 | 0.200907 |
| `pots/pot_concrete_square.glb` | (없음 · 원화는 「화분-콘크리트-사각(실사)」) | 2.7543 | 0.1 | **0.275434** |

## 2-2. ⚠ 안 쓴 것 — **이유를 적는다**

| 파일 | 잰 값 | 왜 안 넣었나 |
|---|---|---|
| `pots/pot_glassjar.glb` (유리 수경병) | 0.096970 | **화분이 아니다.** 이미 `CATALOG.jar` 이고 물꽂이 삽수 용기다(`propagation.CONTAINERS.jar` · 팔면 돌아온다). 흙이 없어 몬스테라를 못 심는다 |
| `pots/pot_macrame_hanging.glb` (+민트·핑크) | 0.179350 | **걸이다.** 방의 자리는 전부 상판 위 좌표(`onUid` + `top`)라 **매다는 자리가 없다.** 지름은 쟀지만 갈 자리가 없어 품목이 못 된다 |
| `pots/pot_macrame.glb` | **못 쟀다** | 매니페스트에 항목이 없다 → `scale_to_real` 이 없다 → **실제 크기를 모른다.** 짐작한 지름은 「창턱을 통과한 뒤 바닥까지 삐져나오는」 사고가 된다 |

## 2-3. 어떻게 쟀나 — 그리고 **왜 그 방법이 맞다고 아는가**

```
회전 무관 지름 = 2 × max √(x² + z²)      (room_view.rotationSafeDiameter 와 같은 정의)
실제 지름      = 회전 무관 지름 × manifest.scale_to_real
표의 지름      = 실제 지름을 0.1mm 로 **올림**       (place.js §올림이다 — 내리면 겹친다)
```

- **bbox 로 재면 안 된다.** `pot_concrete_square` 는 bbox 0.2000m 이라 창턱 0.21 을
  통과하는 것처럼 보이는데 **대각선이 0.2755** 라 실제로는 못 올라간다.
  네모 화분은 돌리면 안 들어간다(`core-to-house.md` 2026-08-02 ④). 검사 A-2 가 이 차이를 못 박는다.
- ★★ **검산이 정확히 맞았다.** 크림도자기 화분의 잰 값이 **0.201983**, 올리면 **0.202** —
  이 저장소가 예전부터 손으로 적어 두던 `FIRST_PLAY_ASSETS.monsteraPotDiameterM` 과
  **한 자리도 안 다르다.** 재는 방법이 맞다는 증거이고, 검사 E-2 가 그 등식을 고정한다.
- GLB 는 `tools/test_pots.mjs` 가 **직접 읽는다**(의존성 0 · 이 저장소에는 `node_modules` 가 없다).
  Draco 압축은 하나도 없어 좌표를 그대로 읽을 수 있었다.

---

# 3. 값의 근거 — **새 숫자를 하나도 안 만들었다**

## 3-1. 다섯 종류 전부 정가 5,000 / 살 때 7,000원

`docs/shop.md §2` 「용기값 5,000원 — 이 문서가 새로 정한 유일한 값」이 이미 이렇게 적어 두었다.

> 정본에 있는 가장 싼 완제품에 맞췄다 — `sale_economy.md §4` 의 **묘목 5,000원**이다.
> (…) 용기 셋은 전부 그 자리에 있다(**0.12~0.36m 소품**).

새 화분 다섯은 **0.13~0.28m 소품**이다. 그 문장의 범위 안에 그대로 들어간다.
⇒ 값을 새로 정할 자리가 아니라 **이미 정해진 줄에 서는 자리**다.

## 3-2. 검산 — 이 표는 원래부터 「크기가 달라도 5,000원」이었다

| 이미 있던 품목 | 지름 | 정가 |
|---|---|---|
| `jar` 유리 수경병 | 0.0970 m | 5,000 |
| `pot` 검은 모종포트 | 0.1314 m | 5,000 |
| `siru` 콩나물 시루 | 0.24 m | 5,000 |

지름이 서로 **2.5배** 차이인데 값이 같다. 즉 크기로 값을 가른 적이 이 표에는 없다.
크기로 가르려면 **새 눈금(원/cm 같은 것)을 지어내야** 하고, 그건 `data/balance/` 소관이다
(이 창은 읽기만 한다). 그래서 안 갈랐다.

## 3-3. ★ 그 대신 **값이 아니라 자리로 갈렸다**

콘크리트 사각 화분은 값이 같은데 **자리를 10칸 잃는다.** 게임이 실제로 물리는 값은 이쪽이다.
「비싼 화분 / 싼 화분」이 아니라 「자리를 많이 먹는 화분 / 적게 먹는 화분」이 축이 됐고,
그 축은 **잰 값에서 저절로 나왔다.** 지어낸 것이 없다.

## 3-4. ⚠ `pot`(검은 모종포트)은 재고를 나눠 쓴다

새 품목을 안 만들었다 — `CATALOG.pot` 이 이미 그 물건이다(`propagation.CONTAINERS.soil.itemId === 'pot'`).
⇒ **몬스테라에 갈아 끼우면 삽수 심을 포트가 하나 준다.** 사실이 그러하므로 그대로 뒀다.
(값이 새는 길이 아니다. 하나 쓰면 하나 준다.)

---

# 4. 바꿔 끼는 규칙 — 무엇이 바뀌고 무엇이 안 바뀌나

## 4-1. 바뀌는 것

1. **겉모습** — `pot.potAsset`
2. **지름** — 그 에셋에서 잰 값 (`shop.potDiameterOf(asset)`)
3. 그래서 **놓을 수 있는 자리**

## 4-2. 안 바뀌는 것 — **그루 자체**

잎 수·유효 생장일·무늬는 화분을 안 본다. `priceOf` 는 잎으로만 값을 매기고,
growth 는 화분 지름을 입력으로 안 받는다(`potD` 는 `room_view` 의 그리기와 `place` 의 자리
판정에서만 쓰인다 — 전수 확인).

⇒ 이것은 **분갈이가 아니라 그릇 바꾸기**다. 큰 화분이 더 잘 자라게 하려면 그건 **새 생장 규칙**이고,
생장 규칙은 이 창 것이 아니다. **⏸ 박사님 판단** (§8-①).

## 4-3. ★ 굵어져서 지금 자리에 못 있게 되면 — **막는다. 몰래 안 옮긴다**

옮겨 주면 그 자리의 밝기가 달라져 **그루의 앞날이 바뀐다.** 화분을 바꿨을 뿐인데
자란다/안 자란다가 뒤집힌다. 되돌릴 수 없는 일을 조용히 하지 않는다는 이 저장소 규약이고,
`slotFitsDiameter` 가 「모르는 한도는 못 받는다」로 서 있는 것과 같은 방향이다.

⇒ 화면은 **"먼저 옮기고 나서 갈아 끼우세요"** 라고 말하면 된다. 자리를 고르는 것은 사람이다.

- 가늘어지는 쪽은 **언제나 된다** — 지금 자리가 더 굵은 것을 이미 받고 있었으므로.
- **색만 바꾸는 것도 언제나 된다** — 지름이 한 자리도 안 바뀌므로 자리를 못 잃는다.

## 4-4. 상점이 내주는 창구 (`src/game/shop.js`)

| 이름 | 무엇 |
|---|---|
| `POT_KINDS` / `potKindList()` | 화분 표(한글 이름·잰 지름·값·색) |
| `DEFAULT_POT_ASSET` | 도착 화분 에셋. `state.ARRIVAL.potAsset` 과 **같아야 한다**(검사 E-1) |
| `potDiameterOf(asset)` | ★ **자리 판정이 쓰는 유일한 창구.** 모르는 에셋이면 **던진다** |
| `knowsPotAsset(asset)` | 던지기 싫은 곳(매 프레임 그리기)이 먼저 물어본다 |
| `potKindOfAsset` / `potColorOfAsset` | 에셋 → 종류·색 (색 판도 제 종류를 안다) |
| `potSlotCount(d, slots)` / `potSlotsThatHold` | 그 지름이 올라가는 자리 수·목록 |
| `canSwapPot(S, asset, {potId, slots})` | ★ **판정만 한다. 상태를 안 바꾼다** |

`canSwapPot` 반환:
`{ ok, reason, asset, kind, color, fromAsset, fromDiameterM, diameterM, slotId, wider, fits, holdCount }`

- `slots` 를 안 주면 `fits: null` 로 **「자리는 안 봤다」고 말한다.** 봤다고 하지 않는다.
- 재고가 없으면 `ok:false` 이고 배송 중이면 그 사실을 문구에 적는다(`useStock` 과 같은 말투).

---

# 5. `game.html` 이 붙일 코드

⚠ `game.html` 은 조정 창 것이라 **한 줄도 안 고쳤다.** 아래는 그대로 붙일 수 있는 형태다.

## 5-1. import 한 줄 (1449행 근처)

```js
import { catalogList, orderItem, shopStatus, priceOf, sellPot, sellCutting,
         stockOf, SELLABLE_CUTTING_STATUS, varieLeavesNeededFor,
         /* ★ 화분 (2026-08-08) */
         potKindList, potDiameterOf, canSwapPot, DEFAULT_POT_ASSET } from './src/game/shop.js';
```

## 5-2. ★★ **지름을 상수에서 화분으로 바꾼다** — 이게 제일 중요한 한 줄

지금 `const ARRIVAL_POT_D = FIRST_PLAY_ASSETS.monsteraPotDiameterM;`(1492행) 하나가
자리 목록(1629)·방뷰(4048)·`plantPotD`(4144~4145)를 전부 먹인다.
**상수를 지우지 말고 그 옆에 함수를 하나 둔다** — 화분이 없는 때(가방 상태)도 답이 있어야 한다.

```js
/* ★ 지금 그 화분의 지름[m]. 화분이 없거나 모르는 에셋이면 도착 화분 값으로 답한다.
   ⚠ 「모르는 에셋을 기본값으로 떨어뜨리는 것」이 아니다 — 모르는 에셋은 shop 이 던지고,
     여기서는 **화분이 아직 없는 때**만 도착 화분을 쓴다(그때 보여 줄 자리 목록이 그것이다). */
const ARRIVAL_POT_D = potDiameterOf(DEFAULT_POT_ASSET);      // = 0.202 · 예전 값 그대로
const potDOf = (p) => (p ? potDiameterOf(p.potAsset) : ARRIVAL_POT_D);
```

바꿀 자리 셋:

```js
// 1629행  자리 목록 — 지금 화분이 올라가는 자리만 보여 준다
  const potD = potDOf(pot0(S));
  const fits = preview.slots.filter(s =>
    slotFitsDiameter(roomSlot.get(s.slotId) || s, potD));

// 4048행  방뷰에 넘기는 potD
      potD: potDOf(p),

// 4144~4145행
  if (what === 'musun') return musunPotD() || ARRIVAL_POT_D;
  return potDOf(pot0(S));
```

## 5-3. 상점 목록 — 화분은 **몬스테라가 온 뒤에만** 보인다

지금 상점 줄이 7개인데 11개가 된다. 무순 품목을 감추는 것과 **같은 문턱**을 쓴다
(문턱을 새로 짓지 않는다). 몬스테라가 없으면 갈아 낄 대상 자체가 없다.

```js
  const POT_ITEMS = new Set(potKindList().map(k => k.itemId));
  const potOpen = !(fp && fp.enabled) || !!(fp.monstera && fp.monstera.arrived);
  $('shopList').innerHTML = catalogList()
    .filter(it => musunOpen || !MUSUN_ITEMS.has(it.id))
    /* ★ `pot`(검은 모종포트)은 삽수 용기이기도 하므로 감추지 않는다 — 예전 그대로 보인다 */
    .filter(it => potOpen || it.id === 'pot' || !POT_ITEMS.has(it.id))
    .map(it => { /* 예전 그대로 */ });
```

## 5-4. 갈아 끼우기 창구 (식물 상세창에 한 줄)

```html
<!-- #pageRoom 또는 식물 상세창 안 -->
<div class="box" id="potBox" style="display:none">
  <h3>화분 바꾸기</h3>
  <div class="sub">화분을 바꾸면 지름이 바뀝니다 — 굵어지면 못 놓는 자리가 생깁니다.</div>
  <div id="potList"></div>
</div>
```

```js
/* ★ 판정을 여기서 다시 하지 않는다. shop.canSwapPot 이 유일한 판정이다 —
   두 벌을 만들면 버튼은 켜져 있는데 눌리면 거절당하는 화면이 된다. */
function drawPots() {
  const box = $('potBox'), p = pot0(S);
  box.style.display = p ? '' : 'none';
  if (!p) return;
  const slots = (io.light.room && io.light.room.slots) || [];
  const rows = [];
  for (const k of potKindList()) {
    for (const c of k.colors) {
      const q = canSwapPot(S, c.asset, { slots });
      const now = (p.potAsset || DEFAULT_POT_ASSET) === c.asset;
      const nm = k.colors.length > 1 ? `${k.ko} · ${c.ko}` : k.ko;
      rows.push(`<div class="shopRow">
        <div class="nm">${nm}<small>지름 ${(k.diameterM * 100).toFixed(1)}cm` +
        (q.holdCount == null ? '' : ` · 놓을 수 있는 자리 ${q.holdCount}칸`) + `</small></div>
        <button class="ghost" data-pot="${c.asset}"${now || !q.ok ? ' disabled' : ''}` +
        ` title="${now ? '지금 쓰는 화분입니다' : (q.reason || '')}">` +
        `${now ? '사용 중' : '갈아 끼우기'}</button></div>`);
    }
  }
  $('potList').innerHTML = rows.join('');
  for (const b of $('potList').querySelectorAll('[data-pot]'))
    /* ★ 되묻는다 — 자리를 잃는 쪽이면 되돌리는 데 또 화분 하나가 든다 */
    b.onclick = confirmOnce('화분을 바꿀까요?', guard(() => {
      const r = swapPot(S, b.dataset.pot, { slots, log: m => pushLog(S, m) });   // ← §6 코어
      banner('화분을 바꿨습니다', `${r.kind.ko} · 놓을 수 있는 자리 ${r.holdCount ?? '?'}칸`);
      draw();
    }));
}
```

`drawPots()` 를 `draw()` 안 `drawShop()` 옆에 한 줄 넣으면 된다.

---

# 6. 코어(state.js)가 할 일 — **붙일 코드**

⚠ 상태(`S.pots[i].potAsset`)를 바꾸는 것은 코어 몫이라 **손대지 않았다.**
아래를 `src/game/state.js` 에 그대로 넣으면 된다. 판정은 `shop.canSwapPot` 하나뿐이다.

```js
/* import 에 한 줄 추가 (state.js:23) */
import { createShopState, useStock, creditCropSurplus,
         canSwapPot, potKindOfAsset, potDiameterOf, DEFAULT_POT_ASSET } from './shop.js';
```

```js
/* ============================================================
   ★★ 화분 바꿔 끼기 (2026-08-08 · 박사님 "화분 종류를 늘려서 바꿔 낄 수 있도록")
   ------------------------------------------------------------
   ★ 판정을 여기서 다시 하지 않는다 — `shop.canSwapPot` 이 유일한 판정이다.
     두 곳에서 재면 화면이 「된다」고 하는데 코어가 거절하는 판이 생긴다.
   ★ 원자적이다. 재고를 먼저 쓰고 나서 갈아 끼우면, 중간에 던졌을 때 화분은 그대로인데
     재고만 사라진다. 그래서 **판정 → 재고 → 갈아 끼우기** 순서를 지키고,
     판정이 통과한 뒤에는 던질 자리가 없다(useStock 은 판정이 이미 재고를 봤다).
   ⚠ 자리를 옮기지 않는다. 굵어져서 못 있게 되는 화분은 canSwapPot 이 앞에서 막는다 —
     조용히 옮기면 밝기가 달라져 그루의 앞날이 바뀐다(pots-to-plan §4-3).
   ⚠ 빼낸 화분은 **재고로 돌아온다.** 안 돌려주면 색을 한 번 바꿔 볼 때마다 7,000원이고,
     그건 「바꿔 낀다」가 아니라 「버리고 산다」다. propagation 의 `returnContainer`
     (유리 수경병이 팔 때 돌아오는 것)와 같은 사상이다.
     ⚠ 단, **도착 화분을 아직 한 번도 안 바꾼 판**에서는 그 화분이 재고에서 나온 것이
     아니므로 돌려주는 것이 맞다(플레이어가 실제로 갖고 있던 그릇이다).
     반환 규칙을 바꾸려면 여기 한 줄이다.
============================================================ */
export function swapPot(S, asset, opt = {}) {
  const q = canSwapPot(S, asset, { potId: opt.potId, slots: opt.slots });
  if (!q.ok) {
    const e = new Error(`[화분] ${q.reason}`);
    e.tutorialInput = true;                 // 안내지 고장이 아니다
    throw e;
  }
  const pots = S.pots || [];
  const p = opt.potId ? pots.find(x => x.id === opt.potId) : pots[0];

  useStock(S, q.kind.itemId, 1);            // 새 화분을 쓴다
  const oldKind = potKindOfAsset(q.fromAsset);
  if (oldKind) {                            // 빼낸 화분은 재고로 돌아온다
    const shop = shopOf(S);
    shop.stock[oldKind.itemId] = (shop.stock[oldKind.itemId] || 0) + 1;
  }
  p.potAsset = asset;

  if (typeof opt.log === 'function')
    opt.log(`🪴 화분을 ${q.kind.ko}${q.color.id === 'base' ? '' : ' · ' + q.color.ko}로 ` +
            `바꿨습니다 — 지름 ${(q.diameterM * 100).toFixed(1)}cm` +
            (oldKind ? ` · ${oldKind.ko}는 가방으로 돌아왔습니다` : ''));
  return { ...q, potId: p.id,
           events: [{ id: 'pot_swapped', ko: `화분을 ${q.kind.ko}로 바꿨습니다`,
                      asset, diameterM: q.diameterM }] };
}
```

⚠ `shopOf` 를 state.js 가 아직 import 하지 않는다면 위 import 줄에 같이 넣어야 한다.

## 6-1. 코어가 같이 봐 주면 좋은 것 (필수는 아니다)

`first_play.FIRST_PLAY_ASSETS.monsteraPotDiameterM(0.202)` 과 `loop.js:1018` 의 도착 자리
고르기는 **지금 그대로 두어도 맞다** — 도착 화분이 곧 그 지름이기 때문이다.
다만 나중에 도착 화분을 바꾸면 두 곳이 갈린다. 한 줄로 묶으려면:

```js
// loop.js:1018
const potDiameter = potDiameterOf(DEFAULT_POT_ASSET);   // = FIRST_PLAY_ASSETS.monsteraPotDiameterM
```

---

# 7. 세이브 영향 — **반드시 읽을 것**

## 7-1. ★ 새 칸이 하나도 없다. 그래서 옛 세이브가 안 깨진다

| | |
|---|---|
| `pot.potAsset` | **이미 있다.** `save.js §packPot:188` 이 예전부터 적고 되세운다 |
| 지름 | **상태에 안 넣었다.** `potAsset` 에서 **파생**시킨다(`shop.potDiameterOf`) |

⇒ 지름을 세이브에 안 적은 것이 이 설계의 핵심이다. 적으면 **에셋과 지름이 갈릴 수 있다** —
나중에 GLB 를 다시 뽑아 굵어졌는데 세이브에는 옛 지름이 남아, 창턱을 통과한 채로 겹친다.
파생시키면 그런 상태가 **원리적으로 존재할 수 없다.**

## 7-2. 옛 세이브가 열리면 어떻게 되나

| 옛 세이브의 `potAsset` | 결과 |
|---|---|
| `'monstera/pot.glb'` (지금까지 저장된 모든 판) | 크림도자기 화분 · 지름 **0.202** — **예전과 한 자리도 안 다르다** |
| 없음/`null` (아주 옛 세이브) | `DEFAULT_POT_ASSET` 로 읽어 지름 **0.202** — 역시 그대로 (검사 E-3) |
| 모르는 문자열 | `potDiameterOf` 가 **던진다.** 조용히 0.202 로 떨어뜨리면 더 굵은 화분이 창턱을 통과한다 |

★ 마지막 줄이 유일한 새 실패 경로다. **지금은 그런 세이브를 만들 길이 없다**(코어가 쓰는 값이
전부 표 안이다). 나중에 화분을 지우면 그때 생기므로, 화분을 표에서 **빼지 말고 남겨 두는 것**이
호환 규약이다(`CATALOG` 에서 품목을 안 지우는 것과 같은 이유).

## 7-3. 재고

새 화분 넷은 `shop.stock` 의 **새 열쇠**를 쓴다(`pot_ceramic` 등). 옛 세이브에는 없고,
없으면 0 이다(`stockOf` 가 `|| 0`). `save.js` 의 `packShop` 은 `stock` 을 통째로 적으므로
**세이브 코드를 한 줄도 안 고쳐도 된다.** (`save.js` 는 이 창 수정 금지 파일이기도 하다.)

---

# 8. 박사님 판단이 필요한 것

## ① ⏸ 화분 크기가 생장에 영향을 주어야 하나

지금은 **안 준다.** 「분갈이가 아니라 그릇 바꾸기」로 뒀다.
큰 화분 = 더 빨리 큰다로 하려면 **새 생장 규칙**이 필요하고, 그건 growth 소유다
(`docs/monstera-growth-spec` 캐논에 화분 크기 축이 없다).
지금 구조에서 큰 화분의 값어치는 **없고**, 오히려 자리를 잃는 쪽이라 **아무도 안 산다.**

## ② ⏸ 종류마다 값을 다르게 할 것인가

지금은 다섯 다 **5,000원**이다(§3 — 새 숫자를 안 만들었다).
다르게 하려면 `data/balance/` 에 `shop` 항목이 필요하다(이 창은 읽기만 한다).
`docs/shop.md §2` 도 *"`data/balance/` 에 `shop` 항목을 만들 때 이 세 값을 옮기면 된다"* 로
이미 대기 중이라, **같이 하는 것이 맞다**고 본다.

## ③ ⏸ 색을 따로 팔 것인가

지금은 **안 판다** — 한 종류를 사면 그 색 셋을 다 고를 수 있다.
근거: 색은 지름을 안 바꾸므로 **자리 판정에 아무 영향이 없고**, 값을 치를 만한 것이 없다.
따로 팔려면 값이 필요하고, 그건 ②와 같은 판단이다.

## ④ ⏸ 「자리를 잃는 화분」이 지금 **하나뿐**이다

잰 값으로는 자리 수가 **14 아니면 4** 둘뿐이다. 중간(창턱만 잃는 13칸 · 지름 0.21~0.25)에
해당하는 화분이 **에셋에 없다.** 즉 선택이 「아무거나」 아니면 「창턱 포기」로 극단적이다.
중간을 만들려면 새 에셋이 필요하고, 에셋은 이 창 소유가 아니다. **⏸ 필요한지부터 판단.**

## ⑤ ⏸ 빼낸 화분을 돌려줄 것인가

§6 의 붙일 코드는 **돌려준다**(안 돌려주면 색 한 번 바꿔 보는 데 7,000원이라 아무도 안 바꾼다).
「버리는 것이 맞다」면 그 세 줄만 지우면 된다.

---

# 9. 검사

```
node tools/test_pots.mjs        ← 화면도 서버도 필요 없다 (70/70 PASS)
```

| 묶음 | 무엇을 못 박나 |
|---|---|
| **A** | 지름을 GLB 에서 **실제로 잰다.** 표의 값 = 잰 값(0.1mm 올림). 네모 화분은 bbox 로는 창턱을 통과하고 대각선으로는 못 통과한다 |
| **B** | 색 판은 지오메트리가 같아 **지름이 같다.** 모르는 에셋은 **던진다.** 행잉·수경병은 표에 없다 |
| **C** | 반지하 14칸에서 종류마다 몇 칸인가 — **14·14·14·14·4**. 창턱을 잃는 것은 네모뿐 |
| **D** | 바꿔 끼기 — 재고 없으면 거절 · 창턱에서 굵어지면 거절 · 책상에서는 허용 · **색은 언제나 허용** · 판정이 상태를 안 바꾼다 |
| **E** | ★★ **회귀.** 도착 화분·지름 0.202·옛 품목 일곱의 값과 배송·손익분기·갓 도착한 화분·자리 14칸·빈 재고 — 전부 그대로 |

`tools/test_pots.mjs` 는 GLB 를 **직접 읽는다**(의존성 0). 크롬을 안 띄우는 이유는
`tools/test_snap.mjs` 와 같다 — 재려는 것이 꼭짓점 좌표라 렌더러가 필요 없고,
띄우면 셈이 맞는지가 아니라 크롬이 뜨는지를 재게 된다.

---

# 10. 고친 파일

| 파일 | 무엇 |
|---|---|
| `src/game/shop.js` | 화분 품목 넷 추가(값 5,000 · 기존 줄) · §②-2 화분 표와 창구 여섯 · `canSwapPot` |
| `tools/test_pots.mjs` | 새 검사(70건) |
| `docs/handoff/pots-to-plan.md` | 이 문서 |

**안 고친 것:** `game.html` · `src/game/state.js` · `src/game/room_view.js` · `src/game/loop.js` ·
`src/game/save.js` · `src/game/first_play.js` · `data/balance/` · `assets/`

⏸ `docs/shop.md §2 품목표` 에도 화분 넷을 넣어야 정본과 코드가 안 갈린다.
값이 §8-② 로 열려 있어(다르게 갈지 말지) **확정된 뒤에 한 번에 넣는 것**이 맞다고 보고 미뤘다.
넣을 줄은 아래 그대로다.

| id | 품목 | 정가 | **살 때** | 배송 | 근거 |
|---|---|---|---|---|---|
| `pot_concrete_round` | 회색 콘크리트 화분 | 5,000 | **7,000** | 2일 | 용기값 5,000원과 같은 줄 · 0.1801m |
| `pot_terracotta` | 테라코타 화분 (나무받침) | 5,000 | **7,000** | 2일 | 같은 줄 · 0.2010m |
| `pot_ceramic` | 크림도자기 화분 (나무받침) | 5,000 | **7,000** | 2일 | 같은 줄 · 0.2020m · 도착 화분 |
| `pot_concrete_square` | 콘크리트 사각 화분 | 5,000 | **7,000** | 2일 | 같은 줄 · 0.2755m · **자리 4/14칸** |
