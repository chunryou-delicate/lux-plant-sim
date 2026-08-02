import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  advanceBeansproutDay,
  createFirstPlayState,
  firstPlayRulesFromBalance,
  openSiruContractFromManifest,
  markMonsteraArrived,
  markMonsteraPhase,
  moveMonstera,
  placeBeansprout
} from '../src/game/first_play.js';
import { nextDay } from '../src/game/loop.js';
import { newState, pot0 } from '../src/game/state.js';

const TEST_RULES = firstPlayRulesFromBalance(JSON.parse(
  readFileSync(new URL('../data/balance/characters.json', import.meta.url), 'utf8')
));
const OPEN_SIRU = openSiruContractFromManifest(JSON.parse(
  readFileSync(new URL('../assets/manifest.json', import.meta.url), 'utf8')
));
assert.equal(OPEN_SIRU.lidState, 'open');
assert.equal(OPEN_SIRU.transmitsSlotDli, true);
assert.equal(OPEN_SIRU.diameterM, 0.24);

function growFourDays(dli) {
  const fp = createFirstPlayState({ rules: TEST_RULES });
  placeBeansprout(fp, 'dark-slot');
  let result = null;
  for (let day = 1; day <= 4; day++) result = advanceBeansproutDay(fp, dli);
  return { fp, result };
}

{
  const fp = createFirstPlayState({ rules: TEST_RULES });
  assert.equal(fp.phase, 'place_beansprout');
  assert.throws(() => advanceBeansproutDay(fp, 0.2), /자리/);

  placeBeansprout(fp, 'banjiha-dresser:1');
  for (let day = 1; day <= 2; day++) {
    const result = advanceBeansproutDay(fp, 0.2);
    assert.equal(result.harvested, false, `${day}일에는 수확되면 안 된다`);
  }
  placeBeansprout(fp, 'another-dark-slot');
  assert.equal(fp.beansprout.slotId, 'another-dark-slot');
  const day3 = advanceBeansproutDay(fp, 0.2);
  assert.equal(day3.harvested, false);
  const harvest = advanceBeansproutDay(fp, 0.2);
  assert.deepEqual(
    {
      harvested: harvest.harvested,
      meals: harvest.meals,
      quality: harvest.quality,
      foodSavedWon: harvest.foodSavedWon,
      cashFoodWon: harvest.cashFoodWon,
      pantryMeals: fp.food.pantryMeals,
      phase: fp.phase
    },
    {
      harvested: true,
      meals: 3,
      quality: 'crisp_white',
      foodSavedWon: 5000,
      cashFoodWon: 2500,
      pantryMeals: 1,
      phase: 'monstera_gift'
    }
  );
}

{
  const low = growFourDays(0.3).result;
  const medium = growFourDays(0.7).result;
  const bright = growFourDays(1.2).result;
  assert.equal(low.meals, 3);
  assert.equal(medium.meals, 2);
  assert.equal(bright.meals, 1);
}

{
  const { fp } = growFourDays(0.2);
  markMonsteraArrived(fp, 'banjiha-dresser:0');
  assert.equal(fp.phase, 'move_monstera');
  assert.equal(fp.monstera.slotId, 'banjiha-dresser:0');

  markMonsteraPhase(fp, { phaseId: 'spear_ready', progress01: 2 / 3 });
  assert.equal(fp.completed, false);
  assert.equal(fp.phase, 'move_monstera', '도착 직후 첫 관측만으로는 옮겼다고 볼 수 없다');
  markMonsteraPhase(fp, { phaseId: 'spear_opening', progress01: 0 });
  assert.equal(fp.completed, false, '말린 새순 단계를 건너뛴 상태를 성공으로 받으면 안 된다');
  markMonsteraPhase(fp, { phaseId: 'leaf_mid', progress01: 0.5 });
  assert.equal(fp.completed, false, '뒤 단계 포괄 성공 금지 — 지나쳐 버린 회차는 완료가 아니다');
  markMonsteraPhase(fp, { phaseId: 'spear_furled', progress01: 0 });
  assert.equal(fp.completed, true);
  assert.equal(fp.phase, 'complete');
}

/* 안내 단계: 어두운 자리에 있는 동안은 "옮겨 보세요"가 남고, 형태가 오르기 시작하면 넘어간다.
   슬롯 id 로 판정하지 않으므로 다른 어두운 자리로 옮겨도 진행이 없으면 안내는 그대로다. */
{
  const { fp } = growFourDays(0.2);
  markMonsteraArrived(fp, 'arrival-slot');
  markMonsteraPhase(fp, { phaseId: 'spear_ready', progress01: 0 });
  moveMonstera(fp, 'another-dark-slot');
  markMonsteraPhase(fp, { phaseId: 'spear_ready', progress01: 0 });
  assert.equal(fp.phase, 'move_monstera', '정지한 채면 옮겨 보라는 안내가 남아야 한다');

  markMonsteraPhase(fp, { phaseId: 'spear_ready', progress01: 1 / 3 });
  assert.equal(fp.phase, 'grow_monstera', '형태가 오르기 시작하면 안내를 넘긴다');
  assert.equal(fp.completed, false, '안내 단계 전환은 완료가 아니다');

  markMonsteraPhase(fp, { phaseId: 'spear_furled', progress01: 0 });
  assert.equal(fp.phase, 'complete');
}

{
  const fp = createFirstPlayState({ rules: TEST_RULES });
  placeBeansprout(fp, 'dark-slot');
  assert.throws(() => advanceBeansproutDay(fp, null), /DLI/);
  assert.equal(fp.beansprout.ageDays, 0, '잘못된 입력은 상태를 부분 진행시키면 안 된다');
}

console.log('first_play: PASS');

/* 공개 통합 경계: Day 0의 시루부터 Day 7의 말린 새순까지. */
{
  let cal = 0;
  let growth = 0;
  let todayDli = null;
  /* maxPotD 는 house 의 plantSlots 가 주는 물리 치수다. 코어가 폴백 없이 이 값으로
     화분이 올라가는 자리만 고르므로 스텁에도 실제처럼 실어 준다. */
  const slots = [
    { slotId: 'dark-slot', dli: 0.2, maxPotD: 0.30, band: 'critical', ko: '어두움' },
    { slotId: 'arrival-slot', dli: 0.1, maxPotD: 0.30, band: 'critical', ko: '어두움' },
    { slotId: 'banjiha-sill:0', dli: 3.77, maxPotD: 0.21, band: 'slow', ko: '느린 성장' }
  ];
  const growthPhase = () => growth >= 146
    ? { phaseId: 'spear_furled', phaseKo: '말린 새순 등장', progress01: 0,
        nextPhaseId: 'spear_opening', nextPhaseKo: '새순이 펴지는 중' }
    : { phaseId: 'spear_ready', phaseKo: '말린 새순을 준비하는 중',
        progress01: Math.max(0, (growth - 143) / 3),
        nextPhaseId: 'spear_furled', nextPhaseKo: '말린 새순 등장' };
  const io = {
    light: {
      room: { slots },
      daily(day) {
        return {
          sky: { season: 'summer', weather: 'clear' },
          check: { ok: true, badSlots: new Set(), problems: [] },
          report: {
            slots,
            best: slots[2],
            sky: { weather_ko: '맑음' },
            energy: { won: 0 },
            photoperiod: { hours: 0 },
            continuous_injury: false
          }
        };
      }
    },
    growth: {
      assertContract() {},
      setGrowth(days) { cal = days; growth = days; },
      setDailyLight(dli) { todayDli = dli; },
      calendarDay() { return cal; },
      growthDays() { return growth; },
      advanceTo(day) {
        assert.equal(day, cal + 1);
        cal = day;
        const grew = todayDli >= 3;
        if (grew) growth++;
        return { calDay: cal, growth, grew, blocked: grew ? null : '빛 부족' };
      },
      growthBlocked() { return todayDli >= 3 ? null : '빛 부족'; },
      growthPhase,
      dli7() { return todayDli; },
      dliCV() { return 0; },
      ageOf(d) { return d; }
    }
  };

  const S = newState({ room: 'banjiha', mode: 'novice', firstPlay: true, firstPlayRules: TEST_RULES });
  placeBeansprout(S.firstPlay, 'dark-slot');

  for (let day = 1; day <= 4; day++) nextDay(S, io);
  assert.equal(S.day, 4);
  assert.equal(S.firstPlay.beansprout.meals, 3);
  assert.equal(S.firstPlay.food.cashFoodWon, 2500);
  assert.equal(pot0(S).arrivalGrowthDays, 143);
  assert.notEqual(pot0(S).slotId, 'banjiha-sill:0', '몬스테라는 먼저 어두운 자리에 도착해야 한다');

  assert.equal(S.firstPlay.phase, 'move_monstera');
  pot0(S).slotId = 'banjiha-sill:0';
  moveMonstera(S.firstPlay, pot0(S).slotId);
  nextDay(S, io);
  assert.equal(S.firstPlay.phase, 'grow_monstera',
    '창턱으로 옮겨 게이지가 오르는 중이면 "옮겨 보세요"가 남으면 안 된다');
  for (let day = 6; day <= 7; day++) nextDay(S, io);

  assert.equal(S.day, 7);
  assert.equal(pot0(S).daysPlanted, 3);
  assert.equal(S.firstPlay.completed, true);
  assert.equal(S.firstPlay.monstera.growthPhase.phaseId, 'spear_furled');
  assert.deepEqual(S.dliHist, [3.77, 3.77, 3.77]);
}

console.log('first_play_loop: PASS');

/* Day 4 원자성: 몬스테라 초기화가 실패하면 수확·식비·날짜도 Day 3 상태로 돌아가야 한다.
   그렇지 않으면 harvested=true / 화분 없음 상태가 되어 선물을 영원히 재시도하지 못한다. */
{
  let cal = 0;
  let growth = 0;
  const slots = [
    { slotId: 'dark-slot', dli: 0.2, maxPotD: 0.30 },
    { slotId: 'arrival-slot', dli: 0.1, maxPotD: 0.30 },
    { slotId: 'banjiha-sill:0', dli: 3.77, maxPotD: 0.21 }
  ];
  const io = {
    light: {
      room: { slots },
      daily() {
        return {
          sky: { season: 'summer', weather: 'clear' },
          check: { ok: true, badSlots: new Set(), problems: [] },
          report: { slots, best: slots[2], sky: {}, energy: { won: 0 }, photoperiod: { hours: 0 } }
        };
      }
    },
    growth: {
      setGrowth() { throw new Error('도착 초기화 실패 주입'); },
      calendarDay() { return cal; }, growthDays() { return growth; },
      growthPhase() { return { phaseId: 'spear_ready', progress01: 0, nextPhaseId: 'spear_furled' }; }
    }
  };
  const S = newState({ room: 'banjiha', mode: 'novice', firstPlay: true, firstPlayRules: TEST_RULES });
  placeBeansprout(S.firstPlay, 'dark-slot');
  for (let day = 1; day <= 3; day++) nextDay(S, io);
  assert.throws(() => nextDay(S, io), /도착 초기화 실패 주입/);
  assert.equal(S.day, 3);
  assert.equal(S.firstPlay.beansprout.ageDays, 3);
  assert.equal(S.firstPlay.beansprout.harvested, false);
  assert.equal(S.firstPlay.food.totalFoodSavedWon, 0);
  assert.equal(S.pots.length, 0);
}

console.log('first_play_day4_atomic: PASS');
