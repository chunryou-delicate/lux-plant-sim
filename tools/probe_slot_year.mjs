/* ============================================================
   probe_slot_year.mjs — 반지하 «이름 붙은 15칸»을 400일 돌려 자리별로 찍는다 ([growth] 소유)
   ------------------------------------------------------------
   ★ 왜 이 자가 있나 (2026-08-23)
   자리 이야기를 할 때마다 「어느 조건의 숫자냐」로 어긋났다. 실제로 내가
   novice 값(desk:0 = 0.58)을 real 값이라고 잘못 옮겼다. ⇒ 조건을 표에 박는다.

   ★ 반드시 지킬 것 셋
     ① 게임 0일 = 연중 135일 — `tutorial.yearDay0Of()` 가 정본. 안 넘기면 봄부터 잰다
     ② 몬스테라 관문은 **7일 이동평균**이다. 하루값으로 재면 5배 넘게 틀린다
     ③ ⚠ 이 길(`room_profile`)은 **바닥을 모른다**. 자유 좌표는 표에 없어 0 이 나오고
        그 0 은 「어둡다」가 아니라 「모른다」다. 바닥은 tools/probe_floor_dli.mjs 로.

     node tools/probe_slot_year.mjs
============================================================ */
import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProfileLight } from '../src/game/room_profile.js';
import { yearDay0Of, TUTORIAL_RULES as TR } from '../src/game/tutorial.js';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const J = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const P = J('data/profiles/room_profile.banjiha.json');
const LD = { thresholds: J('data/balance/light_thresholds.json'),
             weather: J('data/balance/weather.json'), electricity: J('data/balance/electricity.json') };
const YD0 = yearDay0Of(TR);
const IDS = P.slots.map(s => s.slotId);
function scan(mode, lamps) {
  const light = createProfileLight({ ...P, uidStable: true }, LD);
  const hist = {}, stat = {};
  IDS.forEach(id => { hist[id] = []; stat[id] = { min7: 99, max7: -1, sum: 0, n: 0, winter7: 99 }; });
  for (let d = 1; d <= 400; d++) {
    const S = { sim: { mode, yearDay0: YD0 }, lamps: { count: lamps, litHours: 12 }, pots: [], placedItems: [] };
    const r = light.daily(d, S);
    for (const s of (r.report.slots || [])) {
      const h = hist[s.slotId]; if (!h) continue;
      h.push(s.dli || 0);
      const w = h.slice(-7), a = w.reduce((x, y) => x + y, 0) / w.length;
      const t = stat[s.slotId]; t.sum += (s.dli || 0); t.n++;
      if (d >= 7) { if (a < t.min7) t.min7 = a; if (a > t.max7) t.max7 = a;
                    if (r.sky.season === 'winter' && a < t.winter7) t.winter7 = a; }
    }
  }
  return stat;
}
const BANDS = [['몬스테라 2.7', 2.7], ['무순 최상 0.35', 0.35], ['콩나물 최상 ≤0.3', 0.3]];
for (const [mode, lamps] of [['novice', 0], ['real', 0], ['real', 1]]) {
  const st = scan(mode, lamps);
  console.log('[' + mode + ' 등' + lamps + ']  자리별 7일평균  (연평균 / 연중최저 / 겨울최저)');
  for (const id of IDS) {
    const t = st[id]; const avg = t.sum / t.n;
    const mark = (avg >= 2.7 ? '몬' : '') + (t.winter7 >= 0.35 ? '무' : '') + (avg <= 0.3 ? '콩' : '');
    console.log('   ' + id.padEnd(24) + avg.toFixed(2).padStart(6) + ' /' + t.min7.toFixed(2).padStart(6) +
                ' /' + (t.winter7 === 99 ? '  --' : t.winter7.toFixed(2).padStart(6)) + '   ' + mark);
  }
  for (const [ko, v] of BANDS) {
    const n = IDS.filter(id => (v === 0.3 ? (st[id].sum / st[id].n) <= v : st[id].winter7 >= v)).length;
    console.log('   ⇒ ' + ko + ' 를 겨울에도 넘는 자리 ' + n + '/' + IDS.length);
  }
  console.log('');
}
