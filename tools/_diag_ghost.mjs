import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const W = +(process.env.W || 390);
const page = await launch({ width: W, height: 844, dpr: 2, mobile: false });
await page.goto(`${BASE}/game.html`); await page.eval(`localStorage.clear()`,false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('window.__byeotBooted === true', 180000, 300); await sleep(6000);
const clear=async()=>{for(let i=0;i<30;i++){const b=await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`); if(!b)return;
  await page.eval(`(()=>{const g=document.getElementById('guideClose'); if(g&&g.offsetParent){g.click();return;} const b=document.getElementById('dlgBox'); if(b)b.click();})()`,false); await sleep(250);}};
await clear();
const shot=async(t)=>console.log(t, await page.eval(`(()=>{const g=document.getElementById('dragGhost');
  const cs=g?getComputedStyle(g):null; const r=g?g.getBoundingClientRect():null;
  const box=id=>{const e=document.getElementById(id); if(!e) return null; const rr=e.getBoundingClientRect();
    return {w:Math.round(rr.width),h:Math.round(rr.height),L:Math.round(rr.left),T:Math.round(rr.top),보임:!!e.offsetParent};};
  return JSON.stringify({폭:innerWidth,
    유령:{보임:cs?cs.display:null, 그림:(cs?cs.backgroundImage:'').slice(0,60),
      w:r?Math.round(r.width):0, h:r?Math.round(r.height):0, cls:g?g.className:null},
    바:box('btnMusic'), 액션바:(()=>{const e=document.querySelector('.actionbar');
      if(!e)return null; const rr=e.getBoundingClientRect();
      return {w:Math.round(rr.width),h:Math.round(rr.height),L:Math.round(rr.left),T:Math.round(rr.top)};})(),
    아래띠:box('bottom')});})()`));
await shot('가만히 :');
/* 시루를 방에 놓고 → 그 시루를 방에서 집어 옮겨 본다(박사님이 한 그 손짓) */
await page.eval(`(()=>{const rv=window.__rv,c=document.getElementById('roomCanvas').getBoundingClientRect();
  const sp=rv.screenPosOf('banjiha-dresser:1');
  window.__drag.begin('beansprout',document.getElementById('cropThumb').src,{clientX:c.left+c.width*0.9,clientY:c.top+40});
  window.__drag.move({clientX:c.left+sp.x,clientY:c.top+sp.y});window.__drag.end();})()`,false);
await sleep(1400); await clear();
await page.eval(`(()=>{const b=document.getElementById('placeOk'); if(b&&b.offsetParent)b.click();})()`,false);
await sleep(1000); await clear();
await page.eval(`(()=>{ const rv=window.__rv; const r=rv.plants()[0];
  window.__picked.clear(); window.__picked.select(r.key); window.__picked.beginMove(); })()`,false);
await sleep(600);
await page.eval(`(()=>{const c=document.getElementById('roomCanvas').getBoundingClientRect();
  window.__picked.down({clientX:c.left+c.width*0.5, clientY:c.top+c.height*0.6});
  window.__picked.dragTo(40, 20); })()`,false);
await sleep(700);
await shot('옮기는 중:');
await page.shot('docs/handoff/img/guidewalk/ghost.png');
await page.close();
