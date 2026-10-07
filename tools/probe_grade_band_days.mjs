/* ============================================================
   probe_grade_band_days.mjs — 「등 없이 mid · 등을 사면 bright」가 서나 ([growth] 소유)
   ------------------------------------------------------------
   ★ 2026-10-07 · D5(원룸 기준 배치 D)·D7(원룸 real 주)·D1(원룸 이사 때 실전 계절)을 재려고 만들었다.
     무늬 등급은 «잎이 나는 날»의 밝기 밴드로 굴린다(varie_grades.json lightBands:
     slow→mid · best/good/over→bright). 그래서 한 해 365일 중 «자라는 날»(7일평균 ≥ min)만 골라
     그날들의 등급 밴드가 mid 몇 % · bright 몇 % 인지 센다. 멈춤·바램 날수도 같이 낸다.
   ⚠ 몬스테라 7일 «이동»평균이다. 콩나물(5일)·무순(7일 자라는 평균)과 섞지 마라.
   ⚠ 프로필에 그 등 개수 표가 없으면 «등0 을 낸다» — 그러면 줄이 같은 판의 반복이 된다. 그래서 없으면 ⛔ 로 찍는다.

     PROFILE=docs/handoff/_tmp_profile_oneroom_D.json MODE=real LAMPS=0,1,2 node tools/probe_grade_band_days.mjs
       PROFILE  프로필 경로(없으면 ROOM 정본)   ROOM    oneroom|banjiha   MODE  real|novice
       LAMPS    등 개수들                        SLOTS   자리 이름에 들어갈 낱말(기본 sill)   YD0  시작 yearDay(기본 135)
   ⛔ 값·문턱·확률은 안 건드린다. 읽고 세기만 한다.
============================================================ */
import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProfileLight } from '../src/game/room_profile.js';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const J = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const TH = J('data/balance/light_thresholds.json'), T = TH.plants.monstera_deliciosa;
const LB = J('data/balance/varie_grades.json').lightBands || {};
const ROOM = process.env.ROOM || 'oneroom', MODE = process.env.MODE || 'real';
const FILE = process.env.PROFILE || `data/profiles/room_profile.${ROOM}.json`;
const LAMPS = (process.env.LAMPS || '0,1,2').split(',').map(Number);
const SLOTS = process.env.SLOTS || 'sill', YD0 = Number(process.env.YD0 || 135);
const bandOf = d => d < T.die ? 'critical' : d < T.survive ? 'poor' : d < T.min ? 'stagnant'
  : d < T.best_lo ? 'slow' : d <= T.best_hi ? 'best' : d <= T.max ? 'good' : 'over';
const P = J(FILE);
console.log(`══ 등급 밴드 날수 — ${FILE} · ${MODE} · yearDay0 ${YD0} 부터 365일 · lampCounts ${JSON.stringify(P.lampCounts || [0])}`);
console.log(`   등급 밴드 = ${JSON.stringify(LB)} · 「자라는 날」= 7일평균 ≥ min ${T.min}`);
for (const sl of P.slots.map(s => s.slotId).filter(id => id.includes(SLOTS))) for (const lamps of LAMPS) {
  if (!(P.lampCounts || [0]).includes(lamps)) { console.log(`  ${sl.padEnd(18)} 등${lamps}  ⛔ 이 프로필엔 등${lamps} 표가 없다`); continue; }
  const light = createProfileLight({ ...P, uidStable: true },
    { thresholds: TH, weather: J('data/balance/weather.json'), electricity: J('data/balance/electricity.json') });
  const hist = []; let grow = 0, stop = 0, fade = 0, run = 0, runMax = 0; const g = {};
  for (let d = 1; d <= 365; d++) {
    const s = (light.daily(d, { sim: { mode: MODE, yearDay0: YD0 }, lamps: { count: lamps, litHours: 12 }, pots: [], placedItems: [] }).report.slots || []).find(x => x.slotId === sl);
    hist.push(s ? s.dli : 0); const w = hist.slice(-7), a = w.reduce((x, y) => x + y, 0) / w.length;
    if (a >= T.min) { grow++; run = 0; const lg = LB[bandOf(a)] || 'dark'; g[lg] = (g[lg] || 0) + 1; }
    else { stop++; run++; runMax = Math.max(runMax, run); }
    if (a < T.survive) fade++;
  }
  const pct = k => grow ? Math.round((g[k] || 0) / grow * 100) : 0;
  console.log(`  ${sl.padEnd(18)} 등${lamps}  자라는 날 ${String(grow).padStart(3)} · 멈춤 ${String(stop).padStart(3)}(가장 긴 ${String(runMax).padStart(3)}) · 바램 ${String(fade).padStart(3)}  ⇒ 등급 밴드 mid ${String(pct('mid')).padStart(3)}% · bright ${String(pct('bright')).padStart(3)}%`);
}
