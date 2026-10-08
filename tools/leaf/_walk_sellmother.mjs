/* tools/leaf/_walk_sellmother.mjs — «모주를 판 뒤 방·확대창이 비나» ([leaf] 10-08 · 갈래 ③)
   판: SAVE(화분 하나 = 모주) 로 켜고 → 게임 단추 길로 판다: [몬스테라 내놓기](#sellPlant · 되묻기라 두 번) → 연락 → [상점] 중고 칸 [거래하기](data-deal = doDeal)
   세운 손질 둘: 시루를 방에 놓음(세운 세이브가 안 놓음 · 첫 플레이는 그대로) · 연락이 «오늘» 온 것으로 둔다(listing.contactOnDay/status — 며칠 기다리기를 건너뜀). 값 0.
   잰다: 판 직후 · __redraw 뒤 · 하루 넘긴 뒤 — S.pots · 방에 선 그루(rv.plants) · 방이 쥔 잎(leafSkinsInRoom: 없으면 null 이어야) ·
         생장 창 그루(plantIds·current) · [식물] 장 글 · 확대창을 열면 무엇이 뜨나(__byeotZoom.open) · 찍기
   SAVE= (필수) · OUTDIR= (필수 · 비어 있어야) · DUMP=(판 뒤 세이브) · BYEOT_URL=(기본 127.0.0.1:9340 · 서버는 tools/serve.py) */
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
/* 막는 창(긴급자금 등) — 단추 글로 찾아 닫는다 */
const closeModals = async () => page.eval(`(()=>{ const out=[]; for (const b of document.querySelectorAll('button')) { const t=(b.textContent||'').trim();
  if (b.offsetParent && /^(고맙습니다|확인|닫기)$/.test(t)) { b.click(); out.push(t); } } return out.join(','); })()`);
await clear();
const snap = async () => J(`(async()=>{ const S=window.__S(), io=window.__io; const n=document.getElementById('next');
  let rs=null; try { rs=window.__rv.leafSkinsInRoom(); } catch(e) { rs='ERR '+e.message; }
  return { 날:S.day, 화분:(S.pots||[]).map(p=>p.id), 삽수:(S.cuttings||[]).length, 시루:(S.crops||[]).length,
    방:(window.__rv.plants()||[]).map(r=>({potId:r.potId, kind:r.kind, 생장일:r.growthDays})),
    방잎:rs===null?null:(Array.isArray(rs)?rs.map(x=>x.leafBirth+':'+x.key):rs),
    생장창:{ 그루들:io.growth.plantIds&&io.growth.plantIds(), 꽂힌:io.growth.current&&io.growth.current(), 잎:(io.growth.leafState()||[]).length },
    거래:((S.shop&&S.shop.listings)||[]).map(l=>({id:l.listingId, st:l.status})),
    next잠김:!!(n&&n.disabled), hardLock:document.body.dataset.hardLock||null,
    돈:S.tutorial&&S.tutorial.cashWon }; })()`);
const shootSill = async (file) => {
  await page.eval(`(()=>{try{ window.__rv.focusSlot('banjiha-sill:0',true);}catch(e){}})()`, false);
  for (let i = 0; i < 30; i++) { if (await page.eval(`(()=>{try{return String(!!window.__rv.camBusy());}catch(e){return 'false';}})()`) === 'false') break; await sleep(300); }
  await page.eval(`(()=>{try{window.__rv.camTo({dist:3.0, el:0.55}, 150);}catch(e){}})()`, false);
  for (let i = 0; i < 20; i++) { if (await page.eval(`(()=>{try{return String(!!window.__rv.camBusy());}catch(e){return 'false';}})()`) === 'false') break; await sleep(250); }
  await sleep(1500); await page.eval(`(()=>{try{window.__rv.redraw();}catch(e){}})()`, false); await sleep(500);
  await page.shot(file);
};
const plantsSheet = async () => { await page.eval(`window.__byeotSheet.open('plants')`, false); await sleep(800);
  const t = await page.eval(`(()=>{ const el=document.getElementById('pagePlants'); return el ? (el.innerText||'').replace(/\\s+/g,' ').trim().slice(0,220) : null; })()`);
  await page.eval(`(()=>{try{window.__byeotSheet.close()}catch(e){}})()`, false); await sleep(500); return t; };
const zoomTry = async (file) => {
  const r = await J(`(async()=>{ try { const z=window.__byeotZoom; if(!z||!z.open) return {창구:false}; const o=z.open(); return { 열기:String(o), 열림:!!(z.isOpen&&z.isOpen()) }; } catch(e) { return {탈:e.message}; } })()`);
  await sleep(8000); await clear();
  const z = await J(`(async()=>{ const io=window.__io; return { 꽂힌:io.growth.current&&io.growth.current(), 확대잎:(io.growth.leafSkinUsedAll()||[]).map(x=>x.leafBirth+':'+x.key) }; })()`);
  await page.shot(file);
  await page.eval(`(()=>{try{window.__byeotZoom.close()}catch(e){}})()`, false); await sleep(1500);
  return { ...r, ...z };
};

/* 세운 손질 둘째: 첫 플레이를 «끝난 것»으로 둔다 — 세운 세이브는 시루를 안 놓아 [다음 날]이 «시루를 먼저»로 막힌다(260일 판이면 실제로는 끝났을 때) */
/* ★ 세운 손질: 첫 플레이를 끄지 «않는다» — 끄면 윗줄(drawJourney)이 멈춘다(10-08 헛것 한 번). 대신 시루를 방에 놓는다(Day 0 에 사람이 하는 일 · 세운 세이브가 안 놓았다) */
console.log('시루 놓기 —', JSON.stringify(await J(`(async()=>{ const st=await import('/src/game/state.js'); const S=window.__S(), io=window.__io;
  if (S.firstPlay && S.firstPlay.monstera) S.firstPlay.monstera.arrived = true;
  const slots=io.light.room.slots||[]; const used=new Set((S.pots||[]).map(p=>p.slotId));
  const s=slots.find(x=>!used.has(x.slotId) && !/sill/.test(x.slotId) && /desk|shelf|dresser|night/.test(x.slotId)) || slots.find(x=>!used.has(x.slotId));
  let r=null; try { r=st.setCropAt(S, { x:s.x, y:s.y, z:s.z, slotId:s.slotId }, { slots, size: io.light.room.size }); } catch(e) { r={탈:e.message}; }
  try { window.__redraw(); } catch(e) {}
  return { 시루자리:s&&s.slotId, r:r&&(r.slotId||r.탈) }; })()`)));

console.log('판 전 —', JSON.stringify(await snap()));
await shootSill(`${OUTDIR}/sill_0_before.png`);
/* 내놓기 — 되묻기(confirmOnce)라 두 번. 첫 누름에 몬이 한 줄(D22)이 뜰 수 있어 사이에 대화를 닫는다 */
for (let k = 0; k < 2; k++) { console.log('  내놓기 누름', k + 1, await page.eval(`(()=>{const b=document.getElementById('sellPlant'); if(!b) return 'none'; b.disabled=false; b.click(); return 'click';})()`)); await sleep(900); await clear(); }
const lst = await J(`(async()=>{ const S=window.__S(); const ls=(S.shop&&S.shop.listings)||[]; const l=ls[ls.length-1]; if(!l) return {없음:true};
  l.contactOnDay=S.day; l.status='contacted'; try{window.__redraw()}catch(e){} return { id:l.listingId, kind:l.kind, potId:l.potId||null }; })()`);
console.log('내놓음(연락 당김) —', JSON.stringify(lst));
await page.eval(`window.__byeotSheet.open('shop')`, false); await sleep(1000);
console.log('거래하기 —', await page.eval(`(()=>{const b=document.querySelector('[data-deal]'); if(!b) return 'no-deal-btn'; b.click(); return 'click '+b.dataset.deal;})()`));
await sleep(2500); await clear();
await page.eval(`(()=>{try{window.__byeotSheet.close()}catch(e){}})()`, false); await sleep(800);
console.log('\n■ 판 직후 —', JSON.stringify(await snap()));
await shootSill(`${OUTDIR}/sill_1_sold.png`);
console.log('  [식물] 장 —', await plantsSheet());
console.log('  확대 열기 —', JSON.stringify(await zoomTry(`${OUTDIR}/zoom_1_sold.png`)));
await page.eval(`(()=>{try{window.__redraw()}catch(e){}})()`, false); await sleep(2000);
console.log('\n■ __redraw 뒤 —', JSON.stringify(await snap()));
/* 하루 넘김 — 게임 단추 */
{ const day0 = Number(await page.eval(`String(window.__S().day)`));
  await page.eval(`(()=>{const b=document.getElementById('next'); if(b) b.click();})()`, false);
  for (let i = 0; i < 60; i++) { await sleep(500);
    if (Number(await page.eval(`String(window.__S().day)`)) > day0) break;
    await page.eval(`(()=>{const g=document.getElementById('mealGo'); if(g && g.offsetParent) g.click();})()`, false); }
  await sleep(2500); await clear(); console.log('  막는 창 닫음:', await closeModals()); await sleep(800); await clear(); }
console.log('\n■ 하루 넘긴 뒤 —', JSON.stringify(await snap()));
await shootSill(`${OUTDIR}/sill_2_nextday.png`);
console.log('  확대 열기 —', JSON.stringify(await zoomTry(`${OUTDIR}/zoom_2_nextday.png`)));
if (process.env.DUMP) { const raw = await J(`(async()=>{ const sv=await import('/src/game/save.js'); const S=window.__S();
    const r=sv.saveTo(localStorage, sv.SAVE_KEY, S); return { ok:r.ok, text: localStorage.getItem(sv.SAVE_KEY) }; })()`);
  if (raw.ok && raw.text) { fs.writeFileSync(process.env.DUMP, raw.text); console.log('★ 세이브:', process.env.DUMP, raw.text.length); } else console.log('⛔ 세이브 실패'); }
console.log('\n콘솔 경고:', await page.eval(`JSON.stringify((window.__leafLog||[]).slice(-8))`));
await page.close();
