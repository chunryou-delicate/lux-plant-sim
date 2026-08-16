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
  const all = rv.furniture ? rv.furniture() : [];
  return JSON.stringify(all.map(f => ({ uid:f.uid, id:f.id||f.presetId||null, ko:f.ko||f.name||null }))); })()`);
console.log('옮길 수 있는 가구:', out);
const sz = await page.eval(`(()=>{ const rv=window.__rv;
  return JSON.stringify(rv.furniture().map(f => ({ uid:f.uid, ko:f.ko, size:f.size,
    칸: f.size ? { w: +(f.size.w/0.25).toFixed(2), d: +(f.size.d/0.25).toFixed(2) } : null })), null, 1); })()`);
console.log('가구 크기:', sz);
await page.close();
