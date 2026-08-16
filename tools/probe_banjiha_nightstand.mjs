/* ============================================================
   tools/probe_banjiha_nightstand.mjs — 반지하에 협탁을 넣기 전·후를 잰다 (G-14)
   ------------------------------------------------------------
   박사님: *"서랍장이랑 3단 거치랑 책상이 각각 높이가 얼만데. **협탁은 일단 적용해.**"*

   왜 이 자가 필요한가
     어제(G-13 · stack2-to-plan.md) 가구 **두 겹 쌓기**가 열렸는데 **반지하에서는 안 선다.**
     이 방 가구가 전부 0.74~0.94 라 어느 둘을 겹쳐도 천장 2.30m 를 넘거나 아슬아슬하다.
     협탁(0.48)을 한 자리 넣으면 서랍장 0.80 + 협탁 0.48 = 1.28, 그 위에 의자 0.89 를
     올려도 2.17 로 천장 아래다 — **세 겹이 선다.**

   ⚠⚠ 그런데 가구를 하나 더 놓으면 **그림자가 는다.** 이 저장소에는 방을 건드렸다가
     창턱 조도가 4.80 → 3.68 로 23% 떨어진 사고가 있다(START-HERE). 그래서 이 자는
     **넣기 전과 넣은 뒤를 같은 방법으로 재서** 나란히 낼 수 있게 만든 것이다.

   재는 것
     ① 반지하 **자리 전부**의 DLI — ★ `banjiha-sill:0`(창턱 4.80) 이 안 움직이는가
     ② 길찾기 — 자리마다 `standProbe` 로 「걸어가 설 수 있나」(ACT_REACH 1.45)
     ③ 협탁이 실제로 방에 서는가 — 가구 목록 · 사진(색 가짓수)
     ④ ★ **세 겹** — 서랍장 → 협탁 → 의자 를 실제로 쌓아 보고 겹마다 y 를 숫자로
     ⑤ 협탁 윗면의 DLI (구석 vs 창 밑)

   무엇을 켜고 무엇을 껐나
     · 실제 game.html · **반지하** · 등 0개(자연광만) · 맑음·여름 · litHours 12
     · localStorage 비움 · 프롤로그 대사를 걷고 **게임 시계가 낮에 이를 때까지 기다렸다가** 찍는다
       (⚠ 새벽엔 방이 캄캄하다. ⚠⚠ `setDaylight` 로는 못 박히지 않는다 — §waitNoon)
     · 게임은 `novice` 로만 도므로 **peak 이 곧 그날 값**이다(START-HERE §2.9-④)
     · 파일은 한 줄도 안 고친다

   쓰는 법
     python tools/serve.py 8963
     BYEOT_TAG=before node tools/probe_banjiha_nightstand.mjs      # 협탁 넣기 전
     BYEOT_TAG=after  node tools/probe_banjiha_nightstand.mjs      # 넣은 뒤
     node tools/probe_banjiha_nightstand.mjs --diff                # 두 판을 나란히
   ⇒ 결과 JSON 은 tools/_out/banjiha_nightstand.<tag>.json 에 남는다.
============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTD = path.join(ROOT, 'tools/_out');
const IMGD = path.join(ROOT, 'docs/handoff/img');
const TAG = process.env.BYEOT_TAG || 'after';
/* BYEOT_PART=sill 이면 §PART SILL(창턱 받침) 을 재고 세 겹 쌓기는 건너뛴다.
   ⚠ 두 일(협탁 · 창턱)의 조도 표가 섞이면 못 읽는다 — 그래서 파일이 하나여도 판을 가른다. */
const PART = process.env.BYEOT_PART || 'nightstand';
const P = (n, k = 2) => (n == null || Number.isNaN(n) ? '  null' : (+n).toFixed(k));

/* ══════════════════════════════════════════════════════════
   --diff — 이미 남은 두 판을 나란히 낸다 (브라우저를 안 띄운다)
   ══════════════════════════════════════════════════════════ */
if (process.argv.includes('--diff')) {
  const rd = t => JSON.parse(fs.readFileSync(path.join(OUTD, `banjiha_nightstand.${t}.json`), 'utf8'));
  const args = process.argv.slice(process.argv.indexOf('--diff') + 1).filter(a => !a.startsWith('-'));
  const A = rd(args[0] || 'before'), B = rd(args[1] || 'after');
  console.log(`\n████ 조도 전·후 — 반지하 자리 전부 · 등 0개(자연광만) · 맑음·여름 · 한낮 0.50 ████\n`);
  const sillA = (A.dli['banjiha-sill:0'] || {}).dli, sillB = (B.dli['banjiha-sill:0'] || {}).dli;
  const sillSame = Math.abs((sillA ?? -1) - (sillB ?? -2)) < 0.005;
  console.log(`★★ 창턱 banjiha-sill:0 — 전 ${P(sillA)} → 후 ${P(sillB)}   ` +
              `${sillSame ? '✔ **한 톨도 안 움직였다**' : '⛔⛔ 움직였다 — 자리를 옮겨야 한다'}\n`);
  const ids = [...new Set([...Object.keys(A.dli), ...Object.keys(B.dli)])].sort();
  console.log(`   ${'자리'.padEnd(26)}${'y'.padStart(8)}${'전'.padStart(9)}${'후'.padStart(9)}${'Δ'.padStart(9)}`);
  let moved = 0;
  for (const id of ids) {
    const a = A.dli[id], b = B.dli[id];
    const d = (a && b) ? +(b.dli - a.dli).toFixed(3) : null;
    if (d != null && Math.abs(d) >= 0.005) moved++;
    console.log(`   ${id.padEnd(26)}${P(b ? b.y : a.y, 3).padStart(8)}` +
                `${(a ? P(a.dli) : '  없음').padStart(9)}${(b ? P(b.dli) : '  없음').padStart(9)}` +
                `${(d == null ? '   신설' : (Math.abs(d) < 0.005 ? '      0' : P(d, 3))).padStart(9)}`);
  }
  console.log(`\n   ⇒ 값이 움직인 자리 **${moved}곳** / 둘 다 있는 자리 ` +
              `${ids.filter(i => A.dli[i] && B.dli[i]).length}곳`);
  console.log(`   ⇒ 새로 생긴 자리 [${ids.filter(i => !A.dli[i]).join(', ') || '없다'}]`);

  console.log(`\n████ 길찾기 전·후 — standProbe · ACT_REACH ${B.reach.reach ?? A.reach.reach} ████\n`);
  console.log(`   ${'자리'.padEnd(26)}${'전 bestGap'.padStart(12)}${'후 bestGap'.padStart(12)}   판정`);
  for (const id of ids) {
    const a = (A.reach.rows || []).find(r => r.slotId === id);
    const b = (B.reach.rows || []).find(r => r.slotId === id);
    const lim = B.reach.reach ?? 1.45;
    const ok = b ? (b.bestGapMax <= lim) : null;
    console.log(`   ${id.padEnd(26)}${(a ? P(a.bestGapMax) : ' 없음').padStart(12)}` +
                `${(b ? P(b.bestGapMax) : ' 없음').padStart(12)}   ${b ? (ok ? '✔ 닿는다' : '⛔ 못 닿는다') : ''}`);
  }
  process.exit(0);
}

/* ══════════════════════════════════════════════════════════
   여기서부터 실제 측정
   ══════════════════════════════════════════════════════════ */
const { launch, sleep } = await import('./test_cdp.mjs');
const BASE = process.env.BYEOT_URL || 'http://localhost:8963';

/* ── PNG 색 가짓수 — 까만 사진을 가른다 (START-HERE §2.9-③) ── */
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
/* ⚠⚠ **`rv.setDaylight(0.5)` 로는 낮이 안 온다.** `game.html` 의 평소 시계
   (§idleClockStart)가 **매 프레임** `roomView.setDaylight(dayPhase)` 를 다시 부른다 —
   밖에서 넣은 값은 한 프레임도 못 버틴다. 그래서 처음에 「새벽 06:14」짜리 어두운 방을
   찍어 놓고 **색 가짓수 5,662 로 §2.9-③ 검사는 통과**했다. 그 자만으로는 이걸 못 잡는다.
   ⇒ 시계가 실제로 낮에 이르기를 기다린다. 하루 한 바퀴가 DAY_SWEEP_MS 1600ms ×
     IDLE_SWEEP_MULT 360 = 576초이므로, 시작(06:00)에서 정오까지 약 144초다. */
async function waitNoon(page, fromH = 10, toH = 16, capMs = 260000) {
  const t0 = Date.now();
  let txt = '';
  for (;;) {
    txt = await page.eval(`(document.getElementById('resWhen')||{}).textContent || ''`);
    const m = /(\d{2}):(\d{2})/.exec(txt);
    const h = m ? +m[1] + (+m[2]) / 60 : null;
    if (h != null && h >= fromH && h <= toH) { console.log(`   해가 들었다 — 게임 시각 ${txt.trim()}`); return txt; }
    if (Date.now() - t0 > capMs) { console.log(`   ⚠ 낮을 못 기다렸다 — 게임 시각 ${txt.trim()} (사진이 어두울 수 있다)`); return txt; }
    await sleep(4000);
  }
}
async function shot(page, name) {
  let f = '', colors = 0;
  for (let i = 0; i < 3; i++) {
    await sleep(1200);
    f = await page.shot(path.join(IMGD, name));
    colors = colorCount(decodePNG(fs.readFileSync(f)));
    if (colors >= 3000) break;
  }
  console.log(`   사진 ${name} · 색 가짓수 ${colors}${colors < 3000 ? '  ⛔ 까만 사진이다' : '  ✔'}`);
  return colors;
}

/* ── 조도·방뷰 창구를 한 자리에 심는다 (probe_stack2 와 같은 자·같은 하늘) ── */
const INJECT = `window.__N = (()=>{
  const rv = window.__rv, L = window.__io.light;
  const SKY = { weather:'clear', season:'summer', lampCount:0, litHours:12 };
  const furn = () => rv.furniture().map(f=>({uid:f.uid,name:f.name,x:f.x,y:f.y,z:f.z,rot:f.rot,
                                             w:f.size.w,d:f.size.d,h:+(f.size.h??0).toFixed(3)}));
  const dli = () => { const m={}; for (const s of L.room.slots)
      m[s.slotId] = { y:+(s.y??0).toFixed(3), dli:+L.dliOfSlot(s.slotId, SKY).toFixed(3) }; return m; };
  const surf = (x,z) => { const s = rv.surfaceTopAt(x,z);
    return { y:s.y, onUid:s.onUid, occIdx:s.occIdx,
             dli:+L.dliAt({x, y:s.y, z}, {...SKY, occIdx:s.occIdx}).dli.toFixed(3) }; };
  const riders = () => { const m={}; for (const f of rv.furniture()) { const r=rv.ridersOf(f.uid);
                          if (r.length) m[f.uid]=r; } return m; };
  return { rv, L, SKY, furn, dli, surf, riders,
           snap:(uid,p)=>{ try{ return rv.snapFurniture(uid,p); }catch(e){ return {err:e.message}; } },
           fit :(uid,p)=>{ try{ return rv.furnitureFit(uid,p); }catch(e){ return {ok:false,reason:e.message}; } },
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
  /* ⚠ 여기서 setDaylight 를 불러 봐야 소용없다 — 위 §waitNoon 머리말을 읽어라.
     사진을 찍는 자리에서 **시계가 낮에 이르기를 기다린다.** */
  await sleep(1500);
  await page.eval(INJECT, false);
}

const page = await launch({ width: 900, height: 760, dpr: 1, mobile: false });
await page.goto(`${BASE}/game.html`);
await page.eval(`localStorage.clear()`, false);              // ⚠ goto 뒤에 부른다
await page.goto(`${BASE}/game.html`);
await boot(page);

const J = async (e) => JSON.parse(await page.eval(`JSON.stringify(${e})`));
const Ja = async (e) => JSON.parse(await page.eval(`(async()=>JSON.stringify(${e}))()`));
const REC = { tag: TAG, at: new Date().toISOString() };

const size = await J('__N.rv.roomSize()');
console.log(`\n████ 반지하 (${size.w}×${size.d}, 천장 ${size.h}m) · 등 0개(자연광만) · 맑음·여름 · 한낮 0.50 · tag=${TAG} ████`);

/* ── ① 가구 ─────────────────────────────────────────────── */
const furn0 = await J('__N.furn()');
REC.furn = furn0; REC.size = size;
console.log(`\n[1] 가구 ${furn0.length}개`);
for (const f of furn0)
  console.log(`   ${f.uid.padEnd(24)} ${String(f.name).padEnd(8)} (${P(f.x)}, ${P(f.y, 3)}, ${P(f.z)})  ` +
              `${f.w}×${f.d}  키 ${f.h}  rot ${f.rot}`);
const hasNS = furn0.some(f => f.uid === 'banjiha-nightstand');
console.log(`   ⇒ 협탁(banjiha-nightstand) ${hasNS ? '✔ **방에 서 있다**' : '— 아직 없다'}`);
REC.hasNightstand = hasNS;

/* ── ② 자리마다 DLI ─────────────────────────────────────── */
const dli = await J('__N.dli()');
REC.dli = dli;
console.log(`\n[2] 자리 ${Object.keys(dli).length}곳의 DLI`);
console.log(`   ${'자리'.padEnd(26)}${'y'.padStart(8)}${'DLI'.padStart(9)}`);
for (const id of Object.keys(dli).sort())
  console.log(`   ${id.padEnd(26)}${P(dli[id].y, 3).padStart(8)}${P(dli[id].dli).padStart(9)}` +
              `${id === 'banjiha-sill:0' ? '   ★ 창턱' : ''}`);

/* ── ③ 길찾기 ───────────────────────────────────────────── */
const reach = await J(`(()=>{
  const rv = window.__rv, slots = rv.slots(), s = rv.roomSize(), m = 0.6;
  const c0 = (rv.characters().find(c=>c.walkable) || {pos:{x:0,z:0}}).pos;
  const froms = [ {x:c0.x, z:c0.z},
                  {x:-s.w/2+m, z:-s.d/2+m}, {x:s.w/2-m, z:-s.d/2+m},
                  {x:-s.w/2+m, z: s.d/2-m}, {x:s.w/2-m, z: s.d/2-m} ];
  const rows = []; let reach = null;
  for (const sl of slots) {
    const per = froms.map(f => rv.standProbe(sl.slotId, f)).filter(Boolean);
    if (!per.length) continue;
    reach = per[0].reach;
    rows.push({ slotId: sl.slotId, y: +sl.pos.y.toFixed(3),
                bestGapMax: +Math.max(...per.map(p=>p.bestGap ?? 0)).toFixed(2),
                gapMax:     +Math.max(...per.map(p=>p.gap ?? 0)).toFixed(2) });
  }
  return { reach, rows };
})()`);
REC.reach = reach;
console.log(`\n[3] 길찾기 — 제일 나쁜 출발점 기준 · ACT_REACH ${reach.reach}`);
console.log(`   ${'자리'.padEnd(26)}${'bestGap'.padStart(9)}${'gap'.padStart(8)}   판정`);
let bad = 0;
for (const r of reach.rows) {
  const ok = r.bestGapMax <= reach.reach;
  if (!ok) bad++;
  console.log(`   ${r.slotId.padEnd(26)}${P(r.bestGapMax).padStart(9)}${P(r.gapMax).padStart(8)}   ${ok ? '✔ 닿는다' : '⛔ 못 닿는다'}`);
}
console.log(`   ⇒ **못 닿는 자리 ${bad}곳** / ${reach.rows.length}곳`);
REC.reachBad = bad;

await waitNoon(page);
await shot(page, `banjiha_ns_${TAG}_room.png`);

/* ── ④ 세 겹 — 협탁이 있을 때만 (창턱 몫을 잴 때는 건너뛴다) ── */
if (hasNS && PART !== 'sill') {
  console.log(`\n[4] ★★ 세 겹을 실제로 쌓는다 — 서랍장(바닥) → 협탁 → 의자`);
  const F = u => furn0.find(f => f.uid === u);
  const dr = F('banjiha-dresser');
  console.log(`   ⓪ 서랍장 ${dr.w}×${dr.d} 키 ${dr.h} — 밑동 ${P(dr.y, 3)} · 윗면 ${P(dr.y + dr.h, 3)}`);

  const sn1 = await J(`__N.snap('banjiha-nightstand', {x:${dr.x}, z:${dr.z}, rot:0, step:0.125})`);
  console.log(`   ① 협탁 snap → y ${P(sn1.y, 3)} · 받침 ${sn1.on}`);
  const mv1 = await Ja(`await __N.move('banjiha-nightstand', {x:${dr.x}, z:${dr.z}, rot:0, step:0.125})`);
  console.log(`      commit → ${mv1.ok ? `✔ 올라갔다 y ${P(mv1.to.y, 3)}` : `⛔ ${mv1.reason}`}`);

  const t1 = await J('__N.furn()');
  const ns1 = t1.find(f => f.uid === 'banjiha-nightstand');
  const sn2 = await J(`__N.snap('banjiha-chair', {x:${ns1.x}, z:${ns1.z}, rot:0, step:0.125})`);
  console.log(`   ② 의자 snap → y ${P(sn2.y, 3)} · 받침 ${sn2.on}` +
              `${sn2.on === 'banjiha-nightstand' ? '  ★ **얹혀 있는 협탁이 상판이 됐다**' : ''}`);
  const fit2 = sn2.err ? { ok: false, reason: sn2.err }
    : await J(`__N.fit('banjiha-chair', {x:${sn2.x}, z:${sn2.z}, rot:${sn2.rot}, y:${sn2.y}})`);
  console.log(`      fit → ${fit2.ok ? '✔ 올라간다' : `⛔ ${fit2.reason}`}`);
  const mv2 = await Ja(`await __N.move('banjiha-chair', {x:${ns1.x}, z:${ns1.z}, rot:0, step:0.125})`);
  console.log(`      commit → ${mv2.ok ? `✔ 올라갔다 y ${P(mv2.to.y, 3)}` : `⛔ ${mv2.reason}`}`);

  const t2 = await J('__N.furn()');
  const rows = ['banjiha-dresser', 'banjiha-nightstand', 'banjiha-chair'].map(u => t2.find(f => f.uid === u));
  console.log(`\n   ★ 세 겹의 y — 천장 ${size.h}m`);
  console.log(`   ${'가구'.padEnd(24)}${'키'.padStart(7)}${'밑동 y'.padStart(9)}${'윗면'.padStart(9)}`);
  for (const r of rows)
    console.log(`   ${r.uid.padEnd(24)}${P(r.h, 3).padStart(7)}${P(r.y, 3).padStart(9)}${P(r.y + r.h, 3).padStart(9)}`);
  const top = Math.max(...rows.map(r => r.y + r.h));
  const stood = rows[1].y > 0.05 && rows[2].y > rows[1].y;
  console.log(`   ⇒ 탑 꼭대기 ${P(top, 3)}m · 남는 머리 ${P(size.h - top, 3)}m  ` +
              `${stood ? '✔ **세 겹이 이 방에 실제로 선다**' : '⛔ 안 섰다'}`);
  const rid = await J('__N.riders()');
  console.log(`   ridersOf`);
  for (const [u, r] of Object.entries(rid)) console.log(`     ${u} → ${r.join(', ')}`);
  REC.stack = { rows, top, stood, snap1: sn1, move1: mv1, snap2: sn2, fit2, move2: mv2, riders: rid };

  /* 협탁 윗면의 밝기 — 구석(지금 자리) vs 창 밑 */
  const sNS = await J(`__N.surf(${rows[1].x}, ${rows[1].z})`);
  console.log(`\n   [협탁 윗면 밝기] 서랍장 위(어두운 구석) → 표면 y ${P(sNS.y, 3)} · onUid ${sNS.onUid} · DLI ${P(sNS.dli, 3)}`);
  REC.stackLight = { corner: sNS };
  await waitNoon(page);
  await shot(page, `banjiha_ns_${TAG}_stack3.png`);

  /* 되돌린다 — 다음 걸음이 정본 배치를 보게 */
  await Ja(`await __N.move('banjiha-chair', {x:${F('banjiha-chair').x}, z:${F('banjiha-chair').z}, rot:180, y:0, step:0.125})`);
  await Ja(`await __N.move('banjiha-nightstand', {x:${F('banjiha-nightstand').x}, z:${F('banjiha-nightstand').z}, rot:${F('banjiha-nightstand').rot}, y:0, step:0.125})`);
} else if (PART !== 'sill') {
  console.log(`\n[4] 세 겹 — 협탁이 아직 없어서 안 잰다 (tag=${TAG})`);
}

/* ══════════════════════════════════════════════════════════
   PART SILL — 창턱 받침이 얼마나 튀어나와 있고, 그루가 창을 뚫나
   ------------------------------------------------------------
   박사님: *"그래픽상으로 **창턱이 덜 튀어나와 있어서** 식물이 **창문 위턱에 걸려서
     뚫어버려서** 걸리는 것처럼 보였어. 창턱 그 가구를 **0.25 정도 튀어나오도록** 해서
     그 몬스테라가 그 위에 딱 올라가서 **창문 위턱에 안 걸리게** 배치해야 할 듯?"*

   ⚠ 이 방 벽 안쪽 면은 z −1.9 다(바깥 4.0 의 반 2.0 에서 벽 반두께 0.1 을 뺀 값).
     창 개구부는 y 1.495~2.045 · x −1.1~1.1 이다.
   ⇒ 「튀어나온 길이」 = 받침 앞면 z − (−1.9). 지금은 받침이 z −1.95 에 깊이 0.24 라
     앞면이 −1.83, 즉 **0.07m 밖에 안 나와 있다.**
   ══════════════════════════════════════════════════════════ */
if (PART === 'sill') {
  const WALL_IN = -(size.d / 2) + 0.1;                 // 뒷벽 안쪽 면
  const WIN = { lo: 1.495, hi: 2.045, x0: -1.1, x1: 1.1 };
  console.log(`\n████ PART SILL — 창턱 받침 · 뒷벽 안쪽 면 z ${P(WALL_IN, 3)} · 창 개구부 y ${WIN.lo}~${WIN.hi} ████`);

  /* ⚠ 창턱 받침은 `mount:'wall'` 붙박이라 `rv.furniture()`(옮길 수 있는 것) 에 **안 나온다.**
     그래서 치수는 데이터에서 읽고, 그 데이터가 실제로 화면에 섰는지는 자리 좌표로 댄다. */
  const rooms = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/house_rooms.json'), 'utf8'));
  const presets = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/furniture_presets.json'), 'utf8')).presets;
  const sillDef = rooms.rooms.banjiha.furniture.find(f => f.uid === 'banjiha-sill');
  const sillPre = presets[sillDef.preset];
  const sillF = { uid: 'banjiha-sill', preset: sillDef.preset,
                  w: sillDef.w ?? sillPre.w, d: sillDef.d ?? sillPre.d,
                  x: sillDef.x, y: sillDef.y, z: sillDef.z };
  const sillSlot = await J(`(()=>{ const s=window.__rv.slots().find(s=>s.slotId==='banjiha-sill:0');
    return s ? { pos:s.pos, maxPotD:s.maxPotD ?? null } : null; })()`);
  const front = sillF ? +(sillF.z + sillF.d / 2).toFixed(4) : null;
  const back = sillF ? +(sillF.z - sillF.d / 2).toFixed(4) : null;
  const stick = front == null ? null : +(front - WALL_IN).toFixed(4);
  console.log(`\n[S-1] 받침 ${sillF.preset} — ${sillF.w}×${sillF.d} · 중심 z ${P(sillF.z, 3)} · 뒤 ${P(back, 3)} · 앞 ${P(front, 3)}`);
  console.log(`      ⇒ **방 쪽으로 튀어나온 길이 ${P(stick, 3)}m**`);
  console.log(`      자리 banjiha-sill:0 = (${P(sillSlot.pos.x, 3)}, ${P(sillSlot.pos.y, 3)}, ${P(sillSlot.pos.z, 3)}) · maxPotD ${P(sillSlot.maxPotD, 3)}`);
  REC.sill = { furn: sillF, slot: sillSlot, wallIn: WALL_IN, win: WIN, front, back, stick };

  /* ── S-2 그루를 조립기에 직접 물어 **가로·세로 뻗음**을 잰다 ── */
  const DAYS = [45, 100, 150, 190, 290];
  const bbs = await Ja(`await (async()=>{
    const m = await import('/src/render3d/plant_assemble.js');
    const asm = await m.getPlantAssembler({});
    const out = [];
    for (const d of ${JSON.stringify(DAYS)}) {
      const g = asm.assemble({ growthDays:d, seed:92158, potD:0.20 });
      let leaf = 0; g.traverse(o=>{ const k=o.userData&&o.userData.assetKey; if(k&&/^leaf_/.test(k)) leaf++; });
      const bb = new THREE.Box3().setFromObject(g);
      out.push({ d, leaf, top:+bb.max.y.toFixed(4),
                 zb:+bb.min.z.toFixed(4), zf:+bb.max.z.toFixed(4),
                 xl:+bb.min.x.toFixed(4), xr:+bb.max.x.toFixed(4) });
    }
    return out; })()`);
  console.log(`\n[S-2] 그루가 자리에서 얼마나 뻗나 (조립기 실측 · 씨앗 92158 · 화분 0.20)`);
  console.log(`   ${'유효일'.padStart(6)}${'잎'.padStart(4)}${'꼭대기'.padStart(9)}${'뒤끝 z'.padStart(9)}${'앞끝 z'.padStart(9)}`);
  for (const b of bbs) console.log(`   ${String(b.d).padStart(6)}${String(b.leaf).padStart(4)}${P(b.top, 3).padStart(9)}${P(b.zb, 3).padStart(9)}${P(b.zf, 3).padStart(9)}`);
  const SY = sillSlot.pos.y, SZ = sillSlot.pos.z;
  console.log(`\n   자리 (y ${P(SY, 3)} · z ${P(SZ, 3)}) 에 세우면 — 창 윗변 ${WIN.hi} · 벽 안쪽 면 ${P(WALL_IN, 3)}`);
  console.log(`   ${'유효일'.padStart(6)}${'잎'.padStart(4)}${'꼭대기 y'.padStart(10)}${'창 위로'.padStart(9)}${'그루 뒤끝 z'.padStart(12)}${'벽 속으로'.padStart(10)}   판정`);
  const sillRows = [];
  for (const b of bbs) {
    const top = +(SY + b.top).toFixed(3);
    const over = +(top - WIN.hi).toFixed(3);
    const zb = +(SZ + b.zb).toFixed(3);
    const into = +(WALL_IN - zb).toFixed(3);          // 양수면 벽 속(개구부 안)으로 들어간 몫
    const bad = over > 0 && into > 0;
    sillRows.push({ ...b, top, over, zb, into, bad });
    console.log(`   ${String(b.d).padStart(6)}${String(b.leaf).padStart(4)}${P(top, 3).padStart(10)}` +
                `${(over > 0 ? '+' + P(over, 3) : P(over, 3)).padStart(9)}${P(zb, 3).padStart(12)}` +
                `${(into > 0 ? '+' + P(into, 3) : P(into, 3)).padStart(10)}   ` +
                `${bad ? '⛔ **창 윗턱을 뚫는다** (창 위로 올라간 몸이 개구부 안에 있다)' : (over > 0 ? '✔ 창 위지만 벽 앞이라 안 걸린다' : '✔ 창 아래')}`);
  }
  REC.sillRows = sillRows; REC.sillBB = bbs;

  /* ── S-3 실제로 창턱에 세우고 사진 ── */
  console.log(`\n[S-3] 창턱에 잎 3장짜리(유효 150일)를 실제로 세운다`);
  const put = await Ja(`await (async()=>{ try {
    await window.__rv.setPlant('banjiha-sill:0', { kind:'monstera', growthDays:150 });
    const p = window.__rv.plants().find(p=>p.key==='banjiha-sill:0');
    return { ok:true, pos:p?p.pos:null, potD:p?p.potD:null };
  } catch(e){ return { ok:false, reason:e.message }; } })()`);
  console.log(`   setPlant → ${put.ok ? `✔ 섰다 (${P(put.pos.x, 3)}, ${P(put.pos.y, 3)}, ${P(put.pos.z, 3)}) · 화분 ${P(put.potD, 3)}` : `⛔ ${put.reason}`}`);
  REC.sillPlant = put;
  await waitNoon(page);
  REC.shotWide = await shot(page, `banjiha_sill_${TAG}_wide.png`);
  /* 창턱 가까이 — focusSlot 은 코를 박으므로 휠로 몇 칸 물러선다 */
  await page.eval(`window.__rv.focusSlot('banjiha-sill:0', true)`, false);
  await sleep(1200);
  await page.eval(`(()=>{ const c=document.getElementById('roomCanvas'), r=c.getBoundingClientRect();
    for (let i=0;i<4;i++) c.dispatchEvent(new WheelEvent('wheel',{deltaY:240,clientX:r.left+r.width/2,
                                clientY:r.top+r.height/2,bubbles:true,cancelable:true})); })()`, false);
  await sleep(900);
  REC.shotFocus = await shot(page, `banjiha_sill_${TAG}_focus.png`);
  /* 옆에서 — 캔버스를 가로로 끌어 방위를 튼다(cam.az -= dx*0.006 · 45° ≈ 131px)
     ⚠ 방뷰는 **mousedown 만 캔버스**에 걸고 mousemove·mouseup 은 **window** 에 건다
       (room_view §onDown/onMove/onUp). PointerEvent 로 쏘면 한 개도 안 먹는다 —
       첫 판에 그렇게 쏘고 「옆에서 찍었다」는 사진이 앞에서 찍은 것과 한 화소도 안 달랐다. */
  await page.eval(`(()=>{ const c=document.getElementById('roomCanvas'), r=c.getBoundingClientRect();
    const cx=r.left+r.width/2, cy=r.top+r.height/2;
    const ev=(t,x,y)=>new MouseEvent(t,{clientX:x,clientY:y,bubbles:true,cancelable:true,buttons:1});
    c.dispatchEvent(ev('mousedown',cx,cy));
    for(let i=1;i<=9;i++) window.dispatchEvent(ev('mousemove',cx-i*15,cy));
    window.dispatchEvent(new MouseEvent('mouseup',{clientX:cx-135,clientY:cy,bubbles:true}));
  })()`, false);
  await sleep(1200);
  await sleep(900);
  const camS = await J('__N.rv.camera()');
  console.log(`   시점 az ${P(camS.az, 3)} (기준 ${P(camS.baseAz, 3)}) — 앞에서 찍은 판과 달라야 「옆에서」다`);
  REC.camSide = camS;
  REC.shotSide = await shot(page, `banjiha_sill_${TAG}_side.png`);
}

/* ── ⑤ 부팅 예외 ────────────────────────────────────────── */
const errs = await J(`(()=>{ const b=window.__errBox; return b ? (b.list||b) : []; })()`).catch(() => []);
console.log(`\n[5] 부팅 예외 ${Array.isArray(errs) ? errs.length : '?'}개`);
if (Array.isArray(errs)) for (const e of errs.slice(0, 5)) console.log(`   ⚠ ${JSON.stringify(e).slice(0, 200)}`);
REC.errs = errs;

fs.mkdirSync(OUTD, { recursive: true });
fs.writeFileSync(path.join(OUTD, `banjiha_nightstand.${TAG}.json`), JSON.stringify(REC, null, 1));
console.log(`\n⇒ tools/_out/banjiha_nightstand.${TAG}.json 에 남겼다`);
await page.close();
process.exit(0);
