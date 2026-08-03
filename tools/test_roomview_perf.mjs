/* ============================================================
   tools/test_roomview_perf.mjs — 걸을 때 프레임이 떨어지는지 **잰다**
   ------------------------------------------------------------
   "짐작으로 고치지 마십시오." 그래서 재는 도구를 먼저 둔다.
   3차 워커의 tools/test_cdp.mjs(헤드리스 크롬 + CDP)를 그대로 쓴다.

     python tools/serve.py 8981
     node tools/test_roomview_perf.mjs            # 폰 흉내: 390×844 · dpr2 · CPU 4배 느리게
     node tools/test_roomview_perf.mjs --cpu 6    # 더 느린 폰
     node tools/test_roomview_perf.mjs --cpu 1    # 스로틀 없이

   ★ 무엇을 재나
     걷기 전 / 걷는 중 / 걷기 후 세 구간에서
       renderMs   renderer.render 한 번에 걸린 시간 (중앙값·p95)
       fps        실제로 그린 장수 / 초
       calls      한 장당 드로우콜
       tris       한 장당 삼각형
       shadowBake 그 구간에 그림자맵을 몇 번 다시 구웠나
       navPath    그 구간에 길찾기(BFS)를 몇 번 돌렸나
       nudge      그 구간에 비켜서기 판정을 몇 번 돌렸나

   ⚠ 헤드리스는 SwiftShader(소프트웨어 GL)다. 절대값은 폰과 다르다 —
     **구간끼리의 비**와 **횟수**를 본다. 횟수는 GPU 와 무관하게 정확하다.
============================================================ */
import { launch, sleep } from './test_cdp.mjs';

const BASE = process.env.BYEOT_URL || 'http://localhost:8981';
const argv = process.argv.slice(2);
const argOf = (k, d) => { const i = argv.indexOf(k); return i < 0 ? d : argv[i + 1]; };
const CPU = +argOf('--cpu', 4);
const ROOM = argOf('--room', 'banjiha');
/* 픽셀비를 낮추면 SwiftShader 의 래스터가 싸져서 **CPU 쪽 비용만** 드러난다.
   폰은 GPU 가 멀쩡하고 CPU 가 느리다 — 우리가 봐야 하는 건 이쪽이다. */
const PX = +argOf('--px', 0.35);

/* 페이지 안에 계량기를 심는다. renderer.render 를 감싸 시간을 재고,
   three 의 그림자 굽기·room_view 의 길찾기/비켜서기 호출을 센다. */
const INSTALL = `(() => {
  const v = window.view, r = v.three.renderer;
  const M = window.__perf = { on:false, t:[], calls:[], tris:[], shadow:0, t0:0, frames:0, s0:null,
                              raf:0, gap:[], last:0 };
  /* 브라우저가 실제로 몇 프레임을 돌렸나 — 그리지 않은 프레임까지 센다.
     '렌더가 싸도 프레임이 안 도는' 경우(=JS 가 붙잡고 있는 경우)를 가른다. */
  (function tick(t) { requestAnimationFrame(tick);
    if (M.on) { if (M.last) M.gap.push(t - M.last); M.raf++; }
    M.last = t; })(performance.now());
  /* 그림자맵을 실제로 다시 구웠는가 — scene.js 가 shadow.autoUpdate 를 꺼 뒀으므로
     needsUpdate 가 참인 프레임에만 굽는다. render 직전에 세면 그게 굽는 횟수다. */
  const lights = [v.three.sunLight, v.three.ceilingBulb, ...(v.three.skyPortals || [])].filter(Boolean);
  const raw = r.render.bind(r);
  r.render = function (sc, cam) {
    if (!M.on) return raw(sc, cam);
    for (const L of lights) if (L.castShadow && L.shadow && L.shadow.needsUpdate) M.shadow++;
    const a = performance.now();
    raw(sc, cam);
    const b = performance.now();
    M.t.push(b - a); M.calls.push(r.info.render.calls); M.tris.push(r.info.render.triangles);
    M.frames++;
  };
  return true;
})()`;

const START = `(() => { const M = window.__perf;
  M.on = false; M.t = []; M.calls = []; M.tris = []; M.shadow = 0; M.raf = 0; M.gap = []; M.last = 0;
  M.frames = 0; M.s0 = window.view.stats(); M.t0 = performance.now(); M.on = true; return true; })()`;

const STOP = `(() => {
  const M = window.__perf; M.on = false;
  const s1 = window.view.stats();
  const dt = (performance.now() - M.t0) / 1000;
  const med = a => { if (!a.length) return 0; const s = [...a].sort((x,y)=>x-y); return s[s.length>>1]; };
  const p95 = a => { if (!a.length) return 0; const s = [...a].sort((x,y)=>x-y); return s[Math.min(s.length-1, Math.floor(s.length*0.95))]; };
  return {
    sec: +dt.toFixed(2), frames: M.frames, fps: +(M.frames / dt).toFixed(1),
    rafFps: +(M.raf / dt).toFixed(1), gapP95: +p95(M.gap).toFixed(1),
    renderMed: +med(M.t).toFixed(2), renderP95: +p95(M.t).toFixed(2),
    calls: Math.round(med(M.calls)), tris: Math.round(med(M.tris)),
    shadowBake: M.shadow,
    navPath: (s1.navPaths || 0) - ((M.s0 && M.s0.navPaths) || 0),
    nudge: (s1.nudges || 0) - ((M.s0 && M.s0.nudges) || 0)
  };
})()`;

const row = (name, s) =>
  `${name.padEnd(10)} ${String(s.fps).padStart(5)} ${String(s.rafFps).padStart(6)}  ${String(s.renderMed).padStart(6)}` +
  `  ${String(s.renderP95).padStart(6)}  ${String(s.gapP95).padStart(6)}  ${String(s.calls).padStart(5)}` +
  `  ${String(s.tris).padStart(6)}  ${String(s.shadowBake).padStart(5)}  ${String(s.navPath).padStart(4)}  ${String(s.nudge).padStart(4)}`;
const HEAD = '구간        그린fps  rAFfps  렌더중앙  렌더p95  프레임간격p95  콜수  삼각형  그림자  길찾기  비켜';

async function main() {
  const page = await launch({ width: 390, height: 844, dpr: 2, mobile: false,
                              throttle: CPU > 1 ? { cpu: CPU } : null });
  page.on((m, p) => { if (m === 'Runtime.exceptionThrown') console.log('EX ' + p.exceptionDetails.text); });
  await page.goto(`${BASE}/tools/room_view_demo.html?room=${ROOM}`);
  await page.waitFor('!!window.view', 180000, 200);

  /* 게임과 같은 상태로 만든다 — 화분 둘 · 사람 · 몬이. setContinuous 는 켜지 않는다
     (게임은 안 켠다. 켜면 '노는 프레임'까지 세어 답이 달라진다). */
  await page.eval(`window.view.setCharacter('jachwi').then(()=>1)`);
  await page.eval(`window.view.setCharacter('moni').then(()=>1)`);
  await page.eval(`(async()=>{ const S=window.view.slots().filter(s=>!s.occupied).slice(0,2);
    for (const s of S) await window.view.setPlant(s.slotId, {kind:'monstera', growthDays:200, seed:7, band:'good'});
    return S.length; })()`);
  await sleep(1500);
  await page.eval(INSTALL);
  /* ★ 픽셀비를 못 박는다. 안 박으면 autoQuality 가 도중에 갈아 끼워서
     구간마다 다른 해상도를 재게 된다(실제로 그랬다 — 1.5 로 올려 버렸다). */
  if (PX > 0) await page.eval(`(()=>{ const r = window.view.three.renderer;
    r.setPixelRatio(${PX}); r.setPixelRatio = () => {}; window.view.redraw(); return 1; })()`);
  await page.eval(`window.view.selectCharacter('jachwi')`);
  await sleep(400);

  console.log(`\n방=${ROOM} · 390×844 dpr2 · CPU ${CPU}배 느리게 · 픽셀비 ${PX} · SwiftShader\n`);
  console.log(HEAD);
  console.log('─'.repeat(100));

  /* ── 걷기 전 ── */
  await page.eval(START); await sleep(3000);
  const before = await page.eval(STOP);
  console.log(row('걷기 전', before));

  /* ── 끄는 중 ── 손가락으로 목적지를 끌고 다니는 구간(미리보기가 따라온다) ── */
  await page.eval(START);
  await page.eval(`(()=>{ const r=document.getElementById('roomCanvas').getBoundingClientRect();
    const f=window.view.characterScreenPos('jachwi');
    window.__dragBase = { x: r.left+f.x, y: r.top+f.y };
    const c=document.getElementById('roomCanvas');
    c.dispatchEvent(new MouseEvent('mousedown',{clientX:window.__dragBase.x,clientY:window.__dragBase.y,bubbles:true}));
    return 1; })()`);
  for (let i = 0; i < 45; i++) {
    await page.eval(`(()=>{ const b=window.__dragBase; const a=${i}/45*6.283;
      window.dispatchEvent(new MouseEvent('mousemove',{clientX:b.x+Math.cos(a)*70,clientY:b.y+Math.sin(a)*45,bubbles:true})); })()`, false);
    await sleep(16);
  }
  const drag = await page.eval(STOP);
  await page.eval(`window.dispatchEvent(new MouseEvent('mouseup',{clientX:window.__dragBase.x,clientY:window.__dragBase.y,bubbles:true}))`, false);
  await sleep(200);
  await page.eval(`window.view.stopWalk('jachwi')`);
  console.log(row('끄는 중', drag));

  /* ── 걷는 중 ── 가장 먼 자리로 보낸다 ── */
  const sent = await page.eval(`(()=>{
    const r = document.getElementById('roomCanvas').getBoundingClientRect();
    const f = window.view.characterScreenPos('jachwi');
    let best = null, bestD = 0;
    const me = window.view.characters().find(c=>c.id==='jachwi').pos;
    for (let a=0; a<16; a++) for (const R of [60, 110, 160]) {
      const x = r.left+f.x+Math.cos(a/16*6.283)*R, y = r.top+f.y+Math.sin(a/16*6.283)*R*0.6;
      const t = window.view.previewWalk('jachwi', x, y);
      if (t && t.ok) { const d = Math.hypot(t.x-me.x, t.z-me.z); if (d > bestD) { bestD = d; best = {x, y, d}; } }
    }
    window.view.previewWalk('jachwi', null, null);
    if (!best) return null;
    return { d: +best.d.toFixed(2), best };
  })()`);
  await page.eval(START);
  const sentR = await page.eval(`window.view.walkTo('jachwi', ${sent ? sent.best.x : 0}, ${sent ? sent.best.y : 0})`);
  let n = 0;
  while (n++ < 200 && await page.eval(`window.view.isWalking('jachwi')`)) await sleep(50);
  const during = await page.eval(STOP);
  console.log(row('걷는 중', during));

  /* ── 걷기 후 ── */
  await sleep(300);
  await page.eval(START); await sleep(3000);
  const after = await page.eval(STOP);
  console.log(row('걷기 후', after));

  console.log('─'.repeat(100));
  console.log(`보낸 거리 ${sent && sent.d}m · ${JSON.stringify(sentR)}`);
  const drop = before.fps ? (1 - during.fps / before.fps) * 100 : 0;
  console.log(`걸을 때 그린fps 낙폭 ${drop.toFixed(0)}%  ·  중앙 렌더 ${before.renderMed} → ${during.renderMed}ms`);
  console.log(`stats() ${JSON.stringify(await page.eval('window.view.stats()'))}`);

  await page.close();
}
main().catch(e => { console.error(e); process.exit(1); });
