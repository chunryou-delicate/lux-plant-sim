/* ============================================================
   tools/probe_cutjar.mjs — **삽수가 유리 수경병으로 보이나** 를 잰다 (2026-08-16)
   ------------------------------------------------------------
   박사님: *"삽수 결과가 … 추가 화분이 생겨버렸네. 저렇게 되면 안 되지.
            **유리수경병으로 보여야지.**"*

     python tools/serve.py 8963
     BYEOT_URL=http://localhost:8963 node tools/probe_cutjar.mjs

   ★ 게임 진행을 흉내내지 않는다. `window.__rv.setPlantAt` 으로 **직접 세워서** 잰다 —
     삽수를 실제로 자르려면 모주가 크고 병을 사고 12일을 넘겨야 하는데, 그 길은
     이 그림이 맞나와 아무 상관이 없다. 재는 자는 짧을수록 거짓말을 덜 한다.

   무엇을 켜고 무엇을 껐나
     · 실제 game.html · 반지하 · **폰 세로 390×844 · dpr 2** (이 저장소의 자다)
     · localStorage 비움 · 프롤로그 대사는 걸어서 넘긴다 · 햇빛은 0.50(한낮)에 못박는다
     · 파일은 한 줄도 안 고친다. 세운 것은 끝에 **전부 걷어낸다**

   재는 것 (박사님이 재라 하신 차례 그대로)
     ⓪ 계약 — `plantKinds().potD` 가 코어의 `CONTAINERS[*].realMaxM` 과 같은가
     ① 세워지나 (던지지 않나) · 모르는 kind 는 **여전히 던지나**
     ② 삼각형·드로우콜이 몇 개 늘었나
     ③ 사진의 **색 가짓수** (§2.9-③ — 새까만 사진은 3색, 멀쩡한 사진은 3,000색이 넘는다)
     ④ `cutpot` 도 같이
     ⑤ 무늬(`variegated:true`)일 때 그림이 **실제로** 달라지나 (화소를 맞대 본다)
     ⑥ 세웠다 지웠다 해도 안 새나
     ⑦ §유리 두 길 — 투명+불투명도 ↔ MeshPhysicalMaterial.transmission 의 렌더 시간
   ⚠ `readPixels` 는 안 쓴다(§2.9-②). 사진을 찍고 색 가짓수로 사진이 멀쩡한지 본다.
============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { launch, sleep } from './test_cdp.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const OUT = path.join(ROOT, 'docs/handoff/img');

/* ── PNG 를 직접 푼다. 이 저장소에는 node_modules 가 없다(probe_stack 과 같은 벌) ── */
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
/* 두 사진이 얼마나 다른가 — 「무늬면 그림이 달라지나」의 자다.
   ⚠ 「달라졌다」를 눈으로 안 보고 말하지 않으려고 **다른 화소의 비율**로 센다.
   ⚠⚠ **방만 본다.** 위쪽 띠에는 튜토리얼 손가락(👉)이 깜빡이고 아래에는 대사창이 있다.
     그것까지 같이 세면 「무늬 때문에 달라졌다」와 「손가락이 움직였다」가 안 갈린다 —
     이 저장소가 열두 번 당한 그 사고다. 세로 22%~82% 띠만 본다. */
const BAND = [0.22, 0.82];
function pixelDiff(a, b) {
  if (a.w !== b.w || a.h !== b.h) return { pct: 100, mean: 255 };
  let n = 0, diff = 0, sum = 0;
  const y0 = Math.round(a.h * BAND[0]), y1 = Math.round(a.h * BAND[1]);
  for (let y = y0; y < y1; y++) for (let x = 0; x < a.w; x++) {
    const i = (y * a.w + x) * a.ch;
    const d = Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1])
            + Math.abs(a.data[i + 2] - b.data[i + 2]);
    n++; sum += d; if (d > 12) diff++;
  }
  return { pct: +(diff / n * 100).toFixed(3), mean: +(sum / n).toFixed(2) };
}

const IM = {};
/* 사진을 찍고 **멀쩡한지** 본다. 까만 사진(3천색 미만)에서 "됐다"고 말하지 않는다(§2.9-③). */
async function shot(page, name) {
  let f = '', colors = 0, im = null;
  for (let i = 0; i < 3; i++) {
    await sleep(1200);
    f = await page.shot(path.join(OUT, name));
    im = decodePNG(fs.readFileSync(f));
    colors = colorCount(im);
    if (colors >= 3000) break;
  }
  IM[name] = im;
  console.log(`   📷 ${name} · 색 가짓수 ${colors}${colors < 3000 ? '  ⛔ 까만 사진이다' : ''}`);
  return colors;
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

/* 프롤로그 대사를 걷는다 — 안 걷으면 사진 절반이 초상화다 */
for (let i = 0; i < 50; i++) {
  const busy = await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');
    return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`);
  if (!busy) break;
  await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s)s.click();
    const b=document.getElementById('dlgBox'); if(b)b.click();
    const g=document.getElementById('guideClose'); if(g)g.click();})()`, false);
  await sleep(250);
}
/* ★★ 시각을 **못 박는다.** ⚠ `setDaylight(0.5)` 한 번으로는 안 된다 —
   game.html 의 평소 시계가 매 프레임 `roomView.setDaylight(dayPhase)` 를 다시 부른다
   (§idleClockStart). 한 번만 부르고 잰 판에서 **바닥 잡음이 0.06% → 3.9% 로 뛰었다**:
   방 밝기가 사진마다 흘러서 「무늬 때문에 달라졌다」와 구별이 안 됐다.
   ⇒ 창구를 통째로 덮어써서 **누가 무엇을 넣든 0.50** 이 되게 한다. 재는 동안만이다. */
await page.eval(`(()=>{ const rv = window.__rv, raw = rv.setDaylight.bind(rv);
  rv.setDaylight = () => raw(0.50); rv.setDaylight(); return true; })()`, false);
await sleep(1200);

/* ── 창구를 한 자리에 심는다 ─────────────────────────────── */
await page.eval(`window.__C = (() => {
  const rv = window.__rv;
  /* renderer.info 는 **마지막으로 그린 프레임**의 값이다 — 반드시 redraw 뒤에 읽는다 */
  const st = () => { rv.redraw(); const s = rv.stats();
                     return { tris: s.triangles, calls: s.calls, plants: s.plants }; };
  const put = async (id, at, spec) => {
    try { const g = await rv.setPlantAt(id, at, spec); return { ok: !!g }; }
    catch (e) { return { ok: false, err: String((e && e.message) || e) }; }
  };
  const drop = (id) => { try { rv.removePlantOf(id); return true; } catch (e) { return String(e.message); } };
  /* 렌더 한 장에 걸리는 시간 — redraw() 가 renderer.render 를 동기로 부른다 */
  const renderMs = (n) => { const t = [];
    for (let i = 0; i < n; i++) { const a = performance.now(); rv.redraw(); t.push(performance.now() - a); }
    t.sort((x, y) => x - y); return +t[Math.floor(n / 2)].toFixed(2); };
  /* §유리 두 길 — 병 유리를 transmission 으로 갈아 끼웠다 되돌린다. **재기용만**이다 */
  const glassMats = () => { const out = [];
    rv.three.scene.traverse(o => { if (!o.isMesh || !o.material) return;
      for (const m of (Array.isArray(o.material) ? o.material : [o.material]))
        if (m && m.userData && m.userData.cutGlass) out.push({ mesh: o, mat: m }); });
    return out; };
  return { rv, st, put, drop, renderMs, glassMats,
           kinds: () => rv.plantKinds(),
           slots: () => rv.slots(),
           focus: (k) => { try { rv.focusSlot(k, true); return true; } catch (e) { return String(e.message); } },
           plants: () => rv.plants().map(p => p.key),
           /* ★ **무엇을 실제로 그렸나.** spec 을 되읽는 게 아니라 장면이 스스로 적어 둔 값이다 */
           drew: (key) => { let out = null;
             rv.three.scene.traverse(o => {
               if (out || !o.userData || o.userData.plantSlotId !== key) return;
               if (o.userData.cut) out = o.userData.cut; });
             return out; } };
})(); 1`, false);

const J = async (e) => JSON.parse(await page.eval(`JSON.stringify(${e})`));
const Ja = async (e) => JSON.parse(await page.eval(`(async()=>JSON.stringify(${e}))()`));

console.log(`\n════ 삽수 그림 재기 · 반지하 · 폰 390×844 dpr2 · 한낮(0.50) ════`);

/* ══ ⓪ 계약 — 방뷰의 지름이 코어의 용기 크기와 같은가 ══════════════════ */
console.log(`\n── ⓪ 계약: plantKinds().potD 와 propagation.CONTAINERS[*].realMaxM ──`);
const core = await Ja(`await (async () => {
  const m = await import('${BASE}/src/game/propagation.js');
  return { jar: m.CONTAINERS.jar.realMaxM, soil: m.CONTAINERS.soil.realMaxM,
           waterMaxLeaves: m.METHODS.water.maxLeaves, potMaxLeaves: m.METHODS.pot.maxLeaves }; })()`);
const kinds = await J('__C.kinds()');
const kmap = Object.fromEntries(kinds.map(k => [k.kind, k]));
const row = (ko, view, coreV) =>
  console.log(`   ${ko.padEnd(14)} 방뷰 ${String(view).padEnd(7)} 코어 ${String(coreV).padEnd(7)} ` +
              `${view === coreV ? '✔ 같다' : '⛔ 갈렸다'}`);
console.log(`   아는 종류: ${kinds.map(k => k.kind).join(', ')}`);
row('cutjar potD', kmap.cutjar && kmap.cutjar.potD, core.jar);
row('cutpot potD', kmap.cutpot && kmap.cutpot.potD, core.soil);
console.log(`   ⚠ 코어의 잎 상한: 물꽂이 ${core.waterMaxLeaves}장 · 흙 ${core.potMaxLeaves === null ? '제한 없음' : core.potMaxLeaves}`);
console.log(`     ⇒ 병(cutjar)에 실제로 오는 잎은 **0~1장**이다. 방뷰가 2장까지 받는 것은 흙 포트 몫이다`);

/* ── 놓을 자리: 방바닥 한가운데 앞쪽. 자리 번호가 없는 곳이라 setPlantAt 이 맞다 ── */
const size = await J('__C.rv.roomSize()');
const AT = (dx) => `{x:${(dx).toFixed(3)}, y:0, z:${(size.d * 0.10).toFixed(3)}}`;
console.log(`\n   방 ${size.w}×${size.d}×${size.h}m · 놓을 자리 z=${(size.d * 0.10).toFixed(2)} 바닥`);

const base = await J('__C.st()');
console.log(`   놓기 전: 삼각형 ${base.tris.toLocaleString()} · 드로우콜 ${base.calls} · 그루 ${base.plants}`);

/* ══ ① 세워지나 ══════════════════════════════════════════════════ */
console.log(`\n── ① 유리 수경병(cutjar) 을 세운다 ──`);
const p1 = await Ja(`await __C.put('cut_jar', ${AT(0)}, ` +
  `{kind:'cutjar', potId:'cut_jar', potD:${core.jar}, leaves:1, rooted:false, variegated:false})`);
console.log(`   setPlantAt → ${p1.ok ? '✔ 섰다' : '⛔ 던졌다: ' + p1.err}`);
const s1 = await J('__C.st()');
console.log(`   ② 삼각형 +${(s1.tris - base.tris).toLocaleString()} · 드로우콜 +${s1.calls - base.calls} · 그루 ${s1.plants}`);
console.log(`   방뷰가 재는 지름: ${await page.eval(`__C.rv.plantDiameter('free:cut_jar')`)} m (한도 ${core.jar})`);

/* ── ④ 포트를 **먼저** 같이 세운다. 방 전체 사진은 카메라를 옮기기 전에 찍어야 한다 ── */
console.log(`\n── ④ 검은 모종포트(cutpot) 를 곁에 세운다 ──`);
const p2 = await Ja(`await __C.put('cut_pot', ${AT(0.42)}, ` +
  `{kind:'cutpot', potId:'cut_pot', potD:${core.soil}, leaves:2, rooted:true, variegated:false})`);
console.log(`   setPlantAt → ${p2.ok ? '✔ 섰다' : '⛔ 던졌다: ' + p2.err}`);
const s2 = await J('__C.st()');
console.log(`   ② 둘 다 섰을 때 삼각형 +${(s2.tris - base.tris).toLocaleString()} · 드로우콜 +${s2.calls - base.calls} · 그루 ${s2.plants}`);
console.log(`   포트 지름: ${await page.eval(`__C.rv.plantDiameter('free:cut_pot')`)} m (한도 ${core.soil})`);
await shot(page, 'cutjar_0_room.png');       // 방 전체 — 카메라를 아직 안 옮겼다

/* ── 여기서부터 카메라를 병에 붙인다. ⚠ **다시는 focus 를 안 부른다** ──
   focusSlot 은 그루의 bbox 로 거리를 정한다. 잎·뿌리가 바뀔 때마다 다시 부르면
   **카메라가 같이 움직여** 「무늬 때문에 달라졌다」와 「카메라가 움직여 달라졌다」가
   구별이 안 된다. 이 저장소가 열두 번 당한 그 사고다(START-HERE §2). */
await page.eval(`__C.focus('free:cut_jar')`, false);
await sleep(900);
await shot(page, 'cutjar_1_jar.png');
/* ★ 바닥 잡음 — **같은 명세로 한 장 더** 찍는다. 캐릭터가 숨 쉬고 그림자가 흔들리는 만큼이
   이 자의 «0» 이다. 이 값보다 큰 차이만 「그림이 바뀌었다」로 읽는다. */
await shot(page, 'cutjar_1b_same.png');
const NOISE = pixelDiff(IM['cutjar_1_jar.png'], IM['cutjar_1b_same.png']);
console.log(`   ★ 바닥 잡음(같은 명세로 두 번 찍기): ${NOISE.pct}% — 이보다 커야 「바뀌었다」다`);

/* ⑤-a 뿌리가 나면 달라지나 ─ 병 속이라 **보여야** 한다 */
console.log(`\n── ⑤-a 뿌리(rooted:true) 로 바꾼다 — 다시 짓나 ──`);
const p1r = await Ja(`await __C.put('cut_jar', ${AT(0)}, ` +
  `{kind:'cutjar', potId:'cut_jar', potD:${core.jar}, leaves:1, rooted:true, variegated:false})`);
console.log(`   setPlantAt → ${p1r.ok ? '✔' : '⛔ ' + p1r.err}`);
await sleep(600);
await shot(page, 'cutjar_2_rooted.png');
{
  const d = pixelDiff(IM['cutjar_1b_same.png'], IM['cutjar_2_rooted.png']);
  console.log(`   뿌리 전·후 화소 차이: ${d.pct}% (잡음 ${NOISE.pct}%)  ` +
              `${d.pct > NOISE.pct * 3 + 0.02 ? '✔ 그림이 바뀌었다' : '⛔ 잡음과 구별이 안 된다'}`);
}

/* ⑤-b 무늬 */
console.log(`\n── ⑤-b 무늬(variegated:true) 로 바꾼다 ──`);
const p1v = await Ja(`await __C.put('cut_jar', ${AT(0)}, ` +
  `{kind:'cutjar', potId:'cut_jar', potD:${core.jar}, leaves:1, rooted:true, variegated:true})`);
console.log(`   setPlantAt → ${p1v.ok ? '✔' : '⛔ ' + p1v.err}`);
await sleep(1500);          // 무늬 잎은 skins/ 라 따로 받아 온다
await shot(page, 'cutjar_3_varie.png');
{
  const d = pixelDiff(IM['cutjar_2_rooted.png'], IM['cutjar_3_varie.png']);
  console.log(`   무늬 전·후 화소 차이: ${d.pct}% (잡음 ${NOISE.pct}%)  ` +
              `${d.pct > NOISE.pct * 3 + 0.02 ? '✔ 무늬가 그림에 나왔다' : '⛔ 잡음과 구별이 안 된다'}`);
}

/* 잎 0·1·2장 — ⚠ **병만 세워 놓고** 잰다. 포트가 같이 서 있으면 그 삼각형까지 섞인다 */
console.log(`\n── ⑤-c 잎 수 0·1·2 (병 하나만 세워 놓고 잰다) ──`);
await page.eval(`__C.drop('cut_pot')`, false);
await page.eval(`__C.drop('cut_jar')`, false);
await sleep(600);
const empty = await J('__C.st()');
console.log(`   아무것도 없을 때: 삼각형 ${empty.tris.toLocaleString()} · 드로우콜 ${empty.calls}`);
for (const n of [0, 1, 2]) {
  const r = await Ja(`await __C.put('cut_jar', ${AT(0)}, ` +
    `{kind:'cutjar', potId:'cut_jar', potD:${core.jar}, leaves:${n}, rooted:true, variegated:false})`);
  await sleep(700);
  const s = await J('__C.st()');
  console.log(`   잎 ${n}장 → ${r.ok ? '✔' : '⛔ ' + r.err} · 병 하나가 더하는 삼각형 ` +
              `+${(s.tris - empty.tris).toLocaleString()} · 드로우콜 +${s.calls - empty.calls}`);
  await page.eval(`__C.drop('cut_jar')`, false);
  await sleep(300);
}
/* 코어가 안 주는 칸 — 조용히 기본값으로 떨어지나. ⚠ **카메라가 아직 병에 있을 때** 잰다 */
{
  const r = await Ja(`await __C.put('cut_jar', ${AT(0)}, {kind:'cutjar', potId:'cut_jar'})`);
  await sleep(700);
  const s = await J('__C.st()');
  console.log(`   spec 이 kind 하나뿐일 때 → ${r.ok ? '✔ 기본값으로 섰다' : '⛔ 던졌다: ' + r.err}` +
              ` · 삼각형 +${(s.tris - empty.tris).toLocaleString()}  (잎 1장 것과 같으면 기본값이 1장이다)`);
}
/* 포트도 혼자 세워 놓고 잰다 — 병 값만 적고 포트 값을 안 적으면 표가 반쪽이다.
   ⚠⚠ **카메라를 포트로 옮기고 그 자리에서 밑값을 다시 잰다.** `renderer.info` 는
     «실제로 그린 것»만 센다 — 화면 밖에 있는 포트를 재면 삼각형이 +2 로 나온다.
     실제로 그렇게 나왔고, 하마터면 「포트는 공짜다」로 적을 뻔했다(§2.9). */
await Ja(`await __C.put('cut_pot', ${AT(0.42)}, {kind:'cutpot', potId:'cut_pot', potD:${core.soil}, leaves:1})`);
await sleep(600);
await page.eval(`__C.focus('free:cut_pot')`, false);
await sleep(900);
await page.eval(`__C.drop('cut_pot')`, false);
await sleep(600);
const emptyPot = await J('__C.st()');
console.log(`   [포트 자리] 아무것도 없을 때: 삼각형 ${emptyPot.tris.toLocaleString()} · 드로우콜 ${emptyPot.calls}`);
for (const n of [1, 2]) {
  await Ja(`await __C.put('cut_pot', ${AT(0.42)}, ` +
    `{kind:'cutpot', potId:'cut_pot', potD:${core.soil}, leaves:${n}, rooted:true, variegated:false})`);
  await sleep(700);
  const s = await J('__C.st()');
  console.log(`   [포트] 잎 ${n}장 → 포트 하나가 더하는 삼각형 +${(s.tris - emptyPot.tris).toLocaleString()} · ` +
              `드로우콜 +${s.calls - emptyPot.calls}`);
  if (n === 1) { await page.eval(`__C.drop('cut_pot')`, false); await sleep(300); }
}

/* ══ ④-b 포트를 가까이서 — 「모종포트로 보이나」를 사람이 눈으로 볼 그림 ══════ */
console.log(`\n── ④-b 모종포트 확대 ──`);
await page.eval(`__C.focus('free:cut_pot')`, false);
await sleep(900);
await shot(page, 'cutjar_4_pot.png');

/* ══ ①-b 모르는 kind 는 **여전히 던지나** — 그 문은 일부러 세운 것이다 ══════ */
console.log(`\n── ①-b 모르는 kind 는 여전히 던지나 ──`);
const bad = await Ja(`await __C.put('cut_bad', ${AT(-0.42)}, {kind:'nosuchkind', potId:'cut_bad'})`);
console.log(`   kind:'nosuchkind' → ${bad.ok ? '⛔ 그냥 섰다(문이 열렸다)' : '✔ 던졌다: ' + bad.err}`);

/* ══ ⑦ §유리 두 길 — 투명+불투명도 ↔ transmission ══════════════════ */
console.log(`\n── ⑦ 유리 두 길: 투명+불투명도 ↔ MeshPhysicalMaterial.transmission ──`);
console.log(`   이 페이지의 three: r${await page.eval(`THREE.REVISION`)}`);
/* ⚠ **카메라를 병으로 되돌린다.** ④-b 에서 포트로 옮겨 놨다 — 그 자리에서 재면
   유리가 화면에 없는 채로 「유리를 쟀다」고 적게 된다. 하마터면 그럴 뻔했다(첫 판이 그랬다). */
await page.eval(`__C.focus('free:cut_jar')`, false);
await sleep(1000);
const glassN = await page.eval(`__C.glassMats().length`);
await shot(page, 'cutjar_6a_blend.png');       // 바꾸기 **전** 사진(같은 카메라)
const msA = await page.eval(`__C.renderMs(25)`);
const callsA = (await J('__C.st()')).calls;
const swapped = await page.eval(`(()=>{
  const THREE = window.THREE; const list = __C.glassMats(); window.__GOLD = [];
  for (const { mesh, mat } of list) {
    const phys = new THREE.MeshPhysicalMaterial({
      color: mat.color ? mat.color.clone() : undefined, transmission: 1, thickness: 0.01,
      roughness: 0.05, metalness: 0, transparent: true, opacity: 1 });
    const arr = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const i = arr.indexOf(mat);
    window.__GOLD.push({ mesh, i, mat, phys, was: Array.isArray(mesh.material) });
    if (Array.isArray(mesh.material)) mesh.material[i] = phys; else mesh.material = phys;
  }
  return list.length; })()`);
await sleep(500);
const msB = await page.eval(`__C.renderMs(25)`);
const callsB = (await J('__C.st()')).calls;
/* ⚠⚠ **바꿔 놓고 사진을 찍는다.** 「바꿨다」와 「화면이 달라졌다」는 다른 말이다 —
   이 저장소가 제일 자주 당한 사고가 그 둘을 섞어 읽은 것이다(START-HERE §2). */
await shot(page, 'cutjar_6_transmission.png');
await page.eval(`(()=>{ for (const g of window.__GOLD) {
  if (g.was) g.mesh.material[g.i] = g.mat; else g.mesh.material = g.mat; g.phys.dispose(); }
  window.__GOLD = []; __C.rv.redraw(); })()`, false);
const msA2 = await page.eval(`__C.renderMs(25)`);
console.log(`   유리 재질 ${glassN}장 · 바꾼 것 ${swapped}장`);
console.log(`   투명+불투명도   렌더 중앙값 ${msA} ms · 드로우콜 ${callsA}   (되돌린 뒤 ${msA2} ms)`);
console.log(`   transmission    렌더 중앙값 ${msB} ms · 드로우콜 ${callsB}   → 시간 ${(msB / msA).toFixed(2)}배 · ` +
            `드로우콜 ${(callsB / callsA).toFixed(2)}배`);
{
  const d = pixelDiff(IM['cutjar_6a_blend.png'], IM['cutjar_6_transmission.png']);
  console.log(`   화면이 달라졌나: 화소 차이 ${d.pct}% (잡음 ${NOISE.pct}%)  ` +
              `${d.pct > NOISE.pct * 3 + 0.02 ? '달라졌다' : '⛔ **안 달라졌다**'}`);
}
console.log(`   ★ **드로우콜이 자다** — 시간은 SwiftShader라 폰과 다르지만 콜 수는 GPU와 무관하다.`);

/* ══ ⑧ ★★ 자른 그 가지를 그대로 담나 (2026-08-16 저녁) ════════════════════════ */
console.log(`\n══ ⑧ 「자른 그 가지 그대로」 ══════════════════════════════════`);

/* ⑧-0 파일 이름 규약 — 등급표(varie_grades.json)와 plant_grow 의 ASSET_FILES 가 **같은 짝**인가.
   방뷰는 이 규약으로 등급을 파일로 푼다. 깨지면 무늬 잎이 조용히 기본잎으로 내려앉는다. */
{
  const r = await Ja(`await (async () => {
    const vg = await (await fetch('${BASE}/data/balance/varie_grades.json')).json();
    const html = await (await fetch('${BASE}/plant_grow.html')).text();
    const mat = {}, mid = {};
    for (const m of html.matchAll(/leaf_mat(\\d+):'([^']+)'/g)) if (m[2].endsWith('.glb')) mat[m[1]] = m[2];
    for (const m of html.matchAll(/leaf_mid_albo(\\d+):'([^']+)'/g)) if (m[2].endsWith('.glb')) mid[m[1]] = m[2];
    const sfx = ['', '_v1', '_v2'];
    let okM = 0, okD = 0; const bad = [];
    for (const g of (vg.grades || [])) {
      for (const a of (g.assets || [])) sfx.forEach((s, k) => {
        const got = mat[String(a.matNum + k)], want = 'skins/mon_' + a.id + s + '.glb';
        if (got === want) okM++; else bad.push(a.id + s + ' → ' + got); });
      for (const a of (g.midAssets || [])) (a.midNums || []).forEach((n, k) => {
        const got = mid[String(n)], want = 'skins/' + a.id + (sfx[k] || '') + '.glb';
        if (got === want) okD++; else bad.push(a.id + (sfx[k] || '') + ' → ' + got); });
    }
    return { okM, okD, bad: bad.slice(0, 6), n: bad.length };
  })()`);
  console.log(`\n── ⑧-0 등급표 ↔ plant_grow 파일 이름 규약 ──`);
  console.log(`   성숙잎 ${r.okM}/${r.okM + r.bad.filter(x => x.startsWith('mon')).length || r.okM} · 중간잎 ${r.okD} · ` +
              `어긋난 것 ${r.n}  ${r.n === 0 ? '✔ 규약이 산다' : '⛔ 규약이 깨졌다: ' + r.bad.join(' / ')}`);
}

/* ⑧-1 등급을 바꿔 가며 세운다 — 하프문과 민무늬가 다른 그림인가 */
const put1 = (extra) => Ja(`await __C.put('cut_jar', ${AT(0)}, ` +
  `{kind:'cutjar', potId:'cut_jar', potD:${core.jar}, rooted:true, ${extra}})`);
await page.eval(`__C.drop('cut_pot')`, false);
await page.eval(`__C.focus('free:cut_jar')`, false);
await sleep(400);

console.log(`\n── ⑧-1 잎 한 장: 민무늬 ↔ 하프문 ↔ 산반 ──`);
const grades = [
  ['plain',    `leafVarie:[false], leafGrades:[null]`],
  ['halfmoon', `leafVarie:[true],  leafGrades:['halfmoon']`],
  ['sanban',   `leafVarie:[true],  leafGrades:['sanban']`]
];
const gshots = {};
for (const [ko, spec] of grades) {
  const r = await put1(spec);
  await sleep(1600);                       // skins/ 는 그때그때 받아 온다
  const drew = await J(`__C.drew('free:cut_jar')`);
  const f = `cutjar_8_${ko}.png`;
  await shot(page, f); gshots[ko] = f;
  console.log(`   ${ko.padEnd(9)} → ${r.ok ? '✔' : '⛔ ' + r.err} · 그린 잎 ${drew && drew.leaves} · ` +
              `그림 ${drew && (drew.files || []).map(x => String(x).split('/').pop()).join(', ')}`);
}
for (const [a, b] of [['plain', 'halfmoon'], ['plain', 'sanban'], ['halfmoon', 'sanban']]) {
  const d = pixelDiff(IM[gshots[a]], IM[gshots[b]]);
  console.log(`   ${a} ↔ ${b}: 화소 차이 ${d.pct}% (잡음 ${NOISE.pct}%)  ` +
              `${d.pct > NOISE.pct * 3 + 0.02 ? '✔ 다른 그림이다' : '⛔ 같은 그림이다'}`);
}

/* ⑧-2 잎 두 장 — 자리마다 다른 잎인가 · 실제로 두 장 서는가 */
console.log(`\n── ⑧-2 잎 두 장 (아래 민무늬 · 위 풀문) ──`);
{
  const r = await put1(`leafVarie:[false,true], leafGrades:[null,'fullmoon'], leafSkins:[null,'leaf_mat55']`);
  await sleep(1800);
  const drew = await J(`__C.drew('free:cut_jar')`);
  await shot(page, 'cutjar_8_two.png');
  console.log(`   ${r.ok ? '✔ 섰다' : '⛔ ' + r.err} · 그린 잎 **${drew && drew.leaves}장** (정본 ${drew && drew.leavesTrue}장)`);
  console.log(`   그림: ${drew && (drew.files || []).map(x => String(x).split('/').pop()).join('  |  ')}`);
  console.log(`   ⇒ 위 잎만 무늬 그림이면 **자리마다 다른 잎**이다`);
  const d = pixelDiff(IM[gshots.plain], IM['cutjar_8_two.png']);
  console.log(`   한 장(민무늬) ↔ 두 장: 화소 차이 ${d.pct}%  ${d.pct > NOISE.pct * 3 + 0.02 ? '✔ 달라졌다' : '⛔ 그대로다'}`);
}

/* ⑧-3 줄기 굵기 */
console.log(`\n── ⑧-3 줄기(source.stem) 가 굵기를 바꾸나 ──`);
for (const s of ['pink', 'thick', 'main', null]) {
  await put1(`leafVarie:[false]${s ? `, stem:'${s}'` : ''}`);
  await sleep(500);
  const drew = await J(`__C.drew('free:cut_jar')`);
  console.log(`   stem ${String(s).padEnd(6)} → 줄기 반지름 ${drew && drew.stemR} m${s ? '' : '  (안 주면 thick 과 같다)'}`);
}

/* ⑧-4 옛 세이브처럼 칸이 없을 때 · 이상한 값일 때 — 안 던지나 */
console.log(`\n── ⑧-4 칸이 없거나 이상해도 안 던지나 (옛 세이브) ──`);
const odd = [
  ['칸이 아예 없다',            `{kind:'cutjar', potId:'cut_jar'}`],
  ['옛 길 (leaves+variegated)', `{kind:'cutjar', potId:'cut_jar', leaves:2, variegated:true}`],
  ['leafVarie 만 있다',         `{kind:'cutjar', potId:'cut_jar', leafVarie:[true,false]}`],
  ['모르는 등급',               `{kind:'cutjar', potId:'cut_jar', leafVarie:[true], leafGrades:['nosuchgrade']}`],
  ['모르는 그림 열쇠',          `{kind:'cutjar', potId:'cut_jar', leafVarie:[true], leafSkins:['leaf_mat999']}`],
  ['배열 길이가 안 맞다',       `{kind:'cutjar', potId:'cut_jar', leafVarie:[true,true,true], leafGrades:['halfmoon']}`],
  ['leafVarie 가 빈 배열',      `{kind:'cutjar', potId:'cut_jar', leafVarie:[]}`],
  ['배열이 아니라 숫자',        `{kind:'cutjar', potId:'cut_jar', leafVarie:3, leafGrades:'halfmoon'}`],
  ['잎이 상한을 넘는다(8장)',   `{kind:'cutjar', potId:'cut_jar', leafVarie:[0,0,0,0,0,0,0,1].map(Boolean)}`]
];
for (const [ko, spec] of odd) {
  const r = await Ja(`await __C.put('cut_jar', ${AT(0)}, ${spec})`);
  await sleep(900);
  const drew = await J(`__C.drew('free:cut_jar')`);
  console.log(`   ${ko.padEnd(24)} → ${r.ok ? '✔ 섰다' : '⛔ 던졌다: ' + r.err}` +
              (drew ? ` · 그린 잎 ${drew.leaves}장 (정본 ${drew.leavesTrue}장)` +
                      (drew.leavesTrue > drew.leaves ? '  ⚠ 화면이 덜 그렸다' : '') : ''));
}

/* ══ ⑥ 세웠다 지웠다 해도 안 새나 ═══════════════════════════════ */
console.log(`\n── ⑥ 12번 세웠다 지운다 (샘) ──`);
await page.eval(`__C.drop('cut_jar')`, false);
await page.eval(`__C.drop('cut_pot')`, false);
await sleep(600);
const clean0 = await J('__C.st()');
console.log(`   전부 걷은 뒤: 삼각형 ${clean0.tris.toLocaleString()} · 드로우콜 ${clean0.calls} · 그루 ${clean0.plants}` +
            `  (놓기 전 ${base.tris.toLocaleString()} · ${base.calls} · ${base.plants})`);
for (let i = 0; i < 12; i++) {
  await Ja(`await __C.put('cut_loop', ${AT(0)}, ` +
    `{kind:${i % 2 ? "'cutpot'" : "'cutjar'"}, potId:'cut_loop', leaves:${i % 3}, ` +
    `rooted:${i % 2 === 0}, variegated:${i % 4 === 0}})`);
  await page.eval(`__C.drop('cut_loop')`, false);
}
await sleep(900);
const clean1 = await J('__C.st()');
const keys = await J('__C.plants()');
console.log(`   12바퀴 뒤: 삼각형 ${clean1.tris.toLocaleString()} · 드로우콜 ${clean1.calls} · 그루 ${clean1.plants}`);
console.log(`   ${clean1.tris === clean0.tris && clean1.calls === clean0.calls && clean1.plants === clean0.plants
  ? '✔ 한 개도 안 남았다' : '⛔ 뭔가 남았다'} · 남은 열쇠: ${keys.join(', ') || '없음'}`);

/* ══ 예외 ══════════════════════════════════════════════════════ */
console.log(`\n── 페이지 예외 ──`);
console.log(errs.length ? errs.slice(0, 8).map(e => '   ⛔ ' + String(e).split('\n')[0]).join('\n')
                        : '   ✔ 없음');

console.log(`\n사진: docs/handoff/img/cutjar_*.png`);
await page.close();
