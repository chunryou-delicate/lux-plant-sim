/* tools/leaf/_check_reload_gate.mjs — «세이브로 켠 직후 [다음 날]이 열려 있나 · 첫 화분이 제 생장일로 그려지나» ([leaf] 10-08)
   _walk_twopots DUMP= 로 뜬 «씨앗을 심은 뒤» 세이브를 넣고 켠다. 화면 손질 0 — 켜고 재고 찍기만.
   SAVE= (필수) · OUTDIR= (필수 · 비어 있어야) · BYEOT_URL=(기본 127.0.0.1:9340 · 서버는 tools/serve.py) */
import fs from 'node:fs';
import { launch, sleep } from '../test_cdp.mjs';
const OUTDIR = process.env.OUTDIR, SAVEF = process.env.SAVE;
if (!OUTDIR || !SAVEF) { console.error('⛔ SAVE= OUTDIR='); process.exit(2); }
fs.mkdirSync(OUTDIR, { recursive: true }); if (fs.readdirSync(OUTDIR).length) { console.error('⛔ 비어 있지 않다'); process.exit(2); }
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9340';
const SAVE = fs.readFileSync(SAVEF, 'utf8');
const page = await launch({ width: 390, height: 844, dpr: 1 });
await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__leafLog=[]; for(const k of ['warn','error']){ const o=console[k].bind(console); console[k]=(...a)=>{ try{ window.__leafLog.push(k+' | '+a.map(x=>(x&&x.message)?(x.message+' @@ '+String(x.stack||'').split(String.fromCharCode(10)).slice(1,5).map(l=>l.trim().split('/').slice(-1)[0]).join(' <- ')):String(x)).join(' ').slice(0,600)); }catch(_){} o(...a); }; } try{ if(!sessionStorage.__c){ localStorage.clear(); localStorage.setItem('byeot/save/1', ${JSON.stringify(SAVE)}); sessionStorage.__c='1'; } }catch(e){}` });
await page.goto(`${BASE}/game.html`);
{ let ok = false; for (let i = 0; i < 100; i++) { await sleep(3000); if (await page.eval('String(!!window.__rv)') === 'true') { ok = true; console.log('켜짐', i * 3 + 3, '초'); break; } }
  if (!ok) { console.error('⛔ 안 섬'); await page.close(); process.exit(4); } }
await sleep(8000);
const J = async (js) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, 60000));
console.log('켠 뒤 —', JSON.stringify(await J(`(async()=>{ const S=window.__S(), io=window.__io; const n=document.getElementById('next');
  return { 날:S.day, next잠김:!!(n&&n.disabled), hardLock:document.body.dataset.hardLock||null, 꽂힌그루:io.growth.current&&io.growth.current(),
    화분:S.pots.map(p=>({id:p.id, gid:p.growthId||'__main__', 장부:Object.keys(p.leafGrades||{})})),
    첫화분읽기:(()=>{ try { const st=io.growth.leafStats&&io.growth.leafStats(); const cn=io.growth.cuttableNodes&&io.growth.cuttableNodes(); return { 잎:st&&st.leaves, 무늬:st&&st.variegatedLeaves, 자를마디:Array.isArray(cn)?cn.length:(cn&&cn.nodes?cn.nodes.length:null) }; } catch(e) { return 'ERR '+e.message; } })(),
    방:(window.__rv.plants()||[]).filter(r=>r.kind==='monstera'||r.kind==='emptypot').map(r=>({potId:r.potId, kind:r.kind, 생장일:r.growthDays})),
    기록:(S.log||[]).slice(-3).map(x=>String(typeof x==='string'?x:(x&&(x.msg||x.text||x.ko))||JSON.stringify(x)).slice(0,120)) }; })()`)));
await page.eval(`(()=>{try{const p=window.__S().pots[0]; window.__rv.focusSlot(p.slotId||p.at,true);}catch(e){}})()`, false);
for (let i = 0; i < 30; i++) { if (await page.eval(`(()=>{try{return String(!!window.__rv.camBusy());}catch(e){return 'false';}})()`) === 'false') break; await sleep(300); }
await page.eval(`(()=>{try{window.__rv.camTo({dist:3.0, el:0.55}, 150);}catch(e){}})()`, false);
for (let i = 0; i < 20; i++) { if (await page.eval(`(()=>{try{return String(!!window.__rv.camBusy());}catch(e){return 'false';}})()`) === 'false') break; await sleep(250); }
await sleep(1500); await page.eval(`(()=>{try{window.__rv.redraw();}catch(e){}})()`, false); await sleep(500);
await page.shot(`${OUTDIR}/room_pot0_reload.png`);
/* ZOOM=1 — 확대창을 열어(__byeotZoom.open) 무엇이 뜨나 · 찍기. 화분이 없는 판이면 «빈» 것이 맞다 */
if (process.env.ZOOM === '1') {
  const o = await J(`(async()=>{ try { const z=window.__byeotZoom; return { 열기:String(z.open()), 열림:!!(z.isOpen&&z.isOpen()) }; } catch(e) { return {탈:e.message}; } })()`);
  await sleep(8000);
  console.log('확대 —', JSON.stringify(o), JSON.stringify(await J(`(async()=>{ const io=window.__io; return { 꽂힌:io.growth.current&&io.growth.current(), 그루들:io.growth.plantIds&&io.growth.plantIds(), 잎:(io.growth.leafSkinUsedAll()||[]).map(x=>x.leafBirth+':'+x.key) }; })()`)));
  await page.shot(`${OUTDIR}/zoom_reload.png`);
  await page.eval(`(()=>{try{window.__byeotZoom.close()}catch(e){}})()`, false); await sleep(1200);
}
/* NEXT=1 — 게임 단추로 하루 넘기고 기록 끝 줄을 본다(시루를 방에 놓는다 — 세운 세이브가 안 놓음 · 첫 플레이는 그대로) */
if (process.env.NEXT === '1') {
/* ★ 세운 손질: 첫 플레이를 끄지 «않는다» — 끄면 윗줄(drawJourney)이 멈춘다(10-08 헛것 한 번). 대신 시루를 방에 놓는다(Day 0 에 사람이 하는 일 · 세운 세이브가 안 놓았다) */
console.log('시루 놓기 —', JSON.stringify(await J(`(async()=>{ const st=await import('/src/game/state.js'); const S=window.__S(), io=window.__io;
  if (S.firstPlay && S.firstPlay.monstera) S.firstPlay.monstera.arrived = true;
  const slots=io.light.room.slots||[]; const used=new Set((S.pots||[]).map(p=>p.slotId));
  const s=slots.find(x=>!used.has(x.slotId) && !/sill/.test(x.slotId) && /desk|shelf|dresser|night/.test(x.slotId)) || slots.find(x=>!used.has(x.slotId));
  let r=null; try { r=st.setCropAt(S, { x:s.x, y:s.y, z:s.z, slotId:s.slotId }, { slots, size: io.light.room.size }); } catch(e) { r={탈:e.message}; }
  try { window.__redraw(); } catch(e) {}
  return { 시루자리:s&&s.slotId, r:r&&(r.slotId||r.탈) }; })()`)));

  const day0 = Number(await page.eval(`String(window.__S().day)`));
  await page.eval(`(()=>{const b=document.getElementById('next'); if(b) b.click();})()`, false);
  for (let i = 0; i < 60; i++) { await sleep(500); if (Number(await page.eval(`String(window.__S().day)`)) > day0) break;
    await page.eval(`(()=>{const g=document.getElementById('mealGo'); if(g && g.offsetParent) g.click();})()`, false); }
  await sleep(3000);
  /* 대사가 떴나 — 떴으면 첫 줄들을 넘기며 적는다(무늬 알림이 장면까지 다시 트나) */
  const lines = [];
  for (let i = 0; i < 14; i++) {
    const t = await page.eval(`(()=>{const s=document.getElementById('stage'); if(!(s&&s.classList.contains('talking'))) return ''; const b=document.getElementById('dlgBox'); return (b&&b.innerText||'').replace(/\s+/g,' ').trim().slice(0,90);})()`);
    if (!t) break; if (lines[lines.length - 1] !== t) lines.push(t);
    await page.eval(`(()=>{const b=document.getElementById('dlgBox'); if(b) b.click();})()`, false); await sleep(400); }
  console.log('대사 —', lines.length ? JSON.stringify(lines) : '(없음)');
  console.log('하루 넘긴 뒤 —', JSON.stringify(await J(`(async()=>{ const S=window.__S(); return { 날:S.day, 말한잎:S._varieLuckySaid||null,
    기록:(S.log||[]).filter(x=>x&&x.day>=${day0}).map(x=>String(x.msg||x).slice(0,90)) }; })()`)));
}
console.log('콘솔:', await page.eval(`JSON.stringify((window.__leafLog||[]).slice(-6))`));
await page.close();
