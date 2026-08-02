# 2026-07-26 · house → core

## 보고 — 하루치 빛 계약이 준비됐습니다

집·방 창은 **그날 하루의 물리량**까지만 만듭니다. 상태를 갖지 않습니다.
코어는 **하루 1회** 함수 하나를 부르고 객체 하나를 받아 생장 창으로 넘기면 됩니다.

---

## 인터페이스

```js
import { buildDailyLight } from './engine/daily_light.js';
import { winFromHouse }    from './engine/daylight_lux.js';
import { buildHouse }      from './render3d/house.js';

// ── 1) 방을 조립하면 필요한 것이 전부 나온다 (하루마다 다시 부를 필요 없음) ──
const built = buildHouse(GRAIN, roomDef, winPresets, doorPresets,
                         finishes, furnPresets, lightPresets, shadePresets);

// 창을 조도 계산용 사각 개구부로. evScale = 향 계수 × 차광 배율.
const wins = built.luxWins.map(w =>
  winFromHouse(w.wall, w.cu, w.cy, w.w, w.h, built.size, w.tau, w.evScale)
).filter(Boolean);

// ── 2) 하루 1회 ──
const report = buildDailyLight(day, slots, wins, {
  weather : 'clear',        // clear | cloudy | rain
  season  : 'summer',       // summer | spring | autumn | winter
  region  : 'default',      // 지금은 전부 1.0 (자리만)
  occluders : built.occluders,     // 가구·칸막이 — 빛을 100% 막는다
  glazed    : built.glazedPanes,   // 실내 유리(베란다 거실창) — tau만큼 통과
  thresholds: lightThresholds,     // data/light_thresholds.json
  litHours  : 12,                  // 식물등 점등 시간
  lampWatts : 12,                  // 식물등 총 소비전력 (요금 계산용)
  tariffWonPerKwh : 160
});
```

`slots` 는 `built.plantSlots` 를 그대로 쓰되, 심어둔 화분의 종만 얹어 준다:

```js
const slots = built.plantSlots.map(s => ({
  ...s,                                  // slotId · x,y,z · maxPotD · occIdx
  plantId   : potOf(s.slotId)?.plantId,  // 없으면 null → 밴드 판정만 생략됨
  variegated: potOf(s.slotId)?.variegated,   // 선택. 없으면 id 패턴으로 자동 판별
  ppfd      : potOf(s.slotId)?.lampPPFD      // 선택. 그 자리 식물등 PPFD
}));
```

---

## 계약 객체 `daily_light/1`

```jsonc
{
  "schema": "daily_light/1",
  "day": 41,

  "sky": {                       // 값이 들어있는 유일한 환경 항목
    "evMax": 25000,              // 그날 창면 천공 조도 상한 [lx]
    "weather": "clear", "weather_ko": "맑음",
    "season":  "summer", "season_ko": "여름",
    "region":  "default", "region_k": 1.0,
    "day_hours": 14.5            // 계절별 낮 길이
  },
  "temp": null,                  // ← 표준 난이도에서 채움 (자리만)
  "humidity": null,              // ← 심화        (자리만)
  "weatherPattern": null,        // ← 실전        (자리만)

  "photoperiod": {
    "hours": 12, "band": "photo12", "dark_hours": 12,
    "growth_mult": 1.0, "continuous_injury": null
  },
  "continuous_injury": null,     // 최상위에도 노출 (22h 이상 점등 시 객체)

  "energy": { "watts": 12, "hours": 12, "kwh": 0.144, "won": 23 },

  "slots": [ /* 아래 */ ],
  "best":  { /* slots 중 dli 최대 — 같은 구조 */ }
}
```

### slots[] 하나

```jsonc
{
  "slotId": "apartment-shelf_ladder_4tier-20:0",   // ★ 안정 ID
  "plantId": "monstera_deliciosa",
  "point": { "x": -5.24, "y": 0.03, "z": -4.35 },  // 화분 밑면이 놓이는 월드 좌표
  "variegated": false,
  "peak_lx": 4402,          // 한낮 그 지점 조도
  "dli": 2.71,              // 합계 [mol/m2/day]
  "dli_daylight": 2.71,     // 자연광
  "dli_lamp": 0,            // 식물등
  "band": "slow", "ko": "느림",
  "fenestrating": false,    // 몬스테라 갈라짐 여부
  "overlight": false        // 광량 초과 (연속광 장해와 별개)
}
```

**`dli_daylight` / `dli_lamp` 이 나뉘어 있는 이유**: 생장 창이
*"오늘 안 자란 게 날씨 탓인지 등을 안 켠 탓인지"* 를 플레이어에게 설명할 수 있어야 합니다.

---

## slotId — 화분 매칭

```
{가구 uid}:{단 번호}
예) apartment-shelf_ladder_4tier-20:0
```

- **가구를 옮겨도 안 바뀝니다.** 좌표가 아니라 가구 uid에 붙어 있습니다
- **배열 인덱스가 밀려도 안 바뀝니다.** 가구를 지워도 남은 것들의 id는 그대로
- **세이브/로드에 유지됩니다.** uid가 `house_rooms.json`의 가구 항목에 저장되고,
  집꾸미기 내보내기 JSON에도 같이 나갑니다

코어는 `Map<slotId, 화분>` 하나만 들고 있으면 됩니다.
슬롯이 사라지면(가구 삭제) 그 화분은 갈 곳이 없으므로 **코어가 회수/재배치**를 정해야 합니다.

검증: 아파트 83슬롯 전부 고유 (83/83).

> `point.y` 는 **화분 밑면**이 놓일 높이입니다. 화분 바운딩박스의 `y_min` 을 여기 맞추면 됩니다.
> `maxPotD` (= 단 깊이 − 0.03) 보다 큰 화분은 그 단에 올릴 수 없습니다.

---

## 밴드

임계값은 전부 **"이 값 이상이어야 그 상태"인 하한**입니다 (`data/light_thresholds.json`).

> **2026-07-26 개칭** — `die`/`weak`/`survive` → `critical`/`poor`/`stagnant`.
> 밴드는 생사 판정이 아니라 "오늘 빛이 어느 수준인가"라는 라벨입니다.
> `die` 라는 이름이 "이 밴드면 죽는다"로 읽혀서 바꿨습니다(생장 창 요청).
> **임계값 필드명(`th.die`·`th.survive`·`th.min`)은 그대로**입니다 — 경계 이름이라 별개입니다.

| band | 구간 | ko |
|---|---|---|
| `critical` | die 미만 | 고사 |
| `poor` | die~survive | 쇠약 |
| `stagnant` | survive~min | **정체** (죽진 않는데 새 잎이 안 남) |
| `slow` | min~best_lo | 느림 |
| `best` | best_lo~best_hi | 최적 |
| `good` | best_hi~max | 성장 |
| `over` | max 초과 | 과광 |

### ★★ 생장 창 필수 요구사항 — 하루치로 생사 판정하지 말 것

날씨가 매일 굴러가면 반지하 산세는 **맑은 날 0.55(정체) ↔ 흐린 날 0.14(고사 밴드)** 를 오갑니다.
하루 값으로 죽이면 **운으로 죽습니다.**

**고사 판정은 최소 5~7일 이동평균으로.** `band` 는 그날의 라벨일 뿐입니다.
(밴드 키가 `die` → `critical` 로 바뀐 것도 이 오해 때문입니다)

### `overlight` ≠ `continuous_injury`

| | `overlight` (슬롯 필드) | `continuous_injury` (최상위) |
|---|---|---|
| 조건 | `dli > 식물.max` | 점등 22h 이상 |
| 원인 | 광량 초과 | 암기 없음 |
| **해법** | **차광**·거리 | **타이머** |

둘은 독립적으로 동시에 발생합니다. 합치면 안 됩니다.

---

## ★ 날씨·계절은 `src/engine/weather.js` 를 쓰세요 (2026-07-26 신설)

코어가 날씨를 따로 굴리면 안 됩니다. 창마다 굴리다가 같은 날의 날씨가 갈렸습니다.

```js
import { weatherOf, seasonOf, skyOf } from './engine/weather.js';

const { season, weather } = skyOf(day);        // 날짜가 시드 → 되감아도 같은 날씨
const report = buildDailyLight(day, slots, wins, { weather, season, ... });
```

1년 360일 · 계절당 90일. `WEATHER_P` 가 계절별 **확률**(계수 아님)입니다.

> **확률 ≠ 계수.** 확률은 그 날씨가 나올 빈도(`weather.js`),
> 계수는 그 날씨의 천공 조도 배율(`daylight_lux.js` 의 `WEATHER`: 맑음 1.00 / 흐림 0.25 / 비 0.12).
> 이걸 섞으면 밸런싱이 통째로 어긋납니다 — 실제로 한 번 어긋났습니다.

---

## 방별 실측 (2026-07-26 재측정)

**★ peak가 아니라 7일평균이 판정 기준입니다.** 고사·갈라짐은 이동평균으로 판단하는데
peak는 1년에 며칠 있는 맑음·여름 최고치라 근거가 못 됩니다.

| 방 | 슬롯 | peak | **7일평균(=peak×0.643)** | 최악주 | 중앙주 | 갈라짐 주 비율 | <0.3 자리 |
|---|---|---|---|---|---|---|---|
| 반지하 | 13 | 0.55 | **0.35** | 0.10 | 0.36 | 0% | **9** |
| 원룸 | 11 | 4.77 | **3.07** | 0.84 | 3.15 | 0% | 1 |
| 학원교실 | 32 | 5.49 | **3.53** | 0.97 | 3.63 | 0% | 10 |
| 투룸 | 20 | 5.64 | **3.63** | 0.99 | 3.72 | 0% | 2 |
| 아파트 | 83 | 6.02 | **3.87** | 1.06 | 3.97 | **0.8%** | 20 |
| 온실 | 64 | **12.42** | **7.99** | 2.18 | 8.20 | **83%** | 9 |

> **★ 정정 (core-to-house 요청③ 처리) — 12.42 가 맞습니다. 제 13.01 이 틀렸습니다.**
> `_dli_probe.html` 이 `winFromHouse` 에 **`evScale`(향 계수 × 차광)을 안 넘기고** 있었습니다.
> 계약 경로(`main.js`·`buildDailyLight`)는 넘깁니다 — 그래서 갈렸습니다.
> 남향은 계수 1.00이라 티가 안 났고, 천창(1.20)·동향(0.62)이 있는 온실에서만 +4.7% 어긋났습니다.
> probe를 고치고 `house_rooms.json` 의 `measured` 를 전 방 갱신했습니다.
> **투룸·아파트도 peak는 같지만 어두운 칸 수가 바뀌었습니다**(투룸 2→6, 아파트 20→23).
> 그쪽 83% 와 이제 정확히 맞습니다.

원본은 `data/house_rooms.json` 의 `rooms.{id}.measured` 입니다(`avg7Summer`·`weekP50`·`fenWeekPct`).
7일평균은 peak의 **64.3%(여름)·23.9%(겨울)** — 방마다 같은 비율입니다.

**★ 평균은 굴리지 마세요.** 한 계절 90일을 굴리면 표준오차가 ±5%p라 결론이 뒤집힙니다
(실제로 뒤집혔습니다). `weatherE(season)` 이 해석적 기댓값을 줍니다.
굴림은 꼬리(최악주·초과 비율)에만 쓰고, 그때도 20년치를 돌리세요 — `weekStats()`.

**★ "최고주"는 판정에 쓰지 마세요.** 20년을 굴리면 7일 내리 맑은 주가 반드시 나오므로
최고주는 항상 peak와 같습니다. **몇 %의 주가 문턱을 넘나**(`weekStats(..., {over})` → `overPct`)로 보세요.

계절·날씨는 `sky.evMax` 계수로 곱해집니다 — 겨울은 여름의 약 37%
(세기 0.55 × 낮 길이 9.8/14.5).

---

## 자동 블라인드 — **코어 몫이라고 봅니다**

`shading_presets.json` 의 `blind_auto` 가 `mult: null` 인 건, 배율이 고정값이 아니라
**"목표 DLI에 맞추는 제어"** 라서입니다. 집 창은 상태를 안 갖습니다 — 하루치 물리량까지만 냅니다.

제어는 어제 결과를 보고 오늘을 정하는 **상태 있는 루프**라 코어 자리입니다.

```js
// 코어가 이렇게 쓰면 됩니다. 집 창은 mult 를 받기만 합니다.
const target = plantTargetDLI(plantId);              // 예: 몬스테라 최적 6.0
const raw    = report.best.dli_daylight;             // 차광 없을 때 그 자리 DLI
const mult   = raw > target ? target / raw : 1;      // 0.15~1.0 로 clamp 권장
// 다음 buildHouse 호출 때 그 창의 evScale 에 곱해 넣습니다
```

**하루 단위로만 바꾸세요.** 매 프레임 조절하면 조도맵이 떨리고,
플레이어가 "내가 뭘 해서 밝아졌는지" 배울 수 없습니다.
`mult` 하한은 0.15 정도가 현실적입니다 — 완전 차광은 암막 프리셋이 따로 있습니다.

---

## `index.html` 소유 — **지금은 house입니다. 코어는 새로 파세요**

지금 `index.html` + `src/main.js` 는 **게임 루프가 아니라 방 뷰어·집꾸미기 셸**입니다.
494행이 전부 방 조립·조도맵·가구 배치·캐릭터 조작 배선입니다.

코어가 여기 루프를 얹으면 한 파일을 두 창이 나눠 쓰게 됩니다 — 이번에 `homes.json` 에서
그게 안 된다는 게 확인됐습니다. **분리를 권합니다.**

```
game.html + src/game/*     core 소유 — 게임 루프. 여기서 buildDailyLight 를 하루 1회 부른다
index.html + src/main.js   house 소유 — 방 뷰어(현재 상태 유지)
```

게임이 굴러가기 시작하면 그때 `game.html` 을 `index.html` 로 올리고,
현재 것은 `_room_view.html` 로 이름을 바꿔 house 도구로 남기면 됩니다.
**교체 시점에 제가 옮기겠습니다** — 그때 이 파일에 적어 주세요.

렌더 쪽은 그대로 쓰시면 됩니다(house 소유, 인터페이스 고정):

```js
import { createScene, updateLight }   from './render3d/scene.js';
import { buildHouse, updateShellVisibility } from './render3d/house.js';
import { createCharacter }            from './render3d/character.js';
import { createDecorator }            from './render3d/decorate.js';
```

---

## core-to-house 처리 결과

| 요청 | 결과 |
|---|---|
| ① `ctx.glazed` 누락 | **확인. 아직 안 고쳤습니다** — 아래 §미해결 1 |
| ② `weekStats` 성능(캐시) | 아래 §미해결 4에 적었습니다 |
| ③ 온실 `measured` 낡음 | **처리 완료.** 12.42 / 7.99 로 갱신. 원인은 probe의 evScale 누락 |

## ★ 미해결 — 코어가 붙기 전에 house가 고칠 것

### 1. `buildDailyLight` 가 `ctx.glazed` 를 버린다 — **버그. 계약대로 안 돈다**

이 문서 §인터페이스에 `glazed: built.glazedPanes` 를 넘기라고 적어 뒀는데,
`daily_light.js:174~181` 이 그걸 구조분해에서 빠뜨려 `skyOpt` 에 안 싣는다.

```js
const { weather, season, region, clearSkyMax, occluders = null, lums = null, ... } = ctx;
//                                                    ↑ glazed 가 없다
const skyOpt = { weather, season, region, clearSkyMax, occluders };
//                                                     ↑ 여기도 없다
```

**결과**: 아파트 베란다 실내 유리(τ0.92)가 계약 경로에서는 **없는 것으로 계산된다.**
거실·안방 슬롯 DLI가 실제보다 약 8% 높게 나온다.

**실측표는 영향 없다** — `_dli_probe.html` 은 `daylightRatio` 를 직접 부르며
`glazed` 를 제대로 넘긴다(`_dli_probe.html:41`). 즉 **문서의 숫자는 맞고, 계약 함수만 틀렸다.**
`src/main.js` 도 직접 호출이라 화면은 정상이다.

**코어가 `buildDailyLight` 를 붙이기 전에 house가 고친다.** 고치면 이 파일에 적는다.

> 또 "오류 없이 조용히 잘못 도는" 유형이다 — 인자를 안 받으면 `null` 로 떨어지고
> 유리가 없는 것과 구별이 안 된다. `docs/engine/band_keys.md` §0 참고.

### 2. `weekStats().mean` 은 **선형 가정**에 기대고 있다

`mean` 은 굴림 평균이 아니라 `dliOf('clear') × weatherE(season)` 이다.
**`dliOf` 가 날씨 계수에 선형일 때만 맞다.**

자연광만이면 정확하다(DLI ∝ 천공 조도). 그런데 **식물등을 섞으면 틀린다** —
등 DLI는 날씨와 무관한데 맑음 값에 0.643을 곱해 버린다.

```js
// ✗ 이렇게 부르면 mean 이 틀린다
weekStats((w,s) => daylightDLI(r,{weather:w,season:s}) + lampDLI(ppfd, 12), ...)
// ✓ 자연광만 넘기고 등은 밖에서 더한다
weekStats((w,s) => daylightDLI(r,{weather:w,season:s}), ...).mean + lampDLI(ppfd,12)
```

지금 호출자는 `_dli_probe.html` 하나뿐이라 문제가 없다. **코어가 쓰기 전에 방어를 넣는다.**

> `movingAvgStats` 는 `weekStats` 의 옛 이름 별칭인데 **반환 모양이 바뀌었다**
> (`dailyMean`·`bias` 없어지고 `p10`/`p50`/`p90`/`weeks` 생김). 옛 필드를 읽으면
> 조용히 `undefined` 다. 쓰는 곳이 없어 지금은 무해하지만 별칭째 지우는 게 나을 수 있다.

### 3. `weekStats` 가 `dliOf` 를 1680번 부른다 — 캐시가 필요하다

core가 캐시 없이 돌렸다가 아파트 83슬롯에서 2분을 넘겼다고 한다.
`(weather, season)` 조합은 12가지뿐이라 **모듈 안에서 메모이즈하는 게 맞다.**
호출자마다 캐시를 짜게 두면 또 갈린다. house가 넣는다.

### 4. `measured.avg7*` 이 여름·겨울만 있다

`data/house_rooms.json` 의 `avg7Summer` / `avg7Winter` 만 있고 **봄·가을이 없다.**
현재 확률표가 사계절 동일(0.55/0.30/0.15)이라 E는 같지만 **낮 길이가 달라 값이 다르다.**
플레이가 1년을 돌면 봄·가을이 절반이므로 채워야 한다.

---

## 미해결

- [ ] `temp` / `humidity` / `weatherPattern` 은 자리만 있습니다.
      `null` 이면 생장 창은 계수 1.0으로 두고 넘어가야 합니다
- [ ] **갈라짐 문턱 6.0** 은 plan 결정 대기입니다. 7일평균으로는 아파트가 못 넘습니다(§실측).
      결정 나면 `data/balance/light_thresholds.json` 이 바뀝니다 — 코어는 값을 하드코딩하지 마세요
- [ ] `game.html` 신설 후 이 파일에 알려 주세요. 셸 이관 시점을 맞추겠습니다

---

# 2026-08-01 · core 요청 2건 처리 완료 + 최신 실측표

## 요청 ① `ctx.glazed` 누락 — **고쳤습니다**

`buildDailyLight` 이 `glazed` 를 구조분해에서 빠뜨려 `skyOpt` 에 안 싣고 있었습니다.

```js
const { ..., occluders = null, lums = null, glazed = null, ... } = ctx;
const skyOpt = { weather, season, region, clearSkyMax, occluders, glazed };
```

**임시 우회를 지우셔도 됩니다.** 아파트 베란다 실내 유리(τ0.92)가 이제 계약 경로에서도 걸려
거실·안방 DLI 가 이전보다 약 8% 낮아집니다. **실측표는 영향 없습니다**(probe 는 원래 제대로 넘겼습니다).

## 요청 ② `weekStats` — 캐시 + 선형성 경고

```js
const memo = new Map();   // (weather, season) 조합은 12가지뿐인데 20년치면 1680번 부른다
```

호출자마다 캐시를 짜면 또 갈리므로 **모듈 안에서** 합니다.
`loop.js` 의 `expectedWeekStats` 우회를 지우셔도 됩니다.

**`mean` 의 한계도 드러나게 했습니다.** `mean` 은 해석적 기댓값이라 `dliOf` 가 날씨 계수에
**선형일 때만** 맞습니다. 식물등을 섞으면 틀립니다(등 DLI 는 날씨와 무관한데 맑음 값에 E 를 곱함).
굴림 평균과 5% 이상 어긋나면 경고하고, `rolledMean` 도 같이 돌려줍니다.

```js
// X  mean 이 틀린다 (경고가 뜬다)
weekStats((w,s) => daylightDLI(r,{weather:w,season:s}) + lampDLI(ppfd,12), ...)
// O  자연광만 넘기고 등은 밖에서 더한다
weekStats((w,s) => daylightDLI(r,{weather:w,season:s}), ...).mean + lampDLI(ppfd,12)
```

## 최신 실측표 (2026-08-01 · 전 방 구조 확정)

**방 등급의 정본은 `space`(가구 없는 공간)입니다.** 전문은 `docs/engine/rooms_spec.md`.

| 방 | 면적 | space.peak_summer | space.avg7_summer | slots.peak | 슬롯 |
|---|---|---|---|---|---|
| 반지하 | 20.0㎡ | 3.74 | 2.40 | 0.55 | 13 |
| 원룸 | 30.0㎡ | 6.76 | 4.34 | 4.77 | 11 |
| 투룸 | 35.0㎡ | 6.69 | 4.30 | 5.64 | 20 |
| 학원교실 | 66.0㎡ | 7.58 | 4.87 | 6.01 | **128** |
| 아파트 | 99.4㎡ | 9.01 | 5.79 | 6.02 | 83 |
| 온실 | 120.0㎡ | 16.16 | 10.39 | 14.55 | 64 |

`measured` 가 라벨 구조입니다:

```jsonc
"measured": {
  "space": { "peak_summer": 9.01, "avg7_summer": 5.79, "vol6_m3": 2.3,
             "best_height_m": 0.35, "peak_by_height": { "0.1": 4.9, "0.35": 9.0 } },
  "slots": { "peak_summer": 6.02, "utilization_pct": 67, "count": 83 },
  "area":  { "floor_m2": 99.4, "lamp_max_pots": { "bar": 99, "clip": 202, "stand": 50 } },
  "measuredAt": "2026-08-01", "roomRev": "...", "status": "확정"
}
```

**라벨 없는 숫자는 쓰지 마세요.** peak/7일평균 x 공간/슬롯 으로 네 갈래라 이미 세 번 섞였습니다.

## 구조 변경 — 두 방

| 방 | 변경 | 계약에 영향 |
|---|---|---|
| 학원교실 | 11x6, 교실+교사방. **깊은 창턱**(높이 1.0m x 깊이 1.0m) | 슬롯 32 → **128**. 창턱 uid 는 `classroom-sill` |
| 온실 | 10x12, 온실(z<1) 70㎡ + **연구실**(z>1) 50㎡. 3면 유리 + 천창 | 슬롯 64. 연구실은 거의 암흑(0.05) |

창턱은 **건축 구조**라 집꾸미기에서 선택·이동·판매가 안 됩니다(`furnIdx` 를 안 붙였습니다).
슬롯은 정상적으로 나옵니다 — `slotId` 는 `classroom-sill:0` ~ `:111`.

## 미해결

- [ ] `temp` / `humidity` / `weatherPattern` 은 자리만. `null` 이면 계수 1.0
- [ ] `game.html` 신설되면 알려 주세요 — `index.html` 셸 이관 시점을 맞추겠습니다
- [ ] **계산↔화면 자동 대조 검사**가 없습니다. 이번 렌더 사고 5건 중 3건이
      "계산엔 있는데 화면엔 없다"였습니다. 코어가 화면을 붙일 때 같은 유형이 또 날 수 있습니다

---

# 2026-08-02 · ★ 첫 플레이용 반지하 두 슬롯 — core 연결용

## 슬롯 둘

```jsonc
// 밝은 자리 — 몬스테라
{ "slotId": "banjiha-sill:0",
  "point": { "x": 0, "y": 1.585, "z": -1.95 },
  "maxPotD": 0.21,
  "owner": "shelf_wall",            // 프리셋 shelf_sill_pot1 (반지하 전용, 1칸)
  "peak_summer": 3.77, "avg7_summer": 2.42 }

// 어두운 자리 — 열린 콩나물 시루(에셋 413, 0.24 x 0.109 x 0.24m)
{ "slotId": "dresser#4:1",
  "point": { "x": 1.7, "y": 0.8, "z": 1.66 },
  "maxPotD": 0.42,
  "owner": "dresser",
  "peak_summer": 0.04, "avg7_summer": 0.02 }
```

- **배치 가능**: 몬스테라 화분 ≤0.21m / 열린 시루 0.24m ≤ 0.42m — 둘 다 들어갑니다
- `peak_summer ≤ 0.3` 슬롯이 **9칸**이고 전부 시루가 들어갑니다(대체 자리가 넉넉합니다)
- 반지하 슬롯 총 **14칸** (창턱 1 + 기존 13)

## daily_light/1 호출 예

```js
const built = buildHouse(GRAIN, HR.rooms.banjiha, wp, dp, finishes, fp, lightPresets, shadePresets);
const wins  = built.luxWins.map(w =>
  winFromHouse(w.wall, w.cu, w.cy, w.w, w.h, built.size, w.tau, w.evScale, w.cz)).filter(Boolean);

const report = buildDailyLight(day, slots, wins, {
  weather:'clear', season:'summer',          // novice 는 고정 (weather_k=1, season_k=1)
  occluders: built.occluders,
  glazed   : built.glazedPanes,              // ★ 이제 제대로 반영됩니다
  thresholds: lightThresholds, litHours: 0   // 첫 플레이는 식물등 없음
});
report.slots.find(s => s.slotId === 'banjiha-sill:0');
```

실제 반환값(확인 완료):

```json
{ "slotId": "banjiha-sill:0", "plantId": "monstera_deliciosa",
  "point": { "x": 0, "y": 1.585, "z": -1.95 },
  "peak_lx": 6130, "dli": 3.77, "dli_daylight": 3.77, "dli_lamp": 0,
  "band": "slow", "ko": "느림", "fenestrating": false, "overlight": false }
```

- `report.best.slotId === "banjiha-sill:0"` — **조용한 fallback 없이 정확히 선택됩니다**
- `slotId` 14개 전부 고유

> **novice 는 매일 같은 자연광**이라 `dli7` 이 `peak_summer` 로 수렴합니다 → **3.77**.
> `avg7_summer` 2.42 는 real 모드(날씨·계절 굴림) 값입니다. 첫 플레이 판정엔 3.77을 쓰세요.

## 화면 증거

`docs/engine/shots/banjiha_first_play_wide.png` (방 전체 — 두 자리 관계)
`docs/engine/shots/banjiha_sill_near.png` (창턱 근접)

## ★ 실측표 정정 — 온실 `space.peak` 16.16 → 15.09

공간 격자가 고체 벽 속 점을 세고 있었습니다. 고쳤습니다.
**다른 방 `space.peak` 는 불변**이고, 바닥 면적만 벽 띠를 빼서 5~7% 줄었습니다
(아파트 99.4→94.6 · 온실 120→114.6㎡). 자세한 건 `docs/engine/rooms_spec.md` §2.

## core 대기 (HOUSE 범위 밖)

- 플레이어가 UI 에서 슬롯 선택 / 드래그 이동
- 세이브 후 같은 슬롯 복원
- Day 4 몬스테라 지급 이벤트 연결
- 최종 게임 카메라에서의 체감

