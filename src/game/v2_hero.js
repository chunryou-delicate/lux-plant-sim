/* ============================================================
   v2: 새 주인공 — assets/v2/char/hero.glb (보이는 층만)
   ------------------------------------------------------------
   room_view.js makePerson 이 켜져 있으면 이 파일에서 몸·동작을 받는다.
   끄기: ?v2hero=0 · ?v2=0(v2 전부) · localStorage 'v2hero'='0' 또는 'v2'='0'
   ⇒ 끄면 옛 길(lq/char_jachwi_f_idle.glb + derived 걷기 + anim/*)이 그대로 돈다.

   ★ 잰 것 (2026-09-25 · 헤드리스 three r128 · 스킨 정점을 실제로 풀어서)
     파일 키            1.10 (바인드 · 정점 min/max 와 같다)
     감싸는 배율        1.40 / 1.10 — 옛 주인공과 같은 키. 머리 높이도 같다(바인드 1.399 vs 1.403)
     앞                 +Z (발끝 LeftFoot→LeftToeBase z +0.06~0.12 · 얼굴 Head→headfront z +0.05)
     눕기               머리 −Z · 발 +Z (옛 클립과 같다)
     걷기 지면 속도     0.76 m/s (옛 걷기를 같은 자로 재 0.898 → 문서값 0.871 로 맞춘 비)
   ⛔ idle 클립에 Hips «배율 1.176» 트랙이 박혀 있다(나머지 7개는 1.0).
     그대로 두면 서 있을 때만 몸이 17.6% 커진다(머리 꼭대기 1.40 → 1.57).
     ⇒ 모든 클립에서 .scale 트랙을 뺀다. 뼈 길이(translation)는 손대지 않는다.
   ⛔ 옛 anim/*·derived/char_clips/* 클립은 절대 얹지 않는다 — 1.7m 몸의 뼈 길이를 덮어 늘인다.
     hero 는 제 클립 8개(walk·idle·sit·sleep·doze·crouch·wave·cheer)만 쓴다.
============================================================ */

const HERO_URL = new URL('../../assets/v2/char/hero.glb', import.meta.url).href;

export const HERO_H = 1.40;          // 옛 주인공과 같은 키[m]
export const HERO_WALK_MPS = 0.76;   // 걷기 클립 지면 속도[m/s] — 위 「잰 것」

/* 방 빛 아래 따뜻하게 읽히게 — 텍스처가 구워져 있으니 밝히지 않고 «자체발광»을 줄인다.
   GLB 재질은 emissive = 텍스처 × 1.0 이라 방 조명과 상관없이 스티커처럼 떠 보였다. */
const LOOK = { emissive: 0.30, tint: 0xffd6ae, color: 0xfff1e2, roughness: 0.78 };

/* ── 켜고 끄기 ── window.__v2 한 곳에 모은다 */
export function v2Flag(key) {
  if (typeof window === 'undefined' || typeof location === 'undefined') return false;
  const V = (window.__v2 = window.__v2 || {});
  if (typeof V[key] === 'boolean') return V[key];
  let on = true;
  try {
    const q = new URLSearchParams(location.search);
    const ls = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
    if (q.get('v2') === '0' || q.get(key) === '0') on = false;
    else if (q.get(key) === '1') on = true;
    else if (ls('v2') === '0' || ls(key) === '0') on = false;
  } catch (e) { /* 못 읽으면 기본 켬 */ }
  V[key] = on;
  return on;
}
export const heroOn = () => v2Flag('v2hero');

/* ── 한 번만 받는다 ── 방을 다시 지을 때마다(가구 옮기기 포함) 사람을 새로 세우므로
   2.2MB 를 매번 받고 풀면 그만큼 늦다. 원본은 여기 두고 사람마다 복제한다. */
let _src = null;
function loadSource() {
  if (_src) return _src;
  _src = new Promise((res, rej) =>
    new THREE.GLTFLoader().load(HERO_URL, res, undefined, () => rej(new Error('hero.glb 를 못 받았습니다'))))
    .then(prepare)
    .catch(e => { _src = null; throw e; });
  return _src;
}

function prepare(g) {
  const clips = {};
  for (const c of g.animations || []) {
    const cl = c.clone();
    cl.tracks = cl.tracks.filter(t => !/\.scale$/.test(t.name));   // ⛔ idle Hips 1.176 — 위 주석
    clips[c.name] = cl;
  }
  if (!clips.idle) throw new Error('hero.glb 에 idle 클립이 없습니다');
  /* 파일 키 — 스킨 메시의 바인드 상자(정점 min/max). 재서 1.10 이 아니면 그 값을 믿는다 */
  let h = 0;
  g.scene.traverse(o => {
    if (!o.isSkinnedMesh || !o.geometry) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const b = o.geometry.boundingBox; h = Math.max(h, b.max.y - b.min.y);
  });
  if (!(h > 0.3 && h < 3)) h = 1.10;
  let moved = 0;
  g.scene.traverse(o => { if (o.isSkinnedMesh) moved += fixBackHair(o); });
  return { scene: g.scene, clips, fileH: h, act: new Map(), hairFixed: moved };
}

/* ⛔ 뒷머리가 «팔»에 묶여 있다 — 잰 것(바인드 · 파일 단위 1.10m):
     몸 뒤(z < −0.10) · 가운데(|x| < 0.30) · 허리~어깨(y 0.35~0.95) 정점 약 2,600개가
     RightForeArm(대부분)·LeftForeArm·RightArm 무게를 받는다. 셔츠 등판은 z ≥ −0.07 이라 틈이 뚜렷하다.
     ⇒ 팔을 흔들면 뒷머리 끝이 팔을 따라 휘고, 누우면 머리칼이 침대 밑으로 늘어져
       measureGround 가 몸을 0.25m 띄웠다(골반이 매트리스 위 0.32m).
   ⇒ 그 정점의 «팔» 무게만 떼어 Head(위)·Spine(아래)로 옮긴다. 높이로 섞는다(y 0.75↑ Head · 0.50↓ Spine).
     다른 정점·다른 뼈는 손대지 않는다. 한 번만(원본 기하에) 한다. */
function fixBackHair(mesh) {
  const G = mesh.geometry, P = G.attributes.position, SI = G.attributes.skinIndex, SW = G.attributes.skinWeight;
  if (!P || !SI || !SW) return 0;
  const names = mesh.skeleton.bones.map(b => b.name);
  const iHead = names.indexOf('Head'), iSpine = names.indexOf('Spine');
  if (iHead < 0 || iSpine < 0) return 0;
  const isArm = names.map(n => /^(Left|Right)(Arm|ForeArm|Hand)$/.test(n));
  const idx = [0, 0, 0, 0], wt = [0, 0, 0, 0];
  let n = 0;
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    if (!(z < -0.10 && Math.abs(x) < 0.30 && y > 0.35 && y < 0.95)) continue;
    idx[0] = SI.getX(i); idx[1] = SI.getY(i); idx[2] = SI.getZ(i); idx[3] = SI.getW(i);
    wt[0] = SW.getX(i); wt[1] = SW.getY(i); wt[2] = SW.getZ(i); wt[3] = SW.getW(i);
    let arm = 0;
    const m = new Map();
    for (let k = 0; k < 4; k++) {
      if (!(wt[k] > 0)) continue;
      if (isArm[idx[k]]) arm += wt[k];
      else m.set(idx[k], (m.get(idx[k]) || 0) + wt[k]);
    }
    if (arm <= 0) continue;
    const kh = Math.min(1, Math.max(0, (y - 0.50) / 0.25));
    m.set(iHead, (m.get(iHead) || 0) + arm * kh);
    m.set(iSpine, (m.get(iSpine) || 0) + arm * (1 - kh));
    const top = [...m.entries()].filter(e => e[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const sum = top.reduce((s, e) => s + e[1], 0) || 1;
    for (let k = 0; k < 4; k++) { idx[k] = top[k] ? top[k][0] : 0; wt[k] = top[k] ? top[k][1] / sum : 0; }
    SI.setXYZW(i, idx[0], idx[1], idx[2], idx[3]);
    SW.setXYZW(i, wt[0], wt[1], wt[2], wt[3]);
    n++;
  }
  if (n) {
    for (const a of [SI, SW]) { if (a.isInterleavedBufferAttribute) a.data.needsUpdate = true; else a.needsUpdate = true; }
  }
  return n;
}

/* 스킨 메시 복제 — 뼈를 새 나무의 뼈로 다시 묶는다(SkeletonUtils.clone 과 같은 일).
   기하·텍스처는 나눠 쓰고 재질만 사람마다 새로 만든다. */
function cloneSkinned(src) {
  const dst = src.clone(true);
  const map = new Map();
  (function walk(a, b) {
    map.set(a, b);
    for (let i = 0; i < a.children.length; i++) walk(a.children[i], b.children[i]);
  })(src, dst);
  dst.traverse(o => {
    if (!o.isSkinnedMesh) return;
    const sk = o.skeleton;
    const bones = sk.bones.map(b => map.get(b) || b);
    o.bind(new THREE.Skeleton(bones, sk.boneInverses.map(m => m.clone())), o.bindMatrix);
    o.userData.sharedGeometry = true;            // disposeObject 가 원본 기하를 안 버리게
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const out = mats.map(m => warm(m.clone()));
    o.material = Array.isArray(o.material) ? out : out[0];
  });
  return dst;
}

function warm(m) {
  if (!m || !m.isMeshStandardMaterial) return m;
  if (m.map) m.map.encoding = THREE.sRGBEncoding;
  if (m.emissiveMap) {
    m.emissiveMap.encoding = THREE.sRGBEncoding;
    m.emissive = new THREE.Color(LOOK.tint).multiplyScalar(LOOK.emissive);
  }
  m.color = new THREE.Color(LOOK.color);
  m.roughness = LOOK.roughness;
  m.metalness = 0;
  m.needsUpdate = true;
  return m;
}

/* ── 동작 클립 ──
   water·sow·harvest → crouch 의 «숙이는» 마디. 대상 높이까지 손이 내려가는 데서 끊는다.
   오른손 높이(1.40m · 발 0 기준, 잰 값):  t 0.8→0.67  1.2→0.53  1.6→0.31  2.0→0.17  2.4→0.12
   ⇒ 끝 = 손이 (대상 y + 0.15) 에 닿는 때. 마디는 최대 1.5초(화면 1.5초에 1배속 이하).
   sit  → sit 의 끝 1초(곧게 앉은 자세). 통째로 틀면 11.4초를 1.2초에 몰아 몸이 앞뒤로 튄다.
          «끝 자세»는 원본과 같다 — 앉는 높이는 room_view 가 끝 자세의 골반을 재서 맞춘다.
   sleep → sleep 통째(처음부터 누운 자세다).
   ※ 낮잠은 게임이 'sleep' 으로 부른다 — doze 를 쓸 따로 된 동작이 없다. */
const HAND = [[0.8, 0.666], [1.2, 0.526], [1.6, 0.312], [2.0, 0.166], [2.4, 0.120]];
const SIT_TAIL = 1.0;

function crouchEnd(targetY) {
  const want = Math.min(0.62, Math.max(0.12, (Number.isFinite(targetY) ? targetY : 0) + 0.15));
  let t = 2.4;
  for (let i = 0; i < HAND.length - 1; i++) {
    const [t0, y0] = HAND[i], [t1, y1] = HAND[i + 1];
    if (want <= y0 && want >= y1) { t = t0 + (t1 - t0) * (y0 - want) / (y0 - y1); break; }
  }
  return Math.max(1.0, Math.round(t * 10) / 10);
}

function actClipFrom(src, kind, targetY) {
  const U = THREE.AnimationUtils;
  const cut = (clip, a, b, name) => {
    const key = `${name}`;
    if (src.act.has(key)) return src.act.get(key);
    let c = clip;
    if (U && U.subclip && (a > 0 || b < clip.duration - 0.05))
      c = U.subclip(clip, name, Math.round(a * 30), Math.round(b * 30), 30);
    else c = clip.clone();
    c.name = name;
    src.act.set(key, c);
    return c;
  };
  const C = src.clips;
  if (kind === 'sit' && C.sit) return cut(C.sit, Math.max(0, C.sit.duration - SIT_TAIL), C.sit.duration, 'sit:act');
  if (kind === 'sleep' && C.sleep) return cut(C.sleep, 0, C.sleep.duration, 'sleep:act');
  /* 물·심기·거두기, 그리고 모르는 동작은 crouch → 없으면 idle */
  if (C.crouch) {
    const end = Math.min(crouchEnd(targetY), C.crouch.duration);
    const from = Math.max(0, +(end - 1.5).toFixed(1));
    return cut(C.crouch, from, end, `crouch:act:${from}-${end}`);
  }
  return C.idle ? cut(C.idle, 0, C.idle.duration, 'idle:act') : null;
}

/* ── 사람 하나 ── makePerson 이 GLB 대신 받는다. 모양은 gltf 와 같게(scene · animations[0]=idle) */
export async function makeHero() {
  const src = await loadSource();
  const body = cloneSkinned(src.scene);
  /* 옛 GLB 의 '__scale_root' 와 같은 자리 — 1.40m 로 감싼다. 발은 y=0 그대로(바인드 최저 0.0004) */
  const wrap = new THREE.Group();
  wrap.name = '__scale_root';
  wrap.scale.setScalar(HERO_H / src.fileH);
  wrap.add(body);
  const walk = src.clips.walk ? src.clips.walk : null;
  if (walk) walk.name = 'walking';
  src.clips.idle.name = 'idle';
  return {
    scene: wrap,
    animations: [src.clips.idle],
    walk,
    walkMps: HERO_WALK_MPS,
    actClip: (kind, targetY) => Promise.resolve(actClipFrom(src, String(kind || '').toLowerCase(), targetY)),
    clipNames: Object.keys(src.clips)
  };
}
