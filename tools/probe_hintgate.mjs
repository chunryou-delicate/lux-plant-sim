/* tools/probe_hintgate.mjs — **몬스테라 손가락이 «왜» 안 뜨나** — 갈래를 하나씩 읽는다 */
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
  const b = await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');
    return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`);
  if (b !== 'true') break;
  await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s)s.click();
    const x=document.getElementById('dlgBox'); if(x)x.click();
    const g=document.getElementById('guideClose'); if(g)g.click();})()`, false);
  await sleep(250);
}
await page.eval(`(()=>{ const S=window.__S(); S.pots=S.pots||[]; S.pots.length=0;
  S.pots.push({ id:'pot_a', itemId:'pot', plantId:'monstera', leafGrades:{}, leafGradesSeen:{},
    cuts:[], daysPlanted:0, fedDays:0, arrivedOnDay:S.day, wateredOnDay:S.day,
    arrivalGrowthDays:45, dliHist:[], placedOnce:true, slotId:'banjiha-desk:0', at:null });
  try{ S.firstPlay.monstera.arrived=true; S.firstPlay.phase='move_monstera';
       S.firstPlay.beansprout.slotId='banjiha-dresser:0';
       const sp=(S.firstPlay.beansprout.pots||[])[0]; if(sp){ sp.slotId='banjiha-dresser:0'; sp.at=null; } }catch(e){}
  window.__redraw(); })()`, false);
await sleep(2500);
await page.eval(`try{ window.__byeotHint() }catch(e){}`, false); await sleep(400);
console.log(await page.eval(`(()=>{ const S=window.__S(), fp=S.firstPlay||{};
  const st=document.getElementById('stage'), h=document.getElementById('hint');
  let sp='?'; try{ sp=JSON.stringify(window.__rv.screenPosOf((S.pots[0]||{}).slotId)); }catch(e){ sp='err:'+e.message; }
  const out = {
    '손가락 on': h.classList.contains('on'),
    'crop.slotId': (fp.beansprout||{}).slotId || null,
    'bagPots 칸': document.querySelectorAll('[data-potbag]').length,
    arrived: !!(fp.monstera||{}).arrived, completed: !!fp.completed, phase: fp.phase || null,
    talking: st.classList.contains('talking'), zoom: st.classList.contains('zoom'),
    coachNow: (window.__byeotCoach && window.__byeotCoach.now()) || null,
    'picked.mode': (window.__picked||{}).mode || null,
    'drag.on': !!(window.__drag||{}).on,
    'pot0.slotId': (S.pots[0]||{}).slotId || null,
    'screenPosOf(pot0)': sp
  };
  return JSON.stringify(out, null, 1); })()`));
await page.close(); clearTimeout(wd);
