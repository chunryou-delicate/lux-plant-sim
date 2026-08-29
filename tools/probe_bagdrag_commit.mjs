/* tools/probe_bagdrag_commit.mjs — **가방에서 «끌어 놓기»가 실제로 «놓이나»** (박사님 ⑤)
   ------------------------------------------------------------------
   박사님 2026-08-29: *"★ «드래그 배치 자체가 없어진거야»? 살렸으면 좋겟어.
     ★★ 축복받은 몬스테라도 «되게 바꾸고»."*
   ⚠ 앞서 probe_dropmap 은 「받는 점이 있나」(drag.best.ok)만 쟀다 — ★ **놓는 것까지는 안 쟀다.**
     「받는다」와 「놓인다」는 다르다. 여기서는 **손을 떼고 실제로 놓였는지**를 본다.
   ⇒ 몬스테라 · 시루 둘 다. 같은 점 · 같은 자.
   쓰기: node tools/probe_bagdrag_commit.mjs        (BYEOT_URL 로 판 바꿈)
   ⛔ 값은 안 바꾼다. */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8972';
const FILE = process.env.BYEOT_FILE || 'game.html';
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 420000);
wd.unref && wd.unref();
const H = +(process.env.BYEOT_H || 844);
const page = await launch({ width: 390, height: H, dpr: 1 });
try { await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 }); } catch {}
await page.goto(`${BASE}/${FILE}`);
await page.eval('localStorage.clear()', false);
await page.goto(`${BASE}/${FILE}`);
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
console.log('■ 판 —', FILE, '· SETUP —', await page.eval(`(()=>{ const S=window.__S(); S.pots=S.pots||[];
  const p={ id:'pot_bag', itemId:'pot', plantId:'monstera', leafGrades:{}, leafGradesSeen:{},
            cuts:[], daysPlanted:0, fedDays:0, arrivedOnDay:S.day, wateredOnDay:S.day,
            arrivalGrowthDays:45, dliHist:[], placedOnce:false, slotId:null, at:null };
  S.pots.length=0; S.pots.push(p); window.__redraw();
  return JSON.stringify({ pots:S.pots.length }); })()`));
await sleep(2000);

/* 받는 점을 «찾아» 거기에 놓는다 — 실측(probe_dropmap)에서 방 가운데 아래쪽이 받는다 */
const AIM = { x: 195, y: Math.round(H * 0.59) };
const state = () => page.eval(`(()=>{ const S=window.__S(), p=(S.pots||[])[0], pk=window.__picked||{};
  const sites=(()=>{ try{ return (window.__S().firstPlay.beansprout.pots||[])
    .map(x=>({id:x.id, slotId:x.slotId||null})); }catch(e){ return []; } })();
  return JSON.stringify({ 몬스테라자리: p?p.slotId:null, 몬스테라놓인적: p?p.placedOnce:null,
    시루들: sites, 확인모드: !!pk.confirming, 골라진것: pk.slotId||null,
    '가방 몬스테라 칸': document.querySelectorAll('[data-potbag]').length }); })()`);

const dragDrop = async (name, sel) => {
  await page.eval(`try{ window.__byeotSheet.open('bag') }catch(e){}`, false);
  await sleep(1300);
  const c = JSON.parse(await page.eval(`(()=>{ const e=document.querySelector('${sel}');
    if(!e) return JSON.stringify({err:'칸 없음'});
    if(e.scrollIntoView) e.scrollIntoView({block:'center'});
    const r=e.getBoundingClientRect();
    return JSON.stringify({x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2),
      nm:((e.querySelector('.nm')||{}).textContent||'?').trim()}); })()`));
  if (c.err) { console.log(`\n=== ${name} — ⛔ ${c.err}`); return; }
  await sleep(400);
  console.log(`\n=== ${name} «${c.nm}» — (${c.x},${c.y}) 에서 (${AIM.x},${AIM.y}) 로 끈다 ===`);
  console.log('  전 —', await state());
  const p = { radiusX: 12, radiusY: 12, force: 1, id: 1 };
  await page.send('Input.dispatchTouchEvent', { type:'touchStart', touchPoints:[{ ...p, x:c.x, y:c.y }] });
  await sleep(110);
  for (let i = 1; i <= 8; i++) {
    await page.send('Input.dispatchTouchEvent', { type:'touchMove',
      touchPoints:[{ ...p, x: Math.round(c.x + (AIM.x - c.x) * i / 8), y: Math.round(c.y + (AIM.y - c.y) * i / 8) }] });
    await sleep(55);
  }
  console.log('  끄는 중 —', await page.eval(`(()=>{ const d=window.__drag||{};
    return JSON.stringify({ 끄는중:!!d.on, 무엇:d.what||null, 받나:!!(d.best&&d.best.ok),
      아래글:(document.getElementById('dropLabel')||{}).textContent||'' }); })()`));
  await page.send('Input.dispatchTouchEvent', { type:'touchEnd', touchPoints:[] });
  await sleep(1500);
  console.log('  ★ 놓은 뒤 —', await state());
};
await dragDrop('몬스테라', '[data-potbag]');
await dragDrop('시루', '[data-place]');
await page.close(); clearTimeout(wd);
