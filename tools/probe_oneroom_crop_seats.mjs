/* ============================================================
   tools/probe_oneroom_crop_seats.mjs — 원룸 이사 때 시루 · 재배판이 앉을 자리([house] · 2026-10-31 · 총괄 «원룸 이사 그루 자리»)
   ------------------------------------------------------------
     node tools/probe_oneroom_crop_seats.mjs
   왜: D91 로 시루 16 이 기본 길이 되어 이사하면 시루 · 재배판 열아홉이 oneroom §reseatCrops 의 «room.slots[0] 한 점»(oneroom-sill:0)에 겹친다.
       이사 순간 방에 선 것은 창턱 받침 하나(가방 가구는 사람이 꺼내 놓는다)라 이름 자리가 넷뿐이다.
   잰다(게임과 같은 조도 엔진 light_adapter · 길은 room_view 와 같은 src/render3d/floor_nav.js):
     A 이사 직후 이름 자리 — 수 · maxPotD · 기대 DLI(real: 자연광 × E[날씨] 0.643 + 등) 여름·겨울 · 등 0/1
     B 가방 가구를 기준 배치 D(house_rooms §oneroom.reference_layout)로 놓았을 때 — 이름 자리 + 윗면 칸(room_view §surfaceAxis · 지름 0.20)
     C 콩나물(≤0.3 하얗고 아삭 · ≤1.0 살짝 초록) · 무순(≥0.35 최상) 칸 수 — 계절 × 등 0~3
     D 길 — 문 앞(room_view §doorReach 꼴: 문 점에서 BODY_R+0.225 안쪽) · 작물 칸마다 걸어서 설 수 있는 가장 가까운 거리(ACT_REACH 1.45 안인가)
   지름: 시루 · 재배판 둘 다 roomView.plantPotD 0.20(core 잼 10-31).
   ⚠ 윗면 칸은 프리셋 크기로 깐 근사다(게임은 메시 상자 meshRect). 기준 배치 D 의 책상 · 서랍장은 room_view 칸과 같은 수(5×2 · 4×2)다.
   판정(exit 1): 기준 배치 D 에 19가 다 못 앉음 · 문 앞 못 닿음 · 작물 칸 하나라도 1.45m 밖
============================================================ */
import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataOf = r => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', r), 'utf8'));
const sc = () => new Proxy({}, { get: (t, k) => {
  if (k === 'createImageData' || k === 'getImageData') return (w = 1, h = 1) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h });
  if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop() {} });
  if (k === 'measureText') return () => ({ width: 0 });
  return () => {};
} });
const se = () => ({ style: {}, dataset: {}, appendChild() {}, setAttribute() {}, getContext: () => sc(), width: 0, height: 0 });
globalThis.document = { createElement: se, body: se(), getElementById: () => se() }; globalThis.window = globalThis;
const warn = console.warn; console.warn = () => {};
vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'vendor/three/three.min.js'), 'utf8'));
const imp = p => import(pathToFileURL(path.join(ROOT, p)).href);
const { createLightEngine } = await imp('src/game/light_adapter.js');
const { createFloorNav } = await imp('src/render3d/floor_nav.js');
const FP = dataOf('furniture_presets.json').presets;
const D = { winPresets: dataOf('window_presets.json').presets, doorPresets: dataOf('door_presets.json').presets, finishes: dataOf('room_finishes.json'),
            lightPresets: dataOf('lighting_presets.json'), shadePresets: dataOf('shading_presets.json'),
            lightTh: dataOf('balance/light_thresholds.json'), weatherBalance: dataOf('balance/weather.json') };
const H0 = dataOf('house_rooms.json'); const R0 = H0.rooms.oneroom;
const E = D.weatherBalance.weather.expected_k;          // 0.643 — 맑음·흐림·비 기대 배율
const POT_D = 0.20, CROPS = 19, BODY_R = 0.38, ACT_REACH = 1.45, BESIDE_GAP = 0.45;
const SEAS = ['summer', 'winter'];
const build = add => { const H = JSON.parse(JSON.stringify(H0)); H.rooms.oneroom.furniture = [...R0.furniture, ...add]; const eng = createLightEngine({ houseRooms: H, furnPresets: FP, ...D }); eng.build('oneroom'); return eng; };
/* real 판 기대값: 자연광 × E[날씨] + 등(날씨 안 탐) — light_adapter §placeVerdict 와 같은 셈 */
const exp = (eng, p, season, n, occIdx) => { const o = eng.dliAt(p, { weather: 'clear', season, litHours: 12, lampCount: n, occIdx }); return (o.dli_daylight ?? 0) * E + (o.dli_lamp ?? 0); };
const row = (eng, p, occ) => SEAS.map(s => [0, 1].map(n => exp(eng, p, s, n, occ).toFixed(2)).join('/')).join(' · ');
let fail = 0;

/* A 이사 직후 */
const e0 = build([]);
const fit0 = e0.room.slots.filter(s => Number.isFinite(s.maxPotD) && s.maxPotD >= POT_D);
console.log(`■ A 이사 직후 — 이름 자리 ${e0.room.slots.length} · 지름 ${POT_D} 이 오르는 자리 ${fit0.length} · 등 자리 ${e0.room.growRigs.length}  (기대 DLI 여름 등0/1 · 겨울 등0/1)`);
for (const s of e0.room.slots) console.log(`  ${s.slotId.padEnd(20)} maxPotD ${s.maxPotD} (${s.x.toFixed(2)}, ${s.y.toFixed(2)}, ${s.z.toFixed(2)})  ${row(e0, s, s.occIdx)}`);

/* B 기준 배치 D */
const eD = build(R0.reference_layout.furniture);
const furnOf = uid => eD.room.built.furniture.children.find(c => c.userData && c.userData.uid === uid);
const axis = L => { let n = Math.max(1, Math.round(L / 0.25)); n = Math.min(n, Math.max(1, Math.floor(L / POT_D + 1e-9))); const c = L / n; return [...Array(n)].map((_, i) => (i + 0.5) * c - L / 2); };
const topCells = uid => { const g = furnOf(uid), u = g.userData, r = g.rotation.y || 0, out = [];
  for (const a of axis(u.size.w)) for (const b of axis(u.size.d))
    out.push({ uid, x: g.position.x + a * Math.cos(r) + b * Math.sin(r), y: u.size.h, z: g.position.z - a * Math.sin(r) + b * Math.cos(r), occ: u.occIdx });
  return out; };
const named = eD.room.slots.map(s => ({ uid: s.slotId.slice(0, s.slotId.lastIndexOf(':')), slotId: s.slotId, x: s.x, y: s.y, z: s.z, occ: s.occIdx, maxPotD: s.maxPotD }));
const TOPS = ['banjiha-desk', 'banjiha-nightstand', 'banjiha-dresser'];
const tops = TOPS.flatMap(topCells);
const shelfy = named.filter(s => !TOPS.includes(s.uid));      // 창턱 · 에타제르(단 칸 = 이름 자리)
const seats = [...shelfy, ...tops];
console.log(`\n■ B 기준 배치 D(${R0.reference_layout.furniture.map(f => f.uid.replace('banjiha-', '')).join(' · ')}) — 이름 자리 ${named.length} · 가구 위 칸 ${seats.length}(창턱 · 에타제르 이름 자리 ${shelfy.length} + 책상 · 협탁 · 서랍장 윗면 ${tops.length})`);
for (const uid of TOPS) {
  console.log(`  ${uid} 윗면 ${tops.filter(c => c.uid === uid).length}칸 (이름 자리 ${named.filter(s => s.uid === uid).length})`);
  for (const c of tops.filter(q => q.uid === uid)) console.log(`    (${c.x.toFixed(2)}, ${c.y.toFixed(2)}, ${c.z.toFixed(2)})  ${row(eD, c, c.occ)}`);
}
for (const s of shelfy.filter(q => /etagere/.test(q.uid))) console.log(`  ${s.slotId.padEnd(20)} (${s.x.toFixed(2)}, ${s.y.toFixed(2)}, ${s.z.toFixed(2)})  ${row(eD, s, s.occ)}`);
if (seats.length < CROPS) { fail++; console.log(`FAIL  가구 위 칸 ${seats.length} < ${CROPS}`); }

/* C 품질별 칸 수 — 콩나물은 창턱 밖(어두운 쪽), 무순은 창턱 · 에타제르 */
console.log('\n■ C 칸 수 — 콩나물(창턱 뺀 가구 위) · 무순(창턱 + 에타제르)');
const dark = seats.filter(c => !/sill/.test(c.uid)), lit = shelfy;
for (const s of SEAS) for (const n of [0, 1, 2, 3]) {
  const v = dark.map(c => exp(eD, c, s, n, c.occ)), m = lit.map(c => exp(eD, c, s, n, c.occ));
  console.log(`  ${s.padEnd(6)} 등${n}: 콩나물 ≤0.3 ${String(v.filter(x => x <= 0.3).length).padStart(2)} · ≤1.0 ${String(v.filter(x => x <= 1.0).length).padStart(2)} / ${v.length}  |  무순 ≥0.35 ${m.filter(x => x >= 0.35).length} / ${m.length}`);
}
const sill = e0.room.slots.map(s => exp(e0, s, 'summer', 0, s.occIdx));
console.log(`  창턱(이사 직후 그 넷) 여름 등0 기대 ${Math.min(...sill).toFixed(2)}~${Math.max(...sill).toFixed(2)} — 콩나물이면 «초록·쓴맛» · 5일 회전에 하루만 서도 평균 +${(Math.max(...sill) / 5).toFixed(2)}(품질 = 회전 dliHist 평균 · first_play §harvest)`);

/* D 길 */
console.log(`\n■ D 길 — 몸 반지름 ${BODY_R} · 문 앞 · 손 닿음 ${ACT_REACH}m`);
const navOf = eng => createFloorNav({ colliders: eng.room.built.colliders, size: { w: R0.size.w, d: R0.size.d }, radius: BODY_R });
const inward = BODY_R + 0.125 + 0.1;                           // room_view §doorReach
const dr = R0.doors[0], doorPt = { x: dr.cu, z: R0.size.d / 2 - inward };
for (const [ko, eng] of [['이사 직후', e0], ['기준 배치 D', eD]]) {
  const nav = navOf(eng), at = nav.nearestFree(doorPt.x, doorPt.z), p = nav.path(0, 0.5, at.x, at.z) || [], e = p.length ? p[p.length - 1] : { x: 0, z: 0.5 };
  const gap = Math.hypot(e.x - at.x, e.z - at.z);
  let free = 0; for (let x = -R0.size.w / 2 + 0.125; x < R0.size.w / 2; x += 0.25) for (let z = -R0.size.d / 2 + 0.125; z < R0.size.d / 2; z += 0.25) if (!nav.blocked(x, z)) free++;
  console.log(`  ${ko}: 설 수 있는 칸 ${free} · 문 점 (${doorPt.x}, ${doorPt.z.toFixed(3)}) → 설 자리 (${at.x.toFixed(2)}, ${at.z.toFixed(2)}) · 방 가운데서 걸어 틈 ${gap.toFixed(2)} ${gap <= BESIDE_GAP ? '✔' : '✘'}`);
  if (gap > BESIDE_GAP) fail++;
}
{ const nav = navOf(eD); let worst = 0, worstAt = null;
  for (const c of seats) { const p = nav.path(0, 0.5, c.x, c.z) || [], e = p.length ? p[p.length - 1] : { x: 0, z: 0.5 }, d = Math.hypot(e.x - c.x, e.z - c.z); if (d > worst) { worst = d; worstAt = c; } }
  console.log(`  기준 배치 D 작물 칸 ${seats.length} — 걸어서 선 자리에서 가장 먼 칸 ${worst.toFixed(2)}m (${worstAt.slotId || worstAt.uid}) ${worst <= ACT_REACH ? '✔' : '✘'} ACT_REACH ${ACT_REACH}`);
  if (worst > ACT_REACH) fail++; }

console.warn = warn;
console.log(`\noneroom_crop_seats: ${fail ? 'FAIL' : 'PASS'}`);
process.exit(fail ? 1 : 0);
