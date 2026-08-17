import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const W = +(process.env.W || 1280);
const page = await launch({ width: W, height: 800, dpr: 1, mobile: false });
await page.goto(`${BASE}/game.html`); await page.eval(`localStorage.clear()`,false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('window.__byeotBooted === true', 180000, 300); await sleep(6000);
const clear=async()=>{for(let i=0;i<30;i++){const b=await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`); if(!b)return;
  await page.eval(`(()=>{const g=document.getElementById('guideClose'); if(g&&g.offsetParent){g.click();return;} const b=document.getElementById('dlgBox'); if(b)b.click();})()`,false); await sleep(250);}};
await clear();
console.log('폭', W, await page.eval(`(()=>{ const ids=['next','waterCrop','harvestCrop','waterPot','resow'];
  const out=[];
  for(const id of ids){ const e=document.getElementById(id); if(!e) continue;
    const r=e.getBoundingClientRect(); if(!(r.width>0)) continue;
    const cx=r.left+r.width/2, cy=r.top+r.height/2;
    const top=document.elementFromPoint(cx,cy);
    out.push({id, 위에있는것: top? (top.id || top.className || top.tagName) : null,
      제자신: !!(top && (top===e || e.contains(top)))});
  }
  return JSON.stringify(out); })()`));
await page.close();
