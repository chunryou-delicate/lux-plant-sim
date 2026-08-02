# 2026-08-02 · core → house (프로파일 마감 전 선행 계약 수정)

## ① `w.cz` 누락 수정 — 온실 **10.49 → 14.55** 재현했습니다

`light_adapter.build()` 만 `winFromHouse()` 의 9번째 인자를 안 넘기고 있었습니다.
`main.js` · `_dli_probe.html` · `_bj_*.html` 은 전부 넘기고 있었습니다.

```js
// src/game/light_adapter.js  (수정 후)
winFromHouse(w.wall, w.cu, w.cy, w.w, w.h, built.size, w.tau, w.evScale, w.cz)
//                                                                        ↑ 이것
```

전 방 대조 (맑음·여름 best, 등 0개):

| 방 | 천창 | 수정 전 | 수정 후 |
|---|---|---|---|
| **온실** | 1개 (cz **−2.5**) | **10.49** | **14.55** ★ |
| 반지하·아파트·학원교실·원룸·투룸 | 0개 | 3.77 / 6.02 / 6.01 / 4.77 / 5.64 | 동일 |

**천창이 있는 방에서만 어긋납니다.** 벽창은 `cz` 를 안 쓰므로 다섯 방은 값이 그대로였고,
그래서 지금까지 아무도 못 봤습니다 — 또 "오류 없이 조용히 틀리는" 유형입니다.
부분 천창(`cgZ0~cgZ1`)이 도입되면서 생겼습니다. 이전엔 `cz:0` 하드코딩이라 우연히 맞았습니다.

## ② 안정 `slotId` 계약 — 전역 순번 fallback 폐기

`slotId` 는 세이브에 그대로 들어갑니다. 뿌리인 `uid` 가 흔들리면 **저장된 화분이 남의 자리로 갑니다.**
예전 코어 fallback `{방}-{프리셋}-{전역순번}` 은 **모든 방을 가로지르는 순번**이라,
한 방에 가구 하나만 추가돼도 다른 방 뒤쪽 uid 가 통째로 밀렸습니다. 폐기했습니다.

**계약 (2026-08-02 확정)**

1. **화분 슬롯을 내는 가구는 `house_rooms.json` 에 명시적 `uid` 가 있어야 한다**
2. 없으면 코어가 **`TEMP~{방}#{인덱스}~{프리셋}`** 을 붙이고 `console.error` 로 알린다.
   조용히 메꾸지 않는다 (게임은 계속 돌지만 id 가 임시임이 눈에 보인다)
3. **영속 산출물(방 프로파일)은 임시 uid 가 하나라도 있으면 만들지 않고 오류를 던진다.**
   파일로 굳으면 나중에 uid 를 붙이는 순간 저장된 slotId 가 전부 어긋나기 때문입니다

```
src/game/light_adapter.js   TEMP_UID · build() 의 console.error · profile() 의 throw · uidAudit()
src/game/room_profile.js    uidStable !== true 인 프로파일은 로드 거부
```

프로파일에 `uidStable: true` 와 `roomRev` 를 같이 찍습니다(요청하셨던 `roomRev` 복사, 반영했습니다).

> **uid 값은 무엇이든 좋습니다.** 규칙이 아니라 **JSON에 한 번 적히는 것** 자체가 계약입니다.
> 아래 "제안 uid" 는 붙여 넣기 편하시라고 만든 것이고, 다른 이름으로 하셔도 코어는 그대로 돕니다.

## ③ ★ 명시 `uid` 가 필요한 가구 — 방별 회신

**반지하는 이미 전부 되어 있습니다(14칸 안정).** 학원교실은 창턱 112칸이 안정이라 16칸만 걸립니다.

### banjiha (반지하) — 없음 ✓ (슬롯 14칸 전부 안정)

### oneroom (원룸) — 3건 · 영향 슬롯 11/11칸
| furniture[] | preset | 슬롯 | 제안 uid |
|---|---|---|---|
| 1 | `nightstand` | 1 | `oneroom-nightstand-1` |
| 2 | `desk` | 2 | `oneroom-desk-2` |
| 5 | `shelf` | 8 | `oneroom-shelf-5` |

### apartment (아파트) — 18건 · 영향 슬롯 83/83칸
| furniture[] | preset | 슬롯 | 제안 uid |
|---|---|---|---|
| 0 | `shelf_ladder_4tier` | 7 | `apartment-shelf_ladder_4tier-0` |
| 1 | `shelf_etagere_3tier` | 9 | `apartment-shelf_etagere_3tier-1` |
| 2 | `plant_step_3` | 3 | `apartment-plant_step_3-2` |
| 3 | `shelf_etagere_3tier` | 9 | `apartment-shelf_etagere_3tier-3` |
| 4 | `shelf_growrack_2tier` | 6 | `apartment-shelf_growrack_2tier-4` |
| 5 | `plant_step_3` | 3 | `apartment-plant_step_3-5` |
| 6 | `shelf_etagere_3tier` | 9 | `apartment-shelf_etagere_3tier-6` |
| 7 | `plant_step_3` | 3 | `apartment-plant_step_3-7` |
| 8 | `plant_pedestal` | 1 | `apartment-plant_pedestal-8` |
| 10 | `nightstand` | 1 | `apartment-nightstand-10` |
| 12 | `dresser` | 2 | `apartment-dresser-12` |
| 14 | `table_round` | 1 | `apartment-table_round-14` |
| 18 | `desk` | 2 | `apartment-desk-18` |
| 20 | `shelf` | 8 | `apartment-shelf-20` |
| 21 | `shoe_cabinet` | 2 | `apartment-shoe_cabinet-21` |
| 22 | `shelf_low` | 6 | `apartment-shelf_low-22` |
| 26 | `table` | 2 | `apartment-table-26` |
| 28 | `shelf_etagere_3tier` | 9 | `apartment-shelf_etagere_3tier-28` |

### classroom (학원교실) — 8건 · 영향 슬롯 16/128칸
| furniture[] | preset | 슬롯 | 제안 uid |
|---|---|---|---|
| 2 | `lectern` | 1 | `classroom-lectern-2` |
| 3~8 | `desk_student_2` ×6 | 2씩 | `classroom-desk_student_2-3` … `-8` |
| 15 | `locker_12` | 3 | `classroom-locker_12-15` |

### greenhouse (온실) — 11건 · 영향 슬롯 64/64칸
| furniture[] | preset | 슬롯 | 제안 uid |
|---|---|---|---|
| 0 | `shelf_ladder_4tier` | 7 | `greenhouse-shelf_ladder_4tier-0` |
| 1 | `shelf_etagere_3tier` | 9 | `greenhouse-shelf_etagere_3tier-1` |
| 2 | `plant_step_3` | 3 | `greenhouse-plant_step_3-2` |
| 3 | `shelf_growrack_2tier` | 6 | `greenhouse-shelf_growrack_2tier-3` |
| 4 | `shelf_etagere_3tier` | 9 | `greenhouse-shelf_etagere_3tier-4` |
| 5 | `shelf_cart_3tier` | 6 | `greenhouse-shelf_cart_3tier-5` |
| 6 | `table` | 2 | `greenhouse-table-6` |
| 7 | `plant_step_3` | 3 | `greenhouse-plant_step_3-7` |
| 9 | `desk` | 2 | `greenhouse-desk-9` |
| 11 | `shelf` | 8 | `greenhouse-shelf-11` |
| 12 | `shelf_etagere_3tier` | 9 | `greenhouse-shelf_etagere_3tier-12` |

### tworoom (투룸) — 5건 · 영향 슬롯 20/20칸
| furniture[] | preset | 슬롯 | 제안 uid |
|---|---|---|---|
| 1 | `nightstand` | 1 | `tworoom-nightstand-1` |
| 4 | `table_round` | 1 | `tworoom-table_round-4` |
| 6 | `shelf_low` | 6 | `tworoom-shelf_low-6` |
| 9 | `shelf_etagere_3tier` | 9 | `tworoom-shelf_etagere_3tier-9` |
| 10 | `plant_step_3` | 3 | `tworoom-plant_step_3-10` |

> 합계 **45건**. 슬롯을 안 내는 가구(침대·소파·냉장고 등)는 뺐습니다 — 지금은 필요 없습니다.
> 나중에 그것들도 슬롯을 내게 되면 그때 다시 회신하겠습니다.

## ④ 첫 플레이 몬스테라 화분 — `assets/monstera/pot.glb` 확정

**창턱 한도 `maxPotD` 0.21m (반지하 창턱 1칸) 이하임을 정점에서 직접 쟀습니다.**

| 에셋 | manifest `real_max_m` | bbox 지름 | **회전 무관 지름** | 높이 | 여유 | 판정 |
|---|---|---|---|---|---|---|
| **`monstera/pot.glb`** (id 확정) | 0.20 | 0.200 | **0.202** | 0.134 | **+0.008** | 올라감 ✓ |
| `pots/pot_terracotta_wood.glb` | 0.20 | 0.200 | 0.201 | 0.180 | +0.009 | 올라감 ✓ |
| `pots/pot_concrete_square.glb` | 0.20 | 0.200 | **0.275** | 0.187 | **−0.065** | **못 올림 ✗** |

`pot.glb` 로 정한 이유: **`plant_grow.html:361` 이 이미 이 에셋을 렌더하고 있습니다.**
첫 플레이 화분은 곧 생장 창이 그리는 그 화분이라, 다른 걸 고르면 창 간 교체 요청이 생깁니다.
`pot_terracotta_wood.glb`(스타일 기준 화분)도 조건을 만족하니 상점 확장 때 쓰면 됩니다.

### ★ 경고 — `maxPotD` 비교는 bbox 로 하면 안 됩니다

`pot_concrete_square.glb` 는 **bbox 로는 0.200이라 통과처럼 보이는데 대각선이 0.275** 입니다.
사각 화분은 회전에 따라 안 들어갑니다. 배치 코드가 `maxPotD` 를 검사할 때
**`2×max√(x²+z²)`(회전 무관 지름)** 로 비교해 주세요. `real_max_m` 은 *최대 치수*(높이일 수 있음)라
그대로 쓰면 안 됩니다 — 위 세 화분 모두 `real_max_m` 이 0.20으로 같지만 하나는 못 올라갑니다.

## ⑤ 마무리 요청 — 프로파일 6개 재생성

**`data/profiles/` 에 커밋돼 있는 6개는 전부 무효입니다** (①의 cz 이전 + ②의 uid 이전).
지금은 로드하면 오류가 나서 조용히 쓰이지는 않습니다:

```
[프로파일 거부] greenhouse: 안정 uid 계약(2026-08-02) 이전 파일입니다.
```

`_profile_gen.html` 로 다시 뽑아 주실 때 두 가지만 부탁드립니다.

1. `winFromHouse(..., w.tau, w.evScale, w.cz)` — 9번째 인자
2. 산출물에 `uidStable: true` · `roomRev` 를 찍을 것 (코어가 `uidStable` 로 계약 이전 파일을 거릅니다)

③의 uid 가 들어간 뒤에 뽑아야 합니다. 그 전에 뽑으면 코어 쪽 `profile()` 은 `throw` 합니다
(fail-loud 로 맞춰 뒀습니다).

## 이번에 안 건드린 것

게임 UI · 경제 · 다개체 리팩터 · 밸런스 — 지시대로 전부 그대로입니다.

---

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

---

# 2026-08-01 · 후속

## 받았습니다 — ①`glazed` ②`weekStats` 캐시 ③온실 재측정

셋 다 확인했습니다. 특히 ③의 원인(`_dli_probe` 가 `evScale` 을 안 넘기고 있었다)까지 짚어 주셔서
왜 12.42와 13.01이 갈렸는지가 닫혔습니다.

## ★ 요청② 후속 — "등은 밖에서 더하라"는 `mean` 에만 통합니다

`weekStats` 에 넣어 주신 경고가 **코어에서 정상적으로 뜹니다.** 다만 처방대로는 못 씁니다.

```
[볕] weekStats.mean 이 굴림 평균과 53.1% 어긋난다 — … 등은 weekStats 밖에서 더할 것
```

자연광만 넘기고 등을 밖에서 더하면 `mean` 은 맞지만 **`p10`·`p50`·`p90`·`overPct` 가 틀립니다.**
백분위와 "문턱 넘는 주"는 **등을 포함한 하루 값**으로 세야 합니다 —
자연광만으로 세면 반지하는 등을 켜든 안 켜든 문턱 넘는 주가 0%가 됩니다.
(등 1개 좋은 자리의 실제 값은 avg7 12.16 · 문턱 넘는 주 100%입니다)

그래서 코어는 **등 포함 `dliOf` 를 넘기고 `mean` 만 따로 정확히 냅니다**(`loop.js expectedWeekStats`).
경고는 그때마다 뜨는데, 진짜 이상해서가 아니라 구조상 뜨는 것이라 소음이 됩니다.

```js
// 붙일 수 있는 코드 — weekStats 안. memo 가 이미 있으니 추가 비용이 없습니다.
/* ★ 해석적 mean 대신 확률 가중 기댓값. 등처럼 날씨와 무관한 성분이 섞여도 맞다. */
const pw = WEATHER_P[season] || WEATHER_P.summer;
let mean = 0;
for (const w of ['clear', 'cloudy', 'rain']) mean += (pw[w] || 0) * call(w, season, base);
// r.mean = +mean.toFixed(3);   ← analytic 대신. rolledMean·경고는 그대로 둬도 좋습니다
```

이러면 자연광만일 때 값이 지금과 같고(선형이라 동일), 등이 섞여도 맞습니다.
반영되면 코어의 우회를 지우겠습니다.

## ★ 협의 요청 — `data/profiles/` 에 프로파일 6개를 넣었습니다

박사님이 "리포에 두자"고 결정하셔서 넣었습니다. **`data/` 가 house 소유라 사후 협의를 청합니다.**

```
data/profiles/room_profile.{banjiha,oneroom,tworoom,classroom,apartment,greenhouse}.json
합계 44KB (교실 15.1 · 아파트 11.5 · 온실 9.3 · 투룸 3.3 · 반지하 2.6 · 원룸 2.1)
```

- **house 코드는 하나도 안 바뀝니다.** `light_adapter.profile()` 이 `buildHouse` 결과에서 뽑습니다
- 내용은 `{slotId, point, ratio, ppfd[]}` 뿐입니다. `ratio` 는 `daylightRatio` 결과 그대로입니다
- **위치가 마음에 안 드시면 옮기셔도 됩니다** — 코어는 경로 상수 한 줄만 고칩니다.
  `data/` 를 구조·에셋 정의만으로 두고 싶으시면 말씀해 주세요
- ⚠ **방 구조를 바꾸시면 프로파일이 낡습니다.** 지금은 수동 재생성입니다
  (`game.html` 의 [방 프로파일 ⭳]). `roomRev` 같은 표시를 넣어 두면 자동 검출이 가능한데,
  `measured.roomRev` 를 프로파일에도 복사해 둘까요? 그러면 어긋날 때 코어가 경고할 수 있습니다

## 보고 — 방 프로파일을 뽑아 씁니다 (house 코드 변경 없음)

밸런스 자동 시뮬을 헤드리스로 돌리려는데, 매번 방을 조립할 이유가 없어서
**조도 기하만 JSON으로 뽑아 두는 경로**를 만들었습니다.

```
light_adapter.profile([0,1,2])   → { schema:'room_profile/1', slots:[{slotId, ratio, ppfd[]}] }
room_profile.createProfileLight(profile)  → THREE 없이 daily_light.js 로 계약 객체 생성
```

- `ratio` 는 `daylightRatio` 결과(천공 1lx당 비율)라 **날씨·계절과 무관한 순수 기하값**입니다
- 물리식은 다시 쓰지 않고 `daylightDLI`·`lampDLI`·`judgeDLI` 를 그대로 부릅니다.
  시뮬과 게임이 다른 답을 내면 시뮬이 무의미하니까요
- 대조 결과 **전 슬롯 오차 0.0000**, 90일 시나리오 7ms(방 조립 없이)
- 반지하 프로파일 2.6KB. 방 6종이면 ~20KB입니다 —
  **`data/` 아래 두는 게 나을지 house 판단을 듣고 싶습니다.** 지금은 버튼으로 내보내기만 합니다

## 미해결

- [ ] 요청 ①②③
- [ ] 게임 뷰가 본체가 되면 `game.html` → `index.html` 이관. **그때 이 파일에 다시 적겠습니다**
- [ ] 지금 `game.html` 은 방을 **그리지 않습니다**(조도 계산에만 `buildHouse` 사용).
      3D 뷰를 붙일 때 `createScene`·`updateShellVisibility` 를 그대로 쓰겠습니다 — 인터페이스 고정 감사합니다
