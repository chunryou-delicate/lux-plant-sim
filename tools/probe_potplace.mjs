/* 화분을 눌러서 실제로 심어지나 — 다섯 종 전부 (2026-08-16) */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const page = await launch({ width: 1280, height: 900, dpr: 1, mobile: false });
const errs=[]; page.on(m=>{ if(m.method==='Runtime.exceptionThrown') errs.push((m.params.exceptionDetails.exception||{}).description||''); });
await page.goto(`${BASE}/game.html`);
await page.eval(`localStorage.clear()`, false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 180000, 300);
await page.waitFor('window.__byeotBooted === true', 180000, 300);
await sleep(7000);
for (let i=0;i<40;i++){
  const busy = await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');
    return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`);
  if(!busy) break;
  await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s)s.click();
    const b=document.getElementById('dlgBox'); if(b)b.click();
    const g=document.getElementById('guideClose'); if(g)g.click();})()`, false);
  await sleep(220);
}
const POTS = ['pot','pot_concrete_round','pot_terracotta','pot_ceramic','pot_concrete_square'];
for (const id of POTS) {
  /* 재고를 넣고 체력을 푼다 */
  await page.eval(`(()=>{ const S=window.__S();
    S.shop.stock['monstera_seed']=1; S.shop.stock[${JSON.stringify(id)}]=1;
    if (S.stamina) S.stamina.usedToday=0; window.__redraw&&window.__redraw(); })()`, false);
  await sleep(500);
  const before = await page.eval(`(window.__S().pots.length + (window.__S().emptyPots||[]).length)`);
  const r = await page.eval(`(()=>{ try {
    window.__byeotSheet.open(); window.__byeotSheet.tab('bag');
    const cell=[...document.querySelectorAll('.bagslot[data-place]')]
      .find(c=>/monsteraSeed:${id}$/.test(c.dataset.place));
    if(!cell) return 'no-cell';
    /* ★ 끌기 손잡이가 실제로 걸렸나 — 그림이 없어도 걸려야 한다 */
    const handle = cell.querySelector('img.draggable') || (cell.classList.contains('draggable') ? cell : null);
    cell.dispatchEvent(new MouseEvent('click',{bubbles:true}));
    return JSON.stringify({ 눌렀다: true, 끌기손잡이: !!handle }); } catch(e){ return 'ERR '+e.message; } })()`);
  /* 왜 안 됐는지 — 코어를 직접 불러 본다 */
  const why = await page.eval(`(()=>{ try {
    const S=window.__S(), io=window.__io;
    const g = io && io.growth;
    const multi = g && typeof g.multi === 'function' ? g.multi() : 'no-fn';
    return JSON.stringify({ multi, addPlant: !!(g&&g.addPlant), selectPlant: !!(g&&g.select) });
  } catch(e){ return 'ERR '+e.message; } })()`);
  console.log('   생장 창:', why);
  /* 화면 길 말고 **코어를 직접** 불러 본다 — 던지면 그 말이 곧 원인이다 */
  const direct = await page.eval(`(()=>{ try {
    const cell=[...document.querySelectorAll('.bagslot[data-place]')]
      .find(c=>/monsteraSeed:${id}$/.test(c.dataset.place));
    return JSON.stringify({ 칸있나: !!cell, place: cell? cell.dataset.place : null,
      thumb: cell? !!cell.querySelector('img[id]') : null,
      thumbId: cell? (cell.querySelector('img[id]')||{}).id : null }); } catch(e){ return 'ERR '+e.message; } })()`);
  console.log('   칸:', direct);
  /* 배너에 무슨 말이 떴나 — 코어가 던졌으면 그 말이 거기 있다 */
  const ban = await page.eval(`(()=>{ const b=document.getElementById('banners')||document.body;
    return (b.textContent||'').replace(/\s+/g,' ').trim().slice(-200); })()`);
  console.log('   배너:', ban);
  const dir = await page.eval(`JSON.stringify(window.__placePot('monsteraSeed:${id}'))`);
  console.log('   직접:', dir, '· 화분', await page.eval(`(window.__S().pots.length + (window.__S().emptyPots||[]).length)`));
  await sleep(1400);
  const after = await page.eval(`(window.__S().pots.length + (window.__S().emptyPots||[]).length)`);
  const potAsset = await page.eval(`(()=>{ const S=window.__S(); const p=S.pots[S.pots.length-1];
    return p ? JSON.stringify({ potAsset:p.potAsset, fromSeed:!!p.fromSeed, slotId:p.slotId }) : 'none'; })()`);
  console.log(`${id.padEnd(21)} ${r} · 화분 ${before} → ${after}  ${after>before?'✔ 심어짐':'✘ 안 됨'}  ${potAsset}`);
}
console.log('예외', errs.length, errs.slice(0,2).join(' | '));
await page.close();
