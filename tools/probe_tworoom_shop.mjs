/* ============================================================
   probe_tworoom_shop.mjs — 투룸 빛 표 · 식물 가게 주문 기한이 «키워서 맞출 수 있는 길이»인가 ([growth] · 2026-10-10 · 총괄 D59)
   ------------------------------------------------------------
   ★ 총괄(D59 식물 가게 · 투룸): ② 투룸 빛 표(철마다 · 등 0~3) ③ plan 주문 기한(쉬움 21 · 보통 30 · 어려움 45일 · plan-shop-spec §2)이
     «겨울에도» 맞출 수 있는 길인지. 원천이 이미 조건을 갖춘 판(가진 잎으로 바로 납품)은 길이를 안 따진다 — 여기 재는 것은
     «새로 키워서» 그 기한 안에 조건이 서는가다(주문이 열린 날 막 시작한 그루로).
   ★ 규칙은 다 읽어서 쓴다(손으로 안 베낌):
     몬스테라 삽수(core propagation): 흙 자리 잡은 삽수 · 자라는 밴드 날 CUTTING_LEAF_DAYS 마다 잎 한 장 · 무늬 삽수 문턱 ×need_mult ·
       무늬 = VARIE_LIGHT[뿌리낸 날 밴드 걸음] × D40(youngVarieChanceOf) · 등급 = varie_grades lightGrade[걸음]
     핑크프린세스 · 알로카시아: src/growth/species_growth(정본 규칙)를 그날 빛·철로 걷는다
   ★ 판: 주문이 «철 첫날»(또는 가을 끝 — 기한 안에 겨울이 끼는 판)에 열린다 · 날씨는 real(판 씨앗 SEEDS 개) · 등은 프로필 등 자리 0~N
   ★ 조건(plan §2-3) — 새로 키워 맞추는 길:
     cut2   몬스테라 삽수 보통  잎 ≥ 2(들고 온 1 + 새 잎 1) · 30일
     cutHM  몬스테라 삽수 어려움 무늬 ≥ 하프문(무늬 삽수 · 그 자리에서 뿌리냄) · 45일   ※ 확률 — «한 판이라도 서나»가 아니라 성공 몫
     cutSB  (등이 안 놓였을 때의 어려움) 무늬 ≥ 산반 · 45일
     ppSB   핑크프린세스 보통 새 잎이 분홍 마블 이상 · 30일 · ppHM 어려움 새 잎이 분홍 많음 이상 · 45일 (시작 분홍 몫 start 0.35 · 판마다 굴림)
            ppHM5 같은 어려움을 맨 위 분홍 0.5 에서(분홍이 짙은 그루를 가진 사람)
            ppHM5x 같은 판에서 «분홍 많음»만(분홍 잎 = 풀문 자리는 빼고 · plan 은 분홍 잎을 주문하지 않는다 · 2026-10-10)
     al2    알로카시아 보통 잎 ≥ 2(막 싹튼 1장) · 30일 (겨울엔 al 주문을 안 낸다 — plan §2-2 · 그래도 «가을 끝» 판으로 겨울이 끼는 몫을 잰다)
   ★ D71(2026-10-23) ④ 스킨답서스 «높은 자리»(house dropM ≥ 문턱 · R.isHighSpot) 수 · 그 자리에서 뿌리 낸 줄기가 longVineM 에 닿는 날 · 벽 화분걸이 하나 건 사본 포함
     ⑤ 칼라테아 «알맞은 자리»(avg7 이 [lo, hi] 안인 날 몫 ≥ 0.5 · R.spotFit) 수 · 너무 밝은 자리 수 · 맡은 그루가 다 펴지는 날
   ⚠ 프로필이 낡으면 이 표도 낡는다 — gen_room_profile --rooms=tworoom 로 SAME 인지 먼저 보라.
     PROFILE=data/profiles/room_profile.tworoom.json SEEDS=12 OUT=docs/handoff/growth-tworoom-shop.json node tools/probe_tworoom_shop.mjs
   ⛔ 값·확률·문턱·기한은 안 건드린다.
============================================================ */
import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProfileLight } from '../src/game/room_profile.js';
import { NO_GROW_BANDS } from '../src/game/loop.js';
import { CUTTING_LEAF_DAYS, VARIE_LIGHT, varieLightStepOf, youngVarieChanceOf } from '../src/game/propagation.js';
import { judgeDLI, thresholdsFor } from '../src/engine/daily_light.js';
import { seasonOf } from '../src/engine/weather.js';
import { createSpeciesRules } from '../src/growth/species_growth.js';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const J = p => JSON.parse(fs.readFileSync(path.isAbsolute(p) ? p : path.join(ROOT, p), 'utf8'));
const FILE = process.env.PROFILE || 'data/profiles/room_profile.tworoom.json';
const SEEDS = Number(process.env.SEEDS || 12), PP_RUNS = Number(process.env.PP_RUNS || 40);
const TH = J('data/balance/light_thresholds.json'), P = J(FILE);
const W = J('data/balance/weather.json'), E = J('data/balance/electricity.json');
const LG = J('data/balance/varie_grades.json').lightGrade;
const R = createSpeciesRules(J('data/growth_species.json'), TH);
const PPS = J('data/growth_species.json').species.pink_princess.pink;
const LAMPS = (P.lampCounts || [0]);
const bandOf = (dli, varie) => judgeDLI(dli, thresholdsFor(TH, 'monstera_deliciosa', varie)).band;
const SEASON_START = { spring: 0, summer: 90, autumn: 180, winter: 270, lateAutumn: 240 };
const OPENS = Object.keys(SEASON_START);
const DUE = { easy: 21, normal: 30, hard: 45 };
const H = 60;   // 창 길이(기한 45 + 여유)
const mean = a => a.reduce((x, y) => x + y, 0) / (a.length || 1);

console.log(`══ 투룸 — ${FILE} · roomRev ${String(P.roomRev || '').split(' ')[0] || '—'} · 생성 ${P.generatedAt || '—'} · 자리 ${P.slots.length} · 등 ${JSON.stringify(LAMPS)} · real · 씨앗 ${SEEDS}`);

/* 자리 × 등 × 판 씨앗 × 여는 날 → 그날부터 H 일의 DLI · 철 */
const series = {};   // key `${slot}|${lamps}|${open}|${seed}` → { dli:[], season:[] }
for (const lamps of LAMPS) for (let seed = 1; seed <= SEEDS; seed++) for (const open of OPENS) {
  const light = createProfileLight({ ...P, uidStable: true }, { thresholds: TH, weather: W, electricity: E });
  const y0 = SEASON_START[open] + (seed - 1) * 360;            // 판마다 다른 해(날씨 굴림이 갈린다)
  const per = {};
  for (let d = 1; d <= H; d++) {
    const rep = light.daily(d, { sim: { mode: 'real', yearDay0: y0 - 1, seed }, lamps: { count: lamps, litHours: 12 }, pots: [], placedItems: [] }).report;
    for (const s of rep.slots || []) { (per[s.slotId] ||= { dli: [], season: [] }); per[s.slotId].dli.push(s.dli); per[s.slotId].season.push(seasonOf(y0 - 1 + d)); }
  }
  for (const [sid, v] of Object.entries(per)) series[`${sid}|${lamps}|${open}|${seed}`] = v;
}
const slots = P.slots.map(s => s.slotId);

/* ② 빛 표 — 철 첫날부터 60일 평균 DLI(판 씨앗 평균) · 몬스테라(민무늬) 자라는 날 몫 */
console.log('\n② 빛 표 — 철 첫날부터 60일 평균 DLI · [자라는 날 %] (등 ' + LAMPS.join('/') + ')');
const lightRows = [];
for (const sid of slots) {
  const row = { slot: sid, seasons: {} };
  const cells = [];
  for (const open of ['spring', 'summer', 'autumn', 'winter']) {
    row.seasons[open] = {};
    const txt = LAMPS.map(l => {
      const all = [], grow = [];
      for (let seed = 1; seed <= SEEDS; seed++) { const v = series[`${sid}|${l}|${open}|${seed}`]; all.push(mean(v.dli)); grow.push(mean(v.dli.map(x => NO_GROW_BANDS.has(bandOf(x, false)) ? 0 : 1))); }
      const m = mean(all), g = mean(grow);
      row.seasons[open][l] = { dli: +m.toFixed(2), growShare: +g.toFixed(2) };
      return `${m.toFixed(1)}[${Math.round(g * 100)}]`;
    }).join('/');
    cells.push(`${open.slice(0, 2)} ${txt}`);
  }
  lightRows.push(row);
  console.log(`   ${sid.padEnd(32)} ${cells.join('  ')}`);
}

/* ③ 기한 — 조건마다 그 창에서 «서는 몫»(0~1) */
const cutWindow = (v, varie) => { let acc = 0; const days = []; for (let d = 1; d <= H; d++) { if (!NO_GROW_BANDS.has(bandOf(v.dli[d - 1], varie))) acc++; if (acc >= CUTTING_LEAF_DAYS) { acc -= CUTTING_LEAF_DAYS; days.push(d); } } return days; };
const tests = {
  cut2: (v) => { const ds = cutWindow(v, false); return ds.length && ds[0] <= DUE.normal ? 1 : 0; },
  cutHM: (v) => { const step = varieLightStepOf(bandOf(v.dli[0], false)); if (!step) return 0;
    const p = Math.min(1, youngVarieChanceOf(VARIE_LIGHT[step]) || 0), q = (LG[step].halfmoon || 0) + (LG[step].fullmoon || 0);
    const k = cutWindow(v, true).filter(d => d <= DUE.hard).length; return 1 - Math.pow(1 - p * q, k); },
  cutSB: (v) => { const step = varieLightStepOf(bandOf(v.dli[0], false)); if (!step) return 0;
    const p = Math.min(1, youngVarieChanceOf(VARIE_LIGHT[step]) || 0);
    const k = cutWindow(v, true).filter(d => d <= DUE.hard).length; return 1 - Math.pow(1 - p, k); },
  ppSB: (v) => ppTest(v, DUE.normal, PPS.green_max),
  ppHM: (v) => ppTest(v, DUE.hard, PPS.heavy_min),
  ppHM5: (v) => ppTest(v, DUE.hard, PPS.heavy_min, 0.5),
  ppHM5x: (v) => ppTest(v, DUE.hard, PPS.heavy_min, 0.5, PPS.pink_leaf_min),
  al2: (v) => { let a = R.newPlant('alocasia_frydek', { seed: 3, origin: 'from_plain_mother' });
    for (let d = 0; d < 40 && a.leaves.length < 1; d++) R.stepDay(a, { dli: 6, season: 'spring' });   // 막 싹튼 1장
    a.hist = []; let ok = 0;
    for (let d = 1; d <= DUE.normal; d++) { for (const e of R.stepDay(a, { dli: v.dli[d - 1], season: v.season[d - 1] })) if (e.type === 'leaf') ok = 1; }
    return ok; }
};
function ppTest(v, due, minPink, startPink = PPS.start, belowPink = Infinity) {
  let hit = 0;
  for (let r = 1; r <= PP_RUNS; r++) {
    const p = R.newPlant('pink_princess', { seed: 1000 + r, pinks: [startPink] });
    let got = 0;
    for (let d = 1; d <= due && !got; d++) for (const e of R.stepDay(p, { dli: v.dli[d - 1], season: v.season[d - 1] })) if (e.type === 'leaf' && e.pink > minPink && e.pink < belowPink) got = 1;
    hit += got;
  }
  return hit / PP_RUNS;
}
const KINDS = { cut2: '몬스테라 삽수 보통 잎≥2 · 30일', cutSB: '몬스테라 삽수 어려움 무늬≥산반 · 45일', cutHM: '몬스테라 삽수 어려움 무늬≥하프문 · 45일',
  ppSB: 'PP 보통 새 잎 분홍 마블↑ · 30일', ppHM: 'PP 어려움 새 잎 분홍 많음↑ · 45일(맨 위 분홍 0.35)',
  ppHM5: 'PP 어려움 새 잎 분홍 많음↑ · 45일(맨 위 분홍 0.5)',
  ppHM5x: 'PP 어려움 새 잎 분홍 많음만(분홍 잎 빼고) · 45일(맨 위 분홍 0.5)', al2: 'AL 보통 잎≥2(막 싹튼 1) · 30일' };
console.log(`\n③ 기한 — 새로 키워 맞추는 몫(자리마다 판 씨앗 평균 · 0~1) · «서는 자리» = 몫 ≥ 0.5 인 자리 수 / ${slots.length} · 괄호 = 가장 좋은 자리의 몫`);
const shop = {};
for (const [k, ko] of Object.entries(KINDS)) {
  shop[k] = {};
  const line = [];
  for (const open of OPENS) {
    shop[k][open] = {};
    const cells = LAMPS.map(l => {
      let n = 0, best = 0, bestSlot = null;
      const per = {};
      for (const sid of slots) {
        const m = mean(Array.from({ length: SEEDS }, (_, i) => tests[k](series[`${sid}|${l}|${open}|${i + 1}`])));
        per[sid] = +m.toFixed(2); if (m >= 0.5) n++; if (m > best) { best = m; bestSlot = sid; }
      }
      shop[k][open][l] = { feasibleSlots: n, best: +best.toFixed(2), bestSlot, per };
      return `${n}(${best.toFixed(2)})`;
    });
    line.push(`${open.padEnd(10)} ${cells.join('/')}`);
  }
  console.log(`   ${ko}`);
  for (const l of line) console.log(`      ${l}`);
}
const winterNone = [];
for (const k of Object.keys(KINDS)) for (const open of ['winter', 'lateAutumn']) {
  const maxN = Math.max(...LAMPS.map(l => shop[k][open][l].feasibleSlots));
  if (maxN === 0) winterNone.push(`${KINDS[k]} · ${open === 'winter' ? '겨울 첫날' : '가을 끝(겨울 낌)'}`);
}
console.log('\n⇒ 겨울에 «등을 다 켜도» 키워 맞출 자리가 없는 것:' + (winterNone.length ? '\n   ' + winterNone.join('\n   ') : ' 없음'));
console.log('   (몬스테라 화분 주문 — 보통 «가진 그루 중 가장 많은 잎 −1» · 어려움 «무늬 그루가 있을 때 산반↑» — 은 가진 그루로 바로 서므로 키우는 길이를 안 잰다 · al_corm 도)');

/* ══ ★ D71(2026-10-23 · 총괄) — 새 두 종: ④ 스킨답서스 «높은 자리» · ⑤ 칼라테아 «알맞은 자리» ══════════════════════
   자는 다 규칙에서 읽는다(손으로 안 베낌): R.isHighSpot · R.scStemCapM · R.longVineM · R.spotFit · R.bandOf · R.stepDay.
   ★ 떨어지는 높이(dropM) = house 가 지은 방의 자리 값(house.js dropBelow · 2b6cfc5a): 자리에서 판 끝까지 나가 아래 «첫 면»(없으면 바닥)까지.
     받침 높이(point.y)가 아니다 — 계단식 진열대 윗단(0.815)은 바로 아랫단에 닿아 0.25 다(총괄 10-23 정정). core 가 stepDay 에 넘기는 그 수.
     방은 노드에서 짓는다(gen_room_profile 과 같은 하네스 · light_adapter) — 지은 방의 빛 표가 얼린 프로필과 다르면 멈춘다(낡은 표로 안 잰다).
   ★ 벽 화분걸이(새 가구 · 가게에서 산다)는 기준 배치에 없다 — 걸이 자리마다(주문판 전용 자리 빼고) 하나씩 건 방을 «사본으로» 지어
     그 자리의 dropM 과 빛 줄을 얻는다(얼린 표는 안 고친다 · 걸어도 다른 자리 빛이 안 바뀌는지 본다). 자리마다 철별 60일 평균 DLI 표를 내고,
     longVineM 닿는 날은 WALL_SPOT(기본 tworoom-hang-sun — 총괄 10-23 (ㄱ) 창가 자리 · house 814a7456) 하나만 걷는다. */
const SC_SEEDS = Number(process.env.SC_SEEDS || 4), SC_H = Number(process.env.SC_H || 420), WALL_SPOT = process.env.WALL_SPOT || 'tworoom-hang-sun';
const live = await (async () => {
  const vm = await import('node:vm');
  const toUrl = (rel) => 'file:///' + path.join(ROOT, rel).split(path.sep).join('/');
  const stubCtx = () => new Proxy({}, { get: (t, k) => {
    if (k === 'createImageData' || k === 'getImageData') return (w = 1, h = 1) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h });
    if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop() {} });
    if (k === 'measureText') return () => ({ width: 0 });
    return () => {}; } });
  const stubEl = () => ({ style: {}, dataset: {}, appendChild() {}, setAttribute() {}, addEventListener() {}, getContext: () => stubCtx() });
  globalThis.document = { createElement: (t) => (t === 'canvas' ? { width: 1, height: 1, style: {}, getContext: () => stubCtx(), toDataURL: () => '' } : stubEl()),
    createElementNS: () => stubEl(), addEventListener() {}, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], body: stubEl(), documentElement: stubEl() };
  globalThis.window = globalThis; globalThis.self = globalThis;
  const re = console.error, rw = console.warn; console.error = () => {}; console.warn = () => {};
  vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'vendor', 'three', 'three.min.js'), 'utf8'));
  const { createLightEngine } = await import(toUrl('src/game/light_adapter.js'));
  const { hangPoseOf, hangSpotsOf } = await import(toUrl('src/game/hang_spots.js'));
  const HR = J('data/house_rooms.json'), FP = J('data/furniture_presets.json').presets;
  const eng = createLightEngine({ houseRooms: HR, winPresets: J('data/window_presets.json').presets, doorPresets: J('data/door_presets.json').presets,
    finishes: J('data/room_finishes.json'), furnPresets: FP, lightPresets: J('data/lighting_presets.json'), shadePresets: J('data/shading_presets.json'),
    lightTh: TH, weatherBalance: W });
  console.error = re; console.warn = rw;
  const rowsSame = (a, b) => a && b && a.ratio === b.ratio && JSON.stringify(a.ppfd) === JSON.stringify(b.ppfd);
  eng.build('tworoom');
  const drops = Object.fromEntries(eng.room.built.plantSlots.map(s => [s.slotId, { dropM: s.dropM, edgeM: s.dropEdgeM, dir: s.dropDir, houseHigh: s.high }]));
  const prof0 = eng.profile(LAMPS);
  const stale = prof0.slots.filter(s => !rowsSame(s, P.slots.find(x => x.slotId === s.slotId))).map(s => s.slotId);
  if (stale.length || prof0.slots.length !== P.slots.length) throw new Error(`[투룸] 지은 방의 빛 표가 얼린 프로필과 다르다(${stale.length}칸 · ${stale.slice(0, 3).join(' · ')}) — gen_room_profile --rooms=tworoom 로 먼저 맞출 것`);
  const preset = FP.wall_planter;
  if (!preset) throw new Error('[투룸] 가구 프리셋 wall_planter 가 없다(house D71)');
  const spots = hangSpotsOf(HR.rooms.tworoom).filter(s => !s.only);
  if (!spots.some(s => s.id === WALL_SPOT)) throw new Error(`[투룸] 걸이 자리 ${WALL_SPOT} 가 없다(있는 자리: ${spots.map(s => s.id).join(' · ')})`);
  const planters = [];
  for (const spot of spots) {
    eng.setFurnitureEdits([], [{ uid: 'probe-wall_planter', preset: 'wall_planter', ...hangPoseOf(spot, eng.room.built.size, preset.size_m || {}) }]);
    eng.build('tworoom');
    const ps = eng.room.built.plantSlots.find(s => s.slotId.startsWith('probe-wall_planter'));
    const prof1 = eng.profile(LAMPS), row = prof1.slots.find(s => s.slotId === (ps && ps.slotId));
    if (!ps || !row) throw new Error(`[투룸] ${spot.id} 에 건 화분걸이 자리를 못 찾았다`);
    const moved = prof1.slots.filter(s => s !== row && !rowsSame(s, P.slots.find(x => x.slotId === s.slotId))).map(s => s.slotId);
    planters.push({ slotId: ps.slotId, spot: spot.id, wall: spot.wall, cu: spot.cu, cy: spot.cy, dropM: ps.dropM, edgeM: ps.dropEdgeM, dir: ps.dropDir, houseHigh: ps.high, row, moved });
  }
  eng.setFurnitureEdits([], []);
  const planter = planters.find(x => x.spot === WALL_SPOT);
  return { drops, planters, planter, movedByPlanter: planter.moved };
})();
const PL = live.planter.slotId;
const dropOf = Object.fromEntries([...Object.entries(live.drops).map(([k, v]) => [k, v.dropM]), [PL, live.planter.dropM]]);
const P4 = { ...P, slots: [...P.slots, live.planter.row] };          // ④ 만 — 화분걸이를 건 방(사본)
const slots4 = [...slots, PL];
const highSlots = slots4.filter(sid => R.isHighSpot(dropOf[sid]));
const lowMax = Math.max(...slots.filter(sid => !R.isHighSpot(dropOf[sid])).map(sid => dropOf[sid]));
const houseDisagree = slots4.filter(sid => (live.drops[sid] ? live.drops[sid].houseHigh : live.planter.houseHigh) !== R.isHighSpot(dropOf[sid]));
console.log(`\n④ 스킨답서스 «높은 자리» — 떨어지는 높이(house dropM) ≥ ${J('data/growth_species.json').species.scindapsus.vine.high_spot_min_m}m · longVineM ${R.longVineM()}m(높은 자리에서만 닿는 길이)`);
console.log(`   기준 배치 높은 자리 ${highSlots.filter(s => s !== PL).length} / ${slots.length}: ${highSlots.filter(s => s !== PL).map(sid => `${sid.replace('tworoom-', '')}(${dropOf[sid]})`).join(' · ') || '없음'}`);
console.log(`   + 벽 화분걸이(${live.planter.spot} 에 하나 건 사본) dropM ${live.planter.dropM} → ${R.isHighSpot(live.planter.dropM) ? '높은 자리' : '낮은 자리'} · 걸어서 빛이 바뀐 다른 자리 ${live.movedByPlanter.length}`);
console.log(`   낮은 자리 가운데 가장 큰 dropM ${lowMax}m → 상한 ${R.scStemCapM(lowMax)}m < ${R.longVineM()}m · 받침 높이로는 높아 보이나 낮은 자리: ${slots.filter(sid => P.slots.find(x => x.slotId === sid).point.y >= 0.75 && !R.isHighSpot(dropOf[sid])).map(sid => `${sid.replace('tworoom-', '')}(받침 ${P.slots.find(x => x.slotId === sid).point.y} · 떨어짐 ${dropOf[sid]})`).join(' · ') || '없음'}`);
if (houseDisagree.length) console.log(`   ⚠ house 의 high(HIGH_DROP_M)와 growth 문턱이 다르게 가르는 자리 ${houseDisagree.length}: ${houseDisagree.join(' · ')}`);
/* 벽 화분걸이 자리마다 — 그 자리에 하나 건 사본의 철 첫날부터 60일 평균 DLI(판 씨앗 SC_SEEDS 평균) · 스킨답서스 밴드 */
const thSC = R.thresholdsOf(R.newPlant('scindapsus'));
const wallTable = live.planters.map(pw => {
  const PW = { ...P, slots: [...P.slots, pw.row] }, seasons = {};
  for (const open of ['spring', 'summer', 'autumn', 'winter']) {
    seasons[open] = {};
    for (const l of LAMPS) {
      const v = [];
      for (let seed = 1; seed <= SC_SEEDS; seed++) {
        const light = createProfileLight({ ...PW, uidStable: true }, { thresholds: TH, weather: W, electricity: E });
        const y0 = SEASON_START[open] + (seed - 1) * 360; let acc = 0;
        for (let d = 1; d <= H; d++) acc += light.daily(d, { sim: { mode: 'real', yearDay0: y0 - 1, seed }, lamps: { count: l, litHours: 12 }, pots: [], placedItems: [] }).report.slots.find(s => s.slotId === pw.slotId).dli;
        v.push(acc / H);
      }
      const m = mean(v), j = judgeDLI(m, thSC);
      seasons[open][l] = { dli: +m.toFixed(2), band: j.band, ko: j.ko };
    }
  }
  return { spot: pw.spot, wall: pw.wall, cu: pw.cu, cy: pw.cy, dropM: pw.dropM, high: R.isHighSpot(pw.dropM), movedOthers: pw.moved.length, seasons };
});
console.log(`   벽 화분걸이 자리마다(하나씩 건 사본) — 철 첫날부터 ${H}일 평균 DLI · 등 ${LAMPS.join('/')} · [스킨답서스 밴드: 문턱 die ${thSC.die} · survive ${thSC.survive} · min ${thSC.min} · best ${thSC.best_lo}]`);
for (const w of wallTable)
  console.log(`      ${w.spot.replace('tworoom-', '').padEnd(9)} ${w.wall.padEnd(5)} cu ${String(w.cu).padEnd(5)} cy ${w.cy} dropM ${w.dropM}${w.high ? '(높음)' : ''} · ` +
    ['spring', 'summer', 'autumn', 'winter'].map(o => `${o.slice(0, 2)} ` + LAMPS.map(l => w.seasons[o][l].dli).join('/') + `(${w.seasons[o][LAMPS[LAMPS.length - 1]].ko})`).join('  '));
/* 높은 자리에서 뿌리 낸 줄기(마디 둘)가 longVineM 에 닿는 날 — 그 자리 빛(real · 등 0~N) · 철 첫날에 뿌리 */
const scReach = {};
for (const sid of highSlots) scReach[sid] = {};
for (const lamps of LAMPS) for (const open of ['spring', 'summer', 'autumn', 'winter']) {
  const days = Object.fromEntries(highSlots.map(sid => [sid, []]));
  for (let seed = 1; seed <= SC_SEEDS; seed++) {
    const light = createProfileLight({ ...P4, uidStable: true }, { thresholds: TH, weather: W, electricity: E });
    const y0 = SEASON_START[open] + (seed - 1) * 360 + 7;          // 다른 판 씨앗 해 · ②③ 창과 겹치지 않게 7일 밀어 시작
    const pl = Object.fromEntries(highSlots.map(sid => [sid, R.newPlant('scindapsus', { seed: 100 + seed, form: 'rooted' })]));
    const got = {};
    for (let d = 1; d <= SC_H && Object.keys(got).length < highSlots.length; d++) {
      const rep = light.daily(d, { sim: { mode: 'real', yearDay0: y0 - 1, seed }, lamps: { count: lamps, litHours: 12 }, pots: [], placedItems: [] }).report;
      const se = seasonOf(y0 - 1 + d);
      for (const s of rep.slots || []) {
        if (!pl[s.slotId] || got[s.slotId]) continue;
        R.stepDay(pl[s.slotId], { dli: s.dli, season: se, dropM: dropOf[s.slotId] });
        if (pl[s.slotId].lengthM >= R.longVineM()) got[s.slotId] = d;
      }
    }
    for (const sid of highSlots) days[sid].push(got[sid] ?? null);
  }
  for (const sid of highSlots) {
    const ok = days[sid].filter(x => x != null);
    scReach[sid][open] = scReach[sid][open] || {};
    scReach[sid][open][lamps] = { reached: ok.length, of: SC_SEEDS, meanDays: ok.length ? Math.round(mean(ok)) : null, maxDays: ok.length ? Math.max(...ok) : null };
  }
}
console.log(`   뿌리 낸 줄기(마디 2)가 longVineM 에 닿는 날 — 철 첫날 뿌리 · 판 씨앗 ${SC_SEEDS} 평균(닿은 판/모든 판) · ${SC_H}일 안 · 등 ${LAMPS.join('/')}`);
for (const sid of highSlots) {
  const cells = ['spring', 'summer', 'autumn', 'winter'].map(open => `${open.slice(0, 2)} ` + LAMPS.map(l => { const c = scReach[sid][open][l]; return c.meanDays == null ? `—(0/${c.of})` : `${c.meanDays}${c.reached < c.of ? `(${c.reached}/${c.of})` : ''}`; }).join('/'));
  console.log(`      ${sid.replace('tworoom-', '').padEnd(28)} ${cells.join('  ')}`);
}

/* ⑤ 칼라테아 — 철 첫날부터 60일 · avg7 로 판정(규칙과 같은 자) · «알맞은 자리» = 알맞은(fit) 날 몫 ≥ 0.5 */
const CB = R.bandOf('calathea');
const caFit = {};
const avg7Of = (arr) => arr.map((_, i) => { const w = arr.slice(Math.max(0, i - 6), i + 1); return w.reduce((x, y) => x + y, 0) / w.length; });
for (const open of ['spring', 'summer', 'autumn', 'winter']) {
  caFit[open] = {};
  for (const l of LAMPS) {
    const per = {}; let fit = 0, over = 0, unf = [], saves = 0;
    for (const sid of slots) {
      const share = { fit: 0, over: 0, slow: 0, dark: 0 }; const ud = [];
      for (let seed = 1; seed <= SEEDS; seed++) {
        const v = series[`${sid}|${l}|${open}|${seed}`];
        for (const a of avg7Of(v.dli)) share[R.spotFit('calathea', a)]++;
        /* 맡은 칼라테아(잎 다 말림)를 이 자리에 두면 며칠에 다 펴지나(규칙을 그대로 걷는다) */
        const c = R.newPlant('calathea', { seed, leaves: 5, curled: 'all' }); let at = null;
        for (let d = 1; d <= H && at == null; d++) for (const e of R.stepDay(c, { dli: v.dli[d - 1], season: v.season[d - 1] })) if (e.type === 'unfurled_all') at = d;
        ud.push(at);
      }
      const tot = SEEDS * H;
      for (const k of Object.keys(share)) share[k] = +(share[k] / tot).toFixed(2);
      const okd = ud.filter(x => x != null);
      per[sid] = { ...share, unfurlDays: okd.length ? Math.round(mean(okd)) : null, unfurledRuns: okd.length };
      if (share.fit >= 0.5) { fit++; if (okd.length) unf.push(Math.round(mean(okd))); }
      if (share.over >= 0.5) over++;
      if (okd.length * 2 >= SEEDS) saves++;                                 // 느림(lo 밑)이어도 펴진다 — 맡은 그루를 살릴 수 있는 자리
    }
    caFit[open][l] = { fitSlots: fit, overSlots: over, saveSlots: saves, unfurlDaysAtFit: unf.length ? [Math.min(...unf), Math.max(...unf)] : null, per };
  }
}
console.log(`\n⑤ 칼라테아 «알맞은 자리» — 대역 [${CB.lo}, ${CB.hi}] DLI(avg7) · 알맞은 날 몫 ≥ 0.5 인 자리 수 / ${slots.length} · [너무 밝은 자리 수] · {맡은 그루가 ${H}일 안에 다 펴지는 자리 수 — 느림 자리 포함} · (다 펴지는 날 — 알맞은 자리들 가장 빠름~늦음)`);
for (const open of ['spring', 'summer', 'autumn', 'winter'])
  console.log(`   ${open.padEnd(7)} ` + LAMPS.map(l => { const c = caFit[open][l]; return `등${l} ${c.fitSlots}[${c.overSlots}]{${c.saveSlots}}${c.unfurlDaysAtFit ? `(${c.unfurlDaysAtFit.join('~')}일)` : ''}`; }).join('  '));
const d71 = { highSpotMinM: J('data/growth_species.json').species.scindapsus.vine.high_spot_min_m, longVineM: R.longVineM(), lowMaxDropM: lowMax,
  dropSource: 'house.js dropBelow(2b6cfc5a) — 노드에서 지은 투룸(light_adapter) · 빛 표는 얼린 프로필과 같음을 확인',
  slots: slots4.map(sid => ({ slot: sid, baseY: (P4.slots.find(x => x.slotId === sid) || {}).point.y, dropM: dropOf[sid],
    edgeM: (live.drops[sid] || live.planter).edgeM, dir: (live.drops[sid] || live.planter).dir, high: R.isHighSpot(dropOf[sid]), capM: R.scStemCapM(dropOf[sid]) })),
  planter: { spot: live.planter.spot, slot: PL, dropM: live.planter.dropM, row: live.planter.row, movedOthers: live.movedByPlanter }, wallTable,
  highSlots, houseDisagree, scReach, scSeeds: SC_SEEDS, scWindow: SC_H, caBand: CB, caFit,
  note: '⑤ 칼라테아 표는 기준 배치(화분걸이 없음)만 · ④ 는 화분걸이 하나 건 사본까지' };
if (process.env.OUT) fs.writeFileSync(path.join(ROOT, process.env.OUT), JSON.stringify({ meta: { profile: FILE, roomRev: P.roomRev || null, generatedAt: P.generatedAt || null,
  lampCounts: LAMPS, seeds: SEEDS, ppRuns: PP_RUNS, due: DUE, opens: SEASON_START, window: H, kinds: KINDS }, light: lightRows, shop, winterNone, d71 }, null, 1));
