/* ============================================================
   tools/shot_furn_ref.mjs — 게임 안 «코드 가구»를 원화 참조 그림으로 찍는다 ([house] · 2026-10-09)
   ------------------------------------------------------------
     BYEOT_URL=http://127.0.0.1:9330 node tools/shot_furn_ref.mjs plant_step_3 shelf_ladder_4tier greenhouse_cabinet win_studio_cross
   왜: Meshy 원화가 단 높이·단 수·살 굵기를 글로 시켜서는 두 번 다 안 맞았다(총괄 r2 검수 10-09).
       ⇒ 지금 자리(slots)가 맞는 코드 가구를 원화와 같은 각도·흰 바탕으로 찍어 «이 모양 그대로, 칠만 기준 그림처럼»의 참조로 넣는다.
   찍는 것: furniture_pastel buildFurniture(프리셋) · 창은 window_frame buildWindowFrame(방 정의 그대로 · 유리 없음)
     · 평행 투영(원화가 등각 그림이라) · 앞면(+Z)이 왼쪽 아래를 보게(주문표 앞머리와 같은 쪽) · 창은 거의 정면
     · 온실장은 유리를 뺀다(주문표 5 «틀만»)
   나오는 것: assets/gen/v2_furn/ref_<이름>.png (1024² · 원료 폴더 — 게임이 안 부른다)
   ⚠ 헤드리스 크롬 하나 · 여유 램 4GB 밑이면 기다린다(총괄 10-08 규칙)
============================================================ */
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { launch, sleep } from './test_cdp.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9330';
const OUT = process.env.OUT || path.join(ROOT, 'assets/gen/v2_furn');
const IDS = process.argv.slice(2);
if (!IDS.length) { console.error('찍을 프리셋 id 를 주세요'); process.exit(1); }
const SIZE = 1024;

const page = await launch({ width: SIZE, height: SIZE, dpr: 1 });
try {
  await page.goto(`${BASE}/data/house_rooms.json`); await sleep(1200);   // 같은 출처 문서 하나 — 그 위에 판을 새로 깐다
  await page.eval(`new Promise((ok, no) => { document.documentElement.innerHTML = '<head></head><body style="margin:0;background:#fff"></body>';
    const s = document.createElement('script'); s.src = '/vendor/three/three.min.js'; s.onload = ok; s.onerror = no; document.head.appendChild(s); })`);
  for (const id of IDS) {
    const url = await page.eval(`(async () => {
      const T = window.THREE;
      const { buildFurniture } = await import('/src/render3d/furniture_pastel.js');
      const { buildWindowFrame } = await import('/src/render3d/window_frame.js');
      const furn = (await (await fetch('/data/furniture_presets.json')).json()).presets;
      const rooms = (await (await fetch('/data/house_rooms.json')).json()).rooms;
      const wins = (await (await fetch('/data/window_presets.json')).json()).presets;
      const id = ${JSON.stringify(id)};
      let g = null, isWin = false;
      const arr = Array.isArray(furn) ? furn : Object.entries(furn).map(([k, v]) => ({ id: k, ...v }));
      const p = arr.find(x => x.id === id);
      if (p) g = buildFurniture(p.type, { ...p, ...(p.size_m || {}) });
      else if (id.startsWith('type:')) {                       // 프리셋 없이 빌더로 — type:<빌더>[:k=v,k=v] (새 가구를 프리셋 전에 원화 참조로)
        const [, ty, kv = ''] = id.split(':');
        const o = Object.fromEntries(kv.split(',').filter(Boolean).map(s => { const [k, v] = s.split('='); return [k, isNaN(+v) ? v : +v]; }));
        g = buildFurniture(ty, o);
      } else {                                                    // 창 — 방 정의에서 그 프리셋을 쓰는 창을 찾는다
        for (const r of Object.values(rooms)) for (const w of (r.windows || [])) if (!g && w.preset === id) {
          const wp = Array.isArray(wins) ? wins.find(x => x.id === id) : wins[id];
          g = buildWindowFrame(w.w, w.h, { ...wp, frameColor: w.color || wp.frameColor, gloss: w.gloss || wp.gloss });
          g.position.y = w.h / 2; isWin = true;
        }
      }
      if (!g) return 'ERR 없는 id ' + id;
      /* 온실장은 유리를 뺀다(틀만) — 투명 재질 메시 */
      const drop = []; g.traverse(o => { if (o.isMesh && o.material && o.material.transparent && o.material.opacity < 0.5) drop.push(o); });
      /* EMPTY=1 — 몸·테두리 색이 아닌 조각(책장의 책 · 자리에 얹힌 꾸밈)을 뺀다: 그 칸은 화분 자리라 원화·GLB 에 구워 넣으면 안 된다 */
      if (${JSON.stringify(process.env.EMPTY === '1')} && p) {
        const keep = [p.color, p.accent].filter(Boolean).map(c => new T.Color(c).convertSRGBToLinear().getHexString());
        g.traverse(o => { if (o.isMesh && o.material && o.material.color && !keep.includes(o.material.color.getHexString())) drop.push(o); });
      }
      for (const o of drop) o.parent.remove(o);
      /* ★ 찰흙 한 빛깔 — 가구 색(미색)이 흰 바탕에 묻혀 모양이 안 읽혔다(첫 찍기 · 창은 통째로 안 보였다). 모양만 넘긴다 · 칠은 기준 그림이 준다 */
      const clay = new T.MeshStandardMaterial({ color: new T.Color('#a89f92').convertSRGBToLinear(), roughness: 0.9, metalness: 0 });
      g.traverse(o => { if (o.isMesh) o.material = clay; });
      const scene = new T.Scene(); scene.background = new T.Color('#ffffff');
      scene.add(g);
      scene.add(new T.HemisphereLight(0xffffff, 0x8a8478, 0.75));
      const sun = new T.DirectionalLight(0xffffff, 0.9); sun.position.set(-2, 4, 3); scene.add(sun);
      const box = new T.Box3().setFromObject(g); const c = box.getCenter(new T.Vector3()); const sz = box.getSize(new T.Vector3());
      /* 앞(+Z)이 왼쪽 아래 = 카메라가 앞-오른쪽 위 · 창은 거의 정면(살짝 왼쪽 위) */
      const dir = isWin ? new T.Vector3(-0.28, 0.18, 1).normalize() : new T.Vector3(0.75, 0.62, 1).normalize();
      const R = sz.length();
      const cam = new T.OrthographicCamera(-1, 1, 1, -1, 0.01, R * 10);
      cam.position.copy(c).addScaledVector(dir, R * 3); cam.lookAt(c); cam.updateMatrixWorld(true);
      /* 화면에 꽉 차게 — 상자 여덟 꼭짓점을 카메라 좌표로 */
      let mx = 0, my = 0; const v = new T.Vector3();
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
        v.set(x, y, z).applyMatrix4(cam.matrixWorldInverse); mx = Math.max(mx, Math.abs(v.x)); my = Math.max(my, Math.abs(v.y)); }
      const half = Math.max(mx, my) * 1.12;
      Object.assign(cam, { left: -half, right: half, top: half, bottom: -half }); cam.updateProjectionMatrix();
      const ren = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      ren.setPixelRatio(1); ren.setSize(${SIZE}, ${SIZE}); ren.outputEncoding = T.sRGBEncoding;
      ren.render(scene, cam);
      const out = ren.domElement.toDataURL('image/png'); ren.dispose(); ren.forceContextLoss();
      return out;
    })()`);
    if (typeof url !== 'string' || !url.startsWith('data:image/png')) { console.log('✘', id, String(url).slice(0, 120)); continue; }
    const file = path.join(OUT, `ref_${id.replace(/^type:/, '').replace(/[:=,.]+/g, '_')}.png`);
    fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
    console.log('✔', path.relative(ROOT, file).replace(/\\/g, '/'));
    await sleep(100);
  }
} finally { await page.close(); }
