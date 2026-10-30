/* ============================================================
   probe_cut_open_knobs.mjs — 반지하 창턱에서 ✂ 가 열리는 날을 «무엇이 정하나» 가르고, 손잡이 후보를 «재는 판에서만» 끼워 본다
   ([growth] 소유 · 2026-10-25 · 총괄 회의 «요령 없이도 깨게» §3 growth 물음 ①·③)
   ------------------------------------------------------------
   ★ 잎3(하프문)의 세 날을 가른다
     ① 나는 날          잎 간격표(data/growth_tuning.json leaf_interval · 생장일 누적 120)를 걷는 빠르기 = 밴드 걸음(slow 1 · best 1.25)
     ② 중간잎에 닿는 날  시간 자동(plant_grow §stepMaturation · stageMid 0.66 × matSpan 120) — 이 날 첫 기회가 온다
     ③ 갈라지는 날      게이지 + 굴림(plant_grow §matGaugeStep · §calcMatureProb · growth_tuning mature_prob)
     ✂ 문 = propagation §cutBlockedReason 그대로(무늬이면서 갈라진 잎 ≥ 2 + 초보 모주 문)
   ★ 판: probe_cut_open_banjiha 와 같은 판을 vm 으로 — 반지하 sill:0 · novice · 첫 그루(잎2·3 무늬) · 도착 생장일 45 · 물 늘 줌
        · 코어 걸음(밝기 속도 적립 · loop.js §growthStepsOf 와 같은 셈) · 빛은 «게임 날»로 뽑는다
   ★ 날 = 게임 날. 그루가 자라기 시작하는 날을 GROW_FROM(기본 9)으로 둔다 — 하네스 probe_branches 의 leafAt «30일 끝 생장일 67»(= 45 + 22일)에서 거꾸로 셈.
   ★ 손잡이(이 프로세스 안의 GT 만 덮는다 · 정본 파일은 안 바꾼다)
     base        지금 그대로
     gauge_lo    느린 밴드(7일평균 2.7~5.0)의 기회 빈도 0.6 → 1.4(밝은 밴드와 같게)
     roll_lo     문턱(fenestrate 6.0) 아래 굴림 0.10 → 0.20 · 0.30
     fail_reset  실패 뒤 게이지 0.5 → 0.75
     first2      [셈] 첫 그루 잎2·3 은 «첫 기회»(= 중간잎에 닿는 날)에 갈라진다 — 코드에 없는 가정 · base 판에서 같이 센다
   크롬 없음(vm · probe_leaf_health_year 의 loadGrowth)
     SEEDS=40 DAYS=420 node tools/probe_cut_open_knobs.mjs
     OUT=docs/handoff/growth-cut-open-knobs.json 이면 JSON 도 쓴다
     ★ 시간 축 가정 — AGE0=60(도착 생장일 45 대신) · SPEED_BEST=1.5 · SPEED_SLOW=1.25(걸음 밴드 대신) · KNOBS=base(손잡이 줄 고르기)
   ⛔ 정본 값·확률·문턱은 안 건드린다.
============================================================ */
import fs from 'node:fs'; import path from 'node:path'; import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createProfileLight } from '../src/game/room_profile.js';
import { GROWTH_STEPS_MAX } from '../src/game/loop.js';
import { ARRIVAL } from '../src/game/state.js';
import { cutBlockedReason } from '../src/game/propagation.js';
import * as sh from '../src/game/shop.js';
import { loadGrowth } from './probe_leaf_health_year.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const J = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const SEEDS = Number(process.env.SEEDS || 40), DAYS = Number(process.env.DAYS || 420), YD0 = Number(process.env.YD0 || 135);
const GROW_FROM = Number(process.env.GROW_FROM || 9), SLOT = process.env.SLOT || 'banjiha-sill:0', MODE = process.env.MODE || 'novice';
const TH = J('data/balance/light_thresholds.json'), T = TH.plants.monstera_deliciosa;
/* ★ 시간 축 가정(재는 판에서만) — AGE0 = 도착 생장일(state.js ARRIVAL.growthDays 대신) · SPEED_SLOW/SPEED_BEST = 걸음(growth_speed.by_band 대신) */
const BY = { ...J('data/growth_tuning.json').growth_speed.by_band,
  ...(process.env.SPEED_SLOW ? { slow: Number(process.env.SPEED_SLOW) } : {}), ...(process.env.SPEED_BEST ? { best: Number(process.env.SPEED_BEST) } : {}) };
const AGE0 = Number(process.env.AGE0 || ARRIVAL.growthDays);
const bandOf = d => d < T.die ? 'critical' : d < T.survive ? 'poor' : d < T.min ? 'stagnant'
  : d < T.best_lo ? 'slow' : d <= T.best_hi ? 'best' : d <= T.max ? 'good' : 'over';
sh.installVarieGrades(J('data/balance/varie_grades.json'));
const G = loadGrowth();
for (let i = 0; i < 400 && !G.thLoaded(); i++) await new Promise(r => setImmediate(r));
if (!G.thLoaded()) throw new Error('임계값 정본(data/growth_tuning.json)이 안 실렸습니다');
const run = code => vm.runInContext(code, G);
const BASE_MAT = JSON.parse(run('JSON.stringify(GT.mature)'));
const setMat = patch => run(`Object.assign(GT.mature, ${JSON.stringify({ ...BASE_MAT, ...patch })})`);
const seedTo = v => { try { G.plantSeed(v); } catch (e) { /* vm — 그리기만 던진다 */ } };

/* 빛 줄 — 게임 날 GROW_FROM 부터. 등은 게임 날 lampDay 부터 n 개 */
const P = J('data/profiles/room_profile.banjiha.json');
const light = createProfileLight({ ...P, uidStable: true },
  { thresholds: TH, weather: J('data/balance/weather.json'), electricity: J('data/balance/electricity.json') });
const series = (n, lampDay) => {
  const dli = [], mult = [], a7 = [];
  for (let day = GROW_FROM; day < GROW_FROM + DAYS; day++) {
    const c = (n > 0 && day >= lampDay) ? n : 0;
    const s = (light.daily(day, { sim: { mode: MODE, yearDay0: YD0 }, lamps: { count: c, litHours: 12 }, pots: [], placedItems: [] }).report.slots || []).find(x => x.slotId === SLOT);
    dli.push(s ? s.dli : 0);
    const w = dli.slice(-7), a = w.reduce((x, y) => x + y, 0) / w.length; a7.push(a);
    let m = BY[bandOf(a)]; if (typeof m !== 'number' || m < 1) m = 1; mult.push(Math.min(m, GROWTH_STEPS_MAX));
  }
  return { dli, mult, a7 };
};
const CASES = [
  { id: 'L0',    ko: '창턱 · 등 0',               ...series(0, 0) },
  { id: 'L1@47', ko: '창턱 · 등 1(게임 47일째 닮)', ...series(1, 47) },
  { id: 'L1@20', ko: '창턱 · 등 1(게임 20일째 닮)', ...series(1, 20) },
];
const KNOBS = [
  { id: 'base',        ko: '지금 그대로',                  patch: {} },
  { id: 'gauge_lo1.4', ko: 'gauge_lo 0.6 → 1.4',          patch: { gauge_lo: 1.4 } },
  { id: 'roll_lo0.2',  ko: 'roll_lo 0.10 → 0.20',         patch: { roll_lo: 0.2 } },
  { id: 'roll_lo0.3',  ko: 'roll_lo 0.10 → 0.30',         patch: { roll_lo: 0.3 } },
  { id: 'reset0.75',   ko: 'fail_reset 0.5 → 0.75',       patch: { fail_reset: 0.75 } },
].filter(k => !process.env.KNOBS || process.env.KNOBS.split(",").includes(k.id));
const S = { sim: { mode: 'novice' }, tutorial: {}, pots: [{ id: 'p1', cuts: [] }], cuttings: [] };
const plainId = sh.plainGradeId();
/* 열린 날 «제일 값나가는» 자를 수 있는 삽수 값(probe_cut_open_banjiha §값 과 같은 셈 · 잎2 산반 · 잎3 하프문 · 그 밖 무늬는 산반) */
const maxWonOf = (ok, on, varieOn) => {
  const lm = new Map(G.leafOnPlantAll().map(x => [x.leafBirth, x.leafM]));
  const gradeOf = lb => { if (!varieOn.has(lb)) return plainId; const rk = on.indexOf(lb) + 1; return rk === 2 ? 'sanban' : rk === 3 ? 'halfmoon' : 'sanban'; };
  let best = null;
  for (const n of ok) { const lbs = (n.leafBirths || []).slice(); const gs = lbs.map(gradeOf); const ms = lbs.map(lb => lm.has(lb) ? lm.get(lb) : 1);
    const pz = sh.priceOf({ species: 'monstera', leaves: lbs.length, variegatedLeaves: gs.filter(g => g !== plainId).length, leafGrades: gs, leafM: ms, form: 'cutting' });
    if (best == null || pz.won > best) best = pz.won; }
  return best;
};
const oneRun = (c, seed, wantFirst2) => {
  /* 차례는 게임 · 하네스와 같다(byeot_harness §makeGrowth — 프롤로그 보장은 setGrowth(도착) 바로 뒤) */
  seedTo(seed); G.matResetAll(); G.resetDailyLight(); G.setGrowth(AGE0); G.setPrologueVarieLeaf([2, 3]); G.leafStats();
  const r = { born2: null, born3: null, mid2: null, mid3: null, mat2: null, mat3: null, rolls3: null, door: null, doorWon: null, door2: null, door2Won: null };
  let credit = 0;
  for (let k = 0; k < DAYS; k++) {
    const day = GROW_FROM + k;
    const blocked = !!G.growthBlocked(); let steps = 1;
    if (!blocked) { credit += c.mult[k]; steps = Math.min(GROWTH_STEPS_MAX, Math.floor(credit + 1e-9)); credit -= steps; steps = Math.max(1, steps); }
    for (let i = 0; i < steps; i++) { G.setDailyLight(c.dli[k]); G.advanceTo(G.calendarDay() + 1); }
    G.leafStats();
    const on = [...new Set(G.leafOnPlantAll().filter(x => x.onPlant).map(x => x.leafBirth))].sort((a, b) => a - b);
    const lb2 = on[1], lb3 = on[2];
    if (lb2 != null && r.born2 == null) r.born2 = day;
    if (lb3 != null && r.born3 == null) r.born3 = day;
    const m2 = lb2 != null ? G.matStateOf(lb2) : null, m3 = lb3 != null ? G.matStateOf(lb3) : null;
    if (m2 && r.mid2 == null) r.mid2 = day;
    if (m3 && r.mid3 == null) r.mid3 = day;
    if (m2 && m2.matured && r.mat2 == null) r.mat2 = day;
    if (m3 && m3.matured && r.mat3 == null) { r.mat3 = day; r.rolls3 = m3.rolls; }
    const varieOn = new Set(G.varieStateAll().filter(v => v.varie && on.includes(v.leafBirth)).map(v => v.leafBirth));
    if (r.door == null) {
      const vmN = [...varieOn].filter(lb => G.matureOf(lb)).length;
      if (vmN >= 2) { const nodes = G.cuttableNodes() || [];
        const ok = nodes.filter(n => cutBlockedReason(S, nodes, n.nodeId, { pot: S.pots[0], varieMaturedLeaves: vmN }) == null);
        if (ok.length) { r.door = day; r.doorWon = maxWonOf(ok, on, varieOn); } }
    }
    /* [셈] first2 — 잎2·3 이 중간잎에 닿았으면 «갈라졌다»고 치고 초보 모주 문만 본다 */
    if (wantFirst2 && r.door2 == null && r.mid2 != null && r.mid3 != null) {
      const nodes = G.cuttableNodes() || [];
      const ok = nodes.filter(n => cutBlockedReason(S, nodes, n.nodeId, { pot: S.pots[0], varieMaturedLeaves: 2 }) == null);
      if (ok.length) { r.door2 = day; r.door2Won = maxWonOf(ok, on, varieOn); }
    }
    if (r.door != null && r.mat3 != null && (!wantFirst2 || r.door2 != null)) break;
  }
  return r;
};
const q = (a, f) => { const v = a.filter(x => x != null).sort((x, y) => x - y); return v.length ? v[Math.min(v.length - 1, Math.floor(f * (v.length - 1)))] : null; };
const med = a => q(a, 0.5), p10 = a => q(a, 0.1), p90 = a => q(a, 0.9);
const miss = a => a.filter(x => x == null).length;
const by = n => Number.isFinite(n) ? `${Math.round(n / 10000)}만` : '—';
console.log(`══ 반지하 ✂ 문 — 무엇이 정하나 · 손잡이 후보 · ${SEEDS}판 · ${DAYS}일 · 크롬 없음(vm) · 날 = 게임 날(그루 자람 시작 ${GROW_FROM}일)`);
console.log(`   판 ${SLOT} · ${MODE} · 첫 그루(잎2·3 무늬) · 도착 생장일 ${AGE0}${AGE0 !== ARRIVAL.growthDays ? ` ★가정(정본 ${ARRIVAL.growthDays})` : ""} · 걸음 slow ${BY.slow} · best ${BY.best} · 정본 mature_prob ${JSON.stringify(BASE_MAT)}`);
for (const c of CASES) {
  const a7 = c.a7.slice(7, 140), lo = Math.min(...a7), hi = Math.max(...a7);
  console.log(`   ${c.ko} — 7일평균 DLI ${lo.toFixed(2)}~${hi.toFixed(2)}(게임 ${GROW_FROM + 7}~${GROW_FROM + 139}일) · 밴드 ${[...new Set(c.a7.slice(7, 140).map(bandOf))].join('/')}`);
}
const OUT = { args: { SEEDS, DAYS, YD0, GROW_FROM, SLOT, MODE, AGE0, speed: { slow: BY.slow, best: BY.best }, baseMature: BASE_MAT }, cases: {} };
for (const c of CASES) {
  console.log(`\n■ ${c.ko}`);
  console.log('   손잡이                     잎3 남   잎3 중간잎   잎3 갈라짐(중앙·10%·90% · 못함)   굴린 횟수   ✂ 문(중앙·10%·90% · 못함)   열린 날 값(중앙)');
  OUT.cases[c.id] = {};
  for (const K of KNOBS) {
    setMat(K.patch);
    const rs = []; for (let s = 1; s <= SEEDS; s++) rs.push(oneRun(c, s * 7919, K.id === 'base'));
    const row = { knob: K.ko, patch: K.patch, runs: rs };
    OUT.cases[c.id][K.id] = row;
    const pick = f => rs.map(r => r[f]);
    console.log(`   ${K.ko.padEnd(26)} ${String(med(pick('born3'))).padStart(5)}   ${String(med(pick('mid3'))).padStart(8)}     ` +
      `${med(pick('mat3'))} · ${p10(pick('mat3'))} · ${p90(pick('mat3'))} · ${miss(pick('mat3'))}/${SEEDS}`.padEnd(32) +
      `   ${String(med(pick('rolls3'))).padStart(5)}      ${med(pick('door'))} · ${p10(pick('door'))} · ${p90(pick('door'))} · ${miss(pick('door'))}/${SEEDS}`.padEnd(34) +
      `   ${by(med(pick('doorWon')))}`);
    if (K.id === 'base')
      console.log(`   ${'[셈] first2(잎2·3 첫 기회에 갈라짐)'.padEnd(26)}                                                              ` +
        `${med(pick('door2'))} · ${p10(pick('door2'))} · ${p90(pick('door2'))} · ${miss(pick('door2'))}/${SEEDS}`.padEnd(34) + `   ${by(med(pick('door2Won')))}`);
  }
}
setMat({});
if (process.env.OUT) { fs.writeFileSync(path.join(ROOT, process.env.OUT), JSON.stringify(OUT, null, 1)); console.log(`\n   JSON — ${process.env.OUT}`); }
