/* ============================================================
   probe_mother_leafrate.mjs — 원룸 모주가 «한 달에 새 잎 몇 장»인가, 무엇이 줄이나 ([growth] 소유 · 2026-10-09)
   ------------------------------------------------------------
   ★ 총괄 물음 ①(값 안 바꿈 · 진단): core 가 잰 «원룸 모주 한 달 새 잎 0.34장»이 캐논대로인가.
     빛(밴드 → 걸음 속도) · 계절(real 겨울 멈춤) · 자르기 — 그리고 캐논 «잎 간격이 나이에 따라 길어짐»을 갈라서 본다.
   ★ 갈래(같은 씨앗 · 같은 판에서 한 칸씩만 바꾼다)
     A  반지하 첫 그루 · 도착 생장일 45 · novice 창턱 + 등1(36일째부터)      — 비교 기준(젊은 그루)
     B0 원룸 모주 · 생장일 MOTHER_G · 상수 3.0(slow · 걸음 1.0 · 안 멈춤)    — «캐논 잎 간격만»
     B1 원룸 모주 · 상수 6.0(best · 걸음 1.25 · 안 멈춤)                     — + «빛 밴드»
     B2 원룸 모주 · 원룸 정본 real 창턱 sill:0 등0                          — + «계절(멈춤)»
     B3 원룸 모주 · 원룸 정본 real 창턱 sill:0 등1
   ★ 자르기 — [읽음] plant_grow 에는 «잘린 마디»를 받는 창구가 없다(코어 shop.js §dealListing: 「plant_grow 는 한 그루 전용이고
     되돌릴 창구가 없다」 · propagation §cutBudgetOf 는 장부(pendingCutLoss)로만 뺀다). 그래서 생장 엔진이 «새 잎을 내는 빠르기»는
     자르기와 무관하다 — 자르면 «장부의 잎 수»가 줄 뿐이다. 이 자는 엔진 쪽만 잰다.
   ★ 크롬 없음 — vm. 로더는 probe_leaf_health_year 것을 빌린다(새 THREE 스텁을 짓지 않는다).
     vm 판은 날마다 leafStats() 를 불러 위상을 키운다(안 부르면 새 잎이 «그날» 안 생긴다 · 색인 ⑭).

     MOTHER_G=200 SEEDS=40 DAYS=360 node tools/probe_mother_leafrate.mjs
   ⛔ 값·확률·문턱은 안 건드린다.
============================================================ */
import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProfileLight } from '../src/game/room_profile.js';
import { GROWTH_STEPS_MAX } from '../src/game/loop.js';
import { ARRIVAL } from '../src/game/state.js';
import { loadGrowth } from './probe_leaf_health_year.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const J = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const SEEDS = Number(process.env.SEEDS || 40), DAYS = Number(process.env.DAYS || 360), YD0 = Number(process.env.YD0 || 135);
const MOTHER_G = Number(process.env.MOTHER_G || 200);
const TH = J('data/balance/light_thresholds.json'), T = TH.plants.monstera_deliciosa;
const BY = J('data/growth_tuning.json').growth_speed.by_band;
const LI = J('data/growth_tuning.json').leaf_interval.days;
const bandOf = d => d < T.die ? 'critical' : d < T.survive ? 'poor' : d < T.min ? 'stagnant'
  : d < T.best_lo ? 'slow' : d <= T.best_hi ? 'best' : d <= T.max ? 'good' : 'over';
const G = loadGrowth();
for (let i = 0; i < 400 && !G.thLoaded(); i++) await new Promise(r => setImmediate(r));
const seedTo = v => { try { G.plantSeed(v); } catch (e) { /* vm — 그리기만 던진다 */ } };

const profileSeries = (file, room, slot, mode, lamps, lampDay) => {
  const P = J(file);
  const light = createProfileLight({ ...P, uidStable: true }, { thresholds: TH, weather: J('data/balance/weather.json'), electricity: J('data/balance/electricity.json') });
  const out = [];
  for (let d = 1; d <= DAYS; d++) { const n = (lamps > 0 && d >= lampDay) ? lamps : 0;
    const s = (light.daily(d, { sim: { mode, yearDay0: YD0 }, lamps: { count: n, litHours: 12 }, pots: [], placedItems: [] }).report.slots || []).find(x => x.slotId === slot);
    out.push(s ? s.dli : 0); }
  return out;
};
const constSeries = v => Array.from({ length: DAYS }, () => v);
const CASES = [
  { id: 'A',  ko: '반지하 첫 그루 · 생장일 45 · novice 창턱 + 등1(36일째)', g0: ARRIVAL.growthDays, pro: true,  dli: profileSeries('data/profiles/room_profile.banjiha.json', 'banjiha', 'banjiha-sill:0', 'novice', 1, 36) },
  { id: 'B0', ko: `원룸 모주 · 생장일 ${MOTHER_G} · 상수 3.0(slow · 안 멈춤) = 캐논 잎 간격만`, g0: MOTHER_G, pro: true, dli: constSeries(3.0) },
  { id: 'B1', ko: `원룸 모주 · 생장일 ${MOTHER_G} · 상수 6.0(best · 걸음 1.25)`, g0: MOTHER_G, pro: true, dli: constSeries(6.0) },
  { id: 'B2', ko: `원룸 모주 · 생장일 ${MOTHER_G} · 원룸 real sill:0 등0(계절)`, g0: MOTHER_G, pro: true, dli: profileSeries('data/profiles/room_profile.oneroom.json', 'oneroom', 'oneroom-sill:0', 'real', 0, 1) },
  { id: 'B3', ko: `원룸 모주 · 생장일 ${MOTHER_G} · 원룸 real sill:0 등1(계절)`, g0: MOTHER_G, pro: true, dli: profileSeries('data/profiles/room_profile.oneroom.json', 'oneroom', 'oneroom-sill:0', 'real', 1, 1) },
];
const cum = LI.reduce((a, v) => (a.push((a.at(-1) || 0) + v), a), []);
console.log(`══ 모주 잎 빠르기 — ${SEEDS}판 · ${DAYS}일 · yearDay0 ${YD0} · 크롬 없음(vm) · 잎 = leafStats().leaves 의 늘어남(낙엽 꺼짐이라 = 새로 난 잎)`);
console.log(`   캐논 잎 간격(생장일) ${JSON.stringify(LI)} → 누적 ${JSON.stringify(cum)} · 생장일 ${MOTHER_G} 다음 원줄기 잎은 ${cum.filter(c => c > MOTHER_G).slice(0, 3).join(' · ')}`);
console.log('   갈래                                                   30일당 새 잎(중앙)   첫 120일   121~360일   자라는 날   생장일 늘어남(중앙)');
const out = [];
for (const c of CASES) {
  const mult = []; const a7 = [];
  for (let k = 0; k < DAYS; k++) { const w = c.dli.slice(Math.max(0, k - 6), k + 1); const a = w.reduce((x, y) => x + y, 0) / w.length; a7.push(a);
    let m = BY[bandOf(a)]; if (typeof m !== 'number' || m < 1) m = 1; mult.push(Math.min(m, GROWTH_STEPS_MAX)); }
  const per = [];
  for (let s = 1; s <= SEEDS; s++) {
    seedTo(s * 7919); G.setPrologueVarieLeaves(c.pro ? [2, 3] : []); G.resetDailyLight(); G.setGrowth(c.g0); G.leafStats();
    const L0 = G.leafStats().leaves; const gStart = G.growthDays();
    let credit = 0, L120 = null, grow = 0;
    for (let k = 0; k < DAYS; k++) {
      const blocked = !!G.growthBlocked(); let steps = 1;
      if (!blocked) { credit += mult[k]; steps = Math.min(GROWTH_STEPS_MAX, Math.floor(credit + 1e-9)); credit -= steps; steps = Math.max(1, steps); grow++; }
      for (let i = 0; i < steps; i++) { G.setDailyLight(c.dli[k]); G.advanceTo(G.calendarDay() + 1); }
      G.leafStats();
      if (k + 1 === 120) L120 = G.leafStats().leaves;
    }
    const L = G.leafStats().leaves;
    per.push({ total: L - L0, first: (L120 ?? L) - L0, later: L - (L120 ?? L), grow, dg: G.growthDays() - gStart });
  }
  const q = (a) => { const v = a.slice().sort((x, y) => x - y); return v[Math.floor(v.length / 2)]; };
  const r = { id: c.id, ko: c.ko, per30: +(q(per.map(p => p.total)) / DAYS * 30).toFixed(2),
    first120: q(per.map(p => p.first)), later: q(per.map(p => p.later)), growDays: q(per.map(p => p.grow)), dGrowth: q(per.map(p => p.dg)) };
  out.push(r);
  console.log(`   ${(c.id + ' ' + c.ko).padEnd(54)} ${String(r.per30).padStart(6)}               ${String(r.first120).padStart(4)}       ${String(r.later).padStart(4)}        ${String(r.growDays).padStart(4)}        ${r.dGrowth}`);
}
if (process.env.OUT) fs.writeFileSync(path.join(ROOT, process.env.OUT), JSON.stringify({ meta: { seeds: SEEDS, days: DAYS, yearDay0: YD0, motherGrowth: MOTHER_G, leafInterval: LI }, rows: out }, null, 1));
