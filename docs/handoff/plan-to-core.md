# 2026-07-26 · plan → core

**core 창 착수 지시.** 담당은 **게임 루프** 하나다.

> 먼저 읽을 것: `docs/INDEX.md` §0(창 구조) · `handoff/README.md`(규칙) ·
> **`handoff/growth-to-core.md`** · **`handoff/house-to-core.md`** ← 두 창이 이미 인터페이스를 정리해 뒀다.
> 기획 근거가 필요하면 `docs/GAME_PLAN.md`.

---

## 0. 왜 core를 따로 파는가

지금 **양끝만 있고 중간이 없다.**

| 구간 | 상태 |
|---|---|
| house — 슬롯별 DLI → 계약 객체 `daily_light/1` | ✅ |
| growth — 계약 객체 받아 생장·확률에 반영 | ✅ |
| **중간 — 순서대로 부르는 루프** | ❌ **없음** |
| 경제 — 식비·월세·전기 차감 | ❌ 없음(전기는 계산만 되어 실려 온다) |

**조도에 그렇게 공들였는데 아직 아무것도 안 자라는 이유가 이것 하나다.**

plan이 구현까지 하지 않는 이유: **판정자가 구현하면 자기 걸 자기가 판정하게 된다.**
그리고 루프가 돌면 실제 데이터로 계수 조정이 쏟아져 plan이 그쪽으로 바빠진다.

## 소유

```
src/game/*     ← 만든다
game.html      ← 만든다
```

**`index.html`은 house 소유다** — `src/main.js`(3D 방 뷰어)의 껍데기다.
거기 얹지 말고 **`game.html`을 새로 만든다.** 한 파일에 주인이 둘이면 작업이 날아간다
(2026-07-26에 실제로 일어났다). 나중에 게임 뷰가 본체가 되면 그때 다시 정한다.

**남의 파일은 함수 호출만.** 고쳐야 하면 `core-to-{창}.md`로 요청한다.

---

## 1. ★ 최소 루프 — 목표는 하나

**"빛이 자라게 한다"를 눈으로 보는 것.** 그 이상은 지금 하지 않는다.

| 넣는다 | 뺀다 |
|---|---|
| `[다음 날]` 버튼 · 날짜 | 저장/로드 |
| 날씨 굴림 → DLI → 개체 전달 → 생장 1틱 | **경제(식비·월세·전기)** ← 로드맵 3단계 |
| 밴드 + **말 피드백** | 상점·판매 · 물주기 |
| 방 선택 · 식물등 개수 | **다개체** — 화분 **1개**로 간다 |

`growth-to-core.md`에 적힌 대로 **`plant_grow.html`은 아직 한 그루 전용**이다
(개체 상태가 전부 전역). 다개체 리팩터는 growth가 하고, **루프 v0로 재미를 확인한 뒤** 착수한다.
루프가 뭘 요구하는지 보고 묶는 게 헛수고가 적다.

### 구현 순서

```
1. game.html + [다음 날] + 상태 S 초기화 (화분 1개, 반지하)
2. rollWeather → buildDailyLight → setDailyLight → setGrowth
   → DLI·밴드·성장도를 텍스트로만 표시     ← ★ 여기서 "빛이 자라게 한다"가 증명된다
3. 말 피드백 (A4)                          ← 여기까지가 재미 확인선
4. 이동평균 고사 판정
5. 지출 차감·수확·판매 · 저장/로드          ← 재미 확인 후
```

**2번까지가 이 프로젝트에서 제일 중요한 한 걸음이다.** 그 뒤는 얹기다.

---

## 2. 턴 진행 순서

```
nextDay(S):
  1. S.day++
  2. 날씨 굴림      S.weather = rollWeather(S.day)
  3. 조도 계산      report = buildDailyLight(S.day, slots, wins, ctx)   ← house
  4. 개체별 전달    setDailyLight(report, pot.slotId)                   ← growth
  5. 생장 1틱       setGrowth(S.day)  (또는 nextDay())                  ← growth
  6. 누적 판정      dliAvg(7) 로 고사·황변 (§4)
  7. (나중) 수확 → 지출 → 수입 → 저장
```

**3 → 4 → 5 → 6 순서가 고정이다.** 5와 6을 합치면 *"오늘 값으로 오늘 죽이는"* 버그가 난다.

### 개체별 DLI 매칭 — `slotId` 하나로 끝난다

같은 방에서도 창가 8.32 vs 협탁 0.03으로 **273배** 차이가 난다.
house가 **안정 슬롯 ID**를 넣어줬다 — 가구를 옮기거나 지워도, 세이브/로드에도 안 바뀐다.

```js
for (const pot of S.pots) setDailyLight(report, pot.slotId);
```

슬롯을 못 찾으면 growth가 `console.warn` 후 `best`로 떨어진다 — **조용히 딴 자리 값을 쓰지 않는다.**

### 상태 구조 (초안)

```jsonc
S = {
  schema: "game_state/1",
  day: 0, season: "spring", weather: "clear",
  timeScale: { minutesPerGameDay: 30 },   // 0.5 배속 / 30 실시간 / 1440 1:1
  character: { id:"jachwi", household:1, electricityWaived:false, cash:1000000 },
  home: { id:"banjiha", room:"banjiha" },
  pots: [{ id:"pot_01", slotId:"...", plantId:"monstera_deliciosa", variegated:false,
           growthDay:0, seed:92158, dliHist:[], health:{weakDays:0, chlorosis:0} }],
  ledger: { today:{in:0,out:0}, total:0 }
}
```

`growthDay`에 **생장 나이를 저장하지 말 것.** `ageOf()` 곡선은 growth 소유다.
루프는 "며칠 지났나"만 세고 모양 계산은 넘긴다.

---

## 3. ★★ 판정은 **7일 이동평균**이다. peak가 아니다

이번에 실제로 사고가 난 부분이라 강조한다.

house의 실측표는 **맑음·여름 최고 슬롯의 하루 peak**이고,
growth의 `calcMatureProb()`이 보는 건 **날씨·계절을 굴린 7일 이동평균**이다.
**둘은 1.5~3배 차이가 난다.**

```
E[날씨계수] = 0.55×1.00 + 0.30×0.25 + 0.15×0.12 = 0.643
기대 7일평균 ≈ peak × 0.643 × 계절계수 (여름1.000 봄0.733 가을0.662 겨울0.372)
```

**되돌릴 수 없는 판정(고사)은 반드시 이동평균으로.**

```js
const avg = dliAvg(7);                      // growth 함수
if (avg < th.die) pot.health.weakDays++; else pot.health.weakDays = 0;
if (pot.health.weakDays >= 5) kill(pot);    // 5일 연속일 때만
```

날씨가 굴러가면 반지하 산세는 맑음 0.54 ↔ 흐림 0.14를 오간다. **하루 값으로 죽이면 운으로 죽는다.**
성장 속도는 하루 값으로 해도 된다.

---

## 4. 이렇게 하면 보여야 할 것 (검수 기준)

**등을 늘리면 화면이 바뀌어야 한다.** 반지하·여름 기준 기대 7일평균:

| 설비 | DLI7 | 갈라짐 | 무늬/잎 |
|---|---|---|---|
| 등 0개 | 0.35 | ✕ | 0% |
| **등 1개** | **6.83** | **○ 켜짐** | 13% |
| **등 2개** | **13.16** | ○ | **39%** |

**"등을 켰더니 잎이 갈라지기 시작했어요"가 뜨는 순간**이 ①의 완료 조건이다.

말 피드백은 **원인을 짚어야 한다.** 밴드만 뜨면 시뮬레이터다 —
계약 객체가 `dli_daylight`/`dli_lamp`를 나눠 보내는 이유가 그거다
(*"오늘 안 자란 게 날씨 탓인지 등을 안 켠 탓인지"*).

---

## 5. 부르는 함수 (요약 — 상세는 두 인계 문서)

| | 어디 |
|---|---|
| `buildDailyLight(day, slots, wins, ctx)` · `winFromHouse` · `buildHouse()` | **`house-to-core.md`** |
| `setDailyLight(계약, slotId)` · `dliAvg` · `calc*(ctx)` · `nextDay` · `setGrowth` · `bandOf` | **`growth-to-core.md`** |
| 튜닝값 `data/balance/*.json` | plan (읽기만) |

> growth의 확률 함수는 **`ctx` 객체 하나를 받는 형태로 바뀌었다**(`lightCtx()` 사용).
> 옛 시그니처 `calcVarieProb(dli)`로 부르지 말 것 — `growth-to-core.md`가 최신이다.

---

## 미해결 · 알아둘 것

- [ ] **경제는 3단계다.** 지출 루프를 지금 넣지 않는다. 넣더라도 `electricityWaived`(연구자)만 주의
- [ ] **다개체는 growth 대기.** v0는 화분 1개
- [ ] `minutesPerGameDay`를 **하드코딩하지 말 것** — 시간 3모드가 이 숫자 하나로 갈린다
- [ ] 계수·임계값을 코드에 넣지 말 것. 필요하면 plan에 `data/balance/` 추가를 요청한다

**막히거나 설계가 이상하면 `core-to-plan.md`에 적어주세요.**
돌려보니 이상한 숫자가 나오면 그게 제일 값진 정보입니다 — 계수는 전부 임시값입니다.
