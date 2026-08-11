# 2026-08-11 · story2 → plan

> 두 가지를 했다. **① 대사가 화면에 실제로 뜨는지 눌러서 확인**하고,
> **② 대사와 서사에서 약한 데를 고쳤다.**
>
> 결론 먼저 — **배선은 이미 다 붙어 있다.** 2026-08-03 `story-to-core.md` 가 넘긴 세 곳 중
> 둘은 붙었고 하나는 붙일 자리가 없어졌다. 그때 지적된 증상(*"월세·가을·식물등·정지·이사가
> 전부 조용하다"*)은 **지금 화면에서 재현되지 않는다.**
> 대신 **다른 구멍 하나**를 찾았다 — 원룸에 도착하는 장면이 조용하다.

---

# 1단계 · 말이 실제로 화면에 나오나

## 1-1. 배선 — 「지금 그렇다」

`game.html` 은 옛 하드코딩(`if (ev && ev.harvested) ids.push('harvest','god1')`)을 **안 쓴다.**
저장소 전체를 훑어 그 문장은 남아 있지 않다(`.claude/worktrees/` 안의 옛 사본은 뺐다).

⚠ **줄 번호는 그대로 못 믿는다.** 검사를 도는 동안 다른 창이 `game.html` 을 고치고 있어,
같은 문장의 줄 번호가 한 시간 사이에 **4256 → 4309** 처럼 밀렸다. 아래는 **찍은 시각의 값**이고
찾을 때는 문장으로 찾는 편이 낫다.

| 어디 | 줄(2026-08-11 기준) | 무엇 |
|---|---|---|
| import | `game.html:1711` | `import { createDialogue, createStoryteller, SPEAKERS } from './src/game/dialogue.js';` |
| 만들기 | `game.html:4586` | `const story = createStoryteller();` |
| ① 하루 끝 | `game.html:4504` | `showFirstPlayEvents()` 안 — `const ids = story.turn(turn, S); if (ids.length) dlgOpen(ids);` |
| ① 부르는 데 | `$('next').onclick` | `lastTurn = nextDay(S, io).turn; showFirstPlayEvents(lastTurn);` |
| ② 시루 거두기 | `game.html:4309` | `if (r.events && r.events.length) dlgOpen(story.events(r.events));` |
| ② 식물등 | `game.html:6617` | `dlgOpen(story.events(r.events));` |
| ② 이사 | `game.html:6736` | `dlgOpen(story.events(r.events));` — `moveIntoOneroom` 의 반환값 |

**③ 빨리감기 `onDay` 는 붙일 자리가 없어졌다.** 2026-08-09 에 빨리감기 묶음이 통째로 걷혔다
(`game.html` §*"빨리감기 묶음을 통째로 걷었다"* — `ffNextWas`·`ffPaint`·`ffHint`·`$('ff').onclick`).
하루는 이제 [다음 날] 한 번에 하나씩만 간다. story-to-core §③ 은 **더 이상 할 일이 아니다.**

## 1-2. 화면 실측 — 눌러서 확인했다

### 무엇을 켜고 무엇을 껐나

| | |
|---|---|
| 켠 것 | 실제 `game.html` · 로컬 서버 `python tools/serve.py 8963` · 헤드리스 크롬 430×932 dpr1 mobile |
| | 저장을 지우고 **새 판**으로 시작 · 실제 3D 성장 엔진 · 실제 대화 상자 |
| | 시루 버튼을 **화면 버튼으로** 눌렀다 — `💧 물 주기` · `🌱 다시 심기` · `🥣 거두기` · `[다음 날]` · `[원룸으로 이사]` |
| | 대사는 **화면에 그려진 글자를 읽었다** — `#dlgWho` · `#dlgText` · `#dlgFace` 의 배경 파일명(표정 확인). 상자를 눌러 한 줄씩 넘기며 받아 적었다 |
| 대신한 것 | 시루를 방에 놓기 · 몬스테라를 창턱으로 옮기기는 **3D 끌기**라 모듈 창구로 했다(`first_play.placeBeansprout` · `state.setPotSlot` · `first_play.moveMonstera`). 씨앗 주문도 모듈(`shop.orderItem`) |
| 주입한 것 | **하루 수입 24,300원.** 코어에 반복 수입이 없어 안 넣으면 이사 자금 200만에 영영 안 닿는다(`tools/test_dialogue_coverage.mjs` 머리말과 같은 이유) |
| 끈 것 | **식물등을 안 샀다**(경로 A) · 겨울까지 안 갔다 · 날씨는 novice 라 맑음 고정 |

### 결과 — 게임 125일에 이사까지 갔다. 대사 **192줄 · 말이 난 날 48일**

실제로 화면에 뜬 것(순서대로):

| 게임일 | 뜬 대사 |
|---|---|
| 0 | `intro` (13줄) |
| 3 · 6 | `chatCrop1` · `chatCrop2` |
| 7 | `harvest` → `learnHarvest` → `learnCropDark` |
| 24 | `god1` → `monsteraArrived` (★식물신이 도착 **바로 앞**. 계약대로다) |
| 25 | `learnPlantWindow` |
| 48 | `spearFurled` → `learnSpear` → `rentFirst` → `shortMoney` |
| 71 · 101 | `rentSoon` |
| 78 · 108 | `rentAgain` |
| 92 | `autumnCame` → `lampUnlocked` |
| 99 | `lampSkipped` |
| 125 | `moveReady` → `movedOut` |
| 그 사이 | 작은 말 열두 가지(여름·가을·돈·성장·살림) |

**즉 월세·가을·식물등·이사는 지금 조용하지 않다.** 2026-08-03 의 증상은 해소돼 있다.

### ⚠ 화면 실측에서 나온 구멍 하나 — **원룸 도착이 조용하다**

Day 125 에 이사가 끝나고 새 방이 떴는데 **아무 말도 없었다.**
반지하의 마지막 대사가 *"가자. 다음 방은 창이 높대."* 인데 그 방에 도착해서는 아무도 아무 말을 안 한다.

원인은 배선이 아니라 **대사가 없어서**다. `oneroom.moveIntoOneroom` 이 `moved_out` **다음에**
`moved_in_oneroom` 을 내고 `game.html` 이 둘을 한 번에 `story.events(r.events)` 로 넘기는데,
`dialogue.EVENT_SCRIPT` 에 그 id 가 없어 조용히 버려졌다.
`oneroom.js` 가 스스로 *"⚠ 대사는 아직 없다"* 고 적어 둔 자리다.

→ **2단계에서 채웠다**(§2-6). 코드는 안 고쳤다 — 대사만 있으면 오늘 바로 뜬다.

### ★ 내가 한 번 잘못 쟀다 — 적어 둔다

첫 실측은 **115일 동안 아무 일도 안 일어났다.** 튜토 시계가 0에 머물고 작은 말 다섯 개가
3일마다 무한히 돌았다. 게임이 멈춘 것처럼 보였다.

**게임 잘못이 아니라 재는 하네스 잘못이었다.** 콩나물을 거둔 뒤 **씨앗을 안 시켰다.**
회전이 한 번에서 멈추니 몬스테라가 3회전째에 안 오고, 첫 플레이가 안 끝나 살림 시계가 안 돌았다.
화면은 제대로 안내하고 있었다 — `#resow` 버튼이 「🌱 콩 씨앗이 없습니다」로 떠 있고
말풍선도 상점을 가리킨다(`game.html` §`drawSow` · §말풍선 `'🌱 씨앗이 없습니다'`).
하네스에 씨앗 주문을 넣으니 정상으로 돌았다.

START-HERE §2 의 *"숫자가 이상하면 코드가 아니라 「재는 자」를 먼저 의심하라"* 가 그대로 났다.

### 못 본 것 (모르면 모른다고 적는다)

경로 A 로 125일에 이사해서 **겨울에 안 갔고 등도 안 샀다.** 그래서 아래는 **화면으로 못 봤다** —
`winterCame` · `winterStill` · `plantStalled*` · `plantResumed` · `brokeTalk` · `varieGranted` ·
`lampBought` · `shortLearn` · `monsteraGuideWindow` · `monsteraGuideLamp` · `cropPlaced` · `monsteraMoved`.
헤드리스 재현(`test_dialogue_coverage` 경로 B·C·D)에서는 전부 난다. **화면 확인은 아직이다.**

---

# 2단계 · 글 다듬기

## 2-1. `shortMoney` — **몬이가 틀린 셈을 말하고 있었다** (사실 오류)

*"백오십만 원. 보증금이랑 첫 달 월세랑 이삿짐값."*

이사비는 2026-08-09 에 **200만원**이 됐다(`tutorial.MOVE_RULES.moveOutCostWon = 2_000_000` ·
START-HERE §6 · `story_arc.md` §3). 같은 날 `rentFirst`(월세 이십만·석 달/넉 달)와
`chatDailySpend`(만 육천 원)는 갱신됐는데 **이 줄만 안 따라왔다.**
2026-08-11 화면 실측 Day 48 에 그대로 떴다.

```
- { who: 'moni', text: '백오십만 원. 보증금이랑 첫 달 월세랑 이삿짐값.' },
+ { who: 'moni', text: '이백만 원. 보증금이랑 첫 달 월세랑 이삿짐값.' },
```

## 2-2. `shortLearn` — **화면과 어긋나는 말**

*"나가는 건 되지. 근데 다음 방도 창은 하나야."*

`tutorial.canMoveOut` 은 배움 넷을 요구하므로 **이사 버튼이 실제로 잠겨 있다.**
몬이가 "나가는 건 된다"고 하면 플레이어는 있지도 않은 버튼을 찾는다.

```
- { who: 'moni', text: '나가는 건 되지. 근데 다음 방도 창은 하나야.' },
- { who: 'moni', face: 'sad', text: '여기서 안 배우면 거기서 똑같이 헤매.' }
+ { who: 'moni', text: '다음 방도 창은 하나야. 여기서 안 배우면 거기서 똑같이 헤매.' },
+ { who: 'moni', face: 'sad', text: '그래서 짐은 아직 안 싸도 돼. 하나 남았어.' }
```

*"짐은 아직 안 싸도 돼"* 가 「버튼이 안 열린다」를 대사로 말한 것이다.

## 2-3. `rentSoon` — **반복 대사인데 몬이가 매번 처음 듣는다**

이 대사는 **달마다 다시 난다**(`REPEATABLE`). 실측에서 Day 71 · Day 101 에 똑같이 떴다.
그런데 둘째 줄이 몬이의 *"한 달이 벌써?"* 라서, **세어 주는 것이 일인 몬이가 매달 달력을
처음 보는 사람**이 된다. 넷째 줄 *"그럼 지금부터 세자"* 는 **없는 조작을 가리킨다** — 세는 화면이 없다.

```
  rentSoon: [
    { who: 'jachwi', face: 'worry', text: '달력에 동그라미 쳐 둔 날이 또 다가온다.' },
-   { who: 'moni',   face: 'curious', text: '한 달이 벌써?' },
-   { who: 'jachwi', face: 'tired', text: '일주일 남았어. 이십만 원.' },
-   { who: 'moni',   text: '그럼 지금부터 세자. 아직 일주일 있잖아.' }
+   { who: 'moni',   face: 'curious', text: '이레 남았어. 이십만 원.' },
+   { who: 'jachwi', face: 'tired', text: '…알아. 나도 세고 있었어.' }
  ],
```

넷 → 셋. **세는 쪽이 몬이로 돌아왔고**, 주인공이 이미 알고 있다는 것이 반복에 어울린다.

## 2-4. `autumnCame` · `winterCame` — **일어나지 않은 변화를 일어난 것처럼 말한다**

*"창턱이 예전만 못할 거야."* · *"창턱도 이제 창턱값을 못 해."*

`story_arc.md` §5 ★★ 가 잰 것: **계절이 화면에만 있고 빛에는 안 걸려 있다.**
튜토는 `novice` 로 돌아 계절계수가 1.0 이라, 화면이 "가을입니다"라고 말하는 날에도
창턱 DLI 는 여름과 **같은 값 그대로**다. 실측 Day 92 에 이 말이 그대로 떴다.

대사로 못 고치는 것이라 **단정만 예고로 낮췄다.** 지금 참인 것(달력·해의 높이)만 말한다.

```
- { who: 'moni', text: '창턱이 예전만 못할 거야. 자리가 나빠진 게 아니라 **해가 낮아진** 거고.' },
+ { who: 'moni', text: '겨울로 갈수록 창 하나로는 모자라져. 자리가 나빠지는 게 아니라 **해가 낮아지는** 거고.' },

- { who: 'moni', text: '해가 제일 낮은 계절이라, 창턱도 이제 창턱값을 못 해.' },
+ { who: 'moni', text: '해가 제일 낮은 계절이야. 창턱 하나로 버티기엔 짧고.' },
```

⚠ **계절을 빛에 거는 날(`story_arc` §5 권고 ㉠) 이 두 줄은 현재형으로 되돌려야 한다.**
그때까지 몬이는 겪지 않은 것을 겪은 것처럼 말하지 않는다.

## 2-5. `chatCrop1` · `chatCrop2` — **열 번째 시루를 앞에 두고 처음 보는 사람처럼 말한다**

조건이 `!cropHarvested` 뿐이라 **다시 심을 때마다 되살아났다.**
실측에서 *"콩나물이 진짜 자랄까"* 가 **Day 36 · Day 84** 에 다시 떴다.

두 대사에 `!firstPlayDone` 을 걸어 첫 플레이 전용으로 묶고, 비는 자리에 **회전 구간용 작은 말**을 새로 뒀다.
같은 사실을 다른 사람이 말한다 — 그 사이에 겪은 것이 그 차이다.

```js
chatCropAgain: [
  { who: 'jachwi', text: '오늘도 하얀 게 올라와 있다.' },
  { who: 'moni',   face: 'curious', text: '이제 안 놀라네.' },
  { who: 'jachwi', text: '놀랄 일은 아니지. 좋은 일이지.' }
],
```

## 2-6. `movedInOneroom` — **③ 원룸의 첫 장면을 새로 썼다** (빈 사건 채움)

1-2 에서 화면으로 잡은 그 구멍이다. `EVENT_SCRIPT` 에 `moved_in_oneroom` 을 넣고
`EVENT_ORDER` 맨 뒤(`moved_out` **다음**)에 세웠다 — 순서가 뒤집히면 도착해서 인사하고 나서 짐을 싼다.

쓸 때 지킨 것 넷:

| | |
|---|---|
| ① 짧다 | `moved_out`(13줄)과 **같은 턴에 이어서 열린다.** 길게 쓰면 스무 줄 넘는 덩어리가 된다 → 9줄 |
| ② 미화하지 않는다 | 슬롯이 **14칸 → 11칸으로 줄고**(story_arc §③), 월세가 **20만 → 35만으로 오른다**(`homes.json`) |
| ③ 그래도 하나는 진짜로 늘었다 | 등 없이 `min 3.0` 을 넘는 자리가 **처음 한 칸 생긴다**(반지하 avg7 2.42 → 원룸 3.07) |
| ④ 규칙 전환을 알린다 | 확정 무늬가 끝나고 무늬는 **빛으로만** 난다(story_arc §4-1) |

```js
movedInOneroom: [
  { who: 'jachwi', face: 'surprise', text: '…창이 눈높이에 있네.' },
  { who: 'moni',   face: 'happy',   text: '높지. 지나가는 사람 발만 보이지는 않아.' },
  { who: 'jachwi', text: '박스를 푸니까 금방 찬다. 놓을 데는 저기가 더 많았나.' },
  { who: 'moni',   face: 'curious', text: '줄었어. 대신 하나 늘었고 — 등 없이 자라는 자리.' },
  { who: 'moni',   text: '저 방엔 한 칸도 없었어. 여긴 한 칸 있어.' },
  { who: 'jachwi', face: 'tired',   text: '…월세는 서른다섯이 됐고.' },
  { who: 'moni',   face: 'sad',     text: '응. 그건 오른 거 맞아.' },
  { who: 'moni',   face: 'curious', text: '그리고 여기서부터 무늬는 아무도 안 줘. 어디에 두느냐로만 나와.' },
  { who: 'jachwi', text: '…자리로 만드는 건 해 봤어.' }
],
```

⚠ **슬롯을 14칸 이상으로 올리면**(story_arc §③ 권고1 · §④ ㉮) *"줄었어"* 가 거짓이 된다.
**슬롯을 고치는 날 이 대사도 같이 고쳐야 한다.** `story_arc.md` §4-1 에도 적어 두었다.

## 2-7. `beansprout_harvest_again` — **일부러 안 채웠다.** 이유를 적는다

`first_play.js` 가 첫 수확과 그 뒤의 수확을 다른 사건으로 가르면서 스스로 적어 둔 자리다 —
*"두 번째부터는 아무 말도 안 하는 날이 된다."* 채우려다 그만뒀다.

- 회전이 5일이라 **한 판(실측 125일)에 스무 번 넘게** 난다. 사건 대사를 붙이면 같은 말이 스무 번 나온다.
- 그렇다고 `REPEATABLE` 에서 빼면 더 나쁘다 — storyteller 는 id 를 돌려주는데 대화 상자가 막아,
  **검사에는 "말한 날"로 잡히고 화면은 조용한** 상태가 된다. START-HERE §2 가 제일 위험하다고 한 모양이다.

→ 그 자리는 **작은 말**(`chatCropAgain` · §2-5)로 채웠다. 작은 말은 조용한 날에만 나오므로 반복이 리듬이 된다.

## 2-8. 주석만 고친 것 셋 — **주석이 데이터와 어긋나 있었다**

| 어디 | 예전 주석 | 사실 |
|---|---|---|
| `chatLowCash1/2` | *"한 달 치(60만) 아래로 내려가면"* | 코드는 **30만**이다. 60만은 하루 지출 20,000원 시절의 한 달. 지금 하루 16,667원이라 30만은 **열여드레치** |
| §2 배움 넷 | *"★한 줄씩이다"* | `learnPlantWindow` 만 **세 줄**이다. 거기서만 "창턱이라서가 아니라 밝아서"를 짚어야 다음 집에서 쓴다 |
| `monsteraStalled` | (없음) | **아무 데서도 안 불린다** — 아래 §3 |

---

# 3. 판단필요

## ★ ① `monsteraStalled` 가 죽어 있고, **검사가 그것을 정상으로 못 박고 있다**

저장소 전체를 훑어 확인했다. `EVENT_SCRIPT` 에도 `CHATTER` 에도 없고 `game.html` 도
`dlgOpen('monsteraStalled')` 를 안 한다. 그런데 `tools/test_dialogue_coverage.mjs:475` 의
「쓰이지 않는 대사가 없다」 검사가 이 이름을 **`used` 목록에 손으로 박아 두어** 통과시킨다.

하는 일은 2026-08-09 에 들어온 `monsteraGuideWindow`(`monstera_no_spear`)가 이미 한다.
**지우는 것이 맞아 보인다.** 다만 검사 파일이 이 창 소유가 아니라 손대지 않았다.

지울 때 붙일 것 — `tools/test_dialogue_coverage.mjs:475`

```
-     'god1', 'intro', 'cropPlaced', 'monsteraMoved', 'monsteraStalled',
+     'god1', 'intro', 'cropPlaced', 'monsteraMoved',
```

(`SCRIPTS.monsteraStalled` 를 안 지우고 이 줄만 지우면 검사가 FAIL 로 **드러난다** — 그 편이 안전하다.)

## ★★ ② Day 48 — **첫 플레이의 정점이 월세 고지에 먹힌다**

실측에서 한 날에 **네 사건 16줄**이 연달아 떴다:

```
말린 새순 → 배움④ → 첫 월세 → 이사 자금 얘기
"자리를 옮긴 것뿐인데 말이지."(식물신)  ← 튜토의 정점
"이십만 원. 들어오자마자 한 번에 빠져나갔다."  ← 0.5초 뒤
```

`EVENT_ORDER` 는 **무엇이 먼저인가**만 정하고 **하루에 몇 개까지 말할까**는 아무도 안 정한다.
그래서 첫 플레이가 끝나는 날에 살림 시계가 같이 시작되면 늘 이렇게 겹친다.

고칠 수 있는 자리는 셋인데 **셋 다 이 창 소유가 아니다** —
`tutorial.rentFirstDueDay`(첫 월세를 하루 미룬다) · `game.html`(한 턴에 여는 대사 수를 끊는다) ·
`dialogue.QUIET_DAYS_BEFORE_CHATTER` 옆에 「한 턴 상한」을 두는 것. **박사님 판단이 필요하다.**

## ③ ④ 엔딩이 **화면에 없다**

`game.html` 이 `src/game/ending.js` 를 **한 번도 안 읽는다.** import 도 버튼도 없다.
코어(`endingView` · `finishEnding`)와 검사(`test_ending_flow` 16/16 통과)는 서 있는데 그 앞에 화면이 없다.
그래서 `ending_ready` · `ending_home` 은 나도 아무 데도 안 닿는다.

**대사도 일부러 안 썼다.** 목표 금액이 `ENDING_RULES.targetWon = null` 로 미확정인데
(story_arc §4-2 ⏸) 지금 지어 두면 「검사는 통과하는데 화면엔 안 뜨는 대사」가 하나 더 늘 뿐이다.
**화면과 금액이 정해질 때 같이 쓴다.**

## ④ 계절 ↔ 빛 오프셋 (이미 올라와 있는 것)

`autumnCame`·`winterCame` 이 참이 되려면 계절이 빛에 걸려야 한다(`story_arc` §5 ★★ · 오프셋 135일).
§2-4 에서 문장을 예고로 낮춰 **거짓말은 면했지만**, 몬이가 예고한 일이 안 일어나는 것은 그대로다.

---

# 4. 못 한 것

- **`game.html` 을 안 고쳤다**(지시). 그리고 **고칠 것이 없었다** — 배선은 이미 다 붙어 있다.
  §3-① 의 검사 한 줄만 다른 창이 붙이면 된다.
- **겨울 구간을 화면으로 못 봤다.** 경로 A 로 125일에 이사해서 겨울에 안 갔다(§1-2 못 본 것).
- **식물등을 산 판을 화면으로 못 봤다**(`lampBought`).
- **원룸 안(③)을 못 봤다.** 도착 대사가 뜨는 것까지만 확인했고, 그 뒤의 원룸 살림은 안 굴렸다.
- **④ 엔딩 대사를 안 썼다**(§3-③ 이 이유).

---

# 5. 검사

## ★ 고친 뒤 **화면으로 다시 확인했다** — 「고쳤다」를 화면 없이 안 쓴다

같은 조건(서버 8963 · 새 판 · 경로 A)으로 한 번 더 굴렸다. **게임 127일에 이사.** 대사 201줄.
아래 다섯이 **화면에 실제로 떴다**:

| 게임일 | 확인한 것 |
|---|---|
| 25 | `chatCrop1` — **첫 플레이 중에만** 뜬다(고치기 전에는 Day 84 에도 떴다) |
| 51 | `shortMoney` — *"**이백만 원.** 보증금이랑 첫 달 월세랑 이삿짐값."* |
| 53 · 이후 | `chatCropAgain` — *"오늘도 하얀 게 올라와 있다."* (첫 플레이 뒤 자리를 실제로 받았다) |
| 74 · 104 | `rentSoon` — *"**이레 남았어.** 이십만 원."* / *"…알아. 나도 세고 있었어."* |
| 94 | `autumnCame` — *"**겨울로 갈수록 창 하나로는 모자라져.**"* |
| **127** | **`movedInOneroom` 이 `movedOut` 바로 뒤에 이어서 떴다** — *"…창이 눈높이에 있네."* 부터 *"…자리로 만드는 건 해 봤어."* 까지 9줄 |

★ **이사 장면이 이제 22줄 연속**이다(13 + 9). 길지만 **한 번뿐**이고 구간이 갈리는 자리라 그대로 뒀다.
길다고 판단되면 `movedInOneroom` 을 다음 [다음 날]로 미루는 방법이 있는데,
그건 `game.html` 쪽 일이라 손대지 않았다.

| | 전 | 후 |
|---|---|---|
| `tools/test_dialogue_coverage.mjs` | PASS (전 항목) | **PASS (전 항목)** |
| 최장 침묵 A·B·C | 각 2일 | **각 2일 (그대로)** |
| A 이사 / B 이사 / C 마지막 | Day 109 / 111 / 220 | **그대로** |
| `tools/test_first_play.mjs` | — | PASS |
| `tools/test_tutorial.mjs` | — | PASS |
| `tools/test_oneroom.mjs` | — | PASS |
| `tools/test_ending_flow.mjs` | — | PASS (16/16) |

★ **대사 개수·순서를 박아 둔 검사는 셋이었다.** 고치기 전에 확인했다 —
`⑸` 식물신 대사가 정확히 **3줄**이고 나오는 자리가 `god1`·`movedOut`·`spearFurled` **셋뿐**,
`⑹` `movedOut` 이 **8줄 이상**이고 마지막 말은 몬이가 하며 **「창」이 들어가야** 하고,
`데이터 — 쓰이지 않는 대사가 없다` 가 `EVENT_SCRIPT`·`CHATTER`·손으로 박은 목록으로 대조한다.
새 대사(`movedInOneroom`·`chatCropAgain`)는 셋 다 안 건드리게 넣었고, **돌려서 확인했다.**

# 6. 손댄 파일

| | |
|---|---|
| `src/game/dialogue.js` | §2 전부 |
| `docs/story_arc.md` | §4-1 에 「도착 장면 — 대사가 붙었다」 · §4-2 에 「④는 아직 화면에 없다」 |
| `docs/handoff/story2-to-plan.md` | 이 파일 |

`game.html` 은 **읽기만 했다.** 커밋도 안 했다.
