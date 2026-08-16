/* ============================================================
   tools/probe_wheel.mjs — 「휠이 턱턱 막힌다」를 숫자로 만든다
   ------------------------------------------------------------
     python tools/serve.py 8963
     node tools/probe_wheel.mjs --url=http://localhost:8963 --tag=before

   ★ **어디서 재나 — game.html 이다.** ══════════════════════════════════
     처음엔 tools/room_view_demo.html 에서 쟀는데 **그 자가 딴 세상 것이었다**(§2.9 ④).
     데모는 캔버스를 **388×842 폰 틀에 못박아** 둔다 — 창을 1920 으로 키워도 그대로다.
     방뷰의 줌 바깥한계는 `ctx.cam.aspect < 0.95` 로 갈리므로(§zoomOutK), 데모에서는
     늘 세로 값(ZOOM_OUT_PORTRAIT 1.15)이 나온다. 휠은 PC 물건인데 폰 한계를 재고 있었다.
     ⇒ 휠은 **게임 화면에서** 잰다. 데모는 --demo 로만 본다(견주기용).

   ★ **무엇을 재나 — 「그려진 그림」이다.** cam.dist 값이 아니다.
     휠 손잡이는 이벤트마다 cam.dist 를 곧바로 바꾼다. 그런데 눈에 닿는 것은
     **renderer.render 가 실제로 돈 순간의 값**이다. 방뷰는 「바쁜 중」을 30fps 로
     자르므로(§MIN_FRAME_MS) 둘이 갈릴 수 있다. 그래서 renderer.render 를 감싸서
     **한 장 그릴 때마다** 그때의 dist 를 적는다. 이게 화면이다.

   ★ **자의 눈금 셋**
     ① 고르냐 — 줌은 곱셈이라 ln 으로 잰다. 한 장과 다음 장 사이 `Δ = ln(d_i) − ln(d_{i-1})`
        턱배율 = max|Δ| / median|Δ|  ← **1.0 이면 고르다. 크면 그 배수만큼 한 장이 튄다**
        들쭉 = Δ 의 표준편차 · 멈칫% = Δ 가 0 인 장(그렸는데 안 움직였다)
     ② 늦냐 — 휠 이벤트가 온 뒤 **다음 한 장이 그려지기까지** 걸린 시간[ms]. 중앙·p95·최대
     ③ 막히냐 — 굴린 만큼 **실제로 얼마나 갔나**. 한계에 부딪히면 여기서 드러난다

   ⚠⚠⚠ **이 자의 한계 — 헤드리스는 초당 5~16장밖에 안 그린다** (2026-08-16 실측)
     ------------------------------------------------------------
     `requestAnimationFrame` 자체가 **5.2Hz** 로 돈다(SwiftShader · 화면이 없어서
     BeginFrame 이 드물다). 방뷰 상한은 `{idle:18, busy:30, move:60}` 인데 상한에
     한참 못 미친다. 박사님 PC 는 60장을 그린다 — **자와 실물이 4~12배 다르다.**

     ⇒ 그래서 이 표에서 **믿을 수 있는 것**과 **못 믿는 것**이 갈린다:
       믿을 수 있다 (프레임 수와 무관한 것)
         · `시킨`/`간`  — 굴린 것이 실제로 반영되나. 순수 논리다
         · `W 한계에 붙어서` — 고무줄이 튕기나. 순수 논리다
         · **「중앙Δ = 최대Δ = 정확히 한 칸」이라는 무늬** — 이게 나오면 그 코드는
           프레임이 몇이든 **한 칸을 한 장에 다 써 버리는** 코드다. 고치기 전이 그랬다
           (마우스 0.0834 = 8%, 줄단위 0.0392 = 한 칸. 턱배율이 딱 1.0 이었다)
       못 믿는다
         · 60장 그리는 기계에서 **얼마나 부드러워지는가**의 절대값
         · 트랙패드처럼 **초당 수십 번 오는 입력**의 프레임당 걸음 —
           그리는 쪽이 5장인데 넣는 쪽이 60번이면 밀리는 게 당연하다. 실물과 정반대다
     ⇒ 여기서 안 재어지는 것을 「쟀다」고 쓰지 마라.

   ★ deltaMode — CDP 의 Input.dispatchMouseEvent 는 deltaMode 를 못 실어 늘 0(픽셀)이다.
     줄 단위(1)는 WheelEvent 를 직접 만들어 쏜다. 그 둘이 같은 자인지 보려고
     **deltaMode 0 은 양쪽으로 다 잰다**(진짜 휠 · 합성). 두 줄이 다르면 합성 숫자는 못 믿는다.
============================================================ */
import { launch, sleep } from './test_cdp.mjs';

const arg = k => (process.argv.find(a => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=');
const BASE = arg('url') || process.env.BYEOT_URL || 'http://localhost:8963';
const TAG = arg('tag') || 'now';
const DEMO = process.argv.includes('--demo');
const W = +(arg('w') || 1440), H = +(arg('h') || 900);

const _wd = setTimeout(() => { console.error('⏱ 자가 제한을 넘겨 멈춥니다.'); process.exit(2); }, 900000);
_wd.unref && _wd.unref();

/* 페이지 안에 심는 것 — ① 그린 장마다 dist ② 휠이 들어온 시각 ③ 합성 휠 */
const INSTALL = `(() => {
  const v = window.__VIEW__, r = v.three.renderer;
  window.__frames = []; window.__ev = []; window.__ms = []; window.__rec = false;
  if (!r.__wheelProbe) {
    r.__wheelProbe = true;
    const orig = r.render.bind(r);
    r.render = (s, c) => {
      if (!window.__rec) return orig(s, c);
      const a = performance.now();
      window.__frames.push([a, v.camera().dist]);
      orig(s, c);
      window.__ms.push(performance.now() - a);
    };
  }
  const cv = document.getElementById('roomCanvas');
  if (!cv.__wheelProbe) {
    cv.__wheelProbe = true;
    /* ★ capture 로 단다 — 방뷰의 onWheel 보다 **먼저** 시각을 적어야 한다 */
    cv.addEventListener('wheel', () => { if (window.__rec) window.__ev.push(performance.now()); },
                        { capture: true, passive: true });
  }
  window.__wheel = (dy, mode, x, y) => cv.dispatchEvent(new WheelEvent('wheel', {
    deltaY: dy, deltaMode: mode, bubbles: true, cancelable: true, clientX: x, clientY: y }));
  window.__center = () => { const b = cv.getBoundingClientRect();
    return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2),
             w: Math.round(b.width), h: Math.round(b.height), aspect: +v.three.cam.aspect.toFixed(3) }; };
  window.__k = () => { const c = v.camera(); return +(c.dist / c.fit).toFixed(4); };
  /* ★★ **굴리는 일을 페이지 안에서 한다** — 이게 없으면 자가 CDP 를 잰다.
     node 에서 Input.dispatchMouseEvent 를 한 번 보내는 데 왕복 ~200ms 가 든다. 그래서
     「100ms 마다 한 칸」이라 적어 놓고 실제로는 **200ms 마다** 굴리고 있었고, 그 사이에
     화면이 다 따라잡아 버려 **나눠 그리기의 효과가 표에 안 나타났다**(그린 fps 가 13 에서
     안 올라간 것이 그 표시다 — 상한은 30 인데). 페이지 안에서 setTimeout 으로 돌리면
     간격이 정확하고 node 는 결과만 받는다. */
  window.__burst = (dy, mode, n, gap, x, y) => new Promise(res => {
    let i = 0;
    const tick = () => {
      window.__wheel(dy, mode, x, y);
      if (++i < n) setTimeout(tick, gap); else setTimeout(() => res(i), 700);
    };
    tick();
  });
  return true;
})()`;

const stdev = a => { if (a.length < 2) return 0;
  const m = a.reduce((s, v) => s + v, 0) / a.length;
  return Math.sqrt(a.reduce((s, v) => s + (v - m) * (v - m), 0) / (a.length - 1)); };
const q = (a, p) => { if (!a.length) return 0;
  const b = [...a].sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(b.length * p))]; };

function score(frames, evs, ms) {
  const d = [];
  for (let i = 1; i < frames.length; i++) d.push(Math.log(frames[i][1]) - Math.log(frames[i - 1][1]));
  const abs = d.map(Math.abs);
  const nz = abs.filter(v => v > 1e-9);
  /* 늦냐 — 휠이 온 뒤 처음 그려진 장까지 */
  const lat = [];
  for (const t of evs) { const f = frames.find(x => x[0] > t); if (f) lat.push(f[0] - t); }
  const dur = frames.length > 1 ? frames[frames.length - 1][0] - frames[0][0] : 0;
  return {
    ev: evs.length, frames: frames.length,
    fps: dur > 0 ? +(frames.length / (dur / 1000)).toFixed(1) : 0,
    jitter: +stdev(d).toFixed(4),
    maxJump: +Math.max(0, ...abs).toFixed(4),
    med: +q(nz, 0.5).toFixed(4),
    ratio: nz.length ? +(Math.max(...abs) / q(nz, 0.5)).toFixed(1) : 0,
    stallPct: abs.length ? Math.round(100 * abs.filter(v => v <= 1e-9).length / abs.length) : 0,
    latMed: +q(lat, 0.5).toFixed(1), latP95: +q(lat, 0.95).toFixed(1), latMax: +Math.max(0, ...lat).toFixed(1),
    /* ★ 한 장 그리는 데 든 시간. 이게 크면 **자가 SwiftShader 를 재고 있는 것**이다 */
    drawMs: +q(ms || [], 0.5).toFixed(1)
  };
}

async function fire(page, c, opt, n, dy) {
  /* 페이지 안에서 굴린다 — 간격이 정확하고 CDP 왕복이 안 낀다 */
  if (opt.inpage) return void await page.eval(
    `window.__burst(${dy}, ${opt.mode || 0}, ${n}, ${opt.gap}, ${c.x}, ${c.y})`);
  const t0 = Date.now();
  for (let i = 0; i < n; i++) {
    if (opt.synth) await page.eval(`window.__wheel(${dy}, ${opt.mode || 0}, ${c.x}, ${c.y})`);
    else await page.send('Input.dispatchMouseEvent',
      { type: 'mouseWheel', x: c.x, y: c.y, deltaX: 0, deltaY: dy, modifiers: 0 });
    const wait = opt.gap - (Date.now() - t0 - i * opt.gap);
    if (wait > 0) await sleep(wait);
  }
}

/* 한 판 — ① 바깥 한계까지 밀어 두고 ② 안쪽으로 쭉 굴리며 잰다 */
async function run(page, name, opt) {
  const c = await page.eval(`window.__center()`);
  /* 되돌리기: 진짜 CDP 휠로 크게 밀어 천장에 붙인다(합성이든 아니든 같은 자리에서 시작) */
  await page.eval(`window.__rec = false`);
  for (let i = 0; i < 20; i++)
    await page.send('Input.dispatchMouseEvent',
      { type: 'mouseWheel', x: c.x, y: c.y, deltaX: 0, deltaY: 240, modifiers: 0 });
  await sleep(900);
  const k0 = await page.eval(`window.__k()`);

  await page.eval(`window.__frames = []; window.__ev = []; window.__ms = []; window.__rec = true;`);
  await fire(page, c, opt, opt.n, -Math.abs(opt.dy));
  await sleep(600);                       // settleCam(160) + SNAP_MS(260) 이 끝날 때까지
  await page.eval(`window.__rec = false`);
  const frames = await page.eval(`window.__frames`);
  const evs = await page.eval(`window.__ev`);
  const k1 = await page.eval(`window.__k()`);

  const s = score(frames, evs, await page.eval(`window.__ms`));
  s.name = name; s.k0 = k0; s.k1 = k1;
  /* 굴린 만큼 vs 실제로 간 만큼 (ln) */
  s.asked = +(opt.n * Math.abs(opt.dy * (opt.mode === 1 ? 16 : 1)) * 0.0008).toFixed(3);
  s.got = +Math.abs(Math.log(k1 / k0)).toFixed(3);
  return s;
}

/* 한계에 붙은 채로 계속 굴린다 — 「튕기나 멎나」 */
async function wall(page, name, opt) {
  const c = await page.eval(`window.__center()`);
  await page.eval(`window.__rec = false`);
  for (let i = 0; i < 24; i++)
    await page.send('Input.dispatchMouseEvent',
      { type: 'mouseWheel', x: c.x, y: c.y, deltaX: 0, deltaY: -240, modifiers: 0 });
  await sleep(900);
  const k0 = await page.eval(`window.__k()`);
  await page.eval(`window.__frames = []; window.__ev = []; window.__ms = []; window.__rec = true;`);
  await fire(page, c, opt, opt.n, -Math.abs(opt.dy));
  await sleep(600);
  await page.eval(`window.__rec = false`);
  const s = score(await page.eval(`window.__frames`), await page.eval(`window.__ev`), await page.eval(`window.__ms`));
  s.name = name; s.k0 = k0; s.k1 = await page.eval(`window.__k()`);
  s.asked = +(opt.n * Math.abs(opt.dy) * 0.0008).toFixed(3); s.got = 0;
  return s;
}

async function bootGame(page) {
  await page.goto(`${BASE}/game.html`);
  await page.eval(`localStorage.clear()`, false);
  await page.goto(`${BASE}/game.html`);
  await page.waitFor('!!window.__rv', 180000, 300);
  await sleep(7000);
  const click = id => page.eval(`(()=>{const e=document.getElementById('${id}');
    if(!e||e.disabled||e.offsetParent===null) return false; e.click(); return true;})()`);
  await click('dlgSkip'); await sleep(900);
  for (let i = 0; i < 25; i++) {
    if (!(await page.eval(`document.getElementById('stage').classList.contains('talking')`))) break;
    await page.eval(`document.getElementById('dlgBox').click()`, false); await sleep(220);
  }
  await click('guideClose'); await sleep(900);
  await page.eval(`window.__VIEW__ = window.__rv; 0`);
}

(async () => {
  const page = await launch({ width: W, height: H, dpr: 1 });
  const errs = [];
  page.on((m, p) => { if (m === 'Runtime.exceptionThrown') errs.push(p.exceptionDetails.text); });

  if (DEMO) {
    await page.goto(`${BASE}/tools/room_view_demo.html?room=banjiha`);
    await page.waitFor(`window.view && window.view.camera`, 90000);
    await sleep(1500);
    await page.eval(`window.__VIEW__ = window.view; 0`);
  } else await bootGame(page);

  await page.eval(INSTALL);
  /* ★★ **픽셀비를 낮춘다 — 이게 없으면 자가 SwiftShader 를 잰다** (§2 재는 자를 먼저 의심하라)
     처음 잰 판은 한 장에 **500ms** 가 걸려 「그린 fps 1.8」이 나왔다. 그건 휠 이야기가 아니라
     소프트웨어 래스터라이저 이야기다. 박사님 PC 는 GPU 로 한 장을 몇 ms 에 그리므로,
     싸게 그리게 만든 쪽이 **실제 기계에 더 가깝다**. 아래 표의 `그리기ms` 로 확인한다. */
  await page.eval(`(()=>{ const r = window.__VIEW__.three.renderer;
    r.setPixelRatio(${+(arg('px') || 0.12)}); r.setPixelRatio = () => {}; window.__VIEW__.redraw(); return 1; })()`);
  await sleep(800);
  const c = await page.eval(`window.__center()`);
  const cam = await page.eval(`window.__VIEW__.camera()`);
  console.log(`\n${DEMO ? 'room_view_demo.html' : 'game.html'} · 창 ${W}×${H} dpr1 · 캔버스 ${c.w}×${c.h} · aspect ${c.aspect}` +
              `  → 바깥한계 ${c.aspect < 0.95 ? 'PORTRAIT 1.15' : 'WIDE 2.00'}`);
  console.log(`fit=${cam.fit.toFixed(2)} · 줌 범위 zoomK 0.58 ~ ${c.aspect < 0.95 ? 1.15 : 2.00}` +
              ` (= 8% 휠칸으로 ${Math.round(Math.log((c.aspect < 0.95 ? 1.15 : 2) / 0.58) / Math.log(1.08))}칸)`);
  console.log(`태그=${TAG}\n`);

  const IP = { synth: true, inpage: true };
  const cases = [
    /* 마우스 휠 한 칸 = deltaY 100(크롬). 트랙패드는 작은 값을 초당 수십 번 보낸다 */
    ['A 마우스 100ms',      { dy: 100, gap: 100, n: 22, mode: 0, ...IP }],
    ['B 마우스 50ms',       { dy: 100, gap: 50, n: 22, mode: 0, ...IP }],
    ['C 트랙패드 16ms',     { dy: 10, gap: 16, n: 170, mode: 0, ...IP }],
    ['D 줄단위 mode1',      { dy: 3, gap: 100, n: 40, mode: 1, ...IP }],
    ['E 줄단위 mode1 빠름', { dy: 3, gap: 50, n: 40, mode: 1, ...IP }],
    /* ★ 합성이 진짜 휠과 같은 자인지 — 이 줄이 A 와 크게 어긋나면 위 다섯 줄을 못 믿는다 */
    ['X 마우스(진짜 CDP)',  { dy: 100, gap: 100, n: 22 }]
  ];
  /* ★★ **한 판 버린다** — 첫 판은 늘 느리다. 실제로 첫 판만 한 장에 15.3ms 가 들고
     나머지는 1.3ms 였다(부팅 직후에 아직 얹히는 것들이 있다). 그 상태로 전·후를 견주면
     **코드가 아니라 그때 기계가 얼마나 바빴는지**를 견주게 된다. 표의 `그리기ms` 로
     확인해라 — 줄마다 그 값이 비슷해야 그 표를 믿을 수 있다. */
  await run(page, '(버리는 판)', { dy: 100, gap: 60, n: 20, mode: 0, ...IP });

  /* ★★ **여러 번 재서 가운데를 쓴다** — 한 판만 재면 그 순간 기계가 바빴는지를 재게 된다.
     같은 코드로 두 번 돌렸더니 그린 fps 가 16 과 8 로 갈렸고, 그러면 「한 장이 얼마나
     움직였나」가 통째로 두 배로 나온다. 판마다 값이 크게 흔들리면 `그리기ms` 를 봐라. */
  const REP = +(arg('rep') || 3);
  const mid = (list, key) => {
    const s = list.map(r => r[key]).sort((a, b) => a - b);
    return s[s.length >> 1];
  };
  const all = cases.map(([n, o]) => [n, o, run]);
  all.push(['W 한계에 붙어서', { dy: 100, gap: 100, n: 10, mode: 0, ...IP }, wall]);

  const rows = [];
  for (const [n, o, fn] of all) {
    const got = [];
    for (let i = 0; i < REP; i++) got.push(await fn(page, n, o));
    const r = { name: n, k0: got[0].k0, k1: got[0].k1, rep: REP };
    for (const k of ['ev', 'frames', 'fps', 'jitter', 'maxJump', 'med', 'ratio', 'stallPct',
                     'latMed', 'latP95', 'latMax', 'drawMs', 'asked', 'got'])
      r[k] = mid(got, k);
    rows.push(r);
  }

  const pad = (s, n) => String(s).padEnd(n), lp = (s, n) => String(s).padStart(n);
  console.log(pad('굴림', 22) + lp('휠', 5) + lp('장', 5) + lp('fps', 6) + lp('시킨', 7) + lp('간', 7) +
              lp('중앙Δ', 8) + lp('최대Δ', 8) + lp('턱배율', 8) + lp('들쭉', 8) + lp('멈칫%', 7) +
              lp('늦음중앙', 9) + lp('p95', 7) + lp('최대', 7) + lp('그리기ms', 9) + lp('zoomK', 13));
  console.log('-'.repeat(136));
  for (const r of rows)
    console.log(pad(r.name, 22) + lp(r.ev, 5) + lp(r.frames, 5) + lp(r.fps, 6) + lp(r.asked, 7) + lp(r.got, 7) +
                lp(r.med, 8) + lp(r.maxJump, 8) + lp(r.ratio, 8) + lp(r.jitter, 8) + lp(r.stallPct, 7) +
                lp(r.latMed, 9) + lp(r.latP95, 7) + lp(r.latMax, 7) + lp(r.drawMs, 9) + lp(`${r.k0}→${r.k1}`, 13));
  console.log('\n※ 시킨/간 = 굴린 양(ln) / 실제로 간 양(ln). 「간」이 「시킨」보다 훨씬 작으면 **한계에 막힌 것**이다.');
  console.log('※ 턱배율 = 최대Δ/중앙Δ. 1.0 이면 고르다. ※ 늦음 = 휠이 온 뒤 다음 한 장까지[ms].');
  if (errs.length) console.log('\n⚠ 콘솔 오류: ' + errs.slice(0, 5).join(' | '));
  console.log('\nJSON ' + JSON.stringify({ tag: TAG, demo: DEMO, canvas: c, rows }));
  await page.close();
})().catch(e => { console.error(e); process.exit(1); });
