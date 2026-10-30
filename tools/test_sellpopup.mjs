/* ============================================================
   tools/test_sellpopup.mjs — **고르개는 팝업이다** (2026-08-17 신설)
   ------------------------------------------------------------
     python tools/serve.py 8963
     BYEOT_URL=http://localhost:8963 node tools/test_sellpopup.mjs

   박사님: *"금액 설정이 팝업으로 떳으면 좋겠어"*

   이 게임에 「몇을 고르고 나서 누른다」가 **둘** 있고 **둘 다 팝업이 아니었다**:
     ① [상점] 곳간 채소를 **몇 판 팔지**  — 시트 안 구르는 칸. 실측 y=1211(화면 844).
        ⇒ **눌러도 화면 밖에 떴다.** 누른 사람이 보는 것은 「아무 일도 안 일어남」이다
     ② [다음 날] 오늘 밥상을 **몇 g 쓸지**  — 하단 띠. 보이기는 했지만 단추가 36px 였다
   ⇒ 둘을 **같은 틀 하나**(`.pop`/`.popcard`)로 맞췄다. 이 검사가 그것을 못 박는다.

   ══ 무엇을 못 박나 ═══════════════════════════════════════════════════════
     A  ★★ 둘 다 **화면 한가운데 뜨고 뒤가 어두워진다** — `position:fixed` 이고
        카드가 화면 안에 온전히 들어온다(예전 ①은 y=1211 이었다)
     B  ★★★ **받을 돈을 그대로 말한다** — 팝업 안 문구에 코어(`pantrySaleStatus`)가 낸 `won` 이 들어 있다.
        ★ 2026-10-30 D90 ⑤ — «손해»는 안 말한다(물건 값 − 판 값이라 밥상 판과 반대로 말했다 · 한 목소리)
     C  ★★ **닫는 길이 셋이다** — [그만두기] · **뒤 누르기** · `Esc`. 그리고 셋 다
        **돈이 한 푼도 안 나간다**. 뒤 누르기를 막으면 갇힌다
     D  ★★ **z 순서** — 팝업(84)이 왼쪽 세로 메뉴(`#navbar` 41) **위**다.
        그리고 **오류 상자(90)가 팝업 위**다 — 아래면 「눌렀는데 아무 말도 없다」가 된다
     E  ★ **판다** — 지갑이 코어가 말한 만큼만 늘고 곳간이 그만큼 준다(화면이 두 번 안 센다)
     F  ★★ **밥상도 같은 틀**이다 — 그리고 [이대로 다음 날 ▸]로 하루가 가고,
        [그만두기]로는 **안 간다**(막는 창이 아니라는 성질은 그대로)
     G  ★ **360·390·430 셋 다** 단추가 44px 아래로 안 내려간다

   ⚠ **숫자를 이 파일에 안 박는다.** 손해도 받을 돈도 `window.__S()` 와 코어 창구가 낸
     것을 화면 글자와 대조한다 — START-HERE §2.8 의 사고가 그 반대다.
   ★ **지름길을 안 썼다** — 시루를 끌어다 놓고·심고·물 주고·[다음 날]로 익혀 거둔다.
     (씨앗·시루 재고만 상점을 안 거치고 넣는다. 배송 이틀은 이 일과 무관하다)
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
const errs = [];
page.on(m => {
  if (m.method === 'Runtime.exceptionThrown')
    errs.push((m.params.exceptionDetails.exception || {}).description ||
              m.params.exceptionDetails.text);
});
await page.goto(`${BASE}/game.html`);
await page.eval(`localStorage.clear()`, false);          // ⚠ goto 뒤에
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 180000, 300);
await page.waitFor('window.__byeotBooted === true', 180000, 300);
await sleep(7000);

async function walk() {
  /* ⚠ 2026-10-24 [core] 총괄 D83 ③ — 08-16(ff448563)부터 1일차 «첫 달 가계부»가 떠 있어 준비 내내 덮였다 → 대사·안내처럼 닫는다 */
  for (let i = 0; i < 80; i++) {
    const busy = await page.eval(`(()=>{const s=document.getElementById('stage'),
      g=document.getElementById('guide'), m=document.getElementById('monthPanel');
      return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'))||!!(m&&m.classList.contains('on'));})()`);
    if (!busy) return;
    await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s) s.click();
      const b=document.getElementById('dlgBox'); if(b) b.click();
      const g=document.getElementById('guideClose'); if(g) g.click();
      const m=document.getElementById('monthPanel'); if(m&&m.classList.contains('on')){const c=document.getElementById('monthClose'); if(c) c.click();}})()`, false);
    await sleep(280);
  }
}
await walk();

/* ── 손 ────────────────────────────────────────────────────────────── */
/* ⚠ 체력은 이 검사의 대상이 아니다 — 손이 모자라 못 눌러 FAIL 이 나면 거짓 실패다 */
const freeHands = () => page.eval(`(()=>{const S=window.__S();
  if (S.stamina) S.stamina.usedToday = 0;})()`, false);
const redraw = async () => { await page.eval(`window.__redraw && window.__redraw()`, false); await sleep(350); };
const place = (slot) => page.eval(`(()=>{ const rv=window.__rv,
    c=document.getElementById('roomCanvas').getBoundingClientRect();
  const sp=rv.screenPosOf('${slot}'); if(!sp) return false;
  window.__drag.begin('beansprout', document.getElementById('cropThumb').src,
                      {clientX:c.left+c.width*0.9, clientY:c.top+40});
  window.__drag.move({clientX:c.left+sp.x, clientY:c.top+sp.y}); window.__drag.end(); return true;})()`);
const siruBtn = (act, i = 0) => page.eval(`(()=>{const b=[...document.querySelectorAll(
  '#siruList button[data-act="${act}"]')]; if(!b[${i}]) return false; b[${i}].click(); return true;})()`);
const click = (id) => page.eval(`(()=>{const b=document.getElementById('${id}');
  if(!b) return false; b.click(); return true;})()`);
const openTab = async (t) => { await page.eval(`window.__byeotSheet.open('${t}')`, false); await sleep(450); };
const txt = (sel) => page.eval(`(()=>{const e=document.querySelector('${sel}');
  return e ? (e.textContent||'').replace(/\\s+/g,' ').trim() : '';})()`);
const on = (id) => page.eval(`(()=>{const e=document.getElementById('${id}');
  return !!(e && e.classList.contains('on'));})()`);
const box = (sel) => page.eval(`(()=>{const e=document.querySelector('${sel}');
  if(!e) return null; const r=e.getBoundingClientRect(), cs=getComputedStyle(e);
  return {x:Math.round(r.x), y:Math.round(r.y), w:Math.round(r.width), h:Math.round(r.height),
          pos:cs.position, z:cs.zIndex};})()`);
/* 코어가 낸 값 — 화면 글자와 대조할 정본 */
const money = () => page.eval(`(()=>{const S=window.__S();
  return { cash: S.tutorial ? S.tutorial.cashWon : null,
           pantry: S.firstPlay.food.pantryWon, day: S.day,
           lots: (S.firstPlay.food.pantryLots||[]).length,
           plan: S.firstPlay.food.mealPlanWon };})()`);

/* ── 판 세우기: 시루 둘을 놓고 심고 물 주고 익혀 **같은 날** 거둔다 ────────
   지름길은 재고 둘(시루·씨앗)뿐이다. 걸음은 전부 화면 단추로 밟는다. */
await page.eval(`(()=>{const S=window.__S(); S.shop.stock.siru=(S.shop.stock.siru||0)+2;
  S.shop.stock.bean_seed=(S.shop.stock.bean_seed||0)+6;})()`, false);
await redraw();
for (const s of ['banjiha-dresser:1', 'banjiha-dresser:0']) {
  await place(s); await sleep(900); await walk();
}
await freeHands();
/* ⚠ 2026-10-24 [core] 총괄 D83 ③ — 08-16(a60495bf «동작 막대 · 연타 막음»)부터 0.5초 간격 연타가 씹혀(걸어가서 하는 동안 다음 누름은 안 받는다)
     물을 못 줘 곳간이 0판이었다(낡은 자). ⇒ 시루마다 id 로 누르고 «그 단추가 사라질 때까지»(걸어가서 한 동작이 끝날 때까지 · 15초 안) 기다린다.
     정해 둔 초로 기다리면 걷는 길이에 따라 또 씹힌다(1.2초로는 둘째 시루 심기가 씹혔다) — 못 끝나면 그 자리에서 떨어진다 */
const siruIds = await page.eval(`(()=>(window.__S().firstPlay.beansprout.pots||[]).map(p=>p.id))()`);
await page.eval(`window.__byeotSheet.open('plants')`, false); await sleep(600);
const btnOf = (id, a) => `document.querySelector('#siruList button[data-siru="${id}"][data-act="${a}"]')`;
const actOn = async (id, a) => {
  const clicked = await page.eval(`(()=>{const b=${btnOf(id, a)}; if(!b) return false; b.click(); return true;})()`);
  if (!clicked) return false;
  for (let i = 0; i < 60; i++) { await sleep(250); await walk(); if (!(await page.eval(`!!${btnOf(id, a)}`))) return true; }
  return false;
};
const actAll = async (a) => { for (const id of siruIds) { await freeHands(); const r = await actOn(id, a); if (!r) console.log(`      (준비) ${id} ${a} — 단추가 없거나 15초 안에 안 끝남`); await redraw(); } };
await actAll('plant');
await actAll('water');
await page.eval(`window.__byeotSheet.close()`, false); await sleep(400);
await redraw();
for (let d = 0; d < 7; d++) {                     /* 밥상 창이 뜨면 한 번 더 눌러 넘긴다 */
  await freeHands(); await click('next'); await sleep(1400); await walk();
  await freeHands(); await click('next'); await sleep(1400); await walk();
}
await freeHands();
await page.eval(`window.__byeotSheet.open('plants')`, false); await sleep(600);
await actAll('harvest');
await page.eval(`window.__byeotSheet.close()`, false); await sleep(400);
await redraw(); await sleep(800); await redraw();
const m0 = await money();
console.log(`\n(판) 곳간 ${m0.pantry}원 · ${m0.lots}판 · Day ${m0.day}`);
ok('판이 섰다 — 곳간에 두 판 이상', m0.lots >= 2, `${m0.lots}판`);

/* ══ A. 상점 고르개가 화면 한가운데 팝업으로 뜬다 ═════════════════════ */
console.log('\n== A. ★★ 팝업이 화면 한가운데 뜨고 뒤가 어두워지나 ==');
await openTab('shop');
await click('sellPantry');
await sleep(600);
{
  const scrim = await box('#pantryPanel');
  const card = await box('#pantryPanel .popcard');
  const vp = await page.eval(`({w:innerWidth,h:innerHeight})`);
  ok('★ 열렸다(`.on`)', await on('pantryPanel'));
  ok('★ 화면에 고정된다(position:fixed)', scrim && scrim.pos === 'fixed', scrim && scrim.pos);
  ok('★ 뒤를 통째로 덮는다(scrim)',
     !!scrim && scrim.x === 0 && scrim.y === 0 && scrim.w === vp.w && scrim.h === vp.h,
     JSON.stringify(scrim));
  ok('★★ 카드가 **화면 안**에 온전히 들어온다 (예전엔 y=1211 이었다)',
     !!card && card.y >= 0 && card.y + card.h <= vp.h, JSON.stringify(card));
  ok('★ 가로 한가운데다', !!card && Math.abs((card.x + card.w / 2) - vp.w / 2) <= 2,
     card && String(card.x + card.w / 2));
  /* 뒤가 실제로 어두워지는가 — 스크림에 바탕색이 있고 투명하지 않다 */
  const bg = await page.eval(`getComputedStyle(document.getElementById('pantryPanel')).backgroundColor`);
  ok('★ 뒤가 어두워진다(스크림 바탕색이 있다)',
     /rgba?\(/.test(bg) && !/rgba\(0, 0, 0, 0\)/.test(bg), bg);
}

/* ══ B. ★★★ 받을 돈을 그대로 말한다 — «손해»는 안 말한다 ════════════════
   ★ 2026-10-30 [plan] 총괄 D90 ⑤ — 예전 B 는 «손해를 그대로 말한다»였다. 그 «손해»는 물건 값(10원/g) − 판 값이라 하루 밥상 몫을
     넘어 쌓인 것까지 «손해»라 했고, 밥상 판의 «파는 편이 낫습니다»와 반대로 말했다(첫 플레이 비판 판). 한 목소리
     «하루 밥상에 오를 몫은 먹고, 그 위로 쌓이는 것은 판다» · 값 낱말은 «팔면 N원» 하나. 다 파는 날의 무게는 남긴다. */
console.log('\n== B. ★★★ 받을 돈이 팝업 안에 있고 «손해»는 없나(D90 ⑤) ==');
{
  const say = await txt('#pantryQuote');
  /* ⚠ 숫자를 이 파일에 안 적는다 — 화면 글자에서 뽑는다 */
  const nums = (say.match(/[\d,]+원/g) || []).map(s => Number(s.replace(/[^\d]/g, '')));
  ok('★★ «손해»를 말하지 않는다(한 목소리)', !/손해/.test(say), say);
  ok('★★ 받을 돈이 적혀 있다(«N원에 팝니다»)', /[\d,]+원에 팝니다/.test(say) && nums.length >= 1 && nums[0] > 0, say);
  ok('★ 남는 것 · 다 파는 날의 무게를 말한다', /그대로 둡니다|다 팝니다 — 밥상에 올릴 채소가 안 남습니다/.test(say), say);
  ok('★ 무게도 g 으로 적혀 있다', /\d+(\.\d+)?\s*(g|kg)/.test(say), say);
}

/* ══ D. z 순서 ═══════════════════════════════════════════════════════ */
console.log('\n== D. ★★ z 순서 — 메뉴가 팝업을 뚫지 않나 · 오류가 팝업 뒤에 숨지 않나 ==');
{
  const zs = await page.eval(`(()=>{const g=id=>{const e=document.getElementById(id);
    return e ? Number(getComputedStyle(e).zIndex) || 0 : null;};
    return { pop:g('pantryPanel'), meal:g('mealPanel'), nav:g('navbar'),
             scrim:g('sheetScrim'), sheet:g('sheet'), err:g('errBox') };})()`);
  ok('★★ 팝업 > 왼쪽 세로 메뉴', zs.pop > zs.nav, `팝업 ${zs.pop} · 메뉴 ${zs.nav}`);
  ok('★ 팝업 > 시트·시트 스크림', zs.pop > zs.sheet && zs.pop > zs.scrim,
     `시트 ${zs.sheet} · 스크림 ${zs.scrim}`);
  ok('★ 두 팝업이 같은 층이다', zs.pop === zs.meal, `${zs.pop} / ${zs.meal}`);
  ok('★★ 오류 상자 > 팝업 (안 그러면 「눌렀는데 말이 없다」가 된다)',
     zs.err > zs.pop, `오류 ${zs.err} · 팝업 ${zs.pop}`);
  /* 실제로 가려지나 — 메뉴 단추 한가운데를 쏘아 무엇이 맞는지 본다 */
  const hit = await page.eval(`(()=>{const b=document.getElementById('navRoom');
    if(!b) return 'no-nav'; const r=b.getBoundingClientRect();
    const el=document.elementFromPoint(r.x+r.width/2, r.y+r.height/2);
    return el ? (el.id || el.className || el.tagName) : 'null';})()`);
  ok('★★ 팝업이 열린 동안 메뉴 자리를 눌러도 **팝업이 받는다**',
     /pantryPanel|pop/.test(String(hit)), String(hit));
}

/* ══ C. 닫는 길 셋 — 그리고 셋 다 돈이 안 나간다 ═══════════════════════ */
console.log('\n== C. ★★ 닫는 길 셋 · 돈이 안 나가나 ==');
{
  const before = await money();
  /* ① 뒤 누르기 */
  await page.eval(`(()=>{const el=document.getElementById('pantryPanel');
    el.dispatchEvent(new MouseEvent('click',{bubbles:true}));})()`, false);
  await sleep(400);
  ok('★★ ① 뒤를 누르면 닫힌다', !(await on('pantryPanel')));
  let a = await money();
  ok('   돈이 한 푼도 안 나갔다', a.cash === before.cash && a.pantry === before.pantry,
     `지갑 ${a.cash} · 곳간 ${a.pantry}`);

  /* ② [그만두기] */
  await click('sellPantry'); await sleep(450);
  ok('   다시 열린다', await on('pantryPanel'));
  await click('pantryCancel'); await sleep(400);
  ok('★ ② [그만두기]로 닫힌다', !(await on('pantryPanel')));
  a = await money();
  ok('   돈이 한 푼도 안 나갔다', a.cash === before.cash && a.pantry === before.pantry,
     `지갑 ${a.cash} · 곳간 ${a.pantry}`);

  /* ③ Esc — 안드로이드 뒤로가기와 같은 자리 */
  await click('sellPantry'); await sleep(450);
  await page.eval(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))`, false);
  await sleep(400);
  ok('★ ③ Esc 로 닫힌다', !(await on('pantryPanel')));
  ok('★ Esc 가 팝업만 닫고 **시트는 그대로 둔다** (위엣것부터 닫힌다)',
     await page.eval(`document.getElementById('sheet').classList.contains('open')`));
  a = await money();
  ok('   돈이 한 푼도 안 나갔다', a.cash === before.cash && a.pantry === before.pantry,
     `지갑 ${a.cash} · 곳간 ${a.pantry}`);

  /* 카드 **안**을 눌러도 안 닫힌다 — 안 그러면 ± 를 누를 때마다 창이 사라진다 */
  await click('sellPantry'); await sleep(450);
  await page.eval(`(()=>{const c=document.querySelector('#pantryPanel .popcard');
    c.dispatchEvent(new MouseEvent('click',{bubbles:true}));})()`, false);
  await sleep(350);
  ok('★★ 카드 **안**을 누르면 안 닫힌다', await on('pantryPanel'));
}

/* ══ E. 판다 — 화면이 값을 두 번 세지 않나 ═══════════════════════════ */
console.log('\n== E. ★ 팔면 지갑이 적힌 만큼만 는다 ==');
{
  const say = await txt('#pantryQuote');
  const nums = (say.match(/[\d,]+원/g) || []).map(s => Number(s.replace(/[^\d]/g, '')));
  const before = await money();
  await click('pantryGo'); await sleep(800);
  const a = await money();
  ok('★ 팔면 팝업이 닫힌다', !(await on('pantryPanel')));
  /* ★ 2026-10-30 D90 ⑤ — 문구의 원은 이제 «받을 돈» 하나다(물건 값 · 손해는 안 적는다) */
  ok('★★ 지갑이 **적힌 값만큼** 늘었다', a.cash - before.cash === nums[0],
     `${before.cash} → ${a.cash} (적힌 값 ${nums[0]})`);
  ok('★★ 곳간이 줄었다', before.pantry > a.pantry, `${before.pantry} → ${a.pantry}`);
  const ev = await txt('#event');
  ok('★ 배너가 판 것을 말한다', /팔았습니다/.test(ev), ev.slice(0, 60));
  ok('★ 배너는 들어온 돈을 말하고 «손해»는 안 말한다', /들어왔습니다/.test(ev) && !/손해/.test(ev), ev.slice(0, 80));
}

/* ══ F. 밥상도 같은 틀인가 ═══════════════════════════════════════════ */
console.log('\n== F. ★★ 오늘 밥상도 같은 틀 · 넘기기와 그만두기 ==');
await page.eval(`window.__byeotSheet.close()`, false);
await sleep(400);
{
  await freeHands();
  await click('next'); await sleep(1200);
  ok('★ [다음 날] 첫 누름에 밥상 팝업이 뜬다', await on('mealPanel'));
  const cls = await page.eval(`(()=>{const e=document.getElementById('mealPanel');
    return e.className + '|' + (e.querySelector('.popcard') ? 'popcard' : 'none');})()`);
  ok('★★ **상점 고르개와 같은 틀**(`.pop` + `.popcard`)',
     /\bpop\b/.test(cls) && /popcard/.test(cls), cls);
  const card = await box('#mealPanel .popcard');
  const vp = await page.eval(`({w:innerWidth,h:innerHeight})`);
  ok('★ 카드가 화면 안 한가운데다',
     !!card && card.y >= 0 && card.y + card.h <= vp.h &&
     Math.abs((card.x + card.w / 2) - vp.w / 2) <= 2, JSON.stringify(card));
  /* ★ 2026-10-30 [plan] D90 ⑤ — 밥상 글이 한 목소리로 바뀌었다(«… 남은 Ng은 [상점]에서 파는 편이 낫습니다» · c8448676). 총괄 고정 판 걸음에서 잡힘 */
  ok('★ 남는 몫을 말한다', /쌓입니다|아낍니다|파는 편이 낫습니다/.test(await txt('#mealSay')), await txt('#mealSay'));

  /* [그만두기] — 하루가 **안** 간다 */
  const b1 = await money();
  await click('mealCancel'); await sleep(600);
  const a1 = await money();
  ok('★★ [그만두기]는 닫기만 한다 — **하루가 안 간다**', a1.day === b1.day, `Day ${a1.day}`);
  ok('★ 고른 값도 지워진다 (0g 을 골랐다 그만둔 판이 조용히 0g 을 안 먹는다)',
     a1.plan == null, String(a1.plan));

  /* [이대로 다음 날 ▸] — 하루가 간다 */
  await freeHands();
  await click('next'); await sleep(1200);
  ok('   다시 열린다', await on('mealPanel'));
  const b2 = await money();
  await freeHands();
  await click('mealGo'); await sleep(2200); await walk();
  const a2 = await money();
  ok('★★ [이대로 다음 날 ▸]로 **하루가 간다**', a2.day === b2.day + 1, `${b2.day} → ${a2.day}`);
  ok('★ 넘긴 뒤 팝업이 닫혀 있다', !(await on('mealPanel')));
  ok('★ 곳간에서 밥이 나갔다', a2.pantry < b2.pantry, `${b2.pantry} → ${a2.pantry}`);
}

/* ══ G. 360·390·430 셋 다 44px ═══════════════════════════════════════ */
/* ⚠⚠ **여기서만 지름길을 쓴다** — §F 가 곳간을 다 먹어 비었다. 다시 채우려면 7일을
   더 굴려야 하는데, 이 절이 재는 것은 **단추 크기**지 살림이 아니다.
   ⇒ 꾸러미를 손으로 세운다. **위 §A~F 는 지름길 없이 밟은 것이다.** */
const refill = async () => {
  await page.eval(`(()=>{const S=window.__S(), f=S.firstPlay.food;
    f.pantryWon = 6000;
    f.pantryLots = [{kind:'beansprout', day:S.day, won:4000, meals:3},
                    {kind:'beansprout', day:S.day, won:2000, meals:3}];
    f.mealPlanWon = null;
    /* ⚠ 2026-10-24 [core] 총괄 D83 ③ — 10-08 D13(b9817f04) «어제와 같고 모자라지 않으면 밥상 팝업 없이 한 줄로 넘긴다» 뒤로, 준비가 날을 넘기며 «그대로»를
         골라 두면 [다음 날]이 팝업 없이 지나갔다. 이 단락이 재는 것은 팝업 단추 크기라 «어제 밥상» 기억을 지워 팝업을 띄운다 */
    try { localStorage.removeItem('byeot.mealLast'); } catch (e) { console.warn('[검사] 밥상 기억', e && e.message); }})()`, false);
  await redraw();
};
console.log('\n== G. ★ 폰 셋 다 — 단추 44px (곳간은 지름길로 채웠다) ==');
for (const w of [360, 390, 430]) {
  await refill();
  await page.send('Emulation.setDeviceMetricsOverride',
                  { width: w, height: 844, deviceScaleFactor: 2, mobile: false });
  await sleep(500);
  await openTab('shop');
  await click('sellPantry'); await sleep(500);
  const opened = await on('pantryPanel');
  if (!opened) { ok(`${w}px — 고르개가 열린다`, false, '곳간이 비었나'); continue; }
  const bs = await page.eval(`(()=>[...document.querySelectorAll('#pantryPanel button')]
    .map(b=>{const r=b.getBoundingClientRect();
      return {t:(b.textContent||'').trim(), w:Math.round(r.width), h:Math.round(r.height)};}))()`);
  const small = bs.filter(b => b.h < 44 || b.w < 44);
  ok(`★ ${w}px — 상점 고르개 단추 ${bs.length}개가 다 44px 이상`,
     small.length === 0, small.length ? JSON.stringify(small) : JSON.stringify(bs.map(b => `${b.w}×${b.h}`)));
  const card = await box('#pantryPanel .popcard');
  ok(`  ${w}px — 카드가 화면 안이다`, !!card && card.y >= 0 && card.y + card.h <= 844,
     JSON.stringify(card));
  ok(`  ${w}px — 가로로 안 넘친다`,
     await page.eval(`document.documentElement.scrollWidth <= innerWidth + 1`));
  await click('pantryCancel'); await sleep(300);
  await page.eval(`window.__byeotSheet.close()`, false); await sleep(300);

  await freeHands();
  await click('next'); await sleep(1200);
  /* ⚠ 2026-10-24 [core] D81 ⑦ — 안 뜨면 예전엔 ok(…, true)(건너뜀이 통과로 셌다). 곳간은 refill 로 채웠으니 «뜬다»를 잰다 */
  const mealOn = await on('mealPanel');
  ok(`  ${w}px — 밥상 팝업이 뜬다(곳간을 채운 판)`, mealOn, mealOn ? '' : '안 뜸');
  if (mealOn) {
    const ms = await page.eval(`(()=>[...document.querySelectorAll('#mealPanel button')]
      .map(b=>{const r=b.getBoundingClientRect();
        return {t:(b.textContent||'').trim(), w:Math.round(r.width), h:Math.round(r.height)};}))()`);
    const sm = ms.filter(b => b.h < 44 || b.w < 44);
    ok(`★ ${w}px — 밥상 고르개 단추 ${ms.length}개가 다 44px 이상`,
       sm.length === 0, sm.length ? JSON.stringify(sm) : JSON.stringify(ms.map(b => `${b.w}×${b.h}`)));
    await click('mealCancel'); await sleep(300);
  }
}

/* ══ 부팅 예외 0 ═════════════════════════════════════════════════════ */
console.log('\n== 예외 ==');
ok('★ 콘솔 예외 0', errs.length === 0, errs.slice(0, 3).join(' | '));

console.log(`\n잰 것 ${seen}개 · 어긋난 것 ${bad}개`);
await page.close();
process.exit(bad ? 1 : 0);
