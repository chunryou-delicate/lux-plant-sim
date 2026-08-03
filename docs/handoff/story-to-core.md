# 2026-08-03 · story → core (game.html)

## 요청

**대사가 화면에 안 나온다.** `game.html` 은 못 건드리는 창이라 배선만 넘긴다 — 세 곳이고, 다 한 줄씩이다.

반지하 시작부터 원룸 이사까지 대사를 채웠다(`src/game/dialogue.js`). 사건 신호는
`loop.nextDay` 가 `turn.events` 한 목록으로 낸다. 지금 `game.html` 은 첫 플레이 세 개만
직접 하드코딩해 읽고 있어서, **월세·가을·식물등·정지·이사가 전부 조용하다.**

## 인터페이스

```js
import { createDialogue, createStoryteller } from './src/game/dialogue.js';

const dlg   = createDialogue();
const story = createStoryteller();     // 조용한 날을 세고 작은 말을 골라 준다
```

### ① 하루가 끝난 뒤 — `showFirstPlayEvents(turn)` 안의 `const ids = [...]` 를 이걸로 바꾼다

```js
/* 배너(숫자)는 그대로 두고, 대사만 storyteller 가 정한다.
   turn.events 에 첫 플레이·살림·식물·이사 신호가 전부 실려 온다. */
const ids = story.turn(turn, S);
if (ids.length) dlgOpen(ids);
```

지금 코드(`if (ev && ev.harvested) ids.push('harvest','god1') …`)는 **지운다.**
순서 계약(수확 → 식비 → 식물신 → 도착)은 `dialogue.scriptsForEvents` 의 `EVENT_ORDER` 가 지킨다.

### ② 식물등·이사 버튼 — 턴 밖에서 나는 일

```js
$('buyLamp').onclick = guard(() => {
  const r = buyLamp(S.tutorial);
  …기존 그대로…
  dlgOpen(story.events(r.events));      // ← 한 줄 추가
});

$('moveOut').onclick = guard(() => {
  const r = moveOut(S.tutorial);        // ← 반환값을 받는다
  …기존 그대로…
  dlgOpen(story.events(r.events));      // ← 이사 장면이 여기서 나온다
});
```

`buyLamp()` · `moveOut()` 이 이제 `events: [{id}]` 를 같이 낸다. 하루를 기다리면 산 순간·나간
순간이 조용해져서 반환값에 실었다. **기존 반환 필드는 그대로**라 안 고쳐도 안 깨진다.

### ③ 빨리감기 — `onDay` 안에서도 같은 창구를 쓴다

```js
onDay: (turn, info) => {
  …기존 그리기…
  const ids = story.turn(turn, S);
  if (ids.length) dlgOpen(ids);         // dlgOpen 이 알아서 빨리감기를 세운다
}
```

## 안 바꿔도 되는 것

- `FACE_FILE` — 그대로 둔다. 새 대사는 **거기 있는 키만** 쓴다
  (`jachwi` base·happy·worry·cry·surprise·tired / `moni` base·happy·sad·curious).
  `tools/test_dialogue_coverage.mjs` 가 `game.html` 을 읽어서 대조한다 — 베낀 표를 만들지 않았다.
- `dlgOpen` · `dlgPaint` · `SPEAKERS` — 손댈 것 없다.
- 식물신은 여전히 `portrait:false` 다. 얼굴을 만들지 말 것.

## 미해결 (core·plan 몫)

- [ ] **반복 수입이 없다.** 콩나물은 첫 시루 한 번뿐이고 판매도 없어서 소지금이 100만에서
      줄기만 한다 — 이사 자금 150만에 **영영 도달하지 못한다.** 그대로 두면 A·B 경로가
      존재하지 않는다. 재현은 하루 수입을 주입해서 잰다(`test_dialogue_coverage.mjs` 머리말).
- [ ] **콩나물을 밝은 자리에서 수확하면 반지하를 못 나간다.** 배움 ②(`cropDark`)는 첫 수확
      한 번으로만 판정되는데 시루가 하나뿐이라 되돌릴 길이 없다. 대사(`shortLearn`)로
      "왜 못 나가는지"는 설명되지만, **막다른 길인 것은 그대로다.** 둘째 시루가 답으로 보인다.
- [ ] **첫 플레이가 안 끝나면 살림 시계가 안 돈다**(`tutorial.tutorialDay` 의 `firstPlayDone`).
      어두운 자리에 방치하면 계절·월세·식물등이 영영 안 온다. 의도한 규칙이라 안 건드렸고,
      그 구간은 작은 말과 `plant_stalled*` 로 채웠다.
- [ ] **가을·겨울에 자연광이 실제로는 안 준다.** novice 모드가 `season:'summer'` 고정이라
      (`state.js` MODES) 조도는 그대로다. `autumnCame` 대사는 달력 사실만 말하고
      측정값을 말하지 않게 썼지만, 곡선이 붙어야 그 말이 진짜가 된다.
