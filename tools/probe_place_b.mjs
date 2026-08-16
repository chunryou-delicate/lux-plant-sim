/* ============================================================
   tools/probe_place_b.mjs — FIXLIST §B 를 「재는」 도구
   ------------------------------------------------------------
   짐작으로 고치지 않으려고 먼저 잰다. 재는 것은 다섯이다.
     ① 가구 윗면 칸  — 상판마다 칸이 몇이고 추천 자리와 몇이 겹치나(B-1)
     ② 가구 옮기기   — 방 밖으로 끌면 어디에 서나(B-2)
     ③ 바닥 붉은 칸  — 가구를 옮길 때 몇 칸이 붉나(B-3)
     ④ 얹힌 화분     — 가구를 옮기면 화분이 따라오나(B-5)
     ⑤ 가구 시작 자리 — 벽까지 얼마나 떠 있나(B-6)
   ★ 값만 낸다. 고치지 않는다.
============================================================ */
import { launch, sleep } from './test_cdp.mjs';

const _WD = +(process.env.BYEOT_PROBE_TIMEOUT_MS || 420000);
const _wd = setTimeout(() => { console.error('⏱ 자가 제한 초과'); process.exit(2); }, _WD);
_wd.unref && _wd.unref();

const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const ONLY = (process.argv[2] || 'all');

const page = await launch({ width: 1280, height: 900, dpr: 1, mobile: false });
const errs = [];
page.on((m, p) => {
  if (m === 'Runtime.exceptionThrown') errs.push(p.exceptionDetails && p.exceptionDetails.text);
  if (m === 'Log.entryAdded' && p.entry && p.entry.level === 'error') errs.push(p.entry.text);
});
await page.goto(`${BASE}/game.html`);
await page.eval(`localStorage.clear()`, false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 180000, 300);
await page.waitFor('window.__byeotBooted === true', 180000, 300);
await sleep(6000);
await page.eval(`(()=>{ for(let i=0;i<40;i++){ try{ document.getElementById('dlgSkip').click() }catch{} } })()`, false);
await sleep(1500);

const J = s => JSON.parse(s);

/* ── ① 가구 윗면 칸 (B-1) ─────────────────────────────────── */
if (ONLY === 'all' || ONLY === 'cells') {
  for (const potD of [0.24, 0.20]) {
    const r = J(await page.eval(`(()=>{ const rv=window.__rv;
      rv.showSlotRings(true, { potD: ${potD} });
      const cells = rv.guideCells({ potD: ${potD} });
      const slots = rv.slots();
      const rings = rv.slotRings();
      const byUid = {};
      for (const c of cells) { const u = c.uid || '?';
        (byUid[u] = byUid[u] || { cells: [], slots: [] }).cells.push(c); }
      for (const s0 of slots) { const u = String(s0.slotId).slice(0, String(s0.slotId).lastIndexOf(':'));
        const s = { slotId: s0.slotId, x: s0.pos.x, y: s0.pos.y, z: s0.pos.z, maxPotD: s0.maxPotD };
        (byUid[u] = byUid[u] || { cells: [], slots: [] }).slots.push(s); }
      const out = [];
      for (const [u, v] of Object.entries(byUid)) {
        /* 그 상판의 칸 한가운데에서 자리가 얼마나 벗어나 있나 */
        const off = v.slots.map(s => {
          let best = null, bd = Infinity;
          for (const c of v.cells) { if (Math.abs(c.y - s.y) > 0.06) continue;
            const d = Math.hypot(c.x - s.x, c.z - s.z); if (d < bd) { bd = d; best = c; } }
          return { slotId: s.slotId, d: +bd.toFixed(4) };
        });
        out.push({ uid: u, 칸: v.cells.length, 자리: v.slots.length,
                   그려진표시: v.cells.length + v.slots.length,
                   자리가칸중심에서벗어난거리: off,
                   snapErrMax: +Math.max(0, ...v.cells.map(c => c.snapErr || 0)).toFixed(6),
                   칸크기: v.cells.length ? [v.cells[0].cw, v.cells[0].cd] : null,
                   상판: v.cells.length ? [v.cells[0].rectW, v.cells[0].rectD] : null });
      }
      return JSON.stringify(out); })()`));
    console.log(`\n■ B-1 · 끌고 있는 물건 지름 ${potD}m — 상판마다 그려지는 표시`);
    for (const o of r) console.log('  ' + JSON.stringify(o));
  }
}

/* ── ⑤ 가구 시작 자리 (B-6) ───────────────────────────────── */
if (ONLY === 'all' || ONLY === 'corner') {
  const r = J(await page.eval(`(()=>{ const rv=window.__rv;
    const g = rv.grid(); const inn = g.room.inner;
    const fs = rv.furniture();
    return JSON.stringify({ inner: inn, furn: fs.map(f => {
      const q = Math.abs(Math.round((f.rot||0)/90)) % 2 === 1;
      const w = q ? f.size.d : f.size.w, d = q ? f.size.w : f.size.d;
      return { uid: f.uid, x: f.x, z: f.z, rot: f.rot, w:+w.toFixed(3), d:+d.toFixed(3),
               벽까지: { 왼:+(f.x - w/2 - inn.x0).toFixed(3), 오:+(inn.x1 - f.x - w/2).toFixed(3),
                        뒤:+(f.z - d/2 - inn.z0).toFixed(3), 앞:+(inn.z1 - f.z - d/2).toFixed(3) } };
    }) }); })()`));
  console.log(`\n■ B-6 · 방 안쪽 ${JSON.stringify(r.inner)}`);
  for (const f of r.furn) console.log('  ' + JSON.stringify(f));
}

/* ── ② 방 밖으로 끌기 (B-2) · ③ 붉은 칸 (B-3) ────────────── */
if (ONLY === 'all' || ONLY === 'drag') {
  const r = J(await page.eval(`(()=>{ const rv=window.__rv;
    const uid='banjiha-bed'; const f=(rv.furniture()||[]).find(x=>x.uid===uid);
    const step = rv.moveStep();
    const probe = [];
    for (const [x,z] of [[0,0],[-9,0],[9,0],[0,-9],[0,9],[-2.4,-1.9],[3.2,2.6]]) {
      let sn=null, fit=null;
      try { sn = rv.snapFurniture(uid,{x,z,rot:f.rot,step}); } catch(e){ sn='ERR '+e.message; }
      try { fit = sn && sn.x!=null ? rv.furnitureFit(uid,{x:sn.x,z:sn.z,rot:sn.rot}) : null; } catch(e){ fit='ERR '+e.message; }
      probe.push({ 끈자리:[x,z], 앉는자리: sn && sn.x!=null ? [sn.x,sn.z] : sn, ok: fit && fit.ok, why: fit && fit.reason });
    }
    const free = rv.showGrid(true, { uid });
    const g = rv.grid();
    rv.showGrid(false);
    return JSON.stringify({ 가구:f, 걸음:step, 끌기:probe,
                            바닥칸:{ 전체:g.room.cells, 놓을수있는:g.free, 붉은:g.blocked } }); })()`));
  console.log('\n■ B-2 · 침대를 방 밖으로 끌면 어디 서나');
  console.log('  가구 ' + JSON.stringify(r.가구) + ' 걸음 ' + r.걸음);
  for (const p of r.끌기) console.log('  ' + JSON.stringify(p));
  console.log('\n■ B-3 · 침대를 옮길 때 바닥 칸 ' + JSON.stringify(r.바닥칸));
}

/* ── ④ 얹힌 화분이 따라오나 (B-5) ─────────────────────────── */
if (ONLY === 'all' || ONLY === 'riders') {
  const before = J(await page.eval(`(async()=>{ const rv=window.__rv;
    /* 책상 위 자리에 화분을 하나 세운다(자유 좌표 · 상판 한가운데 칸) */
    const slots = rv.slots().filter(s=>s.slotId.startsWith('banjiha-desk:'));
    const cells = rv.guideCells({ potD: 0.20 }).filter(c=>c.uid==='banjiha-desk');
    /* 자리 하나 + 자유 칸 하나, 둘 다 세운다 */
    const spec = { kind:'monstera', days: 60 };
    await rv.setPlant(slots[0].slotId, spec);
    const c = cells.find(c=>c.fits) || cells[0];
    await rv.setPlantAt('probe-free', { x:c.x, y:c.y, z:c.z, rotY:0, onUid:'banjiha-desk', occIdx:null }, spec);
    return JSON.stringify({ desk: rv.furniture().find(f=>f.uid==='banjiha-desk'),
                            riders: rv.ridersOf('banjiha-desk'),
                            pots: rv.plants ? rv.plants() : null,
                            slot0: slots[0], cell: c }); })()`));
  console.log('\n■ B-5 · 옮기기 전');
  console.log('  ' + JSON.stringify(before));

  const after = J(await page.eval(`(async()=>{ const rv=window.__rv;
    const f = rv.furniture().find(x=>x.uid==='banjiha-desk');
    const to = { x: f.x - 0.5, z: f.z + 0.5, rot: f.rot, step: rv.moveStep() };
    let r=null, err=null;
    try { r = await rv.commitFurnitureAt('banjiha-desk', to); } catch(e){ err = e.message; }
    return JSON.stringify({ 결과:r, 오류:err,
                            desk: rv.furniture().find(x=>x.uid==='banjiha-desk'),
                            pots: rv.plants ? rv.plants() : null,
                            rigs: rv.lightRigs() }); })()`));
  console.log('\n■ B-5 · 옮긴 뒤');
  console.log('  ' + JSON.stringify(after));
}

console.log('\n■ 부팅 JS 예외: ' + errs.length + (errs.length ? ' — ' + JSON.stringify(errs.slice(0, 6)) : ''));
await page.close();
