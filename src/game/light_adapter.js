/* ============================================================
   game/light_adapter.js — house 경계 (core 소유)
   ------------------------------------------------------------
   집·조도 창(src/engine/* · src/render3d/*)을 부르는 곳은 여기 하나뿐이다.
   house가 인터페이스를 바꾸면 고칠 파일이 이 하나로 고정된다.

   하는 일
     ① 방 조립 1회 → wins·plantSlots·grow 기구 캐시 (하루마다 다시 조립하지 않는다)
     ② 하루 1회 buildDailyLight 호출
     ③ ★ 계약 객체 검증 — NaN·음수·무한대·밴드 이상 (지시 5-3)
     ④ 날씨 확률을 data/balance/weather.json(plan 소유)에서 읽어 weather.js에 주입

   ★ 이 파일에 밸런싱 숫자를 두지 않는다. 확률·임계값·요금은 전부 JSON에서 온다.
============================================================ */
import { buildHouse } from '../render3d/house.js';
import { faintGrainTexture } from '../render3d/textures.js';
import { winFromHouse } from '../engine/daylight_lux.js';
import { buildDailyLight, BANDS, thresholdsFor } from '../engine/daily_light.js';
import { ppfdSum } from '../render3d/lighting_sim.js';
import { skyOf, setWeatherProbs, seasonOf } from '../engine/weather.js';
import { modeOf } from './state.js';

/* ---------------------------------------------------------------
   계약 객체 검증 — growth로 넘기기 전에 코어가 한 번 더 본다.
   rng() < NaN 은 오류도 없이 항상 false라 무늬·갈라짐이 영영 안 나온다.
   조용히 죽는 종류라, 값이 이상하면 넘기지 않고 화면에 띄운다.
--------------------------------------------------------------- */
export function validateContract(report) {
  const problems = [];
  if (!report || report.schema !== 'daily_light/1') {
    problems.push(`계약 스키마가 아닙니다: ${report && report.schema}`);
    return { ok: false, problems, badSlots: new Set() };
  }
  const badSlots = new Set();
  const num = (v) => typeof v === 'number' && isFinite(v) && v >= 0;

  for (const s of report.slots || []) {
    for (const k of ['dli', 'dli_daylight', 'dli_lamp']) {
      if (!num(s[k])) { problems.push(`${s.slotId} · ${k}=${s[k]}`); badSlots.add(s.slotId); }
    }
    /* 밴드 이름에 로직을 걸지 않는다(개칭 진행 중). 목록에 있는지만 본다. */
    if (s.band !== 'unknown' && !BANDS.includes(s.band)) {
      problems.push(`${s.slotId} · 모르는 밴드 "${s.band}"`);
    }
  }
  if (!report.best) problems.push('best 슬롯이 없습니다 (슬롯 0개?)');
  return { ok: problems.length === 0, problems, badSlots };
}

/* --------------------------------------------------------------- */
export function createLightEngine(data) {
  /* ★ 가구 uid — slotId의 뿌리다. 없으면 전부 'x:0' 으로 겹쳐 화분 매칭이 무너진다.
     src/main.js 와 같은 규칙으로 붙인다(메모리 상의 사본에만). */
  let seq = 0;
  for (const [rk, rv] of Object.entries((data.houseRooms && data.houseRooms.rooms) || {}))
    for (const f of (rv.furniture || [])) if (!f.uid) f.uid = rk + '-' + (f.preset || 'x') + '-' + (++seq);

  /* 날씨 확률은 plan 소유값이다. 코어가 표를 들지 않는다 — 창마다 다른 표를 들다가
     같은 날 날씨가 갈렸던 게 이번 사고의 뿌리였다(weather.json _doc). */
  const wb = data.weatherBalance;
  if (wb && wb.weather) {
    const p = { clear: wb.weather.clear.p, cloudy: wb.weather.cloudy.p, rain: wb.weather.rain.p };
    setWeatherProbs({ spring: p, summer: p, autumn: p, winter: p });
  } else {
    console.warn('[빛] data/balance/weather.json 을 못 읽었습니다 — weather.js 기본 확률로 돕니다');
  }

  const tariff = ((data.lightPresets || {}).tariff || {}).krw_per_kwh ?? 0;
  const GRAIN = faintGrainTexture();
  let room = null;

  /* ---- 방 조립 (방을 바꿀 때만) ---- */
  function build(roomId) {
    const def = (data.houseRooms.rooms || {})[roomId];
    if (!def) throw new Error(`모르는 방: ${roomId}`);
    const built = buildHouse(GRAIN, def, data.winPresets, data.doorPresets, data.finishes,
                             data.furnPresets, data.lightPresets, data.shadePresets);
    const wins = (built.luxWins || [])
      .map(w => winFromHouse(w.wall, w.cu, w.cy, w.w, w.h, built.size, w.tau, w.evScale))
      .filter(Boolean);
    const slots = built.plantSlots || [];

    /* 5-4 검증 — 슬롯 ID가 겹치면 화분이 남의 자리 빛을 먹는다 */
    const seen = new Set(), dup = [];
    for (const s of slots) { if (seen.has(s.slotId)) dup.push(s.slotId); seen.add(s.slotId); }
    if (dup.length) console.warn('[빛] slotId 중복', dup);

    room = {
      id: roomId, def, built, wins, slots,
      growRigs: (built.lightRigs || []).filter(r => r.grow),
      dupSlots: dup
    };
    return room;
  }

  /* ---- 그날의 하늘. 모드에 따라 굴리거나 고정한다 ---- */
  function skyFor(day, sim) {
    const m = modeOf({ sim });
    if (m.rollWeather && m.rollSeason) return skyOf(day, { seed: sim.seed });
    return {
      season: m.rollSeason ? seasonOf(day) : m.season,
      weather: m.rollWeather ? skyOf(day, { seed: sim.seed }).weather : m.weather
    };
  }

  /* ---- 켤 식물등. 방에 놓인 grow 기구를 앞에서부터 n개 ---- */
  function rigsOn(count) { return room.growRigs.slice(0, Math.max(0, count | 0)); }

  /* ---- 슬롯 배열 만들기: 화분 정보 + 그 자리 식물등 PPFD ---- */
  function slotsFor(pots, rigs) {
    return room.slots.map(s => {
      const p = (pots || []).find(x => x.slotId === s.slotId);
      const point = { x: s.x, y: s.y, z: s.z };
      return {
        ...s, point,
        plantId: p ? p.plantId : null,
        variegated: p ? p.variegated : undefined,
        /* 거리 감쇠는 house의 lighting_sim이 한다. 코어는 PPFD를 지어내지 않는다.
           0을 명시해 넘긴다 — null이면 계약이 lums 경로로 새로 계산한다. */
        ppfd: rigs.length ? +ppfdSum(rigs, point).toFixed(2) : 0
      };
    });
  }

  function ctxFor(sky, rigs, litHours) {
    return {
      weather: sky.weather, season: sky.season, region: 'default',
      occluders: room.built.occluders,
      /* ⚠ 지금 daily_light.js 는 glazed 를 쓰지 않는다(core-to-house.md 참고).
         계약 문서에는 넘기라고 되어 있어 넘겨 둔다 — house가 반영하면 그날부터 맞는다. */
      glazed: room.built.glazedPanes,
      thresholds: data.lightTh,
      litHours,
      lampWatts: rigs.reduce((a, r) => a + ((r.fx && r.fx.watts) || 0), 0),
      tariffWonPerKwh: tariff
    };
  }

  /* ---- ★ 하루 1회 ---- */
  function daily(day, S) {
    const sky = skyFor(day, S.sim);
    const rigs = rigsOn(S.lamps.count);
    const report = buildDailyLight(day, slotsFor(S.pots, rigs), room.wins,
                                   ctxFor(sky, rigs, S.lamps.litHours));
    return { report, sky, check: validateContract(report) };
  }

  /* ---- 검수용: 날씨·계절을 지정해 그 슬롯의 DLI만 뽑는다 (weekStats 재료) ----
     같은 (weather, season, 등 개수)면 값이 같으므로 캐시한다. */
  const _cache = new Map();
  function dliOfSlot(slotId, { weather, season, lampCount, litHours }) {
    const key = `${slotId}|${weather}|${season}|${lampCount}|${litHours}`;
    if (_cache.has(key)) return _cache.get(key);
    const rigs = rigsOn(lampCount);
    const slots = slotsFor([{ slotId, plantId: null }], rigs);
    const rep = buildDailyLight(0, slots, room.wins, ctxFor({ weather, season }, rigs, litHours));
    const s = rep.slots.find(x => x.slotId === slotId);
    const v = s ? s.dli : 0;
    _cache.set(key, v);
    return v;
  }
  function clearCache() { _cache.clear(); }

  return {
    build, daily, skyFor, dliOfSlot, clearCache,
    get room() { return room; },
    rooms: () => Object.entries(data.houseRooms.rooms || {})
                   .map(([id, r]) => ({ id, label: r.label || id, light: r.light || '' })),
    growLampCount: () => (room ? room.growRigs.length : 0),
    /* 그 식물의 임계값 (갈라짐 문턱 등). 값은 plan 소유 JSON에서만 온다. */
    thresholdsOf: (plantId, varie) => thresholdsFor(data.lightTh, plantId, varie)
  };
}
