/* ============================================================
   probe_breed_tworoom.mjs — C 판 «무늬 육종»: 품종 칸 다섯 × 철 × 등 수 → 품종(같은 조건 셋)까지 날 수 ([growth] · 2026-10-24 · 총괄 D83)
   ------------------------------------------------------------
   ★ 명세 plan-breed-career-spec §2-3 · §7 · §8 growth 몫. «한 해에 0 인 칸»이 있나(plan 이 칸을 바꾼다)를 보는 표.
   ★ 판: 투룸 배치 B(얼린 프로필 data/profiles/room_profile.tworoom.json · 29자리 · 돌봄 표 growth-care-tworoom 과 같은 방) · real ·
     판 씨앗 SEEDS · 진로 첫날 = 철 첫날 · 등 0~3 · 하루 DLI 는 그 자리 값 그대로.
   ★ 줄마다 «육종하는 손»을 하나씩 정해 따로 돈다 — 줄끼리 자리 다툼은 안 넣는다(셋을 같이 돌리는 것은 core 하네스 §7).
     손이 아는 빛 = 그 자리 지난 7일 평균(돌봄 g7 과 같은 자) — 첫날은 그날 값.
     몬스테라(하프문 · 풀문) — 규칙은 core propagation.js 그대로 읽어 쓴다(값을 여기 안 적는다):
       무늬 마디 삽수 v0 개로 시작(물꽂이 · 잎 1장). 뿌리내리는 12일은 «밝은 빈 자리»에 둔다(옮기지 않음).
       뿌리 낸 날(12일째) 그 자리 «그날 DLI»를 plant_grow bandOf(dli, 무늬)로 → 밝기 셋(varie_grades lightBands) = 그 삽수의 조건.
         ⚠ 무늬라 need_mult 1.4 — 밝음 = 그날 7.0 이상 · 중간 3.78 이상(명세 §3 «avg ≥ 5.0» 아님 · 코드대로).
       다음 날 흙으로 옮겨 남은 자리 가운데 밝은 데 · 그날 «자라는 빛»(3.78 이상)인 날을 20일 모으면 새 잎 하나 →
         무늬 = youngVarieChanceOf(VARIE_LIGHT[밝기]) · 등급 = lightGrade[밝기] (굴림은 이 검사 씨앗 — 분포만 같다).
       잎이 둘 이상이고 맨 위 잎이 무늬면 그 잎 위를 잘라 새 무늬 삽수(물꽂이) — 삽수 수 상한 = min(cap, 맑은 날 «자라는 빛»이 드는 자리 수
         (지난 7일 가운데 가장 밝은 날 ≥ 3.78)) · 어두운 데 둔 삽수는 잎이 안 나고 어두움 조건만 쌓여서. 잘라 낸 잎은 표본이 아니다(이미 적힘).
       ⚠ 진로 첫날 무늬 마디 삽수 수(v0)가 어두운 방(등 0~1)의 답을 가른다 — 손 셋(v0 1 · 3 · cap 16)을 같이 낸다(core 하네스는 실제 판의 수로).
       표본 = 무늬 마디 삽수의 새 잎. 품종 = 같은 밝기에서 «서로 다른 삽수 셋»에 하프문(풀문) 잎.
     알로카시아(마블 · 반달) — growth 규칙(species_growth) 그대로 돈다:
       상점 구근(30,000원 · 배송 2일)을 상한 cap 화분까지 산다 — 아직 품종이 안 된 갈래의 «무늬 어미»(그 갈래 그루 · 그 갈래 어미 구근)가 없을 때만.
       싹이 무지면 판다(자리 비움) · 무늬 어미 구근은 그 갈래가 아직이면 심는다(무지 어미 구근·끝난 갈래 구근은 판다).
       손 둘: force «재우기» — 아직 찾을 수 있는 무늬 그루(찾음 < 평생 2 · 찾은 뒤 잎 ≥ 1)를 가장 어두운 자리(7일 평균 < 그 그루 min)에 두어
                잠들게 해 구근을 찾고, 다시 밝은 데로 · natural — 늘 밝은 데(구근은 겨울잠 · 겨울에 심은 구근의 봄 싹틈 때만).
       평생 두 번 다 찾은 무늬 그루 · 끝난 갈래 그루는 판다. 표본 = 싹틈(origin from_varie_mother · varie = motherKind).
     핑크프린세스(분홍 많음) — growth 규칙 그대로 · 교환으로 받는 그루(core SPECIES_GAME.ppTrade.give.pinks)로 시작 · 가장 밝은 자리 하나:
       새 잎이 분홍 많음이 아니면 «다음 잎이 분홍 많음일 몫»이 가장 큰 잎 위를 자른다(그 잎이 맨 위면 안 자름 · 7일 평균 < best_lo 면 끌림 −0.1 셈).
       품종 = 새 잎 차례로 분홍 많음 셋 잇달아(사이에 다른 등급 없이 — 판정은 core).
     node tools/probe_breed_tworoom.mjs                 (OUT=docs/handoff/growth-breed-tworoom.json 이면 적는다 · SEEDS 기본 12 · DAYS 기본 720)
   ⛔ 값·확률·규칙은 안 건드린다 — 읽어 쓰기만. 손(상한 · v0 · 자르는 법)은 이 검사의 가정이고 meta 에 적는다.
============================================================ */
import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProfileLight } from '../src/game/room_profile.js';
import { seasonOf } from '../src/engine/weather.js';
import { judgeDLI, thresholdsFor } from '../src/engine/daily_light.js';
import { createSpeciesRules } from '../src/growth/species_growth.js';
import { VARIE_LIGHT, youngVarieChanceOf, METHODS, CUTTING_LEAF_DAYS } from '../src/game/propagation.js';
import { SPECIES_GAME } from '../src/game/species.js';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const J = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const TH = J('data/balance/light_thresholds.json'), P = J('data/profiles/room_profile.tworoom.json');
const W = J('data/balance/weather.json'), E = J('data/balance/electricity.json');
const SPEC = J('data/growth_species.json'), R = createSpeciesRules(SPEC, TH);
const VG = J('data/balance/varie_grades.json');
const AL = SPEC.species.alocasia_frydek, PP = SPEC.species.pink_princess;
const SEEDS = Number(process.env.SEEDS || 12), DAYS = Number(process.env.DAYS || 720), YEAR = 360;
const LAMPS = P.lampCounts || [0];
const SLOTS = P.slots.map(s => s.slotId);              // 배치 B (29)
const START = { spring: 0, summer: 90, autumn: 180, winter: 270 };
const OPENS = Object.keys(START);
const mean = a => a.reduce((x, y) => x + y, 0) / (a.length || 1);
const HANDS = {
  monstera: [{ id: 'm1c8', v0: 1, cap: 8, main: true }, { id: 'm3c8', v0: 3, cap: 8 }, { id: 'm1c16', v0: 1, cap: 16 }],
  al: [{ id: 'force', force: true, cap: 6, main: true }, { id: 'natural', force: false, cap: 6 }],
  pp: [{ id: 'trade', main: true }]
};
const SHOP_LEAD = 2;                                   // shop.js al_corm.leadDays

/* ── 몬스테라 무늬 삽수의 밝기 — plant_grow bandOf(dli, varie=true) 와 같은 자(엔진 judgeDLI · ×need_mult) ── */
const TH_MV = thresholdsFor(TH, 'monstera_deliciosa', true);
const NO_GROW = new Set(['critical', 'poor', 'stagnant']);   // loop.js NO_GROW_BANDS
const bandMV = dli => judgeDLI(dli, TH_MV).band;
const stepOf = band => VG.lightBands[band] || null;           // dark | mid | bright
{ /* plant_grow bandOf 거울과 맞대기 — 자가 갈리면 표가 거짓이 된다 */
  const T = TH.plants.monstera_deliciosa, m = TH.variegated.need_mult;
  const pg = dli => dli < T.die * m ? 'critical' : dli < T.survive * m ? 'poor' : dli < T.min * m ? 'stagnant' : dli < T.best_lo * m ? 'slow'
    : dli <= T.best_hi * m ? 'best' : dli <= T.max ? 'good' : 'over';
  for (let x = 0; x <= 20; x += 0.01) if (pg(x) !== bandMV(x)) throw new Error(`[육종] 무늬 몬스테라 밴드가 plant_grow 와 갈린다 dli ${x.toFixed(2)}`);
}
const BRIGHT_MIN = TH_MV.best_lo, GROW_MIN = TH_MV.min;
const ROOT_DAYS = METHODS.water.rootDays;

/* 씨앗 난수 — 분포만 쓴다(게임 굴림과 같은 수를 내려는 것이 아니다) */
function rngOf(seed, salt) {
  let a = (seed * 2654435761 ^ salt * 40503) >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function gradeRoll(step, u) {
  const row = VG.lightGrade[step]; let acc = 0, last = null;
  for (const [g, p] of Object.entries(row)) { last = g; acc += p; if (u < acc) return g; }
  return last;
}

/* 빛 판 — 철 첫날부터 DAYS 일 · 자리마다 DLI · 철 */
function seriesOf(lamps, open, seed) {
  const light = createProfileLight({ ...P, uidStable: true }, { thresholds: TH, weather: W, electricity: E });
  const y0 = START[open] + (seed - 1) * YEAR;
  const per = Object.fromEntries(SLOTS.map(s => [s, []])), season = [];
  for (let d = 1; d <= DAYS; d++) {
    const rep = light.daily(d, { sim: { mode: 'real', yearDay0: y0 - 1, seed }, lamps: { count: lamps, litHours: 12 }, pots: [], placedItems: [] }).report;
    for (const s of rep.slots || []) if (per[s.slotId]) per[s.slotId].push(s.dli);
    season.push(seasonOf(y0 - 1 + d));
  }
  for (const s of SLOTS) if (per[s].length !== DAYS) throw new Error(`[육종] 자리 ${s} 빛이 ${per[s].length}일뿐`);
  return { dli: per, season };
}
/* 손이 아는 빛 — 그 자리 지난 7일 평균(첫날은 그날) */
const knowOf = (ser, d) => {
  const out = {};
  for (const s of SLOTS) { const a = ser.dli[s]; out[s] = d <= 1 ? a[0] : mean(a.slice(Math.max(0, d - 8), d - 1)); }
  return out;
};

/* ── 몬스테라 ─────────────────────────────── */
function runMonstera(ser, seed, hand) {
  const rnd = rngOf(seed, 11 + hand.v0 * 7 + hand.cap);
  const cs = []; let nid = 0;
  const newJar = () => ({ id: ++nid, st: 'jar', slot: null, days: 0, step: null, leaves: [true], grow: 0 });
  for (let i = 0; i < hand.v0; i++) cs.push(newJar());
  const hm = { dark: new Set(), mid: new Set(), bright: new Set() }, fm = { dark: new Set(), mid: new Set(), bright: new Set() };
  let hmDay = null, fmDay = null;
  const roots = { dark: 0, mid: 0, bright: 0 }; let leaves = 0, cuts = 0;
  for (let d = 1; d <= DAYS && (hmDay == null || fmDay == null); d++) {
    const kn = knowOf(ser, d), byBright = [...SLOTS].sort((a, b) => kn[b] - kn[a]);
    /* 삽수 수 — 맑은 날 «자라는 빛»이 드는 자리(지난 7일 가운데 가장 밝은 날 ≥ 3.78) 수까지만 늘린다(어두운 데 둔 삽수는 잎이 안 나고 어두움 조건만 쌓인다) */
    const good = SLOTS.filter(s => Math.max(...ser.dli[s].slice(Math.max(0, d - 8), Math.max(1, d - 1))) >= GROW_MIN).length;
    const limit = Math.min(hand.cap, good);
    /* 자리 — 물꽂이는 한 번 놓으면 12일 그대로 · 새 물꽂이가 밝은 빈 자리를 먼저 · 흙 삽수는 남은 밝은 데(날마다 다시) */
    const taken = new Set(cs.filter(c => c.st === 'jar' && c.slot).map(c => c.slot));
    for (const c of cs) if (c.st === 'jar' && !c.slot) { const s = byBright.find(x => !taken.has(x)); if (s) { c.slot = s; taken.add(s); } }
    for (const c of cs) if (c.st === 'est') { c.slot = byBright.find(x => !taken.has(x)) || null; if (c.slot) taken.add(c.slot); }
    const born = [];
    for (const c of cs) {
      if (!c.slot) continue;
      const dli = ser.dli[c.slot][d - 1];
      if (c.st === 'jar') {
        c.days += 1;
        if (c.days >= ROOT_DAYS) { c.step = stepOf(bandMV(dli)); roots[c.step]++; c.st = 'rooted'; }   // 뿌리 낸 날 그날 빛
        continue;
      }
      if (c.st === 'rooted') { c.st = 'est'; continue; }    // 그날 흙으로 — 잎은 다음 날부터
      if (NO_GROW.has(bandMV(dli))) continue;
      c.grow += 1;
      while (c.grow >= CUTTING_LEAF_DAYS) {
        c.grow -= CUTTING_LEAF_DAYS; leaves++;
        const varie = rnd() < youngVarieChanceOf(VARIE_LIGHT[c.step]);
        const g = varie ? gradeRoll(c.step, rnd()) : null;
        c.leaves.push(varie);
        if (g === 'halfmoon') hm[c.step].add(c.id);
        if (g === 'fullmoon') fm[c.step].add(c.id);
        if (hmDay == null && hm[c.step].size >= 3) hmDay = d;
        if (fmDay == null && fm[c.step].size >= 3) fmDay = d;
        if (c.leaves.length >= 2 && c.leaves[c.leaves.length - 1] && cs.length + born.length < limit) {
          c.leaves.pop(); born.push(newJar()); cuts++;   // 맨 위 무늬 잎 위를 자름 → 물꽂이(잎 1장)
        }
      }
    }
    cs.push(...born);
  }
  return { halfmoon: hmDay, fullmoon: fmDay, roots, leaves, cuts, cuttings: cs.length };
}

/* ── 알로카시아 ─────────────────────────────── */
const KINDS = Object.keys(AL.varie_kinds).filter(k => !k.startsWith('_'));
const AL_MAX_FINDS = AL.propagation.max_finds_lifetime, AL_MIN_SINCE = AL.propagation.min_leaves_since_find;
function runAL(ser, seed, hand) {
  const pots = [];            // { p, slot }
  const bag = [];             // 찾은 구근 { seed, origin, motherKind }
  const orders = [];          // 상점 구근 도착 날
  const n = Object.fromEntries(KINDS.map(k => [k, 0])), day = Object.fromEntries(KINDS.map(k => [k, null]));
  let bought = 0, seq = 0, sold = 0;
  const thMin = p => R.thresholdsOf(p).min;
  const done = k => day[k] != null;
  const sourceOf = k => pots.some(q => (q.p.varie === k && q.p.finds < AL_MAX_FINDS) || (q.p.phase === 'corm' && q.p.origin === 'from_varie_mother' && q.p.motherKind === k))
    || bag.some(c => c.origin === 'from_varie_mother' && c.motherKind === k);
  const useful = c => c.origin === 'from_varie_mother' && KINDS.includes(c.motherKind) && !done(c.motherKind);
  const wantForce = q => hand.force && q.p.varie && !done(q.p.varie) && q.p.finds < AL_MAX_FINDS && q.p.sinceFind >= AL_MIN_SINCE
    && (q.p.phase === 'growing' || q.p.phase === 'dropping');
  for (let d = 1; d <= DAYS && KINDS.some(k => !done(k)); d++) {
    const season = ser.season[d - 1];
    /* 아침 손 — 쓸모 없는 그루를 판다 · 구근을 심는다 · 상점 구근을 산다 */
    for (let i = pots.length - 1; i >= 0; i--) {
      const p = pots[i].p;
      if (p.phase === 'corm') continue;
      const useless = !p.varie || done(p.varie) || (p.finds >= AL_MAX_FINDS && p.phase !== 'corm');
      if (useless) { pots.splice(i, 1); sold++; }
    }
    for (let i = bag.length - 1; i >= 0; i--) if (!useful(bag[i])) { bag.splice(i, 1); sold++; }
    while (bag.length && pots.length < hand.cap) { const c = bag.shift(); pots.push({ p: R.newPlant('alocasia_frydek', { seed: c.seed, origin: c.origin, motherKind: c.motherKind }), slot: null }); }
    for (let i = orders.length - 1; i >= 0; i--) if (orders[i] <= d) {
      orders.splice(i, 1);
      if (pots.length < hand.cap) pots.push({ p: R.newPlant('alocasia_frydek', { seed: (seed * 7919 + (++seq) * 104729) >>> 0, origin: 'shop' }), slot: null });
      else sold++;            // 자리가 없으면 되판다(드묾)
    }
    if (KINDS.some(k => !done(k) && !sourceOf(k))) {
      const room = hand.cap - pots.length - orders.length - bag.length;
      for (let i = 0; i < room; i++) { orders.push(d + SHOP_LEAD); bought++; }
    }
    /* 자리 — 재울 그루는 가장 어두운 데(7일 평균 < 그 그루 min 일 때만) · 잎 그루는 밝은 데 · 구근은 남은 어두운 데 */
    const kn = knowOf(ser, d), byBright = [...SLOTS].sort((a, b) => kn[b] - kn[a]), byDark = [...byBright].reverse();
    const taken = new Set();
    for (const q of pots) q.slot = null;
    for (const q of pots) if (wantForce(q)) { const s = byDark.find(x => !taken.has(x) && kn[x] < thMin(q.p)); if (s) { q.slot = s; taken.add(s); } }
    for (const q of pots) if (!q.slot && q.p.phase !== 'corm') { const s = byBright.find(x => !taken.has(x)); if (s) { q.slot = s; taken.add(s); } }
    for (const q of pots) if (!q.slot) { const s = byDark.find(x => !taken.has(x)); if (s) { q.slot = s; taken.add(s); } }
    for (const q of pots) {
      const ev = R.stepDay(q.p, { dli: ser.dli[q.slot][d - 1], season });
      for (const e of ev) {
        if (e.type === 'sprout' && e.origin === 'from_varie_mother' && e.varie && e.varie === e.motherKind) {
          n[e.varie]++; if (day[e.varie] == null && n[e.varie] >= 3) day[e.varie] = d;
        }
        if ((e.type === 'sprout' || e.type === 'asleep') && e.corms) bag.push(...e.corms);
      }
    }
  }
  return { marble: day.marble, sector: day.sector, bought, sold };
}

/* ── 핑크프린세스 ─────────────────────────────── */
const PK = PP.pink;
const heavyOdds = (x, drift) => { const lo = x + drift - PK.jitter, hi = x + drift + PK.jitter;
  return x <= PK.green_max ? 0 : Math.max(0, Math.min(hi, PK.pink_leaf_min) - Math.max(lo, PK.heavy_min)) / (hi - lo); };
function runPP(ser, seed) {
  const p = R.newPlant('pink_princess', { seed: 5000 + seed, pinks: [...SPECIES_GAME.ppTrade.give.pinks] });
  const bestLo = R.thresholdsOf(p).best_lo;
  let run = 0, at = null, cuts = 0, leaves = 0; const hist = [];
  for (let d = 1; d <= DAYS && at == null; d++) {
    const kn = knowOf(ser, d), slot = [...SLOTS].sort((a, b) => kn[b] - kn[a])[0];
    const dli = ser.dli[slot][d - 1]; hist.push(dli);
    const ev = R.stepDay(p, { dli, season: ser.season[d - 1] });
    for (const e of ev) {
      if (e.type !== 'leaf') continue;
      leaves++;
      run = e.grade === 'heavy' ? run + 1 : 0;
      if (run >= 3) { at = d; break; }
      if (e.grade === 'heavy') continue;
      const drift = mean(hist.slice(-7)) < bestLo ? PK.drift_low_light : 0;
      let best = null;
      for (const L of p.leaves) { const o = heavyOdds(L.pink, drift); if (!best || o > best.o + 1e-9) best = { L, o }; }
      const top = p.leaves[p.leaves.length - 1];
      if (best && best.L !== top) { R.cutAbove(p, best.L.no); cuts++; }
    }
  }
  return { heavy: at, cuts, leaves };
}

/* ── 돌린다 ─────────────────────────────── */
const SLOT_IDS = ['monstera_halfmoon', 'monstera_fullmoon', 'al_marble', 'al_sector', 'pp_heavy'];
const out = {}; for (const id of SLOT_IDS) out[id] = {};
const aux = { brightRootSlots: {}, monRoots: {}, alBought: {}, ppCuts: {} };
const summ = days => {
  const ok = days.filter(x => x != null).sort((a, b) => a - b), all = days.map(x => x == null ? Infinity : x).sort((a, b) => a - b);
  const med = all[Math.floor((all.length - 1) / 2)];
  return { inYear: +(days.filter(x => x != null && x <= YEAR).length / days.length).toFixed(2), median: Number.isFinite(med) ? med : null,
    fastest: ok.length ? ok[0] : null, reached: ok.length, days };
};
for (const open of OPENS) for (const lamps of LAMPS) {
  const acc = {};
  const push = (slot, hand, v) => { ((acc[slot] ||= {})[hand] ||= []).push(v); };
  const brightCnt = [], bought = { force: [], natural: [] }, ppc = [], roots = {};
  for (let seed = 1; seed <= SEEDS; seed++) {
    const ser = seriesOf(lamps, open, seed);
    /* 밝은 뿌리 자리 — 첫 90일 가운데 반 넘게 그날 7.0 이상인 자리 수 */
    brightCnt.push(SLOTS.filter(s => ser.dli[s].slice(0, 90).filter(x => x >= BRIGHT_MIN).length >= 45).length);
    for (const h of HANDS.monstera) { const r = runMonstera(ser, seed, h); push('monstera_halfmoon', h.id, r.halfmoon); push('monstera_fullmoon', h.id, r.fullmoon);
      const t = (roots[h.id] ||= { dark: 0, mid: 0, bright: 0 }); for (const k in t) t[k] += r.roots[k]; }
    for (const h of HANDS.al) { const r = runAL(ser, seed, h); push('al_marble', h.id, r.marble); push('al_sector', h.id, r.sector); bought[h.id].push(r.bought); }
    const r = runPP(ser, seed); push('pp_heavy', 'trade', r.heavy); ppc.push(r.cuts);
  }
  for (const id of SLOT_IDS) { (out[id][open] ||= {})[lamps] = Object.fromEntries(Object.entries(acc[id]).map(([h, v]) => [h, summ(v)])); }
  (aux.brightRootSlots[open] ||= {})[lamps] = { median: brightCnt.sort((a, b) => a - b)[Math.floor((brightCnt.length - 1) / 2)], min: Math.min(...brightCnt) };
  (aux.alBought[open] ||= {})[lamps] = Object.fromEntries(Object.entries(bought).map(([h, v]) => [h, v.sort((a, b) => a - b)[Math.floor((v.length - 1) / 2)]]));
  (aux.ppCuts[open] ||= {})[lamps] = ppc.sort((a, b) => a - b)[Math.floor((ppc.length - 1) / 2)];
  (aux.monRoots[open] ||= {})[lamps] = Object.fromEntries(Object.entries(roots).map(([h, t]) => { const n = t.dark + t.mid + t.bright || 1;
    return [h, { n, dark: +(t.dark / n).toFixed(2), mid: +(t.mid / n).toFixed(2), bright: +(t.bright / n).toFixed(2) }]; }));
}

const mainOf = id => (HANDS[id.split('_')[0]] || []).find(h => h.main).id;
console.log(`══ 품종 칸 다섯 × 철 × 등 — 투룸 배치 B ${SLOTS.length}자리 · real · 판 씨앗 ${SEEDS} · ${DAYS}일까지 · 진로 첫날 = 철 첫날`);
console.log(`   칸 = 품종까지 날 수 중앙값(판의 반 넘게 못 닿으면 '—') [한 해(${YEAR}일) 안에 닿은 판 몫]`);
for (const id of SLOT_IDS) {
  const hs = Object.keys(out[id].spring[LAMPS[0]]);
  for (const h of hs) {
    console.log(`\n   ${id} · 손 ${h}${h === mainOf(id) ? ' (주)' : ''}`);
    for (const open of OPENS) console.log(`      ${open.padEnd(7)} ` + LAMPS.map(l => { const c = out[id][open][l][h];
      return `등${l} ${String(c.median ?? '—').padStart(4)}[${c.inYear.toFixed(2)}]`; }).join('  '));
  }
}
console.log('\n   밝은 뿌리 자리(첫 90일 반 넘게 그날 ≥ ' + BRIGHT_MIN.toFixed(1) + ') 중앙/최소: ' + OPENS.map(o => `${o} ` + LAMPS.map(l => `${aux.brightRootSlots[o][l].median}/${aux.brightRootSlots[o][l].min}`).join(' ')).join(' · '));
console.log('   몬스테라 뿌리 밝기 몫(m3c8 · 어두움/중간/밝음): ' + OPENS.map(o => `${o} ` + LAMPS.map(l => { const r = aux.monRoots[o][l].m3c8; return `${r.dark}/${r.mid}/${r.bright}`; }).join(' ')).join(' · '));
console.log('   AL 산 상점 구근 중앙(force/natural): ' + OPENS.map(o => `${o} ` + LAMPS.map(l => `${aux.alBought[o][l].force}/${aux.alBought[o][l].natural}`).join(' ')).join(' · '));
const zero = [], thin = [];
for (const id of SLOT_IDS) { const h = mainOf(id); for (const open of OPENS) for (const l of LAMPS) { const c = out[id][open][l][h];
  if (c.inYear === 0) zero.push(`${id} · ${open} · 등${l}`); else if (c.inYear < 0.5) thin.push(`${id} · ${open} · 등${l} ${c.inYear}`); } }
console.log(`\n⇒ 주 손으로 한 해 안에 한 판도 못 닿는 칸 ${zero.length}: ${zero.join(' / ') || '없음'}`);
console.log(`⇒ 한 해 안에 판의 반도 못 닿는 칸 ${thin.length}: ${thin.join(' / ') || '없음'}`);
/* 손을 다 바꿔도 0 — 손 탓이 아니라 방(빛) 탓인 칸 */
const zeroAll = [];
for (const id of SLOT_IDS) for (const open of OPENS) for (const l of LAMPS) { const hs = out[id][open][l];
  if (Object.values(hs).every(c => c.inYear === 0)) zeroAll.push(`${id} · ${open} · 등${l}`); }
console.log(`⇒ 손 ${'셋/둘'}을 다 써도 한 해 안에 0 인 칸 ${zeroAll.length}: ${zeroAll.join(' / ') || '없음'}`);
if (process.env.OUT) fs.writeFileSync(path.join(ROOT, process.env.OUT), JSON.stringify({ meta: { from: 'tools/probe_breed_tworoom.mjs', decision: '총괄 D83 ③ · plan-breed-career-spec §7 · §8',
  profile: 'data/profiles/room_profile.tworoom.json', roomRev: P.roomRev || null, slots: SLOTS.length, seeds: SEEDS, days: DAYS, year: YEAR, lampCounts: LAMPS, starts: START,
  monsteraBand: { rule: '뿌리 낸 날 그날 DLI · plant_grow bandOf(dli, 무늬) · varie_grades lightBands', brightMin: BRIGHT_MIN, growMin: +GROW_MIN.toFixed(2), rootDays: ROOT_DAYS, leafDays: CUTTING_LEAF_DAYS,
    leafVarie: Object.fromEntries(Object.entries(VARIE_LIGHT).map(([k, v]) => [k, youngVarieChanceOf(v)])), lightGrade: VG.lightGrade },
  hands: HANDS, handsKo: {
    monstera: '무늬 마디 삽수 v0 개 → 밝은 빈 자리에서 12일 물꽂이(안 옮김) · 다음 날 흙 · 남은 밝은 데 · 잎 둘 이상에 맨 위 무늬면 잘라 새 물꽂이(삽수 수 ≤ cap)',
    al: '상점 구근을 상한(cap 화분)까지 — 끝 안 난 갈래의 무늬 어미가 없을 때만 · 무지 싹·끝난 갈래·두 번 찾은 그루는 팜 · force = 어두운 자리로 재워 구근 찾기 · natural = 늘 밝은 데',
    pp: '교환 그루(잎 둘) · 가장 밝은 자리 · 새 잎이 분홍 많음이 아니면 «다음 잎 분홍 많음 몫»이 가장 큰 잎 위를 자름' },
  note: '줄마다 방을 혼자 쓴다(줄끼리 자리 다툼 없음 · 셋을 같이 돌리는 것은 core 하네스 §7) · 굴림은 이 검사 씨앗(분포만 같다)' },
  table: out, aux, zeroInYear: zero, zeroInYearAllHands: zeroAll, underHalfInYear: thin }, null, 1));
