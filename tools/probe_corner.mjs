/* ============================================================
   tools/probe_corner.mjs — **바닥과 벽이 만나는 모서리**를 재는 자
   (2026-08-16 신설 · 2026-08-17 다시 지음)

       python tools/serve.py 8963
       BYEOT_URL=http://localhost:8963 node tools/probe_corner.mjs --tag=after
       … --t=0.5       하루 어디를 잴지 (밑값 0.50 한낮)
       … --room=banjiha

   ── 왜 다시 지었나 ──────────────────────────────────────────
   첫 판은 **모서리 선 위의 「튐」 하나만** 쟀다. 그것으로 그림자 어긋남(peter-panning)은
   잡았는데, 박사님이 같은 곳을 **두 번째로** 지적하셨다 — *"하단부 모서리 빛처리
   마무리 안 됐어"*. 남은 것이 세 갈래인데 **첫 판의 자로는 셋 다 안 잡힌다.**

     ① **구석 이음새** — 바깥 네 구석에서 벽이 **빈 칸**과 **두 겹 칸**을 만든다.
        두 겹은 밑동 윗면이 같은 평면이라 **z-fighting(계단 톱니)** 이 난다.
        ⇒ ★ 이건 화소로 재기 전에 **기하로** 재야 한다. 상자들의 월드 범위를 받아
          구석 칸을 몇 번 덮는지 세면 「0번」과 「2번」이 그냥 나온다. 눈이 필요 없다.
     ② **밑동 윗면의 밝은 띠** — 컷어웨이로 내려간 벽(밑동 10cm)의 **윗면**이
        바깥쪽 8cm 만 환하다. 벽면보다도 바닥보다도 밝다.
     ③ 첫 판이 재던 **모서리 마루**(선 위의 튐) — 그대로 이어서 잰다.

   ── 재는 자가 거짓말한 두 가지 (여기서 막는다 · START-HERE §2.9) ──────────
   ⚠⚠ **그림자맵은 「해가 움직였을 때만」 다시 굽는다.** `scene.js` 가
      `shadow.autoUpdate=false` 를 걸고 `room_view` 는 해가 0.004rad 넘게 움직인
      프레임에만 `needsUpdate` 를 올린다. 그래서 **같은 시각을 두 번 넣으면**
      낡은 그림자맵이 그대로 쓰인다 — 방이 **통째로 밝게** 찍히고 「그림자가 없다」는
      결론이 나온다. 실제로 그렇게 나왔다. ⇒ 찍기 직전에 `needsUpdate` 를 **손으로** 올린다.
   ⚠⚠ **`setDaylight` 는 game.html 의 시계가 계속 되돌린다.** 멈추지 않고 재면
      한낮을 넣어도 **새벽 사진**이 찍힌다(새벽엔 방이 캄캄해서 띠가 안 보인다).
      ⇒ `setPaused(true)` 로 rAF 를 먼저 끊고, 그린 다음 찍는다.
   ⚠ 색 가짓수로 사진이 제대로 찍혔는지 본다(까만 사진 3,2xx · 멀쩡한 사진 8,000 이상).
      못 미치면 **재지 않고 죽는다.** 까만 사진에서도 「튐 0」은 나온다.

   ⚠ 이 자는 아무 파일도 안 고친다. 재기만 한다.
============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { launch, sleep } from './test_cdp.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const arg = (k, d) => { const a = process.argv.find(v => v.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const TAG = arg('tag', 'before');
const DAY_T = parseFloat(arg('t', '0.5')) || 0.5;
const OUT = path.join(ROOT, 'docs/handoff/img/corner');
fs.mkdirSync(OUT, { recursive: true });
const _wd = setTimeout(() => { console.error('⏱ 시간 초과'); process.exit(2); }, 600000); _wd.unref && _wd.unref();

/* ───────── PNG (의존성 0) ───────── */
function decodePNG(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('PNG 가 아니다');
  let off = 8, w = 0, h = 0, depth = 0, ctype = 0, interlace = 0; const idat = [];
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off), type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); depth = data[8]; ctype = data[9]; interlace = data[12]; }
    else if (type === 'IDAT') idat.push(data); else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (depth !== 8) throw new Error(`비트깊이 ${depth} 는 못 읽는다`);
  if (interlace !== 0) throw new Error('인터레이스 PNG 는 못 읽는다');
  const ch = { 0: 1, 2: 3, 4: 2, 6: 4 }[ctype];
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * ch, out = Buffer.alloc(h * stride); let p = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[p++]; const line = raw.subarray(p, p + stride); p += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? cur[x - ch] : 0, b = prev ? prev[x] : 0, c = (prev && x >= ch) ? prev[x - ch] : 0;
      let v = line[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); }
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
    const i = (y * im.w + x) * im.ch; s.add((im.data[i] << 16) | (im.data[i + 1] << 8) | im.data[i + 2]);
  }
  return s.size;
}
const med = a => { if (!a.length) return NaN; const b = a.slice().sort((p, q) => p - q); return b[b.length >> 1]; };
const p90 = a => { if (!a.length) return NaN; const b = a.slice().sort((p, q) => p - q); return b[Math.min(b.length - 1, Math.floor(b.length * 0.9))]; };
const r1 = v => Number.isFinite(v) ? +v.toFixed(1) : null;

/* ───────── 게임을 띄운다 ───────── */
const page = await launch({ width: 390, height: 844, dpr: 2, mobile: false });
await page.goto(`${BASE}/game.html`);
await page.eval(`localStorage.clear()`, false);
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
/* ★ rAF 를 먼저 끊는다 — 안 끊으면 시각도 카메라도 다음 프레임에 덮인다 */
await page.eval(`window.__rv.setPaused(true)`, false);
await sleep(400);
/* ★ 사람을 세운다 — redraw() 가 캐릭터를 한 걸음 걷게 하므로, 안 세우면 전·후 사진에서
   사람이 다른 자리에 서 있다. 모서리를 가리는 자리가 달라져 「튐」이 그것 때문에 움직인다. */
await page.eval(`try{ window.__rv.stopWalk(); }catch(e){}`, false);

await page.eval(`(async ()=>{
  const H = await import('/src/render3d/house.js');
  const ctx = window.__rv.three;
  window.__H = H; window.__ctx = ctx;
  /* 셸을 장면에서 되찾는다 — buildHouse 결과가 밖으로 안 열려 있다.
     바깥 법선(userData.normal)이 어느 면인지 말해 준다. */
  window.__shells = (()=>{ const s={}; let pi=0;
    ctx.scene.traverse(o=>{ const u=o.userData; if(!u||!u.normal||!u.center) return;
      const n=u.normal; let k;
      if(n[1]===-1)k='floor'; else if(n[1]===1)k='ceiling'; else if(n[2]===-1)k='back';
      else if(n[2]===1)k='front'; else if(n[0]===-1)k='left'; else if(n[0]===1)k='right'; else k='part_'+(pi++);
      while(s[k])k+='_'; s[k]=o; });
    return s; })();
  /* ★★ 반드시 그림자맵을 다시 굽고 그린다 (머리말 참고). 이걸 빼면 낡은 맵이 쓰인다. */
  window.__draw = (t)=>{ window.__rv.setDaylight(t);
    window.__sunLight.shadow.needsUpdate = true;
    if(ctx.ceilingBulb) ctx.ceilingBulb.shadow.needsUpdate = true;
    window.__rv.redraw(); };
  /* 게임이 쓰는 그 각·그 거리로, 겨눈 점만 바꾸고 fov 만 좁혀 크게 본다.
     ★ 각을 그대로 두는 게 중요하다 — 면에 닿는 빛의 각도가 안 바뀌어야 같은 그림이다.
     ⚠⚠ redraw() 를 쓰면 안 된다. 그 안의 updateCam() 이 게임 카메라로 되돌린다 —
        fov 만 남고 자리는 원래대로라 엉뚱한 데를 크게 찍는다(천장등을 찍고 있었다).
        그래서 여기서 직접 그린다. */
  window.__drawZoom = (t, tx,ty,tz, dAzDeg, fov)=>{
    window.__rv.setDaylight(t);
    window.__sunLight.shadow.needsUpdate = true;
    if(ctx.ceilingBulb) ctx.ceilingBulb.shadow.needsUpdate = true;
    const c = window.__rv.camera();
    const az = c.az + dAzDeg*Math.PI/180, el = c.el, d = c.dist;
    ctx.cam.fov = fov;
    ctx.cam.position.set(tx + d*Math.cos(el)*Math.sin(az), ty + d*Math.sin(el), tz + d*Math.cos(el)*Math.cos(az));
    ctx.cam.up.set(0,1,0); ctx.cam.lookAt(tx,ty,tz);
    ctx.cam.updateProjectionMatrix(); ctx.cam.updateMatrixWorld(true);
    for(const k in window.__shells) delete window.__shells[k].userData._stub;
    H.updateShellVisibility(window.__shells, ctx.cam, 'auto', null);
    ctx.renderer.render(ctx.scene, ctx.cam);
  };
  window.__resetCam = ()=>{ ctx.cam.fov = 38; ctx.cam.updateProjectionMatrix(); };
  window.__scr = (x,y,z)=>{ const r=document.getElementById('roomCanvas').getBoundingClientRect();
    const v=new THREE.Vector3(x,y,z).project(ctx.cam);
    return [ r.left+(v.x*0.5+0.5)*r.width, r.top+(-v.y*0.5+0.5)*r.height ]; };
  /* 밑동 상자들의 월드 범위 — ① 구석 이음새를 기하로 재는 데 쓴다 */
  window.__stubBoxes = ()=>{ const a=[];
    ctx.scene.traverse(o=>{ if(!(o.isMesh&&o.userData.isStub)) return;
      o.updateMatrixWorld(true); const b=new THREE.Box3().setFromObject(o);
      a.push([ +b.min.x.toFixed(4), +b.min.z.toFixed(4), +b.max.x.toFixed(4), +b.max.z.toFixed(4) ]); });
    return a; };
  window.__wallBoxes = ()=>{ const a=[];
    for(const k of ['back','front','left','right']){ const sh=window.__shells[k]; if(!sh) continue;
      sh.traverse(o=>{ if(!o.isMesh||o.userData.isStub||!o.geometry||!o.geometry.parameters) return;
        const p=o.geometry.parameters; if(p.width===undefined) return;
        o.updateMatrixWorld(true); const b=new THREE.Box3().setFromObject(o);
        if(b.min.y>0.05) return;                       // 바닥에 닿는 조각만 = 벽 밑동이 날 조각
        if(b.max.y < 0.5) return;
        a.push([ +b.min.x.toFixed(4), +b.min.z.toFixed(4), +b.max.x.toFixed(4), +b.max.z.toFixed(4) ]); }); }
    return a; };
  window.__stats = ()=>{ const i=ctx.renderer.info;
    return { tris:i.render.triangles, calls:i.render.calls, geo:i.memory.geometries }; };
  return 'ok';
})()`);

const SZ = JSON.parse(await page.eval(`JSON.stringify(window.__rv.roomSize())`));
const CW = SZ.w, CD = SZ.d, WT = 0.2;
const HW = CW / 2 + WT / 2, HD = CD / 2 + WT / 2;   // 벽 바깥 면
const report = { tag: TAG, at: new Date().toISOString(), room: { CW, CD, CH: SZ.h }, t: DAY_T };

/* ───────── 사진 한 장 (색 가짓수 검문 포함) ───────── */
async function shot(name, drawJs) {
  let im = null, colors = 0, file = path.join(OUT, `${TAG}_${name}.png`);
  for (let k = 0; k < 3; k++) {
    await page.eval(drawJs || `window.__draw(${DAY_T})`, false);
    await sleep(k ? 900 : 350);
    await page.shot(file);
    im = decodePNG(fs.readFileSync(file));
    colors = colorCount(im);
    if (colors >= 3000) break;             /* 좁은 fov 사진은 면이 몇 개 안 잡혀 색이 적다 */
    console.error(`… ${name} 색 ${colors} — 다시 그린다`);
  }
  return { im, colors, file };
}

/* ============================================================
   ① 구석 이음새 — **기하로** 잰다 (화소를 안 본다)
   바깥 네 구석의 (WT/2)² 칸이 벽·밑동에 몇 번 덮이나. 1 이 맞다.
   0 = 이가 빠졌다 · 2 = 두 겹(밑동 윗면이 같은 평면 → z-fighting)
============================================================ */
{
  const stubs = JSON.parse(await page.eval(`JSON.stringify(window.__stubBoxes())`));
  const walls = JSON.parse(await page.eval(`JSON.stringify(window.__wallBoxes())`));
  const q = WT / 2;
  const cells = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    /* 구석 바깥 정사각 두 칸: 「바깥칸」(모서리 끝) 과 「안칸」(중심선 안쪽) */
    const put = (name, x0, z0) => cells.push({
      corner: `${sz < 0 ? 'back' : 'front'}-${sx < 0 ? 'left' : 'right'}`, cell: name,
      cx: x0 + q / 2 * 1, cz: z0 + q / 2 * 1, x0, z0, x1: x0 + q, z1: z0 + q
    });
    put('바깥', sx < 0 ? -HW : HW - q, sz < 0 ? -HD : HD - q);
    put('안',   sx < 0 ? -HW + q : HW - 2 * q, sz < 0 ? -HD + q : HD - 2 * q);
  }
  const cover = (boxes, c) => boxes.filter(b =>
    b[0] < c.x1 - 1e-4 && b[2] > c.x0 + 1e-4 && b[1] < c.z1 - 1e-4 && b[3] > c.z0 + 1e-4).length;
  const rows = cells.map(c => ({ ...c, wall: cover(walls, c), stub: cover(stubs, c) }));
  report.corner = { stubs: stubs.length, walls: walls.length, cells: rows,
    empty: rows.filter(r => r.stub === 0).length, doubled: rows.filter(r => r.stub >= 2).length };
  console.log('\n① 구석 이음새 — 바깥 네 구석의 0.1×0.1 칸을 몇 번 덮나 (1 이 맞다)');
  console.log('  구석            칸   벽조각  밑동');
  for (const r of rows) console.log(`  ${r.corner.padEnd(13)} ${r.cell}   ${String(r.wall).padStart(4)}  ${String(r.stub).padStart(4)}${r.stub === 0 ? '  ← 빈 칸(이 빠짐)' : r.stub >= 2 ? '  ← 두 겹(z-fighting)' : ''}`);
  console.log(`  ⇒ 빈 칸 ${report.corner.empty} · 두 겹 ${report.corner.doubled}  (둘 다 0 이라야 이음새가 맞다)`);
}

/* ============================================================
   ② 밑동 윗면의 밝은 띠 — 컷어웨이로 내려간 벽 위를 가로질러 훑는다
   s<0 : 밑동 윗면(y=LOW_H) · s>=0 : 방 안 바닥(y=0)
============================================================ */
const LOW_H = 0.10;
{
  const { im, colors } = await shot('room');
  report.roomColors = colors;
  if (colors < 8000) { console.error(`⛔ 방이 안 그려졌다(색 ${colors}) — 재지 않는다.`); await page.close(); process.exit(3); }
  const dpr = im.w / 390;
  /* 방 전체 밝기 — 모서리만 고치고 방을 통째로 바꾸지 않았나 보는 자 */
  let sum = 0, n = 0;
  for (let y = 130; y < im.h - 220; y += 3) for (let x = 0; x < im.w; x += 3) { sum += lum(im, x, y); n++; }
  report.roomMean = +(sum / n).toFixed(2);

  const stubbed = JSON.parse(await page.eval(`JSON.stringify((()=>{const o={};
    for(const k of ['back','front','left','right']){ const sh=window.__shells[k];
      o[k]= !!(sh && sh.userData.stub && sh.userData.stub.visible); } return o;})())`));
  report.stubbed = stubbed;
  const bands = {};
  const SS = []; for (let s = -0.22; s <= 0.14001; s += 0.02) SS.push(+s.toFixed(2));
  for (const wall of ['back', 'front', 'left', 'right']) {
    if (!stubbed[wall]) continue;
    const axis = (wall === 'left' || wall === 'right') ? 'x' : 'z';
    const inner = wall === 'left' ? -CW / 2 + WT / 2 : wall === 'right' ? CW / 2 - WT / 2
                : wall === 'back' ? -CD / 2 + WT / 2 : CD / 2 - WT / 2;
    const sgn = (wall === 'left' || wall === 'back') ? -1 : 1;
    const us = axis === 'x' ? [-1.2, -0.4, 0.4, 1.2] : [-1.6, -0.6, 0.6, 1.6];
    const rows = [];
    for (const u of us) {
      const row = [];
      for (const s of SS) {
        /* s<0 = 벽 바깥쪽(밑동 윗면 위) · s>0 = 방 안 바닥.
           바깥쪽은 안쪽 면에서 **바깥 법선 방향**이므로 부호를 빼 준다. */
        const at = inner - sgn * s;
        const y = (s < -0.005 && s > -(WT + 0.005)) ? LOW_H : 0;
        const [x, z] = axis === 'x' ? [at, u] : [u, at];
        const p = JSON.parse(await page.eval(`JSON.stringify(window.__scr(${x},${y},${z}))`));
        row.push(Math.round(lum(im, Math.round(p[0] * dpr), Math.round(p[1] * dpr))));
      }
      rows.push({ u, row });
    }
    /* 「띠」 = 밑동 윗면 최대 − 그 줄의 바닥 바탕(맨 오른쪽 넷의 중앙값) */
    const jumps = rows.map(({ row }) => {
      const top = row.slice(1, SS.findIndex(v => v >= 0));      // 밑동 윗면 칸들
      const base = med(row.slice(-4));
      return Math.round(Math.max(...top) - base);
    });
    bands[wall] = { us, SS, rows, jumps, med: r1(med(jumps)), max: Math.max(...jumps) };
    console.log(`\n② 밑동 윗면 띠 — ${wall} 벽 (s<0 밑동 윗면 · s>=0 방 안 바닥)`);
    console.log('   u\\s ' + SS.map(v => String(v).padStart(5)).join(''));
    for (const { u, row } of rows) console.log(String(u).padStart(6) + ' ' + row.map(v => String(v).padStart(5)).join(''));
    console.log(`   ⇒ 띠 높이(밑동 윗면 최대 − 바닥 바탕) ${jumps.join(' · ')}  중앙값 ${r1(med(jumps))}`);
  }
  report.band = bands;
}

/* ============================================================
   ③ 모서리 마루 — 첫 판이 쓰던 자를 그대로 이어 쓴다
   선 위 점마다 직각으로 ±6화소를 훑어 봉우리를 찾고 양옆 바탕과 견준다
============================================================ */
{
  await page.eval(`window.__resetCam()`, false);
  const { im, colors } = await shot('ridge');
  report.ridgeColors = colors;
  const dpr = im.w / 390;
  const geo = JSON.parse(await page.eval(`(()=>{
    const CW=${CW}, CD=${CD}, WT=${WT}, cp=window.__ctx.cam.position;
    const W={ back:{n:[0,0,-1],at:-CD/2+WT/2,axis:'z',uMin:-CW/2+WT/2,uMax:CW/2-WT/2},
              front:{n:[0,0,1],at:CD/2-WT/2,axis:'z',uMin:-CW/2+WT/2,uMax:CW/2-WT/2},
              left:{n:[-1,0,0],at:-CW/2+WT/2,axis:'x',uMin:-CD/2+WT/2,uMax:CD/2-WT/2},
              right:{n:[1,0,0],at:CW/2-WT/2,axis:'x',uMin:-CD/2+WT/2,uMax:CD/2-WT/2} };
    const out={};
    for(const k in W){ const w=W[k];
      const cx=w.axis==='x'?w.at:0, cz=w.axis==='z'?w.at:0;
      const standing = !window.__H.wallIsStub(cp,[cx,1,cz],w.n);
      const pts=[]; const N=90;
      for(let i=0;i<=N;i++){ const u=w.uMin+(w.uMax-w.uMin)*i/N;
        const x=w.axis==='x'?w.at:u, z=w.axis==='z'?w.at:u;
        const ix=-w.n[0]*0.15, iz=-w.n[2]*0.15;
        pts.push({ P:window.__scr(x,0,z), F:window.__scr(x+ix,0,z+iz), Wl:window.__scr(x,0.15,z) }); }
      out[k]={ standing, pts }; }
    return JSON.stringify(out);
  })()`));
  const dev = p => [p[0] * dpr, p[1] * dpr];
  function ridgeAt(pt) {
    const P = dev(pt.P), F = dev(pt.F), Wl = dev(pt.Wl);
    if (P[0] < 2 || P[1] < 2 || P[0] > im.w - 3 || P[1] > im.h - 3) return null;
    let dx = F[0] - P[0], dy = F[1] - P[1]; const len = Math.hypot(dx, dy);
    if (!(len > 1)) return null; dx /= len; dy /= len;
    let peak = -1;
    for (let t = -6; t <= 6; t++) { const v = lum(im, Math.round(P[0] + dx * t), Math.round(P[1] + dy * t)); if (Number.isFinite(v) && v > peak) peak = v; }
    const bF = lum(im, Math.round(F[0]), Math.round(F[1])), bW = lum(im, Math.round(Wl[0]), Math.round(Wl[1]));
    if (!Number.isFinite(bF) || !Number.isFinite(bW) || peak < 0) return null;
    return peak - Math.max(bF, bW);
  }
  console.log('\n③ 모서리 마루 (서 있는 벽만 · 튐 = 봉우리 − 양옆 바탕)');
  console.log('  벽      | 잰 점 | 중앙값 | 상위10% | 튐>20');
  report.ridge = {};
  const all = [];
  for (const k in geo) {
    if (!geo[k].standing) { report.ridge[k] = { standing: false }; continue; }
    const js = []; for (const pt of geo[k].pts) { const v = ridgeAt(pt); if (v != null) js.push(+v.toFixed(1)); }
    all.push(...js);
    report.ridge[k] = { standing: true, n: js.length, med: r1(med(js)), p90: r1(p90(js)), over20: js.filter(v => v > 20).length, jumps: js };
    const r = report.ridge[k];
    console.log(`  ${k.padEnd(7)} | ${String(r.n).padStart(5)} | ${String(r.med).padStart(6)} | ${String(r.p90).padStart(7)} | ${r.over20}/${r.n}`);
  }
  report.ridgeAll = { n: all.length, med: r1(med(all)), p90: r1(p90(all)), over20: all.filter(v => v > 20).length };
  console.log(`  합계    | ${String(all.length).padStart(5)} | ${String(report.ridgeAll.med).padStart(6)} | ${String(report.ridgeAll.p90).padStart(7)} | ${report.ridgeAll.over20}/${all.length}`);
}

/* ============================================================
   ④ 앞쪽 아래 구석을 **크게** · **각을 바꿔 가며** 찍는다
   z-fighting 이면 각에 따라 무늬가 바뀐다 — 그것이 결정타다.
   「얼룩(speckle)」 = 이웃 넷의 중앙값과 12 넘게 다른 화소의 비율(%).
============================================================ */
{
  /* 어긋난 칸 두 개(빈 칸·두 겹)가 만나는 자리 = 벽 중심선의 구석 */
  const corner = [CW / 2, 0.05, CD / 2];
  report.speckle = [];
  console.log('\n④ 앞쪽 아래 구석 — 크게·각을 바꿔 가며 (얼룩 % : z-fighting 이면 각마다 달라진다)');
  for (const dAz of [-20, -10, 0, 10, 20]) {
    const { im, colors, file } = await shot(`corner_az${dAz >= 0 ? '+' : ''}${dAz}`,
      `window.__drawZoom(${DAY_T}, ${corner.join(',')}, ${dAz}, 4)`);
    /* 화면 가운데 (구석이 겨눠져 있다) 320×320 을 본다 */
    const cx = (im.w >> 1), cy = (im.h >> 1);
    let bad = 0, tot = 0;
    for (let y = cy - 160; y < cy + 160; y++) for (let x = cx - 160; x < cx + 160; x++) {
      const v = lum(im, x, y); if (!Number.isFinite(v)) continue;
      const nb = [lum(im, x - 1, y), lum(im, x + 1, y), lum(im, x, y - 1), lum(im, x, y + 1)].filter(Number.isFinite);
      if (nb.length < 4) continue;
      tot++; if (Math.abs(v - med(nb)) > 12) bad++;
    }
    const pct = tot ? +(100 * bad / tot).toFixed(2) : null;
    report.speckle.push({ dAz, colors, speckle: pct, file: path.basename(file) });
    console.log(`  az ${String(dAz).padStart(4)}°  색 ${String(colors).padStart(6)}  얼룩 ${String(pct).padStart(6)} %`);
  }
  await page.eval(`window.__resetCam()`, false);
}

/* ============================================================
   ⑤ 무게 — 삼각형·드로우콜. 폰이 느려지면 안 된다
============================================================ */
{
  await page.eval(`window.__draw(${DAY_T})`, false);
  report.stats = JSON.parse(await page.eval(`JSON.stringify(window.__stats())`));
  console.log(`\n⑤ 무게 — 삼각형 ${report.stats.tris} · 드로우콜 ${report.stats.calls} · 지오메트리 ${report.stats.geo}`);
}

/* ⚠ 조도(DLI)는 **여기서 안 잰다.** `tools/probe_place_dli.mjs` 가 정본이다 —
   실제로 조립된 방에 물어보는 자라 이 자가 흉내 내면 두 개의 자가 생긴다. */

fs.writeFileSync(path.join(OUT, `${TAG}_corner.json`), JSON.stringify(report, null, 1));
console.log(`\n저장: docs/handoff/img/corner/${TAG}_*.png · ${TAG}_corner.json`);
await page.close();
clearTimeout(_wd);
