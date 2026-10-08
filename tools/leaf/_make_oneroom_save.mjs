/* tools/leaf/_make_oneroom_save.mjs — 반지하 창턱에서 무늬 몬스테라를 DAYS 일 키운 뒤 «원룸으로 이사»한 세이브를 뜬다 ([leaf])
   ★ 판 둘로 나눈다: 헤드리스 한 판에서 방을 두 번 세우면 둘째가 안 설 때가 있었다(10-08) — ⚠ 서버 대기열 탓이었을 수 있다(_shot_room_varie §정정).
     여기서는 방을 다시 안 세우고(moveIntoOneroom 은 빛 쪽만 원룸으로 짓는다) 세이브만 떠서 파일로 남긴다.
   키우기는 [growth] probe_room_zoom_varie_skin 그대로(날마다 물 · runDays 1 · 등급 두 줄).
   OUT= 세이브 파일 (필수 · 있으면 안 돈다) · DAYS= · BYEOT_URL= · CARRY=etagere(에타제르를 가방에 담아 간다) · PLACE=etagere · SLOTS=a,b */
import { launch, sleep } from '../test_cdp.mjs';
import fs from 'node:fs';
const OUT = process.env.OUT; if (!OUT) { console.error('⛔ OUT='); process.exit(2); }
if (fs.existsSync(OUT)) { console.error('⛔ 이미 있다', OUT); process.exit(2); }
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9340', DAYS = Number(process.env.DAYS || 260);
const page = await launch({ width: 390, height: 844, dpr: 1 });
await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `try{ if(!sessionStorage.__leafCleared){ localStorage.clear(); sessionStorage.__leafCleared='1'; } }catch(e){}` });
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 300000, 500); await sleep(4000);
const J = async (js, ms = 1800000) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message, st:(e.stack||'').slice(0,300)}); } })()`, true, ms));
console.log('세움 —', JSON.stringify(await J(`(async()=>{ const st=await import('/src/game/state.js'); const fp=await import('/src/game/first_play.js');
  const S=window.__S(); S.firstPlay.beansprout.harvestCount = fp.MONSTERA_ARRIVAL_RULE.harvestCount; S.firstPlay.beansprout.harvested = true;
  const a = st.givePlant(S, window.__io, { slotId:null }); fp.markMonsteraArrived(S.firstPlay, a);
  const p=(S.pots||[])[0]; const slots=window.__io.light.room.slots||[]; const slot=slots.find(x=>/sill/.test(x.slotId));
  st.setPotAt(S, p.id, { x:slot.x, y:slot.y, z:slot.z, slotId:slot.slotId }, { slots, size: window.__io.light.room.size });
  return { 자리:p.slotId }; })()`)));
console.log('돌림 —', JSON.stringify(await J(`(async()=>{ const st=await import('/src/game/state.js'); const lp=await import('/src/game/loop.js'); const sh=await import('/src/game/shop.js');
  const S=window.__S(), io=window.__io; let errs=[];
  for (let d=0; d<${DAYS}; d++){
    try { st.waterPot(S); } catch(e) { if(errs.length<3) errs.push('물:'+e.message.slice(0,50)); }
    lp.runDays(S, io, 1, (t) => { try { const ls=io.growth.leafState(); const band=(t&&t.growthSpeed&&t.growthSpeed.band)||null;
      sh.assignPotLeafGrades(S, { leafState: ls, band }); } catch(e) { if(errs.length<3) errs.push('등급:'+e.message.slice(0,60)); } });
  }
  const ls=io.growth.leafState()||[];
  return { 날:S.day, errs, 잎:ls.length, 무늬:ls.filter(r=>r.varie).length, 갈라진무늬:ls.filter(r=>r.varie&&r.matured).length, 등급:sh.potLeafGradesOf((S.pots||[])[0]) }; })()`)));
const mv = await J(`(async()=>{ const orm=await import('/src/game/oneroom.js');
  const S=window.__S(), io=window.__io;
  /* ★ 세운 판이라 이사 자금을 채워 준다(값은 안 바꾼다 — 이 판의 지갑만) */
  if (S.tutorial && Number.isFinite(S.tutorial.cashWon)) S.tutorial.cashWon = Math.max(S.tutorial.cashWon, 6000000);
  const carry = '${process.env.CARRY||''}'==='etagere'
    ? (io.light.room.def.furniture||[]).filter(f=>f&&f.uid&&/etagere/.test(f.preset)).map(f=>({uid:f.uid, preset:f.preset})) : [];
  const r = orm.moveIntoOneroom(S, io, { carry });
  return { 방:S.home.room, 담음:carry.map(c=>c.preset), 그루:(S.pots||[]).map(p=>({id:p.id, slot:p.slotId||null})), 원룸자리:(io.light.room.slots||[]).map(s=>s.slotId).slice(0,30) }; })()`);
console.log('이사 —', JSON.stringify(mv));
if (mv.탈 || mv.방 !== 'oneroom') { console.error('⛔ 이사 실패 — 세이브 안 뜸'); process.exit(3); }
/* ★ PLACE=etagere — 가방의 에타제르를 원룸 기준 배치(reference_layout D) 자리에 놓는다(게임의 [가방→놓기] 길: placeCarriedFurniture → setFurnitureEdits).
   SLOTS=a,b — 화분을 그 자리마다 옮겨 세이브를 하나씩 뜬다(OUT.<자리>.json). 안 주면 OUT 하나(화분 자리 없음) */
if (process.env.PLACE === 'etagere') {
  console.log('놓음 —', JSON.stringify(await J(`(async()=>{ const st=await import('/src/game/state.js');
    const S=window.__S(), io=window.__io;
    const H=await (await fetch('/data/house_rooms.json')).json(); const ref=(H.rooms.oneroom.reference_layout.furniture||[]).find(f=>/etagere/.test(f.preset));
    const row=st.placeCarriedFurniture(S, ref.uid, { x:ref.x, z:ref.z, rot:ref.rot||0 }, { size: io.light.room.size });
    io.light.setFurnitureEdits(st.soldFurniture(S), st.addedFurniture(S));
    return { 놓은것:row, 자리:(io.light.room.slots||[]).map(s=>s.slotId+'@y'+(+s.y).toFixed(2)) }; })()`)));
}
const save = async (file) => {
  const raw = await J(`(async()=>{ const sv=await import('/src/game/save.js'); const S=window.__S();
    const r=sv.saveTo(localStorage, sv.SAVE_KEY, S); return { ok:r.ok, text: localStorage.getItem(sv.SAVE_KEY) }; })()`);
  if (!raw.ok || !raw.text) { console.error('⛔ 저장 실패', JSON.stringify(raw).slice(0,300)); process.exit(3); }
  fs.writeFileSync(file, raw.text); console.log('★ 세이브:', file, raw.text.length, '자');
};
const SLOTS = (process.env.SLOTS || '').split(',').filter(Boolean);
if (!SLOTS.length) await save(OUT);
for (const sid of SLOTS) {
  const r = await J(`(async()=>{ const st=await import('/src/game/state.js'); const S=window.__S(), io=window.__io;
    const slots=io.light.room.slots||[]; let id='${sid}';
    /* «etagere:top|mid|bottom» — 에타제르 단을 높이로 고른다(자리 이름의 번호가 단 순서인지 모르므로) */
    const m=/^etagere:(top|mid|bottom)$/.exec(id);
    if (m) { const e=slots.filter(s=>/etagere/.test(s.slotId)).sort((a,b)=>b.y-a.y); const ys=[...new Set(e.map(s=>+s.y.toFixed(2)))];
      const y = m[1]==='top'?ys[0]:m[1]==='bottom'?ys[ys.length-1]:ys[Math.floor(ys.length/2)];
      const row=e.filter(s=>+s.y.toFixed(2)===y).sort((a,b)=>Math.abs(a.x)-Math.abs(b.x)); id=row[0].slotId; }
    return { ...st.setPotSlot(S, (S.pots||[])[0], id, slots), 고른이름:'${sid}' }; })()`);
  console.log('화분 —', JSON.stringify(r));
  if (r.탈) process.exit(3);
  await save(OUT.replace(/\.json$/, '') + '.' + sid.replace(/[^a-z0-9_-]+/gi, '_') + '.json');
}
await page.close();
