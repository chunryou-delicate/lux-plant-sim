/* 확대축소가 「턱턱」 걸리는 까닭 — 프레임 간격과 거리 변화를 같이 잰다 (2026-08-16) */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const page = await launch({ width: 1280, height: 900, dpr: 1, mobile: false });
await page.goto(`${BASE}/game.html`);
await page.eval(`localStorage.clear()`, false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 180000, 300);
await page.waitFor('window.__byeotBooted === true', 180000, 300);
await sleep(7000);
for (let i=0;i<40;i++){
  const busy = await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');
    return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`);
  if(!busy) break;
  await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s)s.click();
    const b=document.getElementById('dlgBox'); if(b)b.click();
    const g=document.getElementById('guideClose'); if(g)g.click();})()`, false);
  await sleep(220);
}
/* 프레임 간격을 재는 고리를 건다 */
await page.eval(`(()=>{ window.__ft=[]; let last=performance.now();
  const tick=()=>{ const t=performance.now(); window.__ft.push(+(t-last).toFixed(1)); last=t;
    if(window.__ft.length<600) requestAnimationFrame(tick); };
  requestAnimationFrame(tick); })()`, false);
/* 휠을 스무 번 굴린다 — 사람이 하는 것과 같은 간격(40ms) */
const dists = [];
for (let i = 0; i < 20; i++) {
  await page.eval(`(()=>{ const c=document.getElementById('roomCanvas'); const r=c.getBoundingClientRect();
    c.dispatchEvent(new WheelEvent('wheel',{deltaY: ${i<10?-100:100}, clientX:r.left+r.width/2, clientY:r.top+r.height/2, bubbles:true, cancelable:true})); })()`, false);
  await sleep(40);
  dists.push(await page.eval(`+window.__rv.camera ? 0 : 0`).catch(()=>0));
}
await sleep(900);
const out = await page.eval(`(()=>{ const f=(window.__ft||[]).slice(20);
  const s=[...f].sort((a,b)=>a-b);
  const p=(q)=>s[Math.floor(s.length*q)]||0;
  return JSON.stringify({ 프레임수:f.length, 중앙값:p(.5), p90:p(.9), p99:p(.99), 최대:s[s.length-1],
    '33ms넘김': f.filter(v=>v>33).length, '100ms넘김': f.filter(v=>v>100).length }); })()`);
console.log('휠 20번 동안 프레임 간격(ms):', out);
await page.close();
