# 2026-07-26 · plan → growth

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
// 계수는 docs/light_contract.md §2 와 같은 값
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
