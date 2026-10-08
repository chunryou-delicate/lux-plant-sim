/* ============================================================
   tools/probe_place_freedom.mjs — **놓기 자유 점검** ([house] · 2026-10-08 · 박사님 「이리 튈지 저리 튈지 모르니」)
   ------------------------------------------------------------
     node tools/probe_place_freedom.mjs            (헤드리스 · 크롬 안 씀)
   사람은 화분·시루·삽수를 아무 데나 놓는다. 방마다(반지하 · 원룸 = 빈 방 + 기준 배치 D) 자리마다(이름 붙은 자리 + 바닥 0.25 칸):
     ① 놓이나            바닥: floor_nav 로 화분 반지름(POT_R) 밖이면 놓인다(furniture_dress 주석 · room_view 와 같은 판)
     ② 놓였는데 안 자라나  몬스테라(화분·삽수): 안자람 <2.7(min · 엔딩까지 안 죽는다 D1) · 자람 · 갈라짐 ≥6 · 과광 >16
                          ★ 게임이 쓰는 값으로 — 반지하 «초보 판»(맑은 여름 그날 값 = peak · D1) · 원룸 real(자연광 peak × E(계절) + 등 DLI)
                          콩나물·무순은 «안 자람»이 없다 — 품질(끼니)만 갈린다(first_play CROP_KINDS.quality)
     ④ 길을 막나          바닥 칸에 화분 하나를 놓으면(room_view navColliders · 지름 POT_D) 처음 서는 자리에서 문까지 길이 끊기나 · 갇히는 칸 수
   ⚠ ③(빛 분포 보기가 참을 말하나)과 「게임이 무슨 말을 하나」는 코드 읽기로 따로 본다(docs/handoff/house-place-freedom-20261008.md).
   ⚠ 계절은 여름·겨울 두 점이다(real 365일은 [growth] 자) · 등은 0 개와 «방의 등 자리 전부».
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
const { createFloorNav } = await import(pathToFileURL(path.join(ROOT, 'src/render3d/floor_nav.js')).href);
const { weatherE } = await import(pathToFileURL(path.join(ROOT, 'src/engine/weather.js')).href);
console.warn = _w;
const RV = fs.readFileSync(path.join(ROOT, 'src/game/room_view.js'), 'utf8');
const BODY_R = +RV.match(/const\s+BODY_R\s*=\s*([0-9.]+)/)[1];
const POT_D = 0.24, POT_R = POT_D / 2;
const TH = dataOf('balance/light_thresholds.json').plants.monstera_deliciosa;
const H0 = dataOf('house_rooms.json');
const D = { winPresets: dataOf('window_presets.json').presets, doorPresets: dataOf('door_presets.json').presets, finishes: dataOf('room_finishes.json'),
  furnPresets: dataOf('furniture_presets.json').presets, lightPresets: dataOf('lighting_presets.json'), shadePresets: dataOf('shading_presets.json'),
  lightTh: dataOf('balance/light_thresholds.json'), weatherBalance: dataOf('balance/weather.json') };
/* ⚠ 엔딩까지 잎은 안 죽는다(D1) — 문턱 아래는 «안 자람»이다(죽지 않는다). 문턱: 자람 min · 갈라짐 fenestrate · 과광 max */
const monClass = v => v < TH.min ? '안자람' : v < TH.fenestrate ? '자람' : v <= TH.max ? '갈라짐' : '과광';
const beanQ = v => v <= 0.3 ? '최상' : v <= 1.0 ? '둘째' : '셋째';
const musunQ = v => v >= 0.35 ? '최상' : v >= 0.15 ? '둘째' : '셋째';

function room(id, withRef) {
  const H = JSON.parse(JSON.stringify(H0)); const def = H.rooms[id];
  if (withRef) def.furniture = [...def.furniture, ...def.reference_layout.furniture];
  console.warn = () => {}; const eng = createLightEngine({ houseRooms: H, ...D }); const r = eng.build(id); console.warn = _w;
  const b = r.built, S = b.size, nR = (r.growRigs || []).length;
  /* ★ 방마다 게임이 쓰는 값으로 — 반지하는 «초보 판»(여름·맑음 고정 · 그날 값 = peak · D1), 원룸은 real(계절 · 자연광 × E + 등) */
  const NOVICE = id === 'banjiha';
  const real = (p, season, n) => { eng.clearCache(); const o = eng.dliAt(p, { weather: 'clear', season: NOVICE ? 'summer' : season, litHours: 12, lampCount: n, occIdx: p.occIdx });
    return NOVICE ? (o.dli_daylight ?? 0) + (o.dli_lamp ?? 0) : (o.dli_daylight ?? 0) * weatherE(season) + (o.dli_lamp ?? 0); };
  const navPot = createFloorNav({ colliders: b.colliders, size: S, radius: POT_R });
  /* 처음 서는 자리 · 문 — test_room_path 와 같은 셈 */
  const navOf = (cols) => createFloorNav({ colliders: cols, size: S, radius: BODY_R });
  let wx = 0, wz = -S.d / 2; const win = (b.luxWins || []).filter(w => w.wall && w.wall !== 'ceiling'); if (win.length && win[0].wall === 'back') wx = win[0].cu || 0;
  const standOf = (nav) => { let st = null, bs = -Infinity; for (let x = -S.w / 2 + 0.34; x <= S.w / 2 - 0.34; x += 0.2) for (let z = -S.d / 2 + 0.34; z <= S.d / 2 - 0.34; z += 0.2) {
      if (nav.blocked(x, z, BODY_R)) continue; let dS = Infinity; for (const s of r.slots) dS = Math.min(dS, Math.hypot(s.x - x, s.z - z)); if (dS < 0.55) continue;
      const dW = Math.min(S.w / 2 - Math.abs(x), S.d / 2 - Math.abs(z)), sco = Math.min(dS, 2) + Math.min(Math.hypot(wx - x, wz - z), 3) * 0.55 - dW * 0.9; if (sco > bs) { bs = sco; st = { x, z }; } }
    return st; };
  const door = (def.doors || [])[0]; const doorP = door && door.wall === 'front' ? { x: door.cu, z: S.d / 2 - BODY_R - 0.225 } : null;
  const reach = (nav, from) => { const p = nav.path(from.x, from.z, doorP.x, doorP.z); const end = p.length ? p[p.length - 1] : from; return Math.hypot(end.x - doorP.x, end.z - doorP.z) < 0.4; };
  const baseNav = navOf(b.colliders); const st0 = standOf(baseNav);
  /* 이름 붙은 자리 */
  const slots = r.slots.map(s => {
    const sum = [0, nR].map(n => real(s, 'summer', n)), win_ = [0, nR].map(n => real(s, 'winter', n));
    return { id: s.slotId, y: +s.y.toFixed(2), 여름: sum.map(v => +v.toFixed(2)), 겨울: win_.map(v => +v.toFixed(2)),
             몬: `${monClass(win_[0])}→${monClass(sum[0])} / 등${nR} ${monClass(win_[1])}→${monClass(sum[1])}`, 콩: beanQ(sum[0]), 무순: musunQ(sum[0]) };
  });
  /* 바닥 칸 */
  const floor = []; let blockCells = 0, trapCells = 0; const blockList = [];
  for (let x = -S.w / 2 + 0.125; x < S.w / 2; x += 0.25) for (let z = -S.d / 2 + 0.125; z < S.d / 2; z += 0.25) {
    if (navPot.blocked(x, z, POT_R)) continue;
    const p = { x, y: 0.10, z };
    const s0 = real(p, 'summer', 0), w0 = real(p, 'winter', 0), sN = real(p, 'summer', nR), wN = real(p, 'winter', nR);
    /* ④ 이 칸에 화분 하나 — room_view navColliders 처럼 지름 POT_D 정사각 */
    const nav2 = navOf([...b.colliders, { x, z, w: POT_D, d: POT_D, rot: 0, plant: true }]);
    const st = standOf(nav2) || st0; const ok = doorP ? reach(nav2, st) : true;
    if (!ok) { blockCells++; if (blockList.length < 12) blockList.push(`(${x.toFixed(2)},${z.toFixed(2)})`); }
    floor.push({ x, z, s0, w0, sN, wN, ok });
  }
  const cnt = (f) => floor.filter(f).length;
  return { id: withRef ? `${id}+${def.reference_layout.id}` : id, 모드: NOVICE ? '초보(맑은 여름 그날 값 · 겨울 없음)' : 'real(여름·겨울 7일평균)', nR, size: S, slots, floorN: floor.length,
    바닥_몬스테라: { 여름등0_자람: cnt(c => c.s0 >= TH.min), 겨울등0_자람: cnt(c => c.w0 >= TH.min), [`여름등${nR}_자람`]: cnt(c => c.sN >= TH.min), [`겨울등${nR}_자람`]: cnt(c => c.wN >= TH.min),
                    [`최고_여름등${nR}`]: +Math.max(...floor.map(c => c.sN)).toFixed(2) },
    바닥_콩나물최상_여름: cnt(c => c.s0 <= 0.3), 바닥_무순최상_여름: cnt(c => c.s0 >= 0.35), 바닥_무순최상_여름_등전부: cnt(c => c.sN >= 0.35),
    길막힘: { 칸: blockCells, 처음서는자리: st0, 예: blockList } };
}

const out = [room('banjiha', false), room('oneroom', false), room('oneroom', true)];
for (const R of out) {
  console.log(`\n■ ${R.id} · 등 자리 ${R.nR} · 바닥에 화분 놓이는 칸 ${R.floorN}`);
  console.log('  이름 붙은 자리 (real 7일평균 · [등0, 등전부] · 몬스테라 겨울→여름)');
  for (const s of R.slots) console.log(`    ${s.id.padEnd(22)} y${String(s.y).padEnd(5)} 여름 ${JSON.stringify(s.여름).padEnd(14)} 겨울 ${JSON.stringify(s.겨울).padEnd(14)} 몬 ${s.몬}  콩 ${s.콩} 무순 ${s.무순}`);
  console.log('  바닥 몬스테라 «자람» 칸:', JSON.stringify(R.바닥_몬스테라));
  console.log(`  바닥 콩나물 최상(≤0.3) 여름 ${R.바닥_콩나물최상_여름} · 무순 최상(≥0.35) 여름 등0 ${R.바닥_무순최상_여름} · 등 전부 ${R.바닥_무순최상_여름_등전부}`);
  console.log(`  ④ 화분 하나로 처음 서는 자리 → 문 길이 끊기는 바닥 칸 ${R.길막힘.칸} · 서는 자리 ${JSON.stringify(R.길막힘.처음서는자리)} · 예 ${R.길막힘.예.join(' ')}`);
}
if (process.env.JSON_OUT) fs.writeFileSync(process.env.JSON_OUT, JSON.stringify(out, null, 1));
