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

| band | 구간 | ko |
|---|---|---|
| `die` | die 미만 | 고사 |
| `weak` | die~survive | 쇠약 |
| `survive` | survive~min | **정체** (죽진 않는데 새 잎이 안 남) |
| `slow` | min~best_lo | 느림 |
| `best` | best_lo~best_hi | 최적 |
| `good` | best_hi~max | 성장 |
| `over` | max 초과 | 과광 |

### ★★ 생장 창 필수 요구사항 — 하루치로 생사 판정하지 말 것

날씨가 매일 굴러가면 반지하 산세는 **맑은 날 0.55(정체) ↔ 흐린 날 0.14(고사 밴드)** 를 오갑니다.
하루 값으로 죽이면 **운으로 죽습니다.**

**`die` 판정은 최소 5~7일 이동평균으로.** `band` 는 그날의 라벨일 뿐입니다.

### `overlight` ≠ `continuous_injury`

| | `overlight` (슬롯 필드) | `continuous_injury` (최상위) |
|---|---|---|
| 조건 | `dli > 식물.max` | 점등 22h 이상 |
| 원인 | 광량 초과 | 암기 없음 |
| **해법** | **차광**·거리 | **타이머** |

둘은 독립적으로 동시에 발생합니다. 합치면 안 됩니다.

---

## 방별 실측 (맑음·여름, 차광 없음)

| 방 | 슬롯 | 최고 DLI | ≥3 자리 | ≥6 자리 | <0.3 자리 |
|---|---|---|---|---|---|
| 반지하 | 13 | 0.55 | 0 | 0 | **9** |
| 원룸 | 11 | 4.77 | 3 | 0 | 1 |
| 투룸 | 20 | 5.64 | 3 | 0 | 5 |
| 학원교실 | 32 | 5.49 | 10 | 0 | 8 |
| 아파트 | 83 | 6.02 | 46 | 1 | 23 |
| 온실 | 64 | 12.42 | 50 | 36 | 9 |

계절·날씨는 `sky.evMax` 계수로 곱해집니다 — 겨울은 여름의 약 37%
(세기 0.55 × 낮 길이 9.8/14.5).

---

## 미해결

- [ ] **아파트 ≥6 자리가 1개뿐**입니다. "갈라진 잎은 아파트부터"를 살리려면
      발코니 선반을 창에 5cm 더 붙이면 됩니다(그러면 18개). 밸런스 결정 대기
- [ ] `temp` / `humidity` / `weatherPattern` 은 자리만 있습니다.
      `null` 이면 생장 창은 계수 1.0으로 두고 넘어가야 합니다
- [ ] 자동 블라인드(`shading_presets.json`의 `blind_auto`)는 `mult:null` 입니다.
      목표 DLI를 맞추려면 런타임에서 배율을 정해야 하는데, 그 주체가 코어인지
      집 창인지 정해지지 않았습니다
