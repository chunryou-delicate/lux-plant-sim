/* ============================================================
   tools/probe_lightview.mjs — 「방에서 빛 분포가 보이나」를 숫자로 만든다
   ------------------------------------------------------------
     python tools/serve.py 8963
     node tools/probe_lightview.mjs --url=http://localhost:8963

   ★ 어디서 재나 — **game.html 이다**(폰 390×844 · dpr 2).
     tools/room_view_demo.html 은 캔버스를 폰 틀에 못박아 두는 딴 세상이다(§2.9 ④).
     박사님이 보실 화면은 게임이므로 게임에서 잰다.

   ★ 무엇을 재나
     ① 켜면 **화면이 실제로 달라지는가** — 사진 두 장의 화소 차이[%]
        ⚠ 색 가짓수를 같이 센다(§2.9 ③ · 까만 사진 3색 · 멀쩡한 사진 3,000색 넘음).
          색이 적은 사진 위에서 「달라졌다」를 말하면 그건 죽은 프레임 두 장을 견준 것이다.
     ② **숫자가 읽히는가** — 폰 390px 에서 글자 높이[px] · 몇 개를 그렸나 · **겹친 쌍 0**
     ③ 껐다 켰다 **열 번** — 삼각형·드로우콜·DOM·메모리가 새는가
     ④ 히트맵 값이 **엔진 값과 같은가** — 화면이 들고 있는 값 vs `io.light.dliAt`
        ⚠ 다르면 화면이 거짓말하는 것이다. **칸 전부**를 견준다(2026-08-17).
     ⑤ 창턱(밝은 자리)과 구석(어두운 자리)이 **화면에서 실제로 다른 색인가**
        값이 아니라 **찍힌 사진의 화소**로 본다. 값만 보면 「칠하는 코드가 죽어 있어도」 통과한다.
     ⑥ 예외 0건
     ⑦ 배치 격자 눈금이 히트맵 위에 남는가   ⑧ 시점·줌을 따라오는가
     ⑨ 칸마다 「그 칸의 표면」에서 재는가     ⑩ 가구를 옮기면 따라오나
     ⑪ ★★ **창턱·3단 선반·책상** — 상판마다 **몇 칸이 나와야 맞는지**를 먼저 셈하고 견준다
        (2026-08-17 박사님이 화면 보고 짚으신 셋. §⑪ 머리말을 읽어라)

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

/* 페이지 안에 창구를 심는다 — **room_view 의 공개 API 를 그대로 쓴다**(game.html 이 부를 그 길).
   ⚠ 자기가 붙인 것을 자기가 재면 안 된다. 여기서 재는 것은 `roomView.setLightHeatmap` 이다. */
const INSTALL = `(() => {
  const rv = window.__rv, io = window.__io, S = window.__S();
  const sky = io.light.skyFor(S.day, S.sim);
  window.__lightCond = { weather: sky.weather, season: sky.season,
                         lampCount: S.lamps.count, litHours: S.lamps.litHours };
  /* 엔진에 직접 묻는 길 — 화면 값과 대조할 때 쓴다. **그 칸의 표면 높이**로 물어야 한다.
     (surfaceTopAt 이 occIdx 도 낸다 — 안 넘기면 가구가 제 상판에 제 그림자를 던진다) */
  window.__dliAt = (x, z) => {
    const s = rv.surfaceTopAt(x, z);
    return io.light.dliAt({ x, y: s.y, z }, { ...window.__lightCond, occIdx: s.occIdx }).dli;
  };
  /* ★★ 2026-08-17 — 위에서 쏘는 길로는 **아랫단을 영영 못 찾는다.** 3단 선반 아래 두 단·
     창턱은 광선이 집는 면이 아니다. 그래서 칸이 들고 있는 **제 y·제 occIdx** 로 묻는다.
     ⚠ 이게 더 엄한 대조다 — 화면이 y 를 틀리게 잡았으면 여기서 바로 갈린다. */
  window.__dliCell = c => io.light.dliAt({ x: c.x, y: c.y, z: c.z },
                                         { ...window.__lightCond, occIdx: c.occIdx }).dli;
  window.__heat = {
    set: on => rv.setLightHeatmap(on, window.__lightCond),
    refresh: () => rv.refreshLightHeatmap(),
    stats: () => rv.lightHeatmap(),
    cells: () => rv.lightHeatmapCells(),
    labels: () => rv.lightHeatmapLabels()
  };
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

/* ⚠⚠ **죽은 사진 문턱은 3,000색이다** (§2.9-③ · 첫 판에서 여기 걸렸다).
   200색으로 두었더니 **방이 통째로 새까만 프레임**(UI 만 그려진 것)이 1,939색으로
   통과해서, 그 위에서 「끄고 켠 차이 77%」라는 숫자를 낼 뻔했다. 그건 히트맵 이야기가
   아니라 「방이 아직 안 그려졌다」였다. 문헌 그대로 3,000색을 문턱으로 삼고 다시 찍는다. */
const ALIVE = 3000;
async function shot(name, tries = 5) {
  const f = `${IMG}/${name}_${TAG}.png`;
  let im = null, c = -1;
  for (let k = 0; k < tries; k++) {
    await page.shot(f);
    im = pngPixels(f); c = colorsOf(im);
    if (c >= ALIVE) break;
    await sleep(2000);
  }
  if (c < ALIVE) console.log(`  ⚠ ${f} 가 ${c}색뿐이다 — 방이 안 그려진 프레임일 수 있다`);
  return { file: f, im, colors: c };
}
/* 방이 실제로 보일 때까지 기다린다 — Day 0 은 **새벽 06:0x 에 시작**해서 방이 아직 캄캄하다.
   해가 뜨기를 기다리지 않고 재면 위 ⚠ 의 사고가 난다. */
async function waitRoomLit(maxMs = 180000) {
  const t0 = Date.now();
  let last = 0;
  while (Date.now() - t0 < maxMs) {
    await page.shot(`${IMG}/_wait_${TAG}.png`);
    last = colorsOf(pngPixels(`${IMG}/_wait_${TAG}.png`));
    if (last >= ALIVE + 2000) break;
    await sleep(3000);
  }
  try { fs.unlinkSync(`${IMG}/_wait_${TAG}.png`); } catch { }
  const clock = await page.eval(`(()=>{const e=document.querySelector('#hudTime,#timePill,.hud .time');
    return e ? e.textContent.trim() : '';})()`);
  console.log(`  ☀ 방이 보이기까지 ${Math.round((Date.now() - t0) / 1000)}초 · 색 ${last}가지${clock ? ' · ' + clock : ''}`);
  return last;
}

await waitRoomLit();

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
/* ⚠ 규칙(「3칸마다」)이 아니라 **화면에서 그린 것**을 잰다. 규칙만 보면 가구 위에
   따로 찍는 숫자가 격자 숫자와 겹친 것을 못 잡는다(첫 판에서 0.63 위에 0.58 이 겹쳤다).
   ★★ 2026-08-17 — **원 거리 대신 글자 네모끼리 겹친 쌍을 센다.** 3단 선반 숫자를 화면에서
     세로로 쌓게 되면서(단마다 한 줄 · 15px 간격) 원 거리는 늘 글자 폭보다 좁게 나온다.
     글자는 28×11 짜리 네모지 원이 아니다 — 줄로 쌓은 것은 겹친 것이 아니다. */
ok('숫자끼리 안 겹친다 (글자 네모가 겹친 쌍 0)',
   L.overlapPairs === 0, `겹친 쌍 ${L.overlapPairs} · 제일 붙은 둘 ${L.closestPx}px · 글자폭 ${L.textWidthPx}px`);
ok('머리글이 단위를 말한다', /DLI/.test(await page.eval(
   `document.querySelector('.byeot-lightgrid > div').textContent`)), '');

/* ── ⑤ 창턱과 구석이 화면에서 다른 색인가 ─────────────────────────
   ⚠ **가구에 가린 칸을 고르면 안 된다.** 바닥 그림이라 침대·책상 밑은 안 보인다
     (v1 이 그랬다 — 제일 어두운 칸이 침대 밑이라 회색 화소를 집고 「파랑이 아니다」라 했다).
     그래서 **켰을 때 화소가 실제로 바뀐 칸**(= 눈에 보이는 칸) 중에서 고른다. */
console.log('\n⑤ 밝은 자리와 어두운 자리가 화면에서 다른 색인가');
const allCells = await page.eval(`(() => {
  const cam = window.__rv.three.cam;
  const cv = document.getElementById('roomCanvas'), r = cv.getBoundingClientRect();
  const out = [];
  for (const c of window.__heat.cells()) {
    const p = new THREE.Vector3(c.x, c.y + 0.004, c.z).project(cam);
    if (p.z > 1) continue;
    out.push({ i: c.i, j: c.j, v: c.value, onUid: c.onUid,
               wx: +c.x.toFixed(3), wy: +c.y.toFixed(3), wz: +c.z.toFixed(3),
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
console.log(`  밝은 칸 (${spotHi.wx}, ${spotHi.wz}) y=${spotHi.wy}${spotHi.onUid ? ' [' + spotHi.onUid + ']' : ' [바닥]'}` +
            ` DLI ${spotHi.v.toFixed(2)} → 화소 rgb(${pHi})`);
console.log(`  어두운 칸 (${spotLo.wx}, ${spotLo.wz}) y=${spotLo.wy}${spotLo.onUid ? ' [' + spotLo.onUid + ']' : ' [바닥]'}` +
            ` DLI ${spotLo.v.toFixed(2)} → 화소 rgb(${pLo})`);
ok('값이 실제로 갈린다 (최대 ≥ 최소 + 0.1)', spotHi.v >= spotLo.v + 0.1,
   `${spotHi.v.toFixed(2)} vs ${spotLo.v.toFixed(2)}`);
ok('화면 색이 다르다 (rgb 합 차 ≥ 90)', cdist >= 90, `${cdist}`);
ok('밝은 쪽이 빨간 끝이다 (R > B)', pHi[0] > pHi[2], `R ${pHi[0]} > B ${pHi[2]}`);
ok('어두운 쪽이 파란 끝이다 (B > R)', pLo[2] > pLo[0], `B ${pLo[2]} > R ${pLo[0]}`);

/* ── ④ 화면 값 == 엔진 값인가 ─────────────────────────────────────
   ★ **가구 위 점으로도 대조한다** — 이번 변경의 핵심이 거기다. 바닥 점만 맞춰 보면
     높이 지도가 통째로 틀려도 통과한다. */
/* ★★ 2026-08-17 — **20점이 아니라 칸 전부**를 대조한다. 창턱 한 칸·3단 아랫단 여섯 칸·
   책상 가장자리 두 칸처럼 **딱 한 칸씩만 있는 자리**가 이번 고침의 핵심인데, 20점을
   골라 뽑으면 그 칸들이 표본에 안 들어올 수 있다. 칸이 삼백 몇 개뿐이라 다 재도 싸다. */
console.log('\n④ 화면이 들고 있는 값이 엔진 값과 같은가 — **칸 전부**');
const truth = await page.eval(`(() => {
  const all = window.__heat.cells();
  return all.map(p => {
    const engine = window.__dliCell(p);
    return { i: p.i, j: p.j, k: p.k, x: p.x, y: p.y, z: p.z, onUid: p.onUid, tier: p.tier,
             screen: p.value, engine, d: Math.abs(p.value - engine) };
  });
})()`);
const worst = truth.reduce((a, b) => (b.d > a.d ? b : a), truth[0]);
const onFurn = truth.filter(t => t.onUid);
const onTier = truth.filter(t => t.tier);
const pick = [...truth.filter(t => !t.onUid).slice(0, 2),
              ...onTier.filter(t => /sill/.test(t.tier)),
              ...onTier.filter(t => /etagere/.test(t.tier)).slice(0, 3),
              ...onTier.filter(t => /desk/.test(t.tier)).slice(0, 2)];
for (const t of pick)
  console.log(`  ${t.tier ? '[' + t.tier + ']' : '(' + t.i + ',' + t.j + ') ' + (t.onUid ? '[' + t.onUid + ']' : '[바닥]')}` +
              ` y=${t.y.toFixed(3)} 화면 ${t.screen.toFixed(4)} · 엔진 ${t.engine.toFixed(4)}`);
ok(`엔진과 한 톨도 안 다르다 (칸 ${truth.length}개 전부 · 그중 가구 위 ${onFurn.length})`,
   worst.d < 1e-9, `최대 차이 ${worst.d.toExponential(2)}`);
ok('상판 칸(창턱·선반 아랫단 포함)으로도 대조했다', onTier.length >= 5, `${onTier.length}칸`);
/* 글자가 값을 제대로 줄였나 — 반올림 오차를 넘어서면 안 된다 */
const lab = await page.eval(`window.__heat.labels()`);
const badText = lab.filter(t => Math.abs(parseFloat(t.text) - t.value) > 0.06);
ok('글자가 값을 옳게 줄였다 (오차 ≤ 0.06)', badText.length === 0,
   badText.length ? `${badText.length}개 어긋남` : `${lab.length}개 다 맞음`);

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
   (await page.eval(`(()=>{ let n=0; window.__rv.three.scene.traverse(o=>{ if(o.userData&&Number.isInteger(o.userData.heatCount)&&o.visible) n++; }); return n; })()`)) === 0, '');

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
const hst = await page.eval(`window.__heat.stats()`);
console.log(`  격자 ${gs.room.cols}×${gs.room.rows}칸 · 한 칸 ${gs.cell}m · 그리는 칸 ${gs.room.cells} · ` +
            `히트맵 바닥 칸 ${hst.floorCells} + 상판 칸 ${hst.surfaceCells} = ${hst.cells}`);
ok('히트맵 바닥 칸 = 배치 격자가 그리는 칸',
   hst.floorCells === gs.room.cells, `${hst.floorCells} = ${gs.room.cells}`);
await page.eval(`window.__rv.showGrid(false)`);

/* ── ⑨ ★ 높이 지도 — 칸마다 「그 칸의 표면」에서 재는가 ────────────
   박사님: *"가구가 있는 위치는 바닥이 아닌 가구 위 식물 두는 곳의 빛 결과가 보여야지."*
   ⚠ 「가구 위 칸이 몇 개다」만 세면 안 된다 — 높이만 올려 두고 **값을 바닥 것으로**
     내고 있어도 통과한다. 그래서 **바로 옆 바닥 칸과 값이 다른지**를 같이 잰다. */
console.log('\n⑨ 칸마다 그 칸의 표면에서 재는가');
const hm = await page.eval(`window.__heat.stats()`);
console.log(`  칸 ${hm.cells} 중 가구 위 **${hm.onFurniture}칸** · 제일 높은 표면 ${hm.yMax}m`);
ok('가구 위 칸이 있다', hm.onFurniture >= 8, `${hm.onFurniture}칸`);
ok('표면 높이가 바닥이 아니다', hm.yMax > 0.3, `${hm.yMax}m`);

const pairs = await page.eval(`(() => {
  /* ⚠ **바닥 격자 칸만** 짝을 짓는다 — 상판 칸은 (i,j) 가 없다(제 눈금에 산다). */
  const all = window.__heat.cells().filter(c => c.j !== null);
  const key = (i, j) => i + ',' + j;
  const m = new Map(all.map(c => [key(c.i, c.j), c]));
  const out = [];
  for (const c of all) {
    if (!c.onUid) continue;
    for (const [di, dj] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const n = m.get(key(c.i + di, c.j + dj));
      if (!n || n.onUid) continue;
      out.push({ uid: c.onUid, up: c.value, upY: c.y, down: n.value,
                 x: c.x, z: c.z, d: c.value - n.value });
      break;
    }
  }
  return out;
})()`);
const dsort = [...pairs].sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
const same = pairs.filter(p => Math.abs(p.d) < 1e-9).length;
console.log(`  가구 위 ↔ 바로 옆 바닥 짝 ${pairs.length}개 · 값이 똑같은 짝 ${same}개`);
for (const p of dsort.slice(0, 4))
  console.log(`    [${p.uid}] (${p.x.toFixed(2)}, ${p.z.toFixed(2)}) y=${p.upY.toFixed(2)}m ` +
              `위 ${p.up.toFixed(2)} vs 옆 바닥 ${p.down.toFixed(2)} (차 ${p.d >= 0 ? '+' : ''}${p.d.toFixed(2)})`);
ok('가구 위 값이 그 옆 바닥과 다르다 (짝의 80% 넘게)',
   pairs.length > 0 && same / pairs.length < 0.2, `같은 짝 ${same}/${pairs.length}`);

const byUid = await page.eval(`(() => {
  const m = new Map();
  for (const c of window.__heat.cells()) {
    if (!c.onUid) continue;
    const b = m.get(c.onUid);
    if (!b || c.value > b.value) m.set(c.onUid, c);
  }
  return [...m.values()].sort((a, b) => b.value - a.value);
})()`);
console.log('  가구마다 제일 밝은 칸 (밝은 차례):');
for (const c of byUid)
  console.log(`    ${String(c.onUid).padEnd(22)} y=${c.y.toFixed(2)}m (${c.x.toFixed(2)}, ${c.z.toFixed(2)}) DLI ${c.value.toFixed(2)}`);
ok('가구 위끼리도 밝기가 갈린다 (제일 밝은 가구 ≥ 제일 어두운 가구 + 0.1)',
   byUid.length >= 2 && byUid[0].value >= byUid[byUid.length - 1].value + 0.1,
   byUid.length >= 2 ? `${byUid[0].value.toFixed(2)} vs ${byUid[byUid.length - 1].value.toFixed(2)}` : '가구가 하나뿐');
const hshot = await shot('surface');
console.log(`  📷 표면 히트맵 ${hshot.file} 색 ${hshot.colors}가지`);

/* ── ⑪ ★★ 박사님이 짚으신 세 자리 (2026-08-17) ────────────────────
   *"창턱에 꺼는 왜 안 나오는 거야?"* · *"3단에는 3단에 다 나오도록"* ·
   *"책상은 2*5인데 빛은 2*4로 나와"*
   ⚠ 「칸이 몇 개다」만 세면 안 된다. **몇 칸이어야 맞는지**를 상판 크기와 눈금(0.25m)으로
     먼저 셈하고, 그 수와 견준다. 화면이 낸 수를 그대로 받아 적으면 그건 재는 게 아니다. */
console.log('\n⑪ 창턱 · 3단 · 책상 — 상판마다 몇 칸이 나와야 맞나');
const spots = await page.eval(`(() => {
  const rv = window.__rv;
  const cells = rv.lightHeatmapCells();
  const lab = rv.lightHeatmapLabels();
  const byTier = new Map();
  for (const c of cells) {
    if (!c.tier) continue;
    if (!byTier.has(c.tier)) byTier.set(c.tier, { tier: c.tier, uid: c.onUid, y: c.y,
                                                  n: 0, cw: c.cw, cd: c.cd, vmin: 9e9, vmax: -9e9 });
    const g = byTier.get(c.tier);
    g.n++; g.vmin = Math.min(g.vmin, c.value); g.vmax = Math.max(g.vmax, c.value);
  }
  const labT = new Set(lab.filter(l => l.tier).map(l => l.tier));
  const labN = new Map();
  for (const l of lab) if (l.tier) labN.set(l.tier, (labN.get(l.tier) || 0) + 1);
  const out = [...byTier.values()].sort((a, b) => b.vmax - a.vmax).map(g => ({
    ...g, vmin: +g.vmin.toFixed(2), vmax: +g.vmax.toFixed(2),
    /* 이 단의 상판이 얼마짜리인가 = 칸 수 × 칸 크기 (칸이 면을 딱 채운다 · §surfaceAxis) */
    rectW: +(g.cw * 0).toFixed(3),
    labels: labN.get(g.tier) || 0
  }));
  return { tiers: out, floorCells: cells.filter(c => c.j !== null).length,
           surfCells: cells.filter(c => c.j === null).length, labeledTiers: labT.size };
})()`);
/* 상판 크기는 방 데이터가 아니라 **화면이 잰 칸**에서 되뽑는다 — 다른 창이 창턱 받침의
   깊이를 바꾸는 중이라 숫자를 박아 두면 그날로 거짓이 된다(지시문 §쓰기 영역). */
console.log('  단(tier)마다 — 칸 수 · 칸 크기 · 값 · 숫자 개수');
for (const t of spots.tiers)
  console.log(`    ${t.tier.padEnd(26)} ${String(t.n).padStart(2)}칸 ` +
              `${t.cw}×${t.cd}m (상판 ${(t.n * t.cw * t.cd).toFixed(3)}㎡) ` +
              `DLI ${t.vmin}~${t.vmax} · 숫자 ${t.labels}개`);
const tierOf = re => spots.tiers.filter(t => re.test(t.tier));
const sill = tierOf(/sill/), eta = tierOf(/etagere/), desk = tierOf(/desk/);
ok('① 창턱에 칸이 생겼다', sill.length === 1 && sill[0].n >= 1,
   sill.length ? `${sill[0].n}칸 · DLI ${sill[0].vmax}` : '창턱 단이 없다');
ok('① 창턱에 숫자가 찍힌다', sill.length === 1 && sill[0].labels >= 1,
   sill.length ? `${sill[0].labels}개` : '—');
ok('② 3단 선반이 **세 단** 다 나온다', eta.length === 3, `${eta.length}단`);
ok('② 3단 선반 **세 단 다** 숫자가 찍힌다', eta.length === 3 && eta.every(t => t.labels >= 1),
   eta.map(t => `y${t.y}:${t.labels}개`).join(' · '));
ok('② 단마다 값이 다르다 (위가 더 밝다)',
   eta.length === 3 && eta[0].vmax > eta[2].vmax + 0.05,
   eta.map(t => `y${t.y}=${t.vmax}`).join(' · '));
/* 책상 — 상판 1.25×0.50 을 0.25 눈금으로 나누면 5×2 = 10칸이다. 그 수와 견준다. */
const deskN = desk.length ? desk[0].n : 0;
const deskCw = desk.length ? desk[0].cw : 0, deskCd = desk.length ? desk[0].cd : 0;
ok('③ 책상이 5×2 = 10칸이다', deskN === 10,
   `${deskN}칸 (${deskCw}×${deskCd}m → 상판 ${(deskN * deskCw * deskCd).toFixed(3)}㎡)`);
/* ⚠ 같은 병이 다른 가구에도 있나 — **전부 센다.**
   ★ 무엇으로 재나 — `surfaceAxis` 는 면을 `n = round(면길이/0.25)` 로 나눠 **남김없이**
     덮는다. 그러면 칸 한 변은 반드시 `면길이/n ∈ (0.125, 0.375]` 안에 든다(0.375 를 넘으면
     n 이 하나 더 컸을 것이고, 0.125 이하면 하나 더 작았을 것이다). 이 범위를 벗어난 칸이
     있으면 그 상판은 **덜 덮였거나 넘쳐 덮인** 것이다 — 책상에서 났던 그 병이다.
   ⚠ 「0.25 여야 한다」로 재면 안 된다 — 창턱(0.36)·협탁(0.21×0.36)처럼 면이 한 칸보다
     작거나 어중간한 상판은 칸이 0.25 가 아니고, 그래도 **맞다.** */
ok('상판 칸이 상판을 남김없이 덮는다 (칸 한 변이 0.125~0.375m 안이다)',
   spots.tiers.every(t => t.n >= 1 && t.cw > 0.125 - 1e-9 && t.cw <= 0.375 + 1e-9
                                   && t.cd > 0.125 - 1e-9 && t.cd <= 0.375 + 1e-9),
   spots.tiers.map(t => `${t.tier.split('@')[0].replace('banjiha-', '')} ${t.n}칸 ${t.cw}×${t.cd}`).join(' · '));
console.log(`  바닥 격자 칸 ${spots.floorCells} + 상판 칸 ${spots.surfCells} · ` +
            `숫자가 붙은 단 ${spots.labeledTiers}/${spots.tiers.length}`);

/* ── ⑩ ★ 가구를 옮기면 따라오나 ───────────────────────────────────
   박사님: *"가구 이동하면 이동한 거에 맞춰서 보여주고."*
   두 가지가 같이 바뀌어야 한다 — ⓐ 높이 지도(있던 칸이 바닥이 된다) ⓑ 그림자. */
console.log('\n⑩ 가구를 옮기면 값이 따라오나');
const mv = await page.eval(`(async () => {
  const rv = window.__rv;
  /* 칸을 제일 많이 내는 가구를 고른다 — 옮기면 표가 크게 움직인다 */
  const cnt = new Map();
  for (const c of rv.lightHeatmapCells())
    if (c.onUid && c.j !== null) cnt.set(c.onUid, (cnt.get(c.onUid) || 0) + 1);
  const uid = [...cnt.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const f = rv.furniture().find(x => x.uid === uid);
  if (!f) return { err: '옮길 수 있는 가구 목록에 없습니다: ' + uid };
  const before = rv.lightHeatmapCells().filter(c => c.onUid === uid && c.j !== null)
                   .map(c => ({ i: c.i, j: c.j, x: c.x, y: c.y, z: c.z, v: c.value }));
  /* 갈 수 있는 자리를 찾는다 — 방을 훑어 furnitureFit 이 ok 라 하고 지금 자리에서 먼 곳 */
  const b = rv.roomSize();
  let to = null, far = 0;
  for (let x = -b.w / 2 + 0.5; x <= b.w / 2 - 0.5; x += 0.25)
    for (let z = -b.d / 2 + 0.5; z <= b.d / 2 - 0.5; z += 0.25) {
      const fit = rv.furnitureFit(uid, { x: +x.toFixed(3), z: +z.toFixed(3), rot: f.rot });
      if (!fit.ok) continue;
      const d = Math.hypot(x - f.x, z - f.z);
      if (d > far) { far = d; to = { x: +x.toFixed(3), z: +z.toFixed(3), rot: f.rot }; }
    }
  if (!to) return { err: '갈 수 있는 자리를 못 찾았습니다' };
  const t0 = performance.now();
  await rv.commitFurnitureAt(uid, to);
  const ms = performance.now() - t0;
  const after = rv.lightHeatmapCells();
  const amap = new Map(after.filter(c => c.j !== null).map(c => [c.i + ',' + c.j, c]));
  const moved = before.map(p => { const a = amap.get(p.i + ',' + p.j) || {};
    return { i: p.i, j: p.j, x: p.x, y0: p.y, y1: a.y, v0: p.v, v1: a.value, on1: a.onUid || null }; });
  const nowOn = after.filter(c => c.onUid === uid).length;
  return { uid, from: { x: f.x, z: f.z }, to, dist: +far.toFixed(2), ms: +ms.toFixed(1),
           moved, nowOn, stats: rv.lightHeatmap() };
})()`);
if (mv.err) { ok('가구를 옮겨서 재기', false, mv.err); }
else {
  console.log(`  [${mv.uid}] (${mv.from.x}, ${mv.from.z}) → (${mv.to.x}, ${mv.to.z}) · ${mv.dist}m ` +
              `· 옮기고 다시 재기까지 ${mv.ms}ms (그중 격자 재기 ${mv.stats.ms}ms)`);
  const yFell = mv.moved.filter(m => m.y1 != null && m.y1 < m.y0 - 0.05).length;
  const vChanged = mv.moved.filter(m => m.v1 != null && Math.abs(m.v1 - m.v0) > 1e-9).length;
  for (const m of mv.moved.slice(0, 4))
    console.log(`    칸(${m.i},${m.j}) 높이 ${m.y0.toFixed(2)} → ${m.y1 == null ? '?' : m.y1.toFixed(2)}m · ` +
                `DLI ${m.v0.toFixed(2)} → ${m.v1 == null ? '?' : m.v1.toFixed(2)}`);
  ok('옮긴 자리의 표면이 바닥으로 내려앉았다', yFell >= mv.moved.length * 0.6,
     `${yFell}/${mv.moved.length}칸`);
  ok('옮긴 자리의 값이 바뀌었다', vChanged >= mv.moved.length * 0.6,
     `${vChanged}/${mv.moved.length}칸`);
  ok('새 자리에 가구 위 칸이 생겼다', mv.nowOn >= 1, `${mv.nowOn}칸`);
  ok('다시 재는 데 1초를 안 넘는다', mv.stats.ms < 1000, `${mv.stats.ms}ms`);
  const mshot = await shot('moved');
  console.log(`  📷 옮긴 뒤 ${mshot.file} 색 ${mshot.colors}가지`);
}

/* ── ⑧ 시점을 움직여도 숫자가 따라오나 · 몇 칸마다를 다시 고르나 ────
   숫자는 HTML 이라 3D 와 저절로 같이 움직이지 않는다. 그래서 **그린 뒤마다** 자리를 다시
   잡는다(renderer.render 를 한 겹 감싼다). 줌을 당기면 칸이 넓어지므로 「몇 칸마다」도
   다시 골라야 한다 — 안 고르면 당겼을 때 숫자가 듬성듬성한 채로 남는다. */
console.log('\n⑧ 시점을 움직여도 따라오나');
await page.eval(`window.__heat.set(true)`); await sleep(500);
const camA = await page.eval(`(()=>{ const s = window.__heat.stats().labels;
  const e = document.querySelector('.byeot-lightgrid > span');
  return { step: s.step, cellPx: s.cellPx, drawn: s.drawn, tiers: s.tiersLabeled,
           overlap: s.overlapPairs, tf: e ? e.style.transform : '' }; })()`);
await page.eval(`(()=>{ const cv = document.getElementById('roomCanvas'), b = cv.getBoundingClientRect();
  for (let i = 0; i < 14; i++) cv.dispatchEvent(new WheelEvent('wheel', { deltaY: -120, bubbles: true,
    cancelable: true, clientX: b.left + b.width / 2, clientY: b.top + b.height / 2 }));
  return 1; })()`);
await sleep(1600);
const camB = await page.eval(`(()=>{ const s = window.__heat.stats().labels;
  const e = document.querySelector('.byeot-lightgrid > span');
  return { step: s.step, cellPx: s.cellPx, drawn: s.drawn, tiers: s.tiersLabeled,
           overlap: s.overlapPairs, tf: e ? e.style.transform : '' }; })()`);
console.log(`  당기기 전 ${camA.cellPx}px/칸 · ${camA.step}칸마다 · ${camA.drawn}개 · 숫자 붙은 단 ${camA.tiers} · 겹친 쌍 ${camA.overlap}`);
console.log(`  당긴 뒤   ${camB.cellPx}px/칸 · ${camB.step}칸마다 · ${camB.drawn}개 · 숫자 붙은 단 ${camB.tiers} · 겹친 쌍 ${camB.overlap}`);
ok('당겨도 숫자가 안 겹친다', camB.overlap === 0, `겹친 쌍 ${camB.overlap}`);
ok('당기면 단이 더 많이 적힌다 (또는 그대로)', camB.tiers >= camA.tiers,
   `${camA.tiers} → ${camB.tiers}단`);
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
