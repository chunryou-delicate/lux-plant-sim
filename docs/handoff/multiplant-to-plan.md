# 여러 그루를 굴린다 — multiplant 창 → plan

**START 21:39:54 · END (아래 맨 끝)**
설계 정본: `docs/handoff/growth-multiplant-design.md`

---

## ★ 어느 걸음까지 갔나 — **걸음 3 까지 갔다. 걸음 4 는 못 했다.**

| 걸음 | 무엇 | 상태 |
|---|---|---|
| 1 | 엔진(`plant_grow.html`)이 여러 그루를 담는다 | **끝 · 커밋됨** (`8f560c2`) |
| 2 | 어댑터·코어가 그루를 골라 부른다 | **끝 · 절반만 커밋됨** (아래 §못 담은 것) |
| 3 | 씨앗을 심어 새 그루를 만든다 | **끝 · 커밋됨** (`849b509` 안에 들어 있다) |
| 4 | 삽수를 화분으로 승격(`promoteToPot`) | ⛔ **미착수** — `propagation.js` 를 다른 창이 쥐고 있다 |
| ＋ | 프롤로그 무늬 두 장(잎 2·3) | **끝 · 커밋됨** (`44c208d`) |

⚠ **걸음 4 는 손도 안 댔다.** 지시대로다 — 삽수 단순화 창이 `propagation.js` 를 고치는 중이고,
그 창의 변경이 아직 커밋 안 된 채 working tree 에 얹혀 있다. `promoteToPot` 은 여전히 던진다.
⇒ **다음 창이 할 일**: 그 창이 커밋된 뒤 `promoteToPot` 을 열면 된다. 필요한 것은 이미 다 있다 —
`state.plantMonsteraSeed` 가 하는 일(그루 등록 → 형태 세우기 → 화분 남기기)을 그대로 따르고,
`growthId`·`growthSeed`·`dliHist`·`arrivalGrowthDays` 넷만 채우면 된다.

---

## 1. 바뀐 것

### 걸음 1 — 엔진이 여러 그루를 담는다 (`plant_grow.html`)

설계 §전역 교체 그대로. **개체 상태를 만지는 함수를 하나도 안 고쳤다.**
생장은 동기 처리라 「한 번에 한 그루씩 전역에 꽂고」 굴리면 된다.

| 창구 | 하는 일 |
|---|---|
| `addPlant({id, seed, day, calDay, slotId})` | 그루를 **등록**만 한다(안 꽂는다) |
| `selectPlant(id)` | 그 그루를 전역에 꽂는다. **다시 안 그린다**(그루마다 그룹이 따로다) |
| `usePlant(id, fn)` | 잠깐 꽂고 굴린 뒤 **반드시 되돌린다**(예외가 나도) |
| `removePlant(id)` · `plantIds()` · `plantInfo(id)` · `currentPlant()` | 거두기·읽기 |

★ **설계가 셌던 「지속 상태 8개」는 낡아 있었다. 다시 세니 열둘이다.**
잎 이력 셋(`MAT_STATE`·`LEAF_HEALTH`·`VARIE_STATE`, 2026-08-03)과 프롤로그 보장
(`PROLOGUE_VARIE`, 2026-08-13)이 설계 뒤에 생겼고 `CAL_DAY` 는 그냥 빠져 있었다.
**안 옮겼으면 그루끼리 잎 이력이 새는 조용한 버그**가 났다.

⇒ `const` 다섯 줄을 `let` 으로 바꿨다(`DLI_HIST`·`MAT_STATE`·`LEAF_HEALTH`·`VARIE_STATE`·
`PROLOGUE_VARIE`). **참조만 갈아 끼운다** — 복사하면 두 벌이 되고 한쪽만 자라는 날이 온다.

★ **아무도 안 부르면 이 장치는 한 줄도 안 돈다.** 등록부가 비어 있고 `CUR_PLANT` 가 `null` 이다.

### 걸음 2 — 코어가 화분마다 하루를 준다

* `growth_adapter` — `select` / `addPlant` / `removePlant` / `multi` / `plantInfo`.
  아래의 `setDailyLight`·`advanceTo`·`leafStats`… 는 **지금 꽂힌 그루**의 것이 된다.
  ⇒ **그래서 함수 42개의 모양이 한 글자도 안 바뀌었다.**
* `loop.nextDay` — `pot0` 하나를 굴리던 코드를 **`stepPlantDay(S, io, p, ctx)`** 로 들어내고
  `S.pots` 를 전부 돈다. 규칙은 한 줄도 안 바꿨다. 바뀐 것은 **무엇에 대고 하느냐**뿐이다:

  | 옛 자리 | 새 자리 | 안 옮겼으면 |
  |---|---|---|
  | `S.dliHist` | 화분마다 (`potHist`) | 두 그루가 서로의 빛 이력에 쌓는다 |
  | `S._growthCredit` | 화분마다 | 밝은 그루가 모은 소수점으로 **어두운 그루가 한 걸음 더 간다** |
  | `S._lastHeadBlock`·`_lastDry`·`_lastBlock` | 화분마다 | 두 그루가 번갈아 막힐 때 **아무 말도 안 하는 날**이 생긴다 |

  ★ 전기요금은 **하루에 한 번**이다(그루 수와 무관 — 안 갈랐으면 두 배가 됐다).
* `state` — 화분이 **제 그루 이름(`growthId`)과 제 빛 이력(`dliHist`)** 을 들고 다닌다.
  순서(`pots[0]`)로 정하면 첫 화분을 파는 날 이름이 통째로 밀린다.
  `S.dliHist` 는 첫 화분 이력의 **대표 칸**이다 — 사본이 아니라 **같은 배열**이라 어긋날 수가 없다
  (작물 `syncCropLead` 와 같은 규약).
* `save` — `growthId`·`growthSeed` 를 싣고, **둘째 화분부터** 제 `dliHist` 를 싣는다.
  `restoreGrowth` 가 화분마다 그루를 만들고(`addPlant`) 골라(`select`) 제 이력을 다시 건다.

★★ **하루가 안 가는 유령을 안 만든다.** 중간에서 멈추지 않고 **모든 화분을 돈 뒤에** 실패를 판정한다.
되감기는 **아무 그루도 달력을 안 옮겼을 때만** 한다 — 한 그루짜리 판에서는 예전 판정과 똑같다.

⚠ **그루를 못 고르는 옛 생장 창에 화분 둘을 물리면 던진다.** 조용히 겹쳐 쓰면
두 화분이 같은 형태를 공유하는, 제일 늦게 발견되는 사고가 난다.

### 걸음 3 — 씨앗을 심는다 (`state.plantMonsteraSeed`)

⚠ **`monstera_seed` 를 쓰는 코드가 저장소에 한 줄도 없었다.** 사면 가방에 쌓이기만 하고
화면이 아무 말도 안 했다 — 조용한 실패다.

```
plantMonsteraSeed(S, io, { potItemId, at, slots, size, seed, id, log })
```

순서가 계약이다(`givePlant`·`repotCutting` 과 **같은 규칙**):
**① 던질 수 있는 것을 다 던져 본다(체력·재고·자리·형태 세우기) → ② 재고를 뺀다 → ③ 화분을 남긴다 → ④ 체력을 깎는다.**
⇒ 중간에 던지면 **아무것도 안 바뀐다.** 씨앗만 사라지고 화분은 안 생기는 일이 없다.

★ **씨앗은 유효 0일부터다**(`SEED_START_GROWTH_DAYS = 0`). 선물은 45일짜리로 온다.
박사님 말씀 그대로 — **돈으로 병렬화해도 느리다.** 그래서 열어도 판이 안 무너진다.
⚠ 이 값을 하나라도 올리면 「사면 빨라진다」가 된다. 올리려면 기획이 정할 것.

★ 그릇은 상점의 `pot`(검은 모종포트)다 — 삽수 분갈이가 쓰는 그것이고 새 품목을 안 만들었다.
★ 체력은 `sow`(다시 심기)와 같은 손이다 — 새 비용을 안 만들었다.

### ＋ 프롤로그 무늬 두 장 — 잎 2·3

아래 §4 에 따로 적었다.

---

## 2. 실측

### ① 한 그루짜리 판이 안 달라졌다는 증거

| 잰 것 | 값 |
|---|---|
| 골든 검사 | `test_monstera_canon` · `test_maturation` · `test_growth_speed` · `test_prologue_varie` · `test_multisiru` · `test_musun_view` · `test_save` · `test_first_play` · `test_first_play_attacks` · `test_headroom` · `test_loop_errors` · `test_econ` · `test_tutorial` · `test_stamina` · `test_propagation` · `test_cuttable` · `test_escapecut` · `test_cutting_wiring` · `test_fastforward` · `test_repot_atomic` · `test_resow_atomic` · `test_pots` · `test_dawn6` · `test_uiwire` · `test_banjiha_profile` · `test_roomview_place` · `test_nextday_gate` · `test_dialogue_coverage` — **전부 초록** |
| `select` 호출 수 (화분 1개) | **0회** — 한 그루짜리 판은 다개체 창구를 아예 안 지난다 (`test_multiplant_core §A`) |
| 등록부 (아무도 안 부름) | **0개** — 장치가 잠들어 있다 (`test_multiplant §①`) |
| 한 그루 세이브 | `pots[0].dliHist` **없음** · `growthId:"__main__"` · `growthSeed:null` · 대표 칸 이력 그대로 → **옛 판과 같은 글자** (`§F`) |
| `game.html` 부팅 예외 | **0건** (`test_dawn6` H-1) |

### ② 그루마다 자기 빛을 받는다는 증거

`test_multiplant_core §B·C` — 같은 씨앗, 다른 자리, 30일:

```
창턱 DLI 9.0 → 유효 82일 · 이력 37칸 · 정지 사유 없음
바닥 DLI 0.5 → 유효 45일(도착 그대로) · 이력 30칸 · 「빛 부족」으로 정지
```

* 이력 배열이 **서로 다른 객체**이고, 각자 자기 값만 들어 있다(9.0 만 / 0.5 만).
* 돌본 날 **30 / 30** — 코어의 날과 같다. **하루가 안 가는 유령이 없다**(`§D`).
* ⚠ 생장 창의 **달력**은 그루마다 갈릴 수 있다(82 / 75). 밝은 자리는 하루에 두 걸음을 걷고
  한 걸음이 곧 그 창의 하루이기 때문이다 — 한 그루짜리 판에서도 이미 「코어 30일 / 창 82일」이라
  새로 생긴 성질이 아니다. **유령을 재는 자는 `daysPlanted` 다.**

`test_multiplant §③` (브라우저, 엔진 직접) — 빛 9.0 / 1.0 으로 120일:
유효 **120일 / 0일** · 7일평균 **9 / 1** · 잎 이력 칸 **3 / 0**.

### ③ 씨앗이 선물보다 느리다는 증거

`test_multiplant_core §H` — 같은 판, 같은 밝은 자리, 20일:

```
선물(도착 45일) 유효 70일   ←→   실생(0일부터) 유효 25일
```

### ④ 무게

| 잰 때 | GLB | 내려받은 양 |
|---|---|---|
| 부팅 직후(걸음 1 전) | 13장 | 14.71MB |
| 부팅 직후(걸음 1 후) | 13장 | 14.71MB |
| **세 그루를 120일씩 굴린 뒤** | **13장** | **14.71MB** |

★ **그루가 늘어도 에셋은 한 벌이다.** `ASSETS`·`PET_COLOR`·`PET_AXIS`·엽초 캐시를 공용으로 뒀다
(설계 §같이 해야 할 것). 무늬 스킨은 **그 그루가 실제로 쓰는 것만** 늦게 받는 규칙이 그대로라
(`test_monstera_canon §I`), 그루가 늘어도 100장을 다 받지 않는다.
⚠ 다만 **메시는 그루마다 생긴다** — 그룹이 따로라 그래야 한다. 그루 수만큼 잎 인스턴스가 는다.
지금 판(두세 그루)에서는 문제가 아니지만 **열 그루짜리 판은 안 재 봤다**(§4 판단필요).

### ⑤ 세이브

* 두 그루 왕복 — 저장 전 **유효 82 / 45** → 복원 뒤 **82 / 45** (`§E`)
* 한 그루 세이브 글자 — 위 ①
* `test_save` 전부 초록(H: 이력 재생으로 같은 유효 생장일)

---

## 3. 프롤로그 무늬 두 장 — 잎 **2·3**

### 고른 까닭 (박사님이 "2.3으로 하자" 로 확정 · 내가 잰 답도 같았다)

반지하 창턱에서 잎이 **세어지는 날 / 화면에 보이는 날**(도착 뒤 며칠. 보이는 날은 성숙도 0.22 —
그전엔 말린 새순이라 무늬가 안 보인다):

| 잎 | 등 0개 (평균 DLI 4.80) | 등 1개 (5.15) |
|---|---|---|
| 1 | 1일 / 1일 ← **도착할 때 이미 달고 온다** | 1일 / 1일 |
| **2** | **25일 / 36일** | 20일 / 29일 |
| **3** | **75일 / 91일** | 60일 / 73일 |
| 4 | 145일 / 168일 | 116일 / 135일 |

* **잎 1 은 쓸 수 없다.** ① 도착 시점엔 빛 이력이 0 이라 `calcVarieProb` 이 **0** 이고(캐논 §D),
  그 잎의 무늬 여부는 `setGrowth` **안에서** false 로 못 박힌다 — 보장을 켜는 것은 그 `setGrowth`
  가 끝난 뒤라 이미 늦다. ② 순서를 바꿔 켤 수 있게 해도, 그러면 **선물이 도착하자마자 무늬**다.
  프롤로그가 「자라는 것을 지켜보다 놀라는」 이야기가 아니게 된다.
* **잎 4 는 너무 늦다** — 보이는 날이 168일이면 파산선을 한참 지난다.
* ⇒ 남는 것이 **2·3** 이다.

### ★ 잎 3 이 파산선 안에 드나 — **든다. 다만 등 없이 아무것도 안 하면 아슬아슬하다.**

굴려서 잰 것(도착 = 게임 Day 4 · 반지하 창턱):

```
                              등 0개        등 1개
둘째 무늬 잎이 세어지는 날     게임 79일     게임 64일
        화면에 보이는 날       게임 95일     게임 77일
자르기 → 병 주문 2일 + 뿌리 12일 → 판매      +14일
        ⇒ 팔 수 있는 날       게임 93일     게임 78일

파산선 — 저장소 실측(test_banjiha_routes §D, 아무것도 안 함)
        게임 130일 (튜토 91일)              ⇒ 여유 37일 / 52일
파산선 — 넘겨받은 값(수입 0 기준 89일)
                                            ⇒ 등 0개면 4일 모자란다 / 등 1개면 11일 남는다
파산선 — 넘겨받은 값(콩나물 절감 109일)     ⇒ 16일 / 31일 남는다
```

⇒ **콩나물을 돌리면 들어오고, 등을 켜면 확실히 들어온다.**
아무것도 안 하고 등도 없는 판에서만 4일 모자라는데, 그 판은 애초에 파산하는 판이고
**초보 모드는 파산해도 하루가 계속 간다**(`test_banjiha_routes §D`가 그걸 못 박고 있다).
★ 「등을 켜라」는 그전에 배우는 것이라(`monstera_needs_lamp`) 결도 맞는다.

### ★ 이사 성공률 전·후 — **한 톨도 안 바뀌었다. 그리고 그것이 발견이다.**

```
전 (e7015fb · 내 작업 전 전부)   A 20% · B 43% · C 48%   (G-2b FAIL)
후 (지금)                        A 20% · B 43% · C 48%   (G-2b FAIL)
```

⚠⚠ **까닭 — `test_banjiha_routes` 는 프롤로그 보장을 아예 안 태운다.**
그 재현은 헤드리스로 자기 생장 계약을 만들고 `setPrologueVarieLeaf` 를 **한 번도 안 부른다.**
보장을 켜는 것은 `growth_adapter`(브라우저 게임 경로) 하나뿐이라서다.
그 재현이 재고 있는 「확정 무늬」는 **튜토의 `stepVarieGrant`**(가을 45일)이고 **다른 장치**다.

⇒ **이 검사로는 두 장의 값어치를 못 잰다.** §4 판단필요 ①.
★ `G-2b` 는 **내 작업 전부터 빨갛다**(위 「전」에서 확인 — 워크트리로 `e7015fb` 를 따로 받아 돌렸다).

### 몬이가 한 말 두 줄

**첫 장(잎 2 · `varieLucky` — 손 안 댔다)** — 「운이 좋다」

> 몬: 어어. 잠깐만. **그거 무늬야.**
> 몬: **두 번째 잎에** 바로 나오네. 운 좋다, 너.
> 몬: 값이 달라. 근데 **한 장으로는 어림도 없어.**

**둘째 장(잎 3 · `varieSecond` — 새로 썼다)** — 「이제 자를 수 있다」

> 자취: …또 하얀 게 섞였어.
> 몬: 두 장째네. **이제 됐다.**
> 자취: 뭐가 됐어?
> 몬: 한 장일 땐 못 움직여. 자르면 그루에 무늬가 안 남고, 안 자르면 팔 게 없고.
> 몬: **두 장이면 한 장은 자르고 한 장은 남겨.** 그게 되는 거야.
> 자취: 자른 건… 죽는 거 아니야?
> 몬: 물에 꽂아. 뿌리 나와. 그다음에 흙으로 옮기면 돼.
> 몬: **밝은 데 둬.** 어두우면 뿌리는 나도 무늬가 흐려져.
> 몬: 응. 그거 하나가 여기서 나가는 값이야.

★ **두 번 놀리지 않았다.** 첫 장에서 이미 놀랐고, 둘째 장에서 달라진 것은 운이 아니라
**할 수 있는 일**이다 — 그래서 이 장면이 **삽수를 처음 배우는 자리**가 된다.
★ 값을 안 읊는다(숫자는 상점 화면이 말한다). 무늬율 퍼센트도 안 읊는다 —
**몬이는 규칙을 말하지 숫자를 말하지 않는다.** 대신 「밝은 데 둬」로 그 규칙을 가리킨다.

### 캐논이 안 깨졌다는 증거 (`test_prologue_varie §E`)

같은 씨앗(92158)을 보장 없이 / 2·3 보장으로 겹쳐 400일:

```
보장 없이: [[36,F],[136,F],[256,F],[376,F],[496,T],[616,F]]
2·3 보장 : [[36,F],[136,T★],[256,T★],[376,F],[496,T],[616,F]]
```

* `P.varieProb` **0.20 그대로**
* 잎 수 **6장 그대로**(난수 스트림이 안 밀렸다)
* **달라진 잎이 준 그 두 장뿐**이다 — `[136, 256]` = 준 잎 `[136, 256]`
* 네 번째 잎부터는 표식이 안 붙고, 보장 밖에서도 굴림으로 무늬가 난다(496)
* 「이미 두 장이 났으면 덤을 안 준다」 — `varieProb=1` 판에서 보장 **0장**(`§F`)
* 옛 호출 `setPrologueVarieLeaf(2)` 가 그대로 산다(`§G`)

---

## 4. 판단필요

1. ★★ **두 장의 값어치를 재는 자가 없다.** `test_banjiha_routes` 는 프롤로그 보장을 안 태운다
   (위 §3). 「두 장이라야 탈출이 열린다」가 실제로 이사 성공률을 올리는지는 **아직 아무도 안 쟀다.**
   ⇒ 그 재현에 `setPrologueVarieLeaf([2,3])` 을 물리면 잴 수 있다. **다만 그건 그 재현의 성격을
   바꾸는 일이다** — 지금은 「튜토 확정 무늬만으로 나갈 수 있나」를 재는 자다. plan 이 정할 것.
2. `G-2b`(세 경로가 중앙값 안에 성립한다)가 **A 20% · B 43% 로 빨갛다.** 내 작업 전부터 그랬고
   내 작업이 한 톨도 안 바꿨다. 삽수 창의 새 값(어두움 8만 / 창턱 360만 / 등 밑 570만)이
   들어간 뒤 다시 재야 답이 나온다.
3. 씨앗 그루의 **화분 에셋**이 선물과 같은 것(`monstera/pot.glb`)이다. 상점에서 고른 그릇
   (`pot_terracotta` 같은 것)을 쓰게 하려면 그 배선이 필요하다 — 값·자리 한도가 걸려 있어
   기획 판단이다.
4. **열 그루짜리 판을 안 재 봤다.** 메시는 그루마다 생기므로 어디선가 무거워진다.
   지금 판(두세 그루)은 문제가 없다.
5. 씨앗을 **몇 개까지 심을 수 있게 할 것인가** — 지금은 자리와 돈만 있으면 무한이다.
   느리긴 하지만(0일부터) 자리 수가 유일한 한계다.

---

## 5. 못 한 것

* ⛔ **걸음 4(`promoteToPot`)** — `propagation.js` 를 다른 창이 쥐고 있어 손대지 않았다.
* ⛔ **화면(단추·그루 고르기)** — `game.html`·`ui.js` 는 쓰기 영역 밖이다. 아래 §6 에 코드째로 적었다.
* ⚠ **`turn.plants` 를 화면이 아직 안 읽는다.** 코어는 그루마다의 값을 다 싣고 있는데
   화면은 첫 화분의 옛 칸만 본다 — 두 그루를 놓아도 화면엔 하나만 보인다.

---

## ★★ 못 담은 것 — 마스터가 한 번에 넣어야 하는 파일

다른 창(삽수 단순화)의 변경이 **같은 파일에 섞여 있어** 가를 수 없었다.
지시대로 커밋하지 않고 그대로 두었다.

| 파일 | 내 변경 | 섞인 남의 변경 |
|---|---|---|
| `src/game/loop.js` | `stepPlantDay` 들어내기 · `S.pots` 순회 · 화분별 이력/적립통/기억 · `selectPlantFor` · `potTag` · `prologueVarieEvents`(두 장) | `headroomOfTurn` 위 주석(2026-08-17 밴드가 무늬율도 정한다) |
| `src/game/save.js` | `packPot` 의 `growthId`·`growthSeed`·`dliHist` · `restoreGrowth` 화분별 재생(`restoreOnePlant`) · `deserialize` 이력 되돌리기 | `packCutting` 칸 둘 · `migrateCuttingRules` · `VARIE_LIGHT` 임포트 |
| `tools/test_multiplant_core.mjs` | **새 파일(전부 내 것)** — 다만 위 둘에 기대므로 같이 들어가야 초록이다 |

### 내가 담은 커밋

| 커밋 | 무엇 |
|---|---|
| `8f560c2` | 걸음 1 — 엔진 등록부 (`plant_grow.html` · `tools/test_multiplant.mjs` · 설계 문서) |
| `849b509` | 걸음 2 앞부분 + 걸음 3 (`growth_adapter.js` · `state.js` · `plant_grow.html`) |
| `44c208d` | 프롤로그 두 장 (`plant_grow.html` · `growth_adapter.js` · `state.js` · `dialogue.js` · `test_prologue_varie.mjs`) |

⚠ **`849b509`·`44c208d` 만으로도 HEAD 는 초록이다**(엔진·어댑터·상태는 덧붙이기라 옛 길이 안 깨진다).
다만 **두 그루가 실제로 굴러가려면 위 표의 셋이 같이 들어가야 한다.**

---

## 6. 화면 — 내가 못 붙인 것. **코드째로 적는다**

### ① 씨앗 심기 단추 (`game.html` 또는 `ui.js`)

```js
import { plantMonsteraSeed, SEED_ITEM_ID, SEED_POT_ITEM_ID } from './src/game/state.js';
import { stockOf, incomingOf, CATALOG } from './src/game/shop.js';

/* 단추를 켤지 흐리게 할지 — **상태를 안 바꾼다** */
function canPlantSeed(S, io) {
  if (!io.growth || typeof io.growth.multi !== 'function' || !io.growth.multi())
    return { ok: false, why: '생장 창이 아직 준비되지 않았습니다' };
  const seeds = stockOf(S, SEED_ITEM_ID), pots = stockOf(S, SEED_POT_ITEM_ID);
  if (!seeds) return { ok: false, why: incomingOf(S, SEED_ITEM_ID)
    ? '몬스테라 씨앗이 배송 중입니다' : '몬스테라 씨앗을 먼저 주문해 주세요' };
  if (!pots)  return { ok: false, why: incomingOf(S, SEED_POT_ITEM_ID)
    ? '검은 모종포트가 배송 중입니다' : '검은 모종포트를 먼저 주문해 주세요' };
  return { ok: true, why: null };
}

/* 누르면 — ⚠ tutorialInput 예외는 **고장이 아니라 안내**다(빨간 상자로 띄우지 말 것) */
function onPlantSeed(S, io) {
  try {
    const pot = plantMonsteraSeed(S, io, { log: m => pushLog(S, m) });
    /* 심자마자 자리를 정하게 한다 — 자리를 안 주면 빛이 null 이라 영영 안 자란다 */
    openPlacePicker(pot.id);
    return pot;
  } catch (e) {
    if (e.tutorialInput) return toast(e.message);      // 안내
    throw e;                                           // 진짜 고장
  }
}
```

⚠ **자리를 반드시 받아라.** `plantMonsteraSeed` 는 `opt.at` 을 안 주면 화분만 만든다.
자리가 없는 화분은 조도 계약에 안 실려 **하루가 가도 아무 일이 안 난다** — 조용한 실패다.
`setPotAt(S, pot.id, at, { slots, size, snapDist })` 로 이어 붙일 것.

### ② 그루 고르기 (확대창이 어느 그루를 보여 주나)

```js
/* 화분 목록 — turn.plants 가 그루마다의 값을 이미 싣고 있다 */
const rows = turn.plants.map(p => ({
  potId: p.potId,
  ko:    p.potId === 'pot_01' ? '몬스테라 (선물)' : `몬스테라 (${p.potId})`,
  days:  p.effectiveGrowthDays,
  dli:   p.dli,
  state: p.potDry || p.headroomBlocked || p.growthBlocked || '자라는 중'
}));

/* 고르면 확대창이 그 그루를 그린다 — plant_grow 가 고른 그루만 보인다 */
function pickPlant(S, io, potId) {
  const pot = S.pots.find(p => p.id === potId);
  io.growth.select(pot.growthId || '__main__');
}
```

★ `selectPlant` 는 **다시 안 그린다**(그루마다 그룹이 따로라 마지막 모습이 그대로 서 있다).
확대창을 그 자리에서 새로 그리고 싶으면 `io.growth.setGrowth(io.growth.growthDays())` 를
부르지 **말 것** — 그건 점프다. 그냥 다음 [다음 날]에 그려진다.

### ③ 몬이 대사 — `varie_lucky2`

`dialogue.js` 에 `varieSecond` 를 넣어 뒀고 `EVENT_SCRIPT` 표와 `EVENT_ORDER` 에도 이었다.
화면은 **이미 하던 대로** `turn.events` 를 `dialogue.scriptsForEvents` 에 넘기면 된다 —
새로 붙일 배선이 없다.

---

**END 22:41:52**
