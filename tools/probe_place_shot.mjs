/* §B 를 **눈으로** 확인하는 사진기.
     out/place_cells_<태그>.png   상판 칸 + 추천 자리 (B-1)
     out/place_grid_<태그>.png    가구 옮길 때 바닥 붉은 칸 (B-3)
   ⚠ 사진은 타이밍을 탄다 — **색 가짓수**를 같이 찍는다(까만 사진 3색 · 멀쩡 3,000색). */
import { launch, sleep } from './test_cdp.mjs';
import fs from 'node:fs';
const _wd = setTimeout(() => { console.error('⏱'); process.exit(2); }, 420000); _wd.unref && _wd.unref();
const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const TAG = process.argv[2] || 'before';
const DIR = 'docs/handoff/img/place';
fs.mkdirSync(DIR, { recursive: true });

const page = await launch({ width: 1280, height: 900, dpr: 1, mobile: false });
await page.goto(`${BASE}/game.html`);
await page.eval(`localStorage.clear()`, false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 180000, 300);
await page.waitFor('window.__byeotBooted === true', 180000, 300);
await sleep(6000);
await page.eval(`(()=>{ for(let i=0;i<40;i++){ try{ document.getElementById('dlgSkip').click() }catch{} } })()`, false);
await sleep(1500);

/* 색 가짓수 — 사진이 살아 있나 */
async function shot(name) {
  await sleep(900);
  const f = `${DIR}/${name}_${TAG}.png`;
  await page.shot(f);
  const colors = await page.eval(`(()=>{ const c=document.getElementById('roomCanvas');
    const cv=document.createElement('canvas'); cv.width=240; cv.height=170;
    const g=cv.getContext('2d'); g.drawImage(c,0,0,240,170);
    const d=g.getImageData(0,0,240,170).data; const s=new Set();
    for(let i=0;i<d.length;i+=4) s.add((d[i]<<16)|(d[i+1]<<8)|d[i+2]);
    return s.size; })()`);
  console.log(`  ${f}  색 ${colors}가지`);
  return colors;
}

/* ① 상판 칸 — 카메라를 책상·서랍장 쪽으로 당긴다 */
await page.eval(`(()=>{ const rv=window.__rv;
  try { rv.showGrid(false); } catch{}
  rv.showSlotRings(true, { potD: 0.24 });
})()`, false);
await shot('cells');

/* ② 가구 옮기기 — 침대의 붉은 칸 */
await page.eval(`(()=>{ const rv=window.__rv;
  rv.showSlotRings(false);
  rv.showGrid(true, { uid: 'banjiha-bed' });
  rv.previewFurnitureAt('banjiha-bed', { x: -1.55, z: -0.5, rot: 0, step: rv.moveStep() });
})()`, false);
await shot('gridbed');

/* ③ 의자(작은 가구)의 붉은 칸 — 「작은데도 온통 붉나」 */
await page.eval(`(()=>{ const rv=window.__rv;
  rv.clearFurniturePreview();
  rv.showGrid(false);
  rv.showGrid(true, { uid: 'banjiha-chair' });
})()`, false);
await shot('gridchair');

await page.close();
