/* ============================================================
   tools/test_place_confirm.mjs — 폰 배치 · [확인] · 길막힘 경고 · 2026-08-09 신설
   ------------------------------------------------------------
     python tools/serve.py 8963
     BYEOT_URL=http://localhost:8963 node tools/test_place_confirm.mjs

   박사님 지시 셋을 못 박는다.

     ① **[빨리감기]를 없앤다** — *"빨리감기는 없애. 하루넘기기만 살리자."*
        하단 액션바에 하루를 넘기는 손이 **[다음 날] 하나**뿐인가.

     ② **폰 배치** — *"템을 눌러서 배치하기 누르면 그냥 빈칸으로 임시로 가있고
        (배치 말고 이동상태고 상대이동 드래그 배치 가능하게) 거기서 드래그해서 놓고,
        놓으면 그 물품 옆으로 확인버튼이 떠서 그 확인을 누르면 거기로 일단 배치되는거고"*

     ③ **길막힘 경고** — *"막는거 경고는 해주되, 막히면 뭐 재배치하면 되지 그 식물을."*
        ⚠ **막지 않는다.** 놓인 것이 길 판정에 실제로 들어가는지와, 창구가 있는지만 본다.

   ★★ 이 검사는 **사람이 하는 일**을 한다 — 버튼을 누르고, 끌고, 확인을 누른다.
     규칙 함수를 직접 부르면 「화면이 그 규칙을 부르는가」를 못 잰다(test_uiwire 와 같은 사상).
   ⚠ `BYEOT_URL` 은 **서버 주소**다(페이지 주소를 넣으면 404 로 죽는다).
============================================================ */
import { launch, sleep } from './test_cdp.mjs';

const BASE = process.env.BYEOT_URL || 'http://localhost:8963';

let bad = 0, seen = 0;
const ok = (name, cond, got) => {
  seen++;
  console.log(`${cond ? '  OK' : 'FAIL'}  ${name}${got == null || got === '' ? '' : '  → ' + got}`);
  if (!cond) bad++;
};

const page = await launch({ width: 390, height: 844, dpr: 2, mobile: false });
await page.goto(`${BASE}/game.html`);
await page.eval(`localStorage.clear()`, false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 180000, 300);
await page.waitFor('window.__byeotBooted === true', 180000, 300);
await sleep(3500);

/* 대사·안내판을 걷는다 — 덮개가 남아 있으면 누름이 방에 안 닿고, 시계도 멈춰 있다 */
const clear = () => page.eval(`(()=>{ const g=document.getElementById('guide'); if(g) g.classList.remove('on');
  const s=document.getElementById('stage'); if(s) s.classList.remove('talking'); })()`, false);
const clickId = (id) => page.eval(`(()=>{const e=document.getElementById('${id}');
  if(!e||e.disabled) return false; e.click(); return true;})()`);
await clear();

const snap = () => page.eval(`(()=>{ const S=window.__S(); const b=S.firstPlay.beansprout;
  const st=document.getElementById('stage');
  const cb=document.getElementById('placeConfirm');
  const r=cb.getBoundingClientRect();
  const warnEl=document.getElementById('placeConfirmWarn');
  return {
    pots:(b.pots||[]).length,
    placed:(b.pots||[]).filter(p=>p&&(p.slotId||p.at)).length,
    shown:(window.__rv.plants()||[]).filter(p=>p.kind==='beansprout').length,
    confirming: st.classList.contains('confirming'),
    moving: st.classList.contains('moving'),
    barVisible: getComputedStyle(cb).display !== 'none',
    bar:{x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)},
    who: document.getElementById('placeConfirmWho').textContent,
    warn: warnEl.style.display==='none' ? null : warnEl.textContent,
    stockSiru:(S.shop&&S.shop.stock&&S.shop.stock.siru)||0,
    spareCard: document.getElementById('cropCard').style.display !== 'none'
  }; })()`);

console.log('\n══ ① [빨리감기]가 없다 — 하루를 넘기는 손은 하나다 ═══════════════');
const bar = await page.eval(`[...document.querySelectorAll('.actionbar button')].map(b=>b.id)`);
ok('①-1 [빨리감기] 버튼이 아예 없다', await page.eval(`!document.getElementById('ff')`), JSON.stringify(bar));
ok('①-2 하단 액션바에 [다음 날]이 남아 있다', bar.includes('next'), JSON.stringify(bar));
ok('①-3 날짜를 넘기는 버튼이 **하나뿐**이다',
   bar.filter(id => id === 'next' || id === 'ff').length === 1, JSON.stringify(bar));
/* 안내판(가이드)도 없어진 버튼을 가리키면 안 된다 — 죽은 손가락은 고장으로 읽힌다 */
ok('①-4 안내판이 없어진 버튼을 안 가리킨다',
   await page.eval(`!/빨리감기|감습니다/.test(document.getElementById('guide').textContent||'')`));
/* ★ 시계는 계속 돈다 — `dayCycleStop → idleClockStart` 가 사라졌으므로 여기서 확인한다 */
const t0 = await page.eval(`document.getElementById('resWhen').textContent`);
await sleep(4000);
const t1 = await page.eval(`document.getElementById('resWhen').textContent`);
ok('①-5 ★빨리감기를 걷어도 **평소 시계는 돈다**', t0 !== t1, `${t0} → ${t1}`);

console.log('\n══ ② 눌러서 배치 → 이동 상태 → [확인] ═══════════════════════════');
let s = await snap();
ok('②-0 아직 아무것도 안 놓였고 가방에 시루가 있다',
   s.placed === 0 && s.spareCard === true, JSON.stringify({ placed: s.placed, card: s.spareCard }));
ok('②-1 [확인] 바는 처음엔 안 보인다 (display:none — 포인터를 안 먹는다)',
   s.barVisible === false);

ok('②-2 [방에 배치하기] 버튼이 있다', await clickId('cropPlaceStart'));
await sleep(1600); await clear();
s = await snap();
ok('②-3 ★누르면 방에 **임시로 서고 곧바로 이동 상태**가 된다 (배치 확정이 아니다)',
   s.placed === 1 && s.moving === true, JSON.stringify({ placed: s.placed, moving: s.moving }));
ok('②-4 그때는 아직 [확인]이 안 떠 있다', s.confirming === false);

/* ★ 상대이동 — 물건을 짚지 않는다. 화면 아무 데나 잡고 **끈 만큼** 움직인다 */
const moved = await page.eval(`(()=>{ const rv=window.__rv;
  const key=window.__picked.slotId;
  const c=document.getElementById('roomCanvas').getBoundingClientRect();
  const before=rv.screenPosOf(key);
  const x=c.left+c.width*0.5, y=c.top+c.height*0.6;
  window.__picked.down({clientX:x, clientY:y});
  window.__picked.move({clientX:x+30, clientY:y+34});   /* 물건에서 **떨어진** 곳을 잡고 끈다 */
  window.__picked.up();
  return { before: before?{x:Math.round(before.x),y:Math.round(before.y)}:null }; })()`);
await sleep(1600); await clear();
s = await snap();
ok('②-5 ★손을 떼면 **[확인]이 물건 옆에 뜬다**',
   s.confirming === true && s.barVisible === true, JSON.stringify({ confirming: s.confirming, bar: s.bar }));
ok('②-6 [확인] 바가 화면 안에 있다 (구석에서 잘려 나가지 않는다)',
   s.bar.x >= 0 && s.bar.y >= 0 && s.bar.x + s.bar.w <= 390 && s.bar.y + s.bar.h <= 844,
   JSON.stringify(s.bar));
ok('②-7 어디에 둘지 글자로 말한다', /둘까요/.test(s.who), s.who);
ok('②-8 옮기는 중에는 [확인]이 감춰진다 (잡이판 위에서 눌리면 안 된다)',
   await page.eval(`(()=>{ window.__picked.beginMove();
     const v = getComputedStyle(document.getElementById('placeConfirm')).display !== 'none';
     window.__picked.up(); return !v; })()`));
await sleep(900); await clear();

/* [확인] — 그 자리로 굳고 고르기가 풀린다 */
ok('②-9 [확인]을 누르면 확정된다', await clickId('placeOk'));
await sleep(1200);
s = await snap();
ok('②-10 확정 뒤 [확인] 바가 사라진다', s.confirming === false && s.barVisible === false);
ok('②-11 시루는 방에 그대로 서 있다', s.placed === 1 && s.shown === 1,
   JSON.stringify({ placed: s.placed, shown: s.shown }));

console.log('\n══ ②-b [취소] — 잃는 것이 없다 ═════════════════════════════════');
/* 시루 하나를 더 사서 배치를 시작한 뒤 취소한다 */
await page.eval(`(()=>{const S=window.__S(); S.shop=S.shop||{};
  S.shop.stock={...(S.shop.stock||{}), siru:1, bean_seed:2}; window.__redraw();})()`, false);
await sleep(500);
const before2 = await snap();
await clickId('cropPlaceStart');
await sleep(1600); await clear();
await page.eval(`(()=>{ const c=document.getElementById('roomCanvas').getBoundingClientRect();
  const x=c.left+c.width*0.5, y=c.top+c.height*0.62;
  window.__picked.down({clientX:x, clientY:y});
  window.__picked.move({clientX:x+24, clientY:y+18});
  window.__picked.up(); })()`, false);
await sleep(1400); await clear();
ok('②-12 둘째 시루도 같은 길로 선다', (await snap()).placed === before2.placed + 1);
ok('②-13 [취소] 버튼이 있다', await clickId('placeCancel'));
await sleep(1200);
s = await snap();
ok('②-14 ★취소하면 **가방으로 되돌아간다** (판에서 빠진다)',
   s.placed === before2.placed, `${before2.placed} → ${s.placed}`);
ok('②-15 ★그때 시루를 **안 잃는다** — 가방 카드가 다시 보인다',
   s.spareCard === true && s.pots === before2.pots + 1,
   JSON.stringify({ card: s.spareCard, pots: s.pots }));

console.log('\n══ ③ 놓은 것이 길 판정에 들어간다 (막지는 않는다) ═══════════════');
/* ★ 증거는 하나다: **놓기 전에는 설 수 있던 바닥이 놓은 뒤에는 막힌다.**
   ⚠ 가구 위가 아니라 **바닥**에서 재야 한다. 가구 칸은 그 가구가 이미 막고 있고,
     그 자리에서는 「화분끼리 겹침」 검사가 먼저 걸려 **길 판정을 안 거친다** —
     그걸로 통과시키면 이 검사가 아무것도 안 재고 통과한다(실제로 한 번 그랬다).
   ★ 바닥 점은 `nav.blocked` 만이 막을 수 있으므로 사유가 「가구·벽」이면
     그루가 **격자에 들어갔다**는 뜻이다. */
await page.eval(`(()=>{const S=window.__S(); S.shop=S.shop||{};
  S.shop.stock={...(S.shop.stock||{}), siru:1, bean_seed:2}; window.__redraw();})()`, false);
await sleep(500);
const floor = await page.eval(`(()=>{ const rv=window.__rv;
  const c=document.getElementById('roomCanvas').getBoundingClientRect();
  for (const fy of [0.80,0.74,0.68,0.86,0.62]) for (const fx of [0.5,0.38,0.62,0.28,0.72]) {
    const x=c.left+c.width*fx, y=c.top+c.height*fy;
    let h=null; try{ h=rv.surfaceAt(x,y,{potD:0.24}); }catch(e){}
    if(h&&h.ok&&!h.onUid) return {x,y};
  }
  for (const fy of [0.80,0.74,0.68]) for (const fx of [0.5,0.38,0.62]) {
    const x=c.left+c.width*fx, y=c.top+c.height*fy;
    let h=null; try{ h=rv.surfaceAt(x,y,{potD:0.24}); }catch(e){}
    if(h&&h.ok) return {x,y};
  }
  return null; })()`);
ok('③-0 바닥에 놓을 자리를 찾았다', !!floor, JSON.stringify(floor));
const beforeNav = floor ? await page.eval(`(()=>{const h=window.__rv.surfaceAt(${floor.x},${floor.y},{potD:0.24});
  return {ok:h&&h.ok, reason:(h&&h.reason)||null};})()`) : null;
ok('③-0b 놓기 전에는 그 바닥에 설 수 있다', !!beforeNav && beforeNav.ok === true,
   JSON.stringify(beforeNav));
if (floor) {
  await page.eval(`(()=>{const t=document.getElementById('cropThumb');
    window.__drag.begin('beansprout', t.src, {clientX:${floor.x},clientY:${floor.y}});
    window.__drag.move({clientX:${floor.x},clientY:${floor.y}});
    window.__drag.end();})()`, false);
  await sleep(1600); await clear();
}
const afterNav = floor ? await page.eval(`(()=>{const h=window.__rv.surfaceAt(${floor.x},${floor.y},{potD:0.24});
  return {ok:h&&h.ok, reason:(h&&h.reason)||null};})()`) : null;
ok('③-1 ★놓은 뒤에는 그 바닥이 **길 판정에서 막힌다** (예전엔 그대로 통과했다)',
   !!afterNav && afterNav.ok === false && /가구·벽/.test(afterNav.reason || ''),
   JSON.stringify(afterNav));
ok('③-2 「닿을 수 있나」를 묻는 창구가 있다',
   await page.eval(`typeof window.__rv.reach === 'function' && typeof window.__rv.unreachable === 'function'`));
const unreach = await page.eval(`window.__rv.unreachable()`);
ok('③-3 트인 바닥에 놓은 시루는 **닿는다** (헛경고를 안 낸다)',
   Array.isArray(unreach) && unreach.length === 0, JSON.stringify(unreach));
ok('③-4 ★경고가 **막지 않는다** — 경고가 있든 없든 [확인]은 눌린다',
   await page.eval(`document.getElementById('placeOk').disabled === false`));

console.log(`\n${seen}개 중 ${seen - bad}개 통과` + (bad ? ` · ${bad}개 실패` : ' — 전부 통과'));
await page.close();
process.exit(bad ? 1 : 0);
