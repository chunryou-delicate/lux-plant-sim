/* tools/probe_guide_alive.mjs — **가이드가 «언제» 죽나** (박사님 ①②⑥)
   ------------------------------------------------------------------
   박사님: *"① 가이드«하기전에» 시루를 옴기면 «가이드자체가 다 뻑이나는거같어». 손가락가이드라던지
     «모든 지침»이. ② «캐릭터 이동 튜토리얼»도 마찬가지고. ⑥ 가이드데로 «행동안하고»
     «다음날 눌러도» 가이드는 «살아있게» 해줘."*
   ⇒ ★ 「무엇을 보고 뜨나」를 눌러서 가른다. 고치지 않는다 — 크기만 잰다.
   ⛔ 값은 안 바꾼다. */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8972';
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 420000);
wd.unref && wd.unref();
const page = await launch({ width: 390, height: 844, dpr: 1 });
try { await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 }); } catch {}
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
const hint = async () => { await page.eval(`try{ window.__byeotHint() }catch(e){}`, false); await sleep(400);
  return page.eval(`(()=>{ const h=document.getElementById('hint');
    const on=h.classList.contains('on'), say=(h.querySelector('.say')||{}).textContent||'';
    const r=h.getBoundingClientRect();
    return JSON.stringify({ 손가락: on? '★뜸' : '⛔없음', 말: say,
      자리: on? '('+Math.round(r.left)+','+Math.round(r.top)+')' : '-' }); })()`); };

console.log('=== ㉠ 첫걸음 — 시루를 «안 놓은» 판 ===');
console.log('  ', await hint());

console.log('\n=== ㉡ 몬스테라가 «가방»에 있는 판 ===');
await page.eval(`(()=>{ const S=window.__S(); S.pots=S.pots||[];
  const p={ id:'pot_bag', itemId:'pot', plantId:'monstera', leafGrades:{}, leafGradesSeen:{},
            cuts:[], daysPlanted:0, fedDays:0, arrivedOnDay:S.day, wateredOnDay:S.day,
            arrivalGrowthDays:45, dliHist:[], placedOnce:false, slotId:null, at:null };
  S.pots.length=0; S.pots.push(p);
  try{ S.firstPlay.monstera.arrived = true; }catch(e){}
  window.__redraw(); })()`, false);
await sleep(1200);
await page.eval(`try{ window.__byeotSheet.open('bag') }catch(e){}`, false); await sleep(1300);
console.log('  ', await hint());

console.log('\n=== ㉢ 그 화분을 «방에 놓은» 판 — 도착 자리 안내가 뜨나 ===');
await page.eval(`(()=>{ const S=window.__S(); const p=S.pots[0];
  p.placedOnce=true; p.slotId='banjiha-desk:0'; p.at=null;
  try{ window.__byeotSheet.close(); }catch(e){}
  window.__redraw(); })()`, false);
await sleep(1500);
console.log('  ', await hint());
console.log('  ⚠ 여기서 「탭 → 옮기기 → 창턱으로」가 떠야 한다. 안 뜨면 `arrivalSlotId` 가 null 이라서다');

console.log('\n=== ㉣ 그 화분을 «다른 자리»로 옮긴 판 ===');
await page.eval(`(()=>{ const S=window.__S(); const p=S.pots[0]; p.slotId='banjiha-sill:0'; window.__redraw(); })()`, false);
await sleep(1500);
console.log('  ', await hint());

console.log('\n=== ㉤ 쪽지(walkTip) — «화면이 바쁠 때» 부르면 어찌 되나 ===');
console.log('  본 쪽지 —', await page.eval(`(()=>JSON.stringify(window.__byeotCoach.seen()))()`));
console.log('  바쁘게 하고 부른다 —', await page.eval(`(()=>{ try{
  document.getElementById('stage').classList.add('talking');
  const r = window.__byeotCoach.show('walkTip');
  return '뜨나: ' + r;
} catch(e){ return 'err '+e.message; } })()`));
await page.eval(`(()=>{ document.getElementById('stage').classList.remove('talking'); })()`, false);
await sleep(600);
console.log('  조용해진 뒤 —', await page.eval(`(()=>{ try{ window.__byeotHint();
  return '지금 쪽지: ' + (window.__byeotCoach.now()||'없음'); }catch(e){ return 'err'; } })()`));
console.log('  ⇒ ★ 그리고 «새로고침»하면 그 기다림(coachPending)은 화면 변수라 사라진다 — 아래에서 본다');
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 150000, 300);
await sleep(4000);
console.log('  새로고침 뒤 본 쪽지 —', await page.eval(`(()=>JSON.stringify(window.__byeotCoach.seen()))()`));
console.log('  새로고침 뒤 손가락 —', await hint());
await page.close(); clearTimeout(wd);
