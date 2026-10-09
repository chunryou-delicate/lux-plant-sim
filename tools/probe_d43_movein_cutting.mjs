/* tools/probe_d43_movein_cutting.mjs — **이사한 원룸 첫날, 손가락이 «들고 온 삽수»부터 짚나** (2026-10-09 · core · 총괄 D43)
   ------------------------------------------------------------
   이사는 물건 자리를 다 비우고(oneroom §clearPlacements) 삽수는 가방에 남는다 — 가방 속 삽수는 하루가 안 간다(D29).
   판 세우기(값 0 · 세운 판): 새 판 → 첫 플레이 «끝»(코어 사실) · 모주 도착(창턱) · 병 삽수 하나(책상 자리 · 모주를 날마다 물 주며 키워
     «문에 안 막히는» 마디가 서면 자른다) → [이사] → 되묻기 창 [이사한다/그래도 간다] → 저장하고 새로 켠다(probe_oneroom_finger 와 같은 손 ·
     헤드리스는 방을 두 번째로 못 짓는다).
   잰다(화면 손 그대로):
     ① 새로 켠 원룸 — 그 삽수가 가방에 있다(자리 없음) · 첫 손가락이 삽수 칸 또는 [가방] 문을 짚는다(가구보다 먼저) · 할 일 머리 줄
     ② 손가락이 짚는 대로 누른다(가방 문 → 삽수 칸) · 놓기 확인 바가 서면 [확인] → 삽수에 자리가 생겼다
     ③ [다음 날] — 삽수의 날(days)이 오른다
   OUTDIR= (필수 · 비어 있어야) · BYEOT_URL=(기본 127.0.0.1:9300) */
import fs from 'node:fs';
import { launch, sleep } from './test_cdp.mjs';
const OUTDIR = process.env.OUTDIR;
if (!OUTDIR) { console.error('⛔ OUTDIR='); process.exit(2); }
fs.mkdirSync(OUTDIR, { recursive: true }); if (fs.readdirSync(OUTDIR).length) { console.error('⛔ OUTDIR 가 비어 있지 않다'); process.exit(2); }
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9300';
const page = await launch({ width: 390, height: 844, dpr: 1 });
let bad = 0; const ok = (c, m) => { console.log(`  ${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) bad++; };
const m = (type, x, y, buttons) => page.send('Input.dispatchMouseEvent', { type, x: Math.round(x), y: Math.round(y), button: 'left', buttons, clickCount: 1 });
const tapAt = async (x, y) => { await m('mouseMoved', x, y, 0); await m('mousePressed', x, y, 1); await sleep(80); await m('mouseReleased', x, y, 0); await sleep(800); };
try {
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true; try{ if(!sessionStorage.__c){ localStorage.clear(); sessionStorage.__c='1'; } }catch(e){}` });
  await page.goto(`${BASE}/game.html`);
  await page.waitFor('!!window.__rv', 300000, 500); await sleep(4000);
  const J = async (js, ms = 120000) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, ms));
  const skip = async (n = 150) => { for (let i = 0; i < n; i++) {
    const b = await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');return String(!!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on')));})()`);
    if (b !== 'true') return;
    await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s)s.click(); const g=document.getElementById('guideClose'); if(g&&g.offsetParent){g.click();return;} const b=document.getElementById('dlgBox'); if(b)b.click();})()`, false); await sleep(250); } };
  const fingerAt = () => J(`(()=>{ const h=document.getElementById('hint'); if (!h || !h.classList.contains('on')) return null;
    const t=document.querySelector('.hintTarget'); const tr=t?t.getBoundingClientRect():null;
    return { x: tr ? tr.left+tr.width/2 : null, y: tr ? tr.top+tr.height/2 : null, what: t ? (t.id || (t.className||'').split(' ')[0]) : '(점)',
             say: ((h.querySelector('.say')||{}).textContent||'').trim().slice(0,60) }; })()`);
  await skip();
  /* 판 세우기 */
  const set = await J(`(async()=>{ const st=await import('/src/game/state.js'); const fp=await import('/src/game/first_play.js'); const pr=await import('/src/game/propagation.js');
    const S=window.__S(), io=window.__io;
    S.firstPlay.beansprout.harvestCount = fp.MONSTERA_ARRIVAL_RULE.harvestCount; S.firstPlay.beansprout.harvested = true;
    const a = st.givePlant(S, io, { slotId:null }); fp.markMonsteraArrived(S.firstPlay, a);
    const p=(S.pots||[])[0]; const sill=(io.light.room.slots||[]).map(s=>s.slotId).find(id=>/sill/.test(id)); const sl=(io.light.room.slots||[]).find(x=>x.slotId===sill)||{};
    st.setPotAt(S, p.id, { x: sl.x, y: sl.y, z: sl.z, slotId: sill }, { slots: io.light.room.slots, size: io.light.room.size }); fp.moveMonstera(S.firstPlay, sill);
    const desk=(io.light.room.slots||[]).find(x=>/desk/.test(x.slotId));
    const it=pr.containerItemOf('jar'); S.shop.stock[it]=(S.shop.stock[it]||0)+1;
    /* 모주를 키운다(날마다 물 · 자를 마디가 «문에 안 막힐» 때까지 · 최대 200일) — 꼼수(모드 바꾸기) 대신 */
    const loop=await import('/src/game/loop.js'); let n=null, nodes=[];
    for (let d=0; d<200 && !n; d++) { try { st.waterPot(S); } catch(e) {} loop.runDays(S, io, 1);
      nodes=io.growth.cuttableNodes()||[]; n=pr.cuttableNow(S,nodes,{potId:p.id}).find(x=>x.stem!=='petiole' && !pr.cutBlockedReason(S,nodes,x.nodeId,{potId:p.id})) || null; }
    if (!n) return { 탈:'200일 안에 자를 마디가 안 열림' };
    let c=pr.takeCutting(S,{potId:p.id,nodes,nodeId:n.nodeId,container:'jar',at:{x:desk.x,y:desk.y,z:desk.z},slots:io.light.room.slots,size:io.light.room.size,snapDist:0});
    if (S.firstPlay) { S.firstPlay.completed = true; S.firstPlay.phase = 'spear_furled'; }
    const ts=S.tutorial; ts.cashWon = ts.rules.moveOutCostWon + 400000; ts.varieLeaf = { ever:true, count:1, firstOnDay:S.day };
    window.__redraw(); return { cut: c && c.id, slotId: c && c.slotId, at: !!(c && c.at) }; })()`);
  console.log('세움 —', JSON.stringify(set));
  ok(set.cut && (set.slotId || set.at), '이사 전 병 삽수가 반지하 방에 놓였다');
  await sleep(600); await skip();
  /* 이사 — 단추 → 되묻기 창 */
  await page.eval(`(()=>{ const b=document.getElementById('moveOut'); if(b){ b.disabled=false; b.click(); } })()`, false);
  await sleep(1500);
  await page.eval(`(()=>{ const g=document.getElementById('moveGo'); if(g && g.offsetParent) g.click(); })()`, false);
  await sleep(6000); await skip();
  const moved = await J(`(()=>{ const S=window.__S(); const c=(S.cuttings||[]).find(x=>x.id===${JSON.stringify(set.cut)}); return { room:S.home.room, movedOut:!!S.tutorial.movedOut, slotId:c&&c.slotId, at:!!(c&&c.at), status:c&&c.status }; })()`);
  console.log('이사 직후 —', JSON.stringify(moved));
  ok(moved.movedOut, '이사했다');
  await page.eval(`(()=>{ try{ if(window.__save) window.__save(); }catch(e){} })()`, false); await sleep(1200);
  await page.goto(`${BASE}/game.html`);
  await page.waitFor('!!window.__rv', 300000, 500); await sleep(4000); await skip();
  /* ① 새로 켠 원룸 */
  const before = await J(`(()=>{ const S=window.__S(); const c=(S.cuttings||[]).find(x=>x.id===${JSON.stringify(set.cut)});
    return { room:S.home.room, cut:c?{slotId:c.slotId||null, at:!!c.at, days:c.days, status:c.status}:null, quest:(document.getElementById('quest').textContent||'').trim().slice(0,60),
             furnBag:((S.home||{}).furnitureBag||[]).length }; })()`);
  const f1 = await fingerAt();
  console.log('원룸 첫 화면 —', JSON.stringify({ before, finger: f1 }));
  await page.shot(`${OUTDIR}/1_first_finger.png`);
  ok(before.cut && !before.cut.slotId && !before.cut.at, '들고 온 삽수가 가방에 있다(자리 없음)');
  ok(!!f1 && (/cutThumb/.test(f1.what) || /tabBag|openBag/.test(f1.what)) && /삽수/.test(f1.say || ''), `첫 손가락이 들고 온 삽수(또는 가방 문)를 짚는다 — ${f1 ? `${f1.what} «${f1.say}»` : '손가락 없음'}`);
  /* ② 손가락대로 누른다(최대 세 번) */
  let placed = null;
  for (let i = 0; i < 3 && !placed; i++) {
    const f = await fingerAt();
    if (!f || f.x == null) break;
    await tapAt(f.x, f.y);
    await sleep(600);
    await page.eval(`(()=>{ const b=document.getElementById('placeOk'); if(b && document.getElementById('stage').classList.contains('confirming')) b.click(); })()`, false);
    await sleep(800); await skip();
    const c = await J(`(()=>{ const c=(window.__S().cuttings||[]).find(x=>x.id===${JSON.stringify(set.cut)}); return c && (c.slotId || c.at) ? { slotId:c.slotId||null, days:c.days } : null; })()`);
    if (c) placed = c;
  }
  await page.shot(`${OUTDIR}/2_placed.png`);
  ok(!!placed, `손가락대로 누르니 삽수가 방에 섰다 ${placed ? JSON.stringify(placed) : ''}`);
  /* ③ 하루 — 원룸 첫날은 짐(식물·시루)을 다 놓아야 [다음 날]이 열린다. 손가락을 마저 따라간다(최대 열두 번 · 확인 바면 [확인]) */
  if (placed) {
    for (let i = 0; i < 12; i++) {
      const nextOn = await page.eval(`(()=>{ const b=document.getElementById('next'); return String(!!(b && !b.disabled && b.offsetParent)); })()`);
      const f = await fingerAt();
      if (!f || f.x == null || /^next$/.test(f.what)) break;
      if (nextOn === 'true' && !/bag|Bag|Thumb|potbag|placeOk/.test(f.what)) break;
      await tapAt(f.x, f.y); await sleep(500);
      await page.eval(`(()=>{ const b=document.getElementById('placeOk'); if(b && document.getElementById('stage').classList.contains('confirming')) b.click(); })()`, false);
      await sleep(700); await skip();
    }
    const d0 = Number(await page.eval(`String(window.__S().day)`));
    await page.eval(`(()=>{const b=document.getElementById('next'); if(b) b.click();})()`, false);
    for (let i = 0; i < 60; i++) { await sleep(500); if (Number(await page.eval(`String(window.__S().day)`)) > d0) break;
      await page.eval(`(()=>{const g=document.getElementById('mealGo'); if(g && g.offsetParent) g.click();})()`, false); }
    await sleep(1200); await skip();
    const after = await J(`(()=>{ const S=window.__S(); const c=(S.cuttings||[]).find(x=>x.id===${JSON.stringify(set.cut)}); return { day:S.day, days:c.days, status:c.status, slotId:c.slotId, clock:c.clockOnDay, stage:document.getElementById('stage').className }; })()`);
    console.log('하루 뒤 —', JSON.stringify({ d0, after }));
    ok(after.day > d0, `[다음 날]로 하루가 넘어갔다(${d0} → ${after.day})`);
    ok(after.days > placed.days, `놓은 뒤 삽수의 날이 오른다(${placed.days} → ${after.days})`);
  }
} catch (e) { console.log('  FAIL 탈 —', e && e.message); bad++; }
finally { await page.close(); }
console.log(bad ? `probe_d43_movein_cutting: FAIL (${bad})` : 'probe_d43_movein_cutting: PASS');
process.exit(bad ? 1 : 0);
