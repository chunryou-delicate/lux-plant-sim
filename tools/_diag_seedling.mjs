import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const page = await launch({ width: 390, height: 844, dpr: 2, mobile: false });
await page.goto(`${BASE}/game.html`); await page.eval(`localStorage.clear()`,false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('window.__byeotBooted === true', 180000, 300); await sleep(7000);
const clear=async()=>{for(let i=0;i<30;i++){const b=await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`); if(!b)return;
  await page.eval(`(()=>{const g=document.getElementById('guideClose'); if(g&&g.offsetParent){g.click();return;} const b=document.getElementById('dlgBox'); if(b)b.click();})()`,false); await sleep(250);}};
await clear();
await page.eval(`(()=>{const S=window.__S();
  if(S.firstPlay){S.firstPlay.monstera.arrived=true; S.firstPlay.completed=true; S.firstPlay.enabled=false;}
  S.shop.stock.pot_concrete_square=1; S.shop.stock.monstera_seed=2;
  if(S.stamina)S.stamina.usedToday=0; window.__redraw&&window.__redraw();})()`,false);
await sleep(600);
await page.eval(`window.__placePot('monsteraSeed:pot_concrete_square')`,false); await sleep(1600); await clear();
await page.eval(`window.__byeotSheet.open('plants')`,false); await sleep(700);
await page.eval(`(()=>{const b=[...document.querySelectorAll('#emptyPotList [data-sow]')][0]; if(b)b.click();})()`,false);
await sleep(1200);
await page.eval(`(()=>{ for(const b of document.querySelectorAll('button')){
  if(/몬스테라/.test(b.textContent||'') && b.offsetParent && !b.disabled){b.click(); return;} } })()`,false);
await sleep(2200); await clear();
await page.eval(`(()=>{try{window.__byeotSheet.close()}catch{}})()`,false); await sleep(400);
const dump=async(t)=>console.log(t, await page.eval(`(()=>{const rv=window.__rv, S=window.__S();
  const rows=rv.plants().filter(r=>r.kind==='monstera'||r.kind==='emptypot').map(r=>({key:r.key,kind:r.kind,생장일:r.growthDays}));
  const turn=(()=>{try{const t=window.__turn&&window.__turn(); return (t&&t.plants||[]).map(x=>({potId:x.potId, eff:x.effectiveGrowthDays}));}catch{return null;}})();
  return JSON.stringify({방:rows, 턴:turn, 그루:S.pots.map(p=>p.id)});})()`));
await dump('심은 직후:');
for(let i=0;i<3;i++){ await page.eval(`(()=>{try{document.getElementById('next').click()}catch{}})()`,false); await sleep(1200); await clear(); }
await dump('3일 뒤  :');
await page.close();
