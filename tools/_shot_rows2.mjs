import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const page = await launch({ width: 390, height: 844, dpr: 2, mobile: false });
const errs=[]; page.on(m=>{ if(m.method==='Runtime.exceptionThrown') errs.push((m.params.exceptionDetails.exception||{}).description||''); });
await page.goto(`${BASE}/game.html`); await page.eval(`localStorage.clear()`,false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('window.__byeotBooted === true', 180000, 300); await sleep(6000);
const clear=async()=>{for(let i=0;i<30;i++){const b=await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`); if(!b)return;
  await page.eval(`(()=>{const g=document.getElementById('guideClose'); if(g&&g.offsetParent){g.click();return;} const b=document.getElementById('dlgBox'); if(b)b.click();})()`,false); await sleep(250);}};
await clear();
await page.eval(`(()=>{const rv=window.__rv,c=document.getElementById('roomCanvas').getBoundingClientRect();
  const sp=rv.screenPosOf('banjiha-dresser:1');
  window.__drag.begin('beansprout',document.getElementById('cropThumb').src,{clientX:c.left+c.width*0.9,clientY:c.top+40});
  window.__drag.move({clientX:c.left+sp.x,clientY:c.top+sp.y});window.__drag.end();})()`,false);
await sleep(1400); await clear();
await page.eval(`(()=>{const b=document.getElementById('placeOk'); if(b&&b.offsetParent)b.click();})()`,false);
await sleep(1200); await clear();
console.log('말풍선:', await page.eval(`(()=>{return JSON.stringify([...document.querySelectorAll('#marks .mark')]
  .map(e=>{const r=e.getBoundingClientRect(); return {글:(e.textContent||'').trim(), label:e.getAttribute('aria-label'),
    w:Math.round(r.width), h:Math.round(r.height), cls:e.className};}));})()`));
/* 몬스테라 줄이 세로로 안 쪼개지나 — 그루를 여럿 만들어 좁은 시트에서 본다 */
await page.eval(`(()=>{const S=window.__S();
  S.pots.push({id:'pot_x1',slotId:'banjiha-etagere:8',at:null,plantId:'monstera',potAsset:'monstera/pot.glb',
    daysPlanted:7,fedDays:0,wateredOnDay:0,growthId:'g:pot_x1',dliHist:[]});
  window.__redraw&&window.__redraw();})()`,false);
await sleep(600);
await page.eval(`window.__byeotSheet.open('plants')`,false); await sleep(900);
console.log('몬스테라 줄:', await page.eval(`(()=>{return JSON.stringify([...document.querySelectorAll('#plantList .siruRow')]
  .map(e=>{const r=e.getBoundingClientRect(); const nm=e.querySelector('.nm').getBoundingClientRect();
    return {h:Math.round(r.height), 이름폭:Math.round(nm.width), 단추:e.querySelectorAll('button').length};}));})()`));
await page.shot('docs/handoff/img/guidewalk/rows2.png');
console.log('예외', errs.length, errs.slice(0,2).join(' | '));
await page.close();
