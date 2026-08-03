/* ============================================================
   game/headroom.js — 머리공간(그 자리 위로 비어 있는 높이) (core 소유)
   ------------------------------------------------------------
   ★ 이 파일이 세우는 규칙 하나: **위가 막힌 자리에서는 어느 크기부터 더 못 자란다.**
     죽지 않는다. 시들지도 않는다. **그냥 멈춘다.** 옮기면 다시 자란다.
     그래서 "제일 밝은 자리"를 언젠가 떠나야 한다 — 반지하 창턱이 제일 밝은데
     천장까지 0.7m 밖에 안 남은 자리라서다(docs/headroom.md).

   THREE·DOM 이 없다. Node 에서 그대로 돈다 — 기하 규칙은 테스트할 수 있어야 한다.

   ── 무엇을 보고 재나 ──────────────────────────────────────────
     size       방 치수 {w,d,h}. 천장 높이가 마지막 한도다
     occluders  house.js 가 낸 차폐체 [{x,z,w,d,h,y0,rot}] — x,z 는 **좌하단**이고
                회전은 상자 중심 기준이다(daylight_lux.isShadowed 와 같은 규약).
                내 머리 **위에서 시작하는**(y0 > 내 y) 상자만 천장 노릇을 한다.
     slots      추천 자리 목록. **선반 단은 차폐체에 없다** — house.js 는 가구 하나를
                통짜 상자 하나로만 등록한다(반지하 에타제르 = y0:0, h:0.794 하나).
                그래서 "선반 아래 칸의 천장"은 **같은 가구의 윗단 슬롯 y** 로만 알 수 있다.

   ── 모르는 것을 지어내지 않는다 ────────────────────────────────
     방 치수가 없으면(정적 프로파일 경로) `headroomAt` 은 **null** 을 낸다.
     0 으로 메꾸면 모든 자리가 막힌 자리가 되고, 무한대로 메꾸면 규칙 자체가 없는 것이 된다.
     null = "못 쟀다" 이고, 못 쟀으면 **막지 않는다**(blockedBy 가 known:false 로 낸다).

   ── 아직 못 보는 것 (정직하게 · docs/headroom.md §한계) ────────
     · 천장등·식물등 같은 **매달린 기구**는 차폐체 목록에 없다(house.js 가 hang 을 뺀다).
     · 창 **개구부 위 벽(인방)** 도 차폐체가 아니다 — 창턱 위는 천장까지로 본다.
     둘 다 house 가 목록에 넣어 주면 이 파일은 안 고쳐도 그날부터 반영된다.
============================================================ */

const EPS = 1e-6;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/* 선반 판 두께[m]. 윗단 **상판 y** 에서 이만큼 빼면 그 단의 **밑면**이다.
   ★ 슬롯 목록에는 판 두께가 없다(house.js plantSlots 가 안 싣는다). 여기 상수로 둔 근거는
     furniture_pastel.js 의 실제 값이다 — shelf_etagere t=0.03 · shelf_wall t=0.035.
     ⚠ 지어낸 값이 아니라 **읽어 온 값**이고, house 가 slots 에 판 두께를 실어 주면
       그때 이 상수를 지운다(그전까지는 3cm 만큼 보수적으로 잰다). */
export const SHELF_BOARD_M = 0.03;

/* 경고 띠[m]. 막히기 전에 "곧 막힌다"를 한 번 알린다 — 어느 날 갑자기 멈추면
   플레이어는 빛이 모자란 줄 안다(빛 부족 정지와 화면 문구가 섞이면 안 된다). */
export const WARN_MARGIN_M = 0.10;

/* ★ 정지 사유 키. 빛 부족 정지(growth 의 growthBlocked)와 **반드시 구분된다.**
   loop.js 는 이 키로 두 정지를 갈라 적는다. 문구가 섞이면 플레이어는
   "등을 하나 더 사면 되겠지" 하고 영영 안 옮긴다 — 정반대의 처방이다. */
export const HEADROOM_BLOCK = 'headroom';

/* ------------------------------------------------------------------
   1. 상자 하나가 이 점 위를 덮는가
------------------------------------------------------------------ */
/* occluders 규약은 daylight_lux.isShadowed 와 **같은 것 하나**다:
     중심 = (x + w/2, z + d/2) · 반크기 = (w/2, d/2) · rot 은 y 축 회전[rad]
   두 곳이 다른 규약을 쓰면 "그림자는 지는데 머리는 안 걸리는" 상자가 생긴다. */
function coversXZ(box, x, z, pad = 0) {
  const cx = box.x + box.w / 2, cz = box.z + box.d / 2;
  const rot = box.rot || 0, c = Math.cos(-rot), s = Math.sin(-rot);
  const u = (x - cx) * c - (z - cz) * s;
  const v = (x - cx) * s + (z - cz) * c;
  return Math.abs(u) <= box.w / 2 + pad + EPS && Math.abs(v) <= box.d / 2 + pad + EPS;
}

/* ------------------------------------------------------------------
   2. 슬롯 목록에서 '단'을 되뽑는다
------------------------------------------------------------------ */
/* slotId 는 `{가구 uid}:{단}` 이다(light_adapter 안정 slotId 계약).
   같은 uid 의 슬롯들을 모아 **서로 다른 y 값 = 단 높이**, 그 x·z 범위 = 그 가구의 발자국.
   자유 좌표 슬롯(`free:…`)은 가구가 아니므로 뺀다 — 화분끼리는 서로의 천장이 아니다. */
export function tiersFromSlots(slots) {
  const by = new Map();
  for (const s of slots || []) {
    if (!s || !isNum(s.x) || !isNum(s.y) || !isNum(s.z)) continue;
    const id = String(s.slotId ?? '');
    const cut = id.lastIndexOf(':');
    if (cut <= 0) continue;
    const uid = id.slice(0, cut);
    if (uid.startsWith('free:')) continue;
    if (!by.has(uid)) by.set(uid, { uid, ys: new Set(), x0: Infinity, x1: -Infinity,
                                    z0: Infinity, z1: -Infinity, pad: 0 });
    const g = by.get(uid);
    g.ys.add(+s.y.toFixed(4));
    g.x0 = Math.min(g.x0, s.x); g.x1 = Math.max(g.x1, s.x);
    g.z0 = Math.min(g.z0, s.z); g.z1 = Math.max(g.z1, s.z);
    /* 슬롯은 판의 **점**이라 판 넓이를 모른다. 그 자리에 올릴 수 있는 화분 지름의 절반만큼
       바깥으로 벌려 판 넓이에 가깝게 본다(place.surfaceFromSlots 와 같은 근사). */
    if (isNum(s.maxPotD)) g.pad = Math.max(g.pad, s.maxPotD / 2);
  }
  return [...by.values()].map(g => ({
    uid: g.uid,
    tiers: [...g.ys].sort((a, b) => a - b),
    rect: { x: g.x0 - g.pad, z: g.z0 - g.pad,
            w: Math.max(g.x1 - g.x0 + g.pad * 2, 1e-3),
            d: Math.max(g.z1 - g.z0 + g.pad * 2, 1e-3), rot: 0 }
  }));
}

/* ------------------------------------------------------------------
   3. ★ 머리공간
------------------------------------------------------------------ */
/* at   { x, y, z, ... }  — y 는 **화분 밑면**이 놓인 높이다(슬롯 y 와 같은 뜻)
   ctx  { size, occluders, slots, boardThickM }
   반환 미터[m], 못 재면 null.

   재는 순서
     ① 천장(size.h)에서 시작한다
     ② 내 위에서 시작하는 차폐체(y0 > 내 y)가 이 점을 덮으면 그 밑면까지
     ③ 같은 가구의 **윗단**이 이 점을 덮으면 그 판 밑면(윗단 상판 - 판 두께)까지
   셋 중 제일 낮은 것이 내 천장이다. */
export function headroomAt(at, ctx = {}) {
  return headroomDetailAt(at, ctx).m;
}

/* 어디에 걸렸는지까지 낸다 — 화면·로그가 "무엇이 막고 있나"를 말할 수 있어야 한다.
   ★ 재는 자리는 여기 하나뿐이다. headroomAt 은 이 값의 m 만 꺼낸다. */
export function headroomDetailAt(at, ctx = {}) {
  if (!at || !isNum(at.x) || !isNum(at.y) || !isNum(at.z))
    return { m: null, by: null, topY: null, reason: '좌표가 유한하지 않습니다' };
  const size = ctx.size;
  if (!size || !isNum(size.h))
    return { m: null, by: null, topY: null, reason: '방 천장 높이를 모릅니다(size.h 없음)' };

  let top = size.h, by = 'ceiling';

  /* ① 내 위에서 시작하는 차폐체(y0 > 내 y). 내가 들어앉은 상자는 천장이 아니다 */
  for (const o of ctx.occluders || []) {
    if (!o || !isNum(o.x) || !isNum(o.z) || !isNum(o.w) || !isNum(o.d)) continue;
    const y0 = isNum(o.y0) ? o.y0 : 0;
    if (y0 <= at.y + EPS || !coversXZ(o, at.x, at.z)) continue;
    if (y0 < top) { top = y0; by = o.src ? `occluder:${o.src}` : 'occluder'; }
  }

  /* ② 같은 가구의 윗단(선반 판). 차폐체에는 없고 슬롯에만 있다 */
  const board = isNum(ctx.boardThickM) ? ctx.boardThickM : SHELF_BOARD_M;
  for (const g of tiersFromSlots(ctx.slots)) {
    if (!coversXZ(g.rect, at.x, at.z)) continue;
    for (const ty of g.tiers) {
      if (ty <= at.y + EPS) continue;               // 내 단 · 내 아래 단은 천장이 아니다
      const under = ty - board;                     // 그 단의 **밑면**
      if (under < top) { top = under; by = `tier:${g.uid}`; }
      break;                                        // 단은 오름차순 — 첫 윗단이 제일 낮다
    }
  }

  return { m: +Math.max(0, top - at.y).toFixed(4), by, topY: +top.toFixed(4), reason: null };
}

/* ------------------------------------------------------------------
   4. ★ 몬스테라가 차지하는 높이 — **화분 포함**
------------------------------------------------------------------ */
/* ⚠ 잎 높이만 보면 안 된다. 창턱(1.585m)에 놓인 화분은 화분만으로 0.13m 를 먹는다.
   슬롯 y 는 **화분 밑면**이므로 비교 대상도 '화분 밑면부터 잎 꼭대기까지'여야 한다.

   ★ 이 표는 **짐작이 아니라 실측**이다.
     헤드리스 크롬에서 `plant_assemble.assemble({growthDays, seed:92158, potD:0.20})` 로
     방에 실제로 놓이는 그룹을 만들고 `THREE.Box3().setFromObject(g).max.y` 를 1일 간격
     1095일까지 쟀다(2026-08-03). 아래는 그 곡선을 세로 오차 0.006m 안에서 줄인 꺾은선이다.
     · 곡선이 계단인 이유: 잎 한 장이 펴질 때 키가 한 번에 오르고, 그 사이는 평평하다.
     · 씨앗 92158 은 **게임이 실제로 쓰는 값**이다(room_view 가 spec.seed 를 안 주면
       plant_assemble 이 92158 로 떨어진다). 다른 씨앗은 143일에서 ±7%, 1095일에서 ±37% 다.
     · 화분 지름에 **선형**이다 — plant_assemble 이 그루 전체를 potD/원본지름 배율로 줄인다.

   ★ 방뷰가 실제 bbox 를 알려 주면 그 값을 쓰는 게 맞다(docs/headroom.md §room_view 제안).
     그때까지의 기준선이 이 표다. */
export const PLANT_POT_D_REF = 0.20;      // 이 표를 잰 화분 지름[m] (MONSTERA_POT_D 와 같다)

const MONSTERA_TOP = [
  [0, 0.1332], [7, 0.1332], [9, 0.1483], [10, 0.1661], [21, 0.1914],
  [27, 0.2328], [29, 0.2357], [30, 0.2775], [42, 0.3004], [49, 0.3445],
  [73, 0.3916], [117, 0.4266], [118, 0.4742], [130, 0.5285], [181, 0.5731],
  [220, 0.5733], [230, 0.6137], [334, 0.6137], [345, 0.6510], [453, 0.6529],
  [454, 0.7165], [471, 0.7716], [595, 0.7716], [607, 0.8081], [732, 0.8081],
  [733, 0.8179], [753, 0.8740], [885, 0.8740], [886, 0.8842], [907, 0.9491],
  [1046, 0.9491], [1047, 0.9606], [1068, 1.0183], [1069, 1.0274], [1095, 1.0274]
];

/* 유효 생장일 → 화분 밑면부터 잎 꼭대기까지[m].
     growthDays  growth 의 growthDays() (달력일이 아니다 — 빛이 될 때만 쌓인 값)
     opt.potD    이 화분의 지름[m]. 기본 0.20 */
export function plantTopM(growthDays, opt = {}) {
  if (!isNum(growthDays)) return null;
  const d = Math.max(0, growthDays);
  const scale = isNum(opt.potD) && opt.potD > 0 ? opt.potD / PLANT_POT_D_REF : 1;
  const T = MONSTERA_TOP;
  if (d <= T[0][0]) return +(T[0][1] * scale).toFixed(4);
  if (d >= T[T.length - 1][0]) return +(T[T.length - 1][1] * scale).toFixed(4);
  for (let i = 1; i < T.length; i++) {
    if (d > T[i][0]) continue;
    const [x0, y0] = T[i - 1], [x1, y1] = T[i];
    const t = (d - x0) / (x1 - x0 || 1);
    return +((y0 + (y1 - y0) * t) * scale).toFixed(4);
  }
  return +(T[T.length - 1][1] * scale).toFixed(4);
}

/* 그 머리공간에서 **몇 일까지** 자랄 수 있나. 문서·검수·화면 안내가 쓴다.
   1095일(GMAX)까지 안 막히면 null 을 낸다 — "영영 안 막힌다"를 1095 로 적으면 거짓말이 된다. */
export function maxGrowthDaysFor(headroomM, opt = {}) {
  if (!isNum(headroomM)) return null;
  const last = MONSTERA_TOP[MONSTERA_TOP.length - 1][0];
  if (plantTopM(last, opt) <= headroomM) return null;
  let lo = 0, hi = last;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (plantTopM(mid, opt) <= headroomM) lo = mid + 1; else hi = mid;
  }
  return lo - 1;                                   // 마지막으로 들어가는 날
}

/* ------------------------------------------------------------------
   5. ★ 막혔는가
------------------------------------------------------------------ */
/* plantHeight  화분 밑면부터 잎 꼭대기까지[m] (plantTopM 이 내는 값)
   headroom     headroomAt 이 낸 값[m] · null 이면 "못 쟀다"
   반환 { blocked, marginM, reason, warn, known }

   ★ 못 쟀으면 막지 않는다. 판정 근거가 없는데 멈추면 어두운 방에서 아무 이유 없이
     식물이 안 자란다 — 오류도 안 나면서 게임이 진행 불가가 되는 최악의 유형이다. */
export function blockedBy(plantHeight, headroom, opt = {}) {
  if (!isNum(headroom))
    return { blocked: false, marginM: null, reason: null, warn: false, known: false };
  if (!isNum(plantHeight))
    return { blocked: false, marginM: null, reason: null, warn: false, known: false };

  const marginM = +(headroom - plantHeight).toFixed(4);
  const warnAt = isNum(opt.warnMarginM) ? opt.warnMarginM : WARN_MARGIN_M;
  if (marginM > EPS) {
    return { blocked: false, marginM, warn: marginM <= warnAt, known: true,
             reason: marginM <= warnAt
               ? `천장까지 ${marginM.toFixed(2)}m 남았습니다 — 곧 더 못 자랍니다`
               : null };
  }
  return {
    blocked: true, marginM, warn: false, known: true,
    reason: `위가 막혔습니다 — 이 자리 머리공간 ${headroom.toFixed(2)}m 인데 ` +
            `키가 ${plantHeight.toFixed(2)}m 입니다. 위가 트인 자리로 옮기거나 삽수를 하세요`
  };
}

/* ------------------------------------------------------------------
   6. 한 번에 묻는 창구 — loop.js 가 쓰는 것
------------------------------------------------------------------ */
/* at          화분 자리 {x,y,z}
   growthDays  지금 유효 생장일
   ctx         { size, occluders, slots, potD, warnMarginM, boardThickM }
   반환 { blocked, marginM, reason, warn, known, headroomM, plantTopM, by, kind } */
export function headroomCheck(at, growthDays, ctx = {}) {
  const det = headroomDetailAt(at, ctx);
  const top = plantTopM(growthDays, { potD: ctx.potD });
  const r = blockedBy(top, det.m, ctx);
  return { ...r, kind: HEADROOM_BLOCK, headroomM: det.m, plantTopM: top,
           by: det.by, topY: det.topY, unknownReason: r.known ? null : (det.reason || '키를 모릅니다') };
}
