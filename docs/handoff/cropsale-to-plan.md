# 2026-08-06 · cropsale → plan (잉여 채소를 파는 창구를 만들었다)

박사님 확정(2026-08-05): *"잉여 채소를 팔 수 있게 해서 오래 노가다하면 일단 마칠 수는 있게.
씨앗 비용보다는 살짝 이득이게."*

econgap 이 **값을 다 재 놨는데 파는 창구가 코드에 없었다**(`econgap-to-plan.md §B-7 ②`).
이 작업이 만든 것이 그 창구다. **새 숫자는 하나도 안 만들었다** — 잉여의 정의도, 손익분기도,
판매가 후보도 전부 이미 있던 값을 읽는다.

## 결론 네 줄

1. 파는 것은 **곳간이 못 받은 몫**뿐이다 — `overlapLostWon`(겹쳐서 못 받음) + `spoiledWon`(넘쳐서 쉼).
   곳간(`pantryWon`)은 파는 함수가 **한 번도 안 만진다.** 「끼니는 안 팔린다」가 검사로 지키는
   약속이 아니라 **구조**다.
2. 판매가는 **`first_play.FIRST_PLAY_RULES.cropSurplusSaleRate` 한 곳**에만 있다.
   지금 **0.70**(econgap 권고)이고 **미확정**이라고 주석·문서에 적어 뒀다.
   `characters.json._meta.cropSurplusSaleRate` 가 생기면 **그쪽이 이긴다** — 코드를 안 고쳐도 된다.
3. `game.html` 이 부를 것은 **`state.sellCropSurplus(S)` 와 `state.cropSurplusStatus(S)` 둘**이다(§시그니처).
4. ⚠ **못 한 것 하나 — 세이브.** `save.js` 가 이 창 소유가 아니라 새 칸 두 개가 안 실린다.
   저장하면 안 넘긴 잉여가 사라진다. 고칠 세 줄을 §세이브에 적어 뒀다.

---

# 1. ★무엇을 파는가 — 이게 이 작업의 전부다

## 1-1. 「잉여」를 새로 정하지 않았다

코어가 이미 두 값을 내고 있었다(`harvestBeansprout` 의 반환).

| | 무엇인가 | 왜 끼니가 못 되나 |
|---|---|---|
| `overlapLostWon` | 같은 날 겹쳐 거둬 표가 깎은 차액 (3,000 → 2,000 → 1,000 → 0) | **곳간에 아예 안 들어갔다** |
| `spoiledWon` | 곳간 한도(`pantryCapWon`)를 넘어 쉰 몫 | **넘쳐서 나갔다** |

밥은 `eatFromPantry` 가 **곳간에서만** 꺼낸다. 두 값은 곳간 밖이라 밥이 될 길이 **원천적으로 없다.**
⇒ 그래서 이 둘만 팔면 「식물로 밥값을 아낀다」가 「식물을 판다」로 안 바뀐다.

## 1-2. ★「하루 저감 상한을 넘긴 몫」과의 관계 — 같은 문지기의 앞뒤다

지시는 *"하루 저감 상한(`rules.dailyCropSaveWon`)을 넘긴 몫만 팔 수 있다"* 였다.
읽어 보니 그 상한은 **두 갈래로** 드러나고 있었다.

```
같은 날 안에서   → 겹침 표가 그 자리에서 자른다        → overlapLostWon
여러 날에 걸쳐   → 곳간이 하루 5,000원씩만 빠지므로
                   그보다 많이 들어오면 한도에 닿는다   → spoiledWon
```

⇒ `spoiledWon` 은 **상한 초과가 며칠 걸려 드러난 모습**이다. 둘을 다 팔아야 상한 초과분을
빠짐없이 파는 것이 되고, 둘 중 어느 것도 상한 **안쪽**을 건드리지 않는다.
**하루 저감 상한 5,000원은 이 작업으로 한 푼도 안 올라간다.**

★ 그리고 이 정의는 econgap 이 장부로 잰 것과 **글자 그대로 같다** —
`tools/probe_economy_gap.mjs:301` 이 `income = Math.round(rate * (lost + spoiled))` 이다.
⇒ **이 창구를 켜면 econgap 표의 파산일이 그대로 재현된다.** 새로 재야 할 것이 없다.

## 1-3. ★「쉰 것을 판다」가 왜 앞뒤가 맞나 — **떨이라서**

`spoiledWon` 은 곳간이 못 받아 **결국 버릴** 몫이다. 버릴 것을 알면서 그날 넘기면 안 쉰다.
대신 제값을 못 받는다 — 급히 넘기는 것이라 그렇다.
**판매가가 100%가 아니어야 하는 이유가 서사에서 나온다.**

⚠ **바꾼 것과 안 바꾼 것을 분명히 한다.** 수확 셈(`harvestBeansprout`)은 **한 글자도 안 바꿨다** —
곳간에 들어간 값도, 깎인 값도, 쉰 값도 예전 그대로다. 새로 한 일은 「버려질 몫이 얼마였나」를
`fp.food.surplusWon` 에 **적어 두는 것**뿐이다. 그래서 기존 검사·재현이 하나도 안 움직였다.

⚠ 그 대가로 `loop.harvestCrop` 의 로그는 여전히 *"🗑 곳간이 넘쳐 N원어치가 쉬었습니다"* 라고 말한다.
안 넘기면 정말 쉬므로 틀린 말은 아니지만, **넘길 수 있다는 것을 같이 말해 주는 편이 낫다.**
`loop.js` 는 이 창 소유가 아니라 안 건드렸다 — 문구는 그 파일 소유자의 몫이다.

## 1-4. 쌓아 둬도 되게 했다 — 날짜 제한을 안 뒀다

`fp.food.surplusWon` 은 **원**이지 채소가 아니다. 곳간과 달리 밥으로 돌아갈 길이 없으므로
며칠 모았다 한 번에 넘겨도 살림의 총액이 같다.

★ 날짜 제한(「그날 안 넘기면 쉰다」)을 **안 둔 이유**: 빨리감기(`loop` tick·자동수확)에서는
플레이어가 매일 [팔기]를 누를 수 없어 **잉여가 통째로 버려진다.** 그러면 econgap 이 잰 값과
어긋난다. 「아직 안 받은 떨이값」으로 읽으면 창고에 채소를 재는 그림도 아니다.

---

# 2. ★값 — 어디에 뒀고, 왜 거기인가

```
src/game/first_play.js  FIRST_PLAY_RULES.cropSurplusSaleRate = 0.70   ★미확정
```

- `data/balance/` 는 이 창 소유가 아니라 못 고쳤다. **`cropKindSavedWon`(3,000/2,000/1,000)이
  같은 이유로 이미 거기 있고**, 그 바로 옆이 자연스럽다 — 둘은 한 회전분이 **밥으로** 얼마인가와
  **돈으로** 얼마인가라는 한 쌍이다.
- `firstPlayRulesFromBalance` 가 **`_meta.cropSurplusSaleRate` 를 먼저 읽는다.** 지금은 그 칸이
  없어 늘 폴백으로 떨어지지만, plan 이 정본을 만드는 날 **코드를 한 글자도 안 고쳐도 된다.**
- 코드 어디에도 `0.7` 을 다시 쓰지 않았다. `tools/test_cropsale.mjs` 도 값을 안 박고 계약에서 읽는다.

## 2-1. ★고르실 때 보실 표 (전부 실측 · 이 검사가 매번 다시 잰다)

「잉여만 내는 시루」 하나를 한 회전 돌렸을 때의 **순액**이다.
(한 회전분 3,000원이 통째로 잉여가 되고, 지갑에서 나가는 것은 씨앗 **700원**뿐인 자리 —
econgap §6-3 의 마지막 줄 「겹침 3번째~ · 저감 상한 위」와 같은 칸이다.)

| 판매가 | 콩나물 회전당 순액 | econgap 여유 (시작 140만) |
|---|---|---|
| 16.7% (⚠정가로 잘못 셈한 손익분기) | **−200원** | — |
| 20% | **−100원** | — |
| **23.3% (콩나물 손익분기)** | **±0원** | — |
| 25% | +50원 | — |
| 40% | +500원 | — |
| 50% | +800원 | +1일 (콩15) |
| 60% | +1,100원 | +3일 (콩15) |
| **70% (지금 기본값)** | **+1,400원** | **+9일 (콩13 · 파산 135일 ≥ 이사 126일)** |
| 100% | +2,300원 | — |

⚠ 오른쪽 열은 **econgap 이 잰 값을 옮겨 적은 것**이지 이 창이 다시 잰 것이 아니다
(`econgap-to-plan.md §B-3`). 50%·60% 는 콩15 기준, 70% 는 콩13 기준으로 econgap 이 적어 뒀다.

- **손익분기는 콩나물 23.3% · 무순 30.0%** 다. 지갑에서 나가는 씨앗값(정가 × **1.4**)으로 잰 값이고,
  코드가 매번 다시 잰다: `shop.cropBreakEvenRate('beansprout' | 'musun')`.
- ⚠ 정가(500·400원)로 셈하면 16.7% / 20.0% 가 나온다. **틀린 값이다** — econgap 이 실제로
  한 번 그렇게 틀렸다. 검사 B·G 가 그 값이 아님을 못 박는다.
- 「씨앗 비용보다는 살짝 이득」(박사님)은 **23.3% 위**에서 시작하고, 「오래 노가다하면 마칠 수 있게」는
  econgap 실측으로 **50~70%** 가 필요하다.

★★ **판매가는 여전히 박사님이 정하실 값이다.** 이 창은 값을 안 정했다 — 자리와 눈금만 만들었다.

---

# 3. ★`game.html` 이 부를 시그니처 (코디네이터용)

`game.html` 은 한 글자도 안 건드렸다. 붙이실 것은 **`state.js` 의 두 함수**다.

```js
import { sellCropSurplus, cropSurplusStatus } from './src/game/state.js';
```

## ① 버튼을 켤지 흐리게 할지 — **상태를 안 바꾼다**

```js
const st = cropSurplusStatus(S);
// → { pendingWon: 6000,   // 아직 안 넘긴 잉여, **정가** 기준
//     rate: 0.7,          // 지금 판매가 (계약값)
//     won: 4200,          // 지금 넘기면 실제로 받을 돈 = round(pendingWon * rate)
//     canSell: true }
```

- 첫 플레이가 꺼져 있으면 `{ pendingWon: 0, rate: 0, won: 0, canSell: false }` 를 낸다. **안 던진다.**
- 버튼 문구 예: `잉여 넘기기 (4,200원)` · `canSell === false` 면 흐리게.

## ② 실제로 넘긴다

```js
const r = sellCropSurplus(S);
// → { won: 4200,            // 지갑에 들어간 돈
//     pendingWon: 6000,     // 넘긴 정가
//     rate: 0.7,
//     cashWon: …,           // 넘긴 뒤 지갑 (S.tutorial.cashWon). 튜토가 꺼져 있으면 null
//     kind: 'crop',
//     totalSoldWon: 4200,   // 이 판에서 지금까지 잉여로 번 돈 누계
//     events: [{ id: 'crop_surplus_sold', ko: '잉여 채소를 넘겼습니다',
//                won, pendingWon, rate }] }
```

- **로그는 함수가 알아서 한 줄 적는다**(`pushLog`). `opt.log` 를 넘기지 마십시오 — 두 줄이 됩니다.
- 넘길 것이 없으면 **던진다.** 던지는 오류에는 **`e.tutorialInput === true`** 가 붙어 있다 —
  `game.html` 의 `isRecoverable` 규약 그대로다(안내지 고장이 아니다).
  ```
  [잉여] 넘길 잉여가 없습니다 — 곳간이 받은 것은 밥으로 씁니다
         (겹쳐서 못 받거나 넘쳐서 쉰 몫만 넘길 수 있습니다)
  ```
- ★ **체력을 안 쓴다.** `shop.sellPot`·`sellCutting` 과 같다 — 파는 일에 체력을 물린 적이 없다.
  ⚠ 이건 판단이다. 물리게 되면 「콩15는 삽수를 영영 못 자른다」(econgap §A-3)가 한 칸 더 나빠진다.
  바꾸려면 stamina 창과 같이 정해야 한다.
- `events` 는 `turn.events` 와 같은 모양이라 그대로 `dialogue.scriptsForEvents` 에 넣어도 된다.
  ⚠ 다만 `crop_surplus_sold` 에 붙은 **대사는 아직 없다**(`dialogue.js` 는 이 창 소유가 아니다).

## ③ 수확 결과에도 잉여가 실려 나온다 (화면이 바로 말할 수 있게)

`loop.harvestCrop` / `first_play.harvestBeansprout` 의 반환에 두 칸이 늘었다.

```js
r.surplusWon         // 이번 수확이 낸 잉여 (정가)
r.surplusPendingWon  // 아직 안 넘긴 잉여 누계 (정가) = cropSurplusStatus(S).pendingWon
```

## ④ 더 낮은 층을 직접 부르실 일은 없지만

| 함수 | 파일 | 하는 일 |
|---|---|---|
| `cropSurplusQuote(fp)` | first_play | 상태를 안 바꾸고 견적만 |
| `cropSurplusRateOf(fp)` | first_play | 지금 판매가 |
| `takeCropSurplus(fp)` | first_play | 장부를 비우고 값을 낸다. **지갑은 안 만진다** |
| `creditCropSurplus(S, won)` | shop | 지갑에 넣는다 (`sellPot`·`sellCutting` 과 같은 문) |
| `cropBreakEvenRate(kindId)` | shop | 손익분기를 잰다 (콩 0.233 · 무순 0.300) |

---

# 4. ★세이브 — **못 한 것. 이것 하나는 꼭 붙여야 한다**

`src/game/save.js` 는 이 창 소유가 아니라 못 고쳤다. `packFirstPlay` 의 `food` 칸이 열쇠를
하나하나 적는 모양이라, `fp.food` 에 칸을 늘려도 **저장하면 사라진다.** 직접 확인했다:

```
surplusWon = 6000 · totalSurplusSoldWon = 4200  →  serialize → deserialize  →  0 · 0
```

⇒ **안 넘긴 잉여를 안고 저장하면 그만큼 잃는다.** (판 돈은 지갑에 들어간 뒤라 안 잃는다.)

## 붙일 것 — `save.js` 의 `food:` 블록 마지막에 세 줄

```js
      lastSpoiledWon: needNum(f.lastSpoiledWon ?? 0, 'firstPlay.food.lastSpoiledWon', { min: 0 }),
      /* ★ 잉여 판매 (2026-08-06 · first_play §잉여 판매). 옛 세이브에는 없다 → 0 으로 연다 */
      surplusWon: needNum(f.surplusWon ?? 0, 'firstPlay.food.surplusWon', { min: 0 }),
      lastSurplusWon: needNum(f.lastSurplusWon ?? 0, 'firstPlay.food.lastSurplusWon', { min: 0 }),
      totalSurplusSoldWon: needNum(f.totalSurplusSoldWon ?? 0,
                                   'firstPlay.food.totalSurplusSoldWon', { min: 0 })
```

복원 쪽은 이미 `Object.assign(fp.food, saved.food)` 라 **고칠 것이 없다.**
옛 세이브는 칸이 없어 새 상태의 0 이 그대로 남는다 — 잃을 진행이 없다.

---

# 5. 검사 — `tools/test_cropsale.mjs` (10벌)

| | 무엇을 못 박나 |
|---|---|
| A | 판매가가 **계약값 한 곳**에만 있다 · `_meta` 가 이긴다 · 음수는 던진다 |
| B | 손익분기 콩 **23.3%** · 무순 **30.0%** · 씨앗의 지갑값이 700·600원이다 |
| **C** | ★**시루 하나짜리 판에는 팔 것이 없다** — 곳간 3,000원은 손도 못 대고, 밥은 그대로 나온다 |
| D | 잉여 = `overlapLostWon + spoiledWon`, 그 둘뿐 · 잉여 + 곳간 = 온전한 값 |
| **E** | ★**판 뒤에도 곳간이 한 푼도 안 줄고 5일에 걸쳐 6,000원이 다 밥이 된다** · 두 번은 못 판다 |
| F | 판매가 0 / 23 / 25 / 50 / 70 / 100% 에서 받는 값이 따라 움직인다(단조증가) |
| **G** | ★**손익분기 아래에서는 손해다** — 20% −100원 · 23.3% ±0 · 25% +50 · 70% +1,400원.
16.7%(정가로 잘못 셈한 값)에서도 **손해**임을 같이 못 박는다 |
| H | 안 넘기면 쌓인다 · 상태를 보는 함수가 장부를 안 비운다 |
| I | 지갑 · `shop.earnedWon` · `ts.crop.soldWon` · **파산 해제** 가 그루·삽수와 같은 문으로 돈다 |
| J | 곳간이 넘쳐 쉰 몫도 잉여다 (한도까지 찬 곳간에 한 회전을 더 넣어 잰다) |

★ G 는 숫자를 안 지어낸다 — 시루 3개 판과 4개 판의 **차이**로 「잉여만 내는 시루」를 만들고,
씨앗값은 `shop.buyPriceOf` 에서 읽는다.

## 기존 검사

**시작 전 28벌 전부 통과**(이 워크트리 기준. `test_balance_routes` 도 통과했다 —
지시에 적힌 「FAIL 2건」은 `main` 쪽 이야기로 보인다).
**고친 뒤에도 28벌 전부 통과** + 새 검사 1벌 = **29벌.**

⚠ `test_roomview_walk` 가 한 번 `43/44` 로 떨어졌다가 **다시 돌리니 통과**했다.
브라우저 검사의 알려진 흔들림이고 이 작업 것이 아니다 — 바로 앞 커밋
`efa4ca2 인계 문서 — walk 검사 흔들림이 이 작업 것이 아님을 재서 적는다` 가 같은 것을 적어 뒀다.
이 작업은 `room_view.js` 를 안 건드렸다.

---

# 6. 고친 파일

| 파일 | 무엇을 |
|---|---|
| `src/game/first_play.js` | `cropSurplusSaleRate` 계약값 · `fp.food` 새 칸 셋 · 수확이 잉여를 적는 두 줄 · §잉여 판매 절과 함수 셋 |
| `src/game/state.js` | `sellCropSurplus(S)` · `cropSurplusStatus(S)` |
| `src/game/shop.js` | `creditCropSurplus(S, won)` · `cropBreakEvenRate(kindId)` · first_play 표를 읽는 import 한 줄 |
| `tools/test_cropsale.mjs` | 신규 · 10벌 |
| `docs/handoff/cropsale-to-plan.md` | 이 문서 |

**안 건드린 것**: `game.html` · `loop.js` · `tutorial.js` · `propagation.js` · `room_view.js` ·
`stamina.js` · `save.js` · `data/**` · `assets/**` · `plant_grow.html` · 전역 생장 곡선.

⚠ `shop.js` 가 `first_play.js` 를 import 하게 됐다. 순환이 아니다 —
`first_play.js` 는 `place.js` 하나만 import 하고 shop 을 안 부른다.

---

# 7. 못 한 것 · 이 창이 못 정하는 것

1. ★**판매가(정가의 몇 %)** — 박사님 몫이다. 자리와 눈금만 만들었다(§2).
2. ★**세이브 세 줄** — `save.js` 소유자 몫이다(§4). **이것만은 꼭 붙어야 한다.**
3. `loop.harvestCrop` 의 *"쉬었습니다"* 로그 문구 — 이제 넘길 수 있다는 것을 같이 말하는 편이 낫다.
   `loop.js` 소유자 몫이다(§1-3).
4. `crop_surplus_sold` 에 붙일 **대사** — `dialogue.js` 소유가 아니라 못 만들었다.
5. **[잉여 넘기기] 버튼의 화면 자리** — `game.html` 은 코디네이터 것이다(§3 에 시그니처를 적었다).
6. **자동으로 넘길지** — 지금은 손으로 눌러야 한다. 빨리감기에서도 잉여가 안 사라지게 쌓이도록
   해 뒀지만(§1-4), 「빨리감기가 알아서 넘긴다」로 할지는 `loop.js` 소유자와 정할 일이다.
7. **하네스로 파산일을 다시 재지 않았다.** econgap 의 장부와 정의가 글자 그대로 같으므로(§1-2)
   표가 그대로 재현될 것으로 보지만, **직접 굴려 확인한 것은 아니다.**
   ⇒ `tools/probe_economy_gap.mjs` 를 이 창구를 쓰도록 고쳐 다시 재 보면 확인된다(그 파일은 econgap 것이다).
8. **무순** — 창구가 생겨도 체력 아래에서는 콩나물에 진다(econgap §B-4). 이 작업이 안 뒤집는다.
