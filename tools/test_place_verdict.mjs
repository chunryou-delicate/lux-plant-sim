/* ============================================================
   tools/test_place_verdict.mjs — 놓을 때 «빛» 한 줄의 갈래(light_adapter placeVerdict) ([house] · 2026-10-09 · 총괄 D39 C)
   ------------------------------------------------------------
     node tools/test_place_verdict.mjs        (헤드리스 · 크롬 안 씀)
   잰 닻(house-decor-20261009 §C · meshy-plan §바로잡음 4)과 갈래가 맞나:
     원룸 창 가운데 앞 · 벽에서 0.2m · 0.80m → B (여름 등0 자람 · 겨울 등0 못 · 겨울 등 다 켜면 자람)
     같은 자리 0.62m → Bp(겨울엔 등을 다 켜도 모자람)  ·  벽에서 0.45m · 0.80m → C(등이 있어야)
     원룸 바닥 → D  ·  반지하 창턱 → grow  ·  반지하 책상 → none
     «조금만 더 높으면»(higher) · 문턱은 놓는 것으로(D57: 화분 그루 = growthMin · 무늬 삽수만 ×1.4)
     · «맨 윗단에 집게등을 물리면»(clipTop · 원룸만 · 못 넘는 자리 · D57 이 D53 을 바로잡음 · atTop: 이미 맨 윗단이면 «맨 윗단에 두고» 대신 «여기에»)
   글은 plan(PLACE_LIGHT_KO 후보 · house-decor §C) · 띄우기는 core. 이 검사는 «갈래»만 본다.
============================================================ */
import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataOf = r => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', r), 'utf8'));
const sc = () => new Proxy({}, { get: (t, k) => {
  if (k === 'createImageData' || k === 'getImageData') return (w = 1, h = 1) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h });
  if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop() {} });
  if (k === 'measureText') return () => ({ width: 0 }); return () => {}; } });
const se = () => ({ style: {}, dataset: {}, appendChild() {}, setAttribute() {}, getContext: () => sc(), width: 0, height: 0 });
globalThis.document = { createElement: se, body: se(), getElementById: () => se() }; globalThis.window = globalThis; globalThis.self = globalThis;
const _w = console.warn; console.warn = () => {};
vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'vendor/three/three.min.js'), 'utf8'));
const { createLightEngine } = await import(pathToFileURL(path.join(ROOT, 'src/game/light_adapter.js')).href);
console.warn = _w;
const D = { winPresets: dataOf('window_presets.json').presets, doorPresets: dataOf('door_presets.json').presets, finishes: dataOf('room_finishes.json'),
  furnPresets: dataOf('furniture_presets.json').presets, lightPresets: dataOf('lighting_presets.json'), shadePresets: dataOf('shading_presets.json'),
  lightTh: dataOf('balance/light_thresholds.json'), weatherBalance: dataOf('balance/weather.json') };
let pass = 0, fail = 0;
const ok = (label, cond, extra = '') => { if (cond) { pass++; console.log(`  ✔ ${label}`); } else { fail++; console.log(`  ✘ ${label}${extra ? ' — ' + extra : ''}`); } };
const engOf = id => { console.warn = () => {}; const e = createLightEngine({ houseRooms: dataOf('house_rooms.json'), ...D }); const r = e.build(id); console.warn = _w; return { e, r }; };

{ const { e } = engOf('oneroom');
  const v1 = e.placeVerdict([{ x: 0.5, y: 0.80, z: -2.30 }]);
  ok('원룸 창에 바짝 0.80m → B', v1.key === 'B', JSON.stringify(v1));
  const v2 = e.placeVerdict([{ x: 0.5, y: 0.62, z: -2.30 }]);
  ok('원룸 창에 바짝 0.62m → Bp(겨울엔 다 켜도 모자람)', v2.key === 'Bp', JSON.stringify(v2));
  const v3 = e.placeVerdict([{ x: 0.5, y: 0.80, z: -2.05 }]);
  ok('원룸 벽에서 0.45m 0.80m → C', v3.key === 'C', JSON.stringify(v3));
  const v4 = e.placeVerdict([{ x: -1.5, y: 0.10, z: 1.0 }]);
  ok('원룸 바닥 → D', v4.key === 'D', JSON.stringify(v4));
  const v5 = e.placeVerdict([{ x: -1.5, y: 0.10, z: 1.0 }, { x: 0.5, y: 0.80, z: -2.30 }]);
  ok('자리 여럿이면 가장 밝은 자리로 → B', v5.key === 'B', JSON.stringify(v5));
  ok('빈 자리 → null', e.placeVerdict([]) === null);
  /* «조금만 더 높으면» — 창 아랫변보다 낮은 자리만 · 15% 넘게 밝아질 때만 */
  const h1 = e.placeVerdict([{ x: 0.8, y: 0.595, z: -2.25 }]);
  ok('계단식 맨 윗단 꼴(0.595m · 창 앞) → higher 를 낸다(아랫변 0.795m 쯤 · 더 밝다)', !!h1.higher && h1.higher.y > 0.7 && h1.higher.s0 >= h1.values.s0 * 1.15, JSON.stringify(h1.higher));
  const h2 = e.placeVerdict([{ x: 0.5, y: 0.80, z: -2.30 }]);
  ok('이미 아랫변 높이(0.80m) → higher 없음', h2.higher === null, JSON.stringify(h2.higher));
  const h3 = e.placeVerdict([{ x: -2.5, y: 0.5, z: 1.5 }]);
  ok('창 폭 밖 → higher 없음', h3.higher === null, JSON.stringify(h3.higher));
  /* D58 — 삽수: 기댓값으로는 못 넘는데 맑은 날 값으로는 넘는 자리 → clearDayOnly(«맑은 날에만 조금씩 자라요» 결) · 화분 그루는 안 냄 */
  const q = e.placeVerdict([{ x: 0.5, y: 0.62, z: -2.30 }], { variegated: true, kind: 'cutting' });
  const qm = e.placeVerdict([{ x: 0.5, y: 0.62, z: -2.30 }], { variegated: true });
  ok(`무늬 삽수 창 앞 0.62m → ${q.key}(여름 기댓값 ${q.values.s0} < ${q.th}) · 맑은 날 ${q.clearDayOnly && q.clearDayOnly.clear} 이면 넘음 → clearDayOnly`,
    q.key === 'C' && !!q.clearDayOnly && q.clearDayOnly.season === 'summer' && q.clearDayOnly.lamps === 0 && q.clearDayOnly.clear >= q.th && q.clearDayOnly.expected < q.th, JSON.stringify(q));
  ok(`같은 자리 무늬 모주(화분) → ${qm.key} · clearDayOnly 없음(그루는 7일 평균)`, qm.clearDayOnly === null, JSON.stringify(qm.clearDayOnly));
  const q0 = e.placeVerdict([{ x: -1.5, y: 0.10, z: 1.0 }], { variegated: true, kind: 'cutting' });
  ok('무늬 삽수 원룸 바닥 → 맑은 날에도 못 넘음 → clearDayOnly 없음', q0.key === 'D' && q0.clearDayOnly === null, JSON.stringify(q0.clearDayOnly));
}
/* 무늬(×1.4) — 원룸 + 기준 배치 D(에타제르 0.5,−1.55) · 총괄 10-09 (leaf D41: 가운데단 무늬 삽수 120일 정체) */
{ const H = dataOf('house_rooms.json'); const R = H.rooms.oneroom; R.furniture = [...R.furniture, ...R.reference_layout.furniture];
  console.warn = () => {}; const e = createLightEngine({ houseRooms: H, ...D }); const r = e.build('oneroom'); console.warn = _w;
  const eta = r.slots.filter(s => /banjiha-etagere/.test(s.slotId)).map(s => ({ x: s.x, y: s.y, z: s.z, occIdx: s.occIdx }));
  /* ★ 총괄 D57 — 문턱은 «놓는 것»으로: 화분 그루는 무늬여도 growthMin(2.7) · 무늬 삽수만 × need_mult(core §cuttingLightOf → bandOf) */
  const vN = e.placeVerdict(eta), vM = e.placeVerdict(eta, { variegated: true }), vV = e.placeVerdict(eta, { variegated: true, kind: 'cutting' });
  ok(`무늬 모주는 문턱 그대로(${vN.th} = ${vM.th}) · 무늬 삽수만 1.4배(${vV.th})`, vM.th === vN.th && Math.abs(vV.th - vN.th * 1.4) < 0.01, JSON.stringify([vN.th, vM.th, vV.th]));
  ok('무늬 삽수 에타제르 → 맨 윗단에 집게등을 물리면 넘는다(clipTop · 여름 ≥ 삽수 문턱)', !!vV.clipTop && vV.clipTop.s >= vV.th, JSON.stringify(vV.clipTop));
  ok('원룸은 무늬 아니어도 못 넘는 자리면 clipTop(D53 · 에타제르 C)', vN.key === 'C' && !!vN.clipTop && vN.clipTop.s >= vN.th, JSON.stringify({ key: vN.key, clipTop: vN.clipTop }));
  console.log('    무늬 삽수 에타제르:', JSON.stringify({ key: vV.key, values: vV.values, clipTop: vV.clipTop }));
  /* 화분 한 점(가운데단)을 가르되 집게등 꼬리는 그 가구 맨 윗단으로(topOf) */
  const ys = [...new Set(eta.map(p => +p.y.toFixed(3)))].sort((a, b) => a - b), mid = eta.filter(p => +p.y.toFixed(3) === ys[1]);
  const vm = e.placeVerdict(mid, { variegated: true, kind: 'cutting', topOf: eta });
  ok('무늬 삽수를 가운데단에 → 그 점은 못 넘고(C/D) · 꼬리는 맨 윗단 높이로', ['C', 'D'].includes(vm.key) && !!vm.clipTop && Math.abs(vm.clipTop.y - ys[ys.length - 1]) < 1e-3, JSON.stringify({ key: vm.key, values: vm.values, clipTop: vm.clipTop }));
  /* atTop — «맨 윗단에 두고»를 붙일지: 가구를 놓을 때(자리 전부)·가운데단 화분은 false · 맨 윗단 화분은 true */
  const topPts = eta.filter(p => +p.y.toFixed(3) === ys[ys.length - 1]);
  const vt = e.placeVerdict(topPts, { variegated: true, kind: 'cutting', topOf: eta });
  ok('atTop — 가구 자리 전부·가운데단이면 false · 맨 윗단에 놓은 화분이면 true', vV.clipTop?.atTop === false && vm.clipTop?.atTop === false && (vt.clipTop === null || vt.clipTop.atTop === true), JSON.stringify([vV.clipTop?.atTop, vm.clipTop?.atTop, vt.clipTop]));
  /* D57 칸 — leaf 잰 것: 원룸 에타제르 윗단 · 등 2 켠 판 · 맑은 여름 3.3~3.6 → 무늬 삽수는 «정체»(민무늬는 «느림»)
       ⚠ 자가 둘이다: leaf 3.3 은 **맑은 날 값**이고, 원룸 갈래는 **날씨 기댓값**(자연광 × weatherE 여름 0.643 + 등)으로 가른다.
         맑은 날(초보 판 셈 = 자연광 그대로 + 등)로는 3.45 — 화분 그루 2.7 은 넘고 삽수 3.78 은 못 넘는다(leaf 와 같다).
         기댓값으로는 2.51 — 그루도 못 넘는다(D). 그래서 원룸 갈래는 그루·삽수 둘 다 D 이고, 삽수만 집게(맨 윗단)로 넘는다고 보이면 된다 */
  const t2 = e.placeVerdict(topPts, { variegated: true, kind: 'cutting', lamps: 2, topOf: eta });
  const t2m = e.placeVerdict(topPts, { lamps: 2, topOf: eta });
  const c2 = e.placeVerdict(topPts, { novice: true, lamps: 2 }), c2c = e.placeVerdict(topPts, { novice: true, lamps: 2, variegated: true, kind: 'cutting' });
  ok(`맑은 여름 · 에타제르 윗단 · 등 2 = ${c2.values.vN}(leaf 3.3~3.6) → 그루 ${c2.key} · 무늬 삽수 ${c2c.key}`,
    c2.values.vN >= 3.3 && c2.values.vN <= 3.6 && c2.key === 'lamp' && c2c.key === 'none', JSON.stringify([c2.values, c2.key, c2c.key]));
  ok(`원룸 갈래(기댓값 ${t2.values.sN}) · 무늬 삽수 · 등 2 → D · clipTop(맨 윗단 집게 여름 ${t2.clipTop && t2.clipTop.s} ≥ ${t2.th})`,
    t2.key === 'D' && !!t2.clipTop && t2.clipTop.s >= t2.th && t2.clipTop.atTop === true && t2m.key === 'D',
    JSON.stringify({ cutting: { key: t2.key, values: t2.values, clipTop: t2.clipTop }, mother: { key: t2m.key, values: t2m.values } }));
  ok('leaf 자리(윗단 · 등 2)는 맑은 날 값으로도 삽수 문턱 아래 → clearDayOnly 없음(정체 그대로)', t2.clearDayOnly === null && t2m.clearDayOnly === null, JSON.stringify([t2.clearDayOnly, t2m.clearDayOnly]));
  let threw = false; try { e.placeVerdict(topPts, { kind: 'leaf' }); } catch { threw = true; }
  ok('kind 는 mother·cutting 둘만(모르는 낱말은 던진다)', threw);
}
{ const { e, r } = engOf('banjiha');
  const sill = r.slots.find(s => /sill/.test(s.slotId)), desk = r.slots.find(s => /desk/.test(s.slotId));
  const a = e.placeVerdict([sill], { novice: true });
  ok('반지하 창턱 → grow', a.key === 'grow', JSON.stringify(a));
  const b = e.placeVerdict([desk], { novice: true });
  ok('반지하 책상 → none(등 셋을 다 켜도)', b.key === 'none', JSON.stringify(b));
  /* D57 칸 — 무늬 모주 반지하 창턱: 등 없이 3.68 ≥ growthMin 2.7 → 자람(무늬 말 없음 · plan e6421e0d) */
  const av = e.placeVerdict([sill], { novice: true, variegated: true });
  ok(`반지하 무늬 모주 창턱(${av.values.v0}) → grow · 꼬리 없음(D57)`, av.key === 'grow' && av.th === a.th && av.clipTop === null, JSON.stringify(av));
  const avc = e.placeVerdict([sill], { novice: true, variegated: true, kind: 'cutting' });
  ok(`반지하 무늬 삽수 창턱 → lamp(등 없이 ${avc.values.v0} < ${avc.th} · 등 켜면 ${avc.values.vN})`, avc.key === 'lamp', JSON.stringify(avc));
  const etaB = r.slots.filter(s => /etagere/.test(s.slotId)).map(s => ({ x: s.x, y: s.y, z: s.z, occIdx: s.occIdx }));
  const vb = e.placeVerdict(etaB, { novice: true, variegated: true, kind: 'cutting' }), vb0 = e.placeVerdict(etaB, { novice: true });
  ok('반지하는 집게 꼬리를 아예 안 낸다(D57 · 무늬 삽수 에타제르 none 도 · 무늬 아닌 몬스테라도)', vb.key === 'none' && vb.clipTop === null && vb0.key === 'none' && vb0.clipTop === null, JSON.stringify([vb, vb0]));
}
console.log(`\nplace_verdict: ${fail ? 'FAIL' : 'PASS'} (${pass}/${pass + fail})`);
process.exit(fail ? 1 : 0);
