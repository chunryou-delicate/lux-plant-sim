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
import { ppfdSum, aimVector } from '../render3d/lighting_sim.js';
import { skyOf, setWeatherProbs, seasonOf } from '../engine/weather.js';
import { modeOf, placedItems } from './state.js';
import { validateContract } from './contract.js';
import { assertAt, assertFurnitureAt, freeSlotId, isFreeSlotId,
         nearestSlot, samePoint } from './place.js';

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

  /* ★ 가구 덮어쓰기 표 — `{ <uid>: {x, z, rot, y?} }` (2026-08-03)
     플레이어가 옮긴 가구만 담는다(= S.home.furniture 와 같은 모양).
     ⚠ **data/house_rooms.json 파일은 절대 안 고친다.** 조립 직전에 메모리 사본 위에만 얹는다 —
       그래야 "기본값 + 차이" 로 남고, 세이브를 지우면 원래 방으로 돌아온다. */
  let furnOverrides = {};

  /* ★★★★ 2026-08-30 — **판 가구를 걷고 산 가구를 더한다** (furnishop-to-plan §9)
     ══════════════════════════════════════════════════════════════════
     ⚠ `state.js` 가 `S.home.furnitureSold` · `furnitureAdded` 두 칸을 두면서 이렇게 적어 뒀다:
       *"이 둘을 조립에 실제로 먹이는 일은 `light_adapter` 몫이고 그 파일은 이번 창의 쓰기 영역
         밖이다. ★ 안 붙이면 **상태·세이브는 맞는데 화면은 안 바뀐다.**"*
       ⇒ ⇒ 그 줄이 2026-08-30 까지 **안 붙어 있었다**(전문 검색 0건). 그동안 가구를 사고 팔면
         상태만 바뀌고 방은 그대로였다. **오늘 원룸 이사가 그 벽에 부딪혔다.**
     ★ 규약은 `furnOverrides` 와 같다 — **플레이어가 실제로 한 것만** 담고,
       `data/house_rooms.json` 은 **한 글자도 안 고친다.** 조립 직전 사본 위에만 얹는다.
     ⚠⚠ 걷으면 **그림자(`occluders`)와 자리(`plantSlots`)가 «같이»** 없어진다([House] 짚음).
       하나만 되면 조용히 틀린다 — 「가구를 걷었는데 그 위 자리가 남아 있다」가 그 꼴이다.
       ⇒ ★ 그래서 여기서 **`def.furniture` 하나만** 고친다. 아래 `buildHouse` 가 둘 다 그 목록에서 짓는다. */
  let furnSold = [], furnAdded = [];

  /* 덮어쓰기를 얹은 **사본**을 만든다. 원본 def 는 손대지 않는다(되돌릴 수 있어야 한다). */
  function defWithOverrides(def) {
    const ids = Object.keys(furnOverrides);
    if (!ids.length && !furnSold.length && !furnAdded.length) return def;
    if (!def.furniture) return def;
    const lay = (f) => { const o = f.uid ? furnOverrides[f.uid] : null; return o ? { ...f, ...o } : f; };
    const base = def.furniture.filter(f => !furnSold.includes(f.uid)).map(lay);   /* 판 것을 걷는다 */
    return { ...def, furniture: [...base, ...furnAdded.map(lay)] };               /* 산 것을 더한다 */
  }

  /* 세이브·상태에서 읽은 두 목록을 통째로 얹는다. 방을 다시 조립해야 반영된다.
     ⚠ `setFurnitureOverrides` 와 **같은 결**이다 — 지어내지 않고 받은 것만 담는다. */
  function setFurnitureEdits(sold, added, { rebuild = true } = {}) {
    furnSold  = Array.isArray(sold) ? sold.filter(x => typeof x === 'string') : [];
    furnAdded = Array.isArray(added) ? added.map(f => ({ ...f })) : [];
    for (const f of furnAdded)
      if (!f || !f.uid || !f.preset)
        throw new Error('[가구] 산 가구에는 uid 와 preset 이 있어야 합니다: ' + JSON.stringify(f));
    if (rebuild && room) build(room.id);
    return { sold: [...furnSold], added: furnAdded.map(f => ({ ...f })) };
  }

  /* ---- 방 조립 (방을 바꿀 때만) ---- */
  function build(roomId) {
    const raw = (data.houseRooms.rooms || {})[roomId];
    if (!raw) throw new Error(`모르는 방: ${roomId}`);
    const def = defWithOverrides(raw);
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

    /* ★ 5-4 검증 — slotId 가 겹치면 화분이 남의 자리 빛을 먹는다.
       원인은 대개 **서로 다른 가구에 같은 uid 를 적은 것**이다(복사·붙여넣기).
       경고로 두면 아무도 안 본다 — 겹친 uid 와 그 가구를 같이 찍는다. */
    const seen = new Set(), dup = [];
    for (const s of slots) { if (seen.has(s.slotId)) dup.push(s.slotId); seen.add(s.slotId); }
    if (dup.length) {
      const uids = [...new Set(dup.map(d => String(d).split(':')[0]))];
      console.error(`[빛] ★ slotId 중복 — ${roomId}: ${dup.length}칸이 겹칩니다. ` +
        `겹친 uid: ${uids.join(', ')}\n` +
        `  house_rooms.json 에서 이 uid 를 쓰는 가구가 둘 이상입니다. uid 는 가구마다 달라야 합니다.`);
    }

    /* ★ 임시 uid 로 만들어진 슬롯 — 조용히 넘어가지 않는다(위 계약 ②) */
    const unstable = slots.filter(s => String(s.slotId).startsWith(TEMP_UID));
    if (unstable.length) {
      const byOwner = [...new Set(unstable.map(s => String(s.slotId).split(':')[0]))];
      console.error(`[빛] ★ 안정 slotId 아님 — ${roomId}: 슬롯 ${unstable.length}/${slots.length}칸이 ` +
        `임시 uid 위에 있습니다. house_rooms.json 의 해당 가구에 명시적 uid 가 필요합니다.\n  ` +
        byOwner.join('\n  '));
    }

    /* ★ 자유 좌표가 쓰는 두 가지 (2026-08-03)
         size      방 경계 — 좌표가 방 밖이면 던지는 기준
         surfaces  지금 이 방에 있는 가구 uid 들 — 화분이 올라앉은 가구가 사라졌는지 본다
       slotId 가 `{uid}:{단}` 이라 슬롯에서도 uid 를 되뽑을 수 있지만, 슬롯을 안 내는
       가구(침대·서랍장) 위에도 화분을 놓을 수 있으므로 가구 목록 쪽이 정본이다. */
    const surfaces = new Set();
    for (const f of (def.furniture || [])) if (f.uid) surfaces.add(f.uid);
    for (const s of slots) {
      const cut = String(s.slotId).lastIndexOf(':');
      if (cut > 0) surfaces.add(String(s.slotId).slice(0, cut));
    }

    room = {
      id: roomId, def, built, wins, slots,
      size: built.size,
      surfaces,
      growRigs: (built.lightRigs || []).filter(r => r.grow),
      dupSlots: dup,
      unstableSlots: unstable.map(s => s.slotId)
    };
    _cache.clear();
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

  /* ---- 그날의 하늘. 모드에 따라 굴리거나 고정한다 ----
     ★★ `sim.yearDay0` — 게임 0일이 연중 며칠인가 (2026-08-05).
       `room_profile.skyFor` 와 **글자 그대로 같은 규칙**이다. 둘이 갈리면 라이브 화면과
       헤드리스 검사가 다른 계절을 보게 되고, 그건 재현이 안 되는 유형의 고장이다.
       왜 이렇게 고쳤는지는 `room_profile.js` 의 같은 자리 주석에 적어 두었다. */
  function skyFor(day, sim) {
    const m = modeOf({ sim });
    const Y = (sim && Number.isFinite(sim.yearDay0)) ? sim.yearDay0 : 0;
    const yd = Math.max(0, day) + Y;
    if (m.rollWeather && m.rollSeason) return skyOf(yd, { seed: sim.seed });
    return {
      season: m.rollSeason ? seasonOf(yd) : m.season,
      weather: m.rollWeather ? skyOf(yd, { seed: sim.seed }).weather : m.weather
    };
  }

  /* ★ 겨누기 표 — `{ <등 uid>: {yaw, tilt} }` (2026-08-06 · docs/growlight_aim.md §2)
     가구 덮어쓰기(furnOverrides)와 **같은 규약**이다: 플레이어가 실제로 겨눈 등만 담는다.
     비어 있으면 data 의 기본 상태 = 안 겨눔이고, 그때 물리는 옛 식과 비트 단위로 같다. */
  let lampAims = {};

  /* 그 등을 겨눌 수 있나. 못 겨누는 등이면 왜 못 겨누는지까지 말한다. */
  function aimRangeOf(uid) {
    if (!room) throw new Error('[조도] 방을 아직 조립하지 않았습니다');
    const rig = room.growRigs.find(r => r.uid === uid)
             || (room.built.lightRigs || []).find(r => r.uid === uid);
    if (!rig) throw new Error(`[겨누기] 모르는 등 uid: ${uid} (방 ${room.id})`);
    return rig.aimRange;
  }

  /* ---- ★ 등 겨누기 (2026-08-06 · docs/growlight_aim.md §2) ----
     yaw  좌우(도)   tilt 똑바로 아래에서 꺾어 올린 각(도, 0 = 수직 아래)

     검사(checkAim)와 쓰기(setLampAim)를 갈라 뒀다 — setLampAims 가 **전부 검사한 뒤에**
     한 번에 얹어야 하기 때문이다.

     ⚠ **못 겨누는 등은 조용히 무시하지 않고 던진다.** 무시하면 화면은 손잡이를 보여 주는데
       빛이 안 움직이고, 세이브에는 값이 남아 "겨눴는데 안 먹는" 상태가 굳는다.
       바 등이 못 도는 것은 버그가 아니라 설계(§2)라 크게 말해야 한다.
       화면은 lampList() 의 aimable:false 를 보고 손잡이를 아예 안 그리면 된다 —
       던지기는 배선이 틀렸을 때의 안전망이지 평소 경로가 아니다. */

  /* 검사만 한다 — 통과하면 정규화된 {yaw, tilt}, 아니면 던진다. 아무것도 안 바꾼다. */
  function checkAim(uid, aim) {
    const range = aimRangeOf(uid);
    if (!range)
      throw new Error(`[겨누기] ${uid} 는 겨눌 수 없는 등입니다 — 붙박이라 머리가 안 돌아갑니다 ` +
        `(data/lighting_presets.json 에 aim 이 없습니다). docs/growlight_aim.md §2 참고.`);
    /* ⚠ `Number(x) || 0` 로 쓰면 안 된다 — NaN 도 0 이 되어 아래 검사가 영영 안 걸린다.
       안 준 것(null·undefined)만 0 이고, 준 것이 숫자가 아니면 **던진다.** */
    const ry = aim == null ? null : aim.yaw, rt = aim == null ? null : aim.tilt;
    const yaw = ry == null ? 0 : Number(ry), tilt = rt == null ? 0 : Number(rt);
    if (!Number.isFinite(yaw) || !Number.isFinite(tilt))
      throw new Error(`[겨누기] ${uid}: yaw·tilt 가 유한한 숫자가 아닙니다 (${ry}, ${rt})`);
    if (Math.abs(yaw) > range.yaw)
      throw new Error(`[겨누기] ${uid}: yaw ${yaw}° 는 범위 밖입니다 (±${range.yaw}°)`);
    if (tilt < range.tiltMin || tilt > range.tiltMax)
      throw new Error(`[겨누기] ${uid}: tilt ${tilt}° 는 범위 밖입니다 (${range.tiltMin}~${range.tiltMax}°)`);
    return { yaw, tilt };
  }

  function setLampAim(uid, aim) {
    lampAims[uid] = checkAim(uid, aim);
    _cache.clear();
    return lampAims[uid];
  }

  /* 겨누기를 푼다 — 다시 "안 겨눔"이 되어 옛 대칭 모형으로 돌아간다. */
  function clearLampAim(uid) {
    const had = uid in lampAims;
    delete lampAims[uid];
    _cache.clear();
    return had;
  }

  /* 세이브에서 읽은 표를 통째로 얹는다.
     ★ **전부 검사한 뒤에 얹는다** — 한 칸이라도 틀리면 아무것도 안 바뀐 채로 던진다.
       반쯤 얹고 던지면 "세이브는 못 읽었는데 등은 일부 돌아간" 상태가 남는다. */
  function setLampAims(map) {
    const next = {};
    for (const [uid, a] of Object.entries(map || {})) next[uid] = checkAim(uid, a);
    lampAims = next;
    _cache.clear();
    return { ...lampAims };
  }

  /* UI 가 쓸 목록 — 어느 등을 얼마나 돌릴 수 있고 지금 어디를 보고 있나 */
  function lampList() {
    if (!room) throw new Error('[조도] 방을 아직 조립하지 않았습니다');
    return room.growRigs.map((r, i) => ({
      uid: r.uid, preset: r.id, idx: i, pos: { ...r.pos },
      aimable: !!r.aimRange, range: r.aimRange ? { ...r.aimRange } : null,
      aim: lampAims[r.uid] ? { ...lampAims[r.uid] } : null
    }));
  }

  /* ---- 켤 식물등. 방에 놓인 grow 기구를 앞에서부터 n개 ----
     ★ 겨눈 등에만 `aim` 을 실어 보낸다. 안 겨눈 등은 `aim` 이 아예 없고, 그러면
       lighting_sim.ppfdSum 이 옛 대칭 모형 그대로 돈다(= 회귀). 축이 생긴 등만
       원뿔이 되어 뒤쪽을 안 비춘다 — 왜 이렇게 갈랐는지는 ppfdSum 주석에 잰 숫자로 적어 두었다. */
  function rigsOn(count) {
    const list = room.growRigs.slice(0, Math.max(0, count | 0));
    return list.map(r => {
      const a = lampAims[r.uid];
      return a ? { ...r, aim: aimVector(a.yaw, a.tilt) } : r;
    });
  }

  /* ---- 슬롯 배열 만들기: 놓인 것 + 그 자리 식물등 PPFD ----
     ★ 추천 자리(room.slots)와 **자유 좌표로 놓인 것**을 같은 모양으로 낸다 (2026-08-03).
       물리는 하나다 — daylightRatio 도 ppfdSum 도 처음부터 임의 좌표를 받았다.
       달라지는 건 '어느 점을 넣느냐'뿐이라, 여기서 점 목록만 늘리면 끝난다.

     ★ 인자 이름이 `pots` 지만 **화분 전용이 아니다** — 콩나물 시루도 같은 모양으로 들어온다
       (state.placedItems). 여기서 보는 건 `{id, slotId, at, plantId, variegated}` 뿐이라,
       "무엇인가"를 조도 쪽이 알 필요가 없다. 종류마다 분기를 만들면 물건이 늘 때마다 여기가 는다. */
  function slotsFor(pots, rigs) {
    const list = pots || [];
    const onSlot = new Map();          // 추천 자리 위에 앉은 것: slotId → 그 물건
    const free = [];                   // 슬롯을 벗어난 것

    for (const p of list) {
      if (!p) continue;
      const s = p.slotId ? room.slots.find(x => x.slotId === p.slotId) : null;
      if (!p.at) {                     // 좌표 없는 옛 화분 — 예전처럼 slotId 로 돈다
        if (s) onSlot.set(p.slotId, p);
        continue;
      }
      if (s) {
        /* ★ 조용히 넘기지 않는다. slotId 는 그 자리를 가리키는데 좌표는 딴 데면
           계약이 "빈 슬롯"과 "그 화분"을 같은 이름으로 두 번 부르거나, loop.js 가
           `p.slotId` 로 찾은 **다른 자리의 밝기**를 그 화분 것으로 쓴다.
           불변식은 state.setPotAt 이 세운다 — 여기까지 깨져 왔으면 배선이 틀린 것이다. */
        if (!samePoint(s, p.at))
          throw new Error(`[조도] ${p.id} 의 자리가 어긋납니다 — slotId=${p.slotId} 는 ` +
            `(${s.x}, ${s.y}, ${s.z}) 인데 at 은 (${p.at.x}, ${p.at.y}, ${p.at.z}) 입니다. ` +
            `자유 좌표로 옮겼다면 slotId 가 ${freeSlotId(p.id)} 여야 합니다 ` +
            `(state.setPotAt · state.setCropAt).`);
        /* 같은 추천 자리를 둘이 가리키면 **계약에는 그 자리가 한 줄만 실린다**(Map 이라서).
           물리적으로 같은 점이므로 DLI 도 하나뿐인 게 맞다 — 두 줄로 내면 계약에 같은 자리가
           두 번 실려 K 검사가 막으려던 상태가 된다. 실린 줄의 plantId 만 뒤엣것이 이긴다. */
        onSlot.set(p.slotId, p);
        continue;
      }
      free.push(p);
    }

    const mk = (id, point, occIdx, p) => ({
      slotId: id, point, occIdx,
      x: point.x, y: point.y, z: point.z,
      plantId: p ? p.plantId : null,
      variegated: p ? p.variegated : undefined,
      /* 거리 감쇠는 house의 lighting_sim이 한다. 코어는 PPFD를 지어내지 않는다.
         0을 명시해 넘긴다 — null이면 계약이 lums 경로로 새로 계산한다. */
      ppfd: rigs.length ? +ppfdSum(rigs, point).toFixed(2) : 0
    });

    const out = room.slots.map(s => {
      const p = onSlot.get(s.slotId);
      return { ...s, ...mk(s.slotId, { x: s.x, y: s.y, z: s.z }, s.occIdx, p) };
    });

    for (const p of free) {
      const id = isFreeSlotId(p.slotId) ? p.slotId : freeSlotId(p.id);
      assertAt(p.at, { size: room.size });
      out.push({ ...mk(id, { x: p.at.x, y: p.at.y, z: p.at.z }, p.at.occIdx ?? null, p),
                 owner: p.at.onUid || 'floor', free: true, maxPotD: null });
    }
    return out;
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
    /* ★ S.pots 가 아니라 **놓인 것 전부**를 싣는다 (2026-08-03).
       콩나물 시루가 자유 좌표면 그 자리는 방 슬롯 목록에 없는 점이라, 여기서 안 실으면
       `cropDliFromReport` 가 오늘 계약에서 못 찾는다. 무엇이 놓였는지는 state 가 안다. */
    const report = buildDailyLight(day, slotsFor(placedItems(S), rigs), room.wins,
                                   ctxFor(sky, rigs, S.lamps.litHours));
    return { report, sky, check: validateContract(report) };
  }

  /* ---- 검수용: 날씨·계절을 지정해 그 슬롯의 DLI만 뽑는다 (weekStats 재료) ----
     같은 (weather, season, 등 개수)면 값이 같으므로 캐시한다. */
  const _cache = new Map();
  /* ref 는 slotId 문자열이거나 **화분 객체**({slotId, at})다.
     자유 좌표 화분은 방 슬롯 목록에 없는 이름이라 문자열만으로는 못 찾는다 — loop.js 가
     `p.at ? p : p.slotId` 로 넘긴다. */
  function dliOfSlot(ref, { weather, season, lampCount, litHours }) {
    const at = (ref && typeof ref === 'object') ? ref.at : null;
    const slotId = (ref && typeof ref === 'object') ? ref.slotId : ref;
    const tag = at ? `@${at.x},${at.y},${at.z},${at.occIdx}` : '';
    const key = `${slotId}${tag}|${weather}|${season}|${lampCount}|${litHours}`;
    if (_cache.has(key)) return _cache.get(key);
    let v;
    if (at) {
      v = dliAt(at, { weather, season, lampCount, litHours, occIdx: at.occIdx }).dli;
    } else {
      const rigs = rigsOn(lampCount);
      const slots = slotsFor([{ slotId, plantId: null }], rigs);
      const rep = buildDailyLight(0, slots, room.wins, ctxFor({ weather, season }, rigs, litHours));
      const s = rep.slots.find(x => x.slotId === slotId);
      v = s ? s.dli : 0;
    }
    _cache.set(key, v);
    return v;
  }
  function clearCache() { _cache.clear(); }

  /* ---- ★ 임의 좌표의 하루 조도 (배치 미리보기용, 2026-08-03) ----
     "여기 놓으면 얼마나 밝나"를 즉석으로 낸다. 슬롯 판정과 **같은 함수**를 탄다 —
     buildDailyLight 한 점짜리 계약을 만들어 그 결과를 그대로 돌려준다.
     따로 물리식을 쓰면 미리보기와 실제 값이 갈린다.

     point  { x, y, z }  ·  opt.occIdx 는 자가차폐 제외(그 화분이 올라앉은 가구)
     반환   계약 슬롯 한 칸 — { dli, dli_daylight, dli_lamp, peak_lx, band, ko, ... } */
  function dliAt(point, opt = {}) {
    if (!room) throw new Error('[조도] 방을 아직 조립하지 않았습니다 — build(roomId) 를 먼저 부르세요');
    const {
      weather = 'clear', season = 'summer', lampCount = 0, litHours = 12,
      occIdx = null, plantId = null, variegated = undefined, normal = null
    } = opt;
    /* 방 밖·NaN 은 여기서 막는다. 0 으로 메꾸면 "어두운 자리"로 보여 조용히 틀린다. */
    assertAt({ x: point.x, y: point.y, z: point.z, rotY: 0,
               onUid: occIdx == null ? null : '(probe)', occIdx },
             { size: room.size });
    const rigs = rigsOn(lampCount);
    const p = { x: point.x, y: point.y, z: point.z };
    const probe = {
      slotId: 'probe', point: p, normal, occIdx, plantId, variegated,
      ppfd: rigs.length ? +ppfdSum(rigs, p).toFixed(2) : 0
    };
    const rep = buildDailyLight(0, [probe], room.wins, ctxFor({ weather, season }, rigs, litHours));
    return rep.slots[0];
  }

  /* 이 좌표에서 제일 가까운 추천 자리. UI 의 원형 가이딩이 쓴다. */
  function nearestSlotTo(point, opt = {}) {
    if (!room) throw new Error('[조도] 방을 아직 조립하지 않았습니다');
    return nearestSlot(point, room.slots, opt);
  }

  /* ---- ★ 가구 옮기기 (2026-08-03) ----
     roomDef.furniture[i] 의 x/z/rot 을 덮어쓰고 방을 다시 조립한다.
     occluders(그림자)·plantSlots(추천 자리)가 같이 갱신되므로, 옮긴 가구 뒤 그늘의
     DLI 가 실제로 바뀐다.
     ⚠ 파일(data/house_rooms.json)은 안 고친다 — 덮어쓰기 표에만 쌓고 조립 때 얹는다.
     반환 { uid, from, to, room } */
  function moveFurniture(uid, pos) {
    if (!room) throw new Error('[조도] 방을 아직 조립하지 않았습니다');
    const raw = (data.houseRooms.rooms || {})[room.id];
    const f = (raw.furniture || []).find(x => x.uid === uid);
    if (!f) throw new Error(`[가구] 모르는 uid: ${uid} (방 ${room.id})`);
    assertFurnitureAt(pos, { size: room.size });
    const cur = furnOverrides[uid] || {};
    const from = { x: cur.x ?? f.x ?? 0, z: cur.z ?? f.z ?? 0, rot: cur.rot ?? f.rot ?? 0 };
    const to = { x: pos.x, z: pos.z, rot: pos.rot == null ? from.rot : pos.rot };
    if (pos.y != null) to.y = pos.y;
    else if (cur.y != null) to.y = cur.y;
    furnOverrides[uid] = to;
    build(room.id);                    // 조립 결과(occluders·plantSlots)가 여기서 갱신된다
    return { uid, from, to, room };
  }

  /* 세이브에서 읽은 표를 통째로 얹는다. 방을 다시 조립해야 반영된다. */
  function setFurnitureOverrides(map, { rebuild = true } = {}) {
    furnOverrides = {};
    for (const [uid, p] of Object.entries(map || {})) {
      assertFurnitureAt(p);
      furnOverrides[uid] = { x: p.x, z: p.z, rot: p.rot ?? 0, ...(p.y == null ? {} : { y: p.y }) };
    }
    if (rebuild && room) build(room.id);
    return furnOverrides;
  }

  /* UI 가 옮길 수 있는 가구 목록(지금 자리 기준) */
  function furnitureList() {
    if (!room) throw new Error('[조도] 방을 아직 조립하지 않았습니다');
    return (room.def.furniture || []).map((f, i) => ({
      uid: f.uid, preset: f.preset, idx: i,
      x: f.x ?? 0, z: f.z ?? 0, y: f.y ?? null, rot: f.rot ?? 0,
      moved: !!furnOverrides[f.uid]
    }));
  }

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
    /* 중복 slotId — 명시 uid 를 두 가구에 똑같이 적은 경우가 대부분이다.
       이걸 굳히면 세이브의 화분 두 개가 같은 자리를 가리킨다. */
    if (room.dupSlots && room.dupSlots.length) {
      const uids = [...new Set(room.dupSlots.map(d => String(d).split(':')[0]))];
      throw new Error(
        `[프로파일 중단] ${room.id}: slotId 가 ${room.dupSlots.length}칸 겹칩니다. ` +
        `겹친 uid: ${uids.join(', ')}\n` +
        `같은 uid 를 쓰는 가구가 둘 이상입니다 — uid 는 가구마다 달라야 합니다.`);
    }
    /* ★ 플레이어가 옮긴 가구 위에서 뽑지 않는다 (2026-08-03).
       프로파일은 파일로 남아 밸런스 시뮬이 "이 방은 이렇다"의 근거로 쓴다.
       옮긴 상태를 굳히면 house_rooms.json 과 다른 방이 정본 행세를 한다. */
    if (Object.keys(furnOverrides).length)
      throw new Error(`[프로파일 중단] ${room.id}: 가구가 옮겨진 상태입니다 ` +
        `(${Object.keys(furnOverrides).join(', ')}). setFurnitureOverrides({}) 로 되돌린 뒤 뽑으세요.`);
    /* ★ 겨눈 등 위에서도 안 뽑는다 (2026-08-06) — 위 가구와 같은 이유다.
       프로파일의 `ppfd` 배열은 파일로 굳어 밸런스 시뮬의 근거가 된다. 플레이어가 겨눈
       상태를 굳히면 "이 방은 이렇다"가 그 한 사람의 조준으로 바뀐다. */
    if (Object.keys(lampAims).length)
      throw new Error(`[프로파일 중단] ${room.id}: 등이 겨눠진 상태입니다 ` +
        `(${Object.keys(lampAims).join(', ')}). setLampAims({}) 로 되돌린 뒤 뽑으세요.`);

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
          /* 정적 프로필도 라이브 슬롯과 같은 화분 크기 계약을 보존한다.
             결측을 임의 값으로 메우지 않아 소비자가 fail-loud 할 수 있게 한다. */
          maxPotD: Number.isFinite(s.maxPotD) ? s.maxPotD : null,
          ratio: +daylightRatio(point, up, room.wins, opt).toPrecision(6),
          ppfd: counts.map(n => +ppfdSum(rigsOn(n), point).toFixed(2))
        };
      })
    };
  }

  return {
    build, daily, skyFor, dliOfSlot, clearCache, profile, uidAudit,
    /* ★ 자유 좌표 배치 (2026-08-03) — UI 창이 쓰는 공개 API */
    dliAt, nearestSlotTo, moveFurniture, setFurnitureOverrides, furnitureList,
    furnitureOverrides: () => ({ ...furnOverrides }),
    /* ★ 판 것·산 것 (2026-08-30 · §defWithOverrides) — 화면·이사 창이 쓰는 공개 API */
    setFurnitureEdits,
    furnitureEdits: () => ({ sold: [...furnSold], added: furnAdded.map(f => ({ ...f })) }),
    /* ★ 등 겨누기 (2026-08-06) — 화면 창이 쓰는 공개 API */
    setLampAim, clearLampAim, setLampAims, lampList, aimRangeOf,
    lampAims: () => ({ ...lampAims }),
    get room() { return room; },
    rooms: () => Object.entries(data.houseRooms.rooms || {})
                   .map(([id, r]) => ({ id, label: r.label || id, light: r.light || '' })),
    growLampCount: () => (room ? room.growRigs.length : 0),
    /* 그 식물의 임계값 (갈라짐 문턱 등). 값은 plan 소유 JSON에서만 온다. */
    thresholdsOf: (plantId, varie) => thresholdsFor(data.lightTh, plantId, varie)
  };
}
