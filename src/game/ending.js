/* ============================================================
   game/ending.js — ④ 내 집 마련 엔딩 (core 소유) · 2026-08-05 신설
   ------------------------------------------------------------
   `docs/story_arc.md` §0 의 마지막 칸이다.

     ① 반지하 → ② 탈출 → ③ 원룸 → ★④ **삽수를 팔아 내 집 마련**

   ══ ★ ② 와 **같은 모양**으로 짰다 ═══════════════════════════════════════
   반지하를 나가는 규칙은 이미 있다(`tutorial.canMoveOut` · `moveOut`):
     · 현금이 목표에 닿아야 한다
     · 닿으면 버튼이 열리고, 누르면 그 돈이 나가고 깃발이 선다
   ④ 도 똑같이 둔다. **플레이어가 이미 아는 동작**이고, 두 번째라 설명이 필요 없다.
   `sale_economy.md` §3 이 만든 *"오늘 버티려고 파느냐, 키워서 파느냐"* 가 여기서 한 번 더 난다
   (`docs/propagation.md` §7 — 「성체 4그루냐 삽수 16개냐」).

   ★ ② 와 **다른 것 하나** — ④ 에는 학습 체크리스트가 없다. ②는 *"돈만 모으면 자동으로
     끝나는 구조를 피한다"* 였는데(story_arc.md §1), 그건 **가르치는 구간**이라서다.
     ④ 는 배운 것을 쓰는 구간이라 축이 하나다. 축을 하나 더 만들면 엔딩이 또 다른 튜토가 된다.

   ══ ★★ 목표 금액은 **미확정이다. 지어내지 않았다** ═════════════════════════
   `story_arc.md` §5 가 미확정으로 남긴 그대로다 — *"④ 내 집 마련의 목표 금액"*.
   `docs/propagation.md` §7 이 **후보 1,000만원**과 그 역산(4~17그루)을 적어 두었지만
   그 문서 자신이 *"⏸ 금액은 후보다. ③ 원룸의 슬롯 수·월세가 정해지면 재역산한다"* 라고 썼다.

   그래서 여기 `ENDING_RULES.targetWon` 은 **`null`** 이다. 0 이 아니다 —
   0 이면 「시작하자마자 엔딩」이 조용히 성립한다. `null` 은 아래 함수들이 전부
   *"아직 안 정해졌다"* 로 답하게 만든다. 확정되면 값을 여기 박는 것이 아니라
   `endingRulesFrom({ targetWon })` 으로 **주입**한다(정본은 plan 소유 파일이 갖는다).

   ★ THREE 를 쓰지 않는다. DOM 도 타이머도 모른다.
============================================================ */

import { sellableWonOf } from './tutorial.js';
import { storyOf, stageOf, STAGES, storyRunning } from './oneroom.js';
import { pushLog } from './state.js';

/* ============================================================
   ① 규칙 — ⏸ **자리만 있다**
============================================================ */
export const ENDING_RULES = Object.freeze({
  id: 'home_purchase',
  ko: '내 집 마련',
  /* ⏸ 미확정 (story_arc.md §5). 후보와 역산은 docs/oneroom.md §5 · docs/propagation.md §7.
     ⚠ 여기에 후보값을 적지 않는다 — 적는 순간 그것이 확정처럼 굳고, 실측하는 워커가
       고친 값과 조용히 갈린다. 숫자는 문서에, 코드에는 자리에. */
  targetWon: null,
  /* ★ 엔딩은 **현금**으로 판정한다 — 「가진 것을 다 팔면 닿는다」가 아니라
     실제로 팔아서 지갑에 넣어야 한다. ②(tutorial.canMoveOut)와 같은 규칙이고,
     그래야 마지막 행동이 **삽수를 파는 것**이 된다(story_arc.md §0 ④ 의 문장 그대로). */
  judgeBy: 'cash'
});

/* 목표 금액을 주입한다. `first_play.firstPlayRulesFromBalance` · `oneroom.oneroomRulesFromHomes`
   와 같은 결 — 코어는 살림 값을 갖지 않고 받아 쓴다.
   ⚠ 세이브는 rules 를 안 적는다(save.js §packTutorial). 새 판과 이어하기가 **같은 객체**를
     받아야 목표 금액이 저장 왕복에서 안 바뀐다. */
export function endingRulesFrom({ targetWon } = {}) {
  if (targetWon == null) return ENDING_RULES;
  if (!Number.isFinite(targetWon) || targetWon <= 0)
    throw new Error(`[엔딩] 목표 금액이 0보다 큰 수가 아닙니다: ${targetWon}`);
  return Object.freeze({ ...ENDING_RULES, targetWon: Math.round(targetWon) });
}

const rulesOf = (opt) => (opt && opt.rules) || ENDING_RULES;

/* ============================================================
   ② 지금 얼마나 왔나
   ------------------------------------------------------------
   ★ **두 수를 같이 낸다.** 둘이 다른 것을 말하기 때문이다:
       cashWon      지금 지갑 — 엔딩 판정은 이것으로 한다
       netWorthWon  다 팔면 얼마 — *"팔면 닿는데 아직 안 팔았다"* 를 화면이 말할 수 있게
     `netWorthWon` 은 `tutorial.sellableWonOf` 를 그대로 쓴다. 값을 매기는 자리
     (`shop.priceOf`)와 **같은 값**을 봐야 하고, 그 함수가 이미 그렇게 짜여 있다
     (모주는 잘라낸 잎을 빼고, 삽수는 지금 달고 있는 잎으로 센다).

     endingProgress(S, io, { rules, nodes, stats })
       nodes  growth.cuttableNodes()   ─ 없으면 모주 값을 **안 센다**(지어내지 않는다)
       stats  growth.leafStats()
   반환 { ok, targetWon, cashWon, netWorthWon, shortWon, netShortWon, why } */
export function endingProgress(S, io = {}, opt = {}) {
  const R = rulesOf(opt);
  const ts = S && S.tutorial;
  const cashWon = ts ? ts.cashWon : 0;
  const netWorthWon = ts ? sellableWonOf(S, { nodes: opt.nodes ?? null, stats: opt.stats ?? null })
                         : cashWon;

  if (R.targetWon == null)
    return { ok: false, targetWon: null, cashWon, netWorthWon,
             shortWon: null, netShortWon: null,
             why: '④ 목표 금액이 아직 정해지지 않았습니다 — docs/story_arc.md §5 미확정 ' +
                  '(후보·근거는 docs/oneroom.md §5). endingRulesFrom({targetWon}) 로 주입하세요' };

  const shortWon = Math.max(0, R.targetWon - cashWon);
  return {
    ok: shortWon === 0,
    targetWon: R.targetWon, cashWon, netWorthWon,
    shortWon,
    netShortWon: Math.max(0, R.targetWon - netWorthWon),
    why: shortWon === 0 ? null
       : netWorthWon >= R.targetWon
         ? `가진 것을 다 팔면 닿습니다 — ${shortWon.toLocaleString()}원어치를 팔아 주세요`
         : `${shortWon.toLocaleString()}원이 더 필요합니다`
  };
}

/* 엔딩을 볼 수 있나. `tutorial.canMoveOut` 과 같은 모양이라 화면이 같은 방식으로 읽는다. */
export function canFinish(S, io = {}, opt = {}) {
  const stage = stageOf(S);
  if (stage === STAGES.ending)
    return { ok: false, done: true, why: '이미 내 집을 마련했습니다' };
  if (stage !== STAGES.oneroom)
    return { ok: false, done: false, why: '아직 반지하입니다 — 먼저 원룸으로 이사해야 합니다' };
  const p = endingProgress(S, io, opt);
  return { ...p, done: false };
}

/* ============================================================
   ③ 하루 — **목표에 처음 닿은 날**만 적는다
   ------------------------------------------------------------
   ★ 자동으로 끝내지 않는다. 닿았다고 게임이 알아서 엔딩을 틀면 마지막 장면이
     플레이어의 행동이 아니게 된다(②에서 [원룸으로 이사] 버튼을 남겨 둔 것과 같은 판단).
     여기서는 「닿았다」는 사건만 내고, 끝내는 것은 `finishEnding` 이 한다.
   ★ 사건은 **한 번만** 난다. 목표 언저리에서 돈이 오르내려도 다시 안 낸다 —
     `reachedOnDay` 가 그 기록이고 세이브에도 남는다.

   loop.nextDay 가 부를 자리다(아직 안 붙었다 — docs/oneroom.md §6 배선 인계).
   반환 { reached, firstTime, events } */
export function stepEnding(S, io = {}, opt = {}) {
  const story = storyOf(S);
  if (stageOf(S) !== STAGES.oneroom) return { reached: false, firstTime: false, events: [] };
  const p = endingProgress(S, io, opt);
  if (!p.ok) return { reached: false, firstTime: false, events: [] };
  if (story.ending.reachedOnDay != null)
    return { reached: true, firstTime: false, events: [] };
  story.ending.reachedOnDay = S.day;
  pushLog(S, `🏠 내 집 마련 자금 ${p.targetWon.toLocaleString()}원을 모았습니다`);
  return { reached: true, firstTime: true,
           events: [{ id: 'ending_ready', ko: '내 집을 마련할 수 있습니다',
                      targetWon: p.targetWon, cashWon: p.cashWon }] };
}

/* ============================================================
   ④ ★★ 끝낸다
   ------------------------------------------------------------
   ★ `tutorial.moveOut` 과 같다 — 조건을 못 채우면 **안내처럼** 던진다(`tutorialInput`).
   ★ 계약금이 나간다. ②에서 이사비가 빠진 것과 같은 이유이고, 서사도 같다 —
     1,000만원 후보의 근거가 *"계약금 / 보증금 일부"* 였다(docs/propagation.md §7).

   ★★ **직업 선택은 여기 없다.** story_arc.md §0 이 못 박았다 —
     *"①반지하 → ②탈출 → ③원룸 → ④내 집 마련 엔딩 ← 여기까지 자취생 고정."*
     그 뒤가 본편이고 거기서 직업을 고른다. 이 창은 그 화면을 만들지 않는다.
     대신 **다음 장이 무엇인지만** 반환값에 실어 보낸다(`nextChapter`) — 화면이 그걸 읽고
     자기 방식으로 넘어가면 된다. 여기서 직업 상태를 만들면 그 순간 정본이 둘이 된다.

   반환 { done, doneOnDay, cashWon, paidWon, nextChapter, events } */
export function finishEnding(S, io = {}, opt = {}) {
  const c = canFinish(S, io, opt);
  if (!c.ok) {
    const e = new Error('[엔딩] ' + (c.why || '아직 끝낼 수 없습니다'));
    e.tutorialInput = true;                 // 안내지 고장이 아니다
    throw e;
  }
  const story = storyOf(S);
  const ts = S.tutorial;
  const paidWon = c.targetWon;
  ts.cashWon -= paidWon;
  if (story.ending.reachedOnDay == null) story.ending.reachedOnDay = S.day;
  story.ending.doneOnDay = S.day;
  pushLog(S, `🏡 내 집을 마련했습니다 — ${paidWon.toLocaleString()}원 · Day ${S.day}`);
  return {
    done: true, doneOnDay: S.day, cashWon: ts.cashWon, paidWon,
    /* ★ 초보 스토리가 여기서 끝난다. 다음은 본편이고, 거기서 직업을 고른다. */
    nextChapter: 'job_select',
    events: [{ id: 'ending_home', ko: '내 집을 마련했습니다', paidWon, day: S.day }]
  };
}

/* ============================================================
   ⑤ 화면이 「지금 무엇을 하면 되나」를 적을 때 — tutorialGoal 과 같은 모양
============================================================ */
export function endingGoal(S, io = {}, opt = {}) {
  const stage = stageOf(S);
  if (stage === STAGES.banjiha) return null;          // ③ 전에는 ④ 를 말하지 않는다
  if (stage === STAGES.ending) return { id: 'done', ko: '내 집을 마련했습니다' };
  const p = endingProgress(S, io, opt);
  if (p.targetWon == null) return { id: 'undecided', ko: '내 집 마련 목표가 아직 정해지지 않았습니다' };
  if (p.ok) return { id: 'ready', ko: '내 집을 마련할 수 있습니다' };
  return { id: 'money', ko: p.why };
}

/* ★ 초보 모드가 여기서 끝난다 — 화면·재현이 같은 창구로 읽게 다시 낸다.
   판정 자체는 `oneroom.storyRunning` 하나뿐이다(두 곳에서 세지 않는다). */
export function noviceStillOn(S) { return storyRunning(S); }
