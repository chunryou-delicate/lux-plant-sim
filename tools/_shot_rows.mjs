import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const page = await launch({ width: 390, height: 844, dpr: 2, mobile: false });
await page.goto(`${BASE}/game.html`); await page.eval(`localStorage.clear()`,false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('window.__byeotBooted === true', 180000, 300); await sleep(6000);
const clear=async()=>{for(let i=0;i<30;i++){const b=await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`); if(!b)return;
  await page.eval(`(()=>{const g=document.getElementById('guideClose'); if(g&&g.offsetParent){g.click();return;} const b=document.getElementById('dlgBox'); if(b)b.click();})()`,false); await sleep(250);}};
await clear();
const waitAct=async(ms=15000)=>{const t0=Date.now();const a=()=>page.eval(`(()=>{try{return !!window.__byeotWalkSfx().acting}catch{return false}})()`);
  for(let i=0;i<6;i++){if(await a())break;await sleep(120);} while(Date.now()-t0<ms){if(!(await a())){await sleep(250);return}await sleep(250);}};
const rowAct=async(act)=>{for(let k=0;k<8;k++){const hit=await page.eval(`(()=>{const b=[...document.querySelectorAll('#siruList button[data-act="${act}"]')].find(x=>!x.disabled); if(!b)return false; b.click(); return true;})()`); if(!hit)break; await waitAct(); await sleep(350); await clear();}};
await page.eval(`(()=>{const rv=window.__rv,c=document.getElementById('roomCanvas').getBoundingClientRect();
  const sp=rv.screenPosOf('banjiha-dresser:1');
  window.__drag.begin('beansprout',document.getElementById('cropThumb').src,{clientX:c.left+c.width*0.9,clientY:c.top+40});
  window.__drag.move({clientX:c.left+sp.x,clientY:c.top+sp.y});window.__drag.end();})()`,false);
await sleep(1200);
await page.eval(`(()=>{const S=window.__S(); S.shop.stock.bean_seed=9;})()`,false);
await page.eval(`window.__byeotSheet.open('plants')`,false); await sleep(500);
for(let i=0;i<60;i++){ if(await page.eval(`window.__S().pots.length>0`))break;
  await page.eval(`(()=>{const S=window.__S(); if(S.stamina)S.stamina.usedToday=0;})()`,false);
  await rowAct('plant'); await rowAct('water'); await rowAct('harvest'); await rowAct('sow');
  await page.eval(`(()=>{try{document.getElementById('next').click()}catch{}})()`,false); await sleep(900); await clear(); }
for(let d=0;d<3;d++){ await page.eval(`(()=>{try{document.getElementById('next').click()}catch{}})()`,false); await sleep(1100); await clear(); }
await page.eval(`window.__byeotSheet.open('plants')`,false); await sleep(1000);
console.log('몬스테라 줄:', await page.eval(`(()=>{const l=document.getElementById('plantList');
  return JSON.stringify({글:(l?l.textContent:'').replace(/\s+/g,' ').trim().slice(0,140),
    막대:[...document.querySelectorAll('#plantList .pgauge>i')].map(e=>e.style.width)});})()`));
console.log('방 상자:', await page.eval(`(()=>{const b=document.getElementById('plantsBox');
  return JSON.stringify({보임:!!(b&&b.offsetParent), 머리글:!!(b&&b.querySelector('h3'))});})()`));
await page.shot('docs/handoff/img/guidewalk/rows_gauge.png');
await page.close();
