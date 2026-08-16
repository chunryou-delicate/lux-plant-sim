import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const page = await launch({ width: 1280, height: 900, dpr: 1, mobile: false });
await page.goto(`${BASE}/game.html`);
await page.eval(`localStorage.clear()`, false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 180000, 300);
await page.waitFor('window.__byeotBooted === true', 180000, 300);
await sleep(7000);
const out = await page.eval(`(()=>{ const rv=window.__rv;
  const fns = Object.keys(rv).filter(k=>/grid|room|box|slot|span|inner/i.test(k));
  let size=null; try { size = rv.roomSize(); } catch(e){ size='ERR '+e.message; }
  let grid=null; try { grid = rv.grid ? rv.grid() : null; } catch(e){ grid='ERR '+e.message; }
  return JSON.stringify({ fns, size, grid }); })()`);
console.log(out);
await page.close();
