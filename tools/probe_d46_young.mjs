/* tools/probe_d46_young.mjs — **흙에 자리 잡은 삽수가 «작은 그루»로 자라 보이나** (2026-10-09 · core · 총괄 D46 · growth youngPlantOf)
   ------------------------------------------------------------
   판 세우기(값 0 · 세운 판): 새 판 → 모주 도착(창턱) · 날마다 물 주며 «문에 안 막히는» 마디가 설 때까지 → 그 마디를 흙 포트로 자른다 →
     흙에 자리 잡은 상태로 둔다(propagation §repotCutting 이 남기는 칸 그대로: status established · pottedOnDay · container soil).
   잰다(방 그림 · window.__rv.plants()):
     ① 잎 1장 — 작은 그루로 그렸다(young.leafCount = 1) · 찍음
     ② 잎이 늘면(코어 장부에 잎 둘 · 셋) 그날 그림의 잎 수도 따라 는다 · 높이가 커진다(D46 의 뜻) · 찍음
     ③ 세이브 → 새로 켬 — 같은 잎 수로 다시 선다
     ④ 그 그루에서 다시 자르면(잎이 준다) 그림 잎 수도 준다
   OUTDIR= (필수 · 비어 있어야) · BYEOT_URL=(기본 127.0.0.1:9300) */
import fs from 'node:fs';
import { launch, sleep } from './test_cdp.mjs';
const OUTDIR = process.env.OUTDIR;
if (!OUTDIR) { console.error('⛔ OUTDIR='); process.exit(2); }
fs.mkdirSync(OUTDIR, { recursive: true }); if (fs.readdirSync(OUTDIR).length) { console.error('⛔ OUTDIR 가 비어 있지 않다'); process.exit(2); }
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9300';
const page = await launch({ width: 390, height: 844, dpr: 1 });
let bad = 0; const ok = (c, m) => { console.log(`  ${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) bad++; };
try {
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true; try{ if(!sessionStorage.__c){ localStorage.clear(); sessionStorage.__c='1'; } }catch(e){}` });
  await page.goto(`${BASE}/game.html`);
  await page.waitFor('!!window.__rv', 300000, 500); await sleep(4000);
  const J = async (js, ms = 180000) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, ms));
  const skip = async () => { for (let i = 0; i < 100; i++) { const b = await page.eval(`String(document.getElementById('stage').classList.contains('talking'))`); if (b !== 'true') return;
    await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s)s.click();})()`, false); await sleep(200); } };
  await skip();
  const set = await J(`(async()=>{ const st=await import('/src/game/state.js'); const fp=await import('/src/game/first_play.js'); const pr=await import('/src/game/propagation.js'); const loop=await import('/src/game/loop.js');
    const S=window.__S(), io=window.__io;
    S.firstPlay.beansprout.harvestCount = fp.MONSTERA_ARRIVAL_RULE.harvestCount; S.firstPlay.beansprout.harvested = true;
    const a = st.givePlant(S, io, { slotId:null }); fp.markMonsteraArrived(S.firstPlay, a);
    const p=(S.pots||[])[0]; const sill=(io.light.room.slots||[]).map(s=>s.slotId).find(id=>/sill/.test(id)); const sl=(io.light.room.slots||[]).find(x=>x.slotId===sill)||{};
    st.setPotAt(S, p.id, { x: sl.x, y: sl.y, z: sl.z, slotId: sill }, { slots: io.light.room.slots, size: io.light.room.size }); fp.moveMonstera(S.firstPlay, sill);
    let n=null, nodes=[];
    for (let d=0; d<300 && !n; d++) { try { st.waterPot(S); } catch(e) {} loop.runDays(S, io, 1);
      nodes=io.growth.cuttableNodes()||[]; n=pr.cuttableNow(S,nodes,{potId:p.id}).find(x=>x.stem!=='petiole' && x.leaves===1 && !pr.cutBlockedReason(S,nodes,x.nodeId,{potId:p.id})) || null; }
    if (!n) return { 탈:'자를 마디가 안 열림' };
    const it=pr.containerItemOf('soil'); S.shop.stock[it]=(S.shop.stock[it]||0)+2;
    const desk=(io.light.room.slots||[]).find(x=>/desk/.test(x.slotId));
    const c=pr.takeCutting(S,{potId:p.id,nodes,nodeId:n.nodeId,container:'soil',at:{x:desk.x,y:desk.y,z:desk.z},slots:io.light.room.slots,size:io.light.room.size,snapDist:0});
    /* 흙에 자리 잡은 상태(§repotCutting 이 남기는 칸 그대로) */
    c.status='established'; c.container='soil'; c.method='pot'; c.pottedOnDay=S.day; c.deadlineDay=null;
    window.__redraw(); return { id:c.id, leaves:(c.leafVarie||[]).length, day:S.day }; })()`);
  console.log('세움 —', JSON.stringify(set));
  if (set.탈) { ok(false, set.탈); throw new Error('setup'); }
  const view = async () => { await sleep(2500); return J(`(()=>{ const p=(window.__rv.plants()||[]).find(x=>x.potId===${JSON.stringify(set.id)}); return p ? { kind:p.kind, young:p.young, cut:p.cutLeaves } : null; })()`); };
  const grow = (n) => J(`(()=>{ const S=window.__S(); const c=S.cuttings.find(x=>x.id===${JSON.stringify(set.id)}); for (let i=0;i<${n};i++){ c.leafVarie=[...(c.leafVarie||[]), false]; c.leafGrade=[...(c.leafGrade||[]), null]; c.grewLeaves=(c.grewLeaves||0)+1; }
    c.leafDays=8; window.__redraw(); return (c.leafVarie||[]).length; })()`);
  const v1 = await view(); console.log('① —', JSON.stringify(v1)); await page.shot(`${OUTDIR}/1_one_leaf.png`);
  ok(v1 && v1.young && v1.young.leafCount === set.leaves, `작은 그루로 그렸다(잎 ${v1 && v1.young && v1.young.leafCount} = 장부 ${set.leaves})`);
  const n2 = await grow(2); const v2 = await view(); console.log('② —', n2, JSON.stringify(v2)); await page.shot(`${OUTDIR}/2_three_leaves.png`);
  ok(v2 && v2.young && v2.young.leafCount === n2, `잎이 늘면 그림 잎도 는다(${v2 && v2.young && v2.young.leafCount} = 장부 ${n2})`);
  ok(v2 && v1 && v2.young && v1.young && v2.young.h > v1.young.h, `커졌다(높이 ${v1 && v1.young && v1.young.h} → ${v2 && v2.young && v2.young.h})`);
  /* ③ 세이브 → 새로 켬 */
  await page.eval(`(()=>{ try{ if(window.__save) window.__save(); }catch(e){} })()`, false); await sleep(1200);
  await page.goto(`${BASE}/game.html`);
  await page.waitFor('!!window.__rv', 300000, 500); await sleep(5000); await skip();
  const v3 = await view(); console.log('③ —', JSON.stringify(v3));
  ok(v3 && v3.young && v3.young.leafCount === n2, `새로 켜도 같은 잎 수(${v3 && v3.young && v3.young.leafCount})`);
  /* ④ 다시 자르기 */
  const re = await J(`(async()=>{ const pr=await import('/src/game/propagation.js'); const S=window.__S(); const c=S.cuttings.find(x=>x.id===${JSON.stringify(set.id)});
    const it=pr.containerItemOf('jar'); S.shop.stock[it]=(S.shop.stock[it]||0)+1;
    const cn=pr.cuttableNodesOfCutting(c); const pick=cn[cn.length-1];
    pr.takeCutting(S,{motherCuttingId:c.id,nodes:cn,nodeId:pick.nodeId,container:'jar'}); window.__redraw(); return (c.leafVarie||[]).length; })()`);
  const v4 = await view(); console.log('④ —', re, JSON.stringify(v4)); await page.shot(`${OUTDIR}/4_recut.png`);
  ok(v4 && v4.young && v4.young.leafCount === re && re < n2, `다시 자르면 그림 잎도 준다(${n2} → ${v4 && v4.young && v4.young.leafCount})`);
} catch (e) { if (e && e.message !== 'setup') { console.log('  FAIL 탈 —', e && e.message); bad++; } }
finally { await page.close(); }
console.log(bad ? `probe_d46_young: FAIL (${bad})` : 'probe_d46_young: PASS');
process.exit(bad ? 1 : 0);
