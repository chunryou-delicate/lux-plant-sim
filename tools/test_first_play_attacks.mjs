/* 첫 플레이 공격 테스트 — 재현으로 잡은 것만 남긴다.
   각 블록은 "무엇이 잘못될 수 있나"를 이름으로 달고, 고쳐진 뒤에도 다시 새지 않게 지킨다.

   실행:  node tools/test_first_play_attacks.mjs
*/
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  advanceBeansproutDay, createFirstPlayState, firstPlayRulesFromBalance,
  FIRST_PLAY_ASSETS, FIRST_PLAY_COMPLETE_PHASE_ID,
  markMonsteraArrived, markMonsteraPhase, placeBeansprout, slotFitsDiameter
} from '../src/game/first_play.js';
import { nextDay } from '../src/game/loop.js';
import { newState, givePlant, pot0 } from '../src/game/state.js';
import { createProfileLight } from '../src/game/room_profile.js';

const RULES = firstPlayRulesFromBalance(JSON.parse(
  readFileSync(new URL('../data/balance/characters.json', import.meta.url), 'utf8')));
const POT_D = FIRST_PLAY_ASSETS.monsteraPotDiameterM;

/* ── 공용 스텁 ─────────────────────────────────────────────── */
const SLOTS = () => ([
  { slotId: 'dark', dli: 0.2, maxPotD: 0.30 },
  { slotId: 'arrival', dli: 0.1, maxPotD: 0.30 },
  { slotId: 'sill', dli: 3.77, maxPotD: 0.21 }
]);
function mkLight(slots, bad = []) {
  return {
    room: { slots }, clearCache() {}, thresholdsOf: () => ({ fenestrate: 6 }),
    daily: () => ({
      sky: { season: 'summer', weather: 'clear' },
      check: { ok: !bad.length, badSlots: new Set(bad), problems: bad.map(b => `${b} NaN`) },
      report: { slots, best: slots[2], sky: { weather_ko: '맑음' },
                energy: { won: 0 }, photoperiod: { hours: 0 }, continuous_injury: false }
    })
  };
}
function mkGrowth(over = {}) {
  let cal = 0, growth = 0, today = null;
  const base = {
    assertContract() {},
    setGrowth(d) { cal = d; growth = d; return { growth, calDay: cal, drawn: true, drawError: null, hudError: null }; },
    setDailyLight(v) { today = v; },
    calendarDay: () => cal, growthDays: () => growth,
    advanceTo(d) {
      cal = d; const grew = today >= 3; if (grew) growth++;
      return { calDay: cal, growth, grew, blocked: grew ? null : '빛 부족',
               drawn: true, drawError: null, hudError: null };
    },
    growthBlocked: () => (today >= 3 ? null : '빛 부족'),
    growthPhase: () => (growth >= 146
      ? { phaseId: 'spear_furled', phaseKo: '말린 새순 등장', progress01: 0, nextPhaseId: 'spear_opening', nextPhaseKo: '새순이 펴지는 중' }
      : { phaseId: 'spear_ready', phaseKo: '말린 새순을 준비하는 중', progress01: (growth - 143) / 3,
          nextPhaseId: 'spear_furled', nextPhaseKo: '말린 새순 등장' }),
    dli7: () => today, dliCV: () => 0, ageOf: d => d
  };
  return Object.assign(base, over);
}
function firstPlayState(slotId = 'dark') {
  const S = newState({ room: 'banjiha', mode: 'novice', firstPlay: true, firstPlayRules: RULES });
  placeBeansprout(S.firstPlay, slotId);
  return S;
}

/* ── 1. Day 4 원자성 — 도착 실패는 수확·식비·날짜까지 되돌린다 ── */
{
  const growth = mkGrowth({ setGrowth() { throw new Error('도착 초기화 실패 주입'); } });
  const io = { light: mkLight(SLOTS()), growth };
  const S = firstPlayState();
  for (let d = 1; d <= 3; d++) nextDay(S, io);
  let err = null;
  try { nextDay(S, io); } catch (e) { err = e; }
  assert.match(err.message, /도착 초기화 실패 주입/);
  assert.equal(err.turnState, 'core_rolled_back');
  assert.equal(S.day, 3);
  assert.equal(S.firstPlay.beansprout.harvested, false);
  assert.equal(S.firstPlay.food.totalFoodSavedWon, 0);
  assert.equal(S.pots.length, 0);
}

/* ── 2. 도착 setGrowth 가 drawn:false 면 화분·로그를 만들기 전에 멈춘다 ── */
{
  const growth = mkGrowth({
    setGrowth(d) { return { growth: d, calDay: d, drawn: false, drawError: '3D 실패 주입', hudError: null }; }
  });
  const S = newState({ room: 'banjiha', mode: 'novice' });
  const logBefore = S.log.length;
  assert.throws(() => givePlant(S, { growth }, { slotId: 'sill' }), /그리지 못했습니다/);
  assert.equal(S.pots.length, 0, '화분이 남으면 "화면엔 없는 개체"가 된다');
  assert.equal(S.log.length, logBefore, '도착 로그도 남기지 않는다');

  /* 옛 growth(drawn 없음)는 정보 없음이므로 막지 않는다 */
  const old = mkGrowth({ setGrowth(d) { return { growth: d, calDay: d }; } });
  const S2 = newState({ room: 'banjiha', mode: 'novice' });
  givePlant(S2, { growth: old }, { slotId: 'sill' });
  assert.equal(S2.pots.length, 1);
}

/* ── 3. 하루 진행이 drawn:false 면 진행은 기록하고 fail-loud ── */
{
  const growth = mkGrowth();
  const real = growth.advanceTo;
  growth.advanceTo = (d) => ({ ...real(d), drawn: false, drawError: '그리기 실패 주입' });
  const S = newState({ room: 'banjiha', mode: 'novice' });
  givePlant(S, { growth }, { slotId: 'sill' });
  const io = { light: mkLight(SLOTS()), growth };
  let err = null;
  try { nextDay(S, io); } catch (e) { err = e; }
  assert.equal(err.turnState, 'growth_advanced');
  assert.equal(err.coreRolledBack, false);
  assert.equal(S.day, 1, '되감지 않는다 — growth 는 진짜로 하루 갔다');
  assert.equal(pot0(S).daysPlanted, 1);
  assert.equal(S.dliHist.length, 1);
  assert.equal(err.turn.drawn, false);
  assert.equal(err.turn.effectiveGrowthDays, 144, '논리 진행은 일관되게 기록된다');
  assert.match(S.desync.reason, /그리기 실패 주입/);
}

/* ── 4. hudError 는 3D 실패와 구분해 경고만 한다(진행은 계속) ── */
{
  const growth = mkGrowth();
  const real = growth.advanceTo;
  growth.advanceTo = (d) => ({ ...real(d), hudError: 'HUD 실패 주입' });
  const S = newState({ room: 'banjiha', mode: 'novice' });
  givePlant(S, { growth }, { slotId: 'sill' });
  const { turn } = nextDay(S, { light: mkLight(SLOTS()), growth });
  assert.equal(turn.hudError, 'HUD 실패 주입');
  assert.equal(turn.drawn, true);
  assert.equal(S.day, 1);
  assert.ok(S.log.some(l => /HUD 갱신 실패/.test(l.msg)));
  assert.equal(S.desync, undefined, 'HUD 실패는 어긋남이 아니다');
}

/* ── 5. growthPhase 실패는 조용히 넘어가지 않는다 ── */
{
  /* 5-a) 하루 시작 전에 못 읽으면 아예 시작하지 않는다 */
  const dead = mkGrowth({ growthPhase() { throw new Error('단계 읽기 실패 주입'); } });
  const S0 = newState({ room: 'banjiha', mode: 'novice' });
  givePlant(S0, { growth: mkGrowth() }, { slotId: 'sill' });
  let e0 = null;
  try { nextDay(S0, { light: mkLight(SLOTS()), growth: dead }); } catch (e) { e0 = e; }
  assert.equal(e0.turnState, 'not_started');
  assert.equal(S0.day, 0, '읽을 수 없으면 하루를 세지 않는다');

  /* 5-b) 진행 뒤에 깨지면 fail-loud — 경계를 못 봤다는 사실을 남긴다 */
  let calls = 0;
  const flaky = mkGrowth({
    growthPhase() { if (++calls > 1) throw new Error('진행 뒤 단계 실패 주입');
                    return { phaseId: 'spear_ready', phaseKo: '말린 새순을 준비하는 중', progress01: 0 }; }
  });
  const S1 = newState({ room: 'banjiha', mode: 'novice' });
  givePlant(S1, { growth: flaky }, { slotId: 'sill' });
  calls = 0;
  let e1 = null;
  try { nextDay(S1, { light: mkLight(SLOTS()), growth: flaky }); } catch (e) { e1 = e; }
  assert.equal(e1.turnState, 'growth_advanced');
  assert.equal(e1.coreRolledBack, false);
  assert.equal(S1.day, 1, '하루는 진행됐다 — 되감지 않는다');
  assert.match(S1.desync.reason, /진행 뒤 단계 실패 주입/);
  assert.match(e1.turn.growthPhaseError, /진행 뒤 단계 실패 주입/);
}

/* ── 5-c. 도착: 단계를 못 읽으면 화분을 만들지 않고 되돌린다 ── */
{
  let calls = 0;
  const growth = mkGrowth({
    growthPhase() { if (++calls >= 1) throw new Error('도착 단계 실패 주입'); }
  });
  const S = firstPlayState();
  const io = { light: mkLight(SLOTS()), growth };
  /* Day 1~3 은 화분이 없어 사전 검증을 지나간다(콩나물만 돈다) */
  for (let d = 1; d <= 3; d++) nextDay(S, io);
  let err = null;
  try { nextDay(S, io); } catch (e) { err = e; }
  assert.match(err.message, /단계를 읽지 못했습니다/);
  assert.equal(S.pots.length, 0, '단계를 못 읽으면 개체를 만들지 않는다');
  assert.equal(S.day, 3);
  assert.equal(S.firstPlay.beansprout.harvested, false, '수확·식비도 함께 되돌아간다');
}

/* ── 5-d. drawn:false 는 markMonsteraPhase 앞에서 멈춰 completed 를 만들지 않는다 ── */
{
  const growth = mkGrowth();
  const real = growth.advanceTo;
  growth.advanceTo = (d) => ({ ...real(d), drawn: false, drawError: '그리기 실패 주입' });
  growth.growthPhase = () => ({ phaseId: 'spear_furled', phaseKo: '말린 새순 등장', progress01: 0 });
  const S = firstPlayState();
  S.firstPlay.beansprout.harvested = true;             // 도착 이후 상태를 만든다
  S.firstPlay.monstera.arrived = true;
  givePlant(S, { growth }, { slotId: 'sill' });        // 같은 growth 로 143 을 세운다
  let err = null;
  try { nextDay(S, { light: mkLight(SLOTS()), growth }); } catch (e) { err = e; }
  assert.equal(err.turnState, 'growth_advanced');
  assert.equal(S.firstPlay.completed, false,
    '화면이 안 그려졌는데 "말린 새순을 봤다"가 되면 첫 학습의 증거가 거짓이 된다');
  assert.equal(S.day, 1, '논리 진행은 유지한다');
  assert.equal(growth.growthDays(), 144);
}

/* ── 6. 계약 이상 슬롯은 되돌린 뒤 **재배치로 복구**할 수 있다 ── */
{
  const growth = mkGrowth();
  const S = firstPlayState('dark');
  const ok = { light: mkLight(SLOTS()), growth };
  nextDay(S, ok); nextDay(S, ok);
  assert.equal(S.firstPlay.beansprout.ageDays, 2);

  const broken = { light: mkLight(SLOTS(), ['dark']), growth };
  let err = null;
  try { nextDay(S, broken); } catch (e) { err = e; }
  assert.equal(err.turnState, 'core_rolled_back');
  assert.equal(S.day, 2, '되돌아간다');

  /* ★ 수확 전이면 옮길 수 있고, 지금까지 받은 빛 이력은 남는다 */
  const moved = placeBeansprout(S.firstPlay, 'arrival');
  assert.equal(moved.moved, true);
  assert.equal(moved.keptDays, 2);
  assert.deepEqual(S.firstPlay.beansprout.dliHist, [0.2, 0.2]);
  const { turn } = nextDay(S, broken);      // 'dark' 만 깨졌으므로 이제 진행된다
  assert.equal(S.day, 3);
  assert.equal(S.firstPlay.beansprout.ageDays, 3);
  assert.ok(turn);
  assert.throws(() => placeBeansprout(S.firstPlay, ''), /자리를 골라/);
}

/* ── 7. 미배치는 복구 가능한 안내다(상태를 건드리지 않는다) ── */
{
  const fp = createFirstPlayState({ rules: RULES });
  assert.throws(() => advanceBeansproutDay(fp, 0.2), /자리/);
  assert.equal(fp.beansprout.ageDays, 0);
  assert.equal(fp.beansprout.slotId, null);
  /* 놓고 나면 바로 진행된다 */
  placeBeansprout(fp, 'dark');
  assert.equal(advanceBeansproutDay(fp, 0.2).harvested, false);
  assert.equal(fp.beansprout.ageDays, 1);
}

/* ── 8. 첫 플레이 중에는 Day 1 부터 growth 계약을 본다 ── */
{
  const dead = { assertContract() { throw new Error('계약 끊김'); } };
  const S = firstPlayState();
  let err = null;
  try { nextDay(S, { light: mkLight(SLOTS()), growth: dead }); } catch (e) { err = e; }
  assert.equal(err.turnState, 'not_started');
  assert.equal(S.day, 0, '화분이 없어도 계약 없이 하루를 세지 않는다');
  assert.equal(S.firstPlay.beansprout.ageDays, 0);
}

/* ── 9. 도착 후보: 물리적으로 들어가는 슬롯 0칸이면 폴백 금지·throw ── */
{
  const tiny = SLOTS().map(s => ({ ...s, maxPotD: 0.05 }));   // 어디에도 안 올라간다
  const growth = mkGrowth();
  const S = firstPlayState();
  const io = { light: mkLight(tiny), growth };
  for (let d = 1; d <= 3; d++) nextDay(S, io);
  let err = null;
  try { nextDay(S, io); } catch (e) { err = e; }
  assert.match(err.message, /화분이 올라가는 자리가 이 방에 없습니다/);
  assert.equal(S.pots.length, 0);
  assert.equal(S.day, 3, '되돌아가 다시 시도할 수 있다');

  /* maxPotD 가 아예 없는(치수 미상) 슬롯도 후보가 아니다 */
  const unknown = SLOTS().map(({ maxPotD, ...rest }) => rest);
  assert.equal(slotFitsDiameter(unknown[0], POT_D), false);
  assert.equal(slotFitsDiameter({ maxPotD: 0.30 }, POT_D), true);
  assert.equal(slotFitsDiameter({ maxPotD: 0.10 }, POT_D), false);
}

/* ── 10. 품질 3/2/1 은 그대로다(숫자 불변 확인) ── */
{
  const grow = (dli) => {
    const fp = createFirstPlayState({ rules: RULES });
    placeBeansprout(fp, 'dark');
    let r = null;
    for (let d = 1; d <= 4; d++) r = advanceBeansproutDay(fp, dli);
    return r;
  };
  assert.equal(grow(0.3).meals, 3);
  assert.equal(grow(0.7).meals, 2);
  assert.equal(grow(1.2).meals, 1);
  assert.equal(grow(0.2).foodSavedWon, 5000);
  assert.equal(grow(0.2).cashFoodWon, 2500);
}

/* ── 11. 143 → 146: 완료는 spear_furled 에서만 ── */
{
  const fp = createFirstPlayState({ rules: RULES });
  placeBeansprout(fp, 'dark');
  for (let d = 1; d <= 4; d++) advanceBeansproutDay(fp, 0.2);
  markMonsteraArrived(fp, 'arrival');

  markMonsteraPhase(fp, { phaseId: 'spear_ready', phaseKo: '말린 새순을 준비하는 중', progress01: 2 / 3 });
  assert.equal(fp.completed, false);
  assert.equal(fp.monstera.growthPhase.phaseKo, '말린 새순을 준비하는 중', 'growth 가 준 이름을 그대로 쓴다');

  /* ★ 뒤 단계 포괄 성공 금지 — 지나쳐 버린 회차는 완료가 아니다 */
  for (const later of ['spear_opening', 'leaf_young', 'leaf_mid', 'leaf_mature']) {
    const f2 = createFirstPlayState({ rules: RULES });
    placeBeansprout(f2, 'dark');
    for (let d = 1; d <= 4; d++) advanceBeansproutDay(f2, 0.2);
    markMonsteraArrived(f2, 'arrival');
    markMonsteraPhase(f2, { phaseId: later, progress01: 0.5 });
    assert.equal(f2.completed, false, `${later} 은 완료가 아니다`);
  }
  markMonsteraPhase(fp, { phaseId: FIRST_PLAY_COMPLETE_PHASE_ID, phaseKo: '말린 새순 등장', progress01: 0 });
  assert.equal(fp.completed, true);
  assert.equal(fp.phase, 'complete');

  /* phaseKo 가 없는 옛 growth 면 키를 그대로 보여준다 — 조용히 비우지 않는다 */
  const f3 = createFirstPlayState({ rules: RULES });
  placeBeansprout(f3, 'dark');
  for (let d = 1; d <= 4; d++) advanceBeansproutDay(f3, 0.2);
  markMonsteraArrived(f3, 'arrival');
  markMonsteraPhase(f3, { phaseId: 'axis_rising', progress01: 0.1 });
  assert.equal(f3.monstera.growthPhase.phaseKo, 'axis_rising');
}

/* ── 12. 143 → 146 을 루프로: 3턴이면 완료 ── */
{
  const growth = mkGrowth();
  const io = { light: mkLight(SLOTS()), growth };
  const S = firstPlayState();
  for (let d = 1; d <= 4; d++) nextDay(S, io);
  assert.equal(pot0(S).arrivalGrowthDays, 143);
  assert.notEqual(pot0(S).slotId, 'sill', '몬스테라는 먼저 어두운 자리에 도착한다');
  pot0(S).slotId = 'sill';
  for (let d = 5; d <= 7; d++) nextDay(S, io);
  assert.equal(growth.growthDays(), 146);
  assert.equal(S.firstPlay.completed, true);
  assert.equal(S.firstPlay.monstera.growthPhase.phaseId, 'spear_furled');
  assert.equal(S.firstPlay.monstera.growthPhase.phaseKo, '말린 새순 등장');
}

/* ── 13. 프로파일(정적 경로)도 같은 물리 필터를 쓸 수 있어야 한다 ── */
{
  const profile = {
    schema: 'room_profile/1', room: 'banjiha', label: '반지하', uidStable: true,
    lampCounts: [0], lampWatts: [0], measured: {},
    slots: [
      { slotId: 'banjiha-a:0', owner: 'shelf', point: { x: 0, y: 1, z: 0 }, ratio: 1e-4, ppfd: [0], maxPotD: 0.21 },
      { slotId: 'banjiha-b:0', owner: 'desk', point: { x: 1, y: 1, z: 0 }, ratio: 1e-5, ppfd: [0] }  // 치수 없음
    ]
  };
  const light = createProfileLight(profile, { lightTh: null, weatherBalance: null });
  const S = newState({ room: 'banjiha', mode: 'novice' });
  const rep = light.daily(1, S).report;
  assert.equal(rep.slots[0].maxPotD, 0.21, 'report 에 물리 치수가 실려야 한다');
  assert.equal(rep.slots[1].maxPotD, null, '없으면 null 로 명시한다(조용히 빠뜨리지 않는다)');
  assert.equal(light.room.slots[0].maxPotD, 0.21, 'room.slots 에도 보존한다');
  assert.equal(light.room.slots.filter(s => slotFitsDiameter(s, POT_D)).length, 1,
    '치수 미상 슬롯은 후보에서 빠진다 — 라이브 경로와 같은 규칙');
}

/* ── 14. UI 복구 정책: not_started 는 hard lock, 복구는 두 가지뿐 ── */
{
  const html = readFileSync(new URL('../game.html', import.meta.url), 'utf8');
  const m = html.match(/RECOVERABLE_TURN_STATES = new Set\(\[([^\]]*)\]\)/);
  assert.ok(m, 'game.html 에 복구 가능 목록이 있어야 한다');
  assert.equal(m[1].replace(/['"\s]/g, ''), 'core_rolled_back',
    'not_started 는 growth 계약 단절이므로 복구 목록에 있으면 안 된다');
  assert.match(html, /e\.recoverable === true/);
  assert.match(html, /e\.firstPlayInput/);
  /* 기본 첫 플레이는 완료 뒤에도 DLI·정답순을 숨긴다 */
  assert.match(html, /const devMode = !\(S\.firstPlay && S\.firstPlay\.enabled\);/);
  /* 코어 한글 단계표는 없어야 한다 */
  assert.equal(/const PHASE_KO/.test(html), false, 'phaseKo 는 growth 가 낸 것만 쓴다');
  assert.match(html, /plant_grow\.html\?embed=game/);
}

console.log('first_play_attacks: PASS (16 블록)');
