/* ============================================================
   tools/test_lampswitch.mjs — 등을 손으로 켜고 끈다 · 켠 시간을 센다
   ------------------------------------------------------------
     python tools/serve.py 8985
     BYEOT_URL=http://127.0.0.1:8985 node tools/test_lampswitch.mjs

   박사님 지시(2026-08-08) 셋을 그대로 검사로 옮긴 것이다.
     ① 등을 **터치해서** 켜고 끈다
     ② 전기세를 **켜 둔 시간**으로 매긴다 → 방뷰는 「몇 시간 켰나」를 정확히 낸다
     ③ 켰을 때 화면이 **살짝** 밝아진다

   ★ 여기서 보는 것
     A 스위치 창구 — 자동/손 구분 · 모르는 등이면 던진다
     B 그림이 실제로 바뀐다 — 광원 세기 · 등 아래 화면 밝기
     C **안 산 등은 안 켜진다** (setGrowLights 밖)
     D 켠 시간 장부 — 게임 시각으로 센다 · 자정을 넘는다 · 건너뛰기는 안 센다
     E 탭 — 등을 누르면 꺼지고 다시 누르면 켜진다 · 화분 탭을 안 가로챈다
     F ★★ **조도(DLI)는 한 자리도 안 움직인다** — 그림과 계산은 다른 길이다
     G 세이브 왕복 — 표를 통째로 얹고 되읽는다
============================================================ */
import { launch, sleep } from './test_cdp.mjs';

const BASE = process.env.BYEOT_URL || 'http://localhost:8985';

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log(`PASS  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}${extra ? '  — ' + extra : ''}`); }
};
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

/* 화면 픽셀을 읽는 자 — probe_room_light.mjs 와 같은 식(감마 후 휘도 0..255) */
const INSTALL = `(() => {
  const v = window.view;
  const cv = document.getElementById('roomCanvas');
  const c2 = document.createElement('canvas');
  const g2 = c2.getContext('2d', { willReadFrequently: true });
  const lum = (r, g, b) => 0.2126*r + 0.7152*g + 0.0722*b;
  const snap = () => { v.redraw(); c2.width = cv.width; c2.height = cv.height; g2.drawImage(cv, 0, 0); };
  window.__patch = (x, y, z, px) => {
    snap();
    const p = new THREE.Vector3(x, y, z).project(v.three.cam);
    if (p.z > 1) return null;
    const r = cv.getBoundingClientRect();
    const sx = Math.round((p.x*0.5+0.5)*c2.width), sy = Math.round((-p.y*0.5+0.5)*c2.height);
    const n = Math.max(2, Math.round((px || 11) * (c2.width / r.width)));
    const x0 = Math.max(0, sx-(n>>1)), y0 = Math.max(0, sy-(n>>1));
    const w = Math.min(n, c2.width-x0), h = Math.min(n, c2.height-y0);
    if (w <= 0 || h <= 0) return null;
    const d = g2.getImageData(x0, y0, w, h).data;
    let s = 0, k = 0;
    for (let i = 0; i < d.length; i += 4) { s += lum(d[i], d[i+1], d[i+2]); k++; }
    return k ? +(s/k).toFixed(2) : null;
  };
  /* 식물등 광원만 — rig 좌표와 맞춰 찾는다(방뷰가 광원 객체를 안 내주므로) */
  window.__growLights = () => {
    const gr = v.lightRigs().filter(r => r.grow);
    const all = []; v.three.scene.traverse(o => { if (o.isPointLight) all.push(o); });
    return gr.map(r => {
      const L = all.find(o => Math.hypot(o.position.x-r.pos.x, o.position.y-r.pos.y, o.position.z-r.pos.z) < 0.02);
      return { id: r.id, i: L ? +L.intensity.toFixed(4) : null,
               under: { x: r.pos.x, y: Math.max(0.01, r.pos.y - 0.55), z: r.pos.z } };
    });
  };
  /* 등이 화면 어디쯤 찍히나 — 탭할 자리를 찾는 씨앗 */
  window.__lampScreen = (uid) => {
    const r = v.lightRigs().find(x => x.uid === uid) || null;
    if (!r) return null;
    const p = new THREE.Vector3(r.pos.x, r.pos.y, r.pos.z).project(v.three.cam);
    if (p.z > 1) return null;
    const b = cv.getBoundingClientRect();
    return { x: +(b.left + (p.x*0.5+0.5)*b.width).toFixed(1),
             y: +(b.top + (-p.y*0.5+0.5)*b.height).toFixed(1) };
  };
  return true;
})()`;

async function tap(page, x, y) {
  await page.eval(`(()=>{ const c=document.getElementById('roomCanvas');
    c.dispatchEvent(new MouseEvent('mousedown',{clientX:${x},clientY:${y},bubbles:true}));
    window.dispatchEvent(new MouseEvent('mouseup',{clientX:${x},clientY:${y},bubbles:true})); })()`, false);
  await sleep(90);
}

/* 그 등을 실제로 누를 수 있는 화면 한 점을 찾는다.
   ★ 좌표를 박지 않는다 — 등은 방마다 다르고 카메라 각도에 따라 화면 자리가 바뀐다.
     투영한 자리 둘레를 훑어 **누르니까 실제로 토글되는 점**을 찾는 것이 유일하게 안 흔들리는 길이다. */
async function findLampTap(page, uid) {
  const seed = await page.eval(`window.__lampScreen(${JSON.stringify(uid)})`);
  if (!seed) return null;
  for (const dy of [0, 6, -6, 12, -12, 18, -18]) {
    for (const dx of [0, 5, -5, 10, -10, 15, -15]) {
      const x = Math.round(seed.x + dx), y = Math.round(seed.y + dy);
      const before = await page.eval(`window.view.lampOn(${JSON.stringify(uid)})`);
      await tap(page, x, y);
      const after = await page.eval(`window.view.lampOn(${JSON.stringify(uid)})`);
      if (before !== after) { await tap(page, x, y); return { x, y }; }   // 원래대로 되돌려 놓는다
    }
  }
  return null;
}

async function main() {
  const page = await launch({ width: 390, height: 844, dpr: 2, mobile: false });
  const errs = [];
  page.on((m, p) => { if (m === 'Runtime.exceptionThrown') errs.push(p.exceptionDetails.text); });
  await page.goto(`${BASE}/tools/room_view_demo.html?room=banjiha&engine=1`);
  await page.waitFor('!!window.view && !!window.engine', 180000, 200);
  await page.eval(INSTALL);
  await page.eval(`window.view.focusSlot(null, true); window.view.setDaylight(0.50); window.view.redraw(); 1`);
  await sleep(400);

  const rigs = await page.eval(`window.view.lightRigs()`);
  const grow = rigs.filter(r => r.grow);
  const BAR = grow[0] && grow[0].uid, CLIP = grow[1] && grow[1].uid;
  const CEIL = (rigs.find(r => !r.grow) || {}).uid;

  /* ── A. 스위치 창구 ─────────────────────────────────────── */
  const s0 = await page.eval(`window.view.lampSwitches()`);
  ok('A-1 방의 조명 전부가 목록에 나온다', s0.lamps.length === rigs.length,
     `${s0.lamps.length} vs ${rigs.length}`);
  ok('A-2 처음엔 전부 자동(manual=false)', s0.lamps.every(l => !l.manual));
  ok('A-3 식물등은 자동으로 켜져 있다(schedule)',
     s0.lamps.filter(l => l.grow).every(l => l.on));
  ok('A-4 생활등은 낮에 꺼져 있다', s0.lamps.filter(l => !l.grow).every(l => !l.on));
  ok('A-5 와트는 프리셋에서 온다(0이 아니다)', s0.lamps.every(l => l.watts > 0),
     JSON.stringify(s0.lamps.map(l => [l.preset, l.watts])));

  const a6 = await page.eval(`window.view.setLampOn(${JSON.stringify(BAR)}, false)`);
  ok('A-6 손으로 끄면 꺼진다', a6.on === false && a6.manual === true, JSON.stringify(a6));
  const a7 = await page.eval(`window.view.setLampOn(${JSON.stringify(BAR)}, null)`);
  ok('A-7 null 이면 자동으로 되돌아온다', a7.on === true && a7.manual === false, JSON.stringify(a7));
  const a8 = await page.eval(`(()=>{ try { window.view.setLampOn('없는등', true); return 'no-throw'; }
                                     catch (e) { return e.message; } })()`);
  ok('A-8 모르는 등이면 던진다', /모르는 등/.test(a8), a8);
  const a9 = await page.eval(`window.view.setLampOn(${JSON.stringify(CEIL)}, true).on`);
  ok('A-9 생활등도 낮에 손으로 켤 수 있다', a9 === true);
  await page.eval(`window.view.setLampOn(${JSON.stringify(CEIL)}, null); 1`);

  /* ── B. 그림이 실제로 바뀐다 ────────────────────────────── */
  await page.eval(`window.view.setDaylight(0.90); 1`);      // 밤이 대비가 크다
  await sleep(200);
  const onL = await page.eval(`window.__growLights()`);
  const underOn = await page.eval(`window.__patch(${onL[0].under.x}, ${onL[0].under.y}, ${onL[0].under.z}, 11)`);
  await page.eval(`window.view.setLampOn(${JSON.stringify(BAR)}, false);
                   window.view.setLampOn(${JSON.stringify(CLIP)}, false); 1`);
  await sleep(200);
  const offL = await page.eval(`window.__growLights()`);
  const underOff = await page.eval(`window.__patch(${onL[0].under.x}, ${onL[0].under.y}, ${onL[0].under.z}, 11)`);

  ok('B-1 켜면 광원 세기가 0.34', onL.every(l => near(l.i, 0.34, 1e-4)),
     JSON.stringify(onL.map(l => l.i)));
  ok('B-2 끄면 광원 세기가 0', offL.every(l => near(l.i, 0)), JSON.stringify(offL.map(l => l.i)));
  ok('B-3 등 아래 화면이 실제로 밝아진다(밤)', underOn > underOff * 1.10,
     `켬 ${underOn} vs 끔 ${underOff}`);
  console.log(`      · 등 아래 밝기 끔 ${underOff} → 켬 ${underOn} ` +
              `(${(100 * (underOn - underOff) / underOff).toFixed(1)}%)`);

  await page.eval(`window.view.setLampOn(${JSON.stringify(BAR)}, null);
                   window.view.setLampOn(${JSON.stringify(CLIP)}, null);
                   window.view.setDaylight(0.50); 1`);

  /* ── C. 안 산 등은 안 켜진다 ───────────────────────────── */
  await page.eval(`window.view.setGrowLights(0); 1`); await sleep(150);
  const c1 = await page.eval(`window.__growLights()`);
  const c1s = await page.eval(`window.view.lampSwitches()`);
  ok('C-1 setGrowLights(0) 이면 식물등 광원이 꺼진다', c1.every(l => near(l.i, 0)),
     JSON.stringify(c1.map(l => l.i)));
  ok('C-2 안 산 등은 shown=false · on=false',
     c1s.lamps.filter(l => l.grow).every(l => !l.shown && !l.on));
  await page.eval(`window.view.setLampOn(${JSON.stringify(BAR)}, true); 1`); await sleep(120);
  const c3 = await page.eval(`window.__growLights()`);
  ok('C-3 안 산 등은 손으로 켜도 안 켜진다', near(c3[0].i, 0), JSON.stringify(c3.map(l => l.i)));
  await page.eval(`window.view.setLampOn(${JSON.stringify(BAR)}, null);
                   window.view.setGrowLights(${grow.length}); 1`); await sleep(150);
  const c4 = await page.eval(`window.__growLights()`);
  ok('C-4 다시 사면 켜진다', c4.every(l => near(l.i, 0.34, 1e-4)), JSON.stringify(c4.map(l => l.i)));

  /* ── D. 켠 시간 장부 ───────────────────────────────────── */
  /* ★ 시각을 먼저 세우고 **그 다음에** 장부를 닫는다. 순서를 바꾸면 직전 구간이
     새 장부에 얹힌다(실제로 그렇게 잘못 짰다가 잡혔다).
     ★ 낮(0.40~0.50)에서 잰다 — 밤이면 생활등이 자동으로 켜져 D-2 가 성립하지 않는다. */
  await page.eval(`window.view.setDaylight(0.40); window.view.resetLampHours(); 1`);
  /* 0.40 → 0.50 = 게임 시간 2.4h. 한 번에 6시간을 안 넘게 잘게 흘린다 */
  for (const t of [0.42, 0.44, 0.46, 0.48, 0.50])
    await page.eval(`window.view.setDaylight(${t}); 1`, false);
  const d1 = await page.eval(`window.view.lampSwitches()`);
  const barH = d1.lamps.find(l => l.uid === BAR).hours;
  ok('D-1 켠 등에 게임 시간이 쌓인다(0.40→0.50 = 2.4h)', near(barH, 2.4, 0.01), `${barH}h`);
  ok('D-2 꺼져 있던 생활등에는 안 쌓인다',
     d1.lamps.filter(l => !l.grow).every(l => l.hours === 0),
     JSON.stringify(d1.lamps.filter(l => !l.grow).map(l => l.hours)));
  const wattsBar = d1.lamps.find(l => l.uid === BAR).watts;
  ok('D-3 와트시 = 와트 × 시간',
     near(d1.lamps.find(l => l.uid === BAR).wh, +(wattsBar * barH).toFixed(3), 0.002));

  /* 끈 등은 안 쌓인다 */
  await page.eval(`window.view.setLampOn(${JSON.stringify(CLIP)}, false); window.view.resetLampHours(); 1`);
  for (const t of [0.52, 0.54, 0.56])
    await page.eval(`window.view.setDaylight(${t}); 1`, false);
  const d4 = await page.eval(`window.view.lampSwitches()`);
  ok('D-4 끈 등에는 시간이 안 쌓인다', d4.lamps.find(l => l.uid === CLIP).hours === 0);
  ok('D-5 켠 등에는 그동안도 쌓인다', d4.lamps.find(l => l.uid === BAR).hours > 1.4);

  /* 자정 넘기 */
  await page.eval(`window.view.setLampOn(${JSON.stringify(CLIP)}, null);
                   window.view.setDaylight(0.97); window.view.resetLampHours(); 1`);
  for (const t of [0.99, 0.01, 0.03])
    await page.eval(`window.view.setDaylight(${t}); 1`, false);
  const d6 = await page.eval(`window.view.lampSwitches()`);
  ok('D-6 자정을 넘어도 이어서 센다(0.97→0.03 = 1.44h)',
     near(d6.lamps.find(l => l.uid === BAR).hours, 1.44, 0.01),
     `${d6.lamps.find(l => l.uid === BAR).hours}h`);

  /* 건너뛰기 */
  await page.eval(`window.view.setDaylight(0.10); window.view.resetLampHours(); 1`);
  await page.eval(`window.view.setDaylight(0.80); 1`, false);   // 한 번에 16.8h — 시계가 아니라 이동
  const d7 = await page.eval(`window.view.lampSwitches()`);
  ok('D-7 6시간 넘게 뛰면 안 센다(시각을 옮긴 것)',
     d7.lamps.every(l => l.hours === 0), JSON.stringify(d7.lamps.map(l => l.hours)));

  /* 하루 닫기 */
  await page.eval(`window.view.setDaylight(0.82); window.view.setDaylight(0.84); 1`, false);
  const closing = await page.eval(`window.view.resetLampHours()`);
  const after = await page.eval(`window.view.lampSwitches()`);
  ok('D-8 하루를 닫으면 장부를 주고 0 으로 돌아간다',
     closing.wh > 0 && after.wh === 0, `닫힘 ${closing.wh}Wh · 이후 ${after.wh}Wh`);
  ok('D-9 하루를 닫아도 스위치는 남는다',
     JSON.stringify(closing.switches) === JSON.stringify(after.switches));

  /* ── E. 탭 ─────────────────────────────────────────────── */
  await page.eval(`window.__lampTaps = [];
    window.view && 1;`, false);
  /* 데모는 onLampTap 을 안 걸어 뒀을 수 있다 — 그건 그것대로 맞다(방뷰만으로 돌아야 한다) */
  const spot = await findLampTap(page, CLIP) || await findLampTap(page, BAR);
  ok('E-1 등을 눌러 켜고 끌 수 있다', !!spot, spot ? '' : '등을 짚을 수 있는 점을 못 찾았습니다');
  if (spot) {
    const uid = await page.eval(`window.view.lampOn(${JSON.stringify(CLIP)})`) != null ? CLIP : BAR;
    const b1 = await page.eval(`window.view.lampOn(${JSON.stringify(uid)})`);
    await tap(page, spot.x, spot.y);
    const b2 = await page.eval(`window.view.lampOn(${JSON.stringify(uid)})`);
    await tap(page, spot.x, spot.y);
    const b3 = await page.eval(`window.view.lampOn(${JSON.stringify(uid)})`);
    ok('E-2 한 번 누르면 바뀌고 다시 누르면 돌아온다', b1 !== b2 && b1 === b3, `${b1}→${b2}→${b3}`);
    ok('E-3 누르면 「손으로 만진 등」이 된다',
       (await page.eval(`window.view.lampSwitches()`)).lamps.find(l => l.uid === uid).manual === true);
  }

  /* 화분 탭을 안 가로챈다 — 선반에 화분을 하나 세우고 그 자리를 눌러 본다 */
  const slotId = await page.eval(
    `(window.view.slots().find(s => /etagere/.test(s.slotId)) || {}).slotId || null`);
  if (slotId) {
    /* ⚠ setPlant 의 결과를 그대로 돌려받으면 안 된다 — THREE 객체라 CDP 가
       "Object reference chain is too long" 으로 죽는다. 끝났다는 신호만 받는다. */
    await page.eval(`window.view.setPlant(${JSON.stringify(slotId)},
      { kind:'monstera', growthDays:120, seed:7 }).then(()=>1)`);
    await sleep(600);
    const p = await page.eval(`(()=>{ const b=document.getElementById('roomCanvas').getBoundingClientRect();
      const s = window.view.screenPosOf(${JSON.stringify(slotId)});
      return s ? { x:+(b.left+s.x).toFixed(0), y:+(b.top+s.y).toFixed(0) } : null; })()`);
    if (p) {
      await page.eval(`window.__lastTap = null; 1`, false);
      await tap(page, p.x, p.y);
      const last = await page.eval(`window.__lastTap`);
      ok('E-4 화분 자리를 누르면 화분이 잡힌다(등이 안 가로챈다)',
         !!last && last.id === slotId, JSON.stringify(last));
    } else ok('E-4 화분 자리를 누르면 화분이 잡힌다', false, '화분이 화면 밖입니다');
  }

  /* ── F. ★ 조도는 한 자리도 안 움직인다 ──────────────────── */
  const DLI = n => `(()=>{ const e = window.engine;
    if (!e.room || e.room.id !== 'banjiha') e.build('banjiha');
    e.clearCache();
    return e.room.slots.map(s => +e.dliOfSlot(s.slotId,
      { weather:'clear', season:'summer', lampCount:${n}, litHours:12 }).toFixed(6)); })()`;
  const f0 = await page.eval(DLI(0));
  const f1 = await page.eval(DLI(grow.length));
  /* 등을 전부 손으로 껐다 켰다 해도 계약의 값은 그대로여야 한다 */
  await page.eval(`window.view.setLampOn(${JSON.stringify(BAR)}, false);
                   window.view.setLampOn(${JSON.stringify(CLIP)}, false); 1`);
  await sleep(150);
  const f0b = await page.eval(DLI(0));
  const f1b = await page.eval(DLI(grow.length));
  ok('F-1 추천 자리가 14칸이다', f0.length === 14, String(f0.length));
  ok('F-2 등을 꺼도 등0 DLI 가 그대로', JSON.stringify(f0) === JSON.stringify(f0b));
  ok('F-3 등을 꺼도 등2 DLI 가 그대로', JSON.stringify(f1) === JSON.stringify(f1b));
  ok('F-4 등을 켜면 DLI 는 원래 계통대로 오른다', f1.some((v, i) => v > f0[i] + 0.01));
  console.log('      · 추천 자리 DLI(등0→등2): ' +
    f0.map((v, i) => `${v.toFixed(2)}→${f1[i].toFixed(2)}`).join(' '));
  await page.eval(`window.view.setLampOn(${JSON.stringify(BAR)}, null);
                   window.view.setLampOn(${JSON.stringify(CLIP)}, null); 1`);

  /* ── G. 세이브 왕복 ────────────────────────────────────── */
  const g1 = await page.eval(`window.view.setLampSwitches({ ${JSON.stringify(BAR)}: false })`);
  ok('G-1 표를 얹으면 그대로 선다', g1.switches[BAR] === false && Object.keys(g1.switches).length === 1,
     JSON.stringify(g1.switches));
  const g2 = await page.eval(`(()=>{ try { window.view.setLampSwitches({ ${JSON.stringify(BAR)}: true, '없는등': true });
                                          return 'no-throw'; } catch (e) { return e.message; } })()`);
  ok('G-2 모르는 등이 섞이면 던진다', /모르는 등/.test(g2), g2);
  const g3 = await page.eval(`window.view.lampSwitches()`);
  ok('G-3 던졌으면 아무것도 안 바뀐다', g3.switches[BAR] === false && Object.keys(g3.switches).length === 1,
     JSON.stringify(g3.switches));
  const g4 = await page.eval(`window.view.setLampSwitches({})`);
  ok('G-4 빈 표면 전부 자동으로 돌아간다', Object.keys(g4.switches).length === 0 &&
     g4.lamps.filter(l => l.grow).every(l => l.on));

  ok('예외 없음', errs.length === 0, errs.join(' | '));

  console.log(`\n${pass + fail}건 · 통과 ${pass} · 실패 ${fail}`);
  await page.close();
  process.exit(fail ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
