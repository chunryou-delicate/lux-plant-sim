/* test_quest_chip — 2026-10-09 [plan] D50 «칩은 기다림 줄을 건너뛰고 지금 할 수 있는 줄을 보인다» (quest.js §questView opt)
   ① 옵션이 없으면 chip = current · 기다림 없음 (옛 부름은 예전 그대로)
   ② isWaiting 이 첫 열린 줄을 기다림으로 치면 chip 은 다음 열린 줄 · current 는 그대로
   ③ 열린 줄이 다 기다림이면 chip 은 첫 열린 줄(waiting: true · waitWhat 있음)
   ④ waitReason 열쇠 → waitWhat 글 · 모르는 열쇠는 grow 글 · 판정이 던지면 «할 수 있다»
   ⑤ 대조 — 기다림을 안 넘기면 ② 의 판에서 chip 이 기다림 줄에 머문다(자가 빨강을 낼 수 있다)
   실행: node tools/test_quest_chip.mjs */
import assert from 'node:assert/strict';
import { questView, emptySnapshot, QUEST_WAIT_WHAT } from '../src/game/quest.js';

let fails = 0;
const check = (name, fn) => {
  try { fn(); console.log(`PASS  ${name}`); }
  catch (e) { fails++; console.log(`FAIL  ${name}\n      ${e.message}`); }
};

/* 원룸 판 — 짐 풀기·② 뿌리내리기 끝 · ③ 흙에 옮기기 · ⑤ 집 자금 · ④ 팔기가 열린 판 */
const S = { stamina: { questsTaken: ['place_siru', 'water_siru', 'first_harvest', 'order_seed', 'monstera_home',
                                     'oneroom_unpack', 'oneroom_root_bright'] } };
const snap = { ...emptySnapshot(), day: 200, movedOut: true, movedInOnDay: 150, cashWon: 300000, targetWon: 5000000,
               cuttings: [{ method: 'water', status: 'rooted', varieFromCut: true, varieLightBand: 'bright', gen: 1 }],
               varieSalesSinceMove: 0 };
const base = questView(S, snap);

check('① 옵션이 없으면 chip = current · 기다림 없음', () => {
  assert.ok(base.current, '열린 줄이 없습니다 — 판이 잘못 섰습니다');
  assert.equal(base.chip && base.chip.id, base.current.id);
  assert.deepEqual(base.waitingIds, []);
  assert.ok(base.all.every(a => a.waiting === false && a.waitWhat === null));
});

check('② 첫 열린 줄이 기다림이면 chip 은 다음 열린 줄 · current 는 그대로', () => {
  assert.ok(base.open.length >= 2, `열린 줄이 둘 이상이어야 합니다 — ${base.open}`);
  const first = base.open[0];
  const v = questView(S, snap, { isWaiting: id => id === first });
  assert.equal(v.current.id, first, 'current 가 바뀌었습니다');
  assert.equal(v.chip.id, base.open[1], `chip 이 다음 열린 줄이 아닙니다 — ${v.chip && v.chip.id}`);
  assert.deepEqual(v.waitingIds, [first]);
  const w = v.all.find(a => a.id === first);
  assert.ok(w.waiting && typeof w.waitWhat === 'string' && w.waitWhat.length > 0);
});

check('③ 열린 줄이 다 기다림이면 chip 은 첫 열린 줄(waiting: true)', () => {
  const v = questView(S, snap, { isWaiting: () => true });
  assert.equal(v.chip.id, base.open[0]);
  assert.equal(v.chip.waiting, true);
  assert.ok(v.chip.waitWhat);
});

check('④ waitReason 열쇠 → 글 · 모르는 열쇠는 grow · 던지면 할 수 있다', () => {
  const first = base.open[0];
  const v = questView(S, snap, { waitReason: id => id === first ? 'node' : null });
  assert.equal(v.all.find(a => a.id === first).waitWhat, QUEST_WAIT_WHAT.node);
  const u = questView(S, snap, { waitReason: id => id === first ? '없는열쇠' : null });
  assert.equal(u.all.find(a => a.id === first).waitWhat, QUEST_WAIT_WHAT.grow);
  const t = questView(S, snap, { isWaiting: () => { throw new Error('x'); } });
  assert.equal(t.chip.id, base.current.id);
  assert.deepEqual(t.waitingIds, []);
});

check('⑤ 대조 — 기다림을 안 넘기면 같은 판에서 chip 이 첫 줄에 머문다', () => {
  assert.equal(base.chip.id, base.open[0]);
  assert.notEqual(base.chip.id, questView(S, snap, { isWaiting: id => id === base.open[0] }).chip.id);
});

check('글 — 「기다리는 중 — …」 뒷말이 짧다(할 일 줄 28자 안 · 앞말 7자 포함)', () => {
  for (const [k, t] of Object.entries(QUEST_WAIT_WHAT))
    assert.ok(('기다리는 중 — ' + t).length <= 28, `${k}: ${t}`);
});

/* ★ D50 뒤 — «먼저 할 일»이 있는 기다림(cropReady)은 waitDo 를 낸다 · 다른 열쇠는 null */
{
  const { QUEST_WAIT_DO } = await import('../src/game/quest.js');
  check('D50 뒤 waitDo — cropReady 는 «먼저 할 일» 글 · 다른 기다림은 null', () => {
    const first = base.open[0];
    const v = questView(S, snap, { waitReason: id => id === first ? 'cropReady' : null });
    assert.equal(v.all.find(a => a.id === first).waitDo, QUEST_WAIT_DO.cropReady);
    const u = questView(S, snap, { waitReason: id => id === first ? 'node' : null });
    assert.equal(u.all.find(a => a.id === first).waitDo, null);
    assert.ok(QUEST_WAIT_DO.cropReady.length <= 28);
  });
}

/* ★ D51 — 집 자금 칩 글: 날마다 바뀌고(남은 돈) · 목표가 같은 줄에 · 네 마디 말머리 · 28자 안 · 현금을 모르면 예전 글 */
{
  const { questOf, questTodo, HOME_MARKS } = await import('../src/game/quest.js');
  const q = questOf('oneroom_home_fund');
  check('D51 집 자금 칩 글 — 남은 돈 · 목표 · 네 마디 · 28자 안 · 현금 모르면 예전 글', () => {
    const T = 5_000_000;
    const at = c => questTodo(q, { targetWon: T, cashWon: c });
    assert.equal(at(0), '내 집까지 앞으로 500만 · 목표 500만');
    assert.equal(at(T * HOME_MARKS.quarter), '¼ 왔어요 — 앞으로 375만 · 목표 500만');
    assert.equal(at(T * HOME_MARKS.half), '반 왔어요 — 앞으로 250만 · 목표 500만');
    assert.equal(at(T * HOME_MARKS.threeQuarter), '¾ 왔어요 — 앞으로 125만 · 목표 500만');
    assert.ok(at(T * HOME_MARKS.near).startsWith('거의 왔어요'));
    assert.notEqual(at(1_000_000), at(1_100_000), '돈이 늘었는데 글이 그대로입니다');
    for (let c = 0; c < T; c += 37_000) assert.ok(at(c).length <= 28, `${c}: ${at(c)}`);
    assert.equal(questTodo(q, { targetWon: T }), '내 집 자금 5,000,000원을 모으세요');
  });
}

console.log(fails ? `quest_chip: FAIL (${fails})` : 'quest_chip: PASS');
process.exit(fails ? 1 : 0);
