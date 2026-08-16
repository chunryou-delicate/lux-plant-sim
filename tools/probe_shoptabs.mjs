import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const page = await launch({ width: 1280, height: 900, dpr: 1, mobile: false });
await page.goto(`${BASE}/game.html`);
await page.eval(`localStorage.clear()`, false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 180000, 300);
await page.waitFor('window.__byeotBooted === true', 180000, 300);
await sleep(7000);
for (let i=0;i<40;i++){
  const busy = await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');
    return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`);
  if(!busy) break;
  await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s)s.click();
    const b=document.getElementById('dlgBox'); if(b)b.click();
    const g=document.getElementById('guideClose'); if(g)g.click();})()`, false);
  await sleep(250);
}
await page.eval(`window.__byeotSheet.tab('shop')`, false);
await sleep(900);
const out = await page.eval(`(()=>{
  const tabs=[...document.querySelectorAll('#shopGroups [data-sg]')].map(b=>b.textContent.replace(/\s+/g,' ').trim());
  const rows=[...document.querySelectorAll('#shopList .shopRow .nm')].map(e=>e.childNodes[0].textContent.trim());
  return JSON.stringify({ tabs, rows }); })()`);
console.log(out);
await page.shot('docs/handoff/img/shop/tabs.png');
/* 갈래를 눌러 본다 */
for (const g of ['seed','grow','pot']) {
  const r = await page.eval(`(()=>{ const b=document.querySelector('#shopGroups [data-sg="'+${JSON.stringify(g)}+'"]');
    if(!b) return 'no-tab'; b.click();
    return [...document.querySelectorAll('#shopList .shopRow .nm')].map(e=>e.childNodes[0].textContent.trim()).join(' · '); })()`);
  console.log(g, '→', r);
}
await page.close();
