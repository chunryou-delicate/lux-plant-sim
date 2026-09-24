/* ============================================================
   render3d/postfx.js — v2 후처리 (보이는 층만 · 2026-09-25)
   ------------------------------------------------------------
   방을 화면에 바로 그리던 것을 한 겹 거쳐 그린다.

     장면 → rt(8비트 · sRGB 로 적힌 값 = 화면에 바로 그린 것과 같은 값)
          → [AO · 데스크톱만] → [번짐 bloom · 작은 해상도]
          → 마감 한 장(FXAA + 번짐 더하기 + 따뜻한 색보정 + 비네트 + 떨림) → 화면

   ★ 톤매핑·노출 — r128 은 **재질 셰이더 안에서** ACES×노출을 한다. 렌더 타깃에
     그려도 한다(three.min.js: `toneMapping: r.toneMapped ? t.toneMapping : 0`).
     렌더 타깃에서 빠지는 것은 **sRGB 인코딩뿐**이다(`outputEncoding: 타깃 텍스처의 encoding`).
     ⇒ rt 텍스처의 encoding 을 sRGB 로 두어 재질이 스스로 인코딩하게 한다.
       · 밝기 슬라이더(toneMappingExposure = 0.72 × userBright)가 그대로 먹는다.
       · 셰이더 캐시 키가 화면에 그릴 때와 같아 **다시 컴파일하지 않는다**.
       · 배경 지우기 색·toneMapped:false 재질(빛 분포 판)도 화면에 그린 것과 같은 값이다.
       · 효과를 다 끄면(?v2fx=0 가 아니라 grade·bloom 만 0) 바로 그린 그림과 같다 — MSAA 만 빠진다.
     노출은 번짐 문턱을 맞추는 데만 매 프레임 읽는다(밝기를 올려도 번지는 곳이 늘지 않게).

   ★ 감싼 자를 속이지 않는다 — 시험 계량기(test_roomview_perf)·빛 분포 라벨(light_grid_labels)은
     `renderer.render` 를 감싼다. 장면 한 장만 그 감싼 함수로 그리고, 후처리 패스는 감싸기 전
     원본으로 그린다. 그래서 감싼 자는 **한 프레임에 한 번**만 본다(예전과 같다).
     renderer.info 도 장면 한 장의 값으로 되돌려 둔다 — stats().calls·test_outside 가 그걸 읽는다.

   ⚠ 조도(DLI)와 무관하다. 빛 계산은 이 파일을 모른다. 씬·재질·빛 수치는 한 톨도 안 바꾼다.
   ⚠ Node 에서 import 만 해도 안 깨져야 한다(test_snap) — 맨 위에서 THREE·window 를 안 만진다.

   끄기  ?v2=0 (v2 전부) · ?v2fx=0 (후처리만) · localStorage 'byeot.v2' / 'byeot.v2fx' = '0'
   부분  ?v2fxao=0 · ?v2fxbloom=0 · ?v2fxaa=0 · ?v2fxgrade=0 · ?v2fxq=phone|desktop(등급 못 박기)
   재기  window.__v2.postfx.state() · .set(false|true) · .tier('phone'|'desktop') · .part('bloom', false)
============================================================ */

/* ── 켜고 끄는 표시 ─────────────────────────────────────────── */
function readFlag(name) {
  try {
    const v = new URLSearchParams(location.search).get(name);
    if (v != null) return v;
  } catch (_) { /* location 이 없는 곳 */ }
  try {
    const v = localStorage.getItem('byeot.' + name);
    if (v != null) return v;
  } catch (_) { /* 저장소가 막힌 곳 */ }
  return null;
}
/* v2 전부를 끄는 공통 표시 — ?v2=0 */
export function v2On() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  return readFlag('v2') !== '0';
}
export function postFxWanted() {
  return v2On() && readFlag('v2fx') !== '0';
}

/* ── 벤더 스크립트(r128 examples/js, 전역 THREE.* 식) — 차례대로 한 번만 ── */
const _loads = new Map();
function loadScript(url) {
  if (_loads.has(url)) return _loads.get(url);
  const p = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = url; s.async = false;
    s.onload = () => res(true);
    s.onerror = () => rej(new Error('못 받음 ' + url));
    (document.head || document.documentElement).appendChild(s);
  });
  _loads.set(url, p);
  return p;
}
/* [전역 이름, 파일] — 앞의 것이 뒤의 것의 바탕이다(셰이더 → EffectComposer(Pass) → 패스) */
const BASE_SCRIPTS = [
  ['CopyShader', 'shaders/CopyShader.js'],
  ['LuminosityHighPassShader', 'shaders/LuminosityHighPassShader.js'],
  ['FXAAShader', 'shaders/FXAAShader.js'],
  ['EffectComposer', 'postprocessing/EffectComposer.js'],      // Pass · FullScreenQuad 가 여기 있다
  ['UnrealBloomPass', 'postprocessing/UnrealBloomPass.js']
];
const AO_SCRIPTS = [['SSAOShader', 'shaders/SSAOShader.js']];
async function loadVendor(list) {
  const base = new URL('../../vendor/three/', import.meta.url);
  for (const [key, rel] of list) {
    if (THREE[key]) continue;
    await loadScript(new URL(rel, base).href);
    if (!THREE[key]) throw new Error('전역이 안 생김 THREE.' + key);
  }
}

/* ── 색 · 번짐 · AO 값 (보이는 것뿐 — 재서 고른다) ─────────────── */
const LOOK = {
  /* 따뜻한 마감 — 화면(sRGB) 값 위에서 한다 */
  sat: 1.07,                       // 채도 살짝
  gain: [1.030, 1.000, 0.945],     // 흰 균형을 따뜻하게(파랑을 조금 뺀다)
  contrast: 0.20,                  // 필름 S 곡선 섞는 양
  lift: [0.026, 0.017, 0.009],     // 가장 어두운 곳을 갈색 쪽으로 들어 올린다
  liftTop: 0.42,                   // 이 휘도 위로는 안 들어 올린다
  vig: 0.30,                       // 비네트 세기(모서리)
  vigTint: [0.80, 0.72, 0.64],     // 검정이 아니라 따뜻한 갈색으로 눌린다
  dither: 1.0 / 255,               // 8비트 띠를 흩는다
  /* 번짐 — 등갓·창 빛만 번지게 문턱을 높게 */
  bloomStrength: 0.42,
  bloomRadius: 0.55,
  bloomThreshold: 0.80,
  bloomKnee: 0.12,
  /* AO — 데스크톱만. 방 크기(미터)에 맞춘 반경 */
  aoRadius: 0.50,                  // 0.30 은 모서리에 가는 선만 남았다(AO 버퍼를 찍어 봤다)
  aoStrength: 0.70,
  aoNear: 0.3, aoFar: 50,
  aoMin: 0.00008, aoMax: 0.018      // 깊이 비율(aoNear~aoFar) — 약 4mm ~ 0.9m
};
const BASE_EXPOSURE = 0.72 * 1.5;  // room_view 기본 노출(GAME_EXPOSURE × 기본 밝기)

/* ── 마감 셰이더 — FXAA 몸통 뒤에 색보정 main 을 붙인다(패스 한 장) ── */
const FINAL_MAIN = /* glsl */`
uniform sampler2D tBloom;
uniform float uBloom;
uniform float uFxaa;
uniform float uGrade;
uniform float uSat;
uniform vec3  uGain;
uniform float uContrast;
uniform vec3  uLift;
uniform float uLiftTop;
uniform float uVig;
uniform vec3  uVigTint;
uniform float uDither;

float v2luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 v2grade(vec3 c) {
  float l = v2luma(c);
  c = mix(vec3(l), c, uSat);
  /* 따뜻하게 하는 것은 중간·밝은 곳만 — 가장 어두운 곳(밤 그늘)은 제 빛깔을 둔다 */
  c = clamp(c * mix(vec3(1.0), uGain, smoothstep(0.02, 0.30, l)), 0.0, 1.0);
  c = mix(c, c * c * (3.0 - 2.0 * c), uContrast);
  c += uLift * (1.0 - smoothstep(0.0, uLiftTop, v2luma(c)));
  return c;
}
float v2hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

void main() {
  vec3 c;
  if (uFxaa > 0.5) {
    c = FxaaPixelShader(vUv, vec4(0.0), tDiffuse, tDiffuse, tDiffuse, resolution,
                        vec4(0.0), vec4(0.0), vec4(0.0), 0.75, 0.166, 0.0833,
                        0.0, 0.0, 0.0, vec4(0.0)).rgb;
  } else {
    c = texture2D(tDiffuse, vUv).rgb;
  }
  if (uBloom > 0.0) c += texture2D(tBloom, vUv).rgb * uBloom;
  if (uGrade > 0.0) c = mix(c, v2grade(clamp(c, 0.0, 1.0)), uGrade);
  float r = length((vUv - 0.5) * 1.41421);
  c = mix(c, c * uVigTint, smoothstep(0.40, 1.0, r) * uVig);
  c += (v2hash(gl_FragCoord.xy) - 0.5) * uDither;
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

/* ── 등급 고르기 — 폰(dpr≥2 · 좁은 화면 · WebGL1)은 AO 없이 ── */
function pickTier(R, canvas) {
  const q = readFlag('v2fxq');
  if (q === 'phone' || q === 'desktop') return q;
  const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
  const cssW = (canvas && canvas.clientWidth) || (typeof window !== 'undefined' ? window.innerWidth : 0) || 0;
  if (dpr >= 2 || cssW < 700 || !R.capabilities.isWebGL2) return 'phone';
  return 'desktop';
}

/* ============================================================
   createPostFx(ctx, opts) — 뷰마다 하나. 모듈 수준 상태는 스크립트 받기뿐이다.
     opts.canvas    등급을 고를 때 CSS 폭을 본다
     opts.bypass()  참이면 이 프레임은 예전처럼 바로 그린다(빛 분포 판·'house' 재기)
     opts.onChange() 켜짐·등급이 바뀌었다 → 한 장 다시 그려 달라
   돌려주는 것: present() · degrade() · dispose() · state() · set(on) · tier(name) · part(name,on)
============================================================ */
export function createPostFx(ctx, opts = {}) {
  const R = ctx.renderer;
  /* ★ 감싸기 전 원본 — 후처리 패스는 이걸로 그린다(위 머리말 「감싼 자를 속이지 않는다」) */
  const rawRender = R.render;
  let wanted = postFxWanted() && opts.enabled !== false;
  let loading = null, failed = false, disposed = false;
  let pipe = null;
  let forcedTier = null;
  const parts = {
    ao: readFlag('v2fxao') !== '0',
    bloom: readFlag('v2fxbloom') !== '0',
    fxaa: readFlag('v2fxaa') !== '0',
    grade: readFlag('v2fxgrade') !== '0'
  };
  let dropped = [];               // autoQuality 가 내려놓은 것(차례대로)
  let lastMs = 0, frames = 0;
  const snap = { frame: 0, calls: 0, triangles: 0, points: 0, lines: 0 };
  const changed = () => { try { opts.onChange && opts.onChange(); } catch (_) { } };

  function warn(msg, e) {
    try { console.warn('[v2 후처리] ' + msg, e && e.message ? e.message : (e || '')); } catch (_) { }
  }

  function start() {
    if (loading || failed || disposed) return;
    if (typeof THREE === 'undefined' || typeof document === 'undefined') { failed = true; return; }
    const tier = forcedTier || pickTier(R, opts.canvas);
    const list = tier === 'desktop' ? BASE_SCRIPTS.concat(AO_SCRIPTS) : BASE_SCRIPTS;
    loading = loadVendor(list).then(() => {
      if (disposed) return;
      pipe = buildPipe(tier);
      changed();
    }).catch(e => { failed = true; pipe = null; warn('못 켬 — 예전처럼 바로 그린다', e); });
  }

  /* ── 짓기 ───────────────────────────────────────────── */
  function buildPipe(tier) {
    const T = THREE;
    const gl2 = !!R.capabilities.isWebGL2;
    const v = R.getDrawingBufferSize(new T.Vector2());
    const w = Math.max(1, v.x | 0), h = Math.max(1, v.y | 0);
    /* 데스크톱 WebGL2 는 장면 타깃을 MSAA 로 — FXAA 보다 깨끗하다. 폰은 FXAA(싸다) */
    const msaa = tier === 'desktop' && gl2 && typeof T.WebGLMultisampleRenderTarget === 'function';
    /* ⚠ stencilBuffer 를 켜는 까닭 — r128 은 스텐실 없는 타깃의 깊이를 **16비트**로 잡는다
       (DEPTH_COMPONENT16). near 0.1 · far 200 에서 방이 10m 밖이라 베개·자동차 모서리가
       줄무늬로 싸웠다(찍어서 봤다). 스텐실을 켜면 DEPTH_STENCIL = 24비트 깊이 — 화면과 같다. */
    const rtOpt = { minFilter: T.LinearFilter, magFilter: T.LinearFilter, format: T.RGBAFormat,
                    depthBuffer: true, stencilBuffer: true };
    const rt = msaa ? new T.WebGLMultisampleRenderTarget(w, h, rtOpt) : new T.WebGLRenderTarget(w, h, rtOpt);
    if (msaa) rt.samples = 4;
    rt.texture.encoding = T.sRGBEncoding;      // ★ 재질이 스스로 sRGB 로 적는다 — 화면에 바로 그린 값과 같다
    rt.texture.generateMipmaps = false;
    rt.texture.name = 'v2fx.scene';

    const bloom = makeBloom(tier, w, h);
    const ao = (tier === 'desktop' && gl2 && T.SSAOShader) ? makeAO(w, h) : null;

    const fx = T.FXAAShader;
    const cut = fx.fragmentShader.lastIndexOf('void main()');
    const fin = new T.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null }, resolution: { value: new T.Vector2(1 / w, 1 / h) },
        tBloom: { value: null }, uBloom: { value: 0 },
        uFxaa: { value: 1 }, uGrade: { value: 1 },
        uSat: { value: LOOK.sat }, uGain: { value: new T.Vector3(...LOOK.gain) },
        uContrast: { value: LOOK.contrast }, uLift: { value: new T.Vector3(...LOOK.lift) },
        uLiftTop: { value: LOOK.liftTop }, uVig: { value: LOOK.vig },
        uVigTint: { value: new T.Vector3(...LOOK.vigTint) }, uDither: { value: LOOK.dither }
      },
      vertexShader: fx.vertexShader,
      fragmentShader: fx.fragmentShader.slice(0, cut) + FINAL_MAIN,
      depthTest: false, depthWrite: false
    });
    fin.name = 'v2fx.final';
    const quad = new T.FullScreenQuad(fin);
    return { tier, gl2, msaa, w, h, rt, bloom, ao, fin, quad };
  }

  /* 번짐 — UnrealBloomPass 의 앞 두 단계(밝은 곳 뽑기·밉 흐리기·합치기)만 쓴다.
     ★ 마지막 「원본에 더하기」는 마감 패스가 한다 — 전체 해상도 패스 한 장을 아낀다. */
  function makeBloom(tier, w, h) {
    const T = THREE;
    const div = tier === 'desktop' ? 1 : 2;           // 폰은 반해상도에서 시작(안에서 또 반) — 1/4
    const bp = new T.UnrealBloomPass(new T.Vector2(Math.max(2, w / div), Math.max(2, h / div)),
                                     LOOK.bloomStrength, LOOK.bloomRadius, LOOK.bloomThreshold);
    bp.highPassUniforms.smoothWidth.value = LOOK.bloomKnee;
    /* 번짐도 따뜻하게 — 큰 밉일수록 조금 더 주황 */
    const tints = [[1, 1, 1], [1, 0.97, 0.92], [1, 0.94, 0.86], [1, 0.92, 0.82], [1, 0.90, 0.78]];
    for (let i = 0; i < bp.bloomTintColors.length; i++) bp.bloomTintColors[i].set(...tints[i]);
    bp.__div = div;
    return bp;
  }
  const _cc = { c: null };
  function renderBloom(bp, input) {
    const T = THREE;
    if (!_cc.c) _cc.c = new T.Color();
    R.getClearColor(_cc.c);
    const oldA = R.getClearAlpha(), oldAuto = R.autoClear;
    R.autoClear = false;
    R.setClearColor(bp.clearColor, 0);
    const q = bp.fsQuad;
    bp.highPassUniforms.tDiffuse.value = input.texture;
    bp.highPassUniforms.luminosityThreshold.value = bp.threshold;
    q.material = bp.materialHighPassFilter;
    R.setRenderTarget(bp.renderTargetBright); R.clear(); q.render(R);
    let src = bp.renderTargetBright;
    for (let i = 0; i < bp.nMips; i++) {
      const m = bp.separableBlurMaterials[i];
      q.material = m;
      m.uniforms.colorTexture.value = src.texture;
      m.uniforms.direction.value = T.UnrealBloomPass.BlurDirectionX;
      R.setRenderTarget(bp.renderTargetsHorizontal[i]); R.clear(); q.render(R);
      m.uniforms.colorTexture.value = bp.renderTargetsHorizontal[i].texture;
      m.uniforms.direction.value = T.UnrealBloomPass.BlurDirectionY;
      R.setRenderTarget(bp.renderTargetsVertical[i]); R.clear(); q.render(R);
      src = bp.renderTargetsVertical[i];
    }
    q.material = bp.compositeMaterial;
    bp.compositeMaterial.uniforms.bloomStrength.value = bp.strength;
    bp.compositeMaterial.uniforms.bloomRadius.value = bp.radius;
    bp.compositeMaterial.uniforms.bloomTintColors.value = bp.bloomTintColors;
    R.setRenderTarget(bp.renderTargetsHorizontal[0]); R.clear(); q.render(R);
    R.setClearColor(_cc.c, oldA);
    R.autoClear = oldAuto;
    return bp.renderTargetsHorizontal[0].texture;
  }

  /* AO — 데스크톱만. SSAOPass 를 안 쓰는 까닭:
     ① 장면을 한 번 더 그린다(아름다운 그림은 이미 rt 에 있다)
     ② 컷어웨이로 숨긴 벽(colorWrite=false)·반쯤 잘린 벽(clippingPlanes)을 덮어쓴 재질로 **다 그려**
        방이 벽 뒤에 가려진다. 여기서는 그 셋과 투명·선·점·스킨(바인드 자세로 그려진다)을 빼고
        법선·깊이만 반해상도로 그린다. 그림자맵은 다시 굽지 않는다(숨긴 벽으로 구우면 해가 샌다). */
  function makeAO(w, h) {
    const T = THREE;
    const aw = Math.max(1, (w / 2) | 0), ah = Math.max(1, (h / 2) | 0);
    const depthTex = new T.DepthTexture(aw, ah, T.FloatType);   // WebGL2 → DEPTH_COMPONENT32F
    const normalRT = new T.WebGLRenderTarget(aw, ah, {
      minFilter: T.NearestFilter, magFilter: T.NearestFilter, format: T.RGBAFormat,
      depthBuffer: true, stencilBuffer: false, depthTexture: depthTex });
    const ssaoRT = new T.WebGLRenderTarget(aw, ah, {
      minFilter: T.LinearFilter, magFilter: T.LinearFilter, format: T.RGBAFormat,
      depthBuffer: false, stencilBuffer: false });
    const blurRT = ssaoRT.clone();
    const K = 16;
    const kernel = [];
    for (let i = 0; i < K; i++) {
      const s = new T.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random()).normalize();
      let k = i / K; k = 0.1 + 0.9 * k * k;
      kernel.push(s.multiplyScalar(k * (0.6 + 0.4 * Math.random())));
    }
    const nd = new Float32Array(16 * 4);
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2;
      nd[i * 4] = Math.cos(a); nd[i * 4 + 1] = Math.sin(a); nd[i * 4 + 2] = 0; nd[i * 4 + 3] = 1;
    }
    const noise = new T.DataTexture(nd, 4, 4, T.RGBAFormat, T.FloatType);
    noise.wrapS = noise.wrapT = T.RepeatWrapping;
    noise.needsUpdate = true;
    /* 하늘(깊이 1)은 가리지 않는다 — 창밖·배경에 얼룩이 안 앉게 */
    const frag = T.SSAOShader.fragmentShader.replace(
      'float depth = getDepth( vUv );',
      'float depth = getDepth( vUv );\n\t\t\tif ( depth >= 0.99999 ) { gl_FragColor = vec4( 1.0 ); return; }');
    const ssaoMat = new T.ShaderMaterial({
      defines: { PERSPECTIVE_CAMERA: 1, KERNEL_SIZE: K },
      uniforms: T.UniformsUtils.clone(T.SSAOShader.uniforms),
      vertexShader: T.SSAOShader.vertexShader, fragmentShader: frag,
      blending: T.NoBlending, depthTest: false, depthWrite: false
    });
    const u = ssaoMat.uniforms;
    u.tNormal.value = normalRT.texture; u.tDepth.value = depthTex; u.tNoise.value = noise;
    u.kernel.value = kernel; u.resolution.value.set(aw, ah);
    const blurMat = new T.ShaderMaterial({
      uniforms: T.UniformsUtils.clone(T.SSAOBlurShader.uniforms),
      vertexShader: T.SSAOBlurShader.vertexShader, fragmentShader: T.SSAOBlurShader.fragmentShader,
      blending: T.NoBlending, depthTest: false, depthWrite: false
    });
    blurMat.uniforms.tDiffuse.value = ssaoRT.texture;
    blurMat.uniforms.resolution.value.set(aw, ah);
    /* 곱하기로 얹는다(장면 rt 위에) — 세기는 mix(1, ao, s) */
    const compMat = new T.ShaderMaterial({
      uniforms: { tAO: { value: blurRT.texture }, uStrength: { value: LOOK.aoStrength } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform sampler2D tAO; uniform float uStrength; varying vec2 vUv;' +
        'void main(){ float a = texture2D(tAO, vUv).r; gl_FragColor = vec4(vec3(mix(1.0, a, uStrength)), 1.0); }',
      transparent: true, depthTest: false, depthWrite: false,
      blending: T.CustomBlending, blendEquation: T.AddEquation,
      blendSrc: T.DstColorFactor, blendDst: T.ZeroFactor,
      blendEquationAlpha: T.AddEquation, blendSrcAlpha: T.ZeroFactor, blendDstAlpha: T.OneFactor
    });
    const normalMat = new T.MeshNormalMaterial({ side: T.DoubleSide });
    normalMat.blending = T.NoBlending;
    const cam = new T.PerspectiveCamera();
    const quad = new T.FullScreenQuad(null);
    return { aw, ah, normalRT, depthTex, ssaoRT, blurRT, ssaoMat, blurMat, compMat, normalMat, noise, cam, quad,
             hidden: [], clear: new T.Color(0x7777ff), old: new T.Color() };
  }
  /* AO 법선 패스에서 뺄 것 */
  function aoSkip(o) {
    if (o.isPoints || o.isLine || o.isSprite || o.isSkinnedMesh) return true;
    if (o.name && o.name.charCodeAt(0) === 95 && o.name.startsWith('__')) return true;   // __outside·__nbr 등 장식(묶음째)
    if (!o.isMesh) return false;
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of ms) {
      if (!m) return true;
      if (m.transparent || m.colorWrite === false || m.depthWrite === false || m.alphaTest > 0) return true;
      if (m.clippingPlanes && m.clippingPlanes.length) return true;
    }
    return false;
  }
  function collectHidden(root, out) {
    const st = [root];
    while (st.length) {
      const o = st.pop();
      if (!o.visible) continue;
      if (o !== root && aoSkip(o)) { o.visible = false; out.push(o); continue; }
      const ch = o.children;
      for (let i = 0; i < ch.length; i++) st.push(ch[i]);
    }
  }
  function renderAO(A, scene, cam, target) {
    const c = A.cam;
    c.copy(cam, false);
    c.near = LOOK.aoNear; c.far = LOOK.aoFar;
    c.updateProjectionMatrix(); c.updateMatrixWorld(true);
    const hidden = A.hidden; hidden.length = 0;
    collectHidden(scene, hidden);
    const bg = scene.background, ov = scene.overrideMaterial, au = scene.autoUpdate;
    const sm = R.shadowMap, sAU = sm.autoUpdate, sNU = sm.needsUpdate;
    R.getClearColor(A.old);
    const oldA = R.getClearAlpha();
    try {
      scene.background = null; scene.overrideMaterial = A.normalMat;
      scene.autoUpdate = false;                // 행렬은 장면 패스에서 이미 갱신됐다(outside.js 갱신 훅이 두 번 안 돈다)
      sm.autoUpdate = false; sm.needsUpdate = false;   // 숨긴 벽으로 그림자맵을 굽지 않는다
      R.setRenderTarget(A.normalRT);
      R.setClearColor(A.clear, 1);
      R.clear(true, true, false);
      R.render(scene, c);
    } finally {
      scene.background = bg; scene.overrideMaterial = ov; scene.autoUpdate = au;
      sm.autoUpdate = sAU; sm.needsUpdate = sNU;
      R.setClearColor(A.old, oldA);
      for (let i = 0; i < hidden.length; i++) hidden[i].visible = true;
      hidden.length = 0;
    }
    const u = A.ssaoMat.uniforms;
    u.cameraNear.value = c.near; u.cameraFar.value = c.far;
    u.cameraProjectionMatrix.value.copy(c.projectionMatrix);
    u.cameraInverseProjectionMatrix.value.copy(c.projectionMatrixInverse);
    u.kernelRadius.value = LOOK.aoRadius;
    u.minDistance.value = LOOK.aoMin; u.maxDistance.value = LOOK.aoMax;
    A.quad.material = A.ssaoMat; R.setRenderTarget(A.ssaoRT); A.quad.render(R);
    A.quad.material = A.blurMat; R.setRenderTarget(A.blurRT); A.quad.render(R);
    A.quad.material = A.compMat; R.setRenderTarget(target); A.quad.render(R);
  }

  /* ── 크기 맞추기 — renderer 의 실제 그림판 크기를 매 프레임 본다.
     setPixelRatio 를 누가 부르든(autoQuality · resize · 시험이 손으로 0.5 로 박고 막아 둔 것까지)
     따라간다. 바뀐 프레임에만 다시 잡는다. ── */
  const _sz = { v: null };
  function syncSize(P) {
    if (!_sz.v) _sz.v = new THREE.Vector2();
    R.getDrawingBufferSize(_sz.v);
    const w = Math.max(1, _sz.v.x | 0), h = Math.max(1, _sz.v.y | 0);
    if (w === P.w && h === P.h) return;
    P.w = w; P.h = h;
    P.rt.setSize(w, h);
    P.bloom.setSize(Math.max(2, w / P.bloom.__div), Math.max(2, h / P.bloom.__div));
    P.fin.uniforms.resolution.value.set(1 / w, 1 / h);
    if (P.ao) {
      const A = P.ao, aw = Math.max(1, (w / 2) | 0), ah = Math.max(1, (h / 2) | 0);
      A.aw = aw; A.ah = ah;
      A.normalRT.setSize(aw, ah); A.ssaoRT.setSize(aw, ah); A.blurRT.setSize(aw, ah);
      A.ssaoMat.uniforms.resolution.value.set(aw, ah);
      A.blurMat.uniforms.resolution.value.set(aw, ah);
    }
  }

  /* ── 한 장 그리기 — 세 곳(loop · redraw · 부팅)이 다 이것을 부른다 ── */
  function present() {
    const scene = ctx.scene, cam = ctx.cam;
    const P = pipe;
    if (!wanted || !P || disposed || (opts.bypass && opts.bypass())) {
      R.render(scene, cam);                  // 예전 그대로(스크립트를 받는 동안도 이것이다)
      return false;
    }
    const t0 = performance.now();
    const prevTarget = R.getRenderTarget();
    syncSize(P);
    /* ① 장면 — 감싼 자(계량기·라벨)는 이 한 번만 본다 */
    R.setRenderTarget(P.rt);
    R.render(scene, cam);
    const ir = R.info.render;
    snap.frame = ir.frame; snap.calls = ir.calls; snap.triangles = ir.triangles;
    snap.points = ir.points; snap.lines = ir.lines;
    /* ② 후처리 — 원본 render 로. 끝나면 감싼 것을 돌려 놓는다 */
    const wrapped = R.render, oldAuto = R.autoClear;
    R.render = rawRender;
    R.autoClear = false;
    try {
      if (P.ao && parts.ao) renderAO(P.ao, scene, cam, P.rt);
      const U = P.fin.uniforms;
      if (parts.bloom) {
        /* 노출을 매 프레임 읽는다 — 밝기를 올리면 문턱도 같이 올려 번지는 곳이 안 번진다 */
        const k = (R.toneMappingExposure || BASE_EXPOSURE) / BASE_EXPOSURE;
        P.bloom.threshold = Math.min(0.97, LOOK.bloomThreshold * (0.85 + 0.15 * Math.min(2, Math.max(0.5, k))));
        U.tBloom.value = renderBloom(P.bloom, P.rt);
        U.uBloom.value = 1;
      } else { U.uBloom.value = 0; }
      /* 밤에는 갈색 들어올림을 줄인다 — 밤 그늘은 서늘해야 등 빛이 따뜻해 보인다 */
      const sun = ctx.sunLight ? ctx.sunLight.intensity : 1;
      const dayK = Math.min(1, Math.max(0, sun / 2));
      const lk = 0.35 + 0.65 * dayK;
      U.uLift.value.set(LOOK.lift[0] * lk, LOOK.lift[1] * lk, LOOK.lift[2] * lk);
      U.tDiffuse.value = P.rt.texture;
      U.uFxaa.value = (parts.fxaa && !P.msaa) ? 1 : 0;
      U.uGrade.value = parts.grade ? 1 : 0;
      R.setRenderTarget(null);
      P.quad.render(R);
    } catch (e) {
      /* 한 번 깨지면 끈다 — 방이 안 보이는 것보다 예전 그림이 낫다 */
      failed = true; pipe = null;
      warn('그리다 깨져 끔', e);
      R.render = wrapped; R.autoClear = oldAuto;
      R.setRenderTarget(prevTarget);
      R.render(scene, cam);
      changed();
      return false;
    } finally {
      R.render = wrapped;
      R.autoClear = oldAuto;
    }
    R.setRenderTarget(prevTarget);
    /* renderer.info 를 장면 한 장의 값으로 — 후처리 패스는 세지 않는다 */
    ir.frame = snap.frame; ir.calls = snap.calls; ir.triangles = snap.triangles;
    ir.points = snap.points; ir.lines = snap.lines;
    lastMs = performance.now() - t0;
    frames++;
    return true;
  }

  /* autoQuality 가 부른다 — 픽셀비를 내리기 **전에** 비싼 것부터 내려놓는다.
     돌려주는 글은 stats.reduced 에 적힌다. 더 내릴 게 없으면 false(그때 픽셀비를 내린다). */
  function degrade() {
    if (!wanted || !pipe) return false;
    if (pipe.ao && parts.ao && !dropped.includes('ao')) { parts.ao = false; dropped.push('ao'); return 'v2 AO 끔'; }
    if (parts.fxaa && !pipe.msaa && !dropped.includes('fxaa')) { parts.fxaa = false; dropped.push('fxaa'); return 'v2 FXAA 끔'; }
    if (parts.bloom && !dropped.includes('bloom')) { parts.bloom = false; dropped.push('bloom'); return 'v2 번짐 끔'; }
    return false;
  }

  function disposePipe(P) {
    if (!P) return;
    try {
      P.rt.dispose(); P.fin.dispose(); P.quad.dispose();
      const b = P.bloom;
      b.dispose();
      for (const m of b.separableBlurMaterials) m.dispose();
      b.materialHighPassFilter.dispose(); b.compositeMaterial.dispose();
      b.materialCopy && b.materialCopy.dispose(); b.basic && b.basic.dispose();
      if (P.ao) {
        const A = P.ao;
        A.normalRT.dispose(); A.depthTex.dispose(); A.ssaoRT.dispose(); A.blurRT.dispose();
        A.ssaoMat.dispose(); A.blurMat.dispose(); A.compMat.dispose(); A.normalMat.dispose(); A.noise.dispose();
      }
    } catch (e) { warn('치우다', e); }
  }

  const api = {
    present,
    degrade,
    /* 지금 무엇이 켜져 있나 — 재는 도구용 */
    state() {
      return { wanted, ready: !!pipe, failed, tier: pipe ? pipe.tier : null,
               msaa: pipe ? pipe.msaa : null, size: pipe ? [pipe.w, pipe.h] : null,
               ao: !!(pipe && pipe.ao && parts.ao), bloom: !!(pipe && parts.bloom),
               fxaa: !!(pipe && parts.fxaa && !pipe.msaa), grade: !!(pipe && parts.grade),
               dropped: dropped.slice(), lastMs: +lastMs.toFixed(2), frames,
               bypass: !!(opts.bypass && opts.bypass()) };
    },
    /* 통째로 켜고 끄기(A/B) */
    set(on) {
      wanted = !!on;
      if (wanted && !pipe && !failed) start();
      changed();
      return wanted;
    },
    /* 등급을 바꿔 다시 짓기 — 'phone' | 'desktop' */
    tier(name) {
      if (name !== 'phone' && name !== 'desktop') return pipe ? pipe.tier : null;
      forcedTier = name;
      if (!wanted || failed) return name;
      const list = name === 'desktop' ? BASE_SCRIPTS.concat(AO_SCRIPTS) : BASE_SCRIPTS;
      return loadVendor(list).then(() => {
        if (disposed) return null;
        disposePipe(pipe); pipe = buildPipe(name); changed(); return name;
      });
    },
    /* 한 가지만 켜고 끄기 — 'ao' | 'bloom' | 'fxaa' | 'grade' */
    part(name, on) {
      if (!(name in parts)) return null;
      parts[name] = !!on;
      changed();
      return parts[name];
    },
    /* 마감 값 만지기(재는 도구용) — 이름은 LOOK 과 같다 */
    look(k, v) {
      if (!(k in LOOK)) return undefined;
      if (v === undefined) return LOOK[k];
      LOOK[k] = v;
      const P = pipe;
      if (P) {
        const U = P.fin.uniforms;
        U.uSat.value = LOOK.sat; U.uGain.value.set(...LOOK.gain); U.uContrast.value = LOOK.contrast;
        U.uLift.value.set(...LOOK.lift); U.uLiftTop.value = LOOK.liftTop; U.uVig.value = LOOK.vig;
        U.uVigTint.value.set(...LOOK.vigTint); U.uDither.value = LOOK.dither;
        P.bloom.strength = LOOK.bloomStrength; P.bloom.radius = LOOK.bloomRadius;
        P.bloom.highPassUniforms.smoothWidth.value = LOOK.bloomKnee;
        if (P.ao) P.ao.compMat.uniforms.uStrength.value = LOOK.aoStrength;
      }
      changed();
      return LOOK[k];
    },
    /* 재는 도구가 속을 들여다볼 때만(AO 버퍼 찍기 등). 게임은 안 부른다 */
    _pipe() { return pipe; },
    dispose() {
      if (disposed) return;
      disposed = true;
      disposePipe(pipe); pipe = null;
      try { if (window.__v2 && window.__v2.postfx === api) delete window.__v2.postfx; } catch (_) { }
    }
  };

  try {
    if (typeof window !== 'undefined') {
      window.__v2 = window.__v2 || {};
      window.__v2.postfx = api;
    }
  } catch (_) { }
  if (wanted) start();
  return api;
}
