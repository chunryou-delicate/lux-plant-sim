/* ============================================================
   tools/probe_d90_banjiha_rows.mjs — 반지하 «박사님식»(창 밑 쌓기) · «기본 2자리»(창턱 받침 하나 더) 프로필 줄([house] · 2026-10-30 · 총괄 D90 #7 · #10)
   ------------------------------------------------------------
     node tools/probe_d90_banjiha_rows.mjs            # 재고 표만 찍는다(파일 안 씀)
     node tools/probe_d90_banjiha_rows.mjs --write    # docs/handoff/house-d90-banjiha-rows.json 에 쓴다
   왜: core 하네스(tools/lib/byeot_harness.mjs)는 정적 프로필(이름 붙은 자리만)을 읽어 쌓은 가구 윗면 «칸»이나 아직 없는 받침을 모른다.
       그 자리 줄을 addProfileSlot('banjiha', row) 로 붙이면 페르소나 «박사님식» · «기본 2자리»가 돈다(D90 #10).
   셈: light_adapter.profile 과 같은 줄 꼴(ratio = daylightRatio · ppfd = 등 수마다) · 방 데이터는 사본만 바꾼다(data/* 안 고침).
       반지하 판은 novice(맑은 여름 고정)라 값 = 맑은 여름 그날 값(자연광 + 등) · 문턱 몬스테라 min 2.7
   맞대기: 기본 프로필 + 이 줄을 createProfileLight 로 읽은 값 = 조도 엔진 dliAt 값(등 0·1·2) — 어긋나면 exit 1
   ⚠ 등 2·3 값은 집게등이 책상을 따라 옮겨 가는 것을 안 셌다(사본의 집게등은 제자리) — 등 0·1 만 믿을 것
   ⚠ 옮긴 가구(책상·협탁 등)의 제 자리 줄(desk:* · nightstand:*)은 기본 프로필 값 그대로다 — 거기 시루를 두는 사람이면 같이 뽑아야 한다
   배경 잼(10-25 회의 답): 기본 1자리(창턱 3.68) · 책상 위 서랍장이면 창턱까지 4 · 양쪽 쌓기 6 · 받침 하나 더면 기본 2
============================================================ */
import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'docs', 'handoff', 'house-d90-banjiha-rows.json');
const WRITE = process.argv.includes('--write');
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
const { daylightRatio } = await imp('src/engine/daily_light.js');
const { ppfdSum } = await imp('src/render3d/lighting_sim.js');
const { createProfileLight } = await imp('src/game/room_profile.js');
const FP = dataOf('furniture_presets.json').presets;
const D = { winPresets: dataOf('window_presets.json').presets, doorPresets: dataOf('door_presets.json').presets, finishes: dataOf('room_finishes.json'),
            lightPresets: dataOf('lighting_presets.json'), shadePresets: dataOf('shading_presets.json'),
            lightTh: dataOf('balance/light_thresholds.json'), weatherBalance: dataOf('balance/weather.json') };
const H0 = dataOf('house_rooms.json'); const F0 = H0.rooms.banjiha.furniture;
const BASE = dataOf('profiles/room_profile.banjiha.json');
const TH = D.lightTh.plants.monstera_deliciosa.min;
const layout = (mods = {}, add = []) => F0.map(f => f.uid in mods ? (mods[f.uid] ? { ...f, ...mods[f.uid] } : null) : { ...f }).filter(Boolean).concat(add);
const build = furn => { const H = JSON.parse(JSON.stringify(H0)); H.rooms.banjiha.furniture = furn; const eng = createLightEngine({ houseRooms: H, furnPresets: FP, ...D }); eng.build('banjiha'); return eng; };
const occOf = (eng, uid) => { const g = eng.room.built.furniture.children.find(c => c.userData && c.userData.uid === uid); return g && Number.isFinite(g.userData.occIdx) ? g.userData.occIdx : null; };
const up = { x: 0, y: 1, z: 0 };
const rowAt = (eng, slotId, owner, p, selfIdx, maxPotD) => ({ slotId, owner, point: { x: p.x, y: p.y, z: p.z }, maxPotD,
  ratio: +daylightRatio(p, up, eng.room.wins, { occluders: eng.room.built.occluders, glazed: eng.room.built.glazedPanes, selfIdx }).toPrecision(6),
  ppfd: BASE.lampCounts.map(n => +ppfdSum(eng.room.growRigs.slice(0, n), p).toFixed(2)) });
const dli = (eng, p, n, occIdx) => { const o = eng.dliAt(p, { weather: 'clear', season: 'summer', litHours: 12, lampCount: n, occIdx }); return +((o.dli_daylight ?? 0) + (o.dli_lamp ?? 0)).toFixed(3); };
const slotRow = (eng, slotId) => { const s = eng.room.slots.find(q => q.slotId === slotId); if (!s) throw new Error(`자리 없음: ${slotId}`);
  return { row: rowAt(eng, s.slotId, s.owner, { x: s.x, y: s.y, z: s.z }, s.occIdx, s.maxPotD), dli: [0, 1, 2].map(n => dli(eng, s, n, s.occIdx)) }; };
const cellRows = (eng, ownerUid, prefix, xs, y, z) => { const occ = occOf(eng, ownerUid);
  return xs.map((x, i) => { const p = { x, y, z }; return { row: rowAt(eng, `${prefix}:${i}`, ownerUid, p, occ, 0.25), dli: [0, 1, 2].map(n => dli(eng, p, n, occ)) }; }); };
const sill0 = F0.find(f => f.uid === 'banjiha-sill');

const personas = {};
/* «박사님식» — 오른쪽 쌓기(권함): 책상을 창 오른쪽 벽에 붙이고 그 위 서랍장(윗면 1.54) · 협탁은 비킴 · 3단 선반(무순 자리) 그대로
   윗면 칸 = room_view surfaceAxis(칸 0.25 · 화분 0.20) — 뒷줄(벽에서 0.125) 넷 가운데 창 안쪽 셋이 문턱을 넘는다(창 끝 칸 x 1.025 는 2.06) */
{ const lay = { 'banjiha-desk': { x: 0.65, z: -1.65, rot: 0 }, 'banjiha-dresser': { x: 0.65, z: -1.65, rot: 0, y: 0.74 }, 'banjiha-nightstand': { x: 1.75, z: -1.65, rot: 0 } };
  const eng = build(layout(lay));
  personas.doctor = { ko: '박사님식 — 창 밑 쌓기 3칸 + 창턱(창턱까지 4자리)', moves: lay,
    rows: [slotRow(eng, 'banjiha-sill:0'), ...cellRows(eng, 'banjiha-dresser', 'banjiha-stack', [0.275, 0.525, 0.775], 1.54, -1.775)] }; }
/* «기본 2자리» — 창턱 받침 하나 더(같은 프리셋 shelf_sill_pot1 · 새 3D 0 · 같은 높이·깊이) · 권함 x −0.6(왼쪽 — 오른쪽 쌓기와 안 부딪는다 · 받침 바로 밑은 머리공간이 없다) */
{ const eng = build(layout({}, [{ ...sill0, uid: 'banjiha-sill-2', x: -0.6, note: undefined, visual_front_note: undefined }]));
  personas.default2 = { ko: '기본 2자리 — 창턱 받침 하나 더(x −0.6 · 아직 데이터에 없음 · D90 #7 견준 뒤 정함)', add: { uid: 'banjiha-sill-2', preset: 'shelf_sill_pot1', x: -0.6, y: sill0.y, z: sill0.z, d: sill0.d },
    rows: [slotRow(eng, 'banjiha-sill:0'), slotRow(eng, 'banjiha-sill-2:0')] }; }
/* 참고 — 같은 받침을 오른쪽(x +0.6)에 · 왼쪽 쌓기 · 침대 위 협탁(양쪽 쌓기 6자리의 오른쪽) */
const extra = {};
{ const eng = build(layout({}, [{ ...sill0, uid: 'banjiha-sill-2', x: 0.6, note: undefined, visual_front_note: undefined }]));
  extra.sill2Right = { ko: '받침 하나 더를 오른쪽 x +0.6 에(값은 왼쪽과 같음 · 오른쪽 쌓기 칸 둘의 머리공간을 막는다)', rows: [slotRow(eng, 'banjiha-sill-2:0')] }; }
{ const lay = { 'banjiha-etagere': { x: 1.6, z: -1.72, rot: 0 }, 'banjiha-drying-rack': { x: 1.6, z: 0.6 }, 'banjiha-desk': { x: -0.65, z: -1.65, rot: 0 }, 'banjiha-dresser': { x: -0.65, z: -1.65, rot: 0, y: 0.74 } };
  const eng = build(layout(lay));
  extra.stackLeft = { ko: '왼쪽 쌓기(칸 값은 오른쪽과 같음 · 3단 선반을 비켜 무순 윗단이 0.10~0.25 로 준다)', moves: lay,
    rows: cellRows(eng, 'banjiha-dresser', 'banjiha-stack', [-0.775, -0.525, -0.275], 1.54, -1.775) }; }
{ const lay = { 'banjiha-bed': { x: 0.7, z: -0.9, rot: 0 }, 'banjiha-nightstand': { x: 0.7, z: -1.65, rot: 0, y: 0.94 }, 'banjiha-chair': { x: 1.75, z: -0.6 },
                'banjiha-etagere': { x: 1.75, z: -1.72, rot: 0 }, 'banjiha-drying-rack': { x: -1.6, z: 0.9 } };
  const eng = build(layout(lay));
  extra.bedNightstand = { ko: '침대 위 협탁(윗면 1.42 · 왼쪽 쌓기와 함께면 6자리 · 침대 키 0.94 는 머리판까지라 그림이 뜰 수 있음)', moves: lay,
    rows: cellRows(eng, 'banjiha-nightstand', 'banjiha-stack-r', [0.575, 0.825], 1.42, -1.775) }; }

/* 맞대기 — 기본 프로필 + 줄 → createProfileLight.dliOfSlot(맑은 여름 · 등 0·1·2) = 엔진 dliAt */
const LD = { lightTh: D.lightTh, weatherBalance: D.weatherBalance };
let worst = 0;
const check = (name, set) => {
  const p = { ...BASE, uidStable: true, slots: [...BASE.slots.filter(s => !set.rows.some(r => r.row.slotId === s.slotId)), ...set.rows.map(r => r.row)] };
  const light = createProfileLight(p, LD);
  console.log(`■ ${name} — ${set.ko}`);
  for (const r of set.rows) {
    const got = [0, 1, 2].map(n => light.dliOfSlot(r.row.slotId, { weather: 'clear', season: 'summer', lampCount: n, litHours: 12 }));
    const d = Math.max(...got.map((g, i) => Math.abs(g - r.dli[i]))); worst = Math.max(worst, d);
    r.ok = { lamp0: r.dli[0] >= TH, lamp1: r.dli[1] >= TH };
    console.log(`  ${r.row.slotId.padEnd(18)} (${r.row.point.x}, ${r.row.point.y}, ${r.row.point.z}) 등0 ${r.dli[0].toFixed(2)}${r.ok.lamp0 ? '◎' : ' '} 등1 ${r.dli[1].toFixed(2)}${r.ok.lamp1 ? '◎' : ' '} · 프로필로 읽은 값 차 ${d.toFixed(4)}`);
  }
};
for (const [k, s] of Object.entries(personas)) check(k, s);
for (const [k, s] of Object.entries(extra)) check(k, s);
console.warn = warn;
const okAll = worst < 1e-3;
console.log(`\n맞대기 가장 큰 차 ${worst.toFixed(4)} mol/m²·d — ${okAll ? 'PASS' : 'FAIL'}`);
if (WRITE && okAll) {
  let head = null; try { head = execFileSync('git', ['-C', ROOT, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { head = null; }
  fs.writeFileSync(OUT, JSON.stringify({
    _what: 'house D90 — 반지하 «박사님식» · «기본 2자리» 하네스 줄. core 가 tools/lib/byeot_harness.mjs addProfileSlot("banjiha", row) 로 붙인다(데이터 아님)',
    _how: 'node tools/probe_d90_banjiha_rows.mjs --write · light_adapter.profile 과 같은 줄 꼴 · 반지하 novice(맑은 여름) · 문턱 몬스테라 min ' + TH,
    _warn: ['등 2·3 값은 집게등이 책상을 따라가는 것을 안 셌다 — 등 0·1 만 믿을 것', '옮긴 가구의 제 자리 줄(desk:* · nightstand:*)은 기본 프로필 값 그대로'],
    madeAt: head, baseRoomRev: BASE.roomRev, lampCounts: BASE.lampCounts,
    personas, extra
  }, null, 1) + '\n');
  console.log('썼다', path.relative(ROOT, OUT));
}
process.exit(okAll ? 0 : 1);
