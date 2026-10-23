/* tools/test_job_switch.mjs — 진로 바꾸기 · 마지막 덮개(src/game/job_switch.js · D 나머지 · plan-career-endings-spec §2 · §11 · 총괄 D75 · D85) — 노드만
   A 막는 길 — 진로 없음 · 지금 진로 끝맺음 전 · 같은 진로 · 모르는 진로(다 tutorialInput) · 카드 표 셋
   B 가게 끝 → 돌봄(처음) — 빈 돌봄 · 이력 · job_start{switched} · care_open{boardKept} · 손님 이음(가게 단골이 첫 맡김) · 숨은 손해 0 · 이사 없음
   C 쉬는 가게 — 새 주문 없음 · 걸린 주문은 기한까지 납품 · 기한 지나면 사라짐(resting) · 판정 shopRestingOpen
   D 돌봄 끝 → 육종(처음) · 쉬는 돌봄 — 새 맡김 없음 · 나은 것은 기한 날 수고비 내고 받아 감 · 못 고친 것은 찾아감
   E 육종 끝 → 돌봄으로 돌아감 — back · 첫날 없음 · 옛 상태 그대로 · 새 맡김이 다시 남 · 쉬는 육종은 안 적음 → 돌아온 날 커서만
   F 처음 해 보는 가게(돌봄 뒤) — 첫 주문 손님은 돌봄 손님 · shop_open{boardKept}
   G 간판 한 자리 — 돌봄 10 먼저 → 가게 10 은 signKept(shop_sign 없음) · 반대도 · 스냅샷 signBy
   H 마지막 덮개 — 셋 다 끝맺음 뒤 한 번 · 세이브 왕복(jobSwitches · finalCoverOn · 진로 이력) */
import assert from 'node:assert';
import * as JS from '../src/game/job_shop.js';
import * as JC from '../src/game/job_care.js';
import * as JB from '../src/game/job_breed.js';
import * as SW from '../src/game/job_switch.js';
import * as SP from '../src/game/species.js';
import { newState } from '../src/game/state.js';
import { serialize, deserialize } from '../src/game/save.js';

let bad = 0;
const T = (name, fn) => { try { fn(); console.log('PASS ', name); } catch (e) { bad++; console.log('FAIL ', name, '\n     ', e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e); } };
const newS = (o = {}) => ({ day: 400, sim: { seed: 11, yearDay0: 0 }, story: {}, home: { room: 'tworoom' }, cuttings: [], pots: [], shop: { stock: {} },
                            tutorial: { lamp: { placed: 0 } }, lamps: { count: 0 }, log: [], ...o });
const SPOTS7 = [{ dropM: 0.02, dli: 0.6 }, { dropM: 0.41, dli: 5 }, { dropM: 0.45, dli: 6.5 }, { dropM: 0.794, dli: 7.5 }, { dropM: 0.81, dli: 12 }];
const regIds = n => JS.shopCustomers().filter(c => !c.special).slice(0, n).map(c => c.id);
/* 가게를 열고 단골 30 · 끝맺음까지(손으로 칸을 세운다 — 주문 굴림은 job_shop 검사 몫) */
const shopEnded = () => {
  const S = newS(); JS.startShopJob(S); JS.openShop(S, {});
  const J = JS.jobShopOf(S); J.regulars = regIds(30); J.milestones = { 3: 300, 10: 350, 30: 390 }; J.signOnDay = 350;
  S.story.jobs.shop.endedOn = 391;
  return S;
};
const ids = r => r.events.map(e => e.id);
const errIn = fn => { try { fn(); } catch (e) { return e; } return null; };

T('A 막는 길 · 카드 표', () => {
  const S0 = newS();
  for (const [why, S, to] of [['진로 없음', S0, 'care'], ['모르는 진로', shopEnded(), 'decor'], ['같은 진로', shopEnded(), 'shop']]) {
    const e = errIn(() => SW.switchJob(S, to)); assert.ok(e && e.tutorialInput, `${why}: 안 막혔다`);
  }
  const S = newS(); JS.startShopJob(S);
  const e = errIn(() => SW.switchJob(S, 'care')); assert.ok(e && /끝맺음을 본 뒤/.test(e.message), '끝맺음 전에 옮겼다');
  assert.strictEqual(SW.canSwitchJob(S), false);
  const E = shopEnded(); assert.strictEqual(SW.canSwitchJob(E), true);
  const cards = SW.switchCards(E);
  assert.deepStrictEqual(cards.map(c => [c.id, c.mark, !!c.go]), [['shop', 'current', false], ['care', 'fresh', true], ['breed', 'fresh', true]]);
  assert.strictEqual(cards[0].markKo, '지금 하는 중 · 동네 식물 가게'); assert.strictEqual(cards[1].markKo, '해 볼 수 있음');
  assert.strictEqual(cards[1].go, '돌봄을 시작한다');
  assert.deepStrictEqual(SW.untriedJobs(E), ['care', 'breed']);
});

T('B 가게 끝 → 돌봄(처음) — 빈 상태 · 이력 · 사건 · 손님 이음 · 숨은 손해 0 · 이사 없음', () => {
  const S = shopEnded();
  S.jobCare = { requests: [{ id: 'junk' }], saved: 99 };   /* 처음 해 보는 진로는 빈 상태로(남은 쓰레기 칸이 있어도) */
  S.cashWon = 1234; const pots0 = JSON.stringify(S.species || null), room0 = S.home.room;
  const r = SW.switchJob(S, 'care', { spots7: SPOTS7 });
  assert.strictEqual(r.back, false); assert.strictEqual(r.from, 'shop');
  assert.strictEqual(S.story.job.id, 'care'); assert.deepStrictEqual(S.story.jobs.care, { since: 400, endedOn: null });
  assert.strictEqual(S.story.jobs.shop.endedOn, 391, '가게 이력이 바뀌었다');
  assert.deepStrictEqual(ids(r).slice(0, 2), ['job_start', 'care_open']);
  assert.deepStrictEqual([r.events[0].switched, r.events[0].back, r.events[0].job], [true, false, 'care']);
  assert.strictEqual(r.events[0].ko, '진로 — 식물 돌봄으로 옮겼습니다');
  assert.strictEqual(r.events[1].boardKept, true); assert.strictEqual(r.events[1].ko, '창 옆 판을 이제 맡김판으로 씁니다');
  const link = r.events.find(e => e.id === 'customer_link'), nw = r.events.find(e => e.id === 'care_new');
  assert.ok(nw, '첫 맡김이 없다'); assert.ok(link, '손님 이음 줄이 없다');
  assert.ok(ids(r).indexOf('customer_link') < ids(r).indexOf('care_new'), '이음 줄이 맡김 줄 뒤');
  assert.strictEqual(link.customerId, nw.customerId); assert.ok(JS.jobShopOf(S).regulars.includes(nw.customerId), '첫 맡김 손님이 가게 단골이 아니다');
  assert.ok(/— 단골이 화분을 맡기러 왔다\.$/.test(link.ko), link.ko);
  assert.strictEqual(JC.jobCareOf(S).saved, 0, '빈 돌봄이 아니다'); assert.strictEqual(JC.jobCareOf(S).requests.length, 1);
  assert.strictEqual(S.cashWon, 1234, '돈이 바뀌었다'); assert.strictEqual(S.home.room, room0, '이사했다');
  assert.ok(JS.hasJob(S) && JS.movedHome(S) && JC.isCareJob(S) && !JS.isShopJob(S));
  assert.deepStrictEqual(S.story.jobSwitches, [{ day: 400, from: 'shop', to: 'care', back: false }]);
  assert.strictEqual(r.banner.title, '🪴 식물 돌봄으로 옮겼습니다');
  void pots0;
});

T('C 쉬는 가게 — 새 주문 없음 · 걸린 주문은 기한까지 납품 · 기한 지나면 사라짐', () => {
  const S = shopEnded(); const J = JS.jobShopOf(S);
  J.orders = [{ id: 'od_900', customerId: J.regulars[0], kind: 'al_corm', need: {}, tier: 'easy', openedOn: 395, dueOn: 410, premium: 1.3, repeat: true },
              { id: 'od_901', customerId: J.regulars[1], kind: 'al_corm', need: {}, tier: 'easy', openedOn: 395, dueOn: 403, premium: 1.3, repeat: true }];
  J.nextOrderDay = 401; const seq0 = J.seq;
  SW.switchJob(S, 'care', { spots7: SPOTS7 });
  assert.strictEqual(JS.shopRestingOpen(S), true);
  for (let d = 0; d < 4; d++) { S.day += 1; const r = JS.stepShopJob(S, {}); assert.ok(!ids(r).includes('order_new'), '쉬는 가게에 새 주문'); }
  assert.strictEqual(S.day, 404);
  assert.deepStrictEqual(J.orders.map(o => o.id), ['od_900'], '기한 지난 주문이 안 사라졌다');
  assert.strictEqual(J.seq, seq0, '쉬는 가게가 주문을 굴렸다');
  /* 걸린 주문은 납품된다(돈은 부르는 쪽) */
  S.shop.stock.al_corm = 1;
  const d = JS.deliverOrder(S, 'od_900', { type: 'cormStock', id: 'al_corm' });
  assert.ok(d.won > 0); assert.strictEqual(J.orders.length, 0); assert.strictEqual(JS.shopRestingOpen(S), false);
  S.day = 420; assert.deepStrictEqual(JS.stepShopJob(S, {}).events, []);
});

T('D 돌봄 끝 → 육종(처음) · 쉬는 돌봄 — 새 맡김 없음 · 기한 날 마무리', () => {
  const S = shopEnded(); SW.switchJob(S, 'care', { spots7: SPOTS7 });
  const Jc = JC.jobCareOf(S); const r0 = Jc.requests[0];
  assert.ok(r0, '첫 맡김이 없다');
  r0.savedOn = 401; r0.dueOn = 405;   /* 나았지만 안 돌려준 맡김 — 기한 날 손님이 수고비를 내고 받아 간다 */
  Jc.saved = 30; Jc.milestones = { 3: 401, 10: 401, 30: 401 }; S.story.jobs.care.endedOn = 402; S.day = 402;
  const r = SW.switchJob(S, 'breed');
  assert.deepStrictEqual(ids(r), ['job_start', 'breed_open']);
  assert.ok(JB.isBreedJob(S) && JB.jobBreedOf(S).openedOn === 402);
  assert.strictEqual(JC.careRestingOpen(S), true);
  Jc.nextDay = 403;
  const evs = [];
  for (let d = 0; d < 6; d++) { S.day += 1; evs.push(...JC.stepCareJob(S, { spots7: SPOTS7 }).events); }
  assert.ok(!evs.some(e => e.id === 'care_new'), '쉬는 돌봄에 새 맡김');
  const ret = evs.find(e => e.id === 'care_return');
  assert.ok(ret && ret.auto && ret.won > 0 && ret.resting, '나은 맡김이 기한 날 수고비로 안 끝났다');
  assert.strictEqual(Jc.requests.length, 0); assert.strictEqual(JC.careRestingOpen(S), false);
  assert.ok(!evs.some(e => e.id === 'care_ending'), '끝맺음이 또 났다');
});

T('E 육종 끝 → 돌봄으로 돌아감 — back · 첫날 없음 · 옛 상태 · 새 맡김 다시 · 쉬는 육종은 안 적음', () => {
  const S = shopEnded(); SW.switchJob(S, 'care', { spots7: SPOTS7 });
  const Jc = JC.jobCareOf(S); Jc.saved = 30; Jc.served.push('x_keep'); S.story.jobs.care.endedOn = 402; S.day = 402;
  SW.switchJob(S, 'breed');
  const Jb = JB.jobBreedOf(S);
  /* 무늬 마디 삽수 하나 — 쉬는 동안 난 잎은 안 적는다 */
  const c = { id: 'c1', status: 'established', method: 'soil', varieFromCut: true, varieLightBand: 'mid', grewLeaves: 0, leafVarie: [true], leafGrade: ['sanban'], leaves: 1, slotId: 'x' };
  S.cuttings.push(c); S.day += 1; JB.stepBreedJob(S);
  Jb.varieties = [{ slot: 'a', day: 1, name: 'a' }, { slot: 'b', day: 1, name: 'b' }, { slot: 'c', day: 1, name: 'c' }];
  S.story.jobs.breed.endedOn = S.day;
  const r = SW.switchJob(S, 'care', { spots7: SPOTS7 });
  assert.strictEqual(r.back, true); assert.deepStrictEqual(ids(r), ['job_start'], '돌아간 날 첫날 사건이 났다');
  assert.strictEqual(r.events[0].ko, '진로 — 식물 돌봄으로 돌아왔습니다'); assert.strictEqual(r.banner.title, '🪴 식물 돌봄으로 돌아왔습니다');
  assert.strictEqual(S.jobCare, Jc, '돌봄 상태가 바뀌었다'); assert.ok(Jc.served.includes('x_keep'));
  assert.deepStrictEqual(S.story.jobs.care, { since: 400, endedOn: 402 }, '돌봄 이력이 바뀌었다');
  /* 쉬는 육종 — 삽수가 잎을 내도 안 적는다 */
  const n0 = Jb.sampleCount;
  c.leafVarie.push(true); c.leafGrade.push('halfmoon'); c.grewLeaves += 1; c.leaves += 1;
  S.day += 1; JB.stepBreedJob(S); assert.strictEqual(Jb.sampleCount, n0, '쉬는 육종이 표본을 적었다');
  /* 돌봄은 새 맡김이 다시 난다 */
  Jc.nextDay = S.day + 1; let got = false;
  for (let d = 0; d < 3 && !got; d++) { S.day += 1; got = ids(JC.stepCareJob(S, { spots7: SPOTS7 })).includes('care_new'); }
  assert.ok(got, '돌아간 돌봄에 새 맡김이 안 났다');
  /* 육종으로 다시 돌아오면 쉬는 동안 난 잎은 안 적는다(커서만) · 그 뒤 난 잎은 적는다 */
  Jc.requests = []; Jc.milestones[30] = 1;
  const r2 = SW.switchJob(S, 'breed');
  assert.strictEqual(r2.back, true); S.day += 1; JB.stepBreedJob(S);
  assert.strictEqual(Jb.sampleCount, n0, '쉬는 동안 난 잎을 돌아온 뒤 적었다');
  c.leafVarie.push(true); c.leafGrade.push('halfmoon'); c.grewLeaves += 1; c.leaves += 1;
  S.day += 1; JB.stepBreedJob(S); assert.strictEqual(Jb.sampleCount, n0 + 1, '돌아온 뒤 난 잎을 안 적었다');
});

T('F 처음 해 보는 가게(돌봄 뒤) — 첫 주문 손님은 돌봄 손님 · shop_open{boardKept}', () => {
  const S = newS(); JC.startCareJob(S); JC.openCare(S, { spots7: SPOTS7 });
  const Jc = JC.jobCareOf(S); Jc.served = regIds(12).slice(5); Jc.saved = 30; Jc.milestones = { 30: 390 }; S.story.jobs.care.endedOn = 391;
  SP.addSpeciesPot(S, 'pink_princess', { newPlant: { pinks: [0.3, 0.4, 0.5] }, origin: 'trade' });   /* 맞출 것 하나(첫 주문 원천) */
  const r = SW.switchJob(S, 'shop', {});
  assert.strictEqual(r.events[1].id, 'shop_open'); assert.strictEqual(r.events[1].boardKept, true);
  assert.strictEqual(r.events[1].ko, '창 옆 판을 이제 주문판으로 씁니다');
  const link = r.events.find(e => e.id === 'customer_link'), od = r.events.find(e => e.id === 'order_new');
  assert.ok(od, '첫 주문이 없다'); assert.ok(link && link.customerId === od.customerId && Jc.served.includes(od.customerId), '첫 주문 손님이 돌봄 손님이 아니다');
  assert.ok(/— 화분을 맡겼던 손님이 주문하러 왔다\.$/.test(link.ko), link.ko);
  /* 판이 없던 판(화면이 boardKept:false) — 예전 글 */
  const S2 = newS(); JC.startCareJob(S2); S2.story.jobs.care.endedOn = 391;
  const r2 = SW.switchJob(S2, 'shop', { boardKept: false });
  assert.ok(!r2.events[1].boardKept && r2.events[1].ko === '창 옆에 작은 주문판을 걸었습니다');
  assert.ok(!r2.events.some(e => e.id === 'customer_link'), '돌봄 손님이 없는데 이음 줄');
});

T('G 간판 한 자리 — 먼저 선 진로의 간판이 남고 뒤에 10 은 signKept · 스냅샷 signBy', () => {
  /* 돌봄 10 먼저 → 가게 10 */
  const S = newS(); JC.startCareJob(S); const Jc = JC.jobCareOf(S); Jc.signOnDay = 200; S.story.jobs.care.endedOn = 300; S.day = 301;
  SW.switchJob(S, 'shop', { boardKept: true });
  const J = JS.jobShopOf(S); J.regulars = regIds(9); J.milestones = { 3: 302 };
  J.orders = [{ id: 'od_x', customerId: regIds(10)[9], kind: 'al_corm', need: {}, tier: 'easy', openedOn: 301, dueOn: 330, premium: 1.3, repeat: false }];
  S.shop.stock.al_corm = 1;
  const d = JS.deliverOrder(S, 'od_x', { type: 'cormStock', id: 'al_corm' });
  const ms = d.events.find(e => e.id === 'regulars_milestone' && e.n === 10);
  assert.ok(ms && ms.signKept === true, '가게 10 에 signKept 가 없다');
  assert.ok(!d.events.some(e => e.id === 'shop_sign'), '간판이 이미 서 있는데 shop_sign');
  assert.strictEqual(J.signOnDay, 301); assert.strictEqual(JS.jobShopSnapshot(S).signBy, 'care');
  /* 가게 10 먼저 → 돌봄 10(settle) */
  const T2 = shopEnded(); SW.switchJob(T2, 'care', { spots7: SPOTS7 });
  const Jc2 = JC.jobCareOf(T2); Jc2.saved = 9; Jc2.milestones = { 3: 401 };
  const req = Jc2.requests[0]; req.savedOn = 401;
  const rr = JC.returnCare(T2, req.id);
  const m10 = rr.events.find(e => e.id === 'care_milestone' && e.n === 10);
  assert.ok(m10 && m10.signKept === true, '돌봄 10 에 signKept 가 없다');
  assert.strictEqual(JS.jobShopSnapshot(T2).signBy, 'shop');
  /* 첫 진로 판 — 예전 그대로 */
  const U = newS(); JS.startShopJob(U); const Ju = JS.jobShopOf(U); Ju.regulars = regIds(9);
  Ju.orders = [{ id: 'od_y', customerId: regIds(10)[9], kind: 'al_corm', need: {}, tier: 'easy', openedOn: 1, dueOn: 999, premium: 1.3, repeat: false }];
  U.shop.stock.al_corm = 1;
  const du = JS.deliverOrder(U, 'od_y', { type: 'cormStock', id: 'al_corm' });
  assert.ok(du.events.some(e => e.id === 'shop_sign') && !du.events.find(e => e.id === 'regulars_milestone' && e.n === 10).signKept);
  assert.strictEqual(JS.jobShopSnapshot(U).signBy, 'shop'); assert.strictEqual(JS.jobShopSnapshot(newS()).signBy, null);
});

T('H 마지막 덮개 — 셋 다 끝맺음 뒤 한 번 · 세이브 왕복', () => {
  const S = shopEnded(); SW.switchJob(S, 'care', { spots7: SPOTS7 }); S.story.jobs.care.endedOn = 410; S.day = 411;
  SW.switchJob(S, 'breed');
  assert.strictEqual(SW.finalCoverDue(S), false); assert.deepStrictEqual(SW.markFinalCover(S).events, []);
  S.story.jobs.breed.endedOn = 500; S.day = 501;
  assert.strictEqual(SW.jobsEndedAll(S), true); assert.strictEqual(SW.finalCoverDue(S), true);
  assert.deepStrictEqual(SW.markFinalCover(S).events, [{ id: 'final_cover' }]);
  assert.strictEqual(S.story.finalCoverOn, 501); assert.deepStrictEqual(SW.markFinalCover(S).events, [], '덮개가 두 번');
  assert.deepStrictEqual(SW.jobTitles(S).map(t => t.title), ['동네 식물 가게', '동네 식물 의사', '무늬 육종가']);
  assert.deepStrictEqual(SW.switchCards(S).map(c => c.mark), ['ended', 'ended', 'current']);
  assert.strictEqual(SW.switchCards(S)[0].go, '돌아간다');
  /* 세이브 왕복 — 진로 이력 · 바꾼 자국 · 덮개 날 */
  const G = newState({ room: 'banjiha', mode: 'novice' });
  G.story = { ...G.story, job: { id: 'breed', since: 411 }, jobs: JSON.parse(JSON.stringify(S.story.jobs)), jobSwitches: S.story.jobSwitches, finalCoverOn: 501 };
  const back = deserialize(JSON.parse(JSON.stringify(serialize(G))), { allowMissingGrowth: true });
  assert.deepStrictEqual(back.story.jobs, S.story.jobs); assert.deepStrictEqual(back.story.jobSwitches, S.story.jobSwitches);
  assert.strictEqual(back.story.finalCoverOn, 501); assert.deepStrictEqual(back.story.job, { id: 'breed', since: 411 });
  const old = newState({ room: 'banjiha', mode: 'novice' });
  const ob = deserialize(JSON.parse(JSON.stringify(serialize(old))), { allowMissingGrowth: true });
  assert.strictEqual(ob.story.finalCoverOn, null); assert.deepStrictEqual(ob.story.jobSwitches, []);
});

console.log(bad ? `job_switch: FAIL (${bad})` : 'job_switch: PASS');
process.exit(bad ? 1 : 0);
