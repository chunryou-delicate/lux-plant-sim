/* ============================================================
   test_species_draw.mjs — 새 두 종(PP · AL)을 «작은 그루» 입구(youngPlantOf)로 그린다 ([growth] · 2026-10-09 · D45 그림)
   ------------------------------------------------------------
   ★ 대상은 브라우저에서 실제로 도는 src/render3d/plant_assemble.js §speciesYoungPlant 다. 페이지는 plant_grow.html.
   ★ 그루 상태는 정본 src/growth/species_growth.js 로 만든다(여기서 잎을 지어내지 않는다).
   ★ 무엇을 지키나
     ① PP — 잎 N 장 = 그린 잎 N · 줄기 마디 N · 판은 정본 leafRows 그대로(등급 → 판) · 무늬판만 틴트 금지 표 · 밑동 y≈0
     ② AL — 잎 N 장 = 그린 잎 N · 가장 새 잎이 가장 곧게(눕힘 0) · 오래된 잎일수록 더 눕는다
     ③ 크기 = 정본 leaf_size_m(실측 미터) — 그린 잎의 높이가 그 단계 크기를 넘지 않는다
     ④ null — AL 잎 0장(구근·잠) · draw 칸 없는 종 · 모르는 종
     ⑤ 같은 값 = 같은 꼴 · 씨앗이 다르면 다른 꼴 · 한 그루 재질을 물들여도 다른 그루는 그대로(재질을 잎마다 뗐다)
     ⑥ 판이 늦게 오면 skinsPending → 도착 알림(onSkinChange)이 온다
     ⑦ 사진 docs/handoff/img/species_young_row.png — 색 가짓수로 까만 사진을 거른다
     python tools/serve.py 8963
     BYEOT_URL=http://localhost:8963 node tools/test_species_draw.mjs
============================================================ */
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { launch } from './test_cdp.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const SPEC = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/growth_species.json'), 'utf8'));
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
  const asm = await m.getPlantAssembler({ timeoutMs: 120000 });
  const spec = await (await fetch('${BASE}/data/growth_species.json')).json();
  const th = await (await fetch('${BASE}/data/balance/light_thresholds.json')).json();
  window.__asm = asm; window.__R = sg.createSpeciesRules(spec, th);
  window.__notes = 0; asm.onSkinChange(() => { window.__notes++; });
  window.__hash = (root) => { root.updateWorldMatrix(true, true);
    const v = new THREE.Vector3(); let h = 2166136261 >>> 0, n = 0;
    const mix = x => { h ^= (x >>> 0); h = Math.imul(h, 16777619) >>> 0; };
    root.traverse(o => { if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
      const p = o.geometry.attributes.position;
      for (let i = 0; i < p.count; i += 7) { v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld); mix(Math.round(v.x * 1e6)); mix(Math.round(v.y * 1e6)); mix(Math.round(v.z * 1e6)); n++; } });
    return { h: h >>> 0, n }; };
  /* 그루 만들기 — 정본 규칙으로만 */
  window.__pp = (pinks, nodes) => window.__R.newPlant('pink_princess', { seed: 4242, pinks, nodes });
  window.__al = (seed, origin, motherKind, days) => { const a = window.__R.newPlant('alocasia_frydek', { seed, origin, motherKind });
    for (let d = 0; d < days; d++) window.__R.stepDay(a, { dli: 6, season: 'summer' }); return a; };
  window.__draw = (o) => { const g = window.__asm.youngPlantOf(o); if (!g) return null; const u = g.userData;
    const bb = new THREE.Box3().setFromObject(g);
    /* 잎마다 «흙 위로 나온 몸»의 가장 낮은 곳 — 자루 밑(밑동에서 잎 크기의 8% 안)은 흙에 묻히는 몫이라 뺀다(그리개와 따로 잰다) */
    g.updateMatrixWorld(true);
    const lowOf = (p) => { const base = new THREE.Vector3().setFromMatrixPosition(p.matrixWorld), r = 0.08 * p.userData.scale, v = new THREE.Vector3(); let lo = Infinity;
      p.traverse(o => { if (!o.isMesh || !o.geometry) return; const pos = o.geometry.attributes.position;
        for (let i = 0; i < pos.count; i += 3) { v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); if (v.distanceTo(base) > r && v.y < lo) lo = v.y; } });
      return lo; };
    const piv = (u.leafPivots || []).map(p => ({ tilt: +p.rotation.x.toFixed(4), want: +p.userData.tiltWant.toFixed(4), scale: +p.userData.scale.toFixed(4), asset: p.userData.asset, stage: p.userData.stage, grade: p.userData.grade, low: +lowOf(p).toFixed(5) }));
    let stems = 0, skinMesh = 0, plainMesh = 0;
    g.traverse(o => { if (o.isMesh && o.userData.part === 'stem') stems++; });
    for (const p of (u.leafPivots || [])) p.traverse(o => { if (!o.isMesh) return; if (o.userData.varieSkin) skinMesh++; else plainMesh++; });
    window.__last = g;
    return { leafCount: u.leafCount, want: u.leafCountWanted, stems, piv, rows: u.leafRows, varieKeys: u.varieLeafKeys, pending: u.skinsPending,
             missing: u.missingAssets, failed: u.failedAssets, minY: +bb.min.y.toFixed(5), h: +u.sizeM.h.toFixed(4), d: +u.sizeM.d.toFixed(4), skinMesh, plainMesh, clamped: u.tiltClamped, hash: window.__hash(g) }; };
  /* 판이 다 올 때까지 다시 짓는다 */
  window.__drawReady = async (o) => { let r = window.__draw(o); for (let i = 0; i < 80 && r && r.pending; i++) { await new Promise(z => setTimeout(z, 250)); r = window.__draw(o); } return r; };
  return asm.speciesInfo();
})()`;

const page = await launch({ width: 1400, height: 560, dpr: 1 });
const errs = [];
page.on((method, params) => { if (method === 'Runtime.exceptionThrown') errs.push(String(params.exceptionDetails && params.exceptionDetails.text)); });
try {
  await page.goto(`${BASE}/plant_grow.html`);
  await page.waitFor('typeof THREE!=="undefined" && typeof buildPlant==="function"', 60000);
  const info = await page.eval(SETUP);
  ok(info.ok && !info.err, `조립기가 새 종 규칙을 실었다 ${JSON.stringify(info)}`);

  /* ⑥ 먼저 — 첫 그리기는 판이 아직 없어 pending 이어야 하고, 도착 알림이 와야 한다 */
  const first = await page.eval(`window.__draw({ species: 'pink_princess', plant: window.__pp([0, 0.3, 0.7, 0.95], 8) })`);
  const notes0 = await page.eval('window.__notes');
  const pp = await page.eval(`window.__drawReady({ species: 'pink_princess', plant: window.__pp([0, 0.3, 0.7, 0.95], 8) })`);
  const notes1 = await page.eval('window.__notes');
  ok(first && first.pending > 0 && first.leafCount < 4 && notes1 > notes0 && pp.pending === 0,
    `⑥ 첫 그리기 판 없음(pending ${first && first.pending} · 그린 잎 ${first && first.leafCount}) → 도착 알림 ${notes1 - notes0}번 → 다시 지으면 다 옴`);

  /* ① PP */
  const PPS = SPEC.species.pink_princess;
  const wantAssets = pp.rows.map(r => r.asset), gotAssets = pp.piv.map(p => p.asset);
  ok(pp.leafCount === 4 && pp.want === 4 && pp.stems === 4 && JSON.stringify(gotAssets) === JSON.stringify(wantAssets) && !pp.failed.length,
    `① PP 잎 4 = 그린 잎 ${pp.leafCount} · 줄기 마디 ${pp.stems} · 판 = 정본 leafRows ${JSON.stringify(pp.rows.map(r => r.stage + '/' + r.grade))}`);
  const wantSkins = [...new Set(pp.rows.map(r => r.asset).filter(a => /\/skins\//.test(a)))].sort();
  ok(JSON.stringify([...pp.varieKeys].sort()) === JSON.stringify(wantSkins) && pp.skinMesh === 3 && pp.plainMesh >= 1,
    `① PP 무늬판만 틴트 금지 표 — 무늬 판 ${pp.varieKeys.length}가지(${pp.varieKeys.map(k => k.split('/').pop()).join(' · ')} · 마블·분홍 많음 중간잎은 같은 판) · 표 단 잎 ${pp.skinMesh}(무늬 잎 3) · 민무늬 ${pp.plainMesh}`);
  ok(pp.piv.every(p => p.low >= -0.002), `① PP 흙 밑으로 안 들어간다 — 잎마다 흙 위 몸의 맨 아래 ${pp.piv.map(p => p.low).join(' · ')} · 눕힘 줄인 잎 ${pp.clamped}`);

  /* ③ 크기 — 잎의 «제 높이»(정규화 높이 1 × 배율) = 실측 × 조정표 배. 눕힌 뒤의 세로 폭은 크기가 아니다(눕히면 잎몸 폭이 섞인다) */
  const sizeOf = (S, st) => +(S.leaf_size_m[st] * ((S.draw.adj[st] || {}).scale ?? 1)).toFixed(4);
  const over = pp.piv.filter(p => Math.abs(p.scale - sizeOf(PPS, p.stage)) > 1e-4);
  ok(over.length === 0, `③ PP 잎 크기 = 실측 × 조정표 — ${pp.piv.map(p => `${p.stage} ${p.scale}m`).join(' · ')} (어긋난 잎 ${over.length})`);

  /* ② AL */
  const ALS = SPEC.species.alocasia_frydek;
  const al = await page.eval(`window.__drawReady({ species: 'alocasia_frydek', plant: window.__al(21, 'shop', null, 160) })`);
  const wants = al.piv.map(p => p.want), tilts = al.piv.map(p => p.tilt);
  const mono = wants.every((t, i) => i === 0 || t <= wants[i - 1] + 1e-9);
  ok(al.leafCount === al.want && al.want >= 3 && al.stems === 0 && wants[wants.length - 1] === 0 && mono && wants[0] > 0 && tilts.every((t, i) => t <= wants[i] + 1e-9),
    `② AL 잎 ${al.want} = 그린 잎 ${al.leafCount} · 줄기 없음 · 바라는 눕힘(오래된→새) ${JSON.stringify(wants)} · 실제 ${JSON.stringify(tilts)}`);
  const alOver = al.piv.filter(p => Math.abs(p.scale - sizeOf(ALS, p.stage)) > 1e-4);
  ok(alOver.length === 0 && al.piv.every(p => p.low >= -0.002) && al.piv.slice(0, -1).some(p => p.tilt > 0.1),
    `③ AL 잎 크기 = 실측 — ${al.piv.map(p => `${p.stage} ${p.scale}m`).join(' · ')} · 흙 위 몸 맨 아래 ${al.piv.map(p => p.low).join(' · ')} · 눕힘 줄인 잎 ${al.clamped} · 실제 눕힘 ${JSON.stringify(al.piv.map(p => p.tilt))} (바라던 ${JSON.stringify(al.piv.map(p => p.want))})`);
  const alv = await page.eval(`window.__drawReady({ species: 'alocasia_frydek', plant: (() => { const a = window.__al(77, 'from_varie_mother', 'sector', 160); return a; })() })`);
  const alvState = await page.eval(`window.__al(77, 'from_varie_mother', 'sector', 160).varie`);
  ok(alvState ? alv.varieKeys.length > 0 : alv.varieKeys.length === 0, `② AL 무늬 그루(${alvState || '민무늬'}) — 무늬 판 ${JSON.stringify(alv.varieKeys.map(k => k.split('/').pop()))}`);

  /* ④ null */
  const nulls = await page.eval(`JSON.stringify([
    window.__asm.youngPlantOf({ species: 'alocasia_frydek', plant: window.__al(5, 'shop', null, 0) }),
    window.__asm.youngPlantOf({ species: 'alocasia_frydek', rows: [] }),
    window.__asm.youngPlantOf({ species: 'calathea', rows: [{ stage: 'young', asset: 'x', size_m: 0.1 }] }) ].map(x => x === null))`);
  ok(nulls === '[true,true,true]', `④ AL 구근(잎 0) · 빈 줄 · 모르는 종 → null ${nulls}`);

  /* ⑤ */
  /* ⚠ 판이 다 온 뒤에 견준다 — 받는 중이면 빠진 잎 때문에 «같은 값 다른 꼴»로 잘못 붉는다(실제로 그랬다 · 어린잎 판은 이 판에서 처음 쓴다) */
  const a1 = await page.eval(`window.__drawReady({ species: 'pink_princess', plant: window.__pp([0.2, 0.4, 0.5], 3) })`);
  const a2 = await page.eval(`window.__drawReady({ species: 'pink_princess', plant: window.__pp([0.2, 0.4, 0.5], 3) })`);
  const a3 = await page.eval(`window.__drawReady({ species: 'pink_princess', plant: window.__pp([0.2, 0.4, 0.5], 3), seed: 99 })`);
  ok(!a1.pending && a1.leafCount === 3 && a1.hash.h === a2.hash.h && a3.hash.h !== a1.hash.h, `⑤ 같은 값 = 같은 꼴(${a1.hash.h} · 잎 ${a1.leafCount}) · 씨앗이 다르면 다른 꼴(${a3.hash.h})`);
  const iso = await page.eval(`(() => {
    const g1 = window.__asm.youngPlantOf({ species: 'pink_princess', plant: window.__pp([0.2, 0.4], 2) });
    const g2 = window.__asm.youngPlantOf({ species: 'pink_princess', plant: window.__pp([0.2, 0.4], 2) });
    const m1 = []; g1.traverse(o => { if (o.isMesh) m1.push(o); }); const m2 = []; g2.traverse(o => { if (o.isMesh) m2.push(o); });
    const before = m2.map(o => o.material.color.getHexString()).join();
    for (const o of m1) o.material.color.set(0xff0000);
    const after = m2.map(o => o.material.color.getHexString()).join();
    return { same: before === after, shared: m1.some((o, i) => o.material === m2[i].material) }; })()`);
  ok(iso.same && !iso.shared, `⑤ 한 그루를 빨갛게 물들여도 다른 그루는 그대로(재질 나눠 씀 ${iso.shared})`);

  /* ⑧ D55 — 새 종도 youngPlantSizeOf(같은 인자) = 그린 그루의 sizeM */
  { const r = await page.eval(`(async () => { const A = window.__asm; const o = { species: 'pink_princess', plant: window.__pp([0.2, 0.4, 0.5, 0.6], 4) };
      await window.__drawReady(o); const s = A.youngPlantSizeOf(o), g = A.youngPlantOf(o);
      return { s, drawn: g.userData.sizeM, leaves: g.userData.leafCount }; })()`);
    ok(r.s && !r.s.skinsPending && Math.abs(r.s.d - r.drawn.d) < 1e-9 && Math.abs(r.s.h - r.drawn.h) < 1e-9 && r.s.leafCount === r.leaves,
      `⑧ D55 새 종 크기만 묻기 — PP 잎 ${r.leaves} · 폭 ${r.s && r.s.d.toFixed(3)}m · 키 ${r.s && r.s.h.toFixed(3)}m = 그린 그루`); }

  /* ⑦ 사진 — PP 잎 1~8(분홍 몫 여러 가지) · AL 구근에서 0~200일 */
  const shot = path.join(ROOT, 'docs/handoff/img/species_young_row.png');
  await page.eval(`(async () => {
    plantGroup.visible = false;
    const cv = renderer.domElement;
    for (const el of document.body.querySelectorAll('*')) if (el !== cv && !el.contains(cv) && el.parentElement && (el.parentElement === document.body || el.parentElement.contains(cv))) el.style.visibility = 'hidden';
    const row = new THREE.Group(); row.name = '__spRow';
    const pinks = [0.35, 0.5, 0.3, 0.7, 0.62, 0.0, 0.45, 0.95];
    const items = [];
    for (const n of [1, 3, 5, 8]) items.push({ species: 'pink_princess', plant: window.__pp(pinks.slice(0, n), n) });
    for (const [s, o, k, d] of [[21, 'shop', null, 40], [21, 'shop', null, 100], [77, 'from_varie_mother', 'sector', 160], [91, 'from_varie_mother', 'marble', 200]])
      items.push({ species: 'alocasia_frydek', plant: window.__al(s, o, k, d) });
    for (const it of items) await window.__drawReady(it);
    items.forEach((it, i) => { const g = window.__asm.youngPlantOf(it); if (!g) return; g.position.x = (i - 3.5) * 0.36; row.add(g); });
    scene.add(row);
    const bb = new THREE.Box3().setFromObject(row), c = bb.getCenter(new THREE.Vector3()), s = bb.getSize(new THREE.Vector3());
    const a = innerWidth / innerHeight, F = Math.max(s.y * 0.62, s.x / (2 * a) * 1.06);
    orbit.tx = c.x; orbit.ty = c.y; orbit.tz = c.z; orbit.az = 0.35; orbit.el = 0.25; orbit.zoom = 1;
    cam.left = -F * a; cam.right = F * a; cam.top = F; cam.bottom = -F;
    updateCam(); renderer.render(scene, cam); return true; })()`);
  await new Promise(r => setTimeout(r, 1500));
  await page.shot(shot);
  const cc = colorCount(shot);
  ok(cc > 800, `⑦ 사진 ${path.relative(ROOT, shot)} — 색 ${cc}가지`);
  ok(errs.length === 0, `페이지 예외 ${errs.length}${errs.length ? ' — ' + errs.slice(0, 2).join(' · ') : ''}`);
} finally { await page.close(); clearTimeout(_wd); }
console.log('\nspecies_draw: ' + (fail ? 'FAIL' : 'PASS'));
process.exitCode = fail ? 1 : 0;
