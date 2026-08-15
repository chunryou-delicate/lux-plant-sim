/* ============================================================
   tools/test_multiplant.mjs — 여러 그루가 각자 제 빛을 받나 (2026-08-15)
   ------------------------------------------------------------
     python tools/serve.py 8963
     BYEOT_URL=http://localhost:8963 node tools/test_multiplant.mjs

   설계 정본: docs/handoff/growth-multiplant-design.md

   ★ 이 검사가 지키는 것은 둘이다.
     ① **한 그루짜리 판이 안 달라진다.** 다개체 장치를 아무도 안 부르면 잠들어 있어야 하고,
        옆에서 두 그루가 굴러도 기본 그루는 한 톨도 안 움직여야 한다.
     ② **그루끼리 안 샌다.** 빛 이력·잎 이력·달력이 각자 것이어야 한다.
        여기가 새면 「밝은 자리에 옮긴 적 없는 그루가 자라 있는」 조용한 버그가 된다.

   ⚠ 검사가 재는 것은 **엔진(plant_grow.html)** 이다. 게임 배선(코어·어댑터)은
     걸음 2 의 몫이라 여기서 안 잰다.
============================================================ */
import { launch, sleep } from './test_cdp.mjs';

const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const _WD = +(process.env.BYEOT_PROBE_TIMEOUT_MS || 600000);
const _wd = setTimeout(() => { console.error('⏱ 자가 제한을 넘겨 멈춥니다.'); process.exit(2); }, _WD);
_wd.unref && _wd.unref();
process.on('exit', () => clearTimeout(_wd));

let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); if (!c) fails++; };

const page = await launch({ width: 400, height: 600, dpr: 1, mobile: false });
await page.goto(`${BASE}/plant_grow.html?embed=game`);
await page.waitFor('typeof window.setGrowth === "function"', 180000, 300);
await page.waitFor('window.thLoaded() === true', 180000, 300);
await sleep(1500);

/* ── ① 아무도 안 부르면 잠들어 있다 ── */
console.log('\n① 등록 전에는 다개체 장치가 잠들어 있다');
{
  const r = await page.eval(`JSON.stringify({ n: plantCount(), ids: plantIds() })`).then(JSON.parse);
  ok(r.n === 0, `① 아무도 안 불렀으면 등록부가 비어 있다 (${r.n}개)`);
}

/* ── ② 한 그루짜리 흐름 ── */
console.log('\n② 한 그루짜리 흐름 — 빛 8.0 으로 120일');
const solo = await page.eval(`(()=>{
  setGrowth(0); resetDailyLight();
  plantSeed(92158); setGrowth(0);
  let cal=calendarDay();
  for(let i=0;i<120;i++){ setDailyLight(8.0); advanceTo(++cal); }
  return JSON.stringify({ g:growthDays(), cal:calendarDay(), s:leafStats(), dli7:dli7() });
})()`).then(JSON.parse);
console.log('     ', JSON.stringify(solo));
ok(solo.g === 120, `② 밝은 자리에서 120일이 다 쌓인다 (${solo.g})`);

/* ── ③ 두 그루가 각자 제 빛을 받는다 ── */
console.log('\n③ 두 그루 — 같은 씨앗, 다른 자리');
const two = await page.eval(`(()=>{
  addPlant({ id:'A', seed:92158, day:0 });
  addPlant({ id:'B', seed:92158, day:0 });
  for(const id of ['A','B']) usePlant(id, ()=>{ setGrowth(0); });
  for(let d=0; d<120; d++){
    usePlant('A', ()=>{ setDailyLight(9.0); advanceTo(calendarDay()+1); });
    usePlant('B', ()=>{ setDailyLight(1.0); advanceTo(calendarDay()+1); });
  }
  const rd=()=>({ g:growthDays(), cal:calendarDay(), dli7:dli7(), s:leafStats(),
                  leafRows:varieStateAll().length });
  return JSON.stringify({ A:usePlant('A',rd), B:usePlant('B',rd),
                          cur:currentPlant(), ids:plantIds() });
})()`).then(JSON.parse);
console.log('     A(빛 9.0):', JSON.stringify(two.A));
console.log('     B(빛 1.0):', JSON.stringify(two.B));
ok(two.A.g === 120, `③ 밝은 그루는 유효 120일까지 간다 (${two.A.g})`);
ok(two.B.g === 0, `③ 어두운 그루는 한 걸음도 못 간다 — 빛이 자리마다 다르다 (${two.B.g})`);
ok(two.A.cal === 120 && two.B.cal === 120, `③ 달력은 둘 다 하루씩 갔다 (${two.A.cal}/${two.B.cal})`);
ok(Math.abs(two.A.dli7 - 9) < 1e-9 && Math.abs(two.B.dli7 - 1) < 1e-9,
   `③ 7일평균이 안 섞인다 (${two.A.dli7} / ${two.B.dli7})`);
ok(two.B.leafRows === 0 && two.A.leafRows > 0,
   `③ 잎 이력이 그루끼리 안 샌다 (A ${two.A.leafRows}칸 · B ${two.B.leafRows}칸)`);
ok(two.cur === '__main__', `③ usePlant 는 굴린 뒤 반드시 되돌린다 (지금 ${two.cur})`);

/* ── ④ 그 사이 기본 그루는 안 움직였다 ── */
console.log('\n④ 두 그루를 굴리는 동안 기본 그루');
const after = await page.eval(`JSON.stringify({ g:growthDays(), cal:calendarDay(),
  dli7:dli7(), s:leafStats(), leafRows:varieStateAll().length })`).then(JSON.parse);
console.log('     ', JSON.stringify(after));
ok(after.g === solo.g && after.cal === solo.cal,
   `④ 유효 생장일·달력이 그대로다 (${solo.g}/${solo.cal} → ${after.g}/${after.cal})`);
ok(JSON.stringify(after.s) === JSON.stringify(solo.s), `④ 잎 집계가 그대로다`);
ok(Math.abs(after.dli7 - solo.dli7) < 1e-12, `④ 7일평균이 그대로다 (${after.dli7})`);

/* ── ⑤ 예외가 나도 되돌린다 ── */
console.log('\n⑤ 굴리다 터져도 되돌아온다');
{
  const r = await page.eval(`(()=>{
    let threw=false;
    try { usePlant('A', ()=>{ throw new Error('일부러'); }); } catch(e){ threw=true; }
    return JSON.stringify({ threw, cur:currentPlant(), g:growthDays() });
  })()`).then(JSON.parse);
  ok(r.threw && r.cur === '__main__' && r.g === solo.g,
     `⑤ 예외가 나가도 기본 그루로 되돌아온다 (${r.cur} · 유효 ${r.g}일)`);
}

/* ── ⑥ 거두기 ── */
console.log('\n⑥ 그루를 거둔다');
{
  const r = await page.eval(`(()=>{ const done=removePlant('B');
    let mainRefused=false; try{ removePlant('__main__'); }catch(e){ mainRefused=true; }
    return JSON.stringify({ done, mainRefused, ids:plantIds(), cur:currentPlant() }); })()`)
    .then(JSON.parse);
  ok(r.done === true && r.ids.indexOf('B') < 0, `⑥ removePlant 가 지운다 (남은 것: ${r.ids.join(', ')})`);
  ok(r.mainRefused, `⑥ 기본 그루는 못 지운다 — 지우면 꽂을 것이 없어진다`);
}

/* ── ⑦ 무게 ── */
const w = await page.eval(`JSON.stringify({
  glb: performance.getEntriesByType('resource').filter(r=>/\\.glb$/.test(r.name)).length,
  mb: +(performance.getEntriesByType('resource').reduce((a,r)=>a+(r.transferSize||0),0)/1048576).toFixed(2) })`)
  .then(JSON.parse);
console.log(`\n⑦ 세 그루를 굴린 뒤 누적 내려받기: GLB ${w.glb}장 · ${w.mb}MB`);
ok(w.glb < 40, `⑦ 그루가 늘어도 에셋은 한 벌이다 (GLB ${w.glb}장)`);

await page.close();
console.log(fails ? `\nmultiplant: FAIL (${fails})` : '\nmultiplant: PASS');
process.exit(fails ? 1 : 0);
