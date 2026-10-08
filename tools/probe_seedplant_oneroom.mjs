/* ============================================================
   probe_seedplant_oneroom.mjs — 원룸에서 «씨앗부터» 키운 그루의 잎·갈라짐·무늬 날 ([growth] 소유 · 2026-10-08)
   ------------------------------------------------------------
   ★ 총괄 물음(박사님 「사람이 이리 튈지 저리 튈지」 · core 갈래 판 생장 입력 ①):
     모주를 팔고 원룸에 온 사람이 씨앗을 사서 다시 키우면 — 창턱·등 0/1 에서 잎1·잎2·잎3 · 첫 갈라짐 · 첫 무늬 잎은 언제인가.
   ★ 크롬 없이 돈다 — plant_grow 를 vm 으로 돌린다. 로더는 «새로 짓지 않고» probe_leaf_health_year.mjs 의 것을 빌린다
     (규칙: 별도 THREE 스텁은 만들지 않는다).
   ★ 판: 씨앗 그루 = 생장일 0(state.js SEED_START_GROWTH_DAYS) · 프롤로그 보장 «끔»(그 축복은 첫 그루에만) ·
        원룸 정본 real 빛을 날마다 · 코어 걸음(밝기 속도 적립 · loop.js §growthStepsOf) · 물 늘 줌
   ★ 잎 자리(leafBirth)는 씨앗만으로 정해진다(photo 0/20 갈림으로 확인) — 먼저 setGrowth 로 뽑아 두고,
     plantSeed 로 장부를 비운 뒤 걷는다(matResetAll 이 무늬·갈라짐 장부를 비운다).
   ⚠ 이사 날이 한 해의 어디냐(YD0)에 따라 첫 겨울이 앞뒤로 움직인다 — 기본 135.

     LAMPS=0,1 SEEDS=40 DAYS=400 YD0=135 OUT=docs/handoff/growth-seedplant-oneroom.json node tools/probe_seedplant_oneroom.mjs
   ⛔ 값·확률·문턱은 안 건드린다.
============================================================ */
import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProfileLight } from '../src/game/room_profile.js';
import { GROWTH_STEPS_MAX } from '../src/game/loop.js';
import { SEED_START_GROWTH_DAYS } from '../src/game/state.js';
import { loadGrowth } from './probe_leaf_health_year.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const J = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const FILE = process.env.PROFILE || 'data/profiles/room_profile.oneroom.json';
const LAMPS = (process.env.LAMPS || '0,1').split(',').map(Number);
const SEEDS = Number(process.env.SEEDS || 40), DAYS = Number(process.env.DAYS || 400), YD0 = Number(process.env.YD0 || 135);
const SLOTS = (process.env.SLOTS || 'sill').split(',');
const TH = J('data/balance/light_thresholds.json'), T = TH.plants.monstera_deliciosa;
const BY = J('data/growth_tuning.json').growth_speed.by_band;
const LB = J('data/balance/varie_grades.json').lightBands;
const bandOf = d => d < T.die ? 'critical' : d < T.survive ? 'poor' : d < T.min ? 'stagnant'
  : d < T.best_lo ? 'slow' : d <= T.best_hi ? 'best' : d <= T.max ? 'good' : 'over';
const P = J(FILE);
const G = loadGrowth();
for (let i = 0; i < 400 && !G.thLoaded(); i++) await new Promise(r => setImmediate(r));
if (!G.thLoaded()) throw new Error('[씨앗 그루] 임계값 정본이 안 실렸다');

/* vm 에서는 plantSeed 의 그리기(buildPlant)가 던진다 — 씨앗·장부는 그 «전에» 세워지므로 그리기만 삼킨다(test_maturation §seedTo 와 같은 꼴) */
const seedTo = (v) => { try { G.plantSeed(v); } catch (e) { /* 그리기 실패 — 헤드리스 */ } };
const q = (a, f) => { const v = a.filter(x => x != null).sort((x, y) => x - y); return v.length ? v[Math.min(v.length - 1, Math.floor(f * (v.length - 1)))] : null; };
const st = a => ({ p50: q(a, .5), p10: q(a, .1), p90: q(a, .9), none: a.filter(x => x == null).length });
const meta = { tool: 'tools/probe_seedplant_oneroom.mjs', mode: 'real', profile: FILE, roomRev: String(P.roomRev || '').split(' ')[0],
  yearDay0: YD0, days: DAYS, seeds: SEEDS, startGrowth: SEED_START_GROWTH_DAYS, plant: '씨앗 그루(프롤로그 보장 끔)', water: '늘 줌' };
console.log(`══ 원룸 씨앗 그루 — ${FILE} · roomRev ${meta.roomRev} · real · yearDay0 ${YD0} · ${DAYS}일 · ${SEEDS}판 · 생장일 ${SEED_START_GROWTH_DAYS}에서 · 날 = 심은 뒤`);
console.log('   자리               등   잎1        잎2        잎3        첫 갈라짐          첫 무늬 잎(그날 밴드)');
const rows = [];
for (const sl of P.slots.map(s => s.slotId).filter(id => SLOTS.some(k => id.includes(k)))) for (const lamps of LAMPS) {
  if (!(P.lampCounts || [0]).includes(lamps)) { console.log(`   ${sl.padEnd(18)} 등${lamps}  ⛔ 이 프로필엔 등${lamps} 표가 없다`); continue; }
  const light = createProfileLight({ ...P, uidStable: true },
    { thresholds: TH, weather: J('data/balance/weather.json'), electricity: J('data/balance/electricity.json') });
  const dli = [], a7 = [], mult = [];
  for (let d = 1; d <= DAYS; d++) {
    const s = (light.daily(d, { sim: { mode: 'real', yearDay0: YD0 }, lamps: { count: lamps, litHours: 12 }, pots: [], placedItems: [] }).report.slots || []).find(x => x.slotId === sl);
    dli.push(s ? s.dli : 0);
    const w = dli.slice(-7), a = w.reduce((x, y) => x + y, 0) / w.length; a7.push(a);
    let m = BY[bandOf(a)]; if (typeof m !== 'number' || m < 1) m = 1; mult.push(Math.min(m, GROWTH_STEPS_MAX));
  }
  const R = [];
  for (let s = 1; s <= SEEDS; s++) {
    seedTo(s * 7919); G.setPrologueVarieLeaves([]); G.resetDailyLight(); G.setGrowth(600);
    const b = [...new Set(G.leafOnPlantAll().map(x => x.leafBirth))].sort((x, y) => x - y);
    seedTo(s * 7919); G.setPrologueVarieLeaves([]); G.resetDailyLight(); G.setGrowth(SEED_START_GROWTH_DAYS);
    let credit = 0; const r = { l1: null, l2: null, l3: null, split: null, varie: null, varieBand: null };
    for (let k = 0; k < DAYS; k++) {
      const blocked = !!G.growthBlocked(); let steps = 1;
      if (!blocked) { credit += mult[k]; steps = Math.min(GROWTH_STEPS_MAX, Math.floor(credit + 1e-9)); credit -= steps; steps = Math.max(1, steps); }
      for (let i = 0; i < steps; i++) { G.setDailyLight(dli[k]); G.advanceTo(G.calendarDay() + 1); }
      /* ★★ vm 에서는 advanceTo 안의 buildPlant 가 그리기에서 던져 «위상이 날마다 안 자란다» — 그러면 새 잎의 무늬가
           «그날 빛»으로 안 굴린다(2026-10-08 잰 것: 안 부르면 400일 40판 무늬 0 · 부르면 빛 8 300일 20판 잎 112 중 무늬 33).
           브라우저가 날마다 그리며 하는 일을 leafStats() 로 대신한다(probe_arrival_phases · test_growth_parity 와 같은 꼴). */
      G.leafStats();
      const g = G.ageOf(G.growthDays());
      if (r.l1 == null && b[0] != null && g >= b[0]) r.l1 = k + 1;
      if (r.l2 == null && b[1] != null && g >= b[1]) r.l2 = k + 1;
      if (r.l3 == null && b[2] != null && g >= b[2]) r.l3 = k + 1;
      if (r.split == null && G.matStateAll().some(m => m.matured && m.leafBirth <= g)) r.split = k + 1;
      if (r.varie == null && G.varieStateAll().some(v => v.varie && v.leafBirth <= g)) { r.varie = k + 1; r.varieBand = LB[bandOf(a7[k])] || 'dark'; }
      if (r.l3 != null && r.split != null && r.varie != null) break;
    }
    R.push(r);
  }
  const row = { slot: sl, lamps, leaf1: st(R.map(r => r.l1)), leaf2: st(R.map(r => r.l2)), leaf3: st(R.map(r => r.l3)),
    firstSplit: st(R.map(r => r.split)), firstVarie: st(R.map(r => r.varie)),
    firstVarieBand: Object.fromEntries(Object.entries(R.reduce((o, r) => (r.varieBand && (o[r.varieBand] = (o[r.varieBand] || 0) + 1), o), {}))) };
  rows.push(row);
  const f = x => (x.p50 == null ? '—' : `${x.p50}(${x.p90})`) + (x.none ? `·안${x.none}` : '');
  console.log(`   ${sl.padEnd(18)} 등${lamps}   ${f(row.leaf1).padEnd(10)} ${f(row.leaf2).padEnd(10)} ${f(row.leaf3).padEnd(10)} ${f(row.firstSplit).padEnd(18)} ${f(row.firstVarie)} ${JSON.stringify(row.firstVarieBand)}`);
}
console.log(`   (괄호 = 90% · 안N = ${DAYS}일 안에 그 일이 없던 판 수)`);
if (process.env.OUT) fs.writeFileSync(path.join(ROOT, process.env.OUT), JSON.stringify({ meta, rows }, null, 1));
