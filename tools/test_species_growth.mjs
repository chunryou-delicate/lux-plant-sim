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
     H AL 겨울 → 잎이 하나씩 진다 → 잠(그날 구근 1~3알 · D52) → 봄에 «다시 깸»(구근 없음)
     I AL 구근 수 고르게 · J 무늬 몫(무늬 모주 3/4 · 민무늬 0 · 상점) · K 어두워서 든 잠 · 구근 찍기 막힘
     N D49 잠든 구근(겨울에 심은 구근은 싹틀 때 구근 1~3알) · ★ D52 구근은 «잠에 들 때»(잎이 다 지는 날) 찾는다 · 봄 깸엔 없다
     O D56 구근 찾기는 평생 두 번(세 번째 잠부터 0 · 잠든 구근 싹틈도 한 번) · 칸을 빼면 세 번째에도 찾는 대조
     L 잘못 부르면 던진다 · M 그림 판이 실제로 있다
     ★ D71(2026-10-23 · 총괄) — 두 종 더
     P SC 스킨답서스: 삽수(뿌리 없음) → 놓인 날 root_days 에 뿌리(빛 무관) · 뿌리 뒤엔 dropM 없으면 던짐 · 마디 간격 ·
       줄기 길이는 날마다 이어서 늘고 상한(떨어지는 높이 dropM + 화분 넘는 몫)에서 바닥에 닿아 멈춤 · longVineM(D76 0.5 · 곁줄은 높은 자리에 놓인 채로 셈) ·
       높은 데 → 낮은 데로 옮겨도 안 줆 · 다시 높이면 이어 자람 · 어두울 때 난 잎은 초록(그림만) · 마디 자르기 · 세이브 왕복
     Q CA 칼라테아: 맡은 그루(다 말림) · 너무 밝으면(avg7 > hi) 말리고 멎음 · 대역 안이면 새 잎부터 며칠에 걸쳐 펴짐 ·
       어둠(min 밑)에선 안 펴짐 · 느림(lo 밑)은 더 느림 · 말린 잎이 있으면 새 잎 없음 · 잎 간격 · 최대 장수 · tooBright/tooDark · bandOf · spotFit
     ★ B 판 «식물 돌봄»(2026-10-23 · 총괄 D73)
     R 고장 난 채로 오는 그루 — AL 잠든 채(겨울 그대로 · 봄 밝으면 깸 · 어두우면 그대로 · 무늬 ×1.4 · finds 상한이면 구근 0) ·
       SC 바닥에 닿은 채(상한까지 마디 · 더 높은 자리 첫날 새 마디 · 어두우면 안 큼) · SC 위 잎 무늬 없음(밝은 데 새 잎 마블) ·
       PP 끝 시듦 · 분홍 빠짐(있는 칸 · 가위로 나음) · summary.births(받은 잎 안 셈)
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
const PP = SPEC.species.pink_princess, AL = SPEC.species.alocasia_frydek, SC = SPEC.species.scindapsus, CA = SPEC.species.calathea;
let fail = 0;
const ok = (c, m) => { console.log((c ? '✅ ' : '⛔ ') + m); if (!c) fail++; };
const throws = (f) => { try { f(); return false; } catch (e) { return true; } };
/* days 일 걷는다 — dliOf(d) · seasonOf(d) 는 1부터. 사건을 날짜와 함께 모은다 */
const walk = (p, days, dliOf, seasonOfDay) => { const ev = []; for (let d = 1; d <= days; d++) for (const e of R.stepDay(p, { dli: dliOf(d), season: seasonOfDay(d) })) ev.push({ d, ...e }); return ev; };
const k = (v) => () => v;

/* A */
ok(R.species().join() === 'pink_princess,alocasia_frydek,scindapsus,calathea', `A 정본 네 종이 실렸다(${R.species().join(' · ')})`);
for (const id of ['scindapsus', 'calathea']) {
  const T2 = JSON.parse(JSON.stringify(TH)); delete T2.plants[SPEC.species[id].light_id];
  ok(throws(() => createSpeciesRules(SPEC, T2)), `A ${id} 빛 줄(${SPEC.species[id].light_id})이 없으면 던진다`); }
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
  const [clo, chi] = AL.propagation.corms_per_find;
  ok(drops.length >= 2 && gaps.every(g => g === AL.dormancy.drop_every_days) && asleep && asleep.corms.length >= clo && asleep.corms.length <= chi,
    `H 잎이 ${AL.dormancy.drop_every_days}일마다 하나씩 진다(${drops.length}장) → ${asleep && asleep.d}일째 잎 0 = 잠 · ★ 그날 구근 ${asleep && asleep.corms.length}알(D52)`);
  ok(wake && seasonOf(wake.d - 1) === 'spring' && !('corms' in wake) && a.cormsMade === asleep.corms.length,
    `H 봄(${wake && wake.d}일째)에 «다시 깸» — 구근은 안 나온다(이 그루가 찾은 구근 ${a.cormsMade} = 잠들 때 것뿐)`);
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
    const w = walk(a, 400, k(6), d => seasonOf(d - 1)).find(e => e.type === 'asleep');
    const n = w ? w.corms.length : -1; cnt[n] = (cnt[n] || 0) + 1;
  }
  const [lo, hi] = AL.propagation.corms_per_find, span = hi - lo + 1;
  const even = Array.from({ length: span }, (_, i) => cnt[lo + i] || 0).every(c => Math.abs(c / N - 1 / span) < 0.06);
  ok(even && !cnt[-1], `I 잠들 때 구근 ${lo}~${hi}알 고르게 — ${N}판 ${JSON.stringify(cnt)}`); }

/* J — 무늬 몫 */
{ const N = 800; let tagBad = 0; const share = (origin, motherKind) => { let v = 0; const kinds = {};
    for (let s = 1; s <= N; s++) { const a = R.newPlant('alocasia_frydek', { seed: s * 7919 + 1, origin, motherKind });
      const e = walk(a, 30, k(6), k('spring')).find(x => x.type === 'sprout'); if (e.varie) { v++; kinds[e.varie] = (kinds[e.varie] || 0) + 1; }
      if (e.origin !== origin || e.motherKind !== (motherKind ?? null)) tagBad++; }
    return { p: v / N, kinds }; };
  const vm = share('from_varie_mother', 'sector'), pm = share('from_plain_mother', null), sh = share('shop', null);
  const C = AL.corm.varie_chance;
  /* ★ C 판 «무늬 육종»(총괄 D83) — 싹틈 사건이 기록장 표본 조건(구근 출처 · 어미 갈래)을 싣는다 */
  ok(tagBad === 0, `J 싹틈 사건에 출처·어미 갈래가 실린다(origin · motherKind · ${3 * N}판 · 어긋남 ${tagBad})`);
  ok(Math.abs(vm.p - C.from_varie_mother) < 0.04 && Object.keys(vm.kinds).join() === 'sector', `J 무늬 모주 구근 무늬 ${vm.p.toFixed(3)}(기대 ${C.from_varie_mother}) · 갈래는 모주 것 ${JSON.stringify(vm.kinds)}`);
  ok(pm.p === C.from_plain_mother, `J 민무늬 모주 구근 무늬 ${pm.p}(기대 ${C.from_plain_mother})`);
  ok(Math.abs(sh.p - C.shop) < 0.04 && Object.keys(sh.kinds).length === 2, `J 상점 구근 무늬 ${sh.p.toFixed(3)}(기대 ${C.shop}) · 갈래 고르게 ${JSON.stringify(sh.kinds)}`);
  /* 잠들 때 찾은 구근이 모주 무늬를 잇는다 */
  const a = R.newPlant('alocasia_frydek', { seed: 77, origin: 'from_varie_mother', motherKind: 'marble' });
  const w = walk(a, 400, k(8), d => seasonOf(d - 1)).find(e => e.type === 'asleep');
  ok(w && w.corms.length && (a.varie === 'marble' ? w.corms.every(c => c.origin === 'from_varie_mother' && c.motherKind === 'marble') : w.corms.every(c => c.origin === 'from_plain_mother')),
    `J 잠들 때 구근 ${w && w.corms.length}알이 모주(${a.varie || '민무늬'})를 출처로 단다`); }

/* K — 어두워서 든 잠 · 구근 찍기 막힘(D52: 찾은 뒤 잎을 다시 내야 또 찾는다 · 잎이 다 지기 전에 깨면 못 찾는다) */
{ const a = R.newPlant('alocasia_frydek', { seed: 8, origin: 'shop' });
  walk(a, 80, k(6), k('summer'));
  /* avg7 은 밝던 날을 끌고 온다 — 문턱 밑으로 «내려간 날»부터 센다(무늬 그루면 문턱이 ×1.4 라 더 일찍 내려간다) */
  const min = R.thresholdsOf(a).min, h = a.hist.slice(); let cross = null;
  for (let d = 1; d <= 7 && cross == null; d++) { h.push(1.0); h.shift(); if (h.reduce((x, y) => x + y, 0) / h.length < min) cross = d; }
  const dark = walk(a, 120, k(1.0), k('summer'));
  const ds = dark.find(e => e.type === 'dormancy_start'), sl = dark.find(e => e.type === 'asleep');
  ok(ds && ds.why === 'low_light' && ds.d === cross + AL.dormancy.low_days - 1,
    `K 늘 여름이어도 avg7 이 문턱(${min}) 밑 ${AL.dormancy.low_days}일이면 잠 — 내려간 날 ${cross}일째 → ${ds && ds.d}일째 · ${ds && ds.why}`);
  ok(sl && sl.corms.length > 0, `K 어두워서 든 잠도 잎이 다 지는 날 구근 ${sl && sl.corms.length}알(자라던 그루)`);
  /* 깨운 뒤 잎을 한 장도 안 내고 다시 어둡게 — 또 잠들어도 구근 0 */
  const made = a.cormsMade;
  /* avg7 이 어둠을 끌고 와 깸은 밝힌 뒤 열흘쯤 — 16일 밝히고(새 잎 간격보다 짧다) 다시 어둡게 */
  const lit = walk(a, 16, k(6), k('summer')), wk = lit.find(e => e.type === 'wake');
  const again = walk(a, 120, k(1.0), k('summer')).find(e => e.type === 'asleep');
  ok(wk && !lit.some(e => e.type === 'leaf') && again && again.corms.length === 0 && a.cormsMade === made && AL.propagation.min_leaves_since_find >= 1,
    `K 깨자마자(새 잎 0장) 다시 재우면 구근 0 — 어두운 데 넣었다 빼기로 구근을 못 찍는다(찾은 수 ${made} 그대로)`);
  /* 잎이 다 지기 전에 밝히면 그 잠에서는 못 찾는다 */
  const b = R.newPlant('alocasia_frydek', { seed: 8, origin: 'shop' });
  walk(b, 80, k(6), k('summer'));
  const evb = walk(b, AL.dormancy.low_days + AL.dormancy.drop_every_days + 6, k(1.0), k('summer'));
  const evb2 = walk(b, 30, k(6), k('summer'));
  ok(evb.some(e => e.type === 'dormancy_start') && ![...evb, ...evb2].some(e => e.type === 'asleep') && evb2.some(e => e.type === 'wake') && b.cormsMade === 0,
    `K 잠 드는 중(잎이 남음)에 밝히면 깸 · 구근 0(잎이 다 지는 날만 찾는다)`); }

/* N — D49 잠든 구근: 잠 철을 기다린 구근은 싹틀 때 구근 1~3알 · 다른 철 구근은 자라다 잠들 때(D52) */
{ const N = 600, cnt = {}; let sleptAll = true, varie = 0, sameSeeds = 0, foundAgain = 0;
  const [lo, hi] = AL.propagation.corms_per_find, span = hi - lo + 1;
  for (let s = 1; s <= N; s++) {
    const a = R.newPlant('alocasia_frydek', { seed: s * 7919 + 3, origin: 'shop' });
    const ev = walk(a, 60, k(6), d => d <= 20 ? 'winter' : 'spring');
    const sp = ev.find(e => e.type === 'sprout');
    if (!sp || !sp.slept || sp.d !== 20 + Math.ceil(AL.corm.sprout_days / AL.season_speed.spring - 1e-9)) sleptAll = false;
    const n = sp ? sp.corms.length : -1; cnt[n] = (cnt[n] || 0) + 1;
    if (sp && sp.varie) varie++;
    /* 다음 겨울 잠들 때의 구근은 싹틈의 구근과 다른 열쇠로 굴린다 */
    if (s <= 40) { const w = walk(a, 420, k(6), d => seasonOf(90 + 40 + d)).find(e => e.type === 'asleep');
      if (w && w.corms.length) foundAgain++;
      if (w && w.corms.length && sp.corms.length && w.corms[0].seed === sp.corms[0].seed) sameSeeds++; }
  }
  const even = Array.from({ length: span }, (_, i) => cnt[lo + i] || 0).every(c => Math.abs(c / N - 1 / span) < 0.06);
  ok(sleptAll && even && !cnt[-1] && !cnt[0], `N 겨울에 심은 구근 ${N}판 — 봄 첫날부터 ${AL.corm.sprout_days}일째 싹 · 그때 구근 ${lo}~${hi}알 고르게 ${JSON.stringify(cnt)}`);
  ok(Math.abs(varie / N - AL.corm.varie_chance.shop) < 0.04, `N 잠든 구근도 무늬 몫은 그대로 — 상점 ${(varie / N).toFixed(3)}(기대 ${AL.corm.varie_chance.shop})`);
  ok(foundAgain >= 30 && sameSeeds === 0, `N 싹틈 구근과 다음 겨울 잠들 때 구근은 다른 굴림 — 다음 잠에 구근 찾은 판 ${foundAgain}/40 · 같은 씨앗 ${sameSeeds}`);
  const b = R.newPlant('alocasia_frydek', { seed: 5, origin: 'shop' });
  const spb = walk(b, 40, k(6), k('summer')).find(e => e.type === 'sprout');
  ok(spb && spb.slept === false && spb.corms.length === 0 && b.cormsMade === 0, '여름에 심은 구근은 싹틀 때 구근 없음(자라다 잠들 때 찾는다 · D52)'); }

/* O — D56 구근 찾기는 평생 두 번(첫 두 잠 · 잠든 구근 싹틈도 한 번) · 세 번째 잠부터 «잤다 깼다»만 */
{ const cap = AL.propagation.max_finds_lifetime;
  const finds = (R2, plant, days, seasonOfDay) => { const out = []; for (let d = 1; d <= days; d++) for (const e of R2.stepDay(plant, { dli: 6, season: seasonOfDay(d) }))
    if ((e.type === 'asleep' || (e.type === 'sprout' && e.slept)) ) out.push({ d, type: e.type, n: e.corms.length }); return out; };
  /* 여름에 심은 구근 — 잠 넷(4년) */
  const a = R.newPlant('alocasia_frydek', { seed: 4111, origin: 'shop' });
  const fa = finds(R, a, 360 * 4 + 20, d => seasonOf(90 + d));
  const sleeps = fa.filter(x => x.type === 'asleep');
  ok(cap === 2 && sleeps.length >= 3 && sleeps[0].n > 0 && sleeps[1].n > 0 && sleeps.slice(2).every(x => x.n === 0) && a.finds === 2,
    `O 여름 구근 — 잠 ${sleeps.length}번 · 구근 ${sleeps.map(x => x.n).join('·')} (평생 ${cap}번 · 세 번째부터 0) · 찾은 횟수 ${a.finds}`);
  /* 겨울에 심은 잠든 구근 — 싹틈이 첫 번째 · 첫 겨울 잠이 두 번째 · 둘째 겨울 잠은 0 */
  const b = R.newPlant('alocasia_frydek', { seed: 4222, origin: 'shop' });
  const fb = finds(R, b, 360 * 3, d => d <= 20 ? 'winter' : seasonOf(d - 21));
  ok(fb[0] && fb[0].type === 'sprout' && fb[0].n > 0 && fb[1] && fb[1].type === 'asleep' && fb[1].n > 0 && fb.slice(2).every(x => x.n === 0) && b.finds === 2,
    `O 겨울 구근 — ${fb.map(x => `${x.type === 'sprout' ? '싹틈' : '잠'} ${x.n}`).join(' · ')} (싹틈도 한 번으로 셈)`);
  /* 대조 — 칸을 빼면 세 번째 잠에도 찾는다(이 검사가 문다) */
  const S2 = JSON.parse(JSON.stringify(SPEC)); delete S2.species.alocasia_frydek.propagation.max_finds_lifetime;
  const R2 = createSpeciesRules(S2, TH);
  const c = R2.newPlant('alocasia_frydek', { seed: 4111, origin: 'shop' });
  const fc = finds(R2, c, 360 * 4 + 20, d => seasonOf(90 + d)).filter(x => x.type === 'asleep');
  ok(fc.length >= 3 && fc[2].n > 0, `O 대조 — 칸을 빼면 세 번째 잠에도 구근 ${fc[2] && fc[2].n}알(검사가 문다)`); }

/* ══ P — SC 스킨답서스(D71) ══════════════════════════════════════ */
{ const thSC = R.thresholdsOf(R.newPlant('scindapsus'));
  const V = SC.vine, inter = no => V.internode_m[SC.leaf_ladder[Math.min(SC.leaf_ladder.length - 1, no - 1)]];
  const walkSC = (p, days, dliOf, seasonOfDay, dropOf) => { const ev = []; for (let d = 1; d <= days; d++) for (const e of R.stepDay(p, { dli: dliOf(d), season: seasonOfDay(d), dropM: dropOf(d) })) ev.push({ d, ...e }); return ev; };
  const bandSC = (dli) => (dli < thSC.min ? null : dli < thSC.best_lo ? 'slow' : dli <= thSC.best_hi ? 'best' : dli <= thSC.max ? 'good' : 'over');

  /* P1 상점 삽수 */
  const c = R.newPlant('scindapsus', { seed: 21 });
  const s0 = R.summary(c);
  ok(c.phase === 'cutting' && s0.nodes === SC.propagation.start_nodes && Math.abs(c.lengthM - (inter(1) + inter(2))) < 1e-9 && c.leaves.every(l => l.marble) && s0.rootDaysLeft === SC.propagation.root_days,
    `P1 상점 «줄기 삽수» — 마디 ${s0.nodes} · 줄기 ${s0.lengthM}m(= 마디 사이 ${inter(1)}+${inter(2)}) · 뿌리까지 ${s0.rootDaysLeft}일`);

  /* P2 뿌리 — 빛 무관 · 놓인 날만 · 그동안 dropM 을 안 읽고 안 자람 */
  { const a = R.newPlant('scindapsus', { seed: 21 }), b = R.newPlant('scindapsus', { seed: 21 });
    const ea = walkSC(a, 30, k(0.05), k('winter'), d => d <= SC.propagation.root_days ? undefined : 0.79);
    const eb = walkSC(b, SC.propagation.root_days, k(9), k('summer'), k(undefined));
    const ra = ea.find(e => e.type === 'rooted'), rb = eb.find(e => e.type === 'rooted');
    ok(ra && rb && ra.d === SC.propagation.root_days && rb.d === SC.propagation.root_days && ea.filter(e => e.type === 'rooted').length === 1 && a.phase === 'growing',
      `P2 뿌리 — 어둠 0.05 겨울도 밝음 9 여름도 ${ra && ra.d}·${rb && rb.d}일째(root_days ${SC.propagation.root_days} · 빛 무관 · 한 번) · 삽수 동안 dropM 없어도 안 던짐`);
    ok(!ea.some(e => e.type === 'node' && e.d <= SC.propagation.root_days), 'P2 뿌리 전에는 마디가 안 는다'); }

  /* P3 뿌리 뒤엔 dropM 이 꼭 있어야 — 던지고 그루는 그대로 */
  { const g = R.newPlant('scindapsus', { seed: 21, form: 'rooted' }), before = JSON.stringify(g);
    ok(throws(() => R.stepDay(g, { dli: 5, season: 'spring' })) && throws(() => R.stepDay(g, { dli: 5, season: 'spring', dropM: NaN })) && JSON.stringify(g) === before,
      'P3 뿌리 내린 SC 는 dropM 없이 하루를 넘기면 던진다 — 그루는 한 톨도 안 바뀜(조용히 안 메꿈)'); }

  /* P4 마디 간격 = interval / (밴드 속도 × 계절) */
  for (const [dli, se] of [[5, 'spring'], [5, 'summer'], [2, 'winter'], [12, 'autumn']]) {
    const g = R.newPlant('scindapsus', { seed: 3, form: 'rooted' });
    const f = walkSC(g, 60, k(dli), k(se), k(1.4)).find(e => e.type === 'node');
    const want = Math.ceil(SC.interval_days / (SC.speed_by_band[bandSC(dli)] * SC.season_speed[se]) - 1e-9);
    ok(f && f.d === want, `P4 SC 첫 새 마디 — DLI ${dli}(${bandSC(dli)}) · ${se} → ${f && f.d}일 (기대 ${want})`); }

  /* P5 바닥 자리 — 상한에서 정확히 멈춤 · reached_floor 한 번 · 그 뒤 안 자람 · 길이는 날마다 이어서 늘었음 */
  { const g = R.newPlant('scindapsus', { seed: 5, form: 'rooted' });
    const lens = []; const ev = [];
    for (let d = 1; d <= 400; d++) { for (const e of R.stepDay(g, { dli: 6, season: 'spring', dropM: 0.02 })) ev.push({ d, ...e }); lens.push(g.lengthM); }
    const cap = R.scStemCapM(0.02), fl = ev.filter(e => e.type === 'reached_floor');
    const mono = lens.every((v, i) => i === 0 || v >= lens[i - 1]);
    const pre = fl[0] ? lens.slice(0, fl[0].d) : [];
    const growDays = pre.filter((v, i) => i > 0 && v > pre[i - 1]).length;
    ok(g.lengthM === cap && g.atFloor && fl.length === 1 && g.leaves.every(l => l.at <= cap + 1e-9) && mono,
      `P5 바닥(받침 0.02m) — 줄기 ${g.lengthM}m = 상한 ${cap}(0.02 + ${V.pot_over_m}) · ${fl[0] && fl[0].d}일째 바닥 · 닿음 사건 ${fl.length}번 · 마디 ${g.leaves.length}`);
    ok(fl[0] && growDays >= fl[0].d - 2, `P5 길이는 마디 사이가 아니라 날마다 이어서 는다(바닥까지 ${fl[0] && fl[0].d}일 가운데 ${growDays}일 늘음)`);
    const n0 = g.leaves.length; walkSC(g, 300, k(8), k('summer'), k(0.02));
    ok(g.leaves.length === n0 && g.lengthM === cap, `P5 바닥에 닿은 뒤 300일(밝음) — 마디 ${g.leaves.length} 그대로 · 길이 그대로`); }

  /* P6 높은 자리 · longVineM(D76 · 총괄 10-23 — 1.0 → 0.5 · 곁줄 끝 = «높은 자리에 놓인 SC 가운데 줄기 ≥ longVineM» · core 셈)
     ① longVineM = 칸 long_vine_m 그대로 · 어느 높은 자리에서도 닿음(≤ 문턱 자리 상한) · 문턱 자리 줄기가 실제로 닿음
     ② 바닥 자리(상한 0.27)는 못 닿음
     ③ ⚠ 길이만으로는 «높은 자리에서만»이 아니다 — 문턱 바로 밑 낮은 자리도 닿는다(높은 자리 조건을 core 가 같이 봐야 하는 까닭 · 이 칸이 그것을 박아 둔다)
     ④ 대조 — 칸이 없거나 높은 자리 상한보다 길면 던진다(옛 정의로 조용히 안 넘어감) */
  { const H = V.high_spot_min_m, L = R.longVineM();
    const lo = R.newPlant('scindapsus', { seed: 6, form: 'rooted' }), hi = R.newPlant('scindapsus', { seed: 6, form: 'rooted' }), fl = R.newPlant('scindapsus', { seed: 6, form: 'rooted' });
    walkSC(lo, 1080, k(6), d => seasonOf(d), k(H - 0.01)); walkSC(hi, 1080, k(6), d => seasonOf(d), k(H)); walkSC(fl, 1080, k(6), d => seasonOf(d), k(0.02));
    ok(L === V.long_vine_m && L <= R.scStemCapM(H) && R.isHighSpot(H) && !R.isHighSpot(H - 0.01) && hi.lengthM >= L && hi.lengthM === R.scStemCapM(H),
      `P6 ① longVineM ${L}(칸 long_vine_m · D76) ≤ 높은 자리 문턱(${H}) 상한 ${R.scStemCapM(H)} · 문턱 자리 3년 줄기 ${hi.lengthM} ≥ ${L}`);
    ok(fl.lengthM < L && R.scStemCapM(0.02) < L, `P6 ② 바닥 자리(0.02) 3년 줄기 ${fl.lengthM} < ${L} — 못 닿음`);
    ok(lo.lengthM >= L, `P6 ③ 문턱 바로 밑 낮은 자리(${(H - 0.01).toFixed(2)})도 ${lo.lengthM} ≥ ${L} — 길이만으로는 높은 자리 가름이 아니다(곁줄은 «높은 자리에 놓인 채»로 셈)`);
    const S2 = JSON.parse(JSON.stringify(SPEC)), S3 = JSON.parse(JSON.stringify(SPEC));
    delete S2.species.scindapsus.vine.long_vine_m; S3.species.scindapsus.vine.long_vine_m = R.scStemCapM(H) + 0.01;
    ok(throws(() => createSpeciesRules(S2, TH)) && throws(() => createSpeciesRules(S3, TH)), 'P6 ④ long_vine_m 이 없거나 높은 자리 상한보다 길면 던진다'); }

  /* P7 높은 데 → 낮은 데(줄기 안 줆 · 멎음 · 남는 몫은 바닥) → 다시 높은 데(이어 자람) */
  { const g = R.newPlant('scindapsus', { seed: 7, form: 'rooted' });
    walkSC(g, 260, k(6), k('spring'), k(1.4));
    const L1 = g.lengthM, n1 = g.leaves.length;
    const e2 = walkSC(g, 120, k(6), k('spring'), k(0.02));
    const L2 = g.lengthM, n2 = g.leaves.length;
    const e3 = walkSC(g, 60, k(6), k('spring'), k(1.4));
    ok(L1 > R.scStemCapM(0.02) && L2 === L1 && n2 === n1 && g.lengthM > L1 && g.leaves.length > n1 && e2.filter(e => e.type === 'reached_floor').length === 1 && !e2.some(e => e.type === 'node') && e3.some(e => e.type === 'node'),
      `P7 1.4m 260일 줄기 ${L1}m(마디 ${n1}) → 바닥으로 옮김 120일: ${L2}m(안 줆 · 마디 ${n2} · 멎음) → 다시 1.4m 60일: ${g.lengthM}m(마디 ${g.leaves.length} · 이어 자람)`); }

  /* P8 어두울 때 난 잎은 초록(그림만) — 마블 판 / 초록 판 · 등급(값) 칸 없음 */
  { const g = R.newPlant('scindapsus', { seed: 8, form: 'rooted', nodes: 6 });
    walkSC(g, 60, k(thSC.best_lo - 0.5), k('spring'), k(1.4));
    const dark = g.leaves.filter(l => l.no > 6); const nd = dark.length;
    walkSC(g, 60, k(6), k('spring'), k(1.4));
    const bright = g.leaves.filter(l => l.no > 6 + nd);
    const rows = R.leafRows(g), rd = rows.find(r => r.no === dark[0].no), rb = rows.find(r => r.no === bright[bright.length - 1].no);
    ok(nd > 0 && dark.every(l => !l.marble) && bright.length > 1 && bright.slice(1).every(l => l.marble) && rd.grade === 'green' && rb.grade === 'marble' && rd.asset === SC.assets[rd.stage].green && rb.asset === SC.assets[rb.stage].marble,
      `P8 avg7 < best_lo(${thSC.best_lo}) 에 난 잎 ${nd}장 초록 · 밝아진 뒤 마블(avg7 이 따라오는 첫 장 빼고) · 판 ${rd.asset.split('/').pop()} / ${rb.asset.split('/').pop()}`);
    ok(!('value' in R.summary(g)) && !rows.some(r => 'won' in r), 'P8 SC 는 등급·값 칸이 없다(값 = 마디 수 × 마디값 · core)'); }

  /* P9 마디 자르기 */
  { const m = R.newPlant('scindapsus', { seed: 9, form: 'rooted', nodes: 2 });
    walkSC(m, 200, k(6), k('spring'), k(1.4));
    const N = m.leaves.length, L0 = m.lengthM, cutNo = m.leaves[2].no, cutAt = m.leaves[2].at;
    const { cutting, saved } = R.cutAbove(m, cutNo);
    const sm = R.summary(m), sc = R.summary(cutting);
    ok(sm.nodes === 3 && m.lengthM === cutAt && sc.nodes === N - 3 && cutting.phase === 'cutting' && !saved && Math.abs(sc.lengthM - (L0 - cutAt)) < 1e-6 && cutting.leaves[0].at > 0 && cutting.leaves[0].no === cutNo + 1,
      `P9 마디 ${cutNo} 위를 자름 — 모주 마디 ${sm.nodes} · ${sm.lengthM}m / 삽수 마디 ${sc.nodes} · ${sc.lengthM}m(뿌리 없음 · at 은 자른 자리부터 ${cutting.leaves[0].at})`);
    const topNo = cutting.leaves[cutting.leaves.length - 1].no;
    const e = walkSC(cutting, SC.propagation.root_days + 30, k(6), k('spring'), d => d <= SC.propagation.root_days ? undefined : 1.4);
    const nn = e.find(x => x.type === 'node');
    ok(e.some(x => x.type === 'rooted') && nn && nn.no === topNo + 1 && cutting.leaves[cutting.leaves.length - 1].stage === 'mature',
      `P9 삽수가 뿌리 뒤 이어서 마디 ${nn && nn.no}(마디 번호 그대로 · ${cutting.leaves[cutting.leaves.length - 1].stage})`);
    ok(R.scInternodeM(m) === inter(m.nodes + 1) && R.scInternodeM() === V.internode_m.mature, `P9 scInternodeM — 그 그루 다음 칸 ${R.scInternodeM(m)} · 그루 없이 ${R.scInternodeM()}`);
    ok(throws(() => R.cutAbove(m, 99)) && throws(() => R.cutAbove(m, m.leaves[m.leaves.length - 1].no)), 'P9 없는 마디 · 삽수로 갈 마디가 없는 자르기는 던진다'); }

  /* P10 같은 씨앗 = 같은 그루 · 세이브 왕복 */
  { const dl = d => 2 + 5 * ((d * 31 % 13) / 12), dr = d => d <= 12 ? undefined : d < 150 ? 0.45 : 0.79;
    const run = () => { const g = R.newPlant('scindapsus', { seed: 10 }); walkSC(g, 300, dl, d => seasonOf(d), dr); return g; };
    const a = run(), b = JSON.parse(JSON.stringify(R.newPlant('scindapsus', { seed: 10 })));
    walkSC(b, 300, dl, d => seasonOf(d), dr);
    ok(JSON.stringify(a) === JSON.stringify(run()) && JSON.stringify(a) === JSON.stringify(b), 'P10 같은 씨앗 · 같은 빛 · 같은 자리 = 같은 그루 · JSON 왕복도 같은 길'); }
}

/* ══ Q — CA 칼라테아(D71) ══════════════════════════════════════ */
{ const thCA = R.thresholdsOf(R.newPlant('calathea')), C = CA.curl;
  const B = R.bandOf('calathea');
  ok(B.lo === TH.plants.calathea_orbifolia.best_lo && B.hi === TH.plants.calathea_orbifolia.max && B.lo === 3 && B.hi === 8,
    `Q bandOf('calathea') = [${B.lo}, ${B.hi}] — 빛 줄 [best_lo, max] 그대로(명세 후보 lo 3 · hi 8)`);
  const fits = [1.5, 2.5, 5, 7.9, 8.5].map(x => R.spotFit('calathea', x));
  ok(fits.join() === 'dark,slow,fit,fit,over', `Q spotFit('calathea') 1.5/2.5/5/7.9/8.5 → ${fits.join(' · ')}`);

  /* Q1 맡은 그루 */
  const g = R.newPlant('calathea', { seed: 31, leaves: 5, curled: 'all' }), s1 = R.summary(g);
  ok(s1.leaves === 5 && s1.curled === 5 && s1.tooBright === null && g.leaves.every(l => l.stage === 'mature' && l.curl === 1),
    `Q1 맡은 칼라테아 — 잎 ${s1.leaves} · 말린 잎 ${s1.curled} · 빛 보기 전 tooBright ${s1.tooBright}(모른다)`);

  /* Q2 너무 밝음 — 대역 안이 되기 전엔 안 펴짐 · 잎도 안 남 */
  const e2 = walk(g, 60, k(B.hi + 2), k('summer'));
  ok(R.summary(g).curled === 5 && !e2.some(e => e.type === 'unfurl' || e.type === 'leaf') && R.summary(g).tooBright === true,
    `Q2 너무 밝은 데(DLI ${B.hi + 2}) 60일 — 그대로 다 말림 · 새 잎 없음 · tooBright ${R.summary(g).tooBright}`);

  /* Q3 알맞은 데 — 새 잎부터 며칠에 걸쳐 펴짐 · 다 펴짐 한 번 */
  const e3 = walk(g, 40, k(5), k('summer'));
  const uf = e3.filter(e => e.type === 'unfurl'), all = e3.filter(e => e.type === 'unfurled_all');
  const span = uf.length ? uf[uf.length - 1].d - uf[0].d : null;
  ok(uf.length === 5 && all.length === 1 && uf.map(e => e.no).join() === '5,4,3,2,1' && span >= 2 && R.summary(g).curled === 0 && R.summary(g).tooBright === false,
    `Q3 DLI 5 로 옮김 — 펴짐 ${uf.map(e => `${e.d}일 #${e.no}`).join(' · ')} (새 잎부터 · ${span}일에 걸쳐) · 다 펴짐 ${all[0] && all[0].d}일째`);
  /* avg7 이 hi 밑으로 내려오는 날 — 그날부터 펴지기 시작해 가장 새 잎이 unfurl_days 쯤에 다 펴진다 */
  let down = 0; { const h = []; for (let d = 1; d <= 7; d++) h.push(B.hi + 2); for (let d = 1; d <= 40 && !down; d++) { h.push(5); h.shift(); if (h.reduce((x, y) => x + y, 0) / 7 <= B.hi) down = d; } }
  ok(uf[0].d >= down + C.unfurl_days - 1 && uf[0].d <= down + C.unfurl_days, `Q3 첫 잎이 다 펴지는 날 ${uf[0].d} = avg7 이 hi 밑으로 온 날 ${down} + unfurl_days(${C.unfurl_days}) 쯤`);

  /* Q4 어둠(min 밑)에선 안 펴짐 · 느림(lo 밑)은 알맞음보다 늦음 */
  const dayAll = (dli) => { const h = R.newPlant('calathea', { seed: 32, leaves: 4, curled: 'all' }); const e = walk(h, 120, k(dli), k('spring')).find(x => x.type === 'unfurled_all'); return e ? e.d : null; };
  const dDark = dayAll(thCA.min - 0.5), dSlow = dayAll((thCA.min + thCA.best_lo) / 2), dFit = dayAll(5);
  ok(dDark === null && dSlow > dFit && dFit > 0, `Q4 다 펴지는 날 — 어둠(${thCA.min - 0.5}) 없음(120일) · 느림 ${dSlow}일 · 알맞음 ${dFit}일`);

  /* Q5 말림 시작 — 펴진 그루를 너무 밝은 데로: 사건 curl 한 번 · curl_days 쯤에 다 말림 · 그동안 새 잎 없음 */
  { const mk = () => { const t = R.newPlant('calathea', { seed: 33, leaves: 3, curled: 0 }); walk(t, 20, k(5), k('spring')); return t; };
    const h = mk(), e = walk(h, 30, k(B.hi + 4), k('spring'));
    const cu = e.filter(x => x.type === 'curl');
    const t = mk(); let full = null; for (let d = 1; d <= 30 && full == null; d++) { R.stepDay(t, { dli: B.hi + 4, season: 'spring' }); if (t.leaves.every(l => l.curl === 1)) full = d; }
    ok(cu.length === 1 && cu[0].curled === 3 && h.leaves.every(l => l.curl === 1) && full != null && full <= cu[0].d + C.curl_days && !e.some(x => x.type === 'leaf'),
      `Q5 펴진 그루를 DLI ${B.hi + 4} 로 — ${cu[0] && cu[0].d}일째 말리기 시작(사건 1번) · ${full}일째 다 말림(curl_days ${C.curl_days}) · 새 잎 없음`); }

  /* Q6 잎 간격 = interval / (밴드 속도 × 계절) · 최대 장수 */
  for (const [dli, se, bd] of [[5, 'spring', 'best'], [7.5, 'summer', 'good'], [2.5, 'spring', 'slow']]) {
    const h = R.newPlant('calathea', { seed: 34, leaves: 3, curled: 0 });
    const f = walk(h, 120, k(dli), k(se)).find(x => x.type === 'leaf');
    const want = Math.ceil(CA.interval_days / (CA.speed_by_band[bd] * CA.season_speed[se]) - 1e-9);
    ok(f && f.d === want, `Q6 CA 첫 새 잎 — DLI ${dli}(${bd}) · ${se} → ${f && f.d}일 (기대 ${want})`); }
  { const h = R.newPlant('calathea', { seed: 35, leaves: CA.max_leaves, curled: 0 });
    const e = walk(h, 200, k(5), k('summer'));
    ok(h.leaves.length === CA.max_leaves && e.filter(x => x.type === 'leaf').length === e.filter(x => x.type === 'leaf_drop').length && e.some(x => x.type === 'leaf_drop'),
      `Q6 잎이 ${CA.max_leaves}장을 넘으면 가장 오래된 잎이 진다(낸 ${e.filter(x => x.type === 'leaf').length} · 진 ${e.filter(x => x.type === 'leaf_drop').length})`); }

  /* Q7 그림 줄 · 세이브 왕복 */
  { const h = R.newPlant('calathea', { seed: 36, leaves: 4, curled: 2 });
    const rows = R.leafRows(h);
    ok(rows.map(r => r.curl).join() === '1,1,0,0' && rows.every(r => r.grade === 'plain' && r.asset === CA.assets.mature.plain && r.size_m === CA.leaf_size_m.mature),
      `Q7 그림 줄 — curl ${rows.map(r => r.curl).join(',')} · 판 ${rows[0].asset.split('/').pop()} · ${rows[0].size_m}m`);
    const run = (p) => { walk(p, 240, d => 2 + 9 * ((d * 17 % 11) / 10), d => seasonOf(d)); return JSON.stringify(p); };
    ok(run(R.newPlant('calathea', { seed: 37, curled: 'all' })) === run(JSON.parse(JSON.stringify(R.newPlant('calathea', { seed: 37, curled: 'all' })))), 'Q7 같은 그루 · 같은 빛 · JSON 왕복도 같은 길(말림·펴짐 오가는 빛 240일)'); }
  ok(throws(() => R.cutAbove(R.newPlant('calathea'), 1)) && throws(() => R.newPlant('calathea', { leaves: CA.max_leaves + 1 })) && throws(() => R.newPlant('calathea', { leaves: 3, curled: 4 })),
    'Q CA 는 자르지 않는다 · 잎 수·말린 잎 수가 틀리면 던진다');
}

/* ══ R — B 판 «식물 돌봄»(총괄 D73 · plan-care-career-spec §8) — 고장 난 채로 오는 그루 · 나음 판정 칸 · 가드 ══════════ */
{ const thAL = R.thresholdsOf(R.newPlant('alocasia_frydek')), D = AL.dormancy, SC_TH = () => R.thresholdsOf(R.newPlant('scindapsus'));
  /* R1 AL 잠든 채 — 잎 0 · 겨울엔 그대로 · 겨울 밖 밝으면 wake_days 에 깸 → 사다리 한 칸 내린 잎 · 어두우면 그대로 */
  const a = R.newPlant('alocasia_frydek', { seed: 71, origin: 'shop', form: 'asleep' }), sa = R.summary(a);
  ok(a.phase === 'asleep' && a.leaves.length === 0 && sa.asleep && sa.births === 0, `R1 AL 잠든 채 — 잎 ${a.leaves.length} · asleep ${sa.asleep} · births ${sa.births}`);
  { const w = R.newPlant('alocasia_frydek', { seed: 71, origin: 'shop', form: 'asleep' });
    const e1 = walk(w, 60, k(thAL.best_lo + 1), k('winter'));
    const e2 = walk(w, 45, k(thAL.best_lo + 1), k('spring'));
    const wk = e2.find(e => e.type === 'wake'), lf = e2.find(e => e.type === 'leaf');
    ok(!e1.some(e => e.type === 'wake') && wk && wk.d === D.wake_days && lf && lf.stage === AL.leaf_ladder[AL.leaf_ladder.length - 1 - D.wake_ladder_drop] && R.summary(w).phase === 'growing' && R.summary(w).births >= 1,
      `R1 겨울 60일 잠 그대로 → 봄 밝음(${thAL.best_lo + 1}) ${wk && wk.d}일째 깸(wake_days ${D.wake_days}) · 첫 잎 ${lf && lf.stage}(다 큰 그루 −${D.wake_ladder_drop}칸) · ${lf && lf.d}일째`); }
  { const d = R.newPlant('alocasia_frydek', { seed: 71, origin: 'shop', form: 'asleep' });
    const e = walk(d, 60, k(thAL.min - 0.5), k('summer'));
    ok(!e.some(x => x.type === 'wake') && d.phase === 'asleep', `R1 여름 어둠(${thAL.min - 0.5}) 60일 — 안 깸(al_dark 는 밝은 데로 옮겨야 고침)`); }
  { const v = R.newPlant('alocasia_frydek', { seed: 72, origin: 'shop', form: 'asleep', varie: 'marble' }), pl = R.newPlant('alocasia_frydek', { seed: 72, origin: 'shop', form: 'asleep' });
    const mid = (thAL.min + thAL.min * TH.variegated.need_mult) / 2;
    walk(v, 30, k(mid), k('spring')); walk(pl, 30, k(mid), k('spring'));
    ok(v.varie === 'marble' && v.phase === 'asleep' && pl.phase === 'growing' && R.spotFitOf(v, mid) === 'dark' && R.spotFitOf(pl, mid) !== 'dark',
      `R1 무늬 그루는 문턱 ×${TH.variegated.need_mult} — DLI ${mid.toFixed(2)} 에서 민무늬는 깨고 무늬는 잠(spotFitOf ${R.spotFitOf(pl, mid)} / ${R.spotFitOf(v, mid)})`); }
  { const run = (finds) => { const p = R.newPlant('alocasia_frydek', { seed: 73, origin: 'shop', form: 'asleep', finds });
      const ev = walk(p, 400, k(6), d => seasonOf(d)); return ev.filter(e => e.type === 'asleep').map(e => e.corms.length); };
    const capd = run(AL.propagation.max_finds_lifetime), free = run(0);
    ok(capd.length >= 1 && capd.every(n => n === 0) && free.some(n => n > 0), `R1 finds 를 평생 상한(${AL.propagation.max_finds_lifetime})으로 주면 다시 잠들어도 구근 0(${capd.join('·')}) · 대조 finds 0 이면 ${free.join('·')}`); }
  ok(throws(() => R.newPlant('alocasia_frydek', { form: 'asleep', varie: 'gold' })) && throws(() => R.newPlant('alocasia_frydek', { form: 'awake' })), 'R1 모르는 무늬 갈래 · 모르는 form 은 던진다');

  /* R2 SC 바닥에 닿은 채 — 상한까지 마디 · 그 자리에선 안 큼 · 더 높은 자리 첫 «자라는 날»에 새 마디 */
  { const V = SC.vine, inter = no => V.internode_m[SC.leaf_ladder[Math.min(SC.leaf_ladder.length - 1, no - 1)]];
    const drop0 = 0.25, cap0 = R.scStemCapM(drop0);
    const f = R.newPlant('scindapsus', { seed: 81, form: 'atFloor', dropM: drop0 }), sf = R.summary(f);
    let at = 0, n = 0; while (true) { const nx = at + inter(n + 1); if (n >= 1 && nx > cap0 + 1e-4) break; at = nx; n++; }
    ok(sf.atFloor && sf.lengthM === cap0 && sf.nodes === n && sf.phase === 'growing' && sf.births === 0 && f.leaves[f.leaves.length - 1].at <= cap0 + 1e-9,
      `R2 SC 바닥에 닿은 채(손님 자리 dropM ${drop0}) — 줄기 ${sf.lengthM}m = 상한 · 마디 ${sf.nodes}(다음 마디가 상한을 넘음) · atFloor`);
    const same = JSON.parse(JSON.stringify(f));
    const e0 = []; for (let d = 1; d <= 60; d++) for (const e of R.stepDay(same, { dli: 6, season: 'spring', dropM: drop0 })) e0.push(e);
    ok(!e0.some(e => e.type === 'node') && same.lengthM === cap0, `R2 같은 높이에 두면 60일 그대로(마디 0 · 줄기 ${same.lengthM})`);
    const e1 = []; for (let d = 1; d <= 3; d++) for (const e of R.stepDay(f, { dli: 6, season: 'spring', dropM: 0.794 })) e1.push({ d, ...e });
    const nd = e1.find(e => e.type === 'node');
    ok(nd && nd.d === 1 && R.summary(f).births === 1 && f.lengthM > cap0, `R2 선반 윗단(0.794)으로 옮긴 첫날 새 마디(${nd && nd.d}일째 · births ${R.summary(f).births}) · 줄기 ${f.lengthM} > ${cap0} — sc_floor 나음`);
    const dk = R.newPlant('scindapsus', { seed: 81, form: 'atFloor', dropM: drop0 });
    const e2 = []; for (let d = 1; d <= 60; d++) for (const e of R.stepDay(dk, { dli: SC_TH().min - 0.5, season: 'spring', dropM: 0.794 })) e2.push(e);
    ok(!e2.some(e => e.type === 'node'), `R2 높아도 어두우면(${SC_TH().min - 0.5}) 60일 안 큼 — 높이와 빛 둘 다`);
    ok(throws(() => R.newPlant('scindapsus', { form: 'atFloor' })) && throws(() => R.newPlant('scindapsus', { form: 'atFloor', dropM: 0.3, nodes: 4 })), 'R2 atFloor 에 dropM 이 없거나 nodes 를 주면 던진다'); }

  /* R3 SC 새 잎 무늬 없음 — 위 plainTop 장 마블 없음 · 밝은 데서 난 새 잎은 마블 → topMarble */
  { const pn = R.newPlant('scindapsus', { seed: 82, form: 'rooted', nodes: 6, plainTop: 2 }), sp = R.summary(pn);
    ok(pn.leaves.map(l => l.marble ? 1 : 0).join('') === '111100' && sp.topMarble === false && R.leafRows(pn).slice(-2).every(r => r.grade === 'green'),
      `R3 SC 위 2장 마블 없음 — ${pn.leaves.map(l => l.marble ? 'M' : 'g').join('')} · topMarble ${sp.topMarble}`);
    const b0 = sp.births; let healed = null;
    for (let d = 1; d <= 30 && healed == null; d++) { R.stepDay(pn, { dli: 6, season: 'spring', dropM: 0.794 }); const s = R.summary(pn); if (s.births > b0 && s.topMarble) healed = d; }
    ok(healed != null && healed <= 30, `R3 밝은 데(6 · 높이 0.794)로 — ${healed}일째 마블 새 잎(births > ${b0} · topMarble) — sc_plain 나음`);
    ok(throws(() => R.newPlant('scindapsus', { form: 'rooted', nodes: 3, plainTop: 4 })), 'R3 plainTop 이 마디 수보다 많으면 던진다'); }

  /* R4 PP 두 고장은 있는 칸으로 — 끝 시듦(분홍 셋 → 그날부터 시듦) · 분홍 빠짐(초록 둘) */
  { const t = R.newPlant('pink_princess', { seed: 83, pinks: [0.4, 0.6, 0.95, 0.95, 0.95] });
    const st = R.summary(t), r = R.cutAbove(t, t.leaves[1].no);
    ok(st.withering && r.saved === true && R.summary(t).withering === false, `R4 PP 끝 시듦으로 옴(withering ${st.withering}) → 분홍 줄 아래 자르기 saved ${r.saved} — pp_tip 나음`);
    const g = R.newPlant('pink_princess', { seed: 84, pinks: [0.4, 0.3, 0, 0] }), sg = R.summary(g);
    R.cutAbove(g, g.leaves[1].no);
    const b0 = R.summary(g).births; let healed = null;
    for (let d = 1; d <= 45 && healed == null; d++) { R.stepDay(g, { dli: 6, season: 'spring' }); const s = R.summary(g); if (s.births > b0 && s.topGrade !== 'green') healed = d; }
    ok(sg.topGrade === 'green' && healed != null, `R4 PP 분홍 빠짐(맨 위 ${sg.topGrade}) → 분홍 남은 마디 위 자르고 밝은 데 — ${healed}일째 새 잎 ${R.summary(g).topGrade} — pp_green 나음`); }

  /* R5 summary.births — 모든 종 · newPlant 로 준 잎은 안 셈 */
  { const xs = [R.newPlant('pink_princess', { pinks: [0.3, 0.3] }), R.newPlant('alocasia_frydek'), R.newPlant('scindapsus', { form: 'rooted', nodes: 4 }), R.newPlant('calathea', { leaves: 4 })];
    ok(xs.every(p => R.summary(p).births === 0), `R5 summary.births — 네 종 다 있고 받은 잎은 0 (${xs.map(p => R.summary(p).births).join('·')})`); }
}

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
  ok(rows.map(r => r.grade).join() === 'green,marble,heavy,pink' && rows[3].asset.endsWith('pp_leaf_mature_allpink.glb') && rows[2].asset.endsWith('pp_leaf_mid_pinkmarble.glb') && rows[0].size_m === PP.leaf_size_m.mid,
    `M PP 그림 줄 — ${rows.map(r => `${r.no}:${r.stage}/${r.grade}`).join(' ')}`); }

console.log('\nspecies_growth: ' + (fail ? 'FAIL' : 'PASS'));
process.exitCode = fail ? 1 : 0;
