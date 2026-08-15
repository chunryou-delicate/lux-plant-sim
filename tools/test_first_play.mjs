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
  monsteraGuideOf,
  firstPlaySnapshot,
  firstPlayEventsOf,
  MONSTERA_ARRIVAL_RULE,
  MONSTERA_HINT_DAYS,
  MONSTERA_LAMP_HINT_DAYS,
  moveMonstera,
  placeBeansprout,
  waterBeansprout,
  makeCropPot,
  resowBeansprout,
  /* ★ 2026-08-16 · 그램 셈 — 숫자를 박지 않고 규칙에서 읽는다(first_play §그램) */
  cropCycleSavedWon
} from '../src/game/first_play.js';
import { nextDay, harvestCrop } from '../src/game/loop.js';
import { newState, pot0, waterCrop, waterPot, cropHarvestStatus, resowCrop, ARRIVAL } from '../src/game/state.js';
import { orderItem, stockOf, incomingOf, buyPriceOf } from '../src/game/shop.js';

/* ★ 게임 화면의 [물 주기] + [다음 날] + (거둘 때가 됐으면) [수확하기] = 표준 하루 (2026-08-04).
   물을 준 날만 자라고, **거둬야 곳간에 들어간다** — 재현도 그 두 행위를 그대로 밟는다.
   ⚠ 수확은 [다음 날] **뒤**다. 화면에서 플레이어가 보는 순서가 그것이고, 앞에 두면
     거두는 날이 하루씩 밀려 회전이 5일이 아니라 6일이 된다. */
const day1 = (S, io) => {
  waterCrop(S);
  try { waterPot(S); } catch { /* 아직 없거나 안 놓은 화분 — 그런 날은 물이 안 든다 */ }
  const r = nextDay(S, io);
  if (beansproutReady(S.firstPlay.beansprout)) r.turn.harvest = harvestCrop(S, io);
  return r;
};

/* ★ 몬스테라는 이제 **첫 수확이 아니라 3회전째**에 온다 (2026-08-04 · first_play.monsteraArrivalDue).
   그래서 재현도 회전을 그만큼 돌린다 — 씨앗을 주문해 하루 기다렸다 다시 심는 것까지
   게임 화면의 순서 그대로다. 도착할 때까지 돌리고, 안 오면 그 자체가 고장이라 던진다. */
const rotateUntilArrival = (S, io, at) => {
  for (let guard = 0; guard < 60 && !pot0(S); guard++) {
    const b = S.firstPlay.beansprout;
    if (b.harvested) {
      if (stockOf(S, 'bean_seed') < 1 && incomingOf(S, 'bean_seed') < 1)
        try { orderItem(S, 'bean_seed', 1); } catch { /* 돈이 없으면 다음 날 */ }
      if (stockOf(S, 'bean_seed') >= 1)
        try { resowCrop(S, { at, slots: io.light.room.slots }); } catch { /* 재고가 안 맞으면 다음 날 */ }
    }
    day1(S, io);
  }
  assert.ok(pot0(S), '★회전을 예순 번 돌려도 몬스테라가 안 왔습니다 — 도착 조건이 영영 안 열립니다');
  return S.firstPlay.beansprout.harvestCount;
};

const TEST_RULES = firstPlayRulesFromBalance(JSON.parse(
  readFileSync(new URL('../data/balance/characters.json', import.meta.url), 'utf8')
));
/* ★★ 2026-08-16 — **최상 품질 한 회전이 얼마인가를 읽어 온다**(first_play §그램).
   숫자를 박으면 셈이 바뀔 때 이 파일이 조용히 거짓이 된다 — 실제로 3,000원이 그렇게 낡았다. */
const BEST_CYCLE_WON = cropCycleSavedWon(TEST_RULES, TEST_RULES.qualityMaxMeals, 0, 0);
/* 같은 날 첫째·둘째·셋째·넷째로 거둘 때의 값(§겹침). 넷째는 0 — 표 길이가 셋이라서다 */
const OVERLAP_WON = [0, 1, 2, 3].map(t => cropCycleSavedWon(TEST_RULES, TEST_RULES.qualityMaxMeals, t, 0));
/* 품질 세 칸(3·2·1끼)의 회전분 — 자리(빛)가 값을 가르는 그 표다 */
const QUALITY_WON = [3, 2, 1].map(m => cropCycleSavedWon(TEST_RULES, m, 0, 0));
const OPEN_SIRU = openSiruContractFromManifest(JSON.parse(
  readFileSync(new URL('../assets/manifest.json', import.meta.url), 'utf8')
));
assert.equal(OPEN_SIRU.lidState, 'open');
assert.equal(OPEN_SIRU.transmitsSlotDli, true);
assert.equal(OPEN_SIRU.diameterM, 0.24);
/* ★ 2026-08-09 — 가방(빈 용기) 칸만 **뚜껑 덮인 시루**다 (박사님 지시).
   글은 "아직 아무것도 안 선 빈 시루"인데 그림은 다 자란 열린 시루였다.
   ⚠ 방에 세울 물건은 그대로 열린 시루다 — thumbnail·치수·차광은 안 바뀐다. */
assert.equal(OPEN_SIRU.bagLidState, 'closed',
  '가방 그림이 뚜껑 덮인 시루가 아닙니다 — assets/manifest.json 에 lid_state:"closed" 짝이 있어야 합니다');
assert.equal(OPEN_SIRU.bagThumbnail, './assets/crops/thumbs/container_siru_closed.png');
assert.notEqual(OPEN_SIRU.bagThumbnail, OPEN_SIRU.thumbnail,
  '★가방 그림과 방 그림이 같습니다 — 가른 이유가 사라졌습니다');
assert.equal(OPEN_SIRU.thumbnail, './assets/crops/thumbs/container_siru_open.png',
  '★방에 서는 시루 그림이 바뀌었습니다 — 여기는 열린 시루 그대로여야 합니다');

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
  /* ⚠ 2026-08-10 — 문구가 「자리」에서 「시루를 먼저 방 안에 놓아 주세요」로 바뀌었다(f26aeef).
     문지기가 자리 사본이 아니라 **방에 선 시루**를 세게 되면서다. 지킬 것은 문구가 아니라
     「안 놓았으면 하루가 안 간다 · 그것이 복구 가능한 안내다」이므로, 둘 다 받고
     `firstPlayInput` 표를 같이 본다 — 표가 없으면 화면이 복구 불가로 읽고 버튼을 잠근다. */
  assert.throws(() => growDay(fp, 0.2),
    e => /자리|방 안에 놓/.test(e.message) && e.firstPlayInput === true);

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
         ⚠⚠ 2026-08-16 — 여기 **3,000원이 박혀 있었다.** 그것이 이 줄이 지키던 옛 약속이다:
           「최상 품질 한 회전 = 3,000원」. 박사님이 g 으로 셈을 정하시면서
           최상 품질(하얗고 아삭)이 **400g = 4,000원**이 됐다(first_play §그램).
           3,000원은 이제 **중간 품질**(살짝 초록 300g)의 값이다.
         ⇒ 숫자를 다시 박지 않는다. **규칙에서 읽는다**(START-HERE §2.8 의 그 사고를 피한다). */
      cycleSavedWon: harvest.cycleSavedWon,
      pantryWon: fp.food.pantryWon,
      phase: fp.phase
    },
    {
      harvested: true,
      meals: 3,
      quality: 'crisp_white',
      cycleSavedWon: BEST_CYCLE_WON,
      pantryWon: BEST_CYCLE_WON,
      phase: 'monstera_gift'
    }
  );
  /* 두 번 눌러도 두 번 안 거둬진다 */
  assert.throws(() => harvestBeansprout(fp), /이미 거둔/);
  assert.equal(fp.food.pantryWon, BEST_CYCLE_WON, '★두 번째 누름이 곳간에 또 들어갔다');
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
  assert.equal(last.cycleSavedWon, BEST_CYCLE_WON, '★늦게 시작한 것이 절감액 자체를 깎았다');
  assert.equal(last.harvestedPots, 1);
}

/* ★★ 겹침 — **같은 날 거둔 둘째·셋째는 깎인다** (2026-08-04 · first_play.js §겹침)
   3,000 → 2,000 → 1,000 → 0. 시차를 만들 이유가 이 표 하나다. */
{
  const fp = createFirstPlayState({ rules: TEST_RULES });
  /* 시루 넷을 **같은 날** 시작한다 — 넷 다 같은 날 익는다.
     ★★ 2026-08-09 — **만든 뒤에 놓는다**(first_play §자리는 시루마다 따로다).
       자리가 시루마다 생기면서 안 놓인 시루는 물도 안 받는다. `potId` 없이 놓으면
       그 자리의 시루 전부가 함께 서므로 예전과 같은 「한 자리에 넷」이 된다. */
  for (let i = 2; i <= 4; i++) fp.beansprout.pots.push(makeCropPot('crop_01_0' + i));
  placeBeansprout(fp, 'dark-slot');
  assert.equal(waterBeansprout(fp, 0, { all: true }).started, 4, '★[전부 주기]가 안 먹혔다');
  for (let d = 1; d <= CYCLE; d++) growDay(fp, 0.2);

  const h = harvestBeansprout(fp, { day: CYCLE });
  assert.equal(h.harvestedPots, 4, '★한 번에 다 안 거둬졌다 — 시루마다 누르게 되어 있다');
  assert.deepEqual(h.perPot.map(p => p.savedWon), OVERLAP_WON,
    '★같은 날 거둔 것이 안 깎였다 — 겹침이 안 물린다');
  assert.equal(h.cycleSavedWon, OVERLAP_WON.reduce((a, v) => a + v, 0));
  assert.equal(h.overlapLostWon,
    OVERLAP_WON.reduce((a, v) => a + (BEST_CYCLE_WON - v), 0), '겹쳐서 못 받은 몫이 안 맞는다');

  /* ★ 시차를 두면 안 깎인다 — 같은 시루 넷을 **다른 날** 거두면 넷 다 3,000원이다.
     ★★ 이것이 박사님 그림이다: "5일 주기니까 5개까지 1일씩 안 겹치게 하면 매일 다 3,000". */
  const fp2 = createFirstPlayState({ rules: TEST_RULES });
  /* ★ 위와 같은 이유로 **만든 뒤에 놓는다** (2026-08-09 · §자리는 시루마다 따로다) */
  for (let i = 2; i <= 4; i++) fp2.beansprout.pots.push(makeCropPot('crop_01_0' + i));
  placeBeansprout(fp2, 'dark-slot');
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
  assert.deepEqual(got, [BEST_CYCLE_WON, BEST_CYCLE_WON, BEST_CYCLE_WON, BEST_CYCLE_WON],
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
  /* ⚠⚠ 2026-08-16 — 여기 3,000 / 2,000 / 1,000 이 박혀 있었다. 그것이 이 줄이 지키던
     옛 약속이다(「최상 3,000원 · 끼니 비례」). 이제 400 / 300 / 200g = 4,000 / 3,000 / 2,000원이다
     (first_play §그램 — 중간빛 300g 을 기준점으로 ±100g). 숫자는 규칙에서 읽는다. */
  assert.deepEqual([low.cycleSavedWon, medium.cycleSavedWon, bright.cycleSavedWon], QUALITY_WON);
  /* ★ g 이 정본인 작물이라 원이 정확히 10 의 배수다 — 「약 몇 g」이 아니다 */
  assert.deepEqual([low.perPot[0].grams, medium.perPot[0].grams, bright.perPot[0].grams],
    QUALITY_WON.map(w => w / 10), '★수확량(g)이 원과 어긋난다 — 10원 = 1g 이 깨졌다');
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
  /* ★ 위와 같은 이유로 **만든 뒤에 놓는다** (2026-08-09 · §자리는 시루마다 따로다) */
  for (let i = 2; i <= 6; i++) fp.beansprout.pots.push(makeCropPot('crop_01_0' + i));
  placeBeansprout(fp, 'dark-slot');
  waterBeansprout(fp, 0, { all: true });                // 여섯을 **같은 날** 시작한다
  for (let d = 1; d <= CYCLE; d++) growDay(fp, 0.2);
  const six = harvestBeansprout(fp, { day: CYCLE });
  assert.equal(six.harvestedPots, 6);
  assert.deepEqual(six.perPot.map(p => p.savedWon), [...OVERLAP_WON, 0, 0],
    '★같은 날 거둔 넷째부터가 0원이 아니다 — 천장이 규칙에서 안 나온다');
  assert.equal(six.cycleSavedWon, OVERLAP_WON.reduce((a, v) => a + v, 0));
  assert.equal(six.cycleSavedWon, one.cycleSavedWon * 2,
    '★여섯 시루를 같은 날 거둔 값이 한 시루의 두 배가 아니다 (첫째+둘째+셋째)');
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

/* ★★ 유도 두 걸음 — 책상 → 창턱 → 등 (2026-08-09 박사님 확정 · first_play.js §몬스테라 유도)
   ⚠ 「10일」은 **게임일**이다. 어두운 자리에서는 유효 생장일이 안 오르므로 유효일로 세면
     영영 안 뜬다. 이 재현이 그 함정을 못 박는다 — 진행이 **0 그대로**인 관측만 먹인다. */
{
  const { fp } = growCycle(0.2);
  fp.enabled = true;                             // firstPlaySnapshot 은 켜진 판만 뜬다
  const stay = () => markMonsteraPhase(fp, { phaseId: 'spear_ready', progress01: 0 });
  markMonsteraArrived(fp, 'arrival-slot');
  stay();                                        // 도착 당일 첫 관측 — 안 센다(비교 대상 없음)
  assert.equal(monsteraGuideOf(fp).move, false, '도착하자마자 유도가 뜨면 안 된다');

  const before0 = firstPlaySnapshot(fp);
  for (let i = 0; i < MONSTERA_HINT_DAYS - 1; i++) stay();
  assert.equal(monsteraGuideOf(fp).move, false,
    `${MONSTERA_HINT_DAYS - 1}일째에 이미 떴습니다 — 하루 일찍입니다`);
  stay();
  assert.equal(monsteraGuideOf(fp).move, true, `${MONSTERA_HINT_DAYS}일째에 안 떴습니다`);
  assert.equal(monsteraGuideOf(fp).lamp, false, '★자리를 옮기기 전에 등 얘기가 나오면 안 된다');
  const ev = firstPlayEventsOf(before0, fp).map(e => e.id);
  assert.ok(ev.includes('monstera_no_spear'), `사건이 안 났습니다: ${ev.join(',')}`);
  assert.ok(!ev.includes('monstera_needs_lamp'), '등 안내가 자리 안내와 같이 났습니다');

  /* 옮겼다 — 그래도 안 자라면 그때 등이 나온다 */
  const beforeMove = firstPlaySnapshot(fp);
  moveMonstera(fp, 'window-slot');
  for (let i = 0; i < MONSTERA_LAMP_HINT_DAYS - 1; i++) stay();
  assert.equal(monsteraGuideOf(fp).lamp, false, '옮긴 다음 날 바로 등 얘기가 나오면 안 된다');
  stay();
  assert.equal(monsteraGuideOf(fp).lamp, true,
    `옮기고 ${MONSTERA_LAMP_HINT_DAYS}일이 지나도 등 안내가 안 뜹니다`);
  assert.ok(firstPlayEventsOf(beforeMove, fp).map(e => e.id).includes('monstera_needs_lamp'));

  /* 자라기 시작하면 유도는 끝난다 — 잔소리로 남지 않는다 */
  markMonsteraPhase(fp, { phaseId: 'spear_ready', progress01: 0.5 });
  assert.deepEqual(monsteraGuideOf(fp), { move: false, lamp: false },
    '자라기 시작했는데도 유도가 남아 있습니다');
}

/* ★ 안내 단계는 **뒤로 안 되감긴다** (2026-08-09 고침).
   콩나물 회전은 몬스테라가 온 뒤에도 계속 도는데, 다시 심을 때마다 placeCrop 이
   `move_monstera` 를 `grow_beansprout` 로 덮어써서 안내가 이틀 만에 사라졌다. */
{
  const { fp } = growCycle(0.2);
  markMonsteraArrived(fp, 'arrival-slot');
  assert.equal(fp.phase, 'move_monstera');
  resowBeansprout(fp, { day: 1, at: 'dark-slot-2' });   // 회전은 몬스테라가 온 뒤에도 돈다
  assert.equal(fp.phase, 'move_monstera',
    '★시루를 다시 심자 몬스테라 안내가 콩나물 단계로 되감겼습니다');
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
  /* ★ 도착(유효 45) 뒤 **첫 말린 새순은 유효 61** 이다 — 재서 나온 값이다
     (tools/probe_arrival_stems.mjs · docs/engine/shots/arrival/). 그 61 은 곧
     **2개째 줄기의 첫 잎**이라, 첫 플레이의 완료 신호와 "2개째가 자란다"가 같은 사건이다.
     ⚠ 숫자를 여기 박지 않는다 — 도착값은 state.ARRIVAL 이 정본이다. */
  const SPEAR_GROWTH = 61;
  const SPEAR_DAYS = SPEAR_GROWTH - ARRIVAL.growthDays;
  const growthPhase = () => growth >= SPEAR_GROWTH
    ? { phaseId: 'spear_furled', phaseKo: '말린 새순 등장', progress01: 0,
        nextPhaseId: 'spear_opening', nextPhaseKo: '새순이 펴지는 중' }
    : { phaseId: 'spear_ready', phaseKo: '말린 새순을 준비하는 중',
        progress01: Math.max(0, (growth - ARRIVAL.growthDays) / SPEAR_DAYS),
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
  /* ★ 2026-08-05 — 재는 값을 **콩나물 한 회전분**으로 바로잡았다.
     예전에는 `cropSavedWonPerCycle` 로 쟀는데 그 값은 "지금 도는 작물 **전부**가 한 회전에
     내는 합계"다. 작물이 콩나물뿐이던 동안에는 둘이 우연히 같았지만(3,000),
     2종째(무순)가 들어오면서 5,000이 되어 갈라졌다 — 여기서 거둔 것은 콩나물 한 시루뿐이다. */
  /* ⚠⚠ 2026-08-16 — 여기서 읽던 `cropKindSavedWon[0]` 의 **뜻이 바뀌었다.**
     예전에는 「콩나물 최상 품질 한 회전분」이었는데, g 셈이 들어오면서 그 표는
     **중간 품질**(300g · 3,000원)을 가리키게 됐다. 이 판은 어두운 자리라 최상 품질이므로
     4,000원이 맞다. ⇒ 「최상 품질 한 회전분」을 묻는 창구로 바꾼다. */
  assert.equal(S.firstPlay.food.pantryWon, BEST_CYCLE_WON,
    '곳간에 들어간 몫이 안 맞습니다');

  /* ★수확한 날의 배움이 실제로 적혔는가 (2026-08-03 재발 방지 · 2026-08-04 자리 이동).
     ★ 이제 배움 ①·②는 **턴 밖**(loop.harvestCrop)에서 켜진다 — 거두는 순간에만 증거가 온전해서다.
       턴으로 미루면 "거두고 바로 다시 심은" 판에서 avgDli 가 초기화돼 배움이 조용히 사라진다. */
  assert.equal(S.tutorial.learned.harvest, true,
    '★수확·식비 절감이 배움에 안 적혔습니다 — harvestCrop 이 배움을 안 켜고 있습니까?');
  assert.equal(S.tutorial.learned.cropDark, true,
    '★어두운 자리 수확(4일평균 낮음)이 배움에 안 적혔습니다');
  /* 첫 플레이 중에는 살림이 멈춰 있어야 한다 — 그 며칠은 배우는 구간이다 */
  assert.equal(S.tutorial.day, 0, '첫 플레이 중인데 반지하 날짜가 갔습니다');
  assert.equal(S.tutorial.cashWon, S.tutorial.rules.startCashWon, '첫 플레이 중인데 돈이 빠졌습니다');
  /* ★ 도착은 `first_play.MONSTERA_ARRIVAL_RULE.harvestCount` 회전째에 온다 (2026-08-04).
     지금 그 값은 **1** 이다 — 화면(game.html)이 첫 플레이 동안 상점·다시심기를 닫아 둬서
     회전을 더 돌릴 수가 없다(first_play.js §게이트). 게이트가 열려 값이 오르면
     아래 `rotateUntilArrival` 이 그만큼 더 돌 뿐 이 검사는 그대로 선다. */
  const cashBeforeRotate = S.tutorial.cashWon;
  const harvests = rotateUntilArrival(S, io, 'dark-slot');
  assert.equal(harvests, MONSTERA_ARRIVAL_RULE.harvestCount,
    `★거둔 횟수 ${harvests}회에 왔습니다 — 규칙은 ${MONSTERA_ARRIVAL_RULE.harvestCount}회전입니다`);
  assert.equal(S.tutorial.day, 0, '첫 플레이 중인데 반지하 날짜가 갔습니다');
  assert.equal(S.tutorial.cashWon,
    cashBeforeRotate - buyPriceOf('bean_seed') * (harvests - 1),
    '★첫 플레이 중에 씨앗값 말고 다른 돈이 나갔습니다');
  assert.equal(pot0(S).arrivalGrowthDays, ARRIVAL.growthDays);
  assert.notEqual(pot0(S).slotId, 'banjiha-sill:0', '몬스테라는 먼저 어두운 자리에 도착해야 한다');

  assert.equal(S.firstPlay.phase, 'move_monstera');
  pot0(S).slotId = 'banjiha-sill:0';
  moveMonstera(S.firstPlay, pot0(S).slotId);
  const dayAtMove = S.day;
  nextDay(S, io);
  assert.equal(S.firstPlay.phase, 'grow_monstera',
    '창턱으로 옮겨 게이지가 오르는 중이면 "옮겨 보세요"가 남으면 안 된다');
  assert.equal(S.firstPlay.completed, false,
    '★옮긴 다음 날 바로 끝났습니다 — 말린 새순까지는 며칠 걸려야 합니다');
  /* 창턱(3.77)에서 하루 1일씩 쌓여 유효 61 에서 말린 새순이 난다.
     ★ 물을 **매일 챙긴다** (2026-08-07 · state.js §몬스테라 물주기). 창턱은 밝아서
       주기가 6~7일이라, 안 주면 여기서 흙이 말라 하루가 안 세어진다 —
       그러면 `dliHist` 도 안 쌓여 아래 마지막 줄(하루 하나씩 3.77)이 어긋난다.
       화면에서 [몬스테라에 물 주기]를 누른 것과 같은 함수다(줄 때가 된 날에만 든다). */
  for (let i = 2; i <= SPEAR_DAYS; i++) { try { waterPot(S); } catch { } nextDay(S, io); }

  assert.equal(S.day, dayAtMove + SPEAR_DAYS);
  assert.equal(pot0(S).daysPlanted, SPEAR_DAYS);
  assert.equal(S.firstPlay.completed, true,
    `★유효 ${SPEAR_GROWTH}일이 됐는데 첫 플레이가 안 끝났습니다`);
  assert.equal(S.firstPlay.monstera.growthPhase.phaseId, 'spear_furled');
  assert.deepEqual(S.dliHist, Array(SPEAR_DAYS).fill(3.77));
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
  try { waterPot(S); } catch { /* 아직 없거나 안 놓은 화분 — 그런 날은 물이 안 든다 */ }
  assert.equal(S.day, CYCLE, '★선물이 실패하는 판인데 자라는 날에서 이미 터졌습니다');
  assert.equal(beansproutReady(S.firstPlay.beansprout), true);

  /* ★ 선물은 이제 **3회전째**에 시도된다 (2026-08-04) — 앞의 두 회전은 조용히 지나가야 한다.
     여기서 앞 회전이 터지면 그건 도착 조건이 아니라 수확 자체가 깨진 것이다. */
  let err = null, dayAtThrow = null, foodBefore = null;
  for (let guard = 0; guard < 40 && !err; guard++) {
    if (beansproutReady(S.firstPlay.beansprout)) {
      /* ★ 되돌림의 기준선 — 앞 회전이 이미 곳간을 채워 뒀으므로 "0 이어야 한다"로는 못 잰다.
         **터진 그 수확만** 없던 일이 됐는가를 본다. */
      foodBefore = { pantryWon: S.firstPlay.food.pantryWon,
                     totalFoodSavedWon: S.firstPlay.food.totalFoodSavedWon };
      try { harvestCrop(S, io); } catch (e) { err = e; dayAtThrow = S.day; break; }
    }
    const b = S.firstPlay.beansprout;
    if (b.harvested) {
      if (stockOf(S, 'bean_seed') < 1 && incomingOf(S, 'bean_seed') < 1)
        try { orderItem(S, 'bean_seed', 1); } catch { /* 다음 날 */ }
      if (stockOf(S, 'bean_seed') >= 1)
        try { resowCrop(S, { at: 'dark-slot', slots }); } catch { /* 다음 날 */ }
    }
    try { waterCrop(S); } catch { /* 이미 준 날 */ }
    try { waterPot(S); } catch { /* 아직 없거나 안 놓은 화분 — 그런 날은 물이 안 든다 */ }
    nextDay(S, io);
  }
  assert.ok(err, '★선물 초기화가 실패하는 판인데 아무 회전에서도 안 터졌습니다');
  assert.match(err.message, /도착 초기화 실패 주입/);
  assert.equal(err.harvestRolledBack, true, '수확을 물렀다는 표식이 없습니다');
  assert.equal(S.day, dayAtThrow, '★날짜는 이미 확정된 뒤다 — 되감으면 오히려 어긋난다');
  assert.equal(S.firstPlay.beansprout.ageDays, CYCLE);
  assert.equal(S.firstPlay.beansprout.harvested, false, '★수확이 안 물렸습니다');
  assert.equal(S.firstPlay.food.pantryWon, foodBefore.pantryWon, '★무른 수확이 곳간에 남았습니다');
  assert.equal(S.firstPlay.food.totalFoodSavedWon, foodBefore.totalFoodSavedWon);
  assert.equal(S.pots.length, 0);
  /* ★ 잠기지 않는다 — 거둘 수 있는 상태 그대로라 다시 누를 수 있다 */
  assert.equal(cropHarvestStatus(S).canHarvest, true, '★무른 뒤에 다시 거둘 수 없게 됐습니다');
}

console.log('first_play_harvest_atomic: PASS');
