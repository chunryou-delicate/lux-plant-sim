/* ============================================================
   tools/test_dawn6.mjs — 하루의 경계는 **새벽 6시** · 넘기는 연출 · 2026-08-15 신설
   ------------------------------------------------------------
     python tools/serve.py 8963
     BYEOT_URL=http://localhost:8963 node tools/test_dawn6.mjs

   ★ 왜 이 검사가 필요한가 — 박사님이 정하셨다:
     *"하루정산은 새벽 6시로 하자. 하루넘기기하면 새벽 6시가 되는 거야. 그때 그리고
       식비정산이 되는 거고. 탁 하면 넘어가는 게 아니라 넘기기 하면 시간이 엄청 빨리
       지나면서 새벽 6시가 되게 해줘."*

   ★★ **고치기 전에는 하루가 「아무 때나」 갈렸다.** `dayPhase` 는 평소 시계가 실시간으로
     미는 값이고 [다음 날]은 그 값을 한 번도 안 건드렸다 — 그래서 경계가 누를 때마다
     밀렸다(실측: 30일 사이 07:49 → 08:18, 그것도 판마다 다른 자리에서).

   ══ 무엇을 보나 ═══════════════════════════════════════════════════════════
     A  ★★ 하루의 경계가 **6시에 못 박힌다** — 새 판도, 다섯 번을 넘겨도 안 밀린다
     B  ★★ 연출이 돈다 · **「넘어가는 중」이라고 말한다** · 그동안 다른 게 안 눌린다
        (⚠ 조용히 막지 않는다 — 이 저장소 지병이 「조용한 실패」다 · quiet §1)
     C  ★★ **건너뛸 수 있다** — 누르면 바로 6시로. 그래도 하루는 **한 번만** 간다
     D  ★ 검사용 문 — `?fast=1` · `window.__byeotSkipDayAnim`
     E  ★★★ **셈이 안 바뀌었다** — 연출을 켠 날과 끈 날의 **지갑 변화가 같다**
        ⚠ 액수를 이 파일에 안 적는다(START-HERE §2.8 의 사고가 그 반대다). 두 길을
          같은 판에서 재서 **서로** 맞는지만 본다
     F  ★ 밥상 팝업과의 순서 — 고르고 → 시간이 흐르고 → 6시에 정산
     G  ★ 문지기는 그대로 — 시루를 안 놓으면 하루가 안 간다 · `#next` 는 안 잠긴다

   ⚠ 폰 폭 390px. ⚠ `localStorage.clear()` 는 **goto 뒤에**.
============================================================ */
import { launch, sleep } from './test_cdp.mjs';

const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const DAWN = 6 / 24;                    // 0.25 — game.html §DAWN_T01 과 같은 뜻

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
    errs.push((m.params.exceptionDetails.exception || {}).description || m.params.exceptionDetails.text);
});
await page.goto(`${BASE}/game.html`);
await page.eval(`localStorage.clear()`, false);          // ⚠ goto 뒤에
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 180000, 300);
await page.waitFor('window.__byeotBooted === true', 180000, 300);
await sleep(6000);

async function walk() {
  for (let i = 0; i < 80; i++) {
    const busy = await page.eval(`(()=>{const s=document.getElementById('stage'),
      g=document.getElementById('guide');
      return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`);
    if (!busy) return;
    await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s) s.click();
      const b=document.getElementById('dlgBox'); if(b) b.click();
      const g=document.getElementById('guideClose'); if(g) g.click();})()`, false);
    await sleep(260);
  }
}
await walk();

/* ⚠ 체력은 이 검사의 대상이 아니다 — 손이 모자라 못 눌러 FAIL 이 나면 거짓 실패다 */
const freeHands = () => page.eval(`(()=>{const S=window.__S(); if (S.stamina) S.stamina.usedToday = 0;})()`, false);
const redraw = async () => { await page.eval(`window.__redraw && window.__redraw()`, false); await sleep(300); };
const click = (id) => page.eval(`(()=>{const b=document.getElementById('${id}');
  if(!b||b.disabled) return false; b.click(); return true;})()`);
const on = (id) => page.eval(`(()=>{const e=document.getElementById('${id}');
  return !!(e && e.classList.contains('on'));})()`);
const snap = () => page.eval(`(()=>{const S=window.__S(), w=document.getElementById('resWhen');
  return { day:S.day, cash:S.tutorial?S.tutorial.cashWon:null,
           t01:+window.__rv.daylight.toFixed(5),
           when:(w&&w.textContent||'').trim(),
           anim:!!(document.getElementById('dayAnim')||{}).classList.contains('on') };})()`);
/* 6시에서 몇 분 벗어났나 — 평소 시계가 계속 흐르므로 **분**으로 잰다 */
const minsOff = (t01) => Math.round(Math.min(Math.abs(t01 - DAWN), 1 - Math.abs(t01 - DAWN)) * 24 * 60);

/* ★★ **하루가 갈리는 그 순간**의 시계를 페이지 안에서 잡는다.
   ⚠ 밖에서 재면 안 된다 — 평소 시계는 하루가 간 뒤에도 계속 흐르고(그게 설계다),
     CDP 왕복이 수백 ms 라 「6시 + 왕복시간」을 재게 된다. 실제로 그렇게 헛 FAIL 이 났다
     (06:04 = 왕복 1.6초). 그래서 `Day N` 글자가 바뀌는 그 순간을 붙잡아 적어 둔다. */
const armLanding = () => page.eval(`(()=>{ window.__landT01=null; window.__landWhen='';
  const el=document.getElementById('resDay');
  const mo=new MutationObserver(()=>{ if(window.__landT01!=null) return;
    window.__landT01=+window.__rv.daylight.toFixed(5);
    window.__landWhen=(document.getElementById('resWhen').textContent||'').trim();
    mo.disconnect(); });
  mo.observe(el,{childList:true,characterData:true,subtree:true}); })()`, false);
const landing = () => page.eval(`({t01:window.__landT01, when:window.__landWhen})`);

console.log('\n══ A. 하루의 경계는 새벽 6시다 ═══════════════════════════════');
{
  const s = await snap();
  ok('A-1 ★ 새 판의 첫 시계가 **06:00** 이다', minsOff(s.t01) <= 2 && /06:0\d/.test(s.when),
     `${s.when} (t01 ${s.t01})`);
}

/* 시루를 놓는다 — [다음 날]은 그 전에는 안 열린다(문지기는 그대로 살아 있다) */
console.log('\n══ G. 문지기는 그대로다 (먼저 확인한다) ══════════════════════');
{
  const d0 = (await snap()).day;
  await freeHands();
  await click('next');
  await sleep(1200);
  const s = await snap();
  ok('G-1 ★ 시루를 안 놓으면 하루가 안 간다', s.day === d0, `day ${d0} → ${s.day}`);
  ok('G-2 ★ 그때 연출도 안 돈다 (막힌 것은 막힌 것이다)', s.anim === false);
  ok('G-3 ★ `#next` 는 잠기지 않는다',
     await page.eval(`!document.getElementById('next').disabled &&
                      document.body.dataset.hardLock !== '1'`));
  await page.eval(`window.__errBox && window.__errBox.clear()`, false);
}

await page.eval(`(()=>{const S=window.__S(); S.shop.stock.siru=(S.shop.stock.siru||0)+1;
  S.shop.stock.bean_seed=(S.shop.stock.bean_seed||0)+6;})()`, false);
await redraw();
ok('(판) 시루를 방에 놓았다', await page.eval(`(()=>{ const rv=window.__rv,
    c=document.getElementById('roomCanvas').getBoundingClientRect();
  const sp=rv.screenPosOf('banjiha-dresser:1'); if(!sp) return false;
  window.__drag.begin('beansprout', document.getElementById('cropThumb').src,
                      {clientX:c.left+c.width*0.9, clientY:c.top+40});
  window.__drag.move({clientX:c.left+sp.x, clientY:c.top+sp.y}); window.__drag.end(); return true;})()`) === true);
await sleep(1200); await walk(); await freeHands(); await redraw();

console.log('\n══ B. 연출이 돈다 — 그리고 **말을 한다** ═════════════════════');
let animMs = null;
{
  const before = await snap();
  await freeHands();
  await armLanding();
  const t0 = Date.now();
  await click('next');
  /* 덮개가 뜰 때까지 (곳간이 비어 있어 밥상 창은 안 뜬다 — §F 에서 따로 본다) */
  let up = true;
  try { await page.waitFor(`document.getElementById('dayAnim').classList.contains('on')`, 5000, 20); }
  catch { up = false; }
  ok('B-1 ★★ 덮개가 뜬다 (탁 넘어가지 않는다)', up);

  /* ⚠ 덮개 클래스는 **첫 프레임 전에** 붙는다 — 바로 재면 시계가 아직 한 칸도 안 갔다.
     헤드리스는 10fps 남짓이라 두어 프레임을 기다려야 한다(그래서 한 번 헛 FAIL 이 났다). */
  await sleep(260);
  const mid = await page.eval(`(()=>{
    const box=document.getElementById('dayAnim');
    const nav=document.querySelector('#navbar button') || document.querySelector('#navbar .navbtn');
    const r = nav ? nav.getBoundingClientRect() : null;
    const hit = r ? document.elementFromPoint(Math.round(r.left+r.width/2), Math.round(r.top+r.height/2)) : null;
    const z = (id)=>{const e=document.getElementById(id); return e?Number(getComputedStyle(e).zIndex)||0:null;};
    return { text:(box.textContent||'').replace(/\\s+/g,' ').trim(),
             hitId: hit ? (hit.id || hit.className || hit.tagName) : null,
             zAnim: z('dayAnim'), zErr: z('errBox'), zPop: z('mealPanel'),
             day: window.__S().day, t01:+window.__rv.daylight.toFixed(5) };})()`);
  ok('B-2 ★★★ 화면이 **「넘어가는 중」이라고 말한다** (조용히 막지 않는다)',
     /넘어가는 중/.test(mid.text), mid.text);
  ok('B-3 ★ 어디로 가는지도 말한다 (「새벽 6시」)', /새벽 6시/.test(mid.text), mid.text);
  ok('B-4 ★ 건너뛰는 길을 말한다', /누르면/.test(mid.text), mid.text);
  ok('B-5 ★★ 연출 중에는 다른 것이 안 눌린다 (왼쪽 메뉴를 짚으면 덮개가 잡힌다)',
     mid.hitId === 'dayAnim', String(mid.hitId));
  ok('B-6 ★★ 오류 상자는 덮개보다 **위**다 (숨으면 조용한 실패가 된다)',
     mid.zErr > mid.zAnim, `errBox ${mid.zErr} > dayAnim ${mid.zAnim}`);
  ok('B-7 ★ 덮개는 고르개 팝업보다 **위**다', mid.zAnim > mid.zPop, `${mid.zAnim} > ${mid.zPop}`);
  ok('B-8 ★★ 아직 하루가 안 갔다 (정산은 6시에 한다)', mid.day === before.day,
     `day ${before.day} → ${mid.day}`);
  ok('B-9 ★★ 시계가 **움직였다** (멈춘 화면이 아니다)',
     Math.abs(mid.t01 - before.t01) > 0.002, `t01 ${before.t01} → ${mid.t01}`);

  await page.waitFor(`window.__S().day === ${before.day + 1}`, 12000, 20);
  animMs = Date.now() - t0;
  const after = await snap();
  ok('B-10 ★★ 하루가 갔다', after.day === before.day + 1, `day ${before.day} → ${after.day}`);
  const land = await landing();
  ok('B-11 ★★ 그리고 **정확히 6시에 선다** (날짜 글자가 바뀐 그 순간을 재서)',
     land.t01 != null && minsOff(land.t01) <= 1, `${land.when} (t01 ${land.t01})`);
  ok('B-12 ★ 덮개가 걷혔다 (안 걷히면 판이 잠긴다)', after.anim === false);
  /* ⚠ 위끝을 넉넉히 둔다 — 헤드리스는 10fps 남짓이라 마지막 프레임이 늦게 온다.
     아래끝은 「탁 넘어가지 않는다」를 지킨다. 실측 길이는 인계 문서에 적었다(≈900ms). */
  ok('B-13 ★ 1~2초 안이다 (매일 누르는 것이라 길면 벌이 된다)',
     animMs >= 350 && animMs <= 3000, `${animMs}ms (연출 상수 900ms + 하루 셈)`);
}

console.log('\n══ A(이어서). 여러 번 넘겨도 6시가 안 밀린다 ═════════════════');
{
  const offs = [];
  for (let i = 0; i < 4; i++) {
    await freeHands(); await walk();
    const d = (await snap()).day;
    await armLanding();
    await click('next');
    if (await on('mealPanel')) await click('mealGo');
    await page.waitFor(`window.__S().day === ${d + 1}`, 15000, 20);
    offs.push(minsOff((await landing()).t01));
  }
  ok('A-2 ★★★ 네 번을 더 넘겨도 매번 6시다 (예전에는 매번 밀렸다)',
     offs.every(m => m <= 1), `6시에서 벗어난 분 ${JSON.stringify(offs)}`);
}

console.log('\n══ C. 건너뛰기 — 연출 중에 누르면 바로 6시로 ════════════════');
{
  /* ★ 연출을 **6초로 늘려 놓고** 누른다. 0.9초짜리로 재면 「건너뛴 것」과 「그냥 끝난 것」이
     구별되지 않는다 — 실제로 한 번 그렇게 흔들렸다(2,787ms 로 FAIL). */
  await page.eval(`window.__byeotDayAnimMs = 6000`, false);
  await freeHands(); await walk();
  const before = await snap();
  await armLanding();
  await click('next');
  if (await on('mealPanel')) await click('mealGo');
  await page.waitFor(`document.getElementById('dayAnim').classList.contains('on')`, 5000, 20);
  await sleep(60);
  const t0 = Date.now();
  /* 덮개를 **손으로** 누른다 — 코드로 함수를 부르면 배선을 안 재는 셈이 된다 */
  await page.eval(`(()=>{const b=document.getElementById('dayAnim');
    const r=b.getBoundingClientRect();
    b.dispatchEvent(new PointerEvent('pointerdown', {bubbles:true, cancelable:true,
      clientX:Math.round(r.width/2), clientY:Math.round(r.height/2)}));})()`, false);
  let jumped = true;
  try { await page.waitFor(`window.__S().day === ${before.day + 1}`, 8000, 20); } catch { jumped = false; }
  const dt = Date.now() - t0;
  const after = await snap();
  ok('C-1 ★★ 덮개를 누르면 **바로** 넘어간다 (연출은 6초로 늘려 놨다)',
     jumped && dt <= 2000, `${dt}ms (안 건너뛰면 6,000ms 넘게 걸린다)`);
  { const l = await landing();
    ok('C-2 ★★ 건너뛰어도 **정확히** 6시에 선다',
       l.t01 != null && minsOff(l.t01) <= 1, `${l.when}`); }
  ok('C-3 ★ 덮개가 걷혔다', after.anim === false);
  await sleep(1200);
  ok('C-4 ★★ 하루는 **한 번만** 갔다 (건너뛰기가 하루를 두 번 넘기지 않는다)',
     (await snap()).day === before.day + 1, `day ${before.day} → ${(await snap()).day}`);
  await page.eval(`window.__byeotDayAnimMs = null`, false);
}

console.log('\n══ E. ★★★ 셈이 안 바뀌었다 — 연출을 켠 날과 끈 날이 같다 ════');
{
  /* ⚠ 지름길 하나 — 살림(식비·공과·월세)은 **첫 플레이가 끝나야** 돈다
     (tutorial.tutorialDay: `if (!firstPlayDone) return {skipped}`). 재려는 것이 그 살림이다.
     ⚠ 값은 한 톨도 안 건드린다. 이 검사에 **액수를 적지 않는다** — 두 길을 서로 대조한다. */
  await page.eval(`(()=>{ window.__S().firstPlay.completed = true; })()`, false);
  /* ⚠ 월세 날을 **비교 구간 밖으로** 민다. 목돈이 한쪽 짝에만 끼면 두 길을 비교하는 것이
     아니라 「월세가 나갔나」를 비교하게 된다 — 실제로 한 번 그렇게 헛통과했다.
     ★ 규칙(`ts.rules`)은 한 톨도 안 건드린다. 미는 것은 **이 판의 다음 청구일**뿐이다. */
  await page.eval(`(()=>{ const r=window.__S().tutorial.rent; r.nextDueDay += 100; })()`, false);
  await walk(); await redraw();
  const oneDay = async (skipAnim) => {
    await page.eval(`window.__byeotSkipDayAnim = ${skipAnim ? 'true' : 'false'}`, false);
    await freeHands(); await walk();
    const b = await snap();
    await armLanding();
    await click('next');
    await sleep(120);
    if (await on('mealPanel')) await click('mealGo');
    await page.waitFor(`window.__S().day === ${b.day + 1}`, 15000, 20);
    await walk();
    const a = await snap();
    return { d: b.cash - a.cash, day: a.day, off: minsOff((await landing()).t01) };
  };
  const A1 = await oneDay(false), S1 = await oneDay(true);
  const A2 = await oneDay(false), S2 = await oneDay(true);
  ok('E-1 ★★★ 연출을 켠 날과 끈 날의 **지갑 변화가 같다** (첫 짝)',
     A1.d === S1.d, `연출 ${A1.d}원 · 건너뜀 ${S1.d}원`);
  ok('E-2 ★★★ 둘째 짝도 같다', A2.d === S2.d, `연출 ${A2.d}원 · 건너뜀 ${S2.d}원`);
  ok('E-2b ★ 네 날이 다 같다 (하루 몫이 흔들리지 않는다)',
     A1.d === A2.d && A1.d === S2.d, `${A1.d} · ${S1.d} · ${A2.d} · ${S2.d}`);
  ok('E-3 ★ 하루에 나가는 돈이 0 이 아니다 (재는 자가 죽어 있지 않다)',
     A1.d > 0 && S1.d > 0, `${A1.d} · ${S1.d}`);
  ok('E-4 ★ 연출을 꺼도 6시에 선다', S1.off <= 1 && S2.off <= 1, `${S1.off}분 · ${S2.off}분`);
  await page.eval(`window.__byeetSkipDayAnim = undefined; window.__byeotSkipDayAnim = false`, false);
}

console.log('\n══ F. 밥상 팝업과의 순서 — 고르고 → 흐르고 → 6시에 정산 ═════');
{
  /* 곳간을 채운다 — 밥상 창은 곳간이 비면 아예 안 뜬다(그건 옳은 설계다) */
  await page.eval(`(()=>{ const f=window.__S().firstPlay.food;
    f.pantryWon = 8000;
    f.pantryLots = [{ kind:'beansprout', kindKo:'콩나물', won:8000, g:800, day:window.__S().day }];
  })()`, false);
  await walk(); await redraw(); await freeHands();
  const b = await snap();
  await armLanding();
  await click('next');
  await sleep(500);
  const s1 = await snap();
  ok('F-1 ★ 첫 누름은 **밥상 창**이다 — 연출은 아직 안 돈다',
     (await on('mealPanel')) && s1.anim === false && s1.day === b.day, JSON.stringify(s1));

  /* ① [그만두기] — 시간도 안 흐르고 하루도 안 간다 */
  await click('mealCancel');
  await sleep(500);
  const s2 = await snap();
  ok('F-2 ★★ [그만두기]는 **하루도 시간도** 안 옮긴다',
     s2.day === b.day && s2.anim === false && !(await on('mealPanel')), JSON.stringify(s2));

  /* ② [이대로 다음 날 ▸] — 그제서야 시간이 흐르고 6시에 정산 */
  await freeHands();
  await click('next'); await sleep(400);
  ok('F-3 밥상 창이 다시 열린다', await on('mealPanel'));
  await click('mealGo');
  let up = true;
  try { await page.waitFor(`document.getElementById('dayAnim').classList.contains('on')`, 5000, 20); }
  catch { up = false; }
  ok('F-4 ★★ [이대로 다음 날 ▸] 를 누르면 **그때** 시간이 흐른다', up);
  ok('F-5 ★ 그때 밥상 창은 이미 닫혀 있다 (창 둘이 겹치지 않는다)', !(await on('mealPanel')));
  await page.waitFor(`window.__S().day === ${b.day + 1}`, 15000, 20);
  const s3 = await snap(); const l3 = await landing();
  ok('F-6 ★★ 흐른 뒤 6시에 하루가 간다',
     s3.day === b.day + 1 && l3.t01 != null && minsOff(l3.t01) <= 1,
     `day ${s3.day} · ${l3.when}`);
  ok('F-7 ★ 곳간이 줄었다 — 정산이 실제로 일어났다',
     await page.eval(`window.__S().firstPlay.food.pantryWon < 8000`),
     String(await page.eval(`window.__S().firstPlay.food.pantryWon`)));
}

console.log('\n══ W. 세 폭 — 360 · 390 · 430 ═══════════════════════════════');
{
  /* ★ 연출을 6초로 늘려 두고 세 폭에서 덮개를 잰다. 안 늘리면 재기 전에 끝난다. */
  await page.eval(`window.__byeotDayAnimMs = 6000`, false);
  for (const w of [360, 390, 430]) {
    await page.send('Emulation.setDeviceMetricsOverride',
      { width: w, height: 844, deviceScaleFactor: 2, mobile: false });
    await sleep(600);
    await walk(); await freeHands(); await redraw();
    const d = (await snap()).day;
    await click('next');
    if (await on('mealPanel')) await click('mealGo');
    let up = true;
    try { await page.waitFor(`document.getElementById('dayAnim').classList.contains('on')`, 6000, 20); }
    catch { up = false; }
    const box = await page.eval(`(()=>{const b=document.getElementById('dayAnim'),
        n=b.querySelector('.danote'); const r=n.getBoundingClientRect();
      return { x:Math.round(r.x), y:Math.round(r.y), w:Math.round(r.width), h:Math.round(r.height),
               vw:innerWidth, vh:innerHeight,
               overflow: document.documentElement.scrollWidth > innerWidth };})()`);
    ok(`W-${w} ★ 덮개가 뜨고 글상자가 **화면 안**이다`,
       up && box.x >= 0 && box.x + box.w <= box.vw && box.y >= 0 && box.y + box.h <= box.vh,
       JSON.stringify(box));
    ok(`W-${w} ★ 가로로 안 넘친다`, box.overflow === false);
    await page.eval(`(()=>{const b=document.getElementById('dayAnim');
      b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true}));})()`, false);
    await page.waitFor(`window.__S().day === ${d + 1}`, 9000, 20);
    await walk();
  }
  await page.eval(`window.__byeotDayAnimMs = null`, false);
  await page.send('Emulation.setDeviceMetricsOverride',
    { width: 390, height: 844, deviceScaleFactor: 2, mobile: false });
  await sleep(400);
}

console.log('\n══ D. 검사용 문 — `?fast=1` ═════════════════════════════════');
{
  const p2 = await launch({ width: 390, height: 844, dpr: 2, mobile: false });
  await p2.goto(`${BASE}/game.html?fast=1`);
  await p2.eval(`localStorage.clear()`, false);
  await p2.goto(`${BASE}/game.html?fast=1`);
  await p2.waitFor('!!window.__rv', 180000, 300);
  await p2.waitFor('window.__byeotBooted === true', 180000, 300);
  await sleep(5000);
  for (let i = 0; i < 40; i++) {
    const busy = await p2.eval(`(()=>{const s=document.getElementById('stage'),
      g=document.getElementById('guide');
      return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`);
    if (!busy) break;
    await p2.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s) s.click();
      const b=document.getElementById('dlgBox'); if(b) b.click();
      const g=document.getElementById('guideClose'); if(g) g.click();})()`, false);
    await sleep(260);
  }
  await p2.eval(`(()=>{const S=window.__S(); S.shop.stock.siru=(S.shop.stock.siru||0)+1;
    S.shop.stock.bean_seed=(S.shop.stock.bean_seed||0)+4;})()`, false);
  await p2.eval(`window.__redraw && window.__redraw()`, false); await sleep(400);
  await p2.eval(`(()=>{ const rv=window.__rv,
      c=document.getElementById('roomCanvas').getBoundingClientRect();
    const sp=rv.screenPosOf('banjiha-dresser:1'); if(!sp) return false;
    window.__drag.begin('beansprout', document.getElementById('cropThumb').src,
                        {clientX:c.left+c.width*0.9, clientY:c.top+40});
    window.__drag.move({clientX:c.left+sp.x, clientY:c.top+sp.y}); window.__drag.end(); return true;})()`);
  await sleep(1400);
  await p2.eval(`(()=>{const S=window.__S(); if (S.stamina) S.stamina.usedToday = 0;})()`, false);
  const d0 = await p2.eval(`window.__S().day`);
  /* ★★ 시간으로 재지 않는다 — 기계가 바쁘면 왕복만 1초가 넘는다(실제로 그렇게 헛 FAIL 이 났다).
     대신 **누른 그 함수가 끝나기 전에 하루가 갔는가**를 본다. 연출이 도는 길이면
     누름은 곧장 돌아오고 하루는 나중에 간다 — 시계를 안 쓰고도 두 길이 갈린다. */
  const sync = await p2.eval(`(()=>{ const d = window.__S().day;
    document.getElementById('next').click();
    return { went: window.__S().day === d + 1,
             anim: document.getElementById('dayAnim').classList.contains('on') }; })()`);
  const sawAnim = await p2.eval(`document.getElementById('dayAnim').classList.contains('on')`);
  ok('D-1 ★★ `?fast=1` 이면 덮개가 **안 뜬다**', sawAnim === false && sync.anim === false);
  ok('D-2 ★★ 그래도 하루는 간다', sync.went,
     `day ${d0} → ${await p2.eval(`window.__S().day`)}`);
  ok('D-3 ★★★ 누른 **그 자리에서** 간다 — 기다림이 0 이다 (검사가 하루를 수백 번 넘긴다)',
     sync.went === true);
  const t01 = await p2.eval(`+window.__rv.daylight.toFixed(5)`);
  ok('D-4 ★ 연출을 꺼도 6시에 선다', minsOff(t01) <= 2, `t01 ${t01}`);
  await p2.close();
}

console.log(`\n(부팅·플레이 중 예외 ${errs.length}건)`);
if (errs.length) console.log('  ' + errs.slice(0, 4).join('\n  '));
ok('H-1 ★ 예외가 없다', errs.length === 0, `${errs.length}건`);

console.log(`\n${bad ? '⛔' : '★'} ${seen - bad}/${seen} 통과`);
await page.close();
process.exit(bad ? 1 : 0);
