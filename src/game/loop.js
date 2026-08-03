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
  FIRST_PLAY_COMPLETE_PHASE_ID,
  firstPlayEventsOf,
  firstPlayNextEvent,
  firstPlaySnapshot,
  markMonsteraArrived,
  markMonsteraPhase,
  slotFitsDiameter
} from './first_play.js';
import { canMoveOut, createTutorialState, LEARNING, tutorialDay, noteLearning } from './tutorial.js';
import { dliFromContract } from './growth_adapter.js';
import { headroomCheck, PLANT_POT_D_REF } from './headroom.js';
import { rehomeCuttings, stepCuttings } from './propagation.js';
import { weekStats, WEATHER_P } from '../engine/weather.js';

/* ============================================================
   ★ 단계 스키마 검증 (2026-08-02 신설)
   ------------------------------------------------------------
   예전엔 `growthPhase()` 가 **무엇을 돌려주든** 그대로 실어 보냈다. 던질 때만 막았다.
   그래서 `null` 을 돌려주면 아무도 안 막고 Day 4 수확·도착이 그대로 확정된 다음,
   `markMonsteraPhase` 가 `!phase` 에서 조용히 no-op 해서
   **monstera.growthPhase === null · completed === false** 인 회차가 남았다 —
   "말린 새순을 못 봤다"가 아니라 **"봤는지 아무도 모른다"** 가 된다.
   화면에도 '단계 정보 없음'만 뜨고 오류는 어디에도 없다. 그 유형을 여기서 끊는다.

   ★ 무엇을 **안** 보는가 — `phaseId` 가 **무슨 값인지는 보지 않는다.**
     단계 이름·개수·순서·경계는 growth 소유다(plant_grow.html `phaseAt`).
     코어가 허용 목록을 들면 growth 가 단계를 하나 늘리는 순간 **오류 없이 틀린 판정**이 난다 —
     first_play.js 의 phaseKo 주석과 똑같은 이유다. 여기서 보는 건 **모양뿐**이다.
     `phaseKo`·`nextPhaseId` 도 안 본다: 옛 growth 는 안 내고(=정보 없음),
     markMonsteraPhase 가 키로 대체한다. 없다고 진행을 무를 값이 아니다.

   보는 것은 세 가지 — 이게 없으면 **읽었다고 말할 수 없는** 최소치다.
     ① 단계 객체인가            (null·배열·문자열·숫자 전부 실패)
     ② phaseId 가 빈 문자열이 아닌 문자열인가   (완료 판정의 열쇠)
     ③ progress01 이 0..1 안의 유한한 숫자인가  (게이지·"형태가 올랐나" 판정의 축)
============================================================ */
function showVal(v) {
  if (typeof v === 'string') return `"${v}"`;
  if (v === null || v === undefined || typeof v === 'number' ||
      typeof v === 'boolean' || typeof v === 'bigint') return String(v);
  if (Array.isArray(v)) return '배열';
  return typeof v === 'function' ? '함수' : Object.prototype.toString.call(v);
}

/* 모양이 맞으면 null, 틀리면 **사람이 읽을 수 있는 사유**를 돌려준다.
   사유에 실제 값을 넣는다 — "스키마 위반"만 뜨면 growth 쪽에서 뭘 고칠지 모른다. */
export function phaseSchemaError(phase) {
  if (phase === null || typeof phase !== 'object' || Array.isArray(phase))
    return `growthPhase() 가 단계 객체를 내지 않았습니다 — ${showVal(phase)}`;
  if (typeof phase.phaseId !== 'string' || phase.phaseId.trim() === '')
    return `growthPhase().phaseId 가 비어 있지 않은 문자열이 아닙니다 — ${showVal(phase.phaseId)}`;
  if (typeof phase.progress01 !== 'number' || !Number.isFinite(phase.progress01))
    return `growthPhase().progress01 이 유한한 숫자가 아닙니다 — ${showVal(phase.progress01)}`;
  if (phase.progress01 < 0 || phase.progress01 > 1)
    return `growthPhase().progress01 이 0..1 밖입니다 — ${phase.progress01}`;
  return null;
}

/* 단계 표시를 읽는 유일한 창구. **표시 계약**이라 실패해도 진행을 무르지 않는다 —
   다만 조용히 null 로 숨기지 않고 사유를 같이 낸다(호출부가 라벨을 띄운다).
   growth 가 phaseKo 를 안 내는 옛 버전이면 markMonsteraPhase 가 키를 그대로 쓴다.

   ★ 던진 예외와 **모양이 틀린 반환값**을 같은 등급으로 다룬다 (2026-08-02).
     호출부는 `error` 만 보면 된다 — "던졌나 / 이상한 걸 돌려줬나"를 나눠 물을 필요가 없다. */
export function phaseOf(io, S) {
  if (!io.growth || typeof io.growth.growthPhase !== 'function')
    return { phase: null, error: null };            // 계약 자체가 없는 경우는 '정보 없음'
  let phase;
  try { phase = io.growth.growthPhase(); }
  catch (e) { return { phase: null, error: e.message }; }
  const bad = phaseSchemaError(phase);
  /* ★ 모양이 틀리면 값을 **버린다.** 반쪽짜리 단계를 실어 보내면 markMonsteraPhase 가
     phaseId 만 보고 완료를 찍거나, UI 가 NaN% 게이지를 그린다 — 둘 다 조용히 틀린다. */
  return bad ? { phase: null, error: bad } : { phase, error: null };
}

/* ══ 반지하 튜토리얼 (2026-08-03) ═══════════════════════════════════════
   첫 플레이가 끝난 뒤부터 원룸 이사까지. 규칙은 tutorial.js 가 갖고, 여기서는
   **턴 결과를 그 규칙에 넘겨주기만** 한다 — 코어가 살림 규칙을 또 갖지 않게.
   ★조용히 실패하지 않는다. 튜토가 터져도 하루는 이미 갔으므로 turn 에 실어 보낸다. */
/* "자라기 시작하는 최소 빛". 코어가 숫자를 갖지 않는다 — 임계값 정본은 growth·house 소유다. */
function minDliOf(io) {
  try {
    const t = io.light && io.light.thresholdsOf ? io.light.thresholdsOf() : null;
    if (t && typeof t.min === 'number') return t.min;
  } catch { /* 정본을 못 읽으면 판정을 안 한다 — 지어낸 값으로 배웠다고 하면 안 된다 */ }
  return null;
}
/* ══ 머리공간 정지 (2026-08-03 신설) ══════════════════════════════════
   ★ 박사님 확정: "단수가 낮은 곳에서는 어느 크기 되면 더이상 안자라게 해서,
     위가 뚫린 방바닥이나 단수 높이가 큰 곳으로 가거나 해야 자라도록 하자.
     그리고 그게 싫으면 삽수를 하는 형태로."

   규칙과 기하는 headroom.js 가 갖는다(docs/headroom.md 가 정본). 여기서는
   **오늘 진행을 걸지 말지만** 정한다 — 루프가 기하를 또 갖지 않게.

   ★ 빛 부족 정지와 **다른 사유**다. 섞으면 처방이 정반대가 된다 —
     빛 부족은 "등을 켜라", 머리공간은 "자리를 옮기거나 삽수를 해라".
     그래서 turn 에도 따로 실린다(growthBlocked ≠ headroomBlocked).
   ★ 못 재면 막지 않는다. 정적 프로파일 경로(room_profile)에는 방 치수·차폐체가 없다 —
     근거 없이 멈추면 아무도 못 고치는 진행 불가가 된다(headroom.blockedBy known:false). */
function headroomOfTurn(S, io, p) {
  if (!p || !p.at) return null;                       // 좌표를 모르는 옛 화분은 판정하지 않는다
  const room = (io.light && io.light.room) || null;
  if (!room) return null;
  /* 화분 지름은 자리 한도 안에서 정해진다 — room_view 의 `min(MONSTERA_POT_D, 자리한도)` 와 같다.
     지름이 작아지면 그루 전체가 같이 작아지므로 머리공간 판정도 같이 느슨해져야 한다. */
  const slot = (room.slots || []).find(s => s.slotId === p.slotId);
  const lim = slot && Number.isFinite(slot.maxPotD) ? slot.maxPotD : PLANT_POT_D_REF;
  try {
    return headroomCheck(p.at, io.growth.growthDays(), {
      size: room.size,
      occluders: (room.built && room.built.occluders) || [],
      slots: room.slots || [],
      potD: Math.min(PLANT_POT_D_REF, lim)
    });
  } catch (e) {
    pushLog(S, '⚠ 머리공간을 재지 못했습니다 — ' + e.message);
    return null;
  }
}

/* ══ 삽수 (2026-08-03) ═════════════════════════════════════════════════
   규칙과 수치는 propagation.js 가 갖는다(docs/propagation.md 가 정본). 여기서는
   **하루를 한 번 넘겨주기만** 한다 — 루프가 번식 규칙을 또 갖지 않게.
   ★ 삽수는 growth 를 안 쓴다. 형태 계약(setDailyLight·advanceTo)을 타지 않으므로
     생장 창이 죽어 있어도 삽수는 정상으로 돈다 — 그게 맞다(뿌리내림은 빛과 무관).
   ★조용히 실패하지 않는다. 삽수가 터져도 하루는 이미 갔으므로 turn 에 실어 보낸다. */
function stepCuttingsOfTurn(S) {
  if (!S.cuttings || !S.cuttings.length) return null;
  try {
    return stepCuttings(S, { log: m => pushLog(S, m) });
  } catch (e) {
    pushLog(S, '⚠ 삽수 진행 실패 — ' + e.message);
    return { error: e.message, events: [], died: [], warnings: [] };
  }
}

/* ══ 서사 신호 (2026-08-03 신설) ═══════════════════════════════════════
   ★왜 여기인가 — 살림 신호(월세·계절·식물등)는 tutorial.js 가, 첫 플레이 신호는
     first_play.js 가 이미 낸다. 남은 셋은 **둘 다 알아야 나오는 것**이라 여기가 유일한 자리다:
       ① 배움 넷이 하나씩 처음 켜지는 순간   (튜토 상태 × 그날 턴)
       ② 형태가 며칠째 멈췄나 · 다시 오르나   (growth 가 낸 blocked × 날수)
       ③ 이사 조건 두 축 중 무엇이 모자란가   (돈 × 배움)

   ★상태를 거의 안 늘린다. 늘린 것은 `_`로 시작하는 두 칸뿐이고 **세이브에 안 남는다**
     (save.js 의 packTutorial 이 화이트리스트다). 다시 켜면 대사 이력도 같이 비므로
     한 번 더 나오는 것이 자연스럽고, 어긋나지 않는다. */

/* 며칠 멈춰 있어야 말을 거나. 하루 멈췄다고 말하면 흐린 날마다 잔소리가 된다 —
   7일 이동평균이라 저광 전환 뒤 사흘은 관성으로 더 자란다(STATUS growth 판단필요). */
const STALL_DAYS = 4;
/* ★한 번 짚고 끝내지 않는다 (진단에서 나온 것) — 어두운 자리에 방치한 판은
   Day 8 에 한 번 말하고 그 뒤 190일이 통째로 조용했다. 열흘마다 다시 짚는다.
   대신 대사는 갈린다(plantStalled → plantStalledAgain) — 같은 말을 반복하지 않는다. */
const STALL_REPEAT_DAYS = 10;

function narrativeEvents(S, turn, ts, learnedBefore, day) {
  const ev = [];
  const season = day && day.season ? day.season : null;

  /* ① 배움 — 처음 켜진 것만. 넷을 한 줄씩 짚어 주면 체크리스트가 화면 밖에서도 산다. */
  for (const k of Object.keys(ts.learned))
    if (ts.learned[k] && !learnedBefore[k])
      ev.push({ id: 'learn_' + k, ko: (LEARNING[k] || {}).ko || k, key: k });

  /* ② 형태 정지 — ★"자리를 옮겨라"가 아니라 "며칠째 그대로다"를 낸다.
     정답 자리를 코어가 알면 방이 바뀔 때 조용히 틀린다(first_play.js markMonsteraPhase 주석). */
  if (S.pots.length) {
    const blocked = !!turn.growthBlocked;
    const run = blocked ? (S._stallDays || 0) + 1 : 0;
    S._stallDays = run;
    if (run === STALL_DAYS || (run > STALL_DAYS && (run - STALL_DAYS) % STALL_REPEAT_DAYS === 0)) {
      ts._stallCount = (ts._stallCount || 0) + 1;
      /* ★겨울은 자리 탓만이 아니다 — 같은 "멈춤"이라도 짚는 말이 달라야 한다.
         겨울에 "옮겨 보자"만 하면 옮길 데가 없는 플레이어를 몰아세우는 말이 된다. */
      const id = season === 'winter' ? 'plant_stalled_winter'
               : ts._stallCount > 1 ? 'plant_stalled_again'
               : 'plant_stalled';
      ev.push({ id, ko: `${run}일째 형태가 그대로입니다`, days: run, season });
    }
    /* 다시 오르기 시작한 순간 — 멈춰 본 적이 있어야 의미가 있다 */
    if (!blocked && ts._stalledOnce && !ts._resumedNoted) {
      ts._resumedNoted = true;
      ev.push({ id: 'plant_resumed', ko: '다시 자랍니다' });
    }
    if (run >= STALL_DAYS) { ts._stalledOnce = true; ts._resumedNoted = false; }
  }

  /* ③ 이사 두 축 — ★모자란 쪽이 바뀔 때만 말한다. 매일 말하면 잔소리다. */
  const c = canMoveOut(ts);
  const state = ts.movedOut ? 'done'
              : c.ok ? 'ready'
              : c.learningLeft.length === 0 ? 'money'
              : c.money ? 'learn' : null;      // null = 둘 다 멀었다. 아직 할 말이 없다
  if (state && state !== ts._moveState) {
    ts._moveState = state;
    if (state === 'money') ev.push({ id: 'move_short_money', ko: '이사 자금이 모자랍니다', shortWon: c.shortWon });
    if (state === 'learn') ev.push({ id: 'move_short_learn', ko: '아직 안 해 본 것이 있습니다', left: c.learningLeft });
    if (state === 'ready') ev.push({ id: 'move_ready', ko: '원룸으로 이사할 수 있습니다' });
  } else if (state) ts._moveState = state;

  return ev;
}

function stepTutorial(S, turn, io) {
  const ts = S.tutorial;
  if (!ts || !ts.enabled) return null;
  const fp = S.firstPlay;
  try {
    /* 배운 것부터 적는다 — 이사 판정이 이 값을 본다 */
    const learnedBefore = { ...ts.learned };
    const ev = turn.firstPlayEvent || {};
    noteLearning(ts, {
      harvested: !!ev.harvested,
      foodSavedWon: ev.foodSavedWon,
      cropAvgDli: fp && fp.beansprout ? fp.beansprout.avgDli : null,
      /* ★자리 이름이 아니라 DLI 로 본다. 다른 방·다른 슬롯에서도 성립해야 한다.
         growth 가 실제로 쓴 7일평균을 먼저 본다 — 코어가 센 값과 어긋나면 배선이 틀린 것이라
         판정은 growth 쪽을 따르는 게 맞다(둘 다 없으면 코어 이력으로 뒤늦게라도 센다). */
      plantDli7: turn.dli7Growth != null ? turn.dli7Growth : rollingAvg(S.dliHist, 7),
      plantMinDli: minDliOf(io),
      spearFurled: !!(fp && fp.completed)
    });
    const r = tutorialDay(ts, {
      firstPlayDone: !!(fp && fp.completed),
      mealsUsed: (ev && ev.mealsUsed) || 0
    });
    if (r && r.events) for (const e of r.events) pushLog(S, '📅 ' + e.ko);
    /* ★서사 신호는 살림이 돈 **뒤에** 낸다 — 계절·돈이 오늘 값이어야 판정이 맞다 */
    if (r) r.storyEvents = narrativeEvents(S, turn, ts, learnedBefore, r);
    return r;
  } catch (e) {
    pushLog(S, '⚠ 튜토리얼 진행 실패 — ' + e.message);
    return { error: e.message };
  }
}

/* ══ turn.events — 이 턴에 난 일 **한 목록** (2026-08-03 신설) ═══════════
   ★왜 필요한가 — 세 곳이 각자 신호를 내고 있었다(first_play · tutorial · 위 서사).
     화면은 그중 첫 플레이 셋만 읽고 있어서, 월세도 가을도 식물등도 **아무도 말을 안 했다**
     (진단: 반지하 43일 연속 무음). 대사를 붙이려면 먼저 목록이 하나여야 한다.

   ★코어는 대사를 모른다. 여기서 내는 것은 **사건 목록**뿐이고,
     그것을 무슨 말로 옮길지는 `dialogue.scriptsForEvents` 가 정한다. */
function attachEvents(S, turn, fpBefore) {
  const out = [];
  const push = list => { for (const e of list || []) if (e && e.id) out.push(e); };
  push(firstPlayEventsOf(fpBefore, S.firstPlay));
  const t = turn.tutorial;
  if (t && !t.error) { push(t.events); push(t.storyEvents); }
  turn.events = out;
  return turn;
}

export function nextDay(S, io) {
  const p = pot0(S);
  /* ★첫 플레이 신호는 **앞뒤 스냅샷의 차이**로 낸다(first_play.js 주석 참고).
     하루가 시작하기 전에 한 장 떠 둔다 — 되감기(catch)로 무른 턴은 아래 attachEvents
     자체가 안 불리므로 유령 이벤트가 안 남는다. */
  const fpBefore = firstPlaySnapshot(S.firstPlay);

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

  /* 방을 바꿨거나 가구가 사라졌으면 화분을 회수한다(5-4).
     ★ 방(room)까지 넘긴다 — 자유 좌표 화분은 슬롯 목록으로 판단할 수 없다.
       "받치던 가구가 사라졌나 · 그 좌표가 지금 방 밖인가"를 봐야 한다(state.rehomePot).
       옛 세이브(slotId 만)의 좌표 채우기도 여기서 같이 일어난다. */
  if (p) rehomePot(S, io.light.room.slots, m => pushLog(S, m), io.light.room);
  /* 삽수도 같은 검사를 받는다 — 안 하면 방을 옮긴 뒤 삽수가 방 밖 좌표로 남아
     매일 계약이 던지거나 화면에 없는데 상태에는 사는 유령이 된다. */
  if (S.cuttings && S.cuttings.length) rehomeCuttings(S, io.light.room, m => pushLog(S, '🔧 ' + m));

  const { report, sky, check } = io.light.daily(S.day, S);
  if (!check.ok) pushLog(S, '⚠ 계약 이상 — ' + check.problems.slice(0, 3).join(' / '));

  /* 첫 4일은 열린 시루 하나만 돈다. 몬스테라 엔진과 섞지 않고, 시루가 놓인 방 슬롯의
     DLI를 그대로 모아 4일째 3/2/1끼를 판정한다. 계약 누락은 암흑으로 보완하지 않는다. */
  let firstPlayEvent = null;
  let arrivalPhase = null;          // Day 4 도착 때 **검증까지 마친** 단계. 아래서 다시 읽지 않는다
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
        /* ★ 도착에서는 **'정보 없음'도 실패다** (2026-08-02 추가) — 일일 루프와 등급이 다르다.
           일일 루프의 단계는 표시용이라 없어도 하루는 간다. 도착은 아니다:
           단계 없이 열면 monstera.growthPhase 가 null 로 굳고, 그 뒤 markMonsteraPhase 가
           매번 조용히 no-op 해서 **completed 가 영영 false** 인 개체가 남는다.
           첫 플레이가 증명하려는 게 딱 그 경계라, 근거 없이 문을 열지 않는다. */
        const gp = phaseOf(io, S);
        const gpError = gp.error ||
          (gp.phase ? null : 'growth 가 growthPhase() 를 내지 않습니다 — 단계 계약이 없습니다');
        if (gpError) {
          S.pots.length = 0;                    // 되돌리기 전에 방금 만든 화분을 거둔다
          const err = new Error(`[첫 플레이] 도착한 몬스테라의 단계를 읽지 못했습니다 — ${gpError}`);
          /* ★ growth 쪽은 **코어가 못 되감는다** (2026-08-02 명시).
             givePlant 안의 setGrowth(143) 은 이미 적용됐고 3D 도 그려진 뒤다 — 되돌릴 창구가 없다.
             그래서 "다 되돌렸다"고 말하지 않고 잔여물을 표시로 남긴다(아래 catch 가 로그로 낸다).
             ⚠ 그래도 **잠그지는 않는다**: setGrowth 는 절대값 점프라 Day 4 를 다시 밟으면
               setGrowth(143) 이 같은 자리에 다시 꽂혀 두 쪽이 맞는다. 재시도가 정답인 상태다. */
          err.growthJumpApplied = arrived.arrivalGrowthDays;
          throw err;
        }
        /* ★ 화분을 통째로 넘긴다 (2026-08-03) — slotId 만 넘기면 좌표가 사본에서 빠진다.
           정본은 화분(arrived.slotId · arrived.at)이고 fp.monstera 는 그걸 베낀 사본이다. */
        markMonsteraArrived(S.firstPlay, arrived);
        markMonsteraPhase(S.firstPlay, gp.phase);
        arrivalPhase = gp.phase;
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
        /* ★ 되감은 것은 **코어뿐**이다 — growth 는 이미 점프한 뒤일 수 있다.
           로그를 자른 **뒤에** 남긴다(먼저 남기면 위 truncate 에 같이 잘린다).
           숨기면 "Day 3 · 화분 없음"인데 옆 창엔 다 자란 몬스테라가 서 있는 화면이 된다. */
        if (e.growthJumpApplied != null)
          pushLog(S, `⚠ 코어는 Day ${S.day} 로 되돌렸지만 growth 는 이미 유효 ` +
                     `${e.growthJumpApplied}일로 점프한 뒤입니다 — 옆 창의 몬스테라는 남아 있습니다. ` +
                     `[다음 날]을 다시 누르면 같은 값으로 다시 맞춰집니다`);
      } else {
        e.turnState = 'unknown';
      }
      throw e;
    }
  }

  /* ★ 삽수는 **여기서 한 번** 돈다 (2026-08-03). 반환구가 둘(도착 전/후)로 갈리기 전이라
     양쪽이 같은 하루를 받는다 — stepTutorial 을 한쪽에만 붙였다가 "수확했는데 안 배웠다"가
     났던 것과 같은 함정을 여기서는 처음부터 피한다.
     ★ 위 첫 플레이 되감기(catch)는 이 줄 **위에서** 끝난다 — 되감긴 턴은 삽수도 안 돈다. */
  const cuttings = stepCuttingsOfTurn(S);

  /* 몬스테라가 아직 도착하지 않았으면 콩나물만 진행하고 끝낸다. Day 4에 막 도착한 경우도
     그날은 키운 날로 세지 않는다 — 다음 날부터 빛을 받아 3턴 뒤 말린 새순이 된다. */
  if (!p) {
    const arrived = pot0(S);
    /* ★ 단계를 **다시 읽지 않는다** (2026-08-02 정정).
       여기 오는 개체는 방금 위 도착 블록이 만든 것뿐이고, 거기서 이미 읽고 검증했다.
       한 턴에 두 번 읽으면 두 답이 다를 수 있는데, 두 번째 실패는 이미 확정된 도착을
       되돌리지 못해 `growthPhaseError` 필드로만 조용히 남는다 — 아무도 안 막는 실패가 된다.
       도착이 없으면 단계도 없다(null = 정보 없음, 실패 아님). */
    const earlyTurn = {
      day: S.day, sky, report, slot: null, dli: null, check,
      noPlant: !arrived, plantArrived: !!arrived, firstPlayEvent,
      daysPlanted: arrived ? 0 : null,
      growthCalendarDay: arrived ? io.growth.calendarDay() : null,
      effectiveGrowthDays: arrived ? io.growth.growthDays() : null,
      growthPhase: arrivalPhase,
      growthPhaseError: null,
      cuttings
    };
    /* ★이 경로도 튜토리얼을 돌려야 한다 (2026-08-03).
       몬스테라가 오기 전(그리고 도착하는 그 날)은 여기서 일찍 반환된다 —
       **수확이 있는 Day 4 가 바로 이 경로**다. 마지막 반환에만 붙였더니
       "수확했는데 배웠다고 안 적히는" 회차가 났다. 하루에 반환구가 둘이면
       둘 다 챙겨야 한다. */
    earlyTurn.tutorial = stepTutorial(S, earlyTurn, io);
    return { S, turn: attachEvents(S, earlyTurn, fpBefore) };
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
  /* ★ 머리공간 — advanceTo 를 부르기 **전에** 본다 (2026-08-03).
     오늘 키가 이미 그 자리 천장을 채웠으면 형태를 하루도 더 안 올린다. 죽지는 않는다. */
  const headroom = headroomOfTurn(S, io, p);
  const headBlocked = !!(headroom && headroom.blocked);

  const calBefore = io.growth.calendarDay();
  let step;
  let lightInputRecorded = false;
  try {
    /* ★ 빛은 막혔어도 넘긴다 — DLI 이력은 사실이어야 한다. 안 넘기면 growth 의 7일평균이
       코어와 갈라지고, 자리를 옮긴 뒤 "왜 아직 안 자라지"가 된다. */
    io.growth.setDailyLight(dli);
    lightInputRecorded = true;

    /* ★ 하루 진행은 advanceTo 만 쓴다. setGrowth(점프)는 도착 때 한 번뿐이다.
       달력은 하루 가고, 형태(유효 생장)는 빛이 될 때만 쌓인다 — 저광이면 여기서 멈춘다.
       ★ 머리공간이 막혔으면 **아예 안 부른다.** 유효 생장일이 안 오르는 것이 이 규칙의 전부다. */
    if (!headBlocked) step = io.growth.advanceTo(calBefore + 1);
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
    grew: headBlocked ? false : (step ? step.grew : null),
    growthBlocked: step ? step.blocked : io.growth.growthBlocked(),
    /* ★ 머리공간 정지 — 빛 부족(growthBlocked)과 **다른 칸**이다. 한 칸에 섞으면
       화면이 "빛이 모자랍니다"라고 말하고 플레이어는 등을 하나 더 산다(정반대 처방). */
    headroom,
    headroomBlocked: headBlocked ? headroom.reason : null,
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
    firstPlayEvent,
    cuttings
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
  /* ★ 머리공간 정지·경고도 **바뀔 때만** 남긴다. 문구에 '빛'이라는 말을 넣지 않는다 —
     플레이어가 처방을 헷갈리면 이 규칙은 그냥 "안 자라는 버그"가 된다. */
  const headMsg = turn.headroomBlocked || (turn.headroom && turn.headroom.warn ? turn.headroom.reason : null);
  if (headMsg !== S._lastHeadBlock) {
    if (headMsg) pushLog(S, `📏 ${headMsg}`);
    else if (S._lastHeadBlock !== undefined && S._lastHeadBlock !== null)
      pushLog(S, `▶ 위가 트였습니다 — 다시 자랍니다 (유효 진행 ${turn.effectiveGrowthDays}일)`);
    S._lastHeadBlock = headMsg;
  }
  /* 정지 사유는 바뀔 때만 남긴다 — 매일 찍으면 기록이 같은 줄로 덮인다 */
  if (turn.growthBlocked !== S._lastBlock) {
    if (turn.growthBlocked) pushLog(S, `⏸ 형태 정지 — ${turn.growthBlocked}`);
    else if (S._lastBlock !== undefined) pushLog(S, `▶ 다시 자랍니다 (유효 진행 ${turn.effectiveGrowthDays}일)`);
    S._lastBlock = turn.growthBlocked;
  }

  turn.tutorial = stepTutorial(S, turn, io);
  return { S, turn: attachEvents(S, turn, fpBefore) };
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

/* ============================================================
   ★ 빨리감기 · 이벤트 점핑 (2026-08-03 신설)
   ------------------------------------------------------------
   박사님 확정(2026-08-03):
     "약간 빠른 진행으로 빨리감기 형태로 해서, 집 전경으로 봐도 식물이 쪼끔 자라는 게 보이고"
     "점점 자라는 모습을 보여주면서 점핑하게 해주면 될 것 같은데"

   ★★ 순간이동이 아니다. **하루씩 진짜로 돈다.**
     `nextDay` 를 msPerDay 간격으로 반복해서 부를 뿐이고, 지름길은 **하나도 없다** —
     계약 검증 · setDailyLight(null 포함) · advanceTo 를 전부 그대로 지난다.
     그래서 어두운 자리에 둔 채 감으면 **날짜만 가고 형태는 그대로**다. 그게 이 게임의 핵심이라
     빨리감기에서 깨지면 안 된다(docs/first_play.md — "자리가 결과를 바꾼다").
     식물 게임에서 자라는 장면 자체가 볼 것이므로, 건너뛰어서 그걸 없애지 않는다.

   ★ 이 파일은 여전히 UI를 모른다.
     그리는 것은 `onDay(turn, info)` 를 받은 쪽 몫이다. document·window·DOM 을 안 쓴다.
     타이머조차 갈아 끼울 수 있게 열어 뒀다(opt.timers) — 헤드리스 재현이 실제 시간을 안 기다린다.

   ★ 이벤트 정지 목록은 docs/time_modes.md §이벤트 정지 목록이고,
     신호는 **first_play.js 가 이미 내던 것**을 쓴다(firstPlayEventsOf). 새 체계를 만들지 않았다.
     형태 단계 전환만 여기서 본다 — 그건 first_play 상태가 아니라 growth 가 낸 turn.growthPhase 다.

   ⚠ 정지 목록에 **`growthBlocked`(빛 부족)는 넣지 않았다.** 의도적이다.
     time_modes.md 는 "밴드가 나빠짐"을 정지 사유로 적어 두었지만, 첫 플레이에서 그러면
     **어두운 자리에 두자마자 첫 턴에 멈춘다** — "며칠이 지나도 안 자란다"를 볼 수가 없다.
     배속 모드의 처방(§"정지 대신 알림")대로 **알림으로만** 낸다: onDay 의 info.blocked 로 매일 나가고,
     정지가 필요하면 호출부가 `stopOnBlock:true` 로 켠다(기본 꺼짐).
============================================================ */

/* 한 번에 갈 수 있는 최대 일수. 이벤트가 영영 안 오는 경우(어두운 자리)에도 반드시 선다. */
export const JUMP_MAX_DAYS = 60;
/* ★ 튜토 이후에는 이벤트 점핑이 없다(time_modes.md §"점핑은 튜토 전용으로 잠근다").
   배속은 남지만 **한 번에 이만큼까지**다 — 상한이 없으면 배속이 사실상 점핑이 된다. */
export const FAST_MODE_MAX_DAYS = 30;
export const DEFAULT_MS_PER_DAY = 120;

/* ★ 시간 모드는 상태에서 유도한다. 호출부가 고를 수 있게 두면 잠금이 아니다.
     jump  반지하 튜토리얼 진행 중 — 이벤트까지 점핑할 수 있다
     fast  그 외(튜토 완료·본편) — 배속만. 박사님 확정: "초보 이후부터는 스킵은 없어" */
export function timeModeOf(S) {
  const fp = S && S.firstPlay;
  return (fp && fp.enabled && !fp.completed) ? 'jump' : 'fast';
}

/* 다음에 멈출 이벤트가 무엇인지 미리 — 버튼 문구용. 튜토가 아니면 null(점핑 자체가 없다). */
export function nextEventPreview(S) {
  const fp = S && S.firstPlay;
  if (!fp || !fp.enabled) return null;
  return firstPlayNextEvent(fp);
}

const STOP_KO = {
  event: '이벤트 도달',
  maxDays: '한도 도달',
  stopped: '중단',
  error: '오류',
  drawError: '그리기 실패',
  hudError: 'HUD 실패',
  desync: '어긋남',
  callbackError: '화면 갱신 중 오류',
  blocked: '형태 정지'
};

/* ★ 한 번에 하나만 돈다. 모듈 단일 상태인 이유는 계약이 `stopFastForward()` 라서다 —
   핸들을 안 들고도 멈출 수 있어야 페이지 이탈·오류에서 유령 턴이 안 남는다. */
let RUN = null;

export function isFastForwarding() { return !!RUN; }

/* 사용자가 중단. 돌고 있지 않으면 아무 일도 안 하고 false 를 낸다(두 번 눌러도 안전). */
export function stopFastForward(reason = 'stopped') {
  if (!RUN) return false;
  RUN.finish(reason, {});
  return true;
}

export function startFastForward(S, io, opt = {}) {
  if (RUN) throw new Error('[빨리감기] 이미 돌고 있습니다 — 먼저 멈춰 주세요');

  const mode = timeModeOf(S);
  const untilEvent = opt.untilEvent === undefined ? (mode === 'jump') : !!opt.untilEvent;

  /* ④ 튜토 전용 잠금 — 조용히 false 로 낮추지 않는다. 낮추면 호출부는 점핑한 줄 안다. */
  if (untilEvent && mode !== 'jump')
    throw new Error('[빨리감기] 이벤트 점핑은 반지하 튜토리얼 전용입니다 — ' +
                    '이후에는 배속만 됩니다(maxDays 를 정해 주세요)');

  let maxDays = opt.maxDays;
  if (mode === 'jump') {
    maxDays = Number.isFinite(maxDays) ? Math.min(Math.floor(maxDays), JUMP_MAX_DAYS) : JUMP_MAX_DAYS;
  } else {
    if (!Number.isFinite(maxDays))
      throw new Error('[빨리감기] 배속에는 maxDays 가 필요합니다 — 무한 진행은 없습니다');
    maxDays = Math.floor(maxDays);
    if (maxDays > FAST_MODE_MAX_DAYS)
      throw new Error(`[빨리감기] 배속은 한 번에 ${FAST_MODE_MAX_DAYS}일까지입니다 — ${maxDays}일은 점핑입니다`);
  }
  if (maxDays < 1) throw new Error('[빨리감기] maxDays 는 1 이상이어야 합니다');

  /* 시작하기 전에 막을 수 있는 입력 실수는 여기서 막는다 — 첫 턴에 예외로 터지면
     "빨리감기를 눌렀는데 오류만 떴다"가 된다. 고쳐서 다시 누를 수 있는 안내다. */
  const fp = S.firstPlay;
  if (fp && fp.enabled && !fp.beansprout.harvested && !fp.beansprout.slotId) {
    const e = new Error('[빨리감기] 열린 시루를 먼저 방 안에 놓아 주세요');
    e.firstPlayInput = true;
    throw e;
  }

  const msPerDay = Number.isFinite(opt.msPerDay) ? Math.max(0, opt.msPerDay) : DEFAULT_MS_PER_DAY;
  /* 타이머 주입구. 기본은 전역이고, 재현에서는 가짜 시계를 넣어 **실제 시간을 안 기다린다**.
     ★ 여기서 window 를 뒤지지 않는다 — 이 파일은 UI를 모른다(맨 위 주석). */
  const timers = opt.timers || {
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (id) => clearTimeout(id)
  };
  const stopOnBlock = !!opt.stopOnBlock;
  const onDay = typeof opt.onDay === 'function' ? opt.onDay : null;
  const onStop = typeof opt.onStop === 'function' ? opt.onStop : null;

  const startDay = S.day;
  const run = {
    mode, untilEvent, maxDays, msPerDay, stopOnBlock,
    days: 0, timerId: null, done: false,
    lastPhaseId: (fp && fp.monstera && fp.monstera.growthPhase)
      ? fp.monstera.growthPhase.phaseId : null,
    lastBlocked: S._lastBlock === undefined ? null : S._lastBlock,
    finish
  };

  /* ⑤ 타이머는 **여기 한 곳에서만** 만들고 지운다. 여러 곳에서 만들면 반드시 하나가 남는다. */
  function schedule() {
    if (run.done) return;
    run.timerId = timers.setTimeout(tick, msPerDay);
  }
  function clear() {
    if (run.timerId == null) return;
    const id = run.timerId;
    run.timerId = null;
    try { timers.clearTimeout(id); } catch { /* 시계가 이미 사라졌으면 남길 것도 없다 */ }
  }

  /* 정확히 한 번만 끝난다. RUN 을 먼저 비우므로 onStop 안에서 다시 시작해도 안전하다. */
  function finish(reason, info) {
    if (run.done) return;
    run.done = true;
    clear();
    if (RUN === run) RUN = null;
    pushLog(S, `⏩ 빨리감기 종료 — ${STOP_KO[reason] || reason} · ${run.days}일 진행 ` +
               `(Day ${startDay} → ${S.day})`);
    if (onStop) {
      /* ★ onStop 이 던져도 타이머는 이미 지웠다. 여기서 삼키지 않으면 호출부의 UI 오류가
         빨리감기 정리 실패로 번진다 — 로그로 남기고 넘어간다. */
      try { onStop(reason, { ...info, reason, days: run.days, day: S.day, startDay, mode }); }
      catch (e) { console.error('[빨리감기] onStop 처리 중 오류', e); }
    }
  }

  function tick() {
    run.timerId = null;
    if (run.done) return;

    const fpBefore = firstPlaySnapshot(S.firstPlay);
    const desyncBefore = S.desync;

    /* ★ 지름길 없음 — 평소 [다음 날] 과 **같은 함수**다. */
    let turn;
    try { turn = nextDay(S, io).turn; }
    catch (e) { finish('error', { error: e, turn: e.turn || null }); return; }
    run.days++;

    /* ── 이벤트 수집 ─────────────────────────────────────────── */
    const events = firstPlayEventsOf(fpBefore, S.firstPlay);
    const phaseId = turn.growthPhase ? turn.growthPhase.phaseId : null;
    if (phaseId && run.lastPhaseId && phaseId !== run.lastPhaseId &&
        !events.some(e => e.id === FIRST_PLAY_COMPLETE_PHASE_ID))
      events.push({ id: 'phase_change', ko: `형태 단계 전환 — ${turn.growthPhase.phaseKo || phaseId}`,
                    phaseId, fromPhaseId: run.lastPhaseId });
    if (phaseId) run.lastPhaseId = phaseId;

    const blockedNow = turn.growthBlocked === undefined ? null : turn.growthBlocked;
    const blockWorsened = !run.lastBlocked && !!blockedNow;
    run.lastBlocked = blockedNow;

    /* ── 화면 갱신 — 하루하루 그려야 "자라는 게 보인다" ────────── */
    if (onDay) {
      try {
        onDay(turn, { day: S.day, index: run.days, days: run.days, maxDays,
                      mode, events, blocked: blockedNow, blockWorsened });
      } catch (e) { finish('callbackError', { error: e, turn }); return; }
    }

    /* ── ③ 사고는 즉시 정지. 조용히 계속 돌지 않는다 ──────────── */
    if (turn.hudError) { finish('hudError', { turn, error: new Error(turn.hudError), events }); return; }
    if (turn.drawError) { finish('drawError', { turn, error: new Error(turn.drawError), events }); return; }
    if (S.desync && S.desync !== desyncBefore) { finish('desync', { turn, events }); return; }

    /* ── ② 이벤트에서 멈춘다(점핑일 때만. 배속은 알림으로 지난다) ── */
    if (untilEvent && events.length) { finish('event', { turn, events }); return; }
    if (stopOnBlock && blockWorsened) { finish('blocked', { turn, events }); return; }
    if (run.days >= maxDays) { finish('maxDays', { turn, events }); return; }

    schedule();
  }

  const preview = nextEventPreview(S);
  RUN = run;
  pushLog(S, `⏩ 빨리감기 시작 — ${mode === 'jump' ? '이벤트까지' : '배속'} · ` +
             `최대 ${maxDays}일 · ${msPerDay}ms/일` +
             (untilEvent && preview ? ` · 다음: ${preview.ko}` : ''));
  schedule();

  /* 핸들도 돌려준다 — 계약(stopFastForward)만으로도 되지만, 시작 직후 무엇이 정해졌는지
     호출부가 버튼 문구에 그대로 쓸 수 있어야 한다. */
  return { mode, untilEvent, maxDays, msPerDay, preview, stop: () => stopFastForward('stopped') };
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
  /* ★ 자유 좌표 화분은 slotId 만으로 못 찾는다(방 슬롯 목록에 없는 이름이다).
     그럴 때는 화분 자체를 넘긴다 — 조도 포트가 `at` 을 보고 그 좌표로 계산한다. */
  const dliOf = (weather, s) => io.light.dliOfSlot(p.at ? p : p.slotId, {
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
