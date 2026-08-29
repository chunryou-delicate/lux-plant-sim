/* tools/probe_movehint.mjs — **[옮기기] 뒤에 «갈 자리»를 가리키나** (박사님 ④)
   박사님: *"창턱으로 몬스테라 옮기기 가이드할때, «옮기기 눌러서 격자나올때» «옴길위치»에
     손가락 가이드해줘"*
   재는 것: ① 화분을 고르기 전 ② 고른 뒤 ③ ★ [옮기기] 뒤 — 손가락이 «어디»를 가리키나
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
for (let i = 0; i < 40; i++) {
  const b = await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');
    return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`);
  if (b !== 'true') break;
  await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s)s.click();
    const x=document.getElementById('dlgBox'); if(x)x.click();
    const g=document.getElementById('guideClose'); if(g)g.click();})()`, false);
  await sleep(250);
}
/* 도착 직후와 같은 꼴 — 화분이 «책상»에 서 있고 phase 는 move_monstera */
console.log('■ 세우기 —', await page.eval(`(()=>{ const S=window.__S(); S.pots=S.pots||[];
  S.pots.length=0;
  S.pots.push({ id:'pot_a', itemId:'pot', plantId:'monstera', leafGrades:{}, leafGradesSeen:{},
    cuts:[], daysPlanted:0, fedDays:0, arrivedOnDay:S.day, wateredOnDay:S.day,
    arrivalGrowthDays:45, dliHist:[], placedOnce:true, slotId:'banjiha-desk:0', at:null });
  try{ S.firstPlay.monstera.arrived = true; S.firstPlay.phase='move_monstera';
       S.firstPlay.beansprout.slotId='banjiha-dresser:0';
       const sp=(S.firstPlay.beansprout.pots||[])[0]; if(sp){ sp.slotId='banjiha-dresser:0'; sp.at=null; } }catch(e){}
  window.__redraw();
  return JSON.stringify({ phase:(S.firstPlay||{}).phase }); })()`));
await sleep(2500);
const hint = async () => { await page.eval(`try{ window.__byeotHint() }catch(e){}`, false); await sleep(350);
  return page.eval(`(()=>{ const h=document.getElementById('hint');
  const r=h.getBoundingClientRect();
  return JSON.stringify({ 손가락: h.classList.contains('on')?'★뜸':'⛔없음',
    말: ((h.querySelector('.say')||{}).textContent||'').trim(),
    자리: h.classList.contains('on')? '('+Math.round(r.left)+','+Math.round(r.top)+')' : '-',
    모드: (window.__picked||{}).mode || null,
    끄는것: (window.__drag||{}).what || null }); })()`); };
console.log('\n=== ① 아무것도 안 고른 판 ==='); console.log(' ', await hint());
console.log('\n=== ② 화분을 골랐다 ===');
await page.eval(`(()=>{ window.__picked.select('banjiha-desk:0'); })()`, false); await sleep(800);
console.log(' ', await hint());
console.log('\n=== ③ [옮기기] 를 눌렀다 (격자가 뜬 상태) ===');
await page.eval(`(()=>{ const b=document.getElementById('pickMove'); if(b) b.click(); })()`, false);
await sleep(1000);
console.log(' ', await hint());
console.log('  창턱 자리 화면 좌표 —', await page.eval(`(()=>{ try{
  const rv=window.__rv, r=document.getElementById('roomCanvas').getBoundingClientRect();
  const p=rv.screenPosOf('banjiha-sill:0');
  return p? '('+Math.round(r.left+p.x)+','+Math.round(r.top+p.y)+')' : 'null'; }catch(e){ return 'err'; } })()`));
console.log('  아래글 —', await page.eval(`(()=>{ const e=document.getElementById('dropLabel'), cs=getComputedStyle(e);
  return JSON.stringify({ display: cs.display, 글: e.textContent,
    'moveDropLabelKo()': (()=>{ try{ return String(window.__moveLabel ? window.__moveLabel() : 'no-hook'); }catch(x){ return 'err '+x.message; } })(),
    'drag.what': (window.__drag||{}).what||null,
    phase: (window.__S().firstPlay||{}).phase||null }); })()`));
await page.close(); clearTimeout(wd);
