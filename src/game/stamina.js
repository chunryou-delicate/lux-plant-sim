/* ══════════════════════════════════════════════════════════════════════════
   체력 — 하루에 돌볼 수 있는 양 (2026-08-05 박사님 확정)

   ★ 정본 문서는 `docs/stamina.md` 다. 여기는 그 규칙을 코드로 옮긴 것뿐이고,
     **왜 그런지는 문서에 있다.** 숫자를 바꾸려면 문서부터 고쳐라.

   ★★ 이 계통이 있는 이유 한 줄 —
     「잉여 채소를 판다」가 들어오면 시루를 늘릴 이유가 **무한**해진다.
     그전에는 끼니 상한(하루 5,000원) 위가 버려져서 저절로 멈췄는데, 팔 수 있으면 안 멈춘다.
     시루 50개를 깔고 빨리감기만 누르는 판이 되고 그건 노가다가 아니라 **방치**다.
     ⇒ 체력이 그 상한이다. 그리고 그 상한이 곧 박사님이 원하신 노가다다 —
       늘리면 벌이는 늘지만 **하루에 다 못 돌본다.**

   ★★ 자리와 **안 엮는다** (박사님 확정).
     먼 자리라고 더 들지 않는다. 이 게임이 가르치는 한 가지가 「자리가 결과를 바꾼다」인데,
     자리에 체력까지 걸면 축이 둘로 겹쳐 **둘 다 흐려진다.** 자리는 빛으로만 말한다.
   ══════════════════════════════════════════════════════════════════════════ */

export const STAMINA_SCHEMA = 'stamina/1';

/* ★★ 최대치 10 — **지어낸 값이 아니라 주기에서 나온 값이다.**
   완전 시차(거두는 날을 하루씩 어긋나게 두는 것 · first_play §겹침)로 두 작물을 다 굴리면
   하루에 드는 손이 **7번**이다:
     콩나물 5일 주기 → 시루 5개 → 물1 + 수확1 + 심기1 = 3
     무순   7일 주기 → 판 7개  → 물1 + 수확1 + 심기1 = 3
     몬스테라                  → 물1              = 1
   딱 7 로 두면 실수 한 번이 그날을 망친다 — 그건 상한이 아니라 벌이다.
   10 이면 세 번의 여유가 있고, **그 여유가 곧 노가다의 폭**이다(시루 15개 = 하루 9번).
   ⚠ 원룸 이후에는 이 값이 안 맞는다. 방이 커지고 화분이 늘면 다시 잰다(docs/stamina.md §6). */
export const STAMINA_MAX = 10;

/* 동작마다 드는 값. **옮기기·돌리기는 여기 없다 — 0 이다.**
   옮기는 데 값을 매기면 자리를 바꿔 보는 것 자체에 벌이 붙어, 가르치려는 행동을 말리게 된다.
   옮기는 것은 노동이 아니라 **고민**이다(docs/stamina.md §3). */
export const ACT_COST = Object.freeze({
  water: 1,        // 물주기 — 회전을 시작하는 손
  harvest: 1,      // 수확
  sow: 1,          // 다시 심기
  cut: 1,          // 삽수 자르기
  repot: 1         // 삽수 분갈이
});

export function createStaminaState(max = STAMINA_MAX) {
  return { schema: STAMINA_SCHEMA, max, left: max, day: 0, spentToday: 0 };
}

/* 옛 세이브·옛 판에도 칸이 있게 한다. **없으면 만들어 준다** —
   던지면 세이브 하나 때문에 게임이 안 열린다(save.js 의 사상과 같다). */
export function staminaOf(S) {
  if (!S) return null;
  if (!S.stamina || S.stamina.schema !== STAMINA_SCHEMA) S.stamina = createStaminaState();
  return S.stamina;
}

/* 그 동작이 몇을 쓰나. 모르는 이름은 **0** 이다 —
   던지면 새 동작을 붙일 때마다 게임이 멈춘다. 안 세는 것이 안 도는 것보다 낫다. */
export const costOf = (kind) => ACT_COST[kind] || 0;

/* 지금 그걸 할 수 있나. `{ok, left, cost, reason}` 을 낸다 — **던지지 않는다**(안내지 고장이 아니다) */
export function canAct(S, kind) {
  const st = staminaOf(S);
  const cost = costOf(kind);
  if (!st) return { ok: true, left: null, cost, reason: null };
  if (cost <= 0) return { ok: true, left: st.left, cost, reason: null };
  if (st.left >= cost) return { ok: true, left: st.left, cost, reason: null };
  return { ok: false, left: st.left, cost,
           reason: '오늘은 여기까지입니다 — 다음 날로 넘기면 다시 움직일 수 있습니다' };
}

/* 실제로 쓴다. **부족하면 안 쓰고 false 를 낸다** — 음수로 안 내려간다.
   ⚠ 부르는 쪽은 이 반환을 반드시 봐야 한다. 안 보면 체력이 안 줄어든 채로 동작만 돈다. */
export function spend(S, kind) {
  const st = staminaOf(S);
  const cost = costOf(kind);
  if (!st || cost <= 0) return true;
  if (st.left < cost) return false;
  st.left -= cost;
  st.spentToday += cost;
  return true;
}

/* 하루가 갔다 — **가득 찬다.** 이월도 누적도 없다(docs/stamina.md §4).
   쌓이게 두면 "며칠 참았다가 한꺼번에"가 최적해가 되어 하루의 리듬이 통째로 사라진다. */
export function resetDay(S, day) {
  const st = staminaOf(S);
  if (!st) return null;
  st.left = st.max;
  st.spentToday = 0;
  if (Number.isFinite(day)) st.day = day;
  return st;
}

/* 화면이 읽는 값. 여기서 문구를 만들지 않는다 — 화면이 제 말로 적는다 */
export function staminaView(S) {
  const st = staminaOf(S);
  if (!st) return null;
  return { left: st.left, max: st.max, spentToday: st.spentToday,
           empty: st.left <= 0, ratio: st.max > 0 ? st.left / st.max : 0 };
}
