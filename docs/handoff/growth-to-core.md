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
nextDay()                        // 한 턴 = 하루. 오늘 빛 기록 → 생장 1틱 → 다시 그리기
setGrowth(일수)                   // 특정 날짜로 이동
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
const c = makeDailyLight(day, ...);   // 집/방 창
setDailyLight(c, '이 화분의 슬롯 id'); // 생장 창
setGrowth(day);                       // 생장 창 (또는 nextDay())
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

### 2. 고사 판정 — ~~이동평균~~ → 체력 모델 (아래 별도 절)

~~코어가 `dliAvg(7)`을 읽어 판단한다~~ 는 계획은 **폐기됐다.** 아래 "체력(vigor) 모델" 절 참고.
**코어는 고사를 판정하지 않는다** — growth가 `vigor()`·`isDead()`로 알려준다.

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

## ★ 고사 판정 = 체력(vigor) 모델 — 설계 확정, 구현은 v1

**`dliAvg(7)`로 고사를 판정하는 계획은 폐기됐다.** (박사님 결정 2026-07-26)
이동평균은 체력의 근사치인데 더 복잡하고, 무엇보다 **회복과 손상이 구분되지 않는다** —
3주 어두웠다 밝아지면 아무 일 없던 게 된다. 실제 식물은 "살아났지만 아래 잎 두 장은 잃었다"가 맞다.

```
이동평균 = 7일 이력 저장 + 평균 + 임계값 비교
체력     = 숫자 하나, 매일 더하기 한 번
```

※ `dliAvg(7)` 자체는 남는다 — `fStable`(안정 보너스) 등 다른 용도로 쓰인다.

### 코어가 쓸 인터페이스 (v1에 생긴다)

```js
vigor()      // 0~100. 현재 체력
isDead()     // vigor <= 0
nextDay()    // 안에서 vigor를 갱신한다 — 코어는 따로 부를 것이 없다
```

**vigor는 개체 상태라 growth 소유다. 코어는 읽기만 하고 판정하지 않는다.**
다개체 리팩터 때 `SEED`·`GROWTH`·`PLANT_DLI` 와 함께 개체 객체로 묶는다.

### 수치

전부 `data/growth_tuning.json`의 `vigor` 절에 있다. plan이 튜닝한다.
밴드별 일일 증감(critical −3.0 … best +2.0), 종별 계수(몬스테라 ×1.0 / 산세 ×0.3),
잎 손실(체력 30 미만에서 4일마다 아래 잎부터 **영구** 손실), 시각 연동, 표시 수준.

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
