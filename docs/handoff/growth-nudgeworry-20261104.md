# [growth] 몬이 «할 일이 며칠째 그대로야. 막힌 데 있어?»(nudgeWorry)는 언제 서나 — 8aa170ce (2026-11-04)

총괄 11-04 10시 청 · **재기만**(게임 값 · 코드 · 저장소 하네스 손 0).
까닭: plan 이 8aa170ce 대조 판에서 투룸 이사 이튿날(Day 446)에 이 줄이 선 것을 봤다. 그날 칩은 하루 전에 연 home_unpack 이었다.

## 한눈에

- **사람 판(humanQ · guide × g,1-10 · 700일 · 22판)**: 게임 손에서 36일 선다. 셋뿐이다.
  - Day 21 — 22판 모두 · 임자 siru8(연 날 13 · 8일째). 전날(Day 20) 제 줄 nudgeSiruPush 가 섰고, 같은 줄은 이틀 잇달아 못 서므로 이튿날 범용 «걱정»이 받는다. siru8 은 Day 22 에 끝난다.
  - 반지하 Day 123~147 — 10판 · 임자 varie_bright(8~10일째). 모양은 같다(전날 nudgeVarieWait/Push → 이튿날 nudgeWorry).
  - 원룸 이사 +8일(Day 143~148) — 4판 · 임자 oneroom_root_bright(7일째). 이 줄은 제 독촉 줄이 없어 범용 셋이 1 · 4 · 7일째에 차례로 선다.
  - 원룸 이사 +1~+3: 0 · 투룸 · 내 집 날: **없음**(사람 판은 내 집을 사면 판이 끝난다 · 22판 모두 Day 255~505).
  - 하네스 손 22판도 같은 셋이다(39일 · 원룸 root_bright 가 7번 — 한 판은 30일 뒤 한 번 더).
- **투룸(산 집) 이사 이튿날 줄은 진로 판에서만 난다** — 8aa170ce 대조 판(7사람 × g,1)에서 careR · breedR · switchW 씨앗 g 의 Day 446(집 날 445 의 이튿날)에 섰다. plan 이 본 줄이다.
  - **임자는 칩이 아니라 pp_hold_pink**(«분홍을 붙잡는다» · 방 표지 afterBanjiha · 원룸 Day 276 에 열림 · 그날 170일째). 칩은 그날 연 home_unpack · care_unpack · breed_unpack 이었다.
  - 까닭: 원룸에 있는 동안 독촉 임자는 «가장 먼저 열린 안 끝난 할 일»인 oneroom_home_fund 였다(282일). 이 줄은 LONG_OWN_LINES 라 범용 셋(Offer · Ask · Worry)이 안 서고 제 줄(nudgeHome…)만 달에 한 번 선다. pp_hold_pink 는 그 뒤에서 170일 동안 임자가 못 된 채 날수만 쌓였다. nudgeDaysOf 는 열린 날(또는 마지막으로 기다린 날 다음)부터 세므로, 임자가 아니었던 날도 센다. 내 집을 사며 home_fund 가 끝나자(Day 445), 이튿날 pp_hold_pink 가 임자가 됐다. 날수가 170 ≥ 7 이라 첫날부터 «걱정»이 섰다.
  - 그 뒤 30일마다 다시 선다(gap 30) — 대조 판(660일)에서 switchW g 는 판 끝까지 pp_hold_pink 를 안 해 Day 657(381일째)까지 8번. careR g 는 Day 451 · breedR g 는 Day 487 에 끝냈다.
  - 씨앗 1 진로 판은 pp_hold_pink 가 원룸 Day 194 에 열려 Day 266 에 끝나 투룸에 남지 않았다 — 투룸 이튿날 줄 0.
- **진로 44판(게임 물 · 게임 손 · shop71 · careR · breedR · switchW × g,1-10 · 1300일)**: 161일 선다 — Day 21 siru8 44 · 반지하 varie_bright 24 · **투룸 93(모두 임자 pp_hold_pink)**.
  - pp_hold_pink 를 안 끝낸 채 투룸으로 넘어간 판은 씨앗 g · 10 의 8판이다(나머지 36판은 원룸 Day 189~315 에 열어 Day 250~349 에 끝냄). 그 8판이 모두 투룸 이사 +1(6판) · +2(2판 — +1 아침은 사건 줄 brokeTalkAgain 이 먼저 섬)에 «걱정»을 듣는다(170일째 · 87~88일째).
  - 그 뒤 30일마다: pp_hold_pink 를 끝내 안 한 shop71 g · 10 은 25번씩(890 · 810일째까지), 늦게 한 switchW g · 10 은 20 · 18번(Day 1026 · 849 에 끝). careR · breedR 은 Day 341~487 에 끝내 1~2번.
  - pp_hold_pink 가 원룸에서 임자가 된 날은 44판 모두 0(투룸에서만 2,656 판-날). 투룸 +1 에 임자가 al_keep_winter(LONG_OWN · 38 · 64일째)인 판 8 은 범용 줄이 안 선다. 임자 없음 28판.
  - 원룸 이사 +1~+3: 0.
- **먼저 본 갈림(대사 쪽 방 판정에 movedHome 이 없음)은 446 줄의 까닭이 아니다.** pp_hold_pink 는 afterBanjiha 라 두 판정 모두 «방 맞음»이다. 다만 이 갈림은 투룸에서 **다른 모습으로 선다**(④): 대사 쪽은 투룸 할 일(home_unpack · shop_* · care_* · breed_*)을 늘 «방 아님»으로 버린다. 그래서 칩 쪽 판정이면 임자가 있는데 대사 쪽 임자는 없는 날이 대조 판 투룸 1,945 판-날 중 1,569 · 진로 44판(1300일) 34,344 중 27,117 이다. 진로 할 일에는 독촉(권함 · 물음 · 걱정 · 미는 말)이 한 번도 안 서고, 그 자리에 nudgeBack(«급한 건 아니야. 마음 내키면 해.»)이 선다 — 진로 44판 투룸 nudgeBack 388번 중 344번(89%)이 그런 날이다. 「할 수 있는 퀘스트가 없는 날에만」이라는 이 줄의 주석과 어긋난다.
- 값 · 코드는 안 고쳤다. 고침은 core 몫이고 총괄이 가른다.

## 판

```
고정 복사본  C:/Users/pc/AppData/Local/Temp/byeot-pin-nudge-8aa170ce (git archive 8aa170ce -- src tools data vendor *.html)
하네스      tools/probe_branches.mjs · tools/lib/byeot_harness.mjs 는 e31cc01c 와 8aa170ce 가 같다(git diff 0)
            → 장비 재기 때 깃발(EQ_GAMEWATER · EQ_GAMEHAND = 게임 물 · 게임 손 · growth-equip-sensitivity ⓪)을 그대로 옮김
덧줄 하나   --trace 때만 · story.turn 바로 뒤에 같은 turn · S 로 chatterContext(turn, S).nudge 와 열린 할 일
            [id · 연 날 · 대사 쪽 방 판정 questRoomOk(id, {movedOut}) · 칩 쪽 방 판정 questRoomOk(id, {movedOut, movedHome}) · nudgeWaitReason] 을 trace 칸 nz 에 적음
            읽기만 — V0(대조 판 그대로 · trace 없음)는 장비 덧줄 넷(staDaily · dryDaily · waterDaily · recDaily)을 빼면 ccf56040 판과 다른 자리 0
                     V1(같은 판 + --trace · 덧줄 nz 켬)은 V0 와 traceFile 칸 14 말고 0
판          V0  대조 판 그대로(humanQ · guide · lazy · shop · careR · breedR · switchW × g,1 · --jobs 1 · 날 · 목표 기본) — 덧줄 무해 확인
            V1  V0 + --trace
            GH  사람 22판 게임 물 · 게임 손(humanQ · guide × g,1-10 · 700일 · --targets 5000000 · 장비 ⑪ 판과 같은 셈)
            H0  같은 22판 하네스 손(견줌)
            JGH 진로 넷 게임 물 · 게임 손(shop71 · careR · breedR · switchW × g,1-10 · 1300일) — 사람 판엔 투룸 날이 없어서 덧붙임
날 맞춤     trace 칸 day = 그 턴의 S.day · 원룸 이사 날 = 결과 moveDay(= 원룸이 처음 보이는 칸)
            투룸 이사 날 = 결과의 집 날(shop · care · breed openDay = 투룸이 처음 보이는 칸 − 1) — plan 의 «이사 이튿날 446» 과 같은 셈
```

## ① nudgeWorry 가 선 날 — 사람 22판

```
판          선 날   Day 21 siru8     반지하 varie_bright        원룸 oneroom_root_bright        투룸
GH(게임 손)  36     22판(8일째)       10판 · Day 123~147(8~10일째)  4판 · Day 143~148(이사 +8 · 7일째)   0(판이 내 집에서 끝남)
H0(하네스 손) 39     22판             10판 · Day 123~147            7판 · Day 143~173(+8 · 한 판은 +38)   0
```
- 셋 모두 «칩 = 임자»다(그날 칩과 독촉 임자가 같은 할 일).
- 줄 차례(게임 손 humanQ g): siru8 Day 13 열림 → 16 nudgeSiruBag → 20 nudgeSiruPush(7일째) → **21 nudgeWorry(8일째)** → 22 siru8 끝.
  varie_bright(humanQ 1): 123 열림 → 124 nudgeVarieOffer → 125 nudgeOffer → 127 nudgeAsk → 130 nudgeVarieWait → **131 nudgeWorry**.
  oneroom_root_bright(humanQ g): 141 열림 → 142 nudgeOffer → 145 nudgeAsk → **148 nudgeWorry**(제 줄 없음 · 범용 셋만).
- 제 줄이 있는 할 일(siru8 · varie_bright)은 «제 미는 말 → 이튿날 범용 걱정»으로 이틀 잇달아 민다. 범용 줄 표의 주석(«퀘스트별 줄이 없거나 그 줄이 어제 난 날의 그물»)대로다.

## ② 이사 날 +0 ~ +3

```
원룸            +0                          +1                    +2                  +3
GH 22판   독촉 줄 nudgeVarieOffer 1 · Wait 1   0                     nudgeOffer 6         0
          임자    sell_varie · varie_bright      oneroom_unpack(1일) 15  root_bright(1일) 6     root_bright 7
H0 22판   독촉 줄 0                            nudgeOffer 2           nudgeOffer 2         nudgeOffer 5
V1 14판   독촉 줄 nudgeVarieOffer 4            0                     nudgeOffer 3         nudgeOffer 1
          nudgeWorry 는 원룸 +0~+3 에 0(세 판 모두)

투룸(산 집)      +0(집 날)                       +1                    +2                  +3
V1 8판     독촉 줄 0                           nudgeWorry 3          0                   0
          임자    oneroom_home_fund(246~296일) 8   pp_hold_pink(170일) 3 · 없음 5   같음        같음
JGH 44판  독촉 줄 0                           nudgeWorry 6          nudgeWorry 2         0
          임자    oneroom_home_fund(172~283일) 44  pp_hold_pink 170일 4 · 87일 4 · al_keep_winter 8 · 없음 28 (+2 · +3 도 같은 판 · 날수 +1)
JGH 원룸   +0 nudgeVarieOffer 4 · nudgeVarieWait 4 · +1 임자 oneroom_unpack(1일) 44 · +1~+3 독촉 줄 0
          ⚠ switchW 의 결과 shop.openDay 는 «바꾼 가게를 연 날»(Day 1020~1217)이라 집 날로 안 씀 — 투룸 날은 trace(투룸이 처음 보이는 칸 − 1)로 맞춤
```

## ③ 투룸 이튿날 Day 446 — 무엇이 섰나

```
switchW g(V1)  Day 440~445 원룸 · 칩 oneroom_home_fund · 임자 oneroom_home_fund(278~283일) · 445 questDoneOneroomHomeFund
               Day 446 투룸 · 칩 home_unpack · 임자 pp_hold_pink(170일) · said nudgeWorry → questHomeUnpack → questDoneHomeUnpack
               Day 447 칩 shop_first_order · 임자 pp_hold_pink(171일) · Day 448~ 칩 shop_regulars3
careR g        Day 446 칩 care_unpack · 임자 pp_hold_pink(170일) · nudgeWorry 한 번 · pp_hold_pink 끝 Day 451
breedR g       Day 446 칩 breed_unpack · 임자 pp_hold_pink(170일) · nudgeWorry · Day 476 한 번 더(200일) · 끝 Day 487
switchW g      Day 446 · 476 · 506 · 536 · 566 · 596 · 627 · 657 — 30일마다 8번(170 → 381일째) · 끝내 안 함
```
- 화면에서는 아침에 «할 일이 며칠째 그대로야. 막힌 데 있어?»가 먼저 서고, 이어 home_unpack 이 열리고 그 자리에서 끝난다. 칩에 없는 할 일(pp_hold_pink)을 두고 «며칠째»라 하니, 막 이사한 사람이 무엇을 말하는지 모른다.
- pp_hold_pink 가 원룸에서 임자가 된 날은 0이다 — 원룸 내내 home_fund 가 먼저 열려 있었다(진로 g 판 282일).
- 숨어 쌓인 날수가 이사 이튿날 한꺼번에 «걱정» 문턱을 넘은 것이다. 이사 날 문이 풀려 처음 보이는 줄이라는 plan 의 짐작과 맞다 — 다만 «문»은 날 문이 아니라 «앞의 긴 할 일(home_fund)이 끝남»이다.

## ④ 대사 쪽 방 판정 — movedHome 없음 (코드 줄 · 판 · 날)

```
코드(8aa170ce)
  src/game/dialogue.js:4607~4621  chatterContext 의 nudge — 임자 = 안 끝남 · 방 맞음 · 기다림 아님 중 가장 먼저 연 것
  src/game/dialogue.js:4616       questRoomOk(id, { movedOut: !!(ts && ts.movedOut) })   ← movedHome 을 안 넘김
  src/game/dialogue.js:4559       같은 함수 안에 movedHome 칸은 있다(S.home.room === 'tworoom' || S.tutorial.homeOwned)
  src/game/quest.js:299~311       questRoomOk — room 'oneroom' = movedOut && !movedHome · 'tworoom' = movedHome · 'afterBanjiha' = movedOut
                                  movedHome 이 없으면(false) 투룸에서 tworoom 줄은 늘 «방 아님», oneroom 줄은 늘 «방 맞음»
  src/game/dialogue.js:4281       nudgeBack — when: c => c.living && !c.nudge(«할 수 있는 퀘스트가 없는 날에만» 주석)
  칩(questView)은 movedHome 을 아는 snap 으로 고른다(quest.js:1781 · job_shop.js:88 movedHome)

판 · 날(V1 대조 판 · 진로 넷 × g,1 의 투룸 날)
  투룸 판-날 1,945 · 대사 쪽 임자 없음 1,582 · 그중 칩 쪽 판정이면 임자 있음 1,569 · 임자가 갈린 날 합 1,669(투룸만)
  임자가 갈린 날(대사 쪽 → 칩 쪽):  없음 → shop_sign 578 · care_all_kinds 357 · breed_first_variety 279 · shop_regulars3 110 · care_kinds3 81 ·
                                    breed_three 56 · shop_town 53 · care_sign 28 · breed_first_sample 12 · care_first 10 · breed_all 5
                                    al_keep_winter → breed_first_variety 94 · care_kinds3 6
  그날 선 독촉 줄  nudgeBack 20(«급한 건 아니야. 마음 내키면 해.») — 예: shop g Day 434 · 504 · 571 · 630(칩 쪽이면 shop_regulars3 · shop_sign)
                  careR g Day 477 · 591 · careR 1 Day 454 · 563 · breedR g Day 492 …
  사람 22판(GH · H0)은 투룸 날이 없어 갈린 날 0
판 · 날(JGH 진로 44판 · 게임 손 · 1300일 의 투룸 날)
  투룸 판-날 34,344 · 대사 쪽 임자 없음 31,514 · 그중 칩 쪽 판정이면 임자 있음 27,117 · 임자가 갈린 날 합 27,223
  임자가 갈린 날(대사 쪽 → 칩 쪽):  없음 → sc_hang 7,906 · care_all_kinds 4,499 · breed_all 3,843 · shop_town 2,500 · shop_sign 2,269 ·
                                    breed_first_variety 1,769 · breed_three 1,466 · care_sign 807 · breed_first_sample 618 · care_kinds3 550 ·
                                    care_town 383 · shop_regulars3 292 · breed_three_lines 116 · care_first 78 · ca_unfurl 21
                                    al_keep_winter → breed_first_variety 94 · care_kinds3 12
  그날 선 독촉 줄  nudgeBack 344 — 투룸 nudgeBack 388 번 중 89% 가 «칩 쪽이면 할 일이 있는 날»(shop71 84 · careR 35 · breedR 116 · switchW 109)
                  예: shop71 1 Day 433(칩 쪽 shop_sign) · Day 536 · 604 · 671 · 738 · 825 · 913 · 986 · 1050 · 1106(칩 쪽 sc_hang)
```
- 446 의 nudgeWorry 는 이 갈림과 상관없다(pp_hold_pink 는 두 판정이 같다 · 갈린 날 표에 446 없음).
- 이 갈림이 투룸에서 하는 일: 진로 할 일은 대사 쪽에선 «없는 할 일»이라 독촉(권함 · 물음 · 걱정 · 미는 말)이 한 번도 안 선다. 그 자리에 nudgeBack 이 30일에 한 번 «급하지 않다»고 한다.
- 거꾸로, 투룸에 안 끝낸 원룸 줄(oneroom_*)이 남아 있으면 대사 쪽은 그것을 «방 맞음»으로 집어 독촉 임자로 삼을 수 있다(칩은 «잠김»으로 숨김). 이번 판들에선 그런 날 0 이다(갈린 날 표에 oneroom_* 임자 없음).

## 안 잰 것

- 화면(크롬) 판 — node 판만. 아침 줄 차례는 하네스 story.turn 그대로다(game.html 과 같은 창구).
- 사람 판의 내 집 뒤 — 판이 엔딩에서 끝난다.
- 고친 판(movedHome 을 넘긴 판) — 고침은 core 몫이라 안 돌렸다. 위 «칩 쪽이면»은 같은 trace 칸에서 칩 쪽 판정으로 임자를 다시 고른 셈이다(줄 고르기 · gap 은 안 다시 돌림).

## 다시 재기

```
1  git archive 8aa170ce -- src tools data vendor ':(glob)*.html' | tar -x -C <새 폴더>
2  tools/probe_branches.mjs 를 장비 고정 복사본 것으로(깃발 · 덧줄 넷 · growth-equip-sensitivity ⓪) + 이 덧줄(nz) 넷:
     import { createStoryteller, chatterContext as __nzCtx } from '../src/game/dialogue.js';
     saidIds = story.turn(turn, S) … } catch { } 바로 아래:
       if (opt.trace) { try { const c = __nzCtx(turn, S), stm = S.stamina || {}, dn = new Set(stm.questsTaken || []), mo = !!(S.tutorial && S.tutorial.movedOut), dd = turn && turn.day;
         out._nz = { n: c.nudge ? [c.nudge.id, c.nudge.days] : null, mh: !!c.movedHome, op: Object.entries(stm.questsOpenedOn || {}).filter(([id]) => !dn.has(id))
           .map(([id, on]) => [id, on, questRoomOk(id, { movedOut: mo }) ? 1 : 0, questRoomOk(id, { movedOut: mo, movedHome: !!c.movedHome }) ? 1 : 0, nudgeWaitReason(S, id, dd) || null]) }; } catch (e) { out._nz = { err: … }; } }
     trace 한 칸 끝에 nz: out._nz || null(그리고 out._nz = null) · 결과 지우는 줄에 delete out._nz
3  node tools/probe_branches.mjs --persona humanQ,guide,lazy,shop,careR,breedR,switchW --seeds g,1 --jobs 1 --trace
   EQ_GAMEWATER=1 EQ_GAMEHAND=1 node tools/probe_branches.mjs --persona humanQ,guide --seeds g,1-10 --days 700 --targets 5000000 --jobs 1 --trace
   EQ_GAMEWATER=1 EQ_GAMEHAND=1 node tools/probe_branches.mjs --persona <진로 하나> --seeds g,1-10 --days 1300 --targets 5000000 --jobs 1 --trace
4  trace 칸 said 에 nudgeWorry 가 든 날 · nz 칸 임자 · 열린 할 일을 센다(셈은 growth 메모장 cmp_nz.mjs · 결과는 growth-nudgeworry.json —
   rows = 선 날 · moveWin = 이사 +0~+3 · ownerDiff = 칩 쪽 방 판정이면 임자가 달라지는 날)
```
메모리: node 한 판 peak 약 200MB · 문턱 빈 물리 4GB · 빈 커밋 4.0GB · 지킴이 1.5GB(총괄 크롬은 같이 돎 · core 크롬 뜨면 내림 — 11:44 · 11:52 두 번 멈춰 진로 판을 사람마다 넷으로 쪼개 다시 돎).
