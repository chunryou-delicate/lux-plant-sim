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
  beansproutHarvestStatus,
  beansproutReady,
  beansproutWaterStatus,
  harvestBeansprout,
  waterBeansprout,
  eatFromPantry,
  cropDliFromReport,
  cropKindOf,
  cropSites,
  FIRST_PLAY_ASSETS,
  FIRST_PLAY_COMPLETE_PHASE_ID,
  firstPlayEventsOf,
  firstPlayNextEvent,
  firstPlaySnapshot,
  markMonsteraArrived,
  markMonsteraPhase,
  monsteraArrivalDue,
  slotFitsDiameter
} from './first_play.js';
import { canMoveOut, createTutorialState, LEARNING, tutorialDay, noteLearning,
         stepVarieGrant } from './tutorial.js';
import { dliFromContract } from './growth_adapter.js';
import { headroomCheck, PLANT_POT_D_REF } from './headroom.js';
import { rehomeCuttings, stepCuttings, cuttableNow } from './propagation.js';
import { stepShop } from './shop.js';
import { weekStats, WEATHER_P } from '../engine/weather.js';
import { judgeDLI } from '../engine/daily_light.js';

/* ══ 걷는 속도 — 밝기가 「품질」만이 아니라 「속도」도 정한다 (2026-08-05 박사님 확정) ══
   ------------------------------------------------------------------------------
   그 전까지 밝기는 **켜짐/꺼짐 두 값**이었다. 7일평균이 min(3.0) 위면 달력 하루가 그대로
   생장 하루였고 아래면 0 이었다. 그래서 DLI 3.77 과 12.0 이 **둘 다 잎당 72일**이었고,
   식물등 25,000원이 사는 것은 잔액 −25,000원뿐이었다(test_balance_routes ①-1).

   ★★ 전역 생장 곡선은 **한 글자도 안 건드린다.**
     plant_grow.html 의 `GROWTH +1` · 143 · 146 · `spawnStep` · `matSpan` · `timeCurve` 는 정본이고
     첫 플레이 재현이 거기 걸려 있다. 여기서 바꾸는 것은 **그 곡선 위를 걷는 속도**뿐이다 —
     "달력 하루가 생장일 몇 일어치인가". 곡선은 그대로 두고 걷는 사람만 빨라진다.

   ★ 왜 이 자리인가
     ① `advanceTo(달력+1)` 를 부르는 곳이 여기 하나뿐이다. 다른 자리에서 속도를 걸면
        누가 하루를 늘렸는지 코어 밖에서는 못 읽는다.
     ② `setDailyLight` → `S.dliHist.push` 가 여기서 **1:1** 로 쌓인다. 그 짝이 곧
        세이브 재생(save.restoreGrowth)의 입력이라, 여기서 늘리면 재생도 같이 늘어난다.

   ★★★ 왜 **빠르게** 하고 느리게 하지 않았나 — 이게 이 설계의 핵심이고, 되돌리기 쉬운 자리다.
     처음엔 반대로 만들었다: `best` 를 1.0 에 두고 `slow` 를 0.7 로 내려 **어두우면 하루를 거른다.**
     실측에서 두 가지가 깨졌다.
       ① **세이브가 안 맞는다.** `save.restoreGrowth` 는 `dliHist` 를 한 칸당 `advanceTo` 한 번으로
          되밟는다(save.js §growth). 코어가 하루를 걸러도 재생은 안 거르므로,
          **저장 53일 → 복원 57일** 이 된다(test_save H). 거르는 쪽은 코어가 삼킨 하루를
          이력에 남길 방법이 없다 — 늘리는 쪽은 `setDailyLight` 를 한 번 더 부르는 것이
          곧 이력 한 칸이라 **재생이 저절로 같아진다.**
       ② **A 경로(등 없이)가 죽는다.** slow 0.7 로 반지하 창턱(=slow 밴드)을 늦추면
          이사 성공률이 78% → 21% 로 떨어진다(test_banjiha_routes G-2b). 창턱이 곧 첫 플레이
          자리라 튜토 전체가 같이 느려진다. story_arc §2 가 A 를 "표준"이라 부르는 한 이건 못 쓴다.
     그래서 **기준선을 slow 에 둔다** — 지금까지의 속도가 곧 "겨우 자라는 속도"였다고 읽고,
     밝은 자리에서 그보다 빨라지게 한다. A 는 한 걸음도 안 바뀌고 B 만 빨라진다.

   ★ 그래서 계수는 **1.0 이 바닥**이다. 1 아래 값은 안 받는다(`source:'unsupported'` 로 알린다) —
     받으려면 save.js 의 재생도 같은 규칙을 알아야 하고, 그 파일은 이 창 소유가 아니다.
   ⚠ 알려진 흠 — 빠른 날은 `dliHist` 가 하루에 두 칸 쌓여서 `hist.length !== daysPlanted` 가 된다.
     `save.restoreGrowth` 는 그걸 "중간에 깨진 턴"으로 읽고 경고를 한 줄 남긴다. 재생 자체는
     정확하다(칸마다 하루씩 되밟으므로). 그 한 줄은 save.js 소유라 여기서 못 고친다 —
     docs/handoff/growthspeed-to-plan.md 에 넘겨 뒀다.

   ★ 숫자는 여기 없다. 정본은 `data/growth_tuning.json` 의 `growth_speed.by_band` 다.
     못 읽으면 **1.0(=예전 그대로)** 으로 돈다. 조용히 다른 밸런스로 굴리지 않으려고
     그 사실을 `turn.growthSpeed.source` 에 실어 보낸다(화면·검사가 읽는다).

   ★ 밴드는 **베끼지 않는다.** 경계 판정은 조도 정본인 `judgeDLI`(engine/daily_light.js)를 그대로 쓴다.
     plant_grow 의 `bandOf` 와 같은 표라야 하고(그쪽 주석도 그렇게 적혀 있다),
     `tools/test_growth_speed.mjs` 가 두 함수의 답이 같은지 매번 확인한다.
     ⚠ `io.growth.bandOf` 를 안 쓰는 이유 — 헤드리스 하네스들이 그 창구를 안 낸다.
       있으면 쓰고 없으면 딴 길로 가면, **게임과 검사가 서로 다른 규칙으로 도는** 상태가 된다.
============================================================================== */
let GROWTH_SPEED = null;
try {
  const m = await import('../../data/growth_tuning.json', { with: { type: 'json' } });
  GROWTH_SPEED = (m && m.default && m.default.growth_speed) || null;
} catch { GROWTH_SPEED = null; }     // file:// · 옛 런타임 — 1.0 으로 돈다(아래 source 로 알린다)

/* 하루에 걸을 수 있는 생장일의 천장. 곡선을 두 배 넘게 건너뛰면 그건 '속도'가 아니라
   '다른 곡선'이다 — 성숙 굴림·잎 건강도 그만큼 몰아서 돈다. 늘리기 전에 반드시 재 볼 것. */
export const GROWTH_STEPS_MAX = 2;

/* 오늘의 걷는 속도. **판정만** 한다 — 상태를 안 건드린다(검사가 이 함수만 따로 부를 수 있게).
   dli7 은 growth 가 실제로 쓴 7일 평균이다. 오늘 값이 아니라 평균을 보는 이유는
   정지 판정(growthBlockReason)·갈라짐(calcMatureProb)이 전부 7일 평균을 보기 때문이다 —
   축이 둘이면 "왜 오늘은 자랐는데 갈라지진 않지"가 설명이 안 된다.

   source 는 **왜 그 값이 됐는가**다. 조용히 1.0 으로 돌아가는 경우를 화면·검사가 구분해야 한다.
     tuning      정본 표에서 읽었다
     default     표가 없거나(못 읽음) 그 밴드에 값이 없다 — 예전 그대로 돈다
     unknown     빛·임계값을 못 읽었다 — 모르는 것으로 벌하지 않는다
     unsupported 표에 1 미만이 적혀 있다. 세이브 재생이 못 따라오므로 안 받는다(위 §왜 빠르게) */
export function growthSpeedOf(dli7, th) {
  const table = GROWTH_SPEED && GROWTH_SPEED.by_band;
  if (!table) return { band: null, mult: 1, source: 'default' };
  if (!th || typeof dli7 !== 'number' || !isFinite(dli7))
    return { band: null, mult: 1, source: 'unknown' };
  const band = judgeDLI(dli7, th).band;
  const m = table[band];
  if (typeof m !== 'number' || !isFinite(m)) return { band, mult: 1, source: 'default' };
  if (m < 1) return { band, mult: 1, source: 'unsupported' };
  return { band, mult: Math.min(m, GROWTH_STEPS_MAX), source: 'tuning' };
}

/* 오늘 몇 걸음인가. 소수점은 `S._growthCredit` 에 쌓아 두고 1 이 모이는 날 한 걸음 더 간다.
   ⚠ `_` 로 시작한다 = **세이브에 안 남는다**(save.js 화이트리스트와 같은 규칙).
     다시 켜면 0 부터 모으므로 최대 한 걸음이 늦어질 뿐 어긋나지는 않는다. */
function growthStepsOf(S, mult) {
  const credit = (S._growthCredit || 0) + mult;
  const steps = Math.min(GROWTH_STEPS_MAX, Math.floor(credit + 1e-9));
  S._growthCredit = credit - steps;
  return Math.max(1, steps);         // 자랄 수 있는 날은 최소 한 걸음. 코어는 하루를 삼키지 않는다
}

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
/* ★ 삽수 자리의 빛 — **판정은 코어가 안 한다** (2026-08-04 삽수 생장).
   그 자리 DLI 는 조도 계약이 갖고, "그 빛이면 자라나"는 growth 의 밴드가 갖는다.
   코어는 둘을 이어 주기만 한다. 밴드 이름을 코어가 베끼면 growth 가 문턱을 바꾸는 날
   **오류 없이 틀린 판정**이 된다(삽수만 조용히 안 자란다).
   ⚠ 못 재면 `null` 을 낸다 — 0 으로도 "자란다"로도 메꾸지 않는다. 모르면 안 자란다. */
const NO_GROW_BANDS = new Set(['critical', 'poor', 'stagnant']);
function cuttingLightOf(S, io, report) {
  return (c) => {
    const key = c.at ? c : c.slotId;
    if (!key) return null;                       // 자리가 없는 삽수 — 빛을 잴 데가 없다
    let dli = null;
    try {
      dli = c.at && io.light && typeof io.light.dliOfSlot === 'function'
        ? io.light.dliOfSlot(c, {})
        : dliFromContract(report, c.slotId);
    } catch { return null; }
    if (typeof dli !== 'number' || !isFinite(dli)) return null;
    let band = null;
    try { const b = io.growth && io.growth.bandOf ? io.growth.bandOf(dli, !!c.variegated) : null;
          band = b && b.band; } catch { band = null; }
    if (!band) return null;                      // growth 가 밴드를 못 내면 판정하지 않는다
    return { dli, band, grows: !NO_GROW_BANDS.has(band) };
  };
}

function stepCuttingsOfTurn(S, io, report) {
  if (!S.cuttings || !S.cuttings.length) return null;
  try {
    return stepCuttings(S, { log: m => pushLog(S, m),
                             lightOf: report ? cuttingLightOf(S, io, report) : null });
  } catch (e) {
    pushLog(S, '⚠ 삽수 진행 실패 — ' + e.message);
    return { error: e.message, events: [], died: [], warnings: [] };
  }
}

/* ★ 튜토 확정 무늬 — 하루에 한 번 (2026-08-03). 규칙은 tutorial.js 가 갖는다.
   여기서는 **growth 가 낸 값을 그대로 넘겨주기만** 한다 — 루프가 무늬 규칙을 또 갖지 않게.
   ⚠ growth 가 접근자를 안 내면(옛 plant_grow · sim.nullGrowth) 아무것도 안 한다.
     코어가 마디를 지어내면 그 순간 "실제 자란 것을 자른다"가 거짓이 된다. */
function stepVarieGrantOfTurn(S, io) {
  const ts = S.tutorial;
  if (!ts || !ts.enabled || ts.movedOut) return null;
  let nodes = null, stats = null;
  try {
    if (io.growth && typeof io.growth.cuttableNodes === 'function') nodes = io.growth.cuttableNodes();
    if (io.growth && typeof io.growth.leafStats === 'function') stats = io.growth.leafStats();
  } catch (e) {
    pushLog(S, '⚠ 마디·잎 집계를 읽지 못했습니다 — ' + e.message);
    return { error: e.message };
  }
  try {
    /* ★ **지금 실제로 자를 수 있는 마디**에만 붙인다. growth 목록에는 이미 잘라낸 자리도
       그대로 남아 있어서(propagation.js §유한성), 안 거르면 못 자르는 마디에 무늬가 붙어
       "무늬는 났는데 팔 수가 없는" 막다른 길이 생긴다. */
    /* ★ **지금 모주에 실제로 달려 있는** 마디에만 붙인다(cuttableNow 가 총량으로 거른다).
       "지금 자를 수 있나"까지는 안 본다 — 잎이 한 장뿐이라 초보 규칙(모주가 끝나는 자르기)에
       막히는 개체도 있는데, 그 경우에도 **그루째 팔면 같은 값**이다(잎1·v=1 = 732,000원).
       여기서 더 좁히면 잎 두 장짜리 도착 개체가 통째로 막다른 길이 된다(재현에서 실제로 그랬다). */
    const usable = nodes ? cuttableNow(S, nodes) : null;
    const r = stepVarieGrant(S, { nodes: usable, stats });
    if (r.granted) {
      pushLog(S, `✨ 새 잎 한 장이 무늬로 나왔습니다 — ${r.nodeId} (잘라서 뿌리내리면 팔 수 있습니다)`);
      r.events = [{ id: 'varie_granted', ko: '무늬 잎이 나왔습니다', nodeId: r.nodeId }];
    }
    return r;
  } catch (e) {
    pushLog(S, '⚠ 확정 무늬 판정 실패 — ' + e.message);
    return { error: e.message };
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

/* 방금 처음 켜진 배움만 사건으로 — ★두 곳이 쓴다 (2026-08-04).
   턴 안(narrativeEvents)과 **턴 밖**(harvestCrop)이다. 수확이 손 동작이 되면서
   배움 ①·②가 턴 밖에서 켜지게 됐는데, 그때 사건을 안 내면 화면은 아무 말도 안 한다. */
function learnEventsOf(ts, before) {
  const out = [];
  if (!ts || !ts.enabled || !before) return out;
  for (const k of Object.keys(ts.learned))
    if (ts.learned[k] && !before[k])
      out.push({ id: 'learn_' + k, ko: (LEARNING[k] || {}).ko || k, key: k });
  return out;
}

function narrativeEvents(S, turn, ts, learnedBefore, day) {
  const ev = [];
  const season = day && day.season ? day.season : null;

  /* ① 배움 — 처음 켜진 것만. 넷을 한 줄씩 짚어 주면 체크리스트가 화면 밖에서도 산다. */
  ev.push(...learnEventsOf(ts, learnedBefore));

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
      /* ★ 배움 ①·② (수확·어두운 자리)는 **여기서 안 켜진다** (2026-08-04).
         수확이 손 동작이 되면서 그 둘의 증거가 턴 밖에서 난다 — `harvestCrop` 이 켠다.
         여기서도 켜려고 `harvested: fp.beansprout.harvested` 같은 것을 쓰면, 거둔 그 날에
         바로 다시 심은 판(avgDli 가 null 로 초기화된다)에서 배움이 통째로 사라진다.
         증거가 나는 그 자리에서 켜는 것이 유일하게 안 새는 배선이다. */
      foodSavedWon: ev.foodSavedWon,
      /* ★자리 이름이 아니라 DLI 로 본다. 다른 방·다른 슬롯에서도 성립해야 한다.
         growth 가 실제로 쓴 7일평균을 먼저 본다 — 코어가 센 값과 어긋나면 배선이 틀린 것이라
         판정은 growth 쪽을 따르는 게 맞다(둘 다 없으면 코어 이력으로 뒤늦게라도 센다). */
      plantDli7: turn.dli7Growth != null ? turn.dli7Growth : rollingAvg(S.dliHist, 7),
      plantMinDli: minDliOf(io),
      spearFurled: !!(fp && fp.completed)
    });
    const r = tutorialDay(ts, {
      firstPlayDone: !!(fp && fp.completed),
      /* ★ 절감은 **원**으로 넘긴다 (2026-08-04). 예전에는 끼니를 넘기고 살림이 2,500원을
         곱했는데, 한 회전 절감이 3,000원이라 끼니 단위로 안 떨어진다(first_play.js §작물 종류).
         두 단위가 섞이면 반올림이 어디서 나는지 아무도 모른다 — 값의 정본은 원 하나다. */
      savedWon: (ev && ev.foodSavedWon) || 0
    });
    if (r && r.events) for (const e of r.events) pushLog(S, '📅 ' + e.ko);
    /* ★확정 무늬는 **배움·돈이 오늘 값이 된 뒤에** 본다 — 조건 ②·④가 오늘 값이라야 맞다 */
    const vg = stepVarieGrantOfTurn(S, io);
    turn.varieGrant = vg;
    if (r && vg && vg.events) r.events = [...(r.events || []), ...vg.events];
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
  /* 상점 도착도 사건이다 — 안 실으면 "시켰는데 왔는지 아무도 말 안 하는" 날이 생긴다 */
  if (turn.shop) push(turn.shop.events);
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

  /* ★★ 2026-08-04 새 규칙 — 물은 **회전 시작**이라 하루 진행이 "오늘 줬나"를 안 본다
     (first_play.js §물주기). 물을 준 시루는 그날부터 `startedOnDay` 를 갖고, 하루는
     **시작한 시루만** 나이를 먹인다. 그래서 예전의 `cropWatered` 계산이 통째로 사라졌다.
     표시용으로만 남긴다 — 화면이 "오늘 시작한 시루가 있나"를 읽는다. */
  const cropWatered = !!(S.firstPlay && S.firstPlay.enabled && S.firstPlay.beansprout &&
                         (S.firstPlay.beansprout.pots || [])
                           .some(p => p && p.startedOnDay === S.day));

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
  /* ★ 상점 배송 — **날짜를 올린 뒤에** 받는다. 그래야 "하루 뒤 도착"이 다음 날 아침이 된다.
     조도·생장보다 먼저 두는 이유는 그날 도착한 씨앗을 그날 심을 수 있어야 하기 때문이다. */
  const shop = stepShop(S, { log: m => pushLog(S, m) });

  let firstPlayEvent = null;
  /* ★ 2026-08-04 — **여기서 거두지 않는다.** 하루가 하는 일은 "자라게 하는 것"까지고,
     거두는 것은 `harvestCrop(S, io)`(=[수확하기] 버튼)이다(first_play.js §수확).
     그래서 몬스테라 선물도 이 블록에서 사라졌다 — 선물은 수확에 붙어 있고, 수확이 옮겨 갔다. */
  /* ★★ 시루가 여럿이 되면서 조건이 바뀌었다 (2026-08-04) — 예전 `!beansprout.harvested` 는
     "하나라도 거뒀나"라서, 시차 판에서 **첫 시루를 거두는 순간 나머지가 통째로 멈췄다.**
     이제 조건은 자리를 정했나 하나뿐이고, 어느 시루가 오늘 자라는지는 안에서 가른다. */
  if (S.firstPlay && S.firstPlay.enabled && S.firstPlay.beansprout.slotId) {
    const before = structuredClone(S.firstPlay);
    const logLengthBefore = S.log.length;
    try {
      /* ★★ 2026-08-05 — 작물 자리가 **종류마다 하나**라 DLI 도 자리마다 따로 잰다
         (first_play §작물 자리 — 콩나물은 어두워야 하고 무순은 밝아야 해서 한 자리에 못 선다).
         ⚠ 안 놓은 자리는 빼고 넘긴다. 표에 없는 열쇠를 넘기면 advance 가 던진다. */
      const cropDli = {};
      for (const site of cropSites(S.firstPlay)) {
        if (!site.slotId) continue;
        if (check.badSlots && check.badSlots.has(site.slotId))
          throw new Error(`[첫 플레이] ${cropKindOf(site.kind || 'beansprout').ko} 자리 ` +
                          `${site.slotId}의 조도 계약이 잘못됐습니다`);
        cropDli[site.kind || 'beansprout'] = cropDliFromReport(report, site.slotId);
      }
      firstPlayEvent = advanceBeansproutDay(S.firstPlay, cropDli);

      /* ★★ 마른 날 알림이 사라졌다 (2026-08-04 새 규칙). 그 개념 자체가 없다 —
         물을 안 준 시루는 **아직 시작을 안 한 것**이지 벌을 받는 것이 아니다.
         그래도 잊은 플레이어가 영영 멈춰 있으면 안 되므로 **바뀔 때 한 번** 알린다:
         자라는 시루가 하나도 없는데 대기만 있는 날 = "아무 일도 안 나는 날"이다.
         매일 찍지 않는다(형태 정지·머리공간과 같은 처리다). */
      const stalled = firstPlayEvent.idle > 0 && firstPlayEvent.grew === 0 &&
                      !firstPlayEvent.ready;
      if (stalled !== S._lastCropStall) {
        if (stalled)
          pushLog(S, `💧 물을 줘야 콩나물이 자라기 시작합니다 — 시루 ${firstPlayEvent.idle}개가 ` +
                     `기다리고 있습니다 (물을 준 날이 0일차입니다)`);
        S._lastCropStall = stalled;
      }

      /* ★ 다 자란 날은 **바뀔 때만** 남긴다. 안 거두면 이 상태가 며칠이고 이어지는데
         매일 찍으면 기록이 그 줄로 덮인다. 안 거둬도 벌은 없다 — 회전이 멈출 뿐이다. */
      if (firstPlayEvent.justReady)
        pushLog(S, `🥬 콩나물 ${firstPlayEvent.justReadyCount}시루를 거둘 때가 됐습니다 — ` +
                   `[수확하기]를 눌러 주세요 (거두기 전에는 그 시루의 다음 회전이 시작되지 않습니다)`);
    } catch (e) {
      /* 콩나물 하루가 터졌으면 날짜·상태를 통째로 되돌려 그날을 다시 밟을 수 있게 한다.
         ★ 이 블록은 이제 growth 를 안 건드린다(선물이 harvestCrop 으로 갔다) — 되돌릴 수 없는
           바깥 상태가 없으므로 되감기가 언제나 완전하다. */
      S.firstPlay = before;
      S.log.length = logLengthBefore;
      S.day--;
      e.coreRolledBack = true;
      e.turnState = 'core_rolled_back';
      throw e;
    }
  }
  /* ★ 밥은 **매일** 먹는다 (2026-08-03 신설 · 2026-08-04 거둔 날까지 포함).
     한 회전 절감(3,000원)을 회전 일수로 고르게 나눠 먹는 것이 "5일 주기로 3,000원"의 모양이다.
     ★ 거둔 날에도 부른다 — 수확이 곳간에 넣고 이 줄이 그날 몫을 꺼낸다. 예전처럼 수확일만
       따로 계산하면 규칙이 둘로 갈린다(그래서 `usedMeals`/`mealsUsed` 이름 어긋남이 났었다).
     ★ 다음 시루가 자라는 중이어도 부른다. 곳간에 남은 것은 그 사이에도 먹는다 —
       이 줄이 위 블록 **안**에 있으면 재파종한 다음 날부터 절감이 통째로 끊긴다. */
  if (S.firstPlay && S.firstPlay.enabled) {
    const ate = eatFromPantry(S.firstPlay);
    firstPlayEvent = firstPlayEvent ? { ...firstPlayEvent, ...ate } : ate;
  }

  /* ★ 삽수는 **여기서 한 번** 돈다 (2026-08-03). 반환구가 둘(도착 전/후)로 갈리기 전이라
     양쪽이 같은 하루를 받는다 — stepTutorial 을 한쪽에만 붙였다가 "수확했는데 안 배웠다"가
     났던 것과 같은 함정을 여기서는 처음부터 피한다.
     ★ 위 첫 플레이 되감기(catch)는 이 줄 **위에서** 끝난다 — 되감긴 턴은 삽수도 안 돈다. */
  const cuttings = stepCuttingsOfTurn(S, io, report);

  /* 몬스테라가 아직 도착하지 않았으면 콩나물만 진행하고 끝낸다.
     ★ 2026-08-04 — 도착은 이제 **턴 안에서 안 일어난다**(harvestCrop 이 준다). 그래서 이 경로에
       화분이 생겨 있는 일이 없다 — `plantArrived` 는 늘 false 다. 칸을 지우지는 않는다:
       화면·재현이 그 이름을 읽고 있고, "이 턴에 도착했나"라는 질문 자체는 여전히 유효하다. */
  if (!p) {
    const earlyTurn = {
      day: S.day, sky, report, slot: null, dli: null, check,
      noPlant: true, plantArrived: false, firstPlayEvent,
      daysPlanted: null,
      growthCalendarDay: null,
      effectiveGrowthDays: null,
      growthPhase: null,
      growthPhaseError: null,
      /* ★ 물주기 (2026-08-04) — 형태 정지(growthBlocked)·머리공간(headroomBlocked)과 **다른 칸**이다.
         셋을 한 칸에 섞으면 처방이 뒤섞인다(등을 켜라 / 자리를 옮겨라 / 물을 줘라).
         ★★ `cropDry`(마른 날)가 **`cropIdle`(시작 대기)로 바뀌었다** — 물이 회전 시작이 되면서
           "빼먹었다"가 아니라 "아직 시작을 안 했다"가 됐다(first_play.js §물주기). */
      cropWatered, cropIdle: (firstPlayEvent && firstPlayEvent.idle) || 0,
      /* ★ 수확 (2026-08-04) — 물주기와 **다른 칸**이다. 같은 칸에 섞으면 화면이
         "물을 주세요"와 "거두세요"를 못 가른다(둘은 서로를 배제한다 — §수확). */
      cropReady: beansproutReady(S.firstPlay),
      cropJustReady: !!(firstPlayEvent && firstPlayEvent.justReady),
      cropHarvest: beansproutHarvestStatus(S.firstPlay),
      cropWater: beansproutWaterStatus(S.firstPlay, S.day),
      cuttings, shop
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
  let speed = { band: null, mult: 1, source: 'default' };
  /* 오늘 growth 에게 실제로 넘긴 하루의 수. **dliHist 에 이만큼 쌓인다** — 그 짝이 세이브 재생의
     입력이라(save.js §growth) 여기서 어긋나면 복원한 형태가 조용히 달라진다. */
  let fedDays = 0;
  try {
    /* ★ 빛은 막혔어도 넘긴다 — DLI 이력은 사실이어야 한다. 안 넘기면 growth 의 7일평균이
       코어와 갈라지고, 자리를 옮긴 뒤 "왜 아직 안 자라지"가 된다. */
    io.growth.setDailyLight(dli);
    lightInputRecorded = true;
    fedDays = 1;

    /* ★ 걷는 속도는 **오늘 빛을 넣은 뒤에** 잰다 — dli7 에 오늘이 들어가야 엔진과 같은 값이 된다 */
    speed = growthSpeedOf(
      typeof io.growth.dli7 === 'function' ? io.growth.dli7() : null,
      io.light && typeof io.light.thresholdsOf === 'function'
        ? io.light.thresholdsOf(p.plantId, p.variegated) : null);

    /* ★ 하루 진행은 advanceTo 만 쓴다. setGrowth(점프)는 도착 때 한 번뿐이다.
       달력은 하루 가고, 형태(유효 생장)는 빛이 될 때만 쌓인다 — 저광이면 여기서 멈춘다.
       ★ 머리공간이 막혔으면 **아예 안 부른다.** 유효 생장일이 안 오르는 것이 이 규칙의 전부다.

       ★★ 밝기 속도 (2026-08-05) — 밝은 자리는 **한 걸음 더 간다**(위 §걷는 속도).
         `advanceTo` 는 하루(delta 1)만 받으므로 "1.5일치"를 한 번에 넘길 방법이 없다.
         그래서 소수점은 적립해 두고, 1 이 모인 날 `setDailyLight` + `advanceTo` 를 **한 벌 더** 돈다.
         한 벌씩 도는 것이 중요하다 — 빛 한 칸에 하루 한 걸음이라야 세이브 재생이 같아진다.
         ⚠ 엔진이 막는 날(빛 부족)은 어차피 형태가 안 오르므로 한 걸음으로 끝난다.
           그 날도 `advanceTo` 는 반드시 부른다 — 안 부르면 `stepLeafHealth` 가 안 돌아
           **어두운 자리에서 잎이 안 바래는** 정반대 결과가 난다. */
    if (!headBlocked) {
      const engineBlocked = !!(typeof io.growth.growthBlocked === 'function' && io.growth.growthBlocked());
      const steps = engineBlocked ? 1 : growthStepsOf(S, speed.mult);
      for (let i = 0; i < steps; i++) {
        if (i > 0) { io.growth.setDailyLight(dli); fedDays++; }   // 한 벌 = 빛 한 칸 + 하루 한 걸음
        step = io.growth.advanceTo(calBefore + i + 1);
      }
    }
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
    } else if (calAfter > calBefore && calAfter <= calBefore + GROWTH_STEPS_MAX) {
      /* growth 는 갔는데 예외만 나왔다(렌더 오류 등). 되감지 않는다 — 날짜는 맞춰 두고,
         이 턴의 결과(형태·정지 사유)를 못 받았다는 사실을 상태에 남긴다.
         ★ 밝은 날은 한 턴에 두 걸음까지 가므로 여기가 `+1` 이 아니라 범위다(§걷는 속도).
           GROWTH_STEPS_MAX 가 1 이면 예전 `calAfter === calBefore + 1` 과 완전히 같다. */
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
  /* ★★ growth 에게 넘긴 만큼 쌓는다 — **1:1 이 계약이다**(save.js §growth).
     밝은 날은 `setDailyLight` 를 두 번 불렀으므로 여기도 두 칸이다. 한 칸만 쌓으면
     복원한 형태가 저장 때보다 덜 자란 채로 선다(그게 처음 설계가 깨진 자리였다). */
  const fedToday = Math.max(1, fedDays);
  for (let i = 0; i < fedToday; i++) S.dliHist.push(dli);
  /* ★★ **먹인 날을 따로 센다** (2026-08-05 · save.js §fedDays).
     `daysPlanted` 는 "플레이어가 돌본 날"이라 하루에 1 만 는다. 그런데 밝은 날은 여기서
     두 칸을 쌓으므로 그 둘이 갈린다 — 세이브가 그 짝을 `daysPlanted` 로 재고 있어서
     멀쩡한 판이 「깨진 턴」으로 경고됐다. 재생은 정확했고, **재는 자가 틀렸던 것**이다.
     ⇒ `dliHist` 와 1:1 인 값을 화분에 남긴다. 이 줄과 위 push 는 **같이 움직여야 한다.** */
  p.fedDays = (Number.isInteger(p.fedDays) ? p.fedDays : 0) + fedToday;
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
    /* ★ 밝기 속도 — 빛 부족 정지(growthBlocked)와도 머리공간(headroomBlocked)과도 **다른 칸**이다.
       셋을 섞으면 처방이 뒤섞인다: 빛 부족은 "등을 켜라", 머리공간은 "자리를 옮겨라",
       여기는 "지금도 자라고 있고, 밝을수록 빠르다"이다. 아무것도 막힌 상태가 아니다.
       `growthSteps` = 오늘 실제로 간 걸음 수(=넘긴 빛 칸 수). 1 이면 예전과 같은 하루다. */
    growthSpeed: speed,
    growthSteps: fedDays,
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
    /* ★ 물주기·수확 — earlyTurn 과 같은 칸. 반환구가 둘이면 둘 다 챙긴다(이 파일의 오랜 함정). */
    cropWatered, cropIdle: (firstPlayEvent && firstPlayEvent.idle) || 0,
    cropReady: beansproutReady(S.firstPlay),
    cropJustReady: !!(firstPlayEvent && firstPlayEvent.justReady),
    cropHarvest: beansproutHarvestStatus(S.firstPlay),
    cropWater: beansproutWaterStatus(S.firstPlay, S.day),
    cuttings, shop
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

/* ============================================================
   ★★ 수확 — **게임 화면의 [수확하기] 버튼이 부르는 유일한 함수** (2026-08-04 신설)
   ------------------------------------------------------------
   박사님 지시: *"수확하기를 해야 반영되도록 하자."*

   ★ 규칙 자체는 `first_play.js §수확` 이 갖는다. 여기 있는 이유는 **`io` 가 필요해서**다 —
     첫 수확에는 몬스테라 선물이 딸려 오고, 그건 `io.growth`(setGrowth)와 `io.light`(자리 고르기)를
     쓴다. `state.waterCrop` 이 state 에 있는 것과 같은 판단이다: 그 함수는 `S.day` 만 필요했다.

   ★★ 원자적이다. 선물이 실패하면 **수확도 안 난 것으로 되돌린다.**
     예전에는 이 원자성이 `nextDay` 의 Day 4 되감기였다(날짜까지 되돌렸다). 이제는 날짜가
     이미 확정된 뒤라 되돌릴 것이 **수확 하나뿐**이고, 그래서 오히려 더 완전하다 —
     플레이어는 growth 를 고친 뒤 [수확하기]를 다시 누르면 된다.

   ★★ 배움도 여기서 켠다(learnEventsOf). 배움 ①(첫 수확·식비 절감)·②(어두운 자리)의 증거는
     **거두는 순간**에만 온전하다. 다음 턴으로 미루면 "거두고 바로 다시 심은" 판에서
     `avgDli` 가 초기화되어 배움이 조용히 사라진다.

   ★ 곳간에서 **먹지는 않는다.** 절감은 다음 [다음 날] 부터 하루 600원씩 나간다
     (first_play.js §harvestBeansprout 의 ⚠ — 같은 날 두 번 먹는 것을 막는다).

   반환 { ...수확 결과, arrived, growthPhase, events }
     events 는 `turn.events` 와 **같은 모양**이라 그대로 `dialogue.scriptsForEvents` 에 넣으면 된다:
       beansprout_harvest → learn_harvest → learn_cropDark → monstera_arrived (EVENT_ORDER 가 정렬한다)
============================================================ */
export function harvestCrop(S, io) {
  const fp = S && S.firstPlay;
  if (!fp || !fp.enabled || !fp.beansprout)
    throw new Error('[수확] 첫 플레이 상태가 없습니다 — 거둘 시루가 없습니다');
  if (!io || !io.light || !io.growth)
    throw new Error('[수확] 조도·생장 계약이 필요합니다 — nextDay 와 같은 io 를 넘겨 주세요');
  const b = fp.beansprout;
  if (!b.slotId) {
    const e = new Error('[수확] 시루를 먼저 방 안에 놓아 주세요');
    e.tutorialInput = true; throw e;
  }
  /* ★★ 2026-08-04 — `b.harvested`(하나라도 거뒀나)로 막지 않는다. 시차 판에서는 거의 늘 true 라
     **둘째 시루가 익어도 못 거두게 된다.** 판정은 언제나 "익은 시루가 있나"다(first_play.js). */
  if (!beansproutReady(fp)) {
    const st = beansproutHarvestStatus(fp);
    const e = new Error(
      st && st.nextReadyInDays != null
        ? `[수확] 아직 ${st.nextReadyInDays}일 더 자라야 합니다 (${b.ageDays}/${b.harvestDays}일)`
        : (st && st.idleCount
            ? `[수확] 아직 물을 안 준 시루가 ${st.idleCount}개 있습니다 — 물을 줘야 회전이 시작됩니다`
            : '[수확] 이미 거둔 시루입니다 — 다시 심어야 또 거둡니다'));
    e.tutorialInput = true; throw e;
  }

  const fpBefore = firstPlaySnapshot(fp);
  const rollback = structuredClone(fp);
  const logLengthBefore = S.log.length;
  const ts = S.tutorial && S.tutorial.enabled ? S.tutorial : null;
  const learnedBefore = ts ? { ...ts.learned } : null;

  let r = null, arrived = null, arrivalPhase = null;
  try {
    r = harvestBeansprout(fp, { day: S.day });
    /* ★ 2026-08-05 — 종류가 늘어 "콩나물 수확"이 늘 맞는 말이 아니다. 거둔 것을 그대로 적는다 */
    const what = (r.byKind || []).map(g => `${g.kindKo} ${g.pots}개`).join(' · ') ||
                 `시루 ${r.harvestedPots}개`;
    pushLog(S, `🥣 수확 — ${what} · ${r.qualityKo} · ${r.meals}끼 상당 · ` +
               `${r.cycleSavedWon.toLocaleString()}원`);
    /* ★★ 겹침 (2026-08-04 · first_play.js §겹침) — 예전 "시루를 늘려도 안 는다"를 대신한다.
       손해의 이유가 시루 수가 아니라 **거두는 때가 겹친 것**이라, 처방도 달라진다:
       "사지 마라"가 아니라 **"물을 날을 달리해 줘라"** 다. */
    if (r.overlapLostWon > 0)
      pushLog(S, `🥱 곳간이 안 비어 있어 ${r.overlapLostWon.toLocaleString()}원을 못 받았습니다 ` +
                 `(시루 ${r.overlapCount}개가 겹쳤습니다) — 물을 **날을 달리해** 주면 ` +
                 `거두는 날이 어긋나 온전히 받습니다`);
    if (r.spoiledWon > 0)
      pushLog(S, `🗑 곳간이 넘쳐 ${r.spoiledWon.toLocaleString()}원어치가 쉬었습니다`);

    /* ── 선물은 **콩나물을 충분히 겪은 뒤** 한 번만 온다 (2026-08-04) ──
       예전에는 `!fp.monstera.arrived` 하나였다 = **첫 수확**. 박사님이 뒤로 미루셨다:
       *"몬스테라는 좀 더 뒤에 줘야겠다. 먹는 거 재배 좀 더 알려줘야 될 듯."*
       때의 정본은 first_play.monsteraArrivalDue 다 — 여기에 회전 수를 베끼지 않는다.
       ★ `!arrived` 는 그대로 남는다. 조건을 만족한 뒤에도 수확은 계속 나므로,
         이게 없으면 둘째·셋째 수확에서 몬스테라가 또 온다. */
    if (!fp.monstera.arrived && monsteraArrivalDue(fp)) {
      /* 처음부터 정답 창턱에 놓지 않는다 — 도착 후 플레이어가 창가 높은 자리로 옮기는 것이
         두 번째 학습이다. 그래서 **가장 어두운 자리**에 내려놓는다. */
      const { report } = io.light.daily(S.day, S);
      const roomSlots = (io.light.room && io.light.room.slots) || [];
      const potDiameter = FIRST_PLAY_ASSETS.monsteraPotDiameterM;
      /* ★ 치수가 숫자로 확인된 자리만 후보다. 폴백 금지 (2026-08-02 정정).
         예전엔 후보가 0칸이면 제약을 통째로 껐다 — 화분이 물리적으로 안 올라가는 자리에
         조용히 놓였다. 0칸이면 그건 데이터 문제이므로 숨기지 않고 던진다. */
      const canHoldPot = new Set(roomSlots
        .filter(s => slotFitsDiameter(s, potDiameter))
        .map(s => s.slotId));
      if (!canHoldPot.size)
        throw new Error(`[첫 플레이] 지름 ${potDiameter}m 화분이 올라가는 자리가 이 방에 없습니다 ` +
                        `(maxPotD 가 숫자로 있는 슬롯 0칸) — 방 데이터를 확인해 주세요`);
      /* ★ 2026-08-05 — 작물 자리가 **전부** 후보에서 빠진다. 예전에는 콩나물 자리 하나만
         뺐는데, 그러면 무순 판 위에 몬스테라가 내려앉는다(자리가 겹친다). */
      const cropSlotIds = new Set(cropSites(fp).map(s => s.slotId).filter(Boolean));
      const spot = [...(report.slots || [])]
        .filter(s => s && !cropSlotIds.has(s.slotId) && canHoldPot.has(s.slotId) &&
                     typeof s.dli === 'number' && isFinite(s.dli))
        .sort((x, y) => x.dli - y.dli)[0];
      if (!spot) throw new Error('[첫 플레이] 몬스테라가 도착할 화분 자리를 찾지 못했습니다');

      arrived = givePlant(S, io, { slotId: spot.slotId });
      /* ★ 도착은 setGrowth 가 그려졌고 **단계까지 읽힌 뒤에만** 완성된다 (2026-08-02 정정).
         ★ 도착에서는 **'정보 없음'도 실패다** — 일일 루프와 등급이 다르다. 단계 없이 열면
           monstera.growthPhase 가 null 로 굳고, markMonsteraPhase 가 매번 조용히 no-op 해서
           **completed 가 영영 false** 인 개체가 남는다. 근거 없이 문을 열지 않는다. */
      const gp = phaseOf(io, S);
      const gpError = gp.error ||
        (gp.phase ? null : 'growth 가 growthPhase() 를 내지 않습니다 — 단계 계약이 없습니다');
      if (gpError) {
        S.pots.length = 0;                    // 되돌리기 전에 방금 만든 화분을 거둔다
        const err = new Error(`[첫 플레이] 도착한 몬스테라의 단계를 읽지 못했습니다 — ${gpError}`);
        /* ★ growth 쪽은 **코어가 못 되감는다** — setGrowth(도착 진행도) 는 이미 적용됐다.
           ⚠ 그래도 잠그지 않는다: setGrowth 는 절대값 점프라 [수확하기]를 다시 누르면
             같은 자리에 다시 꽂혀 두 쪽이 맞는다. 재시도가 정답인 상태다. */
        err.growthJumpApplied = arrived.arrivalGrowthDays;
        throw err;
      }
      /* ★ 화분을 통째로 넘긴다 — slotId 만 넘기면 좌표가 사본에서 빠진다. */
      markMonsteraArrived(fp, arrived);
      markMonsteraPhase(fp, gp.phase);
      arrivalPhase = gp.phase;
      /* ★ 문구가 바뀐 이유 — **오는 물건이 바뀌었다** (2026-08-04).
         이제 줄기 하나짜리 어린 포기가 온다(state.ARRIVAL = 유효 45일).
         "이건 좀 더 어려울 거야"는 이미 자란 포기를 받을 때의 말이라 화면과 어긋난다. */
      pushLog(S, '🌱 “콩나물을 잘 키웠구나. 작은 걸 하나 줄 테니 키워 봐라.”');
    }
  } catch (e) {
    /* givePlant 는 setGrowth 성공 뒤에만 화분을 만들고, 위에서 실패하면 바로 거둔다.
       그래서 여기서 화분이 없으면 바깥 상태도 커밋되지 않았다 — 수확을 통째로 무른다. */
    if (!pot0(S)) {
      S.firstPlay = rollback;
      S.log.length = logLengthBefore;
      e.harvestRolledBack = true;
      /* ★ 무른 것은 **코어뿐**이다 — growth 는 이미 점프한 뒤일 수 있다.
         로그를 자른 **뒤에** 남긴다(먼저 남기면 위 truncate 에 같이 잘린다). */
      if (e.growthJumpApplied != null)
        pushLog(S, `⚠ 수확은 물렀지만 growth 는 이미 유효 ${e.growthJumpApplied}일로 ` +
                   `점프한 뒤입니다 — 옆 창의 몬스테라는 남아 있습니다. ` +
                   `[수확하기]를 다시 누르면 같은 값으로 다시 맞춰집니다`);
    } else {
      e.harvestRolledBack = false;
    }
    throw e;
  }

  /* ── 사건 · 배움 ─────────────────────────────────────────────
     ★ 순서는 여기서 안 정한다 — `dialogue.EVENT_ORDER` 가 정본이다(수확 → 배움 → 도착). */
  const events = firstPlayEventsOf(fpBefore, fp);
  if (ts) {
    /* ★ 증거는 **이 회전이 실제로 식비를 덜었나**(cycleSavedWon)다 — tutorial.noteLearning 참고.
       예전 증거(`foodSavedWon` = 그날 곳간에서 꺼낸 돈)는 이제 수확과 **다른 날**에 난다. */
    noteLearning(ts, { harvested: true, cycleSavedWon: r.cycleSavedWon, cropAvgDli: r.avgDli });
    events.push(...learnEventsOf(ts, learnedBefore));
  }
  return { ...r, arrived, growthPhase: arrivalPhase, events };
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

   ══ ★★ 물주기와 어떻게 맞물리나 (2026-08-04 새 규칙으로 다시 정함) ═══════════
   ★ 물이 **회전 시작**이 되면서(first_play.js §물주기) 이 자리의 질문이 바뀌었다.
     예전 질문: "매일 눌러야 하는데 빨리감기 중에는 못 누른다 — 어떡하나."
     지금 질문: **"물을 줄 수 있는데 안 준 시루가 있으면 서는 게 맞나."**

     jump (반지하 튜토 = 첫 플레이 진행 중)   시작 대기가 **생기면 선다**  `stopOnIdle` 기본 켜짐
     fast (그 뒤 · 본편)                      물을 **같이 준다**           `autoWater` 기본 켜짐

   ★★ 왜 점핑은 서나 — **안 서면 헛돈다.** 새 규칙에서 물을 안 준 시루는 자라지 않으므로
     수확 이벤트가 **영영 안 온다.** 그대로 두면 60일 한도까지 감고 화면은 이유를 말할 창구가
     없다. 서면 정지 사유가 곧 답이다("물을 줘야 시작합니다"). 이 근거는 옛 규칙과 같다.
   ★★ 그런데 **매일 서지는 않는다.** 마른 날은 매일 왔지만 시작 대기는 **생기는 순간이 있다** —
     게임을 시작할 때와 다시 심은 뒤다. 그래서 **전환에서만** 선다(`turn.cropIdle` 이 0에서
     올라간 턴). 매일 서면 [다음 날]과 같아지고, 안 서면 헛돈다 — 전환이 그 사이다.
   ★ 왜 배속은 주나 — **배속에서 서면 배속이 하루짜리가 되어 기능이 사라진다.**
     그리고 이것은 **지름길이 아니다**: 배속의 자동 급수는 **하루에 한 시루씩**이라
     손으로 매일 [물 주기]를 누른 것과 한 글자도 다르지 않다.
     ⚠ 그래서 배속은 **저절로 시차를 만든다** — 그것도 손과 같은 결과다. 한꺼번에 시작하고
       싶으면 그것이 오히려 손으로만 되는 일(`waterCrop(S, {all:true})`)이다.
     ⚠ 그 대신 **배속은 튜토 이후 전용**이라(timeModeOf) 배우는 구간으로는 새지 않는다.

   ★ 둘 다 호출부가 명시로 뒤집을 수 있다(`stopOnIdle` · `autoWater`). 조용한 기본값이 아니라
     **모드에서 유도한 기본값**이라, 모드가 바뀌면 같이 바뀐다.
     옛 이름 `stopOnDry` 도 받는다 — 화면·재현이 아직 그 이름으로 부를 수 있다.
   ★ 시루를 아직 안 놓았거나 전부 자라는 중이면 대기가 없다 — 두 규칙 다 아무 일도 안 한다.

   ══ ★★ 수확과 어떻게 맞물리나 (2026-08-04) ═══════════════════════════════
   ★★ **두 모드가 다 선다.** 물과 달리 여기서는 답이 갈리지 않는다 — `stopOnReady` 기본 켜짐.

     jump (첫 플레이)  거둘 수 있게 되면 **선다.** 박사님 확정 —
                       "첫 수확은 이 구간이 가르치는 것이다."
                       ⚠ 안 서면 더 나쁘다: 수확이 손 동작이 된 뒤로 **거두기 전에는
                         다음 이벤트가 영영 안 온다.** 안 서면 60일 한도까지 헛돈다.
     fast (튜토 이후)  **선다.** 물과 같은 논리가 서는지 재 봤고, **한 곳에서 안 선다:**

       물을 세우면 배속이 죽는가?  죽는다. 마른 날은 **매일** 오므로 30일 배속이 1일이 된다(-97%).
       수확을 세우면?              안 죽는다. 거둘 날은 회전당 한 번이고, 배속은 **재파종을
                                   대신 안 하므로** 한 번 거두면 다음 회전이 시작되지 않는다.
                                   ⇒ 한 번 감는 동안 **최대 한 번** 선다.
       "결과가 손과 같은가"는 수확도 참이다(품질은 dliHist 로 이미 확정됐고 거두는 시각이
       그 값을 못 바꾼다). 그러나 **정지 비용이 물과 두 자릿수 다르다** — 물은 자동으로 줄
       이유가 그 비용이었지, 논리가 성립한다는 것만으로는 자동이 되지 않는다.

     ★ 그리고 자동수확은 박사님이 **나중 보상**으로 확정했다(아이템·특수보상·업적).
       배속에서 지금 켜면 그 보상이 미리 새어 나간다 — 배속은 튜토 이후 **전 구간**이다.

   ★ 정지는 **전환(`beansprout_ready` 사건 · `turn.cropJustReady`)** 에서만 난다.
     "지금 거둘 수 있다"로 세우면 안 거둔 채로 다시 감을 때마다 첫날에 또 서서 못 돈다.

   ★★ 자동수확 자리 — `S.perks.autoHarvest` (state.js §perks). **지금은 늘 꺼져 있다.**
     켜지면 여기서 이렇게 돈다: `stopOnReady` 기본값이 false 가 되고, tick 이 `autoWater` 와
     같은 자리에서 `harvestCrop(S, io)` 를 부른다(첫 수확 선물까지 같은 함수가 처리한다).
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
  blocked: '형태 정지',
  idle: '물을 줘야 시작합니다',
  dry: '물을 줘야 시작합니다',        // 옛 이름 — 화면이 아직 이 열쇠를 알 수 있다
  ready: '거둘 때가 됐습니다'
};

/* 자동수확 보상을 가졌나 — **지금은 늘 false** 다(state.js §perks). 켜고 끌 자리만 둔다.
   여기 한 곳에서만 읽는다: 자리를 여러 곳에서 읽기 시작하면 나중에 켤 때 반씩 켜진다. */
export function hasAutoHarvest(S) {
  return !!(S && S.perks && S.perks.autoHarvest);
}

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
  if (fp && fp.enabled && !fp.beansprout.slotId) {
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
  /* ★ 물주기 — **모드에서 유도한다**(위 §물주기와 어떻게 맞물리나). 지어낸 기본값이 아니다.
     둘이 동시에 켜지는 일은 없다: 자동으로 주면 마를 날이 없고, 마르면 안 준 것이다. */
  /* 옛 이름(`stopOnDry`)도 받는다 — 뜻이 "물 때문에 선다"로 같아서 갈아타는 동안 안 깨진다 */
  const idleOpt = opt.stopOnIdle === undefined ? opt.stopOnDry : opt.stopOnIdle;
  const stopOnIdle = idleOpt === undefined ? (mode === 'jump') : !!idleOpt;
  const autoWater = opt.autoWater === undefined ? (mode === 'fast') : !!opt.autoWater;
  /* ★ 수확 — **두 모드가 다 선다**(위 §수확과 어떻게 맞물리나). 모드에서 유도하지 않는 이유는
     둘의 답이 같기 때문이다. 유일하게 이 값을 끄는 것은 **자동수확 보상**이고, 지금은 늘 꺼져 있다. */
  const stopOnReady = opt.stopOnReady === undefined ? !hasAutoHarvest(S) : !!opt.stopOnReady;
  const onDay = typeof opt.onDay === 'function' ? opt.onDay : null;
  const onStop = typeof opt.onStop === 'function' ? opt.onStop : null;

  const startDay = S.day;
  const run = {
    mode, untilEvent, maxDays, msPerDay, stopOnBlock, stopOnReady,
    days: 0, timerId: null, done: false,
    /* null = 아직 한 턴도 안 돌았다 — 첫 턴의 판단이 그 뒤와 다르다(아래 tick 참고) */
    lastIdle: null,
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

    /* ★ 배속은 물을 같이 준다 — 손으로 [물 주기]를 누른 것과 **같은 함수·같은 결과**다
       (위 §물주기와 어떻게 맞물리나). 놓지 않았거나 이미 거둔 시루면 아무 일도 안 한다. */
    /* ★ **하루에 한 시루씩**이다 — 손으로 매일 [물 주기]를 누른 것과 같은 결과다.
       `{all:true}` 로 주면 손보다 빨라져 그것이 지름길이 된다. 여기서는 안 준다. */
    if (autoWater) {
      const b = S.firstPlay && S.firstPlay.enabled ? S.firstPlay.beansprout : null;
      if (b && b.slotId) waterBeansprout(S.firstPlay, S.day);
    }

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
    /* ★ 거둘 때가 됐다 — **배속도 선다**(위 §수확과 어떻게 맞물리나).
       점핑은 위 ②에서 `beansprout_ready` 사건으로 이미 섰다. 여기 걸리는 것은 배속뿐이다.
       ★ 전환에서만 본다(`cropJustReady`) — "지금 거둘 수 있다"로 세우면 안 거둔 채로
         다시 감을 때마다 첫날에 또 서서 배속이 못 돈다. */
    if (stopOnReady && turn.cropJustReady) { finish('ready', { turn, events }); return; }
    /* ★★ 시작 대기 — 이벤트보다 뒤에 본다. 수확한 턴이면 그 이벤트가 먼저 서야 맞다.
       ★ **전환에서만** 선다(위 §물주기와 어떻게 맞물리나). 대기가 0에서 올라간 턴이다 —
         "지금 대기가 있다"로 세우면 물을 줄 때까지 매일 서서 빨리감기가 못 돈다.
       ⚠ 첫 턴은 비교 대상이 없다(`lastIdle === null`). 그때는 **대기가 있으면 선다** —
         물을 안 준 채로 감기 시작한 판이 60일을 헛도는 것을 막는 자리다. */
    const idleNow = turn.cropIdle || 0;
    const idleAppeared = run.lastIdle === null ? idleNow > 0 : (idleNow > 0 && !run.lastIdle);
    run.lastIdle = idleNow;
    if (stopOnIdle && idleAppeared) { finish('idle', { turn, events }); return; }
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
