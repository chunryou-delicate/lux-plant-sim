/* ============================================================
   probe_species_oneroom.mjs — 새 두 종 첫 판 값을 원룸 정본 빛에 걸어 본다 ([growth] 소유 · 2026-10-09 · 총괄 D45)
   ------------------------------------------------------------
   ★ «값이 무엇을 낳나»만 잰다 — 값은 안 바꾼다. 바로잡기는 core 판(안내대로 500만 · 13달)이 한다.
   ★ 크롬 없음 — 빛은 room_profile(원룸 정본 real), 생장은 src/growth/species_growth.js.
   ★ 판
     PP: 원룸 PP_DAY 일째 교환으로 받는다(잎 2 · 분홍 start) → 원룸 끝(END)까지. 두 손:
         «그냥 둠»(가위 안 씀) · «가위»(맨 위가 초록이 되거나 분홍 잎 줄로 시드는 중이면 가장 높은 마블·분홍 많음 마디 바로 위를 자른다)
     AL: 원룸 AL_DAY 일째 상점 구근을 심는다 → END 까지. 싹 · 잎 · 잠 · 봄 깸(구근을 내며 깬 첫날 —
         잠에서 깸 또는 D49 잠든 구근의 싹틈) · 구근.
   ⚠ 이사 날이 한 해의 어디냐(YD0)에 따라 겨울이 앞뒤로 움직인다 — 총괄 봇 판(cut1008c)이 정하면 YD0= 로 다시.
     YD0S=135,0,90,180,270,315 LAMPS=0,1 SEEDS=60 node tools/probe_species_oneroom.mjs
   ⛔ 값·확률·문턱은 안 건드린다.
============================================================ */
import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProfileLight } from '../src/game/room_profile.js';
import { seasonOf } from '../src/engine/weather.js';
import { createSpeciesRules } from '../src/growth/species_growth.js';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const J = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const FILE = process.env.PROFILE || 'data/profiles/room_profile.oneroom.json';
const SLOT = process.env.SLOT || 'oneroom-sill:0';
const LAMPS = (process.env.LAMPS || '0,1').split(',').map(Number);
const YD0S = (process.env.YD0S || '135,0,90,180,270,315').split(',').map(Number);
const SEEDS = Number(process.env.SEEDS || 60), END = Number(process.env.END || 395);
const PP_DAY = Number(process.env.PP_DAY || 30), AL_DAY = Number(process.env.AL_DAY || 60);
const TH = J('data/balance/light_thresholds.json'), SPEC = J('data/growth_species.json');
const R = createSpeciesRules(SPEC, TH);
const P = J(FILE);
const q = (a, f) => { const v = a.filter(x => x != null).sort((x, y) => x - y); return v.length ? v[Math.min(v.length - 1, Math.floor(f * (v.length - 1)))] : null; };
const med = a => q(a, 0.5);
console.log(`══ 새 두 종 · 원룸 정본 real · ${FILE} · roomRev ${String(P.roomRev || '').split(' ')[0]} · ${SLOT} · 원룸 ${END}일 · ${SEEDS}판 · PP ${PP_DAY}일째 받음 · AL ${AL_DAY}일째 구근`);
const rows = [];
for (const YD0 of YD0S) for (const lamps of LAMPS) {
  const light = createProfileLight({ ...P, uidStable: true }, { thresholds: TH, weather: J('data/balance/weather.json'), electricity: J('data/balance/electricity.json') });
  const dli = [], season = [];
  for (let d = 1; d <= END; d++) {
    const s = (light.daily(d, { sim: { mode: 'real', yearDay0: YD0 }, lamps: { count: lamps, litHours: 12 }, pots: [], placedItems: [] }).report.slots || []).find(x => x.slotId === SLOT);
    if (!s) throw new Error(`[probe] 자리 ${SLOT} 가 없다`);
    dli.push(s.dli); season.push(seasonOf(YD0 + d));
  }
  /* PP — 두 손(그냥 둠 · 가위) */
  const PPS = SPEC.species.pink_princess.pink;
  const ppRun = (scissors) => {
    const o = { leaves: [], green: 0, withered: [], topPink: [], pinkLeaves: [], marbleShare: [], cuts: [] };
    for (let s = 1; s <= SEEDS; s++) {
      const p = R.newPlant('pink_princess', { seed: s * 7919, leaves: 2 });
      let n = 0, w = 0, pk = 0, mb = 0, cuts = 0;
      for (let d = PP_DAY; d <= END; d++) {
        for (const e of R.stepDay(p, { dli: dli[d - 1], season: season[d - 1] })) {
          if (e.type === 'leaf') { n++; if (e.grade === 'pink') pk++; if (e.grade === 'marble' || e.grade === 'heavy') mb++; }
          if (e.type === 'tip_withered') w++;
        }
        if (scissors) {
          const top = p.leaves[p.leaves.length - 1];
          if (top.pink <= PPS.green_max || p.witherAt != null) {
            const good = p.leaves.filter(l => l.pink > PPS.green_max && l.pink < PPS.pink_leaf_min);
            const at = good.length ? good[good.length - 1].no : null;
            if (at != null && at < top.no) { R.cutAbove(p, at); cuts++; }
          }
        }
      }
      o.leaves.push(n); o.withered.push(w); o.pinkLeaves.push(pk); o.marbleShare.push(n ? mb / n : 0); o.cuts.push(cuts);
      const top = p.leaves[p.leaves.length - 1].pink; o.topPink.push(top);
      if (top <= PPS.green_max) o.green++;
    }
    return o;
  };
  const pp = ppRun(false), ppc = ppRun(true);
  /* AL */
  /* «봄 깸» = 구근을 내며 깬 첫날 — 잠에서 깸(wake · 구근 있음) 또는 잠든 구근의 싹틈(sprout slept · D49) */
  const al = { sprout: [], leaves: [], sleep: [], wake: [], corms: [], wakeIn: 0, varie: 0, viaSprout: 0 };
  for (let s = 1; s <= SEEDS; s++) {
    const a = R.newPlant('alocasia_frydek', { seed: s * 104729, origin: 'shop' });
    let sp = null, n = 0, sl = null, wk = null, cm = 0, via = null;
    for (let d = AL_DAY; d <= END; d++) for (const e of R.stepDay(a, { dli: dli[d - 1], season: season[d - 1] })) {
      if (e.type === 'sprout') { sp = d; if (e.slept && e.corms.length && wk == null) { wk = d; cm = e.corms.length; via = 'sprout'; } }
      if (e.type === 'leaf') n++;
      if (e.type === 'dormancy_start' && sl == null) sl = d;
      if (e.type === 'wake' && e.corms.length && wk == null) { wk = d; cm = e.corms.length; via = 'wake'; }
    }
    al.sprout.push(sp); al.leaves.push(n); al.sleep.push(sl); al.wake.push(wk); al.corms.push(cm);
    if (wk != null) al.wakeIn++; if (via === 'sprout') al.viaSprout++; if (a.varie) al.varie++;
  }
  const ppRow = (o) => ({ newLeaves: med(o.leaves), revertedPlants: o.green, topPinkMedian: med(o.topPink), witheredPlants: o.withered.filter(x => x > 0).length,
    pinkLeavesMedian: med(o.pinkLeaves), marbleShareMedian: +med(o.marbleShare).toFixed(2), cutsMedian: med(o.cuts) });
  const row = { yearDay0: YD0, lamps, pp: ppRow(pp), ppScissors: ppRow(ppc),
    al: { sprout: med(al.sprout), leaves: med(al.leaves), sleep: med(al.sleep), springWake: med(al.wake), springWakeWithin: al.wakeIn, viaSleepingCorm: al.viaSprout,
          wokeBy: Object.fromEntries([240, 300, 365, END].map(D => [D, al.wake.filter(w => w != null && w <= D).length])),
          cormsMedian: med(al.corms.filter((x, i) => al.wake[i] != null)), varie: al.varie } };
  rows.push(row);
  const sMin = Math.min(...dli).toFixed(2), sMax = Math.max(...dli).toFixed(2);
  const f = (r) => `새 잎 ${r.newLeaves} · 마블 몫 ${r.marbleShareMedian} · 끝에 초록 ${r.revertedPlants}/${SEEDS} · 시든 판 ${r.witheredPlants}${r.cutsMedian ? ' · 자름 ' + r.cutsMedian : ''}`;
  console.log(`  YD0 ${String(YD0).padStart(3)} 등${lamps} (DLI ${sMin}~${sMax}) | PP 그냥 둠: ${f(row.pp)} | 가위: ${f(row.ppScissors)}`);
  console.log(`  ${' '.repeat(30)} | AL 싹 ${row.al.sprout} · 잎 ${row.al.leaves} · 첫 잠 ${row.al.sleep ?? '—'} · 봄 깸(구근) ${row.al.springWake ?? '—'} — ${al.wakeIn}/${SEEDS} 판이 ${END}일 안에(잠든 구근 싹틈 ${al.viaSprout}) · 구근 ${row.al.cormsMedian ?? '—'}`);
  console.log(`  ${' '.repeat(30)} |    봄 깸 몫 — 240일(8달) ${row.al.wokeBy[240]} · 300일(10달) ${row.al.wokeBy[300]} · 365일(12달) ${row.al.wokeBy[365]} · ${END}일 ${row.al.wokeBy[END]} (/${SEEDS})`);
}
console.log('  (날 = 원룸 날 · 중앙값 · 마블 몫 = 새 잎 중 마블·분홍 많음 · 끝에 초록 = 원룸 끝에 맨 위 잎이 초록)');
if (process.env.OUT) fs.writeFileSync(path.join(ROOT, process.env.OUT), JSON.stringify({ meta: { profile: FILE, slot: SLOT, end: END, seeds: SEEDS, ppDay: PP_DAY, alDay: AL_DAY, mode: 'real' }, rows }, null, 1));
