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
