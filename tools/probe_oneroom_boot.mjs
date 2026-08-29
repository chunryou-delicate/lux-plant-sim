/* tools/probe_oneroom_boot.mjs — **이사한 원룸이 «서나», 그리고 거기서 가구를 놓으면**
   ------------------------------------------------------------------
   ⚠ 헤드리스는 방을 «두 번째로» 못 짓는다 — WebGL 판을 하나밖에 못 연다(probe_remountable).
     그래서 `remountRoomView` 를 지나는 이사는 이 자로 못 잰다.
   ⇒ ★ 그러면 «다시 짓지» 말고 ⇒ ★★ 「이사한 판을 저장해 두고 «새로 켠다»」.
     새로 켜면 방을 «처음» 짓는 것이라 그 벽을 안 지난다 — 하나만 다르게(견줌의 계율).
   재는 것: ① 원룸이 서나 ② 가방에 아홉이 그대로 있나 ③ 거기서 하나 놓으면 몇 ms 이고 서나
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
await sleep(4000);
const skip = async (n = 40) => {
  for (let i = 0; i < n; i++) {
    const b = await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');
      return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`);
    if (b !== 'true') break;
    await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s)s.click();
      const x=document.getElementById('dlgBox'); if(x)x.click();
      const g=document.getElementById('guideClose'); if(g)g.click();})()`, false);
    await sleep(250);
  }
};
await skip();
/* 이사 — 3D 는 여기서 안 선다(위 ⚠). 상태만 넘긴다 */
await page.eval(`(()=>{ const S=window.__S(); const ts=S.tutorial;
  ts.cashWon = ts.rules.moveOutCostWon + 100000;
  ts.varieLeaf = { ever:true, count:1, firstOnDay:S.day }; window.__redraw(); })()`, false);
await sleep(600);
await page.eval(`(()=>{ const b=document.getElementById('moveOut'); if(b){ b.disabled=false; b.click(); } })()`, false);
await sleep(6000);
await skip(20);
console.log('■ 이사 직후(같은 판) —', await page.eval(`(()=>{ const S=window.__S();
  return JSON.stringify({ 방:S.home.room, '3D 섰나': !!window.__rv,
    가방:((S.home||{}).furnitureBag||[]).length,
    '조도판 가구':(window.__io.light.room.def.furniture||[]).length }); })()`));
/* 저장이 되었나 보고, 새로 켠다 */
console.log('■ 저장 —', await page.eval(`(()=>{ try{ if(window.__save) window.__save(); }catch(e){}
  const keys=Object.keys(localStorage);
  return JSON.stringify({ 칸:keys.slice(0,4), 수:keys.length }); })()`));
await sleep(1200);
console.log('');
console.log('=== ① 새로 켜면 원룸이 «서나» ===');
const t0 = Date.now();
await page.goto(`${BASE}/game.html`);
let stood = null;
for (let i = 0; i < 150; i++) {
  await sleep(1000);
  if (await page.eval(`String(!!window.__rv)`) === 'true') { stood = Date.now() - t0; break; }
}
console.log(' ', stood == null ? '★★ 안 섰습니다' : `${stood} ms 만에 섰습니다`);
console.log(' ', await page.eval(`(()=>{ const S=window.__S();
  return JSON.stringify({ 방:S.home.room,
    'room-ok': document.getElementById('stage').classList.contains('room-ok'),
    '3D 가구':((window.__rv&&window.__rv.furniture())||[]).length,
    '조도판 가구':(window.__io.light.room.def.furniture||[]).length,
    자리:(window.__io.light.room.slots||[]).length,
    가방:((S.home||{}).furnitureBag||[]).length,
    덮개: (()=>{ const fb=document.getElementById('roomFallback');
      return fb && fb.style.display!=='none' ? (fb.textContent||'').trim().slice(0,90) : null; })() }); })()`));
await skip(20);
console.log('');
console.log('=== ③ 원룸에서 가방 가구 하나를 놓으면 ===');
await page.eval(`try{ window.__byeotSheet.open('bag') }catch(e){}`, false);
await sleep(1500);
console.log(' ', await page.eval(`(async()=>{ const S=window.__S();
  const n0=(S.home.furnitureAdded||[]).length;
  const c=document.querySelector('[data-furnbag]');
  if(!c) return JSON.stringify({ 탈:'가방 칸이 없다' });
  const ko=((c.querySelector('.nm')||{}).textContent||'').trim();
  const t=performance.now(); c.click();
  const sync=performance.now()-t; let done=null, uid=null;
  for(let i=0;i<200;i++){ await new Promise(r=>setTimeout(r,50));
    const add=(window.__S().home.furnitureAdded||[]);
    if(add.length>n0){ uid=add[add.length-1].uid;
      if((window.__io.light.room.def.furniture||[]).some(f=>f&&f.uid===uid)){ done=performance.now()-t; break; } } }
  await new Promise(r=>setTimeout(r,800));
  return JSON.stringify({ 놓은것:ko, uid,
    '누른 손이 돌아오기까지 ms': Math.round(sync),
    '방에 들기까지 ms': done==null? null : Math.round(done),
    '3D 에 섰나': ((window.__rv&&window.__rv.furniture())||[]).some(f=>f.uid===uid),
    가방:(window.__S().home.furnitureBag||[]).length,
    자리:(window.__io.light.room.slots||[]).length,
    '방 서 있나': !!window.__rv }); })()`, true, 200000));
await page.shot('docs/handoff/img/oneroom_placed.png').catch(() => {});
await page.close(); clearTimeout(wd);
