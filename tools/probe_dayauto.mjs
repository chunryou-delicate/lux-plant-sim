/* 하루가 **저절로 넘어가나** (박사님 2026-08-19 확정: "넘긴다 — 실시간 진행")
   ------------------------------------------------------------
   ⚠ 한 바퀴가 576초다. 그래서 `window.__dayClockSkip` 으로 **하루치 끝자락(0.999)까지만**
     밀어 놓고, 마지막 한 걸음은 **게임이 스스로 넘게** 둔다. 경계를 자가 넘어 버리면
     제가 만든 결과를 보는 것이라 아무것도 안 잰 것이 된다.
   재는 것 셋: ① 시루를 놓기 전엔 **안 넘어간다**(서고 까닭을 적는다)
              ② 놓은 뒤엔 **넘어간다**   ③ 넘어간 뒤 시계가 **6시로 되돌아간다** */
import { launch, sleep } from './test_cdp.mjs';
const _wd = setTimeout(() => { console.error('⏱ 자가 제한 초과'); process.exit(2); }, 400000);
_wd.unref && _wd.unref(); process.on('exit', () => clearTimeout(_wd));
const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const page = await launch({ width: 1000, height: 800, dpr: 1, mobile: false });
await page.goto(`${BASE}/game.html`);
await page.eval(`localStorage.clear()`, false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('window.__byeotBooted === true', 180000, 300);
await sleep(6000);
const clear = async () => { for (let i = 0; i < 40; i++) {
  const busy = await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');
    return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`);
  if (!busy) return;
  await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s)s.click();
    const b=document.getElementById('dlgBox'); if(b)b.click();
    const g=document.getElementById('guideClose'); if(g)g.click();})()`, false);
  await sleep(250); } };
await clear();
const read = async () => JSON.parse(await page.eval(`JSON.stringify({
  c: window.__dayClock(), 시각: (document.getElementById('resWhen')||{}).textContent,
  날: (document.getElementById('resDay')||{}).textContent,
  돈: (document.getElementById('resMoney')||{}).textContent })`));

console.log('① 시루를 놓기 전 — 하루치 끝으로 밀어 놓는다');
await page.eval(`window.__dayClockSkip(0.999)`, false);
await sleep(4000);
console.log('   ', JSON.stringify(await read()));

console.log('② 시루를 놓고 다시 민다');
await page.eval(`(()=>{ const rv=window.__rv, c=document.getElementById('roomCanvas').getBoundingClientRect();
  const sp=rv.screenPosOf('banjiha-sill:0');
  window.__drag.begin('beansprout','', {clientX:c.left+c.width*0.9, clientY:c.top+40});
  window.__drag.move({clientX:c.left+sp.x, clientY:c.top+sp.y}); window.__drag.end(); })()`, false);
await sleep(1500);
await clear();
await page.eval(`(()=>{const b=document.getElementById('placeOk'); if(b&&b.offsetParent)b.click();})()`, false);
await sleep(1200); await clear();
await page.eval(`(()=>{const c=document.getElementById('coachClose'); if(c)c.click();})()`, false);
const before = await read();
console.log('    민 직전 ', JSON.stringify(before));
await page.eval(`window.__dayClockSkip(0.999)`, false);
for (const t of [2, 5, 9, 14]) {
  await sleep(t === 2 ? 2000 : 3000);
  const r = await read();
  console.log(`    +${String(t).padStart(2)}초 `, JSON.stringify(r));
  if (r.날 !== before.날) { console.log('⇒ ★ 하루가 저절로 넘어갔다:', before.날, '→', r.날,
                                        '· 시계', r.시각); break; }
}
await page.close();
