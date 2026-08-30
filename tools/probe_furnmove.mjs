/* tools/probe_furnmove.mjs — **방에 «선» 가구를 옮길 수 있나** (총괄 물음 2026-08-30)
   ------------------------------------------------------------------
   총괄: *"「되돌린다」가 둘이다 — ㉠ 가방으로 되돌린다 · ★㉡ 그 자리에서 «옮긴다».
   ㉡ 이 되면 ㉠ 이 급하지 않다. 사람은 「치우고 싶다」보다 「저기 말고 여기」가 훨씬 잦다."*
   재는 것: ① [옮기기] 가 «뜨나» ② 끌면 «움직이나» ③ [확정] 하면 «그 자리에 남나»
            ④ 자리(slot)도 «따라오나» ⑤ [취소] 하면 «되돌아오나»
   ⛔ 값은 안 바꾼다. 고치지도 않는다. */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8972';
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 300000);
wd.unref && wd.unref();
const page = await launch({ width: 390, height: 844, dpr: 1 });
try { await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 }); } catch {}
await page.goto(`${BASE}/game.html`);
await page.eval('localStorage.clear()', false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 150000, 300);
await sleep(4000);
const J = async (e, t = 60000) => JSON.parse(await page.eval(e, true, t));
for (let i = 0; i < 30; i++) {
  const b = await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');
    return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`);
  if (b !== 'true') break;
  await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s)s.click();
    const x=document.getElementById('dlgBox'); if(x)x.click();
    const g=document.getElementById('guideClose'); if(g)g.click();})()`, false);
  await sleep(200);
}
const UID = 'banjiha-nightstand';        /* 협탁 — 작고 자리를 하나 갖는다 */
const where = () => J(`(()=>{ const f=(window.__rv.furniture()||[]).find(x=>x.uid===${JSON.stringify(UID)});
  const s=(window.__io.light.room.slots||[]).find(x=>String(x.slotId).startsWith(${JSON.stringify(UID)}+':'));
  return JSON.stringify({ 가구: f? { x:Math.round(f.x*100)/100, z:Math.round(f.z*100)/100, rot:f.rot||0 } : null,
    자리: s? { slotId:s.slotId, x:Math.round(s.x*100)/100, z:Math.round(s.z*100)/100 } : null }); })()`);
const menu = () => J(`(()=>{ const g=(id)=>{ const el=document.getElementById(id);
    return !!(el && el.style.display !== 'none' && el.offsetParent !== null); };
  return JSON.stringify({ 옮기기:g('furnMove'), 돌리기:g('furnTurn'), 팔기:g('furnSell'),
    확정:g('furnOk'), 취소:g('furnUndo'), 이름:(document.getElementById('furnName')||{}).textContent||null }); })()`);

console.log('■ 처음 —', JSON.stringify(await where()));
console.log('');
console.log('=== ① 가구를 고르면 [옮기기] 가 뜨나 ===');
await page.eval(`(()=>{ const f=(window.__rv.furniture()||[]).find(x=>x.uid===${JSON.stringify(UID)});
  window.__furn.clear(); window.__furn.select({ ...f, name:'협탁' }, 195, 420); })()`, false);
await sleep(600);
console.log(' ', JSON.stringify(await menu()));
console.log('');
console.log('=== ②③ [옮기기] 를 누르고 끌어서 [확정] ===');
console.log(' ', JSON.stringify(await J(`(async()=>{ const out={};
  const b=document.getElementById('furnMove');
  b.dispatchEvent(new PointerEvent('pointerdown',{ bubbles:true, cancelable:true, pointerId:3, pointerType:'touch' }));
  await new Promise(r=>setTimeout(r,500));
  /* ⚠ 가구는 «furnmoving» 이다 — 화분·시루의 moving 과 «다른 이름»이다(furnPicked.beginMove).
     처음에 moving 을 보고 「격자가 안 떴다」로 읽을 뻔했다. 기능이 아니라 «자»가 틀린 것이었다. */
  out['격자 떴나'] = document.getElementById('stage').classList.contains('furnmoving');
  out['아래 글'] = ((document.getElementById('dropLabel')||{}).textContent||'').trim();
  /* 화면 한가운데를 잡고 오른쪽 아래로 끈다 — 상대 이동이라 물건을 정확히 짚을 필요가 없다 */
  const c=document.getElementById('roomCanvas').getBoundingClientRect();
  const x0=c.left+c.width*0.5, y0=c.top+c.height*0.55;
  /* ⚠ 끄는 손은 «잡이판»이 받는다 — #moveCatcher(inset:0 · touch-action:none)가
     furnmoving 동안 화면을 덮고 pointerdown/move/up 을 다 먹는다(game.html §moveCatcher).
     ⇒ 캔버스에 쏘면 아무 일도 안 난다. 그 판에 쏜다. */
  const cat=document.getElementById('moveCatcher');
  const at=(t,x,y)=>cat.dispatchEvent(new PointerEvent(t,{ bubbles:true, cancelable:true,
    pointerId:4, pointerType:'touch', clientX:x, clientY:y }));
  at('pointerdown', x0, y0);
  for(let i=1;i<=8;i++){ at('pointermove', x0+i*6, y0+i*4); await new Promise(r=>setTimeout(r,40)); }
  at('pointerup', x0+48, y0+32);
  await new Promise(r=>setTimeout(r,1800));
  out['끌던 중 상태'] = { mode: window.__furn.mode, undoFrom: !!window.__furn.undoFrom,
    ghost: !!window.__furn.ghost, furnmoving: document.getElementById('stage').classList.contains('furnmoving') };
  out['끌고 난 뒤 메뉴'] = (()=>{ const g=(id)=>{ const el=document.getElementById(id);
    return !!(el && el.style.display !== 'none' && el.offsetParent !== null); };
    return { 확정:g('furnOk'), 취소:g('furnUndo') }; })();
  return JSON.stringify(out); })()`, 120000)));
console.log('  · 끌고 난 뒤 자리 —', JSON.stringify(await where()));
/* ★ 손짓이 «내 자»로는 재현이 안 됐다(합성 포인터가 잡이판에서 풀린다). 그러면 «손»은 못 재도
   ⇒ ★★ 「방뷰가 가구를 옮길 수 있나」는 잴 수 있다 — 화면이 실제로 부르는 그 창구를 그대로 부른다.
   ⚠ 이건 「사람이 끌 수 있다」의 증거가 «아니다». 갈라서 적는다(㊸ 임자를 밝혀라). */
console.log('');
console.log('=== ②-b 창구로는 옮겨지나 (roomView.commitFurnitureAt) ===');
console.log(' ', JSON.stringify(await J(`(async()=>{ const out={};
  const f=(window.__rv.furniture()||[]).find(x=>x.uid===${JSON.stringify(UID)});
  /* 아무 데나 밀면 «겹친다» — 첫 판에서 「책상 와(과) 겹칩니다」로 옳게 막혔다.
     막히는 것도 답이지만 여기서 볼 것은 「옮겨지나」라, 빈 쪽을 차례로 시도한다. */
  let r = null; const tried = [];
  for (const d of [[-0.5,0],[0,0.5],[0,-0.5],[0.5,0],[-0.3,-0.3]]) {
    try {
      r = await window.__rv.commitFurnitureAt(${JSON.stringify(UID)},
        { x: (f.x||0) + d[0], z: (f.z||0) + d[1], rot: f.rot||0 });
      out['옮긴 쪽'] = d; break;
    } catch (e) { tried.push(d.join(',') + ' → ' + e.message); }
  }
  out['막힌 쪽'] = tried;
  if (r) out.돌려준것 = { from: r.from, to: r.to, riders: r.riders || [] };
  else out.탈 = '빈 쪽을 못 찾았다';
  const g=(window.__rv.furniture()||[]).find(x=>x.uid===${JSON.stringify(UID)});
  out['옮긴 뒤'] = g ? { x: Math.round(g.x*100)/100, z: Math.round(g.z*100)/100 } : null;
  return JSON.stringify(out); })()`, 120000)));
console.log('  · 자리도 따라왔나 —', JSON.stringify(await where()));
await page.eval(`(()=>{ const b=document.getElementById('furnOk');
  if(b) b.dispatchEvent(new PointerEvent('pointerdown',{ bubbles:true, cancelable:true, pointerId:5, pointerType:'touch' })); })()`, false);
await sleep(1200);
console.log('  · [확정] 뒤 —', JSON.stringify(await where()));
/* ★ 위 창구는 «3D 쪽»이다 — 상태에는 화면이 따로 적는다(game.html:13709 §setFurniturePlacement).
   ⇒ 그러니 「새로 켜도 남나」를 재려면 그 줄도 같이 지나가야 한다. 화면이 하는 그대로 부른다.
   ⚠ 처음엔 안 부르고 재서 「안 적힌다」로 읽을 뻔했다 — 자가 «반쪽 길»만 지나간 것이었다. */
console.log('  · 상태에도 적는다(화면이 하는 그 줄) —', JSON.stringify(await J(`(async()=>{
  const st=await import('/src/game/state.js'); const S=window.__S();
  const f=(window.__rv.furniture()||[]).find(x=>x.uid===${JSON.stringify(UID)});
  st.setFurniturePlacement(S, ${JSON.stringify(UID)}, { x:f.x, z:f.z, rot:f.rot||0 },
    { size: window.__io.light.room.size });
  return JSON.stringify({ 적은값: (S.home.furniture||{})[${JSON.stringify(UID)}] || null }); })()`)));
console.log('');
console.log('=== ④ 새로 켜도 그 자리인가 ===');
await page.eval(`(()=>{ try{ if(window.__save) window.__save(); }catch(e){} })()`, false);
await sleep(1500);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 180000, 500);
await sleep(4000);
console.log(' ', JSON.stringify(await where()));
console.log(' ', JSON.stringify(await J(`(()=>{ const S=window.__S();
  return JSON.stringify({ '자리표에 적혔나': !!(S.home.furniture||{})[${JSON.stringify(UID)}],
    적힌값: (S.home.furniture||{})[${JSON.stringify(UID)}] || null }); })()`)));
await page.shot('docs/handoff/img/furnmove.png').catch(() => {});
await page.close(); clearTimeout(wd);
