/* ============================================================
   render3d/atmosphere.js — v2 보이는 층: 창빛 기둥 · 떠도는 먼지 · 등 달무리
   ------------------------------------------------------------
   반지하 가로창으로 드는 아침 볕을 «보이게» 한다. 아트 기준(style_keyframe_a)의
   높은 창 빛 · 빛 속 먼지 · 켜진 등 둘레의 따뜻한 번짐이 그것이다.

   ★ 그림뿐이다. 조도(DLI)·그림자 정책·배치·레이캐스트에 한 톨도 안 닿는다.
     · 씬에 직접 붙는다 — built.room · houseGroup 밖이라 배치 광선이 안 쏜다
     · layers 1 만 쓴다 + raycast 비움 + castShadow false (세 겹)
     · 새 광원 없음. 가산 합성 · 깊이 안 씀 · 안개 안 받음
     · THREE.Points 를 안 쓴다(test_roomview_walk 가 isPoints 를 센다) — 먼지는 사각 판 묶음

   ★ 창빛 기둥은 «해 그림자맵»을 따라 걷는다(sunLight.shadow.map).
     그래서 창살 · 벽 두께 · 창턱 선반이 가리는 자리가 바닥의 볕 자국과 똑같이 빠진다.
     그림자맵이 없으면(setShadowBudget('none')) 창 개구부와 벽 두께로 어림한다.

   ★ 시간은 room_view loop 가 «이미 그리는» 프레임에만 흐른다(tick). 스스로 프레임을 안 깨운다.
     redraw() 는 tick 을 안 부른다 — 재는 자가 연달아 찍어도 같은 그림이다.

   끄기: ?v2=0 (v2 전체) · ?v2atm=0 · localStorage 'v2atm' = '0' (또는 'v2' = '0')
         실행 중: window.__v2.atm.set(false)
============================================================ */
import { daylight } from '../engine/daylight.js';
import { winFromHouse } from '../engine/daylight_lux.js';

const WT = 0.2;              // 벽 두께 — house.js 의 WT 와 같은 값(거기서 안 내보낸다)
const FT = 0.09;             // 창 바깥틀 — window_frame.js FRAME_DEFAULTS.FT
const MAX_SHAFTS = 2;        // 창 기둥은 큰 창 둘까지(반지하는 하나)
const DUST_N = 300;          // 먼지 수 — 판 하나에 4정점, 드로우콜 1
const MAX_HALO = 6;          // 달무리 자리 수(등 넷 + 여유)
const MARCH = 10;            // 기둥 한 화소가 그림자맵을 몇 번 보나
const LAYER = 1;             // 레이캐스터(기본 0층)가 안 보는 층

/* ── v2 스위치 — ?v2=0 은 전부 끈다, ?<key>=0 은 그것만 끈다. 기본은 켠다 ── */
export function v2Flag(key) {
  let q = null;
  try { q = new URLSearchParams(location.search); } catch (_) { /* 창이 없는 곳 */ }
  const ls = k => { try { return localStorage.getItem(k); } catch (_) { return null; } };
  const off = v => v === '0' || v === 'off' || v === 'false';
  if (off(q && q.get('v2')) || off(ls('v2'))) return false;
  const v = q && q.get(key);
  if (v != null) return !off(v);
  const l = ls(key);
  if (l != null) return !off(l);
  return true;
}
function v2Slot() {
  try { return (window.__v2 = window.__v2 || {}); } catch (_) { return {}; }
}

/* ── 결이 있는 잡음(128² · 이어 붙는다). R=굵은 결 · G=잔 결 · B=중간 ── */
let _noiseTex = null, _whiteTex = null;
function noiseTexture() {
  if (_noiseTex) return _noiseTex;
  const N = 128;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d');
  const img = g.createImageData(N, N);
  let s = 20260925;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const grid = n => { const a = new Float32Array(n * n); for (let i = 0; i < a.length; i++) a[i] = rnd(); return a; };
  const layer = (n) => {
    const a = grid(n);
    return (x, y) => {                       // 이어 붙는 값 잡음(부드러운 보간)
      const fx = x / N * n, fy = y / N * n;
      const x0 = Math.floor(fx), y0 = Math.floor(fy);
      const tx = fx - x0, ty = fy - y0;
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const at = (i, j) => a[((j % n + n) % n) * n + ((i % n + n) % n)];
      const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx;
      const bot = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx;
      return top + (bot - top) * sy;
    };
  };
  const L1 = layer(6), L2 = layer(12), L3 = layer(24), L4 = layer(48);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = (y * N + x) * 4;
    const r = L1(x, y) * 0.65 + L2(x, y) * 0.35;
    const gg = L3(x, y) * 0.6 + L4(x, y) * 0.4;
    const b = L2(x, y) * 0.5 + L3(x, y) * 0.5;
    img.data[i] = Math.round(r * 255); img.data[i + 1] = Math.round(gg * 255);
    img.data[i + 2] = Math.round(b * 255); img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  _noiseTex = t;
  return t;
}
function whiteTexture() {           // 그림자맵 자리 채움(쓰지 않을 때도 표본기가 비면 안 된다)
  if (_whiteTex) return _whiteTex;
  _whiteTex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, THREE.RGBAFormat);
  _whiteTex.needsUpdate = true;
  return _whiteTex;
}

/* ── 셰이더 ─────────────────────────────────────────────────── */
const SLAB_GLSL = /* glsl */`
void slab(float o, float d, float lo, float hi, inout float tn, inout float tf) {
  if (abs(d) < 1e-6) { if (o < lo || o > hi) { tn = 1e9; tf = -1e9; } return; }
  float a = (lo - o) / d, b = (hi - o) / d;
  tn = max(tn, min(a, b)); tf = min(tf, max(a, b));
}`;
const SHAFT_VS = /* glsl */`
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const SHAFT_FS = /* glsl */`
#include <packing>
uniform mat4 uW2L;          // 월드 → 창 좌표 (u 벽따라, v 위로, s 빛길이)
uniform vec4 uAp;           // 기둥 틀(창 좌표) — 그림자맵이 있을 때
uniform vec4 uApLit;        // 벽 두께·창틀을 뺀 어림 — 그림자맵이 없을 때
uniform float uSMax;
uniform vec3 uRoomMin, uRoomMax;
uniform vec3 uColor;
uniform float uStrength, uTime, uGate, uUseShadow, uDecay, uDensity;
uniform vec2 uSoft;         // 가장자리 번짐 (u 벽따라, v 위아래) [m]
uniform sampler2D uNoise, uShadowMap;
uniform mat4 uShadowMatrix;
varying vec3 vWorld;
${SLAB_GLSL}
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
void main() {
  if (uGate < 0.5) discard;
  vec3 ro = cameraPosition;
  vec3 rd = normalize(vWorld - ro);
  vec3 lo = (uW2L * vec4(ro, 1.0)).xyz;
  vec3 ld = (uW2L * vec4(rd, 0.0)).xyz;
  vec4 ap = mix(uApLit, uAp, uUseShadow);
  float tn = 0.0, tf = 1e9;
  slab(lo.x, ld.x, ap.x, ap.y, tn, tf);
  slab(lo.y, ld.y, ap.z, ap.w, tn, tf);
  slab(lo.z, ld.z, 0.0, uSMax, tn, tf);
  slab(ro.x, rd.x, uRoomMin.x, uRoomMax.x, tn, tf);
  slab(ro.y, rd.y, uRoomMin.y, uRoomMax.y, tn, tf);
  slab(ro.z, rd.z, uRoomMin.z, uRoomMax.z, tn, tf);
  if (tf <= tn) discard;
  vec4 so = uShadowMatrix * vec4(ro, 1.0);
  vec4 sd = uShadowMatrix * vec4(rd, 0.0);
  float dt = (tf - tn) / float(MARCH);
  float jit = ign(gl_FragCoord.xy);
  /* 결은 광선 가운데서 한 번만 짚는다 — 얇은 빛판이라 광선 안에서 (u,v) 가 거의 안 변한다(폰 몫 절약) */
  vec3 pm = lo + ld * (0.5 * (tn + tf));
  vec4 n = texture2D(uNoise, vec2(pm.x * 0.42 + uTime * 0.010, pm.y * 0.55 - uTime * 0.004));
  float streak = 0.12 + 1.7 * smoothstep(0.28, 0.78, n.r * 0.72 + n.g * 0.28);
  float acc = 0.0;
  for (int i = 0; i < MARCH; i++) {
    float t = tn + (float(i) + jit) * dt;
    vec3 p = lo + ld * t;
    /* 얇고 넓은 빛판이라 u 끝을 넓게 번지게 한다 — 안 그러면 유리판처럼 딱 잘린다 */
    float m = smoothstep(0.0, uSoft.x, p.x - ap.x) * smoothstep(0.0, uSoft.x, ap.y - p.x)
            * smoothstep(0.0, uSoft.y, p.y - ap.z) * smoothstep(0.0, uSoft.y, ap.w - p.y);
    float vis = 1.0;
    if (uUseShadow > 0.5) {
      vec4 sc = so + sd * t;
      vec3 c = sc.xyz / sc.w;
      float inb = step(0.0, c.x) * step(c.x, 1.0) * step(0.0, c.y) * step(c.y, 1.0);
      vis = inb * step(c.z - 0.0015, unpackRGBAToDepth(texture2D(uShadowMap, c.xy)));
    }
    float fall = exp(-p.z * uDecay) * smoothstep(0.0, 0.06, p.z);
    acc += m * vis * fall;
  }
  /* 결: 창 좌표(u,v)로 짚으므로 빛 방향으로는 한결같다 — 그게 «빛살» 줄무늬다 */
  acc *= dt * streak;
  float a = 1.0 - exp(-acc * uDensity);
  float breathe = 0.93 + 0.07 * sin(uTime * 0.37);
  gl_FragColor = vec4(uColor * (a * uStrength * uGate * breathe), 1.0);
}`;

const DUST_VS = /* glsl */`
attribute vec2 corner;
attribute float seed;
uniform vec3 uBoxMin, uBoxSize;
uniform float uTime, uSize, uMinPx, uPxWorld, uSMax, uGate;
uniform mat4 uW2L;
uniform vec4 uAp;
varying vec2 vCorner;
varying float vA;
varying vec3 vCenter;
void main() {
  float t = uTime;
  vec3 drift = vec3(
    sin(t * (0.11 + 0.07 * seed) + seed * 31.0) * 0.05 + t * 0.006 * (seed - 0.5),
    sin(t * (0.07 + 0.05 * seed) + seed * 17.0) * 0.04 - t * (0.004 + 0.006 * seed),
    cos(t * (0.09 + 0.06 * seed) + seed * 23.0) * 0.05);
  vec3 q = fract(position + drift / max(uBoxSize, vec3(0.05)));
  vec3 w = uBoxMin + q * uBoxSize;
  vec3 e3 = min(q, 1.0 - q);
  float edge = smoothstep(0.0, 0.08, e3.x) * smoothstep(0.0, 0.08, e3.y) * smoothstep(0.0, 0.08, e3.z);
  vec3 p = (uW2L * vec4(w, 1.0)).xyz;
  float s = 0.05;
  float m = smoothstep(0.0, s, p.x - uAp.x) * smoothstep(0.0, s, uAp.y - p.x)
          * smoothstep(0.0, s, p.y - uAp.z) * smoothstep(0.0, s, uAp.w - p.y)
          * step(0.0, p.z) * step(p.z, uSMax);
  float tw = 0.55 + 0.45 * sin(t * (0.9 + 1.3 * seed) + seed * 57.0);
  vA = m * edge * tw * exp(-p.z * 0.22);
  vCenter = w;
  vCorner = corner;
  if (vA < 0.004 || uGate < 0.5) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  vec4 mv = viewMatrix * vec4(w, 1.0);
  float sz = max(uSize * (0.6 + 0.8 * fract(seed * 7.13)), uMinPx * (-mv.z) * uPxWorld);
  mv.xy += corner * sz;
  gl_Position = projectionMatrix * mv;
}`;
const DUST_FS = /* glsl */`
#include <packing>
uniform vec3 uColor;
uniform float uStrength, uGate, uUseShadow;
uniform sampler2D uShadowMap;
uniform mat4 uShadowMatrix;
varying vec2 vCorner;
varying float vA;
varying vec3 vCenter;
void main() {
  float r2 = dot(vCorner, vCorner);
  if (r2 > 1.0) discard;
  float f = 1.0 - r2; f *= f;
  float vis = 1.0;
  if (uUseShadow > 0.5) {
    vec4 sc = uShadowMatrix * vec4(vCenter, 1.0);
    vec3 c = sc.xyz / sc.w;
    float inb = step(0.0, c.x) * step(c.x, 1.0) * step(0.0, c.y) * step(c.y, 1.0);
    vis = inb * step(c.z - 0.0015, unpackRGBAToDepth(texture2D(uShadowMap, c.xy)));
  }
  gl_FragColor = vec4(uColor * (f * vA * vis * uStrength * uGate), 1.0);
}`;

const HALO_VS = /* glsl */`
attribute vec2 corner;
attribute float hid;
uniform vec4 uHalo[${MAX_HALO}];
uniform vec4 uHaloCol[${MAX_HALO}];
uniform float uGate;
varying vec2 vCorner;
varying vec4 vCol;
void main() {
  int i = int(hid + 0.5);
  vec4 h = uHalo[i];
  vec4 c = uHaloCol[i];
  vCorner = corner; vCol = c;
  if (c.a <= 0.001 || uGate < 0.5) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  vec3 toCam = normalize(cameraPosition - h.xyz);
  vec4 mv = viewMatrix * vec4(h.xyz + toCam * h.w * 0.5, 1.0);   // 갓에 안 먹히게 조금 앞으로
  mv.xy += corner * h.w;
  gl_Position = projectionMatrix * mv;
}`;
const HALO_FS = /* glsl */`
uniform float uGate, uTime;
varying vec2 vCorner;
varying vec4 vCol;
void main() {
  float r2 = dot(vCorner, vCorner);
  if (r2 > 1.0) discard;
  float g = exp(-r2 * 3.2) * 0.62 + exp(-r2 * 22.0) * 0.35;
  g *= 1.0 - smoothstep(0.55, 1.0, r2);
  float flick = 0.97 + 0.03 * sin(uTime * 2.3 + vCol.r * 11.0);
  gl_FragColor = vec4(vCol.rgb * (g * vCol.a * uGate * flick), 1.0);
}`;

/* ── 공통: 그림 전용 표시(층 · 광선 · 그림자) ── */
function renderOnly(o, name) {
  o.name = name;
  o.userData.v2 = 'atmosphere';
  o.userData.renderOnly = true;
  o.layers.set(LAYER);
  o.raycast = () => {};
  o.castShadow = false; o.receiveShadow = false;
  o.frustumCulled = false;
  return o;
}
function addMat(uniforms, vs, fs, defines) {
  return new THREE.ShaderMaterial({
    uniforms, vertexShader: vs, fragmentShader: fs, defines: defines || {},
    transparent: true, depthWrite: false, depthTest: true,
    blending: THREE.AdditiveBlending, fog: false, lights: false
  });
}

/* ============================================================
   attachAtmosphere(ctx, built, opt) → handle | null
     opt.requestRender()  다음 프레임을 한 장 그려 달라(켜고 끌 때만)
     opt.suppress()       true 면 그리지 않는다(빛 분포 히트맵 — 정보 색을 안 덮는다)
   handle: update(dayT) · tick(nowMs) · setEnabled(on) · info() · dispose()
============================================================ */
export function attachAtmosphere(ctx, built, opt = {}) {
  const slot = v2Slot();
  if (!v2Flag('v2atm')) { slot.atm = { on: false, reason: 'flag' }; return null; }
  if (typeof document === 'undefined' || typeof THREE === 'undefined' || !ctx || !ctx.scene || !built || !built.size)
    return null;
  try {
    const h = build(ctx, built, opt);
    slot.atm = h;
    return h;
  } catch (e) {
    console.warn('[v2 atmosphere] 못 지었습니다 — 없이 갑니다:', e && e.message);
    return null;
  }
}

function build(ctx, built, opt) {
  const T = THREE;
  const size = built.size;
  const group = renderOnly(new T.Group(), '__v2_atmosphere');
  ctx.cam.layers.enable(LAYER);                      // 카메라는 1층도 본다(레이캐스터는 안 본다)

  const roomMin = new T.Vector3(-size.w / 2 + WT / 2, 0.0, -size.d / 2 + WT / 2);
  const roomMax = new T.Vector3(size.w / 2 - WT / 2, size.h, size.d / 2 - WT / 2);
  const shared = { uTime: { value: 0 }, uGate: { value: 1 } };
  const suppressed = () => { try { return !!(opt.suppress && opt.suppress()); } catch (_) { return false; } };
  const gate = () => { shared.uGate.value = suppressed() ? 0 : 1; };

  /* 해 그림자맵 — 그림자맵은 해가 움직일 때만 다시 구워진다. 그 행렬도 그때 같이 바뀐다 */
  const shadowMap = { value: whiteTexture() };
  const shadowMatrix = { value: ctx.sunLight.shadow.matrix };
  const useShadow = { value: 0 };
  const syncShadow = () => {
    const sh = ctx.sunLight.shadow;
    const ok = !!(ctx.sunLight.castShadow && sh && sh.map && sh.map.texture);
    shadowMap.value = ok ? sh.map.texture : whiteTexture();
    shadowMatrix.value = sh.matrix;
    useShadow.value = ok ? 1 : 0;
  };

  /* ── ① 창빛 기둥 ─────────────────────────────────────────── */
  const wins = ((built.luxWins || []).filter(w => w.from === 'window' &&
                 ['back', 'front', 'left', 'right'].includes(w.wall) && w.w > 0.1 && w.h > 0.1 && w.w * w.h < 8))
    .sort((a, b) => b.w * b.h - a.w * a.h).slice(0, MAX_SHAFTS);
  const unitBox = new T.BoxGeometry(1, 1, 1);
  unitBox.translate(0.5, 0.5, 0.5);
  const shafts = wins.map((w, k) => {
    const wf = winFromHouse(w.wall, w.cu, w.cy, w.w, w.h, size);
    const U = new T.Vector3(wf.ux || 0, 0, wf.uz || 0).normalize();
    const N = new T.Vector3(wf.nx || 0, 0, wf.nz || 0).normalize();
    const O = new T.Vector3(wf.cx, wf.cy, wf.cz).addScaledVector(N, WT / 2);   // 안쪽 벽면 창 한가운데
    const uni = {
      uW2L: { value: new T.Matrix4() },
      uAp: { value: new T.Vector4() }, uApLit: { value: new T.Vector4() },
      uSMax: { value: 1 },
      uRoomMin: { value: roomMin }, uRoomMax: { value: roomMax },
      uColor: { value: new T.Color(1, 0.9, 0.7) },
      uStrength: { value: 0 }, uDecay: { value: 0.45 }, uDensity: { value: 2.2 },
      uSoft: { value: new T.Vector2(0.3, 0.05) },
      uTime: shared.uTime, uGate: shared.uGate, uUseShadow: useShadow,
      uNoise: { value: noiseTexture() }, uShadowMap: shadowMap, uShadowMatrix: shadowMatrix
    };
    const mat = addMat(uni, SHAFT_VS, SHAFT_FS, { MARCH });
    const mesh = renderOnly(new T.Mesh(unitBox, mat), '__v2_shaft' + k);
    mesh.matrixAutoUpdate = false;
    mesh.renderOrder = 2;
    mesh.visible = false;
    mesh.onBeforeRender = gate;
    group.add(mesh);
    return { w, U, N, O, hw: wf.width / 2, hh: wf.height / 2, mesh, uni, on: false,
             depthIn: Math.abs(N.z) > 0.5 ? size.d - WT : size.w - WT };
  });

  /* ── ② 먼지 — 제일 큰 창 기둥 둘레 상자 안에서 떠돈다 ───────── */
  let dust = null;
  if (shafts.length) {
    const pos = new Float32Array(DUST_N * 12), cor = new Float32Array(DUST_N * 8), sd = new Float32Array(DUST_N * 4);
    const idx = new Uint16Array(DUST_N * 6);
    let s = 7;
    const rnd = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
    const C = [-1, -1, 1, -1, 1, 1, -1, 1];
    for (let i = 0; i < DUST_N; i++) {
      const x = rnd(), y = rnd(), z = rnd(), e = rnd();
      for (let c = 0; c < 4; c++) {
        pos.set([x, y, z], (i * 4 + c) * 3);
        cor.set([C[c * 2], C[c * 2 + 1]], (i * 4 + c) * 2);
        sd[i * 4 + c] = e;
      }
      idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    geo.setAttribute('corner', new T.BufferAttribute(cor, 2));
    geo.setAttribute('seed', new T.BufferAttribute(sd, 1));
    geo.setIndex(new T.BufferAttribute(idx, 1));
    const sh0 = shafts[0];
    const uni = {
      uBoxMin: { value: new T.Vector3() }, uBoxSize: { value: new T.Vector3(1, 1, 1) },
      uTime: shared.uTime, uGate: shared.uGate,
      uSize: { value: 0.013 }, uMinPx: { value: 2.6 }, uPxWorld: { value: 0.002 },
      uW2L: sh0.uni.uW2L, uAp: sh0.uni.uApLit, uSMax: sh0.uni.uSMax,
      uColor: { value: new T.Color(1, 0.93, 0.8) }, uStrength: { value: 0 },
      uUseShadow: useShadow, uShadowMap: shadowMap, uShadowMatrix: shadowMatrix
    };
    const mesh = renderOnly(new T.Mesh(geo, addMat(uni, DUST_VS, DUST_FS)), '__v2_dust');
    mesh.renderOrder = 3;
    mesh.visible = false;
    mesh.onBeforeRender = gate;
    group.add(mesh);
    dust = { mesh, uni, geo };
  }

  /* ── ③ 등 달무리 — 켜진 등 갓 둘레. 등 논리는 안 건드리고 켜짐만 읽는다 ── */
  const haloGeo = new T.BufferGeometry();
  {
    const pos = new Float32Array(MAX_HALO * 12), cor = new Float32Array(MAX_HALO * 8), hid = new Float32Array(MAX_HALO * 4);
    const idx = new Uint16Array(MAX_HALO * 6);
    const C = [-1, -1, 1, -1, 1, 1, -1, 1];
    for (let i = 0; i < MAX_HALO; i++) {
      for (let c = 0; c < 4; c++) { cor.set([C[c * 2], C[c * 2 + 1]], (i * 4 + c) * 2); hid[i * 4 + c] = i; }
      idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
    }
    haloGeo.setAttribute('position', new T.BufferAttribute(pos, 3));
    haloGeo.setAttribute('corner', new T.BufferAttribute(cor, 2));
    haloGeo.setAttribute('hid', new T.BufferAttribute(hid, 1));
    haloGeo.setIndex(new T.BufferAttribute(idx, 1));
  }
  const haloUni = {
    uHalo: { value: Array.from({ length: MAX_HALO }, () => new T.Vector4()) },
    uHaloCol: { value: Array.from({ length: MAX_HALO }, () => new T.Vector4()) },
    uGate: shared.uGate, uTime: shared.uTime
  };
  const halo = renderOnly(new T.Mesh(haloGeo, addMat(haloUni, HALO_VS, HALO_FS)), '__v2_halo');
  halo.renderOrder = 4;
  halo.visible = false;
  halo.onBeforeRender = gate;
  group.add(halo);

  ctx.scene.add(group);

  /* ── 갱신 ────────────────────────────────────────────────── */
  let enabled = true, alive = true;
  let sunOn = false;
  const L = new T.Vector3(), tmp = new T.Vector3(), tmp2 = new T.Vector3();
  const rowU = new T.Vector3(), rowV = new T.Vector3(), rowS = new T.Vector3();
  const box = new T.Box3(), bsz = new T.Vector3(), bctr = new T.Vector3();
  const warmTint = new T.Color(1.0, 0.80, 0.52);
  const dustTint = new T.Color(1.0, 0.86, 0.64);
  const lampWarm = new T.Color(1.0, 0.74, 0.42);
  const colTmp = new T.Color();
  const Y = new T.Vector3(0, 1, 0);
  const dustMin = new T.Vector3(), dustMax = new T.Vector3();

  function placeShaft(sh, strength) {
    const N = sh.N, U = sh.U, O = sh.O;
    const LN = L.dot(N);
    if (!(strength > 0.002) || LN < 0.06 || L.y > -0.02) { sh.on = false; return; }
    const LU = L.dot(U), LY = L.y;
    /* 월드 → 창 좌표. X = O + U u + Y v + L s */
    rowU.copy(U).addScaledVector(N, -LU / LN);
    rowV.copy(Y).addScaledVector(N, -LY / LN);
    rowS.copy(N).multiplyScalar(1 / LN);
    sh.uni.uW2L.value.set(
      rowU.x, rowU.y, rowU.z, -rowU.dot(O),
      rowV.x, rowV.y, rowV.z, -rowV.dot(O),
      rowS.x, rowS.y, rowS.z, -rowS.dot(O),
      0, 0, 0, 1);
    /* 벽 두께(바깥 면)와 창틀(가운데)이 가리는 몫을 안쪽 면 좌표로 옮겨 뺀다 */
    const du = LU * WT / LN, dv = LY * WT / LN;
    const hw = sh.hw, hh = sh.hh;
    let u0 = -hw + Math.max(0, du), u1 = hw + Math.min(0, du);
    let v0 = -hh + Math.max(0, dv), v1 = hh + Math.min(0, dv);
    u0 = Math.max(u0, -hw + FT + du / 2); u1 = Math.min(u1, hw - FT + du / 2);
    v0 = Math.max(v0, -hh + FT + dv / 2); v1 = Math.min(v1, hh - FT + dv / 2);
    if (u1 - u0 < 0.02 || v1 - v0 < 0.01) { sh.on = false; return; }
    sh.uni.uApLit.value.set(u0, u1, v0, v1);
    const pad = 0.04;                       // 그림자맵이 진짜 가장자리를 낸다 — 틀은 넉넉히
    const a0 = Math.max(-hw, u0 - pad), a1 = Math.min(hw, u1 + pad);
    const b0 = Math.max(-hh, v0 - pad), b1 = Math.min(hh, v1 + pad);
    sh.uni.uAp.value.set(a0, a1, b0, b1);
    sh.uni.uSoft.value.set(Math.min(0.45, 0.28 * (u1 - u0)), Math.min(0.06, 0.35 * (v1 - v0)));
    const yTop = O.y + b1;
    const sFloor = yTop / (-LY);
    const sWall = sh.depthIn / LN;
    const sMax = Math.min(sFloor, sWall, 9) + 0.05;
    sh.uni.uSMax.value = sMax;
    /* 단위 상자 → 기울어진 기둥 */
    const du_ = a1 - a0, dv_ = b1 - b0;
    tmp.copy(O).addScaledVector(U, a0).addScaledVector(Y, b0);
    sh.mesh.matrix.set(
      U.x * du_, Y.x * dv_, L.x * sMax, tmp.x,
      U.y * du_, Y.y * dv_, L.y * sMax, tmp.y,
      U.z * du_, Y.z * dv_, L.z * sMax, tmp.z,
      0, 0, 0, 1);
    sh.mesh.matrixWorldNeedsUpdate = true;
    /* 한낮엔 벽 두께가 창 위쪽을 가려 빛판이 얇아진다(0.11m) — 얇은 만큼 조금 돋운다 */
    sh.uni.uStrength.value = strength * Math.min(1.8, Math.max(1, Math.sqrt(0.28 / Math.max(0.05, v1 - v0))));
    sh.on = true;
  }

  function placeDust(strength) {
    if (!dust) return;
    const sh = shafts[0];
    if (!sh.on) { dust.on = false; return; }
    /* 기둥(창 어림 틀 × 빛길이)의 여덟 꼭짓점을 방 안으로 잘라 상자를 잡는다 */
    const ap = sh.uni.uApLit.value, sMax = sh.uni.uSMax.value;
    dustMin.set(1e9, 1e9, 1e9); dustMax.set(-1e9, -1e9, -1e9);
    for (let i = 0; i < 8; i++) {
      const u = (i & 1) ? ap.y : ap.x, v = (i & 2) ? ap.w : ap.z, s = (i & 4) ? sMax : 0;
      tmp.copy(sh.O).addScaledVector(sh.U, u).addScaledVector(Y, v).addScaledVector(L, s);
      tmp.clamp(roomMin, roomMax);
      dustMin.min(tmp); dustMax.max(tmp);
    }
    dustMin.y = Math.max(dustMin.y, 0.05);
    tmp2.copy(dustMax).sub(dustMin);
    if (tmp2.x < 0.05 || tmp2.y < 0.05 || tmp2.z < 0.05) { dust.on = false; return; }
    dust.uni.uBoxMin.value.copy(dustMin);
    dust.uni.uBoxSize.value.copy(tmp2);
    dust.uni.uStrength.value = strength;
    dust.on = true;
  }

  function visibleChain(o) {
    for (let p = o; p; p = p.parent) if (!p.visible) return false;
    return true;
  }
  let haloN = 0;
  function placeHalos() {
    const rigs = (built.lightRigs || []);
    const H = haloUni.uHalo.value, HC = haloUni.uHaloCol.value;
    let n = 0;
    const seen = [];
    const put = (obj, color, amp) => {
      if (n >= MAX_HALO || !obj) return;
      box.makeEmpty();
      box.setFromObject(obj);
      if (box.isEmpty()) return;
      box.getCenter(bctr); box.getSize(bsz);
      const r = Math.min(0.7, Math.max(0.2, Math.max(bsz.x, bsz.y, bsz.z) * 1.15));
      H[n].set(bctr.x, bctr.y, bctr.z, r);
      HC[n].set(color.r, color.g, color.b, amp);
      n++;
    };
    for (const r of rigs) {
      if (!r || !r.light || !r.shade) continue;
      seen.push(r.shade);
      if (!(r.light.intensity > 0) || !visibleChain(r.shade)) continue;
      if (r.grow) colTmp.copy(r.light.color).lerp(lampWarm, 0.35); else colTmp.copy(lampWarm);
      put(r.shade, colTmp, r.grow ? 0.30 : 0.45);
    }
    /* 천장등 갓(등 기구가 아닌 것) — scene 의 천장 전구가 켜져 있을 때만 */
    const cs = ctx.clShade;
    if (cs && !seen.includes(cs) && ctx.ceilingBulb && ctx.ceilingBulb.intensity > 0 && visibleChain(cs))
      put(cs, lampWarm, 0.45);
    for (let i = n; i < MAX_HALO; i++) HC[i].w = 0;
    haloN = n;
  }

  function camSide() {
    const cp = ctx.cam.position;
    for (const sh of shafts) {
      if (!sh.on) continue;
      tmp.copy(cp).applyMatrix4(sh.uni.uW2L.value);
      const ap = sh.uni.uAp.value;
      const inside = tmp.x > ap.x && tmp.x < ap.y && tmp.y > ap.z && tmp.y < ap.w && tmp.z > 0 && tmp.z < sh.uni.uSMax.value;
      const side = inside ? T.BackSide : T.FrontSide;
      if (sh.mesh.material.side !== side) sh.mesh.material.side = side;
    }
    if (dust) {
      const hgt = (ctx.renderer.domElement && ctx.renderer.domElement.height) || 800;
      dust.uni.uPxWorld.value = 2 * Math.tan((ctx.cam.fov || 34) * Math.PI / 360) / Math.max(1, hgt);
    }
  }

  function applyVisibility() {
    /* 히트맵(suppress)은 여기서 안 본다 — onBeforeRender 의 uGate 가 redraw() 에서도 곧바로 막는다 */
    const show = enabled && alive;
    for (const sh of shafts) sh.mesh.visible = show && sunOn && sh.on;
    if (dust) dust.mesh.visible = show && sunOn && !!dust.on;
    halo.visible = show && haloN > 0;
  }

  const handle = {
    get on() { return enabled; },
    /* applyDaylight 끝에서 부른다 — 등 세기까지 정해진 뒤다. 매 rAF 불려도 새로 만드는 것이 없다 */
    update(dayT) {
      if (!alive) return;
      const s = daylight((+dayT || 0) * 100);
      L.copy(ctx.sunLight.position);
      const len = L.length();
      sunOn = !!(len > 1e-6 && ctx.sunLight.intensity > 0 && s.alt > 0.01);
      if (sunOn) {
        L.multiplyScalar(-1 / len);                  // 빛이 나아가는 쪽(방 안·아래로)
        const expo = Math.min(1.6, Math.max(0.6, (ctx.renderer.toneMappingExposure || 1.08) / 1.08));
        const k = smooth(0.02, 0.32, s.alt) * (1 + 0.35 * s.warm) * expo;
        colTmp.copy(ctx.sunLight.color);
        for (const sh of shafts) {
          sh.uni.uColor.value.copy(colTmp).multiply(warmTint);
          placeShaft(sh, 0.62 * k);
        }
        if (dust) { dust.uni.uColor.value.copy(colTmp).multiply(dustTint); placeDust(1.5 * k); }
      }
      syncShadow();
      placeHalos();
      camSide();
      applyVisibility();
    },
    /* loop 가 한 장 그리기 직전에만 부른다 — 시간이 흐르는 유일한 자리 */
    tick(now) {
      if (!alive || !enabled) return;
      shared.uTime.value = (now || 0) / 1000;
      if (haloN) placeHalos();                       // 등을 끄는 중이면 갓이 움직인다
      camSide();
      applyVisibility();
    },
    setEnabled(on) {
      enabled = !!on;
      applyVisibility();
      try { opt.requestRender && opt.requestRender(); } catch (_) { /* 그리기 부탁만 */ }
      return enabled;
    },
    set(on) { return handle.setEnabled(on); },
    info() {
      return {
        on: enabled, sun: sunOn, shadowMap: useShadow.value === 1,
        shafts: shafts.map(sh => ({ wall: sh.w.wall, on: sh.on, visible: sh.mesh.visible,
          ap: sh.uni.uApLit.value.toArray().map(v => +v.toFixed(3)), sMax: +sh.uni.uSMax.value.toFixed(3),
          strength: +sh.uni.uStrength.value.toFixed(3) })),
        dust: dust ? { n: DUST_N, visible: dust.mesh.visible } : null,
        halos: haloN, haloVisible: halo.visible, layer: LAYER
      };
    },
    dispose() {
      if (!alive) return;
      alive = false;
      if (group.parent) group.parent.remove(group);
      unitBox.dispose();
      for (const sh of shafts) sh.mesh.material.dispose();
      if (dust) { dust.geo.dispose(); dust.mesh.material.dispose(); }
      haloGeo.dispose(); halo.material.dispose();
      const sl = v2Slot();
      if (sl.atm === handle) sl.atm = { on: false, reason: 'disposed' };
    }
  };
  return handle;
}

function smooth(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
