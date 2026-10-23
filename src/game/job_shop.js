/* src/game/job_shop.js — **진로 «식물 가게»** (core · 2026-10-10 · 총괄 D59 · plan-shop-spec-20261010 §2~§4·§7)
   ------------------------------------------------------------------
   엔딩(집을 샀다) 뒤 진로 고르기 → [가게를 연다] → 산 투룸으로 이사 → 창 옆 주문판.
   손님이 «이런 식물»을 기한 안에 찾고, 맞추면 시세 × 웃돈을 받고 그 손님은 단골이 된다. 단골 3 · 10(간판) · 30 이 이정표(돈 없음).
   ★ 원칙(plan §0): **새 값표를 안 만든다**(값 = 그것의 지금 시세 × 웃돈 — 판매 함수 그대로) · **할 수 없는 주문을 안 낸다**(그 판이 가진 원천으로만).
   ★ 상태는 둘로 갈린다(이름 충돌 — S.shop 은 이미 «상점»(재고·주문·판 돈)이다):
       story.job  = { id:'shop', since }                          진로(세이브 story 칸)
       S.jobShop  = { orders, nextOrderDay, regulars, done, expired, milestones, signOnDay, seq, openedOn }   가게 판
   ⚖ 값·때(총괄 D59 첫 판) — SHOP_JOB 한 곳. 손님 표는 plan(data/balance/shop_customers.json · 이 파일은 읽기만).
   사건(turn.events · 대사는 plan dialogue): job_start · shop_open · order_new · order_done{newRegular} · order_expired · regulars_milestone{n} · shop_sign
   ⚠ 손님 이름이 드는 줄은 대사가 아니라 기록 줄·주문판 글(plan — 대사는 틀 글자를 못 채움): 붙을 때 «{ko} — {ask}» · 받아 갈 때 «{ko} — {thanks}» */
import { cuttingPriceOf, potPriceOf } from './shop.js';
import { speciesPriceOf, speciesPotsOf, speciesPlaced, SPECIES_GAME, speciesRules, speciesReady, speciesShopOpen,
         SPECIES2, speciesKnown, scRooting, caInCare, addSpeciesPot, speciesPotOf, scCuttableNodes, scAtHighSpot } from './species.js';
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
  /* ★ 2026-10-23 D71(박사님 «추천대로») — 새 두 종이 들어오는 때 = 단골 수(날짜가 아니라 — 가게를 잘하면 빨리 온다 · 명세 §0)
       단골 5 → 스킨답서스 «찾는 손님»(sc_ask · 상점 진열) · 단골 8 → 칼라테아 «맡기는 손님»(ca_care · 가방에 맡은 그루) */
  species2: Object.freeze({ scAt: 5, caAt: 8 }),
  /* ★ 2026-10-23 D75 ⑤(총괄) — 가게 끝맺음(plan-career-endings-spec §10): 단골 30 이 된 «다음 날 아침» 한 번 · 칭호 «동네 식물 가게»
       fewPlants ⚖ — 방에 놓인 그루가 이 밑이면 장면 둘째 줄 갈래(«오늘은 무엇부터 늘릴까.» · 빈 선반을 «내가 늘린 그루»라 안 한다) */
  ending: Object.freeze({ regulars: 30, fewPlants: 3, titleKo: '동네 식물 가게' }),
  /* 산 투룸 — 월세 0 · 관리비 한 달 8만(⚖ D59 · homes.json «산 집» 줄 대신 여기 한 곳 · core 판단) */
  ownedHome: Object.freeze({ roomId: 'tworoom', rentWon: 0, utilityWon: 80_000 })
});
const SJ = SHOP_JOB;
const KINDS = Object.freeze(['monstera_cutting', 'monstera_pot', 'pp', 'al', 'al_corm', 'sc_cutting', 'sc_pot', 'ca_pot']);
export const ORDER_KIND_KO = Object.freeze({
  monstera_cutting: '몬스테라 삽수', monstera_pot: '몬스테라 그루', pp: '핑크프린세스', al: '알로카시아', al_corm: '알로카시아 구근',
  sc_cutting: '스킨답서스 줄기 삽수', sc_pot: '스킨답서스 그루', ca_pot: '칼라테아 그루'   /* D71 */
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
  return { orders: [], nextOrderDay: null, regulars: [], done: 0, expired: 0, milestones: {}, signOnDay: null, seq: 0, openedOn: null, lastExpireSaidDay: null,
           /* D71 — 그날(sc_ask · ca_care · ca_saved) · 맡은 칼라테아 그루 id */
           scAskOn: null, caCareOn: null, caPotId: null, caSavedOn: null,
           /* D79 — 열린 주문이 0건인 날이 잇단 수(대사 맥락 칸 turn.shopOrderDryDays · 주문 가뭄 귀띔) */
           dryRun: 0 };
}
/* ★ 2026-10-10 진로 열거(plan-branch-job-gender §3-2) — 엔딩 뒤 같은 판의 «식물로 무엇을 하며 사나». 지금 열린 것은 shop 하나 ·
     care(돌봄) · breed(무늬 육종)는 준비 중(진로 카드 game.html §JOB_KO 와 같은 id) · decor(꾸미기·수집)는 박사님 몫(§5-2)이라 자리만.
     ⚠ 새 판 캐릭터(S.character · hero_branch §CHARACTER_IDS)와 한 칸에 섞지 않는다 */
export const JOB_IDS = Object.freeze(['shop', 'care', 'breed']);
export const JOB_IDS_RESERVED = Object.freeze(['decor']);
export const JOB_OPEN = Object.freeze(['shop']);
export function jobOf(S) { return (S && S.story && S.story.job) || null; }
export function jobShopOf(S) {
  if (!S) throw new TypeError('[가게] 상태가 없습니다');
  if (!S.jobShop || typeof S.jobShop !== 'object') S.jobShop = createJobShopState();
  const J = S.jobShop, d = createJobShopState();
  for (const k of Object.keys(d)) if (J[k] === undefined) J[k] = d[k];
  return J;
}
export const isShopJob = S => !!(jobOf(S) && jobOf(S).id === 'shop');
/* ★ 2026-10-24 B 판(plan-care-career-spec §4) — 진로가 하나라도(가게 · 돌봄 …) · 산 투룸으로 옮긴 판은 진로 공통 */
export const hasJob = S => !!(jobOf(S) && jobOf(S).id);
export const movedHome = S => !!(S && S.home && S.home.room === SJ.ownedHome.roomId && hasJob(S));

/* ── 진로 고르기 ─────────────────────────────── 엔딩 뒤 [가게를 연다] · 이사(투룸)는 부르는 쪽(oneroom §moveIntoHome) */
export function startShopJob(S) {
  if (!S.story) throw new Error('[가게] 스토리 상태가 없습니다');
  if (isShopJob(S)) { const e = new Error('[가게] 이미 가게를 열었습니다'); e.tutorialInput = true; throw e; }
  if (jobOf(S)) { const e = new Error('[가게] 이미 다른 진로를 골랐습니다'); e.tutorialInput = true; throw e; }   /* B · D73 ① 한 판에 하나(바꾸기는 D 판) */
  S.story.job = { id: 'shop', since: S.day ?? 0 };
  jobHistoryOf(S);   /* D75 — 진로 이력(story.jobs.shop = { since, endedOn }) */
  jobShopOf(S);
  return { events: [{ id: 'job_start', ko: '진로 — 식물 가게를 열기로 했습니다' }] };
}

/* ── ★ 2026-10-23 D75 진로 이력 · 끝맺음 · 칭호 ─────────────────────────────── plan-career-endings-spec §10 · §7(core)
   story.jobs = { shop: { since, endedOn } } — 진로마다 한 줄(D 나머지 «바꾸기»가 같은 칸을 쓴다 · 옛 세이브는 가게를 연 판이면 story.job.since 로 채움) */
export function jobHistoryOf(S) {
  const st = S && S.story;
  if (!st) return {};
  if (!st.jobs || typeof st.jobs !== 'object') st.jobs = {};
  const j = st.job;   /* 지금 진로 줄(가게 · 돌봄) — 옛 세이브는 story.job.since 로 채움 */
  if (j && j.id && !st.jobs[j.id]) st.jobs[j.id] = { since: Number.isFinite(j.since) ? j.since : null, endedOn: null };
  return st.jobs;
}
export const shopEndedOn = S => { const h = S && S.story && S.story.jobs && S.story.jobs.shop; return h && Number.isFinite(h.endedOn) ? h.endedOn : null; };
/* 칭호 — 이름뿐(돈·물건·능력 없음 · D59 결) */
export const jobTitlesOf = S => (shopEndedOn(S) != null ? [SJ.ending.titleKo] : []);
/* 할 일 탭 머리(§10-4) — 가게를 연 뒤: «식물 가게 · 단골 r명» · 끝맺음 뒤: «동네 식물 가게 · 단골 r명»(칭호 칩) */
export function jobHeadOf(S) {
  if (!isShopJob(S)) return null;
  const J = jobShopOf(S), title = shopEndedOn(S) != null ? SJ.ending.titleKo : null;
  return { title, regulars: J.regulars.length, ko: `${title || '식물 가게'} · 단골 ${J.regulars.length}명` };
}
/* 방에 놓인 그루 수 — 몬스테라 화분 + 놓인 삽수(죽지 않은) + 놓인 새 종 */
function placedPlantsOf(S) {
  const placed = x => !!(x && (x.slotId || x.at));
  return (S.pots || []).filter(placed).length
       + (S.cuttings || []).filter(c => c && c.status !== 'dead' && placed(c)).length
       + speciesPotsOf(S).filter(placed).length;
}
/* 끝맺음 — 단골 30 이 된 날(이정표 날) 뒤 첫 하루 넘김에서 한 번(옛 세이브가 이미 넘었으면 불러온 뒤 첫 하루 넘김) */
function shopEndingStep(S, J, day) {
  const E = SJ.ending, at = J.milestones[E.regulars];
  if (at == null || !(day > at)) return null;
  const h = jobHistoryOf(S).shop;
  if (!h || h.endedOn != null) return null;
  h.endedOn = day;
  const plantsPlaced = placedPlantsOf(S);
  return { id: 'shop_ending', ko: `칭호 — ${E.titleKo}`, title: E.titleKo, regulars: J.regulars.length, done: J.done,
           plantsPlaced, fewPlants: plantsPlaced < E.fewPlants, openedOn: J.openedOn };
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
/* ★ 2026-10-23 D71 — 새 두 종의 원천(같은 자: 보낼 수 있는 수 − 걸린 주문 · 맡은 칼라테아는 손님 것이라 원천이 아니다)
     ctx.spots = 오늘 방 자리 [{ dropM(받침 높이 m), dli }] (loop §shopSpotsOf) — «높은 자리» 가드 · «칼라테아 알맞은 자리» 가드 · 줄기 상한.
     없으면(못 셈) 길이 주문 · 칼라테아 주문을 안 낸다(«할 수 있는 것만» — 모르면 안 낸다). 수는 growth 규칙에서(숫자 두 벌 없음) */
function species2Sources(S, sp, ctx, openOf) {
  const SCI = SPECIES2.sc, CAL = SPECIES2.ca;
  const out = { sc_cutting: false, sc_pot: false, ca_pot: false, sc2: false, scGrownN: 0, scMaxLen: 0, scStep: null,
                scReachN: null, scReachH: null, scHighN: 0, scLongM: null, caMaxLeaves: 0, caFit: 0 };
  const spots = Array.isArray(ctx.spots) ? ctx.spots.filter(s => s && Number.isFinite(s.dropM)) : null;
  if (speciesKnown(SCI)) {
    const R = speciesRules(), sum = q => R.summary(q.plant);
    const all = sp.filter(q => q.species === SCI && !q.listing && !q.care);   /* 맡은 그루(돌봄 · B)는 손님 것 */
    const cuts = all.filter(scRooting), grown = all.filter(q => !scRooting(q));
    const cutOpen = grown.some(q => scCuttableNodes(q).length > 0);
    out.sc_cutting = cuts.length + (cutOpen ? 1 : 0) - openOf('sc_cutting') > 0;
    out.sc2 = cuts.some(q => sum(q).nodes >= 2) || grown.some(q => scCuttableNodes(q).some(n => n.take >= 2));
    /* 그루 주문은 «그루가 둘 이상»일 때만 — 몬스테라 그루 주문(monstera_pot · 화분 + 자리 잡은 삽수 ≥ 2)과 같은 자: 하나뿐인 줄기를 내주면 곁줄 sc_hang 이 끊긴다
         (10-23 하네스 shop71 6판 — sc_pot 62 낸 것 0 맞춤 · 가게 사람이 하나뿐인 지킴이를 안 내줌) */
    out.sc_pot = grown.length >= 2 && grown.length - openOf('sc_pot') > 0;
    out.scGrownN = grown.length;
    let top = null;
    for (const q of grown) { const L = sum(q).lengthM; if (Number.isFinite(L) && (top == null || L > out.scMaxLen)) { out.scMaxLen = L; top = q; } }
    out.scStep = typeof R.scInternodeM === 'function' ? R.scInternodeM(top ? top.plant : undefined) : null;
    out.scLongM = typeof R.longVineM === 'function' ? R.longVineM() : null;
    /* ★ 기한 안에 닿는 길이 — growth 규칙 그대로 가장 긴 그루의 복사본을 방 자리마다 기한 날 수만큼 걸린다(오늘 그 자리 빛 · 오늘 철 · 숫자 두 벌 없음).
         보통 = 어느 자리든 30일 · 어려움 = 높은 자리(isHighSpot)에서 45일. 상한(받침 높이)도 걸음 안에서 걸린다.
         (10-23 하네스 shop71 g — 상한만 보고 냈더니 sc_pot 8/8 기한 지남: 막 뿌리낸 0.1m 줄기에 «1m · 45일») */
    if (spots && top && typeof R.isHighSpot === 'function') {
      const season = seasonOf((S.day ?? 0) + ((S.sim && Number.isFinite(S.sim.yearDay0)) ? S.sim.yearDay0 : 0));
      const seen = new Map();
      const reach = (s, days) => {
        const k = `${s.dropM.toFixed(2)}|${s.dli.toFixed(1)}|${days}`;
        if (seen.has(k)) return seen.get(k);
        const p = JSON.parse(JSON.stringify(top.plant));
        let L = null;
        try { for (let d = 0; d < days; d++) R.stepDay(p, { dli: s.dli, season, dropM: s.dropM }); L = R.summary(p).lengthM; } catch { L = null; }
        seen.set(k, L);
        return L;
      };
      for (const s of spots) {
        if (!Number.isFinite(s.dli)) continue;
        const hi = R.isHighSpot(s.dropM);
        if (hi) out.scHighN += 1;
        const n = reach(s, SJ.tiers.normal.days);
        if (Number.isFinite(n) && (out.scReachN == null || n > out.scReachN)) out.scReachN = n;
        if (hi) { const h = reach(s, SJ.tiers.hard.days); if (Number.isFinite(h) && (out.scReachH == null || h > out.scReachH)) out.scReachH = h; }
      }
    }
  }
  if (speciesKnown(CAL)) {
    const R = speciesRules();
    const flat = sp.filter(q => q.species === CAL && !caInCare(q) && !q.listing).filter(q => { const s = R.summary(q.plant); return s.leaves > 0 && s.curled === 0; });
    out.caFit = spots && typeof R.spotFit === 'function' ? spots.filter(s => Number.isFinite(s.dli) && R.spotFit(CAL, s.dli) === 'fit').length : 0;
    out.ca_pot = flat.length - openOf('ca_pot') > 0 && out.caFit > 0;
    out.caMaxLeaves = Math.max(0, ...flat.map(q => R.summary(q.plant).leaves));
  }
  return out;
}

/* 그 판이 지금 낼 수 있는 kind 들 — ctx.cutOpen: 오늘 «문에 안 막힌» 모주 자를 마디 수(loop §cutOpenCountOf · S.cutOpenToday) */
export function shopSources(S, ctx = {}) {
  const cuts = (S.cuttings || []).filter(c => c && c.status !== 'dead');
  const est = cuts.filter(c => c.status === 'established');
  const cutOpen = Number.isFinite(ctx.cutOpen) ? ctx.cutOpen : ((S.cutOpenToday && S.cutOpenToday.n) || 0);
  const sp = speciesPotsOf(S);
  /* ★ 2026-10-24 D82 ③ — 화분 variegated 는 «무늬종 광량 문턱(×1.4) 스위치»라 늘 false 다(첫 몬스테라 normal 고정) → 이 칸으로 «무늬 잎이 있나»를
       읽으면 늘 거짓이었다. 모주에 무늬 잎이 있나는 loop 가 생장 정본(leafStats)에서 읽어 ctx.motherVarie 로 넘긴다 */
  const varieSource = cuts.some(c => c.varieFromCut) || !!ctx.motherVarie;
  /* ★ 2026-10-10 («가게 사람» 판 — 맞춤 몫 18% · 기한 지남이 전부 몬스테라 삽수) — **보낼 수 있는 수만큼만** 주문을 연다:
       삽수 = 지금 보낼 수 있는 뿌리낸 삽수(안 올린 것) + 오늘 자를 마디가 있으면 하나(기한 21~45일 안에 뿌리내림 12일) − 이미 걸린 삽수 주문.
       «잎 2장 이상»은 그런 삽수가 지금 있을 때만. 키운 그루 주문도 보낼 그루 수 − 걸린 그루 주문. (plan §2-3 «할 수 있는 것만»을 수로) */
  const openOf = k => ((S.jobShop && S.jobShop.orders) || []).filter(o => o && o.kind === k).length;
  const cutReady = cuts.filter(c => ['rooted', 'node'].includes(c.status) && !c.listing);
  const cutCap = cutReady.length + (cutOpen > 0 ? 1 : 0) - openOf('monstera_cutting');
  const potCap = est.filter(c => !c.listing).length - openOf('monstera_pot');
  /* 새 두 종도 같은 자 — 지금 보낼 수 있는 그루(잎 있음 · 살 수 있음) − 걸린 주문 · 구근은 손에 든 것(찾은 구근 + 산 재고) − 걸린 주문 */
  const ppReady = sp.filter(q => q.species === 'pink_princess' && !q.care && q.plant && q.plant.viable !== false && (q.plant.leaves || []).length > 0);
  const alReady = sp.filter(q => alAwake(q) && !q.care);
  const cormHeld = ((S.species && S.species.corms) || []).length + ((S.shop && S.shop.stock && S.shop.stock.al_corm) || 0);
  const s2 = species2Sources(S, sp, ctx, openOf);
  return {
    ...s2,
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
    /* ★ 철은 빛과 같은 달력으로 — 게임 0일 = 연중 yearDay0 일(여름 45일째 · tutorial §yearDay0Of · light_adapter §skyFor).
         빼먹으면 135일 어긋나 «겨울 가드»가 봄·여름에 걸린다(가게 사람 판: 빛은 가을인데 가드는 봄으로 셈) */
    yd0: (S.sim && Number.isFinite(S.sim.yearDay0)) ? S.sim.yearDay0 : 0,
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
const seasonAtSrc = (src, plus = 0) => seasonOf((src.day ?? 0) + (src.yd0 || 0) + plus);
const winterIn = (src, tier) => { const n = SJ.tiers[tier] ? SJ.tiers[tier].days : 0; return seasonAtSrc(src) === 'winter' || seasonAtSrc(src, n) === 'winter'; };
const growable = (src, tier) => !winterIn(src, tier) || src.lamps >= 2;
function needFor(kind, tier, src, u = 0) {
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
  /* ★ 10-10 총괄 ②(plan-shop-spec §13) — AL «잎 n장 이상»은 **어려움 칸(45일 · ×1.6)** 으로 — 보통 30일로는 잎 간격 28~33일이라
       가게 사람 판 29/119 가 기한을 넘겼다. AL 은 «철(기다림)»을 가르치는 식물 — 긴 기한이 결에 맞다. 무늬 AL 이 있으면 어려움 칸을 둘이 나눈다(u) */
  if (kind === 'al') {
    if (tier !== 'hard') return null;
    const autumnOk = seasonAtSrc(src) !== 'autumn' || src.lamps >= 1;
    const leaves = (src.al2 || (growable(src, tier) && autumnOk)) ? { leaves: 2 } : null;
    const grade = src.varieAL ? { grade: 'sanban' } : null;
    return leaves && grade ? (u < 0.5 ? leaves : grade) : (leaves || grade);
  }
  if (kind === 'al_corm') return tier === 'easy' ? {} : null;
  /* ★ D71 — 새 두 종(명세 §2). «자람이 드는» 조건(마디 둘로 키움 · 줄기 길이 · 잎 하나 더)은 겨울 가드를 그대로 받는다 */
  if (kind === 'sc_cutting') {
    if (tier === 'easy') return {};
    if (tier === 'normal') return (src.sc2 || (src.scGrownN > 0 && growable(src, tier))) ? { nodes: 2 } : null;
    return null;
  }
  if (kind === 'sc_pot') {
    /* 보통 = 지금 가장 긴 줄기 + 한 칸 · 어려움 = «높은 자리에서만 닿는 길이»(높은 자리가 하나라도 있을 때만) — 둘 다 «기한 안에 닿는» 것만(scReachN · scReachH) */
    if (!growable(src, tier) || !Number.isFinite(src.scStep)) return null;
    if (tier === 'normal') {
      if (!Number.isFinite(src.scReachN)) return null;
      const L = src.scMaxLen + src.scStep; return L <= src.scReachN + 1e-9 ? { lengthM: Math.floor(L * 1000) / 1000 } : null;
    }
    /* ★ D76 — 어려움은 곁줄 sc_hang 과 같은 결: «높은 자리에 놓인» 줄기여야 맞는다(high) */
    if (tier === 'hard') {
      if (!Number.isFinite(src.scReachH) || !Number.isFinite(src.scLongM)) return null;
      const L = Math.max(src.scLongM, src.scMaxLen + src.scStep);
      return L <= src.scReachH + 1e-9 ? { lengthM: Math.floor(L * 1000) / 1000, high: true } : null;
    }
    return null;
  }
  if (kind === 'ca_pot') {
    if (tier === 'normal') return { leaves: Math.max(1, src.caMaxLeaves) };
    if (tier === 'hard') return growable(src, tier) ? { leaves: src.caMaxLeaves + 1, flatDays: SPECIES2.caFlatDays } : null;
    return null;
  }
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
    const u = u01(seed, k0 * 31 + t, 17);
    const tiers = ['easy', 'normal', 'hard'].filter(x => needFor(kind, x, src, u));
    if (!tiers.length) continue;
    const tier = pick(tiers, u01(seed, k0 * 31 + t, 13));
    return { kind, tier, need: needFor(kind, tier, src, u) };
  }
  return null;
}
/* ★ D71 — special 손님(sc_seeker · ca_owner)은 주문 손님 고르기에서 뺀다 — 그 사건(sc_ask · ca_care) 때만(plan shop_customers §_doc_special) */
const specialCustomer = ev => shopCustomers().find(c => c && c.special === ev) || { id: ev, ko: '손님', ask: '', thanks: '' };
function pickCustomer(S, { first = false } = {}) {
  const list = shopCustomers().filter(c => c && !c.special);
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
  if (o.need && o.need.nodes) return `마디 ${o.need.nodes}개 이상 ${k}`;
  if (o.need && o.need.lengthM && o.need.high) return `높은 자리에 걸려 줄기 ${Math.round(o.need.lengthM * 100)}cm 이상 늘어진 ${k}`;
  if (o.need && o.need.lengthM) return `줄기 ${Math.round(o.need.lengthM * 100)}cm 이상 ${k}`;
  if (o.need && o.need.leaves && o.need.flatDays) return `잎 ${o.need.leaves}장 이상 · 한 달 내내 말린 잎이 없는 ${k}`;
  if (o.need && o.need.leaves) return `잎 ${o.need.leaves}장 이상 ${k}`;
  return k;
}
const customerOf = id => shopCustomers().find(c => c.id === id) || { id, ko: id, ask: '', thanks: '' };
function orderNewEvent(o) {
  const c = customerOf(o.customerId);
  return { id: 'order_new', ko: `${c.ko} — ${c.ask}`, orderId: o.id, customerId: o.customerId, want: orderWantKo(o), dueOn: o.dueOn, kind: o.kind, tier: o.tier };
}

/* 가진 새 종 수 — 그루(PP·AL · 심은 구근은 AL 그루의 구근 단계) + 가방 구근 + 산 재고(구근 · PP 어린 그루) */
export function speciesHeldCount(S) {
  const st = (S && S.shop && S.shop.stock) || {};
  return speciesPotsOf(S).length + (((S && S.species && S.species.corms) || []).length) + (st.al_corm || 0) + (st.pp_young || 0);
}
/* ── 가게 첫날 ─────────────────────────────── 투룸으로 옮긴 그날 · 주문판 + 첫 주문(바로 맞출 수 있는 쉬움 하나) */
export function openShop(S, ctx = {}) {
  const J = jobShopOf(S), day = S.day ?? 0;
  if (J.openedOn != null) return { events: [] };
  J.openedOn = day;
  const ev = [{ id: 'shop_open', ko: '창 옆에 작은 주문판을 걸었습니다' }];   /* 10-24 plan(c02bb033) — 판 자리 tworoom-hang-order 는 뒷벽 창 옆(game.html 기록 줄과 같은 말) */
  /* ★ 10-10 총괄 (가) «가게는 새 두 종과 함께» — 가진 새 종(PP·AL 그루 · 심은 구근 · 가방 구근 · 산 재고)이 0 이면 몬이가 구근을 권한다(plan shopNoSpecies · 말만) */
  /* ppInShop — PP 어린 그루가 지금 상점에 있나(교환을 두 번 거절한 판 · species §speciesShopOpen) — 있으면 plan 이 둘 다 권하는 줄(shopNoSpeciesPP)로 간다 */
  if (speciesHeldCount(S) === 0) { let ppInShop = false; try { ppInShop = !!speciesShopOpen(S, 'pp_young'); } catch { ppInShop = false; } ev.push({ id: 'shop_no_species', ppInShop }); }
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
  { const end = shopEndingStep(S, J, day); if (end) out.events.push(end); }   /* D75 — 아침 먼저 */
  out.events.push(...species2Step(S, J, day));
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
  /* ★ D79(총괄) — 주문 가뭄: 오늘 끝에 열린 주문이 0건이면 하루 더 · 하나라도 있으면 0 */
  J.dryRun = J.orders.length ? 0 : (J.dryRun || 0) + 1;
  out.dryDays = J.dryRun;
  return out;
}

/* ── ★ 2026-10-23 D71 새 두 종이 들어오는 날 ─────────────────────────────── stepShopJob 이 날마다(새 종의 하루는 loop 가 이미 돌렸다)
   sc_ask   단골 5 — «찾는 손님»이 묻고 간다 → 상점에 «스킨답서스 줄기 삽수» 진열(species §speciesShopOpen · shop CATALOG sc_cutting)
   ca_care  단골 8 — «맡기는 손님»이 잎이 다 말린 칼라테아를 맡긴다 → 가방에(q.care · 못 판다 · 주문에 못 낸다)
   ca_saved 맡은 그루의 말린 잎이 0 인 날 — 그 그루가 가게 것(q.care 를 걷는다)
   ★ 하루 하나(옛 세이브가 단골 8 이상으로 열려도 sc_ask → 이튿날 ca_care) · 규칙에 그 종이 없으면 안 난다(기다린다)
   ★ 이정표 보상이 아니다(명세 §7) — 단골 수는 «손님 사정»의 때일 뿐 · special 손님은 단골로 안 센다 */
function species2Step(S, J, day) {
  const ev = [], n = J.regulars.length, T = SJ.species2;
  if (J.caPotId && J.caSavedOn == null && speciesKnown(SPECIES2.ca)) {
    const q = speciesPotOf(S, J.caPotId);
    const s = q && caInCare(q) ? speciesRules().summary(q.plant) : null;
    if (s && s.leaves > 0 && s.curled === 0) {
      q.care = null; J.caSavedOn = day;
      const c = specialCustomer('ca_care');
      ev.push({ id: 'ca_saved', ko: `${c.ko} — ${c.thanks}`, customerId: c.id, potId: q.id });
    }
  }
  if (J.scAskOn == null && n >= T.scAt && speciesKnown(SPECIES2.sc)) {
    J.scAskOn = day;
    const c = specialCustomer('sc_ask');
    ev.push({ id: 'sc_ask', ko: `${c.ko} — ${c.ask}`, customerId: c.id });
  } else if (J.caCareOn == null && J.scAskOn != null && J.scAskOn < day && n >= T.caAt && speciesKnown(SPECIES2.ca)) {
    const c = specialCustomer('ca_care');
    const q = addSpeciesPot(S, SPECIES2.ca, { origin: 'care', newPlant: { curled: 'all' }, care: { customerId: c.id, since: day } });
    J.caCareOn = day; J.caPotId = q.id;
    ev.push({ id: 'ca_care', ko: `${c.ko} — ${c.ask}`, customerId: c.id, potId: q.id });
  }
  return ev;
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
      if (!q || q.species !== sp || q.care) continue;   /* 맡은 그루(B)는 주문에 못 낸다 */
      if (q.plant && q.plant.viable === false) continue;
      const lv = (q.plant.leaves || []).length;
      if (!lv) continue;
      if (need.leaves && lv < need.leaves) continue;
      if (rankNeed && gradeRankOfSpecies(q) < rankNeed) continue;
      out.push({ ref: { type: 'species', id: q.id }, ko: `${ORDER_KIND_KO[o.kind]} ${q.id} · 잎 ${lv}장${speciesPlaced(q) ? '' : '(가방)'}`, baseWon: speciesPriceOf(q).won });
    }
  } else if (o.kind === 'sc_cutting' || o.kind === 'sc_pot' || o.kind === 'ca_pot') {
    /* ★ D71 — 줄기 삽수 = 물꽂이 중인 스킨답서스(뿌리 전) · 그루 = 뿌리낸 것 · 칼라테아 = 가게 것(맡은 그루 아님)이고 말린 잎 0 */
    const want = o.kind === 'ca_pot' ? SPECIES2.ca : SPECIES2.sc;
    const R = speciesKnown(want) ? speciesRules() : null, day = S.day ?? 0;
    for (const q of R ? speciesPotsOf(S) : []) {
      if (!q || q.species !== want || q.listing || q.care) continue;   /* 맡은 그루(A 칼라테아 · B 돌봄) */
      if (o.kind === 'sc_cutting' ? !scRooting(q) : scRooting(q)) continue;
      const s = R.summary(q.plant);
      if (need.nodes && !(s.nodes >= need.nodes)) continue;
      if (need.lengthM && !(s.lengthM >= need.lengthM - 1e-9)) continue;
      if (need.high && !scAtHighSpot(q)) continue;   /* D76 — 높은 자리에 놓인 줄기만 */
      if (o.kind === 'ca_pot') {
        if (!(s.leaves > 0) || s.curled > 0) continue;
        if (need.leaves && s.leaves < need.leaves) continue;
        if (need.flatDays && !(Number.isFinite(q.flatSince) && day - q.flatSince >= need.flatDays)) continue;
      }
      const ko = o.kind === 'ca_pot' ? `칼라테아 ${q.id} · 잎 ${s.leaves}장` : o.kind === 'sc_pot' ? `스킨답서스 ${q.id} · 줄기 ${Math.round(s.lengthM * 100)}cm` : `줄기 삽수 ${q.id} · 마디 ${s.nodes}개`;
      out.push({ ref: { type: 'species', id: q.id }, ko: ko + (speciesPlaced(q) ? '' : '(가방)'), baseWon: speciesPriceOf(q).won });
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
    shopDueSoonest: open.length ? Math.min(...open.map(o => o.dueOn - day)) : null,
    /* ★ D71 곁줄 ca_unfurl 칸(plan) — 맡은 칼라테아가 있고 아직 안 펴짐 · 잎이 다 펴져 가게 것이 됐다(가게 판이 아니면 null) */
    caCareOpen: J ? (J.caPotId != null && J.caSavedOn == null) : null,
    caSaved: J ? J.caSavedOn != null : null,
    /* ★ D75(plan 명세 §5) — 진로 끝맺음 날(없으면 null) · 지금 진로 */
    jobsEnded: { shop: shopEndedOn(S), care: (S && S.story && S.story.jobs && S.story.jobs.care && Number.isFinite(S.story.jobs.care.endedOn)) ? S.story.jobs.care.endedOn : null, breed: null },
    jobActive: job ? job.id : null
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
