# 2026-10-30 · growth ③ — guide 판에서 무늬 삽수 판매가 늦는 자리는 이사 · 내 집 날에 얼마나 걸리나 (총괄 D90 #11)

> 물음(총괄 D90 #11 · 회의 `master-meeting-balance-20261025.md` §5): guide 판의 첫 무늬 삽수 판매가 늦는 자리 —
> sell_varie «무늬 삽수가 둘이면 하나를 팔아 보세요»(`tools/probe_branches.mjs:597` 하나 남김) — 가 이사 · 내 집 날에 얼마나 걸리나.
> 결정에는 안 걸린다(총괄). 값은 하나도 안 바꿨다.

## 한 줄

- **«하나 남김»이 이사를 늦추는 것은 하네스 안에서만이다.** 하네스의 자르기는 «무늬 잎이 다 자라야» 문을 안 타서(아래 ⚠),
  잎3 이 막 난 날(76일 언저리) 무늬 삽수를 자른다. 그 판에서는 하나 남김이 이사를 25~35일 늦춘다(guide 135 → 110 · nolamp 135 → 100).
- **게임처럼 문을 지키면 하나 남김은 이사 날에 안 걸린다.** 무늬 삽수는 문이 열린 뒤(등1 중앙 134일)에야 나오고,
  이사 날은 채소 돈이 정한다(guide 145 · nolamp 140). 하나 남김을 꺼도 이사 날이 같고, guide 내 집은 오히려 늦어진다(360 → 435 · 10/10 → 7/10).
- ⇒ 하네스의 «이사 135일»은 게임보다 5~10일 이르고, nolamp 내 집(410일)은 게임보다 약 50일 이르다(문을 지키면 458일 · 9/10).

## 판

```
코드 fa10f7ed 고정 복사본(git archive · %TEMP%\byeot-pin-fa10f7ed · 저장소 밖) · probe_branches --persona guide,nolamp --seeds 1-10 --days 520 --targets 5000000
갈래는 복사본에만 넣은 환경 변수 둘로 가른다(게임 · 저장소 코드는 안 바꿈)
  DOOR_ON      propagation §takeCutting 의 문 물음에 varieMaturedLeaves 를 넘긴다 = 게임 화면 문(game.html:7840)을 자르기에도
  KEEPONE_OFF  probe_branches.mjs:597 «마지막 무늬 삽수는 안 판다»를 끈다(sell_varie · sell_keep_one 안내를 안 따르는 사람)
```

## 잰 것 (10판 중앙 · 괄호는 범위)

| 사람 | 갈래 | 이사 | 반지하 무늬 판매(판 · 첫날 · 값) | 이사 때 지갑 | 이사 뒤 0원(구호) | 내 집 500만(판 · 날) |
|---|---|---|---|---|---|---|
| guide(등1) | A 지금 하네스 | 135 (101~142) | 10/10 · 135 · 70만 | 49만 | 1/10 (1) | 10/10 · 375 |
| guide | B 문 지킴 | **145** (133~145) | 4/10 · 135 · 35만 | 4만 | **6/10** (6) | 10/10 · 360 |
| guide | C 문 지킴 + 하나 남김 끔 | 145 (130~145) | 4/10 · 135 · 35만 | 4만 | 6/10 (6) | **7/10 · 435** |
| guide | D 하나 남김만 끔 | **110** (100~120) | 10/10 · 91 · 35만 | 4만 | **10/10** (10) | 10/10 · 420 |
| nolamp(등0) | A 지금 하네스 | 135 (90~135) | 1/10 · 90 · 35만 | 2만 | 10/10 (10) | 10/10 · 410 |
| nolamp | B 문 지킴 | **140** (140~140) | **0/10** | 8만 | 5/10 (5) | **9/10 · 458** |
| nolamp | C 문 지킴 + 하나 남김 끔 | 140 (140~140) | 0/10 | 8만 | 5/10 (5) | 9/10 · 458 |
| nolamp | D 하나 남김만 끔 | **100** (100~105) | 10/10 · 98 · 35만 | 1만 | 5/10 (5) | 9/10 · 447 |

- A guide 는 «남긴 날» 중앙 44일 — 76일에 자른 무늬 삽수가 96일에 자리 잡고도 둘째 무늬 삽수가 생긴 132일까지 안 팔렸다(씨앗 1 날마다 기록).
- B 에서 «문에 막힌 자르기» guide 101번/판 · nolamp 265번/판. 반지하 «막은 말» guide 93% · nolamp 100% 가 «아직 이릅니다 — 무늬 잎이 다 자라야».
- B guide 의 이사 145일 6/10 · nolamp 140일 10/10 은 반지하에서 삽수를 하나도 못 팔고 **채소 돈만으로** 200만(tutorial.js:59)을 채운 날이다.
  A 의 135일이 5일 이른 까닭은 문 열리기 전 자르기에서 난 판매(씨앗 1 guide 는 77일 무지 삽수 4만)로 보인다 — [셈] 판매 갈래를 따로 갈라 재지는 않았다.
- 내 집 날은 판마다 폭이 넓다(guide B 265~477). A·B 의 15일 차이는 폭 안이다 — C 의 «7/10 · 435»(이사 때 들고 갈 무늬 삽수를 팔아 버림)만 폭 밖이다.
- 씨앗별 줄 — `growth-sell-varie-delay.json`(갈래 × 사람 × 씨앗: 이사 · 반지하 첫 무늬 판매 · 내 집 날).

## ⚠ 하네스 구멍 — 자르기가 «무늬 잎이 다 자라야» 문을 안 탄다 (core 몫 · QUESTION)

```
propagation.js:1167  const mkey = momCut ? {...} : { potId: pot.id };
propagation.js:1175  const blocked = cutBlockedReason(S, nodes, node.nodeId, mkey);   ← varieMaturedLeaves 를 안 넘긴다
propagation.js:902   «안 넘기면 이 문은 «안 걸린다»»(cutBlockedReason 주석 그대로 · 모르면 안 막는 규약)
game.html:7840       화면은 단추를 그릴 때 varieMaturedLeaves 를 넘겨 회색으로 막는다 — 문은 화면에만 있다
game.html:7701       화면의 takeCutting 부름에도 varieMaturedLeaves 가 없다(단추가 회색이라 눌리지 않을 뿐)
probe_branches.mjs:415  takeCutting(..., varieMaturedLeaves: vm) 를 넘기지만 takeCutting 이 그것을 문에 안 쓴다
```

- ⇒ 하네스의 «사람»은 게임 사람이 못 하는 자르기(문 열리기 전 · 씨앗 1 은 33일 무지 · 76일 무늬)를 한다.
  반지하 «막은 말» 83% 는 날마다 «가장 앞 마디»에 물은 말을 센 것이고, 실제 자르기는 그 말과 무관하게 일어났다.
- 고치는 자리는 둘 중 하나다(core 판단): ㉠ takeCutting 이 opt.varieMaturedLeaves 를 문 물음에 넣는다(복사본 DOOR_ON 과 같은 한 줄 ·
  화면은 단추가 이미 회색이라 바뀌는 것 없음) ㉡ 하네스 pickNode 가 cutBlockedReason(vm) 으로 거른다(하네스만).
  D90 #10 페르소나(«사람 손» · «박사님식» · «기본 2자리»)는 이 문을 지킨 판이라야 사람 흉내 판 · 박사님 판과 맞는다.

## 읽는 법 — 무엇이 이사 날을 정하나 (D90 «바로잡음» 보탬)

- 게임 판(B)에서 반지하 이사 날은 **채소 돈**이 정한다(guide 145 · nolamp 140). 무늬 삽수는 거기 거의 안 끼어든다(guide 4/10 만 135일에 팖).
- 문(무늬이면서 갈라진 잎 ≥ 2)은 등1 중앙 134일 · 등0 217일에 열린다(`growth-cut-open-knobs.json` · fa10f7ed).
  등0 은 이사(140일) 전에 문이 안 열리므로 반지하 무늬 판매가 0/10 이다.
- «하나 남김»은 게임 판에서 이사를 늦추지 않는다. 대신 이사 때 들고 갈 무늬 삽수를 남겨 원룸을 돕는다 — 끄면 guide 내 집이 늦어진다(C).
- 그러니 «반지하를 줄인다»(회의 §2)의 손잡이는 채소 돈 쪽(이사비 200만 · 채소 값 · 밥상 몫)이거나, 문이 열리는 날(시간 축)이다.
  성숙 굴림 손잡이로는 문이 등1 114일 · 등0 130일 아래로 안 내려간다(10-25 · `probe_cut_open_knobs`).

## 다시 재는 법

```
git archive <커밋> src data tools/lib tools/probe_branches.mjs plant_grow.html | tar -x -C <복사본>
복사본에서만: probe_branches.mjs:597 앞에 «!process.env.KEEPONE_OFF &&» · propagation.js:1175 문 물음에 «DOOR_ON 이면 varieMaturedLeaves»
<복사본>$ [DOOR_ON=1] [KEEPONE_OFF=1] node tools/probe_branches.mjs --persona guide,nolamp --seeds 1-10 --jobs 2 --days 520 --targets 5000000
⚠ probe_branches 는 돌 때마다 tools/_out/branches.json 을 덮는다 — 갈래마다 v_<갈래>.json 으로 옮겨 둔다
```
