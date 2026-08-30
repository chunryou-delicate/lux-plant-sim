/* tools/probe_movein_guide.mjs — **이사하면 그루가 «가방»에 오고, 놓을 때 «손가락»이 뜨나**
   ------------------------------------------------------------------
   박사님 「응 그렇게 해」 — [Plan] (c) 「이사한 몬이는 가방에」 + (ㄱ) 「손가락을 한 번 더」.
   재는 것: ① 이사 뒤 그루가 «가방»에 있나(방에 안 서나) ② 가방 칸이 뜨나 · 손가락이 그 칸을 짚나
            ③ 눌러 놓고 [다시 옮기기] 를 하면 ⇒ 손가락이 «밝은 자리»를 짚나
            ④ 새로 켜도 그대로인가
   ⛔ 값은 안 바꾼다. */
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
const hint = () => J(`(()=>{ const h=document.getElementById('hint');
  const t=document.querySelector('.hintTarget');
  return JSON.stringify({ 떴나: !!(h && h.classList.contains('on')),
    말: h? ((h.querySelector('.say')||{}).textContent||'').trim() : null,
    짚는것: t? (t.id || t.dataset.potbag || t.className) : null }); })()`);
await skip();
/* 그루를 세우고 창턱에 놓는다(사람이 놓은 판) */
await page.eval(`(async()=>{ const st=await import('/src/game/state.js'); const S=window.__S();
  if(!(S.pots||[]).length) st.givePlant(S, window.__io);
  const p=(S.pots||[])[0];
  const slot=(window.__io.light.room.slots||[]).find(s=>String(s.slotId).startsWith('banjiha-sill:'));
  p.slotId=slot.slotId; p.at=null; p.placedOnce=true; window.__redraw(); })()`, true, 60000);
await sleep(800);
/* 이사 */
await page.eval(`(()=>{ const S=window.__S(); const ts=S.tutorial;
  ts.cashWon = ts.rules.moveOutCostWon + 100000;
  ts.varieLeaf = { ever:true, count:1, firstOnDay:S.day }; window.__redraw(); })()`, false);
await sleep(500);
await page.eval(`(()=>{ const b=document.getElementById('moveOut'); if(b){ b.disabled=false; b.click(); } })()`, false);
await sleep(6000);
await skip(20);
console.log('=== ① 이사 뒤 그루가 어디에 있나 ===');
console.log(' ', JSON.stringify(await J(`(()=>{ const S=window.__S(); const p=(S.pots||[])[0];
  return JSON.stringify({ 방:S.home.room, slotId:p&&p.slotId, at:!!(p&&p.at),
    placedOnce:p&&p.placedOnce,
    판정: (p && !p.slotId && !p.at && p.placedOnce===false) ? '✔ 가방에 있다' : '★ 방에 섰다' }); })()`)));
/* 새로 켠다 — 원룸 3D 는 새 판에서만 선다 */
await page.eval(`(()=>{ try{ if(window.__save) window.__save(); }catch(e){} })()`, false);
await sleep(1500);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 180000, 500);
await sleep(4000);
await skip(20);
console.log('');
console.log('=== ④ 새로 켠 뒤에도 가방인가 ===');
console.log(' ', JSON.stringify(await J(`(()=>{ const S=window.__S(); const p=(S.pots||[])[0];
  return JSON.stringify({ 방:S.home.room, slotId:p&&p.slotId, at:!!(p&&p.at), placedOnce:p&&p.placedOnce,
    '방에 선 그루': (()=>{ try{ return window.__rv.plants? window.__rv.plants().length : 'n/a'; }catch(e){ return 'n/a'; } })() }); })()`)));
console.log('');
console.log('=== ② 가방 칸과 손가락 ===');
console.log('  · 가방 닫힌 채 —', JSON.stringify(await hint()));
await page.eval(`try{ window.__byeotSheet.open('bag') }catch(e){}`, false);
await sleep(1600);
await page.eval(`window.__redraw()`, false);
await sleep(600);
console.log('  · 가방 연 뒤 —', JSON.stringify(await hint()));
console.log('  · 가방 칸 —', JSON.stringify(await J(`(()=>{ const cs=[...document.querySelectorAll('[data-potbag]')];
  return JSON.stringify({ 칸수:cs.length, 첫칸:cs[0]? (cs[0].textContent||'').replace(/\\s+/g,' ').trim().slice(0,40):null }); })()`)));
console.log('');
console.log('=== ③ 놓고 [다시 옮기기] — 손가락이 밝은 자리를 짚나 ===');
console.log(' ', JSON.stringify(await J(`(async()=>{ const c=document.querySelector('[data-potbag]');
  if(!c) return JSON.stringify({ 탈:'가방 칸이 없다' });
  const r=c.getBoundingClientRect(), x=r.left+r.width/2, y=r.top+r.height/2;
  c.dispatchEvent(new PointerEvent('pointerdown',{ bubbles:true, cancelable:true, pointerId:7, pointerType:'touch', clientX:x, clientY:y }));
  window.dispatchEvent(new PointerEvent('pointerup',{ bubbles:true, pointerId:7, pointerType:'touch', clientX:x, clientY:y }));
  for(let i=0;i<60;i++){ await new Promise(r2=>setTimeout(r2,100));
    const p=(window.__S().pots||[])[0]; if(p && (p.slotId||p.at)) break; }
  await new Promise(r2=>setTimeout(r2,600));
  const again=document.getElementById('placeAgain');
  const out={ 놓인뒤:(()=>{ const p=(window.__S().pots||[])[0];
    return { slotId:p&&p.slotId, at:!!(p&&p.at) }; })(),
    '다시 옮기기 있나': !!(again && again.offsetParent !== null) };
  if(again) again.dispatchEvent(new PointerEvent('pointerdown',{ bubbles:true, cancelable:true, pointerId:8, pointerType:'touch' }));
  await new Promise(r2=>setTimeout(r2,900));
  out.격자 = document.getElementById('stage').classList.contains('moving');
  return JSON.stringify(out); })()`, 200000)));
await sleep(600);
console.log('  · 그때 손가락 —', JSON.stringify(await hint()));
/* ★ 「안 뜬 것」인지 「아직 안 그린 것」인지 가른다 — 한 번 더 그려 보고 다시 본다 */
await page.eval(`window.__redraw()`, false);
await sleep(700);
console.log('  · 다시 그린 뒤 손가락 —', JSON.stringify(await hint()));
console.log('  · 아래 글 —', await page.eval(`((document.getElementById('dropLabel')||{}).textContent||'').trim()`));
console.log('  · 제일 밝은 자리 —', await page.eval(`(()=>{ const S=window.__S();
  const rows=[...(window.__io.light.daily(S.day+1,S).report.slots||[])].sort((a,b)=>b.dli-a.dli);
  return rows[0].slotId + ' ' + Math.round(rows[0].dli*100)/100; })()`));
await page.shot('docs/handoff/img/movein_guide.png').catch(() => {});
await page.close(); clearTimeout(wd);
