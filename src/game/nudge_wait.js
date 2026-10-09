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
     order_seed              씨앗이 오는 중이거나 · 시루가 자라는 중이거나 · 익은 시루가 있으면 기다림 ← 2026-10-08 [plan] 지도 13·14 로 좁힘
     oneroom_root_bright     무늬 삽수가 뿌리내리는 중(rooting)이면 기다림          ← 2026-10-08 [plan] 청
     oneroom_settle_cutting  뿌리는 냈는데(rooted) 혹(node)이 아직이면 기다림        ← 2026-10-08 [plan] 청
     first_cut               잘라 물에 꽂아 «뿌리내리는 중»(water · rooting)이면 기다림 ← 2026-10-08 D25(총괄)
     varie_bright            무늬 원천(무늬 잎 단 그루 + 안 죽은 무늬 삽수)이 0 이면 기다림 ← 2026-10-08 [plan] be02f66a
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
    /* ★ 2026-10-08 [plan] 갈래 지도 13·14 — «재고가 있다»를 기다림에서 뺐다: 씨앗을 사 두고 안 심은 판은 할 일이 있다(심기).
         그리고 익은 시루가 있으면 기다림 — 진짜 막힘은 «씨앗»이 아니라 «거두기»다(그 독촉은 다른 줄 몫). */
    let coming = false;
    try { coming = pendingOrders(S).some(o => o && o.itemId === BEAN_SEED_ITEM); } catch { }
    const rows = cropRows(S, day);
    const growing = rows.some(r => r && r.growing);
    const ready = rows.some(r => r && r.ready);
    return coming || growing || ready;
  }
  /* ★ 2026-10-08 원룸 줄([plan] f39fbddb 청) — 사람이 할 일을 «이미 해 놓고» 몸이 자라기를 기다리는 동안은 독촉하지 않는다 */
  if (id === 'oneroom_root_bright') {
    /* 무늬 삽수를 잘라 꽂아 «뿌리내리는 중»이면 기다림(밝은 자리에 두는 것까지 했다) */
    /* ⚠ 2026-10-08 — 방에 «놓인» 삽수만(가방 속 삽수는 하루가 안 간다 · propagation §stepCuttings) — 가방에 둔 것을 기다림으로 치면 «놓으라»가 영영 안 나온다 */
    return (S && Array.isArray(S.cuttings) ? S.cuttings : []).some(c => c && c.varieFromCut && c.status === 'rooting' && (c.at || c.slotId));
  }
  /* ★ 2026-10-08 D25(총괄) — first_cut 은 «뿌리를 냈다»로 끝난다. 잘라 물에 꽂은 뒤로는 사람이 할 것이 없다.
     ⚠ «자르기 문이 잠긴 동안»(무늬 다 자란 잎 < 2)은 여기서 안 센다 — [plan] c07263f1 이 그동안 퀘스트를 «안 연다»(열린 것만 독촉한다). */
  if (id === 'first_cut') {
    return (S && Array.isArray(S.cuttings) ? S.cuttings : []).some(c => c && c.method === 'water' && c.status === 'rooting' && (c.at || c.slotId));   /* 놓인 것만(위와 같은 까닭) */
  }
  if (id === 'oneroom_settle_cutting') {
    /* 뿌리는 냈는데 아직 «혹»이 안 났으면 기다림 — 혹이 나야 흙으로 옮길 수 있다(혹이 나면 할 수 있음) */
    const cs = (S && Array.isArray(S.cuttings) ? S.cuttings : []).filter(c => c && c.varieFromCut && (c.at || c.slotId));   /* 놓인 것만 */
    return cs.some(c => c.status === 'rooted') && !cs.some(c => c.status === 'node');
  }
  /* ★ 2026-10-08 [plan] be02f66a 청 — 반지하 varie_bright 는 «무늬 원천 0»이면 기다림.
     모주를 일찍 판 판(갈래 판 seller)에서 할 수 없는 일을 주 1회 시키고 있었다(6/6 판 끝까지). */
  if (id === 'varie_bright') return varieSourceCount(S) === 0;
  return false;
}

/* ★ 2026-10-08 — **무늬 원천** = 무늬 잎 단 그루 수 + 안 죽은 무늬 삽수 수 (plan «갈래 지도» §7 의 말 그대로).
   그루의 무늬 잎은 등급 장부(pot.leafGrades · 화면이 턴 끝에 무늬 잎마다 적는다)로 본다 — 생장 창을 안 묻는다(이 파일은 S 만 읽는다).
   ⚠ 장부는 떨어진 잎을 안 지우므로 «더» 셀 수는 있어도 «덜» 세지 않는다 ⇒ 틀려도 «할 수 있다»(독촉 함) 쪽으로 틀린다 — 위 ⚠ 의 안전한 쪽.
   ⚠ 화면을 안 거치는 판(헤드리스)은 장부가 비어 그루 쪽이 0 으로 나온다 — 그 판은 삽수 쪽만 센다. */
export function varieSourceCount(S) {
  const pots = (S && Array.isArray(S.pots) ? S.pots : [])
    .filter(p => p && p.leafGrades && typeof p.leafGrades === 'object' && Object.keys(p.leafGrades).length > 0).length;
  const cuts = (S && Array.isArray(S.cuttings) ? S.cuttings : [])
    .filter(c => c && c.status !== 'dead' && (c.varieFromCut || (c.variegatedLeaves || 0) > 0)).length;
  return pots + cuts;
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
