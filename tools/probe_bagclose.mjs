/* tools/probe_bagclose.mjs — **끌기 시작하면 가방이 닫히나**
   박사님 2026-08-25: *"드래그후 손이 가방을 벗어나면 가방은 자동으로 닫히게해둬."*
   ⚠ 읽어 보니 `drag.begin` 에 이미 `window.__byeotSheet.close()` 가 있다. 그런데 오늘 아침까지
     `begin` 이 «첫 줄에서 되돌아가서» 거기 닿지도 못했다(고침 `c727b84`).
   ⇒ ★ 그러니 「이미 고쳐졌을 것」인데 — **읽어서 낸 말이라 «눌러서» 확인한다.** */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8972';
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 240000);
wd.unref && wd.unref();
const page = await launch({ width: 390, height: 844, dpr: 1 });
try { await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 }); } catch {}
await page.goto(`${BASE}/game.html`);
await page.eval('localStorage.clear()', false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 150000, 300);
await sleep(4000);
await page.eval(`(()=>{ const S=window.__S(); const sh=S.shop||(S.shop={});
  sh.stock=sh.stock||{}; for(const id of ['pot','pot_terracotta','siru','sprout_tray']) sh.stock[id]=(sh.stock[id]||0)+1;
  window.__redraw(); })()`, false);
await sleep(700);
const settle = async () => { let last=null;
  for (let i=0;i<30;i++){ const t=await page.eval(`(()=>String(Math.round(document.getElementById('sheet').getBoundingClientRect().top)))()`);
    if (t===last) return; last=t; await sleep(100); } };
const names = JSON.parse(await page.eval(`(()=>JSON.stringify(
  [...document.querySelectorAll('.bagslot[data-place]')].map(c=>c.getAttribute('data-place'))))()`));
console.log('■ 끌기 시작 → 가방이 닫히나');
for (const what of names) {
  await page.eval(`window.__byeotSheet.open('bag')`, false); await settle();
  const pt = JSON.parse(await page.eval(`(()=>{
    const c=document.querySelector('.bagslot[data-place="${what}"]'); if(!c) return JSON.stringify({err:1});
    const h=c.querySelector('.draggable')||(c.classList.contains('draggable')?c:null)||c;
    const r=h.getBoundingClientRect();
    return JSON.stringify({ ko:((c.querySelector('.nm')||{}).textContent||'?').slice(0,12),
      x:Math.round(r.left+r.width/2), y:Math.round(r.top+r.height/2) }); })()`));
  if (pt.err) continue;
  const p=[{x:pt.x,y:pt.y,radiusX:12,radiusY:12,force:1,id:1}];
  await page.send('Input.dispatchTouchEvent', { type:'touchStart', touchPoints:p });
  await sleep(120);
  await page.send('Input.dispatchTouchEvent', { type:'touchMove', touchPoints:[{...p[0], x:pt.x+40, y:pt.y-60}] });
  await sleep(250);
  const st = JSON.parse(await page.eval(`(()=>{ const s=document.getElementById('sheet');
    const r=s.getBoundingClientRect();
    return JSON.stringify({ on: !!(window.__drag&&window.__drag.on),
      openClass: s.classList.contains('open'),
      top: Math.round(r.top), h: Math.round(innerHeight) }); })()`));
  await page.send('Input.dispatchTouchEvent', { type:'touchEnd', touchPoints:[] });
  await sleep(400);
  /* ★ 「닫혔나」는 «자리»로 본다 — .open 은 곧바로 떨어지는데 미끄러지기는 그 뒤다(아침에 덴 그 병) */
  const closed = st.top >= st.h - 8;
  console.log(`  ${String(pt.ko).padEnd(14)} 끌기 ${st.on?'✔':'⛔'} · 가방 ${closed?'✔ 닫힘':(st.openClass?'⛔ 열린 채':'· 미끄러지는 중 top='+st.top)}`);
}
await page.close(); clearTimeout(wd);
