/* ============================================================
   game/loop.js — 턴 진행 (core 소유)
   ------------------------------------------------------------
   이 파일만 읽으면 하루에 무슨 일이 일어나는지 다 보이게 둔다.

   nextDay(S):
     1. S.day++
     2. 날씨·계절            skyFor(day, mode)        ← weather.js (코어가 따로 굴리지 않는다)
     3. 조도 계산            buildDailyLight(...)     ← house
     4. ★ 계약 검증          NaN·음수·밴드            ← 지시 5-3
     5. 개체별 빛 전달       setDailyLight(dli)       ← growth
     6. 생장 1틱             setGrowth(경과일)         ← growth
     7. 화면 갱신            (ui.js)

   ★ 없는 단계: 고사·수확·지출.
     고사는 growth의 체력(vigor) 모델이 v1에 맡는다. 코어는 판정하지 않는다.
     band === 'critical' 로 죽이는 코드는 절대 넣지 않는다 —
     반지하 산세는 맑음↔흐림으로 밴드를 매일 오가므로 하루로 죽이면 운으로 죽는다.
============================================================ */
import { pot0, rehomePot, pushLog } from './state.js';
import { dliFromContract } from './growth_adapter.js';
import { weekStats, WEATHER_P } from '../engine/weather.js';

export function nextDay(S, io) {
  S.day++;
  const p = pot0(S);

  /* 방을 바꿨거나 가구가 사라졌으면 화분을 회수한다(5-4) */
  rehomePot(S, io.light.room.slots, m => pushLog(S, m));

  const { report, sky, check } = io.light.daily(S.day, S);
  if (!check.ok) pushLog(S, '⚠ 계약 이상 — ' + check.problems.slice(0, 3).join(' / '));

  const slot = (report.slots || []).find(s => s.slotId === p.slotId) || null;
  const dli = check.badSlots.has(p.slotId)
    ? null
    : dliFromContract(report, p.slotId, m => pushLog(S, '⚠ ' + m));

  /* 5 → 6 순서 고정. 빛을 먼저 넣고 그 다음 자란다. */
  if (dli != null) io.growth.setDailyLight(dli);
  p.daysPlanted++;
  io.growth.setGrowth(p.daysPlanted);

  S.dliHist.push(dli == null ? 0 : dli);
  S.ledger.electricityWon += (report.energy && report.energy.won) || 0;   // 표시만. 차감 없음

  const turn = {
    day: S.day, sky, report, slot, dli,
    check,
    daysPlanted: p.daysPlanted,
    growthAge: io.growth.ageOf(p.daysPlanted),
    dli7Growth: io.growth.dli7(),      // growth가 실제로 쓴 7일 평균
    dli7Core: avg(S.dliHist, 7),       // 코어가 센 값 — 둘이 어긋나면 배선이 틀린 것
    cv: io.growth.dliCV()
  };
  return turn;
}

export function runDays(S, io, n, onTurn) {
  const turns = [];
  for (let i = 0; i < n; i++) {
    const t = nextDay(S, io);
    turns.push(t);
    if (onTurn) onTurn(t);
  }
  return turns;
}

/* ---------------------------------------------------------------
   검수 지표
--------------------------------------------------------------- */
export function avg(arr, n) {
  if (!arr || !arr.length) return null;
  const k = Math.max(1, Math.min(arr.length, n));
  let s = 0;
  for (let i = arr.length - k; i < arr.length; i++) s += arr[i];
  return s / k;
}

/* ★ 되돌릴 수 없는 사건(갈라짐·무늬 발현·잎 손실)은 평균으로 보면 안 된다.
   "몇 %의 주가 문턱을 넘나"가 맞는 지표다 — 최고주는 오래 굴리면 항상 peak라 무의미하다.
   여기서는 실제로 굴린 며칠의 롤링 주를 센다(표본이 작으니 아래 expectedWeekPct 와 같이 본다). */
export function weekOverPct(hist, over, win = 7) {
  if (over == null || !hist || hist.length < win) return null;
  let n = 0, hit = 0;
  for (let i = 0; i + win <= hist.length; i++) {
    let s = 0;
    for (let k = 0; k < win; k++) s += hist[i + k];
    n++; if (s / win >= over) hit++;
  }
  return n ? { pct: +(hit / n * 100).toFixed(1), weeks: n } : null;
}

/* 20년치 기대 분포 — house의 measured.fenWeekPct 와 같은 방식으로 낸다.
   판정 단위는 '계절별' 7일 평균이다. 연평균으로 자르면 결론이 뒤집힌다
   (data/balance/weather.json · judgement_unit). */
export function expectedWeekStats(S, io, { season = 'summer', over = null, years = 20 } = {}) {
  const p = pot0(S);
  const dliOf = (weather, s) => io.light.dliOfSlot(p.slotId, {
    weather, season: s, lampCount: S.lamps.count, litHours: S.lamps.litHours
  });
  const st = weekStats(dliOf, { season, over, years, seed: S.sim.seed });

  /* ★ 평균은 코어가 다시 낸다.
     weather.js 의 weekStats.mean 은 `맑은날값 × E[날씨계수]` 라 자연광만 있을 때만 맞다.
     식물등 DLI는 날씨와 무관한데도 같이 깎여서, 등을 켜면 평균이 p10보다 낮게 나온다
     (등 1개 검증에서 mean 7.14 < p10 8.46). 여기서는 날씨별 값에 확률을 직접 얹는다.
     → house에 보고해 뒀다(core-to-house.md). 고쳐지면 이 블록을 지운다. */
  const pw = WEATHER_P[season] || WEATHER_P.summer;
  let mean = 0;
  for (const w of ['clear', 'cloudy', 'rain']) mean += (pw[w] || 0) * dliOf(w, season);
  return { ...st, mean: +mean.toFixed(3), meanEngine: st.mean };
}
