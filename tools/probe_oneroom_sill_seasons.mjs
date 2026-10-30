/* ============================================================
   tools/probe_oneroom_sill_seasons.mjs — 원룸 창턱 받침 넷(oneroom-sill:0~3)의 철별 DLI([growth] · 2026-10-31 · 총괄 «chatOneroomBright 조건»)
   ------------------------------------------------------------
     node tools/probe_oneroom_sill_seasons.mjs                 (서버 · 브라우저 필요 없음)
     SEEDS=1-20 YEARS=3 CODE="HEAD …" OUT=docs/handoff/growth-oneroom-sill-seasons.json node tools/probe_oneroom_sill_seasons.mjs
   왜: 대사 chatOneroomBright «거기 넷은 등 없이도 자라»의 조건을 plan 이 정한다. 있던 값은 여름 · 겨울 둘뿐
       (house-place-freedom-20261008 · 겨울 등0 1.5~1.6 < 몬스테라 2.7)이라 봄 · 가을을 몰랐다.
   잰다(게임과 같은 조도 엔진 light_adapter · game.html §io.light 와 같은 판):
     A 기대 DLI — light_adapter §placeVerdict 와 같은 셈: 맑은 날 자연광 × weatherE(철) + 등(날씨 안 탐) · litHours 12(state §lamps 기본)
       방은 둘 — 이사 직후(창턱 받침 + 등 자리 셋) · 기준 배치 D(house_rooms §oneroom.reference_layout)
       등 n 개 = rigsOn 차례 앞에서부터(바 → 집게 → 거치) · 등 1 = 바(oneroom-growlight-bar · 붙박이 · 창턱 위)
     B 걸어서 — 게임 날마다 light_adapter §skyFor(day, sim)(sim.mode real · yearDay0 = tutorial §yearDay0Of)의 철 · 날씨로
       그날 DLI(dliOfSlot)를 내고 plant_grow §growthBlockReason 과 같은 «지난 7일 평균»으로 가른다. 날은 skyFor 의 철로 묶는다(seasonOf(day) 아님)
     C 하네스 표 대조 — byeot_harness 가 쓰는 room_profile.oneroom 표(createProfileLight)의 맑은 날 값이 엔진과 같은가
     D 이사 날 철 — docs/handoff/growth-d91-personas.json 의 이사 날 · 500만 원 닿는 날을 skyFor 로 철에 놓는다
   문턱은 정본에서 읽는다: 몬스테라 = data/growth_tuning.json thresholds.min · 무늬 삽수 = min × variegated.need_mult(propagation · D57)
   ⚠ 값을 하나도 안 바꾼다. data/** 는 읽기만 한다.
   판정(exit 1): 창턱 넷이 방에 없음 · 문턱 정본이 두 파일에서 다름 · 하네스 표가 엔진과 0.05 넘게 다름
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
const { createProfileLight } = await imp('src/game/room_profile.js');
const { weatherE, DAYS_PER_SEASON } = await imp('src/engine/weather.js');
const { yearDay0Of } = await imp('src/game/tutorial.js');
console.warn = warn;

const FP = dataOf('furniture_presets.json').presets;
const D = { winPresets: dataOf('window_presets.json').presets, doorPresets: dataOf('door_presets.json').presets, finishes: dataOf('room_finishes.json'),
            lightPresets: dataOf('lighting_presets.json'), shadePresets: dataOf('shading_presets.json'),
            lightTh: dataOf('balance/light_thresholds.json'), weatherBalance: dataOf('balance/weather.json') };
const H0 = dataOf('house_rooms.json'); const R0 = H0.rooms.oneroom;
const GT = dataOf('growth_tuning.json');
const TH_MIN = GT.thresholds.min, TH_CUT_V = +(GT.thresholds.min * GT.variegated.need_mult).toFixed(4);
const LT_MON = (D.lightTh.plants || {}).monstera_deliciosa || null;
const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
const KO = { spring: '봄', summer: '여름', autumn: '가을', winter: '겨울' };
const LIT = 12, LAMPS = [0, 1, 2, 3];
const range = s => String(s).split(',').flatMap(t => { const m = t.match(/^(\d+)-(\d+)$/); return m ? [...Array(+m[2] - +m[1] + 1)].map((_, i) => +m[1] + i) : [+t]; });
const SEEDS = range(process.env.SEEDS || '1-20'), YEARS = +(process.env.YEARS || 3);
const OUT = process.env.OUT || null;
const Y0 = yearDay0Of();
const r2 = v => +v.toFixed(2);
let fail = 0;

/* 문턱 정본 둘이 같은가(growth_tuning ↔ light_thresholds) */
if (LT_MON && Number.isFinite(LT_MON.min) && LT_MON.min !== TH_MIN) { fail++; console.log(`FAIL  몬스테라 min 이 둘: growth_tuning ${TH_MIN} · light_thresholds ${LT_MON.min}`); }
console.log(`문턱 — 몬스테라(그루 · 무늬 모주 포함) ${TH_MIN} · 무늬 삽수 ${TH_CUT_V}(= ${TH_MIN} × ${GT.variegated.need_mult}) · 판정은 지난 7일 평균(plant_grow §growthBlockReason)`);
console.log(`게임 0일 = 연중 ${Y0}일(tutorial §yearDay0Of) · 철 길이 ${DAYS_PER_SEASON}일 · 등 켜는 시간 ${LIT}시간`);

const build = add => { const H = JSON.parse(JSON.stringify(H0)); H.rooms.oneroom.furniture = [...R0.furniture, ...add]; const eng = createLightEngine({ houseRooms: H, furnPresets: FP, ...D }); eng.build('oneroom'); return eng; };
const ROOMS = { move: { ko: '이사 직후(창턱 받침 + 등 자리 셋)', eng: build([]) }, layoutD: { ko: '기준 배치 D', eng: build(R0.reference_layout.furniture) } };
const sillsOf = eng => eng.room.slots.filter(s => /^oneroom-sill:\d$/.test(s.slotId)).sort((a, b) => a.slotId.localeCompare(b.slotId));
const rigNames = ROOMS.move.eng.room.growRigs.map(r => r.uid || r.id);
console.log(`등 차례(rigsOn): ${rigNames.map((u, i) => `${i + 1}=${u}`).join(' · ')}`);

/* A 기대 DLI — placeVerdict 셈 */
const expOf = (eng, s, season, n) => { const o = eng.dliAt(s, { weather: 'clear', season, litHours: LIT, lampCount: n, occIdx: s.occIdx ?? null });
  return { day: o.dli_daylight ?? 0, lamp: o.dli_lamp ?? 0, exp: (o.dli_daylight ?? 0) * weatherE(season) + (o.dli_lamp ?? 0) }; };
const mark = v => v >= TH_CUT_V ? '◎' : v >= TH_MIN ? '○' : '×';
const out = { args: { code: process.env.CODE || null, seeds: SEEDS, years: YEARS, yearDay0: Y0, litHours: LIT, thresholds: { monstera: TH_MIN, varieCutting: TH_CUT_V },
                      weatherE: Object.fromEntries(SEASONS.map(s => [s, r2(weatherE(s))])), rigs: rigNames,
                      mark: '◎ ≥ 무늬 삽수 문턱 · ○ ≥ 몬스테라 문턱 · × 둘 다 밑' },
              expected: {}, walked: {}, profileCheck: [], arrival: {} };
for (const [rk, R] of Object.entries(ROOMS)) {
  const sills = sillsOf(R.eng);
  if (sills.length !== 4) { fail++; console.log(`FAIL  ${R.ko} 창턱 받침 ${sills.length}칸(4칸이어야)`); continue; }
  console.log(`\n■ A 기대 DLI — ${R.ko} · 맑은 날 자연광 × weatherE(철) + 등 · ${out.args.mark}`);
  console.log(`  weatherE: ${SEASONS.map(s => `${KO[s]} ${weatherE(s).toFixed(3)}`).join(' · ')}`);
  console.log(`  ${'자리'.padEnd(16)} ${SEASONS.map(s => `${KO[s]} 등0 / 1 / 2 / 3`.padEnd(30)).join('')}`);
  out.expected[rk] = { ko: R.ko, slots: {} };
  for (const s of sills) {
    const row = {}; let line = `  ${s.slotId.padEnd(16)} `;
    for (const ss of SEASONS) {
      row[ss] = {}; const cells = [];
      for (const n of LAMPS) { const e = expOf(R.eng, s, ss, n); row[ss][n] = { exp: r2(e.exp), clearDaylight: r2(e.day), lamp: r2(e.lamp) }; cells.push(`${e.exp.toFixed(2)}${mark(e.exp)}`); }
      line += cells.join(' ').padEnd(30);
    }
    out.expected[rk].slots[s.slotId] = row;
    console.log(line);
  }
}
const sameRoom = Object.keys(out.expected.move.slots).every(id => SEASONS.every(ss => LAMPS.every(n =>
  Math.abs(out.expected.move.slots[id][ss][n].exp - ((out.expected.layoutD.slots[id] || {})[ss] || {})[n]?.exp) < 0.005)));
console.log(`\n  두 방의 창턱 값이 같은가(가구가 창턱 빛을 가리나): ${sameRoom ? '같다 — 기준 배치 D 가구는 창턱을 안 가린다' : '다르다 — 위 두 표를 따로 읽을 것'}`);

/* C 하네스 표 대조 */
{
  const p = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/profiles/room_profile.oneroom.json'), 'utf8'));
  console.warn = () => {};
  let PL = null; try { PL = createProfileLight(p.uidStable === true ? p : { ...p, uidStable: true }, { lightTh: D.lightTh, weatherBalance: D.weatherBalance }); } finally { console.warn = warn; }
  const eng = ROOMS.move.eng; let worst = 0, missing = 0;
  for (const s of sillsOf(eng)) for (const ss of SEASONS) for (const n of [0, 1]) for (const w of ['clear', 'cloudy', 'rain']) {
    const a = eng.dliOfSlot(s.slotId, { weather: w, season: ss, lampCount: n, litHours: LIT });
    let b = null; try { b = PL.dliOfSlot(s.slotId, { weather: w, season: ss, lampCount: n, litHours: LIT }); } catch { b = null; }
    if (!Number.isFinite(b)) { missing++; continue; }
    worst = Math.max(worst, Math.abs(a - b));
    if (w === 'clear') out.profileCheck.push({ slotId: s.slotId, season: ss, lamps: n, engine: r2(a), profile: r2(b) });
  }
  console.log(`\n■ C 하네스 표(room_profile.oneroom) 대조 — 창턱 넷 × 철 넷 × 등 0·1 × 날씨 셋: 가장 큰 차 ${worst.toFixed(3)}${missing ? ` · 표에 없는 칸 ${missing}` : ''}`);
  out.profileCheckWorst = r2(worst); out.profileMissing = missing;
  if (worst > 0.05) { fail++; console.log(`FAIL  하네스 표가 엔진과 ${worst.toFixed(3)} 다르다 — byeot_harness 판의 원룸 값이 화면과 갈린다`); }
}

/* B 걸어서 — skyFor 철 · 날씨 · 지난 7일 평균 */
{
  const eng = ROOMS.move.eng, sills = sillsOf(eng);
  const DAYS = DAYS_PER_SEASON * 4 * YEARS;
  const acc = {};   // slotId → n → season → { days, g, v, min, sumDaily, sumAvg }
  const runs = {};  // slotId → n → season → [{ seed, start, len }] — 7일 평균이 몬스테라 문턱 밑으로 이어진 날
  for (const s of sills) { acc[s.slotId] = {}; for (const n of [0, 1]) { acc[s.slotId][n] = {}; for (const ss of SEASONS) acc[s.slotId][n][ss] = { days: 0, g: 0, v: 0, min: Infinity, max: -Infinity, sumDaily: 0, sumAvg: 0, worstRun: 0 }; } }
  for (const seed of SEEDS) {
    const sim = { mode: 'real', seed, yearDay0: Y0 };
    const sky = [...Array(DAYS + 6)].map((_, d) => eng.skyFor(d, sim));
    for (const s of sills) for (const n of [0, 1]) {
      const daily = sky.map(k => eng.dliOfSlot(s.slotId, { weather: k.weather, season: k.season, lampCount: n, litHours: LIT }));
      let run = 0;
      for (let d = 6; d < DAYS + 6; d++) {
        let sum = 0; for (let k = 0; k < 7; k++) sum += daily[d - k];
        if (sky[d].season !== sky[d - 1].season) run = 0;   /* 이어진 날은 철 안에서만 센다 */
        const a = sum / 7, A = acc[s.slotId][n][sky[d].season];
        A.days++; A.sumDaily += daily[d]; A.sumAvg += a; A.min = Math.min(A.min, a); A.max = Math.max(A.max, a);
        if (a >= TH_MIN) A.g++; if (a >= TH_CUT_V) A.v++;
        if (a < TH_MIN) { run++; A.worstRun = Math.max(A.worstRun, run); } else run = 0;
      }
    }
  }
  console.log(`\n■ B 걸어서 — 이사 직후 방 · 씨앗 ${SEEDS.length}개 × ${YEARS}해 · 날은 skyFor 철로 묶음 · 지난 7일 평균 기준`);
  console.log(`  칸: 평균 7일평균 [최저~최고] · 몬스테라 자라는 날 % · 무늬 삽수 자라는 날 % · 몬스테라 문턱 밑으로 그 철 안에서 가장 길게 이어진 날`);
  console.log(`  ⚠ weatherE 가 네 철 모두 ${weatherE('summer').toFixed(3)} 인 것은 light_adapter 가 weather.json 확률 하나를 네 철에 똑같이 싣기 때문이다(setWeatherProbs). 철이 가르는 것은 자연광 계수다`);
  for (const n of [0, 1]) {
    console.log(`  — 등 ${n}${n ? ` (${rigNames[0]})` : ''}`);
    for (const s of sills) {
      const row = {}; let line = `  ${s.slotId.padEnd(16)} `;
      for (const ss of SEASONS) {
        const A = acc[s.slotId][n][ss];
        row[ss] = { days: A.days, meanDaily: r2(A.sumDaily / A.days), meanAvg7: r2(A.sumAvg / A.days), minAvg7: r2(A.min), maxAvg7: r2(A.max),
                    monsteraGrowPct: +(100 * A.g / A.days).toFixed(1), varieCutGrowPct: +(100 * A.v / A.days).toFixed(1), longestShortRun: A.worstRun };
        line += `${KO[ss]} ${row[ss].meanAvg7.toFixed(2)}[${row[ss].minAvg7.toFixed(2)}~${row[ss].maxAvg7.toFixed(2)}] ${String(Math.round(row[ss].monsteraGrowPct)).padStart(3)}%·${String(Math.round(row[ss].varieCutGrowPct)).padStart(3)}% ${String(A.worstRun).padStart(2)}일  `;
      }
      ((out.walked[n] = out.walked[n] || {}))[s.slotId] = row;
      console.log(line);
    }
  }
}

/* D 이사 날 철 — D91 하네스 판의 이사 날 · 500만 원 닿는 날 */
{
  const f = path.join(ROOT, 'docs/handoff/growth-d91-personas.json');
  if (fs.existsSync(f)) {
    const J = JSON.parse(fs.readFileSync(f, 'utf8'));
    const seasonAt = d => ROOMS.move.eng.skyFor(d, { mode: 'real', seed: 1, yearDay0: Y0 }).season;
    console.log(`\n■ D 이사 날 철 — ${path.relative(ROOT, f).replace(/\\/g, '/')} (${(J.args && J.args.code) || ''})`);
    for (const [name, r] of Object.entries(J.rows || {})) {
      const ps = (r.perSeed || []).filter(x => Number.isInteger(x.move));
      if (!ps.length) continue;
      const atMove = {}, stay = { spring: 0, summer: 0, autumn: 0, winter: 0 };
      for (const x of ps) {
        const sm = seasonAt(x.move); atMove[sm] = (atMove[sm] || 0) + 1;
        const end = Number.isInteger(x.home) ? x.home : x.move + 360;
        for (let d = x.move; d < end; d++) stay[seasonAt(d)]++;
      }
      const yd = x => (x + Y0) % (DAYS_PER_SEASON * 4);
      const moveDays = ps.map(x => x.move).sort((a, b) => a - b);
      const med = moveDays[Math.floor((moveDays.length - 1) / 2)];
      out.arrival[name] = { ko: r.ko, seeds: ps.length, moveMed: med, moveYearDay: yd(med), seasonAtMove: atMove,
                            stayDaysBySeasonMean: Object.fromEntries(SEASONS.map(s => [s, Math.round(stay[s] / ps.length)])) };
      console.log(`  ${name.padEnd(10)} 이사 중앙 ${med}일(연중 ${yd(med)}일) · 이사 날 철 ${Object.entries(atMove).map(([k, v]) => `${KO[k]} ${v}`).join(' · ')} / ${ps.length} · 원룸에 머문 날(이사 ~ 500만 원) 철별 평균 ${SEASONS.map(s => `${KO[s]} ${out.arrival[name].stayDaysBySeasonMean[s]}`).join(' · ')}`);
    }
  } else console.log(`\n■ D 건너뜀 — ${f} 없음`);
}

if (OUT) { fs.writeFileSync(path.resolve(ROOT, OUT), JSON.stringify(out, null, 1) + '\n'); console.log(`\n→ ${OUT}`); }
console.log(fail ? `\nFAIL ${fail}` : '\nOK');
process.exit(fail ? 1 : 0);
