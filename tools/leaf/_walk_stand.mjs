/* tools/leaf/_walk_stand.mjs — «원룸 화분대에 키운 그루가 여럿» 판을 걸어서 만든다 ([leaf] 10-09 · D41 «이 화분대가 네 밭이야» 그림 보기)
   SAVE(등 켠 반지하 260일 모주 · _make_oneroom_save NOMOVE=1 LAMP=2) 로 켜고:
     ① 시루를 방에 놓는다(사람이 Day 0 에 하는 일 · 세운 세이브가 안 놓음) · 흙 포트 재고 K
     ② [방] 장 삽수 상자 [흙에](data-cut · data-cont=soil)를 K 번 — 게임 단추 길(무늬 마디를 먼저) · 자를 때마다 체력만 채움(세운 손질 · 날을 안 넘기려고)
     ③ 원룸으로 이사(이사 자금만 채움 · 에타제르 들고 감) → 에타제르를 기준 배치 D 자리에 → 모주는 원룸 창턱 · 시루는 에타제르 아랫단(이사가 가방에 넣음 · 사람이 다시 놓음) · 삽수는 윗단·가운데단(setCuttingAt)
     ④ [다음 날 ▸] 로 DAYS 일 — 모주 물은 날마다(사람이 주는 것)
     ⑤ DUMP 로 세이브 · 찍기는 _shot_room_varie / _shot_stand 로
   SAVE= · DUMP= (필수) · K=4 · DAYS=40 · BYEOT_URL=(기본 127.0.0.1:9340 · tools/serve.py) */
import fs from 'node:fs';
import { launch, sleep } from '../test_cdp.mjs';
const SAVEF = process.env.SAVE, DUMP = process.env.DUMP;
if (!SAVEF || !DUMP) { console.error('⛔ SAVE= DUMP='); process.exit(2); }
if (fs.existsSync(DUMP)) { console.error('⛔ 이미 있다', DUMP); process.exit(2); }
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9340', K = Number(process.env.K || 4), DAYS = Number(process.env.DAYS || 40);
const SAVE = fs.readFileSync(SAVEF, 'utf8');
const page = await launch({ width: 390, height: 844, dpr: 1 });
await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true; try{ if(!sessionStorage.__c){ localStorage.clear(); localStorage.setItem('byeot/save/1', ${JSON.stringify(SAVE)}); sessionStorage.__c='1'; } }catch(e){}` });
await page.goto(`${BASE}/game.html`);
{ let ok = false; for (let i = 0; i < 100; i++) { await sleep(3000); if (await page.eval('String(!!window.__rv)') === 'true') { ok = true; break; } }
  if (!ok) { console.error('⛔ 안 섬'); await page.close(); process.exit(4); } }
await sleep(6000);
const J = async (js, ms = 600000) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message, st:(e.stack||'').slice(0,240)}); } })()`, true, ms));
const clear = async () => { for (let i = 0; i < 40; i++) {
  const b = await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');return String(!!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on')));})()`);
  if (b !== 'true') return;
  await page.eval(`(()=>{const g=document.getElementById('guideClose'); if(g&&g.offsetParent){g.click();return;} const b=document.getElementById('dlgBox'); if(b)b.click();})()`, false); await sleep(250); } };
const closeModals = async () => page.eval(`(()=>{ for (const b of document.querySelectorAll('button')) { const t=(b.textContent||'').trim(); if (b.offsetParent && /^(고맙습니다|확인|닫기)$/.test(t)) b.click(); } })()`, false);
await clear();
console.log('① 손질 —', JSON.stringify(await J(`(async()=>{ const st=await import('/src/game/state.js'); const S=window.__S(), io=window.__io;
  const slots=io.light.room.slots||[]; const used=new Set((S.pots||[]).map(p=>p.slotId));
  const s=slots.find(x=>!used.has(x.slotId) && !/sill/.test(x.slotId) && /desk|shelf|dresser|night/.test(x.slotId)) || slots.find(x=>!used.has(x.slotId));
  let r=null; try { r=st.setCropAt(S, { x:s.x, y:s.y, z:s.z, slotId:s.slotId }, { slots, size: io.light.room.size }); } catch(e) { r={탈:e.message}; }
  S.shop.stock.pot=(S.shop.stock.pot||0)+${K}; if(S.stamina) S.stamina.usedToday=0; try{window.__redraw()}catch(e){}
  return { 시루:r&&(r.slotId||r.탈), 포트:S.shop.stock.pot }; })()`)));
/* ② 자르기 K 번 */
for (let k = 0; k < K; k++) {
  await page.eval(`(()=>{ window.__byeotSheet.open(); window.__byeotSheet.tab('room'); })()`, false); await sleep(900);
  const info = await J(`(async()=>{ const io=window.__io; let cn=[]; try { cn=io.growth.cuttableNodes()||[]; } catch(e) {}
    const m=new Map(cn.map(n=>[n.nodeId||n.id, n]));
    const open=[...document.querySelectorAll('#cutNodes [data-cut]')].filter(x=>x.dataset.cont==='soil' && !x.disabled).map(x=>({node:x.dataset.cut, 잎:(m.get(x.dataset.cut)||{}).leaves, 무늬:(m.get(x.dataset.cut)||{}).variegatedLeaves}));
    return { open, 안내:(document.getElementById('cutHint')||{}).textContent||'' }; })()`);
  const pick = (info.open || []).sort((a, b) => ((b.무늬 || 0) > 0) - ((a.무늬 || 0) > 0) || (a.잎 || 9) - (b.잎 || 9))[0];
  console.log(`② 자르기 ${k + 1} — 열린 [흙에] ${(info.open || []).length} · 고름 ${JSON.stringify(pick || null)}`);
  if (!pick) { console.log('   (더 자를 마디가 없다)', String(info.안내).slice(0, 80)); await page.eval(`(()=>{try{window.__byeotSheet.close()}catch(e){}})()`, false); break; }
  const n0 = Number(await page.eval(`String((window.__S().cuttings||[]).length)`));
  await page.eval(`(()=>{ window.__byeotSheet.close(); const b=[...document.querySelectorAll('#cutNodes [data-cut]')].find(x=>x.dataset.cut===${JSON.stringify(pick.node)} && x.dataset.cont==='soil'); if(b){ b.disabled=false; b.click(); } })()`, false);
  for (let i = 0; i < 40; i++) { await sleep(500); if (Number(await page.eval(`String((window.__S().cuttings||[]).length)`)) > n0) break; }
  await sleep(2500); await clear();
  await page.eval(`(()=>{const S=window.__S(); if(S.stamina) S.stamina.usedToday=0;})()`, false);
}
/* ③ 이사 · 놓기 */
console.log('③ 이사·놓기 —', JSON.stringify(await J(`(async()=>{ const st=await import('/src/game/state.js'); const orm=await import('/src/game/oneroom.js'); const pr=await import('/src/game/propagation.js');
  const S=window.__S(), io=window.__io;
  if (S.tutorial && Number.isFinite(S.tutorial.cashWon)) S.tutorial.cashWon = Math.max(S.tutorial.cashWon, 6000000);
  const carry=(io.light.room.def.furniture||[]).filter(f=>f&&f.uid&&/etagere/.test(f.preset)).map(f=>({uid:f.uid, preset:f.preset}));
  orm.moveIntoOneroom(S, io, { carry });
  const H=await (await fetch('/data/house_rooms.json')).json(); const ref=(H.rooms.oneroom.reference_layout.furniture||[]).find(f=>/etagere/.test(f.preset));
  st.placeCarriedFurniture(S, ref.uid, { x:ref.x, z:ref.z, rot:ref.rot||0 }, { size: io.light.room.size });
  io.light.setFurnitureEdits(st.soldFurniture(S), st.addedFurniture(S));
  const slots=io.light.room.slots||[];
  st.setPotSlot(S, S.pots[0], 'oneroom-sill:1', slots);
  /* ★ 이사가 자리를 비워 시루도 가방으로 간다 — 첫 플레이가 켜진 판은 «시루를 먼저»로 [다음 날]이 막힌다(10-09 한 번 막힘). 사람이 하듯 다시 놓는다(에타제르 아랫단) */
  let siru=null; { const sl=slots.find(s=>s.slotId==='banjiha-etagere:0'); try { siru=st.setCropAt(S, { x:sl.x, y:sl.y, z:sl.z, slotId:sl.slotId }, { slots, size: io.light.room.size }).slotId; } catch(e) { siru='탈 '+e.message.slice(0,60); } }
  const want=['banjiha-etagere:6','banjiha-etagere:7','banjiha-etagere:8','banjiha-etagere:3','banjiha-etagere:4','banjiha-etagere:5'];
  const placed=[];
  for (const [i,c] of (S.cuttings||[]).filter(c=>c && c.status!=='dead').entries()) { const sl=slots.find(s=>s.slotId===want[i]); if(!sl) break;
    try { pr.setCuttingAt(S, c, { x:sl.x, y:sl.y, z:sl.z }, { slots, size: io.light.room.size, snapDist: 0 }); placed.push(c.id+'@'+sl.slotId+'·'+c.container); } catch(e) { placed.push(c.id+' 탈 '+e.message.slice(0,60)); } }
  try{window.__redraw()}catch(e){}
  return { 방:S.home.room, 삽수:placed, 모주:S.pots[0].slotId, 시루:siru }; })()`)));
await sleep(3000); await clear();
/* ④ 날 넘기기 */
for (let d = 0; d < DAYS; d++) {
  await page.eval(`(async()=>{ try { const st=await import('/src/game/state.js'); const S=window.__S(); for (const p of (S.pots||[])) { try { st.waterPot(S, { pot:p }); } catch(e) {} } } catch(e) {} })()`, false);
  const day0 = Number(await page.eval(`String(window.__S().day)`));
  await page.eval(`(()=>{const b=document.getElementById('next'); if(b) b.click();})()`, false);
  for (let i = 0; i < 60; i++) { await sleep(400); if (Number(await page.eval(`String(window.__S().day)`)) > day0) break;
    await page.eval(`(()=>{const g=document.getElementById('mealGo'); if(g && g.offsetParent) g.click();})()`, false); }
  await sleep(800); await clear(); await closeModals(); await clear();
  if (d % 10 === 9) console.log(`④ ${d + 1}일 —`, JSON.stringify(await J(`(async()=>{ const S=window.__S(); const n=document.getElementById('next');
    return { 날:S.day, 잠김:!!(n&&n.disabled), 삽수:(S.cuttings||[]).map(c=>c.id+':'+c.status+':잎'+((c.leafVarie||[]).length)+(c.variegated?'*':'')) }; })()`)));
}
const raw = await J(`(async()=>{ const sv=await import('/src/game/save.js'); const S=window.__S();
  const r=sv.saveTo(localStorage, sv.SAVE_KEY, S); return { ok:r.ok, text: localStorage.getItem(sv.SAVE_KEY) }; })()`);
if (raw.ok && raw.text) { fs.writeFileSync(DUMP, raw.text); console.log('★ 세이브:', DUMP, raw.text.length); } else console.log('⛔ 세이브 실패', JSON.stringify(raw).slice(0, 200));
await page.close();
