/* 반지하 14칸의 **라이브** DLI 를 찍는다 — 가구를 옮기기 전/후를 견주는 자.
   ★ 정적 프로필이 아니라 실제로 조립된 방에 물어본다(io.light.dliOfSlot). */
import { launch, sleep } from './test_cdp.mjs';
const _wd = setTimeout(() => { console.error('⏱'); process.exit(2); }, 300000); _wd.unref && _wd.unref();
const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const page = await launch({ width: 900, height: 700, dpr: 1, mobile: false });
await page.goto(`${BASE}/game.html`);
await page.eval(`localStorage.clear()`, false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__io', 180000, 300);
await page.waitFor('window.__byeotBooted === true', 180000, 300);
await sleep(5000);
const out = await page.eval(`(()=>{ const io=window.__io;
  const slots = io.light.room.slots;
  const o = {};
  for (const s of slots) o[s.slotId] = +io.light.dliOfSlot(s.slotId,
    { weather:'clear', season:'summer', lampCount:0, litHours:0 }).toFixed(4);
  const pos = {};
  for (const s of slots) pos[s.slotId] = [ +s.x.toFixed(3), +s.y.toFixed(3), +s.z.toFixed(3) ];
  return JSON.stringify({ dli:o, pos }); })()`);
console.log(out);
await page.close();
