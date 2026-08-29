/* tools/probe_placecells.mjs — **가방에서 끌 때 «놓을 수 있는 칸»이 뜨나** (박사님 2026-08-29)
   ------------------------------------------------------------------
   박사님: *"몬스테라 받고 «바로 드래그»하면 «시루 옮길 때처럼» 그 «배치할수있는 칸»들이
   나오고 해야되는데 «그게 안 나와». … 그 이후에 «옮기기는 잘 되는데»,
   처음 «인벤에서 드래그»하면 «배치될 수 있게» 안 나와."*
   ⇒ ★ 되는 쪽(시루)과 안 되는 쪽(몬스테라)을 «같은 자»로 나란히 잰다.
   재는 것:
     ① `#slot`(몬스테라) vs `#cropSlot`(시루) — 칸 수 · 잠겼나
     ② `fillSlots` 의 `fits` — 몬스테라 화분 지름으로 «거르고 나면» 몇 자리 남나
     ③ 끄는 «동안» — drag.valid 수 · 방에 실제로 «선 네모 수»(userData.highlightSlotId)
   ⛔ 값은 아무것도 안 바꾼다. */
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

/* 가방에 «안 놓은» 몬스테라 하나 — 도착 직후와 같은 꼴 */
console.log('■ 세우기 —', await page.eval(`(()=>{ try{ const S=window.__S(); S.pots=S.pots||[];
  let p=S.pots[0];
  if(!p){ p={ id:'pot_probe', itemId:'pot', plantId:'monstera', leafGrades:{}, leafGradesSeen:{},
              cuts:[], daysPlanted:0, fedDays:0, arrivedOnDay:S.day, wateredOnDay:S.day,
              arrivalGrowthDays:45, dliHist:[] }; S.pots.push(p); }
  p.placedOnce=false; p.slotId=null; p.at=null; window.__redraw();
  return JSON.stringify({ id:p.id, placedOnce:p.placedOnce, firstPlay: !!(S.firstPlay&&S.firstPlay.enabled) });
}catch(e){ return JSON.stringify({err:e.message}); } })()`));
await sleep(2000);

console.log('\n=== ① 자리 목록 두 벌 ===');
console.log(await page.eval(`(()=>{ const f=(id)=>{ const s=document.getElementById(id);
  if(!s) return id+': «없음»';
  const opts=[...s.options].map(o=>o.value).filter(Boolean);
  return id+': 칸 '+opts.length+'개 · 잠김 '+s.disabled+(opts.length?'  ['+opts.slice(0,4).join(', ')+(opts.length>4?', …':'')+']':''); };
  return [f('slot'), f('cropSlot'), f('musunSlot')].join('   //   '); })()`));

console.log('\n=== ② 몬스테라 화분 지름으로 «거르면» 몇 자리 남나 ===');
console.log(await page.eval(`(()=>{ try{
  const rv=window.__rv, io=window.__io, S=window.__S();
  const rep = io.light.daily(S.day+1, S).report;
  return JSON.stringify({ 방이_아는_자리: rep.slots.length,
    'select#slot 에 실린 수': [...document.getElementById('slot').options].filter(o=>o.value).length });
}catch(e){ return 'err '+e.message; } })()`));

const rings = () => page.eval(`(()=>{ let n=0; try{ window.__rv.three.scene.traverse(o=>{
  if(o.userData && o.userData.highlightSlotId) n++; }); }catch(e){ return 'err'; } return String(n); })()`);
const dragSt = () => page.eval(`(()=>{ const d=window.__drag||{};
  return JSON.stringify({ 끄는중: !!d.on, 무엇: d.what||null, valid수: (d.valid||[]).length,
    아래글: (document.getElementById('dropLabel')||{}).textContent||'' }); })()`);

const cellAt = async (sel) => JSON.parse(await page.eval(`(()=>{ const c=document.querySelector('${sel}');
  if(!c) return JSON.stringify({err:'칸 없음'});
  if(c.scrollIntoView) c.scrollIntoView({block:'center'});
  const r=c.getBoundingClientRect();
  return JSON.stringify({ x:Math.round(r.left+r.width/2), y:Math.round(r.top+r.height/2),
    nm:((c.querySelector('.nm')||{}).textContent||'?').trim() }); })()`));

const dragCell = async (name, sel, shot) => {
  await page.eval(`try{ window.__byeotSheet.open('bag') }catch(e){}`, false);
  await sleep(1200);
  const c = await cellAt(sel);
  if (c.err) { console.log(`  ${name} — ⛔ ${c.err}`); return; }
  await sleep(500);
  const p = { x: c.x, y: c.y, radiusX: 12, radiusY: 12, force: 1, id: 1 };
  await page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [p] });
  await sleep(100);
  for (let i = 1; i <= 6; i++) { await page.send('Input.dispatchTouchEvent', { type: 'touchMove',
    touchPoints: [{ ...p, x: c.x, y: c.y - 60 * i }] }); await sleep(70); }
  await sleep(400);
  console.log(`  ${name} «${c.nm}» — ${await dragSt()}  ⇒ ★ 방에 «선 네모» ${await rings()}개`);
  if (shot) await page.shot(shot);
  await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(900);
  await page.eval(`(()=>{ try{ window.__picked.clear(); }catch(e){} })()`, false);
  await sleep(400);
};

console.log('\n=== ③ 끄는 «동안» — 되는 쪽과 안 되는 쪽을 나란히 ===');
console.log('  끌기 전 — 방에 선 네모', await rings(), '개');
await dragCell('몬스테라', '[data-potbag]', 'docs/handoff/img/placecell_monstera.png');
await dragCell('시루    ', '[data-place]',  'docs/handoff/img/placecell_siru.png');
await page.close(); clearTimeout(wd);
