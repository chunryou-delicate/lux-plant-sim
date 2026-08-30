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
    /* ★★ 2026-08-10 — 「가방 카드」가 없어졌다. 세울 시루가 남아 있다는 표시는 이제
       **가방 격자의 시루 칸**이다(박사님 "콩나물 시루 ×4 된 걸 누르거나 드래그").
       이 검사가 지키던 뜻은 그대로 — [취소]해도 시루를 안 잃는다는 것을 화면에서 본다. */
    spareCard: !!document.querySelector('.bagslot[data-place="beansprout"]')
  }; })()`);

console.log('\n══ ① [빨리감기]가 없다 — 하루를 넘기는 손은 하나다 ═══════════════');
const bar = await page.eval(`[...document.querySelectorAll('.actionbar button')].map(b=>b.id)`);
ok('①-1 [빨리감기] 버튼이 아예 없다', await page.eval(`!document.getElementById('ff')`), JSON.stringify(bar));
/* ★★ 2026-08-30 — **[다음 날]은 더 이상 «하단 띠»에 없다.** 2026-08-17 에 박사님이
   *"[다음 날] 버튼은 «우측 하단»으로 … 화면 앞으로 아이콘 형태로"* 하셔서 `#stage` 안으로 갔다.
   ⇒ 그러니 「띠에 남아 있나」는 낡은 물음이다. 재는 «뜻»은 그대로다 —
     **하루를 넘기는 손이 «하나»뿐인가.** 어디에 서 있든 그것이 지켜지면 된다. */
/* ⚠ 글자로 세지 않는다 — 「다음 날」이라는 말은 «밥상 단추»에도 들어 있다(`mealGo`:
     「이 몫으로 «다음 날»까지」). 그걸 세면 늘 둘이라 이 자가 헛울음을 운다.
   ⇒ **하루를 넘기는 손은 id 로 센다** — `next`(지금) · `ff`(없앤 빨리감기). */
const nextBtns = await page.eval(`[...document.querySelectorAll('button')]
  .filter(b => b.id === 'next' || b.id === 'ff').map(b => b.id)`);
ok('①-2 [다음 날]이 화면에 있다 (띠가 아니라 방 모서리)',
   await page.eval(`(()=>{ const b=document.getElementById('next');
     return !!(b && b.offsetParent !== null); })()`), JSON.stringify(nextBtns));
ok('①-3 날짜를 넘기는 버튼이 **하나뿐**이다',
   nextBtns.length === 1, JSON.stringify(nextBtns));
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

/* ★ 2026-08-10 — 누르는 자리가 [📍 방에 배치하기] 단추에서 **가방 격자의 시루 칸**으로
     옮겨졌다. 부르는 함수는 같다(startPhonePlace) — 손잡이만 하나로 줄었다. */
const tapSiruCell = () => page.eval(`(()=>{
  const b = document.querySelector('.bagslot[data-place="beansprout"]');
  if (!b) return false; b.click(); return true; })()`);
ok('②-2 ★가방 격자의 시루 칸을 **누를 수 있다** (예전 [📍 방에 배치하기] 자리)',
   await tapSiruCell() === true);
await sleep(1600); await clear();
s = await snap();
/* ★★★ 2026-08-30 — **모드가 하나 줄었다.** 예전에는 「누르면 임시로 서고 «이동 상태»」였고
   [확인]은 손을 뗄 때 떴다. 그런데 누르기는 «끌기를 안 지나가므로» 그 손이 영영 안 오고,
   사람은 격자 위에서 멈췄다(game.html §startPhonePlace 의 그 주석).
   ⇒ 지금은 **놓자마자 `confirming`** 이다 — [확인]·[다시 옮기기]·[취소]가 그 자리에 뜬다.
     자리를 바꾸려면 [다시 옮기기]가 예전의 `beginMove()` 를 그대로 부른다. 길은 안 없앴다.
   ⇒ ★ 그래서 재는 뜻을 바꿔 적는다: 「임시로 서되 **아직 확정이 아니다**」. */
ok('②-3 ★누르면 방에 **임시로 서고 곧바로 되묻는다** (배치 확정이 아니다)',
   s.placed === 1 && s.confirming === true,
   JSON.stringify({ placed: s.placed, confirming: s.confirming, moving: s.moving }));
ok('②-4 그때 [확인]이 «그 자리에» 떠 있다 — 손을 뗄 때까지 기다리지 않는다',
   s.barVisible === true, JSON.stringify({ barVisible: s.barVisible }));

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
await tapSiruCell();
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
ok('②-15 ★그때 시루를 **안 잃는다** — 가방 격자의 시루 칸이 다시 보인다',
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
    if(!h||!h.ok||h.onUid) continue;
    /* ★★ 2026-08-15 — **추천 자리에서 44px 밖인 점만 고른다.**
       ══════════════════════════════════════════════════════════════
       ⚠ 이 방패가 없어서 3-1 이 화면 기하에 기대고 있었다. 아래 띠가 한 줄 늘어
         방이 51px 짧아지자, 여기서 고른 바닥 점이 banjiha-dresser:0 에서 31.6px
         안으로 들어갔다. 그러면 끌기가 **그 추천 자리에 붙어** 시루가 서랍장 위에 서고,
         고른 바닥은 여전히 비어 있어 「놓은 뒤에는 그 바닥이 막힌다」가 거짓이 된다.
       ★ **규칙은 멀쩡했다** — 붙기만 막고 다시 재니 free:crop_01_01 에 서고
         그 바닥이 「가구·벽에 걸립니다」로 제대로 막혔다.
       ★ 형제 검사 test_uiwire.mjs 의 pickFloor 에는 **이 방패가 원래 있었다.**
         같은 함정을 거기서 먼저 겪고 막아 둔 것이다. 여기로 옮겨 온다.
       ⚠ 이건 검사를 무르게 하는 것이 **아니다.** 단언(3-1)은 그대로 돌고,
         고르는 점만 「끌기가 안 붙는 곳」으로 바로잡는다.
       ⚠⚠ 이 주석은 **템플릿 문자열 안**이다. 백틱을 쓰면 문자열이 끊긴다(한 번 그랬다). */
    if (h.nearest) { let sp=null; try{ sp=rv.screenPosOf(h.nearest.slotId); }catch(e){}
      if (sp && Math.hypot(c.left+sp.x-x, c.top+sp.y-y) <= 44) continue; }
    return {x,y};
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
/* ★★ 2026-08-15 밤 — **같은 화면 점을 다시 묻지 않는다. 같은 「자리」를 다시 묻는다.**
   ══════════════════════════════════════════════════════════════════════
   ⚠ 놓는 사이에 **카메라가 움직인다.** 시루를 놓으면 아래 띠에 [💧 물 주기]가 붙어
     띠가 112 → 185px 이 되고, 무대가 그만큼 짧아지면 `frameRoom` 이 다시 맞춘다
     (실측: 카메라 거리 8.078 → 7.244 · 방위·상하각은 그대로).
     그러면 **아까 그 화면 점은 이제 다른 세계 좌표**다. 방 앞쪽 끝을 골랐던 판에서는
     그 점이 방 밖으로 떨어져 `surfaceAt` 이 「놓을 수 있는 면이 없습니다」를 냈다 —
     규칙이 깨진 게 아니라 **가리키던 손가락이 옮겨 간 것**이다.
   ★ 그래서 놓인 그루의 **지금 화면 자리**(`screenPosOf`)를 다시 받아서 묻는다.
     세계 좌표로는 아까 그 바닥 그대로다 — 끌어 놓기가 거기에 세웠으니까.
     단언은 **한 글자도 안 무르게** 뒀다: 여전히 `ok === false` 이고 사유가 「가구·벽」이어야 한다.
   ⚠ 자리 이름이 붙은 그루(가구 위)는 빼고 **자유 좌표 그루**만 본다 — ②에서 놓은
     서랍장 위 시루가 아니라 방금 바닥에 놓은 그것이어야 한다.
   ⚠⚠ 이 주석은 **템플릿 문자열 밖**이다(안에 백틱을 쓰면 문자열이 끊긴다). */
const afterNav = floor ? await page.eval(`(()=>{const rv=window.__rv;
  const c=document.getElementById('roomCanvas').getBoundingClientRect();
  let best=null, bestD=Infinity;
  for (const p of (rv.plants()||[])) {
    if (p.kind!=='beansprout' || p.slotId) continue;              // 자유 좌표 그루만
    let sp=null; try{ sp=rv.screenPosOf('free:'+p.potId); }catch(e){}
    if(!sp) continue;
    const d=Math.hypot(c.left+sp.x-${floor.x}, c.top+sp.y-${floor.y});
    if(d<bestD){ bestD=d; best={potId:p.potId, x:c.left+sp.x, y:c.top+sp.y}; }
  }
  if(!best) return {ok:null, reason:'놓인 자유 그루를 못 찾았다'};
  const h=rv.surfaceAt(best.x,best.y,{potD:0.24});
  return {ok:h&&h.ok, reason:(h&&h.reason)||null, potId:best.potId, moved:Math.round(bestD)};})()`) : null;
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

console.log('\n══ ④ 체력이 커져도 화면이 안 깨진다 ════════════════════════════');
/* ★★ 2026-08-09 — **최대체력에 상한이 없다**(박사님). 세 자리가 될 수 있다.
   ⚠ 점을 한 개씩 찍던 줄(`#staDots`)이 max 78 에서 **점 78개**를 그려 한 줄이 통째로
     무너졌다 — 재서 잡았다. 이젠 세어지는 데까지만 점이고 그 위는 숫자다. */
const big = (max, left, xp) => page.eval(`(()=>{ const S=window.__S();
  S.stamina.max=${max}; S.stamina.left=${left}; S.stamina.xp=${xp}; window.__redraw();
  const chip=document.getElementById('resSta');
  const cr=chip.getBoundingClientRect(), row=chip.parentElement.parentElement.getBoundingClientRect();
  return { chip:chip.textContent, dots:(document.getElementById('staDots').textContent||'').length,
           over: cr.right > row.right + 1, fill: document.getElementById('resStaFill').style.width }; })()`);
/* ⚠ 아래 막대(`#staBar`)는 **손이 바닥났을 때만** 나온다(drawStamina) —
   그래서 `left: 0` 으로 재야 점이 그려진다. 안 그러면 점 0개를 보고
   「점이 안 나온다」고 잘못 읽는다(처음에 실제로 그랬다). */
const b10 = await big(10, 0, 55);
ok('④-1 두 자리까지는 점으로 보인다', b10.dots === 10 && !b10.over, JSON.stringify(b10));
const b78 = await big(78, 0, 779);
ok('④-2 ★두 자리가 커지면 **점 대신 숫자**다 (한 줄이 안 무너진다)',
   b78.dots <= 8 && !b78.over, JSON.stringify(b78));
const b999 = await big(999, 123, 99999);
ok('④-3 ★세 자리도 칩을 안 넘긴다', b999.chip === '123/999' && !b999.over, JSON.stringify(b999));
ok('④-4 진행바가 0~100% 안에 있다',
   parseFloat(b999.fill) >= 0 && parseFloat(b999.fill) <= 100, b999.fill);
await big(5, 5, 0);                       /* 되돌려 둔다 */

console.log(`\n${seen}개 중 ${seen - bad}개 통과` + (bad ? ` · ${bad}개 실패` : ' — 전부 통과'));
await page.close();
process.exit(bad ? 1 : 0);
