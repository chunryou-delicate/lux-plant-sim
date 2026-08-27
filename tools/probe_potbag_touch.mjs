/* tools/probe_potbag_touch.mjs — **가방의 몬스테라 칸이 «터치»로 끌리나**
   박사님 2026-08-27: *"아직도안된다 몬스테라 «처음» 가방에서드래그"*
   ⚠ 내 판(CDP click)에서는 «켜집니다»(d12 CELL/★켜짐). 그런데 박사님은 «안 된다» 하십니다.
   ⇒ ★ 남은 갈래는 «터치»입니다. 그것만 갈라 봅니다.
   ★ 판을 굴리지 않고 «가방에 그 칸이 서게» 세워 놓습니다 —
     bagPots() = pots.filter(p => p.placedOnce === false && !p.at && !p.slotId) */
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

/* 자리 없는 화분 하나 — 도착 직후와 같은 꼴 */
console.log('■ 세우기 —', await page.eval(`(()=>{ try{
  const S = window.__S();
  S.pots = S.pots || [];
  S.pots.push({ id: 'pot_probe', itemId: 'pot', placedOnce: false, at: null, slotId: null,
                leafGrades: {}, leafGradesSeen: {}, cuts: [] });
  window.__redraw();
  return JSON.stringify({ pots: S.pots.length });
} catch(e){ return JSON.stringify({ err: e.message }); } })()`));

await page.eval(`window.__byeotSheet.open('bag')`, false);
const settle = async () => { let last=null;
  for (let i=0;i<30;i++){ const t=await page.eval(`(()=>String(Math.round(document.getElementById('sheet').getBoundingClientRect().top)))()`);
    if (t===last) return; last=t; await sleep(100); } };
await settle();

/* ★★ 칸이 «화면 밖»일 수 있다 — 시트는 세로로 구른다. 스크롤해서 안으로 들인 뒤 잰다.
   ⚠ 안 하면 「안 끌린다」가 «자 탓»이 된다(오늘 아침 [Char] 의 「탭이 화면 밖」과 같은 꼴). */
await page.eval(`(()=>{ try{ const c=document.querySelector('[data-potbag]');
  if (c && c.scrollIntoView) c.scrollIntoView({ block:'center' }); }catch(e){} })()`, false);
await sleep(700);

const info = JSON.parse(await page.eval(`(()=>{
  const c = document.querySelector('[data-potbag]');
  if (!c) return JSON.stringify({ err: '몬스테라 칸이 «안 떴다»' });
  const r = c.getBoundingClientRect();
  return JSON.stringify({ ko: ((c.querySelector('.nm')||{}).textContent||'?'),
    drag: c.classList.contains('draggable'),
    w: Math.round(r.width), h: Math.round(r.height),
    x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2) });
})()`));
console.log('■ 칸 —', JSON.stringify(info));
if (info.err) { await page.close(); clearTimeout(wd); process.exit(0); }

/* ★ 그 점에서 «무엇이 잡히나» — 덮였으면 손가락이 안 닿는다 */
console.log('■ 그 점에서 잡히는 것 —', await page.eval(`(()=>{
  const c = document.querySelector('[data-potbag]');
  const h = document.elementFromPoint(${info.x}, ${info.y});
  const tag = h ? (h.tagName.toLowerCase() + (h.className && typeof h.className==='string'
    ? '.' + h.className.trim().split(/\s+/).slice(0,2).join('.') : '')) : 'null';
  return (c && h && c.contains(h) ? 'OK  ' : '★COVER ') + tag;
})()`));

const grab = async (label, dx, dy) => {
  const p = [{ x: info.x, y: info.y, radiusX: 12, radiusY: 12, force: 1, id: 1 }];
  await page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: p });
  await sleep(90);
  await page.send('Input.dispatchTouchEvent', { type: 'touchMove',
    touchPoints: [{ ...p[0], x: info.x + dx, y: info.y + dy }] });
  await sleep(120);
  const st = JSON.parse(await page.eval(`(()=>{ const d = window.__drag || {};
    return JSON.stringify({ on: !!d.on, what: d.what || null,
      dragging: document.body.classList.contains('dragging') }); })()`));
  await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(300);
  console.log(`  ${label} — drag.on ${st.on ? '✔' : '⛔'} · what ${st.what || '—'} · body.dragging ${st.dragging ? '✔' : '⛔'}`);
  await page.eval(`(()=>{ try{ window.__drag.end && window.__drag.end(); window.__byeotSheet.open('bag'); }catch(e){} })()`, false);
  await settle();
  return st.on;
};
console.log('■ 터치로 끌어 본다');
await grab('짧게 (30px)', 30, -30);
await grab('길게 (120px)', 120, -160);
await page.close(); clearTimeout(wd);
