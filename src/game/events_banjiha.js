/* ============================================================
   src/game/events_banjiha.js — **반지하 «사건» 첫 묶음**(2026-10-31 총괄 D96 · plan 9f1282e7 docs/handoff/plan-events-banjiha-d96.md §2 · §3)
   ------------------------------------------------------------
   박사님(10-31 20시쯤): *"재밌게 반지하에서는 이벤트를 좀 넣어도 될 것 같아. 너무 삭막할 것 같기도 해."*

   ★ 순수 모듈이다 — 화면 · 생장 창(io)을 모른다. 아침 차례(loop §nextDay 끝)가 `stepBanjihaEvents(S, turn)` 를 불러
     오늘 사건 카드 하나(있으면)와 예약된 뒷일(김치 · 반찬 택배)을 `turn.events` 에 싣는다. 하네스도 같은 길을 탄다.
     고르기는 화면(사건 카드의 단추) · 하네스(첫 단추가 기본)가 `applyBjChoice(S, key, k)` 로 한다.
   ★ 결정적 — `u01(S.sim.seed ^ SALT, day, k)`(job_shop · job_care 와 같은 꼴). 같은 씨앗 · 같은 손 → 같은 날 같은 사건.
   ★ 글은 여기 없다 — 카드 글 · 뒤 대사 · 뒷일 배너는 plan 몫(dialogue.js EVENT_CARDS · SCRIPTS.ev_*). 여기는 id · 갈래에 쓸 맥락(ctx)만 낸다.

   첫 묶음(총괄 D96 · E5 정전은 «그날 등 수» 읽는 자리가 한 함수로 안 모여 둘째 묶음 · 대신 E8):
     key        plan    단추  조건(그날)                                  고른 뒤
     cat1       E1      2     열린 뒤 아무 날                              a 내민다 → cat2 가 8~14일 뒤 · b(또는 안 고름) → 15~25일 뒤
     cat2       E1 둘째 2     자기 시계(cat.due)                           같은 꼴로 cat3
     cat3       E1 셋째 1     자기 시계                                    —
     parcel     E3      2     Day ≤ 65                                    a 올려다 드림(체력 1) → 이튿날 아침 김치(밥 한 몫 아낌) · b 쪽지
     truck      E2      2     창턱에 그루나 시루가 있다                     a 빛 지도를 켠다(화면 손) · b 그냥
     grandma    E4      1     73 ≤ Day ≤ 120 · 콩나물 시루가 놓여 있다      —(ctx.pale: 놓인 콩나물 시루 가운데 «하얗고 아삭»이 아닌 빛이 있나)
     kids1      E9      2     창턱에 그루나 시루가 있다                     a 손을 흔든다 → kids2 가 10~20일 뒤 · b 모른 척
     kids2      E9 둘째 1     자기 시계(흔든 판만)                          —
     chuseok    E8      2     55 ≤ Day ≤ 80                               a 받는다 → 이틀 뒤 · 사흘 뒤 아침 밥 한 몫씩 아낌 · b 괜찮다

   ★ 언제부터(plan §2 ㉠) — 할 일 siru16 이 끝난 다음 아침. 못 닿은 판도 첫 플레이가 끝나고 몬스테라가 왔으면 Day 35 에 연다.
     ⛔ 튜토 사슬(첫 수확 → 몬스테라 자리 → siru16) 동안은 안 뜬다 · 원룸(이사 뒤)엔 아예 안 뜬다.
   ★ 간격 — 카드 사이 6~10일(씨앗). 사건마다 한 판에 한 번(고양이 셋 · 아이들 둘은 제 시계). 조건 맞는 것 가운데 아직 안 본 것을 씨앗으로.
   ★ 막는 날 — 그날 아침 사건 대사 · 월세 · 굶음 · 이사가 섰으면 안 뜬다(다음 날로 밀림 · 큰 차례는 사흘 내리 막히면 건너뜀 · 되풀이 시계는 다음 빈 날).
   ★ 값 — 체력 1(택배) · 밥 한 몫(2,500원 · tutorial rules.mealCostWon — 밥상 «한 몫 아낌»과 같은 값) × 1(김치) / × 2(반찬 택배). 그 밖은 0.
   ⚠ 몬이는 수를 말하지 않는다 — 수는 배너(뒷일 won)가 말한다.
============================================================ */
import { u01 } from '../growth/species_growth.js';
import { cropPotList, cropQualityOf } from './first_play.js';
import { canAct as canActStamina, spend as spendStamina } from './stamina.js';
import { EVENT_SCRIPT } from './dialogue.js';   /* 그날 «대사가 서는» 사건(막는 날 가르기) — 대사 표가 정본 */

const SALT = 0xb5e7;
const MIN_GAP = 4;   /* 카드와 카드 사이 적어도 이만큼(되풀이 · 큰 차례 모두) */
/* ?ev=0 · 하네스 --ev=0 — 사건을 통째로 끈다(growth 가 «끔 대 켬»을 잰다). 모듈 한 벌 · 프로세스마다 */
let EV_ON = true;
export function setBanjihaEventsOn(on) { EV_ON = !!on; }
export function banjihaEventsOn() { return EV_ON; }

/* 큰 차례로 뽑는 사건(되풀이 둘째 · 셋째는 제 시계 — 아래 §stepBanjihaEvents) */
export const BJ_EVENTS = Object.freeze([
  Object.freeze({ key: 'cat1',    plan: 'E1', choices: 2, when: c => true }),
  Object.freeze({ key: 'parcel',  plan: 'E3', choices: 2, until: 65, when: c => c.day <= 65 }),
  Object.freeze({ key: 'truck',   plan: 'E2', choices: 2, when: c => c.onSill }),
  Object.freeze({ key: 'grandma', plan: 'E4', choices: 1, until: 120, when: c => c.day >= 73 && c.day <= 120 && c.hasBeansprout }),
  Object.freeze({ key: 'kids1',   plan: 'E9', choices: 2, when: c => c.onSill }),
  Object.freeze({ key: 'chuseok', plan: 'E8', choices: 2, until: 80, when: c => c.day >= 55 && c.day <= 80 })
]);
const REPEAT = Object.freeze({ cat2: 2, cat3: 1, kids2: 1 });   /* 되풀이 카드의 단추 수 */
export const BJ_KEYS = Object.freeze([...BJ_EVENTS.map(e => e.key), ...Object.keys(REPEAT)]);
export function bjChoicesOf(key) {
  const e = BJ_EVENTS.find(x => x.key === key);
  return e ? e.choices : (REPEAT[key] || 0);
}
/* 체력을 쓰는 단추 — 화면이 체력 0 이면 흐리게(첫 단추) · 하네스는 둘째로 */
export const BJ_STAMINA_CHOICE = Object.freeze({ parcel: 0 });

/* 그날 사건 대사 · 월세 · 굶음 · 이사가 선 날은 카드를 미룬다(plan §2 «카드가 안 뜨는 날»).
   ★ «대사가 서는 사건»은 대사 표(dialogue §EVENT_SCRIPT)가 정본이다 — 거기 있는 id 가 하나라도 오늘 섰으면 막는다.
     ⛔ 첫 판은 «첫 플레이 사건이 하나라도 있으면» 막았다 — 그런데 beansprout_ready(익음 · 대사 없음)가 날마다 서서 카드가 한 번도 안 떴다(core 하네스 잼 · humanQ Day 36~70 전부 막힘).
   더해 대사 표 밖이어도 막는 날: 월세 날 · 굶어 쓰러짐 · 바닥남 · 구호금 · 이사 · 철 바뀜 · 등 열림 · 가구점 · 튜토 끝 장면 */
const BLOCK_IDS = new Set(['rent', 'starved', 'broke', 'relief', 'moved_out', 'season', 'lamp_unlocked', 'furniture_shop_open', 'done', 'ready', 'money']);
export function bjBlockedBy(turn) {
  if (!turn) return false;
  const talk = id => !!(id && (BLOCK_IDS.has(id) || Object.prototype.hasOwnProperty.call(EVENT_SCRIPT, id)));
  const t = turn.tutorial;
  if (t && Array.isArray(t.storyEvents) && t.storyEvents.some(e => e && talk(e.id))) return true;
  return (turn.events || []).some(e => e && talk(e.id));
}

/* 저장 칸 — S.tutorial.bjEvents · 옛 세이브는 없다 → 처음 부를 때 만든다(열린 날 · 다음 날은 그때 정한다) */
export function createBjEvents() {
  return { open: null, next: null, last: null, streak: 0, seen: {}, choice: {}, card: null, cat: { due: null }, kids: { due: null }, pending: [] };
}
/* 세이브 왕복(save.js packTutorial) — 모르는 칸 · 잘못된 값은 버린다(지어내지 않는다) · 없으면 null */
export function bjEventsSnapshot(x) {
  if (!x || typeof x !== 'object') return null;
  const int = v => (Number.isInteger(v) ? v : null);
  const keyOk = k => BJ_KEYS.includes(k);
  const seen = {}, choice = {};
  for (const [k, d] of Object.entries(x.seen || {})) if (keyOk(k) && Number.isInteger(d)) seen[k] = d;
  for (const [k, c] of Object.entries(x.choice || {})) if (keyOk(k) && (c === 0 || c === 1)) choice[k] = c;
  const card = x.card && keyOk(x.card.key) && Number.isInteger(x.card.day) ? { key: x.card.key, day: x.card.day } : null;
  const pending = (Array.isArray(x.pending) ? x.pending : [])
    .filter(p => p && (p.key === 'kimchi' || p.key === 'side_dish') && Number.isInteger(p.day) && Number.isFinite(p.won))
    .map(p => ({ key: p.key, day: p.day, won: Math.round(p.won) })).slice(0, 8);
  return { open: int(x.open), next: int(x.next), last: int(x.last), streak: int(x.streak) || 0, seen, choice, card,
           cat: { due: int(x.cat && x.cat.due) }, kids: { due: int(x.kids && x.kids.due) }, pending };
}
function bjOf(S) {
  const ts = S && S.tutorial;
  if (!ts) return null;
  if (!ts.bjEvents || typeof ts.bjEvents !== 'object') ts.bjEvents = createBjEvents();
  return ts.bjEvents;
}
const gapOf = (S, day, k, lo, hi) => lo + Math.floor(u01(((S.sim && S.sim.seed) >>> 0) ^ SALT, day, k) * (hi - lo + 1));

/* 그날 맥락 — 조건 · 갈래(plan 대사)에 쓴다. 못 세면 거짓(안 뜸 쪽) */
export function bjContextOf(S) {
  const day = S.day;
  const isSill = o => !!o && (/sill/i.test(String(o.slotId || '')) || /sill/i.test(String((o.at && o.at.onUid) || '')));
  let rows = [];
  try { rows = (S.firstPlay ? cropPotList(S.firstPlay, day) : []) || []; } catch { rows = []; }
  const placedRows = rows.filter(r => r && r.placed);
  const onSill = (S.pots || []).some(p => p && (p.slotId || p.at) && isSill(p)) || placedRows.some(isSill);
  const bean = placedRows.filter(r => (r.kind || 'beansprout') === 'beansprout');
  let pale = false;
  try { pale = bean.some(r => Number.isFinite(r.dliSoFar) && ((cropQualityOf('beansprout', r.dliSoFar) || {}).meals || 3) < 3); } catch { pale = false; }
  const sillCrop = placedRows.some(isSill), sillPot = (S.pots || []).some(p => p && isSill(p));
  return { day, onSill, sillCrop, sillPot, hasBeansprout: bean.length > 0, pale,
           staminaLeft: S.stamina ? S.stamina.left : null };
}

/* 열린 판인가 — siru16 이 끝났거나(그 다음 아침) · 첫 플레이가 끝나고 몬스테라가 온 판은 Day 35 */
function shouldOpen(S) {
  const taken = (S.stamina && Array.isArray(S.stamina.questsTaken)) ? S.stamina.questsTaken : [];
  if (taken.includes('siru16')) return true;
  const fp = S.firstPlay;
  return S.day >= 35 && !!(fp && (fp.completed || !fp.enabled) && fp.monstera && fp.monstera.arrived);
}

/* ★ 아침 한 번 — 뒷일(김치 · 반찬)을 치르고, 오늘 카드 하나를 고른다. turn.events 에 싣고 그 사건들을 돌려준다.
   opt.ctx — 검사용 맥락 덮어쓰기 */
export function stepBanjihaEvents(S, turn, opt = {}) {
  const out = [];
  const ts = S && S.tutorial;
  if (!EV_ON || !ts || !ts.enabled || ts.movedOut || ts.homeOwned) return out;
  const B = bjOf(S); if (!B) return out;
  const day = S.day;
  /* ① 예약된 뒷일 — 그날 아침에 치른다(막는 날이어도 치른다 · 배너만) */
  const due = B.pending.filter(p => p.day <= day);
  if (due.length) {
    B.pending = B.pending.filter(p => p.day > day);
    for (const p of due) {
      ts.cashWon = Math.round((ts.cashWon || 0) + p.won);
      out.push({ id: 'bj_followup', key: p.key, won: p.won, day });
    }
  }
  /* ② 어제 안 고른 카드는 «안 고름»으로 닫는다(되풀이 시계는 이미 b 쪽으로 걸어 둠) */
  if (B.card && B.card.day < day) B.card = null;
  /* ③ 열기 */
  if (B.open == null) {
    if (shouldOpen(S)) { B.open = day; B.next = day + gapOf(S, day, 1, 1, 3); }
  }
  if (B.open == null || day < B.open) return finish(turn, out);
  const blocked = bjBlockedBy(turn);
  const c = { ...bjContextOf(S), ...(opt.ctx || {}) };
  let card = null;
  /* ★ 카드끼리 적어도 나흘(MIN_GAP) — 되풀이 시계가 큰 차례 바로 다음 날에 붙던 것(core 하네스 잼 · 62 · 63 / 73 · 74). 쉬는 동안 되풀이는 기다리고 큰 차례는 미뤄진다 */
  const cooled = !Number.isInteger(B.last) || day - B.last >= MIN_GAP;
  /* ④ 되풀이 — 제 시계(막히면 다음 빈 날) */
  if (!B.card && cooled) {
    const catKey = !B.seen.cat2 ? 'cat2' : (!B.seen.cat3 ? 'cat3' : null);
    if (catKey && B.seen.cat1 != null && Number.isInteger(B.cat.due) && day >= B.cat.due && !blocked) card = catKey;
    else if (!B.seen.kids2 && B.seen.kids1 != null && Number.isInteger(B.kids.due) && day >= B.kids.due && !blocked) card = 'kids2';
  }
  /* ⑤ 큰 차례 — 다음 날이 왔고 안 막혔으면 조건 맞고 안 본 것 가운데 씨앗으로 */
  if (!card && !B.card && cooled && Number.isInteger(B.next) && day >= B.next) {
    if (blocked) {
      B.streak = (B.streak || 0) + 1;
      if (B.streak >= 3) { B.streak = 0; B.next = day + gapOf(S, day, 2, 6, 10); }
    } else {
      B.streak = 0;
      const all = BJ_EVENTS.filter(e => B.seen[e.key] == null && e.when(c));
      /* 끝나는 날(until)이 열흘 안인 것을 먼저 — 창이 좁은 사건(택배 ≤ 65 · 추석 55~80)이 씨앗 운으로 지나가 버리던 것(core 하네스 잼 · g 판 택배 · 2 판 추석 0) */
      const soon = all.filter(e => Number.isInteger(e.until) && e.until - day <= 10);
      const cands = soon.length ? soon : all;
      if (cands.length) {
        card = cands[Math.floor(u01(((S.sim && S.sim.seed) >>> 0) ^ SALT, day, 3) * cands.length) % cands.length].key;
        B.next = day + gapOf(S, day, 4, 6, 10);
      }
    }
  }
  if (card) {
    B.seen[card] = day;
    B.last = day;
    B.card = { key: card, day };
    /* 안 고른 판의 되풀이 시계(고르면 §applyBjChoice 가 바꾼다) */
    if (card === 'cat1' || card === 'cat2') B.cat.due = day + gapOf(S, day, 5, 15, 25);
    const choices = bjChoicesOf(card);
    out.push({ id: 'bj_event', key: card, choices, day,
               /* 갈래 맥락(plan 대사 · 카드 글) */
               onSill: c.onSill, sillCrop: c.sillCrop, sillPot: c.sillPot, pale: c.pale,
               staminaShort: (BJ_STAMINA_CHOICE[card] != null) && Number.isFinite(c.staminaLeft) ? c.staminaLeft < 1 : false });
  }
  return finish(turn, out);
}
function finish(turn, out) {
  if (turn && out.length) turn.events = [...(turn.events || []), ...out];
  return out;
}

/* ★ 고른다 — k = 0(첫 단추 · a) | 1(둘째 · b). 화면 · 하네스가 같은 손을 쓴다.
   돌려줌 { ok, key, choice, events:[{ id:'ev_<key>_<a|b>' 또는 'ev_<key>', … }], err }
   ⚠ 그날 뜬 그 카드에만(B.card) · 두 번 못 고른다 */
export function applyBjChoice(S, key, k = 0) {
  const ts = S && S.tutorial;
  const B = ts && ts.bjEvents;
  if (!B || !B.card || B.card.key !== key) return { ok: false, key, err: '그 사건 카드가 지금 없습니다' };
  const n = bjChoicesOf(key);
  const choice = n >= 2 ? (k === 1 ? 1 : 0) : 0;
  const day = S.day;
  if (BJ_STAMINA_CHOICE[key] === choice) {
    const st = canActStamina(S, 'carry');
    if (!st.ok) return { ok: false, key, choice, err: '체력이 없습니다', stamina: true };
    spendStamina(S, 'carry');
  }
  B.choice[key] = choice;
  B.card = null;
  const meal = Math.round((ts.rules && ts.rules.mealCostWon) || 0);
  if (key === 'parcel' && choice === 0 && meal > 0) B.pending.push({ key: 'kimchi', day: day + 1, won: meal });
  if (key === 'chuseok' && choice === 0 && meal > 0) { B.pending.push({ key: 'side_dish', day: day + 2, won: meal }); B.pending.push({ key: 'side_dish', day: day + 3, won: meal }); }
  if ((key === 'cat1' || key === 'cat2') && choice === 0) B.cat.due = day + gapOf(S, day, 6, 8, 14);
  if (key === 'kids1' && choice === 0) B.kids.due = day + gapOf(S, day, 7, 10, 20);
  const id = n >= 2 ? `ev_${key}_${choice === 0 ? 'a' : 'b'}` : `ev_${key}`;
  return { ok: true, key, choice, events: [{ id, key, choice, day }] };
}
