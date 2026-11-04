# [growth] F1 새 잎 펼치기 💠 — 사람 판에서 몇 번 서나 (72bfab29 · 2026-11-04)

총괄 11-04 18시 청 · **재기만**(게임 값 · 코드 · 저장소 하네스 손 0).
💠 자리: plan-ui-fun-20261103 §F1 — «무늬 잎이 성숙해 등급이 드러날 날» = shop.js §assignPotLeafGrades 의 `assigned`(game.html §notePotLeafGrades 가 놓인 화분마다 부름) 중 프롤로그 잎(why = 'prologue')이 아닌 것.

## 한눈에

```
                        💠 설 날(프롤로그 밖 모주 잎이 드러난 날)                         [어림] 삽수 무늬 잎에 💠 를 둔다면
사람 22판(게임 손 · 700일)  합 4 · 4판에 하루씩 · 18판 0 · 원룸 4 · 봄 2 · 여름 2 · 겨울 0      합 59 · 판마다 가운데 2(1~6) · 0 인 판 0 · 원룸 59
진로 44판(게임 손 · 1300일) 합 12 · 12판에 하루씩 · 32판 0 · 원룸 8 · 투룸 4 · 봄 · 여름 · 가을 4 · 겨울 0   합 692 · 가운데 5.5(1~59) · 투룸 584
```
- 💠 는 씨앗 g · 1 · 10 판에만 선다(사람 판은 g · 10). 판마다 모주 잎 하나다 — 씨앗 g 5번째 잎 하프문 · 씨앗 10 4번째 잎 풀문 · 씨앗 1 7번째 잎 하프문(투룸 · 진로 판만). 다른 씨앗은 프롤로그 잎 2 · 3 밖에 무늬 잎이 안 드러난다.
- **정해진 날 → 드러난 날이 넉 달이다**(가운데 128 · 124~174일). 그래서 정해졌는데 판 끝까지 안 드러난 무늬 잎이 사람 판 2 · 진로 판 12 장 있다(판이 내 집 · 1300일에서 끝남).
- ② 삽수 잎은 💠 길을 안 탄다. 잎이 날 때 무늬 · 등급이 바로 정해지고(propagation.js §cutting_leaf · 성숙 단계 없음), 그 사건은 loop.js 879 로 turn.events 에 실리지만 cutting_leaf 를 받는 대사 · 배너가 없다(game.html · dialogue.js grep 0) — 지금 화면엔 조용히 지나간다.
- ③ 씨앗 그루: 사람 · 진로 판 모두 화분이 늘 하나다(66판 판마다 최대 1). 하네스 사람에게 몬스테라 씨앗을 심는 손이 없다. 게임은 씨앗 그루도 놓인 화분이면 notePotLeafGrades 를 탄다(game.html 3906~ · D82 ④) — 그 길은 이 판으로 못 잰다.
- F1-b(0ff07309 · shop §isProloguePot)는 이 판과 같다 — 사람 22판 trace(등급 · 삽수 잎 · 지갑 · 대사) 다른 판 0/22 · 진로 44판 0/44. F1(672b5634)은 src 차이가 save.js(S.unfurl · S.album 싣기) 하나라 node 판(--dump 없음)으로는 72bfab29 와 같다.

### ⑪ «온습도계 Day 64 뒤 무늬 잎 3장»이 센 것(엇갈림 풀이)

- e8db1d4e ⑪ 은 GH_base_r(e31cc01c · 게임 물 · 게임 손 · **맨손** · 장비 레버 없음) 22판에서 trace newGrades 를 **모주 · 삽수 합쳐** Day 64 뒤 · 내 집 전으로 센 것이다 — 68장 중 삽수 잎 62 · 모주 6.
- newGrades 는 `graded`(잎이 날 때 조용히 정함)다. 💠 는 `assigned`(성숙해 드러남)라 다른 날이다. 모주 6장은 6판에 한 장씩(예: humanQ g leafBirth 496 하프문 · 정함 Day 199 → 드러남 Day 330)이다.
- 그래서 «pot_01 등급은 프롤로그 2·3 뿐»(core · 세이브 1,929개)은 이 판들에선 맞지 않다. 세이브는 잎 상태를 싣지 않고 다시 키우므로(growth 11-01 확인) 세이브 장부엔 아직 안 드러난 잎이 안 보였을 수 있다 — 짐작이라 core 가 세이브 날짜를 보면 가려진다(💠 잎은 Day 240 · 329~330 · 467~494 에 드러남).

## 판

```
고정 복사본  C:/Users/pc/AppData/Local/Temp/byeot-pin-f1-72bfab29 (git archive 72bfab29) · 견줌 …/byeot-pin-f1b-0ff07309
하네스      probe_branches(51ebf8f4 → 0ff07309 같음) + 장비 깃발(게임 물 · 게임 손) + 덧줄 f1(--trace 때만 · 읽기만)
            f1 = 하네스가 이미 날마다 부르는 assignPotLeafGrades(첫 화분 · 그 턴 띠)의 graded · assigned[leafBirth · leafNo · 등급 · why]
            + 그날 철(light.skyFor · 게임 계절) · 화분 수 · 삽수 잎 사건(cutting_leaf: 무늬 · 등급)
규칙 확인    게임과 같은 함수 · 같은 날 · 같은 띠: game.html §noteLeafGrades → notePotLeafGrades(lead 는 t.growthSpeed.band)
            = probe_branches 348(턴마다 pot0 · turn.growthSpeed.band). 성숙(r.matured)은 같은 growth leafState 다
덧줄 무해    FV1(덧줄 켬 · 7사람 × g,1 · --trace) = 원본 72bfab29 판(D29V1 · 8bbb0544 = core) — 장비 덧줄 빼면 다른 자리 0
판          FGH  사람 22판(humanQ · guide × g,1-10 · 700일 · --targets 5000000)
            FJ   진로 넷(shop71 · careR · breedR · switchW × g,1-10 · 1300일 · core 크롬 틈에 들게 씨앗 반씩 돌려 합침)
💠 날 셈     그날 assigned 에 why ≠ 'prologue' 가 하나라도 있으면 1(하네스는 화분 하나)
삽수 어림    그날 cutting_leaf 중 무늬 잎이 하나라도 있으면 1(삽수 잎은 날 때가 곧 등급이 정해지는 때)
```

## 판마다 · 철마다

```
■ 사람 22판(게임 손 · 700일)
판            💠  봄 여름 가을 겨울 | 삽수 어림  봄 여름 가을 겨울 | 💠 날(철 · 등급 · 방 · 정한 날)
humanQ|g       1    0   1   0   0 |     2       0   1   0   1 | Day 330(여름 · halfmoon · oneroom · 정함 199)
humanQ|1       0    0   0   0   0 |     2       1   0   0   1 | 
humanQ|2       0    0   0   0   0 |     3       0   1   2   0 | 
humanQ|3       0    0   0   0   0 |     5       2   1   0   2 | 
humanQ|4       0    0   0   0   0 |     4       3   1   0   0 | 
humanQ|5       0    0   0   0   0 |     4       2   1   0   1 | 
humanQ|6       0    0   0   0   0 |     3       1   2   0   0 | 
humanQ|7       0    0   0   0   0 |     3       2   0   0   1 | 
humanQ|8       0    0   0   0   0 |     1       0   0   0   1 | 
humanQ|9       0    0   0   0   0 |     4       3   0   0   1 | 
humanQ|10      1    1   0   0   0 |     1       0   0   0   1 | Day 241(봄 · fullmoon · oneroom · 정함 116)
guide|g        1    0   1   0   0 |     1       1   0   0   0 | Day 329(여름 · halfmoon · oneroom · 정함 197)
guide|1        0    0   0   0   0 |     2       1   0   0   1 | 
guide|2        0    0   0   0   0 |     5       0   3   0   2 | 
guide|3        0    0   0   0   0 |     6       2   2   0   2 | 
guide|4        0    0   0   0   0 |     2       1   1   0   0 | 
guide|5        0    0   0   0   0 |     2       1   0   1   0 | 
guide|6        0    0   0   0   0 |     2       1   1   0   0 | 
guide|7        0    0   0   0   0 |     1       1   0   0   0 | 
guide|8        0    0   0   0   0 |     1       0   0   0   1 | 
guide|9        0    0   0   0   0 |     4       3   0   0   1 | 
guide|10       1    1   0   0   0 |     1       1   0   0   0 | Day 240(봄 · fullmoon · oneroom · 정함 116)
합             4    2   2   0   0 |    59      26  14   3  16 |
■ 진로 44판(게임 손 · 1300일)
판            💠  봄 여름 가을 겨울 | 삽수 어림  봄 여름 가을 겨울 | 💠 날(철 · 등급 · 방 · 정한 날)
breedR|g       1    0   1   0   0 |    59      19  15  15  10 | Day 329(여름 · halfmoon · oneroom · 정함 197)
breedR|1       1    0   0   1   0 |    43       6  15  15   7 | Day 467(가을 · halfmoon · tworoom · 정함 320)
breedR|2       0    0   0   0   0 |    46       9  21  11   5 | 
breedR|3       0    0   0   0   0 |    51      18  17  10   6 | 
breedR|4       0    0   0   0   0 |    38       6  16  12   4 | 
breedR|5       0    0   0   0   0 |    52      15  16  14   7 | 
breedR|6       0    0   0   0   0 |    49      10  23  11   5 | 
breedR|7       0    0   0   0   0 |    34      10  17   7   0 | 
breedR|8       0    0   0   0   0 |    39       7  13  13   6 | 
breedR|9       0    0   0   0   0 |    52      18  18  11   5 | 
breedR|10      1    1   0   0   0 |    40      15  10  10   5 | Day 240(봄 · fullmoon · oneroom · 정함 116)
careR|g        1    0   1   0   0 |    13       4   5   4   0 | Day 329(여름 · halfmoon · oneroom · 정함 197)
careR|1        1    0   0   1   0 |     6       2   1   2   1 | Day 494(가을 · halfmoon · tworoom · 정함 320)
careR|2        0    0   0   0   0 |    16       3   7   4   2 | 
careR|3        0    0   0   0   0 |    20       7   7   4   2 | 
careR|4        0    0   0   0   0 |     8       1   4   3   0 | 
careR|5        0    0   0   0   0 |     7       2   3   2   0 | 
careR|6        0    0   0   0   0 |    16       6   7   3   0 | 
careR|7        0    0   0   0   0 |     9       4   1   4   0 | 
careR|8        0    0   0   0   0 |     6       3   1   1   1 | 
careR|9        0    0   0   0   0 |    20       8   5   6   1 | 
careR|10       1    1   0   0   0 |    10       5   3   2   0 | Day 240(봄 · fullmoon · oneroom · 정함 116)
shop71|g       1    0   1   0   0 |     2       1   0   1   0 | Day 329(여름 · halfmoon · oneroom · 정함 197)
shop71|1       1    0   0   1   0 |     2       1   0   0   1 | Day 494(가을 · halfmoon · tworoom · 정함 320)
shop71|2       0    0   0   0   0 |     5       0   3   0   2 | 
shop71|3       0    0   0   0   0 |     5       2   1   0   2 | 
shop71|4       0    0   0   0   0 |     2       1   1   0   0 | 
shop71|5       0    0   0   0   0 |     1       1   0   0   0 | 
shop71|6       0    0   0   0   0 |     3       1   2   0   0 | 
shop71|7       0    0   0   0   0 |     1       1   0   0   0 | 
shop71|8       0    0   0   0   0 |     1       0   0   0   1 | 
shop71|9       0    0   0   0   0 |     5       3   1   0   1 | 
shop71|10      1    1   0   0   0 |     2       2   0   0   0 | Day 240(봄 · fullmoon · oneroom · 정함 116)
switchW|g      1    0   1   0   0 |     2       1   0   1   0 | Day 329(여름 · halfmoon · oneroom · 정함 197)
switchW|1      1    0   0   1   0 |     2       1   0   0   1 | Day 494(가을 · halfmoon · tworoom · 정함 320)
switchW|2      0    0   0   0   0 |     5       0   3   0   2 | 
switchW|3      0    0   0   0   0 |     5       2   1   0   2 | 
switchW|4      0    0   0   0   0 |     2       1   1   0   0 | 
switchW|5      0    0   0   0   0 |     1       1   0   0   0 | 
switchW|6      0    0   0   0   0 |     3       1   2   0   0 | 
switchW|7      0    0   0   0   0 |     1       1   0   0   0 | 
switchW|8      0    0   0   0   0 |     1       0   0   0   1 | 
switchW|9      0    0   0   0   0 |     5       3   1   0   1 | 
switchW|10     1    1   0   0   0 |     2       2   0   0   0 | Day 240(봄 · fullmoon · oneroom · 정함 116)
합            12    4   4   4   0 |   692     204 241 166  81 |
```

## 안 잰 것

- 씨앗 그루 · 둘째 화분 — 하네스 사람에게 심는 손이 없다(게임은 화분마다 탄다).
- 💠 를 누른 뒤 · 안 누르고 넘긴 아침 — 화면(크롬) 판 · core probe_f1_unfurl 몫.
- 하네스 손 판 — 총괄 청대로 게임 손만.

## 다시 재기

```
1  git archive 72bfab29 · probe_branches 에 장비 패치(LF diff) + 덧줄 f1(growth 메모장 patch_f1.mjs: assignPotLeafGrades 결과의 graded · assigned 를 trace f1 에 · sea · pots · cutLeaves)
2  7사람 × g,1 --trace 를 원본 판과 견줌(장비 덧줄 빼고 0)
3  EQ_GAMEWATER=1 EQ_GAMEHAND=1 · humanQ,guide g,1-10 700일 · 진로 넷 g,1-10 1300일 · --trace
4  셈: growth 메모장 cmp_f1.mjs(결과 growth-f1-unfurl.json)
```
