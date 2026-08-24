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

/* ── ★ 표 머리에 박는 셋 (2026-08-24) ──────────────────────────────
   같은 방을 재도 이 셋이 다르면 «다른 표»다. 안 밝히면 다른 창에서 반드시 오독된다.
   실제로 세 번 났다 — 「0.58」(novice 를 real 이라 옮김) · 「무순 다섯」(real 로 재서 죽임) ·
   7일평균 표를 콩나물(5일)에 대려다 갈릴 뻔한 것.

     ① 모드   novice = 여름·맑음 «고정»(첫 플레이) / real = 계절·날씨가 돈다(끝까지 가는 판)
              ★ 「어느 쪽이 맞나」가 아니라 «다른 판»이다
     ② 등 개수  0/1/2/3. 등은 «위치를 못 고른다» — 개수만 고른다(growRigs.slice)
     ③ 자라는 기간  콩나물 5일 · 무순 7일 · 몬스테라 관문은 7일 이동평균
              ★ 등급이 먹는 값은 «자라는 동안의 하루 조도 평균»이다
   ────────────────────────────────────────────────────────────────── */
function profileTag(prof) {
  const rev = String(prof.roomRev || '').split(' ')[0] || '?';
  return `자리 ${(prof.slots||[]).length}칸 · roomRev ${rev} · 잰 날 ${prof.measuredAt || (prof.measured && prof.measured.measuredAt) || (prof.size && prof.size.measuredAt) || '?'}`;
}
function printHead(what, prof) {
  console.log('══ ' + what);
  console.log('   ⚠ 「모드 · 등 개수 · 자라는 기간」이 다르면 다른 표다. 셋을 «같이» 옮겨라.');
  console.log('     novice = 여름·맑음 고정(첫 플레이) · real = 계절이 돈다(끝까지 가는 판)');
  /* ★ 넷째 — 어느 «프로필»로 잰 표인가. 프로필이 다르면 그것도 다른 표다.
     [House] 2026-08-24: "얼린 표가 두 벌인데 «둘 다 같이 낡아서» 검사가 통과하고 있었다."
     ⇒ 같이 낡으면 아무 자도 안 운다. 그래서 자가 스스로 밝힌다. */
  if (prof) console.log('     프로필: ' + profileTag(prof));
  console.log('');
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const J = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const P = J('data/profiles/room_profile.banjiha.json');
printHead("자리별 조도 — 몬스테라 관문(7일 이동평균) 기준", P);
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
/* 등 개수는 밖에서 바꿀 수 있다 — LAMPS=0,1,2,3 (기본은 novice0 · real0 · real1) */
const CASES = process.env.LAMPS
  ? process.env.LAMPS.split(',').map(n => ['real', Number(n)])
  : [['novice', 0], ['real', 0], ['real', 1]];
for (const [mode, lamps] of CASES) {
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
