import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const page = await launch({ width: 390, height: 844, dpr: 2, mobile: false });
await page.goto(`${BASE}/game.html`); await page.eval(`localStorage.clear()`,false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('window.__byeotBooted === true', 180000, 300); await sleep(6000);
const clear=async()=>{for(let i=0;i<30;i++){const b=await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`); if(!b)return;
  await page.eval(`(()=>{const g=document.getElementById('guideClose'); if(g&&g.offsetParent){g.click();return;} const b=document.getElementById('dlgBox'); if(b)b.click();})()`,false); await sleep(250);}};
await clear();
/* 시루를 놓아 첫 갈래(①)를 지나가게 하고, 할 일 줄을 「시루를 2개로」로 만든다 */
await page.eval(`(()=>{ const rv=window.__rv,c=document.getElementById('roomCanvas').getBoundingClientRect();
  const sp=rv.screenPosOf('banjiha-dresser:1');
  window.__drag.begin('beansprout',document.getElementById('cropThumb').src,{clientX:c.left+c.width*0.9,clientY:c.top+40});
  window.__drag.move({clientX:c.left+sp.x,clientY:c.top+sp.y});window.__drag.end();})()`,false);
await sleep(1500); await clear();
await page.eval(`(()=>{const b=document.getElementById('placeOk'); if(b&&b.offsetParent)b.click();})()`,false);
await sleep(1200); await clear();
const ask=async(t)=>console.log(t, await page.eval(`(()=>{
  document.getElementById('quest').textContent='시루를 2개로 늘려 엇갈리게 하세요';
  window.__redraw&&window.__redraw();
  const q=document.getElementById('quest'); q.textContent='시루를 2개로 늘려 엇갈리게 하세요';
  window.__byeotHint && window.__byeotHint();
  const h=document.getElementById('hint'), t2=document.querySelector('.hintTarget');
  return JSON.stringify({손가락:h.classList.contains('on')?(h.querySelector('.say').textContent||'').trim():null,
    대상:t2?(t2.id||t2.className.split(' ')[0]):null});})()`));
await sleep(500); await ask('시루 없음:');
await page.eval(`(()=>{ window.__byeotSheet.open('shop'); })()`,false); await sleep(900);
await ask('상점 연 뒤:');
await page.close();
