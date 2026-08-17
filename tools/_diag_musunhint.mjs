import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const page = await launch({ width: 390, height: 844, dpr: 2, mobile: false });
await page.goto(`${BASE}/game.html`); await page.eval(`localStorage.clear()`,false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('window.__byeotBooted === true', 180000, 300); await sleep(6000);
const clear=async()=>{for(let i=0;i<30;i++){const b=await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`); if(!b)return;
  await page.eval(`(()=>{const g=document.getElementById('guideClose'); if(g&&g.offsetParent){g.click();return;} const b=document.getElementById('dlgBox'); if(b)b.click();})()`,false); await sleep(250);}};
await clear();
await page.eval(`(()=>{ const rv=window.__rv,c=document.getElementById('roomCanvas').getBoundingClientRect();
  const sp=rv.screenPosOf('banjiha-dresser:1');
  window.__drag.begin('beansprout',document.getElementById('cropThumb').src,{clientX:c.left+c.width*0.9,clientY:c.top+40});
  window.__drag.move({clientX:c.left+sp.x,clientY:c.top+sp.y});window.__drag.end();})()`,false);
await sleep(1500); await clear();
await page.eval(`(()=>{const b=document.getElementById('placeOk'); if(b&&b.offsetParent)b.click();})()`,false);
await sleep(1200); await clear();
const ask=async(t,q)=>{ await page.eval(`(()=>{document.getElementById('quest').textContent=${JSON.stringify(q)};
  window.__byeotHint && window.__byeotHint();})()`,false); await sleep(500);
  console.log(t, await page.eval(`(()=>{const h=document.getElementById('hint'),t2=document.querySelector('.hintTarget');
  return JSON.stringify({손가락:h.classList.contains('on')?(h.querySelector('.say').textContent||'').trim():null,
    대상:t2?(t2.id||t2.dataset.buy||t2.className.split(' ')[0]):null});})()`)); };
await ask('무순 퀘 · 시트 닫힘:','무순을 길러 콩나물과 한 상에 올리세요');
await page.eval(`(()=>{ window.__byeotSheet.open('shop'); })()`,false); await sleep(900);
await ask('무순 퀘 · 상점:','무순을 길러 콩나물과 한 상에 올리세요');
/* 두 바퀴 뒤에는 거두기 손가락이 안 나와야 한다 */
await page.eval(`(()=>{ window.__byeotSheet.close(); const S=window.__S();
  const b=S.firstPlay.beansprout; b.harvestCount=3; (b.pots||[]).forEach(p=>p.harvestCount=3);
  document.getElementById('quest').textContent='무순을 길러 콩나물과 한 상에 올리세요';
  window.__redraw&&window.__redraw(); })()`,false);
await sleep(900);
console.log('배운 뒤 손가락:', await page.eval(`(()=>{const h=document.getElementById('hint'),t=document.querySelector('.hintTarget');
  return JSON.stringify({손가락:h.classList.contains('on')?(h.querySelector('.say').textContent||'').trim():null,
    대상:t?(t.id||t.className.split(' ')[0]):null, 말풍선:[...document.querySelectorAll('#marks .mark')].length});})()`));
await page.close();
