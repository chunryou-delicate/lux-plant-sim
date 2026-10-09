/* tools/probe_d59_shop.mjs — **엔딩 뒤 «식물 가게»가 서나** (2026-10-10 · core · 총괄 D59 · plan-shop-spec)
   ------------------------------------------------------------
   판(세운 판): 새 판 → 몬스테라 · 원룸 이사(화면 단추) → 저장 → 다시 켬 → 뿌리낸 삽수 하나 · 엔딩을 낸 판으로(ending.doneOnDay) → 저장 → 다시 켬
   잰다(화면 손):
     ① 다시 켜면 덮개에 진로 카드 셋(가게 열림 · 돌봄·육종 준비 중) · [다음 날]은 잠김(D28)
     ② [가게를 연다] → 다시 켜지 않고 투룸 방뷰가 선다 · story.job · 주문판에 첫 주문(반찬가게 사장님) · 기록 «반찬가게 사장님 — …»
     ③ [상점] 주문판 줄 · [납품] → 고르는 카드 → 보냄 → 지갑 += 값 · 단골 1 · 기록 «… — {thanks}»
     ④ [다음 날]이 다시 간다 · 앞치마 옷 · 세이브 → 다시 켬 — 가게가 그대로
     ⑤ [Char] 그림(10-10) — 덮개 ev_first_story_end · 가게 연 날 대사 ev_shop_open · 주문판·납품 카드 손님 얼굴 · status 줄(집 자금 이정표)과 PP 교환 장면이 대사 상자 그림으로 뜬다
   OUTDIR= (선택) · BYEOT_URL=(기본 127.0.0.1:9300) */
import fs from 'node:fs';
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9300';
const OUTDIR = process.env.OUTDIR || null; if (OUTDIR) fs.mkdirSync(OUTDIR, { recursive: true });
const page = await launch({ width: 390, height: 844, dpr: 1 });
let bad = 0; const ok = (c, m) => { console.log(`  ${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) bad++; };
const J = async (js, ms = 600000) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message, st:(e.stack||'').slice(0,300)}); } })()`, true, ms));
const skip = async () => { for (let k = 0; k < 4; k++) { for (let i = 0; i < 40; i++) {
  if (await page.eval(`String(document.getElementById('stage').classList.contains('talking'))`) !== 'true') break;
  await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s && s.offsetParent) s.click(); else { const x=document.getElementById('dlgBox'); if(x)x.click(); }})()`, false); await sleep(150); } await sleep(300); } };
const reload = async () => {
  await sleep(1500);
  await page.goto(`${BASE}/game.html`); await page.waitFor('!!window.__rv', 600000, 500); await sleep(4500); await skip(); };
const shot = async n => { if (OUTDIR) await page.shot(`${OUTDIR}/${n}.png`); };
const imgOk = sel => `(()=>{ const i=document.querySelector(${JSON.stringify(sel)}); return !!(i && i.complete && i.naturalWidth > 0 && i.style.display !== 'none'); })()`;
try {
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true; try{ if(!sessionStorage.__sh){ localStorage.clear(); sessionStorage.__sh='1'; } }catch(e){}` });
  await page.goto(`${BASE}/game.html`); await page.waitFor('!!window.__rv', 600000, 500); await sleep(4500); await skip();
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
  /* 뿌리낸 삽수 하나 · 엔딩을 낸 판 */
  const set = await J(`(async()=>{ const pr=await import('/src/game/propagation.js'); const st=await import('/src/game/state.js'); const loop=await import('/src/game/loop.js');
    const S=window.__S(), io=window.__io; const p=S.pots[0];
    if (p && !p.slotId && !p.at) { const sl=(io.light.room.slots||[]).find(x=>/sill/.test(x.slotId)); st.setPotAt(S, p.id, { x:sl.x, y:sl.y, z:sl.z, slotId:sl.slotId }, { slots: io.light.room.slots, size: io.light.room.size }); }
    let n=null, nodes=[];
    for (let d=0; d<240 && !n; d++) { try { st.waterPot(S); } catch(e) {} loop.runDays(S, io, 1); nodes=io.growth.cuttableNodes()||[];
      n=pr.cuttableNow(S,nodes,{potId:p.id}).find(x=>x.stem!=='petiole' && !pr.cutBlockedReason(S,nodes,x.nodeId,{potId:p.id})) || null; }
    if (!n) return { 탈:'자를 마디 없음' };
    const cont = n.leaves === 1 ? 'jar' : 'soil'; const it=pr.containerItemOf(cont); S.shop.stock[it]=(S.shop.stock[it]||0)+1;
    const c=pr.takeCutting(S,{potId:p.id,nodes,nodeId:n.nodeId,container:cont}); c.status='rooted'; c.rootedOnDay=S.day;
    S.story.ending.reachedOnDay = S.day; S.story.ending.doneOnDay = S.day;
    window.__redraw(); return { cut:c.id, day:S.day }; })()`);
  console.log('세움 —', JSON.stringify(set));
  if (set.탈) { ok(false, set.탈); throw new Error('setup'); }
  await reload();
  /* ① 진로 카드 */
  const c1 = await J(`(()=>({ on: document.getElementById('chapterEnd').classList.contains('on'), title: document.getElementById('chapterEndTitle').textContent,
    cards: [...document.querySelectorAll('#jobCards .job b')].map(b=>b.textContent), btn: [...document.querySelectorAll('#jobCards [data-job]')].map(b=>b.textContent) }))()`);
  console.log('① —', JSON.stringify(c1));
  await shot('1_job_cards');
  ok(c1.on && c1.cards.length === 3 && c1.btn.length === 1 && /가게를 연다/.test(c1.btn[0]), '덮개에 진로 카드 셋 · 가게만 [가게를 연다]');
  ok(await J(imgOk('#chapterEndArt')), '⑤ 덮개 그림 ev_first_story_end 가 섰다');
  const day0 = await J(`(()=>window.__S().day)()`);
  await page.eval(`(()=>{ const n=document.getElementById('mealGo'); if(n) n.click(); })()`, false); await sleep(800);
  ok((await J(`(()=>window.__S().day)()`)) === day0, '진로를 고르기 전엔 [다음 날]이 잠긴다(D28)');
  /* ② 가게를 연다 */
  await page.eval(`(()=>{ const b=document.querySelector('#jobCards [data-job="shop"]'); if(b) b.click(); })()`, false);
  let st2 = null; const artsSeen = new Set();
  for (let i = 0; i < 40; i++) { await sleep(2000); try { const a = await J(`(()=>window.__sceneArt())()`); if (a && a.on && a.src) artsSeen.add(a.src.replace(/^.*\//, '')); } catch { }
    st2 = await J(`(()=>{ const S=window.__S(); return { room:S.home.room, rv: !!window.__rv, rvRoom: window.__rv && window.__rv.roomId,
      failed: document.getElementById('stage').classList.contains('room-failed'), job: S.story.job, orders: (S.jobShop && S.jobShop.orders || []).map(o=>({ id:o.id, c:o.customerId, kind:o.kind, tier:o.tier })),
      logs: (S.log||[]).map(l=>l.msg).filter(m=>/반찬가게 사장님 —/.test(m)).slice(-1) }; })()`); if (st2.rv && st2.rvRoom === 'tworoom') break; }
  /* 대사를 한 줄씩 넘기며 그림을 잰다(jobStart → shopOpen 차례 · skip 은 통째로 건너뛴다) */
  for (let i = 0; i < 30 && !artsSeen.has('ev_shop_open.png'); i++) {
    const a = await J(`(()=>({ ...window.__sceneArt(), talking: document.getElementById('stage').classList.contains('talking') }))()`);
    if (a && a.on && a.src) artsSeen.add(a.src.replace(/^.*\//, ''));
    if (a && !a.talking && i > 4) break;
    await page.eval(`(()=>{ const x=document.getElementById('dlgBox'); if(x) x.click(); })()`, false); await sleep(900); }
  await skip(); await sleep(1500);
  console.log('② —', JSON.stringify(st2), '그림', [...artsSeen].join(','));
  ok(artsSeen.has('ev_shop_open.png'), `⑤ 가게 연 날 대사에 ev_shop_open(${[...artsSeen].join(',') || '없음'})`);
  await shot('2_tworoom');
  ok(st2.room === 'tworoom' && st2.rv && st2.rvRoom === 'tworoom' && !st2.failed, '다시 켜지 않고 투룸 방이 선다');
  ok(st2.job && st2.job.id === 'shop', '진로 = 식물 가게');
  ok(st2.orders.length === 1 && st2.orders[0].c === 'banchan_owner' && st2.logs.length === 1, `첫 주문 · 첫 손님 반찬가게 사장님(${JSON.stringify(st2.orders[0] || null)})`);
  /* ③ 주문판 · 납품 */
  await page.eval(`(()=>{ window.__byeotSheet.open('shop'); })()`, false); await sleep(1000);
  const ob = await J(`(()=>{ const b=document.getElementById('orderBoard'); return { shown: b && b.style.display !== 'none', rows: [...b.querySelectorAll('.orow .otxt')].map(x=>x.textContent), btn: [...b.querySelectorAll('[data-deliver]')].map(x=>({ t:x.textContent, off:x.disabled })) }; })()`);
  console.log('③ 주문판 —', JSON.stringify(ob));
  await shot('3_order_board');
  ok(ob.shown && ob.rows.length === 1 && ob.btn.length === 1 && !ob.btn[0].off, '주문판 줄 · [납품] 켜짐');
  ok(await J(imgOk('#orderBoard .oface')), '⑤ 주문판 손님 얼굴(portrait_npc_shop)');
  const c0 = await J(`(()=>window.__S().tutorial.cashWon)()`);
  await page.eval(`(()=>{ const b=document.querySelector('#orderBoard [data-deliver]'); if(b) b.click(); })()`, false); await sleep(800);
  const card = await J(`(()=>({ on: document.getElementById('detail').classList.contains('on'), title: document.getElementById('dTitle').textContent, btns: [...document.querySelectorAll('#dBtns button')].map(b=>b.textContent) }))()`);
  console.log('③ 카드 —', JSON.stringify(card));
  await sleep(400); ok(await J(imgOk('#detail .cface')), '⑤ 납품 카드 손님 얼굴'); await shot('3b_deliver_card');
  await page.eval(`(()=>{ const b=[...document.querySelectorAll('#dBtns button')].find(x=>/원$/.test(x.textContent)); if(b) b.click(); })()`, false); await sleep(1500); await skip();
  const after = await J(`(()=>{ const S=window.__S(); return { cash:S.tutorial.cashWon, regulars:S.jobShop.regulars, done:S.jobShop.done, orders:S.jobShop.orders.length,
    cutGone: !(S.cuttings||[]).some(c=>c.id===${JSON.stringify(set.cut)}), log:(S.log||[]).map(l=>l.msg).filter(m=>/^🤝/.test(m)).slice(-1) }; })()`);
  console.log('③ 납품 —', JSON.stringify({ c0, after }));
  ok(card.on && /주문/.test(card.title) && after.done === 1 && after.regulars.length === 1 && after.cash > c0 && after.cutGone && after.log.length === 1, `납품했다(+${after.cash - c0} · 단골 ${after.regulars.length})`);
  /* ④ 다음 날 · 앞치마 · 세이브 */
  await page.eval(`(()=>{ window.__byeotSheet && window.__byeotSheet.close && window.__byeotSheet.close(); })()`, false); await sleep(500);
  const d1 = await J(`(()=>window.__S().day)()`);
  await page.eval(`(()=>{ const n=document.getElementById('mealGo'); if(n) n.click(); })()`, false); await sleep(3000); await skip();
  const d2 = await J(`(()=>window.__S().day)()`);
  ok(d2 === d1 + 1, `가게를 열면 [다음 날]이 다시 간다(${d1} → ${d2})`);
  const outfit = await J(`(()=>({ o: window.__rv && window.__rv.heroOutfit ? window.__rv.heroOutfit() : null }))()`);
  ok(outfit.o === 'apron', `앞치마(${outfit.o})`);
  const hd = await J(`(()=>({ on: window.__io.growth.healthDropEnabled ? window.__io.growth.healthDropEnabled() : null }))()`);
  ok(hd.on === true, `초보 보호 끝 — 낙엽·고사 켬(${hd.on})`);
  await reload();
  const back = await J(`(()=>{ const S=window.__S(); return { room:S.home.room, job:S.story.job && S.story.job.id, done:S.jobShop && S.jobShop.done, regulars:S.jobShop && S.jobShop.regulars.length, overlay: document.getElementById('chapterEnd').classList.contains('on') }; })()`);
  console.log('④ 다시 켬 —', JSON.stringify(back));
  ok(back.room === 'tworoom' && back.job === 'shop' && back.done === 1 && back.regulars === 1 && !back.overlay, '세이브 왕복 — 가게가 그대로 · 덮개 없음');
  await shot('4_reload');
  /* ⑤ status 줄 · 새 사건 그림 — 대사 상자(#sceneArt) 길로 뜨나(줄 art 칸 · sceneArtOf) */
  for (const [id, want] of [['statusHomeQuarter', 'ev_home_mark_quarter'], ['ppTradeDone', 'ev_pp_trade_done'], ['alSproutVarie', 'ev_al_sprout_varie']]) {
    await page.eval(`(()=>window.__dlgOpen([${JSON.stringify(id)}]))()`, false); await sleep(1200);
    const a = await J(`(()=>({ ...window.__sceneArt(), loaded: (()=>{ const i=document.getElementById('sceneArtImg'); return !!(i && i.complete && i.naturalWidth > 0); })() }))()`);
    if (id === 'statusHomeQuarter') await shot('5_status_art');
    ok(a.on && a.loaded && new RegExp(want + '\.png$').test(a.src || ''), `⑤ ${id} → ${want}(${a.src})`);
    await skip();
  }
  /* ⑤ 가게 판 자취생 낯 = 앞치마 판([Char] 0784947e) — think 는 앞치마 판이 있고(statusHomeNear 첫 줄) · winter 는 없다(questAlKeepWinter 첫 줄 · 지금 파일 그대로) */
  for (const [id, face, want] of [['statusHomeNear', 'think', /portrait_jachwi_think_apron\.png/], ['questAlKeepWinter', 'winter', /portrait_jachwi_winter\.png/]]) {
    await page.eval(`(()=>window.__dlgOpen([${JSON.stringify(id)}]))()`, false); await sleep(900);
    const f = await J(`(()=>{ const u=(document.getElementById('dlgFace').style.backgroundImage.split('"')[1]) || '';   /* url("…") 의 첫 겹 · 정규식은 템플릿에서 한 겹 먹힌다 */
      return new Promise(r=>{ if(!u) return r({u,ok:false}); const i=new Image(); i.onload=()=>r({u,ok:true}); i.onerror=()=>r({u,ok:false}); i.src=u; }); })()`);
    ok(want.test(f.u) && f.ok, `⑤ 가게 판 자취생 ${face} 낯 → ${f.u.replace(/^.*\//, '')}(로드 ${f.ok})`);
    await skip();
  }
} catch (e) { if (e && e.message !== 'setup') { console.log('  FAIL 탈 —', e && e.message); bad++; } }
finally { await page.close(); }
console.log(bad ? `probe_d59_shop: FAIL (${bad})` : 'probe_d59_shop: PASS');
process.exit(bad ? 1 : 0);
