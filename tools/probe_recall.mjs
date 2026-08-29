/* tools/probe_recall.mjs — **「📦 가방으로」를 누르면 «방에서 사라지나»** (박사님 2026-08-29)
   박사님: *"몬스테라 «눌러서 가방으로» 눌렀는데 ★ «화면에서 안 사라지고» 가방에 들어가네"*
   재는 것: ① 상태가 되돌아가나 ② 가방 칸이 생기나 ③ ★ 방에서 «지워지나» ④ 다시 놓으면 «둘»이 되나
   ⛔ 값은 안 바꾼다. */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8972';
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 400000);
wd.unref && wd.unref();
const page = await launch({ width: 390, height: 844, dpr: 1 });
try { await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 }); } catch {}
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
console.log('■ 세우기 —', await page.eval(`(()=>{ const S=window.__S(); S.pots=S.pots||[];
  S.pots.length=0;
  S.pots.push({ id:'pot_a', itemId:'pot', plantId:'monstera', leafGrades:{}, leafGradesSeen:{},
    cuts:[], daysPlanted:0, fedDays:0, arrivedOnDay:S.day, wateredOnDay:S.day,
    arrivalGrowthDays:45, dliHist:[], placedOnce:true, slotId:'banjiha-desk:0', at:null });
  try{ S.firstPlay.monstera.arrived = true; }catch(e){}
  window.__redraw();
  return JSON.stringify({ pots:S.pots.length }); })()`));
await sleep(2500);

const look = () => page.eval(`(()=>{ const S=window.__S();
  let drawn=0; try{ window.__rv.three.scene.traverse(o=>{ const u=o.userData||{};
    if (u.slotId || u.potId) drawn++; }); }catch(e){ drawn='err'; }
  let isPlant=null; try{ isPlant = !!window.__byeotIsPlantSlot('banjiha-desk:0'); }catch(e){ isPlant='err'; }
  return JSON.stringify({
    'S.pots': (S.pots||[]).map(p=>({ id:p.id, slotId:p.slotId||null, at:!!p.at, placedOnce:p.placedOnce })),
    '가방 칸': document.querySelectorAll('[data-potbag]').length,
    '방이 그 자리를 식물 자리로 보나': isPlant,
    '방에 표시된 물건 수(userData)': drawn }); })()`);

console.log('\n=== ① 누르기 전 ===');
console.log(' ', await look());

console.log('\n=== ② 화분을 고르고 [📦 가방으로] 를 누른다 ===');
await page.eval(`(()=>{ window.__picked.select('banjiha-desk:0'); })()`, false);
await sleep(900);
console.log('  [가방으로] 단추 —', await page.eval(`(()=>{ const b=document.getElementById('pickTake');
  if(!b) return '«없음»'; const cs=getComputedStyle(b);
  return (cs.display!=='none'?'★보임':'⛔안보임'); })()`));
await page.eval(`(()=>{ const b=document.getElementById('pickTake'); if(b) b.click(); })()`, false);
await sleep(2000);
console.log('  ★ 누른 뒤 —', await look());

console.log('\n=== ③ 한 번 더 그려도 남나 (redraw) ===');
await page.eval(`(()=>{ try{ window.__redraw(); }catch(e){} })()`, false);
await sleep(1500);
console.log(' ', await look());

console.log('\n=== ④ 다시 꺼내 놓으면 «둘»이 되나 ===');
await page.eval(`try{ window.__byeotSheet.open('bag') }catch(e){}`, false); await sleep(1400);
const c = JSON.parse(await page.eval(`(()=>{ const e=document.querySelector('[data-potbag]');
  if(!e) return JSON.stringify({err:'칸 없음'});
  if(e.scrollIntoView) e.scrollIntoView({block:'center'});
  const r=e.getBoundingClientRect();
  return JSON.stringify({x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)}); })()`));
if (!c.err) {
  await page.send('Input.dispatchTouchEvent', { type:'touchStart', touchPoints:[{x:c.x,y:c.y,radiusX:12,radiusY:12,force:1,id:1}] });
  await sleep(90);
  await page.send('Input.dispatchTouchEvent', { type:'touchEnd', touchPoints:[] });
  await sleep(1800);
  await page.eval(`(()=>{ const b=document.getElementById('placeOk'); if(b && getComputedStyle(b).display!=='none') b.click(); })()`, false);
  await sleep(1500);
} else console.log('  ⛔', c.err);
console.log(' ', await look());

/* ★★ ⑤ 이번엔 «진짜 터치»로 화분을 고르고, 자리가 «free 좌표»인 판이다 — 박사님이 하신 그 꼴 */
console.log('=== 5. 진짜 «터치»로 고르고 [가방으로] (자리가 free 좌표) ===');
const pos = JSON.parse(await page.eval(`(()=>{ try{ const rv=window.__rv;
  const S=window.__S(); const key=(S.pots[0]||{}).slotId;
  const r=document.getElementById('roomCanvas').getBoundingClientRect();
  const p=rv.screenPosOf(key); if(!p) return JSON.stringify({err:'screenPosOf null · key='+key});
  return JSON.stringify({ key, x:Math.round(r.left+p.x), y:Math.round(r.top+p.y) });
}catch(e){ return JSON.stringify({err:e.message}); } })()`));
console.log('  화분 자리 —', JSON.stringify(pos));
if (!pos.err) {
  let got = '';
  for (let dy = -40; dy <= 20 && !got; dy += 6) {
    await page.eval(`(()=>{ try{ window.__picked.clear(); }catch(e){} })()`, false);
    await page.send('Input.dispatchTouchEvent', { type:'touchStart', touchPoints:[{x:pos.x,y:pos.y+dy,radiusX:12,radiusY:12,force:1,id:1}] });
    await sleep(60);
    await page.send('Input.dispatchTouchEvent', { type:'touchEnd', touchPoints:[] });
    await sleep(300);
    got = await page.eval(`(()=>{ const pk=window.__picked||{}; return pk.slotId||''; })()`);
  }
  console.log('  터치로 골라진 것 —', got || '⛔ 못 골랐다');
  console.log('  [가방으로] —', await page.eval(`(()=>{ const b=document.getElementById('pickTake');
    if(!b) return '«없음»'; const cs=getComputedStyle(b);
    if(cs.display==='none') return '⛔ 안 보임';
    b.click(); return '눌렀다'; })()`));
  await sleep(2000);
  console.log('  ★ 후 —', await look());
}
await page.close(); clearTimeout(wd);
