# 2026-08-11 · guide → plan (게임 안 플레이어 안내를 훑고 고칠 것)

이 창은 **한 글자도 안 고쳤다.** `game.html` 과 `src/game/dialogue.js` 는 다른 워커가 잡고 있어
읽기만 했다. 아래는 전부 **붙여넣으면 되는 형태**로만 적은 것이다.

문구 대장(진행 순서대로 전부)은 `docs/player_guide.md`.
그림은 `docs/engine/shots/guide/` 여섯 장.

---

## 0. 무엇을 켜고 무엇을 껐나 (실측 조건)

```
서버        python tools/serve.py 8963      ·  BYEOT_URL=http://localhost:8963
브라우저     헤드리스 크롬 · 390×844 dpr2 · 터치 켬 (길이 잴 때만 360×780 · 430×932 도)
저장        매번 localStorage.clear() 하고 새 판
조작        전부 손가락 좌표로 눌렀다 — DOM 의 .click() 은 안 썼다
            (예외 넷: 시트 열고 닫기 · 확대창 열기 · 몬스테라 자리 select · 상점 줄 좌표 계산)
안 켠 것     식물등 · 삽수 · 무순 · 이사 · 파산 — 첫 플레이 50일 안에 안 나온다
지운 것      임시 확인 스크립트 여섯 개(tools/_probe_guidetmp*.mjs) — 확인 끝나고 지웠다
```

밟은 길: Day 0 시루 놓기 → 물 → 5일 → 수확 → (씨앗 주문 → 심기 → 물) ×3 →
**Day 21~23 몬스테라 도착** → 창턱으로 옮김 → **Day 50 말린 새순** → Day 51 살림 시작.

---

## 1. 결론 세 줄

1. **손 안에서 막히는 데는 없다.** 말풍선이 곧 버튼이고 손가락이 그걸 가리키는 축이 잘 서 있어서,
   「어디를 눌러야 하나」는 첫 플레이 내내 한 번도 안 막혔다.
2. **막히는 것은 「왜」와 「그다음」이다.** 이 게임의 핵심(**자리마다 밝기가 다르다**)을 대놓고
   말하는 화면은 **Day 50 의 축하 배너 한 장**뿐이고, 첫 플레이가 끝나면 아래 한 줄이
   **거기서 멈춘 채 이사할 때까지 안 바뀐다.**
3. ★ **틀린 말을 하는 곳이 하나 있다** — 몬스테라 팔기 안내가 이사비를 **150만원**으로 말한다.
   실제는 200만원이다(`tutorial.js:57`). 아래 **P-00** 이 그것이다.

---

## 2. 급한 순 — 붙여넣을 변경안

### ★ P-00 · 팔기 안내가 이사비를 50만원 적게 말한다 (거짓말)

**무엇을 모르는가** — 플레이어는 「지금 팔면 이사 자금이 됩니다」를 보고 판다. 그런데 그때
가진 것은 150만원어치고 이사비는 200만원이라, **팔고 나서야 50만이 모자란 것을 안다.**
되돌릴 수 없는 동작이라 그 판은 거기서 꼬인다.

`game.html:3156~3164` — **그대로 바꾼다**

```js
  /* ★"얼마가 모자란가"가 아니라 "무늬 잎이 몇 장이면 되나"를 말한다 —
     플레이어가 움직일 수 있는 손잡이는 자리(밝기)뿐이고, 그게 무늬를 만든다. */
  const nd = varieLeavesNeededFor(1_500_000, { leaves: ls.leaves });
  const n = nd && nd.needVarieLeaves;
  hint.textContent = won >= 1_500_000
```

↓

```js
  /* ★"얼마가 모자란가"가 아니라 "무늬 잎이 몇 장이면 되나"를 말한다 —
     플레이어가 움직일 수 있는 손잡이는 자리(밝기)뿐이고, 그게 무늬를 만든다.
     ★★ 2026-08-11 — **이사 자금의 정본은 규칙이다**(`TUTORIAL_RULES.moveOutCostWon`).
       여기 박혀 있던 1,500,000 은 이사비가 200만으로 오르기(2026-08-09) 전의 옛 값이라,
       150만어치에서 「지금 팔면 이사 자금이 됩니다」라고 **50만이 모자란 채로** 말했다.
       숫자를 두 곳에 적지 않는다 — 규칙이 바뀌면 이 줄이 따라온다. */
  const needWon = (S.tutorial && S.tutorial.rules && S.tutorial.rules.moveOutCostWon) || 2_000_000;
  const nd = varieLeavesNeededFor(needWon, { leaves: ls.leaves });
  const n = nd && nd.needVarieLeaves;
  hint.textContent = won >= needWon
```

> ⚠ **화면으로는 확인 못 했다.** 모주를 팔 수 있는 판(무늬 잎이 붙은 판)까지 못 갔다.
> 확인한 것은 ㉠ 코드에 1,500,000 이 박혀 있다는 것과 ㉡ 실제 이사비가 200만이라는 것
> (화면에서 현금 1,277,000 · 부족 723,000 = 200만) 둘이다.

---

### ★ P-01 · 첫 플레이가 끝나면 아래 한 줄이 멈춘다

**무엇을 모르는가** — 첫 플레이가 끝난 다음 날부터 **이제 뭘 해야 하는지 화면 아래가 말하지
않는다.** `말린 새순이 나왔습니다! …` 가 그대로 남아 있다. 목표(이사 자금 N원)는
`#tutBox` 안에만 있고, 그 상자는 **[방] 탭**에 있다 — 안 열어 본 사람은 영영 못 본다.

**실측** — Day 51. `#quest` = `말린 새순이 나왔습니다! 어두운 자리와 밝은 자리를 모두 찾았습니다.`
`#tutGoal` = `이사 자금 723,000원이 더 필요합니다` (보이는 곳: [방] 탭뿐).
그림 `docs/engine/shots/guide/05_firstplay_done.png` · `06_room_tab_living.png`

`game.html:4080~4085` — **그대로 바꾼다**

```js
  const justMoved = fp.phase === 'move_monstera' && plant.arrived &&
                    arrivalSlotId != null && plant.slotId !== arrivalSlotId;
  $('quest').textContent = justMoved
    ? `${slotLabel(plant.slotId)}(으)로 옮겼습니다. 빛 판정은 7일 평균이라 ` +
      `나흘쯤 지나야 새 자리 값이 됩니다 — 하루씩 넘겨 보세요.`
    : (quest[fp.phase] || '첫 플레이를 진행하세요.');
```

↓

```js
  const justMoved = fp.phase === 'move_monstera' && plant.arrived &&
                    arrivalSlotId != null && plant.slotId !== arrivalSlotId;
  /* ★★ 2026-08-11 — 첫 플레이가 끝나면 이 줄은 **살림 목표**로 넘어간다.
     ------------------------------------------------------------
     예전에는 `complete` 문구가 이사할 때까지 그대로 남았다(실측 Day 51). 그동안 목표는
     `#tutBox` 안에만 있는데 그 상자는 **[방] 탭**이라, [가방]만 여는 사람은 「이사 자금이
     얼마 남았는지」를 한 번도 못 본다. 화면에서 제일 잘 읽히는 줄이 아무 말도 안 하고 있었다.
     ⚠ 문구를 여기서 새로 짓지 않는다 — `tutorialGoal(ts)` 이 정본이고 [방] 탭과 같은 말이다. */
  let livingGoal = null;
  if (fp.completed && ts && ts.enabled && !ts.movedOut) {
    try { livingGoal = (tutorialGoal(ts) || {}).ko || null; } catch { livingGoal = null; }
  }
  $('quest').textContent = justMoved
    ? `${slotLabel(plant.slotId)}(으)로 옮겼습니다. 빛 판정은 7일 평균이라 ` +
      `나흘쯤 지나야 새 자리 값이 됩니다 — 하루씩 넘겨 보세요.`
    : (livingGoal || quest[fp.phase] || '첫 플레이를 진행하세요.');
```

- `ts` 와 `tutorialGoal` 은 **이미 그 함수 범위에 있다**(`game.html:4000` · `2573`). 새 import 가 없다.
- 나오는 말: `이사 자금 723,000원이 더 필요합니다` (20자 · 한 줄) ·
  `원룸으로 이사할 수 있습니다` (13자) · 배움이 남았으면 그 항목 이름.

**☐ 판단 필요 —** 완료 축하 문구(`말린 새순이 나왔습니다! …`)를 **며칠은 남길지**.
지금 이 안은 다음 날 바로 목표로 넘어간다. 축하는 초록 배너(`말린 새순이 나왔어요!`)가
따로 있으니 겹치지는 않는다고 봤는데, 「끝냈다」는 여운을 하루는 두는 쪽이 맞을 수도 있다.

---

### ★ P-02 · 손가락이 틀린 탭을 가리킨다 · 몬스테라 물주기를 안 가리킨다

**무엇을 모르는가** — ① 손가락이 `가방에서 살림을 봅니다` 라고 하며 **[가방] 단추**를 가리키는데,
그 단추는 늘 **[가방] 탭**을 연다(`game.html:1546`). 살림 상자는 **[방] 탭**에 있다(`game.html:1387`).
따라간 사람은 재고 목록을 보고 끝난다. ② 몬스테라가 마를 때가 됐는데 아직 안 말랐으면
말풍선이 안 뜨고 아래 파란 버튼만 서는데, 손가락은 그 버튼을 **후보로도 안 본다** —
`updateHint` 가 보는 물주기 버튼은 `waterCrop`(콩나물) 하나뿐이다.

**실측** — Day 51. 아래에 `💧 몬스테라에 물 주기` 버튼이 떠 있는데 손가락은 [가방]을 가리켰다.
그림 `docs/engine/shots/guide/05_firstplay_done.png`

`game.html:2538~2545` — **그대로 바꾼다**

```js
  const btnHarvest = $('harvestCrop'), btnWater = $('waterCrop');
  if (!sheetOpen && onScreen(btnHarvest) && !btnHarvest.disabled)
    return hintAt(btnHarvest, '거둘 때가 됐습니다');
  if (!sheetOpen && onScreen(btnWater) && !btnWater.disabled)
    return hintAt(btnWater, '물을 주면 자라기 시작합니다');
  /* ④ 첫 플레이가 끝났고 살림이 시작됐다 */
  if (fp.completed && ts && ts.enabled && !sheetOpen && onScreen($('openBag')))
    return hintAt($('openBag'), '가방에서 살림을 봅니다');
```

↓

```js
  const btnHarvest = $('harvestCrop'), btnWater = $('waterCrop');
  if (!sheetOpen && onScreen(btnHarvest) && !btnHarvest.disabled)
    return hintAt(btnHarvest, '거둘 때가 됐습니다');
  if (!sheetOpen && onScreen(btnWater) && !btnWater.disabled)
    return hintAt(btnWater, '물을 주면 자라기 시작합니다');
  /* ★★ 2026-08-11 — **몬스테라 물주기도 손이 가는 일이다.**
     말풍선(`potMarks`)은 **마른 뒤에만** 뜨는데 아래 버튼은 「마를 때가 됐다」부터 뜬다.
     그 사이 며칠 동안 화면에는 눌러야 할 파란 버튼이 서 있는데 손가락은 딴 데를 가리켰다.
     ⚠ 콩나물 뒤에 둔다 — 콩나물은 하루 늦으면 회전이 밀리고, 몬스테라 물은 마르기 전이라
       아직 잃는 것이 없다. 급한 순서는 그대로다. */
  const btnPotWater = $('waterPot');
  if (!sheetOpen && onScreen(btnPotWater) && !btnPotWater.disabled)
    return hintAt(btnPotWater, '몬스테라에 물을 줍니다');
  /* ④ 첫 플레이가 끝났고 살림이 시작됐다
     ★★ 2026-08-11 — 말을 **[방]으로 고쳤다.** [가방] 단추는 늘 [가방] 탭을 여는데
       살림 상자(`#tutBox`)는 [방] 탭에 있다 — 「가방에서 살림을 봅니다」를 따라가면
       재고 목록이 나오고 끝난다(실측 Day 51). */
  if (fp.completed && ts && ts.enabled && !sheetOpen && onScreen($('openBag')))
    return hintAt($('openBag'), '[방] 탭에서 살림을 봅니다');
```

- `몬스테라에 물을 줍니다` 12자 · `[방] 탭에서 살림을 봅니다` 14자 — 손가락 한 줄 제한(§0) 안이다.

**☐ 판단 필요 —** 더 나은 길은 **살림 상자를 [가방] 탭 맨 위로 옮기는 것**이다. 지금 [가방]은
재고뿐이고, 플레이어가 제일 자주 누르는 단추가 [가방]이다. 다만 상자를 옮기는 것은 이 창의
한 줄 고침이 아니라 시트 구조를 만지는 일이라 여기서는 문구만 맞췄다.

---

### P-03 · `?` 안내판에 「이 게임이 무엇인지」가 없다

**무엇을 모르는가** — 안내판 일곱 조각은 **어느 단추가 무엇인지**만 말한다.
「자리마다 밝기가 다르고, 그게 결과를 바꾼다」는 한 조각도 없다. 그 말을 화면이 처음으로
대놓고 하는 것은 **Day 50 의 축하 배너**다. 그때는 이미 다 배운 뒤다.
(`♪` 와 왼쪽 위 얼굴 칩도 설명이 없다.)

**실측** — 열어서 그림으로 확인. `docs/engine/shots/guide/01_qmark_panel.png`
조각 일곱 · 테두리 일곱. 제목 `이렇게 하시면 됩니다` 를 자원칩 테두리 둘이 **가로지른다.**

`game.html:2154~2164` — **한 줄을 바꾸고 두 줄을 더한다**

```js
    [$('stage'),    '방을 끌면 돌아갑니다 · 두 손가락으로 확대\n화분을 누르면 [이동] [회전]', 'mid'],
```

↓

```js
    /* ★★ 2026-08-11 — **이 게임이 무엇인지를 여기서 한 번 말한다.**
       조각 일곱이 전부 「어느 단추가 무엇인지」였고, 정작 「자리마다 밝기가 다르다」는
       Day 50 의 축하 배너에서 처음 나왔다(실측). 배우고 난 뒤에 말해 주는 셈이었다. */
    [$('stage'),    '방을 끌면 돌아갑니다 · 두 손가락으로 확대\n화분을 누르면 [이동] [회전]\n★자리마다 밝기가 다릅니다 — 어두운 자리도, 밝은 자리도 쓸모가 있습니다', 'mid'],
```

그리고 `game.html:2163` 다음 줄에 **더한다**

```js
    [$('btnMusic'), '배경 음악 켜고 끄기',            'down'],
    [$('meChip'),   '나 — 누르면 지금 상태를 봅니다', 'up']
```

두 `id` 는 확인했다 — `btnMusic`(`game.html:1205`) · `meChip`(`game.html:1056`).
(`buildGuide` 는 `if (!el) continue` 라 id 가 틀려도 그 줄만 조용히 빠진다 — 게임은 안 깨진다.)

**제목이 가리는 것** — `game.html:767~770` 의 `top` 두 값을 자원칩 아래로 내린다.

```css
  #guide .gtitle{position:absolute;left:0;right:0;top:calc(var(--safe-t) + 18px);text-align:center;
  #guide .gsub{position:absolute;left:0;right:0;top:calc(var(--safe-t) + 44px);text-align:center;
```

↓ (`18px` → `120px`, `44px` → `146px`. 자원칩 띠 높이가 실측 ~110px 이다)

```css
  #guide .gtitle{position:absolute;left:0;right:0;top:calc(var(--safe-t) + 120px);text-align:center;
  #guide .gsub{position:absolute;left:0;right:0;top:calc(var(--safe-t) + 146px);text-align:center;
```

> ⚠ 이 CSS 는 **눈으로만** 잡은 값이다. 넣은 뒤 `tools/probe_guide_fit.mjs` 를 돌려
> 세 화면에서 겹침이 없는지 다시 재야 한다(그 도구가 정확히 이걸 재는 도구다).

---

### P-04 · 「안 자란다」가 원시 DLI 숫자를 흘린다

**무엇을 모르는가** — 반대다. **너무 많이 말한다.** `⏸ 오늘은 자라지 않았습니다 — 빛 부족 —
7일평균 0.61 < 최소 3` 이 뜨는데, 이 판은 첫 플레이 동안 DLI 숫자와 밝기순을 **숨기기로**
정해져 있다(`showDli()` · `fillSlots` · 드롭 라벨 셋 다 숨긴다). 여기서만 새고 있었다.
게다가 `0.61 < 3` 은 **무엇을 하라는 말이 아니다** — 처방이 빠져 있다.

**실측** — 책상에 두고 엿새. 첫날부터 매일 같은 줄. 그림 `03_monstera_stuck.png`
(사유 문자열의 정본은 growth 쪽 `growthBlockReason` 이라 이 창이 못 고친다. 화면에서 자른다.)

`game.html:3232~3236` — **그대로 바꾼다**

```js
  if (t.growthBlocked) {
    el.className = 'stop';
    el.textContent = `⏸ 오늘은 자라지 않았습니다 — ${t.growthBlocked}`;
    return;
  }
```

↓

```js
  if (t.growthBlocked) {
    el.className = 'stop';
    /* ★★ 2026-08-11 — 첫 플레이 동안은 **숫자를 떼고 처방을 붙인다.**
       growth 가 내는 사유에 원시 DLI 가 붙어 있어(「빛 부족 — 7일평균 0.61 < 최소 3」)
       `fillSlots`·`rankSlots`·드롭 라벨이 숨기는 그 숫자가 여기서만 샜다.
       ⚠ 말(「빛 부족」)은 남긴다 — 이유가 없어지면 배움이 아니라 찍기가 된다.
       ⚠ 사유 문자열의 정본은 growth 다. 여기서는 **자르기만** 한다 — 새 말을 짓지 않는다. */
    const raw = String(t.growthBlocked);
    const why = showDli() ? raw : (raw.split('—')[0] || raw).trim();
    el.textContent = `⏸ 오늘은 자라지 않았습니다 — ${why} · 더 밝은 자리로 옮겨 보세요`;
    return;
  }
```

나오는 말: `⏸ 오늘은 자라지 않았습니다 — 빛 부족 · 더 밝은 자리로 옮겨 보세요` (35자).

---

### P-05 · 추천 자리에 붙으면 밝기 말이 사라진다

**무엇을 모르는가** — **그 자리가 밝은지 어두운지.** 튜토는 플레이어를 노란 마름모(추천 자리)로
몰아넣는다. 그런데 거기 붙는 순간 라벨이 `서랍장 1번 칸` 으로 바뀌면서 밝기 말이 통째로 없어진다.
빈 바닥에 놓을 때는 `여기 · 하얗고 아삭` 이라고 말해 준다 — **가르치려는 자리에서만 입을 다문다.**
자리 목록(`#slot`)도 밝기순과 DLI 를 숨기므로, 이걸 지우면 밝기를 배울 창구가 **한 곳도 안 남는다.**

**실측** — 끌면서 일곱 지점을 읽었다. 자유 좌표 `여기 · 하얗고 아삭 · 시루 1개` /
추천 자리 `서랍장 1번 칸 · 시루 1개`. 그림 `02_drag_label.png`

`game.html:5316~5345` — `label(hit, what)` 을 **통째로 바꾼다**

```js
  label(hit, what) {
    if (!hit) return '방 안에 놓아 주세요';
    if (!hit.ok) return hit.reason || '여기엔 놓을 수 없습니다';
    if (hit.snappedTo) return slotLabel(hit.snappedTo);
    try {
```

↓ (첫 네 줄만 바꾸고 나머지는 그대로 둔다. 마지막 `return` 두 줄도 아래처럼 바꾼다)

```js
  label(hit, what) {
    if (!hit) return '방 안에 놓아 주세요';
    if (!hit.ok) return hit.reason || '여기엔 놓을 수 없습니다';
    /* ★★ 2026-08-11 — **추천 자리에 붙어도 밝기 말은 남긴다.**
       예전에는 여기서 곧바로 이름만 내고 끝냈다. 그런데 튜토는 플레이어를 바로 그
       노란 마름모로 몰아넣으므로, **가르치려는 자리에서만 밝기를 안 말하는** 꼴이었다.
       자리 목록(`fillSlots`)도 밝기순·DLI 를 숨기니 배울 창구가 한 곳도 안 남는다.
       ⇒ 이름 **뒤에** 붙인다. 이름이 먼저인 것은 그대로다 — 붙었다는 사실이 먼저다. */
    const named = hit.snappedTo ? slotLabel(hit.snappedTo) : null;
    try {
```

그리고 같은 함수 끝의

```js
      return showDli()
        ? `여기 · DLI ${s.dli.toFixed(1)} · ${ko}`
        : `여기 · ${ko}`;
    } catch { return '여기에 놓습니다'; }
```

↓

```js
      const head = named || '여기';
      return showDli()
        ? `${head} · DLI ${s.dli.toFixed(1)} · ${ko}`
        : `${head} · ${ko}`;
    } catch { return named || '여기에 놓습니다'; }
```

나오는 말: `서랍장 1번 칸 · 하얗고 아삭` · `창턱 화분받침 · 잘 자람`.

---

### P-06 · 「씨앗을 사서 다시 심는다」를 아래 한 줄이 한 번도 말하지 않는다

**무엇을 모르는가** — 첫 수확 뒤 **회전을 어떻게 다시 돌리는지.** 아래 한 줄은
`콩나물을 수확했습니다. 2번 더 거두면 새로운 화분이 옵니다.` 라고만 한다 — 씨앗도, 상점도,
주문이 하루 걸린다는 것도 안 나온다. 길을 여는 것은 `🌱 씨앗이 없습니다` 말풍선뿐인데,
그건 방 안 작은 물건 위에 뜬다.

**실측** — Day 7·15·23·31 에 같은 자리가 네 번 반복됐다. 말풍선을 안 누른 첫 검사에서는
열여덟 턴을 헛돌았다(시트가 열린 채라 [다음 날]이 안 눌렸다 — 그건 검사 쪽 문제이지만,
「아래 한 줄만 보고는 갈 데가 없다」는 것은 그대로다).

`game.html:4055~4060` — **그대로 바꾼다**

```js
    monstera_gift: (() => {
      let left = null; try { left = monsteraArrivalLeft(fp); } catch { }
      const n = left && left.harvestsLeft;
      return n ? `콩나물을 수확했습니다. ${n}번 더 거두면 새로운 화분이 옵니다.`
               : '콩나물을 수확했습니다. 새로운 화분이 옵니다.';
    })(),
```

↓

```js
    monstera_gift: (() => {
      let left = null; try { left = monsteraArrivalLeft(fp); } catch { }
      const n = left && left.harvestsLeft;
      /* ★★ 2026-08-11 — **다시 심으려면 씨앗이 있어야 한다는 것을 여기서 말한다.**
         예전에는 남은 회전 수만 말해서 「기다리면 된다」로 읽혔다. 실제로는 거둔 시루가
         빈 채로 서 있고 씨앗 재고가 0이라, 상점에서 주문해 하루를 기다려야 다음 회전이 돈다.
         길을 여는 것은 `🌱 씨앗이 없습니다` 말풍선 하나뿐이었다(실측 Day 7·15·23·31).
         ⚠ 재고를 여기서 새로 세지 않는다 — `shopStatus` 가 낸 값을 읽을 뿐이다. */
      let seeds = 0;
      try { seeds = (shopStatus(S).stock || {}).bean_seed || 0; } catch { }
      let harvested = 0;
      try { harvested = (cropHarvestStatus(S) || {}).harvestedCount || 0; } catch { }
      if (harvested > 0 && seeds <= 0)
        return '콩 씨앗이 없습니다. [상점]에서 주문하면 하루 뒤에 옵니다.';
      return n ? `콩나물을 수확했습니다. ${n}번 더 거두면 새로운 화분이 옵니다.`
               : '콩나물을 수확했습니다. 새로운 화분이 옵니다.';
    })(),
```

- `콩 씨앗이 없습니다. [상점]에서 주문하면 하루 뒤에 옵니다.` 30자 — 360px 에서 두 줄, 나머지 한 줄.
- `shopStatus` · `cropHarvestStatus` 둘 다 이미 import 돼 있다(`game.html` 상단 · `3831` · `3457` 에서 쓴다).

---

### P-07 · 「창가」와 「창턱 화분받침」 — 낱말이 안 맞는다

**무엇을 모르는가** — 어느 자리가 그 자리인지. 안내는 **창가**라고 하는데 목록에 있는 이름은
**창턱 화분받침**이다. 목록은 열네 줄이고 밝기순도 아니다(일부러 그렇다).
낱말 하나만 맞춰도 눈으로 이어진다.

**실측** — `#slot` 옵션 열넷: `3단 선반 1~9번 칸` · `서랍장 1~2번 칸` · **`창턱 화분받침`** ·
`책상 1~2번 칸`. 밝기 표시 없음(설계 그대로).

`game.html:4061` — **그대로 바꾼다**

```js
    move_monstera: '몬스테라는 어두운 자리에서 자라지 않습니다. 높은 창가 자리로 옮겨 보세요.',
```

↓

```js
    /* ★ 2026-08-11 — 「창가」를 「창턱」으로 맞췄다. 자리 목록에 있는 이름이 `창턱 화분받침`
       이라, 안내가 「창가」라고 하면 열네 줄짜리 목록에서 그 줄을 눈으로 잇기 어렵다.
       ⚠ 자리 이름을 집어 주는 것이 아니다 — 방향만 말한다는 규칙은 그대로다(first_play.md §4). */
    move_monstera: '몬스테라는 어두운 자리에서 자라지 않습니다. 높은 창턱 자리로 옮겨 보세요.',
```

같은 이유로 손가락 문구 `game.html:2504`

```js
      h.querySelector('.say').textContent = '탭 → 옮기기 → 창가로';
```

↓

```js
      h.querySelector('.say').textContent = '탭 → 옮기기 → 창턱으로';
```

**☐ 판단 필요 —** 반대로 **자리 이름을 「창가 화분받침」으로 바꾸는** 길도 있다. 자리 이름의
정본은 방 데이터라 이 창이 못 정한다. 어느 쪽이든 **둘을 같은 낱말로** 맞추는 것이 요점이다.

---

### P-08 · 「며칠째 멈춰 있는지」가 구조적으로 안 뜬다

**무엇을 모르는가** — 얼마나 오래 안 자라고 있었는지. 확대창 게이지에 그 말을 쓰려고
`ggWhy` 가 `· N일째 그대로입니다` 를 붙이게 돼 있는데(`game.html:3211~3216`),
**엿새를 세워 놓아도 한 번도 안 붙었다.**

**원인 — 찾았다.** `still = p.daysPlanted - p.fedDays` 인데(`3212`),
`fedDays` 는 **빛을 넘긴 날**을 센다. 빛은 **막힌 날에도 넘긴다**(`loop.js:788~792` — DLI 이력은
사실이어야 하므로 일부러 그렇게 뒀다). 게다가 밝은 날은 두 칸씩 쌓인다(`loop.js:861`).
⇒ `daysPlanted` 와 `fedDays` 는 거의 같거나 `fedDays` 가 더 크다. **`still` 은 0 을 못 벗어난다.**
즉 이 줄은 **값이 틀린 게 아니라 재는 자가 틀렸다**(이 저장소가 열 번 겪은 그 모양이다).

`game.html:1829` 옆에 **새 칸 하나를 만들고**

```js
let lastTurn = null;
```

↓

```js
let lastTurn = null;
/* ★★ 2026-08-11 — **빛이 막혀 멈춘 날을 따로 센다.**
   `p.fedDays` 로는 못 센다 — 그건 「빛을 넘긴 날」이고 빛은 막힌 날에도 넘긴다
   (loop.js §빛은 막혔어도 넘긴다). 밝은 날은 두 칸씩 쌓이기까지 해서
   `daysPlanted - fedDays` 는 0 을 못 벗어났다(실측: 엿새를 세워도 0). */
let stuckDays = 0;
function noteTurn(t) {
  lastTurn = t;
  stuckDays = (t && (t.growthBlocked || t.headroomBlocked)) ? stuckDays + 1 : 0;
}
```

`game.html:4453` 과 `4545` 의 대입을 그 창구로 바꾼다

```js
      if (e.turn) { lastTurn = e.turn; }
```
↓
```js
      if (e.turn) { noteTurn(e.turn); }
```

```js
  lastTurn = nextDay(S, io).turn;
```
↓
```js
  noteTurn(nextDay(S, io).turn);
```

`game.html:3211~3216` — **그대로 바꾼다**

```js
  if (why) {
    const still = Math.max(0, (p.daysPlanted || 0) - (p.fedDays || 0));
    $('ggWhy').textContent = still > 1
      ? `${why} · ${still}일째 그대로입니다`
      : String(why);
  } else $('ggWhy').textContent = '';
```

↓

```js
  if (why) {
    $('ggWhy').textContent = stuckDays > 1
      ? `${why} · ${stuckDays}일째 그대로입니다`
      : String(why);
  } else $('ggWhy').textContent = '';
```

> ⚠ `stuckDays` 는 **세이브에 안 실린다.** 앱을 껐다 켜면 0 부터 다시 센다.
> 그것이 맞는지(멈춘 날은 판의 사실이니 저장해야 하는지)는 이 창이 못 정한다.

---

### P-09 · 첫 수확 기록이 「자리 때문」이라고 말하지 않는다

**무엇을 모르는가** — 3끼가 나온 것이 **어두운 자리에 뒀기 때문**이라는 것. 그 인과를 말하는 것은
지금 **대사뿐**이다(*"어두운 자리라 하얗게 잘 자랐어. 빛을 봤으면 초록이 되고 썼을 거야."*).
대사는 넘기면 사라지고, 기록에는 결과만 남는다.

**실측** — 기록 `🥣 수확 — 콩나물 1개 · 하얗고 아삭 · 3끼 상당 · 3,000원`.
품질 말(`하얗고 아삭`)은 들어 있는데 **「자리 때문」이라는 말이 없다.**

`src/game/loop.js:1059~1060` — **그대로 바꾼다**

```js
    pushLog(S, `🥣 수확 — ${what} · ${r.qualityKo} · ${r.meals}끼 상당 · ` +
               `${r.cycleSavedWon.toLocaleString()}원`);
```

↓

```js
    /* ★ 2026-08-11 — **첫 회전에만** 인과를 붙인다. 「자리가 밥값이 됐다」를 말하는 것이
       지금은 대사뿐인데, 대사는 넘기면 사라지고 기록에는 결과만 남는다.
       ⚠ 매번 붙이면 잔소리가 된다 — 처음 한 번이면 배움에 충분하다. */
    const first = (fp.beansprout && fp.beansprout.harvestCount) === 1;
    pushLog(S, `🥣 수확 — ${what} · ${r.qualityKo} · ${r.meals}끼 상당 · ` +
               `${r.cycleSavedWon.toLocaleString()}원` +
               (first ? ' — 어두운 자리에 뒀기 때문입니다' : ''));
```

> ⚠ `fp.beansprout.harvestCount` 가 **거둔 직후에 이미 1 인지**를 확인 못 했다.
> `harvestBeansprout` 이 언제 그 값을 올리는지 안 봤다 — 붙이기 전에 그 한 줄을 봐야 한다.
> **대사 창과 겹친다.** 대사 쪽이 이 말을 더 잘 하고 있다면 이 안은 버려도 된다.

---

### P-10 · 확대창에서 같은 말이 한 화면에 두 번

**실측** — 확대창을 열면 게이지 카드에 `빛 부족 — 7일평균 0.61 < 최소 3`,
그 바로 밑 아래 한 줄에 `⏸ 오늘은 자라지 않았습니다 — 빛 부족 — 7일평균 0.61 < 최소 3`.
같은 문장이 **세로로 겹쳐** 있다. 그림 `04_zoom_gauge.png`

**같이 보이는 것** — 게이지 카드가 그 위 **버튼 띠(넷)를 잘라 덮는다.** 버튼 글자가 반쯤 잘렸다.
이건 문구가 아니라 배치라 이 대장 밖이다. **화면 담당이 볼 것.**

**고칠 안 —** 아래 한 줄 쪽(`#plantToday`)이 P-04 로 처방까지 말하게 되므로,
확대창이 열려 있을 때는 `ggWhy` 를 비운다.

`game.html:3211` 앞에 한 줄

```js
  if (why) {
```
↓
```js
  /* ★ 확대창이 열려 있으면 아래 한 줄(`#plantToday`)이 같은 말을 이미 하고 있다 —
     한 화면에 같은 문장이 둘이면 그게 소음이다. 이유는 아래쪽 하나만 남긴다. */
  if (why) {
```

> ⚠ 이건 **안이 아니라 자리 표시**다. 어느 쪽을 지울지(게이지 카드 vs 아래 한 줄)는
> 박사님 판단이다 — 게이지 카드는 확대했을 때만 보이고, 아래 한 줄은 늘 보인다.

---

## 3. 판단 필요 — 다섯

| | 무엇 |
|---|---|
| ★ | **첫 플레이가 50일이다.** `first_play.md` 는 16일 흐름을 적어 뒀는데, 실측으로 시루 놓기 Day 0 → 몬스테라 도착 **Day 21~23** → 말린 새순 **Day 50** 이었다. 안내를 어디까지 늘려야 하는지가 이 길이에 달렸다 (씨앗 주문·심기·물주기를 **네 번** 반복한다) |
| ★ | **살림 상자를 [방] 탭에 둘 것인가.** 플레이어가 제일 자주 누르는 단추가 [가방]이고, 그 단추는 [가방] 탭을 연다. 목표·돈·이사가 다른 탭에 있다 (P-02) |
| | **완료 축하 문구를 며칠 남길지** (P-01) |
| | **「창가」인가 「창턱」인가** — 자리 이름을 바꿀지 안내를 바꿀지 (P-07) |
| | **멈춘 날 수를 세이브에 실을지** (P-08) |

---

## 4. 못 한 것

- **삽수·식물등·무늬·이사·파산·원룸의 안내는 하나도 못 봤다.** 첫 플레이 50일 안에 안 나온다.
  그 여섯이 `player_guide.md` §2 에 빈 칸으로 남아 있다.
- **「무늬 잎 셋 → 하프문 → 200만원」을 플레이어가 어떻게 아는가** — 화면에서 그 말을 하는 곳을
  **못 찾았다.** [식물] 탭 팔기 줄의 `무늬 잎 N/N장 — N장이 무늬면 이사 자금이 됩니다`(`3162`)가
  유일한 후보인데, 무늬 잎이 붙은 판까지 못 가서 **실제로 뜨는 것을 못 봤다.**
  「하프만」이라는 낱말은 `game.html` 어디에도 안 나온다(찾아봤다).
- **`title` 로만 있는 안내 셋**(이사 부족액·주문 돈 부족·체력 상세)을 폰에서 어떻게 낼지 —
  안을 안 냈다. 체력이 이미 `staminaBlockNote` 로 그 길을 가고 있으니 그걸 본뜨면 될 것 같지만
  버튼마다 자리가 달라 한 줄로는 안 끝난다.
- **P-00 · P-09 는 화면으로 확인 못 했다.** 각 항목에 ⚠ 로 적어 뒀다.
- **`game.html` 널 바이트 — 갈랐다.** 널 바이트는 **1개**, 바이트로 세면 **6869줄**이고
  파일은 **7117줄**이다(`wc -l` 이 7080 이라고 하는 것은 줄끝 처리 차이다).
  `grep` 은 거기서 멈추고 `Binary file matches` 만 남긴다 — 즉 **6870~7117줄은 한 번도 검색되지 않았다.**
  그 구간은 `Read` 로 통째로 읽었다: `banners()` · `playFirstPlayScenario()` · `playScenario()` ·
  버튼 배선뿐이고 **플레이어에게 나가는 안내 문구는 없다**(자동 시뮬 기록·검수 결과줄만 있다).
  ⇒ 이번 대장에서 그 구간 때문에 빠진 문구는 없다고 본다. 다만 **`grep` 결과를 믿으면 안 되는 파일**이다.
