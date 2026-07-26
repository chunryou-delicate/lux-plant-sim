# 게임 루프 명세 — 코어 창 인계 (2026-07-26)

> ⚠ **→ [GAME_PLAN.md](GAME_PLAN.md)로 통합됨 (2026-07-26).**
> 정본은 GAME_PLAN.md다. 이 문서는 근거·유도 과정 보관용이며 **여기서 기획을 고치지 말 것.**


> **이 문서는 인계용 명세다. 이 창(생장)은 루프를 만들지 않는다.**
> 코어 창이 `src/game/` 아래 자기 파일만 만들고, 남의 파일은 **함수 호출만** 한다.

---

## 0. 현황 — 양끝만 있고 중간이 없다

| 구간 | 상태 |
|---|---|
| 집/방 창 — 슬롯별 DLI → 계약 객체 `daily_light/1` | ✅ `buildDailyLight()` |
| 생장 창 — 계약 객체 받아 확률에 반영 | ✅ `setDailyLight()` + `calc*()` |
| **중간 — 이걸 순서대로 부르는 루프** | ❌ **없음** (`src/`에 게임 루프 파일 자체가 없다) |
| 경제 — 식비·월세·전기 차감 | ❌ 없음 (전기는 `energy.won`으로 **계산만** 되어 실려 온다) |

**조도에 그렇게 공들였는데 아직 아무것도 자라지 않고 있는 이유가 이것 하나다.**

---

## 1. 턴 진행 순서 (1턴 = 1 게임일)

```
nextDay(S):
  1. S.day++
  2. 날씨 굴림        S.weather = rollWeather(S.day, S.season)
  3. 조도 계산        report = buildDailyLight(S.day, slots, wins, ctx)   ← 집/방 창 함수
  4. 개체별 전달      각 화분 p: setDailyLight(report, p.slotId)          ← 생장 창 함수
                     → p.growthDay += 1 × photoperiod.growth_mult × 밴드계수
  5. 누적 판정        이동평균으로 고사/쇠약/황변 (§4)
  6. 수확 판정        작물: 성숙 턴 도달 → 끼니/판매품 산출
  7. 지출 차감        월세/30 + utility/30 + 식비 + report.energy.won
  8. 수입 반영        판매·수확
  9. 저장             S를 localStorage
```

**순서가 고정이다.** 특히 **3 → 4 → 5**: 조도 계산이 개체 전달보다 먼저고,
누적 판정은 전달 뒤다. 4와 5를 합치면 "오늘 값으로 오늘 죽이는" 버그가 나온다(§4).

### 지출 차감에서 주의할 것

```js
const waived = character.electricityWaived;        // 연구자 = true
const cost = rentPerDay + utilityPerDay
           + dailyFoodPerPerson * household - cropMealSaving
           + (waived ? 0 : report.energy.won);     // ★ 전기만 면제. 식비·월세는 낸다
```

- 식비 상한은 **1인당**이다: `household × 2`끼 (`food_economy.md` §4)
- `report.energy.won`은 이미 계약 객체에 들어 있다. 다시 계산하지 말 것

---

## 2. 상태 구조

```jsonc
S = {
  schema: "game_state/1",
  day: 0,
  season: "spring", weather: "clear",
  timeScale: { minutesPerGameDay: 30 },   // 0.5 배속 / 30 실시간 / 1440 1:1 (time_modes.md)

  character: { id:"jachwi", household:1, electricityWaived:false, cash:1000000 },
  home:      { id:"banjiha", room:"banjiha" },

  pots: [{
    id: "pot_01",
    slotId: "shelf_top",        // ★ 계약 객체 slots[].id 와 같은 값 (§3)
    plantId: "monstera_deliciosa",
    variegated: false,
    growthDay: 0,               // 생장 나이가 아니라 '경과 게임일'. ageOf()는 생장 창이 건다
    seed: 92158,
    dliHist: [],                // 생장 창의 dliHistory() 사본 (세이브용)
    health: { weakDays: 0, chlorosis: 0 },
    observed: { realtime_ticks: 0, oneone_ticks: 0 }   // time_modes.md §3
  }],

  ledger: { today: { in:0, out:0 }, total: 0 }
}
```

`growthDay`에 **생장 나이를 저장하지 말 것.** `ageOf()` 곡선은 생장 창 소유다.
루프는 "며칠 지났나"만 세고, 모양 계산은 넘긴다.

---

## 3. ★ 개체별 DLI 매칭 — `slotId` 하나로 끝난다

같은 방에서도 창가 8.32 vs 협탁 0.03으로 **273배** 차이가 난다(`rooms_progression.md` §3).
개체마다 자기 자리 값을 받아야 한다.

**계약 객체의 `slots[]`에 이미 `id`가 있다.** 화분이 그 `id`를 들고 있으면 된다.

```js
for (const pot of S.pots) setDailyLight(report, pot.slotId);
```

생장 창이 `slots.find(x => x.id === slotId)`로 골라 쓴다.
**슬롯을 못 찾으면 `console.warn`을 찍고 `best`로 떨어진다** — 조용히 딴 자리 값을
쓰지 않는다. 경고가 뜨면 `slotId` 오타이거나 가구를 옮겨 슬롯이 사라진 것이다.

> 슬롯 목록은 `buildHouse()`의 `plantSlots`에서 온다(집/방 창 소유).
> 루프는 **읽기만** 한다.

---

## 4. ★ 누적 판정 — 하루 값으로 죽이지 말 것

`light_contract.md` §3의 필수 요구사항이다. 날씨가 매일 굴러가면
반지하 산세는 **맑은 날 0.54(정체) ↔ 흐린 날 0.14(고사 밴드)** 를 오간다.
**하루 값으로 죽이면 운으로 죽는다.**

```js
const avg = dliAvg(7);                    // 생장 창 함수. 7일 이동평균
if (avg < th.die)      pot.health.weakDays++;
else                   pot.health.weakDays = 0;
if (pot.health.weakDays >= 5) kill(pot);  // 이동평균이 5일 연속 die 아래일 때만
```

- `band`(계약 객체 필드)는 **그날의 라벨일 뿐**이다. 누적은 전적으로 루프 몫
- 되돌릴 수 없는 판정(고사)만 이동평균. 성장 속도는 하루 값으로 해도 된다
- 황변은 `continuous_injury.chlorosis_per_day`를 누적

---

## 5. 창 경계 — 코어 창이 만드는 파일 / 부르는 함수

### 만든다 (코어 창 소유)

```
src/game/loop.js        nextDay(S) · rollWeather()
src/game/economy.js     지출·수입·장부
src/game/state.js       save/load
game.html               [다음 날] 버튼 + 최소 화면
```

### 부르기만 한다 (남의 파일 — 수정 금지)

| 함수 | 파일 | 소유 |
|---|---|---|
| `buildDailyLight(day, slots, wins, ctx)` | `src/engine/daily_light.js` | 집/방 창 |
| `judgeDLI` · `thresholdsFor` | 〃 | 〃 |
| `buildHouse()` → `plantSlots` · `luxWins` | `src/render3d/house.js` | 〃 |
| **`setDailyLight(contract, slotId)`** | `plant_grow.html` | **생장 창** |
| **`dliAvg(days)` · `dliHistory()` · `resetDailyLight()`** | 〃 | 〃 |
| **`calcVarieProb/MatureProb/MatRare/MatSub(dli)`** | 〃 | 〃 |
| **`buildPlant()` · `setGrowth(day)` · `ageOf(day)`** | 〃 | 〃 |

**커밋도 파일 지정으로.** `git add .` 금지 — 창이 여럿이라 남의 작업이 딸려 들어간다.

---

## 6. ⚠ 지금 걸리는 것 — `plant_grow.html`은 **한 그루 전용**이다

`SEED` · `GROWTH` · `PLANT_DLI` · `PLANT_SLOT` · `DLI_HIST` · `plantGroup`이
**전부 전역**이다. `S.pots[]`를 여러 개 돌리면 **마지막 화분 상태로 전부 덮인다.**

### 그래서 MVP는 **화분 1개**로 간다

| MVP에 넣는다 | 뺀다 |
|---|---|
| `[다음 날]` 버튼 | 저장/로드 |
| 날씨 굴림 → DLI → **화분 1개** 전달 → 생장 1틱 | 상점·판매 UI |
| 지출 차감 + 잔액 표시 | 플레이어 행동(물주기 등) |
| 화면 갱신 (`buildPlant()`) | 다개체 |

**이것만으로 "빛 → 생장"이 처음으로 실제 도는 걸 본다.** 그게 MVP의 전부다.

### 다개체 리팩터는 생장 창 몫

전역 상태를 개체 객체로 묶는 작업은 **이 창(생장)이 한다.** 코어 창은 기다리지 말고
1개로 루프를 먼저 돌리면 된다 — 인터페이스(`setDailyLight(report, slotId)`)는
**이미 다개체를 전제로 잡혀 있어서** 리팩터가 끝나면 호출부를 안 고쳐도 된다.

---

## 7. 최소 구현 순서

```
1. game.html + [다음 날] 버튼 + S 초기화 (화분 1개, 반지하)
2. rollWeather → buildDailyLight → setDailyLight → setGrowth(S.day)
   → 화면에 DLI·밴드·성장도 텍스트로만 표시        ← 여기서 "빛이 자라게 한다"가 증명된다
3. 지출 차감 + 잔액 표시 (파산 판정까지)
4. 이동평균 고사 판정
5. 수확·판매
6. 저장/로드
```

**2번까지가 이 프로젝트에서 제일 중요한 한 걸음이다.** 그 뒤는 얹기다.

## 관련
- `docs/light_contract.md` — 계약 객체 `daily_light/1` 전문
- `docs/food_economy.md` — 지출 항목·1인당 식비 상한
- `docs/sale_economy.md` — 수입·삽수·상점 가격
- `docs/time_modes.md` — `minutesPerGameDay`
- `docs/researcher_track.md` §5 — `calc*()` 확률식
