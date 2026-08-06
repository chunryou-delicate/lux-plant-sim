# 등 옮기기 — house → plan 인계

**2026-08-06.** 집게등·스탠드등을 플레이어가 옮길 수 있게 했다.
바 등은 못 옮긴다(선반 밑 붙박이 — 그것이 튜토의 긴장이다).

검사: `tools/test_lampmove.mjs` (32건 전부 통과)
그림: `docs/engine/shots/lampmove_{before,after}.png`

---

## 0. 세 줄 요약

- **집게등**은 상판(창턱·책상·서랍장·선반 단)에 **물려서** 옮긴다. 공중에는 못 단다
- **스탠드등**은 손댈 게 없었다 — 바닥에 서는 물건이라 **이미 가구 옮기기가 옮긴다**
- **바 등**은 목록에 안 나오고, 억지로 부르면 **던진다**

---

## 1. 왜 필요했나 — 겨누는 것만으로는 창턱이 안 산다

반사광 모형(직광의 18%)이 들어오면서 창턱 `banjiha-sill:0` 이 문턱 아래로 내려앉았다.
재서 확인한 것:

| 창턱을 밝히는 법 | 창턱 DLI (맑음·여름·12h) | 문턱 6.0 |
|---|---|---|
| 자연광만 (등 0개) | 4.80 | ✗ |
| 붙박이 바 등만 (등 1개) | 5.15 | ✗ |
| 바 + 집게등, 안 겨눔 (등 2개) | 5.19 | ✗ |
| 바 + 집게등, **제자리에서 창턱으로 겨눔** (yaw 훑기 최대) | **5.34** | ✗ |
| 바 + **집게등을 창턱에 물림** | **8.27** | ★ 넘는다 |

**겨누기로는 못 넘는다.** 이유가 둘이다 — 검사(`②-d`)가 숫자로 못 박는다:

- 집게등에서 창턱까지 **1.49m** 다. 역제곱이 다 먹는다
- 창턱은 집게등보다 **위**다. 창턱을 보려면 tilt 가 **107°** 여야 하는데 상한은 **75°** 다.
  등은 아래를 비추는 물건이라 그 상한이 맞다 — 위를 비추라고 늘릴 일이 아니다

⇒ **거리가 방향을 이긴다.** 그래서 옮힐 수 있어야 했다.

---

## 2. 고른 설계와 이유

### 2-1. 무엇을 옮길 수 있나 — `furniture_presets.json` 의 `movable` 을 읽는다

그 칸은 이미 있었는데 **아무도 안 읽고 있었다**(`grep movable src/` 로 확인).
새 판단 근거를 만드는 대신 그 칸을 읽게 했다. 읽는 데는 **한 곳**이다 —
`render3d/house.js` 의 가구 조립 루프다. 거기가 프리셋을 읽는 유일한 자리라서다.

```js
// render3d/house.js — 가구 조립 루프
if (p.movable != null) g.userData.movable = !!p.movable;
```

⚠ **값이 있을 때만 덮어쓴다.** 몇몇 빌더(`shelf_cart`·`room_divider`·`shelf_growrack`)가
스스로 `movable=true` 를 켜는데, `!!p.movable` 을 무조건 쓰면 그걸 **꺼 버린다.**

그리고 겨누기(`aimRange`)와 **같은 자리·같은 방식**으로 rig 에 실어 보낸다:

```js
lightRigs.push({ …, aimRange, liftRange, movable, mount, base:{x,y,z}, … })
```

### 2-2. 세 갈래 — 데이터가 이미 하고 있는 표시를 읽었다

| 등 | 방 데이터의 표시 | 어느 길로 옮기나 |
|---|---|---|
| 스탠드 (`growlight_stand`) | `y` 를 안 적는다 → 바닥에 선다 | **기존 가구 옮기기.** `furniture()`·`commitFurnitureAt` 에 이미 나온다 |
| 집게 (`growlight_clip`) | `y > 0` → 무엇엔가 물려 있다(rider) | **새 길** `lamps()`·`commitLampAt` |
| 바 (`growlight_bar`) | `mount:"under-shelf"` → 붙박이 | **어느 길에도 안 나온다** |

★ **스탠드는 손댈 게 없었다.** `room_view.furnNodes()` 의 조건
(uid 있고 · size 있고 · fixed 아니고 · mount·hangFromCeiling 없고 · y ≤ 0.02)을
그대로 만족한다. 검사 `⑦`·`⑦-b` 가 그걸 못 박는다(방 데이터에 스탠드가 아직 없어서
검사가 자기 자료로 하나 놓아 보고 잰다 — `data` 파일은 안 고쳤다).

⇒ 새 길이 필요한 건 **rider 인 집게등 하나**다. 막혀 있던 지점이 정확히 거기였다.

### 2-3. 어디에 물리나 — **화분이 올라갈 수 있는 상판**

집게등은 무엇엔가 물리는 물건이라 자유 3D 좌표로 두면 방 한가운데 등이 뜬다.
그래서 물릴 자리를 정의해야 하는데, **새 데이터를 만들지 않았다** —
`built.plantSlots` 가 이미 그 목록이다. 화분을 올릴 수 있는 상판이 곧
집게를 물릴 수 있는 상판이다. 새 표를 만들면 정본이 둘이 되고, 가구를 옮길 때
한쪽만 따라간다.

반지하의 물림 자리 **6군데** (한 단에 화분 칸이 셋이어도 상판은 하나):

| mountId | 무엇 | 상판 y |
|---|---|---|
| `banjiha-etagere@0.030` | 선반-다단-3단 · 1단 | 0.030 |
| `banjiha-etagere@0.412` | 선반-다단-3단 · 2단 | 0.412 |
| `banjiha-desk@0.740` | 책상 | 0.740 |
| `banjiha-etagere@0.794` | 선반-다단-3단 · 3단 | 0.794 |
| `banjiha-dresser@0.800` | 서랍장 | 0.800 |
| `banjiha-sill@1.585` | 창턱 화분받침 | 1.585 |

⚠ **집게등은 화분 칸을 안 잡아먹는다.** 등은 rider 라 `furnNodes()` 에도
겹침 판정에도 안 들어간다 — 지금 책상에 물린 집게등이 책상 화분 칸 둘을 안 막는 것과
같은 이치다. 그래서 창턱에 등을 물려도 창턱 화분은 그대로 놓을 수 있다.

### 2-4. 높이 — `adjustable_height` 를 살렸다

물릴 자리를 고르면 밑동 y 의 **바닥**(상판 높이)이 정해지고, 거기서 `lift` 만큼 든다.
상한은 **그 등의 키**다 — 지어낸 숫자가 아니라 물건의 크기다(집게등 0.42m).
`adjustable_height:false` 인 등은 `liftRange` 가 `null` 이라 아예 못 든다.

실제로 값이 움직인다(창턱에 물린 집게등 · 창턱 DLI · 등 2개):

| lift | 발광점 y | 창턱 DLI |
|---|---|---|
| +0.00m | 1.971 | **8.27** |
| +0.05m | 2.021 | 7.60 |
| +0.10m | 2.071 | 7.12 |
| +0.20m | 2.171 | 6.51 |

⇒ 낮게 물수록 밝다. 천장(2.3m)에 닿는 높이는 막는다.

### 2-5. 자리 저장 — **가구와 같은 표를 쓴다**

등 전용 칸을 새로 만들지 **않았다.** 자리는 `S.home.furniture[uid] = {x, z, rot, y}` 다.
`save.js`·`state.js` 가 이미 `y` 를 왕복시키고, `deserialize(raw, {light})` 가
조도 창에 직접 얹는다. 세이브 왕복이 저절로 따라온다(검사 `⑤`·`⑤-b`·`⑤-c`).

### 2-6. 바 등 — **목록에도 없고, 던지기도 한다**

겨누기(`setLampAim`)와 **같은 규약**을 그대로 썼다:

- `lamps()` 에 안 나온다 → 화면이 손잡이를 아예 안 그린다 (평소 경로)
- `commitLampAt` · `previewLampAt` 은 **던진다** → 배선이 틀렸을 때의 안전망

조용히 무시하면 화면은 손잡이를 보여 주는데 등이 안 움직이고, 세이브에 값이 남아
"옮겼는데 안 먹는" 상태가 굳는다.

---

## 3. `game.html` 이 부를 시그니처 — **코디네이터가 붙일 것**

`game.html` 은 한 글자도 안 건드렸다. 아래가 붙일 창구다.

### 3-1. 목록·현재 상태

```js
view.lamps()
// → [{ uid, preset, name, grow, x, y, z, rot, emitY,
//       mountId,            // 지금 물려 있는 상판. 없으면 null
//       lift,               // 그 상판에서 들어 올린 높이(m). 없으면 null
//       liftRange,          // { min, max } · 높이를 못 바꾸면 null
//       aimable,            // 겨눌 수 있나 (lampAim 손잡이를 그릴지)
//       moved }]
// ⚠ 바닥에 선 등(스탠드)은 여기 없다 — view.furniture() 몫이다
// ⚠ 붙박이 바 등도 여기 없다

view.lampMounts()
// → [{ mountId, uid, name, x, y, z, w, d, rot, slots:[slotId…] }]  y 오름차순
//   물릴 수 있는 상판 전부. 손잡이를 그릴 후보다

view.lampImmovableReason(uid)
// → null(옮길 수 있다) 또는 한국어 이유. "왜 회색인가"를 그대로 띄우면 된다
```

### 3-2. 끌고 놓기 — **가구 옮기기와 같은 손짓**

```js
view.lampFit(uid, pos)          // → { ok, reason, mountId, x, y, z, lift, emitY }
view.previewLampAt(uid, pos)    // → { uid, x, y, z, lift, mountId, ok, reason } | null
view.clearLampPreview()
await view.commitLampAt(uid, pos)   // → { uid, from, to, mountId, lift }  · 못 놓으면 reject
```

`pos` 는 둘 중 아무 쪽이나 준다:

```js
{ mountId: 'banjiha-sill@1.585', lift: 0 }      // 상판을 이름으로 고른다 (제일 확실)
{ x: 0, z: -1.95, lift: 0 }                     // 좌표로 고른다 (그 좌표를 품는 상판을 찾는다)
```

- `lift` 를 안 주면 0
- `rot` 를 주면 90° 단위로 스냅한다(가구와 같은 규약, 도(°))
- `previewLampAt(uid, null)` 이면 유령을 지운다. 유령은 **가구 유령과 같은 것**이라
  파랑(놓을 수 있다)·빨강(못 놓는다)이 그대로다

⚠ **끄는 동안에는 `previewLampAt` 만** 부른다. `commitLampAt` 은 손 뗄 때 한 번이다
(방을 통째로 다시 조립한다 — 가구와 같다).

### 3-3. 세이브에 적기 — 가구와 **같은 줄**

```js
import { setFurniturePlacement } from './src/game/state.js';

const r = await view.commitLampAt(uid, pos);
setFurniturePlacement(S, r.uid, r.to);       // {x, z, rot, y} 가 그대로 들어간다
```

읽을 때는 아무것도 안 해도 된다 — `deserialize(raw, { light })` 가
`light.setFurnitureOverrides(S.home.furniture)` 를 알아서 얹는다.

### 3-4. 옮긴 뒤 밝기 다시 재기

```js
view.lightRigs()          // 등의 **지금 자리**. 조도 계산(ppfdSum)이 쓰는 것과 같은 좌표다
engine.dliAt(point, opt)  // "여기 놓으면 얼마나 밝나"
```

`commitLampAt` 이 조도 엔진의 덮어쓰기 표를 고치고 방을 다시 지으므로,
**화면과 계산이 갈릴 틈이 없다.** 검사 `E-b`·`E-c` 가 그걸 못 박는다.

---

## 4. 회귀 — 아무것도 안 옮기면 **한 톨도 안 바뀐다**

반지하 14칸 × 등 0/1/2개의 PPFD·DLI 를 허용치 **없이** 비교한다
(`assert` 가 아니라 `===` 다 — 마지막 자리가 흔들려도 잡힌다).
`tools/test_lampaim.mjs` §① 과 **글자 그대로 같은 표**를 두 검사가 각자 지킨다 —
한쪽만 고쳐서 통과시키는 길을 막으려고 일부러 두 벌을 뒀다.

| 자리 | PPFD 등0/1/2 | DLI 등0/1/2 |
|---|---|---|
| `banjiha-sill:0` | 0 / 8.195413 / 9.068633 | 4.8 / 5.15 / 5.19 |
| `banjiha-desk:0` | 0 / 11.45266 / 28.997637 | 0.61 / 1.1 / 1.86 |
| `banjiha-desk:1` | 0 / 3.500658 / 26.6363 | 0.17 / 0.32 / 1.32 |
| `banjiha-dresser:0` | 0 / 1.497063 / 2.675664 | 0.08 / 0.14 / 0.19 |
| `banjiha-dresser:1` | 0 / 1.081963 / 1.79312 | 0.05 / 0.1 / 0.13 |
| `banjiha-etagere:0` | 0 / 17.485103 / 19.052515 | 0.13 / 0.89 / 0.95 |
| `banjiha-etagere:1` | 0 / 18.867116 / 20.85616 | 0.14 / 0.95 / 1.04 |
| `banjiha-etagere:2` | 0 / 17.485103 / 20.061482 | 0.13 / 0.88 / 0.99 |
| `banjiha-etagere:3` | 0 / 39.495924 / 41.213474 | 0.23 / 1.94 / 2.01 |
| `banjiha-etagere:4` | 0 / 47.3445 / 49.588241 | 0.22 / 2.27 / 2.37 |
| `banjiha-etagere:5` | 0 / 39.495924 / 42.530647 | 0.21 / 1.92 / 2.05 |
| `banjiha-etagere:6` | 0 / 126.779329 / 128.591455 | 0.51 / 5.98 / 6.06 |
| `banjiha-etagere:7` | 0 / 273.707829 / 276.11858 | 0.48 / 12.31 / 12.41 |
| `banjiha-etagere:8` | 0 / 126.779329 / 130.135417 | 0.48 / 5.95 / 6.1 |

**옮긴 뒤 되돌려도 이 표로 정확히 복귀한다**(검사 `④`).
등을 안 켜면(등 0개) 옮겨도 자연광 그대로고, 바 등만 켜면(등 1개) 아무것도 안 바뀐다
(검사 `②-b`·`②-c`) — 옮긴 것이 집게등뿐이라는 증거다.

---

## 5. 못 한 것 · 남긴 것

- **스탠드등을 실제 방에서 못 재 봤다.** `data/house_rooms.json` 어느 방에도
  `growlight_stand` 가 없다. 검사는 자기 자료로 하나 놓아 보고 **구조**만 확인한다
  (바닥에 선다 · `furnNodes()` 조건을 만족한다 · `movable` 이 rig 까지 온다).
  가게에서 스탠드를 살 수 있게 되면 그때 실제 값을 재야 한다.
- **바닥에 선 등의 `liftRange` 는 아무도 안 쓴다.** `lamps()` 가 rider 만 내므로
  스탠드의 `adjustable_height`(= 팔 높이)는 지금 화면에 손잡이가 없다.
  스탠드가 방에 들어오는 날 `furniture()` 쪽에 높이 손잡이를 붙이면 된다.
- **끌기 좌표는 상판 발자국을 바닥에 투영한 것으로 잡힌다.** 창턱은 뒷벽에 붙어 있어
  바닥 레이캐스트로는 겨냥하기가 까다롭다 — 그래서 `lampMounts()` 를 같이 낸다.
  화면은 상판을 **눌러서 고르는** 쪽이 편할 것이다(`{mountId, lift}`).
- **집게등이 물릴 자리는 「화분 상판」과 같다.** 화분 슬롯을 안 내는 가구
  (침대·서랍 앞면 등)에는 못 문다. 그게 맞다고 보지만, 나중에 "선반 옆 기둥"
  같은 자리를 원하면 그때 `plantSlots` 말고 다른 목록이 필요해진다.

---

## 6. 돌리는 법

```bash
node tools/test_lampmove.mjs                      # 1부(조도)만 — 브라우저 없이 18건

python tools/serve.py 8967
BYEOT_URL=http://localhost:8967 node tools/test_lampmove.mjs    # 1부+2부 32건
```

⚠ `BYEOT_URL` 을 안 넘기면 2부를 **건너뛴다.** 다른 창들이 8960·8969·8971·8973·8977·
8979·8981·8987·8993·8995 를 쓰고 있어서, 기본 포트에 붙으면 **남의 코드를 재게 된다.**
안 재는 편이 낫다고 보고 건너뛰게 했다(건너뛴 사실을 크게 찍는다).

---

## 7. 이 창의 작업 환경에 대해

이 워크트리는 시작 시점에 `main` 보다 **6 커밋 뒤**였다(`BACK_REFLECT` 가 없었다).
merge·rebase·reset 이 금지라, `git archive main` 으로 임시 폴더에 main 트리를 펴고
거기서 고치고 재고 검사를 돌렸다. 최종 파일만 이 워크트리에 옮겨 커밋한다.

⇒ 이 브랜치의 `src/render3d/house.js` · `data/furniture_presets.json` 은
**main 의 내용 + 이 작업분**이다. `main` 에 얹으면 그대로 맞다.
`src/game/room_view.js` 는 main 과 이 워크트리가 원래 같았다.

검사는 전부 main 트리 위에서 돌렸다 — `tools/test_*.mjs` **30개 전부 통과**
(`BYEOT_URL=http://localhost:8967`).
`test_roomview_walk` 는 이 작업 전부터 간헐적으로 흔들린다(단독으로 돌리면 통과).
이미 `multisiru-to-plan.md` · `musun-to-plan.md` 에 같은 내용이 적혀 있다.
