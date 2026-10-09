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
     al2    알로카시아 보통 잎 ≥ 2(막 싹튼 1장) · 30일 (겨울엔 al 주문을 안 낸다 — plan §2-2 · 그래도 «가을 끝» 판으로 겨울이 끼는 몫을 잰다)
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
  al2: (v) => { let a = R.newPlant('alocasia_frydek', { seed: 3, origin: 'from_plain_mother' });
    for (let d = 0; d < 40 && a.leaves.length < 1; d++) R.stepDay(a, { dli: 6, season: 'spring' });   // 막 싹튼 1장
    a.hist = []; let ok = 0;
    for (let d = 1; d <= DUE.normal; d++) { for (const e of R.stepDay(a, { dli: v.dli[d - 1], season: v.season[d - 1] })) if (e.type === 'leaf') ok = 1; }
    return ok; }
};
function ppTest(v, due, minPink, startPink = PPS.start) {
  let hit = 0;
  for (let r = 1; r <= PP_RUNS; r++) {
    const p = R.newPlant('pink_princess', { seed: 1000 + r, pinks: [startPink] });
    let got = 0;
    for (let d = 1; d <= due && !got; d++) for (const e of R.stepDay(p, { dli: v.dli[d - 1], season: v.season[d - 1] })) if (e.type === 'leaf' && e.pink > minPink) got = 1;
    hit += got;
  }
  return hit / PP_RUNS;
}
const KINDS = { cut2: '몬스테라 삽수 보통 잎≥2 · 30일', cutSB: '몬스테라 삽수 어려움 무늬≥산반 · 45일', cutHM: '몬스테라 삽수 어려움 무늬≥하프문 · 45일',
  ppSB: 'PP 보통 새 잎 분홍 마블↑ · 30일', ppHM: 'PP 어려움 새 잎 분홍 많음↑ · 45일(맨 위 분홍 0.35)',
  ppHM5: 'PP 어려움 새 잎 분홍 많음↑ · 45일(맨 위 분홍 0.5)', al2: 'AL 보통 잎≥2(막 싹튼 1) · 30일' };
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
if (process.env.OUT) fs.writeFileSync(path.join(ROOT, process.env.OUT), JSON.stringify({ meta: { profile: FILE, roomRev: P.roomRev || null, generatedAt: P.generatedAt || null,
  lampCounts: LAMPS, seeds: SEEDS, ppRuns: PP_RUNS, due: DUE, opens: SEASON_START, window: H, kinds: KINDS }, light: lightRows, shop, winterNone }, null, 1));
