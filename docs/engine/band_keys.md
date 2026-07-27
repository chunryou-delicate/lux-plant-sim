# 밴드 키 — 쓰는 곳 전수 목록

**밴드 키를 바꾸려면 이 파일의 표에 있는 곳을 전부 같이 고쳐야 한다.**
바꾼 뒤에는 아래 §4 검사를 돌려 옛 키가 남았는지 확인한다.

---

> **이 파일의 §0 은 밴드 키를 넘어 이 저장소 전체에 적용된다.**
> 같은 유형의 사고 목록은 [`silent_failures.md`](silent_failures.md) 로 옮겼다.

## 0. 왜 이 파일이 있나

밴드 키가 어긋나도 **오류가 안 난다.** 조용히 기본값으로 떨어진다.

```js
const look = BAND_LOOK[band] || BAND_LOOK.unknown;   // ← 없는 키면 unknown
```

`unknown` 은 흰색·꼿꼿한 잎이다. 즉 **빛이 고사 수준으로 부족한 식물이 아주 건강해 보인다.**
`die` → `critical` 개칭 때 실제로 `plant_sample.js` 가 이 상태로 갈 뻔했다.

같은 유형("오류 없이 조용히 잘못 도는")이 이번이 세 번째다 —
함수 사라짐 → 확률 NaN(`rng() < NaN` 은 조용히 false) → 밴드 키.
**공통점은 실패가 예외가 아니라 그럴듯한 기본값으로 나타난다는 것이다.**

---

## 1. 현재 키 (2026-07-26)

```js
['critical', 'poor', 'stagnant', 'slow', 'best', 'good', 'over']   // + 'unknown' (임계값 없음)
```

| 키 | 구간 | ko | 이전 이름 |
|---|---|---|---|
| `critical` | `< th.die` | 고사 | ~~`die`~~ |
| `poor` | `th.die ~ th.survive` | 쇠약 | ~~`weak`~~ |
| `stagnant` | `th.survive ~ th.min` | 정체 | ~~`survive`~~ |
| `slow` | `th.min ~ th.best_lo` | 느림 | |
| `best` | `th.best_lo ~ th.best_hi` | 최적 | |
| `good` | `th.best_hi ~ th.max` | 성장 | |
| `over` | `> th.max` | 과광 | |

> **밴드 키와 임계값 필드명은 별개다.**
> 임계값 필드(`th.die` · `th.survive` · `th.min` · `th.best_lo` · `th.best_hi` · `th.max` ·
> `th.fenestrate`)는 **안 바꿨다.** 그건 "이 값 이상이어야 그 상태"인 경계 이름이고,
> `light_thresholds.json` · `growth_tuning.json` 양쪽에 박혀 있어 바꾸면 번진다.

---

## 2. 쓰는 곳 — 전부

| 파일 | 행 | 무엇 | 소유 |
|---|---|---|---|
| `src/engine/daily_light.js` | 70 | `BANDS` 배열 — **정본** | house |
| `src/engine/daily_light.js` | 72~75 | `BAND_KO` 한국어 표기 | house |
| `src/engine/daily_light.js` | 80~86 | `judgeDLI()` 판정 — **생산자** | house |
| `src/render3d/plant_sample.js` | 38~46 | `BAND_LOOK` 색·처짐 — ★ 조용히 실패하는 곳 | house |
| `src/main.js` | 194 | `applyBand(sample, j.band)` — 통과만 함 | house |
| `plant_grow.html` | 1023 | `BAND_KO` | growth |
| `plant_grow.html` | 1030~1036 | `bandOf()` — 자체 판정 | growth |
| `plant_grow.html` | 1948 | HUD 색표 `col{}` | growth |
| `data/growth_tuning.json` | 109~111 | `vigor` 증감(`critical` −3.0 등) | plan |

계약 객체 `daily_light/1` 의 `slots[].band` 가 이 키로 나간다 —
**코어·생장 창이 값을 하드코딩하지 말고 `BANDS` 를 import 할 것.**

### 헷갈리기 쉬운 것 — 이건 다른 네임스페이스다

`daily_light.js:153` 의 `photoperiod().band` 는 **점등 시간대**(`photo12`·`photo16`·`always`)다.
빛 세기 밴드와 이름만 같고 값이 전혀 다르다. 같이 고치면 안 된다.

---

## 3. 값이 바뀌면 같이 봐야 하는 것

밴드 **키**가 아니라 **경계값**을 바꿀 때는 이쪽이다.

| 파일 | 무엇 | 소유 |
|---|---|---|
| `data/balance/light_thresholds.json` | 종별 임계값 · 무늬종 계수 | plan |
| `data/growth_tuning.json` | 밴드별 vigor 증감 | plan |
| `data/house_rooms.json` → `rooms.{id}.measured` | 방별 실측(밴드 분포 포함) | house |

---

## 4. 검사

```bash
# 옛 키가 밴드 자리에 남았나 — 임계값 필드(th.die 등)는 걸러야 한다
grep -rn "'die'\|'weak'\|'survive'\|\"die\"\|\"weak\"\|\"survive\"" \
  src/ *.html data/*.json data/balance/*.json | grep -v "apply_to"
```

`light_thresholds.json` · `growth_tuning.json` 의 `"die":` `"survive":` 는 **임계값 필드라 정상**이다.
그 외에 걸리는 게 있으면 옛 밴드 키다.

키 일치 자동 검사:

```bash
node -e "
import('./src/engine/daily_light.js').then(G=>{
  const src=require('fs').readFileSync('src/render3d/plant_sample.js','utf8');
  const keys=[...src.matchAll(/^  (\w+):\s*\{ tint/gm)].map(m=>m[1]);
  const miss=G.BANDS.filter(b=>!keys.includes(b));
  console.log(miss.length ? '★ BAND_LOOK 누락: '+miss : '일치 OK');
});"
```

---

## 5. 이력

| 날짜 | 변경 | 사유 |
|---|---|---|
| 2026-07-26 | `die`→`critical` · `weak`→`poor` · `survive`→`stagnant` | 고사 판정이 체력(vigor) 모델로 바뀌면서 밴드가 "죽는다"가 아니라 "오늘 빛이 어느 수준인가"가 됐다. `die` 라는 이름이 오해를 불렀다 (생장 창 요청) |
