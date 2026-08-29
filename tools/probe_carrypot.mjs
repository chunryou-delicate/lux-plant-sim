/* tools/probe_carrypot.mjs — **이사할 때 «가구 위에 있던 화분»은 어떻게 되나**
   ------------------------------------------------------------------
   총괄이 짚은 자리: *"몬스테라가 창턱에 있는데 창턱을 담으면? 「몬이는 따라온다」가
   박사님 확정이니 화분도 따라와야 합니다."*
   ⚠ 지금 `moveOut` 은 그 물음을 **안 지나간다** — 무엇을 들고 갈지 `mount` 로만 가른다.
   재는 것: 서랍장 위에 화분을 얹고 이사한 뒤 ① 화분이 «어디»에 있나 ② 사라지나
            ③ 그 가구는 가방에 갔나 ④ 새로 켜도 그대로인가
   ⛔ 값은 안 바꾼다. 고치지도 않는다 — 「지금 어떻게 되나」만 본다. */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8972';
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 400000);
wd.unref && wd.unref();
const page = await launch({ width: 390, height: 844, dpr: 1 });
try { await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 }); } catch {}
await page.goto(`${BASE}/game.html`);
await page.eval('localStorage.clear()', false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 150000, 300);
await sleep(4000);
const J = async (e, t = 60000) => JSON.parse(await page.eval(e, true, t));
const skip = async (n = 40) => {
  for (let i = 0; i < n; i++) {
    const b = await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');
      return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`);
    if (b !== 'true') break;
    await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s)s.click();
      const x=document.getElementById('dlgBox'); if(x)x.click();
      const g=document.getElementById('guideClose'); if(g)g.click();})()`, false);
    await sleep(250);
  }
};
await skip();
/* 몬스테라를 하나 세우고 «서랍장 위»에 얹는다 — 첫날에는 아직 그루가 없다 */
console.log('■ 그루를 세운다 —', JSON.stringify(await J(`(async()=>{
  const st=await import('/src/game/state.js'); const S=window.__S(); const out={};
  try{
    /* ⚠ givePlant 는 «생장 창»을 받아야 한다(§givePlant: setGrowth 를 못 부르면 던진다).
       화면이 부를 때 쓰는 그 창을 그대로 넘긴다 — 흉내 내면 여기서 통과한 것이 게임에서 안 통한다. */
    if (!(S.pots||[]).length) st.givePlant(S, window.__io);
    const pot=(S.pots||[])[0];
    const slot=(window.__io.light.room.slots||[]).find(s=>String(s.slotId).startsWith('banjiha-dresser:'));
    out.자리=slot.slotId;
    /* ⚠ placedOnce 를 «같이» 세운다 — 이게 없으면 rehomePot 이 「아직 한 번도 안 놓은
       가방 속 화분」으로 보고 안 앉힌다(state §rehomePot). 사람이 놓은 판을 흉내 내려면 필요하다.
       ⚠ 처음에 이걸 빼고 재서 「이사 뒤 화분이 안 앉는다」를 볼 뻔했다 — 자가 만든 판이었다. */
    pot.slotId=slot.slotId; pot.at=null; pot.placedOnce=true;
    out.화분=pot.id; out['얹은 곳']=pot.slotId;
    /* 그리고 «창턱»에도 하나 — 창턱은 붙박이라 안 들고 간다. 견줌으로 둔다 */
    out['창턱 자리']=(window.__io.light.room.slots||[]).some(s=>String(s.slotId).startsWith('banjiha-sill:'));
  }catch(e){ out.탈=e.message; }
  return JSON.stringify(out); })()`)));
await page.eval(`window.__redraw()`, false);
await sleep(800);
console.log('■ 이사 전 —', JSON.stringify(await J(`(()=>{ const S=window.__S();
  return JSON.stringify({ 방:S.home.room,
    화분:(S.pots||[]).map(p=>({ id:p.id, slotId:p.slotId, at: p.at? '있음':null })),
    자리:(window.__io.light.room.slots||[]).length }); })()`)));
/* 이사 */
await page.eval(`(()=>{ const S=window.__S(); const ts=S.tutorial;
  ts.cashWon = ts.rules.moveOutCostWon + 100000;
  ts.varieLeaf = { ever:true, count:1, firstOnDay:S.day }; window.__redraw(); })()`, false);
await sleep(600);
await page.eval(`(()=>{ const b=document.getElementById('moveOut'); if(b){ b.disabled=false; b.click(); } })()`, false);
await sleep(6000);
await skip(20);
await sleep(2000);
console.log('');
console.log('=== ①②③ 이사 «직후» ===');
console.log(' ', JSON.stringify(await J(`(()=>{ const S=window.__S();
  const bag=(S.home||{}).furnitureBag||[];
  return JSON.stringify({ 방:S.home.room,
    화분:(S.pots||[]).map(p=>({ id:p.id, slotId:p.slotId, at: p.at? [p.at.x,p.at.y,p.at.z].map(v=>Math.round(v*100)/100):null, onUid:(p.at||{}).onUid||null })),
    '가방에 든 가구': bag.map(f=>f.uid),
    '서랍장을 들고 갔나': bag.some(f=>f.uid==='banjiha-dresser'),
    '새 방 자리': (window.__io.light.room.slots||[]).map(s=>s.slotId).slice(0,20) }); })()`)));
/* 새로 켠다 — 3D 가 실제로 어떻게 세우는지는 새 판에서만 볼 수 있다(헤드리스 벽) */
await page.eval(`(()=>{ try{ if(window.__save) window.__save(); }catch(e){} })()`, false);
await sleep(1500);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 180000, 500);
await sleep(4000);
console.log('');
console.log('=== ④ 새로 켠 뒤 — 화분이 «어디»에 서 있나 ===');
console.log(' ', JSON.stringify(await J(`(()=>{ const S=window.__S();
  const slots=(window.__io.light.room.slots||[]).map(s=>s.slotId);
  const p=(S.pots||[])[0];
  return JSON.stringify({ 방:S.home.room,
    화분: p? { id:p.id, slotId:p.slotId, at: p.at? [p.at.x,p.at.y,p.at.z].map(v=>Math.round(v*100)/100):null,
               onUid:(p.at||{}).onUid||null } : null,
    '그 자리가 이 방에 있나': p && p.slotId ? slots.includes(p.slotId) : null,
    '방 자리 수': slots.length,
    '3D 에 화분이 섰나': (()=>{ try{ return (window.__rv.plants? window.__rv.plants().length : null); }catch(e){ return 'n/a'; } })(),
    가방:((S.home||{}).furnitureBag||[]).length }); })()`)));
console.log('');
console.log('=== ⑤ 그 자리는 «밝은» 자리인가 — 열다섯 중 몇째인가 ===');
console.log(' ', await page.eval(`(()=>{ const S=window.__S();
  const rep=window.__io.light.daily(S.day+1, S).report;
  const rows=[...(rep.slots||[])].sort((a,b)=>b.dli-a.dli)
    .map((s,i)=>({ 등수:i+1, 자리:s.slotId, dli:Math.round(s.dli*100)/100 }));
  const p=(S.pots||[])[0];
  const mine=rows.find(r=>r.자리===(p&&p.slotId));
  return JSON.stringify({ '몬이 자리': mine||null, '제일 밝은 곳': rows[0], '제일 어두운 곳': rows[rows.length-1],
    '열다섯 중': rows.length }); })()`));
await page.shot('docs/handoff/img/carrypot.png').catch(() => {});
await page.close(); clearTimeout(wd);
