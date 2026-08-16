/* 시각별로 방이 얼마나 밝나 — 「낮인데 까맣다」를 잰다 (2026-08-16) */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const page = await launch({ width: 390, height: 844, dpr: 2, mobile: false });
await page.goto(`${BASE}/game.html`);
await page.eval(`localStorage.clear()`, false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 180000, 300);
await page.waitFor('window.__byeotBooted === true', 180000, 300);
await sleep(6000);
/* 대사·안내를 걷어낸다 — 사진을 가린다 */
for (let i=0;i<40;i++){
  const busy = await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');
    return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`);
  if(!busy) break;
  await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s)s.click();
    const b=document.getElementById('dlgBox'); if(b)b.click();
    const g=document.getElementById('guideClose'); if(g)g.click();})()`, false);
  await sleep(250);
}
const has = await page.eval(`typeof window.__rv.setDaylight`);
console.log('setDaylight:', has);
for (const t of ['dawn','morning','noon','afternoon','evening','night']) {
  try { await page.eval(`window.__rv.setDaylight(${JSON.stringify(t)})`, false); } catch(e) {}
  await sleep(1400);
  await page.shot(`docs/handoff/img/dark/day_${t}.png`);
}
await page.close();
