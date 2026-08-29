/* tools/probe_placeclean.mjs — **가방에서 가구 하나 놓는 데 «정말» 몇 ms 인가**
   ------------------------------------------------------------------
   ⛔ 제가 앞서 「31,088 ms」라고 적은 것은 **틀렸습니다.** 그것은 probe_furnbag 의
     기다림 고리(60회 × 500 ms)가 «끝까지 돈 값»입니다 — 재는 자의 천장이지 놓기 값이 아닙니다.
     ⇒ 그 판에서는 방이 아예 «안 서 있었고»(§probe_moveremount), 그래서 고리가 못 끊긴 것입니다.
   ⇒ 그래서 **방이 서 있는 자리**에서 다시 잽니다 — 이사를 안 하고, 가방에만 가구를 얹어서.
   재는 것: ① 누르고 상태가 바뀌기까지 ② 3D 까지 다 서기까지(§refreshFurniture 포함)
   ⚠ 여기서 바꾸는 것은 «가방 내용»뿐이다 — 밸런스 값이 아니다.
   ⛔ 값은 안 바꾼다. */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8972';
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 300000);
wd.unref && wd.unref();
const page = await launch({ width: 390, height: 844, dpr: 1 });
try { await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 }); } catch {}
await page.goto(`${BASE}/game.html`);
await page.eval('localStorage.clear()', false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 150000, 300);
await sleep(4000);
for (let i = 0; i < 40; i++) {
  const b = await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');
    return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`);
  if (b !== 'true') break;
  await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s)s.click();
    const x=document.getElementById('dlgBox'); if(x)x.click();
    const g=document.getElementById('guideClose'); if(g)g.click();})()`, false);
  await sleep(250);
}
console.log('■ 판 —', await page.eval(`(()=>{ const S=window.__S();
  return JSON.stringify({ 방:S.home.room, 방섰나:!!window.__rv,
    가구:(window.__io.light.room.def.furniture||[]).length }); })()`));
/* 가방에 가구 하나를 얹는다 — 이사 없이 «놓기»만 재려고 */
console.log('■ 가방에 하나 얹기 —', await page.eval(`(()=>{ const S=window.__S();
  S.home.furnitureBag = S.home.furnitureBag || [];
  S.home.furnitureBag.push({ uid: 'probe-bed', preset: 'bed_single' });
  window.__redraw();
  return JSON.stringify({ 가방:S.home.furnitureBag.length }); })()`));
await sleep(800);
await page.eval(`try{ window.__byeotSheet.open('bag') }catch(e){}`, false);
await sleep(1500);
console.log('■ 가방 칸 —', await page.eval(`(()=>{ const cs=[...document.querySelectorAll('[data-furnbag]')];
  return JSON.stringify({ 칸수:cs.length, 첫칸: cs[0]? ((cs[0].querySelector('.nm')||{}).textContent||'?').trim():null }); })()`));
console.log('');
console.log('=== 눌러서 놓는다 — 상태와 3D 를 따로 ===');
console.log(' ', await page.eval(`(async()=>{ const S=window.__S();
  const n0=(S.home.furnitureAdded||[]).length, g0=(S.home.furnitureBag||[]).length;
  const t=performance.now();
  const c=document.querySelector('[data-furnbag]'); if(!c) return JSON.stringify({탈:'칸이 없다'});
  c.click();
  const state=performance.now()-t;                       /* onclick 은 동기 부분까지 여기서 끝난다 */
  let done=null;
  for (let i=0;i<200;i++){ await new Promise(r=>setTimeout(r,50));
    if((window.__S().home.furnitureAdded||[]).length>n0 && window.__io.light.room.def.furniture
       .some(f=>f&&f.uid==='probe-bed')) { done=performance.now()-t; break; } }
  return JSON.stringify({ '누른 손이 돌아오기까지 ms': Math.round(state),
    '방 가구에 들기까지 ms': done==null? null : Math.round(done),
    '가방': (window.__S().home.furnitureBag||[]).length + '(전 ' + g0 + ')',
    '방 가구': window.__io.light.room.def.furniture.length,
    '방 서 있나': !!window.__rv }); })()`, true, 200000));
await sleep(2500);
console.log('■ 다 선 뒤 —', await page.eval(`JSON.stringify({ 방섰나:!!window.__rv,
  'room-ok': document.getElementById('stage').classList.contains('room-ok'),
  자리:(window.__io.light.room.slots||[]).length })`));
await page.close(); clearTimeout(wd);
