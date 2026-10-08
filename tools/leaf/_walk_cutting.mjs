/* tools/leaf/_walk_cutting.mjs — «무늬 마디를 잘라 병에 꽂으면, 병 속 잎이 모주의 그 잎과 같은 그림인가» ([leaf] 10-08 · 갈래 ②)
   판: SAVE(모주 = 무늬 그루) 로 켜고 → 시루를 방에 놓고(사람 일 · 세운 세이브가 안 놓음) · 유리병 재고 2(세운 손질 · 상점 배송 건너뜀)
       → [방] 장 삽수 상자 [병에](data-cut · data-cont=jar) — 게임 단추 길 → 가방의 삽수를 끌어 방에 놓는다(window.__drag)
   잰다: 자르기 전 모주 잎·장부 그림 · 자른 뒤 삽수 칸(leafVarie·leafGrade·source) · 방이 병에 넘기는 그림(game.html 과 같은 셈 leafSkinsFor(등급, S.sim.seed, 삽수id, i).midSkin)
         · 모주 장부가 그 잎에 적어 둔 그림(midSkin/matSkin) · 찍기(모주 전/후 · 병) · 하루 넘긴 뒤 · DUMP 로 다시 켜기 판
   DROP= 삽수를 놓을 자리(기본 banjiha-etagere:3) · NODE= 자를 마디(없으면 무늬 잎을 단 마디 중 첫째) · SAVE= (필수) · OUTDIR= (필수 · 비어 있어야) · DUMP= · BYEOT_URL=(기본 127.0.0.1:9340 · tools/serve.py) */
import fs from 'node:fs';
import { launch, sleep } from '../test_cdp.mjs';
const OUTDIR = process.env.OUTDIR, SAVEF = process.env.SAVE;
if (!OUTDIR || !SAVEF) { console.error('⛔ SAVE= OUTDIR='); process.exit(2); }
fs.mkdirSync(OUTDIR, { recursive: true }); if (fs.readdirSync(OUTDIR).length) { console.error('⛔ 비어 있지 않다'); process.exit(2); }
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9340';
const SAVE = fs.readFileSync(SAVEF, 'utf8');
const page = await launch({ width: 390, height: 844, dpr: 1 });
await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true; window.__leafLog=[]; for(const k of ['warn','error']){ const o=console[k].bind(console); console[k]=(...a)=>{ try{ window.__leafLog.push(k+' | '+a.map(x=>(x&&x.message)?(x.message+' @@ '+String(x.stack||'').split(String.fromCharCode(10)).slice(1,5).map(l=>l.trim().split('/').slice(-1)[0]).join(' <- ')):String(x)).join(' ').slice(0,600)); }catch(_){} o(...a); }; } try{ if(!sessionStorage.__c){ localStorage.clear(); localStorage.setItem('byeot/save/1', ${JSON.stringify(SAVE)}); sessionStorage.__c='1'; } }catch(e){}` });
await page.goto(`${BASE}/game.html`);
{ let ok = false; for (let i = 0; i < 100; i++) { await sleep(3000); if (await page.eval('String(!!window.__rv)') === 'true') { ok = true; console.log('켜짐', i * 3 + 3, '초'); break; } }
  if (!ok) { console.error('⛔ 안 섬'); await page.close(); process.exit(4); } }
await sleep(6000);
const J = async (js, ms = 120000) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message, st:(e.stack||'').slice(0,240)}); } })()`, true, ms));
const clear = async () => { for (let i = 0; i < 40; i++) {
  const b = await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');return String(!!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on')));})()`);
  if (b !== 'true') return;
  await page.eval(`(()=>{const g=document.getElementById('guideClose'); if(g&&g.offsetParent){g.click();return;} const b=document.getElementById('dlgBox'); if(b)b.click();})()`, false); await sleep(250); } };
await clear();
/* 세운 손질: 시루를 방에 놓는다(첫 플레이는 그대로) · 유리병 재고 · 체력 */
console.log('손질 —', JSON.stringify(await J(`(async()=>{ const st=await import('/src/game/state.js'); const S=window.__S(), io=window.__io;
  const slots=io.light.room.slots||[]; const used=new Set((S.pots||[]).map(p=>p.slotId));
  const s=slots.find(x=>!used.has(x.slotId) && !/sill/.test(x.slotId) && /desk|shelf|dresser|night/.test(x.slotId)) || slots.find(x=>!used.has(x.slotId));
  let r=null; try { r=st.setCropAt(S, { x:s.x, y:s.y, z:s.z, slotId:s.slotId }, { slots, size: io.light.room.size }); } catch(e) { r={탈:e.message}; }
  S.shop.stock.jar=(S.shop.stock.jar||0)+2; if(S.stamina) S.stamina.usedToday=0; try{window.__redraw()}catch(e){}
  return { 시루:s&&s.slotId, r:r&&(r.slotId||r.탈), 병:S.shop.stock.jar }; })()`)));
const mother = async () => J(`(async()=>{ const sh=await import('/src/game/shop.js'); const S=window.__S(), io=window.__io; const p=S.pots[0];
  const sk=sh.potLeafSkinsOf(S,p)||{};
  return { 잎:(io.growth.leafState()||[]).map(r=>r.leafBirth+(r.varie?'*':'')), 장부그림:Object.fromEntries(Object.entries(sk).map(([k,v])=>[k,(v.grade||'')+':'+(v.midSkin||'-')+'/'+(v.matSkin||'-')])),
    방잎:(()=>{ try { return (window.__rv.leafSkinsInRoom()||[]).map(x=>x.leafBirth+':'+x.key); } catch(e) { return null; } })() }; })()`);
const shoot = async (target, file, dist = 1.6) => {
  await page.eval(`(()=>{try{ window.__rv.focusSlot(${JSON.stringify(target)},true);}catch(e){}})()`, false);
  for (let i = 0; i < 30; i++) { if (await page.eval(`(()=>{try{return String(!!window.__rv.camBusy());}catch(e){return 'false';}})()`) === 'false') break; await sleep(300); }
  await page.eval(`(()=>{try{window.__rv.camTo({dist:${dist}, el:0.45}, 150);}catch(e){}})()`, false);
  for (let i = 0; i < 20; i++) { if (await page.eval(`(()=>{try{return String(!!window.__rv.camBusy());}catch(e){return 'false';}})()`) === 'false') break; await sleep(250); }
  await sleep(1500); await page.eval(`(()=>{try{window.__rv.redraw();}catch(e){}})()`, false); await sleep(500);
  await page.shot(file);
};
console.log('모주(자르기 전) —', JSON.stringify(await mother()));
await shoot('banjiha-sill:0', `${OUTDIR}/mother_0_before.png`, 2.2);
/* 자를 마디 — 생장 창이 내는 표와 화면의 단추 */
await page.eval(`(()=>{ window.__byeotSheet.open(); window.__byeotSheet.tab('room'); })()`, false); await sleep(900);
const nodes = await J(`(async()=>{ const io=window.__io; let cn=null; try { cn=io.growth.cuttableNodes(); } catch(e) { cn='ERR '+e.message; }
  const btns=[...document.querySelectorAll('#cutNodes [data-cut]')].map(x=>({node:x.dataset.cut, cont:x.dataset.cont, off:x.disabled, row:(x.closest('.cutRow')||{}).innerText?(x.closest('.cutRow').innerText.replace(/\\s+/g,' ').slice(0,80)):''}));
  return { 마디:Array.isArray(cn)?cn.map(n=>({id:n.nodeId||n.id, 잎:(n.leaves||n.leafBirths||[]).map?((n.leaves||n.leafBirths||[]).map(l=>l.leafBirth??l)):n.leaves, 무늬:n.variegatedLeaves??n.varie})):cn, 단추:btns, 안내:(document.getElementById('cutHint')||{}).textContent||'' }; })()`);
console.log('자를 마디 —', JSON.stringify(nodes));
let pick = process.env.NODE || null;
if (!pick && Array.isArray(nodes.단추)) {
  /* 무늬 잎을 단 마디 중 잎이 제일 적은 것(병은 잎 0~1장을 받는다) — 그 잎 하나가 모주의 어느 잎인지 견주기 쉽다 */
  const info = new Map((Array.isArray(nodes.마디) ? nodes.마디 : []).map(n => [n.id, n]));
  const open = nodes.단추.filter(x => x.cont === 'jar' && !x.off);
  console.log('열린 [병에] —', JSON.stringify(open.map(x => ({ node: x.node, 잎: info.get(x.node)?.잎, 무늬: info.get(x.node)?.무늬 }))));
  const varie = open.filter(x => (info.get(x.node)?.무늬 || 0) > 0).sort((a, b) => (info.get(a.node)?.잎 || 9) - (info.get(b.node)?.잎 || 9));
  const b = varie[0] || open[0]; pick = b && b.node; }
console.log('자를 것 —', pick);
if (!pick) { console.log('⛔ 자를 단추 없음'); await page.close(); process.exit(5); }
await page.eval(`(()=>{ window.__byeotSheet.close(); const b=[...document.querySelectorAll('#cutNodes [data-cut]')].find(x=>x.dataset.cut===${JSON.stringify(pick)} && x.dataset.cont==='jar'); if(b){ b.disabled=false; b.click(); } })()`, false);
for (let i = 0; i < 40; i++) { await sleep(500); if (await page.eval(`String((window.__S().cuttings||[]).length>0)`) === 'true') break; }
await sleep(2500); await clear();
const cut = await J(`(async()=>{ const sh=await import('/src/game/shop.js'); const S=window.__S(); const c=(S.cuttings||[])[0]; if(!c) return {없음:true};
  const seed=(S.sim&&S.sim.seed)||0; const v=c.leafVarie||[], g=c.leafGrade||[];
  return { id:c.id, 병:c.container, 상태:c.status, 마디:c.source&&c.source.nodeId, 원잎:c.source&&c.source.leaves, 원무늬:c.source&&c.source.variegatedLeaves,
    잎무늬:v, 잎등급:g, motherSeed:c.source&&c.source.motherSeed, simSeed:seed,
    병그림:v.map((x,i)=>(!x||!g[i])?null:((sh.leafSkinsFor(g[i],seed,c.id,i)||{}).midSkin||null)) }; })()`);
console.log('\n■ 자른 뒤 삽수 —', JSON.stringify(cut));
console.log('  모주(자른 뒤) —', JSON.stringify(await mother()));
await shoot('banjiha-sill:0', `${OUTDIR}/mother_1_after.png`, 2.2);
/* 가방 → 방 — 끌어다 놓기(probe_cutting_ui 와 같은 걸음) */
/* 놓을 자리를 먼저 화면에 잡는다 — 카메라가 창턱에 붙어 있으면 그 자리가 화면 밖이라 끌어 놓기가 빗나간다(10-08 한 번) */
const DROP = process.env.DROP || 'banjiha-etagere:3';
await page.eval(`(()=>{try{ window.__rv.focusSlot(${JSON.stringify(DROP)},true);}catch(e){}})()`, false);
for (let i = 0; i < 30; i++) { if (await page.eval(`(()=>{try{return String(!!window.__rv.camBusy());}catch(e){return 'false';}})()`) === 'false') break; await sleep(300); }
await page.eval(`(()=>{try{window.__rv.camTo({dist:2.4, el:0.6}, 150);}catch(e){}})()`, false); await sleep(2500);
await page.eval(`(()=>{ window.__byeotSheet.open('bag'); })()`, false); await sleep(800);
const dropped = await page.eval(`(()=>{ const rv=window.__rv, c=document.getElementById('roomCanvas').getBoundingClientRect();
  const el=document.querySelector('.bagslot[data-place^="cutting:"]'); if(!el) return 'no-cell';
  const sp=rv.screenPosOf(${JSON.stringify(DROP)}); if(!sp) return 'no-slot';
  const img=el.querySelector('img'); const b=img.getBoundingClientRect();
  window.__drag.begin(el.dataset.place, img.src, {clientX:b.left+b.width/2, clientY:b.top+b.height/2});
  window.__drag.move({clientX:c.left+sp.x, clientY:c.top+sp.y}); window.__drag.end(); return 'dropped @'+Math.round(sp.x)+','+Math.round(sp.y); })()`);
await sleep(1800); await clear(); await page.eval(`(()=>{ try{window.__byeotSheet.close()}catch(e){} })()`, false); await sleep(800);
const placed = await J(`(async()=>{ const S=window.__S(); const c=(S.cuttings||[])[0]; return { drop:${JSON.stringify(dropped)}, 자리:c&&(c.slotId||(c.at?('at '+c.at.x.toFixed(2)+','+c.at.z.toFixed(2)):null)), 방:(window.__rv.plants()||[]).filter(r=>r.potId===(c&&c.id)).map(r=>r.kind) }; })()`);
console.log('놓기 —', JSON.stringify(placed));
const cutTarget = await page.eval(`(()=>{ const c=(window.__S().cuttings||[])[0]; return JSON.stringify(c ? (c.slotId || c.at) : null); })()`);
await shoot(JSON.parse(cutTarget), `${OUTDIR}/jar_0_placed.png`, Number(process.env.JARDIST || 1.4));
/* 하루 넘김 — 게임 단추 */
{ const day0 = Number(await page.eval(`String(window.__S().day)`));
  await page.eval(`(()=>{const b=document.getElementById('next'); if(b) b.click();})()`, false);
  for (let i = 0; i < 60; i++) { await sleep(500); if (Number(await page.eval(`String(window.__S().day)`)) > day0) break;
    await page.eval(`(()=>{const g=document.getElementById('mealGo'); if(g && g.offsetParent) g.click();})()`, false); }
  await sleep(2500); await clear();
  await page.eval(`(()=>{ for (const b of document.querySelectorAll('button')) { const t=(b.textContent||'').trim(); if (b.offsetParent && /^(고맙습니다|확인|닫기)$/.test(t)) b.click(); } })()`, false); await sleep(800); await clear(); }
console.log('\n■ 하루 뒤 삽수 —', JSON.stringify(await J(`(async()=>{ const sh=await import('/src/game/shop.js'); const S=window.__S(); const c=(S.cuttings||[])[0]; if(!c) return {없음:true};
  const seed=(S.sim&&S.sim.seed)||0; const v=c.leafVarie||[], g=c.leafGrade||[];
  return { 날:S.day, 상태:c.status, 잎무늬:v, 잎등급:g, 병그림:v.map((x,i)=>(!x||!g[i])?null:((sh.leafSkinsFor(g[i],seed,c.id,i)||{}).midSkin||null)) }; })()`)));
await shoot(JSON.parse(cutTarget), `${OUTDIR}/jar_1_nextday.png`, Number(process.env.JARDIST || 1.4));
if (process.env.DUMP) { const raw = await J(`(async()=>{ const sv=await import('/src/game/save.js'); const S=window.__S();
    const r=sv.saveTo(localStorage, sv.SAVE_KEY, S); return { ok:r.ok, text: localStorage.getItem(sv.SAVE_KEY) }; })()`);
  if (raw.ok && raw.text) { fs.writeFileSync(process.env.DUMP, raw.text); console.log('★ 세이브:', process.env.DUMP, raw.text.length); } else console.log('⛔ 세이브 실패'); }
console.log('\n콘솔 경고:', await page.eval(`JSON.stringify((window.__leafLog||[]).slice(-8))`));
await page.close();
