/* tools/probe_bagkeep.mjs — **가방에 있던 그루가 «새로고침»에도 가방에 있나** (반지하)
   ------------------------------------------------------------------
   박사님 2026-08-17: *"몬스테라 주는 거 인벤으로 안 들어오고 또 바로 설치되는데?"*
   그때 코어와 화면을 고쳤는데 ⇒ ★ 세이브에 「아직 안 놓았다」가 «안 실려» 있었다.
   ⇒ 그래서 **새로고침 한 번이면 그 그루가 방에 선다.** 그 자리를 지킨다.
   ⛔ 값은 안 바꾼다. */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8972';
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 300000);
wd.unref && wd.unref();
const page = await launch({ width: 390, height: 844, dpr: 1 });
await page.goto(`${BASE}/game.html`);
await page.eval('localStorage.clear()', false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 150000, 300);
await sleep(4000);
console.log('■ 선물을 가방에 —', await page.eval(`(async()=>{
  const st=await import('/src/game/state.js'); const S=window.__S();
  if(!(S.pots||[]).length) st.givePlant(S, window.__io);
  const p=(S.pots||[])[0]; p.slotId=null; p.at=null; p.placedOnce=false;
  window.__redraw();
  return JSON.stringify({ 화분:p.id, slotId:p.slotId, placedOnce:p.placedOnce }); })()`));
await sleep(1500);
await page.eval(`(()=>{ try{ if(window.__save) window.__save(); }catch(e){} })()`, false);
await sleep(1200);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 150000, 500);
await sleep(4000);
const out = await page.eval(`(()=>{ const S=window.__S(); const p=(S.pots||[])[0];
  return JSON.stringify({ slotId:p&&p.slotId, at:!!(p&&p.at), placedOnce:p&&p.placedOnce,
    '가방 칸': document.querySelectorAll('[data-potbag]').length,
    판정: (p && !p.slotId && !p.at) ? '✔ 가방에 그대로' : '★ 방에 서 버렸다' }); })()`);
console.log('■ 새로 켠 뒤 —', out);
await page.close(); clearTimeout(wd);
