/* tools/test_job_breed.mjs — 진로 «무늬 육종» 코어(src/game/job_breed.js · 총괄 D74 · D83 · plan-breed-career-spec §8) — 노드만
   표본은 «결과가 굴려진 그 값»을 읽는다 — 이 검사는 굴린 뒤의 칸(삽수 leafVarie/leafGrade · PP 잎 pink · AL phase/varie/origin)을 손으로 세워
   재현 판정을 못 박는다(굴림 자체는 propagation · species_growth 검사 몫).
   A 진로 — breed · 이력 · 한 판에 하나 · hasJob · movedHome
   B 연 날 — breed_open · 들고 온 그루의 이미 난 잎은 안 적는다(커서만)
   C 몬스테라 — 같은 뿌리 밝기 · 서로 다른 삽수 셋 하프문 = 등록 대기 · 둘 = 후보(한 번) · 같은 삽수 두 번은 하나 · 다른 밝기는 따로 · 셈(tally)
   D 등록 — 이름(빈 이름은 자동 «볕 하프문 1호») · 상금 = 하프문 잎 값 · 이정표 1 · 다음 자동 이름 차례
   E PP 줄 — 분홍 많음 잇달아 셋 · 분홍 많음이 아닌 잎(마블·분홍 잎·초록)은 다 끊음(D86 ③) · 잘라 낸 끝은 어미 줄
   F AL — 무늬 어미(마블) 셋 = 등록 대기 · 무지 어미·상점은 안 셈 · 출처 낱말(from_ 뗌)
   G 끝맺음 — 품종 셋 다음 날 아침 한 번 · 칭호 · 머리 글
   H 스냅샷 · 세이브 왕복 · 옛 세이브(칸 없음) · 낱줄 60 · 상점 PP 진열(육종 판 · PP 없음) */
import assert from 'node:assert';
import * as JS from '../src/game/job_shop.js';
import * as JB from '../src/game/job_breed.js';
import * as SP from '../src/game/species.js';

let bad = 0;
const T = (name, fn) => { try { fn(); console.log('PASS ', name); } catch (e) { bad++; console.log('FAIL ', name, '\n     ', e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e); } };
const newS = (o = {}) => ({ day: 400, sim: { seed: 11, yearDay0: 0 }, story: {}, home: { room: 'tworoom' }, cuttings: [], pots: [], shop: { stock: {} },
                            tutorial: { lamp: { placed: 0 } }, lamps: { count: 0 }, log: [], ...o });
const breedS = (o = {}) => { const S = newS(o); JB.startBreedJob(S); return S; };
const day = (S) => { S.day += 1; return JB.stepBreedJob(S); };
/* 무늬 마디 삽수 하나(뿌리 밝기 정해짐) */
const cut = (S, id, band, carried = 1) => { const c = { id, status: 'established', method: 'soil', varieFromCut: true, varieLightBand: band, grewLeaves: 0,
  leafVarie: Array(carried).fill(true), leafGrade: Array(carried).fill('sanban'), leaves: carried, variegatedLeaves: carried, slotId: 'x:' + id }; S.cuttings.push(c); return c; };
const grow = (c, varie, grade) => { c.leafVarie.push(varie); c.leafGrade.push(varie ? grade : null); c.grewLeaves += 1; c.leaves += 1; };
const ppPot = (S, pinks, opt = {}) => SP.addSpeciesPot(S, 'pink_princess', { newPlant: { pinks }, origin: opt.origin || 'trade', ...(opt.motherId ? { motherId: opt.motherId } : {}) });
const ppLeaf = (q, pink) => { const p = q.plant; const no = (p.leaves.length ? p.leaves[p.leaves.length - 1].no : 0) + 1; p.leaves.push({ no, born: 0, stage: p.leaves[0].stage, pink }); p.nodes = no; };
const alPot = (S, origin, motherKind = null) => SP.addSpeciesPot(S, 'alocasia_frydek', { origin: 'corm', newPlant: { origin, motherKind } });
const sprout = (q, varie) => { q.plant.phase = 'growing'; q.plant.varie = varie; };
const ids = r => r.events.map(e => e.id);

T('A 진로 — breed · 이력 · 하나만 · hasJob · movedHome', () => {
  const S = newS();
  const r = JB.startBreedJob(S);
  assert.deepStrictEqual(r.events.map(e => [e.id, e.job]), [['job_start', 'breed']]);
  assert.strictEqual(S.story.job.id, 'breed'); assert.deepStrictEqual(S.story.jobs.breed, { since: 400, endedOn: null });
  assert.ok(JB.isBreedJob(S) && JS.hasJob(S) && JS.movedHome(S) && !JS.isShopJob(S));
  assert.throws(() => JB.startBreedJob(S)); assert.throws(() => JS.startShopJob(S), '육종 뒤 가게를 또 열었다(D73 ① 한 판에 하나)');
});

T('B 연 날 — breed_open · 들고 온 것의 이미 난 잎은 안 적는다', () => {
  const S = breedS();
  const c = cut(S, 'c1', 'bright'); grow(c, true, 'halfmoon'); grow(c, true, 'halfmoon');   /* 연 날 전에 난 잎 */
  const r = JB.openBreed(S);
  assert.deepStrictEqual(ids(r), ['breed_open']);
  assert.strictEqual(JB.openBreed(S).events.length, 0, '두 번 열렸다');
  const d = day(S);
  assert.strictEqual(JB.jobBreedOf(S).sampleCount, 0, '연 날 전 잎을 적었다');
  assert.ok(!ids(d).includes('breed_sample'));
  grow(c, true, 'halfmoon'); const d2 = day(S);
  assert.strictEqual(JB.jobBreedOf(S).sampleCount, 1, '오늘 난 잎을 안 적었다');
  assert.deepStrictEqual(d2.events.filter(e => e.id === 'breed_sample').map(e => [e.line, e.first]), [['monstera', true]]);
  assert.ok(/밝은 데서 뿌리 낸 삽수 · 하프문/.test(d2.events.find(e => e.id === 'breed_sample').ko));
});

T('C 몬스테라 — 같은 밝기 서로 다른 삽수 셋 · 후보 둘 · 같은 삽수는 하나 · 다른 밝기 따로', () => {
  const S = breedS(); JB.openBreed(S);
  const a = cut(S, 'a', 'bright'), b = cut(S, 'b', 'bright'), m = cut(S, 'm', 'mid'), c = cut(S, 'c', 'bright');
  grow(a, true, 'halfmoon'); grow(a, true, 'halfmoon'); day(S);                         /* 같은 삽수 둘 — 하나로 */
  const J = JB.jobBreedOf(S);
  assert.strictEqual(J.repro.monstera_halfmoon.bright.n, 1);
  grow(m, true, 'halfmoon'); day(S);                                                     /* 중간은 따로 */
  assert.strictEqual(J.repro.monstera_halfmoon.mid.n, 1); assert.strictEqual(J.repro.monstera_halfmoon.bright.n, 1);
  grow(b, true, 'halfmoon'); const d = day(S);
  assert.ok(ids(d).includes('breed_candidate'), '둘째에 후보가 안 났다');
  assert.strictEqual(d.events.find(e => e.id === 'breed_candidate').slot, 'monstera_halfmoon');
  grow(b, true, 'halfmoon'); assert.ok(!ids(day(S)).includes('breed_candidate'), '후보가 두 번 났다');
  grow(a, false); grow(c, true, 'sanban'); day(S);
  assert.strictEqual(J.pending.length, 0, '산반·무지가 하프문 칸을 채웠다');
  grow(c, true, 'halfmoon'); day(S);
  assert.deepStrictEqual(J.pending.map(p => [p.slot, p.cond, p.auto]), [['monstera_halfmoon', 'bright', '볕 하프문 1호']]);
  assert.deepStrictEqual(J.tally.monstera.bright, { halfmoon: 5, plain: 1, sanban: 1 });
  grow(c, true, 'halfmoon'); day(S); assert.strictEqual(J.pending.length, 1, '대기 칸이 또 섰다');
});

T('D 등록 — 이름 · 자동 이름 · 상금(잎 한 장 값) · 이정표 1 · 다음 차례', () => {
  const S = breedS(); JB.openBreed(S);
  for (const id of ['a', 'b', 'c']) { const k = cut(S, id, 'bright'); grow(k, true, 'halfmoon'); }
  for (const id of ['d', 'e', 'f']) { const k = cut(S, id, 'bright'); grow(k, true, 'fullmoon'); }
  day(S);
  const J = JB.jobBreedOf(S);
  assert.deepStrictEqual(J.pending.map(p => [p.slot, p.auto]), [['monstera_halfmoon', '볕 하프문 1호'], ['monstera_fullmoon', '볕 풀문 2호']]);
  assert.throws(() => JB.registerBreed(S, 'pp_heavy', 'x'), '대기 없는 칸이 등록됐다');
  const r = JB.registerBreed(S, 'monstera_fullmoon', '  ');
  assert.strictEqual(r.won, 1_150_000, `풀문 상금 ${r.won}`);
  assert.deepStrictEqual(ids(r), ['breed_register', 'breed_milestone']);
  assert.strictEqual(r.events[0].name, '볕 풀문 2호', '빈 이름이 자동 이름으로 안 갔다');
  assert.deepStrictEqual(J.pending.map(p => p.auto), ['볕 하프문 2호'], '남은 칸의 자동 이름이 등록 차례를 안 따랐다');
  const r2 = JB.registerBreed(S, 'monstera_halfmoon', '창가의 반달');
  assert.strictEqual(r2.won, 750_000); assert.strictEqual(r2.events[0].name, '창가의 반달'); assert.deepStrictEqual(ids(r2), ['breed_register']);
  assert.ok(/🏷 새 품종 — 창가의 반달\(하프문 몬스테라\)/.test(r2.events[0].ko), r2.events[0].ko);
  assert.deepStrictEqual(JB.breedBoardRows(S).filter(x => x.registered).map(x => x.head), ['하프문 몬스테라 — 등록 · «창가의 반달»', '풀문 몬스테라 — 등록 · «볕 풀문 2호»']);
});

T('E PP 줄 — 분홍 많음 잇달아 셋 · 마블·분홍 잎·초록이 다 끊음(D86 ③) · 잘라 낸 끝은 어미 줄', () => {
  const S = breedS(); const q = ppPot(S, [0.3, 0.4]); JB.openBreed(S);
  const J = JB.jobBreedOf(S);
  ppLeaf(q, 0.7); ppLeaf(q, 0.7); day(S);
  const line = String(J.lines[q.id]);
  assert.strictEqual(J.repro.pp_heavy[line].n, 2);
  ppLeaf(q, 0.95); day(S); assert.strictEqual(J.repro.pp_heavy[line].n, 0, '분홍 잎이 줄을 안 끊었다');
  ppLeaf(q, 0.7); ppLeaf(q, 0.4); ppLeaf(q, 0.7); day(S);
  assert.strictEqual(J.repro.pp_heavy[line].n, 1, '마블이 줄을 안 끊었다(D86 ③ — 분홍 많음 아닌 잎이면 다 끊음)');
  ppLeaf(q, 0.02); day(S); assert.strictEqual(J.repro.pp_heavy[line].n, 0, '초록이 줄을 안 끊었다');
  /* 잘라 낸 끝(어미 q)은 같은 줄 · 교환 그루는 새 줄 */
  const top = ppPot(S, [0.7], { origin: 'cut', motherId: q.id }), other = ppPot(S, [0.3]);
  day(S);
  assert.strictEqual(J.lines[top.id], J.lines[q.id], '잘라 낸 끝이 어미 줄을 안 이었다');
  assert.notStrictEqual(J.lines[other.id], J.lines[q.id], '다른 그루가 같은 줄이 됐다');
  ppLeaf(top, 0.7); ppLeaf(top, 0.7); ppLeaf(top, 0.7); day(S);
  assert.deepStrictEqual(J.pending.map(p => [p.slot, p.cond]), [['pp_heavy', line]]);
  assert.ok(Object.keys(J.tally.pp).includes(line));
});

T('F AL — 무늬 어미(마블) 셋 · 무지 어미·상점은 안 셈 · 출처 낱말', () => {
  const S = breedS();
  const P = [alPot(S, 'from_varie_mother', 'marble'), alPot(S, 'from_varie_mother', 'marble'), alPot(S, 'from_plain_mother'), alPot(S, 'shop'), alPot(S, 'from_varie_mother', 'marble')];
  JB.openBreed(S);
  const J = JB.jobBreedOf(S);
  sprout(P[0], 'marble'); sprout(P[2], null); sprout(P[3], 'marble'); day(S);
  assert.deepStrictEqual(J.tally.al, { varie_mother: { marble: 1 }, plain_mother: { plain: 1 }, shop: { marble: 1 } });
  assert.strictEqual(J.repro.al_marble.marble.n, 1, '상점 마블이 무늬 어미 칸에 들었다');
  sprout(P[1], 'marble'); day(S); day(S);
  assert.strictEqual(J.repro.al_marble.marble.n, 2, '싹 하나를 두 번 셌다');
  sprout(P[4], 'marble'); day(S);
  assert.deepStrictEqual(J.pending.map(p => [p.slot, p.auto]), [['al_marble', '볕 마블 1호']]);
  assert.strictEqual(JB.registerBreed(S, 'al_marble', '').won, 300_000);
});

T('G 끝맺음 — 품종 셋 다음 날 아침 한 번 · 칭호 · 머리 글', () => {
  const S = breedS(); JB.openBreed(S);
  for (const [i, g] of ['halfmoon', 'halfmoon', 'halfmoon', 'fullmoon', 'fullmoon', 'fullmoon'].entries()) { const k = cut(S, 'k' + i, 'bright'); grow(k, true, g); }
  const q = ppPot(S, [0.3]); day(S); ppLeaf(q, 0.7); ppLeaf(q, 0.7); ppLeaf(q, 0.7); day(S);
  for (const p of [...JB.jobBreedOf(S).pending]) JB.registerBreed(S, p.slot, '');
  assert.strictEqual(JB.jobBreedOf(S).varieties.length, 3);
  assert.strictEqual(JB.breedHeadOf(S).title, null, '끝맺음 전에 칭호');
  const d = day(S);
  assert.ok(ids(d).includes('breed_ending'), '품종 셋 다음 날 끝맺음이 안 났다');
  assert.strictEqual(S.story.jobs.breed.endedOn, S.day);
  assert.ok(!ids(day(S)).includes('breed_ending'), '끝맺음이 두 번');
  assert.strictEqual(JB.breedHeadOf(S).title, '무늬 육종가');
  assert.strictEqual(JS.jobShopSnapshot(S).jobsEnded.breed, S.day - 1);
});

T('H 스냅샷 · 세이브 왕복 · 옛 세이브 · 낱줄 60 · 상점 PP 진열', () => {
  const S0 = newS(); assert.deepStrictEqual(JB.jobBreedSnapshot(S0), { breedSamples: null, breedLines: null, breedVarieties: null, breedBest: null });
  const S = breedS(); const q = ppPot(S, [0.3]); JB.openBreed(S);
  const a = cut(S, 'a', 'bright'), b = cut(S, 'b', 'bright');
  grow(a, true, 'halfmoon'); grow(b, true, 'halfmoon'); ppLeaf(q, 0.7); day(S);
  const snap = JB.jobBreedSnapshot(S);
  assert.deepStrictEqual(snap, { breedSamples: 3, breedLines: 2, breedVarieties: 0, breedBest: { slot: 'monstera_halfmoon', ko: '하프문 몬스테라', n: 2 } });
  const back = JB.unpackJobBreed(JSON.parse(JSON.stringify(JB.packJobBreed(S.jobBreed))));
  assert.deepStrictEqual(back, S.jobBreed, '세이브 왕복이 어긋났다');
  assert.deepStrictEqual(JB.unpackJobBreed(null), JB.createJobBreedState());
  for (let i = 0; i < 70; i++) grow(a, false); day(S);
  assert.strictEqual(S.jobBreed.samples.length, JB.BREED_JOB.samplesKeep, '낱줄이 60을 넘었다');
  assert.strictEqual(S.jobBreed.sampleCount, 73);
  assert.strictEqual(S.jobBreed.tally.monstera.bright.plain, 70, '셈이 낱줄과 같이 잘렸다');
  /* 상점 — 육종 판 · PP 없음이면 PP 어린 그루 진열 · PP 있으면 예전 규칙 */
  const S2 = breedS({ tutorial: { enabled: true, lamp: { placed: 0 } } });
  assert.strictEqual(SP.speciesShopOpen(S2, 'pp_young'), true, 'PP 없는 육종 판에 PP 진열이 없다');
  ppPot(S2, [0.3]); assert.strictEqual(SP.speciesShopOpen(S2, 'pp_young'), false, 'PP 가 있는데 진열이 섰다(교환 규칙 밖)');
  const S3 = newS({ tutorial: { enabled: true, lamp: { placed: 0 } } }); assert.strictEqual(SP.speciesShopOpen(S3, 'pp_young'), false, '육종 판이 아닌데 진열');
});

T('I turn.breedAlCormWaitDays — 찾을 수 있는 무늬 AL 이 깨어 있을 때만 · 연 날/마지막 찾은 날부터 · 칸이 차면 null', () => {
  const S = breedS(); const q = alPot(S, 'shop'); JB.openBreed(S);
  sprout(q, 'marble'); q.plant.finds = 0; q.plant.sinceFind = 1;
  S.day += 10; let r = JB.stepBreedJob(S);
  assert.strictEqual(r.alCormWaitDays, 10, `연 날부터 ${r.alCormWaitDays}`);
  q.plant.sinceFind = 0; assert.strictEqual(day(S).alCormWaitDays, null, '찾은 뒤 새 잎 0 인데 수가 났다');
  q.plant.sinceFind = 1; q.plant.phase = 'asleep'; assert.strictEqual(day(S).alCormWaitDays, null, '잠든 그루로 수가 났다');
  q.plant.phase = 'growing'; q.plant.finds = 2; assert.strictEqual(day(S).alCormWaitDays, null, '두 번 찾은 그루로 수가 났다');
  q.plant.finds = 1; S.species.n.alCormsFound = (S.species.n.alCormsFound || 0) + 2; const d0 = S.day + 1; day(S);
  S.day += 4; assert.strictEqual(JB.stepBreedJob(S).alCormWaitDays, S.day - d0, '마지막 찾은 날부터가 아니다');
  JB.jobBreedOf(S).pending.push({ slot: 'al_sector', cond: 'sector', day: S.day, auto: 'x' });
  assert.strictEqual(day(S).alCormWaitDays, null, 'AL 칸이 찼는데 수가 났다');
});

console.log(bad ? `job_breed: FAIL (${bad})` : 'job_breed: PASS');
process.exit(bad ? 1 : 0);
