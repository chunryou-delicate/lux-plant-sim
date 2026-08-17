/* 선물 몬스테라가 **가방에 남아 있나** — 하루가 가도 자동으로 안 앉는가 */
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
const waitAct=async(ms=15000)=>{const t0=Date.now();const a=()=>page.eval(`(()=>{try{return !!window.__byeotWalkSfx().acting}catch{return false}})()`);
  for(let i=0;i<6;i++){if(await a())break;await sleep(120);} while(Date.now()-t0<ms){if(!(await a())){await sleep(250);return}await sleep(250);}};
const rowAct=async(act)=>{for(let k=0;k<8;k++){const hit=await page.eval(`(()=>{const b=[...document.querySelectorAll('#siruList button[data-act="${act}"]')].find(x=>!x.disabled); if(!b)return false; b.click(); return true;})()`); if(!hit)break; await waitAct(); await sleep(350); await clear();}};
await page.eval(`(()=>{const rv=window.__rv,c=document.getElementById('roomCanvas').getBoundingClientRect();
  const sp=rv.screenPosOf('banjiha-dresser:1');
  window.__drag.begin('beansprout',document.getElementById('cropThumb').src,{clientX:c.left+c.width*0.9,clientY:c.top+40});
  window.__drag.move({clientX:c.left+sp.x,clientY:c.top+sp.y});window.__drag.end();})()`,false);
await sleep(1300);
await page.eval(`(()=>{const S=window.__S(); S.shop.stock.bean_seed=9;})()`,false);
await page.eval(`(()=>{const b=document.getElementById('placeOk'); if(b&&b.offsetParent)b.click();})()`,false);
await sleep(900); await clear();
await page.eval(`window.__byeotSheet.open('plants')`,false); await sleep(500);
for(let i=0;i<60;i++){ if(await page.eval(`window.__S().pots.length>0`))break;
  await page.eval(`(()=>{const S=window.__S(); if(S.stamina)S.stamina.usedToday=0;})()`,false);
  await rowAct('plant'); await rowAct('water'); await rowAct('harvest'); await rowAct('sow');
  await page.eval(`(()=>{try{document.getElementById('next').click()}catch{}})()`,false); await sleep(900); await clear(); }
const st=()=>page.eval(`(()=>{const S=window.__S(); const p=S.pots[0];
  const rv=window.__rv; const inRoom=rv.plants().some(r=>r.kind==='monstera');
  return JSON.stringify({그루:p?{id:p.id,slot:p.slotId,at:!!p.at,놓인적:p.placedOnce}:null, 방에있나:inRoom});})()`);
console.log('도착 직후:', await st());
for(let i=0;i<3;i++){ await page.eval(`(()=>{try{document.getElementById('next').click()}catch{}})()`,false); await sleep(1100); await clear(); }
console.log('사흘 뒤  :', await st());
console.log('예외', errs.length, errs.slice(0,2).join(' | '));
await page.close();
