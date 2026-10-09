/* ============================================================
   test_species_room_zoom.mjs — 새 두 종(PP · AL)도 «방이 그리는 그림 == 확대가 그리는 그림»인가 ([growth] · 2026-10-09 · 총괄 D45 그림)
   ------------------------------------------------------------
   ★ test_skin_room_matches_zoom(몬스테라 · game.html 판)의 새 종 짝이다. 그 검사는 게임 판(S.pots)에 그루가 있어야 하는데
     PP·AL 화분은 core 의 D45 종 칸이 이어져야 생긴다 — 그 전까지는 «그리는 층»에서 맞댄다:
       방    plant_assemble.youngPlantOf({ species, plant })      (조립기가 평가한 원본 + species_draw.js)
       확대  plant_grow.setSpeciesView({ species, plant })        (원본 그 자체 + species_draw.js)
     같은 그루 상태(정본 species_growth)를 둘에 넘겨 잎마다 판 · 단계 · 등급 · 눕힘 · 자리 · 방위 · 크기를 견준다.
     ⚠ core 가 게임 판에 PP·AL 화분을 이으면 test_skin_room_matches_zoom 에도 이 두 종 판을 더한다(그때는 게임 판 그대로).
   ⚠⚠ 저절로 초록이 되는 자리 — 울타리
     ① 잎이 0 장이면 견줄 것이 없다 → 잎 있는 판은 «그린 잎 = 바라는 잎 > 0» 을 먼저 본다(아니면 FAIL)
     ② 판이 덜 왔으면 빠진 잎끼리 «같다»가 된다 → 둘 다 받는 중 0 이 될 때까지 다시 그린 뒤 견준다
     ③ 확대가 정말 «새 종을» 보이나 — 몬스테라 그룹이 가려졌나 · 끄면 돌아오나 · 카메라가 새 종을 담나
   python tools/serve.py 8963
   BYEOT_URL=http://localhost:8963 node tools/test_species_room_zoom.mjs
============================================================ */
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { launch } from './test_cdp.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const _wd = setTimeout(() => { console.error('⏱ 자가 제한을 넘겨 멈춥니다.'); process.exit(2); }, +(process.env.BYEOT_PROBE_TIMEOUT_MS || 400000));
let fail = 0;
const ok = (c, m) => { console.log((c ? '✅ ' : '⛔ ') + m); if (!c) fail++; };
function colorCount(file) {
  const buf = fs.readFileSync(file); let off = 8, w = 0, h = 0, ct = 0; const idat = [];
  while (off + 8 <= buf.length) { const len = buf.readUInt32BE(off), type = buf.toString('ascii', off + 4, off + 8), d = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); ct = d[9]; } else if (type === 'IDAT') idat.push(d); else if (type === 'IEND') break; off += 12 + len; }
  const ch = { 0: 1, 2: 3, 4: 2, 6: 4 }[ct], raw = zlib.inflateSync(Buffer.concat(idat)), st = w * ch, out = Buffer.alloc(h * st); let p = 0;
  for (let y = 0; y < h; y++) { const f = raw[p++], line = raw.subarray(p, p + st); p += st; const cur = out.subarray(y * st, (y + 1) * st), prev = y ? out.subarray((y - 1) * st, y * st) : null;
    for (let x = 0; x < st; x++) { const a = x >= ch ? cur[x - ch] : 0, b = prev ? prev[x] : 0, c = prev && x >= ch ? prev[x - ch] : 0; let v = line[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1; else if (f === 4) { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); } cur[x] = v & 255; } }
  const s = new Set(); for (let i = 0; i < w * h; i++) { const o = i * ch; s.add((out[o] << 16) | (out[o + 1] << 8) | out[o + 2]); if (s.size > 60000) break; } return s.size;
}

const SETUP = `(async () => {
  const m = await import('${BASE}/src/render3d/plant_assemble.js');
  const sg = await import('${BASE}/src/growth/species_growth.js');
  window.__asm = await m.getPlantAssembler({ timeoutMs: 120000 });
  const spec = await (await fetch('${BASE}/data/growth_species.json')).json(), th = await (await fetch('${BASE}/data/balance/light_thresholds.json')).json();
  window.__R = sg.createSpeciesRules(spec, th);
  const R = window.__R;
  window.__cases = {
    pp4: { species: 'pink_princess', plant: R.newPlant('pink_princess', { seed: 4242, pinks: [0, 0.3, 0.7, 0.95], nodes: 8 }), lightAz: 1.1 },
    pp8: { species: 'pink_princess', plant: R.newPlant('pink_princess', { seed: 77, pinks: [0.35, 0.5, 0.3, 0.7, 0.62, 0.0, 0.45, 0.95] }), lightAz: 0.4 },
    al:  { species: 'alocasia_frydek', plant: (() => { const a = R.newPlant('alocasia_frydek', { seed: 21, origin: 'shop' }); for (let d = 0; d < 160; d++) R.stepDay(a, { dli: 6, season: 'summer' }); return a; })(), lightAz: 2.0 },
    alv: { species: 'alocasia_frydek', plant: (() => { const a = R.newPlant('alocasia_frydek', { seed: 77, origin: 'from_varie_mother', motherKind: 'sector' }); for (let d = 0; d < 160; d++) R.stepDay(a, { dli: 6, season: 'summer' }); return a; })(), lightAz: 2.0 },
    alSleep: { species: 'alocasia_frydek', plant: R.newPlant('alocasia_frydek', { seed: 5, origin: 'shop' }), lightAz: 2.0 },
    /* ★ 빛 방향을 «안 주는» 판 — core 의 방은 lightAz 를 안 넘긴다(2026-10-09). 확대가 제 LIGHT_AZ 로 메우면 덩굴이 기우는 쪽이 갈린다 */
    ppNoAz: { species: 'pink_princess', plant: R.newPlant('pink_princess', { seed: 4242, pinks: [0, 0.3, 0.7, 0.95], nodes: 8 }), potD: 0.18 }
  };
  /* 방 — 받는 중이 0 이 될 때까지 다시 짓는다 */
  window.__room = async (k) => { const c = window.__cases[k]; let g = window.__asm.youngPlantOf(c);
    for (let i = 0; i < 80 && g && g.userData.skinsPending; i++) { await new Promise(z => setTimeout(z, 250)); g = window.__asm.youngPlantOf(c); }
    if (!g) return null; const u = g.userData; let skin = 0; g.traverse(o => { if (o.isMesh && o.userData.varieSkin) skin++; });
    return { leafCount: u.leafCount, want: u.leafCountWanted, pending: u.skinsPending, skin,
      leaves: u.leafPivots.map(p => ({ asset: p.userData.asset, stage: p.userData.stage, grade: p.userData.grade, tilt: p.userData.tilt, scale: p.userData.scale, x: p.position.x, y: p.position.y, z: p.position.z, ry: p.rotation.y })) }; };
  /* 확대 — 같은 것을 확대창 창구로 */
  window.__zoom = async (k) => { const c = window.__cases[k]; let r = await setSpeciesView(c);
    for (let i = 0; i < 80 && r && r.skinsPending; i++) { await new Promise(z => setTimeout(z, 250)); r = await setSpeciesView(c); }
    let skin = 0; const root = scene.getObjectByName('speciesView'); if (root) root.traverse(o => { if (o.isMesh && o.userData.varieSkin) skin++; });
    const bb = root ? new THREE.Box3().setFromObject(root) : null;
    return Object.assign({}, speciesViewInfo(), { skin, monsteraHidden: plantGroup.visible === false, camTy: orbit.ty, rootTop: bb ? bb.max.y : null }); };
  return true;
})()`;

const page = await launch({ width: 900, height: 900, dpr: 1 });
const errs = [];
page.on((method, params) => { if (method === 'Runtime.exceptionThrown') errs.push(String(params.exceptionDetails && params.exceptionDetails.text)); });
try {
  await page.goto(`${BASE}/plant_grow.html?embed=game`);           // 게임이 띄우는 그 확대 모드(조절판 없음)
  await page.waitFor('typeof THREE!=="undefined" && typeof buildPlant==="function" && typeof setSpeciesView==="function" && typeof scene!=="undefined" && !!scene', 60000);
  await page.eval(SETUP);
  const near = (a, b) => Math.abs(a - b) < 1e-9;
  for (const k of ['pp4', 'pp8', 'al', 'alv', 'ppNoAz']) {
    const room = await page.eval(`window.__room('${k}')`);
    const zoom = await page.eval(`window.__zoom('${k}')`);
    /* ★ 대조 — 씨앗을 하나 바꾼 확대는 «달라야» 한다(자가 늘 같다고만 말하는지 거른다) */
    if (k === 'pp4') {
      const other = await page.eval(`(async () => { const c = Object.assign({}, window.__cases.pp4, { seed: 4243 }); const r = await setSpeciesView(c); return r.leaves; })()`);
      const moved = room.leaves.some((r, i) => other[i] && (Math.abs(r.ry - other[i].ry) > 1e-6 || Math.abs(r.x - other[i].x) > 1e-9));
      ok(moved, `pp4 대조: 씨앗을 바꾼 확대는 방과 어긋난다(자가 문다)`);
    }
    const n = room ? room.leafCount : -1;
    const fence = room && zoom && n > 0 && n === room.want && zoom.leafCount === zoom.leafCountWanted && !room.pending && !zoom.skinsPending;
    const diff = [];
    if (fence) room.leaves.forEach((r, i) => { const z = zoom.leaves[i];
      if (!z) { diff.push(`잎${i + 1} 확대에 없음`); return; }
      for (const f of ['asset', 'stage', 'grade']) if (r[f] !== z[f]) diff.push(`잎${i + 1} ${f} ${r[f]}≠${z[f]}`);
      for (const f of ['tilt', 'scale', 'x', 'y', 'z', 'ry']) if (!near(r[f], z[f])) diff.push(`잎${i + 1} ${f} ${r[f]}≠${z[f]}`); });
    ok(fence && zoom.leafCount === n && diff.length === 0 && zoom.skin === room.skin,
      `${k}: 방 잎 ${n} · 확대 잎 ${zoom && zoom.leafCount} · 판·단계·등급·눕힘·자리·방위·크기 어긋남 ${diff.length}${diff.length ? ' — ' + diff.slice(0, 3).join(' · ') : ''} · 무늬 표 메시 방 ${room && room.skin} / 확대 ${zoom && zoom.skin}`);
    ok(zoom && zoom.on && zoom.monsteraHidden && Math.abs(zoom.camTy - (zoom.rootTop * 0.5 + 0.15)) < 1e-6,
      `${k}: 확대가 새 종을 보인다 — 몬스테라 가림 ${zoom && zoom.monsteraHidden} · 카메라가 새 종을 담음(ty ${zoom && zoom.camTy.toFixed(3)} = 꼭대기 ${zoom && zoom.rootTop.toFixed(3)}×0.5+0.15)`);
    if (k === 'pp8' || k === 'alv') {
      await new Promise(r => setTimeout(r, 900));
      const shot = path.join(ROOT, `docs/handoff/img/species_zoom_${k}.png`);
      await page.shot(shot);
      const cc = colorCount(shot);
      ok(cc > 800, `${k}: 확대 사진 ${path.relative(ROOT, shot)} — 색 ${cc}가지`);
    }
  }
  /* AL 잠(잎 0) — 방은 null(화분만) · 확대는 화분만 */
  const rs = await page.eval(`window.__room('alSleep')`), zs = await page.eval(`window.__zoom('alSleep')`);
  ok(rs === null && zs.on && zs.drawn === false && zs.leafCount === 0, `AL 구근(잎 0) — 방 null · 확대는 화분만(drawn ${zs.drawn})`);
  /* 끄면 몬스테라로 돌아온다 */
  const back = await page.eval(`(async () => { const r = await setSpeciesView(null); return { on: r.on, visible: plantGroup.visible, root: !!scene.getObjectByName('speciesView'), skins: Array.isArray(leafSkinUsedAll()) }; })()`);
  ok(back.on === false && back.visible && !back.root && back.skins, `끄면(null) 몬스테라로 — 새 종 그룹 걷힘 · 몬스테라 보임 · 확대 창구(leafSkinUsedAll) 그대로`);
  ok(errs.length === 0, `페이지 예외 ${errs.length}${errs.length ? ' — ' + errs.slice(0, 2).join(' · ') : ''}`);
} finally { await page.close(); clearTimeout(_wd); }
console.log('\nspecies_room_zoom: ' + (fail ? 'FAIL' : 'PASS'));
process.exitCode = fail ? 1 : 0;
