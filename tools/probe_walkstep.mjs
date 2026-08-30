/* tools/probe_walkstep.mjs — **처음부터 걸으며 「할 일 · 손가락 · 쪽지」를 걸음마다 찍는다**
   ------------------------------------------------------------------
   박사님 뜻: *"전혀 모르는 사람이 «일단 초반엔 따라하게» 해야지."*
   ⇒ 그러면 «따라할 것»이 걸음마다 «있어야» 하고 «가려지면» 안 된다. 그 둘을 같이 본다.
   재는 것: ① 할 일이 걸음마다 «바뀌나» ② 손가락이 «그 걸음의 것»을 짚나
            ③ 쪽지가 손가락을 «덮나» ④ ★ 쪽지가 «돈·체력·날짜 띠»를 가리나
   ⚠ 넓은 화면(박사님 판)으로 잰다. ⛔ 값은 안 바꾼다. */
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
await sleep(5000);
const mouse = (type, x, y, buttons) => page.send('Input.dispatchMouseEvent',
  { type, x: Math.round(x), y: Math.round(y), button: 'left', buttons, clickCount: 1 });
const tapEl = async (sel) => {
  const at = JSON.parse(await page.eval(`(()=>{ const e=document.querySelector(${JSON.stringify(sel)});
    if(!e) return 'null'; const r=e.getBoundingClientRect();
    if(!r.width||!r.height) return 'null';
    return JSON.stringify({ x:r.left+r.width/2, y:r.top+r.height/2 }); })()`));
  if (!at) return false;
  await mouse('mouseMoved', at.x, at.y, 0);
  await mouse('mousePressed', at.x, at.y, 1);
  await sleep(60);
  await mouse('mouseReleased', at.x, at.y, 0);
  await sleep(900);
  return true;
};
const row = async (ko) => {
  const r = await page.eval(`(()=>{ const h=document.getElementById('hint');
    const t=document.querySelector('.hintTarget'); const d=document.getElementById('hintDim');
    const c=document.getElementById('coach'); const tb=document.getElementById('topbar');
    const on=(el)=>{ if(!el) return false; const cs=getComputedStyle(el);
      const r2=el.getBoundingClientRect();
      return r2.width>0 && r2.height>0 && cs.display!=='none' && cs.visibility!=='hidden'; };
    /* ★ 쪽지가 돈·체력·날짜 띠를 «덮나» — 네모가 겹치나로 본다 */
    let cover = null;
    if (on(c) && tb) { const a=c.getBoundingClientRect(), b=tb.getBoundingClientRect();
      const ov = !(a.bottom<=b.top || b.bottom<=a.top || a.right<=b.left || b.right<=a.left);
      cover = ov ? { 겹침: true, 쪽지: [Math.round(a.top), Math.round(a.bottom)],
                     띠: [Math.round(b.top), Math.round(b.bottom)] } : { 겹침: false }; }
    return JSON.stringify({
      '할 일': ((document.getElementById('questChipText')||{}).textContent||'').trim().slice(0,28),
      손가락: !!(h && h.classList.contains('on')),
      짚는것: t ? (t.id || t.dataset.place || t.dataset.potbag || t.className.split(' ')[0]) : null,
      말: h ? ((h.querySelector('.say')||{}).textContent||'').trim().slice(0,34) : null,
      덮개: !!(d && d.classList.contains('on')),
      쪽지: on(c) ? ((document.getElementById('coachKo')||{}).textContent||'쪽지').trim().slice(0,18) : null,
      /* ★ 손가락이 쉴 때 «말풍선»이 안내를 맡는다 — 그것도 없으면 «안내가 없는» 것이다 */
      말풍선: [...document.querySelectorAll('#marks .mark')]
        .map(e=>(e.getAttribute('aria-label')||e.textContent||'').trim()).slice(0,3),
      시루: (()=>{ try { const b2=window.__S().firstPlay.beansprout;
        return ((b2&&b2.pots)||[]).map(q=>({ 놓임:!!(q.slotId||q.at), 심음:!!q.sown,
          물:q.startedOnDay!=null })); } catch(e){ return null; } })(),
      씨앗: (()=>{ try { return (window.__S().shop.stock||{}).bean_seed||0; } catch(e){ return null; } })(),
      무대: (document.getElementById('stage').className||'').trim().slice(0,60),
      /* ★ talking 이 붙었는데 «대사가 보이나» — 「쉰다」와 「굳었다」를 가르는 값 */
      대사: (()=>{ const d=document.getElementById('dlg'), b3=document.getElementById('dlgBox');
        const vis=(el)=>{ if(!el) return false; const cs=getComputedStyle(el);
          const r3=el.getBoundingClientRect();
          return r3.width>0 && r3.height>0 && cs.display!=='none' && cs.visibility!=='hidden' && +cs.opacity>0.05; };
        return { 보이나: vis(d), 상자보이나: vis(b3),
          글: b3 ? (b3.textContent||'').replace(/[ 	]+/g,' ').trim().slice(0,40) : null }; })(),
      /* ★ 말풍선을 짓는 코어 줄 그대로 — 「왜 안 뜨나」는 여기 있다 */
      줄: (()=>{ try { const fp=window.__S().firstPlay;
        return (window.__cropRows ? window.__cropRows() : []).slice(0,2); } catch(e){ return 'n/a'; } })(),
      '쪽지가 띠를 가리나': cover
    }); })()`);
  console.log(`  ${ko}\n     ${r}`);
};
/* 대사 걷기 */
await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s)s.click();})()`, false);
await sleep(700);
for (let i = 0; i < 60; i++) {
  const t = await page.eval(`document.getElementById('stage').classList.contains('talking')`);
  if (t !== 'true') break;
  await page.eval(`document.getElementById('dlgBox').click()`, false);
  await sleep(200);
}
console.log('=== 걸음마다 ===');
await row('① 대사를 다 넘긴 뒤');
await page.eval(`(()=>{ try{ window.__byeotSheet.open('bag'); }catch(e){} })()`, false);
await sleep(1200);
await row('② 가방을 연 뒤');
await tapEl('.bagslot[data-place="beansprout"]');
await sleep(600);
await row('③ 시루 칸을 누른 뒤 ([확인] 이 떠야 한다)');
await tapEl('#placeOk');
await sleep(1200);
await row('④ [확인] 을 누른 뒤 (이제 심어야 한다)');
await sleep(2500);
await row('⑤ 2.5초 더 기다린 뒤 (쪽지가 끼어드나)');
/* ★★ ② 걸음 — 사람을 «고른 뒤»에는 «방바닥»을 짚어야 한다([Plan] 세 걸음의 둘째).
   ⚠ 여기서는 게임이 쓰는 창구로 고른다 — 「사람이 누를 수 있나」가 아니라
     「고른 뒤 손가락이 «무엇을» 짚나」를 보는 자리다. */
await page.eval(`(()=>{ try{ const c=(window.__rv.characters()||[]).find(x=>x&&x.walkable);
  if (c) window.__rv.selectCharacter(c.id); window.__redraw(); }catch(e){} })()`, false);
await sleep(900);
console.log('  ★ 사람을 고른 뒤 손가락 —', await page.eval(`(()=>{ const h=document.getElementById('hint');
  const d=document.getElementById('hintDim');
  return JSON.stringify({ 고름: (()=>{ try{ return window.__rv.selectedCharacter(); }catch(e){ return null; } })(),
    손가락: !!(h && h.classList.contains('on')),
    말: h ? ((h.querySelector('.say')||{}).textContent||'').trim() : null,
    덮개: !!(d && d.classList.contains('on')) }); })()`));
await page.eval(`(()=>{ try{ window.__rv.selectCharacter(null); window.__redraw(); }catch(e){} })()`, false);
await sleep(400);
/* ★ 캐릭 이동 손가락 — 놓은 «직후»에 서야 한다(대사를 걷고 나서) */
for (let i = 0; i < 30; i++) {
  const t = await page.eval(`document.getElementById('stage').classList.contains('talking')`);
  if (t !== 'true') break;
  await page.eval(`(()=>{ const b=document.getElementById('dlgSkip');
    if (b && b.offsetParent !== null) b.click();
    const x=document.getElementById('dlgBox'); if (x) x.click(); })()`, false);
  await sleep(200);
}
await sleep(900);
console.log('  ★ 캐릭 손가락 —', await page.eval(`(()=>{ const h=document.getElementById('hint');
  const d=document.getElementById('hintDim');
  return JSON.stringify({ 손가락: !!(h && h.classList.contains('on')),
    말: h ? ((h.querySelector('.say')||{}).textContent||'').trim() : null,
    덮개: !!(d && d.classList.contains('on')) }); })()`));
/* ★ ④에서 무대에 talking 이 다시 붙었다 — 놓고 나면 몬이가 «말을 건다».
   사람은 그것을 넘긴다. 자도 그래야 한다 — 안 넘기면 「안내가 없다」로 잘못 읽는다. */
/* ⚠ `.click()` 으로는 안 넘어간다 — 이 대사는 «진짜 손짓»으로 넘긴다(실측: 40번 눌러도 그대로).
   ⇒ 사람이 하는 그대로 «진짜 마우스»로 상자를 누른다. */
for (let i = 0; i < 40; i++) {
  const t = await page.eval(`document.getElementById('stage').classList.contains('talking')`);
  if (t !== 'true') break;
  if (!await tapEl('#dlgBox')) break;
}
await sleep(900);
await row('⑤-b 놓은 뒤 대사를 «넘긴» 다음');
/* ★★ 눌러도 안 넘어간다 — 「안 넘어가나」와 「넘어갔는데 «다시 열리나»」를 가른다.
   `window.__dlgLog` 가 대사를 «연 기록»을 남긴다(§dlgOpen). 그 길이를 앞뒤로 잰다. */
console.log('  · 눌러 보며 —', await page.eval(`(async()=>{
  const log=()=>((window.__dlgLog||[]).length);
  const txt=()=>((document.getElementById('dlgText')||{}).textContent||'').slice(0,18);
  const idx=()=>{ try { return window.__dlgIdx ? window.__dlgIdx() : null; } catch(e){ return null; } };
  const out={ 전: { 연기록: log(), 글: txt() } };
  document.getElementById('dlgBox').click();
  await new Promise(r=>setTimeout(r,400));
  out.한번누른뒤 = { 연기록: log(), 글: txt(),
    talking: document.getElementById('stage').classList.contains('talking') };
  document.getElementById('dlgBox').click();
  await new Promise(r=>setTimeout(r,400));
  out.두번누른뒤 = { 연기록: log(), 글: txt(),
    talking: document.getElementById('stage').classList.contains('talking') };
  out['연 기록 꼬리'] = (window.__dlgLog||[]).slice(-4);
  return JSON.stringify(out); })()`, true, 30000));
/* ★ 대사 상자 한가운데에 «무엇이» 있나 — 손짓이 어디로 가는지 본다 */
console.log('  · 대사 상자 한가운데의 것 —', await page.eval(`(()=>{
  const b=document.getElementById('dlgBox'); if(!b) return 'null';
  const r=b.getBoundingClientRect(); const x=Math.round(r.left+r.width/2), y=Math.round(r.top+r.height/2);
  const el=document.elementFromPoint(x,y);
  const inBox = !!(el && b.contains(el));
  return JSON.stringify({ 점:[x,y], 잡히는것: el ? (el.id || el.tagName + '.' + (el.className||'').split(' ')[0]) : null,
    '상자 안인가': inBox,
    'dlg pointer-events': getComputedStyle(document.getElementById('dlg')).pointerEvents,
    'dlgBox pointer-events': getComputedStyle(b).pointerEvents }); })()`));
/* ★ 안 넘어간다 — [건너뛰기]로도 안 되나 · 넘어갔다가 «다시 열리나»를 가른다 */
console.log('  · [건너뛰기] 눌러 봄 —', await tapEl('#dlgSkip'));
await sleep(600);
console.log('    ', await page.eval(`(()=>{ const st=document.getElementById('stage');
  const b=document.getElementById('dlgBox');
  return JSON.stringify({ talking: st.classList.contains('talking'),
    글: b ? (b.textContent||'').replace(/[ 	]+/g,' ').trim().slice(0,40) : null }); })()`));
await sleep(1500);
console.log('    1.5초 뒤 —', await page.eval(`(()=>{ const st=document.getElementById('stage');
  const b=document.getElementById('dlgBox');
  return JSON.stringify({ talking: st.classList.contains('talking'),
    글: b ? (b.textContent||'').replace(/[ 	]+/g,' ').trim().slice(0,40) : null }); })()`));
/* 시루 말풍선을 눌러 심기 */
await tapEl('#marks .mark');
await sleep(1600);
await row('⑥ 시루 말풍선을 누른 뒤');
await tapEl('#marks .mark');
await sleep(1600);
await row('⑦ 한 번 더 누른 뒤');
/* ★★★ 총괄 물음 ① — **사람을 «한 번도 안 눌러도» 끝까지 가나.**
   ⇒ 여기서부터는 «캐릭터를 절대 안 누른다». 시루 말풍선과 [다음 날]만 누른다. */
console.log('');
console.log('=== ★ 캐릭 이동 손가락이 «서나» (박사님 「강제 가이드」) ===');
console.log(' ', await page.eval(`(()=>{ const h=document.getElementById('hint');
  const d=document.getElementById('hintDim');
  return JSON.stringify({ 손가락: !!(h && h.classList.contains('on')),
    말: h ? ((h.querySelector('.say')||{}).textContent||'').trim() : null,
    덮개: !!(d && d.classList.contains('on')),
    '본 쪽지': (()=>{ try { return JSON.parse(localStorage.getItem('byeot.coach')||'[]'); }
      catch(e){ return null; } })() }); })()`));
/* ★ ②③ — 사람을 «눌러» 보고, 방바닥을 «눌러» 걸어가 본다 */
{
  const at = JSON.parse(await page.eval(`(()=>{ try{
    const c=(window.__rv.characters()||[]).find(x=>x&&x.walkable); if(!c) return 'null';
    const p=window.__rv.screenPosOf(c.id); if(!p) return 'null';
    const r=document.getElementById('roomCanvas').getBoundingClientRect();
    return JSON.stringify({ x:r.left+p.x, y:r.top+p.y, id:c.id });
  }catch(e){ return 'null'; } })()`));
  if (!at) console.log('  ⛔ 사람의 화면 자리를 못 얻었다');
  else {
    await mouse('mouseMoved', at.x, at.y, 0);
    await mouse('mousePressed', at.x, at.y, 1);
    await sleep(60);
    await mouse('mouseReleased', at.x, at.y, 0);
    await sleep(1200);
    console.log('  ② 사람을 누른 뒤 —', await page.eval(`(()=>{ const h=document.getElementById('hint');
      return JSON.stringify({ 고름: (()=>{ try{ return window.__rv.selectedCharacter(); }catch(e){ return null; } })(),
        손가락: !!(h && h.classList.contains('on')),
        말: h ? ((h.querySelector('.say')||{}).textContent||'').trim() : null }); })()`));
    /* 방바닥 — 손가락이 짚는 그 자리를 그대로 누른다 */
    const fl = JSON.parse(await page.eval(`(()=>{ const r=document.getElementById('roomCanvas').getBoundingClientRect();
      return JSON.stringify({ x:r.left+r.width*0.42, y:r.top+r.height*0.66 }); })()`));
    await mouse('mouseMoved', fl.x, fl.y, 0);
    await mouse('mousePressed', fl.x, fl.y, 1);
    await sleep(60);
    await mouse('mouseReleased', fl.x, fl.y, 0);
    await sleep(2200);
    console.log('  ③ 방바닥을 누른 뒤 —', await page.eval(`(()=>{ const h=document.getElementById('hint');
      const c=document.getElementById('coach');
      return JSON.stringify({ 걷는중: (()=>{ try{ return (window.__rv.characters()||[])
          .some(x=>x&&x.walking); }catch(e){ return null; } })(),
        쪽지: !!(c && c.classList.contains('on')),
        쪽지말: ((document.getElementById('coachBody')||{}).textContent||'').trim().slice(0,40),
        손가락: !!(h && h.classList.contains('on')),
        말: h ? ((h.querySelector('.say')||{}).textContent||'').trim() : null,
        '본 쪽지': (()=>{ try { return JSON.parse(localStorage.getItem('byeot.coach')||'[]'); }
          catch(e){ return null; } })() }); })()`));
  }
}
console.log('');
console.log('=== ★ 사람을 «한 번도 안 누르고» 계속 가 본다 ===');
const clearDlg = async () => {
  for (let i = 0; i < 30; i++) {
    const t = await page.eval(`document.getElementById('stage').classList.contains('talking')`);
    if (t !== 'true') return;
    if (!await tapEl('#dlgSkip')) return;
  }
};
for (let step = 1; step <= 8; step++) {
  await clearDlg();
  /* 말풍선이 있으면 그것을 누른다 — 그것이 「지금 할 일」이다 */
  const hadMark = await tapEl('#marks .mark');
  if (!hadMark) {
    /* 할 일이 없으면 하루를 넘긴다 */
    await tapEl('#next');
  }
  await sleep(1200);
  await row(`걸음 ${step} (${hadMark ? '말풍선' : '다음 날'})`);
}
/* ★★ 총괄 ②(ㄱ)·④ 확인 — 「대사 중에는 안 짚고 · 걷히면 «저절로» 돌아온다」 */
console.log('');
console.log('=== ★ 대사 중 ⇄ 걷힌 뒤 (아무것도 안 누르고 기다린다) ===');
{
  const st = async () => JSON.parse(await page.eval(`(()=>{ const h=document.getElementById('hint');
    const t=document.querySelector('.hintTarget'); const d=document.getElementById('hintDim');
    return JSON.stringify({ talking: document.getElementById('stage').classList.contains('talking'),
      손가락: !!(h && h.classList.contains('on')), 짚는것: t ? (t.id||t.className.split(' ')[0]) : null,
      '빛나는 테': !!t, 덮개: !!(d && d.classList.contains('on')) }); })()`));
  console.log('  · 대사 중 —', JSON.stringify(await st()));
  await tapEl('#dlgSkip');
  await sleep(1100);          /* ⚠ 아무것도 안 누르고 기다린다 — 지킴이가 세워야 한다 */
  console.log('  · 걷은 뒤 1.1초 —', JSON.stringify(await st()));
}
console.log('');
console.log('■ 사람을 누른 적 —', await page.eval(`(()=>{ const S=window.__S();
  return JSON.stringify({ '캐릭터 고름': !!(window.__rv && window.__rv.selectedCharacter
      && window.__rv.selectedCharacter()),
    '첫 플레이 단계': S.firstPlay && S.firstPlay.phase,
    '날': S.day,
    '시루': ((S.firstPlay.beansprout||{}).pots||[]).map(q=>({ 놓임:!!(q.slotId||q.at),
      심음:!!q.sown, 물:q.startedOnDay!=null, 거둠:!!q.harvested })),
    '쪽지 본 것': (()=>{ try { return JSON.parse(localStorage.getItem('byeot.coach')||'[]'); }
      catch(e){ return null; } })(),
    '기다리는 쪽지': (()=>{ try { return localStorage.getItem('byeot.coach.wait'); }
      catch(e){ return null; } })() }); })()`));
/* ★ 대사가 «언제 무엇을» 열었나 — 미룬 줄이 «잃어버려지지» 않았는지 본다(§dlgOpen 흩기) */
console.log('■ 대사를 연 차례 —', await page.eval(`JSON.stringify((window.__dlgLog||[])
  .map(r => r.id + '(b' + r.b + '·d' + r.day + ')'))`));
await page.shot('docs/handoff/img/walkstep.png').catch(() => {});
await page.close(); clearTimeout(wd);
