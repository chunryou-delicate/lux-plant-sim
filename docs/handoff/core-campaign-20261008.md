# [core] 10-07 밤 ~ 10-08 새벽 — 한 일 · 잰 것 · 정한 것 · 넘긴 것

판: `docs/handoff/master-campaign-20261007.md`(D1~D22) · 튜토 검토 `tutorial-friction-20261008.md` · 중반 검토(총괄 M1~M6) · [plan] `plan-d19-d21-20261008.md`
⚠ 02:04~02:09 GitHub push 가 500(remote: unable to rename temporary pack file)이라 멈췄다가 총괄이 다시 밀어 풀렸다. 지금은 다 원격에 있다.

## 1. 한 일 — 커밋 차례

| 커밋 | 무엇 | 잰 것 |
|---|---|---|
| 75ea6859 · 1c87d337 | D2 독촉은 «할 수 있었던 날만» — nudge_wait.js(기다림 판정 · 기다린 날 적기 · 날수) · stamina.questsWaitedOn · save 왕복 | probe_nudge(D19 명세) 11/11 · test_save_roundtrip PASS |
| eca4d0c2 | test_crop_seat F·F-2 낡은 기대(책상 도착) → 가방 도착 | 11/11 |
| 93faac4b | oneroom.lightGateOf — 날씨 계수는 자연광에만(등 DLI 에 0.643 곱하던 것) | test_oneroom_room 10/10 |
| fdc5b46a | D1 원룸 이사 때 sim.mode novice→real(빛만) · 규칙의 초보는 엔딩까지 | test_oneroom F-2 PASS |
| f6f1fb02 | D4 방 몬스테라도 등급 그림(plant_assemble setLeafSkins · room_view leafSkins · 그림표 바뀌면 다시 짓기) | [growth] 지킴이 무늬 판 PASS |
| b9817f04 | D11 검수 숨김(?dev=1) · 기록은 [방] 탭 · D12 첫날 진행 칩 · D13 밥상 한 줄 · D4 화면 · D2 기다림 적기 · [House] 이사 짐 식물등 빼기·등 자리 0 막기 | probe_core_d11_13: D11 4/4 · D12 2/2 · D13 첫날 팝업→사흘 한 줄 |
| d23a6b8a | D18 shop 사본에 하프문-크림민트 | test_variegrade 42/42 |
| 9ccfda53 | 튜토 #1 걷기 가르침은 첫 수확 전까지 · #3 줄단추 회색 · 재고 말 | probe_walk_trap: 작업 전 «사람을 눌러»에 갇힘 → 지금 「씨앗을 사러 갑니다」 |
| f573a0de | #2 첫날 [다음 날] 흐리게 · #6 시트 열면 [다음 날] 숨김 · #9 창 위 손가락 · #15/M4 대사 중 알약 비킴 · M1(D19) 씨앗 0 이면 주문 지름길 | probe_walk_trap 6/6 · probe_force5 폰 세 바퀴 다 통과(Day 5 상점→주문→개수) |
| 66ebbb14 | #4 밥상 창 「그 밖 공과·전기」·「오늘 지갑에서 나가는 돈」 · ③ 「심」 말풍선은 씨앗 있을 때만 | 창 7,500 = 실제(첫 월세 날 제외) |
| c15c59d1 | M3 오류 상자는 시트·탭·하루·창에서 치움 · #10 품질 「하얗고 아삭」·거둔 칸 비움 | 모양만 |
| 50a6104f | 원룸 줄 칸(questSnapshotNow 여섯+1) · story.varieSaleAtMove · nudge_wait 원룸 기다림 둘 | save PASS |
| 9403099e | 원룸 방바닥 시루 금지(ONEROOM_FLOOR_KO) · 원룸 누르기 임시 자리는 가구 위 | test_oneroom F-3 PASS(⚠ 처음 async 라 «무조건 PASS» 였던 것 고침) |
| 2f782a6b | D21 목표 한 줄(할 일 머리·가계부) · P3 lampPlaced · 칩 「📜 새 …」 · probe_nudge D19 명세 | probe_nudge 11/11 |
| 02280565 | D22 마지막 무늬 원천 팔기 전 몬이 한 줄 | 코드만 |
| 317a8c1e | resolveTap — 가구 정확 판정이 캐릭터 퍼지보다 앞 | 쓰레기봉투 0→9/18 · 난방기 3→13/18 · force5 첫날 그대로 |
| 0278b8db | M5 가계부 — 짧은 지난달은 안 견줌 · 「+N원 아낌」 | test_monthly 붉음 9 = 작업 전 판과 같은 9(이 커밋 탓 아님) |

## 2. 정한 것 — 후보 · 고른 것 · 까닭
- **#1 걷기 갇힘**: ① 첫 수확 때 걷기 가르침을 접는다 ② 갈래 차례를 상점 뒤로 ⇒ ① — ② 는 상점 갈래가 끝난 뒤 다시 걷기에 갇힌다.
- **M2(목적지가 있으면 사람 손짓 끄기)**: 끄면 첫날 걷기 가르침(박사님 «캐릭이동 강제 가이드»)이 통째로 사라진다 ⇒ #1 로 «첫 수확 뒤엔 꺼짐»만 했다.
- **D13 «같은 날»**: 오늘 기본 상(기본 g·아끼는 값·몫)이 어제 넘긴 상과 같고 어제 «기본 그대로» 넘겼을 때만 한 줄 — 손으로 g 를 바꾼 사람은 매일 창을 본다(그 사람의 g 를 몰래 기본으로 돌리지 않게).
- **D11 기록(#log)**: 검수 탭과 같이 숨김 / [방] 탭으로 옮김 ⇒ 옮김 — 도착·판매 로그를 사람이 다시 볼 데가 그것뿐(probe_logreach).
- **M3 ×N 접기**: 그대로 둠 — test_nextday_gate 가 지키는 자다. 대신 화면을 옮기면 치운다.
- **D1 로그 말** 「🌦 원룸부터는 날씨와 계절이 그대로 흐릅니다」 — [plan] 이 다듬을 자리.

## 3. 넘긴 것 — 다음 판 차례(위에서부터)
1. **resolveTap 남은 반** — 317a8c1e 로 가구 정확 판정이 캐릭터 퍼지보다 앞이 됐다(쓰레기봉투 0 → 9/18 · 난방기 3 → 13/18 · force5 첫날 사람 누르기 그대로).
   남은 캐릭터 9/18 은 정확한 캐릭터 판정(c1)이나 가구 광선이 비는 점으로 보인다 [짐작] — 가구 광선과 캐릭터 c1 이 둘 다 맞으면 «가까운 쪽»으로 가를지 재 볼 것
2. **M2 전체** — 손가락 = 지금 할 일(칩)의 목적지. 퀘스트마다 목적지 표가 필요(night_play guided d37~45: 칩 first_cut ↔ 손가락 「시루를 하나 더 사러」)
3. **test_quest** 붉음 10(+1 원룸 줄) — 09-06 퀘스트 얼개 바꿈 뒤 낡은 검사 · 원룸 걸음 추가([plan] ④)
4. **엔딩 뼈대**(stepEnding · 목표 칩 · [마무리] — targetWon null 이면 숨김) · homes.json 읽기(원룸 월세 35만도 같이 풀림 — D8 결정 뒤)
5. **cheer·wave**([char] c56fd8b7): room_view playClip(끝나면 base) → spearFurled·varieSeen cheer · intro wave · 대화 닫힘+카메라 멎음 뒤 · 빨리감기 중 안 함
6. **#7·#8** 문구·자리(배너·알약·칩·손가락 넷이 다른 말 · 「할 일이 가려졌습니다」가 칩을 덮음) · **#14** 「집과 자리」 Day 0
6-2. **test_monthly 붉음 9**(작업 전 판부터 · 살림 시계 1일차 · 대사 중 가계부 · 지갑 요약 수 · 작물 g) — 자가 낡았나 화면이 틀렸나 가를 것
7. **D8·D9 재기** — 원룸(real · D5 · 등 0/1/2) 살림·엔딩까지 날수 · [growth] 시각표를 물린다
8. **[leaf] 방 화면 줄기만**(260일 창턱 · 잎이 벽 속으로 기울었을 수 있음 [짐작]) — 카메라를 돌려 한 장
8-2. **[plan] 둘째 잎 기다림 «상태 줄»**(ed388fec · docs/handoff/plan-leafwait-20261008.md ③) — turn.leafWait 칸 이어 주기
     `{ leaves, newLeafToday, leafWaitDays, youngestLeafM, growStreak, arrivedOnDay, harvestedToday, harvestsSinceArrival, potOnSill, band, zoomOpenedSinceArrival }`
     없는 칸은 null(줄이 안 뜸). ⚠ chatGrowing2 「잎이 하나 더 생겼다」는 newLeafToday===true 일 때만 — 칸 전엔 침묵.
     같이: 식물 시트 맨 위 카드(drawGrowGauge 위로 + 「잎 {n}장(무늬 {v}장)」 + 「자리 {빛 낱말}」) · night_play 기록에 phase·progress01·참 leafM
9. 걸어야 할 것: D22(무늬 그루 판) · M3·#10(모양) · 원룸 바닥 금지(이사 판 화면) · D21 화면

## 4. 자 — 새로 만든 것 · 고친 것
- 새: `tools/probe_core_d11_13.mjs`(D11·D12·D13·#4 · D13_SEED=1) · `tools/probe_walk_trap.mjs`(사람 안 고르는 걸음 · #1·#2·#6·M1) · `tools/probe_furnclear.mjs`(0원 가구)
- 고침: `probe_nudge`(D2·D19 명세) · `test_crop_seat` F·F-2 · `test_oneroom` F-2·F-3 · `test_save_roundtrip`(기다린 날)
- ⚠ 자가 틀렸던 것: test_oneroom F-3 을 처음 async 로 써서 «무조건 PASS» 였다(check 가 동기라 약속만 받음) — 동기로 고쳤다.
