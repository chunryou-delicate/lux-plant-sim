# 둘째 잎 기다림 — 카드는 «어디까지 왔나», 말은 «오늘 바뀐 것» (leafwait)
2026-10-08 · [plan] · 근거 보통 판 기록 `tools/_out/night/390x844/play_1_master1008.json`(night_play guided seed 1 · 0~60일) · 총괄 02:06
⚠ 명세만이다 — 코드·값을 안 바꿨다. 셈(생장·문턱·잎 굴림)은 한 톨도 안 건드린다. 화면 칸과 대사 조건만 정한다.

## ⓪ 기록이 보여 준 것 — 말이 끊긴 까닭은 «줄이 모자라서»만이 아니다
| 날 | 일 |
|---|---|
| 12 | 몬스테라 도착(잎 1) · 13 창턱에 놓음(밴드 slow · 그날부터 매일 자람) |
| 13~37 | **말 없는 날 14일**(14·15·17·19·21·22·25·26·28·29·32·33·35·36) |
| 16·20·23·27·30·34 | 잡담 — **정확히 사흘에 한 번**이다 |
| 18·24·30·36 | 시루 거둠(씨앗 그날 씀) |
| 21 · 33 | 첫 잎이 자란 정도(leafM) 0.5 · 0.75 를 넘음 — 렌더러가 이 값으로 잎 크기를 그린다(night_play §leafM) |
| 23 | 다음 잎(lb 136 · 무늬)이 growth 장부에 «달림»(onPlant · leafM 0) — 잎 수는 아직 1 |
| 31 | 월세 · 지갑 −210,000 |
| 37 | 새순(잎 수 2) — 이날 대사 17줄이 몰린다 |
- ⇒ **박자가 원인이다.** 잡담은 조용한 날이 이틀 지나야 선다(`QUIET_DAYS_BEFORE_CHATTER` 2) — 이 구간은 독촉도 없다(leaf_two 는 늘 «기다림» · nudge_wait). 줄을 아무리 더 지어도 잡담 칸에 넣으면 사흘에 한 번이다.
- ⇒ 그리고 **거짓 한 줄**: Day 20 「잎이 하나 더 생겼다.」(chatGrowing2) — 잎이 1장인 날이다. 조건이 «오늘 자랐다(grew)»라서 그렇다. «새 잎이 난 날»로 바꿔야 한다(③ `newLeafToday`).

## ① 식물 시트 맨 위 «몬스테라 카드» — 무엇을 보이나
```
몬스테라 · 잎 {n}장 (무늬 {v}장)                       ← 무늬 0 이면 괄호 없음
지금  {단계 이름}  [■■■■■■□□□□]  {다음 단계}까지 {p}%     ← growthPhase() 그대로(지금 확대창 게이지와 같은 값)
자리  {빛 낱말}                                         ← 밴드 → 낱말 (아래 표)
```
| 밴드(propagation lightBands) | 카드 낱말 | 까닭 |
|---|---|---|
| dark(critical·poor·stagnant) | **자라지 않는 빛** | 「어두움」만 쓰면 콩나물 자리와 헷갈린다 — 몬스테라 기준으로 말한다 |
| mid(slow) | **자라는 빛** | 반지하 창턱이 여기다 — «된다»는 말이 먼저 와야 한다 |
| bright(best·good·over) | **밝은 빛 — 무늬가 좋아지는 자리** | 퀘스트 낱말 «밝은 자리»(varie_bright · oneroom_root_bright)와 같은 말 |
- 멈췄으면 «자리» 줄 끝에 이유 한 마디(지금 `shortBlockWhy` 그대로) — 새 말을 안 짓는다.
- ⛔ **«다음 잎까지 n일»은 안 쓴다.** 몬이가 Day 13 에 「날짜로는 못 세. 빛이 쌓인 만큼 나는 거라서.」라고 했다 — 카드가 날수를 세면 그 말이 거짓이 된다. 게이지(%)는 «빛이 쌓인 만큼»을 그대로 보여 주는 것이라 그 말과 한 편이다.
- ⛔ DLI 숫자는 안 보인다(초보 판 `showDli()` 규율 그대로).
- 후보: ㉠ 카드 새로 · ㉡ 확대창 게이지(`drawGrowGauge`)를 시트 맨 위로 올림 ⇒ 고른 것 ㉡ — 값과 그리는 함수가 이미 있다. 덧붙는 것은 잎 수 줄과 자리 줄 둘뿐이다.

## ② 기다림 동안의 «상태 줄» — 후보 일곱
**새 층을 하나 둔다: «상태 줄».** 조건이 «오늘 처음 참이 된» 날에 한 줄 — 조용한 날 세기(이틀 규칙)를 «안 거친다»(독촉처럼). 차례: 사건 > 독촉 > **상태 줄** > 잡담 · 하루 한 줄 그대로. 상태 줄이 난 날은 잡담의 조용한 날 세기를 0 으로 돌린다(잡담과 몰리지 않게).
- 후보: ㉠ `QUIET_DAYS_BEFORE_CHATTER` 2 → 1(잡담을 이틀에 한 번) · ㉡ 상태 줄 층 ⇒ 고른 것 ㉡. 까닭: ㉠은 반복 잡담 일곱이 더 자주 돌 뿐이고(«매일 떠들면 사건의 무게가 내려간다» — §7 머리말), ㉡은 «그날 바뀐 것»만 말하니 말이 곧 소식이다.
- 규칙: 몬이는 수를 말하지 않는다 · 같은 줄 이틀 잇달아 없음 · 줄마다 한 번(ⓖ만 14일 간격) · 몬스테라가 온 판에서만(`hasMonstera`) · 새 잎이 나면(잎 수가 늘면) 이 묶음은 다음 기다림까지 쉰다.

| | 언제(조건 · «오늘 처음 참») | 줄 | 기록에서 뜰 날 |
|---|---|---|---|
| ⓐ 창턱 | 그루가 창턱 칸 · 밴드 mid 이상 · 반지하(`!movedOut`) · 놓은 다음 날 | 몬이 teach 「여기가 이 방에서 얘가 자라는 단 한 자리야.」 | **14** (말 없던 날) |
| ⓑ 게이지 가리킴 | 도착 뒤 이틀 · 도착 뒤 확대창을 한 번도 안 열었다 | 자취 curious 「빛이 쌓인 만큼이라며. 얼마나 쌓였어?」 / 몬이 teach 「얘를 눌러 봐. 차오르는 게 그거야.」 | **15** (말 없던 날) |
| ⓒ 쉬지 않고 | 놓은 뒤 자란 날이 일곱 날 잇달음(멈춘 날 없음) | 몬이 proud 「하루도 안 쉬고 자랐어. 자리가 맞는 거야.」 | **20** (거짓 줄 chatGrowing2 자리) |
| ⓓ 첫 잎 넓어짐 | 가장 어린 펴진 잎의 leafM 이 0.5 를 넘은 날 | 자취 「첫 잎이 처음보다 넓어졌다.」 / 몬이 calm 「자라는 중이야. 잎도 줄기도.」 | **21** (말 없던 날) |
| ⓔ 다음 잎 준비 | growth 장부에 다음 잎이 달린 날(onPlant 는 늘었는데 잎 수 그대로) | 몬이 teach 「다음 잎이 준비되고 있어. 아직은 안 보여.」 | **23** (잡담 날 — 잡담 대신) |
| ⓕ 시루와 견줌 | 도착 뒤 둘째 거둠 이후 · 그날 거둠 · 잎 수 그대로 | 자취 think 「콩나물은 또 거뒀는데 얘는 그대로다.」 / 몬이 teach 「콩나물은 날짜로 자라고, 얘는 빛으로 자라.」 | **30** (잡담 날 — 잡담 대신) · 14일 간격이라 36 은 안 남 |
| ⓖ 지갑 | 도착 때보다 지갑이 크게 줄었고(월세 한 번 넘김) 잎 수 그대로 · 사건 다음 날 | 자취 tired 「돈은 매일 줄고 잎은 그대로다.」 / 몬이 calm 「잎은 줄지는 않아. 쌓이는 중이야.」 | **32** (말 없던 날) |
- ⇒ 13~37 말 없는 날 14 → **10쯤**(14·15·21·32 가 차고, 20·23·30 은 잡담 대신 «소식»이 선다 — 잡담 박자는 그 뒤로 밀린다). 정확한 수는 상태 줄 층을 넣고 같은 판으로 다시 잰다.
- 참인지: ⓐ 반지하 자라는 칸 1칸(novice 08-15 표 · dialogue.js §movedInOneroom 주석) · ⓓ leafM 은 렌더러가 잎 크기로 쓴다(night_play §leafM — 다만 «g 가 실릴 때까지 믿지 마라» 경고가 있다 → ③-4) · ⓖ 「줄지는 않아」 = 잎 떨굼 꺼짐(growth_tuning health.drop_enabled:false) · ⓕ 「날짜로 · 빛으로」 = Day 13 몬이 말과 같은 주장.
- ⚠ ⓔ 는 [growth] 확인 뒤에 넣는다 — Day 23~36 의 «달렸는데 leafM 0» 이 무엇인지(숨은 눈 · 프롤로그 무늬 잎 예약 · 셈 착오) 모른다. 모르면 빼고 여섯으로 간다.
- 같이 넣을 것(이미 있는 줄 고침): chatGrowing2 「잎이 하나 더 생겼다」 조건 `c.grew === true` → `c.newLeafToday === true`.
- 이 묶음 밖(같은 기록): Day 37 17줄 · Day 45 21줄 몰림 — 새순(spearFurled)과 «이백만 원» 첫 말이 한날이다. D21(core 2f782a6b)로 할 일 머리에 「이사비까지 {n}원」이 첫날부터 서므로 Day 37 의 «돈» 몇 줄은 다음 판에 줄일 수 있다(따로 잰다).

## ③ [core] 가 다음 판에 이을 칸
1. `chatterContext` 에 실을 칸(읽기만 · 모르면 null — null 이면 그 줄은 안 뜬다):
   - `leaves` · `newLeafToday`(어제보다 잎 수가 늘었나) — chatGrowing2 고침에도 쓴다
   - `onPlantLeaves`(growth leafOnPlant 의 onPlant 수) — ⓔ
   - `youngestLeafM`(가장 어린 «펴진» 잎의 leafM) — ⓓ
   - `growStreak`(그 그루가 멈춤 없이 자란 날 수 · 놓은 날부터) — ⓒ
   - `arrivedOnDay` · `cashAtArrival`(fp.monstera 에 도착 날·그날 지갑) — ⓑ ⓖ
   - `harvestedToday` · `harvestsSinceArrival` — ⓕ
   - `potOnSill`(그루 칸이 창턱인가) · `band` — ⓐ (`turn.slot` 에 이미 있으면 그것)
   - `zoomOpenedSinceArrival`(도착 뒤 확대창을 연 적 있나) — ⓑ
2. 상태 줄 층 — `createStoryteller.turn` 에서 독촉 뒤·잡담 앞에 `pickStatus(ctx, lastDay)` 한 번. «오늘 처음 참»은 어제 ctx 와 견준다(storyteller 가 어제 ctx 한 벌을 쥔다 · 세이브 안 함). ⇒ 이 함수와 표는 [plan] 이 dialogue.js 에 짓는다 — core 는 1 의 칸만 이으면 된다.
3. 카드: `drawGrowGauge` 를 식물 시트 맨 위로(초보 판) + 잎 수 줄 · 자리 줄(① 표의 낱말).
4. night_play 기록에 `phase`·`progress01`(growthPhase) 와 «참 leafM»(g 기준) 을 실어 달라 — ⓓ 의 문턱과 «게이지 반을 넘음» 같은 줄을 날짜에 대 볼 수 있게. 지금 기록의 leafM 은 night_play §leafM 경고대로 g 가 아니라 day 로 셈한 값일 수 있다.

## ★ 지은 것 (02:24 · 총괄 02:18 «지어 두라»)
- dialogue.js: 상태 줄 **여섯**(ⓔ 다음 잎 준비는 뺐다 — growth 확인 전) · `pickStatus` · storyteller 차례 사건 > 독촉 > 상태 줄 > 잡담(상태 줄은 이틀 규칙 밖 · 나면 잡담 박자 0).
- 표는 CHATTER 하나에 `status: true` 표지(§pickChatter «표를 둘로 안 둔다» — 처음에 따로 표를 지었다가 dialogue_coverage 가 «안 불리는 대사»로 잡아 옮겼다). pickChatter 는 status 를 건너뛴다.
- 칸 계약: **`turn.leafWait = { leaves, newLeafToday, leafWaitDays, youngestLeafM, growStreak, arrivedOnDay, harvestedToday, harvestsSinceArrival, potOnSill, band, zoomOpenedSinceArrival }`** — 없으면 null(안 뜬다). ③-1 의 이름 그대로.
- chatGrowing2 「잎이 하나 더 생겼다」 = `grew && newLeafToday === true` — 지금 칸이 없어 **안 뜬다**(잎 수는 S 에 없고 growth leafStats 에만 있다 · 거짓말보다 침묵).
- 모의(기록 Day 13~37 를 칸으로 흉내): 14 창턱 · 15 게이지 · 20 쉬지 않고 · 22 첫 잎 넓어짐 · 30 시루 견줌 · 32 지갑 — 판에서의 날은 core 가 칸을 이은 뒤 같은 봇으로 잰다.
- 검사: dialogue_coverage PASS · test_quest FAIL 11 = 작업 전과 같은 칸.

## ★ core 가 칸을 이었다 (fb01ee3d) — 칸 뜻 셋에 대한 plan 판단
- `newLeafToday` = 가장 큰 leafBirth 보다 큰 잎이 «달린» 날(말린 새순이 서는 날). ⇒ **그대로 둔다.** 첫 새순 날은 spearFurled 사건이 먼저 말하고, 뒤의 새순이 사건 없는 날 서면 chatGrowing2 「잎이 하나 더 생겼다」가 참이다(말린 새순도 «생긴» 잎이다). «펴짐» 칸은 안 만든다.
- `youngestLeafM` = 가장 늦게 «달린» 잎(새순 0 포함). ⇒ statusLeafWide 의 「첫 잎이」를 **「막내 잎이」**로 고쳤다 — 둘째 기다림부터는 가장 어린 잎이 첫 잎이 아니다. leafWaitDays ≥ 3 이 새순 날의 0 을 막는다.
- `harvestedToday` = 아침에 보니 지난 턴 뒤 거뒀다. ⇒ **그대로 둔다.** 상태 줄은 아침 층이고, 「콩나물은 또 거뒀는데」는 어제 거둔 것에도 참이다(지난 일 말투).
- 실제 판(probe_leafwait · 창턱 지름길 70일): d3 창턱 · d5 게이지 · d8 쉬지 않고 · d9 막내 잎 · d20 지갑 · 그 뒤 30일 간격.

## 남은 것
- [core] 카드(③-3) · night_play 기록(③-4).
- ⓔ [growth] 확인 — 확인되면 표에 한 줄 더한다.
- 게이지 문턱 줄(«반은 왔어» 류)은 «수»라 몬이 말로는 안 짓는다 — 카드가 % 로 말한다.

## ★ 카드가 섰다 (core f177ebf8) — 아래 상자의 같은 수
core 걸음(probe_moncard): 카드 「몬스테라 · 잎 1장 / 어린잎 → 중간잎까지 88% / 자리 자라는 빛」 — 확대창 게이지와 한 함수(growGaugeVals)라 같은 수다. 그 아래 기존 «몬스테라 · 1그루» 상자에도 「어린잎 · 88%」가 한 번 더 있다.
⇒ **카드와 같은 그루의 단계·% 줄을 아래 상자에서 뺀다.** 같은 말이 한 화면에 둘이면 소음이다(game.html §drawGrowGauge 주석 2026-08-11 과 같은 규율). 그루가 여럿이면 카드에 안 나온 그루의 줄은 남긴다 — 그건 다른 말이다.

## ★ 단계 줄 — 자르기 기다림을 채운다 (10-08 오후 · 박사님 «자르기 문 유지» 뒤)
자르는 봇(cut1008 · D25 전) Day 37~90 말 없는 날 22/54. 그 사이를 채우던 「잘라도 안 죽어」(주 1회 7번)는 D25 로 안 난다 ⇒ 더 조용해진다.
그런데 그 구간에도 화면에서 보이는 변화가 있다 — 막내 잎 단계가 넘어간다(plant_grow §phaseAt: spear_furled → spear_opening → leaf_young → leaf_mid → leaf_mature · 새 잎 전 axis_rising).
| 줄 | 언제 | 문안 |
|---|---|---|
| statusPhaseOpening | phaseId spear_opening · 든 지 사흘 안 | 자취 「새순이 풀리기 시작했다.」 / 몬이 calm 「천천히 펴져. 하루에 조금씩.」 |
| statusPhaseYoung | leaf_young | 자취 think 「잎이 다 펴졌다. 아직 연하다.」 / 몬이 teach 「연한 잎은 아직 값을 다 못 받아. 자라야 받아.」 |
| statusPhaseMid | leaf_mid | 자취 「잎이 제법 단단해졌다.」 / 몬이 teach 「중간잎이야. 다 자란 잎이 되려면 빛이 더 쌓여야 해.」 |
| statusPhaseMature | leaf_mature | 자취 surprise 「잎이 다 자랐다.」 / 몬이 proud 「다 자란 잎이야. 값도 이제 다 받아.」 |
| statusPhaseAxis | axis_rising | 몬이 teach 「다음 잎이 올라오고 있어. 줄기 끝을 봐.」 |
| statusVarieHalf | 다 자란 무늬 잎이 «하나» | 몬이 teach 「무늬 잎 하나는 다 자랐어. 다른 하나도 다 자라면 그때 잘라.」 — D25 약속(「다 자라면 내가 말해 줄게」)의 반환점 |
- 참인지: 「값을 다 못 받아 · 다 받아」 = shop.priceOf 의 leafM 곱(갓 펼친 잎 0 · 다 자란 잎 1) — shop.js 가 «그 까닭을 사람이 알 길은 [Plan] 몫»이라 적어 둔 자리다. 「빛이 더 쌓여야」 = 성숙은 시간만으로 안 되고 굴림(빛)이 있어야 한다(plant_grow §phaseAt). 「하나」 = 자르기 문이 어느 그루에서나 «다 자란 무늬 ≥ 2»라 참.
- 규칙: 상태 줄 층(이틀 규칙 밖) · 단계에 든 지 사흘 안(사건 날에 걸려도 다음 빈 날) · 같은 줄 20일 간격(다음 잎의 같은 단계는 다시) · statusVarieHalf 60일.
- [core] 칸 셋을 turn.leafWait 에: `phaseId`(pot0 growthPhase().phaseId) · `phaseDays`(그 단계에 든 지 며칠 · 든 날 0) · `varieMatured`(varieMaturedLeavesNow — 자르기 문과 같은 자). 없으면 null → 안 뜸.
