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


/* ── 구호금 — 지갑을 0으로 만들고 하루를 보낸다 ─────────────────── */
console.log('① 구호금');
const d0 = await page.eval(`window.__S().day`);
await page.eval(`(()=>{const S=window.__S(); S.tutorial.cashWon=0;})()`,false);
for(let i=0;i<3;i++){ await page.eval(`(()=>{try{document.getElementById('next').click()}catch{}})()`,false);
  await sleep(1300); await clear(); if(await page.eval(`window.__S().day`)>d0) break; }
console.log('   달력일 '+d0+' → '+await page.eval(`window.__S().day`));
console.log('   '+await page.eval(`(()=>{const S=window.__S(); const el=document.getElementById('reliefBox');
  return JSON.stringify({덮개: !!(el&&el.classList.contains('on')),
    액수:(document.getElementById('reliefWon')||{}).textContent,
    지갑:S.tutorial.cashWon, 받았나:!!S.tutorial.reliefTaken});})()`));
await page.shot('docs/handoff/img/relief.png');
/* 두 번째 0원 — 이번엔 아무도 안 온다 */
await page.eval(`(()=>{const b=document.getElementById('reliefOk'); if(b)b.click();
  const S=window.__S(); S.tutorial.cashWon=0;})()`,false); await sleep(400);
for(let i=0;i<2;i++){ await page.eval(`(()=>{try{document.getElementById('next').click()}catch{}})()`,false); await sleep(1300); await clear(); }
console.log('   두 번째 0원 → '+await page.eval(`(()=>{const S=window.__S(); const el=document.getElementById('reliefBox');
  return JSON.stringify({덮개:!!(el&&el.classList.contains('on')), 지갑:S.tutorial.cashWon});})()`));
console.log('예외', errs.length, errs.slice(0,2).join(' | '));
await page.close();
