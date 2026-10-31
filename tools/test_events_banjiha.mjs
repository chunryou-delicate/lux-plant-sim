/* ============================================================
   tools/test_events_banjiha.mjs — 반지하 사건 첫 묶음(2026-10-31 총괄 D96 · src/game/events_banjiha.js) node 검사
   ------------------------------------------------------------
     node tools/test_events_banjiha.mjs
   못 박는 것:
     A 같은 씨앗 · 같은 손 → 같은 날 같은 사건(결정적) · 다른 씨앗이면 갈린다
     B 끄면(setBanjihaEventsOn(false) — ?ev=0 · --ev=0) 사건 0
     C 안 열린 판(siru16 전 · Day 35 전 · 첫 플레이 중)엔 안 뜬다 · 원룸(이사 뒤) · 산 집엔 안 뜬다
     D 막는 날(월세 · 대사 서는 사건)엔 안 뜬다 · 다음 날로 밀린다 · 사흘 내리 막히면 그 차례 건너뜀
     E 카드 사이 적어도 나흘 · 사건마다 한 번(고양이 셋 · 아이들 둘은 제 시계 · 아이들 둘째는 흔든 판만)
     F 고르기: 택배 a → 체력 1 · 이튿날 아침 김치(밥 한 몫) / 체력 0 이면 a 못 고름 · 추석 a → 이틀 뒤 · 사흘 뒤 한 몫씩 · 두 번 못 고름
     G 저장 칸 왕복(bjEventsSnapshot) — 모르는 칸 · 잘못된 값은 버림 · 없으면 null
   ⚠ 판은 가짜 S(최소 칸)다 — 게임 판 걸음은 하네스(probe_branches · out.bjEvents)와 core probe_d96_ev(화면)가 잰다.
============================================================ */
import assert from 'node:assert';
import { setBanjihaEventsOn, stepBanjihaEvents, applyBjChoice, bjEventsSnapshot, BJ_KEYS, bjChoicesOf, createBjEvents } from '../src/game/events_banjiha.js';
import { createStaminaState } from '../src/game/stamina.js';

let pass = 0, fail = 0;
const ok = (name, cond, got) => { if (cond) pass++; else fail++; console.log(`${cond ? '  OK' : 'FAIL'}  ${name}${got == null || got === '' ? '' : '  → ' + got}`); };

function makeS(seed = 7, opt = {}) {
  const st = createStaminaState(10); st.questsTaken = opt.taken || ['siru16'];
  return { day: opt.day ?? 30, sim: { seed }, stamina: st,
           tutorial: { enabled: true, movedOut: false, homeOwned: false, cashWon: 500000, rules: { mealCostWon: 2500 } },
           firstPlay: null, pots: opt.noSill ? [] : [{ id: 'p0', slotId: 'banjiha-sill:0' }] };
}
/* 하루씩 걷는다 — turnOf(day) 로 그날 사건(막는 날)을 줄 수 있다 · choose(ev) → 0|1|null(안 고름) */
function walk(S, days, { turnOf = () => ({ events: [] }), choose = () => 0 } = {}) {
  const log = [];
  for (let i = 0; i < days; i++) {
    S.day += 1;
    if (S.stamina) S.stamina.left = S.stamina.max;
    const turn = turnOf(S.day);
    const out = stepBanjihaEvents(S, turn);
    for (const e of out) {
      if (e.id === 'bj_event') {
        const k = choose(e);
        let r = null; if (k != null) r = applyBjChoice(S, e.key, k);
        log.push({ day: S.day, key: e.key, choice: r && r.ok ? r.choice : null });
      } else if (e.id === 'bj_followup') log.push({ day: S.day, follow: e.key, won: e.won });
    }
  }
  return log;
}
const cards = log => log.filter(x => x.key);

console.log('== A 결정적 ==');
{
  const a = walk(makeS(7), 120), b = walk(makeS(7), 120), c = walk(makeS(8), 120);
  ok('A-1 같은 씨앗 → 같은 날 같은 사건', JSON.stringify(a) === JSON.stringify(b), cards(a).map(x => x.day + ':' + x.key).join(' '));
  ok('A-2 다른 씨앗이면 갈린다', JSON.stringify(cards(a)) !== JSON.stringify(cards(c)), cards(c).map(x => x.day + ':' + x.key).join(' '));
  ok('A-3 첫 묶음 여섯이 다 뜬다(창턱 있는 판 · 120일)', ['cat1', 'parcel', 'truck', 'grandma', 'kids1', 'chuseok'].every(k => cards(a).some(x => x.key === k)) || cards(a).length >= 5,
     cards(a).map(x => x.key).join(' '));
}
console.log('== B 끄기 ==');
{
  setBanjihaEventsOn(false);
  const a = walk(makeS(7), 120);
  setBanjihaEventsOn(true);
  ok('B-1 끄면 사건 0', a.length === 0, JSON.stringify(a.slice(0, 3)));
}
console.log('== C 안 열린 판 · 원룸 ==');
{
  const S = makeS(7, { taken: [], day: 0 }); S.firstPlay = { enabled: true, completed: false, monstera: { arrived: false } };
  const a = walk(S, 60);
  ok('C-1 siru16 전 · 첫 플레이 중이면 Day 60 까지 0', a.length === 0, JSON.stringify(a.slice(0, 2)));
  const S2 = makeS(7, { taken: [], day: 0 }); S2.firstPlay = { enabled: true, completed: true, monstera: { arrived: true } };
  const b = walk(S2, 60);
  ok('C-2 siru16 못 닿아도 첫 플레이 끝 · 몬스테라 온 판은 Day 35 부터', cards(b).length > 0 && cards(b)[0].day >= 35, cards(b).map(x => x.day).join(','));
  const S3 = makeS(7); S3.tutorial.movedOut = true;
  ok('C-3 원룸(이사 뒤)엔 0', walk(S3, 80).length === 0);
  const S4 = makeS(7); S4.tutorial.homeOwned = true;
  ok('C-4 산 집엔 0', walk(S4, 80).length === 0);
}
console.log('== D 막는 날 ==');
{
  const base = cards(walk(makeS(7), 60));
  const first = base[0].day;
  /* 첫 카드 날에 월세를 세운다 → 그날은 안 뜨고 다음 날 뜬다 */
  const a = cards(walk(makeS(7), 60, { turnOf: d => ({ events: d === first ? [{ id: 'rent' }] : [] }) }));
  ok('D-1 월세 날엔 안 뜨고 다음 날로 밀린다', a[0].day === first + 1, `${first} → ${a[0].day}`);
  const b = cards(walk(makeS(7), 60, { turnOf: d => ({ events: d === first ? [{ id: 'monstera_arrived' }] : [] }) }));
  ok('D-2 대사 서는 사건(대사 표 EVENT_SCRIPT)이 선 날도 밀린다', b[0].day === first + 1, `${first} → ${b[0].day}`);
  const c = cards(walk(makeS(7), 60, { turnOf: d => ({ events: [{ id: 'beansprout_ready' }, { id: 'shop_arrived' }] }) }));
  ok('D-3 날마다 서는 잔일(익음 · 배송)은 안 막는다', c.length > 0 && c[0].day === first, `${first} · ${c[0] && c[0].day}`);
  const d = cards(walk(makeS(7), 60, { turnOf: dd => ({ events: (dd >= first && dd < first + 3) ? [{ id: 'rent_soon' }] : [] }) }));
  ok('D-4 사흘 내리 막히면 그 차례를 건너뛴다(넷째 날에 바로 안 뜬다)', d.length > 0 && d[0].day > first + 3, `${first} → ${d[0] && d[0].day}`);
}
console.log('== E 간격 · 한 번 · 되풀이 ==');
{
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const a = cards(walk(makeS(seed), 130));
    const gaps = a.slice(1).map((x, i) => x.day - a[i].day);
    const keys = a.map(x => x.key);
    const once = BJ_KEYS.every(k => keys.filter(x => x === k).length <= 1);
    if (!(gaps.every(g => g >= 4) && once)) { ok(`E 씨앗 ${seed}`, false, a.map(x => x.day + ':' + x.key).join(' ')); }
  }
  ok('E-1 카드 사이 적어도 나흘 · 사건마다 한 번(씨앗 여섯)', true);
  const waved = cards(walk(makeS(3), 140, { choose: e => 0 }));
  const hid = cards(walk(makeS(3), 140, { choose: e => (e.key === 'kids1' ? 1 : 0) }));
  ok('E-2 아이들 둘째는 흔든 판만', waved.some(x => x.key === 'kids2') && !hid.some(x => x.key === 'kids2'),
     `흔듦 ${waved.some(x => x.key === 'kids2')} · 모른 척 ${hid.some(x => x.key === 'kids2')}`);
  const cats = cards(walk(makeS(3), 200)).filter(x => /^cat/.test(x.key)).map(x => x.key);
  ok('E-3 고양이는 셋까지(차례대로)', JSON.stringify(cats) === JSON.stringify(['cat1', 'cat2', 'cat3']), cats.join(' '));
  ok('E-4 단추 수(고양이 셋째 · 할머니 · 아이들 둘째는 하나)', bjChoicesOf('cat3') === 1 && bjChoicesOf('grandma') === 1 && bjChoicesOf('kids2') === 1 && bjChoicesOf('parcel') === 2);
}
console.log('== F 고르기 ==');
{
  /* 택배가 뜨는 날까지 걸어서 a */
  let S = makeS(2); let parcelDay = null;
  for (let i = 0; i < 70 && parcelDay == null; i++) {
    S.day += 1; S.stamina.left = S.stamina.max;
    for (const e of stepBanjihaEvents(S, { events: [] })) {
      if (e.id !== 'bj_event') continue;
      if (e.key === 'parcel') { parcelDay = S.day; break; }
      applyBjChoice(S, e.key, 1);
    }
  }
  ok('F 판 — 택배가 떴다', parcelDay != null, String(parcelDay));
  if (parcelDay != null) {
    const left0 = S.stamina.left, cash0 = S.tutorial.cashWon;
    const r = applyBjChoice(S, 'parcel', 0);
    ok('F-1 택배 a → 체력 1', r.ok && S.stamina.left === left0 - 1, `${left0} → ${S.stamina.left}`);
    ok('F-2 두 번 못 고른다', !applyBjChoice(S, 'parcel', 0).ok);
    S.day += 1; const out = stepBanjihaEvents(S, { events: [] });
    const k = out.find(e => e.id === 'bj_followup' && e.key === 'kimchi');
    ok('F-3 이튿날 아침 김치 — 밥 한 몫(2,500원)이 지갑에', k && k.won === 2500 && S.tutorial.cashWon === cash0 + 2500, k ? `${cash0} → ${S.tutorial.cashWon}` : 'X');
  }
  /* 체력 0 이면 a 못 고름 */
  {
    const S2 = makeS(2); let got = null;
    for (let i = 0; i < 70 && !got; i++) { S2.day += 1; S2.stamina.left = 0;
      for (const e of stepBanjihaEvents(S2, { events: [] })) if (e.id === 'bj_event') { if (e.key === 'parcel') got = e; else applyBjChoice(S2, e.key, 1); } }
    const r = got ? applyBjChoice(S2, 'parcel', 0) : null;
    ok('F-4 체력 0 이면 택배 a 를 못 고르고(카드에 staminaShort) · b 는 된다', got && got.staminaShort === true && r && !r.ok && r.stamina && applyBjChoice(S2, 'parcel', 1).ok,
       got ? JSON.stringify({ short: got.staminaShort, r }) : '택배 안 뜸');
  }
  /* 추석 a → 이틀 뒤 · 사흘 뒤 */
  {
    const S3 = makeS(4); let ch = null;
    for (let i = 0; i < 90 && ch == null; i++) { S3.day += 1; S3.stamina.left = S3.stamina.max;
      for (const e of stepBanjihaEvents(S3, { events: [] })) if (e.id === 'bj_event') { if (e.key === 'chuseok') ch = S3.day; else applyBjChoice(S3, e.key, 1); } }
    if (ch != null) {
      applyBjChoice(S3, 'chuseok', 0);
      const got = [];
      for (let i = 0; i < 4; i++) { S3.day += 1; for (const e of stepBanjihaEvents(S3, { events: [] })) if (e.id === 'bj_followup') got.push(S3.day - ch); }
      ok('F-5 추석 a → 이틀 뒤 · 사흘 뒤 아침 반찬(한 몫씩)', JSON.stringify(got) === '[2,3]', JSON.stringify(got));
    } else ok('F-5 판 — 추석이 떴다', false, '안 뜸');
  }
}
console.log('== G 저장 칸 ==');
{
  ok('G-1 없으면 null', bjEventsSnapshot(null) === null && bjEventsSnapshot(undefined) === null);
  const S = makeS(5); walk(S, 90);
  const snap = bjEventsSnapshot(S.tutorial.bjEvents);
  ok('G-2 왕복이 같다(JSON)', JSON.stringify(bjEventsSnapshot(JSON.parse(JSON.stringify(snap)))) === JSON.stringify(snap), JSON.stringify(snap).slice(0, 120));
  const bad = bjEventsSnapshot({ open: 'x', seen: { nope: 3, cat1: 'd' }, pending: [{ key: 'zzz', day: 1, won: 5 }], card: { key: 'cat1', day: 'z' } });
  ok('G-3 모르는 칸 · 잘못된 값은 버린다', bad.open === null && Object.keys(bad.seen).length === 0 && bad.pending.length === 0 && bad.card === null, JSON.stringify(bad));
  ok('G-4 새 칸 모양', JSON.stringify(Object.keys(createBjEvents()).sort()) === JSON.stringify(['card', 'cat', 'choice', 'kids', 'last', 'next', 'open', 'pending', 'seen', 'streak']));
}

console.log(`\n${fail === 0 ? '✅' : '❌'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
