/* ============================================================
   tools/probe_wateringgrip.mjs — **물뿌리개 손잡이가 손에 붙어 있나** 를 잰다 (2026-08-16)
   ------------------------------------------------------------
   박사님: *"물 줄 때 물뿌리개 위치를 잘 조정해서 **손잡이랑 손이 붙어 있게** 좀 수정할래?"*

     python tools/serve.py 8963
     BYEOT_URL=http://localhost:8963 node tools/probe_wateringgrip.mjs

   ★★ 무엇을 재나 — **손 뼈와 손잡이의 거리[cm]** 다. 「붙어 있다」는 그 거리가 0 이라는 뜻이다.
     · 지금(고친 뒤)   = |손잡이 월드 − 손 뼈 월드|
     · 옛 길(고치기 전) = 옛 코드는 물뿌리개 **원점**을 손에 뒀다. 그러면 손잡이는
       「손잡이 로컬 자리」만큼 떨어진다(그 길이는 돌려도 안 변한다). 그것이 옛 거리다.
       ⇒ **코드를 되돌리지 않고도 전·후를 같은 프레임에서 잰다.** 되돌렸다 다시 고치는
         사이에 다른 것이 섞이는 길을 안 만든다.

   ⚠⚠ **이 자는 뒤처진다.** 물뿌리개는 동작의 매 프레임 콜백에서 손에 맞춰지는데, 재는 자는
     그 뒤 아무 때나 CDP 로 들여다본다 — 그 사이 손이 더 움직인다. 그래서 **재는 사이를
     셋으로 바꿔** 잰다. 남는 거리가 사이를 따라 줄면 그것은 물뿌리개가 뜬 것이 아니라
     **자가 뒤처진 것**이다(§2.9 — 자를 먼저 의심하라).

   무엇을 켜고 무엇을 껐나
     · 실제 game.html · 반지하 · 폰 세로 390×844 dpr 2 · localStorage 비움
     · 햇빛은 0.50 에 **못박는다**(창구를 덮어쓴다 — 평소 시계가 매 프레임 다시 민다)
     · 파일은 한 줄도 안 고친다
   ⚠ `CAN_USE_GLB` 가 거짓이라 지금 도는 것은 **원기둥 판**이다. GLB 갈래는 이 자로 못 잰다.
============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { launch, sleep } from './test_cdp.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const OUT = path.join(ROOT, 'docs/handoff/img');

function decodePNG(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('PNG 가 아니다');
  let off = 8, w = 0, h = 0, depth = 0, ctype = 0, interlace = 0;
  const idat = [];
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); depth = data[8]; ctype = data[9]; interlace = data[12]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (depth !== 8 || interlace !== 0) throw new Error('이 PNG 는 못 읽는다');
  const ch = { 0: 1, 2: 3, 4: 2, 6: 4 }[ctype];
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * ch, out = Buffer.alloc(h * stride);
  let p = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[p++];
    const line = raw.subarray(p, p + stride); p += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? cur[x - ch] : 0, b = prev ? prev[x] : 0;
      const c = (prev && x >= ch) ? prev[x - ch] : 0;
      let v = line[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      }
      cur[x] = v & 255;
    }
  }
  return { w, h, ch, data: out };
}
function colorCount(im) {
  const s = new Set();
  for (let y = 0; y < im.h; y += 2) for (let x = 0; x < im.w; x += 2) {
    const i = (y * im.w + x) * im.ch;
    s.add((im.data[i] << 16) | (im.data[i + 1] << 8) | im.data[i + 2]);
  }
  return s.size;
}
/* ★ 사진을 **잘라서 키운다.** 폰 390px 에서 물뿌리개는 18px 이라 붙었는지 눈으로 못 가른다
   (room_view §CAN_USE_GLB 주석이 그 18px 을 재 뒀다). 이 저장소는 예전에도 그 18px 을 8배로
   늘려 눈으로 견줬다 — 같은 손짓이다. 확대는 최근접이라 **없는 화소를 지어내지 않는다.** */
function encodePNG(w, h, rgb) {
  const st = w * 3, raw = Buffer.alloc(h * (st + 1));
  for (let y = 0; y < h; y++) { raw[y * (st + 1)] = 0; rgb.copy(raw, y * (st + 1) + 1, y * st, (y + 1) * st); }
  const T = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; T[n] = c >>> 0; }
  const crc = b => { let c = 0xffffffff; for (const x of b) c = T[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length);
    const td = Buffer.concat([Buffer.from(t, 'ascii'), d]); const cc = Buffer.alloc(4); cc.writeUInt32BE(crc(td));
    return Buffer.concat([l, td, cc]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
function cropZoom(srcFile, dstFile, cx, cy, W, H, S) {
  const im = decodePNG(fs.readFileSync(srcFile));
  const x0 = Math.max(0, Math.round(cx) - (W >> 1)), y0 = Math.max(0, Math.round(cy) - Math.round(H * 0.78));
  const out = Buffer.alloc(W * S * H * S * 3);
  for (let y = 0; y < H * S; y++) for (let x = 0; x < W * S; x++) {
    const sx = Math.min(im.w - 1, x0 + Math.floor(x / S)), sy = Math.min(im.h - 1, y0 + Math.floor(y / S));
    const si = (sy * im.w + sx) * im.ch, di = (y * W * S + x) * 3;
    out[di] = im.data[si]; out[di + 1] = im.data[si + 1]; out[di + 2] = im.data[si + 2];
  }
  fs.writeFileSync(dstFile, encodePNG(W * S, H * S, out));
  return { w: W * S, h: H * S };
}
async function shot(page, name) {
  const f = await page.shot(path.join(OUT, name));
  const n = colorCount(decodePNG(fs.readFileSync(f)));
  console.log(`   📷 ${name} · 색 가짓수 ${n}${n < 3000 ? '  ⛔ 까만 사진이다' : ''}`);
  return n;
}

const page = await launch({ width: 390, height: 844, dpr: 2, mobile: false });
const errs = [];
page.on(m => {
  if (m.method === 'Runtime.exceptionThrown')
    errs.push((m.params.exceptionDetails.exception || {}).description || m.params.exceptionDetails.text);
});
await page.goto(`${BASE}/game.html`);
await page.eval(`localStorage.clear()`, false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 180000, 300);
await page.waitFor('window.__byeotBooted === true', 180000, 300);
await sleep(5000);
for (let i = 0; i < 50; i++) {
  const busy = await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');
    return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`);
  if (!busy) break;
  await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s)s.click();
    const b=document.getElementById('dlgBox'); if(b)b.click();
    const g=document.getElementById('guideClose'); if(g)g.click();})()`, false);
  await sleep(250);
}
/* 햇빛을 못 박는다 — 사진끼리 견주려면 방 밝기가 안 흘러야 한다 */
await page.eval(`(()=>{ const rv = window.__rv, raw = rv.setDaylight.bind(rv);
  rv.setDaylight = () => raw(0.50); rv.setDaylight(); return true; })()`, false);
await sleep(1000);

/* ── 창구 ─────────────────────────────────────────────── */
await page.eval(`window.__W = (() => {
  const rv = window.__rv;
  const find = (re) => { let f = null;
    rv.three.scene.traverse(o => { if (!f && re.test(o.name || '')) f = o; }); return f; };
  const V = new THREE.Vector3(), V2 = new THREE.Vector3();
  return {
    rv,
    /* 지금 한 프레임의 값. 물뿌리개가 장면에 없으면 null (동작이 안 도는 중이다) */
    now() {
      const grip = find(/^__can_grip$/), tip = find(/^__can_tip$/), hand = find(/^righthand$/i);
      if (!grip || !hand) return null;
      const can = grip.parent;
      grip.getWorldPosition(V); hand.getWorldPosition(V2);
      const out = { nowCm: +(V.distanceTo(V2) * 100).toFixed(2),
                    /* 옛 길 — 원점이 손에 있었으면 손잡이가 이만큼 떨어져 있었다.
                       회전은 길이를 안 바꾸므로 로컬 자리의 길이가 곧 그 값이다. */
                    oldCm: +(grip.position.length() * 100).toFixed(2),
                    rotZ: +can.rotation.z.toFixed(3), rotY: +can.rotation.y.toFixed(3),
                    /* 재는 사이에 손이 얼마나 움직였는지(=자의 뒤처짐)를 가르려면 이것이 있어야 한다 */
                    hand: [+V2.x.toFixed(5), +V2.y.toFixed(5), +V2.z.toFixed(5)] };
      if (tip) { tip.getWorldPosition(V); out.tipCm = +(V.distanceTo(V2) * 100).toFixed(2); }
      return out;
    },
    /* ★★ **같은 프레임 안에서 잰다.** CDP 로 밖에서 들여다보면 마지막 콜백 뒤로 시간이
       더 흘러 손이 움직여 있다 — 그것을 「물뿌리개가 떴다」로 읽으면 거짓말이다.
       rAF 안에서 손과 손잡이를 **한 번에** 읽으면 그 프레임의 화면이 실제로 어떤지가 나온다.
       ⚠ 손 이력도 같이 쌓는다 — 밖에서 잰 거리가 「몇 프레임 전 손자리」와 맞으면
         그것은 **자가 뒤처진 것**이라는 증거다. */
    watch(ms) {
      return new Promise(res => {
        const same = [], hist = [];
        const t0 = performance.now();
        (function tick() {
          const grip = find(/^__can_grip$/), hand = find(/^righthand$/i);
          if (hand) { hand.getWorldPosition(V2); hist.push([V2.x, V2.y, V2.z]); if (hist.length > 90) hist.shift(); }
          if (grip && hand) {
            grip.getWorldPosition(V);
            same.push({ cm: +(V.distanceTo(V2) * 100).toFixed(3),
                        rotZ: +grip.parent.rotation.z.toFixed(3),
                        /* 이 손잡이 자리가 **최근 손 자리 어딘가**와 맞나 */
                        bestCm: +(Math.min(...hist.map(h =>
                          Math.hypot(V.x - h[0], V.y - h[1], V.z - h[2]))) * 100).toFixed(3) });
          }
          if (performance.now() - t0 < ms) requestAnimationFrame(tick); else res(same);
        })();
      });
    },
    canParts() {
      const grip = find(/^__can_grip$/); if (!grip) return null;
      const can = grip.parent, box = new THREE.Box3().setFromObject(can);
      const tip = can.getObjectByName('__can_tip');
      return { gripLocal: grip.position.toArray().map(v => +v.toFixed(4)),
               tipLocal: tip ? tip.position.toArray().map(v => +v.toFixed(4)) : null,
               boxMin: box.min.toArray().map(v => +v.toFixed(4)),
               boxMax: box.max.toArray().map(v => +v.toFixed(4)) };
    }
  };
})(); 1`, false);

const J = async (e) => JSON.parse(await page.eval(`JSON.stringify(${e})`));
const Ja = async (e) => JSON.parse(await page.eval(`(async()=>JSON.stringify(${e}))()`));

console.log(`\n════ 물뿌리개 손잡이 · 반지하 · 폰 390×844 dpr2 · 한낮(0.50) ════`);

const slots = await J(`__W.rv.slots().map(s => s.slotId)`);
const target = slots[0];
console.log(`   물 줄 자리: ${target}`);
await Ja(`await __W.rv.setPlant('${target}', {kind:'emptypot'}).then(()=>true)`);
await sleep(900);

/* ── ⓪ 사진 먼저 — **카메라를 아직 안 옮겼을 때** 찍는다 ─────────────────
   ⚠ `focusSlot` 을 걸면 카메라가 그루에 코를 박아 **사람이 화면 밖으로 나간다**(두 판 그랬다).
     물뿌리개가 손에 붙었는지는 **사람이 보여야** 눈으로 확인이 된다.
   ⇒ 방 전체를 보는 기본 카메라 그대로 두고, 대신 **창을 크게** 해서 소품이 읽히게 한다.
     (폰 390px 에서 물뿌리개는 18px 이라 붙었는지 안 붙었는지 눈으로 못 가른다 —
      재는 자는 아래 ①에서 폰 크기로 따로 돌린다. 사진과 자를 갈라 놓는다.) */
console.log(`\n── ⓪ 사진 (카메라는 방 전체 그대로 · 사람 둘레만 7배로 키운다) ──`);
/* ⚠ 창을 키워도 안 된다 — 게임이 폰 모양 무대를 지켜서 **검은 띠만 는다**(재 봤다).
   휠로 물러서게도 해 봤는데 `insideRoomDistance` 가 벽 안쪽으로 묶어서 안 물러섰다. */
await page.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: false });
await sleep(1500);
await page.eval(`window.__ACT0 = __W.rv.actAt('${target}', 'water').catch(e=>String(e&&e.message||e)); 1`, false);
{
  let at = null, where = null;
  for (let i = 0; i < 400; i++) {
    const v = await page.eval(`JSON.stringify((()=>{ const r = __W.now(); if (!r) return null;
      const p = __W.rv.characterScreenPos('jachwi');
      const c = document.getElementById('roomCanvas').getBoundingClientRect();
      return { r, p, cx: c.x, cy: c.y }; })())`);
    if (v && v !== 'null') { const o = JSON.parse(v); at = o.r; if (o.p) where = o;
      if (o.p && Math.abs(o.r.rotZ) > 0.5) break; }
    await sleep(30);
  }
  await shot(page, 'cangrip_0_room.png');
  if (where && where.p) {
    const z = cropZoom(path.join(OUT, 'cangrip_0_room.png'), path.join(OUT, 'cangrip_1_pour.png'),
                       (where.p.x + where.cx) * 3, (where.p.y + where.cy) * 3, 130, 150, 7);
    console.log(`   📷 cangrip_1_pour.png · 사람 둘레를 ${z.w}×${z.h} 로 키웠다`);
  } else console.log('   ⚠ 사람 화면 자리를 못 얻어 확대를 못 했다');
  console.log(`   찍은 순간: 손↔손잡이 ${at && at.nowCm} cm · 옛 길이었으면 ${at && at.oldCm} cm`);
}
await sleep(2500);
await page.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: false });
await sleep(1500);

console.log(`\n── ① 물주기 연출을 돌리며 손↔손잡이 거리를 잰다 ──`);
let parts = null;
async function runOnce(gapMs) {
  await page.eval(`window.__ACT = __W.rv.actAt('${target}', 'water').catch(e=>String(e&&e.message||e)); 1`, false);
  const rows = [];
  for (let i = 0; i < Math.ceil(6000 / gapMs); i++) {
    const r = await J('__W.now()');
    if (r) { rows.push(r); if (!parts) parts = await J('__W.canParts()'); }
    else if (rows.length > 4) break;
    await sleep(gapMs);
  }
  await sleep(1500);                            // 동작이 끝나기를 기다린다
  return rows;
}
const GAPS = [240, 120, 30];
const runs = {};
for (const gap of GAPS) runs[gap] = await runOnce(gap);

const stat = (rows, k) => {
  const a = rows.map(r => r[k]).filter(Number.isFinite).sort((x, y) => x - y);
  return a.length ? { min: a[0], med: a[Math.floor(a.length / 2)], max: a[a.length - 1] } : null;
};
const handMove = rows => {
  const d = [];
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1].hand, b = rows[i].hand;
    if (a && b) d.push(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) * 100);
  }
  d.sort((x, y) => x - y);
  return d.length ? +d[Math.floor(d.length / 2)].toFixed(2) : null;
};

console.log(`\n   물뿌리개 로컬 자리[m] — **원점은 몸통 밑면 한가운데**다`);
console.log(`     손잡이 ${JSON.stringify(parts && parts.gripLocal)} · 주둥이 ${JSON.stringify(parts && parts.tipLocal)}`);
console.log(`     경계 상자 ${JSON.stringify(parts && parts.boxMin)} ~ ${JSON.stringify(parts && parts.boxMax)}`);
console.log(`     ⇒ 원점에서 손잡이까지 **${parts ? (Math.hypot(...parts.gripLocal) * 100).toFixed(2) : '?'} cm** — 옛 길은 이만큼 벌어져 있었다`);

console.log(`\n   ┌ 손 뼈 ↔ **손잡이** 거리 [cm] · 재는 사이를 바꿔 가며 ──────────────────────`);
console.log(`   │ 사이     옛 길(원점을 손에)         지금(손잡이를 손에)        그 사이 손이 움직인 거리`);
for (const gap of GAPS) {
  const rows = runs[gap];
  const now = stat(rows, 'nowCm'), old = stat(rows, 'oldCm');
  console.log(`   │ ${String(gap).padStart(4)}ms  ` +
    `${(old ? `중앙 ${old.med} · 최대 ${old.max}` : '(못 쟀다)').padEnd(26)}` +
    `${(now ? `중앙 ${now.med} · 최대 ${now.max}` : '(못 쟀다)').padEnd(26)}` +
    `${handMove(rows) ?? '-'} cm  (${rows.length}장)`);
}
console.log(`   └──────────────────────────────────────────────────────────────────────`);
{
  const a = stat(runs[240], 'nowCm'), b = stat(runs[30], 'nowCm');
  if (a && b) {
    console.log(`   ⇒ 사이를 240 → 30ms 로 줄여도 남는 거리는 **${a.med} → ${b.med} cm** 로 거의 안 줄었다.`);
    console.log(`     ⚠ **그래서 「자가 뒤처져서다」로 넘기면 안 된다.** 밖에서 재는 사이를 줄여도`);
    console.log(`       마지막 콜백 뒤로 흐른 시간은 안 줄기 때문이다 — 아래 ①-b 로 다시 잰다.`);
  }
}

/* ── ①-b ★★ **같은 프레임 안에서** 잰다 (밖에서 재는 자를 못 믿겠으므로) ── */
console.log(`\n── ①-b 같은 프레임 안에서 잰다 (rAF 안에서 손과 손잡이를 한 번에 읽는다) ──`);
await page.eval(`window.__ACT3 = __W.rv.actAt('${target}', 'water').catch(e=>String(e&&e.message||e)); 1`, false);
const same = await Ja(`await __W.watch(3000)`);
if (!same.length) console.log('   ⛔ 한 프레임도 못 잡았다');
else {
  const cm = same.map(r => r.cm).sort((a, b) => a - b);
  const best = same.map(r => r.bestCm).sort((a, b) => a - b);
  const med = a => a[Math.floor(a.length / 2)];
  console.log(`   프레임 ${same.length}장 · rotZ ${Math.min(...same.map(r => r.rotZ)).toFixed(3)} ~ ${Math.max(...same.map(r => r.rotZ)).toFixed(3)}`);
  console.log(`   ┌ **한 프레임 안에서 잰 손↔손잡이** 최소 ${cm[0]} · 중앙 ${med(cm)} · 최대 ${cm[cm.length - 1]} cm`);
  console.log(`   │   ⇒ ${cm[cm.length - 1] < 0.5 ? '✔ **붙어 있다**(반 밀리도 안 떨어진다)' : '⚠ 아직 벌어져 있다'}`);
  console.log(`   └ 최근 손 자리 이력과의 최소 거리   최소 ${best[0]} · 중앙 ${med(best)} cm`);
  console.log(`   ⇒ 밖에서 잰 ${stat(runs[30], 'nowCm').med} cm 는 **그 사이 손이 더 간 거리**였다.`);
}
{
  const rows = runs[30];
  const tilt = rows.filter(r => Math.abs(r.rotZ) > 0.6);
  const flat = rows.filter(r => Math.abs(r.rotZ) < 0.2);
  const tw = tilt.length ? Math.max(...tilt.map(r => r.nowCm)) : null;
  const fw = flat.length ? Math.max(...flat.map(r => r.nowCm)) : null;
  console.log(`\n   붓는 각 범위: rotZ ${Math.min(...rows.map(r => r.rotZ)).toFixed(3)} ~ ${Math.max(...rows.map(r => r.rotZ)).toFixed(3)}`);
  console.log(`   많이 기운 프레임(|rotZ|>0.6) ${tilt.length}장 최대 ${tw ?? '-'} cm · ` +
              `안 기운 프레임(|rotZ|<0.2) ${flat.length}장 최대 ${fw ?? '-'} cm`);
  console.log(`   ⇒ ${tw != null && fw != null ? (tw <= fw * 2.5 ? '✔ **기울여도 더 안 벌어진다**' : '⛔ 기울면 더 벌어진다') : '(못 갈랐다)'}`);
  const tip = stat(rows, 'tipCm');
  console.log(`   손 뼈 ↔ 주둥이: 중앙 ${tip && tip.med} cm — **붙으면 안 되는 쪽이다.** 물은 여기서 나온다`);
}

/* ── ② 몬스테라를 세운 채로 한 번 더 — 잎 사이에서도 붙어 있나 ── */
console.log(`
── ② 그루가 서 있을 때도 붙어 있나 ──`);
await Ja(`await __W.rv.setPlant('${target}', {kind:'monstera', growthDays:300, seed:92158}).then(()=>true)`);
await sleep(3000);
await page.eval(`window.__ACT2 = __W.rv.actAt('${target}', 'water').catch(e=>String(e&&e.message||e)); 1`, false);
{
  let atShot = null;
  for (let i = 0; i < 200; i++) {
    const r = await J('__W.now()');
    if (r) { atShot = r; if (Math.abs(r.rotZ) > 0.8) break; }
    await sleep(30);
  }
  console.log(`   그루 앞에서: 손↔손잡이 ${atShot && atShot.nowCm} cm · 옛 길이었으면 ${atShot && atShot.oldCm} cm`);
}

await sleep(2500);
console.log(`\n── 페이지 예외 ──`);
console.log(errs.length ? errs.slice(0, 8).map(e => '   ⛔ ' + String(e).split('\n')[0]).join('\n') : '   ✔ 없음');
console.log(`\n사진: docs/handoff/img/cangrip_*.png`);
await page.close();
