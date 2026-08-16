# cutleaf → plan — 잘린 마디가 **방에서도 잘려 보이게** 하는 길을 뚫었다

> 2026-08-17 · 창 `cutleaf`
> 고친 파일 **둘**: `plant_grow.html` · `src/game/growth_adapter.js`
> 새 파일 **하나**: `tools/probe_cutleaf.mjs`
> `game.html` · `src/game/room_view.js` 는 **한 글자도 안 건드렸다**(다른 창 둘이 그 파일을 고치는 중이다)

---

## 0. 설명 먼저 — 무엇이 없어서 안 됐나

박사님 원문: *"그리고 **잘린 원본은 잘려야 되는데 잘리기 전 모습 그대로**네."*

삽수를 자르면 **코어 장부에서는 잎이 준다** — `propagation.js §motherLeafStats` 가 `lostLeaves`
만큼 뺀다. 그런데 **방에 서 있는 몬스테라는 잎을 그대로 달고 있다.**

까닭은 하나다. 형태의 정본은 `plant_grow` 이고, 거기에 **「이 마디를 잘랐다」를 알려 줄 창구가
없었다.** 방(`render3d/plant_assemble.js`)은 이미 잎별 상태를 받아 그린다 —
`game.html §syncRoom` 이 `leafState: io.growth.leafState()` 를 넘기고,
`plant_assemble §__setLeafState` 가 그 줄을 `leafBirth` 로 찾아 `LEAF_HEALTH` 에 앉힌다.
**받는 쪽은 이미 준비되어 있었다.** 없던 것은 **「어느 잎이 잘려 나갔나」를 잇는 열쇠**뿐이다.

그래서 이 창이 한 일은 **열쇠를 내주는 읽기 창구 하나**다.
생장 알고리즘·확률·캐논 숫자는 **한 개도 안 바꿨다.** 난수 스트림도 안 건드렸다.
**잎을 실제로 지우지도 않았다** — 지우는 것은 `game.html` 몫이다.

---

## 1. 무엇이 바뀌었나

### 1-1. `plant_grow.html §cuttableNodes` — 마디마다 칸 **둘**이 늘었다

```
[{ nodeId, stem, leaves, variegatedLeaves, leafBirths, leafKeys, growthDays }, …]
```

| 새 칸 | 무엇 |
|---|---|
| `leafBirths: number[]` | 그 마디를 자르면 딸려 나갈 잎들의 **`leafBirth`** — `leafState()` 가 내는 줄의 열쇠와 **같은 칸** |
| `leafKeys: string[]` | 같은 잎들의 **축 경로**(`n0` · `n0.1` · `n0.1:1`) — 잎마다 **유일하다** |

- 두 배열은 **자리로 짝**이다(`leafBirths[i]` 의 잎이 `leafKeys[i]`).
- 길이는 그 마디의 `leaves` 와 **정확히 같다**(아래 §3-A 로 쟀다).
- 잎을 세던 그 걸음(`carried`)에서 같이 모은다 — **트리를 다시 안 돈다.**

### 1-2. `growth_adapter.js` — 통과 + 도움 함수 하나

- `cuttableNodes()` 는 배열을 그대로 넘기므로 새 칸이 **손 안 대고 통과**한다(§3-F 로 쟀다).
- **`leafKeysOfNodes(nodeIds)`** 를 새로 냈다. 아래 §2 가 계약이다.

---

## 2. ★ `game.html` 이 쓸 계약 — 어느 함수를 어떻게 부르면 무엇이 나오나

### 2-1. `io.growth.cuttableNodes()`

전과 같이 부른다. 줄마다 `leafBirths` · `leafKeys` 가 **더 붙어서** 온다.
옛 `plant_grow` 를 물리면 그 두 칸이 **`undefined`** 다(빈 배열이 아니다 — 지어내지 않았다).

### 2-2. `io.growth.leafKeysOfNodes(nodeIds)` ← **새로 낸 것**

```js
const r = io.growth.leafKeysOfNodes('n0#3');          // 하나
const r = io.growth.leafKeysOfNodes(['n0#3','n0.1#0']); // 여럿
```

| 반환 | 무엇 |
|---|---|
| `nodeIds` | 실제로 물어본 마디 이름들 |
| `leafBirths: number[]` | 딸려 나갈 잎들의 `leafBirth` — **`leafState()` 의 줄을 찾는 값** |
| `leafKeys: string[]` | 같은 잎들의 유일한 열쇠(축 경로). `leafBirths[i]` 와 자리로 짝 |
| `missing: string[]` | 못 찾은 `nodeId` — **빈 값으로 안 메꾼다** |
| `twins: number[]` | `leafBirths` 안에서 **겹치는 값**(쌍혹). ⚠ 아래 §2-4 |
| **`null`** | 접근자가 없거나 **열쇠 칸이 없는 옛 `plant_grow`** 일 때. **0 도 빈 배열도 아니다** |

- **겹치는 마디를 같이 줘도 잎이 두 번 안 세어진다** — `leafKeys` 로 추린다.
  (밑동 `n0#0` 와 그 위 `n0#4` 를 같이 주면 밑동 잎 4장이 그대로 4장이다. §3-G2)
- **`null` 이면 호출부는 잎을 지우지 마라.** 빈 배열은 「딸려 갈 잎이 없다」는 거짓말이고,
  그러면 아무 잎도 안 지운 채 「지웠다」고 여기게 된다. 이 파일의 규약 그대로다.
- 삽수를 모주로 자를 때(`propagation.cuttableNodesOfCutting` 이 만드는 마디)는 growth 의 트리에
  없는 마디다 — `missing` 으로 나온다. **화분 모주에만 쓴다.**

### 2-3. 방에서 잎을 지우는 길 (배선은 `game.html` 몫이라 안 했다)

방은 `leafState()` 의 줄을 `leafBirth` 로 찾아 `LEAF_HEALTH` 에 앉히고,
`plant_grow` 의 그리기가 `leafDroppedOf(leafBirth)` 인 잎을 **안 그린다**.
⇒ `syncRoom` 이 넘기는 `leafState` 목록에서 잘린 `leafBirth` 줄의 **`dropped` 를 참으로** 만들면
그 잎이 방에서 사라진다. 필요한 값이 `leafKeysOfNodes(...).leafBirths` 다.

### 2-4. ⚠⚠ **먼저 알아야 할 것 — `leafBirth` 는 잎마다 유일하지 않다**

**쌍혹**(혹 하나에서 가지가 둘 나는 것 · `growTopology ④` · `P.doubleBud = 0.15`)이면
**두 축이 같은 날 태어나 `leafBirth` 가 같다.** 그래서:

- `leafState()` 는 **잎 한 장에 한 줄이 아니다** — 쌍둥이 두 장이 한 줄을 나눠 쓴다
- 그 줄에 `dropped` 를 찍으면 **쌍둥이 잎이 같이 사라진다**
- 실측: 56판 중 **25판**에서 겹쳤고, 겹친 판 수는 **쌍혹 판 수와 정확히 같았다**(25건).
  모자란 줄은 합계 **28장분**이다(§3-C · §3-E)

⇒ **지금 배선으로는 이 오차를 못 없앤다.** `leafState()` 의 줄에 유일 열쇠 칸이 없기 때문이고,
  그 칸은 `varieStateAll()`·`matStateAll()`·`leafHealthAll()` 셋이 다 `leafBirth` 로만 적히므로
  **`plant_grow` 의 장부 모양을 바꿔야** 생긴다. **이 창이 임의로 정할 일이 아니라 적어만 둔다.**
  `leafKeys` 는 이미 나가고 있으니, 정해지면 받는 쪽만 붙이면 된다.

⇒ 그때까지 `game.html` 이 쓸 수 있는 것: **`twins` 가 비어 있으면 오차가 없다.**
  비어 있지 않으면 그 `leafBirth` 하나에 잎이 둘이라, 지우면 **한 장 더 사라진다.**

---

## 3. 잰 표 — `tools/probe_cutleaf.mjs`

```bash
python tools/serve.py 8963
BYEOT_URL=http://localhost:8963 node tools/probe_cutleaf.mjs
```

**★ 무엇을 켜고 껐나** — 대상은 **브라우저에서 실제로 도는 `plant_grow.html`** 이다(vm 스텁이 아니다).
빛은 `setDailyLightSteady(12.16)` 로 못 박고, 진행도는 `setGrowth(day)` 로 세운다.
낙엽은 **정본 기본값 그대로**(`drop_enabled` 를 안 건드렸다 = 초보에서 꺼져 있음).
씨앗 14개 × 생장일 **60·120·200·365** = **56판 · 마디 924개**. 그중 **쌍혹이 난 판 25건**.

**결과: 전부 통과 · 예외 0건.**

| | 잰 것 | 결과 |
|---|---|---|
| A | `leafBirths.length` · `leafKeys.length` = 그 마디의 `leaves` | **마디 924개 전부 일치** (열쇠가 안 샌다) |
| B | 밑동 마디 잎 수 = `leafStats().leaves` (다른 코드 경로) | 56판 전부 일치 |
| C | **`leafBirth` 가 유일한가** | **아니다 — 56판 중 25판에서 겹쳤다** |
| C-2 | 겹친 판 수 vs 쌍혹 판 수 | **25 = 25** (겹침의 출처가 쌍혹이다) |
| D | `leafKeys` 가 유일한가 | **56판 전부 유일** |
| E-1 | 밑동이 품은 열쇠가 전부 `leafState` 안에 있나 | 56판 전부 포함 |
| E-2 | `leafState` 의 **초과** 열쇠의 정체 | **전부 「아직 안 난 잎」** (장부가 미리 굴려 둔 것) |
| E-3 | `leafState` 줄 수 vs 달린 잎 수 | **25판에서 줄이 모자람 · 합계 28장분** |
| F-1 | 어댑터가 낸 목록 = 창에서 직접 부른 것 | 한 글자도 안 다름 |
| F-2 | 새 칸이 어댑터를 **그대로 통과**하나 | 배열이 살아서 옴 |
| G-1~8 | `leafKeysOfNodes` 여덟 갈래 | 전부 통과 (아래) |
| H | **읽기 전용** — 매 턴 불러도 형태·성숙·잎 상태가 같나 | 160턴 굴려서 **한 글자도 안 바뀜** |

### 3-1. 열쇠가 실제로 어떻게 나오나 — seed **92158**(게임이 쓰는 씨앗) · DLI 12.16

| 생장일 | 마디 | 잎 | 무늬 | 쌍혹 | 밑동 `leafBirths` | 밑동 `leafKeys` |
|---|---|---|---|---|---|---|
| 60 | 3 | 1 | 0 | 없음 | `36` | `n0` |
| 120 | 8 | 3 | 0 | 없음 | `36,136,256` | `n0,n0.1,n0.1.1` |
| 200 | 13 | 4 | 0 | 없음 | `36,136,256,376` | `n0,n0.1,n0.1.1,n0.1.2` |
| 365 | 20 | 5 | 1 | 없음 | `36,136,256,376,496` | `n0,n0.1,n0.1.1,n0.1.2,n0.1.3` |

**유효 200일 · 마디 전부** — 「위로 갈수록 딸려가는 것이 준다」가 열쇠로도 그대로 보인다:

| 마디 | 등급 | 잎 | `leafBirths` | `leafKeys` |
|---|---|---|---|---|
| `n0#0` | pink | 4 | `36,136,256,376` | `n0,n0.1,n0.1.1,n0.1.2` |
| `n0#1` | thick | 4 | `36,136,256,376` | `n0,n0.1,n0.1.1,n0.1.2` |
| `n0#2` | pink | 1 | `36` | `n0` |
| `n0#3` | pink | 1 | `36` | `n0` |
| `n0#4` | pink | 1 | `36` | `n0` |
| `n0.1#0` | pink | 3 | `136,256,376` | `n0.1,n0.1.1,n0.1.2` |
| `n0.1#1` | thick | 3 | `136,256,376` | `n0.1,n0.1.1,n0.1.2` |
| `n0.1#2` | thick | 2 | `136,376` | `n0.1,n0.1.2` |
| `n0.1#3` | pink | 1 | `136` | `n0.1` |
| `n0.1.1#0~2` | pink | 1 | `256` | `n0.1.1` |
| `n0.1.2#0` | petiole | 1 | `376` | `n0.1.2` |

같은 순간 `leafState()`:
`[{36,matured},{136,matured},{256,matured},{376}]` — **밑동의 `leafBirths` 와 정확히 맞물린다.**

### 3-2. ★ 겹치는 자리 — 쌍혹이 범인이다 (짐작이 아니라 축까지 따라가서 확인했다)

| 판 | 잎(열쇠=`leafBirth`) | 겹친 자리 |
|---|---|---|
| seed 33 · 120일 | `n0=36 n0.0=136 n0.0.1=256 n0.0:1=136` | **136 ← `n0.0` + `n0.0:1`** |
| seed 42 · 120일 | `n0=36 n0.1=136 n0.1:1=136 n0.1:1.0=256` | **136 ← `n0.1` + `n0.1:1`** |
| seed 1 · 200일 | `n0=36 n0.0=136 n0.1=256 n0.2=376 n0.2:1=376` | **376 ← `n0.2` + `n0.2:1`** |
| seed 33 · 365일 | 잎 10장 | **136 ← `n0.0`+`n0.0:1` · 416 ← `n0.5`+`n0.5:1`** |

축을 직접 찍어 확인했다 — `n0.0`(birth 120) 과 `n0.0:1`(birth 120) 은 **같은 혹에서 같은 날**
난 두 가지다. `leafBirth = birth + petGrow(16)` 이므로 값이 같을 수밖에 없다.
겹친 것은 **언제나 `X` 와 `X:1` 짝**이었고, 다른 결의 겹침은 한 건도 없었다.

⚠ **자를 한 번 고쳤다** — 처음 낸 표는 `leafBirths` 만 정렬해서 찍고 `leafKeys` 는 안 정렬해
찍었다. 두 배열은 자리로 짝인데 한쪽만 정렬하니 **짝이 어긋난 표**가 나왔고, 그걸 읽고
「손자 잎이 겹쳤다」고 잘못 볼 뻔했다. (START-HERE §2 — 숫자가 이상하면 재는 자를 먼저 의심하라)
지금 자는 **짝지어서** 낸다.

### 3-3. `leafKeysOfNodes` 실측

```
leafKeysOfNodes('n0#0')                → {leafBirths:[36,136,256,376],
                                          leafKeys:["n0","n0.1","n0.1.1","n0.1.2"],
                                          missing:[], twins:[]}
leafKeysOfNodes(['n0#0','n0#4'])       → 열쇠 4개 (겹친 잎을 두 번 안 센다)
leafKeysOfNodes(['없는마디#9'])         → {leafBirths:[], leafKeys:[], missing:['없는마디#9']}
접근자 없는 옛 plant_grow              → null
열쇠 칸 없는 옛 목록                    → null
쌍혹 개체 (seed 33 · 365일)            → 잎 10장 · leafState 9줄 · twins [136,416]
```

---

## 4. 다른 검사가 안 깨졌나

새 칸은 **더 붙기만** 했고 `propagation.assertCutNode` 는 모르는 칸을 안 본다.

| 검사 | 결과 |
|---|---|
| `test_cuttable` | PASS |
| `test_propagation` | PASS |
| `test_maturation` | PASS |
| `test_monstera_canon` | 전부 통과 |
| `test_growth_speed` | PASS |
| `test_multiplant_core` | PASS |
| `test_cutting_wiring` | 전부 통과 |
| `test_escapecut` | PASS |
| `test_cutstamina` | PASS (13/13) |

---

## 5. 못 한 것 · 안 한 것 (있는 그대로)

- **잎을 실제로 지우는 배선은 안 했다.** 지시대로 `game.html` · `room_view.js` 를 안 건드렸다.
  ⇒ **「잘린 원본이 방에서도 잘려 보인다」는 아직 화면으로 확인되지 않았다.**
  이 창이 낸 것은 **열쇠까지**이고, 그 열쇠로 잎이 사라지는 것은 **아직 아무도 안 봤다.**
  (START-HERE §2 — 「고쳤다」를 화면 확인 없이 쓰지 않는다. 그래서 여기 「고쳤다」로 안 적는다)
- **쌍혹 오차는 못 없앴다** (§2-4). `leafState()` 의 줄에 유일 열쇠 칸이 없어서고, 그 칸을
  만들려면 `plant_grow` 의 장부(`VARIE_STATE`·`MAT_STATE`·`LEAF_HEALTH`) 모양을 바꿔야 한다.
  **범위 밖이라 재서 적어만 뒀다.** 실측 빈도는 판의 **45%**(25/56), 오차는 판당 잎 1~2장이다.
- **세이브는 안 봤다.** `leafKeys`/`leafBirths` 가 세이브에 실려야 하는지는 자르기 배선을 하는
  창이 정할 일이다. 지금 이 칸들은 **부를 때마다 트리에서 다시 읽는 값**이라 저장할 필요는 없다.
- 삽수를 모주로 다시 자르는 길(`cuttableNodesOfCutting`)에는 이 칸이 **없다** — 코어 장부가
  만드는 마디라 growth 의 트리에 없다. `missing` 으로 정직하게 나온다.
