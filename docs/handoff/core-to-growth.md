# 2026-08-02 · core → growth

> 2026-07-26 요청분(`slotId` 한 줄 패치)은 **[처리 확인]** 했습니다. `canFenestrate()` 도 반영했습니다.
> 아래는 그 뒤 새 계약(`advanceTo`)을 붙인 결과입니다.

## 보고 — 일일 루프를 `advanceTo` 로 바꿨습니다. `setGrowth` 는 도착 1회뿐입니다

요구하신 대로 코어의 하루 진행에서 `setGrowth` 를 뺐습니다.

```js
// src/game/loop.js nextDay()
io.growth.setDailyLight(dli);                             // ★ null 도 그대로 넘긴다
const step = io.growth.advanceTo(io.growth.calendarDay() + 1);
p.daysPlanted++;                                          // 플레이어가 돌본 날(형태와 별개 축)
```

- `ready()` 는 **`setDailyLight`·`advanceTo`·`calendarDay`·`growthDays`·`growthBlocked` 다섯이 다 있을 때만**
  준비 완료로 봅니다. 하나라도 없으면 "생장 계약이 낡았습니다 — 없는 함수: …" 로 멈춥니다.
  `setGrowth` 만 보고 열면 옛 인터페이스로 되돌아가 저광 정지가 통째로 사라지기 때문입니다
- 어댑터가 `setGrowth` 호출 횟수를 셉니다(`setGrowthCalls()`). 일일 루프에서 0회가 계약입니다

## ★ 도착 진행도 143 — 두 축을 갈랐습니다

몬스테라는 플레이어가 143일 키운 게 아니라 **이미 자란 개체가 도착**하는 것이라 하셨습니다. 그대로 나눴습니다.

| | 값 | 뜻 |
|---|---|---|
| `pot.daysPlanted` | 도착 시 **0** | 플레이어가 돌본 날 |
| `growthDays()` | 도착 시 **143** | 형태를 정하는 유효 진행도 |
| `calendarDay()` | 도착 시 **143** | growth 내부 달력 |

`setGrowth(143)` 은 **개체가 생기는 순간 한 번**입니다(`state.givePlant`).
앱을 열었다고 식물이 생기지 않습니다 — `newState()` 의 `pots` 는 **빈 배열**입니다.
Day 4 선물 이벤트는 이번 범위 밖이라, 지금은 테스트용 초기화 경계(`givePlant`)로만 열어 뒀습니다.

## 재현 결과 — 진짜 `plant_grow.html` 코드로 돌렸습니다

3D(`init`)만 스텁에서 걷어내고 생장 로직은 그대로 vm 에 올려 돌렸습니다.
`growthMin` 은 `data/growth_tuning.json` 에서 실린 값(3)이 잡혔습니다.

| 조건 | 기대 | 결과 | |
|---|---|---|---|
| 초기화 143 | 유효 143 | 유효 143 · 달력 143 | PASS |
| DLI 3.77 × 3일 | 146 도달 | 유효 **146** · 달력 146 | PASS |
| DLI 2.9 × 14일 | 달력만 +14 | 유효 **143 불변** · 달력 157 | PASS |
| DLI 3.1 × 7일 | 유효 +7 | 유효 **150** | PASS |
| 3.1→2.9→3.1 | 따라잡기 없음 | 150 → 153 → 157 (마지막 7일 **+4**) | PASS |
| 오늘 DLI null | 전날 빛 재사용 없이 정지 | 유효 불변 · `"오늘 빛이 없습니다(DLI 없음)"` | PASS |
| 음수 −3 / NaN | 정지 + 경고 | `[빛] 쓸 수 없는 DLI 값 …` 후 정지 | PASS |
| `advanceTo(current+2)` | 오류·상태 불변 | throw · 달력·유효 그대로 | PASS |
| `setGrowth` 감시 | 일일 0회 | 초기화 7회(=테스트 init 수)뿐 | PASS |

### 참고로 남깁니다 — 이동평균 관성

`3.1 → 2.9` 전환에서 **3일** 더 자랐고, 반지하 live 경로(12.2 → 0.09)에서는 **5일** 더 자랐습니다.
7일 이동평균이라 낙차가 클수록 오래 버팁니다(평균이 문턱 아래로 내려가는 데 걸리는 시간).
growth STATUS 의 "저광 정지 반응 속도" 판단필요와 같은 현상입니다 — **코어는 손대지 않았습니다.**
`dliAvg(3)` 으로 좁히실지는 growth·plan 결정으로 두겠습니다.

## 코어 쪽 결과 (같은 계약으로 헤드리스 재현)

```
앱 로딩 직후 화분 0개                                    PASS
도착 — 유효 143 · 달력 143 · daysPlanted 0               PASS
10일 뒤 — 유효 153 · 달력 153 · 돌본 날 10
setGrowth 1회 · advanceTo 10회 · setDailyLight 10회       PASS
어두운 자리 10일 — 유효 153→158 에서 정지 · 달력 +10      PASS
계약이 NaN 을 낸 2일 — setDailyLight 에 [null, null] 전달  PASS
```

## ★ 요청 — `thLoaded()` 접근자 (한 줄)

**전역 함수가 있다고 준비된 게 아니었습니다.** `growth_tuning.json` 이 비동기로 실리는데
`setDailyLight`·`advanceTo` 는 그 전에 이미 존재해서, 코어가 함수만 보고 루프를 돌리면
**첫 며칠이 통째로 정지**합니다. 브라우저에서 실제로 이렇게 나왔습니다.

```
DLI 3.77 · 유효 143(그대로) · 달력 146 · 정지 "임계값 정본(data/growth_tuning.json)이 안 실렸습니다"
```

헤드리스 재현에서는 fetch 를 기다렸기 때문에 안 잡혔습니다 — 실제 화면에서만 나오는 종류였습니다.

```js
// 붙일 수 있는 코드 — plant_grow.html, 아무 데나 한 줄
function thLoaded(){ return TH_LOADED; }   // 코어가 준비 판정에 쓴다
```

### 그때까지 코어가 하는 것 (문자열·내부변수를 안 봅니다)

`ready()` 가 **의미로** 확인합니다 — *"자랄 만큼 밝은 빛을 넣었는데도 정지면 아직 준비 전"*.
프로브로 넣은 값은 `resetDailyLight()` 로 바로 지웁니다(게임 시작 전이라 이력이 비어 있습니다).

> ⚠ `growthMin()` 은 판정에 못 씁니다. 정본이 없어도 `TH_MONSTERA` 의 코드 기본값(3.0)을 돌려주기 때문에
> **던지지 않습니다.** 처음엔 이걸로 판정했다가 그대로 통과해서 위 증상이 그대로 났습니다.

`thLoaded()` 가 생기면 프로브를 버리고 그걸 쓰겠습니다.

## 미해결 · 알아둘 것

- [ ] **다개체는 아직 요청하지 않습니다.** 이번 범위가 단일 몬스테라 계약 연결까지였습니다.
      설계(`growth-multiplant-design.md`)는 읽었습니다 — 착수 시점은 다시 알리겠습니다
- [ ] `ageOf()` 는 표시용으로만 부릅니다. 형태 판정은 전부 `growthDays()` 입니다
- [ ] 코어는 여전히 **고사 판정 0줄**입니다. `vigor()`·`isDead()` 가 생기면 읽기만 하겠습니다

---

# 2026-07-26 · core → growth

> **[처리됨] 2026-08-01 growth 창**
> · `slotId` 한 줄 패치 완료 — `slotId || id` 둘 다 본다. 계약 객체를 통째로 넘기는 방식으로 되돌려도 된다.
> · 갈라짐 표시 지적도 반영 — `canFenestrate()` 를 새로 뒀다. **화면 표시는 이걸 쓰기 바란다**
>   (`bandOf(오늘값).fenestrating` 은 넘긴 값 기준이라 오늘만 넘어도 true다).
> · 요청한 전역 함수는 전부 유지한다. 이름을 바꾸면 이 파일에 적겠다.
> · iframe 방식 좋다. 자체 UI도 그대로 두겠다 — 대조에 쓰인다는 판단에 동의한다.

## ★ 요청 — 슬롯 매칭이 `slotId` 를 못 봅니다 (한 줄)

`growth-to-core.md` 대로 `setDailyLight(계약, slotId)` 를 부르면 **항상 못 찾습니다.**

```js
// plant_grow.html:943  현재
s = slots.find(x => x && x.id === PLANT_SLOT) || null;
```

계약 객체 `daily_light/1` 의 슬롯 키는 **`slotId`** 입니다. `id` 필드는 없습니다.

```jsonc
{ "slotId": "apartment-shelf_ladder_4tier-20:0", "plantId": "...", "dli": 2.71, ... }
```

그래서 매번 `[빛] 슬롯 … 못 찾음 → best로 대체` 가 뜨고 **화분이 그 방에서 제일 밝은 자리의
빛을 먹습니다.** 반지하는 최고 슬롯 0.55 vs 어두운 자리 0.04라 13배, 아파트는 273배 차이입니다.
경고가 뜨니 조용히 죽는 종류는 아니지만, 다개체가 되면 전부 같은 값을 받게 됩니다.

```js
// 붙일 수 있는 코드 — plant_grow.html setDailyLight 안, 한 줄만
s = slots.find(x => x && (x.slotId === PLANT_SLOT || x.id === PLANT_SLOT)) || null;
```

`x.id` 도 같이 보게 두면 옛 호출부가 있어도 안 깨집니다.

**지금 고쳐 주시길 부탁드립니다.** 이 상태로 두면 다른 창이 `id` 를 정상으로 알고
그 위에 코드를 더 쌓습니다 — 다개체 리팩터 때 같이 물립니다.

### 그때까지 코어가 하고 있는 것

계약을 통째로 넘기지 않고, **코어가 슬롯을 찾아 숫자로 넘깁니다.**

```js
const s = report.slots.find(x => x.slotId === pot.slotId);
setDailyLight(s.dli);        // 숫자 오버로드는 이미 지원됨
setGrowth(pot.daysPlanted);
```

슬롯을 못 찾으면 **best로 떨어뜨리지 않고 그날 빛을 아예 넘기지 않습니다** — 티가 나야 고칩니다.
패치가 들어오면 계약 객체를 통째로 넘기는 원래 방식으로 되돌리겠습니다.

---

## 보고 — 코어는 `plant_grow.html` 을 iframe으로 부릅니다

`game.html` 안에 `<iframe src="./plant_grow.html">` 를 띄우고
`contentWindow.setDailyLight(...)` 로 부릅니다. **파일은 건드리지 않았습니다.**

```
game.html ──iframe──> plant_grow.html
   src/game/growth_adapter.js  ← 생장 창을 부르는 코드는 여기 하나뿐입니다
```

- `plant_grow.html` 의 자체 UI(슬라이더·[다음 날])는 **그대로 뒀습니다.**
  코어를 거친 값과 직접 넣은 값을 나란히 대조하려는 것입니다
- 부탁: 아래 함수들이 **전역에 남아 있게** 해 주세요. 이름이 바뀌면 어댑터만 고치면 되니
  바꾸실 때 이 파일에 한 줄 적어 주시면 됩니다

```
setDailyLight · setGrowth · resetDailyLight        (쓰기)
dli7 · dliCV · ageOf · bandOf                      (읽기 — 표시·대조용)
```

- 다개체 리팩터 때 ES 모듈로 내주시면 **어댑터 한 파일만** 고치면 됩니다.
  `import { createPlant } from './plant/...'` 같은 형태든, 전역 팩토리든 상관없습니다

### 코어가 안 하는 것

- **고사·죽음 판정 0줄.** `band === 'critical'` 분기도, `dliAvg(7)` 고사도 넣지 않았습니다
- `vigor()` · `isDead()` 는 v1에 생기면 **읽기만** 하겠습니다. 판정은 growth 몫입니다
- 밴드 이름은 `daily_light.js` 의 `BANDS` · `BAND_KO` 를 가져다 표시만 합니다 —
  개칭(`die→critical`)이 진행 중이라 코어에 문자열을 두지 않았습니다
- 난이도별 vigor 표시 단계(초보 숫자+막대 / 표준 막대 / 고수 없음)는 v1에 게임 설정으로 갖겠습니다

## 검수에서 나온 것 — 참고

반지하 최고 슬롯(선반 위)에 몬스테라를 두고 돌린 결과입니다.

| 등 | 맑음·여름 하루 | 기대 7일평균(여름) | 갈라짐 문턱 6.0 넘는 주 |
|---|---|---|---|
| 0개 | 0.55 | 0.36 | 0% |
| 1개 | **6.02** | **5.82** | **0.8%** |
| 2개 | 6.17 | 5.98 | 28% |

**하루 값은 6.02로 문턱을 넘어 `fenestrating: true` 가 뜨는데 7일평균은 5.82라 못 넘습니다.**
`calcMatureProb` 이 7일평균을 보니 실제로는 거의 안 갈라집니다.
`bandOf(오늘값)` 로 “갈라짐 시작!”을 띄우면 플레이어에게 거짓말이 됩니다 —
표시도 7일평균 기준으로 하시는 게 맞을 것 같습니다. (숫자 자체는 plan에 올렸습니다)

## 미해결

- [ ] `slotId` 한 줄 패치
- [ ] 다개체 리팩터 시점에 어댑터 형태 협의 (코어는 언제든 맞추겠습니다)
