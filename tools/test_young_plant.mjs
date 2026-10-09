/* ============================================================
   test_young_plant.mjs — 흙에 자리 잡은 삽수를 «작은 그루»로 그리는 입구(youngPlantOf)를 지킨다 ([growth] · 2026-10-09 · 총괄 D46)
   ------------------------------------------------------------
   ★ 대상은 브라우저에서 실제로 도는 src/render3d/plant_assemble.js 다(vm 스텁 아님). 띄우는 페이지는 plant_grow.html.
   ★ 무엇을 지키나
     ① 잎 N 장을 주면 «그린 잎»도 N 장(1~6 · 다음 잎까지 0 / 0.5 / 0.95) · 난 때 N 개 · 화분만 걷힘('pot') · 밑동 y≈0
     ② 잎이 늘면 그루가 안 줄어든다(높이) · 다음 잎까지 몫이 늘어도 안 줄어든다
     ③ 같은 값 = 같은 꼴 · 씨앗이 다르면 다른 꼴
     ④ 무늬 — 정본이 준 잎만 무늬 그림(그 midSkin)으로 · 민무늬 잎은 민무늬
     ⑤ 못 그리는 것은 null — 잎 0장 · 다른 종(D45 는 아직 그리개 없음) · 그 씨앗이 못 내는 장수
     ⑥ withPot:true 면 화분이 남는다 · nextLeaf01 안 주면 «안 줬다»가 적힌다
     ⑦ ★ 이 입구가 모주 조립(assemble)을 안 흔든다 — 씨앗을 잠깐 바꿔 끼우는 읽기가 새지 않나
     ⑧ 사진 — 잎 1~6 장을 나란히(docs/handoff/img/young_plant_row.png) · 색 가짓수로 까만 사진을 거른다
     ⑩ D55 youngPlantSizeOf — 그리지 않고 키·폭만(같은 인자 = 그린 그루의 sizeM · 기억해 둠)
     ⑨ ★ 들고 온 잎은 다 큰 잎(총괄 2026-10-09 · leaf 재기 «잎 1장 삽수가 말린 새순»):
        다 들고 온 잎이면 다음 잎 몫 0 에서도 N 번째 잎이 펼쳐진 중간잎 · 흙에서 낸 잎은 펼쳐진 뒤부터 · 다음 잎은 몫 끝자락에만 말린 순
     python tools/serve.py 8963
     BYEOT_URL=http://localhost:8963 node tools/test_young_plant.mjs
============================================================ */
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { launch } from './test_cdp.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const _wd = setTimeout(() => { console.error('⏱ 자가 제한을 넘겨 멈춥니다.'); process.exit(2); }, +(process.env.BYEOT_PROBE_TIMEOUT_MS || 400000));
let fail = 0;
const ok = (c, m) => { console.log((c ? '✅ ' : '⛔ ') + m); if (!c) fail++; };

/* PNG 색 가짓수(probe_branchcut 과 같은 벌 — 이 저장소엔 node_modules 가 없다) */
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
  const asm = await m.getPlantAssembler({ timeoutMs: 120000 });
  window.__asm = asm;
  window.__hash = (root) => { root.updateWorldMatrix(true, true);
    const v = new THREE.Vector3(); let h = 2166136261 >>> 0, n = 0;
    const mix = x => { h ^= (x >>> 0); h = Math.imul(h, 16777619) >>> 0; };
    root.traverse(o => { if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
      const p = o.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld); mix(Math.round(v.x * 1e6)); mix(Math.round(v.y * 1e6)); mix(Math.round(v.z * 1e6)); n++; } });
    return { h: h >>> 0, n }; };
  window.__yp = (o) => { const g = asm.youngPlantOf(o); if (!g) return null;
    const bb = new THREE.Box3().setFromObject(g); const u = g.userData;
    const r = { leafCount: u.leafCount, want: u.leafCountWanted, births: u.leafBirths, days: u.growthDays, ageG: u.ageG,
      dropped: u.droppedParts, h: u.sizeM.h, d: u.sizeM.d, minY: bb.min.y, hash: window.__hash(g), kind: u.kind,
      given: u.nextLeaf01Given, varieKeys: u.varieLeafKeys, pending: u.skinsPending, spear: u.spearCount, carried: u.carriedLeaves,
      skins: (asm.leafSkinUsedAll() || []).map(x => ({ lb: x.leafBirth, key: x.key })) };
    window.__last = g; return r; };
  return { GMAX: asm.GMAX };
})()`;

const page = await launch({ width: 1200, height: 520, dpr: 1 });
const errs = [];
page.on((method, params) => { if (method === 'Runtime.exceptionThrown') errs.push(String(params.exceptionDetails && params.exceptionDetails.text)); });
try {
  await page.goto(`${BASE}/plant_grow.html`);
  await page.waitFor('typeof THREE!=="undefined" && typeof buildPlant==="function"', 60000);
  await page.eval(SETUP);
  const SEED = 777001, POT = 0.09;
  const plain = n => JSON.stringify(Array.from({ length: n }, () => ({ varie: false })));

  /* ⑦ 앞 — 모주 해시를 먼저 떠 둔다 */
  const motherBefore = await page.eval(`window.__hash(window.__asm.assemble({ growthDays: 200, seed: 92158, potD: 0.20 }))`);

  /* ① ② */
  const rows = [];
  for (let n = 1; n <= 6; n++) for (const f of [0, 0.5, 0.95]) {
    const r = await page.eval(`window.__yp({ seed: ${SEED}, leaves: ${plain(n)}, nextLeaf01: ${f}, potD: ${POT}, ageDays: ${n * 20} })`);
    rows.push({ n, f, r });
  }
  const bad1 = rows.filter(x => !x.r || x.r.leafCount !== x.n || x.r.births.length !== x.n || x.r.dropped.join() !== 'pot' || Math.abs(x.r.minY) > 0.02 * Math.max(x.r.h, 0.01));
  ok(bad1.length === 0, `① 잎 N 장 = 그린 잎 N 장 · 화분만 걷힘 · 밑동 y≈0 — 18판 중 어긋남 ${bad1.length}` +
    (bad1.length ? ' ' + JSON.stringify(bad1.slice(0, 3).map(x => ({ n: x.n, f: x.f, got: x.r && x.r.leafCount, dropped: x.r && x.r.dropped, minY: x.r && +x.r.minY.toFixed(4) }))) : ''));
  console.log('   N  다음잎  생장일  나이     높이[m]   지름[m]  밑동y');
  for (const x of rows) if (x.r) console.log(`   ${x.n}  ${String(x.f).padEnd(5)} ${String(x.r.days).padStart(5)}  ${x.r.ageG.toFixed(1).padStart(6)}  ${x.r.h.toFixed(4)}   ${x.r.d.toFixed(4)}  ${x.r.minY.toFixed(4)}`);
  const at = (n, f) => rows.find(x => x.n === n && x.f === f).r;
  let shrink = 0;
  for (let n = 1; n < 6; n++) if (at(n + 1, 0).h < at(n, 0).h - 1e-6) shrink++;
  for (let n = 1; n <= 6; n++) if (at(n, 0.95).h < at(n, 0).h - 1e-6) shrink++;
  ok(shrink === 0, `② 잎이 늘어도 · 다음 잎까지 몫이 늘어도 그루 높이가 안 줄어든다 — 줄어든 곳 ${shrink}`);

  /* ③ */
  const a = await page.eval(`window.__yp({ seed: ${SEED}, leaves: ${plain(4)}, nextLeaf01: 0.3, potD: ${POT} })`);
  const b = await page.eval(`window.__yp({ seed: ${SEED}, leaves: ${plain(4)}, nextLeaf01: 0.3, potD: ${POT} })`);
  const c = await page.eval(`window.__yp({ seed: ${SEED + 1}, leaves: ${plain(4)}, nextLeaf01: 0.3, potD: ${POT} })`);
  ok(a.hash.h === b.hash.h && a.hash.n === b.hash.n && c.hash.h !== a.hash.h, `③ 같은 값 = 같은 꼴(${a.hash.h}) · 씨앗이 다르면 다른 꼴(${c.hash.h})`);

  /* ④ 무늬 — 무늬 그림이 도착할 때까지 기다렸다 다시 짓는다 */
  const VL = JSON.stringify([{ varie: false }, { varie: true, grade: 'sanban', midSkin: 'leaf_mid_albo29' }, { varie: true, grade: 'halfmoon', midSkin: 'leaf_mid_albo30' }, { varie: false }]);
  let v = await page.eval(`window.__yp({ seed: ${SEED}, leaves: ${VL}, nextLeaf01: 0.6, potD: ${POT} })`);
  for (let i = 0; i < 100 && v.pending; i++) { await new Promise(r => setTimeout(r, 300)); v = await page.eval(`window.__yp({ seed: ${SEED}, leaves: ${VL}, nextLeaf01: 0.6, potD: ${POT} })`); }
  const byLb = Object.fromEntries(v.skins.map(s => [s.lb, s.key]));
  const k = v.births.map(lb => byLb[lb] || null);
  const albo = s => /albo/.test(s || '');
  ok(!albo(k[0]) && albo(k[1]) && albo(k[2]) && !albo(k[3]) && v.varieKeys.length > 0,
    `④ 정본이 준 잎만 무늬 — 잎별 그림 ${JSON.stringify(k)} · 무늬 열쇠 ${JSON.stringify(v.varieKeys)}`);
  ok(/albo29$/.test(k[1] || '') || /albo/.test(k[1] || ''), `④ 잎2 는 준 그림(leaf_mid_albo29) 쪽 — ${k[1]}(어린 단계면 leaf_young_albo 가 맞다)`);

  /* ⑤ */
  const nulls = await page.eval(`JSON.stringify([
    window.__asm.youngPlantOf({ seed: 1, leaves: [], potD: 0.09 }),
    window.__asm.youngPlantOf({ seed: 1, leaves: ${plain(2)}, species: 'pink_princess', potD: 0.09 }),
    window.__asm.youngPlantOf({ seed: 1, leaves: ${plain(2)}, species: 'alocasia_frydek', potD: 0.09 }),
    window.__asm.youngPlantOf({ seed: 1, leaves: ${plain(400)}, potD: 0.09 }) ].map(x => x === null))`);
  ok(nulls === '[true,true,true,true]', `⑤ 잎 0 · PP · AL(그리개 아직 없음) · 400장 → null ${nulls}`);

  /* ⑥ */
  const wp = await page.eval(`window.__yp({ seed: ${SEED}, leaves: ${plain(3)}, potD: ${POT}, withPot: true })`);
  ok(wp && wp.dropped.length === 0 && wp.given === false && at(3, 0).given === true, `⑥ withPot 이면 화분이 남는다(걷음 ${JSON.stringify(wp && wp.dropped)}) · nextLeaf01 안 주면 given=false`);

  /* ⑦ 뒤 — 모주가 그대로인가 */
  const motherAfter = await page.eval(`window.__hash(window.__asm.assemble({ growthDays: 200, seed: 92158, potD: 0.20 }))`);
  ok(motherAfter.h === motherBefore.h && motherAfter.n === motherBefore.n, `⑦ 작은 그루를 수십 번 지은 뒤에도 모주 조립이 같다 — ${motherBefore.h} → ${motherAfter.h}`);

  /* ⑨ 들고 온 잎은 다 큰 잎 · 새 잎만 순에서 펼쳐짐 */
  { const keyOf = r => { const m = Object.fromEntries(r.skins.map(x => [x.lb, x.key])); return r.births.map(lb => m[lb] ?? null); };
    const c1 = await page.eval(`window.__yp({ seed: ${SEED}, leaves: ${plain(1)}, nextLeaf01: 0, potD: ${POT} })`);
    const c3 = await page.eval(`window.__yp({ seed: ${SEED}, leaves: ${plain(3)}, nextLeaf01: 0, potD: ${POT}, grewLeaves: 0 })`);
    ok(c1.leafCount === 1 && c1.spear === 0 && c1.carried === 1 && /^leaf_mid/.test(keyOf(c1)[0] || ''),
      `⑨ 잎 1장(들고 온 잎) · 다음 잎 몫 0 — 말린 순이 아니라 펼쳐진 중간잎(${keyOf(c1)[0]}) · 순 ${c1.spear}`);
    ok(c3.leafCount === 3 && c3.spear === 0 && keyOf(c3).every(k => /^leaf_mid/.test(k || '')),
      `⑨ 잎 3장 다 들고 온 잎 — 셋 다 중간잎 ${JSON.stringify(keyOf(c3))}`);
    const g0 = await page.eval(`window.__yp({ seed: ${SEED}, leaves: ${plain(2)}, nextLeaf01: 0, potD: ${POT}, grewLeaves: 1 })`);
    const g9 = await page.eval(`window.__yp({ seed: ${SEED}, leaves: ${plain(2)}, nextLeaf01: 0.97, potD: ${POT}, grewLeaves: 1 })`);
    ok(g0.leafCount === 2 && g0.spear === 0 && keyOf(g0)[1] !== null,
      `⑨ 흙에서 낸 잎(2번째) · 몫 0 — 그날 막 펼쳐짐(${keyOf(g0)[1]}) · 순 ${g0.spear}`);
    ok(g9.leafCount === 2 && g9.spear === 1,
      `⑨ 몫 0.97 — 다음 잎(3번째)만 말린 순으로 보인다(잎 ${g9.leafCount} · 순 ${g9.spear}) · 장부 잎 수와 그림 잎 수는 같다`); }

  /* ⑩ D55 — youngPlantSizeOf(같은 인자) = 그린 그루의 sizeM · 두 번째는 기억해 둔 값 · null 은 null */
  { const r = await page.eval(`(() => { const A = window.__asm;
      const o = { seed: ${SEED}, leaves: Array.from({ length: 4 }, () => ({ varie: false })), nextLeaf01: 0.3, potD: 0.12, grewLeaves: 3 };
      const s1 = A.youngPlantSizeOf(o), g = A.youngPlantOf(o), s2 = A.youngPlantSizeOf(o);
      return { s1, drawn: g.userData.sizeM, cached: s1 === s2, nul: A.youngPlantSizeOf({ seed: 1, leaves: [], potD: 0.12 }) }; })()`);
    ok(r.s1 && Math.abs(r.s1.d - r.drawn.d) < 1e-9 && Math.abs(r.s1.h - r.drawn.h) < 1e-9 && r.s1.leafCount === 4 && r.cached && r.nul === null,
      `⑩ D55 크기만 묻기 — 폭 ${r.s1 && r.s1.d.toFixed(3)}m · 키 ${r.s1 && r.s1.h.toFixed(3)}m = 그린 그루 · 두 번째는 기억한 값 ${r.cached} · 잎 0 → null`); }

  /* ⑧ 사진 — 잎 1~6 을 나란히 */
  const shot = path.join(ROOT, 'docs/handoff/img/young_plant_row.png');
  await page.eval(`(() => {
    plantGroup.visible = false;
    /* 원본 페이지의 조절판이 화면을 덮는다 — 캔버스를 품지 않은 것은 다 가린다 */
    const cv = renderer.domElement;
    for (const el of document.body.querySelectorAll('*')) if (el !== cv && !el.contains(cv) && el.parentElement && (el.parentElement === document.body || el.parentElement.contains(cv))) el.style.visibility = 'hidden';
    const row = new THREE.Group(); row.name = '__ypRow';
    for (let n = 1; n <= 6; n++) {
      const g = window.__asm.youngPlantOf({ seed: ${SEED}, leaves: Array.from({ length: n }, (_, i) => ({ varie: i === 1 || i === 2, midSkin: i === 1 ? 'leaf_mid_albo29' : 'leaf_mid_albo30' })), nextLeaf01: 0.6, potD: 0.30 });
      g.position.x = (n - 3.5) * 0.42; row.add(g);
    }
    scene.add(row);
    /* 원본 페이지의 직교 카메라(cam · orbit)를 줄 하나에 맞춘다 — fitCam 과 같은 손(그 함수는 plantGroup 만 본다) */
    const bb = new THREE.Box3().setFromObject(row), c = bb.getCenter(new THREE.Vector3()), s = bb.getSize(new THREE.Vector3());
    const a = innerWidth / innerHeight, F = Math.max(s.y * 0.62, s.x / (2 * a) * 1.08);
    orbit.tx = c.x; orbit.ty = c.y; orbit.tz = c.z; orbit.az = 0; orbit.el = 0.22; orbit.zoom = 1;
    cam.left = -F * a; cam.right = F * a; cam.top = F; cam.bottom = -F;
    updateCam(); renderer.render(scene, cam); return true; })()`);
  await new Promise(r => setTimeout(r, 1500));
  await page.shot(shot);
  const cc = colorCount(shot);
  ok(cc > 800, `⑧ 사진 ${path.relative(ROOT, shot)} — 색 ${cc}가지(까만 사진이면 수십)`);
  ok(errs.length === 0, `페이지 예외 ${errs.length}${errs.length ? ' — ' + errs.slice(0, 2).join(' · ') : ''}`);
} finally { await page.close(); clearTimeout(_wd); }
console.log('\nyoung_plant: ' + (fail ? 'FAIL' : 'PASS'));
process.exitCode = fail ? 1 : 0;
