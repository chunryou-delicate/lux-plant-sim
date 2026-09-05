/* ============================================================
   test_coord_matches_slot.mjs — 좌표로 잰 값이 «슬롯으로 잰 값»과 같은가 ([growth] 소유)
   ------------------------------------------------------------
   ★ 왜 이 검사가 있나 (2026-08-24 · C7)

   박사님이 「바닥도 수치로 그냥 잰다」로 정하셨다. 그런데 지금 조도 계약은
   «이름 붙은 자리» 단위라 바닥 좌표에 값이 없다.

   ⇒ 길은 `light_adapter.dliAt({x,y,z})` 다. 그것이 «슬롯 판정과 같은 함수»를 탄다고
     주석에 적혀 있다(light_adapter.js §dliAt). ★ 그 말이 참인지 이 검사가 «잰다».

   ⇒ 두 길이 갈리면 「화면의 밝기」와 「판정에 쓴 밝기」가 달라진다. 그게 제일 나쁘다 —
     사람은 화면을 보고 자리를 고르는데 판정은 다른 수를 쓴다.

   ★ 지금은 15/15 가 «차 0.0000» 이다. 이 검사는 그것이 안 깨지게 지킨다.
   ★★ 2026-09-06 밤 — 등 «0개»만 보던 것을 등 1·2·3 까지 넓혔다. [House] 와 갈린 자리가
      «등 몫»(1.505 vs 2.340)이었다. 등을 켠 값이 두 길에서 다르면 여기서 붉는다.

   ⚠ 서버가 떠 있어야 한다:  python tools/serve.py 8971
     BYEOT_URL=http://localhost:8971 node tools/test_coord_matches_slot.mjs
============================================================ */
import { launch } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8971';
const page = await launch({ width: 900, height: 700, dpr: 1, mobile: false });
await page.goto(`${BASE}/game.html`);
await page.eval(`localStorage.clear()`, false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__io', 180000, 300);
await page.waitFor('window.__byeotBooted === true', 180000, 300);
const out = await page.eval(`(()=>{ const io=window.__io;
  const rows=[];
  const LAMPS = (io.light.profile && io.light.profile.lampCounts) || [0,1,2,3];
  for (const n of LAMPS) {
  const SKY={weather:'clear',season:'summer',lampCount:n,litHours:12};
  for (const s of io.light.room.slots) {
    let bySlot=null, byXYZ=null, err=null;
    try { bySlot = io.light.dliOfSlot(s.slotId, SKY); } catch(e){ err='slot:'+e.message; }
    try { byXYZ  = io.light.dliAt({x:s.x, y:s.y, z:s.z}, {...SKY, occIdx: s.occIdx}).dli; }
    catch(e){ err=(err?err+' | ':'')+'xyz:'+e.message; }
    rows.push({id:s.slotId, n, bySlot, byXYZ, err});
  }
  }
  return JSON.stringify(rows); })()`);
const rows = JSON.parse(out);
console.log('C7 — 슬롯으로 잰 값 vs 좌표로 잰 값 (맑음·여름 · 등 개수마다)');
let bad=0, lastN=null;
for (const r of rows) {
  if (r.n !== lastN) { console.log('  [등 '+r.n+'개]'); lastN=r.n; }
  if (r.err) { console.log('   '+r.id.padEnd(22)+'⛔ '+r.err.slice(0,60)); bad++; continue; }
  const d = Math.abs(r.bySlot - r.byXYZ);
  const rel = r.bySlot > 0 ? d/r.bySlot : d;
  const mark = rel > 0.02 ? '⚠ 어긋남' : '✅';
  if (rel > 0.02) bad++;
  if (rel > 0.02 || r.n === 0) console.log('   '+r.id.padEnd(22)+r.bySlot.toFixed(3).padStart(7)+' vs '+r.byXYZ.toFixed(3).padStart(7)
    +'   차 '+d.toFixed(4)+'   '+mark);
}
console.log('\n⇒ 어긋난 칸 '+bad+'/'+rows.length+' (자리 × 등 개수)'+(bad?'':'   ★ 등을 켜도 좌표 길이 슬롯 길과 «같은 답»을 냅니다'));

/* ★ 그리고 dliAt 이 «계약 한 칸»을 통째로 내는가 — 모양이 다르면 갖다 쓸 수 없다 */
const KEYS = ['slotId','point','peak_lx','dli','dli_daylight','dli_lamp','band','ko'];
const shape = await page.eval(`(()=>{ const a=window.__io.light.dliAt({x:0.3,y:0.10,z:0.6},
  {weather:'clear',season:'summer',lampCount:0,litHours:12});
  return JSON.stringify(Object.keys(a)); })()`);
const have = new Set(JSON.parse(shape));
const missing = KEYS.filter(k => !have.has(k));
console.log(missing.length
  ? '⛔ 바닥 좌표가 낸 것에 계약 열쇠가 빠졌다: ' + missing.join(',')
  : '✅ 바닥 좌표도 «계약 한 칸»을 통째로 낸다 (' + KEYS.length + '개 열쇠 다 있다)');

console.log('\ncoord_matches_slot: ' + ((bad || missing.length) ? 'FAIL' : 'PASS'));
process.exitCode = (bad || missing.length) ? 1 : 0;
await page.close();
