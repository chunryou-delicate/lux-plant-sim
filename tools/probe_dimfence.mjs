/* tools/probe_dimfence.mjs — **울타리가 «잠그지는» 않나** (박사님 「터치를 막아버려」)
   ------------------------------------------------------------------
   덮개가 이제 짚은 자리 «밖»의 손짓을 삼킨다. 그러면 ⇒ ⛔ 「손가락이 틀린 데를 짚으면
   판이 통째로 잠긴다」. 그래서 «밀기 전»에 잠기지 않는지부터 잰다(총괄 청).
   재는 것: ① 구멍 «안»은 눌리나 ② 구멍 «밖»은 삼켜지나(그리고 손가락이 «뛰나»)
            ③ ★ [다음 날]이 «늘» 눌리나 ④ 대사·쪽지·시트 중에는 덮개가 «꺼져» 있나
   ⚠ 박사님 판으로 잰다 — 1770×1188 · 시트 «연 채»도 같이.
   ⛔ 값은 안 바꾼다. */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8972';
const W = Number(process.env.W || 1770), H = Number(process.env.H || 1188);
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 300000);
wd.unref && wd.unref();
const page = await launch({ width: W, height: H, dpr: 1 });
await page.goto(`${BASE}/game.html`);
await page.eval('localStorage.clear()', false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 150000, 300);
await sleep(5000);
/* ⚠ 대사를 못 걷으면 이 자는 «아무것도» 못 잰다(덮개는 대사 중에 안 켜진다).
   ⇒ DOM 클릭과 «진짜 마우스»를 둘 다 쓴다 — 판마다 먹는 쪽이 달랐다(오늘 여러 번 겪었다). */
const clearDlg = async () => { for (let i = 0; i < 30; i++) {
  const t = await page.eval(`document.getElementById('stage').classList.contains('talking')`);
  if (t !== 'true') return true;
  await page.eval(`(()=>{ const b=document.getElementById('dlgSkip'); if (b) b.click();
    const x=document.getElementById('dlgBox'); if (x) x.click(); })()`, false);
  await sleep(200);
  const at = JSON.parse(await page.eval(`(()=>{ const b=document.getElementById('dlgBox');
    if(!b) return 'null'; const r=b.getBoundingClientRect();
    if(!r.width) return 'null'; return JSON.stringify({ x:r.left+r.width/2, y:r.top+r.height/2 }); })()`));
  if (at) {
    await page.send('Input.dispatchMouseEvent', { type:'mouseMoved', x:Math.round(at.x), y:Math.round(at.y), button:'left', buttons:0 });
    await page.send('Input.dispatchMouseEvent', { type:'mousePressed', x:Math.round(at.x), y:Math.round(at.y), button:'left', buttons:1, clickCount:1 });
    await page.send('Input.dispatchMouseEvent', { type:'mouseReleased', x:Math.round(at.x), y:Math.round(at.y), button:'left', buttons:0, clickCount:1 });
  }
  await sleep(220); }
  return false; };
const state = () => page.eval(`(()=>{ const d=document.getElementById('hintDim');
  const h=document.getElementById('hint'); const t=document.querySelector('.hintTarget');
  const on = !!(d && d.classList.contains('on'));
  return JSON.stringify({ 덮개:on, '덮개가 손짓을 먹나': d ? getComputedStyle(d).pointerEvents !== 'none' : null,
    구멍: (()=>{ const m=(d&&d.style.clipPath||'').match(/M(-?[\\d.]+) (-?[\\d.]+) a([\\d.]+)/);
      return m ? { x:+m[1], y:+m[2], r:+m[3] } : null; })(),
    손가락: !!(h && h.classList.contains('on')),
    말: h ? ((h.querySelector('.say')||{}).textContent||'').trim().slice(0,28) : null,
    짚는것: t ? (t.id || t.className.split(' ')[0]) : null,
    무대: (document.getElementById('stage').className||'').trim().slice(0,44) }); })()`);
/* 그 점에서 «무엇이» 잡히나 — 덮개가 먹으면 hintDim 이 나온다 */
const hitAt = (x, y) => page.eval(`(()=>{ const el=document.elementFromPoint(${Math.round(x)}, ${Math.round(y)});
  return el ? (el.id || el.tagName + '.' + (el.className||'').split(' ')[0]) : 'null'; })()`);

/* ★ 오류를 받아 적는다 — 화면이 조용히 죽으면 대사도 안 걷힌다(오늘 여러 번 겪었다) */
await page.eval(`(()=>{ window.__errs=[];
  for (const k of ['warn','error']) { const o=console[k].bind(console);
    console[k]=(...a)=>{ try{ window.__errs.push(k+' | '+a.map(x=>(x&&x.message)?x.message:String(x)).join(' ')); }catch{} o(...a); }; }
  addEventListener('error', e=>window.__errs.push('던짐 | '+(e.message||'')));
  addEventListener('unhandledrejection', e=>window.__errs.push('약속깨짐 | '+((e.reason&&e.reason.message)||e.reason)));
})()`, false);
/* ⚠ 한 번 걷으면 «다음 묶음»이 곧바로 열린다(끝냄 → 다음 열림). 잠잠해질 때까지 걷는다. */
for (let i = 0; i < 4; i++) { await clearDlg(); await sleep(900); }
console.log('■ 대사 걷기 —', await page.eval(`String(!document.getElementById('stage').classList.contains('talking'))`));
await sleep(1000);
console.log('■ 대사를 걷은 뒤 —', await state());
console.log('■ 찍힌 말 —', await page.eval(`JSON.stringify((window.__errs||[]).slice(0,6))`));
console.log('');
console.log('=== ①② 구멍 안과 밖 ===');
{
  const st = JSON.parse(await state());
  if (!st.덮개) console.log('  ⚠ 덮개가 꺼져 있어 이 걸음은 못 잰다(손가락이 없다)');
  else {
    const c = st.구멍;
    console.log('  · 구멍 안 —', await hitAt(c.x, c.y), '(덮개면 ⛔)');
    console.log('  · 구멍 밖(오른쪽 200px) —', await hitAt(Math.min(W - 4, c.x + c.r + 200), c.y), '(덮개면 ✔ 막는다)');
    /* 밖을 눌러 본다 — 손가락이 뛰나 */
    await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: Math.min(W - 4, Math.round(c.x + c.r + 200)), y: Math.round(c.y), button: 'left', buttons: 0 });
    await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: Math.min(W - 4, Math.round(c.x + c.r + 200)), y: Math.round(c.y), button: 'left', buttons: 1, clickCount: 1 });
    await sleep(120);
    console.log('  · 밖을 누른 순간 손가락이 —', await page.eval(`(()=>{ const h=document.getElementById('hint');
      return JSON.stringify({ 뜀: !!(h && h.classList.contains('knock')) }); })()`));
    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: Math.min(W - 4, Math.round(c.x + c.r + 200)), y: Math.round(c.y), button: 'left', buttons: 0, clickCount: 1 });
    await sleep(600);
  }
}
console.log('');
console.log('=== ③ ★ [다음 날]이 «늘» 눌리나 ===');
console.log(' ', await page.eval(`(()=>{ const n=document.getElementById('next');
  if (!n) return JSON.stringify({ 탈:'단추가 없다' });
  const r=n.getBoundingClientRect();
  const el=document.elementFromPoint(Math.round(r.left+r.width/2), Math.round(r.top+r.height/2));
  return JSON.stringify({ 보이나: r.width>0 && n.offsetParent!==null, 잠김: !!n.disabled,
    '그 점에 잡히는 것': el ? (el.id || el.tagName) : null,
    판정: (el && el.id === 'next') ? '✔ 눌린다' : '⛔ 다른 것이 먹는다' }); })()`));
console.log('');
console.log('=== ④ 대사·쪽지·시트 중에는 덮개가 꺼져 있나 ===');
await page.eval(`(()=>{ try{ window.__byeotSheet.open('bag'); }catch(e){} })()`, false);
await sleep(1400);
console.log('  · 시트를 연 채 —', await state());
await page.eval(`(()=>{ try{ window.__byeotSheet.close(); }catch(e){} })()`, false);
await sleep(900);
console.log('  · 시트를 닫은 뒤 —', await state());
await page.shot('docs/handoff/img/dimfence.png').catch(() => {});
await page.close(); clearTimeout(wd);
