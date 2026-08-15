# 2026-08-17 · quest2 → plan

> START 23:23:06 · END 00:03:39 (40분)
> 박사님 요청: *"스토리랑 가이드를 보강하고, **퀘스트를 신규로 넣어서** 약간의 추가 가이드를 넣자.
> **나오는 얘기가 목적성이 부족하대** 사람들 말이."*

---

# 0. ★★★ 「말이 안 나오는 구간」 표 — **먼저 이것부터**

> 박사님이 이것부터 보실 것이라 맨 앞에 둔다.
> ⚠⚠ **찾으라고 하신 것이 안 나왔다. 대신 다른 것이 나왔고 그게 더 크다.**

반지하 한 판을 **실제로 굴려** 날마다 나오는 말을 전부 받아 적었다
(진짜 코어 `loop.nextDay` + 진짜 `createStoryteller` · novice · 수입 주입 **0**).

### 재 보니 — **조용한 데가 없다**

| | |
|---|---|
| 말 없는 최장 구간 | **2일** |
| 3일 이상 조용한 구간 | **0개** |

`QUIET_DAYS_BEFORE_CHATTER = 2` 라서 이틀 이상은 구조적으로 안 조용하다. **이미 다 메워져 있었다.**

### ★★★ 그런데 이게 나왔다 — **「지금 뭘 해라」를 말하는 줄이 Day 33 뒤로 0 이다**

| 구간 | 날수 | 「지금 뭘 해라」를 말한 날 | 그동안 나온 말 |
|---|---|---|---|
| Day 0~33 | 33일 | **5번** (놓아 봐 · 다시 심어 · 창턱으로 · 등을 살까 · 잘라서 물에) | 첫 플레이 대사 · 배움 넷 · 안내판 |
| ★★ **Day 33~77** | **44일** | ★ **0번** | **전부 작은 말** — 「반지하는 여름에 덥고」 · 「집주인 아저씨가 복도에서」 · 「몬이는 왜 몬이야?」 · 「윗집에서 물 내리는 소리가」 |
| Day 77 | 1일 | 1번(`varieGranted` — *"잘라서 물에 꽂아"*) | 가을·등·확정무늬·등구매가 **한 날에 넷** |
| ★ **Day 93~200** | **107일** | ★ **0번** | 같음. 그동안 **Day 123 에 파산**한다 |

⇒ **「조용해서」가 아니라 「할 말은 있는데 시킬 일이 없어서」**다.
⇒ 그래서 이 일은 **대사를 늘리는 것이 아니라 「할 일」을 늘리는 것**이 됐다.

### ★★★ 그리고 하나 더 — **탈출 조건을 말하는 대사가 한 번도 안 난다**

탈출은 **돈 200만 × 무늬 삽수를 판 적**이다(escapecut 확정). 그런데 `loop.js §③` 이 이렇다:

```js
const state = ts.movedOut ? 'done' : c.ok ? 'ready'
            : c.varie ? 'money'              // 삽수는 팔았고 돈만 남았다
            : c.money ? 'varie' : null;      // null = 둘 다 멀었다. 아직 할 말이 없다
```

시작돈 **150만 < 이사비 200만**이고 무늬 삽수도 안 팔았으니 보통 판은 **처음부터 끝까지 `null`** 이다.

| | 실측 |
|---|---|
| 200일 동안 `move_short_money` | **0건** (아무것도 안 판 판) |
| 200일 동안 `move_short_learn` | **0건** |
| ⇒ 「무늬 삽수를 팔아야 나간다」를 말한 대사 | ★ **0줄** |

아래 한 줄(`tutorialGoal`)만이 「무늬 삽수를 잘라 뿌리내려 팔아 봐야 합니다」를 말하는데,
그 줄은 **무엇을만 말하고 왜·어떻게를 안 말한다.**
⇒ **안 가르쳐 주면 영영 모르는 것**이 실제로 영영 안 나오고 있었다.

### 그리고 대사가 **한 번도 말하지 않는 것 셋** (`grep` 실측)

| 말 | `src/game/dialogue.js` 안 등장 |
|---|---|
| **무순** | ★ **0건** — 확정문이 *"섞어 먹어야 밥이 이득"* 이라고 정한 것을 아무도 안 말한다 |
| **체력** | ★ **0건** — 하루의 상한인데 대사가 그 말을 한 적이 없다 |
| **삽수 자르는 법** | `varieGranted`·`varieSecond` 두 줄이 전부. 「잎 1장이라야 물꽂이」는 없다 |

---

# 1. 바뀐 것

## 1-1. ★ 새 파일 — `src/game/quest.js` (퀘스트 다섯 줄의 정본)

⚠ **새 파일이다.** 쓰기 영역의 ⛔ 목록에 없고, `stamina.js` 에 통째로 넣으면 그 파일이
「체력」과 「할 일」 둘을 갖게 되어 밸런스를 고칠 때 규칙까지 건드리게 된다. 그래서 갈랐다.

| id | 이름 | 여는 자리 | 끝나는 자리 | 가르치는 것 | 보상 |
|---|---|---|---|---|---|
| `crop_mix` | 한 상에 두 가지 | **첫 플레이가 끝난 날**(실측 D33) | 밥상에 **두 작물**이 오른다 | 무순은 밝은 데 · **섞어 먹어야 이득** | 체력 +1 |
| `siru5_cycle5` | 시루 다섯, 다섯 바퀴 | ①을 끝낸 뒤 | 시루 5개 × 5바퀴 | 물은 한 번에 하나 · **체력이 천장** | 체력 +1 |
| `first_cut` | 물에 꽂아 본다 | 모주 잎 **2장** | 물꽂이가 **뿌리를 낸다** | **잎 1장까지 쪼개야 물꽂이** | 체력 +1 |
| `varie_bright` | 밝은 데서 뿌리내리기 | **무늬 잎**이 난 날 | 무늬 삽수가 **밝은 자리**에서 뿌리내림 | **빛이 무늬 등급을 정한다** | ★ 무늬 등급 |
| `sell_varie` | 무늬를 값으로 만든다 | **무늬 삽수를 잘랐을 때** | **판다** | ★ **탈출 = 돈 + 무늬 삽수를 판 적** | ★ 이사가 열린다 |

★ **`siru5_cycle5` 는 새로 만든 것이 아니다.** 2026-08-11 에 이미 붙어 있던 것을
**다섯 줄 중 ②로 편입**했다. 판정도 값도 안 바꿨다 — 달라진 것은 **열릴 때 말을 건다**는 것뿐이다.
(전에는 다 하고 나서야 배너로 알았다. `quest-to-plan §못 한 것` 이 그것을 적어 두었다.)

### ★ 왜 다섯인가 — 재서 정했다

1. **안 가르치던 것이 여덟**이었다(2026-08-17 확정문 셋 + escapecut). 겹치지 않게 묶으니
   **정확히 다섯 덩이**가 된다. `test_quest §⑴` 이 겹침 0을 못 박는다.
2. 빈 구간이 **44일 + 107일**이다. 다섯이면 평균 **30일에 하나 = 월세 주기와 같은 박자**라
   새 눈금을 안 만든다.
3. **첫 33일에는 안 넣는다** — 이미 꽉 차 있다.
⇒ 넷이면 44일을 못 메우고, **여섯이면 첫 플레이를 침범해 심부름 목록이 된다.**

### ★★ 보상 — 있는 것만 썼다 (새 계통 0개)

- **최대체력 +1** 셋 (`stamina.grantStaminaQuest` — 이미 있던 창구). **5 → 8.**
  자연 레벨업으로 5→8 은 **45회**(시루 5개면 약 9일)라 판을 뒤집는 크기가 아니다.
- ★ **④⑤ 는 0 이고 그게 뜻이다.** ④의 보상은 **무늬 등급**(산반 35만 → 풀문 115만),
  ⑤의 보상은 **이사가 열리는 것**이다. 세상이 이미 크게 주는 자리에 체력을 얹으면
  **진짜 보상이 가려진다.**

### ★★ 세이브에 새 칸이 **0개**다

`save.js` 는 ⛔ 목록이다. 그래서:
- **끝낸 것** = `S.stamina.questsTaken` — **이미 저장되는 칸**
- **열린 것** = 기억 안 한다. 스냅샷에서 매번 다시 센다
- 「방금 열렸다」 = `S._questOpen` — `_` 라 안 실린다(`loop.js §ts._moveState` 와 같은 수법)

⇒ **`save.js` 를 한 줄도 안 고쳐도 된다.** `test_quest §⑸` 가 그 사실을 못 박는다.

## 1-2. `src/game/dialogue.js` — 새 대사 **열 가지** (§5.5)

열림 다섯 · 완료 다섯. 지도는 `QUEST_OPEN_SCRIPT` · `QUEST_DONE_SCRIPT` 이고
`scriptOf` 가 `season`·`rent` 와 **같은 모양**으로 갈린다.
`EVENT_ORDER` 에 `'quest_done', 'quest_opened'` 를 **확정 무늬 뒤 · 이사 판정 앞**에 넣었다
(같은 날 겹치면 「끝냈다」가 「열렸다」보다 먼저라야 하고, 둘 다 `move_ready` 앞이라야
「팔렸다 → 그래서 나갈 수 있다」가 된다).

⚠ **숫자를 대사에 안 박았다.** 「시루 다섯 개」·「이백만 원」은 전부 정의에서 나와
**아래 한 줄**이 말한다. 대사는 **왜 그 일을 하는지**만 말한다 — 값이 움직여도 안 낡는다.

## 1-3. `src/game/stamina.js` — 값 넷 추가

`STAMINA_RULES.quests` 에 `crop_mix:1 · first_cut:1 · varie_bright:0 · sell_varie:0`.
⚠ 정본은 여전히 `data/balance/stamina.json` 이다(⛔ 목록이라 못 건드렸다). 그 파일에 없는 id 는
`staminaRulesFrom` 이 밑값을 먼저 펴므로 **여기 값이 산다** — 안 사라진다.

## 1-4. 검사

- **새로** `tools/test_quest.mjs` — 19줄. 표·대사·값 셋이 어긋나면 잡는다
- **고침** `tools/test_dialogue_coverage.mjs` — 「쓰이지 않는 대사」 목록을 **손으로 안 적고**
  두 지도에서 읽게 했다. ★ 손으로 적으면 줄이 늘 때마다 목록이 낡고, 그게 START-HERE §2 가
  *"제일 위험하다"* 고 적은 모양(고장난 상태를 검사가 정상으로 못 박는 것)의 씨앗이다

## 1-5. 문서

- `docs/story_arc.md` **§1-5 신설** — 다섯 줄이 ①의 어디를 메우나
- `docs/player_guide.md` **G-27 신설** — 아래 한 줄이 「지금 할 일」을 말하는 구간 (판정 ✕ → P-11)
- `docs/handoff/plan-2026-08-17-quest.md` **확정문 신설** — ★ **화면에 붙일 코드가 코드째로 §5 에 있다**

---

# 2. 실측 — **날짜별로 나온 말 전부**

## 2-1. 재는 자를 먼저 적는다 (§2 규칙 1)

| 켠 것 | 끈 것 |
|---|---|
| 진짜 코어 — `state.newState` · `loop.nextDay` · `loop.harvestCrop` · `first_play` · `tutorial` | `game.html`(화면) — 별도로 잰다(§2-3) |
| 진짜 조도 — `room_profile.banjiha` · **novice**(맑음·여름 고정 ⇒ peak 가 곧 실제값) | 날씨 굴림(`real`) |
| 진짜 대사 — `createStoryteller` 하나. 화면이 쓰는 그 창구다 | — |
| ★ **수입 주입 0원** | ⚠ `test_dialogue_coverage` 는 하루 24,300원을 넣는다. 그건 「대사가 다 나오나」를 재려고 넣은 것이지 **실제 판이 아니다** |
| growth 는 **대역** — `test_dialogue_coverage` 것을 그대로 썼다 | ⚠ 그래서 `varie_lucky`·`varie_lucky2`(프롤로그 무늬 두 장)가 **이 재현에서는 안 난다.** 아래 표에 그 둘이 없는 것은 게임이 아니라 대역 탓이다 |

## 2-2. ② 시키는 대로 다 한 판 (자르고 · 뿌리내리고 · 판다 · 수입 0)

`ev[…]` 는 그날 난 사건, `·` 는 그날 나온 대사다.

```
D  3  ·chatCrop1                            1,500,000원
D  5  ev[beansprout_harvest,learn_harvest,learn_cropDark]
        ·harvest ·learnHarvest ·learnCropDark
D  8  ·chatCrop2
D 11  ev[beansprout_harvest_again]  ·chatSummerHeat
D 14  ·chatSummerDamp
D 17  ev[monstera_arrived]  ·chatQuiet ·god1 ·monsteraArrived
D 18  ev[learn_plantWindow]  ·learnPlantWindow
D 21  ·chatGrowing1
D 24  ·chatGrowing2
D 27  ·chatMoniName
D 30  ·chatMorning
D 33  ev[spear_furled,rent,learn_spear]  ·spearFurled ·learnSpear ·rentFirst   ← ★ 첫 플레이 끝
────────────────── 여기부터 44일 동안 「할 일」이 0 ──────────────────
D 36  ·chatDailySpend            D 39  ·chatCropAgain
D 42  ·chatParents               D 45  ·chatLandlord
D 48  ·chatNeighbor              D 51  ·chatSummerHeat
D 54  ·chatSummerDamp            D 56  ev[rent_soon] ·rentSoon
D 59  ·chatQuiet                 D 62  ·chatGrowing1
D 63  ev[rent] ·rentAgain        D 66  ·chatGrowing2
D 69  ·chatMoniName              D 72  ·chatMorning
D 75  ·chatDailySpend
D 77  ev[lamp_unlocked,season,varie_granted,lamp_bought]        ← ★ 한 날에 넷이 몰린다
        ·autumnCame ·lampUnlocked ·varieGranted ·lampBought
D 80  ·chatAutumnShort           D 83  ·chatAutumnDust
D 86  ev[rent_soon] ·rentSoon    D 89  ·chatAutumnAngle
D 92  ev[market_contact] ·chatCropAgain      ← 무늬 삽수가 팔린 날(대사 없음)
D 93  ev[rent,move_short_money]  ·rentAgain ·shortMoney         ← ★ 이 판에서 「할 일」의 마지막
────────────────── 여기부터 107일 동안 「할 일」이 0 ──────────────────
D 96  ·chatParents               D 99  ·chatLandlord
D102  ·chatLowCash1              D105  ·chatLowCash2
D108  ·chatNeighbor              D111  ·chatQuiet
D114  ·chatGrowing1              D116  ev[rent_soon] ·rentSoon
D119  ·chatGrowing2              D122  ·chatMoniName
D123  ev[rent,broke] ·rentAgain ·brokeTalk            ← ★ 파산. 소지금 0원
D126~D165  ·chatMorning ·chatDailySpend ·chatAutumnShort ·chatAutumnDust
           ·chatAutumnAngle ·chatParents ·chatLandlord ·rentSoon ·chatLowCash1
           ·chatLowCash2 ·rentAgain ·chatNeighbor ·chatQuiet ·chatGrowing1 ·chatGrowing2
D167  ev[season] ·winterCame     D170  ·chatWinterCold
D173  ·chatWinterWindow          D176  ev[rent_soon] ·rentSoon
D177  ev[winter_still] ·winterStill
D180~D198  ·chatMoniName ·rentAgain ·chatMorning ·chatDailySpend
           ·chatParents ·chatLandlord ·chatLowCash1
────────────────── Day 200 · 이사 못 함 · 소지금 0원 · 배움 4/4 ──────────────────
```

★ **최장 침묵 2일.** 조용한 데가 없다. **그런데 D33 뒤로 「할 일」이 없다.**

## 2-3. ① 아무도 안 가르쳐 준 판 (안 자르고 · 안 팔고 · 말 듣고서야 옮김)

같은 모양이다. 다른 것만 적는다:

| | |
|---|---|
| D21 | `plant_stalled` — *"며칠째 그대로야"* (자리를 안 불러 준다) |
| **D27** | `monstera_no_spear` → `monsteraGuideWindow` — ★ *"창턱."* 여기서 처음 자리를 불러 준다 |
| D29 | 옮겼더니 `plant_resumed` · `learn_plantWindow` |
| D88 | `lamp_unlocked` · D95 `lamp_skipped` |
| **D134** | `broke` — 파산 |
| ★ | `varie_granted` 가 **안 난다**(삽수를 한 번도 안 잘라서 — 확정 무늬 조건 ③) |
| ★★ | `move_short_*` 가 **0건.** 200일 내내 「나가려면 뭘 해야 하는지」를 아무도 안 말한다 |

## 2-4. ★ 화면 실측 (폰 390×844 · 새 판 · `?fast=1`)

코어 재현이 맞는지 **진짜 화면**으로 확인했다. 대사를 **한 줄씩** 눌러 받아 적었다
(`#dlgSkip` 을 안 눌렀다). D0~D9 는 코어와 **글자까지 같다.**

```
D0  지금할일: 가방의 콩나물 시루를 방 안 어두운 자리에 놓아 보세요…
    [부팅] 나|…불도 잘 안 드는 방이네. → … → 몬이|응. 어두운 자리도 쓸모가 있거든.  (13줄)
    [놓은 뒤] 몬이|좋아. 나흘이면 먹을 수 있어.
D0  지금할일: 놓은 시루에 [🌱 심기]를 눌러 콩 씨앗을 뿌려 주세요 — 심어야 5칸이 생깁니다.
D3  (배너) 콩나물 씨앗을 심었습니다
D4  지금할일: 시루에 물을 주면 칸이 돌기 시작합니다
D5~D8 지금할일: 콩나물이 자라는 중입니다. 수확까지 4·3·2·1일.
D6  나|콩나물이 진짜 자랄까. / 몬이|어두운 데 뒀으면 자라.
D9  나|뭔가 하얀 게 올라왔어. … 몬이|내일 아침에 열어 봐.
D9  [수확] 나|…이게 되네. / 몬이|어두운 자리라 하얗게 잘 자랐어… / 몬이|밥값을 네가 아니라 얘가 냈어.
        / 몬이|이거 하나는 이제 아는 거다 — 어두운 자리도 자리야.
D9  지금할일: 5일이면 한 판입니다 · 식비 5,000원을 아꼈습니다
D10 지금할일: 씨앗을 주문하세요 — [상점]에서 1일 뒤에 옵니다.
D11~D34  ★ 지금할일이 **25일 동안 한 글자도 안 바뀐다** (「씨앗을 주문하세요」)
         그동안 뜬 대사 — 벽에서 눅눅한 냄새 / 이 방은 조용하다 / 몬이는 왜 몬이야? /
                        아침에 일어나서 / 반지하는 여름에 덥고 … (전부 살림 잡담)
```

⚠⚠ **정직하게 적는다 — D10 부터 멎은 것은 내 하네스 탓이 절반이다.** 이 재현이
씨앗을 안 시켰다(진짜 사람은 시킨다). ⇒ **「25일 멎는다」를 게임의 사실로 읽지 마라.**
★ 그래도 이것은 참이다 — **아래 한 줄이 시킨 일과 그날 나온 대사가 아무 관계가 없다.**
그 스물다섯 줄 중 씨앗을 한 번이라도 가리킨 대사는 **0줄**이다.

## 2-5. ★ 「그래서 지금 뭘 하지?」가 되는 자리 — 표

| 언제 | 플레이어가 지금 아는 것 | 해야 하는 것 | 게임이 그걸 말하나 |
|---|---|---|---|
| D0~D9 | 어두운 데 놓기 · 심기 · 물 | 그대로 | ○ 대사·안내판·말풍선·아래 한 줄 넷이 다 말한다 |
| D10~D17 | 다시 심기 | 씨앗 주문 → 다시 심기 | ○ (G-06a) |
| D17~D29 | 몬스테라가 왔다 | 창턱으로 옮기기 | ○ (D27 `monsteraGuideWindow`) |
| ★★ **D33~D77** | **없다** | 시루를 늘린다 · **무순을 산다** · **섞어 먹는다** · **삽수를 잘라 본다** | ✕ **44일 동안 0줄** |
| D45~ (아래 한 줄) | 「무늬 삽수를 잘라 뿌리내려 팔아 봐야 합니다」 | 병 사기 → 자르기 → 12일 → 내놓기 → 연락 → 거래 | △ **목표만. 방법 0** |
| 무순 | — | 밝은 칸에 무순 · 어두운 칸에 콩나물 | ✕ **대사 등장 0건** |
| 체력 | — | 손이 하루의 천장이다 | ✕ **대사 등장 0건** |
| 삽수 | — | **잎 1장까지 쪼개야** 물꽂이 | ✕ |
| 무늬 등급 | — | **밝은 데 둬야** 좋은 등급 | △ `varieSecond` 한 줄뿐 |
| ★★★ **탈출** | — | 돈 200만 **+ 무늬 삽수를 판 적** | ✕ **대사 0줄** · 아래 한 줄만 |
| ★ **D93~끝** | **없다** | (파산 중) | ✕ **107일 동안 0줄** |

★ **말 안 하는 칸이 곧 퀘스트 자리다.** 다섯 줄이 그 칸들을 하나씩 맡는다.

---

# 3. 검사

| 검사 | |
|---|---|
| ★ **`test_quest`** (새것) | **PASS** 19/19 |
| `test_dialogue_coverage` | **PASS** (고친 뒤) |
| `test_stamina` · `test_stamina_xp` · `test_tutorial` | **PASS** |
| `test_first_play` · `test_quiet` · `test_uiwire` · `test_escapecut` · `test_prologue_varie` | **PASS** (전부 브라우저) |
| `game.html` 부팅 예외 | **0** (`test_quiet`·`test_uiwire` 가 잰다 · `_chk_boot` 별도 확인) |

⚠ **`game.html` 을 한 글자도 안 고쳤다.** 그래서 위 브라우저 검사들은
「고장 안 났나」만 재고 **퀘스트가 화면에 도는가는 아직 아무도 안 쟀다**(§5 못 한 것).

---

# 4. ★ 판단필요

### ① ★★ **화면 배선을 붙일지 — 이것이 정해져야 이 일이 산다**
코어는 다 됐고 `game.html` 만 남았다. 붙일 코드는
**`docs/handoff/plan-2026-08-17-quest.md` §5 에 다섯 조각(ⓐ~ⓔ) 코드째로** 있다.
⚠ **절반만 붙이면 안 된다** — ⓐ만 붙이면 판정이 안 돌고, ⓒ만 붙이면 대사가 안 난다.
⚠ 특히 **ⓒ-②(하루가 간 직후)** 를 빼면 **③④⑤ 가 영영 안 열린다**(①②만 수확에 걸린다).

### ② **퀘스트를 목록으로 보여 줄지 · 진행도(3/5)를 보여 줄지**
지금은 **하나만** 보여 준다(`questView().next`). 목록을 내면 심부름 목록이 된다고 봤다.
진행도는 `siru5_cycle5` 만 셀 수 있고 나머지 넷은 참/거짓이라 한 줄에 두 모양이 섞인다.
**화면 결정이라 박사님 몫이다.**

### ③ **체력 5 → 8 이 밸런스를 움직인다**
퀘스트 셋이 +1씩 준다. 자연 레벨업으로 45회(≈9일)에 해당하는 크기다.
**`test_banjiha_routes` 전·후를 재야** 이사 성공률에 얼마나 닿는지 안다 — 이 창은 안 쟀다.
⚠ escapecut 이 이미 성공률을 **78% → 20%** 로 떨어뜨려 놓았다(§4 판단필요 ①).
체력 +3 은 그 반대 방향이라 **같이 봐야 한다.**

### ④ ★ **`shortMoney` 첫 줄이 이제 거짓말이다**
*"배울 건 다 배웠어. 남은 건 돈이야."* — 탈출 조건이 **배움 넷 → 무늬 삽수 판매**로
바뀌었는데(escapecut) 이 줄은 그대로다. 지금 뜨는 자리는 「삽수는 팔았고 돈만 남았다」라
**우연히 뜻이 맞지만**, *"배울 건 다 배웠어"* 는 배움이 조건이던 시절의 말이다.
⇒ 고치려면 **문장을 바꿔야** 하는데 그게 `shortMoney` 의 톤을 건드린다. **안 건드렸다.**
  ★ 다만 `questDoneSellVarie` 가 *"이제 남은 건 돈뿐이야"* 로 그 자리를 한 번 더 짚어 준다.

### ⑤ **`data/balance/stamina.json` 에 값 넷을 같이 적어야 한 벌이 된다**
`data/*` 는 이 창의 ⛔ 라 밑값(`stamina.js`)에만 넣었다. 정본은 그 json 이다.
⚠ 그 파일 63~64행 주석이 아직 *"판정이 안 붙었다"* · *"시루 5개를 **분배로** 5주기"* 라고
적혀 있다 — **둘 다 낡았다**(2026-08-11 에 판정이 붙었고 「분배로」는 안 잰다). 같이 고쳐라.

### ⑥ **⑤ 식물등은 일부러 퀘스트로 안 만들었다**
식물등은 **정답이 아니라 선택**이다(`story_arc §4`). 퀘스트로 만들면 「사야 하는 것」이 된다.
G-12 가 적은 「아래 한 줄이 한 번도 안 말하는 셋」 중 **식물등만 그대로 남는다.** 맞다고 봤다.

---

# 5. 못 한 것

- ⛔ **`game.html` 을 안 고쳤다** — 이 창의 ⛔ 목록이다. 코드는 확정문 §5 에 다 있다.
  ⇒ **지금 상태로는 퀘스트가 화면에서 한 번도 안 돈다.** 코어와 검사만 서 있다.
- ⛔ `data/balance/stamina.json` 에 값 넷을 못 넣었다(위 판단필요 ⑤)
- ★ **사람이 화면에서 한 판을 끝까지 몰아 본 적이 없다.** 화면 실측은 **D34 까지**다
  (그 뒤는 코어 재현이다). 확정문 §6 에 「붙인 뒤 반드시 재라」로 다섯 개를 적어 두었다
- ⚠ **`varie_lucky`·`varie_lucky2` 가 재현에서 안 났다** — growth 대역이 잎을 안 내서다.
  그래서 **③`first_cut`·④`varie_bright` 가 실제 판에서 며칠에 열리는지는 못 쟀다**
  (`test_quest` 는 스냅샷으로만 잰다). 붙인 뒤 진짜 엔진으로 재야 한다
- `tools/test_balance_routes.mjs` 5건 미해결 — **이 창이 손대기 전에도 같았다**(escapecut §7)
- 임시 도구 둘(`tools/_probe_quest_say.mjs` · `_probe_quest_screen.mjs`)은 **지웠다**

---

# 6. ★ 새 대사 중 제일 마음에 드는 세 줄

```
몬이  이사비 한 번, 그리고 **무늬 삽수를 팔아 본 적.**
      나    팔아 본 적? 갖고만 있으면 안 돼?
몬이  안 돼. **값이 매겨져 봐야 그게 값이야.**          ← questSellVarie
```

```
      나    손이 두 배로 가는데.
몬이  그래서 손이 늘었잖아. 방금.                        ← questDoneCropMix
```
(★ 체력이 오른 것을 **배너가 아니라 대사가** 짚는다. `stamina.js §경험치` 가
 *"조용히 오르면 보상이 아니다"* 라고 적어 둔 그 자리다.)

```
      나    손?
몬이  하루에 물 줄 수 있는 횟수. **그게 이 방에서 제일 모자란 거야.**   ← questSiru5
```
(★ `dialogue.js` 에서 **「체력」이라는 것을 말하는 첫 줄**이다. 전에는 0건이었다.)

덤으로 하나 더 — 이 구간에서 「그래서 이제 뭘 하지」가 다시 안 나오게 하는 줄:
```
몬이  아까 그거 한 번 더 하면 돼. **길은 이제 알잖아.**    ← questDoneSellVarie
```

---

# 7. 손댄 파일

| 파일 | |
|---|---|
| **신설** `src/game/quest.js` | 퀘스트 다섯 줄의 정본 (순수 · DOM 도 코어 API 도 안 부른다) |
| `src/game/dialogue.js` | §5.5 새 대사 10 · `QUEST_OPEN_SCRIPT`/`QUEST_DONE_SCRIPT` · `scriptOf` · `EVENT_ORDER` |
| `src/game/stamina.js` | `STAMINA_RULES.quests` 에 값 넷 |
| **신설** `tools/test_quest.mjs` | 19줄 |
| `tools/test_dialogue_coverage.mjs` | 「쓰이지 않는 대사」를 손으로 안 적고 지도에서 읽게 |
| `docs/story_arc.md` | §1-5 신설 |
| `docs/player_guide.md` | G-27 신설 · 머리말 갱신 |
| **신설** `docs/handoff/plan-2026-08-17-quest.md` | 확정문 (★ 화면 배선 코드 포함) |
| **신설** `docs/handoff/quest2-to-plan.md` | 이 문서 |

**읽기만 했다** — `game.html` · `loop.js` · `tutorial.js` · `first_play.js` · `propagation.js` ·
`shop.js` · `save.js` · `state.js` · `data/*`
