/* tools/probe_musunfit.mjs — **무순이 앉을 «밝은 칸»이 반지하에 있나**
   ------------------------------------------------------------------
   총괄 물음(2026-08-30): 시루 다섯 중 하나가 무순인데, 무순은 «밝은 데»가 필요하고
   반지하에서 밝은 칸은 창턱뿐이며 ⇒ ★ 거기엔 몬스테라가 간다. 그러면 무순이 앉을 데가 없나.
   재는 것: ① 열다섯 칸의 밝기 차례 ② 창턱이 «몇 칸»인가 · 몬스테라가 차지한 뒤 무엇이 남나
            ③ 무순 품질 문턱(0.35 / 0.15)을 넘는 칸이 각각 몇인가
   ⚠ 문턱은 **코어 데이터**에서 읽는다(first_play §CROP_KINDS.musun.quality) — 여기서 안 적는다.
   ⛔ 값은 안 바꾼다. 뜻(어떻게 할까)은 [Plan] 몫이다. 여기는 수만 낸다. */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8972';
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 300000);
wd.unref && wd.unref();
const page = await launch({ width: 390, height: 844, dpr: 1 });
await page.goto(`${BASE}/game.html`);
await page.eval('localStorage.clear()', false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 150000, 300);
await sleep(4000);
const J = async (e, t = 60000) => JSON.parse(await page.eval(e, true, t));
console.log('■ 무순 문턱 (코어가 아는 값) —', JSON.stringify(await J(`(async()=>{
  const fp=await import('/src/game/first_play.js');
  const k=fp.cropKindOf('musun'), b=fp.cropKindOf('beansprout');
  return JSON.stringify({
    무순: { 밝은데를원하나: k.wantsLight, 주기: k.harvestDays,
            품질: k.quality.map(q=>({ 이름:q.ko, 최소DLI:q.minDli, 끼니:q.meals })) },
    콩나물: { 밝은데를원하나: b.wantsLight,
              품질: b.quality.map(q=>({ 이름:q.ko, 최대DLI:q.maxDli===Infinity?'∞':q.maxDli, 끼니:q.meals })) } }); })()`)));
console.log('');
console.log('=== ① 반지하 열다섯 칸 — 밝은 차례 ===');
const rows = await J(`(()=>{ const S=window.__S();
  const rep=window.__io.light.daily(S.day+1, S).report;
  const rows=[...(rep.slots||[])].sort((a,b)=>b.dli-a.dli)
    .map(s=>({ 자리:s.slotId, dli:Math.round(s.dli*100)/100 }));
  return JSON.stringify(rows); })()`);
for (const r of rows) console.log(`   ${String(r.dli).padStart(5)}  ${r.자리}`);
console.log('');
console.log('=== ②③ 셈 ===');
console.log(' ', JSON.stringify(await J(`(async()=>{
  const fp=await import('/src/game/first_play.js'); const S=window.__S();
  const k=fp.cropKindOf('musun');
  const best=k.quality.find(q=>q.meals===3).minDli;      /* 최상 문턱 */
  const mid =k.quality.find(q=>q.meals===2).minDli;      /* 중간 문턱 */
  const rep=window.__io.light.daily(S.day+1, S).report;
  const rows=[...(rep.slots||[])].sort((a,b)=>b.dli-a.dli);
  const sill=rows.filter(r=>String(r.slotId).startsWith('banjiha-sill:'));
  const over=(t)=>rows.filter(r=>r.dli>=t).map(r=>r.slotId);
  const 몬이가간뒤 = rows.slice(1);                       /* 제일 밝은 칸을 몬스테라가 가져간다 */
  return JSON.stringify({
    '창턱 칸': sill.map(r=>r.slotId + ' ' + Math.round(r.dli*100)/100),
    ['무순 최상(≥' + best + ') 칸']: over(best),
    ['무순 중간(≥' + mid + ') 칸']: over(mid).length + '개',
    '★ 몬스테라가 제일 밝은 칸을 가져간 뒤': {
      '남은 최상 칸': 몬이가간뒤.filter(r=>r.dli>=best).map(r=>r.slotId),
      '남은 중간 칸': 몬이가간뒤.filter(r=>r.dli>=mid).map(r=>r.slotId + ' ' + Math.round(r.dli*100)/100)
    },
    '제일 어두운 칸': rows[rows.length-1].slotId + ' ' + Math.round(rows[rows.length-1].dli*100)/100
  }); })()`)));
console.log('');
console.log('=== ③-b 어두운 데 놓으면 «죽나 · 안 자라나» (코어가 뭐라 하나) ===');
console.log(' ', JSON.stringify(await J(`(async()=>{
  const fp=await import('/src/game/first_play.js'); const k=fp.cropKindOf('musun');
  /* 품질표의 «맨 아래» 줄이 곧 「어두운 데서 어떻게 되나」다 — 죽는 줄이 있나 본다 */
  const worst=k.quality[k.quality.length-1];
  return JSON.stringify({ '제일 낮은 품질': { 이름:worst.ko, 끼니:worst.meals, 최소DLI:worst.minDli },
    '죽는 줄이 있나': k.quality.some(q=>q.meals === 0 || /죽/.test(q.ko||'')),
    뜻: worst.meals > 0 ? '어두워도 «거두기는» 한다 — 끼니가 준다(가르침)' : '거둘 것이 없다(벌)' }); })()`)));
await page.close(); clearTimeout(wd);
