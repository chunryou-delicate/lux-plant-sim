/* tools/probe_droplabel_vis.mjs — **방→방 옮기기에서 «안내글이 보이나»**
   #dropLabel 은 `display:none` 이고 `body.dragging` 일 때만 `block` 이다(§CSS 1020).
   그런데 `body.dragging` 을 붙이는 곳은 `drag.begin`(가방→방) 한 군데뿐이다(11700).
   ⇒ 방→방 길에서 그 글이 «정말» 안 보이는지 눌러서 확인한다. */
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
await sleep(5000);
for (let i = 0; i < 40; i++) {
  const busy = await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');
    return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`);
  if (busy !== 'true') break;
  await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s)s.click();
    const b=document.getElementById('dlgBox'); if(b)b.click();
    const g=document.getElementById('guideClose'); if(g)g.click();})()`, false);
  await sleep(250);
}
await page.eval(`(()=>{ const S=window.__S(); S.pots=S.pots||[];
  let p=S.pots[0];
  if(!p){ p={ id:'pot_probe', itemId:'pot', plantId:'monstera', leafGrades:{}, leafGradesSeen:{},
              cuts:[], daysPlanted:0, fedDays:0, arrivedOnDay:S.day, wateredOnDay:S.day,
              arrivalGrowthDays:45, dliHist:[] }; S.pots.push(p); }
  p.placedOnce=true; p.slotId='banjiha-desk:0'; p.at=null; window.__redraw();
  try{ window.__io.growth.setGrowth(45); window.__redraw(); }catch(e){} })()`, false);
await sleep(3000);
const look = () => page.eval(`(()=>{ const e=document.getElementById('dropLabel'), cs=getComputedStyle(e);
  return JSON.stringify({ 글: (e.textContent||'').trim(), display: cs.display,
    보이나: cs.display!=='none'&&cs.visibility!=='hidden'&&+cs.opacity>0.05,
    'body.dragging': document.body.classList.contains('dragging'),
    'stage.moving': document.getElementById('stage').classList.contains('moving') }); })()`);

await page.eval(`(()=>{ window.__picked.select('banjiha-desk:0'); })()`, false); await sleep(700);
await page.eval(`(()=>{ document.getElementById('pickMove').click(); })()`, false); await sleep(800);
console.log('■ [옮기기]를 누른 «직후» —', await look());
const P = { x: 288, y: 480 };
await page.send('Input.dispatchTouchEvent', { type:'touchStart', touchPoints:[{x:P.x,y:P.y,radiusX:12,radiusY:12,force:1,id:1}] });
await sleep(120);
for (let i=1;i<=5;i++){ await page.send('Input.dispatchTouchEvent', { type:'touchMove',
  touchPoints:[{x:P.x-8*i,y:P.y-14*i,radiusX:12,radiusY:12,force:1,id:1}] }); await sleep(60); }
console.log('■ «끄는 중» —', await look());
await page.send('Input.dispatchTouchEvent', { type:'touchEnd', touchPoints:[] }); await sleep(800);
console.log('■ 놓은 뒤 —', await look());

/* ★ [돌리기]도 같은 길이다 — `beginTurn` 도 `stage.moving` 만 붙인다. 둘 다 본다 */
await page.eval(`(()=>{ try{ window.__picked.clear(); }catch(e){} })()`, false); await sleep(500);
await page.eval(`(()=>{ window.__picked.select('banjiha-desk:0'); })()`, false); await sleep(700);
await page.eval(`(()=>{ const b=document.getElementById('pickTurn'); if(b) b.click(); })()`, false); await sleep(800);
console.log('■ [돌리기] 누른 뒤 —', await look());
await page.close(); clearTimeout(wd);
