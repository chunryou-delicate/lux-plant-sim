/* ============================================================
   game/loop.js — 턴 진행 (core 소유)
   ------------------------------------------------------------
   이 파일만 읽으면 하루에 무슨 일이 일어나는지 다 보이게 둔다.

   nextDay(S):
     1. S.day++
     2. 날씨·계절            skyFor(day, mode)        ← weather.js (코어가 따로 굴리지 않는다)
     3. 조도 계산            buildDailyLight(...)     ← house
     4. ★ 계약 검증          NaN·음수·밴드            ← 지시 5-3
     5. 개체별 빛 전달       setDailyLight(dli)       ← growth · null 도 반드시 넘긴다
     6. 하루 진행            advanceTo(달력+1)         ← growth · 형태는 빛이 될 때만 쌓인다
     7. 화면 갱신            (ui.js)

   ★ 없는 단계: 고사·수확·지출.
     고사·활력은 **취소·보류**다(2026-08-02). 코어는 판정도 표시도 하지 않는다.
     band === 'critical' 로 죽이는 코드는 절대 넣지 않는다 —
     반지하 산세는 맑음↔흐림으로 밴드를 매일 오가므로 하루로 죽이면 운으로 죽는다.

   ★★ 이 파일은 UI를 모른다 (밸런스 자동 시뮬 대비, 2026-08-01)
     document·window·DOM을 쓰지 않는다. 화면 갱신은 호출부(game.html)가 한다.
     바깥과 닿는 곳은 인자 `io` 두 개뿐이다 — 이걸 바꿔 끼우면 헤드리스로 돈다.

       io.light  { daily(day, S) -> {report, sky, check},  room, thresholdsOf(), dliOfSlot() }
                   브라우저: light_adapter (buildHouse + THREE)
                   헤드리스: room_profile.createProfileLight (THREE 없음)
       io.growth { setDailyLight(dli), advanceTo(day), calendarDay(), growthDays(), growthBlocked() }
                   ⚠ setGrowth(점프)는 개체 도착 때 1회뿐 — 일일 루프에서 부르지 않는다
                   브라우저: growth_adapter (plant_grow.html iframe)
                   헤드리스: sim.nullGrowth — ⚠ 진짜 생장이 아니다(sim.js 주석 참고)

     S는 제자리에서 바뀌고 그대로 반환된다. 호출부는 반환값을 쓰면 된다.
============================================================ */
import { givePlant, pot0, rehomePot, pushLog } from './state.js';
import {
  advanceBeansproutDay,
  cropDliFromReport,
  FIRST_PLAY_ASSETS,
  markMonsteraArrived,
  markMonsteraPhase,
  slotFitsDiameter
} from './first_play.js';
import { dliFromContract } from './growth_adapter.js';
import { weekStats, WEATHER_P } from '../engine/weather.js';

/* 단계 표시를 읽는 유일한 창구. **표시 계약**이라 실패해도 진행을 무르지 않는다 —
   다만 조용히 null 로 숨기지 않고 사유를 같이 낸다(호출부가 라벨을 띄운다).
   growth 가 phaseKo 를 안 내는 옛 버전이면 markMonsteraPhase 가 키를 그대로 쓴다. */
export function phaseOf(io, S) {
  if (!io.growth || typeof io.growth.growthPhase !== 'function')
    return { phase: null, error: null };            // 계약 자체가 없는 경우는 '정보 없음'
  try { return { phase: io.growth.growthPhase(), error: null }; }
  catch (e) { return { phase: null, error: e.message }; }
}

export function nextDay(S, io) {
  const p = pot0(S);

  /* ★ 상태를 건드리기 전에 계약부터 확인한다 (2026-08-02).
     iframe 을 새로고침하면 ready() 를 통과했던 계약이 사라진다. 그대로 진행하면
     달력만 가고 형태는 그대로인 **반쯤 진행된 턴**이 조용히 남는다.
     여기서 던지면 S 는 손도 안 댄 상태다 — 날짜조차 안 올라간다. */
  /* ★ 첫 플레이는 **Day 1 부터** 검사한다 (2026-08-02 정정).
     예전엔 화분이 있을 때만 봐서, 몬스테라가 오기 전 3일이 계약이 죽은 채로 지나갔다 —
     Day 4 선물에서야 막히고 그때까지 쌓인 콩나물 상태는 근거가 없어진다. */
  const needsGrowth = !!p || !!(S.firstPlay && S.firstPlay.enabled);
  if (needsGrowth && io.growth.assertContract) {
    try { io.growth.assertContract(); }
    catch (e) { e.turnState = 'not_started'; throw e; }
  }
  /* ★ 단계 읽기도 **하루를 시작하기 전에** 확인한다 (2026-08-02 정정).
     끝난 뒤에야 알면 "진행은 됐는데 말린 새순 경계를 못 본" 회차가 생긴다 —
     첫 플레이가 증명하려는 게 딱 그 경계라 조용히 건너뛰면 안 된다. */
  if (p && io.growth.growthPhase) {
    const pre = phaseOf(io, S);
    if (pre.error) {
      const e = new Error(`[생장] 단계를 읽을 수 없어 오늘을 시작하지 않았습니다 — ${pre.error}`);
      e.turnState = 'not_started';
      throw e;
    }
  }

  S.day++;

  /* 방을 바꿨거나 가구가 사라졌으면 화분을 회수한다(5-4) */
  if (p) rehomePot(S, io.light.room.slots, m => pushLog(S, m));

  const { report, sky, check } = io.light.daily(S.day, S);
  if (!check.ok) pushLog(S, '⚠ 계약 이상 — ' + check.problems.slice(0, 3).join(' / '));

  /* 첫 4일은 열린 시루 하나만 돈다. 몬스테라 엔진과 섞지 않고, 시루가 놓인 방 슬롯의
     DLI를 그대로 모아 4일째 3/2/1끼를 판정한다. 계약 누락은 암흑으로 보완하지 않는다. */
  let firstPlayEvent = null;
  if (S.firstPlay && S.firstPlay.enabled && !S.firstPlay.beansprout.harvested) {
    const before = structuredClone(S.firstPlay);
    const logLengthBefore = S.log.length;
    try {
      const cropSlotId = S.firstPlay.beansprout.slotId;
      if (check.badSlots && check.badSlots.has(cropSlotId))
        throw new Error(`[첫 플레이] 콩나물 자리 ${cropSlotId}의 조도 계약이 잘못됐습니다`);
      firstPlayEvent = advanceBeansproutDay(
        S.firstPlay,
        cropDliFromReport(report, cropSlotId)
      );

      if (firstPlayEvent.harvested) {
        pushLog(S, `🥣 콩나물 첫 수확 — ${firstPlayEvent.qualityKo} · ${firstPlayEvent.meals}끼`);
        pushLog(S, `🍚 오늘 식비 ${firstPlayEvent.cashFoodWon}원 ` +
                   `(작물 ${firstPlayEvent.usedMeals}끼 · ${firstPlayEvent.foodSavedWon}원 절감)`);

        /* 선물은 수확 정산 뒤 온다. 처음부터 정답 창턱에 놓지 않는다 — 도착 후 플레이어가
           창가 높은 자리로 옮기는 것이 두 번째 학습이다. */
        const roomSlots = (io.light.room && io.light.room.slots) || [];
        const potDiameter = FIRST_PLAY_ASSETS.monsteraPotDiameterM;
        /* ★ 치수가 숫자로 확인된 자리만 후보다. 폴백 금지 (2026-08-02 정정).
           예전엔 후보가 0칸이면 `!canHoldPot.size` 로 **제약을 통째로 껐다** —
           화분이 물리적으로 안 올라가는 자리에 조용히 놓였다. 0칸이면 그건 데이터 문제이므로
           숨기지 않고 던진다. */
        const canHoldPot = new Set(roomSlots
          .filter(s => slotFitsDiameter(s, potDiameter))
          .map(s => s.slotId));
        if (!canHoldPot.size)
          throw new Error(`[첫 플레이] 지름 ${potDiameter}m 화분이 올라가는 자리가 이 방에 없습니다 ` +
                          `(maxPotD 가 숫자로 있는 슬롯 0칸) — 방 데이터를 확인해 주세요`);
        const arrival = [...(report.slots || [])]
          .filter(s => s && s.slotId !== cropSlotId && canHoldPot.has(s.slotId) &&
                       typeof s.dli === 'number' && isFinite(s.dli))
          .sort((a, b) => a.dli - b.dli)[0];
        if (!arrival) throw new Error('[첫 플레이] 몬스테라가 도착할 화분 자리를 찾지 못했습니다');

        const arrived = givePlant(S, io, { slotId: arrival.slotId });
        /* ★ 도착은 setGrowth 가 그려졌고 **단계까지 읽힌 뒤에만** 완성된다 (2026-08-02 정정).
           단계를 못 읽으면 말린 새순 경계를 영영 못 보는 개체가 남는다 — 여기서 던지면
           바깥 catch 가 화분·수확·식비·날짜를 통째로 되돌려 Day 4 를 다시 시도할 수 있다. */
        const gp = phaseOf(io, S);
        if (gp.error) {
          S.pots.length = 0;                    // 되돌리기 전에 방금 만든 화분을 거둔다
          throw new Error(`[첫 플레이] 도착한 몬스테라의 단계를 읽지 못했습니다 — ${gp.error}`);
        }
        markMonsteraArrived(S.firstPlay, arrived.slotId);
        markMonsteraPhase(S.firstPlay, gp.phase);
        pushLog(S, '🌱 “콩나물을 잘 키웠구나. 이건 좀 더 어려울 거야.”');
      }
    } catch (e) {
      /* givePlant는 setGrowth 성공 뒤에만 화분을 만들므로, 여기서 화분이 없으면 외부 상태도
         커밋되지 않았다. 콩나물·식비·날짜·로그를 함께 되돌려 Day 4를 재시도할 수 있게 한다. */
      if (!pot0(S)) {
        S.firstPlay = before;
        S.log.length = logLengthBefore;
        S.day--;
        e.coreRolledBack = true;
        e.turnState = 'core_rolled_back';
      } else {
        e.turnState = 'unknown';
      }
      throw e;
    }
  }

  /* 몬스테라가 아직 도착하지 않았으면 콩나물만 진행하고 끝낸다. Day 4에 막 도착한 경우도
     그날은 키운 날로 세지 않는다 — 다음 날부터 빛을 받아 3턴 뒤 말린 새순이 된다. */
  if (!p) {
    const arrived = pot0(S);
    const gpNo = arrived ? phaseOf(io, S) : { phase: null, error: null };   // ★ 한 번만
    return { S, turn: {
      day: S.day, sky, report, slot: null, dli: null, check,
      noPlant: !arrived, plantArrived: !!arrived, firstPlayEvent,
      daysPlanted: arrived ? 0 : null,
      growthCalendarDay: arrived ? io.growth.calendarDay() : null,
      effectiveGrowthDays: arrived ? io.growth.growthDays() : null,
      growthPhase: gpNo.phase,
      growthPhaseError: gpNo.error
    } };
  }

  const slot = (report.slots || []).find(s => s.slotId === p.slotId) || null;
  const dli = check.badSlots.has(p.slotId)
    ? null
    : dliFromContract(report, p.slotId, m => pushLog(S, '⚠ ' + m));

  /* ★ 오늘 빛은 **매일 반드시** 넘긴다 — null 도 넘긴다 (2026-08-02).
     예전처럼 `if (dli != null)` 로 건너뛰면 growth 안의 PLANT_DLI 에 어제 값이 남아
     "빛이 없는데 어제 빛으로 자라는" 상태가 된다. 조용히 틀리는 유형이라 호출을 생략하지 않는다. */
  /* ★ 여기서부터는 **코어 혼자 되감을 수 없는** 구간이다 (2026-08-02 정정).
     `advanceTo` 안에서 growth 가 `CAL_DAY`·`GROWTH` 를 먼저 올리고 그다음 `buildPlant()` 를 부른다.
     렌더에서 터지면 **growth 는 이미 하루 간 상태로 예외만 나온다.** 그때 코어가 날짜를 되감으면
     오히려 두 쪽이 어긋난다(코어 N일 / growth N+1일).
     그래서 되감기 전에 **growth 에게 어디까지 갔는지 물어본다.**
     ⚠ 코어는 growth 내부 상태를 복원하지 못한다 — 그건 growth 소유다.
       `buildPlant()` 를 렌더 경계로 감싸 달라고 요청해 뒀다(core-to-growth). */
  const calBefore = io.growth.calendarDay();
  let step;
  let lightInputRecorded = false;
  try {
    io.growth.setDailyLight(dli);
    lightInputRecorded = true;

    /* ★ 하루 진행은 advanceTo 만 쓴다. setGrowth(점프)는 도착 때 한 번뿐이다.
       달력은 하루 가고, 형태(유효 생장)는 빛이 될 때만 쌓인다 — 저광이면 여기서 멈춘다. */
    step = io.growth.advanceTo(calBefore + 1);
  } catch (e) {
    let calAfter = null;
    try { calAfter = io.growth.calendarDay(); } catch { /* 계약까지 끊긴 경우 */ }

    if (calAfter === calBefore) {
      S.day--;
      e.coreRolledBack = true;
      e.turnState = lightInputRecorded ? 'growth_input_recorded' : 'core_rolled_back';
      if (lightInputRecorded) {
        S.desync = { coreDay: S.day, growthCalendar: calAfter, reason: e.message,
                     note: '달력은 되감았지만 오늘 DLI 입력은 growth 이력에 남았을 수 있음' };
      }
    } else if (calAfter === calBefore + 1) {
      /* growth 는 갔는데 예외만 나왔다(렌더 오류 등). 되감지 않는다 — 날짜는 맞춰 두고,
         이 턴의 결과(형태·정지 사유)를 못 받았다는 사실을 상태에 남긴다. */
      S.desync = { coreDay: S.day, growthCalendar: calAfter, reason: e.message };
      pushLog(S, `⚠ 이 턴의 결과를 못 받았습니다 — growth 달력 ${calAfter}, 코어 ${S.day}일. ` +
                 `날짜는 맞췄지만 형태 결과는 화면에 반영되지 않았습니다`);
      e.coreRolledBack = false;
      e.turnState = 'growth_advanced';
    } else {
      /* null·역행·2일 이상 점프는 진행 여부를 확정할 근거가 없다. 거짓으로 되감거나
         "날짜를 맞췄다"고 하지 않고 잠근 뒤 불확정 상태를 그대로 남긴다. */
      S.desync = { coreDay: S.day, growthCalendar: calAfter, reason: e.message,
                   note: 'growth 달력을 확인할 수 없거나 예상한 하루 범위를 벗어남' };
      e.coreRolledBack = false;
      e.turnState = 'unknown';
    }
    throw e;
  }
  p.daysPlanted++;                                   // 플레이어가 돌본 날 (형태와 별개 축)

  /* ★ null 을 0으로 바꾸지 않는다 (2026-08-02).
     0은 "쟀더니 암흑"이고 null 은 "못 쟀다"다. 0으로 넣으면 평균이 아래로 끌려가
     계약 누락이 '어두운 날'로 둔갑한다 — 날짜 자리는 지키되 값은 null 로 남긴다.
     평균·문턱 판정은 아래 avg()·weekOverPct() 가 null 을 걸러서 본다. */
  S.dliHist.push(dli);
  S.ledger.electricityWon += (report.energy && report.energy.won) || 0;   // 표시만. 차감 없음

  const phaseAfter = phaseOf(io, S);          // ★ 한 번만 읽는다
  const turn = {
    day: S.day, sky, report, slot, dli,
    check,
    daysPlanted: p.daysPlanted,
    /* ★ 실제 growth 상태 — 빈 값으로 숨기지 않는다 */
    growthCalendarDay: step ? step.calDay : io.growth.calendarDay(),
    effectiveGrowthDays: step ? step.growth : io.growth.growthDays(),
    grew: step ? step.grew : null,
    growthBlocked: step ? step.blocked : io.growth.growthBlocked(),
    growthAge: io.growth.ageOf ? io.growth.ageOf(step ? step.growth : 0) : null,
    dli7Growth: io.growth.dli7(),      // growth가 실제로 쓴 7일 평균
    dli7Core: avg(S.dliHist, 7),       // 코어가 센 값 — 둘이 어긋나면 배선이 틀린 것
    sample: sample(S.dliHist, 7),      // 표본 상태(결측 며칠인지) — 평균만 보면 못 판단한다
    cv: io.growth.dliCV(),
    /* growth 렌더 신호 — 논리 진행과 화면을 가른 뒤로 이게 유일한 "그림이 살아있나" 창구다.
       옛 growth 는 안 내므로 undefined 다(= 정보 없음, 실패 아님). */
    drawn: step ? step.drawn : undefined,
    drawError: step ? (step.drawError ?? null) : null,
    hudError: step ? (step.hudError ?? null) : null,
    growthPhase: phaseAfter.phase,
    growthPhaseError: phaseAfter.error,
    firstPlayEvent
  };

  /* ★ 순서가 계약이다 (2026-08-02 정정).
     ① 그림이 죽었으면 **단계를 반영하기 전에** 멈춘다 — 안 그러면 화면엔 아무 변화가 없는데
        completed=true 가 되어 "말린 새순을 봤다"가 거짓이 된다.
     ② 단계를 못 읽었으면 그것도 fail-loud — 조용히 경계를 건너뛰지 않는다.
     둘 다 논리 진행(달력·유효 생장·이력·돌본 날)은 이미 기록했고 되감지 않는다. */
  if (turn.drawn === false) {
    S.desync = { coreDay: S.day, growthCalendar: turn.growthCalendarDay,
                 reason: turn.drawError || '3D 그리기 실패',
                 note: '논리 진행은 양쪽 모두 하루 갔다. 화면의 식물만 낡았다' };
    pushLog(S, `⛔ 화면을 다시 그리지 못했습니다 — ${turn.drawError || '사유 미상'} ` +
               `(유효 ${turn.effectiveGrowthDays}일까지 진행은 됐습니다)`);
    const err = new Error(`[생장] 3D 를 다시 그리지 못했습니다 — ${turn.drawError || '사유 미상'}. ` +
                          `하루는 진행됐고 화면만 낡았습니다`);
    err.turnState = 'growth_advanced';
    err.coreRolledBack = false;
    err.turn = turn;
    throw err;
  }
  if (turn.growthPhaseError) {
    S.desync = { coreDay: S.day, growthCalendar: turn.growthCalendarDay,
                 reason: turn.growthPhaseError,
                 note: '하루는 진행됐지만 단계를 읽지 못해 경계를 확인할 수 없다' };
    pushLog(S, `⛔ 단계를 읽지 못했습니다 — ${turn.growthPhaseError} (하루 진행은 됐습니다)`);
    const err = new Error(`[생장] 단계를 읽지 못했습니다 — ${turn.growthPhaseError}. ` +
                          `하루는 진행됐고 말린 새순 경계를 확인하지 못했습니다`);
    err.turnState = 'growth_advanced';
    err.coreRolledBack = false;
    err.turn = turn;
    throw err;
  }
  if (S.firstPlay && S.firstPlay.enabled && turn.growthPhase) markMonsteraPhase(S.firstPlay, turn.growthPhase);

  /* ★ HUD 실패는 3D 실패와 등급이 다르다 — 형태는 그려졌고 growth 쪽 숫자판만 죽은 것이라 경고만 한다. */
  if (turn.hudError) {
    console.warn(`[생장] growth HUD 갱신 실패(3D 는 그려짐) — ${turn.hudError}`);
    pushLog(S, `⚠ growth HUD 갱신 실패 — ${turn.hudError} (형태는 그려졌습니다)`);
  }
  /* 정지 사유는 바뀔 때만 남긴다 — 매일 찍으면 기록이 같은 줄로 덮인다 */
  if (turn.growthBlocked !== S._lastBlock) {
    if (turn.growthBlocked) pushLog(S, `⏸ 형태 정지 — ${turn.growthBlocked}`);
    else if (S._lastBlock !== undefined) pushLog(S, `▶ 다시 자랍니다 (유효 진행 ${turn.effectiveGrowthDays}일)`);
    S._lastBlock = turn.growthBlocked;
  }

  return { S, turn };
}

export function runDays(S, io, n, onTurn) {
  const turns = [];
  for (let i = 0; i < n; i++) {
    const { turn } = nextDay(S, io);
    turns.push(turn);
    if (onTurn) onTurn(turn);
  }
  return { S, turns };
}

/* ---------------------------------------------------------------
   검수 지표
--------------------------------------------------------------- */
/* ============================================================
   ★ 이동평균의 정본 의미 — **"최근 n개의 유효 관측값"** (2026-08-02 통일)
   ------------------------------------------------------------
   달력 n일 창이 **아니다.** 못 잰 날(null)은 자리를 차지하지 않고, 그 전 유효값이 계속 쓰인다.
   growth 의 `dliAvg` 와 같은 뜻이다 — growth 도 유효한 값만 `DLI_HIST` 에 쌓고 마지막 n개로 낸다.
   0으로 메우면 계약 누락이 '암흑'이 되어 판정이 아래로 끌린다.

   화면에서 이렇게 보인다:
     하루선   결측일에서 **끊긴다**   (못 잰 날은 그릴 값이 없다)
     평균선   결측일에도 **이어진다** (직전 유효 n개로 낸 값이 그날의 판정값이다)

   ★ 코어 안에서 이 창을 다시 짜지 않는다. loop·HUD 그래프·fenDayOf 가 전부 이 두 함수를 쓴다.
============================================================ */

/* 각 날짜 시점의 판정값(그날 growth 가 봤을 dliAvg(n))을 하루씩 되짚어 낸다. */
export function rollingAvg(hist, n = 7) {
  const out = [], v = [];
  for (const x of hist || []) {
    if (typeof x === 'number' && isFinite(x)) { v.push(x); if (v.length > n) v.shift(); }
    out.push(v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
  }
  return out;
}

/* 지금 시점의 판정값 = rollingAvg 의 마지막 값 */
export function avg(arr, n) {
  const r = rollingAvg(arr, n);
  return r.length ? r[r.length - 1] : null;
}

/* 표본 상태까지 같이 낸다 — 화면이 "평균 2.9"만 보여주면 그게 7일치인지 2일치인지 모른다. */
export function sample(arr, n = 7) {
  const win = (arr || []).slice(-n);
  const valid = win.filter(x => typeof x === 'number' && isFinite(x));
  return { avg: avg(arr, n), days: win.length, valid: valid.length,
           missing: win.length - valid.length, complete: win.length === n && valid.length === n };
}

/* ★ 되돌릴 수 없는 사건(갈라짐·무늬 발현·잎 손실)은 평균으로 보면 안 된다.
   "몇 %의 주가 문턱을 넘나"가 맞는 지표다 — 최고주는 오래 굴리면 항상 peak라 무의미하다.
   여기서는 실제로 굴린 며칠의 롤링 주를 센다(표본이 작으니 아래 expectedWeekPct 와 같이 본다). */
export function weekOverPct(hist, over, win = 7) {
  if (over == null || !hist || hist.length < win) return null;
  let n = 0, hit = 0, skipped = 0;
  for (let i = 0; i + win <= hist.length; i++) {
    const w = hist.slice(i, i + win);
    /* ★ 결측이 낀 주는 세지 않는다 — 0으로 메우면 "안 넘은 주"가 되어 비율이 낮게 나오고,
       빼고 세면 표본이 준다. 어느 쪽이든 **몇 주를 뺐는지 같이 낸다.** */
    if (w.some(x => typeof x !== 'number' || !isFinite(x))) { skipped++; continue; }
    n++; if (w.reduce((a, b) => a + b, 0) / win >= over) hit++;
  }
  return n ? { pct: +(hit / n * 100).toFixed(1), weeks: n, skipped } : { pct: null, weeks: 0, skipped };
}

/* 20년치 기대 분포 — house의 measured.fenWeekPct 와 같은 방식으로 낸다.
   판정 단위는 '계절별' 7일 평균이다. 연평균으로 자르면 결론이 뒤집힌다
   (data/balance/weather.json · judgement_unit). */
export function expectedWeekStats(S, io, { season = 'summer', over = null, years = 20 } = {}) {
  const p = pot0(S);
  if (!p || !p.slotId) return { mean: null, p10: null, p50: null, p90: null, weeks: 0, overPct: null };
  const dliOf = (weather, s) => io.light.dliOfSlot(p.slotId, {
    weather, season: s, lampCount: S.lamps.count, litHours: S.lamps.litHours
  });
  const st = weekStats(dliOf, { season, over, years, seed: S.sim.seed });

  /* ★ 평균은 코어가 다시 낸다. (2026-08-01 현재도 유효)
     weekStats.mean 은 `맑은날값 × E[날씨계수]` 라 dliOf 가 날씨에 선형일 때만 맞다.
     식물등 DLI는 날씨와 무관해서 같이 깎인다 — 등 1개에서 mean 7.14 < p10 8.46 이 나왔다.

     house가 경고와 rolledMean 을 추가했고 "등은 weekStats 밖에서 더하라"고 처방했는데,
     ★ 그 처방은 mean 에만 통한다. p10/p50/p90 과 overPct(문턱 넘는 주)는
     **등을 포함한 하루 값**으로 세야 맞다 — 자연광만 넘기면 "등을 켜도 안 갈라진다"가 된다.
     그래서 dliOf 는 등 포함으로 넘기고, mean 만 여기서 확률 가중으로 정확히 낸다.
     (weekStats 안에서 Σ p_w·dliOf(w) 로 내면 둘 다 해결된다 — core-to-house 에 적었다) */
  const pw = WEATHER_P[season] || WEATHER_P.summer;
  let mean = 0;
  for (const w of ['clear', 'cloudy', 'rain']) mean += (pw[w] || 0) * dliOf(w, season);
  return { ...st, mean: +mean.toFixed(3), meanEngine: st.mean };
}
