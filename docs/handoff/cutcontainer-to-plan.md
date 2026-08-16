# 그릇은 한 갈래다 — 무엇이 들어가느냐는 「심을 때」 고른다 (2026-08-17)

창: cutcontainer · 쓴 파일: `src/game/propagation.js` · `src/game/state.js` · `src/game/save.js` ·
`tools/test_cutcontainer.mjs`. `game.html` 과 `room_view.js` 는 **한 글자도 안 만졌다.**

> ⚠ 이 문서는 **두 번 쓰였다.** 오전에 「삽수용 그릇」과 「씨앗용 화분」을 갈라 놓았고,
> 박사님이 그 구분을 물리셨다. 지금 도는 것은 **아래 모형 하나**뿐이다.
> 오전 모형(`S.cutContainers`)은 §9 에 「무엇을 물리셨나」로만 남긴다.

---

## 0. 무엇이 달라졌나 — 설명 먼저

박사님 원문:

> *"**삽수 꽂기가 뭐야? 용도가 아니라 거기 심어지는 거에 따라 나뉘어야지.** 지금 채소 씨앗
> 심는 거랑은 다르게. **씨앗심기 누르면 심을 수 있는 인벤 템 리스트가 팝업으로 나와서
> 고르도록** 하자."*

그래서 이렇게 된다.

```
① 자른다          → 삽수가 **가방**으로 온다 (자리도 그릇도 없다 · 재고를 한 톨도 안 쓴다)
② 빈 그릇을 놓는다 → 검은 모종포트든 유리 수경병이든 **그냥 빈 그릇**이다. 용도를 안 묻는다
③ 그릇을 누른다 → [🌱 심기]
     ↳ 팝업: **심을 수 있는 것 목록** (가방에서)
         · 몬스테라 씨앗 ×2
         · 삽수 cut_01 — 잎 1장 · 무늬 2장
         · 삽수 cut_03 — 잎 2장            ← 유리병이면 **회색 + 「물꽂이는 잎 1장까지입니다」**
     ↳ 고르면 그것이 심긴다
④ 뺀다   → 삽수는 가방으로, **그릇은 빈 채로 그 자리에 남는다**
⑤ 걷는다 → 빈 그릇을 걷어 가방으로
```

★ **그릇에 딱지가 없다.** 「이 화분은 씨앗용인가 삽수용인가」라는 물음이 사라졌다 —
그것이 박사님이 물리신 그 물음이다. 규칙이 목록을 좁힐 뿐이다:
유리 수경병은 삽수만 받으므로(`CONTAINERS.jar.accepts`) 그 팝업에는 삽수만 뜬다.

★ **목록도 하나다.** 방에 놓인 빈 그릇은 전부 **`S.emptyPots`** 한 줄기에 산다.
오전에 냈던 `S.cutContainers` 는 **통째로 걷었다**(하루 살았다). 세이브 칸이 는 것이 아니라 줄었다.

---

## 1. 목록이 하나라는 것의 뜻 — **빈 것만 산다**

| 무슨 일이 나면 | 그릇은 |
|---|---|
| 씨앗이 들어간다 | `S.pots` 로 **승격**된다 (같은 id 그대로). 이 목록에서 빠진다 |
| 삽수가 들어간다 | **삽수가 그릇을 지고 간다**(`c.container`·`c.at`·`c.slotId`). 이 목록에서 빠진다 |
| 삽수를 도로 뺀다 | **돌아온다** — 같은 이름·같은 자리·`usedOnDay` 가 찍혀서 |
| 삽수가 시들어 죽는다 | **돌아온다** (유리병은 안 시든다 · §4 를 봐라) |
| 분갈이한다 | 병이 **재고로** 돌아온다 (예전 그대로 — 방에 그릇이 없으므로 겹칠 것이 없다) |

★★ 그래서 **양쪽에서 서로를 가리키는 칸이 없다.** 그릇에 `cuttingId` 가 없고, 삽수의
`inContainerId` 는 「지금 어디 있나」가 아니라 **「돌아갈 때 쓸 이름」**일 뿐이다. 어긋날 곳이 없다.

한 줄 = `{ id, container, itemId, at, slotId, placedOnDay, usedOnDay }`
- `container` — `'soil'`(검은 모종포트) | `'jar'`(유리 수경병). **옛 줄에는 없다** → `itemId` 로 읽는다
- `usedOnDay` — 한 번이라도 무언가 들어앉았나. **걷을 때 재고로 돌아오나**가 이 칸으로 갈린다

---

## 2. 창구 목록

### 화면이 쓰는 문 넷 (`src/game/state.js`)

| 창구 | 하는 일 |
|---|---|
| `placeEmptyPot(S, at, opt)` | 빈 그릇을 놓는다. `opt.container` 로 갈래를 고른다(기본 `'soil'`) |
| `plantableInto(S, containerId)` | **[🌱 심기] 팝업 목록** — 씨앗과 삽수를 한 목록으로 |
| `plantInto(S, io, containerId, pick, opt)` | 고른 것을 심는다. **씨앗이든 삽수든 같은 문** |
| `removeContainer(S, containerId, opt)` | 빈 그릇을 걷어 가방으로 (`propagation` 것을 그대로 쓴다) |

### 삽수 쪽 (`src/game/propagation.js`)

| 창구 | 하는 일 |
|---|---|
| `takeCutting(S, opt)` | `opt.container` 가 **선택**이다. 안 주면 가방으로 온다 |
| `takeCuttingOut(S, cuttingId, opt)` | 삽수를 가방으로. **그릇은 빈 채로 그 자리에 남는다** |
| `putCuttingIn(S, cuttingId, containerId, opt)` | (`plantInto` 가 안에서 부른다) |
| `placeCutContainer(S, container, at, opt)` | (`placeEmptyPot` 이 안에서 부른다) |
| `emptyContainersOf(S)` · `containerRowOf(S,id)` · `containerKindOf(row)` · `containerKindOfItem(itemId)` | 읽기 |
| `leafGrowthStopped(c)` · `clockDayOf(c)` | 수경 멈춤 · 시계 기준일 |

### 계약 (자세히)

**`plantableInto(S, containerId)`** → `{ containerId, container, containerKo, accepts, rows }`

`rows[]` 한 줄 = `{ kind, id, ko, sub, can, why, count }`
- `kind` — `'seed'`(그러면 `id` 는 상점 품목 `monstera_seed`) | `'cutting'`(`id` 는 삽수 id)
- `ko` — 화면에 찍을 이름 · `sub` — 부제(`"잎 2장 · 무늬 1장"` · 없으면 `null`)
- `can` — 넣을 수 있나 · `why` — 못 넣으면 **사람이 읽는 까닭**(넣을 수 있으면 `null`)
- `count` — 씨앗 몇 립(삽수는 늘 1)

⚠ **못 넣는 줄을 목록에서 빼지 않는다.** 회색으로 두고 까닭을 적는다.
⚠ 다만 **갈래 자체가 안 받는 것은 아예 안 낸다**(유리 수경병 × 씨앗). 그건 「이 개체가
안 된다」가 아니라 **그 그릇이 받는 것이 아니다**라, 목록에 두면 될 수도 있는 줄로 읽힌다.
그 금은 `CONTAINERS[*].accepts` 가 긋는다 — `soil: ['seed','cutting']` · `jar: ['cutting']`.
⚠ 씨앗이 가방에 **0립이어도 줄은 낸다** — `can:false` + `"가방에 몬스테라 씨앗이 없습니다 —
상점에서 주문해 주세요"`. 줄이 아예 없으면 「왜 못 심나」를 못 말한다.

**`plantInto(S, io, containerId, pick, opt)`** → `{ kind, containerId, potId? , cuttingId? }`
- `pick` 은 `plantableInto` 가 낸 줄을 그대로 넘기면 된다(`{ kind, id }` 만 본다).
- `io` 는 **씨앗일 때만** 쓴다(생장 창에 그루를 세워야 한다). 삽수면 안 본다 — `null` 이어도 된다.
- 씨앗: **놓인 그 자리·그 그릇**에 심는다(자리를 다시 안 고른다). 그릇값은 **안 낸다**
  (`usePot:false` — 놓을 때 이미 냈다).
- 삽수: `putCuttingIn` 으로 간다 — `status:'rooting'` · `days:0` · `clockOnDay = 오늘`.
- ⚠ 던지는 사유는 전부 **플레이어 입력**이다(`e.tutorialInput === true`) — 판을 잠그지 마라.

**`placeEmptyPot(S, at, opt)`** → `{ id, container, containerKo, itemId, at, slotId, accepts, left }`
- `opt.container` = `'soil'` | `'jar'`. 안 주면 `opt.potItemId` 로 읽고, 그것도 없으면 `'soil'`.
- `opt.slots`·`opt.size`·`opt.snapDist` 는 예전 그대로.
- 순서: `assertStockAll` → `resolvePlacement` → `useStock`. **중간에 던지면 아무것도 안 바뀐다.**

**`removeContainer(S, containerId, opt)`** → `{ id, container, itemId, returned, left }`
- **돌아오나**는 `CONTAINERS` 가 정한다: 유리 수경병은 언제나(소모품이 아니다),
  검은 모종포트는 **한 번이라도 쓴 것이면 안 돌아온다**(흙째 쓴다). 안 쓴 채로 걷는 것은
  「잘못 놓았다」를 되돌리는 일이라 둘 다 돌아온다.
- 삽수가 든 그릇 id 를 주면 **「그 그릇에는 삽수 cut_01 이 들어 있습니다 — 먼저 가방으로
  빼 주세요」**로 던진다(`tutorialInput`). 「모르는 용기」라고만 하지 않는다.

---

## 3. ★ 수경은 혹이 나면 성장을 멈춘다 (박사님 ③) — **재 보니 이미 그랬다**

「지금 그렇다」와 「그렇게 하기로 했다」를 갈라 적는다(START-HERE §2 규칙 2).

- **지금 그렇다**: 잎이 나는 자리는 `stepCuttings §①-3` **하나**뿐이고 조건이
  `status === 'established'` 다. 물꽂이는 `rooting → rooted → node` 로만 가고 `established` 에
  **닿는 길이 없다**(닿는 순간은 분갈이인데 그때 `method` 가 `'pot'` 이 된다).
  캐논이 그렇게 못 박고 있다(`§삽수가 자란다` 규칙 ① — *"물꽂이는 뿌리만 내고 잎은 안 낸다"*).
- **그렇게 하기로 했다**: 그래도 조건을 글로 박았다(`leafGrowthStopped(c)`). 까닭 둘 —
  ① 박사님이 규칙으로 말씀하신 것이라 코드에 그 문장이 있어야 다음 사람이 안 되묻는다
  ② 「established 에 못 닿는다」는 **딴 계통의 사정**이다. 언젠가 물꽂이가 자리를 잡게 열리는 날
  (트레이·수경 전용 그릇) 이 조건이 없으면 말없이 규칙이 깨진다.

⚠⚠ **분갈이 기한은 안 걷었다** (*"혹이 나면 성장이 멈추되 기한은 그대로"*).
⚠ **흙은 안 건드렸다** — 박사님 ③ 은 수경만이다. 대조군을 잎 수로 쟀다(§5 표).

---

## 4. 판단 셋 — 까닭을 적으라 하신 것

### ㉮ 목록을 합쳤다 — 그리고 화면이 안 깨졌다

박사님 모형이 「용도로 그릇을 가르지 마라」이므로 목록도 하나라야 한다. 합치고 나서 **화면이
쓰던 이름이 하나도 안 바뀌었다**: `S.emptyPots` · `placeEmptyPot` · `removeEmptyPot` · `emptyPotOf`.
속만 `propagation` 으로 옮겼다(규칙표 `CONTAINERS` 가 거기 있어서다).

⚠ **화살표는 한 방향이다: `state → propagation`.** 그쪽은 이 파일을 안 부르므로 순환이 안 생긴다
(propagation 은 place·shop·stamina 만 쓴다). 그래서 `propagation` 이 `S.emptyPots` 를 직접
만지는데, 그건 이 저장소가 이미 쓰는 수법이다(`shop.js` 가 `ts.varieSale` 을 직접 적는다 —
*"거꾸로 import 하면 순환이 된다"*).

### ㉯ 회수는 **살아 있으면 언제든** 된다

박사님 ④ 는 *"혹이 나서 성장이 멈춘 삽수를 다시 인벤으로"* 다. 「혹 난 뒤에만」으로 안 좁혔다.
① 그 말씀은 요구이지 금지가 아니다 ② 넣기가 아무 때나 되는데 빼기만 막으면 잘못 꽂은 실수를
되돌릴 길이 없다 ③ **남용이 이득이 되는 길이 없다** — 빼면 시계가 멈추고 다시 넣으면 `days:0`
으로 처음부터 돈다 ④ 규칙이 하나면 팝업 단추가 회색이 되는 경우가 없다.

### ㉰ ★ **삽수가 죽어도 그릇은 안 죽는다** (새로 정한 것 · 오전 판과 다르다)

물꽂이 삽수가 기한을 넘겨 시들면, 예전에는 **유리병까지 같이 사라졌다.** 목록을 합치면서
그 자리가 눈에 띄었고 고쳤다 — 죽은 삽수의 그릇은 **빈 그릇으로 방에 남는다**(`usedOnDay` 찍힘).

까닭: **유리병은 안 시든다.** 삽수가 말라 죽었다고 병까지 없어지면 아무도 말 안 한
7,000원짜리 벌이 하나 붙는 것이고, 그건 `propagation.js` §③ 이 금지한 「조용히 사라지는 것」이다.
⚠ 이건 **밸런스가 조금 후해지는 변경**입니다 — 물꽂이 실패의 값이 「삽수 + 그 날짜 + 병」에서
「삽수 + 그 날짜」로 줄었습니다. 되돌리려면 `putContainerBack` 을 죽음 쪽에서 안 부르면 됩니다.

---

## 5. 잰 표 — `node tools/test_cutcontainer.mjs` (검사 25개 · 전부 통과)

표 머리: 방 = 반지하 · 모드 = novice(따로 적은 것만 자유) · 튜토 지갑 켬 · `firstPlay` **끔** ·
빛 = 하네스가 `{ dli:8, grows:true, band:'best' }` 를 늘 준다(코어는 빛을 안 잰다).

| 잰 것 | 결과 |
|---|---|
| 용기 없이 자르기 | `status:'bag'` · 병/포트 재고 **그대로** · 잎 2장(무늬 1) · 등급 `[null,"halfmoon"]` · 모주 143.5일/seed 92158 그대로 적힘 |
| 가방에서 50일 | `days = 0` · 기한 없음 · 안 사라짐 |
| 빈 그릇 놓기/걷기 (jar·soil) | 놓으면 재고 −1 · 걷으면 +1 · 재고 없으면 던지고 **목록에 안 남음** |
| **빈 그릇이 한 목록** | `pot_02:soil · pot_03:jar · pot_04:soil` — 전부 `S.emptyPots` · `S.cutContainers` 는 **없음** |
| **흙 팝업** | `몬스테라 씨앗(됨) · 삽수 cut_01(됨) · 삽수 cut_09(됨)` |
| **병 팝업** | `삽수 cut_01(됨) · 삽수 cut_09(회색: 물꽂이는 잎 1장짜리 조각만 받습니다…)` — **씨앗 줄이 아예 없다** |
| `plantInto` 삽수 | `rooting` 시작 · 그릇이 목록에서 빠짐 · `S.pots` 안 늘어남 |
| `plantInto` 씨앗 | **놓은 그릇 id 그대로** 화분이 됨 · 놓은 자리 그대로 · 씨앗 −1 · **그릇값 추가 없음** |
| 유리병에 씨앗 | 던짐(`tutorialInput`) · 그릇도 씨앗도 **안 바뀜** |
| 넣기 (가방 10일 뒤) | Day 11 에 꽂음 → 뿌리 **12일째** · 혹 **20일째** (자른 날이 아니라 **넣은 날** 기준) |
| 물꽂이 잎 수 | 1일:1장 · 12일:1장 · 19일:1장 · **20일(혹):1장** · 28일:1장 · 34일:1장 ⇒ **내내 평평** |
| 흙 잎 수(대조군) | 24일:2장 · 43일:3장 · **45일(혹):3장** · 63일:**4장** · 80일:4장 ⇒ **혹 뒤에도 는다** |
| 기한 — 초보 | 넣은 날 Day 8 · 유예 16일 · **Day 44 사망** · 경고 5회 (= 8+20+16) |
| 기한 — 자유 | 넣은 날 Day 8 · 유예 8일 · **Day 36 사망** · 경고 3회 (= 8+20+8) |
| **죽은 뒤 그릇** | 빈 그릇으로 **목록에 남고** `usedOnDay` 가 찍힌다(§4 ㉰) |
| 가방 60일 뒤 넣기 | 넣고 21일 · 기한 Day 97(오늘 82) — **남은 15일** (옛 셈이면 이미 죽었을 것) |
| 회수 | 삽수 → 가방 · **같은 이름·같은 자리로 그릇이 돌아옴** · 재고 그대로 · 60일 굴려도 안 죽음 · 다시 넣으면 0일부터 |
| 든 그릇 걷기 | 던짐(`tutorialInput`) · 사유에 「삽수」가 들어감 · 재고 안 바뀜 · 빼면 걷힘(+1) |
| 쓴 모종포트 걷기 | `returned:false` — 「심고 빼고 걷고」로 포트가 공짜가 안 된다 |
| 옛 호출부(jar·soil) | `rooting` 즉시 시작 · 재고 −1 · `clockOnDay === cutOnDay` · 방에 그릇 안 섬 |
| 세이브 왕복 | 가방 삽수 · 빈 병 · 든 그릇(목록에 없음)이 그대로 · 두 번 저장해도 안 흔들림 |
| **옛 세이브**(삽수 새 칸 없음) | 그대로 열림 · `clockDayOf` 가 `cutOnDay` 로 읽음 · 기한 Day 37 로 **같음** |
| **옛 빈 화분**(`container` 칸 없음) | 그대로 열림 · `containerKindOf` 가 `itemId` 로 `'soil'` 을 읽음 · 씨앗을 심을 수 있음 |
| **하루짜리 `cutContainers` 세이브** | 빈 병 1개를 `emptyPots` 로 옮김 · 삽수가 들어 있던 줄은 **안 옮김**(그릇이 둘이 되지 않게) |
| 흙 두 걸음 | 놓고 → 심고 → 자리 **24일** · 혹 **넣은 날+45** · 기한 null · **120일 굴려도 안 죽음** |

### 기존 검사

`test_propagation` · `test_cutting_wiring` · `test_cuttable` · `test_escapecut` · `test_cutstamina` ·
`test_quest` · `test_stamina` · `test_save` · `test_multiplant_core` · `test_repot_atomic` ·
`test_market` · `test_econ` · `test_first_play` · `test_siru_each` · `test_variegrade` · `test_snap`
— **전부 통과.**

`test_pots` · `test_free_place` 는 빨간데, **내 세 파일을 HEAD(`40e255b`) 판으로 되돌려도
똑같이 빨갛다.** 어제도 그랬고(헤드리스 9개 + 브라우저 3개) 원인은 다른 창이 손보는 중인
것들이다(`growth_adapter.js` · `game.html` · `data/house_rooms.json` · `room_profile.banjiha.json`).
⚠ 재는 법: 내 세 파일만 `git show HEAD:` 로 덮어 돌리고 되돌렸다 — 색인은 안 건드렸다.

---

## 6. ★ `game.html` 이 붙일 것 — **새 모형으로 다시 씀**

들여오기:

```js
import { /* … 지금 있는 것 그대로 … */
         placeEmptyPot, removeEmptyPot, emptyPotOf,
         /* ★ 2026-08-17 신설 — 팝업 두 문 */
         plantableInto, plantInto } from './src/game/state.js';
import { /* … 지금 있는 것 그대로 … */
         takeCuttingOut, removeContainer,
         emptyContainersOf, containerRowOf, containerKindOf,
         CONTAINERS } from './src/game/propagation.js';
```

### ① 자르기 단추 — 용기를 **안 넘긴다**

```js
// 지금: takeCutting(S, { potId: pot0(S).id, nodes, nodeId, container, ... })
c = takeCutting(S, { potId: pot0(S).id, nodes, nodeId,
                     motherGrowthDays: io.growth.growthDays(),
                     motherSeed: <그 그루 씨앗>,
                     log: m => pushLog(S, m) });
// c.status === 'bag' · c.at === null → 자리를 안 잡는다
```
⚠ `container` 를 계속 넘겨도 예전처럼 돈다. **한 번에 안 바꿔도 된다.**

### ② 그릇을 놓는다 — `commitPlace` · `startPhonePlace` 의 그 자리 그대로

```js
// 지금:  placeEmptyPot(S, atOf(hit), { ...placeOpt(), potItemId: potItemOf(what) })
// 새로:  갈래만 얹는다. 안 얹으면 예전과 똑같이 검은 모종포트다
placeEmptyPot(S, atOf(hit), { ...placeOpt(),
                              container: what === 'jar' ? 'jar' : 'soil' });
```
⇒ 가방 품목 `jar`(유리 수경병)를 **끌어 놓을 수 있게** 하면 그것으로 끝이다.
「용도를 묻는 팝업」은 **필요 없다** — 박사님이 물리신 그것이다.

### ③ ★ [🌱 심기] 팝업 — 이번 일의 뼈대

지금 `drawEmptyPots()` 가 그리는 줄의 단추가 `sowEmptyPot(id)` 를 부른다. **그 함수만 갈면 된다.**

```js
function openPlantPopup(containerId) {
  let r = null;
  try { r = plantableInto(S, containerId); }
  catch (e) { banner('그 그릇을 못 찾았습니다', e.message); return; }

  // r.containerKo  '검은 모종포트' | '유리 수경병'   ← 팝업 제목에
  // r.rows[]       { kind, id, ko, sub, can, why, count }
  const html = r.rows.length
    ? r.rows.map(row => `
        <button class="plantPick" data-kind="${row.kind}" data-id="${row.id}"
                ${row.can ? '' : 'disabled'}>
          <b>${esc(row.ko)}</b>
          ${row.sub ? `<small>${esc(row.sub)}</small>` : ''}
          ${row.can ? '' : `<em class="why">${esc(row.why)}</em>`}
        </button>`).join('')
    : `<p class="empty">가방에 이 그릇에 심을 것이 없습니다</p>`;
  // … 시트에 붙이고, 누르면 아래 pick()
}

function pick(containerId, kind, id) {
  try {
    const r = plantInto(S, io, containerId, { kind, id });
    banner(r.kind === 'seed' ? '🪴 몬스테라를 심었습니다' : '🫙 삽수를 꽂았습니다',
           r.kind === 'seed' ? '씨앗부터라 오래 걸립니다 — 물을 주고 밝은 자리에 두세요'
                             : '오늘부터 뿌리내리기가 시작됩니다');
  } catch (e) {
    // ⚠ e.tutorialInput === true 면 **고장이 아니라 안내**다 — 판을 잠그지 마라
    banner('심지 못했습니다', (e && e.message) || '');
    return;
  }
  syncRoom(); draw();
}
```
⚠ **`removeEmptyPot` 을 따로 안 불러도 된다** — `plantInto` 가 안에서 뺀다.
⚠ **회색 줄을 숨기지 마라.** `why` 를 같이 찍는 것이 이 팝업의 값어치다.

### ④ 그릇 줄·그릇 클릭

```js
// 빈 그릇 목록 (지금 drawEmptyPots 의 rows 를 이걸로 바꾸면 유리병도 같이 뜬다)
const rows = emptyContainersOf(S);           // = S.emptyPots
for (const t of rows) {
  const kind = containerKindOf(t);           // 'soil' | 'jar' — 옛 줄도 읽힌다
  const ko   = CONTAINERS[kind].ko;          // '검은 모종포트' | '유리 수경병'
  // 단추 둘: [🌱 심기] → openPlantPopup(t.id) · [📦 걷기] → pickUp(t.id)
}

function pickUp(id) {
  try {
    const r = removeContainer(S, id, { log: m => pushLog(S, m) });
    banner('📦 걷었습니다', r.returned ? '가방으로 돌아왔습니다'
                                       : '한 번 쓴 것이라 돌아오지 않습니다');
  } catch (e) { banner('못 걷었습니다', e.message); return; }   // e.tutorialInput 확인
  syncRoom(); draw();
}
```

### ⑤ 삽수 팝업의 [🎒 가방으로]

```js
takeCuttingOut(S, c.id, { log: m => pushLog(S, m) });
// → 삽수는 가방으로, 그릇은 **같은 이름·같은 자리**로 빈 그릇 목록에 돌아온다
//   (r.containerId 가 곧 그 이름이다 — 방뷰가 3D 를 그 이름으로 잡고 있다면 그대로 쓰면 된다)
```

### ⑥ 화면이 읽을 새 칸

`cuttingSnapshot(S, c)` 에 늘어난 것:

| 칸 | 뜻 |
|---|---|
| `inBag` | 가방에 있나 — [넣기] 를 내밀 대상 |
| `inContainerId` | 어느 그릇에서 왔나 — [가방으로] 를 누르면 그 이름으로 돌아온다 |
| `leafGrowthStopped` | 수경이 혹으로 멈췄나 — 「왜 잎이 안 느나」를 말할 근거 |
| `statusKo` | `'가방에 있다 — 용기에 넣어야 시작한다'` 가 늘었다 |

⚠ 가방 삽수는 `daysLeft`·`graceDays` 가 **null** 이다(기한이 없다). 「기한 —」로 찍지 말고
「용기에 넣어야 시작합니다」로 찍어 주십시오.

---

## 7. ★ `room_view.js` 에 필요한 것 (마스터 창이 그쪽에 넘길 것)

**코어는 `room_view.js` 를 한 글자도 안 만졌다.** 방 뷰가 새로 알아야 하는 것은 셋이다.

1. **빈 그릇을 갈래대로 그린다.** 지금 `syncRoom` 이 `S.emptyPots` 를 돌면서
   `setPlantAt(ep.id, ep.at, { kind: 'emptypot' })` 를 부른다. **그 줄에 갈래를 얹으면 된다** —
   `propagation.containerKindOf(ep)` 가 `'soil'|'jar'` 를 낸다.
   에셋은 `CONTAINERS[kind].assetId`: `jar` = `pots/pot_glassjar.glb`(있다) ·
   `soil` = **`null`**(아직 없다 → 대체 표현이 필요하다). 지름은 `realMaxM`(jar 0.13m · soil 0.12m).
2. **클릭 판정**이 빈 그릇에도 붙어야 한다 — 박사님 ⑥([유리병 클릭 → 회수 버튼])이 그것이고,
   [🌱 심기] 팝업도 그릇을 눌러서 연다. 맞으면 `{ kind:'container', id: t.id }` 를 내주면 된다.
3. **드롭 대상** — 가방의 삽수를 드래그해서 그릇에 떨어뜨리는 길(박사님 ②).
   「지금 커서 밑의 빈 그릇 id」를 낼 창구가 있으면 `plantInto(S, io, id, {kind:'cutting', id})` 로 간다.

⚠ 가구를 옮기면 그릇도 따라간다 — **코어가 이미 한다**(`state.followFreeOnFurniture` 의
`S.emptyPots` 줄 하나가 유리병까지 같이 옮긴다). 그리고 **받치던 가구가 사라진 빈 그릇을
회수하는 길**을 이번에 새로 넣었다(`propagation.rehomeCuttings` 가 빈 그릇도 본다) —
빈 화분이 생긴 2026-08-16 부터 있던 구멍이다. 방 뷰는 그린 것만 따라 움직이면 된다.

---

## 8. 세이브

- **`S.cutContainers` 를 걷었다.** `KNOWN_STATE_KEYS` · `serialize` · `deserialize` 에서 다 빠졌다.
  칸이 는 것이 아니라 **줄었다.**
- `emptyPots` 줄에 **`container`** 와 **`usedOnDay`** 가 늘었다.
  옛 줄에는 없고, 없으면 `containerKindOf` 가 `itemId` 로 읽는다(**지어내는 것이 아니라 되읽는 것**).
- 삽수에 늘어난 칸 둘: `inContainerId` · `clockOnDay`. `method`·`container` 는 `null` 을 받는다.
- **옛 세이브가 그대로 열린다** — 검사 ⑧·⑪ 이 못 박는다.
- **하루 살았던 `cutContainers` 세이브도 열린다** — 빈 줄은 `emptyPots` 로 옮기고,
  삽수가 들어 있던 줄은 **안 옮긴다**(지금은 삽수가 그릇을 지고 있어서 옮기면 그릇이 둘이 된다).

---

## 9. 물리신 것 — 오전 판(참고용)

오전에는 `S.cutContainers`(삽수용)와 `S.emptyPots`(씨앗용)를 **갈라** 두고, 화면이
「이 화분을 어느 쪽으로 놓을지」를 정하게 했다. 박사님이 그 구분 자체를 물리셨다.
남은 것은 **그때 낸 창구 이름들**(`placeCutContainer`·`putCuttingIn`·`takeCuttingOut`·
`removeContainer`)이고, 속이 한 목록으로 바뀌었다. 이 문서의 §0~§8 만 지금 참이다.

---

## 10. 못 한 것 · 안 한 것

- **화면을 못 봤다.** 이 창은 `game.html`·`room_view.js` 가 ⛔ 라 **코어만** 쟀다.
  「고쳤다」를 화면 확인 없이 안 쓴다는 계율대로, 여기 적은 것은 전부 **코어 계약**이다.
  팝업이 실제로 뜨고 눌리는지는 마스터 창이 §6·§7 을 붙인 뒤에 재야 한다.
- **가방 삽수는 못 판다** — `shop.SELLABLE_CUTTING_STATUS` 에 `'bag'` 을 안 넣었다(지시대로 그대로 뒀다).
- **숫자를 하나도 안 바꿨다.** 물꽂이 12/20 · 화분 24/45 · 유예 8/16 그대로다.
- **빈 그릇을 `state.placedItems` 에 안 실었다.** 그 목록은 「그 자리의 DLI 를 재야 하는 것」인데
  빈 그릇은 잴 것이 없다. ⚠ 그래서 **빈 그릇은 자리 겹침 판정에도 안 들어간다** —
  빈 화분이 2026-08-16 부터 그렇게 돌고 있으므로 새로 생긴 구멍은 아니다.
- **트레이(`tray`)는 여전히 막혀 있다** — 에셋 미정(`ready:false`).
- **밸런스가 한 군데 후해졌다** — 삽수가 죽어도 그릇이 남는다(§4 ㉰). 되돌리는 법도 거기 적었다.
