/* src/game/job_switch.js — **진로 바꾸기 · 마지막 덮개** (core · 2026-10-24 · D 나머지 · 총괄 D75 · D83 · D85 · D86 · plan-career-endings-spec-20261023 §2 · §11)
   ------------------------------------------------------------------
   «한 번에 하나만 돈다»(D75 ①②) — 지금 진로의 끝맺음을 본 뒤에만 다른 진로로 옮긴다: 아직 안 해 본 진로 · 끝맺음을 본 진로로 돌아가기.
   이어지는 것(§2-2): 돈 · 그루·삽수·새 종 · 가구 · 등 · 산 투룸(이사 없음 — 여기서 방을 안 건드린다) · 배치 · 칭호 · 기록 · 손님 표.
   새로 시작: 처음 해 보는 진로는 빈 상태 + 그 첫날(openShop · openCare · openBreed — 창 옆 판이 이미 걸렸으면 boardKept) ·
             돌아가면 옛 상태 그대로(첫날 없음 · 기록장은 그날 커서만 세움 — 쉬는 동안 난 잎은 안 적는다).
   멈춤(내려놓은 진로): 새 일 없음 · 걸린 주문·맡김은 기한까지(job_shop §shopRestStep · job_care §careRestStep) · 기록장은 안 적음.
   손님 이음(⚖ plan 권함 §2-2): 처음 해 보는 돌봄의 첫 맡김 손님은 가게 단골에서 · 처음 해 보는 가게의 첫 주문 손님은 돌봄 손님에서(있을 때만).
   마지막 덮개(§2-4): 세 진로 끝맺음을 다 본 판에서 한 번(story.finalCoverOn · 사건 final_cover — 셋째 끝맺음 카드를 닫은 뒤 화면이 부른다).
   글은 data/balance/career_switch.json(plan 이 쓰고 여기는 읽기만).
   사건(turn.events · 대사는 plan): job_start{ job, switched:true, back, from } · shop_open{ boardKept } · care_open{ boardKept } · breed_open ·
         customer_link{ to, customerId }(기록 줄만) · final_cover */
import { JOB_IDS, jobOf, jobHistoryOf, createJobShopState, openShop } from './job_shop.js';
import { createJobCareState, openCare } from './job_care.js';
import { createJobBreedState, openBreed, rebaseBreedCursors } from './job_breed.js';

let SW = null;
try { const m = await import('../../data/balance/career_switch.json', { with: { type: 'json' } }); SW = m.default; } catch { SW = null; }
export function installCareerSwitch(t) { SW = t || null; }   /* 검사가 표를 갈아 끼울 때 */
export const careerSwitchText = () => SW || {};
const fill = (s, o) => String(s == null ? '' : s).replace(/\{(\w+)\}/g, (m, k) => (o && o[k] != null ? String(o[k]) : m));
const inputErr = msg => { const e = new Error(msg); e.tutorialInput = true; return e; };

/* ── 판정 ─────────────────────────────── */
export function jobEndedOn(S, id) {
  const h = S && S.story && S.story.jobs && S.story.jobs[id];
  return h && Number.isFinite(h.endedOn) ? h.endedOn : null;
}
export const jobsEndedAll = S => JOB_IDS.every(id => jobEndedOn(S, id) != null);
/* 해 본 진로(이력이 있음) · 아직 안 해 본 진로 */
export const triedJobs = S => JOB_IDS.filter(id => !!(S && S.story && S.story.jobs && S.story.jobs[id]));
export const untriedJobs = S => JOB_IDS.filter(id => !(S && S.story && S.story.jobs && S.story.jobs[id]));
/* 옮길 수 있나 — 진로가 있고 그 진로의 끝맺음을 봤다(§2-1 · 할 일 탭 «진로 바꾸기» 글자가 서는 때) */
export function canSwitchJob(S) { const j = jobOf(S); return !!(j && j.id && jobEndedOn(S, j.id) != null); }
/* 내려놓은 진로 — 해 봤고 지금 진로가 아님(걸린 것을 기한까지 마치는 쪽) */
export function restingJobs(S) { const cur = (jobOf(S) || {}).id || null; return triedJobs(S).filter(id => id !== cur); }
/* 칭호들(끝맺음을 본 진로 · JOB_IDS 차례) — 이름뿐(D59 결) */
export function jobTitles(S) {
  const T = careerSwitchText().jobs || {};
  return JOB_IDS.filter(id => jobEndedOn(S, id) != null).map(id => ({ id, title: (T[id] && T[id].title) || id }));
}

/* ── 진로 카드(바꾸기 화면 · §2-1) ─────────────────────────────── 표: 지금 하는 중 · 끝맺음 봄 · 해 볼 수 있음 */
export function switchCards(S) {
  const T = careerSwitchText(), C = T.cards || {}, M = C.mark || {}, cur = (jobOf(S) || {}).id || null;
  return JOB_IDS.map(id => {
    const J = (T.jobs || {})[id] || {}, ended = jobEndedOn(S, id) != null;
    const mark = id === cur ? 'current' : ended ? 'ended' : 'fresh';
    return { id, ko: J.ko || id, sub: J.cardSub || '', title: J.title || '', mark, markKo: fill(M[mark], { title: J.title || '' }),
             go: id === cur ? null : ended ? (C.back || '돌아간다') : (J.go || '시작한다') };
  });
}

/* ── 옮기기 ─────────────────────────────── 반환 { events, back, from, to, banner }
   ctx — 첫날 함수에 그대로 넘긴다(가게 cutOpen · lamps · spots · 돌봄 spots7 · lamps) + boardKept(창 옆 판이 이미 걸렸나 — 화면이 가구로 본다 · 기본 참) */
export function switchJob(S, toId, ctx = {}) {
  if (!S || !S.story) throw new Error('[진로] 스토리 상태가 없습니다');
  if (!JOB_IDS.includes(toId)) throw inputErr(`[진로] 모르는 진로입니다: ${toId}`);
  const cur = jobOf(S);
  if (!cur || !cur.id) throw inputErr('[진로] 아직 고른 진로가 없습니다 — 진로 고르기에서 고릅니다');
  if (cur.id === toId) throw inputErr('[진로] 지금 하는 진로입니다');
  if (jobEndedOn(S, cur.id) == null) throw inputErr('[진로] 지금 진로의 끝맺음을 본 뒤에 옮길 수 있습니다');
  const T = careerSwitchText(), J = (T.jobs || {})[toId] || {}, day = S.day ?? 0, from = cur.id;
  const hist = jobHistoryOf(S), back = !!hist[toId];
  S.story.job = { id: toId, since: day };
  if (!back) {
    if (toId === 'shop') S.jobShop = createJobShopState();
    else if (toId === 'care') S.jobCare = createJobCareState();
    else S.jobBreed = createJobBreedState();
    jobHistoryOf(S);   /* story.jobs[toId] = { since: 오늘, endedOn: null } */
  } else if (toId === 'breed' && S.jobBreed) rebaseBreedCursors(S);
  if (!Array.isArray(S.story.jobSwitches)) S.story.jobSwitches = [];
  S.story.jobSwitches.push({ day, from, to: toId, back });
  const L = T.log || {}, B = (T.banner || {})[back ? 'back' : 'switched'] || {};
  const events = [{ id: 'job_start', job: toId, switched: true, back, from, ko: fill(L[back ? 'back' : 'switched'], { ro: J.ro || J.ko || toId }) }];
  if (!back) {
    const boardKept = ctx.boardKept !== false;
    const link = T.customerLink || {};
    if (toId === 'shop') {
      const served = (S.jobCare && Array.isArray(S.jobCare.served)) ? S.jobCare.served : [];
      events.push(...openShop(S, { ...ctx, boardKept, boardKeptKo: L.shopOpenKept, link: served.length ? { from: served, ko: link.toShop } : null }).events);
    } else if (toId === 'care') {
      const regs = (S.jobShop && Array.isArray(S.jobShop.regulars)) ? S.jobShop.regulars : [];
      events.push(...openCare(S, { ...ctx, boardKept, boardKeptKo: L.careOpenKept, link: regs.length ? { from: regs, ko: link.toCare } : null }).events);
    } else events.push(...openBreed(S).events);
  }
  return { events, back, from, to: toId, banner: { title: fill(B.title, { ro: J.ro || J.ko || toId }), sub: B.sub || '' } };
}

/* ── 마지막 덮개(§2-4) ─────────────────────────────── 세 진로 다 끝맺음 · 한 번 */
export const finalCoverDue = S => jobsEndedAll(S) && !(S.story && Number.isFinite(S.story.finalCoverOn));
export function markFinalCover(S) {
  if (!finalCoverDue(S)) return { events: [] };
  S.story.finalCoverOn = S.day ?? 0;
  return { events: [{ id: 'final_cover' }] };
}

