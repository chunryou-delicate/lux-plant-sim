/* tools/probe_hintdim.mjs — **손가락 자리만 남기고 «약간» 어두워지나**
   ------------------------------------------------------------------
   박사님: *"처음 가이드할 때 … 터치 지점 외에는 «약간 투명 까망» 처리해서 손가락 터치를 따라가게"*
   ⚠ [Plan]·총괄이 「막기」는 «안 하기»로 갈랐다 — 덮개는 «보이기»만 한다.
   재는 것: ① 손가락이 뜨면 덮개가 «켜지나» ② 그 «가운데»가 손가락이 짚는 자리인가
            ③ ★ 딴 데도 «눌리나»(덮개가 손짓을 먹으면 안 된다) ④ 손가락이 꺼지면 «걷히나»
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
await sleep(4500);
const J = async (e, t = 60000) => JSON.parse(await page.eval(e, true, t));
/* 대화가 떠 있으면 손가락은 쉰다(§coach ⓑ) — 먼저 걷는다 */
for (let i = 0; i < 30; i++) {
  const b = await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');
    return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`);
  if (b !== 'true') break;
  await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s)s.click();
    const x=document.getElementById('dlgBox'); if(x)x.click();
    const g=document.getElementById('guideClose'); if(g)g.click();})()`, false);
  await sleep(220);
}
await page.eval(`window.__redraw()`, false);
await sleep(800);
const snap = () => J(`(()=>{ const d=document.getElementById('hintDim'), h=document.getElementById('hint');
  const t=document.querySelector('.hintTarget');
  const bg=(d&&d.style.background)||'';
  const m=bg.match(/at (-?\\d+)px (-?\\d+)px/);
  const tr = t ? t.getBoundingClientRect() : null;
  return JSON.stringify({ '손가락 떴나': !!(h && h.classList.contains('on')),
    '덮개 켜졌나': !!(d && d.classList.contains('on')),
    '덮개 가운데': m ? { x:+m[1], y:+m[2] } : null,
    '짚는 것': t ? (t.id || t.className) : null,
    '짚는 것 한가운데': tr ? { x:Math.round(tr.left+tr.width/2), y:Math.round(tr.top+tr.height/2) } : null,
    '덮개가 손짓을 먹나': d ? getComputedStyle(d).pointerEvents !== 'none' : null,
    '말': h ? ((h.querySelector('.say')||{}).textContent||'').trim() : null }); })()`);
/* ★ 손가락이 «실제로 떠 있는» 판을 만든다 — 쪽지(coach)가 떠 있으면 손가락은 쉰다(§coach ⓑ),
   시트가 열려 있어도 가리킬 것이 달라진다. 그래서 걷고 다시 그린 뒤 «뜰 때까지» 기다린다. */
for (let i = 0; i < 12; i++) {
  const on = await page.eval(`(()=>{ const h=document.getElementById('hint');
    return String(!!(h && h.classList.contains('on'))); })()`);
  if (on === 'true') break;
  await page.eval(`(()=>{ try{ window.__byeotSheet.close(); }catch(e){}
    const c=document.getElementById('coach'); if(c) c.click();
    const s=document.getElementById('dlgSkip'); if(s)s.click();
    window.__redraw(); })()`, false);
  await sleep(700);
}
console.log('=== ①② 손가락이 뜨면 ===');
const a = await snap();
console.log(' ', JSON.stringify(a));
if (a['덮개 가운데'] && a['짚는 것 한가운데']) {
  const dx = Math.abs(a['덮개 가운데'].x - a['짚는 것 한가운데'].x);
  const dy = Math.abs(a['덮개 가운데'].y - a['짚는 것 한가운데'].y);
  console.log('  ★ 가운데가 맞나 —', JSON.stringify({ 어긋남: { dx, dy },
    판정: (dx <= 2 && dy <= 2) ? '✔ 손가락이 짚는 그 자리다' : '★ 어긋난다' }));
}
await page.shot('docs/handoff/img/hintdim_on.png').catch(() => {});   /* ★ 켜진 모습 */
console.log('');
console.log('=== ③ 덮개 밑이 «눌리나» (막으면 안 된다) ===');
console.log(' ', JSON.stringify(await J(`(()=>{
  const d=document.getElementById('hintDim');
  /* 화면 한가운데 — 손가락이 짚는 데가 아닌 곳에서 «무엇이 잡히나»를 본다 */
  const el=document.elementFromPoint(Math.round(innerWidth/2), Math.round(innerHeight*0.45));
  return JSON.stringify({ '그 점에 잡히는 것': el ? (el.id || el.tagName) : null,
    '덮개가 잡히나': el === d,
    판정: el === d ? '⛔ 덮개가 손짓을 먹는다' : '✔ 덮개 밑이 그대로 눌린다' }); })()`)));
console.log('');
console.log('=== ④ 손가락이 꺼지면 걷히나 ===');
await page.eval(`(()=>{ try{ window.__hintOff && window.__hintOff(); }catch(e){}
  const d=document.getElementById('hintDim'); return !!d; })()`, false);
console.log(' ', JSON.stringify(await J(`(()=>{ /* 시트를 열면 손가락이 다른 데로 가거나 쉰다 */
  try{ window.__byeotSheet.open('shop'); }catch(e){}
  return JSON.stringify({ 열었다: true }); })()`)));
await sleep(1200);
await page.eval(`window.__redraw()`, false);
await sleep(600);
console.log(' ', JSON.stringify(await snap()));
await page.shot('docs/handoff/img/hintdim.png').catch(() => {});
await page.close(); clearTimeout(wd);
