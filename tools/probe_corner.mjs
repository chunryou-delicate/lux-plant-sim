/* ============================================================
   tools/probe_corner.mjs — **바닥과 벽이 만나는 모서리 줄**을 재는 자 (2026-08-16 신설)

       node tools/probe_corner.mjs                 # 사진 + 모서리 마루 재기(기본 before)
       node tools/probe_corner.mjs --tag=after     # 파일 이름표를 바꾼다

   ── 왜 있나 ──────────────────────────────────────────────────
   박사님: *"바닥 벽 모서리 쪽이 살짝 이상하긴 하네. 빛이랑 이런 게."*
   「눈으로 이상하다」로 끝내면 고친 뒤에 나아졌는지를 같은 자로 말할 수가 없다.

   ── 무엇을 재나 · 「모서리 마루」 ─────────────────────────────
   바닥과 벽이 만나는 선을 **눈으로 찍지 않는다.** 방 치수(roomSize)에서 그 선의
   월드 좌표를 뽑고 카메라로 화면에 투영해서 잰다. 그래서 다음 사람이 같은 수를 얻는다.

     · 선 위 한 점 P 마다 화면에서 그 선에 **직각인** 방향으로 ±6화소를 훑어 봉우리를 찾고,
       바닥 쪽 15cm 지점과 벽 쪽 15cm 지점의 밝기를 바탕으로 삼는다.
     · **튐 = 봉우리 − max(바닥바탕, 벽바탕)**. 0 이면 모서리가 매끈한 것이다.
     · 가구·사람이 가린 점이 섞이므로 **중앙값과 상위10%**로 말한다(평균은 가구에 끌려간다).

   ⚠ `readPixels` 는 안 쓴다 — 그린 뒤 까맣게 나온다(START-HERE §2.9②).
   ⚠ 사진이 제대로 찍혔는지는 **색 가짓수**로 잰다(까만 사진 3색 · 멀쩡한 사진 3,000색 이상).
      기준에 못 미치면 **재지 않고 죽는다.** 까만 사진에서 「튐 0」이 나온 적이 있다.

   ⚠ 이 자는 아무 파일도 안 고친다. 재기만 한다.
============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { launch, sleep } from './test_cdp.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const TAG = (process.argv.find(a => a.startsWith('--tag=')) || '--tag=before').slice(6);
/* 하루 어디를 재나 — 0.50 한낮이 밑값. 해가 낮으면 그림자가 길어져 같은 어긋남이 더 크게 보인다 */
const DAY_T = parseFloat((process.argv.find(a => a.startsWith('--t=')) || '--t=0.5').slice(4)) || 0.5;
const OUT = path.join(ROOT, 'docs/handoff/img/corner');
fs.mkdirSync(OUT, { recursive: true });
const _wd = setTimeout(() => { console.error('⏱ 시간 초과'); process.exit(2); }, 420000); _wd.unref && _wd.unref();

/* ───────── PNG 디코드 (의존성 없이 · probe_midalbo.mjs 와 같은 코드) ───────── */
function decodePNG(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('PNG 가 아니다');
  let off = 8, w = 0, h = 0, depth = 0, ctype = 0, interlace = 0;
  const idat = [];
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      depth = data[8]; ctype = data[9]; interlace = data[12];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (depth !== 8) throw new Error(`비트깊이 ${depth} 는 못 읽는다`);
  if (interlace !== 0) throw new Error('인터레이스 PNG 는 못 읽는다');
  const ch = { 0: 1, 2: 3, 4: 2, 6: 4 }[ctype];
  if (!ch) throw new Error(`색타입 ${ctype} 는 못 읽는다`);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * ch;
  const out = Buffer.alloc(h * stride);
  let p = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[p++];
    const line = raw.subarray(p, p + stride); p += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? cur[x - ch] : 0;
      const b = prev ? prev[x] : 0;
      const c = (prev && x >= ch) ? prev[x - ch] : 0;
      let v = line[x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      }
      cur[x] = v & 255;
    }
  }
  return { w, h, ch, data: out };
}
const lum = (im, x, y) => {
  if (x < 0 || y < 0 || x >= im.w || y >= im.h) return NaN;
  const i = ((y | 0) * im.w + (x | 0)) * im.ch;
  return 0.2126 * im.data[i] + 0.7152 * im.data[i + 1] + 0.0722 * im.data[i + 2];
};
function colorCount(im) {
  const s = new Set();
  for (let y = 0; y < im.h; y += 2) for (let x = 0; x < im.w; x += 2) {
    const i = (y * im.w + x) * im.ch;
    s.add((im.data[i] << 16) | (im.data[i + 1] << 8) | im.data[i + 2]);
  }
  return s.size;
}
const med = a => { if (!a.length) return NaN; const b = a.slice().sort((p, q) => p - q); return b[b.length >> 1]; };
const p90 = a => { if (!a.length) return NaN; const b = a.slice().sort((p, q) => p - q); return b[Math.min(b.length - 1, Math.floor(b.length * 0.9))]; };

/* ───────── 게임을 띄운다 ───────── */
const page = await launch({ width: 390, height: 844, dpr: 2, mobile: false });
async function boot() {
  await page.goto(`${BASE}/game.html`);
  await page.waitFor('!!window.__rv', 180000, 300);
  await page.waitFor('window.__byeotBooted === true', 180000, 300);
  await sleep(6000);
  for (let i = 0; i < 40; i++) {
    const busy = await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');
      return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`);
    if (!busy) break;
    await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s)s.click();
      const b=document.getElementById('dlgBox'); if(b)b.click();
      const g=document.getElementById('guideClose'); if(g)g.click();})()`, false);
    await sleep(250);
  }
  /* ★ 실험용 손잡이 — 사진 찍기 전에 페이지에서 한 번 돌릴 코드.
     고치기 전에 「어느 손잡이가 이 줄을 만드나」를 재느라 쓴다. 안 주면 아무것도 안 한다.
       CORNER_JS="window.__sunShadow.radius=1" node tools/probe_corner.mjs --tag=r1 */
  if (process.env.CORNER_JS) await page.eval(process.env.CORNER_JS, false);
  /* 시각을 못 박는다 — 시간이 흐르면 같은 자로 전후를 못 견준다. 밑값은 한낮(0.50). */
  await page.eval(`window.__rv.setDaylight(${DAY_T})`, false);
  await sleep(1800);
}
await page.goto(`${BASE}/game.html`);
await page.eval(`localStorage.clear()`, false);
await boot();

/* ───────── 모서리 선을 **방 치수에서** 뽑아 화면 좌표로 옮긴다 ─────────
   눈으로 화면 좌표를 집으면 다음 사람이 못 재현한다. */
const geoJson = await page.eval(`(async ()=>{
  const H = await import('/src/render3d/house.js');
  const { w:CW, d:CD } = H.roomSize();
  const WT = 0.2;                                   // house.js §WT — 벽 두께
  const cam = window.__cam;
  const c = document.getElementById('roomCanvas');
  const r = c.getBoundingClientRect();
  const toScreen = (x,y,z)=>{
    const v = new THREE.Vector3(x,y,z).project(cam);
    return [ r.left + (v.x*0.5+0.5)*r.width, r.top + (-v.y*0.5+0.5)*r.height ];
  };
  /* 벽 안쪽 면 · 바깥 법선 */
  const W = {
    back : { n:[0,0,-1], at:-CD/2+WT/2, axis:'z', uMin:-CW/2+WT/2, uMax:CW/2-WT/2 },
    front: { n:[0,0, 1], at: CD/2-WT/2, axis:'z', uMin:-CW/2+WT/2, uMax:CW/2-WT/2 },
    left : { n:[-1,0,0], at:-CW/2+WT/2, axis:'x', uMin:-CD/2+WT/2, uMax:CD/2-WT/2 },
    right: { n:[ 1,0,0], at: CW/2-WT/2, axis:'x', uMin:-CD/2+WT/2, uMax:CD/2-WT/2 },
  };
  const cp = cam.position;
  const out = {};
  for (const k in W) {
    const w = W[k];
    /* 벽 한가운데에서 카메라 쪽을 봤을 때 바깥 법선이 카메라를 향하면 그 벽은
       밑동으로 내려가 있다(house.js §updateShellVisibility 와 같은 자) — 그 벽은 안 잰다. */
    const cx = w.axis==='x' ? w.at : 0, cz = w.axis==='z' ? w.at : 0;
    const d = new THREE.Vector3(cp.x-cx, 0, cp.z-cz).normalize();
    const dot = w.n[0]*d.x + w.n[2]*d.z;
    const pts = [];
    const N = 90;
    for (let i=0;i<=N;i++){
      const u = w.uMin + (w.uMax-w.uMin)*i/N;
      const x = w.axis==='x' ? w.at : u, z = w.axis==='z' ? w.at : u;
      /* 세 점: 모서리 P · 바닥 쪽 15cm · 벽 쪽 15cm.
         안쪽 방향은 바깥 법선의 반대다. */
      const ix = -w.n[0]*0.15, iz = -w.n[2]*0.15;
      pts.push({ u:+u.toFixed(3),
                 P: toScreen(x, 0, z),
                 F: toScreen(x+ix, 0, z+iz),
                 Wl:toScreen(x, 0.15, z) });
    }
    out[k] = { standing: dot < 0.3, pts };
  }
  return JSON.stringify({ CW, CD, canvas:{x:r.left,y:r.top,w:r.width,h:r.height}, walls:out });
})()`);
const geo = JSON.parse(geoJson);

const shot = path.join(OUT, `${TAG}_room.png`);
/* ⚠ 이 기계에서 예닐곱 번에 한 번 방이 통째로 까맣게 찍힌다(색 3,20x). 코드가 아니라
   **띄우기가 실패한 것**이다 — 같은 설정에서 다시 띄우면 멀쩡하게 나온다.
   그래서 한 번만 다시 해 본다. 두 번 다 까맣게 나오면 그건 진짜다(예: bias 0). */
let im = null, colors = 0;
for (let attempt = 0; attempt < 2; attempt++) {
  if (attempt) { console.error('… 까맣게 찍혔다. 한 번만 다시 띄운다'); await boot(); }
  await page.shot(shot);
  await sleep(200);
  im = decodePNG(fs.readFileSync(shot));
  colors = colorCount(im);
  if (colors >= 5000) break;
}
console.log(`사진 ${im.w}×${im.h} · 색 가짓수 ${colors}`);
/* ⚠ 문턱은 재서 정했다: 멀쩡한 방 사진 8,500~9,700색 · 방이 통째로 까맣게 그려진 사진 3,204색.
   ★ 까만 사진에서도 「튐 0」은 나온다 — 그걸 「고쳤다」로 읽으면 안 된다. 그래서 여기서 죽는다. */
if (colors < 5000) {
  console.error(`⛔ 방이 안 그려졌다(색 ${colors} · 멀쩡하면 8,500 이상) — 재지 않는다.`);
  console.error('   「튐 0」이 나와도 그것은 고쳐진 게 아니라 방이 까만 것이다(§2.9③).');
  process.exit(3);
}

const dpr = im.w / 390;
const dev = p => [p[0] * dpr, p[1] * dpr];

/* 한 점의 「튐」 — 모서리에 직각으로 ±6화소를 훑어 봉우리를 찾고 양쪽 바탕과 견준다 */
function ridgeAt(pt) {
  const P = dev(pt.P), F = dev(pt.F), Wl = dev(pt.Wl);
  if (P[0] < 2 || P[1] < 2 || P[0] > im.w - 3 || P[1] > im.h - 3) return null;
  /* 모서리에 직각인 방향 = 바닥 쪽 15cm 로 가는 방향(화면에서) */
  let dx = F[0] - P[0], dy = F[1] - P[1];
  const len = Math.hypot(dx, dy);
  if (!(len > 1)) return null;
  dx /= len; dy /= len;
  let peak = -1;
  for (let t = -6; t <= 6; t++) {
    const v = lum(im, Math.round(P[0] + dx * t), Math.round(P[1] + dy * t));
    if (Number.isFinite(v) && v > peak) peak = v;
  }
  const bF = lum(im, Math.round(F[0]), Math.round(F[1]));
  const bW = lum(im, Math.round(Wl[0]), Math.round(Wl[1]));
  if (!Number.isFinite(bF) || !Number.isFinite(bW) || peak < 0) return null;
  return { jump: peak - Math.max(bF, bW), peak, floor: bF, wall: bW };
}

/* ★ 방 전체 밝기도 같이 적는다 — 모서리를 고치면서 방을 통째로 어둡게/밝게 만들면
   「모서리는 나았는데 방이 달라졌다」가 된다. 그걸 놓치지 않으려고 같이 잰다. */
let sum = 0, cnt = 0;
const cy0 = Math.round(geo.canvas.y * dpr), cy1 = Math.round((geo.canvas.y + geo.canvas.h) * dpr);
for (let y = cy0; y < Math.min(cy1, im.h); y += 3) for (let x = 0; x < im.w; x += 3) { sum += lum(im, x, y); cnt++; }
const roomMean = +(sum / cnt).toFixed(2);
console.log(`방 화면 평균 밝기 ${roomMean}`);

const report = { tag: TAG, at: new Date().toISOString(), colors, roomMean, room: { CW: geo.CW, CD: geo.CD }, walls: {} };
console.log('');
console.log('벽      | 잰 점 | 튐 중앙값 | 튐 상위10% | 튐>20 인 점');
console.log('--------|-------|-----------|------------|------------');
for (const k in geo.walls) {
  const w = geo.walls[k];
  if (!w.standing) { report.walls[k] = { standing: false }; continue; }
  const js = [];
  for (const pt of w.pts) { const r = ridgeAt(pt); if (r) js.push(+r.jump.toFixed(1)); }
  const over = js.filter(v => v > 20).length;
  report.walls[k] = { standing: true, n: js.length, med: +med(js).toFixed(1), p90: +p90(js).toFixed(1), over20: over, jumps: js };
  console.log(`${k.padEnd(7)} | ${String(js.length).padStart(5)} | ${String(med(js).toFixed(1)).padStart(9)} | ${String(p90(js).toFixed(1)).padStart(10)} | ${String(over).padStart(4)} / ${js.length}`);
}
const all = [].concat(...Object.values(report.walls).filter(w => w.standing).map(w => w.jumps));
report.all = { n: all.length, med: +med(all).toFixed(1), p90: +p90(all).toFixed(1), over20: all.filter(v => v > 20).length };
console.log('--------|-------|-----------|------------|------------');
console.log(`합계    | ${String(all.length).padStart(5)} | ${String(med(all).toFixed(1)).padStart(9)} | ${String(p90(all).toFixed(1)).padStart(10)} | ${String(report.all.over20).padStart(4)} / ${all.length}`);

fs.writeFileSync(path.join(OUT, `${TAG}_ridge.json`), JSON.stringify(report, null, 1));
console.log(`\n저장: docs/handoff/img/corner/${TAG}_room.png · ${TAG}_ridge.json`);
await page.close();
clearTimeout(_wd);
