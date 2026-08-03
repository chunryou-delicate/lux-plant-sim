/* 터치가 room_view 에 닿기는 하나. 카메라가 돌면 닿은 것이다. */
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
/* 이벤트가 실제로 캔버스에 도착하는지 직접 센다 */
await page.eval(`(()=>{ window.__seen={touchstart:0,touchmove:0,touchend:0,pointerdown:0,pointerup:0};
  const c=document.getElementById('roomCanvas');
  for (const k of Object.keys(window.__seen)) c.addEventListener(k, ()=>window.__seen[k]++, true); })()`, false);
const T = (type, x, y) => page.eval(`(()=>{ const c=document.getElementById('roomCanvas');
  const t=new Touch({identifier:1,target:c,clientX:${x},clientY:${y}});
  const ok = c.dispatchEvent(new TouchEvent('${type}',{bubbles:true,cancelable:true,
    touches:'${type}'==='touchend'?[]:[t],targetTouches:'${type}'==='touchend'?[]:[t],changedTouches:[t]}));
  return ok; })()`);
const cam0 = await page.eval(`window.__rv.camera().az`);
await T('touchstart', 200, 400); await sleep(60);
for (let i=1;i<=6;i++) { await T('touchmove', 200+i*20, 400); await sleep(40); }
await T('touchend', 320, 400); await sleep(600);
const cam1 = await page.eval(`window.__rv.camera().az`);
console.log(JSON.stringify({ 이벤트도착: await page.eval(`window.__seen`),
  카메라전: +cam0.toFixed(4), 카메라후: +cam1.toFixed(4), 돌았나: Math.abs(cam1-cam0) > 0.01 }));
await page.close();
