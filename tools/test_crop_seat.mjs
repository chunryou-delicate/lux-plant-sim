/* ============================================================
   tools/test_crop_seat.mjs — 「자리 사본」을 판단에 쓰지 않는다 · 2026-08-10 신설
   ------------------------------------------------------------
     node tools/test_crop_seat.mjs        (브라우저가 필요 없다 — 규칙만 본다)

   ★ 왜 이 검사가 필요한가.
     2026-08-09 에 시루가 각개가 되면서 **자리의 정본이 시루마다**로 내려왔다
     (`pots[i].slotId` / `pots[i].at`). 그런데 `site.slotId`(= `fp.beansprout.slotId`)가
     **읽기용 사본**으로 남았고, 코어 여러 곳이 그 사본을 보고 판단했다.
     사본이 비면 시루가 방에 서 있어도 「안 놓았다」가 되어 —
       · 하루가 안 가거나(화면 쪽은 `f26aeef` 에서 고쳤다)
       · 작물이 **조용히 안 자라거나**
       · 예외에 `firstPlayInput` 표가 없어 **화면이 버튼을 전부 잠갔다.**
     박사님 Day 92 판이 이 뿌리에서 멈췄다.

   ══ 무엇을 보나 ═══════════════════════════════════════════════════════════
     A  ★★ **무순만 놓은 판에서 무순이 자란다** — 콩나물 사본이 null 이어도
     B  ★ 사본을 비워도 하루가 돌고 시루가 자란다 (loop.nextDay · advanceBeansproutDay)
     C  ★ 하나도 안 놓은 판은 **던지되 안내**다 — `firstPlayInput` 이 붙는다(버튼이 안 잠긴다)
     D  ★ 빨리감기 문지기도 같은 판정을 쓴다
     E  ★★ **이사해도 시루가 방에 서 있다 — 거둔 시루도.** 못 옮긴 것은 말을 한다
     F  ★ 몬스테라는 **책상**에 도착한다 (서랍장이 아니다)
     G  ★ `monstera.guide` 가 저장·복원을 건넌다

   ⚠ 조도 엔진은 한 줄도 안 건드린다. 자리마다의 DLI 는 여기서도 **표로 준다.**
============================================================ */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  createFirstPlayState, firstPlayRulesFromBalance, placeCrop, addCropPot, syncCropLead,
  advanceBeansproutDay, waterBeansprout, harvestBeansprout, cropSiteOf, cropSites,
  placedCropPots, cropPotList, markMonsteraArrived
} from '../src/game/first_play.js';
import { newState, pot0, waterCrop, waterPot, resowCrop, ARRIVAL } from '../src/game/state.js';
import { nextDay, harvestCrop, startFastForward } from '../src/game/loop.js';
import { moveIntoOneroom, ONEROOM_ROOM_ID } from '../src/game/oneroom.js';
import { createTutorialState, noteLearning, noteVarieCuttingSale,
         TUTORIAL_RULES } from '../src/game/tutorial.js';
import { orderItem, stockOf, incomingOf } from '../src/game/shop.js';
import { serialize, deserialize } from '../src/game/save.js';

const RULES = firstPlayRulesFromBalance(JSON.parse(
  readFileSync(new URL('../data/balance/characters.json', import.meta.url), 'utf8')));

const results = [];
const check = (n, f) => { try { f(); results.push(['PASS', n]); }
                          catch (e) { results.push(['FAIL', n, e.message]); } };
const info = m => results.push(['INFO', '  ' + m]);

/* ── 아주 작은 가짜 창 둘 ─────────────────────────────────────────────────
   ★ 조도 물리를 흉내 내지 않는다. 자리마다의 DLI 를 **표로 준다** —
     여기서 재는 것은 「누가 자라는가」이지 「얼마나 밝은가」가 아니다. */
function makeIo(slots) {
  let cal = ARRIVAL.growthDays, growth = ARRIVAL.growthDays, todayDli = 0;
  const SPEAR = 61;
  return {
    light: {
      room: { slots, size: { w: 6, d: 5, h: 2.5 },
              surfaces: new Set(slots.map(s => String(s.slotId).split(':')[0])) },
      daily() {
        return {
          sky: { season: 'summer', weather: 'clear' },
          check: { ok: true, badSlots: new Set(), problems: [] },
          report: { slots, best: slots[0], sky: { weather_ko: '맑음' },
                    energy: { won: 0 }, photoperiod: { hours: 0 }, continuous_injury: false }
        };
      }
    },
    growth: {
      assertContract() {},
      setGrowth(d) { cal = d; growth = d; return { calDay: cal, growth }; },
      setDailyLight(d) { todayDli = d; },
      calendarDay() { return cal; }, growthDays() { return growth; },
      advanceTo(day) { cal = day; const grew = todayDli >= 3; if (grew) growth++;
                       return { calDay: cal, growth, grew, blocked: grew ? null : '빛 부족' }; },
      growthBlocked() { return todayDli >= 3 ? null : '빛 부족'; },
      growthPhase() {
        return growth >= SPEAR
          ? { phaseId: 'spear_furled', phaseKo: '말린 새순 등장', progress01: 0,
              nextPhaseId: 'spear_opening', nextPhaseKo: '새순이 펴지는 중' }
          : { phaseId: 'spear_ready', phaseKo: '말린 새순을 준비하는 중',
              progress01: Math.max(0, (growth - ARRIVAL.growthDays) / (SPEAR - ARRIVAL.growthDays)),
              nextPhaseId: 'spear_furled', nextPhaseKo: '말린 새순 등장' };
      },
      dli7() { return todayDli; }, dliCV() { return 0; }, ageOf(d) { return d; }
    }
  };
}

/* 방을 바꿀 수 있는 가짜 조도 창 — 이사(E)에서만 쓴다 */
function makeSwitchingLight(rooms, startId) {
  let cur = startId;
  const roomOf = id => ({ id, slots: rooms[id], size: { w: 6, d: 5, h: 2.5 },
                          surfaces: new Set(rooms[id].map(s => String(s.slotId).split(':')[0])) });
  return { builtRooms: [], build(id) { cur = id; this.builtRooms.push(id); return roomOf(id); },
           clearCache() {}, daily() { return { sky: {}, check: { ok: true, badSlots: new Set() },
                                               report: { slots: rooms[cur] } }; },
           get room() { return roomOf(cur); } };
}

const SLOTS = [
  { slotId: 'dark-slot',  dli: 0.2, maxPotD: 0.30 },
  { slotId: 'bright-slot', dli: 1.6, maxPotD: 0.30 },
  { slotId: 'banjiha-desk:0',    dli: 0.61, maxPotD: 0.57 },
  { slotId: 'banjiha-dresser:0', dli: 0.08, maxPotD: 0.57 }
];

function freshGame(slots = SLOTS) {
  const S = newState({ room: 'banjiha', mode: 'novice', firstPlay: true, firstPlayRules: RULES });
  return { S, io: makeIo(slots) };
}

/* ══ A. ★★ 무순만 놓은 판에서 무순이 자란다 ════════════════════════════ */
check('A 무순만 놓은 판 — 무순이 실제로 자란다 (콩나물 사본은 null)', () => {
  const { S, io } = freshGame();
  const fp = S.firstPlay;
  const musun = cropSiteOf(fp, 'musun');
  /* 콩나물 시루는 **가방에 둔 채**로 무순 판만 놓는다 */
  const tray = addCropPot(fp, 'musun', { day: 0 });
  placeCrop(fp, 'musun', 'bright-slot', { slots: io.light.room.slots, potId: tray.id });
  assert.equal(fp.beansprout.slotId, null, '콩나물 사본이 비어 있는 판이 아닙니다');
  assert.equal(placedCropPots(fp.beansprout).length, 0);
  assert.equal(placedCropPots(musun).length, 1);

  waterCrop(S, { kind: 'musun' });           // 회전 시작 (무순 판에)
  const HD = musun.harvestDays;              // 무순은 7일
  const trace = [];
  for (let d = 1; d <= HD; d++) {
    nextDay(S, io);
    trace.push(`${d}일째 ${musun.pots[0].ageDays}일차`);
  }
  info(`A 무순 자람 — ${trace.join(' · ')} (자라는 날 ${HD}일)`);
  assert.equal(musun.pots[0].ageDays, HD,
    `★무순만 놓은 판에서 무순이 안 자랐습니다 — ${HD}일 뒤 ${musun.pots[0].ageDays}일차`);
  const row = cropPotList(fp, S.day).find(r => r.id === tray.id);
  assert.equal(row.ready, true, '★다 자랐는데 「거둘 때」로 안 섭니다');
  const h = harvestCrop(S, io);
  info(`A 무순 수확 — ${h.qualityKo} · ${h.meals}끼 · ${h.cycleSavedWon.toLocaleString()}원`);
  assert.ok(h.meals > 0, '★거뒀는데 끼니가 0입니다');
});

/* ══ B. 사본을 비워도 하루가 돌고 시루가 자란다 ══════════════════════════ */
check('B-1 사본을 비운 판 — advanceBeansproutDay 가 안 던지고 시루가 자란다', () => {
  const fp = createFirstPlayState({ enabled: true, rules: RULES });
  addCropPot(fp, 'beansprout', { day: 0 });
  placeCrop(fp, 'beansprout', 'slot-a', { potId: fp.beansprout.pots[0].id });
  placeCrop(fp, 'beansprout', 'slot-b', { potId: fp.beansprout.pots[1].id });
  waterBeansprout(fp, 0, { all: true });
  fp.beansprout.slotId = null;                       // ★ 사본만 지운다(정본은 그대로)
  const r = advanceBeansproutDay(fp, 0.2, { dliBySlot: { 'slot-a': 0.2, 'slot-b': 0.2 } });
  assert.equal(r.grew, 2, `★사본이 비었다고 시루가 안 자랐습니다 — 자란 시루 ${r.grew}개`);
});

check('B-2 사본을 비운 판 — loop.nextDay 가 하루를 돌린다', () => {
  const { S, io } = freshGame();
  const fp = S.firstPlay;
  addCropPot(fp, 'beansprout', { day: 0 });
  placeCrop(fp, 'beansprout', 'dark-slot', { slots: io.light.room.slots,
                                             potId: fp.beansprout.pots[0].id });
  placeCrop(fp, 'beansprout', 'bright-slot', { slots: io.light.room.slots,
                                               potId: fp.beansprout.pots[1].id });
  waterCrop(S, { all: true });
  fp.beansprout.slotId = null; fp.beansprout.at = null;   // ★ 사본만 지운다
  const before = S.day;
  nextDay(S, io);
  assert.equal(S.day, before + 1, '★사본이 비었다고 하루가 안 갔습니다');
  assert.deepEqual(fp.beansprout.pots.map(p => p.ageDays), [1, 1],
    '★하루는 갔는데 시루가 조용히 안 자랐습니다');
});

/* ══ C. 하나도 안 놓은 판은 **안내**다 — 버튼을 잠그지 않는다 ═════════════ */
check('C-1 하나도 안 놓은 판 — 던지되 firstPlayInput 표가 붙는다', () => {
  const fp = createFirstPlayState({ enabled: true, rules: RULES });
  let e = null;
  try { advanceBeansproutDay(fp, 0.2); } catch (err) { e = err; }
  assert.ok(e, '아무것도 안 놓았는데 그냥 지나갔습니다');
  assert.equal(e.firstPlayInput, true,
    '★안내에 firstPlayInput 표가 없습니다 — game.html 의 isRecoverable 이 이걸 보고 ' +
    '버튼을 잠글지 정합니다(§4239)');
  assert.match(e.message, /놓아 주세요/);
});

check('C-2 가방에만 있는 시루는 「놓은 것」이 아니다', () => {
  const fp = createFirstPlayState({ enabled: true, rules: RULES });
  addCropPot(fp, 'beansprout', { day: 0 });          // 가방에 하나 더
  let e = null;
  try { advanceBeansproutDay(fp, 0.2); } catch (err) { e = err; }
  assert.ok(e && e.firstPlayInput === true, '가방의 빈 시루가 「놓았다」로 셌습니다');
});

/* ══ D. 빨리감기 문지기 ════════════════════════════════════════════════ */
check('D 빨리감기 — 사본이 비어도 시루가 서 있으면 막지 않는다', () => {
  const { S, io } = freshGame();
  const fp = S.firstPlay;
  placeCrop(fp, 'beansprout', 'dark-slot', { slots: io.light.room.slots,
                                             potId: fp.beansprout.pots[0].id });
  fp.beansprout.slotId = null;
  const ff = startFastForward(S, io, { mode: 'fast', maxDays: 1, msPerDay: 0,
                                       timers: { setTimeout: (f) => { f(); return 0; },
                                                 clearTimeout() {} } });
  assert.ok(ff, '★사본이 비었다고 빨리감기가 안 열렸습니다');
  try { ff.stop && ff.stop(); } catch { /* 이미 끝난 판 */ }

  /* 하나도 안 놓은 판은 계속 막는다 — 그건 옳은 안내다 */
  const empty = freshGame();
  let e = null;
  try { startFastForward(empty.S, empty.io, { mode: 'fast', maxDays: 1 }); }
  catch (err) { e = err; }
  assert.ok(e && e.firstPlayInput === true, '안 놓은 판을 안 막거나 표가 없습니다');
});

/* ══ E. ★★ 이사 — 거둔 시루도 방에 서 있다 ═══════════════════════════ */
check('E 이사 — 거둔 시루도 새 방에 선다 (예전에는 통째로 가방행이었다)', () => {
  const ROOMS = {
    banjiha: [{ slotId: 'dark-slot', x: 0, y: 0.7, z: 0, maxPotD: 0.3 },
              { slotId: 'bright-slot', x: 0.4, y: 0.7, z: 0, maxPotD: 0.3 }],
    [ONEROOM_ROOM_ID]: [{ slotId: 'oneroom-desk:0', x: 0, y: 0.75, z: 0, maxPotD: 0.5 },
                        { slotId: 'oneroom-shelf:0', x: 1, y: 1.2, z: 0, maxPotD: 0.5 }]
  };
  const light = makeSwitchingLight(ROOMS, 'banjiha');
  const S = newState({ room: 'banjiha', mode: 'novice', firstPlay: true, firstPlayRules: RULES });
  S.day = 60;
  S.tutorial = createTutorialState({ enabled: true, rules: TUTORIAL_RULES });
  S.tutorial.day = 60;
  noteLearning(S.tutorial, { harvested: true, foodSavedWon: 5000, cropAvgDli: 0.1,
                             plantDli7: 3.8, plantMinDli: 3.0, spearFurled: true });
  S.tutorial.cashWon = TUTORIAL_RULES.moveOutCostWon;
  /* ★ 2026-08-23 — 이사 게이트는 **축이 둘**이다(tutorial §두 축): 돈 × 무늬 삽수를 판 적.
     이 검사는 돈만 채우고 있었다 — 둘째 축이 생기기 전(한 축 시절) 그대로였다.
     그래서 `moveIntoOneroom` 이 「무늬 삽수를 아직 못 팔았습니다」로 정직하게 막았고,
     **이 검사가 지키려던 것(이사 뒤 시루 자리)에는 닿지도 못하고** 붉었다.
     ⚠ 기준선을 낮춘 것이 아니다 — `cashWon` 을 채우는 것과 **같은 종류의 전제 갖추기**다.
       아래 자리 검증(§거둔 시루도 새 방에 선다)은 그대로 두었고, 그것이 이 검사의 주제다.
     ★ 상태를 직접 쓰지 않고 **정식 문**으로 적는다 — `noteVarieCuttingSale` 이
       「친다/안 친다」의 유일한 문이다(무늬 잎이 0이면 아무 일도 안 한다). */
  noteVarieCuttingSale(S.tutorial, { variegatedLeaves: 1, won: 350_000 });

  const fp = S.firstPlay;
  addCropPot(fp, 'beansprout', { day: 0 });
  addCropPot(fp, 'beansprout', { day: 0 });           // 시루 셋
  const ids = fp.beansprout.pots.map(p => p.id);
  for (const id of ids)
    placeCrop(fp, 'beansprout', 'dark-slot', { slots: ROOMS.banjiha, potId: id });
  waterBeansprout(fp, 0, { all: true });
  for (let d = 0; d < fp.beansprout.harvestDays; d++) advanceBeansproutDay(fp, 0.2);
  /* 셋 중 **하나만** 거둔다 — 옛 코드는 `site.harvested`(하나라도 거뒀나)로 자리를 통째로 건너뛰었다 */
  harvestBeansprout(fp, { day: S.day, potIds: [ids[0]] });
  assert.equal(fp.beansprout.harvested, true, '사본의 harvested 가 안 섰습니다(전제 확인)');
  assert.equal(fp.beansprout.pots.filter(p => p.harvested).length, 1);

  moveIntoOneroom(S, { light });
  assert.equal(S.home.room, ONEROOM_ROOM_ID, '이사가 안 됐습니다');
  const seats = fp.beansprout.pots.map(p => p.slotId);
  info(`E 이사 뒤 자리 — ${seats.map((s, i) => `${ids[i]}:${s}`).join(' · ')}`);
  assert.ok(seats.every(s => s && s.startsWith('oneroom-')),
    `★이사했더니 시루가 자리를 잃었습니다 — ${seats.join(', ')}`);
  const harvestedSeat = fp.beansprout.pots.find(p => p.harvested).slotId;
  assert.ok(harvestedSeat && harvestedSeat.startsWith('oneroom-'),
    '★거둔 시루가 통째로 가방으로 갔습니다');
  const rows = cropPotList(fp, S.day);
  assert.equal(rows.filter(r => r.inBag).length, 0, '★가방으로 흘러 들어간 시루가 있습니다');
});

check('E-2 못 옮기면 **말을 한다** — 조용히 사라지지 않는다', () => {
  /* 새 방에 자리가 하나도 없으면 옮길 데가 없다. 그때 로그가 남는가. */
  const ROOMS = {
    banjiha: [{ slotId: 'dark-slot', x: 0, y: 0.7, z: 0, maxPotD: 0.3 }],
    [ONEROOM_ROOM_ID]: [{ slotId: 'oneroom-desk:0', x: 0, y: 0.75, z: 0, maxPotD: 0.5 }]
  };
  const light = makeSwitchingLight(ROOMS, 'banjiha');
  const S = newState({ room: 'banjiha', mode: 'novice', firstPlay: true, firstPlayRules: RULES });
  S.day = 60;
  S.tutorial = createTutorialState({ enabled: true, rules: TUTORIAL_RULES });
  S.tutorial.day = 60;
  noteLearning(S.tutorial, { harvested: true, foodSavedWon: 5000, cropAvgDli: 0.1,
                             plantDli7: 3.8, plantMinDli: 3.0, spearFurled: true });
  S.tutorial.cashWon = TUTORIAL_RULES.moveOutCostWon;
  /* ★ 2026-08-23 — 이사 게이트는 **축이 둘**이다(tutorial §두 축): 돈 × 무늬 삽수를 판 적.
     이 검사는 돈만 채우고 있었다 — 둘째 축이 생기기 전(한 축 시절) 그대로였다.
     그래서 `moveIntoOneroom` 이 「무늬 삽수를 아직 못 팔았습니다」로 정직하게 막았고,
     **이 검사가 지키려던 것(이사 뒤 시루 자리)에는 닿지도 못하고** 붉었다.
     ⚠ 기준선을 낮춘 것이 아니다 — `cashWon` 을 채우는 것과 **같은 종류의 전제 갖추기**다.
       아래 자리 검증(§거둔 시루도 새 방에 선다)은 그대로 두었고, 그것이 이 검사의 주제다.
     ★ 상태를 직접 쓰지 않고 **정식 문**으로 적는다 — `noteVarieCuttingSale` 이
       「친다/안 친다」의 유일한 문이다(무늬 잎이 0이면 아무 일도 안 한다). */
  noteVarieCuttingSale(S.tutorial, { variegatedLeaves: 1, won: 350_000 });
  const fp = S.firstPlay;
  placeCrop(fp, 'beansprout', 'dark-slot', { slots: ROOMS.banjiha,
                                             potId: fp.beansprout.pots[0].id });
  waterBeansprout(fp, 0, { all: true });
  const r = moveIntoOneroom(S, { light });
  const said = (r.rehomed || []).join(' / ');
  info(`E-2 이사 기록 — ${said || '(없음)'}`);
  assert.ok(/옮겼습니다|가방으로/.test(said), '★이사가 시루를 어떻게 했는지 아무 말도 안 합니다');
});

/* ══ F. 몬스테라는 **책상**에 도착한다 ════════════════════════════════ */
check('F 몬스테라 도착 자리 — 서랍장(0.08)이 아니라 책상(0.61)', () => {
  const { S, io } = freshGame();
  const fp = S.firstPlay;
  placeCrop(fp, 'beansprout', 'dark-slot', { slots: io.light.room.slots,
                                             potId: fp.beansprout.pots[0].id });
  const at = 'dark-slot';
  for (let guard = 0; guard < 80 && !pot0(S); guard++) {
    const b = fp.beansprout;
    if (b.harvested) {
      if (stockOf(S, 'bean_seed') < 1 && incomingOf(S, 'bean_seed') < 1)
        try { orderItem(S, 'bean_seed', 1); } catch { /* 돈이 없으면 다음 날 */ }
      if (stockOf(S, 'bean_seed') >= 1)
        try { resowCrop(S, { at, slots: io.light.room.slots }); } catch { /* 다음 날 */ }
    }
    try { waterCrop(S); } catch { /* 줄 것이 없는 날 */ }
    nextDay(S, io);
    if (b.pots.some(p => !p.harvested && p.ageDays >= b.harvestDays)) harvestCrop(S, io);
  }
  assert.ok(pot0(S), '★회전을 여든 번 돌려도 몬스테라가 안 왔습니다');
  info(`F 도착 자리 — ${pot0(S).slotId} (책상 0.61 · 서랍장 0.08)`);
  assert.equal(pot0(S).slotId, 'banjiha-desk:0',
    `★몬스테라가 책상이 아니라 ${pot0(S).slotId} 에 도착했습니다`);
  assert.equal(fp.monstera.slotId, 'banjiha-desk:0');
  /* ⚠ 그래도 **안 자란다** — 유도(옮겨 보세요)가 그대로 성립하는지 같이 못 박는다 */
  const dli = SLOTS.find(s => s.slotId === 'banjiha-desk:0').dli;
  assert.ok(dli < 3, `★책상이 최소 광량을 넘습니다(${dli}) — 도착 자리에서 자라 버리면 유도가 깨집니다`);
});

check('F-2 책상이 없는 방에서는 예전 규칙(가장 어두운 자리)이 그대로 돈다', () => {
  const noDesk = [
    { slotId: 'shelf:0',   dli: 1.2, maxPotD: 0.57 },
    { slotId: 'dresser:0', dli: 0.08, maxPotD: 0.57 },
    { slotId: 'crop-slot', dli: 0.2, maxPotD: 0.30 }
  ];
  const { S, io } = freshGame(noDesk);
  const fp = S.firstPlay;
  placeCrop(fp, 'beansprout', 'crop-slot', { slots: io.light.room.slots,
                                             potId: fp.beansprout.pots[0].id });
  for (let guard = 0; guard < 80 && !pot0(S); guard++) {
    const b = fp.beansprout;
    if (b.harvested) {
      if (stockOf(S, 'bean_seed') < 1 && incomingOf(S, 'bean_seed') < 1)
        try { orderItem(S, 'bean_seed', 1); } catch { }
      if (stockOf(S, 'bean_seed') >= 1)
        try { resowCrop(S, { at: 'crop-slot', slots: io.light.room.slots }); } catch { }
    }
    try { waterCrop(S); } catch { }
    nextDay(S, io);
    if (b.pots.some(p => !p.harvested && p.ageDays >= b.harvestDays)) harvestCrop(S, io);
  }
  assert.ok(pot0(S), '몬스테라가 안 왔습니다');
  assert.equal(pot0(S).slotId, 'dresser:0',
    `★책상이 없는 방인데 가장 어두운 자리가 아닙니다 — ${pot0(S).slotId}`);
});

/* ══ G. monstera.guide 가 세이브를 건넌다 ═══════════════════════════════ */
check('G 저장 → 다시 열기 — 유도 카운터가 이어진다', () => {
  const S = newState({ room: 'banjiha', mode: 'novice', firstPlay: true, firstPlayRules: RULES });
  const fp = S.firstPlay;
  placeCrop(fp, 'beansprout', 'dark-slot', { potId: fp.beansprout.pots[0].id });
  waterBeansprout(fp, 0, { all: true });
  for (let d = 0; d < fp.beansprout.harvestDays; d++) advanceBeansproutDay(fp, 0.2);
  harvestBeansprout(fp, { day: 5 });
  markMonsteraArrived(fp, 'banjiha-desk:0');
  fp.monstera.guide.days = 7;
  fp.monstera.guide.moved = true;
  fp.monstera.guide.movedDays = 3;

  const raw = serialize(S);
  const back = deserialize(raw, { firstPlayRules: RULES });
  const g = back.S ? back.S.firstPlay.monstera.guide : back.firstPlay.monstera.guide;
  assert.ok(g, '★monstera.guide 가 세이브에 안 실렸습니다 — 안내가 처음부터 다시 셉니다');
  assert.equal(g.days, 7, `★유도 일수가 안 이어집니다 — ${g.days}`);
  assert.equal(g.moved, true);
  assert.equal(g.movedDays, 3);
});

/* ══ 결과 ══════════════════════════════════════════════════════════════ */
console.log('\n══ tools/test_crop_seat.mjs ══════════════════════════════════');
for (const [k, n, m] of results)
  console.log(`  ${k.padEnd(4)} ${n}` + (m ? `\n        ${m}` : ''));
const failed = results.filter(r => r[0] === 'FAIL');
console.log(`\n  잰 것 ${results.filter(r => r[0] !== 'INFO').length}개 · ` +
            `어긋난 것 ${failed.length}개`);
if (failed.length) process.exit(1);
