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
import { buildDailyLight, thresholdsFor, daylightRatio } from '../engine/daily_light.js';
import { ppfdSum } from '../render3d/lighting_sim.js';
import { skyOf, setWeatherProbs, seasonOf } from '../engine/weather.js';
import { modeOf } from './state.js';
import { validateContract } from './contract.js';

/* 검증은 contract.js 로 옮겼다(THREE 없이도 불러야 해서). 여기서 다시 내보내
   기존 호출부(`import { validateContract } from './light_adapter.js'`)는 안 깨진다. */
export { validateContract };

/* --------------------------------------------------------------- */
/* ★ 안정 slotId 계약 (2026-08-02 확정) — `{가구 uid}:{단}`
   ------------------------------------------------------------------
   slotId 는 세이브에 그대로 들어간다. 뿌리인 uid 가 흔들리면 저장된 화분이 남의 자리로 간다.

   ① **화분 슬롯을 내는 가구는 `house_rooms.json` 에 명시적 `uid` 가 있어야 한다.**
   ② 없으면 코어가 임시 uid 를 붙이되 **`TEMP~` 로 표시한다.** 조용히 메꾸지 않는다.
   ③ **영속 산출물(방 프로파일)은 임시 uid 가 하나라도 있으면 만들지 않고 오류를 던진다.**

   왜 전역 순번을 버렸나: 예전 fallback `{방}-{프리셋}-{전역순번}` 은 **가구 배열 순서에
   의존**했다. 다른 방에 가구가 하나 추가되면 뒤 번호가 통째로 밀려 이미 저장된 slotId 가
   다른 자리를 가리킨다. 임시 uid 도 방·인덱스로만 만들어 그 전파는 막았지만,
   그래도 인덱스가 바뀌면 흔들리므로 **임시일 뿐 해결이 아니다.** */
export const TEMP_UID = 'TEMP~';
const tempUid = (roomId, i, preset) => `${TEMP_UID}${roomId}#${i}~${preset || 'x'}`;

export function createLightEngine(data) {
  /* 명시 uid 가 없는 가구에만 표시된 임시 uid 를 붙인다(메모리 사본에만). */
  const roomsDef = (data.houseRooms && data.houseRooms.rooms) || {};
  for (const [rk, rv] of Object.entries(roomsDef))
    (rv.furniture || []).forEach((f, i) => { if (!f.uid) f.uid = tempUid(rk, i, f.preset); });

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
    /* ★ 9번째 인자 w.cz 를 빠뜨리면 안 된다 (2026-08-02 수정).
       천창은 지붕 전체가 아니라 부분 개구부라 z 중심이 0이 아니다(온실 cgZ0~cgZ1).
       안 넘기면 cv=0 으로 떨어져 천창이 방 한가운데로 밀리고, 그 아래 슬롯이 어두워진다.
       벽창은 cz 를 안 쓰므로 티가 안 나고 천창 있는 방(온실)에서만 어긋났다 —
       조용히 틀리는 유형이다. main.js·_dli_probe·_bj_* 는 전부 넘기고 있었고 코어만 빠져 있었다. */
    const wins = (built.luxWins || [])
      .map(w => winFromHouse(w.wall, w.cu, w.cy, w.w, w.h, built.size, w.tau, w.evScale, w.cz))
      .filter(Boolean);
    const slots = built.plantSlots || [];

    /* 5-4 검증 — 슬롯 ID가 겹치면 화분이 남의 자리 빛을 먹는다 */
    const seen = new Set(), dup = [];
    for (const s of slots) { if (seen.has(s.slotId)) dup.push(s.slotId); seen.add(s.slotId); }
    if (dup.length) console.warn('[빛] slotId 중복', dup);

    /* ★ 임시 uid 로 만들어진 슬롯 — 조용히 넘어가지 않는다(위 계약 ②) */
    const unstable = slots.filter(s => String(s.slotId).startsWith(TEMP_UID));
    if (unstable.length) {
      const byOwner = [...new Set(unstable.map(s => String(s.slotId).split(':')[0]))];
      console.error(`[빛] ★ 안정 slotId 아님 — ${roomId}: 슬롯 ${unstable.length}/${slots.length}칸이 ` +
        `임시 uid 위에 있습니다. house_rooms.json 의 해당 가구에 명시적 uid 가 필요합니다.\n  ` +
        byOwner.join('\n  '));
    }

    room = {
      id: roomId, def, built, wins, slots,
      growRigs: (built.lightRigs || []).filter(r => r.grow),
      dupSlots: dup,
      unstableSlots: unstable.map(s => s.slotId)
    };
    return room;
  }

  /* 방별로 "명시 uid 가 필요한 가구" 목록 — house 로 보낼 회신용 */
  function uidAudit(roomIds) {
    const out = {};
    for (const id of (roomIds || Object.keys(roomsDef))) {
      const before = room;
      build(id);
      const owners = new Map();
      for (const s of room.slots) {
        const uid = String(s.slotId).split(':')[0];
        if (!uid.startsWith(TEMP_UID)) continue;
        const m = uid.match(/^TEMP~.+?#(\d+)~(.*)$/);
        const key = uid;
        if (!owners.has(key)) owners.set(key, { idx: +m[1], preset: m[2], slots: 0, owner: s.owner });
        owners.get(key).slots++;
      }
      out[id] = { label: room.def.label || id, totalSlots: room.slots.length,
                  missing: [...owners.values()].sort((a, b) => a.idx - b.idx) };
      room = before;
    }
    return out;
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

  /* ---- ★ 방 프로파일 뽑기 (밸런스 자동 시뮬용, 2026-08-01) ----
     조도 기하는 방마다 고정이다. `ratio`(천공 1lx당 그 지점이 받는 비율)도,
     기구가 붙박이면 등 PPFD도 날씨·계절과 무관하다.
     → 방마다 한 번만 뽑아 두면, 시뮬은 THREE·집 조립 없이 DLI를 낼 수 있다.
       (수십 번 돌려야 하는데 매번 83슬롯 방을 조립할 이유가 없다)
     ⚠ 여기서는 glazed 를 넘긴다 — `buildDailyLight` 이 아직 안 받는다(core-to-house ①).
       그래서 아파트는 프로파일 쪽이 계약 쪽보다 낮게(정확하게) 나온다. house가 고치면 같아진다. */
  function profile(lampCounts = [0, 1, 2]) {
    /* ★ 계약 ③ — 영속 산출물은 임시 uid 위에 만들지 않는다.
       프로파일은 파일로 남아 세이브·밸런스 시뮬이 참조한다. 여기서 임시 id 를 굳히면
       나중에 house 가 uid 를 붙이는 순간 저장된 slotId 가 전부 어긋난다.
       조용히 보완하는 대신 여기서 멈춘다. */
    if (room.unstableSlots && room.unstableSlots.length) {
      const owners = [...new Set(room.unstableSlots.map(s => s.split(':')[0]))];
      throw new Error(
        `[프로파일 중단] ${room.id}: 슬롯 ${room.unstableSlots.length}칸이 임시 uid 위에 있습니다.\n` +
        `house_rooms.json 의 아래 가구에 명시적 uid 를 넣은 뒤 다시 뽑으세요 ` +
        `(화분 슬롯을 내는 가구는 uid 필수 — core-to-house.md 참고):\n  ` + owners.join('\n  '));
    }
    const up = { x: 0, y: 1, z: 0 };
    const counts = lampCounts.filter(n => n <= room.growRigs.length);
    return {
      schema: 'room_profile/1',
      room: room.id,
      label: room.def.label || room.id,
      uidStable: true,
      roomRev: (room.def.measured && room.def.measured.roomRev) || null,
      lampCounts: counts,
      lampWatts: counts.map(n => rigsOn(n).reduce((a, r) => a + ((r.fx && r.fx.watts) || 0), 0)),
      measured: room.def.measured || null,
      slots: room.slots.map(s => {
        const point = { x: s.x, y: s.y, z: s.z };
        const opt = { occluders: room.built.occluders, glazed: room.built.glazedPanes,
                      selfIdx: s.occIdx };
        return {
          slotId: s.slotId, owner: s.owner, point,
          ratio: +daylightRatio(point, up, room.wins, opt).toPrecision(6),
          ppfd: counts.map(n => +ppfdSum(rigsOn(n), point).toFixed(2))
        };
      })
    };
  }

  return {
    build, daily, skyFor, dliOfSlot, clearCache, profile, uidAudit,
    get room() { return room; },
    rooms: () => Object.entries(data.houseRooms.rooms || {})
                   .map(([id, r]) => ({ id, label: r.label || id, light: r.light || '' })),
    growLampCount: () => (room ? room.growRigs.length : 0),
    /* 그 식물의 임계값 (갈라짐 문턱 등). 값은 plan 소유 JSON에서만 온다. */
    thresholdsOf: (plantId, varie) => thresholdsFor(data.lightTh, plantId, varie)
  };
}
