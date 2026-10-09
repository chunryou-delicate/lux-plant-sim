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

/* 10-09 (char): 주인공 몸 = hero2(긴 생머리 · A포즈 · Meshy rig 01a11e7a) — 총괄 10-09 «기본을 hero2 로»(박사님 «초상화처럼 긴 생머리»).
   옛 몸(hero.glb · T포즈)은 ?hero2=0 · localStorage 'hero2'='0' 으로 남긴다(되돌리기 쉽게). */
function heroFile() {
  try {
    const q = new URLSearchParams(location.search);
    const off = q.get('hero2') === '0' || (q.get('hero2') !== '1' && localStorage.getItem('hero2') === '0');
    return off ? 'hero.glb' : 'hero2.glb';
  } catch (e) { return 'hero2.glb'; }
}
const HERO_URL = new URL('../../assets/v2/char/' + heroFile(), import.meta.url).href;

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
  /* v2 (02:50 · char 창 실측): Meshy 가 hero 에 붙인 walk·idle 은 팔이 들린다(벌림각 walk 82° · idle 38°).
     char 창이 옛 자취녀 클립의 «팔 8뼈 회전만» 옮긴 walk_arm·idle_arm 을 더했다(12.6° · 18.6°, 뼈 길이는 hero 것).
     있으면 그것을 쓴다. 뒷머리 무게는 아래 fixBackHair 가 옮기니 팔을 따라 날개처럼 펼쳐지지 않는다(게임에서 볼 것). */
  if (clips.walk_arm) clips.walk = clips.walk_arm;
  if (clips.idle_arm) clips.idle = clips.idle_arm;
  /* 10-08 (char): crouch 도 팔이 들렸다(벌림각 47°). 옛 repot 의 팔 8뼈 회전만 옮긴 crouch_arm(32.4°) 을 쓴다.
     ⚠ 팔이 바뀌면 손 높이가 바뀐다 ⇒ crouchEnd 의 손 높이 표도 crouch_arm 것(HAND_ARM)으로 바꾼다. */
  if (clips.crouch_arm) { clips.crouch = clips.crouch_arm; clips.crouch.__arm = true; }
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
  /* 10-09 (char): fixBackHair 의 상자는 «키 1.10 파일»에서 잰 절대값이다 ⇒ 파일 키 비율로 늘인다(hero 는 1.0 그대로 · hero2 1.4/1.10).
     hero2 에서 늘인 상자가 잡는 정점: 머리 6,997 · 머리 아님 359(머리 옆 등판 · 팔 무게가 작다) */
  g.scene.traverse(o => { if (o.isSkinnedMesh) moved += fixBackHair(o, h / 1.10); });
  /* 10-09 (char): 몸마다 다른 수 — 파일이 scene.extras 에 적어 오면 그것을 쓴다(tools/char/build_hero2.py 가 재서 적는다).
     crouchHand 쭈그리기 오른손 높이 표 · walkMps 걷기 지면 속도 · emoteWin 몸짓 클립에서 쓸 구간. 없으면 아래 옛 값. */
  const X = (g.scene && g.scene.userData) || {};
  return { scene: g.scene, clips, fileH: h, act: new Map(), hairFixed: moved,
           hand: Array.isArray(X.crouchHand) ? X.crouchHand : null,
           walkMps: Number.isFinite(X.walkMps) ? X.walkMps : null,
           emoteWin: X.emoteWin || {}, breakWin: X.breakWin || {}, kind: X.hero || 'hero' };
}

/* ⛔ 뒷머리가 «팔»에 묶여 있다 — 잰 것(바인드 · 파일 단위 1.10m):
     몸 뒤(z < −0.10) · 가운데(|x| < 0.30) · 허리~어깨(y 0.35~0.95) 정점 약 2,600개가
     RightForeArm(대부분)·LeftForeArm·RightArm 무게를 받는다. 셔츠 등판은 z ≥ −0.07 이라 틈이 뚜렷하다.
     ⇒ 팔을 흔들면 뒷머리 끝이 팔을 따라 휘고, 누우면 머리칼이 침대 밑으로 늘어져
       measureGround 가 몸을 0.25m 띄웠다(골반이 매트리스 위 0.32m).
   ⇒ 그 정점의 «팔» 무게만 떼어 Head(위)·Spine(아래)로 옮긴다. 높이로 섞는다(y 0.75↑ Head · 0.50↓ Spine).
     다른 정점·다른 뼈는 손대지 않는다. 한 번만(원본 기하에) 한다. */
function fixBackHair(mesh, s = 1) {
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
    if (!(z < -0.10 * s && Math.abs(x) < 0.30 * s && y > 0.35 * s && y < 0.95 * s)) continue;
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
    const kh = Math.min(1, Math.max(0, (y - 0.50 * s) / (0.25 * s)));
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

/* ⛔ 10-08 (char) — 앞·옆 머리와 뺨·턱도 «팔»에 묶여 있다(바인드 T포즈 · 머리 정점 9,700여 · 뺨·턱 피부 1,000여).
     fixBackHair 는 등 뒤만 옮긴다 ⇒ cheer·wave 처럼 팔을 «수평 위로» 들면 머리 가닥이 날개처럼 들리고 얼굴을 가로지른다.
   ⇒ 그 무게를 옮긴 «몸짓 무게»를 hero.glb 에 따로 실었다(_JOINTS_EMOTE/_WEIGHTS_EMOTE · tools/char/fix_hair_weights.py --as-emote).
   ⛔ 몸짓 무게를 늘 쓰면 걷기·idle 어깨에 바늘이 새로 난다(팔에 닿은 머리가 팔을 안 따라간다) ⇒ «팔을 수평 위로 들 때만» 바꿔 쓴다.
   ★ 바꾸는 순간 안 튄다: 바인드가 T포즈라 팔이 수평 근처면 어느 무게든 같은 자리에 그려진다.
   문턱 — 위팔(Arm→ForeArm)·아래팔(ForeArm→Hand)이 몸통 위쪽(Hips→Spine)과 이루는 각, 두 팔 중 작은 쪽:
     켬 = 위팔 < 78° 또는 아래팔 < 65° · 끔 = 위팔 > 98° 이고 아래팔 > 85°.
     ⛔ 위팔만 보던 첫 판: cheer 앞부분은 위팔 82°(수평 근처)인데 아래팔이 위로 꺾여 그 사이 원래 무게로 머리가 들렸다.
     잰 것(게임이 쓰는 구간 — walk_arm·idle_arm 통째 · sit 끝 1초 · sleep · crouch_arm 0~2.4초):
       위팔 최소 87.7° · 아래팔 최소 74.4° ⇒ 한 번도 안 켜진다(9° 이상 여유).
       cheer 아래팔 3.5~ (92% 가 45° 밑) · wave 위팔 42.6~ · 아래팔 7.2~.
   메시마다 한 번 건다(복제본에). 기하는 원본과 나눠 쓰니 바꾸면 같은 기하를 쓰는 사람이 다 바뀐다 — hero 는 방에 하나다. */
function installEmoteSkin(mesh) {
  const G = mesh.geometry;
  const eJ = G && G.attributes._joints_emote, eW = G && G.attributes._weights_emote;
  if (!eJ || !eW || !mesh.skeleton) return false;
  /* 원래 무게도 딴 이름으로 늘 기하에 남긴다 — 빠져 있는 동안에도 GPU 버퍼가 살아 있게.
     ⚠ 기하를 나눠 쓴다 ⇒ 앞 사람이 몸짓 무게인 채로 치워졌을 수 있다. 둘째부터는 남겨 둔 원래 무게를 쓴다. */
  const bJ = G.attributes._joints_base || G.attributes.skinIndex, bW = G.attributes._weights_base || G.attributes.skinWeight;
  G.setAttribute('_joints_base', bJ); G.setAttribute('_weights_base', bW);
  G.setAttribute('skinIndex', bJ); G.setAttribute('skinWeight', bW);
  const bone = n => mesh.skeleton.bones.find(b => b.name === n);
  const hips = bone('Hips'), spine = bone('Spine');
  const arms = ['Left', 'Right'].map(s => [bone(s + 'Arm'), bone(s + 'ForeArm'), bone(s + 'Hand')]);
  if (!hips || !spine || arms.some(a => !a[0] || !a[1] || !a[2])) return false;
  const p = new THREE.Vector3(), q = new THREE.Vector3(), up = new THREE.Vector3();
  const deg = (a, b) => { a.getWorldPosition(p); b.getWorldPosition(q).sub(p).normalize();
    return Math.acos(Math.max(-1, Math.min(1, q.dot(up)))) * 180 / Math.PI; };
  let on = false;
  mesh.userData.emoteSkin = () => on;
  mesh.onBeforeRender = function () {
    hips.getWorldPosition(p); spine.getWorldPosition(up).sub(p).normalize();
    let upper = 180, fore = 180;
    for (const [a, f, h] of arms) { upper = Math.min(upper, deg(a, f)); fore = Math.min(fore, deg(f, h)); }
    const want = on ? !(upper > 98 && fore > 85) : (upper < 78 || fore < 65);
    if (want === on) return;
    on = want;
    G.setAttribute('skinIndex', on ? eJ : bJ);
    G.setAttribute('skinWeight', on ? eW : bW);
  };
  return true;
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
  /* 10-09 (char): hero2(Meshy 새 몸)는 재질에 자체발광 그림이 «없다» — 옛 hero 는 emissive = 그림이었고 위 LOOK(×0.30)이 그 위에서 맞춰졌다.
     ⛔ 그대로 두니 폰 새벽 화면에서 머리 밝기가 초상화의 0.28(옛 hero D24 판 0.67) — 다시 «검정 쪽»이었다(probe_hair_onscreen).
     ⇒ 같은 그림을 자체발광으로 걸어 옛 hero 와 같은 빛 받음으로 맞춘다. */
  if (!m.emissiveMap && m.map) m.emissiveMap = m.map;
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
/* crouch_arm(팔 회전만 옮긴 판)의 오른손 높이 — 10-08 char 실측(probe 로 원본을 재면 위 HAND 가 그대로 나온다: 자기시험).
   팔이 내려와 손이 2.5~3.5cm 더 낮다. */
const HAND_ARM = [[0.8, 0.641], [1.2, 0.490], [1.6, 0.277], [2.0, 0.134], [2.4, 0.090]];
const SIT_TAIL = 1.0;

function crouchEnd(targetY, table = HAND) {
  const want = Math.min(0.62, Math.max(0.12, (Number.isFinite(targetY) ? targetY : 0) + 0.15));
  let t = table[table.length - 1][0];
  /* 10-09 (char): 찾는 높이가 표의 맨 위(서 있을 때 손)보다 높으면 «가장 이른 때» — 덜 숙인다.
     ⛔ 옛 표는 0.8초에 0.666m 라 창턱(0.62m)도 안에 들었지만, hero2 는 서 있을 때 손이 0.523m 라
       표 밖으로 나가 끝까지(바닥까지) 쭈그릴 뻔했다. */
  if (want >= table[0][1]) t = table[0][0];
  else for (let i = 0; i < table.length - 1; i++) {
    const [t0, y0] = table[i], [t1, y1] = table[i + 1];
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
  /* 10-08 (char): 기쁜 순간 몸짓 — wave(5.37초 · 오른팔 들어 흔듦) · cheer(2.97초 · 두 팔 위로) 통째.
     거는 자리(첫 새순·첫 무늬·몬이 만남)는 core 다. 예전엔 이 이름도 아래 crouch 로 빠졌다. */
  if ((kind === 'wave' || kind === 'cheer') && C[kind]) {
    /* 10-09 (char): hero2 의 cheer 는 9.03초(Motivational_Cheer) — 파일이 적어 온 «팔이 가장 높은 3초»만 튼다 */
    const w = src.emoteWin && src.emoteWin[kind];
    const [a, b] = Array.isArray(w) ? [Math.max(0, w[0]), Math.min(C[kind].duration, w[1])] : [0, C[kind].duration];
    return cut(C[kind], a, b, `${kind}:act`);
  }
  /* 10-09 (char): hero2 는 물주기·거두기 제 클립이 있다 — 옛 자취녀와 같은 Meshy 동작(285 문 열기 · 278 서서 따기 · 277 쭈그려 따기)이라
     room_view ACT_SPEC 이 옛 몸에 쓰던 구간을 그대로 쓴다(0.30초부터 1.5 · 1.8 · 2.1초 · 무릎 0.45m 밑은 쭈그려 따기). */
  if (kind === 'water' && C.water) return cut(C.water, 0.30, Math.min(C.water.duration, 1.80), 'water:act');
  if (kind === 'harvest' && C.harvest) {
    const low = Number.isFinite(targetY) && targetY < 0.45 && C.harvest_low;
    return low ? cut(C.harvest_low, 0.30, Math.min(C.harvest_low.duration, 2.40), 'harvest_low:act')
               : cut(C.harvest, 0.30, Math.min(C.harvest.duration, 2.10), 'harvest:act');
  }
  /* 물·심기·거두기, 그리고 모르는 동작은 crouch → 없으면 idle */
  if (C.crouch) {
    const table = src.hand || (C.crouch.__arm ? HAND_ARM : HAND);   // 10-09: 파일이 적어 온 표가 먼저
    const end = Math.min(crouchEnd(targetY, table), C.crouch.duration);
    const from = Math.max(0, +(end - 1.5).toFixed(1));
    return cut(C.crouch, from, end, `crouch:act:${from}-${end}`);
  }
  return C.idle ? cut(C.idle, 0, C.idle.duration, 'idle:act') : null;
}

function breakClipFrom(src, name) {
  const C = src.clips[name];
  if (!C) return null;
  const key = `break:${name}`;
  if (src.act.has(key)) return src.act.get(key);
  const w = src.breakWin && src.breakWin[name];
  const U = THREE.AnimationUtils;
  let c = C;
  if (Array.isArray(w) && U && U.subclip) {
    const a = Math.max(0, w[0]), b = Math.min(C.duration, w[1]);
    if (b - a > 0.5) c = U.subclip(C, key, Math.round(a * 30), Math.round(b * 30), 30);
  }
  if (c === C) c = C.clone();
  c.name = name;
  src.act.set(key, c);
  return c;
}

/* ── 옷 — 몸은 하나, 그림만 바꿔 끼운다 (10-09 char · 주문표 ③ · hero2 만) ──
   그림은 tools/char/apply_outfit_tex.py 가 만든다: Meshy retexture 의 «옷 자리»만 쓰고 얼굴·눈·머리카락·맨살은 hero2 그대로(정본 · D24).
   UV 가 리그 전 3D 와 같아(차 0) 그림을 그대로 입힌다. 'summer' 는 파일에 든 원래 그림(크림 티).
   어떤 옷을 언제 입힐지(계절 · 잘 때 · 비 오는 날)는 core 가 정해 setOutfit 을 부른다. */
const OUTFIT_FILES = { spring: 'spring.jpg', autumn: 'autumn.jpg', winter: 'winter.jpg', pajama: 'pajama.jpg', rain: 'rain.jpg' };
const _outfitTex = new Map();
function outfitTexture(name) {
  if (_outfitTex.has(name)) return _outfitTex.get(name);
  const url = new URL('../../assets/v2/char/outfit/' + OUTFIT_FILES[name], import.meta.url).href;
  const p = new Promise((res, rej) => new THREE.TextureLoader().load(url, t => {
    t.flipY = false;                     // glTF 그림과 같게
    t.encoding = THREE.sRGBEncoding;
    res(t);
  }, undefined, () => rej(new Error('옷 그림을 못 받았습니다: ' + name))));
  p.catch(() => _outfitTex.delete(name));
  _outfitTex.set(name, p);
  return p;
}

/* ── 사람 하나 ── makePerson 이 GLB 대신 받는다. 모양은 gltf 와 같게(scene · animations[0]=idle) */
export async function makeHero() {
  const src = await loadSource();
  const body = cloneSkinned(src.scene);
  const baseMaps = [];   // 'summer' 로 되돌릴 원래 그림
  body.traverse(o => { if (o.isSkinnedMesh) for (const m of [].concat(o.material)) baseMaps.push([m, m.map, m.emissiveMap]); });
  let outfit = 'summer';
  let emoteSkin = 0;
  body.traverse(o => { if (o.isSkinnedMesh && installEmoteSkin(o)) emoteSkin++; });   // 10-08 char — 위 installEmoteSkin
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
    walkMps: src.walkMps || HERO_WALK_MPS,   // 10-09: hero2 0.729 (파일 extras)
    actClip: (kind, targetY) => Promise.resolve(actClipFrom(src, String(kind || '').toLowerCase(), targetY)),
    clipNames: Object.keys(src.clips),
    /* 10-09 (char): 서 있을 때 잠깐 몸짓(머리 긁적 · 끄덕 · 듣기) — hero2 에만 있다. 거는 자리는 core(room_view IDLE_BREAK) */
    breakClips: ['scratch', 'nod', 'listen'].filter(n => src.clips[n]),
    /* 10-09 (char): 파일이 적어 온 구간(breakWin — 많이 움직이되 시작·끝이 쉬는 자세에 가까운 3~6초)만 잘라 준다 — core 는 받은 클립을 그대로 튼다 */
    breakClip: name => breakClipFrom(src, name),
    /* 10-09 (char): 옷 — 'summer'(기본) · 'spring' · 'autumn' · 'winter' · 'pajama' · 'rain'. 그림이 없는 옷이면 그대로 두고 false.
       돌려주는 값: 입혔나(true/false). 같은 옷이면 아무것도 안 한다. */
    get outfit() { return outfit; },
    outfits: ['summer', ...Object.keys(OUTFIT_FILES)],
    setOutfit: async name => {
      const k = String(name || 'summer');
      if (k === outfit) return true;
      if (k === 'summer') {
        for (const [m, map, em] of baseMaps) { m.map = map; m.emissiveMap = em; m.needsUpdate = true; }
        outfit = k; return true;
      }
      if (!OUTFIT_FILES[k] || src.kind !== 'hero2') return false;   // 옷 그림은 hero2 UV 로 만들었다 — 옛 몸(hero.glb)은 못 입는다
      let t;
      try { t = await outfitTexture(k); } catch (e) { console.warn('[주인공] ' + e.message); return false; }
      for (const [m, map, em] of baseMaps) {
        if (map) { t.wrapS = map.wrapS; t.wrapT = map.wrapT; }
        m.map = t; if (em) m.emissiveMap = t; m.needsUpdate = true;
      }
      outfit = k; return true;
    },
    emoteSkin   // 몸짓 무게를 건 메시 수(0 이면 hero.glb 에 _WEIGHTS_EMOTE 가 없다)
  };
}
