import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const page = await launch({ width: 390, height: 844, dpr: 2, mobile: false });
await page.goto(`${BASE}/game.html`); await page.eval(`localStorage.clear()`,false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('window.__byeotBooted === true', 180000, 300); await sleep(6000);
const clear=async()=>{for(let i=0;i<30;i++){const b=await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`); if(!b)return;
  await page.eval(`(()=>{const g=document.getElementById('guideClose'); if(g&&g.offsetParent){g.click();return;} const b=document.getElementById('dlgBox'); if(b)b.click();})()`,false); await sleep(250);}};
await clear();
const stock=()=>page.eval(`(()=>{const S=window.__S(); const st=S.shop.stock||{};
  return JSON.stringify({씨앗:st.monstera_seed||0, 검은모종포트:st.pot||0, 콘크리트사각:st.pot_concrete_square||0,
    빈화분:(S.emptyPots||[]).length, 그루:S.pots.length});})()`);
await page.eval(`(()=>{const S=window.__S(); S.shop.stock.monstera_seed=2; S.shop.stock.pot=1;
  S.shop.stock.pot_concrete_square=1; if(S.firstPlay&&S.firstPlay.monstera)S.firstPlay.monstera.arrived=true;
  if(S.stamina)S.stamina.usedToday=0; window.__redraw&&window.__redraw();})()`,false);
await sleep(600);
console.log('놓기 전 :', await stock());
console.log('놓기    :', await page.eval(`JSON.stringify(window.__placePot('monsteraSeed:pot_concrete_square'))`));
await sleep(1500); await clear();
console.log('놓은 뒤 :', await stock());
/* 놓인 빈 화분에 심기 — 무엇이 뜨나 */
await page.eval(`window.__byeotSheet.open('plants')`,false); await sleep(800);
await page.eval(`(()=>{const b=document.querySelector('#emptyPotList [data-sow]'); if(b)b.click();})()`,false);
await sleep(1200);
console.log('심기 팝업:', await page.eval(`(()=>{ const ps=[...document.querySelectorAll('.pop.on, [id$="Panel"]')]
  .filter(e=>e.offsetParent).map(e=>({id:e.id, 글:(e.textContent||'').replace(/\s+/g,' ').trim().slice(0,120)}));
  return JSON.stringify(ps);})()`));
await page.eval(`(()=>{ for(const b of document.querySelectorAll('button')){
  if(/몬스테라/.test(b.textContent||'') && b.offsetParent && !b.disabled){b.click(); return;} } })()`,false);
await sleep(1600); await clear();
console.log('심은 뒤 :', await stock());
console.log('그릇   :', await page.eval(`(()=>{const S=window.__S(); return JSON.stringify(S.pots.map(p=>({id:p.id,potAsset:p.potAsset,itemId:p.itemId})));})()`));
await page.close();
