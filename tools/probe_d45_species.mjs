/* tools/probe_d45_species.mjs — **새 두 종(핑크프린세스 · 알로카시아)이 게임에서 서나** (2026-10-09 · core · 총괄 D45)
   ------------------------------------------------------------
   판 세우기(값 0 · 세운 판): 새 판 → 몬스테라 · 이사(화면 단추) · 저장 → 새로 켬(원룸)
   잰다(화면 손 + 코어 runDays):
     ① PP 교환 — 원룸 30일 + ③ 끝 + 뿌리낸 무늬 삽수 → 하루 넘기면 물음 카드가 뜬다 · [바꾼다] → 삽수 하나가 가고 PP 가 가방에
     ② 가방 «새 식물» 칸을 누르면 방에 놓이고 방이 PP 를 그린다(young.drawn · 잎 수 = 그루 상태) · 찍음
     ③ 상점 — 원룸 60일 뒤 «알로카시아 구근» 줄이 선다 · [주문] → 도착 → 가방 칸 → 심어서 놓음(구근 = 화분만) → 날을 보내면 싹(잎이 그려짐) · 찍음
     ④ 방에서 PP 를 누르면(picked) 그 그루 카드 · [자르기] → 마디 단추 → 윗부분이 가방에
     ⑤ 세이브 → 새로 켬 — 두 종이 같은 잎 수로 다시 선다
     ⑥ PP 를 판다 — 지갑이 그 값만큼 는다
   OUTDIR= (필수 · 비어 있어야) · BYEOT_URL=(기본 127.0.0.1:9300) */
import fs from 'node:fs';
import { launch, sleep } from './test_cdp.mjs';
const OUTDIR = process.env.OUTDIR;
if (!OUTDIR) { console.error('⛔ OUTDIR='); process.exit(2); }
fs.mkdirSync(OUTDIR, { recursive: true }); if (fs.readdirSync(OUTDIR).length) { console.error('⛔ OUTDIR 가 비어 있지 않다'); process.exit(2); }
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9300';
const page = await launch({ width: 390, height: 844, dpr: 1 });
let bad = 0; const ok = (c, m) => { console.log(`  ${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) bad++; };
const J = async (js, ms = 300000) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message, st:(e.stack||'').slice(0,300)}); } })()`, true, ms));
const skip = async () => { for (let k = 0; k < 4; k++) { for (let i = 0; i < 40; i++) {
  if (await page.eval(`String(document.getElementById('stage').classList.contains('talking'))`) !== 'true') break;
  await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s && s.offsetParent) s.click(); else { const x=document.getElementById('dlgBox'); if(x)x.click(); }})()`, false); await sleep(150); } await sleep(300); } };
const reload = async () => {
  await page.eval(`(()=>{ try{ if(window.__save) window.__save(); }catch(e){} })()`, false); await sleep(1500);
  await page.goto(`${BASE}/game.html`); await page.waitFor('!!window.__rv', 600000, 500); await sleep(4500); await skip(); };
const days = (n) => J(`(async()=>{ const loop=await import('/src/game/loop.js'); const S=window.__S();
  const evs=[]; for (let i=0;i<${n};i++){ const r=loop.runDays(S, window.__io, 1); const t=(r&&r.turns&&r.turns[r.turns.length-1])||(r&&r.turn)||null; if (t&&t.events) evs.push(...t.events.map(e=>e.id)); }
  try{ window.__redraw(); }catch(e){} return { day:S.day, evs: evs.filter(id=>/^(pp_|al_)/.test(id)) }; })()`);
const spView = (id) => J(`(()=>{ const p=(window.__rv.plants()||[]).find(x=>x.potId===${JSON.stringify(id)}); return p ? { kind:p.kind, young:p.young||null } : null; })()`);
try {
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true; try{ if(!sessionStorage.__sp){ localStorage.clear(); sessionStorage.__sp='1'; } }catch(e){}` });
  await page.goto(`${BASE}/game.html`); await page.waitFor('!!window.__rv', 600000, 500); await sleep(4500); await skip();
  /* 판: 몬스테라 · 이사 */
  await J(`(async()=>{ const st=await import('/src/game/state.js'); const fp=await import('/src/game/first_play.js');
    const S=window.__S(); S.firstPlay.beansprout.harvestCount = fp.MONSTERA_ARRIVAL_RULE.harvestCount; S.firstPlay.beansprout.harvested = true;
    const a = st.givePlant(S, window.__io, { slotId:null }); fp.markMonsteraArrived(S.firstPlay, a); return 1; })()`);
  await skip();
  await page.eval(`(()=>{ const S=window.__S(); const ts=S.tutorial; ts.cashWon = ts.rules.moveOutCostWon + 3000000; ts.lamp.unlocked = true;
    ts.varieLeaf = { ever:true, count:1, firstOnDay:S.day }; window.__redraw(); })()`, false); await sleep(600);
  await page.eval(`(()=>{ const b=document.getElementById('moveOut'); if(b){ b.disabled=false; b.click(); } })()`, false); await sleep(1500); await skip();
  await page.eval(`(()=>{ if (window.__S().tutorial.movedOut) return; const p=document.getElementById('movePanel');
    if (p && p.classList.contains('on')) document.getElementById('moveGo').click(); else document.getElementById('moveOut').click(); })()`, false);
  await sleep(6000); await skip(); await reload();
  const room = await J(`(()=>{ const S=window.__S(); return { 방:S.home.room, 날:S.day, 이사날:S.story && S.story.movedInOnDay, 화분:(S.pots||[]).length }; })()`);
  console.log('원룸 —', JSON.stringify(room));
  ok(room.방 === 'oneroom', '원룸으로 이사했다');

  /* ① PP 교환 — 뿌리낸 무늬 삽수 하나를 세운다(모주에서 자른 것 · 상태만 rooted 로) */
  const set = await J(`(async()=>{ const pr=await import('/src/game/propagation.js'); const st=await import('/src/game/state.js'); const loop=await import('/src/game/loop.js');
    const S=window.__S(), io=window.__io; let p=(S.pots||[])[0];
    if (p && !p.slotId && !p.at) { const sill=(io.light.room.slots||[]).find(s=>/sill/.test(s.slotId)); st.setPotAt(S, p.id, { x:sill.x, y:sill.y, z:sill.z, slotId:sill.slotId }, { slots: io.light.room.slots, size: io.light.room.size }); }
    let n=null, nodes=[];
    for (let d=0; d<200 && !n; d++) { try { st.waterPot(S); } catch(e) {} loop.runDays(S, io, 1);
      nodes=io.growth.cuttableNodes()||[]; n=pr.cuttableNow(S,nodes,{potId:p.id}).find(x=>x.stem!=='petiole' && !pr.cutBlockedReason(S,nodes,x.nodeId,{potId:p.id})) || null; }
    if (!n) return { 탈:'자를 마디가 안 열림' };
    const it=pr.containerItemOf('jar'); S.shop.stock[it]=(S.shop.stock[it]||0)+1;
    const c=pr.takeCutting(S,{potId:p.id,nodes,nodeId:n.nodeId,container:'jar'});
    c.status='rooted'; c.varieFromCut=true; c.rootedOnDay=S.day;
    S.stamina.questsTaken = [...new Set([...(S.stamina.questsTaken||[]), 'oneroom_settle_cutting'])];
    window.__redraw(); return { cut:c.id, day:S.day, movedIn:S.story.movedInOnDay }; })()`);
  console.log('세움 —', JSON.stringify(set));
  if (set.탈) { ok(false, set.탈); throw new Error('setup'); }
  /* 원룸 30일이 찰 때까지 하루씩(세운 판이 날짜를 되감지 않는다 — 세이브 검사가 막는다) */
  let d1 = { evs: [] };
  for (let i = 0; i < 40 && !d1.evs.includes('pp_trade_offer'); i++) d1 = await days(1);
  await sleep(1500); await skip(); await sleep(800);
  const card = await J(`(()=>{ const d=document.getElementById('detail'); return { on: d.classList.contains('on'), title: document.getElementById('dTitle').textContent,
    btns:[...document.querySelectorAll('#dBtns button')].map(b=>b.textContent) }; })()`);
  console.log('① 물음 —', JSON.stringify({ d1, card }));
  await page.shot(`${OUTDIR}/1_trade_card.png`);
  ok(d1.evs.includes('pp_trade_offer'), '하루 넘기자 교환 물음 사건(pp_trade_offer)');
  ok(card.on && /나눔/.test(card.title), `교환 카드가 떴다(${card.title})`);
  await page.eval(`(()=>{ const b=[...document.querySelectorAll('#dBtns button')].find(x=>/바꾼다/.test(x.textContent) && !/안/.test(x.textContent)); if(b) b.click(); })()`, false);
  await sleep(1200); await skip();
  const traded = await J(`(()=>{ const S=window.__S(); return { pp:(S.species&&S.species.pots||[]).map(q=>({id:q.id,sp:q.species,placed:!!(q.slotId||q.at),leaves:q.plant.leaves.length})),
    cutGone: !(S.cuttings||[]).some(c=>c.id===${JSON.stringify(set.cut)}), done: S.species && S.species.trade.done }; })()`);
  console.log('① 받음 —', JSON.stringify(traded));
  ok(traded.done && traded.cutGone && traded.pp.length === 1 && traded.pp[0].sp === 'pink_princess' && !traded.pp[0].placed, 'PP 를 받았다(가방) · 삽수 하나가 갔다');

  /* ② 가방 칸 → 놓기 → 그림 */
  await page.eval(`(()=>{ window.__byeotSheet.open('bag'); })()`, false); await sleep(1000);
  const ppId = traded.pp[0] && traded.pp[0].id;
  const cell = await J(`(()=>{ const c=document.querySelector('#bagGrid [data-place="species:${ppId}"]'); if(!c) return null; c.scrollIntoView({block:'center'}); return (c.textContent||'').trim().slice(0,40); })()`);
  await page.shot(`${OUTDIR}/2_bag.png`);
  ok(!!cell, `가방 «새 식물» 칸(${cell})`);
  await page.eval(`(()=>{ const c=document.querySelector('#bagGrid [data-place="species:${ppId}"]'); if(c) c.click(); })()`, false);
  await sleep(4000); await skip();
  const v2 = await spView(ppId);
  console.log('② 방 —', JSON.stringify(v2));
  await page.shot(`${OUTDIR}/3_pp_placed.png`);
  ok(v2 && v2.young && v2.young.species === 'pink_princess' && v2.young.drawn && v2.young.leafCount === traded.pp[0].leaves, `방이 PP 를 그린다(잎 ${v2 && v2.young && v2.young.leafCount})`);

  /* ③ 상점 AL 구근 */
  { const g = await J(`(()=>{ const S=window.__S(); S.tutorial.cashWon = Math.max(S.tutorial.cashWon, 3000000); return Math.max(0, 61 - (S.day - S.story.movedInOnDay)); })()`);
    if (g > 0) await days(g); await skip(); }
  await page.eval(`(()=>{ window.__byeotSheet.open('shop'); })()`, false); await sleep(800);
  await page.eval(`(()=>{ const b=[...document.querySelectorAll('#shopGroups [data-sg]')].find(x=>x.dataset.sg==='all'); if(b) b.click(); })()`, false); await sleep(800);
  const row = await J(`(()=>{ const b=document.querySelector('#shopList [data-buy="al_corm"]'); if(!b) return null; b.scrollIntoView({block:'center'}); const r=b.closest('.shopRow'); return r ? r.innerText.replace(/\\s+/g,' ').slice(0,80) : 'btn'; })()`);
  await page.shot(`${OUTDIR}/4_shop_corm.png`);
  ok(!!row, `상점에 알로카시아 구근 줄(${row})`);
  await page.eval(`(()=>{ const b=document.querySelector('#shopList [data-buy="al_corm"]'); if(b) b.click(); })()`, false); await sleep(900);
  await page.eval(`(()=>{ const g=document.getElementById('buyGo'); if(g && g.offsetParent) g.click(); })()`, false); await sleep(900); await skip();
  for (let i = 0; i < 4; i++) { const st = await J(`(async()=>{ const sh=await import('/src/game/shop.js'); return sh.stockOf(window.__S(),'al_corm'); })()`); if (st > 0) break; await days(1); await skip(); }
  await page.eval(`(()=>{ window.__byeotSheet.open('bag'); })()`, false); await sleep(1000);
  const hasStock = await page.eval(`String(!!document.querySelector('#bagGrid [data-place="spstock:al_corm"]'))`);
  ok(hasStock === 'true', '구근이 와서 가방 칸에 섰다');
  await page.eval(`(()=>{ const c=document.querySelector('#bagGrid [data-place="spstock:al_corm"]'); if(c) c.click(); })()`, false);
  await sleep(3500); await skip();
  const al = await J(`(()=>{ const S=window.__S(); const q=(S.species.pots||[]).find(q=>q.species==='alocasia_frydek'); return q ? { id:q.id, phase:q.plant.phase, placed:!!(q.slotId||q.at), origin:q.origin } : null; })()`);
  const v3 = al ? await spView(al.id) : null;
  console.log('③ 구근 —', JSON.stringify({ al, v3 }));
  ok(al && al.placed && al.phase === 'corm' && al.origin === 'shop', '산 구근을 심어 놓았다(구근)');
  ok(v3 && v3.young && v3.young.drawn === false, '구근은 화분만 그린다');
  const d3 = await days(20); await sleep(3000);
  const v4 = await spView(al.id);
  console.log('③ 싹 —', JSON.stringify({ d3, v4 }));
  await page.shot(`${OUTDIR}/5_al_sprout.png`);
  ok(d3.evs.includes('al_sprout'), '날을 보내자 싹(al_sprout)');
  ok(v4 && v4.young && v4.young.drawn && v4.young.leafCount >= 1, `싹 난 AL 을 그린다(잎 ${v4 && v4.young && v4.young.leafCount})`);

  /* ④ 방에서 PP 누르기 → 카드 → 자르기 */
  const sel = await J(`(()=>{ const S=window.__S(); const q=S.species.pots.find(x=>x.id===${JSON.stringify(ppId)}); const key=q.slotId||('free:'+q.id);
    window.__picked && window.__picked.select ? window.__picked.select(key) : null; return { key, kind: window.__picked ? window.__picked.kindAt(key) : null }; })()`);
  console.log('④ 고름 —', JSON.stringify(sel));
  const ppLeaves = await J(`(()=>{ const q=window.__S().species.pots.find(x=>x.id===${JSON.stringify(ppId)}); return q.plant.leaves.length; })()`);
  const pk = await J(`(()=>({ slot: window.__picked.slotId, sp: window.__picked.speciesInRoom ? window.__picked.speciesInRoom.id : null, det: document.getElementById('detail').classList.contains('on') }))()`);
  console.log('④ 고른 뒤 —', JSON.stringify(pk));
  await sleep(700);   /* 막 뜬 메뉴는 그 손짓을 안 먹는다(MENU_DEAF_MS 250) */
  await J(`(()=>{ const z=document.getElementById('pickZoom'); if (z) z.click(); return 1; })()`); await sleep(800);
  const c4 = await J(`(()=>{ return { on: document.getElementById('detail').classList.contains('on'), title: document.getElementById('dTitle').textContent, btns:[...document.querySelectorAll('#dBtns button')].map(b=>b.textContent) }; })()`);
  await page.shot(`${OUTDIR}/6_pp_card.png`);
  console.log('④ 카드 —', JSON.stringify(c4));
  ok(sel.kind === 'species:' + ppId, '고른 열쇠가 새 식물로 읽힌다(몬스테라로 안 떨어진다)');
  ok(c4.on && /핑크프린세스/.test(c4.title), 'PP 카드가 뜬다');
  if (ppLeaves >= 2 && c4.btns.some(b => /자르기/.test(b))) {
    await page.eval(`(()=>{ const b=[...document.querySelectorAll('#dBtns button')].find(x=>/자르기/.test(x.textContent)); if(b) b.click(); })()`, false); await sleep(800);
    await page.eval(`(()=>{ const b=[...document.querySelectorAll('#dBtns button')].find(x=>/마디/.test(x.textContent)); if(b) b.click(); })()`, false); await sleep(1500);
    const cut = await J(`(()=>{ const S=window.__S(); return S.species.pots.map(q=>({id:q.id,sp:q.species,origin:q.origin,leaves:q.plant.leaves.length,placed:!!(q.slotId||q.at)})); })()`);
    console.log('④ 자름 —', JSON.stringify(cut));
    ok(cut.some(q => q.origin === 'cut' && !q.placed), 'PP 를 잘라 윗부분이 가방에 들었다');
  } else console.log('  (자를 마디가 아직 없음 — 잎', ppLeaves, '· 건너뜀)');

  /* ⑤ 세이브 → 새로 켬 */
  const before = await J(`(()=>window.__S().species.pots.map(q=>({id:q.id,leaves:q.plant.leaves.length,placed:!!(q.slotId||q.at)})))()`);
  const ser = await J(`(async()=>{ const sv=await import('/src/game/save.js'); try { const o=sv.serialize(window.__S()); return { ok:true, sp: !!(o.state && o.state.species) }; } catch(e) { return { ok:false, why:e.message }; } })()`);
  console.log('⑤ 저장 —', JSON.stringify(ser));
  ok(ser.ok && ser.sp, '저장이 된다(새 두 종 칸 포함)');
  await reload();
  const after = await J(`(()=>(window.__S().species ? window.__S().species.pots : []).map(q=>({id:q.id,leaves:q.plant.leaves.length,placed:!!(q.slotId||q.at)})))()`);
  const v5 = await spView(ppId);
  console.log('⑤ 다시 켬 —', JSON.stringify({ before, after, v5 }));
  ok(JSON.stringify(before) === JSON.stringify(after), '세이브 왕복 — 두 종이 같은 잎 수 · 같은 자리 여부');
  ok(v5 && v5.young && v5.young.drawn, '다시 켜도 PP 를 그린다');
  await page.shot(`${OUTDIR}/7_reload.png`);

  /* ⑥ 판다 */
  const sold = await J(`(async()=>{ const SPC=await import('/src/game/species.js'); const S=window.__S(); const q=S.species.pots.find(x=>x.id===${JSON.stringify(ppId)});
    const w=SPC.speciesPriceOf(q).won; const c0=S.tutorial.cashWon; window.__byeotSpeciesSell(q.id);
    return { w, c0, c1: S.tutorial.cashWon, gone: !S.species.pots.some(x=>x.id===q.id) }; })()`);
  console.log('⑥ 팜 —', JSON.stringify(sold));
  ok(sold.w > 0 && sold.c1 - sold.c0 === sold.w && sold.gone, `PP 를 팔았다 — 지갑 +${sold.w}`);
} catch (e) { if (e && e.message !== 'setup') { console.log('  FAIL 탈 —', e && e.message); bad++; } }
finally { await page.close(); }
console.log(bad ? `probe_d45_species: FAIL (${bad})` : 'probe_d45_species: PASS');
process.exit(bad ? 1 : 0);
