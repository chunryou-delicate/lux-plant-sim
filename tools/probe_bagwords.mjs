/* tools/probe_bagwords.mjs — **가방이 「누르는 길」을 말하나** ([Plan] ③ · 2026-08-29)
   ------------------------------------------------------------------
   박사님이 나흘 «끌기»만 하셨다. 화면이 「누르면 된다」를 말한 적이 있나 — 세 자리를 다 본다:
     ① 몬스테라 가방 칸의 안내글   ② 시루 설명 줄   ③ 손가락(updateHint)
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
for (let i = 0; i < 40; i++) {
  const busy = await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');
    return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`);
  if (busy !== 'true') break;
  await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s)s.click();
    const b=document.getElementById('dlgBox'); if(b)b.click();
    const g=document.getElementById('guideClose'); if(g)g.click();})()`, false);
  await sleep(250);
}
await page.eval(`(()=>{ const S=window.__S(); S.pots=S.pots||[];
  S.pots.length=0; S.pots.push({ id:'pot_bag', itemId:'pot', plantId:'monstera', leafGrades:{},
    leafGradesSeen:{}, cuts:[], daysPlanted:0, fedDays:0, arrivedOnDay:S.day, wateredOnDay:S.day,
    arrivalGrowthDays:45, dliHist:[], placedOnce:false, slotId:null, at:null });
  try{ S.firstPlay.monstera.arrived = true; }catch(e){}
  window.__redraw(); })()`, false);
await sleep(1500);
await page.eval(`try{ window.__byeotSheet.open('bag') }catch(e){}`, false);
await sleep(1500);
const say = (s) => (/끌거나\s*(눌러|누르)/.test(s) ? '★ 두 길을 말한다' : /끌/.test(s) ? '⛔ «끌기»만 말한다' : '— ?');
const one = async (name, js) => { const t = (await page.eval(js) || '').trim().replace(/\s+/g, ' ');
  console.log(`  ${name} — ${say(t)}\n      «${t.slice(0, 90)}»`); };
console.log('=== 화면이 「누르는 길」을 말하나 ===');
await one('① 몬스테라 가방 칸', `(()=>{ const e=document.querySelector('[data-potbag] .eta'); return e? e.textContent : '(칸 없음)'; })()`);
await one('② 시루 설명 줄    ', `(()=>{ const n=[...document.querySelectorAll('#pageBag *')]
  .find(x=>/시루 칸을/.test(x.textContent||'') && x.children.length<6); return n? n.textContent : '(못 찾음)'; })()`);
await page.eval(`try{ window.__byeotHint() }catch(e){}`, false); await sleep(500);
await one('③ 손가락          ', `(()=>{ const h=document.getElementById('hint');
  return (h.querySelector('.say')||{}).textContent || '(없음)'; })()`);
await page.close(); clearTimeout(wd);
