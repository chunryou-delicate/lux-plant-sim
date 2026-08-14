# 2026-08-15 · story3 → plan

> 할 일은 *"원룸쪽 스토리 작성"* 이었다. 재 보니 **채우는 일이 아니라 고치는 일**이 절반이었다.
>
> 결론 셋 먼저 —
> 1. **원룸은 조용하지 않았다. 저 방(반지하) 얘기를 계속하고 있었다.** 화면 실측에서
>    원룸에 뜬 작은 말이 전부 반지하 것이었고 그중 셋은 거짓말이었다.
> 2. **2026-08-11 에 붙인 도착 대사 아홉 줄 중 세 줄이 사실과 달랐다.** 근거로 쓴 표가
>    하루 만에 낡은 것이었다(2026-08-06 `oneroomfix`).
> 3. **원룸 월세 35만이 코드에 안 걸려 있다.** 이사한 뒤에도 20만이 나간다. 아래 §판단필요①.

---

# 1. 무엇을 재고 무엇을 껐나

## 1-1. 방 데이터 (헤드리스)

| | |
|---|---|
| 켠 것 | `src/game/light_adapter.js` `createLightEngine` · `data/house_rooms.json` 현재본 · 실제 THREE |
| | 하네스는 `tools/test_oneroom_room.mjs` 것을 그대로 베꼈다 — **같은 코드가 돈다** |
| 조건 | 맑음 · 여름 · **등 0개** · 점등 12h · 판정 단위 **7일 이동평균**(peak × `weatherE('summer')` 0.643) |
| 껐다 | 계절·날씨 굴리기. ★ 게임은 `novice` 라 계절·날씨 계수가 1.0 이므로 **이 값이 사철 값이다** |
| 검산 | 같은 값이 **브라우저 안 `window.__io.light`** 로도 나왔다 — 게임이 쓰는 바로 그 창이다 |

## 1-2. 화면 (실제 game.html)

| | |
|---|---|
| 켠 것 | 로컬 서버 `python tools/serve.py 8963` · 헤드리스 크롬 430×932 dpr1 mobile · 저장 지우고 새 판 |
| | 실제 대화 상자 · 실제 `tutorial.tutorialDay` 살림(월세·계절·파산) · 실제 `oneroom.moveIntoOneroom` |
| | 대사는 **화면에 그려진 글자를 읽었다** — `#dlgWho` · `#dlgText` · `#dlgFace` 배경 파일명(표정) |
| | 버튼을 **화면 버튼으로** 눌렀다 — `#moveOut` · `#next` · `#dlgBox`(한 줄씩 넘기기) |
| ⚠ **끈 것 · 지름길** | 반지하 125일을 안 굴렸다. `window.__S()` 로 **① `firstPlay.completed = true`** · **② 배움 넷을 손으로 채움** · **③ 소지금 3,000,000 주입** 뒤 이사 버튼을 눌렀다 |
| ⚠ 지름길 | **④ 이사 뒤 `firstPlay.enabled = false`.** [다음 날]이 `firstPlay.enabled && 놓은 시루 0` 에서 막힌다(`game.html §next`) — 시루를 한 번도 안 놓은 판이라 그렇다. 콩나물 회전은 이 측정의 관심사가 아니다 |
| ⚠ 지름길 | **⑤ 겨울을 보려고 튜토 시계를 130일로 밀었다**(따로 돌린 판) · **⑥ 등 산 판을 보려고 `ts.lamp.owned = 1`**(또 따로) |
| 못 본 것 | 실제 콩나물 회전이 도는 원룸 · 실제 삽수 경제 · 반지하에서 이어서 온 판(튜토 시계가 0 에서 시작했다) |

⚠ 지름길 ③ 때문에 **원룸 1일째에 `rentFirst` 가 떴다.** 진짜 판에서는 첫 월세가 반지하에서 나므로
그 자리는 `rentAgain` 이다. 지름길이 만든 것이지 고장이 아니다.

---

# 2. ★ 실측 — 지금 두 방이 이렇다

| | 반지하 | 원룸 |
|---|---|---|
| 자리 (`room.slots`) | 14칸 | **15칸** |
| 제일 밝은 자리 7일평균 | **3.09** (`banjiha-sill:0` · peak 4.80) | **4.30** (`oneroom-sill:1` · peak 6.69) · **+39%** |
| `min 3.0` 을 넘는 칸 | **1칸** | **5칸** (창턱 4칸 + `oneroom-shelf:5` 3.15) |
| 무늬종 `min 4.2` 를 넘는 칸 | 0칸 | **3칸** |
| 갈라짐 `6.0` | 등0 0 · 등1 1칸 | 등0 **0칸**(4.30) · 등1 **1칸**(6.95) |
| 콩나물 자리 (7일평균 ≤ 0.3) | **9칸** | **1칸** (`oneroom-nightstand:0` · 0.00) |
| 식물등 기구 | 2개 | 2개 |
| `room.slots[0]` | `banjiha-sill:0` | **`oneroom-nightstand:0`** |
| 월세 (코드가 실제로 떼는 값) | 20만 | **20만** ← §판단필요① |
| 하루 지출 | 16,667원 | **16,667원** (`dailySpendWon` 이 이사로 안 바뀐다) |

★ **`room.slots[0]` 이 재미있다.** `oneroom.reseatCrops` 가 이사한 시루를 전부 `slots[0]` 로 보내는데,
원룸의 `slots[0]` 이 **마침 그 유일한 어두운 칸**이다. 즉 이사하면 시루가 한 자리에 겹쳐 서고,
그게 콩나물에는 맞는 자리다. START-HERE §3 의 *"이사 뒤 시루를 새 방 첫 자리에 몰아 앉히는 게
맞는지"* 에 대한 답은 **원룸에 한해서는 맞다** — 다만 우연히 맞는 것이라 방이 바뀌면 깨진다.

## 2-1. ★ 이 저장소의 열세 번째 「재는 자」 사고 — **값이 아니라 근거가 낡았다**

2026-08-11 이 도착 대사를 쓸 때 근거로 삼은 것은 `story_arc.md §③` 표였고, 그 표는
**2026-08-05 에 `data/profiles/room_profile.*.json`(2026-08-02 파일)** 에서 나왔다.
그런데 **바로 다음 날 2026-08-06 `oneroomfix`** 가 원룸에 창턱 4칸과 식물등 기구 2개를 넣었고,
같은 무렵 `lampaim` 의 BACK_REFLECT 가 반지하 창턱을 올렸다.

**표가 하루 만에 낡았고, 아무도 표를 안 고쳤다.** 그래서 그 표를 읽은 대사가 틀렸다.
`docs/story_arc.md` §③ · §미해결 두 곳에 ⚠ 정정을 붙여 두었다.

---

# 3. 바꾼 것

## 3-1. `movedInOneroom` — **세 줄이 거짓이었다**

| 옛 줄 | 무엇이 틀렸나 | 지금 |
|---|---|---|
| *"줄었어. 대신 하나 늘었고"* | **안 줄었다.** 14 → **15칸**이다. 「11칸」은 창턱 4칸이 붙기 전 값 | *"한 칸 더 많아. 그건 별거 아니고 — 밝은 자리가 늘었어."* |
| *"저 방엔 한 칸도 없었어. 여긴 한 칸 있어"* | 반지하도 창턱 한 칸은 `min` 을 넘는다(3.09). 진짜 차이는 **1칸 → 5칸** | *"저 방은 등 없이 자라는 자리가 창턱 하나였잖아. 여긴 다섯이야."* |
| *"…월세는 서른다섯이 됐고" / "응. 그건 오른 거 맞아"* | **지금 게임은 그 돈을 안 뗀다** (§판단필요①) | *"…대신 통장이 한 번에 얇아졌고." / "응. 이백만 원. 그건 나간 거 맞아."* |

★ 마지막 것은 **화면 사실**이다 — 이사 버튼을 누르는 순간 소지금이 3,000,000 → 1,000,000 이 됐다.
`shortMoney` 가 이미 *"이백만 원. 보증금이랑 첫 달 월세랑 이삿짐값."* 으로 깔아 둔 숫자이기도 하다.

⚠ 아홉 줄 그대로다. 이사 장면이 **22줄 연속**(13 + 9)인 것은 안 건드렸다(§판단필요②).

## 3-2. `winterCame` — **반지하를 못 박고 있었다**

겨울은 튜토 135일에 오고, 이사는 그보다 이르다(story2 화면 실측: 게임 125·127일 이사 = 튜토 78일쯤).
그리고 이 대사는 **한 번뿐**(`REPEATABLE` 아님)이라 두 번째 겨울이 없다 —
즉 **표준 진행에서는 원룸에서 한 번 뜨고 끝난다.** 실제로 그렇게 떴다(아래 §5).

```
- { who: 'moni',   face: 'sad', text: '겨울이야. 반지하는 겨울이 길어.' },
- { who: 'moni',   text: '해가 제일 낮은 계절이야. 창턱 하나로 버티기엔 짧고.' },
- { who: 'jachwi', face: 'worry', text: '…아직 못 나갔네.' },
- { who: 'moni',   text: '못 나간 게 아니라 아직 안 나간 거야. **늦은 거지 틀린 게 아니고.**' }
+ { who: 'moni',   face: 'sad', text: '겨울이야. 이 동네는 겨울이 길어.' },
+ { who: 'moni',   text: '해가 제일 낮은 계절이야. 창 하나로 버티기엔 짧고.' },
+ { who: 'jachwi', face: 'worry', text: '…겨울이 오면 셈이 급해진다.' },
+ { who: 'moni',   text: '급할 건 없어. **늦은 거지 틀린 게 아니고.**' }
```

반지하에서만 참인 말은 **`winterStill` 이 그대로 갖는다** — 그쪽은 `!ts.movedOut` 로 잠겨 있어
(`tutorial.js §winter_still`) 원룸에서는 안 뜬다. *"겨울에도 반지하다."* 가 거기 있다.

## 3-3. 반지하 작은 말 셋에 `!c.movedOut` 을 걸었다

**화면에서 실제로 뜬 거짓말들이다** (원룸 100일 실측):

| 어디 | 원룸 며칠째 | 뜬 말 |
|---|---|---|
| `chatSummerHeat` | 4 · 40 | *"**반지하는** 여름에 덥고 겨울에 춥다."* |
| `chatSummerDamp` | 7 · 43 | *"벽에서 눅눅한 냄새가 난다."* (반지하 결로) |
| `chatLandlord` | 27 · 76 | *"집주인 아저씨가 「학생, 아직 있었네」"* (저 방 집주인이다) |

⚠ **나머지는 그대로 뒀다.** `chatMorning`·`chatQuiet`·`chatMoniName`·`chatParents`·`chatNeighbor`·
`chatDailySpend`·`chatWinterCold` 는 방을 안 가리는 말이다. 하루 지출 *"만 육천 원"* 도 원룸에서
**그대로 참**이다 — `dailySpendWon` 이 이사로 안 바뀐다(`tutorial.js §dailyCashOutWon` ⏸).

## 3-4. ★ 원룸 작은 말 **아홉 가지**를 새로 썼다

**새 사건 id 를 하나도 안 만들었다.** 코어가 원룸에서 내는 사건은 `rent_soon`·`rent`·`season`·
`broke`·`plant_*` 뿐이고 전부 반지하와 같은 id 다(`winter_still`·`varie_granted` 는 `!ts.movedOut`
로 잠긴다). `EVENT_SCRIPT` 에 없는 id 를 부르면 조용히 지나가므로 **없는 사건을 지어낼 수 없다.**
⇒ `chatterContext` 가 이미 내주는 **`movedOut` 하나로** 갈리는 작은 말로 채웠다.

| id | 무엇을 | 근거 |
|---|---|---|
| `chatOneroomMorning` | **첫 아침** — 불을 안 켰는데 방이 밝다 | 오프닝 *"…불도 잘 안 드는 방이네"* · 이사 *"불 끄고 가자"* 가 여기서 닫힌다 |
| `chatOneroomDark` | ★ **밝아진 대가** — 콩나물 자리 9칸 → 1칸 | 실측 |
| `chatOneroomSiru` | 시루가 한 자리에 몰려 서 있다 | `reseatCrops` → `slots[0]` = 그 유일한 어두운 칸 |
| `chatOneroomBright` | 등 없이 자라는 자리 1칸 → 5칸 | 실측 (창턱 4 + 선반 1) |
| `chatOneroomWindow` | **미화하지 않는다** — 골목 안 2층이라 아직 하늘을 다 못 본다 | `house_rooms.json §skyViewK 1.18` 주석 |
| `chatOneroomEmpty` | 박스 네 개를 다 풀었는데 방이 안 찬다 | 바닥 17.8 → 27.3㎡ |
| `chatOneroomLamp` | 산 등이 따라온다 · **갈라진 잎을 처음 예고** | 자연광 4.30 은 6.0 을 못 넘고 등1 이면 6.95 |
| `chatOneroomNoLamp` | 안 산 판 — 나무라지 않는다 | `lampSkipped` 와 같은 결 |
| `chatOneroomVarie` | 확정 무늬가 끝났다는 것을 살림 속에서 한 번 더 | `story_arc §4-1` |
| `chatOneroomWinter` | 원룸에서 맞는 첫 겨울 | `winter_still` 이 안 오는 자리를 받는다 |

★ **목록의 앞쪽에 뒀다.** `pickChatter` 는 「가장 오래 안 나온 것」을 고르는데, 한 번도 안 나온
것끼리는 `rank` 가 둘 다 −1 이라 **목록 순서**로 갈린다. 이사한 날 이 아홉은 전부 −1 이고
반지하 것들은 대개 한 번씩 나온 뒤라, 앞에 두면 **원룸의 첫 며칠이 원룸 얘기로 시작한다.**
뒤에 두면 첫 아침이 열흘 뒤에 온다.

## 3-5. `chatterContext` 에 `movedInOnDay` · `daysInOneroom` 을 더했다

*"첫 아침"* · *"박스를 다 풀었는데"* 는 이사 두 달 뒤에 나오면 안 된다.
**새 값을 만들지 않았다** — `S.story.movedInOnDay`(`oneroom.createStoryState`)와 `turn.day` 의 차다.
`chatOneroomMorning` 은 14일 이내, `chatOneroomEmpty` 는 30일 이내에만 후보가 된다.

---

# 4. ★★ 판단필요

## ① **원룸 월세 35만이 코드에 안 걸려 있다** — 제일 급하다

| | |
|---|---|
| 정본 | `data/balance/homes.json` `oneroom.rent = 350000` · START-HERE §6 *"원룸 월세 35만"* (확정) |
| 코어 | `tutorial.TUTORIAL_RULES.oneroomRentWon = null` — *"미확정이라 자리만 둔다"* |
| 다리 | `oneroom.oneroomRulesFromHomes(homes)` → `oneroom.withOneroomRent(TUTORIAL_RULES, …)` — **다 있다** |
| ⚠ 문제 | **`game.html` 이 그 둘을 한 번도 안 부른다.** `homes.json` 자체를 안 읽는다(2026-08-15 저장소 전체 훑음: `withOneroomRent`·`oneroomRulesFromHomes`·`homes` 어느 것도 `game.html` 에 없다) |
| 결과 | `rentWonOf(ts)` 가 이사한 뒤에도 **20만**을 낸다. 화면 실측(원룸 24·54·84일)에서 `rentSoon` 이 *"이레 남았어. **이십만 원**."* |

⇒ 그래서 도착 대사의 *"월세는 서른다섯이 됐고"* 를 뺐다(§3-1). **한 판 안에서 몬이가
서른다섯과 이십만을 같이 말하고 있었다.**

**붙일 자리는 `game.html` 이라 이 창 소유가 아니다.** 필요한 것은 세 줄이다:

```js
const homes = await (await fetch('./data/balance/homes.json')).json();
const RULES = withOneroomRent(TUTORIAL_RULES, oneroomRulesFromHomes(homes));
// newState({ …, tutorialRules: RULES }) 로 넘기고, 이어하기(deserialize)에도 같은 객체를 준다
```
⚠ `oneroom.js` 머리말이 못 박은 것 — *"두 경로에 다른 rules 를 주면 이어하기에서 월세가 바뀐다.
호출부가 한 곳에서 만들어야 한다."*

**배선이 붙는 날 도착 대사에 이 두 줄을 되살린다** (문장은 그대로 두었다):

```js
{ who: 'jachwi', face: 'tired',   text: '…월세는 서른다섯이 됐고.' },
{ who: 'moni',   face: 'sad',     text: '응. 그건 오른 거 맞아.' },
```

그리고 그때 **`rentSoon` 이 「이십만 원」이라고 말하는 것도 같이 갈라야 한다.**
갈 수는 있다 — `rent_soon` 이벤트가 `rentWon` 을 싣고 있다(`tutorial.js:449`). 다만
`scriptsForEvents` 가 지금 이벤트만 받으므로 **선택 인자를 하나 늘려야** 한다. 이 창은 안 했다:
그 갈래를 지금 만들면 **영영 안 뜨는 대사가 하나 늘 뿐**이기 때문이다.

⚠ **하루 지출도 같이 봐야 한다.** `dailySpendWon` 은 월세를 포함한 값(16,667)인데 원룸에서도
그대로다. 월세만 35만으로 올리면 `dailyCashOutWon` 이 16,667 − 11,667 = **5,000원**이 되어
**총액은 그대로**다(월세만 커지고 밥값·공과가 그만큼 줄어드는 셈). `tutorial.js` 가 스스로
⏸ 로 적어 둔 자리다. **월세와 하루 지출은 한 벌이다**(START-HERE §6 의 그 경고와 같은 모양).

## ② `monsteraStalled` — 지울 한 줄 (story2 가 남긴 것 · **확인했다**)

2026-08-15 다시 훑었다. `EVENT_SCRIPT` 에도 `CHATTER` 에도 없고 `game.html` 도
`dlgOpen('monsteraStalled')` 를 안 한다. 하는 일은 `monsteraGuideWindow`(`monstera_no_spear`)가 한다.
검사가 `used` 목록에 손으로 박아 통과시키는 것도 그대로다.

지울 한 줄 — `tools/test_dialogue_coverage.mjs:475`

```
-     'god1', 'intro', 'cropPlaced', 'monsteraMoved', 'monsteraStalled',
+     'god1', 'intro', 'cropPlaced', 'monsteraMoved',
```

★ `SCRIPTS.monsteraStalled` 를 **안 지우고 이 줄만 지우면 검사가 FAIL 로 드러난다** — 그 편이 안전하다.
검사 파일은 이 창 소유가 아니라 손대지 않았다.

## ③ **하루에 대사를 몇 줄까지 낼지 아무도 안 정했다** — 원룸에서도 난다

story2 가 Day 48 의 16줄을 올렸다. **원룸에서도 같은 일이 난다.** 화면 실측:

| 어디 | 줄 |
|---|---|
| 이사 장면 (`movedOut` + `movedInOneroom`) | **21줄 연속** |
| 원룸 45일째 (`autumnCame` + `lampUnlocked`) | **12줄 연속** |
| 원룸 61일째 (`rentAgain` + `brokeTalk`) | 6줄 |

`EVENT_ORDER` 는 **무엇이 먼저인가**만 정하고 **하루에 몇 개까지**는 아무도 안 정한다.
고칠 수 있는 자리 셋 다 이 창 소유가 아니다 — `game.html`(한 턴에 여는 대사 수를 끊는다) ·
`tutorial.rentFirstDueDay` · `dialogue.QUIET_DAYS_BEFORE_CHATTER` 옆의 「한 턴 상한」.
**박사님 판단이 필요하다.**

## ④ 원룸 살림이 **파산으로 끝난다** — 경제 쪽에 넘긴다

화면 실측(수입 0 · 지름길 판): 소지금 100만으로 시작해 **원룸 60일에 0원**, 80일에 파산 표시.
초보 모드라 게임이 안 끝나지만(story_arc §0) *"삽수를 늘려 내 집 마련 자금을 만듭니다"*
(`oneroomGoal`)를 하는 동안 계속 0원이다. **이 창은 삽수 경제를 안 굴렸으므로 판정하지 않는다.**
`story_arc §④` 가 이미 *"정상상태가 적자다"* 라고 적어 둔 것과 같은 자리로 보이는데,
그 역산은 **원룸 슬롯 11칸 · 월세 45만**으로 낸 것이라 **지금 값(15칸 · 20만)으로 다시 돌려야 한다.**

## ⑤ `winterOneroom` 같은 **새 사건 갈래를 안 만들었다** — 이유

`scriptOf` 가 `season`·`rent` 를 id 안에서 가르는 것처럼 방으로도 가를 수 있다.
안 한 이유는 **검사 파일 때문**이다 — `test_dialogue_coverage.mjs:475` 의 「쓰이지 않는 대사가
없다」가 `EVENT_SCRIPT`·`CHATTER`·**손으로 박은 목록** 셋으로만 대조하는데,
`scriptOf` 안에서만 골라지는 이름(`autumnCame`·`winterCame`·`rentFirst`·`rentAgain`)은
그 손으로 박은 목록에 있어야 한다. 새 갈래를 만들면 **검사 파일을 고쳐야 하고 그건 이 창 소유가
아니다.** ⇒ 작은 말로 채웠다(§3-4). 결과가 더 나았다 — 작은 말은 조용한 날에만 나와서
이사 장면이 더 길어지지 않는다.

---

# 5. ★ 화면 확인 — 「고쳤다」를 화면 없이 안 썼다

새로 쓴 열 가지가 **전부 화면에 글자로 떴다.** 서버 8963 · 새 판 · 위 §1-2 조건.

| 원룸 며칠째 | 화면에 뜬 것 |
|---|---|
| 이사 순간 | `movedInOneroom` 9줄 — *"한 칸 더 많아…"* · *"여긴 다섯이야."* · *"응. 이백만 원."* |
| **4** | `chatOneroomMorning` — *"아침에 눈을 떴는데 방이 밝다." / "불을 안 켰는데."* |
| **7** | `chatOneroomDark` ★ — *"저 방엔 아홉 칸이었어." / "…밝아진 값을 콩나물로 내는구나."* |
| **10** | `chatOneroomSiru` — *"시루가 다 한 자리에 모여 있다."* |
| **13** | `chatOneroomBright` — *"등 없이 자라는 자리가 다섯이야."* |
| **16** | `chatOneroomWindow` — *"골목 안 이층이니까. 하늘을 다 보는 방은 아니야."* |
| **19** | `chatOneroomEmpty` — *"박스 네 개를 다 풀었는데 방이 안 찬다."* |
| **22** | `chatOneroomNoLamp` — *"창턱 위에 등 걸이가 비어 있다."* |
| **27** | `chatOneroomVarie` — *"이제 아무도 안 정해 줘. 나도 몰라."* |
| 22 (등 산 판) | `chatOneroomLamp` — *"창만으로는 안 되는 게 하나 남았어. 잎에 구멍이 나는 거."* |
| 5 (겨울 판) | `winterCame` — *"겨울이야. **이 동네는** 겨울이 길어."* (반지하를 안 부른다) |
| 겨울 판 | `chatOneroomWinter` — *"여기서 맞는 첫 겨울이다." / "…나갔지." / "나갔지."* |

★ 그리고 **원룸 100일을 다시 굴려 반지하 거짓말 셋이 한 번도 안 뜨는 것을 확인했다** —
고치기 전에는 4·7·27·40·43·76일째에 떴다.

## 검사

| | 전 | 후 |
|---|---|---|
| `tools/test_dialogue_coverage.mjs` | PASS (전 항목) | **PASS (전 항목)** |
| `tools/test_oneroom.mjs` | — | **PASS** |
| `tools/test_ending_flow.mjs` | — | **PASS (16/16)** |
| `tools/test_first_play.mjs` | — | **PASS** (3묶음) |
| `tools/test_tutorial.mjs` | — | **PASS** |

★ 대사 개수·순서를 박아 둔 검사 셋(`⑸` 식물신 3줄 · `⑹` `movedOut` 8줄 이상·마지막은 몬이·「창」포함 ·
「쓰이지 않는 대사가 없다」)을 **안 건드리게 넣었고 돌려서 확인했다.** 새 작은 말은
`CHATTER` 에 들어가므로 「쓰이지 않는 대사」 목록에 자동으로 잡힌다 — 검사 파일을 안 고쳤다.

---

# 6. 못 한 것 (모르면 모른다고 적는다)

- **`game.html` 을 안 고쳤다**(지시). §판단필요① 의 세 줄은 그쪽 일이다.
- **`tools/test_dialogue_coverage.mjs` 를 안 고쳤다**(내 소유 아님). §판단필요②.
- **실제 콩나물 회전이 도는 원룸을 못 봤다.** 지름길 ④ 로 `firstPlay.enabled` 를 껐다.
  그래서 `chatOneroomSiru` 가 가리키는 「한 자리에 몰려 선 시루」를 **화면에서 눈으로는 못 봤다** —
  코드(`reseatCrops` → `slots[0]`)와 슬롯 실측(`slots[0]` = 유일한 어두운 칸)으로만 확인했다.
- **삽수·판매가 도는 원룸 경제를 안 쟀다.** §판단필요④ 는 제기만 하고 판정하지 않았다.
- **반지하에서 이어서 온 진짜 판을 못 봤다.** 튜토 시계가 0 에서 시작하는 지름길 판이라,
  「이사 시점의 튜토 며칠」이 실제로 몇인지는 story2 의 실측(튜토 78일쯤)을 빌려 썼다.
- **④ 엔딩 대사는 안 썼다**(지시).
- **원룸 헤드리스 프로파일(`uidStable`)** 은 안 봤다. `light_adapter` 쪽으로만 쟀다.

---

# 7. 손댄 파일

| | |
|---|---|
| `src/game/dialogue.js` | `movedInOneroom` 세 줄 · `winterCame` 네 줄 · 원룸 작은 말 9가지 신설 · `CHATTER` 조건 · `chatterContext` |
| `docs/story_arc.md` | §4-1 에 「도착 대사 세 줄을 다시 썼다」와 「원룸 안 이야기를 채웠다」 · §③ 과 §미해결 표에 ⚠ 정정 |
| `docs/handoff/story3-to-plan.md` | 이 파일 |

`game.html` · `tools/*` 는 **읽기만** 했다. 임시 측정기(`tools/_probe_story3_*.mjs`)는 지웠다.
