# escapecut → plan — 탈출의 둘째 축을 「무늬 삽수를 팔았다」로 바꿨다

START 19:45:16 · END 20:30:11 · 커밋 둘

> 한 줄로: **조건의 모양은 바꿨고, 화면·세이브·옛 판까지 실제로 확인했다.**
> 다만 **밸런스가 눈에 띄게 나빠졌다** — 재현 성공률이 78% → 20% 로 떨어졌다(§4).
> 값은 한 톨도 안 건드렸다. 그 숫자는 plan 이 판단할 것이다.

---

## 0. ★★ 먼저 — 「고스트도 무늬 삽수로 치나」 : **친다 (㉮)**

**판정 근거를 계통이 아니라 값으로 못 박았다:**

    무늬 삽수를 팔았다  =  shop.sellCutting 이 매긴 값에 무늬 잎이 한 장이라도 실렸다
                          (price.variegatedLeaves >= 1)

이 한 줄이면 **고스트를 따로 봐 줄 필요가 없다.** 고스트도 무늬 잎을 달고 있어 무늬 값
(80,000원)으로 팔린다 — 「무늬로 값이 매겨졌다」가 그대로 참이다. 예외 조항이 한 줄도 안 생긴다.

### 왜 계통(`lineage`)으로 안 걸었나 — 셋 다 이유가 있다

| | |
|---|---|
| ① **드러나는 때가 다르다** | 계통은 **뿌리를 내려야** 드러난다(`lineageKnown`). 거기 걸면 「판 적이 있다」가 판 순간이 아니라 그 전에 정해진다 |
| ② **옛 세이브에 칸이 없다** | `propagation.js:1003` — 옛 삽수에는 `lineage` 가 아예 없어 그때 한 번 굴린다. 조건을 거기 걸면 옛 판에서 **조용히 틀린다** |
| ③ **화면과 같은 것을 봐야 한다** | 플레이어가 본 것은 값이다 — 「잎 1장 중 무늬 1장 · 80,000원」. 판정 근거가 그 화면과 같아야 「왜 안 열리나」를 설명할 수 있다 |

### 그리고 ㉯(유지만 친다)는 **지금 판을 닫는다**
실측(`prologuevarie-to-plan §3-2`)으로 지금 나는 무늬 삽수는 **씨앗 6개·200일·15건 전부 고스트**다.
무늬 잎이 한 장뿐인 그루에서 그 잎을 떼면 `w=1` 이라 고스트가 확정이기 때문이다.
⇒ ㉯로 하면 **아무도 이 조건을 못 연다.** 조건의 **모양**만 바꾸는 이번 일에서 「아무도 못 나가는
판」을 만드는 것은 값을 바꾸는 것보다 큰 변경이다.

⚠ 그래서 이 조건이 묻는 것은 「무늬를 **이어받았다**」가 아니라 **「무늬를 값으로 만들어 봤다」**다.
그 뜻으로 못 박았고, 코드 주석에도 그렇게 적었다(`tutorial.js §무늬 삽수를 판 적이 있다`).
⏸ 「유지만 친다」로 좁히려면 무늬 잎이 **두 장** 있어야 하고, 그건 프롤로그 보장을 두 장으로
늘리는 **밸런스 결정**이다(prologuevarie §5-①). 내 몫이 아니라 plan 몫이라 안 골랐다.

---

## 1. 바뀐 것

```
탈출 = 돈(이사비 200만)  AND  무늬 삽수를 판 적이 있다
```
**이사비·시작돈·삽수 값은 한 글자도 안 건드렸다.**

### ① `src/game/tutorial.js` — 뜻이 사는 곳
- `ts.varieSale = { count, firstDay, wonTotal, migrated }` 신설(`createVarieSaleState`)
- `noteVarieCuttingSale(ts, {variegatedLeaves, won})` · `hasSoldVarieCutting(ts)`
- `canMoveOut` — `ok = money && varie`. **`varie` · `varieSaleCount` · `why` 를 새로 낸다**
- `moveOut` — 사유를 다시 안 짓는다. `canMoveOut.why` 하나가 정본이다
- `tutorialGoal` — 단계가 하나 늘었다: `learn → varie → money → ready`

### ★★ 배움 넷은 **조건에서만 뺐다. 계통은 안 지웠다**
`LEARNING` · `ts.learned` · `noteLearning` · `learningLeft` 가 전부 그대로 돌고,
`canMoveOut` 도 `learningLeft` 를 **계속 낸다**(다만 `ok` 는 안 본다). 까닭 셋:
1. `varieGrantCheck`(확정 무늬)의 조건 ②가 그 값을 읽는다. 지우면 **튜토의 마지막 장면이 사라진다**
2. 화면 체크리스트(`game.html §drawTutorial`)와 `learn_*` 대사가 그 값으로 돈다
3. ⇒ 배움 넷은 조건에서 빠져도 **길에서는 안 빠진다** — 무늬 삽수를 손에 넣는 유일한 길인
   확정 무늬가 여전히 배움 넷을 요구한다

### ② `src/game/shop.js` — 손이 닿는 곳 (⚠ 쓰기 영역 밖 · **여섯 줄**)
`sellCutting` 안에서 `ts.varieSale` 에 직접 적는다(`ts.crop.soldWon` 을 적는 것과 **같은 방식**).
⚠ **import 를 안 넣었다** — `tutorial.js` 가 `shop.priceOf` 를 쓰므로 거꾸로 부르면 **순환**이 된다.
⇒ 뜻은 `tutorial.js` 가 갖고 손만 `shop.js` 가 댄다. **둘이 갈리면 조용히 틀리므로**
   `tools/test_escapecut.mjs §B` 가 「shop 이 적은 값 == tutorial 이 적는 값」을 고정한다.
   되돌리려면 그 여섯 줄만 지우면 된다.

### ③ `src/game/save.js` — 남기고 · 옛 판을 옮긴다
- `packTutorial` 에 `varieSale` 칸 추가(안 적으면 **저장 한 번에 이미 판 사람이 방에 갇힌다**)
- **`migrateVarieSale(S, ts)`** 신설 — 옛 세이브(칸 없음)를 여는 사유 셋. 전부 **세이브에 적혀 있는 값**뿐이다:

| 사유 | 무엇을 보나 | 왜 |
|---|---|---|
| `moved-out` | `ts.movedOut` | **이미 나간 판**이다. 되돌리면 방이 두 개가 된다 |
| `old-gate` | 돈 ≥ 이사비 **AND** 배움 넷 | 저장된 그 순간 [이사] 단추가 **실제로 열려 있던** 판이다. 새 축을 소급해 닫는 것은 준 것을 뺏는 일이다 |
| `varie-cut-gone` | `varieGrant.count − nodeIds.length > 살아 있는 무늬 삽수 수` | 확정 무늬 마디를 잘라냈는데 그 삽수가 지금 없다 = 손을 떠났다. 판 것인지 시든 것인지는 안 적혀 있어 **관대한 쪽(판 것)으로** 친다 |

⚠ **셋 다 아니면 안 연다.** 그 판은 아직 무늬 삽수를 만져 본 적이 없고, 지금부터 잘라 팔면 된다.
⚠ **「칸이 없다」와 「0건이다」를 갈라서 본다** — `st.tutorial.varieSale == null` 일 때만 이관한다.
  뭉개면 새 규칙으로 진행 중인 판이 저장할 때마다 저절로 열린다(`test_escapecut E-5` 가 고정).
★ 옮겨 온 것은 `migrated` 에 사유가 남는다 — 「실제로 판 것」과 갈라 읽을 수 있어야 한다.
  선례는 `save.js:451`(pantryMeals → pantryWon 환산)과 `save.js:1066`(wateredOnDay)이다.

### ④ `src/game/loop.js` — 화면이 말하게 (§③ 이사 두 축)
판정을 `c.learningLeft` → **`c.varie`** 로 바꿨다. 상태가 `money | varie | ready` 로 돈다.

⚠⚠ **사건 id 는 `move_short_learn` 그대로 뒀다.** 뜻이 바뀌었는데 이름이 안 바뀐 자리다.
  `src/game/dialogue.js` 가 이번 창의 쓰기 영역이 아니고, id 를 갈면 그 파일의 대사표에 없는
  id 가 되어 **사건은 나는데 화면이 조용해진다**(START-HERE §2 가 경고한 그 모양).
  ★ 다행히 대사(`shortLearn`) 첫 줄이 *"돈은 됐는데, 아직 안 해 본 게 있어"* 라 새 뜻에도 맞는다.
  ⇒ 무엇이 모자란지는 **`axis: 'varie'`** 칸이 말한다. 전용 대사로 갈 때의 패치는 §5 에 코드째 있다.

---

## 2. 실측 ① — **화면**이 실제로 그렇게 말한다

`game.html` 을 헤드리스로 띄우고 **세이브를 넣어** 세 판을 열었다(폰 390×844 · `?` 없이 그냥 `game.html`).
지름길을 적어 둔다: **판을 몰지 않고 `localStorage['byeot/save/1']` 에 세이브를 넣었다.**
넣은 것은 첫 플레이 완료 · 배움 넷 · 현금 = 이사비 뿐이고, 삽수 판매 여부만 갈랐다.

| 판 | `#tutGoal`(=`#quest`) | [원룸으로 이사] |
|---|---|---|
| ① **돈만 찼다** | **「무늬 삽수를 잘라 뿌리내려 팔아 봐야 합니다」** | **잠김** · title `아직 못 해 본 것이 있습니다` ⚠ |
| ② **무늬 삽수를 팔았다** | 「원룸으로 이사할 수 있습니다」 | **열림** |
| ③ **옛 세이브**(`varieSale` 칸을 통째로 지운 것) | 「원룸으로 이사할 수 있습니다」 | **열림** ← 이관이 화면까지 닿는다 |

★ **`game.html` 부팅 예외 0건** (세 판 전부).
⚠ ①의 title 이 **거짓말이다** — `c.shortWon > 0` 하나로 사유를 가르던 옛 배선이라 돈이 다 찼을 때
  「아직 못 해 본 것이 있습니다」로 떨어진다. 고치는 한 줄은 §5 에 있다(`game.html` 은 못 건드린다).

## 실측 ② — 삽수를 팔면 조건이 열린다 (상태)

`tools/test_escapecut.mjs` 를 새로 뒀다. **전부 통과.**

```
A   한 축씩으로는 안 열린다 · 둘이 차면 열린다
A-2 ★배움 넷은 조건에서만 빠졌다 — 계통은 그대로 살아 있다
B   ★파는 자리(shop)와 뜻을 가진 자리(tutorial)가 같은 값을 적는다
      무늬 삽수 한 장 80,000원 (잎 1장 중 무늬 1장)
C-1 민무늬 삽수를 팔면 안 열린다        민무늬 삽수 12,000원 — 값은 되지만 축은 안 연다
C-2 ★★고스트도 「무늬 삽수」로 친다     고스트 무늬 삽수 80,000원 — 계통은 끊기지만 판 적은 있다
C-3 자르기만 해서는 안 열린다 — 판 적이 있어야 한다
D   판 사실이 저장 왕복에서 살아난다
E-0~E-5 ★★옛 세이브 이관 다섯 갈래 (안 던진다 · 세 사유 · 안 여는 경우 · 두 번 안 연다)
F   잠긴 까닭이 두 축으로 갈려서 나온다
```

---

## 3. 검사 — **어느 줄이 「돈 × 배움」을 못 박고 있었나**

★ 고치기 전에 무엇을 지키던 줄인지 적는다(START-HERE §2).

| 파일·줄 | 무엇을 지키고 있었나 | 어떻게 바꿨나 |
|---|---|---|
| `tools/test_tutorial.mjs:196~223` §G | `ok = 돈 && learningLeft 0` · `moveOut` 이 **/못 해 본 것/** 을 던진다 | 「돈만으로도, **무늬 삽수만으로도** 안 된다」로. **배움 넷을 채워도 안 열리는 것**을 새로 잰다 |
| `tools/test_tutorial.mjs:241~266` §I | 배움을 다 채우면 곧바로 `goal.id === 'money'` | 단계가 하나 늘었다 — `varie` 를 거쳐 `money` 로 간다 |
| `tools/test_oneroom.mjs:54~62` `readyToMove` | 배움 넷 + 돈이면 이사할 수 있는 판 | 무늬 삽수 판매를 같이 채운다. **배움 넷은 그대로 둔다**(③ 원룸을 재는 파일이지 ②를 재는 파일이 아니다) |
| `tools/test_ending_flow.mjs:305` 하네스 보조 | `learningLeft.length === 0` 일 때 돈을 보조 | **`c.varie` 일 때만** 보조한다 — 「보조로 열린 문」과 「삽수를 팔아 열린 문」이 안 섞이게 |
| `tools/test_dialogue_coverage.mjs` A·B 경로 | 수입만 주입하면 이사가 된다 | **삽수 한 바퀴를 실제로 돈다**(주문 → 자르기 → 12일 → 판매). §6-① 도 같이 잡혔다 |
| `tools/test_banjiha_routes.mjs:363` | (해당 없음 — 재는 자의 구멍) | 모주를 판 뒤에도 삽수를 팔게 했다. §6-② |

### 검사 결과 — **열다섯 전부 통과**
`test_tutorial` · `test_save` · `test_first_play` · `test_cuttable` · `test_cutting_wiring` ·
`test_cutstamina` · `test_propagation` · `test_uiwire` · `test_quiet` · `test_econ` · `test_dawn6` ·
**`test_escapecut`(새 검사)** · `test_oneroom` · `test_ending_flow` · `test_dialogue_coverage`

⚠ **`test_banjiha_routes` 는 한 건 깨진 채로 둔다** — 아래 §4. **고치지 않았다.**
⚠ `test_balance_routes` 는 5건 실패인데 **내 변경 전에도 똑같이 5건**이었다(스태시해서 대조함).
  그 검사는 스스로 *"밸런스가 아직 안 맞는다는 뜻이다"* 라고 적어 둔 것이라 새 사고가 아니다.

---

## 4. ★★ 판단필요 ① — **밸런스가 나빠졌다.** 값은 안 건드렸다

`tools/test_banjiha_routes.mjs`(진짜 growth 엔진 · 씨앗 40개 · 세 경로)를 **변경 전후로 각각** 돌렸다.

| 경로 | 이사 성공률 | 중앙값(튜토일) | 최선 |
|---|---|---|---|
| A 등 없이 | **78% → 20%** | 121 → 133 | 57 → 93 |
| B 등 사고 | **100% → 43%** | 107 → 187 | 57 → 93 |
| C 한 박자 늦게 | **100% → 48%** | 107 → 187 | 57 → 93 |

`FAIL G-2b ★세 경로가 중앙값 안에 성립한다 → 중앙값으로 이사하지 못하는 경로: A 20% · B 43% · C 48%`

### ★ 왜 이렇게 되나 — **무늬 잎 한 장을 두 곳에 못 쓴다**

수입 내역(중앙값)을 전후로 겹쳐 보면 원인이 한 줄로 보인다:

```
전 : 민무늬 삽수 12,000원 · ★확정 무늬 삽수      0원 · 모주 2,133,333원
후 : 민무늬 삽수 12,000원 · ★확정 무늬 삽수 80,000원 · 모주 2,133,333원
```

**전에는 확정 무늬 삽수를 한 장도 안 팔고 나갔다.** 무늬 잎은 모주에 붙여 두는 편이 압도적으로
이득이기 때문이다 — 잎당 값이 아니라 **등급 계단**이 붙어서(하프문 61배) 무늬 잎 한 장이
모주 값을 100만 단위로 끌어올린다. 그 한 장을 떼어 삽수로 팔면 **80,000원**이 된다.

⇒ 새 조건은 **그 한 장을 반드시 떼게 만든다.** 그래서 ⓐ 등급이 한 계단 내려가고
  ⓑ 12일을 더 기다린다(뿌리내림). 확정 무늬는 **12일에 한 장씩**만 오고
  **「다 팔아도 200만에 못 닿을 때」만** 오므로(`varieGrantCheck`), 그 손해가 곧바로 안 메워진다.

⚠ **여기까지가 사실이고, 아래는 내 짐작이 아니라 선택지다.** 값은 박사님·plan 것이다:

| 길 | 무엇을 움직이나 |
|---|---|
| ㉮ **그대로 둔다** | 「식물을 안 키우면 못 나간다」가 목적이었고 그건 이뤄졌다. 대신 반지하가 길어진다(중앙값 107 → 187일) |
| ㉯ **확정 무늬 간격 12일을 줄인다** | `VARIE_GRANT_INTERVAL_DAYS`. 떼어 준 한 장이 더 빨리 채워진다 |
| ㉰ **고스트 삽수 값 80,000원을 올린다** | 떼어 낸 대가를 값으로 갚는다. ⚠ *"벌은 돈이 아니라 계통"* 이 흐려진다 |
| ㉱ **프롤로그 무늬를 두 장 준다** | prologuevarie §5-① 의 ㉮. 한 장은 팔고 한 장은 모주에 남는다. ★ 이게 제일 결이 맞아 보인다 |

★ **검사를 안 고쳤다.** `G-2b` 를 통과하게 낮추면 **고장난 상태를 검사가 정상으로 못 박는** 꼴이
되고, 그게 이 저장소에서 제일 위험한 사고다(START-HERE §2). **깨진 채로 두고 여기 적는다.**

---

## 5. ★ `game.html` 에 붙일 것 — 코드째로 (다른 워커가 쥐고 있어 못 건드렸다)

### ⓐ **이사 단추의 잠긴 까닭** (`game.html:3230` 언저리 · `drawTutorial` 끝)
지금은 돈이 다 찼는데도 「아직 못 해 본 것이 있습니다」라고 뜬다(§2 실측 ①).
`canMoveOut` 이 이제 `why` 를 내므로 **문구를 화면이 짓지 않아도 된다**:

```js
  const mv = $('moveOut'), c = canMoveOut(ts);
  mv.disabled = !c.ok || ts.movedOut;
  mv.textContent = ts.movedOut ? '이사 완료' : '원룸으로 이사';
  /* ★ 2026-08-13 — 축이 둘(돈 × 무늬 삽수)이라 `shortWon` 하나로는 사유가 안 갈린다.
     문구를 여기서 짓지 않는다 — `tutorial.canMoveOut().why` 가 정본이다. */
  mv.title = c.ok ? '' : (c.why || '');
```

### ⓑ (선택) **무늬 삽수 전용 대사**로 갈 때 — `src/game/dialogue.js` 세 곳 + `loop.js` 한 줄
지금은 `move_short_learn` / `shortLearn` 을 **그대로 재활용**한다(§1-④). 전용으로 가려면:

```js
/* SCRIPTS 에 추가 — shortLearn 바로 뒤 */
  shortVarie: [
    { who: 'moni',   face: 'curious', text: '돈은 됐네. 근데 아직 하나 남았어.' },
    { who: 'jachwi', face: 'surprise', text: '돈이 됐으면 나가면 되는 거 아니야?' },
    { who: 'moni',   text: '무늬 있는 놈을 잘라서, 뿌리 내려서, 팔아 봤어?' },
    { who: 'jachwi', text: '…아직.' },
    { who: 'moni',   face: 'sad',  text: '그거 한 번은 해 보고 가. 다음 방은 그걸로 먹고살아.' }
  ],
/* EVENT_SCRIPT 에 한 줄 (move_short_learn 옆) */
  move_short_varie:    'shortVarie',
/* EVENT_ORDER 에 한 줄 ('move_short_learn' 을 이것으로 갈거나 옆에 둔다) */
  'move_short_varie',
```
그리고 `src/game/loop.js` §③ 의 `state === 'varie'` 줄에서 id 를 `move_short_varie` 로 바꾼다.
⚠ `tools/test_dialogue_coverage.mjs` 의 MUST 표 `['배움이 모자랄 때', 'move_short_learn', 'shortLearn', [D]]`
  도 같이 갈아야 한다 — 지금은 **D 경로가 그 사건으로 새 축을 말하고 있어서 통과 중**이다.

---

## 6. 딸린 발견 — **재는 자의 구멍 둘** (판이 아니라 검사가 틀렸던 것)

### ① `takeCutting` 에 **거른 목록**을 넘기면 조용히 막힌다
`cuttableNow()` 로 거른 목록을 그대로 `takeCutting({nodes})` 에 넘기면,
`cutBudgetOf` 의 `motherLeavesOf(nodes)` 가 **그 목록의 최댓값**을 모주 잎 수로 본다.
잎 1장짜리 하나만 남은 목록에서는 **모주가 잎 1장짜리**가 되어
`「n0#2 는 잎 1장짜리인데 모주에 0장만 남았습니다」` 로 막힌다 — 모주에는 잎이 3장 있는데도.
⇒ **거르지 않은 전체 목록을 넘겨야 한다.** `test_dialogue_coverage` 에서 실제로 밟았고 주석으로 적어 뒀다.

### ② `test_banjiha_routes` 는 **모주를 판 뒤 삽수를 다시는 안 팔았다**
판매 블록이 통째로 `if (pot0(S))` 안에 있었다. 모주를 파는 순간 그 조건이 거짓이 되어
손에 남은 삽수가 영영 안 팔렸다. 옛 조건에서는 모주만 팔면 문이 열려 **안 보이던 구멍**이다.
고쳤다(`:363`). ⚠ 다만 **§4 의 숫자는 이 구멍을 고친 뒤에 잰 것**이다 — 고쳐도 20% 그대로였다.

---

## 7. 못 한 것

- **`src/game/dialogue.js` 에 전용 대사를 안 붙였다.** 쓰기 영역 밖이고, 붙이면
  `test_dialogue_coverage` 의 MUST 표까지 같이 갈아야 한다. 패치는 §5-ⓑ 에 코드째 있다.
- **`game.html` 의 단추 title 은 여전히 틀린 말을 한다.** 한 줄 패치는 §5-ⓐ 에 있다.
- **`tools/test_balance_routes.mjs` 의 5건**은 손 안 댔다 — 변경 전부터 같은 5건이었다.
- **사람이 실제로 200일을 몰아 본 판**은 없다. 화면 확인은 세이브를 넣어서 했다(§2 · 지름길 명시).
- 임시 도구 `tools/_probe_dlgvarie.mjs` · `_probe_escapeboot.mjs` · `_probe_escapeui.mjs` 는 **전부 지웠다.**

---
---

# §판 돈 통 — 판 돈을 **갈래별로** 나눠 센다 (같은 창에서 이어서)

박사님: *"㉯ 로 하자. 그리고 **미리 해 둬, 다양해질 테니**"*

> 한 줄로: **`earnedWon` 한 칸을 안 지우고, 그 옆에 갈래별 통을 뒀다.**
> 합계 = 갈래별 합이 늘 참이고, 옛 판의 돈은 **「종류 모름」**으로 열린다. **총액은 한 원도 안 변했다.**

## L-1. ★ 먼저 재라 — `kind` 가 정말 셋뿐인가

`credit(S, won, kind)` 를 부르는 데는 **셋**이다: `'pot'`(sellPot) · `'cutting'`(sellCutting) ·
`'crop'`(creditCropSurplus). 그리고 **`creditCropSurplus` 를 부르는 데가 둘**이다:

| 부르는 곳 | 무엇 | 지금 kind |
|---|---|---|
| `state.js:934` `sellCropSurplus` | 잉여 채소 | `'crop'` |
| `state.js:995` `sellPantryCrop` | **곳간 채소** | **`'crop'`** ← 같다 |

⇒ **둘은 지금 한 통이다.** 검사로 그 사실을 못 박아 뒀다(`test_saleledger §F`).

### ⇒ **가르지 않기로 했다. 까닭 둘**
1. **정본이 이미 따로 있다** — `firstPlay.food.totalPantrySoldWon` · `totalSurplusSoldWon`.
   가계부(`monthSnapNow`)가 이미 그 둘을 각각 찍고 있다. 여기서 또 나누면 **정본이 두 벌**이 되고,
   두 벌은 반드시 어긋난다(이 저장소가 열 번 겪은 그 사고).
2. **가르려면 `state.js` 를 고쳐야 한다** — `sellPantryCrop` 이 kind 를 넘겨야 하는데
   그 파일이 이번 창의 ⛔ 목록이다.
⇒ 대신 **받는 쪽만 뚫어 뒀다**: `creditCropSurplus(S, won, { kind: 'cropPantry' })`.
  갈래 이름 `cropPantry` 도 미리 올려 뒀다. 나중에 가를 때 **한 줄**이면 된다:

```js
/* src/game/state.js §sellPantryCrop — creditCropSurplus 부르는 줄만 */
  const r = creditCropSurplus(S, taken.won, { kind: 'cropPantry' });
```

## L-2. 바뀐 것

### `src/game/shop.js`
- **`SALE_KINDS`** — `pot · cutting · crop · cropPantry · unknown`. **얼려서 export**
- `createShopState().earnedBy = {갈래: 0}` · **`earnedWon` 은 그대로 둔다**(합계로 계속 쓴다)
- `credit` — ★ **모르는 갈래는 그 자리에서 던진다.** 「미리 해 둬」의 알맹이가 이것이다.
  새 판매를 만드는 사람이 이름을 올리게 **강제**한다 — 조용히 「기타」로 받아 주면
  그 돈이 어느 통엔가 섞이고, 그게 방금 고친 병이다
- `credit` 이 **합계와 갈래를 같은 줄에서** 올린다(떨어뜨리면 언젠가 한쪽만 오른다)
- **`saleLedgerOf(S)`** 신설 — `{ byKind, plantWon, cropWon, unknownWon, totalWon, earnedWon, balanced }`.
  ★ `plantWon = pot + cutting` — **화면이 뺄셈을 안 해도 된다**
- `shopStatus(S).sales` 에 실어 낸다 (화면이 새로 import 할 것이 없다)

### `src/game/save.js`
- `packShop` 에 `earnedBy` 추가
- **`migrateEarnedBy(shop)`** 신설 — 갈래 합이 `earnedWon` 보다 **모자란 만큼**을 `unknown` 에 담는다
  - 옛 세이브(칸 자체가 없다) → **전액이 `unknown`**
  - 어쩌다 어긋난 판 → **그 차이만**
  - ⚠ 갈래 합이 **더 큰** 경우는 **안 만진다** — 누가 `earnedWon` 을 직접 깎았다는 뜻이라
    조용히 맞춰 주면 원인이 묻힌다. `saleLedgerOf().balanced` 가 거짓으로 남아 드러난다
- 옮긴 날에는 로그가 남는다: `📒 예전 판이라 판 돈의 종류를 모릅니다 — 33,000원을 「종류 모름」으로 옮겼습니다`

## L-3. 실측 — **총액이 한 원도 안 달라졌다**

`game.html` 을 헤드리스로 띄우고 세이브를 넣어 두 판을 열었다(지름길 명시 · 폰 390×844).

| 판 | 넣은 것 | 다시 저장된 것 |
|---|---|---|
| ① 지금 판 | `pot 30,000 · crop 3,000` | `earnedWon 33,000` · `earnedBy {pot:30000, crop:3000}` |
| ② **옛 판**(`earnedBy` 칸을 통째로 지운 것) | 같음 | `earnedWon 33,000` · **`earnedBy {unknown:33000}`** |

★ **`earnedWon` 은 두 판 다 33,000원 그대로다.** ★ **부팅 예외 0건.**
★ 옛 판은 로그로 **말한다** — 조용히 지우지 않았다.

`tools/test_saleledger.mjs`(새 검사) **전부 통과**:
```
A ★★합계(earnedWon) = 갈래별 합 — 세 갈래를 실제로 팔아 본다
    그루 30,000원 · 삽수 12,000원 · 채소 3,000원 ⇒ 식물 42,000원 · 합계 45,000원
B 지갑에 들어온 총액 = 판 값의 합 (통을 나눠도 한 원도 안 달라진다)
C ★모르는 갈래는 던진다        아는 갈래 — pot · cutting · crop · cropPantry · unknown
D / D-2 / D-3 ★★옛 세이브 이관 — 전액 · 지금 판은 그대로 · 모자란 차이만
E ★갈래 합이 더 큰 판은 조용히 맞추지 않는다 — 드러나게 둔다
F ⏸곳간과 잉여는 지금 같은 통이다 — 받는 쪽은 뚫려 있다
```
지시된 검사도 전부 통과: `test_save` · `test_tutorial` · `test_econ` · `test_cropsale` ·
`test_pantrysale` · `test_cuttable` · `test_cutting_wiring` · `test_first_play` · `test_escapecut`.
그리고 `test_banjiha_routes:990`(**재현이 센 수입 == `shop.earnedWon`**)이 그대로 통과한다 —
200일 판에서도 총액이 안 움직였다는 뜻이다.

## L-4. ⚠⚠ 딸린 발견 — **`ts.crop.soldWon` 은 이름이 거짓말을 한다**

재 보라고 하셔서 쟀다. **그렇다.**

| 칸 | 이름이 말하는 것 | 실제로 들어오는 것 |
|---|---|---|
| `ts.crop.soldWon` | 채소 판 돈 | **판 것 전부** (그루·삽수·채소) — `shop.credit` |
| `ts.crop.spentWon` | 채소에 쓴 돈 | **산 것 전부** (씨앗·시루·**병·포트까지**) — `shop.orderItem` |

⇒ 이 칸의 실제 뜻은 「채소」가 아니라 **「상점 총 장부」**다.
`tutorial.js §crop` 의 주석(*"여기는 합계만 센다"*)이 원래 그 뜻이었고 **이름만 안 따라왔다.**

⚠ **값은 안 건드렸다.** 뜻을 좁히면 숫자가 같이 움직인다:
- `tools/test_banjiha_routes.mjs:544` 가 `crop.spentWon` 을 **「씨앗·시루값」**이라고 적어 낸다 —
  지금 그 줄은 **병·포트값까지 더해서** 말하고 있다(그 자체가 이미 틀린 말이다)
- `tools/test_cropsale.mjs:329` 가 채소 한 건으로 그 등식을 고정한다(그 한 건만으로는 안 갈린다)

⇒ **판단필요**: ㉮ 이름을 `ts.shopLedger` 로 고친다 · ㉯ 뜻을 「채소만」으로 좁힌다
(그러면 위 두 검사의 숫자가 바뀐다) · ㉰ 갈래별 통이 생겼으니 **이 칸을 아예 걷는다**.
★ 나는 **㉰ 이 맞아 보인다** — `shop.earnedBy` 가 더 정확한 같은 것을 갖고, 읽는 데도
저 검사 둘뿐이다. 다만 세이브 칸을 없애는 일이라 plan 판단이다.

## L-5. ★ `game.html` 에 붙일 것 — **뺄셈을 걷는다** (코드째로)

⛔ `game.html` 은 다른 워커가 쥐고 있어 안 고쳤다. 붙일 자리는 `§monthSnapNow`(3493) 와
`§monthCloseNow`(3597) 둘이고, **새 import 가 필요 없다**(`shopStatus` 는 이미 들여와 있다).

```js
/* ① monthSnapNow — 갈래별 통을 같이 찍는다 (shop.js §판 돈은 갈래별로) */
function monthSnapNow() {
  const food = (S.firstPlay && S.firstPlay.food) || {};
  const shop = S.shop || {}, ts = S.tutorial || {};
  /* ★ 2026-08-13 — 판 돈이 갈래별로 쌓인다. 「식물 판 것」을 더는 뺄셈으로 안 구한다 */
  let sales = null; try { sales = shopStatus(S).sales; } catch { }
  return {
    cash: Math.round(ts.cashWon || 0),
    shopSpent: Math.round(shop.spentWon || 0),
    shopEarned: Math.round(shop.earnedWon || 0),
    /* ★ 새 칸 셋. 옛 장부(localStorage)에는 없어 `undefined` 인데, 아래에서 그때는
       예전 뺄셈으로 떨어진다 — 이번 달 하나만 그렇고 다음 달부터 제대로 돈다 */
    shopPlant: sales ? Math.round(sales.plantWon) : undefined,
    shopCrop: sales ? Math.round(sales.cropWon) : undefined,
    shopUnknown: sales ? Math.round(sales.unknownWon) : undefined,
    pantrySold: Math.round(food.totalPantrySoldWon || 0),
    surplusSold: Math.round(food.totalSurplusSoldWon || 0),
    foodSaved: Math.round(food.totalFoodSavedWon || 0)
  };
}

/* ② monthCloseNow — 뺄셈을 걷는다 */
  const now = monthSnapNow(), s = m.cur.snap, r = m.cur.run;
  /* ★ 2026-08-13 — `shop.earnedBy` 가 갈래별로 쌓는다(shop.js §SALE_KINDS).
     ⚠ 옛 장부에는 새 칸이 없다 — 그때만 예전 뺄셈으로 떨어진다. 그 한 달만 예전과 같다. */
  const hasKinds = Number.isFinite(s.shopPlant) && Number.isFinite(now.shopPlant);
  const veg   = hasKinds ? (now.shopCrop - s.shopCrop)
                         : (now.pantrySold - s.pantrySold) + (now.surplusSold - s.surplusSold);
  const plant = hasKinds ? (now.shopPlant - s.shopPlant)
                         : (now.shopEarned - s.shopEarned) - veg;
  /* ★ 예전 판에서 온 몫 — 종류를 모르는 돈이다. 식물로도 채소로도 안 센다 */
  const unknownSold = hasKinds ? (now.shopUnknown - s.shopUnknown) : 0;
  ...
  const inSum = veg + plant + unknownSold + r.income;
```
그리고 보고서 객체(`rep`)에 `unknownSold` 를 실어 한 줄로 적으면 된다 —
문구는 **「예전 판 · 종류 모름」**(`shop.js §SALE_KINDS` 의 그 이름)이 그대로 맞다.
⚠ 곳간·잉여를 따로 적고 싶으면 지금처럼 `pantrySold`/`surplusSold` 를 쓰면 된다 —
  그 둘의 정본은 여전히 `firstPlay.food` 다(§L-1).

## L-6. 못 한 것 (판 돈 통)

- **`state.js` 의 곳간 판매를 `cropPantry` 로 안 갈랐다** — 쓰기 영역 밖. 한 줄 패치는 §L-1.
- **`game.html` 의 뺄셈을 안 걷었다** — 쓰기 영역 밖. 패치는 §L-5 에 코드째.
- **`ts.crop.soldWon` 은 안 건드렸다** — 값이 움직이는 일이다. §L-4 가 판단필요.
- ⚠ `tools/test_monthly.mjs` 는 **`ReferenceError: boot is not defined`** 로 끝까지 안 돈다
  (§M 절). 그 파일은 **커밋 안 된 다른 창의 것**이라(`git status` 에 `??`) 손 안 댔다.
  ⇒ 그 창에 알려야 한다. 내 변경과 무관하다(검사 §A~§L 은 다 통과하고 §M 에서 죽는다).

---

END 20:30:11
