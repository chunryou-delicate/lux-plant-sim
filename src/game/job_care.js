/* src/game/job_care.js — **진로 «식물 돌봄»** (core · 2026-10-24 · 총괄 D72 · D73 · plan-care-career-spec-20261023 §8 core 몫)
   ------------------------------------------------------------------
   엔딩(집을 샀다) 뒤 진로 고르기 → [돌봄을 시작한다] → 산 투룸(가게와 같은 이사) → 창 옆 맡김판.
   손님이 «고장 난 화분»을 맡긴다(실마리는 손님 말 한 줄) → 자취생이 자리·가위·높이·기다림으로 고친다 → 나으면 [돌려준다](수고비) ·
   기한 날엔 손님이 찾아간다(나았으면 수고비 · 못 고쳤으면 그냥 — 벌 없음 · 화분은 안 죽는다).
   ★ 원칙(plan §0): **새 값표를 안 만든다**(때·기한·웃 몫은 가게 수 그대로 — SHOP_JOB) · **못 고치는 맡김을 안 낸다**(그 판 방에 고칠 자리가 오늘 있는 고장만 ·
     원천 판정 한 곳 §careSources) · **지금 규칙이 내는 고장만**(고장 여덟 · data/balance/care_problems.json — plan 이 쓰고 여기는 읽기만).
   ★ 그루는 새 종 판(S.species.pots · species_growth)에 산다 — 맡은 화분은 q.care = { customerId, since, requestId }(A 판 «맡은 칼라테아»를 넷으로 넓힘):
     못 판다 · 주문에 못 낸다 · 가위는 된다(PP 고침이 가위 · 잘라 낸 끝은 자취생 것).
   상태: story.job = { id:'care', since } · story.jobs.care = { since, endedOn } ·
         S.jobCare = { requests, nextDay, saved, expired, kinds, milestones, seq, openedOn, served, signOnDay }
         request = { id, customerId, problem, potId, openedOn, dueOn, tier, savedOn, stuckSaid, births0, lengthM0, fee }
   사건(turn.events · 대사는 plan dialogue): job_start{job:'care'} · care_open · care_new{problem} · care_stuck{problem} · care_saved{problem} ·
         care_return{problem, first} · care_expired · care_milestone{n} · care_ending · care_cut_gift
   ⚠ 손님 말은 대사가 아니라 기록 줄 «{손님 ko} — {실마리}»(plan — 대사는 틀 글자를 못 채움) */
import { SHOP_JOB, shopCustomers, jobOf, jobHistoryOf } from './job_shop.js';
import { speciesRules, speciesKnown, addSpeciesPot, speciesPotOf, speciesPotsOf, speciesPriceOf, speciesPlaced, SPECIES_GAME, speciesOf } from './species.js';
import { u01 } from '../growth/species_growth.js';
import { seasonOf } from '../engine/weather.js';

let PROBLEMS = null;
try { const m = await import('../../data/balance/care_problems.json', { with: { type: 'json' } }); PROBLEMS = m.default; } catch { PROBLEMS = null; }
export function installCareProblems(p) { PROBLEMS = p || null; }   /* 검사가 표를 갈아 끼울 때 */
export const careProblems = () => (PROBLEMS && Array.isArray(PROBLEMS.problems) ? PROBLEMS.problems : []);
export const careLines = () => (PROBLEMS && PROBLEMS._lines) || {};
export const careProblemOf = id => careProblems().find(p => p && p.id === id) || null;

/* ⚖ 수 — 가게 수 그대로(plan §2 · §10 ②) · core 가 정한 것만 «⚖ core»(총괄께 보고) */
export const CARE_JOB = Object.freeze({
  orderGap: SHOP_JOB.orderGap,          /* 새 맡김 — 마지막 맡김 뒤 5~9일 중 하루 */
  maxOpen: SHOP_JOB.maxOpen,            /* 열린 맡김 최대 3 */
  days: Object.freeze({ easy: SHOP_JOB.tiers.easy.days, normal: SHOP_JOB.tiers.normal.days, hard: SHOP_JOB.tiers.hard.days }),
  springAfter: 21,                      /* al_winter — 봄 첫날 + 21일(⚖ plan §2-1) */
  /* 수고비 몫 = 가게 웃돈의 «웃» 몫(premium − 1 · plan §2-4) · al_winter(봄)은 보통 몫(⚖ core) */
  feeShare: Object.freeze({ easy: +(SHOP_JOB.tiers.easy.premium - 1).toFixed(2), normal: +(SHOP_JOB.tiers.normal.premium - 1).toFixed(2),
                            hard: +(SHOP_JOB.tiers.hard.premium - 1).toFixed(2), spring: +(SHOP_JOB.tiers.normal.premium - 1).toFixed(2) }),
  feeFloorWon: SPECIES_GAME.cormSellWon,   /* 갓 깬 AL(잎 0~1)은 시세가 0 일 수 있다 → 그 종 상점 값(구근 되파는 값)을 바닥으로(⚖ plan §2-4) */
  stuckDays: 7,                         /* 맡고 7일 나아짐 없으면 몬이 한 줄(⚖ plan §6) */
  newBias: SHOP_JOB.newBias,            /* 아직 맡긴 적 없는 손님 쪽 3:1 */
  milestones: Object.freeze([3, 10, 30]),
  signAt: 10,                           /* 칠판 간판(D73 ③ — 가게 간판 모형 다시 씀 · 진열대 옆 바닥 · plan a3638d7f) */
  ending: Object.freeze({ saved: 30, titleKo: '동네 식물 의사' }),
  /* ⚖ core — 맡을 때 그루 꼴(growth newPlant 칸) */
  plant: Object.freeze({
    caLeaves: Object.freeze([4, 6]),                 /* 칼라테아 잎 수(다 큰 잎 · 다 말림) */
    ppTipPinks: Object.freeze([0.42, 0.95, 0.95, 0.95]),   /* 분홍 잎(≥0.9) 셋 잇달아 — 끝이 시드는 중 · 맨 아래 마디 위를 자르면 산다 */
    ppGreenPinks: Object.freeze([0.38, 0.3, 0.02, 0.0]),   /* 위 둘이 초록(≤0.05) — 분홍 남은 마디(2) 위를 자르고 밝은 데 */
    scFloorDropM: 0.45,                              /* 손님 집 자리 «떨어지는 높이» — 투룸에서 이보다 높은 데는 3~5(다단 선반 윗단 · 걸이 · 계단 윗단) · growth care 표 0.45 판 */
    scPlainNodes: Object.freeze([4, 6]), scPlainTop: 2
  })
});
const CJ = CARE_JOB;

/* ── 상태 ─────────────────────────────── */
export function createJobCareState() {
  return { requests: [], nextDay: null, saved: 0, expired: 0, kinds: {}, milestones: {}, seq: 0, openedOn: null, served: [], signOnDay: null };
}
export function jobCareOf(S) {
  if (!S) throw new TypeError('[돌봄] 상태가 없습니다');
  if (!S.jobCare || typeof S.jobCare !== 'object') S.jobCare = createJobCareState();
  const J = S.jobCare, d = createJobCareState();
  for (const k of Object.keys(d)) if (J[k] === undefined) J[k] = d[k];
  return J;
}
export const isCareJob = S => !!(jobOf(S) && jobOf(S).id === 'care');
export const careEndedOn = S => { const h = S && S.story && S.story.jobs && S.story.jobs.care; return h && Number.isFinite(h.endedOn) ? h.endedOn : null; };

/* ── 진로 고르기 ─────────────────────────────── [돌봄을 시작한다] · 이사(투룸)는 부르는 쪽(oneroom §moveIntoOwnedHome — 가게와 같은 함수) */
export function startCareJob(S) {
  if (!S.story) throw new Error('[돌봄] 스토리 상태가 없습니다');
  if (jobOf(S)) { const e = new Error('[돌봄] 이미 진로를 골랐습니다'); e.tutorialInput = true; throw e; }   /* D73 ① 한 판에 하나 · 바꾸기 없음(바꾸기는 D 판) */
  S.story.job = { id: 'care', since: S.day ?? 0 };
  jobHistoryOf(S);
  jobCareOf(S);
  return { events: [{ id: 'job_start', job: 'care', ko: '진로 — 식물 돌봄을 시작하기로 했습니다' }] };
}

/* ── 그루 판정 ─────────────────────────────── growth summary 로(plan §2-2 «나았다» · growth 회신 10-23) */
const sum = q => speciesRules().summary(q.plant);
export function careHealed(q, req) {
  if (!q || !req) return false;
  const s = sum(q), b0 = Number.isFinite(req.births0) ? req.births0 : 0;
  switch (req.problem) {
    case 'ca_bright': case 'ca_dark': return s.leaves > 0 && s.curled === 0;
    case 'pp_tip': return !!(q.care && q.care.cutSaved);                              /* 자르기가 끝을 살렸다(cutAbove saved · species §cutSpecies 가 적음) */
    case 'pp_green': return s.births > b0 && s.topGrade != null && s.topGrade !== 'green';
    case 'al_dark': case 'al_winter': return s.phase === 'growing';
    case 'sc_floor': return s.births > b0;                                            /* 줄기가 다시 내려온다 = 새 마디 */
    case 'sc_plain': return s.births > b0 && s.topMarble === true;
    default: return false;
  }
}

/* ── 원천 — «못 고치는 맡김을 안 낸다» · 이 판단은 여기 한 곳 ─────────────────────────────── ctx.spots7 = 방 자리 [{ dropM, dli }] — dli 는 «그 자리 7일 평균»
     (총괄 D80 ① · growth 1584판: 그날 DLI 면 헛열림 20 · 놓침 174 → 7일 평균 6 · 66 · loop §careSpotsOf 가 오늘부터 7일 빛을 같은 날씨로 걸어 평균)
   고장마다 «고칠 자리가 오늘 하나라도 있나»를 그 고장으로 맡을 그루(본보기) 문턱으로 본다(growth spotFitOf — AL 무늬 ×1.4 까지 그 그루 문턱).
   못 세면(자리 모름) 자리가 드는 고장은 안 낸다. 기한 안에 겨울이 끼면 «자람이 드는» 고장은 등 2 이상(가게 §11 결) */
const seasonAt = (S, plus = 0) => seasonOf((S.day ?? 0) + ((S.sim && Number.isFinite(S.sim.yearDay0)) ? S.sim.yearDay0 : 0) + plus);
function dueOf(S, p) {
  const day = S.day ?? 0;
  if (p.tier === 'spring') {
    for (let d = 1; d <= 400; d++) if (seasonAt(S, d) === 'spring' && seasonAt(S, d - 1) !== 'spring') return day + d + CJ.springAfter;
    return day + 90 + CJ.springAfter;
  }
  return day + (CJ.days[p.tier] || CJ.days.normal);
}
function samplePlant(S, p, salt) {
  const R = speciesRules(), seed = ((S.sim && S.sim.seed) >>> 0) ^ Math.imul(0x2f6b + salt, 2654435761);
  const P = CJ.plant, pick = (lohi, k) => lohi[0] + Math.min(lohi[1] - lohi[0], Math.floor(u01(seed, k, 7) * (lohi[1] - lohi[0] + 1)));
  switch (p.id) {
    case 'ca_bright': case 'ca_dark': return R.newPlant('calathea', { seed, leaves: pick(P.caLeaves, 1), curled: 'all' });
    case 'pp_tip': return R.newPlant('pink_princess', { seed, pinks: [...P.ppTipPinks] });
    case 'pp_green': return R.newPlant('pink_princess', { seed, pinks: [...P.ppGreenPinks] });
    case 'al_dark': case 'al_winter': return R.newPlant('alocasia_frydek', { seed, origin: 'shop', form: 'asleep', varie: null, finds: 2 });   /* finds 2 = 평생 상한 — 맡은 동안 구근을 안 찾는다 */
    case 'sc_floor': return R.newPlant('scindapsus', { seed, form: 'atFloor', dropM: P.scFloorDropM });
    case 'sc_plain': return R.newPlant('scindapsus', { seed, form: 'rooted', nodes: pick(P.scPlainNodes, 2), plainTop: P.scPlainTop });
    default: throw new Error(`[돌봄] 모르는 고장: ${p.id}`);
  }
}
function guardOk(S, p, ctx) {
  const R = speciesRules();
  if (!speciesKnown(p.species)) return false;
  const spots = Array.isArray(ctx.spots7) ? ctx.spots7.filter(s => s && Number.isFinite(s.dli)) : null;
  const lamps = Number.isFinite(ctx.lamps) ? ctx.lamps : ((S.lamps && S.lamps.count) || 0);
  const n = p.tier === 'spring' ? 0 : (CJ.days[p.tier] || CJ.days.normal);
  const winterIn = seasonAt(S) === 'winter' || seasonAt(S, n) === 'winter';
  const growNeed = !['pp_tip', 'al_winter'].includes(p.id);
  if (growNeed && winterIn && lamps < 2) return false;
  if (!growNeed) return true;                                 /* 가위 · 기다림 — 자리 없이 고친다 */
  if (!spots || typeof R.spotFitOf !== 'function') return false;
  const pl = samplePlant(S, p, 0);
  const fit = s => { try { return R.spotFitOf(pl, s.dli); } catch { return 'dark'; } };
  switch (p.id) {
    case 'ca_bright': case 'ca_dark': return spots.some(s => ['fit', 'slow'].includes(fit(s)));
    case 'pp_green': return spots.some(s => ['fit', 'over'].includes(fit(s)));
    case 'al_dark': return seasonAt(S) !== 'winter' && spots.some(s => fit(s) !== 'dark');
    case 'sc_plain': case 'sc_floor': {
      const L0 = sum({ plant: pl }).lengthM;
      return spots.some(s => Number.isFinite(s.dropM) && R.scStemCapM(s.dropM) > L0 + 1e-9 && (p.id === 'sc_floor' ? fit(s) !== 'dark' : ['fit', 'over'].includes(fit(s))));
    }
    default: return false;
  }
}
/* 그 판이 오늘 낼 수 있는 고장 — 열린 살린 수 · 철 · 가드 */
export function careSources(S, ctx = {}) {
  const J = jobCareOf(S), se = seasonAt(S);
  return careProblems().filter(p => p && (p.unlockAtSaved || 0) <= J.saved && (!Array.isArray(p.seasons) || p.seasons.includes(se)) && guardOk(S, p, ctx));
}
export { guardOk as careGuardOk };   /* 검사 */

/* ── 맡김 하나 ─────────────────────────────── */
function pickCustomer(S) {
  const list = shopCustomers().filter(c => c && !c.special);
  if (!list.length) return null;
  const J = jobCareOf(S);
  const busy = new Set(J.requests.map(r => r.customerId));   /* 지금 맡긴 손님은 또 안 맡긴다 */
  const pool = list.filter(c => !busy.has(c.id));
  if (!pool.length) return null;
  const w = pool.map(c => J.served.includes(c.id) ? 1 : CJ.newBias);
  const tot = w.reduce((a, b) => a + b, 0);
  let u = u01(((S.sim && S.sim.seed) >>> 0) ^ 0xca7e, J.seq + 1, 23) * tot;
  for (let i = 0; i < pool.length; i++) { u -= w[i]; if (u < 0) return pool[i]; }
  return pool[pool.length - 1];
}
function pushRequest(S, p, cust) {
  const J = jobCareOf(S), day = S.day ?? 0;
  J.seq += 1;
  const id = `cr_${String(J.seq).padStart(3, '0')}`;
  const plant = samplePlant(S, p, J.seq);
  const q = addSpeciesPot(S, p.species, { origin: 'care', plant, care: { customerId: cust.id, since: day, requestId: id } });
  const s = sum(q);
  const req = { id, customerId: cust.id, problem: p.id, potId: q.id, openedOn: day, dueOn: dueOf(S, p), tier: p.tier,
                savedOn: null, stuckSaid: false, births0: s.births || 0, lengthM0: Number.isFinite(s.lengthM) ? s.lengthM : null };
  J.requests.push(req);
  if (!J.served.includes(cust.id)) J.served.push(cust.id);
  return { id: 'care_new', ko: `${cust.ko} — ${p.clue || p.ko}`, problem: p.id, customerId: cust.id, requestId: id, potId: q.id, dueOn: req.dueOn, tier: p.tier };
}
const nextGap = S => { const J = jobCareOf(S), [lo, hi] = CJ.orderGap; return lo + Math.min(hi - lo, Math.floor(u01(((S.sim && S.sim.seed) >>> 0) ^ 0xcafe, J.seq + 5, 29) * (hi - lo + 1))); };
function rollProblem(S, src) {
  if (!src.length) return null;
  const J = jobCareOf(S);
  return src[Math.min(src.length - 1, Math.floor(u01(((S.sim && S.sim.seed) >>> 0) ^ 0xbeef, J.seq + 1, 31) * src.length))];
}

/* ── 돌봄 첫날 ─────────────────────────────── 맡김판 + 첫 맡김(오늘 바로 고칠 수 있는 쉬움 하나 — ca_bright → al_dark → pp_tip) */
export function openCare(S, ctx = {}) {
  const J = jobCareOf(S), day = S.day ?? 0;
  if (J.openedOn != null) return { events: [] };
  J.openedOn = day;
  const ev = [{ id: 'care_open', ko: '창 옆에 맡김판을 걸었습니다' }];
  const src = careSources(S, ctx);
  const first = ['ca_bright', 'al_dark', 'pp_tip'].map(id => src.find(p => p.id === id)).find(Boolean);
  const cust = first ? pickCustomer(S) : null;
  if (first && cust) ev.push(pushRequest(S, first, cust));
  J.nextDay = day + nextGap(S);
  return { events: ev };
}

/* ── 하루 ─────────────────────────────── loop.nextDay 가 부른다(돌봄 판 · 산 투룸) · 새 종의 하루가 먼저 돈 뒤 */
export function stepCareJob(S, ctx = {}) {
  const out = { events: [] };
  if (!isCareJob(S) || !(S.home && S.home.room === SHOP_JOB.ownedHome.roomId)) return out;
  const J = jobCareOf(S), day = S.day ?? 0;
  if (J.openedOn == null) return { events: openCare(S, ctx).events };
  { const e = careEndingStep(S, J, day); if (e) out.events.push(e); }   /* 아침 먼저 */
  for (const r of [...J.requests]) {
    const q = speciesPotOf(S, r.potId);
    if (!q) { J.requests = J.requests.filter(x => x !== r); continue; }   /* 그루가 사라졌다(있을 수 없는 길) — 맡김도 걷는다 */
    if (r.savedOn == null) {
      let healed = false; try { healed = careHealed(q, r); } catch { healed = false; }
      if (healed) { r.savedOn = day; out.events.push({ id: 'care_saved', ko: `맡은 화분이 나았습니다 — 돌려줄 수 있습니다`, problem: r.problem, requestId: r.id, potId: q.id }); }
      else if (!r.stuckSaid && day - r.openedOn >= CJ.stuckDays) { r.stuckSaid = true; out.events.push({ id: 'care_stuck', problem: r.problem, requestId: r.id }); }
    }
    if (day > r.dueOn) {
      if (r.savedOn != null) out.events.push(...settle(S, r, { auto: true }).events);   /* 나았는데 안 돌려줬으면 손님이 수고비를 내고 받아 간다(숨은 손해 없음) */
      else {
        const c = customerOf(r.customerId);
        removePot(S, r.potId); J.requests = J.requests.filter(x => x !== r); J.expired += 1;
        out.events.push({ id: 'care_expired', ko: `${c.ko} — ${careLines().collected || '화분을 찾아갔다.'}`, customerId: r.customerId, problem: r.problem, requestId: r.id });
      }
    }
  }
  if (J.nextDay != null && day >= J.nextDay) {
    if (J.requests.length < CJ.maxOpen) {
      const p = rollProblem(S, careSources(S, ctx));
      const cust = p ? pickCustomer(S) : null;
      if (p && cust) out.events.push(pushRequest(S, p, cust));
    }
    J.nextDay = day + nextGap(S);
  }
  return out;
}
const customerOf = id => shopCustomers().find(c => c.id === id) || { id, ko: id };
function removePot(S, potId) { const sp = speciesOf(S); sp.pots = sp.pots.filter(q => q && q.id !== potId); }

/* ── 수고비 · 돌려주기 ─────────────────────────────── 수고비 = 돌려줄 때 그 그루 시세 × 웃 몫(바닥 = 구근 값) · 돈은 부르는 쪽이 shop §creditShopOrder 로 */
export function careFeeOf(S, req) {
  const q = speciesPotOf(S, req.potId);
  const base = q ? speciesPriceOf(q).won : 0;
  return Math.max(CJ.feeFloorWon, Math.round(base * (CJ.feeShare[req.tier] ?? CJ.feeShare.normal)));
}
function settle(S, r, { auto = false } = {}) {
  const J = jobCareOf(S), day = S.day ?? 0, c = customerOf(r.customerId);
  const won = careFeeOf(S, r);
  removePot(S, r.potId);
  J.requests = J.requests.filter(x => x !== r);
  J.saved += 1; J.kinds[r.problem] = (J.kinds[r.problem] || 0) + 1;
  const events = [{ id: 'care_return', ko: `${c.ko} — ${careLines().returned || '화분을 받아 갔다.'}`, problem: r.problem, customerId: r.customerId,
                    requestId: r.id, won, first: J.saved === 1, auto }];
  for (const n of CJ.milestones) if (J.saved >= n && J.milestones[n] == null) {
    J.milestones[n] = day;
    events.push({ id: 'care_milestone', ko: `살린 화분 ${n}`, n });
    if (n === CJ.signAt && J.signOnDay == null) J.signOnDay = day;
  }
  return { won, events };
}
/* [돌려준다] — 나은 맡김만 · 반환 { won, events } (돈은 부르는 쪽이 넣는다 — 기한 날 저절로 받아 간 수고비도 events 의 won) */
export function returnCare(S, requestId) {
  const J = jobCareOf(S);
  const r = J.requests.find(x => x.id === requestId);
  if (!r) { const e = new Error('그 맡김을 못 찾았습니다'); e.tutorialInput = true; throw e; }
  if (r.savedOn == null) { const e = new Error('아직 낫지 않았습니다 — 나으면 돌려줄 수 있습니다'); e.tutorialInput = true; throw e; }
  return settle(S, r);
}
/* 맡은 PP 를 잘랐다(species §cutSpecies 가 부른다) — 끝을 살렸으면 pp_tip 이 나음 · 잘라 낸 끝은 자취생 것(기록 줄) */
export function noteCareCut(S, q, r) {
  if (!q || !q.care) return null;
  if (r && r.saved) q.care.cutSaved = true;
  return { id: 'care_cut_gift', ko: careLines().cutGift || '잘라 낸 건 가져도 된대.' };
}

/* ── 끝맺음 · 칭호 ─────────────────────────────── 살린 30 다음 날 아침 한 번(가게 shop_ending 결) */
function careEndingStep(S, J, day) {
  const at = J.milestones[CJ.ending.saved];
  if (at == null || !(day > at)) return null;
  const h = jobHistoryOf(S).care;
  if (!h || h.endedOn != null) return null;
  h.endedOn = day;
  return { id: 'care_ending', ko: `칭호 — ${CJ.ending.titleKo}`, title: CJ.ending.titleKo, saved: J.saved, kinds: Object.keys(J.kinds).length };
}
export function careHeadOf(S) {
  if (!isCareJob(S)) return null;
  const J = jobCareOf(S), title = careEndedOn(S) != null ? CJ.ending.titleKo : null;
  return { title, saved: J.saved, ko: `${title || '식물 돌봄'} · 살린 화분 ${J.saved}` };
}

/* ── 스냅샷(plan quest.js 돌봄 사슬 · null = 모른다) ─────────────────────────────── */
export function jobCareSnapshot(S) {
  const J = S && S.jobCare, day = S ? S.day : 0;
  const reqs = J && Array.isArray(J.requests) ? J.requests : [];
  return {
    careOpen: J ? reqs.length : null,
    careReady: J ? reqs.filter(r => r.savedOn != null).length : null,
    careSaved: J ? J.saved : null,
    careKinds: J ? Object.keys(J.kinds || {}).length : null,
    careDueSoonest: reqs.length ? Math.min(...reqs.map(r => r.dueOn - day)) : null
  };
}

/* ── 세이브 ─────────────────────────────── */
export function packJobCare(J) { return J ? JSON.parse(JSON.stringify(J)) : null; }
export function unpackJobCare(raw) {
  const J = createJobCareState();
  if (!raw || typeof raw !== 'object') return J;
  for (const k of Object.keys(J)) if (raw[k] !== undefined) J[k] = raw[k];
  if (!Array.isArray(J.requests)) J.requests = [];
  if (!Array.isArray(J.served)) J.served = [];
  if (!J.kinds || typeof J.kinds !== 'object') J.kinds = {};
  if (!J.milestones || typeof J.milestones !== 'object') J.milestones = {};
  return J;
}
