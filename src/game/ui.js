/* ============================================================
   game/ui.js — 코어 HUD (core 소유)
   ------------------------------------------------------------
   텍스트 위주. 예쁘게 만드는 게 목적이 아니라 "빛 → 생장이 도는지"를 보는 것이 목적이다.
   iframe(plant_grow)의 자체 표시를 가리지 않게 옆에 둔다 — 두 값을 나란히 대조해야
   배선이 틀렸을 때 바로 보인다.

   ★ 밴드 이름을 코어에 리터럴로 쓰지 않는다. BAND_KO 를 house에서 가져다 쓴다
     (die→critical 개칭이 진행 중이라 하드코딩하면 조용히 어긋난다).
============================================================ */
import { BAND_KO } from '../engine/daily_light.js';
import { SIM_MODES, pot0 } from './state.js';
import { weekOverPct, expectedWeekStats, rollingAvg } from './loop.js';
import { FEN_PASS_PCT } from './sim.js';

const SEASON_KO = { spring: '봄', summer: '여름', autumn: '가을', winter: '겨울' };
const n2 = (v) => (v == null ? '—' : (+v).toFixed(2));

export function renderHUD(el, S, turn, io) {
  if (!turn) { el.innerHTML = `<div class="ph">[다음 날]을 눌러 시작하세요</div>`; return; }
  const r = turn.report, s = turn.slot;
  if (turn.noPlant || turn.plantArrived) {
    const crop = S.firstPlay && S.firstPlay.beansprout;
    el.innerHTML = `
      <div class="row big"><span class="k">Day</span><b>${turn.day}</b>
        <span class="sep"></span><span class="k">날씨</span><b>${(r.sky && r.sky.weather_ko) || turn.sky.weather}</b></div>
      <div class="grid">
        <div class="cell"><span>콩나물</span><b>${crop && crop.harvested ? `${crop.meals}끼` : `${(crop && crop.ageDays) || 0}/${(crop && crop.harvestDays) || '—'}일`}</b>
          <i>${crop && crop.slotId ? crop.slotId : '자리 선택 전'}</i></div>
        <div class="cell"><span>첫 수확일 식비</span><b>${S.firstPlay.food.cashFoodWon.toLocaleString()}원</b>
          <i>누적 절감 ${S.firstPlay.food.totalFoodSavedWon.toLocaleString()}원</i></div>
        <div class="cell"><span>몬스테라</span><b>${turn.plantArrived ? '도착!' : '아직 없음'}</b>
          <i>${turn.plantArrived ? '높은 창가 자리를 찾아 주세요' : '첫 수확 뒤 선물'}</i></div>
      </div>`;
    return;
  }
  const P = pot0(S) || { plantId: null, variegated: false, slotId: null };
  const th = io.light.thresholdsOf(P.plantId, P.variegated);
  const fen = th && th.fenestrate;

  /* ★ 갈라짐 표시는 7일평균 기준인 growth의 canFenestrate() 를 쓴다.
     계약의 slot.fenestrating 은 하루 값 기준이라 "오늘만 넘음"을 구분해 보여준다. */
  const fenOn = io.growth.canFenestrate
    ? io.growth.canFenestrate(P.variegated)
    : (s ? s.fenestrating : null);

  /* 코어와 growth의 7일 평균이 어긋나면 배선이 틀린 것이다 — 눈에 띄게 표시한다 */
  const drift = (turn.dli7Core != null && turn.dli7Growth != null &&
                 Math.abs(turn.dli7Core - turn.dli7Growth) > 0.01);

  el.innerHTML = `
    <div class="row big">
      <span class="k">Day</span><b>${turn.day}</b>
      <span class="sep"></span>
      <span class="k">계절</span><b>${SEASON_KO[turn.sky.season] || turn.sky.season}</b>
      <span class="sep"></span>
      <span class="k">날씨</span><b>${(r.sky && r.sky.weather_ko) || turn.sky.weather}</b>
      <span class="mode">${(SIM_MODES[S.sim.mode] || {}).ko || S.sim.mode}</span>
    </div>

    <div class="grid">
      <div class="cell"><span>오늘 DLI</span><b>${n2(turn.dli)}</b>
        <i>자연광 ${n2(s && s.dli_daylight)} + 등 ${n2(s && s.dli_lamp)}</i></div>
      <div class="cell"><span>7일 평균</span><b>${n2(turn.dli7Growth)}</b>
        <i class="${drift ? 'warn' : ''}">코어 ${n2(turn.dli7Core)}${drift ? ' ⚠ 어긋남' : ''}${
          turn.sample && turn.sample.missing ? ` · 결측 ${turn.sample.missing}일` : ''}</i></div>
      <div class="cell"><span>계절 (판정 단위)</span><b>${SEASON_KO[turn.sky.season]}</b>
        <i>판정 = 계절별 7일 평균</i></div>
    </div>

    <div class="grid">
      <div class="cell"><span>밴드</span><b>${(s && (s.ko || BAND_KO[s.band])) || '—'}</b>
        <i>${(s && s.band) || '—'}</i></div>
      <div class="cell"><span>갈라짐</span><b>${fenOn === null ? '—' : (fenOn ? '○ 켜짐' : '✕')}</b>
        <i>문턱 ${fen == null ? '없음' : fen}${
          s && s.fenestrating && fenOn === false ? ' · 오늘만 넘음' : ''}</i></div>
      <div class="cell"><span>과광</span><b>${s && s.overlight ? '○' : '✕'}</b>
        <i>${r.continuous_injury ? '연속점등 장해' : '광주기 ' + r.photoperiod.hours + 'h'}</i></div>
    </div>

    <div class="grid">
      <div class="cell"><span>★ 형태 단계</span><b>${turn.growthPhase ? Math.round(turn.growthPhase.progress01 * 100) + '%' : '—'}</b>
        <!-- ★ 한글 이름은 growth 가 낸 phaseKo 를 그대로 쓴다. 코어는 표를 들지 않는다. -->
        <i>${turn.growthPhase ? (turn.growthPhase.phaseKo || turn.growthPhase.phaseId)
             : (turn.growthPhaseError ? '단계 읽기 실패' : '단계 정보 없음')} · 유효 ${turn.effectiveGrowthDays ?? '—'}일</i></div>
      <div class="cell"><span>돌본 날</span><b>${turn.daysPlanted ?? 0}일</b>
        <i>도착 진행도 ${P.arrivalGrowthDays ?? '—'}에서 시작</i></div>
      <div class="cell"><span>전기 (표시만)</span><b>${(r.energy && r.energy.won) || 0}원</b>
        <i>누적 ${S.ledger.electricityWon.toLocaleString()}원 · 차감 없음</i></div>
    </div>

    ${turn.drawn === false ? `<div class="bad">⛔ 화면을 다시 그리지 못했습니다 — ${turn.drawError || '사유 미상'}<br>` +
        `유효 ${turn.effectiveGrowthDays}일까지 진행은 됐습니다(그림만 낡음)</div>` : ''}
    ${turn.hudError ? `<div class="slotline">⚠ growth HUD 갱신 실패 — ${turn.hudError} (3D 는 그려짐)</div>` : ''}
    ${turn.growthPhaseError ? `<div class="slotline">⚠ 단계 표시 읽기 실패 — ${turn.growthPhaseError}</div>` : ''}
    <!-- ★ 정지 사유는 빈 값으로 숨기지 않는다. 안 자라는 이유가 화면에 없으면 버그로 읽힌다. -->
    <div class="${turn.growthBlocked ? 'bad' : 'slotline'}">${
      turn.growthBlocked ? `⏸ 형태 정지 — ${turn.growthBlocked}`
                         : `▶ 자라는 중 (오늘 ${turn.grew ? '+1일' : '진행 없음'}) · CV ${turn.cv == null ? '기록 부족' : n2(turn.cv)}`}</div>
    <div class="slotline">자리 <code>${P.slotId || '—'}</code>
      · 최고 슬롯 ${n2(r.best && r.best.dli)} (<code>${(r.best && r.best.slotId) || '—'}</code>)</div>
    ${turn.check.ok ? '' : `<div class="bad">⚠ 계약 이상<br>${turn.check.problems.slice(0, 5).join('<br>')}</div>`}
  `;
}

/* ---------------------------------------------------------------
   ★ 7일평균 흐름 — "언제 문턱을 넘었나"가 한눈에 보여야 한다
     하루 값은 날씨로 튀어서 흐름이 안 보인다. 판정값(7일평균)과 문턱선을 같이 그린다.
--------------------------------------------------------------- */
export function renderSpark(el, hist, threshold, markDay) {
  const W = 372, H = 84, pad = 2;
  if (!hist || hist.length < 2) { el.innerHTML = '<div class="ph">아직 기록이 없습니다</div>'; return; }
  /* ★ 창을 여기서 다시 짜지 않는다 — loop.rollingAvg 하나만 쓴다(정본: 최근 7개 유효 관측값).
     하루선은 결측일에서 끊기고, 평균선은 직전 유효 7개로 이어진다. */
  const ok = v => typeof v === 'number' && isFinite(v);
  const a7 = rollingAvg(hist, 7);
  const max = Math.max(threshold || 0, ...a7.filter(ok)) * 1.12 || 1;
  const x = i => pad + i / Math.max(1, a7.length - 1) * (W - pad * 2);
  const y = v => H - pad - (v / max) * (H - pad * 2);
  const path = (arr) => {
    let d = '', pen = false;
    arr.forEach((v, i) => {
      if (!ok(v)) { pen = false; return; }
      d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`; pen = true;
    });
    return d;
  };
  const line = path(a7), daily = path(hist);
  const ty = threshold != null ? y(threshold) : null;
  const mx = markDay ? x(markDay - 1) : null;
  el.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" preserveAspectRatio="none">
      ${ty != null ? `<line x1="0" y1="${ty.toFixed(1)}" x2="${W}" y2="${ty.toFixed(1)}"
         stroke="#ff9a8a" stroke-width="1" stroke-dasharray="4 3"/>` : ''}
      <path d="${daily}" fill="none" stroke="rgba(255,255,255,.22)" stroke-width="1"/>
      <path d="${line}" fill="none" stroke="#ffb454" stroke-width="2"/>
      ${mx != null ? `<line x1="${mx.toFixed(1)}" y1="0" x2="${mx.toFixed(1)}" y2="${H}"
         stroke="#7ce69a" stroke-width="1.5"/>` : ''}
    </svg>
    <div class="sparkleg"><span style="color:#ffb454">━ 7일평균(판정값 · 최근 7개 유효 관측)</span>
      <span style="color:rgba(255,255,255,.4)">━ 하루(결측일은 끊김)</span>
      ${threshold != null ? `<span style="color:#ff9a8a">┄ 갈라짐 문턱 ${threshold}</span>` : ''}
      ${markDay ? `<span style="color:#7ce69a">┃ ${markDay}일 갈라짐 시작</span>` : ''}</div>`;
}

/* ★★ 2026-08-15 — **`**굵게**` 를 실제로 굵게 그린다** (점검에서 잡혔다).
   ------------------------------------------------------------
   기록칸에 `물을 **날을 달리해** 주면…` 처럼 **별표가 그대로 찍히고 있었다.**
   쓰는 쪽(`loop.js` 겹침 안내 · `state.js` 한꺼번에 심기 안내)은 강조하려고 적었는데
   읽는 쪽이 그냥 흘려 보냈다.

   ⇒ **문자열에서 별표를 지우지 않는다.** 지우면 「여기를 강조하려 했다」는 뜻까지 사라진다.
     쓰는 쪽은 그대로 두고 **그리는 쪽이 풀어 준다** — 고칠 자리가 한 곳으로 모인다.
   ⚠ 기록 글은 전부 이 저장소가 만든 것이라 그대로 넣어 왔다(예전부터 `l.msg` 를 raw 로 썼다).
     여는 별표와 닫는 별표가 **한 줄 안에서 짝이 맞을 때만** 바꾼다 — 짝이 없으면 그냥 둔다.
   ★ 별표를 쓰는 기록은 지금 둘뿐이지만, 앞으로 쓰는 사람이 굳이 안 물어봐도 되게 열어 둔다. */
const logBold = (s) => String(s).replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>');

export function renderLog(el, S) {
  el.innerHTML = S.log.slice(-40).reverse()
    .map(l => `<div class="li"><span>${l.day}일</span>${logBold(l.msg)}</div>`).join('');
}

/* ---------------------------------------------------------------
   30일 검수 리포트
     · 실제로 굴린 며칠의 결과
     · ★ 문턱 넘는 주의 비율 — 되돌릴 수 없는 사건은 평균이 아니라 이 값으로 본다
     · 20년 기대 분포(house measured.fenWeekPct 와 같은 방식)와 나란히
--------------------------------------------------------------- */
export function renderReport(el, S, io, turns) {
  const p = S.pots[0] || { plantId: null, variegated: false, slotId: null };
  const th = io.light.thresholdsOf(p.plantId, p.variegated);
  const fen = th && th.fenestrate;
  const season = turns.length ? turns[turns.length - 1].sky.season : 'summer';
  const hist = S.dliHist;

  const ran = weekOverPct(hist, fen);
  const exp = expectedWeekStats(S, io, { season, over: fen });
  /* house 실측표는 여름 기준이라 계절이 다르면 비교가 안 된다 — 여름 줄을 따로 낸다 */
  const sum = season === 'summer' ? exp : expectedWeekStats(S, io, { season: 'summer', over: fen });
  const room = io.light.room;
  /* ★ house 라벨 규약(2026-08-01): measured.{space|slots}.{peak_summer|avg7_summer}.
     라벨 없이 "아파트 6.02"만 오가다 세 번 사고가 났다. 코어 값은 전부 slots 기준이다. */
  const measured = (room.def.measured) || {};
  const ms = measured.slots || {};
  const sp = measured.space || {};

  const days = turns.length;
  /* ★ 결측(null)은 평균에서 뺀다. 0으로 세면 계약 누락이 '암흑'으로 둔갑한다. */
  const valid = hist.filter(x => typeof x === 'number' && isFinite(x));
  const missing = hist.length - valid.length;
  const mean = valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
  const bands = {};
  for (const t of turns) if (t.slot) bands[t.slot.band] = (bands[t.slot.band] || 0) + 1;

  el.innerHTML = `
    <h4>${room.def.label || room.id} · ${SEASON_KO[season]} · 등 ${S.lamps.count}개 · ${days}일</h4>
    <table>
      <tr><td>굴린 하루 평균 DLI</td><td><b>${n2(mean)}</b></td>
          <td>${valid.length ? `최저 ${n2(Math.min(...valid))} / 최고 ${n2(Math.max(...valid))}` : '유효 표본 없음'}
              ${missing ? `<i> · ★ 결측 ${missing}/${hist.length}일(계약 누락) — 평균에서 제외</i>` : ''}</td></tr>
      <tr><td>★ 판정값 — 기대 7일평균 (${SEASON_KO[season]})</td><td><b>${n2(exp.mean)}</b></td>
          <td>p10 ${n2(exp.p10)} · p50 ${n2(exp.p50)} · p90 ${n2(exp.p90)}</td></tr>
      ${season === 'summer' ? '' : `
      <tr><td>같은 자리 · 여름 기준</td><td><b>${n2(sum.mean)}</b></td>
          <td>실측표가 여름 기준이라 비교용 · 문턱넘는주 ${sum.overPct == null ? '—' : sum.overPct + '%'}</td></tr>`}
      <tr class="hl"><td>★ 갈라짐 문턱(${fen == null ? '없음' : fen}) 넘는 주 · ${SEASON_KO[season]}</td>
          <td><b>${exp.overPct == null ? '—' : exp.overPct + '%'}</b></td>
          <td>20년 ${exp.weeks}주 기준 · 굴린 ${days}일에선 ${
            ran && ran.pct != null ? `${ran.pct}% (${ran.weeks}주${ran.skipped ? `, 결측으로 ${ran.skipped}주 제외` : ''})`
            : '유효한 주가 없음'}</td></tr>
      <tr><td>house 실측 대조 <i>(등 0개·자연광만)</i></td>
          <td>${ms.avg7_summer == null ? '—' : 'avg7여름 ' + ms.avg7_summer}</td>
          <td><b>slots</b> peak ${ms.peak_summer ?? '—'} · <b>space</b> avg7 ${sp.avg7_summer ?? '—'}
              <i>(라벨 없는 숫자는 쓰지 않는다 — 내 값은 slots 기준)</i></td></tr>
      <tr><td>밴드 분포</td><td colspan="2">${
        Object.entries(bands).map(([b, c]) => `${BAND_KO[b] || b} ${c}일`).join(' · ') || '—'}</td></tr>
    </table>
    <p class="note">★ <b>자리</b>를 바꿔 다시 돌리면 이 표가 크게 바뀝니다 — 등을 하나 더 사는 것보다
      화분을 한 칸 옮기는 쪽이 큽니다(박사님 확정 2026-08-01, 축은 등 개수가 아니라 자리).
      갈라짐 합격선은 <b>문턱 넘는 주 ${FEN_PASS_PCT}% 이상</b> ${
        exp.overPct == null ? '' : (exp.overPct >= FEN_PASS_PCT ? '— 지금 <b>통과</b>' : '— 지금 <b>미달</b>')}.</p>
  `;
}
