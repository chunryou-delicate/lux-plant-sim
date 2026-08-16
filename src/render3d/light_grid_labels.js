/* ============================================================
   render3d/light_grid_labels.js — 게임 방의 「빛 분포」 겹쳐 그리기
   ------------------------------------------------------------
   박사님 지시(2026-08-16)
     *"식물 탭에서 버튼 누르면 빛 분포 볼 수 있게 해줘. 그리드 살리면서 약간 그
       일전에 시뮬레이터 결과처럼 보이게. 버튼 누르면. 그리드 수치도 작은 숫자로 보이고."*

   ★ 무엇을 하나 — 두 겹이다
     ① 바닥 칸 색  lighting_viz.buildCellHeatmap  (3D · 배치 격자와 **같은 칸**)
     ② 칸 숫자     이 파일 (HTML 겹쳐 그리기 · 캔버스 위에 얹는 <span>)

   ★ 숫자를 왜 HTML 로 그리나 — **재서 골랐다** (보고서 §글자 참고)
     3D 안에 글자를 얹는 길은 셋이었다.
       ㉮ 바닥에 눕힌 캔버스 텍스처 — 시점이 30~40° 라 세로가 60% 로 눌린다.
          폰 390px 에서 칸 하나가 화면 13~18px 인데 거기에 글자를 넣으면 6~9px 이 된다.
          **안 읽힌다.**
       ㉯ 스프라이트(빌보드) — 안 눌리지만 라벨마다 텍스처·드로우콜이 하나씩 는다.
          40칸이면 드로우콜 +40 이다. 폰에서 아까운 값이다.
       ㉰ **HTML 겹쳐 그리기** — 글자 크기가 **화면 픽셀로 고정**된다(11px 는 어디서나 11px).
          눌리지도 뭉개지지도 않고, WebGL 드로우콜은 **0** 이다.
     ⇒ ㉰ 을 골랐다. 대신 프레임마다 좌표를 다시 잡아야 한다 — 그건 라벨 수십 개
       투영이라 싸다(실측은 보고서 표에 있다).

   ★ 484칸을 다 안 적는다
     격자는 방마다 다르지만 반지하는 19×15 = 285칸이다. 다 적으면 폰에서 겹쳐 뭉개진다.
     그래서 **화면 픽셀 간격**을 보고 몇 칸마다 적을지 정한다(minGapPx). 줌을 당기면
     촘촘해지고 물러나면 성겨진다 — 「몇 칸마다」를 사람이 고르지 않고 화면이 고른다.

   ★ 단위를 지어내지 않는다
     값은 부르는 쪽(조도 엔진)이 낸다. 이 파일은 **무슨 값인지 모른다.** 그래서
     `unit` 문자열을 반드시 받아 머리글에 그대로 적는다. 색은 상대(파랑=최소·빨강=최대)라
     머리글이 그 양 끝 숫자도 같이 말한다 — 색만 보고 밝기를 짐작하지 않게.
============================================================ */
import { sampleLightGrid, buildCellHeatmap, updateCellHeatmap, heatColorHex } from './lighting_viz.js';

/* 값 → 글자. **자리 수를 그 격자의 최대값으로 고른다.**
   ★ 왜 값마다가 아니라 격자마다인가 — 반지하 바닥은 DLI 가 0.00~0.32 다. 한 자리로 적으면
     스물다섯 칸이 전부 「0.0」이 되어 **아무것도 안 말한다**(실측 v1 이 그랬다).
     반대로 lx(수천)를 두 자리로 적으면 글자가 칸을 넘는다. 그래서 격자를 보고 정한다.
   ⚠ 엔진이 DLI 를 소수 둘째 자리까지 낸다(daily_light.js). 그보다 잘게 적으면
     화면이 없는 정밀도를 지어내는 것이다 — 둘째 자리에서 멈춘다. */
function formatterFor(max) {
  const a = Math.abs(max);
  if (a >= 10000) return v => Math.round(v / 1000) + 'k';
  if (a >= 1000) return v => (v / 1000).toFixed(1) + 'k';
  if (a >= 100) return v => String(Math.round(v));
  if (a >= 10) return v => v.toFixed(0);
  if (a >= 1) return v => v.toFixed(1);
  return v => v.toFixed(2);
}

/* ------------------------------------------------------------
   숫자 겹쳐 그리기 층
     canvas   방 캔버스. 이 위에 정확히 겹친다.
     camera   THREE 카메라(투영에 쓴다)
     fontPx   글자 크기[화면 px]. 폰 390px 에서 11px 이 읽히는 최소선이다.
     minGapPx 이웃 숫자 사이 최소 간격[화면 px]. 이보다 좁아지면 칸을 건너뛴다.
------------------------------------------------------------ */
export function createLightGridLabels(o = {}) {
  const canvas = o.canvas;
  const camera = o.camera;
  if (!canvas || !camera) throw new Error('[빛숫자] canvas·camera 가 있어야 합니다');
  const fontPx = o.fontPx ?? 11;
  const minGapPx = o.minGapPx ?? 30;
  const parent = canvas.parentNode || document.body;
  let format = o.format || formatterFor(1);

  const root = document.createElement('div');
  root.className = 'byeot-lightgrid';
  root.style.cssText = 'position:absolute;pointer-events:none;overflow:hidden;' +
    'z-index:6;display:none;font-variant-numeric:tabular-nums;' +
    '-webkit-user-select:none;user-select:none';
  /* 부모가 static 이면 absolute 가 엉뚱한 데로 간다 — 그때만 relative 로 올린다.
     ⚠ 남의 화면을 고치는 것이므로 **원래 값을 적어 두고 dispose 에서 되돌린다.** */
  let restorePos = null;
  const cs = parent instanceof Element ? getComputedStyle(parent) : null;
  if (cs && cs.position === 'static') { restorePos = parent.style.position; parent.style.position = 'relative'; }
  parent.appendChild(root);

  /* 머리글 — 「무슨 값이고, 파랑·빨강이 각각 얼마인가」.
     ★ 자리를 **아래**에 둔다. 위는 게임이 이미 쓰고 있다 — 왼쪽에 탭 기둥(가방·식물·상점…),
       오른쪽에 [?], 그 사이에 안내 말풍선이 뜬다. v1 을 폰에서 찍어 보니 머리글 왼쪽이
       탭 기둥에 잘려 「l/m²·d」로 보였다. 아래 띠는 방 밑 빈 곳이라 안 겹친다.
     opt.captionPos 로 'top'·'none' 도 고를 수 있다 — 머리글을 게임 UI 가 직접 그리고
     싶으면 'none' 으로 끄면 된다(그때는 **단위를 그쪽이 반드시 적어야 한다**). */
  const capPos = o.captionPos || 'bottom';
  const cap = document.createElement('div');
  /* z-index 2 — 숫자보다 위다. 확대하면 아래쪽 칸 숫자가 머리글 자리까지 내려오는데,
     그때 겹쳐서 둘 다 못 읽게 되면 **단위를 못 읽는 쪽**이 더 나쁘다(실측 zoomed_v5). */
  cap.style.cssText = 'position:absolute;left:8px;z-index:2;padding:3px 7px;border-radius:6px;' +
    (capPos === 'top' ? 'top:8px;' : 'bottom:8px;') +
    'background:rgba(14,12,22,.72);color:#e8f2ff;font:600 11px/1.35 system-ui,-apple-system,sans-serif;' +
    'white-space:nowrap;letter-spacing:.2px' + (capPos === 'none' ? ';display:none' : '');
  root.appendChild(cap);

  const pool = [];              // 다시 쓰는 <span> 들
  let shown = [];               // 지금 쓰는 [{ i, j, x, z, el }]
  let grid = null, unit = '', extra = '';
  let step = 1, fitPx = 0;      // 몇 칸마다 · 그때 잰 칸 간격[px]
  let visible = false;
  const v3 = new THREE.Vector3();
  let box = { l: -1, t: -1, w: -1, h: -1 };

  function span() {
    const el = document.createElement('span');
    el.style.cssText = `position:absolute;left:0;top:0;color:#fff;` +
      `font:700 ${fontPx}px/1 ui-monospace,SFMono-Regular,Menlo,monospace;` +
      `text-shadow:0 0 3px rgba(0,0,0,.95),0 1px 2px rgba(0,0,0,.9);white-space:nowrap`;
    root.appendChild(el);
    return el;
  }

  /* 캔버스와 정확히 겹치게 자리를 잡는다(캔버스가 부모 안에서 어디 있든) */
  function fitBox() {
    const cr = canvas.getBoundingClientRect();
    const pr = (parent.getBoundingClientRect ? parent.getBoundingClientRect() : { left: 0, top: 0 });
    const l = cr.left - pr.left, t = cr.top - pr.top;
    if (l === box.l && t === box.t && cr.width === box.w && cr.height === box.h) return;
    box = { l, t, w: cr.width, h: cr.height };
    root.style.left = l + 'px'; root.style.top = t + 'px';
    root.style.width = cr.width + 'px'; root.style.height = cr.height + 'px';
  }

  /* 세계 좌표 → 캔버스 기준 화면 px. 뒤로 넘어가면 null */
  function project(x, y, z) {
    v3.set(x, y, z).project(camera);
    if (v3.z > 1) return null;
    return { x: (v3.x * 0.5 + 0.5) * box.w, y: (-v3.y * 0.5 + 0.5) * box.h };
  }

  /* 숫자를 띄우는 높이 — **그 칸의 표면 위**다(칸마다 다르다). o.lift 만큼 더 든다. */
  const lift = o.lift ?? 0.02;
  const yOf = (i, j) => (grid && typeof grid.yAt === 'function' ? grid.yAt(i, j) : 0) + lift;

  /* 지금 화면에서 한 칸이 몇 px 인가 — 격자 한가운데의 이웃 두 칸으로 잰다 */
  function cellPx() {
    if (!grid) return 0;
    const i = Math.floor(grid.nx / 2), j = Math.floor(grid.nz / 2), i2 = Math.min(grid.nx - 1, i + 1);
    const a = grid.centerOf(i, j), b = grid.centerOf(i2, j);
    const pa = project(a.x, yOf(i, j), a.z), pb = project(b.x, yOf(i2, j), b.z);
    if (!pa || !pb) return 0;
    return Math.hypot(pb.x - pa.x, pb.y - pa.y);
  }

  /* 몇 칸마다 적을지 다시 고르고 라벨을 다시 깐다 */
  function refit() {
    if (!grid) return 0;
    fitBox();
    const px = cellPx();
    fitPx = px;
    step = px > 0.5 ? Math.max(1, Math.ceil(minGapPx / px)) : Math.max(1, Math.ceil(grid.nx / 6));
    /* 가장자리에 치우치지 않게 가운데 정렬로 고른다 */
    const si = Math.floor(((grid.nx - 1) % step) / 2), sj = Math.floor(((grid.nz - 1) % step) / 2);
    const next = [];
    /* ★ 겹침을 막는 최소 거리 — **글자 폭**이 기준이다. 「몇 px 떨어져라」를 지어내면
       글자가 그보다 넓을 때 그대로 겹친다(첫 판: 최소 거리 26px 인데 글자 폭이 28px 이었다).
       한글·숫자가 아니라 등폭 글꼴이므로 폭은 글자 수 × 약 0.62em 로 정확히 어림된다. */
    const maxLen = format(grid.max).length;
    const gapMin = Math.max(minGapPx * 0.6, fontPx * 0.62 * maxLen + 2);
    for (let i = si; i < grid.nx; i += step) for (let j = sj; j < grid.nz; j += step) {
      if (!grid.has(i, j)) continue;
      const c = grid.centerOf(i, j);
      next.push({ i, j, x: c.x, z: c.z, el: null });
    }
    /* ★ 가구 위 칸은 **건너뛰지 않는다** (2026-08-16 · 박사님 "가구 위 식물 두는 곳").
       서랍장 상판은 두세 칸뿐이라 「3칸마다」에 걸리면 통째로 빠진다 — 그러면 이번 변경의
       핵심이 화면에 안 나온다. 가구마다 **제일 밝은 칸 하나**를 반드시 적는다.
       ⚠ 그 칸이 이미 뽑혀 있으면 또 넣지 않는다(같은 자리에 숫자가 두 겹으로 찍힌다).
       ⚠⚠ **화면 거리로도 막는다.** 칸 번호가 달라도 화면에서는 붙어 있을 수 있다 —
         첫 판(surface_s2)에서 `0.63` 옆에 `0.58` 이 겹쳐 찍혀 둘 다 안 읽혔다.
         가구 위 값이 아무리 중요해도 **겹쳐서 못 읽으면 없는 것과 같다.** */
    if (typeof grid.ownerAt === 'function') {
      const picked = new Set(next.map(s => s.j * grid.nx + s.i));
      const spots = [];
      for (const s of next) { const p = project(s.x, yOf(s.i, s.j), s.z); if (p) spots.push(p); }
      const near = p => spots.some(q => Math.hypot(q.x - p.x, q.y - p.y) < gapMin);
      const best = new Map();
      for (let i = 0; i < grid.nx; i++) for (let j = 0; j < grid.nz; j++) {
        const uid = grid.has(i, j) ? grid.ownerAt(i, j) : null;
        if (!uid) continue;
        const v = grid.value(i, j), b = best.get(uid);
        if (!b || v > b.v) best.set(uid, { i, j, v });
      }
      /* 밝은 가구부터 자리를 준다 — 자리가 모자라면 어두운 쪽이 양보하는 것이 맞다 */
      for (const b of [...best.values()].sort((a, c) => c.v - a.v)) {
        if (picked.has(b.j * grid.nx + b.i)) continue;
        const c = grid.centerOf(b.i, b.j);
        const p = project(c.x, yOf(b.i, b.j), c.z);
        if (!p || near(p)) continue;
        spots.push(p);
        next.push({ i: b.i, j: b.j, x: c.x, z: c.z, el: null });
      }
    }
    /* ★ 남은 겹침도 걷는다 — 격자 숫자끼리도 시점에 따라 붙는다(바닥·가구 위가 화면에서
       같은 자리에 겹치는 경우). 화면 거리로 한 번 더 훑어 늦게 온 쪽을 뺀다. */
    {
      const kept = [], pts = [];
      for (const s of next) {
        const p = project(s.x, yOf(s.i, s.j), s.z);
        if (!p) { kept.push(s); continue; }              // 화면 밖은 update 가 감춘다
        if (pts.some(q => Math.hypot(q.x - p.x, q.y - p.y) < gapMin)) continue;
        pts.push(p); kept.push(s);
      }
      next.length = 0; next.push(...kept);
    }
    /* 남는 <span> 은 지우지 않고 감춰 둔다 — 껐다 켰다 열 번에 DOM 이 늘면 안 된다 */
    for (let k = 0; k < next.length; k++) {
      if (!pool[k]) pool[k] = span();
      next[k].el = pool[k];
      pool[k].textContent = format(grid.value(next[k].i, next[k].j));
      pool[k].style.display = '';
    }
    for (let k = next.length; k < pool.length; k++) pool[k].style.display = 'none';
    shown = next;
    return shown.length;
  }

  function setCaption() {
    if (!grid) { cap.textContent = ''; return; }
    const lo = format(grid.min), hi = format(grid.max);
    cap.innerHTML = `<b>${escapeHtml(unit)}</b> · ` +
      `<span style="color:${heatColorHex(0)}">■</span>${escapeHtml(lo)} ` +
      `→ <span style="color:${heatColorHex(1)}">■</span>${escapeHtml(hi)}` +
      (extra ? ` · ${escapeHtml(extra)}` : '');
  }
  const escapeHtml = s => String(s).replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  return {
    /* 격자를 얹는다. unit 은 **엔진이 내는 값의 이름**이다 — 여기서 지어내지 않는다. */
    set(g, opt = {}) {
      grid = g; unit = opt.unit || ''; extra = opt.extra || '';
      if (!unit) throw new Error('[빛숫자] unit 이 없습니다 — 무슨 값인지 화면이 말해야 합니다');
      format = o.format || formatterFor(grid.max);
      setCaption();
      return refit();
    },
    setVisible(on) {
      visible = !!on;
      root.style.display = visible ? '' : 'none';
      if (visible) { fitBox(); refit(); }
      return visible;
    },
    isVisible() { return visible; },
    /* 그릴 때마다 부른다. 카메라가 움직였으면 자리를, 크게 움직였으면 칸 간격을 다시 잡는다. */
    update() {
      if (!visible || !grid) return 0;
      fitBox();
      const px = cellPx();
      /* 줌이 30% 넘게 달라졌으면 몇 칸마다 적을지부터 다시 고른다 */
      if (px > 0.5 && (fitPx <= 0.5 || px / fitPx > 1.3 || fitPx / px > 1.3)) refit();
      let n = 0;
      for (const s of shown) {
        const p = project(s.x, yOf(s.i, s.j), s.z);
        if (!p || p.x < -20 || p.y < -20 || p.x > box.w + 20 || p.y > box.h + 20) {
          s.el.style.visibility = 'hidden';
          continue;
        }
        s.el.style.visibility = '';
        s.el.style.transform = `translate(-50%,-50%) translate(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px)`;
        n++;
      }
      return n;
    },
    /* 재는 창구 — 「몇 개를 그렸나 · 글자가 몇 px 인가 · 제일 붙은 둘이 몇 px 인가」 */
    stats() {
      const first = shown.find(s => s.el && s.el.style.visibility !== 'hidden');
      const r = first ? first.el.getBoundingClientRect() : null;
      /* ★ 겹쳤나를 **화면에서 직접** 잰다 — 「3칸마다」 같은 규칙만 보면 시점에 따라
         붙어 버린 것을 못 잡는다(첫 판이 그랬다). 그린 것끼리의 최소 거리다. */
      let closest = Infinity;
      const ps = [];
      for (const s of shown) {
        if (!s.el || s.el.style.visibility === 'hidden') continue;
        const p = project(s.x, yOf(s.i, s.j), s.z);
        if (!p) continue;
        for (const q of ps) {
          const d = Math.hypot(q.x - p.x, q.y - p.y);
          if (d < closest) closest = d;
        }
        ps.push(p);
      }
      return {
        closestPx: ps.length > 1 ? +closest.toFixed(1) : 0,
        visible, step, cellPx: +fitPx.toFixed(2), fontPx,
        labels: shown.length,
        drawn: shown.filter(s => s.el && s.el.style.visibility !== 'hidden').length,
        pool: pool.length,
        textPx: r ? +r.height.toFixed(2) : 0,
        textWidthPx: r ? +r.width.toFixed(2) : 0,
        sample: first ? first.el.textContent : '',
        captionPx: +cap.getBoundingClientRect().height.toFixed(2)
      };
    },
    /* 화면이 실제로 들고 있는 값 — 엔진 값과 대조할 때 쓴다(화면이 거짓말하나).
       ★ **높이와 가구 uid 도 같이 낸다** — 「가구 위 점」으로 대조하려면 그 y 로 물어야 한다. */
    readback() {
      return shown.map(s => ({
        i: s.i, j: s.j, x: +s.x.toFixed(4), z: +s.z.toFixed(4),
        y: +(typeof grid.yAt === 'function' ? grid.yAt(s.i, s.j) : 0).toFixed(4),
        onUid: typeof grid.ownerAt === 'function' ? grid.ownerAt(s.i, s.j) : null,
        text: s.el.textContent, value: grid.value(s.i, s.j)
      }));
    },
    dispose() {
      root.remove();
      if (restorePos !== null) parent.style.position = restorePos;
      pool.length = 0; shown = []; grid = null;
    }
  };
}

/* ============================================================
   방뷰에 붙이는 창구 — room_view 가 이것 하나만 들고 있으면 된다
   ------------------------------------------------------------
   view   room_view 의 공개 객체. 여기서 쓰는 것은 **공개 API 뿐**이다
          (three · grid() · roomSize() · redraw()). 내부에 손을 안 댄다.
   opt.probeAt  (x, z) => { value, y, onUid }   ★ 필수. **값도 높이도 방이 낸다.**
                여기서 지어내는 것은 없다 — 그래야 화면과 판정이 못 갈린다.
   opt.unit     '(DLI) mol/m²·d' 처럼 **무슨 값인지**. 필수 — 화면이 단위를 지어내지 않는다.
   opt.extra    조건 한 줄('맑음 · 여름 · 등 0개') — 무엇을 켜고 껐는지 화면이 말한다

   ★ 끈 상태가 기본이고, **켤 때만 잰다.** off 면 판도 숫자도 아무 일을 안 한다.
============================================================ */
export function attachLightHeatmap(view, opt = {}) {
  const ctx = view.three;
  const canvas = opt.canvas || ctx.renderer.domElement;
  let mesh = null, labels = null, gridData = null;
  let on = false, key = '', unwrap = null;
  let lastMs = 0, lastCells = 0;

  function geom() {
    const g = view.grid();
    if (!g || !g.room) throw new Error('[빛분포] 방이 아직 안 지어졌습니다');
    const cell = g.cell, nx = g.room.cols, nz = g.room.rows, inner = g.room.inner;
    /* ★ room_view §gridSpan 과 **글자 그대로 같은 식**이다. 여기서 다르게 깔면
       색칠한 칸과 눈금선이 어긋나 「그리드 살리면서」가 깨진다. */
    const x0 = inner.x0 + (inner.w - nx * cell) / 2;
    const z0 = inner.z0 + (inner.d - nz * cell) / 2;
    return { nx, nz, cell, x0, z0, roomId: view.roomId };
  }

  /* 라벨은 그린 뒤에 자리를 잡아야 한다 — renderer.render 를 한 겹 감싼다.
     ⚠ 되돌릴 수 있게 원래 함수를 들고 있는다. dispose 에서 정확히 되돌린다. */
  function hookRender() {
    if (unwrap || opt.hookRender === false) return;
    const r = ctx.renderer, orig = r.render.bind(r);
    r.render = (s, c) => { orig(s, c); if (on && labels) labels.update(); };
    unwrap = () => { r.render = orig; unwrap = null; };
  }

  function drop() {
    if (mesh) { ctx.scene.remove(mesh); mesh.geometry.dispose(); mesh.material.dispose(); mesh = null; }
    if (labels) { labels.dispose(); labels = null; }
    gridData = null; key = '';
  }

  /* 실제로 잰다 — 여기가 유일하게 방·엔진을 부르는 자리다.
     ⚠ **재고 나서 판을 짓는다.** 칸마다 높이가 다르므로 격자를 모르면 판을 못 짓는다.
       칸 수가 그대로면 판은 다시 안 짓고 높이·색만 갈아 끼운다(가구를 옮겼을 때). */
  function measure() {
    if (typeof opt.probeAt !== 'function')
      throw new Error('[빛분포] probeAt 이 없습니다 — 값도 높이도 방이 냅니다');
    const G = geom();
    const k = `${G.roomId}|${G.nx}x${G.nz}|${G.cell}`;
    const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    /* ⚠ **먼저 지역 변수에 받는다.** 아래 drop() 이 gridData 를 비우므로, 여기서 바로
       gridData 에 넣으면 판을 지을 때 null 을 넘기게 된다(실제로 그렇게 터졌다). */
    const g = sampleLightGrid({ nx: G.nx, nz: G.nz, x0: G.x0, z0: G.z0, cell: G.cell,
                                probeAt: opt.probeAt, keep: opt.keep });
    lastMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
    lastCells = g.count;
    if (!mesh || key !== k) {
      const wasVisible = !!(mesh && mesh.visible);
      drop();
      key = k;
      mesh = buildCellHeatmap(g,
                              { y: opt.y3d ?? 0.0022, opacity: opt.opacity ?? 0.45,
                                renderOrder: opt.renderOrder ?? 1, depthTest: opt.depthTest });
      mesh.visible = wasVisible;
      ctx.scene.add(mesh);
      labels = createLightGridLabels({ canvas, camera: ctx.cam,
                                       fontPx: opt.fontPx, minGapPx: opt.minGapPx,
                                       captionPos: opt.captionPos,
                                       format: opt.format, lift: opt.labelLift });
    }
    gridData = g;
    updateCellHeatmap(mesh, gridData);
    labels.set(gridData, { unit: opt.unit, extra: opt.extra });
    return gridData;
  }

  return {
    /* 켜고 끈다. **켤 때만 잰다.** */
    set(want) {
      const w = !!want;
      if (w === on && mesh) return on;
      on = w;
      if (!on) {
        if (mesh) mesh.visible = false;
        if (labels) labels.setVisible(false);
        view.redraw();
        return on;
      }
      measure();
      hookRender();
      mesh.visible = true;
      labels.setVisible(true);
      view.redraw();
      labels.update();
      return on;
    },
    /* 조건이 바뀌었다(날이 갔다·등을 켰다) → 다시 잰다. 꺼져 있으면 아무 일도 안 한다. */
    refresh(next = {}) {
      if (next.probeAt) opt.probeAt = next.probeAt;
      if (next.unit) opt.unit = next.unit;
      if (next.extra !== undefined) opt.extra = next.extra;
      if (!on) return false;
      measure();
      mesh.visible = true;
      labels.setVisible(true);
      view.redraw();
      labels.update();
      return true;
    },
    isOn() { return on; },
    /* 한 장 그린 뒤 숫자 자리를 다시 잡는다. 기본은 renderer.render 를 감싸 저절로 돌지만,
       호스트가 `hookRender:false` 로 끄고 자기 루프에서 부르고 싶으면 이것을 쓴다. */
    tick() { return (on && labels) ? labels.update() : 0; },
    /* 방을 다시 지었다(**가구를 옮겼다**·방을 갈아탔다) → 다시 잰다.
       ⚠ 두 가지가 같이 바뀐다 — ⓐ 높이 지도(책상이 있던 칸이 바닥이 된다)
         ⓑ 그림자(차폐가 움직인다). 그래서 색만이 아니라 **판의 높이까지** 다시 잡아야 한다.
       ⚠ 꺼져 있으면 **아무 일도 안 한다.** 옮길 때마다 재면 폰이 멎는다.
       ⚠ 판은 버리지 않는다 — 칸 수가 같으면 높이·색만 갈아 끼운다(지오메트리가 안 샌다). */
    rebuild() {
      if (!on) return false;
      measure();
      mesh.visible = true;
      labels.setVisible(true);
      view.redraw();
      labels.update();
      return true;
    },
    stats() {
      return {
        on, key,
        cells: lastCells, ms: +lastMs.toFixed(1),
        min: gridData ? +gridData.min.toFixed(3) : null,
        max: gridData ? +gridData.max.toFixed(3) : null,
        /* 높이 지도가 실제로 도는지 재는 자가 보는 두 값 */
        onFurniture: gridData ? gridData.onFurniture : 0,
        yMax: gridData ? +gridData.yMax.toFixed(3) : 0,
        tris: mesh ? mesh.geometry.index.count / 3 : 0,
        labels: labels ? labels.stats() : null
      };
    },
    /* 숫자를 적은 칸만 — 「글자가 값을 옳게 줄였나」를 재는 자가 쓴다 */
    readback() { return labels ? labels.readback() : []; },
    /* ★ 칠한 칸 **전부** — 자리·표면 높이·가구 uid·값. 화면이 거짓말하나를 여기서 대조한다. */
    cells() {
      if (!gridData) return [];
      const out = [];
      for (let i = 0; i < gridData.nx; i++) for (let j = 0; j < gridData.nz; j++) {
        if (!gridData.has(i, j)) continue;
        const c = gridData.centerOf(i, j);
        out.push({ i, j, x: +c.x.toFixed(4), y: +gridData.yAt(i, j).toFixed(4), z: +c.z.toFixed(4),
                   onUid: gridData.ownerAt(i, j), value: gridData.value(i, j) });
      }
      return out;
    },
    valueAtCell(i, j) { return gridData ? gridData.value(i, j) : null; },
    grid() { return gridData; },
    dispose() { on = false; if (unwrap) unwrap(); drop(); }
  };
}
