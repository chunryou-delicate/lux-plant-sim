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
import { SIM_MODES } from './state.js';
import { weekOverPct, expectedWeekStats } from './loop.js';

const SEASON_KO = { spring: '봄', summer: '여름', autumn: '가을', winter: '겨울' };
const n2 = (v) => (v == null ? '—' : (+v).toFixed(2));

export function renderHUD(el, S, turn, io) {
  if (!turn) { el.innerHTML = `<div class="ph">[다음 날]을 눌러 시작하세요</div>`; return; }
  const r = turn.report, s = turn.slot;
  const th = io.light.thresholdsOf(S.pots[0].plantId, S.pots[0].variegated);
  const fen = th && th.fenestrate;

  /* ★ 갈라짐 표시는 7일평균 기준인 growth의 canFenestrate() 를 쓴다.
     계약의 slot.fenestrating 은 하루 값 기준이라 "오늘만 넘음"을 구분해 보여준다. */
  const fenOn = io.growth.canFenestrate
    ? io.growth.canFenestrate(S.pots[0].variegated)
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
        <i class="${drift ? 'warn' : ''}">코어 ${n2(turn.dli7Core)}${drift ? ' ⚠ 어긋남' : ''}</i></div>
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
      <div class="cell"><span>심은 지</span><b>${turn.daysPlanted}일</b>
        <i>생장 나이 ${turn.growthAge == null ? '—' : (+turn.growthAge).toFixed(1)}</i></div>
      <div class="cell"><span>변동계수 CV</span><b>${turn.cv == null ? '기록 부족' : n2(turn.cv)}</b>
        <i>7일 미만이면 '모른다'</i></div>
      <div class="cell"><span>전기 (표시만)</span><b>${(r.energy && r.energy.won) || 0}원</b>
        <i>누적 ${S.ledger.electricityWon.toLocaleString()}원 · 차감 없음</i></div>
    </div>

    <div class="slotline">자리 <code>${S.pots[0].slotId || '—'}</code>
      · 최고 슬롯 ${n2(r.best && r.best.dli)} (<code>${(r.best && r.best.slotId) || '—'}</code>)</div>
    ${turn.check.ok ? '' : `<div class="bad">⚠ 계약 이상<br>${turn.check.problems.slice(0, 5).join('<br>')}</div>`}
  `;
}

export function renderLog(el, S) {
  el.innerHTML = S.log.slice(-40).reverse()
    .map(l => `<div class="li"><span>${l.day}일</span>${l.msg}</div>`).join('');
}

/* ---------------------------------------------------------------
   30일 검수 리포트
     · 실제로 굴린 며칠의 결과
     · ★ 문턱 넘는 주의 비율 — 되돌릴 수 없는 사건은 평균이 아니라 이 값으로 본다
     · 20년 기대 분포(house measured.fenWeekPct 와 같은 방식)와 나란히
--------------------------------------------------------------- */
export function renderReport(el, S, io, turns) {
  const p = S.pots[0];
  const th = io.light.thresholdsOf(p.plantId, p.variegated);
  const fen = th && th.fenestrate;
  const season = turns.length ? turns[turns.length - 1].sky.season : 'summer';
  const hist = S.dliHist;

  const ran = weekOverPct(hist, fen);
  const exp = expectedWeekStats(S, io, { season, over: fen });
  /* house 실측표는 여름 기준이라 계절이 다르면 비교가 안 된다 — 여름 줄을 따로 낸다 */
  const sum = season === 'summer' ? exp : expectedWeekStats(S, io, { season: 'summer', over: fen });
  const room = io.light.room;
  const measured = (room.def.measured) || {};

  const days = turns.length;
  const mean = hist.length ? hist.reduce((a, b) => a + b, 0) / hist.length : 0;
  const bands = {};
  for (const t of turns) if (t.slot) bands[t.slot.band] = (bands[t.slot.band] || 0) + 1;

  el.innerHTML = `
    <h4>${room.def.label || room.id} · ${SEASON_KO[season]} · 등 ${S.lamps.count}개 · ${days}일</h4>
    <table>
      <tr><td>굴린 하루 평균 DLI</td><td><b>${n2(mean)}</b></td>
          <td>최저 ${n2(Math.min(...hist))} / 최고 ${n2(Math.max(...hist))}</td></tr>
      <tr><td>★ 판정값 — 기대 7일평균 (${SEASON_KO[season]})</td><td><b>${n2(exp.mean)}</b></td>
          <td>p10 ${n2(exp.p10)} · p50 ${n2(exp.p50)} · p90 ${n2(exp.p90)}</td></tr>
      ${season === 'summer' ? '' : `
      <tr><td>같은 자리 · 여름 기준</td><td><b>${n2(sum.mean)}</b></td>
          <td>실측표가 여름 기준이라 비교용 · 문턱넘는주 ${sum.overPct == null ? '—' : sum.overPct + '%'}</td></tr>`}
      <tr class="hl"><td>★ 갈라짐 문턱(${fen == null ? '없음' : fen}) 넘는 주 · ${SEASON_KO[season]}</td>
          <td><b>${exp.overPct == null ? '—' : exp.overPct + '%'}</b></td>
          <td>20년 ${exp.weeks}주 기준 · 굴린 ${days}일에선 ${ran ? ran.pct + '% (' + ran.weeks + '주)' : '주가 안 참'}</td></tr>
      <tr><td>house 실측표 대조 (등 0개 기준)</td>
          <td>${measured.avg7Summer == null ? '—' : 'avg7여름 ' + measured.avg7Summer}</td>
          <td>fenWeekPct ${measured.fenWeekPct == null ? '—' : measured.fenWeekPct + '%'} · peak ${measured.peakDLI ?? '—'} <i>(peak·연평균은 판정에 쓰지 않음)</i></td></tr>
      <tr><td>밴드 분포</td><td colspan="2">${
        Object.entries(bands).map(([b, c]) => `${BAND_KO[b] || b} ${c}일`).join(' · ') || '—'}</td></tr>
    </table>
    <p class="note">등 개수를 바꿔 다시 30일을 돌리면 이 표가 바뀌어야 합니다.
      "등을 켰더니 잎이 갈라지기 시작했다"가 v0의 완료 조건입니다.</p>
  `;
}
