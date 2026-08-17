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
/* 무순 재배판을 방에 세운다 — 코어 창구로(재려는 것은 **집기**다) */
await page.eval(`(()=>{ const S=window.__S();
  if(S.firstPlay&&S.firstPlay.monstera) S.firstPlay.monstera.arrived=true;
  S.shop.stock.sprout_tray=1; S.shop.stock.radish_seed=1;
  if(S.stamina) S.stamina.usedToday=0; window.__redraw&&window.__redraw(); })()`,false);
await sleep(600);
await page.eval(`(()=>{ const rv=window.__rv, c=document.getElementById('roomCanvas').getBoundingClientRect();
  const sp=rv.screenPosOf('banjiha-desk:0');
  window.__drag.begin('musun', document.getElementById('musunThumb')?document.getElementById('musunThumb').src:'', {clientX:c.left+20, clientY:c.top+20});
  window.__drag.move({clientX:c.left+sp.x, clientY:c.top+sp.y}); window.__drag.end(); })()`,false);
await sleep(1800); await clear();
console.log('놓인 작물:', await page.eval(`(()=>{ const S=window.__S();
  try { return JSON.stringify((window.__cropRowsForProbe||(()=>[]))()); } catch(e){}
  const rv=window.__rv; return JSON.stringify(rv.plants().map(r=>({key:r.key,kind:r.kind}))); })()`));
console.log('집기:', await page.eval(`(()=>{ try{
  const rv=window.__rv, out=[];
  for (const r of rv.plants()) {
    if (r.kind === 'monstera' || r.kind === 'emptypot') continue;
    window.__picked.clear(); window.__picked.select(r.key); window.__picked.beginMove();
    out.push({ 열쇠:r.key, 방이본것:r.kind, 화면이본것:window.__picked.kindAt(r.key), 붙든것:window.__picked.potId });
    window.__picked.clear();
  }
  return JSON.stringify(out);
}catch(e){return 'ERR '+e.message;} })()`));
console.log('예외', errs.length, errs.slice(0,2).join(' | '));
await page.close();
