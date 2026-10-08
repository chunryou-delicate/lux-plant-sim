/* tools/leaf/_walk_twopots.mjs — «화분이 둘이면 잎 그림이 제 그루를 따라가나» ([leaf] 10-08 · 박사님 «이리 튈지 저리 튈지»)
   판: SAVE(첫 화분 = 무늬 그루 · 예: 반지하 창턱 260일) 로 켜고 → 씨앗 화분을 하나 놓고 심어(게임 단추 길) →
       게임의 [다음 날 ▸](#next → 밥상 #mealGo) 로 DAYS 일 넘긴다. 날마다 잰다:
     ① 생장 창에 «지금 꽂힌» 그루(io.growth.current) — 하루 넘긴 뒤 첫 화분으로 돌아오나
     ② 첫 화분 등급 장부(leafGrades)의 잎 번호 — 첫 화분 잎(시작 때 적어 둔 것) 밖의 번호가 끼나
     ③ 방: 첫 화분을 카메라로 짚어 찍는다(room_pot0_dN.png) — 260일 그루가 제 잎으로 서 있나
     ④ 확대창: 첫 화분 확대(🔍)를 열어 확대창이 고른 그림 = 장부 그림인가 · 찍기(zoom_pot0_dN.png) · 닫기
   ⛔ 값 0 · 고치지 않는다. 세운 판 손질은 둘뿐: 시루를 방에 놓는다(첫 플레이는 그대로 · 끄면 윗줄이 멈춘다) · 씨앗·화분 재고 1씩.
   SAVE= (필수) · OUTDIR= (필수 · 비어 있어야) · DAYS=3 · SKIPSOW=1(이미 심은 세이브) · DUMP=(끝난 판 세이브) · BYEOT_URL=(기본 127.0.0.1:9340 · 서버는 tools/serve.py) */
import fs from 'node:fs';
import { launch, sleep } from '../test_cdp.mjs';
const OUTDIR = process.env.OUTDIR, SAVEF = process.env.SAVE;
if (!OUTDIR || !SAVEF) { console.error('⛔ SAVE= OUTDIR='); process.exit(2); }
fs.mkdirSync(OUTDIR, { recursive: true }); if (fs.readdirSync(OUTDIR).length) { console.error('⛔ 비어 있지 않다'); process.exit(2); }
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9340', DAYS = Number(process.env.DAYS || 3);
const SAVE = fs.readFileSync(SAVEF, 'utf8');
const page = await launch({ width: 390, height: 844, dpr: 1 });
await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true; window.__leafLog=[]; for(const k of ['warn','error']){ const o=console[k].bind(console); console[k]=(...a)=>{ try{ window.__leafLog.push(k+' | '+a.map(x=>(x&&x.message)?(x.message+' @@ '+String(x.stack||'').split(String.fromCharCode(10)).slice(1,7).map(l=>l.trim().split('/').slice(-1)[0]).join(' <- ')):String(x)).join(' ').slice(0,900)); }catch(_){} o(...a); }; } try{ if(!sessionStorage.__c){ localStorage.clear(); localStorage.setItem('byeot/save/1', ${JSON.stringify(SAVE)}); sessionStorage.__c='1'; } }catch(e){}` });
await page.goto(`${BASE}/game.html`);
{ let ok = false; for (let i = 0; i < 100; i++) { await sleep(3000); if (await page.eval('String(!!window.__rv)') === 'true') { ok = true; console.log('켜짐', i * 3 + 3, '초'); break; } }
  if (!ok) { console.error('⛔ 안 섬'); await page.close(); process.exit(4); } }
await sleep(5000);
const J = async (js, ms = 120000) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message, st:(e.stack||'').slice(0,240)}); } })()`, true, ms));
const clear = async () => { for (let i = 0; i < 40; i++) {
  const b = await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');return String(!!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on')));})()`);
  if (b !== 'true') return;
  await page.eval(`(()=>{const g=document.getElementById('guideClose'); if(g&&g.offsetParent){g.click();return;} const b=document.getElementById('dlgBox'); if(b)b.click();})()`, false); await sleep(250); } };
await clear();

/* 시작 — 첫 화분의 잎 번호를 적어 둔다(이 밖의 번호가 장부에 끼면 남의 잎이다) */
const start = await J(`(async()=>{ const S=window.__S(); const p=S.pots[0]; const ls=window.__io.growth.leafState()||[];
  return { 날:S.day, 첫화분:p.id, growthId:p.growthId||'__main__', 잎:ls.map(r=>r.leafBirth), 무늬:ls.filter(r=>r.varie).map(r=>r.leafBirth), 장부:Object.keys(p.leafGrades||{}) }; })()`);
console.log('시작 —', JSON.stringify(start));
/* ⚠ 꽂힌 그루가 첫 화분이 아니면 start.잎 은 남의 것이다(이미 심은 세이브 · 10-08 헛경고 한 번) — 그때는 장부 번호를 첫 화분 것으로 친다 */
const OWN = new Set(((start.잎 && start.잎.length) ? start.잎 : (start.장부 || [])).map(Number));
if (!(start.잎 && start.잎.length)) console.log('  (꽂힌 그루가 첫 화분이 아니라 잎을 못 읽었다 — 장부 번호로 친다)');

/* SKIPSOW=1 — 이미 심은 세이브(DUMP 로 뜬 것)면 놓기·심기를 건너뛴다 */
if (process.env.SKIPSOW !== '1') {
/* 씨앗 화분 놓기·심기 — 게임 단추 길(_diag_seedling 과 같은 걸음) */
/* ★ 세운 손질: 첫 플레이를 끄지 «않는다» — 끄면 윗줄(drawJourney)이 멈춘다(10-08 헛것 한 번). 대신 시루를 방에 놓는다(Day 0 에 사람이 하는 일 · 세운 세이브가 안 놓았다) */
console.log('시루 놓기 —', JSON.stringify(await J(`(async()=>{ const st=await import('/src/game/state.js'); const S=window.__S(), io=window.__io;
  if (S.firstPlay && S.firstPlay.monstera) S.firstPlay.monstera.arrived = true;
  const slots=io.light.room.slots||[]; const used=new Set((S.pots||[]).map(p=>p.slotId));
  const s=slots.find(x=>!used.has(x.slotId) && !/sill/.test(x.slotId) && /desk|shelf|dresser|night/.test(x.slotId)) || slots.find(x=>!used.has(x.slotId));
  let r=null; try { r=st.setCropAt(S, { x:s.x, y:s.y, z:s.z, slotId:s.slotId }, { slots, size: io.light.room.size }); } catch(e) { r={탈:e.message}; }
  try { window.__redraw(); } catch(e) {}
  return { 시루자리:s&&s.slotId, r:r&&(r.slotId||r.탈) }; })()`)));
await page.eval(`(()=>{const S=window.__S(); S.shop.stock.pot_concrete_square=(S.shop.stock.pot_concrete_square||0)+1; S.shop.stock.monstera_seed=(S.shop.stock.monstera_seed||0)+1; if(S.stamina)S.stamina.usedToday=0; window.__redraw&&window.__redraw();})()`, false);
await sleep(800);
console.log('화분 놓기 —', await page.eval(`JSON.stringify(window.__placePot('monsteraSeed:pot_concrete_square'))`)); await sleep(1800); await clear();
await page.eval(`window.__byeotSheet.open('plants')`, false); await sleep(800);
console.log('심기 —', await page.eval(`(()=>{const b=[...document.querySelectorAll('#emptyPotList [data-sow]')][0]; if(!b) return 'no-sow'; b.click(); return 'sow';})()`));
await sleep(1200);
console.log('  고름 —', await page.eval(`(()=>{ for(const b of document.querySelectorAll('button')){ if(/몬스테라/.test(b.textContent||'') && b.offsetParent && !b.disabled){ b.click(); return (b.textContent||'').trim().slice(0,30); } } return 'none'; })()`));
await sleep(2200); await clear();
await page.eval(`(()=>{try{window.__byeotSheet.close()}catch{}})()`, false); await sleep(600);

}
const snap = async (tag) => J(`(async()=>{ const sh=await import('/src/game/shop.js'); const S=window.__S(), io=window.__io;
  const p0=S.pots[0];
  return { 날:S.day, 꽂힌그루:io.growth.current&&io.growth.current(), 그루들:io.growth.plantIds&&io.growth.plantIds(),
    화분:S.pots.map(p=>({id:p.id, gid:p.growthId||'__main__', 자리:p.slotId||(p.at?('at '+p.at.x.toFixed(2)+','+p.at.z.toFixed(2)):null), 장부:Object.keys(p.leafGrades||{}) })),
    첫화분그림:Object.fromEntries(Object.entries(sh.potLeafSkinsOf(S,p0)||{}).map(([k,v])=>[k,(v.midSkin||'-')+'/'+(v.matSkin||'-')])),
    방:(window.__rv.plants()||[]).filter(r=>r.kind==='monstera'||r.kind==='emptypot').map(r=>({potId:r.potId, kind:r.kind, 생장일:r.growthDays, photo:r.photo})) }; })()`);
/* 단추·잠금·게임 기록 — [다음 날]이 왜 안 눌리나를 가른다 */
const gate = async () => J(`(async()=>{ const S=window.__S(); const n=document.getElementById('next');
  return { next잠김:!!(n&&n.disabled), hardLock:document.body.dataset.hardLock||null, 기록:(S.log||[]).slice(-4).map(x=>typeof x==='string'?x:(x&&(x.msg||x.text||x.ko))||JSON.stringify(x)).map(t=>String(t).slice(0,120)) }; })()`);
const shootPot0 = async (file) => {
  await page.eval(`(()=>{try{const p=window.__S().pots[0]; window.__rv.focusSlot(p.slotId||p.at,true);}catch(e){}})()`, false);
  for (let i = 0; i < 30; i++) { if (await page.eval(`(()=>{try{return String(!!window.__rv.camBusy());}catch(e){return 'false';}})()`) === 'false') break; await sleep(300); }
  await page.eval(`(()=>{try{window.__rv.camTo({dist:3.0, el:0.55}, 150);}catch(e){}})()`, false);
  for (let i = 0; i < 20; i++) { if (await page.eval(`(()=>{try{return String(!!window.__rv.camBusy());}catch(e){return 'false';}})()`) === 'false') break; await sleep(250); }
  await sleep(1500); await page.eval(`(()=>{try{window.__rv.redraw();}catch(e){}})()`, false); await sleep(500);
  await page.shot(file);
};
/* 첫 화분 확대 — [식물] 장의 🔍(data-plantbig) 중 첫 화분 것을 누른다 */
const zoomPot0 = async (file) => {
  await page.eval(`window.__byeotSheet.open('plants')`, false); await sleep(800);
  const hit = await page.eval(`(()=>{const p=window.__S().pots[0]; const bs=[...document.querySelectorAll('[data-plantbig]')];
    const b=bs.find(x=>x.dataset.plantbig===p.id)||bs[0]; if(!b) return 'none:'+bs.length; b.click(); return 'click '+(b.dataset.plantbig||'?')+' / '+bs.length;})()`);
  await sleep(9000); await clear();
  const r = await J(`(async()=>{ const sh=await import('/src/game/shop.js'); const S=window.__S(), io=window.__io;
    const want=sh.potLeafSkinsOf(S,S.pots[0])||{}; const z=io.growth.leafSkinUsedAll()||[];
    return { 꽂힌그루:io.growth.current&&io.growth.current(), 열림:!!(window.__byeotZoom&&window.__byeotZoom.isOpen&&window.__byeotZoom.isOpen()),
      잎:z.map(x=>({lb:x.leafBirth, 무늬:x.varie, 확대:x.key, 장부:want[String(x.leafBirth)]?((want[String(x.leafBirth)].midSkin||'-')+'/'+(want[String(x.leafBirth)].matSkin||'-')):null})) }; })()`);
  await page.shot(file);
  await page.eval(`(()=>{try{window.__byeotZoom.close()}catch(e){} try{window.__byeotSheet.close()}catch(e){}})()`, false); await sleep(1500);
  return { hit, ...r };
};

console.log('심은 뒤(그대로) —', JSON.stringify(await snap()), JSON.stringify(await gate()));
await page.eval(`(()=>{try{window.__redraw()}catch(e){}})()`, false); await sleep(2500);
console.log('심은 뒤(__redraw · 확대 전) —', JSON.stringify(await snap()));
await shootPot0(`${OUTDIR}/room_pot0_d0.png`);
console.log('  확대 —', JSON.stringify(await zoomPot0(`${OUTDIR}/zoom_pot0_d0.png`)));
console.log('확대 닫은 뒤 —', JSON.stringify(await snap()), JSON.stringify(await gate()));
await shootPot0(`${OUTDIR}/room_pot0_d0b.png`);
for (let d = 1; d <= DAYS; d++) {
  const day0 = Number(await page.eval(`String(window.__S().day)`));
  await page.eval(`(()=>{const b=document.getElementById('next'); if(b) b.click();})()`, false);
  for (let i = 0; i < 60; i++) { await sleep(500);
    if (Number(await page.eval(`String(window.__S().day)`)) > day0) break;
    await page.eval(`(()=>{const g=document.getElementById('mealGo'); if(g && g.offsetParent) g.click();})()`, false); }
  await sleep(2500); await clear();
  console.log(`  누른 뒤 —`, JSON.stringify(await gate()));
  const s = await snap();
  const foreign = [...new Set((s.화분 && s.화분[0] && s.화분[0].장부 || []).map(Number).filter(k => !OWN.has(k)))];
  console.log(`\n■ ${d}일 넘김 —`, JSON.stringify(s), foreign.length ? ` ⚠ 첫 화분 장부에 남의 잎 번호: ${foreign}` : '');
  await shootPot0(`${OUTDIR}/room_pot0_d${d}.png`);
  console.log('  확대 —', JSON.stringify(await zoomPot0(`${OUTDIR}/zoom_pot0_d${d}.png`)));
}
/* DUMP= — 끝난 판을 세이브로 떠 둔다(다시 켜면 풀리나를 다음 판에서 잰다) */
if (process.env.DUMP) { const raw = await J(`(async()=>{ const sv=await import('/src/game/save.js'); const S=window.__S();
    const r=sv.saveTo(localStorage, sv.SAVE_KEY, S); return { ok:r.ok, text: localStorage.getItem(sv.SAVE_KEY) }; })()`);
  if (raw.ok && raw.text) { fs.writeFileSync(process.env.DUMP, raw.text); console.log('★ 세이브:', process.env.DUMP, raw.text.length); } else console.log('⛔ 세이브 실패', JSON.stringify(raw).slice(0, 200)); }
console.log('\n콘솔 경고:', await page.eval(`JSON.stringify((window.__leafLog||[]).slice(-8))`));
await page.close();
