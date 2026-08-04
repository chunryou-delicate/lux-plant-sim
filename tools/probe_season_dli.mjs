/* 계절별 DLI 곡선 실측 — story_arc.md §5 ①번 줄
 *
 *   node tools/probe_season_dli.mjs
 *
 * ★ 무엇을 재나
 *   `data/profiles/room_profile.*.json`(순수 기하 ratio·등 PPFD) 위에
 *   `src/engine/weather.js`(계절 확률표·날씨 계수)와 `daylight_lux.js`(계절 계수)를 붙여
 *   **하루 DLI 를 실제로 굴린다.** 계산 공식을 여기서 다시 쓰지 않는다 —
 *   `room_profile.createProfileLight` 가 게임과 **같은 물리식**을 부른다.
 *
 * ★★ 왜 이 도구가 필요했나 (2026-08-05 발견)
 *   `data/balance/weather.json` 의 expected_avg7 표는 **peak × 0.643 × 계절계수** 라는
 *   환산식으로 만든 것이고, 그 peak 는 2026-07-26 값이라 `_status: ⏸ 보류` 로 찍혀 있다.
 *   즉 "가을·겨울 DLI"에 지금 쓸 수 있는 숫자가 **문서에 없었다.** 여기서 다시 잰다.
 *
 * ★ 조건을 반드시 같이 낸다 — 방·자리·계절·등 개수·창(하루/7일평균).
 *   조건 없는 DLI 숫자는 못 쓴다(weather.json §judgement_unit 이 같은 이유로 생긴 파일이다).
 *
 * ⚠ 값을 하나도 안 바꾼다. data/** 는 읽기만 한다.
 */
import fs from 'node:fs';
import { createProfileLight } from '../src/game/room_profile.js';
import { weatherOf, seasonOf, weatherE, DAYS_PER_SEASON, setWeatherProbs } from '../src/engine/weather.js';
import { daylightDLI, lampDLI } from '../src/engine/daily_light.js';

const J = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url), 'utf8'));
const TH = J('../data/balance/light_thresholds.json');
const WB = J('../data/balance/weather.json');
const GT = J('../data/growth_tuning.json');

const SEASONS = ['summer', 'autumn', 'winter', 'spring'];
const SEASON_KO = { spring: '봄', summer: '여름', autumn: '가을', winter: '겨울' };
const SEASON_BASE = { spring: 0, summer: 90, autumn: 180, winter: 270 };

/* 몬스테라 밴드 — growth_tuning.thresholds 가 정본(light_thresholds 사본) */
const B = GT.thresholds;
const bandOf = d =>
  d < B.die ? '고사권'
  : d < B.survive ? '위험'
  : d < B.min ? '정지'
  : d < B.fenestrate ? '생장'
  : d <= B.max ? '갈라짐' : '과광';

const lightOf = (room) => createProfileLight(
  J(`../data/profiles/room_profile.${room}.json`),
  { lightTh: TH, weatherBalance: WB });

/* ★ 반지하 말고는 프로파일이 **안정 uid 계약(2026-08-02) 이전 파일**이라
   `createProfileLight` 가 로드를 거부한다(세이브 slotId 가 흔들리기 때문이고, 옳은 거부다).
   그런데 그 계약은 **세이브 규약**이지 물리가 아니다 — 여기서는 조도만 재므로
   같은 물리식(`daylightDLI`·`lampDLI`)을 프로파일의 ratio·ppfd 에 직접 걸어서 잰다.
   ⚠ 그래서 아래 원룸 값은 **자리 이름을 못 믿는다**(칸 수와 밝기 분포만 유효하다). */
function rawLightOf(room) {
  const p = J(`../data/profiles/room_profile.${room}.json`);
  return {
    profile: () => p,
    dliOfSlot(slotId, { weather, season, lampCount = 0, litHours = 12 }) {
      const s = p.slots.find(x => x.slotId === slotId);
      if (!s) return 0;
      const li = Math.max(0, p.lampCounts.indexOf(lampCount));
      return daylightDLI(s.ratio, { weather, season }) + lampDLI((s.ppfd || [])[li] || 0, litHours);
    }
  };
}

/* 한 자리·한 계절·등 n개의 하루 DLI 를 90일 × years 년 굴려 7일 이동평균 분포를 낸다.
   ★ 굴림이다. 해석적 기댓값(weatherE)도 같이 내서 둘이 어긋나면 보이게 한다 —
     등을 섞으면 해석식이 틀린다(weather.js weekStats 주석의 그 경고와 같은 이유). */
function seasonStats(light, slotId, season, lampCount, { years = 20, litHours = 12 } = {}) {
  const base = SEASON_BASE[season];
  const dliOf = w => light.dliOfSlot(slotId, { weather: w, season, lampCount, litHours });
  const daily = [];
  for (let y = 0; y < years; y++)
    for (let i = 0; i < DAYS_PER_SEASON; i++) {
      const d = base + y * 360 + i;
      daily.push(dliOf(weatherOf(d, { season })));
    }
  const avg7 = [];
  for (let i = 0; i + 7 <= daily.length; i++) {
    let s = 0; for (let k = 0; k < 7; k++) s += daily[i + k];
    avg7.push(s / 7);
  }
  const srt = [...avg7].sort((a, b) => a - b);
  const q = f => srt[Math.min(srt.length - 1, Math.floor(f * srt.length))];
  const mean = avg7.reduce((a, b) => a + b, 0) / avg7.length;
  const clear = dliOf('clear');
  return {
    peak_clear: +clear.toFixed(2),
    analytic: +(clear * weatherE(season)).toFixed(2),   // 등이 섞이면 이 값은 틀린다
    avg7_mean: +mean.toFixed(2),
    p10: +q(0.10).toFixed(2), p50: +q(0.50).toFixed(2), p90: +q(0.90).toFixed(2),
    min: +srt[0].toFixed(2), max: +srt[srt.length - 1].toFixed(2),
    band: bandOf(mean),
    pct_weeks_ge_min: +(avg7.filter(v => v >= B.min).length / avg7.length * 100).toFixed(1),
    pct_weeks_ge_fen: +(avg7.filter(v => v >= B.fenestrate).length / avg7.length * 100).toFixed(1),
    pct_weeks_lt_survive: +(avg7.filter(v => v < B.survive).length / avg7.length * 100).toFixed(1)
  };
}

const pad = (s, n) => String(s).padEnd(n, ' ');
const rpad = (s, n) => String(s).padStart(n, ' ');

console.log('══ 계절별 DLI 실측 (probe_season_dli) ═══════════════════════════════');
console.log(`판정 밴드(몬스테라 · growth_tuning.thresholds): die ${B.die} · survive ${B.survive} · ` +
            `min ${B.min} · fenestrate ${B.fenestrate} · max ${B.max}`);
console.log(`날씨 확률(data/balance/weather.json): 맑음 ${WB.weather.clear.p} · 흐림 ${WB.weather.cloudy.p} · ` +
            `비 ${WB.weather.rain.p} → E[k] ${WB.weather.expected_k}`);
console.log(`계절계수(data/balance/weather.json season_factor): ` +
            SEASONS.map(s => `${SEASON_KO[s]} ${WB.season_factor[s]}`).join(' · '));
console.log('굴림: 계절당 90일 × 20년 = 1800일 → 7일 이동평균 1794주. 등 점등 12h.\n');

/* ── ① 반지하 창턱·서랍장 — 튜토가 실제로 쓰는 두 자리 ────────────────── */
const banjiha = lightOf('banjiha');
const SILL = 'banjiha-sill:0';
const DARK = 'banjiha-dresser:1';

for (const [slotId, ko] of [[SILL, '창턱 (몬스테라 자리)'], [DARK, '서랍장 (콩나물 자리)']]) {
  console.log(`── 반지하 · ${slotId} — ${ko} ─────────────────────────`);
  console.log(pad('계절', 6) + pad('등', 4) + rpad('맑음peak', 9) + rpad('avg7', 7) +
              rpad('p10', 7) + rpad('p90', 7) + '  ' + pad('밴드', 8) +
              rpad('≥min주%', 9) + rpad('≥6주%', 8) + rpad('<1.2주%', 9));
  for (const season of SEASONS)
    for (const lamps of [0, 1, 2]) {
      const r = seasonStats(banjiha, slotId, season, lamps);
      console.log(pad(SEASON_KO[season], 6) + pad(lamps + '개', 4) +
        rpad(r.peak_clear, 9) + rpad(r.avg7_mean, 7) + rpad(r.p10, 7) + rpad(r.p90, 7) +
        '  ' + pad(r.band, 8) + rpad(r.pct_weeks_ge_min, 9) + rpad(r.pct_weeks_ge_fen, 8) +
        rpad(r.pct_weeks_lt_survive, 9));
    }
  console.log('');
}

/* ── ② 여름 대비 계절 낙폭 — "가을이 얼마나 어두워지나"를 한 줄로 ────────── */
console.log('── 여름 = 100 으로 본 계절 낙폭 (반지하 창턱) ───────────────────');
for (const lamps of [0, 1, 2]) {
  const s = seasonStats(banjiha, SILL, 'summer', lamps).avg7_mean;
  const row = SEASONS.map(x => {
    const v = seasonStats(banjiha, SILL, x, lamps).avg7_mean;
    return `${SEASON_KO[x]} ${v} (${(v / s * 100).toFixed(0)}%)`;
  });
  console.log(`등 ${lamps}개 — ` + row.join(' · '));
}
console.log('★ 등이 늘수록 낙폭이 작아진다 — 등 DLI 는 날씨·계절과 무관하기 때문이다.\n');

/* ── ③ 반지하 전 슬롯 — 계절마다 "쓸 수 있는 자리"가 몇 칸인가 ──────────── */
console.log('── 반지하 14칸 중 몇 칸이 생장 가능(avg7 ≥ min 3.0)한가 ─────────');
console.log(pad('계절', 6) + ['등0개', '등1개', '등2개'].map(x => rpad(x, 10)).join(''));
const slots = banjiha.profile().slots.map(s => s.slotId);
for (const season of SEASONS) {
  const cells = [0, 1, 2].map(lamps => {
    const n = slots.filter(id => seasonStats(banjiha, id, season, lamps, { years: 4 }).avg7_mean >= B.min).length;
    return rpad(`${n}/14`, 10);
  });
  console.log(pad(SEASON_KO[season], 6) + cells.join(''));
}
console.log('');

/* ── ④ ③단계 이후의 방들 — 슬롯 수와 계절별 밝기 (등 0개 · 자연광만) ─────
   ⚠ 이 프로파일들에는 **등 PPFD 가 없다**(lampCounts:[0]). 등을 얹은 값은 못 낸다. */
for (const room of ['oneroom', 'tworoom', 'apartment']) {
  const L = rawLightOf(room);
  const S2 = L.profile().slots;
  const best = S2.reduce((a, s) => (!a || s.ratio > a.ratio) ? s : a, null);
  console.log(`── ${room} · 슬롯 ${S2.length}칸 · 제일 밝은 자리 ${best.slotId} (등 없음) ──────`);
  console.log(pad('계절', 6) + rpad('맑음peak', 9) + rpad('avg7', 7) + '  ' + pad('밴드', 8) +
              rpad('≥min칸', 8) + rpad('≥6칸', 7) + '/전체');
  for (const season of SEASONS) {
    const r = seasonStats(L, best.slotId, season, 0);
    const stats = S2.map(s => seasonStats(L, s.slotId, season, 0, { years: 2 }).avg7_mean);
    const n3 = stats.filter(v => v >= B.min).length;
    const n6 = stats.filter(v => v >= B.fenestrate).length;
    console.log(pad(SEASON_KO[season], 6) + rpad(r.peak_clear, 9) + rpad(r.avg7_mean, 7) +
      '  ' + pad(r.band, 8) + rpad(n3, 8) + rpad(n6, 7) + '/' + S2.length);
  }
  console.log('');
}

/* ── ⑤ ★튜토가 실제로 도는 창 — 게임 시작(여름 45일차)부터 300일 곡선 ────
   `tutorial.TUTORIAL_RULES` 의 시작점(여름 45일차)을 그대로 얹는다.
   ⚠ 지금 코어는 튜토를 `novice`(계절·날씨 고정) 로 돌린다 — 아래 표는
     "계절을 켜면 어떻게 되나"이고, 지금 게임에서 실제로 나는 값이 아니다. */
console.log('── ★게임 시작(여름 45일차)부터의 실제 곡선 · 반지하 창턱 · 등 0개 ──');
console.log('   (튜토 일자 = 첫 플레이가 끝난 뒤부터 세는 날. 계절을 켰다고 가정한 값)');
const START = SEASON_BASE.summer + 45;
for (const lamps of [0, 1]) {
  const marks = [];
  for (const tday of [0, 30, 45, 60, 90, 120, 135, 160, 189, 220, 260, 300]) {
    const abs = START + tday;
    const season = seasonOf(abs);
    /* 그 시점의 7일 이동평균(굴린 값) */
    let s = 0;
    for (let k = 0; k < 7; k++) {
      const d = abs - 6 + k;
      s += banjiha.dliOfSlot(SILL, { weather: weatherOf(d, { season: seasonOf(d) }), season: seasonOf(d), lampCount: lamps, litHours: 12 });
    }
    const v = s / 7;
    marks.push(`${rpad(tday, 3)}일(${SEASON_KO[season]}) ${v.toFixed(2)} ${bandOf(v)}`);
  }
  console.log(`  등 ${lamps}개:`);
  for (const m of marks) console.log('    ' + m);
}
console.log('');
console.log('★ 조건: 반지하 · banjiha-sill:0 · 등 12h 점등 · 날씨 굴림(맑0.55/흐0.30/비0.15) · ' +
            '판정 = 7일 이동평균 · 프로파일 2026-08-02 실측(가구 배치 포함)');
