/* tools/probe_coachwait.mjs — **못 뜬 쪽지가 «새로고침해도» 기다리나** (박사님 ⑥)
   박사님: *"가이드데로 «행동안하고» 다음날 눌러도 가이드는 «살아있게» 해줘."*
   ⚠ `coachPending` 이 화면 변수였다 — 새로고침에 사라져 못 뜬 쪽지가 영영 안 떴다.
   재는 것: ① 바쁠 때 부르면 «기다리나» ② ★ 새로고침해도 «기다리나» ③ 조용해지면 «뜨나»
   ⛔ 값은 안 바꾼다. */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8972';
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 300000);
wd.unref && wd.unref();
const page = await launch({ width: 390, height: 844, dpr: 1 });
await page.goto(`${BASE}/game.html`);
await page.eval('localStorage.clear()', false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 150000, 300);
await sleep(5000);
const calm = async () => { for (let i = 0; i < 40; i++) {
  const b = await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');
    return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`);
  if (b !== 'true') break;
  await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s)s.click();
    const x=document.getElementById('dlgBox'); if(x)x.click();
    const g=document.getElementById('guideClose'); if(g)g.click();})()`, false);
  await sleep(250); } };
await calm();
const look = () => page.eval(`(()=>{ const C=window.__byeotCoach||{};
  let wait=null; try{ wait = C.waiting? C.waiting() : 'no-hook'; }catch(e){ wait='err'; }
  let store=null; try{ store = localStorage.getItem('byeot.coach.wait'); }catch(e){ store='err'; }
  return JSON.stringify({ '지금 쪽지': (C.now && C.now()) || null, '기다리는 것': wait,
    '서랍에 적힌 것': store, '본 것': (C.seen && C.seen()) || null }); })()`);

console.log('=== ① 화면을 «바쁘게» 하고 walkTip 을 부른다 ===');
console.log('  전 —', await look());
console.log('  부르기 —', await page.eval(`(()=>{ try{
  document.getElementById('stage').classList.add('talking');
  return '기다리게 됐나(false 면 못 떴다는 뜻): ' + window.__byeotCoach.later('walkTip');
}catch(e){ return 'err '+e.message; } })()`));
console.log('  ★ 후 —', await look());

console.log('\n=== ② 새로고침 ===');
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 150000, 300);
await sleep(5000);
console.log('  ★ 새로고침 뒤 —', await look());

console.log('\n=== ③ 화면이 조용해지면 뜨나 ===');
await calm();
await page.eval(`(()=>{ document.getElementById('stage').classList.remove('talking'); })()`, false);
for (let i = 0; i < 12; i++) { await page.eval(`try{ window.__byeotHint() }catch(e){}`, false); await sleep(400);
  const now = await page.eval(`(()=>{ const C=window.__byeotCoach; return (C.now && C.now()) || ''; })()`);
  if (now) break; }
console.log('  ★ 후 —', await look());
await page.close(); clearTimeout(wd);
