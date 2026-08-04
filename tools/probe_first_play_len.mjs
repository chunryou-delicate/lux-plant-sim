/* 첫 플레이가 실제로 며칠에 끝나는지 잰다 (docs/story_arc.md 의 "Day 0~16" 검증용).
   ★진짜 게임 경로로 돈다 — 프로파일 조도 + loop.nextDay + growth 어댑터 대역.
     growth 는 브라우저 전용이라 여기서는 유효 생장일만 세는 최소 대역을 쓴다. */
import { readFileSync } from 'node:fs';
import { createProfileLight } from '../src/game/room_profile.js';
import { newState, givePlant, pot0, setPotSlot, waterCrop, resowCrop, ARRIVAL } from '../src/game/state.js';
import { orderItem, stockOf, incomingOf } from '../src/game/shop.js';

/* ★★ 2026-08-04 — 도착 진행도가 **줄기 1개짜리**로 내려갔고(state.ARRIVAL),
   그 뒤 첫 말린 새순은 유효 61 이다 — 재서 나온 값(tools/probe_arrival_stems.mjs).
   유효 61 은 곧 **2개째 줄기의 첫 잎**이라, 첫 플레이의 끝과 "2개째가 자란다"가 같은 사건이다. */
const ARR = ARRIVAL.growthDays;
const SPEAR = 61;
import { nextDay, harvestCrop } from '../src/game/loop.js';
import { firstPlayRulesFromBalance, placeBeansprout, beansproutReady } from '../src/game/first_play.js';

/* ★자가 제한 — 재는 도구가 재는 대상보다 오래 살면 안 된다.
   이게 없어서 측정 하나가 21시간 매달려 있었다. 헤드리스 크롬은 무언가를
   기다리다 영영 안 끝나는 일이 실제로 생긴다. 시간은 환경변수로 늘릴 수 있다. */
const _WATCHDOG_MS = +(process.env.BYEOT_PROBE_TIMEOUT_MS || 300000);
const _wd = setTimeout(() => {
  console.error('⏱ 자가 제한 ' + Math.round(_WATCHDOG_MS / 1000) + '초를 넘겨 멈춥니다 — 재는 중에 멈춘 것입니다.');
  process.exit(2);
}, _WATCHDOG_MS);
/* ★타이머가 프로세스를 붙잡으면 안 된다 — unref 를 빠뜨려서
   재기를 다 끝낸 도구가 제한 시간까지 안 죽고 매달려 있었다(넣자마자 났다). */
_wd.unref && _wd.unref();
process.on('exit', () => clearTimeout(_wd));


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
    growthPhase: () => (growth >= SPEAR
      ? { phaseId: 'spear_furled', phaseKo: '말린 새순 등장', progress01: 0, nextPhaseId: 'spear_opening', nextPhaseKo: '새순이 펴지는 중' }
      : { phaseId: 'spear_ready', phaseKo: '말린 새순을 준비하는 중', progress01: Math.max(0, (growth - ARR) / (SPEAR - ARR)),
          nextPhaseId: 'spear_furled', nextPhaseKo: '말린 새순 등장' }),
    dli7: () => today, dliCV: () => 0, ageOf: d => d,
    effectiveGrowthDays: () => growth
  };
}

for (const slotId of ['banjiha-sill:0', 'banjiha-etagere:5', 'banjiha-dresser:1']) {
  const S = newState({ mode: 'novice', room: 'banjiha', firstPlay: true, firstPlayRules: rules });
  light.clearCache();
  const io = { light, growth: stubGrowth(ARR) };
  placeBeansprout(S.firstPlay, slotId, { slots: light.room.slots });
  let arrivedDay = null, spearDay = null;
  for (let d = 1; d <= 120 && spearDay == null; d++) {
    /* ★ 몬스테라는 **3회전째**에 온다 (2026-08-04) — 그래서 거둔 시루는 다시 심는다 */
    const b = S.firstPlay.beansprout;
    if (b && b.harvested) {
      if (stockOf(S, 'bean_seed') < 1 && incomingOf(S, 'bean_seed') < 1)
        try { orderItem(S, 'bean_seed', 1); } catch { /* 다음 날 */ }
      if (stockOf(S, 'bean_seed') >= 1)
        try { resowCrop(S, { at: slotId, slots: light.room.slots }); } catch { /* 다음 날 */ }
    }
    /* ★ [물 주기] + [다음 날] + [수확하기] 가 표준 하루다 (2026-08-04 · §물주기 · §수확) */
    try { waterCrop(S); } catch { /* 이미 거둔 시루 */ }
    nextDay(S, io);
    /* ★ 거둬야 몬스테라가 온다 — 자동으로 안 거둬진다 */
    if (beansproutReady(S.firstPlay.beansprout)) harvestCrop(S, io);
    if (!arrivedDay && S.pots.length) {
      arrivedDay = S.day;
      setPotSlot(S, pot0(S), slotId, light.room.slots);
    }
    const eff = io.growth.effectiveGrowthDays();
    if (arrivedDay && eff >= SPEAR) spearDay = S.day;
  }
  const dli = light.dliOfSlot(slotId, { weather: 'clear', season: 'summer', lampCount: 0, litHours: 12 });
  console.log(`${slotId.padEnd(22)} DLI ${dli.toFixed(2).padStart(5)}  도착(3회전) Day ${arrivedDay}  ` +
              `말린새순=2개째 줄기의 첫 잎(유효 ${SPEAR}) Day ${spearDay}`);
}
