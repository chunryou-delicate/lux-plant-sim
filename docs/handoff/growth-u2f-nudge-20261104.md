# [growth] U2-f 몬이 독촉 앞뒤 — 8aa170ce(앞) · 51ebf8f4(뒤) (2026-11-04)

총괄 11-04 청 · plan 명세 [plan-nudge-u2f-20261104.md](plan-nudge-u2f-20261104.md) «잴 차례» ㉮~㉲ · **재기만**(게임 값 · 코드 · 저장소 하네스 손 0).
바탕: [growth-nudgeworry-20261104.md](growth-nudgeworry-20261104.md)(a02a09ac).

## 한눈에

- **규칙은 네 판 모두 명세대로 선다.** 뒤 판에서 ㉯ 화면 칩 ≠ 임자 0 · ㉰ 칩에 7일 못 된 걱정 0 · ㉱ 쌓는 줄 · 고른 줄을 두고 선 범용 줄 0 · 투룸 이사 이튿날 걱정 0 · 투룸 nudgeWorry 93 → 0 · 투룸 nudgeBack 388 → 52(52번 모두 화면 칩이 빈 날 — D19 대로 둔 줄).
- ㉲ «제 줄 다음 날 범용 줄»은 GH 66 → **23**(plan 기대 22). 남는 하나는 guide 7 Day 147 — 전날 nudgeVarieOffer(1~3일째 제 줄) 뒤 4일째 범용 물음이다. 그날은 제 줄이 서는 칸이 아니라 명세 ④ 대로다.
- **판 값은 0 차이가 아니다.**
  - 하네스 손(V1 · H0): 끝 지갑 · 이사 날 · 끝 날 모두 같다. 반지하 Day 37~81 사이 중간 지갑만 판마다 12~24일 동안 2,500~5,000원 갈렸다가 돌아온다(core pb_cmp23 과 같음).
  - 게임 손(GH · JGH): 씨앗 8 판 여섯이 Day 46 에서 갈려 끝까지 번진다 — humanQ 8 은 이사 135 → 140 · 내 집 323 → **440**(+117일), guide 8 끝 지갑 −8,000원, 진로 넷 씨앗 8 끝 지갑 −8,300 ~ +603,410원.
  - 까닭은 반지하 사건 카드 미룸(D98 ㉮)이다. 게임(game.html:15434)과 하네스(probe_branches 382) 모두 «nudgeSiruPush 가 선 날 카드는 내일»로 민다. U2-f 로 nudgeSiruPush 가 덜 서서(GH 미룸 16 → 4 · JGH 32 → 8) 카드 날 차례가 당겨진다. 보인 카드 묶음 · 카드 돈 합은 모든 판에서 같다.
  - 씨앗 8 은 Day 46 카드가 앞 parcel(택배) → 뒤 cat2(고양이)로 바뀌며 그날 게임 손 손일이 14 → 15 로 갈린다. 그 뒤 김치(+2,500원) 날이 빠지고 체력 일정이 밀린다. 장비 재기 때 본 «하루 밀림만으로 내 집이 판마다 −143~+107일 튄다»(growth-equip-sensitivity)와 같은 결이다.
- 독촉 규칙 자체가 지갑을 바꾸는 손은 없다. 카드 미룸이 독촉 줄을 보는 한, 독촉 줄 수가 바뀌면 카드 날이 따라 움직인다 — 가름은 plan · 총괄 몫이다.

## 판

```
고정 복사본  앞 C:/Users/pc/AppData/Local/Temp/byeot-pin-u2f-b-8aa170ce · 뒤 …/byeot-pin-u2f-a-51ebf8f4 (git archive · src tools data vendor *.html)
            원본 대조 …/byeot-pin-u2f-r-51ebf8f4(패치 없음)
하네스      앞 = 8aa170ce probe_branches · 뒤 = 51ebf8f4 probe_branches(core U2-f 13줄 — 아침 questChipAfterCheck → noteQuestWaits(chipId) → turn.nudgeChip · trace amChip)
            둘 다 같은 덧대기: 장비 깃발(EQ_GAMEWATER · EQ_GAMEHAND = 게임 물 · 게임 손) + 덧줄 nz(growth-nudgeworry) + 덧줄 mc(아래)
            덧댄 두 파일끼리 다른 줄 13 = core U2-f 하네스 고침 13줄 그대로
덧줄 mc     --trace 때만 · story.turn 바로 뒤 · 같은 snap 하나로
            [아침 fresh0 · 아침 chip · 기다림 · 끝날 줄[] · 열릴 줄[] · 판정 뒤 fresh0 · 판정 뒤 chip · 기다림]
            판정 뒤 = 베낀 S2 에서 stepQuests(S2, snap) 한 번(quest.js:1869 questsFinishingNow 와 같은 베낌) → 끝날 줄을 S2.questsTaken 에 push 만(grantStaminaQuest 안 부름) → questView(S2, snap)
            ㉯ 화면 칩 = 판정 뒤 (fresh0 || chip) — plan 3d125519 · 8a44c714 «checkQuests 뒤 칩»
해시 확인   앞 V0(trace 없음) = ccf56040 판 · 뒤 V0 = 원본 51ebf8f4 판(e3c2e93c) — 장비 덧줄 넷 빼면 다른 자리 0
            앞 · 뒤 V1(--trace · 덧줄 켬) = 같은 복사본 V0 — traceFile 칸 14 말고 0(미리 보기 판정이 판을 안 건드림)
            덧댄 아침 칩 셈 = core amChip.s — 뒤 판 76,386 칸 모두 같음
판          V1  대조 판(humanQ · guide · lazy · shop · careR · breedR · switchW × g,1 · --jobs 1 · --trace)
            GH  사람 22판 게임 물 · 게임 손(humanQ · guide × g,1-10 · 700일 · --targets 5000000)
            H0  같은 22판 하네스 손
            JGH 진로 넷 게임 손(shop71 · careR · breedR · switchW × g,1-10 · 1300일 · core 크롬 틈에 들게 사람마다 · 씨앗 반씩 나눠 돌려 합침)
```

## ㉮ ~ ㉲ 앞 → 뒤

```
판(앞 → 뒤)            범용 셋 합(반지하 · 원룸 · 투룸)       걱정        nudgeBack 투룸   ㉯ 칩≠임자   ㉰ 7일 못 된 걱정   ㉱ 쌓는 줄 · 고른 줄 걱정   ㉲ 제 줄 다음 날
V1  14판               68 · 36 · 11  →  38 · 14 · 0          64 → 1      20 → 0          24 → 0       25 → 0             0 · 11 → 0 · 0           53 → 16
GH  22판(게임 손)       102 · 15 · —  →  56 · 23 · —          36 → 3      —               24 → 0       22 → 0             0 · 0 → 0 · 0            66 → 23
H0  22판(하네스 손)     96 · 22 · —   →  54 · 30 · —          39 → 7      —               22 → 0       22 → 0             0 · 0 → 0 · 0            62 → 22
JGH 44판(진로 · 게임 손) 228 · 0 · 93  →  124 · 20 · 0         161 → 0     388 → 52        141 → 0      137 → 0            0 · 93 → 0 · 0           148 → 48
```
- 뒤 판 걱정은 모두 칩에 8일 넘게 잇달아 선 날이다(가장 짧은 8 · V1 · GH · H0).
- 투룸 이사 이튿날 걱정 V1 3 → 0 · JGH 6 → 0.
- «범용 줄의 임자가 그날 아침 끝난 날»(임자 ∈ 끝날 줄)은 앞 판에도 0 이다 — 지금 코드에 그 흠은 없었다.
- 원룸 범용 셋이 늘어난 것(GH 15 → 23 · JGH 0 → 20): 임자는 앞뒤 같다(oneroom_unpack · oneroom_root_bright). 앞 판에선 반지하 «nudgeVarieOffer → 이튿날 범용 nudgeOffer(varie_bright)»가 범용 줄 간격(gap 30)을 먼저 써서 이사 뒤 권함이 막혔다(JGH 원룸 권함 20번 모두 그날 앞 판엔 30일 안에 nudgeOffer 가 있었다 — 예: breedR 1 앞 Day 125 → 뒤 Day 136). 뒤 판은 ④ 로 그 이튿날 권함이 빠져 간격이 비고, 원룸 짐 풀기 · 밝은 데 뿌리 권함이 선다.
- 고른 줄(pp_hold_pink · al_plant_corm)이 칩 줄(qv.chip)이 된 날은 뒤 판에도 0 이다. 화면 칩으로는 새 줄(fresh0 · 열린 날과 이튿날)로만 88 판-날 선다(진로 44판 · 원룸 · 둘이 44씩). 그날 칩 줄 · 임자는 oneroom_home_fund(쌓는 줄)라 범용 셋은 0 — 명세 «새 줄이 화면 칩을 쥔 날은 범용 셋이 쉼»대로다. 그래서 고른 줄의 권함 · 물음은 이 판들에서 한 번도 안 선다.
- 앞 판 ㉯ 어긋남 꼴(진로 44판 141): 투룸 nudgeWorry 임자 pp_hold_pink · 칩 shop_town 49 · sc_hang 16 · shop_sign 15 · home_unpack 4 … · 반지하 nudgeOffer 임자 sell_surplus · 칩 radish5 44 · 반지하 nudgeAsk 임자 varie_bright · 칩 sell_varie 4. 사람 22판(GH 24)은 sell_surplus/radish5 22 · varie_bright/sell_varie 2.

## ㉮ 판 값

```
판     같은 판   다른 칸(판 수)                                   중간 지갑 다른 판 · 날 합   끝 지갑 다름   이사 · 끝 날 다름   카드 날 차례 다름 · 묶음 · 돈   미룸 앞 → 뒤
V1     6/14     cashDaily 8 · bjEvents 8                         8 · 168(가장 큰 차 5,000원)   0              0 · 0               8 · 0 · 0                      9 → 7
H0     12/22    cashDaily 6 · bjEvents 10 · cashAt 4             6 · 114(5,000원)              0              0 · 0               10 · 0 · 0                     16 → 4
GH     12/22    cashDaily 6 · bjEvents 10 · hands 4 · …           6 · 858                       2              1 · 1               10 · 0 · 0                     16 → 4
JGH    24/44    cashDaily 12 · bjEvents 20 · hands 8 · breed 2 …  12 · 4,511                    4              0 · 0               20 · 0 · 0                     32 → 8
```
```
끝이 바뀐 판(모두 씨앗 8 · 지갑 첫 갈림 Day 47 · 손일 첫 갈림 Day 46)
  GH  humanQ 8   이사 135 → 140 · 내 집 323 → 440 · 끝 지갑 5,200,652 → 5,069,452
  GH  guide 8    끝 지갑 5,050,044 → 5,042,044
  JGH breedR 8   56,638,483 → 57,241,893 · careR 8 32,756,100 → 32,747,800 · shop71 8 15,933,680 → 15,925,380 · switchW 8 27,066,162 → 27,057,862
humanQ 8 카드(Day 60 까지)  앞 cat1(미룸) · kids1 37 · cat1(미룸) 43 · parcel 46 · kimchi 47(+2,500) · kids2 52 · truck 58
                            뒤 cat1 36 · cat2 46 · kids1 52 · cat3 58
```

## 안 잰 것

- ㉳ 옛 세이브(force5 · 크롬) · ㉴ core node 단언 — core 몫.
- 카드 미룸이 독촉 줄을 보지 않는 판 — 규칙을 바꾸는 판이라 안 돌렸다.

## 다시 재기

```
1  두 커밋을 git archive 고정 복사본으로 · probe_branches 에 장비 패치(growth-equip-sensitivity · LF diff 로 patch) → 덧줄 nz → 덧줄 mc
2  V0(trace 없음)를 원본 판 해시와 · V1(--trace)을 V0 와 견줌(장비 덧줄 · traceFile 빼고 0 이라야 다음으로)
3  V1 · GH · H0 · JGH 를 두 복사본에서 같은 인자로 · 진로는 크롬 틈에 들게 씨앗 반씩 나눠 돌려 합침
4  셈: 범용 셋 방별 · nudgeBack · ㉯ 판정 뒤 화면 칩 ≠ nz 임자 · ㉰ 걱정 날 앞 판정 뒤 chip = 임자 잇달음(임자 기다림 날 건너뜀) · ㉱ · ㉲ 같은 임자 어제 제 줄 · ㉮ 결과 칸 · cashDaily · bjEvents
   (growth 메모장 patch_nz2.mjs · cmp_u2f.mjs · 결과 growth-u2f-nudge.json)
```
