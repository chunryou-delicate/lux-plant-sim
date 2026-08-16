# twinleaf → plan — **쌍둥이 잎에 이름표를 달았다.** 안 자른 잎이 사라지던 것을 막았다

> 2026-08-17 · 창 `twinleaf`
> 고친 파일 **셋**: `plant_grow.html` · `src/game/growth_adapter.js` · `game.html`(`leafStateForRoom` 함수 하나)
> 새 파일 **둘**: `tools/probe_twinleaf.mjs` · 이 문서 (+ 사진 4장 `docs/handoff/img/twinleaf/`)
> `src/render3d/room_view.js` 는 **한 글자도 안 건드렸다.** `plant_assemble.js` 도 안 건드렸다(→ §6)

---

## 0. 설명 먼저 — 무엇이 문제였나

박사님 원문: *"잘린 모주 쌍둥이 잎은 값을 공유한다는 게 뭐야? **각각 따로 자라야지**
같이 자란다는 거야? **수정해.**"*

**잎은 이미 각각 따로 자란다.** 축(생장점)이 따로고 무늬 굴림도 따로다. 문제는 자라는 것이
아니라 **이름표**였다.

잎별 상태를 밖으로 내는 줄(`varieStateAll`·`matStateAll`·`leafHealthAll` → `growth_adapter §leafState`)
이 **`leafBirth`(그 잎이 난 생장 나이) 하나로만** 적혀 있었다. 그런데 **쌍혹**(혹 하나에서 가지가
둘 나는 것 · `growTopology ④` · `P.doubleBud`)에서 난 두 잎은 **같은 날 태어나서 그 값이 같다.**
⇒ 두 잎이 **한 줄을 나눠 쓴다.** 그 줄에 「잘렸다」를 찍으면 **안 자른 쌍둥이까지 사라진다.**

이 창이 한 일은 **그 줄에 유일한 이름표를 다는 것**이다. 이름은 새로 짓지 않았다 —
`cuttableNodes()` 가 이미 내던 축 경로(`n0` · `n0.1` · `n0.1:1`)를 **같은 함수**(`axisPathsOf`)
로 낸다. 생장 알고리즘·확률·캐논 숫자·난수 스트림은 **한 개도 안 바꿨다.**
잎을 실제로 없애지도 않았다 — 지우는 것은 화면이 **안 그리는 것**이다.

---

## 1. ★★ 먼저 알아야 할 것 — **옛 코드는 실제로 쌍둥이를 지우고 있었다**

`cutleaf` 창은 `game.html §leafStateForRoom` 이 「딱 맞을 때만 지우고 애매하면 손을 안 댄다」
로 **위험을 피해 뒀다**고 적었다. **재 보니 안 피해져 있었다.**

그 판정은 「잘라 낸 장수 = 화면에 있는 장수」였는데, **「화면에 있는 장수」를 `leafState()` 의
줄 수로 셌다.** 줄은 `leafBirth` 하나에 **하나뿐**이라 쌍혹이어도 늘 1 이다.
⇒ 한쪽만 잘라도 `want 1 = have 1` 로 **딱 맞아 버려서** 그 줄을 지웠고, **쌍둥이가 같이 사라졌다.**

**화면으로 확인했다** (seed 101 · 유효 365일 · 잎 9장 · 겹친 `leafBirth 136` = `n0.0` + `n0.0:1`):

| | 잘린 잎 | 화면에 남은 잎 |
|---|---|---|
| 옛 길 | `n0.0` **1장** | **7장** — `n0.0` 과 `n0.0:1` 이 **둘 다** 사라졌다 |
| 새 길 | `n0.0` 1장 | **9장** — 손을 안 댄다(§6 때문에 아직 못 지운다) |

사진: `docs/handoff/img/twinleaf/twin_old.png`(옛 길 · 잎 7장) vs `twin_new.png`(새 길 · 잎 9장).
왼쪽의 큰 갈라진 잎 둘이 옛 길에서 통째로 없어진 것이 눈으로 보인다.

⇒ **박사님이 보신 것이 이것이다.** 지금은 그 일이 안 난다.

---

## 2. 무엇이 바뀌었나

### 2-1. `plant_grow.html` — 읽기 창구 **하나**가 늘었다

```js
leafAxisKeys()  →  [{ leafBirth, leafKey }, …]      // 잎 한 장에 한 줄
```

| 칸 | 무엇 |
|---|---|
| `leafBirth` | 그 잎의 생장 나이 — `leafState()` 줄의 **옛 열쇠**와 같은 값(겹칠 수 있다) |
| `leafKey` | 그 잎이 달린 **축의 경로**(`n0`·`n0.1`·`n0.1:1`) — **잎마다 유일하다** |

- 이름은 **새로 안 짓는다.** `axisPathsOf` 를 불러 쓴다 — `cuttableNodes().leafKeys` 와
  **같은 함수가 지은 같은 값**이다(56판 전수 대조 §4-③).
- 「난 잎」의 기준은 `leafStats`·`cuttableNodes` 와 같다(`birth<=g` 그리고 `g>=leafBirth`).
  **떨어진 잎도 낸다** — 이름표를 내는 함수지 무엇이 보이나를 정하는 함수가 아니다.
  **아직 안 난 잎은 안 낸다**(축이 없어 경로가 없다. 없는 이름을 지어내지 않는다).
- **읽기 전용이다.** `topologyNow` 가 난수를 쓰고 반드시 되돌린다(40번 불러도 안 바뀜 §4-⑧).

### 2-2. `growth_adapter.js §leafState()` — 줄에 이름표가 붙는다

```js
io.growth.leafState()               // 예전 모양 + 칸 둘
io.growth.leafState({ perLeaf:true })   // ★ 잎 한 장에 한 줄
```

| 붙은 칸 | 무엇 |
|---|---|
| `leafKeys: string[]` | 이 줄을 나눠 쓰는 잎들의 이름표 **전부**. 보통 1개, **쌍혹이면 2개 이상**. 아직 안 난 잎이면 **빈 배열** |
| `leafKey: string\|null` | 줄이 잎 한 장을 가리킬 때 그 이름표. **못 가르면 `null`** — 「이 줄로는 어느 잎인지 모른다」는 정직한 답이다 |

- **기존 칸(`leafBirth`·`varie`·`matured`·`fade`·`dropped`·`grade`)은 하나도 안 없앴다**(§4-④-2).
- ⚠ **줄 수는 안 바뀐다**(기본값). 늘리면 `shop.js §assignPotLeafGrades` 가 **줄 차례**로 잎
  번호를 매기므로(`leafNo = i + 1`) **프롤로그 못박기가 통째로 밀리고 그루 값이 조용히 달라진다.**
  그래서 늘리는 것은 **`opt.perLeaf` 로만** 연다.
- `perLeaf:true` — 쌍혹 줄이 잎 수만큼 갈라지고 `leafKey` 가 **전부 유일**하다. 갈라진 줄은
  나머지 칸을 **그대로 복사**한다. 정본 장부가 `leafBirth` 로만 적혀 있어 **쌍둥이별 값이 애초에
  없기 때문**이고, 지어내는 대신 「같은 값을 나눠 쓰고 있다」를 있는 그대로 낸다.
- ⚠ 이름표를 못 내는 **옛 `plant_grow`** 면 칸 자체가 안 붙고, `perLeaf` 는 **`null`** 이다
  (빈 배열도 옛 모양도 아니다 — 이 파일의 규약 그대로).

### 2-3. `game.html §leafStateForRoom` — 세지 않고 **짚는다**

- **길 ①(이름표가 있을 때)** — 줄이 품은 이름표가 **전부** 잘린 이름표면 그 줄을 지운다.
  세는 것이 아니라 짚는 것이라 「장수가 우연히 맞아서 남의 잎이 지워지는」 일이 없다(§1 이 그것이었다).
- 한쪽만 잘린 쌍혹은 **손을 안 댄다**(§6). 그때만 콘솔 경고를 한 번 남긴다.
- **길 ②(이름표가 없는 옛 `plant_grow`)** — 예전 길 그대로 둔다. 없앤 것을 지어내지 않았다.
- **이 함수 밖은 한 글자도 안 건드렸다.**

---

## 3. ★ 호출부가 쓸 계약

```js
const rows = io.growth.leafState();
for (const r of rows) {
  r.leafKey    // 이 줄이 가리키는 잎. null 이면 못 가른다(쌍혹이거나 아직 안 난 잎)
  r.leafKeys   // 이 줄을 나눠 쓰는 잎 전부. length>1 이면 쌍혹이다
}
io.growth.leafState({ perLeaf:true })   // 잎마다 한 줄 · leafKey 전부 유일 · 옛 파일이면 null
```

- `leafKey` 는 `cuttableNodes().leafKeys` · `leafKeysOfNodes().leafKeys` 와 **같은 글자**다.
  세 창구를 그대로 맞물려 쓸 수 있다(§4-③ · §4-③′ 로 대조했다).
- **`null` 을 값으로 쓰지 마라.** 「모른다」는 뜻이고, 모르면 지우지 않는 것이 이 저장소의 규약이다.

---

## 4. 잰 표 — `tools/probe_twinleaf.mjs`

```bash
python tools/serve.py 8963
BYEOT_URL=http://localhost:8963 node tools/probe_twinleaf.mjs
```

**★ 무엇을 켜고 껐나** — 대상은 **브라우저에서 실제로 도는 `plant_grow.html`** 이다(vm 스텁이 아니다).
빛은 `setDailyLightSteady(12.16)` 로 못 박고, 진행도는 `setGrowth(day)` 로 세운다.
낙엽은 **정본 기본값 그대로**(`drop_enabled` 를 안 건드렸다 = 초보에서 꺼져 있음).
씨앗 14개 × 생장일 60·120·200·365 = **56판** — `cutleaf` 창이 쓴 자와 **같은 판**이다.
어댑터는 **진짜 `growth_adapter.js`** 를 iframe 에 물려 쓰고, `leafStateForRoom` 은
**`game.html` 에서 함수를 떼어 와** 돌린다(베끼면 「자가 딴 세상 것」이 된다 · §2.9-④).

**결과: 잰 것 20가지 중 19가지 통과 · 예외 0건. 못 한 것 하나는 §6.**

| | 잰 것 | 결과 |
|---|---|---|
| ① | **쌍혹이 난 판을 실제로 찾았나** | **25/56판**에서 `leafBirth` 가 겹쳤다 (cutleaf 의 25건과 같다) |
| ② | `leafKey` 가 잎마다 유일한가 | **56판 전수 · 중복 0** |
| ③ | `leafAxisKeys()` 의 열쇠 = `cuttableNodes("n0#0").leafKeys` | **56판 전부 일치** |
| | `leafAxisKeys()` 줄 수 = `leafStats().leaves` | 56판 전부 일치 (열쇠가 새거나 남지 않는다) |
| ④-1 | `leafState()` 줄에 `leafKeys`·`leafKey` 가 붙어 오나 | 붙어 온다 |
| ④-2 | **기존 칸이 하나도 안 없어졌나** | 다 있다 |
| ④-3 | 쌍혹 줄이 이름표 둘을 내나 | `leafBirth 136 → ["n0.0","n0.0:1"]` |
| ④-4 | 못 가르는 줄의 `leafKey` | **`null`** (0 이나 아무 값으로 안 메꾼다) |
| ④-5 | `perLeaf` 가 잎마다 한 줄인가 | 8줄 → **9줄** · 이름표 중복 **0** |
| ③′ | `perLeaf` 의 이름표 집합 = `cuttableNodes` 의 것 | 한 글자도 안 다름 |
| ⑤-1 | 옛 `plant_grow` → 칸 자체가 안 붙나 | 안 붙는다 |
| ⑤-2 | 그때 `perLeaf` | **`null`** |
| ⑤-3 | 그때 예전 길로 안전하게 떨어지나 | 옛 길·새 길이 같은 줄을 지운다 |
| ⑤-4 | **[찾은 것]** 옛 길이 한쪽만 잘린 쌍혹에 한 일 | **쌍둥이를 같이 지웠다** (§1) |
| ⑥-1 | 쌍혹이 안 섞인 마디를 자르면 그 줄이 정확히 지워지나 | 잘린 잎 5장 → 지운 줄 5개 |
| ⑥-2 | **쌍혹 한쪽만 잘렸을 때 쌍둥이 줄에 손을 대나** | **안 댄다** |
| ⑦-0 | **화면이 그린 잎 이름 = 정본이 낸 이름표** | 9개 전부 일치 (자가 딴 세상 것이 아니다) |
| ⑦-1 | **화면** — 쌍혹 안 섞인 마디를 자르면 그 잎만큼만 사라지나 | 9 → 4 (**5장** = 자른 잎 5장) |
| ⑦-2 | **화면** — 한쪽만 잘랐을 때 안 자른 쌍둥이가 사라지나 | **9 → 9. 안 사라진다** |
| ⑦-2′ | **화면** — 같은 자리에서 **옛 길**은 | **9 → 7. 둘 다 사라졌다** |
| ⑦-3 | **화면** — 잎 한 장짜리 줄에 「잘렸다」를 찍으면 한 장만 사라지나 | **못 했다 → §6** |
| ⑧ | **읽기 전용** — 40번 불러도 형태·성숙·잎 상태가 같나 | 한 글자도 안 바뀜 |
| ⑨ | 예외 0건 · 사진 4장 | 예외 0 · 색 3,700~5,400가지 |

### 4-1. 쌍혹이 실제로 어떻게 나오나 (겹친 자리 · 나눠 쓰는 이름표)

| 판 | 겹친 `leafBirth` | 그 값을 나눠 쓰는 잎 |
|---|---|---|
| seed 1 · 200·365일 | 376 | `n0.2` · `n0.2:1` |
| seed 33 · 120·200·365일 | 136 | `n0.0` · `n0.0:1` |
| seed 33 · 365일 | 416 | `n0.5` · `n0.5:1` |
| seed 42 · 365일 | 136 / 416 | `n0.1`·`n0.1:1` / `n0.1.0`·`n0.1.0:1` |
| seed 101 · 120·200·365일 | 136 | `n0.0` · `n0.0:1` |

겹친 것은 **언제나 `X` 와 `X:1` 짝**이었다 — `cutleaf` 창이 낸 결론 그대로다.

### 4-2. ★ 화면 — seed 101 · 유효 365일 · 잎 9장

```
기준(안 자름)                 9장  n0 · n0.0 · n0.0.1 · n0.0.3 · n0.0:1 · n0.2 · n0.3 · n0.3.2 · n0.4
㉠ 쌍혹 안 섞인 n0#1 을 자름     4장  n0.0 · n0.0.1 · n0.0.3 · n0.0:1        (5장 사라짐 = 자른 잎 5장)
㉡ ★쌍혹 한쪽만 n0.0#4 · 새 길   9장  (그대로)                                 ← 안 자른 잎이 안 사라진다
㉤ ★같은 자리 · 옛 길           7장  n0.0 · n0.0:1 이 **둘 다** 없어짐        ← 이것이 박사님이 보신 것
㉢ ★★n0.0:1 한 장에 직접 찍음   7장  **2장이 사라졌다** — 벽이다(§6)
```

⚠ 잎은 **이름으로 셌다**(`userData.part==='leaf'` 의 `axisKey`). 처음엔 `assetKey` 가 `leaf_` 로
시작하는 것을 셌는데, **갓 난 말린 새순은 다른 GLB 라 안 세어져** 「잎 5장짜리가 3장」으로 나왔다.
표가 거짓말을 하던 자리다(§2.9-⑦ — 찍는 값이 내가 생각한 그 값인지 먼저 확인해라).

**사진** `docs/handoff/img/twinleaf/` — `before_cut.png`(9장) · `after_cut.png`(4장) ·
`twin_new.png`(새 길 9장) · `twin_old.png`(옛 길 7장).

---

## 5. 다른 검사가 안 깨졌나 — **변경 전·후로 각각 돌렸다**

| 검사 | 변경 전 | 변경 후 |
|---|---|---|
| `test_growth_speed` | PASS | PASS |
| `test_maturation` | PASS | PASS |
| `test_monstera_canon` | PASS | PASS |
| `test_multiplant_core` | PASS | PASS |
| `test_cuttable` | PASS | PASS |
| `test_cutting_wiring` | PASS | PASS |

여섯 검사의 **출력이 한 글자도 안 다르다**(`diff` 로 대조 · 전부 같음).
되돌릴 때는 `git stash push -- <내 경로>` 만 썼다(`-u` 금지 — 남의 새 파일까지 쓸어 간다).

---

## 6. ★★★ 못 한 것 — **한쪽만 잘린 쌍혹은 아직 화면에서 못 뺀다**

**이름표는 여기까지 왔다.** `leafState()` 가 잎마다 유일한 이름을 내고, `game.html` 이 그 이름으로
어느 잎이 잘렸는지 정확히 안다. 그런데 **그 뒤 길이 아직 `leafBirth` 로 좁혀진다.**

```
game.html leafStateForRoom  ─(줄 + leafKey)─▶  room_view §setPlant
   ─▶  plant_assemble.js §assemble({ leafState })
   ─▶  plant_assemble.js §__setLeafState     ← ⚠⚠ 여기서 이름표가 버려진다
          LEAF_HEALTH.set(it.leafBirth, { fade, dropped, hold })
   ─▶  plant_grow §buildPlant                 leafDroppedOf(ax.leafBirth) 로 본다
```

두 잎이 `LEAF_HEALTH` 의 **같은 칸**을 나눠 쓰므로 **한 장만 안 그리게 할 창구가 없다.**
실측(⑦-3): 잎 한 장짜리 줄(`n0.0:1`)에 「잘렸다」를 찍었더니 **9 → 7 · 두 장이 사라졌다.**

⇒ 그래서 지금은 **손을 안 댄다.** 「안 자른 잎이 사라지는 것」(옛 길)보다 「자른 잎이 아직 안
없어지는 것」이 낫다 — **모르면 안 한다**가 이 저장소의 규약이다. 그때 콘솔에 경고가 한 번 뜬다.

### 뚫어야 할 자리 (이 창의 **쓰기 영역 밖**이라 안 건드렸다)

지시는 **`plant_grow.html` · `growth_adapter.js` · `game.html` 셋**이었다.
`src/render3d/plant_assemble.js` 는 그 셋에 없어 **한 글자도 안 건드렸다.** 다음 창이 할 일:

1. `plant_assemble.js §__setLeafState` — `LEAF_HEALTH` 의 열쇠를 **`it.leafKey` 가 있으면 그것으로**
   앉힌다(없으면 지금처럼 `leafBirth`). `VARIE_STATE`·`MAT_STATE` 는 `leafBirth` 그대로 두면 된다 —
   그 둘은 쌍둥이가 같은 값을 나눠 써도 그림이 안 틀어진다.
2. `plant_grow.html §buildPlant` — 잎을 그릴 때 `leafDroppedOf(ax.leafBirth)` 대신
   **축 경로도 같이 본다**(`AXK` 가 그 자리에 이미 있다 — `const AXK='n'+_axPath.get(e.ax)`).
   `leafFall()`·`leafStats`·`cuttableNodes.hasLeaf` 도 같은 기준으로 맞춰야 한다.
3. `game.html §leafStateForRoom` — 길 ① 의 「한쪽만 잘렸을 때 손을 안 댄다」를 **지운다**.
   그 자리에 이미 `split` 목록이 만들어져 있으니 그 줄만 `dropped:true` 로 바꾸면 된다.
   `io.growth.leafState({ perLeaf:true })` 가 그때 쓰라고 낸 창구다.

⚠ **2번은 그리기 경로를 만지는 일이다.** 낙엽(`leafFall`)이 같은 칸을 쓰므로, 열쇠를 바꾸면
**자연 낙엽이 조용히 달라질 수 있다.** 캐논에 걸리는 일이라 `test_monstera_canon`·`test_maturation`
을 반드시 전·후로 대조해야 한다. 이 창이 임의로 정할 일이 아니라 **적어만 뒀다.**

### 그 밖에 안 한 것

- **쌍둥이별 `varie`·`matured` 는 여전히 없다.** 두 축은 무늬를 **따로** 굴리는데
  (`ax.varie` 가 축마다 있다), 장부(`VARIE_STATE`·`MAT_STATE`)가 `leafBirth` 로만 적혀 있어
  **밖에서는 한 값으로 보인다.** 지금 `perLeaf` 는 그 한 값을 두 줄에 **복사해서** 낸다.
  갈라 내려면 `plant_grow` 의 장부 모양을 바꿔야 한다 — **범위 밖이라 재서 적어만 뒀다.**
- **세이브는 안 봤다.** `leafKey` 는 부를 때마다 트리에서 다시 읽는 값이라 저장할 필요가 없다.
- 삽수를 모주로 다시 자르는 길(`cuttableNodesOfCutting`)에는 이 이름표가 **없다** —
  코어 장부가 만드는 마디라 growth 의 트리에 없다. `leafKeysOfNodes` 가 `missing` 으로 낸다.

---

## 7. 곁다리로 찾은 것

- **`tools/probe_cutleaf.mjs` 는 예외를 한 건도 안 세고 있다.** `page.on` 은 `(method, params)` 를
  주는데 `m.method` 로 읽는다 — 그 조건이 참이 되는 일이 없다. 그 자의 「예외 0건」은 **근거가 없다.**
  (`tools/test_cdp.mjs §launch` 의 `listeners` 를 보면 바로 보인다. 이 창의 자는 안 그렇게 적었다.)
- **`plant_grow.html` 의 카메라는 직교(Orthographic)다.** 사진을 찍으려고 거리(`orbit.r`)를 줄였는데
  크기가 안 변했다 — 직교에서는 `orbit.zoom` 이 크기를 정한다. 그걸 모르고 「가까이 갔다」고 여겨
  손톱만 한 사진을 한 판 찍었다. **색 가짓수는 이 함정을 못 잡는다**(작아도 색은 많다).
  §2.9-③ 에 한 줄 더 보탤 만한 것: **사진은 색만 세지 말고 눈으로도 봐라.**
- **튜닝 패널이 화면을 덮는 함정**(`probe_branchcut §⑦`)을 그대로 한 번 더 밟았다.
  캔버스만 남기고 감추는 그 코드를 이 자에도 넣었다.
