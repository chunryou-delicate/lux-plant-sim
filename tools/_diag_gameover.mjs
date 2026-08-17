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
/* 첫 플레이를 끝낸 뒤 살림이 돌아야 굶는다 — 그 상태를 만든다 */
await page.eval(`(()=>{ const S=window.__S();
  if(S.firstPlay){ S.firstPlay.completed=true; S.firstPlay.enabled=false; }
  S.tutorial.enabled=true; S.tutorial.cashWon=0; window.__redraw&&window.__redraw(); })()`,false);
await sleep(600);
const st=()=>page.eval(`(()=>{const S=window.__S(), el=document.getElementById('gameOver');
  return JSON.stringify({살림일:S.tutorial.day, 지갑:S.tutorial.cashWon, 굶기시작:S.tutorial.brokeSinceDay,
    죽음:!!S.tutorial.starved, 덮개:!!(el&&el.classList.contains('on')),
    글:(el?el.textContent:'').replace(/\s+/g,' ').trim().slice(0,110)});})()`);
for (let i=0;i<13;i++){
  await page.eval(`(()=>{try{document.getElementById('next').click()}catch{}})()`,false);
  await sleep(1000); await clear();
  const v=JSON.parse(await st());
  if (v.덮개 || i%4===0) console.log(`  ${i}회 :`, JSON.stringify(v));
  if (v.덮개) break;
}
await page.shot('docs/handoff/img/guidewalk/gameover.png');
console.log('나가는 문:', await page.eval(`(()=>{const b=document.getElementById('gameOverAgain');
  return JSON.stringify({보임:!!(b&&b.offsetParent), 글:(b&&b.textContent||'').trim()});})()`));
console.log('예외', errs.length, errs.slice(0,2).join(' | '));
await page.close();
