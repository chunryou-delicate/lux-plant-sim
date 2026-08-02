# growth → core

**2026-07-26 · 보고 + 요청**

게임 루프가 생장 창을 어떻게 부르면 되는지. 코어 창은 `plant_grow.html`을 직접 고치지 말고
아래 함수만 호출한다.

---

## 인터페이스

```js
// ── 빛 ────────────────────────────────────────────────
setDailyLight(계약객체, slotId)   // 하루치 빛. daily_light/1 을 통째로 줘도 되고 숫자만 줘도 된다.
                                 //   slotId 지정 → 그 자리의 dli
                                 //   미지정      → 지정해둔 슬롯, 없으면 best
                                 //   계약에 그 슬롯이 없으면 경고 후 best로 대체(조용히 넘어가지 않는다)
                                 //   반환값 = 실제로 쓴 dli
setDailyLightSteady(v)           // "이 자리에 계속 뒀다면" — 이력을 v로 채운다(미리보기/테스트용)
dliAvg(days) / dli7()            // 이동평균. 최근 14일치 보관
dliHistory() / resetDailyLight()
dliCV()                          // 최근 14일 변동계수 — 안정성 보상에 쓴다

// ── 확률 (전부 상황 객체 하나를 받는다) ──────────────────
lightCtx(extra)                  // { dli, dli7, cv, propagationMode } 를 만들어 준다
calcVarieProb(ctx)               // 무늬종으로 태어날 확률
calcMatureProb(ctx)              // 중간잎 → 성숙잎(갈라짐). fenestrate 6.0 미만이면 0
calcMatRare(ctx) / calcMatSub(ctx)   // 성숙 무늬가 희귀/부 갈래로
setPropagationMode('batch'|'individual')   // 개별 처리 보너스. ⚠ 지금은 값에 반영 안 됨(자리만)

// ── 생장 ──────────────────────────────────────────────
advanceTo(달력날짜)               // ★ 게임은 이걸 쓴다. 하루만 받는다(delta!==1 이면 오류·상태 불변)
                                 //   유효 생장은 빛이 될 때만 쌓인다. { calDay, growth, grew, blocked }
growthBlocked()                  // 왜 안 자라나(문자열). null 이면 자라는 중
calendarDay() / growthDays()     // 달력 경과일 / 유효 생장 진행도(형태를 결정)
isGrowing() / plantSeed(v)
nextDay()                        // 화면 버튼용. 슬라이더 값을 오늘 빛으로 쓰고 하루 진행
setGrowth(일수)                   // ⚠ [정정됨 — 게임 호출 금지] 점프다(디버그 슬라이더). 저광 정지가 무시된다
setTuningMode(on)                // ⚠ 게임 경로에서 켜지 말 것. 조도 없이 형태만 볼 때만
buildPlant()                     // 다시 그리기
bandOf(dli, varie)               // { band, ko, fenestrating, overlight } · varie=true면 요구 광량 ×1.4
ageOf(일수)                       // 실제 경과일 → 생장 나이 (초반 빠르고 뒤로 갈수록 느린 곡선)
```

인자를 객체로 받는 이유 — 빛 말고도 볼 게 늘어난다(번식 방식이 이미 그렇다).
함수를 하나씩 늘리지 않고 `ctx`에 필드만 추가하면 호출부는 안 바뀐다.

---

## 최소 루프 v0 — 이미 돈다

`plant_grow.html` 안에 **[다음 날]** 버튼이 있다. DLI 슬라이더를 오늘 빛으로 쓰고,
누를 때마다 이력에 한 칸 쌓고 하루 자란다. 화면에 경과일·생장나이·오늘 DLI·7일 평균·밴드가 뜬다.

계약 객체 연결은 v1에서. 코어가 붙을 때는 `nextDay()` 대신 이 순서로 부르면 된다.

```js
// ⚠ [정정됨 — 게임 호출 금지] setGrowth(day) 는 '점프'다. 저광 정지가 무시된다.
const c = makeDailyLight(day, ...);    // 집/방 창
setDailyLight(c, '이 화분의 슬롯 id');  // 생장 창
advanceTo(day);                        // ★ 하루씩. setGrowth 아님
```

---

## 미해결 — 코어가 알아야 할 것

### 1. ★ 이 파일은 한 그루 전용이다

개체 상태가 전부 전역이라 여러 그루를 동시에 굴릴 수 없다.

```
SEED · rng · GROWTH · PLANT_GROW · PLANT_HUE · PLANT_SAT · PLANT_MID · PLANT_AGE
PLANT_DLI · PLANT_SLOT · DLI_HIST · plantGroup
```

같은 방에서도 창가 8.97 vs 협탁 0.00이라 **개체마다 DLI가 달라야** 하는데, 지금 구조로는 안 된다.
**이 상태들을 개체 객체로 묶는 리팩터가 필요하고, 그건 생장 창이 한다.**
루프 v0(한 그루)로 재미를 확인한 뒤 착수하는 게 순서라고 본다 — 루프가 뭘 요구하는지 보고 묶는 게 헛수고가 적다.

### 2. 고사 판정 — **[취소·보류]** 아래 절 참고

~~코어가 `dliAvg(7)`을 읽어 판단한다~~ 도, 그 대안이던 체력 모델 확정안도 **지금은 유효하지 않다.**
**고사는 현재 구현 대상도 요청 대상도 아니다.** 아래 "체력(vigor) 모델" 절 참고.

성장률과 경고 표시는 그대로다.

- **성장률** — 하루 값. "오늘 해가 좋아서 잘 자랐네"가 매일 보여야 자리 옮긴 효과를 배운다
- **경고 표시** — 하루 값으로 즉시. 실제로 상하는 건 며칠 쌓여야 → 고칠 시간이 생긴다

### 3. 무늬종 광량 계수는 집/방 창 몫

`data/light_thresholds.json`의 `variegated.need_mult = 1.4`. 생장 창에도 같은 값이 `VARIE_MULT`로 있고
`bandOf(dli, true)`가 그걸 쓴다. **둘이 어긋나면 안 된다** — 한쪽을 고치면 반드시 다른 쪽도 고칠 것.
`judgeDLI` 쪽에 계수를 먹이는 건 집/방 창에서 해야 한다.

### 4. ⚠ 다른 창이 이 파일을 직접 고치고 있다

`plant_grow.html`에 `TH_MONSTERA` · `VARIE_MULT` · `fLight()` · `fStable()` · `dliCV()` ·
`setDailyLightSteady()` 가 생장 창을 거치지 않고 들어와 있었다(내용은 좋다).
**같은 파일을 두 창이 고치면 파일 지정 커밋으로도 못 막는다.** 이 파일 수정은 생장 창을 거쳐 주기 바란다.

---

## ⏸ 고사 판정 = 체력(vigor) 모델 — **[취소·보류] 2026-08-02**

> **이 절의 확정 표기는 취소한다.** 아래는 한때 "설계 확정"으로 적었던 내용이고,
> 지금 유효한 것은 **방향 하나뿐이다 — 활력은 형태 진행도와 별개의 축이다.**
>
> | | |
> |---|---|
> | **유효** | 활력이 형태 진행도와 다른 축이라는 방향 |
> | **미확정** | 밴드별 일일 증감값 · 잎 손실 주기 · 죽음 임계값 — **아래 숫자는 전부 후보다** |
> | **대상 아님** | `vigor()`·`isDead()` 계약. **현재 구현 대상도 요청 대상도 아니다** |
>
> novice 는 **형태 진행도 한 축만** 본다. 활력 감소·시듦·새순 포기·잎 손실·고사는
> 미래 고수 모드 범위다. 코어는 지금 이 절을 근거로 아무것도 배선하지 않아도 된다.

**`dliAvg(7)`로 고사를 판정하는 계획은 폐기됐다.** (박사님 결정 2026-07-26)
이동평균은 체력의 근사치인데 더 복잡하고, 무엇보다 **회복과 손상이 구분되지 않는다** —
3주 어두웠다 밝아지면 아무 일 없던 게 된다. 실제 식물은 "살아났지만 아래 잎 두 장은 잃었다"가 맞다.

```
이동평균 = 7일 이력 저장 + 평균 + 임계값 비교
체력     = 숫자 하나, 매일 더하기 한 번
```

※ `dliAvg(7)` 자체는 남는다 — `fStable`(안정 보너스) 등 다른 용도로 쓰인다.

### ⏸ 코어가 쓸 인터페이스 — **[취소·보류] 구현·요청 대상 아님**

```js
vigor()      // ⏸ 보류 — 만들지 않았고 요청도 없다
isDead()     // ⏸ 보류
nextDay()    // 이건 있다. 다만 vigor 를 갱신하지 않는다
```

이 계약은 **배선하지 말 것.** 지금 `nextDay()` 는 빛 기록 + 하루 진행만 한다.
만들게 되는 시점에 형태와 함께 다시 협의한다.

### ⏸ 수치 — 전부 후보다

`data/growth_tuning.json`의 `vigor` 절에 적힌 값은 **미확정 후보**다.
밴드별 일일 증감(critical −3.0 … best +2.0), 종별 계수, 잎 손실 주기(30 미만·4일),
죽음 임계값 — 어느 것도 확정이 아니다. **이 숫자로 코어 화면을 만들지 말 것.**

### 밴드 이름이 바뀔 수 있다

체력 모델로 가면 밴드는 "죽는다"가 아니라 **순수한 오늘 상태 라벨**이 된다.
`die → critical` · `weak → poor` · `survive → stagnant` 개칭을 house에 요청해 뒀다
(`growth-to-house.md`). **계약 객체의 `band` 값이 바뀌므로 코어도 영향을 받는다.**
house가 확정하면 growth도 같은 커밋 주기에 맞춰 바꾼다 — 그때까지는 옛 이름이다.

---

## 이 파일에 없는 것

지출·수입·수확·저장·상점·식비. 전부 코어 몫이다.
여기엔 "얼마나 자랐나"만 있고 죽음·수확 개념 자체가 없다.

---

## 다개체 — 설계 끝났다. 착수는 요청 시점

`growth-multiplant-design.md` 참고. 요지만:

- 전역 78개를 전수 조사했더니 **진짜 지속 상태는 8개뿐**이다
  (`seed·day·slotId·dli·dliHist·propMode·vigor·group`). 나머지는 매 빌드 파생값이거나 공용이다
- 개체 상태를 만지는 함수가 42개라 **인자를 추가하지 않는다.** 생장이 동기 처리라
  `usePlant(id, fn)` 으로 전역을 꽂았다 되돌리는 방식이면 **호출부가 안 바뀐다**
- `import { createPlant }` 형태를 원하면 ES 모듈로 낼 때 같이 한다. 그전까지는 위 방식으로 충분하다

```js
addPlant({ slotId, seed, day });
usePlant(slotId, () => { setDailyLight(report, slotId); nextDay(); });
```

**착수 조건은 "core가 실제로 화분을 둘 이상 굴리기 시작할 때"다.** 그전에 만들면
쓰이지 않는 구조가 된다. 시작하면 이 파일에 어댑터 형태를 먼저 적겠다.

---

## ★ 호출 변경 요청 — `setGrowth` → `advanceTo` (2026-08-01)

저광이면 형태 진행이 멈추게 했다(BLOCKER). 달력 경과일과 유효 생장 진행도를 갈랐다.

```js
// 지금 — 저광 정지가 무시된다
setDailyLight(dli);  setGrowth(pot.daysPlanted);

// 바꿀 것
setDailyLight(dli);  advanceTo(pot.daysPlanted);
```

- `advanceTo(달력날짜)` — 달력을 그 날짜로 옮기고, **`dliAvg(7) >= 3.0`일 때만** 유효 생장이 쌓인다.
  반환값 `{ calDay, growth, grew }`
- `setGrowth(v)` — **점프**다(디버그 슬라이더·처음·끝 버튼). 달력 날짜를 넣으면 저광 구간이 그냥 넘어간다.
  그대로 두면 콘솔에 경고가 한 번 뜬다

읽기용으로 넷을 더 냈다.

```js
calendarDay()   // 달력 경과일
growthDays()    // 유효 생장 진행도 (형태를 결정)
isGrowing()     // 지금 자라는 중인가 (저광 정지 아님)
plantSeed(v)    // 개체 시드 읽기/쓰기
```

**표시 제안**: `isGrowing()===false`면 "빛이 모자라 자라지 않는 중"을 띄우면 좋겠다.
날짜만 가고 아무 일도 안 일어나면 플레이어가 버그로 읽는다.

---

## [정정] advanceTo 계약이 좁아졌다 (2026-08-02, 커밋 976dcb6)

```js
advanceTo(calDay)   // ★ 하루만 받는다. delta !== 1 이면 상태를 안 바꾸고 오류를 던진다
                    //   → 반드시 하루씩 부를 것. 여러 날을 몰아 넘기면 그 사이 빛을 알 수 없어
                    //     저광 정지를 건너뛴다. 이력 재생 장치는 만들지 않는다
                    //   반환 { calDay, growth, grew, blocked }   blocked = 막힌 사유(문자열) 또는 null
```

**빛이 없으면 자라지 않는다.** 예전에는 DLI 미연결 시 날짜대로 자랐는데(폴백) 그걸 없앴다.

```js
growthBlocked()        // 왜 안 자라나. null 이면 자라는 중
                       //   '빛이 연결되지 않았습니다(DLI 없음)'
                       //   'DLI 이력이 망가졌습니다'
                       //   '빛 부족 — 7일평균 2.90 < 최소 3'
setTuningMode(true)    // 조도 없이 형태만 볼 때. ★ 게임 경로에서는 켜지 말 것
isTuningMode()
```

`growthBlocked()`를 화면에 그대로 띄우면 좋겠다 — 날짜만 가고 아무 일도 없으면 버그로 읽힌다.

---

## [정정 2] 게임 경로가 더 엄격해졌다 (2026-08-02, 커밋 대기)

우회로를 세 개 더 막았다. **코어가 알아야 할 것은 "막히는 사유가 늘었다"뿐**이고 호출 방식은 그대로다.

| 막는 것 | `growthBlocked()` 문자열 |
|---|---|
| 정본 JSON 미로딩 | `임계값 정본(data/growth_tuning.json)이 안 실렸습니다 — 서버로 여세요` |
| **오늘** 빛 없음 | `오늘 빛이 없습니다(DLI 없음)` |
| 오늘 값 망가짐 | `오늘 DLI 값이 망가졌습니다` |
| 이력 없음 | `DLI 이력이 없습니다` |
| 빛 부족 | `빛 부족 — 7일평균 2.90 < 최소 3` |

- **오늘 값을 이동평균보다 먼저 본다.** 어제까지 밝았어도 오늘 DLI 를 안 넘기면 정지한다 —
  코어가 어느 날 `setDailyLight` 를 빠뜨리면 그날은 안 자란다(조용히 넘어가지 않는다)
- **`file://` 로 열면 게임 경로가 아예 안 자란다.** 정본을 fetch 로 읽으므로 서버로 열어야 한다
- **유효한 `setDailyLight(값)` 이 들어오면 튜닝 모드가 자동으로 꺼진다** — 켜둔 채로 게이트를 우회할 수 없다

### [정정 3] 정본 로딩 판정이 실제로 동작한다 (2026-08-02)

정정2 의 `TH_LOADED=true` 가 엉뚱한 함수에 들어가 **게임 경로가 아예 안 자라고 있었다.** 고쳤다.

- `thresholds` 의 **필수 7키가 숫자로 들어온 것을 확인한 뒤에만** 게임 경로가 열린다
- fetch 실패 · HTTP 오류 · 키 누락 · 타입 불일치 → 전부 `TH_LOADED=false` + `console.error`
- 코어 쪽 호출 방식은 **바뀐 것이 없다.** `advanceTo` 계약 그대로다

### [정정 4] 콘솔 오류 주체가 갈렸다 (2026-08-02)

- `[생장] …` — 정본 로딩·검증 실패. **이때만** `TH_LOADED=false` 로 게임 경로가 정지한다
- `[화면] …` — 다시 그리다 난 오류. `TH_LOADED` 와 무관하고 생장은 계속 돈다

전에는 `buildPlant()` 예외가 로딩 catch 로 흘러 멀쩡한 정본에도 게임이 멈췄다.
코어 쪽 호출 방식은 그대로다.

### [정정 5] 화면 오류가 두 갈래로 남는다 (2026-08-02)

`[화면] 그리기 실패 …` / `[화면] HUD 실패 …` — 각각 독립이다.
그리기가 터져도 HUD 갱신은 시도되므로, 막힌 사유는 계속 화면에 뜬다.
어느 쪽이든 `TH_LOADED` 는 건드리지 않는다.

### [추가] `thLoaded()` + 형태 단계 계약 초안 (2026-08-02)

#### 지금 쓸 수 있는 것

```js
thLoaded()   // 임계값 정본이 실렸는가. 세터는 없다 —
             // 밖에서 켤 수 있으면 로딩 게이트가 그 순간 장식이 된다
```

`false` 면 게임 경로가 정지 상태다. `growthBlocked()` 가 사유 문자열을 낸다.

#### `growthPhase()` — 계약 초안(아직 구현 안 함, 회신용)

**핵심은 core 가 143·146 같은 생장일 숫자를 갖지 않는 것이다.**
경계는 전부 growth 안에 있고, core 는 이름과 0..1 만 받는다.

```js
growthPhase() → {
  phaseId:     'spear_ready',    // 지금 단계(문자열 id)
  progress01:  0.42,             // 이 단계 안에서 얼마나 왔나 0..1
  nextPhaseId: 'spear_furled'    // 다음 단계. 없으면 null
}
```

| 규칙 | |
|---|---|
| **소유** | `phaseId` 목록과 경계는 **growth 가 소유**한다. core 는 재구현하지 않는다 |
| **숫자 비공개** | 반환값에 생장일이 없다. core 가 `>= 146` 같은 조건을 쓸 방법 자체를 안 준다 |
| **곡선 변경 내성** | `timeCurve`·`spawnStep`·`matSpan` 을 나중에 조정해도 core 코드는 안 바뀐다 |
| **표시 전용** | 게임 판정에 쓰지 않는다. 판정은 `advanceTo` 의 `grew`·`blocked` 로 한다 |
| **novice 범위** | 형태 진행도 한 축뿐이다. 활력·시듦·고사는 여기 안 들어온다 |

phaseId 후보(내부 경계에서 그대로 나온다 — 이 표는 growth 쪽 참고용이다):

| phaseId | 내부 근거 | 화면에서 보이는 것 |
|---|---|---|
| `seed` | `g < seedEnd` | 씨앗 |
| `sprout` | `g < sproutEnd` | 줄기_초기 + 말린 새순 |
| `spear_ready` | 다음 축 생성 전 대기 | 겉보기 변화 없음 |
| `spear_furled` | 잎 성숙도 `m < 0.10` | 말린 새순이 돋음 |
| `spear_opening` | `m < 0.22` | 새순이 벌어지기 시작 |
| `leaf_young` | `m < stageYoung` | 어린잎 |
| `leaf_mid` | `m < stageMid` | 중간잎 |
| `leaf_mature` | 그 이상 | 성인잎(갈라짐) |

#### 첫 플레이 측정과의 대응

| 확정 측정 | phaseId |
|---|---|
| 도착 유효 **143일** — 비갈라짐 중간잎 2장, 새순 없음 | `spear_ready` |
| 적정광 **3턴** | `spear_ready` 의 `progress01` 이 올라간다 |
| **146일** — 말린 새순 등장 | `spear_furled` |
| **160일** — 펴짐 시작 | `spear_opening` |

`progress01` 시작값 후보(**아직 구현 안 함 · plan 확정 대기**):

| 안 | 143일에서 보이는 값 | 성질 |
|---|---|---|
| **A. 단계 내부 비율 그대로** | 약 0.0 에서 시작해 3턴 만에 1.0 | 정직하다. 다만 도착하자마자 "0%" 가 뜬다 |
| **B. 바닥값 오프셋** (예: 0.15~1.0 로 사상) | 0.15 에서 시작 | 첫 화면이 비어 보이지 않는다 |
| **C. 이전 단계 꼬리 포함** | 0.6 근처에서 시작 | "거의 다 왔다" 느낌. 3턴이 짧게 느껴진다 |

어느 쪽이든 **core 코드는 안 바뀐다** — 사상은 growth 안에서만 한다.

### [추가] `growthPhase()` 구현됨 (2026-08-02)

```js
growthPhase() → { phaseId, progress01, nextPhaseId }
```

**표시 전용이다.** 게임 판정은 그대로 `advanceTo` 의 `grew`·`blocked` 로 한다.

- `phaseId` — `seed` / `sprout` / **`axis_rising`** / `spear_ready` / `spear_furled` /
  `spear_opening` / `leaf_young` / `leaf_mid` / `leaf_mature`
- `phaseKo` / `nextPhaseKo` — **사람에게 보여줄 이름.** 코어는 자기 표를 들지 말 것 —
  단계를 하나 늘리거나 이름을 바꾸면 **오류 없이 틀린 라벨**이 뜬다
  - `axis_rising` — 혹에서 난 새 축이 올라오는 구간
  - `spear_ready` — 말린 새순 등장 **직전 3턴**의 마지막 준비 단계
- `progress01` — 이 단계 안에서 얼마나 왔나. **원비율 그대로(A안)**, 항상 0..1
- `nextPhaseId` — 다음 단계. 끝이면 `null`

**반환값에 생장일도 단계 경계 숫자도 없다.** `vigor` 도 없다.
경계는 growth 가 소유하고, `buildPlant`·`drawLeafStage` 가 쓰는 것과 **같은 격자·같은 임계값**에서
나온다(`seedEnd`·`spawnStep`·`petGrow`·`matSpan`·`0.10`·`0.22`·`stageYoung`·`stageMid`).
새 숫자를 만들지 않았으므로 `timeCurve` 를 조정해도 코어 코드는 안 바뀐다.

저광으로 멈추면 `GROWTH` 가 안 늘고, `progress01` 은 `GROWTH` 의 함수라 **같이 멈춘다.**

#### 단계 경계 (기본값 기준 · 참고용, 코어는 갖지 말 것)

```
  0 seed          51 axis_rising    134 axis_rising   234 axis_rising
  5 sprout        58 spear_ready    143 spear_ready   246 spear_ready
 14 spear_furled  61 spear_furled   146 spear_furled  249 spear_furled
 15 spear_opening 68 spear_opening  156 spear_opening 260 spear_opening
 21 leaf_young    78 leaf_young     167 leaf_young    273 leaf_young
 30 leaf_mid      91 leaf_mid       183 leaf_mid      291 leaf_mid
 48 leaf_mature  115 leaf_mature    212 leaf_mature
```

`spear_ready` 는 매 주기마다 새순 3턴 전에 시작한다 — 첫 플레이 전용 오프셋이 아니다.

---

## [추가] 렌더 신호 · `phaseKo` · `?embed=game` (2026-08-02)

### 1. 렌더 성공 여부를 반환한다 — 화면이 죽으면 코어가 안다

지난 정정에서 렌더 예외를 `drawStep` 으로 삼켰는데, **성공 여부를 낼 창구를 안 만들었다.**
게이지는 오르고 그림은 멈춘 채 게임이 계속 도는 상태가 가능했다 — 이 게임이 가르치는 게
딱 "빛 → 형태 변화"인데 그 피드백이 조용히 죽는다. `advanceTo` 와 `setGrowth` 가 이제 낸다.

```js
advanceTo(calDay) → { calDay, growth, grew, blocked,
                      drawn,        // ★3D 무대를 다시 그렸는가. false 면 화면의 식물은 낡은 것
                      drawError,    // 3D 실패 사유(문자열) · 없으면 null
                      hudError }    // growth 자체 HUD 실패 사유 · 없으면 null

setGrowth(days)  → { growth, calDay, drawn, drawError, hudError }
                   // ★도착(개체 생성)이 이걸 쓴다. drawn 을 안 보면
                   //   "화분은 있는데 화면엔 없는" 개체가 생긴다
```

- **3D 와 HUD 는 끝까지 따로다.** 그리기가 터져도 HUD 는 돌고(막힌 사유를 띄워야 하므로),
  반대로 HUD 만 죽은 건 덜 심각하게 다룰 수 있다. `drawn` 은 **3D 기준**이다
- 어느 쪽이 터져도 **`TH_LOADED` 는 안 건드리고 예외도 안 던진다.** 논리 진행은 그대로다
- 콘솔은 그대로 `[화면] 그리기 실패 …` / `[화면] HUD 실패 …`

**코어 제안** — `drawn===false` 면 `S.desync` 를 남기면 된다. 지금 `loop.js` 의
`calAfter === calBefore + 1` 분기는 예외가 안 나오므로 도달하지 않는다(죽은 코드).
`step.drawn` 으로 갈아타면 살아난다.

### 2. `growthPhase()` 에 `phaseKo` · `nextPhaseKo`

```js
growthPhase() → { phaseId, phaseKo, progress01, nextPhaseId, nextPhaseKo }
```

`phaseId` 키와 단계 경계는 **하나도 안 바뀌었다**(0~300일 경계 전수 대조 통과).
이름만 얹었다. `game.html` 의 `PHASE_KO` 표는 지워도 된다 —
지금 그 표엔 `seed`·`sprout` 가 빠져 있어 그 단계가 오면 조용히 `'도착함'` 으로 떨어진다.

| phaseId | phaseKo |
|---|---|
| `seed` / `sprout` | 씨앗 / 새싹 |
| `axis_rising` | 새 축이 올라오는 중 |
| `spear_ready` | 말린 새순을 준비하는 중 |
| `spear_furled` | 말린 새순 등장 |
| `spear_opening` | 새순이 펴지는 중 |
| `leaf_young` / `leaf_mid` / `leaf_mature` | 어린잎 / 중간잎 / 성숙잎 |

모르는 키가 들어오면 `phaseKo` 는 **키 그대로** 낸다 — 조용히 비우지 않는다.

### 3. `plant_grow.html?embed=game`

코어가 iframe 으로 띄울 때 쓴다. **튜닝 패널과 머리말이 사라지고 3D 무대가 전체 폭**이 된다.

```html
<iframe src="./plant_grow.html?embed=game"></iframe>
```

- 값이 **정확히 `game`** 일 때만이다. `?embed=1`·`?embed=GAME`·오타는 단독 화면 그대로다
- **단독 화면(파라미터 없음)은 하나도 안 바뀐다.** CSS 는 `html.embed` 아래에만 있다
- 캔버스는 원래 `#wrap` 전체(100vw×100vh)를 덮고 패널이 그 위에 떠 있던 구조라,
  패널만 걷으면 그것으로 전체 무대다 — 레이아웃을 새로 짜지 않았다
- 카메라 각도 버튼(`.views`)은 남긴다. 튜닝이 아니라 보기 도구다
- `isEmbedGame()` 으로 상태를 물을 수 있다
- HUD 는 **감춰졌을 뿐 계속 갱신**된다 — 그래서 `hudError` 값은 embed 에서도 유효하다

### 검증

```
① 렌더 신호   정상 drawn=true/null/null · 3D만 실패 drawn=false·hudError=null
              HUD만 실패 drawn=true·drawError=null · 둘 다 실패 사유 2개 따로
              콘솔 전부 [화면] · TH_LOADED 불변
② phaseKo     143~146 값 불변 · 키 5개 · vigor·생장일 없음
              0~300 경계 전수 불변 · 0~400 이름 매핑 이상 0건
③ 143→146    144 0.333 / 145 0.667 / 146 spear_furled 0.000 · 전 구간 drawn=true
④ 저광 정지    14일 유효 145 고정·progress 0.667 불변 → 재개(관성 1턴) → 146
⑤ A~I        전부 PASS
⑥ embed      6가지 쿼리 전부 기대대로 · 단독 화면 불변
실패 0건
```
