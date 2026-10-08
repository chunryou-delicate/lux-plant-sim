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

## 5. 10-08 낮 — 총괄 07:20 차례(leafWait → D23 → D25 → D8·D9 자 → 엔딩)

| 커밋 | 무엇 | 잰 것 |
|---|---|---|
| fb01ee3d | turn.leafWait 11칸([plan] plan-leafwait ③-1) — src/game/leaf_wait.js · loop.nextDay 가 날마다 셈(빨리감기 포함) · 세이브 firstPlay.monstera.watch · 확대창 연 적 · 진단 __leafWait() | test_leaf_wait 24칸 · probe_leafwait 70일(진짜 생장 창): 상태 줄 d3 창턱 · d5 게이지 · d8 쉬지 않고 · d9 첫 잎 넓어짐 · d20 지갑 · 새 잎 d25 |
| 8a8ab801 | D23 반지하 창턱 몬스테라 — 굴광성 0.25 + 그림만 +z 0.25m(빛 자리·빛 값 그대로) · ?d23=0 전후 깃발 | probe_d23_sill 13칸 · house 잼: 잎 벽 너머 99.6 → 14.5% · 보이는 잎 0.7 → 32.3% |
| b04f658e | D25 — questSnapshotNow.motherVarieMatured · 상점 수경병 = «지금 자를 마디가 있나»(freeCutNodeCount · ✂ 말풍선과 같은 자) 또는 «한 번 자른 사람» · first_cut 물꽂이 뿌리내리는 중 = 기다림 | probe_d25_jar PASS · probe_nudge 11/11 |
| 9c5c418c | D8·D9 자 — probe_oneroom_econ(M1·M3) · test_banjiha_routes M0 열 | 대조 판(월세만 꽂음) 붉음 확인 · 첫 판 아래 |
| 2a6dbcfb | ④ 엔딩 뼈대 — 목표 없으면 숨김 · 닿은 날 한 줄 · 단추 · 되묻기 · 그림 덮개+열세 줄 · 카드 · [다음] · ?endingTarget 깃발 | probe_ending_walk PASS · test_ending_flow 16/16 |

### 정한 것 — 후보 · 고른 것 · 까닭
- **leafWait 새 잎**: ㉠ 잎 수가 늘었나 ㉡ 지금까지 본 가장 큰 leafBirth 보다 큰 잎이 달렸나 ⇒ ㉡. 자른 날 새 잎이 같이 나면 ㉠ 은 못 본다(leafBirth 는 g 와 같이만 커진다).
- **harvestedToday**: 상태 줄은 아침(story.turn)이고 거두기는 낮의 손 ⇒ «아침에 보니 지난 턴 뒤 거뒀다». [plan] 이 그대로 두기로 함.
- **D23 받침 면·겹침**: 그림을 옮기면 «앉힐 면»(supportY)과 «다른 화분과 겹침»은 빛 자리에서 잰다 — 그림 자리로 재면 house 의 늘린 받침(광선 안 받음)을 지나 창턱 밑(0.794)에 앉고, 같은 빛 자리에 화분 둘이 섰다(둘 다 걸어서 잡음).
- **D25 수경병**: ㉠ 늘 «지금 마디»로만 ㉡ 한 번 자른 사람은 계속 보임 ⇒ ㉡(마디를 기다리는 사이 사라졌다 나타나면 «어디 갔지» · 원룸은 삽수 그루에서도 자른다).
- **엔딩 걸음 깃발**: D9 전엔 목표가 없어 화면이 안 열린다 ⇒ `?endingTarget=N`(세이브에 안 남음 · ?d23=0 과 같은 꼴).
- **D8·D9 짝**: dailySpend' = dailySpend + (R − 반지하 월세)/주기(월세 밖 하루치 그대로) — 35만 21,667 · 27.5만 19,167(plan 문서의 21,833·19,333 과 166원 다름 · plan 에 물음).

### D8·D9 첫 판 [잰 것 · 씨앗 1~10 · 반지하 novice → 이사 뒤 real · roomRev 3168869e]
- M0(test_banjiha_routes): 이 자는 이사비를 맞추려 모주까지 다 판다 — 모주 든 판 0/40 · 이사 뒤 현금 중앙값 등0 62,828 · 등1 118,379.
- M1(probe_oneroom_econ --path quest · 180일): 월세 20/27.5/35만 · 등 0/1 · ⓐⓑⓒ 전부 굶음(첫 0원 1~61일째). --cash c=1000000 이어도 91~151일째 0원.
- 까닭(걸어서 본 것): ⓒ 로 가면 모주가 잎 3·무늬 1 → 초보 규칙(«예비혹이 안 남으면 못 자름» · 엔딩까지)에 막혀 원룸에서 자를 마디 0 → 벌이가 시루뿐.
- ⚠ 이 자의 반지하 행동(시루 다섯 · 민무늬 안 팖 · 잉여 채소는 한 번도 안 생김)이 사람보다 가난할 수 있다 — night_play guided 의 이사 날 상태로 시작을 맞춰 다시 잴 것.
- ⚠ 자가 틀렸던 것(스스로 밝힘): 잉여 넘기기를 넣고 «이사 155 → 60일»이라 읽었는데 씨앗 1·2만 본 착각이었다(넘긴 날 0).

### 걸어서 드러난 낡은 자
- test_banjiha_routes: 끝까지 돌게 하니 붉음 7(B-2 · D · P-2 · P-3 · G-2b · G-3 · G-4) — 문이 생긴 뒤 자가 못 따라온 칸들 [짐작] · 안 고침.
- test_first_play_attacks: 콩나물 g 1000/700/400 ↔ 기대 500/350/200 — 작업 전 판 d925c993 에서도 같은 값으로 붉다(낡은 자).
- test_roomview_place 붉음 6(S-3·E-3·F-2·F-3·F-6·N-5) = ?d23=0 과 같음(작업 전부터).

### 넘긴 것 — 다음 차례
1. M2 손가락 목적지 표 · resolveTap 남은 반 · #7·#8·#14(plan-friction-7-8-14 §core)
2. [plan] ③-3 식물 시트 카드(drawGrowGauge 위 + 잎 {n}장(무늬 {v}장) + 자리 {빛 낱말})
3. [house] 시루 «N일» 표지(house-siru-badge-spec-20261008)
4. D8 다시 재기 — night_play guided 이사 날 상태로 시작(총괄 봇 판과 함께)
5. D23 남은 14.5%(창 위아래 벽 속) — 더 띄울지·⑤(벽 피하기)는 총괄 몫

## 6. 10-08 오후 — 튜토 마찰 · resolveTap · 카드 · 시루 표지

| 커밋 | 무엇 | 잰 것 |
|---|---|---|
| 40bd1392 · fc90d935 | #7 Day 0 넷이 한 길(「내 캐릭터를 눌러 시루까지 걸어가세요…」 · 알약 「💧 심기 먼저」 · 같은 꼴 넷) · #8 HINT_SHEET_DOOR 「한 번 더 누르면 닫힙니다」 + 칩과 겹치면 아래→왼쪽 · #14 「집과 자리」·개발자 설정을 검수 탭으로 · 「사람」→「내 캐릭터」 끝까지(안내판·쪽지 셋) | probe_hint_chip 겹침 0% · ★대조(칩을 말풍선 자리에) → 아래로 비킴 · walk_trap 6/6 · D11 4/4 · guide_notes ⑤-5 |
| ae5bd953 · 18eb286c | resolveTap 남은 반 — 사람 고르는 상자 가장자리·사람보다 앞의 가구는 가구 · 천장등 «유령»(천장 잘린 시점 · 반투명)은 갓 가운데 지름 0.12m 만 누름([house] ㉢) | probe_pick_props: 난방기 14→18 · 쓰레기봉투 9→12(남은 6은 사람이 앞에 서서 가림) · 건조대 12→17 · 천장등 가운데 1/9 여전히 골림 |
| f177ebf8 · 85548b84 | [plan] ③-3 식물 시트 맨 위 몬스테라 카드(잎 줄 · 게이지 · 자리 빛 낱말) · 아래 상자의 첫 그루 같은 줄 빼기 | probe_moncard: 확대창 게이지와 같은 값 · 중복 줄 0 |
| 11bd43f5 | [house] 시루 «N일» 표지(#siruBadges · ?sbadge=0) | probe_siru_badge: d2~4 🌱 n/5 · 말풍선 뜬 때 0 · 끔 판 0 · img/core_20261008/siru_badge_pair_day3.png |

### 정한 것
- **천장등 유령**: ㉠ 그대로 ㉡ 유령이 가구에 양보(천장등을 못 고름 9→0점) ㉢ 가운데만 ㉣ 못 고르는 물건 ⇒ [house] 가 ㉢(천장등을 고를 일은 켜고 끄기 하나).
- **시루 표지**: 말풍선이 뜬 시루엔 표지 숨김(같은 말 두 번 · «버튼은 한 곳에만») — 늘 보이는 것은 자라는 날. 손가락 숨김은 «그 시루를 짚을 때»만(겹침으로 하니 사람이 시루 옆에 서 있는 동안 며칠 내내 지워짐).
- **#8 칩 피하기 대조**: 짧아진 글은 원래 안 겹쳤다 — 칩을 말풍선 자리로 옮긴 대조에서 비키는 것을 확인(대조 없이는 «피하기가 돈다»를 못 말한다). «아래» 자리를 대상 밑 −4px 로 잡아 4px 겹치던 것도 대조가 잡음(+2px 로).

### 기다리는 것
- M2 우선순위(칩 ↔ 박사님 «2개째 강제 가이드») — 총괄 결정. 추천 ㉢(D25 뒤 봇 판에서 어긋남을 다시 셈)→㉡(강제 가이드가 짚는 동안 칩도 그 일).
- D8 짝 셈 — «월세 밖 하루치 그대로»(지금 자) ↔ «같은 식 · 원룸 줄»(관리비 80,000 · plan 추천) — 총괄 결정.
- 흔들림 둘: probe_core_d11_13 «D13 날이 매번 하루씩»(2판 중 1판 · 첫날 누름 하나가 먹힘) · test_guide_notes ②-c 떨굼표시(2판 중 1판).

## 7. 10-08 저녁 — 갈래 판 · 잠김 · 자리 자유(A·B·E·D·C·G) · D27·D28 · 지도 core 몫

| 커밋 | 무엇 | 잰 것 |
|---|---|---|
| 612d4d82 · 694724c6 · 80efc9a6 | 갈래 판(probe_branches) 손버릇을 night_play guided 와 맞춤 · **하네스 구멍 셋**(프롤로그 무늬 잎 2·3 · bandOf · 정적 표가 던지는 삽수 자리 좌표) · 씨앗 g(게임 그루 92158) · 목표마다 현금 닿는 날 중앙·90% | 구멍 메우기 전 «이사 212일·자르기 영영 닫힘·varie_bright 못 끝남»은 자의 거짓 → 이사 148 · 봇과 d26 까지 같고 d31 부터 갈래가 앞섬 |
| 0f29dd75 | ⛔ 둘째 화분 씨앗 심기 → hardLock([leaf] 0639ec14) — 턴 밖에서 꽂힌 그루는 언제나 첫 화분(state.selectLeadPlant · 심기·nextDay·restoreGrowth) · drawShop 이 잎 0장에 안 던짐 | leaf 자 그대로(_walk_twopots · _check_reload_gate): 꽂힌 그루 __main__ · 잠김 0 · 다시 켜도 첫 화분 308일 |
| 1222696b · 2bb7ea97 · 5ad115db · d70bcbc7 | A·B 놓는 순간 빛 한 줄(확인 바·배너 · 몬스테라·빈 화분·삽수) · real 은 날씨 기댓값 · 무늬 삽수 varieDim · 확인 바가 «옮기기 전 자리»를 붙잡던 옛 고장 | probe_dark_place PASS |
| 4e70d1e9 | 자리 잡은 삽수에서 [병에]·[흙에](motherCuttingId) · 조사 «을(를)» 11 · «(으)로» 8 · «받침받침이» | probe_recut_button PASS |
| db09c88e | E 길 경고가 침대·의자·책상 곁·문 앞까지 · 길 판 번호로 확인 바 다시 칠함 · 경고 있으면 [확인] 손가락 말풍선 안 냄 | probe_reach_uses PASS(반지하 문 앞 통로) |
| 5b246da9 | G «안 자란 날» 처방: 옮기기 / 등(달면 밝아집니다) / 이 방 빛으론 안 됨 / 7일 평균 덜 참 | 게임 [다음 날]로 서랍장→창턱 걸음 |
| 28bf227d · 18afdfe4 | D 빛 분포를 몬스테라 문턱으로(2.7 미만 회색 · 범례 두 줄) · C 끌기 고리에 빛 등급 색 + rankSlots 첫 판 문을 showDli 자로(260일 판에서도 꺼져 있었음) | probe_lightview ✘1 은 대조 판에도 같은 옛 칸 |
| 996324ab · 131e040e | D27 이사 되묻기 창(이사비 · 무늬 원천 n · 원천 0 이면 몬이 먼저 → [그래도 간다]) · D28 엔딩 뒤 «여기까지 — 첫 이야기» 덮개 · [다음 날] 잠금 · [처음부터 다시] 되묻기 | probe_ending_walk ⑥ 네 칸 PASS |
| 4710bb64 · a8749420 · 06667391 | nudge varie_bright 무늬 원천 0 = 기다림 · 삽수 사건 turn.events 에 실음 · 이사 조건 글 «무늬 잎을 아직 못 봤습니다» · order_seed 기다림 좁힘 · 원룸 할 일 빈 글 = endingGoal · 스냅샷 monsteraGrowing | node: cutting_rooted·node·warn·died 가 turn.events 로 |
| 87110c05 · fbcb91d6 | turn.cropNow{seedStock·emptySiru}(plan 지도 13) · 윗줄을 첫 플레이가 꺼진 판에서도 그림(leaf «다시 켜면 Day 0» = 세운 판 enabled=false) · ③(나) 확대 카메라 천장 여유를 한 값으로·가로는 실제 너비 | 두 화분 세이브 «Day 263» · 260일 그루 거리 0.92→2.20m 한 화면 |
| dc13269d · db17470a | 사건 lamp_under_empty(등 단 날 그 밑에 식물 0 · 지도 94) · ending_ready_again(닿았다 모자란 뒤 다시 · dippedOnDay 세이브 · 지도 99) — 대사는 plan | node 순서 잼 · ending_flow 16/16 |

### 정한 것
- **잠김 고침의 규약**: 그루를 갈아 꽂은 쪽이 끝날 때 첫 화분을 다시 꽂는다(화면의 «첫 화분 읽기»는 그대로). 한 그루짜리 판은 select 를 안 부르는 옛 길 그대로.
- **경고의 자는 자라는 쪽 것**: 놓는 순간·안 자란 날·스냅샷이 한 자(growBandAt · bandOf · NO_GROW_BANDS)를 쓴다. 글은 plan 이 «늘 참인 말»로 고침(«자랍니다» → «달면 밝아집니다»).
- **이사 되묻기**: 창이 열린 채 [원룸으로 이사]를 한 번 더 누르면 이사(confirmOnce 결 · night_play 두 번 누름 그대로). 한 번만 누르는 probe 열 개는 주인 창에 알림(총괄 경유).

### 넘긴 것 — 다음 차례
- 16(자리 없는 삽수 기한 — 총괄 판단) · lampSkipped 뜻 옮기기(plan 문안 대기).
- M2 ㉡(봇 수 대기) · D8 다시 재기 · test_quest 다시 쓰기(23줄 · FAIL 11 그대로) · test_oneroom H «2.7 == 3» · test_musun_view·multisiru 화분 지름 0.20 단언(옛 칸).
- «늘리는 사람» 갈래(삽수를 남겨 키우고 거기서 자름) — 총괄 답 대기. 지금 K 표에선 삽수에서 자르기 0번(팔아 버림 · 원룸 창턱은 무늬 삽수가 안 자람 띠).
- 흔들림: test_guide_notes ⑤-1(첫 판만) · probe_lightview «겹친 쌍 1»(옛 칸).
- ⚠ probe_lightview 가 docs/handoff/img/lightview/*_now.png 를 추적 안 되는 파일로 남긴다(지우지 않음).
