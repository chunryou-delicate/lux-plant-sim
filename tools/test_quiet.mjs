/* ============================================================
   tools/test_quiet.mjs — **일이 났는데 화면이 말 안 하던 것들** (2026-08-15 신설)
   ------------------------------------------------------------
     python tools/serve.py 8963
     BYEOT_URL=http://localhost:8963 node tools/test_quiet.mjs

   이 저장소의 지병이 「조용한 실패」다. 점검(`guideaudit-to-plan.md`)이 셋을 찾았고
   이 검사가 그 셋을 못 박는다. **셋 다 화면에서 실제로 재서** 만들었다 — 고치기 전
   판(`git show HEAD:game.html`)을 따로 띄워 「전에는 이랬다」까지 눈으로 봤다.

   ══ 무엇을 보나 ═══════════════════════════════════════════════════════════
     A  ★ 배송이 도착한 날 **배너가 뜬다** (전에는 기록 한 줄뿐이었다)
     B  ★ 오는 중이면 [가방] 단추에 **점**이 찍히고, 도착하면 점이 사라진다
     C  ★★ 걷는 동안 **말풍선 글자가 바뀐다** — `💧 물 주기` → `🚶 가는 중…` → `💧 물 주는 중`
        (전에는 3초 내내 안 바뀌어서 「안 눌렸나」가 됐다)
     D  ★ 끝나면 글자가 **제자리로 돌아온다** — 안 돌아오면 반대 방향의 거짓말이 된다
     E  ★★ 걷는 중에 다른 것을 눌러도 **「가지는 못했습니다」가 안 뜬다**
        (일은 다 되는데 화면만 못했다고 말하던 자리다. **막는 것이 아니라** 안 헷갈리게 한다)
     F  ★★ 잉여가 생긴 날 **배너가 뜨고**, 그 값이 코어 값과 **맞는다**
     G  ★ 수확 기록이 **파는 길**을 말한다 — `[상점]에서 넘길 수 있습니다`
     H  ★ 잉여가 남아 있으면 [상점] 단추에 **점**이 찍힌다
     I  ★ 화면에 **별표가 그대로 안 뜬다** (`**날을 달리해**` → `<b>`)
     J  ★★ **못 놓는 자리에 떨구면 말한다** — 그런데 방 **밖**에 떨구는 것(물리기)은 조용하다
        (2026-08-11 에 「끌어 놓기 실패가 말을 하게」 고쳤다는데, `placeFailed` 를 타는
         길만 고쳐졌고 제일 흔한 「벽에 떨구기」는 `drag.end` 에서 조용히 끝났다)

   ⚠ **숫자를 이 파일에 안 박는다.** 잉여 값·판매가는 전부 `window.__S()` 와
     화면이 낸 값을 서로 대조한다 — START-HERE §2.8 의 사고가 그 반대다.
   ⚠ 폰 폭 390px 로 잰다.
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
await page.eval(`localStorage.clear()`, false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 180000, 300);
await page.waitFor('window.__byeotBooted === true', 180000, 300);
await sleep(4500);

/* 대사는 **실제로 걷는다.** 클래스를 손으로 떼면 그 뒤 상태가 어긋난다 */
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
await walk();

const evText = () => page.eval(`(()=>{const e=document.getElementById('event');
  return e && e.classList.contains('on') ? (e.textContent||'').replace(/\\s+/g,' ').trim() : '';})()`);
const logText = () => page.eval(`(()=>[...document.querySelectorAll('#log .li')]
  .map(d=>(d.textContent||'').replace(/\\s+/g,' ').trim()).join('\\n'))()`);
const logHTML = () => page.eval(`(()=>[...document.querySelectorAll('#log .li')]
  .map(d=>d.innerHTML).join('\\n'))()`);
const dot = (id) => page.eval(`(()=>{const b=document.getElementById('${id}');
  return b ? { on: b.dataset.dot === '1', title: b.title || '' } : null;})()`);
const marks = () => page.eval(`(()=>[...document.querySelectorAll('#marks .mark')]
  .map(m=>({ko:((m.querySelector('span')||{}).textContent||''),
            acting:m.classList.contains('acting')})))()`);
const place = (slot) => page.eval(`(()=>{ const rv=window.__rv,
    c=document.getElementById('roomCanvas').getBoundingClientRect();
  const sp=rv.screenPosOf('${slot}'); if(!sp) return false;
  window.__drag.begin('beansprout', document.getElementById('cropThumb').src,
                      {clientX:c.left+c.width*0.9, clientY:c.top+40});
  window.__drag.move({clientX:c.left+sp.x, clientY:c.top+sp.y}); window.__drag.end(); return true;})()`);
const siruBtn = (act, i = 0) => page.eval(`(()=>{const b=[...document.querySelectorAll(
  '#siruList button[data-act="${act}"]')]; if(!b[${i}]) return false; b[${i}].click(); return true;})()`);
/* ⚠ 체력은 이 검사의 대상이 아니다 — 손이 모자라 못 눌러 FAIL 이 나면 그건 거짓 실패다 */
const freeHands = () => page.eval(`(()=>{const S=window.__S();
  if (S.stamina) S.stamina.usedToday = 0;})()`, false);
const redraw = async () => { await page.eval(`window.__redraw && window.__redraw()`, false); await sleep(350); };
const nextDay = async () => { await freeHands();
  await page.eval(`document.getElementById('next').click()`, false); await sleep(1800); await walk(); };
const openTab = async (t) => { await page.eval(`window.__byeotSheet.open('${t}')`, false); await sleep(450); };
const fp = () => page.eval(`(()=>{const S=window.__S(); return {
  surplus: S.firstPlay.food.surplusWon, pantry: S.firstPlay.food.pantryWon,
  placed: S.firstPlay.beansprout.pots.filter(p=>p.slotId||p.at).length };})()`);

/* ══ J. 못 놓는 자리에 떨궜을 때 ═════════════════════════════════════ */
console.log('\n== J. ★★ 못 놓는 자리에 떨구면 말하나 · 물리면 조용한가 ==');
{
  const clearEv = () => page.eval(`(()=>{const e=document.getElementById('event');
    if(e) e.classList.remove('on');})()`, false);
  await clearEv();
  /* ① 방 안이되 못 놓는 곳(벽·허공) — 진짜로 놓으려 한 것이다. 말해야 한다 */
  await page.eval(`(()=>{const c=document.getElementById('roomCanvas').getBoundingClientRect();
    window.__drag.begin('beansprout', document.getElementById('cropThumb').src,
                        {clientX:c.left+c.width*0.9, clientY:c.top+40});
    window.__drag.move({clientX:c.left+c.width*0.5, clientY:c.top+40}); window.__drag.end();})()`, false);
  await sleep(800);
  const t1 = await evText();
  ok('★★ 못 놓는 자리에 떨구면 배너가 뜬다', /못 놓았습니다/.test(t1), t1 || '(조용)');
  ok('  왜 못 놓았는지도 말한다(끄는 동안 라벨과 같은 말)',
     /못 놓았습니다.+\S/.test(t1), t1);
  await clearEv();
  /* ② 방 밖(화면 구석)에 떨구기 = 물리기. 여기까지 말하면 잔소리가 된다 */
  await page.eval(`(()=>{window.__drag.begin('beansprout', document.getElementById('cropThumb').src,
      {clientX:300, clientY:700});
    window.__drag.move({clientX:5, clientY:5}); window.__drag.end();})()`, false);
  await sleep(800);
  const t2 = await evText();
  ok('★ 방 밖에 떨구는 것(물리기)은 조용하다', t2 === '', t2 || '(조용)');
}

/* ── 판 세우기 — 시루 셋을 방에 놓는다 ───────────────────────────────── */
await page.eval(`(()=>{const S=window.__S(); S.shop.stock.siru=(S.shop.stock.siru||0)+3;
  S.shop.stock.bean_seed=(S.shop.stock.bean_seed||0)+8;})()`, false);
await redraw();
for (const s of ['banjiha-dresser:1', 'banjiha-dresser:0', 'banjiha-desk:1']) {
  await place(s); await sleep(900); await walk();
}
console.log(`\n(판) 방에 선 시루 ${(await fp()).placed}개`);

/* ══ C·D. 걷는 동안 말풍선이 대답하나 ═════════════════════════════════ */
console.log('\n== C·D. ★★ 누른 뒤 3초 — 말풍선 글자가 바뀌나 ==');
{
  const before = await marks();
  ok('누르기 전 말풍선이 있다', before.length > 0, JSON.stringify(before.map(m => m.ko)));
  await page.eval(`(()=>{const m=document.querySelector('#marks .mark'); m&&m.click();})()`, false);
  const seenKo = new Set();
  for (let i = 0; i < 16; i++) {
    await sleep(450);
    for (const m of await marks()) if (m.acting) seenKo.add(m.ko);
    if (!(await marks()).some(m => m.acting)) break;
  }
  const list = [...seenKo];
  ok('★ 걷는 동안 「가는 중」이라 말한다', list.some(k => /가는 중/.test(k)), list.join(' → '));
  ok('★ 원래 글(「물 주기」)에 머물지 않는다',
     list.length > 0 && !list.every(k => /물 주기$/.test(k)), list.join(' → '));
  await walk();
  const after = await marks();
  ok('★ 끝난 뒤 「…중」이 남아 있지 않다',
     after.every(m => !/중…?$/.test(m.ko) && !m.acting),
     JSON.stringify(after.map(m => m.ko)));
}

/* ══ E. 걷는 중에 다른 것을 눌렀을 때 ═════════════════════════════════ */
console.log('\n== E. ★★ 겹쳐 눌러도 「가지는 못했습니다」가 안 뜬다 ==');
{
  await freeHands(); await redraw();
  const ms = await marks();
  if (ms.length < 2) ok('말풍선이 둘 이상 있다(겹쳐 누를 판)', false, `${ms.length}개`);
  else {
    await page.eval(`(()=>{const m=[...document.querySelectorAll('#marks .mark')]; m[0].click();})()`, false);
    await sleep(650);
    await freeHands();
    await page.eval(`(()=>{const m=[...document.querySelectorAll('#marks .mark')];
      (m[1]||m[0]).click();})()`, false);
    let wrong = '';
    for (let i = 0; i < 14; i++) {
      await sleep(500);
      const t = await evText();
      if (/가지는 못했습니다/.test(t)) { wrong = t; break; }
    }
    ok('★★ 「가지는 못했습니다 … 자리를 옮겨 보세요」가 안 뜬다', wrong === '', wrong);
    await walk();
    /* 일이 실제로 됐나 — 연출을 고친 것이지 규칙을 막은 것이 아니다 */
    const watered = await page.eval(`(()=>{const S=window.__S();
      return S.firstPlay.beansprout.pots.filter(p=>p.ageDays!=null).length;})()`);
    ok('★ 그래도 물은 다 들어갔다 (막은 것이 아니다)', watered >= 2, `${watered}개`);
  }
}

/* ══ A·B. 배송 ═══════════════════════════════════════════════════════ */
console.log('\n== A·B. ★ 배송이 도착한 날 화면이 말하나 ==');
{
  await openTab('shop');
  await page.eval(`(()=>{const b=document.querySelector('[data-buy="bean_seed"]');
    b.click(); b.click();})()`, false);
  await sleep(700);
  const d1 = await dot('openBag');
  ok('★ 오는 중이면 [가방] 단추에 점이 찍힌다', !!(d1 && d1.on), d1 && d1.title);
  ok('  그 점이 **언제 오는지**를 말한다(title)', !!(d1 && /오는 중/.test(d1.title)), d1 && d1.title);
  await page.eval(`window.__byeotSheet.close()`, false); await sleep(300);
  await nextDay();
  const ev = await evText();
  ok('★★ 도착한 날 배너가 뜬다', /왔습니다/.test(ev), ev);
  ok('  무엇이 왔는지 이름을 말한다', /씨앗/.test(ev), ev);
  ok('  어디로 갔는지 말한다([가방])', /가방/.test(ev), ev);
  ok('  기록칸의 📦 줄은 그대로 남는다', /📦/.test(await logText()));
  const d2 = await dot('openBag');
  ok('★ 도착하면 [가방] 점이 사라진다', !(d2 && d2.on), d2 && String(d2.on));
}

/* ══ F·G·H·I. 잉여 ═══════════════════════════════════════════════════ */
console.log('\n== F·G·H·I. ★★ 잉여가 생긴 날 화면이 말하나 ==');
{
  /* 같은 날 물을 몰아 준 시루들이 같은 날 익는다 = 겹침 벌 */
  await openTab('plants');
  for (let i = 0; i < 4; i++) {
    await freeHands(); await redraw();
    if (!await siruBtn('water', 0)) break;
    await sleep(4300); await walk();
  }
  for (let d = 0; d < 6; d++) await nextDay();
  await openTab('plants'); await redraw();

  let surplusEv = '', firstEv = '';
  let coreSurplus = 0;
  for (let i = 0; i < 4; i++) {
    await freeHands(); await redraw();
    if (!await siruBtn('harvest', 0)) break;
    await sleep(4500); await walk();
    const t = await evText();
    if (!firstEv) firstEv = t;
    if (/못 받은 몫/.test(t)) { surplusEv = t; coreSurplus = (await fp()).surplus; }
  }
  ok('★★ 잉여가 생긴 날 배너가 뜬다', surplusEv !== '', surplusEv);
  if (surplusEv) {
    /* ⚠ 숫자를 여기서 짓지 않는다 — 코어가 든 잉여 누계가 배너 문장 안에 있어야 한다 */
    const won = coreSurplus.toLocaleString();
    ok('★ 배너의 값이 코어의 잉여 누계와 같다',
       surplusEv.includes(won), `배너「${surplusEv}」 vs 코어 ${won}원`);
    ok('★ 「[상점]」으로 가는 길을 말한다', /\[상점\]/.test(surplusEv), surplusEv);
    ok('  거둔 배너와 **같이** 뜬다(배너를 새로 안 부른다)',
       /거뒀습니다/.test(surplusEv) && /못 받은 몫/.test(surplusEv), surplusEv);
  }
  const lg = await logText();
  ok('★ 수확 기록이 파는 길을 말한다',
     /못 받은 몫은 \[상점\]에서 넘길 수 있습니다/.test(lg),
     (lg.split('\n').find(l => /못 받았습니다/.test(l)) || '(그 줄 없음)').slice(0, 120));
  const html = await logHTML();
  ok('★ 화면에 별표가 그대로 안 뜬다(굵게로 풀린다)',
     !/\*\*/.test(lg) && /<b>날을 달리해<\/b>/.test(html));
  const d3 = await dot('navShop');
  ok('★ 잉여가 남아 있으면 [상점] 단추에 점이 찍힌다', !!(d3 && d3.on), d3 && d3.title);
  const cur = (await fp()).surplus;
  ok('  그 점이 얼마인지 말한다(title)',
     !!(d3 && d3.title.includes(cur.toLocaleString())), d3 && d3.title);

  /* 넘기면 점이 사라진다 — 「할 일이 남았다」의 뜻이 지켜지나 */
  await openTab('shop');
  await page.eval(`(()=>{const b=document.getElementById('sellSurplus');
    if(b && getComputedStyle(b).display!=='none') b.click();})()`, false);
  await sleep(900);
  const d4 = await dot('navShop');
  ok('★ 넘기고 나면 [상점] 점이 사라진다', !(d4 && d4.on), d4 && String(d4.on));
}

console.log('\n== 예외 ==');
ok('★ 한 바퀴 도는 동안 예외 0', errs.length === 0, errs.slice(0, 3).join(' / '));

await page.close();
console.log(`\n${bad ? '✗' : '✓'} ${seen - bad}/${seen} 통과`);
process.exit(bad ? 1 : 0);
