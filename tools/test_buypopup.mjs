/* ============================================================
   tools/test_buypopup.mjs — **주문할 때 개수를 고른다** (2026-08-18 신설)
   ------------------------------------------------------------
     python tools/serve.py 8963
     BYEOT_URL=http://localhost:8963 node tools/test_buypopup.mjs

   박사님: *"상점 주문시 개수 입력창 뜨게. 개수는 직전 주문량이 디폴트로"*

   고치기 전에는 [주문]이 `confirmOnce('정말 주문?')` 라 **단추 글자가 바뀌고 한 개**만
   나갔다. 개수를 고르는 자리가 없었고 총액도 화면에 안 적혔다.

   ══ 무엇을 못 박나 ═══════════════════════════════════════════════════════
     A  ★★ **팝업이 뜬다** — 팔기 팝업과 **같은 틀**(`.pop`/`.popcard` · z 84) ·
        `#sheet` **밖**에 산다(변형된 조상 안에 두면 화면 밖으로 나간다 · sellpopup §2-2)
     B  ★★★ **디폴트가 「직전 주문량」이다** — 처음엔 1, 3개를 시킨 뒤엔 3.
        그리고 ⚠ **품목마다 따로** 기억한다(씨앗 3개 뒤 시루를 열면 1이어야 한다)
     C  ★★ **새로고침해도 남는다** — 화면 변수가 아니라 localStorage 다
     D  ★★ **총액이 한눈에** — 화면이 적은 개당값·개수·총액이 서로 맞고,
        주문 뒤 **코어가 낸 값**(`S.shop.orders[].unitWon/totalWon/qty`)과 같다
     E  ★★ **닫는 길 셋**([그만두기] · 뒤 누르기 · Esc)이 다 열려 있고 **셋 다 돈이 안 나간다**
     F  ★★ **돈이 모자라면 그 자리에서 말한다** — 예전에는 단추가 회색 + `title` 뿐이었다
        (폰에 `title` 은 안 뜬다). 그리고 **기억한 개수가 지금 돈으로 안 되면 내려서 열고
        그 까닭을 적는다**
     G  ★ **배송 일수**를 적는다(품목마다 다르다) · **배너가 개수와 총액을 말한다**
     H  ★ **360·390·430 셋 다** 팝업 안 단추가 44px 아래로 안 내려간다

   ⚠ **숫자를 이 파일에 안 박는다.** 값·개수·총액·배송일은 전부 `window.__S()` 와
     화면 글자에서 뽑아 서로 대조한다 — START-HERE §2.8 의 사고가 그 반대다.
   ★ **지름길은 하나뿐**이고 §F 에만 쓴다: `S.tutorial.cashWon` 을 직접 낮춘다.
     「돈이 모자란 판」을 실제로 만들려면 150만원을 다 쓰는 수밖에 없는데, 그것은
     이 검사가 재려는 것(고르개)이 아니다. 그 자리에 적어 두었다.
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

async function boot(clear) {
  await page.goto(`${BASE}/game.html`);
  if (clear) {                                     // ⚠ `localStorage.clear()` 는 goto 뒤에
    await page.eval(`localStorage.clear()`, false);
    await page.goto(`${BASE}/game.html`);
  }
  await page.waitFor('!!window.__rv', 180000, 300);
  await page.waitFor('window.__byeotBooted === true', 180000, 300);
  await sleep(7000);
  await walk();
}
async function walk() {
  for (let i = 0; i < 80; i++) {
    const busy = await page.eval(`(()=>{const s=document.getElementById('stage'),
      g=document.getElementById('guide');
      return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`);
    if (!busy) return;
    await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s) s.click();
      const b=document.getElementById('dlgBox'); if(b) b.click();
      const g=document.getElementById('guideClose'); if(g) g.click();})()`, false);
    await sleep(280);
  }
}

/* ── 손 ─────────────────────────────────────────────────────────────── */
const click = (id) => page.eval(`(()=>{const b=document.getElementById('${id}');
  if(!b) return false; b.click(); return true;})()`);
const buy = (id) => page.eval(`(()=>{const b=document.querySelector('[data-buy="${id}"]');
  if(!b) return false; b.click(); return true;})()`);
const openTab = async (t) => { await page.eval(`window.__byeotSheet.open('${t}')`, false); await sleep(450); };
const txt = (sel) => page.eval(`(()=>{const e=document.querySelector('${sel}');
  return e ? (e.textContent||'').replace(/\\s+/g,' ').trim() : '';})()`);
const on = (id) => page.eval(`(()=>{const e=document.getElementById('${id}');
  return !!(e && e.classList.contains('on'));})()`);
const dis = (id) => page.eval(`(()=>{const e=document.getElementById('${id}');
  return e ? !!e.disabled : null;})()`);
const redraw = async () => { await page.eval(`window.__redraw && window.__redraw()`, false); await sleep(350); };

/* 코어가 낸 값 — 화면 글자와 대조할 정본 */
const core = () => page.eval(`(()=>{const S=window.__S(), o=(S.shop&&S.shop.orders)||[];
  const last=o[o.length-1]||null;
  return { cash: S.tutorial ? S.tutorial.cashWon : null, day: S.day,
           orders: o.length, spent: S.shop ? S.shop.spentWon : null,
           last: last ? {itemId:last.itemId, qty:last.qty, unitWon:last.unitWon,
                         totalWon:last.totalWon, arrivesOnDay:last.arrivesOnDay} : null };})()`);
/* 화면 글자 안의 수를 전부 뽑는다 — 「1,000원」 같은 자릿점을 푼다 */
const nums = (s) => (String(s).match(/[\d,]*\d/g) || []).map(v => +v.replace(/,/g, ''));

/* 팝업을 연다 → 화면이 적은 것을 통째로 읽어 온다 */
async function popRead() {
  return {
    on: await on('buyPanel'),
    title: await txt('#buyTitle'), sub: await txt('#buySub'),
    have: await txt('#buyHave'), count: await txt('#buyCount'),
    quote: await txt('#buyQuote'), go: await txt('#buyGo'),
    goDis: await dis('buyGo'), minusDis: await dis('buyMinus'),
    plusDis: await dis('buyPlus'), allDis: await dis('buyAll')
  };
}
const countOf = (p) => nums(p.count)[0];

await boot(true);
await openTab('shop');

/* ══ A. 팝업이 뜬다 · 팔기 팝업과 같은 틀 ══════════════════════════════ */
console.log('\n== A. ★★ [주문]을 누르면 개수를 고르는 팝업이 뜬다 ==');
{
  ok('  누르기 전에는 안 떠 있다', !(await on('buyPanel')));
  await buy('bean_seed'); await sleep(400);
  const p0 = await popRead();
  ok('★★ 한 번 누르면 팝업이 뜬다 (예전에는 단추 글자만 「정말 주문?」으로 바뀌었다)', p0.on);
  ok('  무엇을 시키는지 제목이 말한다', /씨앗/.test(p0.title), p0.title);

  const g = await page.eval(`(()=>{const e=document.getElementById('buyPanel'),
      c=e.querySelector('.popcard'), cs=getComputedStyle(e),
      pc=getComputedStyle(document.getElementById('pantryPanel'));
    const r=c.getBoundingClientRect();
    return { pos:cs.position, z:cs.zIndex, sameZ: cs.zIndex===pc.zIndex,
      sameClass: e.classList.contains('pop') && c.classList.contains('popcard'),
      inSheet: !!(document.getElementById('sheet')||{contains:()=>false}).contains(e),
      inBottom: !!(document.getElementById('bottom')||{contains:()=>false}).contains(e),
      x:Math.round(r.x), y:Math.round(r.y), w:Math.round(r.width), h:Math.round(r.height),
      vw: innerWidth, vh: innerHeight,
      scrollW: document.documentElement.scrollWidth };})()`);
  ok('★★ 같은 틀을 쓴다 (.pop + .popcard)', g.sameClass);
  ok('★★ 팔기 팝업과 **같은 층**이다 (z 가 같다)', g.sameZ, 'z=' + g.z);
  ok('  화면 고정이다 (position:fixed)', g.pos === 'fixed', g.pos);
  ok('★★ `#sheet`·`#bottom` **밖**에 있다 (변형된 조상 안이면 화면 밖으로 나간다)',
     !g.inSheet && !g.inBottom);
  ok('★★ 카드가 **화면 안**에 온전히 있다',
     g.y >= 0 && g.x >= 0 && g.y + g.h <= g.vh && g.x + g.w <= g.vw,
     `x${g.x} y${g.y} ${g.w}×${g.h} / ${g.vw}×${g.vh}`);
  ok('  가로로 안 넘친다', g.scrollW <= g.vw, `${g.scrollW} <= ${g.vw}`);
}

/* ══ B·D. 디폴트 1 · 총액 · 코어 값과 대조 ═════════════════════════════ */
console.log('\n== B·D. ★★★ 처음엔 1개 · 올리면 총액이 따라 온다 ==');
let unitWon = null, leadDays = null;
{
  const p1 = await popRead();
  ok('★★★ **처음 시키는 품목은 디폴트가 1개**', countOf(p1) === 1, p1.count);
  ok('  1개일 때 [−]가 회색이다 (아래끝)', p1.minusDis === true);

  /* 개당값·배송일은 화면이 적은 것을 읽어 둔다 — 아래에서 코어 값과 맞춰 본다 */
  const sub = nums(p1.sub);
  ok('  개당값·배송일·소지금을 적는다', sub.length >= 3, p1.sub);
  unitWon = sub[0]; leadDays = sub[1];
  ok('★ **배송 일수**를 적는다 (품목마다 다르다)', leadDays >= 1 && leadDays <= 2, p1.sub);

  await click('buyPlus'); await sleep(200);
  await click('buyPlus'); await sleep(300);
  const p3 = await popRead();
  ok('  [＋]로 개수가 오른다', countOf(p3) === 3, p3.count);

  const q = nums(p3.quote);
  ok('★★ 총액이 **개당값 × 개수**와 맞는다', q[0] === unitWon && q[1] === 3 && q[2] === unitWon * 3,
     p3.quote);
  const before = await core();
  const rest = q[q.length - 1];
  ok('★ **남는 돈**도 적는다 (소지금 − 총액)', rest === before.cash - unitWon * 3, p3.quote);
  ok('★ 단추 자신이 **얼마가 나가는지**를 적는다',
     nums(p3.go)[0] === 3 && nums(p3.go)[1] === unitWon * 3, p3.go);

  /* ── 실제로 시킨다 ── */
  await click('buyGo'); await sleep(900);
  const after = await core();
  ok('★★ 팝업이 닫힌다', !(await on('buyPanel')));
  ok('★★★ **고른 개수 그대로** 주문이 나갔다', after.last && after.last.qty === 3,
     after.last && String(after.last.qty));
  ok('★★ 화면이 적은 개당값이 **코어 값과 같다**', after.last.unitWon === unitWon,
     `화면 ${unitWon} / 코어 ${after.last.unitWon}`);
  ok('★★ 화면이 적은 총액이 **코어 값과 같다**', after.last.totalWon === unitWon * 3,
     `화면 ${unitWon * 3} / 코어 ${after.last.totalWon}`);
  ok('★★ 지갑에서 **총액만큼만** 나갔다', before.cash - after.cash === after.last.totalWon,
     `${before.cash} → ${after.cash}`);
  ok('★ 화면이 적은 배송일이 코어와 같다', after.last.arrivesOnDay - after.day === leadDays,
     `화면 ${leadDays}일 / 코어 ${after.last.arrivesOnDay - after.day}일`);

  /* G — 배너가 개수와 총액을 말한다 */
  const ev = await txt('#event');
  ok('★★ 배너가 **몇 개**를 시켰는지 말한다', /3개/.test(ev), ev);
  ok('★★ 배너가 **총액**을 말한다', nums(ev).includes(after.last.totalWon), ev);
  ok('  배너가 언제 오는지도 말한다', /뒤 도착/.test(ev), ev);
}

/* ══ B-2. 디폴트가 직전 주문량이다 · 품목마다 따로 ══════════════════════ */
console.log('\n== B-2. ★★★ 디폴트는 「그 품목을 직전에 몇 개 시켰나」 ==');
{
  await buy('bean_seed'); await sleep(400);
  const p = await popRead();
  ok('★★★ **3개를 시킨 뒤 다시 열면 3개가 떠 있다**', countOf(p) === 3, p.count);
  await click('buyCancel'); await sleep(300);

  await buy('siru'); await sleep(400);
  const s = await popRead();
  ok('★★★ ⚠ **품목마다 따로 기억한다** — 시루는 1개다 (씨앗 3개가 새어 오면 안 된다)',
     countOf(s) === 1, s.count);
  ok('  시루는 배송이 이틀이다 (씨앗과 다르다)', nums(s.sub)[1] !== leadDays, s.sub);
  const sLead = nums(s.sub)[1];

  /* 시루를 2개 시켜서 「둘이 서로 안 섞인다」를 실제로 못 박는다 */
  await click('buyPlus'); await sleep(250);
  await click('buyGo'); await sleep(900);
  const c = await core();
  ok('  시루 2개가 나갔다', c.last && c.last.itemId === 'siru' && c.last.qty === 2,
     c.last && `${c.last.itemId} ${c.last.qty}개`);
  ok('  시루 배송일도 코어와 같다', c.last.arrivesOnDay - c.day === sLead, String(sLead));

  await buy('siru'); await sleep(400);
  ok('★★ 시루를 다시 열면 **2개**다', countOf(await popRead()) === 2);
  await click('buyCancel'); await sleep(250);
  await buy('bean_seed'); await sleep(400);
  ok('★★★ 그래도 씨앗은 여전히 **3개**다 (뒤에 시킨 것이 안 덮어쓴다)',
     countOf(await popRead()) === 3);
}

/* ══ E. 닫는 길 셋 — 셋 다 돈이 안 나간다 ══════════════════════════════ */
console.log('\n== E. ★★ 닫는 길이 셋이고 셋 다 돈이 안 나간다 ==');
{
  const b = await core();
  /* ① [그만두기] */
  await click('buyCancel'); await sleep(300);
  ok('① [그만두기]로 닫힌다', !(await on('buyPanel')));

  /* ② 뒤 누르기(scrim) — 카드 **안**을 누르면 안 닫혀야 한다 */
  await buy('bean_seed'); await sleep(400);
  await page.eval(`(()=>{document.querySelector('#buyPanel .popcard').click();})()`, false);
  await sleep(300);
  ok('  ⚠ 카드 **안**을 눌러서는 안 닫힌다 (±를 누를 때마다 창이 사라지면 못 쓴다)',
     await on('buyPanel'));
  await page.eval(`(()=>{document.getElementById('buyPanel').click();})()`, false);
  await sleep(300);
  ok('② **뒤 누르기**로 닫힌다', !(await on('buyPanel')));

  /* ③ Esc (안드로이드 뒤로가기와 같은 손) */
  await buy('bean_seed'); await sleep(400);
  const popped = await page.eval(`window.__byeotPopClose()`);
  await sleep(300);
  ok('③ **Esc**로 닫힌다', popped === true && !(await on('buyPanel')));
  /* ⚠ 시트가 열려 있다는 표시는 `.open` 이다(`.on` 이 아니다 — game.html §openSheet) */
  ok('  ⚠ Esc 는 팝업만 닫고 **시트는 남긴다**',
     await page.eval(`document.getElementById('sheet').classList.contains('open')`));

  const a = await core();
  ok('★★ 닫는 세 길 어느 것으로도 **돈이 한 푼도 안 나갔다**',
     a.cash === b.cash && a.orders === b.orders, `${b.cash} → ${a.cash}`);
}

/* ══ B-3. [전부] — 살 수 있는 최대 ════════════════════════════════════ */
console.log('\n== B-3. ★ [전부]는 「살 수 있는 최대」다 ==');
{
  await buy('bean_seed'); await sleep(400);
  const c = await core();
  await click('buyAll'); await sleep(400);
  const p = await popRead();
  const maxQty = Math.floor(c.cash / unitWon);
  ok('★ [전부]가 **소지금으로 살 수 있는 최대**로 간다', countOf(p) === maxQty,
     `${p.count} / 소지금 ${c.cash} ÷ ${unitWon} = ${maxQty}`);
  ok('  위끝에서는 [＋]와 [전부]가 회색이다', p.plusDis === true && p.allDis === true);
  ok('★★ **왜 더 못 올리는지**를 그 자리에서 말한다 (§조용한 실패)',
     /소지금으로는/.test(p.quote) && nums(p.quote).includes(maxQty), p.quote);
  await click('buyCancel'); await sleep(300);
}

/* ══ J. ★ 누른 채로 있으면 개수가 빨리 오른다 (2026-08-18) ═══════════════
   ⚠ **±10 단추를 안 넣은 자리**다 — 360px 에서 여섯 칸이 되면 42.8px 로 44px 아래가 된다.
     그래서 **자리를 안 먹는 길**을 골랐다. 이 절이 그것이 실제로 도는지를 잰다. */
console.log('\n== J. ★ [＋]를 누른 채로 있으면 빨라진다 (±10 단추가 못 들어가서 고른 길) ==');
{
  await buy('bean_seed'); await sleep(400);
  const before = countOf(await popRead());
  await page.eval(`(()=>{document.getElementById('buyPlus')
    .dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));})()`, false);
  await sleep(1200);
  const held = countOf(await popRead());
  ok('★★ 누르고 있는 동안 개수가 오른다 (한 번도 안 뗐다)', held - before >= 5,
     `${before}개 → ${held}개 (1.2초)`);
  /* 손을 뗀다 — ⚠ 뗄 때 오는 클릭이 **한 번 더 세면 안 된다** */
  await page.eval(`(()=>{const b=document.getElementById('buyPlus');
    b.dispatchEvent(new PointerEvent('pointerup',{bubbles:true})); b.click();})()`, false);
  await sleep(400);
  const after = countOf(await popRead());
  ok('★★ 손을 뗄 때 **하나가 더 안 붙는다** (화면에 뜬 수를 보고 뗐는데 늘면 고른 수가 아니다)',
     after === held, `뗄 때 ${held}개 → ${after}개`);
  /* 다음 한 번 누르기는 정상으로 는다 — 「먹은 클릭」이 다음 것까지 먹으면 안 된다 */
  await click('buyPlus'); await sleep(300);
  ok('  그 다음 한 번 누르기는 정상으로 는다', countOf(await popRead()) === after + 1);
  await click('buyCancel'); await sleep(300);
  /* ⚠ 이 절이 기억을 더럽히지 않게 — 주문을 안 했으므로 기억은 그대로다(§B-2 가 뒤에 온다) */
  await buy('bean_seed'); await sleep(400);
  ok('  ⚠ 고르다 그만둔 값은 **기억에 안 남는다**', countOf(await popRead()) === 3,
     (await popRead()).count);
  await click('buyCancel'); await sleep(250);
}

/* ══ C. 새로고침해도 디폴트가 남는다 ══════════════════════════════════ */
console.log('\n== C. ★★ 새로고침해도 「직전 주문량」이 남는다 ==');
{
  await boot(false);                       /* ⚠ localStorage 를 **안 지운다** */
  await openTab('shop');
  await buy('bean_seed'); await sleep(500);
  const p = await popRead();
  ok('★★ 씨앗은 여전히 3개다 (화면 변수였다면 1로 돌아간다)', countOf(p) === 3, p.count);
  await click('buyCancel'); await sleep(250);
  await buy('siru'); await sleep(400);
  ok('★★ 시루는 여전히 2개다', countOf(await popRead()) === 2);
  await click('buyCancel'); await sleep(250);
}

/* ══ F. 돈이 모자라면 그 자리에서 말한다 ═══════════════════════════════
   ⚠⚠ **여기만 지름길이다** — `S.tutorial.cashWon` 을 직접 낮춘다.
     돈이 모자란 판을 실제로 만들려면 150만원을 다 써야 하는데, 이 검사가 재는 것은
     「모자랄 때 화면이 말하나」지 살림이 아니다. 값·판매율은 손대지 않았다. */
console.log('\n== F. ★★ 돈이 모자라면 **그 자리에서** 말한다 ==');
{
  /* F-1. 기억한 3개는 못 사고 2개는 살 수 있는 돈 */
  await page.eval(`(()=>{window.__S().tutorial.cashWon = ${unitWon * 2};})()`, false);
  await redraw();
  await buy('bean_seed'); await sleep(400);
  const p = await popRead();
  ok('★★ [주문] 단추가 **회색이 아니다** — 눌러야 까닭을 들을 수 있다', p.on);
  ok('★★★ 기억한 3개가 **살 수 있는 데까지(2개) 내려서** 열린다', countOf(p) === 2, p.count);
  ok('★★ 그리고 **왜 더 못 올리는지**를 적는다', /소지금으로는/.test(p.quote), p.quote);
  ok('  그 자리에서 시킬 수는 있다', p.goDis === false);

  /* F-2. 한 개도 못 사는 돈 */
  await click('buyCancel'); await sleep(250);
  await page.eval(`(()=>{window.__S().tutorial.cashWon = 100;})()`, false);
  await redraw();
  await buy('siru'); await sleep(400);
  const q = await popRead();
  ok('★★ 한 개도 못 살 때에도 **창은 뜬다** (예전에는 회색 단추 + title 뿐이었다)', q.on);
  ok('★★★ **돈이 모자란다고 말한다**', /모자[랍라]/.test(q.quote), q.quote);
  ok('★★ **얼마가 모자란지**까지 말한다', nums(q.quote).length >= 3, q.quote);
  ok('  그 말이 눈에 띈다 (경고 칠)',
     await page.eval(`(()=>document.getElementById('buyQuote').className.indexOf('warn')>=0)()`));
  ok('★ 그때 [주문]은 회색이다 (누를 수 있으면 그게 조용한 실패다)', q.goDis === true);

  const b = await core();
  await click('buyGo'); await sleep(500);
  const a = await core();
  ok('★★ 회색 단추를 눌러도 **아무 일도 안 난다**',
     a.cash === b.cash && a.orders === b.orders);
  await click('buyCancel'); await sleep(250);
}

/* ══ H. 360 · 390 · 430 — 단추가 44px 아래로 안 내려간다 ═══════════════ */
console.log('\n== H. ★ 세 폭 다 눌리는 크기다 ==');
for (const w of [360, 390, 430]) {
  await page.send('Emulation.setDeviceMetricsOverride',
                  { width: w, height: 844, deviceScaleFactor: 2, mobile: false });
  await sleep(700);
  await openTab('shop');
  await buy('bean_seed'); await sleep(500);
  const m = await page.eval(`(()=>{const e=document.getElementById('buyPanel');
    if(!e.classList.contains('on')) return null;
    const c=e.querySelector('.popcard'), r=c.getBoundingClientRect();
    const bs=[...c.querySelectorAll('button')].filter(b=>b.offsetParent!==null)
      .map(b=>{const q=b.getBoundingClientRect();
               return {w:Math.round(q.width), h:Math.round(q.height)};});
    return { btns: bs, minH: Math.min(...bs.map(b=>b.h)),
             x:Math.round(r.x), y:Math.round(r.y), w:Math.round(r.width), h:Math.round(r.height),
             vw:innerWidth, vh:innerHeight, scrollW:document.documentElement.scrollWidth };})()`);
  ok(`${w} — 팝업이 뜬다`, !!m);
  if (!m) continue;
  ok(`${w} — ★ 단추가 전부 **44px 이상**`, m.minH >= 44,
     m.btns.map(b => `${b.w}×${b.h}`).join(' · '));
  ok(`${w} — 카드가 화면 안이다`,
     m.y >= 0 && m.x >= 0 && m.y + m.h <= m.vh && m.x + m.w <= m.vw,
     `x${m.x} y${m.y} ${m.w}×${m.h}`);
  ok(`${w} — 가로로 안 넘친다`, m.scrollW <= m.vw, `${m.scrollW} <= ${m.vw}`);
  await click('buyCancel'); await sleep(250);
}

/* ══ 부팅 예외 ════════════════════════════════════════════════════════ */
console.log('\n== 부팅·조작 중 던진 예외 ==');
ok('★ 예외가 하나도 없다', errs.length === 0, errs.slice(0, 3).join(' | '));

console.log(`\n잰 것 ${seen}개 · 어긋난 것 ${bad}개`);
await page.close();
process.exit(bad ? 1 : 0);
