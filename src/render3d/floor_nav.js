/* ============================================================
   render3d/floor_nav.js — 방 바닥을 걸어 다니는 길 찾기 한 벌
   ------------------------------------------------------------
   ★ 새로 만든 알고리즘이 아니다. render3d/character.js 안에 있던
     격자 BFS·모서리 끼임 방지·벽 미끄러짐(pushOut)을 **그대로 옮긴 것**이다.

   왜 옮겼나
     방 뷰(game/room_view.js)가 캐릭터를 걷게 하려면 같은 판정이 필요했다.
     복사하면 두 벌이 되고, 두 벌은 반드시 어긋난다(방에서는 지나가는데
     방 도구에서는 막히는 식으로 — 제일 늦게 발견되는 종류다).
     그래서 한 벌만 두고 둘이 같이 쓴다.

   쓰는 법
     const nav = createFloorNav({ colliders, size, radius: 0.38 });
     nav.blocked(x, z)          여기 서 있을 수 있나
     nav.nearestFree(x, z)      막혔으면 제일 가까운 빈 자리
     nav.path(sx, sz, tx, tz)   웨이포인트 배열. 못 가면 최대한 다가간다
     nav.pushOut(x, z)          한 걸음 갔더니 겹쳤을 때 빼내 준다(벽을 따라 미끄러짐)

   colliders 는 buildHouse 가 주는 그대로다 — {x,z,w,d,h,rot,kind}.
   개구부(문)는 이미 빠져 있어서 문 자리는 저절로 뚫려 있다.
============================================================ */

const CELL = 0.25;          // 가구 배치 그리드와 같은 간격 (decorate.js SNAP)

export function createFloorNav(opt = {}) {
  const radius = opt.radius ?? 0.26;
  const cell = opt.cell ?? CELL;
  let colliders = opt.colliders || [];
  let size = opt.size || null;
  let grid = null;

  /* 그 점에 몸(반지름 radius)이 들어가나. 충돌체는 회전이 있을 수 있어
     점을 상자 로컬 좌표로 옮겨서 본다. */
  function blocked(x, z, r) {
    const R = r == null ? radius : r;
    for (const c of colliders) {
      const rot = c.rot || 0, co = Math.cos(-rot), si = Math.sin(-rot);
      const lx = (x - c.x) * co - (z - c.z) * si;
      const lz = (x - c.x) * si + (z - c.z) * co;
      if (Math.abs(lx) < c.w / 2 + R && Math.abs(lz) < c.d / 2 + R) return true;
    }
    return false;
  }

  /* 방 전체를 cell 칸으로 나눠 '설 수 있는 칸'을 표시한다. 칸 중심으로만 본다. */
  function buildGrid() {
    if (!size) return null;
    const x0 = -size.w / 2, z0 = -size.d / 2;
    const n = Math.ceil(size.w / cell), m = Math.ceil(size.d / cell);
    const free = new Uint8Array(n * m);
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
      const x = x0 + (i + 0.5) * cell, z = z0 + (j + 0.5) * cell;
      free[j * n + i] = blocked(x, z) ? 0 : 1;
    }
    return { n, m, cell, x0, z0, free };
  }
  function ensure() { if (!grid) grid = buildGrid(); return grid; }

  const cellOf = (x, z) => {
    const g = ensure();
    if (!g) return [0, 0];
    return [Math.max(0, Math.min(g.n - 1, Math.floor((x - g.x0) / cell))),
            Math.max(0, Math.min(g.m - 1, Math.floor((z - g.z0) / cell)))];
  };
  const cellPos = (i, j) => {
    const g = ensure();
    return { x: g.x0 + (i + 0.5) * cell, z: g.z0 + (j + 0.5) * cell };
  };

  /* 막힌 칸이면 가장 가까운 빈 칸으로 옮긴다(문 앞 가구 같은 경우) */
  function nearestFreeCell(i, j) {
    const g = ensure();
    if (!g) return [i, j];
    if (g.free[j * g.n + i]) return [i, j];
    for (let r = 1; r < 24; r++)
      for (let di = -r; di <= r; di++) for (let dj = -r; dj <= r; dj++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
        const a = i + di, b = j + dj;
        if (a < 0 || b < 0 || a >= g.n || b >= g.m) continue;
        if (g.free[b * g.n + a]) return [a, b];
      }
    return [i, j];
  }

  /* BFS — 대각선 포함(모서리 끼임 방지로 양옆이 뚫린 경우만).
     ★ 목표 칸이 '빈칸이지만 갇힌 주머니'일 수 있다(옷장과 서랍장 사이 2칸 같은).
       그래서 목표를 먼저 정하지 않고, 출발점에서 갈 수 있는 곳을 전부 훑은 뒤
       그중 목표에 가장 가까운 칸으로 간다. 못 가는 곳을 찍어도 최대한 다가간다. */
  function path(sx, sz, tx, tz) {
    const g = ensure();
    if (!g) return [];
    const [si, sj] = nearestFreeCell(...cellOf(sx, sz));
    const [ti, tj] = cellOf(tx, tz);
    const N = g.n, M = g.m, F = g.free;
    const prev = new Int32Array(N * M).fill(-1);
    const seen = new Uint8Array(N * M);
    const start = sj * N + si;
    const q = [start]; seen[start] = 1;
    const D = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
    let head = 0;
    let best = start, bestD = (si - ti) ** 2 + (sj - tj) ** 2;
    while (head < q.length) {
      const cur = q[head++];
      const ci = cur % N, cj = (cur - ci) / N;
      const d2 = (ci - ti) ** 2 + (cj - tj) ** 2;
      if (d2 < bestD) { bestD = d2; best = cur; }
      if (d2 === 0) break;
      for (const [di, dj] of D) {
        const a = ci + di, b = cj + dj;
        if (a < 0 || b < 0 || a >= N || b >= M) continue;
        const k = b * N + a;
        if (seen[k] || !F[k]) continue;
        if (di && dj && (!F[cj * N + a] || !F[b * N + ci])) continue;   // 모서리 끼움 방지
        seen[k] = 1; prev[k] = cur; q.push(k);
      }
    }
    if (best === start) return [];
    const out = [];
    for (let k = best; k !== -1; k = prev[k]) {
      const i = k % N, j = (k - i) / N;
      out.push(cellPos(i, j));
      if (k === start) break;
    }
    out.reverse();
    return simplify(out);
  }

  /* 직선으로 갈 수 있는 구간은 웨이포인트를 지운다(지그재그 방지) */
  function simplify(pts) {
    if (pts.length < 3) return pts;
    const out = [pts[0]];
    let i = 0;
    while (i < pts.length - 1) {
      let j = pts.length - 1;
      for (; j > i + 1; j--) if (clearLine(pts[i], pts[j])) break;
      out.push(pts[j]); i = j;
    }
    return out;
  }
  function clearLine(a, b) {
    const d = Math.hypot(b.x - a.x, b.z - a.z), steps = Math.ceil(d / (cell * 0.5));
    for (let k = 1; k < steps; k++) {
      const t = k / steps;
      if (blocked(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)) return false;
    }
    return true;
  }

  /* 축정렬 상자에 회전이 있는 경우까지 — 점을 상자 로컬로 옮겨 밀어낸다.
     겹치면 가장 얕은 축으로 빼내고(=벽을 따라 미끄러짐), 안 겹치면 그대로. */
  function pushOut(px, pz) {
    for (const c of colliders) {
      const cx = c.x, cz = c.z, rot = c.rot || 0;
      const co = Math.cos(-rot), si = Math.sin(-rot);
      let lx = (px - cx) * co - (pz - cz) * si;
      let lz = (px - cx) * si + (pz - cz) * co;
      const hw = c.w / 2 + radius, hd = c.d / 2 + radius;
      if (Math.abs(lx) >= hw || Math.abs(lz) >= hd) continue;   // 안 겹침
      const ox = hw - Math.abs(lx), oz = hd - Math.abs(lz);
      if (ox < oz) lx = Math.sign(lx || 1) * hw;                 // x로 빼는 게 얕다
      else         lz = Math.sign(lz || 1) * hd;
      const c2 = Math.cos(rot), s2 = Math.sin(rot);
      px = cx + lx * c2 - lz * s2;
      pz = cz + lx * s2 + lz * c2;
    }
    return { x: px, z: pz };
  }

  return {
    get cell() { return cell; },
    get radius() { return radius; },
    blocked,
    pushOut,
    path,
    /* 세계가 바뀌면(방 교체·가구 이동) 격자를 버린다. 다시 물을 때 새로 짓는다. */
    setWorld(w = {}) {
      /* 'in' 으로 본다 — 안 준 항목은 그대로 두고, 준 항목만 갈아 끼운다.
         (undefined 를 준 것과 아예 안 준 것을 가르지 않으면 방을 바꿀 때
          크기만 빠뜨려도 옛 격자를 계속 쓰게 된다) */
      if ('colliders' in w) colliders = w.colliders || [];
      if ('size' in w) size = w.size || null;
      grid = null;
    },
    /* 그 점에서 설 수 있는 가장 가까운 바닥 좌표. 방 밖이면 안으로 당긴다. */
    nearestFree(x, z) {
      const g = ensure();
      if (!g) return { x, z };
      const cx = Math.max(-size.w / 2 + radius, Math.min(size.w / 2 - radius, x));
      const cz = Math.max(-size.d / 2 + radius, Math.min(size.d / 2 - radius, z));
      if (!blocked(cx, cz)) return { x: cx, z: cz };
      const [i, j] = nearestFreeCell(...cellOf(cx, cz));
      return cellPos(i, j);
    },
    /* 진단용 — 격자가 얼마나 뚫려 있나 */
    debug() {
      const g = ensure();
      if (!g) return null;
      let free = 0;
      for (const v of g.free) free += v;
      return { n: g.n, m: g.m, free, total: g.n * g.m, cell };
    }
  };
}
