/* 첫 [다음 날]에 월세 대사와 가계부가 뜨나 (2026-08-16) */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const page = await launch({ width: 390, height: 844, dpr: 2, mobile: false });
const errs=[]; page.on(m=>{ if(m.method==='Runtime.exceptionThrown') errs.push((m.params.exceptionDetails.exception||{}).description||''); });
await page.goto(`${BASE}/game.html`);
await page.eval(`localStorage.clear()`, false);
await page.goto(`${BASE}/game.html?fast=1`);
await page.waitFor('!!window.__rv', 180000, 300);
await page.waitFor('window.__byeotBooted === true', 180000, 300);
await sleep(7000);
const walk = async () => { for (let i=0;i<50;i++){
  const busy = await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');
    return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`);
  if(!busy) return;
  await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s)s.click();
    const b=document.getElementById('dlgBox'); if(b)b.click();
    const g=document.getElementById('guideClose'); if(g)g.click();})()`, false);
  await sleep(220);
} };
await walk();
/* 시루를 놓아야 [다음 날]이 열린다 */
await page.eval(`(()=>{ const S=window.__S();
  const slots=(window.__io.light.room.slots)||[]; const dark=slots.find(s=>/etagere|dresser/.test(s.slotId))||slots[0];
  window.__testPlace = dark && dark.slotId; return dark && dark.slotId; })()`);
const before = await page.eval(`JSON.stringify({ day: window.__S().day, tday: window.__S().tutorial.day, cash: window.__S().tutorial.cashWon })`);
console.log('누르기 전:', before);
/* 시루 놓기 — 화면 길로 */
await page.eval(`(()=>{ const b=document.getElementById('cropThumb'); if(b) b.click(); })()`, false);
await sleep(600);
await page.eval(`(()=>{ const c=document.getElementById('roomCanvas'); if(!c) return;
  const r=c.getBoundingClientRect();
  const ev=(t,x,y)=>c.dispatchEvent(new PointerEvent(t,{clientX:x,clientY:y,bubbles:true,pointerId:1}));
  const x=r.left+r.width*0.4, y=r.top+r.height*0.65;
  ev('pointerdown',x,y); ev('pointerup',x,y); })()`, false);
await sleep(1200);
const nx = await page.eval(`(()=>{const b=document.getElementById('next'); return b? !b.disabled : 'no-btn';})()`);
console.log('[다음 날] 눌리나:', nx);
await page.eval(`(()=>{const b=document.getElementById('next'); if(b&&!b.disabled) b.click();})()`, false);
await sleep(4000);
const said = await page.eval(`(()=>{ const t=document.getElementById('dlgText');
  return JSON.stringify({ 대사: t? (t.textContent||'').trim().slice(0,60):null,
    월가계부: !!(document.getElementById('monthPanel')||{}).classList &&
      document.getElementById('monthPanel').classList.contains('on') }); })()`);
console.log('누른 뒤:', said);
const after = await page.eval(`JSON.stringify({ day: window.__S().day, tday: window.__S().tutorial.day, cash: window.__S().tutorial.cashWon, rent: window.__S().tutorial.rent })`);
console.log('상태:', after, '· 예외', errs.length);
await page.shot('docs/handoff/img/day1/after_next.png');
await page.close();
