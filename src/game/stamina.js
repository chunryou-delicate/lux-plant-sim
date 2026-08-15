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

/* ★★ 시작 최대체력 **5** — 2026-08-09 박사님 확정으로 10 에서 내렸다.
   ------------------------------------------------------------
   옛 근거(10)는 *"완전 시차로 두 작물을 다 굴리면 하루 7번, 셋의 여유"* 였다.
   그 셈이 틀린 것은 아니지만 **전제가 바뀌었다**: 이제 물·수확·심기가 **시루마다 1**이라
   (2026-08-09 확정) 시루 5개면 거두는 데만 5가 든다. 10 은 그 판에서 여유가 아니라 상한이었다.
   ⇒ 시작을 5 로 낮추고, **쓴 만큼 오르게** 했다(§경험치). 노가다의 폭이 고정값이 아니라
     플레이어가 키우는 것이 된다.

   ⚠⚠ **숫자를 여기서 읽지 마라.** 정본은 `data/balance/stamina.json` 이고
     아래 값들은 그 파일을 못 읽었을 때의 **밑값**일 뿐이다(곡선이 아직 확정이 아니라
     후보를 재는 중이다 — 코드에 박으면 잴 때마다 코드를 고쳐야 한다).
     읽어 꽂는 창구는 `staminaRulesFrom(json)` 하나다. */
export const STAMINA_MAX = 5;

/* 동작마다 드는 값. **옮기기·돌리기는 여기 없다 — 0 이다.**
   옮기는 데 값을 매기면 자리를 바꿔 보는 것 자체에 벌이 붙어, 가르치려는 행동을 말리게 된다.
   옮기는 것은 노동이 아니라 **고민**이다(docs/stamina.md §3).
   ★★ 2026-08-09 — 박사님 원문: *"체력은 물주기 수확하기 심기 할 때 다 소모되도록 하자고."*
     그래서 **시루마다 1**이다. 예전에는 [모두 거두기] 한 번이 손 1이었는데, 그 길이 남으면
     시루를 늘릴수록 **싸지는** 셈이 되어 체력이 상한 노릇을 못 한다. */
export const ACT_COST = Object.freeze({
  water: 1,        // 물주기 — 회전을 시작하는 손
  harvest: 1,      // 수확
  sow: 1,          // 다시 심기
  cut: 1,          // 삽수 자르기
  repot: 1         // 삽수 분갈이
});

/* ══════════════════════════════════════════════════════════════════════════
   ★★★ §경험치 — **그날 쓴 체력이 곧 경험치다** (2026-08-09 박사님 확정)
   ------------------------------------------------------------
   ★ 한 줄 — **돌본 만큼 는다.** 따로 세는 축을 만들지 않았다:
     물을 주면 1을 쓰고 1이 쌓인다. 그래서 "무엇을 해야 오르나"를 배울 것이 없다.
   ★ 레벨 = **최대체력** 그 자체다. 별도의 레벨 숫자를 안 만든다 —
     두 숫자를 두면 "레벨은 7인데 체력은 5"가 되어 무엇이 오른 것인지 흐려진다.
   ★★ **안 내려간다.** 이 저장소의 「배움」과 같은 사상이다:
     *한 번 켜지면 안 꺼진다. 되돌리면 '배웠다'가 아니라 '지금 그렇게 두었다'가 된다.*
   ⚠ 곡선 숫자는 `data/balance/stamina.json` 이 갖는다. 여기 있는 것은 밑값이다.
   ══════════════════════════════════════════════════════════════════════════ */
export const STAMINA_RULES = Object.freeze({
  startMax: STAMINA_MAX,
  /* ★★ **상한이 없다** — `null` 이 그 뜻이다 (2026-08-09 박사님 확정).
     ⚠ 큰 수로 횡내 내지 않는다. `maxCap: 999` 로 두면 화면이 「최대 999」를
       보여 주거나 진행바가 이상해진다 — **없는 것과 큰 것은 다르다.** */
  maxCap: null,
  cost: ACT_COST,
  xpPerStamina: 1,
  /* `levelTable[n]` = 최대체력 n → n+1 에 드는 경험치. 표에 없으면 `n × beyondMult` */
  levelTable: Object.freeze({ 5: 10, 6: 15, 7: 20, 8: 25, 9: 30 }),
  beyondFrom: 10,
  beyondMult: 10,
  /* ══ 퀘스트가 주는 최대체력 ═══════════════════════════════════════════
     ★ 정본 표는 `src/game/quest.js` 가 갖는다(무엇을 하는 줄인가). **여기는 값만** 갖는다 —
       「무엇을 시키나」와 「얼마를 주나」를 한 곳에 두면 밸런스를 고칠 때 규칙까지 건드리게 된다.
     ★★ 2026-08-17 — 다섯 줄이 됐는데 **체력을 주는 것은 셋뿐이다**(5 → 8).
       나머지 둘은 **0 이고 그게 뜻이다**:
         `varie_bright` 보상은 **무늬 등급**이다 (산반 35만 → 풀문 115만 · varie-grade 확정문 §2)
         `sell_varie`   보상은 **이사가 열리는 것**이다 (escapecut 확정 — 탈출의 둘째 축)
       세상이 이미 크게 주는 자리에 체력을 얹으면 **진짜 보상이 가려진다.**
     ⚠ 셋이 얼마나 큰가 — 자연 레벨업으로 5→8 은 10+15+20 = **45회**(시루 5개면 약 9일)다.
       판을 뒤집는 크기가 아니다. 재서 적는다.
     ⚠ 정본은 여전히 `data/balance/stamina.json` 이다. 그 파일에 없는 id 는 **여기 값이 산다**
       (`staminaRulesFrom` 이 밑값을 먼저 펴고 파일을 덮으므로 새 id 가 안 사라진다). */
  quests: Object.freeze({
    siru5_cycle5: 1,   // 시루 다섯, 다섯 바퀴 — 「물은 한 번에 하나 · 체력이 천장」
    crop_mix:     1,   // 한 상에 두 가지 — 「섞어 먹어야 밥이 이득」
    first_cut:    1,   // 물에 꽂아 본다 — 「잎 1장까지 쪼개야 물꽂이」
    varie_bright: 0,   // ★ 보상은 무늬 등급이다
    sell_varie:   0    // ★ 보상은 이사가 열리는 것이다
  }),
  source: '(밑값)'
});

/* 정본(`data/balance/stamina.json`)을 읽어 규칙 사본을 낸다.
   ★ `firstPlayRulesFromBalance` 와 **같은 결**이다: 파일이 이기고, 없는 칸은 밑값이 채운다.
   ⚠ 던지지 않는다 — 밸런스 파일 하나 때문에 게임이 안 열리면 안 된다. 대신 어디서 왔는지
     `source` 에 적어 둔다(화면·검사가 "지금 어느 표로 도나"를 물을 수 있게). */
export function staminaRulesFrom(json) {
  const j = (json && typeof json === 'object') ? json : null;
  if (!j) return STAMINA_RULES;
  const num = (v, d) => (Number.isFinite(v) && v > 0 ? v : d);
  const lv = (j.levelUp && typeof j.levelUp === 'object') ? j.levelUp : {};
  const table = {};
  for (const [k, v] of Object.entries(lv.table || {})) {
    const n = Number(k);
    if (Number.isInteger(n) && Number.isFinite(v) && v > 0) table[n] = v;
  }
  return Object.freeze({
    startMax: Math.round(num(j.startMax, STAMINA_RULES.startMax)),
    /* ★ 상한은 **있을 수도 없을 수도** 있다. `null`·없음 = 상한 없음.
       ⚠ `num()` 을 안 쓴다 — 그건 값이 없으면 밑값을 넣는데, 여기서는
         「없다」가 그 자체로 뜻이라 살려야 한다. */
    maxCap: (Number.isFinite(j.maxCap) && j.maxCap > 0) ? Math.round(j.maxCap) : null,
    cost: Object.freeze({ ...ACT_COST, ...(j.cost && typeof j.cost === 'object' ? j.cost : {}) }),
    xpPerStamina: num(j.xpPerStamina, STAMINA_RULES.xpPerStamina),
    levelTable: Object.freeze(Object.keys(table).length ? table : { ...STAMINA_RULES.levelTable }),
    beyondFrom: Math.round(num(lv.beyondFrom, STAMINA_RULES.beyondFrom)),
    beyondMult: num(lv.beyondMult, STAMINA_RULES.beyondMult),
    quests: Object.freeze({ ...STAMINA_RULES.quests,
                            ...(j.quests && typeof j.quests === 'object' ? j.quests : {}) }),
    source: 'data/balance/stamina.json'
  });
}

/* 지금 최대체력에서 **한 칸 오르는 데 드는 경험치**.
   ★★ 2026-08-09 — 상한이 없으므로 보통은 **null 을 안 낸다.** 끝없이 오른다:
     10→11 은 100, 30→31 은 300 … (`max × beyondMult`)
   ⚠ `null` 은 **상한이 정해진 판에서만** 나온다(`rules.maxCap` 에 숫자를 넣은 때).
     화면은 그 null 을 「더 안 오름」으로 읽으면 된다 — 지금은 안 오는 길이다. */
export function xpNeededAt(max, rules = STAMINA_RULES) {
  const R = rules || STAMINA_RULES;
  if (!Number.isFinite(max)) return null;
  if (Number.isFinite(R.maxCap) && max >= R.maxCap) return null;
  const t = R.levelTable[max];
  if (Number.isFinite(t) && t > 0) return t;
  return Math.max(1, Math.round(max * R.beyondMult));
}

export function createStaminaState(maxOrRules = STAMINA_RULES) {
  /* 옛 호출부는 숫자를 넘긴다(`createStaminaState(10)`) — 그대로 받는다 */
  const rules = (typeof maxOrRules === 'number')
    ? { ...STAMINA_RULES, startMax: maxOrRules } : (maxOrRules || STAMINA_RULES);
  const max = Math.max(1, Math.round(rules.startMax || STAMINA_MAX));
  return {
    schema: STAMINA_SCHEMA, max, left: max, day: 0, spentToday: 0,
    /* ★ 경험치 — 그날 쓴 체력이 그대로 쌓인다(§경험치). 레벨업 때 need 만큼 빠진다 */
    xp: 0,
    /* 지금까지 쓴 손의 총량. 판정에는 안 쓴다 — 재현·화면이 "얼마나 돌봤나"를 말할 근거다 */
    totalSpent: 0,
    /* 퀘스트로 받은 몫 — 같은 퀘스트를 두 번 못 받게 하는 기억이다 */
    questsTaken: [],
    /* ★ 아직 화면이 안 보여 준 레벨업. **화면이 비운다**(§레벨업은 보여야 한다).
       ⚠ 세이브에 안 싣는다 — 「보여 줄 것이 남았나」는 판의 사실이 아니라 화면의 사정이다. */
    levelUps: [],
    rules
  };
}

/* 옛 세이브·옛 판에도 칸이 있게 한다. **없으면 만들어 준다** —
   던지면 세이브 하나 때문에 게임이 안 열린다(save.js 의 사상과 같다).
   ★★ 2026-08-09 — 칸이 늘었다(`xp`·`totalSpent`·`questsTaken`·`levelUps`·`rules`).
     **옛 판에는 그 칸이 없다.** 여기서 하나씩 채워 준다 — 통째로 갈아 끼우면
     그 판이 쌓아 둔 `max`(레벨)가 시작값으로 되돌아간다. 레벨은 안 내려간다(§경험치). */
export function staminaOf(S, rules = null) {
  if (!S) return null;
  if (!S.stamina || S.stamina.schema !== STAMINA_SCHEMA) S.stamina = createStaminaState(rules || STAMINA_RULES);
  const st = S.stamina;
  if (!st.rules) st.rules = rules || STAMINA_RULES;
  if (!Number.isFinite(st.xp)) st.xp = 0;
  if (!Number.isFinite(st.totalSpent)) st.totalSpent = 0;
  if (!Array.isArray(st.questsTaken)) st.questsTaken = [];
  if (!Array.isArray(st.levelUps)) st.levelUps = [];
  if (!Number.isFinite(st.max)) st.max = st.rules.startMax || STAMINA_MAX;
  return st;
}
/* 규칙을 지금 판에 꽂는다 — 불러오기·새 판이 한 번씩 부른다. **레벨(max)은 안 건드린다.** */
export function applyStaminaRules(S, rules) {
  const st = staminaOf(S, rules);
  if (st && rules) st.rules = rules;
  return st;
}
export const rulesOf = (S) => (staminaOf(S) || {}).rules || STAMINA_RULES;

/* 그 동작이 몇을 쓰나. 모르는 이름은 **0** 이다 —
   던지면 새 동작을 붙일 때마다 게임이 멈춘다. 안 세는 것이 안 도는 것보다 낫다. */
export function costOf(kind, rules = STAMINA_RULES) {
  const c = (rules && rules.cost) || ACT_COST;
  return c[kind] || 0;
}

/* 지금 그걸 할 수 있나. `{ok, left, cost, reason}` 을 낸다 — **던지지 않는다**(안내지 고장이 아니다)
   ★ `reason` 은 **왜 못 하는지**를 말한다. 조용히 안 되는 것이 이 저장소가 제일 싫어하는 모양이다
     (박사님이 물주기가 조용히 안 되던 것을 잡느라 며칠을 태우셨다). */
export function canAct(S, kind) {
  const st = staminaOf(S);
  const cost = costOf(kind, rulesOf(S));
  if (!st) return { ok: true, left: null, cost, reason: null };
  if (cost <= 0) return { ok: true, left: st.left, cost, reason: null };
  if (st.left >= cost) return { ok: true, left: st.left, cost, reason: null };
  return { ok: false, left: st.left, cost, max: st.max,
           reason: `오늘 손이 다 떨어졌습니다 (0/${st.max}) — ` +
                   `[다음 날]을 누르면 ${st.max}만큼 다시 채워집니다` };
}

/* 실제로 쓴다. **부족하면 안 쓰고 false 를 낸다** — 음수로 안 내려간다.
   ⚠ 부르는 쪽은 이 반환을 반드시 봐야 한다. 안 보면 체력이 안 줄어든 채로 동작만 돈다.
   ★★ 2026-08-09 — 쓴 만큼 **경험치가 쌓이고**, 차면 그 자리에서 최대체력이 오른다(§경험치).
     ⚠ 반환값은 **여전히 boolean 이다.** 옛 호출부(loop·state)가 그대로 돌아야 한다 —
       오른 사실은 `st.levelUps` 에 쌓아 두고 화면이 비운다. */
export function spend(S, kind) {
  const st = staminaOf(S);
  const R = rulesOf(S);
  const cost = costOf(kind, R);
  if (!st || cost <= 0) return true;
  if (st.left < cost) return false;
  st.left -= cost;
  st.spentToday += cost;
  st.totalSpent += cost;
  gainXp(S, cost * (R.xpPerStamina || 1));
  return true;
}

/* 경험치를 넣고 찰 때마다 한 칸씩 올린다. **여러 칸이 한 번에 오를 수 있다**(퀘스트·보정).
   ★ 오른 것은 `levelUps` 에 쌓는다 — 조용히 오르면 보상이 아니다(박사님). */
export function gainXp(S, amount) {
  const st = staminaOf(S);
  if (!st || !(amount > 0)) return st;
  const R = rulesOf(S);
  st.xp += amount;
  let guard = 0;
  for (;;) {
    const need = xpNeededAt(st.max, R);
    if (need == null || st.xp < need) break;
    if (++guard > 100) break;                 // 표가 이상해도 무한루프로 안 간다
    st.xp -= need;
    st.max += 1;
    /* ★ 오른 그날은 **남은 손도 같이 는다.** 안 그러면 "올랐는데 오늘은 못 쓴다"가 되어
       보상이 하루 뒤로 밀린다 — 누른 그 자리에서 값이 보여야 보상이다. */
    st.left += 1;
    st.levelUps.push({ max: st.max, day: st.day });
  }
  return st;
}

/* 퀘스트로 최대체력을 올린다. **같은 퀘스트는 한 번만** 받는다.
   ⚠ 아직 부르는 데가 없다 — 무엇을 「완주」로 볼지는 분배 계통이 정한다(siru-to-plan §16).
     창구만 열어 두는 이유: 판정이 붙을 때 규칙이 두 벌 생기지 않게 하려는 것이다. */
export function grantStaminaQuest(S, questId) {
  const st = staminaOf(S);
  if (!st) return null;
  if (st.questsTaken.includes(questId)) return { granted: 0, already: true, max: st.max };
  const R = rulesOf(S);
  const n = Math.max(0, Math.round((R.quests || {})[questId] || 0));
  st.questsTaken.push(questId);
  if (n <= 0) return { granted: 0, already: false, max: st.max };
  /* ★ 상한이 없으면(null) 그냥 올린다 — 있을 때만 거기서 멈춘다 */
  const capped = () => Number.isFinite(R.maxCap) && st.max >= R.maxCap;
  for (let i = 0; i < n && !capped(); i++) {
    st.max += 1; st.left += 1;
    st.levelUps.push({ max: st.max, day: st.day, quest: questId });
  }
  return { granted: n, already: false, max: st.max };
}

/* 화면이 아직 안 보여 준 레벨업을 **가져가며 비운다**. 두 번 보여 주지 않는다. */
export function takeLevelUps(S) {
  const st = staminaOf(S);
  if (!st || !st.levelUps.length) return [];
  const out = st.levelUps.slice();
  st.levelUps.length = 0;
  return out;
}

/* 하루가 갔다 — **가득 찬다.** 이월도 누적도 없다(docs/stamina.md §4).
   쌓이게 두면 "며칠 참았다가 한꺼번에"가 최적해가 되어 하루의 리듬이 통째로 사라진다.
   ⚠ 경험치는 **안 비운다.** 그건 하루치가 아니라 쌓이는 것이다. */
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
  const need = xpNeededAt(st.max, rulesOf(S));
  return { left: st.left, max: st.max, spentToday: st.spentToday,
           empty: st.left <= 0, ratio: st.max > 0 ? st.left / st.max : 0,
           /* ★ 다음 칸까지 — 화면이 "조금만 더"를 그릴 근거다. 천장이면 need 가 null 이다 */
           xp: st.xp, xpNeed: need, atCap: need == null,
           xp01: need ? Math.max(0, Math.min(1, st.xp / need)) : 1,
           totalSpent: st.totalSpent };
}
