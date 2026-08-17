import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const page = await launch({ width: 390, height: 844, dpr: 2, mobile: false });
await page.goto(`${BASE}/game.html`); await page.eval(`localStorage.clear()`,false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('window.__byeotBooted === true', 180000, 300); await sleep(6000);
for(let i=0;i<30;i++){ const b=await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`); if(!b)break;
  await page.eval(`(()=>{const g=document.getElementById('guideClose'); if(g&&g.offsetParent){g.click();return;} const b=document.getElementById('dlgBox'); if(b)b.click();})()`,false); await sleep(250);}
console.log('쪽지:', await page.eval(`(()=>{const c=document.getElementById('questChip');
  const r=c?c.getBoundingClientRect():null;
  return JSON.stringify({보임:!!(c&&c.offsetParent), 글:(c?c.textContent:'').replace(/\s+/g,' ').trim().slice(0,60),
    자리:r?{right:Math.round(innerWidth-r.right), top:Math.round(r.top), w:Math.round(r.width), h:Math.round(r.height)}:null,
    화면폭:innerWidth});})()`));
await page.shot('docs/handoff/img/guidewalk/chip_closed.png');
await page.eval(`window.__byeotSheet.open('plants')`,false); await sleep(900);
console.log('시트 열면:', await page.eval(`(()=>{const c=document.getElementById('questChip');
  return JSON.stringify({보임:!!(c&&c.offsetParent)});})()`));
await page.close();
