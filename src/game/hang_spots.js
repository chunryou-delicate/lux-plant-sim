/* ============================================================
   src/game/hang_spots.js — 벽 걸이 v1 «걸이 자리» ([house] · 2026-10-10 · 총괄 결정)
   ------------------------------------------------------------
   방마다 벽에 걸 자리를 정해 둔다(house_rooms.rooms.<방>.hangSpots). 산 그림(mount «wall-hang»)은
   비어 있는 자리 하나에 걸린다. 자리 → 놓일 자리표(x·z·rot·y)는 여기 한 곳에서만 낸다 —
   room_view(원 · 옮기기)와 검사가 같은 셈을 쓴다.

   자리 꼴: { id, wall: 'back'|'front'|'left'|'right', cu, cy, maxW, maxH, only? }
     cu   벽을 따라간 거리(창·문 cu 와 같은 규약 — house.js wallPlacement · outside.js frameFor)
          back +x · front −x · left −z · right +z
     cy   그림 가운데 높이(m)
     only 그 자리에만 걸 수 있는 프리셋(투룸 «주문판 자리» = 'order_board')
   ⚠ 벽 두께 0.2(house.js WT) — 안쪽 면은 방 반폭 − 0.10. 그림 뒷면이 그 면에 닿게 d/2 만큼 안으로.
============================================================ */
const WT = 0.2;
const N = { back: [0, -1], front: [0, 1], left: [-1, 0], right: [1, 0] };           // 벽 바깥 법선 [x, z]
const ROT = { back: 0, front: 180, left: 90, right: -90 };                          // 앞(+Z)이 방 안을 보게(도)

export function hangSpotsOf(roomDef) {
  return Array.isArray(roomDef && roomDef.hangSpots) ? roomDef.hangSpots : [];
}

/* 자리 + 그림 크기 → 자리표. size = { w, h, d } (프리셋 size_m). */
export function hangPoseOf(spot, roomSize, size = {}) {
  const n = N[spot && spot.wall];
  if (!n) throw new Error(`[걸이 자리] 모르는 벽입니다: ${JSON.stringify(spot && spot.wall)}`);
  if (!roomSize || !(roomSize.w > 0) || !(roomSize.d > 0)) throw new Error('[걸이 자리] 방 크기가 없습니다');
  const half = (spot.wall === 'back' || spot.wall === 'front') ? roomSize.d / 2 : roomSize.w / 2;
  const t = half - WT / 2 - (size.d > 0 ? size.d : 0.01) / 2 - 0.002;                // 벽 안쪽 면에서 d/2 + 2mm
  const r = [-n[1], n[0]];                                                          // 벽을 따라가는 방향(= n × up 의 x·z)
  const cu = +spot.cu || 0;
  return { x: +(n[0] * t + r[0] * cu).toFixed(4), z: +(n[1] * t + r[1] * cu).toFixed(4),
           rot: ROT[spot.wall], y: +(+spot.cy).toFixed(4) };
}

/* 그 그림이 그 자리에 걸릴 수 있나(크기 · 전용 자리). 비었나는 부르는 쪽이 본다. */
export function hangFits(spot, preset, size = {}) {
  if (!spot) return { ok: false, reason: '걸이 자리가 없습니다' };
  if (spot.only && spot.only !== preset) return { ok: false, reason: '이 자리는 다른 것을 거는 자리입니다' };
  if (!spot.only && preset === 'order_board') return { ok: false, reason: '주문판은 주문판 자리에만 겁니다' };
  if (spot.maxW > 0 && size.w > spot.maxW + 1e-6) return { ok: false, reason: `자리보다 넓습니다 (${size.w}m > ${spot.maxW}m)` };
  if (spot.maxH > 0 && size.h > spot.maxH + 1e-6) return { ok: false, reason: `자리보다 큽니다 (${size.h}m > ${spot.maxH}m)` };
  return { ok: true, reason: null };
}

/* 어느 자리에 걸려 있나 — 놓인 자리표(x·z·y)가 그 자리 자리표와 2cm 안이면 그 자리다(세이브 꼴을 안 바꾼다). */
export function hangSpotAt(spots, roomSize, pos, size) {
  for (const s of spots) {
    const q = hangPoseOf(s, roomSize, size);
    if (Math.abs(q.x - pos.x) < 0.02 && Math.abs(q.z - pos.z) < 0.02 && Math.abs(q.y - pos.y) < 0.02) return s;
  }
  return null;
}
