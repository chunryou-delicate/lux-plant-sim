/* tools/probe_movedsay.mjs — **「창턱! 여기가 이 방에서 제일 밝아」가 «나나»** ([Plan] ㉡)
   ⛔ 옛 자(`arrivalSlotId`)는 도착 때 «이미 null» 이라 세 자리가 다 되돌아갔다 — 한 번도 안 났다.
   ★ 새 자는 「제일 밝은 칸에 놓았나」(`isBrightestSlot`)다.
   ⚠ **상태를 직접 찌르면 안 된다** — 대사 부르는 줄을 안 지나가 아무것도 못 잰다.
     여기서는 `#slot` 의 change 갈래(game.html §9856)로 «실제 길»을 지나간다.
   재는 것: ① 어두운 칸으로 옮기면 «안 나나» ② ★ 제일 밝은 칸으로 옮기면 «나나»
   ⛔ 값은 안 바꾼다. */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8972';
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 400000);
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
await page.eval(`(()=>{ const S=window.__S(); S.pots=S.pots||[]; S.pots.length=0;
  S.pots.push({ id:'pot_a', itemId:'pot', plantId:'monstera', leafGrades:{}, leafGradesSeen:{},
    cuts:[], daysPlanted:0, fedDays:0, arrivedOnDay:S.day, wateredOnDay:S.day,
    arrivalGrowthDays:45, dliHist:[], placedOnce:true, slotId:'banjiha-desk:0', at:null });
  try{ S.firstPlay.monstera.arrived=true; S.firstPlay.phase='move_monstera'; }catch(e){}
  window.__redraw(); })()`, false);
await sleep(2000);
console.log('■ 밝은 순 —', await page.eval(`(()=>{ try{ const io=window.__io, S=window.__S();
  return io.light.daily(S.day+1,S).report.slots.slice().sort((a,b)=>b.dli-a.dli).slice(0,3)
    .map(s=>s.slotId+' '+s.dli.toFixed(2)).join(' | '); }catch(e){ return 'err '+e.message; } })()`));
const log = () => page.eval(`(()=>{ try{ return JSON.stringify((window.__dlgLog||[]).map(x=>x.id)); }
  catch(e){ return 'err '+e.message; } })()`);
const move = async (to) => {
  await page.eval(`(()=>{ const s=document.getElementById('slot');
    s.value = '${to}'; s.dispatchEvent(new Event('change', { bubbles: true })); })()`, false);
  await sleep(1800);
  return page.eval(`(()=>{ const S=window.__S(); const id=(S.pots[0]||{}).slotId;
    let b='?'; try{ b=String(window.__brightest(id)); }catch(e){ b='err'; }
    return JSON.stringify({ 자리:id, '밝은 칸인가': b }); })()`);
};
console.log('');
console.log('=== 1. 어두운 칸으로 옮긴다 (서랍장) ===');
console.log(' ', await move('banjiha-dresser:0'));
console.log('  대사 기록 —', await log());
await calm();
console.log('');
console.log('=== 2. 제일 밝은 칸으로 옮긴다 (창턱) ===');
console.log(' ', await move('banjiha-sill:0'));
console.log('  대사 기록 —', await log());
console.log('  화면 대사 —', await page.eval(`(()=>{ const b=document.getElementById('dlgBox');
  return b? (b.textContent||'').trim().replace(/\s+/g,' ').slice(0,60) : '없음'; })()`));
await page.close(); clearTimeout(wd);
