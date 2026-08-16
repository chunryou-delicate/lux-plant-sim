/* ============================================================
   tools/probe_stack.mjs — 3단 거치대를 **실제로 서랍장·책상 위에 올려 본다** (G-12)
   ------------------------------------------------------------
   박사님: *"3단 거치대가 서랍장이나 책상 위로도 올라가게 … 이렇게 **자유롭게**"*
           *"**책상 위로 3단 거치 올라타는 거 아직 안 되네?**"*

   ★ 이 자는 **재기만 하지 않는다 — 실제로 올린다.**
     「부팅 예외 0」은 「기능이 산다」가 아니다(FIXLIST §오늘 배운 것). 그래서
     `commitFurnitureAt` 을 **게임이 쓰는 그 길 그대로** 부르고, 그 뒤에 사진을 찍는다.

   재는 것 다섯 (박사님이 재라 하신 것과 같은 차례)
     ① 서랍장 위·책상 위에 **실제로 올라가나** (+ 사진)
     ② 올린 뒤 **다시 옮길 수 있나** (갇히지 않나)
     ③ 올린 뒤 **그 위 자리의 DLI** 전·후
     ④ 위에 화분이 있을 때 **같이 따라가나**
     ⑤ 얹힌 것(집게등·바 등)이 **엉뚱하게 딸려 오지 않나** (ridersOf 전·후)

   무엇을 켜고 무엇을 껐나
     · 실제 game.html · 반지하 · **등 0개(자연광만)** · 맑음·여름 · localStorage 비움
     · 게임이 실제로 도는 모드는 `novice` 라 **peak 이 곧 그날 값**이다(START-HERE §2.9 ④)
     · 파일은 한 줄도 안 고친다. 끝에 **되돌리고** 어긋남을 찍는다
   ⚠ `readPixels` 는 안 쓴다 — 사진을 찍고 **색 가짓수**로 사진이 멀쩡한지 본다(§2.9 ②③)
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
/* 사진을 찍고 **멀쩡한지** 본다. 까만 사진(3천색 미만)에서 "됐다"고 말하지 않는다. */
async function shot(page, name) {
  let f = '', colors = 0;
  for (let i = 0; i < 3; i++) {
    await sleep(1200);
    f = await page.shot(path.join(OUT, name));
    colors = colorCount(decodePNG(fs.readFileSync(f)));
    if (colors >= 3000) break;
  }
  console.log(`   사진 ${name} · 색 가짓수 ${colors}${colors < 3000 ? '  ⛔ 까만 사진이다' : ''}`);
  return colors;
}

const page = await launch({ width: 900, height: 760, dpr: 1, mobile: false });
await page.goto(`${BASE}/game.html`);
await page.eval(`localStorage.clear()`, false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 180000, 300);
await page.waitFor('window.__byeotBooted === true', 180000, 300);
await sleep(6000);
/* 프롤로그 대사를 걷는다 — 안 걷으면 사진 절반이 초상화다(probe_corner 와 같은 손짓) */
for (let i = 0; i < 40; i++) {
  const busy = await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');
    return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`);
  if (!busy) break;
  await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s)s.click();
    const b=document.getElementById('dlgBox'); if(b)b.click();
    const g=document.getElementById('guideClose'); if(g)g.click();})()`, false);
  await sleep(250);
}
/* 시각을 못 박는다 — 시간이 흐르면 같은 자로 전·후를 못 견준다(한낮 0.50) */
await page.eval(`window.__rv.setDaylight(0.50)`, false);
await sleep(1500);

/* ── 방뷰·조도 창구를 한 자리에 심는다 ───────────────────────── */
await page.eval(`window.__P = (()=>{
  const rv = window.__rv, L = window.__io.light;
  const SKY = { weather:'clear', season:'summer', lampCount:0, litHours:12 };
  const dli = () => { const m={}; for (const s of L.room.slots)
      m[s.slotId] = { y:+(s.y??0).toFixed(3), dli:+L.dliOfSlot(s.slotId, SKY).toFixed(2) }; return m; };
  const furn = () => rv.furniture().map(f=>({uid:f.uid,name:f.name,x:f.x,y:f.y,z:f.z,rot:f.rot,
                                             w:f.size.w,d:f.size.d,h:f.size.h}));
  const riders = () => { const m={}; for (const f of rv.furniture()) m[f.uid]=rv.ridersOf(f.uid); return m; };
  return { rv, L, SKY, dli, furn, riders,
           snap:(uid,p)=>{ try{ return rv.snapFurniture(uid,p); }catch(e){ return {err:e.message}; } },
           fit:(uid,p)=>{ try{ return rv.furnitureFit(uid,p); }catch(e){ return {ok:false,reason:e.message}; } },
           move: async (uid,p)=>{ try{ const r = await rv.commitFurnitureAt(uid,p); L.clearCache();
                                       return {ok:true, ...r}; }
                                  catch(e){ return {ok:false, reason:e.message}; } } };
})(); 1`, false);

const J = async (expr) => JSON.parse(await page.eval(`JSON.stringify(${expr})`));
const Ja = async (expr) => JSON.parse(await page.eval(`(async()=>JSON.stringify(${expr}))()`));

const before = { furn: await J('__P.furn()'), dli: await J('__P.dli()'), riders: await J('__P.riders()') };
const F = u => before.furn.find(f => f.uid === u);
const dresser = F('banjiha-dresser'), desk = F('banjiha-desk'), shelf = F('banjiha-etagere');

console.log(`\n════ 반지하 · 등 0개(자연광만) · 맑음·여름 ════`);
console.log(`\n[가구] 옮길 수 있는 것 ${before.furn.length}개`);
for (const f of before.furn)
  console.log(`  ${f.uid.padEnd(22)} (${f.x.toFixed(2)}, ${f.y.toFixed(2)}, ${f.z.toFixed(2)})  ` +
              `${f.w}×${f.d}×${(f.h ?? 0).toFixed(3)}  rot ${f.rot}`);

console.log(`\n[얹힌 것] ridersOf — 옮길 때 같이 데려가는 것`);
for (const [u, r] of Object.entries(before.riders)) if (r.length) console.log(`  ${u} → ${r.join(', ')}`);

await shot(page, 'stack_0_before.png');

/* ── ① 서랍장 위로 올린다 ─────────────────────────────────── */
console.log(`\n── ① 서랍장 위로 올린다 (${dresser.x}, ${dresser.z}) ──`);
const sn1 = await J(`__P.snap('banjiha-etagere', {x:${dresser.x}, z:${dresser.z}, rot:0, step:0.125})`);
console.log(`   snapFurniture → x ${sn1.x} · y ${sn1.y} · z ${sn1.z} · 받침 ${sn1.on}`);
const mv1 = await Ja(`await __P.move('banjiha-etagere', {x:${dresser.x}, z:${dresser.z}, rot:0, step:0.125})`);
console.log(`   commitFurnitureAt → ${mv1.ok ? `올라갔다: y ${mv1.to.y} (전 ${mv1.from.y})` : `못 올렸다: ${mv1.reason}`}`);
if (mv1.ok) console.log(`   같이 간 것: ${mv1.riders.length ? mv1.riders.join(', ') : '없음'}`);
const afterD = await J('__P.dli()');
await shot(page, 'stack_1_on_dresser.png');

/* ── ② 갇히지 않았나 — 올린 뒤 다시 책상 위로 ───────────────── */
console.log(`\n── ② 올린 뒤 다시 옮길 수 있나 — 책상 위로 (${desk.x}, ${desk.z}) ──`);
const list1 = await J('__P.furn()');
const still = list1.find(f => f.uid === 'banjiha-etagere');
console.log(`   가구 목록에 남아 있나: ${still ? `그렇다 (y ${still.y})` : '⛔ 사라졌다 = 갇혔다'}`);
const mv2 = await Ja(`await __P.move('banjiha-etagere', {x:${desk.x}, z:${desk.z}, rot:0, step:0.125})`);
console.log(`   책상 위로 → ${mv2.ok ? `옮겼다: y ${mv2.to.y} (전 ${mv2.from.y})` : `못 옮겼다: ${mv2.reason}`}`);
const afterK = await J('__P.dli()');
await shot(page, 'stack_2_on_desk.png');

/* ── ③ 바닥으로 도로 내린다 (자유롭게 왔다 갔다 되나) ────────── */
console.log(`\n── ③ 바닥으로 도로 내린다 (${shelf.x}, ${shelf.z}) ──`);
const mv3 = await Ja(`await __P.move('banjiha-etagere', {x:${shelf.x}, z:${shelf.z}, rot:${shelf.rot}, step:0.125})`);
console.log(`   → ${mv3.ok ? `내렸다: y ${mv3.to.y}` : `못 내렸다: ${mv3.reason}`}`);
const restored = await J('__P.dli()');

/* ── 표 ────────────────────────────────────────────────── */
const ids = Object.keys(before.dli);
console.log(`\n[조도] 3단 선반 자리 · 창턱 · 서랍장 · 책상   (DLI · mol/m²/d)`);
console.log('자리'.padEnd(24) + '바닥'.padStart(15) + '서랍장 위'.padStart(15) + '책상 위'.padStart(15) + '되돌림'.padStart(15));
console.log('-'.repeat(24 + 15 * 4));
for (const id of ids) {
  const c = t => { const v = t[id]; return v ? `${v.y.toFixed(2)}m ${v.dli.toFixed(2)}`.padStart(15) : ''.padStart(15); };
  console.log(id.padEnd(24) + c(before.dli) + c(afterD) + c(afterK) + c(restored));
}
console.log('-'.repeat(24 + 15 * 4));
let drift = 0;
for (const id of ids) if (restored[id] && before.dli[id])
  drift = Math.max(drift, Math.abs(restored[id].dli - before.dli[id].dli));
console.log(`되돌린 뒤 어긋남 ${drift.toFixed(4)}` +
  `  ⚠ 0 이 아니어도 된다 — 내린 자리가 격자에 앉아 (${mv3.ok ? `${mv3.to.x}, ${mv3.to.z}` : '?'}) 로` +
  ` 원래 (${shelf.x}, ${shelf.z}) 와 다르다. **높이는 0 으로 정확히 돌아온다.**`);
const sill = id => (before.dli[id] ? before.dli[id].dli : null);
console.log(`★ 창턱 banjiha-sill:0 — 바닥 ${sill('banjiha-sill:0')} · 서랍장위 ${afterD['banjiha-sill:0'].dli}` +
            ` · 책상위 ${afterK['banjiha-sill:0'].dli} · 되돌림 ${restored['banjiha-sill:0'].dli}  (4.80 이 정본이다)`);

console.log(`\n[얹힌 것] 옮긴 뒤 ridersOf`);
const ridersAfter = await J('__P.riders()');
for (const [u, r] of Object.entries(ridersAfter)) if (r.length) console.log(`  ${u} → ${r.join(', ')}`);

/* ── ④ 위에 화분이 있으면 같이 따라가나 ─────────────────────── */
console.log(`\n── ④ 선반 맨 윗칸에 화분을 얹고 선반을 올린다 ──`);
const READ = `(()=>{ const s=window.__io.light.room.slots.find(s=>s.slotId==='banjiha-etagere:8');
  const p=window.__rv.plants().find(p=>p.key==='banjiha-etagere:8');
  return { slotY:s?+s.y.toFixed(3):null, potY:p?+p.pos.y.toFixed(3):null,
           dli:+window.__P.L.dliOfSlot('banjiha-etagere:8',window.__P.SKY).toFixed(2) }; })()`;
await page.eval(`(async()=>{ await window.__rv.setPlant('banjiha-etagere:8',
  { kind:'monstera', progress01:0.3, band:'good' }); })()`);
await sleep(1500);
const potBefore = await J(READ);
console.log(`   올리기 전 — 자리 y ${potBefore.slotY} · 화분 y ${potBefore.potY} · DLI ${potBefore.dli}`);
const mv4 = await Ja(`await __P.move('banjiha-etagere', {x:${desk.x}, z:${desk.z}, rot:0, step:0.125})`);
await sleep(1200);
const potAfter = await J(READ);
console.log(`   올린 뒤   — 자리 y ${potAfter.slotY} · 화분 y ${potAfter.potY} · DLI ${potAfter.dli}` +
            `   ${potAfter.potY != null && Math.abs(potAfter.potY - potAfter.slotY) < 0.01 ? '✔ 화분이 자리를 따라갔다' : '⛔ 화분이 자리와 어긋났다'}`);
await shot(page, 'stack_3_pot_follows.png');

/* ── ⑤ 손으로 끌어서도 되나 — **화면 손짓 그대로** ───────────── */
console.log(`\n── ⑤ 손으로 끌어 올려 본다 (화면 손짓 · previewFurnitureAt → commit) ──`);
await Ja(`await __P.move('banjiha-etagere', {x:${shelf.x}, z:${shelf.z}, rot:0, step:0.125})`);
const drag = await J(`(()=>{ const rv=window.__rv;
  /* 책상 상판 한가운데를 화면 좌표로 겨눈다 — 손가락이 거기를 짚은 것과 같다 */
  const c=document.getElementById('roomCanvas'), r=c.getBoundingClientRect();
  const v=new THREE.Vector3(${desk.x}, 0.74, ${desk.z}).project(window.__cam);
  const px=r.left+(v.x*0.5+0.5)*r.width, py=r.top+(-v.y*0.5+0.5)*r.height;
  const hit=rv.surfaceAt(px,py,{grid:false});
  const pv=rv.previewFurnitureAt('banjiha-etagere', {x:hit.x, z:hit.z, rot:0, step:0.125});
  rv.clearFurniturePreview&&rv.clearFurniturePreview();
  return { px:+px.toFixed(1), py:+py.toFixed(1), hit:{x:hit.x,y:hit.y,z:hit.z,onUid:hit.onUid}, preview:pv }; })()`);
console.log(`   화면 (${drag.px}, ${drag.py}) 를 쏘니 → 책상 상판 y ${drag.hit.y} (onUid ${drag.hit.onUid})`);
console.log(`   유령 → x ${drag.preview.x} · **y ${drag.preview.y}** · ok ${drag.preview.ok} · ${drag.preview.reason || '놓을 수 있다'}`);
console.log(`   ⇒ ${drag.preview.ok && drag.preview.y > 0.02 ? '✔ 손짓 길에서도 상판 높이로 뜬다' : '⛔ 손짓 길에서는 안 뜬다'}`);

/* ── ⑥ 「그 빛량 가능?」 — 책상을 창 밑으로 옮긴 뒤 그 위에 올린다 ── */
console.log(`\n── ⑥ 박사님 물음: 창턱 높이만큼 올리면 그 빛량이 되나 ──`);
const best = await Ja(`await (async()=>{
  /* 선반을 먼저 비켜 놓는다 — 안 그러면 책상이 선반과 겹쳐 못 온다 */
  const z = await __P.move('banjiha-etagere', {x:0.75, z:1.5, rot:0, step:0.125});
  const c = await __P.move('banjiha-chair', {x:1.3, z:0.9, rot:180, step:0.125});
  const a = await __P.move('banjiha-desk', {x:-0.375, z:-1.625, rot:0, step:0.125});
  const b = await __P.move('banjiha-etagere', {x:-0.375, z:-1.625, rot:0, step:0.125});
  window.__P.L.clearCache();
  return { away:z, chair:c, desk:a, shelf:b, dli: __P.dli() }; })()`);
if (best.shelf.ok && best.desk.ok) {
  console.log(`   책상을 창 밑(${best.desk.to.x}, ${best.desk.to.z}) 으로 · 그 위에 선반 y ${best.shelf.to.y}`);
  for (const id of ['banjiha-sill:0', 'banjiha-etagere:6', 'banjiha-etagere:7', 'banjiha-etagere:8'])
    console.log(`   ${id.padEnd(22)} ${before.dli[id].y.toFixed(2)}m ${before.dli[id].dli.toFixed(2)}` +
                `  →  ${best.dli[id].y.toFixed(2)}m ${best.dli[id].dli.toFixed(2)}`);
} else console.log(`   ⛔ 못 했다 — 비키기:${best.away.reason || 'ok'} · 의자:${best.chair.reason || 'ok'}` +
                   ` · 책상:${best.desk.reason || 'ok'} · 선반:${best.shelf.reason || 'ok'}`);
await shot(page, 'stack_4_desk_under_window.png');

/* ── ⑦ 처음 자리로 **정확히** 되돌린다 (grid:false) — 창턱 4.80 이 흔들리나 ── */
console.log(`\n── ⑦ 처음 자리로 정확히 되돌린다 ──`);
const back = await Ja(`await (async()=>{ const out={};
  for (const f of ${JSON.stringify(before.furn)})
    out[f.uid] = await __P.move(f.uid, { x:f.x, z:f.z, rot:f.rot, y:f.y, grid:false });
  window.__P.L.clearCache(); return { out, dli: __P.dli() }; })()`);
let drift2 = 0, bad = [];
for (const id of ids) if (back.dli[id] && before.dli[id]) {
  const d = Math.abs(back.dli[id].dli - before.dli[id].dli);
  if (d > drift2) drift2 = d;
  if (d > 0.005) bad.push(`${id} ${before.dli[id].dli}→${back.dli[id].dli}`);
}
console.log(`   되돌린 뒤 어긋남 ${drift2.toFixed(4)}${bad.length ? '  ⛔ ' + bad.join(' · ') : '  ✔ 0 이다'}`);

/* ── ⑧ ★ 손가락으로 진짜 끌어 본다 — 화면 손짓 전부 (탭 → [옮기기] → 끌기 → 뗌) ──
   ⚠ 「부팅 예외 0」은 「기능이 산다」가 아니다. 이 걸음이 **누를 때만 나는 오류**를 잡는다. */
console.log(`\n── ⑧ 손가락으로 진짜 끌어 본다 (탭 → [옮기기] → 책상 위로 끌기 → 뗌) ──`);
const scr = await J(`(()=>{ const rv=window.__rv;
  const h = rv.highlightFurniture('banjiha-etagere'); rv.highlightFurniture(null);
  const c = document.getElementById('roomCanvas'), r = c.getBoundingClientRect();
  const v = new THREE.Vector3(${desk.x}, 0.74, ${desk.z}).project(window.__cam);
  return { from:{ x: r.left + h.screen.x, y: r.top + h.screen.y },
           to:{ x: r.left+(v.x*0.5+0.5)*r.width, y: r.top+(-v.y*0.5+0.5)*r.height } }; })()`);
const M = async (type, p, extra = {}) => page.send('Input.dispatchMouseEvent',
  { type, x: p.x, y: p.y, button: 'left', buttons: type === 'mouseMoved' && extra.down ? 1 : (type === 'mouseReleased' ? 0 : 1), clickCount: 1, pointerType: 'mouse' });
/* ⚠ 탭은 **시간 의존**이다 — 캐릭터가 걸어 다니고 방이 바쁘면 한 번에 안 잡힌다
   (START-HERE §5 의 `test_siru_pick C` 와 같은 결). 세 번까지 다시 두드린다. */
let picked = null;
for (let t = 1; t <= 3; t++) {
  await M('mousePressed', scr.from); await sleep(120); await M('mouseReleased', scr.from);
  await sleep(1200);
  picked = await J(`(()=>({ uid: window.__furn && window.__furn.uid,
    menu: getComputedStyle(document.getElementById('furnActions')).display,
    move: !!document.getElementById('furnMove') }))()`);
  if (picked.uid === 'banjiha-etagere') { picked.tries = t; break; }
  picked.tries = t;
}
console.log(`   탭 → 골라진 가구: ${picked.uid || '(없다)'} · 메뉴 ${picked.menu} · 두드린 횟수 ${picked.tries}`);
await page.eval(`document.getElementById('furnMove').click()`, false);
await sleep(500);
await M('mousePressed', scr.from);
for (let i = 1; i <= 6; i++) {
  await M('mouseMoved', { x: scr.from.x + (scr.to.x - scr.from.x) * i / 6,
                          y: scr.from.y + (scr.to.y - scr.from.y) * i / 6 }, { down: true });
  await sleep(80);
}
const label = await page.eval(`document.getElementById('dropLabel').textContent`);
console.log(`   끄는 중 화면 글자: 「${label}」`);
await M('mouseReleased', scr.to);
await sleep(2500);
const handY = await J(`(()=>{ const f=window.__rv.furniture().find(f=>f.uid==='banjiha-etagere');
  return { y: f ? f.y : null, x: f ? f.x : null, z: f ? f.z : null,
           err: (window.__errBox && window.__errBox.last) || null }; })()`);
console.log(`   손을 뗀 뒤 — 선반 (${handY.x}, ${handY.y}, ${handY.z})` +
            `   ${handY.y > 0.02 ? '✔ 손가락으로 올라갔다' : '⛔ 손가락으로는 안 올라갔다'}`);
await shot(page, 'stack_5_by_hand.png');

/* ── ⑨ 세이브 왕복 — 껐다 켜도 올려 둔 채로 있나 ─────────────── */
console.log(`\n── ⑨ 껐다 켜도 올려 둔 채 있나 (세이브 왕복) ──`);
await page.eval(`document.getElementById('furnOk') && document.getElementById('furnOk').click()`, false);
await sleep(600);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 180000, 300);
await page.waitFor('window.__byeotBooted === true', 180000, 300);
await sleep(6000);
/* 세이브 열쇠는 `save.SAVE_KEY = 'byeot/save/1'` 하나다(src/game/save.js §66) — 짐작하지 않는다.
   ⚠ **다시 켠 뒤에** 읽는다. 켜기 전에 읽으면 아직 안 적힌 순간을 잡아 「없다」로 오독한다. */
const saved = await page.eval(`(()=>{ try {
  const t=localStorage.getItem('byeot/save/1'); if(!t) return '(세이브가 없다)';
  const j=JSON.parse(t);
  const hit=[]; (function walk(o,p){ if(!o||typeof o!=='object') return;
    if (o['banjiha-etagere']) hit.push(p+' → '+JSON.stringify(o['banjiha-etagere']));
    for (const k in o) walk(o[k], p+'.'+k); })(j,'');
  return hit.length ? hit.join(' | ') : '(어디에도 안 적혔다) 최상위 칸: '+Object.keys(j).join(',');
} catch(e){ return 'ERR '+e.message; } })()`);
console.log(`   세이브(byeot/save/1)에 적힌 것: ${saved}`);
const reloaded = await J(`(()=>{ const f=window.__rv.furniture().find(f=>f.uid==='banjiha-etagere');
  return f ? {x:f.x,y:f.y,z:f.z} : null; })()`);
console.log(`   다시 켠 뒤 선반: ${reloaded ? `(${reloaded.x}, ${reloaded.y}, ${reloaded.z})` : '(없다)'}` +
            `   ${reloaded && reloaded.y > 0.02 ? '✔ 올려 둔 채로 열렸다' : '⛔ 바닥으로 내려앉았다'}`);

console.log(`\nJSON=${JSON.stringify({ before: before.dli, onDresser: afterD, onDesk: afterK, restored,
  ridersBefore: before.riders, ridersAfter, mv1, mv2, mv3, mv4, potBefore, potAfter, drag,
  hand: { picked, label, at: handY }, saved, reloaded,
  best: best.shelf.ok ? { desk: best.desk.to, shelf: best.shelf.to, dli: best.dli } : best })}`);
await page.close();
