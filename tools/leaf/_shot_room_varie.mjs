/* tools/leaf/_shot_room_varie.mjs — [growth] probe_room_zoom_varie_skin.mjs 를 «폰 크기»로 돌리고 찍기를 더한 것 ([leaf])
   ⇒ core D4(f6f1fb02) 뒤 «방 = 확대»인가 + 폰(390×844)에서 방·확대가 어떻게 보이나
   OUTDIR= (필수 · 비어 있어야 한다) · DAYS= · BYEOT_URL=
   SAVE= 세이브 파일(_make_oneroom_save.mjs 가 뜬 것) — 주면 키우기를 건너뛰고 그 세이브로 «바로» 켠다(원룸 거리 사진 · 10-08) */
import fs from 'node:fs';
const OUTDIR = process.env.OUTDIR; if (!OUTDIR) { console.error('⛔ OUTDIR='); process.exit(2); }
fs.mkdirSync(OUTDIR, { recursive: true }); if (fs.readdirSync(OUTDIR).length) { console.error('⛔ 비어 있지 않다'); process.exit(2); }
import { launch, sleep } from '../test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9340', DAYS = Number(process.env.DAYS || 260);
const page = await launch({ width: 390, height: 844, dpr: 2 });
/* ★ 열기를 «한 번»만 — 한 판에서 방을 두 번 세우면 둘째가 안 설 때가 있었다(10-08).
   ⚠ 10-08 정정: 그 «안 섬»은 방(WebGL) 탓이 아니었을 수 있다. 내가 띄운 시험 서버가 `python -m http.server`(대기열 5)라
     모듈을 한꺼번에 부르면 연결을 거절했다 — 10-08 오전 13판 중 5판이 안 섰고, 화면 글을 찍은 1판이 「파일 하나를 못 받으면 여기서 멈춥니다」였다(첫 판에서도 났다).
     ⇒ 서버는 tools/serve.py(대기열 128) · 주소는 127.0.0.1(localhost 는 ::1 을 먼저 두드려 요청마다 0.2초). 두 번 세우기는 다시 안 재 봤다 */
await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__leafLog=[]; for(const k of ['warn','error']){ const o=console[k].bind(console); console[k]=(...a)=>{ try{ window.__leafLog.push(k+' | '+a.map(x=>(x&&x.message)?x.message:String(x)).join(' ').slice(0,180)); }catch(_){} o(...a); }; } addEventListener('error',e=>window.__leafLog.push('던짐 | '+(e.message||'')));` });
const SAVE = process.env.SAVE ? fs.readFileSync(process.env.SAVE, 'utf8') : null;
/* ★ 세이브도 «켜기 전에» 넣는다 — 켠 뒤에 넣고 다시 열면 게임의 pagehide→saveNow 가 덮는다(10-07 실측) */
await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `try{ if(!sessionStorage.__leafCleared){ localStorage.clear(); ${SAVE ? `localStorage.setItem('byeot/save/1', ${JSON.stringify(SAVE)});` : ''} sessionStorage.__leafCleared='1'; } }catch(e){}` });
await page.goto(`${BASE}/game.html`);
/* ★ 기다리며 무엇에 걸렸나를 적는다 — 방이 안 설 때 «바쁜가/던졌나»를 가르려고(10-08 · 같은 세이브가 dpr1 6초 · dpr2 300초+) */
{ const t0 = Date.now(); let ok = false;
  while (Date.now() - t0 < 300000) { await sleep(3000);
    const r = JSON.parse(await page.eval(`JSON.stringify({rv:!!window.__rv, boot:(document.getElementById('bootMsg')||{}).textContent||null, log:(window.__leafLog||[]).slice(-3)})`));
    if (r.rv) { ok = true; console.log('켜짐', ((Date.now()-t0)/1000|0)+'초'); break; }
    if (((Date.now()-t0)/1000|0) % 30 < 3) console.log('  …', ((Date.now()-t0)/1000|0)+'초', JSON.stringify(r).slice(0,300)); }
  if (!ok) { console.error('⛔ 방이 안 섰다(300초)'); await page.close(); process.exit(4); } }
await sleep(4500);
const J = async (js, ms = 600000) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message, st:(e.stack||'').slice(0,300)}); } })()`, true, ms));
if (SAVE) console.log('세이브로 켬 —', JSON.stringify(await J(`(async()=>{ const S=window.__S(); const p=(S.pots||[])[0]; return { 방:S.home.room, 날:S.day, 화분:p&&p.slotId, at:p&&p.at, 가구:(S.home.furnitureAdded||[]).map(f=>f.uid) }; })()`)));
else {
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
}
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
/* ★ SAVE 판 — 세이브로 켠 «첫 하루 전»에 확대 창이 등급 그림을 받았나 · 하루를 넘기면 받나(게임 단추로 넘긴다) */
if (SAVE) {
  const cmpNow = async () => J(`(async()=>{ const sh=await import('/src/game/shop.js'); const S=window.__S();
    const want=sh.potLeafSkinsOf(S,(S.pots||[])[0])||{}; const z=window.__io.growth.leafSkinUsedAll(), r=window.__rv.leafSkinsInRoom();
    const rm=new Map((r||[]).map(x=>[x.leafBirth,x.key])); const out=[];
    for (const x of (z||[])) if (x.varie) out.push({ lb:x.leafBirth, 확대:x.key, 방:rm.get(x.leafBirth)||null, 값:want[String(x.leafBirth)]||null });
    return { 날:S.day, 어긋남:out.filter(o=>o.확대!==o.방).length, 잎:out }; })()`);
  console.log('켠 그대로 —', JSON.stringify(await cmpNow()));
  /* 「다음 날 ▸」(#next) → 밥상 창이 뜨면 그 창의 「이대로 다음 날 ▸」(#mealGo) — 사람이 누르는 두 번 그대로 */
  const nd = await page.eval(`(()=>{const b=document.getElementById('next'); if(!b) return 'none'; b.disabled=false; b.click(); return 'next';})()`);
  let meal = 'no';
  for (let i=0;i<60;i++){ await sleep(500);
    const d=await page.eval(`String(window.__S().day)`); if (+d>260) break;
    const m=await page.eval(`(()=>{const g=document.getElementById('mealGo'); if(g && g.offsetParent){ g.click(); return 'mealGo'; } return '';})()`); if (m) meal=m; }
  await sleep(4000); await quiet();
  console.log('다음 날('+nd+'·'+meal+') —', JSON.stringify(await cmpNow()));
  await page.shot(`${OUTDIR}/zoom_nextday.png`);
}
await page.close();
