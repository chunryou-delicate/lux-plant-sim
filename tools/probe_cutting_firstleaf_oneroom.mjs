/* ============================================================
   probe_cutting_firstleaf_oneroom.mjs — 들고 간 삽수가 원룸 자리마다 «첫 잎까지 며칠» ([growth] 소유 · 2026-10-08)
   ------------------------------------------------------------
   ★ 총괄 물음(박사님 「사람이 이리 튈지 저리 튈지」): core 갈래 판(엔진만)의 생장 입력.
   ★ 삽수는 growth 엔진이 아니라 코어(propagation.js §stepCuttings)가 키운다. 그 규칙 그대로 센다 — 크롬이 필요 없다:
     ① 흙에 자리를 잡은 뒤(status established)부터만 잎이 자란다. 물꽂이는 뿌리만 낸다.
     ② 그날 «하루» DLI 가 자라는 밴드면(critical·poor·stagnant 가 아니면 · loop.js §cuttingLightOf) 하루가 쌓인다.
        무늬 삽수는 문턱이 need_mult 배다(plant_grow §bandOf · VARIE_MULT · light_thresholds.json variegated).
     ③ CUTTING_LEAF_DAYS(20) 일이 쌓이면 잎 한 장.
     ④ 화분 직삽(METHODS.pot)은 rootDays(24)일 뒤 «뿌리가 곧 활착» — 그 24일은 빛과 무관하다.
   ★ 두 출발: «이미 흙에 자리 잡은 삽수를 들고 감» · «이사 날 화분에 바로 꽂음(24일 뿌리 뒤)»
   ⚠ 이사 날이 한 해의 어디냐(YD0)에 따라 첫 겨울이 앞뒤로 움직인다 — 기본 135. 계절이 정해지면 YD0= 로 다시.
   ⚠ 숫자는 손으로 안 베낀다 — 문턱은 light_thresholds.json, 일수는 propagation.js 에서 읽는다.

     PROFILE=data/profiles/room_profile.oneroom.json LAMPS=0,1,2 YD0=135 node tools/probe_cutting_firstleaf_oneroom.mjs
   ⛔ 값·확률·문턱은 안 건드린다.
============================================================ */
import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProfileLight } from '../src/game/room_profile.js';
import { CUTTING_LEAF_DAYS, METHODS } from '../src/game/propagation.js';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const J = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const FILE = process.env.PROFILE || 'data/profiles/room_profile.oneroom.json';
const MODE = process.env.MODE || 'real';
const LAMPS = (process.env.LAMPS || '0,1,2').split(',').map(Number);
const DAYS = Number(process.env.DAYS || 400), YD0 = Number(process.env.YD0 || 135);
const SLOTS = (process.env.SLOTS || 'sill,etagere').split(',');
const TH = J('data/balance/light_thresholds.json'), T = TH.plants.monstera_deliciosa;
const MULT = (TH.variegated && TH.variegated.need_mult) || 1;
const MIN = { plain: T.min, varie: T.min * MULT };
const ROOT_DAYS = METHODS.pot.rootDays;
const P = J(FILE);
console.log(`══ 들고 간 삽수 — 원룸 자리마다 첫 잎까지 · ${FILE} · roomRev ${String(P.roomRev || '').split(' ')[0]} · ${MODE} · yearDay0 ${YD0} · ${DAYS}일`);
console.log(`   잎 한 장 = 자라는 날 ${CUTTING_LEAF_DAYS}일 · 문턱(하루 DLI) 무지 ${MIN.plain} · 무늬 ${MIN.varie.toFixed(2)}(×${MULT}) · 화분 직삽 뿌리 ${ROOT_DAYS}일 · 날 = 이사 뒤`);
console.log('   자리               등   [자리 잡은 삽수] 무지 잎1·잎2 · 무늬 잎1·잎2   [이사 날 화분 직삽] 무지 잎1 · 무늬 잎1');
const rows = [];
for (const sl of P.slots.map(s => s.slotId).filter(id => SLOTS.some(k => id.includes(k)))) for (const lamps of LAMPS) {
  if (!(P.lampCounts || [0]).includes(lamps)) { console.log(`   ${sl.padEnd(18)} 등${lamps}  ⛔ 이 프로필엔 등${lamps} 표가 없다`); continue; }
  const light = createProfileLight({ ...P, uidStable: true },
    { thresholds: TH, weather: J('data/balance/weather.json'), electricity: J('data/balance/electricity.json') });
  const dli = [];
  for (let d = 1; d <= DAYS; d++) {
    const s = (light.daily(d, { sim: { mode: MODE, yearDay0: YD0 }, lamps: { count: lamps, litHours: 12 }, pots: [], placedItems: [] }).report.slots || []).find(x => x.slotId === sl);
    dli.push(s ? s.dli : 0);
  }
  /* from 일째부터 쌓아 n 장째 잎이 나는 날 */
  const leafDay = (min, from, n) => { let acc = 0; for (let d = from; d <= DAYS; d++) { if (dli[d - 1] >= min) acc++; if (acc >= CUTTING_LEAF_DAYS * n) return d; } return null; };
  const r = { slot: sl, lamps,
    est: { plain1: leafDay(MIN.plain, 1, 1), plain2: leafDay(MIN.plain, 1, 2), varie1: leafDay(MIN.varie, 1, 1), varie2: leafDay(MIN.varie, 1, 2) },
    pot: { plain1: leafDay(MIN.plain, ROOT_DAYS + 1, 1), varie1: leafDay(MIN.varie, ROOT_DAYS + 1, 1) } };
  rows.push(r);
  const f = v => v == null ? '  안 남' : String(v).padStart(6);
  console.log(`   ${sl.padEnd(18)} 등${lamps}   ${f(r.est.plain1)} ${f(r.est.plain2)} · ${f(r.est.varie1)} ${f(r.est.varie2)}          ${f(r.pot.plain1)} · ${f(r.pot.varie1)}`);
}
if (process.env.OUT) fs.writeFileSync(path.join(ROOT, process.env.OUT), JSON.stringify({ meta: { profile: FILE, roomRev: String(P.roomRev || '').split(' ')[0], mode: MODE, yearDay0: YD0, days: DAYS, leafEvery: CUTTING_LEAF_DAYS, minPlain: MIN.plain, minVarie: MIN.varie, potRootDays: ROOT_DAYS }, rows }, null, 1));
