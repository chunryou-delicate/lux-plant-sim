/* ============================================================
   test_species_growth.mjs — 새 식물 두 종(PP · AL) 생장 규칙을 지킨다 ([growth] 소유 · 2026-10-09 · 총괄 D45)
   ------------------------------------------------------------
   ★ 크롬 없음 · 서버 없음 — src/growth/species_growth.js 는 순수 모듈이라 node 로 바로 돈다.
   ★ 값은 손으로 안 베낀다 — data/growth_species.json · light_thresholds.json 에서 읽어 기대값을 낸다(값을 고쳐도 검사는 산다).
   ★ 무엇을 지키나
     A 정본이 실렸고 빛 줄이 없으면 «조용히» 기본값으로 안 넘어간다
     B 같은 씨앗 · 같은 빛 = 같은 그루 · 세이브(JSON 왕복)해도 같은 길
     C PP 잎 간격 = interval / (밴드 속도 × 계절) · 문턱 밑이면 안 남
     D PP 분홍이 «흐른다»(아래 잎 ± 흔들림) · 초록이면 그대로 초록 · 빛 모자라면 초록 쪽으로
     E PP 분홍 잎 줄 → 시드는 중(새 잎 멎음) → 안 자르면 진다 · 자르면 산다 · 분홍 잎만 간 삽수는 못 산다
     F PP 단계 사다리 · 잘라도 마디 번호는 그대로(성숙 줄기는 성숙 잎)
     G AL 구근 → 싹(그때 무늬 굴림) · 잎 최대 장수 · 사다리
     H AL 겨울 → 잎이 하나씩 진다 → 잠 → 봄에 깸 + 구근 1~3알
     I AL 구근 수 고르게 · J 무늬 몫(무늬 모주 3/4 · 민무늬 0 · 상점) · K 어두워서 든 잠 · 짧은 잠엔 구근 없음
     L 잘못 부르면 던진다 · M 그림 판이 실제로 있다
     node tools/test_species_growth.mjs
============================================================ */
import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSpeciesRules } from '../src/growth/species_growth.js';
import { seasonOf } from '../src/engine/weather.js';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const J = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const SPEC = J('data/growth_species.json'), TH = J('data/balance/light_thresholds.json');
const R = createSpeciesRules(SPEC, TH);
const PP = SPEC.species.pink_princess, AL = SPEC.species.alocasia_frydek;
let fail = 0;
const ok = (c, m) => { console.log((c ? '✅ ' : '⛔ ') + m); if (!c) fail++; };
const throws = (f) => { try { f(); return false; } catch (e) { return true; } };
/* days 일 걷는다 — dliOf(d) · seasonOf(d) 는 1부터. 사건을 날짜와 함께 모은다 */
const walk = (p, days, dliOf, seasonOfDay) => { const ev = []; for (let d = 1; d <= days; d++) for (const e of R.stepDay(p, { dli: dliOf(d), season: seasonOfDay(d) })) ev.push({ d, ...e }); return ev; };
const k = (v) => () => v;

/* A */
ok(R.species().join() === 'pink_princess,alocasia_frydek', 'A 정본 두 종이 실렸다');
const TH2 = JSON.parse(JSON.stringify(TH)); delete TH2.plants.alocasia_frydek;
ok(throws(() => createSpeciesRules(SPEC, TH2)), 'A 빛 줄(light_thresholds plants.alocasia_frydek)이 없으면 던진다 — 기본값으로 조용히 안 넘어간다');
const thPP = R.thresholdsOf(R.newPlant('pink_princess')), thALv = R.thresholdsOf({ ...R.newPlant('alocasia_frydek'), varie: 'marble' });
ok(thPP.min === TH.plants.philodendron_pink_princess.min && !thPP.variegated, `A PP 문턱 = 정본 줄 그대로(min ${thPP.min} · ×need_mult 안 곱함)`);
ok(Math.abs(thALv.min - TH.plants.alocasia_frydek.min * TH.variegated.need_mult) < 0.01, `A AL 무늬 그루 문턱 = ×${TH.variegated.need_mult}(min ${thALv.min})`);

/* B */
const runPP = (seed) => { const p = R.newPlant('pink_princess', { seed, leaves: 2 }); walk(p, 400, d => 3 + 4 * ((d * 37 % 11) / 10), d => seasonOf(135 + d)); return p; };
ok(JSON.stringify(runPP(11)) === JSON.stringify(runPP(11)), 'B PP 같은 씨앗 · 같은 빛 400일 = 같은 그루');
ok(JSON.stringify(runPP(11)) !== JSON.stringify(runPP(12)), 'B PP 다른 씨앗이면 다른 그루');
{ const a = R.newPlant('alocasia_frydek', { seed: 5, origin: 'shop' }); walk(a, 200, k(6), d => seasonOf(d));
  const b = JSON.parse(JSON.stringify(a));
  walk(a, 300, k(6), d => seasonOf(200 + d)); walk(b, 300, k(6), d => seasonOf(200 + d));
  ok(JSON.stringify(a) === JSON.stringify(b), 'B AL 세이브(JSON 왕복) 뒤에도 같은 길(500일 · 겨울 · 깸 포함)'); }

/* C — 잎 간격 */
const firstLeafDay = (dli, season) => { const p = R.newPlant('pink_princess', { seed: 3, pink: 0.3 }); const ev = walk(p, 120, k(dli), k(season)); const f = ev.find(e => e.type === 'leaf'); return f ? f.d : null; };
const band = (dli) => (dli < thPP.min ? null : dli < thPP.best_lo ? 'slow' : dli <= thPP.best_hi ? 'best' : 'good');
for (const [dli, se] of [[6, 'summer'], [3, 'spring'], [3, 'winter'], [6, 'autumn']]) {
  const want = Math.ceil(PP.interval_days / (PP.speed_by_band[band(dli)] * PP.season_speed[se]) - 1e-9);
  const got = firstLeafDay(dli, se);
  ok(got === want, `C PP 첫 새 잎 — DLI ${dli}(${band(dli)}) · ${se} → ${got}일 (기대 ${PP.interval_days}/(${PP.speed_by_band[band(dli)]}×${PP.season_speed[se]}) = ${want})`);
}
ok(firstLeafDay(thPP.min - 0.1, 'summer') === null, `C PP 문턱(min ${thPP.min}) 밑이면 120일 새 잎 없음`);

/* D — 분홍이 흐른다 */
{ let maxStep = 0, absorbBroken = 0, n = 0; const top = { dark: [], bright: [] }, green = { dark: 0, bright: 0 };
  for (const [name, dli] of [['dark', 3.0], ['bright', 6.0]]) for (let s = 1; s <= 60; s++) {
    const p = R.newPlant('pink_princess', { seed: s * 7919, pink: PP.pink.start });
    let prev = p.leaves[0].pink;
    for (let d = 1; d <= 300; d++) for (const e of R.stepDay(p, { dli, season: 'summer' })) {
      if (e.type === 'leaf') {
        n++;
        if (prev <= PP.pink.green_max) { if (e.pink !== 0) absorbBroken++; }
        else maxStep = Math.max(maxStep, Math.abs(e.pink - prev) - (dli < thPP.best_lo ? Math.abs(PP.pink.drift_low_light) : 0));
        prev = e.pink;
      }
      if (e.type === 'tip_withered') prev = p.leaves[p.leaves.length - 1].pink;
    }
    top[name].push(p.leaves[p.leaves.length - 1].pink);
    if (p.leaves[p.leaves.length - 1].pink <= PP.pink.green_max) green[name]++;
  }
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  ok(maxStep <= PP.pink.jitter + 1e-9, `D 새 잎 분홍 = 아래 잎 ± ${PP.pink.jitter} (+빛 끌림) — 잎 ${n}장 중 가장 큰 흔들림 ${maxStep.toFixed(3)}`);
  ok(absorbBroken === 0, `D 초록 잎(≤${PP.pink.green_max}) 위의 잎은 늘 초록(되돌아감은 가위로만 푼다) — 어긴 잎 ${absorbBroken}`);
  ok(mean(top.dark) < mean(top.bright) && green.dark > green.bright,
    `D 빛 모자람(3.0 < best_lo ${thPP.best_lo}) → 초록 쪽 — 300일 뒤 맨 위 분홍 평균 어두움 ${mean(top.dark).toFixed(2)} · 밝음 ${mean(top.bright).toFixed(2)} · 되돌아간 판 ${green.dark}/60 · ${green.bright}/60`); }

/* E — 분홍 잎 줄 · 시듦 · 자르기 */
{ const W = PP.pink.wither_streak, G = PP.pink.wither_grace_days, pk = PP.pink.pink_leaf_min + 0.05;
  const mk = () => R.newPlant('pink_princess', { seed: 9, pinks: [0.4, ...Array(W).fill(pk)] });
  const p = mk();
  ok(R.summary(p).withering && R.summary(p).pinkStreak === W, `E 위 ${W}장이 분홍 잎이면 시드는 중(받은 그루도 그날부터 잰다 · ${G}일 뒤)`);
  const ev = walk(p, G + 1, k(6), k('summer'));
  const w = ev.find(e => e.type === 'tip_withered');
  ok(w && w.d === G && w.count === W && !ev.some(e => e.type === 'leaf' && e.d <= G),
    `E 시드는 동안 새 잎 멎음 · ${G}일째 분홍 잎 ${w && w.count}장이 진다 — 남은 잎 ${p.leaves.length}(맨 위 분홍 ${p.leaves[p.leaves.length - 1].pink})`);
  const q = mk(); walk(q, 3, k(6), k('summer'));
  const { cutting, saved } = R.cutAbove(q, 2);
  ok(saved && !R.summary(q).withering && q.leaves.length === 2 && cutting.leaves.length === W - 1 && cutting.viable === false,
    `E 마디 2 바로 위를 자르면 산다(saved) — 모주 잎 ${q.leaves.length} · 삽수 잎 ${cutting.leaves.length}(전부 분홍 잎 → viable ${cutting.viable})`);
  const q2 = mk(); const c2 = R.cutAbove(q2, 1).cutting;
  ok(c2.viable === false && R.summary(c2).withering === false && q2.leaves.length === 1, 'E 마디 1 위를 자르면 분홍 잎 셋이 삽수로 — 못 산다(viable false)');
  const q3 = R.newPlant('pink_princess', { seed: 4, pinks: [0.3, 0.5, 0.95] });
  ok(R.cutAbove(q3, 1).cutting.viable === true, 'E 마블 잎이 한 장이라도 가면 삽수는 산다(viable true)');
  /* 자른 마디에서 다시 난다 — 새 잎 분홍은 «남은 맨 위 잎» 에서 흐른다 */
  let bad = 0;
  for (let s = 1; s <= 40; s++) {
    const m = R.newPlant('pink_princess', { seed: s, pinks: [0.2, 0.45, 0.8, 0.85] });
    R.cutAbove(m, 2);
    const e = walk(m, 60, k(6), k('summer')).find(x => x.type === 'leaf');
    if (!e || e.no !== 3 || Math.abs(e.pink - 0.45) > PP.pink.jitter + 1e-9) bad++;
  }
  ok(bad === 0, `E 마디 2 위를 자른 모주 40판 — 다음 잎은 마디 3 · 분홍은 0.45 ± ${PP.pink.jitter} (어긴 판 ${bad})`);
  ok(throws(() => R.cutAbove(R.newPlant('pink_princess', { pinks: [0.3, 0.3] }), 2)), 'E 맨 위 잎 위를 자르면(삽수에 잎 0) 던진다'); }

/* F — 사다리 */
{ const p = R.newPlant('pink_princess', { seed: 2, pink: 0.3 });
  walk(p, 400, k(6), k('summer'));
  const bad = p.leaves.filter(l => l.stage !== PP.leaf_ladder[Math.min(PP.leaf_ladder.length - 1, l.no - 1)]).length;
  ok(bad === 0 && p.leaves.length >= PP.leaf_ladder.length, `F PP 마디 n 의 잎 = 사다리[n] (잎 ${p.leaves.length}장 · 어긋남 ${bad})`);
  const m = R.newPlant('pink_princess', { seed: 2, pinks: Array(9).fill(0.3) });
  R.cutAbove(m, 8);
  const e = walk(m, 60, k(6), k('summer')).find(x => x.type === 'leaf');
  ok(e && e.no === 9 && m.leaves[m.leaves.length - 1].stage === 'mature', `F 마디 8 위를 잘라도 다음 잎은 마디 9 · ${m.leaves[m.leaves.length - 1].stage}(성숙 줄기)`); }

/* G — AL 구근 · 싹 · 최대 잎 · 사다리 */
{ const a = R.newPlant('alocasia_frydek', { seed: 21, origin: 'shop' });
  const ev = walk(a, 400, k(6), k('summer'));
  const sp = ev.find(e => e.type === 'sprout');
  ok(sp && sp.d === Math.ceil(AL.corm.sprout_days / AL.season_speed.summer - 1e-9), `G 구근 → ${sp && sp.d}일째 싹(sprout_days ${AL.corm.sprout_days} / 여름 ${AL.season_speed.summer})`);
  const leaves = ev.filter(e => e.type === 'leaf');
  ok(leaves.map(e => e.stage).slice(0, AL.leaf_ladder.length).join() === AL.leaf_ladder.join(), `G 잎이 날 때마다 한 칸씩 — ${leaves.slice(0, 6).map(e => e.stage).join('·')}`);
  ok(a.leaves.length === AL.max_leaves && ev.filter(e => e.type === 'leaf_drop').length === leaves.length - AL.max_leaves,
    `G 잎 최대 ${AL.max_leaves}장 — 새 잎 ${leaves.length} · 진 잎 ${ev.filter(e => e.type === 'leaf_drop').length}`);
  ok(ev.every(e => e.type !== 'dormancy_start'), 'G 늘 여름 · 밝음이면 잠이 안 든다'); }

/* H — 겨울잠과 봄 */
{ const a = R.newPlant('alocasia_frydek', { seed: 33, origin: 'shop' });
  const ev = walk(a, 460, k(6), d => seasonOf(d - 1));      // 0일 = 봄 첫날
  const ds = ev.find(e => e.type === 'dormancy_start'), asleep = ev.find(e => e.type === 'asleep'), wake = ev.find(e => e.type === 'wake');
  const drops = ev.filter(e => e.type === 'leaf_drop' && ds && e.d > ds.d && (!asleep || e.d <= asleep.d));
  const gaps = drops.slice(1).map((e, i) => e.d - drops[i].d);
  ok(ds && ds.why === 'season' && seasonOf(ds.d - 1) === 'winter' && seasonOf(ds.d - 2) !== 'winter', `H 겨울 첫날(${ds && ds.d}일째) 잠이 든다`);
  ok(drops.length >= 2 && gaps.every(g => g === AL.dormancy.drop_every_days) && asleep, `H 잎이 ${AL.dormancy.drop_every_days}일마다 하나씩 진다(${drops.length}장) → ${asleep && asleep.d}일째 잎 0 = 잠`);
  ok(wake && seasonOf(wake.d - 1) === 'spring' && wake.corms.length >= AL.propagation.corms_on_wake[0] && wake.corms.length <= AL.propagation.corms_on_wake[1],
    `H 봄(${wake && wake.d}일째)에 깬다 · 구근 ${wake && wake.corms.length}알`);
  const after = ev.filter(e => e.type === 'leaf' && wake && e.d > wake.d)[0];
  const nBefore = ev.filter(e => e.type === 'leaf' && ds && e.d < ds.d).length;           // 잠 전에 낸 잎 = 사다리 칸
  const want = AL.leaf_ladder[Math.max(0, Math.min(AL.leaf_ladder.length - 1, nBefore - AL.dormancy.wake_ladder_drop))];
  ok(after && after.stage === want,
    `H 깬 뒤 첫 잎 ${after && after.d}일째 · ${after && after.stage} — 잠 전 잎 ${nBefore}장 사다리에서 ${AL.dormancy.wake_ladder_drop}칸 내려옴(기대 ${want})`);
  /* 사다리가 아직 꼭대기가 아닌 그루(여름 끝에 심음)로 «내려옴»을 날카롭게 본다 */
  const late = R.newPlant('alocasia_frydek', { seed: 2, origin: 'from_plain_mother' });
  const ev2 = walk(late, 300, k(6), d => seasonOf(199 + d));
  const ds2 = ev2.find(e => e.type === 'dormancy_start'), w2 = ev2.find(e => e.type === 'wake');
  const n2 = ev2.filter(e => e.type === 'leaf' && e.d < ds2.d).length, a2 = ev2.filter(e => e.type === 'leaf' && e.d > w2.d)[0];
  const want2 = AL.leaf_ladder[Math.max(0, Math.min(AL.leaf_ladder.length - 1, n2 - AL.dormancy.wake_ladder_drop))];
  ok(n2 < AL.leaf_ladder.length && a2 && a2.stage === want2, `H 늦게 심은 그루 — 잠 전 잎 ${n2}장(${ev2.filter(e => e.type === 'leaf' && e.d < ds2.d).map(e => e.stage).join('·')}) → 깬 뒤 첫 잎 ${a2 && a2.stage}(기대 ${want2})`); }

/* I — 구근 수 고르게 */
{ const cnt = {}; const N = 600;
  for (let s = 1; s <= N; s++) {
    const a = R.newPlant('alocasia_frydek', { seed: s * 104729, origin: 'shop' });
    const w = walk(a, 400, k(6), d => seasonOf(d - 1)).find(e => e.type === 'wake');
    const n = w ? w.corms.length : -1; cnt[n] = (cnt[n] || 0) + 1;
  }
  const [lo, hi] = AL.propagation.corms_on_wake, span = hi - lo + 1;
  const even = Array.from({ length: span }, (_, i) => cnt[lo + i] || 0).every(c => Math.abs(c / N - 1 / span) < 0.06);
  ok(even && !cnt[-1], `I 구근 ${lo}~${hi}알 고르게 — ${N}판 ${JSON.stringify(cnt)}`); }

/* J — 무늬 몫 */
{ const N = 800; const share = (origin, motherKind) => { let v = 0; const kinds = {};
    for (let s = 1; s <= N; s++) { const a = R.newPlant('alocasia_frydek', { seed: s * 7919 + 1, origin, motherKind });
      const e = walk(a, 30, k(6), k('spring')).find(x => x.type === 'sprout'); if (e.varie) { v++; kinds[e.varie] = (kinds[e.varie] || 0) + 1; } }
    return { p: v / N, kinds }; };
  const vm = share('from_varie_mother', 'sector'), pm = share('from_plain_mother', null), sh = share('shop', null);
  const C = AL.corm.varie_chance;
  ok(Math.abs(vm.p - C.from_varie_mother) < 0.04 && Object.keys(vm.kinds).join() === 'sector', `J 무늬 모주 구근 무늬 ${vm.p.toFixed(3)}(기대 ${C.from_varie_mother}) · 갈래는 모주 것 ${JSON.stringify(vm.kinds)}`);
  ok(pm.p === C.from_plain_mother, `J 민무늬 모주 구근 무늬 ${pm.p}(기대 ${C.from_plain_mother})`);
  ok(Math.abs(sh.p - C.shop) < 0.04 && Object.keys(sh.kinds).length === 2, `J 상점 구근 무늬 ${sh.p.toFixed(3)}(기대 ${C.shop}) · 갈래 고르게 ${JSON.stringify(sh.kinds)}`);
  /* 깬 날 낸 구근이 모주 무늬를 잇는다 */
  const a = R.newPlant('alocasia_frydek', { seed: 77, origin: 'from_varie_mother', motherKind: 'marble' });
  const w = walk(a, 400, k(8), d => seasonOf(d - 1)).find(e => e.type === 'wake');
  ok(a.varie === 'marble' ? w.corms.every(c => c.origin === 'from_varie_mother' && c.motherKind === 'marble') : w.corms.every(c => c.origin === 'from_plain_mother'),
    `J 깬 날 구근 ${w.corms.length}알이 모주(${a.varie || '민무늬'})를 출처로 단다`); }

/* K — 어두워서 든 잠 · 짧은 잠엔 구근 없음 */
{ const a = R.newPlant('alocasia_frydek', { seed: 8, origin: 'shop' });
  walk(a, 80, k(6), k('summer'));
  /* avg7 은 밝던 날을 끌고 온다 — 문턱 밑으로 «내려간 날»부터 센다(무늬 그루면 문턱이 ×1.4 라 더 일찍 내려간다) */
  const min = R.thresholdsOf(a).min, h = a.hist.slice(); let cross = null;
  for (let d = 1; d <= 7 && cross == null; d++) { h.push(1.0); h.shift(); if (h.reduce((x, y) => x + y, 0) / h.length < min) cross = d; }
  const dark = walk(a, 120, k(1.0), k('summer'));
  const ds = dark.find(e => e.type === 'dormancy_start'), sl = dark.find(e => e.type === 'asleep');
  ok(ds && ds.why === 'low_light' && ds.d === cross + AL.dormancy.low_days - 1,
    `K 늘 여름이어도 avg7 이 문턱(${min}) 밑 ${AL.dormancy.low_days}일이면 잠 — 내려간 날 ${cross}일째 → ${ds && ds.d}일째 · ${ds && ds.why}`);
  const light = walk(a, 30, k(6), k('summer')); const w = light.find(e => e.type === 'wake');
  ok(sl && w && w.corms.length > 0, `K 잎 0 으로 ${AL.propagation.min_sleep_days}일 넘게 잔 뒤 밝히면 깸 + 구근 ${w && w.corms.length}`);
  const b = R.newPlant('alocasia_frydek', { seed: 8, origin: 'shop' });
  walk(b, 80, k(6), k('summer')); walk(b, AL.dormancy.low_days + AL.max_leaves * AL.dormancy.drop_every_days + 3, k(1.0), k('summer'));
  const wb = walk(b, 30, k(6), k('summer')).find(e => e.type === 'wake');
  ok(R.summary(b).phase === 'growing' && wb && wb.corms.length === 0, `K 잠깐(잎 0 으로 ${AL.propagation.min_sleep_days}일 미만) 재웠다 깨우면 구근 0 — 어두운 데 넣었다 빼서 구근을 찍지 못한다`); }

/* L — 잘못 부르면 던진다 */
const pp = R.newPlant('pink_princess');
ok(throws(() => R.stepDay(pp, { dli: 5 })), 'L 계절 없이 하루를 넘기면 던진다');
ok(throws(() => R.stepDay(pp, { dli: NaN, season: 'summer' })), 'L DLI 가 없으면 던진다(0 으로 안 넘긴다)');
ok(throws(() => R.cutAbove(R.newPlant('alocasia_frydek'), 1)), 'L AL 은 자르지 않는다(던진다)');
ok(throws(() => R.newPlant('monstera_deliciosa')), 'L 몬스테라는 이 규칙에 없다(plant_grow 가 키운다)');
ok(throws(() => R.newPlant('alocasia_frydek', { origin: 'gift' })), 'L 모르는 구근 출처는 던진다');

/* M — 판이 실제로 있다 */
{ const miss = [];
  for (const S of Object.values(SPEC.species)) for (const [st, row] of Object.entries(S.assets)) if (!st.startsWith('_'))
    for (const [g, a] of Object.entries(row)) if (!g.startsWith('_') && !fs.existsSync(path.join(ROOT, 'assets', a))) miss.push(a);
  ok(miss.length === 0, `M 판 표의 GLB 가 assets/ 에 다 있다${miss.length ? ' — 없음 ' + miss.join(' · ') : ''}`);
  const rows = R.leafRows(R.newPlant('pink_princess', { pinks: [0, 0.3, 0.7, 0.95], nodes: 8 }));
  ok(rows.map(r => r.grade).join() === 'green,marble,heavy,pink' && rows[3].asset.endsWith('pp_leaf_mature_pinkheavy.glb') && rows[0].size_m === PP.leaf_size_m.mid,
    `M PP 그림 줄 — ${rows.map(r => `${r.no}:${r.stage}/${r.grade}`).join(' ')}`); }

console.log('\nspecies_growth: ' + (fail ? 'FAIL' : 'PASS'));
process.exitCode = fail ? 1 : 0;
