/* tools/probe_phaseday.mjs — **생장일마다 어느 단계인가** (「말린 새순」이 언제 서나) */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8972';
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 400000);
wd.unref && wd.unref();
const page = await launch({ width: 390, height: 844, dpr: 1 });
await page.goto(`${BASE}/game.html`);
await page.eval('localStorage.clear()', false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 150000, 300);
await sleep(5000);
let last = '';
for (let d = 40; d <= 200; d += 2) {
  const r = await page.eval(`(()=>{ try{ window.__io.growth.setGrowth(${d});
    const p = window.__io.growth.growthPhase ? window.__io.growth.growthPhase() : null;
    const st = window.__io.growth.leafStats ? window.__io.growth.leafStats() : null;
    return JSON.stringify({ id: p && (p.phaseId||p.id), ko: p && (p.phaseKo||p.ko),
      leaves: st && (st.leaves ?? st.leafCount ?? null) });
  }catch(e){ return JSON.stringify({ err:e.message }); } })()`);
  const o = JSON.parse(r);
  const key = String(o.id) + '|' + String(o.leaves);
  if (key !== last) { console.log(String(d).padStart(4) + '일  ' + String(o.id).padEnd(16) + ' ' + (o.ko||'') + '  잎 ' + o.leaves); last = key; }
}
await page.close(); clearTimeout(wd);
