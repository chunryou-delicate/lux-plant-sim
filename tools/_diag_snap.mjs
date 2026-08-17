/* 끄는 동안 보여 준 자리와 **실제로 놓인 자리**가 같은가 (박사님: "자리 스냅이랑 위치
   미리보기가 이상하다") — 화면 좌표가 아니라 **방 좌표**로 잰다. */
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
/* 시루를 끌면서 **마지막 미리보기**와 **놓인 자리**를 견준다 */
const pts = [[0.30,0.62],[0.55,0.70],[0.72,0.58],[0.45,0.80]];
for (const [fx,fy] of pts) {
  const r = await page.eval(`(async ()=>{ try {
    const c=document.getElementById('roomCanvas').getBoundingClientRect();
    const x=c.left+c.width*${fx}, y=c.top+c.height*${fy};
    const thumb=document.getElementById('cropThumb');
    if(!thumb) return 'no-thumb';
    window.__drag.begin('beansprout', thumb.src, {clientX:c.left+10, clientY:c.top+10});
    window.__drag.move({clientX:x, clientY:y});
    await new Promise(r=>setTimeout(r,220));
    /* 끄는 동안 방이 그리고 있는 유령의 자리 */
    let ghost=null; try { ghost = window.__rv.previewPos ? window.__rv.previewPos() : null; } catch(e){}
    const hit = window.__freePlaceHitForProbe || null;
    window.__drag.move({clientX:x, clientY:y});
    window.__drag.end();
    await new Promise(r=>setTimeout(r,900));
    const S=window.__S(); const b=S.firstPlay.beansprout;
    const last=((b&&b.pots)||[]).filter(p=>p&&p.at).slice(-1)[0];
    return JSON.stringify({ 미리:ghost, 놓임:last?{x:+last.at.x.toFixed(3),z:+last.at.z.toFixed(3),on:last.at.onUid||null}:null });
  } catch(e){ return 'ERR '+(e&&e.message); } })()`);
  console.log(`  (${fx},${fy}) →`, r);
  await clear();
}
console.log('예외', errs.length, errs.slice(0,2).join(' | '));
await page.close();
