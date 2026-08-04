# 2026-08-05 · oneroom → plan · house · core(game.html)

**③ 원룸 · ④ 내 집 마련을 붙였다.** 정본은 `docs/oneroom.md`, 스토리 줄기는
`docs/story_arc.md` §4-1·§4-2 다. 여기는 **다른 창이 해 줘야 하는 것**만 적는다.

---

## ★ 조사에서 나온 것 둘 — 보고부터

### ① ② 탈출은 **사건으로만 있었고 이동이 없었다**

`tutorial.moveOut(ts)` 은 이사비를 빼고 `ts.movedOut = true` 를 세울 뿐이었다.
`S.home.room` 은 그대로 `banjiha` 라서 조도도 슬롯도 화면도 전부 반지하였다.
→ `src/game/oneroom.js` 의 `moveIntoOneroom(S, io)` 이 그 문을 연다.

### ② 초보 모드가 **이사 버튼에서 꺼지고 있었다**

`propagation.isNoviceMode` 가 `!ts.movedOut` 을 보고 있었다. `story_arc.md` §0 이 못 박은
범위는 **④ 엔딩까지**인데 ③④가 통째로 빠져 있었다 — 이사하는 순간 삽수 유예가
16일 → 8일로 줄고 모주를 끝내는 자르기가 열린다.
→ 지금은 `S.story.ending.doneOnDay` 를 본다. (`sim.mode==='novice'` 로 도는 판에서는
가려져 있어서 아무도 못 봤다.)

---

## → house 창 : **지금 방 데이터로는 ③이 성립하지 않는다**

`story_arc.md` 는 ③에 *"갈라진 잎 · 무늬"* 를 붙였는데, 재 보면 문턱을 하나도 못 넘는다.
숫자와 근거는 `docs/oneroom.md` §3. 요약하면 넷이다.

1. `rooms.oneroom.furniture` 에 **`uid` 가 하나도 없다** → 임시 slotId 라 저장된 화분이 밀린다
2. **식물등 기구가 0개** → 반지하에서 산 등이 원룸에서 아무 일도 안 한다
   (반지하는 등 2개로 7일평균 7.92 까지 간다. 물리 문제가 아니라 기구가 없는 것이다)
3. **밝은 칸이 1칸**(7일평균 3.07, 가을 2.00 · 겨울 1.14) · 슬롯 11칸
   → `propagation.md` §7 은 밝은 20 · 어두운 4 = 최소 24칸을 요청한다
4. `data/profiles/room_profile.oneroom.json` 이 `uidStable` 이 없어 **안 열린다**
   → 원룸을 헤드리스로 재현할 수 없다(밸런스 시뮬도 반지하까지다)

★ 코어는 못 고친다(`data/house_rooms.json` 은 house 소유). 재현은 **던지지 않고**
숫자만 남긴다(`tools/test_oneroom.mjs` 검사 H-2) — 매번 다시 잰다.

---

## → plan 창 : ⏸ 확정해 줘야 하는 숫자

코드에는 전부 **`null`(자리)** 만 두었다. 후보와 근거는 `docs/oneroom.md` §2·§5.

| | 코드의 자리 | 후보 | 근거 |
|---|---|---|---|
| 원룸 월세 | `TUTORIAL_RULES.oneroomRentWon` | 450,000 | `homes.json` (`cost_provisional: true`) |
| 원룸 하루 지출 합 | `TUTORIAL_RULES.dailySpendWon` (반지하 값 그대로) | 25,000? | 월세 몫이 10,000 → 15,000 이 되면 같이 올라야 한다 |
| 원룸 슬롯 수 | `ONEROOM_RULES.slots` | 24 이상 | `propagation.md` §7 |
| ④ 목표 금액 | `ENDING_RULES.targetWon` | 10,000,000 | `propagation.md` §7 |

★ **④ 목표 금액을 확정하기 전에 역산을 다시 돌려야 한다.** `propagation.md` §7 의
「4~17그루」는 **옛 가격 공식**(잎 비율 v)으로 낸 것이고, 2026-08-04 에 값이
「잎마다의 합」으로 바뀌면서 자릿수가 달라졌다(잎1·무늬1 삽수 732,000 → **80,000원**).

★ `homes.json` 의 `moveCost`(150만)와 `TUTORIAL_RULES.moveOutCostWon`(150만)이 **같은 값**이다.
재현(검사 J)이 그 등식을 고정한다 — 한쪽만 고치면 「모은 돈으로 이사했는데 보증금이
모자란」 판이 된다.

---

## → core(game.html · loop.js) 창 : 배선 셋

이 창이 못 건드리는 파일이라 안 이어져 있다. 코드 조각은 `docs/oneroom.md` §6.

1. **`$('moveOut').onclick`** — `moveOut(S.tutorial)` → `moveIntoOneroom(S, io)` 로 바꾸고,
   반환값의 `roomChanged` 를 보고 `buildRoom(r.roomId)` 를 부른다.
   **이게 없으면 ③이 안 열린다.**
2. **`loop.nextDay`** — `stepTutorial` 뒤에 `stepEnding(S, io, {rules, nodes, stats})` 를 부르고
   `turn.ending.events` 를 `attachEvents` 목록에 싣는다.
   ⚠ 목표 금액이 `null` 이면 아무 일도 안 하고 빈 목록을 낸다(안전하다).
3. **규칙 주입** — 새 판(`createTutorialState`)과 이어하기(`deserialize`)가 **같은 rules 객체**를
   받아야 한다. 세이브는 rules 를 안 적는다.

---

## → dialogue 창 : 대사 셋

없는 id 는 조용히 지나가므로 고장은 안 나지만 ③④가 통째로 무음이다.

| 사건 | 언제 |
|---|---|
| `moved_in_oneroom` | 원룸에 짐을 푼 날 (`moved_out` 바로 다음 장) |
| `ending_ready` | 내 집 마련 자금에 **처음 닿은** 날 |
| `ending_home` | 끝낸 날 |

---

## 바꾼 기존 파일 (전부 최소)

| 파일 | 무엇을 |
|---|---|
| `src/game/state.js` | `S.story` 한 칸(리터럴). 순환을 피하려고 모양만 여기 — 등식은 검사 A 가 고정 |
| `src/game/save.js` | `packStory` + `KNOWN_STATE_KEYS` + 복원. 옛 세이브는 기본값으로 열린다 |
| `src/game/tutorial.js` | `rentWonOf(ts)` 신설 · `oneroomRentWon: null` 자리 · `moveOut` 에 「방은 안 바뀐다」 주석 |
| `src/game/propagation.js` | `isNoviceMode` 가 ④까지 본다(위 §조사 ②) |
| `tools/test_cutting_wiring.mjs` | 자유 모드를 켜는 방법이 바뀌어 헬퍼 한 줄 |
