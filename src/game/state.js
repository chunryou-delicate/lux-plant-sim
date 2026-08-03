/* ============================================================
   game/state.js — 게임 상태 S (core 소유)
   ------------------------------------------------------------
   여기 있는 건 '루프가 세는 것'뿐이다.
     · 며칠 지났나 · 어느 방 · 어느 슬롯 · 등 몇 개 · 어떤 모드
   여기 없는 것(다른 창 소유이므로 절대 복제하지 않는다):
     · 생장 나이·잎 수         → growth (ageOf·growthDays). 코어는 읽기만 한다
     · DLI·밴드·전기요금       → house (계약 객체 daily_light/1)
     · 임계값·계수·확률        → data/balance/*.json (plan)

   ★ 고사·정식 경제는 없다. 첫 플레이의 콩나물 1회 수확·식비 절감만
     first_play.js의 닫힌 상태로 둔다. 월세·현금·상점으로 확장하지 않는다.
     활력(vigor)은 표시 취소·구현 보류다(2026-08-02) — 자리를 만들면 판정이 코어로 샌다.
============================================================ */

import { createFirstPlayState } from './first_play.js';
import { createTutorialState } from './tutorial.js';
import { atFromSlot, freeSlotId, isFreeSlotId, makeAt,
         nearestSlot, samePoint, inRoom, assertFurnitureAt } from './place.js';

export const SCHEMA = 'game_state/1';

/* ★ 시뮬 모드 — 판정 단위가 모드마다 다르다.
     real   날씨·계절을 굴린다. 판정 단위 = 계절별 7일 이동평균.
            peak·연평균은 판정에 쓰지 않는다(data/balance/weather.json 규약).
     novice 날씨·계절 계수를 1.0으로 고정한다. 맑음·여름에 못박히므로
            peak가 곧 실제값이 되고, peak 금지 규약이 적용되지 않는다.
   ⚠ v0는 real 로만 검증한다. novice 는 '자리'다 — 값(중간 난이도 계수 등)은 plan 미정. */
export const SIM_MODES = {
  real:   { ko: '실전 (날씨·계절 굴림)', rollWeather: true,  rollSeason: true,  weather: null,    season: null },
  novice: { ko: '초보 (계수 1.0 고정)',  rollWeather: false, rollSeason: false, weather: 'clear', season: 'summer' }
};

export function newState(opt = {}) {
  return {
    schema: SCHEMA,
    day: 0,

    /* 시간 3모드가 이 숫자 하나로 갈린다 — 하드코딩 금지(plan-to-core §미해결). v0 미사용. */
    timeScale: { minutesPerGameDay: 30 },

    /* 모드. seasonK/weatherK 는 '중간 난이도'가 생길 때 쓸 자리다(null = 모드 기본). */
    sim: { mode: opt.mode || 'real', seed: 0, weatherK: null, seasonK: null },

    /* ★ 가구 덮어쓰기 표 (2026-08-03) — `{ <uid>: {x, z, rot} }`
       **플레이어가 옮긴 가구만** 담는다. 비어 있으면 data/house_rooms.json 의 기본값이다.
       그 파일은 house 소유라 게임이 못 건드린다 — 그래서 '차이'만 세이브에 남긴다.
       조립 때 메모리 사본에 얹는 일은 light_adapter.build 가 한다(파일은 안 바뀐다). */
    home: { room: opt.room || 'banjiha', furniture: {} },

    /* 식물등 — 방에 이미 놓인 grow 기구를 앞에서부터 n개 켠다.
       개수·PPFD·와트를 코어가 지어내지 않는다(house의 lightRigs + lighting_presets). */
    lamps: { count: 0, litHours: 12 },

    /* ★ 화분 — **비어 있게 시작한다** (2026-08-02).
       몬스테라는 플레이어가 143일 키운 게 아니라 **이미 자란 개체가 도착**하는 것이다.
       앱을 열었다고 Day 0부터 식물이 있으면 안 된다 — 도착 이벤트(Day 4 선물, 이번 범위 밖)나
       테스트 초기화 경계(givePlant)가 만들 때 생긴다. v0는 1개 (growth가 한 그루 전용). */
    pots: [],

    /* Day 0 콩나물 → Day 4 첫 수확·선물 → 몬스테라 말린 새순.
       정식 작물 목록이나 경제 장부가 아니라 첫 재미 검증 한 흐름만 담는다. */
    firstPlay: createFirstPlayState({ enabled: !!opt.firstPlay, rules: opt.firstPlayRules }),

    /* 반지하 튜토리얼 — 첫 플레이 **그 뒤**부터 원룸 이사까지 (2026-08-03).
       규칙과 수치는 src/game/tutorial.js 가 갖는다(docs/story_arc.md 가 정본).
       첫 플레이가 끝나기 전에는 날짜도 돈도 계절도 안 움직인다. */
    tutorial: createTutorialState({ enabled: !!opt.firstPlay }),

    /* 코어가 따로 쌓는 DLI 이력. 용도는 두 가지뿐:
         ① growth의 dli7()과 대조(어긋나면 배선이 틀린 것)
         ② 30일 검수 리포트의 '문턱 넘는 주 비율'
       ★ 판정에는 쓰지 않는다. 고사·활력은 취소·보류다(2026-08-02). */
    dliHist: [],

    /* 경제는 3단계다. 표시만 하고 차감하지 않는다. */
    ledger: { today: { in: 0, out: 0 }, total: 0, electricityWon: 0 },

    log: []
  };
}

export function pot0(S) { return S.pots[0] || null; }
export function hasPlant(S) { return S.pots.length > 0; }

/* ★ 도착 진행도 — growth 확정값 (2026-08-02 · growth STATUS "첫 플레이 초기 유효 진행도 = 143일").
   143일 상태 = 비갈라짐 중간잎 2장·새순 없음. 적정광 3턴 뒤 146에서 말린 새순이 나온다.
   ⚠ 이 숫자는 growth 소유다. 코어는 도착 시 한 번 넘기기만 한다. */
export const ARRIVAL = {
  plantId: 'monstera_deliciosa',
  growthDays: 143,
  potAsset: 'monstera/pot.glb'      // 회전 무관 지름 0.202 ≤ 창턱 0.21 (core-to-house ④)
};

/* ★ 개체 생성 = **도착**. 여기서만 setGrowth 를 쓴다(점프 1회).
   그 뒤 일일 진행은 전부 advanceTo 다 — 이 경계를 흐리면 저광 정지가 무시된다.

   pot.daysPlanted 는 **플레이어가 돌본 날**이라 0부터 센다.
   growth 안의 달력·유효 진행도는 143에서 시작한다. 둘은 다른 축이다. */
/* ★ 원자적이다 (2026-08-02) — 형태를 못 세우면 개체도 안 생긴다.
   순서가 중요하다: **setGrowth 가 성공한 뒤에만** 화분·로그를 남긴다.
   반대로 하면 "화분은 있는데 형태는 0일(=씨앗)"인 개체가 조용히 남는다.
   던지면 S 는 손대기 전 상태 그대로다 — 부분 성공이 없다. */
export function givePlant(S, io, opt = {}) {
  if (S.pots.length) return pot0(S);                     // 이미 있으면 다시 만들지 않는다

  const g = io && io.growth;
  const growthDays = opt.growthDays ?? ARRIVAL.growthDays;
  if (!g || typeof g.setGrowth !== 'function')
    throw new Error('[도착] 생장 창이 준비되지 않았습니다 — setGrowth 를 부를 수 없어 개체를 만들지 않습니다');
  if (typeof g.has === 'function' && !g.has('setGrowth'))
    throw new Error('[도착] plant_grow 에 setGrowth 가 없습니다 — 개체를 만들지 않습니다');

  /* ① 형태부터 세운다. 여기서 던지면 아래로 내려가지 않는다(화분·로그 0) */
  const res = g.setGrowth(growthDays);

  /* ★ 그려졌는지까지 본다 (growth 렌더 신호 계약, 2026-08-02).
     `setGrowth` 는 그리기가 실패해도 예외를 던지지 않는다 — 논리 진행과 화면을 갈라 뒀기 때문이다.
     그 신호를 안 보면 **"화분은 있는데 화면엔 없는" 개체**가 조용히 생긴다.
     도착은 화면에 보이는 것이 전부인 사건이라 여기서 멈춘다 — 화분도 로그도 만들지 않는다.
     ⚠ drawn 이 undefined 인 옛 growth 는 '정보 없음'이라 막지 않는다(=== false 일 때만 멈춘다). */
  if (res && res.drawn === false) {
    const why = res.drawError ? ` — ${res.drawError}` : '';
    const err = new Error(`[도착] 몬스테라를 화면에 그리지 못했습니다${why}. 개체를 만들지 않았습니다`);
    err.drawError = res.drawError ?? null;
    err.recoverable = true;          // 다시 그릴 수 있으면 재시도 가능한 종류다
    throw err;
  }
  /* HUD 실패는 3D 실패와 등급이 다르다 — 형태는 보이는데 growth 쪽 숫자판만 죽은 것이라 경고만 한다. */
  if (res && res.hudError) {
    console.warn(`[도착] growth HUD 갱신 실패(3D 는 그려짐) — ${res.hudError}`);
    pushLog(S, `⚠ growth HUD 갱신 실패 — ${res.hudError} (형태는 그려졌습니다)`);
  }

  /* ② 성공했으니 개체를 남긴다 */
  const pot = {
    id: opt.id || 'pot_01',
    /* slotId 는 **계약 열쇠**다 — 하루치 조도 계약(daily_light/1)에 이 화분이 실리는 이름이고
       세이브에도 그대로 들어간다. 추천 자리 위면 그 자리의 안정 id, 자유 좌표면 `free:{화분 id}`. */
    slotId: opt.slotId || null,
    /* ★ 좌표가 정본이다 (2026-08-03). 없으면 slotId 로 돌고, 로드 때 migratePots 가 채운다. */
    at: opt.at ? makeAt(opt.at) : null,
    plantId: opt.plantId || ARRIVAL.plantId,
    potAsset: ARRIVAL.potAsset,
    variegated: false,
    daysPlanted: 0,                                      // 플레이어가 돌본 날
    arrivedOnDay: S.day,
    arrivalGrowthDays: growthDays
  };
  S.pots.push(pot);
  pushLog(S, `🪴 몬스테라가 도착했습니다 — 이미 ${growthDays}일 자란 개체입니다`);
  return pot;
}

export function modeOf(S) { return SIM_MODES[S.sim.mode] || SIM_MODES.real; }

/* ============================================================
   ★ 화분 자리 — 좌표가 정본, slotId 는 계약 열쇠 (2026-08-03)
   ------------------------------------------------------------
   지켜야 할 불변식 하나:
     ① 추천 자리 위 화분  : pot.slotId = 그 슬롯의 안정 id  ·  pot.at = 그 슬롯 좌표
     ② 자유 좌표 화분     : pot.slotId = `free:{pot.id}`     ·  pot.at = 그 좌표
   이게 깨지면 하루치 계약에 같은 화분이 두 번(빈 슬롯 + 자유 좌표) 실리거나,
   loop.js 가 `p.slotId` 로 찾은 값이 **다른 자리의 밝기**가 된다. 조용히 틀리는 유형이라
   light_adapter.slotsFor 가 깨진 조합을 보면 던진다.
============================================================ */

/* 옛 세이브 마이그레이션 — `slotId` 만 있는 화분에 그 슬롯의 좌표를 채운다.
   좌표가 이미 있으면 손대지 않는다(좌표가 이긴다).
   ⚠ 슬롯에 좌표가 없으면(정적 프로파일의 얇은 슬롯 등) **지어내지 않고 건너뛴다** —
     그 화분은 예전처럼 slotId 로 돈다. 0,0,0 으로 메꾸면 방 한가운데로 순간이동한다. */
export function migratePots(S, slots) {
  const filled = [], skipped = [];
  for (const p of S.pots || []) {
    if (p.at) continue;
    if (!p.slotId) { skipped.push({ id: p.id, why: 'slotId 가 없습니다' }); continue; }
    if (isFreeSlotId(p.slotId)) { skipped.push({ id: p.id, why: '자유 좌표인데 at 이 없습니다' }); continue; }
    const s = (slots || []).find(x => x && x.slotId === p.slotId);
    if (!s) { skipped.push({ id: p.id, why: `슬롯 ${p.slotId} 이(가) 이 방에 없습니다` }); continue; }
    if (![s.x, s.y, s.z].every(v => typeof v === 'number' && Number.isFinite(v))) {
      skipped.push({ id: p.id, why: `슬롯 ${p.slotId} 에 좌표가 없습니다` }); continue;
    }
    p.at = atFromSlot(s);
    filled.push({ id: p.id, slotId: p.slotId, at: p.at });
  }
  return { filled, skipped };
}

/* 화분을 좌표에 놓는다. **유일한 쓰기 창구**다 — 불변식은 여기서만 세운다.
     at    { x, y, z, rotY?, onUid?, occIdx? }
     opt   { size: 방 치수, slots: 추천 자리 배열, snapDist: 이 거리 안이면 슬롯에 붙인다 }
   추천 자리에 붙으면 그 자리의 안정 slotId 를 쓴다(세이브 하위호환·헤드리스 시뮬이 그걸 본다).
   벗어나면 `free:{pot.id}` 가 된다. */
export function setPotAt(S, potOrId, at, opt = {}) {
  const p = typeof potOrId === 'string' ? (S.pots || []).find(x => x.id === potOrId) : potOrId;
  if (!p) throw new Error(`[배치] 모르는 화분: ${potOrId}`);
  const next = makeAt(at, { size: opt.size });

  const snap = opt.snapDist ?? 0;
  const near = (opt.slots && opt.slots.length)
    ? nearestSlot(next, opt.slots, { maxDist: snap > 0 ? snap : undefined }) : null;
  /* 붙이기는 '가까우면 그 자리'가 아니라 '그 자리로 간다'다 — 좌표까지 슬롯 값으로 바꾼다.
     좌표만 남기고 slotId 를 슬롯 것으로 쓰면 계약이 두 자리를 같은 이름으로 부른다. */
  if (near && (snap > 0 ? near.dist <= snap : samePoint(next, near.slot))) {
    p.at = atFromSlot(near.slot, { rotY: next.rotY });
    p.slotId = near.slot.slotId;
    return { potId: p.id, slotId: p.slotId, at: p.at, snappedTo: near.slot.slotId, dist: near.dist };
  }
  p.at = next;
  p.slotId = freeSlotId(p.id);
  return { potId: p.id, slotId: p.slotId, at: p.at, snappedTo: null, dist: near ? near.dist : null };
}

/* 추천 자리에 놓는다(예전 경로). 좌표까지 같이 세운다. */
export function setPotSlot(S, potOrId, slotId, slots) {
  const p = typeof potOrId === 'string' ? (S.pots || []).find(x => x.id === potOrId) : potOrId;
  if (!p) throw new Error(`[배치] 모르는 화분: ${potOrId}`);
  const s = (slots || []).find(x => x && x.slotId === slotId);
  if (!s) throw new Error(`[배치] 모르는 자리: ${slotId}`);
  p.slotId = slotId;
  p.at = [s.x, s.y, s.z].every(v => typeof v === 'number' && Number.isFinite(v))
       ? atFromSlot(s, { rotY: p.at ? p.at.rotY : 0 }) : null;
  return { potId: p.id, slotId, at: p.at };
}

/* 슬롯이 사라졌을 때(가구 삭제·방 전환) 화분을 어디로 보낼지 — 코어가 정한다(house-to-core §slotId).
   v0 규칙: 가장 밝은 자리로 자동 회수하고 로그를 남긴다. 조용히 옮기지 않는다.

   ★ 자유 좌표 화분은 슬롯 목록과 무관하게 **그 자리에 그대로 있다.** 회수는 두 경우뿐이다:
     ① 올라앉았던 가구(onUid)가 방에서 사라졌다   ② 방이 바뀌어 그 좌표가 방 밖이다
   room 을 안 넘기면 ①·②를 판단할 근거가 없으므로 자유 좌표는 손대지 않는다. */
export function rehomePot(S, slots, log, room = null) {
  const p = pot0(S);
  if (!p) return null;
  migratePots(S, slots);                       // 옛 세이브면 여기서 좌표가 채워진다

  if (p.at) {
    const surfaces = room && room.surfaces;    // Set<uid> — 지금 방에 있는 가구
    const gone = p.at.onUid && surfaces && !surfaces.has(p.at.onUid);
    const outside = room && room.size && !inRoom(p.at, room.size);
    if (!gone && !outside) return p.slotId;
    if (log) log(gone
      ? `화분 회수 — 받치던 ${p.at.onUid} 이(가) 사라졌습니다`
      : '화분 회수 — 자리가 방 밖입니다');
    p.at = null;                               // 아래 슬롯 회수로 내려간다
  } else if (p.slotId && slots.some(s => s.slotId === p.slotId)) {
    return p.slotId;
  }

  const dest = slots[0] || null;
  if (log && dest) log(p.slotId
    ? `화분 회수 — 슬롯 ${p.slotId} 이(가) 사라져 ${dest.slotId} 로 옮겼습니다`
    : `화분 배치 — ${dest.slotId}`);
  p.slotId = dest ? dest.slotId : null;
  p.at = (dest && [dest.x, dest.y, dest.z].every(v => typeof v === 'number' && Number.isFinite(v)))
       ? atFromSlot(dest) : null;
  return p.slotId;
}

/* ---- 가구 덮어쓰기 표 (S.home.furniture) ---- */
export function furnitureOverrides(S) {
  if (!S.home.furniture) S.home.furniture = {};
  return S.home.furniture;
}

/* 플레이어가 가구를 옮긴 것을 세이브에 적는다. 방을 다시 조립하는 일은
   light_adapter.moveFurniture 가 한다 — 상태와 조립을 한 함수에 섞지 않는다. */
export function setFurniturePlacement(S, uid, pos, opt = {}) {
  if (!uid || typeof uid !== 'string') throw new TypeError('[배치] 가구 uid 가 필요합니다');
  assertFurnitureAt(pos, opt);
  const tbl = furnitureOverrides(S);
  const cur = tbl[uid] || {};
  tbl[uid] = {
    x: pos.x, z: pos.z,
    rot: pos.rot == null ? (cur.rot ?? 0) : pos.rot,
    ...(pos.y == null ? (cur.y == null ? {} : { y: cur.y }) : { y: pos.y })
  };
  return tbl[uid];
}

export function clearFurniturePlacement(S, uid) {
  const tbl = furnitureOverrides(S);
  const had = uid in tbl;
  delete tbl[uid];
  return had;
}

export function pushLog(S, msg) {
  S.log.push({ day: S.day, msg });
  if (S.log.length > 200) S.log.shift();
  return msg;
}
