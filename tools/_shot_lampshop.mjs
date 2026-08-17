import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const page = await launch({ width: 390, height: 844, dpr: 2, mobile: false });
await page.goto(`${BASE}/game.html`); await page.eval(`localStorage.clear()`,false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('window.__byeotBooted === true', 180000, 300); await sleep(6000);
const clear=async()=>{for(let i=0;i<30;i++){const b=await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`); if(!b)return;
  await page.eval(`(()=>{const g=document.getElementById('guideClose'); if(g&&g.offsetParent){g.click();return;} const b=document.getElementById('dlgBox'); if(b)b.click();})()`,false); await sleep(250);}};
await clear();
/* 등을 열고 돈을 넉넉히 — 재려는 것은 **상점 줄**이다 */
await page.eval(`(()=>{ const S=window.__S(); S.tutorial.lamp.unlocked=true; S.tutorial.cashWon=2000000;
  if(S.firstPlay) S.firstPlay.enabled=false; window.__redraw&&window.__redraw(); })()`,false);
await sleep(800);
await page.eval(`window.__byeotSheet.open('shop')`,false); await sleep(900);
const rows=async(t)=>console.log(t, await page.eval(`(()=>{
  return JSON.stringify([...document.querySelectorAll('#shopList .shopRow')]
    .filter(r=>/식물등/.test(r.textContent||''))
    .map(r=>({글:(r.textContent||'').replace(/\s+/g,' ').trim().slice(0,70),
              단추:(r.querySelector('button')||{}).textContent})));})()`));
await rows('등 0개:');
await page.eval(`(()=>{const b=document.getElementById('buyLamp'); if(b)b.click();})()`,false);
await sleep(1500); await clear();
await page.eval(`window.__byeotSheet.open('shop')`,false); await sleep(800);
await rows('한 개 산 뒤:');
console.log('지갑:', await page.eval(`(()=>{const S=window.__S(); return JSON.stringify({현금:S.tutorial.cashWon, 보유:S.tutorial.lamp.owned, 켜짐:S.lamps.count});})()`));
await page.shot('docs/handoff/img/guidewalk/lamp_shop.png');
await page.close();
