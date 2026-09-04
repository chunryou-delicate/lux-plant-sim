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

   ★ 여기는 **슬롯 그대로 둔다** — 자유 좌표를 안 밀어 넣는다 (2026-08-03 · 의도된 경계).
     프로파일은 방마다 한 번 뽑아 파일로 굳힌 **슬롯별 ratio 표**다. 임의 좌표의 ratio 는
     그 표에 없고, 즉석에서 내려면 창 기하와 차폐체를 다시 들여야 한다 — 그러면 이 파일이
     daylight_lux 를 통째로 import 하게 되고 "THREE·집 조립 없이 돈다"는 존재 이유가 사라진다.
     밸런스 시뮬은 '이 방이 이만큼 밝다'를 수십 번 굴려 보는 도구라 슬롯 표본으로 충분하다.
     자유 좌표가 필요한 경로(게임 화면·배치 미리보기)는 라이브 엔진(light_adapter.dliAt)을 쓴다.

   ★ 콩나물 시루도 같은 경계를 따른다 (2026-08-03).
     시루를 **슬롯에 놓은** 세이브는 여기서 그대로 돈다 — slotId 가 표에 있으니 계약에 실린다.
     자유 좌표로 놓은 시루는 실리지 않고, `cropDliFromReport` 가 "오늘 계약에 없다"고 **던진다.**
     조용히 0(=암흑)을 내지 않는 게 중요하다 — 그러면 헤드리스 밸런스 결과가 이유 없이 3끼가 된다.
     헤드리스 시뮬은 지금도 슬롯으로만 시루를 놓는다(data/profiles/*.json 은 슬롯 그대로).
============================================================ */
import { daylightDLI, lampDLI, judgeDLI, thresholdsFor, isVariegated }
  from '../engine/daily_light.js';
import { skyEvMax, WEATHER, SEASON, REGION } from '../engine/daylight_lux.js';
import { photoperiod } from '../engine/daily_light.js';
import { skyOf, seasonOf, setWeatherProbs } from '../engine/weather.js';
import { modeOf, placedItems } from './state.js';
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
  /* ★ maxPotD 결측 경고 — 던지지는 않는다(옛 프로파일도 조도 재생에는 쓸 수 있다).
     다만 물리 필터를 쓰는 경로(첫 플레이 배치)는 이 값이 없으면 후보 0칸으로 떨어져 멈춘다.
     그게 조용히 아무 자리에나 놓는 것보다 낫다 — 어디가 문제인지 여기서 이름을 부른다. */
  const noDim = (profile.slots || []).filter(s => !Number.isFinite(s.maxPotD));
  if (noDim.length)
    console.warn(`[프로파일] ${profile.room}: maxPotD 가 없는 슬롯 ${noDim.length}/${profile.slots.length}칸 ` +
                 `— 화분 배치 물리 필터를 쓸 수 없습니다(light_adapter.profile 직렬화 필요)`);

  const temp = (profile.slots || []).filter(s => String(s.slotId).startsWith('TEMP~'));
  if (temp.length)
    throw new Error(`[프로파일 거부] ${profile.room}: 임시 uid 슬롯 ${temp.length}칸이 들어 있습니다.`);
  /* 중복 slotId — 뽑을 때 걸렀어야 하지만, 손으로 편집된 파일이 올 수 있으므로 로더도 본다 */
  const seen = new Set(), dup = [];
  for (const s of profile.slots || []) { if (seen.has(s.slotId)) dup.push(s.slotId); seen.add(s.slotId); }
  if (dup.length)
    throw new Error(`[프로파일 거부] ${profile.room}: slotId 가 ${dup.length}칸 겹칩니다 — ` +
      `${[...new Set(dup)].slice(0, 5).join(', ')}`);

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
    /* ★★ 게임 날짜 → **연중 날짜** (2026-08-05 · 달력이 둘이던 것을 하나로).
       화면은 여름 45일차(연중 135일)에서 시작하는데 여기서는 `seasonOf(day)` 를 그냥 써서
       0일을 **봄 0일**로 봤다. 그래서 게임 50일이 화면엔 가을, 빛엔 봄이었다.
       ⇒ 상태가 실어 주는 `sim.yearDay0` 만 더한다. 빛이 튜토리얼을 알 필요는 없다 —
         "우리 0일은 연중 N일이다" 한 줄이면 된다(state.js §yearDay0 · tutorial.yearDay0Of).
       ⚠ 없으면 0이다 = 옛 동작 그대로. 옛 세이브·옛 호출부가 안 깨진다.
       ⚠ 날씨(`skyOf`)에도 같은 축을 준다 — 날씨만 옛 축이면 "봄 날씨가 가을에 온다"가 된다. */
    const Y = (sim && Number.isFinite(sim.yearDay0)) ? sim.yearDay0 : 0;
    const yd = Math.max(0, day) + Y;
    if (m.rollWeather && m.rollSeason) return skyOf(yd, { seed: sim.seed });
    return {
      season: m.rollSeason ? seasonOf(yd) : m.season,
      weather: m.rollWeather ? skyOf(yd, { seed: sim.seed }).weather : m.weather
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
        /* ★ 물리 치수를 정적 경로에도 실어 보낸다 (2026-08-02).
           라이브(light_adapter)는 house 의 plantSlots.maxPotD 를 그대로 쓰는데 프로파일이
           이 값을 안 실으면, 같은 방인데 **정적 경로만 물리 필터가 통째로 빠진다** —
           화분이 못 올라가는 자리에 조용히 놓인다. 없으면 null 로 두고 소비 쪽이 막는다. */
        maxPotD: Number.isFinite(s.maxPotD) ? s.maxPotD : null,
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
      /* 놓인 것 전부를 넘긴다(라이브 포트와 같은 목록). 다만 여기서 실제로 쓰이는 것은
         **표에 있는 slotId 를 가진 것뿐**이다 — 위 주석의 경계다. */
      const report = build(day, { ...sky, lampCount: S.lamps.count,
                                  litHours: S.lamps.litHours, pots: placedItems(S) });
      return { report, sky, check: validateContract(report) };
    },
    skyFor,
    /* ref 는 slotId 문자열 또는 화분 객체({slotId, at}) — 라이브 포트와 인자 모양을 맞춘다.
       ⚠ 여기서는 `at` 을 **안 본다.** 위 주석대로 정적 표에는 임의 좌표가 없다.
         자유 좌표 화분을 이 경로로 돌리면 그 화분의 slotId(`free:…`)가 표에 없어 0 이 나온다. */
    /* ★★★★ 2026-09-02 — **좌표 조도 계약 «D»(박사님): 헤드리스는 «모른다고 던진다».** ([house] 청 · docs/engine/floor_light_contract.md)
       ⛔ 여태 표에 없는 자리를 물으면 «0» 을 돌려줬다. 그 0 이 「어둡다」로 읽혀 — 콩나물 최상 대역은 하한이 없어
         «최상»이 되고, 다른 판정은 «어둡다»로 갔다. 「모른다」와 「0」은 다른 말이다.
       ⇒ ★ `cropDliFromReport`(first_play · 302a4fe)가 이미 같은 뜻으로 던진다 — 그 결을 «한 층 아래»로 내린다.
       ⚠ 자유 좌표(`at`)는 정적 표에 «없다». 바닥 표가 필요하면 «브라우저 자로만» 낸다(계약 D).
       ⚠ loop.js §cropLightOf 는 try/catch 라 던지면 「판정하지 않는다」(null)로 떨어진다 — 0 이 아니라 «모름»이다. */
    dliOfSlot(ref, { weather, season, lampCount, litHours }) {
      const at = (ref && typeof ref === 'object') ? ref.at : null;
      const slotId = (ref && typeof ref === 'object') ? ref.slotId : ref;
      if (at || (slotId != null && String(slotId).startsWith('free:')))
        throw new Error(`[정적 프로필] 자유 좌표 자리 ${slotId} 의 조도는 모른다 — 바닥 표는 브라우저 자로만 낸다(계약 D)`);
      const key = `${slotId}|${weather}|${season}|${lampCount}|${litHours}`;
      if (cache.has(key)) return cache.get(key);
      const r = build(0, { weather, season, lampCount, litHours });
      const s = r.slots.find(x => x.slotId === slotId);
      if (!s) throw new Error(`[정적 프로필] 자리 ${slotId} 가 표에 없다 — 0 이 아니라 모른다(계약 D)`);
      const v = s.dli;
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
                                         x: s.point.x, y: s.point.y, z: s.point.z,
                                         maxPotD: Number.isFinite(s.maxPotD) ? s.maxPotD : null })),
        dupSlots: []
      };
    },
    growLampCount: () => Math.max(...profile.lampCounts),
    rooms: () => [{ id: profile.room, label: profile.label, light: '' }],
    profile: () => profile
  };
}
