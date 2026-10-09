/* ============================================================
   tools/test_wall_hang.mjs — 벽 걸이 v1 «걸이 자리» ([house] · 2026-10-10 · 총괄 결정)
   ------------------------------------------------------------
     BYEOT_URL=http://127.0.0.1:9330 node tools/test_wall_hang.mjs     (헤드리스 크롬 하나)
   진짜 방 뷰(tools/room_view_demo.html?engine=1)에서:
     A 걸이 자리 — 반지하 4 · 투룸 6(하나는 주문판 자리) · 처음엔 다 빔 · 기본 카메라에 원이 찍힘
     B 자리표 — 벽 안쪽 면(두께 0.2 의 반)에서 그림 두께 반만큼 안 · 방을 봄 · 가운데 높이 = cy
     C 산 그림을 건다(조도 엔진 setFurnitureEdits = 가구점에서 산 줄과 같은 길) → 그 자리가 참 · 높이 그대로
     D 옮기기 — 빈 자리는 됨 · 찬 자리는 «이미 걸려» · 걸이 자리 밖은 안 됨 · commitFurnitureAt {hang}
     E 부딪힘·빛 차폐에 안 든다(colliders · occluders)
     F 그림 면 — 옷 층 report.faceTex · 달력은 setSeason 으로 쪽이 바뀜
     G 전용 자리 — 투룸 주문판 자리에 포스터는 안 됨 · 주문판은 됨
   ⚠ 가방·가구점 화면 흐름은 core 몫(여기서는 안 본다).
============================================================ */
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { launch, sleep } from './test_cdp.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9330';
const SHOT = process.env.SHOT || null;
let pass = 0, fail = 0;
const ok = (label, cond, extra = '') => { if (cond) { pass++; console.log(`PASS  ${label}`); } else { fail++; console.log(`FAIL  ${label}${extra ? '  — ' + extra : ''}`); } };

async function openRoom(page, room) {
  await page.goto(`${BASE}/tools/room_view_demo.html?room=${room}&engine=1`);
  for (let i = 0; i < 90; i++) { const t = await page.eval('document.title'); if (/DONE/.test(t)) break; await sleep(400); }
  await sleep(1500);
}
const page = await launch({ width: 1100, height: 800, dpr: 1 });
try {
  /* ── 반지하 ── */
  await openRoom(page, 'banjiha');
  const A = await page.eval(`(() => { const s = window.view.hangSpots(); return { n: s.length, free: s.filter(x => x.free).length, shown: s.filter(x => x.screen).length, s }; })()`);
  ok('A 반지하 걸이 자리 넷 · 다 빔', A.n === 4 && A.free === 4, JSON.stringify(A).slice(0, 300));
  ok('A 기본 카메라에 원이 찍힌다(화면 좌표가 있다)', A.shown >= 3, String(A.shown));
  const s1 = A.s.find(x => x.id === 'banjiha-hang-1');
  const pose = await page.eval(`window.view.hangPose('banjiha-hang-1', 'poster_monstera')`);
  ok('B 뒷벽 자리표 — 벽 안쪽 면(−1.90)에서 그림 두께 반 안 · 방을 봄(rot 0) · 높이 cy', Math.abs(pose.z - (-2 + 0.1 + 0.005 + 0.002)) < 1e-3 && pose.rot === 0 && Math.abs(pose.y - s1.y) < 1e-6 && Math.abs(pose.x - (-1.95)) < 1e-6, JSON.stringify(pose));
  const poseL = await page.eval(`window.view.hangPose('banjiha-hang-3', 'frame_field')`);
  ok('B 왼벽 자리표 — x 가 안쪽 면 · 방을 봄(rot 90) · cu 0.9 → z −0.9', Math.abs(poseL.x - (-2.5 + 0.1 + 0.015 + 0.002)) < 1e-3 && poseL.rot === 90 && Math.abs(poseL.z - (-0.9)) < 1e-6, JSON.stringify(poseL));

  /* C 건다 — 가구점에서 산 줄과 같은 길(setFurnitureEdits → refreshFurniture) */
  const C = await page.eval(`(async () => {
    const v = window.view, e = window.engine;
    const p1 = v.hangPose('banjiha-hang-1', 'poster_monstera'), p2 = v.hangPose('banjiha-hang-2', 'calendar_season');
    e.setFurnitureEdits([], [{ uid: 'add-poster_monstera-1', preset: 'poster_monstera', ...p1 }, { uid: 'add-calendar_season-1', preset: 'calendar_season', ...p2 }]);
    await v.refreshFurniture();
    const f = v.furniture().find(x => x.uid === 'add-poster_monstera-1');
    const s = v.hangSpots();
    return { f, s1: s.find(x => x.id === 'banjiha-hang-1'), s2: s.find(x => x.id === 'banjiha-hang-2') };
  })()`);
  ok('C 건 포스터가 방 가구 목록에 있고 높이가 그대로', !!C.f && Math.abs(C.f.y - 1.45) < 1e-3, JSON.stringify(C.f));
  ok('C 그 자리가 참(누가 걸렸나까지)', C.s1 && !C.s1.free && C.s1.uid === 'add-poster_monstera-1' && C.s2 && !C.s2.free, JSON.stringify([C.s1, C.s2]));

  /* D 옮기기 판정 */
  const D = await page.eval(`(() => { const v = window.view;
    return { here: v.furnitureFit('add-poster_monstera-1', { hang: 'banjiha-hang-1' }), empty: v.furnitureFit('add-poster_monstera-1', { hang: 'banjiha-hang-4' }),
             full: v.furnitureFit('add-poster_monstera-1', { hang: 'banjiha-hang-2' }), floor: v.furnitureFit('add-poster_monstera-1', { x: 0, z: 0, y: 0 }),
             same: v.furnitureFit('add-poster_monstera-1', {}) }; })()`);
  ok('D 제자리는 된다', D.here.ok, JSON.stringify(D.here));
  ok('D 빈 자리는 된다', D.empty.ok, JSON.stringify(D.empty));
  ok('D 찬 자리는 «이미 걸려»', !D.full.ok && /이미 걸려/.test(D.full.reason), JSON.stringify(D.full));
  ok('D 걸이 자리 밖(바닥)은 안 된다', !D.floor.ok && /걸이 자리가 아닙니다/.test(D.floor.reason), JSON.stringify(D.floor));
  const D2 = await page.eval(`(async () => { const v = window.view;
    const r = await v.commitFurnitureAt('add-poster_monstera-1', { hang: 'banjiha-hang-4' });
    const s = v.hangSpots(); return { r, s1: s.find(x => x.id === 'banjiha-hang-1'), s4: s.find(x => x.id === 'banjiha-hang-4') }; })()`);
  ok('D 옮기면 옛 자리가 비고 새 자리가 찬다(commitFurnitureAt {hang})', D2.s1.free && !D2.s4.free && D2.s4.uid === 'add-poster_monstera-1', JSON.stringify([D2.s1, D2.s4]));
  let threw = null; try { await page.eval(`window.view.commitFurnitureAt('add-poster_monstera-1', { x: 0, z: 0 })`); } catch (e) { threw = String(e.message || e); }
  ok('D 걸이 그림을 자리표 없이 옮기면 던진다', !!threw && /걸이 자리/.test(threw), threw || '안 던짐');

  /* E 부딪힘·빛 차폐 */
  const E = await page.eval(`(() => { const b = window.engine.room.built; const q = window.view.furniture().find(x => x.uid === 'add-poster_monstera-1');
    /* 그 포스터의 상자(0.30 × 0.01 · 자리 그대로)만 센다 — 옆 난방기 상자를 잡으면 안 된다 */
    const mine = (c) => Math.abs(c.x - q.x) < 0.05 && Math.abs(c.z - q.z) < 0.05 && Math.min(c.w, c.d) < 0.03;
    return { col: (b.colliders || []).filter(c => c.kind === 'furn' && mine(c)).length,
             occ: (b.occluders || []).filter(o => Math.abs(o.x + o.w / 2 - q.x) < 0.3 && Math.abs(o.z + o.d / 2 - q.z) < 0.3 && o.y0 > 1).length, q }; })()`);
  ok('E 걸린 그림은 부딪힘·빛 차폐에 안 든다', E.col === 0 && E.occ === 0, JSON.stringify(E));

  /* F 그림 면 · 달력 계절 */
  await sleep(2500);
  const F = await page.eval(`(() => { const r = (window.__v2 && window.__v2.furn) ? window.__v2.furn.report().furniture : {};
    return { p: r['add-poster_monstera-1'] || null, c: r['add-calendar_season-1'] || null }; })()`);
  ok('F 포스터에 그림 면(faceTex)', F.p && F.p.faceTex === 'textures/wall/poster_monstera.webp', JSON.stringify(F.p));
  ok('F 달력은 봄 쪽으로 시작', F.c && /calendar_spring/.test(F.c.faceTex), JSON.stringify(F.c));
  await page.eval(`window.view.setSeason('winter')`); await sleep(2500);
  const F2 = await page.eval(`(() => { const r = window.__v2.furn.report().furniture; return r['add-calendar_season-1'] || null; })()`);
  ok('F setSeason(겨울) → 달력이 겨울 쪽', F2 && /calendar_winter/.test(F2.faceTex) && F2.season === 'winter', JSON.stringify(F2));
  if (SHOT) { await page.eval(`window.view.setSeason('summer')`); await sleep(2500); await page.shot(SHOT.replace(/\.png$/, '_banjiha.png')); }

  /* G 투룸 — 주문판 전용 자리 */
  await openRoom(page, 'tworoom');
  const G = await page.eval(`(() => { const v = window.view, s = v.hangSpots(); let a = null, b = null;
    try { v.hangPose('tworoom-hang-order', 'poster_moon'); } catch (e) { a = e.message; }
    try { b = v.hangPose('tworoom-hang-order', 'order_board'); } catch (e) { b = 'ERR ' + e.message; }
    let c = null; try { v.hangPose('tworoom-hang-1', 'order_board'); } catch (e) { c = e.message; }
    return { n: s.length, order: s.filter(x => x.only === 'order_board').length, a, b, c }; })()`);
  ok('G 투룸 걸이 자리 여섯 · 주문판 자리 하나', G.n === 6 && G.order === 1, JSON.stringify(G));
  ok('G 주문판 자리에 포스터는 안 된다 · 주문판은 된다 · 주문판은 다른 자리에 안 된다', !!G.a && G.b && typeof G.b === 'object' && !!G.c, JSON.stringify(G));
  if (SHOT) await page.shot(SHOT.replace(/\.png$/, '_tworoom.png'));
} finally { await page.close(); }
console.log(`\nwall_hang: ${fail ? 'FAIL' : 'PASS'} (${pass}/${pass + fail})`);
process.exit(fail ? 1 : 0);
