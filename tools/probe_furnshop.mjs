/* tools/probe_furnshop.mjs — **가구 사고팔기, 화면에서 «어디까지» 되나**
   ------------------------------------------------------------------
   총괄이 물은 다섯: ① 상점에 뜨나 ② 살 수 있나 ③ 팔 수 있나 ④ 팔면 그 위 화분은
   ⑤ 사고팔면 조도가 조용히 바뀌나.
   ⚠ 「읽은 것은 죽는다」 — 코드를 읽어 안 것은 여기서 «눌러서» 다시 본다.
   ⛔ 값은 안 바꾼다. 고치지도 않는다. 「되나 안 되나」만 본다. */
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
for (let i = 0; i < 40; i++) {
  const b = await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');
    return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`);
  if (b !== 'true') break;
  await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s)s.click();
    const x=document.getElementById('dlgBox'); if(x)x.click();
    const g=document.getElementById('guideClose'); if(g)g.click();})()`, false);
  await sleep(250);
}
const J = async (expr, t = 60000) => JSON.parse(await page.eval(expr, true, t));
console.log('■ 판 —', JSON.stringify(await J(`JSON.stringify((()=>{ const S=window.__S();
  return { 방:S.home.room, 날:S.day, 지갑:(S.tutorial&&S.tutorial.cashWon)||null,
    '등 열렸나': !!(S.tutorial&&S.tutorial.lamp&&S.tutorial.lamp.unlocked),
    방가구:(window.__io.light.room.def.furniture||[]).length }; })())`)));
console.log('');
console.log('=== ① 상점에 가구가 «뜨나» ===');
console.log('  · 화면(상점을 열고 «가구»라는 낱말이 있나) —', JSON.stringify(await J(`(async()=>{
  try{ window.__byeotSheet.open('shop'); }catch(e){}
  await new Promise(r=>setTimeout(r,1200));
  const box=document.getElementById('shopBox'), list=document.getElementById('shopList');
  const groups=[...document.querySelectorAll('#shopGroups [data-sg]')].map(b=>(b.textContent||'').trim());
  const txt=(list&&list.textContent)||'';
  return JSON.stringify({ '상점 칸 보이나': !!(box&&box.style.display!=='none'),
    '갈래 단추': groups,
    '줄 수': list? list.children.length : null,
    '가구 낱말': txt.indexOf('가구')>=0, '침대 낱말': txt.indexOf('침대')>=0,
    '닫힘 안내': (document.getElementById('shopClosed')||{}).textContent||null });
})()`)));
console.log('  · 코어(furnitureCatalogList) —', JSON.stringify(await J(`(async()=>{
  const shop=await import('/src/game/shop.js'); const S=window.__S();
  const now=shop.furnitureCatalogList(S);
  const gate=shop.furnitureShopOpen(S);
  const all=shop.furnitureAllList();
  const kinds={}; for(const r of all) kinds[r.shopKind]=(kinds[r.shopKind]||0)+1;
  return JSON.stringify({ 문: gate, '지금 낼 줄': now.length, '프리셋 전부': all.length, 갈래: kinds }); })()`)));
console.log('  · 문을 열면(등 해금 흉내) —', JSON.stringify(await J(`(async()=>{
  const shop=await import('/src/game/shop.js'); const S=window.__S();
  if(!S.tutorial.lamp) S.tutorial.lamp={};
  const had=!!S.tutorial.lamp.unlocked; S.tutorial.lamp.unlocked=true;
  const list=shop.furnitureCatalogList(S);
  const three=list.slice(0,3).map(r=>({ko:r.ko,사는값:r.buyWon,되사는값:r.resaleWon,배송:r.leadDays}));
  S.tutorial.lamp.unlocked=had;
  return JSON.stringify({ '열면 몇 줄': list.length, '싼 것 셋': three,
    '가장 비싼 것': list.length? { ko:list[list.length-1].ko, 사는값:list[list.length-1].buyWon }:null }); })()`)));
console.log('  · 문이 열린 채로 상점 화면을 다시 보면 —', JSON.stringify(await J(`(async()=>{
  const S=window.__S(); if(!S.tutorial.lamp) S.tutorial.lamp={};
  const had=!!S.tutorial.lamp.unlocked; S.tutorial.lamp.unlocked=true;
  try{ window.__redraw(); }catch(e){}
  await new Promise(r=>setTimeout(r,1000));
  const list=document.getElementById('shopList'); const txt=(list&&list.textContent)||'';
  const groups=[...document.querySelectorAll('#shopGroups [data-sg]')].map(b=>(b.textContent||'').trim());
  const out={ '갈래 단추': groups, '줄 수': list? list.children.length : null,
    '가구 낱말': txt.indexOf('가구')>=0, '침대 낱말': txt.indexOf('침대')>=0,
    '스툴 낱말': txt.indexOf('스툴')>=0 };
  S.tutorial.lamp.unlocked=had; try{ window.__redraw(); }catch(e){}
  return JSON.stringify(out); })()`)));
console.log('');
console.log('=== ②③④ 코어는 되나 — 눌러서 본다(화면 창구와 «따로») ===');
console.log('  · 사기(주문→도착→방에 놓기) —', JSON.stringify(await J(`(async()=>{
  const shop=await import('/src/game/shop.js'); const st=await import('/src/game/state.js');
  const S=window.__S(); if(!S.tutorial.lamp) S.tutorial.lamp={};
  const had=!!S.tutorial.lamp.unlocked; S.tutorial.lamp.unlocked=true;
  const out={};
  try{
    const list=shop.furnitureCatalogList(S); const one=list[0];
    out.산것=one.ko; out.값=one.buyWon;
    S.tutorial.cashWon=S.tutorial.cashWon+one.buyWon*2;
    const cash0=S.tutorial.cashWon;
    const ord=shop.orderItem(S, one.id, 1);
    out['돈 빠졌나']=cash0-S.tutorial.cashWon===one.buyWon;
    out['며칠 뒤']=ord.arrivesOnDay-S.day;
    S.day+=one.leadDays; const arr=shop.stepShop(S);
    out['도착 사건']=arr.arrived.length;
    out['재고']=(shop.stockOf(S, one.id)||0);
    S.day-=one.leadDays;
    const sz=window.__io.light.room.size;
    const row=st.placeBoughtFurniture(S, one.id, { x: sz.w/2, z: sz.d/2, rot: 0 }, { uid:'probe-buy' });
    out['방에 든 uid']=row.uid;
    window.__io.light.setFurnitureEdits(st.soldFurniture(S), st.addedFurniture(S));
    await window.__rv.refreshFurniture();
    out['방 가구']=window.__io.light.room.def.furniture.length;
    out['3D 에 섰나']=(window.__rv.furniture()||[]).some(f=>f.uid==='probe-buy');
  }catch(e){ out.탈=e.message; }
  S.tutorial.lamp.unlocked=had;
  return JSON.stringify(out); })()`, 200000)));
console.log('  · 팔기(방에 있던 것) —', JSON.stringify(await J(`(async()=>{
  const st=await import('/src/game/state.js'); const S=window.__S(); const out={};
  try{
    const f=(window.__rv.furniture()||[]).find(x=>x.uid==='probe-buy');
    if(!f){ out.탈='probe-buy 가 방에 없다'; return JSON.stringify(out); }
    const riders=window.__rv.ridersOf('probe-buy');
    const q=st.furnitureSellQuote(S,'probe-buy',{ preset:f.preset, riders });
    out.되사는값=q.won; out.살때=q.buyWon; out['될까']=q.ok; out.까닭=q.reason;
    const cash0=S.tutorial.cashWon;
    st.sellFurniture(S,'probe-buy',{ preset:f.preset, riders });
    out['돈 들어온 것']=S.tutorial.cashWon-cash0;
    window.__io.light.setFurnitureEdits(st.soldFurniture(S), st.addedFurniture(S));
    await window.__rv.refreshFurniture();
    out['방 가구']=window.__io.light.room.def.furniture.length;
    out['3D 에 남았나']=(window.__rv.furniture()||[]).some(x=>x.uid==='probe-buy');
  }catch(e){ out.탈=e.message; }
  return JSON.stringify(out); })()`, 200000)));
console.log('  · ④ «화분이 얹힌» 가구를 팔면 —', JSON.stringify(await J(`(async()=>{
  const st=await import('/src/game/state.js'); const S=window.__S(); const out={};
  try{
    const furn=window.__rv.furniture()||[];
    const cand=(window.__io.light.room.slots||[])
      .map(s=>({ slotId:s.slotId, uid:String(s.slotId).split(':')[0] }))
      .find(c=>furn.some(f=>f.uid===c.uid));
    if(!cand){ out.탈='가구 위 자리를 못 찾았다'; return JSON.stringify(out); }
    out['얹을 자리']=cand.slotId;
    /* 첫날에는 화분이 아직 없다 — 그러면 «빈 그릇»을 그 자리에 얹어 본다.
       itemsOnFurniture 는 화분·빈 그릇·삽수·작물 자리를 «다» 보므로 같은 자를 지난다.
       (여기 안에서는 역따옴표를 못 쓴다 — 바깥이 템플릿 문자열이다) */
    let pot=(S.pots||[])[0], keep=null, fake=false;
    if(pot){ keep={ slotId:pot.slotId, at:pot.at }; pot.slotId=cand.slotId; pot.at=null; }
    else { S.emptyPots=S.emptyPots||[]; S.emptyPots.push({ id:'probe-empty', slotId:cand.slotId, at:null }); fake=true; }
    out['얹은 것']= pot? '화분' : '빈 그릇';
    const f=furn.find(x=>x.uid===cand.uid);
    const riders=window.__rv.ridersOf(cand.uid);
    const q=st.furnitureSellQuote(S,cand.uid,{ preset:f.preset, riders });
    out['될까']=q.ok; out.까닭=q.reason; out['위에 있는 것']=q.on;
    let threw=null;
    try{ st.sellFurniture(S,cand.uid,{ preset:f.preset, riders }); }catch(e){ threw=e.message; }
    out['그래도 팔면']=threw||'★ 팔렸다 — 막는 것이 없다';
    if(pot&&keep){ pot.slotId=keep.slotId; pot.at=keep.at; }
    if(fake) S.emptyPots=S.emptyPots.filter(p=>p.id!=='probe-empty');
  }catch(e){ out.탈=e.message; }
  return JSON.stringify(out); })()`, 200000)));
console.log('');
console.log('=== ⑤ 사고팔면 조도가 «조용히» 바뀌나 — 팔 수 있는 것을 «하나씩» ===');
console.log(' ', JSON.stringify(await J(`(async()=>{
  const st=await import('/src/game/state.js'); const S=window.__S(); const out={ 줄:[] };
  const lux=()=>{ const r=window.__io.light.daily(S.day + 1, S).report; const m={};
    for(const s of (r.slots||[])) m[s.slotId]=Math.round(s.dli*100)/100; return m; };
  const feed=()=>window.__io.light.setFurnitureEdits(st.soldFurniture(S), st.addedFurniture(S));
  try{
    for(const f of (window.__rv.furniture()||[])){
      if(!f.uid || f.uid.indexOf('probe')===0) continue;
      let q=null; try{ q=st.furnitureSellQuote(S,f.uid,{ preset:f.preset, riders:window.__rv.ridersOf(f.uid) }); }catch(e){ continue; }
      if(!q.ok) { out.줄.push({ 것:q.ko, '못 판다':q.reason }); continue; }
      const before=lux(), bn=Object.keys(before).length;
      const bocc=(window.__io.light.room.built&&window.__io.light.room.built.occluders||[]).length;
      st.sellFurniture(S,f.uid,{ preset:f.preset, riders:window.__rv.ridersOf(f.uid) });
      const mid=lux();
      feed();
      const after=lux();
      const aocc=(window.__io.light.room.built&&window.__io.light.room.built.occluders||[]).length;
      const both=Object.keys(before).filter(k=>k in after);
      const moved=both.filter(k=>before[k]!==after[k]);
      out.줄.push({ 것:q.ko, 받은돈:q.won,
        '자리 수': bn+'→'+Object.keys(after).length,
        '가린 것 수': bocc+'→'+aocc,
        '먹이기 전 달라진 자리': both.filter(k=>before[k]!==mid[k]).length,
        '먹인 뒤 달라진 자리': moved.length,
        '가장 많이 바뀐 자리': moved.length? moved.map(k=>({k,d:Math.round((after[k]-before[k])*100)/100}))
          .sort((a,b)=>Math.abs(b.d)-Math.abs(a.d))[0] : null });
      /* 되돌린다 — 판 것 표에서 빼고 다시 먹인다 */
      const sold=st.soldFurniture(S); const ix=sold.indexOf(f.uid); if(ix>=0) sold.splice(ix,1);
      feed();
    }
  }catch(e){ out.탈=e.message; }
  return JSON.stringify(out); })()`, 200000)));
await page.close(); clearTimeout(wd);
