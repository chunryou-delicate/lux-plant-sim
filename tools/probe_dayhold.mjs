/* 하루치가 다 흐르면 시계가 **정말 서나** (박사님 민원 ①)
   ⚠ 한 바퀴가 576초다. 줄여서 재는 길이 없으므로 **실제로 기다린다** — 자가 재는 대상보다
     오래 살면 안 되므로 제한을 넉넉히 두되 반드시 끝나게 한다. */
import { launch, sleep } from './test_cdp.mjs';
const _wd = setTimeout(() => { console.error('⏱ 자가 제한 초과'); process.exit(2); }, 900000);
_wd.unref && _wd.unref(); process.on('exit', () => clearTimeout(_wd));
const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const page = await launch({ width: 900, height: 700, dpr: 1, mobile: false });
await page.goto(`${BASE}/game.html`);
await page.eval(`localStorage.clear()`, false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('window.__byeotBooted === true', 180000, 300);
await sleep(6000);
for (let i = 0; i < 40; i++) {
  const busy = await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');
    return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`);
  if (!busy) break;
  await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s)s.click();
    const b=document.getElementById('dlgBox'); if(b)b.click();
    const g=document.getElementById('guideClose'); if(g)g.click();})()`, false);
  await sleep(250);
}
/* ⚠ [다음 날] 은 시루를 놓기 전엔 잠겨 있다(§2.9). 잠겨 있으면 시계는 서기만 한다 —
   그것도 맞는 동작이라, **놓은 판**과 **안 놓은 판**을 갈라 재야 한다. */
const PLACE = process.env.BYEOT_PLACE !== '0';
if (PLACE) {
  await page.eval(`(()=>{ const rv=window.__rv, c=document.getElementById('roomCanvas').getBoundingClientRect();
    const sp=rv.screenPosOf('banjiha-sill:0');
    window.__drag.begin('beansprout','', {clientX:c.left+c.width*0.9, clientY:c.top+40});
    window.__drag.move({clientX:c.left+sp.x, clientY:c.top+sp.y}); window.__drag.end(); })()`, false);
  await sleep(1500);
  for (let i = 0; i < 30; i++) {
    const busy = await page.eval(`document.getElementById('stage').classList.contains('talking')`);
    if (!busy) break;
    await page.eval(`(()=>{const b=document.getElementById('dlgBox'); if(b)b.click();})()`, false);
    await sleep(300);
  }
  await page.eval(`(()=>{const b=document.getElementById('placeOk'); if(b&&b.offsetParent)b.click();})()`, false);
  await sleep(1200);
  await page.eval(`(()=>{const c=document.getElementById('coachClose'); if(c)c.click();})()`, false);
  await sleep(400);
}
console.log('시루 놓기:', PLACE ? '놓음' : '안 놓음', '· [다음 날] 잠김?',
  await page.eval(`document.getElementById('next').disabled`));

const read = async () => JSON.parse(await page.eval(`JSON.stringify({
  c: window.__dayClock(), 시각: (document.getElementById('resWhen')||{}).textContent,
  날: (document.getElementById('resDay')||{}).textContent })`));
const t0 = Date.now();
let last = null;
for (let i = 0; i <= 13; i++) {
  const r = await read();
  console.log(`${String(Math.round((Date.now()-t0)/1000)).padStart(4)}초  elapsed=${String(r.c.elapsed01).padEnd(7)} held=${r.c.held?'예':'아니오'}  ${r.시각}  ${r.날}`);
  last = r;
  if (r.c.held || r.날 !== 'Day 0') break;
  await sleep(50000);
}
console.log(last && last.날 !== 'Day 0' ? '⇒ ★ 하루가 저절로 넘어갔다: ' + last.날
          : last && last.c.held ? '⇒ 시계가 섰다(하루를 못 넘기는 판이다)'
          : '⇒ ⚠ 아직 아무 일도 없다 — 더 기다려야 한다');
await page.close();
