/* ============================================================
   tools/probe_stack2.mjs — 가구를 **두 겹으로** 쌓아 본다 (G-13)
   ------------------------------------------------------------
   박사님: *"가구 **2단 쌓는 것**도 완료했어?"* · *"**빛 분포도 같이 적용되게** 해줘."*

   앞 창(G-12 · probe_stack.mjs)은 **한 겹**까지 열고 두 겹은 「못 했다」로 남겼다.
   그 자를 물려받되 **사슬이 길어질 때만 틀리던 것**을 재는 걸음을 새로 넣는다.

   ★★ 이 자가 방을 **둘** 도는 까닭 — 반지하만으로는 두 겹을 못 잰다
     반지하 천장은 2.30m 다. 그런데 이 방에서 상판이 될 수 있는 가구의 키가
     책상 0.74 · 서랍장 0.80 · 선반 0.794 · 의자 0.89 · 침대 0.94 라,
     **제일 낮은 둘을 겹쳐도 1.534m** 고 남는 머리는 0.766m 다 — 그보다 낮은 가구가
     이 방에 **하나도 없다.** 즉 반지하에서 두 겹은 **코드가 아니라 천장이 막는다.**
     ⇒ ㉮ 반지하에서는 한 겹 + **막히는 까닭**을 재고(빛 분포는 여기서 다 잰다)
        ㉯ 온실(천장 2.80m)에서 **세 겹 사슬**을 실제로 세워 사슬 코드를 잰다.

   재는 것 (박사님이 재라 하신 차례)
     ① 실제로 쌓는다 — 겹마다 y 를 숫자로
     ② 맨 밑을 옮기면 위가 다 따라오나 — 전·후 x·y·z
     ③ 가운데만 따로 옮길 수 있나(갇히지 않나) · 그 위도 같이 오나
     ④ 껐다 켜도 그대로인가 (세이브 왕복 · **손가락 손짓으로 올린 뒤**)
     ⑤ 고리를 만들 수 있나 — A 위 B, B 위 A 가 막히는가
     ⑥ 조도가 따라오나 — 맨 위 표면 DLI 를 전·후로
     ⑦ 빛 분포 겹쳐 보기 — 맨 위 상판을 집나 · 화면 값 == 엔진 값 · 옮기면 따라오나
        · 자기 밑동 그림자에 덮이지 않나(occIdx)
     ⑧ 사진 — **색 가짓수**로 까만 사진을 가른다(START-HERE §2.9-③)

   무엇을 켜고 무엇을 껐나
     · 실제 game.html · 등 0개(자연광만) · 맑음·여름 · localStorage 비움
     · `novice` 로만 도므로 **peak 이 곧 그날 값**이다(§2.9 ④)
     · 프롤로그 대사를 걷고 **시각을 한낮 0.50 에 못 박는다** — 새벽엔 방이 캄캄하다
     · 파일은 한 줄도 안 고친다
============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { launch, sleep } from './test_cdp.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const OUT = path.join(ROOT, 'docs/handoff/img');

/* ── PNG 색 가짓수 (probe_stack.mjs 와 같은 자) ─────────────── */
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
async function shot(page, name) {
  let f = '', colors = 0;
  for (let i = 0; i < 3; i++) {
    await sleep(1200);
    f = await page.shot(path.join(OUT, name));
    colors = colorCount(decodePNG(fs.readFileSync(f)));
    if (colors >= 3000) break;
  }
  console.log(`   사진 ${name} · 색 가짓수 ${colors}${colors < 3000 ? '  ⛔ 까만 사진이다' : '  ✔'}`);
  return colors;
}

const P = (n, k = 2) => (n == null || Number.isNaN(n) ? ' null' : (+n).toFixed(k));
const REC = {};

/* ── 방뷰·조도 창구를 한 자리에 심는 조각 (다시 켠 뒤에도 같은 것을 쓴다) ── */
const INJECT = `window.__P = (()=>{
  const rv = window.__rv, L = window.__io.light;
  const SKY = { weather:'clear', season:'summer', lampCount:0, litHours:12 };
  const furn = () => rv.furniture().map(f=>({uid:f.uid,name:f.name,x:f.x,y:f.y,z:f.z,rot:f.rot,
                                             w:f.size.w,d:f.size.d,h:+(f.size.h??0).toFixed(3)}));
  const riders = () => { const m={}; for (const f of rv.furniture()) { const r=rv.ridersOf(f.uid);
                          if (r.length) m[f.uid]=r; } return m; };
  const dli = () => { const m={}; for (const s of L.room.slots)
      m[s.slotId] = { y:+(s.y??0).toFixed(3), dli:+L.dliOfSlot(s.slotId, SKY).toFixed(2) }; return m; };
  /* 그 지점의 표면 + 그 표면에서 잰 DLI — 화면(빛분포)이 쓰는 그 길 그대로다 */
  const surf = (x,z) => { const s = rv.surfaceTopAt(x,z);
    return { y:s.y, onUid:s.onUid, occIdx:s.occIdx,
             dli:+L.dliAt({x, y:s.y, z}, {...SKY, occIdx:s.occIdx}).dli.toFixed(3) }; };
  /* 그 지점을 품는 빛분포 칸 + **그 칸 한가운데에서 엔진에 직접 물은 값**(같은 점에서 견주려고) */
  const cellAt = (x,z) => { const cs = rv.lightHeatmapCells(); let best=null, bd=1e9;
    for (const c of cs) { const d=(c.x-x)*(c.x-x)+(c.z-z)*(c.z-z); if (d<bd){bd=d;best=c;} }
    if (!best) return null;
    const s = rv.surfaceTopAt(best.x, best.z);
    return { x:+best.x.toFixed(3), z:+best.z.toFixed(3), y:best.y==null?null:+best.y.toFixed(3),
             onUid:best.onUid??null, value:best.value==null?null:+best.value.toFixed(3),
             engine:+L.dliAt({x:best.x,y:s.y,z:best.z},{...SKY,occIdx:s.occIdx}).dli.toFixed(3),
             surfY:s.y, surfOn:s.onUid, occIdx:s.occIdx, dist:+Math.sqrt(bd).toFixed(3) }; };
  /* 그 점에서 occIdx 를 바꿔 가며 재기 — 자기 그림자에 덮이나 보는 자 */
  const occTest = (x,y,z,idxs) => idxs.map(i =>
    ({ occIdx:i, dli:+L.dliAt({x,y,z}, {...SKY, occIdx:i}).dli.toFixed(3) }));
  /* 그 가구가 **바닥에 설 수 있는** 빈 자리를 찾는다 — 자리를 짐작해서 「못 옮겼다」로
     오독하지 않으려고 둔다(§2.9 ①: 안 나온 것을 「없다」로 읽지 않는다). */
  const findSpot = (uid, minAway) => {
    const g = rv.furniture().find(f=>f.uid===uid); if (!g) return null;
    const s = rv.roomSize();
    for (let x = -s.w/2+0.5; x <= s.w/2-0.5; x += 0.25)
      for (let z = -s.d/2+0.5; z <= s.d/2-0.5; z += 0.25) {
        if (Math.hypot(x-g.x, z-g.z) < (minAway||1.5)) continue;
        let sn; try { sn = rv.snapFurniture(uid, {x, z, rot:0, step:0.125}); } catch { continue; }
        if (sn.on) continue;                       // 바닥에 서는 자리만 (다른 가구 위는 이 자의 몫이 아니다)
        const f = rv.furnitureFit(uid, {x:sn.x, z:sn.z, rot:sn.rot, y:0});
        if (f.ok) return { x:sn.x, z:sn.z };
      }
    return null;
  };
  return { rv, L, SKY, furn, riders, dli, surf, cellAt, occTest, findSpot,
           snap:(uid,p)=>{ try{ return rv.snapFurniture(uid,p); }catch(e){ return {err:e.message}; } },
           fit:(uid,p)=>{ try{ return rv.furnitureFit(uid,p); }catch(e){ return {ok:false,reason:e.message}; } },
           move: async (uid,p)=>{ try{ const r = await rv.commitFurnitureAt(uid,p); L.clearCache();
                                       return {ok:true, ...r}; }
                                  catch(e){ return {ok:false, reason:e.message}; } } };
})(); 1`;

async function boot(page) {
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
  /* ⚠ 새벽에는 방이 캄캄하다 — 해가 든 뒤에 찍는다(한낮 0.50 에 못 박는다) */
  await page.eval(`window.__rv.setDaylight(0.50)`, false);
  await sleep(1500);
  await page.eval(INJECT, false);
}

const page = await launch({ width: 900, height: 760, dpr: 1, mobile: false });
await page.goto(`${BASE}/game.html`);
await page.eval(`localStorage.clear()`, false);
await page.goto(`${BASE}/game.html`);
await boot(page);

const J = async (e) => JSON.parse(await page.eval(`JSON.stringify(${e})`));
const Ja = async (e) => JSON.parse(await page.eval(`(async()=>JSON.stringify(${e}))()`));

/* ════════════════════════════════════════════════════════════
   PART A — 반지하 (정본 방). 빛 분포는 전부 여기서 잰다
   ════════════════════════════════════════════════════════════ */
const furn0 = await J('__P.furn()');
const CEIL = (await J('__P.rv.roomSize()')).h;
console.log(`\n████ PART A — 반지하 · 등 0개(자연광만) · 맑음·여름 · 한낮 0.50 · 천장 ${CEIL}m ████`);
console.log(`\n[A-0 가구] 옮길 수 있는 것 ${furn0.length}개`);
for (const f of furn0)
  console.log(`  ${f.uid.padEnd(20)} (${P(f.x)}, ${P(f.y)}, ${P(f.z)})  ${f.w}×${f.d}  키 ${f.h}  rot ${f.rot}`);
const ridersBefore = await J('__P.riders()');
console.log(`  ridersOf (정본: banjiha-desk → banjiha-growlight-clip 하나뿐)`);
for (const [u, r] of Object.entries(ridersBefore)) console.log(`    ${u} → ${r.join(', ')}`);
REC.A_furn0 = furn0; REC.A_ridersBefore = ridersBefore; REC.ceil = CEIL;
const D = u => furn0.find(f => f.uid === u);
const desk = D('banjiha-desk');
await shot(page, 'stack2_a0_before.png');

/* ── A-1 한 겹: 서랍장을 책상 위로 ─────────────────────────── */
console.log(`\n── A-1 서랍장을 책상 위로 (한 겹) ──`);
const snA = await J(`__P.snap('banjiha-dresser', {x:${desk.x}, z:${desk.z}, rot:0, step:0.125})`);
console.log(`   snap → y ${P(snA.y, 3)} · 받침 ${snA.on}`);
const mvA = await Ja(`await __P.move('banjiha-dresser', {x:${desk.x}, z:${desk.z}, rot:0, step:0.125})`);
console.log(`   commit → ${mvA.ok ? `올라갔다 y ${P(mvA.to.y, 3)}` : `⛔ ${mvA.reason}`}`);
const towerA = await J('__P.furn()');
const TA = u => towerA.find(f => f.uid === u);
console.log(`   책상 y ${P(TA('banjiha-desk').y, 3)} (윗면 ${P(TA('banjiha-desk').y + TA('banjiha-desk').h, 3)})` +
            ` · 서랍장 y ${P(TA('banjiha-dresser').y, 3)} (윗면 ${P(TA('banjiha-dresser').y + TA('banjiha-dresser').h, 3)})`);
REC.A_snapDresser = snA; REC.A_moveDresser = mvA; REC.A_tower = towerA;

/* ── A-2 ★ 두 겹은 왜 안 되나 — **올려 놓은 가구가 상판이 되기는 하는가**부터 ── */
console.log(`\n── A-2 그 위에 또 올린다 — 상판은 잡히나 · 무엇이 막나 ──`);
const rows = [];
for (const u of ['banjiha-chair', 'banjiha-etagere', 'banjiha-bed']) {
  const sn = await J(`__P.snap('${u}', {x:${desk.x}, z:${desk.z}, rot:0, step:0.125})`);
  const fit = sn.err ? { ok: false, reason: sn.err }
    : await J(`__P.fit('${u}', {x:${sn.x}, z:${sn.z}, rot:${sn.rot}, y:${sn.y}})`);
  rows.push({ uid: u, h: D(u).h, snapY: sn.y, on: sn.on, ok: fit.ok, reason: fit.reason });
  console.log(`   ${u.padEnd(20)} 키 ${D(u).h}  → snap y ${P(sn.y, 3)} · 받침 ${sn.on}` +
              `  ${fit.ok ? '✔ 올라간다' : `⛔ ${fit.reason}`}`);
}
/* ⚠ 침대는 발자국(1×2)이 서랍장 상판(1×0.5)의 60%를 못 채워 애초에 「얹힐 수 없는」 것이다
     (SUPPORT_MIN · G-12 가 남긴 값). 상판 규칙이 두 겹을 여는지는 **얹힐 수 있는 것**으로 센다. */
const fits = rows.filter(r => r.uid !== 'banjiha-bed');
const gotStacked = fits.filter(r => r.on === 'banjiha-dresser').length;
console.log(`   ⇒ **올려 놓은 서랍장을 상판으로 잡은 것 ${gotStacked}/${fits.length}개**` +
            `  ${gotStacked === fits.length ? '✔ **상판 규칙이 두 겹을 연다**(예전엔 바닥에 선 가구만 상판이었다)' : '⛔ 상판이 안 잡힌다'}`);
console.log(`      (침대는 발자국 1×2 라 상판 1×0.5 의 60%를 못 채운다 — 받침 ${rows.find(r => r.uid === 'banjiha-bed').on})`);
console.log(`   ⇒ 막는 것은 **천장**이다 — 서랍장 윗면 ${P(TA('banjiha-dresser').y + TA('banjiha-dresser').h, 3)}m 위로` +
            ` 남는 머리 ${P(CEIL - (TA('banjiha-dresser').y + TA('banjiha-dresser').h), 3)}m,` +
            ` 이 방에서 제일 낮은 가구가 ${Math.min(...furn0.map(f => f.h))}m 다`);
REC.A_second = rows;

/* ── A-3 고리 ─────────────────────────────────────────────── */
console.log(`\n── A-3 고리(cycle) — 「서랍장 위 책상」을 시도한다(책상이 서랍장을 이고 있다) ──`);
const dr = TA('banjiha-dresser');
const drTop = +(dr.y + dr.h).toFixed(4);
const cyc = await J(`(()=>({
  snap: __P.snap('banjiha-desk', {x:${dr.x}, z:${dr.z}, rot:90, step:0.125}),
  fit : __P.fit ('banjiha-desk', {x:${dr.x}, z:${dr.z}, rot:90, y:${drTop}}) }))()`);
console.log(`   서랍장 윗면 ${P(drTop, 3)}m 에 **자기를 이고 있는** 책상을 올리려 하면`);
console.log(`     snap → y ${P(cyc.snap.y, 3)} · 받침 ${cyc.snap.on}` +
            `  ${cyc.snap.on === 'banjiha-dresser' ? '⛔ 자기 위 서랍장을 골랐다 = 고리' : '✔ 자기 탑은 상판이 안 된다'}`);
console.log(`     fit  → ${cyc.fit.ok ? '⛔ 통과했다 = 고리가 난다' : `✔ 막혔다: 「${cyc.fit.reason}」`}`);
const cycMv = await Ja(`await __P.move('banjiha-desk', {x:${dr.x}, z:${dr.z}, rot:90, y:${drTop}, grid:false})`);
console.log(`     밀어붙이면 → ${cycMv.ok ? '⛔ 올라갔다' : `✔ 거절: 「${cycMv.reason}」`}`);
REC.A_cycle = { drTop, ...cyc, move: cycMv };

/* ── A-4 ★ 빛 분포를 켜고 잰다 ─────────────────────────────── */
console.log(`\n── A-4 빛 분포 겹쳐 보기 — 얹힌 상판이 나오나 ──`);
await J(`__P.rv.setLightHeatmap(true, {weather:'clear', season:'summer', lampCount:0, litHours:12})`);
await sleep(1500);
const AX = TA('banjiha-dresser').x, AZ = TA('banjiha-dresser').z;
const cA = await J(`__P.cellAt(${AX}, ${AZ})`);
console.log(`   탑 한가운데 (${P(AX)}, ${P(AZ)}) 의 칸 (${P(cA.x)}, ${P(cA.z)})`);
console.log(`     칸: y ${P(cA.y, 3)} · onUid ${cA.onUid} · 값 ${P(cA.value, 3)}`);
console.log(`     그 칸 한가운데를 엔진에 직접 물으면: 표면 y ${P(cA.surfY, 3)} · onUid ${cA.surfOn}` +
            ` · occIdx ${cA.occIdx} · DLI ${P(cA.engine, 3)}`);
console.log(`     ⇒ 맨 위를 집었나: ${cA.onUid === 'banjiha-dresser' ? '✔ 서랍장(얹힌 것)' : `⛔ ${cA.onUid}`}` +
            `  · 화면 값 == 엔진 값: ${Math.abs(cA.value - cA.engine) < 0.005 ? '✔ 같다' : `⛔ ${P(cA.value, 3)} ≠ ${P(cA.engine, 3)}`}`);
/* 자기 그림자 — occIdx 를 바꿔 가며 */
const deskIdx = (await J(`__P.surf(${desk.x}, ${desk.z + 0.0})`)).occIdx;
const occ = await J(`__P.occTest(${cA.x}, ${cA.surfY}, ${cA.z}, [${cA.occIdx}, null, ${deskIdx}])`);
console.log(`     [자기 그림자] 같은 점에서 occIdx 만 바꿔 재면`);
for (const o of occ) console.log(`       occIdx ${String(o.occIdx).padEnd(6)} → DLI ${P(o.dli, 3)}`);
console.log(`       ⇒ ${Math.abs(occ[0].dli - occ[1].dli) < 0.005
  ? '✔ **밑에 깔린 책상은 맨 위 상판을 안 가린다** (빼나 마나 같다 — 뺄 것이 하나면 된다)'
  : '⚠ occIdx 를 바꾸면 값이 달라진다 — 밑동 그림자가 낀다'}`);
/* 높이별 — 같은 x·z 에서 바닥 / 책상 위 / 서랍장 위 */
const byH = await J(`(()=>{ const L=__P.L,S=__P.SKY,x=${cA.x},z=${cA.z};
  const d=(y,o)=>+L.dliAt({x,y,z},{...S,occIdx:o}).dli.toFixed(3);
  return { floor:d(0,null), one:d(${P(TA('banjiha-desk').y + TA('banjiha-desk').h, 4)}, ${deskIdx}),
           two:d(${P(cA.surfY, 4)}, ${cA.occIdx}) }; })()`);
console.log(`     [높이별] 같은 칸에서 — 바닥 ${P(byH.floor, 3)} · 책상 윗면 ${P(byH.one, 3)} · **서랍장 윗면 ${P(byH.two, 3)}**`);
REC.A_heat = { cell: cA, occ, byH, deskIdx };
await shot(page, 'stack2_a1_heatmap.png');

/* ── A-5 맨 밑(책상)을 창 밑으로 — 위가 따라오나 · 빛 분포가 따라오나 ── */
console.log(`\n── A-5 맨 밑(책상)을 창 밑으로 옮긴다 ──`);
const away = await Ja(`await __P.move('banjiha-etagere', {x:0.75, z:1.5, rot:0, step:0.125})`);
console.log(`   창 밑을 비운다 — 3단 선반 → ${away.ok ? `(${P(away.to.x)}, ${P(away.to.z)})` : `⛔ ${away.reason}`}`);
const beforeMv = await J('__P.furn()');
const cellOldBefore = await J(`__P.cellAt(${AX}, ${AZ})`);
const mvB = await Ja(`await __P.move('banjiha-desk', {x:-0.375, z:-1.625, rot:0, step:0.125})`);
await sleep(1500);
const afterMv = await J('__P.furn()');
console.log(`   책상 → ${mvB.ok ? `ok · 같이 간 것 [${mvB.riders.join(', ')}]` : `⛔ ${mvB.reason}`}`);
console.log(`   ${'가구'.padEnd(20)}${'전 (x, y, z)'.padStart(26)}${'후 (x, y, z)'.padStart(26)}   Δ`);
const dRef = {};
for (const u of ['banjiha-desk', 'banjiha-dresser']) {
  const a = beforeMv.find(f => f.uid === u), b = afterMv.find(f => f.uid === u);
  const d = { dx: +(b.x - a.x).toFixed(3), dy: +(b.y - a.y).toFixed(3), dz: +(b.z - a.z).toFixed(3) };
  dRef[u] = d;
  console.log(`   ${u.padEnd(20)}${`(${P(a.x)}, ${P(a.y, 3)}, ${P(a.z)})`.padStart(26)}` +
              `${`(${P(b.x)}, ${P(b.y, 3)}, ${P(b.z)})`.padStart(26)}   (${d.dx}, ${d.dy}, ${d.dz})`);
}
const clipMoved = mvB.ok && mvB.riders.includes('banjiha-growlight-clip');
const followsA = Math.abs(dRef['banjiha-dresser'].dx - dRef['banjiha-desk'].dx) < 0.002
  && Math.abs(dRef['banjiha-dresser'].dz - dRef['banjiha-desk'].dz) < 0.002
  && Math.abs(dRef['banjiha-dresser'].dy) < 0.002;
console.log(`   ⇒ ${followsA ? '✔ 얹힌 서랍장이 그대로 따라왔다' : '⛔ 어긋났다'}` +
            ` · 집게등도 ${clipMoved ? '✔ 따라왔다' : '⛔ 안 왔다'}`);
const BX = afterMv.find(f => f.uid === 'banjiha-dresser').x, BZ = afterMv.find(f => f.uid === 'banjiha-dresser').z;
const cAfter = await J(`__P.cellAt(${BX}, ${BZ})`);
const cOldNow = await J(`__P.cellAt(${AX}, ${AZ})`);
console.log(`\n   [빛 분포] 전·후`);
console.log(`     옮기기 전  새 자리 칸 없음 / 옛 자리 (${P(AX)}, ${P(AZ)}) → y ${P(cellOldBefore.y, 3)} · onUid ${cellOldBefore.onUid} · 값 ${P(cellOldBefore.value, 3)}`);
console.log(`     옮긴 뒤    새 자리 (${P(BX)}, ${P(BZ)}) → y ${P(cAfter.y, 3)} · onUid ${cAfter.onUid} · 값 ${P(cAfter.value, 3)} (엔진 ${P(cAfter.engine, 3)})`);
console.log(`     옮긴 뒤    옛 자리 (${P(AX)}, ${P(AZ)}) → y ${P(cOldNow.y, 3)} · onUid ${cOldNow.onUid} · 값 ${P(cOldNow.value, 3)}` +
            `  ${cOldNow.onUid == null ? '✔ 바닥으로 돌아갔다' : `⚠ 아직 ${cOldNow.onUid} 라고 한다`}`);
console.log(`     ⇒ 값이 ${P(cellOldBefore.value, 3)} → ${P(cAfter.value, 3)}` +
            ` (창 쪽으로 가서 ×${cellOldBefore.value ? (cAfter.value / cellOldBefore.value).toFixed(1) : '?'})` +
            `  · 화면==엔진 ${Math.abs(cAfter.value - cAfter.engine) < 0.005 ? '✔' : '⛔'}`);
const sill = (await J('__P.dli()'))['banjiha-sill:0'];
console.log(`     창턱 banjiha-sill:0 = ${P(sill.dli)} · 두 겹 위 ${P(cAfter.value, 2)} = 창턱의 ${Math.round(cAfter.value / sill.dli * 100)}%`);
REC.A_moveBottom = { mvB, before: beforeMv, after: afterMv, followsA, clipMoved,
                     cellOldBefore, cAfter, cOldNow, sill };
await shot(page, 'stack2_a2_moved_window.png');

/* ── A-6 얹힌 것만 따로 옮기기 ─────────────────────────────── */
console.log(`\n── A-6 얹힌 서랍장만 따로 옮긴다 — 갇히지 않았나 ──`);
const inList = afterMv.find(f => f.uid === 'banjiha-dresser');
console.log(`   가구 목록에 남아 있나: ${inList ? `✔ 그렇다 (y ${P(inList.y, 3)})` : '⛔ 사라졌다 = 갇혔다'}`);
const mvC = await Ja(`await __P.move('banjiha-dresser', {x:1.4, z:1.0, rot:0, step:0.125})`);
await sleep(1000);
const afterC = await J('__P.furn()');
console.log(`   서랍장만 바닥(1.4, 1.0)으로 → ${mvC.ok ? `✔ 내려왔다 y ${P(mvC.to.y, 3)}` : `⛔ ${mvC.reason}`}`);
const deskStill = afterC.find(f => f.uid === 'banjiha-desk');
console.log(`   책상은 제자리인가: (${P(deskStill.x)}, ${P(deskStill.y, 3)}, ${P(deskStill.z)})` +
            `  ${Math.abs(deskStill.x - afterMv.find(f => f.uid === 'banjiha-desk').x) < 0.002 ? '✔' : '⛔ 같이 움직였다'}`);
REC.A_moveMiddle = { mvC, after: afterC };

/* ── A-7 ★ 손가락으로 올리고 → 껐다 켠다 (세이브 왕복) ───────── */
console.log(`\n── A-7 손가락으로 올린다 (탭 → [옮기기] → 끌기 → 뗌 → [확정]) ──`);
const dnow = afterC.find(f => f.uid === 'banjiha-desk');
const scr = await J(`(()=>{ const rv=window.__rv;
  const h = rv.highlightFurniture('banjiha-dresser'); rv.highlightFurniture(null);
  const c = document.getElementById('roomCanvas'), r = c.getBoundingClientRect();
  const v = new THREE.Vector3(${dnow.x}, ${dnow.h}, ${dnow.z}).project(window.__cam);
  return { from:{ x: r.left + h.screen.x, y: r.top + h.screen.y },
           to:{ x: r.left+(v.x*0.5+0.5)*r.width, y: r.top+(-v.y*0.5+0.5)*r.height } }; })()`);
const M = async (type, p) => page.send('Input.dispatchMouseEvent',
  { type, x: p.x, y: p.y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, pointerType: 'mouse' });
let picked = null;
for (let t = 1; t <= 3; t++) {
  await M('mousePressed', scr.from); await sleep(120); await M('mouseReleased', scr.from);
  await sleep(1200);
  picked = await J(`(()=>({ uid: window.__furn && window.__furn.uid,
    menu: getComputedStyle(document.getElementById('furnActions')).display }))()`);
  picked.tries = t;
  if (picked.uid === 'banjiha-dresser') break;
}
console.log(`   탭 → 골라진 가구 ${picked.uid || '(없다)'} · 두드린 횟수 ${picked.tries}`);
await page.eval(`document.getElementById('furnMove').click()`, false);
await sleep(500);
await M('mousePressed', scr.from);
for (let i = 1; i <= 6; i++) {
  await M('mouseMoved', { x: scr.from.x + (scr.to.x - scr.from.x) * i / 6,
                          y: scr.from.y + (scr.to.y - scr.from.y) * i / 6 });
  await sleep(90);
}
const label = await page.eval(`document.getElementById('dropLabel').textContent`);
console.log(`   끄는 중 화면 글자: 「${label}」`);
await M('mouseReleased', scr.to);
await sleep(2500);
await page.eval(`(()=>{const b=document.getElementById('furnOk'); if(b)b.click();})()`, false);
await sleep(1500);
const byHand = await J(`(()=>{const f=window.__rv.furniture().find(f=>f.uid==='banjiha-dresser');
  return f?{x:f.x,y:f.y,z:f.z}:null;})()`);
console.log(`   손을 뗀 뒤 서랍장 (${P(byHand.x)}, ${P(byHand.y, 3)}, ${P(byHand.z)})` +
            `  ${byHand.y > 0.02 ? '✔ 손가락으로 올라갔다' : '⛔ 안 올라갔다'}`);
await shot(page, 'stack2_a3_by_hand.png');
const beforeReload = await J('__P.furn()');
const savedRaw = await page.eval(`(()=>{ try{
  const t=localStorage.getItem('byeot/save/1'); if(!t) return '(세이브가 없다)';
  const j=JSON.parse(t), hit=[];
  (function walk(o,p){ if(!o||typeof o!=='object') return;
    for (const u of ['banjiha-desk','banjiha-dresser'])
      if (o[u]) hit.push(p+'.'+u+' = '+JSON.stringify(o[u]));
    for (const k in o) walk(o[k], p+'.'+k); })(j,'');
  return hit.length ? hit.join('  |  ') : '(어디에도 안 적혔다) 최상위 칸: '+Object.keys(j).join(',');
} catch(e){ return 'ERR '+e.message; } })()`);
console.log(`\n── A-8 껐다 켠다 ──\n   세이브에 적힌 것: ${savedRaw}`);
await page.goto(`${BASE}/game.html`);
await boot(page);
const reloaded = await J('__P.furn()');
let saveOk = true;
console.log(`   ${'가구'.padEnd(20)}${'끄기 전'.padStart(24)}${'다시 켠 뒤'.padStart(24)}`);
for (const u of ['banjiha-desk', 'banjiha-dresser']) {
  const a = beforeReload.find(f => f.uid === u), b = reloaded.find(f => f.uid === u);
  const same = b && Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01 && Math.abs(a.z - b.z) < 0.01;
  if (!same) saveOk = false;
  console.log(`   ${u.padEnd(20)}${`(${P(a.x)}, ${P(a.y, 3)}, ${P(a.z)})`.padStart(24)}` +
              `${(b ? `(${P(b.x)}, ${P(b.y, 3)}, ${P(b.z)})` : '(없다)').padStart(24)}  ${same ? '✔' : '⛔'}`);
}
console.log(`   ⇒ ${saveOk ? '✔ 그대로 열렸다 — 새 세이브 칸을 안 팠다(y 는 원래 있던 칸)' : '⛔ 어긋났다'}`);
const reHeat = await J(`(()=>{ const rv=window.__rv;
  rv.setLightHeatmap(true, {weather:'clear',season:'summer',lampCount:0,litHours:12});
  const f = rv.furniture().find(f=>f.uid==='banjiha-dresser');
  return window.__P.cellAt(f.x, f.z); })()`);
console.log(`   다시 켠 뒤 빛 분포 — 칸 y ${P(reHeat.y, 3)} · onUid ${reHeat.onUid} · 값 ${P(reHeat.value, 3)}` +
            ` (엔진 ${P(reHeat.engine, 3)})  ${Math.abs(reHeat.value - reHeat.engine) < 0.005 ? '✔ 같다' : '⛔ 갈렸다'}`);
REC.A_hand = { picked, label, byHand, savedRaw, reloaded, saveOk, reHeat };
await sleep(1000);
await shot(page, 'stack2_a4_reloaded.png');

/* ════════════════════════════════════════════════════════════
   PART B — **세 겹 사슬**을 실제로 세운다 (반지하는 천장이 막으므로 다른 방에서)
   ------------------------------------------------------------
   ⚠ 원룸(천장 2.50m)을 **먼저** 본다 — 게임이 실제로 가는 방이고 좁아서 눈으로 읽힌다.
     못 세우면 온실(2.80m)로 물러난다. 두 방 다 못 세우면 **못 했다고 적는다.**
   ⚠ 여기서 재는 것은 **사슬 코드**다: ridersOf 의 깊이 · 따라오기 · 갇히지 않기 · 고리.
     빛 분포도 같이 재지만(두 방 다 조도 엔진이 도는 방이다) 밸런스 값으로 쓰지 마라 —
     반지하 표(§A)가 정본이다.
   ════════════════════════════════════════════════════════════ */
async function runChain(roomId, want, tag) {
  console.log(`\n\n████ PART B — ${roomId} · 세 겹 사슬 ████`);
  await Ja(`await (async()=>{ window.__io.light.setFurnitureOverrides({});
    window.__io.light.build('${roomId}'); await window.__rv.setRoom('${roomId}'); return 1; })()`);
  await sleep(2500);
  await page.eval(INJECT, false);
  const gf = await J('__P.furn()');
  const GC = (await J('__P.rv.roomSize()')).h;
  console.log(`\n[B-0 가구] ${gf.length}개 · 천장 ${GC}m`);
  for (const f of gf) console.log(`  ${f.uid.padEnd(30)} (${P(f.x)}, ${P(f.y)}, ${P(f.z)})  ${f.w}×${f.d}  키 ${f.h}`);
  const pick = k => gf.find(f => f.uid.includes(k));
  const base = pick(want[0]), mid = pick(want[1]), top = pick(want[2]);
  if (!base || !mid || !top) { console.log(`   ⛔ ${roomId} 에 ${want.join('·')} 가 다 없다`); return null; }
  console.log(`\n[B-1 탑] 밑 ${base.uid} → 가운데 ${mid.uid} → 위 ${top.uid}`);
  const b1 = await Ja(`await __P.move('${mid.uid}', {x:${base.x}, z:${base.z}, rot:0, step:0.125})`);
  console.log(`   ${mid.uid} → ${base.uid} 위 : ${b1.ok ? `✔ y ${P(b1.to.y, 3)}` : `⛔ ${b1.reason}`}`);
  if (!b1.ok) return null;
  const midNow = (await J('__P.furn()')).find(f => f.uid === mid.uid);
  const snTop = await J(`__P.snap('${top.uid}', {x:${midNow.x}, z:${midNow.z}, rot:0, step:0.125})`);
  console.log(`   ${top.uid} 를 그 위로: snap y ${P(snTop.y, 3)} · 받침 ${snTop.on}` +
    `  ${snTop.on === mid.uid ? '✔ **얹혀 있는 가구가 상판이 됐다 = 두 겹**' : `⛔ 받침이 ${snTop.on}`}`);
  const b2 = await Ja(`await __P.move('${top.uid}', {x:${midNow.x}, z:${midNow.z}, rot:0, step:0.125})`);
  console.log(`   commit → ${b2.ok ? `✔ y ${P(b2.to.y, 3)}` : `⛔ ${b2.reason}`}`);
  if (!b2.ok) return null;

  const tower = await J('__P.furn()');
  const TT = u => tower.find(f => f.uid === u);
  console.log(`\n   [세 겹의 y]`);
  for (const u of [base.uid, mid.uid, top.uid]) {
    const f = TT(u);
    console.log(`     ${u.padEnd(30)} y ${P(f.y, 3)}  윗면 ${P(f.y + f.h, 3)}  (${P(f.x)}, ${P(f.z)})`);
  }
  const bRiders = await J('__P.riders()');
  console.log(`   ridersOf → ${JSON.stringify(bRiders)}`);
  const chain = bRiders[base.uid] || [];
  const chainOk = chain.includes(mid.uid) && chain.includes(top.uid);
  console.log(`   ⇒ 맨 밑이 데려가는 것 ${JSON.stringify(chain)}` +
    `  ${chainOk ? '✔ **사슬 끝까지 본다** (한 겹만 보던 때는 가운데 하나뿐이었다)' : '⛔ 한 겹만 본다'}`);
  await J(`__P.rv.setLightHeatmap(false)`);
  await sleep(800);
  await shot(page, `stack2_${tag}1_three.png`);

  /* B-2 맨 밑을 옮기면 위 둘이 다 오나 */
  console.log(`\n── B-2 맨 밑을 옮긴다 — 위 둘이 다 따라오나 ──`);
  const bBefore = await J('__P.furn()');
  const spot1 = await J(`__P.findSpot('${base.uid}', 1.5)`);
  console.log(`   빈 자리를 찾아서 간다 → ${spot1 ? `(${P(spot1.x)}, ${P(spot1.z)})` : '⛔ 못 찾았다'}`);
  const bm = spot1 ? await Ja(`await __P.move('${base.uid}', {x:${spot1.x}, z:${spot1.z}, rot:0, step:0.125})`)
                   : { ok: false, reason: '빈 자리 없음' };
  await sleep(1200);
  const bAfter = await J('__P.furn()');
  console.log(`   ${base.uid} → ${bm.ok ? `ok · 같이 간 것 [${bm.riders.join(', ')}]` : `⛔ ${bm.reason}`}`);
  console.log(`   ${'가구'.padEnd(30)}${'전 (x, y, z)'.padStart(26)}${'후 (x, y, z)'.padStart(26)}   Δ`);
  const bd = {};
  for (const u of [base.uid, mid.uid, top.uid]) {
    const a = bBefore.find(f => f.uid === u), b = bAfter.find(f => f.uid === u);
    bd[u] = { dx: +(b.x - a.x).toFixed(3), dy: +(b.y - a.y).toFixed(3), dz: +(b.z - a.z).toFixed(3) };
    console.log(`   ${u.padEnd(30)}${`(${P(a.x)}, ${P(a.y, 3)}, ${P(a.z)})`.padStart(26)}` +
                `${`(${P(b.x)}, ${P(b.y, 3)}, ${P(b.z)})`.padStart(26)}   (${bd[u].dx}, ${bd[u].dy}, ${bd[u].dz})`);
  }
  const b0 = bd[base.uid];
  const moved = Math.hypot(b0.dx, b0.dz) > 0.01;   // ⚠ 안 움직였으면 Δ 0 이 「따라왔다」로 읽힌다
  const allFollow = moved && [mid.uid, top.uid].every(u =>
    Math.abs(bd[u].dx - b0.dx) < 0.002 && Math.abs(bd[u].dz - b0.dz) < 0.002 && Math.abs(bd[u].dy) < 0.002);
  console.log(`   ⇒ ${!moved ? '⛔ 맨 밑이 아예 안 움직였다 — 못 잰 것이다'
    : allFollow ? '✔ **두 겹이 통째로 따라왔다** (Δ 가 한 톨도 안 다르다)' : '⛔ 어긋났다'}`);
  await shot(page, `stack2_${tag}2_moved.png`);

  /* B-3 가운데만 따로 — 그 위만 따라오나 */
  console.log(`\n── B-3 가운데만 따로 옮긴다 — 맨 위만 따라오나 · 맨 밑은 제자리인가 ──`);
  const cBefore = await J('__P.furn()');
  const spot2 = await J(`__P.findSpot('${mid.uid}', 1.5)`);
  console.log(`   빈 자리를 찾아서 간다 → ${spot2 ? `(${P(spot2.x)}, ${P(spot2.z)})` : '⛔ 못 찾았다'}`);
  const cm = spot2 ? await Ja(`await __P.move('${mid.uid}', {x:${spot2.x}, z:${spot2.z}, rot:0, step:0.125})`)
                   : { ok: false, reason: '빈 자리 없음' };
  await sleep(1200);
  const cAfterB = await J('__P.furn()');
  console.log(`   ${mid.uid} → ${cm.ok ? `ok y ${P(cm.to.y, 3)} · 같이 간 것 [${cm.riders.join(', ')}]` : `⛔ ${cm.reason}`}`);
  for (const u of [base.uid, mid.uid, top.uid]) {
    const a = cBefore.find(f => f.uid === u), b = cAfterB.find(f => f.uid === u);
    console.log(`     ${u.padEnd(30)} (${P(a.x)}, ${P(a.y, 3)}, ${P(a.z)}) → (${P(b.x)}, ${P(b.y, 3)}, ${P(b.z)})`);
  }
  const mN = cAfterB.find(f => f.uid === mid.uid), tN = cAfterB.find(f => f.uid === top.uid);
  const bN = cAfterB.find(f => f.uid === base.uid), bO = cBefore.find(f => f.uid === base.uid);
  const mO = cBefore.find(f => f.uid === mid.uid);
  const midMoved = Math.hypot(mN.x - mO.x, mN.z - mO.z) > 0.01;
  const topFollows = midMoved && Math.abs(tN.y - (mN.y + mN.h)) < 0.06
    && Math.abs(tN.x - mN.x) < 0.5 && Math.abs(tN.z - mN.z) < 0.5;
  const baseStill = Math.abs(bN.x - bO.x) < 0.002 && Math.abs(bN.z - bO.z) < 0.002;
  console.log(`   ⇒ 가운데가 실제로 움직였나 ${midMoved ? '✔ (= 갇히지 않았다)' : '⛔ 안 움직였다 — 못 잰 것이다'}` +
              ` · 맨 위가 따라왔나 ${topFollows ? '✔' : '⛔ 허공에 남았다'}` +
              ` · 맨 밑은 제자리 ${baseStill ? '✔' : '⛔ 같이 움직였다'}`);
  await shot(page, `stack2_${tag}3_middle.png`);

  /* B-4 고리 */
  console.log(`\n── B-4 고리 — 「맨 위 위에 가운데」를 시도한다 ──`);
  const tTop = +(tN.y + tN.h).toFixed(4);
  const bcyc = await J(`(()=>({ snap: __P.snap('${mid.uid}', {x:${tN.x}, z:${tN.z}, rot:0, step:0.125}),
    fit: __P.fit('${mid.uid}', {x:${tN.x}, z:${tN.z}, rot:0, y:${tTop}}) }))()`);
  console.log(`   snap → y ${P(bcyc.snap.y, 3)} · 받침 ${bcyc.snap.on}` +
              `  ${bcyc.snap.on === top.uid ? '⛔ 자기 위를 골랐다' : '✔ 자기 탑은 상판이 안 된다'}`);
  console.log(`   fit  → ${bcyc.fit.ok ? '⛔ 통과했다' : `✔ 막혔다: 「${bcyc.fit.reason}」`}`);

  /* B-5 세 겹 위도 빛 분포에 나오나 */
  console.log(`\n── B-5 빛 분포 — 세 겹 위를 집나 ──`);
  await Ja(`await (async()=>{ await __P.move('${mid.uid}', {x:${bN.x}, z:${bN.z}, rot:0, step:0.125});
    await __P.move('${top.uid}', {x:${bN.x}, z:${bN.z}, rot:0, step:0.125}); return 1; })()`);
  await sleep(1200);
  await J(`__P.rv.setLightHeatmap(true, {weather:'clear', season:'summer', lampCount:0, litHours:12})`);
  await sleep(1500);
  const bTop = (await J('__P.furn()')).find(f => f.uid === top.uid);
  const bCell = await J(`__P.cellAt(${bTop.x}, ${bTop.z})`);
  console.log(`   탑 (${P(bTop.x)}, ${P(bTop.z)}) · 맨 위 밑동 y ${P(bTop.y, 3)}`);
  console.log(`     칸 y ${P(bCell.y, 3)} · onUid ${bCell.onUid} · 값 ${P(bCell.value, 3)} · 엔진 ${P(bCell.engine, 3)}`);
  console.log(`     ⇒ 맨 위를 집었나 ${bCell.onUid === top.uid ? '✔' : `⛔ ${bCell.onUid}`}` +
              ` · 화면==엔진 ${Math.abs(bCell.value - bCell.engine) < 0.005 ? '✔' : '⛔'}`);
  await shot(page, `stack2_${tag}4_heat.png`);
  return { roomId, ceil: GC, furn: gf, tower, riders: bRiders, chainOk, snTop,
           moveBottom: { bm, delta: bd, allFollow }, moveMiddle: { cm, midMoved, topFollows, baseStill },
           cycle: bcyc, heat: { bTop, bCell } };
}

REC.B = await runChain('oneroom', ['desk', 'nightstand', 'chair'], 'b');
if (!REC.B) {
  console.log(`\n⚠ 원룸에서는 세 겹을 못 세웠다 — 온실(2.80m)로 물러난다`);
  REC.B2 = await runChain('greenhouse', ['table', 'desk', 'cart'], 'c');
}

const errs = await page.eval(`JSON.stringify((window.__errBox && window.__errBox.list) || [])`);
console.log(`\n[예외] ${errs === '[]' ? '0 개' : errs.slice(0, 600)}`);
REC.errs = errs;
console.log(`\nJSON=${JSON.stringify(REC)}`);
await page.close();
