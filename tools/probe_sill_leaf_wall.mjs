/* tools/probe_sill_leaf_wall.mjs — [house] 2026-10-08 · 창턱 몬스테라 잎이 벽에 묻히나 (docs/handoff/house-sill-leaf-wall-20261008.md)
   쓰기: BYEOT_URL=http://localhost:9330 DAYS=260 node tools/probe_sill_leaf_wall.mjs   (SHOT= 주면 마지막 화면을 찍는다)
   ⚠ 헤드리스 크롬 하나를 띄운다 — 여유 램 4GB 밑이면 기다린다(총괄 10-08 규칙) */
/* 창턱 몬스테라 잎이 벽에 묻히나 — 반지하 banjiha-sill:0 · DAYS 일 (leaf tools/leaf/_shot_room_varie.mjs 와 같은 세움·돌림)
   재는 것: ① 화분 중심 ↔ 창 벽 안쪽 면 거리 ② 잎·줄기 정점이 벽면 너머(z < 안쪽 면)로 나간 비율 — 창 구멍 안 / 벽 속
           ③ 기본 카메라에서 잎 겉면 표본점이 가려지는 비율과 무엇이 가리나 ④ 굴광성 세기(photo)만 바꿔 다시 지으면 ②가 어떻게 되나
   장면은 «THREE 전역이 걸리는 순간» 렌더러 render 를 감싸 붙잡는다(재기 전용 · 게임 코드 안 고침). */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:9330'   /* house 검사 포트 9330대 */, DAYS = Number(process.env.DAYS || 260);
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 2400000); wd.unref && wd.unref();
const page = await launch({ width: 390, height: 844, dpr: 1 });
await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `(function(){ let T;
  try { Object.defineProperty(window, 'THREE', { configurable: true, get(){ return T; }, set(v){ T = v;
    try { let O; Object.defineProperty(v, 'Object3D', { configurable: true, enumerable: true, get(){ return O; }, set(c){ O = c;
      try { const pa = c.prototype.add, pu = c.prototype.updateMatrixWorld;
        c.prototype.add = function(...a){ if (this.isScene) { (window.__scenes = window.__scenes || new Set()).add(this); window.__lastScene = this; } return pa.apply(this, a); };
        c.prototype.updateMatrixWorld = function(f){ if (this.isPerspectiveCamera) (window.__pcams = window.__pcams || new Set()).add(this); return pu.call(this, f); };
      } catch(e) {} } }); } catch(e) {} } }); } catch(e) {} })();` });
await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `try{ if(!sessionStorage.__sw){ localStorage.clear(); sessionStorage.__sw='1'; } }catch(e){}` });
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 600000, 500); await sleep(4500);
const J = async (js, ms = 1800000) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message, st:(e.stack||'').slice(0,300)}); } })()`, true, ms));
console.log('세움 —', JSON.stringify(await J(`(async()=>{ const st=await import('/src/game/state.js'); const fp=await import('/src/game/first_play.js');
  const S=window.__S(); S.firstPlay.beansprout.harvestCount = fp.MONSTERA_ARRIVAL_RULE.harvestCount; S.firstPlay.beansprout.harvested = true;
  const a = st.givePlant(S, window.__io, { slotId:null }); fp.markMonsteraArrived(S.firstPlay, a);
  const p=(S.pots||[])[0]; const slots=window.__io.light.room.slots||[]; const slot=slots.find(x=>/sill/.test(x.slotId));
  st.setPotAt(S, p.id, { x:slot.x, y:slot.y, z:slot.z, slotId:slot.slotId }, { slots, size: window.__io.light.room.size });
  return { 자리:p.slotId, slot:{x:slot.x,y:slot.y,z:slot.z} }; })()`)));
console.log('돌림 —', JSON.stringify(await J(`(async()=>{ const st=await import('/src/game/state.js'); const lp=await import('/src/game/loop.js');
  const S=window.__S(), io=window.__io;
  for (let d=0; d<${DAYS}; d++){ try { st.waterPot(S); } catch(e) {} lp.runDays(S, io, 1); }
  return { 날:S.day, 잎:(io.growth.leafState()||[]).length }; })()`)));
await page.eval(`(()=>{ try { window.__redraw(); } catch(e) {} })()`, false); await sleep(8000);
for (let k = 0; k < 4; k++) { for (let i = 0; i < 40; i++) {
  if (await page.eval(`String(document.getElementById('stage').classList.contains('talking'))`) !== 'true') break;
  await page.eval(`(()=>{const x=document.getElementById('dlgBox'); if(x)x.click();})()`, false); await sleep(150); } await sleep(300); }
for (let w = 0; w < 8000; w += 100) { if (await page.eval(`String((()=>{ try { return !!window.__rv.camBusy().tween; } catch(e) { return false; } })())`) !== 'true') break; await sleep(100); }
await sleep(2500);
const R = await J(`(async()=>{
  const T = window.THREE; const scenes = [...(window.__scenes || [])];
  if (!scenes.length) return { 탈:'장면을 못 붙잡음' };
  /* 방 카메라 = room_view.worldToScreen 과 같은 화면 좌표를 내는 원근 카메라 */
  const cv = document.getElementById('roomCanvas').getBoundingClientRect(); const probeP = new T.Vector3(0, 1.585, -1.85);
  const want = window.__rv.worldToScreen(probeP.x, probeP.y, probeP.z); let cam = null, bestErr = 1e9;
  for (const c of (window.__pcams || [])) { c.updateMatrixWorld(true); const q = probeP.clone().project(c); const sx = (q.x * 0.5 + 0.5) * cv.width, sy = (-q.y * 0.5 + 0.5) * cv.height;
    const err = Math.hypot(sx - want.x, sy - want.y); if (err < bestErr) { bestErr = err; cam = c; } }
  if (!cam || bestErr > 3) return { 탈:'방 카메라를 못 가림', 후보: (window.__pcams || new Set()).size, 최소오차px: bestErr };
  let G = null, S0 = null; const pw = new T.Vector3();
  for (const sc of scenes) { sc.updateMatrixWorld(true); sc.traverse(o => { if (G || !(o.userData && o.userData.isPlantAssembled && o.userData.kind === 'monstera')) return;
    o.getWorldPosition(pw); if (Math.abs(pw.z + 1.85) < 0.3 && Math.abs(pw.x) < 0.5) { G = o; S0 = sc; } }); }
  if (!G) return { 탈:'창턱 근처 몬스테라 그루가 없음', 장면수: scenes.length };
  const WALL_Z = -1.9, OPEN = { x0:-1.1, x1:1.1, y0:1.495, y1:2.045 }, GLASS_Z = -2.0;
  const potPos = new T.Vector3(); (G.userData.potPart || G).getWorldPosition(potPos);
  const partOf = o => { for (let p = o; p && p !== G; p = p.parent) if (p.userData && p.userData.part) return p.userData.part; return null; };
  const count = (root, mw) => { const out = { leaf:{n:0,beyond:0,open:0,wall:0,glass:0,minZ:9}, stem:{n:0,beyond:0,open:0,wall:0,glass:0,minZ:9} };
    const v = new T.Vector3();
    root.traverse(o => { if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return; const pt = partOf(o) === 'leaf' ? 'leaf' : (partOf(o) === 'stem' ? 'stem' : null); if (!pt) return;
      const pos = o.geometry.attributes.position; const M = mw ? mw(o) : o.matrixWorld;
      for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(M); const c = out[pt]; c.n++; c.minZ = Math.min(c.minZ, v.z);
        if (v.z < WALL_Z) { c.beyond++; const inOpen = v.x > OPEN.x0 && v.x < OPEN.x1 && v.y > OPEN.y0 && v.y < OPEN.y1; inOpen ? c.open++ : c.wall++; if (v.z < GLASS_Z) c.glass++; } } });
    return out; };
  const real = count(G);
  /* ③ 기본 카메라 — 잎 겉면 표본점(넓이 비례 1200점)으로 광선을 쏜다. 첫 맞음이 그 잎이면 «보임» */
  const leafMeshes = []; G.traverse(o => { if (o.isMesh && partOf(o) === 'leaf') leafMeshes.push(o); });
  const tris = []; let tot = 0; const a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3();
  for (const m of leafMeshes) { const pos = m.geometry.attributes.position, idx = m.geometry.index; const nT = idx ? idx.count / 3 : pos.count / 3;
    for (let t = 0; t < nT; t++) { const ia = idx ? idx.getX(3*t) : 3*t, ib = idx ? idx.getX(3*t+1) : 3*t+1, ic = idx ? idx.getX(3*t+2) : 3*t+2;
      a.fromBufferAttribute(pos, ia).applyMatrix4(m.matrixWorld); b.fromBufferAttribute(pos, ib).applyMatrix4(m.matrixWorld); c.fromBufferAttribute(pos, ic).applyMatrix4(m.matrixWorld);
      const ar = new T.Vector3().subVectors(b, a).cross(new T.Vector3().subVectors(c, a)).length() / 2; if (ar <= 0) continue; tot += ar; tris.push([a.clone(), b.clone(), c.clone(), tot, m]); } }
  const vis = [], blockers = {}; let hidden = 0, seen = 0, hiddenBeyond = 0, beyondN = 0; const rc = new T.Raycaster(); const camPos = cam.getWorldPosition(new T.Vector3());
  const visibleMesh = o => { for (let p = o; p; p = p.parent) if (p.visible === false) return false; const mm = Array.isArray(o.material) ? o.material[0] : o.material;
    if (!mm || mm.visible === false || mm.colorWrite === false) return false; if (mm.transparent && (mm.opacity ?? 1) < 0.6) return false; return true; };
  const N = 1200; let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let k = 0; k < N; k++) { const r = rnd() * tot; let lo = 0, hi = tris.length - 1; while (lo < hi) { const mid = (lo + hi) >> 1; if (tris[mid][3] < r) lo = mid + 1; else hi = mid; }
    const [A, B, C, , m] = tris[lo]; let u = rnd(), w = rnd(); if (u + w > 1) { u = 1 - u; w = 1 - w; }
    const P = A.clone().add(B.clone().sub(A).multiplyScalar(u)).add(C.clone().sub(A).multiplyScalar(w));
    const dir = P.clone().sub(camPos); const dist = dir.length(); dir.normalize(); rc.set(camPos, dir); rc.far = dist + 0.01;
    const hits = rc.intersectObject(S0, true).filter(h => h.object.isMesh && visibleMesh(h.object));
    const first = hits[0]; const beyond = P.z < WALL_Z; if (beyond) beyondN++;
    if (!first || first.distance >= dist - 0.004) { seen++; continue; }
    hidden++; if (beyond) hiddenBeyond++;
    let o = first.object, tag = o.name || ''; for (let p = o; p; p = p.parent) { if (p.userData && (p.userData.uid || p.userData.normal)) { tag = p.userData.uid || ('벽면 n=' + JSON.stringify(p.userData.normal)); break; } }
    if (partOf(o) === 'leaf' || partOf(o) === 'stem') tag = '같은 그루(다른 잎·줄기)';
    blockers[tag] = (blockers[tag] || 0) + 1; }
  /* ④ 굴광성(photo)만 바꿔 다시 짓기 — 같은 생장일·씨앗·화분 지름·방위 */
  const pa = await import('/src/render3d/plant_assemble.js'); const asm = await pa.getPlantAssembler({});
  const ud = G.userData; const pb = new T.Box3().setFromObject(ud.potPart || G); const potD = Math.max(pb.max.x - pb.min.x, pb.max.z - pb.min.z);
  const alt = [];
  for (const photo of [0.5, 0.25, 0]) { try {
      const g2 = asm.assemble({ growthDays: ud.growthDays, seed: ud.seed, potD, lightAz: Math.PI, photo });
      const M0 = G.matrixWorld.clone(); g2.updateMatrixWorld(true);
      const out = count(g2, o => new T.Matrix4().multiplyMatrices(M0, o.matrixWorld));
      alt.push({ photo, 잎_벽너머: +(out.leaf.beyond / Math.max(1, out.leaf.n) * 100).toFixed(1), 잎_벽속: +(out.leaf.wall / Math.max(1, out.leaf.n) * 100).toFixed(1), 잎_최소z: +out.leaf.minZ.toFixed(3) });
    } catch (e) { alt.push({ photo, 탈: e.message }); } }
  const pct = (x, n) => +(x / Math.max(1, n) * 100).toFixed(1);
  /* ⑤ 손잡이 격자 — 굴광성(photo) × 그림만 띄우기(그루 그림을 방 쪽 +z 로 dz) · 반지하 sill:0 그대로 / 원룸 창턱 넷에 옮겨 놓기 */
  const leafPts = (root, M0) => { const v = new T.Vector3(), out = []; root.updateMatrixWorld(true);
    root.traverse(o => { if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return; if (partOf(o) !== 'leaf') return;
      const pos = o.geometry.attributes.position; const M = M0 ? new T.Matrix4().multiplyMatrices(M0, o.matrixWorld) : o.matrixWorld;
      for (let i = 0; i < pos.count; i += 2) { v.fromBufferAttribute(pos, i).applyMatrix4(M); out.push([v.x, v.y, v.z]); } }); return out; };
  const ROOMS = { banjiha: { wallZ: -1.9, glassZ: -2.0, open: OPEN, slots: [[0, 1.585, -1.85]] },
                  oneroom: { wallZ: -2.4, glassZ: -2.5, open: { x0: -0.7, x1: 1.7, y0: 0.775, y1: 2.225 }, slots: [[0.19,1.335,-2.33],[0.47,1.335,-2.33],[1.03,1.335,-2.33],[1.31,1.335,-2.33]] } };
  const grid = [];
  for (const photo of [0.5, 0.25, 0]) {
    const g3 = asm.assemble({ growthDays: ud.growthDays, seed: ud.seed, potD, lightAz: Math.PI, photo });
    const pts = leafPts(g3, G.matrixWorld.clone());   /* 반지하 sill:0 의 월드 자리 */
    for (const room of ['banjiha', 'oneroom']) { const R0 = ROOMS[room];
      for (const dz of [0, 0.10, 0.20, 0.25]) { let beyond = 0, wall = 0, glass = 0, n = 0;
        for (const s of R0.slots) for (const [x, y, z] of pts) {
          const X = x - potPos.x + s[0], Y = y - potPos.y + s[1], Z = z - potPos.z + s[2] + dz; n++;
          if (Z < R0.wallZ) { beyond++; const inO = X > R0.open.x0 && X < R0.open.x1 && Y > R0.open.y0 && Y < R0.open.y1; if (!inO) wall++; if (Z < R0.glassZ) glass++; } }
        grid.push({ room, photo, dz, 벽너머: pct(beyond, n), 벽속: pct(wall, n), 유리너머: pct(glass, n) }); } } }
  return { 그루_생장일: ud.growthDays, 화분중심: { x:+potPos.x.toFixed(3), y:+potPos.y.toFixed(3), z:+potPos.z.toFixed(3) }, 벽면까지_m: +(potPos.z - WALL_Z).toFixed(3),
    잎: { 정점: real.leaf.n, 벽너머: pct(real.leaf.beyond, real.leaf.n), 창구멍안: pct(real.leaf.open, real.leaf.n), 벽속: pct(real.leaf.wall, real.leaf.n), 유리너머: pct(real.leaf.glass, real.leaf.n), 최소z: +real.leaf.minZ.toFixed(3) },
    줄기: { 정점: real.stem.n, 벽너머: pct(real.stem.beyond, real.stem.n), 최소z: +real.stem.minZ.toFixed(3) },
    기본카메라: { 표본: N, 가려짐: pct(hidden, N), 보임: pct(seen, N), 벽너머_표본: beyondN, 벽너머중_가려짐: pct(hiddenBeyond, beyondN), 가린것: blockers },
    카메라_맞춤오차px: +bestErr.toFixed(2), 손잡이격자: grid, 굴광성_바꿔보기: alt, 화분지름_m: +potD.toFixed(3), cam: { x:+camPos.x.toFixed(2), y:+camPos.y.toFixed(2), z:+camPos.z.toFixed(2) } };
})()`);
console.log('■ 잰 것 —', JSON.stringify(R, null, 1));
if (process.env.SHOT) await page.shot(process.env.SHOT).catch(() => {});
await page.close(); clearTimeout(wd);
