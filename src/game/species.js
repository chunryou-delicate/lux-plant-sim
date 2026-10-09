/* src/game/species.js — **새 식물 두 종을 «판»에 잇는다** (core · 2026-10-09 · 총괄 D45 · plan-newspecies-20261009 §D45 · growth 5a70b9c2)
   ------------------------------------------------------------------
   핑크프린세스(PP · «가위») · 알로카시아 프라이덱(AL · «철»). 몬스테라(«자리»)와 다른 배움이다.
   ★ 생장 규칙은 여기 없다 — growth 의 src/growth/species_growth.js(그루 상태 · 하루 · 자르기 · 그림 줄)가 정본이다.
     여기는 «판»이다: 그루가 어디 있나(방 자리 · 가방) · 언제 만나나(PP 교환 · AL 상점 구근) · 그날 사건 · 값 · 세이브 · 스냅샷.
   ★ 몬스테라 길(S.pots · io.growth · plant_grow)과 «칸이 갈린다» — 두 종은 S.species 에만 산다. 몬스테라 화분 코드가 이 그루를
     몬스테라로 읽을 일이 없게(«모르면 몬스테라» 밑값이 화면 곳곳에 있었다 · game.html §kindAt 주석).

   상태(S.species · 세이브에 그대로)
     pots[]   { id:'sp_01', species, plant(growth 그루 상태 · schema species/1), slotId, at, placedOnce, gotDay, origin }
              origin 'trade'(교환) · 'shop'(상점) · 'corm'(구근을 심음) · 'cut'(PP 잘라 낸 윗부분)
              자리(slotId·at)가 없으면 가방이다 — 가방 속 그루는 하루가 안 간다(몬스테라 삽수 D29 와 같은 규약)
     corms[]  { id:'cm_01', seed, origin, motherKind, foundDay } — 흙에서 «찾은» 구근(가방). 심으면 pots 로 간다
     trade    { asks, declined, done, pendingDay, lastAskDay, doneDay } — PP 교환
     n        { ppPinkHoldCuts, alWokeCount, alCormsFound, alFoundCormsPlanted } — 곁줄 셋(quest SPECIES_QUESTS)이 읽는 수
   사건(turn.events · 대사는 plan dialogue.js — 이름은 plan 표 그대로)
     pp_trade_offer{again} · pp_trade_done · pp_trade_declined{last} · pp_pink_warn · pp_tip_withered{count} · pp_reverted
     al_sprout{varie,slept} · al_asleep{corms} · al_wake{first}
   ⚖ 값 · 때 — 총괄 D45 첫 판과 plan 추천 그대로(아래 SPECIES_GAME). core 가 새로 정한 것은 «⚖ core» 로 적었다(총괄께 몰아서 보고). */
import { createSpeciesRules } from '../growth/species_growth.js';

let RULES = null, RULES_ERR = null;
try {
  const spec = await import('../../data/growth_species.json', { with: { type: 'json' } });
  const th = await import('../../data/balance/light_thresholds.json', { with: { type: 'json' } });
  RULES = createSpeciesRules(spec.default, th.default);
} catch (e) { RULES_ERR = e; }
/* 규칙 — 못 세웠으면 «두 종이 없는 판»으로 돈다(몬스테라 판은 그대로). 부르는 쪽이 speciesReady() 로 묻는다 */
export function speciesRules() {
  if (!RULES) throw new Error('[종] 새 식물 규칙을 못 세웠습니다 — ' + ((RULES_ERR && RULES_ERR.message) || '모름'));
  return RULES;
}
export const speciesReady = () => !!RULES;
export function installSpeciesRules(R) { RULES = R || null; }   /* 검사가 규칙을 갈아 끼울 때 */

export const SPECIES_IDS = Object.freeze(['pink_princess', 'alocasia_frydek']);
export const SPECIES_KO = Object.freeze({ pink_princess: '핑크프린세스', alocasia_frydek: '알로카시아' });

export const SPECIES_GAME = Object.freeze({
  /* PP 교환(plan ①㉡ · §④): ③ «한 그루가 둘이 된다»(oneroom_settle_cutting) 끝 + 원룸 30일 뒤.
     내줄 것 = 뿌리낸 무늬 몬스테라 삽수 하나. 거절하면 againDays 뒤 한 번 더(⚖ core 21일) · 두 번 거절이면 상점에 진열(plan). */
  ppTrade: Object.freeze({ afterMoveDays: 30, afterQuest: 'oneroom_settle_cutting', againDays: 21, maxAsks: 2,
                           /* 받는 그루 — 잎 둘 · 분홍 마블(⚖ core: growth 기본 start 0.35 둘레) */
                           give: Object.freeze({ pinks: Object.freeze([0.32, 0.42]) }) }),
  /* AL 상점 구근(plan ①㉠ · §④): 원룸 60일 뒤 진열 */
  alShop: Object.freeze({ afterMoveDays: 60 }),
  /* PP 경고(총괄: 분홍 잎 2장째에 경고 · 3장이면 시듦 — 시듦 수는 growth wither_streak) · 되돌아감(⚖ core: 초록 잎 2장 연달아) */
  ppPinkWarnStreak: 2,
  ppRevertedStreak: 2,
  /* 잎 한 장 값(총괄 D45 첫 판 · ⚖ «같은 돈, 다른 길» 10% 선으로 core 판이 바로잡는다) — 낱말은 몬스테라와 같이(산반·하프문) · PP 는 «분홍 잎» */
  leafWon: Object.freeze({
    pink_princess:   Object.freeze({ green: 20_000, marble: 250_000, heavy: 550_000, pink: 100_000 }),
    alocasia_frydek: Object.freeze({ plain: 20_000, marble: 300_000, sector: 650_000 })
  }),
  gradeKo: Object.freeze({
    pink_princess:   Object.freeze({ green: '무지', marble: '산반', heavy: '하프문', pink: '분홍 잎' }),
    alocasia_frydek: Object.freeze({ plain: '무지', marble: '산반', sector: '하프문' })
  }),
  /* 그루째 팔면 ×1.4 · 막 잘라 안 심은 PP 윗부분은 ×1.0 — 몬스테라 varie_grades sale(potMult · cuttingMult)과 같은 결(⚖ core) */
  potMult: 1.4, cuttingMult: 1.0,
  /* 그릇 지름(방 그림) — 검은 모종포트보다 한 치수 큰 화분(⚖ core · 그림만) */
  potD: 0.18
});

const SG = SPECIES_GAME;
const isSp = id => SPECIES_IDS.includes(id);

export function createSpeciesState() {
  return { pots: [], corms: [],
           trade: { asks: 0, declined: 0, done: false, pendingDay: null, lastAskDay: null, doneDay: null },
           n: { ppPinkHoldCuts: 0, alWokeCount: 0, alCormsFound: 0, alFoundCormsPlanted: 0 },
           seq: 0 };
}
/* 없으면 만든다(옛 세이브가 이 칸 없이 열린다) */
export function speciesOf(S) {
  if (!S) throw new TypeError('[종] 상태가 없습니다');
  if (!S.species || typeof S.species !== 'object') S.species = createSpeciesState();
  const sp = S.species;
  if (!Array.isArray(sp.pots)) sp.pots = [];
  if (!Array.isArray(sp.corms)) sp.corms = [];
  if (!sp.trade) sp.trade = createSpeciesState().trade;
  if (!sp.n) sp.n = createSpeciesState().n;
  if (!Number.isInteger(sp.seq)) sp.seq = 0;
  return sp;
}
const nextId = (S, pre) => { const sp = speciesOf(S); sp.seq += 1; return `${pre}_${String(sp.seq).padStart(2, '0')}`; };
/* 그루마다 다른 씨앗 — 판 씨앗과 순번에서(세이브마다 같은 답) */
function seedFor(S, salt) {
  let h = ((S && S.sim && S.sim.seed) >>> 0) ^ 0x51ed270b;
  for (const ch of String(salt)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h >>> 0;
}

export const speciesPotsOf = S => (S && S.species && Array.isArray(S.species.pots)) ? S.species.pots : [];
export const speciesPlaced = q => !!(q && (q.slotId || q.at));
export function speciesPotOf(S, id) { return speciesPotsOf(S).find(q => q && q.id === id) || null; }

/* ── 그루를 들인다(가방으로) ─────────────────────────────── */
export function addSpeciesPot(S, species, opt = {}) {
  if (!isSp(species)) throw new Error(`[종] 모르는 종입니다: ${species}`);
  const R = speciesRules();
  const id = opt.id || nextId(S, 'sp');
  const plant = opt.plant || R.newPlant(species, { seed: seedFor(S, id), ...(opt.newPlant || {}) });
  const q = { id, species, plant, slotId: null, at: null, placedOnce: false, gotDay: S.day ?? 0, origin: opt.origin || 'shop' };
  speciesOf(S).pots.push(q);
  return q;
}

/* ── 자리 ─────────────────────────────── 화분·삽수와 같은 불변식(place.resolvePlacement)을 부르는 쪽이 넘긴다 */
export function setSpeciesAt(S, id, spot) {
  const q = speciesPotOf(S, id);
  if (!q) throw new Error(`[종] 모르는 그루: ${id}`);
  q.slotId = spot ? (spot.slotId || null) : null;
  q.at = spot ? (spot.at || null) : null;
  if (spot) q.placedOnce = true;
  return q;
}
/* 가방으로(회수) — 자라기가 멎는다 */
export function bagSpecies(S, id) { return setSpeciesAt(S, id, null); }

/* ── 하루 ─────────────────────────────── loop.nextDay 가 부른다(삽수 바로 뒤)
   opt.lightOf(q) → 그날 DLI(못 재면 null — 그날은 안 간다) · opt.season · opt.day
   반환 { events, alDormantNow, stepped } */
export function stepSpecies(S, opt = {}) {
  const out = { events: [], alDormantNow: false, stepped: 0 };
  if (!RULES || !S) return out;
  const R = RULES, sp = speciesOf(S), day = Number.isFinite(opt.day) ? opt.day : S.day;
  for (const q of sp.pots) {
    if (!q || !speciesPlaced(q)) continue;                   /* 가방 속 그루는 하루가 안 간다 */
    if (q.plant && q.plant.viable === false) continue;       /* 분홍 잎만 간 PP 윗부분(growth cutAbove viable:false)은 살지 못한다 — 안 자란다 */
    let dli = null;
    try { dli = typeof opt.lightOf === 'function' ? opt.lightOf(q) : null; } catch { dli = null; }
    if (!Number.isFinite(dli)) continue;
    let ev = [];
    try { ev = R.stepDay(q.plant, { dli, season: opt.season }); } catch (e) { out.events.push({ id: 'species_error', ko: e.message, potId: q.id }); continue; }
    out.stepped += 1;
    for (const e of ev) mapEvent(S, q, e, out.events, day);
  }
  out.alDormantNow = sp.pots.some(q => q && q.species === 'alocasia_frydek' && speciesPlaced(q) && q.plant && q.plant.phase === 'asleep');
  /* PP 교환 — 물음은 하루 결산에서 «난다»(대답은 화면 · answerPPTrade) */
  const t = ppTradeStep(S, { day, doneIds: opt.doneIds });
  if (t) out.events.push(t);
  return out;
}

function mapEvent(S, q, e, list, day) {
  const sp = speciesOf(S), ko = SPECIES_KO[q.species];
  if (q.species === 'pink_princess') {
    if (e.type === 'leaf') {
      const R = RULES, streak = R.pinkStreak(q.plant);
      if (e.grade === 'pink' && streak === SG.ppPinkWarnStreak)
        list.push({ id: 'pp_pink_warn', ko: `${ko} 새 잎이 또 분홍 잎입니다 — 한 장 더 이어지면 줄기 끝이 시듭니다`, potId: q.id, streak });
      if (e.grade === 'green' && greenStreak(q.plant) === SG.ppRevertedStreak)
        list.push({ id: 'pp_reverted', ko: `${ko} 새 잎이 초록으로 이어집니다 — 빛이 모자라면 분홍이 빠집니다`, potId: q.id });
    } else if (e.type === 'tip_withered')
      list.push({ id: 'pp_tip_withered', ko: `${ko} 줄기 끝이 시들었습니다 — 분홍 잎 ${e.count}장이 졌습니다`, potId: q.id, count: e.count });
    return;
  }
  /* AL */
  if (e.type === 'sprout') {
    list.push({ id: 'al_sprout', ko: `${ko} 구근에서 싹이 났습니다`, potId: q.id, varie: !!e.varie, slept: !!e.slept });
    if (Array.isArray(e.corms) && e.corms.length) takeCorms(S, e.corms, day);
  } else if (e.type === 'asleep') {
    const n = Array.isArray(e.corms) ? e.corms.length : 0;
    if (n) takeCorms(S, e.corms, day);
    list.push({ id: 'al_asleep', ko: n ? `${ko} 잎이 다 졌습니다 — 흙 속에서 구근 ${n}알을 찾았습니다` : `${ko} 잎이 다 졌습니다 — 자는 중입니다`, potId: q.id, corms: n });
  } else if (e.type === 'wake') {
    sp.n.alWokeCount += 1;
    list.push({ id: 'al_wake', ko: `${ko} 다시 깼습니다`, potId: q.id, first: sp.n.alWokeCount === 1 });
  }
}
function greenStreak(p) {
  let n = 0;
  for (let i = p.leaves.length - 1; i >= 0 && p.leaves[i].pink != null && p.leaves[i].pink <= 0.05 + 1e-9; i--) n++;   /* green_max(0.05) — growth 표 값 */
  return n;
}
function takeCorms(S, corms, day) {
  const sp = speciesOf(S);
  for (const c of corms) sp.corms.push({ id: nextId(S, 'cm'), seed: c.seed >>> 0, origin: c.origin, motherKind: c.motherKind ?? null, foundDay: day });
  sp.n.alCormsFound += corms.length;
}

/* ── AL 구근을 심는다 ─────────────────────────────── 찾은 구근(cormId) 또는 상점 구근(재고 · origin 'shop')
   반환 새 그루(가방 · 놓기는 부르는 쪽) */
export function plantCorm(S, cormId) {
  const sp = speciesOf(S), R = speciesRules();
  const i = sp.corms.findIndex(c => c && c.id === cormId);
  if (i < 0) throw new Error(`[종] 모르는 구근: ${cormId}`);
  const c = sp.corms[i];
  const plant = R.newPlant('alocasia_frydek', { seed: c.seed, origin: c.origin, motherKind: c.motherKind });
  sp.corms.splice(i, 1);
  sp.n.alFoundCormsPlanted += 1;           /* «찾은» 구근만 센다(곁줄 al_plant_corm · 상점 구근은 안 침) */
  return addSpeciesPot(S, 'alocasia_frydek', { plant, origin: 'corm' });
}

/* ── PP 자르기 ─────────────────────────────── 마디 nodeNo «바로 위»를 자른다(growth cutAbove)
   잘린 윗부분은 새 그루(가방 · origin 'cut'). 산반·하프문 잎이 난 마디에서 자르면 곁줄 «분홍을 붙잡는다»를 센다(분홍 잎 마디는 안 침) */
export function cutSpecies(S, potId, nodeNo) {
  const q = speciesPotOf(S, potId);
  if (!q || q.species !== 'pink_princess') throw new Error('[종] 핑크프린세스만 자릅니다');
  const R = speciesRules();
  const leaf = q.plant.leaves.find(l => l && l.no === nodeNo) || null;
  const grade = leaf ? R.leafRows(q.plant).find(r => r.no === nodeNo).grade : null;
  const r = R.cutAbove(q.plant, nodeNo);   /* 못 자르면 growth 가 제 말로 던진다 — 아무것도 안 바뀐다 */
  if (grade === 'marble' || grade === 'heavy') speciesOf(S).n.ppPinkHoldCuts += 1;
  const top = addSpeciesPot(S, 'pink_princess', { plant: r.cutting, origin: 'cut' });
  return { cutting: top, saved: r.saved, grade };
}
/* 자를 수 있는 마디(잎이 난 마디 · 모주에 잎이 남고 윗부분에 잎이 한 장은 간다) — 화면 목록용 */
export function ppCuttableNodes(q) {
  if (!q || q.species !== 'pink_princess' || !RULES) return [];
  const rows = RULES.leafRows(q.plant);
  return rows.slice(0, -1).map((r, i) => ({ no: r.no, grade: r.grade, gradeKo: SG.gradeKo.pink_princess[r.grade] || r.grade,
                                           keep: i + 1, take: rows.length - i - 1 })).filter(n => n.keep >= 1 && n.take >= 1);
}

/* ── 값 ─────────────────────────────── 잎 한 장 값의 합 × 갈래(그루째 1.4 · 막 자른 윗부분 1.0)
   잎이 없으면(구근 · 잠) 0 — 팔 수 없다(«자는 거야» · 버리게 두지 않는다 · ⚖ core) */
export function speciesPriceOf(q) {
  if (!q || !RULES) return { won: 0, leaves: 0, byGrade: {}, form: null };
  const rows = RULES.leafRows(q.plant);
  const table = SG.leafWon[q.species] || {};
  const byGrade = {};
  let sum = 0;
  for (const r of rows) { sum += table[r.grade] || 0; byGrade[r.grade] = (byGrade[r.grade] || 0) + 1; }
  const form = (q.origin === 'cut' && !q.placedOnce) ? 'cutting' : 'pot';
  const won = Math.round(sum * (form === 'pot' ? SG.potMult : SG.cuttingMult));
  return { won, leaves: rows.length, byGrade, form };
}
export function speciesSellBlockedReason(q) {
  if (!q) return '모르는 그루입니다';
  const n = q.plant && Array.isArray(q.plant.leaves) ? q.plant.leaves.length : 0;
  if (!n && q.species === 'alocasia_frydek')
    return q.plant && q.plant.phase === 'corm' ? '아직 싹이 안 났습니다 — 싹이 나면 팔 수 있습니다'
         : '잎이 다 진 알로카시아는 값을 못 받습니다 — 죽은 게 아니라 자는 중입니다';
  if (!n) return '잎이 없어 값을 못 받습니다';
  return null;
}
/* 판다 — 돈은 부르는 쪽이 shop §creditSpeciesSale 로 넣는다(값 · 갈래 통은 shop 한 곳) · 여기는 목록에서 뺀다 */
export function takeSpeciesForSale(S, id) {
  const q = speciesPotOf(S, id);
  const why = speciesSellBlockedReason(q);
  if (why) { const e = new Error(why); e.tutorialInput = true; throw e; }
  const price = speciesPriceOf(q);
  const sp = speciesOf(S);
  sp.pots = sp.pots.filter(x => x !== q);
  return { pot: q, ...price };
}

/* ── PP 교환 ─────────────────────────────── */
/* 내줄 수 있는 삽수 — 뿌리낸(rooted · node · 흙에 자리 잡은) 무늬 몬스테라 삽수. 뿌리내리는 중·죽은 것은 안 된다 */
export function ppTradeCandidates(S) {
  return ((S && S.cuttings) || []).filter(c => c && c.varieFromCut && ['rooted', 'node', 'established'].includes(c.status));
}
function ppTradeStep(S, { day, doneIds } = {}) {
  const sp = speciesOf(S), t = sp.trade, R = SG.ppTrade;
  const ts = S.tutorial, story = S.story;
  if (t.done || t.pendingDay != null || t.asks >= R.maxAsks) return null;
  if (!(ts && ts.movedOut) || !story || !Number.isFinite(story.movedInOnDay)) return null;
  if (day - story.movedInOnDay < R.afterMoveDays) return null;
  const done = Array.isArray(doneIds) ? doneIds : ((S.stamina && S.stamina.questsTaken) || []);
  if (!done.includes(R.afterQuest)) return null;
  if (t.lastAskDay != null && day - t.lastAskDay < R.againDays) return null;
  if (!ppTradeCandidates(S).length) return null;         /* 내줄 것이 없으면 묻지 않는다(기다린다) */
  t.asks += 1; t.pendingDay = day; t.lastAskDay = day;
  return { id: 'pp_trade_offer', ko: '아래층 식물 나눔 쪽지 — 뿌리낸 무늬 몬스테라 삽수 하나와 핑크프린세스 어린 그루를 바꾸자고 합니다', again: t.asks > 1 };
}
/* 물음이 걸려 있나(화면이 [바꾼다]/[안 바꾼다]를 띄운다 · 세이브 뒤에도 남는다) */
export const ppTradePending = S => !!(S && S.species && S.species.trade && S.species.trade.pendingDay != null);
/* 대답 — yes 면 삽수 하나를 내주고 PP 어린 그루를 가방에 받는다. 반환 { events, pot? } */
export function answerPPTrade(S, yes, opt = {}) {
  const sp = speciesOf(S), t = sp.trade;
  if (t.pendingDay == null) throw new Error('[종] 걸린 교환 물음이 없습니다');
  const day = S.day ?? 0;
  if (yes) {
    const cands = ppTradeCandidates(S);
    const c = (opt.cuttingId && cands.find(x => x.id === opt.cuttingId)) || cands[0] || null;
    if (!c) { const e = new Error('내줄 뿌리낸 무늬 삽수가 없습니다'); e.tutorialInput = true; throw e; }
    S.cuttings = S.cuttings.filter(x => x !== c);
    const pot = addSpeciesPot(S, 'pink_princess', { origin: 'trade', newPlant: { pinks: [...SG.ppTrade.give.pinks] } });
    t.pendingDay = null; t.done = true; t.doneDay = day;
    return { events: [{ id: 'pp_trade_done', ko: '핑크프린세스 어린 그루를 받았습니다 — 가방에 있습니다', potId: pot.id, gave: c.id }], pot, gave: c.id };
  }
  t.pendingDay = null; t.declined += 1;
  const last = t.declined >= SG.ppTrade.maxAsks;
  return { events: [{ id: 'pp_trade_declined', ko: last ? '교환을 두 번 거절했습니다 — 핑크프린세스는 이제 상점에 있습니다' : '교환을 거절했습니다', last }] };
}

/* ── 상점 진열 ─────────────────────────────── shop CATALOG 의 두 품목(al_corm · pp_young)을 «지금 보이나» */
export function speciesShopOpen(S, itemId) {
  const ts = S && S.tutorial;
  if (!ts || !ts.enabled) return true;                   /* 첫 플레이가 꺼진 판(검수)은 안 감춘다 — 다른 갈래와 같은 규약 */
  if (itemId === 'al_corm') {
    const st = S.story;
    return !!(ts.movedOut && st && Number.isFinite(st.movedInOnDay) && (S.day - st.movedInOnDay) >= SG.alShop.afterMoveDays);
  }
  if (itemId === 'pp_young') return !!(S.species && S.species.trade && S.species.trade.declined >= SG.ppTrade.maxAsks && !S.species.trade.done);
  return false;
}
/* 산 재고를 그루로 — 상점 구근은 심으면 AL 그루(origin 'shop' · 곁줄 «찾은 구근»은 안 침) · PP 어린 그루는 그대로 */
export function unpackSpeciesStock(S, itemId, stockOf, takeStock) {
  if (stockOf(S, itemId) <= 0) { const e = new Error('재고가 없습니다'); e.tutorialInput = true; throw e; }
  let q = null;
  if (itemId === 'al_corm') {
    const R = speciesRules(), id = nextId(S, 'sp');
    q = addSpeciesPot(S, 'alocasia_frydek', { id, origin: 'shop', plant: R.newPlant('alocasia_frydek', { seed: seedFor(S, id), origin: 'shop' }) });
  } else if (itemId === 'pp_young') q = addSpeciesPot(S, 'pink_princess', { origin: 'shop' });
  else throw new Error(`[종] 새 식물 품목이 아닙니다: ${itemId}`);
  takeStock(S, itemId, 1);
  return q;
}

/* ── 스냅샷(퀘스트 곁줄 셋 · plan quest.js SPECIES_QUESTS) ─────────────────────────────── */
export function speciesSnapshot(S) {
  const sp = S && S.species;
  if (!sp) return { ppPlants: 0, ppPinkHoldCuts: 0, alDormantNow: false, alWokeCount: 0, alCormsFound: 0, alFoundCormsPlanted: 0 };
  const pots = Array.isArray(sp.pots) ? sp.pots : [];
  return {
    ppPlants: pots.filter(q => q && q.species === 'pink_princess').length,
    ppPinkHoldCuts: (sp.n && sp.n.ppPinkHoldCuts) || 0,
    alDormantNow: pots.some(q => q && q.species === 'alocasia_frydek' && speciesPlaced(q) && q.plant && q.plant.phase === 'asleep'),
    alWokeCount: (sp.n && sp.n.alWokeCount) || 0,
    alCormsFound: (sp.n && sp.n.alCormsFound) || 0,
    alFoundCormsPlanted: (sp.n && sp.n.alFoundCormsPlanted) || 0
  };
}

/* ── 그림(방) ─────────────────────────────── growth youngPlantOf 입구에 넘길 것 · 등급 낱말(화면 한 줄) */
export function speciesBriefKo(q) {
  if (!q || !RULES) return '';
  const ko = SPECIES_KO[q.species] || q.species;
  const s = RULES.summary(q.plant);
  if (q.species === 'alocasia_frydek') {
    if (s.phase === 'corm') return `${ko} 구근 — 싹을 기다립니다`;
    if (s.asleep) return `${ko} — 자는 중(잎 0장)`;
    const v = q.plant.varie ? (SG.gradeKo.alocasia_frydek[q.plant.varie] || '무늬') : '무지';
    return `${ko} ${v} — 잎 ${s.leaves}장${s.phase === 'dropping' ? ' · 잎이 지는 중' : ''}`;
  }
  const g = s.topGrade ? (SG.gradeKo.pink_princess[s.topGrade] || s.topGrade) : '';
  return `${ko} — 잎 ${s.leaves}장 · 맨 위 ${g}${s.withering ? ' · 줄기 끝이 시드는 중' : ''}`;
}

/* ── 세이브 ─────────────────────────────── 그루 상태는 growth 규약(schema species/1) 그대로 싣는다 */
export function packSpecies(sp) {
  if (!sp) return null;
  return JSON.parse(JSON.stringify({
    pots: (sp.pots || []).map(q => ({ id: q.id, species: q.species, plant: q.plant, slotId: q.slotId || null, at: q.at || null,
                                      placedOnce: !!q.placedOnce, gotDay: q.gotDay ?? null, origin: q.origin || null })),
    corms: sp.corms || [], trade: sp.trade || null, n: sp.n || null, seq: sp.seq || 0
  }));
}
export function unpackSpecies(raw) {
  const sp = createSpeciesState();
  if (!raw || typeof raw !== 'object') return sp;
  for (const q of Array.isArray(raw.pots) ? raw.pots : []) {
    if (!q || !isSp(q.species) || !q.plant) continue;
    if (RULES) { try { RULES.assertPlant(q.plant); } catch { continue; } }   /* 깨진 그루는 싣지 않는다(지어내지 않는다) */
    sp.pots.push({ id: String(q.id), species: q.species, plant: q.plant, slotId: q.slotId || null, at: q.at || null,
                   placedOnce: !!q.placedOnce, gotDay: q.gotDay ?? null, origin: q.origin || null });
  }
  for (const c of Array.isArray(raw.corms) ? raw.corms : [])
    if (c && c.id) sp.corms.push({ id: String(c.id), seed: c.seed >>> 0, origin: c.origin || 'from_plain_mother', motherKind: c.motherKind ?? null, foundDay: c.foundDay ?? null });
  if (raw.trade && typeof raw.trade === 'object') Object.assign(sp.trade, raw.trade);
  if (raw.n && typeof raw.n === 'object') for (const k of Object.keys(sp.n)) if (Number.isFinite(raw.n[k])) sp.n[k] = raw.n[k];
  sp.seq = Number.isInteger(raw.seq) ? raw.seq : sp.pots.length + sp.corms.length;
  return sp;
}
