/* 빨리감기 · 이벤트 점핑 재현 — 박사님 확정 2026-08-03 · docs/time_modes.md §이벤트 정지 목록
 *
 *   node tools/test_fastforward.mjs
 *
 * ★ 이 재현이 지키는 것은 다섯 가지다. 하나라도 깨지면 빨리감기가 게임을 망가뜨린다.
 *   ⑴ 적정광 빨리감기가 **이벤트에서** 멈춘다        — 볼 것을 안 건너뛴다
 *   ⑵ 저광에서는 **날짜만 가고 형태가 안 는다**      — "자리가 결과를 바꾼다"가 빨리감기에서도 산다
 *   ⑶ 중단하면 **그 날에서 정확히** 선다             — 반 턴이 남지 않는다
 *   ⑷ 오류 턴에서 **즉시** 멈춘다                    — 조용히 계속 돌지 않는다
 *   ⑸ 타이머가 안 남는다                             — 유령 턴 금지
 *
 * 가짜 시계를 넣어 실제 시간을 기다리지 않는다(loop.js 의 opt.timers). 로직은 한 글자도 안 바꾼다.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  beansproutReady, firstPlayRulesFromBalance, firstPlayNextEvent, markMonsteraPhase,
  moveMonstera, placeBeansprout
} from '../src/game/first_play.js';
import {
  FAST_MODE_MAX_DAYS, JUMP_MAX_DAYS,
  harvestCrop, isFastForwarding, nextDay, nextEventPreview,
  startFastForward, stopFastForward, timeModeOf
} from '../src/game/loop.js';
import { givePlant, newState, pot0, waterCrop } from '../src/game/state.js';

const RULES = firstPlayRulesFromBalance(JSON.parse(
  readFileSync(new URL('../data/balance/characters.json', import.meta.url), 'utf8')));

/* ── 가짜 시계 ────────────────────────────────────────────────
   ★ 남은 타이머를 셀 수 있는 것이 핵심이다. 진짜 setTimeout 이면 ⑸ 를 증명할 수 없다. */
function makeClock() {
  let now = 0, seq = 1;
  const pending = new Map();
  const clock = {
    timers: {
      setTimeout(fn, ms) { const id = seq++; pending.set(id, { at: now + (ms || 0), fn }); return id; },
      clearTimeout(id) { pending.delete(id); }
    },
    pending: () => pending.size,
    step() {
      let bestId = null, best = null;
      for (const [id, t] of pending) if (!best || t.at < best.at) { bestId = id; best = t; }
      if (bestId == null) return false;
      pending.delete(bestId); now = best.at; best.fn(); return true;
    },
    run(limit = 500) { let n = 0; while (n++ < limit && clock.step()); return n; }
  };
  return clock;
}

/* ── 공용 스텁 (test_first_play_attacks.mjs 와 같은 모양) ────── */
const SLOTS = () => ([
  { slotId: 'dark', dli: 0.2, maxPotD: 0.30 },
  { slotId: 'arrival', dli: 0.1, maxPotD: 0.30 },
  { slotId: 'sill', dli: 3.77, maxPotD: 0.21 }
]);
function mkLight(slots) {
  return {
    room: { slots }, clearCache() {}, thresholdsOf: () => ({ fenestrate: 6 }),
    daily: () => ({
      sky: { season: 'summer', weather: 'clear' },
      check: { ok: true, badSlots: new Set(), problems: [] },
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
      : { phaseId: 'spear_ready', phaseKo: '말린 새순을 준비하는 중', progress01: Math.max(0, (growth - 143) / 3),
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
/* 한 번 부르면 끝날 때까지 돌린다. onStop 이 실제로 왔는지도 같이 확인한다.
   ★ `autoWater: true` 가 기본이다 (2026-08-04) — 여기 있는 검사들은 **"매일 물을 준 판"** 에서
     빨리감기가 무엇에 서는가를 본다. 물주기 자체는 아래 §물주기 블록이 따로 잰다.
     (점핑의 실제 기본값은 `stopOnDry` 쪽이다 — loop.js §물주기와 어떻게 맞물리나) */
function drive(S, io, clock, opt) {
  const seen = [];
  let stop = null;
  const handle = startFastForward(S, io, {
    msPerDay: 0, timers: clock.timers, autoWater: true,
    onDay: (turn, info) => seen.push({ turn, info }),
    onStop: (reason, info) => { stop = { reason, ...info }; },
    ...opt
  });
  return { handle, seen, get stop() { return stop; } };
}

const CYCLE = RULES.harvestDays;                 // ★ 자라는 날 = 물을 준 날 (2026-08-04)

/* ★ 거둘 수 있으면 손으로 거둔다 — **첫 수확의 몬스테라 선물도 여기서 온다** (2026-08-04).
   빨리감기는 대신 안 거둔다(loop.js §수확과 어떻게 맞물리나) — 그래서 재현도 사람이 누른다. */
function harvest(S, io) {
  assert.equal(beansproutReady(S.firstPlay.beansprout), true, '★거둘 수 있는 상태가 아니다');
  return harvestCrop(S, io);
}

const results = [];
const check = (name, fn) => { try { fn(); results.push(['PASS', name]); }
                              catch (e) { results.push(['FAIL', name, e.message]); }
                              finally { stopFastForward(); } };

/* ══ ⑴ 적정광 빨리감기가 이벤트에서 멈춘다 ═══════════════════════════════ */
check('⑴-a ★거둘 때가 되면 선다 — 대신 거두지 않는다 (건너뛰지도 않는다)', () => {
  const clock = makeClock();
  const growth = mkGrowth();
  const io = { light: mkLight(SLOTS()), growth };
  const S = firstPlayState();

  const pre = nextEventPreview(S);
  assert.equal(pre.id, 'beansprout_harvest');
  assert.equal(pre.etaDays, CYCLE, '남은 날을 셀 수 있으면 낸다');

  const run = drive(S, io, clock, { untilEvent: true });
  assert.equal(isFastForwarding(), true, '시작하면 돌고 있어야 한다');
  clock.run();

  assert.equal(run.stop.reason, 'event', `이벤트에서 서야 한다: ${run.stop.reason}`);
  assert.equal(S.day, CYCLE, `Day ${CYCLE} 에서 선다: ${S.day}`);
  assert.equal(run.stop.days, CYCLE);
  assert.equal(run.seen.length, CYCLE, '★ 하루씩 실제로 그렸다(순간이동 아님)');
  assert.deepEqual(run.seen.map(x => x.info.day),
    Array.from({ length: CYCLE }, (_, i) => i + 1));
  /* ★★ 2026-08-04 — 빨리감기는 **거두지 않는다.** 서는 사유가 "거둘 때가 됐다" 하나다. */
  assert.deepEqual(run.stop.events.map(e => e.id), ['beansprout_ready'],
    `거둘 때가 됐다는 사건 하나로 서야 한다: ${run.stop.events.map(e => e.id)}`);
  assert.equal(S.firstPlay.beansprout.harvested, false, '★빨리감기가 대신 거뒀다');
  assert.equal(S.pots.length, 0, '★안 거뒀는데 몬스테라가 왔다');
  assert.equal(nextEventPreview(S).id, 'beansprout_ready', '다음에 올 것은 날짜가 아니라 손이다');

  /* ★ 손으로 거둔다 — 그때 수확·도착이 한꺼번에 난다 */
  const r = harvest(S, io);
  assert.equal(S.firstPlay.beansprout.meals, 3);
  assert.deepEqual(r.events.map(e => e.id).sort(),
    ['beansprout_harvest', 'learn_cropDark', 'learn_harvest', 'monstera_arrived'],
    `[수확하기] 가 그날의 사건을 다 내야 한다: ${r.events.map(e => e.id)}`);
  assert.equal(S.pots.length, 1, '첫 수확에 몬스테라가 온다');
  assert.equal(clock.pending(), 0, '⑸ 타이머가 남으면 안 된다');
  assert.equal(isFastForwarding(), false);
});

check('⑴-b 창턱으로 옮긴 뒤 말린 새순에서 선다', () => {
  const clock = makeClock();
  const growth = mkGrowth();
  const io = { light: mkLight(SLOTS()), growth };
  const S = firstPlayState();
  drive(S, io, clock, { untilEvent: true }); clock.run();
  assert.equal(S.day, CYCLE);
  harvest(S, io);                                  // ★ 거둬야 몬스테라가 온다

  pot0(S).slotId = 'sill';
  moveMonstera(S.firstPlay, 'sill');
  assert.equal(nextEventPreview(S).id, 'spear_furled');
  assert.equal(nextEventPreview(S).etaDays, null, '빛에 달린 것은 며칠 남았다고 지어내지 않는다');

  const run = drive(S, io, clock, { untilEvent: true });
  clock.run();
  assert.equal(run.stop.reason, 'event');
  assert.equal(S.day, CYCLE + 3, `말린 새순에서 선다: ${S.day}`);
  assert.equal(run.stop.days, 3);
  assert.equal(growth.growthDays(), 146);
  assert.equal(S.firstPlay.completed, true);
  assert.equal(S.firstPlay.monstera.growthPhase.phaseId, 'spear_furled');
  assert.ok(run.stop.events.some(e => e.id === 'spear_furled'), '말린 새순이 정지 사유여야 한다');
  /* ★ 지나온 3일이 전부 화면에 나갔는가 — 자라는 걸 보여주는 게 이 작업의 목적이다 */
  assert.deepEqual(run.seen.map(x => x.turn.effectiveGrowthDays), [144, 145, 146]);
  assert.equal(clock.pending(), 0);
});

check('⑴-c 배속 9일 — 새순이 절정으로 가는 구간이 다 그려진다', () => {
  const clock = makeClock();
  const growth = mkGrowth();
  const io = { light: mkLight(SLOTS()), growth };
  const S = firstPlayState();
  drive(S, io, clock, { untilEvent: true }); clock.run();
  harvest(S, io);
  pot0(S).slotId = 'sill';
  moveMonstera(S.firstPlay, 'sill');
  drive(S, io, clock, { untilEvent: true }); clock.run();       // Day 7 · 말린 새순

  /* 튜토가 끝났으므로 이제 점핑은 없다 — 배속으로 Day 16 까지 간다(⑷ 모드 잠금과 같은 규칙) */
  assert.equal(timeModeOf(S), 'fast');
  const run = drive(S, io, clock, { untilEvent: false, maxDays: 9 });
  clock.run();
  assert.equal(run.stop.reason, 'maxDays');
  assert.equal(S.day, CYCLE + 3 + 9, `9일을 더 간다: ${S.day}`);
  assert.equal(run.seen.length, 9, '9일이 하루씩 다 그려졌다');
  assert.equal(growth.growthDays(), 155, `유효 생장 155 여야 한다: ${growth.growthDays()}`);
  assert.equal(clock.pending(), 0);
});

/* ══ ⑵ ★저광에서는 날짜만 가고 형태가 안 는다 ════════════════════════════ */
check('⑵ 어두운 자리 — 12일이 지나도 유효 생장 143 그대로', () => {
  const clock = makeClock();
  const growth = mkGrowth();
  const io = { light: mkLight(SLOTS()), growth };
  const S = firstPlayState();
  drive(S, io, clock, { untilEvent: true }); clock.run();
  harvest(S, io);
  assert.equal(S.day, CYCLE);
  assert.equal(growth.growthDays(), 143);
  assert.equal(pot0(S).slotId, 'arrival', '몬스테라는 어두운 자리에 도착한다');

  const phaseBefore = JSON.stringify(S.firstPlay.monstera.growthPhase);
  const run = drive(S, io, clock, { untilEvent: true, maxDays: 12 });
  clock.run();

  assert.equal(run.stop.reason, 'maxDays', `이벤트가 안 오므로 한도에서 선다: ${run.stop.reason}`);
  assert.equal(S.day, CYCLE + 12, `★날짜는 갔다: ${S.day}`);
  assert.equal(run.stop.days, 12);
  assert.equal(growth.growthDays(), 143, `★형태는 안 늘었다: ${growth.growthDays()}`);
  assert.equal(S.firstPlay.completed, false, '어두운 자리에서 말린 새순이 나오면 안 된다');
  assert.equal(JSON.stringify(S.firstPlay.monstera.growthPhase), phaseBefore, '단계도 그대로다');
  assert.ok(run.seen.every(x => x.turn.grew === false), '자란 턴이 하나도 없어야 한다');
  assert.ok(run.seen.every(x => x.info.blocked === '빛 부족'), '매일 정지 사유가 알림으로 나간다');
  assert.equal(run.seen.length, 12, '그래도 12일은 하루씩 그렸다');
  /* ★ 지름길 검사 — 빛 입력이 매일 실제로 들어갔나(계약을 건너뛰면 여기가 빈다) */
  assert.equal(S.dliHist.length, 12);
  assert.ok(S.dliHist.every(v => v === 0.1));
  assert.equal(clock.pending(), 0);
});

check('⑵-b 어두운 자리에서 stopOnBlock 을 켜면 첫 정지에서 선다(기본은 꺼짐)', () => {
  const clock = makeClock();
  const io = { light: mkLight(SLOTS()), growth: mkGrowth() };
  const S = firstPlayState();
  drive(S, io, clock, { untilEvent: true }); clock.run();
  harvest(S, io);
  const run = drive(S, io, clock, { untilEvent: true, maxDays: 12, stopOnBlock: true });
  clock.run();
  assert.equal(run.stop.reason, 'blocked');
  assert.equal(run.stop.days, 1);
  assert.equal(clock.pending(), 0);
});

/* ══ ⑶ 중단하면 그 날에서 정확히 선다 ═══════════════════════════════════ */
check('⑶ 3일째에 중단 — Day 3 에서 정확히 서고 더 안 돈다', () => {
  const clock = makeClock();
  const growth = mkGrowth();
  const io = { light: mkLight(SLOTS()), growth };
  const S = firstPlayState();
  const run = drive(S, io, clock, { untilEvent: true });

  clock.step(); clock.step(); clock.step();
  assert.equal(S.day, 3);
  assert.equal(isFastForwarding(), true);

  assert.equal(stopFastForward(), true, '돌고 있으면 멈춘다');
  assert.equal(run.stop.reason, 'stopped');
  assert.equal(run.stop.days, 3);
  assert.equal(S.day, 3, `중단한 그 날에 선다: ${S.day}`);
  assert.equal(S.firstPlay.beansprout.ageDays, 3, '반 턴이 남지 않는다');
  assert.equal(isFastForwarding(), false);
  assert.equal(clock.pending(), 0, '⑸ 중단하면 타이머가 사라진다');

  /* ★ 유령 턴 — 멈춘 뒤 시계를 아무리 돌려도 하루도 더 가면 안 된다 */
  clock.run();
  assert.equal(S.day, 3, '★멈춘 뒤에 턴이 더 돌았다면 유령 턴이다');
  assert.equal(run.seen.length, 3);
  assert.equal(stopFastForward(), false, '두 번 눌러도 안전하다');
});

/* ══ ⑷ 오류 턴에서 즉시 멈춘다 ═════════════════════════════════════════ */
check('⑷-a 그리기 실패(drawn:false) — 그 턴에서 정지하고 사유를 낸다', () => {
  const clock = makeClock();
  const growth = mkGrowth();
  const real = growth.advanceTo.bind(growth);
  let n = 0;
  growth.advanceTo = (d) => {
    const r = real(d);
    return (++n === 3) ? { ...r, drawn: false, drawError: '3D 그리기 실패 주입' } : r;
  };
  const S = newState({ room: 'banjiha', mode: 'novice' });
  givePlant(S, { growth }, { slotId: 'sill' });
  const io = { light: mkLight(SLOTS()), growth };

  const run = drive(S, io, clock, { untilEvent: false, maxDays: 20 });
  clock.run();

  assert.equal(run.stop.reason, 'error', `사고면 error 로 선다: ${run.stop.reason}`);
  assert.equal(run.stop.days, 2, '성공한 턴만 센다');
  assert.equal(S.day, 3, 'loop 가 되감지 않은 것을 그대로 둔다');
  assert.match(run.stop.error.message, /3D 그리기 실패 주입/);
  assert.equal(run.stop.error.turnState, 'growth_advanced');
  assert.match(S.desync.reason, /3D 그리기 실패 주입/);
  assert.equal(run.seen.length, 2, '실패한 턴은 onDay 로 안 나간다(turn 은 onStop 에 실린다)');
  assert.equal(run.stop.turn.drawn, false, '그린 턴 정보는 onStop 으로 넘어간다');
  assert.equal(clock.pending(), 0, '⑸ 오류에도 타이머가 안 남는다');
  clock.run();
  assert.equal(S.day, 3, '★오류 뒤에 조용히 계속 돌면 안 된다');
});

check('⑷-b HUD 실패 — 하루는 갔지만 거기서 멈춘다', () => {
  const clock = makeClock();
  const growth = mkGrowth();
  const real = growth.advanceTo.bind(growth);
  let n = 0;
  growth.advanceTo = (d) => {
    const r = real(d);
    return (++n === 3) ? { ...r, hudError: 'HUD 실패 주입' } : r;
  };
  const S = newState({ room: 'banjiha', mode: 'novice' });
  givePlant(S, { growth }, { slotId: 'sill' });
  const run = drive(S, { light: mkLight(SLOTS()), growth }, clock, { untilEvent: false, maxDays: 20 });
  clock.run();
  assert.equal(run.stop.reason, 'hudError');
  assert.equal(run.stop.days, 3, 'HUD 는 하루가 간 뒤에 드러난다');
  assert.equal(S.day, 3);
  assert.equal(clock.pending(), 0);
  clock.run();
  assert.equal(S.day, 3);
});

check('⑷-c 계약 단절(not_started) — 하루도 안 세고 즉시 정지', () => {
  const clock = makeClock();
  const growth = mkGrowth();
  const real = growth.assertContract.bind(growth);
  let n = 0;
  growth.assertContract = () => { if (++n === 3) throw new Error('계약 끊김 주입'); return real(); };
  const S = newState({ room: 'banjiha', mode: 'novice' });
  givePlant(S, { growth }, { slotId: 'sill' });
  const run = drive(S, { light: mkLight(SLOTS()), growth }, clock, { untilEvent: false, maxDays: 20 });
  clock.run();
  assert.equal(run.stop.reason, 'error');
  assert.equal(run.stop.error.turnState, 'not_started');
  assert.equal(run.stop.days, 2);
  assert.equal(S.day, 2, '시작조차 안 한 턴은 날짜를 안 올린다');
  assert.equal(clock.pending(), 0);
});

check('⑷-d 도착 실패 — [수확하기] 가 무르고 그 자리에서 다시 누를 수 있다', () => {
  const clock = makeClock();
  const growth = mkGrowth({ growthPhase: () => null });      // 단계를 못 읽는 growth
  const io = { light: mkLight(SLOTS()), growth };
  const S = firstPlayState();
  const run = drive(S, io, clock, { untilEvent: true });
  clock.run();
  /* ★ 2026-08-04 — 빨리감기는 거두지 않으므로 **여기서는 안 터진다.** 거둘 때가 돼서 설 뿐이다.
     도착 실패는 사람이 [수확하기] 를 누른 그 순간에 난다. */
  assert.equal(run.stop.reason, 'event', `거둘 때가 됐다에서 선다: ${run.stop.reason}`);
  assert.equal(S.day, CYCLE);

  let err = null;
  try { harvestCrop(S, io); } catch (e) { err = e; }
  assert.match(err.message, /단계를 읽지 못했습니다/);
  assert.equal(err.harvestRolledBack, true, '수확을 물렀다는 표식이 없다');
  assert.equal(S.day, CYCLE, '★날짜는 이미 확정된 뒤다');
  assert.equal(S.pots.length, 0);
  assert.equal(S.firstPlay.beansprout.harvested, false);
  assert.equal(beansproutReady(S.firstPlay.beansprout), true, '다시 누를 수 있다');
  assert.equal(clock.pending(), 0);
});

check('⑷-e onDay 가 던져도 타이머를 남기지 않는다(화면 쪽 사고)', () => {
  const clock = makeClock();
  const io = { light: mkLight(SLOTS()), growth: mkGrowth() };
  const S = firstPlayState();
  let stop = null;
  startFastForward(S, io, {
    msPerDay: 0, timers: clock.timers, untilEvent: true, autoWater: true,
    onDay: (t, info) => { if (info.index === 2) throw new Error('화면 갱신 실패 주입'); },
    onStop: (reason, info) => { stop = { reason, ...info }; }
  });
  clock.run();
  assert.equal(stop.reason, 'callbackError');
  assert.equal(stop.days, 2);
  assert.equal(S.day, 2);
  assert.equal(isFastForwarding(), false);
  assert.equal(clock.pending(), 0, '⑸ 콜백이 터져도 타이머는 정리된다');
  clock.run();
  assert.equal(S.day, 2);
});

/* ══ ④ 튜토 전용 잠금 · 입력 방어 ══════════════════════════════════════ */
check('④ 점핑은 튜토 전용 — 완료 뒤에는 배속만, 배속에도 상한이 있다', () => {
  const clock = makeClock();
  const io = { light: mkLight(SLOTS()), growth: mkGrowth() };

  /* 튜토 진행 중 = jump */
  const S = firstPlayState();
  assert.equal(timeModeOf(S), 'jump');
  const h = startFastForward(S, io, { msPerDay: 0, timers: clock.timers, untilEvent: true, maxDays: 999 });
  assert.equal(h.maxDays, JUMP_MAX_DAYS, `점핑도 무한이 아니다: ${h.maxDays}`);
  assert.throws(() => startFastForward(S, io, { timers: clock.timers }), /이미 돌고 있습니다/);
  stopFastForward();

  /* 튜토 완료 = fast. 점핑 요청은 조용히 낮추지 않고 던진다 */
  S.firstPlay.beansprout.harvested = true;
  S.firstPlay.monstera.arrived = true;                 // 도착 이후 상태를 만든다
  markMonsteraPhase(S.firstPlay, { phaseId: 'spear_furled', phaseKo: '말린 새순 등장', progress01: 0 });
  assert.equal(S.firstPlay.completed, true);
  assert.equal(timeModeOf(S), 'fast');
  assert.throws(() => startFastForward(S, io, { timers: clock.timers, untilEvent: true }),
    /튜토리얼 전용/);
  assert.throws(() => startFastForward(S, io, { timers: clock.timers, untilEvent: false }),
    /maxDays 가 필요합니다/);
  assert.throws(() => startFastForward(S, io, { timers: clock.timers, untilEvent: false, maxDays: FAST_MODE_MAX_DAYS + 1 }),
    /점핑입니다/);
  assert.equal(nextEventPreview(S), null, '완료 뒤엔 다음 이벤트가 없다');

  /* 첫 플레이가 아닌 판도 fast */
  const plain = newState({ room: 'banjiha', mode: 'novice' });
  assert.equal(timeModeOf(plain), 'fast');
  assert.equal(nextEventPreview(plain), null);
  assert.equal(isFastForwarding(), false, '던진 뒤에는 아무것도 안 돌고 있어야 한다');
  assert.equal(clock.pending(), 0, '⑸ 시작을 거절했으면 타이머도 없다');
});

check('④-b 시루를 안 놨으면 시작 전에 안내한다(버튼을 잠그지 않는 등급)', () => {
  const clock = makeClock();
  const io = { light: mkLight(SLOTS()), growth: mkGrowth() };
  const S = newState({ room: 'banjiha', mode: 'novice', firstPlay: true, firstPlayRules: RULES });
  let err = null;
  try { startFastForward(S, io, { timers: clock.timers, untilEvent: true }); } catch (e) { err = e; }
  assert.match(err.message, /시루를 먼저/);
  assert.equal(err.firstPlayInput, true, 'game.html 의 isRecoverable 이 보는 표식');
  assert.equal(S.day, 0);
  assert.equal(isFastForwarding(), false);
  assert.equal(clock.pending(), 0);
});

/* ══ ★★ 물주기 × 빨리감기 (2026-08-04) ═════════════════════════════════
   loop.js §물주기와 어떻게 맞물리나 가 정본이다. 두 모드가 답을 달리 낸다:
     jump(튜토)  마른 날에 **선다**       — 배우는 구간이라 코어가 대신 하지 않는다
     fast(그 뒤) 물을 **같이 준다**       — 안 그러면 배속이 하루짜리가 되어 사라진다 */
check('★물주기-a 점핑은 마른 날에 선다 — 물을 대신 주지 않는다', () => {
  const clock = makeClock();
  const io = { light: mkLight(SLOTS()), growth: mkGrowth() };
  const S = firstPlayState();
  assert.equal(timeModeOf(S), 'jump');

  /* 오늘(Day 0) 물을 주고 시작하면 그 하루는 간다 — 그리고 다음 날 말라 선다 */
  waterCrop(S);
  const run = drive(S, io, clock, { untilEvent: true, autoWater: undefined });
  clock.run();
  assert.equal(run.stop.reason, 'dry', `마른 날에 서야 한다: ${run.stop.reason}`);
  assert.equal(S.day, 2, `물을 준 하루 + 마른 하루 = 2일: ${S.day}`);
  assert.equal(S.firstPlay.beansprout.ageDays, 1, '★마른 날에 콩나물이 자랐다');
  assert.equal(S.firstPlay.beansprout.harvested, false);
  assert.equal(clock.pending(), 0, '⑸ 타이머가 남으면 안 된다');
  assert.equal(isFastForwarding(), false);
});

check('★물주기-b 배속은 물을 같이 준다 — 손으로 매일 준 것과 결과가 같다', () => {
  /* 튜토를 끝낸 판(= 배속 모드)에서 열흘을 감는다 */
  const mk = () => {
    const clock = makeClock();
    const io = { light: mkLight(SLOTS()), growth: mkGrowth() };
    const S = firstPlayState();
    drive(S, io, clock, { untilEvent: true }); clock.run();     // 거둘 때가 됐다에서 선다
    harvest(S, io);                                             // ★ 손으로 거둔다 → 도착
    pot0(S).slotId = 'sill'; moveMonstera(S.firstPlay, 'sill');
    drive(S, io, clock, { untilEvent: true }); clock.run();     // 말린 새순 → 튜토 완료
    assert.equal(timeModeOf(S), 'fast');
    /* 다음 회전을 심어 둔다(씨앗·시루 재고 없이 상태만 되돌린다 — 여기서 재는 것은 물주기다) */
    Object.assign(S.firstPlay.beansprout,
      { harvested: false, ageDays: 0, dliHist: [], wateredOnDay: null, dryDays: 0, dryRun: 0 });
    return { S, io, clock };
  };

  /* ★ `stopOnReady: false` — 이 블록이 재는 것은 **물**이다. 거둘 때가 됐다는 정지는
     아래 §수확 블록이 따로 잰다(둘을 한 검사에 섞으면 무엇 때문에 섰는지 안 보인다). */
  const auto = mk();
  const runAuto = drive(auto.S, auto.io, auto.clock,
    { untilEvent: false, maxDays: 10, stopOnReady: false });
  auto.clock.run();
  assert.equal(runAuto.stop.reason, 'maxDays', `배속이 마른 날에 서면 안 된다: ${runAuto.stop.reason}`);
  assert.equal(runAuto.stop.days, 10, '열흘을 다 갔다');

  /* 대조군 — 같은 열흘을 **손으로** [물 주기]+[다음 날] 로 밟는다(거두지는 않는다) */
  const hand = mk();
  for (let i = 0; i < 10; i++) { waterCrop(hand.S); nextDay(hand.S, hand.io); }

  assert.equal(auto.S.firstPlay.beansprout.ageDays, hand.S.firstPlay.beansprout.ageDays,
    '★배속과 손이 다른 결과를 냈습니다 — 자동 급수가 지름길이 되었습니다');
  assert.equal(auto.S.firstPlay.beansprout.dryDays, 0, '배속에서 마른 날이 생겼습니다');
  assert.equal(auto.S.firstPlay.food.totalFoodSavedWon, hand.S.firstPlay.food.totalFoodSavedWon,
    '★배속과 손의 절감액이 다릅니다');
});

check('★물주기-c 거둔 시루·안 놓은 시루는 마를 것이 없다 — 빨리감기가 그대로 간다', () => {
  const clock = makeClock();
  const io = { light: mkLight(SLOTS()), growth: mkGrowth() };
  const S = firstPlayState();
  drive(S, io, clock, { untilEvent: true }); clock.run();       // 거둘 때가 됐다에서 선다
  harvest(S, io);                                               // ★ 손으로 거둔다
  assert.equal(S.firstPlay.beansprout.harvested, true);

  /* 다시 심지 않은 채 점핑 — 마름 판정이 아예 안 나므로 한도까지 간다 */
  pot0(S).slotId = 'arrival';                                   // 어두운 자리 = 이벤트도 안 온다
  const run = drive(S, io, clock, { untilEvent: true, autoWater: undefined, maxDays: 8 });
  clock.run();
  assert.equal(run.stop.reason, 'maxDays',
    `거둔 시루뿐인데 마름으로 섰다: ${run.stop.reason} — 빨리감기가 죽습니다`);
  assert.equal(run.stop.days, 8);
});

/* ══ ★★ 수확 × 빨리감기 (2026-08-04) ═══════════════════════════════════
   loop.js §수확과 어떻게 맞물리나 가 정본이다. **두 모드가 다 선다** — 물과 달리 답이 안 갈린다:
     점핑  `beansprout_ready` 사건으로 선다 (거두기 전에는 다음 이벤트가 영영 안 온다)
     배속  `stopOnReady`(기본 켜짐)로 선다 — 거둘 날은 회전당 한 번이라 배속이 안 죽는다
   ★ 자동수확은 나중 보상이다(S.perks.autoHarvest). 지금은 늘 꺼져 있다. */
check('★수확-a 배속도 거둘 때가 되면 선다 — 그리고 **한 번만** 선다', () => {
  const clock = makeClock();
  const io = { light: mkLight(SLOTS()), growth: mkGrowth() };
  const S = firstPlayState();
  drive(S, io, clock, { untilEvent: true }); clock.run();       // 거둘 때가 됐다
  harvest(S, io);
  pot0(S).slotId = 'sill'; moveMonstera(S.firstPlay, 'sill');
  drive(S, io, clock, { untilEvent: true }); clock.run();       // 말린 새순 → 튜토 완료
  assert.equal(timeModeOf(S), 'fast');

  /* 다음 회전을 심어 둔다(여기서 재는 것은 수확이다 — 재고는 안 본다) */
  Object.assign(S.firstPlay.beansprout,
    { harvested: false, ageDays: 0, dliHist: [], wateredOnDay: null, dryDays: 0, dryRun: 0 });

  const run = drive(S, io, clock, { untilEvent: false, maxDays: 20 });
  clock.run();
  assert.equal(run.stop.reason, 'ready', `배속이 거둘 때가 됐다에서 서야 한다: ${run.stop.reason}`);
  assert.equal(run.stop.days, CYCLE, `${CYCLE}일 만에 선다: ${run.stop.days}`);
  assert.equal(S.firstPlay.beansprout.harvested, false, '★배속이 대신 거뒀다 — 자동수확은 나중 보상이다');

  /* ★ 안 거두고 다시 감으면 **또 서지 않는다** — 전환에서만 서기 때문이다.
     "지금 거둘 수 있다"로 세우면 여기서 매번 첫날에 서서 배속이 못 돈다. */
  const again = drive(S, io, clock, { untilEvent: false, maxDays: 20 });
  clock.run();
  assert.equal(again.stop.reason, 'maxDays',
    `안 거둔 채로 다시 감았더니 또 섰다(${again.stop.reason}) — 배속이 못 돕니다`);
  assert.equal(again.stop.days, 20);
  /* ★ 안 거둔 20일 동안 **아무 벌도 없다** — 회전이 멈출 뿐이다(물주기와 같은 사상) */
  assert.equal(S.firstPlay.beansprout.ageDays, CYCLE, '★다 자란 뒤에 더 자랐다');
  assert.equal(S.firstPlay.beansprout.dryDays, 0, '★다 자란 시루가 마른 날을 쌓았다 — 둘째 벌이다');
  assert.equal(S.firstPlay.food.pantryWon, 0, '★안 거뒀는데 곳간에 돈이 들어갔다');
  assert.equal(clock.pending(), 0);
});

check('★수확-b 자동수확 보상이 켜지면 서지 않는다 — 자리만 있고 지금은 늘 꺼져 있다', () => {
  const clock = makeClock();
  const io = { light: mkLight(SLOTS()), growth: mkGrowth() };
  const S = firstPlayState();
  assert.equal(S.perks.autoHarvest, false, '★자동수확이 기본으로 켜져 있다 — 나중 보상이다');

  /* 보상을 받은 판을 흉내 낸다 — 정지 기본값이 뒤집힌다(거두는 것 자체는 아직 구현 안 함) */
  S.perks.autoHarvest = true;
  const run = drive(S, io, clock, { untilEvent: false, maxDays: CYCLE + 2 });
  clock.run();
  assert.equal(run.stop.reason, 'maxDays',
    `자동수확이 켜졌는데 거둘 때가 됐다고 섰다: ${run.stop.reason}`);
  assert.equal(clock.pending(), 0);
});

/* ══ 미리보기 · 형태 단계 전환 ═════════════════════════════════════════ */
check('nextEventPreview — 콩나물 → 말린 새순 순서로 안내한다', () => {
  const S = firstPlayState();
  assert.deepEqual(
    { id: nextEventPreview(S).id, eta: nextEventPreview(S).etaDays },
    { id: 'beansprout_harvest', eta: CYCLE });
  S.firstPlay.beansprout.ageDays = 2;
  assert.equal(nextEventPreview(S).etaDays, CYCLE - 2);
  assert.equal(firstPlayNextEvent(null), null);
});

check('형태 단계 전환도 정지 사유다(첫 플레이 밖에서도)', () => {
  const clock = makeClock();
  let growthDays = 143;
  const growth = mkGrowth();
  const S = newState({ room: 'banjiha', mode: 'novice' });
  givePlant(S, { growth }, { slotId: 'sill' });
  const run = drive(S, { light: mkLight(SLOTS()), growth }, clock, { untilEvent: false, maxDays: 5 });
  clock.run();
  const changes = run.seen.flatMap(x => x.info.events).filter(e => e.id === 'phase_change');
  assert.equal(changes.length, 1, `spear_ready → spear_furled 한 번: ${changes.length}`);
  assert.equal(changes[0].phaseId, 'spear_furled');
  assert.equal(run.stop.reason, 'maxDays', '배속에서는 이벤트가 알림이지 정지가 아니다');
  assert.equal(clock.pending(), 0);
  assert.equal(growthDays, 143);
});

/* ── 보고 ─────────────────────────────────────────────────────────────── */
let fail = 0;
for (const [st, name, msg] of results) {
  if (st === 'FAIL') fail++;
  console.log(`${st}  ${name}${msg ? '\n      → ' + msg : ''}`);
}
console.log(fail ? `\nfastforward: FAIL (${fail}건)` : '\nfastforward: PASS');
process.exit(fail ? 1 : 0);
