/* ============================================================
   probe_m5_oneroom.mjs — D8·D9 잴 판 M5 «원룸 생장 입력» ([growth] 소유 · 2026-10-08)
   ------------------------------------------------------------
   명세(docs/handoff/plan-d8-d9-measure-20261008.md §2 M5):
     원룸 D 배치 · 도착 생장일 45 · 창턱·에타제르 자리마다 · 등 0/1/2 · 40판 · 400일
     ⇒ 자리 × 등 : 7일평균 · 잎2·잎3 날 · 갈라짐 중앙값 · 무늬 밴드(dark/mid/bright)

   ★ 어떻게 재나
     ① 빛 줄 — node 에서 room_profile.daily 로 real 하루 DLI 를 400일 뽑는다(정본 프로필 · yearDay0 YD0).
        7일 «이동»평균의 연평균·최저·자라는 날(≥ min)을 낸다. 자라는 날이 0 이면 잎이 영영 안 나므로
        그 자리는 크롬으로 안 돌리고 «안 자람»으로 적는다(같은 빛 줄이면 같은 답이다).
     ② 잎 — plant_grow 헤드리스(크롬 하나)에서 코어 걸음(밝기 속도 적립 · loop.js §growthStepsOf 와 같은 셈)으로 걷는다.
        첫 그루로 본다: 프롤로그 무늬 보장 켬(잎2·잎3 무늬) · 도착 생장일 45(잎1 달고 옴) · 물은 늘 줌.
        ★ 잎이 나는 자리(leafBirth)는 빛과 상관없이 씨앗만으로 정해진다(2026-10-08 잰 것: photo 를 바꿔도
          leafBirth 묶음 0/20 갈림). 그래서 씨앗마다 먼저 setGrowth(600) 로 잎 자리를 뽑아 두고,
          걷는 동안에는 잎2·잎3 이 «펴진 날»(ageOf(GROWTH) ≥ leafBirth)과 «갈라진 날»(matureOf)만 본다.
          둘 다 갈라지면 그 판을 일찍 멈춘다.
     ③ 무늬 밴드 — 잎이 펴진 날의 7일평균 밴드를 varie_grades.json lightBands 로 dark/mid/bright 로 바꾼다.
   ⚠ 몬스테라 7일 «이동»평균이다. 콩나물(5일)·무순(7일 자라는 평균)과 섞지 마라.
   ⚠ 등 표가 없는 프로필이면 그 등은 ⛔ 로 찍는다(등0 을 반복하지 않는다).

     BYEOT_URL=http://localhost:9321 LAMPS=0,1,2 SEEDS=40 DAYS=400 OUT=docs/handoff/growth-m5-oneroom.json node tools/probe_m5_oneroom.mjs
   ⛔ 값·확률·문턱은 안 건드린다.
============================================================ */
import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from './test_cdp.mjs';
import { createProfileLight } from '../src/game/room_profile.js';
import { GROWTH_STEPS_MAX } from '../src/game/loop.js';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const J = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const BASE = process.env.BYEOT_URL || 'http://localhost:8971';
const FILE = process.env.PROFILE || 'data/profiles/room_profile.oneroom.json';
const LAMPS = (process.env.LAMPS || '0,1,2').split(',').map(Number);
const SEEDS = Number(process.env.SEEDS || 40), DAYS = Number(process.env.DAYS || 400), YD0 = Number(process.env.YD0 || 135);
const START_G = Number(process.env.START_G || 45);
const SLOTS = (process.env.SLOTS || 'sill,etagere').split(',');
const TH = J('data/balance/light_thresholds.json'), T = TH.plants.monstera_deliciosa;
const VG = J('data/balance/varie_grades.json'), LB = VG.lightBands;
const BY = J('data/growth_tuning.json').growth_speed.by_band;
const bandOf = d => d < T.die ? 'critical' : d < T.survive ? 'poor' : d < T.min ? 'stagnant'
  : d < T.best_lo ? 'slow' : d <= T.best_hi ? 'best' : d <= T.max ? 'good' : 'over';
const P = J(FILE);
const meta = { mode: 'real', tool: 'tools/probe_m5_oneroom.mjs', profile: FILE,
  roomRev: String(P.roomRev || '').split(' ')[0], measuredAt: (P.measured || {}).measuredAt || null, generatedAt: P.generatedAt || null,
  lampCounts: P.lampCounts || [0], yearDay0: YD0, days: DAYS, seeds: SEEDS, startGrowth: START_G,
  plant: '첫 그루(프롤로그 보장 켬 · 잎2·잎3 무늬)', water: '늘 줌', avg: '몬스테라 7일 이동평균' };

/* ① 빛 줄 */
const combos = [];
for (const sl of P.slots.map(s => s.slotId).filter(id => SLOTS.some(k => id.includes(k)))) for (const lamps of LAMPS) {
  if (!(P.lampCounts || [0]).includes(lamps)) { combos.push({ slot: sl, lamps, missing: true }); continue; }
  const light = createProfileLight({ ...P, uidStable: true },
    { thresholds: TH, weather: J('data/balance/weather.json'), electricity: J('data/balance/electricity.json') });
  const dli = [], a7 = [], mult = [];
  for (let d = 1; d <= DAYS; d++) {
    const s = (light.daily(d, { sim: { mode: 'real', yearDay0: YD0 }, lamps: { count: lamps, litHours: 12 }, pots: [], placedItems: [] }).report.slots || []).find(x => x.slotId === sl);
    dli.push(s ? s.dli : 0);
    const w = dli.slice(-7), a = w.reduce((x, y) => x + y, 0) / w.length; a7.push(a);
    let m = BY[bandOf(a)]; if (typeof m !== 'number' || m < 1) m = 1; mult.push(Math.min(m, GROWTH_STEPS_MAX));
  }
  const grow = a7.filter(a => a >= T.min).length;
  combos.push({ slot: sl, lamps, dli, a7, mult, grow,
    avg7: { mean: +(a7.reduce((x, y) => x + y, 0) / a7.length).toFixed(2), min: +Math.min(...a7).toFixed(2), max: +Math.max(...a7).toFixed(2) } });
}

/* ② 잎 — 자라는 자리만 크롬으로 */
const RUN = (c) => `(()=>{ const S=${JSON.stringify({ dli: c.dli, mult: c.mult })}; const res=[];
  for (let s=1; s<=${SEEDS}; s++){
    plantSeed(s*7919); setPrologueVarieLeaves([2,3]); resetDailyLight(); setGrowth(600);
    const b=[...new Set(leafOnPlantAll().map(x=>x.leafBirth))].sort((a,c)=>a-c);
    const L2=b[1], L3=b[2];
    plantSeed(s*7919); setPrologueVarieLeaves([2,3]); resetDailyLight(); setGrowth(${START_G});
    let credit=0; const r={ d2:null, d3:null, m2:null, m3:null };
    for (let k=0; k<S.dli.length; k++){
      const blocked=!!growthBlocked(); let steps=1;
      if(!blocked){ credit+=S.mult[k]; steps=Math.min(${GROWTH_STEPS_MAX},Math.floor(credit+1e-9)); credit-=steps; steps=Math.max(1,steps); }
      for(let i=0;i<steps;i++){ setDailyLight(S.dli[k]); advanceTo(calendarDay()+1); }
      const g=ageOf(GROWTH);
      if(r.d2==null && L2!=null && g>=L2) r.d2=k+1;
      if(r.d3==null && L3!=null && g>=L3) r.d3=k+1;
      if(r.m2==null && L2!=null && matureOf(L2)) r.m2=k+1;
      if(r.m3==null && L3!=null && matureOf(L3)) r.m3=k+1;
      if(r.m2!=null && r.m3!=null) break;
    }
    res.push(r);
  }
  return JSON.stringify(res); })()`;
const q = (a, f) => { const v = a.filter(x => x != null).sort((x, y) => x - y); return v.length ? v[Math.min(v.length - 1, Math.floor(f * (v.length - 1)))] : null; };
const growing = combos.filter(c => !c.missing && c.grow > 0);
let page = null;
if (growing.length) {
  page = await launch({ width: 900, height: 700, dpr: 1, mobile: false });
  await page.goto(`${BASE}/plant_grow.html`);
  await page.waitFor('typeof leafOnPlantAll === "function"', 120000, 300);
  await page.waitFor('TH_LOADED === true', 120000, 300);
}
const rows = [];
for (const c of combos) {
  if (c.missing) { rows.push({ slot: c.slot, lamps: c.lamps, note: `⛔ 프로필에 등${c.lamps} 표 없음` }); continue; }
  const base = { slot: c.slot, lamps: c.lamps, avg7: c.avg7, growDays: c.grow };
  if (c.grow === 0) { rows.push({ ...base, note: '안 자람(자라는 날 0) — 잎2 도 안 난다' }); continue; }
  const R = JSON.parse(await page.eval(RUN(c), true, 3600000));
  const band = (d) => { if (d == null) return null; return LB[bandOf(c.a7[d - 1])] || 'dark'; };
  const bandShare = (k) => { const n = {}; let t = 0; for (const r of R) { const b = band(r[k]); if (b) { n[b] = (n[b] || 0) + 1; t++; } }
    return Object.fromEntries(Object.entries(n).map(([b, v]) => [b, +(v / t).toFixed(2)])); };
  const st = (k) => ({ p50: q(R.map(r => r[k]), .5), p10: q(R.map(r => r[k]), .1), p90: q(R.map(r => r[k]), .9), none: R.filter(r => r[k] == null).length });
  rows.push({ ...base, leaf2Day: st('d2'), leaf3Day: st('d3'), leaf2Split: st('m2'), leaf3Split: st('m3'),
    leaf2Band: bandShare('d2'), leaf3Band: bandShare('d3') });
  const r = rows.at(-1);
  console.log(`  ${c.slot.padEnd(18)} 등${c.lamps}  잎2 ${r.leaf2Day.p50}일 · 잎3 ${r.leaf3Day.p50}일 · 갈라짐 잎2 ${r.leaf2Split.p50 ?? '—'}(${r.leaf2Split.none}판 안) · 잎3 ${r.leaf3Split.p50 ?? '—'}(${r.leaf3Split.none}판 안)`);
}
if (page) await page.close();

/* 표 */
const fmt = (s, word = '안 남') => s ? `${s.p50 ?? '—'}${s.p50 != null ? ` (${s.p10}~${s.p90})` : ''}${s.none ? ` · ${word} ${s.none}/${SEEDS}` : ''}` : '';
const bf = b => b ? Object.entries(b).map(([k, v]) => `${k} ${Math.round(v * 100)}%`).join(' · ') : '';
console.log(`\n## M5 원룸 생장 입력 — mode real · 등 ${LAMPS.join('/')} · 자 tools/probe_m5_oneroom.mjs`);
console.log(`프로필 ${FILE} · roomRev ${meta.roomRev} · measuredAt ${meta.measuredAt} · generatedAt ${meta.generatedAt} · yearDay0 ${YD0} · ${DAYS}일 · ${SEEDS}판 · 도착 생장일 ${START_G} · 첫 그루(잎2·3 무늬) · 날 수는 «도착(이사)한 뒤 게임 날»\n`);
console.log('| 자리 | 등 | 7일평균 평균/최저/최고 | 자라는 날 | 잎2 날 | 잎3 날 | 잎2 갈라짐 | 잎3 갈라짐 | 잎2 밴드 | 잎3 밴드 |');
console.log('|---|---|---|---|---|---|---|---|---|---|');
for (const r of rows) {
  if (r.note && !r.avg7) { console.log(`| ${r.slot} | ${r.lamps} | ${r.note} |||||||| `); continue; }
  if (r.note) { console.log(`| ${r.slot} | ${r.lamps} | ${r.avg7.mean}/${r.avg7.min}/${r.avg7.max} | ${r.growDays} | ${r.note} |||||| `); continue; }
  console.log(`| ${r.slot} | ${r.lamps} | ${r.avg7.mean}/${r.avg7.min}/${r.avg7.max} | ${r.growDays} | ${fmt(r.leaf2Day)} | ${fmt(r.leaf3Day)} | ${fmt(r.leaf2Split, '안 갈라짐')} | ${fmt(r.leaf3Split, '안 갈라짐')} | ${bf(r.leaf2Band)} | ${bf(r.leaf3Band)} |`);
}
if (process.env.OUT) { fs.writeFileSync(path.join(ROOT, process.env.OUT), JSON.stringify({ meta, rows }, null, 1)); console.log('\n⇒ 썼다:', process.env.OUT); }
