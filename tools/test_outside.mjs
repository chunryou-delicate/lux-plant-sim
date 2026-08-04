/* ============================================================
   tools/test_outside.mjs — 창밖 골목: **값을 재고** 그림을 남긴다
   ------------------------------------------------------------
     python tools/serve.py 8993
     node tools/test_outside.mjs              # 검사 + 스크린샷
     node tools/test_outside.mjs --no-shots   # 검사만 (빠르다)

   ★ 무엇을 증명하나
     ① 반지하에 골목이 붙는다 — 삼각형·드로우콜 증가분을 **숫자로** 남긴다
     ② 위층 방(아파트·온실)에는 안 붙는다 (기본 'auto' 는 반지하만)
     ③ 창 없는 방에서 안 터진다 (창 목록을 비워서 직접 만들어 본다)
     ④ ★★ **빛이 한 자리도 안 바뀐다** — 창밖을 켜고 끄고 같은 시각에
        sunLight·skyPortals·hemi·ambient 와 조도 엔진 결과(dliAt)를 비교한다.
        이게 이 워커의 안전선이다. 배경은 보이는 것이지 빛의 근원이 아니다.
     ⑤ 카메라가 그 벽 바깥으로 가면 골목이 숨는다 (벽이 밑동만 남을 때)

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
     `삼각형 ${info.tris} · 판 ${info.quads} · 벽 [${info.walls}]`);
  ok('budget_tris', info.tris <= 400, `창밖 삼각형 ${info.tris} ≤ 400`);

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
  ok('frame_tris', cOn.tris - cOff.tris <= 400,
     `한 장당 삼각형 증가 ${cOn.tris - cOff.tris} ≤ 400`);

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
     방뷰에는 카메라를 각도로 세우는 창구가 없다(손가락으로만 돈다).
     그래서 모듈을 직접 불러 updateVisibility 에 카메라 자리만 넣어 본다 —
     판정식 자체를 재는 것이라 오히려 이쪽이 정확하다. */
  const vis = await page.eval(`(async()=>{
    const m = await import('${BASE}/src/render3d/outside_alley.js');
    const o = m.buildOutsideAlley({ size:{w:5,d:4,h:2.3},
                                    luxWins:[{wall:'back', w:2.2, h:0.55, cy:1.77}] });
    const at = (x,z) => { o.updateVisibility(new THREE.Vector3(x,1,z));
                          return o.group.children[0].visible; };
    const r = { inside: at(0, 4), side: at(4, 0), outside: at(0, -6) };
    o.dispose();
    return r;
  })()`);
  ok('hidden_from_outside', vis.inside === true && vis.outside === false,
     `방 안 ${vis.inside} · 옆 ${vis.side} · 뒷벽 바깥 ${vis.outside}`);

  /* ── ⑥ ★ 지붕 위로 안 삐져나온다 ────────────────────────────────
     이게 이 파일의 전부인 한 가지다(outside_alley.js 머리말 참조).
     자르기 평면이 있는지, 그리고 그 평면이 **위는 버리고 창으로 보이는 것은
     남기는지**를 점 두 개로 확인한다. 평면을 누가 빼면 여기서 터진다. */
  const clip = await page.eval(`(async()=>{
    const m = await import('${BASE}/src/render3d/outside_alley.js');
    const o = m.buildOutsideAlley({ size:{w:5,d:4,h:2.3},
                                    luxWins:[{wall:'back', w:2.2, h:0.55, cy:1.77}] });
    const mesh = o.group.children[0];
    const pl = (mesh.material.clippingPlanes || [])[0];
    if (!pl) { o.dispose(); return { has:false }; }
    /* 뒷벽 바깥면 z=-2.1. 부호가 양수면 남는 쪽이다. */
    const at = (y, out) => pl.distanceToPoint(new THREE.Vector3(0, y, -2.1 - out));
    const r = {
      has: true, planes: mesh.material.clippingPlanes.length,
      /* ① 지붕선 위 — 버려져야 한다 */
      aboveRoof: at(2.30, 0.30) < 0,
      /* ② 상하각 54°(tan 1.398)에서 창 윗변으로 보이는 점 — 남아야 한다 */
      seenSteep: at(2.045 - 1.398 * 0.55, 0.55) > 0,
      /* ③ 상하각 16°(tan 0.287)에서 창 윗변으로 보이는 점(얕은 각·가까이) — 남아야 한다 */
      seenShallow: at(2.045 - 0.287 * 0.10, 0.10) > 0
    };
    o.dispose();
    return r;
  })()`);
  ok('clip_wedge', clip.has && clip.planes === 1 && clip.aboveRoof && clip.seenSteep && clip.seenShallow,
     JSON.stringify(clip));

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
    const m = await import('${BASE}/src/render3d/outside_alley.js');
    const size = { w:5, d:4, h:2.3 };
    const cases = {
      none:    m.buildOutsideAlley({ size, luxWins: [] }),
      missing: m.buildOutsideAlley({ size }),
      ceiling: m.buildOutsideAlley({ size, luxWins: [{wall:'ceiling', w:2, h:2, cy:2.3}] }),
      zero:    m.buildOutsideAlley({ size, luxWins: [{wall:'back', w:0, h:0, cy:1.7}] }),
      nobuilt: m.buildOutsideAlley(null)
    };
    return Object.fromEntries(Object.entries(cases).map(([k,v]) => [k, v === null]));
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
        const w = (window.view.three.skyWins || [])[0];
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

    /* ★ 상하각 양 끝 — "지붕 위로 안 삐져나온다"의 그림 증거.
       세로로 끌어 각을 바꾼다(EL_MIN 0.28 ~ EL_MAX 0.95 로 붙는다). */
    await page.eval(`window.view.setDaylight(0.50)`);
    const drag = (dy) => page.eval(`(()=>{ const c=document.getElementById('roomCanvas');
      c.dispatchEvent(new MouseEvent('mousedown',{clientX:195,clientY:420,bubbles:true}));
      for (let i=1;i<=8;i++) window.dispatchEvent(new MouseEvent('mousemove',
        {clientX:195,clientY:420+${dy}*i/8,bubbles:true}));
      window.dispatchEvent(new MouseEvent('mouseup',{clientX:195,clientY:420+${dy},bubbles:true})); })()`);
    for (const [dy, name] of [[-300, 'el_min'], [560, 'el_max']]) {
      await drag(dy); await sleep(900);
      const el = await page.eval(`window.view.camera().el`);
      await shot(name, `상하각 ${(el * 180 / Math.PI).toFixed(0)}° — 지붕 위로 아무것도 없어야 한다`);
    }
  }

  await page.close();
  console.log(`\n${bad ? 'FAIL' : 'PASS'}  test_outside  (${bad} 실패)`);
  process.exit(bad ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
