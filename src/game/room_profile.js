/* ============================================================
   game/room_profile.js — 방 프로파일로 도는 조도 포트 (core 소유)
   ------------------------------------------------------------
   **THREE·DOM·집 조립이 없다.** Node에서 그냥 돈다.

   왜 이게 필요한가 (2026-08-01, 밸런스 자동 시뮬 준비)
     시뮬은 계수를 흔들며 수십 번 돌린다. 그런데 매번 바뀌는 건 날씨·계절·등·계수뿐이고,
     **방의 기하는 안 바뀐다.** 조도 비율(ratio)은 천공 1lx당 그 지점이 받는 비율이라
     날씨·계절과 무관한 순수 기하값이다. 등 PPFD도 기구가 붙박이면 고정이다.
     → 방마다 한 번 `light_adapter.profile()` 로 뽑아 JSON으로 두고,
       시뮬은 그걸 읽어 `daily_light.js` + `weather.js` 만으로 하루를 낸다.

   ★ 물리식을 여기서 다시 쓰지 않는다. daylightDLI·lampDLI·judgeDLI 를 그대로 부른다 —
     시뮬과 게임이 다른 답을 내면 시뮬이 아무 의미가 없다.
============================================================ */
import { daylightDLI, lampDLI, judgeDLI, thresholdsFor, isVariegated }
  from '../engine/daily_light.js';
import { skyEvMax, WEATHER, SEASON, REGION } from '../engine/daylight_lux.js';
import { photoperiod } from '../engine/daily_light.js';
import { skyOf, seasonOf, setWeatherProbs } from '../engine/weather.js';
import { modeOf } from './state.js';
import { validateContract } from './contract.js';

export const PROFILE_SCHEMA = 'room_profile/1';

/* 프로파일을 io.light 로 쓸 수 있게 감싼다. loop.nextDay 가 그대로 돈다. */
export function createProfileLight(profile, data = {}) {
  if (!profile || profile.schema !== PROFILE_SCHEMA)
    throw new Error(`room_profile/1 이 아닙니다: ${profile && profile.schema}`);

  /* ★ 안정 slotId 계약 검사 (2026-08-02).
     프로파일의 slotId 는 세이브에 그대로 들어간다. 임시 uid 나 계약 이전 파일이면 멈춘다 —
     조용히 쓰면 나중에 house 가 uid 를 붙이는 순간 저장된 화분이 남의 자리로 간다. */
  if (profile.uidStable !== true)
    throw new Error(`[프로파일 거부] ${profile.room}: 안정 uid 계약(2026-08-02) 이전 파일입니다.\n` +
      `house 의 _profile_gen.html 로 다시 뽑아 주세요 (uidStable:true 가 찍힙니다).`);
  const temp = (profile.slots || []).filter(s => String(s.slotId).startsWith('TEMP~'));
  if (temp.length)
    throw new Error(`[프로파일 거부] ${profile.room}: 임시 uid 슬롯 ${temp.length}칸이 들어 있습니다.`);

  const wb = data.weatherBalance;
  if (wb && wb.weather) {
    const p = { clear: wb.weather.clear.p, cloudy: wb.weather.cloudy.p, rain: wb.weather.rain.p };
    setWeatherProbs({ spring: p, summer: p, autumn: p, winter: p });
  }
  const TH = data.lightTh || null;
  const tariff = data.tariffWonPerKwh ?? 0;

  const idx = (lampCount) => {
    const i = profile.lampCounts.indexOf(lampCount);
    return i >= 0 ? i : 0;         // 프로파일에 없는 개수면 0개로 떨어뜨린다(조용히 늘리지 않는다)
  };

  function skyFor(day, sim) {
    const m = modeOf({ sim });
    if (m.rollWeather && m.rollSeason) return skyOf(day, { seed: sim.seed });
    return {
      season: m.rollSeason ? seasonOf(day) : m.season,
      weather: m.rollWeather ? skyOf(day, { seed: sim.seed }).weather : m.weather
    };
  }

  /* 계약 객체를 프로파일에서 만든다 — buildDailyLight 과 같은 모양·같은 물리식 */
  function build(day, { weather, season, region = 'default', lampCount = 0, litHours = 12, pots = [] }) {
    const skyOpt = { weather, season, region };
    const evMax = skyEvMax(skyOpt);
    const li = idx(lampCount);
    const photo = photoperiod(litHours, TH && TH.photoperiod);

    const slots = profile.slots.map(s => {
      const pot = pots.find(p => p.slotId === s.slotId);
      const dliDay = daylightDLI(s.ratio, skyOpt);
      const dliLamp = lampDLI(s.ppfd[li] || 0, litHours);
      const dli = dliDay + dliLamp;
      const plantId = pot ? pot.plantId : null;
      const varie = isVariegated(TH, plantId, pot ? pot.variegated : undefined);
      return {
        slotId: s.slotId, plantId, point: s.point, variegated: varie,
        peak_lx: Math.round(s.ratio * evMax),
        dli: +dli.toFixed(2),
        dli_daylight: +dliDay.toFixed(2),
        dli_lamp: +dliLamp.toFixed(2),
        ...judgeDLI(dli, thresholdsFor(TH, plantId, varie))
      };
    });

    const watts = profile.lampWatts[li] || 0;
    const kwh = watts / 1000 * litHours;
    return {
      schema: 'daily_light/1',
      day: day ?? null,
      sky: {
        evMax: Math.round(evMax),
        weather, weather_ko: (WEATHER[weather] || {}).ko || weather,
        season, season_ko: (SEASON[season] || {}).ko || season,
        region, region_k: (REGION[region] || REGION.default).k,
        day_hours: (SEASON[season] || SEASON.summer).hours
      },
      temp: null, humidity: null, weatherPattern: null,
      photoperiod: photo,
      continuous_injury: photo.continuous_injury,
      energy: { watts, hours: litHours, kwh: +kwh.toFixed(3), won: Math.round(kwh * tariff) },
      slots,
      best: slots.reduce((a, b) => (!a || b.dli > a.dli) ? b : a, null)
    };
  }

  const cache = new Map();

  return {
    /* io.light 인터페이스 — light_adapter 와 같은 모양 */
    daily(day, S) {
      const sky = skyFor(day, S.sim);
      const report = build(day, { ...sky, lampCount: S.lamps.count,
                                  litHours: S.lamps.litHours, pots: S.pots });
      return { report, sky, check: validateContract(report) };
    },
    skyFor,
    dliOfSlot(slotId, { weather, season, lampCount, litHours }) {
      const key = `${slotId}|${weather}|${season}|${lampCount}|${litHours}`;
      if (cache.has(key)) return cache.get(key);
      const r = build(0, { weather, season, lampCount, litHours });
      const s = r.slots.find(x => x.slotId === slotId);
      const v = s ? s.dli : 0;
      cache.set(key, v);
      return v;
    },
    clearCache() { cache.clear(); },
    thresholdsOf: (plantId, varie) => thresholdsFor(TH, plantId, varie),
    get room() {
      return {
        id: profile.room,
        def: { label: profile.label, measured: profile.measured || {} },
        slots: profile.slots.map(s => ({ slotId: s.slotId, owner: s.owner,
                                         x: s.point.x, y: s.point.y, z: s.point.z })),
        dupSlots: []
      };
    },
    growLampCount: () => Math.max(...profile.lampCounts),
    rooms: () => [{ id: profile.room, label: profile.label, light: '' }],
    profile: () => profile
  };
}
