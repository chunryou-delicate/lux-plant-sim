/* ============================================================
   tools/shot_furn_thumbs.mjs — 가구점 줄 그림 ([house] · 2026-10-09 · 총괄 D39 B)
   ------------------------------------------------------------
     BYEOT_URL=http://127.0.0.1:9330 node tools/shot_furn_thumbs.mjs [프리셋…]   (안 주면 가구점 줄 전부 — furnitureCatalogList)
   왜: 가구점 줄이 글뿐이라 사기 전에 무엇이 오는지 안 보인다. 방에 놓였을 때와 **같은 모습**으로 찍는다 —
       v2 옷이 있으면 옷(색 변형은 몸 색까지), 없으면 코드 가구 그대로(게임이 그렇게 그린다).
   판: furniture_pastel buildFurniture → furniture_dress dress()(게임과 같은 판) · 평행 투영 · 앞-오른쪽 위(앞이 왼쪽 아래) · 투명 바탕
   나오는 것: assets/v2/thumbs/furn/<프리셋>.webp (192² · 투명) + index.json { 프리셋: { file, v2, tint? } }
   ⚠ 헤드리스 크롬 하나 · 여유 램 4GB 밑이면 기다린다(총괄 10-08 규칙)
============================================================ */
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath, pathToFileURL } from 'node:url';
import { launch, sleep } from './test_cdp.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9330';
const OUT = path.join(ROOT, 'assets/v2/thumbs/furn');
const SIZE = 192;
const shop = await import(pathToFileURL(path.join(ROOT, 'src/game/shop.js')).href);
const P = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/furniture_presets.json'), 'utf8')).presets;
const arr = Array.isArray(P) ? P : Object.entries(P).map(([id, v]) => ({ id, ...v }));
/* ★ 가구점 줄 = shop.furnitureCatalogList(해금 뒤) 그대로 — «가구» 갈래만(가전·조명·붙박이·교실은 안 판다).
     ⚠ 10-09 처음엔 listed 표지만 봐서 119점(가전 TV·주방 카운터까지)을 찍고 «가구점 전부»라 적었다 — 틀렸다(83줄). */
const CATALOG = shop.furnitureCatalogList({ tutorial: { enabled: true, lamp: { unlocked: true } } }).map(it => it.preset);
const IDS = process.argv.slice(2).length ? process.argv.slice(2) : CATALOG;
fs.mkdirSync(OUT, { recursive: true });

const page = await launch({ width: SIZE, height: SIZE, dpr: 1 });
const index = {};
try {
  await page.goto(`${BASE}/data/house_rooms.json`); await sleep(1200);
  await page.eval(`new Promise((ok, no) => { document.documentElement.innerHTML = '<head></head><body style="margin:0"></body>';
    const s = document.createElement('script'); s.src = '/vendor/three/three.min.js'; s.onerror = no;
    s.onload = () => { const l = document.createElement('script'); l.src = '/vendor/three/GLTFLoader.js'; l.onload = ok; l.onerror = no; document.head.appendChild(l); };
    document.head.appendChild(s); })`);
  await page.eval(`(async () => {
    const T = window.THREE;
    const { buildFurniture } = await import('/src/render3d/furniture_pastel.js');
    const { createFurnitureDress } = await import('/src/render3d/furniture_dress.js');
    const P = (await (await fetch('/data/furniture_presets.json')).json()).presets;
    const arr = Array.isArray(P) ? P : Object.entries(P).map(([k, v]) => ({ id: k, ...v }));
    const map = Object.fromEntries(arr.map(x => [x.id, x]));
    const ren = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    ren.setPixelRatio(1); ren.setSize(${SIZE}, ${SIZE}); ren.outputEncoding = T.sRGBEncoding; ren.setClearColor(0x000000, 0);
    const scene = new T.Scene();
    scene.add(new T.HemisphereLight(0xffffff, 0x8a8478, 0.85));
    const sun = new T.DirectionalLight(0xffffff, 0.85); sun.position.set(2, 4, 3); scene.add(sun);
    const cam = new T.OrthographicCamera(-1, 1, 1, -1, 0.01, 100);
    const furniture = new T.Group(); scene.add(furniture);
    const loader = new T.GLTFLoader();
    let changed = null;
    const D = createFurnitureDress({ cam, loadGLB: url => new Promise((ok, no) => loader.load(url, g => ok(g.scene), undefined, no)),
      propDelayMs: 0, onChange: () => changed && changed(), presets: () => map });
    window.__thumb = async (id) => {
      while (furniture.children.length) furniture.remove(furniture.children[0]);
      const p = map[id]; if (!p) return null;
      const g = buildFurniture(p.type, { ...p, ...(p.size_m || {}) });
      g.userData.uid = 'th'; g.userData.furnIdx = 0; furniture.add(g);
      const roomDef = { furniture: [{ uid: 'th', preset: id }] }, built = { furniture };
      D.dress(built, roomDef);
      const want = D.hasDress(id);              // 옷이 없는 프리셋은 기다리지 않는다(코드 가구 그대로)
      for (let k = 0; want && k < 8 && !g.children.some(c => c.userData && c.userData.v2dress); k++) {
        await Promise.race([new Promise(r => { changed = r; }), new Promise(r => setTimeout(r, 1500))]);
        if (!g.children.some(c => c.userData && c.userData.v2dress)) D.dress(built, roomDef);
      }
      const dressed = g.children.find(c => c.userData && c.userData.v2dress);
      /* 보이는 것만으로 상자 — 옷을 입었으면 옷, 아니면 코드 가구 */
      g.updateMatrixWorld(true);
      const box = new T.Box3();
      g.traverse(o => { if (o.isMesh && o.visible && !(o.material && o.material.visible === false)) box.expandByObject(o); });
      if (box.isEmpty()) box.setFromObject(g);
      const c = box.getCenter(new T.Vector3()), R = box.getSize(new T.Vector3()).length() || 1;
      const view = new T.Vector3(0.75, 0.62, 1).normalize();
      cam.position.copy(c).addScaledVector(view, R * 3); cam.lookAt(c); cam.updateMatrixWorld(true);
      let m = 0; const v = new T.Vector3();
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
        v.set(x, y, z).applyMatrix4(cam.matrixWorldInverse); m = Math.max(m, Math.abs(v.x), Math.abs(v.y)); }
      m *= 1.08; Object.assign(cam, { left: -m, right: m, top: m, bottom: -m }); cam.updateProjectionMatrix();
      ren.render(scene, cam);
      const r = D.report().furniture.th || {};
      return { url: ren.domElement.toDataURL('image/webp', 0.9), v2: !!dressed, tint: r.tint || null, base: r.base || null };
    };
  })()`);
  /* ★ 2026-10-10 — 칠한 카드(painted · Higgsfield 로 기준 결에 맞춰 다시 칠한 것)는 덮어쓰지 않는다. FORCE=1 이면 다시 찍는다 */
  const prevTop = fs.existsSync(path.join(OUT, 'index.json')) ? JSON.parse(fs.readFileSync(path.join(OUT, 'index.json'), 'utf8')) : {};
  for (const id of IDS) {
    if (prevTop[id] && prevTop[id].painted && process.env.FORCE !== '1') { console.log('· 칠한 카드 그대로', id); continue; }
    const r = await page.eval(`window.__thumb(${JSON.stringify(id)})`);
    if (!r || !String(r.url).startsWith('data:image/webp')) { console.log('✘', id); continue; }
    fs.writeFileSync(path.join(OUT, `${id}.webp`), Buffer.from(r.url.split(',')[1], 'base64'));
    index[id] = { file: `assets/v2/thumbs/furn/${id}.webp`, v2: r.v2, ...(r.tint ? { tint: r.tint, base: r.base } : {}) };
  }
} finally { await page.close(); }
const prev0 = fs.existsSync(path.join(OUT, 'index.json')) ? JSON.parse(fs.readFileSync(path.join(OUT, 'index.json'), 'utf8')) : {};
/* 가구점에 없는 것은 목록·파일에서 걷는다(옛 판에 찍힌 가전·조명 등) */
const prev = Object.fromEntries(Object.entries(prev0).filter(([k]) => k.startsWith('_') || CATALOG.includes(k)));
for (const f of fs.readdirSync(OUT)) { const id = f.replace(/\.webp$/, ''); if (f.endsWith('.webp') && !CATALOG.includes(id) && !IDS.includes(id)) fs.unlinkSync(path.join(OUT, f)); }
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify({ _what: '가구점 줄 그림([house] tools/shot_furn_thumbs.mjs) · v2=옷 입은 모습 · 아니면 코드 가구', ...prev, ...index }, null, 1) + '\n');
const n = Object.keys(index).length, nv = Object.values(index).filter(x => x.v2).length;
console.log(`찍음 ${n} · v2 옷 ${nv} · 코드 ${n - nv} → ${path.relative(ROOT, OUT).replace(/\\/g, '/')}`);
