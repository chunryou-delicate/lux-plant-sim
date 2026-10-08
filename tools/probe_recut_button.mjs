/* tools/probe_recut_button.mjs — **자리 잡은 삽수에서 [병에]·[흙에]로 다시 자르기가 화면에서 되나** (2026-10-08 · core · 총괄 14:25 ①)
   ------------------------------------------------------------
   판 세우기(값 0 · 게임 함수만): SAVE(모주가 창턱에 선 판 · leaf `_make_oneroom_save NOMOVE=1`)로 켜고 →
     모주에서 잎 둘 이상 실린 마디를 «흙에»(takeCutting · 게임 [흙에]와 같은 부름 · ⚠ 모주 자르기 문은 건너뜀 — 세이브의 다 자란 무늬 잎이 1장이라) → 창턱 옆 칸에 놓기(setCuttingAt) →
     loop.nextDay 를 «자리 잡음»까지(흙은 rootDays 뒤 established) — ⚠ 하루 넘김은 화면 단추가 아니라 같은 함수를 직접 부른다(판 세우기).
   잰다(화면 손 그대로):
     ① [식물] 장 «가진 삽수»에 «✂ 이 삽수에서» 줄이 섰나 · [병에] 단추가 열렸나(병 재고 1)
     ② [병에]를 «누르면» 삽수가 하나 늘고 · 새 삽수의 모주가 그 삽수인가 · 배너 «삽수에서 삽수를»
     ③ 자르기 문(무늬 다 자란 잎)은 삽수엔 안 걸린다 — 막는 말이 «아직 이릅니다»가 아니다
   SAVE= (필수) · OUTDIR= (필수 · 비어 있어야) · SLOT=banjiha-etagere:7 · BYEOT_URL=(기본 127.0.0.1:9300) */
import fs from 'node:fs';
import { launch, sleep } from './test_cdp.mjs';
const OUTDIR = process.env.OUTDIR, SAVEF = process.env.SAVE;
if (!OUTDIR || !SAVEF) { console.error('⛔ SAVE= OUTDIR='); process.exit(2); }
fs.mkdirSync(OUTDIR, { recursive: true }); if (fs.readdirSync(OUTDIR).length) { console.error('⛔ OUTDIR 가 비어 있지 않다'); process.exit(2); }
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9300';
const SLOT = process.env.SLOT || 'banjiha-etagere:7';   /* 반지하 창턱 칸은 하나(모주 자리) — 등 밑 선반 */
const SAVE = fs.readFileSync(SAVEF, 'utf8');
const page = await launch({ width: 390, height: 844, dpr: 1 });
let bad = 0; const ok = (c, m) => { console.log(`  ${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) bad++; };
try {
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true; try{ if(!sessionStorage.__c){ localStorage.clear(); localStorage.setItem('byeot/save/1', ${JSON.stringify(SAVE)}); sessionStorage.__c='1'; } }catch(e){}` });
  await page.goto(`${BASE}/game.html`);
  await page.waitFor('!!window.__rv', 300000, 500); await sleep(5000);
  const J = async (js) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message, st:String(e.stack||'').slice(0,200)}); } })()`));
  const setup = await J(`(async()=>{ const pr=await import('/src/game/propagation.js'); const lp=await import('/src/game/loop.js');
    const S=window.__S(), io=window.__io; const p=S.pots[0];
    const nodes=io.growth.cuttableNodes(); const ls=io.growth.leafState()||[]; const vm=ls.filter(r=>r&&r.varie&&r.matured&&!r.dropped).length;
    /* ⚠ 판 세우기: 모주 자르기 문(무늬 다 자란 잎 ≥2)은 건너뛴다 — varieMaturedLeaves 를 안 넘기면 코어가 안 막는다(propagation 규약). 재는 것은 «삽수에서» 단추다 */
    const cand=nodes.filter(n=>n.leaves>=2 && !pr.cutBlockedReason(S,nodes,n.nodeId,{potId:p.id})).sort((a,b)=>a.leaves-b.leaves)[0];
    if(!cand) return {탈:'잎 둘 이상 실린 마디가 없다', nodes:nodes.map(n=>n.nodeId+':'+n.leaves)};
    S.shop.stock[pr.containerItemOf('soil')]=(S.shop.stock[pr.containerItemOf('soil')]||0)+1;
    const c=pr.takeCutting(S,{potId:p.id,nodes,nodeId:cand.nodeId,container:'soil',size:io.light.room.size,slots:io.light.room.slots,snapDist:0});
    const sl=io.light.room.slots.find(x=>x.slotId===${JSON.stringify(SLOT)});
    pr.setCuttingAt(S,c,{x:sl.x,y:sl.y,z:sl.z},{slots:io.light.room.slots,size:io.light.room.size,snapDist:0});
    let d=0; for(; d<40 && c.status!=='established'; d++) lp.nextDay(S,io);
    S.shop.stock[pr.containerItemOf('jar')]=(S.shop.stock[pr.containerItemOf('jar')]||0)+1;
    window.__redraw && window.__redraw();
    return { 마디:cand.nodeId, 잎:cand.leaves, 무늬:cand.variegatedLeaves, 삽수:c.id, 상태:c.status, 날:d, 자리:c.slotId, 잎장부:(c.leafVarie||[]).length,
             삽수마디:pr.cuttableNodesOfCutting(c).map(n=>n.nodeId+':'+n.leaves) }; })()`);
  console.log('세움 —', JSON.stringify(setup));
  ok(setup.상태 === 'established', `삽수가 자리를 잡았다(${setup.날}일)`);
  /* [식물] 장을 연다 — 손 그대로(탭 단추) */
  await J(`(()=>{ const b=[...document.querySelectorAll('button,[role=tab],.tab')].find(x=>/식물/.test(x.textContent||'')&&x.offsetParent); if(b) b.click(); return !!b; })()`);
  await sleep(800);
  const row = await J(`(()=>{ const bs=[...document.querySelectorAll('#cutList [data-cutfrom]')];
    return { 줄:[...document.querySelectorAll('#cutList .cutRow .nm')].map(x=>x.textContent.slice(0,60)), 단추:bs.map(b=>({cut:b.dataset.cutfrom,node:b.dataset.node,cont:b.dataset.cont,off:b.disabled,tip:b.title})) }; })()`);
  console.log('줄 —', JSON.stringify(row));
  const jar = (row.단추 || []).find(b => b.cut === setup.삽수 && b.cont === 'jar');
  ok(!!jar, '«✂ 이 삽수에서» 줄의 [병에] 단추가 섰다');
  ok(jar && !jar.off, `[병에]가 열렸다${jar && jar.off ? ' — 막은 말: ' + jar.tip : ''}`);
  ok(!(row.단추 || []).some(b => /아직 이릅니다/.test(b.tip || '')), '자르기 문(무늬 다 자란 잎)은 삽수에 안 걸린다');
  await page.shot(`${OUTDIR}/cutlist_before.png`);
  if (jar && !jar.off) {
    const n0 = await J(`window.__S().cuttings.length`);
    await J(`(()=>{ const b=document.querySelector('#cutList [data-cutfrom="${setup.삽수}"][data-node="${jar.node}"][data-cont="jar"]'); b.click(); return true; })()`);
    for (let i = 0; i < 30; i++) { await sleep(500); if ((await J(`window.__S().cuttings.length`)) > n0) break; }
    const after = await J(`(()=>{ const S=window.__S(); const n=S.cuttings[S.cuttings.length-1]; const ev=document.getElementById('event');
      return { 수:S.cuttings.length, 새:{ id:n.id, 용기:n.container, 상태:n.status, 모주:n.motherCuttingId||n.motherId||n.fromCuttingId||(n.mother&&n.mother.id)||null, 대:n.gen, 잎:(n.leafVarie||[]).length },
               배너: ev && ev.classList.contains('on') ? ev.textContent : null }; })()`);
    console.log('누른 뒤 —', JSON.stringify(after));
    ok(after.수 === n0 + 1, `삽수가 하나 늘었다(${n0} → ${after.수})`);
    ok(after.새 && after.새.용기 === 'jar', '새 삽수는 병에 담겼다');
    ok(typeof after.배너 === 'string' && /삽수에서 삽수를/.test(after.배너), `배너 — «${after.배너}»`);
    await page.shot(`${OUTDIR}/cutlist_after.png`);
  }
} finally { await page.close(); }
console.log(bad ? `probe_recut_button: FAIL (${bad})` : 'probe_recut_button: PASS');
process.exit(bad ? 1 : 0);
