/* ============================================================
   engine/daily_light.js — 하루치 빛 → 생장 창으로 넘기는 계약 객체
   ------------------------------------------------------------
   책임 경계 (중요)
     이 창(집·방/조도) : 그날 하루의 '물리량'까지만 만든다. 상태를 갖지 않는다.
     생장 창           : 이 객체를 하루 1회 받아 누적 판정한다.
                         (며칠 연속 부족 → 시듦/고사, 황변 누적, 세이브/로드)
     → 여기서 '식물이 어떻게 됐는지'는 절대 결정하지 않는다. 밴드 이름만 붙여 넘긴다.

   단위
     lx  조도            PPFD µmol/m2/s          DLI mol/m2/day
     lx → PPFD 는 태양광 기준 0.0185 (Apogee). tool.html과 같은 계수.

   THREE·DOM 없음. 전부 인자로 받는다.
============================================================ */
import { skyEvMax, daylightAt, pointIllum,
         WEATHER, SEASON, REGION } from './daylight_lux.js';

export const LX_TO_PPFD = 0.0185;          // 태양광. 식물등은 기구별 스펙을 쓴다.

/* ============================================================
   1. DLI 적분
      조도 비율(기하학적, 시간 무관) × 그날 천공 정점 × 낮 길이.
============================================================ */

/* 천공 조도 1 lx당 그 지점이 받는 조도 비율. 하루 종일 변하지 않는(기하학적) 값. */
export function daylightRatio(p, n, wins, opt = {}) {
  const probe = 10000;
  // 벽만 한 창(온실 유리벽)도 정확하려면 거리 적응 샘플링이 필요하다.
  return daylightAt(p, n, wins, { samples: 'auto', ...opt, sky: probe }) / probe;
}

/* 자연광 DLI. ratio는 위 daylightRatio 결과(재사용하면 적분이 공짜다).

   렌더용 sun 슬라이더(skyEv의 t=12~88 = 18.2h)는 '보기 좋은 하루'라 실제 낮보다 길다.
   DLI는 물리량이므로 슬라이더가 아니라 계절별 실제 낮 길이로 적분한다.
   하루 밝기를 sin 반주기로 보면 평균/정점 = 2/π 이므로 적분이 닫힌 형태로 떨어진다. */
export function daylightDLI(ratio, opt = {}) {
  const hours = opt.dayHours ?? dayLengthHours(opt.season);
  const peakPPFD = skyEvMax(opt) * ratio * LX_TO_PPFD;   // 한낮 정점 µmol/m2/s
  return peakPPFD * (2 / Math.PI) * hours * 3600 / 1e6;
}

/* 식물등 DLI. ppfd는 그 지점의 기구 합산 PPFD, hours는 점등 시간. */
export function lampDLI(ppfd, hours) {
  return (ppfd || 0) * (hours || 0) * 3600 / 1e6;
}

/* 계절별 낮 길이 [h]. 서울 기준(하지 14.5 / 동지 9.8). */
export function dayLengthHours(season) {
  return (SEASON[season] || SEASON.summer).hours;
}

/* ============================================================
   2. 밴드 판정 — 이름만 붙인다. 결과(죽음/성장)는 생장 창이 정한다.
============================================================ */
/* 임계값은 전부 '이 값 이상이어야 그 상태' 라는 하한이다.
     die     미만 : 고사
     die~survive : 쇠약 — 버티지만 서서히 상함(계속되면 죽음)
     survive~min : 정체 — 죽진 않는데 새 잎이 안 남   ← 반지하 산세가 여기
     min~best_lo : 느린 성장
     best_lo~hi  : 최적
     best_hi~max : 성장(최적보단 못함)
     max 초과    : 과광 — 잎 탐·황변 */
/* ★ 밴드 키는 '오늘 빛이 어느 수준인가'일 뿐, 생사 판정이 아니다.
   고사는 체력(vigor) 모델이 7일 이동평균으로 정한다 — 하루 이 밴드라고 죽지 않는다.
   그래서 die/weak/survive 를 critical/poor/stagnant 로 고쳤다(생장 창 요청).
   임계값 필드명(th.die·th.survive·th.min)은 그대로다 — 그건 '이 값 이상이어야 그 상태'인
   경계 이름이라 밴드 키와 별개고, 바꾸면 growth_tuning.json까지 번진다. */
export const BANDS = ['critical', 'poor', 'stagnant', 'slow', 'best', 'good', 'over'];

export const BAND_KO = {
  critical: '고사', poor: '쇠약', stagnant: '정체', slow: '느림',
  best: '최적', good: '성장', over: '과광', unknown: '미정'
};

export function judgeDLI(dli, th) {
  if (!th) return { band: 'unknown', ko: '미정', fenestrating: false };
  let band;
  if      (dli <  th.die)      band = 'critical';
  else if (dli <  th.survive)  band = 'poor';
  else if (dli <  th.min)      band = 'stagnant';
  else if (dli <  th.best_lo)  band = 'slow';
  else if (dli <= th.best_hi)  band = 'best';
  else if (dli <= th.max)      band = 'good';
  else                         band = 'over';
  return {
    band,
    fenestrating: th.fenestrate != null && dli >= th.fenestrate,
    /* ★ 광량 초과. 원인이 '빛이 너무 많다'라서 해법은 차광·거리 띄우기.
       연속광 장해(continuous_injury)와는 원인도 해법도 다르다 — 절대 합치지 말 것. */
    overlight: dli > th.max,
    ko: BAND_KO[band]
  };
}

/* explicitVarie를 주면 그게 id 패턴보다 우선한다(슬롯이 직접 아는 경우). */
export function thresholdsFor(TH, plantId, explicitVarie) {
  if (!TH) return null;
  const p = TH.plants || {};
  let th = p[plantId] || null;
  if (!th) {
    // sansevieria_rare 처럼 접미사가 붙은 id → 접두 일치 허용
    for (const k of Object.keys(p)) if (plantId && plantId.startsWith(k)) { th = p[k]; break; }
  }
  if (!th) th = TH.default || null;
  return isVariegated(TH, plantId, explicitVarie) ? variegatedThresholds(th, TH) : th;
}

/* ★ 무늬종 판별. 슬롯이 variegated를 명시하면 그게 우선하고, 없으면 id로 본다. */
export function isVariegated(TH, plantId, explicit) {
  if (explicit != null) return !!explicit;
  const pat = TH && TH.variegated && TH.variegated.id_pattern;
  return !!(pat && plantId && new RegExp(pat).test(plantId));
}

/* ★ 무늬종 임계값 — 흰 조직은 광합성을 하지 않으므로 요구 광량이 전 구간 need_mult배다.
   max(과광 한계)는 곱하지 않는다(max_mult 1.0): 흰 조직은 보호 색소가 없어 오히려
   더 잘 탄다. 위쪽 여유가 늘어나면 안 된다.
     몬스테라 5~11 / max 16  →  무늬종 7.0~15.4 / max 16
   창이 위로 밀리면서 상단이 과광선에 거의 붙는다 = 밝게 두되 아슬아슬한 관리가 된다.
   ⚠ need_mult 1.4는 임시값이다. plant_grow.html 의 VARIE_MULT 와 같은 값을 유지할 것. */
export function variegatedThresholds(th, TH) {
  const cfg = (TH && TH.variegated) || {};
  const m = cfg.need_mult ?? 1.4;
  const fields = cfg.apply_to || ['die', 'survive', 'min', 'fenestrate', 'best_lo', 'best_hi'];
  const out = { ...th, variegated: true };
  for (const f of fields) if (out[f] != null) out[f] = +(out[f] * m).toFixed(2);
  if (out.max != null) out.max = +(out.max * (cfg.max_mult ?? 1)).toFixed(2);
  // 계수를 바꿨을 때 best_hi가 max를 넘어 밴드가 뒤집히는 걸 막는다.
  if (out.max != null && out.best_hi != null && out.best_hi > out.max) out.best_hi = out.max;
  return out;
}

/* ============================================================
   3. 광주기 — 연속점등 페널티
      24h 점등은 DLI만 보면 유리하지만 성장률이 떨어지고 잎이 황변한다.
      여기서는 '판정 재료'만 만든다. 누적은 생장 창 몫.
============================================================ */
export function photoperiod(hours, PH) {
  const h = Math.max(0, Math.min(24, hours || 0));
  const cfg = (PH && PH.continuous) || {};
  const bands = (PH && PH.bands) || {};
  let name = 'photo12', mult = 1;
  for (const [k, b] of Object.entries(bands)) {
    if (h >= b.hours_lo && h < b.hours_hi) { name = k; mult = b.growth_mult; }
  }
  if (h >= (bands.always ? bands.always.hours_lo : 22)) { name = 'always'; mult = bands.always ? bands.always.growth_mult : 0.65; }

  const continuous = h >= (cfg.trigger_hours ?? 22);
  return {
    hours: +h.toFixed(1),
    band: name,
    dark_hours: +(24 - h).toFixed(1),
    growth_mult: mult,
    /* ★ 연속광 장해 — 암기(暗期)가 없어서 생기는 손상. 광량 초과가 아니다.
       광량은 적정이어도 24h 켜면 걸린다. 해법은 차광이 아니라 타이머.
       걸리지 않으면 null. */
    continuous_injury: continuous ? {
      growth_mult: cfg.growth_mult ?? 0.65,
      chlorosis_per_day: cfg.chlorosis_per_day ?? 0.04,
      energy_mult: cfg.energy_mult_vs_12h ?? 2.0,
      reason: '연속점등 — 암기 부족(당 전류·호흡·조직 복구 저해, 일주기 교란)',
      fix: '타이머로 점등시간 12~16h로'
    } : null
  };
}

/* ============================================================
   4. ★ 계약 객체 — 하루 1회 생성해서 생장 창으로 넘긴다
      slots: [{ id, plantId, ppfd(식물등), point:{x,y,z}, normal, occIdx }]
============================================================ */
export function buildDailyLight(day, slots, wins, ctx = {}) {
  const {
    weather = 'clear', season = 'summer', region = 'default',
    clearSkyMax, occluders = null, lums = null,
    /* ★ glazed 를 빠뜨리고 있었다 — 계약 문서엔 넘기라고 적혀 있는데 함수가 버렸다.
       아파트 베란다 실내 유리(τ0.92)가 없는 것으로 계산돼 거실·안방 DLI 가
       실제보다 높게 나왔다. probe·main.js 는 daylightRatio 를 직접 부르며
       제대로 넘겼기 때문에 실측표는 영향이 없었다. (core-to-house 요청①) */
    glazed = null,
    litHours = 12, tariffWonPerKwh = 0, lampWatts = 0,
    thresholds = null
  } = ctx;

  const skyOpt = { weather, season, region, clearSkyMax, occluders, glazed };
  const evMax = skyEvMax(skyOpt);
  const PH = thresholds && thresholds.photoperiod;
  const photo = photoperiod(litHours, PH);

  const up = { x: 0, y: 1, z: 0 };
  const out = (slots || []).map(s => {
    const p = s.point || { x: s.x || 0, y: s.y || 0, z: s.z || 0 };
    const n = s.normal || up;
    const o = { ...skyOpt, selfIdx: s.occIdx };
    const ratio = daylightRatio(p, n, wins, o);
    const dliDay = daylightDLI(ratio, { ...skyOpt, selfIdx: s.occIdx });
    const ppfdLamp = s.ppfd != null ? s.ppfd
                   : (lums && lums.length ? pointIllum(p, n, lums, o) * LX_TO_PPFD : 0);
    const dliLamp = lampDLI(ppfdLamp, litHours);
    const dli = dliDay + dliLamp;
    /* ★ 무늬종이면 임계값이 통째로 위로 밀린다(need_mult 1.4). 같은 자리·같은 DLI라도
       무늬종은 '정체'인데 일반종은 '최적'일 수 있다 — 연구자가 온실을 필요로 하는 이유. */
    const varie = isVariegated(thresholds, s.plantId, s.variegated);
    const th = thresholdsFor(thresholds, s.plantId, varie);
    return {
      /* slotId = house.js가 준 안정 ID. 생장 창이 이걸로 화분을 기억한다.
         (예전엔 s.id 만 봐서 전부 undefined 였다) */
      slotId: s.slotId || s.id || null,
      plantId: s.plantId || null,
      point: p,
      variegated: varie,
      peak_lx: Math.round(ratio * evMax),
      dli: +dli.toFixed(2),
      dli_daylight: +dliDay.toFixed(2),
      dli_lamp: +dliLamp.toFixed(2),
      ...judgeDLI(dli, th)
    };
  });

  const kwh = lampWatts / 1000 * litHours;
  return {
    schema: 'daily_light/1',
    day: day ?? null,
    /* ── 환경. 지금 값이 있는 건 sky뿐. 나머지는 자리만(B-1 확장 축) ── */
    sky: {
      evMax: Math.round(evMax),
      weather, weather_ko: (WEATHER[weather] || {}).ko || weather,
      season,  season_ko:  (SEASON [season ] || {}).ko || season,
      region,  region_k:   (REGION [region ] || REGION.default).k,
      day_hours: dayLengthHours(season)
    },
    temp: null,               // ← 표준 난이도에서 채움
    humidity: null,           // ← 심화
    weatherPattern: null,     // ← 실전(지역 날씨 패턴)
    /* ── 광주기 ── */
    photoperiod: photo,
    continuous_injury: photo.continuous_injury,     // 최상위에도 노출(계약 필드)
    /* ── 비용 ── */
    energy: { watts: lampWatts, hours: litHours, kwh: +kwh.toFixed(3),
              won: Math.round(kwh * tariffWonPerKwh) },
    /* ── 슬롯별 결과 ── */
    slots: out,
    best: out.reduce((a, b) => (!a || b.dli > a.dli) ? b : a, null)
  };
}
