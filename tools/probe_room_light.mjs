/* ============================================================
   tools/probe_room_light.mjs — 방이 실제로 얼마나 밝은지 **잰다**
   ------------------------------------------------------------
   "어둡게 했다"는 보고가 아니다. 숫자가 보고다.
   박사님 지적 두 건("외부 태양빛이 너무 안 들어온다" · "밤에 등이 아직도 너무 밝다")을
   눈이 아니라 자로 다루려고 만들었다. 다음에 또 밝기를 조질 때 이걸 먼저 돌려라.

     python tools/serve.py 8971
     node tools/probe_room_light.mjs                 # 게임 정책 vs house 기본(=index.html)
     node tools/probe_room_light.mjs --room oneroom
     node tools/probe_room_light.mjs --t 0.5,0.9     # 잴 시각(0..1)

   ★ 왜 index.html 을 직접 안 찍나
     index.html 은 카메라·화각·창 크기가 다르다. 두 페이지를 각각 찍어 평균을 내면
     **밝기 차이인지 프레이밍 차이인지 못 가른다.** 그래서 같은 방 뷰에서 조명 정책만
     갈아 끼워(view.setLightPolicy) 같은 카메라로 번갈아 찍는다.
     'house' 정책 = scene.js 기본값 그대로 = index.html(src/main.js)이 쓰는 그 그림이다
     (main.js 는 createScene + updateLight 말고 밝기를 만지는 코드가 없다 — 확인함).

   ★ 무엇을 재나 — 화면 평균 하나로는 아무것도 못 고친다. **자리별로** 잰다.
     창가바닥  창 바로 안쪽 바닥 (= 햇빛이 드는 자리)
     안쪽바닥  창에서 제일 먼 바닥 (= 방 안쪽)
     등아래    천장등 바로 아래 바닥 (= 밤의 웅덩이 한가운데)
     구석      방 구석 바닥 (= 밤에 어두워야 하는 곳)
     벽        보이는 뒷벽 중간 높이
     방전체    바닥 격자 위 표본의 평균
   밝기는 감마 보정된 화면 픽셀의 휘도(0.2126R+0.7152G+0.0722B, 0..255)다.
============================================================ */
import { launch, sleep } from './test_cdp.mjs';

const BASE = process.env.BYEOT_URL || 'http://localhost:8971';
const argv = process.argv.slice(2);
const argOf = (k, d) => { const i = argv.indexOf(k); return i < 0 ? d : argv[i + 1]; };
const ROOM = argOf('--room', 'banjiha');
const TIMES = String(argOf('--t', '0.50,0.90')).split(',').map(Number);

/* 화면 픽셀을 읽는 자 — WebGL 캔버스를 2D 캔버스에 옮겨 getImageData 로 센다.
   ⚠ redraw() 와 같은 틱에 해야 한다. 드로잉 버퍼는 다음 합성에서 비워진다(검은 그림이 나온다). */
const INSTALL = `(() => {
  const v = window.view, ctx = v.three;
  const cv = document.getElementById('roomCanvas');
  const c2 = document.createElement('canvas');
  const g2 = c2.getContext('2d', { willReadFrequently: true });
  const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

  window.__shot = () => {
    v.redraw();                                  // ★ 같은 틱에 옮긴다
    c2.width = cv.width; c2.height = cv.height;
    g2.drawImage(cv, 0, 0);
    return { w: c2.width, h: c2.height, dpr: cv.width / cv.getBoundingClientRect().width };
  };
  /* 월드 한 점 둘레의 작은 사각형 평균 휘도. 화면 밖이면 null. */
  window.__patch = (x, y, z, px) => {
    const p = new THREE.Vector3(x, y, z).project(ctx.cam);
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
  /* 잴 자리들을 방에서 뽑는다 — 방마다 창·등 위치가 다르므로 좌표를 박지 않는다 */
  window.__spots = () => {
    const b = v.roomSize();
    const wins = (ctx.scene, v.three, []);
    /* 제일 큰 벽창을 찾는다(방뷰가 쓰는 built.luxWins 와 같은 정보) */
    let big = null;
    for (const w of (window.__luxWins || [])) {
      if (!w.wall || w.wall === 'ceiling') continue;
      const a = (w.w || 0) * (w.h || 0);
      if (!big || a > big.a) big = { a, wall: w.wall, cu: w.cu || 0 };
    }
    const inset = 0.55;
    let winFloor = { x: 0, z: -b.d / 2 + inset }, farFloor = { x: 0, z: b.d / 2 - inset };
    if (big) {
      if (big.wall === 'back')  { winFloor = { x: big.cu, z: -b.d/2 + inset }; farFloor = { x: big.cu, z:  b.d/2 - inset }; }
      if (big.wall === 'front') { winFloor = { x: big.cu, z:  b.d/2 - inset }; farFloor = { x: big.cu, z: -b.d/2 + inset }; }
      if (big.wall === 'left')  { winFloor = { x: -b.w/2 + inset, z: big.cu }; farFloor = { x:  b.w/2 - inset, z: big.cu }; }
      if (big.wall === 'right') { winFloor = { x:  b.w/2 - inset, z: big.cu }; farFloor = { x: -b.w/2 + inset, z: big.cu }; }
    }
    /* 천장등 바로 아래 — 없으면 방 한가운데 */
    let lamp = { x: 0, z: 0 };
    const rigs = v.lightRigs ? v.lightRigs() : [];
    const ceil = rigs.find(r => /ceiling/.test(r.id));
    if (ceil) lamp = { x: ceil.pos.x, z: ceil.pos.z };
    /* 구석 — 창에서 제일 먼 모서리 */
    const corner = { x: (farFloor.x >= 0 ? 1 : -1) * (b.w / 2 - 0.4),
                     z: (farFloor.z >= 0 ? 1 : -1) * (b.d / 2 - 0.4) };
    return { size: b, winFloor, farFloor, lamp, corner };
  };
  /* 바닥 전체 평균 + **제일 밝은 자국** — 격자로 훑는다(배경은 안 센다. 바닥 점만 본다).
     ★ 평균만 보면 "햇살 자국"이 안 보인다. 박사님이 보시는 건 그 자국이다. */
  window.__floorScan = () => {
    const b = v.roomSize(); const out = []; let best = null;
    for (let i = 1; i < 14; i++) for (let j = 1; j < 14; j++) {
      const x = -b.w/2 + b.w * i / 14, z = -b.d/2 + b.d * j / 14;
      const p = window.__patch(x, 0.01, z, 7);
      if (p == null) continue;
      out.push(p);
      if (!best || p > best.v) best = { v: p, x: +x.toFixed(2), z: +z.toFixed(2) };
    }
    return { mean: out.length ? +(out.reduce((a, c) => a + c, 0) / out.length).toFixed(1) : null,
             max: best ? best.v : null, at: best ? [best.x, best.z] : null };
  };
  window.__floorMean = () => window.__floorScan().mean;
  /* 창 유리 — "밖이 밝다"가 화면에 보이나 */
  window.__glass = () => {
    const out = [];
    for (const g of (v.three.glassMeshes || [])) {
      const p = new THREE.Vector3(); g.getWorldPosition(p);
      const q = window.__patch(p.x, p.y, p.z, 15);
      if (q != null) out.push(q);
    }
    return out.length ? +(Math.max(...out)).toFixed(1) : null;
  };
  return true;
})()`;

const num = v => (v == null ? '  —  ' : String(v).padStart(6));
const row = (name, m) =>
  `${name.padEnd(16)} ${num(m.floor)} ${num(m.max)} ${num(m.win)} ${num(m.far)} ${num(m.lamp)} ${num(m.corner)} ${num(m.glass)}` +
  `  볕자국/안쪽 ${m.punch == null ? '—' : m.punch.toFixed(2)}`;
const HEAD = '구간              방바닥 볕자국   창가   안쪽  등아래   구석  창유리';

async function measure(page) {
  await page.eval(`window.__shot()`);
  const s = await page.eval(`window.__spots()`);
  const m = await page.eval(`(() => {
    const s = window.__spots();
    return {
      win: window.__patch(s.winFloor.x, 0.01, s.winFloor.z, 13),
      far: window.__patch(s.farFloor.x, 0.01, s.farFloor.z, 13),
      lamp: window.__patch(s.lamp.x, 0.01, s.lamp.z, 13),
      corner: window.__patch(s.corner.x, 0.01, s.corner.z, 11),
      wall: window.__patch(0, s.size.h * 0.55, -s.size.d / 2 + 0.03, 11),
      scan: window.__floorScan(),
      glass: window.__glass()
    };
  })()`);
  m.floor = m.scan.mean; m.max = m.scan.max; m.at = m.scan.at;
  m.contrast = (m.win != null && m.far != null && m.far > 0.5) ? m.win / m.far : null;
  /* ★ 이 게임의 그림 = **볕 자국이 방 안쪽보다 얼마나 밝은가** */
  m.punch = (m.max != null && m.far != null && m.far > 0.5) ? m.max / m.far : null;
  return m;
}

async function main() {
  const page = await launch({ width: 390, height: 844, dpr: 2, mobile: false });
  page.on((m, p) => { if (m === 'Runtime.exceptionThrown') console.log('EX ' + p.exceptionDetails.text); });
  await page.goto(`${BASE}/tools/room_view_demo.html?room=${ROOM}`);
  await page.waitFor('!!window.view', 180000, 200);
  /* 창 목록은 방 뷰 안에 있다 — 잴 자리를 뽑으려고 밖으로 한 번 꺼내 둔다 */
  await page.eval(`(() => { const s = window.view.three.skyWins || [];
    window.__luxWins = (window.view.three.__luxWins) || []; return 1; })()`);
  await page.eval(`(() => {
    /* built.luxWins 는 안 내주므로 창 유리 메시의 월드 위치로 벽을 되짚는다 */
    const v = window.view, b = v.roomSize(), out = [];
    for (const g of (v.three.glassMeshes || [])) {
      const p = new THREE.Vector3(); g.getWorldPosition(p);
      const bb = new THREE.Box3().setFromObject(g);
      const w = bb.max.x - bb.min.x, d = bb.max.z - bb.min.z, h = bb.max.y - bb.min.y;
      let wall = null, cu = 0;
      if (Math.abs(p.z + b.d/2) < 0.35) { wall = 'back'; cu = p.x; }
      else if (Math.abs(p.z - b.d/2) < 0.35) { wall = 'front'; cu = p.x; }
      else if (Math.abs(p.x + b.w/2) < 0.35) { wall = 'left'; cu = p.z; }
      else if (Math.abs(p.x - b.w/2) < 0.35) { wall = 'right'; cu = p.z; }
      if (wall) out.push({ wall, cu, w: Math.max(w, d), h });
    }
    window.__luxWins = out;
    return out.length;
  })()`);
  await page.eval(INSTALL);
  await page.eval(`window.view.focusSlot(null, true); window.view.redraw(); 1`);
  await sleep(400);

  console.log(`\n방=${ROOM} · 390×844 dpr2 · 화면 휘도 0..255 (감마 후)`);
  const winList = await page.eval(`window.__luxWins`);
  console.log(`창 ${winList.length}개 ${JSON.stringify(winList.map(w => w.wall))}\n`);

  for (const t of TIMES) {
    console.log(`── 시각 t=${t.toFixed(2)} ${t > 0.30 && t < 0.78 ? '(낮)' : '(밤)'} ───────────────────────────`);
    console.log(HEAD);
    const res = {};
    for (const pol of ['house', 'game']) {
      await page.eval(`window.view.setLightPolicy('${pol}')`);
      await page.eval(`window.view.setDaylight(${t})`);
      await sleep(150);
      res[pol] = await measure(page);
      console.log(row(pol === 'house' ? 'house(index.html)' : 'game(지금)', res[pol]));
    }
    const d = (a, b) => (a == null || b == null) ? '—' : `${(b / a * 100).toFixed(0)}%`;
    console.log(`  game/house 비율 → 방바닥 ${d(res.house.floor, res.game.floor)} · ` +
                `볕자국 ${d(res.house.max, res.game.max)} · 창가 ${d(res.house.win, res.game.win)} · ` +
                `안쪽 ${d(res.house.far, res.game.far)} · 창유리 ${d(res.house.glass, res.game.glass)}` +
                `   (볕자국 자리 ${JSON.stringify(res.game.at)})`);
    console.log('');
  }

  /* 낮밤 대비 — 밤이 낮보다 확실히 어두운가, 그리고 밤에 등 웅덩이가 있는가 */
  await page.eval(`window.view.setLightPolicy('game')`);
  const day = {}, night = {};
  await page.eval(`window.view.setDaylight(0.50)`); await sleep(150);
  Object.assign(day, await measure(page));
  await page.eval(`window.view.setDaylight(0.95)`); await sleep(150);
  Object.assign(night, await measure(page));
  console.log('── 낮밤 대비 (game 정책) ───────────────────────────────');
  console.log(HEAD);
  console.log(row('낮 t=0.50', day));
  console.log(row('밤 t=0.95', night));
  const ratio = day.floor && night.floor ? night.floor / day.floor : null;
  const pool = night.lamp && night.corner ? night.lamp / night.corner : null;
  console.log(`  밤/낮 방바닥 ${ratio == null ? '—' : (ratio * 100).toFixed(0) + '%'}` +
              `   ★밤 웅덩이(등아래/구석) ${pool == null ? '—' : pool.toFixed(2)}배` +
              `   낮 볕자국/안쪽 ${day.punch == null ? '—' : day.punch.toFixed(2)}배`);
  console.log('  기준: 밤/낮 < 55% 여야 "밤"이고, 웅덩이 > 1.35 여야 "등이 만든 밤"이며,');
  console.log('        낮 볕자국/안쪽 > 1.8 이라야 "창으로 볕이 든다"가 화면에 보인다.');

  await page.close();
}
main().catch(e => { console.error(e); process.exit(1); });
