/* ============================================================
   engine/daylight_lux.js — 조도(lx) 물리 계산 · 단일 소스
   ------------------------------------------------------------
   tool.html(정밀 조도툴)의 계산식을 그대로 순수 함수로 추출한 것.
   게임뷰와 정밀툴이 "같은 함수"를 써야 결과가 어긋나지 않는다.
   (기존: engine/lighting.js = 간이 휴리스틱, tool.html = 물리식 → 값이 4배까지 벌어졌음)

   THREE·DOM·전역상태 없음. 전부 인자로 받는다.

   단위
     - 천공 조도 Ev [lx], 창 투과율 tau [0~1]
     - 결과 E [lx] (그 점의 그 방향 면이 받는 조도)
     - 길이 [m]

   좌표
     방을 원점 중심에 둔 미터 좌표 (house.js와 동일).
     x: 폭, y: 높이(바닥 0), z: 깊이.
============================================================ */

/* ============================================================
   1. 창 — 3D 사각 개구부
   win = { cx,cy,cz : 중심(m)
           ux,uz    : 폭 방향 단위벡터(수평)
           nx,nz    : 실내를 향한 법선 단위벡터(수평)
           width, height : 개구부 크기(m)
           tau      : 유리 투과율(0~1) }
============================================================ */

/* house_rooms.json 방식(wall/cu/cy/w/h) → 창 사각형 */
/* cv: 천창 전용 — 지붕 유리가 방 일부만 덮을 때 그 구간의 z 중심.
   벽창은 cu 하나로 위치가 정해지지만 천창은 수평면이라 축이 둘이다. */
export function winFromHouse(wall, cu, cy, w, h, size, tau = 0.8, evScale = 1, cv = 0) {
  const W = size.w, D = size.d;
  switch (wall) {
    case 'back':  return { cx: cu,    cy, cz: -D / 2, ux: 1, uz: 0, nx: 0,  nz: 1,  width: w, height: h, tau, evScale };
    case 'front': return { cx: cu,    cy, cz:  D / 2, ux: 1, uz: 0, nx: 0,  nz: -1, width: w, height: h, tau, evScale };
    case 'left':  return { cx: -W / 2, cy, cz: cu,    ux: 0, uz: 1, nx: 1,  nz: 0,  width: w, height: h, tau, evScale };
    case 'right': return { cx:  W / 2, cy, cz: cu,    ux: 0, uz: 1, nx: -1, nz: 0,  width: w, height: h, tau, evScale };
    /* ★ 천창 — 수평 개구부. 법선이 아래(실내)를 향한다.
       u축=x, v축=z 로 눕히고 ny=-1. cy는 천장 높이를 넣는다.
       수평면은 하늘 반구를 통째로 보므로 같은 면적이어도 수직창보다 훨씬 세다. */
    case 'ceiling': return { cx: cu, cy, cz: cv,
                             ux: 1, uy: 0, uz: 0,
                             vx: 0, vy: 0, vz: 1,
                             nx: 0, ny: -1, nz: 0,
                             width: w, height: h, tau, evScale };
  }
  return null;
}

/* tool.html 방식(다각형 변 edge + 위치 t) → 창 사각형 */
export function winFromPoly(poly, w, tau = 0.8) {
  const A = poly[w.edge], B = poly[(w.edge + 1) % poly.length];
  const ex = B.x - A.x, ez = B.z - A.z;
  const len = Math.hypot(ex, ez) || 1;
  const ux = ex / len, uz = ez / len;
  let nx = -uz, nz = ux;                       // 변에 수직
  const cen = polyCentroid(poly);
  const c = w.t * len;
  const mx = A.x + ux * c, mz = A.z + uz * c;
  if ((cen.x - mx) * nx + (cen.z - mz) * nz < 0) { nx = -nx; nz = -nz; }   // 실내를 향하게
  // tool.html windowRect와 동일하게 변 범위로 클램프 (벽 끝에 걸친 창 처리 일치)
  const s0 = Math.max(0, c - w.width / 2), s1 = Math.min(len, c + w.width / 2);
  const sc = (s0 + s1) / 2;
  return {
    cx: A.x + ux * sc, cy: (w.sill + w.head) / 2, cz: A.z + uz * sc,
    ux, uz, nx, nz,
    width: Math.max(0, s1 - s0), height: Math.max(0, w.head - w.sill), tau
  };
}

export function polyCentroid(poly) {
  let x = 0, z = 0;
  for (const p of poly) { x += p.x; z += p.z; }
  return { x: x / poly.length, z: z / poly.length };
}

/* 방 크기 → 직사각 다각형(원점 중심) */
export function rectPoly(size) {
  const w = size.w / 2, d = size.d / 2;
  return [{ x: -w, z: -d }, { x: w, z: -d }, { x: w, z: d }, { x: -w, z: d }];
}

/* ============================================================
   2. ★ 자연광 — 창을 램버시안 면광원(천공)으로 적분
      E = Σ L·cosWin·cosP·dA / d²      ,  L = Ev·τ/π
   ------------------------------------------------------------
   p  : 측정점 {x,y,z}
   n  : 그 점 표면의 법선 {x,y,z} (바닥이면 {0,1,0})
   wins: 창 배열
   opt : { sky:천공조도 Ev[lx], samples:[가로,세로] 분할, occluders, selfIdx }
============================================================ */
/* 창 하나를 몇 조각으로 쪼갤지 — 거리에 따라 자동으로.

   각 조각은 '점광원'으로 취급되므로(E = L·cosWin·cosP·dA/d²) 조각이 거리에 비해
   크면 근사가 깨진다. 조각 한 변이 거리의 1/4을 넘지 않게 잡는다.

   ★ 거리는 '창 중심'이 아니라 '창면 위에서 가장 가까운 점'까지 재야 한다.
     창 가장자리 앞 0.3m에 있는 화분은 창 중심까지는 3m라, 중심 거리로 재면
     성기게 쪼개고 → 큰 조각 하나가 화분 코앞에 놓여 1/d²가 폭발한다.
     실측: 그 경우 참값의 +286%까지 나왔다(발코니 선반). 중심거리 기준의 함정.

   파라미터는 고밀도 기준([128,128] 수렴값)과 대조해 정했다.
   ※ 분할수는 짝수. 홀수면 창 정중앙에 샘플이 놓여 계통 편향이 생긴다. */
function autoSamples(w, p) {
  // 창면 좌표계로 투영 → 사각형 안으로 클램프 → 그 점까지의 거리
  const dx = p.x - w.cx, dy = p.y - w.cy, dz = p.z - w.cz;
  const vy = (w.vy === undefined ? 1 : w.vy);
  let su = dx * w.ux + dy * (w.uy || 0) + dz * w.uz;
  let sv = dx * (w.vx || 0) + dy * vy + dz * (w.vz || 0);
  su = Math.max(-w.width / 2,  Math.min(w.width / 2,  su));
  sv = Math.max(-w.height / 2, Math.min(w.height / 2, sv));
  const qx = w.cx + w.ux * su + (w.vx || 0) * sv;
  const qy = w.cy + (w.uy || 0) * su + vy * sv;
  const qz = w.cz + w.uz * su + (w.vz || 0) * sv;
  const d = Math.max(0.05, Math.hypot(p.x - qx, p.y - qy, p.z - qz));

  const patch = d / 4;
  const clamp = v => {
    const n = Math.max(4, Math.min(64, Math.ceil(v)));
    return n % 2 ? n + 1 : n;
  };
  return [clamp(w.width / patch), clamp(w.height / patch)];
}

/* ★ 반투과 유리판(베란다 거실창 같은 실내 유리) 통과 감쇠.
   차폐체(occluder)는 빛을 100% 막지만 이건 tau만큼 통과시킨다.
   중요한 건 '슬롯당'이 아니라 '(창, 지점) 광선당'이라는 점이다 —
   같은 거실 화분이라도 베란다 창에서 오는 빛은 2겹, 자기 방 창에서 오는 빛은 1겹이다.
   pane = { axis:'x'|'z', at, u0, u1, y0, y1, tau }  (u = 판이 뻗는 방향 좌표) */
function paneAtten(A, B, panes) {
  let att = 1;
  for (const g of panes) {
    const az = g.axis === 'x' ? A.x : A.z;
    const bz = g.axis === 'x' ? B.x : B.z;
    const da = az - g.at, db = bz - g.at;
    if (da === 0 || (da > 0) === (db > 0)) continue;      // 판을 가로지르지 않음
    const t = da / (da - db);
    const y = A.y + (B.y - A.y) * t;
    if (y < g.y0 || y > g.y1) continue;
    const u = g.axis === 'x' ? (A.z + (B.z - A.z) * t) : (A.x + (B.x - A.x) * t);
    if (u < g.u0 || u > g.u1) continue;                    // 개구부 밖 = 벽(차폐체가 이미 처리)
    att *= g.tau;
  }
  return att;
}

export function daylightAt(p, n, wins, opt = {}) {
  if (!wins || !wins.length) return 0;
  const Ev = opt.sky ?? 8000;
  /* samples: [가로,세로] 고정 | 'auto' 거리 적응.
     기본이 [4,3]인 건 tool.html이 그 값으로 검증돼 있기 때문. 벽만 한 창을 쓰면 'auto'. */
  const fixed = (opt.samples && opt.samples !== 'auto') ? opt.samples : null;
  const occ = opt.occluders || null;
  const panes = opt.glazed || null;
  let E = 0;

  for (const w of wins) {
    if (!w || w.width <= 0 || w.height <= 0) continue;
    const [Mw, Mh] = fixed || (opt.samples === 'auto' ? autoSamples(w, p) : [4, 3]);
    // 창별 evScale = 향 계수(남향 1.0 / 북향 0.38) × 차광막 등. 없으면 1.
    const L = Ev * (w.tau ?? 0.8) * (w.evScale ?? 1) / Math.PI;   // 천공 휘도 [cd/m²]
    const dA = (w.width / Mw) * (w.height / Mh);
    for (let a = 0; a < Mw; a++) {
      for (let b = 0; b < Mh; b++) {
        // 창면 위 샘플점.
        // u축=(ux,uy,uz) 가로, v축=(vx,vy,vz) 세로. 수직창은 v=(0,1,0)이라 예전과 같다.
        const su = (-w.width / 2) + (a + 0.5) / Mw * w.width;
        const sv = (-w.height / 2) + (b + 0.5) / Mh * w.height;
        const wx = w.cx + w.ux * su + (w.vx || 0) * sv;
        const wy = w.cy + (w.uy || 0) * su + (w.vy === undefined ? 1 : w.vy) * sv;
        const wz = w.cz + w.uz * su + (w.vz || 0) * sv;

        const rx = p.x - wx, ry = p.y - wy, rz = p.z - wz;
        const d2 = rx * rx + ry * ry + rz * rz;
        if (d2 < 1e-6) continue;
        const d = Math.sqrt(d2);

        // 창 법선 대비 (실내쪽만). ny가 있어야 천창(수평 개구부)을 표현할 수 있다.
        const cosWin = (rx * w.nx + ry * (w.ny || 0) + rz * w.nz) / d;
        if (cosWin <= 0) continue;
        const cosP = (-rx * n.x - ry * n.y - rz * n.z) / d;   // 점 법선 대비
        if (cosP <= 0) continue;

        if (occ && isShadowed(p, { x: wx, y: wy, z: wz }, occ, opt.selfIdx)) continue;

        // 실내 유리판(베란다 거실창)을 지나면 그 광선만 tau만큼 약해진다
        const att = panes ? paneAtten({ x: wx, y: wy, z: wz }, p, panes) : 1;
        if (att <= 0) continue;

        E += L * cosWin * cosP * dA / d2 * att;
      }
    }
  }
  return E;
}

/* ============================================================
   3. 인공광 — 배광곡선 기반 (tool.html과 동일)
      E = I(θ)·cos(입사각) / d²  ,  I0 = flux / ∫f(θ)dΩ
============================================================ */
export function candela(theta, type) {
  const c = Math.cos(theta);
  if (c <= 0) return 0;
  switch (type) {
    case 'iso':     return 1;
    case 'lambert': return c;
    case 'narrow':  return Math.pow(c, 6);
    case 'down':    return Math.pow(c, 3);
    case 'wide':    return Math.pow(c, 0.4);
  }
  return c;
}

/* 총광속(lm) → 축상 광도 I0(cd). 배광에 맞춰 반구 적분으로 정규화 */
export function axialIntensity(flux, type) {
  let integ = 0; const n = 90;
  for (let i = 0; i < n; i++) {
    const th = (i + 0.5) / n * (Math.PI / 2);
    integ += candela(th, type) * Math.sin(th) * (Math.PI / 2 / n);
  }
  integ *= 2 * Math.PI;
  return flux / integ;
}

/* lum = { x,y,z, flux, dist:'lambert'|..., aim:{x,y,z}(기본 하방) } */
export function pointIllum(p, n, lums, opt = {}) {
  const occ = opt.occluders || null;
  const panes = opt.glazed || null;
  let E = 0;
  for (const L of lums) {
    if (L.on === false) continue;
    const aim = L.aim || { x: 0, y: -1, z: 0 };
    const wx = p.x - L.x, wy = p.y - L.y, wz = p.z - L.z;   // 조명 → 점
    const d2 = wx * wx + wy * wy + wz * wz;
    if (d2 < 1e-8) continue;
    const d = Math.sqrt(d2);
    const cosBeam = (wx * aim.x + wy * aim.y + wz * aim.z) / d;
    if (cosBeam <= 0) continue;                      // 빔 뒤쪽
    const cosInc = (-wx * n.x - wy * n.y - wz * n.z) / d;
    if (cosInc <= 0) continue;                       // 면 뒷쪽
    if (occ && isShadowed(p, { x: L.x, y: L.y, z: L.z }, occ, opt.selfIdx)) continue;
    const type = L.dist || 'lambert';
    const I0 = L.I0 != null ? L.I0 : axialIntensity(L.flux || 2000, type);
    E += I0 * candela(Math.acos(Math.min(1, cosBeam)), type) * cosInc / d2;
  }
  return E;
}

/* ============================================================
   4. 차폐 — 회전 지원 박스(OBB) 광선 검사. tool.html isShadowedEx 이식.
      occluders = [{ x,z,w,d,h, y0?, rot? }]  (x,z=좌하단 기준, tool.html과 동일)
============================================================ */
export function isShadowed(p, lightPt, occluders, selfIdx) {
  for (let i = 0; i < occluders.length; i++) {
    if (i === selfIdx) continue;
    const F = occluders[i];
    const cx = F.x + F.w / 2, cz = F.z + F.d / 2;
    const rot = F.rot || 0, c = Math.cos(-rot), s = Math.sin(-rot);
    const toLocal = (x, z) => [(x - cx) * c - (z - cz) * s, (x - cx) * s + (z - cz) * c];
    const P = toLocal(p.x, p.z), Lp = toLocal(lightPt.x, lightPt.z);
    const ox = P[0], oz = P[1];
    const dx = Lp[0] - P[0], dy = lightPt.y - p.y, dz = Lp[1] - P[1];
    const hx = F.w / 2, hz = F.d / 2, y0 = F.y0 || 0;
    let tmin = 0, tmax = 1;
    const slab = (o, dd, a, b) => {
      if (Math.abs(dd) < 1e-9) return (o >= a && o <= b);
      let ta = (a - o) / dd, tb = (b - o) / dd;
      if (ta > tb) { const t = ta; ta = tb; tb = t; }
      tmin = Math.max(tmin, ta); tmax = Math.min(tmax, tb);
      return tmin <= tmax;
    };
    if (!slab(ox, dx, -hx, hx)) continue;
    if (!slab(p.y, dy, y0, y0 + F.h)) continue;
    if (!slab(oz, dz, -hz, hz)) continue;
    if (tmin <= tmax && tmax > 0.001 && tmin < 0.999) return true;
  }
  return false;
}

/* ============================================================
   5. 편의 — 바닥 격자 조도 (게임 히트맵용)
      size {w,d}, y=측정 높이(작업면). 반환 { at(u,v), cells, max, ... }
============================================================ */
export function luxGrid(wins, size, opt = {}) {
  const N = opt.grid || 22;
  const y = opt.y ?? 0.75;
  const up = { x: 0, y: 1, z: 0 };
  const amb = opt.ambient ?? 25;          // 상호반사 대체 최소 환경광
  const lums = opt.lums || [];
  const cells = [];
  let max = 0, min = Infinity, wSum = 0, wCnt = 0, iSum = 0, iCnt = 0;

  for (let i = 0; i < N; i++) {
    cells[i] = [];
    for (let j = 0; j < N; j++) {
      const u = (i + 0.5) / N, v = (j + 0.5) / N;
      const p = { x: (u - 0.5) * size.w, y, z: (v - 0.5) * size.d };
      let lx = amb;
      lx += daylightAt(p, up, wins, opt);
      if (lums.length) lx += pointIllum(p, up, lums, opt);
      cells[i][j] = lx;
      if (lx > max) max = lx;
      if (lx < min) min = lx;
      if (Math.min(u, v) < 0.32) { wSum += lx; wCnt++; }
      else if (u > 0.5 && v > 0.5) { iSum += lx; iCnt++; }
    }
  }
  return {
    cells, grid: N,
    max, min: min === Infinity ? 0 : min,
    windowAvg: wCnt ? wSum / wCnt : 0,
    innerAvg: iCnt ? iSum / iCnt : 0,
    at(u, v) {
      const i = Math.max(0, Math.min(N - 1, Math.floor(u * N)));
      const j = Math.max(0, Math.min(N - 1, Math.floor(v * N)));
      return (cells[i] && cells[i][j]) || 0;
    }
  };
}

/* ============================================================
   6. 시간 → 천공 조도 Ev(lx)
      태양 고도에 따른 대략적 실외 천공 조도. 밤엔 0.
      t: 0~100 (기존 sunState와 같은 축)
============================================================ */
/* 맑은 날 창면(연직) 천공 조도 기준값 [lx].

   ★ 이건 캘리브레이션값이지 이론 물리값이 아니다.
     문헌의 '밝은 실내 창가 DLI 3~8'에 실내 결과가 맞도록 역산해서 고른 값이다.
     이론적으로는 맑은 날 수직면 확산광 대역(10,000~25,000)의 상단이라 낙관적인 편.
     (12,000이던 시절엔 최고 DLI가 2.8로 문헌 대역 아래여서 모든 방이 재배 불가였다)
   ★ 재조정하면 방별 DLI 실측표 전체를 다시 검증해야 한다 — _dli_probe.html 사용.
   ※ tool.html은 이 함수를 쓰지 않는다. 자기 UI 입력(S.sky, 기본 8000)을 직접 넘긴다. */
export const CLEAR_SKY_MAX = 25000;   // 캘리브레이션값. 문헌 실내 창가 DLI 3~8에 맞춤.

/* 날씨 계수 — 맑은 날 대비 창면 천공 조도 배율 */
export const WEATHER = {
  clear:    { k: 1.00, ko: '맑음' },
  cloudy:   { k: 0.25, ko: '흐림' },
  rain:     { k: 0.12, ko: '비' }
};

/* 계절 — 두 가지가 따로 작용한다. 둘을 곱해야 실제 겨울이 나온다.
     k     세기: 태양 고도·대기 경로 차이 (한낮 밝기)
     hours 낮 길이 [h]: 서울 기준 하지 14.5 / 동지 9.8
   → 겨울 총량은 0.55 × 9.8/14.5 = 여름의 약 37%. */
export const SEASON = {
  summer: { k: 1.00, hours: 14.5, ko: '여름' },
  spring: { k: 0.85, hours: 12.7, ko: '봄'   },
  autumn: { k: 0.80, hours: 11.8, ko: '가을' },
  winter: { k: 0.55, hours:  9.8, ko: '겨울' }
};

/* ★ 창 향(方位) 계수 — 연직면이 받는 하루 채광량의 남향 대비 비율.
   이 모델의 천공은 방향과 무관한 균일 휘도라, 향을 안 넣으면 북향창과 남향창이
   똑같이 밝다. 실제로는 직사·주변광 때문에 수 배 차이가 난다.
   창별 evScale로 곱해 근사한다 — 창 하나하나가 자기 향의 천공을 본다고 보는 것.
   서울 기준 연직면 일사/채광 자료의 대략적 비율. */
export const ORIENT = {
  south:     { k: 1.00, ko: '남향' },
  southeast: { k: 0.85, ko: '남동향' },
  southwest: { k: 0.85, ko: '남서향' },
  east:      { k: 0.62, ko: '동향' },
  west:      { k: 0.62, ko: '서향' },
  northeast: { k: 0.45, ko: '북동향' },
  northwest: { k: 0.45, ko: '북서향' },
  north:     { k: 0.38, ko: '북향' }
};
export const COMPASS = ['north','northeast','east','southeast','south','southwest','west','northwest'];

/* 천창(수평면)은 방위가 없다. 천정 방향 천공이 지평 부근보다 밝으므로 남향 수직창보다 조금 세게 본다.
   '하늘을 얼마나 보느냐'는 기하 적분이 이미 처리하므로, 여기선 밝기 비율만 담당한다. */
export const ORIENT_ZENITH = 1.20;

/* 방의 facing(= back 벽 바깥이 향하는 방위) + 벽 이름 → 그 벽의 방위.
   back에서 시계방향으로 right(+90°) front(+180°) left(+270°). */
export function wallOrient(facing, wall) {
  if (wall === 'ceiling') return 'zenith';
  const i = COMPASS.indexOf(facing || 'south');
  if (i < 0) return 'south';
  const turn = { back: 0, right: 2, front: 4, left: 6 }[wall] || 0;
  return COMPASS[(i + turn) % 8];
}
export function orientK(orient) {
  if (orient === 'zenith') return ORIENT_ZENITH;
  return (ORIENT[orient] || ORIENT.south).k;
}

/* 지역 계수 — 지금은 전부 1.0(자리만). 국내 연간 일조시간 차는 최대 37%,
   서울 기준 ±5%라 계절(45%)·날씨(75%)보다 작아 우선순위 낮음. */
export const REGION = { default: { k: 1.00, ko: '기본' } };

/* 그날의 천공 조도 상한 = 맑은날 × 날씨 × 계절 × 지역 */
export function skyEvMax(opt = {}) {
  const base   = opt.clearSkyMax ?? CLEAR_SKY_MAX;
  const kW = (WEATHER[opt.weather] || WEATHER.clear).k;
  const kS = (SEASON [opt.season ] || SEASON .summer).k;
  const kR = (REGION [opt.region ] || REGION .default).k;
  return base * kW * kS * kR;
}

/* 시각 t(0~100)의 천공 조도. opt에 weather/season/region을 주면 계수가 적용된다. */
export function skyEv(t, opt = {}) {
  const clear = skyEvMax(opt);
  const night = opt.nightEv ?? 0;
  const dayPhase = (t - 15) / 70;
  const daytime = t > 12 && t < 88;
  if (!daytime) return night;
  const alt = Math.sin(Math.max(0, Math.min(1, dayPhase)) * Math.PI);   // 0~1
  return clear * alt;
}

/* 낮 구간(t) — daily_light.js의 적분과 skyEv가 같은 창을 쓰도록 한곳에 둔다. */
export const DAY_T0 = 12, DAY_T1 = 88, DAY_HOURS = 24;
