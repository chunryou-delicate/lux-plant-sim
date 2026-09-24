/* ============================================================
   render3d/room_materials.js — v2 방 껍데기 겉감 (벽지·장판·콘크리트·걸레받이·창틀)
   ------------------------------------------------------------
   아트 기준: assets/gen/v2_room/style_keyframe_a.png
     · 벽 = 바랜 노란 꽃무늬 벽지(꽃 6~8cm) + 창 밑·아래 구석 눅눅한 얼룩·곰팡이
     · 걸레받이 = 얇은 나무띠 — ★ 칠한 것이다. 기하를 안 늘린다
       (house.js addSkirting 이 튀어나온 턱을 일부러 껐다 — 가구가 박혀 보였다)
     · 바닥 = 노란 장판 + 옅은 얼룩덜룩 + 긁힌 자국 몇
     · 천장 = 회백 콘크리트 · 잘린 단면(벽 윗면·바닥 옆면) = 어두운 콘크리트
     · 창틀 = 흰 페인트칠 · 유리는 그대로

   ★ 그림뿐이다. 조도 엔진은 재질을 안 읽는다(light_adapter 는 occluders·luxWins·
     plantSlots 만 쓴다). 기하·userData·그림자 역할도 안 건드린다.
   ★ UV 도 안 고친다 — 박스 UV 는 면마다 0..1 이라 벽 조각마다 늘어난다.
     대신 셰이더가 **월드 좌표(m)** 로 무늬를 찍는다(onBeforeCompile). 조각 크기와 무관하게
     꽃 한 송이가 어디서나 같은 크기다.
   ★ 텍스처는 페이지에 한 벌(모듈 캐시). 가구를 옮겨 방을 다시 지어도 새로 안 만든다.
   ★ 끄기: ?v2=0 (v2 전부) · ?v2mat=0 (이것만) · localStorage 'v2' / 'v2mat' = '0'
============================================================ */

/* ---- v2 스위치 (공용 규약: window.__v2, ?v2=0 은 전부 끔) ---- */
export function v2Flag(key) {
  const g = (typeof window !== 'undefined') ? window : null;
  if (!g) return false;
  g.__v2 = g.__v2 || {};
  let on = true;
  try {
    const q = new URLSearchParams((g.location && g.location.search) || '');
    let ls = k => null;
    try { const s = g.localStorage; ls = k => s.getItem(k); } catch (_) { /* 저장소 막힘 — URL 만 본다 */ }
    if (q.get('v2') === '0' || ls('v2') === '0') on = false;
    else if (q.get(key) === '0' || ls(key) === '0') on = false;
  } catch (_) { on = true; }
  g.__v2[key] = on;
  return on;
}

/* ---- 방마다 겉감 표. 없는 방은 손대지 않는다(원룸은 나중) ---- */
const STYLES = {
  banjiha: {
    /* tint: dimRoomMaterials 가 누르기 «전» 바탕색. 1 보다 크면 그만큼 덜 눌린다.
       노랑은 ACES 발밑(toe)에서 올리브로 가라앉는다 — 회색과 같은 밝기로 읽히게 조금 올린다 */
    wall:  { tileM: 0.30, rough: 0.92, grime: 1.0, baseH: 0.075, tint: [1.26, 1.20, 1.06] },
    floor: { tileM: 1.20, rough: 0.58, grime: 1.0, tint: [1.34, 1.24, 0.98] },
    ceil:  { tileM: 1.00, rough: 0.96, tint: [1, 1, 1] },
    capHex: '#9b958b',          // 잘린 단면 콘크리트
    woodHex: '#a57650',         // 걸레받이 나무
    frameHex: '#f6f2e9',        // 창틀 흰 페인트
    frameTint: 1.30,            // 누르기 전 바탕 배수 — 역광에서도 «흰 칠»로 읽히게
    /* 벽 얼룩 — 월드 좌표. r:[가로 m, 세로 m], k: 세기.
       ch: 'damp' 눅눅한 번짐(R) · 'mold' 곰팡이 점(G) · 'halo' 누런 테(B) · 'drip' 흘러내린 줄(R) */
    stains: [
      /* 창 밑 — 창턱에서 스며 흘러내린 자국 */
      { ch: 'halo', at: [0.0, 1.40, -2], r: [1.05, 0.16], k: 0.45 },
      { ch: 'damp', at: [0.0, 1.42, -2], r: [0.95, 0.10], k: 0.40 },
      { ch: 'drip', at: [-0.78, 1.49, -2], r: [0.09, 0.55], k: 0.50 },
      { ch: 'drip', at: [-0.22, 1.49, -2], r: [0.07, 0.32], k: 0.40 },
      { ch: 'drip', at: [0.46, 1.49, -2], r: [0.10, 0.48], k: 0.48 },
      { ch: 'drip', at: [0.92, 1.49, -2], r: [0.07, 0.26], k: 0.36 },
      /* 창 위 모서리 — 조금 */
      { ch: 'damp', at: [1.08, 2.12, -2], r: [0.20, 0.14], k: 0.45 },
      /* 뒤-오른쪽 아래 구석 — 곰팡이 */
      { ch: 'damp', at: [2.45, 0.02, -2], r: [0.80, 0.62], k: 0.72 },
      { ch: 'halo', at: [2.35, 0.05, -2], r: [1.00, 0.85], k: 0.35 },
      { ch: 'mold', at: [2.42, 0.10, -2], r: [0.34, 0.30], k: 0.80 },
      { ch: 'damp', at: [2.5, 0.02, -1.95], r: [0.62, 0.58], k: 0.70 },
      { ch: 'halo', at: [2.5, 0.05, -1.90], r: [0.85, 0.80], k: 0.32 },
      { ch: 'mold', at: [2.5, 0.10, -1.88], r: [0.28, 0.26], k: 0.75 },
      /* 오른쪽 벽 윗구석 — 천장에서 번진 얼룩 (원화 오른쪽 벽) */
      { ch: 'damp', at: [2.5, 2.30, -1.70], r: [0.42, 0.55], k: 0.55 },
      { ch: 'drip', at: [2.5, 2.10, -1.55], r: [0.06, 0.55], k: 0.40 },
      { ch: 'halo', at: [2.5, 2.25, -1.70], r: [0.60, 0.75], k: 0.30 },
      /* 왼쪽 뒤 아래 구석 — 옅게 */
      { ch: 'damp', at: [-2.5, 0.02, -1.95], r: [0.45, 0.35], k: 0.45 },
      { ch: 'damp', at: [-2.45, 0.02, -2], r: [0.40, 0.32], k: 0.40 },
      { ch: 'mold', at: [-2.45, 0.08, -2], r: [0.18, 0.16], k: 0.55 },
    ],
    /* 바닥 — 월드 x,z. 닳은 길(R) · 긁힘(G) · 때(B) */
    floorMarks: {
      wear: [[-1.6, 2.0], [-1.35, 1.2], [-0.8, 0.55], [0.0, 0.15], [0.8, -0.25], [1.25, -0.55]],
      scuffs: [
        { at: [-1.55, 1.55], len: 0.22, ang: 0.4, n: 3 },
        { at: [-1.05, 0.95], len: 0.16, ang: -0.2, n: 2 },
        { at: [1.25, -0.45], len: 0.28, ang: 1.45, n: 4 },     // 의자 끈 자국
        { at: [0.25, 0.35], len: 0.14, ang: 2.2, n: 2 },
        { at: [-0.6, -0.2], len: 0.12, ang: 0.9, n: 1 },
        { at: [1.75, 0.95], len: 0.18, ang: 0.1, n: 2 },
      ],
      dirt: [
        { at: [0.0, -1.82], r: [0.85, 0.12], k: 0.55 },       // 창 밑 물 떨어진 자리
        { at: [-1.6, 1.9], r: [0.45, 0.14], k: 0.45 },        // 문 앞
        { at: [2.3, -1.8], r: [0.35, 0.35], k: 0.40 },        // 눅눅한 구석
      ],
      rings: [[0.62, 0.78, 0.045], [-0.2, 1.2, 0.035]],
    },
  },
};

/* ============================================================
   잡음 — 주기(타일) 값 잡음. 이음새 없이 반복된다
============================================================ */
function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
function fbm(S, P0, oct, seed, gain = 0.5) {
  const out = new Float32Array(S * S);
  let amp = 1, norm = 0;
  for (let o = 0; o < oct; o++) {
    const P = P0 << o, r = rng(seed + o * 7919), g = new Float32Array(P * P);
    for (let i = 0; i < g.length; i++) g[i] = r();
    const k = P / S;
    for (let y = 0; y < S; y++) {
      const fy = y * k, yi = Math.floor(fy), ty = fy - yi, sy = ty * ty * (3 - 2 * ty);
      const y0 = yi % P, y1 = (y0 + 1) % P;
      for (let x = 0; x < S; x++) {
        const fx = x * k, xi = Math.floor(fx), tx = fx - xi, sx = tx * tx * (3 - 2 * tx);
        const x0 = xi % P, x1 = (x0 + 1) % P;
        const a = g[y0 * P + x0], b = g[y0 * P + x1], c = g[y1 * P + x0], d = g[y1 * P + x1];
        out[y * S + x] += amp * (a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy);
      }
    }
    norm += amp; amp *= gain;
  }
  /* 0..1 로 편다 — 문턱값(얼룩 가장자리·곰팡이 점)이 방마다 같게 먹도록 */
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < out.length; i++) { const v = out[i] / norm; out[i] = v; if (v < lo) lo = v; if (v > hi) hi = v; }
  const d = (hi - lo) || 1;
  for (let i = 0; i < out.length; i++) out[i] = (out[i] - lo) / d;
  return out;
}

function canvas(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  return c;
}
function canvasTex(c, srgb) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  if (srgb) t.encoding = THREE.sRGBEncoding;
  return t;
}
const hexRGB = h => { const n = parseInt(h.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

/* ---- 잡음 텍스처: R 잔결 · G 중간 · B 굵은 · A 점(곰팡이·반점) ---- */
function makeNoise() {
  const S = 256;
  const r = fbm(S, 16, 3, 11), g = fbm(S, 6, 4, 23), b = fbm(S, 3, 3, 37), a = fbm(S, 48, 2, 51, 0.6);
  const d = new Uint8Array(S * S * 4);
  for (let i = 0; i < S * S; i++) {
    d[i * 4] = r[i] * 255; d[i * 4 + 1] = g[i] * 255; d[i * 4 + 2] = b[i] * 255; d[i * 4 + 3] = a[i] * 255;
  }
  const t = new THREE.DataTexture(d, S, S, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true; t.anisotropy = 2; t.needsUpdate = true;
  return t;
}

/* ---- 벽지: 바랜 버터색 바탕 + 작은 꽃가지(반 칸 어긋난 배열). 한 칸 = tileM ---- */
function makeWallpaper(tileM) {
  const S = 512, c = canvas(S, S), x = c.getContext('2d');
  const px = S / tileM;                                    // 1m 당 픽셀
  /* 바탕 — 종이결 */
  const base = hexRGB('#f6e5bf'), n = fbm(S, 8, 4, 101), f = fbm(S, 64, 2, 131);
  const img = x.createImageData(S, S);
  for (let i = 0; i < S * S; i++) {
    const k = 0.975 + 0.04 * n[i] + 0.02 * (f[i] - 0.5);
    img.data[i * 4] = Math.min(255, base[0] * k); img.data[i * 4 + 1] = Math.min(255, base[1] * k);
    img.data[i * 4 + 2] = Math.min(255, base[2] * (k - 0.01)); img.data[i * 4 + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  /* 옅은 세로 줄무늬 — 옛 벽지의 눌린 결 */
  x.globalAlpha = 0.05; x.fillStyle = '#c9b477';
  for (let i = 0; i < 16; i++) x.fillRect(i * S / 16, 0, 2, S);
  x.globalAlpha = 1;

  const R = rng(777);
  const sprig = (cx, cy, rot, flip, nb) => {
    x.save(); x.translate(cx, cy); x.rotate(rot); x.scale(flip ? -1 : 1, 1);
    const L = 0.068 * px;                                  // 꽃가지 길이 ≈ 6.8cm
    x.globalAlpha = 0.52;
    /* 줄기 */
    x.strokeStyle = '#a3aa7c'; x.lineWidth = 0.0030 * px; x.lineCap = 'round';
    x.beginPath(); x.moveTo(0, L * 0.5); x.quadraticCurveTo(L * 0.18, 0, -L * 0.05, -L * 0.42); x.stroke();
    /* 잎 */
    x.fillStyle = '#a9b37f';
    for (const [lx, ly, la] of [[0.10, 0.22, 0.9], [-0.06, 0.05, -0.8], [0.08, -0.16, 0.6]]) {
      x.save(); x.translate(lx * L, ly * L); x.rotate(la);
      x.beginPath(); x.ellipse(0, 0, L * 0.16, L * 0.055, 0, 0, Math.PI * 2); x.fill(); x.restore();
    }
    /* 꽃 — 다섯 잎 */
    const heads = [[-0.05, -0.44, 1.0], [0.20, -0.20, 0.78], [-0.16, -0.12, 0.66]].slice(0, nb);
    for (const [hx0, hy0, s] of heads) {
      const hx = hx0 * L, hy = hy0 * L, pr = 0.012 * px * s;
      x.fillStyle = R() < 0.5 ? '#e39c76' : '#e9ab85';
      for (let p = 0; p < 5; p++) {
        const a = p / 5 * Math.PI * 2 + R();
        x.beginPath(); x.arc(hx + Math.cos(a) * pr * 0.95, hy + Math.sin(a) * pr * 0.95, pr * 0.72, 0, Math.PI * 2); x.fill();
      }
      x.fillStyle = '#efcf80'; x.beginPath(); x.arc(hx, hy, pr * 0.45, 0, Math.PI * 2); x.fill();
    }
    x.restore();
  };
  const bud = (cx, cy) => {
    x.save(); x.translate(cx, cy); x.globalAlpha = 0.45;
    const pr = 0.006 * px;
    x.fillStyle = '#e5a582';
    for (let p = 0; p < 4; p++) { const a = p / 4 * Math.PI * 2 + 0.4; x.beginPath(); x.arc(Math.cos(a) * pr, Math.sin(a) * pr, pr * 0.8, 0, Math.PI * 2); x.fill(); }
    x.fillStyle = '#a9b37f'; x.beginPath(); x.ellipse(pr * 1.6, pr * 1.4, pr * 1.2, pr * 0.45, 0.7, 0, Math.PI * 2); x.fill();
    x.restore();
  };
  /* 반 칸 어긋남: 가로 15cm · 세로 15cm 간격, 옆 줄은 7.5cm 내림 */
  const M = [
    [0.25, 0.125, -0.25, false, 3], [0.75, 0.375, 0.30, true, 2],
    [0.25, 0.625, 0.18, true, 3],   [0.75, 0.875, -0.20, false, 2],
  ];
  const B = [[0.0, 0.40], [0.5, 0.15], [0.0, 0.90], [0.5, 0.65]];
  for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) {
    for (const [u, v, r, fl, nb] of M) sprig(u * S + dx, v * S + dy, r, fl, nb);
    for (const [u, v] of B) bud(u * S + dx, v * S + dy);
  }
  return canvasTex(c, true);
}

/* ---- 장판: 노란 바탕 + 얼룩덜룩 + 잔 반점 + 결 몇 가닥. 한 칸 = tileM ---- */
function makeLino() {
  const S = 512, c = canvas(S, S), x = c.getContext('2d');
  const base = hexRGB('#ecc673'), m = fbm(S, 4, 5, 201, 0.55), s = fbm(S, 96, 1, 233), t = fbm(S, 24, 2, 251);
  const img = x.createImageData(S, S);
  for (let i = 0; i < S * S; i++) {
    let k = 0.95 + 0.07 * m[i] + 0.03 * (t[i] - 0.5);
    if (s[i] > 0.84) k -= 0.05; else if (s[i] < 0.12) k += 0.04;       // 잔 반점
    const warm = 1 - 0.04 * (1 - m[i]);                                  // 어두운 데는 조금 더 주황
    img.data[i * 4] = Math.min(255, base[0] * k);
    img.data[i * 4 + 1] = Math.min(255, base[1] * k * warm);
    img.data[i * 4 + 2] = Math.min(255, base[2] * k * warm * warm);
    img.data[i * 4 + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  /* 결 — 짧은 가는 금 */
  const R = rng(303);
  x.lineCap = 'round';
  for (let i = 0; i < 140; i++) {
    const X = R() * S, Y = R() * S, L = 6 + R() * 22, a = R() * Math.PI;
    x.strokeStyle = R() < 0.5 ? 'rgba(150,115,50,0.08)' : 'rgba(255,244,200,0.10)';
    x.lineWidth = 0.8 + R();
    x.beginPath(); x.moveTo(X, Y); x.lineTo(X + Math.cos(a) * L, Y + Math.sin(a) * L); x.stroke();
  }
  return canvasTex(c, true);
}

/* ---- 콘크리트(천장): 회백 + 얼룩 + 기포 구멍 ---- */
function makeConcrete() {
  const S = 256, c = canvas(S, S), x = c.getContext('2d');
  const base = hexRGB('#dcd8d0'), m = fbm(S, 4, 5, 401, 0.55), p = fbm(S, 64, 1, 433);
  const img = x.createImageData(S, S);
  for (let i = 0; i < S * S; i++) {
    let k = 0.93 + 0.10 * m[i];
    if (p[i] > 0.9) k -= 0.18;
    img.data[i * 4] = Math.min(255, base[0] * k); img.data[i * 4 + 1] = Math.min(255, base[1] * k);
    img.data[i * 4 + 2] = Math.min(255, base[2] * k); img.data[i * 4 + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  return canvasTex(c, true);
}

let _tex = null;
function shared(st) {
  if (_tex) return _tex;
  _tex = { noise: makeNoise(), wall: makeWallpaper(st.wall.tileM), lino: makeLino(), conc: makeConcrete() };
  return _tex;
}

/* ============================================================
   얼룩 지도 — 면 하나를 통째로 덮는 저해상 캔버스(데이터).
   R 번짐 · G 곰팡이 · B 누런 테. 가장자리는 셰이더가 잡음으로 깎아 또렷하게 만든다.
============================================================ */
const _grime = new Map();
function blob(x, cx, cy, rx, ry, rgb, a) {
  x.save(); x.translate(cx, cy); x.scale(Math.max(rx, 0.5), Math.max(ry, 0.5));
  const g = x.createRadialGradient(0, 0, 0, 0, 0, 1);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.55, `rgba(${rgb},${a * 0.55})`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(-1, -1, 2, 2); x.restore();
}
function wallGrime(key, rect, uAx, stains) {
  if (_grime.has(key)) return _grime.get(key);
  const [u0, u1, y0, y1] = rect;
  const W = 256, H = 128;                                   // 2의 거듭제곱 — WebGL1 에서 늘려 붙이지 않게
  const c = canvas(W, H), x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
  x.globalCompositeOperation = 'lighter';
  const sx = W / (u1 - u0), sy = H / (y1 - y0);
  const R = rng(key.length * 131 + 7);
  for (const s of stains) {
    const u = s.at[0] * uAx[0] + s.at[2] * uAx[2];
    const cx = (u - u0) * sx, cy = (1 - (s.at[1] - y0) / (y1 - y0)) * H;
    const rx = s.r[0] * sx, ry = s.r[1] * sy;
    if (s.ch === 'drip') {
      /* 위에서 아래로 가늘어지며 흐른 줄 — 짧은 방울 여럿 */
      for (let i = 0; i < 7; i++) {
        const t = i / 6, w = rx * (1 - t * 0.6) * (0.8 + R() * 0.4);
        blob(x, cx + (R() - 0.5) * rx * 0.6, cy + t * ry, w, ry * 0.28, '255,0,0', s.k * (1 - t * 0.55));
      }
      blob(x, cx, cy + ry * 0.2, rx * 3, ry * 0.5, '0,0,255', s.k * 0.35);
    } else {
      const rgb = s.ch === 'mold' ? '0,255,0' : s.ch === 'halo' ? '0,0,255' : '255,0,0';
      blob(x, cx, cy, rx, ry, rgb, s.k);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  _grime.set(key, t);
  return t;
}
function floorGrime(key, rect, fm) {
  if (_grime.has(key)) return _grime.get(key);
  const [x0, x1, z0, z1] = rect;
  const W = 512, H = 512;
  const c = canvas(W, H), x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
  x.globalCompositeOperation = 'lighter';
  const P = (X, Z) => [(X - x0) / (x1 - x0) * W, (1 - (Z - z0) / (z1 - z0)) * H];
  const m = W / (x1 - x0);                                  // 1m 당 픽셀
  const R = rng(4242);
  /* 닳은 길 — 문에서 방 가운데로 */
  const wp = fm.wear || [];
  for (let i = 0; i + 1 < wp.length; i++) {
    const [ax, az] = wp[i], [bx, bz] = wp[i + 1];
    for (let t = 0; t < 1; t += 0.08) {
      const [cx, cy] = P(ax + (bx - ax) * t, az + (bz - az) * t);
      blob(x, cx, cy, 0.42 * m, 0.42 * m, '255,0,0', 0.07);
    }
  }
  /* 긁힌 자국 — 가는 금 */
  x.lineCap = 'round';
  for (const s of (fm.scuffs || [])) {
    for (let i = 0; i < s.n; i++) {
      const [cx, cy] = P(s.at[0] + (R() - 0.5) * 0.10, s.at[1] + (R() - 0.5) * 0.10);
      const L = s.len * m * (0.6 + R() * 0.5), a = -s.ang + (R() - 0.5) * 0.3;
      x.strokeStyle = `rgba(0,255,0,${0.55 + R() * 0.35})`; x.lineWidth = 1 + R() * 1.4;
      x.beginPath(); x.moveTo(cx, cy);
      x.quadraticCurveTo(cx + Math.cos(a) * L * 0.5 + (R() - 0.5) * 6, cy + Math.sin(a) * L * 0.5 + (R() - 0.5) * 6,
                         cx + Math.cos(a) * L, cy + Math.sin(a) * L);
      x.stroke();
    }
  }
  for (const d of (fm.dirt || [])) {
    const [cx, cy] = P(d.at[0], d.at[1]);
    blob(x, cx, cy, d.r[0] * m, d.r[1] * m, '0,0,255', d.k);
  }
  for (const [rx, rz, rr] of (fm.rings || [])) {
    const [cx, cy] = P(rx, rz);
    x.strokeStyle = 'rgba(0,0,255,0.55)'; x.lineWidth = 1.2;
    x.beginPath(); x.arc(cx, cy, rr * m, 0, Math.PI * 2); x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  _grime.set(key, t);
  return t;
}

/* ============================================================
   셰이더 — 모든 겉감이 **같은 함수 하나**를 쓴다 → 프로그램 한 벌(컴파일 1번).
   값은 재질마다 _uni 에 따로 든다.
============================================================ */
const _uni = new WeakMap();
const VERT_HEAD = 'varying vec3 v2W;\nvarying vec3 v2N;\n';
const VERT_TAIL = `#include <fog_vertex>
	v2W = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;
	v2N = normalize( mat3( modelMatrix ) * objectNormal );`;
const FRAG_HEAD = `
#if __VERSION__ >= 300 || defined( GL_OES_standard_derivatives )
#define V2_FW( v ) fwidth( v )
#else
#define V2_FW( v ) 0.002
#endif
uniform sampler2D v2Grime;
uniform sampler2D v2Noise;
uniform vec4 v2Kind;
uniform vec3 v2In;
uniform vec3 v2UAx;
uniform vec4 v2Rect;
uniform vec4 v2Inner;
uniform vec3 v2CapC;
uniform vec3 v2WoodC;
varying vec3 v2W;
varying vec3 v2N;
/* 잘린 단면·바깥면 = 콘크리트. 면 방향대로 좌표를 골라 줄무늬가 안 생기게 */
vec3 v2Cap( vec3 P, vec3 N ) {
	vec3 an = abs( N );
	vec2 cq = an.y > 0.5 ? P.xz : ( an.x > an.z ? P.zy : P.xy );
	vec4 cn = texture2D( v2Noise, cq * 1.1 );
	vec3 c = v2CapC * ( 0.86 + 0.26 * cn.g );
	c *= 1.0 - 0.22 * smoothstep( 0.74, 0.92, cn.a );
	return c * ( N.y > 0.5 ? 1.0 : 0.88 );
}
`;
/* v2Kind: x 종류(1 벽 · 2 바닥 · 3 천장) · y 무늬 한 칸[m] · z 걸레받이 높이[m] · w 얼룩 세기
   v2Rect: 얼룩 지도가 덮는 범위 — 벽 (u0,u1,y0,y1) · 바닥/천장 (x0,x1,z0,z1)
   v2Inner: 벽 (안쪽 구석 u0, u1, 천장 높이) · 바닥/천장 (안쪽 반폭 x, 반깊이 z) */
const FRAG_MAP = `
	float v2RoughK = 1.0;
	{
		vec3 N = normalize( v2N );
		vec3 P = v2W;
		vec3 col;
		if ( v2Kind.x < 1.5 ) {
			float u = dot( P, v2UAx );
			vec2 q = vec2( u, P.y );
			if ( dot( N, v2In ) > 0.5 ) {
				vec4 nz = texture2D( v2Noise, q * 1.6 );
				vec4 nc = texture2D( v2Noise, q * 0.23 );
				col = mapTexelToLinear( texture2D( map, q / v2Kind.y ) ).rgb;
				col *= 0.96 + 0.08 * nc.b;
				vec2 guv = vec2( ( u - v2Rect.x ) / ( v2Rect.y - v2Rect.x ), ( P.y - v2Rect.z ) / ( v2Rect.w - v2Rect.z ) );
				vec4 g = texture2D( v2Grime, guv );
				/* 물 얼룩: 안은 누렇게 바래고, 테두리에 갈색 선, 가운데 진한 데는 회갈색 */
				float dm = g.r + ( nc.g - 0.5 ) * 0.40 + ( nz.r - 0.5 ) * 0.10;
				float stain = smoothstep( 0.28, 0.44, dm );
				float core = smoothstep( 0.55, 0.90, dm );
				float tide = smoothstep( 0.25, 0.30, dm ) * ( 1.0 - smoothstep( 0.31, 0.38, dm ) );
				col = mix( col, col * vec3( 0.93, 0.85, 0.68 ), stain * v2Kind.w );
				col = mix( col, col * vec3( 0.80, 0.72, 0.60 ), core * 0.75 * v2Kind.w );
				col = mix( col, col * vec3( 0.76, 0.62, 0.44 ), tide * 0.50 * v2Kind.w );
				col = mix( col, col * vec3( 0.94, 0.89, 0.77 ), clamp( g.b, 0.0, 1.0 ) * 0.8 * v2Kind.w );
				/* 곰팡이: 구석에 모인 잔 점 */
				float mold = g.g * smoothstep( 0.58, 0.80, nz.a + g.g * 0.22 );
				col = mix( col, vec3( 0.07, 0.08, 0.06 ), clamp( mold, 0.0, 1.0 ) * 0.70 * v2Kind.w );
				/* 구석·천장선·바닥선 그늘(가짜 AO) */
				float BH = v2Kind.z;
				float du = min( u - v2Inner.x, v2Inner.y - u );
				float ao = mix( 0.80, 1.0, smoothstep( 0.0, 0.40, du ) );
				ao *= mix( 0.88, 1.0, smoothstep( 0.0, 0.30, v2Inner.z - P.y ) );
				ao *= mix( 0.84, 1.0, smoothstep( BH, BH + 0.24, P.y ) );
				col *= ao;
				/* 걸레받이 — 칠한 나무띠(기하 없음) */
				if ( BH > 0.0 ) {
					float fw = max( V2_FW( P.y ), 0.0006 );
					float bb = 1.0 - smoothstep( BH - fw, BH + fw, P.y );
					float gr = texture2D( v2Noise, vec2( u * 0.45, P.y * 5.0 ) ).r;
					vec3 wood = v2WoodC * ( 0.84 + 0.28 * gr ) * mix( 0.82, 1.0, smoothstep( 0.0, 0.3, du ) );
					float lip = smoothstep( BH - 0.014 - fw, BH - 0.014 + fw, P.y );
					wood *= 1.0 + 0.30 * lip;
					wood *= mix( 0.72, 1.0, smoothstep( 0.0, 0.012, P.y ) );
					col = mix( col, wood, bb );
					v2RoughK = mix( 1.0, 0.62, bb );
				}
			} else {
				col = v2Cap( P, N );
			}
		} else if ( v2Kind.x < 2.5 ) {
			vec2 q = P.xz;
			if ( N.y > 0.5 ) {
				vec4 nz = texture2D( v2Noise, q * 1.3 );
				vec4 nc = texture2D( v2Noise, q * 0.19 );
				col = mapTexelToLinear( texture2D( map, q / v2Kind.y ) ).rgb;
				col *= 0.96 + 0.08 * nc.b;
				vec2 guv = vec2( ( P.x - v2Rect.x ) / ( v2Rect.y - v2Rect.x ), ( P.z - v2Rect.z ) / ( v2Rect.w - v2Rect.z ) );
				vec4 g = texture2D( v2Grime, guv );
				/* 닳은 길: 조금 옅고 덜 노랗게 */
				float lum = dot( col, vec3( 0.299, 0.587, 0.114 ) );
				col = mix( col, mix( col, vec3( lum ), 0.28 ) * 1.03, clamp( g.r, 0.0, 1.0 ) * 0.8 * v2Kind.w );
				/* 긁힌 자국 */
				float sc = clamp( g.g * ( 0.7 + 0.6 * nz.r ), 0.0, 1.0 );
				col = mix( col, col * vec3( 0.62, 0.56, 0.48 ), sc * 0.75 * v2Kind.w );
				/* 때·물 자국 */
				col = mix( col, col * vec3( 0.84, 0.76, 0.62 ), clamp( g.b * ( 0.55 + 0.6 * nz.g ), 0.0, 1.0 ) * v2Kind.w );
				v2RoughK = 1.0 + 0.45 * g.g + 0.30 * g.r;
				/* 벽 밑 가장자리: 그늘 + 때 낀 띠 */
				float de = min( v2Inner.x - abs( P.x ), v2Inner.y - abs( P.z ) );
				col *= mix( 0.80, 1.0, smoothstep( 0.0, 0.34, de ) );
				col = mix( col * vec3( 0.84, 0.78, 0.68 ), col, smoothstep( 0.0, 0.07, de + ( nz.g - 0.5 ) * 0.05 ) );
			} else {
				col = v2Cap( P, N ) * 0.80;
			}
		} else {
			vec2 q = P.xz;
			if ( N.y < -0.5 ) {
				col = mapTexelToLinear( texture2D( map, q / v2Kind.y ) ).rgb;
				float de = min( v2Inner.x - abs( P.x ), v2Inner.y - abs( P.z ) );
				col *= mix( 0.80, 1.0, smoothstep( 0.0, 0.42, de ) );
			} else {
				col = v2Cap( P, N );
			}
		}
		diffuseColor.rgb *= col;
	}
`;
const FRAG_ROUGH = `#include <roughnessmap_fragment>
	roughnessFactor = clamp( roughnessFactor * v2RoughK, 0.04, 1.0 );`;

/* ★ 함수 하나 — customProgramCacheKey 가 이 글자로 프로그램을 묶는다 */
const onBC = function (shader) {
  const u = _uni.get(this);
  if (!u) return;
  Object.assign(shader.uniforms, u);
  shader.vertexShader = VERT_HEAD + shader.vertexShader.replace('#include <fog_vertex>', VERT_TAIL);
  shader.fragmentShader = FRAG_HEAD + shader.fragmentShader
    .replace('#include <map_fragment>', FRAG_MAP)
    .replace('#include <roughnessmap_fragment>', FRAG_ROUGH);
};

const _patched = new WeakSet();
function linColor(hex) { const c = new THREE.Color(hex); c.convertSRGBToLinear(); return c; }

function patch(m, map, rough, uni, tint) {
  if (!m || !m.isMeshStandardMaterial || _patched.has(m)) return false;
  if (m.transparent && m.opacity < 0.95) return false;
  m.map = map;
  m.roughness = rough;
  m.metalness = 0;
  /* 색은 흰(또는 살짝 올린) 바탕 — 무늬가 색을 낸다. dimRoomMaterials 가 이 바탕에서 다시 누르도록
     기억해 둔 옛 바탕색을 지운다(두 번 눌리지 않게 대입식이다) */
  m.color.setRGB(...(tint || [1, 1, 1]));
  delete m.userData.__rvBaseColor;
  m.extensions = Object.assign({}, m.extensions, { derivatives: true });
  _uni.set(m, uni);
  m.onBeforeCompile = onBC;
  m.needsUpdate = true;
  _patched.add(m);
  return true;
}

/* 벽 무리에서 «벽 본체 재질»을 고른다 — 문·유리는 빼고 가장 많이 쓰인 것 */
function wallMaterialOf(sh) {
  const count = new Map();
  for (const o of sh.children) {
    if (!o.isMesh || o.userData.isStub || o.userData.isDoor) continue;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (!m || (m.transparent && m.opacity < 0.95)) continue;
    count.set(m, (count.get(m) || 0) + 1);
  }
  let best = null, n = 0;
  for (const [m, k] of count) if (k > n) { best = m; n = k; }
  return best;
}

const _frames = new Map();
function paintedFrame(src, hex, tint = 1) {
  const key = src.uuid + hex + tint;
  if (_frames.has(key)) return _frames.get(key);
  const m = src.clone();
  m.color = new THREE.Color(hex).multiplyScalar(tint);
  m.roughness = 0.48; m.metalness = 0;
  m.userData = { v2Frame: true };
  _frames.set(key, m);
  return m;
}

/* ============================================================
   applyRoomMaterials(built, roomId) — room_view.assemble 에서 dimRoomMaterials 바로 앞에 부른다.
   같은 built 를 두 번 받아도 한 번만 칠한다. 반환: 칠한 재질 수(끄면 0)
============================================================ */
export function applyRoomMaterials(built, roomId) {
  if (!built || !built.shells || typeof THREE === 'undefined' || typeof document === 'undefined') return 0;
  if (!v2Flag('v2mat')) return 0;
  const st = STYLES[roomId];
  if (!st) return 0;
  const t0 = (typeof performance !== 'undefined') ? performance.now() : 0;
  const T = shared(st);
  const size = built.size || { w: 5, d: 4, h: 2.3 };
  let WT = 0.2;
  const cap = linColor(st.capHex), wood = linColor(st.woodHex);
  let n = 0;
  const bb = new THREE.Box3();

  for (const wall of ['back', 'front', 'left', 'right']) {
    const sh = built.shells[wall];
    if (!sh || !sh.userData || !sh.userData.normal) continue;
    const out = sh.userData.normal;                              // 바깥 법선
    const uAx = [-out[2], 0, out[0]];                            // 안에서 벽을 볼 때 오른쪽 = 바깥법선 × 위
    const wm = wallMaterialOf(sh);
    if (!wm) continue;
    const panel = sh.children.find(o => o.isMesh && o.material === wm && o.geometry && o.geometry.parameters);
    if (panel) {
      const pr = panel.geometry.parameters;
      WT = (out[2] !== 0 ? pr.depth : pr.width) || WT;
    }
    bb.setFromObject(sh);
    const us = [bb.min.x * uAx[0] + bb.min.z * uAx[2], bb.max.x * uAx[0] + bb.max.z * uAx[2]];
    const u0 = Math.min(...us), u1 = Math.max(...us);
    const len = (out[2] !== 0) ? size.w : size.d;
    const inner = len / 2 - WT / 2;
    const rect = [u0, u1, 0, size.h];
    const stains = (st.stains || []).filter(s => {
      /* 이 벽 평면 위에 적힌 얼룩만 */
      const c = sh.userData.center;
      const dn = (s.at[0] - c[0]) * out[0] + (s.at[2] - c[2]) * out[2];
      return Math.abs(dn) < 0.02;                                // 얼룩은 벽 평면 위 좌표로 적는다
    });
    const key = `${roomId}:${wall}:${size.w}x${size.d}x${size.h}`;
    const uni = {
      v2Grime: { value: wallGrime(key, rect, uAx, stains) },
      v2Noise: { value: T.noise },
      v2Kind: { value: new THREE.Vector4(1, st.wall.tileM, st.wall.baseH, st.wall.grime) },
      v2In: { value: new THREE.Vector3(-out[0], -out[1], -out[2]) },
      v2UAx: { value: new THREE.Vector3(uAx[0], 0, uAx[2]) },
      v2Rect: { value: new THREE.Vector4(...rect) },
      v2Inner: { value: new THREE.Vector4(-inner, inner, size.h, 0) },
      v2CapC: { value: cap },
      v2WoodC: { value: wood },
    };
    if (patch(wm, T.wall, st.wall.rough, uni, st.wall.tint)) n++;
    /* 밑동(컷어웨이 10cm)은 빌드 때 복제된 재질이다 — 같은 값으로 따로 칠한다 */
    const stubs = (sh.userData.stub && sh.userData.stub.list) || [];
    for (const s of stubs) {
      const m = Array.isArray(s.material) ? s.material[0] : s.material;
      if (patch(m, T.wall, st.wall.rough, uni, st.wall.tint)) n++;
    }
  }

  const hx = size.w / 2 - WT / 2, hz = size.d / 2 - WT / 2;
  const slab = (sh, kind, map, tileM, rough, grimeTex, grime, tint) => {
    if (!sh) return;
    const uni = {
      v2Grime: { value: grimeTex || T.noise },
      v2Noise: { value: T.noise },
      v2Kind: { value: new THREE.Vector4(kind, tileM, 0, grime) },
      v2In: { value: new THREE.Vector3(0, kind === 2 ? 1 : -1, 0) },
      v2UAx: { value: new THREE.Vector3(1, 0, 0) },
      v2Rect: { value: new THREE.Vector4(-size.w / 2, size.w / 2, -size.d / 2, size.d / 2) },
      v2Inner: { value: new THREE.Vector4(hx, hz, size.h, 0) },
      v2CapC: { value: cap },
      v2WoodC: { value: wood },
    };
    const seen = new Set();
    sh.traverse(o => {
      if (!o.isMesh) return;
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      if (!m || seen.has(m)) return;
      seen.add(m);
      if (patch(m, map, rough, uni, tint)) n++;
    });
  };
  const fKey = `${roomId}:floor:${size.w}x${size.d}`;
  slab(built.shells.floor, 2, T.lino, st.floor.tileM, st.floor.rough,
       floorGrime(fKey, [-size.w / 2, size.w / 2, -size.d / 2, size.d / 2], st.floorMarks || {}), st.floor.grime, st.floor.tint);
  slab(built.shells.ceiling, 3, T.conc, st.ceil.tileM, st.ceil.rough, null, 0, st.ceil.tint);

  /* 창틀 — 흰 페인트. 캐시된 공용 재질은 방끼리 나눠 쓰므로 복제본으로 바꿔 낀다 */
  for (const k in (built.trims || {})) {
    built.trims[k].traverse(o => {
      if (!o.isMesh || !o.material || Array.isArray(o.material)) return;
      const m = o.material;
      if (m.transparent || m.userData.v2Frame || !m.isMeshStandardMaterial) return;
      o.material = paintedFrame(m, st.frameHex, st.frameTint || 1);
      n++;
    });
  }
  const g = (typeof window !== 'undefined') ? window : null;
  if (g && g.__v2) g.__v2.matInfo = { room: roomId, patched: n,
    ms: t0 ? +((performance.now() - t0).toFixed(1)) : null };
  return n;
}

/* 재는 도구용 — 캐시된 텍스처를 들여다본다(그림을 바꾸지 않는다) */
export function _v2matDebug() { return { tex: _tex, grime: _grime, frames: _frames }; }
