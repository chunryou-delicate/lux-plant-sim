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

### 2. 고사 판정은 이동평균으로

날씨가 굴러가면 같은 자리도 하루 값이 크게 흔들린다(반지하 산세 맑음 0.54 ↔ 흐림 0.14).
하루 값으로 죽이면 운으로 죽는다.

- **고사** — `dliAvg(7)`. 되돌릴 수 없는 판정이라 흔들리면 안 된다
- **성장률** — 하루 값. "오늘 해가 좋아서 잘 자랐네"가 매일 보여야 자리 옮긴 효과를 배운다
- **경고 표시** — 하루 값으로 즉시. 실제 고사는 그게 일주일 이어졌을 때 → 고칠 시간이 생긴다

고사·수확 판정 자체는 이 파일에 없다. 코어가 `dliAvg(7)`을 읽어 판단하면 된다.

### 3. 무늬종 광량 계수는 집/방 창 몫

`data/light_thresholds.json`의 `variegated.need_mult = 1.4`. 생장 창에도 같은 값이 `VARIE_MULT`로 있고
`bandOf(dli, true)`가 그걸 쓴다. **둘이 어긋나면 안 된다** — 한쪽을 고치면 반드시 다른 쪽도 고칠 것.
`judgeDLI` 쪽에 계수를 먹이는 건 집/방 창에서 해야 한다.

### 4. ⚠ 다른 창이 이 파일을 직접 고치고 있다

`plant_grow.html`에 `TH_MONSTERA` · `VARIE_MULT` · `fLight()` · `fStable()` · `dliCV()` ·
`setDailyLightSteady()` 가 생장 창을 거치지 않고 들어와 있었다(내용은 좋다).
**같은 파일을 두 창이 고치면 파일 지정 커밋으로도 못 막는다.** 이 파일 수정은 생장 창을 거쳐 주기 바란다.

---

## 이 파일에 없는 것

지출·수입·수확·저장·상점·식비. 전부 코어 몫이다.
여기엔 "얼마나 자랐나"만 있고 죽음·수확 개념 자체가 없다.
