/* 반지하 튜토리얼 재현 — docs/story_arc.md §1·§2·§3·§4
 *
 *   node tools/test_tutorial.mjs
 */
import assert from 'node:assert';
import {
  TUTORIAL_RULES, createTutorialState, tutorialDay, seasonAt, seasonDayAt,
  noteLearning, learningLeft, canMoveOut, moveOut, buyLamp,
  lampElectricityWon, foodSavedWon, tutorialGoal
} from '../src/game/tutorial.js';

const results = [];
const check = (name, fn) => { try { fn(); results.push(['PASS', name]); }
                              catch (e) { results.push(['FAIL', name, e.message]); } };
const mk = () => createTutorialState({ enabled: true });
/* 배운 것을 전부 채운다 — 돈 조건만 따로 보고 싶을 때 쓴다 */
const teachAll = (ts) => noteLearning(ts, {
  harvested: true, foodSavedWon: 5000, cropAvgDli: 0.1,
  plantDli7: 3.8, plantMinDli: 3.0, spearFurled: true
});

/* ══ A · 첫 플레이 동안에는 계절도 돈도 안 움직인다 ═══════════════════════ */
check('A 첫 플레이 중 — 날짜·돈·계절 전부 정지', () => {
  const ts = mk();
  const before = ts.cashWon;
  for (let i = 0; i < 20; i++) {
    const r = tutorialDay(ts, { firstPlayDone: false });
    assert.ok(r && r.skipped, '첫 플레이 중인데 하루가 갔습니다');
  }
  assert.equal(ts.day, 0, '날짜가 갔습니다');
  assert.equal(ts.cashWon, before, '돈이 빠졌습니다');
  assert.equal(ts.seasonRunning, false, '계절이 돌기 시작했습니다');
});

/* ══ B · 계절 — 여름 45일차에서 시작해 45일 뒤 가을 ═══════════════════════ */
check('B 계절 — 시작 여름 · 45일 뒤 가을 · 135일 뒤 겨울', () => {
  const ts = mk();
  assert.equal(seasonAt(ts, 0), 'summer', '시작이 여름이 아닙니다');
  assert.equal(seasonDayAt(ts, 0), TUTORIAL_RULES.startSeasonDay, '여름 45일차가 아닙니다');
  assert.equal(seasonAt(ts, 44), 'summer', '44일째가 벌써 가을입니다');
  assert.equal(seasonAt(ts, 45), 'autumn', '45일째가 가을이 아닙니다');
  assert.equal(seasonAt(ts, 135), 'winter', '135일째가 겨울이 아닙니다');
});

/* ══ C · 하루 지출과 콩나물 절감 ═════════════════════════════════════════ */
check('C 하루 지출 20,000원 · 콩나물 3끼면 7,500원 덜 나간다', () => {
  const ts = mk();
  const r0 = tutorialDay(ts, { firstPlayDone: true, mealsUsed: 0 });
  assert.equal(r0.spentWon, TUTORIAL_RULES.dailySpendWon, `지출이 ${r0.spentWon}`);
  const ts2 = mk();
  const r1 = tutorialDay(ts2, { firstPlayDone: true, mealsUsed: 3 });
  assert.equal(r1.savedWon, 7500, `절감이 ${r1.savedWon}`);
  assert.equal(r1.spentWon, 20000 - 7500, `절감 뒤 지출이 ${r1.spentWon}`);
});

/* ══ D · 월세 — 첫 달은 유예, 30일째부터 ═══════════════════════════════ */
check('D 월세 — 30일 유예 뒤 첫 청구 · 그 뒤 30일마다', () => {
  const ts = mk();
  const due = [];
  for (let i = 1; i <= 95; i++) {
    const r = tutorialDay(ts, { firstPlayDone: true, mealsUsed: 3 });
    if (r.rentWon > 0) due.push(r.day);
  }
  assert.deepEqual(due, [30, 60, 90], '월세 청구일이 ' + due.join(',') + ' 입니다');
});

/* ══ E · 식물등 — 가을에 해금 · 사면 돈이 빠지고 전기가 붙는다 ═══════════ */
check('E 식물등 — 가을 해금 · 25,000원 · 전기 23원/일', () => {
  const ts = mk();
  let unlockedAt = null;
  for (let i = 1; i <= 60 && !unlockedAt; i++) {
    const r = tutorialDay(ts, { firstPlayDone: true, mealsUsed: 3 });
    if (r.events.some(e => e.id === 'lamp_unlocked')) unlockedAt = r.day;
  }
  assert.equal(unlockedAt, 45, `해금이 ${unlockedAt}일째입니다 — 가을 진입(45)이어야 합니다`);
  const before = ts.cashWon;
  buyLamp(ts);
  assert.equal(ts.cashWon, before - TUTORIAL_RULES.lampPriceWon, '값이 안 빠졌습니다');
  assert.equal(ts.lamp.owned, 1);
  assert.equal(lampElectricityWon(ts), 23, `전기가 ${lampElectricityWon(ts)}원/일 입니다`);
  const r = tutorialDay(ts, { firstPlayDone: true, mealsUsed: 3 });
  assert.equal(r.electricityWon, 23, '하루 전기가 안 붙었습니다');
});

check('E-2 식물등 — 해금 전에는 못 산다', () => {
  const ts = mk();
  assert.throws(() => buyLamp(ts), /아직 살 수 없습니다/);
});

/* ══ F · 체크리스트 — 코어 값으로 켜지고, 한 번 켜지면 안 꺼진다 ═════════ */
check('F 배움 — 품질로 콩나물 배치를 · DLI 로 몬스테라 자리를 판정', () => {
  const ts = mk();
  assert.equal(learningLeft(ts).length, 4, '처음에 4개가 아닙니다');

  /* ② 콩나물: 자리 이름이 아니라 4일평균 DLI 로 본다 */
  noteLearning(ts, { harvested: true, foodSavedWon: 5000, cropAvgDli: 0.9 });
  assert.equal(ts.learned.harvest, true, '수확·절감이 안 켜졌습니다');
  assert.equal(ts.learned.cropDark, false, '★밝은 데(0.9)서 수확했는데 어두운 자리로 인정됐습니다');
  noteLearning(ts, { harvested: true, foodSavedWon: 5000, cropAvgDli: 0.2 });
  assert.equal(ts.learned.cropDark, true, '어두운 데(0.2)인데 인정 안 됐습니다');

  /* ③ 몬스테라: min 미만이면 인정 안 됨 */
  noteLearning(ts, { plantDli7: 2.4, plantMinDli: 3.0 });
  assert.equal(ts.learned.plantWindow, false, '★어두운 자리인데 창가로 인정됐습니다');
  noteLearning(ts, { plantDli7: 3.8, plantMinDli: 3.0 });
  assert.equal(ts.learned.plantWindow, true);

  noteLearning(ts, { spearFurled: true });
  assert.equal(learningLeft(ts).length, 0, '넷이 다 안 켜졌습니다');

  /* ★한 번 켜지면 안 꺼진다 — 나중에 자리를 옮겼다고 배운 게 없던 일이 되면 안 된다 */
  noteLearning(ts, { plantDli7: 0.1, plantMinDli: 3.0, cropAvgDli: 5 });
  assert.equal(learningLeft(ts).length, 0, '★배운 것이 되돌려졌습니다');
});

/* ══ G · 이사 — 두 축을 함께 본다 ══════════════════════════════════════ */
check('G 이사 — 돈만으로도, 배움만으로도 안 된다', () => {
  const ts = mk();
  ts.cashWon = TUTORIAL_RULES.moveOutCostWon;      // 돈은 충분
  let c = canMoveOut(ts);
  assert.equal(c.ok, false, '★돈만으로 이사가 됐습니다');
  assert.equal(c.money, true);
  assert.equal(c.learningLeft.length, 4);
  assert.throws(() => moveOut(ts), /못 해 본 것/);

  const ts2 = mk();
  teachAll(ts2);
  ts2.cashWon = 100;                                // 배움은 완료, 돈은 없음
  c = canMoveOut(ts2);
  assert.equal(c.ok, false, '★배움만으로 이사가 됐습니다');
  assert.equal(c.learningLeft.length, 0);
  assert.ok(c.shortWon > 0, '모자란 금액이 안 나옵니다');
  assert.throws(() => moveOut(ts2), /자금이/);

  const ts3 = mk();
  teachAll(ts3);
  ts3.cashWon = TUTORIAL_RULES.moveOutCostWon;
  assert.equal(canMoveOut(ts3).ok, true, '둘 다 됐는데 이사가 안 됩니다');
  const r = moveOut(ts3);
  assert.equal(r.movedOut, true);
  assert.equal(ts3.cashWon, 0, '이사비가 안 빠졌습니다');
  assert.equal(tutorialGoal(ts3).id, 'done');
});

/* ══ H · ★파산해도 안 죽는다 (스토리 전체가 초보 모드) ═══════════════════ */
check('H 돈이 떨어져도 게임이 안 끝난다 · 0원 아래로 안 간다', () => {
  const ts = mk();
  ts.cashWon = 5_000;
  let broke = null;
  for (let i = 0; i < 40; i++) {
    const r = tutorialDay(ts, { firstPlayDone: true, mealsUsed: 0 });
    if (!broke && r.events.some(e => e.id === 'broke')) broke = r.day;
    assert.ok(ts.cashWon >= 0, `★잔액이 음수가 됐습니다: ${ts.cashWon}`);
  }
  assert.ok(broke !== null, '돈이 떨어졌는데 알림이 없습니다');
  assert.equal(ts.movedOut, false);
  assert.ok(ts.day >= 40, '★파산으로 하루가 멈췄습니다 — 초보 모드는 죽지 않습니다');
});

/* ══ I · 목표 안내 — 무엇을 하면 되는지 한 줄 ═══════════════════════════ */
check('I 목표 — 배울 게 남으면 배움을, 다 배웠으면 돈을 말한다', () => {
  const ts = mk();
  assert.equal(tutorialGoal(ts).id, 'learn', '처음엔 배움을 말해야 합니다');
  teachAll(ts);
  assert.equal(tutorialGoal(ts).id, 'money', '다 배웠으면 돈을 말해야 합니다');
  ts.cashWon = TUTORIAL_RULES.moveOutCostWon;
  assert.equal(tutorialGoal(ts).id, 'ready');
});

/* ══ J · 표준 진행 — 월세 유예로 데드라인이 성립하는가 ═══════════════════ */
check('J 표준 진행 — 콩나물 3끼로 버티면 며칠 가나', () => {
  const ts = mk();
  let day = 0;
  while (ts.cashWon > 0 && day < 400) { tutorialDay(ts, { firstPlayDone: true, mealsUsed: 3 }); day = ts.day; }
  /* game_flow.md 의 "월세 첫 달 유예 → 데드라인 73일" 과 자릿수가 맞는지만 본다.
     콩나물만으로는 흑자가 안 나므로(선반이 있어야 한다) 여기서는 버티는 날수를 잰다. */
  results.push(['INFO', `  콩나물 3끼만으로 버티는 날: ${day}일 (게임 시작 자금 100만)`]);
  assert.ok(day > 40 && day < 200, `버티는 날이 ${day}일 — 데드라인 자릿수(수십 일)와 어긋납니다`);
});

/* ── 보고 ─────────────────────────────────────────────────────────────── */
let fail = 0;
for (const [st, name, msg] of results) {
  if (st === 'INFO') { console.log(name); continue; }
  if (st === 'FAIL') fail++;
  console.log(`${st}  ${name}${msg ? '\n      → ' + msg : ''}`);
}
console.log(fail ? `\ntutorial: FAIL (${fail}건)` : '\ntutorial: PASS');
process.exit(fail ? 1 : 0);
