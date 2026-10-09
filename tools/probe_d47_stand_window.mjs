/* ============================================================
   tools/probe_d47_stand_window.mjs — «화분대를 사서 원룸 창 앞에 놓으면 여름엔 등 없이 자란다»를 게임에서 걸어 잰다
   ([house] · 2026-10-09 · 총괄 D47 — 원룸 갈래의 손잡이)
   ------------------------------------------------------------
     BYEOT_URL=http://127.0.0.1:9330 OUTDIR=… PICK=plant_step_3 WHERE=stand|floor node tools/probe_d47_stand_window.mjs
   걸음(화면 손 · core probe_d47_furnshop 과 같은 손길 + 원룸):
     ① 새 판 · 몬스테라(새 판엔 한 그루뿐 — 둘째는 삽수라야 생긴다 ⇒ 대조는 같은 걸음을 두 번: WHERE=stand / floor) · 이사 · 저장 → 새로 켬(원룸)
     ② [상점] → [가구] → PICK 줄 [주문] → 날을 보내 도착 → [가방] «산 가구» 칸 누름 → 방 한가운데
     ③ 창 앞으로 옮김(roomView.commitFurnitureAt — [옮기기] 확정과 같은 창구 · 자리표를 S 에 옮겨 적고 저장 → 새로 켬)
     ④ WHERE=stand: 그 가구 맨 윗자리 · WHERE=floor: 바로 앞 바닥(가구는 똑같이 사서 놓는다) · placeVerdict 를 둘 다 물음
     ⑤ 등 0(S.lamps.count = 0)으로 봄(0~89일) → 여름(90~179일) 끝까지 · 날마다 둘 다 물 · 그루마다 그날 빛(dliHist)과 자란 날(growthDays)
   판정(두 판을 견준다): 여름에 화분대 위는 자람 문턱(2.7) 이상인 날이 대부분 · 바닥은 거의 없다.
   ⚠ 헤드리스 크롬 하나 · 여유 램 4GB 밑이면 기다린다(총괄 10-08 규칙)
============================================================ */
import fs from 'node:fs';
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9330';
const OUTDIR = process.env.OUTDIR; if (!OUTDIR) { console.error('⛔ OUTDIR='); process.exit(2); }
fs.mkdirSync(OUTDIR, { recursive: true });
const PICK = process.env.PICK || 'plant_step_3', WHERE = process.env.WHERE || 'stand';
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 2400000); wd.unref && wd.unref();
const page = await launch({ width: 390, height: 844, dpr: 1 });
const J = async (js, ms = 1800000) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message, st:(e.stack||'').slice(0,300)}); } })()`, true, ms));
const skipTalk = async () => { for (let k = 0; k < 4; k++) { for (let i = 0; i < 40; i++) {
  if (await page.eval(`String(document.getElementById('stage').classList.contains('talking'))`) !== 'true') break;
  await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s && s.offsetParent) s.click(); else { const x=document.getElementById('dlgBox'); if(x)x.click(); }})()`, false); await sleep(150); } await sleep(300); } };
const reload = async () => {
  await page.eval(`(()=>{ try{ if(window.__save) window.__save(); }catch(e){} })()`, false); await sleep(1500);
  await page.goto(`${BASE}/game.html`); await page.waitFor('!!window.__rv', 600000, 500); await sleep(4500); await skipTalk(); };
let bad = 0; const ok = (c, m) => { console.log(`  ${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) bad++; };
try {
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true; try{ if(!sessionStorage.__sw){ localStorage.clear(); sessionStorage.__sw='1'; } }catch(e){}` });
  await page.goto(`${BASE}/game.html`); await page.waitFor('!!window.__rv', 600000, 500); await sleep(4500);
  /* ① 몬스테라 둘 · 이사 */
  console.log('몬 —', JSON.stringify(await J(`(async()=>{ const st=await import('/src/game/state.js'); const fp=await import('/src/game/first_play.js');
    const S=window.__S(); S.firstPlay.beansprout.harvestCount = fp.MONSTERA_ARRIVAL_RULE.harvestCount; S.firstPlay.beansprout.harvested = true;
    const a = st.givePlant(S, window.__io, { slotId:null }); fp.markMonsteraArrived(S.firstPlay, a);
    return { 화분:(S.pots||[]).map(p=>p.id+'/'+p.growthId) }; })()`)));
  await skipTalk();
  await page.eval(`(()=>{ const S=window.__S(); const ts=S.tutorial; ts.cashWon = ts.rules.moveOutCostWon + 3000000; ts.lamp.unlocked = true;
    ts.varieLeaf = { ever:true, count:1, firstOnDay:S.day }; window.__redraw(); })()`, false); await sleep(600);
  await page.eval(`(()=>{ const b=document.getElementById('moveOut'); if(b){ b.disabled=false; b.click(); } })()`, false); await sleep(1500); await skipTalk();
  await page.eval(`(()=>{ if (window.__S().tutorial.movedOut) return; const p=document.getElementById('movePanel');
    if (p && p.classList.contains('on')) document.getElementById('moveGo').click(); else document.getElementById('moveOut').click(); })()`, false);
  await sleep(6000); await skipTalk(); await reload();
  const room0 = await J(`(()=>{ const S=window.__S(); return { 방:S.home.room, 날:S.day, 등:S.lamps.count }; })()`);
  console.log('원룸 —', JSON.stringify(room0));
  ok(room0.방 === 'oneroom', '원룸으로 이사했다');
  /* ② 가구점에서 사서 받아 놓기(화면 손) */
  await page.eval(`(()=>{ const S=window.__S(); S.tutorial.cashWon = Math.max(S.tutorial.cashWon, 3000000); S.lamps.count = 0; window.__redraw(); })()`, false);
  await page.eval(`(()=>{ window.__byeotSheet.open('shop'); })()`, false); await sleep(800);
  await page.eval(`(()=>{ const b=[...document.querySelectorAll('#shopGroups [data-sg]')].find(x=>x.dataset.sg==='furn'); if(b) b.click(); })()`, false); await sleep(1200);
  const row = await J(`(()=>{ const b=document.querySelector('#shopList [data-buy="furn_${PICK}"]'); if(!b) return null; const r=b.closest('.shopRow');
    return { 글:r ? r.innerText.replace(/\\s+/g,' ').slice(0,80) : '', 그림: !!(r && r.querySelector('.fthumb')) }; })()`);
  console.log('가구점 줄 —', JSON.stringify(row));
  ok(!!row && row.그림, `가구점에 ${PICK} 줄이 그림과 같이 선다`);
  await page.eval(`(()=>{ const b=document.querySelector('#shopList [data-buy="furn_${PICK}"]'); if(b){ b.scrollIntoView({block:'center'}); b.click(); } })()`, false); await sleep(900);
  await page.eval(`(()=>{ const g=document.getElementById('buyGo'); if(g && g.offsetParent) g.click(); })()`, false); await sleep(900); await skipTalk();
  await page.shot(`${OUTDIR}/1_shop.png`);
  for (let d = 0; d < 6; d++) {
    const st = await J(`(async()=>{ const sh=await import('/src/game/shop.js'); const loop=await import('/src/game/loop.js'); const S=window.__S();
      if (sh.stockOf(S, 'furn_${PICK}') > 0) return { stock: 1 }; loop.runDays(S, window.__io, 1); try{window.__redraw();}catch(e){} return { stock: sh.stockOf(S, 'furn_${PICK}') }; })()`);
    if (st.stock > 0) break;
  }
  await skipTalk();
  await page.eval(`(()=>{ window.__byeotSheet.open('bag'); })()`, false); await sleep(1000);
  const hasCell = await page.eval(`String(!!document.querySelector('#bagGrid [data-furnstock="furn_${PICK}"]'))`);
  ok(hasCell === 'true', '가방 «산 가구» 칸에 섰다');
  await page.eval(`(()=>{ const c=document.querySelector('#bagGrid [data-furnstock="furn_${PICK}"]'); if(c) c.click(); })()`, false);
  await sleep(4000); await skipTalk();
  const uid = await J(`(async()=>{ const st=await import('/src/game/state.js'); const S=window.__S(); const a=(st.addedFurniture(S)||[]).find(f=>f.preset==='${PICK}'); return a ? a.uid : null; })()`);
  ok(!!uid, `방에 섰다(${uid})`);
  /* ③ 창 앞으로 — [옮기기] 확정과 같은 창구 */
  const moved = await J(`(async()=>{ const st=await import('/src/game/state.js'); const S=window.__S(), io=window.__io;
    const room = io.light.room, win = (room.wins || [])[0]; const W = room.size;
    const sz = (window.__rv.furniture()||[]).find(f=>f.uid==='${uid}'); const d = (sz && sz.size && sz.size.d) || 0.3;
    const cands = [[0.5, -W.d/2 + d/2 + 0.03], [0.2, -W.d/2 + d/2 + 0.03], [1.1, -W.d/2 + d/2 + 0.03], [0.5, -W.d/2 + d/2 + 0.12]];
    let r = null, err = [];
    for (const [x, z] of cands) { try { r = await window.__rv.commitFurnitureAt('${uid}', { x, z, rot: 0 }); if (r) break; } catch (e) { err.push(e.message); } }
    if (!r) return { 탈: '창 앞에 못 놓음', err };
    const map = io.light.furnitureOverrides(); for (const [id, at] of Object.entries(map)) st.setFurniturePlacement(S, id, at, { size: room.size });
    return { to: r.to, err }; })()`);
  console.log('옮김 —', JSON.stringify(moved));
  ok(moved && moved.to, `창 앞으로 옮겼다 ${moved && moved.to ? JSON.stringify(moved.to) : ''}`);
  await reload();
  /* ④ 화분 둘 · 갈래 */
  const set = await J(`(async()=>{ const st=await import('/src/game/state.js'); const S=window.__S(), io=window.__io;
    const slots = (io.light.room.slots || []).filter(s => String(s.slotId).startsWith('${uid}'));
    if (!slots.length) return { 탈: '그 가구 자리가 없다', ids: (io.light.room.slots||[]).map(s=>s.slotId).slice(0,20) };
    const top = slots.slice().sort((a, b) => b.y - a.y)[0];
    const fz = Math.max(...slots.map(s => s.z)) + 0.55;
    const P = S.pots[0];
    const r = '${WHERE}' === 'floor'
      ? st.setPotAt(S, P.id, { x: top.x, y: 0, z: fz }, { slots: io.light.room.slots, size: io.light.room.size })
      : st.setPotAt(S, P.id, { x: top.x, y: top.y, z: top.z, slotId: top.slotId }, { slots: io.light.room.slots, size: io.light.room.size });
    const v = io.light.placeVerdict(slots.map(s => ({ x: s.x, y: s.y, z: s.z, occIdx: s.occIdx })), { novice: false });
    const vB = io.light.placeVerdict([{ x: top.x, y: 0.1, z: fz }], { novice: false });
    return { where: '${WHERE}', pot: { slot: r.slotId, at: r.at }, top: { slotId: top.slotId, y: top.y }, 갈래_대: v, 갈래_바닥: vB }; })()`);
  console.log('놓음 —', JSON.stringify(set));
  ok(set.갈래_대 && ['A', 'B', 'Bp'].includes(set.갈래_대.key), `갈래 함수가 그 화분대를 «여름엔 등 없이 자람» 쪽으로 말한다(${set.갈래_대 && set.갈래_대.key})`);
  ok(set.갈래_바닥 && set.갈래_바닥.key === 'D', `갈래 함수가 그 앞 바닥을 «안 자람»으로 말한다(${set.갈래_바닥 && set.갈래_바닥.key})`);
  await reload();
  await page.shot(`${OUTDIR}/2_placed.png`);
  /* (보기 CHECKVIS=1) 새로 켠 뒤 방 그림에 그 가구가 서 있나 · 옷을 입었나 */
  if (process.env.CHECKVIS) {
    const V = await J(`(()=>{ const rv=window.__rv; const fl=(rv.furniture()||[]).map(f=>f.uid); const rep=window.__v2 && window.__v2.furn ? Object.keys(window.__v2.furn.report().furniture) : null;
      let g=null, info=null; const sc=[...(window.__scenes||[])];
      return { furniture: fl.filter(u=>/add-/.test(u)), allN: fl.length, dress: rep }; })()`);
    console.log('보기 —', JSON.stringify(V));
    await page.close(); process.exit(0);
  }
  /* (진단 DIAG=1) 돌리지 않고 날마다 그날 하늘로 다시 잰다 — 계절·날씨별로 «맑은 날 값»과 «그날 값»을 갈라 본다 */
  if (process.env.DIAG) {
    const D = await J(`(async()=>{ const w=await import('/src/engine/weather.js'); const S=window.__S(), io=window.__io; const P=S.pots[0];
      const rows=[]; for (let d=0; d<180; d++) { const rep = io.light.daily(d, S); const sky = io.light.skyFor ? io.light.skyFor(d, S.sim) : null;
        const s = (rep.report.slots||[]).find(x => x.slotId === P.slotId) || null;
        const a = io.light.dliAt(P.at, { weather: (sky && sky.weather) || 'clear', season: w.seasonOf(d), litHours: 12, lampCount: 0, occIdx: P.at.occIdx });
        rows.push({ d, season: sky ? sky.season : w.seasonOf(d), weather: sky ? sky.weather : null, rep: s ? s.dli : null, at: a.dli }); }
      const by = {}; for (const r of rows) { const k = r.season + '/' + r.weather; (by[k] = by[k] || []).push(r.rep); }
      const mean = x => +(x.reduce((p,q)=>p+q,0)/x.length).toFixed(2);
      const sum = Object.fromEntries(Object.entries(by).map(([k, v]) => [k, { n: v.length, mean: mean(v) }]));
      const clear = s => io.light.dliAt(P.at, { weather:'clear', season:s, litHours:12, lampCount:0, occIdx:P.at.occIdx }).dli;
      return { pot: P.at, slot: P.slotId, by: sum, clear: { spring: clear('spring'), summer: clear('summer') }, sample: rows.filter((r,i)=>i%15===0) }; })()`);
    console.log('진단 —', JSON.stringify(D, null, 1));
    await page.close(); process.exit(0);
  }
  /* ⑤ 봄 → 여름 끝까지 등 0 */
  /* ★ 계절은 «게임의 하늘»(io.light.skyFor(day, S.sim))로 가른다 — seasonOf(day) 가 아니다.
       이사한 판의 0일은 여름 한가운데였다(0~44 여름 · 45~134 가을 · 135~224 겨울 · …). 처음 판은 seasonOf 로 갈라 계절을 잘못 붙였다(10-09). */
  const DAYS = Number(process.env.DAYS || 360);
  const R = await J(`(async()=>{ const st=await import('/src/game/state.js'); const lp=await import('/src/game/loop.js');
    const S=window.__S(), io=window.__io; S.lamps.count = 0;
    const P = S.pots[0]; const TH = io.light.thresholdsOf ? io.light.thresholdsOf('monstera_deliciosa').min : 2.7;
    const gd = () => { try { io.growth.select(P.growthId); return io.growth.growthDays(); } catch (e) { return null; } };
    const num = v => (typeof v === 'number' ? v : v && typeof v === 'object' ? (typeof v.dli === 'number' ? v.dli : null) : null);
    const log = []; let g = gd();
    while (log.length < ${DAYS}) {
      try { st.waterPot(S, { pot: P }); } catch (e) {}
      lp.runDays(S, io, 1);
      const sky = io.light.skyFor(S.day, S.sim); const g2 = gd();
      log.push({ d: S.day, s: sky.season, w: sky.weather, dli: num((P.dliHist || []).slice(-1)[0]), grew: g2 != null && g != null ? g2 - g : 0, lamps: S.lamps.count });
      g = g2;
    }
    const part = (s) => { const L = log.filter(r => r.s === s); const v = L.map(r => r.dli).filter(x => x != null);
      return { 날: L.length, 맑은날: L.filter(r => r.w === 'clear').length, 평균: v.length ? +(v.reduce((p, q) => p + q, 0) / v.length).toFixed(2) : null,
        문턱넘은날: v.filter(x => x >= TH).length, 자란날: L.reduce((p, r) => p + (r.grew > 0 ? r.grew : 0), 0), 등켠날: L.filter(r => r.lamps > 0).length }; };
    return { TH, where: '${WHERE}', 여름: part('summer'), 가을: part('autumn'), 겨울: part('winter'), 봄: part('spring'), 끝: { d: S.day, g } }; })()`);
  console.log('돌림 —', JSON.stringify(R, null, 1));
  fs.writeFileSync(`${OUTDIR}/result.json`, JSON.stringify({ PICK, WHERE, uid, moved, set, R }, null, 1));
  if (R && R.여름) ok(R.여름.날 >= 85 && [R.여름, R.가을, R.겨울, R.봄].every(x => x.등켠날 === 0), `여름 ${R.여름.날}일 · 등은 한 해 내내 꺼짐`);
  await page.eval(`(()=>{ try { window.__redraw(); } catch(e) {} })()`, false); await sleep(6000); await skipTalk(); await sleep(2000);
  await page.shot(`${OUTDIR}/3_summer_end.png`);
} catch (e) { console.log('  FAIL 탈 —', e && e.message); bad++; }
finally { await page.close(); }
console.log(bad ? `probe_d47_stand_window: FAIL (${bad})` : 'probe_d47_stand_window: PASS');
process.exit(bad ? 1 : 0);
