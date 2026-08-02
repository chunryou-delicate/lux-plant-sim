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
  firstPlayRulesFromBalance, firstPlayNextEvent, markMonsteraPhase,
  moveMonstera, placeBeansprout
} from '../src/game/first_play.js';
import {
  FAST_MODE_MAX_DAYS, JUMP_MAX_DAYS,
  isFastForwarding, nextEventPreview, startFastForward, stopFastForward, timeModeOf
} from '../src/game/loop.js';
import { givePlant, newState, pot0 } from '../src/game/state.js';

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
/* 한 번 부르면 끝날 때까지 돌린다. onStop 이 실제로 왔는지도 같이 확인한다. */
function drive(S, io, clock, opt) {
  const seen = [];
  let stop = null;
  const handle = startFastForward(S, io, {
    msPerDay: 0, timers: clock.timers,
    onDay: (turn, info) => seen.push({ turn, info }),
    onStop: (reason, info) => { stop = { reason, ...info }; },
    ...opt
  });
  return { handle, seen, get stop() { return stop; } };
}

const results = [];
const check = (name, fn) => { try { fn(); results.push(['PASS', name]); }
                              catch (e) { results.push(['FAIL', name, e.message]); }
                              finally { stopFastForward(); } };

/* ══ ⑴ 적정광 빨리감기가 이벤트에서 멈춘다 ═══════════════════════════════ */
check('⑴-a Day 4 콩나물 수확·도착에서 선다 (건너뛰지 않는다)', () => {
  const clock = makeClock();
  const growth = mkGrowth();
  const io = { light: mkLight(SLOTS()), growth };
  const S = firstPlayState();

  const pre = nextEventPreview(S);
  assert.equal(pre.id, 'beansprout_harvest');
  assert.equal(pre.etaDays, 4, '남은 날을 셀 수 있으면 낸다');

  const run = drive(S, io, clock, { untilEvent: true });
  assert.equal(isFastForwarding(), true, '시작하면 돌고 있어야 한다');
  clock.run();

  assert.equal(run.stop.reason, 'event', `이벤트에서 서야 한다: ${run.stop.reason}`);
  assert.equal(S.day, 4, `Day 4 에서 선다: ${S.day}`);
  assert.equal(run.stop.days, 4);
  assert.equal(run.seen.length, 4, '★ 하루씩 실제로 그렸다(순간이동 아님)');
  assert.deepEqual(run.seen.map(x => x.info.day), [1, 2, 3, 4]);
  const ids = run.stop.events.map(e => e.id);
  assert.deepEqual(ids, ['beansprout_harvest', 'food_cash', 'monstera_arrived'],
    `Day 4 의 세 사건이 다 실려야 한다: ${ids}`);
  assert.equal(S.firstPlay.beansprout.meals, 3);
  assert.equal(clock.pending(), 0, '⑸ 타이머가 남으면 안 된다');
  assert.equal(isFastForwarding(), false);
});

check('⑴-b 창턱으로 옮긴 뒤 말린 새순(Day 7)에서 선다', () => {
  const clock = makeClock();
  const growth = mkGrowth();
  const io = { light: mkLight(SLOTS()), growth };
  const S = firstPlayState();
  drive(S, io, clock, { untilEvent: true }); clock.run();
  assert.equal(S.day, 4);

  pot0(S).slotId = 'sill';
  moveMonstera(S.firstPlay, 'sill');
  assert.equal(nextEventPreview(S).id, 'spear_furled');
  assert.equal(nextEventPreview(S).etaDays, null, '빛에 달린 것은 며칠 남았다고 지어내지 않는다');

  const run = drive(S, io, clock, { untilEvent: true });
  clock.run();
  assert.equal(run.stop.reason, 'event');
  assert.equal(S.day, 7, `Day 7 에서 선다: ${S.day}`);
  assert.equal(run.stop.days, 3);
  assert.equal(growth.growthDays(), 146);
  assert.equal(S.firstPlay.completed, true);
  assert.equal(S.firstPlay.monstera.growthPhase.phaseId, 'spear_furled');
  assert.ok(run.stop.events.some(e => e.id === 'spear_furled'), '말린 새순이 정지 사유여야 한다');
  /* ★ 지나온 3일이 전부 화면에 나갔는가 — 자라는 걸 보여주는 게 이 작업의 목적이다 */
  assert.deepEqual(run.seen.map(x => x.turn.effectiveGrowthDays), [144, 145, 146]);
  assert.equal(clock.pending(), 0);
});

check('⑴-c Day 16 까지 빨리감기 — 새순이 절정으로 가는 구간이 다 그려진다', () => {
  const clock = makeClock();
  const growth = mkGrowth();
  const io = { light: mkLight(SLOTS()), growth };
  const S = firstPlayState();
  drive(S, io, clock, { untilEvent: true }); clock.run();
  pot0(S).slotId = 'sill';
  moveMonstera(S.firstPlay, 'sill');
  drive(S, io, clock, { untilEvent: true }); clock.run();       // Day 7 · 말린 새순

  /* 튜토가 끝났으므로 이제 점핑은 없다 — 배속으로 Day 16 까지 간다(⑷ 모드 잠금과 같은 규칙) */
  assert.equal(timeModeOf(S), 'fast');
  const run = drive(S, io, clock, { untilEvent: false, maxDays: 9 });
  clock.run();
  assert.equal(run.stop.reason, 'maxDays');
  assert.equal(S.day, 16, `Day 16 까지 간다: ${S.day}`);
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
  assert.equal(S.day, 4);
  assert.equal(growth.growthDays(), 143);
  assert.equal(pot0(S).slotId, 'arrival', '몬스테라는 어두운 자리에 도착한다');

  const phaseBefore = JSON.stringify(S.firstPlay.monstera.growthPhase);
  const run = drive(S, io, clock, { untilEvent: true, maxDays: 12 });
  clock.run();

  assert.equal(run.stop.reason, 'maxDays', `이벤트가 안 오므로 한도에서 선다: ${run.stop.reason}`);
  assert.equal(S.day, 16, `★날짜는 갔다: ${S.day}`);
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

check('⑷-d Day 4 도착 실패 — 되돌린 그 자리에서 정지(재시도 가능)', () => {
  const clock = makeClock();
  const growth = mkGrowth({ growthPhase: () => null });      // 단계를 못 읽는 growth
  const io = { light: mkLight(SLOTS()), growth };
  const S = firstPlayState();
  const run = drive(S, io, clock, { untilEvent: true });
  clock.run();
  assert.equal(run.stop.reason, 'error');
  assert.match(run.stop.error.message, /단계를 읽지 못했습니다/);
  assert.equal(run.stop.error.turnState, 'core_rolled_back');
  assert.equal(S.day, 3, 'Day 4 는 확정되지 않는다');
  assert.equal(S.pots.length, 0);
  assert.equal(S.firstPlay.beansprout.harvested, false);
  assert.equal(clock.pending(), 0);
});

check('⑷-e onDay 가 던져도 타이머를 남기지 않는다(화면 쪽 사고)', () => {
  const clock = makeClock();
  const io = { light: mkLight(SLOTS()), growth: mkGrowth() };
  const S = firstPlayState();
  let stop = null;
  startFastForward(S, io, {
    msPerDay: 0, timers: clock.timers, untilEvent: true,
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

/* ══ 미리보기 · 형태 단계 전환 ═════════════════════════════════════════ */
check('nextEventPreview — 콩나물 → 말린 새순 순서로 안내한다', () => {
  const S = firstPlayState();
  assert.deepEqual(
    { id: nextEventPreview(S).id, eta: nextEventPreview(S).etaDays },
    { id: 'beansprout_harvest', eta: 4 });
  S.firstPlay.beansprout.ageDays = 2;
  assert.equal(nextEventPreview(S).etaDays, 2);
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
