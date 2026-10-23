/* ============================================================
   probe_sc_longvine.mjs — 스킨답서스 «longVineM» 후보마다 닿는 날 ([growth] · 2026-10-23 · 총괄 청 · 값은 안 바꿈)
   ------------------------------------------------------------
   ★ 총괄(10-23): sc_hang 곁줄이 선반 윗단 158~226일 · 창가 화분걸이 등 3 에서 231~336일이면 엔딩 뒤 한 사람에게 너무 길다 —
     longVineM 을 줄이는 쪽으로 볼 판단 재료. 규칙은 안 바꾸고 «문턱(길이)만 바꿔» 센다(같은 걸음에서 후보마다 처음 닿은 날).
   ★ 자리 셋: ① 다단 선반 윗단(등 0) ② 창가 화분걸이 tworoom-hang-sun 등 3 ③ 같은 자리 등 2
     + «높이 배움이 살아 있나» — 그 길이에 낮은 자리(dropM < 높은 자리 문턱)도 닿는가: 상한 scStemCapM(dropM) ≥ 후보인 낮은 자리 수 · 그 가운데 가장 빠른 날
   ★ 읽는 것(손으로 안 베낌): 규칙 src/growth/species_growth(정본 · 상한 = dropM + pot_over_m) · 빛 data/profiles/room_profile.tworoom.json(얼린 표) ·
     자리 dropM · 창가 화분걸이 빛 줄 = docs/handoff/growth-tworoom-shop.json d71(probe_tworoom_shop 이 노드에서 house 로 지어 잰 것 — 그 표가 낡으면 이것도 낡는다)
   ★ 판 = probe_tworoom_shop ④ 와 같은 판(real · 판 씨앗 SC_SEEDS · 철 첫날 + 7 에 «뿌리 낸» 마디 둘 · 판 씨앗마다 다른 해) · 가운데값은 판 씨앗(①은 윗단 셋 × 판 씨앗)
     node tools/probe_sc_longvine.mjs          (OUT=docs/handoff/growth-sc-longvine.json 이면 적는다)
   ⛔ 값·문턱·간격은 안 건드린다 — 후보 길이는 이 도구 안에서만 쓴다.
   ★ D76(총괄 10-23): 이 표로 0.5 를 골랐다 — growth_species.json vine.long_vine_m = 0.5 · 곁줄 끝 = «높은 자리에 놓인 SC 가운데 줄기 ≥ 0.5»(core).
     ⚠ 그래서 «낮은 자리도 닿나» 칸이 «예»여도 배움이 안 샌다 — 높은 자리 조건이 가른다(이 표를 길이만으로 읽지 말 것).
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
if (!T.d71 || !T.d71.planter || T.d71.planter.spot !== 'tworoom-hang-sun') throw new Error('[longVine] growth-tworoom-shop.json d71 에 창가 화분걸이(tworoom-hang-sun) 줄이 없다 — probe_tworoom_shop 먼저');
if (T.meta.roomRev !== (P.roomRev || null)) throw new Error(`[longVine] 투룸 표(roomRev ${T.meta.roomRev})와 프로필(${P.roomRev})이 다르다 — probe_tworoom_shop 다시`);
const CANDS = (process.env.CANDS || '0.5,0.6,0.7,0.8,1.0').split(',').map(Number);
const SC_SEEDS = Number(process.env.SC_SEEDS || 4), MAXD = Number(process.env.MAXD || 720);
const SEASON_START = { spring: 0, summer: 90, autumn: 180, winter: 270 }, OPENS = Object.keys(SEASON_START);
const PL = T.d71.planter.slot;
const P4 = { ...P, slots: [...P.slots, T.d71.planter.row] };
const dropOf = Object.fromEntries(T.d71.slots.map(s => [s.slot, s.dropM]));
const H_MIN = SPEC.species.scindapsus.vine.high_spot_min_m;
const topSlots = P.slots.map(s => s.slotId).filter(sid => sid.startsWith('tworoom-shelf-etagere-3tier:') && R.isHighSpot(dropOf[sid]));
const lowSlots = P.slots.map(s => s.slotId).filter(sid => !R.isHighSpot(dropOf[sid]));
if (topSlots.length !== 3) throw new Error(`[longVine] 다단 선반 윗단이 셋이 아니다(${topSlots.length})`);
const median = a => { const b = a.filter(x => x != null).sort((x, y) => x - y); if (b.length * 2 < a.length) return null; const m = Math.floor((a.length - 1) / 2); const c = a.map(x => x == null ? Infinity : x).sort((x, y) => x - y); return c[m] === Infinity ? null : c[m]; };

/* 한 판: lamps · open · seed → 자리마다 후보 길이별 처음 닿은 날 */
function walk(lamps, open, seed, want) {
  const light = createProfileLight({ ...P4, uidStable: true }, { thresholds: TH, weather: W, electricity: E });
  const y0 = SEASON_START[open] + (seed - 1) * 360 + 7;
  const pl = Object.fromEntries(want.map(sid => [sid, R.newPlant('scindapsus', { seed: 100 + seed, form: 'rooted' })]));
  const got = Object.fromEntries(want.map(sid => [sid, {}]));
  let left = want.length * CANDS.length;
  for (let d = 1; d <= MAXD && left > 0; d++) {
    const rep = light.daily(d, { sim: { mode: 'real', yearDay0: y0 - 1, seed }, lamps: { count: lamps, litHours: 12 }, pots: [], placedItems: [] }).report;
    const se = seasonOf(y0 - 1 + d);
    for (const s of rep.slots || []) {
      const p = pl[s.slotId]; if (!p) continue;
      R.stepDay(p, { dli: s.dli, season: se, dropM: dropOf[s.slotId] ?? T.d71.planter.dropM });
      for (const L of CANDS) if (got[s.slotId][L] == null && p.lengthM >= L - 1e-9) { got[s.slotId][L] = d; left--; }
    }
    /* 상한이 후보보다 짧은 자리는 끝내 못 닿는다 — 셈에서 뺀다 */
    if (d === 1) for (const sid of want) for (const L of CANDS) if (R.scStemCapM(dropOf[sid] ?? T.d71.planter.dropM) < L - 1e-9) { got[sid][L] = null; left--; got[sid]['x' + L] = true; }
  }
  return got;
}

const rows = {};   // L → { top:{open:median}, sun3, sun2, low:{ n, names, fastest:{lamps:{open:median}} } }
for (const L of CANDS) rows[L] = { top: {}, sun3: {}, sun2: {}, low: { reachable: lowSlots.filter(sid => R.scStemCapM(dropOf[sid]) >= L - 1e-9), fastest: {} } };
const cell = (lamps, open, sids) => {
  const per = Object.fromEntries(CANDS.map(L => [L, []]));
  for (let seed = 1; seed <= SC_SEEDS; seed++) { const g = walk(lamps, open, seed, sids);
    for (const sid of sids) for (const L of CANDS) per[L].push(g[sid]['x' + L] ? undefined : (g[sid][L] ?? null)); }
  return per;
};
for (const open of OPENS) {
  const a = cell(0, open, topSlots), b = cell(3, open, [PL]), c = cell(2, open, [PL]);
  for (const L of CANDS) { rows[L].top[open] = median(a[L]); rows[L].sun3[open] = median(b[L]); rows[L].sun2[open] = median(c[L]); }
  for (const lamps of [0, 3]) {
    const reach = [...new Set(CANDS.flatMap(L => rows[L].low.reachable))];
    if (!reach.length) continue;
    const per = {}; for (const sid of reach) per[sid] = cell(lamps, open, [sid]);
    for (const L of CANDS) {
      const meds = rows[L].low.reachable.map(sid => ({ sid, m: median(per[sid][L].filter(x => x !== undefined)) })).filter(x => x.m != null);
      const best = meds.sort((x, y) => x.m - y.m)[0] || null;
      ((rows[L].low.fastest[lamps] ||= {}))[open] = best ? { days: best.m, slot: best.sid } : null;
    }
  }
}

const fmt = v => v == null ? `>${MAXD}` : String(v);
const S4 = o => OPENS.map(op => fmt(o[op])).join('/');
console.log(`══ 스킨답서스 longVineM 후보 — 뿌리 낸 날부터 닿는 날(가운데값 · 판 씨앗 ${SC_SEEDS} · 봄/여름/가을/겨울 첫날+7 에 뿌리 · ${MAXD}일까지)`);
console.log(`   규칙 그대로: 상한 = dropM + ${SPEC.species.scindapsus.vine.pot_over_m} · 높은 자리 문턱 ${H_MIN} · 지금 longVineM ${R.longVineM()}`);
console.log(`   ① 다단 선반 윗단 셋(dropM ${dropOf[topSlots[0]]} · 등 0)   ② 창가 화분걸이 hang-sun(dropM ${T.d71.planter.dropM}) 등 3   ③ 같은 자리 등 2`);
for (const L of CANDS) {
  const r = rows[L], lr = r.low.reachable;
  console.log(`\n   ${L.toFixed(2)}m  ① ${S4(r.top)}   ② ${S4(r.sun3)}   ③ ${S4(r.sun2)}`);
  console.log(`          낮은 자리도 닿나: ${lr.length ? `예 — ${lr.length}/${lowSlots.length}칸(dropM ≥ ${(L - SPEC.species.scindapsus.vine.pot_over_m).toFixed(2)}: ${[...new Set(lr.map(s => s.replace('tworoom-', '').replace(/:\d+$/, '')))].join(' · ')})` : '아니오(높이 배움 살아 있음)'}`);
  if (lr.length) for (const lamps of [0, 3]) { const f = r.low.fastest[lamps] || {};
    console.log(`          낮은 자리 가장 빠른 날 등 ${lamps}: ${OPENS.map(op => f[op] ? `${f[op].days}(${f[op].slot.replace('tworoom-', '')})` : `>${MAXD}`).join(' / ')}`); }
  console.log(`          바닥 자리(dropM 0.02 · 상한 ${R.scStemCapM(0.02)}): ${R.scStemCapM(0.02) >= L ? '닿음' : '못 닿음'}`);
}
if (process.env.OUT) fs.writeFileSync(path.join(ROOT, process.env.OUT), JSON.stringify({ meta: { from: 'tools/probe_sc_longvine.mjs', profile: 'data/profiles/room_profile.tworoom.json', roomRev: P.roomRev || null,
  decision: 'D76(총괄 10-23) — 0.5 고름 · vine.long_vine_m · 곁줄 끝 = 높은 자리(dropM ≥ high_spot_min_m)에 놓인 SC 가운데 줄기 ≥ longVineM(core 셈)',
  seeds: SC_SEEDS, maxDays: MAXD, cands: CANDS, potOverM: SPEC.species.scindapsus.vine.pot_over_m, highSpotMinM: H_MIN, longVineMNow: R.longVineM(), topSlots, planter: T.d71.planter.spot },
  rows: Object.fromEntries(CANDS.map(L => [L, { ...rows[L], low: { reachable: rows[L].low.reachable, fastest: rows[L].low.fastest } }])) }, null, 1));
