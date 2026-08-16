import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
for (const w of [360, 390, 430]) {
  const page = await launch({ width: w, height: 844, dpr: 2, mobile: false });
  await page.goto(`${BASE}/game.html`);
  await page.eval(`localStorage.clear()`, false);
  await page.goto(`${BASE}/game.html`);
  await page.waitFor('!!window.__rv', 180000, 300);
  await page.waitFor('window.__byeotBooted === true', 180000, 300);
  await sleep(6000);
  for (let i=0;i<40;i++){
    const busy = await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');
      return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`);
    if(!busy) break;
    await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s)s.click();
      const b=document.getElementById('dlgBox'); if(b)b.click();
      const g=document.getElementById('guideClose'); if(g)g.click();})()`, false);
    await sleep(250);
  }
  const out = await page.eval(`(()=>{ const bs=[...document.querySelectorAll('#navbar > button')];
    return JSON.stringify(bs.map(b=>{const r=b.getBoundingClientRect();
      return { ko:(b.textContent||'').trim(), w:Math.round(r.width), h:Math.round(r.height),
               inView: r.top>=0 && r.bottom<=innerHeight }; })); })()`);
  console.log(w+'px:', out);
  await page.shot(`docs/handoff/img/nav/nav_${w}.png`);
  await page.close();
}
