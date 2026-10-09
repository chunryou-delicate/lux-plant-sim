/* ============================================================
   tools/probe_dress_fit.mjs — v2 옷(GLB)이 코드 가구에 맞게 입혀지나 ([house] · 2026-10-09)
   ------------------------------------------------------------
     BYEOT_URL=http://127.0.0.1:9330 SHOT=out.png node tools/probe_dress_fit.mjs sofa wardrobe shelf_cart_3tier ...
   게임과 같은 판: furniture_pastel buildFurniture(프리셋) → furniture_dress dress() → report()
   재는 것: ① 자리(slots)·대리 윗면 높이에서 GLB 윗면이 얼마나 어긋나나(topErr · m) ② 배율(sx·sy·sz) — 세로만 따로 늘면 찌그러짐
            ③ (SHOT) 코드 가구 | 옷 입은 것을 같은 카메라·같은 픽셀로 나란히(렌더 확인은 같은 크기로)
   ⚠ 헤드리스 크롬 하나 · 여유 램 4GB 밑이면 기다린다(총괄 10-08 규칙)
============================================================ */
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { launch, sleep } from './test_cdp.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9330';
const IDS = process.argv.slice(2);
if (!IDS.length) { console.error('프리셋 id 를 주세요'); process.exit(1); }
const TILE = 420;

const page = await launch({ width: TILE, height: TILE, dpr: 1 });
let out;
try {
  await page.goto(`${BASE}/data/house_rooms.json`); await sleep(1200);
  await page.eval(`new Promise((ok, no) => { document.documentElement.innerHTML = '<head></head><body style="margin:0;background:#fff"></body>';
    const s = document.createElement('script'); s.src = '/vendor/three/three.min.js'; s.onerror = no;
    s.onload = () => { const l = document.createElement('script'); l.src = '/vendor/three/GLTFLoader.js'; l.onload = ok; l.onerror = no; document.head.appendChild(l); };
    document.head.appendChild(s); })`);
  out = await page.eval(`(async () => {
    const T = window.THREE;
    const warns = []; const _w = console.warn; console.warn = (...a) => { warns.push(a.map(String).join(' ').slice(0, 200)); _w(...a); };
    const { buildFurniture } = await import('/src/render3d/furniture_pastel.js');
    const { createFurnitureDress } = await import(${JSON.stringify(process.env.DRESS_MOD || '/src/render3d/furniture_dress.js')});   // DRESS_MOD: 작업 전 판과 나란히
    const P = (await (await fetch('/data/furniture_presets.json')).json()).presets;
    const arr = Array.isArray(P) ? P : Object.entries(P).map(([k, v]) => ({ id: k, ...v }));
    const ids = ${JSON.stringify(IDS)};
    const ren = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    ren.setPixelRatio(1); ren.setSize(${TILE}, ${TILE}); ren.outputEncoding = T.sRGBEncoding;
    const scene = new T.Scene(); scene.background = new T.Color('#ffffff');
    scene.add(new T.HemisphereLight(0xffffff, 0x8a8478, 0.8));
    const sun = new T.DirectionalLight(0xffffff, 0.9); sun.position.set(2, 4, 3); scene.add(sun);
    const cam = new T.OrthographicCamera(-1, 1, 1, -1, 0.01, 100);
    const furniture = new T.Group(); scene.add(furniture);
    const roomDef = { furniture: [] };
    const gs = ids.map((id, i) => {
      const p = arr.find(x => x.id === id); if (!p) return null;
      const g = buildFurniture(p.type, { ...p, ...(p.size_m || {}) });
      g.userData.uid = 'fit-' + i; g.userData.furnIdx = i; g.position.x = i * 3; furniture.add(g);
      roomDef.furniture.push({ uid: g.userData.uid, preset: id }); return g;
    });
    const built = { furniture };
    const loader = new T.GLTFLoader();
    let changed = null; const waitChange = () => new Promise(r => { changed = r; });
    const D = createFurnitureDress({ cam, loadGLB: url => new Promise((ok, no) => loader.load(url, g => ok(g.scene), undefined, no)),
      propDelayMs: 0, onChange: () => changed && changed() });
    /* 한 점씩 찍는다 — 그 가구만 보이게, 상자에 맞춰 */
    const view = new T.Vector3(0.75, 0.62, 1).normalize();
    const camOf = [];
    const shot = (g, i) => {
      for (const o of furniture.children) o.visible = (o === g);
      if (!camOf[i]) {                                   // 첫 찍기(코드)의 상자로 카메라를 정하고, 옷 입은 뒤에도 그대로 쓴다
        const box = new T.Box3(); g.updateMatrixWorld(true); box.expandByObject(g);
        const c = box.getCenter(new T.Vector3()), R = box.getSize(new T.Vector3()).length();
        cam.position.copy(c).addScaledVector(view, R * 3); cam.lookAt(c); cam.updateMatrixWorld(true);
        let m = 0; const v = new T.Vector3();
        for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
          v.set(x, y, z).applyMatrix4(cam.matrixWorldInverse); m = Math.max(m, Math.abs(v.x), Math.abs(v.y)); }
        camOf[i] = { p: cam.position.clone(), c, m: m * 1.15 };
      }
      const k = camOf[i]; cam.position.copy(k.p); cam.lookAt(k.c);
      Object.assign(cam, { left: -k.m, right: k.m, top: k.m, bottom: -k.m }); cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
      ren.render(scene, cam); return ren.domElement.toDataURL('image/png');
    };
    const before = gs.map((g, i) => g && shot(g, i));
    let n = D.dress(built, roomDef);
    /* ⚠ 다시 dress() 를 부르지 않는다 — dress 는 report 를 비우고, 이미 입은 것은 «입었다»만 하고 안 적는다. 받는 대로 옷 층이 스스로 입힌다 */
    for (let k = 0; k < 6 && Object.keys(D.report().furniture).length < gs.filter(Boolean).length; k++)
      await Promise.race([waitChange(), new Promise(r => setTimeout(r, 5000))]);
    const rep = D.report().furniture;
    /* ④ 옷이 발자국(충돌·길 = userData.size) 밖으로 얼마나 나가나(m · 앞+Z 뒤−Z 좌−X 우+X) — 캐릭터가 «그림을 뚫고» 지나갈 수 있는 폭 */
    const over = gs.map(g => { if (!g) return null; const dz = g.children.find(c => c.userData && c.userData.v2dress); if (!dz) return null;
      g.updateMatrixWorld(true); const inv = new T.Matrix4().copy(g.matrixWorld).invert(), b = new T.Box3(), mb = new T.Box3(), m4 = new T.Matrix4();
      dz.traverse(o => { if (!o.isMesh) return; if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); m4.multiplyMatrices(inv, o.matrixWorld); b.union(mb.copy(o.geometry.boundingBox).applyMatrix4(m4)); });
      const s = g.userData.size || {}; const r = v => +Math.max(0, v).toFixed(3);
      return { front: r(b.max.z - s.d / 2), back: r(-s.d / 2 - b.min.z), left: r(-s.w / 2 - b.min.x), right: r(b.max.x - s.w / 2) }; });
    const after = gs.map((g, i) => g && shot(g, i));
    return { n, rep, before, after, warns, over };
  })()`);
} finally { await page.close(); }

if (out.warns && out.warns.length) console.log('경고', [...new Set(out.warns)].slice(0, 8));
for (const [i, id] of IDS.entries()) {
  const r = out.rep['fit-' + i];
  if (r && out.over && out.over[i]) { const o = out.over[i], mx = Math.max(o.front, o.back, o.left, o.right); r._over = mx > 0.03 ? `  ⚠ 발자국 밖 ${JSON.stringify(o)}` : ''; }
  if (!r) { console.log(`✘ ${id.padEnd(20)} 옷 없음(FURN 에 없거나 GLB 를 못 받음)`); continue; }
  const errs = (r.topErr || []).filter(Number.isFinite), worst = errs.length ? Math.max(...errs.map(Math.abs)) : null;
  const [sx, sy, sz] = r.scale, squash = +(sy / ((sx + sz) / 2)).toFixed(2);
  /* 겹단은 세로 배율이 1(꺾은 선) — 구간마다 늘임 비(방 m ÷ GLB 단위)를 가로 배율과 견준다 */
  const seg = r.tiers ? r.tiers.slice(1).map((k, j) => +(((k[1] - r.tiers[j][1]) / (k[0] - r.tiers[j][0])) / ((sx + sz) / 2)).toFixed(2)) : null;
  /* 균일 배율(uniform) 옷은 세로를 자리에 안 맞춘다 — 오차를 판정하지 않는다(·) */
  if (r.lamp) { console.log(`${worst > 0.01 || r.fellBack ? '✘' : '✔'} ${id.padEnd(20)} ${r.file.padEnd(32)} yaw ${String(r.yaw).padEnd(3)} 높이 ${r.height}  LED ${JSON.stringify(r.targets)}  머리−LED(x,y,z) ${JSON.stringify(r.topErr)}  배율 ${JSON.stringify(r.scale)}  받침 비킴 ${JSON.stringify(r.baseShift)}${r.fellBack ? '  ⚠ 고르게(머리 방향 안 맞음)' : ''}${r._over || ''}`); continue; }
  console.log(`${r.uniform ? '·' : worst == null || worst > 0.02 ? '✘' : '✔'} ${id.padEnd(20)} ${r.file.padEnd(32)} yaw ${String(r.yaw).padEnd(3)} 높이 ${r.height}  자리 ${JSON.stringify(r.targets)}  윗면 오차 ${JSON.stringify(r.topErr)}  ${seg ? '구간 세로/가로 ' + JSON.stringify(seg) : '세로/가로 배율 ' + squash}${r._over || ''}`);
}
if (process.env.SHOT) {
  const dir = fs.mkdtempSync(path.join(path.dirname(process.env.SHOT), '.fit-'));
  const files = [];
  IDS.forEach((id, i) => { for (const [k, arr] of [['a', out.before], ['b', out.after]]) {
    if (!arr[i]) continue; const f = path.join(dir, `${i}_${k}.png`); fs.writeFileSync(f, Buffer.from(arr[i].split(',')[1], 'base64')); files.push(f); } });
  /* 두 장씩 한 줄 — 왼쪽 코드 · 오른쪽 옷(같은 카메라) */
  execFileSync('python', ['-I', '-c', `
import sys, glob, os
from PIL import Image, ImageDraw
d, out, ids = sys.argv[1], sys.argv[2], sys.argv[3].split(',')
T = ${TILE}
rows = [i for i in range(len(ids)) if os.path.exists(os.path.join(d, f'{i}_a.png'))]
sheet = Image.new('RGB', (T * 2, T * len(rows) + 1), 'white'); dr = ImageDraw.Draw(sheet)
for r, i in enumerate(rows):
    for c, k in enumerate('ab'):
        p = os.path.join(d, f'{i}_{k}.png')
        if os.path.exists(p): sheet.paste(Image.open(p).convert('RGB'), (c * T, r * T))
    dr.text((6, r * T + 6), ids[i] + '  code | v2', fill=(200, 0, 0))
    dr.line([(0, r * T), (2 * T, r * T)], fill=(180, 180, 180))
sheet.save(out)
`, dir, process.env.SHOT, IDS.join(',')]);
  for (const f of files) fs.unlinkSync(f); fs.rmdirSync(dir);
  console.log('사진', process.env.SHOT);
}
