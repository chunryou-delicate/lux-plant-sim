/* tools/test_neighbor_order.mjs — **D35 반찬가게 주문** (2026-10-09 · core · 총괄 D35 · plan «반찬가게 주문»)
   ------------------------------------------------------------
   loop §neighborOrderStep 의 문을 잰다(브라우저 없음):
     A 창 안(Day 90·110)의 수확 날 — 그날 거둔 곳간 몫을 빼고 지갑이 정한 금액만큼 오른다 · 사건 하나
     B 창 밖(Day 89 · 111) · 무늬 삽수를 판 뒤 · 원룸 — 안 난다
     C 한 판에 한 번 — 두 번째 수확엔 안 난다(세이브 칸 neighborOrderDay)
     D 오늘 거둔 꾸러미가 없으면 안 난다(빈손으로 돈만 주지 않는다)
     E 창 끝날 결산 — 그때까지 안 났으면 곳간의 가장 최근 몫으로 · 곳간이 비었으면 없음
     F 세이브 칸 — neighborOrderDay · reliefTaken · brokeSinceDay · starved 가 packTutorial 을 지난다 */
import assert from 'node:assert/strict';
import { newState } from '../src/game/state.js';
import { neighborOrderStep } from '../src/game/loop.js';
import { TUTORIAL_RULES } from '../src/game/tutorial.js';
import { serialize } from '../src/game/save.js';
import { RULES } from './lib/byeot_harness.mjs';

let bad = 0;
const check = (name, fn) => { try { fn(); console.log(`PASS  ${name}`); } catch (e) { bad++; console.log(`FAIL  ${name}\n      → ${e.message}`); } };
const WON = TUTORIAL_RULES.neighborOrderWon, [D0, D1] = TUTORIAL_RULES.neighborOrderDays;
function board(day, lots, opt = {}) {
  const S = newState({ mode: 'novice', room: 'banjiha', firstPlay: true, firstPlayRules: RULES });
  S.day = day;
  const fp = S.firstPlay;
  fp.food.pantryLots = lots.map(l => ({ kind: l.kind || 'beansprout', day: l.day, won: l.won, meals: 1 }));
  fp.food.pantryWon = lots.reduce((a, l) => a + l.won, 0);
  if (opt.varieSold) S.tutorial.varieSale.count = 1;
  if (opt.movedOut) S.tutorial.movedOut = true;
  S.tutorial.cashWon = 100_000;
  return S;
}

check('0 값 칸 — neighborOrderWon 이 양수 · 창이 [첫날, 끝날]', () => {
  assert.ok(Number.isFinite(WON) && WON > 0, `neighborOrderWon ${WON}`);
  assert.ok(D0 < D1, `창 ${D0}~${D1}`);
});

check('A 창 안의 수확 날 — 그날 거둔 몫을 빼고 지갑이 금액만큼 오른다', () => {
  for (const day of [D0, D1]) {
    const S = board(day, [{ day: day - 3, won: 3000 }, { day, won: 4000 }, { day, won: 1000, kind: 'musun' }]);
    const e = neighborOrderStep(S, { harvested: true });
    assert.ok(e && e.id === 'neighbor_order', `Day ${day} 에 안 났다`);
    assert.equal(S.tutorial.cashWon, 100_000 + WON, '지갑이 금액만큼 안 올랐다');
    assert.equal(e.takenWon, 5000, '오늘 거둔 몫(4,000 + 1,000)만 가져가야 한다');
    assert.equal(S.firstPlay.food.pantryWon, 3000, '곳간 총액에서 오늘 몫이 안 빠졌다');
    assert.deepEqual(S.firstPlay.food.pantryLots.map(l => l.day), [day - 3], '오늘 아닌 꾸러미가 같이 빠졌다');
    assert.equal(S.tutorial.neighborOrderDay, day);
  }
});

check('B 창 밖(Day 89 · 111) · 무늬 판 뒤 · 원룸 — 안 난다', () => {
  for (const [day, opt, why] of [[D0 - 1, {}, `Day ${D0 - 1}`], [D1 + 1, {}, `Day ${D1 + 1}`],
                                 [100, { varieSold: true }, '무늬 판 뒤'], [100, { movedOut: true }, '원룸']]) {
    const S = board(day, [{ day, won: 4000 }], opt);
    assert.equal(neighborOrderStep(S, { harvested: true }), null, `${why} 에 났다`);
    assert.equal(S.tutorial.cashWon, 100_000, `${why} — 지갑이 움직였다`);
    assert.equal(S.firstPlay.food.pantryWon, 4000, `${why} — 곳간이 움직였다`);
  }
});

check('C 한 판에 한 번 — 두 번째 수확엔 안 난다', () => {
  const S = board(95, [{ day: 95, won: 4000 }]);
  assert.ok(neighborOrderStep(S, { harvested: true }));
  S.day = 100; S.firstPlay.food.pantryLots.push({ kind: 'beansprout', day: 100, won: 4000, meals: 1 }); S.firstPlay.food.pantryWon += 4000;
  assert.equal(neighborOrderStep(S, { harvested: true }), null, '두 번 났다');
  assert.equal(neighborOrderStep(S, { lastDay: true }), null, '결산 길로 또 났다');
  assert.equal(S.tutorial.cashWon, 100_000 + WON, '지갑이 두 번 올랐다');
});

check('D 오늘 거둔 꾸러미가 없으면 안 난다 — 다음 수확을 기다린다', () => {
  const S = board(95, [{ day: 90, won: 4000 }]);
  assert.equal(neighborOrderStep(S, { harvested: true }), null, '빈손으로 났다');
  assert.equal(S.tutorial.neighborOrderDay, null, '안 났는데 «났다»로 적혔다');
});

check('E 창 끝날 결산 — 안 났으면 곳간의 가장 최근 몫 · 비었으면 없음 · 끝날이 아니면 없음', () => {
  const S = board(D1, [{ day: 80, won: 2000 }, { day: 85, won: 3000 }, { day: 85, won: 500 }]);
  assert.equal(neighborOrderStep(board(D1 - 1, [{ day: 85, won: 3000 }]), { lastDay: true }), null, '끝날 전에 결산 길로 났다');
  const e = neighborOrderStep(S, { lastDay: true });
  assert.ok(e, '끝날 결산에 안 났다');
  assert.equal(e.takenWon, 3500, '가장 최근 날(85)의 꾸러미만 가져가야 한다');
  assert.equal(S.firstPlay.food.pantryWon, 2000);
  assert.equal(neighborOrderStep(board(D1, []), { lastDay: true }), null, '곳간이 비었는데 났다');
});

check('F 세이브 칸 — neighborOrderDay · reliefTaken · brokeSinceDay · starved 가 실린다', () => {
  const S = board(95, [{ day: 95, won: 4000 }]);
  neighborOrderStep(S, { harvested: true });
  S.tutorial.reliefTaken = true; S.tutorial.brokeSinceDay = 93; S.tutorial.starved = false;
  const t = serialize(S).state.tutorial;
  assert.equal(t.neighborOrderDay, 95);
  assert.equal(t.reliefTaken, true, '구호금 «받았나»가 세이브에 안 실린다 — 새로 켜면 또 받는다');
  assert.equal(t.brokeSinceDay, 93, '굶주림 시계가 세이브에 안 실린다');
  assert.equal(t.starved, false);
});

console.log(bad ? `neighbor_order: FAIL (${bad}건)` : 'neighbor_order: PASS');
process.exit(bad ? 1 : 0);
