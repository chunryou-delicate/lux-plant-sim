/* 첫 플레이가 실제로 며칠에 끝나는지 잰다 (docs/story_arc.md 의 "Day 0~16" 검증용).
   ★진짜 게임 경로로 돈다 — 프로파일 조도 + loop.nextDay + growth 어댑터 대역.
     growth 는 브라우저 전용이라 여기서는 유효 생장일만 세는 최소 대역을 쓴다. */
import { readFileSync } from 'node:fs';
import { createProfileLight } from '../src/game/room_profile.js';
import { newState, givePlant, pot0, setPotSlot } from '../src/game/state.js';
import { nextDay } from '../src/game/loop.js';
import { firstPlayRulesFromBalance, placeBeansprout } from '../src/game/first_play.js';

const J = p => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const profile = J('../data/profiles/room_profile.banjiha.json');
const lightTh = J('../data/balance/light_thresholds.json');
const light = createProfileLight(profile, { lightTh, weatherBalance: J('../data/balance/weather.json') });
const rules = firstPlayRulesFromBalance(J('../data/balance/characters.json'));

/* growth 대역 — 자리 밝기에 따라 유효 생장일이 오르내리는 것만 흉내 낸다.
   ★단계 이름은 growth 소유라 지어내지 않는다. 여기서는 "며칠 걸리나"만 본다. */
/* growth 대역 — 단계 이름은 growth 소유라 지어내지 않는다.
   tools/test_fastforward.mjs 의 대역과 **같은 계약**을 쓴다(spear_furled = 146). */
function stubGrowth(start) {
  let cal = start, growth = start, today = null;
  return {
    assertContract() {},
    has: () => true,
    setGrowth(d) { cal = d; growth = d; return { growth, calDay: cal, drawn: true, drawError: null, hudError: null }; },
    setDailyLight(v) { today = v; },
    calendarDay: () => cal, growthDays: () => growth,
    advanceTo(d) { cal = d; const grew = today >= 3; if (grew) growth++;
      return { calDay: cal, growth, grew, blocked: grew ? null : '빛 부족', drawn: true, drawError: null, hudError: null }; },
    growthBlocked: () => (today >= 3 ? null : '빛 부족'),
    growthPhase: () => (growth >= 146
      ? { phaseId: 'spear_furled', phaseKo: '말린 새순 등장', progress01: 0, nextPhaseId: 'spear_opening', nextPhaseKo: '새순이 펴지는 중' }
      : { phaseId: 'spear_ready', phaseKo: '말린 새순을 준비하는 중', progress01: Math.max(0, (growth - 143) / 3),
          nextPhaseId: 'spear_furled', nextPhaseKo: '말린 새순 등장' }),
    dli7: () => today, dliCV: () => 0, ageOf: d => d,
    effectiveGrowthDays: () => growth
  };
}

for (const slotId of ['banjiha-sill:0', 'banjiha-etagere:5', 'banjiha-dresser:1']) {
  const S = newState({ mode: 'novice', room: 'banjiha', firstPlay: true, firstPlayRules: rules });
  light.clearCache();
  const io = { light, growth: stubGrowth(143) };
  placeBeansprout(S.firstPlay, slotId, { slots: light.room.slots });
  let arrivedDay = null, spearDay = null;
  for (let d = 1; d <= 40 && spearDay == null; d++) {
    const r = nextDay(S, io);
    if (!arrivedDay && S.pots.length) {
      arrivedDay = S.day;
      setPotSlot(S, pot0(S), slotId, light.room.slots);
    }
    const eff = io.growth.effectiveGrowthDays();
    if (arrivedDay && eff >= 146) spearDay = S.day;
  }
  const dli = light.dliOfSlot(slotId, { weather: 'clear', season: 'summer', lampCount: 0, litHours: 12 });
  console.log(`${slotId.padEnd(22)} DLI ${dli.toFixed(2).padStart(5)}  수확·도착 Day ${arrivedDay}  말린새순(146) Day ${spearDay}`);
}
