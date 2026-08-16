/* 자리마다 「설 수 있는 가장 가까운 데」가 몇 m 인가 — 닿는 거리(ACT_REACH 1.45)와 견준다 */
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
  const slots=(window.__io.light.room.slots)||[];
  const rows=[];
  for (const s of slots) {
    let d=null;
    try { const c = rv.standNearOf ? rv.standNearOf(s.slotId) : null; d = c; } catch(e){}
    rows.push({ slotId:s.slotId, x:+s.x.toFixed(2), z:+s.z.toFixed(2), y:+s.y.toFixed(2) });
  }
  return JSON.stringify(rows); })()`);
console.log(out);
await page.close();
