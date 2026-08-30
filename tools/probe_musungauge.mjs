/* tools/probe_musungauge.mjs — **무순 칸 게이지가 왜 안 잡히나** (test_bagcell M-1)
   ⛔ 값도 코드도 안 바꾼다. 「지금 어떻게 되나」만 본다. */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8972';
const page = await launch({ width: 390, height: 844, dpr: 1 });
await page.goto(`${BASE}/game.html`);
await page.eval('localStorage.clear()', false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 150000, 300);
await sleep(4000);
console.log('■ 손 안 댔을 때 —', await page.eval(`(()=>{ const S=window.__S();
  const g=document.getElementById('musunGauge'), c=document.getElementById('musunCard');
  return JSON.stringify({ '몬 도착': !!(S.firstPlay&&S.firstPlay.monstera&&S.firstPlay.monstera.arrived),
    '카드 있나': !!c, '카드 보이나': !!(c && c.style.display !== 'none'),
    '게이지 안': g ? g.innerHTML.slice(0,60) : null }); })()`));
await page.eval(`(()=>{ const S=window.__S();
  S.firstPlay.monstera = S.firstPlay.monstera || {};
  S.firstPlay.monstera.arrived = true; window.__redraw(); })()`, false);
await sleep(900);
console.log('■ 몬이 왔다고 하면 —', await page.eval(`(()=>{ const S=window.__S();
  const g=document.getElementById('musunGauge'), c=document.getElementById('musunCard');
  return JSON.stringify({ '몬 도착': !!S.firstPlay.monstera.arrived,
    '카드 보이나': !!(c && c.style.display !== 'none'),
    '게이지 칸수': g ? g.querySelectorAll('.cells > i').length : null,
    '게이지 안': g ? g.innerHTML.slice(0,80) : null }); })()`));
await page.close();
