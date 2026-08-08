/* ============================================================
   tools/probe_lampswitch.mjs — 등을 켜면 **화면이 얼마나 밝아지나**를 잰다
   ------------------------------------------------------------
   박사님 지시: "등 켰을 때 밝기를 살짝만 올려줘." 「살짝」은 눈으로 고를 값이 아니다.
   켜기 전/후로 **화면 픽셀 평균 밝기**를 재서 몇 % 인지 숫자로 낸다.

     python tools/serve.py 8985
     BYEOT_URL=http://127.0.0.1:8985 node tools/probe_lampswitch.mjs
     … --room oneroom --t 0.50,0.90

   ★ 같이 재는 것 — **조도(DLI)가 안 움직였나**
     그림과 계산은 다른 길이다(test_ground §I 와 같은 규약). 화면을 밝히는 변경이
     추천 자리의 DLI 를 한 자리라도 움직이면 그건 그림이 계산으로 샌 것이다.
     그래서 같은 페이지에서 조도 엔진(?engine=1)으로 추천 자리 전부의 DLI 를 같이 뽑는다.

   ★ 밝기는 감마 보정된 화면 픽셀의 휘도(0.2126R+0.7152G+0.0722B, 0..255)다.
     probe_room_light.mjs 와 **같은 자**를 쓴다 — 두 문서의 숫자를 나란히 놓을 수 있게.
============================================================ */
import { launch, sleep } from './test_cdp.mjs';

const _WATCHDOG_MS = +(process.env.BYEOT_PROBE_TIMEOUT_MS || 300000);
const _wd = setTimeout(() => {
  console.error('⏱ 자가 제한을 넘겨 멈춥니다 — 재는 중에 멈춘 것입니다.');
  process.exit(2);
}, _WATCHDOG_MS);
_wd.unref && _wd.unref();
process.on('exit', () => clearTimeout(_wd));

const BASE = process.env.BYEOT_URL || 'http://localhost:8985';
const argv = process.argv.slice(2);
const argOf = (k, d) => { const i = argv.indexOf(k); return i < 0 ? d : argv[i + 1]; };
const ROOM = argOf('--room', 'banjiha');
const TIMES = String(argOf('--t', '0.50,0.90')).split(',').map(Number);

/* 화면 픽셀을 읽는 자 — probe_room_light.mjs 의 그것과 같은 식이다.
   ⚠ redraw() 와 같은 틱에 옮겨야 한다. 드로잉 버퍼는 다음 합성에서 비워진다. */
const INSTALL = `(() => {
  const v = window.view;
  const cv = document.getElementById('roomCanvas');
  const c2 = document.createElement('canvas');
  const g2 = c2.getContext('2d', { willReadFrequently: true });
  const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

  window.__shot = () => {
    v.redraw();
    c2.width = cv.width; c2.height = cv.height;
    g2.drawImage(cv, 0, 0);
    return { w: c2.width, h: c2.height };
  };
  /* 화면 전체 평균 — 8픽셀 걸러 훑는다(전수와 0.1 이내로 같고 훨씬 빠르다).
     ★ 하얘짐은 평균만으로는 안 잡힌다. **탄 픽셀 비율**(240 이상)도 같이 센다. */
  window.__screen = () => {
    window.__shot();
    const d = g2.getImageData(0, 0, c2.width, c2.height).data;
    let s = 0, k = 0, hot = 0, mx = 0;
    for (let i = 0; i < d.length; i += 32) {
      const L = lum(d[i], d[i + 1], d[i + 2]);
      s += L; k++; if (L >= 240) hot++; if (L > mx) mx = L;
    }
    return { mean: +(s / k).toFixed(2), hotPct: +(100 * hot / k).toFixed(2), max: +mx.toFixed(0) };
  };
  window.__patch = (x, y, z, px) => {
    const p = new THREE.Vector3(x, y, z).project(window.view.three.cam);
    if (p.z > 1) return null;
    const r = cv.getBoundingClientRect();
    const sx = Math.round((p.x * 0.5 + 0.5) * c2.width);
    const sy = Math.round((-p.y * 0.5 + 0.5) * c2.height);
    const n = Math.max(2, Math.round((px || 9) * (c2.width / r.width)));
    const x0 = Math.max(0, sx - (n >> 1)), y0 = Math.max(0, sy - (n >> 1));
    const w = Math.min(n, c2.width - x0), h = Math.min(n, c2.height - y0);
    if (w <= 0 || h <= 0) return null;
    const d = g2.getImageData(x0, y0, w, h).data;
    let s = 0, k = 0;
    for (let i = 0; i < d.length; i += 4) { s += lum(d[i], d[i + 1], d[i + 2]); k++; }
    return k ? +(s / k).toFixed(1) : null;
  };
  /* 바닥 격자 평균 — 배경(창밖·하늘)을 안 세고 방만 본다 */
  window.__floor = () => {
    window.__shot();
    const b = v.roomSize(); const out = [];
    for (let i = 1; i < 14; i++) for (let j = 1; j < 14; j++) {
      const p = window.__patch(-b.w/2 + b.w * i / 14, 0.01, -b.d/2 + b.d * j / 14, 7);
      if (p != null) out.push(p);
    }
    return out.length ? +(out.reduce((a, c) => a + c, 0) / out.length).toFixed(2) : null;
  };
  /* 등 바로 아래 — 「웅덩이」가 실제로 생겼나 */
  window.__underLamps = () => {
    window.__shot();
    const out = [];
    for (const r of (v.lightRigs ? v.lightRigs() : [])) {
      if (!r.grow) continue;
      const p = window.__patch(r.pos.x, Math.max(0.01, r.pos.y - 0.55), r.pos.z, 11);
      if (p != null) out.push({ id: r.id, v: p });
    }
    return out;
  };
  return true;
})()`;

/* 추천 자리 DLI — 조도 엔진에서 직접. 화면과 **다른 길**이라 화면 변경에 흔들리면 안 된다 */
const DLI = (room, n) => `(async () => {
  const e = window.engine; if (!e) return null;
  if (!e.room || e.room.id !== ${JSON.stringify(room)}) e.build(${JSON.stringify(room)});
  e.clearCache();
  return e.room.slots.map(s => ({ id: s.slotId,
    dli: +e.dliOfSlot(s.slotId, { weather:'clear', season:'summer', lampCount:${n}, litHours:12 }).toFixed(4) }));
})()`;

const pct = (a, b) => (a == null || b == null || !a) ? '—' : `${(100 * (b - a) / a >= 0 ? '+' : '')}${(100 * (b - a) / a).toFixed(1)}%`;

async function main() {
  const page = await launch({ width: 390, height: 844, dpr: 2, mobile: false });
  page.on((m, p) => { if (m === 'Runtime.exceptionThrown') console.log('EX ' + p.exceptionDetails.text); });
  await page.goto(`${BASE}/tools/room_view_demo.html?room=${ROOM}&engine=1`);
  await page.waitFor('!!window.view && !!window.engine', 180000, 200);
  await page.eval(INSTALL);
  await page.eval(`window.view.focusSlot(null, true); window.view.redraw(); 1`);
  await sleep(500);

  const rigs = await page.eval(`window.view.lightRigs()`);
  const grow = rigs.filter(r => r.grow);
  console.log(`\n방=${ROOM} · 390×844 dpr2 · 화면 휘도 0..255(감마 후)`);
  console.log(`조명 기구 ${rigs.length}개 (식물등 ${grow.length}개: ${grow.map(r => r.id).join(', ')})\n`);

  console.log('시각   등   화면평균  탄픽셀%  바닥평균   등아래');
  const rows = {};
  for (const t of TIMES) {
    for (const n of [0, grow.length]) {
      await page.eval(`window.view.setGrowLights(${n}); window.view.setDaylight(${t}); window.view.redraw(); 1`);
      await sleep(320);
      const sc = await page.eval(`window.__screen()`);
      const fl = await page.eval(`window.__floor()`);
      const ul = await page.eval(`window.__underLamps()`);
      rows[`${t}|${n}`] = { sc, fl, ul };
      const und = ul.map(u => u.v).join('/') || '—';
      console.log(`${t.toFixed(2)}  ${String(n).padStart(2)}   ${String(sc.mean).padStart(7)}  ` +
                  `${String(sc.hotPct).padStart(7)}  ${String(fl).padStart(7)}   ${und}`);
    }
    const a = rows[`${t}|0`], b = rows[`${t}|${grow.length}`];
    console.log(`      차이  화면 ${pct(a.sc.mean, b.sc.mean)} · 바닥 ${pct(a.fl, b.fl)}` +
                `  (탄픽셀 ${a.sc.hotPct}% → ${b.sc.hotPct}%)`);
  }

  /* ── DLI — 등 개수별. 화면 변경과 **무관해야** 하는 값이다 ── */
  console.log('\n추천 자리 DLI (맑음·여름·12h) — 조도 엔진 직접');
  const d0 = await page.eval(DLI(ROOM, 0), true);
  const d1 = await page.eval(DLI(ROOM, grow.length), true);
  console.log(`자리 ${d0.length}칸`);
  for (let i = 0; i < d0.length; i++)
    console.log(`  ${d0[i].id.padEnd(42)} 등0 ${String(d0[i].dli).padStart(8)}   등${grow.length} ${String(d1[i].dli).padStart(8)}`);
  console.log('\nDLI_JSON ' + JSON.stringify({ off: d0, on: d1 }));

  await page.close();
}
main().catch(e => { console.error(e); process.exit(1); });
