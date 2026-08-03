/* 식물이 자라는 게 화면에서 보이나. 논리(유효 생장일)와 3D 를 같이 잰다. */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8971';
const page = await launch({ width: 390, height: 844, dpr: 2, mobile: false });
await page.goto(`${BASE}/game.html`);
await page.eval(`localStorage.clear()`, false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 120000, 300);
await sleep(6000);
await page.eval(`(()=>{try{document.getElementById('dlgSkip').click()}catch{}})()`, false); await sleep(1000);
await page.eval(`(()=>{try{document.getElementById('guideClose').click()}catch{}})()`, false); await sleep(600);
/* 어두운 자리에 시루 → 4일 → 몬스테라 도착 → 창턱으로 */
await page.eval(`(()=>{ const rv=window.__rv, c=document.getElementById('roomCanvas').getBoundingClientRect();
  const sp=rv.screenPosOf('banjiha-dresser:1');
  window.__drag.begin('beansprout', document.getElementById('cropThumb').src, {clientX:c.left+c.width*0.9, clientY:c.top+40});
  window.__drag.move({clientX:c.left+sp.x, clientY:c.top+sp.y}); window.__drag.end(); })()`, false);
await sleep(1200);
const skip = async () => { for (let i=0;i<12;i++){ const t = await page.eval(`document.getElementById('stage').classList.contains('talking')`);
  if (!t) break; await page.eval(`document.getElementById('dlgBox').click()`, false); await sleep(250);} };
for (let i=0;i<4;i++){ await page.eval(`document.getElementById('next').click()`, false); await sleep(1100); await skip(); }
await page.eval(`(()=>{ const S=window.__S(); window.__io.light.clearCache();
  const slots=window.__io.light.room.slots;
  window.__setPotSlotForProbe = 1; })()`, false);
/* 창턱으로 옮긴다 — 드롭다운 경로가 제일 확실하다 */
await page.eval(`(()=>{ const s=document.getElementById('slot'); s.value='banjiha-sill:0';
  s.dispatchEvent(new Event('change',{bubbles:true})); })()`, false);
await sleep(1500); await skip();
const snap = async () => page.eval(`(()=>{ const rv=window.__rv, S=window.__S();
  const p = rv.plants()[0];
  let ls=null; try { ls = window.__io.growth.leafStats(); } catch(e) {}
  let gd=null; try { gd = window.__io.growth.growthDays(); } catch(e) {}
  const ph = (S.firstPlay.monstera||{}).growthPhase || null;
  return { day:S.day, growthDays:gd, leaves: ls&&ls.leaves, mature: ls&&ls.matureLeaves,
           phase: ph && ph.phaseId, prog: ph && ph.progress01,
           potY: p ? +p.pos.y.toFixed(3) : null, key: p ? p.key : null }; })()`);
const rows = [await snap()];
for (let i=0;i<10;i++){ await page.eval(`document.getElementById('next').click()`, false); await sleep(1000); await skip(); rows.push(await snap()); }
for (const r of rows) console.log(JSON.stringify(r));
await page.close();
