/* ============================================================
   probe_room_zoom_varie_skin.mjs — 무늬 잎이 «갈라진» 판에서 방과 확대가 같은 그림을 쓰나 ([growth] 소유)
   ------------------------------------------------------------
   ★ 2026-10-07 · D4(성숙 무늬 그림을 등급과 잇기 · 박사님 결정)를 하다가 만들었다.
     확대 창(생장 창)은 2026-08-16 부터 등급 그림을 받는다 — game.html §noteLeafGrades 가
     턴마다 shop.potLeafSkinsOf → setLeafSkins 로 넘긴다. ⇒ 방(room_view → plant_assemble)은?
   ⚠ test_skin_room_matches_zoom 은 잎 1장(무늬 없음) 판만 봐서 이 갈림을 못 잡았다.
     그래서 여기서는 «게임 하루 진행(loop.runDays) 그대로» 창턱에서 260일을 키워 무늬 잎이
     갈라지게 한 뒤 맞댄다. 날마다 물을 준다(state.waterPot). 턴마다 게임이 하는 등급 두 줄
     (shop.assignPotLeafGrades → potLeafSkinsOf → 확대 창 setLeafSkins)만 같이 부른다 —
     그 두 줄은 game.html §noteLeafGrades 와 «같은 함수»다(그 함수가 window 에 안 나와 있어서).
   2026-10-07 잰 것(창턱 · 등0 · 260일): 잎256 하프문 — 값 leaf_mat21 · 확대 leaf_mat21 · ★ 방 leaf_mat4(산반 그림)
                                        잎136 산반(중간) — 확대 leaf_mid_albo13 · ★ 방 leaf_mid_albo21
   ⚠ 서버:  python tools/serve.py <포트>  ·  BYEOT_URL=http://localhost:<포트> DAYS=260 node tools/probe_room_zoom_varie_skin.mjs
   ⛔ 값·확률은 안 건드린다. 키우고 · 읽을 뿐이다.
============================================================ */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8971', DAYS = Number(process.env.DAYS || 260);
const page = await launch({ width: 1770, height: 1188, dpr: 1 });
await page.goto(`${BASE}/game.html`); await page.eval('localStorage.clear()', false); await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 150000, 300); await sleep(4500);
const J = async (js, ms = 600000) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message, st:(e.stack||'').slice(0,300)}); } })()`, true, ms));
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
await page.close();
