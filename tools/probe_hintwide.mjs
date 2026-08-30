/* tools/probe_hintwide.mjs — **넓은 화면(PC)에서 「시루를 놓아라」 손가락이 뜨나**
   ------------------------------------------------------------------
   박사님이 PC 화면에서 보셨다: *"가이드가 없잖아, 시루 놓는 거."*
   ⚠ 내가 여태 잰 것은 전부 **폰 390×844** 였다. 박사님 판은 **넓은 화면**이다 —
     거기서는 가방이 «아래에서 올라오는 시트»가 아니라 «옆에 붙어» 늘 펴져 있다.
   ⇒ 그러면 「시트가 열렸으면 손가락을 감춘다」가 «가릴 것이 없는데» 감출 수 있다.
   재는 것: ① 넓은 화면에서 손가락이 뜨나 ② 무엇을 짚나 ③ 「시트 열림」을 어떻게 세나
            ④ 가방 칸이 화면에 «있나»(onScreen) ⑤ 대사·쪽지가 쉬게 하고 있나
   ⛔ 값은 안 바꾼다. */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8972';
const W = Number(process.env.W || 1990), H = Number(process.env.H || 1188);
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 300000);
wd.unref && wd.unref();
const page = await launch({ width: W, height: H, dpr: 1 });
await page.goto(`${BASE}/game.html`);
await page.eval('localStorage.clear()', false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 150000, 300);
await sleep(5000);
/* ★ 대사를 «test_uiwire 와 같은 손»으로 걷는다 — [건너뛰기] 한 번, 그 뒤 상자를 눌러 넘긴다.
   ⚠ 그리고 «넘어가고 있나»를 찍는다. 안 넘어가면 그것이 곧 답이다(굳은 것). */
const clearTalk = async (n = 60) => {
  await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s)s.click();})()`, false);
  await sleep(700);
  let last = null, same = 0;
  for (let i = 0; i < n; i++) {
    const t = await page.eval(`document.getElementById('stage').classList.contains('talking')`);
    if (t !== 'true') return { 걷힘: true, 돈횟수: i };
    const now = await page.eval(`((document.getElementById('dlgBox')||{}).textContent||'').slice(0,24)`);
    if (now === last) same++; else { same = 0; last = now; }
    if (same >= 8) return { 걷힘: false, 굳음: true, 마지막말: now, 돈횟수: i };
    await page.eval(`document.getElementById('dlgBox').click()`, false);
    await sleep(220);
  }
  return { 걷힘: false, 마지막말: last, 돈횟수: n };
};
const look = () => page.eval(`(()=>{ const h=document.getElementById('hint');
  const t=document.querySelector('.hintTarget'); const d=document.getElementById('hintDim');
  const sh=document.getElementById('sheet');
  const on=(el)=>{ if(!el) return false; const r=el.getBoundingClientRect();
    return r.width>0 && r.height>0 && r.bottom>0 && r.top<innerHeight; };
  const cell=document.getElementById('bagGrid') &&
    document.getElementById('bagGrid').querySelector('[data-place="beansprout"]');
  return JSON.stringify({
    화면: innerWidth + '×' + innerHeight,
    '손가락 떴나': !!(h && h.classList.contains('on')),
    '짚는 것': t ? (t.id || t.dataset.place || t.className) : null,
    말: h ? ((h.querySelector('.say')||{}).textContent||'').trim() : null,
    덮개: !!(d && d.classList.contains('on')),
    '시트 열림(class)': !!(sh && sh.classList.contains('open')),
    '시트가 화면에 있나': on(sh),
    '가방 단추 보이나': on(document.getElementById('openBag')),
    '가방 시루 칸 있나': !!cell, '그 칸이 화면에 있나': on(cell),
    무대: (document.getElementById('stage').className||'').trim(),
    '할 일': ((document.getElementById('questChipText')||{}).textContent||'').trim().slice(0,30)
  }); })()`);
console.log('■ 대사 걷기 —', JSON.stringify(await clearTalk()));
await page.eval(`window.__redraw()`, false);
await sleep(900);
/* ★★ 무대에 talking 이 «붙어 있다». 그런데 대사가 «보이나»? 「쉰다」와 「굳었다」를 가른다. */
console.log('=== ⓪ 대사가 «진짜» 떠 있나 (talking 이 굳은 것인가) ===');
console.log(' ', await page.eval(`(()=>{ const on=(el)=>{ if(!el) return false;
    const r=el.getBoundingClientRect(); const cs=getComputedStyle(el);
    return r.width>0 && r.height>0 && cs.display!=='none' && cs.visibility!=='hidden' && +cs.opacity>0.05; };
  const d=document.getElementById('dlg'), box=document.getElementById('dlgBox');
  return JSON.stringify({ 'stage.talking': document.getElementById('stage').classList.contains('talking'),
    '#dlg 있나': !!d, '#dlg 보이나': on(d), '#dlgBox 보이나': on(box),
    '#dlg class': d ? d.className : null,
    '대사 글': box ? (box.textContent||'').replace(/\s+/g,' ').trim().slice(0,60) : null,
    '[건너뛰기] 보이나': on(document.getElementById('dlgSkip')) }); })()`));
console.log('');
console.log('=== ① 넓은 화면 · 첫날 (아무것도 안 열고) ===');
console.log(' ', await look());
console.log('');
console.log('=== ② 가방을 «열면» ===');
await page.eval(`(()=>{ try{ window.__byeotSheet.open('bag'); }catch(e){} })()`, false);
await sleep(1200);
await page.eval(`window.__redraw()`, false);
await sleep(700);
console.log(' ', await look());
console.log('');
console.log('=== ③ 가방을 «닫으면» ===');
await page.eval(`(()=>{ try{ window.__byeotSheet.close(); }catch(e){} window.__redraw(); })()`, false);
await sleep(1200);
console.log(' ', await look());
await page.shot('docs/handoff/img/hintwide.png').catch(() => {});
await page.close(); clearTimeout(wd);
