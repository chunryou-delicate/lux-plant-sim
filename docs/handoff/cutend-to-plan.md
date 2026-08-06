# 2026-08-06 · cutend → plan · core(game.html) · house

두 가지를 맡았다. 둘 다 **「설계는 있는데 코드가 안 부른다」** 였다.

| | 무엇 | 상태 |
|---|---|---|
| ① | 삽수 자르기·분갈이가 체력을 안 쓴다 | **붙였다** — `propagation.js` |
| ② | ④ 엔딩이 화면에 안 붙어 있다 | **재현으로 증명했다** — 붙이는 것은 `game.html` 몫 |

바꾼 파일은 셋이다: `src/game/propagation.js` · `src/game/ending.js` ·
`tools/test_cutstamina.mjs`(신규) · `tools/test_ending_flow.mjs`(신규).
`game.html` 은 **한 글자도 안 건드렸다.**

검사는 **30개 전부 통과**한다(신규 둘 포함).
⚠ 시작 상태에 대한 정정 — 지시서는 *"29개 중 `test_balance_routes` 만 FAIL 2건"* 이라고
했는데, 이 워크트리(`main` 보다 5개 앞섬)에서 실제로 재 보니 **28개 전부 PASS** 였다.
`test_roomview_walk` 만 가끔 흔들린다(같은 커밋에서 재실행하면 PASS — `efa4ca2` 가
그 흔들림이 이 작업 것이 아님을 이미 적어 두었다).

---

# ① 체력 — 자르기·분갈이가 이제 손을 쓴다

## 무엇을 했나

`docs/stamina.md` 와 `src/game/stamina.js` 에는 `cut: 1` · `repot: 1` 이 **처음부터 적혀
있었다.** `propagation.js` 가 `spend`/`canAct` 를 한 번도 안 불렀을 뿐이다.
그래서 **새 규칙을 하나도 안 만들었다** — 있던 표를 부르기만 한다.

배선은 `state.waterCrop` 이 하는 그대로다:

* **아무것도 바꾸기 전에 묻는다** — `takeCutting` 은 용기 재고를 빼기(`useStock`) 직전,
  `repotCutting` 은 모종포트를 빼기 직전에 `canAct` 한다.
  뒤에서 물으면 「병만 나가고 삽수는 없는」 판이 남는다.
* **성공한 뒤에 깎는다** — 던진 동작은 체력을 안 문다.
* **막힌 것은 고장이 아니라 안내다** — 예외에 `tutorialInput = true` 를 붙였다.
  안 붙이면 `game.html` 의 `isRecoverable` 이 판을 통째로 잠근다.
* **사유를 안 덮는다** — 잎꽂이 마디·모르는 용기·초보 규칙은 체력보다 **먼저** 던진다.
  체력이 바닥이어도 잎꽂이 마디는 여전히 잎꽂이다.

재현: `node tools/test_cutstamina.mjs` (A~D · 9건)

## ★★ ② 「콩15는 삽수를 못 자른다」 — **재 봤다. 아니다.**

`docs/stamina.md §2` 와 `docs/handoff/econgap-to-plan.md` A-3 이 이렇게 적어 두었다:

> 콩나물 15개는 5일 주기라 매일 정확히 3회전이고, 하루 손이 **10/10** 이라 남는 손이 0 이다.
> ⇒ 삽수를 한 번도 못 자르고, `varieGrantCheck` 가 막아 **튜토가 안 끝난다.**
> ⇒ 실질 상한은 **콩13**이다.

**그 셈이 코드와 다르다.** 셈은 「한 회전 = 손 3번」을 **시루마다** 세는데,
코드는 **부를 때마다 한 번**을 문다:

| 동작 | 한 번에 무엇을 하나 | 무는 손 |
|---|---|---|
| `loop.harvestCrop` | 익은 시루를 **전부** 거둔다 | 1 |
| `state.resowCrop` | 거둔 시루를 **전부** 다시 심는다 | 1 |
| `state.waterCrop` | 시루 **하나** (`{all:true}` 면 전부) | 1 |

그래서 완전 시차 콩15의 하루는 `수확 1 + 심기 1 + 물 ⌈15/5⌉=3` = **5** 다.

### 실측 — 진짜 판을 90일 굴려 뒤 45일을 셌다 (`test_cutstamina` §E)

**완전 시차**(거두는 날을 어긋나게 둔 것 · 게임이 권하는 쪽)

| 계획 | 선 시루 | 하루 손 최대 | 평균 | 남는 손 최소 | 자를 손이 없는 날 |
|---|---|---|---|---|---|
| 콩5 | 5 | 3 | 3.00 | 7 | 0/45 |
| 콩10 | 10 | 4 | 4.00 | 6 | 0/45 |
| 콩13 | 13 | 5 | 4.60 | 5 | 0/45 |
| **콩15** | 15 | **5** | **5.00** | **5** | **0/45** |
| 콩17 | 17 | 6 | 5.40 | 4 | 0/45 |

**같은 날에 몰아주기**(겹침 · 게임이 말리는 쪽)

| 계획 | 하루 손 최대 | 평균 | 남는 손 최소 | 자를 손이 없는 날 |
|---|---|---|---|---|
| 콩5 | 7 | 1.40 | 3 | 0/45 |
| 콩10 | 10 | 2.80 | 0 | 9/45 |
| 콩13 | 10 | 3.40 | 0 | 9/45 |
| 콩15 | 10 | 3.80 | 0 | 9/45 |
| 콩17 | 10 | 4.60 | 0 | 18/45 |

### 결론 셋

1. **콩15는 삽수를 자를 수 있다.** 완전 시차에서 손이 매일 5 남는다.
   따라서 「실질 상한 콩13」도, 「콩15가 튜토를 막는다」도 **성립하지 않는다.**
2. **체력이 아무것도 안 막는 것은 아니다.** 겹치게 굴리면 수확일마다 10/10 이 되어
   그날은 못 자른다(콩10 이상 · 45일 중 9일). 다만 그건 **시루 수의 벌이 아니라 겹침의 벌**이고,
   처방도 `first_play` §겹침 그대로 *"물을 날을 달리해 줘라"* 다.
   그래도 나머지 36일은 손이 남으므로 **영영 못 자르는 판은 없다.**
3. **문서의 「하루 7번」은 코드에서 6번이다.** 그 7 에는 「몬스테라 물 1」이 들어 있는데
   코드에 몬스테라에 물을 주는 동작이 **없다**(`ACT_COST.water` 를 무는 곳은
   `state.waterCrop` = 작물 시루뿐이다). 여기서 만들지 않았다 — 재서 남긴다.

## → plan 창에 부탁드리는 것 (①)

* `docs/stamina.md §2` 의 천장 표(15/13)와 `docs/handoff/econgap-to-plan.md` A-3 을
  **위 실측으로 고쳐 주세요.** 지금 그 표는 「시루마다 손 3번」을 전제로 하는데 코드가 다릅니다.
  ⏸ 로 남겨 두신 *"콩15가 삽수를 막는 것이 긴장인지 막다른 길인지"* 는 **질문 자체가 사라졌습니다.**
* ⏸ **판단이 필요한 것** — `waterCrop({all:true})` 은 시루가 몇 개든 손 1 입니다.
  지금 `game.html` 의 [물 주기] 버튼은 `waterCrop(S)`(=한 시루)로 붙어 있어서
  플레이어는 시루마다 눌러야 하고 그만큼 손을 씁니다. 「전부 주기」 버튼을 열면
  체력 상한이 사실상 **시루 수와 무관**해집니다. 그게 뜻인지 아닌지는 박사님 판단입니다.
* ⏸ **몬스테라 물주기를 실제 동작으로 만들지** 결정해 주세요. 문서에는 있고 코드에는 없습니다.

---

# ② ④ 엔딩 — 도는 것은 확인했다. 붙이는 것만 남았다

## 확인한 것

`src/game/ending.js` 는 **멀쩡히 돈다.** 다만 `game.html` 이 안 부를 뿐이었다(`grep` 0).
`tools/test_ending_flow.mjs` 가 진짜 하루 루프 안에서 끝까지 굴려 증명한다:

```
완주 — 이사 100일차 · 첫 자르기 29일차 · 첫 판매 101일차 · 닿음 101일차 · 끝냄 101일차
```

반지하 시작 → `loop.nextDay` 로 하루씩 → 콩나물 회전 → 삽수 자르기 → `moveIntoOneroom`
(조도 창이 실제로 원룸을 짓는다) → 원룸에서 삽수를 **팔아서** → `stepEnding` 이 「닿았다」를
한 번만 내고 → `finishEnding` 이 계약금을 빼고 ④ 로 굳는다 → 저장·복원 왕복에서 살아남는다.

## ★★ game.html 이 부를 정확한 시그니처

`ending.js` 는 전부 순수 함수다. THREE·DOM·타이머를 모른다.

### ㉮ 규칙 만들기 — 판을 열 때 **한 번**

```js
import { endingRulesFromHomes } from './src/game/ending.js';
const HOMES = await (await fetch('./data/balance/homes.json')).json();
const ENDING = endingRulesFromHomes(HOMES);        // ⏸ 지금은 targetWon: null 이 나온다
const eopt = () => ({ rules: ENDING,
                      nodes: io.growth.cuttableNodes(),   // 없으면 모주 값을 안 센다
                      stats: io.growth.leafStats() });
```

> `endingRulesFromHomes` 는 **이번에 새로 넣었다.** 예전에는 `endingRulesFrom({targetWon})`
> 밖에 없어서 **그 숫자를 어디서 받나**가 아무 데도 없었다 — 화면이 값을 직접 들고 있어야 했고
> 그 순간 정본이 코드로 들어온다. 이제 `oneroom.oneroomRulesFromHomes` 와 **같은 결**이다.

### ㉯ 하루마다 — `nextDay` **뒤에** (loop 이 안 부른다)

```js
const r = stepEnding(S, io, eopt());
// r = { reached, firstTime, events:[{id:'ending_ready', ko, targetWon, cashWon}] }
if (r.firstTime) { banners(...); dlgOpen(story.events(r.events)); }
```

⚠ **빨리감기·점핑에도 같이 걸어야 한다.** `runFast`/`jump` 의 `onDay(turn)` 안에서도
하루에 한 번 불러야 「닿았다」를 안 놓친다. `loop.js` 는 `ending.js` 를 import 하지 않는다
(그쪽은 소유 밖이라 안 건드렸다).

### ㉰ 화면 — **한 번에 읽는 창구를 넣었다**

```js
import { endingView } from './src/game/ending.js';
const v = endingView(S, io, eopt());
btn.style.display = v.visible ? '' : 'none';   // ★③ 전에는 버튼 자체를 안 보인다
btn.disabled      = v.disabled;
btn.textContent   = v.buttonKo;                // '내 집 마련' / '내 집 마련하기' / '내 집 마련 완료'
btn.title         = v.title;                   // 못 누를 때의 이유 (v.why 와 같다)
goalEl.textContent = v.goal ? v.goal.ko : '';
```

반환 전체:
`{ stage, stageKo, visible, disabled, buttonKo, title, done, ok, goal:{id,ko},`
` targetWon, cashWon, netWorthWon, shortWon, netShortWon, reachedOnDay, doneOnDay, why }`

★ `canMoveOut` + `tutorialGoal` 을 합친 모양이라 §draw 의 `const mv = $('moveOut')` 블록과
**똑같이** 읽힌다. 셋(`canFinish`·`endingProgress`·`endingGoal`)을 따로 부르면 화면이
같은 것을 세 번 세고, 어긋나는 날 아무도 못 찾는다(검사 E-3 이 셋의 일치를 고정한다).

### ㉱ 버튼 — 되돌릴 수 없다

```js
$('finishEnding').onclick = confirmOnce('내 집을 마련합니까?', guard(() => {
  const r = finishEnding(S, io, eopt());
  // r = { done, doneOnDay, cashWon, paidWon, nextChapter:'job_select', events:[{id:'ending_home',...}] }
  banners([{ title: '🏡 내 집을 마련했습니다', sub: `${r.paidWon.toLocaleString()}원` }]);
  dlgOpen(story.events(r.events));
  draw();
}));
```

* 조건을 못 채우면 **`tutorialInput` 을 달고 던진다** — `isRecoverable` 이 이미 받는다.
* `nextChapter: 'job_select'` 만 알린다. **직업 선택 화면은 이 창이 안 만들었다**
  (`story_arc.md` §0 — ④ 까지가 자취생 고정, 그 뒤가 본편).
* 대사 id 는 `ending_ready` · `ending_home` 둘이다. `dialogue.EVENT_SCRIPT` 에 **아직 없다** —
  없는 id 는 조용히 지나가므로 안 붙여도 안 깨진다.

### ㉲ 이미 있는 것 (안 바뀜)

`endingProgress(S, io, opt)` · `canFinish(S, io, opt)` · `endingGoal(S, io, opt)` ·
`noviceStillOn(S)` · `oneroom.storyStatus(S)`

---

## ★ 못 한 것 · 막힌 것

### ㉠ ⏸ **④ 목표 금액이 없어서 지금은 붙여도 아무것도 안 뜬다** — 제일 큰 것

`ENDING_RULES.targetWon` 은 `null` 이다(`story_arc.md` §5 미확정). 재현이 재 봤다 —
**원룸에서 100일을 굴려도 `stepEnding` 이 조용히 지나가고 ④ 가 안 열린다**(검사 B-1).

→ **plan 창이 `data/balance/homes.json` 에 한 칸만 적어 주시면** 코드는 그대로 돕니다:

```json
{ "ending": { "targetWon": 10000000 } }
```

후보 1,000만원과 역산(성체 4~17그루)은 `docs/propagation.md` §7 · `docs/oneroom.md` §5.
`data/**` 는 소유 밖이라 이 창이 안 적었습니다. 검사 B-2 가 「칸이 생기면 그 값으로 돈다」를
이미 고정해 두었습니다.

### ㉡ ★ 실측 — **지금 벌이로는 그 금액에 영영 못 닿는다**

재현이 원룸 160일을 굴린 값이다(`test_ending_flow` §F-1).

| 원룸 | 게임일 | 현금 | 다 팔면 |
|---|---|---|---|
| 0일째 | 101일 | 12,000원 | 24,000원 |
| 30일째 | 131일 | **0원** | 12,000원 |
| 60일째 | 161일 | 0원 | 12,000원 |
| 90일째 | 191일 | 0원 | 12,000원 |
| 120일째 | 221일 | 0원 | 12,000원 |

**원룸 160일 동안의 최고 현금 = 12,000원**(삽수 한 개 값). 월세는 계속 나가고
삽수는 더 안 늘어난다 — 원룸의 빛이 갈라짐·무늬 문턱을 하나도 못 넘어서
모주가 새 잎을 안 내기 때문이다(`docs/oneroom.md` §3 이 이미 적은 것).

⇒ **③ 원룸은 지금 경제적으로 죽은 구간이다.** ④ 목표 금액을 정하기 **전에**
원룸의 빛(house 창)이나 삽수 회전(plan 창)이 먼저 살아나야 한다.
그래서 재현의 A 검사는 목표를 `shop.UNIT_WON.monstera.cutting`(12,000원)으로 두었다 —
**재현용 입력이지 밸런스 값이 아니다.** 그러지 않으면 배선 검사가 밸런스에 인질로 잡혀
`finishEnding` 이 도는지를 영영 못 본다.

### ㉢ ★★ **`isNoviceMode` 가 실제 게임에서 ④ 를 못 본다** — 판단이 필요합니다

```js
// propagation.js §isNoviceMode 첫 줄
if (S.sim && S.sim.mode === 'novice') return true;
```

그런데 `S.sim.mode` 는 **날씨·계절 굴림 스위치**다 —
`state.SIM_MODES.novice` 의 뜻은 *"초보 (계수 1.0 고정)"*, 즉 맑음·여름 고정이지
스토리 난이도가 아니다. 그리고 **`game.html` 은 새 판을 언제나 `mode:'novice'` 로 연다**
(§1223 · §4018 · §4099).

⇒ 실제 게임에서는 첫 줄이 **항상 참**이라 그 아래 스토리 판정이 **한 번도 안 읽힌다.**
2026-08-05 정정(*"④ 까지 초보다 · ④ 에서 걷힌다"*)의 **뒷부분이 닿지 않는다** —
삽수 유예가 영원히 16일이고, 모주를 끝내는 자르기도 영원히 막혀 있다.

**여기서 안 고쳤다.** `sim.mode:'novice'` 가 스토리 초보를 겸하는 것이 뜻인지
(자유 판에서도 완충을 주려던 것인지) 아닌지는 규칙 결정이고, 고치면 자유 모드·재현
전체의 삽수 규칙이 같이 바뀐다. 재현(`test_ending_flow` §D-1b)이 사실만 못 박아 두었다 —
규칙을 바꾸시면 그 검사가 바로 FAIL 로 알려 준다.

⏸ **박사님 판단이 필요한 것**: 둘 중 하나입니다.
  ㉮ 날씨 모드와 스토리 초보를 **가른다** — `isNoviceMode` 에서 첫 줄을 빼고
     `storyRunning(S)` 하나로 본다. 그러면 ④ 에서 완충이 실제로 걷힌다.
  ㉯ 지금 그대로 둔다 — `mode:'novice'` 로 여는 판은 영원히 초보다.
     그러면 `story_arc.md` §0 의 *"④ 까지"* 라는 범위 표현을 고쳐야 한다.

### ㉣ → house 창 : **원룸 프로파일이 안 열린다** (전에도 보고된 것 · 그대로다)

`data/profiles/room_profile.oneroom.json` 에 `uidStable` 이 없어
`createProfileLight` 이 거부한다. 재 보니 **`uidStable:true` 가 찍힌 프로파일은
`banjiha` 하나뿐**이고 나머지 다섯(`oneroom`·`tworoom`·`apartment`·`classroom`·`greenhouse`)이
전부 옛 파일이다. 게다가 원룸은 슬롯 11칸 **전부 `maxPotD` 가 없다.**

지금은 `test_ending_flow` 가 **하네스 안에서만** 그 깃발을 세워 돌린다(그 사실을 매번 INFO 로
찍는다). 브라우저에서 house 의 `_profile_gen.html` 로 다시 뽑아 주시면 우회를 지웁니다.

---

## 검사

```
node tools/test_cutstamina.mjs      13/13   (A~D 배선 9건 + E 실측 4건)
node tools/test_ending_flow.mjs     16/16   (A 완주 5 · B 미확정 2 · C 저장 1 · D 뒤 3 · E 창구 3 · F 실측 2)
전체                                30/30
```

`test_ending_flow` 는 헤드리스 생장 엔진(`plant_grow.html` 을 `node:vm` 으로)을 돌린다 —
`tools/test_balance_routes.mjs` 와 **같은 하네스**이고 새로 짓지 않았다.
