# cutting2 → plan — 삽수 계통을 박사님 새 규칙으로 갈아 끼웠다 (2026-08-17)

START 21:21:17

> **박사님이 제일 먼저 보실 것부터 적는다.**
>
> ## ★★★ 이사 성공률은 **하나도 안 돌아왔다. 0%p 다.**
>
> | 경로 | 어제(78%였던 것이 떨어진 뒤) | **오늘 바꾼 뒤** |
> |---|---|---|
> | A 등 없이 | 20% | **20%** |
> | B 등 사고 | 43% | **43%** |
> | C 한 박자 늦게 | 48% | **48%** |
>
> `tools/test_banjiha_routes.mjs` 를 **바꾸기 전·후로 각각 40판 × 3경로** 돌렸다.
> 두 출력이 **한 줄 빼고 글자 하나까지 같다**(그 한 줄도 삽수와 무관한 대조군 중앙값 75 → 77일).
>
> ### ⇒ 까닭은 하나다. **이번에 바꾼 규칙이 그 재현에서는 한 번도 안 쓰인다.**
>
> 재현은 삽수를 **뿌리내리자마자 판다.** 뿌리 12일은 이번에 **안 바뀐 값**이다.
> 바뀐 것(혹 20일 · 빛이 무늬율을 정한다 · 고스트가 안 죽는다)은 전부 **삽수를 들고
> 키울 때** 비로소 값이 붙는데, 재현이 그 전에 팔아 버린다.
> ⚠ 그리고 재현의 §④ 가 **`현금 + 삽수 + 모주 ≥ 이사비` 가 되면 손에 있는 것을 전부 판다** —
> 모주 하나가 이미 2,133,333원이라 **삽수가 자라기 전에 그 문턱이 먼저 걸린다.**
> 「안 팔고 키우는 넷째 경로」를 붙여 재 봤더니 수입 내역이 안 켠 판과 **똑같이** 나왔다
> (확정 무늬 삽수 80,000원). ⇒ **재는 자가 이 길을 못 잰다.** 그 경로는 걷어 냈고,
> 대신 그 자리에 「왜 못 재는지·어디 한 줄을 고쳐야 재지는지」를 적어 두었다
> (`test_banjiha_routes.mjs §⏸ 2026-08-17`).
>
> ### ★ 그래서 새 규칙의 값어치는 **삽수 하나만 따로 굴려서** 쟀다 — 아래 §2-3 이 그 표다.
> **잎 1장짜리 무늬 마디 하나가 밝은 칸에서 60일 만에 이사비를 넘긴다.**
> **옛 규칙에서 그 마디는 `w=1` 이라 100% 고스트였고 32일 뒤 시들어 없어졌다.**

---

# 1. 바뀐 것

## 1-1. `src/game/propagation.js` — 규칙이 사는 곳

| | 무엇 |
|---|---|
| ⛔ | **키메라 세 갈래를 굴리는 곳을 전부 걷었다** — `takeCutting` · `stepCuttings` · `cuttingSnapshot` |
| ⛔ | **고스트 죽음을 걷었다** — `GHOST_DECLINE_DAYS` 시계가 안 돈다. 고스트도 자란다 |
| ★ | `METHODS.water.nodeDays` **32 → 20** · `METHODS.pot.nodeDays` **null → 45** |
| ★ | `METHODS.*.maxLeaves` 신설 · **`WATER_LEAF_MAX = 1`** · `methodLeafBlock(method, leaves)` |
| ★ | **`VARIE_LIGHT` `{dark:.20, mid:.50, bright:.80}`** · `VARIE_LIGHT_BANDS` · `varieLightStepOf` · `varieChanceFromLight` |
| ★ | **`VARIE_RULES.genRise = 0`** · `varieGenRiseOf(S)` — 손잡이(기본 꺼짐) |
| ★ | `resolveVarieLight()` — 뿌리내린 뒤 그 자리 밴드로 소질을 정한다(못 재면 미룬다) |
| ★ | **`cutPlanOf(S, node, container)`** 신설 — `cutRiskOf` 를 대신하는 화면 창구 |
| ★ | `cutBlockedReason(..., { container })` — 용기별 사유를 낸다 |
| ★ | 혹 블록을 **두 갈래 다** 나게 고쳤다(`m.canDie` 문을 열었다). 기한은 죽는 쪽에만 붙는다 |
| ★ | 삽수 칸 둘 신설 — **`varieLightBand`**(null = 미정) · **`varieFromCut`** |
| ★ | `PROPAGATION_SCHEMA` `cutting/1` → **`cutting/2`**. ⚠ **막는 데 안 쓴다**(아무도 안 견준다) |
| ⏸ | `chimeraOddsOf`·`rollLineage`·`varieChanceRise`·`cutRiskOf`·`LINEAGE_KO`·`GHOST_DECLINE_DAYS` **안 지웠다** — 머리마다 「2026-08-17 이 대체했다」를 적었다 |

### ★ 왜 「지우지 말고 대체됐다고 적기」를 골랐나 (박사님이 재서 정하라 하신 것)
① **옛 세이브에 `lineage` 가 적혀 있다.** `save.js` 가 그 칸을 읽고 쓴다 — 안 열리면 실패다
② 전부 **순수 함수**라 안 부르면 아무 일도 안 한다. 지우는 값어치가 「검사 하나 깨짐」뿐이다
③ 되살릴 문을 남기는 것이 이 저장소의 수법이다(`rules.cropOverlapTiredEnabled` 선례)
⇒ 그 대신 **「정말 안 부르나」를 검사로 못 박았다**(`test_propagation §C-2` — 200판 잘라 갈래 0건).

## 1-2. `src/game/save.js`
- `packCutting` 에 **`varieLightBand`·`varieFromCut`** 추가. `varieFromCut` 은 옛 세이브를
  **`source.variegatedLeaves >= 1` 로 되메운다**(바로 위 `leafVarie` 와 같은 수법)
- **`migrateCuttingRules(S)` 신설** — 고스트 시계를 끄고, 고스트의 `varieChance = 1` 을
  천장 0.80 으로 맞춘다. **`lineage` 는 안 지운다**(사실이다). `varieLightBand` 는 **안 채운다**
  (그 판은 빛을 잰 적이 없다 — 잰 척하면 거짓말이다)
- ⚠ 「옛 판이다」의 표시는 **`lineage` 가 적혀 있나**다. 새 삽수는 그 칸이 언제나 null 이라
  지금 판이 걸리는 일이 없다(`§L ⑦·⑧` 이 고정)

## 1-3. `src/game/loop.js` — **주석 한 덩어리만** 늘렸다
배선은 한 글자도 안 고쳤다. `NO_GROW_BANDS` 가 이제 **무늬 확률의 「어두움」과 같은 묶음**이
됐다는 사실만 적었다 — 여기를 고치면 무늬 확률도 같이 움직인다.

## 1-4. 문서
- **`docs/propagation.md` §0 신설** — 새 규칙 전부. 아래 §3·§5 는 **안 지우고** 대체 표시
- **`docs/handoff/plan-2026-08-17-cutting.md`** (확정문 · 새로 씀)

---

# 2. 실측

## 2-1. ★ 이사 성공률 — **전·후 0%p** (맨 위 요약 참고)
`tools/test_banjiha_routes.mjs` · 씨앗 40개 × 3경로 · 240~360일 · 진짜 growth 엔진.

    전 : A 8/40 (20%) · B 17/40 (43%) · C 19/40 (48%)   중앙값 133 / 187 / 187일
    후 : A 8/40 (20%) · B 17/40 (43%) · C 19/40 (48%)   중앙값 133 / 187 / 187일
    수입 내역(중앙값) 전·후 동일 — 민무늬 삽수 12,000원 · 확정 무늬 삽수 80,000원 · 모주 2,133,333원

⚠ `G-2b` 는 **전에도 후에도 똑같이 깨져 있다.** 낮춰서 통과시키지 않았다 —
**고장난 상태를 검사가 정상으로 못 박는 것**이 이 저장소에서 제일 위험한 사고다(START-HERE §2).

## 2-2. ★★ 옛 세이브가 열린다 (`test_propagation §L` · **통과**)
지금 판으로 세이브를 만든 뒤 **손으로 옛 모양으로 되돌려** 열었다 —
`schema: 'cutting/1'` · `lineage: 'ghost'/'chimera'` · `ghostDeadlineDay: 60` · `varieChance: 1` ·
**2026-08-17 에 생긴 칸 둘을 통째로 삭제.**

| 잰 것 | 결과 |
|---|---|
| 안 던지고 열리나 | **열린다** (삽수 2개 그대로) |
| 고스트 시계 | `ghostDeadlineDay` **null** — 껐다 |
| 고스트 무늬율 1 | **0.80**(천장)으로 맞춰졌다 |
| 옛 갈래 기록 | **`lineage: 'ghost'` 그대로 남는다** (사실이라서) |
| 키메라 삽수의 소질 0.42 | **0.42 그대로** — 조용히 안 바뀐다 |
| 빛 판정 | `varieLightBand` **null**(미정) → 다음 하루에 그 자리 빛으로 `mid` |
| **200일 굴리기** | **한 개도 안 죽었다** (옛 규칙이면 60일에 시들 판) |
| 저장 → 다시 열기 | 값이 **안 흔들린다** — 이관은 한 번만 돈다 |

## 2-3. ★★★ 물꽂이/화분 일수 · 그리고 **새 규칙의 값어치**

### 일수 (`test_propagation §D·D-2·E·F·G` · `test_cutting_wiring §A~D`)

| | 뿌리 | 혹 | 기한(자유) | 기한(초보) | 죽나 |
|---|---|---|---|---|---|
| 물꽂이 (잎 **1장만**) | 12일 | **20일** | **28일** | **36일** | 죽는다 |
| 화분 직삽 (여러 장도) | 24일 | **45일** | 없음 | 없음 | 안 죽는다 |

- 경고는 여전히 죽음보다 먼저 나간다: 자유 D+20 · D+24 · D+27 → 사망 D+28 (3회)
  / 초보 5회 → 사망 D+36
- 잎 2장짜리를 병에 꽂으면 **막힌다**(`tutorialInput` — 고장이 아니라 안내 · 재고도 안 빠진다)
- 화분 직삽은 혹이 나도 **기한이 안 선다**(`deadlineDay === null`) · 300일 뒤에도 산다

### ★★ 「키우는 길」이 얼마가 되나 — **잎 1장 무늬 마디 하나 · 씨앗 40개 · 200일**

    옛 규칙(키메라): 이 마디는 w=1 → **고스트 100%** → 뿌리 12일 → 32일 뒤 시들어 사라진다.
                     값은 80,000원 한 번이 전부였다.

| 놓은 자리 | 새 잎 무늬율 | 200일 잎/무늬(중앙) | 200일 값(중앙) | **이사비(200만) 도달** |
|---|---|---|---|---|
| 어두움 (stagnant) | 20% | 1장 / 1장 | 80,000원 | **0/40 · 안 온다** |
| 중간 (slow · 창턱) | 50% | 10장 / 5장 | 3,605,556원 | **38/40 · 중앙 100일** |
| 밝음 (best·good·over · 등 밑) | 80% | 10장 / 8장 | 5,708,889원 | **40/40 · 중앙 60일** |

★★ **세 층이 실제로 갈린다.** 그리고 **자리 다툼이 생겼다** — 밝은 칸을 삽수에 내주면
무순이 못 쓴다.
⚠⚠ **어두움 20% 는 「뿌리내릴 때 어두웠다」의 벌이지 자리가 아니다.** 어두운 밴드는
잎이 아예 안 자라므로(`NO_GROW_BANDS`) 거기 계속 두면 잎이 0장이다. 어두운 데서 뿌리를 내린
뒤 밝은 데로 옮기면 **20% 로 못 박힌 채** 자란다 — 그게 그 층의 뜻이다.

---

# 3. 검사 — 어느 줄이 무엇을 지키던 것인지

★ 고치기 전에 적는다(START-HERE §2 · 넷째 규칙대로 **고친 값도 다시 쟀다**).

| 파일:줄(옛) | 무엇을 지키고 있었나 | 어떻게 바꿨나 |
|---|---|---|
| `test_propagation:196~198` | 자른 삽수에 갈래가 있고 뿌리내려야 드러난다 | **갈래가 `null` 이다**로. `varieFromCut`·`varieLightPending` 을 새로 잰다 |
| `test_propagation:205~206` | 민무늬 마디 → `revert` · `varieChance 0` | **모주 값 그대로**(0.195)로. 그리고 **빛을 밝게 줘도 안 오른다**를 새로 잰다(⑤) |
| `test_propagation §C 전체(222~271)` | `chimeraOddsOf` 합=1 · `rollLineage` 800판 분포 25/50/25 | **§C 를 「빛이 정한다」로 통째로 다시 썼다.** 옛 것은 **§C-2 로 옮겨 「대체됐다」를 잰다** |
| `test_propagation:303~305,311,320,321,329` | 혹 32 · 기한 40 · 35일째 `node` | **혹 20 · 기한 28.** 숫자를 안 박고 `METHODS` 에서 읽는다 |
| `test_propagation:364` | 첫 경고가 32일 | `METHODS.water.nodeDays` 에서 읽는다 |
| `test_propagation:382,390` | 초보 기한 48 | **36**. `nodeDays + graceDaysNovice` 로 계산해 읽는다 |
| `test_propagation:483` | 복원 뒤 40일에 죽는다 | **28일**. 그리고 **새 칸 둘(`varieLightBand`·`varieFromCut`)이 왕복에 실리나**를 새로 잰다 |
| `test_propagation` **잎 2·3장 마디를 `jar` 로 자르던 14곳** | (규칙이 없어서 그냥 됐다) | 잎 1장 마디(`ax1#0`)나 `soil` 로. **§D-2 를 새로 두어 「잎 1장이라야 물꽂이」를 잰다** |
| `test_cutting_wiring:7,94,101,103,116,118,129` | 32일 혹 · 기한 49(초보) | 전부 `METHODS` 에서 읽게 |
| `test_banjiha_routes:326` | `container: 'jar'` **무조건** | **잎 수가 용기를 정한다**(1장 → jar · 여러 장 → soil). ⚠ 안 고치면 잎 2장짜리 무늬 마디가 **조용히 안 잘려**(try/catch 가 삼킨다) 재는 것 자체가 거짓말이 된다 |
| `test_escapecut:139~151 §C-2` | `lineage:'ghost'` 를 주입해 「고스트도 무늬 삽수로 친다」를 잰다 | **안 고쳤다 — 그대로 통과한다.** 판정 근거가 값(`variegatedLeaves >= 1`)이라 계통과 무관하다(§4 참고) |

## 새로 둔 검사
- `test_propagation §C` — **빛이 소질을 정한다**(표·밴드 묶음·판 굴리기·안 바뀐다·못 재면 미룬다·손잡이)
- `test_propagation §C-2` — **⏸ 키메라는 대체됐다**(200판 갈래 0건 · w=1 이 200일 산다)
- `test_propagation §D-2` — **잎 1장이라야 물꽂이**(막힘·안내로 던짐·재고 안 빠짐·사유 한 곳·`cutPlanOf`)
- `test_propagation §L` — **옛 세이브(`cutting/1`)가 열린다** (§2-2)
- `test_banjiha_routes` — 「키우는 길을 못 잰다」는 사실을 ⏸ 로 적어 뒀다

## 검사 결과
**통과**: `test_propagation` · `test_cuttable` · `test_cutting_wiring` · `test_cutstamina` ·
`test_save` · `test_escapecut` · `test_first_play` · `test_econ` · `test_tutorial` · `test_quiet` ·
`test_oneroom` · `test_dialogue_coverage` · `test_ending_flow` · `test_saleledger` · `test_cropsale`

**`game.html` 부팅 예외 0건** (폰 390×844 · 14초 · `Runtime.exceptionThrown` 0 · `console.error` 0).

⚠ `test_banjiha_routes` 는 **`G-2b` 한 건이 전·후 똑같이 깨져 있다**(§2-1).
⚠ `tools/probe_cutting_ui.mjs` 는 **삽수에 닿기 전에** 끝난다 — *"몬스테라가 도착했다
`{day:38, pots:0}`"*. 콩나물 회전을 못 몰아서 모주가 안 온다(`prologuevarie-to-plan §5-④`
가 적어 둔 그 손짓 문제). 내 변경이 도는 자리까지 가 보지도 못했다.

---

# 4. 탈출 조건 — **안 바뀐다** (재서 확인했다)

`tutorial.js §varieSale` 의 판정은 **`price.variegatedLeaves >= 1`** 이다 — **값 기준**이라
계통(`lineage`)을 안 본다. 세 갈래를 걷어도 그 줄은 한 글자도 안 움직인다.
⇒ `tools/test_escapecut.mjs` **전부 통과**했다. §C-2(*"고스트도 무늬 삽수로 친다"*)도
하네스가 `lineage:'ghost'` 를 **손으로 주입**하는 방식이라 그대로 돈다.

★ 다만 **뜻이 달라졌다.** 그 절의 근거였던 *"지금 나는 무늬 삽수는 전부 고스트다"*
(`escapecut §0`)가 이제 **사실이 아니다.** 고스트가 아예 안 난다.
⇒ 그 절은 이제 「옛 세이브의 고스트도 무늬 삽수로 친다」를 재는 절이다. **문구를 안 고쳤다** —
`test_escapecut.mjs` 가 이번 창의 쓰기 영역 밖이다.

---

# 5. ★ 화면(`game.html`)에 붙일 것 — 코드째로

⛔ `game.html` 은 쓰기 영역 밖이라 안 고쳤다. 셋 다 **새 import 가 필요 없다**
(`cutBlockedReason`·`METHODS` 는 이미 들여와 있다. ③만 `cutPlanOf` 를 하나 더 들여온다).

## ⓐ ★★ **「병에」 단추가 잎 2장짜리 마디에서 안 회색이다** (`game.html:3931` · `drawCuttings`)
지금은 `why` 를 **용기와 무관하게** 한 번만 구해서 두 단추에 같이 쓴다. 그래서 잎 2장짜리
마디에서도 「병에」가 눌리고, 누르면 던진다.
⚠ 판이 잠기지는 않는다(`tutorialInput` 을 붙였다 — 배너로 사유가 뜬다). 그래도
**「목록에 떠 있는데 누르면 던지는 마디」**는 이 저장소가 한 번 잡았던 그 병이다.

```js
      let why = null;
      try { why = cutBlockedReason(S, nodes, n.nodeId, { potId: p.id }); } catch { }
      const btn = (cid) => {
        const item = containerItemOf(cid);
        const have = item ? (st.stock[item] || 0) : 0;
        const ko = cid === 'jar' ? '병에' : '흙에';
        /* ★ 2026-08-17 — 사유가 **용기마다 다르다**(물꽂이는 잎 1장뿐 · propagation §WATER_LEAF_MAX).
           한 번만 물어 두 단추에 같이 쓰면 「병에」가 안 회색이 되고, 누르면 던진다. */
        let w2 = why;
        if (!w2) { try { w2 = cutBlockedReason(S, nodes, n.nodeId, { potId: p.id, container: cid }); } catch { } }
        const off = w2 || !have;
        const tip = w2 ? w2 : (have ? '' : CONTAINERS[cid].ko + '을(를) 먼저 주문하세요');
        return '<button class="ghost" data-cut="' + n.nodeId + '" data-cont="' + cid + '"' +
               (off ? ' disabled title="' + tip.replace(/"/g, '') + '"' : '') +
               '>' + ko + '</button>';
      };
```

## ⓑ 자르기 배너 · 한 줄 안내가 **화분 혹 45일**을 말 못 한다 (`game.html:3857` · `:3989`)

```js
/* ① 자른 직후 배너 (3857 언저리) — 화분에도 혹이 난다(기한만 없다) */
  banner('✂ 삽수를 잘랐습니다',
         CONTAINERS[c.container].ko + ' · ' + m.rootDays + '일 뒤에 뿌리가 납니다' +
         (m.canDie ? ' · ' + m.nodeDays + '일 뒤 혹이 나면 분갈이해야 삽니다'
                   : ' · ' + m.nodeDays + '일 뒤 혹이 납니다 · 기한도 죽음도 없습니다'));

/* ② 한 줄 안내 (3989 언저리) — 흙 쪽에도 혹 일수를 적는다 */
    : ('물꽂이(병)는 잎 ' + WATER_LEAF_MAX + '장짜리만 되고, ' +
       METHODS.water.rootDays + '일에 뿌리 · ' + METHODS.water.nodeDays + '일에 혹이 납니다 — ' +
       '그때 분갈이를 해야 삽니다. ' +
       '흙에 바로 심으면 ' + METHODS.pot.rootDays + '일에 자리를 잡고 ' +
       METHODS.pot.nodeDays + '일에 혹이 납니다 — 느리지만 죽지 않습니다.');
```
⇒ `WATER_LEAF_MAX` 를 import 목록(`game.html:2179`)에 한 낱말 더한다.

## ⓒ ★★ **자리별 무늬율을 아직 아무 데도 안 보여 준다**
지금 화면은 「이 마디를 자르면 새 잎 무늬율이 자리에 따라 20~80% 로 갈린다」를 **말하지 않는다.**
말 안 하면 자리 고르기가 도박이 된다. `cutPlanOf` 가 그 문구를 **상수에서 지어 낸다**(§2.8):

```js
/* import 에 cutPlanOf 를 더한다 */
/* 자를 마디 줄(3941 언저리)의 <small> 에 */
        let plan = null;
        try { plan = cutPlanOf(S, n, 'jar'); } catch { }
        ...
        '<small>' + n.nodeId + ' · ' + n.stem + ' · ' +
        (why ? why : (plan && plan.variegated ? plan.ko : '뿌리내면 팔 수 있습니다')) + '</small>'
```
⇒ 무늬 마디에서 이렇게 뜬다:
`12일 뒤 뿌리 · 20일 뒤 혹 — 그때부터 8일 안에 분갈이해야 삽니다 · 무늬 마디입니다 —`
`새 잎 무늬율은 **놓는 자리**가 정합니다(어두움 20% · 중간 50% · 밝음 80%)`

★ 그리고 **가진 삽수 줄**에 `v.varieLightPending` / `v.varieLightKo` 를 쓰면
「아직 안 정해졌습니다 — 밝은 데 두세요」 / 「밝음에서 뿌리를 냈습니다 · 80%」를 말할 수 있다.

---

# 6. ★ 판단필요 — 박사님·plan 이 정하셔야 넘어가는 것

## ① ★★ 「떼면」이 아니라 **「뿌리내리면」**으로 했다
박사님 말씀은 *"변이 줄기를 **떼면** 그 개체의 변이 확률이 빛으로 정해진다"* 인데,
**자르는 순간에는 빛을 잴 수가 없다** — `takeCutting` 은 화면이 부르고 조도 계약은 `loop.js` 가
쥐고 있으며 화면은 이번 창의 ⛔ 목록이다.
⇒ **뿌리내리는 날**(물꽂이 12일 · 화분 24일) 그 자리 밴드로 정한다.
★ 규칙으로도 그 편이 낫다고 봤다 — 흔들려면 **밝은 칸을 실제로 12~24일 내줘야** 하므로
박사님이 원하신 자리 다툼이 진짜가 된다. **다르게 하실 거면 화면 쪽 창구가 하나 필요하다.**

## ② ★★ **이사 성공률을 되돌리는 것은 이 일이 아니었다**
어제 78% → 20% 로 떨어뜨린 것은 *"무늬 잎 한 장을 모주에서 떼야 한다"* 였고
(`escapecut §4`), 그 한 장은 **여전히 떼야 한다.** 이번 규칙은 **뗀 뒤에 그 조각이
무엇이 되나**를 바꿨을 뿐이다.
⇒ 되돌리는 길은 `escapecut §4` 의 넷(㉮ 그대로 · ㉯ 확정 무늬 간격 12일 축소 ·
㉰ 삽수 값 인상 · ㉱ 프롤로그 무늬 두 장)이고 **전부 밸런스라 안 골랐다.**
★ 다만 **㉱ 의 값이 이번에 크게 올랐다** — 두 장을 주면 한 장은 팔고 한 장은
「밝은 칸에서 키워 60일에 200만」이 된다. 전에는 그 한 장이 반드시 고스트로 죽었다.

## ③ 재현이 **「키우는 길」을 못 잰다**
`test_banjiha_routes §④` 가 `현금 + 삽수 + 모주 ≥ 이사비` 면 손에 있는 것을 전부 판다.
모주 하나가 2,133,333원이라 **삽수가 자라기 전에 걸린다.**
⇒ 고치는 곳은 그 한 줄인데, 「사람이 어떻게 파나」를 바꾸는 일이라 **밸런스 판단**이다.

## ④ `varieChance` 는 값에 **아직 안 걸린다**
지금 삽수 값은 **잎 수와 무늬 잎 수**만 본다(`shop.priceOf`). `varieChance` 는
「앞으로 날 잎이 무늬일 확률」이라 **키워야 값이 된다.** 그래서 뿌리내리자마자 파는 판에서는
어두운 데 둔 20% 삽수와 밝은 데 둔 80% 삽수의 **값이 똑같다.**
⇒ 「소질이 높은 삽수가 그 자체로 비싼가」는 값 체계 결정이라 안 건드렸다.

## ⑤ 「무지 삽수가 모주 값을 그대로 받는다」가 예전과 다르다
옛 규칙에서 무지 마디는 `lineage:'revert'` 라 **무늬율 0** 이었다. 박사님 ⑤(*"안 오르고
안 내린다"*)를 그대로 읽어 **모주 값 상속**으로 했다. ⇒ 무늬 모주에서 뜬 **민무늬** 삽수도
19.5% 로 새 잎에 무늬가 날 수 있다. **다르게 읽으셨으면 한 줄이다**(`childChance = 0`).

---

# 7. 못 한 것

- **`game.html` 을 안 고쳤다** — 쓰기 영역 밖. 패치 셋은 §5 에 코드째 있다.
  ★ 그중 ⓐ(병 단추 회색)는 **눈에 보이는 흠**이다. 붙여 주셔야 한다.
- **`test_escapecut.mjs` 의 §0·§C-2 문구를 안 고쳤다** — 쓰기 영역 밖. 검사는 통과하지만
  근거 문장(*"지금 나는 무늬 삽수는 전부 고스트"*)이 **이제 사실이 아니다**(§4).
- **`tools/probe_varie_lineage.mjs` 를 안 고쳤다** — 그 재현은 통째로 키메라 계통 시뮬이라
  「고치기」가 아니라 「다시 쓰기」다. 쓰기 영역 밖이고, 지금은 없어진 규칙을 재고 있다.
- **`test_banjiha_routes` `G-2b` 는 깨진 채로 뒀다** — 낮춰서 통과시키지 않았다(§2-1).
- **사람이 실제로 손으로 몰아 본 판은 없다.** 화면 확인은 부팅 예외 0건까지다.
  `probe_cutting_ui.mjs` 는 삽수에 닿기 전에 끝난다(§3).
- **밝기 셋 중 「어두움 20%」가 실제 판에서 얼마나 나오는지** 안 쟀다 — 뿌리내림 12~24일
  동안 어두운 칸에 두는 판을 재현이 안 굴린다.
- 임시 재현 `tools/_probe_cut2.mjs` · `_probe_cut3.mjs` · `_probe_boot2.mjs` 는 **전부 지웠다.**

---

# 8. ⚠⚠ **커밋을 안 했다** — 다른 창이 같은 파일을 쥐고 있다

커밋해도 된다고 하셨는데 **하나도 안 했다.** 까닭이 분명하고, 되돌릴 것도 없다.

`src/game/save.js` 와 `src/game/loop.js` 에 **다른 창의 안 끝난 「다개체 리팩터」**가 들어 있다.
내가 일하는 동안 그쪽이 커밋까지 했다:

    8f560c2 엔진이 한 그루밖에 못 담았다 — 그루를 갈아 끼우는 등록부를 뒀다 (걸음 1)

| 파일 | 누구 것인가 |
|---|---|
| `src/game/propagation.js` | **전부 내 것** (남의 표시 0건) |
| `tools/test_propagation.mjs` · `test_cutting_wiring.mjs` · `test_banjiha_routes.mjs` | **전부 내 것** |
| `docs/propagation.md` · `docs/handoff/*` | **전부 내 것** |
| **`src/game/save.js`** | ⚠ **섞여 있다** — 남의 것(`growthId`·`growthSeed`·화분별 `dliHist`·`syncPotLead`) + 내 것(삽수 칸 둘 · `migrateCuttingRules`) |
| **`src/game/loop.js`** | ⚠ **거의 남의 것** — 내 것은 **주석 한 덩어리**뿐이다 |

### ★ 왜 「내 것만 골라 커밋」도 안 했나 — 재서 정했다
`tools/test_propagation.mjs §L` 이 **`save.js` 의 `migrateCuttingRules` 를 import** 한다.
`save.js` 를 빼고 커밋하면 그 검사가 **HEAD 에서 못 뜬다.** 그리고 `propagation.js` 만 넣으면
`packCutting` 이 새 칸 둘(`varieLightBand`·`varieFromCut`)을 **조용히 안 적어서**
「저장 한 번에 빛 판정이 다시 열리는」 바로 그 병이 HEAD 에 박힌다.
⇒ **어떻게 쪼개도 HEAD 가 빨개진다.** 「고장난 상태를 커밋」하지 않는 쪽을 골랐다.
⇒ 작업물은 **working tree 에 그대로 있고 검사는 전부 통과한다.** 남의 것과 **부딪히지도 않는다**
  (`test_save`·`test_propagation`·`test_banjiha_routes` 를 그쪽 변경이 들어 있는 채로 돌려서 통과했다).

### ⇒ 마스터가 할 일 (한 번에)
```
git add src/game/propagation.js src/game/save.js src/game/loop.js \
        tools/test_propagation.mjs tools/test_cutting_wiring.mjs tools/test_banjiha_routes.mjs \
        docs/propagation.md docs/handoff/cutting2-to-plan.md docs/handoff/plan-2026-08-17-cutting.md
```
⚠ **`save.js`·`loop.js` 는 다개체 리팩터 창과 같이 넣어야 한다** — 그 파일에는 두 창의 일이
한 덩어리로 들어 있다. 쪼개려면 hunk 단위 수술이 필요하고, 그쪽이 지금도 그 파일을 쓰고 있어
내가 손대면 남의 작업을 쓸어 담는다.

⚠⚠ **그래서 이번 실측에는 딸린 조건이 하나 있다** — 전·후 두 번 다
**다개체 리팩터가 들어 있는 working tree** 에서 쟀다. 밑바탕이 같으므로 **전후 비교는 성립하지만**,
「지금 HEAD 의 숫자」와는 다를 수 있다.

---

START 21:21:17 · END 22:08:40 · **커밋 없음**(위 §8)
