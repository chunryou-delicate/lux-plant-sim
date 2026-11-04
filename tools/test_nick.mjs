/* F3 그루 이름 — 받는 글자 · 8자 · 비우면 원래 이름 · 세이브 왕복 · 몬스테라 이름 한 곳(core 11-03 · plan-ui-fun §F3 · 총괄)
   단언
     ㉮ 받는 글자: 한글 · 숫자 · 띄어쓰기만 · 띄어쓰기는 한 칸 · 앞뒤를 뗀다 · 영문 · 기호는 까닭과 함께 안 받는다
     ㉯ 8자까지 — 9자는 안 받는다
     ㉰ 비우면 원래 이름(nick 칸이 사라진다) · «몬스테라» · «몬스테라 2»
     ㉱ 몬스테라 이름은 한 곳(potNameOf) — 이름이 있으면 이름
     ㉲ 세이브 왕복 — 화분 · 삽수 · 새 종 이름이 그대로 · 이름 없는 그루는 칸이 없다(옛 세이브와 같은 바이트) · 깨진 이름은 안 싣는다
     ㉳ (plan da5daa9c) 낱자(ㄱ · ㅏ)는 따로 까닭 · 다른 그루가 쓰는 이름(붙인 · 원래)은 못 씀 · 원래 이름과 같은 글이면 이름 없음
     ㉴ 기록 줄 셋(지음 · 바꿈 · 지움) · 조사는 따옴표 밖 «(으)로»(«콩이»로 · «달»로 · «몬스테라 3»으로) · 바뀐 것이 없으면 기록 없음
   ⛔ 값 · 하네스 안 건드림 */
import assert from 'node:assert/strict';

const results = [];
const check = async (n, f) => { try { await f(); results.push(['PASS', n]); } catch (e) { results.push(['FAIL', n, e.message]); } };
let NICK = null, ST = null, SV = null, SP = null;
try { NICK = await import('../src/game/nick.js'); } catch (e) { results.push(['FAIL', '모듈 src/game/nick.js 를 못 읽음', e.message]); }
ST = await import('../src/game/state.js'); SV = await import('../src/game/save.js'); SP = await import('../src/game/species.js');

await check('㉮ 받는 글자 — 한글 · 숫자 · 띄어쓰기 · 한 칸으로 모음', () => {
  assert.ok(NICK, 'nick.js 없음');
  assert.deepEqual(NICK.cleanNick('콩이'), { ok: true, nick: '콩이', why: null });
  assert.equal(NICK.cleanNick('  초록  2호 ').nick, '초록 2호');
  assert.equal(NICK.cleanNick('몬1').nick, '몬1');
  for (const bad of ['Kong', '콩이!', '콩이a', 'ㅋㅋ', '콩.이']) { const r = NICK.cleanNick(bad); assert.ok(!r.ok && !!r.why, `★받으면 안 됨 — ${bad} ${JSON.stringify(r)}`); }
});
await check('㉯ 8자까지 — 9자는 안 받음', () => {
  assert.ok(NICK, 'nick.js 없음');
  assert.equal(NICK.NICK_MAX, 8);
  assert.equal(NICK.cleanNick('가나다라마바사아').nick, '가나다라마바사아');
  const r = NICK.cleanNick('가나다라마바사아자'); assert.ok(!r.ok && /8자/.test(r.why || ''), JSON.stringify(r));
});
await check('㉰ 비우면 원래 이름 — nick 칸이 사라짐 · «몬스테라» · «몬스테라 2»', () => {
  assert.ok(NICK, 'nick.js 없음');
  const p1 = { id: 'pot_01' }, p2 = { id: 'pot_02' };
  NICK.setNick(p2, '콩이'); assert.equal(p2.nick, '콩이');
  NICK.setNick(p2, '   '); assert.ok(!('nick' in p2), '★비웠는데 칸이 남음');
  assert.equal(NICK.potNameOf([p1], p1), '몬스테라');
  assert.equal(NICK.potNameOf([p1, p2], p2), '몬스테라 2');
  assert.throws(() => NICK.setNick(p2, 'Kong'), e => e.tutorialInput === true);
});
await check('㉱ 몬스테라 이름 한 곳 — 이름이 있으면 이름', () => {
  assert.ok(NICK, 'nick.js 없음');
  const p1 = { id: 'pot_01', nick: '콩이' }, p2 = { id: 'pot_02' };
  assert.equal(NICK.potNameOf([p1, p2], p1), '콩이');
  assert.equal(NICK.potNameOf([p1, p2], p2), '몬스테라 2');
  assert.equal(NICK.nameOr({ nick: '분홍이' }, '핑크프린세스'), '분홍이');
  assert.equal(NICK.nameOr({}, '핑크프린세스'), '핑크프린세스');
});
const roundTrip = (S) => SV.deserialize(SV.serialize(S), { allowMissingGrowth: true });
const baseS = () => {
  const S = ST.newState({ room: 'banjiha' });
  if (!S.pots.length) S.pots.push({ id: 'pot_01', plantId: 'monstera_deliciosa', variegated: false, daysPlanted: 3 });
  S.cuttings = [{ id: 'cut_01', cutOnDay: 5, source: { nodeId: 'n1', stem: 'main', leaves: 1, variegatedLeaves: 0 }, status: 'rooting', method: 'water', leafVarie: [false] }];
  SP.addSpeciesPot(S, 'pink_princess', { origin: 'shop' });
  return S;
};
await check('㉲ 세이브 왕복 — 화분 · 삽수 · 새 종 이름 그대로', () => {
  const S = baseS();
  S.pots[0].nick = '콩이'; S.cuttings[0].nick = '아기'; S.species.pots[0].nick = '분홍이';
  const back = roundTrip(S);
  assert.equal(back.pots[0].nick, '콩이', '★화분 이름을 잃음');
  assert.equal(back.cuttings[0].nick, '아기', '★삽수 이름을 잃음');
  assert.equal(back.species.pots[0].nick, '분홍이', '★새 종 이름을 잃음');
});
await check('㉲ 이름 없는 그루는 세이브에 칸이 없다(옛 세이브와 같은 바이트) · 깨진 이름은 안 싣는다', () => {
  const S = baseS();
  const raw0 = SV.serialize(S);
  assert.ok(!/"nick"/.test(raw0), '★이름 없는데 nick 칸을 적음');
  S.pots[0].nick = 'Kong!'; const back = roundTrip(S);
  assert.ok(!('nick' in back.pots[0]), `★깨진 이름을 실음 — ${back.pots[0].nick}`);
});

await check('㉳ 낱자 · 같은 이름 · 원래 이름과 같은 글', () => {
  assert.ok(NICK, 'nick.js 없음');
  const KO = NICK.NICK_KO || {};
  assert.equal(NICK.cleanNick('ㅋㅋ').why, 'ㄱ · ㅏ 같은 낱자는 못 씁니다');
  assert.equal(NICK.cleanNick('콩ㅣ').why, 'ㄱ · ㅏ 같은 낱자는 못 씁니다');
  assert.equal(NICK.cleanNick('Kong').why, '이름은 한글 · 숫자 · 띄어쓰기만 씁니다');
  assert.equal(NICK.cleanNick('콩이', { taken: ['콩이', '몬스테라 2'] }).why, '다른 그루가 쓰는 이름입니다');
  assert.equal(NICK.cleanNick('몬스테라 2', { taken: ['몬스테라 2'] }).why, '다른 그루가 쓰는 이름입니다');
  const r = NICK.cleanNick('몬스테라 2', { original: '몬스테라 2' }); assert.ok(r.ok && r.nick === null, JSON.stringify(r));
  assert.equal(KO.dup, '다른 그루가 쓰는 이름입니다');
});
await check('㉴ 기록 줄 셋 · 조사 따옴표 밖 · 바뀐 것 없으면 기록 없음', () => {
  assert.ok(NICK, 'nick.js 없음');
  const p = { id: 'pot_03' };
  const a = NICK.setNick(p, '콩이', { original: '몬스테라 3' });
  assert.equal(a.log, '✎ 몬스테라 3 이름을 «콩이»로 지었습니다');
  const b = NICK.setNick(p, '달', { original: '몬스테라 3' });
  assert.equal(b.log, '✎ «콩이» 이름을 «달»로 바꿨습니다');
  const c = NICK.setNick(p, '몬스테라 3호', { original: '몬스테라 3' });
  assert.equal(c.log, '✎ «달» 이름을 «몬스테라 3호»로 바꿨습니다');
  const d = NICK.setNick(p, '초록 3', { original: '몬스테라 3' });
  assert.equal(d.log, '✎ «몬스테라 3호» 이름을 «초록 3»으로 바꿨습니다');
  const e = NICK.setNick(p, '초록 3', { original: '몬스테라 3' });
  assert.ok(e.changed === false && e.log === null, JSON.stringify(e));
  const f = NICK.setNick(p, '', { original: '몬스테라 3' });
  assert.equal(f.log, '✎ «초록 3» 이름을 지웠습니다');
  assert.ok(!('nick' in p));
});

let bad = 0;
for (const [k, n, m] of results) { console.log(`${k === 'PASS' ? '  OK' : 'FAIL'}  ${n}${m ? '  → ' + m : ''}`); if (k !== 'PASS') bad++; }
console.log(bad ? `test_nick: 빨강 ${bad}` : 'test_nick: 다 통과');
process.exit(bad ? 1 : 0);
