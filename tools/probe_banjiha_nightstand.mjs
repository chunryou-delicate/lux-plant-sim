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
  /* ★ 등 0/1/2 를 한꺼번에 낸다 — 「등 하나로 갈라짐 문턱 6.0 을 넘나」가 이 자의 핵심이다.
     ⚠ dliOfSlot 은 캐시를 타므로 등 수마다 키가 갈린다(light_adapter §dliOfSlot). */
  const dli = () => { const m={}; for (const s of L.room.slots)
      m[s.slotId] = { y:+(s.y??0).toFixed(3),
                      dli:+L.dliOfSlot(s.slotId, SKY).toFixed(3),
                      d1 :+L.dliOfSlot(s.slotId, {...SKY, lampCount:1}).toFixed(3),
                      d2 :+L.dliOfSlot(s.slotId, {...SKY, lampCount:2}).toFixed(3) }; return m; };
  /* 그 점의 **표면**에서 등 0/1/2 로 잰다 — 화면 빛 분포가 쓰는 그 길 그대로다 */
  const surfN = (x,z) => { const s = rv.surfaceTopAt(x,z);
    const d = n => +L.dliAt({x, y:s.y, z}, {...SKY, lampCount:n, occIdx:s.occIdx}).dli.toFixed(3);
    return { y:s.y, onUid:s.onUid, occIdx:s.occIdx, d0:d(0), d1:d(1), d2:d(2) }; };
  /* ★★ 상판 **한가운데**만 재면 안 된다 — 화분은 칸에 앉고 **창 쪽 칸이 더 밝다.**
     빛 분포가 그리는 칸을 훑어 그 상판의 **제일 밝은 칸**을 낸다. 플레이어가 실제로
     고를 수 있는 값이 그것이다. (G-13 이 낸 2.880 도 한가운데가 아니라 칸 값이었다) */
  const topCells = (uid) => {
    const cs = rv.lightHeatmapCells().filter(c => c.onUid === uid && c.value != null);
    if (!cs.length) return null;
    const vs = cs.map(c => c.value);
    const bc = cs.reduce((a,c) => (c.value > a.value ? c : a));
    const at = { x: bc.x, y: bc.y, z: bc.z };
    const d = n => +L.dliAt(at, {...SKY, lampCount:n, occIdx:bc.occIdx}).dli.toFixed(3);
    return { n: cs.length, min:+Math.min(...vs).toFixed(3), max:+Math.max(...vs).toFixed(3),
             at:{x:+bc.x.toFixed(3), z:+bc.z.toFixed(3), y:+(bc.y??0).toFixed(3)},
             d0:d(0), d1:d(1), d2:d(2) };
  };
  const surf = (x,z) => { const s = rv.surfaceTopAt(x,z);
    return { y:s.y, onUid:s.onUid, occIdx:s.occIdx,
             dli:+L.dliAt({x, y:s.y, z}, {...SKY, occIdx:s.occIdx}).dli.toFixed(3) }; };
  const riders = () => { const m={}; for (const f of rv.furniture()) { const r=rv.ridersOf(f.uid);
                          if (r.length) m[f.uid]=r; } return m; };
  return { rv, L, SKY, furn, dli, surf, surfN, topCells, riders,
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
console.log(`   ${'자리'.padEnd(26)}${'y'.padStart(8)}${'등0'.padStart(9)}${'등1'.padStart(9)}${'등2'.padStart(9)}`);
for (const id of Object.keys(dli).sort())
  console.log(`   ${id.padEnd(26)}${P(dli[id].y, 3).padStart(8)}${P(dli[id].dli).padStart(9)}` +
              `${P(dli[id].d1).padStart(9)}${P(dli[id].d2).padStart(9)}` +
              `${id === 'banjiha-sill:0' ? '   ★ 창턱' : ''}`);
/* ★★ 이 자의 핵심 한 줄 — **등 하나로 갈라짐 문턱 6.0 을 넘나.** G-16 이 식물등을
   창 위로 옮겨 세운 것이 그 7.07 이고, 창턱을 방 쪽으로 밀면 그것이 먼저 깨진다. */
{
  const s = dli['banjiha-sill:0'];
  /* ⚠ 문턱은 **데이터에서 읽는다** — 2026-08-17 에 min 이 3.0 → 2.7 로 바뀌었다 */
  const _th = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/balance/light_thresholds.json'), 'utf8'))
                .plants.monstera_deliciosa;
  const FEN = _th.fenestrate, MIN = _th.min;
  console.log(`\n   ★★ 창턱 문턱 판정 — 정체선 ${MIN} · 갈라짐 문턱 ${FEN}`);
  console.log(`      등 0개 ${P(s.dli)}  ${s.dli >= MIN ? '✔ 자란다(느림 이상)' : '⛔ 정체 — 새 잎이 안 난다'}`);
  console.log(`      등 1개 ${P(s.d1)}  ${s.d1 >= FEN ? `✔ **갈라진다** (여유 ${(s.d1 - FEN).toFixed(2)})` : '⛔ **안 갈라진다**'}`);
  console.log(`      등 2개 ${P(s.d2)}  ${s.d2 >= FEN ? '✔ 갈라진다' : '⛔ 안 갈라진다'}`);
  REC.sillVerdict = { d0: s.dli, d1: s.d1, d2: s.d2, min: MIN, fen: FEN,
                      grows: s.dli >= MIN, fenestrates1: s.d1 >= FEN };
}

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
if (hasNS && PART === 'nightstand') {
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
} else if (PART === 'nightstand') {
  console.log(`\n[4] 세 겹 — 협탁이 아직 없어서 안 잰다 (tag=${TAG})`);
}

/* ══════════════════════════════════════════════════════════
   PART WINSTACK — ★ 「2단 세워서 창턱 비슷하게 두면 자라는 정도까지는 빛이 오나」
   ------------------------------------------------------------
   박사님: *"2단 세워서 창턱 비슷하게 배치되도록 하면 몬스테라가 **갈라짐은 안 되지만
     자라는 정도까지는** 빛이 들어오나?"*

   문턱 둘로 답한다 (`data/balance/light_thresholds.json §monstera_deliciosa`)
     · **자란다**   = DLI **3.0** 이상 (그 아래는 정체 — 새 잎이 안 난다)
     · **갈라진다** = DLI **6.0** 이상

   재는 법 — **실제로 쌓아 놓고** 그 상판에서 잰다. 허공에 대고 재지 않는다.
     ① 창 밑을 비운다(3단 선반·협탁을 방 뒤로 물린다)
     ② 밑짝을 창 밑에 놓고 → 그 위에 윗짝을 올리고 → `surfaceTopAt` 이 집는 면에서
        `dliAt` 을 등 0/1/2 로 잰다. 화면 빛 분포가 쓰는 그 길 그대로다
     ③ 조합마다 **원래 자리로 되돌려 놓고** 다음 조합으로 간다
   ⚠ 창턱(z −1.85·y 1.55)과 창 위 바 등(y 2.15)은 그대로 둔다 — 「창턱 비슷하게」의
     기준이 그 둘이다.
   ══════════════════════════════════════════════════════════ */
if (PART === 'winstack') {
  /* ⚠⚠ **문턱을 여기 적지 않는다. 읽는다.** 2026-08-17 에 다른 창이 `min` 을 3.0 → 2.7 로
     바꿨다(박사님 확정). 박아 뒀으면 이 자가 **없는 세상**을 재게 된다(§2.9-⑥). */
  const TH = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/balance/light_thresholds.json'), 'utf8'))
               .plants.monstera_deliciosa;
  const MIN = TH.min, FEN = TH.fenestrate;
  console.log(`\n████ PART WINSTACK — 창 밑에 두 겹을 쌓으면 자라는 자리가 되나 ████`);
  console.log(`   문턱: 자란다 ${MIN} · 갈라진다 ${FEN}`);

  /* ⚠⚠⚠ 여기서 자가 한 번 거짓말했다 — 첫 판을 통째로 버렸다.
     창 밑을 비우려고 **3단 선반을 방 뒤로 물렸더니 창 위 바 등이 따라갔다.**
     `ridersOf` 가 `banjiha-etagere → banjiha-growlight-bar` 이기 때문이다(선반이 등을 인다).
     그 판의 등1·등2 열은 **등이 딴 데 가 있는 방**을 잰 값이라 아무 뜻이 없었다.
     ⇒ 규칙 둘로 막는다:
       ① **3단 선반은 안 건드린다.** 창 밑 왼쪽·오른쪽 빈 자리만 쓴다
       ② 조합마다 **창턱 등1 이 6.02 인지 먼저 확인한다** — 그것이 「바 등이 제자리에
          있다」의 자다. 어긋나면 그 줄은 못 쓴다고 찍는다
     ★ 다만 **책상이 집게등을 이는 것은 그대로 둔다** — 그건 고장이 아니라 이 게임의 규칙이고
       (「등이 곧 길」), 플레이어가 책상을 창 밑으로 옮기면 실제로 집게등이 따라간다. */
  const SILL_D1_HOME = 6.02;
  const F0 = {}; for (const f of furn0) F0[f.uid] = f;
  const home = async (uid) => { const f = F0[uid]; if (!f) return;
    await Ja(`await __N.move('${uid}', {x:${f.x}, z:${f.z}, rot:${f.rot}, y:${f.y}, grid:false})`); };
  const sillNow = async () => (await J('__N.dli()'))['banjiha-sill:0'];

  const s0 = await sillNow();
  console.log(`   [자 확인] 손대기 전 창턱 — 등0 ${P(s0.dli)} · 등1 ${P(s0.d1)} · 등2 ${P(s0.d2)}`);

  /* 창 밑 빈 자리 — 창은 x −1.1~1.1. 3단 선반이 x −0.725~0.025 를 쓰고 있으므로
     그 **왼쪽**(침대 x ≤ −1.4 와 선반 사이)과 **오른쪽**(선반과 오른 벽 사이)이 빈다. */
  /* ⚠ **왼쪽은 애초에 못 쓴다** — 침대가 x −2.4~−1.4 를 차지하고 3단 선반이 −0.725~0.025 를
     쓰므로 그 사이 폭이 0.675m 다. 책상(1.25)도 서랍장(1.0)도 안 들어간다. 재서 확인했다
     (「선반-다단-3단 와(과) 겹칩니다」). ⇒ 창 밑에서 두 겹을 세울 수 있는 자리는
     **선반 오른쪽 한 곳뿐**이다. 그것도 이 표가 내는 답의 일부다. */
  /* ★★ 창 **한가운데**도 잰다 — 다만 그러려면 3단 선반을 물려야 하고, 그러면 바 등이
     따라간다(위 ⚠⚠). **등0(자연광) 은 등이 어디 있든 같은 값**이므로 그 열은 쓸 수 있고,
     등1·등2 열만 못 쓴다. 줄마다 붙는 lampOk 가 그것을 가른다.
     ⇒ 「자라나(문턱)」는 자연광 물음이므로 한가운데를 빼면 **답이 반쪽**이 된다.
       실제로 G-13(stack2-to-plan §4-②)이 여기서 **2.880** 을 냈다 — 그 자리를 재야 한다. */
  const SPOTS = [{ ko: '창 밑 오른쪽', x: 0.75, z: -1.625, park: [] },
                 { ko: '창 한가운데', x: -0.375, z: -1.625, park: ['banjiha-etagere'] }];
  const COMBOS = [['banjiha-desk', null], ['banjiha-desk', 'banjiha-nightstand'],
                  ['banjiha-dresser', null], ['banjiha-dresser', 'banjiha-nightstand'],
                  ['banjiha-desk', 'banjiha-dresser'], ['banjiha-desk', 'banjiha-etagere']];
  const MOV = ['banjiha-desk', 'banjiha-dresser', 'banjiha-nightstand', 'banjiha-chair'];
  /* 조합에 안 쓰는 옮길 수 있는 가구는 방 뒤로 물린다 — 안 그러면 서로 겹쳐서 못 놓는다 */
  const PARK = { 'banjiha-desk': { x: -0.5, z: 1.5 }, 'banjiha-dresser': { x: 2.15, z: 1.4 },
                 'banjiha-nightstand': { x: 0.6, z: 1.45 }, 'banjiha-chair': { x: 1.3, z: -0.85 } };
  const rows = [];
  console.log(`\n   한가운데 = 상판 복판에서 잰 값 · 제일밝은칸 = 그 상판의 칸 중 제일 밝은 것(등0/등1/등2)`);
  console.log(`   ${'자리'.padEnd(12)}${'조합'.padEnd(24)}${'상판 y'.padStart(8)}${'등0'.padStart(8)}${'등1'.padStart(8)}${'등2'.padStart(8)}${'제일밝은칸 0/1/2'.padStart(20)}   판정`);
  for (const sp of SPOTS) for (const [base, top] of COMBOS) {
    /* ★ 3단 선반을 먼저 제자리로 — 그래야 **바 등이 창 위로 돌아온다**(선반이 등을 인다).
       앞 판에서 이걸 빼먹어 등이 딴 데 간 채로 뒷줄을 다 쟀다. */
    await home('banjiha-etagere');
    /* 옮길 수 있는 것을 **전부** 방 뒤로 물린다 — 쓸 것까지 물려야 서로 안 걸린다 */
    for (const u of MOV)
      await Ja(`await __N.move('${u}', {x:${PARK[u].x}, z:${PARK[u].z}, rot:0, step:0.125})`);
    /* 이 자리가 요구하면 3단 선반도 물린다 (바 등이 따라간다 — 등 열은 못 쓴다) */
    for (const u of (sp.park || [])) {
      const pk = await Ja(`await __N.move('${u}', {x:0, z:0.9, rot:0, step:0.125})`);
      if (!pk.ok) { console.log(`   ⚠ ${sp.ko} · ${u} 를 못 물렸다: ${pk.reason}`); }
    }
    const mb = await Ja(`await __N.move('${base}', {x:${sp.x}, z:${sp.z}, rot:0, step:0.125})`);
    if (!mb.ok) { console.log(`   ⛔ ${sp.ko} · ${base}: ${mb.reason}`); continue; }
    const b = (await J('__N.furn()')).find(f => f.uid === base);
    let t = null;
    if (top) {
      const mt = await Ja(`await __N.move('${top}', {x:${b.x}, z:${b.z}, rot:0, step:0.125})`);
      if (!mt.ok) { console.log(`   ⛔ ${sp.ko} · ${base} 위 ${top}: ${mt.reason}`); continue; }
      t = (await J('__N.furn()')).find(f => f.uid === top);
      if (!(t.y > 0.05)) { console.log(`   ⛔ ${sp.ko} · ${top} 이 안 올라갔다 (y ${P(t.y, 3)})`); continue; }
    }
    const at = t || b;
    const s = await J(`__N.surfN(${at.x}, ${at.z})`);
    /* 상판의 **제일 밝은 칸** — 빛 분포를 켜야 칸이 생긴다 */
    await J(`__N.rv.setLightHeatmap(true, {weather:'clear', season:'summer', lampCount:0, litHours:12})`);
    await sleep(800);
    const cel = await J(`__N.topCells('${at.uid}')`);
    const sk = await sillNow();
    const lampOk = Math.abs(sk.d1 - SILL_D1_HOME) < 0.02;
    const V0 = cel ? cel.d0 : s.d0, V1 = cel ? cel.d1 : s.d1, V2 = cel ? cel.d2 : s.d2;
    rows.push({ spot: sp.ko, base, top, x: at.x, z: at.z, y: s.y, onUid: s.onUid,
                d0: s.d0, d1: s.d1, d2: s.d2, cell: cel, V0, V1, V2,
                layers: top ? 2 : 1, lampOk, sillD1: sk.d1 });
    console.log(`   ${sp.ko.padEnd(12)}` +
                `${(base.replace('banjiha-', '') + (top ? ' + ' + top.replace('banjiha-', '') : ' (한 겹)')).padEnd(24)}` +
                `${P(s.y, 3).padStart(8)}${P(s.d0).padStart(8)}${P(s.d1).padStart(8)}${P(s.d2).padStart(8)}` +
                `${(cel ? `${P(cel.d0)}/${P(cel.d1)}/${P(cel.d2)}` : '-').padStart(20)}   ` +
                /* ★ 판정은 **제일 밝은 칸**으로 한다 — 화분은 칸에 앉으므로 플레이어가
                   실제로 고를 수 있는 값이 그것이다. 한가운데 값은 참고다. */
                `${V0 >= MIN ? '✔ **자란다**' : '⛔ 정체'}` +
                `${V1 >= FEN ? ' · 등1로 갈라짐' : (V1 >= MIN ? ' · 등1이면 자란다' : '')}` +
                `${V2 >= FEN ? ' · 등2로 갈라짐' : ''}` +
                `${lampOk ? '' : `  ⚠ 바 등이 움직였다(창턱 등1 ${P(sk.d1)})`}`);
  }
  for (const u of MOV) await home(u);
  await home('banjiha-etagere');                 // 바 등을 창 위로 되돌린다

  const sillEnd = await sillNow();
  console.log(`\n   [자 확인] 되돌린 뒤 창턱 — 등0 ${P(sillEnd.dli)} · 등1 ${P(sillEnd.d1)} · 등2 ${P(sillEnd.d2)}` +
              `  ${Math.abs(sillEnd.d1 - SILL_D1_HOME) < 0.02 ? '✔ 바 등이 제자리다'
                 : '(⚠ 마지막 조합이 3단 선반을 옮겼으면 여기는 원래 빨갛다 — 선반을 내려도 등은 같이 내려앉는다. 줄마다의 lampOk 가 진짜 자다)'}`);
  console.log(`   ⇒ 등 열을 믿을 수 있는 줄 ${rows.filter(r => r.lampOk).length}/${rows.length}`);
  const good = rows.filter(r => r.lampOk);
  /* ★ 「제일 밝은 자리」도 칸 값으로 고른다. ⚠ 등 열이 못 미더운 줄도 **등0 은 쓴다** —
     자연광은 등이 어디 있든 같기 때문이다. 그래서 good(등 열용) 과 따로 고른다. */
  const bestAll = rows.reduce((a, r) => (!a || r.V0 > a.V0 ? r : a), null);
  const best = good.reduce((a, r) => (!a || r.V0 > a.V0 ? r : a), null);
  if (bestAll) {
    console.log(`
   ★★ 자연광(등0)으로 제일 밝은 두 겹: ` +
                `${bestAll.base.replace('banjiha-', '')}+${String(bestAll.top).replace('banjiha-', '')}` +
                ` @ ${bestAll.spot} · 상판 y ${P(bestAll.y, 3)} · **제일 밝은 칸 ${P(bestAll.V0)}**` +
                `  ${bestAll.V0 >= MIN ? `✔ **정체선 ${MIN} 을 넘는다 — 자란다**` : `⛔ 정체선 ${MIN} 을 못 넘는다`}`);
    console.log(`      (같은 상판 한가운데는 ${P(bestAll.d0)} 다 — **칸마다 다르다**. 창 쪽 칸이 밝다)`);
    console.log(`      갈라짐 ${FEN}: 등1 ${P(bestAll.V1)} ${bestAll.V1 >= FEN ? '✔' : '⛔'}` +
                ` · 등2 ${P(bestAll.V2)} ${bestAll.V2 >= FEN ? '✔' : '⛔'}` +
                `${bestAll.lampOk ? '' : '  ⚠ 이 줄의 등 열은 못 쓴다(바 등이 움직였다)'}`);
    console.log(`   ⇒ **「갈라짐은 안 되지만 자라는 정도까지는」 = ${bestAll.V0 >= MIN && bestAll.V2 < FEN ? '그렇다' : '아니다'}**`);
  }
  console.log(`\n   [견줌] 창턱 banjiha-sill:0 (y 1.585) — 등0 ${P(sillEnd.dli)} · 등1 ${P(sillEnd.d1)} · 등2 ${P(sillEnd.d2)}`);
  if (best) {
    console.log(`   ⇒ 두 겹 중 제일 밝은 자리: ${best.base.replace('banjiha-', '')}+${String(best.top).replace('banjiha-', '')}` +
                ` @ ${best.spot} · 상판 y ${P(best.y, 3)}`);
    console.log(`   ⇒ **자라나(${MIN})**: 등0 ${P(best.d0)} ${best.d0 >= MIN ? '✔' : '⛔'}` +
                ` · 등1 ${P(best.d1)} ${best.d1 >= MIN ? '✔' : '⛔'} · 등2 ${P(best.d2)} ${best.d2 >= MIN ? '✔' : '⛔'}`);
    console.log(`   ⇒ **갈라지나(${FEN})**: 등1 ${best.d1 >= FEN ? '✔' : '⛔'} · 등2 ${best.d2 >= FEN ? '✔' : '⛔'}`);
  }
  REC.winstack = { rows, sillStart: s0, sillEnd, best, MIN, FEN, SILL_D1_HOME };

  /* 제일 밝은 조합을 실제로 세워 놓고 빛 분포를 켠 채 사진 */
  if (best) {
    await home('banjiha-etagere');
    for (const u of MOV)
      await Ja(`await __N.move('${u}', {x:${PARK[u].x}, z:${PARK[u].z}, rot:0, step:0.125})`);
    await Ja(`await __N.move('${best.base}', {x:${best.x}, z:${best.z}, rot:0, step:0.125})`);
    if (best.top) await Ja(`await __N.move('${best.top}', {x:${best.x}, z:${best.z}, rot:0, step:0.125})`);
    await J(`__N.rv.setLightHeatmap(true, {weather:'clear', season:'summer', lampCount:0, litHours:12})`);
    await waitNoon(page);
    REC.shotWin = await shot(page, `banjiha_winstack_${TAG}.png`);
  }
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
