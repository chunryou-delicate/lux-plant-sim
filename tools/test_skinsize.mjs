/* ============================================================
   tools/test_skinsize.mjs — 무늬 잎이 **화면에서 몇 픽셀**인가 · 줄여도 무늬가 사나

     python tools/serve.py 8963
     BYEOT_URL=http://localhost:8963 node tools/test_skinsize.mjs measure
     BYEOT_URL=http://localhost:8963 node tools/test_skinsize.mjs boot
     BYEOT_URL=http://localhost:8963 node tools/test_skinsize.mjs shot  [orig|small]

   ★ 왜 이 자가 필요한가 — "512 면 충분하다"를 짐작으로 정하면 안 된다.
     잎 한 장이 화면에서 차지하는 **기기 픽셀**을 먼저 재고, 그 값으로 해상도를 고른다.

   ⚠ readPixels 는 안 쓴다(START-HERE §2.9-②). 화소는 **사진**으로 잰다.
============================================================ */
import { launch, sleep } from './test_cdp.mjs';
import fs from 'node:fs';

const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const MODE = process.argv[2] || 'measure';
const ARG = process.argv[3] || '';
const OUT = 'docs/handoff/img/skinshrink';

const _WD = +(process.env.BYEOT_PROBE_TIMEOUT_MS || 600000);
const _wd = setTimeout(() => { console.error('⏱ 자가 제한을 넘겨 멈춥니다.'); process.exit(2); }, _WD);
_wd.unref && _wd.unref();
process.on('exit', () => clearTimeout(_wd));

/* 방에 세울 그루 — 무늬 잎이 실제로 나게 leafState 를 직접 준다.
   ⚠ 여기서 varie 를 지어내는 것은 **그리개를 시험하는 것**이지 확률을 건드리는 것이 아니다.
     정본(plant_grow.html)의 판정은 하나도 안 건드린다.
   ★ 실제 잎의 leafBirth 는 씨앗마다 다르다. 그래서 0~400 을 **전부** 깔아 둔다 —
     안 쓰이는 칸은 그냥 안 읽힌다(`__setLeafState` 는 Map 에 넣기만 한다).
     이렇게 하면 그 그루의 다 자란 잎이 전부 무늬가 되어 **최악의 경우**를 잰다. */
const LEAF_STATE = Array.from({ length: 401 }, (_, i) => ({
  leafBirth: i, varie: true, matured: true, fade: 0, dropped: false
}));

async function bootGame(page, { width = 390, height = 844, dpr = 2 } = {}) {
  const net = [];
  page.on((m, p) => {
    if (m === 'Network.responseReceived') net.push({ url: p.response.url, mime: p.response.mimeType });
    if (m === 'Network.loadingFinished') {
      const last = net[net.length - 1];
      if (last && last.len == null) last.len = p.encodedDataLength;
    }
  });
  await page.goto(`${BASE}/game.html`);
  await page.eval(`localStorage.clear()`, false).catch(() => 0);
  const t0 = Date.now();
  await page.goto(`${BASE}/game.html`);
  await page.waitFor('!!window.__rv', 180000, 200);
  const rvMs = Date.now() - t0;
  await sleep(2500);
  return { rvMs };
}

/* 부팅 동안 실제로 받은 바이트 — CDP 가 세는 encodedDataLength 를 그대로 쓴다 */
async function bootBytes(page) {
  return page.eval(`(()=>{ const e = performance.getEntriesByType('resource');
    let all=0, glb=0, n=0, nglb=0, skins=0, nskin=0;
    for(const r of e){ const b = r.transferSize || r.encodedBodySize || 0;
      all+=b; n++;
      if(/\\.glb(\\?|$)/i.test(r.name)){ glb+=b; nglb++;
        if(/\\/skins\\//.test(r.name)){ skins+=b; nskin++; } } }
    return { allMB:+(all/1048576).toFixed(2), n,
             glbMB:+(glb/1048576).toFixed(2), nglb,
             skinMB:+(skins/1048576).toFixed(2), nskin }; })()`);
}

/* 방에 몬스테라를 세운다 — 게임이 쓰는 창구 그대로 */
async function placeMonstera(page, days = 400) {
  return page.eval(`(async()=>{
    const rv = window.__rv;
    await rv.setPlant('banjiha-desk:0', { kind:'monstera', growthDays:${days},
      potD:0.20, leafState:${JSON.stringify(LEAF_STATE)} });
    return rv.plants().length; })()`);
}

/* 잎 메시가 화면에서 몇 픽셀인가 — 월드 바운딩박스 여덟 꼭짓점을 투영한다.
   ⚠ CSS 픽셀이 아니라 **기기 픽셀**이 텍스처가 실제로 겨루는 자다(dpr 을 곱한다). */
const MEASURE_JS = `(()=>{
  const rv = window.__rv, T = rv.three;
  const cam = T.cam || T.camera, ren = T.renderer, scene = T.scene;
  const cv = ren.domElement, r = cv.getBoundingClientRect();
  const dpr = ren.getPixelRatio ? ren.getPixelRatio() : (window.devicePixelRatio||1);
  cam.updateMatrixWorld(true);
  const rows = [];
  /* ★ 잎몸 메시에는 assetKey 가 없다 — **홀더**에만 있다(plant_assemble §markSkin).
     그래서 홀더를 찾고, 그 아래 map 을 들고 있는 메시(=잎몸)만 재서 합친다. */
  scene.traverse(h=>{
    const k = h.userData && h.userData.assetKey;
    if(!k || !/^leaf_/.test(k)) return;
    let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9, texW=0, texH=0, blades=0;
    h.traverse(o=>{
      if(!o.isMesh || !o.geometry) return;
      const mat = Array.isArray(o.material)?o.material[0]:o.material;
      if(!(mat && mat.map)) return;                  // 엽초는 map 이 없다 — 잎몸만 센다
      blades++;
      const im = mat.map.image;
      if(im){ texW=Math.max(texW, im.width||im.naturalWidth||0);
              texH=Math.max(texH, im.height||im.naturalHeight||0); }
      o.geometry.computeBoundingBox();
      const bb = o.geometry.boundingBox;
      for(let i=0;i<8;i++){
        const v = new THREE.Vector3(
          i&1?bb.max.x:bb.min.x, i&2?bb.max.y:bb.min.y, i&4?bb.max.z:bb.min.z);
        o.localToWorld(v); v.project(cam);
        const px = (v.x*0.5+0.5)*r.width, py = (-v.y*0.5+0.5)*r.height;
        x0=Math.min(x0,px); x1=Math.max(x1,px); y0=Math.min(y0,py); y1=Math.max(y1,py);
      }
    });
    if(!blades) return;
    rows.push({ key:k, blades,
      cssW:+(x1-x0).toFixed(1), cssH:+(y1-y0).toFixed(1),
      devW:+((x1-x0)*dpr).toFixed(1), devH:+((y1-y0)*dpr).toFixed(1),
      texW, texH });
  });
  return { dpr, canvas:{w:r.width,h:r.height}, drawing:{w:cv.width,h:cv.height}, leaves:rows };
})()`;

/* ── 확대창(plant_grow.html) 에서의 잎 크기 ──
   방보다 훨씬 크게 보이는 화면이라 **여기가 해상도를 정하는 자리**다. */
const ZOOM_JS = `(()=>{
  const r = renderer.domElement.getBoundingClientRect();
  const dpr = renderer.getPixelRatio();
  cam.updateMatrixWorld(true);
  const rows=[];
  plantGroup.traverse(h=>{
    const k = h.userData && h.userData.assetKey;
    if(!k || !/^leaf_/.test(k)) return;
    let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9,texW=0,blades=0;
    h.traverse(o=>{
      if(!o.isMesh||!o.geometry) return;
      const m = Array.isArray(o.material)?o.material[0]:o.material;
      if(!(m&&m.map)) return;
      blades++; const im=m.map.image; if(im) texW=Math.max(texW, im.width||im.naturalWidth||0);
      o.geometry.computeBoundingBox(); const bb=o.geometry.boundingBox;
      for(let i=0;i<8;i++){
        const v=new THREE.Vector3(i&1?bb.max.x:bb.min.x,i&2?bb.max.y:bb.min.y,i&4?bb.max.z:bb.min.z);
        o.localToWorld(v); v.project(cam);
        const px=(v.x*0.5+0.5)*r.width, py=(-v.y*0.5+0.5)*r.height;
        x0=Math.min(x0,px);x1=Math.max(x1,px);y0=Math.min(y0,py);y1=Math.max(y1,py);
      }
    });
    if(blades) rows.push({key:k, cssW:+(x1-x0).toFixed(1), cssH:+(y1-y0).toFixed(1),
      devW:+((x1-x0)*dpr).toFixed(1), devH:+((y1-y0)*dpr).toFixed(1), texW});
  });
  return { dpr, canvas:{w:r.width,h:r.height}, leaves:rows };
})()`;

async function zoomMeasure(V) {
  const page = await launch({ width: V.width, height: V.height, dpr: V.dpr, mobile: false });
  await page.goto(`${BASE}/plant_grow.html?embed=game`);
  await page.waitFor('typeof window.setGrowth === "function"', 180000, 300);
  await page.waitFor('window.thLoaded() === true', 180000, 300);
  await sleep(1500);
  await page.eval(`(()=>{ plantSeed(92158); matResetAll(); resetDailyLight();
    setGrowth(0); setDailyLightSteady(8); for(let d=1; d<=400; d++) advanceTo(d); return 1; })()`);
  await sleep(4000);
  const m = await page.eval(ZOOM_JS);
  console.log(`\n■ 확대창 ${V.tag} — 캔버스 ${m.canvas.w}×${m.canvas.h} CSS (dpr ${m.dpr})`);
  const ls = m.leaves.sort((a, b) => b.devW * b.devH - a.devW * a.devH);
  for (const l of ls.slice(0, 6))
    console.log(`    ${l.key}\t${l.cssW}×${l.cssH} CSS\t${l.devW}×${l.devH} 기기px\t텍스처 ${l.texW}`);
  if (ls.length) {
    const b = ls[0];
    console.log(`  ★ 제일 큰 잎 = ${Math.round(Math.max(b.devW, b.devH))} 기기px ` +
                `(텍스처 ${b.texW} → 화면 1픽셀당 텍셀 ${(b.texW / Math.max(b.devW, b.devH)).toFixed(1)})`);
  }
  await page.close();
}

/* 확대창 사진 — 무늬 잎이 **제일 크게** 보이는 화면이다. 여기서 안 뭉개지면 방은 볼 것도 없다.
   ⚠ 사진은 타이밍을 탄다(§2.9-③) — 여러 번 그리고 나서 찍고, 색 가짓수로 살아 있나 확인한다. */
async function zoomShot(tag) {
  const page = await launch({ width: 390, height: 844, dpr: 2, mobile: false });
  await page.goto(`${BASE}/plant_grow.html?embed=game`);
  await page.waitFor('typeof window.setGrowth === "function"', 180000, 300);
  await page.waitFor('window.thLoaded() === true', 180000, 300);
  await sleep(1500);
  await page.eval(`(()=>{ plantSeed(92158); matResetAll(); resetDailyLight();
    setGrowth(0); setDailyLightSteady(8); for(let d=1; d<=400; d++) advanceTo(d); return 1; })()`);
  await sleep(6000);
  /* 무늬 잎을 화면 가운데로 크게 — 사람이 확대해서 보는 그 상태다 */
  await page.eval(`(()=>{ orbit.zoom = 2.2; updateCam(); return 1; })()`, false).catch(() => 0);
  await sleep(2500);
  fs.mkdirSync(OUT, { recursive: true });
  const f = `${OUT}/zoom_${tag}.png`;
  await page.shot(f);
  const info = await page.eval(`(()=>{ const s=new Set();
    plantGroup.traverse(o=>{ const k=o.userData&&o.userData.assetKey;
      if(k&&/^leaf_/.test(k)) o.traverse(q=>{ if(q.isMesh){ const m=Array.isArray(q.material)?q.material[0]:q.material;
        if(m&&m.map&&m.map.image) s.add(k+'@'+m.map.image.width); } }); });
    return [...s].join(' · '); })()`);
  console.log(`${f}\n  잎 텍스처: ${info}`);
  await page.close();
  return f;
}

async function main() {
  if (MODE === 'zoomshot') { await zoomShot(ARG || 'orig'); return; }
  if (MODE === 'zoom') {
    await zoomMeasure({ tag: '폰 390×844 dpr2', width: 390, height: 844, dpr: 2 });
    await zoomMeasure({ tag: '데스크 1280×900 dpr1', width: 1280, height: 900, dpr: 1 });
    return;
  }
  if (MODE === 'measure' || MODE === 'boot') {
    for (const V of [{ tag: '폰 390×844 dpr2', width: 390, height: 844, dpr: 2 },
                     { tag: '데스크 1280×900 dpr1', width: 1280, height: 900, dpr: 1 }]) {
      const page = await launch({ width: V.width, height: V.height, dpr: V.dpr, mobile: false });
      const { rvMs } = await bootGame(page, V);
      const bb = await bootBytes(page);
      console.log(`\n■ ${V.tag}`);
      console.log(`  __rv 준비 ${rvMs}ms · 부팅 다운로드 ${bb.allMB}MB (${bb.n}건) ` +
                  `· GLB ${bb.glbMB}MB(${bb.nglb}) · skins ${bb.skinMB}MB(${bb.nskin})`);
      if (MODE === 'measure') {
        await placeMonstera(page);
        await sleep(4000);                      // 무늬 GLB 가 늦게 온다 — 기다린다
        await page.eval(`window.__rv.redraw&&window.__rv.redraw()`, false).catch(() => 0);
        await sleep(800);
        const m = await page.eval(MEASURE_JS);
        console.log(`  캔버스 ${m.canvas.w}×${m.canvas.h} CSS · 그리는 버퍼 ${m.drawing.w}×${m.drawing.h} (dpr ${m.dpr})`);
        const ls = m.leaves.sort((a, b) => b.devW * b.devH - a.devW * a.devH);
        for (const l of ls.slice(0, 8))
          console.log(`    ${l.key}\t${l.cssW}×${l.cssH} CSS\t${l.devW}×${l.devH} 기기px\t텍스처 ${l.texW}×${l.texH}`);
        if (ls.length) {
          const big = ls[0];
          console.log(`  ★ 제일 큰 잎 = ${Math.round(Math.max(big.devW, big.devH))} 기기px ` +
                      `(텍스처 ${big.texW}px → 화면 1픽셀당 텍셀 ${(big.texW / Math.max(big.devW, big.devH)).toFixed(1)})`);
        }
        const bytes = await bootBytes(page);
        console.log(`  그루를 세운 뒤 누적 다운로드 ${bytes.allMB}MB · skins ${bytes.skinMB}MB(${bytes.nskin}장)`);
      }
      await page.close();
    }
    return;
  }

  if (MODE === 'shot') {
    const page = await launch({ width: 390, height: 844, dpr: 2, mobile: false });
    await bootGame(page);
    /* 대사·안내를 걷어낸다 — 안 걷으면 그림 절반이 얼굴이라 잎을 못 본다 */
    for (const id of ['dlgSkip', 'guideClose'])
      await page.eval(`(()=>{const e=document.getElementById('${id}'); if(e) e.click(); return 1;})()`, false).catch(() => 0);
    await sleep(1200);
    await page.eval(`(()=>{ for(let i=0;i<25;i++){ const b=document.getElementById('dlgBox'); if(b) b.click(); } return 1; })()`, false).catch(() => 0);
    await sleep(800);
    await placeMonstera(page);
    await sleep(6000);
    /* 한낮으로 두고 그 자리를 당겨 본다 — 방에서 잎을 볼 수 있는 제일 큰 상태다 */
    await page.eval(`(()=>{ window.__rv.setDaylight(0.52); window.__rv.focusSlot('banjiha-desk:0', true); return 1; })()`, false).catch(() => 0);
    await sleep(2500);
    /* ★ 사진이 타이밍을 탄다(§2.9-③). 색 가짓수를 세서 「살아 있는 프레임」인지 확인한다 */
    for (let i = 0; i < 6; i++) {
      await page.eval(`window.__rv.redraw&&window.__rv.redraw()`, false).catch(() => 0);
      await sleep(600);
    }
    fs.mkdirSync(OUT, { recursive: true });
    const f = `${OUT}/room_${ARG || 'orig'}.png`;
    await page.shot(f);
    const used = await page.eval(`(()=>{ const rv=window.__rv, s=new Set();
      rv.three.scene.traverse(o=>{ if(o.isMesh&&o.userData&&o.userData.assetKey&&/leaf/i.test(o.userData.assetKey))
        s.add(o.userData.assetKey + (o.material&&o.material.map?('@'+(o.material.map.image&&o.material.map.image.width)):'')); });
      return [...s]; })()`);
    console.log(f);
    console.log('쓴 잎 에셋:', used.join(' · '));
    const bb = await bootBytes(page);
    console.log(`누적 다운로드 ${bb.allMB}MB · skins ${bb.skinMB}MB(${bb.nskin}장)`);
    await page.close();
    return;
  }

  console.error('mode: measure | boot | shot');
  process.exit(1);
}

await main();
