/* ============================================================
   engine/weather.js — 날짜 → 날씨·계절 (단일 소스)
   ------------------------------------------------------------
   왜 따로 두나
     생장 창은 "날짜를 시드로 굴린 날씨"로 7일 평균을 내고,
     집 창은 실측표를 뽑는다. 둘이 각자 굴리면 같은 날의 날씨가 달라져
     "아파트가 갈라지나"에 서로 다른 답이 나온다 — 실제로 그랬다.
     조도 물리를 daylight_lux.js 하나로 모았듯, 날씨도 여기 하나로 모은다.

   ★ 주의 — 확률과 계수는 다른 것이다
     확률 = 그날 그 날씨가 나올 빈도        (여기서 정한다)
     계수 = 그 날씨의 천공 조도 배율        (daylight_lux.js의 WEATHER)
     생장 창 인계에 "날씨 계수(맑음 .55 / 흐림 .25 / 비 .12)"로 적혀 있었는데
     0.25·0.12는 계수가 맞고 0.55는 계수가 아니다(맑음 계수는 1.00).
     섞이면 밸런싱이 통째로 틀어지므로 이름을 갈라 둔다.

   THREE·DOM 없음.
============================================================ */

/* 날짜 해시 — splitmix32 finalizer. 순차 정수 입력에 avalanche 가 좋다.

   ★ 한 번 오진했던 것 기록:
     여름 90일을 굴렸더니 맑음이 명목 0.55인데 실현 0.456이 나와 난수를 의심했다.
     그런데 20만 표본으로 재보니 0.5500·10분위 균등 — 난수는 멀쩡했다.
     원인은 **90일이 평균을 재기엔 너무 작은 표본**이라는 것이다(표준오차 ±5%p).
     그 5%가 "온실은 좋은 주에만 갈라진다"는 틀린 결론을 만들었다.
   → 그래서 평균은 굴리지 않고 해석적 기댓값(weatherE)으로 낸다.
     굴림은 분포의 꼬리(최악주·최고주)에만 쓰고, 그때도 여러 해를 돌려야 한다. */
export function hash01(day, salt = 0) {
  let x = ((day | 0) + Math.imul(salt | 0, 0x9E3779B1)) | 0;
  x = Math.imul(x ^ (x >>> 16), 0x21F0AAAD);
  x = Math.imul(x ^ (x >>> 15), 0x735A2D97);
  x = x ^ (x >>> 15);
  return (x >>> 0) / 4294967296;
}

export const DAYS_PER_SEASON = 90;
export const DAYS_PER_YEAR = DAYS_PER_SEASON * 4;
const SEASON_ORDER = ['spring', 'summer', 'autumn', 'winter'];

/** 날짜(0부터) → 계절. 1년 360일, 계절당 90일. */
export function seasonOf(day) {
  const d = ((day % DAYS_PER_YEAR) + DAYS_PER_YEAR) % DAYS_PER_YEAR;
  return SEASON_ORDER[Math.floor(d / DAYS_PER_SEASON)];
}

/* ★ 날씨 '확률' — 값의 소유는 plan 이다(밸런스 숫자).
   여기 있는 건 기본값일 뿐이고, 정본은 `data/balance/weather.json` 이다.
   집·생장·코어가 각자 표를 들면 같은 날 날씨가 갈린다 — 실제로 갈렸다
   (house 0.40/0.36/0.24 vs plan 0.55/0.30/0.15 → 결론이 뒤집혔다).
   그래서 기본값을 plan 값으로 맞춰 두고, 파일이 있으면 setWeatherProbs 로 덮는다. */
export const WEATHER_P = {
  spring: { clear: 0.55, cloudy: 0.30, rain: 0.15 },
  summer: { clear: 0.55, cloudy: 0.30, rain: 0.15 },
  autumn: { clear: 0.55, cloudy: 0.30, rain: 0.15 },
  winter: { clear: 0.55, cloudy: 0.30, rain: 0.15 }
};

/** `data/balance/weather.json` 을 읽어 확률표를 덮는다. 없으면 위 기본값. */
export function setWeatherProbs(table) {
  if (!table) return WEATHER_P;
  for (const s of SEASON_ORDER) if (table[s]) WEATHER_P[s] = { ...table[s] };
  return WEATHER_P;
}

/** 날짜 → 날씨. 시드가 날짜라 되감아도 같은 값이 나온다. */
export function weatherOf(day, opt = {}) {
  const season = opt.season || seasonOf(day);
  const p = WEATHER_P[season] || WEATHER_P.summer;
  const r = hash01(day, opt.seed ?? 0);
  if (r < p.clear) return 'clear';
  if (r < p.clear + p.cloudy) return 'cloudy';
  return 'rain';
}

/* ★ 날씨 계수의 기댓값 E — 해석적으로 정확한 값.
   90일 굴려 평균 내면 표본 오차가 섞인다(그래서 한 번 틀렸다).
   '평균 DLI'는 이 값으로 내고, 굴림은 최악주/최고주에만 쓴다. */
export const WEATHER_K = { clear: 1.00, cloudy: 0.25, rain: 0.12 };  // daylight_lux.js 의 WEATHER 와 같아야 한다

export function weatherE(season = 'summer', K = WEATHER_K) {
  const p = WEATHER_P[season] || WEATHER_P.summer;
  return p.clear * K.clear + p.cloudy * K.cloudy + p.rain * K.rain;
}

/** 그날의 {season, weather} 한 번에 */
export function skyOf(day, opt = {}) {
  const season = opt.season || seasonOf(day);
  return { season, weather: weatherOf(day, { ...opt, season }) };
}

/* ============================================================
   7일 이동평균 — 판정에 실제로 쓰이는 값

   하루 peak는 "1년에 며칠 있는 최고 조건"이라 밸런싱 근거가 못 된다.
   생장 창은 고사·갈라짐을 7일 이동평균으로 판정한다.

   ★ 평균과 꼬리를 다르게 낸다
     mean  — 해석적 기댓값. 굴리지 않는다. 표본 오차가 안 섞인다
     꼬리  — 여러 해를 굴려서 낸다. 한 계절(84주)만으론 최고주가 해마다 크게 흔들린다
   ============================================================ */
export function weekStats(dliOf, { season = 'summer', win = 7, years = 20, seed = 0, over = null } = {}) {
  const base = SEASON_ORDER.indexOf(season) * DAYS_PER_SEASON;
  const avgs = [];
  for (let y = 0; y < years; y++) {
    const daily = [];
    for (let i = 0; i < DAYS_PER_SEASON; i++) {
      const d = base + y * DAYS_PER_YEAR + i;
      daily.push(dliOf(weatherOf(d, { season, seed }), season, d));
    }
    for (let i = 0; i + win <= daily.length; i++) {
      let s = 0;
      for (let k = 0; k < win; k++) s += daily[i + k];
      avgs.push(s / win);
    }
  }
  avgs.sort((a, b) => a - b);
  const q = f => avgs[Math.min(avgs.length - 1, Math.floor(f * avgs.length))];
  const clear = dliOf('clear', season, base);
  const r = {
    mean: +(clear * weatherE(season)).toFixed(3),   // ★ 해석적. 굴림 평균이 아니다
    p10: +q(0.10).toFixed(3),
    p50: +q(0.50).toFixed(3),
    p90: +q(0.90).toFixed(3),
    min: +avgs[0].toFixed(3),
    max: +avgs[avgs.length - 1].toFixed(3),
    weeks: avgs.length
  };
  /* over = 문턱. 몇 %의 주가 넘는지 — "갈라짐이 몇 % 나오나"에 바로 답한다 */
  if (over != null) r.overPct = +(avgs.filter(v => v >= over).length / avgs.length * 100).toFixed(1);
  return r;
}

/** 옛 이름 — 쓰던 곳이 있으면 그대로 돈다 */
export const movingAvgStats = weekStats;
