# 밥상 갈라 고르기 창 → plan — 2026-08-16

> 몫: **F-1 / G-19** — *"콩나물·무순 **식량 적용 시 칸을 갈라 고르도록**"*
> 만진 파일: **`src/game/first_play.js` · `src/game/save.js`** 둘뿐 · 새 파일 둘
> (`tools/test_mealbykind.mjs` · 이 문서). **`game.html` 은 한 글자도 안 만졌다.**

---

## 0. 세 줄

| | 무엇 | 됐나 |
|---|---|---|
| ★ | **창구가 섰다** — `cropMealPlan(fp, { gramsByKind })` · `planMealByKind` · 세이브 칸 · `eatFromPantry` 가 읽는다 | ✅ |
| ★ | **안 고른 판이 한 원도 안 달라졌다** — 고치기 전 값과 견줘서 확인했다(§2) | ✅ |
| ★ | **실제 게임에서 확인했다** — 「콩나물만 300g」을 고르면 곳간에서 **콩나물만** 300g 빠진다(§5.5) | ✅ |
| ⚠ | **화면(손잡이)은 아직 안 붙었다** — 붙일 코드는 §7 에 그대로 적어 두었다. 밥상 창은 마스터 창 몫이다 | ☐ |

---

## 1. 무엇이 문제였나 — 앞 창의 진단을 확인하고 시작했다

`terms-to-plan.md §4` 가 *"못 했다"* 로 남기며 적어 둔 진단이다:

> 고른 값이 지나는 채널이 `mealPlanWon` **수 하나**이고 `eatFromPantry` 가 **총 g 만**
> 받아 어느 작물을 먹을지 스스로 고른다 — 총 g 으로는 그 뜻이 전달되지 않는다.

**맞는 진단이었다. 재서 확인했다.** 콩나물 400g + 무순 300g 판에서, 총 g 만으로는 이렇게 된다:

| 총 g 을 이렇게 주면 | 몫 규칙이 고르는 것 |
|---|---|
| 500g | 콩나물 300g + 무순 200g |
| 300g | **먼저 거둔 쪽**(FIFO) — 무순을 먼저 거둔 판이면 **무순** |
| 200g | **무순 200g** (2,500원 > 콩나물 200g 의 1,667원) |

즉 「콩나물만 300g」을 사람이 고르려 해도 **총 g 으로는 그 말이 전달되지 않는다.**
`test_mealbykind §B` 가 이 전제를 먼저 못 박고, 그 다음 줄에서 창구가 그것을 넘어서는지를 잰다.

---

## 2. ★★★ 안 고른 판이 예전과 한 원도 안 다른가 — **재서 확인했다**

**「안 바꿨다」를 눈으로 말하지 않았다.** 고치기 전 파일로 표를 한 벌 뽑아 JSON 으로 받아 두고,
고친 뒤 같은 표를 다시 뽑아 `diff` 했다.

| 잰 것 | 값 |
|---|---|
| 잰 판 | 13벌(빈 곳간 · 콩만 · 무순만 · 둘 다 · 반 몫 · FIFO 뒤집힌 판 · 작물 모르는 옛 꾸러미 · 큰 판) |
| 판마다 잰 것 | `cropMealPlan` · `cropMealPlan({grams})` **11 눈금** · `mealPlanQuote` · `mealPlanQuote(g)` 5 눈금 · `eatFromPantry`(안 고른 판 · 총 g 고른 판 4벌) · 곳간에 남은 꾸러미 목록 |
| 전체 줄 수 | 4,331줄 |
| **지워지거나 바뀐 줄** | **0줄** |
| 늘어난 줄 | 2,874줄 — 전부 **새로 실린 칸**(`byKind` · `pickedByKind` · `maxGrams` …) |

⇒ **옛 부름은 값이 한 톨도 안 움직인다.** 늘어난 것만 있다.
그 값들을 §A 에 **손으로 박아** 검사에 넣었다 — 읽어 오면 고치는 쪽과 재는 쪽이 같은 함수를
보게 되어 재는 것이 없어진다(START-HERE §2.9 ⑧ 의 결).

---

## 3. 만든 것 — **창구 넷**

### ① `cropMealPlan(fp, { gramsByKind })`

```js
cropMealPlan(fp, { gramsByKind: { beansprout: 300, musun: 0 } })
```

**몫 규칙은 한 톨도 안 바꿨다.** 한 몫 g(콩나물 300 · 무순 200) · 같은 작물 둘째 몫 1,200원 ·
파는 값보다 못한 몫은 안 먹음(§몫 ④) · 값 큰 쪽 우선 · 동점은 FIFO — 전부 그대로다.
이 칸이 하는 일은 **후보를 고를 때 그 작물이 쓸 수 있는 g 을 깎는 것 하나**다(코드로 세 줄).

**계약 넷 (내가 정한 것 · 코드 주석 §갈라 고르기 에 같은 말이 적혀 있다)**

| 물음 | 정한 것 | 왜 |
|---|---|---|
| **안 적힌 작물은?** | **0 이다** | `{beansprout:300}` 이 무순 200g 까지 먹으면 고친 이유가 없어진다. 그래서 화면·세이브는 **작물을 다 적어 보낸다** |
| **`opt.grams` 와 같이 오면?** | **둘 다 지킨다.** 먼저 걸리는 쪽이 이긴다 | 둘 다 「덜 먹는 쪽」으로만 움직이는 자라, 같이 걸어도 더 먹는 판이 안 생긴다 |
| **곳간에 없는 작물을 고르면?** | **0g 이 나가고 `reason:'pantry'`** | 정상적인 판이다. 던지면 「무순을 아직 안 산 판」에서 화면이 못 뜬다 |
| **모르는 작물 이름이면?** | **던진다** | `cropKindIndexOf` 와 같은 결. 조용히 콩나물로 굴리면 그 판 밥상이 통째로 거짓이 된다 |

### ② `planMealByKind(fp, byKind)` — 저장 창구

`planMealGrams` 와 같은 결이다. **먹지 않는다.** `null` 을 주면 골랐던 것을 지운다.
세이브 칸은 `fp.food.mealPlanByKind`(`{작물id: g}` · null = 안 갈랐다).

⚠⚠ **두 고르개는 서로를 지운다.** `planMealByKind` 는 `mealPlanWon` 을 비우고,
`planMealGrams` 는 `mealPlanByKind` 를 비운다. 같이 차 있으면, 고른 뒤에 **그날 수확이
같은 턴에 곳간에 들어오는** 판에서 옛 총 g 이 새 선택을 조용히 깎는다.

### ③ `eatFromPantry` 가 그 칸을 읽는다
**한 번 쓰고 지우는** 규율 그대로다 — 두 칸을 다 비운다. 반환값에 `byKind` 가 실린다.

### ④ `mealPlanQuote` / `mealPlanStatus` 가 화면이 그릴 것을 낸다

★★ **둘째 인자에 표를 넣으면 「갈라 고르기」다.** 이렇게 만든 까닭은 하나다 —
`state.js §mealPlanStatus`·`§planMeal` 이 인자를 **하나만** 넘겨 주는데 그 파일은
이번 몫의 쓰기 영역이 아니다. 셋째 인자로 창구를 내면 **화면이 닿을 길이 없다.**
겸하게 하면 옛 부름은 한 글자도 안 바뀐다(그 자리는 늘 수였고 표였던 적이 없다).

```js
mealPlanStatus(S, { beansprout: 300, musun: 0 })   // 미리보기 (안 적는다)
planMeal(S,       { beansprout: 300, musun: 0 })   // 적는다
```

`byKind[]` 한 줄에 화면이 필요한 것이 다 있다 — **화면이 셈을 다시 하지 않는다**(§2.8):

| 칸 | 무엇 |
|---|---|
| `kind` · `kindKo` | `beansprout` · `콩나물` |
| `wantGrams` | 지금 고른 g (안 골랐으면 `null`) |
| `maxGrams` | ★ **그 작물만 골랐을 때 몫 규칙이 허락하는 위끝** — 콩나물 300 · 무순 200 |
| `pantryGrams` | 곳간에 있는 g |
| `grams` · `savedWon` · `usedWon` | 실제로 상에 오르는 g · 아낀 밥값 · 곳간에서 빠질 물건 값 |
| `portions[]` | 그 g 으로 짜이는 몫(`kindKo`·`grams`·`won`·`fill`·`second`·`same`) |
| `shortGrams` · `reason` · `reasonKo` | 못 채운 g 과 **그 까닭**(말까지) |

`reason` 은 여섯이다 — `ok` · `notPicked` · `pantry` · `portions` · `sell` · `cap` · `budget`.
말은 `mealShortReasonKo(reason)` 하나가 낸다.

★ **고르개는 위끝을 못 넘는다.** `mealPlanQuote` 가 고른 표를 `maxGrams` 까지 깎아
정규화하므로, 화면이 9999 를 보내도 `{beansprout:300, musun:200}` 이 된다.

---

## 4. 실측 — **콩나물 400g + 무순 300g** 판 (game 규칙 그대로)

| 고른 것 | 나가는 몫 | 총 | 콩나물 줄 | 무순 줄 |
|---|---|---|---|---|
| (안 고름) | 콩 300g/2,500 + 무순 200g/2,500 | 500g · 5,000원 | want `null` got 300 `ok` | want `null` got 200 `ok` |
| `{콩:300}` | 콩 300g/2,500 | 300g · 2,500원 | want 300 got 300 `ok` | want 0 got 0 `notPicked` |
| `{무순:200}` | 무순 200g/2,500 | 200g · 2,500원 | want 0 got 0 `notPicked` | want 200 got 200 `ok` |
| `{콩:200, 무순:100}` | 콩 200g/1,667 + 무순 100g/1,250 | 300g · 2,917원 | want 200 got 200 `ok` | want 100 got 100 `ok` |
| `{콩:0, 무순:0}` | — | 0g · 0원 | `notPicked` | `notPicked` |
| `{콩:300}` + 총 200g | 콩 200g/1,667 | 200g | want 300 got 200 short 100 **`budget`** | `notPicked` |

**못 채우는 까닭 넷을 갈라 말한다** (곳간이 넉넉한 판에서 잰 것):

| 판 | 고른 것 | 나간 것 | 까닭 |
|---|---|---|---|
| 콩 700g | `{콩:600}` | 300g | **`sell`** — 「그 몫은 파는 값보다 못해서 상에 안 올립니다」 |
| 콩 700 + 무순 600 | `{콩:600, 무순:400}` | 콩 300 + 무순 200 | 콩 `sell` · 무순 **`portions`**(몫 자리를 다 썼다) |
| 콩 400g 만 | `{무순:200}` | 0g | **`pantry`** — 「보유 채소에 그만큼이 없습니다」 |

⇒ ★ **옛 화면이 넷을 「곳간이 그만큼 없습니다」 하나로 뭉개서 거짓말하던 그 자리**
(`game.html §mealSay ㉠`)를, 이제 **작물마다** 갈라 말할 근거가 생겼다.

---

## 5. 검사

### `tools/test_mealbykind.mjs` — **11벌 전부 통과** (브라우저 없이 코어만)

| 절 | 무엇을 잰다 |
|---|---|
| **A** | ★ 안 고른 판 12벌이 **고치기 전 값**과 같다(총 g · 밥값 · 물건 값 · **몫 순서**까지) + 총 g 만 고르던 옛 길(그 200g 이 무순을 고르던 것까지) |
| **B** | 한 작물만 고르면 그 작물만 나간다 — **총 g 으로는 못 하던 것**이 된다 |
| **C** | 갈라 고르면 그 비율대로(밥값 비례도 그대로) · 못 채운 까닭 넷이 반환값에 있다 |
| **D** | 곳간에 없는 작물은 0g · 모르는 이름은 던지고 **칸을 안 적는다**(반쯤 적힌 칸이 안 남는다) |
| **E** | ★★ 곳간에서 **실제로 빠진 g** 이 고른 g 과 같다(작물마다 · 총합 · 물건 값) · 한 번 쓰고 지운다 · 어제 고른 것이 오늘까지 안 이어진다 |
| **F** | ★ 칸이 **아예 없는** 옛 세이브가 예전 그대로 돈다(안 고른 판 · 총 g 만 고른 판) |
| **G** | 새 칸이 저장을 넘는다 · **null 과 「전부 0」이 갈린다** · 고르개 둘이 서로를 지운다 · 모르는 작물이 든 세이브는 읽을 때 던진다 |
| **H** | 화면이 그릴 줄이 한 자리에 다 나온다 · `mealPlanStatus`/`planMeal` 로 **닿는다** · 위끝을 못 넘는다 |

### 시킨 검사 넷 — **전부 통과**

| 검사 | 결과 |
|---|---|
| `node tools/test_cropsale.mjs` | ✅ 통과 |
| `node tools/test_quest.mjs` | ✅ 통과 |
| `node tools/test_stamina.mjs` | ✅ 통과 |
| `BYEOT_URL=http://localhost:8963 node tools/test_questui.mjs` | ✅ **57/57** · game.html 예외 0건 |

### ⚠ 덤으로 돌린 것 — 빨간 여덟은 **내가 깬 것이 아니다. 재서 갈랐다**

`first_play.js`·`save.js` 를 쓰면서 브라우저를 안 쓰는 검사 **33개**를 다 돌렸다.
25개 통과 · **8개 빨강**. 짐작으로 적지 않고, **내 두 파일만 HEAD 판으로 되돌려** 같은 검사를
돌려 견줬다(워크트리의 다른 창 파일은 안 건드렸다 — 되돌린 뒤 바로 복구했다).

| 검사 | 지금 | **HEAD(내 것 빼고)** | 어긋난 줄이 같나 |
|---|---|---|---|
| `test_pantrysale` | 빨강 (`189행 7000 !== 0`) | **빨강 (같은 줄·같은 수)** | ✔ 같다 |
| `test_crop_seat` | 빨강 (`E`) | **빨강 (`E`)** | ✔ 같다 |
| `test_dialogue_coverage` | 빨강 (`[배치] 모르는 화분: null`) | **빨강 (같음)** | ✔ 같다 |
| `test_first_play_attacks` | 빨강 | **빨강 (출력 26줄 그대로)** | ✔ 같다 |
| `test_banjiha_routes` | 빨강 4줄 | **빨강 4줄** | ✔ 같다 |
| `test_free_place` | 빨강 2줄 | **빨강 2줄** | ✔ 같다 |
| `test_pots` | 빨강 (`E-6 → 0.05 / 0.075`) | **빨강 (같음)** | ✔ 같다 |
| `test_propagation` | 빨강 (`I`) | **빨강 (`I`)** | ✔ 같다 |
| `test_sellpopup` (브라우저) | 54개 중 **21 어긋남** | **54개 중 21 어긋남 · 줄까지 동일** | ✔ 같다 |

⇒ **아홉 다 내 것이 아니다.** ⚠ 다만 **고쳐야 할 것이 아홉 남아 있다**는 사실은 그대로다.
  (`terms-to-plan §5` 가 *"`test_sellpopup` 7 어긋남"* 이라 적었는데 지금은 **21**이다 —
   그 사이 08-17·08-18 에 몫 규칙이 통째로 바뀌었다. **그 검사가 낡은 것**으로 보인다.)

---

## 5.5 ★★★ **화면에서 재 봤다** — 코드가 아니라 게임을 굴려서

계율이 *"「고쳤다」를 화면 확인 없이 쓰지 않는다"* 라, 코어 검사에서 멈추지 않고
**실제 게임(`localhost:8963/game.html` · 390×844)** 을 굴려 잰다. 시루를 하나 놓고,
밥상 창을 열고, 그 안에서 세이브 칸을 심고, **[이대로 다음 날 ▸]** 을 눌렀다.

| 고른 것 | 날 | 곳간 | 남은 판 | 아낀 밥값 |
|---|---|---|---|---|
| **안 고름**(칸 없음) | 0→1 | 7,000 → 2,000 (**5,000원** 빠짐) | 콩 100g · 무순 100g | 5,000원 |
| **콩나물만 300g** | 1→2 | 7,000 → 4,000 (**3,000원**) | 콩 **100g** · 무순 **300g 그대로** | 2,500원 |
| **무순만 200g** | 2→3 | 7,000 → 5,000 (**2,000원**) | 콩 **400g 그대로** · 무순 **100g** | 2,500원 |
| **둘 다 0g** | 3→4 | 7,000 → 7,000 (**0원**) | 콩 400g · 무순 300g | 0원 |

**콘솔 예외 0건.** 그리고 넷 다 먹은 뒤 칸이 `null` 로 지워져 있었다(한 번 쓰고 지운다).
⇒ **곳간에서 빠진 작물이 고른 작물과 같다.** 창구가 실제 게임까지 이어져 있다.

### ⚠⚠ 이 판을 재다가 재는 자가 **두 번** 거짓말했다 — 적어 둔다

**① `#next` 는 시루를 놓기 전엔 안 열린다** (START-HERE §2.9 가 경고한 그것).
안 놓고 눌렀더니 **네 판 다 「0원 빠짐」**이 나왔고, 하마터면 *"창구가 화면까지 안 이어졌다"*
고 적을 뻔했다. 날짜 칸을 같이 찍으니 `날 0→0` 이었다 — **하루가 아예 안 갔던 것**이다.
⇒ ★ **돈을 잴 때는 날짜도 같이 찍어라.**

**② ★★ 밥상 창은 「열 때」 고른 값을 적는다** (`game.html:8437-8438`).
창이 열리면서 `planMeal(S, ms.defaultGrams)` 를 부른다. 그래서 **창을 열기 전에** 칸을
심으면 **창이 그것을 지운다**(내 `planMealGrams` 가 `mealPlanByKind` 를 비우는 것이 맞게 돈 것이다).
두 번째 시도에서 네 판 다 5,000원이 나온 원인이 이것이었다.
⇒ ★★ **화면을 붙일 때 이 줄을 반드시 같이 고쳐야 한다.** §7-1 에 적었다.

---

## 6. 판단필요 · 안 한 것

| | 무엇 |
|---|---|
| ☐ | **화면 붙이기** — §7 의 코드를 `game.html` 에 붙이는 일. 밥상 창은 마스터 창 몫이라 안 만졌다 |
| ☐ | ⚠ **밥상 창에 작물 줄이 늘면 세로가 는다.** `test_questui W-360/390/430` 이 *"밥상 창이 화면 안이고 · 안 구르고 · 가로로 안 넘친다"* 를 못 박고 있다. 지금은 57/57 인데 **줄을 더하면 이 셋이 먼저 깨질 자리**다. §7-3 에 「몫 줄과 작물 줄을 겹쳐 놓지 말고 **갈아 끼우는** 안」을 적어 두었다 |
| ☐ | **`test_sellpopup` 21 어긋남**이 낡은 검사인지 진짜 고장인지 — 이번 몫 밖이라 안 봤다 |
| — | 「셋째 작물」은 안 봤다. 창구는 작물 수에 안 묶여 있다(`cropDefsOf` 를 그대로 돈다) |

---

## 7. ★★ **`game.html` 이 붙일 코드** — 그대로 쓰면 된다

⚠ 나는 `game.html` 을 안 만졌다. 아래는 **붙일 것**이다.

### 7-1. 상태 한 칸 · 부르는 자리 둘

```js
/* 지금 있는 `var mealG = null;` 옆에 한 칸 더.
   null = 작물별로 안 갈랐다(예전 그대로 총 g 으로 고른다) */
var mealBy = null;      // { beansprout: 300, musun: 0 } 모양
```

`drawMealPanel()` 첫 줄의 `mealPlanStatus` 부름을 이렇게 바꾼다 —
**표가 있으면 표를, 없으면 예전처럼 수를** 넘긴다(창구가 겸한다):

```js
  let ms = null;
  try {
    ms = mealBy ? mealPlanStatus(S, mealBy)
                : mealPlanStatus(S, mealG == null ? undefined : mealG);
  } catch { }
```

⚠⚠ **그리고 「창을 열 때」 줄을 반드시 같이 고쳐라** (`game.html:8437-8438` · 지금은 이렇다):

```js
      mealG = null;                          // 디폴트로 연다
      try { planMeal(S, ms.defaultGrams); } catch { }
```

이 줄이 `planMeal(S, 수)` 라서 **`mealPlanByKind` 를 지운다.** 화면을 붙인 뒤에도 이대로
두면, 작물별로 고른 값이 **창을 다시 열 때마다 사라진다.** 이렇게 바꾼다:

```js
      mealG = null; mealBy = null;           // 디폴트로 연다 (갈라 고른 것도 함께 비운다)
      try { planMeal(S, ms.defaultGrams); } catch { }
```
★ 「열 때 비운다」가 맞다 — 밥상 창은 **매일 새로 뜨는 창**이고, 어제 고른 것이 오늘 창에
남아 있으면 안 된다. 지우는 것 자체는 옳고, **지운다는 사실을 알고 붙여야 한다**는 뜻이다.
⚠ `closeMealPanel` 의 `planMeal(S, null)` 은 그대로 둬도 된다 — **두 칸을 다 비운다.**

### 7-2. 작물 줄을 그린다 — **셈을 안 한다. `ms.byKind` 를 그대로 적는다**

`$('mealRows').innerHTML = head('오늘 차리는 몫') + …` 바로 **앞에** 이 덩이를 넣는다.

```js
  /* ★★ 작물마다 갈라 고르는 줄 (first_play §갈라 고르기 · byKind).
     ⚠ 값도 문장도 여기서 안 짓는다 — 나눗셈·곱셈이 한 개도 없다. */
  const kindRows = (ms.byKind || []).filter(b => b.maxGrams > 0 || b.pantryGrams > 0);
  $('mealKinds').innerHTML = kindRows.length < 2 ? '' :
      head('작물마다 고르기')
    + kindRows.map(b => `
        <div class="lrow kindrow" data-mealkind="${b.kind}">
          <span>${b.kindKo}
            <i class="dim">보유 ${formatGram(b.pantryGrams)} · 최대 ${formatGram(b.maxGrams)}</i>
          </span>
          <span class="kpick">
            <button class="mini" data-mealkind-minus="${b.kind}"
                    ${b.grams <= 0 ? 'disabled' : ''}>−</button>
            <b>${formatGram(b.grams)}</b>
            <button class="mini" data-mealkind-plus="${b.kind}"
                    ${b.grams >= b.maxGrams ? 'disabled' : ''}>＋</button>
          </span>
        </div>`
      + (b.shortGrams > 0
          ? `<div class="lrow why">${b.kindKo} ${formatGram(b.shortGrams)}은 ${b.reasonKo}</div>`
          : '')).join('');
```

붙일 자리(HTML) — `#mealRows` 바로 위에 빈 칸 하나:
```html
<div id="mealKinds" class="lrows"></div>
```

⚠ **`b.reasonKo` 를 그대로 적는다.** 「곳간이 그만큼 없습니다」를 화면이 다시 지으면
§4 의 그 거짓말이 되살아난다.

### 7-3. 손잡이 — 누르면 `planMeal(S, 표)` 하나만 부른다

```js
/* 지금 값을 표로 뜬다 — 없으면 「지금 나가는 g」이 곧 처음 자리다(고른 적 없음 = 최선껏) */
function mealByNow(ms) {
  const o = {};
  for (const b of (ms.byKind || [])) o[b.kind] = b.wantGrams == null ? b.grams : b.wantGrams;
  return o;
}
function setMealKind(kind, g) {
  let ms = null;
  try { ms = mealBy ? mealPlanStatus(S, mealBy)
                    : mealPlanStatus(S, mealG == null ? undefined : mealG); } catch { return; }
  const next = mealByNow(ms);
  next[kind] = Math.max(0, Math.round(g));       // 위끝은 창구가 알아서 깎는다
  try { const q = planMeal(S, next); mealBy = q.pickedByKind; mealG = null; } catch { }
  drawMealPanel();
}
/* 위임 — 줄이 다시 그려지므로 낱개 onclick 을 달면 안 된다 */
$('mealKinds').onclick = guard((ev) => {
  const t = ev.target.closest('[data-mealkind-plus],[data-mealkind-minus]');
  if (!t) return;
  let ms = null; try { ms = mealBy ? mealPlanStatus(S, mealBy) : mealPlanStatus(S); } catch { return; }
  const plus = t.getAttribute('data-mealkind-plus');
  const kind = plus || t.getAttribute('data-mealkind-minus');
  const now = (ms.byKind.find(b => b.kind === kind) || {}).grams || 0;
  setMealKind(kind, now + (plus ? MEAL_STEP_G : -MEAL_STEP_G));
});
```

**[최대]·[0g] 도 표로 보내야 앞뒤가 맞는다** (지금 `setMealG` 는 총 g 만 적는다):

```js
$('mealAll').onclick  = guard(() => { mealBy = null; mealG = null;
                                      try { planMeal(S, null); } catch { } drawMealPanel(); });
$('mealNone').onclick = guard(() => {
  let ms = null; try { ms = mealPlanStatus(S); } catch { return; }
  const zero = {}; for (const b of ms.byKind) zero[b.kind] = 0;
  try { const q = planMeal(S, zero); mealBy = q.pickedByKind; mealG = null; } catch { }
  drawMealPanel();
});
```
⚠ 지금의 `mealMinus`/`mealPlus`(총 g)는 **그대로 둬도 된다** — 다만 그 둘을 누르면
`planMeal(S, 수)` 가 `mealPlanByKind` 를 지우므로, 눌린 뒤에 `mealBy = null` 로 같이 비워라.
안 비우면 화면의 `mealBy` 만 남아 **화면과 세이브가 다른 말을 한다.**

### 7-4. ⚠ 세로가 는다 — `test_questui W-360` 이 먼저 깨진다

작물 줄이 둘이면 **두 줄 + 까닭 줄**이 는다. 지금 57/57 이지만 360px 은 여유가 없다.
⇒ 권하는 것: **「오늘 차리는 몫」 줄과 「작물마다 고르기」 줄을 겹쳐 놓지 말고 갈아 끼워라.**
   작물이 하나뿐이면 `kindRows.length < 2` 에서 이미 안 그린다(위 코드가 그렇게 돼 있다).
   둘 이상이면 몫 줄이 작물 줄과 같은 말을 하므로, 몫 줄을 접고 작물 줄만 보이는 편이 낫다.
⚠ 붙인 뒤 **반드시** `BYEOT_URL=http://localhost:8963 node tools/test_questui.mjs` 를 돌려라.

### 7-5. ⚠ 잊지 말 것
- `mealBy` 는 **하루가 가면 비워야 한다** — 코어는 이미 비운다(`eatFromPantry` 가 칸을 지운다).
  화면 쪽 `mealG` 를 비우는 그 자리에서 `mealBy` 도 같이 `null` 로 둬라. 안 그러면
  **어제 고른 것이 오늘 창에 떠 있고 세이브에는 없는** 판이 난다.
- 작물이 없는(아직 안 산) 판에서도 안 깨진다 — `maxGrams` 도 `pantryGrams` 도 0 이라 안 그려진다.

---

## 8. 만진 것

| 파일 | 무엇 |
|---|---|
| `src/game/first_play.js` | §갈라 고르기 머리말 · `normalizeGramsByKind` · `mealShortReasonKo` · `cropMealPlan` 의 `gramsByKind`·`byKind` · `mealPlanQuote` 의 표 겸용·`byKind`·`pickedByKind` · `planMealByKind` 신설 · `planMealGrams` 가 표를 받으면 넘김 · `eatFromPantry` 가 새 칸을 읽고 지움 · `food.mealPlanByKind` 칸 |
| `src/game/save.js` | `firstPlay.food.mealPlanByKind` 등록(null 과 「전부 0」을 가름 · 모르는 작물이면 던짐) |
| `tools/test_mealbykind.mjs` | 신설 · 11벌 |
| `docs/handoff/mealbykind-to-plan.md` | 이 문서 |
