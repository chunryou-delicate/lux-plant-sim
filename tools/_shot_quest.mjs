import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const page = await launch({ width: 390, height: 844, dpr: 2, mobile: false });
await page.goto(`${BASE}/game.html`); await page.eval(`localStorage.clear()`,false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('window.__byeotBooted === true', 180000, 300); await sleep(6000);
for(let i=0;i<30;i++){ const b=await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`); if(!b)break;
  await page.eval(`(()=>{const g=document.getElementById('guideClose'); if(g&&g.offsetParent){g.click();return;} const b=document.getElementById('dlgBox'); if(b)b.click();})()`,false); await sleep(250);}
await page.eval(`window.__byeotSheet.open('quest')`,false); await sleep(1200);
console.log('줄:', await page.eval(`(()=>{ const rows=[...document.querySelectorAll('.qrow')].map(r=>{
  const c=[...r.classList].filter(x=>x!=='qrow').join(',');
  return (c||'open')+' | '+(r.textContent||'').replace(/\s+/g,' ').trim().slice(0,34); });
  const more=document.querySelector('.qmore'); if(more) rows.push('…더 | '+(more.textContent||'').trim());
  return JSON.stringify(rows,null,0); })()`));
await page.shot('docs/handoff/img/guidewalk/quest_tab.png');
await page.close();
