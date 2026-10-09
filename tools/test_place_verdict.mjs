/* ============================================================
   tools/test_place_verdict.mjs — 놓을 때 «빛» 한 줄의 갈래(light_adapter placeVerdict) ([house] · 2026-10-09 · 총괄 D39 C)
   ------------------------------------------------------------
     node tools/test_place_verdict.mjs        (헤드리스 · 크롬 안 씀)
   잰 닻(house-decor-20261009 §C · meshy-plan §바로잡음 4)과 갈래가 맞나:
     원룸 창 가운데 앞 · 벽에서 0.2m · 0.80m → B (여름 등0 자람 · 겨울 등0 못 · 겨울 등 다 켜면 자람)
     같은 자리 0.62m → Bp(겨울엔 등을 다 켜도 모자람)  ·  벽에서 0.45m · 0.80m → C(등이 있어야)
     원룸 바닥 → D  ·  반지하 창턱 → grow  ·  반지하 책상 → none
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
}
{ const { e, r } = engOf('banjiha');
  const sill = r.slots.find(s => /sill/.test(s.slotId)), desk = r.slots.find(s => /desk/.test(s.slotId));
  const a = e.placeVerdict([sill], { novice: true });
  ok('반지하 창턱 → grow', a.key === 'grow', JSON.stringify(a));
  const b = e.placeVerdict([desk], { novice: true });
  ok('반지하 책상 → none(등 셋을 다 켜도)', b.key === 'none', JSON.stringify(b));
}
console.log(`\nplace_verdict: ${fail ? 'FAIL' : 'PASS'} (${pass}/${pass + fail})`);
process.exit(fail ? 1 : 0);
