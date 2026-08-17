/* ============================================================
   test_furn_size.mjs — **상판이 0.25 격자 눈금에 떨어지나** (2026-08-17)
   ------------------------------------------------------------
   ⚠ **크기의 정본이 갈리는지는 여기서 안 본다.** `tools/test_furnishop.mjs §A` 가
     이미 117개를 빌더로 다시 지어 `size_m` 과 대조한다 — 두 벌로 만들지 않는다.
     이 파일이 보는 것은 **오직 하나**다:

       상판이 쓰이는 가구의 가로·깊이가 **0.25 의 배수인가**

   ── 왜 그게 걸린 문제였나 ────────────────────────────────────
   격자가 두 벌이다. 바닥 격자는 **방 원점**에, 상판 칸은 **그 상판 한가운데**에
   물려 있다(`room_view §surfaceAxis`). 그 칸의 크기는 이렇게 난다:

       n  = round(면 길이 / 0.25)      // 칸 수
       칸 = 면 길이 / n                 // ⇒ 면 길이가 0.25 배수가 아니면 칸도 0.25 가 아니다

   원형 테이블(0.80)이면 칸이 **0.2667**, 식탁(1.20×0.70)이면 **0.24×0.2333** 이었다.
   2026-08-17 에 박사님 말씀(*"0.25 격자 그리드에 맞춰서 안 벗어나게"*)으로 **36개**를
   `round(길이/0.25)×0.25` 로 물렸다 — **칸 수는 한 개도 안 바꾸는 반올림**이다.

   ⚠ **크기만으로는 두 격자가 안 합쳐진다.** 앞 모서리가 0.125 의 홀수배(바닥 칸 경계)에
     앉아야 완성된다. 반지하 책상이 그 증거다 — 1.25×0.50 인데도 상판 칸이 바닥 격자에서
     0.05 밀려 있다(`lightview-to-plan §8.1`). 자리 맞추기는 **아직 안 한 일**이다
     (`furngrid-to-plan §6`).

     node tools/test_furn_size.mjs
============================================================ */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const toUrl = (rel) => 'file:///' + path.join(ROOT, rel).replace(/\\/g, '/');
const GRID = 0.25;                  // place.GRID_CELL — 바닥 격자와 상판 칸이 함께 쓰는 눈금

/* ★ 아직 0.25 에 못 물린 상판 — **줄기만 하고 늘지는 않아야 한다.** 까닭은 셋뿐이다:
     ① 창턱 받침 둘 — 얼린 조도표와 창 개구부에 묶여 있다. 깊이 0.30 → 0.25 는 반지하
        창턱 등1 을 6.02 에서 문턱 6.0 아래로 떨어뜨린다(nightstand-to-plan §B-2 ·
        test_lampaim ①-b 가 *"값을 맞추지 말고 창턱을 도로 덜 밀어야 한다"* 로 계약해 두었다).
        원룸 것은 자리가 4칸이라 가로를 바꾸면 네 자리가 다 옮겨간다
     ② **판때기가 가구 크기와 다른 것** — 슬롯이 앉는 판이 겉치수보다 작거나(책장 안단 0.73 ·
        낮은 책장 0.93 · 온실장 0.64 · 커피테이블 아래단 0.79) 단마다 다르다(사다리 선반
        0.30/0.25/0.20/0.15 · 계단식 플랜트대 0.30). JSON 만 고쳐서는 안 물린다 —
        **빌더 기하를 고쳐야 한다**
     ③ 협탁 셋 — 깊이 0.36 → 0.25 면 한도가 0.33 → 0.22 로 내려 **네모 화분(0.2755)이
        올라가는 자리가 5 → 4칸**이 된다(test_pots C-1 이 5칸을 못 박았고, 주석이 그 5칸의
        까닭으로 바로 협탁의 0.33 을 든다). 0.50 으로 올리면 반지하 제자리(z −1.675)에서
        **뒷벽 안쪽 면(−1.9)을 0.025 뚫는다.** 어느 쪽도 공짜가 아니라 박사님 판단으로 남겼다 */
const NOT_YET = new Set([
  'shelf_sill_pot1', 'shelf_sill_pot4',                                          // ①
  'shelf', 'shelf_low', 'shelf_white', 'shelf_walnut', 'shelf_ladder_4tier',      // ②
  'plant_step_3', 'plant_grid_wall', 'plant_hanger', 'greenhouse_cabinet',
  'lectern', 'coffee_table', 'coffee_table_walnut', 'coffee_table_white',
  /* ★ 2026-08-17 — **협탁 셋이 목록에서 빠졌다.** 박사님이 *"협탁 크기가 애매해,
     할 거면 2*2 크기로 해서 주던지 해"* 라고 정하셔서 0.42×0.36 → **0.50×0.50**(2×2 칸)이 됐다.
     ⚠ 그때 못 물린 까닭은 「내리면 네모 화분 자리가 5→4칸, 올리면 뒷벽을 뚫는다」였는데,
       박사님이 **올리는 쪽**을 고르셨고 반지하 자리도 같이 옮겨 벽을 안 뚫는다
       (`house_rooms.banjiha-nightstand` 의 주석에 잰 값이 있다). */
]);

/* ── 스텁 DOM (three 가 캔버스를 만든다 · gen_room_profile.mjs 와 같은 것) ── */
const stubCtx = () => new Proxy({}, { get: (t, k) => {
  if (k === 'createImageData' || k === 'getImageData')
    return (w = 1, h = 1) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h });
  if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop() {} });
  if (k === 'measureText') return () => ({ width: 0 });
  return () => {};
} });
const stubEl = () => ({ style: {}, dataset: {}, appendChild() {}, setAttribute() {},
                        addEventListener() {}, getContext: () => stubCtx() });
globalThis.document = {
  createElement: (t) => (t === 'canvas'
    ? { width: 1, height: 1, style: {}, getContext: () => stubCtx(), toDataURL: () => '' } : stubEl()),
  createElementNS: () => stubEl(), addEventListener() {}, getElementById: () => null,
  querySelector: () => null, querySelectorAll: () => [], body: stubEl(), documentElement: stubEl()
};
globalThis.window = globalThis;
globalThis.self = globalThis;
const realError = console.error, realWarn = console.warn;
console.error = () => {}; console.warn = () => {};
vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'vendor', 'three', 'three.min.js'), 'utf8'));
const { buildFurniture } = await import(toUrl('src/render3d/furniture_pastel.js'));
console.error = realError; console.warn = realWarn;

const PRESETS = JSON.parse(fs.readFileSync(
  path.join(ROOT, 'data', 'furniture_presets.json'), 'utf8')).presets;

let pass = 0, fail = 0;
const ok = (label, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? '\n      → ' + extra : ''}`); }
};

/* 「상판이 쓰이는 가구」의 판정 근거 — **이름이 아니라 `userData.slots` 다.**
   방 데이터에는 슬롯이 없다. `house.js:928` 이 조립할 때 가구가 든 slots 를 모아
   `slotId = uid + ':' + i` 를 만든다. 그러니 슬롯을 붙이는 빌더가 곧 상판 가구다.
   ⇒ 방에 아직 안 놓인 것까지 잡힌다 — 가구 상점이 열렸으므로 그것이 맞는 자다. */
const tops = new Map();
for (const [id, p] of Object.entries(PRESETS)) {
  const w0 = console.warn; console.warn = () => {};
  let g = null; try { g = buildFurniture(p.type || id, { ...p }); } catch { g = null; }
  console.warn = w0;
  const ud = (g && g.userData) || {};
  if (Array.isArray(ud.slots) && ud.slots.length) tops.set(id, ud.size || {});
}

console.log('\n상판이 0.25 격자에 떨어지나 — data/furniture_presets.json\n');

const on = v => Number.isFinite(v) && Math.abs(v / GRID - Math.round(v / GRID)) < 1e-6;
const off = [...tops.keys()].filter(id => !(on(tops.get(id).w) && on(tops.get(id).d)));

console.log(`  상판이 쓰이는 가구 ${tops.size}개 (전체 ${Object.keys(PRESETS).length}개 중) · ` +
            `0.25 에 물린 것 ${tops.size - off.length}개 · 아직 아닌 것 ${off.length}개\n`);

ok('★ 0.25 격자에 안 물린 상판 가구는 NOT_YET 에 적힌 것뿐이다',
   off.every(id => NOT_YET.has(id)),
   off.filter(id => !NOT_YET.has(id))
      .map(id => `${id} ${tops.get(id).w}×${tops.get(id).d}`).join(' · '));

ok('NOT_YET 에 적어 놓고 이미 고쳐진 것이 없다 (목록이 낡으면 지워라)',
   [...NOT_YET].every(id => !tops.has(id) || off.includes(id)),
   [...NOT_YET].filter(id => tops.has(id) && !off.includes(id)).join(', '));

ok('NOT_YET 에 상판 가구가 아닌 이름이 섞여 있지 않다',
   [...NOT_YET].every(id => tops.has(id)),
   [...NOT_YET].filter(id => !tops.has(id)).join(', '));

/* 물린 것은 **칸 수가 셈한 수와 같아야** 한다 — 길이/0.25 가 정수라는 말과 같지만,
   여기서 한 번 더 세는 까닭은 반올림 규칙이 「칸 수를 안 바꾼다」였기 때문이다. */
{
  const bad = [...tops.entries()].filter(([id, s]) => !off.includes(id))
    .filter(([, s]) => Math.abs(s.w / GRID - Math.round(s.w / GRID)) > 1e-6 ||
                       Math.abs(s.d / GRID - Math.round(s.d / GRID)) > 1e-6);
  ok(`물린 ${tops.size - off.length}개는 칸 한 변이 정확히 0.25 다`, bad.length === 0,
     bad.map(([id]) => id).join(', '));
}

console.log('\n  아직 아닌 것:');
for (const id of off)
  console.log(`   · ${id.padEnd(28)}${tops.get(id).w}×${tops.get(id).d}` +
              `  (칸 ${Math.round(tops.get(id).w / GRID)}×${Math.round(tops.get(id).d / GRID)})`);

console.log(fail ? `\nfurn_size: FAIL (${fail}건 · ${pass}통과)` : `\nfurn_size: PASS (${pass}건)`);
process.exit(fail ? 1 : 0);
