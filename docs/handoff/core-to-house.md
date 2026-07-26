# 2026-07-26 · core → house

## 보고 — `game.html` 을 새로 팠습니다. 최소 루프 v0가 돕니다

`house-to-core.md` 미해결 3번(“`game.html` 신설 후 알려 주세요”)에 대한 회신입니다.

```
game.html          ← 신설. 게임 루프 셸. buildDailyLight 를 하루 1회 부릅니다
src/game/state.js · loop.js · light_adapter.js · growth_adapter.js · ui.js
index.html · src/main.js    그대로 두었습니다 (house 소유)
```

집·조도 창을 부르는 코드는 **`src/game/light_adapter.js` 하나에 모았습니다.**
인터페이스가 바뀌면 그 파일만 고치면 됩니다. 부르는 것은 아래뿐입니다.

```js
buildHouse(GRAIN, roomDef, winPresets, doorPresets, finishes, furnPresets, lightPresets, shadePresets)
winFromHouse(w.wall, w.cu, w.cy, w.w, w.h, built.size, w.tau, w.evScale)
buildDailyLight(day, slots, wins, ctx)
ppfdSum(growRigs, point)        // lighting_sim — 식물등 PPFD를 코어가 지어내지 않으려고
skyOf / seasonOf / setWeatherProbs / weekStats   // weather.js
```

`built.lightRigs.filter(r => r.grow)` 를 “방에 놓인 식물등”으로 쓰고 있습니다.
등 개수 UI는 그 목록을 앞에서부터 n개 켜는 식입니다 — 코어가 기구를 새로 만들지 않습니다.

### ★ 계약 경로가 실측표를 그대로 재현합니다

헤드리스로(THREE만 올리고 렌더러 없이) 방을 조립해 계약 객체를 뽑아 봤습니다.

| 방 | 계약 peak(맑음·여름) | 실측표 peak | 계약 기대7일평균 | 실측표 avg7여름 | 문턱6.0 넘는주 | 실측표 fenWeekPct |
|---|---|---|---|---|---|---|
| 반지하 | 0.55 | 0.55 | 0.36 | 0.35 | 0% | 0% |
| 아파트 | 6.02 | 6.02 | **3.87** | **3.87** | **0.8%** | **0.8%** |
| 온실 | 12.42 | 13.01 ⚠ | 7.99 | 8.36 ⚠ | 83% | 85.3% |

아파트가 소수점까지 맞습니다. **`_dli_probe` 경로와 계약 경로가 같은 답을 냅니다.**

---

## 요청 ① `buildDailyLight` 이 `ctx.glazed` 를 버리고 있습니다

`house-to-core.md` 예제는 `glazed: built.glazedPanes` 를 넘기라고 되어 있는데,
`src/engine/daily_light.js` 는 그 필드를 **구조분해조차 하지 않습니다.**

```js
// daily_light.js:174~181  현재
const { weather='clear', season='summer', region='default',
        clearSkyMax, occluders=null, lums=null, ... } = ctx;   // ← glazed 없음
const skyOpt = { weather, season, region, clearSkyMax, occluders };
```

`daylightAt` 은 `opt.glazed` 를 지원하고 `src/main.js` 는 실제로 넘기고 있어서,
**실내 유리(아파트 베란다 거실창 tau 0.92)가 뷰어에서는 감쇠하고 계약에서는 감쇠하지 않습니다.**
아파트 거실 슬롯이 계약 경로에서만 조금 밝게 나옵니다 — 지금 아파트가 문턱 6.0 바로 아래라
영향이 가장 큰 방입니다.

```js
// 붙일 수 있는 코드 — daily_light.js buildDailyLight
const {
  weather = 'clear', season = 'summer', region = 'default',
  clearSkyMax, occluders = null, glazed = null, lums = null,   // ← glazed 추가
  litHours = 12, tariffWonPerKwh = 0, lampWatts = 0,
  thresholds = null
} = ctx;

const skyOpt = { weather, season, region, clearSkyMax, occluders, glazed };  // ← 같이 넘김
```

코어는 이미 `glazed` 를 넣어 부르고 있습니다. 반영되는 날부터 자동으로 맞습니다.

## 요청 ② `weekStats.mean` 이 식물등이 있으면 틀립니다

`weather.js:121`

```js
mean: +(clear * weatherE(season)).toFixed(3)
```

`clear`(맑은 날 값) **전체**에 `E[k]=0.643` 을 곱하는데, **식물등 DLI는 날씨와 무관합니다.**
그래서 등을 켜면 평균이 10분위보다 낮게 나옵니다 — 실제로 이렇게 나왔습니다.

```
등 1개 → mean 7.14  p10 8.46  p90 10.12      ← mean < p10 (불가능)
```

자연광만인 방(지금까지 재신 표)은 맞습니다. 등이 들어간 순간 깨집니다.

```js
// 붙일 수 있는 코드 — weather.js weekStats 안, mean 계산부만 교체
/* ★ 날씨와 무관한 성분(식물등)이 섞이면 clear×E[k] 는 틀린다.
   날씨별 값에 확률을 직접 얹으면 두 경우 다 맞는다. */
const p = WEATHER_P[season] || WEATHER_P.summer;
let mean = 0;
for (const w of ['clear', 'cloudy', 'rain']) mean += (p[w] || 0) * dliOf(w, season, base);
// r.mean = +mean.toFixed(3);
```

> `dliOf` 가 무거우면(코어는 슬롯 하나에 `buildDailyLight` 한 번입니다) 호출부에서
> `(weather, season)` 키로 캐시하시면 됩니다. `weekStats` 가 1800번 부릅니다 —
> 캐시 없이 돌렸다가 아파트 83슬롯에서 2분을 넘겼습니다.

코어 쪽에는 임시 우회를 넣어 뒀습니다(`loop.js expectedWeekStats`). 고쳐지면 지우겠습니다.

## 요청 ③ 온실 `measured` 가 오래된 값 같습니다

```
house_rooms.json rooms.greenhouse.measured   peakDLI 13.01 · avg7Summer 8.36
계약 실측(2026-07-26 코드 기준)                       12.42 ·           7.99
data/balance/weather.json expected_avg7.greenhouse  12.42 ·           7.99
```

`weather.json` 은 12.42 기준으로 이미 갱신돼 있습니다. `house_rooms.measured` 만 남은 것 같습니다.
`invariants.greenhouse_summer_avg7_min = 6.5` 는 어느 쪽이든 넘으니 결론은 안 바뀝니다.

---

## 확인 — 자동 블라인드는 코어가 맡습니다

`house-to-core.md` 의 제안대로 코어가 갖습니다. **house API를 바꿀 필요가 없습니다** —
`winFromHouse(..., tau, evScale)` 가 `evScale` 을 인자로 받으므로,
코어가 `buildHouse` 를 다시 부르지 않고 `wins` 배열만 매일 다시 매핑하면 됩니다.

```js
const wins = built.luxWins.map(w =>
  winFromHouse(w.wall, w.cu, w.cy, w.w, w.h, built.size, w.tau, w.evScale * blindMult(w)));
```

하루 1회만 바꾸고 `mult` 는 0.15 하한으로 두겠습니다. **구현은 v1입니다**(v0는 제어 없음).

## 미해결

- [ ] 요청 ①②③
- [ ] 게임 뷰가 본체가 되면 `game.html` → `index.html` 이관. **그때 이 파일에 다시 적겠습니다**
- [ ] 지금 `game.html` 은 방을 **그리지 않습니다**(조도 계산에만 `buildHouse` 사용).
      3D 뷰를 붙일 때 `createScene`·`updateShellVisibility` 를 그대로 쓰겠습니다 — 인터페이스 고정 감사합니다
