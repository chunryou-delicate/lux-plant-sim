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
const st=()=>page.eval(`(()=>{const S=window.__S(), L=S.tutorial.lamp;
  const cell=document.getElementById('__lampbag__');
  return JSON.stringify({가짐:L.owned, 세움:L.placed, 조도가보는수:S.lamps.count,
    가방칸:!!cell, 칸글:(cell?cell.textContent:'').replace(/\s+/g,' ').trim()});})()`);
/* 해금 — 첫 개는 공짜로 가방에 */
await page.eval(`(()=>{ const S=window.__S(); S.tutorial.lamp.unlocked=true;
  if(!S.tutorial.lamp.owned) S.tutorial.lamp.owned=1;
  S.tutorial.cashWon=2000000; if(S.firstPlay) S.firstPlay.enabled=false;
  window.__redraw&&window.__redraw(); })()`,false);
await sleep(600);
await page.eval(`window.__byeotSheet.open('bag')`,false); await sleep(800);
console.log('해금 뒤 :', await st());
await page.eval(`(()=>{const b=document.getElementById('__lampbag__'); if(b)b.click();})()`,false);
await sleep(1600); await clear();
console.log('달고 나서:', await st());
/* 사면 가방으로만 — 조도는 안 오른다 */
await page.eval(`window.__byeotSheet.open('shop')`,false); await sleep(800);
await page.eval(`(()=>{const b=document.getElementById('buyLamp'); if(b)b.click();})()`,false);
await sleep(1600); await clear();
await page.eval(`window.__byeotSheet.open('bag')`,false); await sleep(800);
console.log('사고 나서:', await st());
console.log('예외', errs.length, errs.slice(0,2).join(' | '));
await page.close();
