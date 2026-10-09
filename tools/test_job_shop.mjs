/* tools/test_job_shop.mjs — 진로 «식물 가게» 코어(src/game/job_shop.js · 총괄 D59 · plan-shop-spec §2~§4) — 노드만
   A 진로 고르기 — story.job · 두 번 못 연다
   B 가게 첫날 — shop_open · 첫 주문은 «바로 맞출 수 있는 쉬움 하나» · 첫 손님은 표의 first(반찬가게 사장님) · 기록 «{ko} — {ask}»
   C 날마다 — 새 주문 5~9일 간격 · 열린 주문 최대 3 · 기한 지나면 조용히 사라짐(order_expired · 단골 안 셈)
   D «할 수 없는 주문을 안 낸다» — 원천이 없는 kind 는 안 나온다(PP 없으면 pp 0 · 깬 AL 없으면 al 0) · 보낼 수 있는 수만큼만 연다
   E 납품 — 맞는 것만 후보 · 값 = 시세 × 웃돈 · 뺀다 · 단골(서로 다른 손님) · 이정표 3/10/30 · 10 이면 간판 · 다시 온 손님 웃돈 +0.1
   F 스냅샷 칸(plan quest SHOP_QUESTS) · G 세이브 왕복 · H 산 집 살림 · I 주문 가드 넷(plan §11) · J 산 집 이사 — 새 두 종 그루도 가방으로 */
import assert from 'node:assert';
import * as JS from '../src/game/job_shop.js';
import * as SP from '../src/game/species.js';
import { cuttingPriceOf } from '../src/game/shop.js';

let bad = 0;
const T = (name, fn) => { try { fn(); console.log('PASS ', name); } catch (e) { bad++; console.log('FAIL ', name, '\n     ', e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e); } };
const cut = (id, o = {}) => ({ id, status: 'rooted', varieFromCut: false, leaves: 1, leafVarie: [false], leafGrade: [null], at: { x: 0, y: 1, z: 0 }, slotId: 's:' + id, ...o });
const newS = (o = {}) => ({ day: 300, sim: { seed: 11 }, story: {}, home: { room: 'tworoom' }, cuttings: [], pots: [], shop: { stock: {} },
                            tutorial: { lamp: { placed: 0 } }, ...o });
const openS = (o) => { const S = newS(o); JS.startShopJob(S); JS.openShop(S); return S; };
const days = (S, n, ctx = {}) => { const ev = []; for (let i = 0; i < n; i++) { S.day += 1; ev.push(...JS.stepShopJob(S, ctx).events.map(e => ({ ...e, day: S.day }))); } return ev; };

T('A 진로 고르기', () => {
  const S = newS();
  const r = JS.startShopJob(S);
  assert.strictEqual(S.story.job.id, 'shop');
  assert.strictEqual(r.events[0].id, 'job_start');
  assert.throws(() => JS.startShopJob(S));
  assert.ok(JS.movedHome(S));
});

T('B 가게 첫날 — 첫 주문 · 첫 손님', () => {
  const S = newS({ cuttings: [cut('c1')] });
  JS.startShopJob(S);
  const r = JS.openShop(S);
  const ids = r.events.map(e => e.id);
  assert.deepStrictEqual(ids, ['shop_open', 'order_new']);
  const o = S.jobShop.orders[0];
  assert.strictEqual(o.customerId, 'banchan_owner');
  assert.strictEqual(o.tier, 'easy');
  assert.ok(JS.candidatesFor(S, o).length >= 1, '첫 주문을 바로 못 맞춘다');
  assert.ok(/^반찬가게 사장님 — /.test(r.events[1].ko), r.events[1].ko);
  assert.strictEqual(JS.openShop(S).events.length, 0, '두 번 열렸다');
});

T('C 날마다 — 간격 · 최대 3 · 기한', () => {
  const S = openS({ cuttings: [cut('c1'), cut('c2'), { ...cut('c3'), status: 'established', leaves: 3, leafVarie: [false, false, false], leafGrade: [null, null, null] }] });
  const ev = days(S, 60);
  const news = ev.filter(e => e.id === 'order_new');
  const gaps = []; let last = S.jobShop.openedOn; for (const e of news) { gaps.push(e.day - last); last = e.day; }
  console.log('      새 주문 날', news.map(e => e.day).join(','), '간격', gaps.join(','), '기한 지남', ev.filter(e => e.id === 'order_expired').length);
  assert.ok(gaps.every(g => g >= 5), '5일보다 짧은 간격');
  assert.ok(S.jobShop.orders.length <= 3, '열린 주문이 셋을 넘었다');
  assert.ok(ev.some(e => e.id === 'order_expired'), '기한이 안 지났다(60일인데)');
  assert.strictEqual(S.jobShop.regulars.length, 0, '기한 지난 것이 단골로 셌다');
});

T('D 할 수 없는 주문을 안 낸다', () => {
  const S = openS({ cuttings: [cut('c1')] });
  const ev = days(S, 200);
  const kinds = new Set(S.jobShop.orders.map(o => o.kind).concat(ev.filter(e => e.id === 'order_new').map(e => (S.jobShop.orders.find(o => o.id === e.orderId) || {}).kind).filter(Boolean)));
  assert.ok(!kinds.has('pp') && !kinds.has('al') && !kinds.has('al_corm'), '없는 종 주문: ' + [...kinds].join(','));
  /* PP 가 생기면 pp 주문이 날 수 있다 */
  const S2 = openS({ cuttings: [] });
  SP.addSpeciesPot(S2, 'pink_princess', { origin: 'trade' });
  assert.ok(JS.shopSources(S2).pp, 'PP 원천을 못 봤다');
  days(S2, 120);
  const all = S2.jobShop.orders.concat([]);
  assert.ok(all.every(o => o.kind === 'pp' || o.kind === 'monstera_cutting'), '원천 없는 kind: ' + all.map(o => o.kind).join(','));
  /* 보낼 수 있는 수만큼만 — PP 한 그루에 pp 주문은 한 번에 하나 */
  assert.ok(all.filter(o => o.kind === 'pp').length <= 1, 'PP 한 그루에 pp 주문이 둘 이상 열렸다');
  assert.ok(!all.some(o => o.kind === 'pp') || !JS.shopSources(S2).pp, '걸린 pp 주문을 원천에서 안 뺐다');
});

T('E 납품 — 값 · 단골 · 이정표 · 간판 · 다시 온 손님', () => {
  const S = openS({ cuttings: [cut('c1', { leaves: 2, leafVarie: [false, false], leafGrade: [null, null] })] });
  const o = S.jobShop.orders[0];
  const cand = JS.candidatesFor(S, o)[0];
  const base = cuttingPriceOf({ leaves: 2, variegatedLeaves: 0, leafGrades: [null, null] }).won;
  assert.strictEqual(cand.won, Math.round(base * o.premium));
  const r = JS.deliverOrder(S, o.id, cand.ref);
  assert.strictEqual(r.events[0].id, 'order_done');
  assert.strictEqual(r.newRegular, true);
  assert.ok(!S.cuttings.some(c => c.id === 'c1'), '납품한 것이 남았다');
  assert.ok(/^반찬가게 사장님 — /.test(r.events[0].ko));
  /* 손님 열 명을 만들어 이정표 · 간판 */
  const ms = [];
  for (let i = 0; i < 12; i++) {
    S.cuttings.push(cut('x' + i));
    const cust = JS.shopCustomers()[i + 1];
    S.jobShop.orders.push({ id: 'od_t' + i, customerId: cust.id, kind: 'monstera_cutting', need: {}, tier: 'easy', openedOn: S.day, dueOn: S.day + 21, premium: 1.3 });
    const rr = JS.deliverOrder(S, 'od_t' + i, { type: 'cutting', id: 'x' + i });
    ms.push(...rr.events.filter(e => e.id !== 'order_done').map(e => e.id + (e.n ? e.n : '')));
  }
  console.log('      이정표', ms.join(' '), '단골', S.jobShop.regulars.length);
  assert.ok(ms.includes('regulars_milestone3') && ms.includes('regulars_milestone10') && ms.includes('shop_sign'));
  assert.strictEqual(S.jobShop.signOnDay, S.day);
  /* 다시 온 손님 웃돈 */
  S.cuttings.push(cut('y1'));
  S.jobShop.orders = [];
  S.jobShop.nextOrderDay = S.day + 1;
  let o2 = null;
  for (let i = 0; i < 80 && !o2; i++) { S.day += 1; JS.stepShopJob(S); o2 = S.jobShop.orders.find(x => x.repeat) || null; if (!o2) S.jobShop.orders = []; }
  assert.ok(o2, '다시 온 손님 주문이 안 났다');
  assert.strictEqual(o2.premium, +(JS.SHOP_JOB.tiers[o2.tier].premium + 0.1).toFixed(2));
});

T('F 스냅샷 · G 세이브', () => {
  const S = openS({ cuttings: [cut('c1')] });
  const s = JS.jobShopSnapshot(S);
  assert.deepStrictEqual(Object.keys(s).sort(), ['job', 'movedHome', 'shopDone', 'shopDueSoonest', 'shopOpenOrders', 'shopRegulars']);
  assert.strictEqual(s.job, 'shop'); assert.strictEqual(s.movedHome, true); assert.strictEqual(s.shopOpenOrders, 1);
  assert.strictEqual(s.shopDueSoonest, JS.SHOP_JOB.tiers.easy.days);
  const back = JS.unpackJobShop(JSON.parse(JSON.stringify(JS.packJobShop(S.jobShop))));
  assert.deepStrictEqual(back, S.jobShop);
  const none = JS.jobShopSnapshot({ day: 1, story: {}, home: { room: 'oneroom' } });
  assert.strictEqual(none.movedHome, false); assert.strictEqual(none.job, null); assert.strictEqual(none.shopDone, null);
});

T('I 주문 가드 넷(plan §11) — 겨울·하프문 등 2 · PP 맨 위 분홍 0.5 · AL 가을 등 1 · 이미 갖춘 그루는 가드 밖', () => {
  const N = JS.orderNeedFor;
  const base = { varieSource: true, cut2: false, cutHalfmoon: false, cutSanban: false, ppMarble: false, ppHeavy: false, ppTopPink: 0.35, al2: false, varieAL: false, varieEst: false, maxLeaves: 1 };
  const SPRING = 10, AUTUMN = 190, LATE_AUT = 260, WINTER = 280;
  /* 1 겨울(기한 안에 겨울이 낌 포함) — 등 0~1 이면 자람 드는 조건 없음 · 등 2 면 남 */
  for (const day of [WINTER, LATE_AUT]) for (const lamps of [0, 1]) {
    const src = { ...base, day, lamps };
    assert.strictEqual(N('monstera_cutting', 'normal', src), null, `겨울 잎2 삽수 day${day} 등${lamps}`);
    assert.strictEqual(N('monstera_cutting', 'hard', src), null, `겨울 무늬 삽수 day${day} 등${lamps}`);
    assert.strictEqual(N('pp', 'normal', src), null, `겨울 PP 보통 day${day} 등${lamps}`);
    assert.deepStrictEqual(N('monstera_cutting', 'easy', src), {}, '꼴만 주문은 겨울에도');
  }
  assert.deepStrictEqual(N('monstera_cutting', 'normal', { ...base, day: WINTER, lamps: 2 }), { leaves: 2 });
  /* 2 하프문 — 철과 상관없이 등 2 · 아니면 산반 */
  assert.deepStrictEqual(N('monstera_cutting', 'hard', { ...base, day: SPRING, lamps: 1 }), { grade: 'sanban' });
  assert.deepStrictEqual(N('monstera_cutting', 'hard', { ...base, day: SPRING, lamps: 2 }), { grade: 'halfmoon' });
  /* 3 PP 하프문 — 맨 위 분홍 0.5 */
  assert.strictEqual(N('pp', 'hard', { ...base, day: SPRING, lamps: 3, ppTopPink: 0.35 }), null);
  assert.deepStrictEqual(N('pp', 'hard', { ...base, day: SPRING, lamps: 0, ppTopPink: 0.6 }), { grade: 'halfmoon' });
  /* 4 AL 잎 2 — 가을 등 1 */
  assert.strictEqual(N('al', 'normal', { ...base, day: AUTUMN, lamps: 0 }), null);
  assert.deepStrictEqual(N('al', 'normal', { ...base, day: AUTUMN, lamps: 1 }), { leaves: 2 });
  assert.deepStrictEqual(N('al', 'normal', { ...base, day: SPRING, lamps: 0 }), { leaves: 2 });
  /* 이미 갖춘 그루 — 가드와 상관없이 */
  const have = { ...base, day: WINTER, lamps: 0, cut2: true, cutHalfmoon: true, ppMarble: true, ppHeavy: true, al2: true };
  assert.deepStrictEqual(N('monstera_cutting', 'normal', have), { leaves: 2 });
  assert.deepStrictEqual(N('monstera_cutting', 'hard', have), { grade: 'halfmoon' });
  assert.deepStrictEqual(N('pp', 'hard', have), { grade: 'halfmoon' });
  assert.deepStrictEqual(N('al', 'normal', have), { leaves: 2 });
});

{
  const TU = await import('../src/game/tutorial.js');
  const { TUT_RULES } = await import('./lib/byeot_harness.mjs');
  T('H 산 집 살림 — 월세 0 · 하루 지출 · 월세 사건 없음', () => {
    const ts = TU.createTutorialState({ enabled: true, rules: TUT_RULES }); ts.cashWon = 1e9; ts.movedOut = true;
    const before = TU.dailyCashOutWon(ts);
    ts.homeOwned = true;
    assert.strictEqual(TU.rentWonOf(ts), 0);
    const per = TUT_RULES.rentPeriodDays || 30;
    assert.strictEqual(TU.dailyCashOutWon(ts), Math.max(0, Math.round(TUT_RULES.oneroomDailySpendWon - TUT_RULES.oneroomRentWon / per)));
    console.log('      원룸 하루', before, '→ 산 집 하루', TU.dailyCashOutWon(ts));
    let rentEv = 0; for (let d = 0; d < 90; d++) { const r = TU.tutorialDay(ts, { firstPlayDone: true }); rentEv += ((r && r.events) || []).filter(e => e.id === 'rent').length; }
    assert.strictEqual(rentEv, 0, '산 집에서 월세가 나갔다');
  });
}
{
  const OR = await import('../src/game/oneroom.js');
  T('J 산 집으로 옮기면 새 두 종 그루도 가방으로(떠나온 방 자리 이름을 들고 오지 않는다)', () => {
    const S = newS({ home: { room: 'oneroom' }, story: { ending: { done: true, doneOnDay: 290 } }, tutorial: { lamp: { placed: 0 }, movedOut: true }, log: [] });
    const q1 = SP.addSpeciesPot(S, 'pink_princess', { origin: 'trade' }); SP.setSpeciesAt(S, q1.id, { slotId: 'oneroom-sill:3', at: { x: 1, y: 1, z: 0 } });
    const q2 = SP.addSpeciesPot(S, 'alocasia_frydek', { origin: 'corm' }); SP.setSpeciesAt(S, q2.id, { slotId: 'banjiha-etagere:6', at: { x: 0, y: 1, z: 0 } });
    const r = OR.moveIntoOwnedHome(S, {}, {});
    assert.strictEqual(S.home.room, 'tworoom');
    assert.strictEqual(r.clearedPlacements.species, 2);
    for (const q of SP.speciesPotsOf(S)) { assert.strictEqual(q.slotId, null, q.id + ' 자리가 남았다'); assert.strictEqual(q.at, null); assert.ok(!SP.speciesPlaced(q)); }
  });
}
console.log(bad ? `job_shop: FAIL (${bad})` : 'job_shop: PASS');
process.exit(bad ? 1 : 0);
