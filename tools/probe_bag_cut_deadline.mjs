/* ★ 2026-11-04 [plan] — 가방 속 물꽂이 삽수의 분갈이 기한(D29 남은 몫 · 갈래 지도 16 · 총괄 11-04 ㉠)
   무엇을 재나: 가방에 있는 동안 물꽂이 기한(deadlineDay · clockOnDay 기준 절대 날)이 흐르나.
     D29 «놓인 것만 하루가 간다» · 박사님 08-17 «가방으로 회수되면 성장은 멈춰 있는 것으로» — 가방에 30일 둔 삽수가
     놓은 뒤 기한을 넘겨 시들면 빨강이다.
   손은 진짜 함수로만 한다: 놓기 = propagation §setCuttingAt · 가방으로 = §rehomeCuttings(방 밖 좌표 · 빈 자리 0 → 가방) ·
     밤 = §stepCuttings. 삽수 한 벌만 손으로 세운다(물꽂이 · 유리 수경병 · 뿌리 내리는 중).
   빨강 먼저: 고치기 전 HEAD 에서 ㉠ · ㉡ 둘 다 빨강(«시들어 사라졌습니다» · «⛔ 경고 없이»)이어야 자가 잰다.
   쓰는 법: node tools/probe_bag_cut_deadline.mjs [저장소 뿌리(기본 = 이 파일의 ..)]   · 저장소에 아무것도 안 쓴다 · exit 0 = 초록
   ⚠ ㉢ «가방 동안 화면 남은 날»은 적기만 한다(단언 아님) — 놓는 순간 미는 손이면 가방 동안 [자세히] «분갈이 기한 n일 남음»이 줄어든다. */
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const root = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')   /* 한글 폴더 — pathname 은 %EB… 로 남는다 */;
const P = await import(pathToFileURL(path.join(root, 'src/game/propagation.js')).href);

const ROOM = { size: { w: 2, d: 2, h: 3 }, slots: [] };   // 빈 자리 0 — 방 밖 삽수는 가방으로 간다
const IN = { x: 0, y: 0, z: 0 }, OUT = { x: 5, y: 0, z: 0 };

function freshS(day) {
  return { day, story: {}, cuttings: [{ id: 'cpr', method: 'water', container: 'jar', status: 'rooting', cutOnDay: day, clockOnDay: day,
    days: 0, warned: [], at: null, slotId: null, leaves: 1, deadlineDay: null, rootedOnDay: null, nodeOnDay: null }] };
}
function night(S, logs) {
  S.day++;
  P.stepCuttings(S, { log: m => logs.push(`d${S.day} ${m}`) });
}
const bagged = c => !c.at && !c.slotId;
const deathLines = logs => logs.filter(m => /시들어 사라졌습니다|경고 없이 기한을 넘겼습니다/.test(m));

let fail = 0;
function check(name, ok, detail) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} — ${detail}`); if (!ok) fail++; }

/* ㉠ 혹 난 물꽂이 → 가방 30일 → 놓고 하룻밤 */
{
  const S = freshS(0), c = S.cuttings[0], logs = [];
  P.setCuttingAt(S, c, OUT);                       // 놓인 것으로 친다(자리 이름 free:*) — 혹이 난 뒤 rehome 이 방 밖으로 보고 가방에 넣는다
  for (let n = 0; n < 60 && c.status !== 'node' && c.status !== 'dead'; n++) night(S, logs);
  const leftAtBag = c.deadlineDay - S.day;
  P.rehomeCuttings(S, ROOM, m => logs.push(`d${S.day} ${m}`));
  const inBag = bagged(c);
  const shown = [];
  for (let n = 0; n < 30; n++) { night(S, logs); shown.push(Number.isFinite(c.deadlineDay) ? c.deadlineDay - S.day : null); }
  P.setCuttingAt(S, c, IN);
  night(S, logs);
  const d = deathLines(logs);
  check('㉠ 혹 난 물꽂이 · 가방 30일 → 놓은 첫 밤', inBag && c.status !== 'dead' && d.length === 0,
        `가방 들어감 ${inBag} · 상태 ${c.status} · 가방 들 때 남은 날 ${leftAtBag} · 놓은 뒤 남은 날 ${Number.isFinite(c.deadlineDay) ? c.deadlineDay - S.day : '-'}` +
        (d.length ? ` · ${d.join(' / ')}` : ''));
  if (c.status !== 'dead' && Number.isFinite(c.deadlineDay))
    check('㉠-2 남은 날은 가방 들 때 − 놓인 하룻밤', c.deadlineDay - S.day === leftAtBag - 1, `${c.deadlineDay - S.day} (바람 ${leftAtBag - 1})`);
  const moved = shown.filter(v => v != null);
  console.log(`NOTE ㉢ 가방 동안 화면 남은 날(deadlineDay − 오늘) 첫 ${moved[0]} · 끝 ${moved[moved.length - 1]} — 같으면 화면도 참(단언 아님)`);
}

/* ㉡ 뿌리 내리는 중(5일째) → 가방 30일 → 놓고 혹이 날 때까지 */
{
  const S = freshS(0), c = S.cuttings[0], logs = [];
  P.setCuttingAt(S, c, OUT);                       // 놓인 것으로 친다(자리 이름 free:*) — 5일 뒤 rehome 이 방 밖으로 보고 가방에 넣는다
  for (let n = 0; n < 5; n++) night(S, logs);
  P.rehomeCuttings(S, ROOM, m => logs.push(`d${S.day} ${m}`));
  const inBag = bagged(c);
  for (let n = 0; n < 30; n++) night(S, logs);
  P.setCuttingAt(S, c, IN);
  let nodeDay = null, leftAtNode = null;
  for (let n = 0; n < 40 && c.status !== 'dead'; n++) {
    night(S, logs);
    if (c.status === 'node' && nodeDay == null) { nodeDay = S.day; leftAtNode = c.deadlineDay - S.day; break; }
  }
  const d = deathLines(logs);
  check('㉡ 뿌리 내리던 물꽂이 · 가방 30일 → 혹 난 밤', inBag && c.status !== 'dead' && d.length === 0,
        `가방 들어감 ${inBag} · 상태 ${c.status} · 혹 난 날 ${nodeDay} · 그날 남은 날 ${leftAtNode}` + (d.length ? ` · ${d.join(' / ')}` : ''));
}

console.log(fail ? `빨강 ${fail}` : '초록');
process.exit(fail ? 1 : 0);
