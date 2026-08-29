/* tools/probe_bagtap_confirm.mjs — **가방 몬스테라를 «누르면» 확인 화면이 서나** (2026-08-29)
   총괄이 재라 한 셋:
     ① 누른 뒤 확인바가 «보이나» — display · 화면 안인가
     ② [다시 옮기기]가 «먹나» — 자리를 바꿀 수 있나
     ③ ★ [취소]가 «가방으로 돌려주나» — 안 돌아가면 그것이 새 함정이다
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
const setup = () => page.eval(`(()=>{ const S=window.__S(); S.pots=S.pots||[];
  const p={ id:'pot_bag', itemId:'pot', plantId:'monstera', leafGrades:{}, leafGradesSeen:{},
            cuts:[], daysPlanted:0, fedDays:0, arrivedOnDay:S.day, wateredOnDay:S.day,
            arrivalGrowthDays:45, dliHist:[], placedOnce:false, slotId:null, at:null };
  S.pots.length=0; S.pots.push(p); window.__redraw();
  return JSON.stringify({ pots:S.pots.length }); })()`);
console.log('SETUP —', await setup());
await sleep(2000);

const look = () => page.eval(`(()=>{ const S=window.__S(), p=(S.pots||[])[0], pk=window.__picked||{};
  const vis=(e)=>{ if(!e) return false; const cs=getComputedStyle(e);
    return cs.display!=='none'&&cs.visibility!=='hidden'&&+cs.opacity>0.05; };
  const pc=document.getElementById('placeConfirm'), r=pc?pc.getBoundingClientRect():null;
  const bag=()=>document.querySelectorAll('[data-potbag]').length;
  return JSON.stringify({ 화분자리: p?p.slotId:null, 놓인적: p?p.placedOnce:null,
    골라진것: pk.slotId||null, 확인모드: !!pk.confirming, 모드: pk.mode||null,
    '확인바 보이나': vis(pc),
    '확인바 자리': r? Math.round(r.width)+'x'+Math.round(r.height)+'@('+Math.round(r.left)+','+Math.round(r.top)+')':'?',
    '화면 안': r? (r.top>=0 && r.left>=0 && r.bottom<=844 && r.right<=390) : null,
    '가방 칸 수': bag() }); })()`);
const tapEl = async (id) => {
  const c = JSON.parse(await page.eval(`(()=>{ const e=document.getElementById('${id}');
    if(!e) return JSON.stringify({err:'없음'});
    const r=e.getBoundingClientRect();
    const cs=getComputedStyle(e);
    if(cs.display==='none') return JSON.stringify({err:'안 보임'});
    return JSON.stringify({x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)}); })()`));
  if (c.err) return c.err;
  await page.send('Input.dispatchTouchEvent', { type:'touchStart', touchPoints:[{x:c.x,y:c.y,radiusX:12,radiusY:12,force:1,id:1}] });
  await sleep(80);
  await page.send('Input.dispatchTouchEvent', { type:'touchEnd', touchPoints:[] });
  await sleep(1200);
  return 'ok';
};
const tapBagCell = async () => {
  await page.eval(`try{ window.__byeotSheet.open('bag') }catch(e){}`, false);
  await sleep(1300);
  const c = JSON.parse(await page.eval(`(()=>{ const e=document.querySelector('[data-potbag]');
    if(!e) return JSON.stringify({err:'칸 없음'});
    if(e.scrollIntoView) e.scrollIntoView({block:'center'});
    const r=e.getBoundingClientRect();
    return JSON.stringify({x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)}); })()`));
  if (c.err) return c.err;
  await sleep(400);
  await page.send('Input.dispatchTouchEvent', { type:'touchStart', touchPoints:[{x:c.x,y:c.y,radiusX:12,radiusY:12,force:1,id:1}] });
  await sleep(90);
  await page.send('Input.dispatchTouchEvent', { type:'touchEnd', touchPoints:[] });
  await sleep(1800);
  return 'ok';
};

console.log('\n=== ① 가방 칸을 «눌렀다» ===');
console.log('  전 —', await look());
console.log('  누르기 —', await tapBagCell());
console.log('  ★ 후 —', await look());
console.log('  확인바 글 —', await page.eval(`(()=>{ const e=document.getElementById('placeConfirm');
  return (e.textContent||'').trim().replace(/\s+/g,' ').slice(0,70); })()`));

console.log('\n=== ② [다시 옮기기] ===');
console.log('  누르기 —', await tapEl('placeAgain'));
console.log('  후 —', await look());
console.log('  아래글 —', await page.eval(`(()=>{ const e=document.getElementById('dropLabel'), cs=getComputedStyle(e);
  return (cs.display!=='none'?'보임 ':'⛔안보임 ')+(e.textContent||'').trim(); })()`));

console.log('\n=== ③ [취소] — 가방으로 돌아가나 ===');
/* 옮기기 모드를 한 번 끝내고(그 자리에 놓고) 확인바로 돌아온다 */
await page.eval(`(()=>{ try{ const d=window.__picked; if(d.mode==='move'){ d.mode=null;
  document.getElementById('stage').classList.remove('moving'); } }catch(e){} })()`, false);
await sleep(500);
await page.eval(`(()=>{ try{ placeConfirm.show(); }catch(e){} })()`, false);
await sleep(500);
console.log('  누르기 —', await tapEl('placeCancel'));
await sleep(800);
console.log('  ★ 후 —', await look());
await page.eval(`try{ window.__byeotSheet.open('bag') }catch(e){}`, false);
await sleep(1300);
console.log('  ⇒ 가방에 칸이 —', await page.eval(`(()=>String(document.querySelectorAll('[data-potbag]').length))()`), '개');

console.log('=== 4. [확인] — 그 자리에 놓이나 ===');
console.log('  다시 세우기 —', await setup()); await sleep(1500);
console.log('  누르기 —', await tapBagCell());
console.log('  ★ [확인] —', await tapEl('placeOk')); await sleep(900);
console.log('  후 —', await look());
await page.close(); clearTimeout(wd);
