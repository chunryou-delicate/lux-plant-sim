# 창밖 배경 → plan 인계 (2026-08-05)

창밖 골목을 붙였고, 폰에서 나온 지적 셋 중 둘을 고치고 하나는 원인만 짚었다.
검증은 `node tools/test_*.mjs` **21/21 통과**(새 `test_outside.mjs` 포함).

---

## ① 창밖 골목 — 새로 만들었다

`src/game/outside.js` 는 **없었다.** 저장소 전체에 "outside" 는 두 군데뿐이고
둘 다 "자리가 방 밖이다"를 재는 지역 변수다(`room_view.js:3011`, `state.js:506`).
겹치는 것이 없으므로 새로 만들었다.

| 파일 | 무엇 |
|---|---|
| `src/render3d/outside_alley.js` (신규) | 골목 기하·색·자르기 |
| `src/game/room_view.js` | 붙이는 배선 + `setOutside` · `outsideInfo` |
| `tools/test_outside.mjs` (신규) | 검사 9건 + 그림 13장 |

### 값

| | 삼각형 | 드로우콜 |
|---|---|---|
| 방만 | 2,284 | 76 |
| 창밖 포함 | 2,318 | 77 |
| **증가분** | **+34** | **+1** |

판때기 17장. 재질 한 벌(벽 하나당). 그림자 없음.

### 기본은 반지하만이다
`OUTSIDE_ROOMS = {'banjiha'}`. 위층 방(아파트·온실)에 골목 바닥을 깔면 거짓말이고,
반지하 창은 간유리(투과 0.55)라 대비를 세게 줘도 화면에서는 눌려 나오기 때문이다.
`view.setOutside(true)` 로 어느 방이든 켤 수 있다(비교·측정용).

### ★ 이 작업의 전부인 한 가지 — 지붕 위로 안 삐져나오게 하는 법
게임 카메라는 인형의 집 시점이라 **늘 내려다본다**(상하각 16°~54°).
그래서 창밖에 뭘 세우면 창으로만 보이는 게 아니라 **벽 너머로 그냥 보인다.**
처음 만들었을 때 담벼락과 전봇대가 방 지붕 위로 솟아 화면 절반을 덮었다.

벽 윗변에 가려지는 영역은 `y < CH − tan(el)·o` 이고 상하각이 **얕을수록 더 가려진다.**
그러니 위험한 각은 `EL_MAX`(0.95rad, tan≈1.398) 하나뿐이다. 평면 하나로 자른다.

```
남길 영역:  y + 1.42·o  ≤  CH − 0.08        (three.js clippingPlanes)
```

이 자르기는 **창으로 보이는 것을 하나도 안 자른다** — 창 윗변(2.045)이 벽 윗변(2.3)보다
낮기 때문이다. 증명은 `outside_alley.js` 머리말에 적었다.

⚠ **`room_view.js` 의 `EL_MAX` 를 올리면 `outside_alley.js` 의 `TAN_MAX` 도 같이 올려야 한다.**
안 올리면 담벼락이 지붕 위로 솟는다. `test_outside` 의 `clip_wedge` 가 평면이 사라지는 것은 잡지만
문턱값이 어긋나는 것까지는 못 잡는다.

### 빛은 안 건드렸다 — 증거
- 재질이 `MeshBasicMaterial`(무광원)이고 `castShadow`·`receiveShadow` 를 안 켰다.
  `sunLight`·`skyPortals`·조도 엔진 어느 쪽도 이 기하를 **보지 않는다.**
- `test_outside` 의 `light_untouched` — 창밖을 켜고 끈 두 벌에서
  `sunLight.intensity`·색·`hemi`·`ambient`·`ceilingBulb`·`skyPortals[16]`·`skyWins`·노출이
  **네 시각(t=0.25/0.50/0.78/0.95)에서 전부 완전 일치**한다.
- `test_banjiha_profile` — `live_vs_static` **최대 오차 0.00000**, best 슬롯 `banjiha-sill:0` 일치.
- `test_maturation` G — `143 → 적정광 3턴 → 146 spear_furled` 그대로.

### 그림
`docs/engine/shots/outside_*.png`
- 전체: `morning` `noon` `evening` `night` · `off`↔`on` 비교
- **창만 4배로 자른 것**: `win_off` `win_noon` `win_morning` `win_evening` `win_night`
  (폰에서 창은 손톱만 해서 전체 그림으로는 달라진 게 안 보인다)
- 상하각 양 끝: `el_min`(16°) `el_max`(54°) — 지붕 위로 아무것도 없다

### 안 한 것
**지나가는 발.** 움직이는 것을 하나 두면 `needsRender`/`busyLevel` 이 영영 안 쉬어서
"노는 화면은 안 그린다" 정책이 통째로 깨진다. 배경 하나로 배터리를 태울 값이 아니다.

---

## ② 놓을 자리 세 색 — 계약을 넓혔다

```js
view.highlightSlots(['shelf#1:0', ...])                       // 예전 그대로 (game.html 이 이렇게 부른다)
view.highlightSlots([{ slotId:'shelf#1:0', rank:'good' }, …])  // 새로
view.previewMove(fromId, toId, rank)                           // rank 는 선택
view.previewAt(at, { …, rank })                                // rank 는 선택
view.highlighted()                                             // 지금 무엇이 무슨 rank 로 빛나나
```

| rank | 색 | 뜻 |
|---|---|---|
| `good` | 🟢 `#54c98a` | 놓을 수 있고 그 작물에 좋은 자리 |
| `ok` | 🟡 `#f2c14e` | 놓을 수는 있는데 별로 |
| `bad` | 🔴 `#e8615a` | 여기는 아니다 (못 놓거나 · 그 작물에 못 쓸 자리) |

- 유령 색(`GH_OK`)을 **파랑 `#4aa3ff` → 초록 `#54c98a`** 로 바꿨다. 화분·가구·걷기 유령이 전부 따라간다.
- `rank` 를 안 주면 **예전 그대로**다. `game.html` 의 문자열 배열 호출은 색까지 안 바뀐다.
- `preview.ok` 는 **뜻을 안 바꿨다** — "놓을 수 있나"다. 색(`rank`)과 갈라 뒀다.
  "빨간데 놓을 수는 있다"(빛이 안 맞는 자리)가 실제로 있는 조합이라 그렇다.
- 그림: `docs/engine/shots/slotrank_three.png`

### ★ 게임 쪽이 해야 할 일
**어디가 좋은 자리인가는 방뷰가 판정하지 않는다.** 몬스테라는 밝아야 좋고 콩나물은
어두워야 좋다 — 작물마다 반대다. 그 판정은 `loop.js`·`first_play.js` 가 알고 있으니
`highlightSlots` 에 `rank` 를 실어 주면 된다. 지금은 문자열만 오므로 **색이 예전 그대로다** —
붙일 때까지 박사님 화면은 안 바뀐다.

---

## ③ 캐릭터 프레임 — 움직이는 동안만 상한을 풀었다

### 잰 것
- 렌더 자체는 안 무겁다. 헤드리스(SwiftShader·소프트웨어 GL)에서도 **한 장 1.4ms(중앙)**.
  즉 30 은 **못 그려서가 아니라 배터리 때문에 자른 값**이다.
- 캐릭터는 스켈레톤 클립을 `AnimationMixer` 로 돌린다(`character.js` · idle·walking GLB).
  골격 애니메이션은 30장에서 눈에 띄게 끊긴다. 몬이의 흔들림(2.5초 주기)과는 다른 물건이다.
- ⚠ **폰의 체감은 헤드리스로 못 쟀다** — 화면이 없어 rAF 가 9장/초밖에 안 돈다.
  "30이 원인이다"를 숫자로 못 박지는 못했다.

### 고친 것 — 상한을 셋으로 갈랐다
| 단계 | 언제 | 상한 | 바뀌었나 |
|---|---|---|---|
| `idle` | 캐릭터 idle 만 도는 중 | 10 | 그대로 |
| `busy` | 끌기·카메라 트윈·링 맥박 | 30 | 그대로 |
| `move` | **캐릭터가 실제로 걷는 중 · 동작(물주기) 중** | **60** | ★ 여기만 |

배터리를 태우던 두 경우(몬이 흔들림·손가락 끌기)는 **손대지 않았다.**
걷기·물주기는 짧고 드물다.

그리고 못 따라가면 **스스로 30 으로 내려앉는다**(`moveBackoff` — 움직이는 500ms 창에서
그린 장수가 상한의 3/4 미만인 창이 연속 둘이면). 한 번 내려가면 그 화면이 살아 있는 동안
안 올라간다(오르내리면 그게 곧 '프레임이 튄다'로 보인다). **느린 기기는 예전과 똑같은 화면이다.**

`stepCharacters` 의 갱신 빈도도 같이 따라간다 — 여기만 30으로 두고 60장을 그리면
같은 자세를 두 번 그리는 것이라 배터리만 쓴다.

새 창구: `view.setMoveFps(v)` · `view.stats().fpsCap` · `view.stats().level`

---

## ④ 물주기에 캐릭터가 안 간다 — ★ 원인은 `room_view` 밖이다. 고치지 않았다

### 재현 (`game.html` 안에서 직접 쟀다)

| 넘긴 열쇠 | `resolveKey` | 결과 |
|---|---|---|
| `banjiha-sill:0` (진짜 자리) | 있음 | **걸어간다.** `walking:true` · **2.917m 이동** · `{ok:true, ms:15785}` |
| `free:crop_01` (**게임이 물주기에 넘기는 것**) | **null** | `모르는 슬롯: free:crop_01` 로 **즉시 실패. 한 발도 안 뗀다** |

**`room_view.actAt` 의 걷기는 멀쩡하다.** 열쇠가 안 풀린다.

### 어디가 문제인가 (전부 제 소유 밖)
`game.html:2010`
```js
function cropKey() {
  const b = S.firstPlay && S.firstPlay.beansprout;
  if (!b) return null;
  return b.slotId || `free:${BEANSPROUT_ID}`;   // BEANSPROUT_ID = 'crop_01'
}
```
갓 켠 게임에서 잰 값: `beansprout.slotId === null` · `beansprout.at === null` ·
`roomView.slots().filter(occupied) === []`.
즉 **콩나물이 방에 아직 아무 이름으로도 등록돼 있지 않은데** `cropKey()` 는
`free:crop_01` 이라는 있지도 않은 열쇠를 자신 있게 만들어 낸다.

`doAct` 의 `canAct` 는 `key` 가 **빈 문자열이 아니기만** 하면 통과하므로(`game.html:2036`)
`actAt` 이 불리고, 곧바로 던지고, `onFail` 이 "가지 못했습니다" 배너를 띄운다. 걷기는 없다.

같은 뿌리로 보이는 것 하나 더 — 콘솔에 매 틱
`[방] 몬스테라 갱신 실패 — 모르는 슬롯: null (방 banjiha)` + `Uncaught` 가 계속 찍힌다.

### 소유자에게 (game.html · state.js · first_play.js 창)
1. `cropKey()` 가 `b.at` 도 봐야 한다(자유 배치면 `at` 만 있고 `slotId` 는 없다).
2. `doAct` 의 `canAct` 에 **`roomView.resolveKey(key)` 한 줄**을 더하면
   안 풀리는 열쇠일 때 연출을 건너뛰고 논리만 돌 수 있다 —
   "가지 못했습니다" 배너 대신 조용히 물이 들어간다(사람 없이도 도는 사상과 같다).
3. `setPlant(null, …)` 을 부르는 자리를 막아야 한다(위 콘솔 스팸).

**저는 손대지 않았습니다.**
