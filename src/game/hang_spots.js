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
     only 그 자리에만 걸 수 있는 «판 갈래»(투룸 «주문판 자리» = 'order_board') — 그 갈래의 판(BOARD_KIND)만 걸리고, 판은 그런 자리에만 걸린다
   진로가 방에 남기는 것(판 이름 · 간판 한 자리 — boardAs · signOf)도 여기 둔다: 순수 함수라 game.html·검사가 같이 쓴다.
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

/* ★ 2026-10-23 [house] D73 «판 갈래» — 진로마다 판 자리(가게 방 뒷벽 창 옆)의 판이 다르다(가게 주문판 · 돌봄 맡김판). 모델·자리는 하나라
     자리 데이터는 그대로(only:'order_board' · game.html 이 그 값으로 판 자리를 찾는다) 두고, 어느 판이 그 갈래인지는 여기서 묶는다 */
export const BOARD_KIND = Object.freeze({ order_board: 'order_board', care_board: 'order_board', memo_board: 'order_board' });
const BOARD_KO = Object.freeze({ order_board: '주문판', care_board: '맡김판', memo_board: '메모판' });

/* ★ 2026-10-24 [house] D83 · D75 판 이름이 진로를 따른다(끝맺음 명세 §2-3) — 받은 판(order_board · care_board)은 진로를 바꿔도 그 자리에 그대로 두고
     부르는 이름만 지금 진로의 판으로 바꾼다: 가게 order_board «가게 주문판» · 돌봄 care_board «맡김판» · 육종 memo_board «메모판»(이름·소개는 그 프리셋 name_ko·intro_ko).
     jobId 는 job_shop JOB_IDS('shop' | 'care' | 'breed')다. 안 주거나 모르는 키면 그 판 제 프리셋 그대로 — 진로 키를 넘기기 전엔 지금 화면 그대로다.
     판이 아닌 프리셋은 늘 그대로 돌려준다(이름 찾는 곳마다 감싸도 된다: furnPresets[boardAs(f.preset, jobId)].name_ko) */
export const BOARD_BY_JOB = Object.freeze({ shop: 'order_board', care: 'care_board', breed: 'memo_board' });
export function boardAs(preset, jobId) {
  return BOARD_KIND[preset] && BOARD_BY_JOB[jobId] ? BOARD_BY_JOB[jobId] : preset;
}

/* 그 그림이 그 자리에 걸릴 수 있나(크기 · 전용 자리). 비었나는 부르는 쪽이 본다.
   jobId(선택) — 판의 까닭 글을 지금 진로의 판 이름으로(boardAs). code — 까닭을 글 대신 가르는 이름(글은 바뀔 수 있다):
   'no_spot' · 'other_only'(남의 전용 자리) · 'board_only'(판은 판 자리에만) · 'too_wide' · 'too_tall' */
export function hangFits(spot, preset, size = {}, jobId = null) {
  if (!spot) return { ok: false, reason: '걸이 자리가 없습니다', code: 'no_spot' };
  const kind = BOARD_KIND[preset] || null;
  if (spot.only && spot.only !== (kind || preset)) return { ok: false, reason: '이 자리는 다른 것을 거는 자리입니다', code: 'other_only' };
  if (!spot.only && kind) { const ko = BOARD_KO[boardAs(preset, jobId)] || '판'; return { ok: false, reason: `${ko}은 ${ko} 자리에만 겁니다`, code: 'board_only' }; }   // 글 꼴 그대로 — game.html hangChoices 가 «주문판은 주문판 자리에만» 으로 센다
  if (spot.maxW > 0 && size.w > spot.maxW + 1e-6) return { ok: false, reason: `자리보다 넓습니다 (${size.w}m > ${spot.maxW}m)`, code: 'too_wide' };
  if (spot.maxH > 0 && size.h > spot.maxH + 1e-6) return { ok: false, reason: `자리보다 큽니다 (${size.h}m > ${spot.maxH}m)`, code: 'too_tall' };
  return { ok: true, reason: null };
}

/* ★ 2026-10-24 [house] D83 · D75 간판 한 자리(끝맺음 명세 §2-3) — 가게 입간판(단골 10)과 돌봄 칠판 간판(살린 10)은 같은 모형 · 같은 자리다
     (furniture_dress PROPS.tworoom shop_sign · 깃발 shopSign 하나 · room_view setShopSign). 둘이 같이 서지 못한다.
     먼저 선 진로의 간판이 남는다 — 진로를 바꿔도 안 걷힌다(«가게 단골 10 에서 선 간판은 남는다»).
     자리가 이미 찼을 때 닿은 다른 진로의 10 보상은 글 배너다(가게가 뒤에 와도 같은 셈).
     signDays = { shop: jobShop.signOnDay | null, care: jobCare.signOnDay | null } (진로 키는 JOB_IDS 그대로)
     → { on: 간판이 서나, by: 선 간판의 진로 | null, banner: 10 보상을 배너로 받은 진로들(먼저 닿은 차례) } */
export const SIGN_JOBS = Object.freeze(['shop', 'care']);
export function signOf(signDays = {}) {
  const got = SIGN_JOBS.map((id, i) => ({ id, i, d: (signDays || {})[id] }))
    .filter(x => typeof x.d === 'number' && Number.isFinite(x.d))
    .sort((a, b) => a.d - b.d || a.i - b.i);
  return { on: got.length > 0, by: got.length ? got[0].id : null, banner: got.slice(1).map(x => x.id) };
}

/* 어느 자리에 걸려 있나 — 놓인 자리표(x·z·y)가 그 자리 자리표와 2cm 안이면 그 자리다(세이브 꼴을 안 바꾼다). */
export function hangSpotAt(spots, roomSize, pos, size) {
  for (const s of spots) {
    const q = hangPoseOf(s, roomSize, size);
    if (Math.abs(q.x - pos.x) < 0.02 && Math.abs(q.z - pos.z) < 0.02 && Math.abs(q.y - pos.y) < 0.02) return s;
  }
  return null;
}
