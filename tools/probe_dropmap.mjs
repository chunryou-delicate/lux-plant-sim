/* tools/probe_dropmap.mjs — **끄는 동안 «놓을 수 있는 곳»이 방 어디인가**
   ------------------------------------------------------------------
   probe_placecells 실측: 금색 네모(자리 표시)는 몬스테라도 «15개 다 뜬다».
   ⚠ 그런데 아래글이 갈렸다 — 시루는 「방 안에 놓아 주세요」, 몬스테라는 ★「놓을 수 있는
     면이 없습니다」. ⇒ ★ 그러면 「칸이 안 나온다」가 아니라 **「어디에 대도 안 받는다」**일 수 있다.
   ⇒ 방 화면을 격자로 훑어 **받는 점**을 세어 둘을 견준다. 같은 점 · 같은 자다.
   ⛔ 값은 안 바꾼다. */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8972';
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 600000);
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
const TWO = process.env.BYEOT_TWO === '1';
console.log('SETUP —', await page.eval(`(()=>{ const S=window.__S(); S.pots=S.pots||[];
  const mk=(id)=>({ id, itemId:'pot', plantId:'monstera', leafGrades:{}, leafGradesSeen:{},
    cuts:[], daysPlanted:0, fedDays:0, arrivedOnDay:S.day, wateredOnDay:S.day,
    arrivalGrowthDays:45, dliHist:[] });
  S.pots.length = 0;
  if (${TWO ? 1 : 0}) { const a=mk('pot_room'); a.placedOnce=true; a.slotId='banjiha-desk:0'; a.at=null; S.pots.push(a); }
  const b=mk('pot_bag'); b.placedOnce=false; b.slotId=null; b.at=null; S.pots.push(b);
  window.__redraw();
  return JSON.stringify({ pots:S.pots.length, first:S.pots[0].id, firstSlot:S.pots[0].slotId,
    slotDisabled: document.getElementById('slot').disabled,
    slotOpts: [...document.getElementById('slot').options].filter(o=>o.value).length }); })()`));
await sleep(2000);

const cv = JSON.parse(await page.eval(`(()=>{ const r=document.getElementById('roomCanvas').getBoundingClientRect();
  return JSON.stringify({l:Math.round(r.left),t:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height)}); })()`));
console.log('■ 방 화면 —', JSON.stringify(cv));
console.log('■ 화분 지름 —', await page.eval(`(()=>{ try{
  return JSON.stringify({ 몬스테라: window.__drag ? null : null }); }catch(e){ return '?'; } })()`));

const sweep = async (name, sel) => {
  await page.eval(`try{ window.__byeotSheet.open('bag') }catch(e){}`, false);
  await sleep(1200);
  const c = JSON.parse(await page.eval(`(()=>{ const e=document.querySelector('${sel}');
    if(!e) return JSON.stringify({err:'칸 없음'});
    if(e.scrollIntoView) e.scrollIntoView({block:'center'});
    const r=e.getBoundingClientRect();
    return JSON.stringify({x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2),
      nm:((e.querySelector('.nm')||{}).textContent||'?').trim()}); })()`));
  if (c.err) { console.log(`\n${name} — ⛔ ${c.err}`); return; }
  await sleep(400);
  const p = { x: c.x, y: c.y, radiusX: 12, radiusY: 12, force: 1, id: 1 };
  await page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [p] });
  await sleep(120);
  const potD = await page.eval(`(()=>{ const d=window.__drag||{}; return String(d.potD||'?'); })()`);
  const rows = []; let ok = 0, all = 0; const why = {};
  const STEP = 26;
  for (let y = cv.t + 10; y < cv.t + cv.h - 10; y += STEP) {
    let line = '';
    for (let x = cv.l + 10; x < cv.l + cv.w - 10; x += STEP) {
      await page.send('Input.dispatchTouchEvent', { type: 'touchMove',
        touchPoints: [{ ...p, x, y }] });
      await sleep(38);
      const r = JSON.parse(await page.eval(`(()=>{ const d=window.__drag||{};
        return JSON.stringify({ ok: !!(d.best && d.best.ok),
          lb: (document.getElementById('dropLabel')||{}).textContent||'' }); })()`));
      all++; if (r.ok) ok++; else why[r.lb] = (why[r.lb] || 0) + 1;
      line += r.ok ? '#' : '.';
    }
    rows.push(line);
  }
  await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(900);
  await page.eval(`(()=>{ try{ window.__picked.clear(); }catch(e){} })()`, false);
  await sleep(400);
  console.log(`\n=== ${name} «${c.nm}» · 화분 지름 ${potD} ===`);
  console.log(rows.join('\n'));
  console.log(`  ⇒ 받는 점 ★${ok}/${all}`);
  console.log('  ⇒ 안 받는 까닭 —', Object.entries(why).sort((a,b)=>b[1]-a[1])
    .map(([k,v])=>`«${k||'(빈 글)'}» ${v}`).join(' · '));
};
await sweep('몬스테라', '[data-potbag]');
await sweep('시루', '[data-place]');
await page.close(); clearTimeout(wd);
