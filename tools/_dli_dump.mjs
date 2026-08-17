/* 반지하 자리별 밝기를 한 장으로 — 가구를 옮기기 전후를 견주는 자 */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const page = await launch({ width: 390, height: 844, dpr: 2, mobile: false });
await page.goto(`${BASE}/game.html`); await page.eval(`localStorage.clear()`,false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('window.__byeotBooted === true', 180000, 300); await sleep(6000);
const out = await page.eval(`(()=>{ try {
  const io=window.__io; io.light.clearCache && io.light.clearCache();
  const slots=io.light.room.slots||[];
  const S=window.__S();
  const opt={ weather:'clear', season:'summer',
              lampCount:(S.lamps&&S.lamps.count)||0,
              litHours:(S.tutorial&&S.tutorial.lamp&&S.tutorial.lamp.litHours)||12 };
  const rows=slots.map(s=>({id:s.slotId, dli:+(io.light.dliOfSlot(s.slotId,opt)||0).toFixed(2)}));
  rows.sort((a,b)=>a.id<b.id?-1:1);
  return JSON.stringify(rows);
} catch(e){ return 'ERR '+e.message; } })()`);
console.log(out);
console.log('가구:', await page.eval(`(()=>{ try {
  return JSON.stringify((window.__rv.furniture?window.__rv.furniture():[]).map(f=>({uid:f.uid,x:f.x,z:f.z})));
} catch(e){ return 'n/a'; } })()`));
await page.close();
