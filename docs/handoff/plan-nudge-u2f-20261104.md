# U2-f 몬이 독촉 — 임자 · 날수 · 범용 셋 (plan 명세 · 2026-11-04)

- 청: 총괄 11-04 «몬이 독촉 줄 규칙을 plan 이 명세로»(U2-f) ①~④.
- 바탕: growth a02a09ac([growth-nudgeworry-20261104.md](growth-nudgeworry-20261104.md)). plan 이 growth 판 기록(고정 복사본 byeot-pin-nudge-8aa170ce `runs/GH_tr` · `runs/JGH_*_tr`)을 다시 셌다. 읽기만 했다.
- 판: 줄 번호는 origin/main a1154216 것이다. dialogue.js · quest.js · nudge_wait.js · probe_branches.mjs 는 8aa170ce 와 같다. game.html 만 2줄 밀렸다.
- 바꾸는 것은 규칙 넷이다. 글은 0줄 바뀐다. 값(NUDGE_DAYS · gap)도 0 바뀐다.

---

## 한눈에

| | 지금 | 새 규칙 |
|---|---|---|
| ① 임자 | 가장 먼저 열린 안 끝난 줄 · 대사 쪽 방 판정에 movedHome 없음(dialogue.js:4616) | **칩 줄**(questView(…).chip 과 같은 자) |
| ① 날수 | 열린 날(또는 마지막 기다린 날 다음)부터 | **칩에 선 날부터** — 칩이 아니던 날은 기다린 날로 적는다 |
| ② 범용 셋을 안 내는 줄 | LONG_OWN 셋 | + 쌓는 줄 16 · 고른 줄 둘은 걱정만 안 냄 |
| ③ movedHome | 대사 쪽만 없음 | ①로 닫힘. ②와 한 덩이 · 한 push |
| ④ 제 줄 이튿날 | 범용 줄이 그물로 섬 | 그 임자의 제 줄이 같은 칸에서 조건으로 서는 날엔 범용 셋이 안 섬 |
| 덧 | — | 새 줄(fresh0)이 화면 칩을 쥔 날은 범용 셋이 쉼 |

---

## 본 것 (plan 셈 · growth 판 기록)

- **임자 = 칩인 날**(임자가 있는 날 중):

  | 판 | 반지하 | 원룸 | 투룸 |
  |---|---|---|---|
  | GH 사람 22판 | 992 / 1,082 | 5,148 / 5,185 | (날 없음) |
  | JGH 진로 44판 | 518 / 563 (판마다 같음) | 2,374 / 2,396 | **0 / 2,830** |

  - 반지하 · 원룸에서 어긋난 날은 한 판에 2~3일이다. crop_mix→siru8 · sell_surplus→radish5 · settle_cutting→home_fund · 이사 날 sell_varie→oneroom_unpack 이다. 칩은 저녁(손 뒤) 값이고 임자는 아침 값이라, 이 때 다름이 섞여 있다.
  - 칩 아닌 줄을 두고 범용 줄이 선 것은 둘이다. 반지하 nudgeOffer(sell_surplus · 칩 radish5)가 판마다 1번 섰다. 투룸 nudgeWorry 93번은 모두 pp_hold_pink 를 두고 섰다.
- **movedHome 만 고친 판**(trace 의 칩 쪽 방 판정으로 임자를 다시 고른 셈): 투룸에서 임자 ≠ 칩인 날이 이만큼이다.
  - shop71: 5,198 / 8,009 — sc_hang→shop_town 3,711 · pp_hold_pink→shop_town 794 · pp_hold_pink→sc_hang 442.
  - careR: 2,659 / 4,690 — care_all_kinds→care_town 2,619.
  - breedR: 86 / 7,037.
  - switchW: 4,739 / 10,211.
  - ⇒ 고침만 넣으면 칩에 없는 줄(sc_hang · pp_hold_pink · care_all_kinds)을 두고 범용 셋이 선다.
- **투룸 칩**: 진로 줄 · sc_hang · 빈 칩뿐이다. 빈 칩은 careR 3,326 · breedR 979 · switchW 13 판-날이다. pp_hold_pink 가 칩이 된 날은 44판 모두 0 이다.
- **제 줄 다음 날 범용 줄**: GH 범용 줄 117 중 66이 «같은 임자 · 어제 제 줄» 뒤에 섰다.
  - nudgeSiruPush → 이튿날 nudgeWorry(siru8) 22.
  - nudgeSiruComing → 이튿날 nudgeAsk(siru5_cycle5) 22.
  - nudgeVarieOffer → 이튿날 nudgeOffer(varie_bright) 13.
  - nudgeVarieWait → 이튿날 nudgeWorry(varie_bright) 8. «뿌리낼 때까지 기다려. 밝을수록 무늬가 좋아.» 다음 날 «할 일이 며칠째 그대로야. 막힌 데 있어?»이다.
  - nudgeVarieOffer → 이튿날 nudgeAsk 1.

---

## ① 임자와 날수

- 후보
  - ㉠ 지금 그대로.
  - ㉡ 임자는 그대로(가장 먼저 열린 줄). 날수만 «임자가 된 날부터» 센다.
  - ㉢ 임자 = 칩. 날수 = 칩에 선 날부터.
- 고른 것: ㉢.
- 까닭
  - 범용 셋의 글은 칩을 가리킨다(«할 일에 적힌 거» · «할 일이 며칠째 그대로야»). 임자가 칩과 다르면 그 줄은 거짓이다.
  - ㉡은 446 은 막는다. 그러나 투룸 내내 pp_hold_pink 가 가장 먼저 열린 줄이라 임자로 남는다. 그러면 447 권함 · 450 물음 · 453 걱정이 칩(shop_*)과 어긋난 채 선다.
  - 반지하 · 원룸은 지금도 임자 = 칩이 92~99% 다. 바뀌는 날은 한 판에 2~3일이다.
  - movedHome 갈림이 따로 고칠 것 없이 닫힌다. 칩의 방 판정은 movedHome 을 안다(quest.js:1781 `questRoomOk(q, s)` · s = 판 사진). 쉬는 진로 줄(switchW · 열린 적만 있음)은 칩이 안 되므로 임자도 안 된다. 4616 식으로 «열린 적 있음»으로 고르면 쉬는 줄이 임자가 되어 JOB_REST_TODO 줄을 두고 독촉한다.
- 규칙
  - `c.nudge` = 칩 줄. 칩은 quest.js:1853 `chipId` 와 같은 자다: 정의 차례로 첫 «열린 · 기다리지 않는» 줄이다.
  - 칩이 기다림 줄이거나 없으면 `c.nudge` 는 null 이다. 칩 줄의 열린 날(questsOpenedOn)을 모르면 null 이다(지금과 같음).
  - 날수 = nudgeDaysOf 그대로다. 다만 noteQuestWaits(nudge_wait.js:141)가 «열렸고 안 끝났는데 오늘 칩이 아닌 줄»도 `questsWaitedOn[id] = 오늘`로 적는다.
    - 새 세이브 칸은 없다. questsWaitedOn 을 읽는 곳은 nudgeDaysOf(nudge_wait.js:157) 하나다(save.js 는 싣고 풀기만 · probe_nudge.mjs 는 자).
    - 오늘 칩이 된 줄은 어제 적혀 있으므로 첫날 날수가 0 이다. 권함은 이튿날부터다.
  - 칩은 아침 story.turn 앞(noteQuestWaits 자리)에서 한 번 고른다. noteQuestWaits 와 chatterContext 가 같은 값을 쓴다.
  - 새 줄(fresh0 · game.html:14192 와 같은 자)이 화면 칩을 쥔 날(48시간)은 범용 셋이 쉰다. 제 줄은 선다(무엇을 하라는지 말에 있다). 칩이 아닌 줄로 적는 것은 qv.chip 기준이다 — fresh0 가 있어도 qv.chip 줄의 날수는 그대로 간다.
- 참인 조건: 범용 셋이 선 날, 그날 화면 칩 = `c.nudge.id` 다. 그 줄이 칩에 «기다리지 않고» 선 지 `c.nudge.days` 일째다.

---

## ② 오래 열린 줄 — 셋 갈래

| 갈래 | 줄 | 범용 셋 | 까닭 |
|---|---|---|---|
| 손 줄 | 나머지 모두(짐 풀기 셋 home_unpack · care_unpack · breed_unpack 포함) | 그대로(권함 · 물음 · 걱정) | 지금 손으로 끝낸다 |
| 쌓는 줄 | 지금 LONG_OWN 셋(oneroom_home_fund · radish5 · al_keep_winter) + shop_first_order · shop_regulars3 · shop_sign · shop_town · care_first · care_kinds3 · care_sign · care_town · care_all_kinds · breed_first_sample · breed_first_variety · breed_three · breed_three_lines · breed_all · sc_hang · ca_unfurl | 안 냄 | 손을 해도 날이 지나야 끝난다 |
| 고른 줄 | pp_hold_pink · al_plant_corm | 권함 · 물음만(걱정 안 냄) | 곁줄이다. 안 해도 판이 간다 |

- 쌓는 줄의 까닭
  - 할 일 글이 «주문판에 주문이 붙기를 기다리세요» · «단골 n명 — 서른까지 30명» · «무늬 삽수·핑크프린세스 잎·구근 싹이 적힙니다» 꼴이다.
  - 이 동안 «막힌 데 있어?»는 거짓이다. 10-09 에 집 자금을 범용 셋에서 뺀 까닭과 같다(«막힌 게 아니라 모으는 중»).
  - sc_hang 은 걸어 둔 뒤 줄기가 길어지기를, ca_unfurl 은 자리를 옮긴 뒤 잎이 펴지기를 기다린다. nudge_wait 는 이 기다림을 모른다. 제 줄이 있다(hintScHang · statusCaTooBright).
  - 진로는 제 판(주문판 · 맡김판 · 기록장)과 잡담(chatShop* · chatCare* · chatBreed* gap 21 · hintShopDry · hintBreed*)이 말한다.
- 고른 줄의 후보
  - ㉠ 쌓는 줄로 둔다(셋 다 안 냄).
  - ㉡ 권함 · 물음만 낸다.
  - ㉢ 걱정을 한 번만 낸다.
  - 고른 것: ㉡.
  - 까닭: 칩에 처음 선 줄에 «해 보면 알 거야» 한 번은 참이고 쓸모 있다. 걱정은 30일마다 끝없이 돌아온다(shop71 g · 10 은 25번). pp_hold_pink 는 분홍 섞인 마디가 없으면 못 하는데 nudge_wait 는 그것을 모른다. 그러면 «막힌 데»는 사람 탓이 아니다. ㉢은 «한 번»을 셀 새 칸이 든다.
  - 끝: 물음 칸(4~6일)이 지나면 고른 줄은 말이 없다. 칩에서 내려갔다 다시 서면(①) 권함부터 다시 한다.
- 되풀이 간격 · 끝: 값은 그대로다(gap 30 · NUDGE_DAYS 4 · 7 · 14). 손 줄의 걱정은 지금처럼 끝이 없다(D19 «물러서지 않는다»).
- nudgeBack: 규칙 그대로다(`c.nudge` 가 null 인 날만). 쌓는 줄이 칩이면 `c.nudge` 가 있으니 안 선다. 지금 home_fund 와 같다.
- 참인 조건
  - 범용 셋이 선 날, 임자는 손 줄이다. 고른 줄이면 권함 · 물음이다.
  - nudgeBack 이 선 날, 칩이 없거나 칩이 기다림 줄이다.

---

## ③ movedHome 과 한 덩이

- ①을 넣으면 dialogue.js:4616 의 questRoomOk 부름이 없어진다(임자를 칩에서 받는다).
- ①과 ②는 한 덩이 · 한 push 로 넣는다. ⛔ 임자만 먼저 바꾸면 투룸 진로 칩마다 범용 셋이 선다. 진로 칩-날은 shop71 만 8,009 다.
- 기대(셈)
  - 투룸 범용 줄 93 → 0. 투룸 칩은 쌓는 줄 · 짐 풀기(판마다 칩에 하루 · 그날 날수 0) · 빈 칩뿐이다.
  - 투룸 nudgeBack 388 → 빈 칩 날에만 선다(careR · breedR · switchW · gap 30).

---

## ④ 제 줄 이튿날 범용 줄

- 후보
  - ㉠ 그대로 둔다(D19 «퀘스트별 줄이 없거나 그 줄이 어제 난 날의 그물»).
  - ㉡ 걱정만 뺀다.
  - ㉢ 범용 셋 모두 뺀다. 그 임자의 제 줄이 같은 칸(권함 1~3일 · 물음 4~6일 · 걱정 7일~)에서 조건으로 서는 날엔 범용 줄이 안 선다. 간격이나 «이틀 잇달아»에 막혀 제 줄이 못 선 날도 같다.
- 고른 것: ㉢. D19(plan 10-08)의 «그 줄이 어제 난 날의 그물» 반쪽을 거둔다.
- 까닭
  - 이튿날 범용 줄은 어제 한 말을 흐리게 되풀이한다.
  - nudgeVarieWait «뿌리낼 때까지 기다려» 다음 날 «막힌 데 있어?»는 서로 부딪힌다(GH 8).
  - siru8 은 «시루가 늘면 거두는 것도 늘어» 다음 날 «할 일이 며칠째 그대로야»를 22판 모두 듣는다. 이튿날 Day 22 에 끝난다.
  - 제 줄은 이레에 한 번 다시 선다(NUDGE_LINE_GAP 7). 그것으로 모자라지 않다.
- 손: 범용 셋의 when 에 조건 하나를 더한다 — «표에서 범용 셋보다 앞에 있는 nudge 줄 중 오늘 when 이 참인 것이 없다»(repeatOk 는 안 본다).
  - 앞줄(4203~4269)은 모두 `c.nudge.id` 로 걸려 있다. 그래서 «오늘 when 이 참인 앞줄» = «그 임자의 오늘 칸 제 줄»이다.
- 남는 것: nudgeSiruComing(권함 칸) → 이튿날 범용 물음(siru5 · 22)은 둔다. 칸이 달라 되풀이가 아니다.
- 기대: GH «제 줄 다음 날 범용 줄» 66 → 22.
- 참인 조건: 범용 줄이 선 날, 그 임자에게 그 칸의 제 줄이 없거나 제 줄의 조건이 거짓이다.

---

## 바꾸지 않는 것

- 글 0줄: nudgeOffer · nudgeAsk · nudgeWorry · nudgeBack 글 그대로.
- 값 0: NUDGE_DAYS { ask 4 · worry 7 · back 14 } · 범용 gap 30 · NUDGE_LINE_GAP 7 · 차례(사건 > 독촉 > 상태 > 잡담).
- 제 줄 · 긴 줄의 조건은 그대로다.
- 판 값(지갑 · 날 · 갈래)은 그대로다. 대사만 바뀐다.

## core 손 자리 (a1154216 줄)

- dialogue.js:4602~4621 chatterContext.nudge — 칩을 받는다. 부르는 쪽이 아침에 고른 칩(turn 칸 하나 꼴 · 이름은 core)을 넘긴다.
- dialogue.js:4020 LONG_OWN_LINES 곁에 쌓는 줄 · 고른 줄 표를 둔다(이름은 core).
- dialogue.js:4275~4277 범용 셋 when — ② 표 · ④ 앞줄 조건 · 덧 fresh0.
- dialogue.js:4271 주석 — «퀘스트별 줄이 없거나 그 줄이 어제 난 날의 그물» → «퀘스트별 줄이 없는 칸의 그물».
- nudge_wait.js:141 noteQuestWaits — 칩 id 를 받아 칩이 아닌 열린 줄도 적는다.
- game.html:15414 · probe_branches.mjs:360 · 794 — 아침에 칩을 고르고 넘긴다. 794(저녁 손 뒤 부름)를 어떻게 맞출지는 core 가 가른다. game.html 과 같은 셈이면 된다.

## 잴 차례

- ㉮ growth: V1 · GH · H0 · JGH 앞뒤. 판 값 0 차이 · 방마다 범용 셋 수 · nudgeBack 수 · 투룸 446 줄 0.
- ㉯ 범용 줄이 선 날, 그날 화면 칩(fresh0 || chip) ≠ 임자인 날 0.
- ㉰ 걱정이 선 날마다 그 줄이 칩에 7일 넘게 잇달아 섰다(기다림 날 뺌).
- ㉱ 쌓는 줄을 두고 선 범용 줄 0 · 고른 줄을 두고 선 걱정 0. 고른 줄 권함 · 물음은 칩 토막마다 많아야 하나씩이다.
- ㉲ GH «제 줄 다음 날 범용 줄» 66 → 22(siru5 Coming→물음만 남음).
- ㉳ 옛 세이브: questsWaitedOn 에 «칩 아닌 날» 기록이 없다. 켠 첫날 칩 줄 날수는 예전 셈이다. 다시 켠 첫날 걱정이 서는 판이 있는지 본다(force5 옛 세이브 · byeot-core-keep/critic8/tworoom_shop_first.json).
- ㉴ core node: test_dialogue_coverage · probe_nudge 의 독촉 단언 — 고치기 전 빨강 / 고친 뒤 초록.

## 단서

- 칩 셈 때: growth 판 기록의 chip 칸은 저녁(손 뒤) 값이고 임자(nz)는 아침 값이다. 위 «반지하 · 원룸 2~3일»에는 이 때 다름이 섞였다. ㉯는 아침 칩으로 잰다.
- nudgeBack «급한 건 아니야. 마음 내키면 해.»가 할 일을 다 끝낸 날(빈 칩)에도 서는 것은 D19 대로 둔다. careR 은 투룸 3,326 판-날이 빈 칩이다. 이번 청에 없어 손대지 않았다.
