import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  advanceBeansproutDay,
  beansproutHarvestStatus,
  beansproutReady,
  beansproutWaterStatus,
  harvestBeansprout,
  createFirstPlayState,
  firstPlayRulesFromBalance,
  openSiruContractFromManifest,
  markMonsteraArrived,
  markMonsteraPhase,
  moveMonstera,
  placeBeansprout,
  waterBeansprout,
  makeCropPot,
  resowBeansprout
} from '../src/game/first_play.js';
import { nextDay, harvestCrop } from '../src/game/loop.js';
import { newState, pot0, waterCrop, cropHarvestStatus } from '../src/game/state.js';

/* ★ 게임 화면의 [물 주기] + [다음 날] + (거둘 때가 됐으면) [수확하기] = 표준 하루 (2026-08-04).
   물을 준 날만 자라고, **거둬야 곳간에 들어간다** — 재현도 그 두 행위를 그대로 밟는다.
   ⚠ 수확은 [다음 날] **뒤**다. 화면에서 플레이어가 보는 순서가 그것이고, 앞에 두면
     거두는 날이 하루씩 밀려 회전이 5일이 아니라 6일이 된다. */
const day1 = (S, io) => {
  waterCrop(S);
  const r = nextDay(S, io);
  if (beansproutReady(S.firstPlay.beansprout)) r.turn.harvest = harvestCrop(S, io);
  return r;
};

const TEST_RULES = firstPlayRulesFromBalance(JSON.parse(
  readFileSync(new URL('../data/balance/characters.json', import.meta.url), 'utf8')
));
const OPEN_SIRU = openSiruContractFromManifest(JSON.parse(
  readFileSync(new URL('../assets/manifest.json', import.meta.url), 'utf8')
));
assert.equal(OPEN_SIRU.lidState, 'open');
assert.equal(OPEN_SIRU.transmitsSlotDli, true);
assert.equal(OPEN_SIRU.diameterM, 0.24);

/* ★★ 물은 **회전 시작**이다 (2026-08-04 새 규칙 · first_play.js §물주기).
   심고 물을 줘야 그날이 0일차이고, 그 뒤로는 매일 저절로 자란다 — 매일 안 준다.
   그래서 재현도 **한 번만 준다.** 안 주고 굴리는 판(=시작을 안 한 판)은 아래 §물주기가 잰다.
   ⚠ `advanceBeansproutDay` 는 이제 `{watered}` 를 안 받는다. 시작한 시루만 나이를 먹는다. */
const CYCLE = TEST_RULES.harvestDays;
const growDay = (fp, dli) => advanceBeansproutDay(fp, dli);
/* 회전을 시작한다(= [물 주기]). 날짜는 아무 값이나 되지만 0일차라는 뜻은 같다. */
const start = (fp, day = 0) => waterBeansprout(fp, day);

/* ★ 다 자랄 때까지 굴리고 **손으로 거둔다** (2026-08-04). 자동으로 안 거둬진다. */
function growCycle(dli) {
  const fp = createFirstPlayState({ rules: TEST_RULES });
  placeBeansprout(fp, 'dark-slot');
  start(fp);
  for (let day = 1; day <= CYCLE; day++) growDay(fp, dli);
  return { fp, result: harvestBeansprout(fp) };
}

{
  const fp = createFirstPlayState({ rules: TEST_RULES });
  assert.equal(fp.phase, 'place_beansprout');
  assert.throws(() => growDay(fp, 0.2), /자리/);

  placeBeansprout(fp, 'banjiha-dresser:1');
  /* ★★ 물을 줘야 시작한다 — 놓기만 해서는 하루가 가도 안 자란다(§물주기) */
  assert.equal(growDay(fp, 0.2).grew, 0, '★물을 안 줬는데 자랐다');
  assert.equal(fp.beansprout.ageDays, 0);
  assert.equal(start(fp, 0).started, 1, '★[물 주기]가 시루를 시작시키지 못했다');
  for (let day = 1; day <= 2; day++) {
    const result = growDay(fp, 0.2);
    assert.equal(result.harvested, false, `${day}일에는 수확되면 안 된다`);
    assert.equal(result.ready, false, `${day}일에는 거둘 수 없다`);
  }
  placeBeansprout(fp, 'another-dark-slot');
  assert.equal(fp.beansprout.slotId, 'another-dark-slot');
  for (let day = 3; day < CYCLE; day++)
    assert.equal(growDay(fp, 0.2).harvested, false, `${day}일에는 수확되면 안 된다`);

  /* ★★ 다 자란 날 — **저절로 안 거둬진다** (2026-08-04 · first_play.js §수확) */
  const last = growDay(fp, 0.2);
  assert.equal(last.harvested, false, '★자라는 날이 찼다고 저절로 거둬졌다');
  assert.equal(last.ready, true, '거둘 수 있는 상태가 안 됐다');
  assert.equal(last.justReady, true, '오늘 막 다 자랐다는 표시가 없다');
  assert.equal(fp.food.pantryWon, 0, '★안 거뒀는데 곳간에 돈이 들어갔다');
  assert.equal(fp.phase, 'grow_beansprout', '★안 거뒀는데 선물 단계로 넘어갔다');
  assert.equal(beansproutReady(fp.beansprout), true);
  assert.deepEqual(beansproutHarvestStatus(fp), null, '첫 플레이가 꺼져 있으면 상태도 없다');

  /* ★ 안 거두고 하루가 더 가도 **아무 일도 안 난다** — 벌은 회전이 멈추는 것뿐이다 */
  const idle = growDay(fp, 0.2);
  assert.equal(idle.ready, true);
  assert.equal(idle.justReady, false, '전환은 한 번뿐이다 — 매일 나면 점핑이 못 돈다');
  assert.equal(idle.grew, 0, '★다 자란 시루가 또 자랐다');
  assert.equal(fp.beansprout.ageDays, CYCLE, '다 자란 뒤에 더 자랐다');

  /* ★ 물도 안 요구한다 — 물은 회전당 한 번이라 이미 줬다(§물주기).
     다 자란 시루에 [물 주기]가 또 뜨면 버튼 뜻이 둘이 된다. */
  const ws = beansproutWaterStatus({ ...fp, enabled: true }, 9);
  assert.equal(ws.needsWater, false, '★이미 시작한 시루가 또 물을 요구한다');
  assert.equal(ws.waiting, 0, '★시작한 시루가 대기로 잡혔다');
  assert.equal(ws.ready, true);

  /* ★ [수확하기] 를 눌러야 들어간다 */
  const harvest = harvestBeansprout(fp);
  assert.deepEqual(
    {
      harvested: harvest.harvested,
      meals: harvest.meals,
      quality: harvest.quality,
      /* ★ 절감은 **곳간에 들어간다** — 거둔 날 몰아 쓰지 않는다(first_play.js §eatFromPantry).
         한 회전 3,000원이 5일에 걸쳐 600원씩 나간다. */
      cycleSavedWon: harvest.cycleSavedWon,
      pantryWon: fp.food.pantryWon,
      phase: fp.phase
    },
    {
      harvested: true,
      meals: 3,
      quality: 'crisp_white',
      cycleSavedWon: 3000,
      pantryWon: 3000,
      phase: 'monstera_gift'
    }
  );
  /* 두 번 눌러도 두 번 안 거둬진다 */
  assert.throws(() => harvestBeansprout(fp), /이미 거둔/);
  assert.equal(fp.food.pantryWon, 3000, '★두 번째 누름이 곳간에 또 들어갔다');
}

/* ★ 덜 자란 시루는 못 거둔다 — 안내지 고장이 아니다 */
{
  const fp = createFirstPlayState({ enabled: true, rules: TEST_RULES });
  placeBeansprout(fp, 'dark-slot');
  start(fp);
  growDay(fp, 0.2);
  const st = beansproutHarvestStatus(fp);
  assert.deepEqual({ ready: st.ready, daysLeft: st.daysLeft }, { ready: false, daysLeft: CYCLE - 1 });
  let err = null;
  try { harvestBeansprout(fp); } catch (e) { err = e; }
  assert.match(err.message, /더 자라야 합니다/);
  assert.equal(err.tutorialInput, true, 'game.html 의 isRecoverable 이 보는 표식');
  assert.equal(fp.beansprout.harvested, false);
}

/* ★★ 물주기 = **회전 시작** (2026-08-04 새 규칙 · first_play.js §물주기)
   ------------------------------------------------------------
   옛 검사가 지키려던 것 셋을 그대로 지킨다 — 규칙만 새것으로 옮겼다.
     ① "물이 속도를 가른다"            → **물이 시작을 가른다**(안 주면 아예 안 자란다)
     ② "안 자란 날은 이력에 안 쌓인다"  → 시작 안 한 날은 이력에 안 쌓인다(빛 축 분리)
     ③ "죽지 않는다"                   → 며칠을 안 줘도 상태가 살아 있고, 주면 그날부터 돈다 */
{
  const fp = createFirstPlayState({ rules: TEST_RULES });
  placeBeansprout(fp, 'dark-slot');

  /* ① 안 주면 아무 일도 안 난다 — 벌이 아니라 **아직 시작을 안 한 것**이다 */
  const notyet = advanceBeansproutDay(fp, 0.2);
  assert.equal(notyet.grew, 0, '★물을 안 줬는데 자랐다');
  assert.equal(notyet.idle, 1, '★시작을 기다리는 시루가 안 세어졌다');
  assert.equal(fp.beansprout.ageDays, 0, '★물을 안 줬는데 하루가 갔다');
  /* ② 시작 안 한 날의 빛은 이력에 안 쌓인다 — 물이 품질(빛 축)을 못 건드린다 */
  assert.equal(fp.beansprout.dliHist.length, 0, '★시작도 안 한 날의 빛이 이력에 쌓였다');

  /* ★ 두 번 눌러도 회전이 앞당겨지지 않는다 — 이미 시작한 시루는 다시 안 받는다 */
  assert.equal(waterBeansprout(fp, 5).watered, true);
  assert.equal(waterBeansprout(fp, 5).already, true, '★이미 시작한 시루가 또 시작됐다');
  assert.equal(waterBeansprout(fp, 6).already, true, '★다음 날 누른 것이 회전을 다시 시작시켰다');
  assert.equal(fp.beansprout.pots[0].startedOnDay, 5, '★0일차가 첫 물 준 날이 아니다');

  /* ③ 죽지 않는다 — 그냥 둬도 살아 있고, 시작한 뒤로는 저절로 자란다 */
  for (let d = 1; d <= CYCLE; d++) growDay(fp, 0.2);
  const last = harvestBeansprout(fp, { day: 15 });
  assert.equal(last.harvested, true, '★물을 준 뒤에도 회전이 안 돌았다');
  assert.equal(last.quality, 'crisp_white', '★물주기가 품질을 바꿨다 — 축이 겹쳤다');
  assert.equal(last.cycleSavedWon, 3000, '★늦게 시작한 것이 절감액 자체를 깎았다');
  assert.equal(last.harvestedPots, 1);
}

/* ★★ 겹침 — **같은 날 거둔 둘째·셋째는 깎인다** (2026-08-04 · first_play.js §겹침)
   3,000 → 2,000 → 1,000 → 0. 시차를 만들 이유가 이 표 하나다. */
{
  const fp = createFirstPlayState({ rules: TEST_RULES });
  placeBeansprout(fp, 'dark-slot');
  /* 시루 넷을 **같은 날** 시작한다 — 넷 다 같은 날 익는다 */
  for (let i = 2; i <= 4; i++) fp.beansprout.pots.push(makeCropPot('crop_01_0' + i));
  assert.equal(waterBeansprout(fp, 0, { all: true }).started, 4, '★[전부 주기]가 안 먹혔다');
  for (let d = 1; d <= CYCLE; d++) growDay(fp, 0.2);

  const h = harvestBeansprout(fp, { day: CYCLE });
  assert.equal(h.harvestedPots, 4, '★한 번에 다 안 거둬졌다 — 시루마다 누르게 되어 있다');
  assert.deepEqual(h.perPot.map(p => p.savedWon), [3000, 2000, 1000, 0],
    '★같은 날 거둔 것이 안 깎였다 — 겹침이 안 물린다');
  assert.equal(h.cycleSavedWon, 6000);
  assert.equal(h.overlapLostWon, 1000 + 2000 + 3000, '겹쳐서 못 받은 몫이 안 맞는다');

  /* ★ 시차를 두면 안 깎인다 — 같은 시루 넷을 **다른 날** 거두면 넷 다 3,000원이다.
     ★★ 이것이 박사님 그림이다: "5일 주기니까 5개까지 1일씩 안 겹치게 하면 매일 다 3,000". */
  const fp2 = createFirstPlayState({ rules: TEST_RULES });
  placeBeansprout(fp2, 'dark-slot');
  for (let i = 2; i <= 4; i++) fp2.beansprout.pots.push(makeCropPot('crop_01_0' + i));
  const got = [];
  for (let d = 1; d <= CYCLE + 4; d++) {
    /* ★ 하루에 **한 시루씩** 시작한다 — 이게 플레이어가 [물 주기]를 하루씩 걸러 누르는 것이다.
       ⚠ 하루가 가기 전에 넷을 다 주면 시차가 아니라 같은 날 시작이 된다(위 판이 그 경우다). */
    waterBeansprout(fp2, d);
    growDay(fp2, 0.2);
    if (beansproutReady(fp2.beansprout)) {
      const r = harvestBeansprout(fp2, { day: d });
      assert.equal(r.harvestedPots, 1, `Day ${d} 에 시루 둘이 같이 익었다 — 시차가 무너졌다`);
      got.push(...r.perPot.map(p => p.savedWon));
      resowBeansprout(fp2, { day: d });                     // 거둔 것만 다시 심는다
    }
  }
  assert.deepEqual(got, [3000, 3000, 3000, 3000],
    '★하루씩 어긋나게 거뒀는데 깎였다 — 시차가 값을 못 지킨다');
}

{
  const low = growCycle(0.3).result;
  const medium = growCycle(0.7).result;
  const bright = growCycle(1.2).result;
  assert.equal(low.meals, 3);
  assert.equal(medium.meals, 2);
  assert.equal(bright.meals, 1);
  /* ★ 자리(빛)가 값을 가른다 — 끼니 라벨이 원으로 그대로 옮겨졌다 */
  assert.equal(low.cycleSavedWon, 3000);
  assert.equal(medium.cycleSavedWon, 2000);
  assert.equal(bright.cycleSavedWon, 1000);
}

/* ★★ 시루를 늘려도 **같은 날 거두면** 안 는다 (2026-08-04 재정정 · first_play.js §겹침)
   ------------------------------------------------------------
   옛 검사는 "시루를 늘려도 절감이 아예 안 는다"였다. 그 규칙은 시루를 살 이유를 없앴다.
   지금 지키는 것은 그 자리에 들어온 새 규칙이다: **겹치면 깎이고, 어긋나면 온전히 받는다.**
   그래서 여섯 시루를 같은 날 거두면 3,000+2,000+1,000 이고 넷째부터는 0원이다 —
   ★천장(5일 주기 = 5개)이 규칙에서 나온다는 것이 이 줄로 확인된다. */
{
  const one = growCycle(0.2).result;
  const fp = createFirstPlayState({ rules: TEST_RULES });
  placeBeansprout(fp, 'dark-slot');
  for (let i = 2; i <= 6; i++) fp.beansprout.pots.push(makeCropPot('crop_01_0' + i));
  waterBeansprout(fp, 0, { all: true });                // 여섯을 **같은 날** 시작한다
  for (let d = 1; d <= CYCLE; d++) growDay(fp, 0.2);
  const six = harvestBeansprout(fp, { day: CYCLE });
  assert.equal(six.harvestedPots, 6);
  assert.deepEqual(six.perPot.map(p => p.savedWon), [3000, 2000, 1000, 0, 0, 0],
    '★같은 날 거둔 넷째부터가 0원이 아니다 — 천장이 규칙에서 안 나온다');
  assert.equal(six.cycleSavedWon, 6000);
  assert.equal(six.cycleSavedWon, one.cycleSavedWon * 2,
    '★여섯 시루를 같은 날 거둔 값이 한 시루의 두 배(3,000+2,000+1,000)가 아니다');
  assert.equal(six.overlapCount, 5, '겹친 시루 수를 안 세고 있다');
}

{
  const { fp } = growCycle(0.2);
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
  const { fp } = growCycle(0.2);
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

  for (let day = 1; day <= CYCLE; day++) day1(S, io);
  assert.equal(S.day, CYCLE);
  assert.equal(S.firstPlay.beansprout.meals, 3);
  /* ★★ 거둔 날은 **곳간에 넣기만 한다** (2026-08-04). 꺼내 먹는 것은 다음 [다음 날] 부터다 —
     수확이 손 동작이 되면서 거두는 순간과 하루 정산이 갈렸다(first_play.js §harvestBeansprout).
     같은 날 또 꺼내면 하루 상한 600원이 그 자리에서 깨진다. */
  assert.equal(S.firstPlay.food.cashFoodWon, TEST_RULES.dailyFoodWon,
    '★거둔 그 날에 곳간에서 또 꺼냈습니다 — 하루에 두 번 먹었습니다');
  assert.equal(S.firstPlay.food.pantryWon, TEST_RULES.cropSavedWonPerCycle,
    '곳간에 들어간 몫이 안 맞습니다');

  /* ★수확한 날의 배움이 실제로 적혔는가 (2026-08-03 재발 방지 · 2026-08-04 자리 이동).
     ★ 이제 배움 ①·②는 **턴 밖**(loop.harvestCrop)에서 켜진다 — 거두는 순간에만 증거가 온전해서다.
       턴으로 미루면 "거두고 바로 다시 심은" 판에서 avgDli 가 초기화돼 배움이 조용히 사라진다. */
  assert.equal(S.tutorial.learned.harvest, true,
    '★수확·식비 절감이 배움에 안 적혔습니다 — harvestCrop 이 배움을 안 켜고 있습니까?');
  assert.equal(S.tutorial.learned.cropDark, true,
    '★어두운 자리 수확(4일평균 낮음)이 배움에 안 적혔습니다');
  /* 첫 플레이 중에는 살림이 멈춰 있어야 한다 — 그 16일은 배우는 구간이다 */
  assert.equal(S.tutorial.day, 0, '첫 플레이 중인데 반지하 날짜가 갔습니다');
  assert.equal(S.tutorial.cashWon, S.tutorial.rules.startCashWon, '첫 플레이 중인데 돈이 빠졌습니다');
  assert.equal(pot0(S).arrivalGrowthDays, 143);
  assert.notEqual(pot0(S).slotId, 'banjiha-sill:0', '몬스테라는 먼저 어두운 자리에 도착해야 한다');

  assert.equal(S.firstPlay.phase, 'move_monstera');
  pot0(S).slotId = 'banjiha-sill:0';
  moveMonstera(S.firstPlay, pot0(S).slotId);
  nextDay(S, io);
  /* ★ 곳간은 **거둔 다음 날부터** 열린다 — 거둔 그 날에는 한 입도 안 꺼냈다(위 ★★) */
  assert.equal(S.firstPlay.food.cashFoodWon, TEST_RULES.dailyFoodWon - TEST_RULES.dailyCropSaveWon);
  assert.equal(S.firstPlay.food.pantryWon,
    TEST_RULES.cropSavedWonPerCycle - TEST_RULES.dailyCropSaveWon, '곳간에 남은 몫이 안 맞습니다');
  assert.equal(S.firstPlay.phase, 'grow_monstera',
    '창턱으로 옮겨 게이지가 오르는 중이면 "옮겨 보세요"가 남으면 안 된다');
  for (let day = CYCLE + 2; day <= CYCLE + 3; day++) nextDay(S, io);

  assert.equal(S.day, CYCLE + 3);
  assert.equal(pot0(S).daysPlanted, 3);
  assert.equal(S.firstPlay.completed, true);
  assert.equal(S.firstPlay.monstera.growthPhase.phaseId, 'spear_furled');
  assert.deepEqual(S.dliHist, [3.77, 3.77, 3.77]);
}

console.log('first_play_loop: PASS');

/* ★ 수확 원자성 (2026-08-04 이사): 몬스테라 초기화가 실패하면 **수확도 안 난 것으로** 돌아간다.
   그렇지 않으면 harvested=true / 화분 없음 상태가 되어 선물을 영원히 재시도하지 못한다.
   ⚠ 예전에는 이 원자성이 nextDay 의 Day 4 되감기였다(날짜까지 되돌렸다). 이제 날짜는 이미
     확정된 뒤라 되돌릴 것이 수확 하나뿐이다 — 플레이어는 [수확하기]를 다시 누르면 된다. */
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
  /* 다 자랄 때까지는 아무 일도 안 난다 — 선물은 [수확하기]에 달려 있으므로 여기서는 안 터진다 */
  for (let day = 1; day <= CYCLE; day++) { waterCrop(S); nextDay(S, io); }
  assert.equal(S.day, CYCLE, '★선물이 실패하는 판인데 자라는 날에서 이미 터졌습니다');
  assert.equal(beansproutReady(S.firstPlay.beansprout), true);

  let err = null;
  try { harvestCrop(S, io); } catch (e) { err = e; }
  assert.match(err.message, /도착 초기화 실패 주입/);
  assert.equal(err.harvestRolledBack, true, '수확을 물렀다는 표식이 없습니다');
  assert.equal(S.day, CYCLE, '★날짜는 이미 확정된 뒤다 — 되감으면 오히려 어긋난다');
  assert.equal(S.firstPlay.beansprout.ageDays, CYCLE);
  assert.equal(S.firstPlay.beansprout.harvested, false, '★수확이 안 물렸습니다');
  assert.equal(S.firstPlay.food.pantryWon, 0, '★무른 수확이 곳간에 남았습니다');
  assert.equal(S.firstPlay.food.totalFoodSavedWon, 0);
  assert.equal(S.pots.length, 0);
  /* ★ 잠기지 않는다 — 거둘 수 있는 상태 그대로라 다시 누를 수 있다 */
  assert.equal(cropHarvestStatus(S).canHarvest, true, '★무른 뒤에 다시 거둘 수 없게 됐습니다');
}

console.log('first_play_harvest_atomic: PASS');
