# 삽수와 용기를 두 걸음으로 갈랐다 — 코어 창구 (2026-08-17)

창: cutcontainer · 쓴 파일: `src/game/propagation.js` · `src/game/state.js` · `src/game/save.js` ·
`tools/test_cutcontainer.mjs`. `game.html` 과 `room_view.js` 는 **한 글자도 안 만졌다.**

---

## 0. 무엇이 달라졌나 — 설명 먼저

예전에는 **자르는 그 자리에서 용기가 정해졌다.** `takeCutting(S, { container:'jar' })` 한 번에
「병에 꽂힌 삽수」라는 한 덩어리가 태어났고, 그 자리에서 병 재고가 빠졌다.

박사님이 그 덩어리를 둘로 가르라고 하셨다. 그래서 지금은 이렇다.

```
① 자른다        → 삽수가 **가방**으로 온다 (자리도 용기도 없다 · 재고를 한 톨도 안 쓴다)
② 용기를 놓는다  → 유리 수경병이나 검은 모종포트를 **가구처럼** 방에 놓는다 (여기서 재고가 빠진다)
③ 넣는다        → 가방의 삽수를 그 용기에 넣는다. **그때부터** 물꽂이/직삽이 시작된다
④ 뺀다          → 삽수는 가방으로, **용기는 방에 빈 채로 남는다**
⑤ 걷는다        → 빈 용기를 걷어 가방으로. 안에 삽수가 있으면 던진다(먼저 빼야 한다)
```

★ **새 사상을 안 만들었다.** 이 저장소에는 이미 같은 손버릇이 셋 있다 —
시루(`placeSiru(sow:false)` → `sowCrop`) · 재배판(같은 길) · 화분(`placeEmptyPot` →
`plantMonsteraSeed`). 그 길을 그대로 따랐고 순서 계약도 같다(**①묻고 ②재고 빼고 ③남긴다**).

★ **유리병과 화분이 똑같다.** 박사님 추가 지시(*"수경 안 하고 바로 화분 심는 것도 동일하게"*)
그대로다. 창구 이름이 용기를 안 가린다 — 전부 `containerId` 하나를 받는다.

⚠ **옛 길을 안 없앴다.** `takeCutting(S, { container:'jar' })` 은 예전과 **한 톨도 안 다르게**
돈다(그 자리에서 재고가 빠지고 바로 `rooting` 이 된다). 검사·재현·`game.html` 의 지금 단추가
아직 그 길로 부른다.

---

## 1. 창구 목록 (전부 `src/game/propagation.js`)

| 창구 | 하는 일 |
|---|---|
| `takeCutting(S, opt)` | `opt.container` 가 **선택**이 됐다. 안 주면 가방으로 온다 |
| `placeCutContainer(S, container, at, opt)` | 빈 용기를 방에 놓는다. **여기서 재고가 빠진다** |
| `putCuttingIn(S, cuttingId, containerId, opt)` | 가방의 삽수를 넣는다. **여기서 시계가 시작된다** |
| `takeCuttingOut(S, cuttingId, opt)` | 삽수를 가방으로. 용기는 방에 빈 채로 남는다 |
| `removeContainer(S, containerId, opt)` | 빈 용기를 걷어 재고로. 삽수가 들어 있으면 던진다 |
| `cutContainersOf(S)` · `cutContainerOf(S, id)` · `containerHolding(S, cuttingId)` | 읽기 |
| `leafGrowthStopped(c)` | **수경이 혹으로 멈췄나** (박사님 ③) |
| `clockDayOf(c)` | 시계의 기준일 — 「자른 날」이 아니라 「넣은 날」 |

### 계약 (자세히)

**`takeCutting(S, opt)`**
- `opt.container` 를 **안 주면**: `status:'bag'` · `container:null` · `method:null` ·
  `at:null` · `slotId:null` · `clockOnDay:null` · `days:0`. **재고를 안 깎는다.**
- 모르는 갈래(`'jarr'` 같은 오타)를 주면 **여전히 던진다** — 조용히 가방으로 안 흘린다.
- 자를 때 정해지는 것은 **전부 그대로 적힌다**: `source.{nodeId,stem,leaves,variegatedLeaves,
  growthDays,motherGrowthDays,motherSeed}` · `leafVarie` · `leafGrade` · `cutW` ·
  `varieChance` · `varieFromCut` · `variegated` · `gen`.
- **체력(`ACT_COST.cut`)은 두 길 다 든다.** 자르는 것이 손이다.
- 잎 수 조건(물꽂이 1장)은 **용기를 정했을 때만** 여기서 본다. 안 정했으면 넣을 때 본다.

**`placeCutContainer(S, container, at, opt)`** → `{ id, container, containerKo, itemId, at, slotId, left }`
- `container` 는 `'jar'` | `'soil'`. `'tray'` 는 `ready:false` 라 던진다.
- `at`·`opt.slots`·`opt.size`·`opt.snapDist` 는 `setCuttingAt`·`placeEmptyPot` 과 **같은 규약**.
- 순서: `assertStockAll` → `resolvePlacement` → `useStock`. **중간에 던지면 아무것도 안 바뀐다.**
- 체력을 안 쓴다(가구를 놓는 것과 같다).

**`putCuttingIn(S, cuttingId, containerId, opt)`** → 삽수 객체
- `status:'rooting'` · `days:0` · `clockOnDay = S.day` · `at`/`slotId` = 용기 자리.
- **한 그릇에 하나.** 이미 들어 있으면 던진다(`e.tutorialInput = true`).
- 잎 여러 장짜리를 병에 넣으면 던진다(`methodLeafBlock` — `e.tutorialInput = true`).
- **재고를 안 건드린다**(용기값은 놓을 때 이미 냈다). **체력을 안 쓴다**(`state.sowCrop` 과 같은 판단 —
  ⚠ 이건 판단입니다. 물리려면 `canActStamina(S,'sow')` 한 줄이고 밸런스 창과 같이 정할 일입니다).

**`takeCuttingOut(S, cuttingId, opt)`** → `{ cuttingId, containerId, container }`
- **살아 있으면 언제든** 된다(까닭은 §3).
- 삽수: `status:'bag'` · `container/method/inContainerId/clockOnDay/deadlineDay/at/slotId = null` ·
  `days:0` · `rootedOnDay·nodeOnDay = null` · `warned = []`. **잎(`leafVarie`·`leafGrade`)과
  무늬 소질(`varieChance`·`varieLightBand`)은 안 건드린다** — 그건 이미 일어난 사실이다.
- 용기: 방에 남고 `cuttingId = null` 이 된다.

**`removeContainer(S, containerId, opt)`** → `{ id, container, itemId, returned, left }`
- 삽수가 들어 있으면 던진다(`e.tutorialInput = true`).
- **돌아오나**는 `CONTAINERS` 가 정한다: 유리 수경병은 언제나 돌아오고(소모품이 아니다),
  검은 모종포트는 **한 번이라도 삽수가 들어앉았으면 안 돌아온다**(흙째 쓴다).
  안 쓴 채로 걷는 것은 「잘못 놓았다」를 되돌리는 일이라 둘 다 돌아온다.

---

## 2. ★ 수경은 혹이 나면 성장을 멈춘다 (박사님 ③) — **재 보니 이미 그랬다**

「지금 그렇다」와 「그렇게 하기로 했다」를 갈라 적는다(START-HERE §2 규칙 2).

- **지금 그렇다**: 잎이 나는 자리는 `stepCuttings §①-3` **하나**뿐이고 그 조건이
  `status === 'established'` 다. 물꽂이는 `rooting → rooted → node` 로만 가고
  `established` 에 **닿는 길이 없다**(닿는 순간은 분갈이인데, 분갈이는 `method` 를 `'pot'` 으로
  바꾼다). ⇒ 물꽂이 삽수는 **애초에 잎이 한 장도 안 났다.** 캐논이 그렇게 못 박고 있다
  (`propagation.js §삽수가 자란다` 규칙 ① — *"물꽂이는 뿌리만 내고 잎은 안 낸다"*).
- **그렇게 하기로 했다**: 그래도 조건을 **글로 박았다**(`leafGrowthStopped(c)`). 까닭 둘 —
  ① 박사님이 규칙으로 말씀하신 것이라 코드에 그 문장이 있어야 다음 사람이 안 되묻는다
  ② 「established 에 못 닿는다」는 **딴 계통의 사정**이다. 언젠가 물꽂이가 자리를 잡게 열리는 날
  (트레이·수경 전용 그릇) 이 조건이 없으면 말없이 규칙이 깨진다.

⚠⚠ **분갈이 기한은 안 걷었다.** 박사님 확정 — *"혹이 나면 성장이 멈추되 기한은 그대로."*
검사 ⑤ 가 초보/자유 둘 다 실제로 죽는 날을 재서 못 박는다.
⚠ **흙은 안 건드렸다.** 박사님 ③ 은 수경만이다 — 검사 ④ 대조군이 흙은 혹 뒤에도 자란다는 것을
잎 수로 낸다.

---

## 3. 판단 둘 — 까닭을 적으라 하신 것

### ㉮ 왜 `state.js` 가 아니라 `propagation.js` 에 냈나

`state.placeEmptyPot` 을 본으로 삼았지만 **삽수 용기는 그 목록에 못 들어간다.** 넷이다.

1. **규칙이 여기 있다.** 어느 갈래가 어느 방식인지(`method`) · 몇 개까지 드는지(`capacity`) ·
   팔 때 돌아오는지(`returnsOnSale`) · 에셋이 정해졌는지(`ready`) — 전부 `CONTAINERS` 다.
   `state.js` 에 두면 그 표를 거꾸로 import 해야 하고(지금 `state → propagation` 화살표가 아예 없다),
   안 하면 표가 두 벌이 된다.
2. **`emptyPots` 와 뜻이 다르다.** 거기 든 그릇은 「몬스테라 씨앗을 심을 그릇」이라
   `plantMonsteraSeed` 가 씨앗을 넣는다. 합치면 **유리 수경병에 씨앗이 심긴다.**
3. **딸린 창구가 전부 여기 있다** — `putCuttingIn` 은 `S.cuttings` 와 `METHODS`·`methodLeafBlock` 을
   한 자리에서 만져야 한다.
4. 이 파일이 이미 `place.resolvePlacement` 와 `shop.useStock`·`assertStockAll` 을 쓴다. 새로 열 문이 없다.

⚠ **겹치는 것이 하나 있고 숨기지 않는다**: `CONTAINERS.soil.itemId` 는 `'pot'` 이라
`state.SEED_POT_ITEM_ID` 와 **같은 상점 품목**이다(실제로 같은 검은 모종포트다). 재고는 하나를
나눠 쓰지만 **놓고 나면 목록이 갈린다** — `S.emptyPots` 는 씨앗용, `S.cutContainers` 는 삽수용.
⇒ **화면이 [빈 화분]을 어느 쪽으로 놓을지 정해야 한다.** 그 판단은 `game.html` 몫이라 §6 에 적었다.

### ㉯ 회수는 **언제** 되나 — 살아 있으면 언제든

박사님 ④ 는 *"혹이 나서 성장이 멈춘 삽수를 다시 인벤으로"* 다. 「혹 난 뒤에만」으로 좁힐 수도
있었는데 **안 좁혔다.** 넷이다.

1. 그 말씀은 **「혹 난 것도 되돌릴 수 있어야 한다」는 요구**이지 「그 전에는 못 뺀다」는 금지가
   아니다. 넓게 열어도 요구가 그대로 지켜진다.
2. **넣기가 아무 때나 되는데 빼기만 막으면 되돌릴 길이 없다.** 잎 1장짜리를 엉뚱한 병에 꽂은
   실수가 영영 안 풀리고 병 재고까지 묶인다. 이 저장소는 「놓은 것은 걷을 수 있다」를 이미
   규칙으로 삼는다(`state.removeEmptyPot`).
3. **남용이 이득이 되는 길이 없다.** 빼면 시계가 멈추고, 다시 넣으면 `days:0` 으로 **처음부터**
   다시 돈다. 빼는 것은 언제나 손해이거나 본전이다.
4. 규칙이 하나면 화면도 하나다 — 팝업의 [가방으로] 단추가 회색이 되는 경우가 없다.

⚠ 죽은 삽수는 못 뺀다. ⚠⚠ 기한을 걷은 것이 아니다 — 회수는 그 기한을 **피하는 또 하나의 길**이고,
대신 시계가 처음으로 돌아가므로 값을 치른다.

---

## 4. 잰 표 — `node tools/test_cutcontainer.mjs` (전부 통과)

표 머리: 방 = 반지하 · 모드 = novice(따로 적은 것만 자유) · 튜토 지갑 켬 · `firstPlay` **끔** ·
빛 = 하네스가 `{ dli:8, grows:true, band:'best' }` 를 늘 준다(코어는 빛을 안 잰다).

| 잰 것 | 결과 |
|---|---|
| 용기 없이 자르기 | `status:'bag'` · 병/포트 재고 **그대로** · 잎 2장(무늬 1) · 등급 `[null,"halfmoon"]` · 모주 143.5일/seed 92158 그대로 적힘 |
| 가방에서 50일 | `days = 0` · 기한 없음 · 안 사라짐 |
| 빈 용기 놓기/걷기 (jar·soil) | 놓으면 재고 −1 · 걷으면 +1 · 재고 없으면 던지고 **목록에 안 남음** |
| 넣기 (가방 10일 뒤) | Day 11 에 꽂음 → 뿌리 **12일째** · 혹 **20일째** (자른 날이 아니라 **넣은 날** 기준) |
| 물꽂이 잎 수 | 1일:1장 · 12일:1장 · 19일:1장 · **20일(혹):1장** · 28일:1장 · 34일:1장 ⇒ **내내 평평** |
| 흙 잎 수(대조군) | 24일:2장 · 43일:3장 · **45일(혹):3장** · 63일:**4장** · 80일:4장 ⇒ **혹 뒤에도 는다** |
| 기한 — 초보 | 넣은 날 Day 8 · 유예 16일 · **Day 44 사망** · 경고 5회 (= 8+20+16) |
| 기한 — 자유 | 넣은 날 Day 8 · 유예 8일 · **Day 36 사망** · 경고 3회 (= 8+20+8) |
| 가방 60일 뒤 넣기 | 넣고 21일 · 기한 Day 97(오늘 82) — **남은 15일** (옛 셈이면 이미 죽었을 것) |
| 회수 | 삽수 → 가방 · **병은 방에 남고 재고 그대로** · 60일 굴려도 안 죽음 · 다시 넣으면 0일부터 |
| 든 용기 걷기 | 던짐(`tutorialInput`) · 목록·재고 **안 바뀜** · 빼면 걷힘(+1) |
| 쓴 모종포트 걷기 | `returned:false` — 「심고 빼고 걷고」로 포트가 공짜가 안 된다 |
| 옛 호출부(jar·soil) | `rooting` 즉시 시작 · 재고 −1 · `clockOnDay === cutOnDay` · 방에 그릇 안 섬 |
| 세이브 왕복 | 가방/빈 용기/든 용기 그대로 · 두 번 저장해도 안 흔들림 |
| **옛 세이브**(새 칸 셋을 지운 판) | 그대로 열림 · `clockOnDay:null` → `clockDayOf` 가 `cutOnDay` 로 읽음 · 기한 Day 37 로 **같음** |
| 흙 두 걸음 | 놓고 → 심고 → 자리 **24일** · 혹 **Day 46(넣은 날+45)** · 기한 null · **120일 굴려도 안 죽음** |
| 잎 여러 장 | 병에는 던짐(`tutorialInput`) · 화분에는 들어감 |

### 기존 검사

`test_cutting_wiring` · `test_cuttable` · `test_escapecut` · `test_cutstamina` · `test_quest` ·
`test_stamina` · `test_save` — **전부 통과.**

그 밖에 **헤드리스 검사 32개를 더 돌렸다**(브라우저를 안 띄우는 것 전부).
9개가 빨간데 — `test_crop_seat` · `test_first_play_attacks` · `test_floorlight` ·
`test_free_place` · `test_lampaim` · `test_oneroom_room` · `test_pantrysale` · `test_pots` ·
`test_tutorial` — **내 세 파일을 HEAD 판으로 되돌려도 똑같이 9개가 빨갛다.** 브라우저 검사
`test_bagcell` · `test_banjiha_profile` · `test_banjiha_routes` 도 마찬가지다.
⇒ **이 창의 변경과 무관하다.** 지금 작업 트리에는 다른 창이 손보는 중인 것이 들어 있다
(`src/game/growth_adapter.js` · `game.html` · `tools/test_cropsale.mjs` · 새 파일 `src/game/room_map.js`).
⚠ 재는 법: 내 세 파일만 `git show HEAD:` 로 덮어 돌리고 다시 되돌렸다 — 색인은 안 건드렸다.

`test_propagation` — 검사 I 가 **이 창이 손대기 전부터 빨갛게 있었다.** HEAD 판으로 되돌려
확인했고, 원인은 `save.js §packCutting` 이 `source.motherGrowthDays` · `source.motherSeed` 를
**아예 안 싣고 있었던 것**이다(2026-08-16 에 `takeCutting` 이 적기 시작했는데 세이브가 안 따라왔다).
저장 한 번에 그 두 칸이 사라지므로 **방이 「자른 그 가지」를 다시 못 짓는다.**
⇒ 내 영역(`save.js`)이고 이번 일의 ① 과 정확히 같은 계약이라 **같이 고쳤다.** 지금 통과한다.

---

## 5. ★ `game.html` 이 붙일 것 (마스터 창 몫)

들여오기 한 줄:

```js
import { takeCutting, repotCutting, cuttableNow, cutBudgetOf, cutBlockedReason,
         cuttingsOf, cuttingSnapshot, containerItemOf, graceDaysOf, isNoviceMode,
         /* ★ 2026-08-17 신설 */
         placeCutContainer, putCuttingIn, takeCuttingOut, removeContainer,
         cutContainersOf, cutContainerOf, containerHolding,
         CONTAINERS, WATER_LEAF_MAX } from './src/game/propagation.js';
```

### ① 자르기 단추 — 용기를 **안 넘긴다**

```js
// 지금: takeCutting(S, { potId: pot0(S).id, nodes, nodeId, container, ... })
// 새로: container 를 빼면 가방으로 온다
c = takeCutting(S, { potId: pot0(S).id, nodes, nodeId,
                     motherGrowthDays: io.growth.growthDays(),
                     motherSeed: <그 그루 씨앗>,
                     log: m => pushLog(S, m) });
// c.status === 'bag' · c.at === null → 자리를 안 잡는다(지금도 opt.at 없으면 안 잡는다)
```
⚠ `container` 를 계속 넘겨도 예전처럼 돈다. **한 번에 안 바꿔도 된다.**

### ② 가방 칸 — 「삽수 아이템」

```js
const bag = cuttingsOf(S).filter(c => c.status === 'bag');
for (const c of bag) {
  const v = cuttingSnapshot(S, c);   // v.inBag === true · v.leaves · v.variegatedLeaves · v.statusKo
  // 카드에 [넣기] 를 단다. 넣을 수 있는 용기 목록은 아래 ③
}
```

### ③ 빈 용기를 방에 놓기 — 화분·시루 놓기와 **같은 자리**

`game.html §commitPlace`(끌어다 놓기)와 `startPhonePlace`(폰 배치) 둘 다에 갈래를 하나 더 단다.
`placeEmptyPot` 을 부르는 그 자리 바로 옆이다.

```js
// what === 'cut_jar'  또는  'cut_pot' 같은 새 품목 열쇠일 때
placeCutContainer(S, what === 'cut_jar' ? 'jar' : 'soil', atOf(hit),
                  { ...placeOpt(), log: m => pushLog(S, m) });
banner('🫙 빈 유리병을 놓았습니다', '가방의 삽수를 넣어 주세요');
```
- `placeOpt()` 가 내는 `{ slots, size, snapDist }` 를 그대로 받는다 — **같은 규약**이다.
- 재고가 없으면 코어가 던진다. **화면이 미리 막지 않는다**(`placeEmptyPot` 과 같은 결).

⚠⚠ **정해 주셔야 하는 것 하나** — 지금 [화분] 아이템 하나를 놓으면 `placeEmptyPot`(씨앗용)으로
간다. 삽수용 흙 포트도 **같은 상점 품목(`pot`)** 이다. 둘 중 하나로 정해야 한다:
  · (가) 가방에 **품목을 둘로** 낸다 — [화분(씨앗용)] · [모종포트(삽수용)]
  · (나) 놓을 때 **한 번 묻는다** — 「씨앗을 심을까요, 삽수를 꽂을까요」
  · (다) 놓은 뒤에 정한다 — `emptyPots` 에 놓고, 삽수를 끌어다 놓으면 그때 옮긴다
    (이건 코어에 다리 함수 하나가 더 필요하다. 말씀 주시면 냅니다)
**코어는 (가)/(나) 둘 다 지금 그대로 됩니다.**

### ④ 드래그로 넣기 · 용기를 골라서 넣기

```js
// 가방의 삽수를 방의 병 위에 떨어뜨렸을 때 (또는 팝업에서 병을 골랐을 때)
try {
  putCuttingIn(S, cuttingId, containerId, { log: m => pushLog(S, m) });
  banner('🫙 병에 꽂았습니다', '오늘부터 물꽂이가 시작됩니다');
} catch (e) {
  // ⚠ e.tutorialInput === true 면 **고장이 아니라 안내**다 — 판을 잠그지 마라
  banner('못 넣었습니다', e.message);
}
```
넣을 수 있는 용기만 보여 주려면:
```js
const empties = cutContainersOf(S).filter(t => !t.cuttingId);
// 잎 수로 미리 거르려면 CONTAINERS[t.container].method 와 WATER_LEAF_MAX 를 견준다
//   (사유 문구는 코어가 낸다 — 화면이 다시 짓지 마라)
```

### ⑤ 팝업의 [다시 삽수 인벤으로] · [빈 용기 회수]

```js
// 삽수 팝업 (수경 중이든 흙이든, 살아 있으면 언제든 뜬다)
takeCuttingOut(S, c.id, { log: m => pushLog(S, m) });
// → 삽수는 가방으로, 용기는 방에 빈 채로 남는다

// 빈 용기 팝업
removeContainer(S, t.id, { log: m => pushLog(S, m) });
// → r.returned 가 false 면 "한 번 쓴 것이라 돌아오지 않습니다" 를 말해 주면 좋다
//   삽수가 들어 있으면 던진다(tutorialInput) — 먼저 [가방으로] 를 누르라고 안내
```

### ⑥ 화면이 읽을 새 칸 (`cuttingSnapshot`)

| 칸 | 뜻 |
|---|---|
| `inBag` | 가방에 있나 (= `status==='bag'`) |
| `inContainerId` | 방의 어느 그릇에 들어 있나 (없으면 null) |
| `leafGrowthStopped` | 수경이 혹으로 멈췄나 — 「왜 잎이 안 느나」를 말할 근거 |
| `statusKo` | `'가방에 있다 — 용기에 넣어야 시작한다'` 가 늘었다 |

⚠ 가방 삽수는 `daysLeft`·`graceDays` 가 **null** 이다(기한이 없다). 「기한 —」로 찍지 말고
「용기에 넣어야 시작합니다」로 찍어 주십시오.

---

## 6. ★ `room_view.js` 에 필요한 것 (마스터 창이 그쪽에 넘길 것)

**코어는 `room_view.js` 를 한 글자도 안 만졌다.** 방 뷰가 새로 알아야 하는 것은 셋이다.

1. **빈 용기를 그린다.** `S.cutContainers[]` 를 돌면서 `at`·`slotId` 에 그린다.
   에셋은 `propagation.CONTAINERS[t.container].assetId` 다 —
   `jar` = `pots/pot_glassjar.glb`(있다) · `soil` = **`null`**(아직 없다 → 대체 표현이 필요하다).
   지름은 `realMaxM`(jar 0.13m · soil 0.12m).
   ⚠ 지금 방 뷰는 `cuttingViewModel(c)` 로 「삽수가 든 병」만 그린다. **빈 병을 그릴 창구가 없다.**
   목록 하나(`cutContainersOf(S)`)만 더 돌면 된다 — 삽수와 자리가 같으므로 겹치지 않게
   **든 그릇은 삽수 쪽에서 그리고, 빈 그릇만 여기서** 그리면 된다(`t.cuttingId == null`).
2. **클릭 판정**이 빈 용기에도 붙어야 한다 — 박사님 ⑥([유리병 클릭 → 회수 버튼])이 그것이다.
   화분·시루 클릭 판정과 같은 결로, 맞으면 `{ kind:'cutContainer', id: t.id }` 를 내주면 된다.
3. **드롭 대상**이 필요하다 — 박사님 ②(가방의 삽수를 드래그해서 병에 넣기). 끌고 오는 동안
   빈 용기가 강조되고, 놓으면 `putCuttingIn(S, cuttingId, t.id)` 를 부를 수 있게
   「지금 커서 밑의 빈 용기 id」를 낼 창구가 있으면 된다.

⚠ 가구를 옮기면 용기도 따라간다 — 그건 **코어가 이미 한다**(`state.followFreeOnFurniture` 에
`S.cutContainers` 를 넣었고, `propagation.rehomeCuttings` 가 빈 용기까지 회수한다).
방 뷰는 그린 것만 따라 움직이면 된다.

---

## 7. 세이브

- `state.js §newState` 에 **`cutContainers: []`** 가 늘었다.
- `save.js` 에 등록했다: `KNOWN_STATE_KEYS` · `serialize` · `deserialize`.
  한 줄 = `{ id, container, itemId, at, slotId, placedOnDay, cuttingId, usedOnDay }`.
- 삽수에 늘어난 칸 셋: `inContainerId` · `clockOnDay` · 그리고 `method`·`container` 가
  **`optStr`(null 허용)** 이 됐다.
- **옛 세이브는 그대로 열린다** — `cutContainers` 가 없으면 빈 배열, `clockOnDay` 가 없으면
  `clockDayOf` 가 `cutOnDay` 로 읽어 값이 한 톨도 안 달라진다. 검사 ⑧ 이 그걸 못 박는다.

---

## 8. 못 한 것 · 안 한 것

- **화면을 못 봤다.** 이 창은 `game.html`·`room_view.js` 가 ⛔ 라 **코어만** 쟀다.
  「고쳤다」를 화면 확인 없이 안 쓴다는 계율대로, 여기 적은 것은 전부 **코어 계약**이다.
  실제로 병이 방에 보이고 눌리는지는 마스터 창이 §5·§6 을 붙인 뒤에 재야 한다.
- **가방 삽수는 못 판다.** `shop.SELLABLE_CUTTING_STATUS` 가 `['rooted','node','established']` 라
  `'bag'` 이 없다. 일부러 안 넣었다 — 「가방에 있는 조각을 그냥 팔 수 있나」는 밸런스 판단이고
  이번 지시에 없다. 열려면 그 배열에 `'bag'` 한 줄이다.
- **`S.pots` 승격은 그대로 막혀 있다**(`promoteToPot` 이 던진다). 다개체 리팩터 뒤다.
- **숫자를 하나도 안 바꿨다.** 물꽂이 12/20 · 화분 24/45 · 유예 8/16 그대로다.
  박사님이 기억하신 「30일 차이」와 실제 25일(20 vs 45) 차이는 마스터 창이 이미 말씀드렸고,
  `METHODS.pot.nodeDays` 한 줄이면 바뀐다 — **지시가 오기 전에는 안 건드린다.**
- **트레이(`tray`)는 여전히 막혀 있다** — 에셋 미정(`ready:false`).
- **빈 용기를 `state.placedItems` 에 안 실었다.** `S.emptyPots`(빈 화분)도 안 실려 있어서
  **같은 결로 맞춘 것**이다. 그 목록은 「그 자리의 DLI 를 재야 하는 것」인데 빈 그릇은 잴 것이
  없다. ⚠ 다만 그래서 **빈 그릇은 자리 겹침 판정에도 안 들어간다** — 빈 화분이 이미 그렇게
  돌고 있으므로 새로 생긴 구멍은 아니다. 겹침을 막으려면 `emptyPots` 와 **같이** 고쳐야 한다.
