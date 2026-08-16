/* ============================================================
   game/place.js — 자유 좌표 배치 (core 소유)
   ------------------------------------------------------------
   화분·가구를 '슬롯 번호'가 아니라 **방 안의 좌표**로 다룬다.
   THREE·DOM 이 없다. Node 에서 그대로 돈다 — 그래야 배치 규칙을 테스트할 수 있다.

   왜 좌표인가
     조도는 처음부터 좌표 함수였다. `daylightRatio(point, normal, wins, opt)` 도
     `luxGrid()` 도 `ppfdSum(rigs, point)` 도 임의 좌표를 받는다.
     슬롯은 그 좌표들 중 **추천 자리 목록**이었을 뿐이고, 물리는 하나다.
     그래서 자유 배치는 새 물리가 아니라 **같은 물리에 좌표를 하나 더 넣는 일**이다.

   자리 한 개 = `at`
     { x, y, z, rotY, onUid, occIdx }
       x,y,z   방 좌표. 방은 원점 중심이다 — x∈[-w/2,w/2] · z∈[-d/2,d/2] · y∈[0,h]
       rotY    화분이 바라보는 각[rad]. 조도와 무관하고 보기용이다.
       onUid   올라앉은 가구의 uid. **바닥이면 null**
       occIdx  그 가구의 차폐체 번호 — 자가차폐 제외용(daily_light 이 selfIdx 로 쓴다).
               바닥이거나 그 가구가 차폐체가 아니면 null

   ★ fail-loud
     이 저장소 규약이다. 좌표가 NaN·무한대거나 방 밖이면 **조용히 0으로 메꾸지 않는다.**
     `assertAt` 은 던지고 `validateAt` 은 이유를 말한다. 부르는 쪽이 고르면 된다.
============================================================ */

export const PLACE_SCHEMA = 'pot_place/1';

/* ★ 자유 좌표로 놓인 것의 계약 slotId — `free:{그 물건의 id}`
   슬롯 위에 앉았으면 그 슬롯의 안정 slotId 를 그대로 쓴다(세이브 하위호환).
   슬롯을 벗어난 것만 이 접두사를 단다. 둘을 섞으면 계약에 같은 자리가 두 번 실린다.
   ★ 화분 전용이 아니다 — 콩나물 시루도 같은 규칙을 탄다(2026-08-03). */
export const FREE_PREFIX = 'free:';
export const freeSlotId = (id) => FREE_PREFIX + String(id);
export const isFreeSlotId = (id) => typeof id === 'string' && id.startsWith(FREE_PREFIX);

/* 좌표가 '같은 자리'인지 보는 기본 허용오차[m]. house.js 가 슬롯 좌표를 소수 셋째 자리로
   반올림해 내므로(toFixed(3)) 그보다 굵게 잡는다. */
export const SAME_POINT_EPS = 0.005;

/* ============================================================
   ★ 바닥 격자 (2026-08-03 박사님 지시)
   ------------------------------------------------------------
   "바닥에 그리드를 통한 칸수로 조절하자. 전체 가구나 화분 다 네모난 그리드
    최소치를 작게 해서 거기 배수로 사이즈 맞춰서 하자."

   ── 왜 0.05 m 인가 (짐작이 아니라 재서 정했다) ──────────────────────────
   방 여섯 개의 가구 89개·슬롯 320칸·치수 39종을 전부 뽑아 후보를 비교했다.

     칸      가구 치수가 그대로 떨어짐   가구 좌표     방 치수
     0.05    54%                        66%          100%
     0.10    46%                        43%          100%
     0.125   13%                        20%          100%
     0.20    28%                        21%          100%

   ① 방 치수가 전부 정수 m(4·5·6·7·10·11·12)라 어느 후보든 방은 나누어떨어진다.
      가르는 것은 **가구**다 — 0.05 가 제일 잘 맞고, 안 맞아도 올림 오차가 최대 0.04 다.
      0.25 로 잡으면 0.82m 짜리가 1.00m 로 세어져 22% 부풀고, 그러면 원래 있던 자리에도
      못 들어간다. "최소치를 작게" 라는 지시가 실제로 이 오차를 줄인다.
   ② 몬스테라 화분 0.202 m → **정확히 5칸(0.25 m)**. 그리고 창턱 슬롯 간격(house.js
      SILL_GRID)·floor_nav 의 BFS 칸·decorate.js 의 가구 스냅이 **전부 0.25** 다.
      즉 0.05 는 새 눈금이 아니라 **이 저장소가 이미 쓰는 0.25 격자를 다섯 등분한 것**이다.
   ③ 이보다 잘게(0.025) 가면 5m 방에서 한 칸이 폰 화면 2px 라 안내가 안 된다.

   ── 두 눈금을 쓴다 ──────────────────────────────────────────────────
     UNIT 0.05  **크기를 세는 단위.** 모든 치수를 이 배수로 센다(칸 수). 배치 좌표도 여기 맞춘다
     CELL 0.25  **눈에 보이는 칸.** 화면에 그리는 격자. UNIT 다섯 개다
   크기는 잘게(정확하게), 눈금은 굵게(읽히게) — 둘을 같은 값으로 두면 하나가 반드시 나쁘다.

   ── 올림이다 (내림이 아니다) ────────────────────────────────────────
   실제 치수가 칸에 안 떨어지면 **올린다.** 내리면 실제보다 작게 세어 "들어간다"고 해 놓고
   겹친다 — 조용히 틀리는 쪽이다. 올리면 못 놓는 자리가 조금 생길 뿐이고 그건 눈에 보인다.
   이 저장소의 fail-loud 규약과 같은 방향이다.
============================================================ */
export const GRID_UNIT = 0.05;    // 크기를 세는 최소 칸[m]
export const GRID_CELL = 0.25;    // 화면에 그리는 칸[m] = UNIT 5개

/* 길이 → 칸 수(올림). 0 이하는 1칸으로 본다 — 넓이 0 짜리 물건은 없다. */
export function unitsFor(m, unit = GRID_UNIT) {
  if (!isNum(m) || m <= 0) return 1;
  return Math.max(1, Math.ceil(m / unit - 1e-9));
}
/* 칸 수 → 길이[m] */
export const unitsToM = (n, unit = GRID_UNIT) => n * unit;

/* 발자국 한 변을 격자에 앉힌다.
   ★ 칸 **중심**이 아니라 **앞 모서리**를 격자선에 맞춘다.
     중심에 맞추면 짝수 칸짜리 물건이 늘 반 칸 어긋나 점유 칸이 정수가 아니게 된다.
     모서리를 맞추면 홀수·짝수 어느 쪽이든 점유 칸이 정확히 n 개다.
   center 는 그 변의 한가운데, sizeM 은 그 변의 길이다. 돌려주는 것도 한가운데다. */
export function snapSpan(center, sizeM, unit = GRID_UNIT) {
  if (!isNum(center)) throw new RangeError(`[격자] 중심이 유한하지 않습니다: ${center}`);
  const n = unitsFor(sizeM, unit);
  const half = n * unit / 2;
  return Math.round((center - half) / unit) * unit + half;
}
/* 점 하나를 격자에 맞춘다(크기 없는 것 — 커서 등). 칸 중심으로 간다. */
export function snapPoint(v, unit = GRID_UNIT) {
  if (!isNum(v)) throw new RangeError(`[격자] 좌표가 유한하지 않습니다: ${v}`);
  return Math.round(v / unit) * unit;
}

/* 회전은 90° 단위다.
   ★ 근거: 격자가 축정렬 네모라 45° 로 돌리면 발자국이 칸에 안 떨어져 '정수 칸 점유'가
     통째로 무너진다(회전 사각형의 칸 점유를 다시 근사해야 한다 — 격자를 쓰는 이유가 사라진다).
     그리고 **방 데이터의 기존 회전값이 이미 전부 90° 배수다**(-90·0·90·180 넷뿐 · 89개 전수 확인).
     즉 90° 단위는 새 제약이 아니라 데이터가 이미 지키던 규칙이다. */
export function snapAngleDeg(deg, step = 90) {
  if (!isNum(deg)) return 0;
  return ((Math.round(deg / step) * step) % 360 + 360) % 360;
}

/* 발자국이 차지하는 칸 상자 — 겹침 판정을 정수로 만든다.
     rect = { x, z, w, d, rot(라디안) }  rot 은 90° 배수로 본다
   반환 { i0, j0, ni, nj } — i 는 x축, j 는 z축 칸 번호(방 원점 기준, 음수 가능) */
export function cellBox(rect, unit = GRID_UNIT) {
  if (!rect) throw new TypeError('[격자] cellBox: 사각형이 필요합니다');
  for (const k of ['x', 'z', 'w', 'd']) {
    if (!isNum(rect[k])) throw new RangeError(`[격자] cellBox: ${k} 가 유한하지 않습니다: ${rect[k]}`);
  }
  /* 90° 배수면 폭·깊이가 통째로 뒤바뀔 뿐이다 */
  const q = Math.round(((rect.rot || 0) / (Math.PI / 2)) % 4);
  const swap = Math.abs(q) % 2 === 1;
  const w = swap ? rect.d : rect.w, d = swap ? rect.w : rect.d;
  const ni = unitsFor(w, unit), nj = unitsFor(d, unit);
  return {
    i0: Math.round((rect.x - ni * unit / 2) / unit),
    j0: Math.round((rect.z - nj * unit / 2) / unit),
    ni, nj
  };
}
/* 칸 상자 두 개가 겹치나 — 정수 비교뿐이라 오차가 없다.
   (판때기 발자국을 실수로 재던 것과 달리 "0.01m 모자란다" 같은 일이 아예 안 생긴다) */
export function cellBoxOverlap(a, b) {
  return a.i0 < b.i0 + b.ni && b.i0 < a.i0 + a.ni
      && a.j0 < b.j0 + b.nj && b.j0 < a.j0 + a.nj;
}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const why = (reason) => ({ ok: false, reason });
const OK = { ok: true, reason: null };

/* ------------------------------------------------------------------
   1. 방 경계
------------------------------------------------------------------ */
/* 방은 원점 중심이다(house.js: 바닥 y=0, 천장 y=CH, x·z 는 ±치수/2).
   margin>0 이면 벽에서 그만큼 떨어져야 통과한다. */
export function inRoom(p, size, margin = 0) {
  if (!size || !isNum(size.w) || !isNum(size.d)) return false;
  if (!p || !isNum(p.x) || !isNum(p.y) || !isNum(p.z)) return false;
  const h = isNum(size.h) ? size.h : Infinity;
  const e = 1e-6;                       // 경계에 정확히 놓인 슬롯(창턱 등)을 떨구지 않는다
  return Math.abs(p.x) <= size.w / 2 - margin + e
      && Math.abs(p.z) <= size.d / 2 - margin + e
      && p.y >= -e && p.y <= h + e;
}

/* 방 바닥을 하나의 면으로 본다 — `fitsOn` 에 그대로 넘길 수 있다. */
export function floorSurface(size) {
  if (!size || !isNum(size.w) || !isNum(size.d))
    throw new TypeError('[배치] floorSurface: 방 치수 {w,d} 가 필요합니다');
  return { uid: null, x: 0, z: 0, w: size.w, d: size.d, rotY: 0, top: 0, maxPotD: null };
}

/* ------------------------------------------------------------------
   2. 자리(at) 만들기·검증
------------------------------------------------------------------ */
/* 검증만 한다(던지지 않는다). opt.size 를 주면 방 안인지도 본다.
     opt = { size, margin, requireSurface }
   requireSurface:true 면 onUid 가 반드시 있어야 한다(바닥 배치 금지). */
export function validateAt(at, opt = {}) {
  if (!at || typeof at !== 'object') return why('자리 객체가 아닙니다');
  for (const k of ['x', 'y', 'z']) {
    if (!(k in at)) return why(`${k} 가 없습니다`);
    if (typeof at[k] !== 'number') return why(`${k} 가 숫자가 아닙니다: ${at[k]}`);
    if (Number.isNaN(at[k])) return why(`${k} 가 NaN 입니다`);
    if (!Number.isFinite(at[k])) return why(`${k} 가 무한대입니다: ${at[k]}`);
  }
  if (at.rotY != null && !isNum(at.rotY)) return why(`rotY 가 유한한 숫자가 아닙니다: ${at.rotY}`);

  const hasUid = at.onUid != null;
  if (hasUid && (typeof at.onUid !== 'string' || !at.onUid))
    return why(`onUid 는 비어 있지 않은 문자열이거나 null 이어야 합니다: ${at.onUid}`);
  if (at.occIdx != null) {
    if (!Number.isInteger(at.occIdx) || at.occIdx < 0)
      return why(`occIdx 는 0 이상 정수이거나 null 이어야 합니다: ${at.occIdx}`);
    /* 바닥인데 자가차폐 제외 번호가 붙어 있으면 **남의 가구 그림자를 지운다.**
       조용히 두면 그 화분만 이유 없이 밝아진다 — 여기서 막는다. */
    if (!hasUid) return why('바닥 자리(onUid=null)에 occIdx 가 붙어 있습니다');
  }
  if (opt.requireSurface && !hasUid) return why('올라앉을 가구(onUid)가 없습니다');

  if (opt.size && !inRoom(at, opt.size, opt.margin || 0)) {
    const s = opt.size;
    return why(`방 밖입니다 — (${at.x}, ${at.y}, ${at.z}) / 방 ${s.w}×${s.d}×${s.h}`);
  }
  return OK;
}

/* 검증하고 던진다. 부르는 쪽이 "일단 넣고 나중에 보자"를 못 하게 하는 문이다. */
export function assertAt(at, opt = {}) {
  const v = validateAt(at, opt);
  if (!v.ok) throw new RangeError(`[배치] 자리가 올바르지 않습니다 — ${v.reason}`);
  return at;
}

/* 정규화된 자리를 만든다. **빠진 좌표를 0으로 메꾸지 않는다** — 없으면 던진다.
   메꿔 주면 "왜 화분이 방 한가운데로 갔지"가 되고 원인을 못 찾는다. */
export function makeAt(raw, opt = {}) {
  if (!raw || typeof raw !== 'object')
    throw new TypeError('[배치] makeAt: {x,y,z} 가 필요합니다');
  const at = {
    x: raw.x, y: raw.y, z: raw.z,
    rotY: raw.rotY == null ? 0 : raw.rotY,
    onUid: raw.onUid == null ? null : raw.onUid,
    occIdx: raw.occIdx == null ? null : raw.occIdx
  };
  assertAt(at, opt);
  return at;
}

/* 추천 자리(house 의 plantSlot) → 좌표 자리.
   slotId 는 `{가구 uid}:{단}` 이라 마지막 ':' 앞이 uid 다(uid 안에는 ':' 이 없다). */
export function atFromSlot(slot, opt = {}) {
  if (!slot) throw new TypeError('[배치] atFromSlot: 슬롯이 없습니다');
  const id = String(slot.slotId ?? '');
  const cut = id.lastIndexOf(':');
  const uid = slot.uid ?? (cut > 0 ? id.slice(0, cut) : null);
  return makeAt({
    x: slot.x, y: slot.y, z: slot.z,
    rotY: opt.rotY == null ? 0 : opt.rotY,
    onUid: uid || null,
    /* 슬롯에 occIdx 가 없는 방(정적 프로파일)은 null 로 둔다 — 지어내지 않는다.
       자가차폐가 안 빠지면 값이 조금 어두워질 뿐, 틀린 자리로 가지는 않는다. */
    occIdx: uid && Number.isInteger(slot.occIdx) ? slot.occIdx : null
  }, opt);
}

/* ------------------------------------------------------------------
   2-1. ★ 가구를 따라간다 — followFurnitureAt (2026-08-16 · B-5)
------------------------------------------------------------------ */
/* 박사님: *"가구 옮길 때 위에 식물들도 같이 옮겨지기 및 돌리기도"*

   ■ 무엇이 잘못돼 있었나 — 재서 확인했다(tools/probe_place_b5.mjs)
     추천 자리(slotId) 위 화분은 `state.reseatAllOnSlots` 가 따라가게 해 준다.
     그런데 **자유 좌표 화분**(`free:…` · `at.onUid` 로 가구 위에 얹힌 것)은 아무도 안 옮겼다.
     `reseatOnSlot` 이 첫 줄에서 `isFreeSlotId` 를 그냥 빼고 있었기 때문이다.
     실측(책상을 x 1.30 → 0.75 로):
       방뷰(3D)  화분 x 0.80 → **0.25** — 잘 따라간다(room_view.followFurniture)
       세이브    `at.x` **0.80 그대로** — 안 따라간다
       상태로 다시 그리면 화분이 **0.80** 으로 되돌아간다 = 책상 밖 허공
     ⇒ 화면만 따라가고 정본은 제자리였다. 새로고침 한 번이면 도로 어긋난다.

   ■ 이 함수가 정본이다
     `room_view.moveWithFurniture` 와 **같은 식**이다(house.js 좌표 규약:
       X = x0 + u·cos + v·sin · Z = z0 − u·sin + v·cos).
     THREE 가 없어 상태 쪽에서도 그대로 쓴다 — 두 벌로 두면 화면과 세이브가 또 갈린다.
   ⚠ from·to 의 `rot` 은 **도(°)** 다(가구 규약). `at.rotY` 는 **라디안**이다(화분 규약).
     섞으면 57배 돌아간다 — place.js 머리말의 그 경고와 같은 자리다. */
export function followFurnitureAt(at, from, to) {
  if (!at || !from || !to) throw new TypeError('[배치] followFurnitureAt: at·from·to 가 필요합니다');
  for (const k of ['x', 'z']) {
    if (!isNum(from[k]) || !isNum(to[k]))
      throw new RangeError(`[배치] followFurnitureAt: 가구 ${k} 가 유한하지 않습니다`);
  }
  const fr = (isNum(from.rot) ? from.rot : 0) * Math.PI / 180;
  const tr = (isNum(to.rot) ? to.rot : 0) * Math.PI / 180;
  const c = Math.cos(fr), s = Math.sin(fr);
  const dx = at.x - from.x, dz = at.z - from.z;
  const u = dx * c - dz * s, v = dx * s + dz * c;
  const c2 = Math.cos(tr), s2 = Math.sin(tr);
  const fy = isNum(from.y) ? from.y : 0;
  const ty = isNum(to.y) ? to.y : fy;
  return {
    ...at,
    x: +(to.x + u * c2 + v * s2).toFixed(6),
    z: +(to.z - u * s2 + v * c2).toFixed(6),
    y: +((at.y || 0) + (ty - fy)).toFixed(6),
    rotY: (at.rotY || 0) + (tr - fr)
  };
}

/* ------------------------------------------------------------------
   3. 거리·가까운 추천 자리
------------------------------------------------------------------ */
export function distance(a, b) {
  return Math.hypot((a.x ?? 0) - (b.x ?? 0), (a.y ?? 0) - (b.y ?? 0), (a.z ?? 0) - (b.z ?? 0));
}
export function distanceXZ(a, b) {
  return Math.hypot((a.x ?? 0) - (b.x ?? 0), (a.z ?? 0) - (b.z ?? 0));
}
export function samePoint(a, b, eps = SAME_POINT_EPS) {
  return !!a && !!b && Math.abs(a.x - b.x) <= eps
                    && Math.abs(a.y - b.y) <= eps
                    && Math.abs(a.z - b.z) <= eps;
}

/* 제일 가까운 추천 자리와 거리. UI 의 '원형 가이딩'(가까이 가면 자리에 붙는다)이 쓴다.
     opt.maxDist  이 거리를 넘으면 null (붙지 않는다)
     opt.potD     주면 그 화분이 못 올라가는 자리는 후보에서 뺀다(maxPotD 비교)
   반환 { slot, dist, distXZ } — 자리는 원본 슬롯 객체 그대로다. */
export function nearestSlot(at, slots, opt = {}) {
  if (!at || !isNum(at.x) || !isNum(at.y) || !isNum(at.z))
    throw new RangeError('[배치] nearestSlot: 기준 좌표가 유한하지 않습니다');
  let best = null;
  for (const s of slots || []) {
    if (!s || !isNum(s.x) || !isNum(s.y) || !isNum(s.z)) continue;
    if (isNum(opt.potD) && !slotHolds(s, opt.potD)) continue;
    const d = distance(at, s);
    if (!best || d < best.dist) best = { slot: s, dist: d, distXZ: distanceXZ(at, s) };
  }
  if (!best) return null;
  if (isNum(opt.maxDist) && best.dist > opt.maxDist) return null;
  return best;
}

/* 그 슬롯이 지름 potD 화분을 받는가. maxPotD 가 숫자가 아니면 **모른다 = 못 받는다** 로 본다
   (loop.js 의 첫 플레이 후보 고르기와 같은 규약 — 결측을 관대하게 넘기지 않는다). */
export function slotHolds(slot, potD) {
  return isNum(slot && slot.maxPotD) && isNum(potD) && potD <= slot.maxPotD + 1e-9;
}

/* ------------------------------------------------------------------
   3-1. ★ 좌표 하나 → (계약 열쇠, 정규화된 자리)  (2026-08-03)
------------------------------------------------------------------ */
/* 불변식을 세우는 **유일한 곳**이다. 화분(state.setPotAt)도 콩나물 시루(first_play)도
   여기를 지난다 — 두 곳에서 따로 세우면 한쪽만 고쳐지고 나머지가 조용히 어긋난다.

     추천 자리에 붙으면  slotId = 그 자리의 안정 id   · at = 그 자리 좌표
     벗어나면            slotId = `free:{id}`         · at = 준 좌표

   ★ 붙이기는 '가까우면 그 자리 이름만 쓴다'가 아니라 '그 자리로 간다'다 — 좌표까지 슬롯 값이 된다.
     이름만 바꾸면 계약이 두 자리(빈 슬롯 + 그 물건)를 같은 이름으로 부른다.

     id    자유 좌표일 때 계약 열쇠에 붙일 이름 (화분 id · 콩나물 id)
     opt   { size: 방 치수, slots: 추천 자리 배열, snapDist: 이 거리 안이면 붙는다 }
   반환 { slotId, at, snappedTo, dist } */
export function resolvePlacement(id, at, opt = {}) {
  if (!id && id !== 0) throw new TypeError('[배치] resolvePlacement: 자유 좌표 id 가 필요합니다');
  const next = makeAt(at, { size: opt.size });
  const snap = opt.snapDist ?? 0;
  const near = (opt.slots && opt.slots.length)
    ? nearestSlot(next, opt.slots, { maxDist: snap > 0 ? snap : undefined }) : null;
  if (near && (snap > 0 ? near.dist <= snap : samePoint(next, near.slot)))
    return { slotId: near.slot.slotId, at: atFromSlot(near.slot, { rotY: next.rotY }),
             snappedTo: near.slot.slotId, dist: near.dist };
  return { slotId: freeSlotId(id), at: next, snappedTo: null, dist: near ? near.dist : null };
}

/* 자리를 가리키는 입력 세 가지를 하나로 푼다. UI·루프·옛 세이브가 서로 다른 모양을 들고 온다.
     문자열          추천 자리 id      (옛 경로 · 헤드리스 시뮬 · <select> 값)
     {x,y,z,...}     좌표             → resolvePlacement 가 불변식을 세운다
     {slotId, at}    이미 자리를 가진 물건(화분 등) → 그대로 베낀다
   반환 { slotId, at, snappedTo, dist } — at 은 알 수 없으면 null 이다(지어내지 않는다). */
export function spotOf(target, opt = {}) {
  if (target == null || target === '')
    throw new Error('[배치] 놓을 자리가 없습니다 — 자리 이름이나 좌표를 주세요');

  if (typeof target === 'string') {
    const s = (opt.slots || []).find(x => x && x.slotId === target);
    const usable = s && [s.x, s.y, s.z].every(v => typeof v === 'number' && Number.isFinite(v));
    return { slotId: target, at: usable ? atFromSlot(s, { rotY: opt.rotY }) : null,
             snappedTo: usable ? target : null, dist: 0 };
  }
  if (typeof target !== 'object')
    throw new TypeError(`[배치] 자리를 알 수 없는 값입니다: ${typeof target}`);

  /* 이미 자리를 가진 물건 — 좌표가 있으면 같이 베낀다(없으면 예전처럼 이름만 돈다) */
  if (typeof target.slotId === 'string' && !('x' in target))
    return { slotId: target.slotId, at: target.at ? makeAt(target.at, { size: opt.size }) : null,
             snappedTo: null, dist: null };

  return resolvePlacement(opt.id, target, opt);
}

/* ------------------------------------------------------------------
   4. 면 위에 들어가는가
------------------------------------------------------------------ */
/* surface = { x, z, w, d, rotY, top, maxPotD }  — 가구 상판(또는 floorSurface(size))
   화분 발자국은 지름 potD 원으로 본다(회전 무관 지름. 방뷰가 쓰는 기준과 같다).

   반환 { ok, reason, margin } — margin 은 가장자리까지 남은 여유[m]. 음수면 삐져나온 양이다. */
export function fitsOn(at, potD, surface, opt = {}) {
  if (!surface) return { ...why('올려놓을 면이 없습니다'), margin: null };
  if (!isNum(potD) || potD <= 0)
    return { ...why(`화분 지름이 유한한 양수가 아닙니다: ${potD}`), margin: null };
  for (const k of ['x', 'z', 'w', 'd']) {
    if (!isNum(surface[k])) return { ...why(`면의 ${k} 가 유한하지 않습니다: ${surface[k]}`), margin: null };
  }
  const v = validateAt(at);
  if (!v.ok) return { ...v, margin: null };

  /* 면이 정한 상한이 있으면 그게 먼저다 — 창턱 한 칸(0.21) 같은 값 */
  if (isNum(surface.maxPotD) && potD > surface.maxPotD + 1e-9)
    return { ...why(`화분 지름 ${potD} > 면 한도 ${surface.maxPotD}`), margin: +(surface.maxPotD - potD).toFixed(4) };

  /* 높이 — 면 위에 놓였는가. tol 을 넘게 뜨거나 잠기면 그건 다른 면이다. */
  const tol = opt.yTol ?? 0.05;
  if (isNum(surface.top) && Math.abs(at.y - surface.top) > tol)
    return { ...why(`높이가 면 상판(${surface.top})과 ${Math.abs(at.y - surface.top).toFixed(3)}m 어긋납니다`), margin: null };

  /* 면 좌표계로 옮긴다(면 회전을 되돌린다) */
  const rot = isNum(surface.rotY) ? surface.rotY : 0;
  const dx = at.x - surface.x, dz = at.z - surface.z;
  const c = Math.cos(-rot), s = Math.sin(-rot);
  const u = dx * c - dz * s;
  const w = dx * s + dz * c;

  const r = potD / 2;
  const mu = surface.w / 2 - Math.abs(u) - r;
  const mw = surface.d / 2 - Math.abs(w) - r;
  const margin = +Math.min(mu, mw).toFixed(4);
  if (margin < 0) return { ...why(`면 밖으로 ${(-margin).toFixed(3)}m 삐져나옵니다`), margin };
  return { ok: true, reason: null, margin };
}

/* 추천 자리들로부터 그 가구의 면을 만든다.
   가구 메시(THREE)를 안 보고도 `fitsOn` 을 쓸 수 있게 하는 우회로다 —
   슬롯 점들의 축정렬 경계상자에 화분 반지름만큼 여유를 준다.
   ⚠ 근사다. 정확한 상판이 필요하면 3D 쪽에서 직접 면을 만들어 넘겨라. */
export function surfaceFromSlots(uid, slots) {
  const mine = (slots || []).filter(s => s && String(s.slotId).startsWith(uid + ':')
                                      && isNum(s.x) && isNum(s.z) && isNum(s.y));
  if (!mine.length) return null;
  const pad = Math.max(...mine.map(s => (isNum(s.maxPotD) ? s.maxPotD : 0))) / 2;
  const xs = mine.map(s => s.x), zs = mine.map(s => s.z);
  const x0 = Math.min(...xs) - pad, x1 = Math.max(...xs) + pad;
  const z0 = Math.min(...zs) - pad, z1 = Math.max(...zs) + pad;
  return {
    uid, x: (x0 + x1) / 2, z: (z0 + z1) / 2,
    w: Math.max(x1 - x0, 1e-3), d: Math.max(z1 - z0, 1e-3),
    rotY: 0, top: mine[0].y,
    maxPotD: Math.max(...mine.map(s => (isNum(s.maxPotD) ? s.maxPotD : 0))) || null
  };
}

/* ------------------------------------------------------------------
   5. 가구 자리
------------------------------------------------------------------ */
/* S.home.furniture 에 들어갈 한 칸을 검증한다. rot 는 **도(°)** 다 — house_rooms.json 과 같은 단위.
   (화분 rotY 는 라디안이다. 단위가 다른 건 각자 원본 데이터를 따르기 때문이고,
    섞이면 가구가 57배 돌아간다 — 이름을 다르게 둔 이유다.) */
export function validateFurnitureAt(pos, opt = {}) {
  if (!pos || typeof pos !== 'object') return why('가구 자리 객체가 아닙니다');
  for (const k of ['x', 'z']) {
    if (!isNum(pos[k])) return why(`${k} 가 유한한 숫자가 아닙니다: ${pos[k]}`);
  }
  if (pos.rot != null && !isNum(pos.rot)) return why(`rot 가 유한한 숫자가 아닙니다: ${pos.rot}`);
  if (pos.y != null && !isNum(pos.y)) return why(`y 가 유한한 숫자가 아닙니다: ${pos.y}`);
  if (opt.size && !inRoom({ x: pos.x, y: 0, z: pos.z }, opt.size, opt.margin || 0))
    return why(`방 밖입니다 — (${pos.x}, ${pos.z}) / 방 ${opt.size.w}×${opt.size.d}`);
  return OK;
}

export function assertFurnitureAt(pos, opt = {}) {
  const v = validateFurnitureAt(pos, opt);
  if (!v.ok) throw new RangeError(`[배치] 가구 자리가 올바르지 않습니다 — ${v.reason}`);
  return pos;
}
