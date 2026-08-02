/* ============================================================
   game/sim.js — 밸런스 자동 시뮬 (core 소유) · 2026-08-01 신설
   ------------------------------------------------------------
   목표: 캐릭터 4 × 모드 4 × 계수 조합을 헤드리스로 N일 돌려 표로 뽑는다.
        계수 하나 바꾸면 다 흔들리므로 수십 번 돌려야 하고, 그래서 자동화가 필수다.

   ★ 지금은 **형식과 배선만** 있다. 아직 없는 것(=전부 v1 이후):
       경제(식비·월세·전기 차감) · 목표(이사·수확) · 죽음 · 다개체 · 캐릭터 특성
     `result` 의 그 칸들은 null 로 남는다. **0으로 채우지 않는다** —
     0은 "쟀는데 0"으로 읽히고, null 은 "아직 안 잰다"로 읽힌다. 그 차이가 나중에 사고를 막는다.

   ★★ growth 는 아직 헤드리스로 못 돈다
     plant_grow.html 은 iframe 안의 일반 스크립트라 Node에서 못 올린다.
     그래서 시뮬은 `nullGrowth()` 를 쓴다 — **진짜 생장이 아니라 빛 이력만 따라간다.**
     `result.growth_real === false` 가 그 표시다. 이 값이 false인 결과로
     "며칠 만에 몇 장 자랐다"를 논하면 안 된다. 빛·경제 밸런스만 본다.
     growth 다개체 리팩터 때 진짜 포트로 갈아끼운다(loop.js 는 안 바뀐다).
============================================================ */
import { newState, SIM_MODES, givePlant, pot0 } from './state.js';
import { runDays, weekOverPct, expectedWeekStats, avg } from './loop.js';

export const SIM_SCHEMA = 'balance_sim/1';

/* ---------------------------------------------------------------
   ① 시나리오 — 무엇을 돌릴 것인가
--------------------------------------------------------------- */
export function makeScenario({
  id = null,
  char = null,          // data/balance/characters.json 의 id (자취생·가장·…)
  mode = 'real',        // 시간·난이도 모드. docs/time_modes.md 4단과 맞춘다
  room = 'banjiha',
  days = 90,
  lamps = { count: 0, litHours: 12 },
  plantId = 'monstera_deliciosa',
  slotPick = 'brightest',   // 'brightest' | 'darkest' | slotId 직접
  coefficients = {},        // 흔들 계수. 기본은 data/balance/*.json 값
  seed = 0
} = {}) {
  return { schema: SIM_SCHEMA, id: id || `${char || 'nochar'}·${mode}·${room}·등${lamps.count}`,
           char, mode, room, days, lamps, plantId, slotPick, coefficients, seed };
}

/* ---------------------------------------------------------------
   ② 결과 — 무엇을 표로 뽑을 것인가
   null = 아직 안 잰다 / 숫자 = 잰 값
--------------------------------------------------------------- */
export function makeResult(scenario) {
  return {
    schema: SIM_SCHEMA,
    scenario,
    result: {
      /* --- 빛 (지금 잴 수 있는 것) --- */
      dli_mean: null,              // 굴린 하루 평균
      dli_avg7_expected: null,     // ★ 판정값 = 계절별 기대 7일평균
      dli_p10: null, dli_p50: null, dli_p90: null,
      weeks_over_threshold_pct: null,  // ★ 되돌릴 수 없는 사건은 이 값으로 본다
      threshold: null,                 // 무슨 문턱을 넘는 주인지(갈라짐 6.0 등)
      band_days: null,                 // { best: 12, slow: 9, ... }
      electricity_won: null,           // 전기요금 누적(차감은 아직 안 함)
      dli_missing_days: null,          // ★ 계약 누락일 — 0으로 메우지 않고 따로 센다

      /* --- 아직 없는 것 (v1 이후) --- */
      days_to_goal: null,          // 자취생이 이사까지 며칠
      goal: null,                  // 무엇을 목표로 쟀나
      cash_curve: null,            // [{day, cash}] — 경제 루프 생기면
      food_covered_pct: null,      // 가장이 식비를 몇 % 막나
      plants_grown: null,          // 다개체 생기면
      fenestrated_count: null,     // 갈라진 잎 수 — 진짜 growth 붙어야 잰다
      deaths: null                 // 고사·활력은 취소·보류(2026-08-02) — 잴 대상이 없다
    },
    growth_real: false,            // ★ 위 주석 참고. true 되기 전엔 생장 수치를 믿지 않는다
    verdict: 'unknown',            // pass | too_slow | too_fast | unknown
    notes: []
  };
}

/* 판정 — ★ 기준값을 코드에 두지 않는다.
   정본은 **`data/balance/acceptance.json`**(plan 소유, `acceptance/1`)이다.
   그 안의 `{min,max}` 블록을 그대로 넘기면 된다. 예: `acc.economy.jachwi_first_move_days` */
export function verdictOf(record, criteria = {}) {
  const r = record.result;
  const g = criteria.days_to_goal || (criteria.min != null ? criteria : null);
  if (!g || r.days_to_goal == null) return 'unknown';
  if (g.fail_high != null && r.days_to_goal > g.fail_high) return 'too_slow';
  if (g.fail_low != null && r.days_to_goal < g.fail_low) return 'too_fast';
  if (r.days_to_goal > g.max) return 'too_slow';
  if (r.days_to_goal < g.min) return 'too_fast';
  return 'pass';
}

/* ---------------------------------------------------------------
   ③ growth 자리 채우기 — 빛 이력만 따라간다 (진짜 생장 아님)
--------------------------------------------------------------- */
export function nullGrowth(keep = 14, opt = {}) {
  const H = [];
  /* growth 의 growthBlockReason 과 같은 모양으로 정지시킨다 — 저광이면 형태가 안 나아간다.
     ⚠ 임계값은 growth 소유(growth_tuning.json growthMin). 시뮬은 호출부가 넘긴 값을 쓴다. */
  const growthMin = opt.growthMin ?? null;
  let cal = 0, growth = 0, today = null;
  const avgOf = (n) => H.length ? avg(H, n) : null;
  const blockReason = () => {
    if (today == null) return '오늘 빛이 없습니다(DLI 없음)';
    if (typeof today !== 'number' || !isFinite(today)) return '오늘 DLI 값이 망가졌습니다';
    const d = avgOf(7);
    if (d == null || !isFinite(d)) return 'DLI 이력이 없습니다';
    if (growthMin != null && d < growthMin) return `빛 부족 — 7일평균 ${d.toFixed(2)} < 최소 ${growthMin}`;
    return null;
  };
  return {
    real: false,
    setDailyLight(v) {
      today = (typeof v === 'number' && isFinite(v) && v >= 0) ? v : null;
      if (today != null) { H.push(today); if (H.length > keep) H.shift(); }
      return today;
    },
    /* 계약 그대로 — 하루만 받는다 */
    advanceTo(calDay) {
      const t = Math.round(calDay), delta = t - cal;
      if (delta !== 1) throw new Error(`[생장] advanceTo 는 하루만 받습니다 — 지금 달력 ${cal}, 요청 ${t}`);
      const reason = blockReason();
      cal = t;
      if (reason === null) growth += 1;
      /* 렌더 신호도 계약대로 낸다 — 스텁엔 3D 가 없으니 '그렸다'로 둔다(실패를 지어내지 않는다) */
      return { calDay: cal, growth, grew: reason === null, blocked: reason,
               drawn: true, drawError: null, hudError: null };
    },
    calendarDay: () => cal,
    growthDays: () => growth,
    growthBlocked: () => blockReason(),
    /* ★ growthPhase 는 **두지 않는다** (2026-08-02 정정).
       예전엔 `growthPhase: () => null` 이었다 — 계약을 **있다고 광고하면서 null 을 냈다.**
       코어가 단계 스키마를 검증하기 시작하면서(loop.phaseSchemaError) 이게 정확히 걸린다:
       null 은 '단계 없음'이 아니라 **깨진 단계**다. 스텁은 진짜 형태를 굴리지 않으므로
       낼 단계가 없다 — 그러면 **없다고 하는 게 맞다.**
       loop.phaseOf 는 함수가 아예 없으면 `{phase:null, error:null}`(정보 없음)로 지나간다.
       ⚠ 브라우저 게임 경로는 growth_adapter.assertContract 가 growthPhase 를 필수로 막으므로
         이 구멍으로 실제 플레이가 새지 않는다. 여기는 빛·경제만 재는 헤드리스 시뮬이다. */
    setGrowth(days) { growth = cal = Math.round(days);
                      return { growth, calDay: cal, drawn: true, drawError: null, hudError: null }; },
    dli7() { return H.length ? avg(H, 7) : null; },
    dliCV() {
      if (H.length < 7) return null;
      const a = H.slice(-14), m = a.reduce((s, v) => s + v, 0) / a.length;
      if (m <= 0) return null;
      return Math.sqrt(a.reduce((s, v) => s + (v - m) * (v - m), 0) / a.length) / m;
    },
    ageOf(d) { return d; },        // 진짜 곡선은 growth 소유(ageOf). 여기선 항등
    bandOf() { return null; },
    assertContract: () => true,    // 스텁은 항상 살아 있다
    /* vigor()·isDead() 는 두지 않는다 — 활력은 현재 계약 밖이다(2026-08-02) */
    history: () => H.slice()
  };
}

/* ---------------------------------------------------------------
   ④ 한 시나리오 돌리기 — 지금은 빛만 잰다
     light 는 room_profile.createProfileLight(profile) 를 넘긴다(THREE 없음).
--------------------------------------------------------------- */
export function runScenario(scenario, light, opt = {}) {
  const rec = makeResult(scenario);
  const growth = opt.growth || nullGrowth();
  const io = { light, growth };
  rec.growth_real = !!growth.real;

  const S = newState({ room: scenario.room, mode: scenario.mode });
  S.sim.seed = scenario.seed;
  S.lamps = { ...scenario.lamps };

  /* 자리 고르기 — 첫날 조건으로 순위를 낸다 */
  const preview = light.daily(1, S).report;
  const ranked = [...preview.slots].sort((a, b) => b.dli - a.dli);
  const slotId =
    scenario.slotPick === 'brightest' ? ranked[0] && ranked[0].slotId
    : scenario.slotPick === 'darkest' ? ranked[ranked.length - 1] && ranked[ranked.length - 1].slotId
    : scenario.slotPick;
  /* 개체 도착 — setGrowth 는 여기서 한 번뿐이다(초기화 경계) */
  givePlant(S, io, { slotId, plantId: scenario.plantId });

  const { turns } = runDays(S, io, scenario.days);
  const last = turns[turns.length - 1];
  const P = pot0(S);
  const th = light.thresholdsOf(P.plantId, P.variegated);
  const over = th && th.fenestrate;
  const season = last ? last.sky.season : 'summer';
  const exp = expectedWeekStats(S, io, { season, over });
  const bands = {};
  for (const t of turns) if (t.slot) bands[t.slot.band] = (bands[t.slot.band] || 0) + 1;

  Object.assign(rec.result, {
    dli_mean: (() => { const v = S.dliHist.filter(x => typeof x === 'number' && isFinite(x));
                       return v.length ? +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(2) : null; })(),
    dli_missing_days: S.dliHist.filter(x => typeof x !== 'number' || !isFinite(x)).length,
    dli_avg7_expected: exp.mean,
    dli_p10: exp.p10, dli_p50: exp.p50, dli_p90: exp.p90,
    weeks_over_threshold_pct: exp.overPct ?? null,
    threshold: over ?? null,
    band_days: bands,
    electricity_won: S.ledger.electricityWon
  });
  rec.notes.push(`자리 ${P.slotId} · ${season} · ${scenario.days}일`);
  if (weekOverPct(S.dliHist, over))
    rec.notes.push(`굴린 구간 문턱넘는주 ${weekOverPct(S.dliHist, over).pct}%`);
  rec.verdict = verdictOf(rec, opt.criteria);
  return rec;
}

/* 여러 시나리오 — 표 하나로 */
export function runMatrix(scenarios, lightOf, opt = {}) {
  return scenarios.map(sc => runScenario(sc, lightOf(sc), opt));
}

/* ---------------------------------------------------------------
   ⑤ ★ "자리가 등보다 크다" 대비 검사
     acceptance.json 의 두 줄에 그대로 답한다.
       light.banjiha_lamp1_goodspot_fenestrates  expect true   ← 튜토 핵심 학습
       light.banjiha_lamp1_badspot_fenestrates   expect false  ← 대비가 증명이다
     같은 방·같은 등 1개인데 자리만 바꾼다. 숫자는 내고 **합격선은 긋지 않는다** —
     "몇 % 이상이면 갈라진 것인가"는 plan 결정이라 여기서 정하면 안 된다.
--------------------------------------------------------------- */
/* ★ "갈라진다"의 합격선 — 문턱 넘는 주 50% 이상 (박사님 결정 2026-08-01).
   `acceptance.json` 은 expect true/false 인데 시뮬은 %를 내므로 변환선이 필요했다.
   plan이 `acceptance.json` 에 옮기면 그 값을 읽는다 — 그때 이 상수는 기본값이 된다. */
export const FEN_PASS_PCT = 50;

export function fenestrationContrast(light, opt = {}) {
  const base = { room: opt.room || 'banjiha', days: opt.days ?? 90,
                 lamps: { count: opt.lampCount ?? 1, litHours: opt.litHours ?? 12 },
                 plantId: opt.plantId || 'monstera_deliciosa', seed: opt.seed ?? 0 };
  const good = runScenario(makeScenario({ ...base, slotPick: 'brightest' }), light);
  const bad  = runScenario(makeScenario({ ...base, slotPick: 'darkest'   }), light);
  const pass = opt.passPct ?? FEN_PASS_PCT;
  const fen = r => (r.result.weeks_over_threshold_pct ?? 0) >= pass;
  return {
    room: base.room, lampCount: base.lamps.count, threshold: good.result.threshold,
    passPct: pass,
    goodspot: { slot: good.notes[0], avg7: good.result.dli_avg7_expected,
                weeks_over_pct: good.result.weeks_over_threshold_pct, fenestrates: fen(good) },
    badspot:  { slot: bad.notes[0],  avg7: bad.result.dli_avg7_expected,
                weeks_over_pct: bad.result.weeks_over_threshold_pct, fenestrates: fen(bad) },
    ratio: bad.result.dli_avg7_expected
      ? +(good.result.dli_avg7_expected / bad.result.dli_avg7_expected).toFixed(1) : null,
    /* acceptance.json: goodspot expect true · badspot expect false */
    accepted: fen(good) === true && fen(bad) === false
  };
}

/* 모드 목록은 state.js 하나에서만 온다(여기서 다시 정의하지 않는다) */
export const MODES = Object.keys(SIM_MODES);
