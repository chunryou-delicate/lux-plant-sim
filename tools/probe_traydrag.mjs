/* 새싹 재배판 칸에 끌기 손잡이가 실제로 걸리나 (2026-08-16) */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const page = await launch({ width: 1280, height: 900, dpr: 1, mobile: false });
await page.goto(`${BASE}/game.html`);
await page.eval(`localStorage.clear()`, false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 180000, 300);
await page.waitFor('window.__byeotBooted === true', 180000, 300);
await sleep(7000);
await page.eval(`(()=>{ const S=window.__S();
  S.shop.stock['sprout_tray']=2; S.shop.stock['radish_seed']=2; S.shop.stock['siru']=2;
  if (S.firstPlay && S.firstPlay.monstera) S.firstPlay.monstera.arrived = true;
  window.__redraw && window.__redraw(); })()`, false);
await sleep(900);
const out = await page.eval(`(()=>{ window.__byeotSheet.open(); window.__byeotSheet.tab('bag');
  const rows=[...document.querySelectorAll('.bagslot[data-place]')].map(c=>{
    const img=c.querySelector('img.draggable');
    const r=(img||c).getBoundingClientRect();
    return { place:c.dataset.place, 손잡이:(!!img||c.classList.contains('draggable')),
             크기: Math.round(r.width)+'x'+Math.round(r.height) };
  });
  return JSON.stringify(rows); })()`);
console.log(out);
await page.close();
