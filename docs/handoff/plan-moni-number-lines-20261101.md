# 2026-11-01 · plan — 몬이 대사 속 수 낱말 목록 (F 다듬기 대비 · 걷지 않음)

> 근거: 총괄 D99 뒤 «몬이 수 낱말 마흔 남짓은 지금 걷지 않는다. 나중에 F 다듬기 때 게임 값(원 · 날수 · 개수)이라 판이 바뀌면 거짓이 될 수 있는 줄만 걷고, 굳은 말은 둔다. 그 전에 목록만».
> 합: 진짜 수 낱말 66줄 = ㉠ 34 · ㉠′ 2 · ㉡ 9 · ㉢ 21.
> 판: HEAD ab3f7205 뒤 `src/game/dialogue.js` SCRIPTS 의 who:'moni' 줄 전부를 정규식으로 긁고(94줄 걸림), 사람 눈으로 거짓 걸림을 뺐다.
> 거짓 걸림(뺀 것): «대단한 · 흔한 · 급한 · 정직한 · 원하는 · 연한 · 조용한 · 주문한 · 안 한 지 · 한 거야»(하다) · «월세»(세) · «네 방 · 네 집 · 네 가게 · 네 거 · 네 품종 · 네 밭 · 네 화분 · 네 것»(너의) · «남겨 둘»(두다).

갈래:
- **㉠ 게임 값** — 규칙 · 값이 바뀌면 낡는다. F 다듬기 때 걷을 줄이다. «엔진 정본»은 그 수를 정하는 자리다.
- **㉠′ 엔진에서 읽음** — 수가 엔진 값을 읽어 안 낡는다. 다만 «몬이는 수를 말하지 않는다»에는 걸린다. 걷을지는 그때 정한다.
- **㉡ 사건이 지키는 수** — 그 줄이 서는 사건 · 조건이 수를 참으로 묶는다. 판이 바뀌어도 참이다. 둔다.
- **㉢ 굳은 말** — 수가 아니라 말버릇이다. 둔다.

## ㉠ 게임 값 (34줄)

| 대사[줄] | 수 | 엔진 정본(바뀌면 낡는 자리) |
|---|---|---|
| monsteraArrived[7] «**두 번째랑 세 번째** 잎» | 두 · 세 | 프롤로그 무늬 보장 잎 차례(first_play monstera · varie_lucky / varie_lucky2) |
| varieLucky[3] «**두 번째 잎**이야» | 두 | 같은 곳 |
| varieLucky[5] «**한 장으로는 어림도 없어.**» | 한 | 무늬 잎 값 대 이사비(varie_grades leafWon · rules.moveOutCostWon) |
| varieSecond[3] «그때 한 장은 자르고, 한 장은 남기는 거야.» | 한 ×2 | 자르기 문 CUT_DOOR_VARIE_MATURED = 2(propagation) |
| statusVarieHalf[0] «무늬 잎 하나는 다 자랐어. 다른 하나도 다 자라면 그때 잘라.» | 하나 ×2 | 같은 곳 |
| questFirstCut[1] «다 자란 무늬가 하나는 남으니까.» | 하나 | 같은 곳 |
| questFirstCut[5] «**잎 한 장짜리라야** 꽂혀.» | 한 | 수경 꽂기 잎 수(propagation METHODS.water) |
| nudgeCutOffer[0] «잎 한 장짜리 마디를 잘라 꽂아 봐.» | 한 | 같은 곳 |
| monsteraGuideLamp[4] «식물등 하나.» | 하나 | 첫 등 공짜 한 개(game.html L.owned=1) |
| questOrderSeed[2] «한 봉지가 시루 하나 몫이야.» | 한 · 하나 | 씨앗 한 봉지 = 시루 한 판(shop CATALOG.bean_seed · first_play) |
| questOrderSeed[4] «시킨 건 하루 뒤에 도착해.» | 하루 | 배송 날(shop deliveryDays) |
| nudgeSeedPush[0] «상점에서 시키면 하루면 와.» | 하루 | 같은 곳 |
| nudgeSeedOffer[0] «상점에서 시켜. 하루면 와.» | 하루 | 같은 곳 |
| questCropMix[3] «그 그릇은 반값밖에 안 쳐 줘.» | 반 | 같은 반찬 되풀이 값(meal_plan 되풀이 계수) |
| nudgeMixPush[0] «상이 한 가지야. 무순을 길러야 둘째 몫이 생겨.» | 한 · 둘째 | 밥상 가짓수 몫(meal_plan) |
| questRadish5[0] «무순도 다섯 판까지 늘려 볼까.» | 다섯 | 할 일 radish5 need |
| shopRegulars3[0] «단골이 셋이야.» | 셋 | 가게 이정표 3(job_shop milestones) |
| questDoneShopRegulars3[0] «단골이 셋이야.» | 셋 | 같은 곳 |
| questSiru5[0] «시루 하나로는 하루가 안 메꿔져.» | 하나 · 하루 | 시루 한 판 몫 대 하루 밥(first_play 수확 g · mealPortionGrams) |
| questSiru8[1] «시루 하나가 하루치를 조금씩 만들어.» | 하나 · 하루 | 같은 곳 |
| autumnCame[2] «이 방 창 하나로는 모자라.» | 하나 | 반지하 창 수(house_rooms banjiha) |
| winterCame[2] «창 하나로 버티기엔 짧고.» | 하나 | 같은 곳(겨울 줄은 원룸에서도 섬 — 원룸 창 수와 견줄 것) |
| shortLearn[2] «다음 방도 창은 하나야.» | 하나 | 원룸 창 수(house_rooms oneroom) |
| shortLearn[3] «하나 남았어.» | 하나 | 이사 두 축(tutorial canMoveOut) |
| moveNoVarie[0] «무늬 하나는 들고 가자.» | 하나 | 남길 몫 규칙(D99 ① 한 규칙) |
| ppTradeDone[2] «다 팔지 말고 한 그루는 남겨 둬.» | 한 | 같은 규칙(D99 ① · 이번에 못 걷음) |
| jobStartBreed[0] · questDoneBreedFirstSample[1] · jobSwitchBreed[1] «하나 나온 건 우연이야.» | 하나 | 품종 등록 되풀이 수(job_breed) |
| breedCandidate[0] «한 번만 더 나오면 우연이 아니야.» | 한 | 같은 곳 |
| questAlPlantCorm[0] «구근 하나가 새 그루가 돼.» | 하나 | 구근 한 개 = 그루 하나(species alocasia) |
| shopNoSpecies[1] «알로카시아 구근 하나 들여 놓자.» | 하나 | 같은 곳 |
| hintScHang[0] «선반 윗단 하나를 비워 주면» | 하나 | 걸이 자리(hang_spots) |
| statusCaTooBright[0] «한 칸 안쪽으로.» | 한 | 자리 칸 간격(room slots) |

## ㉠′ 엔진에서 읽음 (2줄 · 안 낡음)

| 대사[줄] | 수 | 읽는 곳 |
|---|---|---|
| cropPlaced[0] «물을 주면 {N}일 뒤에 먹을 수 있어.» | N일 | BEAN_DAYS_KO(CROP_KINDS beansprout.harvestDays) · 못 읽으면 수 없는 말 |
| lampUnlocked[3] «첫 개만. 전기는 하루 {N}원이고.» | 첫 · 하루 · N원 | LAMP.kwhKo · 못 읽으면 «첫 개만.» |

## ㉡ 사건이 지키는 수 (9줄 · 둠)

| 대사[줄] | 수 | 왜 늘 참인가 |
|---|---|---|
| questSiruTwo[0] «하나로는 드문드문하잖아. 하나 더 있으면 자주 거둬.» | 하나 ×2 | 할 일 siru_two 가 시루 하나인 판에서 열린다 |
| questDoneSiru5[2] «그래서 하나 늘려 놨어.» | 하나 | 그 할 일 끝 사건 |
| questDoneLeafTwo[0] «한 장 더 났네.» | 한 | 잎이 난 그날 끝 |
| questDoneFirstCut[1] «한 그루가 두 그루가 된 거야.» | 한 · 두 | 첫 자르기 끝 |
| varieHalfMoon[7] «그 한 장이 크게 벌어 줘.» | 한 | 하프문 잎 그 한 장을 가리킴 |
| statusLandlordPlant[1] «잎이 둘이니까.» | 둘 | 서는 조건이 잎 둘 |
| shopNewRegular[0] «단골이 하나 늘었어.» | 하나 | 단골이 는 그 사건 |
| shopTown[1] · questDoneShopTown[1] «창턱 하나에서 여기까지 왔네.» | 하나 | 지난 이야기(반지하 창턱) |

## ㉢ 굳은 말 (21줄 · 둠)

lampUnlocked[0] «하나 알려 줄게» · brokeTalk[3] «오늘 하루는» · statusBagCuttings[0] · movedInBagCuttings[0] · statusBagCuttingsMove[0] «하루가 안 가» · statusPhaseOpening[1] «하루에 조금씩» · statusStreak[0] «하루도 안 쉬고» · chatDailySpend[1] «하루가 그만큼씩» · questSiru5[4] «하루에 물 줄 수 있는 횟수» · chatLowCash1[1] «세 번 볼 시간에» · chatAutumnShort[1] «이불 하나 더» · endingHome[5] «잎 하나씩» · questOneroomRecut[2] · nudgeRecutPush[0] «하나씩» · questCareKinds3[0] «하나씩» · questCareAllKinds[0] «한 번씩» · shortMoney[4] «한 번만» · nudgeMixOffer[0] «한 상에» · questLeafTwo[2] «같은 한 달이어도» · statusOneroomYear[1] «한 바퀴» · questBuyLamp[3] «둘째 창턱»

## 쓰는 법 (F 다듬기 때)
- ㉠만 걷는다(총괄 11-01 결정 · ㉠′ · ㉡ · ㉢ 은 그대로). 걷을 때도 «무엇을 · 어디서»는 남기고 수만 뺀다(예: «하루면 와» → «시키면 곧 와» · «단골이 셋이야» → «단골이 꽤 늘었어»). 수는 화면(할 일 칩 · 배너)이 말한다.
- ㉠ 가운데 moveNoVarie · ppTradeDone 은 D99 ① 한 규칙(«하나는 남기고 둘째부터»)을 그대로 말하는 줄이라 **둔다**(총괄 11-01 결정). F 때 ㉠ 을 걷을 때도 «규칙 줄»로 남긴다.
- 검사: 걷은 줄은 test_dialogue_coverage 의 몬이 수 정규식 목록(D97 check)에 넣어 다시 안 들어오게 한다.
