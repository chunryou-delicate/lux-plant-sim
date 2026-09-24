/* ============================================================
   render3d/furniture_dress.js — 보이는 층 v2 · 가구에 «옷» 입히기 (그림만)
   ------------------------------------------------------------
   무엇: 코드로 지은 가구(furniture_pastel) 위에 생성 GLB 를 옷처럼 입힌다.
         방 소품(러그·빨래통·난로·쓰레기·가방·건조대)도 여기서 놓는다.

   ★ 옛 상자는 버리지 않는다 — 보이지 않는 «대리»로 남아 광선을 받는다.
     재질만 visible:false 인 한 벌로 바꾼다(g.visible·colorWrite·투명은 안 건드린다).
       · Raycaster 는 층(layers)만 본다 → 대리가 그대로 맞는다
         ⇒ 배치·상판 칸·앉기/눕기 높이(surfaceTopAt)·가구 집기가 한 톨도 안 바뀐다
       · 그리기 목록과 그림자 패스는 material.visible 을 본다 → 대리는 안 그려진다
   ★ GLB 는 층 1 에만 둔다. 카메라가 층 1 을 켜니 보이고, 광선(층 0)은 안 맞는다.
     그림자 패스는 «주 카메라»의 층으로 거른다(r128 WebGLShadowMap) → 그림자도 던진다.
   ★ 윗면 맞추기 — 화분 자리(userData.slots) 높이에서 GLB 윗면을 재서 세로 배율을 정한다.
     자리가 없는 것(침대·의자)은 대리의 윗면(이불·좌판)을 재서 맞춘다. 가로·깊이는
     userData.size 발자국에 맞춘다(충돌·접지 그림자·칸과 같은 판).
   ⚠ g.userData 는 한 글자도 안 건드린다 — 조도·충돌·자리의 정본이다.
     (userData 는 clone 때 JSON 으로 복사되므로 재질 같은 참조도 안 넣는다 → WeakMap)
   ⚠ 소품은 houseGroup 에 따로 둔다. built.room/furniture 에는 안 넣는다.
     놓인 화분·옮긴 가구와 겹치면 소품이 비켜 준다(숨는다) — 판정은 안 바꾼다.
   ⚠ Node(test_snap)에서도 import 된다 — 맨 위에서 THREE·window 를 만지지 않는다.

   끄기: ?v2=0 (v2 전부) · ?v2furn=0 · localStorage v2='0' / v2furn='0'
         돌면서 끄고 켜기: window.__v2.furn.set(false|true)
============================================================ */

const ASSET = p => new URL('../../assets/v2/' + p, import.meta.url).href;

/* ── v2 스위치 한 벌 (다른 v2 창과 같은 규약) ── */
export function v2Enabled(key) {
  try {
    const q = new URLSearchParams((typeof location !== 'undefined' && location.search) || '');
    let ls = null;
    try { ls = typeof localStorage !== 'undefined' ? localStorage : null; } catch (_) { ls = null; }
    if (q.get('v2') === '0' || (ls && ls.getItem('v2') === '0')) return false;
    if (key) {
      const v = q.get(key);
      if (v != null) return v !== '0';
      if (ls && ls.getItem(key) === '0') return false;
    }
  } catch (_) { /* 창이 없는 환경 — 기본 켬 */ }
  return true;
}

/* ── 프리셋 → 옷 ─────────────────────────────────────────────
   yaw 는 GLB 를 몇 도 돌려야 «앞이 +Z» 가 되나(빌더 규약: 헤드보드·등받이 −Z,
   서랍 손잡이 +Z). 스크린샷으로 확인한 값이다.
   probes 는 윗면을 잴 점(발자국 비율 u,v · 0..1). 자리(slots)가 있으면 자리를 쓴다. */
const FURN = {
  bed_single: { file: 'furniture/bed.glb', yaw: 0,
                probes: [[0.5, 0.55], [0.5, 0.7], [0.3, 0.62], [0.7, 0.62], [0.5, 0.85]] },
  desk:       { file: 'furniture/desk.glb', yaw: 0 },
  chair:      { file: 'furniture/chair.glb', yaw: 0, probes: [[0.5, 0.6], [0.4, 0.66], [0.6, 0.66]] },
  dresser:    { file: 'furniture/drawer.glb', yaw: 0 },
  nightstand: { file: 'furniture/cabinet.glb', yaw: 0 }
};
/* 옷을 안 입히고 색만 바꾸는 것 — 단·자리 계약이 걸려 있다(3단 선반·창턱 받침) */
const RESTYLE = {
  shelf_etagere: { board: 0xc9cccd, post: 0xa9aeb1, rough: 0.5, metal: 0.12 },   // 옅은 회색 칠한 쇠
  shelf_wall:    { board: 0xd8c29c, post: 0xb49a74, rough: 0.7, metal: 0.0 }     // 따뜻한 칠 나무
};

/* ── 소품 자리 (반지하) ──────────────────────────────────────
   x,z 는 방 좌표(m) · yaw 는 도 · h 는 높이(m, 비율 그대로 줄인다).
   ★ 왜 여기인가 (화분 판정은 floor_nav.blocked — 벽·가구 발자국에서 화분 반지름 밖이면
     바닥 어디든 놓인다. 그래서 «놓을 수 없는 바닥»은 가구 밑뿐이다):
       빨래통   책상 밑 오른쪽 — 가구 발자국 안이라 화분이 못 오는 칸
       난로     침대 발치 · 왼벽에 붙여 — 걷는 길(문→방 가운데) 밖
       쓰레기   문 왼쪽 구석 · 가방·신발 문 오른쪽 앞벽 — 문 폭(x −2.05~−1.15)은 비운다
       건조대   침대 머리맡과 3단 선반 사이 창 밑 — 선반 앞에 서는 자리를 안 막는다
       러그     방 가운데 빈 바닥 — 밟고 지나가고 화분도 올라간다(납작해서 바닥으로 친다)
     ⚠ 벽 곁·구석도 화분이 놓일 수는 있다 — 그래서 **놓인 화분·옮긴 가구와 겹치면 소품이
       숨는다**(yieldTo). 판정·길찾기는 소품을 모른다(그림뿐). */
const PROPS = {
  banjiha: [
    { id: 'rug',     rug: true, x: -0.35, z: 0.78, w: 1.5, d: 1.0, yaw: 0 },
    { id: 'laundry', file: 'props/laundry.glb',     x: 1.70,  z: -1.50, yaw: 0,   h: 0.30 },
    { id: 'heater',  file: 'props/heater.glb',      x: -2.19, z: 0.52,  yaw: 90,  h: 0.50 },
    { id: 'trash',   file: 'props/trash.glb',       x: -2.21, z: 1.53,  yaw: 0,   h: 0.40 },
    { id: 'backpack',file: 'props/backpack.glb',    x: -0.72, z: 1.64,  yaw: 90,  h: 0.36 },
    { id: 'rack',    file: 'props/drying_rack.glb', x: -1.10, z: -1.42, yaw: 90,  h: 0.72 }
  ]
};

const LAYER = 1;
const deg = d => d * Math.PI / 180;

export function createFurnitureDress(opt = {}) {
  const T = globalThis.THREE;
  let on = v2Enabled('v2furn');
  const loadGLB = opt.loadGLB;
  const furnK = typeof opt.furnK === 'function' ? opt.furnK : () => 0.78;
  const onChange = typeof opt.onChange === 'function' ? opt.onChange : () => {};
  if (opt.cam && opt.cam.layers) opt.cam.layers.enable(LAYER);

  const tpl = new Map();        // file → { scene, box(yaw별), ok } · 한 번만 받는다
  const loading = new Map();    // file → Promise
  const measure = new Map();    // file|yaw|u|v → 높이 비율
  const origMat = new WeakMap();// 대리 메시 → 원래 재질
  const report = new Map();     // uid → 맞춤 결과(진단용)
  let hideMat = null, restyleMats = null, rugMat = null, rugTex = null;
  const rugGeo = new Map();
  let cur = { built: null, roomDef: null, parent: null, roomId: null };
  let propGroup = null, propList = [], propsWanted = false;
  let lastColliders = null, disposed = false;

  const hidden = () => hideMat || (hideMat = new T.MeshBasicMaterial({ visible: false }));

  /* ── GLB 받기 ── */
  function load(file) {
    if (tpl.has(file)) return Promise.resolve(tpl.get(file));
    if (loading.has(file)) return loading.get(file);
    let p;
    try {
      p = Promise.resolve(loadGLB(ASSET(file)));
    } catch (e) { p = Promise.reject(e); }
    p = p.then(scene => {
      scene.updateMatrixWorld(true);
      const t = { scene, ok: true, boxes: new Map() };
      tpl.set(file, t);
      return t;
    }).catch(e => {
      /* ⚠ console.error 금지 — 부팅 오류 0 을 재는 검사가 있다. 옷 없이 간다(옛 상자 그대로). */
      console.warn('[v2 가구] GLB 를 못 받았습니다 — 옛 모양으로 둡니다:', file, e && e.message);
      const t = { scene: null, ok: false, boxes: new Map() };
      tpl.set(file, t);
      return t;
    });
    loading.set(file, p);
    return p;
  }
  const furnFiles = () => [...new Set(Object.values(FURN).map(s => s.file))];
  const propFiles = id => [...new Set((PROPS[id] || []).filter(p => p.file).map(p => p.file))];
  const furnReady = () => furnFiles().every(f => tpl.has(f));

  /* 부팅 때 한 번 — 가구 옷을 기다린다(너무 오래면 옛 모양으로 먼저 뜨고 나중에 입는다) */
  function preload(ms = 4000) {
    if (!on || !loadGLB) return Promise.resolve(false);
    const all = Promise.all(furnFiles().map(load)).then(() => true);
    return Promise.race([all, new Promise(r => setTimeout(() => r(false), ms))]);
  }

  /* ── GLB 를 yaw 만큼 돌린 틀에서의 상자와 윗면 높이 ── */
  const _rc = () => { const r = new T.Raycaster(); r.layers.mask = 0xffffffff | 0; return r; };
  function yawBox(t, yaw) {
    if (t.boxes.has(yaw)) return t.boxes.get(yaw);
    const holder = new T.Group();
    const c = t.scene.clone(true);
    c.rotation.y = deg(yaw);
    holder.add(c);
    holder.updateMatrixWorld(true);
    const box = new T.Box3().setFromObject(holder);
    const rec = { box, holder };
    t.boxes.set(yaw, rec);
    return rec;
  }
  function topFrac(file, t, yaw, u, v) {
    const key = `${file}|${yaw}|${u.toFixed(3)}|${v.toFixed(3)}`;
    if (measure.has(key)) return measure.get(key);
    const { box, holder } = yawBox(t, yaw);
    const x = box.min.x + u * (box.max.x - box.min.x);
    const z = box.min.z + v * (box.max.z - box.min.z);
    const rc = _rc();
    rc.set(new T.Vector3(x, box.max.y + 1, z), new T.Vector3(0, -1, 0));
    const hit = rc.intersectObject(holder, true)[0];
    const f = hit ? (hit.point.y - box.min.y) / Math.max(1e-6, box.max.y - box.min.y) : null;
    measure.set(key, f);
    return f;
  }

  /* 대리 메시(옷이 아닌 것) 모두 */
  function proxiesOf(g) {
    const out = [];
    g.traverse(o => {
      if (!o.isMesh) return;
      for (let p = o; p && p !== g; p = p.parent) if (p.userData && p.userData.v2dress) return;
      out.push(o);
    });
    return out;
  }
  /* 대리의 윗면 높이(g 로컬) — 위에서 아래로 쏜다 */
  function proxyTop(g, proxies, lx, lz) {
    g.updateWorldMatrix(true, true);
    const from = g.localToWorld(new T.Vector3(lx, 5, lz));
    const rc = _rc();
    rc.set(from, new T.Vector3(0, -1, 0));
    const hit = rc.intersectObjects(proxies, false)[0];
    return hit ? g.worldToLocal(hit.point.clone()).y : null;
  }
  const median = a => { const s = a.filter(Number.isFinite).sort((x, y) => x - y);
                        return s.length ? s[(s.length - 1) >> 1] : null; };

  function presetOf(g, roomDef) {
    const fs = (roomDef && roomDef.furniture) || [];
    const u = g.userData || {};
    const byIdx = Number.isInteger(u.furnIdx) ? fs[u.furnIdx] : null;
    const f = (byIdx && (!byIdx.uid || byIdx.uid === u.uid)) ? byIdx : fs.find(x => x.uid === u.uid);
    return f ? f.preset : null;
  }

  /* ── 한 가구에 옷 입히기 ── */
  function dressOne(g, preset) {
    const spec = FURN[preset];
    if (!spec) return false;
    if (g.children.some(c => c.userData && c.userData.v2dress)) return true;     // 이미 입었다
    const t = tpl.get(spec.file);
    if (!t || !t.ok) return false;
    const size = g.userData.size || {};
    const w = size.w, d = size.d;
    if (!(w > 0 && d > 0)) return false;
    const proxies = proxiesOf(g);
    if (!proxies.length) return false;

    /* 세로 배율 — 자리(slots) 높이 또는 대리 윗면 = GLB 윗면 */
    const pts = [];
    const slots = Array.isArray(g.userData.slots) ? g.userData.slots : [];
    if (slots.length) for (const s of slots) pts.push({ u: (s.x + w / 2) / w, v: (s.z + d / 2) / d, y: s.y });
    else for (const [u, v] of (spec.probes || [[0.5, 0.5]]))
      pts.push({ u, v, y: proxyTop(g, proxies, -w / 2 + u * w, -d / 2 + v * d) });
    const { box } = yawBox(t, spec.yaw);
    const H = box.max.y - box.min.y;
    const ks = pts.map(p => {
      const f = topFrac(spec.file, t, spec.yaw, Math.min(0.98, Math.max(0.02, p.u)), Math.min(0.98, Math.max(0.02, p.v)));
      return (f && p.y > 0) ? p.y / (f * H) : NaN;
    });
    let sy = median(ks);
    if (!Number.isFinite(sy)) {                      // 못 쟀다 — 대리 상자 높이로
      const pb = new T.Box3(); for (const m of proxies) pb.expandByObject(m);
      g.updateWorldMatrix(true, true);
      sy = (pb.max.y - g.position.y) / H;
    }
    const sx = w / (box.max.x - box.min.x), sz = d / (box.max.z - box.min.z);

    const glb = t.scene.clone(true);
    glb.rotation.y = deg(spec.yaw);
    const mid = new T.Group();
    mid.add(glb);
    mid.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
    const dress = new T.Group();
    dress.name = 'v2dress';
    dress.userData.v2dress = true;
    dress.add(mid);
    dress.scale.set(sx, sy, sz);
    markVisual(dress);
    g.add(dress);

    /* 옷을 붙인 **뒤에** 대리를 숨긴다 — 순서를 바꾸면 한 프레임 비어 보인다 */
    const hm = hidden();
    for (const m of proxies) { if (!origMat.has(m)) origMat.set(m, m.material); m.material = hm; }

    /* 진단 — 자리마다 GLB 윗면이 얼마나 어긋나나(m) */
    dress.updateMatrixWorld(true);
    const errs = pts.map(p => {
      const f = topFrac(spec.file, t, spec.yaw, Math.min(0.98, Math.max(0.02, p.u)), Math.min(0.98, Math.max(0.02, p.v)));
      return f && Number.isFinite(p.y) ? +(f * H * sy - p.y).toFixed(4) : null;
    });
    report.set(g.userData.uid, { preset, file: spec.file, yaw: spec.yaw,
      scale: [+sx.toFixed(4), +sy.toFixed(4), +sz.toFixed(4)],
      height: +(H * sy).toFixed(3), targets: pts.map(p => p.y == null ? null : +p.y.toFixed(3)), topErr: errs });
    return true;
  }

  function markVisual(root) {
    root.traverse(o => {
      o.layers.set(LAYER);
      if (o.isMesh) {
        o.castShadow = true; o.receiveShadow = true;
        o.userData.shadowRole = 'blocker';
        o.userData.sharedGeometry = true;       // 캐시와 나눠 쓴다 — 치울 때 기하를 안 버린다
        o.userData.v2visual = true;
      }
    });
  }

  function restyleOne(g) {
    const st = RESTYLE[g.userData.type];
    if (!st) return false;
    if (!restyleMats) restyleMats = {};
    const key = g.userData.type;
    if (!restyleMats[key]) {
      const mk = hex => {
        const m = new T.MeshStandardMaterial({ color: new T.Color(hex).convertSRGBToLinear(),
                                               roughness: st.rough, metalness: st.metal });
        m.envMapIntensity = 0.25;
        return m;
      };
      restyleMats[key] = { board: mk(st.board), post: mk(st.post) };
    }
    const mats = restyleMats[key];
    g.traverse(o => {
      if (!o.isMesh || !o.material || Array.isArray(o.material)) return;
      if (o === g.userData.lampShade) return;
      const m = o.material;
      if (m.emissive && (m.emissive.r + m.emissive.g + m.emissive.b) > 0.001) return;   // 빛나는 부품은 그대로
      if (m.transparent && m.opacity < 0.95) return;
      if (!origMat.has(o)) origMat.set(o, m);
      /* 판(둥근 모서리 = ExtrudeGeometry)과 기둥·브래킷(원기둥·상자)을 가른다 */
      const isPost = !!(o.geometry && o.geometry.type !== 'ExtrudeGeometry');
      o.material = isPost ? mats.post : mats.board;
    });
    return true;
  }

  /* ── 방 전체 ── (assemble 이 dimRoomMaterials 바로 앞에서 부른다: 옷도 같이 눌린다) */
  function dress(built, roomDef) {
    cur.built = built; cur.roomDef = roomDef;
    report.clear();
    if (!on || !built || !built.furniture) return 0;
    let n = 0, missing = false;
    for (const g of built.furniture.children) {
      if (!g.userData || !g.userData.uid) continue;
      try {
        if (restyleOne(g)) { n++; continue; }
        const preset = presetOf(g, roomDef);
        if (!preset || !FURN[preset]) continue;
        if (dressOne(g, preset)) n++;
        else if (!tpl.has(FURN[preset].file)) missing = true;
      } catch (e) {
        console.warn('[v2 가구] 옷을 못 입혔습니다 —', g.userData.uid, e && e.message);
      }
    }
    /* 아직 못 받은 옷이 있으면 받는 대로 입히고 알린다(옛 방이면 안 입힌다) */
    if (missing) Promise.all(furnFiles().map(load)).then(() => {
      if (disposed || !on || cur.built !== built) return;
      dress(built, roomDef);
      onChange('furniture');
    });
    return n;
  }

  function undress(built) {
    if (!built || !built.furniture) return;
    for (const g of built.furniture.children) {
      for (const c of [...g.children]) if (c.userData && c.userData.v2dress) g.remove(c);
      g.traverse(o => { if (o.isMesh && origMat.has(o)) { o.material = origMat.get(o); origMat.delete(o); } });
    }
  }

  /* ── 소품 ── */
  function clearProps() {
    if (propGroup && propGroup.parent) propGroup.parent.remove(propGroup);
    propGroup = null; propList = [];
  }
  function dimProp(mat, k) {
    if (!mat || !mat.color) return;
    if (!mat.userData.__v2Base) mat.userData.__v2Base = mat.color.clone();
    mat.color.copy(mat.userData.__v2Base).multiplyScalar(k);
  }
  function makeRug(p) {
    if (!rugMat) {
      rugTex = new T.TextureLoader().load(ASSET('textures/rug.webp'), () => onChange('rug'),
        undefined, () => console.warn('[v2 가구] 러그 무늬를 못 받았습니다'));
      rugTex.encoding = T.sRGBEncoding;
      if (opt.renderer && opt.renderer.capabilities)
        rugTex.anisotropy = Math.min(4, opt.renderer.capabilities.getMaxAnisotropy());
      rugMat = new T.MeshStandardMaterial({ map: rugTex, roughness: 0.95, metalness: 0,
                                            polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    }
    const gk = p.w + 'x' + p.d;
    if (!rugGeo.has(gk)) rugGeo.set(gk, new T.PlaneGeometry(p.w, p.d));
    const m = new T.Mesh(rugGeo.get(gk), rugMat);
    m.userData.sharedGeometry = true;
    m.rotation.x = -Math.PI / 2;
    const r = new T.Group();
    r.add(m);
    r.position.set(p.x, 0.004, p.z);
    r.rotation.y = deg(p.yaw || 0);
    m.receiveShadow = true; m.castShadow = false;
    r.traverse(o => o.layers.set(LAYER));
    m.userData.v2visual = true;
    return { node: r, rect: { x: p.x, z: p.z, w: p.w, d: p.d, rot: deg(p.yaw || 0) }, flat: true };
  }
  function makeProp(p) {
    const t = tpl.get(p.file);
    if (!t || !t.ok) return null;
    const { box } = yawBox(t, p.yaw || 0);
    const k = p.h / (box.max.y - box.min.y);
    const glb = t.scene.clone(true);
    glb.rotation.y = deg(p.yaw || 0);
    const mid = new T.Group();
    mid.add(glb);
    mid.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
    const node = new T.Group();
    node.add(mid);
    node.scale.setScalar(k);
    node.position.set(p.x, 0, p.z);
    markVisual(node);
    return { node, rect: { x: p.x, z: p.z, w: (box.max.x - box.min.x) * k, d: (box.max.z - box.min.z) * k, rot: 0 } };
  }
  function props(parent, built, roomId) {
    cur.parent = parent; cur.roomId = roomId; cur.built = built;
    clearProps();
    propsWanted = on && !!PROPS[roomId];
    if (!propsWanted || !parent) return 0;
    propGroup = new T.Group();
    propGroup.name = 'v2props';
    propGroup.userData.v2dress = true;
    parent.add(propGroup);
    const k = furnK();
    const need = [];
    for (const p of PROPS[roomId]) {
      let made = null;
      if (p.rug) made = makeRug(p);
      else if (tpl.has(p.file)) made = makeProp(p);
      else { need.push(p.file); continue; }
      if (!made) continue;
      made.id = p.id;
      made.node.traverse(o => { if (o.isMesh) dimProp(o.material, k); });
      propGroup.add(made.node);
      propList.push(made);
    }
    applyYield();
    /* 소품은 부팅을 안 막는다 — 방이 뜬 뒤 천천히 받는다 */
    if (need.length) {
      const g0 = propGroup;
      setTimeout(() => Promise.all([...new Set(need)].map(load)).then(() => {
        if (disposed || !on || propGroup !== g0) return;
        props(parent, built, roomId);
        onChange('props');
      }), opt.propDelayMs ?? 1200);
    }
    return propList.length;
  }

  /* ── 비켜 주기 — 놓인 화분·가구와 겹치는 소품은 숨긴다(러그는 납작해 그대로) ── */
  /* 축정렬 반폭(가구 회전은 발자국 w·d 를 돌려서) */
  function extOf(r) {
    const c = Math.abs(Math.cos(r.rot || 0)), s = Math.abs(Math.sin(r.rot || 0));
    return [(r.w * c + r.d * s) / 2, (r.w * s + r.d * c) / 2];
  }
  function overlap(a, b, pad = 0.02) {
    const [ax, az] = extOf(a), [bx, bz] = extOf(b);
    return Math.abs(a.x - b.x) < ax + bx - pad && Math.abs(a.z - b.z) < az + bz - pad;
  }
  /* 가구 발자국이 소품을 **통째로** 품으면(책상 밑 빨래통) 일부러 둔 것이다 — 안 숨긴다 */
  function contains(o, r) {
    const [ox, oz] = extOf(o), [rx, rz] = extOf(r);
    return Math.abs(r.x - o.x) + rx <= ox + 1e-6 && Math.abs(r.z - o.z) + rz <= oz + 1e-6;
  }
  function applyYield() {
    if (!propList.length) return 0;
    const obs = [];
    /* 화분은 받은 목록에서, 가구는 **지금 방**의 충돌 목록에서(받은 목록은 옛 방일 수 있다) */
    for (const c of (lastColliders || [])) if (c && c.plant) obs.push(c);
    const b = cur.built;
    if (b && Array.isArray(b.colliders)) for (const c of b.colliders) if (c.kind === 'furn') obs.push(c);
    let hiddenN = 0;
    for (const p of propList) {
      const hit = !p.flat && obs.some(o => {
        const r = { x: o.x, z: o.z, w: o.w, d: o.d, rot: o.rot || 0 };
        return overlap(p.rect, r) && !(!o.plant && contains(r, p.rect));
      });
      p.node.visible = !hit;
      if (hit) hiddenN++;
    }
    return hiddenN;
  }
  function yieldTo(colliders) {
    lastColliders = colliders || null;
    const before = propList.map(p => p.node.visible).join();
    applyYield();
    return before !== propList.map(p => p.node.visible).join();
  }
  /* 접지 그림자 판에 얹을 소품 발자국(보이는 것만 · 러그 빼고) */
  function blobRects() {
    return propList.filter(p => !p.flat && p.node.visible).map(p => ({ ...p.rect }));
  }

  function setEnabled(v) {
    v = !!v;
    if (v === on) return on;
    on = v;
    if (!on) { undress(cur.built); clearProps(); }
    else {
      dress(cur.built, cur.roomDef);
      if (cur.parent) props(cur.parent, cur.built, cur.roomId);
    }
    onChange('toggle');
    return on;
  }

  const api = {
    get enabled() { return on; },
    furnReady, preload, dress, props, yieldTo, blobRects, setEnabled,
    set: setEnabled,
    report() {
      return { on, furniture: Object.fromEntries(report),
               props: propList.map(p => ({ id: p.id, visible: p.node.visible,
                 rect: Object.fromEntries(Object.entries(p.rect).map(([k, v]) => [k, +(+v).toFixed(3)])) })) };
    },
    dispose() {
      disposed = true;
      clearProps();
      if (rugTex) rugTex.dispose();
      if (rugMat) rugMat.dispose();
      for (const [, g] of rugGeo) g.dispose();
      rugGeo.clear();
    }
  };
  try { if (typeof window !== 'undefined') { window.__v2 = window.__v2 || {}; window.__v2.furn = api; } }
  catch (_) { /* 창 없음 */ }
  return api;
}
