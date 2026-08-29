/* tools/probe_placecost.mjs — **원룸에서 가구 하나 놓는 데 31초, 그 31초는 «어디» 것인가**
   ------------------------------------------------------------------
   ⚠ `refreshFurniture` 창구는 반지하에서 재니 2~6 ms 였다(probe_rebuild_split).
     그런데 «이사한 원룸»에서 가방 칸을 누르면 여전히 31초가 나온다.
     ⇒ 그러면 31초는 「다시 짓기」가 아니라 «다른 데» 있다. 그 자리를 짚는다.
   재는 것: ① 눌러서 «상태»가 바뀌기까지(코어 몫) ② 눌러서 «3D 가 서기»까지(화면 몫)
            ③ 원룸에서 `refreshFurniture` 한 번이 몇 ms 인가
   ⛔ 값은 안 바꾼다. */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8972';
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 400000);
wd.unref && wd.unref();
const page = await launch({ width: 390, height: 844, dpr: 1 });
try { await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 }); } catch {}
await page.goto(`${BASE}/game.html`);
await page.eval('localStorage.clear()', false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 150000, 300);
await sleep(5000);
for (let i = 0; i < 40; i++) {
  const b = await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');
    return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`);
  if (b !== 'true') break;
  await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s)s.click();
    const x=document.getElementById('dlgBox'); if(x)x.click();
    const g=document.getElementById('guideClose'); if(g)g.click();})()`, false);
  await sleep(250);
}
await page.eval(`(()=>{ const S=window.__S(); const ts=S.tutorial;
  ts.cashWon = ts.rules.moveOutCostWon + 100000;
  ts.varieLeaf = { ever:true, count:1, firstOnDay:S.day }; window.__redraw(); })()`, false);
await sleep(600);
await page.eval(`(()=>{ const b=document.getElementById('moveOut'); if(b){ b.disabled=false; b.click(); } })()`, false);
await sleep(6000);
for (let i = 0; i < 20; i++) {
  const b = await page.eval(`(()=>{const s=document.getElementById('stage');
    return !!(s&&s.classList.contains('talking'));})()`);
  if (b !== 'true') break;
  await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s)s.click();
    const x=document.getElementById('dlgBox'); if(x)x.click();})()`, false);
  await sleep(250);
}
await sleep(3000);
console.log('■ 이사 뒤 판 —', await page.eval(`(()=>{ const S=window.__S();
  return JSON.stringify({ 방:S.home.room, 가구:(window.__io.light.room.def.furniture||[]).length,
    가방:((S.home||{}).furnitureBag||[]).length }); })()`));
console.log('');
console.log('=== ③ 원룸에서 «다시 짓기» 한 번 ===');
for (let i = 0; i < 2; i++) console.log('  ' + (i+1) + '회 —', await page.eval(`(async()=>{
  const t=performance.now(); let r=null,err=null;
  try{ r=await window.__rv.refreshFurniture(); }catch(e){ err=e.message; }
  return JSON.stringify({ ms:Math.round(performance.now()-t), 돌려준것:r, 탈:err }); })()`, true, 200000));
console.log('');
console.log('=== ①② 가방 칸을 누른다 — 상태와 화면을 «따로» 잰다 ===');
await page.eval(`try{ window.__byeotSheet.open('bag') }catch(e){}`, false);
await sleep(1600);
/* 눌리는 순간을 페이지 안에서 찍는다 — CDP 왕복이 끼지 않게 */
await page.eval(`(()=>{ window.__mark = { t0: performance.now(), state: null, dom: null };
  const S=window.__S(); const n0=((S.home||{}).furnitureAdded||[]).length;
  const tick=()=>{ const S2=window.__S();
    if(window.__mark.state==null && ((S2.home||{}).furnitureAdded||[]).length>n0)
      window.__mark.state = performance.now()-window.__mark.t0;
    if(window.__mark.state!=null && window.__mark.dom==null && !document.body.classList.contains('busy'))
      window.__mark.dom = performance.now()-window.__mark.t0;
    requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  const c=document.querySelector('[data-furnbag]'); if(c) c.click(); })()`, false);
const t0 = Date.now();
for (let i = 0; i < 90; i++) {
  const m = await page.eval(`JSON.stringify(window.__mark||null)`);
  if (m && m !== 'null' && JSON.parse(m).state != null) { console.log('  페이지 안 자 —', m); break; }
  await sleep(500);
}
console.log('  ★ 바깥에서 본 벽시계(누르고 → CDP 가 다시 대답할 때까지) —', Date.now() - t0, 'ms');
console.log(' ', await page.eval(`(()=>{ const S=window.__S();
  return JSON.stringify({ 가방:((S.home||{}).furnitureBag||[]).length,
    놓은것:((S.home||{}).furnitureAdded||[]).map(f=>f.uid),
    방가구:(window.__io.light.room.def.furniture||[]).length }); })()`));
await page.close(); clearTimeout(wd);
