/* tools/leaf/_shot_room_varie.mjs — [growth] probe_room_zoom_varie_skin.mjs 를 «폰 크기»로 돌리고 찍기를 더한 것 ([leaf])
   ⇒ core D4(f6f1fb02) 뒤 «방 = 확대»인가 + 폰(390×844)에서 방·확대가 어떻게 보이나
   OUTDIR= (필수 · 비어 있어야 한다) · DAYS= · BYEOT_URL= */
import fs from 'node:fs';
const OUTDIR = process.env.OUTDIR; if (!OUTDIR) { console.error('⛔ OUTDIR='); process.exit(2); }
fs.mkdirSync(OUTDIR, { recursive: true }); if (fs.readdirSync(OUTDIR).length) { console.error('⛔ 비어 있지 않다'); process.exit(2); }
import { launch, sleep } from '../test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:9340', DAYS = Number(process.env.DAYS || 260);
const page = await launch({ width: 390, height: 844, dpr: 2 });
/* ★ 열기를 «한 번»만 — 한 판에서 방(WebGL)을 두 번 세우면 둘째가 안 설 때가 있다(실측 10-08 · 300초에도 __rv 없음) */
await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__leafLog=[]; for(const k of ['warn','error']){ const o=console[k].bind(console); console[k]=(...a)=>{ try{ window.__leafLog.push(k+' | '+a.map(x=>(x&&x.message)?x.message:String(x)).join(' ').slice(0,180)); }catch(_){} o(...a); }; } addEventListener('error',e=>window.__leafLog.push('던짐 | '+(e.message||'')));` });
await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `try{ if(!sessionStorage.__leafCleared){ localStorage.clear(); sessionStorage.__leafCleared='1'; } }catch(e){}` });
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 300000, 500); await sleep(4500);
const J = async (js, ms = 600000) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message, st:(e.stack||'').slice(0,300)}); } })()`, true, ms));
console.log('세움 —', JSON.stringify(await J(`(async()=>{ const st=await import('/src/game/state.js'); const fp=await import('/src/game/first_play.js');
  const S=window.__S(); S.firstPlay.beansprout.harvestCount = fp.MONSTERA_ARRIVAL_RULE.harvestCount; S.firstPlay.beansprout.harvested = true;
  const a = st.givePlant(S, window.__io, { slotId:null }); fp.markMonsteraArrived(S.firstPlay, a);
  const p=(S.pots||[])[0]; const slots=window.__io.light.room.slots||[]; const slot=slots.find(x=>/sill/.test(x.slotId));
  st.setPotAt(S, p.id, { x:slot.x, y:slot.y, z:slot.z, slotId:slot.slotId }, { slots, size: window.__io.light.room.size });
  return { 자리:p.slotId, 보장:window.__io.growth.prologueVarie && window.__io.growth.prologueVarie().leafNos }; })()`)));
const run = await J(`(async()=>{ const st=await import('/src/game/state.js'); const lp=await import('/src/game/loop.js'); const sh=await import('/src/game/shop.js');
  const S=window.__S(), io=window.__io; let watered=0, errs=[];
  for (let d=0; d<${DAYS}; d++){
    try { st.waterPot(S); watered++; } catch(e) { if(errs.length<3) errs.push('물:'+e.message.slice(0,50)); }
    lp.runDays(S, io, 1, (t) => {
      try { const ls=io.growth.leafState(); const band=(t&&t.growthSpeed&&t.growthSpeed.band)||null;
            sh.assignPotLeafGrades(S, { leafState: ls, band });
            const w=document.getElementById('growth').contentWindow; const p0=(S.pots||[])[0];
            if (w && w.setLeafSkins && p0) w.setLeafSkins(Object.entries(sh.potLeafSkinsOf(S, p0)||{}).map(([lb,v])=>({leafBirth:+lb, ...v})));
      } catch(e) { if(errs.length<3) errs.push('등급:'+e.message.slice(0,60)); } });
  }
  const ls=io.growth.leafState()||[];
  return { 날:S.day||S.sim&&S.sim.day, 물:watered, errs, 잎:ls.length, 무늬:ls.filter(r=>r.varie).length, 갈라진무늬:ls.filter(r=>r.varie&&r.matured).length,
           등급:sh.potLeafGradesOf((S.pots||[])[0]) }; })()`, 1800000);
console.log('돌림 —', JSON.stringify(run));
await page.eval(`(()=>{ try { window.__redraw(); } catch(e) {} })()`, false); await sleep(6000);
const cmp = await J(`(async()=>{ const sh=await import('/src/game/shop.js'); const S=window.__S();
  const map=sh.potLeafSkinsOf(S,(S.pots||[])[0])||{};
  const z=window.__io.growth.leafSkinUsedAll(), r=window.__rv.leafSkinsInRoom();
  return { z, r, want: map }; })()`);
const room = new Map((cmp.r||[]).map(x=>[x.leafBirth,x])), zoom = new Map((cmp.z||[]).map(x=>[x.leafBirth,x]));
console.log('\n 잎      무늬  등급(값)    값이 고른 성숙그림   확대 열쇠          방 열쇠');
let diff=0, varieMat=0;
for (const [lb, zr] of [...zoom].sort((a,b)=>a[0]-b[0])) {
  const rr = room.get(lb), w = cmp.want[String(lb)];
  const mature = zr.key && /leaf_mat|leaf_mature/.test(zr.key);
  if (zr.varie && mature) varieMat++;
  const bad = rr ? (rr.key !== zr.key) : true; if (bad && zr.varie) diff++;
  console.log(`${String(lb).padStart(4)}   ${zr.varie?'무늬':'  - '}  ${String(w&&w.grade||'-').padEnd(10)}  ${String(w&&w.matSkin||'-').padEnd(18)}  ${String(zr.key).padEnd(18)} ${String(rr&&rr.key)} ${bad&&zr.varie?'⚠':''}`);
}
console.log(`\n⇒ 갈라진 무늬 잎 ${varieMat}장 · 무늬 잎 중 방≠확대 ${diff}장`);
/* ★ 찍기 — 방(폰) · 확대(폰) */
const quiet=async()=>{for(let k=0;k<4;k++){for(let i=0;i<40;i++){
  if(await page.eval(`String(document.getElementById('stage').classList.contains('talking'))`)!=='true')break;
  await page.eval(`(()=>{const x=document.getElementById('dlgBox'); if(x)x.click();})()`,false); await sleep(150);} await sleep(300);}};
await quiet();
await page.eval(`(()=>{const h=document.getElementById('hint'); if(h)h.classList.remove('on'); const d=document.getElementById('hintDim'); if(d)d.style.display='none';})()`,false);
await sleep(1500);
await page.shot(`${OUTDIR}/room_phone.png`);
console.log('방이 쥔 잎(전문):', await page.eval(`(()=>{try{return JSON.stringify(window.__rv.leafSkinsInRoom());}catch(e){return 'ERR '+e.message;}})()`));
/* ★ 화분에 카메라를 댄다 — 방 거리에서 작아 안 보이는 것과 «안 그려진 것»을 가른다 */
console.log('★ 콘솔(방·생장·조립):', await page.eval(`JSON.stringify((window.__leafLog||[]).filter(s=>/방뷰|생장|조립|plant|assemble|샘플|skin|GLB|무늬/i.test(s)).slice(0,12))`));
console.log('★ 콘솔 전체 수:', await page.eval(`String((window.__leafLog||[]).length)`));
console.log('붙음:', await page.eval(`(()=>{try{const p=(window.__S().pots||[])[0]; window.__rv.focusSlot(p.slotId,true); return 'ok '+p.slotId;}catch(e){return 'ERR '+e.message;}})()`));
for(let i=0;i<30;i++){ const b=await page.eval(`(()=>{try{return String(!!window.__rv.camBusy());}catch(e){return 'false';}})()`); if(b==='false') break; await sleep(300); }
await sleep(2500); await page.eval(`(()=>{try{window.__rv.redraw();}catch(e){}})()`,false); await sleep(800);
await page.shot(`${OUTDIR}/room_focus.png`);
/* ★ 카메라를 물리고·들고·돌려 본다 — 잎이 창 쪽으로 기울어 벽 뒤로 «가려진» 것인지 가른다 */
const cam0 = await page.eval(`(()=>{try{return JSON.stringify(window.__rv.camera());}catch(e){return 'ERR '+e.message;}})()`);
console.log('카메라:', String(cam0).slice(0,240));
const views = [['far', '{dist:3.6}'], ['top', '{dist:3.2, el:1.25}'], ['side', '{dist:3.0, az:(window.__rv.camera().az||0)+1.3, el:0.55}']];
for (const [nm, g] of views) {
  console.log('  '+nm+':', await page.eval(`(()=>{try{return JSON.stringify(window.__rv.camTo(${g}, 150));}catch(e){return 'ERR '+e.message;}})()`));
  for(let i=0;i<20;i++){ const b=await page.eval(`(()=>{try{return String(!!window.__rv.camBusy());}catch(e){return 'false';}})()`); if(b==='false') break; await sleep(250); }
  await sleep(1200); await page.eval(`(()=>{try{window.__rv.redraw();}catch(e){}})()`,false); await sleep(500);
  await page.shot(`${OUTDIR}/room_${nm}.png`);
}
const pos = await page.eval(`(()=>{try{const p=(window.__S().pots||[])[0]; return JSON.stringify(window.__rv.screenPosOf(p.slotId||p.at));}catch(e){return 'null';}})()`);
console.log('그루 화면 자리:', pos);
const z=await page.eval(`(()=>{try{const b=[...document.querySelectorAll('button')].find(x=>/확대|크게/.test(x.textContent||'')); if(b){b.click();return 'btn';} return 'none';}catch(e){return 'ERR';}})()`);
await sleep(9000);
await page.eval(`(()=>{for(const id of ['reliefBox','gameOver']){const e=document.getElementById(id); if(e)e.style.display='none';}})()`,false).catch(()=>{});
await page.shot(`${OUTDIR}/zoom_phone.png`); console.log('확대:', z);
await page.close();
