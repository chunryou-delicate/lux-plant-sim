/* ══════════════════════════════════════════════════════════════════════════
   tools/probe_questorder.mjs — **긴 줄이 짧은 줄을 막는가**를 잰다 (2026-08-17 신설)

     node tools/probe_questorder.mjs

   ★★★ 왜 따로 있나 — **다른 자들이 재지 않는 것을 잰다.**
     `test_quest` 는 「판정이 맞나」를, `probe_questchain` 은 「사슬이 도는가」를 잰다.
     둘 다 **걸음**으로 재고 날짜를 안 본다(그 파일들이 머리말에 그렇게 적어 두었다).
     그런데 박사님이 잡으신 것은 판정도 사슬도 아니고 **날짜**다:

       *"잎 두 장·잎 세 장은 **엄청 오래 걸리니까** 「한 상에 두 가지」 등 퀘가 앞에
         배치돼야 될 듯?"*

     ⇒ 그래서 이 자가 재는 것은 하나다:
       ★ **「지금 할 일」이 「그냥 기다려라」인 날이 며칠이나 이어지나.**

   ══ ⚠⚠ 무엇을 켜고 무엇을 껐나 (START-HERE §2 첫째 규칙) ═══════════════════
     켠 것 ⓐ **퀘스트 표 전부** — `src/game/quest.js` 의 실물이다. 판정도 순서도 진짜다
     켠 것 ⓑ **콩나물 회전 주기** — `data/balance/characters.json` 에서 읽는다(안 박는다)
     켠 것 ⓒ **몬스테라 도착 문턱** — `first_play.MONSTERA_ARRIVAL_RULE` 에서 읽는다

     끈 것 ⓐ ★★ **생장 엔진.** 잎이 달력 며칠에 나는지는 이 자가 **모른다.**
            그래서 지어내지 않고 **파라미터로 받아 훑는다**(아래 §잎이 나는 날).
            ⇒ 이 자가 내는 답은 「몇 일이다」가 아니라 **「잎이 언제 나든 이렇게 된다」**다.
     끈 것 ⓑ **첫 플레이 종료 시점** — 위와 같은 까닭으로 파라미터다.
            ⚠ 다만 **잎 2장보다 앞이라는 것**은 근거가 있다(아래 §첫 플레이가 먼저 끝난다).
     끈 것 ⓒ **삽수·식물등·무늬** — 그 계통을 안 켠다. 이 일의 관심 구간(첫 플레이 ~ 잎 3장)
            보다 뒤에 있고, 켜면 「무엇 때문에 안 비었나」가 섞인다.
     끈 것 ⓓ **체력·지갑** — 손이 모자라 못 하는 것은 안 잰다(그건 `test_stamina` 것이다).
            이 판의 플레이어는 **퀘스트가 시키는 대로 하루에 한 걸음씩** 한다.

   ══ §첫 플레이가 먼저 끝난다 — 이 자가 서는 근거 ═══════════════════════════
     첫 플레이의 끝 판정은 `spear_furled` **한 단계**다(`first_play.FIRST_PLAY_COMPLETE_PHASE_ID`).
     그 단계가 서는 유효 생장일은 **14 · 61 · 146 · 249** 이고
     (`docs/handoff/growth-to-core.md §단계 경계` — growth 소유의 표다),
     몬스테라는 **유효 45일 · 잎 1장**에 온다(START-HERE §6 확정값).
     ⇒ 도착 뒤 처음 만나는 문턱이 **61**, 그 주기의 잎이 서는 것은 **78**(`leaf_young`)이다.
     ⇒ **첫 플레이 끝(61) < 잎 2장(78).** 그래서 「`crop_mix` 를 잎 줄 앞에 둔다」가
       원리적으로 가능하다 — 박사님이 되물으신 그 물음의 답이 이것이다.
     ⚠ 이 셋은 **읽어 온 값**이지 이 자가 잰 값이 아니다. 그래서 아래 훑기에서도
       「첫 플레이 끝」을 잎 2장보다 앞에 두되 **자리를 여러 번 바꿔** 확인한다.

   ══ §잎이 나는 날 — 파라미터로 훑는다 ══════════════════════════════════════
     잎 2장·3장이 달력 며칠인지는 **자리의 밝기와 등에 달렸다.** 반지하 창턱과 등 켠 판이
     몇 배씩 차이 난다(`probe_questvoice` 는 등 둘을 켜고 달력 76일에 잎 셋을 봤다).
     ⇒ 한 값을 골라 적으면 그 값이 곧 낡는다. **여러 값으로 훑고 표로 낸다.**
   ══════════════════════════════════════════════════════════════════════════ */
import { readFileSync } from 'node:fs';
import { firstPlayRulesFromBalance, MONSTERA_ARRIVAL_RULE } from '../src/game/first_play.js';
import { QUESTS, QUEST_IDS, FIRST_PLAY_CHAIN_IDS, SLOW_QUEST_IDS,
         questOf, emptySnapshot } from '../src/game/quest.js';

let bad = 0, seen = 0;
const ok = (name, cond, got) => {
  seen++;
  console.log(`${cond ? '  OK' : 'FAIL'}  ${name}${got == null || got === '' ? '' : '  → ' + got}`);
  if (!cond) bad++;
};
const note = m => console.log('      ' + m);

const RULES = firstPlayRulesFromBalance(JSON.parse(
  readFileSync(new URL('../data/balance/characters.json', import.meta.url), 'utf8')));
const CYCLE = RULES.harvestDays;                     /* 콩나물 한 바퀴 (읽어 온 값) */
const ARRIVE_AT = MONSTERA_ARRIVAL_RULE.harvestCount; /* 몬스테라가 오는 총 회전 (읽어 온 값) */

/* ══════════════════════════════════════════════════════════════════════════
   ★ 옛 차례를 **되살린다** — 「고치기 전」을 재려면 그때 표가 있어야 한다.
   ⚠ 지어낸 표가 아니다. 2026-08-16 판에서 **딱 세 가지가 달랐고** 그것만 되돌린다:
       ① 잎 두 줄이 `monstera_home` **바로 뒤**(정의 순서 6·7번)에 있었다
       ② `crop_mix` 가 `firstPlayDone` **하나로만** 열렸다
       ③ `order_seed` 가 **없었다** — 그래서 `siru_two` 가 `resow_siru` 뒤에 열렸다
   ⇒ 나머지(문구·판정·보상)는 **지금 것을 그대로 쓴다.** 그래야 견주는 것이
     「차례」 하나가 된다. 다른 데까지 되돌리면 무엇 때문에 값이 달라졌는지 못 가른다.
   ══════════════════════════════════════════════════════════════════════════ */
const byId = id => questOf(id);
const OLD_TABLE = (() => {
  const chain = ['place_siru', 'water_siru', 'first_harvest', 'resow_siru'];
  const rest  = ['siru_two', 'monstera_home', 'leaf_two', 'leaf_three'];
  const main  = QUEST_IDS.filter(id => !chain.includes(id) && !rest.includes(id) &&
                                       id !== 'order_seed');
  const order = [...chain, ...rest, ...main];
  return order.map(id => {
    const q = byId(id);
    if (id === 'siru_two')                    /* ③ 앞 줄이 `resow_siru` 였다 */
      return { ...q, opens: (s, ctx) => !!(ctx && ctx.doneIds.includes('resow_siru')) };
    if (id === 'crop_mix')                    /* ② 첫 플레이 끝 하나로만 열렸다 */
      return { ...q, opens: s => !!s.firstPlayDone };
    return q;
  });
})();
const NEW_TABLE = QUESTS;

/* 「지금 할 일」을 고르는 자 — `quest.questView` 와 **같은 규칙**이다
   (열린 것 중 정의 순서에서 첫째). 표를 바꿔 끼울 수 있게 여기 한 벌 둔다. */
function nextOf(table, doneIds, snap) {
  for (const q of table) {
    if (doneIds.includes(q.id)) continue;
    let open = false;
    try { open = !!q.opens(snap, { doneIds, S: null, q }); } catch { open = false; }
    if (open) return q;
  }
  return null;
}
function stepOf(table, doneIds, snap) {
  const out = [];
  for (const q of table) {
    if (doneIds.includes(q.id)) continue;
    let open = false;
    try { open = !!q.opens(snap, { doneIds, S: null, q }); } catch { open = false; }
    if (!open) continue;
    let fin = false;
    try { fin = !!q.done(snap, { doneIds, S: null, q }); } catch { fin = false; }
    if (fin) out.push(q.id);
  }
  return out;
}

/* ══════════════════════════════════════════════════════════════════════════
   한 판을 **달력으로** 굴린다.
   ★ 플레이어 모형: **퀘스트가 시키는 것을 하루에 한 걸음씩 한다.**
     그 모형이라야 「퀘스트가 사람을 바쁘게 하는가」를 재는 것이 된다.
     시키지 않은 일은 안 한다 — 그래서 「할 일이 없는 날」이 정직하게 드러난다.
   ⚠ 콩나물 회전만은 **시키든 안 시키든 돈다**(살림이라서). 그건 「할 일」과 별개다.
   ══════════════════════════════════════════════════════════════════════════ */
function run(table, opt) {
  const { fpEndDay, leaf2Day, leaf3Day, days = 200 } = opt;
  const doneIds = [];
  /* 시루마다 { age, harvestCount }. 첫 시루 하나로 시작한다 */
  const sirus = [{ age: 0, n: 0 }];
  let musunOrderedOn = null, musunAge = null, musunHarvest = 0;
  let monsteraArrived = false, monsteraHomed = false;
  /* ★ 2026-09-02 — 「옮긴 뒤 며칠」도 센다. crop_mix 가 「집 잡은 «다음 날»」로 열리게 됐다(quest.js) —
     그 칸(guide.movedDays)을 이 모형이 안 세면 crop_mix 가 «영영» 안 열려 자가 거짓으로 붉어진다. */
  let homedOn = null;
  const MUSUN_CYCLE = 7;                 /* 무순 한 바퀴 — `docs` 확정값(START-HERE §6) */
  const LEAD = 1;                        /* 주문이 오는 데 걸리는 날 (shop 표와 같은 자리) */

  const log = [];
  for (let day = 1; day <= days; day++) {
    /* ── 살림: 콩나물이 자동으로 돈다(물·수확·다시 심기는 매일 하는 일이다) ── */
    for (const s of sirus) { s.age++; if (s.age >= CYCLE) { s.age = 0; s.n++; } }
    const total = sirus.reduce((a, s) => a + s.n, 0);
    if (!monsteraArrived && total >= ARRIVE_AT) monsteraArrived = true;
    if (musunAge != null) { musunAge++; if (musunAge >= MUSUN_CYCLE) { musunAge = 0; musunHarvest++; } }

    const snap = {
      ...emptySnapshot(), day,
      firstPlayDone: day >= fpEndDay,
      cropHarvestTotal: total + musunHarvest,
      cropPots: [...sirus.map(s => ({ kind: 'beansprout', harvestCount: s.n,
                                      placed: true, watered: true })),
                 ...(musunAge != null ? [{ kind: 'musun', harvestCount: musunHarvest,
                                           placed: true, watered: true }] : [])],
      /* 한 상에 두 가지 — 무순을 한 번이라도 거둔 뒤부터는 같이 먹는다 */
      mealKinds: musunHarvest >= 1 ? ['beansprout', 'musun'] : ['beansprout'],
      motherLeaves: day >= leaf3Day ? 3 : day >= leaf2Day ? 2 : monsteraArrived ? 1 : 0,
      monsteraArrived, monsteraHomed,
      monsteraHomedDays: (monsteraHomed && homedOn != null) ? day - homedOn : 0
    };

    /* ── 끝난 것을 걷는다 ── */
    for (const id of stepOf(table, doneIds, snap)) if (!doneIds.includes(id)) doneIds.push(id);

    /* ── 「지금 할 일」 ── */
    const nx = nextOf(table, doneIds, snap);
    log.push({ day, next: nx ? nx.id : null });

    /* ── 그 할 일을 향해 **하루에 한 걸음** ── */
    /* ★ 2026-09-04 ㉲ — 둘째 시루는 퀘스트가 아니라 «강제 가이드»(창턱 && 하나뿐 ⇒ 「하나 더 사서 놓으세요」)가 끈다.
       사람 모형도 그 손가락을 따른다 — 안 따르면 siru5(열쇠 = 둘 놓임 && 창턱)가 영영 안 열린다. */
    if (monsteraHomed && sirus.length < 2) sirus.push({ age: 0, n: 0 });
    if (nx) switch (nx.id) {
      case 'monstera_home': if (monsteraArrived && !monsteraHomed) { monsteraHomed = true; homedOn = day; } break;
      case 'crop_mix':
        /* 무순은 몬스테라가 온 뒤에 상점에 뜬다(`game.html §musunOpen` 실측) */
        if (monsteraArrived && musunOrderedOn == null) musunOrderedOn = day;
        else if (musunOrderedOn != null && musunAge == null && day >= musunOrderedOn + LEAD) musunAge = 0;
        break;
      /* 시루를 세는 줄 넷 — 하루에 하나씩 들인다. ⚠ `siru5_cycle5` 도 여기다:
         「다섯 개를 다섯 바퀴」라 **개수부터 채워야** 바퀴를 셀 수 있다.
         (이 줄을 빼놓았더니 그 판이 400일을 굴려도 안 끝났다 — 코드가 아니라
          플레이어 모형이 게을렀던 것이다) */
      case 'siru_two': case 'siru5_cycle5': case 'siru8': case 'siru16':
        if (sirus.length < nx.need.sirus) sirus.push({ age: 0, n: 0 });
        break;
      /* `order_seed` 는 「주문해 두고 기다리는」 줄이라 따로 할 걸음이 없다 —
         씨앗은 시켜 뒀고 회전은 위에서 돌고 있다 */
      default: break;
    }
  }
  return { log, doneIds };
}

/* 「그냥 기다려라」인 날 — 느린 줄이 「지금 할 일」이거나, 아예 할 일이 없는 날 */
const isIdle = row => row.next == null || SLOW_QUEST_IDS.includes(row.next);
function idleStats(log, from, to) {
  const win = log.filter(r => r.day >= from && r.day <= to);
  let run = 0, worst = 0, worstAt = 0, count = 0;
  for (const r of win) {
    if (isIdle(r)) { run++; count++; if (run > worst) { worst = run; worstAt = r.day - run + 1; } }
    else run = 0;
  }
  return { count, worst, worstAt, total: win.length };
}

/* ══ A. 첫 플레이가 잎 2장보다 먼저 끝난다 — 표가 그것을 받아들이는가 ══════════ */
console.log('\n══ A. ★★ 「한 상에 두 가지」가 잎 줄 앞에 올 수 있는가 ═══════════════');
{
  /* 몬스테라가 왔고(무순을 살 수 있고) 잎은 아직 하나인 판 — 사슬을 다 끝낸 자리다 */
  /* ★ 2026-09-02 — 집을 잡은 «다음 날»(monsteraHomedDays 1)이라야 crop_mix 가 선다(quest.js).
     옛 표의 사슬에는 resow_siru 가 «있었다» — 지금 FIRST_PLAY_CHAIN_IDS 에는 없으니 옛 판에만 얹는다. */
  /* ★ 2026-09-02 ㉱ — 옛 사슬에는 resow_siru·siru_two 가 «있었다»(지금은 RETIRED). 옛 판에만 얹는다.
     새 판은 day 25 = 세팅 끝 — 짧은 줄(siru5)의 열쇠가 그것이라 채운다. */
  /* ★ 2026-09-04 ㉲ — 세팅 끝 = 시루 둘 «놓임» && 창턱. 놓인 둘을 채운다. */
  const snap = { ...emptySnapshot(), day: 25, firstPlayDone: true, monsteraArrived: true,
                 cropPots: [{ kind: 'beansprout', harvestCount: 3, placed: true }, { kind: 'beansprout', harvestCount: 1, placed: true }],
                 monsteraHomed: true, monsteraHomedDays: 1, motherLeaves: 1 };
  const doneIds = [...FIRST_PLAY_CHAIN_IDS];
  const nOld = nextOf(OLD_TABLE, [...doneIds, 'resow_siru', 'siru_two'], snap);
  const nNew = nextOf(NEW_TABLE, doneIds, snap);
  ok('A-1 ★★★ 옛 차례에서는 그 자리의 「지금 할 일」이 **잎 줄**이었다',
     nOld && SLOW_QUEST_IDS.includes(nOld.id), nOld ? `「${nOld.ko}」` : 'null');
  ok('A-2 ★★★ 지금 차례에서는 **짧은 줄**이 온다',
     nNew && !SLOW_QUEST_IDS.includes(nNew.id), nNew ? `「${nNew.ko}」` : 'null');
  note(`옛 「${nOld && nOld.todo(nOld)}」 → 지금 「${nNew && nNew.todo(nNew)}」`);
}

/* ══ B. 달력으로 굴려 「기다리기만 하는 날」을 센다 ═════════════════════════ */
console.log('\n══ B. ★★★ **「그냥 기다려라」인 날이 며칠이나 이어지나** ═════════════');
console.log('   ⚠ 잎이 나는 날은 이 자가 모른다 — 파라미터로 훑는다(머리말 §잎이 나는 날)');
console.log('');
console.log('   잎2  잎3  첫플끝 │  옛: 기다림 날수 / 최장 연속  │  지금: 기다림 / 최장');
console.log('   ─────────────────┼───────────────────────────────┼──────────────────────');
const CASES = [
  /* 잎2, 잎3, 첫 플레이 끝. ★ 첫 플레이 끝은 늘 잎 2장보다 앞이다(머리말 §첫 플레이) */
  { leaf2Day: 40, leaf3Day: 60, fpEndDay: 33 },
  { leaf2Day: 60, leaf3Day: 90, fpEndDay: 33 },
  { leaf2Day: 80, leaf3Day: 120, fpEndDay: 33 },
  { leaf2Day: 100, leaf3Day: 150, fpEndDay: 40 },
  { leaf2Day: 140, leaf3Day: 190, fpEndDay: 40 }
];
const rows = [];
for (const c of CASES) {
  const days = c.leaf3Day + 10;
  const o = run(OLD_TABLE, { ...c, days });
  const n = run(NEW_TABLE, { ...c, days });
  /* 재는 구간 — **몬스테라 자리를 잡은 뒤부터 잎 3장까지.** 박사님이 짚으신 그 구간이다 */
  const from = 1, to = c.leaf3Day;
  const so = idleStats(o.log, from, to), sn = idleStats(n.log, from, to);
  rows.push({ c, so, sn });
  console.log(`   ${String(c.leaf2Day).padStart(3)}  ${String(c.leaf3Day).padStart(3)}` +
              `  ${String(c.fpEndDay).padStart(5)} │` +
              `  ${String(so.count).padStart(3)}일 / ${String(so.worst).padStart(3)}일 연속` +
              `${' '.repeat(9)}│  ${String(sn.count).padStart(3)}일 / ${String(sn.worst).padStart(3)}일`);
}
console.log('');
ok('B-1 ★★★ 어느 경우에도 **기다리기만 하는 날이 줄었다**',
   rows.every(r => r.sn.count <= r.so.count),
   rows.map(r => `${r.c.leaf2Day}일판 ${r.so.count}→${r.sn.count}`).join(' · '));
ok('B-2 ★★★ **최장 연속**이 줄었다 (이것이 「구멍」의 크기다)',
   rows.every(r => r.sn.worst <= r.so.worst),
   rows.map(r => `${r.c.leaf2Day}일판 ${r.so.worst}→${r.sn.worst}`).join(' · '));
ok('B-3 ★★ 그래도 **아홉 줄이 다 끝난다** (어느 줄도 죽지 않았다)',
   rows.length > 0 && (() => {
     const n = run(NEW_TABLE, { ...CASES[CASES.length - 1], days: 260 });
     const want = [...FIRST_PLAY_CHAIN_IDS, ...SLOW_QUEST_IDS];
     const left = want.filter(id => !n.doneIds.includes(id));
     return left.length === 0;
   })(), '초반 아홉 줄');

/* ══ C. 어느 줄도 영영 안 열리는 일이 없다 ════════════════════════════════ */
console.log('\n══ C. ⚠ **어느 줄도 영영 안 열리지 않는가** (사슬이 안 죽었나) ══════');
{
  /* 오래 굴린 판에서 **본 줄기까지** 다 열리는지 본다.
     ⚠ 삽수·등·무늬는 이 자가 안 켜므로(끈 것 ⓒ) 그 넷은 여기서 제외한다 —
       안 켠 것을 「안 열렸다」로 세면 재는 자가 거짓말을 한다. */
  const OFF = ['first_cut', 'buy_lamp', 'varie_bright', 'sell_varie'];
  const want = QUEST_IDS.filter(id => !OFF.includes(id));
  const n = run(NEW_TABLE, { leaf2Day: 60, leaf3Day: 90, fpEndDay: 33, days: 400 });
  const left = want.filter(id => !n.doneIds.includes(id));
  ok(`C-1 ★★★ 켠 계통의 ${want.length}줄이 **전부 끝난다**`, left.length === 0,
     left.length ? `안 끝난 줄: ${left.join(' · ')}` : `${want.length}줄 전부`);
  /* ★ 「지금 할 일」이 하루도 안 비었나 — `null` 은 「아무 줄도 안 열렸다」다 */
  const blank = n.log.filter(r => r.next == null && r.day <= 90);
  ok('C-2 ★★ 첫 90일에 「지금 할 일」이 **아예 없는 날이 없다**', blank.length === 0,
     blank.length ? `${blank.length}일 (${blank.slice(0, 5).map(r => r.day).join(',')}…)` : '0일');
}

/* ══ D. 날마다 무엇을 시키나 — 한 판을 그대로 찍는다 ═══════════════════════ */
console.log('\n══ D. 한 판의 「지금 할 일」이 날마다 무엇인가 (잎2 60일 · 잎3 90일) ══');
{
  const c = { leaf2Day: 60, leaf3Day: 90, fpEndDay: 33, days: 95 };
  const o = run(OLD_TABLE, c), n = run(NEW_TABLE, c);
  const runs = log => {
    const out = [];
    for (const r of log) {
      const last = out[out.length - 1];
      if (last && last.id === r.next) last.to = r.day;
      else out.push({ id: r.next, from: r.day, to: r.day });
    }
    return out;
  };
  const draw = (title, log) => {
    console.log(`\n   ─ ${title} ─`);
    for (const s of runs(log)) {
      const q = s.id ? questOf(s.id) : null;
      const slow = s.id && SLOW_QUEST_IDS.includes(s.id);
      console.log(`   ${String(s.from).padStart(3)}~${String(s.to).padStart(3)}일 ` +
                  `(${String(s.to - s.from + 1).padStart(3)}일)  ${slow ? '⏳' : '  '} ` +
                  `${q ? q.ko : '— 할 일 없음 —'}`);
    }
  };
  draw('옛 차례', o.log);
  draw('지금 차례', n.log);
  note('⏳ = 「그냥 기다려라」인 구간 (빛이 쌓여야 끝나는 줄)');
}

console.log(`\n${bad ? '⛔' : '★'} ${seen - bad}/${seen} 통과`);
process.exit(bad ? 1 : 0);
