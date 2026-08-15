# 무늬 등급을 「장수」에서 「종류」로 — 붙였다

> **START 2026-08-16 00:30 · END 2026-08-16 01:45** (이 창의 벽시계)
> 확정문 `plan-2026-08-17-varie-grade.md` §1~§5 를 코드에 붙인 결과다.
> ⚠ **화면 배선은 안 했다.** `game.html` · `src/game/ui.js` 는 한 글자도 안 고쳤다(⛔ 목록).
> 그래서 §5「화면이 뭘 불러야 하나」가 이 문서에서 제일 중요한 절이다.

---

## 0. 한 줄

**등급이 「무늬 잎이 몇 장인가」에서 「그 잎이 어느 무늬인가」로 바뀌었다.**
값은 이제 잎마다 매기고(무지 2만 · 산반 35만 · 하프문 75만 · 풀문 115만),
삽수냐 그루냐는 **잎 수가 아니라 파는 길**(×1.0 대 ×1.4)이 가른다.
표·확률·갈래 묶음은 **전부 `data/balance/varie_grades.json`** 에 있고 코드는 읽기만 한다.

---

## 1. 등급별 값 (정본: `data/balance/varie_grades.json`)

| 등급 | 잎 1장 값 | 에셋 갈래 | 그 갈래들 |
|---|---:|---:|---|
| 무지 | **20,000원** | 0 | (민무늬) |
| 산반 | **350,000원** | 8 | 스페클-그린크림 · 제브라-그린흰 · 별무늬-그린흰 · 별무늬-그린옐로우 · 별무늬-페일그린 · 오로레아-그린옐로우 · 라임-레몬패치 · 네온-라임 |
| 하프문 | **750,000원** | 5 | 하프문-그린흰 · 하프문-그린크림 · 갤럭시-틸골드 · 갤럭시-다크틸 · 별무늬-핑크민트 |
| 풀문 | **1,150,000원** | 5 | 핑크-로즈핑크 · 오로레아-골드 · 핑크-로즈 · 모브-라벤더그레이 · 알보-전체흰 |

```
잎 값 합 = Σ(그 잎 등급의 값)
삽수 = 합 × 1.0     그루 = 합 × 1.4
시너지 = 서로 다른 **무늬** 등급 2종 ×1.25 · 3종 ×1.50   (무지는 종수에 안 센다)
```

### 잎 구성별 실측값 (`tools/test_variegrade.mjs` 가 매번 다시 잰다)

| 잎 구성 | 잎 값 합 | 시너지 | 삽수 | 그루 |
|---|---:|---:|---:|---:|
| 잎1 산반 | 350,000 | ×1 | **350,000원** | 490,000원 |
| 잎1 하프문 | 750,000 | ×1 | **750,000원** | 1,050,000원 |
| 잎1 풀문 | 1,150,000 | ×1 | **1,150,000원** | 1,610,000원 |
| 잎3 무지 | 60,000 | ×1 | 60,000원 | 84,000원 |
| ★ **프롤로그**(무지·산반·하프문) | 1,120,000 | ×1.25 | 1,400,000원 | **1,960,000원** |
| 잎3 전부 산반 | 1,050,000 | ×1 | 1,050,000원 | 1,470,000원 |
| 잎3 산반·하프문·풀문 | 2,250,000 | ×1.5 | 3,375,000원 | 4,725,000원 |
| 잎5 무지2 하프문3 | 2,290,000 | ×1 | 2,290,000원 | 3,206,000원 |

### 자리가 정하는 등급 (확정문 §3)

| 자리 | 산반 | 하프문 | 풀문 | 무늬 1장 기대값 |
|---|---:|---:|---:|---:|
| 어두움 (critical·poor·stagnant) | 90% | 9% | 1% | **394,000원** |
| 중간 (slow) | 70% | 25% | 5% | **490,000원** |
| 밝음 (best·good·over) | 45% | 40% | 15% | **630,000원** |

⚠⚠ **확정문 §3 의 「밝음 632,500원」은 산술이 어긋난다.**
`0.45×350,000 + 0.40×750,000 + 0.15×1,150,000 = 157,500 + 300,000 + 172,500 = 630,000` 이다.
어두움·중간은 확정문 값과 **한 원도 안 다르다** — 밝음 한 줄만 오타다.
⇒ 「밝은 자리가 어두운 자리의 **1.6배**」라는 결론은 **그대로 선다**(630,000 ÷ 394,000 = 1.599).
데이터 파일에는 실제로 나오는 630,000 을 기준으로 적었고, `_doc_lightGrade` 에 이 정정을 남겼다.

---

## 2. ★ 프롤로그 그루 — 확정문 §6-1 실측

| | 값 |
|---|---:|
| 잎1 무지 | 20,000원 |
| 잎2 산반 | 350,000원 |
| 잎3 하프문 | 750,000원 |
| 잎 값 합 | 1,120,000원 |
| × 그루 1.4 | 1,568,000원 |
| × 시너지 1.25 (산반·하프문 2종) | **1,960,000원** |
| 이사비 | 2,000,000원 |
| **모자란 돈** | **40,000원** |

**확정문 §2 와 한 원도 안 다르다.** 검사 `B-1`·`B-2` 가 이 등식을 못 박는다.

★ 그리고 이 값은 **빛을 못 재도 나온다** — 프롤로그 못박기(§4)가 자리와 무관하게 먼저 걸리게 했다
(검사 `E-1`). 「첫 판은 늘 같은 그림」이 그래야 성립한다.

---

## 3. ⚠⚠ 이사 성공률 — 전 · 후 · **떨어졌다. 그리고 원인은 값이 아니다**

`tools/test_banjiha_routes.mjs` · 40판 · 같은 씨앗

| 경로 | 전 (HEAD) | 후 | |
|---|---:|---:|---|
| A (등 없이) | 38% | **13%** | ★ A 는 의도된 실패라 그 자체로는 사고가 아니다 |
| B (등 사고) | 60% | **13%** | ⚠ **사고** |
| C (한 박자 늦게) | 100% | **28%** | ⚠⚠ **사고** |
| A㉡ (무늬를 모아 키운다) | 38% | 10% | |
| B㉡ | 38% | 18% | |
| C㉡ | 100% | **100%** | ★ 이쪽은 안 떨어졌다 |

⚠ 「전」은 **HEAD 를 통째로 꺼내 따로 돌린 것**이다(`git archive HEAD`).
작업 트리의 「전」이 아니다 — 다른 창이 `dialogue.js`·`quest.js`·`START-HERE.md` 를 물고 있어서
그쪽 변경이 섞이면 원인이 흐려진다.

### ★★ 그런데 **값이 낮아진 게 아니다. 오히려 올랐다**

| | 전 | 후 |
|---|---:|---:|
| 잭팟 총액 중앙값 | 2,225,333원 | **4,482,500원** |
| 무늬 삽수 1장 | 80,000원 | **350,000원** |
| 민무늬 삽수 1장 | 12,000원 | **20,000원** |

**팔면 돈이 두 배로 들어온다. 그런데 못 나간다.** ⇒ 파는 값이 아니라 **재는 자**가 범인이다.

### ★★★ 범인 — 「가진 걸 다 팔면 얼마인가」를 재는 자가 **낡았다**

`tutorial.js §sellableWonOf`(711·721행)가 그루를 이렇게 어림잡는다:

```js
won += priceOf({ leaves, variegatedLeaves });   // ← form 도 등급도 안 준다
```

이 한 줄이 **두 번 틀린다**: ① `form` 이 없어 **삽수 값(×1.0)** 으로 센다 ② 잎별 등급이
없어 무늬 잎을 **전부 산반**(제일 싼 무늬)으로 읽는다.

반지하 탈출판(잎 11장 중 무늬 3장)으로 재면:

| 재는 법 | 값 | 이사비 2,000,000원 |
|---|---:|---|
| **지금 `sellableWonOf`** (삽수 form · 전부 산반) | **1,210,000원** | ✗ 못 넘는다 |
| `form:'pot'` 만 고치면 | 1,694,000원 | ✗ 아직 못 넘는다 |
| ★ **실제로 `listPot` 이 매기는 값** | **2,817,500원** | ✓ 넘는다 |
| 장부까지 배선한 뒤(산반+하프문2 예) | 3,517,500원 | ✓ |
| (참고) 옛 규칙의 같은 판 | 2,213,333원 | ✓ |

그런데 **그 어림값이 문을 연다.** 두 군데가 그걸로 판단한다:

1. `tutorial.varieGrantCheck` — `have >= moveOutCostWon` 이면 **확정 무늬를 그만 준다**
2. `test_banjiha_routes:487` — `cash + 삽수 + potWon >= 이사비` 라야 **모주를 내놓는다**

⇒ 어림이 1,210,000원에 머무니 **모주를 영영 안 내놓고**, 안 내놓으니 못 나가고,
못 나간 채 하루 16,667원이 나가서 **파산한다**(A 파산 25판 → 35판).
★ 실제로 팔면 2,817,500원인데 **게임이 그 사실을 모른다.**

### ⇒ 고칠 두 줄 (둘 다 이 창의 쓰기 영역 밖이라 안 고쳤다)

**① `src/game/tutorial.js` §sellableWonOf** — 그루 쪽 한 줄

```js
// 지금 (721행)
if (leaves >= 1) won += priceOf({ leaves, variegatedLeaves: varie }).won;

// 이렇게
import { potPriceOf, potLeafGradeListOf, prologueLeafGradeListOf } from './shop.js';
if (leaves >= 1) {
  const p0 = (S.pots || [])[0];
  won += potPriceOf({ leaves, variegatedLeaves: varie,
    leafGrades: potLeafGradeListOf(p0, leaves, varie)
             || prologueLeafGradeListOf(S, p0, leaves, varie) }).won;
}
```
⚠ 삽수 쪽(711행)은 `cuttingPriceOf({ leaves, variegatedLeaves: varie, leafGrades: c.leafGrade })`
로 바꾸면 된다 — `form` 기본이 이미 삽수라 **지금도 값은 맞지만**, 등급을 안 넘겨서
하프문 잎이 산반 값을 받는다.

**② `tools/test_banjiha_routes.mjs:487`** — 재현의 같은 어림. 위와 같은 모양으로.

### ★ 「전」으로 못 되돌린 것 — 재서 적는다

`shop.js` 안에 **§배선이 오기 전의 다리**(`prologueLeafGradeListOf`)를 넣어
장부가 비어도 프롤로그 그루가 §4 대로 서게 했다. 그것만으로 **잭팟 총액이
3,170,000 → 4,482,500원**으로 올랐지만 **이사 성공률은 한 판도 안 움직였다**
(A 13% · B 13% · C 28% 그대로). ⇒ 병목이 파는 값이 아니라 **재는 자**라는 증거다.
⚠ 그러니 「값을 더 올려서 고치자」는 **틀린 처방**이다. 값은 이미 두 배다.

---

## 4. 무엇을 고쳤나 — 파일별

| 파일 | 무엇 |
|---|---|
| `data/balance/varie_grades.json` **(새로)** | §1 갈래 묶음 · §2 값·배수 · §3 빛별 확률 · §4 프롤로그 못박기 · 밴드 묶음 · 미배정 갈래. **정본** |
| `src/game/shop.js` | §⑥ 값 매기기를 통째로 갈았다. §⑥-0 파일 읽기 · §⑥-1 등급 다루기 · §⑥-2 값 · §⑥-3 그루의 잎별 등급 장부 |
| `src/game/propagation.js` | 삽수가 잎마다 등급을 든다(`c.leafGrade`). 새 잎이 무늬로 나면 그 자리 빛으로 등급을 굴린다. `VARIE_LIGHT_BANDS` 를 정본에서 읽게 바꿨다 |
| `src/game/save.js` | `packCutting.leafGrade` · `packPot.leafGrades` 를 적는다. `migrateVarieGrades` 가 옛 판을 **기록에 남기며** 산반으로 읽는다 |
| `src/game/growth_adapter.js` | `leafState({ grades })` — 잎별 상태에 `grade` 를 얹어 낸다(방·확대창·값이 같은 줄을 보게) |
| `tools/test_variegrade.mjs` **(새로)** | 검사 32개 |

### ⛔ 없앤 것 둘 — 왜 없앴는지 코드에 남겼다

**① 「섹터」 갈래** (`shop.js §⑥` 주석)
확정문은 셋(산반·하프문·풀문)이고 섹터는 갈 곳이 없다. 지우면서 **그 배수 320/9 ≈ 35.556 이
실제 시장가에서 나온 값**이라는 사실을 주석에 남겼다 —
`sale_economy.md` 「포토스 희귀무늬 성체 800,000」 ÷ (3,750×6) 이었고,
그래서 2026-08-09 에 「산반 8 과 섹터 320/9 는 못 건드린다」고 못 박아 두었던 자리다.
⇒ **값이 틀려서 지운 게 아니라 축이 바뀌어서 지웠다.** 섹터는 「무늬 잎 2장」이라는 *장수* 칸에
붙어 있던 이름이고, *종류* 축에는 대응하는 에셋이 없다(하프문이 그 자리를 먹는다).

**② `CUTTING_GRADE_CAP`** (삽수 등급 뚜껑)
근거였던 *"삽수는 무늬가 유지될지 모른다"* 가 2026-08-17 삽수 단순화(원복·고스트 걷힘)로
사라졌다. 남은 뜻 「삽수는 싸다」는 ×1.0 대 ×1.4 가 대신한다.
⇒ 잎 3장짜리 삽수가 뚜껑을 빠져나가던 구멍도 같이 막혔다.
⇒ 잎 1장짜리 하프문 삽수가 **80,000원 → 750,000원**이 됐다(검사 `C-4`).

---

## 5. ★★★ 화면이 뭘 불러야 하나 — `game.html` · `ui.js` 배선

**세 줄이면 끝난다.** 순서대로 적는다.

### ㉠ 정본 파일 꽂기 — `game.html` 부팅부 (다른 밸런스 파일 바로 옆)

```js
import { installVarieGrades } from './src/game/shop.js';
installVarieGrades(
  await fetch('./data/balance/varie_grades.json').then(r => r.ok ? r.json() : null).catch(() => null));
```

⚠ **안 붙여도 돌아간다.** `shop.js` 가 열릴 때 스스로 한 번 읽어 본다(§⑥-0 ①).
붙이는 값어치는 「다른 밸런스 파일과 같은 자리에 보이는 것」 하나다.
⚠ `staminaRulesFrom(...)` 바로 아래(`game.html:2475` 근처)가 자연스러운 자리다.

### ㉡ 턴이 끝날 때 — 새로 난 무늬 잎에 등급을 붙인다

```js
import { assignPotLeafGrades } from './src/game/shop.js';

const r = assignPotLeafGrades(S, {
  potId:     pot.id,                       // 없으면 S.pots[0]
  leafState: io.growth.leafState(),        // [{ leafBirth, varie, matured, fade, dropped }]
  band:      lightReport.band              // 'best' | 'slow' | 'poor' … (몬스테라 밴드 이름)
});
// r = { grades, assigned, pending, step, events }
```

| 반환 칸 | 모양 | 뜻 |
|---|---|---|
| `grades` | `{ [leafBirth]: 'sanban'\|'halfmoon'\|'fullmoon' }` | 그 화분의 장부 (`pot.leafGrades` 와 같은 객체) |
| `assigned` | `[{ leafBirth, leafNo, grade, gradeKo, why }]` | **이번에 새로 정해진 잎**. `why` 는 `'prologue'` 또는 `'light'` |
| `pending` | `number` | 무늬인데 아직 등급을 못 정한 잎 수 (빛을 못 잰 자리) |
| `step` | `'dark'\|'mid'\|'bright'\|null` | 이번에 쓴 밝기 |
| `events` | `[{ id:'leaf_grade', leafBirth, leafNo, grade, ko }]` | 그대로 배너에 띄우면 된다 |

`ko` 는 이미 사람 말이다 — 예: `2번째 잎의 무늬는 **하프문**입니다 — 잎 한 장 750,000원 (밝은 자리)`

★ **하루에 한 번, 어디서 불러도 안전하다.** 이미 정해진 잎은 안 건드리고(검사 `E-3`),
빛을 못 재면 아무것도 안 정한다(검사 `E-2`). 같은 세이브면 같은 답이 나온다(검사 `E-4`).

### ㉢ 값을 매길 때 — **`form` 을 반드시 준다**

⚠⚠ **여기가 제일 조심할 자리다.** `priceOf` 의 기본이 `form: 'cutting'`(×1.0)이다.
확정문 §2 가 *"위 표가 곧 삽수 값이다"* 라고 못 박아서 그렇게 뒀다.
⇒ **그루를 매기면서 `form` 을 빠뜨리면 값이 1.4배 싸진다.**
그래서 실수할 수 없는 이름 둘을 냈다:

```js
import { potPriceOf, cuttingPriceOf } from './src/game/shop.js';
potPriceOf({ leaves, variegatedLeaves, leafGrades })      // 그루 ×1.4
cuttingPriceOf({ leaves, variegatedLeaves, leafGrades })  // 삽수 ×1.0
```

`listPot` · `listCutting` 은 **이미 안에서 그렇게 부른다** — 화면이 「올리기」만 쓰면 손댈 것이 없다.
`listPot(S, { leaves, variegatedLeaves })` 는 화분 장부를 스스로 읽어 등급을 채운다.

**반환 모양** (옛 칸은 전부 그대로 있고 새 칸이 늘었다):

```js
{
  won, leaves, variegatedLeaves, plainLeaves,
  leafGrades: ['plain','sanban','halfmoon'],   // ★새 — 잎마다 무엇인가
  byGrade:    { plain:1, sanban:1, halfmoon:1 },// ★새 — 등급별 장수
  leafSumWon: 1_120_000,                        // ★새 — 곱하기 전 합
  form: 'pot', formMult: 1.4,                   // ★새 — 파는 길
  varieKinds: 2, synergy: 1.25,                 // ★새 — 시너지
  grade: 'halfmoon', gradeKo: '하프문',          // 제일 높은 등급(한 마디로 말할 때)
  v, size, gradeCapped:false, multiplier        // ⏸ 옛 칸 (뜻은 바뀌었다)
}
```

### ㉣ 자르기 화면 — `cutPlanOf` 가 두 표를 낸다

```js
cutPlanOf(S, node, container)  // 반환에 아래 둘이 늘었다
```

| 칸 | 모양 |
|---|---|
| `lightTable` | `[{ step, ko, chance }]` — **무늬가 나나 마나** (20/50/80%) · 예전 그대로 |
| `gradeTable` | `[{ step, ko, expectedWon, grades:[{ grade, ko, chance, leafWon }] }]` — ★새 · **난 뒤 어느 등급인가** |
| `carriedGrades` | `[{ grade, ko, leafWon }]` — ★새 · **이 마디를 자르면 딸려가는 잎의 등급** |

★ `carriedGrades` 를 화면에 안 띄우면 「하프문 잎이 달린 마디」와 「산반 잎이 달린 마디」가
같아 보인다. 값이 **2.14배** 다르다(검사 `F-1`).

### ㉤ 다른 창구들

| 부르는 것 | 무엇 |
|---|---|
| `varieGradeRules()` | 지금 도는 등급표 한 벌 (`grades` · `sale` · `lightGrade` · `byId` · `source`) |
| `varieGradeExpectedWon('bright')` | 그 자리 무늬 1장 기대값 — 「밝은 데 두면 얼마나 이득인가」 |
| `varieLightStepOfBand(band)` | 밴드 → `'dark'\|'mid'\|'bright'` (모르면 `null`) |
| `varieLeavesNeededFor(won, { leaves, form })` | 역산. ★ 이제 `byGrade` 로 **등급마다 따로** 낸다 |
| `potLeafGradeListOf(pot, leaves, varieLeaves)` | 화분 장부 → `priceOf` 가 받는 배열 |

⚠ `varieLeavesNeededFor` 의 `needVarieLeaves` 는 이제 **「어느 등급으로 셌는지」를 같이 봐야 뜻이 선다.**
기본은 산반이라 「최소한 이만큼」이 아니라 **「흔한 무늬로만 채우면 이만큼」**이다.
`game.html:2325` 가 이 함수를 쓰고 있으니 문구를 그렇게 고쳐야 한다.

---

## 6. 3D 스킨 고르기가 **같은 값**을 보게 하려면

### 지금 어떻게 도나 (재서 적는다)

`plant_grow.html` 이 무늬 잎을 그릴 때 쓰는 키는 `leaf_mat{n}` 이고 그 n 은
`skins/mon_*.glb` 한 장을 가리킨다. 대표 번호는 **1, 4, 7, … 55** 이고 그 뒤 둘(`+1` `+2`)은
**같은 메시의 리텍스처본**(-쨍 / -차분)이라 같은 갈래다.
고르는 자는 `pickLeafKey` → `matFromMid(alboMid, matRoll)` 이고, **잎마다가 아니라 축마다** 굴린다.

### 이 창이 내주는 것

```js
import { gradeOfMatNum, gradeOfSkinAsset, skinKeysOfGrade } from './src/game/shop.js';

gradeOfMatNum(34)                  // → { id:'halfmoon', ko:'하프문', leafWon:750000, assets:[…] }
gradeOfMatNum(35)                  // → 같은 하프문 (-쨍 본도 대표로 접는다)
gradeOfSkinAsset('speckle_greencream')  // → 산반
skinKeysOfGrade('fullmoon')        // → ['leaf_mat1','leaf_mat2','leaf_mat3', … 15개]
```

그리고 `growth_adapter.leafState({ grades })` 가 줄마다 `grade` 를 얹어 낸다:

```js
io.growth.leafState({ grades: pot.leafGrades })
// → [{ leafBirth, varie, matured, fade, dropped, grade:'halfmoon'|null }, …]
```

`room_view` 는 이 목록을 이미 `spec.leafState` 로 그대로 넘기고 있으므로,
**`grade` 칸은 지금도 아무 배선 없이 방까지 간다.**

### ⚠ 그런데 **아직 안 닿는다** — 못 한 것

`plant_assemble.js §__setLeafState` 는 잎마다 `VARIE_STATE.set(leafBirth, !!varie)` **참·거짓만** 앉힌다.
무늬 종류를 잎마다 강제하려면 `plant_grow.html` 에 손잡이가 하나 있어야 한다 —
지금 있는 것은 `P.matAlboPick`(**그루 한 벌**)뿐이다.

⇒ **필요한 것은 `plant_grow.html` 한 줄짜리 창구다:**

```js
// plant_grow.html — VARIE_STATE 옆에 한 벌 더
let VARIE_SKIN = new Map();          // leafBirth → leaf_mat 번호 (없으면 지금처럼 굴린다)
// drawLeafStage / pickLeafKey 의 성숙 분기에서:
//   const forced = VARIE_SKIN.get(leafBirth);
//   const n = forced || (P.matAlboPick>0 ? … : matFromMid(alboMid, matRoll));
```

그러면 `plant_assemble.__setLeafState` 가 `it.grade` → `skinKeysOfGrade(grade)` 중 하나를
골라 앉히면 되고, **화면 무늬와 값 등급이 원리적으로 같아진다.**

⚠ 그때까지는 **값이 정본이고 화면은 제 굴림으로 그린다.** 분홍 잎이 떠 있는데 값은 산반일 수 있다
(확정문 §5 가 *"그게 제일 나쁜 거짓말"* 이라 한 자리다). **안 어긋난 척하지 않는다.**
⚠ `plant_grow.html` 은 이 창의 ⛔ 목록 밖이지만 **다른 창(growth) 소유**라 손대지 않았다.

---

## 7. 옛 세이브 — 확정문 §5 대로 「산반으로 읽고, 기록에 남긴다」

| | |
|---|---|
| 삽수 | `packCutting.leafGrade` 를 새로 적는다. 옛 판에는 칸이 없어 전부 `null` 이 된다 |
| 그루 | `packPot.leafGrades` 를 새로 적는다. 옛 판에는 칸이 없어 `{}` 가 된다 |
| 읽을 때 | `migrateVarieGrades(S, 날것)` 이 **세고 말한다.** 값은 **안 바꾼다** |

열면 이런 줄이 기록에 남는다:

```
🎨 예전 판의 삽수 1개(무늬 잎 2장)에 등급이 없습니다 — 값을 매길 때 **산반**으로 읽습니다(확정문 §5)
🎨 예전 판의 그루 1개에 잎별 등급 장부가 없습니다 — 이미 난 무늬 잎은 **산반**으로 읽고,
   앞으로 나는 잎부터 자리의 빛이 등급을 정합니다
```

★ **왜 값을 안 바꾸나.** 등급을 세이브에 채워 넣으면 「모른다」가 「산반으로 정해졌다」로 굳고,
그 뒤로 그 잎이 빛으로 다시 정해질 길이 **영영 막힌다.**
⇒ 산반으로 펴는 것은 **값을 매기는 그 순간뿐**이다(`shop.leafGradeListOf`). 되돌릴 수 있는 자리에만 뒀다.
⚠ 「칸이 없다」와 「비어 있다」를 가르려고 **정리 전 날것**(`st`)을 보게 했다 —
새 판도 무늬가 나기 전에는 비어 있어서, 안 가르면 새 판마다 이관 로그가 뜬다(검사 `H-3`).

---

## 8. 검사 — 전 · 후 (68개 전부)

서버 두 대를 띄워 **같은 조건에서 두 번** 돌렸다 —
「전」은 `git archive HEAD` 로 꺼낸 깨끗한 나무(포트 8964), 「후」는 작업 트리(포트 8963).

| | 전 (HEAD) | 후 | |
|---|---|---|---|
| `test_banjiha_routes` | FAIL (2건) | **FAIL (4건)** | ⚠ 늘었다 — 아래 |
| `test_crop_seat` | FAIL | FAIL | 원래 깨져 있었다 |
| `test_free_place` | FAIL (F) | FAIL (F) | 원래 깨져 있었다 |
| `test_siru_pick` | FAIL | FAIL | 원래 흔들린다(START-HERE §5) |
| `test_questui` | FAIL | PASS | ⓘ 내 것이 아니다 — 다른 창이 `quest.js` 를 고쳐 뒀다 |
| `test_dawn6` | PASS | (한 번 FAIL) | ⓘ **흔들림.** 단독으로 다시 돌리니 rc=0 (3757ms/6000ms 타이밍) |
| **`test_cutting_wiring`** | PASS | **FAIL** | ★ 내가 깼다 |
| **`test_dialogue_coverage`** | PASS | **FAIL** | ★ 내가 깼다 |
| **`test_market`** | PASS | **FAIL** | ★ 내가 깼다 |
| `test_variegrade` **(새로)** | — | **PASS (33검사)** | |
| 나머지 60개 | PASS | PASS | |

### ★ 깨진 것 넷 — **깨진 채로 보고한다. 값을 임의로 낮추지 않았다**

| 검사 | 무엇이 | 왜 |
|---|---|---|
| `test_cutting_wiring` §G | `priceOf({leaves:1}).won === 12_000` | **옛 상수를 박아 뒀다.** 지금은 20,000원(무지 잎 한 장) |
| `test_banjiha_routes` §E | `12_000` · `80_000` · `2_133_333` 셋 | 같은 이유. 지금은 20,000 · 350,000 · (잎3 하프문 그루) 3,150,000 |
| `test_market` §H | 올린 값 ≠ `priceOf(…)` | 검사가 **삽수 값**으로 어림잡는다. `listPot` 은 그루(×1.4)+등급으로 매긴다 ⇒ `potPriceOf` 로 바꿔야 한다 |
| `test_dialogue_coverage` ⑵ | `move_short_money` 가 안 난다 | ★ **진짜 변화다.** 「배움은 끝났는데 돈이 모자라다」 대사가 세 경로 어디서도 안 나온다 |
| `test_banjiha_routes` §G-2c | 이사한 21판 중 7판이 **여름에 끝난다**(최단 33일) | ★ **진짜 변화다.** 값이 오르니 가을·식물등·겨울을 안 보고 나가는 판이 생겼다 |

⚠ 앞 셋은 **검사가 옛 상수를 든 것**이라 값을 고칠 일이 아니다(START-HERE §2 — 「검사가 옛
상수를 박아 둔 것」). 뒤 둘은 확정문의 값이 실제로 만든 결과라 **박사님 판단**이다(§9).

### ★ `game.html` 부팅 — **JS 예외 0** (직접 쟀다)

`python tools/serve.py 8963` + `tools/test_cdp.mjs` 로 폰 세로(390×844) 부팅:

| | |
|---|---|
| `Runtime.exceptionThrown` | **0건** |
| 4xx/5xx | 1건 — `/favicon.ico` (**HEAD 에서도 똑같이 난다.** 내 것이 아니다) |
| `#roomCanvas` | 있다 |
| 브라우저가 읽은 등급표 | `data/balance/varie_grades.json` ✓ |
| 브라우저에서 잰 프롤로그 그루 | **1,960,000원** ✓ |

★ **정본이 배선 없이도 브라우저에 닿는다** — `shop.js` 가 열릴 때 스스로 한 번 읽는다.

---

## 9. 판단필요 — 박사님이 정해 주셔야 하는 것

| 무엇 | 왜 물어보나 |
|---|---|
| ★★ **차콜-다크그린은 어느 등급인가** | 확정문 §1 은 「18갈래」라 적었는데 에셋은 **19갈래**다. `mon_charcoal`(변이-차콜-다크그린) 하나가 표에서 빠졌다. 지금은 미배정이라 산반 값으로 떨어진다 |
| ★★ **여름에 끝나는 판을 둘 것인가** | 값이 두 배가 되면서 최단 33일에 나가는 판이 생겼다(이사한 21판 중 7판이 여름). **가을·식물등·겨울을 통째로 안 본다.** 튜토 길이 문제라 값·이사비와 한 벌이다 |
| ★ **「돈이 모자라다」 대사를 살릴 것인가** | `move_short_money` 가 세 경로 어디서도 안 난다 — 배움이 끝나면 이미 돈이 넘친다. 대사를 지울지, 문턱을 올릴지 |
| ★ **밝음 기대값은 630,000원이다** | 확정문 §3 이 632,500원이라 적었는데 산술이 어긋난다(§1 ⚠⚠). 630,000 으로 두었다 — 확률 쪽을 고쳐 632,500 에 맞출 수도 있다 |
| **시너지가 이대로 세도 되나** | 3종을 모으면 ×1.5 다. 잎3(산반·하프문·풀문) 그루가 **4,725,000원** — 이사비의 2.4배다 |
| **풀문 1잎 삽수가 1,150,000원이다** | 어두운 자리에서도 1% 로 난다. 운 하나로 이사비의 절반이 나온다 |

---

## 10. 못 한 것

| 무엇 | 왜 |
|---|---|
| ★★ **`tutorial.sellableWonOf` 를 못 고쳤다** | 이 창의 쓰기 영역 밖이다. **이것 때문에 이사 성공률이 떨어졌다**(§3). 고칠 코드는 §3 에 그대로 있다 |
| ★★ **화면 배선** (`game.html` · `ui.js`) | ⛔ 목록이다. §5 에 부를 것과 반환 모양을 다 적었다 |
| ★ **잎별 3D 스킨 강제** | `plant_grow.html` 에 손잡이가 없다(그루 한 벌짜리 `P.matAlboPick` 뿐). **그 파일은 growth 창 것이다.** §6 에 필요한 한 줄을 적었다 |
| 옛 상수를 든 검사 셋 | `test_cutting_wiring` · `test_banjiha_routes` · `test_market` — 전부 이 창의 쓰기 영역 밖이다 |
| `probe_move_econ.mjs` · `probe_varie_lineage.mjs` | `VARIE_GRADES[].minVarieLeaves` · `CUTTING_GRADE_CAP` 을 읽는다 — 없어진 칸이라 그 두 재현이 깨진다(`probe_*` 라 검사에는 안 잡힌다) |

---

## 11. ⓘ 덤으로 잡은 것 — **이관 알림이 한 번도 화면에 안 떴다**

`save.js` 의 `migrateCuttingRules`(2026-08-17)는 `pushLog` 로 「말한다」고 적혀 있는데,
**그 아래 `S.log = needArr(st.log …)` 가 로그 배열을 통째로 갈아 끼운다.**
⇒ 그 알림은 붙은 날부터 지금까지 **한 줄도 안 떴다.**

★ 고쳤다 — 이관은 그 자리에서 돌리고 **알림만 모아 두었다가** `S.log` 가 선 뒤에 적는다.
이제 옛 판을 열면 실제로 이렇게 뜬다:

```
✂ 예전 판의 고스트 기한 1건을 껐습니다 — 2026-08-17 부터 고스트로 시들지 않습니다
🎨 예전 판의 삽수 1개(무늬 잎 1장)에 등급이 없습니다 — 값을 매길 때 **산반**으로 읽습니다
🎨 예전 판의 그루 1개에 잎별 등급 장부가 없습니다 — …
```

⚠ 이 자리를 위로 되돌리면 알림이 다시 조용히 사라진다. 주석으로 못 박아 뒀다.
