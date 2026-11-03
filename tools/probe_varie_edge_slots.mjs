/* ============================================================
   tools/probe_varie_edge_slots.mjs — «밝음 가장자리»(지난 7일 평균 DLI 5.0~7.0) 칸에 드는 자리를 방 · 철 · 등 수마다 센다
   ([growth] · 2026-11-04 · 총괄 «장비 캐논 — 밝음 등급인데 무늬는 중간빛과 같다»)
   ------------------------------------------------------------
     node tools/probe_varie_edge_slots.mjs                       (서버 · 브라우저 필요 없음)
     SEEDS=1-10 YEARS=2 ROOMS=banjiha,oneroom,tworoom OUT=<json> node tools/probe_varie_edge_slots.mjs
   왜: 무늬 등급의 «밝음»은 생장 띠 best · good · over(일반 몬스테라 문턱 best_lo 5.0 ~)이고,
       무늬 날 확률의 최적 배율 1.5 는 best_lo × need_mult(5.0 × 1.4 = 7.0) ~ best_hi × 1.4 에서만 선다.
       그 사이 5.0~7.0 은 «밝음 등급인데 무늬 확률 배율은 중간빛(0.5)과 같은» 칸이다. 장비 캐논(mid + 장비 < bright 맨손)이
       이 칸에서 L2 ×1.2 + L3 30% 에 어긋났다(growth-equip-sensitivity ⑩). 이 칸에 드는 자리가 흔한가를 센다.
   잰다(게임과 같은 조도 엔진 light_adapter · probe_oneroom_sill_seasons 와 같은 판):
     A 기대 DLI — 맑은 날 자연광 × weatherE(철) + 등(날씨 안 탐) · litHours 12 · 자리 하나씩(placeVerdict 에 한 점 · count-slots-one-by-one)
     B 걸어서 — skyFor(day, sim real · yearDay0) 철 · 날씨로 그날 DLI → 지난 7일 평균 → 칸으로 가름 · 날은 skyFor 철로 묶음
   칸(지난 7일 평균 d): 어둠 d < min(2.7) · 중간 min ≤ d < best_lo(5.0) · ★가장자리 5.0 ≤ d < best_lo × need_mult(7.0) · 밝음 최적 7.0 ~ 15.4 · 그 위
   문턱은 정본에서 읽는다(data/balance/light_thresholds.json monstera_deliciosa · variegated.need_mult). ⚠ 값을 하나도 안 바꾼다.
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
const { weatherE, DAYS_PER_SEASON } = await imp('src/engine/weather.js');
const { yearDay0Of } = await imp('src/game/tutorial.js');
console.warn = warn;

const FP = dataOf('furniture_presets.json').presets;
const D = { winPresets: dataOf('window_presets.json').presets, doorPresets: dataOf('door_presets.json').presets, finishes: dataOf('room_finishes.json'),
            lightPresets: dataOf('lighting_presets.json'), shadePresets: dataOf('shading_presets.json'),
            lightTh: dataOf('balance/light_thresholds.json'), weatherBalance: dataOf('balance/weather.json') };
const H0 = dataOf('house_rooms.json');
const TH = D.lightTh.plants.monstera_deliciosa, NM = D.lightTh.variegated.need_mult;
const EDGE_LO = TH.best_lo, EDGE_HI = +(TH.best_lo * NM).toFixed(4), OPT_HI = +(TH.best_hi * NM).toFixed(4);
const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
const KO = { spring: '봄', summer: '여름', autumn: '가을', winter: '겨울' };
const LIT = 12;
const range = s => String(s).split(',').flatMap(t => { const m = t.match(/^(\d+)-(\d+)$/); return m ? [...Array(+m[2] - +m[1] + 1)].map((_, i) => +m[1] + i) : [+t]; });
const SEEDS = range(process.env.SEEDS || '1-10'), YEARS = +(process.env.YEARS || 2);
const ROOMS = (process.env.ROOMS || 'banjiha,oneroom,tworoom').split(',');
const OUT = process.env.OUT || null;
const Y0 = yearDay0Of();
const r2 = v => +v.toFixed(2);
const cellOf = d => d < TH.min ? 'dark' : d < EDGE_LO ? 'mid' : d < EDGE_HI ? 'edge' : d <= OPT_HI ? 'opt' : 'high';
const CK = { dark: '어둠', mid: '중간', edge: '★가장자리', opt: '밝음 최적', high: '그 위' };
console.log(`칸 — 어둠 < ${TH.min} · 중간 ${TH.min}~${EDGE_LO} · ★가장자리 ${EDGE_LO}~${EDGE_HI} · 밝음 최적 ${EDGE_HI}~${OPT_HI} · 그 위 > ${OPT_HI} (monstera_deliciosa · need_mult ${NM})`);
console.log(`씨앗 ${SEEDS.length} × ${YEARS}해 · 게임 0일 = 연중 ${Y0}일 · 등 ${LIT}시간 · 지난 7일 평균`);

const variants = [];
for (const rid of ROOMS) {
  const R = H0.rooms[rid]; if (!R) { console.log(`없는 방 ${rid}`); continue; }
  variants.push({ rid, key: rid, ko: `${rid} 기본 가구`, add: [] });
  if (R.reference_layout && Array.isArray(R.reference_layout.furniture)) variants.push({ rid, key: rid + '_layoutD', ko: `${rid} 기준 배치 D`, add: R.reference_layout.furniture });
}
const out = { args: { seeds: SEEDS, years: YEARS, yearDay0: Y0, litHours: LIT, cells: { dark: [0, TH.min], mid: [TH.min, EDGE_LO], edge: [EDGE_LO, EDGE_HI], opt: [EDGE_HI, OPT_HI], high: [OPT_HI, null] } }, rooms: {} };
for (const V of variants) {
  const H = JSON.parse(JSON.stringify(H0)); H.rooms[V.rid].furniture = [...H0.rooms[V.rid].furniture, ...V.add];
  console.warn = () => {}; const eng = createLightEngine({ houseRooms: H, furnPresets: FP, ...D }); eng.build(V.rid); console.warn = warn;
  const slots = eng.room.slots.slice().sort((a, b) => a.slotId.localeCompare(b.slotId));
  const rigs = (eng.room.growRigs || []).map(r => r.uid || r.id);
  const LAMPS = [...Array(rigs.length + 1).keys()];
  const DAYS = DAYS_PER_SEASON * 4 * YEARS;
  const memo = new Map();
  const dli = (sid, w, ss, n) => { const k = sid + '|' + w + '|' + ss + '|' + n; let v = memo.get(k); if (v === undefined) { v = eng.dliOfSlot(sid, { weather: w, season: ss, lampCount: n, litHours: LIT }); memo.set(k, v); } return v; };
  const R = { ko: V.ko, rigs, slots: slots.map(s => s.slotId), byLamps: {} };
  console.log(`\n■ ${V.ko} — 자리 ${slots.length} · 등 차례 ${rigs.map((u, i) => `${i + 1}=${u}`).join(' · ') || '없음'}`);
  for (const n of LAMPS) {
    const per = {};    // slot → season → { cells, sum, days, exp }
    for (const s of slots) { per[s.slotId] = {}; for (const ss of SEASONS) { const o = eng.dliAt(s, { weather: 'clear', season: ss, litHours: LIT, lampCount: n, occIdx: s.occIdx ?? null }); per[s.slotId][ss] = { cells: { dark: 0, mid: 0, edge: 0, opt: 0, high: 0 }, sum: 0, days: 0, exp: r2((o.dli_daylight ?? 0) * weatherE(ss) + (o.dli_lamp ?? 0)) }; } }
    for (const seed of SEEDS) {
      const sim = { mode: 'real', seed, yearDay0: Y0 };
      const sky = [...Array(DAYS + 6)].map((_, d) => eng.skyFor(d, sim));
      for (const s of slots) {
        const daily = sky.map(k => dli(s.slotId, k.weather, k.season, n));
        for (let d = 6; d < DAYS + 6; d++) { let sum = 0; for (let k = 0; k < 7; k++) sum += daily[d - k]; const a = sum / 7, P = per[s.slotId][sky[d].season]; P.cells[cellOf(a)]++; P.sum += a; P.days++; }
      }
    }
    const row = { seasons: {} };
    for (const ss of SEASONS) {
      const list = slots.map(s => { const P = per[s.slotId][ss]; return { slotId: s.slotId, mean7: r2(P.sum / P.days), exp: P.exp, pct: Object.fromEntries(Object.entries(P.cells).map(([c, v]) => [c, +(100 * v / P.days).toFixed(1)])) }; });
      const edgeMean = list.filter(x => x.mean7 >= EDGE_LO && x.mean7 < EDGE_HI).length;
      const edgeHalf = list.filter(x => x.pct.edge >= 50).length;
      const brightSlotDays = list.reduce((a, x) => a + x.pct.edge + x.pct.opt + x.pct.high, 0), edgeSlotDays = list.reduce((a, x) => a + x.pct.edge, 0);
      const midMean = list.filter(x => x.mean7 >= TH.min && x.mean7 < EDGE_LO).length, optMean = list.filter(x => x.mean7 >= EDGE_HI).length;
      const edge10 = list.filter(x => x.pct.edge >= 10);
      row.seasons[ss] = { slots: list.length, edgeByMean: edgeMean, edgeHalfDays: edgeHalf, edge10Days: edge10.length, midByMean: midMean, brightOptByMean: optMean,
                          edge10: edge10.map(x => `${x.slotId.replace(/^[a-z]+-/, '')} 가 ${x.pct.edge}% · 최적 ${x.pct.opt}% · 평균 ${x.mean7}`),
                          edgeShareOfBrightDays: brightSlotDays ? +(100 * edgeSlotDays / brightSlotDays).toFixed(1) : null,
                          edgeSlots: list.filter(x => x.mean7 >= EDGE_LO && x.mean7 < EDGE_HI).map(x => `${x.slotId}(${x.mean7})`), list };
    }
    R.byLamps[n] = row;
    console.log(`  등 ${n}:`);
    for (const ss of SEASONS) { const z = row.seasons[ss]; console.log(`    ${KO[ss]}  평균이 가장자리 ${z.edgeByMean}/${z.slots} · 가장자리 날 ≥10% 자리 ${z.edge10Days} · ≥50% ${z.edgeHalfDays} · 평균 중간 ${z.midByMean} · 평균 최적 이상 ${z.brightOptByMean} · 밝음 날 중 가장자리 ${z.edgeShareOfBrightDays ?? '—'}%${z.edge10.length ? '  [' + z.edge10.join(' | ') + ']' : ''}`); }
  }
  out.rooms[V.key] = R;
}
if (OUT) { fs.writeFileSync(path.resolve(OUT), JSON.stringify(out, null, 1) + '\n'); console.log(`\n→ ${OUT}`); }
