/* 대화 — 대사 데이터와 진행 규칙 (2026-08-03)
 *
 * ★순수하다. DOM 도 타이머도 모른다. 화면은 game.html 이 그린다.
 *   여기가 DOM 을 알면 헤드리스에서 대사 순서를 못 검증한다.
 *
 * 화자는 셋이고 **하나는 외형이 없다.**
 *   jachwi  주인공(자취생)     초상화 있음
 *   moni    마스코트 몬이       초상화 있음 · 3D 는 char_mascot_sprout.glb (0.375m 고정)
 *   god     식물신             ★초상화 없음 — first_play.md §식물신 확정:
 *                              "대사 한 줄. 외형 없음 · 이름·모습·설정을 지금 정하지 않는다"
 *                              화면에서는 빛/실루엣으로만 처리한다. 얼굴을 만들지 말 것.
 */

export const SPEAKERS = {
  jachwi: { ko: '나',   portrait: true  },
  moni:   { ko: '몬이', portrait: true  },
  god:    { ko: '?',    portrait: false }   // ★이름도 아직 없다. 물음표 그대로 둔다
};

/* 한 대사 = { who, text, face? }
   face 는 초상화 표정 키다. 없으면 기본. 초상화가 없는 화자(god)는 무시된다. */

/* ── 첫 플레이 ─────────────────────────────────────────────────────────
   순서는 first_play.md §2 계약 그대로다 — 수확 → 식비 → 식물신 → 도착.
   ★식물신이 식비 뒤·도착 앞에 온다. 그 자리가 확정이다. */
export const SCRIPTS = {

  /* 게임을 열자마자. "무엇을 하는 게임인가"를 몬이가 한 번에 말해 준다. */
  intro: [
    { who: 'moni',   face: 'happy', text: '왔구나! 여기가 네 방이야. 좀… 어둡지?' },
    { who: 'jachwi', face: 'worry', text: '반지하니까.' },
    { who: 'moni',   text: '괜찮아. 어두운 자리도 쓸모가 있거든.' },
    { who: 'moni',   face: 'happy', text: '가방에 콩나물 시루가 있어. **어두운 데** 놓아 봐.' }
  ],

  /* 시루를 놓은 직후 — 왜 어두운 곳이어야 하는지는 여기서 말하지 않는다.
     수확 때 품질로 직접 겪는 편이 낫다. */
  cropPlaced: [
    { who: 'moni', text: '좋아. 나흘이면 먹을 수 있어.' }
  ],

  /* Day 4 · 수확 직후. 식비 결과를 **본 뒤에** 나온다(계약 순서). */
  harvest: [
    { who: 'jachwi', face: 'happy', text: '…이게 되네.' },
    { who: 'moni',   face: 'happy', text: '어두운 자리라 하얗게 잘 자랐어. 빛을 봤으면 초록이 되고 썼을 거야.' }
  ],

  /* ★식물신 — 대사 한 줄. 외형 없음.
     first_play.md 의 예시 문장을 그대로 쓴다. 새 설정을 만들지 않는다. */
  god1: [
    { who: 'god', text: '콩나물을 잘 키웠구나. 이건 좀 더 어려울 거야.' }
  ],

  /* 몬스테라 도착 — ★정답이 아닌 자리에 온다(first_play.md 확정).
     "옮겨라"라고 대놓고 말하지 않는다. 옮기는 것이 두 번째 학습이라 스스로 해야 한다. */
  monsteraArrived: [
    { who: 'jachwi', text: '몬스테라…?' },
    { who: 'moni',   text: '얘는 콩나물이랑 반대야. 어두운 데 두면 아무 일도 안 일어나.' }
  ],

  /* 창턱으로 옮긴 뒤 */
  monsteraMoved: [
    { who: 'moni', face: 'happy', text: '창턱! 여기가 이 방에서 제일 밝아.' },
    { who: 'moni', text: '바로는 안 변해. 며칠 지나야 알아.' }
  ],

  /* 어두운 자리에 둔 채 며칠 지났을 때 — 빨리감기로 날짜만 가는 그 상황이다.
     ★혼내지 않는다. 무엇을 보면 되는지만 알려 준다. */
  monsteraStalled: [
    { who: 'moni', face: 'sad', text: '며칠째 그대로야…' },
    { who: 'moni', text: '빛이 모자라면 날짜만 가고 모양은 안 변해. 더 밝은 자리를 찾아 보자.' }
  ],

  /* ★첫 플레이의 그 한 장면 — 말린 새순 */
  spearFurled: [
    { who: 'jachwi', face: 'happy', text: '뭔가… 돌돌 말린 게 올라왔어.' },
    { who: 'moni',   face: 'happy', text: '새순이야! 저게 펴지면 잎이 돼.' },
    { who: 'god',    text: '자리를 옮긴 것뿐인데 말이지.' }
  ]
};

/* ── 진행 ───────────────────────────────────────────────────────────── */

/* 한 번만 보여줄 대사는 본 것을 기억한다. 같은 말을 두 번 들으면 안내가 잔소리가 된다. */
export function createDialogue(seen = new Set()) {
  let queue = [], idx = 0;

  function push(scriptId, { once = true } = {}) {
    const lines = SCRIPTS[scriptId];
    if (!lines) throw new Error(`[대화] 없는 스크립트: ${scriptId}`);
    if (once && seen.has(scriptId)) return false;
    if (once) seen.add(scriptId);
    queue = queue.concat(lines.map(l => ({ ...l, scriptId })));
    return true;
  }
  function current() { return idx < queue.length ? queue[idx] : null; }
  function next() { if (idx < queue.length) idx++; return current(); }
  /* 건너뛰기 — 두 번째부터는 읽은 사람도 있다. 막지 않는다. */
  function skip() { idx = queue.length; return null; }
  function isOpen() { return idx < queue.length; }
  function clear() { queue = []; idx = 0; }
  function seenList() { return [...seen]; }

  return { push, current, next, skip, isOpen, clear, seenList,
           get length() { return queue.length; },
           get index() { return idx; } };
}

/* 턴 결과 → 이번에 나올 대사. ★새 이벤트 체계를 만들지 않는다 —
   loop.js 의 firstPlayEventsOf 가 이미 내는 id 를 그대로 읽는다. */
export const EVENT_SCRIPT = {
  beansprout_harvest: 'harvest',
  monstera_arrived:   'monsteraArrived',
  spear_furled:       'spearFurled'
};

/* Day 4 는 한 날에 수확·식비·도착이 겹친다. 계약 순서가 고정이라 그대로 줄 세운다:
   수확 → (식비는 화면이 숫자로 보여준다) → 식물신 → 도착. */
export function scriptsForEvents(events = []) {
  const ids = (events || []).map(e => (typeof e === 'string' ? e : e && e.id)).filter(Boolean);
  const out = [];
  if (ids.includes('beansprout_harvest')) { out.push('harvest', 'god1'); }
  if (ids.includes('monstera_arrived'))     out.push('monsteraArrived');
  if (ids.includes('spear_furled'))         out.push('spearFurled');
  return out;
}
