/* ============================================================
   tools/probe_char_moni.mjs — 「캐릭터가 사라진다」와 「몬이가 안 따라온다」를 잰다
   ------------------------------------------------------------
   박사님이 화면에서 잡으신 둘을 **재현 조건**까지 잡아서 재는 자다.

     ㉠ 캐릭터가 한 번씩 사라진다 — 방에 몬이만 남는다
     ㉡ 몬이가 캐릭터를 안 바라보고 안 따라온다

   ★ 이 자가 지키는 것 (START-HERE §2.9)
     · readPixels 를 안 쓴다. 화소는 **사진**으로만 본다
     · 사진마다 **색 가짓수**를 세서 「까만 한 프레임」을 걸러낸다
     · 못 잰 것은 못 쟀다고 찍는다 — 빈칸을 짐작으로 안 채운다

   쓰는 법
     python tools/serve.py 8963
     BYEOT_URL=http://localhost:8963 node tools/probe_char_moni.mjs
     (사진은 docs/handoff/img/char/ 에 남는다. --tag=after 로 이름을 가른다)
============================================================ */
import { launch, sleep } from './test_cdp.mjs';
import fs from 'node:fs';
import zlib from 'node:zlib';

const _WATCHDOG_MS = +(process.env.BYEOT_PROBE_TIMEOUT_MS || 420000);
const _wd = setTimeout(() => {
  console.error('⏱ 자가 제한을 넘겨 멈춥니다 — 재는 중에 멎은 것입니다.');
  process.exit(2);
}, _WATCHDOG_MS);
_wd.unref && _wd.unref();
process.on('exit', () => clearTimeout(_wd));

const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const TAG = (process.argv.find(a => a.startsWith('--tag=')) || '--tag=before').slice(6);
const IMG = 'docs/handoff/img/char';

/* ── 사진이 살아 있나 — 색 가짓수를 센다 (§2.9 ③) ────────────────
   까만 사진은 3색, 멀쩡한 사진은 3,000색이 넘는다. PNG 를 직접 풀어서 센다.
   (node 에 이미지 라이브러리가 없다. IDAT 를 inflate 해 필터만 되돌리면 된다) */
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
    /* 4픽셀마다 하나만 센다 — 가짓수 판정에는 넉넉하고 훨씬 빠르다 */
    for (let x = 0; x < w; x += 4) set.add((cur[x * bpp] << 16) | (cur[x * bpp + 1] << 8) | cur[x * bpp + 2]);
    cur.copy(prev);
  }
  return { w, h, colors: set.size };
}

const page = await launch({ width: 390, height: 844, dpr: 2, mobile: false });
const errs = [];
page.on((m, p) => {
  if (m === 'Runtime.exceptionThrown')
    errs.push(p.exceptionDetails.text + ' ' + ((p.exceptionDetails.exception || {}).description || ''));
});

/* 사진 한 장 + 색 가짓수. 색이 적으면 한 번 더 기다렸다 다시 찍는다(§2.9 ③) */
async function shot(name) {
  const f = `${IMG}/${name}_${TAG}.png`;
  await page.shot(f);
  let c = pngColors(f);
  if (c.colors >= 0 && c.colors < 200) {
    await sleep(1500);
    await page.shot(f);
    c = pngColors(f);
  }
  console.log(`  📷 ${f}  색 ${c.colors}가지 ${c.colors >= 0 && c.colors < 200 ? '⚠ 죽은 사진일 수 있다' : ''}`);
  return { file: f, colors: c.colors };
}

/* 몬이는 0.375m 짜리라 폰 화면에서 스무 픽셀도 안 된다 — 얼굴이 어디를 보는지
   전체 사진으로는 **사람 눈으로 확인할 수가 없다.** 그 언저리만 크게 오려 찍는다.
   (CDP 의 clip.scale 이 그대로 확대해 준다 — 사진을 다시 늘리는 게 아니라 크게 그린다) */
async function shotNear(name, cx, cy, half = 90, scale = 4) {
  const f = `${IMG}/${name}_${TAG}.png`;
  const r = await page.send('Page.captureScreenshot', {
    format: 'png', captureBeyondViewport: false,
    clip: { x: Math.max(0, cx - half), y: Math.max(0, cy - half), width: half * 2, height: half * 2, scale }
  });
  fs.mkdirSync(IMG, { recursive: true });
  fs.writeFileSync(f, Buffer.from(r.data, 'base64'));
  const c = pngColors(f);
  console.log(`  🔍 ${f}  색 ${c.colors}가지`);
  return f;
}

const snap = () => page.eval(`(()=>{ const rv=window.__rv; if(!rv) return null;
  return { chars: rv.characters(), sel: rv.selectedCharacter() }; })()`);

console.log(`\n═══ probe_char_moni  (${TAG})  ${new Date().toISOString()} ═══`);

await page.goto(`${BASE}/game.html`);
await page.eval(`localStorage.clear()`, false);          // ⚠ goto 뒤에 부른다
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 120000, 300);
await sleep(6000);
await page.eval(`(()=>{ try{document.getElementById('dlgSkip').click()}catch{} })()`, false);
await sleep(1200);
await page.eval(`(()=>{ try{document.getElementById('guideClose').click()}catch{} })()`, false);
await sleep(1500);
/* 몬이가 사람을 따라가려면 사람이 세워져 있어야 한다 */
await page.waitFor(`window.__rv.characters().length>=2`, 60000, 400);
await sleep(1200);

const out = { tag: TAG, at: new Date().toISOString() };

/* ══ A. 처음 상태 ═════════════════════════════════════════════ */
const a0 = await snap();
console.log('\nA. 부팅 직후');
console.log('   있는 것:', a0.chars.map(c => c.id).join(' · ') || '(없다)');
for (const c of a0.chars) console.log(`   ${c.id.padEnd(7)} pos(${c.pos.x.toFixed(3)}, ${c.pos.z.toFixed(3)})  yaw ${(c.yaw * 180 / Math.PI).toFixed(1)}°`);
out.boot = a0.chars.map(c => ({ id: c.id, pos: c.pos, yawDeg: +(c.yaw * 180 / Math.PI).toFixed(1) }));
await shot('A_boot');

/* ══ B. ㉡ 몬이가 따라오나 — 사람을 걷게 하고 여러 프레임을 찍는다 ══ */
console.log('\nB. 몬이 추적 — 사람을 걷게 하고 프레임마다 찍는다');
const rect = await page.eval(`(()=>{const r=document.getElementById('roomCanvas').getBoundingClientRect();
  return {l:r.left,t:r.top,w:r.width,h:r.height};})()`);
await page.eval(`window.__rv.selectCharacter('jachwi')`, false);
/* 방 가운데를 가로질러 걷게 한다 — 화면 좌우로 두 번 보낸다 */
const walkTargets = [[0.26, 0.74], [0.74, 0.72], [0.30, 0.66]];
const track = [];
for (const [fx, fy] of walkTargets) {
  const r = await page.eval(`JSON.stringify(window.__rv.walkTo('jachwi',${Math.round(rect.l + rect.w * fx)},${Math.round(rect.t + rect.h * fy)}))`);
  const ok = JSON.parse(r);
  if (!ok.ok) { console.log(`   walkTo ${fx},${fy} → 못 간다: ${ok.reason}`); continue; }
  for (let i = 0; i < 10; i++) {
    await sleep(220);
    const s = await snap();
    const j = s.chars.find(c => c.id === 'jachwi'), m = s.chars.find(c => c.id === 'moni');
    if (!j || !m) { track.push({ miss: true, ids: s.chars.map(c => c.id) }); continue; }
    /* 몬이가 사람 쪽을 보고 있나 — 몬이 yaw 와 「몬이→사람」 각의 차 */
    const want = Math.atan2(j.pos.x - m.pos.x, j.pos.z - m.pos.z);
    let d = ((m.yaw - want + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
    track.push({
      jx: +j.pos.x.toFixed(3), jz: +j.pos.z.toFixed(3), walking: j.walking,
      mx: +m.pos.x.toFixed(3), mz: +m.pos.z.toFixed(3),
      myaw: +(m.yaw * 180 / Math.PI).toFixed(1),
      wantDeg: +(want * 180 / Math.PI).toFixed(1),
      offDeg: +(d * 180 / Math.PI).toFixed(1),
      dist: +Math.hypot(j.pos.x - m.pos.x, j.pos.z - m.pos.z).toFixed(3)
    });
  }
}
for (const t of track) {
  if (t.miss) { console.log(`   ⚠ 한쪽이 사라졌다 — 남은 것: ${t.ids.join('·')}`); continue; }
  console.log(`   사람(${String(t.jx).padStart(6)},${String(t.jz).padStart(6)})${t.walking ? '걷는중' : '  서있'}` +
              `  몬이(${String(t.mx).padStart(6)},${String(t.mz).padStart(6)})  거리 ${t.dist}` +
              `  몬이yaw ${String(t.myaw).padStart(7)}°  사람쪽 ${String(t.wantDeg).padStart(7)}°  어긋남 ${String(t.offDeg).padStart(7)}°`);
}
const moved = track.filter(t => !t.miss);
const yawSet = new Set(moved.map(t => t.myaw));
const posSet = new Set(moved.map(t => t.mx + '/' + t.mz));
out.follow = {
  frames: moved.length,
  moniPosVariants: posSet.size,
  moniYawVariants: yawSet.size,
  moniYawDeg: [...yawSet],
  offAbsMax: moved.length ? Math.max(...moved.map(t => Math.abs(t.offDeg))) : null,
  offAbsMin: moved.length ? Math.min(...moved.map(t => Math.abs(t.offDeg))) : null
};
console.log(`   ⇒ 몬이 자리 가짓수 ${posSet.size} · yaw 가짓수 ${yawSet.size} (${[...yawSet].join(', ')}°)`);
console.log(`   ⇒ 「사람 쪽」과의 어긋남  최소 ${out.follow.offAbsMin}°  최대 ${out.follow.offAbsMax}°`);
await shot('B_follow');
/* ★ 얼굴이 보이게 크게 오려 찍는다 — 숫자가 0° 라도 화면으로 한 번 봐야 한다(§2 ★)
   ⚠ 서 있을 때 몬이는 사람 **뒤통수에 겹쳐** 있어 사진으로는 아무것도 못 본다.
     그래서 **걷는 도중**, 둘이 1m 쯤 벌어진 순간을 노려 찍는다. */
{
  await page.eval(`window.__rv.walkTo('jachwi',${Math.round(rect.l + rect.w * 0.68)},${Math.round(rect.t + rect.h * 0.70)})`, false);
  await sleep(900);
  const p = await page.eval(`(()=>{ const rv=window.__rv, c=document.getElementById('roomCanvas');
    const r=c.getBoundingClientRect();
    const m=rv.characterScreenPos('moni'), j=rv.characterScreenPos('jachwi');
    if(!m||!j) return null;
    const cs = rv.characters(); const M=cs.find(x=>x.id==='moni'), J=cs.find(x=>x.id==='jachwi');
    return { x: r.left+(m.x+j.x)/2, y: r.top+(m.y+j.y)/2 - 25,
             sep: Math.round(Math.hypot(m.x-j.x, m.y-j.y)),
             gap: M&&J ? +Math.hypot(M.pos.x-J.pos.x, M.pos.z-J.pos.z).toFixed(2) : null }; })()`);
  if (p) {
    console.log(`   확대 사진: 둘 사이 화면 ${p.sep}px · 실제 ${p.gap}m`);
    await shotNear('B_moni_closeup', Math.round(p.x), Math.round(p.y), Math.max(70, p.sep), 5);
  } else console.log('   ⚠ 몬이 화면 좌표를 못 읽었다 — 확대 사진은 못 찍었다');
  await sleep(1500);
}

/* ══ C. ㉠ 캐릭터가 사라지는 순간 — 방을 다시 지어 본다 ═══════════
   방 재조립(assemble)은 가구를 옮기거나 방을 바꾸면 돈다. 게임에서 제일 흔한 것은
   **가구 옮기기**다. 여기서는 그 길을 직접 태운다. */
console.log('\nC. 방 재조립 — 가구를 옮겨 본다 (게임에서 제일 흔한 재조립 길)');
const before = (await snap()).chars.map(c => c.id);
const r = await page.eval(`(async()=>{ const rv=window.__rv;
  try {
    const list = rv.furniture()||[];
    /* 옮겨서 실제로 놓이는 가구 하나를 찾는다 — 한 칸(0.125m) 옆으로 민다 */
    for (const f of list) {
      for (const dx of [0.125,-0.125,0.25,-0.25,0,0]) {
        const to = dx===0 ? { x:f.x, z:f.z+0.125, rot:f.rot } : { x:f.x+dx, z:f.z, rot:f.rot };
        let fit=null; try { fit = rv.furnitureFit(f.uid,to); } catch(e){ continue; }
        if (!fit || !fit.ok) continue;
        await rv.commitFurnitureAt(f.uid, to);
        return 'ok '+f.uid+' → ('+to.x.toFixed(3)+','+to.z.toFixed(3)+')';
      }
    }
    return '옮길 수 있는 가구를 못 찾았다';
  } catch(e){ return 'ERR '+e.message; } })()`);
await sleep(3000);
const after = (await snap()).chars.map(c => c.id);
const cRes = { call: r, before, after, lost: before.filter(x => !after.includes(x)) };
console.log(`   호출: ${r}\n   전 ${before.join('·')}  →  후 ${after.join('·') || '(없다)'}` +
            (cRes.lost.length ? `   ★ 사라진 것: ${cRes.lost.join('·')}` : '   (안 사라졌다)'));
out.rebuildByFurniture = cRes;
await shot('C_after_furnmove');

/* ══ D. ㉠ 뿌리를 직접 겨눈다 — assemble 이 하는 짓 그대로 ════════
   assemble() 은 있던 사람을 기억했다가 **await 없이** setCharacter 를 둘 다 부른다
   (room_view.js:1095). 그 두 줄을 그대로 흉내 낸다. */
console.log('\nD. assemble 이 하는 그대로 — setCharacter 둘을 await 없이 부른다');
const d = await page.eval(`(async()=>{ const rv=window.__rv;
  const was = rv.characters().map(c=>c.id);
  for (const k of was) rv.setCharacter(k).catch(()=>{});   // ← room_view.js:1095 와 같은 줄
  await new Promise(r=>setTimeout(r,4000));
  return JSON.stringify({ was, now: rv.characters().map(c=>c.id) }); })()`);
const dd = JSON.parse(d);
out.concurrentSetCharacter = { ...dd, lost: dd.was.filter(x => !dd.now.includes(x)) };
console.log(`   전 ${dd.was.join('·')}  →  후 ${dd.now.join('·') || '(없다)'}` +
            (out.concurrentSetCharacter.lost.length ? `   ★ 사라진 것: ${out.concurrentSetCharacter.lost.join('·')}` : '   (안 사라졌다)'));
await shot('D_after_rebuild');

/* ══ D2. 사람이 없어진 방에서 몬이는 어떻게 되나 ═══════════════════
   ★ ㉠ 과 ㉡ 이 한 뿌리인지 여기서 갈린다. 사람이 없으면 homeXZ 가 화분 옆으로
     떨어지고 — 화분은 안 움직이니 몬이는 **진짜로 못 박힌다.** */
console.log('\nD2. 사람이 없는 방에서 몬이 자리가 움직이나');
const d2 = [];
for (let i = 0; i < 6; i++) {
  await sleep(350);
  const s = await snap();
  const m = s.chars.find(c => c.id === 'moni');
  d2.push(m ? { x: +m.pos.x.toFixed(3), z: +m.pos.z.toFixed(3), yaw: +(m.yaw * 180 / Math.PI).toFixed(1) } : null);
}
const d2set = new Set(d2.filter(Boolean).map(p => p.x + '/' + p.z));
out.moniAlone = { present: (await snap()).chars.map(c => c.id), samples: d2, posVariants: d2set.size };
/* ⚠ 「자리 가짓수 1」의 뜻이 둘로 갈린다 — 사람이 **없어서** 못 박힌 것과,
     사람이 **서 있어서** 몬이도 제자리인 것은 다른 이야기다. 갈라서 적는다. */
const alone = !out.moniAlone.present.includes('jachwi');
console.log(`   있는 것: ${out.moniAlone.present.join('·')}  몬이 자리 가짓수 ${d2set.size}` +
            (d2set.size <= 1
              ? (alone ? '  ★ 사람이 없어 못 박혔다 (㉡ 의 뿌리)' : '  (사람이 서 있어서 몬이도 제자리 — 정상)')
              : ''));
out.moniAlone.personGone = alone;
for (const p of d2) console.log('   ', p ? `(${p.x}, ${p.z})  yaw ${p.yaw}°` : '(없다)');

/* ══ E. 부팅 JS 예외 ═══════════════════════════════════════════ */
console.log('\nE. 부팅 JS 예외: ' + errs.length + '건');
for (const e of errs.slice(0, 10)) console.log('   ✗ ' + e.slice(0, 220));
out.errors = errs.length;

fs.mkdirSync(IMG, { recursive: true });
fs.writeFileSync(`${IMG}/probe_${TAG}.json`, JSON.stringify(out, null, 2));
console.log(`\n요약 → ${IMG}/probe_${TAG}.json`);
await page.close();
