import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const page = await launch({ width: 390, height: 844, dpr: 2, mobile: false });
await page.goto(`${BASE}/game.html`); await page.eval(`localStorage.clear()`,false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('window.__byeotBooted === true', 180000, 300); await sleep(6000);
const clear=async()=>{for(let i=0;i<30;i++){const b=await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`); if(!b)return;
  await page.eval(`(()=>{const g=document.getElementById('guideClose'); if(g&&g.offsetParent){g.click();return;} const b=document.getElementById('dlgBox'); if(b)b.click();})()`,false); await sleep(250);}};
await clear();
/* 몬스테라를 하나 세우고 **마르게** 만든다 */
await page.eval(`(()=>{ const S=window.__S(), io=window.__io;
  if(S.firstPlay&&S.firstPlay.monstera) S.firstPlay.monstera.arrived=true;
  const sl=(io.light.room.slots||[]).find(x=>/etagere:8$/.test(x.slotId));
  S.pots.push({id:'pot_m', slotId:sl.slotId, at:{x:sl.x,y:sl.y,z:sl.z,rotY:0,onUid:'banjiha-etagere',occIdx:sl.occIdx??null},
    plantId:'monstera', potAsset:'monstera/pot.glb', variegated:false, daysPlanted:9, fedDays:0,
    arrivedOnDay:0, wateredOnDay:-7, growthId:'__main__', dliHist:[]});
  window.__redraw&&window.__redraw(); })()`,false);
await sleep(1500);
console.log('물 상태:', await page.eval(`(()=>{ const S=window.__S();
  const p=S.pots.find(x=>x.id==='pot_m');
  let w=null; try{ w=window.__potWaterForProbe? null : null; }catch{}
  return JSON.stringify({자리:p.slotId, 마지막물:p.wateredOnDay, 오늘:S.day}); })()`));
console.log('말풍선:', await page.eval(`(()=>JSON.stringify([...document.querySelectorAll('#marks .mark')]
  .map(e=>({글:(e.getAttribute('aria-label')||e.textContent||'').trim(), key:e.dataset.key}))))()`));
console.log('아래 단추:', await page.eval(`(()=>{const b=document.getElementById('waterPot');
  const r=b?b.getBoundingClientRect():null;
  return JSON.stringify({보임:!!(b&&b.offsetParent), 글:(b&&b.textContent||'').trim().slice(0,40),
    w:r?Math.round(r.width):0, h:r?Math.round(r.height):0});})()`));
await page.shot('docs/handoff/img/guidewalk/potmark.png');
await page.close();
