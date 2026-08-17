import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const page = await launch({ width: 390, height: 844, dpr: 2, mobile: false });
await page.goto(`${BASE}/game.html`); await page.eval(`localStorage.clear()`,false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('window.__byeotBooted === true', 180000, 300); await sleep(6000);
const clear=async()=>{for(let i=0;i<30;i++){const b=await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`); if(!b)return;
  await page.eval(`(()=>{const g=document.getElementById('guideClose'); if(g&&g.offsetParent){g.click();return;} const b=document.getElementById('dlgBox'); if(b)b.click();})()`,false); await sleep(250);}};
await clear();
for (const step of [1,2,3]) { await page.eval(`(()=>{const t=document.querySelector('.hintTarget'); if(t)t.click();})()`,false); await sleep(1800); await clear(); }
await sleep(1500);
console.log('쪽지:', await page.eval(`(()=>{const c=document.getElementById('coach');
  return JSON.stringify({보임:!!(c&&c.classList.contains('on')), 글:(c?c.textContent:'').replace(/\s+/g,' ').trim().slice(0,130)});})()`));
await page.shot('docs/handoff/img/guidewalk/walktip.png');
await page.close();
