/* tools/test_job_care.mjs — 진로 «식물 돌봄» 코어(src/game/job_care.js · 총괄 D73 · D80 · plan-care-career-spec §8) — 노드만 · 진짜 growth 규칙
   A 진로 고르기 — story.job 'care' · 진로 이력 · 한 판에 하나(가게 뒤 돌봄 못 고름) · hasJob · movedHome(진로 공통)
   B 돌봄 첫날 — care_open · 첫 맡김(오늘 고칠 수 있는 쉬움 하나) · 맡은 그루는 가방 · q.care · 못 판다 · 손님 말 기록 줄
   C 원천 — 살린 수로 열리는 고장 · 철 · 가드(7일 평균 자리 빛 · 고칠 자리 없으면 안 냄 · 겨울 등) · special 손님 안 뽑힘 · 최대 3
   D 고장마다 «고치는 손»으로 걸어 낫는다(진짜 규칙) — CA 알맞은 빛 · PP 끝 자르기 · PP 분홍(자르고 밝은 데) · AL 깨우기 · SC 높은 데 · SC 무늬(밝은 데)
   E [돌려준다] — 수고비(시세 × 웃 몫 · 바닥) · 살린 수 · 갈래 · 이정표 3 · 첫 돌려줌 · 못 고친 맡김은 못 돌려줌
   F 기한 — 못 고침 → 손님이 찾아감(벌 없음) · 나았는데 안 돌려줌 → 수고비 내고 받아 감(auto) · 막힘 한 줄(7일 · 한 번)
   G 끝맺음(살린 30 다음 날 아침 한 번) · 칭호 · 머리 글 · 스냅샷 · 세이브 왕복 · 옛 세이브(돌봄 칸 없음) */
import assert from 'node:assert';
import * as JS from '../src/game/job_shop.js';
import * as JC from '../src/game/job_care.js';
import * as SP from '../src/game/species.js';

let bad = 0;
const T = (name, fn) => { try { fn(); console.log('PASS ', name); } catch (e) { bad++; console.log('FAIL ', name, '\n     ', e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e); } };
const newS = (o = {}) => ({ day: 100, sim: { seed: 11, yearDay0: 0 }, story: {}, home: { room: 'tworoom' }, cuttings: [], pots: [], shop: { stock: {} },
                            tutorial: { lamp: { placed: 0 } }, lamps: { count: 0 }, ...o });
/* 투룸 결 자리(7일 평균 dli · dropM) — 어두움 · 칼라테아 가운데 · 밝음 · 높은 자리 */
const SPOTS7 = [{ dropM: 0.02, dli: 0.6 }, { dropM: 0.41, dli: 5 }, { dropM: 0.45, dli: 6.5 }, { dropM: 0.794, dli: 7.5 }, { dropM: 0.81, dli: 12 }];
const careS = (o = {}) => { const S = newS(o); JC.startCareJob(S); return S; };
const openC = (o = {}, ctx = { spots7: SPOTS7 }) => { const S = careS(o); const r = JC.openCare(S, ctx); return { S, r }; };
const sum = q => SP.speciesRules().summary(q.plant);
let dayNo = 2000;
/* 그 그루를 자리(받침 dropM · 빛 dli)에 놓고 하루씩 — 다른 그루는 그날 빛이 없어 건너뜀 */
const walk = (S, q, { dropM = 0.45, dli = 5, season = 'spring', until = null, max = 200 } = {}) => {
  SP.setSpeciesAt(S, q.id, { slotId: 'w:' + q.id, at: { x: 0, y: dropM, z: 0 }, dropM });
  for (let d = 0; d < max; d++) {
    if (until && until()) return d;
    SP.stepSpecies(S, { day: dayNo++, season, lightOf: x => x === q ? dli : null, dropOf: () => dropM });
  }
  if (until && !until()) throw new Error(`${max}일 걸어도 안 됐다`);
  return max;
};
const reqOf = (S, id) => JC.jobCareOf(S).requests.find(r => r.id === id);
/* 고장 하나를 손으로 맡긴다(원천·가드 밖에서 그 고장 그루를 바로 받기) */
const take = (S, problem) => {
  const p = JC.careProblemOf(problem);
  const J = JC.jobCareOf(S); const before = J.requests.length;
  /* 그 고장 하나만 원천으로 두고 맡김을 굴린다 */
  const all = JC.careProblems();
  JC.installCareProblems({ problems: [{ ...p, unlockAtSaved: 0, seasons: ['spring', 'summer', 'autumn', 'winter'] }], _lines: JC.careLines() });
  try { J.nextDay = S.day; S.day += 0; const ev = JC.stepCareJob(S, { spots7: SPOTS7, lamps: 3 }).events; void ev; }
  finally { JC.installCareProblems({ problems: all, _lines: JC.careLines() }); }
  assert.strictEqual(J.requests.length, before + 1, `${problem} 맡김이 안 섰다`);
  return J.requests[J.requests.length - 1];
};

T('A 진로 고르기 — care · 이력 · 하나만 · hasJob · movedHome', () => {
  const S = newS();
  const r = JC.startCareJob(S);
  assert.deepStrictEqual(r.events.map(e => [e.id, e.job]), [['job_start', 'care']]);
  assert.strictEqual(S.story.job.id, 'care'); assert.deepStrictEqual(S.story.jobs.care, { since: 100, endedOn: null });
  assert.ok(JC.isCareJob(S) && JS.hasJob(S) && JS.movedHome(S) && !JS.isShopJob(S));
  assert.throws(() => JC.startCareJob(S)); assert.throws(() => JS.startShopJob(S), '돌봄 뒤 가게를 또 열었다(D73 ① 한 판에 하나)');
  const S2 = newS(); JS.startShopJob(S2); assert.throws(() => JC.startCareJob(S2), '가게 뒤 돌봄을 골랐다');
});

T('B 돌봄 첫날 — 맡김판 · 첫 맡김(쉬움) · 가방 · 못 판다 · 기록 줄', () => {
  const { S, r } = openC();
  const ids = r.events.map(e => e.id);
  assert.deepStrictEqual(ids, ['care_open', 'care_new'], ids.join(','));
  const ev = r.events[1], req = reqOf(S, ev.requestId), q = SP.speciesPotOf(S, ev.potId);
  assert.strictEqual(ev.problem, 'ca_bright', '첫 맡김은 칼라테아 너무 밝음(자리가 있으면)');
  assert.ok(q && q.care && q.care.requestId === req.id && !SP.speciesPlaced(q), '맡은 그루가 가방에 q.care 로 안 왔다');
  assert.ok(/ — /.test(ev.ko) && ev.ko.includes(JC.careProblemOf('ca_bright').clue), ev.ko);
  assert.ok(/맡은 화분/.test(SP.speciesSellBlockedReason(q) || ''), '맡은 그루를 판다');
  assert.strictEqual(req.dueOn - req.openedOn, 21, '쉬움 기한 21');
  assert.strictEqual(JC.openCare(S).events.length, 0, '두 번 열렸다');
  /* 칼라테아 자리가 없으면(7일 평균이 다 너무 밝거나 어두움) → al_dark → pp_tip */
  const S2 = careS(); const r2 = JC.openCare(S2, { spots7: [{ dropM: 0.4, dli: 0.5 }] });
  assert.strictEqual(r2.events[1].problem, 'pp_tip', '칼라테아·AL 고칠 자리 없는 판의 첫 맡김');
  const S3 = careS(); const r3 = JC.openCare(S3, { spots7: [{ dropM: 0.4, dli: 12 }] });   /* 칼라테아엔 너무 밝고(over) AL 엔 어둡지 않은 자리뿐 */
  assert.strictEqual(r3.events[1].problem, 'al_dark', '칼라테아 자리 없고 AL 자리 있는 판');
});

T('C 원천 — 열림 · 철 · 가드 · 최대 3 · special 손님 없음', () => {
  const S = careS();
  const ids = JC.careSources(S, { spots7: SPOTS7, lamps: 0 }).map(p => p.id).sort();
  assert.deepStrictEqual(ids, ['al_dark', 'ca_bright', 'pp_tip'], '살린 0 — 손 셋 하나씩: ' + ids.join(','));
  S.jobCare.saved = 6;
  const six = JC.careSources(S, { spots7: SPOTS7, lamps: 0 }).map(p => p.id).sort();
  assert.ok(['pp_green', 'sc_floor', 'sc_plain', 'ca_dark'].every(x => six.includes(x)), '살린 6 에 열려야 할 것: ' + six.join(','));
  assert.ok(!six.includes('al_winter'), '봄(yearDay 100)에 겨울잠 맡김');
  /* 겨울 · 등 0 — 칼라테아 · 분홍 · 무늬는 못 고친다(growth 표) */
  const W = careS({ day: 300 }); W.jobCare.saved = 6;
  const w0 = JC.careSources(W, { spots7: SPOTS7.map(s => ({ ...s, dli: s.dli * 0.3 })), lamps: 0 }).map(p => p.id);
  assert.ok(!w0.includes('ca_bright') && !w0.includes('pp_green') && !w0.includes('sc_plain'), '겨울 등 0 에 고칠 수 없는 맡김: ' + w0.join(','));
  assert.ok(w0.includes('pp_tip') && w0.includes('al_winter'), '가위·기다림은 겨울에도: ' + w0.join(','));
  assert.deepStrictEqual(JC.careSources(careS(), {}).map(p => p.id), ['pp_tip'], '자리를 모르면 자리가 드는 고장은 안 낸다');
  /* 굴려 보기 — 최대 3 · special 손님 없음 */
  const { S: R } = openC(); R.jobCare.saved = 6;
  const seen = new Set();
  for (let d = 0; d < 120; d++) { R.day += 1; JC.stepCareJob(R, { spots7: SPOTS7, lamps: 2 }); assert.ok(R.jobCare.requests.length <= 3, '열린 맡김이 셋을 넘었다'); for (const q of R.jobCare.requests) seen.add(q.customerId); }
  assert.ok(!seen.has('sc_seeker') && !seen.has('ca_owner'), 'special 손님이 맡김 손님으로');
});

T('D 고장마다 «고치는 손»으로 걸으면 낫는다(진짜 규칙)', () => {
  const S = careS(); JC.openCare(S, { spots7: [] });
  const out = {};
  const heal = (problem, fixFn) => {
    const r = take(S, problem), q = SP.speciesPotOf(S, r.potId);
    assert.strictEqual(JC.careHealed(q, r), false, `${problem} 맡자마자 나음`);
    const days = fixFn(q, r);
    assert.ok(JC.careHealed(q, r), `${problem} 고치는 손으로 걸었는데 안 나음`);
    out[problem] = days;
    S.day += 1; JC.stepCareJob(S, {}); JC.returnCare(S, r.id);   /* 나은 날 → 돌려준다(열린 맡김 셋 한도를 비움) */
  };
  heal('ca_bright', q => walk(S, q, { dli: 5, until: () => sum(q).curled === 0 }));
  heal('ca_dark', q => walk(S, q, { dli: 4, until: () => sum(q).curled === 0 }));
  heal('pp_tip', (q) => { const n = SP.ppCuttableNodes(q)[0]; const r = SP.cutSpecies(S, q.id, n.no); assert.ok(r.careCut && r.saved, '맡은 PP 끝 자르기가 끝을 못 살림'); return 0; });
  heal('pp_green', (q, r) => { const n = SP.ppCuttableNodes(q).find(x => x.grade !== 'green' && x.no === 2) || SP.ppCuttableNodes(q)[1]; SP.cutSpecies(S, q.id, n.no);
                               return walk(S, q, { dli: 7, until: () => JC.careHealed(q, r), max: 60 }); });
  heal('al_dark', (q, r) => walk(S, q, { dli: 4, until: () => JC.careHealed(q, r), max: 60 }));
  heal('sc_floor', (q, r) => walk(S, q, { dropM: 0.794, dli: 6, until: () => JC.careHealed(q, r), max: 40 }));
  heal('sc_plain', (q, r) => walk(S, q, { dropM: 0.794, dli: 6, until: () => JC.careHealed(q, r), max: 60 }));
  console.log('      고친 날(봄 · 고치는 손) —', JSON.stringify(out));
  /* 잘못된 손 — 칼라테아를 너무 밝은 데 두면 안 낫는다 · 바닥 SC 를 낮은 데 두면 안 낫는다 */
  const r1 = take(S, 'ca_bright'), q1 = SP.speciesPotOf(S, r1.potId);
  walk(S, q1, { dli: 12, max: 30 }); assert.ok(!JC.careHealed(q1, r1), '너무 밝은 데서 칼라테아가 나음');
  const r2 = take(S, 'sc_floor'), q2 = SP.speciesPotOf(S, r2.potId);
  walk(S, q2, { dropM: 0.3, dli: 6, max: 30 }); assert.ok(!JC.careHealed(q2, r2), '낮은 데서 바닥 SC 가 나음');
});

T('E [돌려준다] — 수고비 · 살린 수 · 갈래 · 이정표 · 못 고친 것은 못 돌려줌', () => {
  const { S, r } = openC();
  const req = reqOf(S, r.events[1].requestId), q = SP.speciesPotOf(S, req.potId);
  assert.throws(() => JC.returnCare(S, req.id), /아직 낫지/);
  walk(S, q, { dli: 5, until: () => sum(q).curled === 0 });
  S.day += 1; const ev = JC.stepCareJob(S, { spots7: SPOTS7 }).events;
  assert.ok(ev.some(e => e.id === 'care_saved' && e.requestId === req.id), '나은 날 care_saved 가 안 났다');
  const price = SP.speciesPriceOf(q).won;
  const ret = JC.returnCare(S, req.id);
  assert.strictEqual(ret.won, Math.max(JC.CARE_JOB.feeFloorWon, Math.round(price * 0.3)), `수고비 ${ret.won} · 시세 ${price}`);
  assert.ok(ret.events[0].id === 'care_return' && ret.events[0].first === true && /받아 갔다/.test(ret.events[0].ko));
  assert.strictEqual(SP.speciesPotOf(S, req.potId), null, '돌려준 그루가 남았다');
  assert.strictEqual(S.jobCare.saved, 1); assert.deepStrictEqual(S.jobCare.kinds, { ca_bright: 1 });
  /* 이정표 3 */
  S.jobCare.saved = 2;
  const r2 = take(S, 'pp_tip'); const q2 = SP.speciesPotOf(S, r2.potId); SP.cutSpecies(S, q2.id, SP.ppCuttableNodes(q2)[0].no);
  S.day += 1; JC.stepCareJob(S, {});
  const ret2 = JC.returnCare(S, r2.id);
  assert.ok(ret2.events.some(e => e.id === 'care_milestone' && e.n === 3), '살린 3 이정표');
  /* 갓 깬 AL(잎 적음) — 수고비 바닥 */
  assert.ok(JC.CARE_JOB.feeFloorWon > 0);
});

T('F 기한 — 못 고침은 찾아감 · 나았는데 안 돌려줌은 수고비 내고 받아 감 · 막힘 한 줄', () => {
  const { S, r } = openC();
  const id = r.events[1].requestId, req = reqOf(S, id);
  let stuck = 0, exp = null;
  for (let d = 0; d < 30; d++) { S.day += 1; const ev = JC.stepCareJob(S, { spots7: SPOTS7 }).events;
    stuck += ev.filter(e => e.id === 'care_stuck' && e.requestId === id).length; exp = exp || ev.find(e => e.id === 'care_expired' && e.requestId === id); }
  assert.strictEqual(stuck, 1, `막힘 한 줄이 ${stuck}번`);
  assert.ok(exp && /찾아갔다/.test(exp.ko), '기한 날 찾아가지 않았다');
  assert.strictEqual(SP.speciesPotOf(S, req.potId), null); assert.strictEqual(S.jobCare.saved, 0); assert.ok(S.jobCare.expired >= 1, '찾아간 수를 안 셈');
  /* 나았는데 안 돌려줌 */
  const { S: S2, r: r2 } = openC(); const req2 = reqOf(S2, r2.events[1].requestId), q2 = SP.speciesPotOf(S2, req2.potId);
  walk(S2, q2, { dli: 5, until: () => sum(q2).curled === 0 });
  let auto = null; for (let d = 0; d < 30 && !auto; d++) { S2.day += 1; auto = JC.stepCareJob(S2, { spots7: SPOTS7 }).events.find(e => e.id === 'care_return' && e.auto); }
  assert.ok(auto && auto.won >= JC.CARE_JOB.feeFloorWon, '나은 맡김을 기한 날 수고비 내고 안 받아 감');
  assert.strictEqual(S2.jobCare.saved, 1);
});

T('G 끝맺음 · 칭호 · 머리 · 스냅샷 · 세이브 · 옛 세이브', () => {
  const { S } = openC();
  assert.deepStrictEqual(JC.careHeadOf(S), { title: null, saved: 0, ko: '식물 돌봄 · 살린 화분 0' });
  S.jobCare.saved = 30; S.jobCare.milestones[30] = S.day;
  assert.ok(!JC.stepCareJob(S, {}).events.some(e => e.id === 'care_ending'), '이정표 그날 끝맺음');
  S.day += 1; const e = JC.stepCareJob(S, {}).events.find(x => x.id === 'care_ending');
  assert.ok(e && e.title === '동네 식물 의사', JSON.stringify(e));
  assert.strictEqual(JC.careEndedOn(S), S.day); assert.strictEqual(JC.careHeadOf(S).ko, '동네 식물 의사 · 살린 화분 30');
  S.day += 1; assert.ok(!JC.stepCareJob(S, {}).events.some(x => x.id === 'care_ending'), '두 번');
  assert.strictEqual(JS.jobShopSnapshot(S).jobsEnded.care, S.day - 1);
  const snap = JC.jobCareSnapshot(S);
  assert.deepStrictEqual(Object.keys(snap).sort(), ['careDueSoonest', 'careKinds', 'careOpen', 'careReady', 'careSaved']);
  const back = JC.unpackJobCare(JSON.parse(JSON.stringify(JC.packJobCare(S.jobCare))));
  assert.deepStrictEqual(back, S.jobCare);
  assert.deepStrictEqual(JC.unpackJobCare(null), JC.createJobCareState());
  assert.strictEqual(JC.jobCareSnapshot(newS()).careSaved, null, '돌봄 판이 아닌데 수');
  /* 맡은 그루 칸(q.care · requestId · cutSaved)이 세이브 왕복에서 산다 */
  const q = SP.speciesPotsOf(S).find(x => x.care);
  if (q) { const sp = SP.unpackSpecies(JSON.parse(JSON.stringify(SP.packSpecies(S.species)))); assert.deepStrictEqual(sp.pots.find(x => x.id === q.id).care, q.care); }
});

console.log(bad ? `job_care: FAIL (${bad})` : 'job_care: PASS');
process.exit(bad ? 1 : 0);
