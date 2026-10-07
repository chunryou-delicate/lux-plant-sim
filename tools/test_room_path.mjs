/* ============================================================
   tools/test_room_path.mjs — **사람이 방 안을 걸어 다닐 수 있나** (house 소유 · 2026-10-08)
   ------------------------------------------------------------
     node tools/test_room_path.mjs
     SELFTEST=1 node tools/test_room_path.mjs     (대조 — 10-04 의 갇힌 배치를 얹는다 · 빨강이 나와야 이 자를 믿는다)

   ★ 왜 있나 — 2026-10-04 반지하 소품 넷을 가구로 넣을 때, 배낭(x −0.72)과 난방기 모서리가 문 앞 통로 세 칸을
     방에서 끊었다. 캐릭터가 처음 서는 자리(room_view §standSpot)가 바로 문 앞이라 첫 판이 Day 0 에서 갇혔다
     (probe_force5 제자리걸음 · 「jachwi 를 그 자리로 못 보냅니다 — 갈 수 없는 자리」).
     빛 표·검사 아홉이 다 초록이었는데 막혔다 — «길»을 재는 자가 없었다.
   ★ 재는 것 (room_view 와 «같은 자»로):
     ① 몸 반지름 BODY_R — room_view.js 소스에서 읽는다(박지 않는다 · 바뀌면 따라간다)
     ② 길 격자 — render3d/floor_nav.js 를 그대로 쓴다(0.25 칸 · 대각선은 양옆이 뚫렸을 때만)
     ③ 처음 서는 자리 — room_view §standSpot 셈을 옮겨 왔다(⚠ 그 함수가 바뀌면 여기도 고친다 — 아래 STAND_* 셋)
     ⇒ 판정: 서는 자리가 «가장 큰 덩어리»에 있고 · 문 앞 칸까지 길이 있다
   ★ 방마다 «방 그대로»와, 기준 배치(`reference_layout`)가 있으면 «얹은 판»도 잰다(원룸 D).
   ⚠ 놓인 화분·시루도 길을 막는다(room_view §navColliders) — 이 자는 «방 데이터»만 본다. 시루가 문 앞에 놓이면 막힐 수 있다.
============================================================ */
import assert from 'node:assert/strict';
import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataOf = r => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', r), 'utf8'));
const sc = () => new Proxy({}, { get: (t, k) => {
  if (k === 'createImageData' || k === 'getImageData') return (w = 1, h = 1) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h });
  if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop() {} });
  if (k === 'measureText') return () => ({ width: 0 });
  return () => {}; } });
const se = () => ({ style: {}, dataset: {}, appendChild() {}, setAttribute() {}, getContext: () => sc(), width: 0, height: 0 });
globalThis.document = { createElement: se, body: se(), getElementById: () => se() }; globalThis.window = globalThis; globalThis.self = globalThis;
const _warn = console.warn; console.warn = () => {};
vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'vendor/three/three.min.js'), 'utf8'));
const { createLightEngine } = await import(pathToFileURL(path.join(ROOT, 'src/game/light_adapter.js')).href);
const { createFloorNav } = await import(pathToFileURL(path.join(ROOT, 'src/render3d/floor_nav.js')).href);
console.warn = _warn;

/* ① 몸 반지름 — room_view 소스에서 읽는다 */
const RV = fs.readFileSync(path.join(ROOT, 'src/game/room_view.js'), 'utf8');
const m = RV.match(/const\s+BODY_R\s*=\s*([0-9.]+)/);
assert.ok(m, 'room_view.js 에서 BODY_R 를 못 찾았습니다 — 이름이 바뀌었으면 이 자를 고치십시오');
const BODY_R = +m[1];
/* ③ standSpot 셈 — room_view §standSpot 와 같은 수(⚠ 그쪽이 바뀌면 여기도) */
const STAND_STEP = 0.20, STAND_EDGE = 0.34, STAND_SLOT_MIN = 0.55;
assert.ok(/STEP = 0\.20, EDGE = 0\.34/.test(RV) && /dSlot < 0\.55/.test(RV),
  'room_view §standSpot 의 수가 바뀌었습니다 — 이 자의 STAND_* 를 맞추십시오');

const H0 = dataOf('house_rooms.json');
if (process.env.SELFTEST) {   /* 대조: 10-04 처음 자리(배낭 x −0.72) — 문 앞 통로가 끊겨야 한다 */
  const b = H0.rooms.banjiha.furniture.find(f => f.uid === 'banjiha-backpack');
  if (b) b.x = -0.72;
}
const D = { winPresets: dataOf('window_presets.json').presets, doorPresets: dataOf('door_presets.json').presets, finishes: dataOf('room_finishes.json'),
  furnPresets: dataOf('furniture_presets.json').presets, lightPresets: dataOf('lighting_presets.json'), shadePresets: dataOf('shading_presets.json'),
  lightTh: dataOf('balance/light_thresholds.json'), weatherBalance: dataOf('balance/weather.json') };

function measure(roomId, withRef) {
  const H = JSON.parse(JSON.stringify(H0)); const def = H.rooms[roomId];
  if (withRef) def.furniture = [...def.furniture, ...def.reference_layout.furniture];
  const _w = console.warn; console.warn = () => {};
  const eng = createLightEngine({ houseRooms: H, ...D }); const r = eng.build(roomId);
  console.warn = _w;
  const b = r.built, S = b.size, nav = createFloorNav({ colliders: b.colliders, size: S, radius: BODY_R });
  let wx = 0, wz = -S.d / 2; const win = (b.luxWins || []).filter(w => w.wall && w.wall !== 'ceiling');
  if (win.length) { let big = win[0], ar = 0; for (const w of win) { const a = (w.w || 0) * (w.h || 0); if (a > ar) { ar = a; big = w; } }
    if (big.wall === 'back') { wx = big.cu || 0; wz = -S.d / 2; } else if (big.wall === 'front') { wx = big.cu || 0; wz = S.d / 2; }
    else if (big.wall === 'left') { wx = -S.w / 2; wz = big.cu || 0; } else { wx = S.w / 2; wz = big.cu || 0; } }
  let st = null, bs = -Infinity;
  for (let x = -S.w / 2 + STAND_EDGE; x <= S.w / 2 - STAND_EDGE; x += STAND_STEP)
    for (let z = -S.d / 2 + STAND_EDGE; z <= S.d / 2 - STAND_EDGE; z += STAND_STEP) {
      if (nav.blocked(x, z, BODY_R)) continue;
      let dS = Infinity; for (const s of r.slots) dS = Math.min(dS, Math.hypot(s.x - x, s.z - z)); if (dS < STAND_SLOT_MIN) continue;
      const dW = Math.min(S.w / 2 - Math.abs(x), S.d / 2 - Math.abs(z));
      const sco = Math.min(dS, 2) + Math.min(Math.hypot(wx - x, wz - z), 3) * 0.55 - dW * 0.9;
      if (sco > bs) { bs = sco; st = { x, z }; } }
  /* ② 덩어리 — floor_nav.path 와 같은 이웃 규칙(대각선은 양옆이 뚫렸을 때만) */
  const n = Math.ceil(S.w / 0.25), mm = Math.ceil(S.d / 0.25), x0 = -S.w / 2, z0 = -S.d / 2;
  const F = (i, j) => !nav.blocked(x0 + (i + .5) * .25, z0 + (j + .5) * .25);
  const C = new Int32Array(n * mm).fill(-1), sizes = [];
  for (let j = 0; j < mm; j++) for (let i = 0; i < n; i++) if (F(i, j) && C[j * n + i] < 0) {
    const q = [[i, j]]; C[j * n + i] = sizes.length; let c = 0;
    while (q.length) { const [a, bb] = q.pop(); c++;
      for (const [di, dj] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) { const p = a + di, qq = bb + dj;
        if (p < 0 || qq < 0 || p >= n || qq >= mm || !F(p, qq) || C[qq * n + p] >= 0) continue;
        if (di && dj && (!F(p, bb) || !F(a, qq))) continue; C[qq * n + p] = sizes.length; q.push([p, qq]); } }
    sizes.push(c); }
  /* 점 → 그 점의 칸. 칸이 막혔으면 «가장 가까운 빈 칸» — floor_nav.path 가 출발점을 그렇게 옮긴다(§nearestFreeCell 과 같은 고리 훑기) */
  const compAt = (x, z) => {
    const ci = Math.max(0, Math.min(n - 1, Math.floor((x - x0) / .25))), cj = Math.max(0, Math.min(mm - 1, Math.floor((z - z0) / .25)));
    if (C[cj * n + ci] >= 0) return C[cj * n + ci];
    for (let rr = 1; rr < 24; rr++) for (let di = -rr; di <= rr; di++) for (let dj = -rr; dj <= rr; dj++) {
      if (Math.max(Math.abs(di), Math.abs(dj)) !== rr) continue;
      const a = ci + di, bb = cj + dj; if (a < 0 || bb < 0 || a >= n || bb >= mm) continue;
      if (C[bb * n + a] >= 0) return C[bb * n + a]; }
    return -1; };
  const big = sizes.indexOf(Math.max(...sizes));
  const stComp = st ? compAt(st.x, st.z) : -1;
  /* 문 앞 칸 — 문 가운데에서 방 안쪽으로 몸 반지름 + 칸 반 만큼 들어온 점의 «가장 가까운 빈 칸» */
  const doors = (def.doors || []).map(d => {
    const inward = BODY_R + 0.125 + 0.1;
    const p = d.wall === 'front' ? { x: d.cu, z: S.d / 2 - inward } : d.wall === 'back' ? { x: d.cu, z: -S.d / 2 + inward }
            : d.wall === 'left' ? { x: -S.w / 2 + inward, z: d.cu } : { x: S.w / 2 - inward, z: d.cu };
    const f = nav.nearestFree(p.x, p.z), c = compAt(f.x, f.z);
    return { wall: d.wall, cu: d.cu, at: f, comp: c, ok: c === stComp && c >= 0 };
  });
  return { free: sizes.reduce((a, c) => a + c, 0), sizes, st, stOk: stComp === big && stComp >= 0, doors };
}

const results = []; let fail = 0;
const check = (name, fn) => { try { const s = fn(); results.push(['✔', name, s]); } catch (e) { fail++; results.push(['✘', name, e.message]); } };
console.log(`몸 반지름 BODY_R = ${BODY_R} (room_view.js 에서 읽음)${process.env.SELFTEST ? ' · ⚠ SELFTEST — 반지하 배낭을 x −0.72 로 얹음(대조)' : ''}`);
const rooms = [['banjiha', false], ['oneroom', false], ['oneroom', true]];
for (const [id, ref] of rooms) {
  if (ref && !(H0.rooms[id] && H0.rooms[id].reference_layout)) continue;
  const label = `${id}${ref ? ` + 기준 배치 ${H0.rooms[id].reference_layout.id}` : ''}`;
  check(`${label} — 처음 서는 자리가 큰 덩어리에 있고, 문 앞까지 길이 있다`, () => {
    const r = measure(id, ref);
    const s = `설 수 있는 칸 ${r.free} · 덩어리 ${r.sizes.length}(${r.sizes.join(', ')}) · 서는 자리 (${r.st ? r.st.x.toFixed(2) + ', ' + r.st.z.toFixed(2) : '없음'}) · ` +
              r.doors.map(d => `문(${d.wall} ${d.cu}) ${d.ok ? '이어짐' : '⛔ 끊김'}`).join(' · ');
    assert.ok(r.st, `★ ${label}: 서는 자리를 못 찾았습니다 — ${s}`);
    assert.ok(r.stOk, `★ ${label}: 처음 서는 자리가 «끊긴 주머니»입니다 — 첫 판이 거기서 못 나갑니다. ${s}`);
    for (const d of r.doors) assert.ok(d.ok, `★ ${label}: 문(${d.wall} ${d.cu}) 앞까지 길이 없습니다 — ${s}`);
    return s;
  });
}
for (const [k, name, s] of results) console.log(`  ${k} ${name}\n      ${s}`);
console.log(`\nroom_path: ${fail ? 'FAIL' : 'PASS'}  (${results.length - fail}/${results.length})`);
process.exit(fail ? 1 : 0);
