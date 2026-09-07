/* tools/_probe_rundays_leak.mjs — **runDays 로만 날을 보내면 유효일이 «열에 하나»만 도는 까닭** (2026-09-07 · [growth] 뒷받침)
   [growth] 셈: 창턱은 band 'slow' 라 하루 1.0 ⇒ 90일이면 유효일 90. 내가 잰 것: 9. ⇒ «어디서 빠지나»를 하루씩 본다.
   재는 것: 날마다 ① 그 자리의 빛(보고 dli) ② 유효일 ③ 하루 결산이 그루에 무엇을 먹였나(io.growth 쪽 수)
   ⛔ 값 0 · 고치지 않는다. 읽기만. */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8972';
const N = Number(process.env.DAYS || 10);
const page = await launch({ width: 1770, height: 1188, dpr: 1 });
await page.goto(`${BASE}/game.html`);
await page.eval('localStorage.clear()', false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 150000, 300);
await sleep(4000);
const J = async (js, ms = 60000) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, ms));
console.log('① 창턱에 세움 —', JSON.stringify(await J(`(async()=>{ const st=await import('/src/game/state.js'); const fp=await import('/src/game/first_play.js'); const S=window.__S();
  S.firstPlay.beansprout.harvestCount = fp.MONSTERA_ARRIVAL_RULE.harvestCount; S.firstPlay.beansprout.harvested = true;
  const a = st.givePlant(S, window.__io, { slotId:null }); fp.markMonsteraArrived(S.firstPlay, a);
  const p=(S.pots||[])[0]; const slots=window.__io.light.room.slots||[]; const slot=slots.find(x=>/sill/.test(x.slotId));
  st.setPotAt(S, p.id, { x:slot.x, y:slot.y, z:slot.z, slotId:slot.slotId }, { slots, size: window.__io.light.room.size });
  try { fp.moveMonstera(S.firstPlay, slot.slotId); } catch(e) {}
  return { 자리:(S.pots||[])[0].slotId, 유효일:(()=>{ try { return window.__io.growth.leafStats().growthDays; } catch(e) { return null; } })() }; })()`)));
for (let i = 0; i < N; i++) {
  const r = await J(`(async()=>{ const loop=await import('/src/game/loop.js'); const S=window.__S();
    const before = (()=>{ try { return window.__io.growth.leafStats().growthDays; } catch(e) { return null; } })();
    const { turns } = loop.runDays(S, window.__io, 1);
    const t = turns[turns.length-1] || {};
    const after = (()=>{ try { return window.__io.growth.leafStats().growthDays; } catch(e) { return null; } })();
    const rep = t.report || null; const p=(S.pots||[])[0]||{};
    const slotRow = rep && (rep.slots||[]).find(s=>s.slotId===p.slotId);
    return { 날:S.day, 유효일전:before, 유효일후:after, 하루:(after!=null&&before!=null)?+(after-before).toFixed(3):null,
             그자리dli: slotRow ? +Number(slotRow.dli).toFixed(3) : null,
             턴키: Object.keys(t).slice(0,10), 그루수:(S.pots||[]).length,
             plant: t.plant ? { keys:Object.keys(t.plant).slice(0,8) } : null }; })()`, 60000);
  console.log(`   d${r.날} · 유효일 ${r.유효일전} → ${r.유효일후}(+${r.하루}) · 그 자리 dli ${r.그자리dli}`);
  if (i === 0) console.log('   턴 키 —', JSON.stringify(r.턴키), '· plant —', JSON.stringify(r.plant));
}
console.log('② 하루 결산이 그루를 먹이는 자리 —', JSON.stringify(await J(`(()=>{ const g=window.__io.growth; return {
  advanceTo: typeof g.advanceTo, feed: typeof g.feed, setDaily: typeof g.setDaily, leafStats: typeof g.leafStats,
  dliFedCount: (()=>{ try { return g.dliFedCount((window.__S().pots||[])[0].id); } catch(e) { return '탈'; } })() }; })()`)));
await page.close();
