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
/* ★ 각 가구의 화면 좌표에서 pickFurnitureAt 이 그 가구를 집나 */
const hit = await page.eval(`(()=>{ const rv=window.__rv;
  const rect = document.getElementById('roomCanvas').getBoundingClientRect();
  const out = [];
  for (const f of rv.furniture()) {
    let scr=null; try { scr = rv.screenPosOf(f.uid); } catch(e){}
    if (!scr) { out.push({uid:f.uid, scr:null}); continue; }
    const x = scr.x + rect.left, y = scr.y + rect.top;
    let got=null; try { const r = rv.pickFurnitureAt(x, y); got = r ? r.uid : null; } catch(e){ got='ERR '+e.message; }
    /* 가구 몸통 쪽(발밑에서 조금 위)도 찔러 본다 */
    let got2=null; try { const r2 = rv.pickFurnitureAt(x, y - 30); got2 = r2 ? r2.uid : null; } catch(e){}
    out.push({ uid:f.uid, ko:f.ko, x:Math.round(x), y:Math.round(y), 발밑:got, '위30px':got2 });
  }
  return JSON.stringify(out, null, 1); })()`);
console.log('집히나:', hit);
await page.close();
