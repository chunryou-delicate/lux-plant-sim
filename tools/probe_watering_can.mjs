/* ============================================================
   tools/probe_watering_can.mjs — 물뿌리개: GLB 판 vs 원기둥 판
   ------------------------------------------------------------
     python tools/serve.py 8971
     node tools/probe_watering_can.mjs

   왜 만들었나
     assets/props/watering_can.glb 가 들어왔다. 삼각형 12,170 개다. 방 전체가 7.6만이라
     손에 든 소품 하나가 16% 를 더 얹는다. **쓸지 말지는 화면에서 정해야 한다** —
     "고급 에셋이니까 좋겠지"로 정하면 폰에서 프레임을 잃고도 그림은 그대로다.

   무엇을 재나
     ① 두 판을 **같은 자리·같은 크기**로 놓고 나란히 찍는다(게임 크기 / 확대).
     ② 그릴 때의 삼각형·드로우콜을 판별로 잰다(renderer.info).
     ③ 방을 계속 돌리며 프레임 시간을 잰다(원기둥만 / GLB 만).
   결과는 docs/engine/shots/can_*.png 로 남긴다.
============================================================ */
import { launch, sleep } from './test_cdp.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.BYEOT_URL || 'http://localhost:8971';
const OUT = path.join(ROOT, 'docs', 'engine', 'shots');

/* room_view 의 fitCanAsset 과 **같은 규약**으로 다듬는다(크기 0.24m · 원점 밑면 가운데) */
const SETUP = `(async () => {
  const T = window.THREE, V = window.view, sc = V.three.scene;
  const LOOK = { color: 0x8fb6c9, roughness: 0.5, metalness: 0.15, flatShading: true };
  const mat = new T.MeshStandardMaterial(LOOK);
  const CAN_MAX = 0.24;

  function proc() {
    const g = new T.Group();
    const body = new T.Mesh(new T.CylinderGeometry(0.068, 0.078, 0.135, 12), mat);
    body.position.y = 0.068;
    const spout = new T.Mesh(new T.CylinderGeometry(0.013, 0.023, 0.175, 8), mat);
    spout.rotation.z = -Math.PI / 2 - 0.32; spout.position.set(0.105, 0.110, 0);
    const grip = new T.Mesh(new T.TorusGeometry(0.046, 0.011, 6, 12), mat);
    grip.rotation.y = Math.PI / 2; grip.position.set(-0.064, 0.106, 0);
    g.add(body, spout, grip);
    return g;
  }
  const glbScene = await new Promise((res, rej) => new T.GLTFLoader().load(
    '/assets/props/watering_can.glb', g => res(g.scene), undefined, e => rej(new Error('로드 실패'))));
  const box = new T.Box3().setFromObject(glbScene);
  const size = new T.Vector3(); box.getSize(size);
  const k = CAN_MAX / Math.max(size.x, size.y, size.z);
  const glb = new T.Group();
  glb.add(glbScene);
  glbScene.scale.multiplyScalar(k);
  glbScene.position.set(-(box.min.x + box.max.x) * 0.5 * k, -box.min.y * k,
                        -(box.min.z + box.max.z) * 0.5 * k);
  let tri = 0;
  glbScene.traverse(o => { if (o.isMesh) { o.material = mat; o.castShadow = true;
    tri += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; } });
  let ptri = 0;
  const P = proc();
  P.traverse(o => { if (o.isMesh) { o.castShadow = true;
    ptri += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; } });

  window.__CAN = { proc: P, glb, tri, ptri, size: { x: size.x, y: size.y, z: size.z }, k };
  return { glbTri: tri, procTri: ptri, rawSize: [+size.x.toFixed(3), +size.y.toFixed(3), +size.z.toFixed(3)],
           scale: +k.toFixed(3), fitted: [+(size.x*k).toFixed(3), +(size.y*k).toFixed(3), +(size.z*k).toFixed(3)] };
})()`;

/* 캐릭터 오른손 자리에 which 판을 놓는다. 'both' 면 좌우로 20cm 씩 벌려 나란히 놓는다. */
const PUT = w => `(() => {
  const V = window.view, sc = V.three.scene, C = window.__CAN;
  for (const g of [C.proc, C.glb]) if (g.parent) g.parent.remove(g);
  const c = V.characters().find(x => x.id === 'jachwi');
  const h = { x: c.pos.x, y: 0.95, z: c.pos.z };
  const put = (g, dx) => { g.position.set(h.x + dx, h.y, h.z); g.rotation.set(0, 0, -0.7); sc.add(g); };
  if (${JSON.stringify(w)} === 'proc') put(C.proc, 0);
  else if (${JSON.stringify(w)} === 'glb') put(C.glb, 0);
  else { put(C.proc, -0.16); put(C.glb, 0.16); }
  V.redraw();
  return 1; })()`;

const MEASURE = `(() => { const V = window.view; V.redraw();
  const s = V.stats(); return { triangles: s.triangles, calls: s.calls }; })()`;

/* 60프레임을 강제로 그려 프레임 시간을 잰다(그리기 비용만 본다 — rAF 상한과 무관하게) */
const FRAMES = `(async () => { const V = window.view; const t = [];
  for (let i = 0; i < 60; i++) { const a = performance.now(); V.redraw(); t.push(performance.now() - a); }
  t.sort((p, q) => p - q);
  return { med: +t[30].toFixed(2), p90: +t[54].toFixed(2), max: +t[59].toFixed(2) }; })()`;

async function main() {
  const page = await launch({ width: 390, height: 844, dpr: 2, mobile: false });
  page.on((m, p) => { if (m === 'Runtime.exceptionThrown') console.log('EX ' + p.exceptionDetails.text); });
  await page.goto(`${BASE}/tools/room_view_demo.html?room=banjiha&t=0.42`);
  await page.waitFor('!!window.view', 180000, 200);
  await page.eval(`window.view.setCharacter('jachwi').then(()=>1)`);
  await sleep(1200);

  const info = await page.eval(SETUP);
  console.log('■ 실측');
  console.log(`  GLB 원본 크기 ${info.rawSize.join(' × ')} m → ${info.scale} 배로 줄여 ${info.fitted.join(' × ')} m`);
  console.log(`  삼각형  GLB ${info.glbTri}  ·  원기둥 ${info.procTri}   (${(info.glbTri / info.procTri).toFixed(0)}배)`);

  await page.eval(PUT('proc'));
  const base = await page.eval(MEASURE);
  const fProc = await page.eval(FRAMES);
  await page.eval(PUT('glb'));
  const withGlb = await page.eval(MEASURE);
  const fGlb = await page.eval(FRAMES);
  console.log('■ 그릴 때');
  console.log(`  원기둥  삼각형 ${base.triangles}  드로우콜 ${base.calls}  프레임 중앙 ${fProc.med}ms p90 ${fProc.p90}ms`);
  console.log(`  GLB     삼각형 ${withGlb.triangles}  드로우콜 ${withGlb.calls}  프레임 중앙 ${fGlb.med}ms p90 ${fGlb.p90}ms`);
  console.log(`  차이    삼각형 +${withGlb.triangles - base.triangles}  프레임 ${(fGlb.med - fProc.med).toFixed(2)}ms`);

  /* ── 그림 ── 게임 크기(폰 세로 전경) 한 장, 확대 한 장 */
  await page.eval(PUT('both'));
  await sleep(300);
  console.log('  ' + await page.shot(path.join(OUT, 'can_game.png')));

  /* ── 화면에서 몇 px 인가 ── 이 숫자가 "삼각형을 더 얹을 값어치가 있나"를 가른다 */
  const PX = `(() => {
    const T = window.THREE, V = window.view, C = window.__CAN;
    const cam = V.three.cam, cv = V.three.renderer.domElement;
    const w = cv.clientWidth, h = cv.clientHeight;
    const box = new T.Box3().setFromObject(C.glb);
    const p = new T.Vector3(), lo = [1e9, 1e9], hi = [-1e9, -1e9];
    for (let i = 0; i < 8; i++) {
      p.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z);
      p.project(cam);
      const sx = (p.x * 0.5 + 0.5) * w, sy = (-p.y * 0.5 + 0.5) * h;
      lo[0] = Math.min(lo[0], sx); hi[0] = Math.max(hi[0], sx);
      lo[1] = Math.min(lo[1], sy); hi[1] = Math.max(hi[1], sy);
    }
    return { w: +(hi[0] - lo[0]).toFixed(1), h: +(hi[1] - lo[1]).toFixed(1) }; })()`;
  await page.eval(PUT('glb'));
  const pxRoom = await page.eval(PX);
  /* 자리로 들어가 제일 가까이 당긴다 — 이 화면이 물뿌리개가 제일 크게 보이는 순간이다 */
  const slot = await page.eval(`(()=>{ const s = window.view.slots()[0]; return s ? s.slotId : null; })()`);
  await page.eval(`window.view.focusSlot(${JSON.stringify(slot)}, true) || 1`);
  await sleep(600);
  /* 확대한 자리 **바로 옆**(사람이 서서 물을 붓는 자리)에 놓고 잰다 */
  await page.eval(`(()=>{ const V = window.view, C = window.__CAN;
    for (const g of [C.proc, C.glb]) if (g.parent) g.parent.remove(g);
    const t = V.resolveKey(${JSON.stringify(slot)});
    C.glb.position.set(t.pos.x, t.pos.y + 0.30, t.pos.z);
    C.glb.rotation.set(0, 0, -0.7);
    V.three.scene.add(C.glb); V.redraw(); return 1; })()`);
  const pxFocus = await page.eval(PX);
  console.log('■ 화면에서 (폰 세로 390×844 CSS px)');
  console.log(`  방 전경   ${pxRoom.w} × ${pxRoom.h} px`);
  console.log(`  자리 확대 ${pxFocus.w} × ${pxFocus.h} px`);
  await page.eval(`window.view.focusSlot(null, true) || 1`);
  await sleep(600);

  /* ── ★플레이어가 **실제로** 보는 크기로 견주기 ──
     방 카메라에서 손 언저리만 오려 6배로 늘려 나란히 붙인다. 왼쪽 원기둥 · 오른쪽 GLB.
     여기서 차이가 안 보이면, 삼각형 1.2만은 아무도 못 보는 데 쓰는 값이다. */
  await page.eval(`(() => {
    const V = window.view, C = window.__CAN, src = V.three.renderer.domElement;
    const c = V.characters().find(x => x.id === 'jachwi');
    const cam = V.three.cam, T = window.THREE;
    /* 캐릭터에서 카메라 쪽으로 0.45m 앞, 손 높이 — 물뿌리개가 몸에 안 묻히는 자리 */
    const dir = new T.Vector3(cam.position.x - c.pos.x, 0, cam.position.z - c.pos.z).normalize();
    const at = new T.Vector3(c.pos.x + dir.x * 0.45, 0.92, c.pos.z + dir.z * 0.45);
    const p = at.clone().project(cam);
    const dpr = src.width / src.clientWidth;
    const cx = (p.x * 0.5 + 0.5) * src.width, cy = (-p.y * 0.5 + 0.5) * src.height;
    const R = 30 * dpr, Z = 8;
    const cv = document.createElement('canvas');
    cv.width = 2 * R * Z; cv.height = R * Z;
    cv.style.cssText = 'position:fixed;left:0;top:0;width:390px;height:195px;z-index:99999;image-rendering:pixelated';
    document.body.appendChild(cv);
    const g2 = cv.getContext('2d');
    g2.imageSmoothingEnabled = false;
    const grab = (which, dx) => {
      for (const g of [C.proc, C.glb]) if (g.parent) g.parent.remove(g);
      const g = which === 'proc' ? C.proc : C.glb;
      g.position.copy(at); g.rotation.set(0, Math.atan2(-dir.z, dir.x) + Math.PI, -0.7);
      V.three.scene.add(g);
      V.redraw();
      g2.drawImage(src, cx - R / 2, cy - R / 2, R, R, dx, 0, R * Z, R * Z);
    };
    grab('proc', 0);
    grab('glb', R * Z);
    return 1; })()`);
  await sleep(300);
  console.log('  ' + await page.shot(path.join(OUT, 'can_real.png')));

  /* ── 모양 견주기 ──
     방 카메라는 물뿌리개를 10px 로 그린다 — 그림으로는 아무것도 못 가린다.
     그래서 **따로 한 장 그린다**: 같은 재질·같은 빛으로 두 판을 크게 나란히. */
  await page.eval(`(() => {
    const T = window.THREE, C = window.__CAN;
    const cv = document.createElement('canvas');
    cv.width = 780; cv.height = 1560;
    cv.style.cssText = 'position:fixed;left:0;top:0;width:390px;height:780px;z-index:99999';
    document.body.appendChild(cv);
    const r = new T.WebGLRenderer({ canvas: cv, antialias: true });
    r.setPixelRatio(2); r.setSize(390, 780, false);
    r.setClearColor(0x2b2f36, 1);
    const s = new T.Scene();
    s.add(new T.HemisphereLight(0xdfe9f2, 0x3a3f46, 1.1));
    const d = new T.DirectionalLight(0xffffff, 1.2); d.position.set(1.2, 2.0, 1.6); s.add(d);
    for (const g of [C.proc, C.glb]) if (g.parent) g.parent.remove(g);
    /* 맨 왼쪽이 원기둥 판(주둥이가 로컬 +X). 그 오른쪽 넷은 GLB 를 90°씩 돌린 것이다 —
       **주둥이가 어느 축을 보는지** 눈으로 잡으려고 그린다(이름 있는 노드가 없어 못 묻는다).
       빨간 점이 로컬 +X = 쓸 때 화분을 겨누는 쪽이다. */
    const mark = g => { const m = new T.Mesh(new T.SphereGeometry(0.012, 8, 6),
      new T.MeshBasicMaterial({ color: 0xff4444 }));
      m.position.set(0.13, 0.13, 0); g.add(m); return m; };
    mark(C.proc);
    C.proc.position.set(-0.17, 0.28, 0); C.proc.rotation.set(0, 0, 0);
    s.add(C.proc);
    /* 2×2 로 GLB 를 90°씩 돌려 놓는다(왼쪽 위 = 원기둥 판, 그 오른쪽부터 0°·90°·180°·270°) */
    const at = [[0.17, 0.28], [-0.17, 0.0], [0.17, 0.0], [-0.17, -0.28]];
    for (let i = 0; i < 4; i++) {
      const g = C.glb.clone(true);
      mark(g);
      g.position.set(at[i][0], at[i][1] - 0.11, 0);
      g.rotation.set(0, i * Math.PI / 2, 0);
      s.add(g);
    }
    const cam = new T.PerspectiveCamera(26, 390 / 780, 0.05, 10);
    cam.position.set(0, 0.05, 1.9); cam.lookAt(0, 0, 0);
    r.render(s, cam);
    return 1; })()`);
  await sleep(300);
  console.log('  ' + await page.shot(path.join(OUT, 'can_zoom.png')));

  await page.close();
}
main().catch(e => { console.error(e); process.exit(1); });
