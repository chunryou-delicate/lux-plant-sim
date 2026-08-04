# 수확을 행위로 · 씨앗값 1,500 → 1,000원 (core → plan, 2026-08-04)

박사님 지시(원문):

> "씨앗을 줄여. 그리고 **수확하기를 해야 반영되도록** 하자.
>  자동수확은 나중에 뭐 아이템이나 아니면 특수보상이나 **업적 달성 보상**으로 주도록 하고."

물주기(커밋 39278d3)와 **같은 사상**이다. 자리(빛)=품질 · 물=속도 · 수확=행위.
벌은 시간 하나뿐이고, 초보는 죽지 않는다.

---

## ① 씨앗값 — 1,500 → 1,000원. 순액이 하루 100원 → 220원이 됐다

### ★ 먼저: 씨앗값의 정본이 **둘**이었다

지시는 `first_play.js` 의 `seedWonPerSiru` 를 가리켰는데, **그 값은 지갑에 안 닿는다.**

```
first_play.FIRST_PLAY_RULES.seedWonPerSiru   정가. resowBeansprout 가 seedCostWon 으로 낼 뿐이고
                                             아무도 그 값으로 돈을 빼지 않는다 (화면 문구에만 쓰인다)
shop.CATALOG.bean_seed.listWon               ★ 지갑에서 실제로 나가는 값.
                                             재파종은 미리 주문해 둔 재고를 쓰고, 돈은
                                             orderItem 이 이 값 × BUY_MARKUP(1.4) 으로 뺀다
```

그래서 `seedWonPerSiru` 만 내렸으면 **순액이 한 푼도 안 바뀌었다.**
둘 다 1,000원으로 내렸다. 사는 값은 1,400원(정가 × 1.4)이다.

* `src/game/first_play.js` — `seedWonPerSiru: 1_500 → 1_000`
* `src/game/shop.js` — `CATALOG.bean_seed.listWon: 1_500 → 1_000`
  (`monstera_seed` 는 1,500 그대로. 예전 근거였던 "콩 1시루와 같은 값"이 끊겼으므로
  그 문구를 지우고 `sale_economy.md §3` 이 직접 적은 값으로 세웠다)

⚠ `data/balance/` 는 안 건드렸다. 두 값 다 코드에 근거 주석과 함께 있다.
plan 에 `seedWonPerSiru` 를 `characters.json._meta` 로 옮겨 달라는 요청은 그대로 유효하고,
**옮길 때 상점 값도 같이 옮겨야 한다**(둘이 갈리면 화면과 지갑이 다른 말을 한다).

### 근거

1. 실제 나물콩 1시루분 시세가 **700~1,200원**이다. 1,000원이 그 한가운데고,
   1,500원은 시세 위끝을 넘는 값이었다.
2. 1,500원이면 씨앗값이 절감의 70%를 먹어 순액이 하루 100원 — **지출 20,000원의 0.5%**였다.
   콩나물을 돌릴 이유가 산수로 거의 안 남는다.

### 재서 낸 순액 (30일 · 시루 1개 · 어두운 자리 · 매일 물 · 되는 날 바로 거둠)

| | 절감/30일 | 하루평균 절감 | 씨앗값/30일 | **순액 하루** | 지출 대비 |
|---|---|---|---|---|---|
| 전 (씨앗 1,500 · 사는 값 2,100) | 15,600원 | 520원 | 12,600원 | **100원** | 0.5% |
| 후 (씨앗 1,000 · 사는 값 1,400) | 15,000원 | 500원 |  8,400원 | **220원** | 1.1% |

세 경로 재현(`test_banjiha_routes` D-2)에서 잰 값은 **하루 249원**(지출의 1.2%)이다.
확률 굴림·배송 대기가 섞인 실제 판이라 자보다 조금 높다.
본전을 뽑는 날도 **튜토 27일 → 13일**로 당겨졌다.

⚠ 절감 자체가 15,600 → 15,000원으로 600원 줄었다. 씨앗값과 무관하고, 수확이 행위가 된
결과다 — **거둔 그 날에는 곳간을 안 연다**(아래 ②의 ⑤).

---

## ② 수확 규칙

### 안 거두면 — **따로 벌을 주지 않는다**

자라는 날이 차면 `ready` 가 되고, 하루가 지나도 아무 일도 안 난다.
`ageDays` 도 안 오르고 마른 날도 안 쌓이고 품질도 안 떨어진다.
**안 거두면 다음 회전이 시작되지 않고, 그동안 곳간이 비어 절감이 0이다 — 그것이 벌이다.**

늦게 거둘수록 품질을 떨어뜨리자는 안은 **채택하지 않았다.** 근거:
품질은 `dliHist` 로 이미 확정돼 있고(자리 = 빛), 거두는 시각이 그 값을 바꾸게 만들면
**시각이 빛 축을 건드리는 세 번째 축**이 생긴다. 물이 품질을 못 건드리게 한 것과 같은 이유다.
(바꾸고 싶어지면 그때 먼저 재고 근거를 대기로 했다 — 기본은 안 떨어뜨린다.)

재서 확인했다 (`probe_crop_cycle` ④ · 30일 · 시루 1개 · 어두운 자리):

| 거두기까지 미룬 날 | 절감/30일 | 하루평균 | 수확 횟수 | 회전당 절감 |
|---|---|---|---|---|
| 그날 바로 | 15,000원 | 500원 | 6번 | 3,000원 |
| 1일 | 12,000원 | 400원 | 5번 | 3,000원 |
| 2일 | 10,200원 | 340원 | 4번 | 3,000원 |
| 3일 |  9,000원 | 300원 | 3번 | 3,000원 |
| 5일 |  6,000원 | 200원 | 3번 | 3,000원 |

**회전당 절감은 한 푼도 안 깎였다.** 잃는 것은 회전 수뿐이다.

### 물은 계속 줘야 하나 — **안 준다**

`beansproutWaterStatus.needsWater` 가 다 자란 시루에서 false 가 된다.
`advanceBeansproutDay` 는 **물 검사보다 먼저** 다 자람에서 서므로 마른 날도 안 쌓인다.

근거 셋:

1. 물은 **속도 축**인데 속도가 쓸 곳이 없다 — `ageDays` 가 이미 만수라 더 올릴 데가 없다.
   아무것도 안 바꾸는 입력을 매일 요구하면 규칙이 아니라 잡음이다.
2. 효과를 만들려면 "안 주면 나빠진다"라야 하는데 그게 곧 **둘째 벌**이라 위 원칙과 부딪힌다.
3. 손이 두 배가 된다. 다 자란 날에 [물 주기]와 [수확하기]가 같이 뜨면 폰에서 버튼이 겹친다.
   "할 일이 있을 때만 뜬다"가 지켜지려면 둘이 서로를 배제해야 한다.

현실에서는 거두기 전까지 준다. 그 차이는 알고 버렸다 — 게임에서 그 하루하루가 내는 것이
아무것도 없기 때문이다.

### 빨리감기 — **두 모드가 다 선다** (물과 달리 답이 안 갈린다)

| 모드 | 물 (2026-08-04 앞선 결정) | **수확** |
|---|---|---|
| jump (첫 플레이) | 마른 날에 **선다** | 거둘 때가 되면 **선다** |
| fast (튜토 이후) | 물을 **같이 준다**(자동) | 거둘 때가 되면 **선다** |

**점핑이 서는 이유** — 박사님 확정("첫 수확은 이 구간이 가르치는 것이다")에 더해,
안 서면 더 나쁘다: 수확이 손 동작이 된 뒤로 **거두기 전에는 다음 이벤트가 영영 안 온다.**
안 서면 60일 한도까지 헛돌고 화면은 이유를 말할 창구가 없다.

**배속도 서는 이유** — 물과 같은 논리가 서는지 재 봤고, **한 곳에서 안 선다:**

* 물을 세우면 배속이 죽는다. 마른 날은 **매일** 오므로 30일 배속이 1일이 된다(−97%).
* 수확을 세우면 안 죽는다. 거둘 날은 회전당 한 번이고, **배속은 재파종을 대신 안 하므로**
  한 번 거두면 다음 회전이 시작되지 않는다 ⇒ 한 번 감는 동안 **최대 한 번** 선다.

"결과가 손과 같은가"는 수확도 참이다(품질은 이미 확정됐고 거두는 시각이 그걸 못 바꾼다).
그러나 **정지 비용이 물과 두 자릿수 다르다.** 물이 자동인 이유는 그 비용이었지,
논리가 성립한다는 것만으로 자동이 되지는 않는다.
더해서 — 배속에서 지금 자동으로 거두면 **박사님이 나중 보상으로 확정한 것이 미리 새어 나간다.**
배속은 튜토 이후 전 구간이다.

★ 정지는 **전환**에서만 난다(`beansprout_ready` 사건 · `turn.cropJustReady`).
"지금 거둘 수 있다"로 세우면 안 거둔 채로 다시 감을 때마다 첫날에 또 서서 못 돈다.

---

## ③ 자동수확 자리를 어떻게 뒀나

```js
S.perks = { autoHarvest: false }        // state.js §perks. 지금은 늘 꺼져 있다
loop.hasAutoHarvest(S)                  // ★ 읽는 곳은 여기 한 곳뿐
```

* 켜지면 이렇게 돈다(주석으로 남겼다):
  ① 빨리감기의 `stopOnReady` 기본값이 false 가 된다
  ② 대신 tick 이 `autoWater` 와 같은 자리에서 `harvestCrop(S, io)` 를 부른다 —
     [수확하기] 버튼과 **같은 함수**라 첫 수확 선물까지 그대로 처리된다
* ⚠ 재파종은 **자동이 아니다.** 씨앗값·자리 고르기는 선택이라 대신 해 주면 안 된다.
* **세이브 규약도 같이 넓혔다** — `save.js` 의 `KNOWN_STATE_KEYS` 에 `perks` 를 넣고
  pack/unpack 을 붙였다. 옛 세이브는 꺼진 채로 열린다(지어내지 않는다).
  `test_save` A-2 가 이 왕복을 지킨다.
* 여러 곳에서 읽기 시작하면 나중에 켤 때 반씩 켜진다 — 그래서 접근자를 하나만 뒀다.

---

## ④ 절감 전/후 표 (`tools/probe_crop_cycle.mjs`)

30일 · 어두운 자리(DLI 0.05) · 매일 물 · 되는 날 바로 거둠

| | 시루 1개 | 시루 2개 | 시루 3개 | 시루 6개 |
|---|---|---|---|---|
| **전** 절감/하루평균 | 15,600 / 520원 | 15,600 / 520원 | 15,600 / 520원 | 15,600 / 520원 |
| **전** 순액 하루 | 100원 | −320원 | −740원 | −2,000원 |
| **후** 절감/하루평균 | 15,000 / 500원 | 15,000 / 500원 | 15,000 / 500원 | 15,000 / 500원 |
| **후** 순액 하루 | **220원** | −60원 | −340원 | −1,180원 |

*(순액은 둘 다 상점 사는 값 기준 — 전 2,100원 · 후 1,400원)*

자리(빛) 축은 그대로 산다:

| 자리 | 전 하루평균 | 후 하루평균 |
|---|---|---|
| 어두운 자리 (DLI 0.05) | 520원 | 500원 |
| 살짝 밝은 자리 (0.6) | 353원 | 333원 |
| 밝은 자리 (2.0) | 187원 | 167원 |

물 축도 그대로 산다:

| 물 주기 | 전 하루평균 | 후 하루평균 |
|---|---|---|
| 매일 | 520원 | 500원 |
| 2일에 한 번 | 240원 | 300원 |
| 3일에 한 번 | 160원 | 200원 |

⚠ **왜 매일이 20원 줄었나** — 씨앗값이 아니다. 거둔 그 날에는 곳간을 안 열기 때문이다.
예전에는 수확이 `nextDay` 안에서 나서 같은 턴의 `eatFromPantry` 가 새 곳간을 바로 열었다.
이제 수확은 [다음 날] **뒤**에 나므로 첫 한 입이 다음 날로 밀린다 —
30일에 정확히 한 입(600원)이다.

같은 날 또 열게 만들 수도 있었지만 안 했다. 다 자란 날의 [다음 날] 이 지난 회전의 마지막
600원을 이미 꺼낸 뒤라, 같은 날 또 꺼내면 **하루 1,200원**이 되어 하루 상한이 그 자리에서 깨진다.
먹는 것은 살림이고 살림은 하루에 한 번이다.

⚠ 띄엄띄엄 주는 쪽이 오히려 **올라간 것**도 같은 이유다(240 → 300원).
그쪽은 회전이 길어 30일 안에 수확이 3번뿐이라, 밀린 한 입이 상대적으로 덜 아프다.

---

## ⑤ 세 경로 재현 — 100% 유지

**재현을 먼저 고쳤다.** 수확이 손 동작이 됐으므로 재현도 그 동작을 밟는다 —
`test_banjiha_routes.play()` 가 [다음 날] 뒤 · [다시 심기] 앞에서 `harvestCrop(S, io)` 를 부른다.
자동으로 거두게 뒀으면 **검사가 게임과 다른 것을 재게 된다.**
몬스테라 도착도 이제 `turn.plantArrived` 가 아니라 **수확의 반환값**(`r.arrived`)으로 온다.

시드 40판:

| 경로 | 성공 | 중앙값 | 최선 | 최악 | 계절 | 확정 무늬 중앙값 |
|---|---|---|---|---|---|---|
| A 등 없이 · 바로 삽수 | **40/40 (100%)** | 튜토 57일 | 57일 | 81일 | autumn 40 | 45일 |
| B 등 사고 · 바로 삽수 | **40/40 (100%)** | 튜토 57일 | 57일 | 81일 | autumn 40 | 45일 |
| C 한 박자 늦게 (12일부터) | **40/40 (100%)** | 튜토 57일 | 57일 | 81일 | autumn 40 | 45일 |

* 대조군(확정 무늬 제거) 0/20 — 그 규칙이 여전히 이사를 만든다
* 꾸준수입 없이 0/20 — 삽수 판매가 여전히 전제조건이다
* 확정 무늬 전 파산 0/40 — 잔액 중앙값이 **소폭 올랐다**:
  튜토 29일 715,600 → 721,200원 · 45일(가을) A 258,900 → 266,600원 · 57일 A 105,900 → 115,000원
* 세 경로 다 여름을 넘겨 끝난다 — 가을·식물등·겨울 콘텐츠를 그대로 만난다

**결론이 안 바뀐 이유는 예전과 같다** — 이사 자금은 콩나물이 아니라 무늬 잭팟이 만든다.
콩나물이 바꾸는 것은 "그때까지 얼마나 덜 줄었나"뿐이다.

---

## ⑥ `game.html` 이 부를 API

```js
import { harvestCrop } from './src/game/loop.js';        // ★ 거두는 함수 (io 가 필요하다)
import { cropHarvestStatus } from './src/game/state.js';  // 버튼을 켤지 말지
```

### 버튼 상태 — `cropHarvestStatus(S)` (상태를 안 바꾼다)

```js
{ ready, canHarvest, placed, harvested, ageDays, harvestDays, daysLeft, sirus, cycle, dryDays }
```

`[물 주기]` 와 **같은 규칙**으로 그리면 된다 — 할 일이 있을 때만 뜬다:

```js
const h = cropHarvestStatus(S);
if (!h || !h.placed || h.harvested) hide();
else if (h.ready) show('🥬 콩나물 수확하기');
else hide();                    // 아직 자라는 중 — [물 주기] 쪽이 뜬다
```

⚠ **`cropWaterStatus(S).needsWater` 는 다 자란 시루에서 false 가 된다.**
그래서 두 버튼이 같은 날 같이 뜨는 일은 없다. 그게 설계다(위 ②).
`cropWaterStatus` 에 `ready` 칸도 같이 실어 뒀다.

### 누르면 — `harvestCrop(S, io)`

```js
$('harvestCrop').onclick = guard(() => {
  const r = harvestCrop(S, io);
  banner('콩나물을 거뒀습니다', `${r.qualityKo} · ${r.cycleSavedWon.toLocaleString()}원`);
  dlgOpen(story.events(r.events));     // ★ buyLamp·moveOut 과 같은 창구다
  fillSlots(); draw();                 // ★ 첫 수확이면 몬스테라 화분이 생겼다
});
```

반환:

```js
{ harvested: true, avgDli, quality, qualityKo, meals, sirus, wastedSirus,
  cycleSavedWon, spoiledWon, cycleDays, dryDays, harvestCount,
  arrived,        // 첫 수확이면 방금 생긴 화분(state.givePlant 반환). 아니면 null
  growthPhase,    // 도착 때 검증까지 마친 단계. 아니면 null
  events }        // ★ turn.events 와 같은 모양 — 그대로 dialogue.scriptsForEvents 에 넣는다
```

`events` 가 그날의 사건을 다 낸다(순서는 `dialogue.EVENT_ORDER` 가 정한다):

```
beansprout_harvest → learn_harvest → learn_cropDark → (god1) → monstera_arrived
```

즉 **첫 플레이 세 장면(수확 → 식물신 → 도착)이 전부 이 반환값에서 나온다.**
[다음 날] 의 `turn.events` 에는 이제 안 실린다.

### 던지는 것

| 조건 | `.tutorialInput` | 뜻 |
|---|---|---|
| 시루를 안 놨다 | `true` | 안내 |
| 이미 거뒀다 | `true` | 안내 (두 번 눌러도 안전하게 막힌다) |
| 아직 덜 자랐다 | `true` | 안내 — "아직 N일 더 자라야 합니다" |
| 도착 초기화 실패 | — | `.harvestRolledBack === true` 면 **수확이 통째로 물러났다.** 잠기지 않으니 그대로 다시 누르면 된다 |

### 그 밖에 바뀐 것 (화면이 읽는 칸)

* `turn.cropReady` — 지금 거둘 수 있나
* `turn.cropJustReady` — **오늘 막** 거둘 수 있게 됐나 (빨리감기가 서는 근거)
* `turn.cropHarvest` — `cropHarvestStatus` 와 같은 모양
* `turn.plantArrived` — **이제 늘 false** 다. 도착은 `harvestCrop` 의 반환값으로 온다
* 빨리감기 정지 사유에 `'ready'` 가 늘었다 (`STOP_KO.ready = '거둘 때가 됐습니다'`)
* 사건 `beansprout_ready` 가 늘었다 — **대사는 없다**(`food_cash` 처럼 화면이 버튼으로 말한다)

---

## ⑦ 바꾼 파일 · 테스트

**코어**

```
src/game/first_play.js   씨앗값 1,000 · §수확 신설 · advanceBeansproutDay 가 안 거둔다
                         harvestBeansprout / beansproutReady / beansproutHarvestStatus 신설
                         beansproutWaterStatus 에 ready · needsWater 가 다 자란 시루를 뺀다
                         firstPlaySnapshot·firstPlayEventsOf·firstPlayNextEvent 에 ready
src/game/loop.js         ★ harvestCrop(S, io) 신설 — 선물·배움·사건까지 한 동작
                         nextDay 에서 수확·선물 블록 제거 · turn.cropReady/cropJustReady/cropHarvest
                         learnEventsOf 를 갈라 냈다(턴 안팎이 같이 쓴다)
                         빨리감기 stopOnReady(기본 켜짐) · hasAutoHarvest(S)
src/game/state.js        ★ S.perks = { autoHarvest: false } · cropHarvestStatus(S)
src/game/save.js         perks 를 KNOWN_STATE_KEYS·pack·unpack 에 넣었다
src/game/shop.js         ★ bean_seed 1,500 → 1,000 (지갑이 실제로 쓰는 값) · monstera_seed 근거 정리
src/game/tutorial.js     noteLearning ① 이 cycleSavedWon 도 증거로 받는다
docs/food_economy.md     머리말에 바뀐 값 · §3 표
```

⚠ `data/` · `assets/` · `game.html` · `room_view.js` · `plant_grow.html` 은 **한 글자도 안 바꿨다.**

**자·재현**

```
tools/probe_crop_cycle.mjs      ④ 수확 미루기 신설 · 사는 값으로 씨앗값을 잰다
                                하루 순서를 게임과 맞췄다([다음 날] → [수확하기] → [다시 심기])
tools/probe_crop_cases.mjs      곳간을 매일 연다(거둔 날에 하루치가 통째로 빠지던 것) · 순서 정정
tools/probe_first_play_len.mjs  거둬야 몬스테라가 온다
tools/test_banjiha_routes.mjs   ★ 재현이 [수확하기] 를 누른다 · 도착을 반환값으로 받는다
tools/test_first_play.mjs       저절로 안 거둬진다 · 물을 안 요구한다 · 수확 원자성
tools/test_first_play_attacks.mjs  1·5-c·9·18·19·20-b 를 수확 원자성으로 옮겼다
tools/test_fastforward.mjs      ★수확-a(배속도 선다 · 한 번만) · ★수확-b(보상이 켜지면 안 선다)
tools/test_save.mjs             A-2 보상 칸 왕복
tools/test_dialogue_coverage.mjs  수확 반환값의 events 를 같은 창구로 돌린다
```

**14개 스위트 전부 PASS**
`test_banjiha_routes` `test_first_play` `test_first_play_attacks` `test_tutorial` `test_save`
`test_loop_errors` `test_dialogue_coverage` `test_propagation` `test_free_place` `test_maturation`
`test_cuttable` `test_headroom` `test_fastforward` `test_banjiha_profile`

---

## ⑧ 아직 막힌 곳 · 판단 대기

1. **`game.html` 에 [수확하기] 버튼이 아직 없다.** 박사님이 배선하신다고 하셔서 API 만 냈다.
   그때까지 게임 화면에서는 콩나물이 다 자란 채로 멈춘다(몬스테라도 안 온다).
   ⑥ 의 예시 코드를 그대로 붙이면 된다.

2. **`beansprout_ready` 에 대사가 없다.** `food_cash` 처럼 화면이 숫자·버튼으로 말하는 사건으로
   뒀다. 대사를 붙이고 싶으면 `dialogue.EVENT_SCRIPT` 에 한 줄이면 되는데,
   "거둘 때가 됐다"는 버튼이 뜨는 것으로 이미 크게 말하고 있어 잔소리가 될 수 있다.
   ⚠ `test_dialogue_coverage` 의 "말 없는 날 3일" 검사는 지금도 통과한다.

3. **씨앗값 정본이 아직 코드에 둘이다.** 값은 같게 맞췄지만 자리가 둘이라 다음에 또 갈릴 수 있다.
   `characters.json._meta` 로 옮길 때 **상점 값도 같이** 옮겨 주시면 자리가 하나가 된다.

4. **자동수확의 "켜졌을 때 실제로 거두는 코드"는 안 넣었다.** 지시대로 자리만 뒀다
   (`stopOnReady` 가 뒤집히는 것까지만 동작한다 — `test_fastforward` ★수확-b 가 그것을 지킨다).
   보상 체계가 생길 때 `tick` 에 세 줄이면 붙는다.

5. **2·3종 작물은 여전히 자리만 있다.** 지금 도는 작물이 콩나물 하나뿐이라
   `cropKindSavedWon` 의 2·3번째 값(2,000·1,000원)은 합계에 안 들어간다.
   순액을 더 올리는 정답은 씨앗값이 아니라 **다른 작물**이다.
