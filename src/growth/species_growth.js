/* ============================================================
   growth/species_growth.js — 새 식물 두 종(핑크프린세스 · 알로카시아)의 생장 규칙 ([growth] 소유 · 2026-10-09 · 총괄 D45)
   ------------------------------------------------------------
   ★ 몬스테라는 여기 없다. 몬스테라는 plant_grow.html(캐논 · D40 배율 · 프롤로그)이 키우고 이 파일은 그쪽을 한 줄도 안 부른다.
     종이 다르면 «칸이 갈린다» — 코어는 pot.plantId 로 갈라 몬스테라면 plant_grow, 이 두 종이면 이 규칙을 부른다(코어 차례).
   ★ THREE 없음 · DOM 없음 · 순수 함수. 그루 상태는 평범한 JSON 이라 세이브에 그대로 실린다(schema 'species/1').
   ★ 값은 여기 없다 — data/growth_species.json(간격 · 사다리 · 분홍 몫 · 잠 · 구근) 과
     data/balance/light_thresholds.json plants[light_id](빛 문턱) 가 정본이다. 이 파일은 «규칙»만 든다.
   ★ 같은 씨앗 · 같은 빛 · 같은 계절이면 같은 그루가 된다(굴림은 씨앗 + 그 그루가 «몇 번째로 낸 잎»인가에서만 나온다).
     잘라서 같은 마디에서 다시 나도 «새 굴림»이다 — 마디 번호가 아니라 낸 잎 수(births)로 굴리기 때문이다.

   쓰는 법
     const R = createSpeciesRules(speciesJson, lightThresholdsJson);
     const p = R.newPlant('pink_princess', { seed: 7, leaves: 2, pink: 0.35 });
     const ev = R.stepDay(p, { dli: 5.2, season: 'summer' });   // 하루 — p 를 고치고 그날 일(events)을 낸다
     R.leafRows(p)   // 그림용: [{ no, stage, grade, size_m, asset, pink }]
     R.cutAbove(p, 4) // PP: 마디 4 바로 위를 자른다 → { cutting, saved } (p 는 모주로 고쳐진다 · saved = 시드는 끝을 살렸다)

   사건(events) — 코어가 대사·스냅샷에 쓴다
     PP  leaf { no, pink, grade } · tip_withering { streak, at } · tip_withered { count }   (자르기로 살린 것은 cutAbove 의 saved)
     AL  sprout { varie } · leaf { no } · leaf_drop { no } · dormancy_start { why } · asleep · wake { corms: [{ seed, origin, motherKind }] }
============================================================ */
import { judgeDLI, thresholdsFor } from '../engine/daily_light.js';
import { seasonOf } from '../engine/weather.js';

export const SPECIES_SCHEMA = 'species/1';
export const SEASONS = Object.freeze(['spring', 'summer', 'autumn', 'winter']);
const HIST = 7;   // avg7 — 몬스테라 plant_grow §growthBlockReason 과 같은 창(7일)
const SALT = Object.freeze({ jitter: 1, varie: 2, kind: 3, corms: 4, cormSeed: 5, cutSeed: 6 });

/* 씨앗 · 순번 · 소금 → [0,1). 그루 밖 상태를 안 읽는다. */
export function u01(seed, k, salt) {
  let h = (seed >>> 0) ^ Math.imul(k | 0, 0x9E3779B1) ^ Math.imul(salt | 0, 0x85EBCA77);
  h = Math.imul(h ^ (h >>> 16), 0x21F0AAAD);
  h = Math.imul(h ^ (h >>> 15), 0x735A2D97);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
const r3 = v => Math.round(v * 1000) / 1000;
const clamp01 = v => Math.max(0, Math.min(1, v));

export function createSpeciesRules(SPEC, TH) {
  if (!SPEC || SPEC.schema !== SPECIES_SCHEMA || !SPEC.species) throw new Error(`[종 생장] growth_species.json 이 아니다(schema ${SPEC && SPEC.schema})`);
  for (const [id, S] of Object.entries(SPEC.species)) {
    /* thresholdsFor 는 줄이 없으면 TH.default 로 «조용히» 넘어간다 — 그 길을 여기서 막는다 */
    if (!TH || !TH.plants || !TH.plants[S.light_id]) throw new Error(`[종 생장] ${id}: light_thresholds.json plants.${S.light_id} 줄이 없다`);
    if (!(S.interval_days > 0)) throw new Error(`[종 생장] ${id}: interval_days 가 없다`);
    for (const st of S.leaf_ladder) if (!S.leaf_size_m[st] || !S.assets[st]) throw new Error(`[종 생장] ${id}: 단계 ${st} 의 크기·판이 없다`);
  }
  const specOf = (id) => { const S = SPEC.species[id]; if (!S) throw new Error(`[종 생장] 모르는 종 «${id}»`); return S; };
  const kindsOf = (S) => Object.keys(S.varie_kinds || {}).filter(k => !k.startsWith('_'));

  /* 빛 문턱 — AL 무늬 그루는 그루마다라 id 가 아니라 «그 그루가 무늬냐»로 ×need_mult 를 받는다 */
  const thOf = (p) => { const S = specOf(p.species); return thresholdsFor(TH, S.light_id, p.species === 'alocasia_frydek' ? !!p.varie : undefined); };
  const avg7 = (p) => p.hist.length ? p.hist.reduce((a, v) => a + v, 0) / p.hist.length : 0;
  const stageOf = (S, idx) => S.leaf_ladder[Math.max(0, Math.min(S.leaf_ladder.length - 1, idx))];
  const speedOf = (S, band, season) => (S.speed_by_band[band] || 0) * (S.season_speed[season] ?? 0);

  /* ── PP 분홍 ─────────────────────────────── */
  function gradeOfPink(S, pink) {
    const P = S.pink;
    if (pink <= P.green_max) return 'green';
    if (pink >= P.pink_leaf_min) return 'pink';
    if (pink >= P.heavy_min) return 'heavy';
    return 'marble';
  }
  function pinkStreak(p) {
    const S = specOf(p.species); let n = 0;
    for (let i = p.leaves.length - 1; i >= 0 && p.leaves[i].pink >= S.pink.pink_leaf_min; i--) n++;
    return n;
  }

  function newPlant(species, opt = {}) {
    const S = specOf(species);
    const seed = (opt.seed ?? 1) >>> 0;
    const base = { schema: SPECIES_SCHEMA, species, seed, day: 0, step: 0, hist: [], births: 0, leaves: [] };
    if (species === 'pink_princess') {
      /* pinks: 잎마다 분홍 몫(아래→위) — 교환 사건처럼 «정해진 그루»를 줄 때. 없으면 leaves 장이 모두 pink(기본 start) */
      const pinks = Array.isArray(opt.pinks) ? opt.pinks : Array.from({ length: opt.leaves ?? 1 }, () => opt.pink ?? S.pink.start);
      const n = pinks.length, nodes = opt.nodes ?? n;
      if (!(n >= 1) || nodes < n) throw new Error('[종 생장] PP: 잎이 1장 이상이고 마디 수 ≥ 잎 수여야 한다');
      pinks.forEach((v, i) => { const no = nodes - n + 1 + i; base.leaves.push({ no, born: 0, stage: stageOf(S, no - 1), pink: r3(clamp01(v)) }); });
      const p = { ...base, nodes, witherAt: null };
      if (pinkStreak(p) >= S.pink.wither_streak) p.witherAt = S.pink.wither_grace_days;   // 받은 그루가 이미 분홍 잎 줄이면 그날부터 잰다
      return p;
    }
    if (species === 'alocasia_frydek') {
      const origin = opt.origin || 'shop';
      if (!(origin in S.corm.varie_chance)) throw new Error(`[종 생장] AL: 구근 출처 «${origin}» 를 모른다`);
      return { ...base, phase: 'corm', origin, motherKind: opt.motherKind ?? null, varie: null, lad: 0,
        lowRun: 0, wakeRun: 0, dropRun: 0, sleptDays: 0, wakes: 0, cormsMade: 0 };
    }
    throw new Error(`[종 생장] 규칙이 없는 종 «${species}»`);
  }

  function assertPlant(p) {
    if (!p || p.schema !== SPECIES_SCHEMA) throw new Error(`[종 생장] 그루 상태가 아니다(schema ${p && p.schema})`);
    specOf(p.species);
    if (!Array.isArray(p.leaves) || !Array.isArray(p.hist)) throw new Error('[종 생장] 그루 상태가 깨졌다(leaves·hist)');
    return p;
  }

  /* ── 하루 ─────────────────────────────── */
  function stepDay(p, { dli, season, yearDay } = {}) {
    assertPlant(p);
    if (!Number.isFinite(dli) || dli < 0) throw new Error(`[종 생장] 그날 DLI 가 없다(${dli}) — 빛이 안 들어온 날을 0 으로 넘기지 않는다`);
    const se = season ?? (Number.isFinite(yearDay) ? seasonOf(yearDay) : null);
    if (!SEASONS.includes(se)) throw new Error(`[종 생장] 계절이 없다(season ${season} · yearDay ${yearDay})`);
    p.day += 1;
    p.hist.push(dli); if (p.hist.length > HIST) p.hist.splice(0, p.hist.length - HIST);
    const S = specOf(p.species);
    const ev = [];
    if (p.species === 'pink_princess') stepPP(p, S, se, ev);
    else stepAL(p, S, se, ev);
    return ev;
  }

  function stepPP(p, S, season, ev) {
    const P = S.pink;
    /* 줄기 끝이 시드는 중 — 새 잎이 멎는다. 그 사이 잘라 줄을 끊으면 산다 */
    if (p.witherAt != null) {
      const k = pinkStreak(p);
      if (k < P.wither_streak) p.witherAt = null;              // (자르기가 이미 끊었으면 cutAbove 가 지웠다 — 여기는 안전망)
      else if (p.day >= p.witherAt) {
        const keep = Math.max(S.propagation.mother_keeps_min, p.leaves.length - k);
        const gone = p.leaves.length - keep;
        p.leaves.splice(keep); p.nodes = p.leaves.length ? p.leaves[p.leaves.length - 1].no : p.nodes;
        p.witherAt = null; p.step = 0;
        ev.push({ type: 'tip_withered', count: gone });
        return;
      } else return;
    }
    const th = thOf(p), a = avg7(p);
    if (a < th.min) return;                                   // 빛이 막는다(계절이 아니다)
    const band = judgeDLI(a, th).band;
    p.step += speedOf(S, band, season);
    if (p.step < S.interval_days) return;
    p.step -= S.interval_days;
    const top = p.leaves[p.leaves.length - 1];
    const parent = top ? top.pink : P.start;
    let pink = 0;
    if (parent > P.green_max) {
      const j = (u01(p.seed, p.births, SALT.jitter) * 2 - 1) * P.jitter;
      pink = clamp01(parent + j + (a < th.best_lo ? P.drift_low_light : 0));
    }
    pink = r3(pink);
    p.births += 1; p.nodes += 1;
    const leaf = { no: p.nodes, born: p.day, stage: stageOf(S, p.nodes - 1), pink };
    p.leaves.push(leaf);
    ev.push({ type: 'leaf', no: leaf.no, pink, grade: gradeOfPink(S, pink) });
    const k = pinkStreak(p);
    if (k >= P.wither_streak) { p.witherAt = p.day + P.wither_grace_days; ev.push({ type: 'tip_withering', streak: k, at: p.witherAt }); }
  }

  function stepAL(p, S, season, ev) {
    const D = S.dormancy, th = thOf(p), a = avg7(p);
    const sleepSeason = D.seasons.includes(season);
    if (p.phase === 'corm') {
      /* 흙 속 구근 — 빛이 아니라 철로 깬다(잎이 없다). 잠 철엔 기다린다 */
      p.step += sleepSeason ? 0 : (S.season_speed[season] ?? 0);
      if (p.step < S.corm.sprout_days) return;
      p.step = 0;
      const c = S.corm.varie_chance[p.origin] ?? 0;
      const kinds = kindsOf(S);
      let varie = null;
      if (u01(p.seed, 0, SALT.varie) < c)
        varie = (p.origin === 'from_varie_mother' && kinds.includes(p.motherKind)) ? p.motherKind
          : kinds[Math.min(kinds.length - 1, Math.floor(u01(p.seed, 0, SALT.kind) * kinds.length))];
      p.varie = varie; p.phase = 'growing';
      ev.push({ type: 'sprout', varie });
      addALLeaf(p, S, ev);
      return;
    }
    if (p.phase === 'growing') {
      if (sleepSeason) { p.phase = 'dropping'; p.dropRun = 0; p.wakeRun = 0; ev.push({ type: 'dormancy_start', why: 'season' }); }
      else if (a < th.min) {
        p.lowRun += 1;
        if (p.lowRun >= D.low_days) { p.phase = 'dropping'; p.dropRun = 0; p.wakeRun = 0; ev.push({ type: 'dormancy_start', why: 'low_light' }); }
        return;
      } else p.lowRun = 0;
      if (p.phase === 'growing') {
        p.step += speedOf(S, judgeDLI(a, th).band, season);
        if (p.step >= S.interval_days) { p.step -= S.interval_days; addALLeaf(p, S, ev); }
        return;
      }
    }
    /* 잠 드는 중(dropping) · 잠(asleep) — 깨는 길을 먼저 본다 */
    if (!sleepSeason && a >= th.min) p.wakeRun += 1; else p.wakeRun = 0;
    if (p.wakeRun >= D.wake_days) { wakeAL(p, S, ev); return; }
    if (p.phase === 'dropping') {
      p.dropRun += 1;
      if (p.dropRun >= D.drop_every_days && p.leaves.length) {
        p.dropRun = 0;
        const g = p.leaves.shift(); ev.push({ type: 'leaf_drop', no: g.no });
      }
      if (!p.leaves.length) { p.phase = 'asleep'; p.sleptDays = 0; ev.push({ type: 'asleep' }); }
      return;
    }
    if (p.phase === 'asleep') p.sleptDays += 1;
  }

  function addALLeaf(p, S, ev) {
    p.births += 1;
    const leaf = { no: p.births, born: p.day, stage: stageOf(S, p.lad) };
    p.lad += 1;
    p.leaves.push(leaf);
    ev.push({ type: 'leaf', no: leaf.no, stage: leaf.stage });
    while (p.leaves.length > S.max_leaves) { const g = p.leaves.shift(); ev.push({ type: 'leaf_drop', no: g.no }); }
  }

  function wakeAL(p, S, ev) {
    const G = S.propagation, D = S.dormancy;
    const slept = p.phase === 'asleep' && p.sleptDays >= G.min_sleep_days;
    const corms = [];
    if (slept) {
      const [lo, hi] = G.corms_on_wake;
      const n = lo + Math.min(hi - lo, Math.floor(u01(p.seed, p.wakes, SALT.corms) * (hi - lo + 1)));
      for (let i = 0; i < n; i++)
        corms.push({ seed: Math.floor(u01(p.seed, p.wakes * 16 + i, SALT.cormSeed) * 4294967296) >>> 0,
          origin: p.varie ? 'from_varie_mother' : 'from_plain_mother', motherKind: p.varie });
    }
    p.wakes += 1; p.cormsMade += corms.length;
    p.phase = 'growing'; p.step = 0; p.lowRun = 0; p.wakeRun = 0; p.dropRun = 0; p.sleptDays = 0;
    p.lad = Math.max(0, p.lad - D.wake_ladder_drop);
    ev.push({ type: 'wake', corms });
  }

  /* ── PP 자르기 ─────────────────────────────── */
  function cutAbove(p, nodeNo) {
    assertPlant(p);
    if (p.species !== 'pink_princess') throw new Error(`[종 생장] ${p.species} 는 줄기를 자르지 않는다`);
    const S = specOf(p.species), G = S.propagation;
    const keep = p.leaves.filter(l => l.no <= nodeNo), take = p.leaves.filter(l => l.no > nodeNo);
    if (!keep.length || keep[keep.length - 1].no !== nodeNo) throw new Error(`[종 생장] PP: 마디 ${nodeNo} 에 잎이 없다 — 잎이 난 마디 바로 위만 자른다`);
    if (keep.length < G.mother_keeps_min) throw new Error('[종 생장] PP: 모주에 잎이 남아야 한다');
    if (take.length < G.cutting_takes_min) throw new Error('[종 생장] PP: 삽수에 잎이 한 장은 가야 한다');
    const cutSeed = Math.floor(u01(p.seed, p.births, SALT.cutSeed) * 4294967296) >>> 0;
    const cutting = { schema: SPECIES_SCHEMA, species: p.species, seed: cutSeed, day: 0, step: 0, hist: [], births: 0,
      leaves: take.map(l => ({ ...l })), nodes: take[take.length - 1].no, witherAt: null,
      viable: take.some(l => l.pink < S.pink.pink_leaf_min) };
    p.leaves = keep; p.nodes = nodeNo; p.step = 0;
    /* saved — 시드는 중이던 줄기 끝을 이 자르기가 살렸나(분홍 잎 줄이 끊겼나) */
    const saved = p.witherAt != null && pinkStreak(p) < S.pink.wither_streak;
    if (saved) p.witherAt = null;
    return { cutting, saved };
  }

  /* ── 그림 · 스냅샷 ─────────────────────────────── */
  function gradeOf(p, leaf) {
    const S = specOf(p.species);
    return p.species === 'pink_princess' ? gradeOfPink(S, leaf.pink) : (p.varie || 'plain');
  }
  function leafRows(p) {
    assertPlant(p);
    const S = specOf(p.species);
    return p.leaves.map(l => {
      const grade = gradeOf(p, l);
      const row = { no: l.no, born: l.born, stage: l.stage, grade, size_m: S.leaf_size_m[l.stage], asset: S.assets[l.stage][grade] };
      if (p.species === 'pink_princess') row.pink = l.pink;
      return row;
    });
  }
  function summary(p) {
    assertPlant(p);
    const out = { species: p.species, day: p.day, leaves: p.leaves.length };
    if (p.species === 'pink_princess') {
      const top = p.leaves[p.leaves.length - 1];
      Object.assign(out, { topPink: top ? top.pink : null, topGrade: top ? gradeOfPink(specOf(p.species), top.pink) : null,
        pinkStreak: pinkStreak(p), withering: p.witherAt != null, witherAt: p.witherAt });
    } else Object.assign(out, { phase: p.phase, asleep: p.phase === 'asleep', varie: p.varie, cormsMade: p.cormsMade });
    return out;
  }

  return { newPlant, stepDay, cutAbove, leafRows, summary, assertPlant, thresholdsOf: thOf, avg7, pinkStreak,
    species: () => Object.keys(SPEC.species) };
}

/* 브라우저 · 코어용 — 두 정본을 읽어 규칙을 세운다(loop.js 가 growth_tuning 을 읽는 꼴과 같다) */
export async function loadSpeciesRules() {
  const spec = await import('../../data/growth_species.json', { with: { type: 'json' } });
  const th = await import('../../data/balance/light_thresholds.json', { with: { type: 'json' } });
  return createSpeciesRules(spec.default, th.default);
}
