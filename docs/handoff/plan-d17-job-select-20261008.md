# 직업 선택 본편 — 최소판 밑그림 (D17 · plan 초안 · 2026-10-07)

> 표식: [잰 것]=코드·데이터에서 읽음(file:line) · [셈]=읽은 값으로 계산 · [짐작]=추정. 수를 짓지 않았다. 저장소에 없으면 «없음 — 박사님 몫».
> 결정 자리: `docs/handoff/master-campaign-20261007.md:66` D17 「엔딩이 서면 plan 이 최소판을 기획」 [잰 것]. 지금 상태는 「기획만(`story_arc.md §0`)」(같은 파일 :17) [잰 것].
> ⓪ [plan] 검수(10-08 01시) — 일꾼(Fable) 초안을 근거째 읽어 그대로 올린다. §3 의 여덟 물음은 «박사님 몫»이고, 엔딩 화면(D9 목표 금액)이 서기 전에는 묻지 않는다(D17 「엔딩이 서면」). 최소판의 뼈대 — «카드는 데이터가 있는 넷 · 고를 수 있는 것은 판정이 있는 돈 축 둘 · 새 판으로 시작» — 은 plan 뜻이다.

## 1. 이미 정해진 것

| | 출처 | 내용 |
|---|---|---|
| 때 | `docs/story_arc.md:46` [잰 것] | 박사님: *"튜토 시에는 직업 선택이 없는 걸로. 어차피 빨리 끝나니까. 끝나고서는 제대로 직업 선택해서 하는 걸로."* |
| 범위 | `story_arc.md:47` [잰 것] | 자취생 고정 범위 = *"튜토 및 초보 엔딩까지"* · 흐름도 :50-52 「④내 집 마련 엔딩 ← 여기까지 자취생 고정 → 본편 — 직업을 고르고 시작」 |
| 왜 뒤인가 | `story_arc.md:57` [잰 것] | 「직업은 **시작 자금·슬롯·수입**을 가르는 축이다 … 한 번 끝까지 가 보고 나면 … 그때 고르는 것이 선택이다」 |
| 코드 경계 | `src/game/ending.js:169-174, 193` [잰 것] | `finishEnding` 은 `nextChapter: 'job_select'` 만 반환. 「여기서 직업 상태를 만들면 정본이 둘이 된다」. `story_arc.md:609-610` 도 같은 말 |
| 본편의 시간·잎 | `story_arc.md:33-38, 41-42` [잰 것] | 스토리 뒤(자유·고수) = 배속·1:1 · 낙엽·고사 켜짐. `oneroom.storyRunning` 이 엔딩에서 false(`src/game/oneroom.js:105-109`) → 초보 모드는 이미 엔딩에서 꺼진다. D1(`master-campaign…:74`): 날씨·계절은 원룸 이사 때, 「잎 안 죽음은 엔딩까지」 |
| 캐릭터 = 설정값 | `docs/GAME_PLAN.md:218` [잰 것] | 「캐릭터 = `data/balance/characters.json` 설정값. 코드 분기 없음」 · 프리셋 표 :290-293 튜토만 「자취생 고정」, 초보·일반·고인물은 「선택」 |
| 종류가 다르다 | `GAME_PLAN.md:177-182, 206` [잰 것] | 자취생·가장·주부 = 돈(경제 게임) · 연구자 = 변이 기록(확률 게임). 엔딩: 자취생=반지하 탈출 / 가장=목표금액→온실 / 연구자=논문 3편 / 주부=드림가든 |
| 직업이 바꾸는 외형 | `docs/handoff/plan-char-remodel-why.md:233-238` [잰 것] | 「직업 7종이 다른 것 ⇒ 옷(상의·하의·신발). 머리는 사람. 피부 고정」 · 캐릭 리모델링은 직업 선택 뒤(`plan-nap-and-sit.md:72-78`) |

**characters.json 이 이미 가진 것** (`data/balance/characters.json`) [잰 것]
- 칸 정의 :34-45 — `startCash` `monthlyIncome` `household` `electricityWaived` `bankruptcy` `goalType`(money/garden/dex/fame/escape/papers) `goalValue` `systems` `startHome` `difficulty`
- 지출 식 :8-13 — 하루 지출 = 월세/30 + utility/30 + 식비×household + 등 전기 · 작물 끼니 상한 = household × 2
- 직업 **넷**(:47-85): 주부(300만·월 200만·4인·apartment·garden·easy) · 연구자(50만·월 60만·1인·전기 면제·greenhouse·papers 3·medium) · 가장(200만·월 80만·4인·classroom·money 1억·파산 있음·hard) · 자취자(100만·0·banjiha·escape 150만·extreme)
- ⚠ 셋은 `balance_provisional: true`(:54, :64, :73). 자취자만 false(:82) — 그런데 그 수가 낡았다: startCash 100만·goal 150만 ↔ `src/game/tutorial.js:41` 150만 · `:59` 이사비 200만 [잰 것]
- ⚠ 게임은 이 배열을 **안 읽는다** — `game.html:3226-3228` 은 `firstPlayRulesFromBalance` 로 `_meta` 만 읽고(`src/game/first_play.js:1129-1131`), `src/` 어디에도 `startHome`·`monthlyIncome` 소비자가 없다 [잰 것]. `sim.js:29` 에 `char` 칸은 있으나 결과 칸이 전부 null(:62-66)
- 집 데이터는 있다: `homes.json` classroom :49-61(월세 0·provided) · apartment :77-89 · greenhouse :91-103(provided) · tworoom :63-75 · 방 실측도 여섯 다 `data/house_rooms.json`(:12 :250 :402 :774 :1017 :1239) [잰 것]
- ⚠ 「직업 7종」(`plan-char-remodel-why.md:218` · `char-to-plan-rebuild.md:12-14, 157-158`: 캐릭터 모델 8종 = 자취녀 1 + 7)은 **데이터가 없다**. characters.json 은 넷. 일곱의 이름·값 → «없음 — 박사님 몫»

## 2. 최소판

**무엇을 고르나** — 카드 **넷**(characters.json 에 있는 그대로) · 그중 **고를 수 있는 것은 둘**: 「자취생(실전)」 · 「가장」. 주부·연구자는 카드만 보이고 「준비 중」.
- 넷인 이유 [잰 것]: 데이터가 있는 수가 넷이다(:47-85). 7종은 모델만 있고 값이 없다 → 지어내지 않는다.
- 둘인 이유 [셈]: 두 직업은 **돈 축**이고 판정이 이미 있다 — `goalType` money/escape 는 `canMoveOut`(`tutorial.js:993`)·`canFinish`(`ending.js:47-51` judgeBy 'cash') 와 같은 모양. garden·papers 는 판정 코드가 없다(`researcher_track.md:326-335` 「지출 루프가 없어 대기 … 다른 캐릭터보다 훨씬 무겁다」). 주부는 GAME_PLAN :283 이 튜토 후보에서 뺀 이유(아파트 3.87 < 4.2)가 본편에서도 「막힘」으로 남아 있어 먼저 재야 한다.
- 「자취생(실전)」[짐작]: 같은 자취생을 real 모드로 다시 — 박사님 「끝나고서는 제대로」의 가장 작은 꼴. 값은 tutorial.js 의 150만/200만을 따른다(characters.json 쪽을 맞춰야 함 → §3 ⑥).

**언제 고르나** [잰 것+짐작] — `finishEnding` 이 `ending_home` 사건과 `nextChapter:'job_select'` 를 내는 그 자리(`ending.js:190-195`). 엔딩 장면(지금 화면에 없음 · `story_arc.md:612-616`) 뒤 → 직업 카드 화면 → 새 판 시작. 세이브는 단계를 안 적고 `story.ending.doneOnDay` 로만 안다(`save.js:937-951`) → 「고르는 중」은 doneOnDay 있음 + 직업 없음 으로 읽힌다 [셈].

**고르면 무엇이 달라지나** — 전부 **있는 칸·규칙**에만 꽂는다

| 직업 칸 | 꽂는 자리 | 상태 |
|---|---|---|
| `startCash` | `ts.cashWon` 초기값(`tutorial.js:276` `cashWon: R.startCashWon`) | 있음 [잰 것] |
| `startHome` | `S.home.room` 바꾸기 = `moveIntoOneroom` 패턴(`oneroom.js:205-222`) · 월세·공과는 `banjihaRulesFrom(homes row)`(`tutorial.js:217-226`) 에 그 집 줄을 넣으면 `dailySpendWon` 이 다시 셈 | 있음, 단 반지하·원룸만 호출 중 [잰 것] |
| `household` | `_meta` 식 식비×household · 끼니 상한×household(`characters.json:9-13`) — `banjihaRulesFrom` 은 `opt.dailyFoodWon` 을 받으므로 곱해서 넘기면 된다(`tutorial.js:224`) · `first_play.js:81` 「household 4 라 상한이 20,000원」 | 식은 있음·배선 없음 [잰 것] |
| `monthlyIncome` | `tutorialDay(ts,{incomeWon})`(`tutorial.js:634, 660-661`) — 「지금은 상점 판매가 유일 … 자리를 남겨 둔다」 | 훅 있음·값 0 [잰 것] |
| `goalType`/`goalValue` | 현금 판정 한 벌(`canFinish`/`canMoveOut` 모양) | 돈 축만 있음 [잰 것] |
| 시간·잎 | real 모드(`state.SIM_MODES` · `story_arc.md:480-484`) · `storyRunning` false → 낙엽·고사(`growth_tuning.health.drop_enabled`) | 모드 넘기는 배선만 — game.html `newState` 셋이 전부 'novice'(`story_arc.md:484`) [잰 것] |
| `electricityWaived` `bankruptcy` | `src/` 에 소비자 없음 | ⏸ 최소판에서 안 쓴다(둘 다 고를 수 있는 둘에겐 false/true 그대로) |
| 옷·외형 | 1종(자취녀)뿐(`char-to-plan-rebuild.md:12-13`) | ⏸ 최소판은 같은 몸 |

## 3. 안 정한 것 — 박사님 몫

| | 물음 | 후보 | plan 추천 | 근거 |
|---|---|---|---|---|
| ① | 카드 수 | 넷(데이터) · 일곱(모델) | **넷** | 7종은 값이 없다(§1 ⚠) · GAME_PLAN:218 「설정값, 코드 분기 없음」 |
| ② | 최소판에서 고를 수 있는 수 | 하나(자취생 실전) · 둘 · 넷 | **둘(자취생 실전·가장)** | 돈 축만 판정이 있다(§2) · 가장은 household·classroom 데이터 완비 |
| ③ | 돈·그루·체력을 이어받나 | 이어받기 · 새 판(startCash) | **새 판** | `story_arc.md:57` 「직업은 시작 자금…을 가르는 축」 — 이어받으면 축이 안 선다 · 체력 `questsTaken`(`stamina.js:175`) 은 ⏸ |
| ④ | 자취생 본편 시작 집 | 반지하 · 마련한 「내 집」 | **반지하(real)** | 「내 집」 방 데이터 없음 — homes.json 에 `home_purchase` 줄 없음(`ending.js:70-78` 도 금액만 찾음) |
| ⑤ | monthlyIncome 지급 주기 | 매일 1/30 · 월세 날 목돈 | **매일 1/30** | 지출이 /30 매일 식(`characters.json:9`) — 같은 결 |
| ⑥ | 자취자 줄의 낡은 수(100만/150만) | tutorial.js 값으로 맞춤 · 그대로 | **맞춤(150만/200만)** | `tutorial.js:41,59` 가 박사님 2026-08-09 확정(`story_arc.md:310`) |
| ⑦ | 가장의 「집」 | 교실만 · 집 방 따로 | **교실만** | `homes.json:60` 「집이 아니라 직장」 · `game_flow.md:136` 「집에서도 키우기」는 방 데이터 없음 |
| ⑧ | 주부·연구자 열리는 때 | 최소판 뒤 · 안 연다 | **최소판 뒤, 하나씩** | AGENTS.md 「한 번에 하나씩」 · 연구자 논문 체계는 별도 설계(researcher_track) |

## 4. 붙일 자리

- **plan**: characters.json 자취자 줄 맞추기(⑥) · 「고를 수 있음」 표시는 칸을 새로 파지 말고 문서로 — 칸 추가는 박사님 뒤 · 선택 화면 문안(카드 네 줄은 `GAME_PLAN.md:201-204` 축 문장 재사용)
- **core**: `job_select` 받는 화면 · 직업 id 를 세이브에(`save.js:941` `packStory` 옆, 단계는 안 적는 규칙 유지) · `newState({mode:'real'})` · `startHome`→`S.home.room`(oneroom.js:220 패턴 일반화) · `banjihaRulesFrom(homes row, {dailyFoodWon×household})` · `incomeWon` 배선
- **house**: classroom·apartment·greenhouse 방은 있음 — 가구·슬롯·등 자리 현황 점검만(원룸처럼 「등 자리 0」이 아닌지 · `master-campaign…:39`)
- **growth**: real 모드에서 `health.drop_enabled` 켜짐 확인 · 가장 끼니 상한 8끼 ↔ 교실 어두운 칸(`game_flow.md:135` 「3칸 모자란다」) 다시 재기
- **char**: ⏸ 옷 없음 — 선택 화면 초상화는 기존 jachwi 재사용 [짐작] · 옷은 「직업 선택을 열 때」(`plan-char-remodel-why.md:359`)

## 5. 하지 말 것

- 수를 짓지 않는다 — 7종 이름·월급·주부 목표값(null) 전부 «없음 — 박사님 몫»
- `balance_provisional: true` 셋(주부·연구자·가장)을 확정값으로 말하지 않는다 — 가장을 열어도 「잠정」 표식을 단다
- 직업 상태를 `ending.js` 에 넣지 않는다(`ending.js:173`) · 정본은 characters.json 한 곳
- 7벌 옷·8종 모델을 먼저 만들지 않는다(`char-to-plan-rebuild.md:19` 「1종만 다시 만들어도 아쉽지 않다」)
- 연구자 논문·주부 정원 판정을 최소판에 끼우지 않는다 — 열리는 때는 ⑧
- 이 글의 [짐작] 두 곳(자취생 실전·초상화 재사용)은 박사님 답 전에는 설계가 아니다
