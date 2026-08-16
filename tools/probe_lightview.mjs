/* ============================================================
   tools/probe_lightview.mjs — 「방에서 빛 분포가 보이나」를 숫자로 만든다
   ------------------------------------------------------------
     python tools/serve.py 8963
     node tools/probe_lightview.mjs --url=http://localhost:8963

   ★ 어디서 재나 — **game.html 이다**(폰 390×844 · dpr 2).
     tools/room_view_demo.html 은 캔버스를 폰 틀에 못박아 두는 딴 세상이다(§2.9 ④).
     박사님이 보실 화면은 게임이므로 게임에서 잰다.

   ★ 무엇을 재나 — 여섯 가지
     ① 켜면 **화면이 실제로 달라지는가** — 사진 두 장의 화소 차이[%]
        ⚠ 색 가짓수를 같이 센다(§2.9 ③ · 까만 사진 3색 · 멀쩡한 사진 3,000색 넘음).
          색이 적은 사진 위에서 「달라졌다」를 말하면 그건 죽은 프레임 두 장을 견준 것이다.
     ② **숫자가 읽히는가** — 폰 390px 에서 글자 높이[px] · 몇 개를 그렸나
     ③ 껐다 켰다 **열 번** — 삼각형·드로우콜·DOM·메모리가 새는가
     ④ 히트맵 값이 **엔진 값과 같은가** — 화면이 들고 있는 값 vs `io.light.dliAt`
        ⚠ 다르면 화면이 거짓말하는 것이다.
     ⑤ 창턱(밝은 자리)과 구석(어두운 자리)이 **화면에서 실제로 다른 색인가**
        값이 아니라 **찍힌 사진의 화소**로 본다. 값만 보면 「칠하는 코드가 죽어 있어도」 통과한다.
     ⑥ 예외 0건

   ★ 값은 어디서 오나 — `window.__io.light.dliAt`. 게임이 화분 자리를 판정할 때 부르는
     **바로 그 함수**다. 그래서 ④ 는 「같은 함수를 두 번 부르면 같은 값이 나오나」가 아니라
     「화면에 실린 숫자가 그 함수의 값 그대로인가」를 재는 것이 된다.
============================================================ */
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { launch, sleep } from './test_cdp.mjs';

const arg = k => (process.argv.find(a => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=');
const BASE = arg('url') || process.env.BYEOT_URL || 'http://localhost:8963';
const TAG = arg('tag') || 'now';
const W = +(arg('w') || 390), H = +(arg('h') || 844);
const IMG = 'docs/handoff/img/lightview';

const _wd = setTimeout(() => { console.error('⏱ 자가 제한을 넘겨 멈춥니다.'); process.exit(2); }, 900000);
_wd.unref && _wd.unref();

let fails = 0;
const ok = (name, pass, detail) => {
  if (!pass) fails++;
  console.log(`${pass ? '  ✔' : '  ✘'} ${name}${detail ? ' — ' + detail : ''}`);
};

/* ── PNG 를 직접 푼다 (node_modules 가 없는 저장소다) ───────────────── */
function pngPixels(file) {
  const b = fs.readFileSync(file);
  let off = 8, w = 0, h = 0, bitDepth = 0, colorType = 0;
  const idat = [];
  while (off < b.length) {
    const len = b.readUInt32BE(off);
    const type = b.toString('ascii', off + 4, off + 8);
    if (type === 'IHDR') {
      w = b.readUInt32BE(off + 8); h = b.readUInt32BE(off + 12);
      bitDepth = b[off + 16]; colorType = b[off + 17];
    } else if (type === 'IDAT') idat.push(b.subarray(off + 8, off + 8 + len));
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) throw new Error(`못 푸는 PNG: ${file}`);
  const bpp = colorType === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * bpp;
  const out = Buffer.alloc(w * h * 3);
  const cur = Buffer.alloc(stride), prev = Buffer.alloc(stride);
  let p = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[p++];
    raw.copy(cur, 0, p, p + stride); p += stride;
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0, bb = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      let v = cur[i];
      if (f === 1) v += a; else if (f === 2) v += bb; else if (f === 3) v += (a + bb) >> 1;
      else if (f === 4) {
        const pp = a + bb - c, pa = Math.abs(pp - a), pb = Math.abs(pp - bb), pc = Math.abs(pp - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? bb : c);
      }
      cur[i] = v & 255;
    }
    for (let x = 0; x < w; x++) {
      out[(y * w + x) * 3] = cur[x * bpp];
      out[(y * w + x) * 3 + 1] = cur[x * bpp + 1];
      out[(y * w + x) * 3 + 2] = cur[x * bpp + 2];
    }
    cur.copy(prev);
  }
  return { w, h, data: out };
}
const colorsOf = im => {
  const s = new Set();
  for (let y = 0; y < im.h; y += 2) for (let x = 0; x < im.w; x += 4) {
    const k = (y * im.w + x) * 3;
    s.add((im.data[k] << 16) | (im.data[k + 1] << 8) | im.data[k + 2]);
  }
  return s.size;
};
const pixAt = (im, x, y) => {
  const xi = Math.max(0, Math.min(im.w - 1, Math.round(x)));
  const yi = Math.max(0, Math.min(im.h - 1, Math.round(y)));
  const k = (yi * im.w + xi) * 3;
  return [im.data[k], im.data[k + 1], im.data[k + 2]];
};
/* 두 사진의 화소 차이[%] — 어느 채널이든 thr 넘게 다르면 「달라졌다」로 센다.
   ★ 문턱을 둘로 잰다 (§2 재는 자를 먼저 의심하라)
     8   아주 예민하다. 이 게임은 **가만히 둬도** 새벽 해가 밝아지며 방 전체가 한두 단계씩
         올라가므로, 8 로 재면 아무것도 안 해도 11% 가 나온다(v2 실측). 신호가 잡음에 묻힌다.
     40  히트맵이 칠하는 제트 색(파랑·빨강)은 바닥 회색에서 40 단계 넘게 떨어져 있고,
         햇빛이 서서히 밝아지는 것은 1.2초에 40 을 못 넘는다. ⇒ **이 문턱이 신호만 센다.** */
function diffPct(a, b, thr = 8) {
  if (a.w !== b.w || a.h !== b.h) throw new Error('사진 크기가 다릅니다');
  let n = 0, d = 0;
  for (let y = 0; y < a.h; y += 2) for (let x = 0; x < a.w; x += 2) {
    const k = (y * a.w + x) * 3;
    n++;
    if (Math.abs(a.data[k] - b.data[k]) > thr || Math.abs(a.data[k + 1] - b.data[k + 1]) > thr ||
        Math.abs(a.data[k + 2] - b.data[k + 2]) > thr) d++;
  }
  return +(100 * d / n).toFixed(2);
}

/* ── 게임을 띄우고 대사·안내를 걷는다 (probe_wheel 과 같은 순서) ──────── */
async function bootGame(page) {
  await page.goto(`${BASE}/game.html?fast=1`);
  await page.eval(`localStorage.clear()`, false);
  await page.goto(`${BASE}/game.html?fast=1`);
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
  /* 시트가 열려 있으면 방이 안 보인다 — 재는 것은 방이다 */
  await page.eval(`(()=>{ try{ window.__byeotSheet.close(); }catch(e){} return 1; })()`);
  await sleep(600);
}

/* 페이지 안에 창구를 심는다 — room_view 를 못 고치는 동안은 **공개 API 로만** 붙인다.
   (room_view.js 는 지금 다른 창이 들고 있다. 붙일 코드는 보고서에 적었다) */
const INSTALL = `(async () => {
  const mod = await import('/src/render3d/light_grid_labels.js');
  const rv = window.__rv, io = window.__io, S = window.__S();
  const sky = io.light.skyFor(S.day, S.sim);
  window.__lightCond = { weather: sky.weather, season: sky.season,
                         lampCount: S.lamps.count, litHours: S.lamps.litHours };
  window.__dliAt = (x, z) => io.light.dliAt({ x, y: 0, z }, window.__lightCond).dli;
  window.__heat = mod.attachLightHeatmap(rv, {
    valueAt: (x, z) => window.__dliAt(x, z),
    unit: 'DLI mol/m²·d · 바닥',
    extra: sky.weather + '·' + sky.season + '·등 ' + S.lamps.count + '개'
  });
  const r = rv.three.renderer;
  window.__info = () => ({ tris: r.info.render.triangles, calls: r.info.render.calls,
                           geo: r.info.memory.geometries, tex: r.info.memory.textures,
                           dom: document.querySelectorAll('*').length,
                           heap: (performance.memory ? performance.memory.usedJSHeapSize : 0) });
  return true;
})()`;

/* ── 시작 ────────────────────────────────────────────────────────── */
const page = await launch({ width: W, height: H, dpr: 2, mobile: false });
const errs = [];
page.on((m, p) => {
  if (m === 'Runtime.exceptionThrown')
    errs.push(p.exceptionDetails.text + ' ' + ((p.exceptionDetails.exception || {}).description || ''));
});

fs.mkdirSync(IMG, { recursive: true });
console.log(`\n볕 · 방에서 빛 분포 보기 — game.html · ${W}×${H} dpr2 · tag=${TAG}\n`);

await bootGame(page);
await page.eval(INSTALL);
await sleep(500);

async function shot(name) {
  const f = `${IMG}/${name}_${TAG}.png`;
  await page.shot(f);
  let im = pngPixels(f), c = colorsOf(im);
  if (c < 200) { await sleep(1500); await page.shot(f); im = pngPixels(f); c = colorsOf(im); }
  return { file: f, im, colors: c };
}

/* ── ① 켜면 화면이 달라지나 ───────────────────────────────────────
   ⚠⚠ **대조군을 먼저 찍는다** (§2 재는 자를 먼저 의심하라).
     이 게임은 가만히 둬도 화면이 바뀐다 — 시계가 흐르고(06:22 → 06:43) 자취녀가 걷는다.
     v1 에서 「끈 사진」과 「나중에 다시 끈 사진」을 견주고 **36% 다르다**고 적을 뻔했다.
     그건 히트맵 이야기가 아니라 **시간 이야기**였다. 그래서 아무것도 안 하고 같은 간격으로
     두 장을 먼저 찍어 「저절로 얼마나 바뀌나」를 알아 둔다. 그 위에서만 14% 가 뜻을 가진다. */
console.log('① 켜면 화면이 달라지나');
const ctrlA = await shot('ctrl_a');
await sleep(1200);
const ctrlB = await shot('ctrl_b');
const dCtrl8 = diffPct(ctrlA.im, ctrlB.im, 8), dCtrl = diffPct(ctrlA.im, ctrlB.im, 40);
console.log(`  🔬 대조군(아무것도 안 하고 1.2초) — 저절로 문턱8 ${dCtrl8}% · 문턱40 ${dCtrl}% 바뀐다`);

const before = await shot('off');
const t0 = Date.now();
await page.eval(`window.__heat.set(true)`);
const onMs = Date.now() - t0;
await sleep(700);
const after = await shot('on');
const d1_8 = diffPct(before.im, after.im, 8), d1 = diffPct(before.im, after.im, 40);
console.log(`  📷 끈 것 ${before.file} 색 ${before.colors}가지`);
console.log(`  📷 켠 것 ${after.file} 색 ${after.colors}가지`);
console.log(`  ⇒ 화소 차이 문턱8 ${d1_8}% · 문턱40 ${d1}%`);
ok('사진이 살아 있다 (색 가짓수 > 500)', before.colors > 500 && after.colors > 500,
   `끔 ${before.colors} · 켬 ${after.colors}`);
ok('켜면 화면이 달라진다 (대조군의 3배 넘게)', d1 > Math.max(4, dCtrl * 3),
   `${d1}% (대조군 ${dCtrl}%)`);
const st = await page.eval(`window.__heat.stats()`);
console.log(`  격자 ${st.key} · 칸 ${st.cells} · 재는 데 ${st.ms}ms(창구 왕복 포함 ${onMs}ms) · ` +
            `삼각형 ${st.tris} · 값 ${st.min}~${st.max}`);

/* ── ② 숫자가 읽히나 ────────────────────────────────────────────── */
console.log('\n② 숫자가 읽히나 (폰 390px)');
const L = st.labels;
console.log(`  칸 간격 ${L.cellPx}px · ${L.step}칸마다 · 라벨 ${L.labels}개(그린 것 ${L.drawn}) · ` +
            `보기 '${L.sample}'`);
ok('글자 높이 ≥ 10px', L.textPx >= 10, `${L.textPx}px (font ${L.fontPx}px)`);
ok('숫자를 실제로 그렸다 (≥ 8개)', L.drawn >= 8, `${L.drawn}개`);
ok('다 안 적는다 (칸 수보다 훨씬 적다)', L.labels < st.cells, `${L.labels} / ${st.cells}칸`);
ok('숫자끼리 안 겹친다 (칸 간격×건너뛴 칸 ≥ 글자폭)',
   L.cellPx * L.step >= L.textWidthPx, `${(L.cellPx * L.step).toFixed(1)}px ≥ ${L.textWidthPx}px`);
ok('머리글이 단위를 말한다', /DLI/.test(await page.eval(
   `document.querySelector('.byeot-lightgrid > div').textContent`)), '');

/* ── ⑤ 창턱과 구석이 화면에서 다른 색인가 ─────────────────────────
   ⚠ **가구에 가린 칸을 고르면 안 된다.** 바닥 그림이라 침대·책상 밑은 안 보인다
     (v1 이 그랬다 — 제일 어두운 칸이 침대 밑이라 회색 화소를 집고 「파랑이 아니다」라 했다).
     그래서 **켰을 때 화소가 실제로 바뀐 칸**(= 눈에 보이는 칸) 중에서 고른다. */
console.log('\n⑤ 밝은 자리와 어두운 자리가 화면에서 다른 색인가');
const allCells = await page.eval(`(() => {
  const g = window.__heat.grid(), cam = window.__rv.three.cam;
  const cv = document.getElementById('roomCanvas'), r = cv.getBoundingClientRect();
  const out = [];
  for (let i = 0; i < g.nx; i++) for (let j = 0; j < g.nz; j++) {
    if (!g.has(i, j)) continue;
    const c = g.centerOf(i, j);
    const p = new THREE.Vector3(c.x, 0.003, c.z).project(cam);
    if (p.z > 1) continue;
    out.push({ i, j, v: g.value(i, j), wx: +c.x.toFixed(3), wz: +c.z.toFixed(3),
               x: r.left + (p.x * .5 + .5) * r.width, y: r.top + (-p.y * .5 + .5) * r.height });
  }
  return { cells: out, dpr: window.devicePixelRatio };
})()`);
const D = allCells.dpr;
const seen = allCells.cells.filter(c => {
  const a = pixAt(before.im, c.x * D, c.y * D), b = pixAt(after.im, c.x * D, c.y * D);
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) > 24;   // 켜서 바뀐 = 보이는 칸
}).sort((a, b) => a.v - b.v);
console.log(`  눈에 보이는 칸 ${seen.length} / ${allCells.cells.length} (나머지는 가구·벽에 가렸다)`);
const spotLo = seen[0], spotHi = seen[seen.length - 1];
const pHi = pixAt(after.im, spotHi.x * D, spotHi.y * D);
const pLo = pixAt(after.im, spotLo.x * D, spotLo.y * D);
const cdist = Math.abs(pHi[0] - pLo[0]) + Math.abs(pHi[1] - pLo[1]) + Math.abs(pHi[2] - pLo[2]);
console.log(`  밝은 칸 (${spotHi.wx}, ${spotHi.wz}) DLI ${spotHi.v.toFixed(2)} → 화소 rgb(${pHi})`);
console.log(`  어두운 칸 (${spotLo.wx}, ${spotLo.wz}) DLI ${spotLo.v.toFixed(2)} → 화소 rgb(${pLo})`);
ok('값이 실제로 갈린다 (최대 ≥ 최소 + 0.1)', spotHi.v >= spotLo.v + 0.1,
   `${spotHi.v.toFixed(2)} vs ${spotLo.v.toFixed(2)}`);
ok('화면 색이 다르다 (rgb 합 차 ≥ 90)', cdist >= 90, `${cdist}`);
ok('밝은 쪽이 빨간 끝이다 (R > B)', pHi[0] > pHi[2], `R ${pHi[0]} > B ${pHi[2]}`);
ok('어두운 쪽이 파란 끝이다 (B > R)', pLo[2] > pLo[0], `B ${pLo[2]} > R ${pLo[0]}`);

/* ── ④ 화면 값 == 엔진 값인가 ───────────────────────────────────── */
console.log('\n④ 화면이 들고 있는 값이 엔진 값과 같은가');
const truth = await page.eval(`(() => {
  const rb = window.__heat.readback();
  const pick = [];
  const step = Math.max(1, Math.floor(rb.length / 12));
  for (let k = 0; k < rb.length; k += step) pick.push(rb[k]);
  return pick.map(p => {
    const engine = window.__dliAt(p.x, p.z);
    return { i: p.i, j: p.j, x: p.x, z: p.z, screen: p.value, text: p.text,
             engine, d: Math.abs(p.value - engine) };
  });
})()`);
const worst = truth.reduce((a, b) => (b.d > a.d ? b : a), truth[0]);
for (const t of truth.slice(0, 6))
  console.log(`  (${String(t.i).padStart(2)},${String(t.j).padStart(2)}) 화면 ${t.screen.toFixed(4)} ` +
              `· 엔진 ${t.engine.toFixed(4)} · 글자 '${t.text}'`);
ok(`엔진과 한 톨도 안 다르다 (${truth.length}점)`, worst.d < 1e-9,
   `최대 차이 ${worst.d.toExponential(2)}`);
/* 글자가 값을 제대로 줄였나 — 반올림 오차를 넘어서면 안 된다 */
const badText = truth.filter(t => Math.abs(parseFloat(t.text) - t.engine) > 0.06);
ok('글자가 값을 옳게 줄였다 (오차 ≤ 0.06)', badText.length === 0,
   badText.length ? `${badText.length}개 어긋남` : `${truth.length}개 다 맞음`);

/* ── ③ 껐다 켰다 열 번 ─────────────────────────────────────────── */
console.log('\n③ 껐다 켰다 열 번 — 새는 것이 있나');
/* 먼저 **켠 값이 얼마인지** 적어 둔다 — 켜면 무엇이 얼마나 느는가 */
await page.eval(`window.__heat.set(false)`); await page.eval(`window.__rv.redraw()`); await sleep(200);
const iOff = await page.eval(`window.__info()`);
await page.eval(`window.__heat.set(true)`); await page.eval(`window.__rv.redraw()`); await sleep(200);
const iOn = await page.eval(`window.__info()`);
console.log(`  켜는 값 — 삼각형 +${iOn.tris - iOff.tris} · 드로우콜 +${iOn.calls - iOff.calls} · ` +
            `지오메트리 +${iOn.geo - iOff.geo} · 텍스처 +${iOn.tex - iOff.tex} · ` +
            `DOM +${iOn.dom - iOff.dom}개(숫자 <span>)`);
await page.eval(`window.__rv.redraw()`); await sleep(200);
const i0 = await page.eval(`window.__info()`);
const ms = [];
for (let k = 0; k < 10; k++) {
  const a = Date.now();
  await page.eval(`window.__heat.set(false)`);
  await page.eval(`window.__heat.set(true)`);
  ms.push(Date.now() - a);
  await sleep(120);
}
await page.eval(`window.__rv.redraw()`); await sleep(300);
const i1 = await page.eval(`window.__info()`);
console.log(`  삼각형 ${i0.tris} → ${i1.tris} · 드로우콜 ${i0.calls} → ${i1.calls} · ` +
            `지오메트리 ${i0.geo} → ${i1.geo} · 텍스처 ${i0.tex} → ${i1.tex}`);
console.log(`  DOM ${i0.dom} → ${i1.dom}개 · 힙 ${(i0.heap / 1048576).toFixed(1)} → ` +
            `${(i1.heap / 1048576).toFixed(1)}MB · 한 번 켜는 데 ${Math.round(ms.reduce((a, b) => a + b, 0) / 10)}ms`);
ok('삼각형이 안 샌다', i1.tris === i0.tris, `${i0.tris} → ${i1.tris}`);
ok('드로우콜이 안 샌다', i1.calls === i0.calls, `${i0.calls} → ${i1.calls}`);
ok('지오메트리가 안 샌다', i1.geo === i0.geo, `${i0.geo} → ${i1.geo}`);
ok('DOM 이 안 샌다', i1.dom === i0.dom, `${i0.dom} → ${i1.dom}`);

/* 끈 뒤에는 정말 사라지나 — 사진으로 확인한다(값이 아니라 화면이다).
   ⚠ **바로 앞뒤 두 장을 견준다.** 처음 찍은 「끈 사진」과 견주면 그 사이에 흐른 20분치
     햇빛·걸음이 다 섞여 들어온다(v1 이 36% 라 적었는데 그중 히트맵 몫은 거의 없었다). */
const on3 = await shot('on3');
await page.eval(`window.__heat.set(false)`);
await sleep(700);
const off3 = await shot('off3');
const d2 = diffPct(on3.im, off3.im, 40);
console.log(`  📷 켠 것 ${on3.file} → 끈 것 ${off3.file} 색 ${off3.colors}가지`);
ok('끄면 히트맵이 화면에서 사라진다 (대조군의 3배 넘게 바뀐다)', d2 > Math.max(4, dCtrl * 3),
   `${d2}% (대조군 ${dCtrl}%)`);
/* 그리고 **다시 원래 방이다** — 남은 차이는 그 사이 흐른 게임 시간 몫이다 */
console.log(`  🔬 끈 화면 vs 켜기 전 화면 — 문턱8 ${diffPct(ctrlB.im, off3.im, 8)}% · ` +
            `문턱40 ${diffPct(ctrlB.im, off3.im, 40)}% (그 사이 게임 시간이 흘렀다)`);
ok('끈 상태에서는 숫자가 없다',
   (await page.eval(`window.__heat.stats().labels.visible`)) === false, '');
ok('끈 상태에서는 판이 안 보인다',
   (await page.eval(`(()=>{ let n=0; window.__rv.three.scene.traverse(o=>{ if(o.userData&&o.userData.heatSlot&&o.visible) n++; }); return n; })()`)) === 0, '');

/* ── ⑦ 「그리드 살리면서」 — 배치 격자가 히트맵에 안 묻히나 ───────────
   박사님 지시의 절반이 이것이다. 히트맵을 배치 격자 **아래**(y 0.0022 · renderOrder 1)에
   깔았으므로 눈금선(y 0.004 · renderOrder 3)이 그 위에 남아야 한다.
   ⚠ 눈금선은 opacity 0.22 라 아주 흐리다 — 문턱 40 으로는 안 잡힌다. 여기만 문턱 10 을
     쓰고, 같은 문턱의 대조군과 견준다. */
console.log('\n⑦ 히트맵 위에 배치 격자가 남는가');
await page.eval(`window.__heat.set(true); window.__rv.showGrid(false); window.__rv.redraw()`);
await sleep(600);
const gOff = await shot('heat_nogrid');
await sleep(1200);
const gOffB = await shot('heat_nogrid_b');            // 같은 상태 두 장 = 대조군
const gCtrl = diffPct(gOff.im, gOffB.im, 10);
await page.eval(`window.__rv.showGrid(true); window.__rv.redraw()`);
await sleep(600);
const gOn = await shot('heat_grid');
const dGrid = diffPct(gOffB.im, gOn.im, 10);
console.log(`  📷 히트맵만 ${gOff.file} → 히트맵+격자 ${gOn.file}`);
console.log(`  🔬 대조군(같은 상태 두 장) ${gCtrl}% · 격자를 켜면 ${dGrid}%`);
ok('히트맵 위에서도 격자 눈금이 보인다 (대조군의 2배 넘게 바뀐다)',
   dGrid > Math.max(1.5, gCtrl * 2), `${dGrid}% (대조군 ${gCtrl}%)`);
const gs = await page.eval(`window.__rv.grid()`);
console.log(`  격자 ${gs.room.cols}×${gs.room.rows}칸 · 한 칸 ${gs.cell}m · 그리는 칸 ${gs.room.cells} · ` +
            `히트맵 칸 ${st.cells} ⇒ ${gs.room.cols === (await page.eval('window.__heat.grid().nx')) ? '같은 격자다' : '⚠ 다른 격자다'}`);
ok('히트맵 칸 = 배치 격자 칸', gs.room.cols === (await page.eval(`window.__heat.grid().nx`)) &&
   gs.room.rows === (await page.eval(`window.__heat.grid().nz`)),
   `${gs.room.cols}×${gs.room.rows}`);
await page.eval(`window.__rv.showGrid(false); window.__heat.set(false)`);

/* ── ⑧ 시점을 움직여도 숫자가 따라오나 · 몇 칸마다를 다시 고르나 ────
   숫자는 HTML 이라 3D 와 저절로 같이 움직이지 않는다. 그래서 **그린 뒤마다** 자리를 다시
   잡는다(renderer.render 를 한 겹 감싼다). 줌을 당기면 칸이 넓어지므로 「몇 칸마다」도
   다시 골라야 한다 — 안 고르면 당겼을 때 숫자가 듬성듬성한 채로 남는다. */
console.log('\n⑧ 시점을 움직여도 따라오나');
await page.eval(`window.__heat.set(true)`); await sleep(500);
const camA = await page.eval(`(()=>{ const s = window.__heat.stats().labels;
  const e = document.querySelector('.byeot-lightgrid > span');
  return { step: s.step, cellPx: s.cellPx, drawn: s.drawn, tf: e ? e.style.transform : '' }; })()`);
await page.eval(`(()=>{ const cv = document.getElementById('roomCanvas'), b = cv.getBoundingClientRect();
  for (let i = 0; i < 14; i++) cv.dispatchEvent(new WheelEvent('wheel', { deltaY: -120, bubbles: true,
    cancelable: true, clientX: b.left + b.width / 2, clientY: b.top + b.height / 2 }));
  return 1; })()`);
await sleep(1600);
const camB = await page.eval(`(()=>{ const s = window.__heat.stats().labels;
  const e = document.querySelector('.byeot-lightgrid > span');
  return { step: s.step, cellPx: s.cellPx, drawn: s.drawn, tf: e ? e.style.transform : '' }; })()`);
console.log(`  당기기 전 ${camA.cellPx}px/칸 · ${camA.step}칸마다 · ${camA.drawn}개`);
console.log(`  당긴 뒤   ${camB.cellPx}px/칸 · ${camB.step}칸마다 · ${camB.drawn}개`);
ok('숫자가 시점을 따라 움직였다', camA.tf !== camB.tf, `${camA.tf} → ${camB.tf}`);
ok('당기면 칸이 넓어진다', camB.cellPx > camA.cellPx * 1.15, `${camA.cellPx} → ${camB.cellPx}px`);
ok('넓어지면 더 촘촘히 적는다', camB.step <= camA.step, `${camA.step} → ${camB.step}칸마다`);
const zshot = await shot('zoomed');
console.log(`  📷 당긴 화면 ${zshot.file} 색 ${zshot.colors}가지`);
await page.eval(`window.__heat.set(false)`);

/* ── ⑥ 예외 ─────────────────────────────────────────────────────── */
console.log('\n⑥ 예외');
ok('예외 0건', errs.length === 0, errs.length ? errs.slice(0, 3).join(' | ') : '0건');

await page.close();
clearTimeout(_wd);
console.log(`\n${fails ? `✘ ${fails}건 실패` : '✔ 다 통과'}\n`);
process.exit(fails ? 1 : 0);
