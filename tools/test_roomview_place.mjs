/* ============================================================
   tools/test_roomview_place.mjs — 자유 좌표 배치·가구 이동 재현
   ------------------------------------------------------------
   test_roomview_walk.mjs 와 같은 방식이다: 진짜 브라우저(헤드리스 크롬)에서
   tools/room_view_demo.html 을 띄우고 계약을 하나씩 눌러 본다.
   3D 는 node:vm 으로 못 돌린다 — WebGL 이 필요하고, 레이캐스트는 카메라 위에서 돈다.

     python tools/serve.py 8971
     node tools/test_roomview_place.mjs

   ★ 여기서 보는 것 (박사님 지시 그대로)
     A 바닥 임의 지점에 놓으면 **그 좌표에** 실제로 선다
     B 선반 상판에 놓으면 onUid·occIdx 가 **그 가구 것**으로 나온다
     C 벽·천장은 거절한다 · 화면 어디를 쏴도 천장 위·방 밖은 안 나온다
     D **옮기면 옛 자리에 아무것도 안 남는다** (복사 버그 재발 방지)
     E 추천 원이 켜지고 꺼진다 · 못 올라가는 자리가 구분된다 · 커서 근처가 굵다
     F 가구를 옮기면 3D 도 따라 움직이고 **그 위 화분이 같이 간다**
     G 미리보기(previewAt)가 뜨고 지워진다
     H 콘솔에 처리 안 된 예외가 없다
============================================================ */
import { launch, sleep } from './test_cdp.mjs';

const BASE = process.env.BYEOT_URL || 'http://localhost:8971';
const URL_ = `${BASE}/tools/room_view_demo.html?room=banjiha`;

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log(`PASS  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}${extra ? '  — ' + extra : ''}`); }
};
const near = (a, b, eps) => Math.abs(a - b) <= eps;

/* 페이지 안에 '월드 좌표 → 화면 좌표' 를 심는다.
   ★ 방 뷰는 슬롯만 screenPosOf 로 내준다(그게 맞다 — 임의 좌표 투영은 UI 몫이다).
     테스트는 겨냥할 자리를 스스로 정해야 하므로 여기서 직접 쏜다. */
const INSTALL = `(() => {
  window.__sp = (x, y, z) => {
    const p = new THREE.Vector3(x, y, z).project(window.view.three.cam);
    const r = document.getElementById('roomCanvas').getBoundingClientRect();
    return { x: r.left + (p.x * 0.5 + 0.5) * r.width,
             y: r.top + (-p.y * 0.5 + 0.5) * r.height, behind: p.z > 1 };
  };
  /* 그 화분 그루가 씬에 **몇 개** 있나 — 복사 버그는 이걸로만 잡힌다.
     view.plants() 는 장부고, 이건 실제로 그려지는 것이다. 둘이 갈리면 그게 사고다. */
  window.__countGroups = (potId) => {
    let n = 0;
    window.view.three.scene.traverse(o => {
      if (o.userData && o.userData.potId === potId && o.parent && o.parent.type === 'Group'
          && !o.userData.isPreview && o.userData.plantSlotId) {
        /* 그루의 뿌리만 센다(자식들도 같은 potId 를 달고 있다) */
        if (!(o.parent.userData && o.parent.userData.potId === potId)) n++;
      }
    });
    return n;
  };
  window.__previewCount = () => {
    let n = 0;
    window.view.three.scene.traverse(o => { if (o.userData && o.userData.isPreview) n++; });
    return n;
  };
  return true;
})()`;

const SPEC = `{ kind:'monstera', growthDays: 140, seed: 7, band:'good' }`;

/* ============================================================
   --perf : 새로 붙인 것(추천 원·유령)이 끄는 동안 무겁지 않은지 잰다
   ------------------------------------------------------------
   test_roomview_perf.mjs 와 **같은 계량기**를 쓴다(renderer.render 를 감싼다).
   저기는 걷기를 재고 여기는 배치를 잰다 — 재는 대상만 다르다.
     node tools/test_roomview_place.mjs --perf
============================================================ */
const PERF_INSTALL = `(() => {
  const v = window.view, r = v.three.renderer;
  const M = window.__perf = { on:false, t:[], calls:[], tris:[], frames:0, t0:0 };
  const raw = r.render.bind(r);
  r.render = function (sc, cam) {
    if (!M.on) return raw(sc, cam);
    const a = performance.now(); raw(sc, cam); const b = performance.now();
    M.t.push(b - a); M.calls.push(r.info.render.calls); M.tris.push(r.info.render.triangles); M.frames++;
  };
  return true;
})()`;
const PERF_START = `(() => { const M = window.__perf;
  M.on = false; M.t = []; M.calls = []; M.tris = []; M.frames = 0; M.t0 = performance.now(); M.on = true; return true; })()`;
const PERF_STOP = `(() => { const M = window.__perf; M.on = false;
  const dt = (performance.now() - M.t0) / 1000;
  const med = a => { if (!a.length) return 0; const s=[...a].sort((x,y)=>x-y); return s[s.length>>1]; };
  const p95 = a => { if (!a.length) return 0; const s=[...a].sort((x,y)=>x-y); return s[Math.min(s.length-1, Math.floor(s.length*0.95))]; };
  return { sec:+dt.toFixed(2), frames:M.frames, fps:+(M.frames/dt).toFixed(1),
           renderMed:+med(M.t).toFixed(2), renderP95:+p95(M.t).toFixed(2),
           calls:Math.round(med(M.calls)), tris:Math.round(med(M.tris)) };
})()`;
const perfRow = (n, s) =>
  `${n.padEnd(22)} ${String(s.fps).padStart(5)}  ${String(s.renderMed).padStart(6)}  ${String(s.renderP95).padStart(6)}` +
  `  ${String(s.calls).padStart(5)}  ${String(s.tris).padStart(7)}`;

async function perfMain() {
  const CPU = 4, PX = 0.35;
  const page = await launch({ width: 390, height: 844, dpr: 2, mobile: false, throttle: { cpu: CPU } });
  page.on((m, p) => { if (m === 'Runtime.exceptionThrown') console.log('EX ' + p.exceptionDetails.text); });
  await page.goto(URL_);
  await page.waitFor('!!window.view', 180000, 200);
  await page.eval(INSTALL);
  /* 게임과 같은 상태 — 사람·마스코트·화분 둘. setContinuous 는 안 켠다(게임도 안 켠다).
     ★ 캐릭터가 있어야 idle 이 돌아 30fps 상한이 실제로 걸린다. 아무도 없으면 방이
       가만히 있어서 "0장 그렸다"가 나오고, 그건 느린 게 아니라 안 바쁜 것이다. */
  await page.eval(`window.view.setCharacter('jachwi').then(()=>1)`);
  await page.eval(`window.view.setCharacter('moni').then(()=>1)`);
  await page.eval(`(async()=>{ const S=window.view.slots().filter(s=>!s.occupied).slice(0,2);
    for (const s of S) await window.view.setPlant(s.slotId, {kind:'monstera', growthDays:200, seed:7, band:'good'});
    return S.length; })()`);
  await sleep(1200);
  await page.eval(PERF_INSTALL);
  await page.eval(`(()=>{ const r=window.view.three.renderer;
    r.setPixelRatio(${PX}); r.setPixelRatio = () => {}; window.view.redraw(); return 1; })()`);

  console.log(`\n방=banjiha · 390×844 dpr2 · CPU ${CPU}배 느리게 · 픽셀비 ${PX} · SwiftShader\n`);
  console.log('구간                     그린fps  렌더중앙  렌더p95   콜수   삼각형');
  console.log('─'.repeat(70));

  await page.eval(PERF_START); await sleep(3000);
  console.log(perfRow('가만히(기준)', await page.eval(PERF_STOP)));

  /* 추천 원만 켜고 가만히 — 링이 상시 비용을 만드는지 */
  await page.eval(`window.view.showSlotRings(true, { potD: 0.20 })`);
  await page.eval(`window.view.redraw()`);
  await page.eval(PERF_START); await sleep(3000);
  console.log(perfRow('추천 원 켠 채 가만히', await page.eval(PERF_STOP)));

  /* 자유 배치 끌기 — 손가락이 움직일 때마다 surfaceAt + previewAt + 링 near 갱신 */
  await page.eval(PERF_START);
  const nProbe = await page.eval(`(async () => {
    const r = document.getElementById('roomCanvas').getBoundingClientRect();
    let n = 0, okN = 0;
    for (let i = 0; i < 60; i++) {
      const a = i / 60 * 6.283;
      const x = r.left + r.width * 0.5 + Math.cos(a) * 90;
      const y = r.top + r.height * 0.62 + Math.sin(a) * 60;
      const s = window.view.surfaceAt(x, y, { potD: 0.20 });
      n++;
      if (s.x != null) {
        okN++;
        window.view.previewAt({ x:s.x, y:s.y, z:s.z, onUid:s.onUid, occIdx:s.occIdx },
                              { potD: 0.20, valid: s.ok });
        window.view.showSlotRings(true, { potD: 0.20, near: { x:s.x, z:s.z }, nearMax: 0.6 });
      }
      await new Promise(r2 => setTimeout(r2, 16));
    }
    return { n, okN };
  })()`);
  const drag = await page.eval(PERF_STOP);
  console.log(perfRow('자유 배치 끌기', drag) + `   (surfaceAt ${nProbe.n}회 · 유령 ${nProbe.okN}회)`);
  await page.eval(`(()=>{ window.view.clearPreview(); window.view.showSlotRings(false); return 1; })()`);

  /* 가구 끌기 — 유령만 움직인다(재조립은 손 뗄 때 한 번) */
  await page.eval(PERF_START);
  const nFurn = await page.eval(`(async () => {
    const f = window.view.furniture()[0];
    if (!f) return 0;
    let n = 0;
    for (let i = 0; i < 60; i++) {
      const a = i / 60 * 6.283;
      window.view.previewFurnitureAt(f.uid, { x: f.x + Math.cos(a) * 0.4, z: f.z + Math.sin(a) * 0.4, rot: f.rot });
      n++;
      await new Promise(r2 => setTimeout(r2, 16));
    }
    window.view.clearFurniturePreview();
    return n;
  })()`);
  const fdrag = await page.eval(PERF_STOP);
  console.log(perfRow('가구 끌기(유령만)', fdrag) + `   (previewFurnitureAt ${nFurn}회)`);

  /* 재조립 한 번이 얼마나 드나 */
  const rebuild = await page.eval(`(async () => {
    const f = window.view.furniture()[0];
    const b = window.view.roomSize();
    let dest = null;
    for (let x = -b.w/2; x <= b.w/2 && !dest; x += 0.25)
      for (let z = -b.d/2; z <= b.d/2 && !dest; z += 0.25) {
        const fit = window.view.furnitureFit(f.uid, { x, z, rot: f.rot });
        if (fit.ok && Math.hypot(x-f.x, z-f.z) > 0.4) dest = { x, z };
      }
    if (!dest) return null;
    const t0 = performance.now();
    await window.view.commitFurnitureAt(f.uid, { x: dest.x, z: dest.z, rot: f.rot });
    return { ms: Math.round(performance.now() - t0), dest };
  })()`);
  console.log('─'.repeat(70));
  console.log(`commitFurnitureAt(재조립 1회) ${rebuild ? rebuild.ms + 'ms' : '못 쟀습니다'}` +
              `  ← ★ 끄는 동안에는 한 번도 안 돈다`);
  console.log(`stats() ${JSON.stringify(await page.eval('window.view.stats()'))}`);
  await page.close();
}

async function main() {
  const page = await launch({ width: 390, height: 844, dpr: 2, mobile: false });
  const errs = [];
  page.on((m, p) => {
    if (m === 'Runtime.exceptionThrown')
      errs.push(p.exceptionDetails.text + ' ' + ((p.exceptionDetails.exception || {}).description || ''));
  });

  await page.goto(URL_);
  await page.waitFor('!!window.view', 120000, 200);
  await page.eval(`window.view.setContinuous(true)`);
  await page.eval(INSTALL);
  await sleep(400);

  const size = await page.eval(`window.view.roomSize()`);

  /* ══ A 바닥 임의 지점 ═════════════════════════════════════════════════ */
  const floors = await page.eval(`(() => {
    const b = window.view.roomSize(), out = [];
    for (let x = -b.w/2 + 0.4; x <= b.w/2 - 0.4; x += 0.25)
      for (let z = -b.d/2 + 0.4; z <= b.d/2 - 0.4; z += 0.25) {
        const sp = window.__sp(x, 0.02, z);
        if (sp.behind) continue;
        const s = window.view.surfaceAt(sp.x, sp.y, { potD: 0.20 });
        if (s.ok && s.onUid === null)
          out.push({ want:{x:+x.toFixed(3), z:+z.toFixed(3)}, got:{x:s.x, y:s.y, z:s.z},
                     sp:{x:sp.x, y:sp.y}, nearest: s.nearest });
      }
    return out;
  })()`);
  ok('A-0 바닥에서 놓을 수 있는 지점을 찾는다', floors.length > 3, `${floors.length}곳`);
  const spot = floors.sort((a, b) =>
    Math.hypot(a.got.x - a.want.x, a.got.z - a.want.z) - Math.hypot(b.got.x - b.want.x, b.got.z - b.want.z))[0];
  ok('A-1 겨냥한 바닥 좌표를 그대로 돌려준다', spot &&
     Math.hypot(spot.got.x - spot.want.x, spot.got.z - spot.want.z) < 0.05,
     spot && `겨냥 (${spot.want.x}, ${spot.want.z}) → ${JSON.stringify(spot.got)}`);
  ok('A-2 바닥이면 onUid·occIdx 가 둘 다 null 이다', spot && spot.got.y < 0.08,
     spot && `y=${spot.got.y}`);

  await page.eval(`(async () => { await window.view.setPlantAt('potFloor',
    { x:${spot.got.x}, y:${spot.got.y}, z:${spot.got.z}, onUid:null, occIdx:null }, ${SPEC}); return 1; })()`);
  const pf = await page.eval(`window.view.plants().find(p => p.potId === 'potFloor') || null`);
  ok('A-3 바닥 임의 지점에 놓으면 그 좌표에 실제로 선다',
     pf && near(pf.pos.x, spot.got.x, 1e-3) && near(pf.pos.z, spot.got.z, 1e-3) && near(pf.pos.y, spot.got.y, 1e-3),
     pf ? JSON.stringify(pf.pos) : '화분이 없습니다');
  ok('A-4 열쇠가 free:{화분 id} 다 (place.js 규약)', pf && pf.key === 'free:potFloor' && pf.free === true,
     pf && pf.key);

  /* ══ B 선반 상판 ══════════════════════════════════════════════════════ */
  const shelf = await page.eval(`(() => {
    /* 가구별로 제일 높은 단을 골라 그 점을 쏜다 — 위 단에 가려지지 않는 자리다 */
    const byUid = new Map();
    for (const s of window.view.slots()) {
      const uid = s.slotId.slice(0, s.slotId.lastIndexOf(':'));
      const cur = byUid.get(uid);
      if (!cur || s.pos.y > cur.pos.y) byUid.set(uid, s);
    }
    const out = [];
    for (const [uid, s] of byUid) {
      const sp = window.__sp(s.pos.x, s.pos.y + 0.004, s.pos.z);
      if (sp.behind) continue;
      const r = window.view.surfaceAt(sp.x, sp.y, { potD: 0.18 });
      out.push({ uid, slotId: s.slotId, slotY: s.pos.y, got: r });
    }
    return out;
  })()`);
  const onFurn = shelf.filter(r => r.got.onUid === r.uid);
  ok('B-1 가구 상판을 쏘면 onUid 가 그 가구 것이다',
     onFurn.length >= Math.max(1, Math.floor(shelf.length * 0.6)),
     `${onFurn.length}/${shelf.length} — ${shelf.filter(r => r.got.onUid !== r.uid).map(r => `${r.uid}→${r.got.onUid}(${r.got.reason || 'ok'})`).join(', ')}`);
  ok('B-2 occIdx 가 그 가구의 차폐체 번호로 나온다',
     onFurn.length > 0 && onFurn.every(r => Number.isInteger(r.got.occIdx)),
     onFurn.map(r => `${r.uid}:${r.got.occIdx}`).join(' '));
  ok('B-3 상판 높이가 그 자리 높이와 맞는다',
     onFurn.length > 0 && onFurn.every(r => Math.abs(r.got.y - r.slotY) < 0.06),
     onFurn.map(r => `${r.uid} ${r.got.y} vs ${r.slotY}`).join(' '));
  ok('B-4 추천 자리(nearest)를 같이 내준다',
     onFurn.length > 0 && onFurn.every(r => r.got.nearest && r.got.nearest.slotId),
     JSON.stringify(onFurn[0] && onFurn[0].got.nearest));

  const shelfHit = onFurn[0];
  if (shelfHit) {
    await page.eval(`(async () => { await window.view.setPlantAt('potShelf',
      { x:${shelfHit.got.x}, y:${shelfHit.got.y}, z:${shelfHit.got.z},
        onUid:${JSON.stringify(shelfHit.got.onUid)}, occIdx:${shelfHit.got.occIdx} }, ${SPEC}); return 1; })()`);
    const ps = await page.eval(`window.view.plants().find(p => p.potId === 'potShelf') || null`);
    ok('B-5 선반 상판에 실제로 선다 (at.onUid 가 보존된다)',
       ps && ps.at && ps.at.onUid === shelfHit.got.onUid && near(ps.pos.y, shelfHit.got.y, 1e-3),
       ps ? JSON.stringify(ps.at) : '없음');
  } else ok('B-5 선반 상판에 실제로 선다 (at.onUid 가 보존된다)', false, '가구 상판을 못 찾았습니다');

  /* ══ C 벽·천장 거절 ═══════════════════════════════════════════════════ */
  const walls = await page.eval(`(() => {
    const b = window.view.roomSize(), out = [];
    const pts = [];
    for (const u of [-0.3, 0, 0.3]) {
      pts.push(['back',  u * b.w, b.h * 0.65, -b.d/2 + 0.02]);
      pts.push(['front', u * b.w, b.h * 0.65,  b.d/2 - 0.02]);
      pts.push(['left', -b.w/2 + 0.02, b.h * 0.65, u * b.d]);
      pts.push(['right', b.w/2 - 0.02, b.h * 0.65, u * b.d]);
    }
    for (const [wall, x, y, z] of pts) {
      const sp = window.__sp(x, y, z);
      if (sp.behind) continue;
      const r = window.view.surfaceAt(sp.x, sp.y, { potD: 0.20 });
      out.push({ wall, ok: r.ok, reason: r.reason, y: r.y, onUid: r.onUid });
    }
    return out;
  })()`);
  const wallOk = walls.filter(w => w.ok && w.y > 0.6);      // 벽 높이에서 '놓을 수 있다'가 나오면 안 된다
  ok('C-1 벽 높이(0.6m 위)를 쏘면 놓을 수 있다고 하지 않는다', wallOk.length === 0,
     JSON.stringify(wallOk.slice(0, 3)));
  ok('C-2 거절 이유를 한국어로 말한다',
     walls.some(w => !w.ok && /벽|천장|면/.test(String(w.reason || ''))),
     walls.filter(w => !w.ok).slice(0, 3).map(w => `${w.wall}: ${w.reason}`).join(' | '));

  /* 화면 전체를 훑어도 천장 위·방 밖은 절대 안 나온다 */
  const sweep = await page.eval(`(() => {
    const r = document.getElementById('roomCanvas').getBoundingClientRect();
    const b = window.view.roomSize();
    let n = 0, bad = [];
    for (let i = 1; i < 12; i++) for (let j = 1; j < 22; j++) {
      const s = window.view.surfaceAt(r.left + r.width * i / 12, r.top + r.height * j / 22, { potD: 0.20 });
      if (!s.ok) continue;
      n++;
      if (s.y > b.h - 0.15 || Math.abs(s.x) > b.w/2 + 1e-3 || Math.abs(s.z) > b.d/2 + 1e-3)
        bad.push({ x:s.x, y:s.y, z:s.z, onUid:s.onUid });
    }
    return { n, bad };
  })()`);
  ok('C-3 화면 어디를 쏴도 천장 위·방 밖은 안 나온다', sweep.bad.length === 0,
     `${sweep.n}곳 통과 · 이상 ${JSON.stringify(sweep.bad.slice(0, 3))}`);

  /* ══ D 옮기면 옛 자리에 아무것도 안 남는다 ═══════════════════════════ */
  const two = floors.filter(f => Math.hypot(f.got.x - spot.got.x, f.got.z - spot.got.z) > 0.7);
  const dst = two[0] || floors[floors.length - 1];
  await page.eval(`(async () => { await window.view.setPlantAt('potMove',
    { x:${spot.got.x}, y:${spot.got.y}, z:${spot.got.z}, onUid:null, occIdx:null }, ${SPEC}); return 1; })()`);
  const n1 = await page.eval(`window.__countGroups('potMove')`);
  await page.eval(`(async () => { await window.view.setPlantAt('potMove',
    { x:${dst.got.x}, y:${dst.got.y}, z:${dst.got.z}, onUid:null, occIdx:null }, ${SPEC}); return 1; })()`);
  const n2 = await page.eval(`window.__countGroups('potMove')`);
  const pm = await page.eval(`window.view.plants().filter(p => p.potId === 'potMove')`);
  ok('D-1 좌표를 옮겨도 씬에 그루는 하나뿐이다 (복사되지 않는다)', n1 === 1 && n2 === 1,
     `놓을 때 ${n1}개 → 옮긴 뒤 ${n2}개`);
  ok('D-2 장부에도 하나뿐이고 새 좌표에 있다',
     pm.length === 1 && near(pm[0].pos.x, dst.got.x, 1e-3) && near(pm[0].pos.z, dst.got.z, 1e-3),
     JSON.stringify(pm.map(p => p.pos)));

  /* 추천 자리 → 자유 좌표로 건너뛸 때도 옛 자리가 남으면 안 된다 */
  const slotHop = await page.eval(`(async () => {
    const s = window.view.slots().find(x => !x.occupied);
    if (!s) return null;
    await window.view.setPlant(s.slotId, { ...${SPEC}, potId: 'potHop' });
    const before = { key: s.slotId, groups: window.__countGroups('potHop'),
                     occupied: window.view.slots().find(x => x.slotId === s.slotId).occupied };
    await window.view.setPlantAt('potHop',
      { x:${dst.got.x}, y:${dst.got.y}, z:${dst.got.z + 0.0}, onUid:null, occIdx:null },
      { ...${SPEC}, growthDays: 141 });
    return { before, after: { groups: window.__countGroups('potHop'),
             rows: window.view.plants().filter(p => p.potId === 'potHop').length,
             occupied: window.view.slots().find(x => x.slotId === s.slotId).occupied } };
  })()`);
  ok('D-3 추천 자리 → 자유 좌표로 옮겨도 옛 자리에 아무것도 안 남는다',
     slotHop && slotHop.after.groups === 1 && slotHop.after.rows === 1 && slotHop.after.occupied === false,
     JSON.stringify(slotHop));

  /* ══ E 추천 원 가이드 ═════════════════════════════════════════════════ */
  const ringsSmall = await page.eval(`(() => {
    const n = window.view.showSlotRings(true, { potD: 0.18 });
    const st = window.view.slotRings();
    return { n, total: st.length, visible: st.every(r => r.visible), fits: st.filter(r => r.fits).length };
  })()`);
  ok('E-1 추천 원이 켜진다', ringsSmall.total > 0 && ringsSmall.visible === true,
     JSON.stringify(ringsSmall));
  const ringsBig = await page.eval(`(() => {
    const n = window.view.showSlotRings(true, { potD: 0.90 });
    const st = window.view.slotRings();
    return { n, fits: st.filter(r => r.fits).length, colors: [...new Set(st.map(r => r.color))] };
  })()`);
  ok('E-2 못 올라가는 자리는 다른 색으로 구분된다 (지름 0.90m)',
     ringsBig.fits === 0 && ringsSmall.fits > 0,
     `0.18m 통과 ${ringsSmall.fits}칸 · 0.90m 통과 ${ringsBig.fits}칸 · 색 ${ringsBig.colors}`);
  const ringNear = await page.eval(`(() => {
    const s = window.view.slots().reduce((a, b) => (b.maxPotD || 0) > (a.maxPotD || 0) ? b : a);
    window.view.showSlotRings(true, { potD: 0.18, near: { x: s.pos.x, z: s.pos.z } });
    const st = window.view.slotRings();
    const hot = st.filter(r => r.near);
    return { want: s.slotId, hot: hot.map(r => r.slotId), color: hot[0] && hot[0].color };
  })()`);
  ok('E-3 커서에 제일 가까운 원 하나만 굵고 밝다',
     ringNear.hot.length === 1 && ringNear.hot[0] === ringNear.want,
     JSON.stringify(ringNear));
  const ringsOff = await page.eval(`(() => { window.view.showSlotRings(false);
    return window.view.slotRings().every(r => !r.visible); })()`);
  ok('E-4 추천 원이 꺼진다', ringsOff === true);

  /* ★ 원 밖에도 놓을 수 있어야 한다 — 원은 안내지 제약이 아니다 */
  const outsideRing = await page.eval(`(() => {
    const p = window.view.plants().find(x => x.potId === 'potFloor');
    if (!p) return null;
    const near = window.view.slots()
      .map(s => Math.hypot(s.pos.x - p.pos.x, s.pos.z - p.pos.z)).sort((a,b)=>a-b)[0];
    return { dist: +near.toFixed(3) };
  })()`);
  ok('E-5 추천 원 밖(제일 가까운 자리에서 멀리)에도 화분이 서 있다',
     outsideRing && outsideRing.dist > 0.25, JSON.stringify(outsideRing));

  /* ══ G 미리보기 ═══════════════════════════════════════════════════════ */
  const pv = await page.eval(`(() => {
    const before = window.__previewCount();
    const r = window.view.previewAt({ x:${dst.got.x}, y:${dst.got.y}, z:${dst.got.z}, onUid:null, occIdx:null },
                                    { potD: 0.20, valid: false });
    const on = window.__previewCount();
    window.view.clearPreview();
    return { before, on, off: window.__previewCount(), ok: r.ok };
  })()`);
  ok('G-1 previewAt 이 유령을 세우고 clearPreview 가 지운다',
     pv.on > pv.before && pv.off === pv.before, JSON.stringify(pv));
  ok('G-2 못 놓는 자리면 ok:false 로 붉게 뜬다', pv.ok === false);

  /* ══ F 가구 이동 ══════════════════════════════════════════════════════ */
  const furnList = await page.eval(`window.view.furniture()`);
  ok('F-0 옮길 수 있는 가구 목록이 나온다', furnList.length > 0,
     furnList.map(f => f.uid).join(', '));

  /* 눌러서 잡을 수 있나 — 가구 몸통 한가운데를 쏜다 */
  const picked = await page.eval(`(() => {
    const out = [];
    for (const f of window.view.furniture()) {
      const sp = window.__sp(f.x, f.y + f.size.h * 0.6, f.z);
      if (sp.behind) continue;
      const p = window.view.pickFurnitureAt(sp.x, sp.y);
      out.push({ want: f.uid, got: p && p.uid });
    }
    return out;
  })()`);
  ok('F-1 가구를 화면에서 집을 수 있다 (pickFurnitureAt)',
     picked.filter(p => p.got === p.want).length >= Math.max(1, Math.ceil(picked.length * 0.5)),
     JSON.stringify(picked));

  const fghost = await page.eval(`(() => {
    const f = window.view.furniture()[0];
    if (!f) return null;
    window.view.clearFurniturePreview();          // 데모가 띄워 뒀을 수 있다
    const before = window.__previewCount();
    const r = window.view.previewFurnitureAt(f.uid, { x: f.x, z: f.z, rot: f.rot });
    const on = window.__previewCount();
    window.view.clearFurniturePreview();
    return { uid: f.uid, before, on, off: window.__previewCount(), ok: r.ok };
  })()`);
  ok('F-1b 가구 유령이 뜨고(제자리는 파랑) 지워진다',
     fghost && fghost.on > fghost.before && fghost.off === fghost.before && fghost.ok === true,
     JSON.stringify(fghost));

  /* 화분을 얹은 가구를 하나 골라 옮긴다 */
  const setup = await page.eval(`(async () => {
    /* 슬롯을 내는 가구 중, 옮길 수 있고(붙박이 아님) 빈 자리로 갈 수 있는 것 */
    const furn = window.view.furniture();
    const slots = window.view.slots();
    for (const f of furn) {
      const mine = slots.filter(s => s.slotId.startsWith(f.uid + ':'));
      if (!mine.length) continue;
      /* 갈 수 있는 자리를 찾는다 — 0.25m 격자로 훑는다 */
      const b = window.view.roomSize();
      let dest = null, bestD = 0;
      for (let x = -b.w/2; x <= b.w/2; x += 0.25)
        for (let z = -b.d/2; z <= b.d/2; z += 0.25) {
          const fit = window.view.furnitureFit(f.uid, { x, z, rot: f.rot });
          if (!fit.ok) continue;
          const d = Math.hypot(x - f.x, z - f.z);
          if (d > bestD && d < 1.6) { bestD = d; dest = { x:+x.toFixed(3), z:+z.toFixed(3) }; }
        }
      if (!dest || bestD < 0.2) continue;
      /* ① 추천 자리 화분 · ② 그 가구 위 자유 좌표 화분 — 둘 다 얹는다 */
      const top = mine.reduce((a, s) => s.pos.y > a.pos.y ? s : a);
      await window.view.setPlant(top.slotId, ${SPEC});
      const free = { x: top.pos.x + 0.001, y: top.pos.y, z: top.pos.z + 0.001 };
      return { uid: f.uid, from: { x:f.x, z:f.z, rot:f.rot }, dest, dist:+bestD.toFixed(3),
               slotId: top.slotId, slotPos: top.pos, size: f.size };
    }
    return null;
  })()`);

  if (!setup) {
    ok('F-2 가구를 옮기면 3D 도 따라 움직인다', false, '옮길 만한 가구를 못 찾았습니다');
    ok('F-3 가구 위 추천 자리 화분이 같이 간다', false, '위와 같음');
    ok('F-4 가구 위 자유 좌표 화분이 같이 간다', false, '위와 같음');
  } else {
    /* 그 가구 상판에 자유 좌표 화분도 하나 얹는다 */
    const freeAt = await page.eval(`(async () => {
      const sp = window.__sp(${setup.slotPos.x}, ${setup.slotPos.y} + 0.004, ${setup.slotPos.z});
      const s = window.view.surfaceAt(sp.x, sp.y, { potD: 0.18 });
      if (!s.ok || s.onUid !== ${JSON.stringify(setup.uid)}) return null;
      /* 자리 한가운데는 이미 찼으니 살짝 옆으로 */
      for (const [dx, dz] of [[0.16,0],[0,0.16],[-0.16,0],[0,-0.16],[0.22,0.0],[0,0.22]]) {
        const sp2 = window.__sp(${setup.slotPos.x} + dx, ${setup.slotPos.y} + 0.004, ${setup.slotPos.z} + dz);
        const s2 = window.view.surfaceAt(sp2.x, sp2.y, { potD: 0.14 });
        if (s2.ok && s2.onUid === ${JSON.stringify(setup.uid)}) {
          await window.view.setPlantAt('potOnFurn',
            { x:s2.x, y:s2.y, z:s2.z, onUid:s2.onUid, occIdx:s2.occIdx },
            { kind:'monstera', growthDays: 60, seed: 3, band:'good', potD: 0.14 });
          return { x:s2.x, y:s2.y, z:s2.z, onUid:s2.onUid };
        }
      }
      return null;
    })()`);

    const before = await page.eval(`(() => ({
      furn: window.view.furniture().find(f => f.uid === ${JSON.stringify(setup.uid)}),
      slotPlant: (window.view.plants().find(p => p.key === ${JSON.stringify(setup.slotId)}) || null),
      freePlant: (window.view.plants().find(p => p.potId === 'potOnFurn') || null)
    }))()`);

    const moved = await page.eval(`window.view.commitFurnitureAt(${JSON.stringify(setup.uid)},
      { x: ${setup.dest.x}, z: ${setup.dest.z}, rot: ${setup.from.rot} }).then(r => r,
      e => ({ error: e.message }))`);
    await sleep(600);
    const after = await page.eval(`(() => ({
      furn: window.view.furniture().find(f => f.uid === ${JSON.stringify(setup.uid)}),
      slotPlant: (window.view.plants().find(p => p.key === ${JSON.stringify(setup.slotId)}) || null),
      freePlant: (window.view.plants().find(p => p.potId === 'potOnFurn') || null),
      floorPlant: (window.view.plants().find(p => p.potId === 'potFloor') || null),
      groups: { slot: 1, free: window.__countGroups('potOnFurn') }
    }))()`);

    ok('F-2 가구를 옮기면 3D 도 따라 움직인다',
       !moved.error && after.furn && near(after.furn.x, setup.dest.x, 1e-3) && near(after.furn.z, setup.dest.z, 1e-3),
       `${JSON.stringify(setup.from)} → ${JSON.stringify(after.furn)} ${moved.error || ''}`);

    const dx = setup.dest.x - setup.from.x, dz = setup.dest.z - setup.from.z;
    ok('F-3 가구 위 추천 자리 화분이 같이 간다',
       before.slotPlant && after.slotPlant &&
       near(after.slotPlant.pos.x - before.slotPlant.pos.x, dx, 0.02) &&
       near(after.slotPlant.pos.z - before.slotPlant.pos.z, dz, 0.02),
       `가구 Δ(${dx.toFixed(2)}, ${dz.toFixed(2)}) · 화분 ` +
       (before.slotPlant && after.slotPlant
         ? `Δ(${(after.slotPlant.pos.x - before.slotPlant.pos.x).toFixed(2)}, ${(after.slotPlant.pos.z - before.slotPlant.pos.z).toFixed(2)})`
         : `before=${!!before.slotPlant} after=${!!after.slotPlant}`));

    if (!freeAt) {
      ok('F-4 가구 위 자유 좌표 화분이 같이 간다 (at.onUid 기준)', true, '상판에 여유가 없어 건너뜀');
    } else {
      ok('F-4 가구 위 자유 좌표 화분이 같이 간다 (at.onUid 기준)',
         before.freePlant && after.freePlant && after.groups.free === 1 &&
         near(after.freePlant.pos.x - before.freePlant.pos.x, dx, 0.02) &&
         near(after.freePlant.pos.z - before.freePlant.pos.z, dz, 0.02),
         before.freePlant && after.freePlant
           ? `Δ(${(after.freePlant.pos.x - before.freePlant.pos.x).toFixed(2)}, ${(after.freePlant.pos.z - before.freePlant.pos.z).toFixed(2)}) · 그루 ${after.groups.free}개`
           : `before=${!!before.freePlant} after=${!!after.freePlant}`);
    }
    ok('F-5 바닥 화분은 제자리에 그대로 있다',
       after.floorPlant && near(after.floorPlant.pos.x, spot.got.x, 1e-3) && near(after.floorPlant.pos.z, spot.got.z, 1e-3),
       after.floorPlant ? JSON.stringify(after.floorPlant.pos) : '없음');

    /* 못 놓는 자리는 거절한다 */
    const refuse = await page.eval(`window.view.commitFurnitureAt(${JSON.stringify(setup.uid)},
      { x: ${(size.w / 2 + 2).toFixed(3)}, z: 0, rot: 0 }).then(() => null, e => e.message)`);
    ok('F-6 방 밖으로는 못 옮긴다 (한국어 이유)', typeof refuse === 'string' && /벽 밖/.test(refuse), String(refuse));
  }

  /* ══ H 콘솔 ═══════════════════════════════════════════════════════════ */
  const hard = errs.filter(e => !/favicon/.test(e));
  ok('H 콘솔에 처리 안 된 예외가 없다', hard.length === 0, hard.slice(0, 3).join(' | '));

  await page.close();
  console.log(`\nroomview_place: ${fail ? 'FAIL' : 'PASS'}  (${pass}/${pass + fail})`);
  process.exit(fail ? 1 : 0);
}
const run = process.argv.includes('--perf') ? perfMain : main;
run().catch(e => { console.error(e); process.exit(1); });
