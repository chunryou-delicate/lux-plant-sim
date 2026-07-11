/* ============================================================
   볕 · 조도 엔진 (lighting.js)
   ------------------------------------------------------------
   빛의 "양"(lx)만 계산하는 순수 모듈. DOM·전역상태·색/렌더 없음.
   방 고정좌표 (u,v)∈[0,1] 격자에서 1회 계산한다.
   → 회전(dir)·시점(pitch) 같은 뷰 변환과 완전히 무관.
     (헌법: 위치는 방 고정좌표, 회전은 볼 때만.)

   쓰는 법:
     import { sunState, computeLux } from './engine/lighting.js';
     const sun   = sunState(t);                       // 시간 → 태양
     const field = computeLux({ room, catalog, items, sun });
     const lx    = field.at(u, v);                    // 그 자리 조도
     field.max, field.windowAvg, field.innerAvg ...   // 요약값
============================================================ */

// 조도 격자 해상도 (GRID×GRID). 방 좌표계 기준.
export const GRID = 22;

/* ------------------------------------------------------------
   시간대 → 태양 상태 (물리량만)
   t: 0~100 (12 미만·88 이상 = 밤). 색·라벨 같은 표현은 UI 몫.
------------------------------------------------------------ */
export function sunState(t) {
  const dayPhase = (t - 15) / 70;
  const daytime  = t > 12 && t < 88;
  // 낮 동안 해가 반원을 그림 → 정오 근처 최고. 밤엔 0.
  const altitude = daytime ? Math.sin(clamp01(dayPhase) * Math.PI) : 0;
  const azimuth  = (dayPhase - 0.5) * 2;      // -1(아침·벽A쪽) ~ +1(저녁·벽B쪽)
  const lampAuto = t < 12 || t >= 88;         // 밤엔 천장등 자동 on
  const warm     = (t < 30 || t > 70) ? 1 : 0; // 아침/저녁의 붉은 기
  return { altitude, azimuth, intensity: altitude, daytime, lampAuto, warm };
}

/* ------------------------------------------------------------
   창의 방 좌표상 '입구 중심'(cx,cy)과 '안쪽 방향'(nx,ny)
   side: 'u0'=v=0 뒤벽, 'v0'=u=0 뒤벽, 'u1'=v=1, 'v1'=u=1
------------------------------------------------------------ */
export function windowGeom(w) {
  if (w.side === 'u0') return { cx: w.pos, cy: 0.0, nx: 0, ny: 1 };  // 안쪽(+v)으로 빛
  if (w.side === 'v0') return { cx: 0.0, cy: w.pos, nx: 1, ny: 0 };  // 안쪽(+u)으로 빛
  if (w.side === 'u1') return { cx: w.pos, cy: 1.0, nx: 0, ny: -1 };
  return { cx: 1.0, cy: w.pos, nx: -1, ny: 0 };
}

/* ------------------------------------------------------------
   조도 격자 계산
   자연광: 각 창에서 들어오는 빛 (창 폭 안 + 얕은 깊이 + 해 방위 매칭일수록 밝음).
   인공광: 조명 아이템에서 역제곱·수평거리 감쇠 (램버시안 근사).
   둘을 동등하게 합산 → lx.

   인자:
     room    { windows:[{ side, pos, width, sky }], ... }
     catalog { [type]: { kind:'light', art, h, flux } }  // 조명 스펙
     items   [{ type, u, v, on? }]                        // 배치된 아이템
     sun     sunState(t) 결과
     lampManual  천장등 수동 on (기본 false; 밤엔 sun.lampAuto로도 켜짐)
     grid    격자 해상도 (기본 GRID)
   반환: LuxField
------------------------------------------------------------ */
export function computeLux({ room, catalog, items = [], sun, lampManual = false, grid = GRID }) {
  const lampOn = lampManual || sun.lampAuto;
  const cells = [];

  for (let i = 0; i < grid; i++) {
    cells[i] = [];
    for (let j = 0; j < grid; j++) {
      const u = (i + 0.5) / grid, v = (j + 0.5) / grid;
      let lx = 25; // 최소 환경광

      // --- 자연광: 각 창 ---
      if (sun.intensity > 0.02) {
        for (const w of room.windows) {
          const g = windowGeom(w);
          const du = u - g.cx, dv = v - g.cy;
          const depth = du * g.nx + dv * g.ny;          // 창에서 안쪽으로 들어온 깊이(+)
          if (depth < 0) continue;
          const lateral   = Math.abs(du * g.ny - dv * g.nx); // 창 폭 방향 이탈
          const widthFall = Math.max(0, 1 - lateral / (w.width * 1.4));
          const depthFall = 1 / (1 + depth * depth * 7);      // 안쪽으로 급감
          // 해 방위 매칭: u0 창=아침에 강함, v0 창=저녁에 강함
          let dirMatch = 0.5;
          if (w.side === 'u0') dirMatch = 0.5 - sun.azimuth * 0.5;
          if (w.side === 'v0') dirMatch = 0.5 + sun.azimuth * 0.5;
          dirMatch = Math.max(0.15, Math.min(1, dirMatch));
          lx += 950 * sun.intensity * widthFall * depthFall * dirMatch * w.sky;
        }
      }

      // --- 인공광: 조명 아이템 (역제곱·수평) ---
      for (const it of items) {
        const C = catalog[it.type];
        if (!C || C.kind !== 'light') continue;
        if (C.art === 'lamp' && it.on === false) continue;   // 스탠드: 꺼짐이면 건너뜀
        if (C.art === 'ceilinglamp' && !lampOn) continue;    // 천장등: 토글/야간일 때만
        const du = u - it.u, dv = v - it.v;
        const horiz2 = du * du + dv * dv;
        const h = C.h;
        const dist2  = horiz2 + h * h;
        const cosInc = h / Math.sqrt(dist2);   // 바닥 수평면 입사각
        const I = (C.flux || 2000) / Math.PI;  // 램버시안 축상광도 근사
        lx += I * cosInc / dist2 * 1.2;
      }

      cells[i][j] = lx;
    }
  }

  return new LuxField(cells, grid);
}

/* ------------------------------------------------------------
   조도 필드: 계산 결과를 담고 조회하는 객체
   격자·통계는 감추고, at()/max/windowAvg 같은 간단한 인터페이스만 노출.
------------------------------------------------------------ */
export class LuxField {
  constructor(cells, grid = GRID) {
    this.cells = cells;   // cells[i][j] = lx
    this.grid  = grid;

    let max = 1, min = Infinity;
    let wSum = 0, wCnt = 0, iSum = 0, iCnt = 0;
    for (let i = 0; i < grid; i++) {
      for (let j = 0; j < grid; j++) {
        const lx = cells[i][j];
        if (lx > max) max = lx;
        if (lx < min) min = lx;
        const u = (i + 0.5) / grid, v = (j + 0.5) / grid;
        if (Math.min(u, v) < 0.32) { wSum += lx; wCnt++; }        // 창가
        else if (u > 0.5 && v > 0.5) { iSum += lx; iCnt++; }      // 방 안쪽
      }
    }
    this.max = max;
    this.min = min === Infinity ? 0 : min;
    this.windowAvg = wCnt ? wSum / wCnt : 0;  // 창가 평균 lx
    this.innerAvg  = iCnt ? iSum / iCnt : 0;  // 방 안쪽 평균 lx
  }

  /** 방 좌표 (u,v)∈[0,1] 지점의 조도(lx). 격자 근접 샘플. */
  at(u, v) {
    const { grid, cells } = this;
    const i = Math.max(0, Math.min(grid - 1, Math.floor(u * grid)));
    const j = Math.max(0, Math.min(grid - 1, Math.floor(v * grid)));
    return (cells[i] && cells[i][j]) || 0;
  }
}

// ---------- 내부 유틸 ----------
function clamp01(v) { return Math.max(0, Math.min(1, v)); }
