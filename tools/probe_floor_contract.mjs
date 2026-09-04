/* ============================================================
   probe_floor_contract.mjs — 「라이브」와 「헤드리스」가 바닥에서 갈리는 곳 ([House])
   ------------------------------------------------------------
   ⛔ 「좌표 길과 슬롯 길이 같은 값인가」는 **여기서 안 잰다.**
      그건 `tools/test_coord_matches_slot.mjs` ([growth] · dd7900c) 가 한다. 세 벌째를 만들지 않는다.
      ⇒ 2026-08-24 에 [House]·[growth] 가 «같은 것을 동시에» 쟀다. 그쪽 것이 검사고 이쪽 것은 탐침이라
        이쪽에서 겹치는 부분을 지웠다. 두 벌이면 갈리고, 갈리면 어느 쪽이 맞는지 아무도 모른다.

   ★ 여기서만 재는 것 셋 — 셋 다 다른 자에는 없다:

     ㉠ 바닥 점을 **`dliOfSlot` 에 화분 객체로** 넘겼을 때 (loop.js 가 하는 그대로).
        `dliAt` 직접 호출과 만나야 한다. 그 사이에 `slotsFor` 의 free 경로가 있다.
     ㉡ 바닥 여러 점이 **서로 다른 값인가.** 다 같으면 좌표를 안 보고 대표값을 내는 것이다.
     ㉢ ★★ **같은 점을 «라이브»와 «헤드리스»에 각각 물어 견준다.**
        헤드리스(정적 프로필)에는 좌표 표가 없어 `0` 이 나오는데,
        그 `0` 은 「어둡다」가 아니라 **「모른다」**다. 그리고 콩나물 최상 대역은 하한이 없어
        ⇒ **「몰라서 나온 0」이 「최상 등급」으로 읽힌다.** 소리 없이 초록이 된다.

   ⚠ ㉢ 은 **어느 점을 찍느냐에 달려 있다** — 어두운 구석은 라이브도 0 이라 «우연히 맞는다».
     그래서 여기서는 **밝은 점을 일부러 고른다.** 표본이 답을 정하는 검사다.

   ⚠ 「바닥이 밝나」는 안 잰다. 그건 `tools/probe_floor_dli.mjs` ([growth]) 몫이다.

   쓰기:  python tools/serve.py 8971
          BYEOT_URL=http://localhost:8971 node tools/probe_floor_contract.mjs
============================================================ */
import fs from 'node:fs';
import { launch } from './test_cdp.mjs';
import { createProfileLight } from '../src/game/room_profile.js';

const BASE = process.env.BYEOT_URL || 'http://localhost:8971';
const OPT = { weather: 'clear', season: 'summer', lampCount: 0, litHours: 0 };
const Y = 0.10;                                   /* 시루가 앉는 높이 */
const J = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

/* 밝은 점 · 중간 · 어두운 구석을 일부러 섞는다 — 어두운 데만 찍으면 ㉢ 이 우연히 통과한다 */
const PTS = [{ x: 0, y: Y, z: 0 }, { x: 0.3, y: Y, z: 0.6 }, { x: 1.8, y: Y, z: 1.8 },
             { x: -1.5, y: Y, z: -1.5 }];

/* ---------- 라이브 (브라우저) ---------- */
const page = await launch({ width: 900, height: 700, dpr: 1, mobile: false });
await page.goto(BASE + '/game.html');
await page.eval('localStorage.clear()', false);
await page.goto(BASE + '/game.html');
await page.waitFor('!!window.__io', 180000, 300);
await page.waitFor('window.__byeotBooted === true', 180000, 300);
const live = JSON.parse(await page.eval('(()=>{ const io=window.__io, O='
  + JSON.stringify(OPT) + ', P=' + JSON.stringify(PTS) + ';'
  + ' return JSON.stringify(P.map(p=>{ let viaRef=null, viaAt=null, e=null;'
  + '   try{ viaRef=io.light.dliOfSlot({slotId:"free:probe",at:{x:p.x,y:p.y,z:p.z,occIdx:null}},O);'
  + '        viaAt =io.light.dliAt(p,Object.assign({occIdx:null},O)).dli;'
  + '   }catch(err){ e=String(err.message||err); }'
  + '   return {viaRef:viaRef, viaAt:viaAt, e:e};'
  + ' })); })()'));
await page.close();

/* ---------- 헤드리스 (정적 프로필) ---------- */
const hl = createProfileLight(J('data/profiles/room_profile.banjiha.json'),
                              { thresholds: J('data/balance/light_thresholds.json') });
const head = PTS.map(p => {
  try { return { v: hl.dliOfSlot({ slotId: 'free:probe', at: { ...p, occIdx: null } }, OPT), e: null }; }
  catch (err) { return { v: null, e: String(err.message || err) }; }
});

/* ---------- 견준다 ---------- */
const n = (v) => v == null ? '  ―  ' : Number(v).toFixed(4).padStart(7);
const tag = (p) => ('(' + p.x + ', ' + p.z + ')').padEnd(16);
let bad = 0, split = 0;

console.log('㉠ 바닥 점을 두 길로 — dliOfSlot(화분 객체)  vs  dliAt(좌표)   [라이브]');
for (let i = 0; i < PTS.length; i++) {
  const r = live[i];
  if (r.e) { bad++; console.log('  ✘ ' + tag(PTS[i]) + '던짐: ' + r.e); continue; }
  const d = Math.abs(r.viaRef - r.viaAt);
  if (d > 1e-6) bad++;
  console.log('  ' + (d > 1e-6 ? '✘ ' : '  ') + tag(PTS[i]) + n(r.viaRef) + '  ' + n(r.viaAt)
    + '   ' + (d > 1e-6 ? '★ 어긋남 ' + d.toFixed(4) : '같다'));
}

const uniq = new Set(live.filter(r => r.viaAt != null).map(r => Number(r.viaAt).toFixed(4)));
console.log('\n㉡ 바닥 ' + PTS.length + '점이 서로 다른 값인가 — '
  + (uniq.size > 1 ? '★ 다르다 (' + uniq.size + '가지). 좌표를 실제로 본다'
                   : '⛔ 다 같다 (' + [...uniq][0] + '). 대표값 냄새다'));

console.log('\n㉢ ★★ 같은 점 — 라이브  vs  헤드리스(정적 프로필)');
console.log('  ' + '점'.padEnd(16) + '라이브    헤드리스');
for (let i = 0; i < PTS.length; i++) {
  const L = live[i].viaAt, H = head[i].e ? null : head[i].v;
  if (head[i].e) { console.log('  ★ ' + tag(PTS[i]) + n(L) + '  던짐: ' + head[i].e); continue; }
  const same = L != null && Math.abs(L - H) <= 1e-6;
  if (!same) split++;
  console.log('  ' + (same ? '  ' : '⛔ ') + tag(PTS[i]) + n(L) + '  ' + n(H)
    + '   ' + (same ? (Number(L) === 0 ? '같다 (★ 둘 다 0 — 우연히 맞았다)' : '같다')
                    : '★ 갈린다. 헤드리스의 0 은 「어둡다」가 아니라 「모른다」다'));
}

console.log('');
if (bad) { console.log('floor_contract: FAIL — 라이브 두 길이 어긋난 곳 ' + bad + '개'); process.exitCode = 1; }
else console.log('㉠ 라이브 두 길은 만난다 (' + PTS.length + '점)');
/* ★ 2026-08-30 계약 D 가 들어왔다(core 3b3177f) — 이제 헤드리스는 바닥 점에 «던져야» 한다.
   「0」이 나오면 D 가 «안 들어간» 것이고, 「던짐」이 옳다. 판정을 그에 맞춘다. */
const thrown = head.filter(h => h.e).length;
const zeros  = head.filter(h => !h.e && Number(h.v) === 0).length;
if (thrown === PTS.length)
  console.log('㉢ 헤드리스가 바닥 ' + PTS.length + '점 «전부» 던진다 — ✅ 계약 D 그대로 («0 이 아니라 모른다»)');
else {
  console.log('㉢ ⛔ 헤드리스가 «안 던진» 점 ' + (PTS.length - thrown) + '/' + PTS.length
    + (zeros ? ' (그중 «0» 을 낸 것 ' + zeros + ') — 계약 D 가 안 들어간 것이다. room_profile.dliOfSlot 을 보라' : ''));
  process.exitCode = 1;
}
