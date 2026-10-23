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
     AL  sprout { varie, slept, corms } · leaf { no } · leaf_drop { no } · dormancy_start { why } · asleep { corms } · wake
         corms = [{ seed, origin, motherKind }] — 구근을 «찾는» 때는 둘뿐이다(한 번의 잠에 한 번):
           asleep  잎을 내며 자라던 그루가 잠에 들어 잎이 다 지는 날(D52)
           sprout  slept = 잠 철을 기다린 «잠든 구근»이 봄에 싹틀 때(D49)
         wake 는 «다시 깼다» 장면만 — 구근이 안 나온다(D52)

   ★ 2026-10-23 D71(총괄 · plan-species2-shop-spec §3) — 두 종 더: 스킨답서스 마블퀸(SC · 'scindapsus') · 칼라테아 오비폴리아(CA · 'calathea')
     이름은 core 와 맞춘 것(core 제안 꼴 그대로 · 10-23):
     R.newPlant('scindapsus', { seed, form:'cutting'|'rooted', nodes })   상점 «줄기 삽수»(기본 cutting · 뿌리 없음)
     R.newPlant('calathea', { seed, leaves, curled:'all'|n, stage })     맡은 칼라테아(다 큰 잎 · 다 말림)
     R.stepDay(p, { dli, season, dropM })   ★ SC 'growing' 은 dropM 이 꼭 있어야 한다 — 없으면 던진다(조용히 안 메꿈)
                                            dropM = 그 자리에서 «떨어지는 높이»(m · house.js dropBelow · 자리 plantSlots[].dropM — 받침 높이 아님)
     R.cutAbove(p, nodeNo)                  SC 도 PP 와 같은 손 — 잘린 끝 = phase 'cutting' 그루
     R.scStemCapM(dropM) · R.scInternodeM(p) · R.isHighSpot(dropM) · R.longVineM() · R.bandOf(species) · R.spotFit(species, dli)
   사건
     SC  rooted · node { no, lengthM, marble } · reached_floor { lengthM }
     CA  leaf { no, stage } · leaf_drop { no } · curl { curled } · unfurl { no, curled } · unfurled_all
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
const r4 = v => Math.round(v * 10000) / 10000;
const clamp01 = v => Math.max(0, Math.min(1, v));
const EPS = 1e-9;

export function createSpeciesRules(SPEC, TH) {
  if (!SPEC || SPEC.schema !== SPECIES_SCHEMA || !SPEC.species) throw new Error(`[종 생장] growth_species.json 이 아니다(schema ${SPEC && SPEC.schema})`);
  for (const [id, S] of Object.entries(SPEC.species)) {
    /* thresholdsFor 는 줄이 없으면 TH.default 로 «조용히» 넘어간다 — 그 길을 여기서 막는다 */
    if (!TH || !TH.plants || !TH.plants[S.light_id]) throw new Error(`[종 생장] ${id}: light_thresholds.json plants.${S.light_id} 줄이 없다`);
    if (!(S.interval_days > 0)) throw new Error(`[종 생장] ${id}: interval_days 가 없다`);
    for (const st of S.leaf_ladder) if (!S.leaf_size_m[st] || !S.assets[st]) throw new Error(`[종 생장] ${id}: 단계 ${st} 의 크기·판이 없다`);
    if (id === 'scindapsus') {
      const V = S.vine;
      if (!V || !(V.pot_over_m >= 0) || !(V.high_spot_min_m > 0)) throw new Error('[종 생장] scindapsus: vine(pot_over_m · high_spot_min_m)이 없다');
      /* D76 — long_vine_m 은 어느 높은 자리에서도 닿아야 한다(상한(문턱) 이하) · 칸이 없으면 조용히 옛 정의로 안 넘어간다 */
      if (!(V.long_vine_m > 0) || V.long_vine_m > r4(V.high_spot_min_m + V.pot_over_m) + 1e-9)
        throw new Error(`[종 생장] scindapsus: vine.long_vine_m(${V.long_vine_m})이 없거나 높은 자리 상한(${r4(V.high_spot_min_m + V.pot_over_m)})보다 길다`);
      for (const st of S.leaf_ladder) if (!(V.internode_m && V.internode_m[st] > 0)) throw new Error(`[종 생장] scindapsus: 단계 ${st} 의 마디 사이가 없다`);
      if (!(S.propagation && S.propagation.root_days > 0)) throw new Error('[종 생장] scindapsus: propagation.root_days 가 없다');
    }
    if (id === 'calathea') {
      const C = S.curl;
      if (!C || !(C.curl_days > 0) || !(C.unfurl_days > 0) || !C.unfurl_by_band) throw new Error('[종 생장] calathea: curl(curl_days · unfurl_days · unfurl_by_band)이 없다');
      if (!(S.max_leaves >= 1)) throw new Error('[종 생장] calathea: max_leaves 가 없다');
    }
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
      return { ...base, phase: 'corm', origin, motherKind: opt.motherKind ?? null, varie: null, lad: 0, cormSlept: false,
        lowRun: 0, wakeRun: 0, dropRun: 0, sleptDays: 0, wakes: 0, finds: 0, sinceFind: 0, cormsMade: 0 };
    }
    if (species === 'scindapsus') {
      /* 상점 «줄기 삽수» — 마디 nodes 개(마디마다 잎 한 장 · 다 마블). 잎 at = 줄기 밑에서 그 마디까지 길이(m) */
      const form = opt.form ?? 'cutting';
      if (form !== 'cutting' && form !== 'rooted') throw new Error(`[종 생장] SC: form «${form}» 를 모른다(cutting | rooted)`);
      const n = opt.nodes ?? S.propagation.start_nodes;
      if (!(Number.isInteger(n) && n >= 1)) throw new Error('[종 생장] SC: 마디가 1개 이상이어야 한다');
      let at = 0;
      for (let no = 1; no <= n; no++) {
        const stage = stageOf(S, no - 1);
        at += S.vine.internode_m[stage];
        base.leaves.push({ no, born: 0, stage, marble: true, at: r4(at) });
      }
      return { ...base, nodes: n, phase: form === 'cutting' ? 'cutting' : 'growing', rootDays: 0,
        lengthM: r4(at), atFloor: false, dropM: null };
    }
    if (species === 'calathea') {
      /* 맡은 칼라테아(ca_care) — 다 큰 잎 leaves 장 · curled 장이 다 말림(오래된 잎부터) */
      const n = opt.leaves ?? S.start_leaves;
      if (!(Number.isInteger(n) && n >= 1 && n <= S.max_leaves)) throw new Error(`[종 생장] CA: 잎이 1 ~ ${S.max_leaves} 장이어야 한다`);
      const k = opt.curled === 'all' ? n : (opt.curled ?? 0);
      if (!(Number.isInteger(k) && k >= 0 && k <= n)) throw new Error('[종 생장] CA: curled 는 \'all\' 또는 0 ~ 잎 수');
      const stage = opt.stage ?? 'mature';
      if (!S.leaf_size_m[stage]) throw new Error(`[종 생장] CA: 단계 «${stage}» 를 모른다`);
      for (let i = 0; i < n; i++) base.leaves.push({ no: i + 1, born: 0, stage, curl: i < k ? 1 : 0 });
      return { ...base, births: n, lad: stage === 'mature' ? S.leaf_ladder.length - 1 : S.leaf_ladder.indexOf(stage) + 1 };
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
  function stepDay(p, { dli, season, yearDay, dropM } = {}) {
    assertPlant(p);
    if (!Number.isFinite(dli) || dli < 0) throw new Error(`[종 생장] 그날 DLI 가 없다(${dli}) — 빛이 안 들어온 날을 0 으로 넘기지 않는다`);
    const se = season ?? (Number.isFinite(yearDay) ? seasonOf(yearDay) : null);
    if (!SEASONS.includes(se)) throw new Error(`[종 생장] 계절이 없다(season ${season} · yearDay ${yearDay})`);
    /* SC 는 뿌리 뒤 «받침 → 바닥» 높이가 있어야 줄기 상한이 선다 — 하루를 넘기기 «전에» 막는다(그루를 반쯤 고치고 던지지 않게) */
    if (p.species === 'scindapsus' && p.phase === 'growing' && !(Number.isFinite(dropM) && dropM >= 0))
      throw new Error(`[종 생장] SC: 놓인 자리 높이 dropM 이 없다(${dropM}) — 줄기 상한을 못 세운다`);
    p.day += 1;
    p.hist.push(dli); if (p.hist.length > HIST) p.hist.splice(0, p.hist.length - HIST);
    const S = specOf(p.species);
    const ev = [];
    if (p.species === 'pink_princess') stepPP(p, S, se, ev);
    else if (p.species === 'alocasia_frydek') stepAL(p, S, se, ev);
    else if (p.species === 'scindapsus') stepSC(p, S, se, dropM, ev);
    else if (p.species === 'calathea') stepCA(p, S, se, ev);
    else throw new Error(`[종 생장] 하루 규칙이 없는 종 «${p.species}»`);
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
      /* 흙 속 구근 — 빛이 아니라 철로 깬다(잎이 없다). 잠 철엔 기다린다.
         ★ D49(총괄 2026-10-09) — 잠 철을 기다린 구근은 «잠든 구근»이다: 잎 0 으로 오래 잔 그루와 같게 보아
           싹틀 때(= 봄에 깰 때) 구근 1~3알을 같이 낸다(corm.sleeping_corm_makes_corms).
           까닭: 원룸은 8~12달이라 겨울 이사 판이 «한 바퀴 자란 뒤 겨울잠 → 다음 봄»을 기다리면 열어 보기를 한 번도 못 본다.
           ⚠ 잠 조건 가운데 «어둠 low_days»는 구근에 안 든다 — 구근은 빛을 안 본다(잎이 없다). 어둠은 싹튼 뒤 그루에 걸린다. */
      if (sleepSeason) p.cormSlept = true;
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
      const slept = !!(p.cormSlept && S.corm.sleeping_corm_makes_corms);
      const corms = slept && canFind(p, S) ? findCorms(p, S) : [];   // 잠든 구근의 싹틈 = 그 한 번의 잠에서 찾는 한 번(평생 횟수에 든다 · D56)
      ev.push({ type: 'sprout', varie, slept, corms });
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
      if (!p.leaves.length) {
        /* ★ D52(총괄 2026-10-09) — 구근은 «잠에 들 때» 찾는다: 잎이 다 지는 그날 흙 속에서 구근 1~3알.
             «잎을 내며 자라던» 그루만 — 지난번 찾은 뒤 잎을 min_leaves_since_find 장 이상 낸 그루(어두운 데 넣었다 빼기를
             되풀이해 구근을 찍지 못하게 · 한 번의 잠에 한 번). 잎이 다 지기 전에 깨면(dropping 에서 깸) 못 찾는다. */
        const corms = p.sinceFind >= S.propagation.min_leaves_since_find && canFind(p, S) ? findCorms(p, S) : [];
        p.phase = 'asleep'; p.sleptDays = 0; ev.push({ type: 'asleep', corms });
      }
      return;
    }
    if (p.phase === 'asleep') p.sleptDays += 1;
  }

  function addALLeaf(p, S, ev) {
    p.births += 1; p.sinceFind += 1;
    const leaf = { no: p.births, born: p.day, stage: stageOf(S, p.lad) };
    p.lad += 1;
    p.leaves.push(leaf);
    ev.push({ type: 'leaf', no: leaf.no, stage: leaf.stage });
    while (p.leaves.length > S.max_leaves) { const g = p.leaves.shift(); ev.push({ type: 'leaf_drop', no: g.no }); }
  }

  /* 봄 깸 — «다시 깼다» 장면만. 구근은 여기서 안 나온다(D52 · 잠에 들 때 이미 찾았다) */
  function wakeAL(p, S, ev) {
    const D = S.dormancy;
    p.wakes += 1;
    p.phase = 'growing'; p.step = 0; p.lowRun = 0; p.wakeRun = 0; p.dropRun = 0; p.sleptDays = 0;
    p.lad = Math.max(0, p.lad - D.wake_ladder_drop);
    ev.push({ type: 'wake' });
  }

  /* 구근을 찾는다 — 수는 corms_per_find 범위에서 고르게 · 출처는 «지금 이 그루»(무늬면 갈래를 잇는다).
     ★ 열쇠는 p.finds(몇 번째 찾음인가) — 찾을 때마다 올린다. 잠든 구근의 싹틈(D49)도 한 번의 찾음이다 */
  /* ★ D56(총괄 2026-10-09 · core 판: 찾은 구근을 심으면 그 그루가 또 찾아 판당 심은 구근 18 · 가방에 갇힌 그루-날 517) —
       한 그루가 구근을 찾는 것은 «평생» propagation.max_finds_lifetime 번까지(첫 두 잠 · D49 잠든 구근의 봄 싹틈도 한 번).
       그 뒤의 잠은 «잤다 깼다»만(asleep 사건의 corms 는 []). 칸이 없으면(옛 값 파일) 막지 않는다. */
  function canFind(p, S) {
    const cap = S.propagation.max_finds_lifetime;
    return !(Number.isFinite(cap) && (p.finds || 0) >= cap);
  }
  function findCorms(p, S) {
    const [lo, hi] = S.propagation.corms_per_find;
    const n = lo + Math.min(hi - lo, Math.floor(u01(p.seed, p.finds, SALT.corms) * (hi - lo + 1)));
    const out = [];
    for (let i = 0; i < n; i++)
      out.push({ seed: Math.floor(u01(p.seed, p.finds * 16 + i, SALT.cormSeed) * 4294967296) >>> 0,
        origin: p.varie ? 'from_varie_mother' : 'from_plain_mother', motherKind: p.varie });
    p.finds += 1; p.sinceFind = 0; p.cormsMade += out.length;
    return out;
  }

  /* ── SC 늘어지는 덩굴(D71) ─────────────────────────────── */
  /* 줄기 상한 = 떨어지는 높이(dropM · house dropBelow) + 화분을 넘는 몫. r4 로 묶어 «바닥에 닿은 길이»와 longVineM 이 같은 수가 되게 한다 */
  const capOf = (S, dropM) => r4(dropM + S.vine.pot_over_m);
  const interOf = (S, no) => S.vine.internode_m[stageOf(S, no - 1)];     // 마디 no 아래 마디 사이(그 마디 잎 단계)
  const lastAt = p => p.leaves.length ? p.leaves[p.leaves.length - 1].at : 0;
  const FLOOR_TOL = 1e-4;                                                 // r4 로 묶은 수끼리 비교 — 반올림 한 톨에 날마다 «닿음»을 되풀이하지 않게
  function stepSC(p, S, season, dropM, ev) {
    if (p.phase === 'cutting') {
      /* 뿌리내리는 동안은 빛과 무관 — «놓인 날»만 센다(core 몬스테라 물꽂이 METHODS.water 와 같은 근거 · 같은 12일) */
      p.rootDays += 1;
      if (p.rootDays >= S.propagation.root_days) { p.phase = 'growing'; p.step = 0; ev.push({ type: 'rooted' }); }
      return;
    }
    p.dropM = r4(dropM);
    const cap = capOf(S, dropM);
    if (p.lengthM >= cap - FLOOR_TOL) {
      /* 끝이 바닥에 닿았다(또는 높은 데서 낮은 데로 옮겨 남는 몫이 바닥에 누웠다) — 줄기는 안 줄고 자람만 멎는다 */
      if (!p.atFloor) { p.atFloor = true; ev.push({ type: 'reached_floor', lengthM: p.lengthM }); }
      return;
    }
    p.atFloor = false;
    const th = thOf(p), a = avg7(p);
    if (a < th.min) return;                                               // 빛이 막는다
    const sp = speedOf(S, judgeDLI(a, th).band, season);
    if (!(sp > 0)) return;
    p.step += sp;
    while (p.step >= S.interval_days) {
      const at = lastAt(p) + interOf(S, p.nodes + 1);
      if (at > cap + FLOOR_TOL) { p.step = S.interval_days; break; }      // 다음 마디 자리가 바닥 밑 — 끝이 바닥에서 멈춘다
      p.step -= S.interval_days;
      p.births += 1; p.nodes += 1;
      const marble = a >= th[S.marble.fade_below];                        // 어두울 때 난 잎은 크림 마블 없이(그림만)
      const leaf = { no: p.nodes, born: p.day, stage: stageOf(S, p.nodes - 1), marble, at: r4(at) };
      p.leaves.push(leaf);
      ev.push({ type: 'node', no: leaf.no, lengthM: leaf.at, marble });
    }
    /* 줄기 끝 = 맨 끝 마디 + 다음 마디까지 쌓인 걸음 몫 — 날마다 이어서 는다 */
    const frac = Math.min(1, p.step / S.interval_days);
    p.lengthM = Math.min(cap, r4(lastAt(p) + frac * interOf(S, p.nodes + 1)));
    if (p.lengthM >= cap - FLOOR_TOL) { p.lengthM = cap; p.atFloor = true; ev.push({ type: 'reached_floor', lengthM: cap }); }
  }

  /* ── CA 말림 · 펴짐(D71) ─────────────────────────────── */
  const curledCount = p => p.leaves.reduce((n, l) => n + (l.curl > 0 ? 1 : 0), 0);
  function stepCA(p, S, season, ev) {
    const C = S.curl, th = thOf(p), a = avg7(p), band = judgeDLI(a, th).band;
    const before = curledCount(p);
    if (band === 'over') {
      /* 너무 밝다(avg7 > hi) — 모든 잎이 말리고 자람이 멎는다 */
      for (const l of p.leaves) l.curl = r4(Math.min(1, l.curl + 1 / C.curl_days));
      const now = curledCount(p);
      if (now > before) ev.push({ type: 'curl', curled: now });
      return;
    }
    if (before > 0) {
      /* 대역 안 — 말린 잎이 새 잎부터 편다. 어둠(min 밑)에서는 안 펴진다. 말린 잎이 있는 동안은 새 잎이 안 난다 */
      const rate = (C.unfurl_by_band[band] || 0) / C.unfurl_days;
      if (rate > 0) {
        const n = p.leaves.length;
        for (let i = n - 1; i >= 0; i--) {
          const l = p.leaves[i];
          if (!(l.curl > 0)) continue;
          l.curl = r4(Math.max(0, l.curl - rate / (1 + C.stagger * (n - 1 - i))));
          if (l.curl <= EPS) { l.curl = 0; ev.push({ type: 'unfurl', no: l.no, curled: curledCount(p) }); }
        }
        if (curledCount(p) === 0) ev.push({ type: 'unfurled_all' });
      }
      return;
    }
    if (a < th.min) return;
    p.step += speedOf(S, band, season);
    if (p.step >= S.interval_days) { p.step -= S.interval_days; addCALeaf(p, S, ev); }
  }
  function addCALeaf(p, S, ev) {
    p.births += 1;
    const leaf = { no: p.births, born: p.day, stage: stageOf(S, p.lad), curl: 0 };
    p.lad += 1;
    p.leaves.push(leaf);
    ev.push({ type: 'leaf', no: leaf.no, stage: leaf.stage });
    while (p.leaves.length > S.max_leaves) { const g = p.leaves.shift(); ev.push({ type: 'leaf_drop', no: g.no }); }
  }

  /* ── PP 자르기 ─────────────────────────────── */
  function cutAbove(p, nodeNo) {
    assertPlant(p);
    if (p.species === 'scindapsus') return cutSC(p, nodeNo);
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

  /* SC 마디 자르기(D71) — 마디 nodeNo 바로 위를 자른다. 윗부분(마디들 + 자라던 끝)은 뿌리 없는 삽수(phase 'cutting')가 되고
     at 은 자른 자리부터 다시 잰다. 모주는 자른 마디에서 다시 자란다(마디 번호 그대로 — 성숙한 줄기는 성숙한 잎) */
  function cutSC(p, nodeNo) {
    const S = specOf(p.species), G = S.propagation;
    const keep = p.leaves.filter(l => l.no <= nodeNo), take = p.leaves.filter(l => l.no > nodeNo);
    if (!keep.length || keep[keep.length - 1].no !== nodeNo) throw new Error(`[종 생장] SC: 마디 ${nodeNo} 이 없다 — 마디 바로 위만 자른다`);
    if (keep.length < G.mother_keeps_min) throw new Error('[종 생장] SC: 모주에 마디가 남아야 한다');
    if (take.length < G.cutting_takes_min) throw new Error('[종 생장] SC: 삽수에 마디가 하나는 가야 한다');
    const cutAt = keep[keep.length - 1].at;
    const cutSeed = Math.floor(u01(p.seed, p.births, SALT.cutSeed) * 4294967296) >>> 0;
    const cutting = { schema: SPECIES_SCHEMA, species: p.species, seed: cutSeed, day: 0, step: 0, hist: [], births: 0,
      leaves: take.map(l => ({ ...l, at: r4(l.at - cutAt) })), nodes: take[take.length - 1].no,
      phase: 'cutting', rootDays: 0, lengthM: r4(Math.max(p.lengthM, take[take.length - 1].at) - cutAt), atFloor: false, dropM: null };
    p.leaves = keep; p.nodes = nodeNo; p.step = 0; p.lengthM = cutAt; p.atFloor = false;
    return { cutting, saved: false };
  }

  /* ── 그림 · 스냅샷 ─────────────────────────────── */
  /* grade — 판을 고르는 칸 이름. ⚠ SC 의 marble/green 은 «그림만»이다(등급·값 아님 · 명세 «SC 무늬 등급 하지 않음») · CA 는 plain 하나 */
  function gradeOf(p, leaf) {
    const S = specOf(p.species);
    if (p.species === 'pink_princess') return gradeOfPink(S, leaf.pink);
    if (p.species === 'scindapsus') return leaf.marble ? 'marble' : 'green';
    if (p.species === 'calathea') return 'plain';
    return p.varie || 'plain';
  }
  function leafRows(p) {
    assertPlant(p);
    const S = specOf(p.species);
    return p.leaves.map(l => {
      const grade = gradeOf(p, l);
      const row = { no: l.no, born: l.born, stage: l.stage, grade, size_m: S.leaf_size_m[l.stage], asset: S.assets[l.stage][grade] };
      if (p.species === 'pink_princess') row.pink = l.pink;
      if (p.species === 'scindapsus') { row.at = l.at; row.marble = !!l.marble; }
      if (p.species === 'calathea') row.curl = l.curl;
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
    } else if (p.species === 'scindapsus') {
      /* nodes = 이 줄기(조각)에 붙은 마디 수(= 잎 수) · capM = 마지막으로 놓인 자리의 상한(모르면 null) */
      const S = specOf(p.species);
      Object.assign(out, { phase: p.phase, nodes: p.leaves.length, lengthM: p.lengthM,
        capM: Number.isFinite(p.dropM) ? capOf(S, p.dropM) : null, atFloor: !!p.atFloor,
        rootDaysLeft: p.phase === 'cutting' ? Math.max(0, S.propagation.root_days - p.rootDays) : 0 });
    } else if (p.species === 'calathea') {
      /* tooBright · tooDark = avg7 결(말림 규칙과 같은 자) · 빛을 하루도 못 봤으면 null(모른다) */
      const th = thOf(p), a = avg7(p), known = p.hist.length > 0;
      Object.assign(out, { curled: curledCount(p), tooBright: known ? a > th.max : null, tooDark: known ? a < th.best_lo : null });
    } else Object.assign(out, { phase: p.phase, asleep: p.phase === 'asleep', varie: p.varie, cormsMade: p.cormsMade });
    return out;
  }

  /* ── core 가드용 수(D71 · 이름은 core 와 맞춤) ─────────────────────────────── */
  const SCS = () => specOf('scindapsus');
  function scStemCapM(dropM) {
    if (!(Number.isFinite(dropM) && dropM >= 0)) throw new Error(`[종 생장] SC: 놓인 자리 높이 dropM 이 없다(${dropM})`);
    return capOf(SCS(), dropM);
  }
  /* 그 그루의 «한 칸» — 다음 마디 사이(m). 그루 없이 부르면 다 큰 줄기 값 */
  const scInternodeM = (p) => { const S = SCS(); return p ? interOf(S, p.nodes + 1) : S.vine.internode_m[S.leaf_ladder[S.leaf_ladder.length - 1]]; };
  const isHighSpot = (dropM) => Number.isFinite(dropM) && dropM >= SCS().vine.high_spot_min_m;
  /* «길게 늘어진 줄기» 길이 — ★ D76(총괄 10-23): 칸 long_vine_m(0.5). 곁줄 끝 = «높은 자리에 놓인 SC 가운데 줄기 ≥ 이것»(core 셈).
     ⚠ 낮은 자리 상한(최대 0.845)보다 짧아 길이만으로는 «높은 자리에서만»이 아니다 — 높은 자리 조건을 같이 본다.
     (옛 정의 D71: 상한(high_spot_min_m) = 1.0 — 길이만으로 높은 자리에서만 닿았으나 반년을 넘겨 줄였다) */
  const longVineM = () => SCS().vine.long_vine_m;
  /* 빛 대역 [lo, hi] = 빛 줄 [best_lo, max] — 숫자 두 벌 없이 light_thresholds.json 을 읽는다 */
  function bandOf(species) { const th = thresholdsFor(TH, specOf(species).light_id); return { lo: th.best_lo, hi: th.max }; }
  /* 그 빛이 그 종에게 어떤 자리인가 — fit(best·good) · slow(lo 밑) · over(hi 위 · CA 는 말림) · dark(min 밑 · 멎음) */
  function spotFit(species, dli) {
    if (!Number.isFinite(dli)) throw new Error(`[종 생장] spotFit: DLI 가 없다(${dli})`);
    const band = judgeDLI(dli, thresholdsFor(TH, specOf(species).light_id)).band;
    return band === 'over' ? 'over' : (band === 'best' || band === 'good') ? 'fit' : band === 'slow' ? 'slow' : 'dark';
  }

  return { newPlant, stepDay, cutAbove, leafRows, summary, assertPlant, thresholdsOf: thOf, avg7, pinkStreak,
    scStemCapM, scInternodeM, isHighSpot, longVineM, bandOf, spotFit,
    species: () => Object.keys(SPEC.species) };
}

/* 브라우저 · 코어용 — 두 정본을 읽어 규칙을 세운다(loop.js 가 growth_tuning 을 읽는 꼴과 같다) */
export async function loadSpeciesRules() {
  const spec = await import('../../data/growth_species.json', { with: { type: 'json' } });
  const th = await import('../../data/balance/light_thresholds.json', { with: { type: 'json' } });
  return createSpeciesRules(spec.default, th.default);
}
