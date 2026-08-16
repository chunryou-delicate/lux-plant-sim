/* ============================================================
   tools/probe_twinleaf.mjs — **쌍둥이 잎을 이름으로 가를 수 있나**를 잰다 (2026-08-17 신설)
   ------------------------------------------------------------
   ── 왜 있나 ──────────────────────────────────────────────────
   박사님 원문: *"잘린 모주 쌍둥이 잎은 값을 공유한다는 게 뭐야? **각각 따로 자라야지**
   같이 자란다는 거야? **수정해.**"*

   ⇒ **잎은 이미 각각 따로 자란다.** 축(생장점)이 따로고 무늬 굴림도 따로다.
     문제는 자라는 것이 아니라 **이름표**였다 — 잎별 상태를 밖으로 내는 줄이
     `leafBirth` 하나로만 적혀 있어서, **쌍혹**(혹 하나에서 가지가 둘 · `growTopology ④`)
     에서 같은 날 난 두 잎이 **한 줄을 나눠 쓴다.** 그 줄에 「잘렸다」를 찍으면
     안 자른 쌍둥이까지 사라진다(실측 56판 중 25판 · `docs/handoff/cutleaf-to-plan.md` §5).

   ── 무엇을 켜고 무엇을 껐나 (★ 표 머리에 적는다 · START-HERE §2) ──
   대상은 **브라우저에서 실제로 도는 `plant_grow.html`** 이다(vm 스텁이 아니다).
   빛은 `setDailyLightSteady(12.16)` 로 못 박고, 진행도는 `setGrowth(day)` 로 세운다.
   낙엽은 **정본 기본값 그대로**(`drop_enabled` 를 안 건드렸다 = 초보에서 꺼져 있음).
   씨앗 14개 × 생장일 60·120·200·365 = 56판. `cutleaf` 창이 쓴 자와 **같은 판**이다.

     ①  ★쌍혹이 실제로 난 판을 찾는다 — `leafBirth` 가 겹치는 판 수 (없으면 아무것도 안 재는 것이다)
     ②  ★`leafAxisKeys()` 의 `leafKey` 가 **잎마다 유일한가** (중복 0)
     ③  ★그 열쇠가 `cuttableNodes()` 의 `leafKeys` 와 **맞물리는가** (같은 `axisPathsOf` 가 짓는다)
     ④  `leafState()` 줄에 `leafKeys`·`leafKey` 가 붙어 오나 · `perLeaf` 가 **잎마다 한 줄**인가
     ⑤  이름표를 못 내는 **옛 `plant_grow`** 를 흉내 내면 예전 길로 안전하게 떨어지나
     ⑥  ★★ **game.html §leafStateForRoom 의 진짜 코드**를 그대로 뽑아 물려서 잰다
         (베끼지 않는다 — 파일에서 함수를 떼어 와 돌린다. 베끼면 「자가 딴 세상 것」이 된다)
     ⑦  ★★★ **화면** — 실제 조립기(`plant_assemble`)로 그려 **잎 수를 전·후로 센다**
     ⑧  읽기 전용 — 새 접근자를 불러도 형태·성숙·잎 상태가 한 글자도 안 바뀌나
     ⑨  예외 0건 · 사진 (색 가짓수를 센다 · §2.9-③)

   ── 쓰는 법 ─────────────────────────────────────────────────
     python tools/serve.py 8963
     BYEOT_URL=http://localhost:8963 node tools/probe_twinleaf.mjs

   ⚠ 이 자는 **아무 파일도 안 고친다.** 재기만 한다(사진만 남긴다).
============================================================ */
import { launch, sleep } from './test_cdp.mjs';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const IMG = path.join(ROOT, 'docs/handoff/img/twinleaf');

const _WATCHDOG_MS = +(process.env.BYEOT_PROBE_TIMEOUT_MS || 600000);
const _wd = setTimeout(() => { console.error('⏱ 자가 제한을 넘겨 멈춥니다.'); process.exit(2); }, _WATCHDOG_MS);
_wd.unref && _wd.unref();
process.on('exit', () => clearTimeout(_wd));

const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const DAYS = [60, 120, 200, 365];
/* 92158 은 게임이 실제로 쓰는 씨앗이다(plant_assemble.js 기본값). cutleaf 창과 같은 목록을 쓴다. */
const SEEDS = [92158, 1, 5, 7, 33, 42, 101, 555, 777, 8888, 12345, 24601, 40503, 99999];
const DLI = 12.16;

let bad = 0;
const ok = (name, cond, got) => {
  console.log(`${cond ? '  OK' : 'FAIL'}  ${name}${got == null ? '' : '\n        → ' + got}`);
  if (!cond) bad++;
};
const line = (s) => console.log('        ' + s);

/* ── 사진이 살아 있나 — 색 가짓수를 센다 (§2.9-③) ────────────────
   까만 사진은 3색, 멀쩡한 사진은 3,000색이 넘는다. PNG 를 직접 풀어서 센다.
   (node 에 이미지 라이브러리가 없다. probe_char_moni.mjs 의 그 자를 그대로 쓴다) */
function pngColors(file) {
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
  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) return { w, h, colors: -1 };
  const bpp = colorType === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * bpp;
  const cur = Buffer.alloc(stride), prev = Buffer.alloc(stride);
  const set = new Set();
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
    for (let x = 0; x < w; x += 4) set.add((cur[x * bpp] << 16) | (cur[x * bpp + 1] << 8) | cur[x * bpp + 2]);
    cur.copy(prev);
  }
  return { w, h, colors: set.size };
}

const page = await launch({ width: 900, height: 760, dpr: 1 });
const errs = [];
/* ⚠ `page.on` 은 `(method, params)` 를 준다 — `m.method` 로 읽으면 **한 건도 안 잡힌다.**
   (probe_cutleaf.mjs 는 그렇게 적혀 있어 예외를 못 세고 있다. 여기서는 안 그런다) */
page.on((method, params) => {
  if (method === 'Runtime.exceptionThrown')
    errs.push((params.exceptionDetails.exception || {}).description || params.exceptionDetails.text);
});

async function shot(name, tag) {
  const f = path.join(IMG, `${name}.png`);
  await page.shot(f);
  let c = pngColors(f);
  if (c.colors >= 0 && c.colors < 200) { await sleep(1500); await page.shot(f); c = pngColors(f); }
  console.log(`  📷 ${path.relative(ROOT, f)}  색 ${c.colors}가지  ${tag || ''}`);
  return c.colors;
}

await page.goto(`${BASE}/plant_grow.html`);
await page.waitFor(`typeof cuttableNodes==='function' && typeof setGrowth==='function'
                    && typeof plantSeed==='function' && typeof thLoaded==='function' && thLoaded()`, 180000, 300);
await sleep(1500);

console.log('\n════════════════════════════════════════════════════════════════');
console.log(' probe_twinleaf — 쌍둥이 잎을 이름으로 가를 수 있나');
console.log(` 대상 ${BASE}/plant_grow.html · 씨앗 ${SEEDS.length}개 × 생장일 ${DAYS.join('·')} = ${SEEDS.length * DAYS.length}판`);
console.log(` 빛 setDailyLightSteady(${DLI}) 로 못박음 · 낙엽은 정본 기본값 그대로`);
console.log('════════════════════════════════════════════════════════════════');

/* ══════════════════════════════════════════════════════════════════════
   1차 — plant_grow 안에서 직접 (① ② ③ ⑧)
   ══════════════════════════════════════════════════════════════════════ */
console.log('\n══ ①②③⑧ · plant_grow.html 안에서 직접 잰다 ══');
const has = await page.eval(`typeof leafAxisKeys === 'function'`);
ok('⓪ plant_grow 에 leafAxisKeys() 접근자가 있다', has === true, `typeof = ${has}`);
if (!has) { console.log('\n접근자가 없어 더 못 잽니다.'); await page.close(); process.exit(1); }

const sweep = JSON.parse(await page.eval(`(()=>{
  const SEEDS=${JSON.stringify(SEEDS)}, DAYS=${JSON.stringify(DAYS)}, DLI=${DLI};
  const plates=[]; let nPlate=0, twinPlates=0, dupKeyTotal=0, countMismatch=0, interlockBad=0;
  const twinList=[];
  for(const seed of SEEDS) for(const day of DAYS){
    plantSeed(seed); matResetAll(); setDailyLightSteady(DLI); setGrowth(day);
    const keys=leafAxisKeys(), st=leafStats(), nodes=cuttableNodes();
    const root=nodes.find(n=>n.nodeId==='n0#0');
    nPlate++;
    /* ① leafBirth 가 겹치나 */
    const bc=new Map(); for(const r of keys) bc.set(r.leafBirth,(bc.get(r.leafBirth)||0)+1);
    const dupB=[...bc.entries()].filter(([,c])=>c>1);
    /* ② leafKey 가 유일한가 */
    const ks=new Set(); let dk=0;
    for(const r of keys){ if(ks.has(r.leafKey)) dk++; ks.add(r.leafKey); }
    dupKeyTotal+=dk;
    /* ③ 밑동 마디가 품은 열쇠 = 지금 달린 잎 전부 (같은 axisPathsOf 가 지었나) */
    const rk=[...((root&&root.leafKeys)||[])].sort().join(',');
    const ak=[...ks].sort().join(',');
    if(rk!==ak) interlockBad++;
    /* 잎 수가 맞나 — leafStats 는 떨어진 잎을 뺀다. 초보 기본값에서는 낙엽이 없다 */
    if(keys.length!==st.leaves) countMismatch++;
    if(dupB.length){
      twinPlates++;
      twinList.push({seed, day, leaves:st.leaves,
        pairs:dupB.map(([b,c])=>({b, c, keys:keys.filter(r=>r.leafBirth===b).map(r=>r.leafKey)}))});
    }
    plates.push({seed, day, leaves:st.leaves, keys:keys.length, dupBirth:dupB.length, dupKey:dk,
                 interlock: rk===ak});
  }
  /* ⑧ 읽기 전용 — 새 접근자를 불러도 아무것도 안 바뀌나 */
  const snap=()=>{ plantSeed(92158); matResetAll(); setDailyLightSteady(DLI); setGrowth(200);
    return JSON.stringify({n:cuttableNodes(), s:leafStats(), m:matStateAll(),
                           h:leafHealthAll(), v:varieStateAll()}); };
  const before=snap();
  plantSeed(92158); matResetAll(); setDailyLightSteady(DLI); setGrowth(200);
  for(let i=0;i<40;i++) leafAxisKeys();
  const after=JSON.stringify({n:cuttableNodes(), s:leafStats(), m:matStateAll(),
                              h:leafHealthAll(), v:varieStateAll()});
  return JSON.stringify({plates, nPlate, twinPlates, dupKeyTotal, countMismatch,
                         interlockBad, twinList, pure: before===after});
})()`));

ok(`① ★쌍혹이 난 판을 실제로 찾았다 — ${sweep.twinPlates}/${sweep.nPlate}판에서 leafBirth 가 겹친다`,
   sweep.twinPlates > 0,
   sweep.twinPlates > 0 ? `겹치는 판이 없으면 아무것도 안 재는 것이다. 있다.`
                        : `겹치는 판이 0 이다 — 이 자는 지금 아무것도 안 재고 있다`);
ok('② ★leafKey 가 잎마다 유일하다 (56판 전수 · 중복 0)',
   sweep.dupKeyTotal === 0, `중복 ${sweep.dupKeyTotal}건`);
ok('③ ★leafAxisKeys() 의 열쇠 = cuttableNodes("n0#0").leafKeys (맞물린다)',
   sweep.interlockBad === 0, `안 맞은 판 ${sweep.interlockBad}개`);
ok('   leafAxisKeys() 줄 수 = leafStats().leaves (열쇠가 새거나 남지 않는다)',
   sweep.countMismatch === 0, `안 맞은 판 ${sweep.countMismatch}개`);
ok('⑧ ★읽기 전용 — 40번 불러도 형태·성숙·잎 상태가 한 글자도 안 바뀐다', sweep.pure);

console.log('\n  ★ 쌍혹이 난 판 (겹친 leafBirth · 그 값을 나눠 쓰는 잎들의 이름표):');
console.log('   씨앗      일   잎  겹친birth  나눠 쓰는 이름표');
for (const t of sweep.twinList.slice(0, 12))
  for (const p of t.pairs)
    console.log(`   ${String(t.seed).padStart(6)} ${String(t.day).padStart(5)} ${String(t.leaves).padStart(4)}  `
      + `${String(p.b).padStart(8)}   ${p.keys.join('  ·  ')}`);
if (sweep.twinList.length > 12) line(`… 그 밖 ${sweep.twinList.length - 12}판 생략`);

/* 이 아래 모든 잣대가 쓸 **쌍혹 판** 하나를 고른다.
   ★ 쌍혹이 **하나뿐**이고(읽기 쉽다) 그중 **잎이 제일 많은** 판을 고른다 — 잎이 많다는 것은
     그 쌍둥이가 이미 다 큰 잎이라는 뜻이라 **사진에서 눈으로 셀 수 있다.**
     (처음엔 잎 5장짜리를 골랐는데 쌍둥이가 둘 다 말린 새순이라 사진으로는 차이가 잘 안 보였다) */
const TW = sweep.twinList.filter(t => t.pairs.length === 1)
                         .sort((a, b) => b.leaves - a.leaves)[0] || sweep.twinList[0];
const TWB = TW.pairs[0].b, TWK = TW.pairs[0].keys.slice().sort();
console.log(`\n  ⇒ 아래 잣대가 쓸 판: seed ${TW.seed} · 유효 ${TW.day}일 · 잎 ${TW.leaves}장`);
console.log(`     겹친 leafBirth ${TWB} 을 ${TWK.join(' 와 ')} 두 잎이 나눠 쓴다`);

/* ══════════════════════════════════════════════════════════════════════
   2차 — 진짜 어댑터 + game.html 의 진짜 함수 (④ ⑤ ⑥)
   ══════════════════════════════════════════════════════════════════════ */
console.log('\n══ ④⑤⑥ · growth_adapter 와 game.html 의 **진짜 코드**를 물려서 잰다 ══');
const ad = JSON.parse(await page.eval(`(async ()=>{
  const M = await import('${BASE}/src/game/growth_adapter.js');
  const ifr = document.createElement('iframe');
  ifr.style.cssText='position:fixed;left:-9999px;width:600px;height:400px';
  ifr.src='${BASE}/plant_grow.html';
  document.body.appendChild(ifr);
  await new Promise(r=>{ ifr.onload=r; setTimeout(r, 60000); });
  const ad = M.createGrowthAdapter(ifr);
  await ad.ready(60000);
  const w = ifr.contentWindow;
  window.__ad = ad; window.__w = w;
  const out={};
  const stand=(seed, day)=>{ w.plantSeed(seed); w.matResetAll(); w.setDailyLightSteady(${DLI}); w.setGrowth(day); };

  /* ── ④ 쌍혹 판에서 줄에 이름표가 붙어 오나 ─────────────────── */
  stand(${TW.seed}, ${TW.day});
  const ls = ad.leafState();
  out.rows = ls;
  out.hasCols = ls.every(r => Array.isArray(r.leafKeys) && 'leafKey' in r);
  const twinRow = ls.find(r => r.leafBirth === ${TWB});
  out.twinRow = twinRow;
  out.twinRowKeys = twinRow ? twinRow.leafKeys : null;
  out.twinRowKeyNull = !!twinRow && twinRow.leafKey === null;
  /* 옛 칸이 하나도 안 없어졌나 */
  out.oldCols = ls.every(r => 'leafBirth' in r && 'varie' in r && 'matured' in r
                              && 'fade' in r && 'dropped' in r);
  /* perLeaf — 잎마다 한 줄 · 이름표 전부 유일 */
  const per = ad.leafState({perLeaf:true});
  out.perLen = per.length; out.baseLen = ls.length;
  const seen=new Set(); let dup=0, nullKey=0;
  for(const r of per){ if(r.leafKey==null){ nullKey++; continue; } if(seen.has(r.leafKey)) dup++; seen.add(r.leafKey); }
  out.perDup = dup; out.perNullKey = nullKey;
  out.perKeys = [...seen].sort();
  /* ③ 다시 — 어댑터를 통해서도 cuttableNodes 와 맞물리나 */
  const root = ad.cuttableNodes().find(n=>n.nodeId==='n0#0');
  out.rootKeys = [...(root.leafKeys||[])].sort();
  out.interlock = out.perKeys.join(',')===out.rootKeys.join(',');

  /* ── ⑥ game.html 의 **진짜** leafStateForRoom 을 파일에서 떼어 온다 ── */
  const gsrc = await (await fetch('${BASE}/game.html')).text();
  const at = gsrc.indexOf('function leafStateForRoom(p) {');
  if(at < 0) { out.fnErr='game.html 에서 leafStateForRoom 을 못 찾았다'; return JSON.stringify(out); }
  let i = gsrc.indexOf('{', at), depth = 0, end = -1;
  for(let j=i;j<gsrc.length;j++){ const c=gsrc[j];
    if(c==='{') depth++; else if(c==='}'){ depth--; if(depth===0){ end=j+1; break; } } }
  const fnSrc = gsrc.slice(at, end);
  out.fnLen = fnSrc.length;
  out.fnTail = fnSrc.slice(-90);
  const warns=[];
  const mk = new Function('io','console',
    'let leafDropWarned=false; return ' + fnSrc + ';');
  const lsForRoom = mk({growth: ad}, {warn:(...a)=>warns.push(a.join(' ')), log(){}, error(){}});
  window.__lsForRoom = lsForRoom; window.__warns = warns;

  /* ⑥-1 쌍혹이 **안 섞인** 마디를 자른다 — 줄이 정확히 지워지나 */
  const nodes = ad.cuttableNodes();
  const twinKeys = new Set(${JSON.stringify(TWK)});
  const clean = nodes.filter(n => (n.leafKeys||[]).length
                              && !(n.leafKeys||[]).some(k=>twinKeys.has(k)))
                     .sort((a,b)=>(b.leafKeys.length-a.leafKeys.length))[0];
  out.cleanNode = clean ? {nodeId:clean.nodeId, keys:clean.leafKeys, births:clean.leafBirths} : null;
  if(clean){
    const r = lsForRoom({cuts:[{nodeId:clean.nodeId}]});
    out.cleanDropped = r.filter(x=>x.dropped).map(x=>x.leafBirth);
    out.cleanDropRows = r.filter(x=>x.dropped).length;
    out.cleanRows = r;
  }
  /* ⑥-2 ★ 쌍혹의 **한쪽만** 자른다 */
  const half = nodes.filter(n => { const k=n.leafKeys||[];
      return k.length && k.some(x=>twinKeys.has(x)) && !${JSON.stringify(TWK)}.every(x=>k.includes(x)); })
    .sort((a,b)=>a.leafKeys.length-b.leafKeys.length)[0];
  out.halfNode = half ? {nodeId:half.nodeId, keys:half.leafKeys, births:half.leafBirths} : null;
  if(half){
    const r = lsForRoom({cuts:[{nodeId:half.nodeId}]});
    out.halfDropped = r.filter(x=>x.dropped).map(x=>x.leafBirth);
    out.halfTouchedTwin = r.some(x=>x.leafBirth===${TWB} && x.dropped);
    out.halfRows = r;
  }
  out.warns = warns.slice();

  /* ── ⑤ 옛 plant_grow 흉내 — leafAxisKeys 를 지우면 예전 길로 떨어지나 ── */
  const keep = w.leafAxisKeys;
  try {
    w.leafAxisKeys = undefined;
    const old = ad.leafState();
    out.oldNoCols = old.every(r => !('leafKeys' in r) && !('leafKey' in r));
    out.oldPerLeaf = ad.leafState({perLeaf:true});          // null 이어야 한다
    if(clean){
      const r2 = lsForRoom({cuts:[{nodeId:clean.nodeId}]});
      out.oldCleanDrop = r2.filter(x=>x.dropped).map(x=>x.leafBirth);
    }
    if(half){
      const r3 = lsForRoom({cuts:[{nodeId:half.nodeId}]});
      out.oldHalfDrop = r3.filter(x=>x.dropped).map(x=>x.leafBirth);
    }
  } finally { w.leafAxisKeys = keep; }
  return JSON.stringify(out);
})()`));

ok('④-1 leafState() 줄마다 leafKeys·leafKey 칸이 붙어 온다', ad.hasCols === true);
ok('④-2 ★기존 칸(leafBirth·varie·matured·fade·dropped)이 **하나도 안 없어졌다**', ad.oldCols === true);
ok(`④-3 ★쌍혹 줄이 이름표 둘을 낸다 — leafBirth ${TWB}`,
   Array.isArray(ad.twinRowKeys) && ad.twinRowKeys.length === 2,
   `leafKeys = ${JSON.stringify(ad.twinRowKeys)}`);
ok('④-4 ★못 가르는 줄의 leafKey 는 **null** 이다 (0 이나 아무 값으로 안 메꾼다)',
   ad.twinRowKeyNull === true, `leafKey = ${JSON.stringify(ad.twinRow && ad.twinRow.leafKey)}`);
ok(`④-5 ★perLeaf 는 **잎마다 한 줄** — 이름표 전부 유일 (중복 ${ad.perDup}건)`,
   ad.perDup === 0 && ad.perLen > ad.baseLen,
   `기본 ${ad.baseLen}줄 → perLeaf ${ad.perLen}줄 (쌍혹 하나만큼 늘었다) · 이름 없는 줄 ${ad.perNullKey}개`);
ok('③′ ★perLeaf 의 이름표 집합 = cuttableNodes("n0#0").leafKeys — **맞물린다**',
   ad.interlock === true,
   `leafState → ${ad.perKeys.join(',')}\n          cuttableNodes → ${ad.rootKeys.join(',')}`);

console.log('');
line(`game.html 에서 떼어 온 leafStateForRoom — ${ad.fnLen}글자 (베끼지 않고 파일에서 뽑았다)`);
if (ad.fnErr) ok('⑥ game.html 의 함수를 떼어 왔다', false, ad.fnErr);
ok('⑥-1 ★쌍혹이 안 섞인 마디를 자르면 그 잎 줄이 **정확히** 지워진다',
   !!ad.cleanNode && ad.cleanDropRows === ad.cleanNode.keys.length,
   `${ad.cleanNode && ad.cleanNode.nodeId} · 잘린 잎 ${ad.cleanNode && ad.cleanNode.keys.length}장`
   + ` → 지운 줄 ${ad.cleanDropRows}개 (${(ad.cleanDropped || []).join(',')})`);
ok('⑥-2 ★★ 쌍혹의 **한쪽만** 잘랐을 때 쌍둥이 줄에 손을 안 댄다 (안 자른 잎이 안 사라진다)',
   ad.halfNode ? ad.halfTouchedTwin === false : false,
   `${ad.halfNode && ad.halfNode.nodeId} (잎 ${ad.halfNode && ad.halfNode.keys.join('·')})`
   + ` → 지운 줄 ${JSON.stringify(ad.halfDropped)}`);
if ((ad.warns || []).length) line('경고: ' + ad.warns.map(s => s.slice(0, 150)).join('\n        '));

console.log('');
ok('⑤-1 ★이름표를 못 내는 옛 plant_grow → leafState 에 칸 자체가 안 붙는다',
   ad.oldNoCols === true);
ok('⑤-2 ★그때 perLeaf 는 **null** 이다 (빈 배열도 옛 모양도 아니다)',
   ad.oldPerLeaf === null, `perLeaf → ${JSON.stringify(ad.oldPerLeaf)}`);
ok('⑤-3 ★그때도 예전 길(세는 길)로 안전하게 떨어진다',
   JSON.stringify(ad.oldCleanDrop) === JSON.stringify(ad.cleanDropped),
   `옛 길 ${JSON.stringify(ad.oldCleanDrop)} · 새 길 ${JSON.stringify(ad.cleanDropped)}`);
/* ★★ 여기서 **옛 길이 안전하지 않았다는 것**이 드러났다 — 짐작이 아니라 재서 나왔다.
   옛 길은 「잘라 낸 장수와 화면에 있는 장수가 같을 때만」 지웠는데, 그 「화면에 있는 장수」를
   **`leafState()` 의 줄 수**로 셌다. 줄은 `leafBirth` 하나에 하나뿐이라 쌍혹이어도 늘 1 이다.
   ⇒ 한쪽만 잘라도 want 1 = have 1 로 **딱 맞아 버려서** 그 줄을 지웠고, 쌍둥이가 같이 사라졌다.
   그 길은 이제 **이름표를 못 내는 옛 `plant_grow`** 에서만 탄다. */
ok('⑤-4 ★★[찾은 것] 옛 길은 한쪽만 잘린 쌍혹에서 **쌍둥이를 같이 지웠다** — 새 길이 막은 것이 이것이다',
   Array.isArray(ad.oldHalfDrop) && ad.oldHalfDrop.includes(TWB),
   `옛 길이 지운 줄 ${JSON.stringify(ad.oldHalfDrop)} ← 잘린 잎은 ${TWK[0]} 한 장인데 `
   + `${TWB} 줄을 통째로 지웠다(그 줄은 ${TWK.join('·')} 두 잎이 나눠 쓴다).\n`
   + `          새 길은 같은 자리에서 ${JSON.stringify(ad.halfDropped)} — 손을 안 댄다.`);

/* ══════════════════════════════════════════════════════════════════════
   3차 — ★★★ 화면 (⑦) · 실제 조립기로 그려 **잎 수를 센다**
   ══════════════════════════════════════════════════════════════════════ */
console.log('\n══ ⑦ ★★★ 화면 — plant_assemble 로 실제로 그려 잎 수를 센다 ══');
const scr = JSON.parse(await page.eval(`(async ()=>{
  const m = await import('${BASE}/src/render3d/plant_assemble.js');
  const asm = await m.getPlantAssembler({});
  window.__asm = asm;
  const ad = window.__ad, w = window.__w;
  const stand=()=>{ w.plantSeed(${TW.seed}); w.matResetAll(); w.setDailyLightSteady(${DLI}); w.setGrowth(${TW.day}); };
  stand();
  /* ★ 잎을 **이름으로** 센다. buildPlant 이 잎 메시마다 userData 에 part:'leaf' 와
     축 경로 axisKey 를 달아 둔다(plant_grow §tagNew) — 그 축 이름이 곧 leafKey 다.
     ⚠ 이 블록은 템플릿 문자열 안이다 — **역따옴표를 쓰지 마라**(문자열이 그 자리에서 끝난다).
     ⚠ assetKey 로 세면 안 된다. 갓 난 잎(말린 새순)은 다른 GLB 라 안 세어져서
       「잎 5장짜리 그루가 3장」으로 나온다 — 처음에 그 자로 재서 표가 거짓말을 했다(§2.9-⑦). */
  const leavesOf=(g)=>{ const s=new Set();
    g.traverse(o=>{ const u=o.userData; if(u && u.part==='leaf' && u.axisKey) s.add(u.axisKey); });
    return [...s].sort(); };
  const build=(rows)=>{ const g=asm.assemble({growthDays:${TW.day}, seed:${TW.seed}, potD:0.20,
                                              leafState:rows}); const k=leavesOf(g);
                        return {n:k.length, keys:k, g}; };
  const out={};
  /* 기준 — 아무것도 안 잘랐다 */
  const base = ad.leafState();
  const b0 = build(base); out.base = b0.n; out.baseKeys = b0.keys;
  window.__gBase = b0.g;
  /* ★ 화면이 그린 잎 이름 = 정본이 낸 이름표인가 (자가 딴 세상 것이 아닌지 먼저 확인) */
  out.rootKeys = [...(ad.cuttableNodes().find(n=>n.nodeId==='n0#0').leafKeys||[])].sort();

  /* ㉠ 쌍혹이 안 섞인 마디를 자른 줄 (game.html 의 진짜 함수가 낸 줄) */
  const cleanRows = window.__lsForRoom({cuts:[{nodeId:${JSON.stringify(ad.cleanNode && ad.cleanNode.nodeId)}}]});
  const c0 = build(cleanRows); out.clean = c0.n; out.cleanKeys = c0.keys;
  window.__gClean = c0.g;

  /* ㉡ ★ 쌍혹의 한쪽만 자른 줄 (지금 코드가 실제로 내는 줄) */
  const halfRows = window.__lsForRoom({cuts:[{nodeId:${JSON.stringify(ad.halfNode && ad.halfNode.nodeId)}}]});
  const h0 = build(halfRows); out.half = h0.n; out.halfKeys = h0.keys;
  window.__gHalf = h0.g;

  /* ㉢ ★★ **가능했다면** 어땠을까 — 잎 한 장짜리 줄에 직접 「잘렸다」를 찍어 본다.
     이것이 이 창이 뚫으려던 자리다. 한 장만 사라져야 맞다. */
  const per = ad.leafState({perLeaf:true});
  const ideal = per.map(r => (r.leafKey === ${JSON.stringify(TWK[1])} ? {...r, dropped:true} : r));
  const i0 = build(ideal); out.ideal = i0.n; out.idealKeys = i0.keys;
  out.idealKey = ${JSON.stringify(TWK[1])};

  /* ㉣ 대조 — 쌍둥이 **둘 다** 잘렸다고 찍으면 몇 장이 사라지나 */
  const both = per.map(r => (${JSON.stringify(TWK)}.includes(r.leafKey) ? {...r, dropped:true} : r));
  const t0 = build(both); out.both = t0.n; out.bothKeys = t0.keys;

  /* ㉤ 옛 길(이름표 없는 plant_grow)이 한쪽만 잘린 쌍혹에 무엇을 하나 — 화면으로 확인한다 */
  const keep = w.leafAxisKeys;
  try { w.leafAxisKeys = undefined;
        const oldRows = window.__lsForRoom({cuts:[{nodeId:${JSON.stringify(ad.halfNode && ad.halfNode.nodeId)}}]});
        const o0 = build(oldRows); out.oldHalf = o0.n; out.oldHalfKeys = o0.keys;
        window.__gOldHalf = o0.g;
  } finally { w.leafAxisKeys = keep; }
  return JSON.stringify(out);
})()`));

const wantClean = (ad.cleanNode && ad.cleanNode.keys.length) || 0;
const row = (t, k) => `  ${t.padEnd(34)} 잎 ${String(k.length).padStart(2)}장  ${k.join(' · ')}`;
console.log(row('기준(안 자름)', scr.baseKeys));
console.log(row(`㉠ 쌍혹 안 섞인 마디 ${ad.cleanNode && ad.cleanNode.nodeId} 를 자름`, scr.cleanKeys));
console.log(row(`㉡ ★쌍혹 한쪽만 ${ad.halfNode && ad.halfNode.nodeId} 를 자름`, scr.halfKeys));
console.log(row(`㉢ ★★${scr.idealKey} 줄 한 장에 직접 찍음`, scr.idealKeys));
console.log(row('㉣ 쌍둥이 둘 다 찍음', scr.bothKeys));
console.log(row('㉤ 옛 길(이름표 없음)로 ㉡ 을 다시', scr.oldHalfKeys));

ok('⑦-0 ★화면이 그린 잎 이름 = 정본이 낸 이름표 (자가 딴 세상 것이 아니다)',
   scr.baseKeys.join(',') === scr.rootKeys.join(','),
   `화면 ${scr.baseKeys.join(',')}\n          정본 ${scr.rootKeys.join(',')}`);
ok('⑦-1 ★화면 — 쌍혹이 안 섞인 마디를 자르면 **그 잎만큼만** 사라진다',
   scr.base - scr.clean === wantClean, `${scr.base} → ${scr.clean} (${scr.base - scr.clean}장)`);
ok('⑦-2 ★★ 쌍혹의 한쪽만 잘랐을 때 **안 자른 쌍둥이가 안 사라진다** (새 길)',
   scr.base - scr.half === 0, `${scr.base} → ${scr.half}`);
ok('⑦-2′ ★★ 옛 길은 그 자리에서 **쌍둥이를 둘 다 지웠다** — 새 길이 막은 것이 이것이다',
   scr.base - scr.oldHalf === 2,
   `옛 길 ${scr.base} → ${scr.oldHalf} (${scr.base - scr.oldHalf}장 사라짐 · 자른 잎은 1장인데)`);
const idealGone = scr.base - scr.ideal;
ok('⑦-3 ★★★ 잎 한 장짜리 줄에 「잘렸다」를 찍으면 **그 한 장만** 사라진다',
   idealGone === 1,
   idealGone === 1 ? `${scr.base} → ${scr.ideal}`
     : `${scr.base} → ${scr.ideal} — **${idealGone}장이 사라졌다.** 이름표는 여기까지 왔지만\n`
       + `          그 뒤 길이 아직 leafBirth 로 좁혀진다:\n`
       + `          render3d/plant_assemble.js §__setLeafState 가 LEAF_HEALTH.set(leafBirth, …) 로 앉히고\n`
       + `          plant_grow 의 그리기는 leafDroppedOf(leafBirth) 로 본다 —\n`
       + `          두 잎이 같은 칸을 나눠 쓰므로 한 장만 뺄 창구가 아직 없다.\n`
       + `          ⇒ 그 파일은 이 창의 쓰기 영역 밖이다. 못 했다(handoff §못 한 것).`);

/* ── 사진 (⑨) — 조립한 그루를 이 페이지 무대에 얹어 실제로 찍는다 ───────── */
/* ⚠⚠ **처음 찍은 판은 튜닝 패널이 화면을 거의 다 덮고 있었다.** 색 가짓수는 3,352 라
   ✅ 가 떴는데 그 색은 **UI 의 색**이었고 식물은 패널 뒤에 있었다 — probe_branchcut §⑦ 이
   똑같이 밟았던 함정이다(§2.9-③ · 사진을 눈으로 안 봤으면 그대로 넘어갔다).
   ⇒ 캔버스만 남기고 다 감춘다. 그러고도 색이 많으면 그건 **식물의 색**이다. */
await page.eval(`(() => {
  const cv = document.querySelector('canvas');
  const keep = new Set(); for (let e = cv; e; e = e.parentElement) keep.add(e);
  document.querySelectorAll('body *').forEach(e => {
    if (!keep.has(e) && !e.contains(cv)) e.style.display = 'none';
  });
  return true; })()`);
fs.mkdirSync(IMG, { recursive: true });
const shots = [];
for (const [name, gvar, tag] of [
  ['before_cut', '__gBase', `자르기 전 — 잎 ${scr.base}장 (${scr.baseKeys.join(' · ')})`],
  ['after_cut', '__gClean', `쌍혹 안 섞인 ${ad.cleanNode && ad.cleanNode.nodeId} 를 자른 뒤 — 잎 ${scr.clean}장`],
  ['twin_new', '__gHalf', `★쌍혹 한쪽만 자름 · 새 길 — 잎 ${scr.half}장 (쌍둥이가 남아 있다)`],
  ['twin_old', '__gOldHalf', `★같은 자리 · 옛 길 — 잎 ${scr.oldHalf}장 (쌍둥이가 같이 사라졌다)`]]) {
  await page.eval(`(()=>{
    plantGroup.visible=false;
    if(window.__shown) scene.remove(window.__shown);
    window.__shown = window.${gvar};
    window.__shown.position.set(0,0,0);
    scene.add(window.__shown);
    /* ★ 조립기가 낸 그루는 화분 지름 0.20m 짜리라 **이 창의 기본 카메라로는 손톱만 하다**
       (기본은 r 14 · 타깃 y 1.1 — 튜닝창의 큰 그루에 맞춰 둔 값이다). 실제로 그렇게 두 판 찍었다.
       ⚠⚠ 그리고 **거리(r)를 줄여도 안 커진다** — 이 창의 카메라는 **직교(Orthographic)** 라
         크기를 정하는 것은 zoom 이다. r 만 줄여 놓고 「가까이 갔다」고 여겨 또 한 판 헛찍었다.
         ⚠ 이 블록은 템플릿 문자열 안이다 — **역따옴표를 쓰지 마라.**
         (§2.9 — 숫자가 이상하면 재는 자를 먼저 의심하라. 여기서는 카메라가 그 자였다)
       ⚠ 색 가짓수는 이 함정을 **못 잡는다**(작아도 색은 많다). 사진을 눈으로 봐야 잡힌다. */
    /* ★ 그루 크기에 맞춰 **자동으로** 맞춘다. 값을 손으로 박으면 판이 바뀔 때마다
       (잎 5장 → 9장) 화면 밖으로 나가거나 손톱만 해진다 — 둘 다 실제로 한 판씩 찍었다. */
    const bb=new THREE.Box3().setFromObject(window.__shown);
    const h=Math.max(0.01, bb.max.y-bb.min.y), w=Math.max(0.01, bb.max.x-bb.min.x, bb.max.z-bb.min.z);
    orbit.az=0.9; orbit.el=0.22; orbit.r=6;
    orbit.tx=(bb.min.x+bb.max.x)/2; orbit.ty=(bb.min.y+bb.max.y)/2; orbit.tz=(bb.min.z+bb.max.z)/2;
    orbit.zoom=Math.min((cam.top-cam.bottom)/(h*1.35), (cam.right-cam.left)/(w*1.6));
    updateCam();
    return 1; })()`);
  await sleep(1400);
  shots.push({ name, colors: await shot(name, tag) });
}
/* ⚠ 문턱을 500 이 아니라 **100** 으로 둔다. 이 사진에는 **UI 가 한 조각도 없다**(위에서 다 감췄다) —
   화면 대부분이 어두운 바닥이라 색이 수백 가지다. UI 가 들어간 사진의 3,000색과 견주면 안 된다
   (그 3,000색이 바로 「식물은 안 보이는데 통과한」 그 숫자였다). 까만 사진은 여전히 3색이다. */
for (const s of shots)
  ok(`⑨ 사진 ${s.name} — 색 가짓수 (§2.9-③ · 까만 사진은 3색 · UI 없는 사진이라 문턱 100)`,
     s.colors > 100, `${s.colors}색`);

ok('⑨ 예외 0건', errs.length === 0, errs.length ? errs.slice(0, 4).join('\n        ') : '없음');

console.log('\n════════════════════════════════════════════════════════════════');
console.log(bad ? `  ✗ ${bad}건 실패` : '  ✓ 전부 통과');
console.log('════════════════════════════════════════════════════════════════\n');
await page.close();
process.exit(bad ? 1 : 0);
