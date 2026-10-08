/* tools/leaf/_grow_save.mjs — 세이브를 넣고 켜서 DAYS 일 더 키운 세이브를 뜬다(화분 여럿 · [leaf] 10-08 · 갈래 ① 씨앗 그루를 무늬 날 때까지)
   키우기는 _make_oneroom_save 와 같은 결: 날마다 화분마다 물 · runDays 1 · 첫 화분 등급 두 줄(게임 noteLeafGrades 처럼 첫 화분만).
   MOVE2=best — 둘째 화분을 «빈 자리 중 가장 밝은 곳»(dliAt · 맑음 여름 · 지금 등)으로 옮긴 뒤 키운다(사람이 화분을 옮기는 일) · MOVE2=<slotId>
   SAVE= (필수) · OUT= (필수 · 있으면 안 돈다) · DAYS=150 · BYEOT_URL=(기본 127.0.0.1:9340 · tools/serve.py) */
import fs from 'node:fs';
import { launch, sleep } from '../test_cdp.mjs';
const SAVEF = process.env.SAVE, OUT = process.env.OUT;
if (!SAVEF || !OUT) { console.error('⛔ SAVE= OUT='); process.exit(2); }
if (fs.existsSync(OUT)) { console.error('⛔ 이미 있다', OUT); process.exit(2); }
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9340', DAYS = Number(process.env.DAYS || 150);
const SAVE = fs.readFileSync(SAVEF, 'utf8');
const page = await launch({ width: 390, height: 844, dpr: 1 });
await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `try{ if(!sessionStorage.__c){ localStorage.clear(); localStorage.setItem('byeot/save/1', ${JSON.stringify(SAVE)}); sessionStorage.__c='1'; } }catch(e){}` });
await page.goto(`${BASE}/game.html`);
{ let ok = false; for (let i = 0; i < 100; i++) { await sleep(3000); if (await page.eval('String(!!window.__rv)') === 'true') { ok = true; break; } }
  if (!ok) { console.error('⛔ 안 섬'); await page.close(); process.exit(4); } }
await sleep(5000);
const J = async (js, ms = 1800000) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message, st:(e.stack||'').slice(0,300)}); } })()`, true, ms));
if (process.env.MOVE2) console.log('옮김 —', JSON.stringify(await J(`(async()=>{ const st=await import('/src/game/state.js'); const S=window.__S(), io=window.__io;
  const p2=(S.pots||[])[1]; if(!p2) return {둘째없음:true};
  const slots=io.light.room.slots||[]; const used=new Set((S.pots||[]).map(p=>p.slotId).filter(Boolean));
  const fp=S.firstPlay&&S.firstPlay.beansprout; const cropSlots=new Set(((fp&&fp.pots)||[]).map(c=>c.slotId).filter(Boolean));
  let id='${process.env.MOVE2}';
  const rows=slots.filter(s=>!used.has(s.slotId)&&!cropSlots.has(s.slotId)).map(s=>{ let d=null; try { d=io.light.dliAt({x:s.x,y:s.y,z:s.z,occIdx:s.occIdx},{weather:'clear',season:'summer',lampCount:(S.lamps&&S.lamps.count)||0,litHours:(S.lamps&&S.lamps.litHours)||0}).dli; } catch(e) {} return {id:s.slotId,dli:d}; }).sort((a,b)=>(b.dli||0)-(a.dli||0));
  if (id==='best') id=rows[0]&&rows[0].id;
  const r=st.setPotSlot(S, p2, id, slots); try{window.__redraw()}catch(e){}
  return { 둘째:p2.id, 자리:r.slotId, 밝은자리:rows.slice(0,5).map(x=>x.id+' '+(x.dli==null?'?':x.dli.toFixed(2))) }; })()`)));
console.log('돌림 —', JSON.stringify(await J(`(async()=>{ const st=await import('/src/game/state.js'); const lp=await import('/src/game/loop.js'); const sh=await import('/src/game/shop.js');
  const S=window.__S(), io=window.__io; let errs=[]; const d0=S.day;
  for (let d=0; d<${DAYS}; d++){
    for (const p of (S.pots||[])) { try { st.waterPot(S, { pot:p }); } catch(e) { if(errs.length<4 && !/촉촉|아직/.test(e.message)) errs.push('물:'+e.message.slice(0,50)); } }
    lp.runDays(S, io, 1, (t) => { try { const ls=io.growth.leafState(); const band=(t&&t.growthSpeed&&t.growthSpeed.band)||null;
      sh.assignPotLeafGrades(S, { leafState: ls, band }); } catch(e) { if(errs.length<4) errs.push('등급:'+e.message.slice(0,60)); } });
  }
  const out={ 날:d0+'→'+S.day, errs, 꽂힌:io.growth.current&&io.growth.current(), 화분:[] };
  for (const p of (S.pots||[])) { try { io.growth.select(p.growthId||'__main__'); } catch(e) {}
    const ls=io.growth.leafState()||[]; out.화분.push({ id:p.id, gid:p.growthId||'__main__', 잎:ls.length, 무늬:ls.filter(r=>r.varie).map(r=>r.leafBirth), 다자란무늬:ls.filter(r=>r.varie&&r.matured).length, 장부:Object.keys(p.leafGrades||{}) }); }
  try { io.growth.select((S.pots[0]&&S.pots[0].growthId)||'__main__'); } catch(e) {}
  return out; })()`)));
const raw = await J(`(async()=>{ const sv=await import('/src/game/save.js'); const S=window.__S();
  const r=sv.saveTo(localStorage, sv.SAVE_KEY, S); return { ok:r.ok, text: localStorage.getItem(sv.SAVE_KEY) }; })()`);
if (!raw.ok || !raw.text) { console.error('⛔ 저장 실패', JSON.stringify(raw).slice(0, 300)); process.exit(3); }
fs.writeFileSync(OUT, raw.text); console.log('★ 세이브:', OUT, raw.text.length, '자');
await page.close();
