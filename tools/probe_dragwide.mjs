/* tools/probe_dragwide.mjs — **덮개가 «끌기»를 먹나** (박사님: 「가이드 있어도 드래그 되게」)
   ------------------------------------------------------------------
   박사님이 PC 넓은 화면에서: *"여기서 또 «드래그가 갑자기 안 되네» … 일전에 «됐는데»
   «가이드 생기고» 안 되는 듯?? «가이드 있어도 드래그 되게» 바꿔."*
   ⇒ 재는 것은 하나다 — **덮개가 켜진 채로 끌면 되나 · 덮개를 끄면 되나.**
   ⚠ «진짜 마우스»(CDP Input)로 끈다. 합성 이벤트로는 붙잡기(setPointerCapture)를 못 흉내 낸다.
   ⚠ 그리고 **박사님 화면 크기**로 잰다 — 폰에서는 가방이 아래 시트라 겹치는 모양이 다르다.
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
const mouse = (type, x, y, buttons) => page.send('Input.dispatchMouseEvent',
  { type, x: Math.round(x), y: Math.round(y), button: 'left', buttons, clickCount: 1 });
const clearTalk = async () => {
  await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s)s.click();})()`, false);
  await sleep(700);
  for (let i = 0; i < 60; i++) {
    const t = await page.eval(`document.getElementById('stage').classList.contains('talking')`);
    if (t !== 'true') return true;
    await page.eval(`document.getElementById('dlgBox').click()`, false);
    await sleep(200);
  }
  return false;
};
const placed = () => page.eval(`(()=>{ const b=window.__S().firstPlay.beansprout;
  return String(((b&&b.pots)||[]).filter(p=>p&&(p.slotId||p.at)).length); })()`);
const state = () => page.eval(`(()=>{ const d=document.getElementById('hintDim');
  const h=document.getElementById('hint'); const t=document.querySelector('.hintTarget');
  return JSON.stringify({ 덮개: !!(d && d.classList.contains('on')),
    '덮개가 손짓을 먹나': d ? getComputedStyle(d).pointerEvents !== 'none' : null,
    손가락: !!(h && h.classList.contains('on')),
    짚는것: t ? (t.id || t.dataset.place || t.className) : null }); })()`);
/* 가방 시루 칸의 한가운데와, 방 바닥의 한 점 */
const cellXY = () => page.eval(`(()=>{ const c=document.querySelector('.bagslot[data-place="beansprout"]');
  if(!c) return 'null'; const r=c.getBoundingClientRect();
  return JSON.stringify({ x:r.left+r.width/2, y:r.top+r.height/2 }); })()`);
const roomXY = () => page.eval(`(()=>{ const c=document.getElementById('roomCanvas');
  const r=c.getBoundingClientRect();
  return JSON.stringify({ x:r.left+r.width*0.45, y:r.top+r.height*0.62 }); })()`);

console.log('■ 대사 걷기 —', await clearTalk());
await page.eval(`(()=>{ try{ window.__byeotSheet.open('bag'); }catch(e){} window.__redraw(); })()`, false);
await sleep(1400);
console.log('■ 판 —', await state(), '· 놓인 시루', await placed(), '· 화면', W + '×' + H);

/* ── 끌어 본다 ── */
async function dragOnce(ko) {
  const a = JSON.parse(await cellXY()), b = JSON.parse(await roomXY());
  if (!a) { console.log(`  ${ko} — 가방 칸이 없다`); return null; }
  const was = await placed();
  await mouse('mouseMoved', a.x, a.y, 0);
  await mouse('mousePressed', a.x, a.y, 1);
  await sleep(120);
  for (let i = 1; i <= 12; i++) {
    await mouse('mouseMoved', a.x + (b.x - a.x) * i / 12, a.y + (b.y - a.y) * i / 12, 1);
    await sleep(40);
  }
  await sleep(200);
  const mid = await page.eval(`JSON.stringify({ 끌고있나: !!(window.__drag && window.__drag.on),
    유령: !!(document.getElementById('dragGhost')||{}).classList &&
      document.getElementById('dragGhost').classList.contains('on'),
    '끄는 중 덮개': (()=>{ const d=document.getElementById('hintDim');
      return !!(d && d.classList.contains('on')); })() })`);
  await mouse('mouseReleased', b.x, b.y, 0);
  await sleep(1500);
  const now = await placed();
  console.log(`  ${ko} — 끄는 중: ${mid} · 놓인 시루 ${was} → ${now} ⇒ ` +
              (now > was ? '✔ 끌기가 된다' : '⛔ 안 된다'));
  return now > was;
}
console.log('');
console.log('=== ① 덮개가 «켜진» 채로 끌기 ===');
const withDim = await dragOnce('덮개 켬');
console.log('');
console.log('=== ★ 박사님이 막히신 그 칸 — «몬스테라» 가방 칸 ===');
/* ⚠ 위 ①은 «시루» 칸이었다. 박사님이 막히신 것은 **몬스테라 칸**이다(가방 칸이 그루마다
   `drawBag` 에서 새로 만들어지는 그 칸 · 나흘짜리 그 자리). 판을 그 자리에 세운다. */
console.log('  · 몬이를 가방에 —', await page.eval(`(async()=>{ const st=await import('/src/game/state.js');
  const S=window.__S(); if(!(S.pots||[]).length) st.givePlant(S, window.__io);
  const p=(S.pots||[])[0]; p.slotId=null; p.at=null; p.placedOnce=false;
  S.firstPlay.monstera.arrived=true; window.__redraw();
  return JSON.stringify({ 화분:p.id, placedOnce:p.placedOnce }); })()`, true, 60000));
await sleep(1200);
await page.eval(`(()=>{ try{ window.__byeotSheet.open('bag'); }catch(e){} window.__redraw(); })()`, false);
await sleep(1400);
console.log('  · 판 —', await state());
{
  const at = JSON.parse(await page.eval(`(()=>{ const c=document.querySelector('[data-potbag]');
    if(!c) return 'null'; const r=c.getBoundingClientRect();
    return JSON.stringify({ x:r.left+r.width/2, y:r.top+r.height/2 }); })()`));
    /* ⚠ 아무 데나 떨구면 「가구·벽에 걸립니다」로 «옳게» 막힌다 — 첫 판에서 그랬다.
       ⇒ 그러면 「끌기가 안 된다」가 아니라 「거기에 못 놓는다」이다. 둘을 가르려고
         ★ 손가락이 짚는 «그 자리»(제일 밝은 칸)로 떨군다. */
    const to = JSON.parse(await page.eval(`(()=>{ try{
      const S=window.__S();
      const rows=[...(window.__io.light.daily(S.day+1,S).report.slots||[])].sort((a,b)=>b.dli-a.dli);
      const p=window.__rv.screenPosOf(rows[0].slotId);
      const c=document.getElementById('roomCanvas').getBoundingClientRect();
      return JSON.stringify(p ? { x:c.left+p.x, y:c.top+p.y, 자리:rows[0].slotId } : null);
    }catch(e){ return 'null'; } })()`)) || JSON.parse(await roomXY());
  if (!at) console.log('  ⛔ 몬스테라 가방 칸이 없다');
  else {
    const was = await page.eval(`(()=>{ const p=(window.__S().pots||[])[0];
      return String(!!(p && (p.slotId || p.at))); })()`);
    await mouse('mouseMoved', at.x, at.y, 0);
    await mouse('mousePressed', at.x, at.y, 1);
    await sleep(120);
    for (let i = 1; i <= 12; i++) {
      await mouse('mouseMoved', at.x + (to.x - at.x) * i / 12, at.y + (to.y - at.y) * i / 12, 1);
      await sleep(40);
    }
    await sleep(200);
    const mid = await page.eval(`JSON.stringify({ 끌고있나: !!(window.__drag && window.__drag.on),
      무엇을: window.__drag && window.__drag.what,
      유령보이나: (()=>{ const g=document.getElementById('dragGhost');
        return !!(g && getComputedStyle(g).display !== 'none'); })(),
      덮개: (()=>{ const d=document.getElementById('hintDim');
        return !!(d && d.classList.contains('on')); })() })`);
    await mouse('mouseReleased', to.x, to.y, 0);
    await sleep(1800);
    const now = await page.eval(`(()=>{ const p=(window.__S().pots||[])[0];
      return JSON.stringify({ 놓임: !!(p && (p.slotId || p.at)), slotId: p&&p.slotId,
        at: p&&p.at? [Math.round(p.at.x*100)/100, Math.round(p.at.z*100)/100] : null }); })()`);
    console.log('  · 끄는 중 —', mid);
    console.log('  · 뗀 뒤 —', now, `(끌기 전 놓임: ${was})`);
    console.log('  · 화면이 뭐라 하나 —', await page.eval(`(()=>{ const ev=document.getElementById('event');
      const dl=document.getElementById('dropLabel');
      return JSON.stringify({ 알림: ev ? (ev.textContent||'').replace(/\s+/g,' ').trim().slice(0,100) : null,
        아래글: dl ? (dl.textContent||'').trim().slice(0,60) : null,
        '아래글 빨간가': !!(dl && dl.classList.contains('no')),
        마지막로그: (()=>{ const S=window.__S(); const r=(S.log||[]).slice(-2);
          return r.map(x=> typeof x==='string'? x : (x.msg||x.ko||'')).join(' | ').slice(0,120); })() }); })()`));
  }
}
console.log('');
console.log('=== ② 덮개를 «끄고» 끌기 (덮개 탓인지 가른다) ===');
await page.eval(`(()=>{ const d=document.getElementById('hintDim');
  if (d) { d.classList.remove('on'); d.style.display='none'; } })()`, false);
await sleep(400);
const noDim = await dragOnce('덮개 끔');
console.log('');
console.log('★ 판정 —', withDim === noDim
  ? '덮개 탓이 «아니다» (둘 다 ' + (withDim ? '된다' : '안 된다') + ')'
  : (noDim ? '★ 덮개가 «범인»이다 — 끄면 된다' : '★ 덮개를 꺼도 안 된다 — 더 앞이다'));
await page.shot('docs/handoff/img/dragwide.png').catch(() => {});
await page.close(); clearTimeout(wd);
