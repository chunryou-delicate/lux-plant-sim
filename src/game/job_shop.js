/* src/game/job_shop.js — **진로 «식물 가게»** (core · 2026-10-10 · 총괄 D59 · plan-shop-spec-20261010 §2~§4·§7)
   ------------------------------------------------------------------
   엔딩(집을 샀다) 뒤 진로 고르기 → [가게를 연다] → 산 투룸으로 이사 → 문 앞 주문판.
   손님이 «이런 식물»을 기한 안에 찾고, 맞추면 시세 × 웃돈을 받고 그 손님은 단골이 된다. 단골 3 · 10(간판) · 30 이 이정표(돈 없음).
   ★ 원칙(plan §0): **새 값표를 안 만든다**(값 = 그것의 지금 시세 × 웃돈 — 판매 함수 그대로) · **할 수 없는 주문을 안 낸다**(그 판이 가진 원천으로만).
   ★ 상태는 둘로 갈린다(이름 충돌 — S.shop 은 이미 «상점»(재고·주문·판 돈)이다):
       story.job  = { id:'shop', since }                          진로(세이브 story 칸)
       S.jobShop  = { orders, nextOrderDay, regulars, done, expired, milestones, signOnDay, seq, openedOn }   가게 판
   ⚖ 값·때(총괄 D59 첫 판) — SHOP_JOB 한 곳. 손님 표는 plan(data/balance/shop_customers.json · 이 파일은 읽기만).
   사건(turn.events · 대사는 plan dialogue): job_start · shop_open · order_new · order_done{newRegular} · order_expired · regulars_milestone{n} · shop_sign
   ⚠ 손님 이름이 드는 줄은 대사가 아니라 기록 줄·주문판 글(plan — 대사는 틀 글자를 못 채움): 붙을 때 «{ko} — {ask}» · 받아 갈 때 «{ko} — {thanks}» */
import { cuttingPriceOf, potPriceOf } from './shop.js';
import { speciesPriceOf, speciesPotsOf, speciesPlaced, SPECIES_GAME, speciesRules, speciesReady } from './species.js';
import { u01 } from '../growth/species_growth.js';
import { seasonOf } from '../engine/weather.js';

let CUSTOMERS = null;
try { const m = await import('../../data/balance/shop_customers.json', { with: { type: 'json' } }); CUSTOMERS = m.default; } catch { CUSTOMERS = null; }
export function installShopCustomers(c) { CUSTOMERS = c || null; }   /* 검사가 표를 갈아 끼울 때 */
export const shopCustomers = () => (CUSTOMERS && Array.isArray(CUSTOMERS.customers) ? CUSTOMERS.customers : []);

export const SHOP_JOB = Object.freeze({
  /* 새 주문 — 마지막 주문 뒤 5~9일 중 하루(판 씨앗으로) · 열린 주문 최대 3 (⚖ D59) */
  orderGap: Object.freeze([5, 9]),
  maxOpen: 3,
  /* 어려움 → 기한 · 웃돈(⚖ D59) */
  tiers: Object.freeze({
    easy:   Object.freeze({ days: 21, premium: 1.3,  ko: '쉬움' }),
    normal: Object.freeze({ days: 30, premium: 1.45, ko: '보통' }),
    hard:   Object.freeze({ days: 45, premium: 1.6,  ko: '어려움' })
  }),
  repeatBonus: 0.1,            /* 다시 온 손님 웃돈 +0.1(⚖ D59) */
  newBias: 3,                  /* 아직 단골이 아닌 손님 쪽으로 3:1(⚖ D59) */
  milestones: Object.freeze([3, 10, 30]),
  signAt: 10,
  /* 산 투룸 — 월세 0 · 관리비 한 달 8만(⚖ D59 · homes.json «산 집» 줄 대신 여기 한 곳 · core 판단) */
  ownedHome: Object.freeze({ roomId: 'tworoom', rentWon: 0, utilityWon: 80_000 })
});
const SJ = SHOP_JOB;
const KINDS = Object.freeze(['monstera_cutting', 'monstera_pot', 'pp', 'al', 'al_corm']);
export const ORDER_KIND_KO = Object.freeze({
  monstera_cutting: '몬스테라 삽수', monstera_pot: '몬스테라 그루', pp: '핑크프린세스', al: '알로카시아', al_corm: '알로카시아 구근'
});
/* 등급 낱말 사다리(낮은 → 높은) — 몬스테라는 varie_grades id · PP 는 growth 등급(분홍 잎은 주문 안 함) · AL 은 무늬 갈래 */
const RANK = Object.freeze({
  monstera: ['plain', 'sanban', 'halfmoon', 'fullmoon'],
  pink_princess: ['green', 'marble', 'heavy'],
  alocasia_frydek: ['plain', 'marble', 'sector']
});
export const GRADE_KO = Object.freeze({ sanban: '산반', halfmoon: '하프문', fullmoon: '풀문' });
/* 주문 need.grade 는 몬스테라 낱말(산반·하프문·풀문)로 적고 종마다 사다리 자리로 읽는다(PP marble=산반 · heavy=하프문 · AL marble=산반 · sector=하프문) */
const NEED_TO_RANK = Object.freeze({ sanban: 1, halfmoon: 2, fullmoon: 3 });

/* ── 상태 ─────────────────────────────── */
export function createJobShopState() {
  return { orders: [], nextOrderDay: null, regulars: [], done: 0, expired: 0, milestones: {}, signOnDay: null, seq: 0, openedOn: null, lastExpireSaidDay: null };
}
export function jobOf(S) { return (S && S.story && S.story.job) || null; }
export function jobShopOf(S) {
  if (!S) throw new TypeError('[가게] 상태가 없습니다');
  if (!S.jobShop || typeof S.jobShop !== 'object') S.jobShop = createJobShopState();
  const J = S.jobShop, d = createJobShopState();
  for (const k of Object.keys(d)) if (J[k] === undefined) J[k] = d[k];
  return J;
}
export const isShopJob = S => !!(jobOf(S) && jobOf(S).id === 'shop');
export const movedHome = S => !!(S && S.home && S.home.room === SJ.ownedHome.roomId && isShopJob(S));

/* ── 진로 고르기 ─────────────────────────────── 엔딩 뒤 [가게를 연다] · 이사(투룸)는 부르는 쪽(oneroom §moveIntoHome) */
export function startShopJob(S) {
  if (!S.story) throw new Error('[가게] 스토리 상태가 없습니다');
  if (isShopJob(S)) { const e = new Error('[가게] 이미 가게를 열었습니다'); e.tutorialInput = true; throw e; }
  S.story.job = { id: 'shop', since: S.day ?? 0 };
  jobShopOf(S);
  return { events: [{ id: 'job_start', ko: '진로 — 식물 가게를 열기로 했습니다' }] };
}

/* ── 원천 — «할 수 없는 주문을 안 낸다»(plan §2-3) · 이 판단은 여기 한 곳 ─────────────────────────────── */
const gradeRankOfCutting = c => {
  const g = Array.isArray(c && c.leafGrade) ? c.leafGrade : [];
  let r = 0; for (const id of g) { const i = RANK.monstera.indexOf(id); if (i > r) r = i; }
  if (!g.length && c && (c.variegatedLeaves || 0) > 0) r = 1;   /* 옛 세이브 — 무늬 잎은 산반으로 읽는다(확정문 §5) */
  return r;
};
const leavesOfCutting = c => Number.isInteger(c && c.leaves) ? c.leaves : (Array.isArray(c && c.leafVarie) ? c.leafVarie.length : ((c && c.source && c.source.leaves) || 0));
const gradeRankOfSpecies = q => {
  if (!q || !speciesReady()) return 0;
  const rows = speciesRules().leafRows(q.plant);
  const lad = RANK[q.species] || [];
  let r = 0; for (const row of rows) { const i = lad.indexOf(row.grade); if (i > r) r = i; }
  return r;
};
const alAwake = q => q && q.species === 'alocasia_frydek' && q.plant && q.plant.phase === 'growing' && (q.plant.leaves || []).length > 0;
/* 그 판이 지금 낼 수 있는 kind 들 — ctx.cutOpen: 오늘 «문에 안 막힌» 모주 자를 마디 수(loop §cutOpenCountOf · S.cutOpenToday) */
export function shopSources(S, ctx = {}) {
  const cuts = (S.cuttings || []).filter(c => c && c.status !== 'dead');
  const est = cuts.filter(c => c.status === 'established');
  const cutOpen = Number.isFinite(ctx.cutOpen) ? ctx.cutOpen : ((S.cutOpenToday && S.cutOpenToday.n) || 0);
  const sp = speciesPotsOf(S);
  const varieSource = cuts.some(c => c.varieFromCut) || (S.pots || []).some(p => p && p.variegated) || !!ctx.motherVarie;
  /* ★ 2026-10-10 («가게 사람» 판 — 맞춤 몫 18% · 기한 지남이 전부 몬스테라 삽수) — **보낼 수 있는 수만큼만** 주문을 연다:
       삽수 = 지금 보낼 수 있는 뿌리낸 삽수(안 올린 것) + 오늘 자를 마디가 있으면 하나(기한 21~45일 안에 뿌리내림 12일) − 이미 걸린 삽수 주문.
       «잎 2장 이상»은 그런 삽수가 지금 있을 때만. 키운 그루 주문도 보낼 그루 수 − 걸린 그루 주문. (plan §2-3 «할 수 있는 것만»을 수로) */
  const openOf = k => ((S.jobShop && S.jobShop.orders) || []).filter(o => o && o.kind === k).length;
  const cutReady = cuts.filter(c => ['rooted', 'node'].includes(c.status) && !c.listing);
  const cutCap = cutReady.length + (cutOpen > 0 ? 1 : 0) - openOf('monstera_cutting');
  const potCap = est.filter(c => !c.listing).length - openOf('monstera_pot');
  /* 새 두 종도 같은 자 — 지금 보낼 수 있는 그루(잎 있음 · 살 수 있음) − 걸린 주문 · 구근은 손에 든 것(찾은 구근 + 산 재고) − 걸린 주문 */
  const ppReady = sp.filter(q => q.species === 'pink_princess' && q.plant && q.plant.viable !== false && (q.plant.leaves || []).length > 0);
  const alReady = sp.filter(alAwake);
  const cormHeld = ((S.species && S.species.corms) || []).length + ((S.shop && S.shop.stock && S.shop.stock.al_corm) || 0);
  return {
    monstera_cutting: cutCap > 0,
    monstera_pot: ((S.pots || []).length + est.length) >= 2 && potCap > 0,
    cut2: cutReady.some(c => leavesOfCutting(c) >= 2),
    pp: ppReady.length - openOf('pp') > 0,
    ppMarble: ppReady.some(q => gradeRankOfSpecies(q) >= 1), ppHeavy: ppReady.some(q => gradeRankOfSpecies(q) >= 2),
    al: alReady.length - openOf('al') > 0,
    al2: alReady.some(q => (q.plant.leaves || []).length >= 2),
    al_corm: cormHeld - openOf('al_corm') > 0,
    /* plan §11 가드 재료 — 등 = 등 자리에 놓인 식물등 수(빛 계산과 같은 칸 · lightOptsOf.lampCount) · 오늘 · 이미 갖춘 등급 */
    lamps: Number.isFinite(ctx.lamps) ? ctx.lamps : ((S.lamps && S.lamps.count) || 0), day: S.day ?? 0,
    cutHalfmoon: cutReady.some(c => gradeRankOfCutting(c) >= 2), cutSanban: cutReady.some(c => gradeRankOfCutting(c) >= 1),
    ppTopPink: Math.max(0, ...ppReady.map(q => { const L = q.plant.leaves || []; return (L.length && Number(L[L.length - 1].pink)) || 0; })),
    varieSource, lampPlaced: !!(S.tutorial && S.tutorial.lamp && S.tutorial.lamp.placed > 0),
    varieAL: sp.some(q => q.species === 'alocasia_frydek' && q.plant && q.plant.varie),
    varieEst: est.some(c => gradeRankOfCutting(c) >= 1),
    maxLeaves: Math.max(0, ...est.map(leavesOfCutting))
  };
}

/* ── 주문 하나 짓기(kind · tier · need) ─────────────────────────────── */
/* ★ plan-shop-spec §11 가드 넷(growth 7e46ad2a 투룸 판 · «주문 연 날 막 시작한 그루로 기한 안에 맞출 수 있나») —
     «자람이 드는» 조건은 ① 이미 갖춘 그루가 있거나(바로 납품 · 가드와 상관없음) ② 키워 맞출 수 있을 때만 낸다:
     1 겨울(또는 기한 안에 겨울이 낌) — 등 2개 이상 · 2 몬스테라 하프문 이상 — 철과 상관없이 등 2개 이상(아니면 산반으로)
     3 PP 하프문(분홍 반달) — 맨 위 잎 분홍 0.5 이상 · 4 AL 잎 2 — 가을엔 등 1개 이상 */
const winterIn = (src, tier) => { const d = src.day ?? 0, n = SJ.tiers[tier] ? SJ.tiers[tier].days : 0; return seasonOf(d) === 'winter' || seasonOf(d + n) === 'winter'; };
const growable = (src, tier) => !winterIn(src, tier) || src.lamps >= 2;
function needFor(kind, tier, src) {
  if (kind === 'monstera_cutting') {
    if (tier === 'easy') return {};
    if (tier === 'normal') return (src.cut2 || growable(src, tier)) ? { leaves: 2 } : null;
    if (!src.varieSource) return null;
    if (src.cutHalfmoon || (src.lamps >= 2 && growable(src, tier))) return { grade: 'halfmoon' };
    return (src.cutSanban || growable(src, tier)) ? { grade: 'sanban' } : null;
  }
  if (kind === 'monstera_pot') {
    if (tier === 'normal') return { leaves: Math.max(1, src.maxLeaves - 1) };
    if (tier === 'hard') return src.varieEst ? { grade: 'sanban' } : null;
    return null;
  }
  if (kind === 'pp') {
    if (tier === 'easy') return {};
    if (tier === 'normal') return (src.ppMarble || growable(src, tier)) ? { grade: 'sanban' } : null;
    return (src.ppHeavy || (src.ppTopPink >= 0.5 && growable(src, tier))) ? { grade: 'halfmoon' } : null;
  }
  if (kind === 'al') {
    const autumnOk = seasonOf(src.day ?? 0) !== 'autumn' || src.lamps >= 1;
    return tier === 'normal' ? ((src.al2 || (growable(src, tier) && autumnOk)) ? { leaves: 2 } : null) : tier === 'hard' ? (src.varieAL ? { grade: 'sanban' } : null) : null;
  }
  if (kind === 'al_corm') return tier === 'easy' ? {} : null;
  return null;
}
export { needFor as orderNeedFor };   /* 검사(test_job_shop §I 가드) */
const pick = (arr, u) => arr[Math.min(arr.length - 1, Math.floor(u * arr.length))];
function rollOrder(S, src, { first = false, day } = {}) {
  const J = jobShopOf(S), seed = ((S.sim && S.sim.seed) >>> 0) ^ 0x5eed5;
  const k0 = J.seq + 1;
  const kinds = KINDS.filter(k => src[k] && !J.orders.some(o => o.kind === k && first));
  if (!kinds.length) return null;
  /* 첫 주문 — 지금 가진 것으로 «바로» 맞출 수 있는 쉬움 하나(가장 흔한 kind · need 없음) */
  if (first) {
    const can = ['monstera_cutting', 'pp', 'al_corm'].find(k => src[k] && candidatesFor(S, { kind: k, need: {} }).length);
    const kind = can || kinds[0];
    const tier = needFor(kind, 'easy', src) ? 'easy' : 'normal';
    return { kind, tier, need: needFor(kind, tier, src) || {} };
  }
  for (let t = 0; t < 8; t++) {
    const kind = pick(kinds, u01(seed, k0 * 31 + t, 11));
    const tiers = ['easy', 'normal', 'hard'].filter(x => needFor(kind, x, src));
    if (!tiers.length) continue;
    const tier = pick(tiers, u01(seed, k0 * 31 + t, 13));
    return { kind, tier, need: needFor(kind, tier, src) };
  }
  return null;
}
function pickCustomer(S, { first = false } = {}) {
  const list = shopCustomers();
  if (!list.length) return null;
  const J = jobShopOf(S);
  if (first) return list.find(c => c.id === (CUSTOMERS && CUSTOMERS.first)) || list[0];
  const open = new Set(J.orders.map(o => o.customerId));
  const pool = list.filter(c => !open.has(c.id));
  if (!pool.length) return null;
  const w = pool.map(c => J.regulars.includes(c.id) ? 1 : SJ.newBias);
  const tot = w.reduce((a, b) => a + b, 0);
  let u = u01(((S.sim && S.sim.seed) >>> 0) ^ 0xc057, J.seq + 1, 17) * tot;
  for (let i = 0; i < pool.length; i++) { u -= w[i]; if (u < 0) return pool[i]; }
  return pool[pool.length - 1];
}
function pushOrder(S, spec, cust, day) {
  const J = jobShopOf(S);
  J.seq += 1;
  const tier = SJ.tiers[spec.tier];
  const repeat = J.regulars.includes(cust.id);
  const o = { id: `od_${String(J.seq).padStart(3, '0')}`, customerId: cust.id, kind: spec.kind, need: spec.need || {}, tier: spec.tier,
              openedOn: day, dueOn: day + tier.days, premium: +(tier.premium + (repeat ? SJ.repeatBonus : 0)).toFixed(2), repeat };
  J.orders.push(o);
  return o;
}
export function orderWantKo(o) {
  const k = ORDER_KIND_KO[o.kind] || o.kind;
  if (o.need && o.need.grade) return `${GRADE_KO[o.need.grade] || o.need.grade} 이상 무늬 잎이 있는 ${k}`;
  if (o.need && o.need.leaves) return `잎 ${o.need.leaves}장 이상 ${k}`;
  return k;
}
const customerOf = id => shopCustomers().find(c => c.id === id) || { id, ko: id, ask: '', thanks: '' };
function orderNewEvent(o) {
  const c = customerOf(o.customerId);
  return { id: 'order_new', ko: `${c.ko} — ${c.ask}`, orderId: o.id, customerId: o.customerId, want: orderWantKo(o), dueOn: o.dueOn, kind: o.kind, tier: o.tier };
}

/* ── 가게 첫날 ─────────────────────────────── 투룸으로 옮긴 그날 · 주문판 + 첫 주문(바로 맞출 수 있는 쉬움 하나) */
export function openShop(S, ctx = {}) {
  const J = jobShopOf(S), day = S.day ?? 0;
  if (J.openedOn != null) return { events: [] };
  J.openedOn = day;
  const ev = [{ id: 'shop_open', ko: '문 앞에 작은 주문판을 걸었습니다' }];
  const src = shopSources(S, ctx);
  const spec = rollOrder(S, src, { first: true, day });
  const cust = spec ? pickCustomer(S, { first: true }) : null;
  if (spec && cust) ev.push(orderNewEvent(pushOrder(S, spec, cust, day)));
  J.nextOrderDay = day + nextGap(S);
  return { events: ev };
}
function nextGap(S) {
  const J = jobShopOf(S), [lo, hi] = SJ.orderGap;
  return lo + Math.min(hi - lo, Math.floor(u01(((S.sim && S.sim.seed) >>> 0) ^ 0x6a9, J.seq + 7, 19) * (hi - lo + 1)));
}

/* ── 하루 ─────────────────────────────── loop.nextDay 가 부른다(가게를 연 판만) · 반환 { events } */
export function stepShopJob(S, ctx = {}) {
  const out = { events: [] };
  if (!isShopJob(S) || !movedHome(S)) return out;
  const J = jobShopOf(S), day = S.day ?? 0;
  if (J.openedOn == null) return { events: openShop(S, ctx).events };
  /* 기한 지난 주문 — 조용히 사라진다(벌 없음 · 단골 안 셈) · 기록 줄 */
  for (const o of [...J.orders]) if (day > o.dueOn) {
    J.orders = J.orders.filter(x => x !== o); J.expired += 1;
    const c = customerOf(o.customerId);
    out.events.push({ id: 'order_expired', ko: `${c.ko}의 주문 기한이 지났습니다`, orderId: o.id, customerId: o.customerId, kind: o.kind, tier: o.tier, need: o.need });
  }
  /* 새 주문 */
  if (J.nextOrderDay != null && day >= J.nextOrderDay) {
    if (J.orders.length < SJ.maxOpen) {
      const src = shopSources(S, ctx);
      const spec = rollOrder(S, src, { day });
      const cust = spec ? pickCustomer(S) : null;
      if (spec && cust) out.events.push(orderNewEvent(pushOrder(S, spec, cust, day)));
    }
    J.nextOrderDay = day + nextGap(S);
  }
  return out;
}

/* ── 납품 후보 · 값 ─────────────────────────────── ref = { type:'cutting'|'species'|'corm'|'cormStock', id } */
export function candidatesFor(S, o) {
  const need = (o && o.need) || {};
  const out = [];
  const rankNeed = need.grade ? NEED_TO_RANK[need.grade] || 1 : 0;
  if (o.kind === 'monstera_cutting' || o.kind === 'monstera_pot') {
    const want = o.kind === 'monstera_cutting' ? ['rooted', 'node'] : ['established'];
    for (const c of (S.cuttings || [])) {
      if (!c || !want.includes(c.status) || c.listing) continue;
      const lv = leavesOfCutting(c), gr = gradeRankOfCutting(c);
      if (need.leaves && lv < need.leaves) continue;
      if (rankNeed && gr < rankNeed) continue;
      const vl = Array.isArray(c.leafVarie) ? c.leafVarie.filter(Boolean).length : (c.variegatedLeaves || 0);
      const q = (o.kind === 'monstera_cutting' ? cuttingPriceOf : potPriceOf)({ leaves: lv, variegatedLeaves: vl, leafGrades: Array.isArray(c.leafGrade) ? c.leafGrade : null });
      out.push({ ref: { type: 'cutting', id: c.id }, ko: `${o.kind === 'monstera_cutting' ? '삽수' : '키운 그루'} ${c.id} · 잎 ${lv}장`, baseWon: q.won });
    }
  } else if (o.kind === 'pp' || o.kind === 'al') {
    const sp = o.kind === 'pp' ? 'pink_princess' : 'alocasia_frydek';
    for (const q of speciesPotsOf(S)) {
      if (!q || q.species !== sp) continue;
      if (q.plant && q.plant.viable === false) continue;
      const lv = (q.plant.leaves || []).length;
      if (!lv) continue;
      if (need.leaves && lv < need.leaves) continue;
      if (rankNeed && gradeRankOfSpecies(q) < rankNeed) continue;
      out.push({ ref: { type: 'species', id: q.id }, ko: `${ORDER_KIND_KO[o.kind]} ${q.id} · 잎 ${lv}장${speciesPlaced(q) ? '' : '(가방)'}`, baseWon: speciesPriceOf(q).won });
    }
  } else if (o.kind === 'al_corm') {
    for (const c of ((S.species && S.species.corms) || [])) out.push({ ref: { type: 'corm', id: c.id }, ko: '찾은 구근', baseWon: SPECIES_GAME.cormSellWon });
    const st = (S.shop && S.shop.stock && S.shop.stock.al_corm) || 0;
    if (st > 0) out.push({ ref: { type: 'cormStock', id: 'al_corm' }, ko: '산 구근', baseWon: SPECIES_GAME.cormSellWon });
  }
  for (const x of out) x.won = Math.round(x.baseWon * (o.premium || 1));
  return out;
}

/* ── 납품 ─────────────────────────────── 그것을 판 것처럼 뺀다 · 돈은 부르는 쪽이 shop §creditShopOrder 로 넣는다(값·통은 shop 한 곳)
   반환 { won, events, newRegular, removed } */
export function deliverOrder(S, orderId, ref) {
  const J = jobShopOf(S);
  const o = J.orders.find(x => x.id === orderId);
  if (!o) { const e = new Error('그 주문을 못 찾았습니다'); e.tutorialInput = true; throw e; }
  const cand = candidatesFor(S, o).find(x => x.ref.type === ref.type && x.ref.id === ref.id);
  if (!cand) { const e = new Error('그것은 이 주문에 맞지 않습니다'); e.tutorialInput = true; throw e; }
  /* 뺀다 — 던질 것은 위에서 다 던졌다 */
  if (ref.type === 'cutting') S.cuttings = (S.cuttings || []).filter(c => c.id !== ref.id);
  else if (ref.type === 'species') S.species.pots = S.species.pots.filter(q => q.id !== ref.id);
  else if (ref.type === 'corm') S.species.corms = S.species.corms.filter(c => c.id !== ref.id);
  else if (ref.type === 'cormStock') S.shop.stock.al_corm -= 1;
  J.orders = J.orders.filter(x => x !== o);
  J.done += 1;
  const newRegular = !J.regulars.includes(o.customerId);
  if (newRegular) J.regulars.push(o.customerId);
  const c = customerOf(o.customerId), day = S.day ?? 0;
  const events = [{ id: 'order_done', ko: `${c.ko} — ${c.thanks}`, orderId: o.id, customerId: o.customerId, newRegular, won: cand.won }];
  for (const n of SJ.milestones) if (J.regulars.length >= n && J.milestones[n] == null) {
    J.milestones[n] = day;
    events.push({ id: 'regulars_milestone', ko: `단골 ${n}명`, n });
    if (n === SJ.signAt && J.signOnDay == null) { J.signOnDay = day; events.push({ id: 'shop_sign', ko: '가게 간판을 달았습니다' }); }
  }
  return { won: cand.won, events, newRegular, removed: ref };
}

/* ── 스냅샷(plan quest.js SHOP_QUESTS · emptySnapshot 칸) ─────────────────────────────── */
export function jobShopSnapshot(S) {
  const J = S && S.jobShop, job = jobOf(S), day = S ? S.day : 0;
  const open = J && Array.isArray(J.orders) ? J.orders : [];
  return {
    movedHome: movedHome(S),
    job: job ? job.id : null,
    shopDone: J ? J.done : null,
    shopRegulars: J ? J.regulars.length : null,
    shopOpenOrders: J ? open.length : null,
    shopDueSoonest: open.length ? Math.min(...open.map(o => o.dueOn - day)) : null
  };
}

/* ── 세이브 ─────────────────────────────── */
export function packJobShop(J) { return J ? JSON.parse(JSON.stringify(J)) : null; }
export function unpackJobShop(raw) {
  const J = createJobShopState();
  if (!raw || typeof raw !== 'object') return J;
  for (const k of Object.keys(J)) if (raw[k] !== undefined) J[k] = raw[k];
  if (!Array.isArray(J.orders)) J.orders = [];
  if (!Array.isArray(J.regulars)) J.regulars = [];
  if (!J.milestones || typeof J.milestones !== 'object') J.milestones = {};
  return J;
}
