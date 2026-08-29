/* tools/probe_bagdrag_long.mjs — **«긴 가방»(스크롤되는 가방)에서 끌기가 되나** (박사님 ⑤)
   ------------------------------------------------------------------
   ⛔ 지금까지 잰 판은 가방이 «안 스크롤»됐다(pageBag 586 = scrollHeight 586).
     박사님 판은 14일차·지갑 117만이라 가방이 «길다». ⇒ ★ 다른 판을 재고 있었다.
   ⇒ 여기서는 **스크롤되는 것을 확인하고** 시작한다. 그 상태에서 끌면 무엇이 일어나나:
     · 방이 도나 · 가방이 «위아래로 밀리나» · 아무 일도 안 나나 · 놓이나
   ⛔ 값은 안 바꾼다. */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8972';
const N = +(process.env.BYEOT_N || 12);
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
/* 가방을 «길게» — 안 놓은 화분을 여럿 세운다(박사님 판은 물건이 여럿이다) */
console.log('■ 세우기 —', await page.eval(`(()=>{ const S=window.__S(); S.pots=S.pots||[];
  S.pots.length=0;
  for (let i=0;i<${N};i++) S.pots.push({ id:'pot_bag'+i, itemId:'pot', plantId:'monstera',
    leafGrades:{}, leafGradesSeen:{}, cuts:[], daysPlanted:0, fedDays:0, arrivedOnDay:S.day,
    wateredOnDay:S.day, arrivalGrowthDays:45, dliHist:[], placedOnce:false, slotId:null, at:null });
  window.__redraw();
  return JSON.stringify({ pots:S.pots.length }); })()`));
await sleep(2000);
await page.eval(`try{ window.__byeotSheet.open('bag') }catch(e){}`, false);
await sleep(1600);
const box = JSON.parse(await page.eval(`(()=>{ const e=document.getElementById('pageBag');
  if(!e) return JSON.stringify({err:'pageBag 없음'});
  const cs=getComputedStyle(e);
  let sc=e, guard=0;
  while (sc && guard++<6 && sc.scrollHeight<=sc.clientHeight) sc=sc.parentElement;
  return JSON.stringify({ pageBag:{ h:e.clientHeight, sh:e.scrollHeight, overflowY:cs.overflowY },
    '실제 스크롤되는 것': sc? (sc.id||sc.className||sc.tagName) : '없음',
    '그 높이': sc? sc.clientHeight+'/'+sc.scrollHeight : '-',
    칸수: document.querySelectorAll('[data-potbag]').length }); })()`));
console.log('■ 가방 —', JSON.stringify(box));
const scrolls = box['실제 스크롤되는 것'] && box['실제 스크롤되는 것'] !== '없음';
console.log('■ ⇒ 스크롤되나 —', scrolls ? '★ 된다 (박사님 판과 같은 꼴)' : '⛔ 안 된다 (아직 다른 판이다)');

const cell = JSON.parse(await page.eval(`(()=>{ const e=document.querySelector('[data-potbag]');
  if(!e) return JSON.stringify({err:'칸 없음'});
  const r=e.getBoundingClientRect(), cs=getComputedStyle(e);
  return JSON.stringify({ x:Math.round(r.left+r.width/2), y:Math.round(r.top+r.height/2),
    draggable: e.classList.contains('draggable'), touchAction: cs.touchAction }); })()`));
console.log('■ 첫 칸 —', JSON.stringify(cell));

const snap = () => page.eval(`(()=>{ const S=window.__S(), d=window.__drag||{};
  let sc=document.getElementById('pageBag'), guard=0;
  while (sc && guard++<6 && sc.scrollHeight<=sc.clientHeight) sc=sc.parentElement;
  return JSON.stringify({ 끄는중:!!d.on, 무엇:d.what||null, 받나:!!(d.best&&d.best.ok),
    '가방 스크롤위치': sc? sc.scrollTop : null,
    '놓인 화분': (S.pots||[]).filter(p=>p.placedOnce).length,
    아래글:(document.getElementById('dropLabel')||{}).textContent||'' }); })()`);

const AIM = { x: 195, y: 470 };
console.log('\n=== 끌기 — 첫 칸에서 방으로 ===');
console.log('  전 —', await snap());
const p = { radiusX: 12, radiusY: 12, force: 1, id: 1 };
await page.send('Input.dispatchTouchEvent', { type:'touchStart', touchPoints:[{ ...p, x:cell.x, y:cell.y }] });
await sleep(110);
for (let i = 1; i <= 8; i++) {
  await page.send('Input.dispatchTouchEvent', { type:'touchMove',
    touchPoints:[{ ...p, x: Math.round(cell.x + (AIM.x-cell.x)*i/8), y: Math.round(cell.y + (AIM.y-cell.y)*i/8) }] });
  await sleep(55);
}
console.log('  끄는 중 —', await snap());
await page.send('Input.dispatchTouchEvent', { type:'touchEnd', touchPoints:[] });
await sleep(1500);
console.log('  ★ 놓은 뒤 —', await snap());
await page.close(); clearTimeout(wd);
