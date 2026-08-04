# ③ 원룸 · ④ 내 집 마련 — 정본

**2026-08-05 신설.** `docs/story_arc.md` 가 스토리 네 단계의 정본이고, 이 문서는 그중
**③④ 한 줄기**를 다룬다. ①②는 `first_play.md` · `tutorial.js` 가 이미 갖고 있다.

```
① 반지하(튜토)  →  ② 탈출(원룸 이사)  →  ③ 원룸  →  ④ 삽수를 팔아 내 집 마련
   first_play.js      tutorial.moveOut     ★oneroom.js    ★ending.js
```

> ★ **이 문서는 숫자를 확정하지 않는다.** `story_arc.md` §5 가 미확정으로 남긴 것
> (원룸 슬롯 수·월세·판매가, ④ 목표 금액)은 여기서도 **후보와 근거**로만 적는다.
> 다른 워커가 지금 그 값들을 실측하고 있고, 코드에는 자리(`null`)만 두었다.

---

# 0. 먼저 — 조사 결과

②까지 다 됐다고 보고돼 있었지만, 실제로 무엇이 있고 무엇이 없었는지 먼저 재 봤다.

| | 상태 | 어디 |
|---|---|---|
| ① 반지하 튜토(첫 플레이·배움 넷·계절·월세·식물등) | **있음** | `first_play.js` · `tutorial.js` |
| ② 이사 **판정**(`canMoveOut`) · 이사비 차감(`moveOut`) | **있음** | `tutorial.js` |
| ② 이사로 **방이 바뀌는 것** | **없었다** | — |
| 삽수 자르기·뿌리내리기·자라기·죽음·분갈이 | **있음(완성)** | `propagation.js` 1,196줄 |
| 삽수·그루 값 매기기·등급·상점 주문/배송/재고 | **있음** | `shop.js` |
| 튜토 확정 무늬(잭팟) | **있음** — ②에서 끝난다 | `tutorial.js` §확정 무늬 |
| 시간 모드 잠금(③④는 배속만) | **있음** | `loop.timeModeOf` |
| 원룸 방 기하·조도 실측 | **있음** | `data/house_rooms.json` · `docs/engine/rooms_progression.md` |
| 원룸 살림 값(월세·보증금·이사비) | **있음(잠정)** | `data/balance/homes.json` |
| ③ 원룸 단계 자체 | **없었다** | — |
| ④ 엔딩 판정·목표 금액 | **없었다** | — |
| 초보 모드가 ③④까지 이어지는 것 | **깨져 있었다** | `propagation.isNoviceMode` |
| 씨앗 선발(다개체) | **없다 · 이번 범위 밖** | `propagation.promoteToPot` 이 던진다 |

## ★ 제일 큰 것 — **이사해도 방이 안 바뀌고 있었다**

`tutorial.moveOut(ts)` 이 하는 일은 둘뿐이었다.

```js
ts.cashWon -= ts.rules.moveOutCostWon;
ts.movedOut = true;
```

`S.home.room` 은 그대로 `'banjiha'` 다. 조도도 슬롯도 화면도 전부 반지하이고,
「이사했습니다」라는 문장과 배너만 남는다. `game.html` 에 방을 바꾸는 함수(`buildRoom(id)`)가
있긴 한데 **개발용 방 드롭다운에만** 붙어 있어서 스토리 경로에서는 아무도 부르지 않는다.

즉 **② 탈출은 사건으로만 있었고 이동이 없었다.** ③이 비어 있던 것이 아니라 ③으로 가는
문이 안 열려 있었던 것이다.

## ★ 두 번째 — 초보 모드가 **이사 버튼에서 꺼지고 있었다**

`story_arc.md` §0 은 범위를 못 박았다 — *"①반지하 → ②탈출 → ③원룸 → ④내 집 마련 엔딩
← 여기까지 자취생 고정."* 그런데 코드는 이랬다.

```js
return !!(S.tutorial && S.tutorial.enabled && !S.tutorial.movedOut);   // ← ②에서 꺼진다
```

이사하는 순간 삽수 유예가 16일 → 8일로 줄고, 모주를 끝내는 자르기가 열린다
(`propagation.md` §2·§3-2). **초보는 죽지 않는다는 약속이 ③ 들어가자마자 깨진다.**
(`sim.mode === 'novice'` 로 도는 판은 가려져 있었다. 그래서 아무도 못 봤다.)

---

# 1. 무엇을 만들었나

## `src/game/oneroom.js` — ③ 원룸

| | |
|---|---|
| `moveIntoOneroom(S, io, opt)` | **이사를 이동으로 만든다.** 판정·돈은 `tutorial.moveOut` 을 그대로 부르고, 여기서는 방·자리만 옮긴다 |
| `stageOf(S)` | 지금 단계. **저장하지 않고 유도한다** |
| `storyRunning(S)` | 스토리가 아직 도는가 = 초보인가 |
| `oneroomRulesFromHomes(homes)` | 살림 값을 `data/balance/homes.json` 에서 **읽는다** |
| `withOneroomRent(rules, oneroomRules)` | 튜토 규칙에 원룸 월세 자리를 채운 사본 |
| `lightGateOf(S, io, opt)` | 지금 방이 갈라짐·무늬 문턱을 넘나 못 넘나 |
| `oneroomGoal(S)` · `storyStatus(S)` | 화면·재현이 같은 문장을 쓰게 |

## `src/game/ending.js` — ④ 내 집 마련

| | |
|---|---|
| `ENDING_RULES` | `targetWon: null` — ⏸ 미확정이라 **자리만** |
| `endingRulesFrom({ targetWon })` | 목표 금액을 주입한다 |
| `endingProgress(S, io, opt)` | 현금과 「다 팔면 얼마」를 같이 낸다 |
| `stepEnding(S, io, opt)` | 목표에 **처음 닿은 날**만 사건으로 |
| `finishEnding(S, io, opt)` | 계약금이 나가고 끝난다. `nextChapter: 'job_select'` |

## ★ 지킨 선

- **규칙을 두 곳에 두지 않았다.** 이사 판정·돈은 `tutorial.js`, 살림(하루 지출·월세·계절)도
  `tutorial.tutorialDay` 가 그대로 돈다. ③에서 갈리는 것은 **월세 하나**이고 그건
  `tutorial.rentWonOf(ts)` 가 사는 방을 보고 고른다. 두 번째 살림 장부를 만들지 않았다.
- **새 이벤트 체계를 안 만들었다.** `moved_in_oneroom` · `ending_ready` · `ending_home` 은
  기존 `turn.events` 목록에 실리는 모양 그대로다. `dialogue.EVENT_SCRIPT` 에 없는 id 는
  조용히 지나간다(그쪽 규약) — 대사는 아직 없다.
- **단계를 저장하지 않았다.** 단계를 정하는 사실은 이미 상태에 둘 다 있다
  (`tutorial.movedOut` · `story.ending.doneOnDay`). 적어 두면 「이사는 했는데 단계는
  반지하」인 어긋난 판이 생기고 고칠 길이 없다. 덤으로 **옛 세이브가 그대로 맞는다.**

---

# 2. ⏸ 원룸 살림 값 — 후보와 근거

`story_arc.md` §5: *"③ 원룸 이후의 슬롯 수·월세·판매가"* 는 미확정이다.
코드에는 `null` 을 두었고(`TUTORIAL_RULES.oneroomRentWon` · `ONEROOM_RULES.rentWon`),
`null` 이면 **이사 뒤에도 반지하 월세로 그대로 돈다.**

> ★ `null` 은 「아직 안 정해졌다」다. **0 이 아니다.** 0 으로 두면 원룸이 공짜인 방이
> 조용히 성립하고, 그게 미확정이었다는 것을 아무도 모른다.

## 후보 — `data/balance/homes.json` 의 `homes[oneroom]`

| | 후보 | 근거 | 상태 |
|---|---|---|---|
| 월세 | **450,000원** | 반지하 30만의 1.5배 | `cost_provisional: true` (잠정) |
| 보증금 | **4,000,000원** | 반지하 300만 + 100만 | 잠정 |
| 이사비 | **1,500,000원** | 보증금 차액 100만 + 이사·복비 50만 | **확정** — `story_arc.md` §3 의 이사 자금과 같은 값이다 |
| 공과·기본 전기 | 80,000원/월 | 반지하 75,000원 | 잠정 |

★ 이사비만 확정인 것이 중요하다. `TUTORIAL_RULES.moveOutCostWon`(150만)과
`homes.json` 의 `moveCost`(150만)가 **같은 값**이고, 재현(`tools/test_oneroom.mjs` 검사 J)이
그 등식을 고정한다. 둘이 갈리면 「모은 돈으로 이사했는데 보증금이 모자란」 판이 된다.

## ⏸ 같이 정해야 하는 것 — **하루 지출 합**

반지하의 `dailySpendWon` 20,000원은 **월세 10,000원을 포함한** 값이다
(`food_economy.md` §2 · `story_arc.md` §3). 원룸 월세가 45만이면 하루 몫이 15,000원이라
같은 방식이면 하루 지출 합이 **25,000원**이 되어야 한다.

지금 코드는 **월세 목돈만 바꾸고 `dailySpendWon` 은 반지하 값을 그대로 쓴다**
(`tutorial.dailyCashOutWon` 이 월세 몫만 다시 뺀다). 그래서 원룸에서 실제로 나가는 돈은
하루 평균 20,000원 그대로이고, 공과금이 오른 것은 반영되지 않았다.
**월세를 확정할 때 이 값도 같이 정해야 한다** — 하나만 고치면 살림이 조용히 어긋난다.

---

# 3. ★★ ⏸ ③ 이 성립하려면 — **원룸 방 데이터에 필요한 것** (house 인계)

`story_arc.md` §0 이 ③에 붙인 말은 *"갈라진 잎 · 무늬 · 번식(삽수)"* 이다.
그런데 **지금 원룸 방 데이터로는 갈라짐도 무늬도 성립하지 않는다.**
재서 나온 것이라 여기 그대로 적는다(`tools/test_oneroom.mjs` 검사 H-2 가 매번 다시 잰다).

## 실측 — 원룸, 자연광만, 맑음·여름, 판정값(7일 이동평균 = peak × 0.643)

| 슬롯 | peak | **7일평균** |
|---|---|---|
| `oneroom-shelf-6:5` | 4.77 | **3.07** |
| `oneroom-shelf-6:7` | 4.37 | 2.81 |
| `oneroom-desk-3:0` | 3.54 | 2.27 |
| … 나머지 8칸 | 2.84 ~ 0.00 | 1.82 ~ 0.00 |

| 문턱 (`data/balance/light_thresholds.json`) | 값 | 원룸에서 넘는 칸 |
|---|---|---|
| 몬스테라 `min`(자란다) | 3.0 | **1칸** (여름만. 가을 2.00 · 겨울 1.14 → **0칸**) |
| 무늬종 `min` (= 3.0 × 1.4) | 4.2 | **0칸** |
| `fenestrate`(갈라진다) | 6.0 | **0칸** |
| 무늬종 `fenestrate` (= 6.0 × 1.4) | 8.4 | **0칸** |
| 콩나물 자리 (< 0.3) | — | **1칸** (반지하는 12칸) |

## 못 갖춘 것 셋

### ① 식물등 기구가 **하나도 없다**

`data/house_rooms.json` 의 `rooms.oneroom.furniture` 에 `growlight_bar` 도 `growlight_clip` 도
없다. 반지하에는 둘 다 박혀 있다.

`S.lamps.count` 는 **방에 놓인 grow 기구를 앞에서부터 n개 켜는 수**다
(`state.js` §lamps · `light_adapter.rigsOn`). 기구가 0개면 **반지하에서 25,000원 주고 산
식물등이 원룸에서 아무 일도 안 한다.** 그리고 자연광만으로는 위 표대로 문턱을 못 넘으므로,
**③에서 갈라짐·무늬로 가는 길이 아예 없다.**

> 참고 — 반지하는 등 2개를 켜면 가장 밝은 자리 7일평균이 **7.92** 가 되어 갈라짐(6.0)도
> 무늬 대역(4.2)도 넘는다(검사 H). 즉 **문제는 물리가 아니라 원룸에 기구가 없는 것**이다.

### ② 슬롯이 11칸뿐이다

`docs/propagation.md` §7 ⏸판단필요가 ④ 엔딩을 성립시키려면 이만큼이 필요하다고 적었다.

| 용도 | 칸 |
|---|---|
| 모주 | 2~3 (밝은 칸) |
| 씨앗 선발 | 20 (밝은 칸 · 회전당) |
| 육성 | 4~17 (밝은 칸) |
| 물꽂이 트레이 | 1~2 (어두워도 된다) |
| 콩나물 시루 | 2~3 (어두운 칸) |
| **합계** | **밝은 칸 20 · 어두운 칸 4 · 최소 24칸** |

지금은 **11칸이고 그중 밝은(min 3.0 이상) 칸이 1칸**이다. 선발과 육성이 동시에 필요하지
않아 겹쳐 쓸 수 있다는 것을 감안해도 자릿수가 다르다.
반지하가 13칸 + 벽 선반 6개 = 31칸으로 푼 것과 같은 방법(선반)이 원룸에도 필요해 보인다.

### ③ `data/profiles/room_profile.oneroom.json` 이 **안 열린다**

```
[프로파일 거부] oneroom: 안정 uid 계약(2026-08-02) 이전 파일입니다.
```

`uidStable: true` 가 없어서 `room_profile.createProfileLight` 이 거부한다.
원인은 `house_rooms.json` 의 원룸 가구에 **`uid` 가 하나도 안 적혀 있는 것**이다
(반지하는 `banjiha-sill` 처럼 전부 못 박혀 있다). uid 가 없으면 `light_adapter` 가
`TEMP~oneroom#1~nightstand` 같은 임시 id 를 붙이고, 그 id 는 **가구를 하나 추가하면 밀린다.**
저장된 화분의 `slotId` 가 다른 자리를 가리키게 되는, 조용히 틀리는 유형이다.

**그래서 지금은 원룸을 헤드리스로 재현할 수 없다.** 밸런스 시뮬도, 이 문서의 숫자를
자동으로 다시 재는 것도 반지하까지다.

## → house 창에 요청

1. `rooms.oneroom.furniture` 의 **모든 가구에 명시 `uid`** 를 붙인다(반지하와 같은 규칙)
2. `growlight_*` 기구를 넣는다 — 몇 개를 어디에 둘지는 house 판단이지만,
   **가장 밝은 자리에서 등을 켜면 7일평균 6.0(갈라짐)을 넘을 수 있어야** ③이 성립한다
3. 창가 화분받침(반지하의 `shelf_sill_pot1` 같은 것)과 벽 선반을 늘려
   **밝은 칸을 확보**한다 — 목표는 위 §②의 표
4. 위 셋을 반영해 `_profile_gen.html` 로 `room_profile.oneroom.json` 을 **다시 뽑는다**
   (`uidStable: true` 가 찍힌다)

★ 코어는 이것들을 못 고친다 — `data/house_rooms.json` 은 house 소유다.
그래서 재현(검사 H-2)은 **던지지 않고 숫자만 남긴다.** 코어가 못 고치는 것 때문에
재현이 늘 빨개지면 아무도 안 본다.

---

# 4. ③ 원룸에서 실제로 도는 것

원룸에 들어오면 **이미 다 만들어져 있는 것들이 그대로 이어진다.** 새로 만든 규칙이 없다.

```
자른다 ──► 뿌리내린다 ──► 자란다 ──► 판다
 propagation.takeCutting   stepCuttings   shop.sellCutting
  용기 7,000원              물꽂이 12일 · 직삽 24일        잎마다 값이 붙는다
  자를 마디가 있어야 한다     혹 32일 → 분갈이(초보 유예 16일)   무늬 잎은 등급배수
```

③에서 ②와 달라지는 것은 셋이다.

| | ② 반지하까지 | ③ 원룸부터 |
|---|---|---|
| 확정 무늬(잭팟) | 있다 — 배움 넷 + 삽수 한 번 자르기 + 「다 팔아도 못 닿는다」 | **없다.** `tutorial.varieGrant` 는 `movedOut` 에서 끝난다 |
| 무늬가 나는 길 | 코어가 확정으로 준다 | **빛으로만.** `growth.calcVarieProb` 가 굴린다 |
| 갈라진 잎 | 반지하 창턱 7일평균 2.42 라 사실상 안 난다 | ⏸ §3 이 풀려야 난다 |

★ 그래서 ③은 **「받는 것」에서 「만드는 것」으로 바뀌는 구간**이다. 튜토의 마지막 장이
확정 무늬를 잘라 뿌리내려 파는 것이었고(`tutorial.js` §확정 무늬), ③은 그 동작을
빛으로 반복하는 것이다. 규칙을 새로 배우지 않는다.

---

# 5. ⏸ ④ 목표 금액 — 후보와 근거

`story_arc.md` §5: *"④ 내 집 마련의 목표 금액 — 삽수 판매 경제와 함께 정한다."*
코드에는 `ENDING_RULES.targetWon = null` 을 두었다.

## 후보 — **1,000만원** (`docs/propagation.md` §7)

| 근거 | |
|---|---|
| 스케일 | 원룸 이사 150만의 **6.7배**. 단계가 하나 올라간 무게 |
| 서사 | 실제로 1,000만원은 *"계약금 / 보증금 일부"* 다. 게임은 **계약하는 순간**까지고 집값 전액이 아니다 — 월세 첫 달 유예와 같은 종류의 서사 장치다 |
| 역산 | 아래대로 **4~17그루**라는 손에 잡히는 수가 나온다 |

| 무엇을 파나 | 한 그루 값 | 1,000만원까지 |
|---|---|---|
| elite 계통 성체(잎 6장) | 3,213,960 | **4그루** |
| elite 계통 삽수(잎 1장) | 642,790 | 16개 |
| potential 계통 성체(잎 6장) | 607,560 | 17그루 |
| 포토스 희귀무늬 성체 | 800,000 | 13그루 |

> ⚠ 위 값들은 `propagation.md` §7 이 **옛 가격 공식**(잎 비율 v)으로 낸 것이다.
> 2026-08-04 에 값이 「잎마다의 합」으로 전면 개편되면서(`shop.js` §⑥) **자릿수가 바뀌었다** —
> 예를 들어 잎 1장·무늬 1장 삽수는 732,000원에서 **80,000원**이 됐다.
> **목표 금액을 확정하기 전에 §7 의 역산을 새 공식으로 다시 돌려야 한다.**
> 지금 공식으로 잎 6장·무늬 2장(섹터) 성체가 751,111원이다(`test_cutting_wiring` 검사 G).

## ★ 구조는 확정이다 — 금액만 미정

- **일상 흑자로는 절대 못 간다.** 자취생 최선(선반 6개·관엽 29칸)이 +2,348원/일이고
  1,000만원이면 4,259일이다. ④도 ②와 같이 **「한 방」** 이다(`sale_economy.md` §1).
- **판정은 현금이다.** 「다 팔면 닿는다」가 아니라 실제로 팔아서 지갑에 넣어야 한다.
  그래야 마지막 행동이 *"삽수를 파는 것"* 이 된다 — `story_arc.md` §0 ④의 문장 그대로다.
- **자동으로 끝나지 않는다.** 닿으면 `ending_ready` 사건만 나고, 끝내는 것은 버튼이다
  (②에서 [원룸으로 이사] 버튼을 남겨 둔 것과 같은 판단).
- **직업 선택은 ④ 뒤다.** `finishEnding` 은 `nextChapter: 'job_select'` 만 알리고
  직업 상태를 만들지 않는다. 만들면 그 순간 정본이 둘이 된다.

---

# 6. ★ 배선 인계 — **코디네이터·화면 창 몫**

코어 쪽은 다 붙었지만 `game.html` 과 `loop.js` 는 이 창이 못 건드리는 파일이라
아래 셋이 아직 안 이어져 있다. `docs/handoff/story-to-core.md` 와 같은 모양의 인계다.

### ① `game.html` — [원룸으로 이사] 버튼 (**이게 없으면 ③이 안 열린다**)

```js
import { moveIntoOneroom } from './src/game/oneroom.js';

$('moveOut').onclick = guard(() => {
  const r = moveIntoOneroom(S, io);        // ← moveOut(S.tutorial) 을 이걸로 바꾼다
  pushLog(S, '📦 원룸으로 이사했습니다 — 반지하 튜토리얼 종료');
  banners([{ title: '📦 원룸으로 이사했습니다', sub: '반지하에서 배운 것을 가지고 갑니다' }]);
  dlgOpen(story.events(r.events));
  if (r.roomChanged) buildRoom(r.roomId);  // ← 3D 방 뷰까지 새로 세운다
  draw();
});
```

`moveIntoOneroom` 은 `io.light` 를 주면 조도 쪽 방까지 바꾸고 화분·삽수·시루를 새 방
자리로 회수한다. **3D 방 뷰는 코어가 모르므로** `roomChanged` 를 보고 화면이 세워야 한다
(`shop.sellPot` 의 `growthNeedsReset` 과 같은 규약).

### ② `loop.nextDay` — 하루에 한 번 ④ 판정

```js
import { stepEnding } from './ending.js';
// stepTutorial 뒤, attachEvents 앞
turn.ending = stepEnding(S, io, { rules: ENDING_RULES_FROM_BALANCE, nodes, stats });
```

`turn.ending.events` 를 `attachEvents` 의 목록에 실으면 `ending_ready` 가 화면에 뜬다.
⚠ 목표 금액이 미확정(`null`)이면 `stepEnding` 은 **아무 일도 안 하고 빈 목록**을 낸다.

### ③ 규칙 주입 — 새 판과 이어하기가 **같은 객체**를 받아야 한다

```js
const oneroomRules = oneroomRulesFromHomes(homesJson);
const rules = withOneroomRent(TUTORIAL_RULES, oneroomRules);   // 월세가 확정된 뒤에만 값이 바뀐다
createTutorialState({ enabled: true, rules });                 // 새 판
deserialize(raw, { rules, ... });                              // 이어하기
```

세이브는 `rules` 를 안 적는다(`save.js` §packTutorial). 두 경로에 다른 규칙을 주면
**이어하기에서 월세가 바뀐다.** 호출부 한 곳에서 만들어야 한다.

### ④ 대사 (`dialogue.js` — 그 창 몫)

새로 나는 사건 셋에 아직 대사가 없다. 없는 id 는 조용히 지나가므로 고장은 안 나지만,
③④가 통째로 무음이다.

| 사건 | 언제 |
|---|---|
| `moved_in_oneroom` | 원룸에 짐을 푼 날 (`moved_out` 바로 다음 장) |
| `ending_ready` | 내 집 마련 자금에 **처음 닿은** 날 |
| `ending_home` | 끝낸 날 |

---

# 7. 안 만든 것 · 왜

| | 왜 |
|---|---|
| **씨앗 선발(다개체)** | `growth` 가 한 그루 전용이다. `propagation.promoteToPot()` 이 그 자리에서 던진다 — 다개체 리팩터가 먼저다(`growth-multiplant-design.md`) |
| **원룸의 새 살림 장부** | `tutorial.tutorialDay` 가 그대로 돈다. 두 번째 장부를 만들면 반지하와 원룸이 다른 계산으로 돌기 시작한다 |
| **④ 뒤의 직업 선택** | `story_arc.md` §0 이 「④ 뒤」로 못 박았다. `nextChapter` 로 알리기만 한다 |
| **원룸 3D 방 뷰·가구 배치** | `room_view.js` · `data/house_rooms.json` 은 다른 창 소유다 |
| **판매가 조정** | ⏸ 미확정(§5). 지금 공식은 `shop.js` §⑥ 가 갖는다 |
| **③④ 대사** | `dialogue.js` 는 다른 창 소유다(§6-④에 인계) |

---

# 8. 관련

| | |
|---|---|
| 스토리 네 단계 정본 | `docs/story_arc.md` |
| 삽수·엔딩 역산 | `docs/propagation.md` §7 |
| 판매 경제 | `docs/sale_economy.md` |
| 자취생 경제·데드라인 | `docs/game_flow.md` |
| 방별 조도 실측 | `docs/engine/rooms_progression.md` |
| 재현 | `tools/test_oneroom.mjs` |
