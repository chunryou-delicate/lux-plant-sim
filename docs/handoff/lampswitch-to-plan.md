# 등 스위치 — 손으로 켜고 끈다 · 켠 시간이 요금이 된다 — lampswitch → plan

**2026-08-08.** 박사님 지시 셋을 한 덩어리로 다뤘다.

> 등을 밤에만 자동으로 켜지는 게 아니라 **내가 등을 터치해서 켜고 끌 수 있게** 해줘.
> **전기세를 등 켜 둔 시간으로 하루에 부과되게** 해줘. **등 켰을 때 밝기를 살짝만 올려줘.**

고친 것은 `src/game/room_view.js` 하나다. 검사·측정 도구 둘을 새로 넣었다.
`game.html`·`loop.js`·`state.js`·`data/**`·`shop.js` 는 **한 글자도 안 건드렸다** — 그쪽이 붙일 것은 §4·§5 에 코드로 적었다.

검사: `tools/test_lampswitch.mjs` 38건 신규 전부 통과.
재는 도구: `tools/probe_lampswitch.mjs` (화면 밝기 + 추천 자리 DLI 를 **한 페이지에서 같이** 잰다).

---

## 0. 한눈에

| 지시 | 지금 상태 | 어디까지 됐나 | 남은 것 |
|---|---|---|---|
| ① 터치로 켜고 끈다 | ★ **된다.** 방에서 등을 누르면 켜지고 꺼진다 | 방뷰 혼자로 그림·시간까지 완결 | **DLI 는 아직 안 따라온다** — `S.lamps.count` 는 코어 것이다 (§5-1) |
| ② 켠 시간으로 전기세 | ☐ **재료까지.** 「몇 시간·몇 Wh 켰나」를 정확히 낸다 | `lampSwitches().wh` | 지갑에서 빼는 것은 `loop.js` 몫 (§4-3 · §5-2) |
| ③ 켰을 때 살짝 밝게 | ★ **된다.** 등 아래 밤 **+89%** · 화면 전체 **+3.4%** | 잰 값 §3 | 없음 |

**이번에 알아낸 가장 큰 것** — 지금까지 **식물등은 켜고 끄는 손이 아예 없었고, 화면에서는 언제나 켜져 있었다.**
등 2개를 켜도 화면 평균 밝기가 `75.23 → 75.26`(**+0.0%**)이었다. 같은 조작으로 DLI 는 `0.48 → 12.41` 로 뛴다.
박사님이 "숫자만 바뀌고 눈에 잘 안 든다"고 하신 것이 이것이고, **원인이 둘이었다**(§2).

---

## 1. 먼저 — 지금 무엇이 어떻게 돌고 있었나 (읽고 적은 것)

### 1-1. 「등 몇 개·몇 시간」의 정본은 `S.lamps` 하나다

```
src/game/state.js:80      lamps: { count: 0, litHours: 12, aim: {} }
```

| 칸 | 누가 쓰나 | 무엇이 되나 |
|---|---|---|
| `count` | `light_adapter.rigsOn(count)` → `room.growRigs.slice(0, count)` | **조도**. 앞에서부터 n개를 켠 것으로 친다 |
| `litHours` | `light_adapter.ctxFor(…, litHours)` → `buildDailyLight` | **조도**(등 몫 DLI) + **요금 표시**(`report.energy`) |

★ 이 계약에는 **「어느 등인가」를 담을 칸이 없다.** `slice(0, count)` 라 순서가 곧 신원이다.
   등 겨누기(`lamps.aim`)는 uid 별 표를 따로 가지지만 켜짐은 그렇지 않다.

### 1-2. 화면(`room_view.setGrowLights`)은 **메시만** 숨겼다

```
game.html:4130 (syncRoom)   roomView.setGrowLights(S.lamps.count || 0)
```

`setGrowLights(n)` 은 앞에서부터 n개만 남기고 가구 그룹을 `visible=false` 로 둔다.
그런데 **광원 PointLight 는 그 그룹 안에 없다** —

```
src/render3d/house.js:828   furnGroup.add(L);     // ← 개별 가구 그룹 g 가 아니라 방 전체 컨테이너
```

⇒ 안 산 등도, 끈 등도 **계속 방을 밝히고 있었다.**

### 1-3. 게다가 식물등은 「자동」조차 항상 켜짐이었다

```
src/game/room_view.js (옛)   const want = r.grow ? (r.schedule && r.schedule !== 'off') : lampsOn;
```

`schedule` 은 `data/house_rooms.json` 에 박힌 `photo12`·`photo16` 이라 **언제나 참**이다.
「밤에만 자동」은 **생활등(천장등·플로어)** 쪽 규칙이었고, 식물등은 24시간 켜져 있었다.

### 1-4. 전기세는 **두 벌**이고 지갑에 닿는 것은 한 벌이다 (lampecon 창이 잡은 그대로)

| 어디 | 식 | 지갑 |
|---|---|---|
| `tutorial.lampElectricityWon` (`src/game/tutorial.js:160`) | `lampWatt(12 고정) × count × litHours × 160원` | **뗀다** |
| `daily_light.js:240` `report.energy.won` | `profile.lampWatts × litHours × tariff` | `loop.js:809` — *"표시만. 차감 없음"* |

```
src/game/loop.js:453   lampCount: (S.lamps && S.lamps.count) || 0,
src/game/loop.js:454   lampHours: (S.lamps && S.lamps.litHours)
src/game/loop.js:809   S.ledger.electricityWon += (report.energy && report.energy.won) || 0;   // 표시만
```

⚠ 와트가 두 벌에서 다르다. 코드는 **12W 고정**, 방에 실제로 달린 것은 **바 20W · 집게 12W** 다
(`data/lighting_presets.json` — 읽기만 했다).

### 1-5. 시계는 이미 있다 — 「켠 시간」을 셀 자가 있었다

```
game.html:5344  DAY_SWEEP_MS = 1600        빨리감기: 하루 = 1.6초
game.html:5391  IDLE_SWEEP_MULT = 90       평소:    하루 = 144초
game.html:5366·5425  roomView.setDaylight(dayPhase)     dayPhase 0..1 = 하루 중 언제인가
```

⇒ **게임 시각이 방뷰로 계속 들어오고 있다.** 새 시계를 만들 필요가 없었다.

---

## 2. 무엇을 왜 그렇게 고쳤나

### 2-1. 켜짐의 정본을 **하나**로 모았다 — `lampIsOn(uid)`

| 등 | 무엇을 보나 |
|---|---|
| 손으로 만진 등 | 스위치 표 그대로 (켬/끔) |
| 안 만진 등 | **예전 자동 그대로** — 식물등은 `schedule`, 생활등은 밤에만 |
| 숨은 등(안 산 등) | **무조건 꺼짐** |

그리기(`applyDaylight`)도 시간 세기(`tickLampClock`)도 이 하나를 본다.
둘로 두면 「화면은 꺼졌는데 요금은 나오는」 상태가 생기고, 그건 아무도 못 찾는 유형의 고장이다.

### 2-2. 상태를 **방뷰에 두고 창구만 냈다** — 근거

`S.lamps` 안이 자연스러워 보이지만 **지금 계약이 담을 수 있는 모양이 아니다**(§1-1).
등마다 켜고 끄려면 uid 별 표가 필요한데, 그 칸을 방뷰가 새로 파서 세이브까지 하면
`S.lamps.count` 와 **두 정본**이 된다. 그래서 —

- 방뷰가 표를 **들고만** 있고 (`lampSwitches()` 로 읽고 `setLampSwitches()` 로 되돌린다)
- **세이브는 호스트가** 한다 (등 겨누기 `lamps.aim` 와 같은 규약)
- `state.js` 는 손대지 않았다. 코어가 할 일은 §5 에 적었다

### 2-3. 탭은 **화분 뒤 · 퍼지 앞**에 넣었다

`resolveTap` 우선순위: 캐릭터(정확) → **화분** → **등** → 캐릭터(퍼지) → 자리(퍼지) → 바닥

- 화분보다 뒤: 잎이 등 밑까지 자라면 물 주려는 손이 등에 먹힌다
- 퍼지보다 앞: **정확히 짚은 것이 대충 가까운 것을 이긴다**(이 목록의 원칙 그대로)
- 검사 `E-4` 가 이걸 지킨다 — 선반에 화분을 세우고 그 자리를 눌러 화분이 잡히는지 본다

⚠ **누르는 순간 방뷰가 먼저 켜고 끈다.** 호스트를 기다렸다 켜면 폰에서 한 박자 늦게 밝아진다.
  `onLampTap(uid, on, state)` 는 **알림**이다. 막을 일이면 `setLampOn(uid, !on)` 으로 되돌린다.

### 2-4. 켠 시간은 **게임 시각**으로 센다 — 실제 초가 아니다

`setDaylight(t)` 가 올 때마다 지나간 구간(`Δt × 24h`)을 켜져 있던 등에 더한다.
실제 초로 세면 빨리감기(하루 1.6초)와 평소(하루 144초)의 요금이 **90배 달라진다.**

⚠ 한 번에 **6시간을 넘게 뛰면 안 센다.** 그건 시계가 흐른 게 아니라 누가 시각을 옮긴 것이다
  (검수 도구가 그렇게 한다). 세면 요금이 지어내진다. 검사 `D-7`.

---

## 3. 잰 값

### 3-1. 등을 켜면 화면이 얼마나 밝아지나 — **고치기 전 / 후**

`tools/probe_lampswitch.mjs` · 반지하 · 390×844 dpr2 · 감마 후 휘도 0..255 · 식물등 2개(바+집게)

| | 화면 평균 | 방바닥 평균 | 등 아래 (바 / 집게) |
|---|---|---|---|
| **고치기 전** 등0 | 75.23 | 108.32 | 120.4 / 105.1 |
| **고치기 전** 등2 | 75.26 | 108.32 | 120.4 / 104.0 |
| 차이 | **+0.0%** | **+0.0%** | **+0.0% / −1.0%** |
| **고친 뒤** 등0 (낮 t=0.50) | 74.62 | 106.86 | 106.7 / 78.4 |
| **고친 뒤** 등2 (낮 t=0.50) | 75.63 | 109.24 | 128.6 / 118.6 |
| 차이 | **+1.4%** | **+2.2%** | **+20.5% / +51.3%** |
| **고친 뒤** 등0 (밤 t=0.90) | 41.82 | 34.74 | 43.5 / 34.4 |
| **고친 뒤** 등2 (밤 t=0.90) | 43.24 | 38.89 | 82.0 / 90.1 |
| 차이 | **+3.4%** | **+11.9%** | **+88.5% / +162%** |

★ 「살짝」의 뜻은 이것이다 — **방을 통째로 들어 올리는 게 아니라 등 밑에 웅덩이가 생기는 것.**
  화면 전체는 1.4~3.4% 밖에 안 움직이는데 등 아래는 20~162% 밝아진다.

### 3-2. 세기를 왜 0.34 로 골랐나 (식물등 광원만 조작한 훑기)

| 세기 | 낮 화면 | 낮 바닥 | 낮 등아래 | 밤 화면 | 밤 바닥 | 밤 등아래 | 탄 픽셀(≥240) |
|---|---|---|---|---|---|---|---|
| 0 (끔) | 74.65 | 106.83 | 103.2 / 78.2 | 41.85 | 34.76 | 43.5 / 34.3 | 0.65% / 0% |
| 0.20 *(예전 값)* | 75.25 | 108.27 | 117.5 / 104.0 | 42.72 | 37.29 | 67.8 / 70.3 | 0.65% / 0% |
| **0.34 (지금)** | **75.63** | **109.21** | **126.0 / 118.6** | **43.25** | **38.93** | **82.0 / 90.1** | **0.65% / 0%** |
| 0.60 | 76.26 | 110.86 | 139.5 / 140.3 | 44.14 | 41.72 | 103.8 / 118.9 | 0.66% / 0% |
| 1.00 | 77.09 | 113.13 | 155.7 / 164.0 | 45.29 | 45.56 | 129.2 / 149.4 | 0.66% / 0% |

**탄 픽셀이 0.65% 그대로다** — 방이 하얘지지 않는다. 위로 더 갈 여지는 있으나(§7-③),
「살짝」이 지시였으므로 웅덩이가 눈에 들되 화면 평균이 1~3%대에 머무는 자리로 잡았다.

### 3-3. ★★ 조도(DLI)는 **한 자리도 안 움직였다**

같은 도구가 같은 페이지에서 조도 엔진(`?engine=1`)으로 추천 자리 **14칸**을 같이 뽑았다.
고치기 전/후, 그리고 **등을 손으로 껐다 켰다 한 뒤**에도 소수 넷째 자리까지 같다
(검사 `F-2`·`F-3`).

| 자리 | 등0 | 등2 |
|---|---|---|
| `banjiha-sill:0` | 4.80 | 5.19 |
| `banjiha-desk:0` | 0.61 | 1.86 |
| `banjiha-desk:1` | 0.17 | 1.32 |
| `banjiha-dresser:0` | 0.08 | 0.19 |
| `banjiha-dresser:1` | 0.05 | 0.13 |
| `banjiha-etagere:0` | 0.13 | 0.95 |
| `banjiha-etagere:1` | 0.14 | 1.04 |
| `banjiha-etagere:2` | 0.13 | 0.99 |
| `banjiha-etagere:3` | 0.23 | 2.01 |
| `banjiha-etagere:4` | 0.22 | 2.37 |
| `banjiha-etagere:5` | 0.21 | 2.05 |
| `banjiha-etagere:6` | 0.51 | 6.06 |
| `banjiha-etagere:7` | 0.48 | **12.41** |
| `banjiha-etagere:8` | 0.48 | 6.10 |

⇒ **그림과 계산은 갈라져 있다**(`test_ground` §I 와 같은 규약). 화면을 밝힌 것이 판정으로 안 샜다.

### 3-4. 켠 시간이 요금이 되면 얼마인가 (프리셋 값으로 센 것)

바 20W · 집게 12W · 단가 160원/kWh (`data/lighting_presets.json` — 읽기만 했다)

| 켠 것 | 켠 시간 | Wh | 하루 전기세 | *지금 코드(12W 고정)* |
|---|---|---|---|---|
| 없음 | 0h | 0 | **0원** | *0원* |
| 바만 | 12h | 240 | **38원** | *23원* |
| 바만 | 24h | 480 | **77원** | *46원* |
| 바+집게 | 12h | 384 | **61원** | *46원* |
| 바+집게 | 24h | 768 | **123원** | *92원* |

⚠ 요금 자체는 **여기서 안 낸다.** 방뷰는 `wh` 까지만 낸다 — 단가는 `data/balance` 계열이고
  밸런스는 plan 소유다. 방뷰가 요금을 지어내면 정본이 둘이 된다.

⚠ **이 값이 밸런스 손잡이가 되는지는 별개다.** `lampecon-to-plan.md` §3~4 가 이미 쟀다 —
  파산이 70일에 오고 이사는 161일이라 튜토의 절반 이상을 0원으로 산다. **0원인 날의 지출은
  clamp 가 삼킨다.** 켠 시간으로 매겨도 그 사실은 안 바뀐다(§7 판단 ①).

---

## 4. `game.html` 이 붙일 코드

`game.html` 은 조정 창 것이라 한 글자도 안 건드렸다. 아래를 그대로 붙이면 된다.

### 4-1. 방을 만들 때 — 알림 하나만 걸면 된다

`createRoomView(...)` 인자에 (지금 `onPlantTap` 이 있는 자리, `game.html:3904` 언저리):

```js
    /* ★ 등을 눌렀다 (2026-08-08 · lampswitch).
       ⚠ 방뷰가 **이미 켜고 껐다** — 여기는 알림이다. 여기서 할 일은
         「켜진 식물등 개수」를 코어 계약(S.lamps.count)에 맞추는 것뿐이다. */
    onLampTap: (uid, on) => { roomTapped(); syncLampsFromRoom(); },
```

### 4-2. 켜진 등 개수를 코어 계약에 맞춘다

```js
/* 방에서 켠 등 ↔ S.lamps.count 를 맞춘다.
   ⚠ 지금 계약은 「앞에서부터 n개」라 **어느 등인지는 못 담는다.** 첫 등을 끄고 둘째만 켜면
     개수는 1인데 엔진은 **첫 등**을 켠 것으로 센다 — 그림과 계산이 갈린다.
     그 어긋남을 없애는 것은 코어 몫이다(인계 §5-1). 그때까지는 개수만 맞춘다. */
function syncLampsFromRoom() {
  if (!roomView || !roomView.lampSwitches) return;
  const st = roomView.lampSwitches();
  const on = st.lamps.filter(l => l.grow && l.on).length;
  if (on === S.lamps.count) return;
  S.lamps.count = on;
  const sel = $('lamps'); if (sel) sel.value = String(on);
  io.light.clearCache();
  fillSlots(); draw();
}
```

⚠ 반대 방향(드롭다운 → 방)은 **이미 돈다.** `$('lamps').onchange` 가 `draw()` 를 부르고
  `draw() → syncRoom() → roomView.setGrowLights(S.lamps.count)` 로 이어진다(`game.html:4130`).
  이제 그 한 줄이 **광원까지** 끈다(예전에는 메시만 숨겼다 — §1-2).

### 4-3. 하루를 넘길 때 — 장부를 닫아 코어에 넘긴다

`[다음 날]` 처리 안, `io.loop.step(...)` 을 **부르기 전에**:

```js
/* ★ 켠 시간 장부를 닫는다. 이 값이 오늘 전기세의 재료다(인계 §5-2).
   ⚠ 지갑은 `S.tutorial.cashWon` 이고 거기 닿는 길은 `lampElectricityWon` 하나다 —
     코어가 §5-2 를 받기 전까지는 `S.lamps.litHours` 만 맞춰 둔다.
     그것만으로도 「점등시간을 줄이면 요금이 준다」가 오늘부터 성립한다. */
let lampBill = null;
try {
  lampBill = roomView && roomView.resetLampHours && roomView.resetLampHours();
  if (lampBill) {
    S.lamps.litHours = Math.max(0, Math.min(24, Math.round(lampBill.growLitHours)));
    S.lamps.wh = lampBill.growWh;        // ★ 코어가 §5-2 를 받으면 이 칸을 읽는다
    io.light.clearCache();
  }
} catch (e) { console.warn('[등] 켠 시간을 못 닫았습니다 —', (e && e.message) || e); }
```

그리고 턴이 끝난 뒤 표시용으로:

```js
if (lampBill) console.log(`[등] 어제 ${lampBill.wh}Wh (식물등 ${lampBill.growWh}Wh)`);
```

### 4-4. 세이브 왕복 (선택 — 코어가 칸을 내주기 전 임시)

```js
// 저장할 때
S.home.lampSwitches = roomView.lampSwitches().switches;     // { uid: true|false } — 만진 등만
// 방을 세운 뒤
try { roomView.setLampSwitches(S.home.lampSwitches || {}); }
catch (e) { console.warn('[등] 스위치 복원 실패 —', e.message); }   // 모르는 uid 면 통째로 던진다
```

### 4-5. 방뷰가 새로 내주는 창구 (전부)

```js
roomView.lampOn(uid)              // boolean
roomView.toggleLamp(uid)          // 뒤집는다 → 그 등 한 줄
roomView.setLampOn(uid, on)       // on=null 이면 「자동」으로 되돌린다. 모르는 uid 면 던진다
roomView.lampSwitches()           // 아래 모양
roomView.setLampSwitches(map)     // 전부 검사한 뒤 한 번에 얹는다(하나라도 틀리면 아무것도 안 바뀐다)
roomView.resetLampHours()         // 하루 닫기 — 마지막 장부를 주고 시간만 0으로(스위치는 남는다)
roomView.lightRigs()              // ★ uid·on 이 추가됐다

// lampSwitches() →
{
  room: 'banjiha',
  lamps: [{ uid, preset, name, grow, watts, hours, wh, on, manual, shown }],
  switches: { [uid]: true|false },     // ★ 만진 등만. 세이브에 그대로 넣는다
  wh, kwh, growWh,
  growLitHours,                        // 켠 식물등들의 시간 평균 = S.lamps.litHours 에 실을 값
  growOn                               // 켜진 식물등 개수 = S.lamps.count 에 실을 값
}
```

---

## 5. 코어가 할 일

### 5-1. ★★ `rigsOn` 을 **uid 집합**으로 받아야 한다 (제일 큰 것)

```
src/game/light_adapter.js:267   const list = room.growRigs.slice(0, Math.max(0, count | 0));
```

지금은 「앞에서부터 n개」다. 그래서 **첫 등을 끄고 둘째만 켠 상태를 계약이 표현할 수 없다.**
반지하에서 이게 실제로 문제가 되는 이유: 바(창턱 쪽 20W)와 집게(책상 쪽 12W)는
**비추는 자리가 완전히 다르다**(§3-3 표 — 집게만 켜면 `etagere:7` 12.41 이 안 나온다).

권하는 모양 — 지금 호출부를 안 깨면서 늘리는 길:

```js
/* light_adapter.js */
function rigsOn(sel) {
  const list = Array.isArray(sel)
    ? room.growRigs.filter(r => sel.includes(r.uid))      // ★ 새 길 — 어느 등인지 그대로
    : room.growRigs.slice(0, Math.max(0, sel | 0));       // 옛 길 — 그대로 둔다
  return list.map(r => { const a = lampAims[r.uid]; return a ? { ...r, aim: aimVector(a.yaw, a.tilt) } : r; });
}
```

그리고 `state.js` 에 칸 하나:

```js
/* state.js:80 */
lamps: { count: 0, litHours: 12, aim: {}, on: {} }    // on: { [uid]: true|false } — 만진 등만
```

`daily(day, S)` 는 `S.lamps.on` 이 비어 있으면 예전처럼 `count` 를 쓰고, 차 있으면 uid 목록을 쓴다.
그래야 옛 세이브가 안 깨진다.

### 5-2. 전기세를 **켠 시간**으로 지갑에서 뗀다 — 지갑은 `ts.cashWon` 이다

⚠ 먼저 사실 하나 — **`S.cashWon` 은 없다.** 지갑은 `S.tutorial.cashWon` 이고
(`tutorial.js:107`), `loop.js:809` 의 `S.ledger.electricityWon` 은 **표시용 누계**다
(`state.js:149` — *"경제는 3단계다. 표시만 하고 차감하지 않는다"*).
실제로 돈을 빼는 유일한 경로는 `tutorialDay → lampElectricityWon` 하나다(`tutorial.js:259`).
그러니 **켠 시간은 그 길로 흘려야** 지갑에 닿는다.

세 줄이면 된다.

```js
/* ① tutorial.js:160 lampElectricityWon — 재어 온 Wh 를 받으면 그것을 쓴다 */
export function lampElectricityWon(ts, opt = {}) {
  const R = ts.rules;
  /* ★ 화면이 실제로 잰 와트시가 있으면 **그것이 정본이다** (2026-08-08 · lampswitch).
     `ts.rules.lampWatt`(12W 고정)는 방에 달린 실제 와트(바 20W·집게 12W)와 다르다.
     안 넘어오면 예전 그대로 — 헤드리스 검사·옛 호출부가 안 깨진다. */
  if (Number.isFinite(opt.wh)) return Math.round((opt.wh / 1000) * R.kwhWon);
  … 이하 예전 그대로 …
}

/* ② tutorial.js:259 — 넘겨받은 것을 그대로 흘린다 */
const power = lampElectricityWon(ts, { count: opt.lampCount, litHours: opt.lampHours, wh: opt.lampWh });

/* ③ loop.js:454 자리 — 화면이 닫아 준 장부를 싣는다 */
lampHours: (S.lamps && S.lamps.litHours),
lampWh: (S.lamps && S.lamps.wh),          // ★ game.html 이 resetLampHours().growWh 로 채운다
```

그리고 `loop.js:809` 의 표시 누계도 같은 값을 보게 한다.

```js
/* src/game/loop.js:809 */
const wh = (S.lamps && Number.isFinite(S.lamps.wh)) ? S.lamps.wh : null;
S.ledger.electricityWon += wh != null
  ? Math.round((wh / 1000) * io.light.tariffWonPerKwh())
  : ((report.energy && report.energy.won) || 0);   // 방뷰가 없는 판(검사)은 예전 그대로
```

⚠ 단가 `160` 을 코어에 박지 마라. `data/lighting_presets.json` 의 `tariff.krw_per_kwh` 가 정본이고
  `light_adapter` 가 **이미 그 값을 읽고 있다**(`light_adapter.js:62` `const tariff = …`) —
  내주는 창구만 하나 열면 된다.

```js
/* light_adapter.js — return 블록에 한 줄 */
tariffWonPerKwh: () => tariff,
```

### 5-3. 와트가 두 벌인 것을 하나로

`tutorial.js:80` 의 `lampWatt: 12` 는 **고정값**이고 방에 실제로 달린 것은 바 20W·집게 12W 다
(`data/lighting_presets.json`). §5-2 ①처럼 Wh 를 받게 하면 두 벌이 하나가 된다.
`R.lampWatt` 는 **지우지 말고** 폴백으로 남겨 두는 것이 맞다 — 헤드리스 밸런스 검사에는
방뷰가 없어 Wh 가 안 온다.

### 5-4. `lamps.on` 을 세이브에 싣는다

`save.js` 의 `packLampAims` 와 같은 자리·같은 결이다. 그때까지는 §4-4 의 임시 왕복으로 돈다.

---

## 6. 고친 파일

| 파일 | 무엇 |
|---|---|
| `src/game/room_view.js` | §⑧-e 등 스위치 신설(`lampIsOn`·`setLampOn`·`toggleLamp`·`setLampSwitches`·`lampSwitches`·`resetLampHours`·`tickLampClock`) · `pickLampRay` 와 `resolveTap`·`onUp` 배선 · 그리기 루프가 `lampIsOn` 하나를 본다 · `setGrowLights` 가 광원까지 끈다 · `setDaylight` 이 켠 시간을 센다 · `lightRigs()` 에 `uid`·`on` 추가 · `RIG_GROW` 0.20 → **0.34** · 방을 갈아탈 때만 스위치를 비운다 · 호버 커서 |
| `tools/test_lampswitch.mjs` | 신규 — 38건 |
| `tools/probe_lampswitch.mjs` | 신규 — 화면 밝기 + 추천 자리 DLI 를 한 페이지에서 같이 잰다 |
| `docs/handoff/lampswitch-to-plan.md` | 신규 (이 문서) |

**안 건드린 것**: `game.html` · `src/game/loop.js` · `src/game/state.js` · `src/game/shop.js` ·
`src/game/tutorial.js` · `src/game/light_adapter.js` · `src/render3d/**` · `data/**` ·
`docs/GAME_PLAN.md` · `plant_grow.html`.

### 검사

**전체 41개(기존 40 + 새것 1) 전부 통과.**
`python tools/serve.py 8985` · `BYEOT_URL=http://127.0.0.1:8985 node tools/test_*.mjs` 한 벌씩.
(`test_cdp.mjs` 는 하네스라 안 센다.)

회귀로 제일 위험한 것들 — `test_roomview_walk` 44/44 · `test_roomview_place` 74/74 ·
`test_lampmove` 32/32 · `test_lampaim` 15/15 · `test_floorlight` 7/7 · `test_pots` 70/70 ·
`test_ground` 11/11 (★ §I 「자리별 DLI 가 한 톨도 안 바뀐다 — 14점 · 바뀐 것 []」) ·
`test_free_place`·`test_save`·`test_snap`·`test_tutorial` PASS · 새것 `test_lampswitch` 38/38.

`test_balance_routes` 의 내부 실패(5건)는 **작업 전과 같다** — 그 파일은 `room_profile.js` 를 쓰고
`room_view.js` 를 아예 안 부른다(`grep` 으로 확인). 밸런스가 아직 안 맞는다는 뜻이고 이 작업 것이 아니다.
프로세스 종료 코드는 41개 전부 0 이다.

---

## 7. 못 한 것 · 박사님 판단이 필요한 것

### ① ★ **끄면 요금이 주는데, 끄면 식물도 어두워져야 하는가** — 판단 필요

지금은 **등을 꺼도 DLI 가 안 준다**(§5-1 을 코어가 하기 전까지).
그래서 이대로 §4-3 만 붙이면 **「끄면 공짜로 요금만 준다」** 가 된다. 세 갈래다.

| | 어떻게 되나 | 값 |
|---|---|---|
| ㉠ 코어를 먼저 고친다(§5-1) | 끄면 요금도 빛도 준다. 제대로 된 손잡이 | 코어 창 작업 필요 |
| ㉡ `S.lamps.count` 만 맞춘다(§4-2) | 개수는 맞는다. **어느 등인지가 틀린다** — 집게만 켜도 엔진은 바를 켠다 | 화면 한 함수 |
| ㉢ 전기세를 나중에 붙인다 | 지금은 그림만. 요금은 코어 준비된 날 | 아무것도 안 함 |

**권하는 것은 ㉡ → ㉠** 이다. ㉡은 오늘 붙일 수 있고, 「끄면 어두워진다」가 개수 단위로는 맞는다.
반지하는 등이 둘뿐이라 실제로 어긋나는 경우는 **「둘째만 켜기」 하나**다.

### ② ★ 전기세가 밸런스 손잡이가 되는지는 **아직 안 풀렸다**

`lampecon-to-plan.md` §3~4 가 이미 쟀다 — 단가를 **60배**로 올려도 이사일이 하루도 안 움직였다.
지갑이 이미 비어 있어서(파산 70일 · 이사 161일) **0원인 날의 지출을 clamp 가 삼키기** 때문이다.
「켠 시간으로 매기기」는 그 사실을 안 바꾼다. 손잡이로 쓰시려면 **clamp 를 어떻게 할지**가 먼저다.
그건 이 창이 못 정한다.

### ③ 밝기를 더 올릴 여지는 있다 — 지금은 「살짝」에 맞춰 뒀다

세기 1.0 까지 가도 탄 픽셀이 0.66% 로 안 늘어난다(§3-2). 등 아래가 낮 156 · 밤 129 까지 간다.
지금(0.34)은 낮 126 · 밤 82 다. **더 원하시면 숫자만 바꾸면 된다** — 어디를 만지는지는
`room_view.js` 의 `RIG_GROW` 주석에 표째로 적어 뒀다.

### ④ 못 잰 것

- **폰 실기에서의 체감** — 못 쟀다. 헤드리스(SwiftShader)로만 쟀다. 화면 휘도 값은 같은 자로 잰 것이라
  비교는 유효하지만, 실제 폰 화면의 밝기·색온도는 다르다.
- **원룸·다른 방** — 반지하에서만 쟀다. `--room oneroom` 으로 같은 도구가 돈다.
- **생활등(천장등)을 손으로 켠 채로 둔 요금** — 셈은 돌지만(§3-4 표는 식물등만) 생활등 요금을
  물릴지 말지는 정한 바가 없다. 지금 `lampSwitches().wh` 는 **전부** 합친 값이고,
  식물등만은 `growWh` 다. 어느 쪽을 물릴지는 plan 이 고르면 된다.
- **하루를 안 닫고 며칠 켜 두면** — `resetLampHours()` 를 호스트가 안 부르면 시간이 계속 쌓인다.
  그건 「하루가 안 넘어갔다」는 뜻이라 맞는 동작이지만, 화면이 §4-3 을 안 붙이면 아무도 안 닫는다.
