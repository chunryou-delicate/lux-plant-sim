/* 식물이 자라는 게 화면에서 보이나. 논리(유효 생장일)와 3D 를 같이 잰다. */
import { launch, sleep } from './test_cdp.mjs';

/* ★자가 제한 — 재는 도구가 재는 대상보다 오래 살면 안 된다.
   이게 없어서 측정 하나가 21시간 매달려 있었다. 헤드리스 크롬은 무언가를
   기다리다 영영 안 끝나는 일이 실제로 생긴다. 시간은 환경변수로 늘릴 수 있다. */
const _WATCHDOG_MS = +(process.env.BYEOT_PROBE_TIMEOUT_MS || 300000);
const _wd = setTimeout(() => {
  console.error('⏱ 자가 제한 ' + Math.round(_WATCHDOG_MS / 1000) + '초를 넘겨 멈춥니다 — 재는 중에 멈춘 것입니다.');
  process.exit(2);
}, _WATCHDOG_MS);
process.on('exit', () => clearTimeout(_wd));

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
           potY: p ? +p.pos.y.toFixed(3) : null,
           오늘: (document.getElementById('plantToday')||{}).textContent || '' }; })()`);
const rows = [await snap()];
for (let i=0;i<10;i++){ await page.eval(`document.getElementById('next').click()`, false); await sleep(1000); await skip(); rows.push(await snap()); }
for (const r of rows) console.log(JSON.stringify(r));
await page.close();
