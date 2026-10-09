/* tools/probe_bag_cutting.mjs — **가방 속 삽수는 하루가 안 가고, 놓으면 간다** (2026-10-09 · core · D29 총괄 11:35)
   ------------------------------------------------------------
   판 세우기(값 0): SAVE(모주가 선 판 · leaf `_make_oneroom_save NOMOVE=1`)로 켜고 → 모주에서 잎 1장 마디를 «병에»(takeCutting ·
     게임 [병에]와 같은 부름 · 자리 없이 = 가방으로 · ⚠ 모주 자르기 문은 건너뜀 — 세이브의 다 자란 무늬 잎이 1장이라).
   잰다(화면 손 그대로):
     ① 게임 [다음 날] 두 번 — 가방 속 삽수의 날(days)이 «그대로» · 가방 줄 «가방 안 삽수는 자라지 않습니다» · turn.bagCuttings = 1
     ② 가방의 그 삽수 칸을 «누르면» 방에 선다(startPhonePlaceCut) → [다음 날] 두 번 — 날이 «오른다» · turn.bagCuttings = 0
   SAVE= (필수) · OUTDIR= (필수 · 비어 있어야) · BYEOT_URL=(기본 127.0.0.1:9300) */
import fs from 'node:fs';
import { launch, sleep } from './test_cdp.mjs';
const OUTDIR = process.env.OUTDIR, SAVEF = process.env.SAVE;
if (!OUTDIR || !SAVEF) { console.error('⛔ SAVE= OUTDIR='); process.exit(2); }
fs.mkdirSync(OUTDIR, { recursive: true }); if (fs.readdirSync(OUTDIR).length) { console.error('⛔ OUTDIR 가 비어 있지 않다'); process.exit(2); }
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9300';
const SAVE = fs.readFileSync(SAVEF, 'utf8');
const page = await launch({ width: 390, height: 844, dpr: 1 });
let bad = 0; const ok = (c, m) => { console.log(`  ${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) bad++; };
try {
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true; try{ if(!sessionStorage.__c){ localStorage.clear(); localStorage.setItem('byeot/save/1', ${JSON.stringify(SAVE)}); sessionStorage.__c='1'; } }catch(e){}` });
  await page.goto(`${BASE}/game.html`);
  await page.waitFor('!!window.__rv', 300000, 500); await sleep(5000);
  const J = async (js) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`));
  const clear = async () => { for (let i = 0; i < 40; i++) {
    const b = await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');return String(!!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on')));})()`);
    if (b !== 'true') return;
    await page.eval(`(()=>{const g=document.getElementById('guideClose'); if(g&&g.offsetParent){g.click();return;} const b=document.getElementById('dlgBox'); if(b)b.click();})()`, false); await sleep(250); } };
  const nextDay = async () => {
    const d0 = Number(await page.eval(`String(window.__S().day)`));
    await page.eval(`(()=>{const b=document.getElementById('next'); if(b) b.click();})()`, false);
    for (let i = 0; i < 60; i++) { await sleep(500);
      if (Number(await page.eval(`String(window.__S().day)`)) > d0) break;
      await page.eval(`(()=>{const g=document.getElementById('mealGo'); if(g && g.offsetParent) g.click();})()`, false); }
    await sleep(1500); await clear();
  };
  await clear();
  /* 판 세우기 — 가방의 시루를 놓아 [다음 날] 문을 연다 · 병 삽수 하나를 자리 없이(가방으로) */
  const setup = await J(`(async()=>{ const st=await import('/src/game/state.js'); const pr=await import('/src/game/propagation.js');
    const S=window.__S(), io=window.__io; const d0=io.light.room.slots.find(x=>x.slotId==='banjiha-desk:0');
    try { st.placeSiru(S, {x:d0.x,y:d0.y,z:d0.z,slotId:d0.slotId}, {slots:io.light.room.slots,size:io.light.room.size,snapDist:0,kind:'beansprout',sow:false}); } catch(e){}
    const nodes=io.growth.cuttableNodes(); const n=nodes.find(x=>x.leaves===1 && x.stem!=='petiole' && !pr.cutBlockedReason(S,nodes,x.nodeId,{potId:S.pots[0].id}));
    if(!n) return {탈:'잎 1장 마디가 없다'};
    S.shop.stock[pr.containerItemOf('jar')]=(S.shop.stock[pr.containerItemOf('jar')]||0)+1;
    const c=pr.takeCutting(S,{potId:S.pots[0].id,nodes,nodeId:n.nodeId,container:'jar',size:io.light.room.size,slots:io.light.room.slots,snapDist:0});
    window.__redraw(); return { id:c.id, status:c.status, days:c.days, at:c.at, slotId:c.slotId }; })()`);
  console.log('세움 —', JSON.stringify(setup));
  ok(setup.id && !setup.at && !setup.slotId, '병 삽수가 가방에 있다(자리 없음)');
  const cutNow = () => J(`(()=>{ const S=window.__S(); const c=S.cuttings.find(x=>x.id==='${setup.id}'); return { day:S.day, days:c.days, status:c.status, slotId:c.slotId, at:!!c.at }; })()`);
  const b0 = await cutNow();
  await nextDay(); await nextDay();
  const b1 = await cutNow();
  const bagLine = await J(`(()=>{ window.__byeotSheet.open('bag'); return [...document.querySelectorAll('#bagGrid .bagmore')].map(x=>x.textContent).join(' | '); })()`);
  const bagN = await J(`(window.__lastTurnForProbe && window.__lastTurnForProbe().bagCuttings) ?? null`);
  console.log('가방에서 이틀 —', JSON.stringify({ b0, b1, bagLine }));
  ok(b1.day === b0.day + 2, `이틀이 갔다(${b0.day} → ${b1.day})`);
  ok(b1.days === b0.days, `가방 속 삽수의 날은 그대로(${b0.days} → ${b1.days})`);
  ok(/가방 안 삽수는 자라지 않습니다/.test(bagLine), `가방 줄 — «${bagLine}»`);
  await page.shot(`${OUTDIR}/bag_paused.png`);
  /* ② 가방 칸을 눌러 방에 놓는다 */
  const placed = await J(`(async()=>{ const el=document.getElementById('cutThumb_' + '${setup.id}'.replace(/[^\\w]/g,'_')); if(!el) return {탈:'가방 칸이 없다'};
    el.click(); await new Promise(r=>setTimeout(r,800));
    const S=window.__S(); const c=S.cuttings.find(x=>x.id==='${setup.id}'); return { slotId:c.slotId, at:!!c.at }; })()`);
  console.log('놓음 —', JSON.stringify(placed));
  /* 확인 바가 섰으면 [확인] */
  await J(`(()=>{ const b=document.getElementById('placeOk'); if(b && document.getElementById('stage').classList.contains('confirming')) b.click(); return 1; })()`);
  await sleep(600); await clear();
  const p0 = await cutNow();
  ok(!!(p0.slotId || p0.at), '가방 칸을 누르니 방에 섰다');
  await nextDay(); await nextDay();
  const p1 = await cutNow();
  console.log('놓은 뒤 이틀 —', JSON.stringify({ p0, p1 }));
  ok(p1.days === p0.days + 2, `놓은 뒤엔 날이 오른다(${p0.days} → ${p1.days})`);
  await page.shot(`${OUTDIR}/placed.png`);
} finally { await page.close(); }
console.log(bad ? `probe_bag_cutting: FAIL (${bad})` : 'probe_bag_cutting: PASS');
process.exit(bad ? 1 : 0);
