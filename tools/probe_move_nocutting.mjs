/* tools/probe_move_nocutting.mjs — **무늬 모주는 있는데 무늬 삽수 0 으로 이사하려 하면 몬이 한 줄** (2026-10-10 · core · plan 03a35d6b · D27 갈래 둘)
   ------------------------------------------------------------
   판(세운 판): 새 판(반지하) → 모주 창턱 → 날을 보내 «오늘 자를 수 있는 무늬 마디»가 설 때까지 → 이사 두 축을 세움(돈 · 무늬 삽수 판 적)
   잰다: ① [원룸으로 이사] → 대사 moveNoCutting(«무늬 삽수 하나는 잘라 들고 가자…») · 창에 «무늬 삽수 없이 가면…» · 단추는 [이사한다](막지 않음)
         ② 무늬 삽수가 하나라도 있으면(잘라 둠) 그 줄도 대사도 없다
         ③ D31 — 지갑 − 이사비 < 원룸 첫 달 월세면 move_low_cash(«이사비 내면 첫 달 월세가 모자라…»)
   BYEOT_URL=(기본 127.0.0.1:9300) */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9300';
const page = await launch({ width: 390, height: 844, dpr: 1 });
let bad = 0; const ok = (c, m) => { console.log(`  ${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) bad++; };
const J = async (js, ms = 600000) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, ms));
const skip = async () => { for (let i = 0; i < 80; i++) { if (await page.eval(`String(document.getElementById('stage').classList.contains('talking'))`) !== 'true') return;
  await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s)s.click();})()`, false); await sleep(200); } };
try {
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true; try{ if(!sessionStorage.__mn){ localStorage.clear(); sessionStorage.__mn='1'; } }catch(e){}` });
  await page.goto(`${BASE}/game.html`); await page.waitFor('!!window.__rv', 600000, 500); await sleep(4500); await skip();
  const set = await J(`(async()=>{ const st=await import('/src/game/state.js'); const fp=await import('/src/game/first_play.js'); const loop=await import('/src/game/loop.js');
    const S=window.__S(), io=window.__io;
    S.firstPlay.beansprout.harvestCount = fp.MONSTERA_ARRIVAL_RULE.harvestCount; S.firstPlay.beansprout.harvested = true;
    const a = st.givePlant(S, io, { slotId:null }); fp.markMonsteraArrived(S.firstPlay, a);
    const p=(S.pots||[])[0]; const sl=(io.light.room.slots||[]).find(x=>/sill/.test(x.slotId));
    st.setPotAt(S, p.id, { x: sl.x, y: sl.y, z: sl.z, slotId: sl.slotId }, { slots: io.light.room.slots, size: io.light.room.size }); fp.moveMonstera(S.firstPlay, sl.slotId);
    let v=null;
    for (let d=0; d<400; d++) { try { st.waterPot(S); } catch(e) {} loop.runDays(S, io, 1); v=window.__byeotVarieSources(); if (v.cutOpen > 0 && v.a > 0) break; }
    const ts=S.tutorial; ts.cashWon = ts.rules.moveOutCostWon + 3000000; for (const k of Object.keys(ts.learned||{})) ts.learned[k]=true;
    ts.varieSale = { count:1, firstDay:ts.day, wonTotal:350000, migrated:null }; ts.varieLeaf = { ever:true, count:1, firstOnDay:S.day };
    window.__redraw(); return { day:S.day, v, cuts:(S.cuttings||[]).length }; })()`);
  console.log('세움 —', JSON.stringify(set));
  if (!(set.v && set.v.cutOpen > 0 && set.v.a > 0 && set.v.b === 0)) { ok(false, '판을 못 세움(무늬 모주 · 자를 수 있는 무늬 마디 · 무늬 삽수 0)'); throw new Error('setup'); }
  await skip();
  await page.eval(`(()=>{ window.__dlgSeen=[]; })()`, false);
  await page.eval(`(()=>{ const b=document.getElementById('moveOut'); if(b){ b.disabled=false; b.click(); } })()`, false); await sleep(1200);
  const talk = await J(`(()=>({ talking: document.getElementById('stage').classList.contains('talking'), text: ((document.getElementById('dlgText')||document.getElementById('dlgBox')||{}).textContent||'').trim().slice(0,80) }))()`);
  await skip(); await sleep(800);
  const panel = await J(`(()=>({ on: document.getElementById('movePanel').classList.contains('on'), lines: [...document.querySelectorAll('#moveAsk div')].map(d=>d.textContent), go: document.getElementById('moveGo').textContent }))()`);
  console.log('① —', JSON.stringify({ talk, panel }));
  ok(talk.talking && /무늬 삽수 하나는 잘라 들고 가자/.test(talk.text), `몬이 한 줄(«${talk.text}»)`);
  ok(panel.on && panel.lines.some(l => /무늬 삽수 없이 가면/.test(l)) && panel.go === '이사한다', '창에 «무늬 삽수 없이 가면…» · 단추는 [이사한다](막지 않음)');
  await page.eval(`(()=>{ document.getElementById('moveCancel').click(); })()`, false); await sleep(500);
  /* ② 무늬 삽수가 하나 있으면 */
  const cut = await J(`(async()=>{ const pr=await import('/src/game/propagation.js'); const S=window.__S(), io=window.__io; const p=S.pots[0];
    const nodes=io.growth.cuttableNodes(); const n=pr.cuttableNow(S,nodes,{potId:p.id}).find(x=>(x.variegatedLeaves||0)>0 && !pr.cutBlockedReason(S,nodes,x.nodeId,{potId:p.id}));
    if(!n) return { 탈:'자를 무늬 마디 없음' }; const cont = n.leaves === 1 ? 'jar' : 'soil'; const it=pr.containerItemOf(cont); S.shop.stock[it]=(S.shop.stock[it]||0)+1;
    const c=pr.takeCutting(S,{potId:p.id,nodes,nodeId:n.nodeId,container:cont}); window.__redraw(); return { id:c.id, varie:c.varieFromCut, cont, v: window.__byeotVarieSources() }; })()`);
  console.log('② 자름 —', JSON.stringify(cut));
  await page.eval(`(()=>{ const b=document.getElementById('moveOut'); if(b){ b.disabled=false; b.click(); } })()`, false); await sleep(1200);
  const t2 = await J(`(()=>({ talking: document.getElementById('stage').classList.contains('talking'), on: document.getElementById('movePanel').classList.contains('on'), lines: [...document.querySelectorAll('#moveAsk div')].map(d=>d.textContent) }))()`);
  console.log('② —', JSON.stringify(t2));
  ok(!!cut.varie && cut.v && cut.v.b >= 1, `무늬 삽수를 하나 잘라 들었다(${cut.cont} · 무늬 삽수 ${cut.v && cut.v.b})`);
  ok(!t2.talking && t2.on && !t2.lines.some(l => /무늬 삽수 없이 가면/.test(l)), '무늬 삽수가 있으면 그 줄도 대사도 없다');
  /* ③ D31 — 이사비를 내면 원룸 첫 달 월세가 모자라면(지갑 = 이사비 + 5만) 몬이 한 줄 move_low_cash(막지 않음) */
  await page.eval(`(()=>{ document.getElementById('moveCancel').click(); const S=window.__S(); S.tutorial.cashWon = S.tutorial.rules.moveOutCostWon + 50000; window.__redraw(); })()`, false); await sleep(600);
  await page.eval(`(()=>{ const b=document.getElementById('moveOut'); if(b){ b.disabled=false; b.click(); } })()`, false); await sleep(1200);
  const t3 = await J(`(()=>({ talking: document.getElementById('stage').classList.contains('talking'), text: ((document.getElementById('dlgText')||{}).textContent||'').trim().slice(0,80) }))()`);
  console.log('③ D31 —', JSON.stringify(t3));
  ok(t3.talking && /첫 달 월세가 모자라/.test(t3.text), `D31 몬이 한 줄(«${t3.text}»)`);
} catch (e) { if (e && e.message !== 'setup') { console.log('  FAIL 탈 —', e && e.message); bad++; } }
finally { await page.close(); }
console.log(bad ? `probe_move_nocutting: FAIL (${bad})` : 'probe_move_nocutting: PASS');
process.exit(bad ? 1 : 0);
