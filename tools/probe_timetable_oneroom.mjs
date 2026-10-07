/* ============================================================
   probe_timetable_oneroom.mjs — 원룸 이사 뒤 잎·갈라짐·무늬 등급 시각표 (D9 · [growth] 소유)
   ------------------------------------------------------------
   ★ 2026-10-08 · 총괄 D9(엔딩 목표 금액을 «원룸에서 무늬를 키워 팔면 몇 달»로 다시 잰다)용.
     core 경제 자(probe_econ·probe_economy_gap)는 게임 하루 진행을 그대로 돌리므로 이 표를 «입력»으로
     쓸 필요는 없다. 이 표는 그 자가 원룸 단계로 넓힐 때 «맞대 볼 기준»이다 — 둘이 갈리면 어느 한쪽이 틀렸다.

   ★ 무엇을 하나
     원룸 프로필의 real 빛을 날마다(node 에서 room_profile.daily 로) 뽑아, plant_grow 를 헤드리스 크롬에서
     코어 걸음(밝기 속도 적립 · loop.js §growthStepsOf 와 같은 셈)으로 걷는다. 씨앗을 바꿔 N판.
     잎마다 «나는 날» · «갈라지는 날»(leafState.matured) · «무늬인가» · «태어날 때 등급 밴드»를 센다.
     등급 무게는 varie_grades.json lightGrade[밴드] 를 그대로 붙인다 — 등급 굴림은 core(shop.js) 몫이라
     여기서 굴리지 않는다.

   ⚠ 가정(바꿀 수 있다):  첫 그루는 이사 때 생장일 MOTHER_G(기본 200 = 잎 4장 언저리)로 온다 · 프롤로그 보장 켬
                           씨앗 그루는 생장일 0 에서 시작(state.js SEED_START_GROWTH_DAYS) · 보장 끔
                           물은 늘 준다 · 날 수는 «이사한 뒤 게임 날»
     PROFILE=docs/handoff/_tmp_profile_oneroom_D.json SLOT=oneroom-sill:0 LAMPS=0,1,2 SEEDS=20 DAYS=540 YD0=135
       BYEOT_URL=http://localhost:9321 OUT=docs/handoff/growth-timetable-oneroom.json node tools/probe_timetable_oneroom.mjs
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
const FILE = process.env.PROFILE || 'docs/handoff/_tmp_profile_oneroom_D.json';
const SLOT = process.env.SLOT || 'oneroom-sill:0';
const LAMPS = (process.env.LAMPS || '0,1,2').split(',').map(Number);
const SEEDS = Number(process.env.SEEDS || 20), DAYS = Number(process.env.DAYS || 540), YD0 = Number(process.env.YD0 || 135);
const MOTHER_G = Number(process.env.MOTHER_G || 200);
const TH = J('data/balance/light_thresholds.json'), T = TH.plants.monstera_deliciosa;
const VG = J('data/balance/varie_grades.json'), LB = VG.lightBands, LG = VG.lightGrade;
const BY = J('data/growth_tuning.json').growth_speed.by_band;
const bandOf = d => d < T.die ? 'critical' : d < T.survive ? 'poor' : d < T.min ? 'stagnant'
  : d < T.best_lo ? 'slow' : d <= T.best_hi ? 'best' : d <= T.max ? 'good' : 'over';
const P = J(FILE);

/* 빛 줄 — 이사 날부터 DAYS 일. 등 개수마다 한 줄. 밝기 속도(mult)도 같이 — 코어가 그 값으로 걸음을 더한다 */
const series = {};
for (const lamps of LAMPS) {
  if (!(P.lampCounts || [0]).includes(lamps)) { console.log(`⛔ ${FILE} 엔 등${lamps} 표가 없다 — 건너뜀`); continue; }
  const light = createProfileLight({ ...P, uidStable: true },
    { thresholds: TH, weather: J('data/balance/weather.json'), electricity: J('data/balance/electricity.json') });
  const dli = [], mult = [];
  for (let d = 1; d <= DAYS; d++) {
    const s = (light.daily(d, { sim: { mode: 'real', yearDay0: YD0 }, lamps: { count: lamps, litHours: 12 }, pots: [], placedItems: [] }).report.slots || []).find(x => x.slotId === SLOT);
    dli.push(s ? s.dli : 0);
    const w = dli.slice(-7), a = w.reduce((x, y) => x + y, 0) / w.length;
    let m = BY[bandOf(a)]; if (typeof m !== 'number' || m < 1) m = 1;               // loop.js §growthSpeedOf
    mult.push(Math.min(m, GROWTH_STEPS_MAX));
  }
  series[lamps] = { dli, mult };
}

/* 브라우저 안에서 도는 한 판 묶음 — 문자열로 넘긴다(따옴표 섞임을 피하려고 JSON 으로만 값을 꽂는다) */
const RUN = (S, kind) => `(()=>{ const S=${JSON.stringify(S)}; const KIND=${JSON.stringify(kind)};
  const MOTHER_G=${MOTHER_G}, STEP_MAX=${GROWTH_STEPS_MAX}; const res=[];
  for (let s=1; s<=${SEEDS}; s++){
    plantSeed(s*7919); setPrologueVarieLeaves(KIND==='mother' ? [2,3] : []); resetDailyLight(); setGrowth(KIND==='mother' ? MOTHER_G : 0);
    let credit=0; const gDay=[]; const split={};
    for (let k=0; k<S.dli.length; k++){
      const blocked=!!growthBlocked(); let steps=1;
      if(!blocked){ credit+=S.mult[k]; steps=Math.min(STEP_MAX,Math.floor(credit+1e-9)); credit-=steps; steps=Math.max(1,steps); }
      for(let i=0;i<steps;i++){ setDailyLight(S.dli[k]); advanceTo(calendarDay()+1); }
      gDay.push(ageOf(GROWTH));
      for (const m of matStateAll()) if (m.matured && split[m.leafBirth]==null) split[m.leafBirth]=k+1;
    }
    const v = new Map(varieStateAll().map(x=>[x.leafBirth, !!x.varie]));
    const births=[...new Set(leafOnPlantAll().map(x=>x.leafBirth))].sort((a,b)=>a-b);
    const g0 = KIND==='mother' ? ageOf(MOTHER_G) : 0;
    res.push(births.filter(lb=>lb>g0).map(lb=>{ const d=gDay.findIndex(g=>g>=lb);
      return { lb, day: d<0?null:d+1, varie: !!v.get(lb), split: split[lb]??null }; }));
  }
  return JSON.stringify(res); })()`;

const page = await launch({ width: 900, height: 700, dpr: 1, mobile: false });
await page.goto(`${BASE}/plant_grow.html`);
await page.waitFor('typeof leafOnPlantAll === "function"', 120000, 300);
await page.waitFor('TH_LOADED === true', 120000, 300);
const out = { meta: { profile: FILE, slot: SLOT, mode: 'real', yearDay0: YD0, days: DAYS, seeds: SEEDS, motherGrowth: MOTHER_G,
  note: '날 수 = 이사한 뒤 게임 날 · 등급 무게 = varie_grades.lightGrade[태어날 때 밴드] · 물은 늘 줌 · 씨앗 s*7919' }, cases: [] };
const q = (a, f) => { const v = a.filter(x => x != null).sort((x, y) => x - y); return v.length ? v[Math.min(v.length - 1, Math.floor(f * (v.length - 1)))] : null; };
for (const lamps of Object.keys(series).map(Number)) for (const kind of ['seed', 'mother']) {
  /* ⚠ 판마다 «n번째 잎»은 서로 다른 잎이다(가지마다 잎이 난다) — 그래서 잎 번호로 안 묶고
       «이사 뒤 X일까지 몇 장» 누적으로 센다. 아직 안 펴진 잎(day null)은 뺀다. 판마다 날것은 JSON 에 그대로 남긴다. */
  const res = JSON.parse(await page.eval(RUN(series[lamps], kind), true, 3600000))
    .map(r => r.filter(l => l.day != null).map(l => {
      const w = series[lamps].dli.slice(Math.max(0, l.day - 7), l.day), a = w.reduce((x, y) => x + y, 0) / w.length;
      return { ...l, band: LB[bandOf(a)] || 'dark' };
    }));
  const rows = [];
  for (let X = 30; X <= DAYS; X += 30) {
    const per = res.map(r => {
      const born = r.filter(l => l.day <= X), vb = born.filter(l => l.varie);
      const ev = { sanban: 0, halfmoon: 0, fullmoon: 0 };
      for (const l of vb) for (const g of Object.keys(ev)) ev[g] += (LG[l.band] ? LG[l.band][g] : 0);
      return { leaves: born.length, varie: vb.length, varieSplit: vb.filter(l => l.split != null && l.split <= X).length, ev };
    });
    const m = k => per.map(p => p[k]);
    const evAvg = {}; for (const g of ['sanban', 'halfmoon', 'fullmoon']) evAvg[g] = +(per.reduce((s, p) => s + p.ev[g], 0) / per.length).toFixed(2);
    rows.push({ day: X, leaves: { p10: q(m('leaves'), .1), p50: q(m('leaves'), .5), p90: q(m('leaves'), .9) },
      varie: { p10: q(m('varie'), .1), p50: q(m('varie'), .5), p90: q(m('varie'), .9) },
      varieSplit: { p10: q(m('varieSplit'), .1), p50: q(m('varieSplit'), .5), p90: q(m('varieSplit'), .9) },
      expectedVarieByGrade: evAvg });
  }
  out.cases.push({ plant: kind, lamps, byDay: rows, runs: res });
  console.log(`\n[${kind === 'seed' ? '씨앗 그루' : '첫 그루'} · 등${lamps}] ${SEEDS}판 · 이사 뒤 X일까지(중앙값 · 10~90%)`);
  console.log('   X일    잎        무늬 잎    갈라진 무늬    무늬 잎 등급 기댓값(산반/하프문/풀문)');
  for (const r of rows.filter((_, i) => i % 2 === 1 || rows.length <= 6))
    console.log(`  ${String(r.day).padStart(4)}  ${String(r.leaves.p50).padStart(2)}(${r.leaves.p10}~${r.leaves.p90})`.padEnd(20) +
      `${String(r.varie.p50).padStart(2)}(${r.varie.p10}~${r.varie.p90})`.padEnd(11) +
      `${String(r.varieSplit.p50).padStart(2)}(${r.varieSplit.p10}~${r.varieSplit.p90})`.padEnd(15) +
      `${r.expectedVarieByGrade.sanban}/${r.expectedVarieByGrade.halfmoon}/${r.expectedVarieByGrade.fullmoon}`);
}
/* ★ OUT 이 이미 있으면 «합친다» — 등 개수마다 따로 돌려도(메모리가 모자랄 때) 한 파일에 모인다.
     같은 (그루·등) 판은 새것으로 갈고, 판의 조건(meta)이 다르면 섞지 않고 던진다 — 다른 판을 한 표에 섞으면 거짓이 된다. */
if (process.env.OUT) {
  const fp = path.join(ROOT, process.env.OUT);
  let merged = out;
  if (fs.existsSync(fp)) {
    const old = JSON.parse(fs.readFileSync(fp, 'utf8'));
    const same = ['profile', 'slot', 'mode', 'yearDay0', 'days', 'seeds', 'motherGrowth'].every(k => old.meta && old.meta[k] === out.meta[k]);
    if (!same) throw new Error(`[시각표] ${process.env.OUT} 의 판 조건이 다르다 — 섞지 않는다. 다른 OUT 을 쓰라: ${JSON.stringify(old.meta)}`);
    const key = c => `${c.plant}|${c.lamps}`;
    const keep = (old.cases || []).filter(c => !out.cases.some(n => key(n) === key(c)));
    merged = { meta: out.meta, cases: [...keep, ...out.cases].sort((a, b) => a.lamps - b.lamps || a.plant.localeCompare(b.plant)) };
  }
  fs.writeFileSync(fp, JSON.stringify(merged, null, 1));
  console.log('\n⇒ 썼다:', process.env.OUT, '· 판', merged.cases.map(c => `${c.plant}/등${c.lamps}`).join(' '));
}
await page.close();
