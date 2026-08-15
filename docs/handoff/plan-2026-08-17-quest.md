# 확정 — 퀘스트 다섯 줄 (2026-08-17)

> ★ **이 문서는 「그렇게 하기로 했다」다.** 「지금 그렇다」가 아니다(START-HERE §2 규칙 2).
> **코어는 붙었다**(`src/game/quest.js` · `dialogue.js` · `stamina.js` · `tools/test_quest.mjs`).
> **화면(`game.html`)만 안 붙었다** — 그 창을 다른 워커가 쥐고 있다.
> §5 에 붙일 코드가 **한 줄도 빼지 않고** 있다. 붙인 뒤 이 머리에 **「붙었다」**를 적어라.

---

## 0. ★★ 무엇이 문제였나 — 재서 나온 것이 예상과 달랐다

박사님 말씀: *"나오는 얘기가 목적성이 부족하대."*
그래서 **말이 없는 구간을 찾으려고** 반지하 한 판을 굴려 날마다 나오는 말을 전부 받아 적었다
(`tools/_probe_quest_say.mjs` · 진짜 코어 + 진짜 storyteller · 수입 주입 0).

**나온 값은 반대였다.**

| | |
|---|---|
| 말 없는 최장 구간 | **2일** — 조용한 데가 없다 |
| ★ 「지금 뭘 해라」를 말한 날 | **Day 33 까지 다섯 번, 그 뒤 0** |
| ★★ Day 33~77 **44일** 동안 나온 말 | **전부 작은 말**(「반지하는 여름에 덥고」·「집주인 아저씨가」·「몬이는 왜 몬이야?」) |
| Day 93~200 **107일** | 같음 — 파산까지 가는데 시킬 일이 없다 |

⇒ **「조용해서」가 아니라 「할 말은 있는데 시킬 일이 없어서」**였다.
⇒ 그래서 이 일은 **대사를 늘리는 것이 아니라 「할 일」을 늘리는 것**이다.

### ★★★ 그리고 하나가 더 나왔다 — **탈출 조건을 말하는 자리가 없다**

`tutorial.canMoveOut` 은 **돈 200만 × 무늬 삽수를 판 적**을 본다(escapecut 확정).
그런데 `loop.js §③` 이 이렇다:

```js
const state = ts.movedOut ? 'done' : c.ok ? 'ready'
            : c.varie ? 'money'              // 삽수는 팔았고 돈만 남았다
            : c.money ? 'varie' : null;      // null = 둘 다 멀었다. 아직 할 말이 없다
```

**둘 다 멀면 `null`.** 시작돈 150만 < 이사비 200만 이고 무늬 삽수도 안 팔았으니
보통 판은 **처음부터 끝까지 `null`** 이다 — 200일을 굴려도 `move_short_*` 가 **0건**이었다.
아래 한 줄(`tutorialGoal`)만이 「무늬 삽수를 잘라 뿌리내려 팔아 봐야 합니다」를 말하는데,
그 줄은 **무엇을만 말하고 왜·어떻게를 안 말한다.**

⇒ **안 가르쳐 주면 영영 모르는 것**이 실제로 영영 안 나오고 있었다.

---

## 1. 다섯 줄 — 이것이 정본이다

정본 코드는 `src/game/quest.js` §QUESTS. **여기 숫자를 손으로 옮겨 적지 마라 — 정의에서 읽어라**(§2.8).

| | id | 이름 | 언제 열리나 | 언제 끝나나 | 가르치는 것 | 보상 |
|---|---|---|---|---|---|---|
| ① | `crop_mix` | 한 상에 두 가지 | 첫 플레이가 끝난 날 (실측 **Day 33**) | 하루 밥상에 **두 작물**이 오른다 | 콩나물은 어두운 데 · **무순은 밝은 데** · **섞어 먹어야 밥이 이득** | 체력 +1 |
| ② | `siru5_cycle5` | 시루 다섯, 다섯 바퀴 | ① 을 끝낸 뒤 | 시루 5개가 각각 5바퀴 | **물은 한 번에 하나** · **체력이 천장이다** | 체력 +1 |
| ③ | `first_cut` | 물에 꽂아 본다 | 모주 잎이 **2장**이 된 날 | 물꽂이 삽수가 **뿌리를 낸다** | **잎 1장까지 쪼개야 물꽂이** · 자르는 것이 늘리는 길 | 체력 +1 |
| ④ | `varie_bright` | 밝은 데서 뿌리내리기 | **무늬 잎**이 난 날 | 무늬 삽수가 **밝은 자리**에서 뿌리를 낸다 | **빛이 무늬 등급을 정한다** | ★ **무늬 등급**(세상이 준다) |
| ⑤ | `sell_varie` | 무늬를 값으로 만든다 | **무늬 삽수를 잘랐을 때** | 무늬 삽수를 **판다** | ★ **탈출 = 돈 + 무늬 삽수를 판 적** | ★ **이사가 열린다** |

### ★ 왜 다섯인가 (재서 정했다 · 되묻지 말 것)

1. **가르쳐야 하는데 아무 데서도 안 가르치는 것이 여덟**이었다(2026-08-17 확정문 셋 + escapecut).
   그 여덟을 **겹치지 않게** 묶으니 정확히 **다섯 덩이**가 된다(위 표의 「가르치는 것」 칸 —
   `test_quest §⑴ 가르치는 것이 겹치지 않는다` 가 못 박는다).
2. 빈 구간이 실측으로 **Day 33~77(44일)** 과 **Day 93~끝(107일)** 둘이다.
   다섯이면 평균 **30일에 하나** — **월세 주기와 같은 박자**라 새 눈금을 안 만든다.
3. **첫 33일에는 안 넣는다.** 거기는 이미 꽉 차 있다(첫 플레이 대사·안내판·말풍선).
   ⇒ 넷이면 44일을 못 메우고, **여섯이면 첫 플레이 구간을 침범해 심부름 목록이 된다.**

### ★★ 보상 — **있는 것만 쓴다** (새 계통 0개)

- **최대체력 +1** — `stamina.grantStaminaQuest` 가 이미 하던 일. 값은 `STAMINA_RULES.quests`.
- ★ **세상이 이미 주는 것** — ④는 무늬 등급이 오르고(산반 35만 → 풀문 115만 · varie-grade §2),
  ⑤는 **이사가 열린다.** 여기에 체력을 또 얹으면 **진짜 보상이 가려진다.** 그래서 **0 이고 그게 뜻이다.**
- 체력을 주는 것은 셋(**5 → 8**). 자연 레벨업으로 5→8 은 10+15+20 = **45회**(시루 5개면 약 9일)라
  **판을 뒤집는 크기가 아니다.** `test_quest §보상` 이 그 합을 못 박는다.

---

## 2. ★★ 상태를 안 늘렸다 — **세이브에 새 칸이 0개다**

`save.js` 는 이 창의 ⛔ 목록이고, 칸을 늘리면 옛 판이 조용히 어긋난다. 그래서:

| | 어디 사나 | 세이브 |
|---|---|---|
| **끝낸 것** | `S.stamina.questsTaken` — **이미 있던 칸**(save.js §packStamina) | ○ 실린다 |
| **열린 것** | ★ **기억 안 한다.** 스냅샷에서 매번 다시 센다 | — 셀 필요가 없다 |
| 「방금 열렸다」 | `S._questOpen` — `_` 로 시작하는 칸 | ✕ 안 실린다 (**그게 맞다**) |

★ `_questOpen` 이 안 실리는 것은 `loop.js §ts._moveState` 가 쓰는 수법 그대로다 —
다시 켜면 열린 대사가 한 번 더 날 수 있고, **그쪽 주석이 적은 것과 같은 근거로 자연스럽다**
(*"다시 켜면 대사 이력도 같이 비므로 한 번 더 나오는 것이 자연스럽고, 어긋나지 않는다"*).

⇒ **`save.js` 를 한 줄도 안 고쳐도 된다.**

---

## 3. 대사 열 가지 (`src/game/dialogue.js §5.5` — **붙었다**)

열림 다섯 · 완료 다섯. 지도는 `QUEST_OPEN_SCRIPT` · `QUEST_DONE_SCRIPT`.

⚠ **숫자를 대사에 안 박았다.** 「시루 다섯 개」·「이백만 원」은 전부 정의에서 나와
**아래 한 줄이 말한다.** 대사는 **왜 그 일을 하는지**만 말한다 — 값이 움직여도 안 낡는다.

⚠ 「모르는 `questId`」는 **조용히 지나간다.** 표에 줄이 늘었는데 대사를 안 썼으면
없는 대사를 부르다 던지는 것보다 안 뜨는 편이 낫다(`test_quest §⑹`).

---

## 4. ⚠ 「지금 할 일」 줄과의 관계 — **퀘스트가 이긴다**

지금 `#quest` 는 `tutorialGoal(ts)` 를 그대로 쓴다. 그 줄이 내는 말은 셋이다:
`남은 것 — …`(배움) · `무늬 삽수를 잘라 뿌리내려 팔아 봐야 합니다` · `이사 자금 …원이 더 필요합니다`.

**퀘스트가 열려 있으면 퀘스트 줄이 이긴다.** 까닭 둘:
- ㉠ **더 좁다.** 「무늬 삽수를 잘라 뿌리내려 팔아 봐야 합니다」는 **다음 손 하나**가 아니라
  세 손이다. 퀘스트는 지금 눌러야 할 것 하나를 말한다.
- ㉡ **더 이르다.** `tutorialGoal` 의 무늬 줄은 배움 넷이 다 찬 뒤에야 나오는데(실측 Day 45),
  ④⑤ 는 그전에 열릴 수 있다.

⚠ **문구를 두 벌로 짓지 않는다** — 퀘스트 줄은 `questTodo(q)` 하나이고, 없으면 `tutorialGoal` 이다.
⚠ 상한 28자를 지킨다(`docs/player_guide.md §0` 실측 — 360px 에서 한 줄 26자).
  `test_quest §⑷` 가 다섯 줄 전부를 잰다(지금 17~21자).

---

## 5. ★★★ 화면에 붙일 것 — **코드째로** (`game.html` · 이 창의 ⛔)

> ⚠ 아래 다섯 조각을 **다 붙여야** 돈다. **절반만 붙이지 마라** — ⓐ만 붙이면
> 판정이 안 돌고, ⓒ만 붙이면 대사가 안 난다.

### ⓐ 들여오기 — `import { grantStaminaQuest } …` 바로 아래 (지금 `game.html:2276` 언저리)

```js
/* ★★ 퀘스트 다섯 줄 (2026-08-17 · docs/handoff/plan-2026-08-17-quest.md).
   ⚠ **판정만 여기서 부른다.** 무엇을 시키는가는 quest.js 가, 얼마를 주는가는
     stamina.json 이 갖는다 — 화면이 그 둘을 다시 짓지 않는다. */
import { questView, stepQuests, questTodo, questOf } from './src/game/quest.js';
```

★ **다른 것은 안 들여와도 된다 — 이미 다 있다.** 확인했다(2026-08-17):
`cropSites` (`game.html:2240`) · `cuttingsOf` (`:2222`) · `grantStaminaQuest` (`:2276`) ·
`lastTurn` (`:2379`, 매 턴 `:2392` 에서 갱신) · `story` · `dlgOpen` · `io.growth`.

### ⓑ 스냅샷 — `checkSiruQuest()` 정의(지금 `game.html:5243`) **를 통째로 갈아 끼운다**

```js
/* ══ 퀘스트 다섯 줄 (2026-08-17) ═══════════════════════════════════════
   ★ 옛 `SIRU_QUEST`/`siruQuestDone`/`checkSiruQuest` 를 이것이 대신한다.
     `siru5_cycle5` 는 **없어진 것이 아니라 다섯 줄 중 ② 가 됐다**(quest.js §QUESTS).
     판정도 값도 그대로다 — 달라진 것은 **열릴 때 말을 건다**는 것뿐이다.
   ★★ 화면이 하는 일은 **사실을 모아 넘기는 것**뿐이다. 판정을 여기서 다시 짓지 않는다 —
     지으면 규칙이 두 벌이 되고, 그게 이 저장소가 열여섯 번 밟은 모양이다. */
function questSnapshotNow(turn) {
  const fp = S.firstPlay || {};
  const ts = S.tutorial || {};
  /* 방에 선 작물 용기 전부 — 종류와 「몇 바퀴 돌았나」 */
  let cropPots = [];
  try {
    cropPots = cropSites(fp).flatMap(site =>
      ((site && site.pots) || []).map(p => ({ kind: (site.kind || 'beansprout'),
                                             harvestCount: (p && p.harvestCount) || 0 })));
  } catch { cropPots = []; }
  /* ★ 오늘 밥상에 오른 작물 — **턴이 낸 것**이 정본이다(loop.js §밥 · eatFromPantry).
     ⚠ `mealPlanQuote` 로 대신 재지 마라 — 그건 「짤 수 있다」이지 「먹었다」가 아니다. */
  let mealKinds = [];
  try {
    const fe = (turn && turn.firstPlayEvent) || null;
    mealKinds = ((fe && fe.portions) || []).map(p => p && p.kind).filter(Boolean);
  } catch { mealKinds = []; }
  /* 모주가 지금 달고 있는 잎 — growth 가 정본이다 */
  let motherLeaves = 0, motherVarieLeaves = 0;
  try {
    const st2 = io.growth && io.growth.leafStats && io.growth.leafStats();
    motherLeaves = (st2 && st2.leaves) || 0;
    motherVarieLeaves = (st2 && st2.variegatedLeaves) || 0;
  } catch { }
  /* 삽수 — 상태·물꽂이인가·무늬인가·어느 밝기에서 뿌리내렸나 */
  let cuts = [];
  try {
    cuts = (cuttingsOf(S) || []).map(c => ({
      method: c.method, status: c.status,
      varieFromCut: !!c.varieFromCut, varieLightBand: c.varieLightBand || null
    }));
  } catch { cuts = []; }
  return {
    day: S.day,
    firstPlayDone: !!fp.completed,
    cropHarvestTotal: cropPots.reduce((a, p) => a + p.harvestCount, 0),
    cropPots, mealKinds, motherLeaves, motherVarieLeaves,
    cuttings: cuts,
    /* ★ 무늬 삽수를 판 횟수 — `tutorial.js §varieSale` 이 정본이다(escapecut 확정) */
    varieSaleCount: (ts.varieSale && ts.varieSale.count) || 0
  };
}

/* ★ 한 걸음 재고 · 보상 주고 · 말하게 한다. **두 번 불러도 안전하다.**
   ⚠ `draw()` 안에서 부르지 마라 — 보상은 규칙이고 draw 는 보여 주기다(quest-to-plan 의 규율). */
function checkQuests(turn) {
  try {
    const r = stepQuests(S, questSnapshotNow(turn));
    for (const id of r.finished) grantStaminaQuest(S, id);   /* 보상은 stamina 가 준다 */
    if (r.events.length) dlgOpen(story.events(r.events));    /* 대사는 늘 같은 창구로 */
  } catch (e) { console.warn('[퀘스트]', e && e.message); }
}
```

### ⓒ 부르는 자리 — **셋**

```js
/* ① 거둔 직후 — 옛 checkSiruQuest() 가 있던 두 곳을 그대로 바꾼다
     game.html:6259  (siruHarvest)     · game.html:9203 (reallyHarvest) */
-  checkSiruQuest();         /* 회전이 하나 늘었다 — 완주했나 (§퀘스트). 배너는 draw 가 낸다 */
+  checkQuests(lastTurn);    /* 회전이 하나 늘었다 — 다섯 줄을 다시 본다 (§퀘스트) */
```

```js
/* ② ★★ 하루가 간 직후 — **여기가 제일 중요하다.**
     ①②는 수확에 걸리지만 ③④⑤ 는 잎·삽수·판매라 수확이 안 건드린다.
     여기를 안 붙이면 **뒤 세 줄이 영영 안 열린다.**
     자리: `dlgOpen(story.events(r.events))` (지금 game.html:9202 언저리) **바로 다음 줄** */
+  checkQuests(r && r.turn ? r.turn : lastTurn);
```

```js
/* ③ 삽수를 자른 뒤 · 무늬 삽수를 판 뒤 — `takeCutting`/`dealListing` 을 부르는 곳의
     `draw()` 바로 앞. ⑤(무늬 삽수를 잘랐다)와 ⑤완료(팔았다)가 그 자리에서 나야
     「팔렸다 → 이제 남은 건 돈뿐이야」가 그 순간에 온다. */
+  checkQuests(lastTurn);
```

### ⓓ 「지금 할 일」 줄 — `$('quest').textContent = …` (지금 `game.html:5939` 언저리)

```js
  /* ★★ 2026-08-17 — **퀘스트가 열려 있으면 퀘스트가 이긴다**(확정문 §4).
     `tutorialGoal` 은 「무엇을」만 말하고 퀘스트는 **다음 손 하나**를 말한다.
     ⚠ 문구를 여기서 새로 짓지 않는다 — `questTodo` 하나가 정본이다. */
  let questGoal = null;
  try {
    const qv = questView(S, questSnapshotNow(lastTurn));
    questGoal = qv.next ? qv.next.todo : null;
  } catch { questGoal = null; }

  $('quest').textContent = justMoved
    ? `${slotLabel(plant.slotId)}(으)로 옮겼습니다. 빛 판정은 7일 평균이라 ` +
      `나흘쯤 지나야 새 자리 값이 됩니다 — 하루씩 넘겨 보세요.`
-   : (livingGoal || quest[fp.phase] || '첫 플레이를 진행하세요.');
+   : (questGoal || livingGoal || quest[fp.phase] || '첫 플레이를 진행하세요.');
```

### ⓔ 배너 문구 — `questKo(id)` 를 `quest.js` 이름으로

옛 `questKo` 는 `siru5_cycle5` 하나만 알았다. 지워도 되고, 이렇게 바꿔도 된다:

```js
-function questKo(id) { return id === SIRU_QUEST.id ? SIRU_QUEST.ko : id; }
+/* 퀘스트 id 를 사람 말로 — 표가 정본이다(quest.js §QUESTS). 모르면 id 그대로 낸다 */
+function questKo(id) { const q = questOf(id); return q ? q.ko : id; }
```
(`questOf` 를 ⓐ 의 import 에 보태라.)

---

## 6. 붙인 뒤 반드시 재라

1. **다섯 줄이 실제 판에서 다 열리나** — `node tools/test_quest.mjs` 는 스냅샷으로만 잰다.
   ★ **화면에서 한 판을 굴려** 열리는 날을 받아 적어라(`tools/_probe_quest_say.mjs` 를 되살려도 된다).
2. **Day 33~77 이 아직도 비나** — 이 일의 전부다. ①②가 그 자리를 메워야 한다.
3. **아래 한 줄이 안 잘리나** — 폰 360px. 28자 자는 `player_guide §0` 것이다.
4. ⚠ **`siru5_cycle5` 가 옛 판에서도 그대로 도나** — `questsTaken` 에 이미 있는 판은
   다시 안 받아야 하고, 조건을 넘긴 채 저장된 판은 **한 번 더 거둬야** 받는다(옛 규율 그대로).
5. **체력 5 → 8 이 밸런스를 안 깨나** — `test_banjiha_routes` 전·후.

## 7. ⏸ 안 정한 것

- ☐ **퀘스트를 목록으로 보여 줄지.** 지금은 **하나만** 보여 준다(`questView().next`).
  목록을 내면 심부름 목록이 된다고 보고 안 냈다 — 화면 결정이라 박사님 몫이다.
- ☐ **진행도(3/5)를 보여 줄지.** `siru5_cycle5` 는 셀 수 있고 나머지 넷은 참/거짓이라
  한 줄에 두 모양이 섞인다. 안 냈다.
- ☐ **`data/balance/stamina.json` 으로 값을 뺄지.** 새 네 줄의 값이 지금 `stamina.js` 밑값에만
  있다(`data/*` 는 이 창의 ⛔). 정본은 그 json 이므로 **거기에 같이 적어야** 한 벌이 된다.
  ⚠ 그 파일 63~64행 주석이 아직 *"판정이 안 붙었다"* · *"시루 5개를 **분배로** 5주기"* 라고
    적혀 있다 — 둘 다 낡았다(2026-08-11 에 판정이 붙었고 「분배로」는 안 잰다). 같이 고쳐라.
