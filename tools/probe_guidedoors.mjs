/* tools/probe_guidedoors.mjs — **유도 두 걸음이 «실제로 뜨나»** ([Plan] ②③)
   ------------------------------------------------------------------
   계약(first_play §몬스테라 유도): ★ 자리를 «먼저», 등은 «그 다음».
     move = !g.moved && g.days >= 10        ⇒ monsteraGuideWindow 「창턱. 해가 제일 오래 드는 자리야」
     lamp =  g.moved && g.movedDays >= 5    ⇒ monsteraGuideLamp   「옮겼는데도 안 나네… 등」
   ⚠ 그런데 `moveMonstera` 가 «처음 놓는 것»에도 불린다(§startPhonePlacePotBag).
     ⇒ ★ 그러면 놓자마자 `g.moved` 가 참이 되어 «자리 유도»가 영영 안 뜰 수 있다. 눌러서 본다.
   ⇒ 어두운 자리(책상)에 놓고 하루씩 넘기며 «무엇이 언제 뜨나»를 적는다.
   ⛔ 값은 안 바꾼다. */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8972';
const N = +(process.env.BYEOT_N || 16);
const MOVED = process.env.BYEOT_MOVED === '1';
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 900000);
wd.unref && wd.unref();
const page = await launch({ width: 390, height: 844, dpr: 1 });
await page.goto(`${BASE}/game.html`);
await page.eval('localStorage.clear()', false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 150000, 300);
await sleep(5000);
await page.eval(`try{ window.__byeotSkipDayAnim = true; }catch(e){}`, false);
const calm = async () => { for (let i = 0; i < 30; i++) {
  const b = await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');
    return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`);
  if (b !== 'true') break;
  await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s)s.click();
    const x=document.getElementById('dlgBox'); if(x)x.click();
    const g=document.getElementById('guideClose'); if(g)g.click();})()`, false);
  await sleep(200); } };
await calm();
/* 도착 «직후»와 같은 꼴로 세운다 — 그리고 어두운 자리(책상)에 «놓는다» */
console.log('■ 세우기 —', await page.eval(`(()=>{ try{ const S=window.__S();
  S.pots = S.pots || []; S.pots.length = 0;
  S.pots.push({ id:'pot_a', itemId:'pot', plantId:'monstera', leafGrades:{}, leafGradesSeen:{},
    cuts:[], daysPlanted:0, fedDays:0, arrivedOnDay:S.day, wateredOnDay:S.day,
    arrivalGrowthDays:45, dliHist:[], placedOnce:true, slotId:'banjiha-desk:0', at:null });
  const fp=S.firstPlay;
  fp.monstera.arrived = true; fp.phase='move_monstera';
  fp.monstera.slotId = 'banjiha-desk:0';
  /* MOVED=1 이면 가방에서 놓은 사람을 흔낸다 — 실제 길은 startPhonePlacePotBag 이
     moveMonstera 를 부르고, 그것이 g.moved 를 참으로 만든다(first_play:3367) */
  fp.monstera.guide = { days:0, moved:${MOVED}, movedDays:0, grewOnce:false };
  fp.completed = false;                       /* ★ 끝난 판이면 monsteraGuideOf 가 무조건 false 다 */
  try{ fp.monstera.growthPhase = null; }catch(e){}
  try{ window.__io.growth.setGrowth(45); }catch(e){}
  fp.beansprout.slotId = 'banjiha-dresser:0';
  const sp=(fp.beansprout.pots||[])[0]; if(sp){ sp.slotId='banjiha-dresser:0'; sp.at=null; }
  window.__redraw();
  return JSON.stringify({ phase:fp.phase, guide:fp.monstera.guide }); }
catch(e){ return 'err '+e.message; } })()`));
await sleep(1500);
const snap = () => page.eval(`(()=>{ const S=window.__S(), fp=S.firstPlay||{};
  const g=(fp.monstera&&fp.monstera.guide)||{};
  return JSON.stringify({ day:S.day, days:g.days, moved:!!g.moved, movedDays:g.movedDays,
    grewOnce:!!g.grewOnce, phase:fp.phase,
    대사:(window.__dlgLog||[]).map(x=>x.id).slice(-3) }); })()`);
console.log('  시작 —', await snap());
for (let i = 0; i < N; i++) {
  const ok = await page.eval(`(()=>{ const b=document.getElementById('next');
    if(!b || b.disabled) return false; b.click(); return true; })()`);
  if (ok !== 'true' && ok !== true) { console.log(`  d+${i} ⛔ [다음 날]이 안 눌립니다`); break; }
  await sleep(1400);
  await calm();
  const s = JSON.parse(await snap());
  console.log(`  d${s.day}  days=${s.days} moved=${s.moved} movedDays=${s.movedDays} grew=${s.grewOnce}  대사 ${JSON.stringify(s.대사)}`);
}
console.log('\n■ 대사 기록 전체 —', await page.eval(`(()=>JSON.stringify((window.__dlgLog||[]).map(x=>x.id)))()`));
console.log('■ 유도 두 걸음이 났나 —', await page.eval(`(()=>{ const ids=(window.__dlgLog||[]).map(x=>x.id);
  return JSON.stringify({ 자리유도: ids.includes('monsteraGuideWindow'),
                          등유도:  ids.includes('monsteraGuideLamp') }); })()`));
await page.close(); clearTimeout(wd);
