/* src/game/nudge_wait.js — **독촉을 «할 수 있었던 날»만 센다** (박사님 D2 · 2026-10-07)
   ------------------------------------------------------------------
   박사님 답(master-campaign-20261007 §3 D2): 독촉 세기는 «할 수 있었던 날만». 독촉 차례 규칙은 그대로.
   ⛔ 났던 일(09-25 렌즈 1·2·4 공통 1위): d2~d25 거의 매일 독촉이 나오고 잡담(chatCrop·부모·집주인)이 한 번도 안 떴다.
     가장 먼저 열린 퀘스트가 «사람 손으로는 할 것이 없는» 퀘스트(잎이 자라기를 · 시루가 익기를 기다림)여도
     그 퀘스트를 붙잡고 매일 독촉했다.
   ⇒ 여기서 «지금 기다리는 중인가»를 가른다. 기다리는 중인 퀘스트는 독촉 고리(`dialogue.chatterContext`)가 건너뛴다.
     기다리는 날은 «안 한 날»이 아니다.

   ★ 무엇이 «기다림»인가 — 09-25 에 준비해 둔 패치(master-story-plan-20260925.md ⓐ) 그대로다. 새로 짓지 않았다:
     leaf_two · leaf_three   늘 기다림 — 잎은 손으로 못 늘린다(자리를 옮기는 것은 monstera_home 몫이다)
     first_harvest           익은 시루(ready)가 하나도 없으면 기다림
     order_seed              씨앗이 오는 중이거나 · 재고가 있거나 · 시루가 자라는 중이면 기다림
     oneroom_root_bright     무늬 삽수가 뿌리내리는 중(rooting)이면 기다림          ← 2026-10-08 [plan] 청
     oneroom_settle_cutting  뿌리는 냈는데(rooted) 혹(node)이 아직이면 기다림        ← 2026-10-08 [plan] 청
   ⚠ 그 밖의 퀘스트는 «할 수 있다»로 본다(false). 모르는 것을 기다림으로 치면 독촉이 영영 안 나온다 —
     그쪽이 «매일 독촉»보다 나쁘다(사람이 막혔는데 아무도 안 알려 준다).
   ⚠ 읽기만 한다. 상태를 안 바꾸고 세이브 칸도 없다.
   ⚠ 이 파일은 dialogue.js 를 import 하지 않는다(dialogue → 이 파일 한 방향). */
import { cropPotList } from './first_play.js';
import { stockOf, pendingOrders } from './shop.js';

/* 늘 기다리는 퀘스트 — 사람 손으로 할 것이 없다 */
export const NUDGE_ALWAYS_WAIT = Object.freeze(['leaf_two', 'leaf_three']);
/* 콩나물 씨앗 품목 — first_play.CROP_KINDS.beansprout.seedItemId 와 같은 값이다 */
const BEAN_SEED_ITEM = 'bean_seed';

function cropRows(S, day) {
  try { return (S && S.firstPlay) ? (cropPotList(S.firstPlay, day) || []) : []; }
  catch { return []; }
}

/* 그 퀘스트가 오늘 «기다리는 중»인가. true 면 독촉하지 않는다.
     S    게임 상태 (읽기만)
     id   퀘스트 id (stamina.questsOpenedOn 의 열쇠)
     day  오늘(없으면 S.day) */
export function nudgeWaiting(S, id, day = (S && S.day)) {
  if (NUDGE_ALWAYS_WAIT.includes(id)) return true;
  if (id === 'first_harvest') {
    const rows = cropRows(S, day);
    return !rows.some(r => r && r.ready);
  }
  if (id === 'order_seed') {
    let coming = false, stock = 0;
    try { coming = pendingOrders(S).some(o => o && o.itemId === BEAN_SEED_ITEM); } catch { }
    try { stock = stockOf(S, BEAN_SEED_ITEM); } catch { }
    const growing = cropRows(S, day).some(r => r && r.growing);
    return coming || stock > 0 || growing;
  }
  /* ★ 2026-10-08 원룸 줄([plan] f39fbddb 청) — 사람이 할 일을 «이미 해 놓고» 몸이 자라기를 기다리는 동안은 독촉하지 않는다 */
  if (id === 'oneroom_root_bright') {
    /* 무늬 삽수를 잘라 꽂아 «뿌리내리는 중»이면 기다림(밝은 자리에 두는 것까지 했다) */
    return (S && Array.isArray(S.cuttings) ? S.cuttings : []).some(c => c && c.varieFromCut && c.status === 'rooting');
  }
  if (id === 'oneroom_settle_cutting') {
    /* 뿌리는 냈는데 아직 «혹»이 안 났으면 기다림 — 혹이 나야 흙으로 옮길 수 있다(혹이 나면 할 수 있음) */
    const cs = (S && Array.isArray(S.cuttings) ? S.cuttings : []).filter(c => c && c.varieFromCut);
    return cs.some(c => c.status === 'rooted') && !cs.some(c => c.status === 'node');
  }
  return false;
}

/* ★ 2026-10-08 D2 — **기다린 날을 적는다.** 열려 있고 안 끝난 퀘스트가 오늘 기다리는 중이면 `questsWaitedOn[id] = day`.
   화면이 하루 대사를 고르기 «바로 앞»에 한 번 부른다(game.html §story.turn 앞). 다른 것은 안 바꾼다.
   ⚠ 이것이 유일하게 상태를 바꾸는 함수다(세이브 칸 stamina.questsWaitedOn). */
export function noteQuestWaits(S, day = (S && S.day)) {
  const stm = S && S.stamina;
  if (!stm || !stm.questsOpenedOn || !Number.isInteger(day)) return 0;
  if (!stm.questsWaitedOn || typeof stm.questsWaitedOn !== 'object') stm.questsWaitedOn = {};
  const done = new Set(stm.questsTaken || []);
  let n = 0;
  for (const id of Object.keys(stm.questsOpenedOn)) {
    if (done.has(id)) continue;
    if (nudgeWaiting(S, id, day)) { stm.questsWaitedOn[id] = day; n++; }
  }
  return n;
}

/* ★ 2026-10-08 D2 — **독촉이 세는 날수.** 열린 날이 아니라 «마지막으로 기다린 날의 다음 날»부터 센다.
     열린 뒤 한 번도 안 기다렸으면 예전 그대로(열린 날부터) — 기다림이 있던 퀘스트만 늦게 센다.
   반환 0 이상 정수(오늘이 할 수 있게 된 첫날이면 0). */
export function nudgeDaysOf(S, id, openedOn, dayNow) {
  const waited = S && S.stamina && S.stamina.questsWaitedOn ? S.stamina.questsWaitedOn[id] : null;
  const from = Number.isInteger(waited) && waited >= openedOn ? waited + 1 : openedOn;
  return Math.max(0, dayNow - from);
}
