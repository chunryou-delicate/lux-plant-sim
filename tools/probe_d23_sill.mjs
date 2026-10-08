/* tools/probe_d23_sill.mjs — **벽에 붙은 창턱의 몬스테라는 «그림만» 방 쪽으로** (2026-10-08 · 총괄 D23)
   ------------------------------------------------------------------
   house-sill-leaf-wall-20261008 ④ 를 넣은 뒤 «배선»을 본다(잎이 벽에서 얼마나 나왔나는 house 의 probe_sill_leaf_wall 이 잰다):
     ① 창턱(banjiha-sill:0) 그루 — 그림 자리(pos)가 빛 자리(at)보다 방 쪽(+z)으로 0.25m · 굴광성 0.25
     ② 자리 이름으로 물은 화면 점(screenPosOf('banjiha-sill:0'))이 그림을 짚는다(빛 자리를 안 짚는다)
     ③ 빛 자리(at)·세이브 자리는 그대로 — 그림만 옮겼다
     ④ 대조: 창턱이 아닌 자리의 그루는 pos == at · 굴광성 0.5
   판: 폰 390×844 · 반지하. ⛔ 값 0. */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:9300';
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 400000);
wd.unref && wd.unref();
const page = await launch({ width: 390, height: 844, dpr: 1 });
await page.goto(`${BASE}/game.html`);
await page.eval('localStorage.clear()', false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 240000, 500);
await sleep(3500);
const J = async (e) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${e})); } catch(e) { return JSON.stringify({ 탈:e.message }); } })()`, true, 60000));
let fail = 0;
const d = (a, b) => (a && b) ? Math.hypot(a.x - b.x, a.y - b.y) : null;
const ok = (c, msg, got) => { console.log(`  ${c ? 'OK  ' : 'FAIL'} ${msg}${got !== undefined ? ' → ' + JSON.stringify(got) : ''}`); if (!c) fail++; };
const r2 = v => Math.round(v * 1000) / 1000;
console.log('■ 선물 그루를 창턱에 —', JSON.stringify(await J(`(async()=>{ const st=await import('/src/game/state.js'); const S=window.__S();
  if(!(S.pots||[]).length) st.givePlant(S, window.__io, { slotId:'banjiha-sill:0' });
  const p=S.pots[0]; S.firstPlay.monstera.arrived=true; try { window.__redraw && window.__redraw(); } catch(e){}
  return { pot:p.id, slotId:p.slotId, at:p.at }; })()`)));
let mon = null;
for (let i = 0; i < 40 && !mon; i++) {
  await sleep(500);
  mon = await J(`(window.__rv.plants()||[]).find(p=>p.kind==='monstera' || (p.potId==='pot_01')) || null`);
}
ok(!!mon, '① 방에 그루가 섰다', mon && { key: mon.key, pos: mon.pos, at: mon.at, photo: mon.photo });
if (mon) {
  const dx = r2(mon.pos.x - mon.at.x), dz = r2(mon.pos.z - mon.at.z);
  ok(Math.abs(dz - 0.25) < 1e-3 && Math.abs(dx) < 1e-3, `① 그림만 방 쪽(+z)으로 0.25m (dx ${dx} · dz ${dz})`);
  ok(mon.photo === 0.25, '① 굴광성 0.25', mon.photo);
  /* ⚠ 처음엔 여기서 떨어졌다 — 받침을 «그림 자리»에서 쟀더니 house 의 늘린 받침(광선 안 받음)을 지나 창턱 밑 면(0.794)에 앉았다 */
  ok(Math.abs(mon.pos.y - mon.at.y) < 0.01, `① 창턱 상판 높이에 앉는다(그림 y ${r2(mon.pos.y)} · 상판 ${r2(mon.at.y)})`);
  const S0 = await J(`(()=>{ const p=window.__S().pots[0]; return { slotId:p.slotId, at:p.at }; })()`);
  ok(!S0.at || Math.abs(S0.at.z - mon.at.z) < 1e-6, '③ 상태의 빛 자리(pot.at)는 그림 자리로 안 바뀐다', S0.at && r2(S0.at.z));
  /* ② 자리 열쇠 길 — 그 열쇠의 점은 «그루 그림의 원점»이다(예전부터 group.position). 같은 높이에서 빛 자리와 견준다 */
  const sp = await J(`(()=>{ const rv=window.__rv; const m=(rv.plants()||[]).find(p=>p.potId==='pot_01');
    return { bySlot: rv.screenPosOf('banjiha-sill:0'),
             draw: rv.worldToScreen(m.pos.x, m.pos.y, m.pos.z), light: rv.worldToScreen(m.at.x, m.pos.y, m.at.z) }; })()`);
  ok(d(sp.bySlot, sp.draw) < 1 && d(sp.bySlot, sp.light) > 5,
     `② (자리 열쇠 길) 자리 이름으로 물은 점이 그림을 짚는다(그림까지 ${d(sp.bySlot, sp.draw)?.toFixed(1)}px · 같은 높이 빛 자리까지 ${d(sp.bySlot, sp.light)?.toFixed(1)}px)`);
}
/* ⑤ 좌표 길 — 실제 판의 화분은 좌표(pot.at)로 선다(free:pot_01). 자리 이름으로 물어도 그림을 짚나(resolveKey ③) */
console.log('■ 좌표로 다시 세움 —', JSON.stringify(await J(`(async()=>{ const pl=await import('/src/game/place.js'); const S=window.__S(); const p=S.pots[0];
  const s=(window.__rv.slots()||[]).find(x=>x.slotId==='banjiha-sill:0');
  p.at = pl.atFromSlot({ slotId:s.slotId, x:s.pos.x, y:s.pos.y, z:s.pos.z }); try { window.__redraw && window.__redraw(); } catch(e){}
  return { at:p.at }; })()`)));
let mf = null;
for (let i = 0; i < 40 && !mf; i++) { await sleep(500); mf = await J(`(window.__rv.plants()||[]).find(p=>p.potId==='pot_01' && p.free) || null`); }
ok(!!mf, '⑤ 좌표 열쇠로 섰다', mf && { key: mf.key, pos: mf.pos, photo: mf.photo });
if (mf) {
  ok(Math.abs(r2(mf.pos.z - mf.at.z) - 0.25) < 1e-3 && mf.photo === 0.25 && Math.abs(mf.pos.y - mf.at.y) < 0.01,
     `⑤ 좌표 길도 그림 +0.25m · 굴광성 0.25 · 상판에 앉음 (dz ${r2(mf.pos.z - mf.at.z)} · y ${r2(mf.pos.y)}/${r2(mf.at.y)})`);
  const sq = await J(`(()=>{ const rv=window.__rv; const m=(rv.plants()||[]).find(p=>p.potId==='pot_01' && p.free);
    return { bySlot: rv.screenPosOf('banjiha-sill:0'), byKey: rv.screenPosOf(m.key),
             drawAtSlotY: rv.worldToScreen(m.pos.x, m.at.y, m.pos.z), lightAtSlotY: rv.worldToScreen(m.at.x, m.at.y, m.at.z) }; })()`);
  ok(d(sq.bySlot, sq.drawAtSlotY) < 1 && d(sq.bySlot, sq.lightAtSlotY) > 5,
     `⑤ 자리 이름으로 물은 점(손가락 §5867)이 그림 x·z 를 짚는다(그림까지 ${d(sq.bySlot, sq.drawAtSlotY)?.toFixed(1)}px · 빛 자리까지 ${d(sq.bySlot, sq.lightAtSlotY)?.toFixed(1)}px)`);
  ok(!!sq.byKey, '⑤ 그루 열쇠로 물은 점(말풍선)도 있다', sq.byKey);
  /* ⑥ 자리를 차지하는 것은 빛 자리다 — 그 창턱에 화분을 하나 더 놓으려 하면 «겹칩니다»(처음엔 그림 자리로 재서 «비었다»가 됐다) */
  const oc = await J(`(()=>{ const rv=window.__rv; const m=(rv.plants()||[]).find(p=>p.potId==='pot_01' && p.free);
    const c=document.getElementById('roomCanvas').getBoundingClientRect(); const q=rv.worldToScreen(m.at.x, m.at.y, m.at.z);
    const r=rv.surfaceAt(c.left+q.x, c.top+q.y, { potD:0.2 });
    return { slotOccupied: ((rv.slots()||[]).find(x=>x.slotId==='banjiha-sill:0')||{}).occupied, ok:r.ok, onUid:r.onUid, reason:r.reason }; })()`);
  ok(oc.slotOccupied === true && oc.ok === false && /겹칩니다/.test(oc.reason || ''), '⑥ 창턱 빛 자리는 «찼다» — 둘째 화분은 «겹칩니다»', oc);
}
/* ④ 대조 — 창턱이 아닌 자리에 같은 그루를 하나 더 세운다(방 화면에만 · 상태 안 바꿈) */
const ctl = await J(`(async()=>{ const rv=window.__rv;
  const slots=(rv.slots ? rv.slots() : []) || [];
  const s = slots.find(x => x && x.slotId && !/sill/i.test(x.slotId) && !x.occupied && x.pos && x.pos.y > 0.3) || null;
  if (!s) return { 탈:'창턱 아닌 자리를 못 찾음', n: slots.length };
  await rv.setPlant(s.slotId, { kind:'monstera', growthDays:45, potId:'probe_ctl' });
  const m=(rv.plants()||[]).find(p=>p.key===s.slotId);
  return { slotId:s.slotId, pos:m && m.pos, at:m && m.at, photo:m && m.photo, slot:{ x:s.pos.x, z:s.pos.z } }; })()`);
if (ctl.탈) console.log('  INFO 대조 —', JSON.stringify(ctl));
else ok(ctl.photo === 0.5 && Math.abs(ctl.pos.x - ctl.slot.x) < 1e-6 && Math.abs(ctl.pos.z - ctl.slot.z) < 1e-6,
        `④ 창턱 아닌 자리(${ctl.slotId}) — 그림 = 빛 자리 · 굴광성 0.5`, { photo: ctl.photo, pos: ctl.pos, slot: ctl.slot });
await page.eval(`(()=>{ try { window.__rv.setPlant(${JSON.stringify((ctl && ctl.slotId) || '')}, null); } catch(e){} })()`, false);
await sleep(800);
if (process.env.SHOT) { await page.shot(process.env.SHOT); console.log('■ 찍음 —', process.env.SHOT); }
await page.close(); clearTimeout(wd);
console.log(fail ? `\nprobe_d23_sill: FAIL ${fail}` : '\nprobe_d23_sill: PASS');
process.exit(fail ? 1 : 0);
