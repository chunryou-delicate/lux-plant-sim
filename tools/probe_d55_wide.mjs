/* tools/probe_d55_wide.mjs — **칸보다 크게 자란 작은 그루** (2026-10-09 · core · 총괄 D55)
   ------------------------------------------------------------
   판(세운 판 · 값 0): 새 판(반지하) → 모주 창턱 → 자를 마디가 서면 흙 포트로 잘라 에타지에 맨 윗단(한도 maxPotD)에 놓고 «자리 잡음» →
     잎을 늘려(코어 장부) 그림 지름이 칸 한도의 2배를 넘게 한다.
   잰다: ① 방이 그린 지름 d > 한도 × 2 · ② 몬이 한 줄(사건 cut_too_wide · 기록 «…보다 크게 자랐습니다») — 한 번만(다시 그려도 되풀이 안 함)
         ③ 같은 가구 다른 칸으로 옮기려 하면(끌어 놓기 길) 안 놓인다 · «더 넓은 자리» 안내 · 그루는 제자리
         ④ 한도가 넉넉한 자리(책상 등 · 한도 × 2 ≥ d)나 자유 자리로는 놓인다
   OUTDIR= (선택) · BYEOT_URL=(기본 127.0.0.1:9300) */
import fs from 'node:fs';
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9300';
const OUTDIR = process.env.OUTDIR || null; if (OUTDIR) fs.mkdirSync(OUTDIR, { recursive: true });
const page = await launch({ width: 390, height: 844, dpr: 1 });
let bad = 0; const ok = (c, m) => { console.log(`  ${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) bad++; };
const J = async (js, ms = 300000) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, ms));
const skip = async () => { for (let i = 0; i < 80; i++) { if (await page.eval(`String(document.getElementById('stage').classList.contains('talking'))`) !== 'true') return;
  await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s)s.click();})()`, false); await sleep(200); } };
try {
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true; try{ if(!sessionStorage.__w){ localStorage.clear(); sessionStorage.__w='1'; } }catch(e){}` });
  await page.goto(`${BASE}/game.html`); await page.waitFor('!!window.__rv', 600000, 500); await sleep(4500); await skip();
  const set = await J(`(async()=>{ const st=await import('/src/game/state.js'); const fp=await import('/src/game/first_play.js'); const pr=await import('/src/game/propagation.js'); const loop=await import('/src/game/loop.js');
    const S=window.__S(), io=window.__io;
    S.firstPlay.beansprout.harvestCount = fp.MONSTERA_ARRIVAL_RULE.harvestCount; S.firstPlay.beansprout.harvested = true;
    const a = st.givePlant(S, io, { slotId:null }); fp.markMonsteraArrived(S.firstPlay, a);
    const p=(S.pots||[])[0]; const sl=(io.light.room.slots||[]).find(x=>/sill/.test(x.slotId));
    st.setPotAt(S, p.id, { x: sl.x, y: sl.y, z: sl.z, slotId: sl.slotId }, { slots: io.light.room.slots, size: io.light.room.size }); fp.moveMonstera(S.firstPlay, sl.slotId);
    let n=null, nodes=[];
    for (let d=0; d<300 && !n; d++) { try { st.waterPot(S); } catch(e) {} loop.runDays(S, io, 1);
      nodes=io.growth.cuttableNodes()||[]; n=pr.cuttableNow(S,nodes,{potId:p.id}).find(x=>x.stem!=='petiole' && !pr.cutBlockedReason(S,nodes,x.nodeId,{potId:p.id})) || null; }
    if (!n) return { 탈:'자를 마디가 안 열림' };
    const it=pr.containerItemOf('soil'); S.shop.stock[it]=(S.shop.stock[it]||0)+2;
    const top=(io.light.room.slots||[]).filter(x=>/^banjiha-etagere:/.test(x.slotId)).sort((a,b)=>b.y-a.y);
    const t0=top[0];
    const c=pr.takeCutting(S,{potId:p.id,nodes,nodeId:n.nodeId,container:'soil',at:{x:t0.x,y:t0.y,z:t0.z},slots:io.light.room.slots,size:io.light.room.size,snapDist:0});
    c.status='established'; c.container='soil'; c.method='pot'; c.pottedOnDay=S.day; c.deadlineDay=null;
    for (let i=0;i<8;i++){ c.leafVarie=[...(c.leafVarie||[]), false]; c.leafGrade=[...(c.leafGrade||[]), null]; c.grewLeaves=(c.grewLeaves||0)+1; }
    window.__redraw();
    return { id:c.id, slot:c.slotId, limit:t0.maxPotD, leaves:c.leafVarie.length, other: top[1] && top[1].slotId,
             desk: ((io.light.room.slots||[]).filter(x=>/desk/.test(x.slotId)).map(x=>({ id:x.slotId, lim:x.maxPotD })))[0] || null }; })()`);
  console.log('세움 —', JSON.stringify(set));
  if (set.탈) { ok(false, set.탈); throw new Error('setup'); }
  await sleep(5000);
  await page.eval(`(()=>{ window.__redraw(); })()`, false); await sleep(2500); await skip();
  const v1 = await J(`(()=>{ const p=(window.__rv.plants()||[]).find(x=>x.potId===${JSON.stringify(set.id)}); const logs=(window.__S().log||[]).map(l=>l.msg).filter(m=>/크게 자랐습니다/.test(m));
    return { d: p && p.young ? p.young.d : null, leaves: p && p.young ? p.young.leafCount : null, logs }; })()`);
  console.log('① ② —', JSON.stringify(v1));
  if (OUTDIR) await page.shot(`${OUTDIR}/1_wide.png`);
  ok(v1.d != null && set.limit != null && v1.d > set.limit * 2, `그림 지름 ${v1.d && v1.d.toFixed(2)} > 칸 한도 ${set.limit} × 2`);
  ok(v1.logs.length === 1, `몬이 한 줄(기록 ${v1.logs.length}줄) — «${v1.logs[0] || ''}»`);
  await page.eval(`(()=>{ window.__redraw(); })()`, false); await sleep(1500); await skip();
  const v1b = await J(`(()=>(window.__S().log||[]).map(l=>l.msg).filter(m=>/크게 자랐습니다/.test(m)).length)()`);
  ok(v1b === 1, '다시 그려도 되풀이하지 않는다');
  /* ③ 같은 가구 다른 칸 */
  const r3 = await J(`(()=>{ const r=window.__byeotCommitPlace('cutting:${set.id}', ${JSON.stringify(set.other)}); const c=window.__S().cuttings.find(x=>x.id===${JSON.stringify(set.id)}); return { r, slot:c.slotId }; })()`);
  console.log('③ —', JSON.stringify(r3));
  ok(r3.slot === set.slot && /너무 큽니다/.test(r3.r.label || ''), `옆 칸엔 안 놓인다(제자리 ${r3.slot} · «${r3.r.label}»)`);
  /* ④ 넉넉한 자리 */
  if (set.desk && set.desk.lim * 2 >= v1.d) {
    const r4 = await J(`(()=>{ const r=window.__byeotCommitPlace('cutting:${set.id}', ${JSON.stringify(set.desk.id)}); const c=window.__S().cuttings.find(x=>x.id===${JSON.stringify(set.id)}); return { r, slot:c.slotId }; })()`);
    console.log('④ —', JSON.stringify(r4));
    ok(r4.slot === set.desk.id, `한도가 넉넉한 자리(${set.desk.id} · 한도 ${set.desk.lim})엔 놓인다`);
  } else console.log('  (책상 한도가 모자라 ④ 건너뜀 —', JSON.stringify(set.desk), ')');
} catch (e) { if (e && e.message !== 'setup') { console.log('  FAIL 탈 —', e && e.message); bad++; } }
finally { await page.close(); }
console.log(bad ? `probe_d55_wide: FAIL (${bad})` : 'probe_d55_wide: PASS');
process.exit(bad ? 1 : 0);
