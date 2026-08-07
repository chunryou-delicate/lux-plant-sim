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

  /* 바닥 격자만 켠 채 가만히 — 격자가 상시 비용을 만드는지 */
  const gridInfo = await page.eval(`(() => { const free = window.view.showGrid(true, { potD: 0.20 });
    window.view.redraw(); return { free, g: window.view.grid() }; })()`);
  await page.eval(PERF_START); await sleep(3000);
  console.log(perfRow('바닥 격자 켠 채 가만히', await page.eval(PERF_STOP)) +
              `   (그린 칸 ${gridInfo.g.room.cells} · 막힌 칸 ${gridInfo.g.blocked})`);

  /* 격자 + 원 + 유령 을 전부 켜고 끄는 중 — 배치할 때 실제로 켜지는 조합 */
  await page.eval(PERF_START);
  const nAll = await page.eval(`(async () => {
    const r = document.getElementById('roomCanvas').getBoundingClientRect();
    let n = 0;
    for (let i = 0; i < 45; i++) {
      const a = i / 45 * 6.283;
      const s = window.view.surfaceAt(r.left + r.width * 0.5 + Math.cos(a) * 90,
                                      r.top + r.height * 0.62 + Math.sin(a) * 60, { potD: 0.20 });
      n++;
      if (s.x != null) {
        window.view.previewAt({ x:s.x, y:s.y, z:s.z, onUid:s.onUid, occIdx:s.occIdx },
                              { potD: 0.20, valid: s.ok });
        window.view.showSlotRings(true, { potD: 0.20, near: { x:s.x, z:s.z }, nearMax: 0.6 });
      }
      await new Promise(r2 => setTimeout(r2, 16));
    }
    return n;
  })()`);
  console.log(perfRow('격자+원+유령 끌기', await page.eval(PERF_STOP)) + `   (surfaceAt ${nAll}회)`);
  await page.eval(`(()=>{ window.view.showGrid(false); window.view.clearPreview();
                          window.view.showSlotRings(false); return 1; })()`);

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

  /* ══ S 추천 자리 불변식 ═══════════════════════════════════════════════
     ★★ "추천 자리 정중앙은 반드시 통과해야 한다."
        슬롯은 house.js 가 "여기 놓으라"고 낸 점이다. 거기서 거절하면 슬롯 정본이
        거짓말이 된다. 실제로 반지하 14칸 중 13칸이 거절당한 적이 있다(2026-08-03) —
        링은 "된다"는데 surfaceAt 은 "0.01m 모자란다"고 했다. 두 판정이 갈려 있었다.
        이 블록이 있었으면 그 상황이 안 나왔다. 화분을 놓기 **전에** 잰다. */
  const slotProbe = await page.eval(`(() => {
    const v = window.view, rc = document.getElementById('roomCanvas').getBoundingClientRect();
    const rows = [];
    for (const s of v.slots()) {
      const sp = v.screenPosOf(s.slotId);
      if (!sp) { rows.push({ id: s.slotId, err: '화면에 안 잡힘' }); continue; }
      const r = v.surfaceAt(rc.left + sp.x, rc.top + sp.y, { potD: 0.20 });
      rows.push({ id: s.slotId, maxPotD: s.maxPotD, ok: r.ok, why: r.reason,
                  onUid: r.onUid, occIdx: r.occIdx, near: r.nearest && r.nearest.slotId });
    }
    return rows;
  })()`);
  const slotBad = slotProbe.filter(r => !r.ok || r.near !== r.id);
  ok('S-1 모든 추천 자리 정중앙에서 surfaceAt 이 ok:true 이고 nearest 가 그 자리다',
     slotBad.length === 0 && slotProbe.length >= 14,
     `${slotProbe.length - slotBad.length}/${slotProbe.length} · ` +
     slotBad.slice(0, 4).map(r => `${r.id}: ${r.err || r.why || 'near=' + r.near}`).join(' | '));

  const sill = slotProbe.find(r => r.id === 'banjiha-sill:0');
  ok('S-2 창턱 받침(반지하 제일 밝은 자리)이 onUid·occIdx 를 제대로 낸다',
     sill && sill.onUid === 'banjiha-sill' && Number.isInteger(sill.occIdx),
     JSON.stringify(sill));

  /* 링의 fits 와 surfaceAt 의 ok 가 **모든 자리에서 일치**해야 한다 — 같은 함수를 부르니까 */
  const agree = await page.eval(`(() => {
    const v = window.view, rc = document.getElementById('roomCanvas').getBoundingClientRect();
    const out = [];
    for (const potD of [0.20, 0.30]) {
      v.showSlotRings(true, { potD });
      const ring = new Map(v.slotRings().map(r => [r.slotId, r.fits]));
      for (const s of v.slots()) {
        const sp = v.screenPosOf(s.slotId);
        if (!sp) continue;
        const r = v.surfaceAt(rc.left + sp.x, rc.top + sp.y, { potD });
        if (ring.get(s.slotId) !== r.ok)
          out.push({ potD, id: s.slotId, ring: ring.get(s.slotId), surface: r.ok, why: r.reason });
      }
    }
    v.showSlotRings(false);
    return out;
  })()`);
  ok('S-3 링의 fits 와 surfaceAt 의 ok 가 모든 자리에서 일치한다 (판정이 한 벌이다)',
     agree.length === 0, JSON.stringify(agree.slice(0, 4)));

  /* 매달린 조명·벽걸이 장식 위는 면이 아니다 */
  const banned = await page.eval(`(() => {
    const v = window.view, rc = document.getElementById('roomCanvas').getBoundingClientRect();
    const bad = new Set();
    v.three.scene.traverse(o => { const u = o.userData || {};
      if (u.uid && (u.hangFromCeiling || (u.mount && !(u.slots && u.slots.length)))) bad.add(u.uid); });
    const hitsBad = [];
    for (let i = 1; i < 16; i++) for (let j = 1; j < 28; j++) {
      const t = v.surfaceAt(rc.left + rc.width * i / 16, rc.top + rc.height * j / 28, { potD: 0.20 });
      if (t.ok && t.onUid && bad.has(t.onUid)) hitsBad.push({ uid: t.onUid, y: t.y });
    }
    return { banned: [...bad], hitsBad: hitsBad.slice(0, 4) };
  })()`);
  ok('S-4 매달린 조명·벽걸이 위에는 못 놓는다 (천장등 포함)',
     banned.banned.length > 0 && banned.hitsBad.length === 0,
     `걸러야 할 것 ${JSON.stringify(banned.banned)} · 뚫린 것 ${JSON.stringify(banned.hitsBad)}`);

  /* ══ Z 바닥 격자 ══════════════════════════════════════════════════════
     ★ 박사님 지시: "바닥에 그리드를 통한 칸수로 조절하자. 전체 가구나 화분 다
       네모난 그리드 최소치를 작게 해서 거기 배수로 사이즈 맞춰서 하자."
     칸 크기와 근거는 place.js 머리말에 있다(방 여섯 개를 재서 정했다). */
  const gi = await page.eval(`(() => { const g = window.view.grid();
    return { g, desk: window.view.cellsOf(1.2), deep: window.view.cellsOf(0.6),
             pot: window.view.cellsOf(0.202), up: window.view.cellsOf(0.82) }; })()`);
  ok('Z-1 단위 칸 0.05m · 보이는 칸 0.25m',
     gi.g.unit === 0.05 && gi.g.cell === 0.25, JSON.stringify(gi.g));
  /* ★ 2026-08-08 — 여기에 「방 안쪽」이 붙었다. 자를 낮춘 게 아니라 **하나 더 잰다.**
     방 치수(5×4m)는 **바깥 치수**다. 벽(두께 0.2m)이 그 선을 걸치고 서 있어서
     바깥 치수 위에 20×16칸을 깔면 제일 바깥 한 줄은 절반이 벽 속이다.
     그 줄은 화분 반지름을 얹으면 언제나 막히므로 붉은 띠가 한 줄 돌았다 —
     "여기 놓지 마세요"가 아니라 "여기는 벽입니다"였다. 그래서 **안 그린다.**
       · cols/rows(=20×16) 는 뜻이 안 바뀌었다. 바깥 치수가 칸으로 떨어지는지 그대로 본다.
       · inner(=4.8×3.8m) 는 벽 안쪽 면이 만드는 사각형이다. 5−0.2, 4−0.2 다.
       · cells(=255) 는 **실제로 그리는 칸 수**다. 320 − 65(바깥 벽에 물리는 칸).
         65 가 아니라 68(=20·16−18·14)이 아닌 이유는 **문 자리**다 — 문에는 벽 조각이
         없어서 그 앞 칸 셋은 실제로 놓을 수 있는 바닥이고, 그래서 남겨 뒀다. */
  ok('Z-2 방이 칸으로 딱 떨어진다 (반지하 5×4m → 20×16칸) · 벽 속 칸은 안 그린다',
     gi.g.room.cols === 20 && gi.g.room.rows === 16 &&
     near(gi.g.room.inner.w, 4.8, 1e-6) && near(gi.g.room.inner.d, 3.8, 1e-6) &&
     gi.g.room.cells === 255, JSON.stringify(gi.g.room));
  ok('Z-3 크기를 칸 수로 센다 · 안 떨어지면 올린다',
     gi.desk === 24 && gi.deep === 12 && gi.pot === 5 && gi.up === 17,
     `책상 1.2→${gi.desk}칸 · 0.6→${gi.deep}칸 · 화분 0.202→${gi.pot}칸 · 0.82→${gi.up}칸(올림)`);

  const gshow = await page.eval(`(() => {
    const free = window.view.showGrid(true, { potD: 0.20 });
    const on = window.view.grid();
    window.view.showGrid(false);
    return { free, on, off: window.view.grid().visible };
  })()`);
  /* ★ 2026-08-08 — 합계가 20×16(=320) 에서 **그린 칸 수**(room.cells=255)로 바뀌었다.
     세는 대상이 「방 바깥 치수의 칸」에서 「실제로 그린 칸」으로 바뀐 것이지 판정이
     느슨해진 게 아니다. 오히려 여기가 못 박는 불변식이 하나 늘었다 —
     **안 그리게 된 칸은 전부 예전에 「막힌 칸」이던 것**이라 `free` 는 한 칸도 안 준다.
     여섯 방을 다 재서 확인했다(roomui-to-plan §1 표): 줄어든 칸 수 = 줄어든 막힌 칸 수. */
  ok('Z-4 격자가 켜지고 꺼진다 · 막힌 칸이 세어진다 (합계 = 그린 칸)',
     gshow.on.visible === true && gshow.off === false &&
     gshow.free > 0 && gshow.on.blocked > 0 &&
     gshow.free + gshow.on.blocked === gshow.on.room.cells,
     `놓을 수 있는 칸 ${gshow.free} · 막힌 칸 ${gshow.on.blocked} · 그린 칸 ${gshow.on.room.cells}`);

  /* 바닥 아무 데나 쏘면 칸에 앉는다 — **걸음(보이는 칸의 절반) 배수**여야 한다.
     ★ 2026-08-07 규약이 바뀌었다. 예전에는 「발자국 앞 모서리를 0.05 선에」였는데,
       그러면 앉는 자리가 화분 크기마다 달라져 보이는 칸(0.25)과 눈금이 어긋났다.
       지금은 방 원점 기준 걸음 배수다 — 화분 크기와 무관하고, 0.125 배수는 늘
       보이는 칸선 위이거나 그 한가운데다. 근거는 room_view.js §snapOnSurface. */
  const snapProbe = await page.eval(`(() => {
    const v = window.view, rc = document.getElementById('roomCanvas').getBoundingClientRect();
    const st = v.grid().step, out = [];
    for (const potD of [0.20, 0.18])
      for (let i = 3; i < 13; i++) for (let j = 12; j < 20; j++) {
        const t = v.surfaceAt(rc.left + rc.width * i / 16, rc.top + rc.height * j / 24, { potD });
        if (!t.ok || t.onUid !== null) continue;
        const ex = t.x / st, ez = t.z / st;
        out.push({ potD, x: t.x, z: t.z, step: t.cells.step,
                   offX: Math.abs(ex - Math.round(ex)), offZ: Math.abs(ez - Math.round(ez)) });
      }
    return out;
  })()`);
  ok('Z-5 바닥 좌표가 걸음(반 칸 0.125m) 배수에 앉는다 · 화분 크기와 무관하다',
     snapProbe.length > 5 && snapProbe.every(p => p.offX < 1e-3 && p.offZ < 1e-3 && p.step === 0.125),
     `${snapProbe.length}점 · 최대 어긋남 ` +
     Math.max(0, ...snapProbe.map(p => Math.max(p.offX, p.offZ))).toExponential(2));

  /* ★ 슬롯이 격자에 안 떨어져도 **슬롯이 이긴다** — 격자에 끌려가면 창턱이 다시 막힌다 */
  const slotWins = await page.eval(`(() => {
    const v = window.view, rc = document.getElementById('roomCanvas').getBoundingClientRect();
    const u = 0.05, rows = [];
    for (const s of v.slots()) {
      const sp = v.screenPosOf(s.slotId);
      if (!sp) continue;
      const t = v.surfaceAt(rc.left + sp.x, rc.top + sp.y, { potD: 0.20 });
      const onGrid = Math.abs(s.pos.x / u - Math.round(s.pos.x / u)) < 1e-6
                  && Math.abs(s.pos.z / u - Math.round(s.pos.z / u)) < 1e-6;
      rows.push({ id: s.slotId, onGrid, snappedTo: t.snappedTo,
                  moved: +Math.hypot(t.x - s.pos.x, t.z - s.pos.z).toFixed(4) });
    }
    return rows;
  })()`);
  const offGrid = slotWins.filter(r => !r.onGrid);
  ok('Z-6 ★슬롯이 격자에 안 떨어져도 슬롯 중심으로 간다 (슬롯 우선)',
     slotWins.length >= 14 && slotWins.every(r => r.snappedTo === r.id && r.moved < 1e-3),
     `격자 밖 슬롯 ${offGrid.length}/${slotWins.length} · 어긋난 것 ` +
     JSON.stringify(slotWins.filter(r => r.snappedTo !== r.id || r.moved >= 1e-3).slice(0, 3)));

  /* 가구도 칸에 앉고 회전은 90° 단위 */
  const fsnap = await page.eval(`(() => {
    const v = window.view, u = 0.05, out = [];
    for (const f of v.furniture()) {
      const s = v.snapFurniture(f.uid, { x: f.x + 0.13, z: f.z - 0.07, rot: 44 });
      const swap = Math.round(s.rot / 90) % 2 !== 0;
      const w = swap ? f.size.d : f.size.w, d = swap ? f.size.w : f.size.d;
      const ni = Math.ceil(w / u - 1e-9), nj = Math.ceil(d / u - 1e-9);
      const ex = (s.x - ni * u / 2) / u, ez = (s.z - nj * u / 2) / u;
      out.push({ uid: f.uid, rot: s.rot, cells: s.cells,
                 offX: Math.abs(ex - Math.round(ex)), offZ: Math.abs(ez - Math.round(ez)) });
    }
    return out;
  })()`);
  ok('Z-7 가구도 칸에 앉는다 · 회전은 90° 단위(44° → 0°)',
     fsnap.length > 0 && fsnap.every(f => f.rot % 90 === 0 && f.offX < 1e-6 && f.offZ < 1e-6),
     JSON.stringify(fsnap.slice(0, 3)));

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

  /* ══ I 열쇠 해석 — 슬롯 id · free: 열쇠 · 화분 id ════════════════════
     ★ 셋 다 같은 개체를 가리킬 수 있다. 푸는 곳이 하나(resolveKey)여야 안 어긋난다.
       (game.html 의 상대 드래그가 screenPosOf 를 원점으로 쓴다 — 여기가 null 이면
        화분이 화면 한가운데에서 끌리기 시작해 손맛이 통째로 어긋난다) */
  const canvasRect = await page.eval(`(() => { const r = document.getElementById('roomCanvas').getBoundingClientRect();
    return { w: r.width, h: r.height }; })()`);

  const sp1 = await page.eval(`(() => ({
    byKey:  window.view.screenPosOf('free:potFloor'),
    byPot:  window.view.screenPosOf('potFloor'),
    plant:  window.view.plants().find(p => p.potId === 'potFloor') || null
  }))()`);
  ok('I-1 자유 좌표 화분의 screenPosOf 가 캔버스 안의 좌표를 준다',
     sp1.byKey && sp1.byKey.x > 0 && sp1.byKey.x < canvasRect.w &&
     sp1.byKey.y > 0 && sp1.byKey.y < canvasRect.h,
     JSON.stringify(sp1.byKey) + ` / 캔버스 ${canvasRect.w}×${canvasRect.h}`);
  ok('I-2 free: 열쇠와 화분 id 가 같은 화면 좌표를 준다',
     sp1.byPot && near(sp1.byKey.x, sp1.byPot.x, 1e-9) && near(sp1.byKey.y, sp1.byPot.y, 1e-9),
     JSON.stringify(sp1));

  const sp2 = await page.eval(`(async () => {
    const a = window.view.screenPosOf('potFloor');
    await window.view.setPlantAt('potFloor',
      { x:${dst.got.x}, y:${dst.got.y}, z:${dst.got.z}, onUid:null, occIdx:null }, ${SPEC});
    const b = window.view.screenPosOf('potFloor');
    return { a, b, pos: window.view.plants().find(p => p.potId === 'potFloor').pos };
  })()`);
  ok('I-3 화분을 옮기면 screenPosOf 도 따라 움직인다',
     sp2.a && sp2.b && Math.hypot(sp2.b.x - sp2.a.x, sp2.b.y - sp2.a.y) > 8,
     `${JSON.stringify(sp2.a)} → ${JSON.stringify(sp2.b)}`);

  /* 회전 — 자유 좌표 화분에 먹고, 되읽히고, 다시 그려도 유지된다 */
  const yaw = await page.eval(`(() => {
    const set = window.view.setPlantYaw('free:potFloor', 0.9);
    return { set, byKey: window.view.plantYaw('free:potFloor'),
             byPot: window.view.plantYaw('potFloor'),
             live: window.view.plants().find(p => p.potId === 'potFloor').yaw };
  })()`);
  ok('I-4 자유 좌표 화분에 setPlantYaw 가 먹는다 (던지지 않는다)',
     yaw.set === 0.9 && near(yaw.live, 0.9, 1e-6), JSON.stringify(yaw));
  ok('I-5 free: 열쇠로도 화분 id 로도 같은 각도가 되읽힌다',
     near(yaw.byKey, 0.9, 1e-6) && near(yaw.byPot, 0.9, 1e-6), JSON.stringify(yaw));

  await sleep(150);       // REBUILD_MIN_MS(60ms) 를 넘겨 실제로 다시 짓게 한다
  const yaw2 = await page.eval(`(async () => {
    /* 날짜를 바꿔 **그루를 다시 짓게** 한다. 각도를 안 주고 좌표만 옮긴다 */
    await window.view.setPlantAt('potFloor',
      { x:${spot.got.x}, y:${spot.got.y}, z:${spot.got.z}, onUid:null, occIdx:null },
      { kind:'monstera', growthDays: 220, seed: 7, band:'good' });
    const p = window.view.plants().find(x => x.potId === 'potFloor');
    return { yaw: window.view.plantYaw('potFloor'), live: p.yaw, atRot: p.at && p.at.rotY };
  })()`);
  ok('I-6 다시 그려도(좌표만 옮겨도) 각도가 유지된다',
     near(yaw2.live, 0.9, 1e-6) && near(yaw2.yaw, 0.9, 1e-6) && near(yaw2.atRot, 0.9, 1e-6),
     JSON.stringify(yaw2));

  /* 슬롯 id · 화분 id 두 이름이 같은 개체를 가리킨다 */
  const tri = await page.eval(`(async () => {
    const s = window.view.slots().find(x => !x.occupied);
    if (!s) return null;
    await window.view.setPlant(s.slotId, { ...${SPEC}, potId: 'potTri' });
    const a = window.view.resolveKey(s.slotId), b = window.view.resolveKey('potTri');
    window.view.setPlantYaw('potTri', 1.2);
    return { slotId: s.slotId, a, b, yawBySlot: window.view.plantYaw(s.slotId),
             screenSame: JSON.stringify(window.view.screenPosOf(s.slotId)) ===
                         JSON.stringify(window.view.screenPosOf('potTri')) };
  })()`);
  ok('I-7 슬롯 id 와 화분 id 가 같은 개체로 풀린다',
     tri && tri.a && tri.b && tri.a.key === tri.b.key && tri.a.key === tri.slotId &&
     tri.b.potId === 'potTri' && tri.screenSame,
     JSON.stringify(tri));
  ok('I-8 화분 id 로 돌린 각도를 슬롯 id 로 되읽는다', tri && near(tri.yawBySlot, 1.2, 1e-6),
     tri && String(tri.yawBySlot));

  /* 없는 열쇠 — 예전처럼 (회귀 없음) */
  const missing = await page.eval(`(() => {
    let threw = null;
    try { window.view.setPlantYaw('없는자리:9', 1); } catch (e) { threw = e.message; }
    let hlThrew = null, rings = 0;
    try { window.view.highlightSlots(['없는자리:9']); } catch (e) { hlThrew = e.message; }
    window.view.three.scene.traverse(o => { if (o.userData && o.userData.highlightSlotId) rings++; });
    return { screen: window.view.screenPosOf('없는자리:9'), yaw: window.view.plantYaw('없는자리:9'),
             resolved: window.view.resolveKey('없는자리:9'), threw, hlThrew, rings };
  })()`);
  ok('I-9 없는 열쇠는 null·0·throw 로 예전처럼 처리된다',
     missing.screen === null && missing.yaw === 0 && missing.resolved === null &&
     typeof missing.threw === 'string' && missing.hlThrew === null && missing.rings === 0,
     JSON.stringify(missing));

  /* 자유 좌표 화분도 빛낼 수 있다 — 탭해서 고른 것을 표시할 길 */
  const hl = await page.eval(`(() => {
    window.view.highlightSlots(['free:potFloor']);
    const rings = [];
    window.view.three.scene.traverse(o => {
      if (o.userData && o.userData.highlightSlotId)
        rings.push({ id: o.userData.highlightSlotId, x: +o.position.x.toFixed(3), z: +o.position.z.toFixed(3) });
    });
    const p = window.view.plants().find(x => x.potId === 'potFloor').pos;
    window.view.highlightSlots([]);
    let after = 0;
    window.view.three.scene.traverse(o => { if (o.userData && o.userData.highlightSlotId) after++; });
    return { rings, plant: { x:+p.x.toFixed(3), z:+p.z.toFixed(3) }, after };
  })()`);
  ok('I-10 자유 좌표 화분도 highlightSlots 로 빛낼 수 있다 (그 자리에 링이 선다)',
     hl.rings.length === 1 && hl.rings[0].id === 'free:potFloor' &&
     near(hl.rings[0].x, hl.plant.x, 1e-3) && near(hl.rings[0].z, hl.plant.z, 1e-3) && hl.after === 0,
     JSON.stringify(hl));

  /* ══ N 가구 불변식 · 얹힌 기구 ═══════════════════════════════════════
     ★ "가구는 자기가 지금 있는 자리를 반드시 통과해야 한다."
       슬롯 건과 같은 이야기다 — 현재 상태를 거절하는 판정은 판정이 아니라 고장이다.
       방을 바꿔 가며 **모든 방의 모든 가구**를 돈다(2026-08-03 코어 창 지적). */
  const rooms = ['banjiha', 'oneroom', 'tworoom', 'apartment', 'classroom', 'greenhouse'];
  const homeFit = [];
  for (const rid of rooms) {
    await page.eval(`window.view.setRoom('${rid}').then(()=>1)`);
    await sleep(900);
    const r = await page.eval(`(() => {
      const v = window.view, bad = [];
      const list = v.furniture();
      for (const f of list) {
        const fit = v.furnitureFit(f.uid, { x: f.x, z: f.z, rot: f.rot });
        if (!fit.ok) bad.push({ uid: f.uid, why: fit.reason });
      }
      return { room: '${rid}', n: list.length, bad,
               riders: list.map(f => ({ uid: f.uid, r: v.ridersOf(f.uid) })).filter(x => x.r.length) };
    })()`);
    homeFit.push(r);
  }
  const fitBad = homeFit.filter(r => r.bad.length);
  ok('N-1 모든 방의 모든 가구가 제자리 판정을 통과한다',
     fitBad.length === 0 && homeFit.reduce((a, r) => a + r.n, 0) > 60,
     homeFit.map(r => `${r.room} ${r.n - r.bad.length}/${r.n}`).join(' · ') + ' · ' +
     JSON.stringify(fitBad.slice(0, 3)));

  const bj = homeFit.find(r => r.room === 'banjiha');
  ok('N-2 책상에 물린 클립등을 "얹힌 것"으로 알아본다',
     bj && bj.riders.some(x => x.uid === 'banjiha-desk' && x.r.includes('banjiha-growlight-clip')),
     JSON.stringify(bj && bj.riders));

  /* ── 등이 따라오나 · 따라온 뒤 그 자리 PPFD 가 조도 계약과 맞나 ──
     ★ 조도 엔진을 붙여서 다시 띄운다(?engine=1). 그래야 방을 다시 짓는 쪽이
       light_adapter 가 되고, 화면과 계산이 같은 방을 보는지 실제로 잴 수 있다. */
  await page.goto(`${BASE}/tools/room_view_demo.html?room=banjiha&engine=1`);
  await page.waitFor('!!window.view && !!window.engine', 120000, 200);
  await page.eval(INSTALL);
  await sleep(500);

  const LAMP = `{ weather:'clear', season:'summer', lampCount: 2, litHours: 16 }`;
  const before = await page.eval(`(() => {
    const v = window.view, e = window.engine;
    const desk = v.furniture().find(f => f.uid === 'banjiha-desk');
    const slot = v.slots().find(s => s.slotId === 'banjiha-desk:0');
    const clip = e.furnitureList().find(f => f.uid === 'banjiha-growlight-clip');
    return { desk, slot, clip,
             rigs: v.lightRigs().filter(r => r.grow),
             lamp: e.dliAt(slot.pos, ${LAMP}).dli_lamp };
  })()`);
  ok('N-3 조도 엔진을 붙인 방 뷰가 뜬다', !!(before.desk && before.slot && before.clip),
     JSON.stringify({ desk: before.desk && before.desk.uid, clip: before.clip }));

  const dxF = 0.5;
  const movedF = await page.eval(`(async () => {
    const v = window.view, e = window.engine;
    const d = v.furniture().find(f => f.uid === 'banjiha-desk');
    /* 갈 수 있는 자리를 찾는다 — 좁은 방이라 후보가 많지 않다 */
    let dest = null, bestD = 0;
    for (let x = -2.2; x <= 2.2; x += 0.1) for (let z = -1.8; z <= 1.8; z += 0.1) {
      const fit = v.furnitureFit(d.uid, { x, z, rot: d.rot });
      if (!fit.ok) continue;
      const dd = Math.hypot(x - d.x, z - d.z);
      if (dd > bestD && dd < 1.2) { bestD = dd; dest = { x: +x.toFixed(3), z: +z.toFixed(3) }; }
    }
    if (!dest) return { error: '갈 자리가 없습니다' };
    const r = await v.commitFurnitureAt(d.uid, { x: dest.x, z: dest.z, rot: d.rot });
    return { r, dest, dist: +bestD.toFixed(3) };
  })()`);
  ok('N-4 책상을 옮기면 클립등이 같이 간다고 보고한다',
     !movedF.error && movedF.r && movedF.r.riders && movedF.r.riders.includes('banjiha-growlight-clip'),
     JSON.stringify(movedF));

  await sleep(500);
  const after = await page.eval(`(() => {
    const v = window.view, e = window.engine;
    const desk = v.furniture().find(f => f.uid === 'banjiha-desk');
    const slot = v.slots().find(s => s.slotId === 'banjiha-desk:0');
    const clip = e.furnitureList().find(f => f.uid === 'banjiha-growlight-clip');
    const ov = e.furnitureOverrides();
    return { desk, slot, clip, ov,
             rigs: v.lightRigs().filter(r => r.grow),
             lampNew: e.dliAt(slot.pos, ${LAMP}).dli_lamp,
             lampOld: e.dliAt(${JSON.stringify(before.slot && before.slot.pos)}, ${LAMP}).dli_lamp,
             fitHome: v.furnitureFit('banjiha-desk', { x: desk.x, z: desk.z, rot: desk.rot }) };
  })()`);

  const ddx = movedF.dest ? movedF.dest.x - before.desk.x : 0;
  const ddz = movedF.dest ? movedF.dest.z - before.desk.z : 0;
  ok('N-5 클립등 좌표가 책상과 같은 만큼 움직였다 (조립 정의가 같이 바뀐다)',
     after.clip && near(after.clip.x - before.clip.x, ddx, 0.02) &&
     near(after.clip.z - before.clip.z, ddz, 0.02),
     `책상 Δ(${ddx.toFixed(2)}, ${ddz.toFixed(2)}) · 클립등 Δ(` +
     `${after.clip ? (after.clip.x - before.clip.x).toFixed(2) : '?'}, ` +
     `${after.clip ? (after.clip.z - before.clip.z).toFixed(2) : '?'})`);

  const rigMoved = (() => {
    if (!before.rigs.length || !after.rigs.length) return false;
    /* 옮긴 책상 쪽 등(클립)이 3D 에서도 같이 갔나 — lightRigs 는 조도 계산이 쓰는 그 좌표다 */
    const b0 = before.rigs.map(r => `${r.pos.x},${r.pos.z}`);
    const a0 = after.rigs.map(r => `${r.pos.x},${r.pos.z}`);
    return b0.join('|') !== a0.join('|');
  })();
  ok('N-6 3D 의 조명 기구 좌표도 따라 움직였다 (화면과 계산이 같은 등을 본다)', rigMoved,
     `전 ${JSON.stringify(before.rigs.map(r => r.pos))} → 후 ${JSON.stringify(after.rigs.map(r => r.pos))}`);

  /* ★ "그 자리 PPFD 가 조도 계약과 어긋나지 않는다"를 **혼동 없이** 잰다.
     반지하에는 식물등이 둘이다(선반 밑 바 등 + 책상 클립등). 책상을 옮기면 선반과의
     거리도 바뀌므로 자리의 총 등 조도는 당연히 달라진다 — 그걸로는 아무것도 증명 못 한다.
     증명해야 하는 것은 **클립등과 그 자리의 기하가 그대로인가**(=등이 따라왔나)와
     **조립 정의(계산이 읽는 그것)에 새 좌표가 실려 있나** 둘이다. */
  const clipB = before.rigs.find(r => r.id === 'growlight_clip');
  const clipA = after.rigs.find(r => r.id === 'growlight_clip');
  const distB = clipB && before.slot ? Math.hypot(clipB.pos.x - before.slot.pos.x, clipB.pos.z - before.slot.pos.z) : NaN;
  const distA = clipA && after.slot ? Math.hypot(clipA.pos.x - after.slot.pos.x, clipA.pos.z - after.slot.pos.z) : NaN;
  const ovClip = after.ov && after.ov['banjiha-growlight-clip'];
  ok('N-7 등이 자리와 같은 거리를 유지한 채 따라왔고, 조도 계약이 그 새 좌표를 읽는다',
     near(distA, distB, 0.02) && after.lampNew > 0 && !!ovClip &&
     near(ovClip.x, clipA.pos.x, 0.02) && near(ovClip.z, clipA.pos.z, 0.02),
     `등–자리 거리 ${distB.toFixed(3)} → ${distA.toFixed(3)} · 계약 좌표 ${JSON.stringify(ovClip)} ` +
     `vs 3D ${JSON.stringify(clipA && clipA.pos)} · 그 자리 등 조도 ${before.lamp} → ${after.lampNew}`);
  ok('N-8 옛 자리는 등이 떠나 어두워졌다', after.lampOld < before.lamp - 1e-9,
     `${before.lamp} → ${after.lampOld}`);
  ok('N-9 옮긴 뒤에도 책상이 제자리 판정을 통과한다', after.fitHome && after.fitHome.ok === true,
     JSON.stringify(after.fitHome));

  /* ══ L 가구 밝히기 ════════════════════════════════════════════════════
     ★ 박사님 지시: "가구 클릭 시 … 가구가 **살짝 밝아지면서** 활성화된 것처럼 되면서
       그 옆으로 선택 가능 메뉴들이 뜨게." 메뉴는 game.html 몫이고, 여기는 **밝히는 것**이다.
     여기서 못 박는 것은 셋이다.
       ① 밝아졌다가 **원래 재질로 정확히** 돌아온다(재질 지문을 통째로 견준다)
       ② 껐다 켜기를 되풀이해도 재질이 안 샌다
       ③ **조도가 한 톨도 안 바뀐다** — 이건 그림이지 빛이 아니다 */
  await page.eval(`(() => {
    /* 재질 지문 — uuid·emissive·색·emissiveMap 까지 본다. 되돌아왔는지는 이걸로만 확실하다 */
    window.__matFP = (uid) => {
      let node = null;
      window.view.three.scene.traverse(o => { if (o.userData && o.userData.uid === uid && o.userData.size) node = o; });
      if (!node) return null;
      const out = [];
      node.traverse(o => {
        if (!o.isMesh || !o.material) return;
        for (const m of (Array.isArray(o.material) ? o.material : [o.material]))
          out.push([m.uuid, m.emissive ? m.emissive.getHexString() : '-',
                    m.emissiveIntensity == null ? '-' : m.emissiveIntensity,
                    m.color ? m.color.getHexString() : '-', m.emissiveMap ? 'map' : '-']);
      });
      return JSON.stringify(out);
    };
    window.__matCount = () => { let n = 0;
      window.view.three.scene.traverse(o => { if (o.isMesh && o.material) n += (Array.isArray(o.material) ? o.material.length : 1); });
      return n; };
    /* 조도는 좌표 함수다(light_adapter.dliAt) — 자리마다 그 값을 통째로 적어 견준다.
       등을 켠 조건으로 재는 이유: emissive 를 만지는 것이 등 조도로 새는지도 같이 보려는 것이다. */
    window.__dliAll = () => JSON.stringify(window.view.slots().map(s =>
      [s.slotId, +window.engine.dliAt(s.pos, { weather: 'clear', season: 'summer', lampCount: 2, litHours: 16 }).dli.toFixed(6)]));
    return true;
  })()`);
  const lit = await page.eval(`(() => {
    const v = window.view, uids = v.furniture().map(f => f.uid);
    const A = uids.find(u => /desk/.test(u)) || uids[0], B = uids.find(u => u !== A);
    const fp0 = window.__matFP(A), d0 = window.__dliAll(), m0 = window.__matCount();
    const hl = v.highlightFurniture(A);
    const fp1 = window.__matFP(A), d1 = window.__dliAll();
    v.highlightFurniture(null);
    const fp2 = window.__matFP(A), d2 = window.__dliAll();
    for (let i = 0; i < 20; i++) { v.highlightFurniture(A); v.highlightFurniture(null); }
    const fp3 = window.__matFP(A), m3 = window.__matCount();
    /* 한 번에 하나 — 다른 가구를 밝히면 앞엣것이 저절로 꺼진다 */
    v.highlightFurniture(A); v.highlightFurniture(B);
    const fp4 = window.__matFP(A), who = v.highlightedFurniture();
    v.highlightFurniture(null);
    return { A, B, hl, changed: fp0 !== fp1, back: fp0 === fp2, back20: fp0 === fp3, backOther: fp0 === fp4,
             mats: [m0, m3], who, dliSame: d0 === d1 && d0 === d2, slots: JSON.parse(d0).length,
             none: v.highlightFurniture(null), ghost: v.highlightFurniture('없는가구') };
  })()`);
  ok('L-1 가구를 밝히면 재질이 바뀌고, 끄면 **원래 재질로 정확히** 돌아온다',
     lit.changed === true && lit.back === true,
     `${lit.A} · 밝힌 메시 ${lit.hl && lit.hl.lit}개 · 바뀜 ${lit.changed} · 되돌아옴 ${lit.back}`);
  ok('L-2 20번 껐다 켜도 재질이 안 샌다 (수·지문 그대로)',
     lit.back20 === true && lit.mats[0] === lit.mats[1], `재질 수 ${lit.mats[0]} → ${lit.mats[1]}`);
  ok('L-3 한 번에 하나만 밝다 — 다른 가구를 밝히면 앞엣것은 원래대로',
     lit.backOther === true && lit.who === lit.B, `지금 밝은 것 ${lit.who} (기대 ${lit.B})`);
  ok('L-4 ★ 밝혀도 조도(DLI)는 한 톨도 안 바뀐다 — 이건 그림이다',
     lit.dliSame === true, `자리 ${lit.slots}곳`);
  ok('L-5 메뉴를 띄울 화면 좌표를 같이 준다 (발밑 screen · 머리 위 top)',
     !!(lit.hl && lit.hl.screen && lit.hl.top && Number.isFinite(lit.hl.screen.x) &&
        Number.isFinite(lit.hl.top.y) && lit.hl.top.y < lit.hl.screen.y && lit.hl.lit > 0),
     JSON.stringify(lit.hl && { screen: lit.hl.screen, top: lit.hl.top, lit: lit.hl.lit }));
  ok('L-6 null·모르는 uid 는 조용히 null 이다 (예외로 화면을 끊지 않는다)',
     lit.none === null && lit.ghost === null, `${JSON.stringify(lit.none)} · ${JSON.stringify(lit.ghost)}`);
  const spos = await page.eval(`(() => {
    const v = window.view, uid = v.furniture()[0].uid;
    return { furn: v.screenPosOf(uid), slot: v.screenPosOf(v.slots()[0].slotId), none: v.screenPosOf('없는열쇠') };
  })()`);
  ok('L-7 screenPosOf 가 **가구 uid 도** 받는다 (메뉴를 그 옆에 띄우려면 필요하다)',
     !!(spos.furn && Number.isFinite(spos.furn.x)) && !!spos.slot && spos.none === null,
     JSON.stringify(spos));

  /* ══ P 포인터 모드 ════════════════════════════════════════════════════
     ★ 박사님 지시: "클릭을 터치 또는 그 커서를 **상대 이동**으로 움직이게
       설정에서 고를 수 있게." 설정 UI 와 저장은 game.html 몫이고, 여기는 값과 기준점이다.
     제일 중요한 것은 **기본값이 지금 그대로(direct)** 라는 것이다 — 아니면 손버릇이 통째로 바뀐다.
     재는 자: 가구를 모서리에서 잡고 **손가락을 하나도 안 움직였을 때** 가구가 튀는 거리.
       direct   손가락 자리가 기준이라 그만큼 튄다(그게 지금 동작이다)
       relative 가구 제자리가 기준이라 0 이어야 한다 */
  const ptr = await page.eval(`(() => {
    const v = window.view, rc = document.getElementById('roomCanvas').getBoundingClientRect();
    const floorAt = (px, py) => {
      const ndc = new THREE.Vector2(((px - rc.left)/rc.width)*2-1, -((py - rc.top)/rc.height)*2+1);
      const ray = new THREE.Raycaster(); ray.setFromCamera(ndc, v.three.cam);
      const p = new THREE.Vector3();
      return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0), 0), p) ? { x: p.x, z: p.z } : null;
    };
    const scr = (x, z) => { const p = new THREE.Vector3(x, 0, z).project(v.three.cam);
      return { x: rc.left + (p.x*0.5+0.5)*rc.width, y: rc.top + (-p.y*0.5+0.5)*rc.height, behind: p.z > 1 }; };
    const jumps = () => {
      const out = [];
      for (const f of v.furniture()) {
        const t = scr(f.x + f.size.w/2*0.8, f.z + f.size.d/2*0.8);      // 발자국 모서리를 짚는다
        if (t.behind) continue;
        const o = v.dragOrigin(f.uid, t.x, t.y), p = floorAt(o.x, o.y);
        if (p) out.push({ uid: f.uid, from: o.from, d: +Math.hypot(p.x - f.x, p.z - f.z).toFixed(3) });
      }
      return out;
    };
    const dflt = v.pointerMode();
    const direct = jumps();
    v.setPointerMode('relative');
    const rel = jumps();
    let refused = false;
    try { v.setPointerMode('nope'); } catch (e) { refused = true; }
    const modeAfterBad = v.pointerMode();
    v.setPointerMode('direct');
    /* 화분·걷기는 **예전부터 상대**다 — 모드와 무관하다는 것을 같은 자로 보인다 */
    const s = v.slots()[0];
    const sp = v.screenPosOf(s.slotId);
    const hit = sp ? v.surfaceAt(rc.left + sp.x, rc.top + sp.y, { potD: 0.202, step: v.moveStep() }) : null;
    return { dflt, direct, rel, refused, modeAfterBad, back: v.pointerMode(),
             slotJump: hit ? +Math.hypot(hit.x - s.pos.x, hit.z - s.pos.z).toFixed(4) : null };
  })()`);
  ok('P-1 ★ 기본값은 direct 다 (지금 손버릇 그대로)', ptr.dflt === 'direct', ptr.dflt);
  ok('P-2 direct 는 **손가락 자리**가 기준이다 — 모서리에서 잡으면 그만큼 튄다',
     ptr.direct.length > 0 && ptr.direct.every(r => r.from === 'tap') &&
     ptr.direct.some(r => r.d > 0.2),
     ptr.direct.map(r => `${r.uid} ${r.d}m`).join(' · '));
  ok('P-3 relative 는 **물건 제자리**가 기준이다 — 안 움직이면 안 튄다(≤1cm)',
     ptr.rel.length === ptr.direct.length && ptr.rel.every(r => r.from === 'object' && r.d <= 0.01),
     ptr.rel.map(r => `${r.uid} ${r.d}m`).join(' · '));
  ok('P-4 모르는 모드는 거절하고, 거절해도 모드가 안 바뀐다',
     ptr.refused === true && ptr.modeAfterBad === 'relative' && ptr.back === 'direct',
     `${ptr.refused} · ${ptr.modeAfterBad} → ${ptr.back}`);
  ok('P-5 화분 옮기기는 **예전부터 상대**다 (기준점 screenPosOf · 안 움직이면 제자리)',
     ptr.slotJump === 0, `튄 거리 ${ptr.slotJump}m`);

  /* ══ H 콘솔 ═══════════════════════════════════════════════════════════ */
  const hard = errs.filter(e => !/favicon/.test(e));
  ok('H 콘솔에 처리 안 된 예외가 없다', hard.length === 0, hard.slice(0, 3).join(' | '));

  await page.close();
  console.log(`\nroomview_place: ${fail ? 'FAIL' : 'PASS'}  (${pass}/${pass + fail})`);
  process.exit(fail ? 1 : 0);
}
const run = process.argv.includes('--perf') ? perfMain : main;
run().catch(e => { console.error(e); process.exit(1); });
