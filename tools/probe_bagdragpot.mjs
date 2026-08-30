/* tools/probe_bagdragpot.mjs — **가방의 몬스테라를 «끌어서»·«눌러서» 놓을 수 있나**
   ------------------------------------------------------------------
   박사님(2026-08-30): *"몬스테라 «끌어놓는 거»부터 고쳐…"*
   ⚠ 총괄이 올린 것은 「눌러도 안 된다」였는데 박사님 낱말은 「끌어놓는 거」다 —
     그러니 **누름과 끌기를 «둘 다»** 잰다. 한 쪽만 고치면 또 「한 쪽만 손댄 것」이 된다.
   재는 것: 한 몸짓을 «처음부터 끝까지» 따라간다 —
     ① pointerdown 을 «누가» 받나  ② 뗀 곳이 «어디»인가  ③ 놓는 함수가 불리나(자리가 박히나)
     ④ ★ 덮개(울타리)를 죽이면 달라지나 — 그것이 「울타리 탓인가」를 가른다
   ⚠ 판은 **코어가 주는 그대로** 세운다 — givePlant(S, io, { slotId:null }) 은
     루프가 도착 때 부르는 바로 그 줄이다(loop.js). 손으로 상태를 주무르지 않는다
     (그렇게 했다가 가방 그리기가 던져서 자가 거짓말을 했다 — 오늘 한 번 겪었다).
   ⛔ 값은 안 바꾼다. 게임 코드도 안 고친다. 여기서는 「되나」만 본다. */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8972';
const W = Number(process.env.W || 1770), H = Number(process.env.H || 1188);
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 400000);
wd.unref && wd.unref();
const page = await launch({ width: W, height: H, dpr: 1 });
await page.goto(`${BASE}/game.html`);
await page.eval('localStorage.clear()', false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 150000, 300);
await sleep(4500);
await page.eval(`(()=>{ window.__errs=[];
  for (const k of ['warn','error']) { const o=console[k].bind(console);
    console[k]=(...a)=>{ try{ window.__errs.push(k+' | '+a.map(x=>(x&&x.message)?x.message:String(x)).join(' ').slice(0,120)); }catch{} o(...a); }; }
  addEventListener('error', e=>window.__errs.push('던짐 | '+(e.message||'')));
})()`, false);
const clearDlg = async () => { for (let i = 0; i < 40; i++) {
  const t = await page.eval(`String(document.getElementById('stage').classList.contains('talking'))`);
  if (t !== 'true') return true;
  await page.eval(`(()=>{ const x=document.getElementById('dlgBox'); if (x) x.click(); })()`, false);
  await sleep(200); } return false; };
for (let i = 0; i < 4; i++) { await clearDlg(); await sleep(700); }
/* ★ 도착을 «코어가 부르는 그 줄»로 세운다 */
console.log('■ 선물을 가방으로 —', await page.eval(`(async()=>{
  const st=await import('/src/game/state.js'); const S=window.__S();
  try { if(!(S.pots||[]).length) st.givePlant(S, window.__io, { slotId: null });
    window.__redraw();
    return JSON.stringify({ 화분:(S.pots||[]).map(p=>({ id:p.id, 자리:p.slotId, 좌표:!!p.at, 놓은적:p.placedOnce })) });
  } catch(e){ return JSON.stringify({ 탈:e.message }); } })()`, true, 30000));
/* ★★ **선물이 «다른 탭»에서 도착한 판을 그대로 만든다** (총괄 Day 11: [상점] 탭에서 왔다).
   ⇒ 그때 가방 칸은 크기가 0 이라 손잡이가 안 걸렸다. 그 뒤 [가방]으로 옮겨도
     격자 글이 같으면 다시 안 그리므로 «영영» 안 걸린다. 그 자리를 그대로 세운다. */
await page.eval(`(()=>{ try{ window.__byeotSheet.open('shop'); }catch(e){} window.__redraw(); })()`, false);
await sleep(1200);
await page.eval(`(()=>{ const b=document.getElementById('tabBag'); if(b) b.click(); })()`, false);
await sleep(1200);
await clearDlg();
await sleep(600);
const cellInfo = () => page.eval(`(()=>{ const b=document.querySelector('#bagGrid [data-potbag]');
  if(!b) return 'null'; const r=b.getBoundingClientRect();
  return JSON.stringify({ 이름:b.getAttribute('data-potbag'),
    가운데:{ x:Math.round(r.left+r.width/2), y:Math.round(r.top+r.height/2) },
    네모:[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)] }); })()`);
console.log('■ 가방 칸 —', await cellInfo());
console.log('■ ★ 손가락은 «무엇»을 짚고 있나 —', await page.eval(`(()=>{
  const t=document.querySelector('.hintTarget');
  const h=document.getElementById('hint');
  const b=document.querySelector('#bagGrid [data-potbag]');
  const r=t?t.getBoundingClientRect():null;
  const rb=b?b.getBoundingClientRect():null;
  return JSON.stringify({ 짚는것:t?(t.id||t.className||'').toString().slice(0,26):null,
    짚는것네모:r?[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)]:null,
    칸네모:rb?[Math.round(rb.left),Math.round(rb.top),Math.round(rb.width),Math.round(rb.height)]:null,
    말:h?((h.querySelector('.say')||{}).textContent||'').trim().slice(0,30):null,
    마지막짚기: window.__hintLast||null }); })()`));
console.log('■ 탈 —', await page.eval(`JSON.stringify((window.__errs||[]).slice(-4))`));
const cell = JSON.parse(await cellInfo());
if (!cell) { console.log('⛔ 칸이 안 떴다 — 여기서 끝'); await page.close(); process.exit(0); }
/* 방 한가운데 아래쪽(바닥) — 끌어다 놓을 곳 */
const room = JSON.parse(await page.eval(`(()=>{ const c=document.getElementById('roomCanvas').getBoundingClientRect();
  return JSON.stringify({ x:Math.round(c.left+c.width*0.5), y:Math.round(c.top+c.height*0.72) }); })()`));
const watch = () => page.eval(`(()=>{ window.__ev=[];
  const b=document.querySelector('#bagGrid [data-potbag]');
  if (b) for (const t of ['pointerdown','pointerup','click','lostpointercapture'])
    b.addEventListener(t, ()=>window.__ev.push('칸:'+t), true);
  for (const t of ['pointerdown','pointerup','pointercancel'])
    addEventListener(t, ()=>window.__ev.push('창:'+t), true);
  document.addEventListener('pointerup', (e)=>{ try{
    const el=document.elementFromPoint(e.clientX, e.clientY);
    window.__ev.push('뗀곳:'+(el?(el.id||el.tagName+'.'+(el.className||'').toString().split(' ')[0]):'null'));
  }catch(x){} }, true);
})()`, false);
const state = (ko) => page.eval(`(()=>{ const S=window.__S();
  return JSON.stringify({ 걸음:${JSON.stringify('KO')},
    받은것:(window.__ev||[]),
    끌기: window.__dragState ? window.__dragState() : null,
    화분:(S.pots||[]).map(p=>({ 자리:p.slotId, 좌표:!!p.at, 놓은적:p.placedOnce })),
    아래글:(document.getElementById('dropLabel').textContent||'').trim().slice(0,26),
    확인바:(()=>{ const b=document.getElementById('placeOk');
      if(!b) return false; const r=b.getBoundingClientRect(); return r.width>0&&r.height>0; })(),
    배너:(()=>{ const b=document.getElementById('event'); return b?((b.textContent||'').trim().slice(0,40)):null; })(),
    덮개:(()=>{ const d=document.getElementById('hintDim');
      return d?{ 켜짐:d.classList.contains('on'), 구멍:d.dataset.hole||null,
                 손짓먹나:getComputedStyle(d).pointerEvents!=='none' }:null; })(),
    탈:(window.__errs||[]).slice(-3) }); })()`).then(x => x.replace('"KO"', JSON.stringify(ko)));
const m = (type, x, y, buttons) => page.send('Input.dispatchMouseEvent',
  { type, x: Math.round(x), y: Math.round(y), button: 'left', buttons, clickCount: 1 });
const tap = async () => { await m('mouseMoved', cell.가운데.x, cell.가운데.y, 0);
  await m('mousePressed', cell.가운데.x, cell.가운데.y, 1); await sleep(90);
  await m('mouseReleased', cell.가운데.x, cell.가운데.y, 0); await sleep(1400); };
const dragToRoom = async () => {
  await m('mouseMoved', cell.가운데.x, cell.가운데.y, 0);
  await m('mousePressed', cell.가운데.x, cell.가운데.y, 1);
  for (let i = 1; i <= 10; i++) {
    await m('mouseMoved', cell.가운데.x + (room.x - cell.가운데.x) * i / 10,
                          cell.가운데.y + (room.y - cell.가운데.y) * i / 10, 1);
    await sleep(45);
  }
  await sleep(200);
  await m('mouseReleased', room.x, room.y, 0);
  await sleep(1600);
};
/* ★★ **손가락이 그 칸을 짚을 때까지 «손가락을 따라간다».**
   ⚠ 안 그러면 손가락이 시루 칸을 짚고 있어 **울타리가 몬스테라 누름을 삼킨다** —
     그건 «울타리가 제 일을 한 것»이지 고장이 아니다. 재려는 것은 Day 11 의 자리,
     즉 «손가락이 바로 그 칸을 짚고 있는데도 안 놓이는가»다. */
{
  const tapHint = async () => {
    const at = JSON.parse(await page.eval(`(()=>{ const t=document.querySelector('.hintTarget');
      const d=document.getElementById('hintDim');
      const hole=(d&&d.dataset.hole||'').split(',').map(Number);
      if (t) { const r=t.getBoundingClientRect();
        if (r.width>0) return JSON.stringify({ x:r.left+r.width/2, y:r.top+r.height/2 }); }
      if (hole.length===3 && hole.every(Number.isFinite)) return JSON.stringify({ x:hole[0], y:hole[1] });
      return 'null'; })()`));
    if (!at) return false;
    await m('mouseMoved', at.x, at.y, 0);
    await m('mousePressed', at.x, at.y, 1); await sleep(80);
    await m('mouseReleased', at.x, at.y, 0); await sleep(900);
    await clearDlg();
    return true;
  };
  for (let i = 0; i < 10; i++) {
    const who = await page.eval(`(()=>{ const t=document.querySelector('.hintTarget');
      return t ? String(t.id || t.className || '') : ''; })()`);
    console.log(`  · ${i}걸음 — 손가락이 짚는 것: ${who || '(없음)'}`);
    if (/potbag|bagslot/.test(who)) break;
    if (!await tapHint()) break;
  }
}
/* 칸 자리를 다시 잰다 — 시루를 놓는 사이에 격자가 바뀐다 */
Object.assign(cell, JSON.parse(await cellInfo()) || cell);
console.log('■ 다시 잰 칸 —', JSON.stringify(cell));
/* ★ 손가락을 따라오다 그루가 «이미 놓였으면» 가방으로 돌려놓고 잰다.
   ⚠ 자만의 손질이다. 판을 Day 11 의 그 자리(그루가 가방에 있다)로 맞추는 것뿐이다. */
/* ⚠⚠ **되돌리는 다시 그리기를 «가방이 안 보일 때» 한다.**
   총괄이 겪은 자리가 그것이다 — 선물이 [상점] 탭에서 도착했다. 가방이 보이는 채로 되돌리면
   그 순간 손잡이가 다시 걸려서 «자가 거짓으로 초록»이 된다(내가 그 판에 한 번 속았다). */
await page.eval(`(()=>{ try{ window.__byeotSheet.open('shop'); }catch(e){} })()`, false);
await sleep(600);
await page.eval(`(()=>{ const S=window.__S(); const p=(S.pots||[])[0];
  if (p && (p.slotId || p.at)) { p.slotId=null; p.at=null; p.placedOnce=false; }
  window.__redraw(); })()`, false);
await sleep(1000);
await page.eval(`(()=>{ const b=document.getElementById('tabBag'); if(b) b.click(); })()`, false);
await sleep(1200);
Object.assign(cell, JSON.parse(await cellInfo()) || cell);
console.log('■ 되돌린 뒤 칸 —', JSON.stringify(cell));
console.log('');
console.log('=== ⓪ ★ «도구가 부르는» 누름 (el.click()) — 총괄 자가 쓰는 그 길 ===');
await watch();
await page.eval(`(()=>{ const b=document.querySelector('#bagGrid [data-potbag]'); if(b) b.click(); })()`, false);
await sleep(1400);
console.log(' ', await state('DOM 누름'));
/* 되돌린다 — 다음 걸음을 같은 자리에서 재려고 */
await page.eval(`(()=>{ try{ window.__byeotSheet.open('shop'); }catch(e){} })()`, false);
await sleep(500);
await page.eval(`(()=>{ const S=window.__S(); const p=(S.pots||[])[0];
  if (p) { p.slotId=null; p.at=null; p.placedOnce=false; }
  try { if (window.__placeCancel) window.__placeCancel(); } catch(e){}
  window.__redraw(); })()`, false);
await sleep(900);
await page.eval(`(()=>{ const b=document.getElementById('tabBag'); if(b) b.click(); })()`, false);
await sleep(1000);
Object.assign(cell, JSON.parse(await cellInfo()) || cell);
console.log('');
console.log('=== ① «누름» (덮개 그대로) ===');
await watch(); await tap();
console.log(' ', await state('누름'));
console.log('');
console.log('=== ② «끌기» (덮개 그대로) — 칸에서 잡아 방바닥으로 ===');
await watch(); await dragToRoom();
console.log(' ', await state('끌기'));
await page.shot('docs/handoff/img/bagdragpot.png').catch(() => {});
console.log('');
console.log('=== ★ 울타리가 «아직 막나» — 손잡이가 «아닌» 곳을 눌러 본다 ===');
{
  /* 구멍 밖이고 끌 손잡이도 아닌 점 — 방 캔버스 한가운데 위쪽.
     ⚠ 「막아버려」가 살아 있어야 한다. 안 막으면 오늘 세운 것이 통째로 풀린 것이다. */
  await page.eval(`(()=>{ window.__blocked=null;
    const h=document.getElementById('hint');
    window.__knockBefore = h ? h.classList.contains('knock') : null; })()`, false);
  const pt = JSON.parse(await page.eval(`(()=>{ const c=document.getElementById('roomCanvas').getBoundingClientRect();
    const d=document.getElementById('hintDim');
    const v=(d&&d.dataset.hole||'').split(',').map(Number);
    /* 구멍에서 멀리 떨어진 점을 고른다 */
    const cand=[[c.left+c.width*0.25,c.top+c.height*0.30],[c.left+c.width*0.75,c.top+c.height*0.30],
                [c.left+c.width*0.5,c.top+c.height*0.20]];
    for (const [x,y] of cand) {
      if (v.length===3 && v.every(Number.isFinite) && Math.hypot(x-v[0],y-v[1])<=v[2]+40) continue;
      return JSON.stringify({ x:Math.round(x), y:Math.round(y) });
    }
    return 'null'; })()`));
  if (!pt) console.log('  ⚠ 잴 점을 못 골랐다');
  else {
    const before = await page.eval(`(()=>{ const rv=window.__rv; try { return String(rv.camera().az); } catch(e){ return 'x'; } })()`);
    await m('mouseMoved', pt.x, pt.y, 0);
    await m('mousePressed', pt.x, pt.y, 1);
    await sleep(140);
    const knock = await page.eval(`String(document.getElementById('hint').classList.contains('knock'))`);
    await m('mouseReleased', pt.x, pt.y, 0);
    await sleep(500);
    const after = await page.eval(`(()=>{ const rv=window.__rv; try { return String(rv.camera().az); } catch(e){ return 'x'; } })()`);
    console.log('  ·', JSON.stringify({ 점:pt, '손가락이 뛰었나':knock === 'true',
      '시점이 돌았나(막혔으면 안 돈다)': before !== after,
      덮개: JSON.parse(await state('울타리')).덮개 }));
  }
}
console.log('');
console.log('=== ③ ★ 덮개(울타리)를 «죽이고» 같은 두 몸짓 ===');
await page.eval(`(()=>{ const S=window.__S(); const p=(S.pots||[])[0];
  if (p) { p.slotId=null; p.at=null; p.placedOnce=false; }
  /* ⚠ 자만의 손질이다 — 게임 코드가 아니라 «이 판»의 덮개만 손짓을 안 먹게 한다.
     이렇게 해야 「울타리 탓인가」가 갈린다(총괄 청). */
  const d=document.getElementById('hintDim'); if (d) d.style.pointerEvents='none';
  window.__redraw(); })()`, false);
await sleep(1400);
const cell2 = JSON.parse(await cellInfo());
if (!cell2) console.log('  ⚠ 칸이 없어 다시 못 잰다');
else {
  await watch(); await tap();
  console.log('  · 누름 —', await state('누름(덮개 죽임)'));
  await watch(); await dragToRoom();
  console.log('  · 끌기 —', await state('끌기(덮개 죽임)'));
}
console.log('');
console.log('■ 탈 전부 —', await page.eval(`JSON.stringify((window.__errs||[]).slice(-10))`));
await page.close(); clearTimeout(wd);
