/* ============================================================
   tools/test_outside.mjs — 창밖 동네: **값을 재고** 그림을 남긴다
   ------------------------------------------------------------
     python tools/serve.py 8993
     node tools/test_outside.mjs              # 검사 + 스크린샷
     node tools/test_outside.mjs --no-shots   # 검사만 (빠르다)

   ★ 2026-08-15 — 창밖이 **두 벌**이었다.
     render3d/outside_alley.js(방뷰가 부르던 것)와 game/outside.js(아무도 안 부르던 것).
     하나로 합쳐 game/outside.js 만 남겼다. 그래서 이 파일도 통째로 다시 썼다.
     ⚠ 옛 검사 하나는 **버렸다**: `clip_wedge`.
       옛 방식은 "지붕 위로 나오는 것을 평면으로 잘라 버린다"였고 그 검사는 평면이
       살아 있나를 봤다. 지금은 **자르지 않는다** — 자른 것이 바로 "방만 허공에 떠 있다"의
       원인이었다. 대신 아래 `not_covering` 이 그 자리를 대신한다:
       자르는 대신 **정말로 방을 가리지 않는지를 광선으로 직접 잰다.** 뜻이 더 가깝다.

   ★ 무엇을 증명하나
     ① 반지하에 동네가 붙는다 — 삼각형·드로우콜 증가분을 **숫자로** 남긴다
     ② 위층 방(아파트·온실)에는 안 붙는다 (기본 'auto' 는 반지하만)
     ③ 창 없는 방에서 안 터진다 (창 목록을 비워서 직접 만들어 본다)
     ④ ★★ **빛이 한 자리도 안 바뀐다** — 창밖을 켜고 끄고 같은 시각에
        sunLight·skyPortals·hemi·ambient 와 조도 엔진 결과(dliAt)를 비교한다.
        이게 이 워커의 안전선이다. 배경은 보이는 것이지 빛의 근원이 아니다.
     ⑤ 카메라가 그 벽 바깥으로 가면 창밖이 숨는다 (벽이 밑동만 남을 때)
     ⑥ ★ **방을 안 가린다** — 아홉 가지 시점(상하각 3 × 배율 3)에서 카메라와 방 안의
        점 사이에 창밖 삼각형이 하나라도 끼면 실패다. 광선으로 직접 잰다.
     ⑦ ★ **지붕 위 빈 곳이 실제로 찬다** — 창밖을 켠 화면과 끈 화면의 픽셀을 비교한다.
        "코드가 바뀐 것"과 "화면이 바뀐 것"은 다른 말이다(START-HERE §2).

   그림은 docs/engine/shots/outside_*.png (폰 세로 390×844 · dpr2).
============================================================ */
import { launch, sleep } from './test_cdp.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.BYEOT_URL || 'http://localhost:8993';
const OUT = path.join(ROOT, 'docs', 'engine', 'shots');
const SHOTS = !process.argv.includes('--no-shots');

let bad = 0;
const ok = (name, cond, note = '') => {
  if (!cond) bad++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${note ? '  (' + note + ')' : ''}`);
};

/* 조명 상태를 통째로 숫자 한 벌로 뽑는다. 창밖을 켜고 끈 두 벌이 같아야 한다. */
const LIGHT_SNAP = `(() => {
  const c = window.view.three, r = x => Math.round(x * 1e6) / 1e6;
  return {
    sun: r(c.sunLight.intensity), sunHex: c.sunLight.color.getHex(),
    hemi: r(c.hemi.intensity), amb: r(c.ambient.intensity),
    bulb: r(c.ceilingBulb.intensity),
    portals: (c.skyPortals || []).map(s => r(s.intensity)),
    skyWins: (c.skyWins || []).map(w => [r(w.x), r(w.y), r(w.z), r(w.area), r(w.tau ?? 0), r(w.ev ?? 0)]),
    expo: r(c.renderer.toneMappingExposure)
  };
})()`;

/* ★ 카메라를 실제 입력으로 몬다 — 방뷰에는 각도 창구가 없다(일부러 없다).
   ⚠ 마우스는 **28px(TAP_PX_MOUSE)** 을 못 넘기면 「탭」으로 읽힌다. 조금만 돌리려면
     22px 이면 되는데 그러면 각이 그대로다. 그래서 한 제스처 안에서 150px 더 갔다 온다. */
const DRAG = (dy) => `(()=>{ const c=document.getElementById('roomCanvas');
  const far = (${dy}) + 150 * ((${dy}) >= 0 ? 1 : -1);
  c.dispatchEvent(new MouseEvent('mousedown',{clientX:195,clientY:420,bubbles:true}));
  for (let i=1;i<=8;i++) window.dispatchEvent(new MouseEvent('mousemove',
    {clientX:195,clientY:420+far*i/8,bubbles:true}));
  for (let i=1;i<=8;i++) window.dispatchEvent(new MouseEvent('mousemove',
    {clientX:195,clientY:420+far+((${dy})-far)*i/8,bubbles:true}));
  window.dispatchEvent(new MouseEvent('mouseup',{clientX:195,clientY:420+(${dy}),bubbles:true})); })()`;
const WHEEL = (n) => `(()=>{ const c=document.getElementById('roomCanvas');
  for (let i=0;i<${Math.abs(n)};i++)
    c.dispatchEvent(new WheelEvent('wheel',{deltaY:${n >= 0 ? 120 : -120},bubbles:true,cancelable:true})); })()`;

async function driveCam(page, elWant, zoomK) {
  for (let round = 0; round < 4; round++) {
    const c = await page.eval(`window.view.camera()`);
    const distWant = (c.fit || c.dist) * zoomK;
    if (Math.abs(elWant - c.el) > 0.01) { await page.eval(DRAG((elWant - c.el) / 0.004), false); await sleep(400); }
    const c2 = await page.eval(`window.view.camera()`);
    const ratio = distWant / c2.dist;
    if (Math.abs(Math.log(ratio)) > 0.02) {
      await page.eval(WHEEL(Math.round(Math.log(ratio) / Math.log(1.08))), false); await sleep(300);
    }
    const c3 = await page.eval(`window.view.camera()`);
    if (Math.abs(c3.el - elWant) < 0.02 && Math.abs(Math.log(distWant / c3.dist)) < 0.06) break;
  }
  await sleep(280);
  return page.eval(`window.view.camera()`);
}

/* ★ 방을 가리나 — **광선으로 직접 잰다.**
   카메라에서 방 안 여러 점으로 광선을 쏘아 그 사이에 창밖 삼각형이 끼는지 본다.
   ⚠ 창밖 메시는 raycast 를 비워 뒀다(손가락이 안 걸리게). 재는 동안만 되살린다. */
const COVER = `((names) => {
  const v = window.view, ctx = v.three, S = ctx.scene;
  /* ★ **안 보이는 겹은 빼고 잰다.** THREE 의 Raycaster 는 visible 을 보지 않는다 —
     그래서 카메라가 창 벽 바깥으로 가 창밖을 감춘 각에서도 "27점이 가려졌다"가 나왔다.
     화면에 없는 것이 방을 가릴 수는 없다. 재는 자를 화면에 맞춘다.
     ⚠ 이웃 방(__nbr)은 통째로 감추지 않는다 — 벽마다 정점을 밑동으로 눌러 접는다.
       그러니 이 자가 그대로 맞는다(접힌 벽은 광선이 스쳐도 밑동 10cm 뿐이다). */
  const ms = (names || ['__outside', '__outside_far']).map(n => S.getObjectByName(n))
               .filter(m => m && m.visible);
  if (!ms.length) return { meshes: 0, points: 0, hits: 0, worst: null, allHidden: true };
  const saved = ms.map(m => m.raycast);
  for (const m of ms) m.raycast = THREE.Mesh.prototype.raycast;
  const b = v.roomSize();
  /* 방 안의 표본 — 바닥 네 귀퉁이 · 한가운데 · 창턱 · 천장 아래
     ⚠ 0.42 를 넘기지 마라. 방 안쪽 면은 x ±(w/2−0.2) · z ±(d/2−0.2) 라
       0.46 을 쓰면 z 표본이 **앞뒤 벽 속**에 박힌다 — 벽 속을 가렸다고 세게 된다. */
  const P = [];
  for (const sx of [-0.42, 0, 0.42]) for (const sz of [-0.42, 0, 0.42])
    for (const sy of [0.06, 0.5, 0.92]) P.push(new THREE.Vector3(sx * b.w, sy * b.h, sz * b.d));
  const rc = new THREE.Raycaster();
  const cam = ctx.cam; cam.updateMatrixWorld();
  const from = cam.position.clone();
  let hits = 0, worst = null;
  const dir = new THREE.Vector3();
  for (const p of P) {
    dir.copy(p).sub(from); const L = dir.length(); dir.normalize();
    rc.set(from, dir); rc.near = 0.01; rc.far = L - 0.02;
    const h = rc.intersectObjects(ms, false);
    if (h.length) { hits++; if (!worst) worst = { at: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)],
                                                  d: +h[0].distance.toFixed(2), of: L.toFixed(2) }; }
  }
  ms.forEach((m, i) => { m.raycast = saved[i]; });
  return { meshes: ms.length, points: P.length, hits, worst };
})`;

/* ★ 지붕 위 빈 곳이 정말로 찼나 — 화면 픽셀로 잰다.
   방 지붕선 **위쪽** 띠에서 창밖을 껐을 때와 켰을 때의 색이 몇 %나 달라지나. */
const FILL = `((tag) => {
  const cv = document.getElementById('roomCanvas');
  /* ★ **같은 틱 안에서** 그리고 바로 읽어야 한다. WebGL 캔버스는 preserveDrawingBuffer
     가 꺼져 있어 프레임이 끝나면 그림판이 비워진다 — 따로 redraw 하고 나중에 읽으면
     두 번 다 빈 그림을 읽어 "달라진 데가 0%"가 나온다(실제로 그렇게 나왔다). */
  window.view.redraw();
  const c2 = document.createElement('canvas');
  c2.width = cv.width; c2.height = cv.height;
  c2.getContext('2d').drawImage(cv, 0, 0);
  const g = c2.getContext('2d');
  /* 방 꼭대기가 화면 어디에 맺히나 — 방 상자 윗면 네 귀퉁이를 투영한다 */
  const v = window.view, b = v.roomSize(), cam = v.three.cam;
  let topY = 1e9;
  for (const sx of [-0.5, 0.5]) for (const sz of [-0.5, 0.5]) {
    const q = new THREE.Vector3(sx * b.w, b.h, sz * b.d).project(cam);
    topY = Math.min(topY, (-q.y * 0.5 + 0.5) * c2.height);
  }
  topY = Math.max(4, Math.min(c2.height - 4, topY));
  /* 지붕선 위 띠를 고르게 찍는다(맨 위 8%는 데모 UI 가 얹혀 있어 뺀다) */
  const y0 = Math.round(c2.height * 0.08), y1 = Math.round(Math.max(y0 + 8, topY - 6));
  const out = [];
  for (let i = 0; i < 240; i++) {
    const x = Math.round(c2.width * (0.06 + 0.88 * ((i * 37) % 240) / 240));
    const y = Math.round(y0 + (y1 - y0) * ((i * 61) % 240) / 240);
    const d = g.getImageData(x, y, 1, 1).data;
    out.push(d[0], d[1], d[2]);
  }
  return { topY: Math.round(topY), band: [y0, y1], px: out };
})`;

async function main() {
  const page = await launch({ width: 390, height: 844, dpr: 2, mobile: false });
  page.on((m, p) => { if (m === 'Runtime.exceptionThrown') console.log('EX ' + p.exceptionDetails.text); });
  await page.goto(`${BASE}/tools/room_view_demo.html?room=banjiha&t=0.50`);
  await page.waitFor('!!window.view', 180000, 200);
  await page.eval(`window.view.setContinuous(false)`);
  await sleep(1200);

  /* ── ① 반지하에 붙는가 · 얼마나 비싼가 ───────────────────────── */
  const info = await page.eval(`window.view.outsideInfo()`);
  ok('banjiha_built', info.tris > 0 && info.walls.includes('back'),
     `삼각형 ${info.tris} (가까운 ${info.near} · 먼 ${info.far}) · 드로우콜 ${info.calls} · 벽 [${info.walls}]`);
  /* ★ 예산을 400 → 1200 으로 올렸다. 옛 값은 "창 크기로 자른 판때기 열일곱 장"의 값이고
     지금은 골목 + 건너편 빌라 줄 + 먼 실루엣이 들어 있다. 폰에서 방 하나가 2,200 이라
     1,200 은 그 절반이 조금 넘는 값이다(드로우콜은 여전히 둘뿐이라 실제 비용은 작다). */
  ok('budget_tris', info.tris <= 1200, `창밖 삼각형 ${info.tris} ≤ 1200`);
  ok('two_layers', info.near > 0 && info.far > 0 && info.calls === 2,
     `가까운 겹·먼 겹이 따로 서고 드로우콜 ${info.calls}`);

  /* 켜고 끈 실제 렌더 비용. redraw 를 부른 직후의 renderer.info 를 읽는다. */
  const cost = async (on) => {
    await page.eval(`window.view.setOutside(${on === null ? "'auto'" : on})`);
    await page.eval(`window.view.redraw()`, false);
    await page.eval(`window.view.redraw()`, false);
    return page.eval(`(()=>{const i=window.view.three.renderer.info.render;
                            return {tris:i.triangles, calls:i.calls};})()`);
  };
  const cOff = await cost(false);
  const cOn = await cost(true);
  console.log(`      방만        삼각형 ${cOff.tris}  드로우콜 ${cOff.calls}`);
  console.log(`      창밖 포함   삼각형 ${cOn.tris}  드로우콜 ${cOn.calls}` +
              `   (+${cOn.tris - cOff.tris} · +${cOn.calls - cOff.calls})`);
  ok('draw_calls', cOn.calls - cOff.calls <= 2,
     `드로우콜 증가 ${cOn.calls - cOff.calls} ≤ 2`);
  ok('frame_tris', cOn.tris - cOff.tris <= 1200,
     `한 장당 삼각형 증가 ${cOn.tris - cOff.tris} ≤ 1200`);

  /* ── ④ ★ 빛이 안 바뀐다 ────────────────────────────────────── */
  const snaps = {};
  for (const t of [0.25, 0.50, 0.78, 0.95]) {
    await page.eval(`window.view.setOutside(false)`);
    await page.eval(`window.view.setDaylight(${t})`);
    const a = await page.eval(LIGHT_SNAP);
    await page.eval(`window.view.setOutside(true)`);
    await page.eval(`window.view.setDaylight(${t})`);
    const b = await page.eval(LIGHT_SNAP);
    snaps[t] = JSON.stringify(a) === JSON.stringify(b);
    if (!snaps[t]) { console.log('   off', JSON.stringify(a)); console.log('   on ', JSON.stringify(b)); }
  }
  ok('light_untouched', Object.values(snaps).every(Boolean),
     `t=${Object.keys(snaps).join('/')} 네 시각에서 조명값 완전 일치`);

  /* 창밖 메시가 빛을 만들거나 받을 길이 아예 없는가 — 재질·그림자 설정을 직접 본다 */
  const guard = await page.eval(`(() => {
    const S = window.view.three.scene;
    const ms = ['__outside','__outside_far'].map(n => S.getObjectByName(n)).filter(Boolean);
    return ms.map(m => ({ name: m.name, type: m.material.type, lit: !!m.material.lights,
                          cast: m.castShadow, recv: m.receiveShadow,
                          noRay: m.raycast.toString().length < 40 }));
  })()`);
  ok('no_light_path', guard.length === 2 && guard.every(g =>
       g.type === 'MeshBasicMaterial' && !g.lit && !g.cast && !g.recv && g.noRay),
     JSON.stringify(guard));

  /* 조도 엔진 — 데모에 lightEngine 이 없으면 건너뛴다(있으면 슬롯 DLI 까지 본다) */
  const dli = await page.eval(`(async()=>{
    if (!window.lightEngine || !window.lightEngine.report) return null;
    const f = () => JSON.stringify((window.lightEngine.report().slots||[])
                      .map(s=>[s.slotId, Math.round(s.dli*1e6)/1e6]));
    window.view.setOutside(false); const a = f();
    window.view.setOutside(true);  const b = f();
    return a === b;
  })()`);
  if (dli === null) console.log('SKIP  dli_untouched  (데모에 조도 엔진이 없다 — test_banjiha_profile 이 그 몫이다)');
  else ok('dli_untouched', dli === true);

  /* ── ⑤ 벽 바깥에서는 숨는가 ──────────────────────────────────────
     방뷰에는 카메라를 각도로 세우는 창구가 없다. 그래서 모듈을 직접 불러
     updateCamera 에 카메라 자리만 넣어 본다 — 판정식 자체를 재는 것이라 이쪽이 정확하다. */
  const vis = await page.eval(`(async()=>{
    const m = await import('${BASE}/src/game/outside.js');
    const sc = new THREE.Scene();
    const o = m.attachOutside({ scene: sc }, { size:{w:5,d:4,h:2.3},
                                 luxWins:[{wall:'back', cu:0, w:2.2, h:0.55, cy:1.77}] },
                              'banjiha', () => 0.5);
    const at = (x,z) => { o.updateCamera(new THREE.Vector3(x,1,z));
                          return sc.getObjectByName('__outside').visible; };
    const r = { inside: at(0, 4), side: at(4, 0), outside: at(0, -6),
                farToo: (o.updateCamera(new THREE.Vector3(0,1,-6)),
                         sc.getObjectByName('__outside_far').visible) };
    o.dispose();
    return r;
  })()`);
  ok('hidden_from_outside', vis.inside === true && vis.outside === false && vis.farToo === false,
     `방 안 ${vis.inside} · 옆 ${vis.side} · 뒷벽 바깥 ${vis.outside}(먼 겹 ${vis.farToo})`);

  /* ── ⑥ ★★ 방을 안 가린다 ──────────────────────────────────────
     이 파일의 전부인 한 가지다. 옛 방식은 "창 크기로 잘라" 이걸 지켰고 그 대가로
     방이 허공에 떠 있었다. 지금은 안 자르는 대신 **거리로** 지킨다 —
     그러면 지켜지는지를 짐작이 아니라 광선으로 재야 한다. */
  await page.eval(`window.view.setOutside('auto')`);
  await page.eval(`window.view.setDaylight(0.50)`);
  const poses = [];
  for (const [en, ev] of [['16°', 0.28], ['49°', 0.86], ['54°', 0.95]])
    for (const [zn, zv] of [['당김', 0.58], ['기본', 1.0], ['멀리', 1.15]]) {
      const c = await driveCam(page, ev, zv);
      await page.eval(`window.view.redraw()`, false);
      const cov = await page.eval(COVER + `(null)`);
      poses.push({ pose: `${en}·${zn}`, el: (c.el * 180 / Math.PI).toFixed(0), dist: c.dist.toFixed(1),
                   hits: cov.hits, points: cov.points, worst: cov.worst });
    }
  for (const p of poses)
    console.log(`      ${p.pose.padEnd(12)} 상하각 ${p.el}° · ${p.dist}m · 방 안 ${p.points}점 중 가려진 점 ${p.hits}`
                + (p.worst ? '  ' + JSON.stringify(p.worst) : ''));
  ok('not_covering', poses.every(p => p.hits === 0),
     `아홉 시점(상하각 3 × 배율 3) × 방 안 27점 = 243 광선, 창밖에 막힌 것 ${poses.reduce((a, b) => a + b.hits, 0)}개`);

  /* ── ⑦ ★ 지붕 위가 정말 찼나 (픽셀로) ─────────────────────────── */
  await driveCam(page, 0.86, 1.15);
  await page.eval(`window.view.setOutside(false)`);
  await page.eval(`window.view.redraw()`, false); await sleep(150);
  const fOff = await page.eval(`(${FILL})('off')`);
  await page.eval(`window.view.setOutside(true)`);
  await page.eval(`window.view.redraw()`, false); await sleep(150);
  const fOn = await page.eval(`(${FILL})('on')`);
  let diff = 0;
  for (let i = 0; i < fOff.px.length; i += 3) {
    const d = Math.abs(fOff.px[i] - fOn.px[i]) + Math.abs(fOff.px[i + 1] - fOn.px[i + 1])
            + Math.abs(fOff.px[i + 2] - fOn.px[i + 2]);
    if (d > 12) diff++;
  }
  const pct = Math.round(diff / (fOff.px.length / 3) * 100);
  ok('fills_above_roof', pct >= 45,
     `지붕선(y=${fOn.topY}) 위 띠 ${fOn.band[0]}~${fOn.band[1]}px 에서 표본 240점 중 ${diff}점(${pct}%)이 달라졌다 — 45% 이상이어야 "배경이 찼다"`);

  /* ★★ 방위도 돈다 — **여기가 진짜 위험한 자리다.**
     상하각·배율만 재고 안심하면 안 된다. 창 벽이 옆이나 앞으로 오면 창밖이
     카메라와 방 **사이**에 서게 된다. 그때는 감춰야 하고(updateCamera),
     감추기 문턱 바로 앞(벽이 아직 서 있는 각)에서도 방이 안 가려져야 한다. */
  await driveCam(page, 0.86, 1.0);
  const yawDrag = (dx) => `(()=>{ const c=document.getElementById('roomCanvas');
    c.dispatchEvent(new MouseEvent('mousedown',{clientX:195,clientY:420,bubbles:true}));
    for (let i=1;i<=12;i++) window.dispatchEvent(new MouseEvent('mousemove',{clientX:195+(${dx})*i/12,clientY:420,bubbles:true}));
    window.dispatchEvent(new MouseEvent('mouseup',{clientX:195+(${dx}),clientY:420,bubbles:true})); })()`;
  for (let i = 0; i < 8; i++) {
    await page.eval(yawDrag(180), false); await sleep(520);   // 한 번에 약 45°
    await page.eval(`window.view.redraw()`, false);
    const c = await page.eval(`window.view.camera()`);
    const hid = await page.eval(`window.view.outsideInfo().hidden`);
    const cov = await page.eval(COVER + `(null)`);
    poses.push({ pose: `방위 ${Math.round(((c.az - c.baseAz) * 180 / Math.PI + 720) % 360)}°${hid ? '(숨음)' : ''}`,
                 el: (c.el * 180 / Math.PI).toFixed(0), dist: c.dist.toFixed(1),
                 hits: cov.hits, points: cov.points, worst: cov.worst });
  }
  for (const p of poses.slice(9))
    console.log(`      ${p.pose.padEnd(12)} 상하각 ${p.el}° · ${p.dist}m · 방 안 ${p.points}점 중 가려진 점 ${p.hits}`
                + (p.worst ? '  ' + JSON.stringify(p.worst) : ''));
  ok('not_covering_yaw', poses.slice(9).every(p => p.hits === 0),
     `방위 여덟 자리에서 창밖에 막힌 점 ${poses.slice(9).reduce((a, b) => a + b.hits, 0)}개`);

  /* ============================================================
     ⑧ ★ 이웃 방 — 우리 방 양옆 (2026-08-15)
     ------------------------------------------------------------
     박사님: *"집 주변에도 집을 몇개더 배치하자. 물론 그 바라보는 방향은 투명되게해서"*
     증명할 것이 창밖과 **같은 넷**이다 — 붙는가 · 얼마나 비싼가 · 빛을 안 건드리나 ·
     우리 방을 안 가리나. 거기에 이웃만의 것 둘을 더한다:
       ⓐ 카메라를 향한 벽이 **정말로 밑동이 되나**(house.js 와 같은 자를 쓰나)
       ⓑ 이웃이 우리 방보다 **어두운가** — 화면 픽셀로 잰다
  ============================================================ */
  await page.eval(`window.view.setRoom('banjiha').then(()=>1)`, true, 120000);
  await sleep(600);
  await page.eval(`window.view.setOutside('auto')`);
  await page.eval(`window.view.setNeighbors('auto')`);
  await page.eval(`window.view.setDaylight(0.50)`);

  const nb = await page.eval(`window.view.neighborInfo()`);
  ok('nbr_built', nb.tris > 0 && nb.rooms === 2 && nb.walls.length === 6,
     `삼각형 ${nb.tris} · 방 ${nb.rooms}개 · 벽 ${nb.walls.length}장 [${nb.walls}]`);
  /* ★ 드로우콜 하나. 벽마다 메시를 나누면 여섯이 되는데, 그 대신 정점을 눌러 접는다 */
  ok('nbr_one_call', nb.calls === 1 && nb.materials === 1,
     `드로우콜 ${nb.calls} · 재질 ${nb.materials} — 벽 여섯 장을 한 버퍼에서 접는다`);
  ok('nbr_budget', nb.tris <= 300, `이웃 삼각형 ${nb.tris} ≤ 300 (폰에서 도는 게임이다)`);
  /* 자를 어겨 안 놓은 덩어리가 있으면 그림에 구멍이 난 것이다 — 값을 고쳐야 한다 */
  ok('nbr_no_skipped', (nb.skipped || []).length === 0,
     `yLim 을 어겨 빠진 덩어리 ${(nb.skipped || []).length}개 · 자 d0 ${nb.yLim.d0} · d2.6 ${nb.yLim.d2_6}`);

  const nCost = async (on) => {
    await page.eval(`window.view.setNeighbors(${on === null ? "'auto'" : on})`);
    await page.eval(`window.view.redraw()`, false);
    await page.eval(`window.view.redraw()`, false);
    return page.eval(`(()=>{const i=window.view.three.renderer.info;
      return {tris:i.render.triangles, calls:i.render.calls, tex:i.memory.textures};})()`);
  };
  const nOff = await nCost(false), nOn = await nCost(true);
  console.log(`      이웃 끔      삼각형 ${nOff.tris}  드로우콜 ${nOff.calls}  텍스처 ${nOff.tex}`);
  console.log(`      이웃 켬      삼각형 ${nOn.tris}  드로우콜 ${nOn.calls}  텍스처 ${nOn.tex}` +
              `   (+${nOn.tris - nOff.tris} · +${nOn.calls - nOff.calls} · +${nOn.tex - nOff.tex})`);
  ok('nbr_cost', nOn.calls - nOff.calls === 1 && nOn.tris - nOff.tris <= 300 && nOn.tex === nOff.tex,
     `한 장당 +${nOn.tris - nOff.tris} 삼각형 · +${nOn.calls - nOff.calls} 드로우콜 · +${nOn.tex - nOff.tex} 텍스처`);

  /* ★★ 빛 — 이웃을 켜고 끈 두 벌이 **글자 하나까지** 같아야 한다 */
  const nSnap = {};
  for (const t of [0.25, 0.50, 0.78, 0.95]) {
    await page.eval(`window.view.setNeighbors(false)`);
    await page.eval(`window.view.setDaylight(${t})`);
    const a = await page.eval(LIGHT_SNAP);
    await page.eval(`window.view.setNeighbors(true)`);
    await page.eval(`window.view.setDaylight(${t})`);
    const b = await page.eval(LIGHT_SNAP);
    nSnap[t] = JSON.stringify(a) === JSON.stringify(b);
    if (!nSnap[t]) { console.log('   off', JSON.stringify(a)); console.log('   on ', JSON.stringify(b)); }
  }
  ok('nbr_light_untouched', Object.values(nSnap).every(Boolean),
     `t=${Object.keys(nSnap).join('/')} 네 시각에서 조명값 완전 일치`);

  const nGuard = await page.eval(`(() => {
    const m = window.view.three.scene.getObjectByName('__nbr');
    if (!m) return null;
    return { type: m.material.type, lit: !!m.material.lights, cast: m.castShadow,
             recv: m.receiveShadow, noRay: m.raycast.toString().length < 40,
             deco: !!m.userData.decorative };
  })()`);
  ok('nbr_no_light_path', nGuard && nGuard.type === 'MeshBasicMaterial' && !nGuard.lit &&
       !nGuard.cast && !nGuard.recv && nGuard.noRay && nGuard.deco, JSON.stringify(nGuard));

  /* ⑧-ⓐ 벽이 정말로 접히나 — 방위를 돌려 가며 「지금 밑동인 벽」이 바뀌는지 본다.
     ⚠ 「코드가 있다」와 「화면이 그렇다」는 다른 말이다. 목록을 실제로 읽는다. */
  await page.eval(`window.view.setDaylight(0.50)`);
  await driveCam(page, 0.86, 1.0);
  const stubSets = new Set();
  const nposes = [];
  for (let i = 0; i < 8; i++) {
    await page.eval(yawDrag(180), false); await sleep(520);
    await page.eval(`window.view.redraw()`, false);
    const c = await page.eval(`window.view.camera()`);
    const st = await page.eval(`window.view.neighborInfo().stubbed`);
    const cov = await page.eval(COVER + `(['__nbr'])`);
    stubSets.add(st.slice().sort().join(','));
    nposes.push({ yaw: Math.round(((c.az - c.baseAz) * 180 / Math.PI + 720) % 360),
                  el: (c.el * 180 / Math.PI).toFixed(0), st, hits: cov.hits, points: cov.points,
                  worst: cov.worst });
  }
  for (const p of nposes)
    console.log(`      방위 ${String(p.yaw).padStart(3)}°  밑동 [${p.st.join(' ')}]`.padEnd(56) +
                ` 방 안 ${p.points}점 중 이웃에 막힌 점 ${p.hits}` + (p.worst ? '  ' + JSON.stringify(p.worst) : ''));
  ok('nbr_stub_follows_camera', stubSets.size >= 3,
     `방위 여덟에서 밑동이 되는 벽 조합이 ${stubSets.size}가지 — 카메라를 따라 바뀐다`);
  ok('nbr_not_covering_yaw', nposes.every(p => p.hits === 0),
     `방위 여덟 × 방 안 27점 = ${nposes.length * 27} 광선, 이웃에 막힌 것 ${nposes.reduce((a, b) => a + b.hits, 0)}개`);

  /* 상하각·배율도 — 제일 나쁜 각은 **제일 낮게 눕힌 각**이다(그때 광선이 옆으로 눕는다) */
  const nposes2 = [];
  for (const [en, ev] of [['16°', 0.28], ['49°', 0.86], ['54°', 0.95]])
    for (const [zn, zv] of [['당김', 0.58], ['기본', 1.0], ['멀리', 1.15]]) {
      const c = await driveCam(page, ev, zv);
      await page.eval(`window.view.redraw()`, false);
      const cov = await page.eval(COVER + `(['__nbr'])`);
      nposes2.push({ pose: `${en}·${zn}`, el: (c.el * 180 / Math.PI).toFixed(0), hits: cov.hits, worst: cov.worst });
    }
  for (const p of nposes2) if (p.hits) console.log(`      ${p.pose} 상하각 ${p.el}° 막힌 점 ${p.hits} ${JSON.stringify(p.worst)}`);
  ok('nbr_not_covering', nposes2.every(p => p.hits === 0),
     `아홉 시점 × 27점 = 243 광선, 이웃에 막힌 것 ${nposes2.reduce((a, b) => a + b.hits, 0)}개`);

  /* ⑧-ⓑ 이웃이 우리 방보다 어두운가 — **화면 픽셀**로 잰다.
     ★ 우리 방이 주인공이다. 이웃이 더 밝으면 눈이 그쪽으로 간다.
     ⚠⚠ 처음엔 점 하나씩(이웃 한가운데)만 찍었다. 그런데 그 각에서 그 점이 화면 **밖**이라
       `null` 이 나왔고, 「null 이면 넘어간다」로 짜 놓아 두 검사가 **아무것도 안 재고 통과**했다.
       START-HERE §2.9-① 그대로다 — **안 나온 것을 「없다」로 읽으면 안 된다.**
       ⇒ 이웃 바닥을 격자로 훑고, **화면에 든 표본이 모자라면 방위를 돌려 다시 잰다.**
         그래도 모자라면 **실패**다(못 쟀으면 못 쟀다고 한다). */
  const LUM = `((pts) => {
    const cv = document.getElementById('roomCanvas');
    window.view.redraw();
    const c2 = document.createElement('canvas');
    c2.width = cv.width; c2.height = cv.height;
    const g = c2.getContext('2d'); g.drawImage(cv, 0, 0);
    const cam = window.view.three.cam;
    const acc = {};
    for (const [name, wp] of pts) {
      const q = new THREE.Vector3(wp[0], wp[1], wp[2]).project(cam);
      if (q.z > 1) continue;                                   // 카메라 뒤
      const x = Math.round((q.x * 0.5 + 0.5) * c2.width), y = Math.round((-q.y * 0.5 + 0.5) * c2.height);
      if (x < 5 || y < 5 || x >= c2.width - 5 || y >= c2.height - 5) continue;
      const d = g.getImageData(x - 3, y - 3, 7, 7).data;
      let s = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) { s += 0.2126*d[i] + 0.7152*d[i+1] + 0.0722*d[i+2]; n++; }
      (acc[name] = acc[name] || []).push(s / n);
    }
    const out = {};
    for (const k in acc) out[k] = { n: acc[k].length,
                                    avg: +(acc[k].reduce((a, b) => a + b, 0) / acc[k].length).toFixed(1) };
    return out;
  })`;
  const b0 = await page.eval(`window.view.roomSize()`);
  /* 바닥을 격자로 — 우리 방은 안쪽, 이웃은 제 방 한가운데 쪽만(벽에 안 걸리게) */
  const lp = [];
  for (const fx of [-0.3, 0, 0.3]) for (const fz of [-0.3, 0, 0.3]) {
    lp.push(['ours', [fx * b0.w, 0.02, fz * b0.d]]);
    lp.push(['nbr', [b0.w * (1 + fx * 0.5), 0.02, fz * b0.d]]);
    lp.push(['nbr', [-b0.w * (1 + fx * 0.5), 0.02, fz * b0.d]]);
  }
  const lumPts = JSON.stringify(lp);
  const lum = {};
  for (const t of [0.50, 0.92]) {
    await page.eval(`window.view.setDaylight(${t})`);
    let m = null;
    for (let try_ = 0; try_ < 7; try_++) {
      await driveCam(page, 0.86, 1.15);
      m = await page.eval(LUM + `(${lumPts})`);
      if (m.ours && m.ours.n >= 4 && m.nbr && m.nbr.n >= 4) break;
      await page.eval(yawDrag(180), false); await sleep(520);   // 화면 밖이면 돌려서 다시 잰다
    }
    lum[t] = m;
    console.log(`      t=${t}  우리 방 바닥 ${m.ours ? m.ours.avg + '(' + m.ours.n + '점)' : '못 쟀다'}` +
                ` · 이웃 바닥 ${m.nbr ? m.nbr.avg + '(' + m.nbr.n + '점)' : '못 쟀다'}`);
  }
  const measured = Object.values(lum).every(L => L.ours && L.ours.n >= 4 && L.nbr && L.nbr.n >= 4);
  ok('nbr_lum_measurable', measured, '낮·밤 둘 다 우리 방 4점 이상 · 이웃 4점 이상을 실제로 쟀다');
  ok('nbr_darker_than_room', measured && Object.values(lum).every(L => L.nbr.avg < L.ours.avg),
     `낮 ${lum[0.5].nbr.avg} < ${lum[0.5].ours.avg} · 밤 ${lum[0.92].nbr.avg} < ${lum[0.92].ours.avg}`);
  /* 그래도 **까맣게 사라지면 안 된다** — 사라지면 밤마다 「방이 떠 있다」가 되돌아온다 */
  ok('nbr_not_a_void', measured && Object.values(lum).every(L => L.nbr.avg > 4),
     `밤 이웃 휘도 ${lum[0.92].nbr.avg} > 4 (배경보다 어두운 구멍이 아니다)`);

  /* ⑧-ⓒ ★ **화면이 정말 달라지나** — 방 옆 띠의 화소를 센다.
     「코드가 바뀐 것」과 「화면이 바뀐 것」은 다른 말이다(START-HERE §2).
     ⚠⚠ 이 자를 게임(game.html)에서 대면 **거짓말을 한다** — 게임은 시계가 돌아서
       두 장 사이에 해가 움직이고, 그러면 화소가 88.9% 달라진 것으로 나온다(실제로 그렇게 나왔다).
       그래서 **시각을 못박고 다시 그리기를 끈 데모**에서만 잰다.
     띠는 방 상자를 화면에 투영한 **좌·우 바깥쪽**이다 — 이웃이 설 자리가 거기다. */
  const SIDE = `(() => {
    const cv = document.getElementById('roomCanvas');
    window.view.redraw();
    const c2 = document.createElement('canvas');
    c2.width = cv.width; c2.height = cv.height;
    const g = c2.getContext('2d'); g.drawImage(cv, 0, 0);
    const v = window.view, b = v.roomSize(), cam = v.three.cam;
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const sx of [-0.5, 0.5]) for (const sy of [0, 1]) for (const sz of [-0.5, 0.5]) {
      const q = new THREE.Vector3(sx * b.w, sy * b.h, sz * b.d).project(cam);
      const px = (q.x * 0.5 + 0.5) * c2.width, py = (-q.y * 0.5 + 0.5) * c2.height;
      x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
    }
    /* ⚠ 「방 상자의 좌·우 바깥」으로 잡았더니 표본이 **0점**이었다 — 방 가로가 이미 화면 폭의
       95.6% 라 상자 옆은 화면 밖이다(frame-to-plan §). 그래서 **상자 밖 전부**를 훑는다.
       상자 안은 안 센다: 거기는 안 바뀌어야 정상이고, 세면 「안 바뀐 화소」로 값이 묽어진다. */
    const out = [];
    for (let i = 0; i < 300; i++) {
      const x = Math.round(c2.width * (0.03 + 0.94 * ((i * 37) % 300) / 300));
      const y = Math.round(c2.height * (0.09 + 0.86 * ((i * 61) % 300) / 300));
      const inBox = x > x0 - 3 && x < x1 + 3 && y > y0 - 3 && y < y1 + 3;
      if (inBox || x < 1 || y < 1 || x >= c2.width - 1 || y >= c2.height - 1) { out.push(-1, -1, -1); continue; }
      const d = g.getImageData(x, y, 1, 1).data;
      out.push(d[0], d[1], d[2]);
    }
    return { box: [Math.round(x0), Math.round(x1), Math.round(y0), Math.round(y1)], px: out };
  })`;
  await page.eval(`window.view.setDaylight(0.50)`);
  await driveCam(page, 0.86, 1.15);
  /* ★ **창밖을 끄고 잰다.** 켜 두면 골목이 이미 그 자리를 상당히 덮고 있어서
     「이웃이 채운 몫」이 방위에 따라 16%~ 로 오르락내리락한다 — 문턱을 어디 둬도 흔들린다.
     여기서 알고 싶은 것은 **이웃 하나가 빈 배경을 얼마나 채우나**다. 그래서 골목을 뺀다. */
  await page.eval(`window.view.setOutside(false)`);
  await page.eval(`window.view.setNeighbors(false)`);
  await page.eval(`window.view.redraw()`, false); await sleep(160);
  const sOff = await page.eval(SIDE + `()`);
  await page.eval(`window.view.setNeighbors(true)`);
  await page.eval(`window.view.redraw()`, false); await sleep(160);
  const sOn = await page.eval(SIDE + `()`);
  await page.eval(`window.view.setOutside('auto')`);
  let sDiff = 0, sSeen = 0;
  for (let i = 0; i < sOff.px.length; i += 3) {
    if (sOff.px[i] < 0 || sOn.px[i] < 0) continue;
    sSeen++;
    if (Math.abs(sOff.px[i] - sOn.px[i]) + Math.abs(sOff.px[i+1] - sOn.px[i+1])
      + Math.abs(sOff.px[i+2] - sOn.px[i+2]) > 12) sDiff++;
  }
  const sPct = sSeen ? Math.round(sDiff / sSeen * 100) : 0;
  /* ★ 문턱 10%. 실측은 16% 인데 딱 붙여 두면 방위가 조금만 달라져도 흔들린다 —
     이 검사가 잡아야 하는 것은 「이웃이 화면에서 사라졌다」(0%)이지 「16%가 15%가 됐다」가 아니다.
     ⚠ 표본 자리가 방 상자 **밖 전부**라 대부분은 이웃과 상관없는 먼 배경이다. 16% 는 그래서 낮다. */
  ok('nbr_fills_side', sSeen >= 60 && sPct >= 10,
     `창밖을 끈 채 · 방 상자 **밖**(화면 [${sOn.box}] 제외) 표본 ${sSeen}점 중 ${sDiff}점(${sPct}%)이 달라졌다 — 10% 이상이어야 "옆이 찼다"`);

  await page.eval(`window.view.setDaylight(0.50)`);
  await page.eval(`window.view.setNeighbors('auto')`);

  /* ── ② 위층 방에는 안 붙는다 ─────────────────────────────────── */
  await page.eval(`window.view.setOutside('auto')`);
  for (const room of ['apartment', 'greenhouse']) {
    await page.eval(`window.view.setRoom('${room}').then(()=>1)`, true, 120000);
    await sleep(400);
    const i = await page.eval(`window.view.outsideInfo()`);
    ok(`upstairs_${room}`, i.tris === 0, `삼각형 ${i.tris} — 위층에 골목 바닥을 깔면 거짓말이다`);
  }

  /* ── ③ 창 없는 방에서 안 터진다 ──────────────────────────────── */
  const noWin = await page.eval(`(async()=>{
    const m = await import('${BASE}/src/game/outside.js');
    const size = { w:5, d:4, h:2.3 };
    const mk = (built) => { const sc = new THREE.Scene();
      const h = m.attachOutside({ scene: sc }, built, 'x', () => 0.5);
      if (h) h.dispose();
      return h === null; };
    return {
      none:    mk({ size, luxWins: [] }),
      missing: mk({ size }),
      ceiling: mk({ size, luxWins: [{wall:'ceiling', w:2, h:2, cy:2.3}] }),
      nobuilt: mk(null),
      noscene: m.attachOutside({}, { size, luxWins:[{wall:'back',w:2,h:0.5,cy:1.7}] }, 'x') === null
    };
  })()`);
  ok('no_window_safe', Object.values(noWin).every(Boolean), JSON.stringify(noWin));

  /* ── 그림 ──────────────────────────────────────────────────── */
  if (SHOTS) {
    await page.eval(`window.view.setRoom('banjiha').then(()=>1)`, true, 120000);
    await page.eval(`window.view.setOutside('auto')`);
    await sleep(1500);
    const shot = async (name, note) => {
      await page.eval(`window.view.redraw()`, false);
      await sleep(120);
      const f = path.join(OUT, `outside_${name}.png`);
      await page.shot(f);
      console.log(`      ${name.padEnd(12)} ${path.relative(ROOT, f)}  ${note || ''}`);
    };
    /* ★ 창만 크게 잘라 찍는다 — 폰 화면에서 창은 손톱만 해서, 전체 그림으로는
       "달라진 게 있나"를 눈으로 못 가린다. 창 네 귀퉁이를 투영해 그 자리만 4배로. */
    const winShot = async (name, note) => {
      await page.eval(`window.view.redraw()`, false);
      await sleep(120);
      const box = await page.eval(`(() => {
        const c = window.view.three.cam, r = document.getElementById('roomCanvas').getBoundingClientRect();
        let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
        for (const dx of [-1.1, 1.1]) for (const dy of [-0.28, 0.28]) {
          const v = new THREE.Vector3(dx, 1.77+dy, -2.1).project(c);
          const px = r.left + (v.x*0.5+0.5)*r.width, py = r.top + (-v.y*0.5+0.5)*r.height;
          x0=Math.min(x0,px); x1=Math.max(x1,px); y0=Math.min(y0,py); y1=Math.max(y1,py);
        }
        const p = 26;
        return { x:Math.max(0,x0-p), y:Math.max(0,y0-p), width:(x1-x0)+p*2, height:(y1-y0)+p*2 };
      })()`);
      const r = await page.send('Page.captureScreenshot',
        { format: 'png', clip: { ...box, scale: 4 }, captureBeyondViewport: false });
      const f = path.join(OUT, `outside_${name}.png`);
      fs.mkdirSync(path.dirname(f), { recursive: true });
      fs.writeFileSync(f, Buffer.from(r.data, 'base64'));
      console.log(`      ${name.padEnd(12)} ${path.relative(ROOT, f)}  ${note || ''}`);
    };
    /* 기본 시점 그대로 찍는다 — 게임이 실제로 보여 주는 각이 그것이다
       (windowAzimuth + 45°. 창이 화면에 보이도록 이미 맞춰져 있다) */
    await driveCam(page, 0.86, 1.0);
    for (const [t, name] of [[0.30, 'morning'], [0.50, 'noon'], [0.74, 'evening'], [0.95, 'night']]) {
      await page.eval(`window.view.setDaylight(${t})`);
      await shot(name, `t=${t}`);
    }
    /* 켜고 끈 비교 — 같은 카메라·같은 시각 */
    await page.eval(`window.view.setDaylight(0.50)`);
    await page.eval(`window.view.setOutside(false)`); await shot('off', '창밖 없음(비교용)');
    await page.eval(`window.view.setOutside(true)`);  await shot('on', '창밖 있음');

    /* 창만 크게 — 켜고 끈 비교와 시간대 */
    await page.eval(`window.view.setOutside(false)`); await winShot('win_off', '창 확대 · 창밖 없음');
    await page.eval(`window.view.setOutside(true)`);  await winShot('win_noon', '창 확대 · 한낮');
    await page.eval(`window.view.setDaylight(0.30)`); await winShot('win_morning', '창 확대 · 아침');
    await page.eval(`window.view.setDaylight(0.74)`); await winShot('win_evening', '창 확대 · 저녁');
    await page.eval(`window.view.setDaylight(0.95)`); await winShot('win_night', '창 확대 · 밤');

    /* ★ 상하각 · 배율 양 끝 — "방을 안 덮는다"와 "축소하면 배경이 찬다"의 그림 증거 */
    await page.eval(`window.view.setDaylight(0.50)`);
    for (const [el, zk, name] of [[0.28, 1.15, 'el_min'], [0.95, 1.15, 'el_max'],
                                  [0.86, 0.58, 'zoom_in'], [0.86, 1.15, 'zoom_out']]) {
      const c = await driveCam(page, el, zk);
      await shot(name, `상하각 ${(c.el * 180 / Math.PI).toFixed(0)}° · ${c.dist.toFixed(1)}m — 방이 가려지면 실패다`);
    }
  }

  await page.close();
  console.log(`\n${bad ? 'FAIL' : 'PASS'}  test_outside  (${bad} 실패)`);
  process.exit(bad ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
