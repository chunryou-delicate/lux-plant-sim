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
     ★ D71(2026-10-23) — 두 종 더
     ⑨ SC 늘어지는 줄기(높은 자리) — 잎 N = 그린 잎 · 늘어진 잎은 화분 밖 · 늘어뜨린 쪽(az) · 겉면이 바깥·위 · 바닥 밑으로 안 감 · 크기(sizeM)는 화분 위 몫만
     ⑩ SC 바닥에 닿은 그루 — 줄기 끝이 바닥에 닿고 남는 몫은 바닥에 눕는다 · hang 이 없으면 hangGiven false(받침에 눕힘)
     ⑪ SC 마블 — 어두울 때 난 잎은 초록 판 · 마블 판은 틴트 금지 표 · 마블퀸 판 크기 = leaf 넓이 맞춤(stage_real_m)
     ⑫ CA 말린 잎 — 말린 잎은 옆 폭이 좁다 · 말린 판을 지어도 원판(펴진 잎)은 그대로 · 밤엔 잎을 세운다(바라는 눕힘 × night_tilt_mult)
     ⑬ 사진 docs/handoff/img/species2_sc_hang.png(늘어진 SC — 바닥 · 진열대 · 높은 자리 · 바닥으로 옮긴 긴 줄기) · species2_ca_curl.png(말린 · 펴진 · 밤 CA)
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
    const piv = (u.leafPivots || []).map(p => ({ tilt: p.userData.tilt == null ? null : +p.userData.tilt.toFixed(4), want: p.userData.tiltWant == null ? null : +p.userData.tiltWant.toFixed(4), scale: +p.userData.scale.toFixed(4), asset: p.userData.asset, stage: p.userData.stage, grade: p.userData.grade, low: +lowOf(p).toFixed(5), pose: p.userData.pose || null, curl: p.userData.curl ?? null }));
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
    window.__asm.youngPlantOf({ species: 'monstera_adansonii', rows: [{ stage: 'young', asset: 'x', size_m: 0.1 }] }) ].map(x => x === null))`);
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
  /* ══ D71 — 스킨답서스 · 칼라테아 ══════════════════════════════════════ */
  await page.eval(`(() => {
    const R = window.__R;
    /* SC — 뿌리 낸 마디 둘에서 dropM 자리로 days 일(dli · 봄) */
    window.__sc = (seed, days, dropM, dli, then) => { const p = R.newPlant('scindapsus', { seed, form: 'rooted', nodes: 2 });
      for (let d = 0; d < days; d++) R.stepDay(p, { dli: typeof dli === 'function' ? dli(d) : dli, season: 'spring', dropM });
      if (then) for (let d = 0; d < then.days; d++) R.stepDay(p, { dli: then.dli, season: 'spring', dropM: then.dropM });
      return p; };
    window.__ca = (seed, leaves, curled) => R.newPlant('calathea', { seed, leaves, curled });
    /* 그린 그루를 잰다 — 잎마다 세계 좌표 · 겉면(자세 A 의 −Z) · 줄기 맨 아래 · 전체 맨 아래 */
    window.__scan = (g, az) => { g.updateMatrixWorld(true);
      const u = new THREE.Vector3(Math.sin(az || 0), 0, Math.cos(az || 0)), v = new THREE.Vector3(), q = new THREE.Quaternion();
      const leaves = g.userData.leafPivots.map(p => { const w = new THREE.Vector3().setFromMatrixPosition(p.matrixWorld); p.getWorldQuaternion(q);
        const n = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
        return { pose: p.userData.pose || 'tilt', r: Math.hypot(w.x, w.z), out: w.dot(u), y: w.y, nOut: n.dot(u), nY: n.y, scale: p.userData.scale, asset: p.userData.asset, stage: p.userData.stage }; });
      let stemLo = Infinity, stemR = 0, lo = Infinity, hi = -Infinity;
      g.traverse(o => { if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return; const pos = o.geometry.attributes.position;
        for (let i = 0; i < pos.count; i += 2) { v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); lo = Math.min(lo, v.y); hi = Math.max(hi, v.y);
          if (o.userData.part === 'stem') { stemLo = Math.min(stemLo, v.y); stemR = Math.max(stemR, Math.hypot(v.x, v.z)); } } });
      return { leaves, stemLo, stemR, lo, hi, u: g.userData };
    };
    /* 잎마다 옆 폭(잎 자리 좌표의 X 폭 ÷ 잎 크기) — 말린 잎은 좁다 */
    window.__widths = (g) => { g.updateMatrixWorld(true); const v = new THREE.Vector3();
      return g.userData.leafPivots.map(p => { const inv = new THREE.Matrix4().copy(p.matrixWorld).invert(); let a = Infinity, b = -Infinity;
        p.traverse(o => { if (!o.isMesh || !o.geometry) return; const pos = o.geometry.attributes.position, m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
          for (let i = 0; i < pos.count; i += 2) { v.fromBufferAttribute(pos, i).applyMatrix4(m); a = Math.min(a, v.x); b = Math.max(b, v.x); } });
        return +((b - a) / p.userData.scale).toFixed(4); }); };
    return true; })()`);
  const SCS = SPEC.species.scindapsus, CAS = SPEC.species.calathea;

  /* ⑨ 높은 자리(진열대 윗단 0.79)에 늘어진 줄기 */
  { const potD = 0.18, potH = 0.12, drop = 0.79;
    const o = `{ species: 'scindapsus', plant: window.__sc(51, 120, ${drop}, 6), potD: ${potD}, hang: { dropM: ${drop}, potH: ${potH}, az: 0 } }`;
    const d = await page.eval(`window.__drawReady(${o})`);
    const s = await page.eval(`(() => { const g = window.__asm.youngPlantOf(${o}); const r = window.__scan(g, 0); r.u = { sizeM: r.u.sizeM, hang: r.u.hang, hangGiven: r.u.hangGiven }; return r; })()`);
    const hang = s.leaves.filter(l => l.pose === 'hang'), outside = s.leaves.filter(l => l.pose !== 'tilt');
    ok(d && !d.pending && d.leafCount === d.want && d.want >= 8 && hang.length >= 3 && outside.every(l => l.r >= potD / 2) && hang.every(l => l.out > 0),
      `⑨ SC 높은 자리(받침 ${drop}m) 120일 — 잎 ${d && d.want} = 그린 잎 ${d && d.leafCount} · 늘어진 잎 ${hang.length} · 화분 밖(가장 안쪽 ${Math.min(...outside.map(l => l.r)).toFixed(3)} ≥ ${potD / 2}) · 늘어뜨린 쪽`);
    ok(hang.every(l => l.nOut > 0.3 && l.nY > 0), `⑨ 늘어진 잎 겉면이 바깥·위를 본다 — 바깥 ${Math.min(...hang.map(l => l.nOut)).toFixed(2)}~ · 위 ${Math.min(...hang.map(l => l.nY)).toFixed(2)}~`);
    ok(s.lo >= -(potH + drop) - 0.01 && s.stemLo < -potH - 0.2 && s.u.hang && s.u.hang.given && Math.abs(s.u.hang.lengthM - s.u.hang.plantLengthM) < 1e-9,
      `⑨ 줄기 끝 ${s.stemLo.toFixed(3)}m(흙 기준) — 받침 밑으로 늘어졌고 바닥(${-(potH + drop)}) 밑으로는 안 감(전체 맨 아래 ${s.lo.toFixed(3)}) · 줄기 ${s.u.hang && s.u.hang.lengthM}m`);
    ok(s.u.sizeM.h < 0.2 && s.hi - s.lo > 0.5 && s.u.sizeM.d < potD + 0.25,
      `⑨ 크기(D55 칸 붐빔)는 화분 위 몫만 — 키 ${s.u.sizeM.h.toFixed(3)} · 폭 ${s.u.sizeM.d.toFixed(3)}m (늘어진 몫까지 ${(s.hi - s.lo).toFixed(2)}m 는 안 셈)`); }

  /* ⑩ 바닥 자리 — 바닥에 닿은 그루 · 높은 데서 자란 그루를 바닥에 옮김 · hang 없음 */
  { const potH = 0.12;
    const of = (pl, drop, az) => `{ species: 'scindapsus', plant: ${pl}, potD: 0.18, hang: { dropM: ${drop}, potH: ${potH}, az: ${az} } }`;
    const a = of(`window.__sc(52, 200, 0.02, 6)`, 0.02, 1.2);
    await page.eval(`window.__drawReady(${a})`);
    const sa = await page.eval(`(() => { const g = window.__asm.youngPlantOf(${a}); const r = window.__scan(g, 1.2); r.u = { hang: r.u.hang, atFloor: g.userData.hang.atFloor }; return r; })()`);
    const floor = -(potH + 0.02);
    ok(sa.u.atFloor && Math.abs(sa.stemLo - floor) < 0.012 && sa.lo >= floor - 0.012,
      `⑩ 바닥 자리(받침 0.02) 200일 — 바닥에 닿음 · 줄기 맨 아래 ${sa.stemLo.toFixed(3)} ≈ 바닥 ${floor} · 전체 맨 아래 ${sa.lo.toFixed(3)}`);
    const b = of(`window.__sc(53, 150, 1.4, 6, { days: 2, dli: 6, dropM: 0.02 })`, 0.02, 1.2);
    await page.eval(`window.__drawReady(${b})`);
    const sb = await page.eval(`(() => { const g = window.__asm.youngPlantOf(${b}); const r = window.__scan(g, 1.2); r.u = { hang: g.userData.hang }; return r; })()`);
    ok(sb.u.hang.atFloor && sb.u.hang.lengthM > sb.u.hang.floorLenM + 0.2 && sb.leaves.some(l => l.pose === 'lie') && sb.stemR > 0.09 + 0.2 && sb.lo >= floor - 0.012,
      `⑩ 높은 데서 ${sb.u.hang.lengthM}m 자란 줄기를 바닥 자리로 — 바닥까지 ${sb.u.hang.floorLenM.toFixed(2)}m · 남는 몫은 바닥에 누움(누운 잎 ${sb.leaves.filter(l => l.pose === 'lie').length} · 줄기가 ${sb.stemR.toFixed(2)}m 까지 뻗음)`);
    const c = await page.eval(`(() => { const g = window.__asm.youngPlantOf({ species: 'scindapsus', plant: window.__sc(54, 60, 0.79, 6), potD: 0.18 }); return { given: g.userData.hangGiven, lo: window.__scan(g, 0).lo, potH: g.userData.hang.potH }; })()`);
    ok(c.given === false && c.lo >= -c.potH - 0.012, `⑩ hang 없이 그리면 hangGiven ${c.given} · 받침(기본 화분 높이 ${c.potH})에 눕힘 — 메꾼 것을 숨기지 않음`); }

  /* ⑪ 마블 — 어두울 때 난 잎은 초록 판 · 마블퀸 판 크기 */
  { const o = `{ species: 'scindapsus', plant: window.__sc(55, 70, 1.4, d => d < 35 ? 2.5 : 6), potD: 0.18, hang: { dropM: 1.4, potH: 0.12, az: 0 } }`;
    const d = await page.eval(`window.__drawReady(${o})`);
    const green = d.rows.filter(r => r.grade === 'green'), marble = d.rows.filter(r => r.grade === 'marble' && r.stage !== 'young');
    const mq = 'plants/scindapsus/skins/sc_leaf_mature_marblequeen.glb', sr = SCS.draw.adj_by_asset[mq].stage_real_m;
    const sizeOk = d.piv.filter(p => p.asset === mq).every(p => Math.abs(p.scale - sr[p.stage] * ((SCS.draw.adj[p.stage] || {}).scale ?? 1)) < 1e-4);
    ok(!d.pending && green.length > 0 && marble.length > 0 && JSON.stringify(d.piv.map(p => p.asset)) === JSON.stringify(d.rows.map(r => r.asset)) && d.varieKeys.includes(mq) && d.skinMesh > 0 && sizeOk,
      `⑪ SC 어두울 때(2.5) 난 잎 ${green.length}장 초록 판 · 밝을 때 마블 ${marble.length}장(마블퀸 · 틴트 금지 표 ${d.skinMesh}) · 마블퀸 크기 = leaf 넓이 맞춤 ${JSON.stringify(sr)}`); }

  /* ⑫ CA — 말린 잎 · 원판 그대로 · 밤 */
  { const flat = `{ species: 'calathea', plant: window.__ca(61, 5, 0) }`, cur = `{ species: 'calathea', plant: window.__ca(61, 5, 'all') }`;
    const f1 = await page.eval(`window.__drawReady(${flat})`);
    const c1 = await page.eval(`window.__drawReady(${cur})`);
    const f2 = await page.eval(`window.__drawReady(${flat})`);
    const w = await page.eval(`({ f: window.__widths(window.__asm.youngPlantOf(${flat})), c: window.__widths(window.__asm.youngPlantOf(${cur})) })`);
    const ratio = w.c.map((x, i) => x / w.f[i]);
    ok(!c1.pending && c1.leafCount === 5 && c1.piv.every(p => p.curl === 1) && ratio.every(r => r < 0.6) && c1.hash.h !== f1.hash.h,
      `⑫ CA 말린 잎 5장 — 옆 폭 ÷ 펴진 잎 ${ratio.map(r => r.toFixed(2)).join(' · ')} (< 0.6)`);
    ok(f1.hash.h === f2.hash.h, `⑫ 말린 판을 지은 뒤에도 펴진 잎은 그대로(${f1.hash.h} = ${f2.hash.h} · 원판을 안 휨)`);
    const sizeOk = f1.piv.every(p => Math.abs(p.scale - CAS.leaf_size_m[p.stage] * ((CAS.draw.adj[p.stage] || {}).scale ?? 1)) < 1e-4);
    const n1 = await page.eval(`window.__drawReady({ species: 'calathea', plant: window.__ca(61, 5, 0), night: true })`);
    const mult = CAS.draw.night_tilt_mult;
    ok(sizeOk && n1.piv.every((p, i) => Math.abs(p.want - f1.piv[i].want * mult) < 1e-4) && n1.piv.some(p => p.want < f1.piv[0].want),
      `⑫ 밤 — 바라는 눕힘 ${f1.piv.map(p => p.want).join('/')} → ×${mult} ${n1.piv.map(p => p.want).join('/')} · 크기 = 실측 ${f1.piv[0].scale}m`); }

  /* ⑬ 사진 두 장 — 늘어진 SC(바닥 · 진열대 0.45 · 높은 자리 0.79 · 높은 데서 자라 바닥으로 옮긴 줄기) / CA 말림 · 펴짐 · 밤 */
  const photo = async (file, which) => {
    await page.eval(`(async () => {
      for (const nm of ['__spRow', '__spRow2']) { const old = scene.getObjectByName(nm); if (old) old.parent.remove(old); }
      plantGroup.visible = false;
      const row = new THREE.Group(); row.name = '__spRow2';
      const AZ = 0.35, potH = 0.12, potD = 0.18;
      const all = {
        sc: [ { species: 'scindapsus', plant: window.__sc(52, 200, 0.02, 6), drop: 0.02 },
              { species: 'scindapsus', plant: window.__sc(56, 200, 0.45, 6), drop: 0.45 },
              { species: 'scindapsus', plant: window.__sc(51, 160, 0.79, 6), drop: 0.79 },
              { species: 'scindapsus', plant: window.__sc(53, 150, 1.4, 6, { days: 2, dli: 6, dropM: 0.02 }), drop: 0.02 } ],
        ca: [ { species: 'calathea', plant: window.__ca(61, 5, 'all') },
              { species: 'calathea', plant: window.__ca(61, 5, 0) },
              { species: 'calathea', plant: window.__ca(61, 5, 0), night: true } ] };
      const items = all['${which}'], gap = '${which}' === 'sc' ? 0.6 : 0.5;
      const potMat = new THREE.MeshStandardMaterial({ color: 0xb98a6a, roughness: 0.9 }), woodMat = new THREE.MeshStandardMaterial({ color: 0xd9c6a5, roughness: 0.85 });
      const floorMat = new THREE.MeshStandardMaterial({ color: 0xe8e4dc, roughness: 1 });
      if ('${which}' === 'sc') items[3].az = AZ - 1.3;   /* 바닥으로 옮긴 긴 줄기 — 옆으로 눕혀 보이게 */
      for (const it of items) { const o = { ...it, potD }; if (it.species === 'scindapsus') o.hang = { dropM: it.drop, potH, az: it.az ?? AZ }; await window.__drawReady(o); it.o = o; }
      const subj = new THREE.Group(); row.add(subj);
      items.forEach((it, i) => {
        const g = window.__asm.youngPlantOf(it.o); if (!g) return;
        const cell = new THREE.Group(); cell.position.set((i - (items.length - 1) / 2) * gap, (it.drop ?? 0) + potH, 0); subj.add(cell);
        cell.add(g);
        const pot = new THREE.Mesh(new THREE.CylinderGeometry(potD / 2, potD * 0.4, potH, 20), potMat); pot.position.y = -potH / 2 + 0.005; cell.add(pot);
        if (it.drop != null && it.drop > 0.05) {          /* 받침(가구) — 앞 끝이 화분 테두리에 붙는다 */
          const dep = 0.34, box = new THREE.Mesh(new THREE.BoxGeometry(0.42, it.drop, dep), woodMat);
          box.position.set(-Math.sin(AZ) * (dep / 2 - potD / 2), -potH - it.drop / 2, -Math.cos(AZ) * (dep / 2 - potD / 2)); box.rotation.y = AZ; cell.add(box);
        }
      });
      const bb = new THREE.Box3().setFromObject(subj), c = bb.getCenter(new THREE.Vector3()), s = bb.getSize(new THREE.Vector3());
      const fl = new THREE.Mesh(new THREE.BoxGeometry(s.x + 0.6, 0.01, 1.0), floorMat); fl.position.set(c.x, -0.005, c.z + 0.1); row.add(fl);
      scene.add(row);
      const a = innerWidth / innerHeight, F = Math.max(s.y * 0.58, s.x / (2 * a) * 1.08);
      orbit.tx = c.x; orbit.ty = c.y; orbit.tz = c.z; orbit.az = AZ; orbit.el = 0.16; orbit.zoom = 1;
      cam.left = -F * a; cam.right = F * a; cam.top = F; cam.bottom = -F;
      updateCam(); renderer.render(scene, cam); return true; })()`);
    await new Promise(r => setTimeout(r, 1500));
    await page.shot(file);
    return colorCount(file);
  };
  for (const [which, name] of [['sc', 'species2_sc_hang.png'], ['ca', 'species2_ca_curl.png']]) {
    const f = path.join(ROOT, 'docs/handoff/img', name), cc = await photo(f, which);
    ok(cc > 800, `⑬ 사진 ${path.relative(ROOT, f)} — 색 ${cc}가지`); }

  ok(errs.length === 0, `페이지 예외 ${errs.length}${errs.length ? ' — ' + errs.slice(0, 2).join(' · ') : ''}`);
} finally { await page.close(); clearTimeout(_wd); }
console.log('\nspecies_draw: ' + (fail ? 'FAIL' : 'PASS'));
process.exitCode = fail ? 1 : 0;
