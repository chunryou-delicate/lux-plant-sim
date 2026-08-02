import assert from 'node:assert/strict';
import { nextDay } from '../src/game/loop.js';
import { givePlant, newState } from '../src/game/state.js';

const slots = [{ slotId: 'slot', dli: 3.77, band: 'slow', ko: '느린 성장' }];
const light = {
  room: { slots },
  daily() {
    return {
      sky: { season: 'summer', weather: 'clear' },
      check: { ok: true, badSlots: new Set(), problems: [] },
      report: { slots, best: slots[0], energy: { won: 0 }, photoperiod: { hours: 0 } }
    };
  }
};

function stateWithPlant(growth) {
  const S = newState({ room: 'banjiha', mode: 'novice' });
  givePlant(S, { growth }, { slotId: 'slot' });
  return S;
}

{
  const growth = {
    setGrowth() {},
    assertContract() { throw new Error('계약 끊김'); }
  };
  const S = stateWithPlant(growth);
  let error;
  try { nextDay(S, { light, growth }); } catch (e) { error = e; }
  assert.equal(error.turnState, 'not_started');
  assert.equal(S.day, 0);
}

{
  let calendarReads = 0;
  const growth = {
    setGrowth() {}, assertContract() {}, setDailyLight() {},
    calendarDay() { if (++calendarReads === 1) return 143; throw new Error('달력 소실'); },
    advanceTo() { throw new Error('진행 실패'); }
  };
  const S = stateWithPlant(growth);
  let error;
  try { nextDay(S, { light, growth }); } catch (e) { error = e; }
  assert.equal(error.turnState, 'unknown');
  assert.equal(S.day, 1, '진행 여부가 불명인데 임의로 되감지 않는다');
  assert.equal(S.desync.growthCalendar, null);
}

{
  let cal = 143;
  const growth = {
    setGrowth() {}, assertContract() {}, setDailyLight() {},
    calendarDay() { return cal; },
    advanceTo() { throw new Error('달력 진행 전 실패'); }
  };
  const S = stateWithPlant(growth);
  let error;
  try { nextDay(S, { light, growth }); } catch (e) { error = e; }
  assert.equal(error.turnState, 'growth_input_recorded');
  assert.equal(S.day, 0);
  assert.match(S.desync.note, /DLI 입력/);
}

console.log('loop_errors: PASS');
