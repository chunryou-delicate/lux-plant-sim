/* tools/probe_guideorder.mjs — **유도 차례가 「자리 → 등」으로 도나** (총괄 ①②③④)
   ⚠ 상태를 찌르지 않는다 — 가방 칸을 «눌러» 실제 길(startPhonePlacePotBag → moveMonstera)로 놓는다.
   ① 놓기만 하고 11일  ⇒ 「창턱」이 뜨나
   ② 창턱으로 옮기고 6일 ⇒ 「등」이 뜨나
   ③ 놓기만 하고 20일   ⇒ 「등」이 «안 떠야» 한다
   ④ 옮기기 퀘스트(monstera_home)가 여전히 도나
   ⛔ 값은 안 바꾼다. */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8972';
const MODE = process.env.BYEOT_MODE || 'stay';     /* stay | move */
const N = +(process.env.BYEOT_N || 12);
/* move = 창턱(밝다·자란다) · dark = 서랍장(어둡다·안 자란다) */
const DEST = MODE === 'dark' ? 'banjiha-dresser:1' : 'banjiha-sill:0';
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 900000);
wd.unref && wd.unref();
const page = await launch({ width: 390, height: 844, dpr: 1 });
try { await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 }); } catch {}
await page.goto(`${BASE}/game.html`);
await page.eval('localStorage.clear()', false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 150000, 300);
await sleep(5000);
await page.eval('try{ window.__byeotSkipDayAnim = true; }catch(e){}', false);
const calm = async () => { for (let i = 0; i < 30; i++) {
  const b = await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');
    return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`);
  if (b !== 'true') break;
  await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s)s.click();
    const x=document.getElementById('dlgBox'); if(x)x.click();
    const g=document.getElementById('guideClose'); if(g)g.click();})()`, false);
  await sleep(200); } };
await calm();
console.log('SETUP —', await page.eval(`(()=>{ try{ const S=window.__S();
  S.pots=S.pots||[]; S.pots.length=0;
  S.pots.push({ id:'pot_a', itemId:'pot', plantId:'monstera', leafGrades:{}, leafGradesSeen:{},
    cuts:[], daysPlanted:0, fedDays:0, arrivedOnDay:S.day, wateredOnDay:S.day,
    arrivalGrowthDays:45, dliHist:[], placedOnce:false, slotId:null, at:null });
  const fp=S.firstPlay;
  fp.monstera.arrived=true; fp.phase='move_monstera';
  fp.monstera.slotId=null; fp.monstera.at=null;
  fp.monstera.guide={ days:0, moved:false, movedDays:0, grewOnce:false };
  fp.completed=false; fp.monstera.growthPhase=null;
  fp.beansprout.slotId='banjiha-dresser:0';
  const sp=(fp.beansprout.pots||[])[0]; if(sp){ sp.slotId='banjiha-dresser:0'; sp.at=null; }
  window.__redraw();
  try{ window.__io.growth.setGrowth(45); window.__redraw(); }catch(e){}
  return JSON.stringify({ guide:fp.monstera.guide, potSlot:S.pots[0].slotId }); }
catch(e){ return 'err '+e.message; } })()`));
await sleep(1800);
/* ★ 가방 칸을 «눌러» 놓는다 — 실제 길 */
await page.eval('try{ window.__byeotSheet.open("bag") }catch(e){}', false);
await sleep(1400);
const c = JSON.parse(await page.eval(`(()=>{ const e=document.querySelector('[data-potbag]');
  if(!e) return JSON.stringify({err:'칸 없음'});
  if(e.scrollIntoView) e.scrollIntoView({block:'center'});
  const r=e.getBoundingClientRect();
  return JSON.stringify({x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)}); })()`));
if (c.err) { console.log('⛔', c.err); process.exit(0); }
await page.send('Input.dispatchTouchEvent', { type:'touchStart', touchPoints:[{x:c.x,y:c.y,radiusX:12,radiusY:12,force:1,id:1}] });
await sleep(90);
await page.send('Input.dispatchTouchEvent', { type:'touchEnd', touchPoints:[] });
await sleep(1800);
await page.eval(`(()=>{ const b=document.getElementById('placeOk');
  if(b && getComputedStyle(b).display!=='none') b.click(); })()`, false);
await sleep(1200); await calm();
const snap = () => page.eval(`(()=>{ const S=window.__S(), fp=S.firstPlay||{};
  const g=(fp.monstera&&fp.monstera.guide)||{};
  let q=null; try{ q=(window.__questView()||{}).doneIds||null; }catch(e){}
  return JSON.stringify({ day:S.day, days:g.days, moved:!!g.moved, movedDays:g.movedDays,
    자리:(S.pots[0]||{}).slotId, 할일:((document.getElementById('quest')||{}).textContent||'').trim().slice(0,26),
    homeDone: Array.isArray(q)? q.includes('monstera_home') : null }); })()`);
console.log('놓은 뒤 —', await snap());
const nextDay = async () => {
  const ok = await page.eval(`(()=>{ const b=document.getElementById('next');
    if(!b||b.disabled) return false; b.click(); return true; })()`);
  await sleep(1400); await calm();
  return ok;
};
for (let i = 0; i < N; i++) {
  if (MODE !== 'stay' && i === 3) {
    console.log('  ★ 창턱으로 «옮긴다» —', await page.eval(`(()=>{ const s=document.getElementById('slot');
      s.value='${DEST}'; s.dispatchEvent(new Event('change',{bubbles:true})); return 'ok'; })()`));
    await sleep(1500); await calm();
    console.log('    옮긴 뒤 —', await snap());
  }
  await nextDay();
  const s = JSON.parse(await snap());
  console.log(`  d${s.day} days=${s.days} moved=${s.moved} movedDays=${s.movedDays} 자리=${s.자리} home=${s.homeDone}`);
}
console.log('\n■ 대사 —', await page.eval('(()=>JSON.stringify((window.__dlgLog||[]).map(x=>x.id)))()'));
console.log('■ 유도 —', await page.eval(`(()=>{ const ids=(window.__dlgLog||[]).map(x=>x.id);
  return JSON.stringify({ 자리유도: ids.includes('monsteraGuideWindow'), 등유도: ids.includes('monsteraGuideLamp') }); })()`));
await page.close(); clearTimeout(wd);
