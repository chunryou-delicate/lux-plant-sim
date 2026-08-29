/* tools/probe_bagpot_move.mjs — **이사한 원룸에서 «가방에 든 몬이»를 놓을 수 있나**
   ------------------------------------------------------------------
   [Plan] 이 (c) 를 골랐다 — 「이사하면 화분도 가방에 둔다. 사람이 놓는다」.
   ⚠ 아직 «안 붙였다»(등이 따라오는 규칙과 한 묶음이라 그것이 서야 한다).
   ⇒ 그 전에 **놓을 수 있는지부터** 잰다 — 못 놓으면 (c) 는 「그루를 잃는 길」이 된다.
   재는 것: ① 이사 뒤 화분을 가방에 두면 «칸이 뜨나» ② 눌러서 «놓아지나»
            ③ 어디에 서나 · 그 자리가 «밝은가» ④ 안내 손가락이 «무엇을» 가리키나
   ⛔ 값은 안 바꾼다. 코드도 안 고친다 — 「되나」만 본다. */
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
await sleep(4000);
const J = async (e, t = 60000) => JSON.parse(await page.eval(e, true, t));
const skip = async (n = 40) => {
  for (let i = 0; i < n; i++) {
    const b = await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');
      return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`);
    if (b !== 'true') break;
    await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s)s.click();
      const x=document.getElementById('dlgBox'); if(x)x.click();
      const g=document.getElementById('guideClose'); if(g)g.click();})()`, false);
    await sleep(250);
  }
};
await skip();
console.log('■ 그루를 세운다 —', JSON.stringify(await J(`(async()=>{
  const st=await import('/src/game/state.js'); const S=window.__S(); const out={};
  try{ if(!(S.pots||[]).length) st.givePlant(S, window.__io);
    const p=(S.pots||[])[0]; const slot=(window.__io.light.room.slots||[])
      .find(s=>String(s.slotId).startsWith('banjiha-sill:'));
    p.slotId=slot.slotId; p.at=null; p.placedOnce=true;
    out.화분=p.id; out['놓은 곳']=p.slotId;
  }catch(e){ out.탈=e.message; }
  return JSON.stringify(out); })()`)));
await page.eval(`window.__redraw()`, false);
await sleep(600);
/* 이사 */
await page.eval(`(()=>{ const S=window.__S(); const ts=S.tutorial;
  ts.cashWon = ts.rules.moveOutCostWon + 100000;
  ts.varieLeaf = { ever:true, count:1, firstOnDay:S.day }; window.__redraw(); })()`, false);
await sleep(500);
await page.eval(`(()=>{ const b=document.getElementById('moveOut'); if(b){ b.disabled=false; b.click(); } })()`, false);
await sleep(6000);
await skip(20);
/* ★ (c) 를 «손으로» 흉내 낸다 — 아직 안 붙였으므로 여기서 자리를 뗀다.
   ⚠ 이것은 「고친 것」이 아니다. 붙였을 때 무엇이 되는지 미리 보는 판이다. */
console.log('■ (c) 흉내 — 화분을 가방으로 —', JSON.stringify(await J(`(()=>{ const S=window.__S();
  const p=(S.pots||[])[0]; if(!p) return JSON.stringify({ 탈:'화분이 없다' });
  /* ★★ 자리만 떼면 안 된다 — save.js §reseat 이 새로 켤 때 rehomePot 을 부르고,
     그 함수는 placedOnce 가 false 가 «아니면» 「자리를 잃은 화분」으로 보고 첫 자리에 앉힌다.
     ⇒ 「가방에 있다」는 이미 있는 상태다(state §rehomePot): 자리·좌표가 없고 placedOnce === false.
     ⇒ ⇒ 그러니 (c) 를 붙인다는 것은 이사 때 그 «셋»을 같이 세우는 일이다. 여기서 그대로 흉내 낸다. */
  p.slotId=null; p.at=null; p.placedOnce=false;
  window.__redraw();
  return JSON.stringify({ 화분:p.id, slotId:p.slotId, placedOnce:p.placedOnce }); })()`)));
/* ★ 저장 «전»에 한 번 더 본다 — 「새로 켜서 앉은 것」인지 「끄기도 전에 앉은 것」인지 갈린다 */
await sleep(1500);
console.log('■ 흉내 낸 뒤 1.5초 —', await page.eval(`(()=>{ const p=(window.__S().pots||[])[0];
  return JSON.stringify({ slotId:p&&p.slotId, at:!!(p&&p.at), placedOnce:p&&p.placedOnce }); })()`));
/* 새로 켠다 — 원룸 3D 는 새 판에서만 선다(헤드리스 벽 · headless-wall-to-plan.md) */
await page.eval(`(()=>{ try{ if(window.__save) window.__save(); }catch(e){} })()`, false);
await sleep(1500);
await page.goto(`${BASE}/game.html`);
/* ★★ 누가 자리를 도로 앉히나 — **덫을 놓는다.** 화분이 생기자마자 slotId 에 setter 를 걸고
   바뀌는 순간의 «부른 자리»를 적는다. ⚠ 이건 자에만 있는 덫이다(게임은 안 건드린다). */
await page.waitFor('!!window.__S && (window.__S().pots||[]).length > 0', 180000, 100);
await page.eval(`(()=>{ window.__watch=[]; const t0=performance.now();
  const iv=setInterval(()=>{ try{ const p=(window.__S().pots||[])[0];
    const last=window.__watch[window.__watch.length-1];
    const now={ ms:Math.round(performance.now()-t0), slotId:p&&p.slotId, rv:!!window.__rv, roomOk:document.getElementById('stage').classList.contains('room-ok') };
    if(!last || last.slotId!==now.slotId) window.__watch.push(now);
    if(window.__watch.length>12) clearInterval(iv);
  }catch(e){} }, 50); })()`, false);
await page.eval(`(()=>{ const p=(window.__S().pots||[])[0]; let v=p.slotId; window.__trace=[];
  Object.defineProperty(p, 'slotId', { configurable:true,
    get(){ return v; },
    set(x){ if (x !== v) window.__trace.push({ 에서:v, 로:x, 자리:(new Error()).stack.split(String.fromCharCode(10)).slice(1,6).join(' | ') }); v = x; } });
})()`, false);
await page.waitFor('!!window.__rv', 180000, 500);
await sleep(4000);
await skip(20);
console.log('■ 누가 앉혔나 —', await page.eval(`JSON.stringify((window.__trace||[]).slice(0,3))`));
console.log('■ 언제 앉았나 —', await page.eval(`JSON.stringify((window.__watch||[]).slice(0,8))`));
console.log('■ 새로 켠 뒤 적힌 말 —', await page.eval(`(()=>{ const S=window.__S();
  const rows=(S.log||[]).slice(-8).map(r=> typeof r==='string'? r : (r.ko||r.text||JSON.stringify(r)));
  return JSON.stringify(rows); })()`));
console.log('');
console.log('=== ① 가방에 몬이 칸이 뜨나 ===');
await page.eval(`try{ window.__byeotSheet.open('bag') }catch(e){}`, false);
await sleep(1600);
console.log(' ', JSON.stringify(await J(`(()=>{ const S=window.__S();
  const pots=[...document.querySelectorAll('[data-potbag]')].map(e=>({ id:e.dataset.potbag,
    글:(e.textContent||'').replace(/\\s+/g,' ').trim().slice(0,40) }));
  return JSON.stringify({ 방:S.home.room,
    '화분 상태':(S.pots||[]).map(p=>({ id:p.id, slotId:p.slotId, at:!!p.at })),
    '가방 화분 칸': pots, '가방 가구 칸': document.querySelectorAll('[data-furnbag]').length }); })()`)));
console.log('');
console.log('=== ② 눌러서 놓아지나 ===');
console.log(' ', JSON.stringify(await J(`(async()=>{ const c=document.querySelector('[data-potbag]');
  if(!c) return JSON.stringify({ 탈:'몬이 칸이 없다' });
  /* ⚠ 화분 칸은 «끌기»로 걸려 있다(bindDrag) — click() 은 안 먹는다. 손가락처럼 누른다:
     같은 자리에서 pointerdown → pointerup 이면 「탭」이다(§bindDrag onTap). */
  const r=c.getBoundingClientRect(); const x=r.left+r.width/2, y=r.top+r.height/2;
  const ev=(type)=>c.dispatchEvent(new PointerEvent(type,{ bubbles:true, cancelable:true,
    pointerId:7, pointerType:'touch', clientX:x, clientY:y }));
  const t=performance.now(); ev('pointerdown');
  window.dispatchEvent(new PointerEvent('pointerup',{ bubbles:true, pointerId:7, pointerType:'touch', clientX:x, clientY:y }));
  let done=null;
  for(let i=0;i<80;i++){ await new Promise(r=>setTimeout(r,100));
    const p=(window.__S().pots||[])[0];
    if(p && (p.slotId || p.at)) { done=performance.now()-t; break; } }
  const p=(window.__S().pots||[])[0];
  return JSON.stringify({ ms: done==null? null : Math.round(done),
    slotId: p&&p.slotId, at: p&&p.at? [p.at.x,p.at.y,p.at.z].map(v=>Math.round(v*100)/100):null,
    '되묻기 떴나': !!(document.getElementById('placeConfirm')||{}).classList &&
      document.getElementById('placeConfirm').classList.contains('on') }); })()`, 200000)));
await sleep(1500);
console.log('');
console.log('=== ③ 어디에 섰나 · 그 자리는 밝은가 ===');
console.log(' ', JSON.stringify(await J(`(()=>{ const S=window.__S(); const p=(S.pots||[])[0];
  const rep=window.__io.light.daily(S.day+1, S).report;
  const rows=[...(rep.slots||[])].sort((a,b)=>b.dli-a.dli);
  const i=rows.findIndex(r=>r.slotId===(p&&p.slotId));
  return JSON.stringify({ slotId:p&&p.slotId, at:!!(p&&p.at),
    등수: i<0? null : (i+1)+'/'+rows.length,
    dli: i<0? null : Math.round(rows[i].dli*100)/100,
    '제일 밝은 곳': rows[0] && (rows[0].slotId+' '+Math.round(rows[0].dli*100)/100) }); })()`)));
console.log('');
console.log('=== ④ 안내 손가락이 무엇을 가리키나 ===');
console.log(' ', JSON.stringify(await J(`(()=>{
  const h=document.getElementById('hint'); const t=document.querySelector('.hintTarget');
  return JSON.stringify({ '손가락 떴나': !!(h && h.classList.contains('on')),
    '가리키는 것': t? (t.id || t.dataset.key || t.className) : null,
    '아래 글': (document.getElementById('hintNote')||document.getElementById('dropLabel')||{}).textContent || null }); })()`)));
await page.shot('docs/handoff/img/bagpot_move.png').catch(() => {});
await page.close(); clearTimeout(wd);
