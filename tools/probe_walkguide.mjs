/* tools/probe_walkguide.mjs — **캐릭 이동 «세 걸음»이 서나** (박사님 「캐릭이동 강제 가이드」)
   ------------------------------------------------------------------
   [Plan] 세 걸음: ① 사람을 짚고 「사람을 눌러 보세요」 ② 방바닥을 짚고 「여기를 눌러 걸어가 보세요」
                  ③ 걸어간 «뒤» 「한 번 더 누르면 꺼집니다」
   ⚠ «다른 걸음이 섞이지 않게» 곧장 그 자리만 걷는다 — 심기·물주기를 누르면 사람이 저절로
     걸어가서 ②를 못 보게 된다(첫 판에서 그렇게 놓쳤다).
   ⛔ 값은 안 바꾼다. 넓은 화면(박사님 판)으로 잰다. */
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
const tapAt = async (x, y) => {
  await mouse('mouseMoved', x, y, 0);
  await mouse('mousePressed', x, y, 1);
  await sleep(60);
  await mouse('mouseReleased', x, y, 0);
  await sleep(1000);
};
const tapEl = async (sel) => {
  const at = JSON.parse(await page.eval(`(()=>{ const e=document.querySelector(${JSON.stringify(sel)});
    if(!e) return 'null'; const r=e.getBoundingClientRect();
    if(!r.width||!r.height) return 'null';
    return JSON.stringify({ x:r.left+r.width/2, y:r.top+r.height/2 }); })()`));
  if (!at) return false;
  await tapAt(at.x, at.y);
  return true;
};
/* ⚠ «진짜 마우스»로 넘긴다 — DOM `.click()` 은 이 대사에서 안 먹은 판이 있었다(실측) */
const dlgState = () => page.eval(`(()=>{ const sk=document.getElementById('dlgSkip');
  const bx=document.getElementById('dlgBox'); const t=document.getElementById('dlgText');
  const vis=(el)=>{ if(!el) return false; const r=el.getBoundingClientRect();
    const cs=getComputedStyle(el); return r.width>0&&r.height>0&&cs.display!=='none'&&cs.visibility!=='hidden'; };
  const r=bx?bx.getBoundingClientRect():null;
  const el=r?document.elementFromPoint(Math.round(r.left+r.width/2),Math.round(r.top+r.height/2)):null;
  return JSON.stringify({ 건너뛰기보이나: vis(sk), 상자보이나: vis(bx),
    글: t?(t.textContent||'').trim().slice(0,24):null,
    상자가운데의것: el?(el.id||el.tagName):null,
    건너뛰기가운데의것: (()=>{ if(!sk) return null; const r2=sk.getBoundingClientRect();
      const e2=document.elementFromPoint(Math.round(r2.left+r2.width/2), Math.round(r2.top+r2.height/2));
      return { 점:[Math.round(r2.left+r2.width/2), Math.round(r2.top+r2.height/2)],
        것: e2?(e2.id||e2.tagName+'.'+(e2.className||'').split(' ')[0]):null }; })() }); })()`);
const clearDlg = async () => { console.log('   · 대사 상태 —', await dlgState()); for (let i = 0; i < 25; i++) {
  const t = await page.eval(`document.getElementById('stage').classList.contains('talking')`);
  if (t !== 'true') return;
  /* ⚠ 여기서는 «DOM 클릭»이 먹고 진짜 마우스는 안 먹었다(재서 확인). 자의 한계이지
     게임 탈이 아니다 — 사람 손은 진짜 손짓이고, 그 길은 다른 자(probe_walkstep)가 지킨다. */
  await page.eval(`(()=>{ const b=document.getElementById('dlgSkip'); if (b) b.click();
    const x=document.getElementById('dlgBox'); if (x) x.click(); })()`, false);
  await sleep(220);
} };
const look = () => page.eval(`(()=>{ const h=document.getElementById('hint');
  const d=document.getElementById('hintDim'); const c=document.getElementById('coach');
  return JSON.stringify({ 손가락: !!(h && h.classList.contains('on')),
    말: h ? ((h.querySelector('.say')||{}).textContent||'').trim() : null,
    덮개: !!(d && d.classList.contains('on')),
    고름: (()=>{ try{ return window.__rv.selectedCharacter(); }catch(e){ return null; } })(),
    걷는중: (()=>{ try{ return (window.__rv.characters()||[]).some(x=>x&&x.walking); }catch(e){ return null; } })(),
    쪽지: (()=>{ const on = !!(c && c.classList.contains('on'));
      return on ? ((document.getElementById('coachBody')||{}).textContent||'').trim().slice(0,44) : null; })(),
    무대: (document.getElementById('stage').className||'').trim().slice(0,50),
    시루: (()=>{ try{ const b=window.__S().firstPlay.beansprout;
      return ((b&&b.pots)||[]).map(q=>({ 놓임:!!(q.slotId||q.at) })); }catch(e){ return null; } })(),
    '본 쪽지': (()=>{ try { return JSON.parse(localStorage.getItem('byeot.coach')||'[]'); }
      catch(e){ return null; } })() }); })()`);
/* ★ 대사가 «넘어가나»를 다섯 번 찍어 본다 — 안 넘어가면 그것이 답이다 */
for (let i = 0; i < 5; i++) {
  console.log(`  · 넘기기 ${i} —`, await page.eval(`(()=>{ const t=document.getElementById('dlgText');
    return JSON.stringify({ talking: document.getElementById('stage').classList.contains('talking'),
      글: t ? (t.textContent||'').trim().slice(0,22) : null,
      연것: (window.__dlgLog||[]).length }); })()`));
  await page.eval(`(()=>{ const b=document.getElementById('dlgSkip'); if (b) b.click(); })()`, false);
  await sleep(400);
}
await clearDlg();
/* ★ 시루를 «상태»로 놓는다 — 화면 길로 놓으면 몬이 대사가 뜨고, 대사 중에는 손가락이 «규칙대로»
   쉬어서 이 갈래를 못 본다(첫 판에서 그렇게 못 봤다). 여기서 보려는 것은 «갈래»지 «놓는 손»이 아니다.
   ⚠ 그래서 이 자는 「사람이 놓을 수 있다」를 «안 잽니다» — 그건 probe_walkstep 몫이다. */
console.log('· 시루를 상태로 놓는다 —', await page.eval(`(async()=>{ const st=await import('/src/game/state.js');
  const S=window.__S(); const io=window.__io;
  try {
    st.placeSiru(S, { x: 0.6, y: 0, z: 0.6 }, { size: io.light.room.size, slots: io.light.room.slots, snapDist: 0 });
  } catch(e) { try { st.setCropAt(S, { x: 0.6, y: 0, z: 0.6 },
      { size: io.light.room.size, slots: io.light.room.slots, snapDist: 0 }); }
    catch(e2) { return JSON.stringify({ 탈: e.message + ' / ' + e2.message }); } }
  window.__redraw();
  const b=S.firstPlay.beansprout;
  return JSON.stringify({ 시루: ((b&&b.pots)||[]).map(q=>({ 놓임: !!(q.slotId||q.at) })) }); })()`, true, 30000));
await sleep(1200);
/* ★ 놓으면 대사가 뜬다(퀘스트를 끝내고 여는 말) — 사람이 그것을 넘긴다. 자도 넘긴다. */
await clearDlg();
await sleep(1000);
console.log('① 시루를 놓고 대사를 걷은 뒤 —', await look());
/* 사람을 누른다 */
const at = JSON.parse(await page.eval(`(()=>{ try{
  const c=(window.__rv.characters()||[]).find(x=>x&&x.walkable); if(!c) return 'null';
  const p=window.__rv.screenPosOf(c.id); if(!p) return 'null';
  const r=document.getElementById('roomCanvas').getBoundingClientRect();
  return JSON.stringify({ x:r.left+p.x, y:r.top+p.y });
}catch(e){ return 'null'; } })()`));
if (!at) { console.log('⛔ 사람의 화면 자리를 못 얻었다'); }
else {
  await tapAt(at.x, at.y);
  console.log('② 사람을 누른 뒤 —', await look());
  /* ⚠ 진짜 손짓이 안 먹는 판이 있어(자의 한계) ⇒ 게임이 쓰는 «그 창구»로도 골라 본다.
     ★ 이건 「사람이 누를 수 있다」의 증거가 아니라 「고른 뒤 손가락이 «무엇을 짚나»」의 증거다. */
  await page.eval(`(()=>{ try{ const c=(window.__rv.characters()||[]).find(x=>x&&x.walkable);
    if(c) window.__rv.selectCharacter(c.id); window.__redraw(); }catch(e){} })()`, false);
  await sleep(900);
  console.log('②-b 창구로 골라 놓고 —', await look());
  const fl = JSON.parse(await page.eval(`(()=>{ const r=document.getElementById('roomCanvas').getBoundingClientRect();
    return JSON.stringify({ x:r.left+r.width*0.42, y:r.top+r.height*0.66 }); })()`));
  await tapAt(fl.x, fl.y);
  await sleep(1500);
  console.log('③ 방바닥을 누른 뒤 —', await look());
  await sleep(2500);
  console.log('④ 걸음이 끝난 뒤 —', await look());
}
await page.shot('docs/handoff/img/walkguide.png').catch(() => {});
await page.close(); clearTimeout(wd);
