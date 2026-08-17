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
/* 선물 몬스테라가 온 상태 + 화분 둘(검은 모종포트 · 사각) */
await page.eval(`(()=>{ const S=window.__S();
  if(S.firstPlay&&S.firstPlay.monstera) S.firstPlay.monstera.arrived=true;
  S.shop.stock.pot=1; S.shop.stock.pot_concrete_square=1; S.shop.stock.monstera_seed=2;
  if(S.stamina) S.stamina.usedToday=0; window.__redraw&&window.__redraw(); })()`,false);
await sleep(500);
const urls=[]; page.on((m,p)=>{ if(m==='Network.requestWillBeSent' && /\.glb/i.test(p.request?.url||'')) urls.push((p.request.url.split('/assets/')[1]||'').split('?')[0]); });
await page.eval(`window.__placePot('monsteraSeed:pot')`,false); await sleep(2200); await clear();
console.log('검은 모종포트 GLB:', JSON.stringify(urls.filter(u=>/pot/i.test(u))));
console.log('빈 화분:', await page.eval(`(()=>{const S=window.__S();
  return JSON.stringify((S.emptyPots||[]).map(e=>({id:e.id,itemId:e.itemId,potAsset:e.potAsset})));})()`));
/* 그 빈 화분을 골라 본다 — [심기]가 뜨나 · 붙든 것이 그 화분인가 */
console.log('고르기:', await page.eval(`(()=>{ try{
  const S=window.__S(), ep=(S.emptyPots||[])[0];
  const key = ep.slotId || ('free:'+ep.id);
  window.__picked.clear(); window.__picked.select(key); window.__picked.beginMove();
  const b=document.getElementById('pickSow');
  const r = { 열쇠:key, 붙든것:window.__picked.potId, 빈화분:window.__picked.emptyPot,
              심기단추:!!(b&&b.style.display!=='none') };
  window.__picked.clear(); return JSON.stringify(r);
}catch(e){return 'ERR '+e.message;} })()`));
/* 옮기면 그 화분이 움직이나 — 선물 몬스테라는 그대로여야 한다 */
console.log('옮기기:', await page.eval(`(()=>{ try{
  const S=window.__S(), ep=(S.emptyPots||[])[0], gift=S.pots[0];
  const before={ gift:{...gift.at}, ep:{...ep.at} };
  const at={ x:-1.0, y:0, z:0.5 };
  window.__commitForProbe ? window.__commitForProbe(ep.id, at) : null;
  return JSON.stringify({전:before});
}catch(e){return 'ERR '+e.message;} })()`));
console.log('예외', errs.length, errs.slice(0,2).join(' | '));
await page.close();
