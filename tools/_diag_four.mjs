/* 오늘 마무리한 넷을 한자리에서 잰다 (2026-08-17) */
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

console.log('① 구호금 — 지갑을 0으로 만들고 하루');
await page.eval(`(()=>{const S=window.__S(); S.tutorial.cashWon=0; S.tutorial.enabled=true;
  if(S.firstPlay) S.firstPlay.completed=true;   /* ★ 본편으로 세운다 — 구호금도 등도 본편 물건이다 */
  if(S.stamina) S.stamina.usedToday=0;})()`,false); await sleep(400);
const d0=await page.eval(`window.__S().tutorial.day`);
for(let i=0;i<4;i++){
  const st=await page.eval(`(()=>{const b=document.getElementById('next');
    return JSON.stringify({있음:!!b, 잠김:!!(b&&b.disabled), 보임:!!(b&&b.offsetParent)});})()`);
  if(i===0) console.log('   [다음 날] '+st);
  await page.eval(`(()=>{const b=document.getElementById('next'); if(b)b.click();})()`,false);
  await sleep(1400); await clear();
  if(await page.eval(`window.__S().tutorial.day`) > d0) break;
}
console.log('   살림일 '+d0+' → '+await page.eval(`window.__S().tutorial.day`)
  +' · 달력일 '+await page.eval(`window.__S().day`)
  +' · 튜토켜짐 '+await page.eval(`!!window.__S().tutorial.enabled`)
  +' · 첫플 '+await page.eval(`!!(window.__S().firstPlay&&window.__S().firstPlay.enabled&&!window.__S().firstPlay.completed)`));
console.log('  ', await page.eval(`(()=>{const S=window.__S(); const el=document.getElementById('reliefBox');
  return JSON.stringify({덮개: !!(el&&el.classList.contains('on')), 액수: (document.getElementById('reliefWon')||{}).textContent,
    지갑: S.tutorial.cashWon, 받았나: S.tutorial.reliefTaken});})()`));
await page.shot('docs/handoff/img/relief.png');
await page.eval(`(()=>{const b=document.getElementById('reliefOk'); if(b)b.click();})()`,false); await sleep(500);

console.log('② 거치형 식물등 — 상점 세 줄');
await page.eval(`(()=>{const S=window.__S(); S.tutorial.lamp.unlocked=true; S.tutorial.cashWon=900000;})()`,false);
await page.eval(`window.__byeotSheet.open('shop')`,false); await sleep(1200);
await page.eval(`(()=>{const t=[...document.querySelectorAll('#shopGroups button, #shopTabs button')].find(b=>/등|모두|전체/.test(b.textContent)); if(t)t.click();})()`,false); await sleep(700);
console.log('   상점 글자수 '+await page.eval(`(document.getElementById('shopList')||{}).textContent ? document.getElementById('shopList').textContent.length : -1`));
console.log('   상점 첫 60자 '+JSON.stringify(await page.eval(`((document.getElementById('shopList')||{}).textContent||'').replace(/\s+/g,' ').slice(0,60)`)));
console.log('  ', await page.eval(`(()=>{const t=[...document.querySelectorAll('#shopList')].map(e=>e.textContent).join(' ');
  return JSON.stringify(['벽부형 식물등','집게형 식물등','거치형 식물등'].map(k=>k+(t.includes(k)?' ✔':' ✘')));})()`));
console.log('③ 시루 회수 단추');
await page.eval(`(()=>{try{window.__byeotSheet.close()}catch{}})()`,false); await sleep(400);
console.log('  ', await page.eval(`(()=>{
  const rows = window.__cropRows ? window.__cropRows() : null;
  const t=document.getElementById('pickTake');
  return JSON.stringify({단추있음: !!t, 손잡이: typeof window.__potMarks});})()`));
console.log('예외', errs.length, errs.slice(0,2).join(' | '));
await page.close();
