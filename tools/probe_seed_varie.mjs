/* tools/probe_seed_varie.mjs — **씨앗 그루(실생)가 무늬 잎을 얼마나 내나**(core · 2026-10-24 · 총괄 D82 ④)
   ------------------------------------------------------------------
   씨앗으로 심은 그루(state §plantMonsteraSeed → growth addPlant)는 프롤로그 축복이 없고 0일부터 자란다. 무늬는 모주와 같은
   한 줄(plant_grow §calcVarieProb — 빛 · 안정 · D40 «성숙 전 ×2»)로 잎마다 굴린다. 이 자는 그 그루를 진짜 하루(loop.nextDay)로 굴려
   «무늬 잎을 낸 그루 몫 · 잎 중 무늬 몫»을 잰다 — 등급 장부가 첫 화분만 보던 구멍(D82 ④)이 판에서 얼마나 큰지.
     node tools/probe_seed_varie.mjs [--seeds 1-10] [--days 365] [--dli 3.5,7,13]                 ← 자리 DLI 못 박음(윗값)
     node tools/probe_seed_varie.mjs --real --room tworoom --slots <자리,…> [--start 329] [--days 120] ← 진짜 날씨(그 방 그 자리 · 시작 날)
   ⚠ --dli(못 박음)는 날씨 흔들림이 없어 빛 안정(fStable)이 늘 꼭대기다 — 무늬 빈도의 «윗값»이다. 판의 값은 --real 로 잰다.
   ⚠ 값을 안 바꾼다. 생장 창은 byeot_harness.makeGrowth(prologue:false — 씨앗 그루와 같은 «축복 없음») · 물은 날마다 채운다(빛만 잰다) */
import { makeGrowth, profileOf } from './lib/byeot_harness.mjs';
import { newState, MAIN_GROWTH_ID, SEED_START_GROWTH_DAYS } from '../src/game/state.js';
import { nextDay } from '../src/game/loop.js';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const range = s => s.split(',').flatMap(p => { const m = /^(\d+)-(\d+)$/.exec(p); return m ? Array.from({ length: +m[2] - +m[1] + 1 }, (_, i) => +m[1] + i) : [+p]; });
const SEEDS = range(arg('--seeds', '1-10'));
const DAYS = +arg('--days', 365);
const DLIS = arg('--dli', '3.5,7,13').split(',').map(Number);
const MARKS = [60, 120, 240, 365].filter(d => d <= DAYS).concat(DAYS % 60 ? [DAYS] : []).filter((v, i, a) => a.indexOf(v) === i);
const REAL = process.argv.includes('--real');
const ROOM = arg('--room', 'tworoom');
const START = +arg('--start', 0);
const SILL = 'banjiha-sill:0';

/* 한 그루를 굴린다 — light 는 io.light 계약 · slot 은 그 화분 자리 · start 는 심는 날(진짜 날씨의 계절) */
async function grow(seed, light, room, mode, slot, start) {
  const growth = await makeGrowth(seed, { prologue: false });
  growth.setGrowth(SEED_START_GROWTH_DAYS);
  const io = { light, growth };
  const S = newState({ room, mode });
  S.day = start;
  S.pots.push({ id: 'pot_seed', slotId: slot, plantId: 'monstera_deliciosa', variegated: false, daysPlanted: 0, fedDays: 0,
                arrivalGrowthDays: SEED_START_GROWTH_DAYS, arrivedOnDay: start, wateredOnDay: start, at: null, growthId: MAIN_GROWTH_ID, dliHist: [] });
  S.dliHist = S.pots[0].dliHist;
  const at = {}; let dsum = 0, dn = 0;
  for (let d = 1; d <= DAYS; d++) {
    S.pots[0].wateredOnDay = S.day;
    const t = nextDay(S, io).turn;
    const pl = t && t.plants && t.plants[0];
    if (pl && Number.isFinite(pl.dli)) { dsum += pl.dli; dn++; }
    if (MARKS.includes(d)) { const ls = growth.leafStats() || {}; at[d] = { leaves: ls.leaves ?? null, varie: ls.variegatedLeaves ?? null, mature: ls.matureLeaves ?? null }; }
  }
  return { at, avgDli: dn ? +(dsum / dn).toFixed(2) : null };
}

const rows = [];
if (REAL) {
  const rl = profileOf(ROOM).light;
  const SLOTS = arg('--slots', '').split(',').filter(Boolean);
  if (!SLOTS.length) { console.log('자리 이름(--slots)을 주십시오 — 예:', (rl.room.slots || []).slice(0, 12).map(x => x.slotId).join(',')); process.exit(2); }
  for (const slot of SLOTS) for (const seed of SEEDS) rows.push({ key: slot, seed, ...(await grow(seed, rl, ROOM, 'real', slot, START)) });
} else {
  const base = profileOf('banjiha').light;
  const lightAt = dli => ({
    daily(day, S) { const r = base.daily(day, S); for (const s of r.report.slots) if (s.slotId === SILL) s.dli = dli; return r; },
    skyFor: (...a) => base.skyFor(...a), dliOfSlot: (...a) => base.dliOfSlot(...a), clearCache: () => base.clearCache(),
    thresholdsOf: (...a) => base.thresholdsOf(...a), growLampCount: () => base.growLampCount(), get room() { return base.room; }
  });
  for (const dli of DLIS) for (const seed of SEEDS) rows.push({ key: dli, seed, ...(await grow(seed, lightAt(dli), 'banjiha', 'novice', SILL, 0)) });
}

const med = a => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
console.log(REAL ? `씨앗 그루(축복 없음 · 0일부터) · 진짜 날씨 ${ROOM} · ${START}일에 심음 · 씨앗 ${SEEDS.length}개 · 물 매일`
                 : `씨앗 그루(축복 없음 · 0일부터) · 씨앗 ${SEEDS.length}개 · 자리 DLI ${DLIS.join(' / ')}(못 박음 — 윗값) · 물 매일`);
for (const key of [...new Set(rows.map(r => r.key))]) {
  const rs = rows.filter(r => r.key === key);
  const parts = MARKS.map(m => {
    const xs = rs.map(r => r.at[m]).filter(Boolean);
    const withV = xs.filter(x => x.varie > 0).length;
    const lv = xs.reduce((a, x) => a + (x.leaves || 0), 0), vv = xs.reduce((a, x) => a + (x.varie || 0), 0);
    return `${m}일 — 무늬 잎 낸 그루 ${withV}/${xs.length} · 잎 중앙 ${med(xs.map(x => x.leaves))}장 · 무늬 잎 중앙 ${med(xs.map(x => x.varie))}장 · 잎 중 무늬 ${lv ? (vv / lv * 100).toFixed(1) : '—'}% · 성숙잎 중앙 ${med(xs.map(x => x.mature))}`;
  });
  const last = MARKS[MARKS.length - 1];
  const seedsV = rs.filter(r => (r.at[last] || {}).varie > 0).map(r => r.seed);
  console.log(`■ ${REAL ? '자리' : 'DLI'} ${key}${REAL ? ` (그동안 평균 DLI 중앙 ${med(rs.map(r => r.avgDli))})` : ''}\n  ` + parts.join('\n  ') + `\n  ${last}일에 무늬 낸 씨앗 — ${seedsV.join(',') || '없음'}`);
}
