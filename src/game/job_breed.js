/* src/game/job_breed.js — **진로 «무늬 육종»** (core · 2026-10-24 · 총괄 D72 · D74 · D83 · plan-breed-career-spec-20261023 §8 core 몫)
   ------------------------------------------------------------------
   엔딩(집을 샀다) 뒤 진로 고르기 → [육종을 시작한다] → 산 투룸(가게·돌봄과 같은 이사) → 기록장(상점 탭 맨 위 · 주문판 자리).
   새 잎·싹이 나면 **저절로** 기록장에 한 줄(표본) → 품종 칸 다섯마다 «같은 조건» 셈 → 같은 조건 둘째 = 후보 · 셋째 = 등록(이름 입력 칸 ·
   자동 이름 미리 채움) · 상금 = 그 결과 잎 한 장 값 ×1 · 품종 셋 다음 날 아침 끝맺음(칭호 «무늬 육종가»).
   ★ 원칙(plan §0): **새 무늬 규칙을 안 만든다**(표본은 «결과가 굴려진 그 값»을 그대로 읽는다 — 다시 굴리지 않는다 · 숫자 두 벌 없음) ·
     **새 값표를 안 만든다**(상금 = 있는 잎 값 · varie_grades · species SPECIES_GAME.leafWon) · 확률 숫자를 새로 안 띄운다(셈만).
   ★ 표본 셋(§2-1) — 날마다 «어제까지 적은 자리»(커서 seen)에서 새로 난 것만 읽는다(사건 배선을 안 건드린다 · 두 번 안 센다 · 오늘부터 적는다):
       monstera  무늬 마디 삽수(뿌리 밝기 varieLightBand 가 정해진 것)의 새 잎 — 조건 = 뿌리 밝기(dark·mid·bright) · 결과 = 무지/산반/하프문/풀문
       al        구근 싹틈(그루 phase 'corm' → 아님) — 조건 = 구근 출처(varie_mother·plain_mother·shop · growth p.origin 의 'from_' 뗌) · 결과 = 무지/마블/반달
       pp        새 잎(그루가 낸 잎 수 p.births > 커서 — 맨 위 k 장) — 조건 = 그 그루의 줄 id(잘라 낸 끝은 어미 줄 — species §cutSpecies 의 motherId) · 결과 = 초록/마블/분홍 많음/분홍 잎
     모주(몬스테라 화분)·씨앗 그루는 안 적는다(§2-1 · §9) · 맡은 그루(돌봄 q.care)도 안 적는다.
   ★ 재현(§2-3 · 칸은 data/balance/breed_slots.json — plan 이 쓰고 여기는 읽기만):
       rootBand        몬스테라 — 같은 뿌리 밝기에서 «서로 다른 삽수»가 그 등급 잎을 낸 수(D74 ② 삽수는 서로 다른 표본)
       varieMotherKind AL — 무늬 어미 구근에서 싹튼 그 갈래 그루 수(같은 어미 갈래)
       ppLineRun       PP — 한 줄에서 분홍 많음 잎이 잇단 수(분홍 많음이 아닌 잎이면 다 끊는다 — 마블·분홍 잎·초록 · 총괄 D86 ③ · growth runPP 와 같은 자)
   상태: story.job = { id:'breed', since } · story.jobs.breed = { since, endedOn } ·
         S.jobBreed = { samples(최근 60), tally, sampleCount, varieties:[{ slot, day, name, cond }], pending:[{ slot, cond, day, auto }],
                        repro:{ [slot]:{ [cond]:{ n, refs } } }, candidates:{ [slot]: day }, milestones, seq, openedOn, ppLineSeq, lines:{ [potId]: line },
                        seen:{ cut:{ [id]: n }, pp:{ [potId]: no }(옛 — 안 읽음), ppB:{ [potId]: births }, al:{ [potId]: 1 } }, alFound, alFindDay, alNoMotherOff }
         tally(잡담 맥락이 읽음 · plan dialogue §breedChatOf): monstera{dark|mid|bright:{plain,sanban,halfmoon,fullmoon}} ·
                                                                al{varie_mother|plain_mother|shop:{plain,marble,sector}} · pp{[line]:{green,marble,heavy,pink}}
   사건(turn.events · 대사는 plan): job_start{job:'breed'} · breed_open · breed_sample{line, first}(그 줄 첫 표본만 대사 · 기록 줄은 하루 한 줄) ·
         breed_candidate{slot} · breed_register{slot, name}(이름 입력 뒤 · registerBreed) · breed_milestone{n: 1|3|5} · breed_ending */
import { jobOf, jobHistoryOf } from './job_shop.js';
import { speciesRules, speciesPotsOf, SPECIES_GAME, speciesShopOpen } from './species.js';
import { cuttingsOf } from './propagation.js';
import { varieGradeRules } from './shop.js';

let BREED = null;
try { const m = await import('../../data/balance/breed_slots.json', { with: { type: 'json' } }); BREED = m.default; } catch { BREED = null; }
export function installBreedSlots(b) { BREED = b || null; }   /* 검사가 표를 갈아 끼울 때 */
export const breedSlots = () => (BREED && Array.isArray(BREED.slots) ? BREED.slots : []);
export const breedUi = () => (BREED && BREED._ui) || {};
export const breedLabels = () => (BREED && BREED._labels) || {};
export const breedSlotOf = id => breedSlots().find(s => s && s.id === id) || null;
/* AL 구근 찾기 칸(growth 표 · 읽기만) — «찾을 수 있는 무늬 AL 이 깨어 있다»(plan f1dd0c27 · growth 10-24 칸) */
let AL_PROP = null;
try { const m = await import('../../data/growth_species.json', { with: { type: 'json' } }); AL_PROP = m.default.species.alocasia_frydek.propagation; } catch { AL_PROP = null; }

/* ⚖ 수 — plan §2-3 · §4 · §10 (총괄 D74) · 낱줄 60(§4) */
export const BREED_JOB = Object.freeze({
  need: 3,                 /* 같은 조건 셋 = 등록 */
  candidateAt: 2,          /* 둘 = 후보(칸마다 한 번 · 몬이 한 줄) */
  samplesKeep: 60,         /* 낱줄은 최근 60 · 셈은 오래 */
  milestones: Object.freeze([1, 3, 5]),
  prizeMult: 1,            /* 상금 = 결과 잎 한 장 값 × 1(D74 ③) */
  ending: Object.freeze({ varieties: 3, titleKo: '무늬 육종가' })
});
const BJ = BREED_JOB;

/* ── 상태 ─────────────────────────────── */
const emptyTally = () => ({ monstera: {}, al: {}, pp: {} });
export function createJobBreedState() {
  return { samples: [], tally: emptyTally(), sampleCount: 0, varieties: [], pending: [], repro: {}, candidates: {}, milestones: {},
           seq: 0, openedOn: null, ppLineSeq: 0, lines: {}, seen: { cut: {}, pp: {}, al: {}, ppB: {} }, alFound: null, alFindDay: null,
           alNoMotherOff: null };   /* D87 — «무늬 AL 어미 없음» 이 마지막으로 안 맞은 날(turn.breedAlNoMotherDays) */
}
export function jobBreedOf(S) {
  if (!S) throw new TypeError('[육종] 상태가 없습니다');
  if (!S.jobBreed || typeof S.jobBreed !== 'object') S.jobBreed = createJobBreedState();
  const J = S.jobBreed;
  for (const [k, v] of Object.entries(createJobBreedState())) if (J[k] == null) J[k] = v;
  for (const k of ['monstera', 'al', 'pp']) if (!J.tally[k] || typeof J.tally[k] !== 'object') J.tally[k] = {};
  for (const k of ['cut', 'pp', 'al', 'ppB']) if (!J.seen[k] || typeof J.seen[k] !== 'object') J.seen[k] = {};
  return J;
}
export const isBreedJob = S => !!(jobOf(S) && jobOf(S).id === 'breed');
export const breedEndedOn = S => { const h = S && S.story && S.story.jobs && S.story.jobs.breed; return h && Number.isFinite(h.endedOn) ? h.endedOn : null; };

export function startBreedJob(S) {
  if (!S.story) throw new Error('[육종] 스토리 상태가 없습니다');
  if (jobOf(S)) { const e = new Error('[육종] 이미 진로를 골랐습니다'); e.tutorialInput = true; throw e; }   /* D73 ① 한 판에 하나 */
  S.story.job = { id: 'breed', since: S.day ?? 0 };
  jobHistoryOf(S);
  jobBreedOf(S);
  return { events: [{ id: 'job_start', job: 'breed', ko: '진로 — 무늬 육종을 시작하기로 했습니다' }] };
}

/* ── 표본 읽기 ─────────────────────────────── 결과가 굴려진 그 값 그대로(다시 굴리지 않는다) */
const AL = 'alocasia_frydek', PP = 'pink_princess';
const alCondOf = origin => (origin === 'from_varie_mother' ? 'varie_mother' : origin === 'from_plain_mother' ? 'plain_mother' : 'shop');
const ownPot = q => !!(q && !q.care);                          /* 맡은 그루(돌봄)는 손님 것 */
const varieCutOf = c => !!(c && c.status !== 'dead' && c.varieFromCut && c.varieLightBand);   /* 뿌리 밝기가 정해진 무늬 마디 삽수 */
/* PP 줄 — 잘라 낸 끝(origin 'cut' · motherId)은 어미 줄을 잇는다 · 나머지(교환·상점·옛 세이브)는 새 줄 */
function lineOf(J, q, byId) {
  if (J.lines[q.id] != null) return J.lines[q.id];
  let line = null;
  if (q.origin === 'cut' && q.motherId != null) {
    const m = byId.get(q.motherId);
    if (m) line = lineOf(J, m, byId); else if (J.lines[q.motherId] != null) line = J.lines[q.motherId];
  }
  if (line == null) line = ++J.ppLineSeq;
  J.lines[q.id] = line;
  return line;
}
/* 오늘 새로 굴려진 것 — 커서를 옮기며 낸다(mark=true) · 연 날은 커서만 세운다(오늘부터 적는다) */
function freshSamples(S, J, mark = true) {
  const day = S.day ?? 0, out = [];
  for (const c of cuttingsOf(S)) {
    if (!varieCutOf(c)) continue;
    const grown = c.grewLeaves || 0, seen = J.seen.cut[c.id] ?? 0;
    if (grown > seen) {
      const k = grown - seen, V = (c.leafVarie || []).slice(-k), G = (c.leafGrade || []).slice(-k);
      for (let i = 0; i < V.length; i++)
        out.push({ day, line: 'monstera', plantRef: `cut:${c.id}`, cond: c.varieLightBand, out: V[i] ? (G[i] || 'sanban') : 'plain' });
    }
    if (mark) J.seen.cut[c.id] = grown;
  }
  const sp = speciesPotsOf(S), byId = new Map(sp.map(q => [q.id, q]));
  let R = null; try { R = speciesRules(); } catch { R = null; }
  for (const q of sp) {
    if (!ownPot(q) || !q.plant) continue;
    if (q.species === PP && R) {
      const line = lineOf(J, q, byId);
      let rows = []; try { rows = R.leafRows(q.plant) || []; } catch { rows = []; }
      /* ⚠ 10-24 D87 — 커서는 «낸 잎 수»(p.births · 그루마다 늘기만 함)다. 마디 번호(no)로 쟀더니 자른 뒤(growth cutAbove 가 p.nodes = 자른 마디)
           새 잎이 옛 꼭대기 번호를 넘을 때까지 하나도 안 적혔다(breedH PP 표본 2년 4~9장 · PP 칸 0/10). 새로 난 잎은 맨 위 k 장(잎은 위로 붙는다).
           옛 세이브의 번호 커서(seen.pp)는 안 읽는다 — 그 그루는 오늘 커서만 세운다(첫 만남과 같은 셈 · 하루치를 안 적을 뿐 · 거짓 표본은 없음) */
      const births = Number.isFinite(q.plant.births) ? q.plant.births : 0, seenB = J.seen.ppB[q.id];
      if (seenB != null && births > seenB)
        for (const r of rows.slice(-(births - seenB))) if (r && Number.isFinite(r.no)) out.push({ day, line: 'pp', plantRef: `sp:${q.id}`, cond: String(line), out: r.grade });
      if (mark) J.seen.ppB[q.id] = births;
    } else if (q.species === AL) {
      const sprouted = q.plant.phase && q.plant.phase !== 'corm';
      if (sprouted && !J.seen.al[q.id]) {
        if (J.seen.al[q.id] === 0) out.push({ day, line: 'al', plantRef: `sp:${q.id}`, cond: alCondOf(q.plant.origin), out: q.plant.varie || 'plain',
                                              motherKind: q.plant.motherKind ?? null });
        if (mark) J.seen.al[q.id] = 1;
      } else if (!sprouted && J.seen.al[q.id] == null && mark) J.seen.al[q.id] = 0;   /* 아직 구근 — 싹트는 날 적는다 */
    }
  }
  return out;
}

/* ── 재현 판정 ─────────────────────────────── */
function bump(obj, k, field) { const r = obj[k] = obj[k] || {}; r[field] = (r[field] || 0) + 1; }
function reproKeyOf(slot, s) {
  if (slot.line !== s.line) return null;
  if (slot.cond === 'rootBand') return s.out === slot.outcome ? s.cond : null;
  if (slot.cond === 'varieMotherKind') return (s.cond === 'varie_mother' && s.out === slot.outcome) ? String(s.motherKind || s.out) : null;
  if (slot.cond === 'ppLineRun') return s.cond;   /* 줄 — 이어짐은 아래에서 */
  return null;
}
const registeredOrPending = (J, id) => J.varieties.some(v => v.slot === id) || J.pending.some(p => p.slot === id);
export function autoNameOf(J, slot, extra = 0) {
  const n = J.varieties.length + J.pending.length + 1 + extra;
  return String((BREED && BREED.autoName) || '볕 {short} {n}호').replace('{short}', slot.short || slot.ko || slot.id).replace('{n}', String(n));
}
function noteRepro(S, J, s, events) {
  for (const slot of breedSlots()) {
    const key = reproKeyOf(slot, s);
    if (key == null) continue;
    const box = (J.repro[slot.id] = J.repro[slot.id] || {});
    const r = (box[key] = box[key] || { n: 0, refs: [] });
    if (slot.cond === 'ppLineRun') {
      if (s.out === slot.outcome) r.n += 1;
      else { r.n = 0; continue; }   /* 분홍 많음이 아니면 다 끊는다(총괄 D86 ③ · plan · growth runPP) */
    } else {
      if (r.refs.includes(s.plantRef)) continue;                 /* 서로 다른 삽수 · 서로 다른 그루 */
      r.refs.push(s.plantRef); r.n = r.refs.length;
    }
    if (registeredOrPending(J, slot.id)) continue;
    if (r.n >= BJ.candidateAt && J.candidates[slot.id] == null) {
      J.candidates[slot.id] = S.day ?? 0;
      events.push({ id: 'breed_candidate', slot: slot.id, cond: key, ko: `후보 — ${slot.ko}` });
    }
    if (r.n >= BJ.need) J.pending.push({ slot: slot.id, cond: key, day: S.day ?? 0, auto: autoNameOf(J, slot) });
  }
}
function recordSample(S, J, s, events) {
  J.samples.push({ day: s.day, line: s.line, plantRef: s.plantRef, cond: s.cond, out: s.out });
  if (J.samples.length > BJ.samplesKeep) J.samples.splice(0, J.samples.length - BJ.samplesKeep);
  J.sampleCount += 1;
  bump(J.tally[s.line], s.cond, s.out);
  noteRepro(S, J, s, events);
}

/* ── 열기 · 하루 ─────────────────────────────── */
export function openBreed(S) {
  const J = jobBreedOf(S), day = S.day ?? 0;
  if (J.openedOn != null) return { events: [] };
  J.openedOn = day;
  freshSamples(S, J, true);   /* 들고 온 그루에서 이미 난 것은 안 적는다 — 커서만 세운다(§1-3) */
  return { events: [{ id: 'breed_open', ko: '기록장을 새로 폈습니다' }] };
}
/* loop.nextDay 가 부른다(육종 판 · 산 투룸) — 삽수·새 종의 하루가 먼저 돈 뒤 */
export function stepBreedJob(S) {
  const out = { events: [] };
  if (!isBreedJob(S)) return out;
  const J = jobBreedOf(S), day = S.day ?? 0;
  if (J.openedOn == null) return out;
  { const e = breedEndingStep(S, J, day); if (e) out.events.push(e); }   /* 아침 먼저 */
  const fresh = freshSamples(S, J, true);
  const linesBefore = new Set(Object.keys(J.tally).filter(k => Object.keys(J.tally[k]).length));
  const byLine = {};
  for (const s of fresh) { recordSample(S, J, s, out.events); (byLine[s.line] = byLine[s.line] || []).push(s); }
  /* 줄마다 하루 한 사건(first = 그 줄 첫 표본) · 기록 줄은 하루 한 줄로 묶는다(plan §1-4) */
  const lines = Object.keys(byLine);
  lines.forEach((line, i) => {
    const s0 = byLine[line][0], more = fresh.length - 1;
    const ev = { id: 'breed_sample', line, first: !linesBefore.has(line), n: byLine[line].length };
    if (i === 0) ev.ko = sampleKo(s0) + (more > 0 ? ` 외 ${more}` : '');
    out.events.push(ev);
  });
  out.fresh = fresh.length;
  out.alCormWaitDays = alCormWaitDaysOf(S, J, day);
  out.alNoMotherDays = alNoMotherDaysOf(S, J, day);
  return out;
}
/* ★ plan(총괄 D87 ① 다리) — turn.breedAlNoMotherDays: 육종 판 · 마블·반달 칸이 둘 다 비었고(등록·대기 없음) · 무늬 AL 그루 0(맡은 것 빼고 · 가방 포함) ·
     무늬 어미 구근 0(가방 S.species.corms · 심어 아직 안 싹튼 화분도 — 곧 무늬 그루가 날 수 있다) · 상점에 AL 구근 진열(speciesShopOpen al_corm)일 때만 수.
     진로 연 날과 «마지막으로 안 맞은 날 다음 날» 중 늦은 날부터 지난 날 수 · 안 맞으면 null(몬이 «상점 구근을 들여 봐» 귀띔의 때 · hintBreedAlShopCorm) */
export function alNoMotherDaysOf(S, J, day) {
  if (!isBreedJob(S) || J.openedOn == null) return null;
  const mine = speciesPotsOf(S).filter(q => q && !q.care && q.species === AL && q.plant);
  const corms = (S.species && Array.isArray(S.species.corms)) ? S.species.corms : [];
  const shop = !!speciesShopOpen(S, 'al_corm');
  const holds = !['al_marble', 'al_sector'].some(id => registeredOrPending(J, id))
    && !mine.some(q => q.plant.varie === 'marble' || q.plant.varie === 'sector')
    && !mine.some(q => q.plant.phase === 'corm' && q.plant.origin === 'from_varie_mother')
    && !corms.some(c => c && c.origin === 'from_varie_mother')
    && shop;
  if (!holds) { J.alNoMotherOff = day; return null; }
  return day - Math.max(J.openedOn, Number.isFinite(J.alNoMotherOff) ? J.alNoMotherOff + 1 : -Infinity);
}
/* ★ plan f1dd0c27(총괄 D84 ②) — turn.breedAlCormWaitDays: 육종 판 · 마블·반달 칸이 둘 다 비었고(등록·대기 없음) · 구근을 찾을 수 있는 무늬 AL 이
     깨어 있을 때만(growth: phase growing ∧ varie ∧ finds < max_finds_lifetime ∧ sinceFind ≥ min_leaves_since_find) — 진로 연 날과 마지막으로 구근 찾은 날 중
     늦은 날부터 지난 날 수 · 아니면 null(몬이 «재우는 법» 귀띔의 때 · 대사가 참일 때만) */
export function alCormWaitDaysOf(S, J, day) {
  const found = (S.species && S.species.n && Number.isFinite(S.species.n.alCormsFound)) ? S.species.n.alCormsFound : 0;
  if (J.alFound == null) J.alFound = found;
  if (found > J.alFound) { J.alFound = found; J.alFindDay = day; }
  if (!isBreedJob(S) || J.openedOn == null || !AL_PROP) return null;
  if (['al_marble', 'al_sector'].some(id => registeredOrPending(J, id))) return null;
  const maxF = AL_PROP.max_finds_lifetime, minS = AL_PROP.min_leaves_since_find;
  const can = speciesPotsOf(S).some(q => q && !q.care && q.species === AL && q.plant && q.plant.phase === 'growing' &&
                                        (q.plant.varie === 'marble' || q.plant.varie === 'sector') && q.plant.finds < maxF && (q.plant.sinceFind ?? 0) >= minS);
  if (!can) return null;
  return day - Math.max(J.openedOn, Number.isFinite(J.alFindDay) ? J.alFindDay : -Infinity);
}
export function sampleKo(s) {
  const L = breedLabels()[s.line] || {}, cl = L.cond || {}, ol = L.out || {};
  const cond = s.line === 'pp' ? String(cl.line || '줄 {k}').replace('{k}', s.cond) : (cl[s.cond] || s.cond);
  const outKo = ol[s.out] || s.out;
  return String(breedUi().logSample || '📒 표본 — {cond} · {out}').replace('{cond}', cond).replace('{out}', outKo).replace(/^📒\s*/, '');
}

/* ── 등록 ─────────────────────────────── 이름 입력 뒤(화면 · 하네스) — 상금은 부르는 쪽이 넣는다(creditShopOrder · won) */
export function breedPrizeOf(slot) {
  if (!slot) return 0;
  if (slot.line === 'monstera') { const g = varieGradeRules().byId.get(slot.outcome); return Math.round(((g && g.leafWon) || 0) * BJ.prizeMult); }
  const t = slot.line === 'al' ? SPECIES_GAME.leafWon[AL] : slot.line === 'pp' ? SPECIES_GAME.leafWon[PP] : null;
  return Math.round(((t && t[slot.outcome]) || 0) * BJ.prizeMult);
}
export function pendingBreed(S) { const J = jobBreedOf(S); return J.pending.length ? J.pending[0] : null; }
export function registerBreed(S, slotId, name) {
  const J = jobBreedOf(S), day = S.day ?? 0;
  const i = J.pending.findIndex(p => p.slot === slotId);
  if (i < 0) { const e = new Error('[육종] 등록할 품종이 없습니다'); e.tutorialInput = true; throw e; }
  const p = J.pending[i], slot = breedSlotOf(slotId);
  const nm = String(name == null ? '' : name).replace(/\s+/g, ' ').trim().slice(0, 24) || p.auto;
  J.pending.splice(i, 1);
  J.varieties.push({ slot: slotId, day, name: nm, cond: p.cond });
  const won = breedPrizeOf(slot);
  const events = [{ id: 'breed_register', slot: slotId, name: nm, ko: String(breedUi().logRegister || '🏷 새 품종 — {name}({ko})').replace('{name}', nm).replace('{ko}', slot ? slot.ko : slotId), won }];
  const n = J.varieties.length;
  if (BJ.milestones.includes(n) && J.milestones[n] == null) { J.milestones[n] = day; events.push({ id: 'breed_milestone', n, ko: `품종 ${n}` }); }
  /* 남은 칸의 자동 이름은 등록 차례를 따른다 */
  J.pending.forEach((q, k) => { const s = breedSlotOf(q.slot); if (s) q.auto = autoNameOf({ varieties: J.varieties, pending: J.pending.slice(0, k) }, s); });
  return { won, events };
}

/* ── 끝맺음 · 칭호 ─────────────────────────────── 품종 3 다음 날 아침 한 번(가게·돌봄 결) */
function breedEndingStep(S, J, day) {
  const at = J.milestones[BJ.ending.varieties];
  if (at == null || !(day > at)) return null;
  const h = jobHistoryOf(S).breed;
  if (!h || h.endedOn != null) return null;
  h.endedOn = day;
  return { id: 'breed_ending', ko: `칭호 — ${BJ.ending.titleKo}`, title: BJ.ending.titleKo, varieties: J.varieties.length, samples: J.sampleCount };
}
export function breedHeadOf(S) {
  if (!isBreedJob(S)) return null;
  const J = jobBreedOf(S), title = breedEndedOn(S) != null ? BJ.ending.titleKo : null;
  return { title, varieties: J.varieties.length, ko: `${title || '무늬 육종'} · 품종 ${J.varieties.length}` };
}

/* ── 기록장 줄(화면) ─────────────────────────────── 칸마다 «같은 조건 n/3» 또는 «등록» + 조건별 셈 막대(수만 · 확률 숫자 안 띄움 §2-4) */
export function breedBestOf(J) {
  let best = null;
  for (const slot of breedSlots()) {
    if (registeredOrPending(J, slot.id)) continue;
    const box = J.repro[slot.id] || {};
    const n = Math.max(0, ...Object.values(box).map(r => (r && r.n) || 0));
    if (!best || n > best.n) best = { slot: slot.id, ko: slot.ko, n: Math.min(n, BJ.need - 1) };
  }
  return best;
}
export function breedBoardRows(S) {
  const J = jobBreedOf(S), ui = breedUi(), L = breedLabels();
  return breedSlots().map(slot => {
    const v = J.varieties.find(x => x.slot === slot.id), pend = J.pending.find(x => x.slot === slot.id);
    const box = J.repro[slot.id] || {};
    const n = Math.min(BJ.need, Math.max(0, ...Object.values(box).map(r => (r && r.n) || 0)));
    const head = v ? String(ui.slotRegistered || '{ko} — 등록 · «{name}»').replace('{ko}', slot.ko).replace('{name}', v.name)
                   : String(ui.slotRow || '{ko} — 같은 조건 {n}/3').replace('{ko}', slot.ko).replace('{n}', String(n));
    const T = J.tally[slot.line] || {}, lab = L[slot.line] || {};
    const conds = Object.keys(T);
    const bars = conds.map(c => {
      const row = T[c] || {}, total = Object.values(row).reduce((a, x) => a + (x || 0), 0);
      const condKo = slot.line === 'pp' ? String((lab.cond && lab.cond.line) || '줄 {k}').replace('{k}', c) : ((lab.cond && lab.cond[c]) || c);
      return { cond: c, condKo, total, hit: row[slot.outcome] || 0,
               parts: Object.entries(row).map(([o, k]) => ({ out: o, ko: (lab.out && lab.out[o]) || o, n: k })) };
    });
    return { slot: slot.id, ko: slot.ko, desc: slot.desc, n, registered: !!v, name: v ? v.name : null, pending: !!pend, head, bars };
  });
}

/* ── 스냅샷(quest.js 칸 · null = 모른다) ─────────────────────────────── */
export function jobBreedSnapshot(S) {
  if (!isBreedJob(S) || !S.jobBreed) return { breedSamples: null, breedLines: null, breedVarieties: null, breedBest: null };
  const J = jobBreedOf(S);
  const lines = ['monstera', 'al', 'pp'].filter(k => Object.keys(J.tally[k] || {}).length > 0).length;
  return { breedSamples: J.sampleCount, breedLines: lines, breedVarieties: J.varieties.length, breedBest: breedBestOf(J) };
}

/* ── 세이브 ─────────────────────────────── */
export function packJobBreed(J) { return J ? JSON.parse(JSON.stringify(J)) : null; }
export function unpackJobBreed(raw) {
  const J = createJobBreedState();
  if (!raw || typeof raw !== 'object') return J;
  for (const k of Object.keys(J)) if (raw[k] != null) J[k] = JSON.parse(JSON.stringify(raw[k]));
  return jobBreedOf({ jobBreed: J });
}
