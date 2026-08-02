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
     고사는 growth의 체력(vigor) 모델이 v1에 맡는다. 코어는 판정하지 않는다.
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
import { pot0, rehomePot, pushLog } from './state.js';
import { dliFromContract } from './growth_adapter.js';
import { weekStats, WEATHER_P } from '../engine/weather.js';

export function nextDay(S, io) {
  S.day++;
  const p = pot0(S);

  /* 방을 바꿨거나 가구가 사라졌으면 화분을 회수한다(5-4) */
  if (p) rehomePot(S, io.light.room.slots, m => pushLog(S, m));

  const { report, sky, check } = io.light.daily(S.day, S);
  if (!check.ok) pushLog(S, '⚠ 계약 이상 — ' + check.problems.slice(0, 3).join(' / '));

  /* 식물이 아직 도착하지 않았으면 빛만 굴리고 끝낸다 — 없는 개체를 자라게 하지 않는다 */
  if (!p) return { S, turn: { day: S.day, sky, report, slot: null, dli: null, check, noPlant: true } };

  const slot = (report.slots || []).find(s => s.slotId === p.slotId) || null;
  const dli = check.badSlots.has(p.slotId)
    ? null
    : dliFromContract(report, p.slotId, m => pushLog(S, '⚠ ' + m));

  /* ★ 오늘 빛은 **매일 반드시** 넘긴다 — null 도 넘긴다 (2026-08-02).
     예전처럼 `if (dli != null)` 로 건너뛰면 growth 안의 PLANT_DLI 에 어제 값이 남아
     "빛이 없는데 어제 빛으로 자라는" 상태가 된다. 조용히 틀리는 유형이라 호출을 생략하지 않는다. */
  io.growth.setDailyLight(dli);

  /* ★ 하루 진행은 advanceTo 만 쓴다. setGrowth(점프)는 도착 때 한 번뿐이다.
     달력은 하루 가고, 형태(유효 생장)는 빛이 될 때만 쌓인다 — 저광이면 여기서 멈춘다. */
  const step = io.growth.advanceTo(io.growth.calendarDay() + 1);
  p.daysPlanted++;                                   // 플레이어가 돌본 날 (형태와 별개 축)

  /* ★ null 을 0으로 바꾸지 않는다 (2026-08-02).
     0은 "쟀더니 암흑"이고 null 은 "못 쟀다"다. 0으로 넣으면 평균이 아래로 끌려가
     계약 누락이 '어두운 날'로 둔갑한다 — 날짜 자리는 지키되 값은 null 로 남긴다.
     평균·문턱 판정은 아래 avg()·weekOverPct() 가 null 을 걸러서 본다. */
  S.dliHist.push(dli);
  S.ledger.electricityWon += (report.energy && report.energy.won) || 0;   // 표시만. 차감 없음

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
    cv: io.growth.dliCV()
  };
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
