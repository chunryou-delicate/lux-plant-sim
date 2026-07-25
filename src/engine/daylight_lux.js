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
export function winFromHouse(wall, cu, cy, w, h, size, tau = 0.8) {
  const W = size.w, D = size.d;
  switch (wall) {
    case 'back':  return { cx: cu,    cy, cz: -D / 2, ux: 1, uz: 0, nx: 0,  nz: 1,  width: w, height: h, tau };
    case 'front': return { cx: cu,    cy, cz:  D / 2, ux: 1, uz: 0, nx: 0,  nz: -1, width: w, height: h, tau };
    case 'left':  return { cx: -W / 2, cy, cz: cu,    ux: 0, uz: 1, nx: 1,  nz: 0,  width: w, height: h, tau };
    case 'right': return { cx:  W / 2, cy, cz: cu,    ux: 0, uz: 1, nx: -1, nz: 0,  width: w, height: h, tau };
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
export function daylightAt(p, n, wins, opt = {}) {
  if (!wins || !wins.length) return 0;
  const Ev = opt.sky ?? 8000;
  const [Mw, Mh] = opt.samples || [4, 3];
  const occ = opt.occluders || null;
  let E = 0;

  for (const w of wins) {
    if (!w || w.width <= 0 || w.height <= 0) continue;
    const L = Ev * (w.tau ?? 0.8) / Math.PI;          // 천공 휘도 [cd/m²]
    const dA = (w.width / Mw) * (w.height / Mh);
    for (let a = 0; a < Mw; a++) {
      for (let b = 0; b < Mh; b++) {
        // 창면 위 샘플점
        const su = (-w.width / 2) + (a + 0.5) / Mw * w.width;
        const sv = (-w.height / 2) + (b + 0.5) / Mh * w.height;
        const wx = w.cx + w.ux * su, wy = w.cy + sv, wz = w.cz + w.uz * su;

        const rx = p.x - wx, ry = p.y - wy, rz = p.z - wz;
        const d2 = rx * rx + ry * ry + rz * rz;
        if (d2 < 1e-6) continue;
        const d = Math.sqrt(d2);

        const cosWin = (rx * w.nx + rz * w.nz) / d;   // 창 법선 대비 (실내쪽만)
        if (cosWin <= 0) continue;
        const cosP = (-rx * n.x - ry * n.y - rz * n.z) / d;   // 점 법선 대비
        if (cosP <= 0) continue;

        if (occ && isShadowed(p, { x: wx, y: wy, z: wz }, occ, opt.selfIdx)) continue;

        E += L * cosWin * cosP * dA / d2;
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
   실측: 맑은 날 확산광만 20,000~30,000 / 흐린 날 3,000~8,000 / 직사광 유입 시 50,000+.
   이 모델은 확산 천공광만 다루므로(직사 빔 없음) 25,000이 '맑은 날' 상당.
   ※ 12,000이던 값은 흐린 날 수준이라 모든 방이 재배 불가로 나왔음(DLI 실측으로 확인).
   ※ tool.html은 이 함수를 쓰지 않는다 — 자기 UI 입력(S.sky, 기본 8000)을 직접 넘긴다. */
export const CLEAR_SKY_MAX = 25000;

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
