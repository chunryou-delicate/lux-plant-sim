/* tools/probe_questalive.mjs — **놓으면 할 일이 넘어가나 · 옮기면 남아 있나** (박사님 ①⑥)
   ------------------------------------------------------------------
   박사님 사진(Day 0): 시루가 «서랍장 1번 칸»에 놓여 있는데 할 일은 *「시루를 방 안에 놓아 보세요」*.
   그런데 아래 띠는 *「[🌱 심기] 먼저」* — ★ 둘이 «다른 것»을 보고 있었다.
   재는 것 셋(총괄):
     ① 시루를 놓는다        ⇒ 할 일이 «넘어가나»
     ② 놓고 «옮긴다»        ⇒ 할 일이 «남아 있나» · 되돌아가나
     ③ 새로고침한다         ⇒ 할 일·손가락이 «남아 있나»
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
const calm = async () => { for (let i = 0; i < 40; i++) {
  const busy = await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');
    return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`);
  if (busy !== 'true') break;
  await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s)s.click();
    const b=document.getElementById('dlgBox'); if(b)b.click();
    const g=document.getElementById('guideClose'); if(g)g.click();})()`, false);
  await sleep(250); } };
await calm();

const look = async () => { await page.eval(`try{ window.__byeotHint() }catch(e){}`, false); await sleep(350);
  return page.eval(`(()=>{ const S=window.__S();
  const q=(document.getElementById('quest')||{}).textContent||'';
  const h=document.getElementById('hint');
  const siru=(()=>{ try{ const p=(S.firstPlay.beansprout.pots||[])[0];
    return p? (p.slotId || (p.at? 'free' : null)) : null; }catch(e){ return 'err'; } })();
  const bottom=[...document.querySelectorAll('#bottom, #bottom *')]
    .map(e=>(e.childElementCount?'':(e.textContent||'').trim())).filter(Boolean).slice(0,3).join(' / ');
  return JSON.stringify({ 시루자리: siru, phase: (S.firstPlay||{}).phase||null,
    '할 일': q.trim().replace(/\s+/g,' ').slice(0,40),
    손가락: h.classList.contains('on') ? ((h.querySelector('.say')||{}).textContent||'?') : '⛔없음',
    '아래 띠': bottom.slice(0,60) }); })()`); };

console.log('=== ① 놓기 전 ===');
console.log('  ', await look());
console.log('\n=== ① 시루를 «눌러서» 놓는다 (가방 칸 탭) ===');
await page.eval(`try{ window.__byeotSheet.open('bag') }catch(e){}`, false); await sleep(1400);
const c = JSON.parse(await page.eval(`(()=>{ const e=document.querySelector('[data-place]');
  if(!e) return JSON.stringify({err:'칸 없음'});
  if(e.scrollIntoView) e.scrollIntoView({block:'center'});
  const r=e.getBoundingClientRect();
  return JSON.stringify({x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)}); })()`));
if (!c.err) {
  await page.send('Input.dispatchTouchEvent', { type:'touchStart', touchPoints:[{x:c.x,y:c.y,radiusX:12,radiusY:12,force:1,id:1}] });
  await sleep(90);
  await page.send('Input.dispatchTouchEvent', { type:'touchEnd', touchPoints:[] });
  await sleep(1800);
}
await page.eval(`(()=>{ const b=document.getElementById('placeOk'); if(b && getComputedStyle(b).display!=='none') b.click(); })()`, false);
await sleep(1200); await calm();
console.log('  ★ 놓은 뒤 —', await look());

console.log('\n=== ② 「가이드대로 안 하고」 그 시루를 «다른 자리»로 옮긴다 ===');
console.log('  ', await page.eval(`(()=>{ try{ const S=window.__S();
  const p=(S.firstPlay.beansprout.pots||[])[0];
  const slots=(window.__io.light.room.slots||[]).map(s=>s.slotId);
  const to = slots.find(id => id !== p.slotId) || null;
  if(!to) return '옮길 자리 «없음»';
  p.slotId = to; p.at = null; window.__redraw();
  return '옮김 → ' + to; }catch(e){ return 'err '+e.message; } })()`));
await sleep(1500);
console.log('  ★ 옮긴 뒤 —', await look());

console.log('\n=== ③ 새로고침 ===');
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 150000, 300);
await sleep(5000); await calm();
console.log('  ★ 새로고침 뒤 —', await look());
await page.close(); clearTimeout(wd);
