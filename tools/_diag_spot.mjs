import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const page = await launch({ width: 390, height: 844, dpr: 2, mobile: false });
await page.goto(`${BASE}/game.html`); await page.eval(`localStorage.clear()`,false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('window.__byeotBooted === true', 180000, 300); await sleep(6000);
const clear=async()=>{for(let i=0;i<30;i++){const b=await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`); if(!b)return;
  await page.eval(`(()=>{const g=document.getElementById('guideClose'); if(g&&g.offsetParent){g.click();return;} const b=document.getElementById('dlgBox'); if(b)b.click();})()`,false); await sleep(250);}};
await clear();
/* 가방 칸을 눌러 자동 배치 */
await page.eval(`(()=>{window.__byeotSheet.open('bag');})()`,false); await sleep(700);
await page.eval(`(()=>{const c=[...document.querySelectorAll('.bagslot[data-place]')].find(x=>/beansprout|siru/.test(x.dataset.place||''));
  if(c) c.dispatchEvent(new MouseEvent('click',{bubbles:true}));})()`,false);
await sleep(1800); await clear();
console.log('놓인 자리:', await page.eval(`(()=>{ const S=window.__S();
  const b=S.firstPlay&&S.firstPlay.beansprout; const p=((b&&b.pots)||[])[0];
  const rv=window.__rv; const rows=rv.plants().map(r=>({key:r.key,kind:r.kind,x:+r.pos.x.toFixed(2),z:+r.pos.z.toFixed(2)}));
  const size=window.__io.light.room.size;
  return JSON.stringify({ 자리:p?p.slotId:null, at:p&&p.at?{x:+p.at.x.toFixed(2),z:+p.at.z.toFixed(2),on:p.at.onUid}:null,
    방:{w:size.w,d:size.d}, 방안:rows }); })()`));
await page.shot('docs/handoff/img/guidewalk/spot.png');
await page.close();
