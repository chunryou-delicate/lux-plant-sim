# 2026-07-26 · plan → growth

> 응답 규칙(박사님 2026-07-26): **받은 인계 파일은 손대지 않는다.**
> growth의 처리 보고는 `growth-to-plan.md`에 쓰고, plan이 읽어 **이 파일에** 표시합니다.

## 처리 현황 (plan 정리)

- **[처리됨]** 1차 §0 함수 5개 복구본 확인·커밋
- **[처리됨]** 1차 §1~2 **최소 루프 v0** 반영 ★
- **[처리됨]** 2차 튜닝값 JSON 분리 → `data/growth_tuning.json` 생성
- **[추가로 잡음]** NaN·음수 DLI가 확률을 NaN으로 만드는 버그 (growth 창이 발견)
- **[미확인]** 시나리오 결과와 남은 이견 — `growth-to-plan.md`가 **레포에 아직 없습니다**(§3차 참조)

---

# ■ 2026-07-26 (3차) · 요청 2건

## 1. ★ `growth-to-plan.md`가 없습니다

이 파일 머리말에 *"시나리오 결과와 남은 이견은 `docs/handoff/growth-to-plan.md` 참고"* 라고
적어주셨는데 **레포에 그 파일이 없습니다.** 커밋이 빠진 것 같습니다.

**최소 루프 v0의 실행 결과가 지금 제일 궁금한 것**입니다(박사님 우선순위 ①).
특히 이 세 가지:

| 확인하고 싶은 것 | 왜 |
|---|---|
| 반지하 등 0 → 1 → 2개로 **갈라짐이 실제로 켜지나** | "빛이 자라게 한다"의 증명. 이게 되면 ①이 끝납니다 |
| **말 피드백이 원인을 짚어주나** | 밴드만 뜨면 시뮬레이터입니다. A4가 재미 확인선 |
| **남은 이견** | 제 계수 제안 중 실제로 돌려보니 이상한 게 있으면 그게 제일 값진 정보입니다 |

## 2. `growth_tuning.json` → `data/balance/` 로 옮겨주세요

박사님이 `data/balance/` 를 plan 소유(튜닝값)로 정했습니다.

```
data/growth_tuning.json  →  data/balance/growth_tuning.json
```

`plant_grow.html`의 `fetch` 경로 한 줄과 같은 커밋으로 처리하시면 무중단입니다.
(제가 옮기면 그 사이 fetch가 404 → 코드 폴백으로 떨어져 **제 JSON 수정이 조용히 무시됩니다.**
폴백이 있어서 안 터지는 대신 더 헷갈립니다.)

**이미 옮긴 것**: `homes.json` · `characters.json`(로더 없어 바로 이동).
`light_thresholds.json`은 house에 요청 나갔습니다.

### JSON 분리 확인 — 잘 하셨습니다. 한 가지만

`_doc`에 적어주신 *"plant_grow.html은 파일 하나로도 열려야 해서 같은 값을 코드에도 갖고 있다"* —
**폴백 판단 맞습니다.** 제가 부탁드린 그대로입니다.

다만 `thresholds` 블록이 `light_thresholds.json`의 **사본**인 건 그대로 남았습니다.
`_doc`에 *"한쪽만 고치면 조도 엔진과 생장 창의 판정이 갈린다"* 고 적어두신 대로입니다.
**급하지 않습니다** — 다만 `data/balance/`로 둘 다 모이고 나면
`light_thresholds.json`을 직접 읽고 `thresholds` 블록을 지우는 게 가능해집니다.
그때 정리하면 사본이 사라집니다.

---

# ■ 2026-07-26 (2차) · ★ 요청 — 임계값·계수를 `data/*.json`으로 빼주세요

박사님 제안이고, **이번 동시 편집 충돌의 근본 해결**입니다.

지금 `plant_grow.html` 안에 **기획이 정해야 할 숫자**가 하드코딩돼 있습니다.
그래서 제가 밸런싱하려면 그쪽 파일을 열 수밖에 없었고, 실제로 작업이 한 번 날아갔습니다.

| 지금 코드 안에 있는 것 | 성격 |
|---|---|
| `TH_MONSTERA` | **`data/light_thresholds.json`의 복사본** — 이중 관리 |
| `VARIE_MULT = 1.4` | 밸런싱 값 |
| `fLight()`의 0 / 0.5 / 1.5 / 1.0 / 0.3 | 밸런싱 값 |
| `fStable()`의 0.15·0.30 경계, 1.3 / 1.0 / 0.7 | 밸런싱 값 |
| `calcMatureProb()`의 0.5 시작·0.6 과광 | 밸런싱 값 |
| `DLI_KEEP` · `dliAvg(7)` · `dliCV` 14일·최소 7샘플 | 밸런싱 값 |

**빼고 나면 제가 코드 파일을 열 이유가 0이 됩니다.** 앞으로 확률 튜닝은 JSON만 고칩니다.

## 제안 — `data/growth_tuning.json` (plan 소유)

파서가 필요 없게 **이름 있는 필드**로만 만들었습니다. 경계값은 코드가 계산합니다
(`varieBest_lo = best_lo × need_mult`).

```jsonc
{
  "schema": "growth_tuning/1",
  "_doc": [
    "생장 확률 = 빛의 함수. 계수는 전부 임시값이며 실플레이로 정밀화한다.",
    "근거: docs/GAME_PLAN.md §7",
    "임계값(die/survive/min/fenestrate/best/max)은 여기 두지 않는다 —",
    "data/light_thresholds.json 이 단일 진실 소스다."
  ],

  "variegation": {
    "base": 0.20,                      // P.varieProb — 잎마다 독립 판정
    "need_mult": 1.4,                  // ★ light_thresholds.json variegated.need_mult 와 같은 값
    "light_mult": {
      "below_min":        0.0,         // 정체 — 새 잎이 안 나므로 발현 기회 없음
      "min_to_varieBest": 0.5,
      "varieBest":        1.5,         // ★ 최적 대역 = best_lo~best_hi × need_mult (7.0~15.4)
      "varieBest_to_max": 1.0,
      "over_max":         0.3          // 흰 부분이 먼저 탄다
    },
    "stability_mult": {
      "cv_le_0_15": 1.3,               // 안정 — 재현성 보상
      "cv_le_0_30": 1.0,
      "else":       0.7,
      "unknown":    1.0                // 기록 부족 = 모름 → 중립. 공짜 보너스 금지
    }
  },

  "fenestration": {
    "base": 0.22,                      // P.matureProb
    "below_fenestrate": 0.0,           // 못 본다 — 등을 사거나 이사해야 한다
    "at_fenestrate":    0.5,           // 문턱을 넘는 순간 '켜진다'
    "full_at":          "best_hi",     // 여기서 base 그대로
    "over_max":         0.6            // 과광 — 잎이 상해 성숙이 더디다
  },

  "branch_ratio_follows_light": false, // matRare/matSub에는 배율을 태우지 않는다.
                                       // 두 번 곱하면 관리 보상이 5.6배가 아니라 30배가 된다

  "history": {
    "keep_days": 30,
    "avg_days": 7,                     // 하루 값으로 판정하지 않는다 (light_contract.md §3)
    "cv_days": 14,
    "cv_min_samples": 7
  }
}
```

## 부탁 — 두 가지만 지켜주시면 됩니다

**① 로드 실패해도 돌아가야 합니다.** `plant_grow.html`은 단독 실행되는 튜닝 창이라
JSON을 못 읽어도 지금 상수로 떨어져야 합니다.

```js
let GT = GROWTH_TUNING_DEFAULT;                    // 지금 상수들을 그대로 담은 폴백
fetch('data/growth_tuning.json').then(r=>r.json())
  .then(j=>{ GT=j; buildPlant(); })
  .catch(()=>console.warn('[growth_tuning] 기본값 사용'));
```

**② `TH_MONSTERA`는 `data/light_thresholds.json`에서 읽어주세요.**
지금 복사본이라 한쪽만 고치면 조용히 어긋납니다. 실제로 제가 코드 주석에
*"저기를 고치면 여기도 고칠 것"* 이라고 적어뒀는데, 그건 **버그를 예약해 둔 것**입니다.

## 슬라이더는 그대로 두셔도 됩니다

JSON이 **기본값**이고 슬라이더가 **일시 조정**이면 충분합니다.
튜닝하다 좋은 값이 나오면 알려주세요 — 제가 JSON에 반영하겠습니다.

## 2차 미해결

- [ ] `growth_tuning.json` 외부화
- [ ] `TH_MONSTERA` → `light_thresholds.json` 참조로 전환

---
---

# ■ 2026-07-26 (1차)

## 0. 먼저 — 사고 보고 (확인 부탁)

`plant_grow.html` 리팩터(`setDailyLight(c, slotId)` · `dliAvg` · `dliHistory` ·
`resetDailyLight` 도입) 과정에서 **함수 5개가 호출부만 남고 정의가 사라져 있었습니다.**

| 사라졌던 것 | 남아 있던 호출부 |
|---|---|
| `dli7()` | `calcVarieProb` · `calcMatureProb` |
| `dliCV()` | `fStable` |
| `fLight()` | `calcVarieProb` · DLI 슬라이더 |
| `fStable()` | `calcVarieProb` · DLI 슬라이더 |
| `setDailyLightSteady()` | DLI 슬라이더 핸들러 |

`PLANT_DLI`가 `null`일 땐 상수로 빠져나가서 **티가 안 났지만**, 조도를 연동하는
순간(슬라이더 ≥ 0 또는 루프 연결) `ReferenceError`로 터집니다.

→ **plan 창이 임의로 복구했습니다(미커밋).** 새 이름(`DLI_HIST`·`dliAvg`)에 맞춰
다시 썼습니다. 경계를 넘은 편집이라 죄송합니다 — **확인 후 growth 창이 커밋해 주세요.**
이후로 `plant_grow.html`은 건드리지 않겠습니다.

---

## 1. 요청 — ★ 최소 루프 (지금 유일한 우선순위)

박사님 결정: **①까지 오면 재미 확인선.** 설계는 충분하니 이제 돌려봐야 합니다.

```
① 최소 루프 — 한 그루로 [다음 날] 돌리기   ← 지금 유일한 우선순위
② A4 말 피드백 → 재미 확인선
③ 재밌으면 3단계 경제
```

목적은 하나입니다: **"빛이 자라게 한다"를 눈으로 보는 것.**
조도(DLI 적분·차광·창 향·천창)에 그렇게 공들였는데 **아직 아무것도 자라지 않고 있습니다.**

### 넣을 것 / 뺄 것

| 넣는다 | 뺀다 |
|---|---|
| `[다음 날]` 버튼 · 날짜 | 저장/로드 |
| 날씨 굴림 → DLI → `setDailyLight` → `setGrowth` | 경제(식비·월세·전기) ← **로드맵 3단계** |
| 밴드 표시 + **A4 말 피드백** | 상점·판매 · 물주기 |
| 방 선택 · 식물등 개수 | **다개체** (이 파일은 한 그루 전용) |

---

## 2. 인터페이스 — 붙여 쓸 수 있는 코드

DLI는 방별 실측표(`docs/balance_decisions.md`) 기반 **스텁**입니다.
진짜 엔진(`buildDailyLight`)은 `house.js`·THREE에 얽혀 있어 이 창에서 못 부릅니다.
코어 루프가 붙으면 `setDailyLight(L.total)` 한 줄을
`setDailyLight(계약객체, slotId)`로 갈아끼우면 되고 **나머지는 그대로 씁니다.**

```js
/* ===== ★ 하루 살기 — 최소 게임 루프 ===== */
const ROOMS={                                   // 맑음·여름 최고 슬롯 DLI (실측)
  banjiha:{ko:'반지하',peak:0.55}, oneroom:{ko:'원룸',peak:4.77},
  classroom:{ko:'학원교실',peak:5.49}, tworoom:{ko:'투룸',peak:5.64},
  apartment:{ko:'아파트',peak:6.26}, greenhouse:{ko:'온실',peak:13.01}
};
// 계수는 docs/engine/light_contract.md §2 와 같은 값
const WEATHER_K={ clear:{k:1.00,ko:'☀️ 맑음',p:0.55}, cloudy:{k:0.25,ko:'☁️ 흐림',p:0.30}, rain:{k:0.12,ko:'🌧️ 비',p:0.15} };
const SEASON_K ={ spring:{k:0.85,h:12.5,ko:'봄'}, summer:{k:1.00,h:14.5,ko:'여름'},
                  autumn:{k:0.80,h:12.0,ko:'가을'}, winter:{k:0.55,h:9.8,ko:'겨울'} };
const LAMP_DLI_PER_WH=0.045;   // 클립등 12W×12h → DLI 6.48 (balance_decisions §②) 역산
const GAME={ day:1, room:'banjiha', lamps:0, lampW:12, lampH:12 };

function seasonOf(day){ return ['spring','summer','autumn','winter'][Math.floor(((day-1)%360)/90)]; }
// 날짜를 시드로 굴린다 — 되감아도 같은 날씨. 세이브 없이 일관되고 디버깅이 된다.
function rollWeather(day){
  const r=mulberry32((day*2654435761)>>>0)();
  let acc=0; for(const k of Object.keys(WEATHER_K)){ acc+=WEATHER_K[k].p; if(r<acc) return k; }
  return 'clear';
}
function dliOfDay(day){
  const S=SEASON_K[seasonOf(day)], W=WEATHER_K[rollWeather(day)], R=ROOMS[GAME.room];
  // 겨울은 어둡고(×0.55) + 짧다(9.8/14.5). 둘을 곱해야 실측값이 나온다.
  const natural = R.peak * W.k * S.k * (S.h/14.5);
  const lamp    = GAME.lamps * GAME.lampW * GAME.lampH * LAMP_DLI_PER_WH;
  return { natural, lamp, total:natural+lamp, S, W, R };
}
function bandOf(d){
  const T=TH_MONSTERA;
  if(d<T.die) return {k:'die',ko:'고사'};        if(d<T.survive) return {k:'weak',ko:'쇠약'};
  if(d<T.min) return {k:'survive',ko:'정체'};    if(d<T.best_lo) return {k:'slow',ko:'느림'};
  if(d<=T.best_hi) return {k:'best',ko:'최적'};  if(d<=T.max) return {k:'good',ko:'성장'};
  return {k:'over',ko:'과광'};
}
function stepDay(n){
  n=n||1;
  for(let i=0;i<n;i++){
    const prev=LAST_STATS;
    GAME.day++;
    const L=dliOfDay(GAME.day);
    setDailyLight(L.total);   // ← 코어 루프 붙으면 setDailyLight(report, slotId)
    setGrowth(GAME.day);      // buildPlant()까지 돌아 LAST_STATS 갱신
    if(i===n-1) renderDayUI(prev, L);
  }
}
```

### A4 말 피드백 — 이게 "재미 확인선"의 실체입니다

밴드만 보여주면 시뮬레이터고, **"왜 안 자라는지"를 말로 알려줘야** 게임이 됩니다.
`light_contract.md` §1이 `dli_daylight`/`dli_lamp`를 나눠둔 이유가 이겁니다 —
*"오늘 안 자란 게 날씨 탓인지 등을 안 켠 탓인지"*.

```js
const BAND_MSG={
  die:'🥀 빛이 거의 없어요. 이대로면 오래 못 버텨요.',
  weak:'😞 잎이 처져요. 빛이 모자라요.',
  survive:'😐 살아는 있는데 새 잎이 안 나요.',
  slow:'🙂 천천히 자라는 중이에요.',
  best:'🌱 무럭무럭! 지금 자리가 딱 좋아요.',
  good:'😊 잘 자라요.',
  over:'🥵 빛이 너무 세요. 잎이 타요 — 차광이 필요해요.'
};
function dayFeedback(prev, cur, L, band){
  const m=[];
  if(cur.leaves>prev.leaves) m.push('🍃 새 잎이 났어요!');
  if(cur.varie >prev.varie ) m.push('✨ <b>무늬가 나왔어요!</b>');
  if(cur.mature>prev.mature) m.push('🌿 <b>잎이 갈라지기 시작했어요!</b>');
  m.push(BAND_MSG[band.k]);
  if(band.k==='survive'||band.k==='weak'||band.k==='die'){
    if(GAME.lamps===0) m.push('💡 식물등을 켜면 올릴 수 있어요.');
    else if(L.natural < L.lamp*0.2) m.push('☁️ 자연광이 거의 없어요. 등에 전부 기대는 중.');
  }
  if(band.k!=='die' && PLANT_DLI!=null && calcMatureProb(PLANT_DLI)===0)
    m.push('🔎 갈라진 잎은 DLI 6.0부터예요. (지금 7일평균 '+(dliAvg(7)||0).toFixed(2)+')');
  return m;
}
```

### 필요한 집계 — `buildPlant()` 안에 3줄

새 잎·무늬·갈라짐을 "어제와 비교"하려면 카운터가 필요합니다.

```js
// 선언부:  let stage='', nodes=0, leaves=0, nVarie=0, nMature=0;
// 잎 그리는 자리:
if(g>=ax.leafBirth){ drawLeafStage(...); nLeaf++;
  if(ax.varie) nVarie++; if(ax.canMature) nMature++; }
// buildPlant() 끝:
LAST_STATS={nodes, leaves, varie:nVarie, mature:nMature};
// 파일 어딘가에:
let LAST_STATS={nodes:0,leaves:0,varie:0,mature:0};
```

---

## 3. 이렇게 하면 보이는 것 (예상)

반지하 · 등 0개로 시작하면:

| | DLI | 판정 |
|---|---|---|
| 맑음 여름 | 0.55 | **쇠약** — "잎이 처져요" |
| 흐림 겨울 | 0.05 | **고사 밴드** — "빛이 거의 없어요" |
| 등 1개 켜면 | 6.7 | **최적** + 갈라짐 켜짐 |
| 등 2개 | 13.2 | 최적 + **무늬 확률 13% → 39%** |

**"등을 켜니까 잎이 갈라지기 시작했어요"가 화면에 뜨는 순간**이 이 프로젝트의
첫 번째 진짜 확인입니다.

---

## 미해결

- [ ] 다개체 리팩터 — `SEED`·`GROWTH`·`PLANT_DLI`·`PLANT_SLOT`·`DLI_HIST`·`plantGroup`이
      전부 전역이라 화분이 여럿이면 마지막 것으로 덮입니다. **MVP는 한 그루로.**
      인터페이스(`setDailyLight(report, slotId)`)는 이미 다개체 전제라 리팩터 뒤에도 호출부는 그대로입니다
- [ ] 고사 판정 — 하루 값으로 죽이면 운으로 죽습니다. `dliAvg(7)`이 5일 연속 `die` 아래일 때만
      (`light_contract.md` §3 필수 요구사항). MVP에선 죽이지 않고 메시지만 띄워도 됩니다
- [ ] 1:1 모드에서 `dliCV()`가 7일(=168 실시간 시간) 동안 `null`입니다.
      "관찰 기록 n/7일" UI 필요 (`GAME_PLAN.md` 시간 모드)

---

# ■ 2026-07-27 (4차) · ★ `matRare`를 **과광 조건부**로

지금 `calcMatRare()`는 상수를 그대로 돌려줍니다(빛과 무관).
이걸 **`DLI7 > max`(과광)일 때만** 나오도록 바꿔주시면 좋겠습니다.

## 왜 — 숫자에서 이미 나와 있었습니다

house 재측정으로 **온실 peak 16.16 > 몬스테라 `max` 16.0**이 됐습니다.
**자연광으로 과광 구간에 드는 방은 온실뿐**이고, 다른 방은 아무리 해도 못 넘습니다.

그리고 `plant_grow.html:1121`이 이미 이렇게 되어 있습니다:

```js
const MAT_RARE=[1,43,37,49];  // 핑크-로즈핑크 / 핑크-로즈 / 모브-라벤더그레이 / 차콜-다크그린
```

**핑크·모브 계열이 3종입니다. 새 에셋이 필요 없습니다.**

> **근거가 실제 식물생리입니다.** 핑크·모브의 정체는 **안토시아닌**이고,
> 안토시아닌은 **강광 스트레스 방어 색소**입니다. 다육·관엽이 강한 빛에 붉게 물드는
> 그것이고, 핑크프린세스·신고니움 핑크가 광량이 높아야 핑크가 진해집니다.
> **규칙이 아니라 물리에서 나옵니다.**

## 제안 — `growth_tuning.json`에 블록 하나

```jsonc
"rare_variegation": {
  "_doc": [
    "희귀 무늬(MAT_RARE 4종 = 핑크·모브·차콜)는 과광에서만 나온다.",
    "안토시아닌은 강광 스트레스 방어 색소다 — 실제 생리 그대로.",
    "자연광으로 과광에 드는 방은 온실뿐(peak 16.16 > max 16.0)."
  ],
  "requires_overlight": true,    // DLI7 > thresholds.max 일 때만
  "base": 0.10,                  // 과광일 때의 확률 (지금 matRare 값)
  "below_overlight": 0.0         // 과광이 아니면 0
}
```

```js
function calcMatRare(ctx){
  const R = GT.rare_variegation;
  if (!R || !R.requires_overlight) return P.matRare;      // 폴백
  const d = ctx.dli7 ?? dliAvg(7);
  if (d == null) return P.matRare;                         // 조도 미연동 = 튜닝 모드
  return d > TH.max ? R.base : (R.below_overlight ?? 0);
}
```

**⚠ 폴백을 꼭 남겨주세요** — `PLANT_DLI`가 `null`이면 지금처럼 상수를 써야
단독 튜닝 창이 계속 돕니다.

## 영향 — 알아두실 것

| 누가 | 과광에 어떻게 닿나 | 희귀 무늬 |
|---|---|---|
| **연구자** | 온실 16.16 — **신분으로 공짜** | ○ |
| 자취생 | 반지하 등 2개 ≈ 24.7 | ○ — **전기값 + 개체가 상하는 위험** |
| 아파트·원룸·투룸 | 못 닿음 | ✕ |

**과광에서는 잎이 타고 개체가 상합니다**(`fLight` 0.3 · `matureProb` ×0.6).
*"견디고 뽑아낸다"* 가 되는 게 의도입니다 — 위험을 감수하는 플레이입니다.

> 자취생의 "희귀 한 방 = 탈출권"이 **등 2개 + 과광 감수**로 바뀝니다.
> 경제 시뮬은 ⏸ 방 재측정 대기라 지금 다시 돌리지 않았습니다.

## 검토 — 저광 전용 변이는 만들지 않습니다

물리가 이미 막고 있습니다:

```
fLight(DLI7 < min 3.0) = 0  →  새 잎이 아예 안 난다(정체)
                            →  새 잎의 변이가 나올 기회가 없다
```

**"새 잎이 안 나는데 새 잎의 변이가 나올 수 없다."** 규칙을 추가할 필요가 없습니다.

## 4차 미해결

- [ ] `matRare` 과광 조건부 전환
- [ ] `growth_tuning.json` → `data/balance/` 이동(3차 요청)은 여전히 유효

---

# ■ 2026-08-01 (5차) · ★ 대기 6건 전부 답합니다

## 1. [확정] 아파트 갈라짐 → **⑶ 문서 수정. 이미 확정됐습니다**

또 물으셨는데 **이미 결정된 사안**입니다(2026-07-26, 박사님 승인).
**자연광으로 갈라지는 방은 온실(여름)뿐**이고, 아파트도 등이 필요합니다.
`balance_decisions.md` §②″ · `GAME_PLAN.md` §6에 반영돼 있습니다. **그쪽 권고와 같습니다.**

> 다만 **모드마다 다릅니다** — 초보 모드는 판정이 `peak`라 아파트도 갈라집니다.
> 심화 기준이 위 결론입니다. `data/balance/weather.json`의 `modes` 블록 참조.

## 2. [확정] ★ 개체 소질 2층 구조 — 값 드립니다

그쪽 지적이 정확합니다. **매 잎이 독립이면 실생 선발이 성립하지 않습니다.**
연구자 트랙의 전제가 코드에 없었습니다.

```jsonc
// data/balance/growth_tuning.json 에 추가
"individual_potential": {
  "_doc": [
    "★ 2층 구조 — 개체 소질(씨앗 1회 결정) × 잎 발현(잎마다).",
    "이게 없으면 실생 100개를 심어도 좋은 개체를 고를 수 없다(연구자 트랙 붕괴).",
    "계열까지 개체가 갖는다 — 유전형이 계열을 정하는 게 생물학적으로도 맞다."
  ],
  "base": 0.10,                    // ★ 잎 발현 기저값. 기존 varieProb 0.20 → 0.10 으로 내림
  "grades": {
    "plain":     { "p": 0.70, "mult": 0.0 },
    "normal":    { "p": 0.25, "mult": 1.0 },
    "potential": { "p": 0.04, "mult": 2.5 },
    "elite":     { "p": 0.01, "mult": 6.0 }
  },
  "lineage_pool": "MAT_TREE_MAIN",  // ★ 33종이 아니라 주 갈래 10그룹
  "lineage_fixed_per_plant": true   // 한 개체의 무늬는 항상 같은 계열
}
```

```
잎 발현 확률 = base(0.10) × fLight × fStable × grades[등급].mult
잎이 무늬면 → 그 개체의 계열로 발현 (잎마다 계열이 달라지지 않는다)
```

### 왜 이 값인가 — 두 조건을 동시에 만족합니다

**① 선발이 성립한다** (온실 최적 관리 기준, 첫 잎이 무늬일 확률):

| 등급 | 분포 | 첫 잎이 무늬 |
|---|---|---|
| plain | 70% | **0%** |
| normal | 25% | 20% |
| potential | 4% | 49% |
| **elite** | **1%** | **100%** |

→ **첫 잎(11일)에 무늬가 보이면 소질 있는 개체다.** 45개 심고 골라내는 게 성립합니다.

**② 논문 1편이 목표 구간에 든다**:

```
온실 45슬롯 · 회전 11일 · 회당 무늬 발현 개체 약 3.5개
계열 10그룹에 흩어짐 → 같은 계열 3개까지 3~4회전 = 33~44일
→ acceptance.json 의 researcher_paper_turns (30~45턴) 통과 ✔
```

> **계열 풀을 33종이 아니라 10그룹으로 잡은 게 핵심**입니다. 33종이면 88~121일이라
> 목표를 크게 넘습니다. `MAT_TREE`의 주 갈래만 개체 계열로 쓰고,
> 부 갈래(`matSub`)는 그 안의 변주로 남기면 됩니다.

## 3. [확정] `f_propagation` — 삽수는 **0.8배 계승, 계열은 100% 동일**

```jsonc
"f_propagation": {
  "batch":      { "grade_mult": 0.8, "lineage_inherit": 1.0 },
  "individual": { "grade_mult": 1.0, "lineage_inherit": 1.0 }
}
```

- **등급은 0.8배로 물려받는다** — 기존 문서의 *"수경번식 무늬 80% 계승"* 이 이 값입니다
- **계열은 100% 동일** — 유전적 복제니까요
- ★ **그래서 삽수는 논문 표본이 못 됩니다.** 계열이 같아 "서로 다른 모체" 조건을 못 채웁니다.
  `GAME_PLAN.md` §8의 정합 논리가 여기서 코드로 성립합니다
- `individual`(개별 처리) 보너스는 **등급 배율 1.0** — 손이 더 가는 대신 손실이 없습니다.
  *"수고 ↔ 확률"* 트레이드오프가 이 한 줄입니다

## 4. [확정] `calcVarieType` — **개체 계열을 그대로 반환**

```js
function calcVarieType(ctx){
  return ctx.plant.lineage;   // 개체가 씨앗 때 정해진 계열. 잎마다 뽑지 않는다
}
```

`MAT_TREE`로 주/부를 가르는 건 그대로 두시고(`matSub`), **어느 그룹인지만** 개체가 정합니다.

## 5. [확정] vigor 표시 토글 → **새로 만들지 마세요. 정보 축에 이미 있습니다**

```
초보  숫자로 표시        표준  막대로 표시        고수  표시 없음
```

`GAME_PLAN.md` §3(정보 축)에 **vigor가 이미 그 축에 묶여** 있습니다.
**별도 토글을 만들면 축이 하나 더 늘어납니다.** 프리셋이 정하게 두세요.

## 6. [확정] `matRare` 과광 조건부 → **4차 요청대로 진행**

`DLI7 > thresholds.max`(16.0)일 때만. **자연광으로는 온실만 닿습니다.**
스키마·폴백 코드는 4차에 있습니다.

## 7. [확정] `growth_tuning.json` → **`data/balance/` 로 이동**

3차 요청 유지입니다. `plant_grow.html`의 `fetch` 경로 한 줄과 **같은 커밋**으로 부탁드립니다
(제가 옮기면 404 → 폴백으로 떨어져 **제 수정이 조용히 무시**됩니다).

## 5차 미해결

- [ ] 위 값들을 `growth_tuning.json`에 반영 (제가 파일을 받으면 직접 넣겠습니다)
- [ ] `base` 0.20 → 0.10 변경이 기존 튜닝 화면에 미치는 영향 확인 부탁드립니다
