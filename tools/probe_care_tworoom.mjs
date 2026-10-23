/* ============================================================
   probe_care_tworoom.mjs — B 판 «식물 돌봄»: 고장 여덟 × 철 × 등 수 → 기한 안에 고칠 수 있는 자리 수 ([growth] · 2026-10-23 · 총괄 D73)
   ------------------------------------------------------------
   ★ 명세 plan-care-career-spec §2-2 · §2-3 · §8 growth 몫. core 가드(«고칠 자리가 오늘 하나라도 있나»)에 쓸 표.
   ★ 판: 투룸 가게 기준 배치 B(얼린 프로필 data/profiles/room_profile.tworoom.json — probe_tworoom_shop 이 노드에서 지은 방과 같음을 확인)
     + 창가 벽 화분걸이(tworoom-hang-sun · 돌봄 첫날부터 가구점) 한 자리 · 자리 dropM = house 값(growth-tworoom-shop.json d71).
     real · 판 씨앗 SEEDS · 철 첫날에 맡음 · 등 0~3 · 맡은 그루를 그 자리에 «하루 첫날» 놓고 «읽는 사람»의 손(가위는 첫날)으로 기한까지 걷는다.
   ★ 고장마다 맡을 때 그루(growth newPlant · 명세 §2-2)와 나음 판정(summary · core 와 맞춘 자):
     ca_bright · ca_dark  CA 잎 5 · 다 말림                → curled 0                      (기한 21 · 30)
     pp_tip               PP 분홍 셋 줄(시드는 중)          → 첫날 분홍 줄 아래 자름 · saved   (21)
     pp_green             PP 맨 위 초록 둘                 → 첫날 분홍 남은 마디 위 자름 → 새 잎 · 맨 위 초록 아님 (30)
     al_dark              AL 잠든 채(겨울 밖에 맡음)         → 깸(phase growing)             (21)
     al_winter            AL 잠든 채(겨울 첫날 · 늦가을에 맡음) → 깸 · 기한 = 봄 첫날 + 21
     sc_floor             SC 바닥에 닿은 채(손님 자리 dropM 0.02 · 0.45 두 판) → 새 마디        (30)
     sc_plain             SC 마디 6 · 위 둘 무늬 없음         → 새 잎이 마블                  (30)
   ★ 가드 셋을 같은 판에서 견준다(g1 그날 DLI · g7 7일 평균 · g7s g7 + CA 는 fit 만) — 자는 spotFitOf · scStemCapM 만. 방 단위 «헛열림 · 놓침»을 낸다.
     node tools/probe_care_tworoom.mjs                 (OUT=docs/handoff/growth-care-tworoom.json 이면 적는다 · SEEDS 기본 12)
   ⛔ 값·문턱·기한은 안 건드린다 — 기한은 명세 첫 판(⚖) 그대로 읽어 쓴다.
============================================================ */
import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProfileLight } from '../src/game/room_profile.js';
import { seasonOf } from '../src/engine/weather.js';
import { createSpeciesRules } from '../src/growth/species_growth.js';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const J = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const TH = J('data/balance/light_thresholds.json'), P = J('data/profiles/room_profile.tworoom.json');
const W = J('data/balance/weather.json'), E = J('data/balance/electricity.json');
const SPEC = J('data/growth_species.json'), R = createSpeciesRules(SPEC, TH);
const T = J('docs/handoff/growth-tworoom-shop.json');
if (!T.d71 || !T.d71.planter || T.d71.planter.spot !== 'tworoom-hang-sun') throw new Error('[돌봄] growth-tworoom-shop.json d71 에 창가 화분걸이 줄이 없다 — probe_tworoom_shop 먼저');
if (T.meta.roomRev !== (P.roomRev || null)) throw new Error(`[돌봄] 투룸 표(roomRev ${T.meta.roomRev})와 프로필(${P.roomRev})이 다르다`);
const SEEDS = Number(process.env.SEEDS || 12), LAMPS = P.lampCounts || [0];
const PL = T.d71.planter.slot, P5 = { ...P, slots: [...P.slots, T.d71.planter.row] };
const dropOf = Object.fromEntries(T.d71.slots.map(s => [s.slot, s.dropM]));
const SLOTS = P.slots.map(s => s.slotId);              // 기준 배치 B (29)
const ALL = [...SLOTS, PL];
const START = { spring: 0, summer: 90, autumn: 180, winter: 270, lateAutumn: 240 };
const DUE = { easy: 21, normal: 30, hard: 45 };
const SPRING_NEXT = 360;
const mean = a => a.reduce((x, y) => x + y, 0) / (a.length || 1);

/* 빛 판 — 철 첫날부터 days 일 · 자리마다 DLI · 철 (판 씨앗마다 다른 해 · probe_tworoom_shop 과 같은 꼴) */
const SER = new Map();
function seriesOf(lamps, open, seed, days) {
  const key = `${lamps}|${open}|${seed}|${days}`;
  if (SER.has(key)) return SER.get(key);
  const light = createProfileLight({ ...P5, uidStable: true }, { thresholds: TH, weather: W, electricity: E });
  const y0 = START[open] + (seed - 1) * 360;
  const per = Object.fromEntries(ALL.map(s => [s, { dli: [], season: [] }]));
  for (let d = 1; d <= days; d++) {
    const rep = light.daily(d, { sim: { mode: 'real', yearDay0: y0 - 1, seed }, lamps: { count: lamps, litHours: 12 }, pots: [], placedItems: [] }).report;
    for (const s of rep.slots || []) if (per[s.slotId]) { per[s.slotId].dli.push(s.dli); per[s.slotId].season.push(seasonOf(y0 - 1 + d)); }
  }
  SER.set(key, per); return per;
}

/* 고장 여덟 — make(seed): 맡을 때 그루 · first(p): 첫날 손(가위) · healed(p, s0): 나음 · guard(p, dli, slot) · due(open) · opens */
const PROBLEMS = {
  ca_bright: { tier: 'easy', opens: ['spring', 'summer', 'autumn', 'winter'], make: s => R.newPlant('calathea', { seed: s, leaves: 5, curled: 'all' }),
    healed: (p) => R.summary(p).curled === 0, guard: (p, dli) => ['fit', 'slow'].includes(R.spotFitOf(p, dli)), guardStrict: (p, dli) => R.spotFitOf(p, dli) === 'fit' },
  ca_dark: { tier: 'normal', opens: ['spring', 'summer', 'autumn', 'winter'], make: s => R.newPlant('calathea', { seed: s, leaves: 5, curled: 'all' }),
    healed: (p) => R.summary(p).curled === 0, guard: (p, dli) => ['fit', 'slow'].includes(R.spotFitOf(p, dli)), guardStrict: (p, dli) => R.spotFitOf(p, dli) === 'fit' },
  pp_tip: { tier: 'easy', opens: ['spring', 'summer', 'autumn', 'winter'], make: s => R.newPlant('pink_princess', { seed: s, pinks: [0.4, 0.6, 0.95, 0.95, 0.95] }),
    first: (p, st) => { st.saved = R.cutAbove(p, p.leaves[1].no).saved; }, healed: (p, st) => !!st.saved, guard: () => true },
  pp_green: { tier: 'normal', opens: ['spring', 'summer', 'autumn', 'winter'], make: s => R.newPlant('pink_princess', { seed: s, pinks: [0.4, 0.3, 0, 0] }),
    first: (p, st) => { R.cutAbove(p, p.leaves[1].no); st.b0 = R.summary(p).births; },
    healed: (p, st) => { const s = R.summary(p); return s.births > st.b0 && s.topGrade !== 'green'; }, guard: (p, dli) => ['fit', 'over'].includes(R.spotFitOf(p, dli)) },
  al_dark: { tier: 'easy', opens: ['spring', 'summer', 'autumn'], make: s => R.newPlant('alocasia_frydek', { seed: s, origin: 'shop', form: 'asleep', finds: SPEC.species.alocasia_frydek.propagation.max_finds_lifetime }),
    healed: (p) => R.summary(p).phase === 'growing', guard: (p, dli, slot, season) => season !== 'winter' && R.spotFitOf(p, dli) !== 'dark' },
  al_winter: { tier: 'spring21', opens: ['winter', 'lateAutumn'], make: s => R.newPlant('alocasia_frydek', { seed: s, origin: 'shop', form: 'asleep', finds: SPEC.species.alocasia_frydek.propagation.max_finds_lifetime }),
    healed: (p) => R.summary(p).phase === 'growing', guard: () => true },
  sc_floor_002: { tier: 'normal', opens: ['spring', 'summer', 'autumn', 'winter'], dropM0: 0.02, make: s => R.newPlant('scindapsus', { seed: s, form: 'atFloor', dropM: 0.02 }),
    first: (p, st) => { st.b0 = R.summary(p).births; }, healed: (p, st) => R.summary(p).births > st.b0,
    guard: (p, dli, slot) => R.scStemCapM(dropOf[slot]) > p.lengthM && R.spotFitOf(p, dli) !== 'dark' },
  sc_floor_045: { tier: 'normal', opens: ['spring', 'summer', 'autumn', 'winter'], dropM0: 0.45, make: s => R.newPlant('scindapsus', { seed: s, form: 'atFloor', dropM: 0.45 }),
    first: (p, st) => { st.b0 = R.summary(p).births; }, healed: (p, st) => R.summary(p).births > st.b0,
    guard: (p, dli, slot) => R.scStemCapM(dropOf[slot]) > p.lengthM && R.spotFitOf(p, dli) !== 'dark' },
  sc_plain: { tier: 'normal', opens: ['spring', 'summer', 'autumn', 'winter'], make: s => R.newPlant('scindapsus', { seed: s, form: 'rooted', nodes: 6, plainTop: 2 }),
    first: (p, st) => { st.b0 = R.summary(p).births; }, healed: (p, st) => { const s = R.summary(p); return s.births > st.b0 && s.topMarble; },
    guard: (p, dli, slot) => R.scStemCapM(dropOf[slot]) > p.lengthM && ['fit', 'over'].includes(R.spotFitOf(p, dli)) }
};
const dueOf = (P_, open) => P_.tier === 'spring21' ? SPRING_NEXT - START[open] + 21 : DUE[P_.tier];
if (!dropOf[PL]) dropOf[PL] = T.d71.planter.dropM;

const out = {};
/* 가드 셋을 같은 판에서 견준다 — core 가 «오늘 고칠 자리가 있나»를 무엇으로 볼까
     g1  그날(첫날) DLI 하나          — 날씨 한 날에 흔들린다
     g7  그 자리 7일 평균(대리: 첫 7일) — 게임에선 «지난 7일» 평균(규칙 avg7 과 같은 자)
     g7s g7 + CA 는 «fit»(3~8)만 — 느림(2~3)은 펴지긴 해도 기한 안에 못 끝내는 판이 있어서
   방 단위로 센다(core 의 물음은 «하나라도 있나»): 판 씨앗마다 가드가 열렸나 × 실제로 고친 자리가 있나 */
const GV = ['g1', 'g7', 'g7s'];
for (const [id, PB] of Object.entries(PROBLEMS)) {
  out[id] = {};
  const strict = PB.guardStrict || PB.guard;
  for (const open of PB.opens) {
    out[id][open] = {};
    const due = dueOf(PB, open);
    for (const lamps of LAMPS) {
      const per = Object.fromEntries(ALL.map(s => [s, { fixed: 0, days: [], g1: 0, g7: 0, g7s: 0 }]));
      const room = { truth: 0, g1: { open: 0, falseOpen: 0, miss: 0 }, g7: { open: 0, falseOpen: 0, miss: 0 }, g7s: { open: 0, falseOpen: 0, miss: 0 } };
      for (let seed = 1; seed <= SEEDS; seed++) {
        const ser = seriesOf(lamps, open, seed, Math.max(due, 7));
        let anyFix = false; const anyG = { g1: false, g7: false, g7s: false };
        for (const slot of ALL) {
          const v = ser[slot], p = PB.make(1000 + seed), st = {};
          const m7 = mean(v.dli.slice(0, 7));
          const g = { g1: PB.guard(p, v.dli[0], slot, v.season[0]), g7: PB.guard(p, m7, slot, v.season[0]), g7s: strict(p, m7, slot, v.season[0]) };
          if (PB.first) PB.first(p, st);
          let at = null;
          for (let d = 1; d <= due && at == null; d++) {
            R.stepDay(p, { dli: v.dli[d - 1], season: v.season[d - 1], dropM: dropOf[slot] });
            if (PB.healed(p, st)) at = d;
          }
          const c = per[slot];
          if (at != null) { c.fixed++; c.days.push(at); }
          for (const k of GV) if (g[k]) c[k]++;
          if (slot !== PL) { if (at != null) anyFix = true; for (const k of GV) if (g[k]) anyG[k] = true; }
        }
        if (anyFix) room.truth++;
        for (const k of GV) { if (anyG[k]) room[k].open++; if (anyG[k] && !anyFix) room[k].falseOpen++; if (!anyG[k] && anyFix) room[k].miss++; }
      }
      const perOut = {};
      for (const s of ALL) { const c = per[s]; perOut[s] = { share: +(c.fixed / SEEDS).toFixed(2), days: c.days.length ? Math.round(mean(c.days)) : null,
        g1: +(c.g1 / SEEDS).toFixed(2), g7: +(c.g7 / SEEDS).toFixed(2), g7s: +(c.g7s / SEEDS).toFixed(2) }; }
      const base = SLOTS.filter(s => perOut[s].share >= 0.5);
      const spotErr = {};
      for (const k of GV) { const o = SLOTS.filter(s => perOut[s][k] >= 0.5); spotErr[k] = { open: o.length, falseOpen: o.filter(s => perOut[s].share < 0.5).length, missed: base.filter(s => perOut[s][k] < 0.5).length }; }
      const fd = base.map(s => perOut[s].days).filter(x => x != null);
      out[id][open][lamps] = { due, fixable: base.length, planterFix: perOut[PL].share >= 0.5, fixDays: fd.length ? [Math.min(...fd), Math.max(...fd)] : null,
        room, spots: spotErr, per: perOut };
    }
  }
}

console.log(`══ 돌봄 고장 여덟 × 철 × 등 — 투룸 배치 B ${SLOTS.length}자리 + 창가 화분걸이 · real · 판 씨앗 ${SEEDS} · 철 첫날 맡음 · 그 자리에 두고 읽는 손으로 기한까지`);
console.log('   칸 = 기한 안에 고친 자리 수(판 몫 ≥ 0.5) (+걸) = 창가 화분걸이도 고침 · (고친 날 빠름~늦음) · {7일 평균 가드가 연 자리 · 그 가운데 못 고친 수}');
for (const [id, PB] of Object.entries(PROBLEMS)) {
  console.log(`\n   ${id}${PB.dropM0 != null ? `(손님 자리 dropM ${PB.dropM0})` : ''} · 기한 ${PB.tier === 'spring21' ? '봄 첫날 + 21' : DUE[PB.tier] + '일'}`);
  for (const open of PB.opens)
    console.log(`      ${open.padEnd(10)} ` + LAMPS.map(l => { const c = out[id][open][l], g = c.spots[PB.guardStrict ? 'g7s' : 'g7'];
      return `등${l} ${String(c.fixable).padStart(2)}${c.planterFix ? '(+걸)' : ''}${c.fixDays ? `(${c.fixDays.join('~')}일)` : ''}{${g.open}·${g.falseOpen}}`; }).join('  '));
}
const zero = [];
for (const [id, PB] of Object.entries(PROBLEMS)) for (const open of PB.opens) for (const l of LAMPS) if (out[id][open][l].fixable === 0) zero.push(`${id} · ${open} · 등${l}${out[id][open][l].planterFix ? '(화분걸이만 고침)' : ''}`);
console.log(`\n⇒ 기준 배치에 고칠 자리가 하나도 없는 판(가드가 막아야 하는 판) ${zero.length}: ${zero.join(' / ') || '없음'}`);
/* 방 단위 가드 견줌 — 판 씨앗 × (고장 · 철 · 등) 전부에서 «열렸는데 고친 자리 없음»(헛열림) · «닫혔는데 고친 자리 있음»(놓침) */
const tot = Object.fromEntries(GV.map(k => [k, { runs: 0, falseOpen: 0, miss: 0 }]));
for (const [id, PB] of Object.entries(PROBLEMS)) for (const open of PB.opens) for (const l of LAMPS) { const r = out[id][open][l].room;
  for (const k of GV) { tot[k].runs += SEEDS; tot[k].falseOpen += r[k].falseOpen; tot[k].miss += r[k].miss; } }
console.log('⇒ 방 단위 가드(판 씨앗마다 «하나라도 있나») — 헛열림 = 열렸는데 기한 안에 고친 자리 없음 · 놓침 = 닫혔는데 고친 자리 있음');
for (const k of GV) console.log(`      ${k.padEnd(4)} 헛열림 ${tot[k].falseOpen}/${tot[k].runs} · 놓침 ${tot[k].miss}/${tot[k].runs}`);
const bad = [];
for (const [id, PB] of Object.entries(PROBLEMS)) for (const open of PB.opens) for (const l of LAMPS) { const r = out[id][open][l].room, k = PB.guardStrict ? 'g7s' : 'g7';
  if (r[k].falseOpen || r[k].miss) bad.push(`${id} · ${open} · 등${l} 헛${r[k].falseOpen} 놓${r[k].miss}`); }
console.log(`⇒ 권하는 가드(g7 · CA 는 g7s)가 틀린 판: ${bad.join(' / ') || '없음'}`);
if (process.env.OUT) fs.writeFileSync(path.join(ROOT, process.env.OUT), JSON.stringify({ meta: { from: 'tools/probe_care_tworoom.mjs', profile: 'data/profiles/room_profile.tworoom.json',
  roomRev: P.roomRev || null, seeds: SEEDS, lampCounts: LAMPS, due: DUE, starts: START, planter: T.d71.planter.spot, slots: SLOTS.length,
  guards: { g1: '그날 DLI', g7: '그 자리 7일 평균(대리: 첫 7일)', g7s: 'g7 + CA 는 fit(3~8)만' },
  guardRule: 'CA spotFitOf ∈ {fit, slow}(g7s: fit) · PP green·SC plain spotFitOf ∈ {fit, over} · AL dark 겨울 밖 ∧ ≠ dark · SC floor/plain scStemCapM(자리) > lengthM · pp_tip·al_winter 늘' },
  problems: out, zero, roomGuard: tot, recommendedGuardErrors: bad }, null, 1));
