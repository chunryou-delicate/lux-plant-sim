/* ============================================================
   tools/test_monthly.mjs — **월세 낸 날 한 달 가계부가 뜬다** (2026-08-18 신설)
   ------------------------------------------------------------
     python tools/serve.py 8963
     BYEOT_URL=http://localhost:8963 node tools/test_monthly.mjs

   박사님: *"월세 나가는 날에 **월 장부 정리**가 팝업으로 뜨도록 (…) **가계부처럼**"*

   ══ 무엇을 못 박나 ═══════════════════════════════════════════════════════
     A  ★ **월초 스냅샷이 부팅 때 열린다** — 하루가 가기 전에 열려 있어야 첫날이 안 샌다
     B  ★★ **월세 낸 날 팝업이 뜬다** — 주문·팔기 팝업과 **같은 틀**(`.pop`/`.popcard` · z 84) ·
        `#sheet` **밖** · 카드가 화면 안
     C  ★★★ **한 줄 요약이 지갑 증감과 맞는다** — 화면이 적은 수 = `S.tutorial.cashWon` 변화
     D  ★★ **월세 줄이 규칙값과 맞는다**(`ts.rules.rentWon`) · 다른 줄도 코어 누적값과 맞는다
     E  ★★★ **대차가 맞는다** — 들어온 것 − 나간 것 = 지갑 증감. 안 맞으면 그 몫을
        「장부에 안 잡힌 것」으로 **적고 있어야** 한다(감추면 가계부가 아니다)
     F  ★★ **닫는 길 셋**([알겠습니다]·뒤 누르기·Esc)이 열려 있고 **닫아도 하루는 그대로**다
     G  ★★ **대사와 안 겹친다** — 뜨는 순간 `#stage.talking` 이 아니다
     H  ★★ **둘째 달은 지난달과 견준다**(첫 달은 견줄 것이 없다고 말한다)
     I  ★ **360·390·430** 단추 44px 이상 · 카드가 화면 안

   ⚠ **숫자를 이 파일에 안 박는다.** 월세도 지갑도 `window.__S()` 에서 읽어 화면 글자와
     대조한다 — START-HERE §2.8 의 사고가 그 반대다.
   ★★ **지름길을 둘 썼고 둘 다 여기 적는다.** 월세는 **살림 1일차**에 처음 나가는데,
     살림 시계는 첫 플레이(16일)가 끝나야 돈다(`tutorialDay` 첫 줄) — 첫 플레이를 실제로
     완주하려면 콩나물 3회전을 밟아야 해서 이 검사가 재려는 것(가계부)과 상관없이 길다.
       ㉮ `S.firstPlay.completed = true` 로 **살림 시계를 켠다**
       ㉯ 둘째 달을 보려고 `S.tutorial.rent.nextDueDay` 를 **하루 앞으로** 당긴다
          (30일을 다시 밟는 대신. 주기 자체는 안 건드린다)
     ⚠ **값·규칙은 한 자리도 안 건드렸다.** 심기·물주기·거두기·[다음 날]은 전부 화면 단추다.
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

/* 다시 부팅한다. ⚠ `clear` 를 안 주면 **localStorage 를 안 지운다**(§M 이 그것으로 잰다) */
async function boot(clear) {
  await page.goto(`${BASE}/game.html`);
  if (clear) { await page.eval(`localStorage.clear()`, false); await page.goto(`${BASE}/game.html`); }
  await page.waitFor('!!window.__rv', 180000, 300);
  await page.waitFor('window.__byeotBooted === true', 180000, 300);
  await sleep(7000);
  await walk();
}

const click = (id) => page.eval(`(()=>{const b=document.getElementById('${id}');
  if(!b) return false; b.click(); return true;})()`);
const txt = (sel) => page.eval(`(()=>{const e=document.querySelector('${sel}');
  return e ? (e.textContent||'').replace(/\\s+/g,' ').trim() : '';})()`);
const openTab = async (t) => { await page.eval(`window.__byeotSheet.open('${t}')`, false); await sleep(450); };
const on = (id) => page.eval(`(()=>{const e=document.getElementById('${id}');
  return !!(e && e.classList.contains('on'));})()`);
const nums = (s) => (String(s).match(/[\d,]*\d/g) || []).map(v => +v.replace(/,/g, ''));
const freeHands = () => page.eval(`(()=>{const S=window.__S();
  if (S.stamina) S.stamina.usedToday = 0;})()`, false);
const redraw = async () => { await page.eval(`window.__redraw && window.__redraw()`, false); await sleep(350); };
const siruBtn = (act, i = 0) => page.eval(`(()=>{const b=[...document.querySelectorAll(
  '#siruList button[data-act="${act}"]')]; if(!b[${i}]) return false; b[${i}].click(); return true;})()`);
const place = (slot) => page.eval(`(()=>{ const rv=window.__rv,
    c=document.getElementById('roomCanvas').getBoundingClientRect();
  const sp=rv.screenPosOf('${slot}'); if(!sp) return false;
  window.__drag.begin('beansprout', document.getElementById('cropThumb').src,
                      {clientX:c.left+c.width*0.9, clientY:c.top+40});
  window.__drag.move({clientX:c.left+sp.x, clientY:c.top+sp.y}); window.__drag.end(); return true;})()`);
/* 코어가 낸 값 — 화면 글자와 대조할 정본 */
const core = () => page.eval(`(()=>{const S=window.__S(), ts=S.tutorial||{};
  return { day: S.day, tday: ts.day, cash: ts.cashWon,
           rentWon: (ts.rules||{}).rentWon, period: (ts.rules||{}).rentPeriodDays,
           paid: (ts.rent||{}).paidCount, due: (ts.rent||{}).nextDueDay,
           shopSpent: (S.shop||{}).spentWon, shopEarned: (S.shop||{}).earnedWon,
           foodSaved: ((S.firstPlay||{}).food||{}).totalFoodSavedWon,
           talking: document.getElementById('stage').classList.contains('talking') };})()`);
const store = () => page.eval(`(()=>{try{return JSON.parse(localStorage.getItem('byeot.month'));}
  catch(e){return null;}})()`);
const nextDay = async () => {
  await freeHands();
  await click('next'); await sleep(1300);
  if (await on('mealPanel')) { await click('mealGo'); await sleep(1200); }
  await sleep(1800);                       // 넘어가는 연출 + 정산
};

/* ══ A. 월초 스냅샷이 부팅 때 열려 있다 ═══════════════════════════════ */
console.log('\n== A. ★ 부팅하면 월초 스냅샷이 이미 열려 있다 ==');
{
  const m = await store();
  ok('★ `byeot.month` 가 있다 (하루가 가기 전에 열려 있어야 첫날이 안 샌다)', !!m);
  ok('  월초 지갑을 찍어 두었다', !!(m && m.cur && m.cur.snap && m.cur.snap.cash > 0),
     m && String(m.cur.snap.cash));
  ok('  아직 아무것도 안 셌다', !!(m && m.cur && m.cur.run && m.cur.run.days === 0));
  ok('★ **판 도장(runId)**이 찍혀 있다 (판이 바뀐 것을 이걸로 가른다)',
     !!(m && typeof m.runId === 'string' && m.runId.length > 4), m && m.runId);
  ok('  쌓인 장부는 아직 없다', !!(m && Array.isArray(m.log) && m.log.length === 0));

  /* ★ [가방] 탭의 [가계부 다시 보기] — 아직 쌓인 것이 없다 */
  await openTab('bag');
  const b0 = await page.eval(`(()=>{const b=document.getElementById('ledgerBack');
    return b ? {t:(b.textContent||'').trim(), dis:b.disabled,
                hint:(document.getElementById('ledgerBackHint').textContent||'').trim(),
                h:Math.round(b.getBoundingClientRect().height)} : null;})()`);
  ok('★★ [가방] 탭에 **[가계부 다시 보기]** 단추가 있다', !!b0, b0 && b0.t);
  ok('★ 쌓인 것이 없으면 **감추지 않고 회색**이다 (감추면 그런 길이 있다를 못 배운다)',
     b0.dis === true);
  ok('★★ 그리고 **왜 회색인지**를 바로 밑에 적는다 (§조용한 실패)',
     /월세/.test(b0.hint), b0.hint);
  ok('  단추가 44px 이상이다', b0.h >= 44, `${b0.h}px`);
  await page.eval(`window.__byeotSheet.close()`, false); await sleep(300);
}

/* ── 판 세우기: 시루 하나를 놓고 심고 물 주고 거둔다 (화면 단추로) ──────── */
await page.eval(`(()=>{const S=window.__S(); S.shop.stock.siru=(S.shop.stock.siru||0)+1;
  S.shop.stock.bean_seed=(S.shop.stock.bean_seed||0)+3;})()`, false);
await redraw();
const siruState = () => page.eval(`(()=>[...document.querySelectorAll('#siruList .sirurow')]
  .map(r=>(r.textContent||'').replace(/\\s+/g,' ').trim()).join(' | ')
  || [...document.querySelectorAll('#siruList button[data-act]')]
       .map(b=>b.dataset.act).join(',') || '(빈 목록)')()`);
await place('banjiha-dresser:1'); await sleep(900); await walk();
await freeHands();
await redraw();
/* ⚠ 한 번에 안 먹힐 수 있다 — 물주기는 **걸어가서** 준다(quiet §1 「걷는 중」).
   그래서 단추가 사라질 때까지 다시 누른다. 지름길이 아니라 **기다리는 것**이다. */
const act = async (name, tries = 6) => {
  for (let i = 0; i < tries; i++) {
    if (!(await siruBtn(name, 0))) return i > 0;
    await sleep(1300); await walk(); await freeHands(); await redraw();
  }
  return true;
};
await act('plant');
await act('water');
console.log('      시루 :', await siruState());
/* 익을 때까지 하루씩 — 익으면 그날 거둔다. 「거둔 것」 g 은 이 길로만 쌓인다(수확은 턴 밖) */
let harvested = 0;
for (let d = 0; d < 9; d++) {
  await nextDay(); await walk();
  await freeHands();
  while (await siruBtn('harvest', 0)) {
    harvested++; await sleep(1300); await walk(); await freeHands(); await redraw();
  }
  if (harvested) break;
}
console.log('      거둔 횟수 :', harvested, '· 시루 :', await siruState());
await nextDay(); await walk();               // 거둔 것을 하루 먹인다

const gotG = await page.eval(`(()=>{const m=JSON.parse(localStorage.getItem('byeot.month'));
  return m ? JSON.stringify({got:m.cur.run.gotG, ate:m.cur.run.ateG}) : 'none';})()`);
ok('★ 거둔 것·먹은 것이 g 으로 쌓인다 (살림 시계가 돌기 전에도)',
   /"[가-힣]+":\s*\d+/.test(gotG), gotG);

/* ══ B~G. 첫 달 마감 ═══════════════════════════════════════════════════
   ⚠⚠ **지름길 ㉮** — 살림 시계를 켠다(`fp.completed`). 월세는 살림 1일차에 나간다. */
console.log('\n== B~G. ★★ 월세 낸 날 가계부가 뜬다 ==');
{
  const before = await core();
  const snap0 = (((await store()) || {}).cur || {}).snap || {};
  console.log('      월초 스냅샷 :', JSON.stringify(snap0));
  const snapBefore = snap0.cash;
  await page.eval(`(()=>{window.__S().firstPlay.completed = true;})()`, false);
  await redraw();
  await nextDay();
  await sleep(600);
  const mid = await core();
  ok('  살림 시계가 1일차로 돌았다', mid.tday === 1, `튜토 ${before.tday} → ${mid.tday}`);
  ok('  월세가 실제로 나갔다 (낸 횟수 1)', mid.paid === 1, String(mid.paid));

  /* G — 대사가 있으면 아직 안 뜬다 */
  if (mid.talking) {
    ok('★★ 대사 중에는 **안 뜬다** (가계부가 대사를 안 덮는다)', !(await on('monthPanel')));
    await walk();
    await sleep(600);
  } else ok('★★ 대사가 없어 바로 떴다', true);

  ok('★★ 가계부 팝업이 떴다', await on('monthPanel'));
  const st = await core();
  ok('  뜬 순간 대사 중이 아니다', st.talking === false);

  const g = await page.eval(`(()=>{const e=document.getElementById('monthPanel'),
      c=e.querySelector('.popcard'), cs=getComputedStyle(e),
      pc=getComputedStyle(document.getElementById('buyPanel'));
    const r=c.getBoundingClientRect();
    return { pos:cs.position, z:cs.zIndex, sameZ: cs.zIndex===pc.zIndex,
      sameClass: e.classList.contains('pop') && c.classList.contains('popcard'),
      inSheet: !!(document.getElementById('sheet')||{contains:()=>false}).contains(e),
      rows: c.querySelectorAll('.lrow').length,
      x:Math.round(r.x), y:Math.round(r.y), w:Math.round(r.width), h:Math.round(r.height),
      vw:innerWidth, vh:innerHeight, scrollW:document.documentElement.scrollWidth };})()`);
  ok('★★ 주문 팝업과 **같은 틀·같은 층**이다', g.sameClass && g.sameZ, 'z=' + g.z);
  ok('★★ `#sheet` **밖**에 있다', !g.inSheet);
  ok('★★ 카드가 **화면 안**이다',
     g.y >= 0 && g.x >= 0 && g.y + g.h <= g.vh && g.x + g.w <= g.vw,
     `x${g.x} y${g.y} ${g.w}×${g.h} / ${g.vw}×${g.vh}`);
  ok('  가로로 안 넘친다', g.scrollW <= g.vw, `${g.scrollW} <= ${g.vw}`);
  ok('★ 가계부 줄이 여럿이다 (살림 장부와 같은 `.lrow`)', g.rows >= 8, `${g.rows}줄`);

  /* ── 화면 글자 ── */
  const sum = await txt('#monthSum'), rows = await txt('#monthRows'), sub = await txt('#monthSub');
  console.log('      제목 :', await txt('#monthTitle'));
  console.log('      머리 :', sub);
  console.log('      요약 :', sum);
  console.log('      본문 :', rows);

  /* C — 한 줄 요약이 **지갑 증감과 정확히** 맞는다.
     요약 글은 `이번 달 ±X원 — 지갑이 A원에서 B원으로 …` 이라 뽑은 수가 [X, A, B] 다. */
  const cashNow = st.cash;
  const sn = nums(sum);
  ok('★★ 요약이 **월초 지갑**을 그대로 적는다', sn[1] === snapBefore,
     `화면 ${sn[1]} · 코어 ${snapBefore}`);
  ok('★★ 요약이 **지금 지갑**을 그대로 적는다', sn[2] === cashNow,
     `화면 ${sn[2]} · 코어 ${cashNow}`);
  ok('★★★ 「이번 달 ±얼마」가 그 둘의 차와 같다', sn[0] === Math.abs(cashNow - snapBefore),
     `화면 ${sn[0]} · 코어 ${Math.abs(cashNow - snapBefore)}`);
  ok('★ 첫 달이라 견줄 것이 없다고 말한다', /첫 달/.test(sum), sum);

  /* D — 월세 줄 · 주기.
     ⚠ **줄을 글자로 찾지 않는다** — `textContent` 는 이름과 값이 **붙어서** 나온다
       (`월세200,000원`). 이름으로 찾으려면 `.lrow` 의 `span`/`b` 를 따로 읽어야 한다.
       글자로 자르면 그것 자체가 「재는 자」가 된다(START-HERE §2). */
  const cells = await page.eval(`(()=>{const o={};
    for (const el of document.querySelectorAll('#monthRows .lrow')) {
      const k=el.querySelector('span'), v=el.querySelector('b');
      if (k && v) o[(k.textContent||'').trim()] = (v.textContent||'').trim();
    } return o;})()`);
  console.log('      줄   :', JSON.stringify(cells, null, 0));
  const val = (label) => {
    const t = cells[label];
    if (t == null) return null;
    const mm = String(t).match(/(−|-)?([\d,]+)원/);
    return mm ? (mm[1] ? -1 : 1) * +mm[2].replace(/,/g, '') : null;
  };
  const rent = val('월세'), living = val('식비 · 공과'), power = val('식물등 전기') || 0,
        bought = val('상점에서 산 것'), veg = val('채소 판 것'), plant = val('식물 판 것'),
        gapShown = val('장부에 안 잡힌 것') || 0;
  ok('★★ 월세 줄이 **규칙값과 같다**', rent === before.rentWon,
     `화면 ${rent} · 코어 ${before.rentWon}`);
  ok('  「월세는 N일마다」를 규칙에서 읽어 적는다',
     sub.includes(String(before.period)), sub);

  /* E — ★★★ 대차. 가계부는 합이 맞아야 한다 */
  const inSum = veg + plant, outSum = rent + living + power + bought + gapShown;
  ok('★★★ **들어온 것 − 나간 것 = 지갑 증감** (안 맞는 몫까지 적어 놓아 딱 맞는다)',
     inSum - outSum === cashNow - snapBefore,
     `들어옴 ${inSum} − 나감 ${outSum} = ${inSum - outSum} · 지갑 ${cashNow - snapBefore}`);
  ok('  「상점에서 산 것」이 코어 누적과 같다', bought === before.shopSpent,
     `화면 ${bought} · 코어 ${before.shopSpent}`);
  ok('★ 먹은 것을 **작물별 g** 으로 적는다',
     /^[가-힣]+ [\d,.]+ ?[gkK]/.test(cells['밥이 된 것'] || ''), cells['밥이 된 것']);
  ok('★ 거둔 것을 g 과 회전 수로 적는다',
     /[가-힣]+ [\d,.]+ ?[gkK].*\(\d+회전\)/.test(cells['거둔 것'] || ''), cells['거둔 것']);
  ok('  이번 달 지갑 줄이 앞뒤를 적는다',
     /^[\d,]+원 → [\d,]+원$/.test(cells['이번 달 지갑'] || ''), cells['이번 달 지갑']);
  ok('  아낀 밥값을 **−** 로 적는다 (나간 돈에서 이미 빠진 값이라 또 더하면 두 번 센다)',
     /^−[\d,]+원$/.test(cells['밥으로 아낀 식비'] || ''), cells['밥으로 아낀 식비']);
  /* ⚠ **월초 스냅샷과 견준다** — `before` 는 마지막 하루 **전**이라 그 하루가 빠진다.
     이 자를 잘못 잡아 한 번 헛짚었다(START-HERE §2 — 재는 자를 먼저 의심하라). */
  ok('  아낀 밥값이 **코어 누적의 차**와 같다',
     Math.abs(val('밥으로 아낀 식비')) === st.foodSaved - (snap0.foodSaved || 0),
     `화면 ${Math.abs(val('밥으로 아낀 식비'))} · 코어 ${st.foodSaved - (snap0.foodSaved || 0)}`);

  /* F — 닫는 길 셋 · 닫아도 하루는 그대로 */
  const d0 = await core();
  await page.eval(`(()=>{document.querySelector('#monthPanel .popcard').click();})()`, false);
  await sleep(300);
  ok('  ⚠ 카드 **안**을 눌러서는 안 닫힌다', await on('monthPanel'));
  await page.eval(`(()=>{document.getElementById('monthPanel').click();})()`, false);
  await sleep(300);
  ok('② **뒤 누르기**로 닫힌다', !(await on('monthPanel')));
  const d1 = await core();
  ok('★★ 닫아도 **하루는 그대로**다 (이미 끝난 일을 보는 창이다)',
     d1.day === d0.day && d1.cash === d0.cash && d1.tday === d0.tday,
     `Day ${d0.day}→${d1.day} · 지갑 ${d0.cash}→${d1.cash}`);
}

/* ══ H. 둘째 달 — 지난달과 견준다 ═══════════════════════════════════════
   ⚠⚠ **지름길 ㉯** — 30일을 다시 밟는 대신 청구일을 하루 앞으로 당긴다.
     주기(`rentPeriodDays`)도 월세액도 안 건드렸다. */
console.log('\n== H. ★★ 둘째 달은 지난달과 견준다 ==');
{
  const b = await core();
  await page.eval(`(()=>{const S=window.__S(); S.tutorial.rent.nextDueDay = S.tutorial.day + 1;})()`, false);
  await nextDay(); await sleep(600); await walk(); await sleep(600);
  ok('★★ 둘째 달에도 뜬다', await on('monthPanel'));
  const sum = await txt('#monthSum'), sub = await txt('#monthSub');
  console.log('      머리 :', sub);
  console.log('      요약 :', sum);
  ok('★★ **지난달과 견준다** (첫 달이라는 말이 사라진다)',
     !/첫 달/.test(sum) && /지난달/.test(sum), sum);
  ok('  나아졌나 나빠졌나를 말한다', /(나아졌|나빠졌|똑같)/.test(sum), sum);
  ok('  「두 번째 달」이라고 제목이 말한다', /2/.test(await txt('#monthTitle')), await txt('#monthTitle'));
  ok('  닫는 길 — [알겠습니다]', (await click('monthGo')) && !(await on('monthPanel')));
}

/* ══ J·K. ★★ 다시 보기 — [가방] 단추 · 달 넘기기 (2026-08-18) ══════════════ */
console.log('\n== J·K. ★★ 지난 가계부를 다시 본다 ==');
{
  const log = await page.eval(`(()=>{const m=JSON.parse(localStorage.getItem('byeot.month'));
    return m ? m.log.length : -1;})()`);
  ok('★★ 마감한 장부가 **목록으로 쌓인다**', log === 2, `${log}달`);
  const bytes = await page.eval(`(()=>{const m=JSON.parse(localStorage.getItem('byeot.month'));
    return JSON.stringify(m.log[0]).length;})()`);
  console.log(`      장부 한 장 ${bytes}바이트 · 열두 장이면 ${(bytes * 12 / 1024).toFixed(1)}KB`);
  ok('  한 장이 작다 (열두 달을 쌓아도 localStorage 한도의 티끌이다)', bytes < 1200, `${bytes}B`);

  await openTab('bag');
  const b = await page.eval(`(()=>{const e=document.getElementById('ledgerBack');
    return {t:(e.textContent||'').trim(), dis:e.dis===true?true:e.disabled,
            hint:(document.getElementById('ledgerBackHint').textContent||'').trim()};})()`);
  ok('★★ 이제 단추가 **살아난다**', b.dis === false, b.t);
  ok('★ 단추가 **몇 달 쌓였는지**를 적는다', /2달/.test(b.t), b.t);
  ok('  회색일 때 적던 까닭은 사라진다 (이제 회색이 아니다)', b.hint === '', b.hint);

  await click('ledgerBack'); await sleep(500);
  ok('★★★ 누르면 **가장 가까운 달**이 뜬다', await on('monthPanel'));
  const nav0 = await page.eval(`(()=>{const n=document.getElementById('monthNav');
    return {shown: getComputedStyle(n).display !== 'none',
            which:(document.getElementById('monthWhich').textContent||'').trim(),
            prev:document.getElementById('monthPrev').disabled,
            next:document.getElementById('monthNext').disabled};})()`);
  ok('★★ 달 넘기개가 뜬다 (둘 이상 쌓였다)', nav0.shown, JSON.stringify(nav0));
  ok('★ 지금 몇 번째를 보는지 적는다', nav0.which === '2 / 2', nav0.which);
  ok('  끝이라 [다음 달 ›]이 회색이다', nav0.next === true);

  const t2 = await txt('#monthTitle'), s2 = await txt('#monthSum');
  await click('monthPrev'); await sleep(400);
  const t1 = await txt('#monthTitle'), s1 = await txt('#monthSum');
  const nav1 = await page.eval(`(()=>({which:(document.getElementById('monthWhich').textContent||'').trim(),
    prev:document.getElementById('monthPrev').disabled,
    next:document.getElementById('monthNext').disabled}))()`);
  ok('★★★ [‹ 이전 달]로 **지난 달이 뜬다**', nav1.which === '1 / 2', nav1.which);
  ok('★★ 내용이 실제로 **바뀐다** (같은 장부를 두 번 보여 주지 않는다)',
     s1 !== s2 || t1 !== t2, `${t1} / ${t2}`);
  ok('★ 첫 달은 「첫 달 가계부」다', /첫 달/.test(t1), t1);
  ok('  맨 앞이라 [‹ 이전 달]이 회색이다', nav1.prev === true);
  ok('  [다음 달 ›]은 살아 있다', nav1.next === false);
  await click('monthNext'); await sleep(400);
  ok('  [다음 달 ›]로 되돌아온다', (await txt('#monthWhich')) === '2 / 2');

  /* ★ [✕] 로 닫는다 — 닫는 길을 **늘린 것**이지 줄인 것이 아니다 */
  const cx = await page.eval(`(()=>{const e=document.getElementById('monthClose');
    if(!e) return null; const r=e.getBoundingClientRect();
    return {w:Math.round(r.width), h:Math.round(r.height)};})()`);
  ok('★★ 오른쪽 위에 [✕]가 있고 **44px 이상**이다', !!cx && cx.w >= 44 && cx.h >= 44,
     cx && `${cx.w}×${cx.h}`);
  const d0 = await core();
  await click('monthClose'); await sleep(350);
  ok('★★ [✕]로 닫힌다', !(await on('monthPanel')));
  const d1 = await core();
  ok('  ✕로 닫아도 하루는 그대로다', d1.day === d0.day && d1.cash === d0.cash);
  ok('  [알겠습니다]·뒤 누르기·Esc 도 그대로 산다',
     await page.eval(`(()=>!!document.getElementById('monthGo') &&
       typeof window.__byeotPopClose === 'function')()`));
  await page.eval(`window.__byeotSheet.close()`, false); await sleep(300);
}

/* ══ L. ★ 열두 달을 넘기면 오래된 것부터 버린다 ═══════════════════════════
   ⚠⚠ **지름길이다** — 열두 달을 실제로 밟으려면 360일이 든다. 그래서 **쌓인 목록에만**
     가짜 장부를 밀어 넣고 한 달을 더 마감해 본다. 코어도 값도 안 건드린다. */
console.log('\n== L. ★ 열두 달까지만 쌓인다 (오래된 것부터 버린다) ==');
{
  await page.eval(`(()=>{const m=JSON.parse(localStorage.getItem('byeot.month'));
    const seed = m.log[0];
    /* 앞쪽에 표시가 남는 가짜 열두 장을 끼운다 — 어느 것이 밀려났는지 보려고 count 를 적는다 */
    const fake = [];
    for (let i=0;i<12;i++) fake.push(Object.assign({}, seed, {count: 900+i}));
    m.log = fake.concat(m.log);
    localStorage.setItem('byeot.month', JSON.stringify(m));})()`, false);
  const n0 = await page.eval(`JSON.parse(localStorage.getItem('byeot.month')).log.length`);
  ok('  (지름길) 목록을 14장으로 부풀렸다', n0 === 14, String(n0));
  await page.eval(`(()=>{const S=window.__S(); S.tutorial.rent.nextDueDay = S.tutorial.day + 1;})()`, false);
  await nextDay(); await sleep(600); await walk(); await sleep(600);
  const after = await page.eval(`(()=>{const m=JSON.parse(localStorage.getItem('byeot.month'));
    return {n:m.log.length, first:m.log[0].count, last:m.log[m.log.length-1].count};})()`);
  ok('★★ **열두 장까지만** 남는다', after.n === 12, `${after.n}장`);
  ok('★★ 버려진 것은 **가장 오래된 쪽**이다 (맨 앞 셋이 밀려났다)',
     after.first === 903, `맨 앞 ${after.first}`);
  ok('  가장 가까운 달이 맨 뒤에 있다', after.last === 3, `맨 뒤 ${after.last}번째 달`);
  if (await on('monthPanel')) { await click('monthGo'); await sleep(300); }
}

/* ══ I. 360 · 390 · 430 ═══════════════════════════════════════════════ */
console.log('\n== I. ★ 세 폭 다 눌리는 크기다 ==');
for (const w of [360, 390, 430]) {
  await page.send('Emulation.setDeviceMetricsOverride',
                  { width: w, height: 844, deviceScaleFactor: 2, mobile: false });
  await sleep(600);
  /* 지난 장부를 그대로 다시 연다 — 값이 아니라 크기를 재는 자리다 */
  await page.eval(`(()=>{window.__byeotMonthShow && window.__byeotMonthShow();})()`, false);
  await sleep(500);
  const m = await page.eval(`(()=>{const e=document.getElementById('monthPanel');
    if(!e.classList.contains('on')) return null;
    const c=e.querySelector('.popcard'), r=c.getBoundingClientRect();
    const bs=[...c.querySelectorAll('button')].filter(b=>b.offsetParent!==null)
      .map(b=>{const q=b.getBoundingClientRect();
               return {w:Math.round(q.width), h:Math.round(q.height)};});
    return { btns:bs, minH: Math.min(...bs.map(b=>b.h)),
             x:Math.round(r.x), y:Math.round(r.y), w:Math.round(r.width), h:Math.round(r.height),
             vw:innerWidth, vh:innerHeight, scrollW:document.documentElement.scrollWidth };})()`);
  ok(`${w} — 다시 열린다`, !!m);
  if (!m) continue;
  ok(`${w} — ★ 단추가 44px 이상`, m.minH >= 44, m.btns.map(b => `${b.w}×${b.h}`).join(' · '));
  ok(`${w} — 카드가 화면 안이다`,
     m.y >= 0 && m.x >= 0 && m.y + m.h <= m.vh && m.x + m.w <= m.vw,
     `x${m.x} y${m.y} ${m.w}×${m.h}`);
  ok(`${w} — 가로로 안 넘친다`, m.scrollW <= m.vw, `${m.scrollW} <= ${m.vw}`);
  await click('monthGo'); await sleep(250);
}

/* ══ M. ★★★ 판이 바뀌면 지난 장부가 안 남는다 ═══════════════════════════
   ⚠ 맨 뒤에 둔다 — 이 절은 판을 통째로 갈아 치운다.
   ★ **세이브 키만 지우고 새로고침**한다. 「세이브가 없는데 장부만 있다」가 바로
     ㉮ 판정이고, 이것이 [지금 판을 지웁니다]가 남기는 상태와 같다. */
console.log('\n== M. ★★★ 판이 바뀌면 지난 판의 장부가 안 남는다 ==');
{
  const was = await page.eval(`(()=>{const m=JSON.parse(localStorage.getItem('byeot.month'));
    return {n:m.log.length, runId:m.runId};})()`);
  ok('  (재기 전) 장부가 쌓여 있다', was.n > 0, `${was.n}달 · ${was.runId}`);

  /* ── ㉮ **세이브가 없는데 장부만 있다** ────────────────────────────────
     ⚠⚠ **재는 법이 까다로웠다 — 그리고 그게 게임의 사실이었다.**
       세이브 키를 지우고 새로고침하면 **떠나면서 `pagehide` 가 저장을 한 번 더 한다**
       (`addEventListener('pagehide', saveNow)`). 그래서 지운 자리가 **다시 채워진 채로**
       새 판이 열린다 — 「지웠는데 그대로」의 그 자리다(`hardReset` 이 `saveOff` 를 먼저
       세우는 까닭이 이것이고, 주석에 그 사고가 적혀 있다).
     ⇒ 그래서 **부팅이 세이브를 읽기 전에** 지운다. 부팅은 growth 를 세우느라 몇 초가
       걸리고 `resumeSave()` 는 그 뒤에 돈다 — 그 사이에 지우면 진짜로 「세이브가 없는
       부팅」이 된다. 실제 게임에서 이 갈래를 타는 것은 **세이브를 못 읽었을 때**다. */
  await page.goto(`${BASE}/game.html`);
  await page.eval(`localStorage.removeItem('byeot/save/1')`, false);   // 아직 안 읽었다
  await page.waitFor('!!window.__rv', 180000, 300);
  await page.waitFor('window.__byeotBooted === true', 180000, 300);
  await sleep(5000); await walk();
  const noSave = await page.eval(`(()=>{const m=JSON.parse(localStorage.getItem('byeot.month'));
    return m ? {n:m.log.length, runId:m.runId} : null;})()`);
  ok('★★★ ㉮ **세이브가 없으면 쌓인 장부도 버린다**', !!noSave && noSave.n === 0,
     noSave && `${noSave.n}달`);
  ok('★★ ㉮ 판 도장이 새로 찍혔다', !!noSave && noSave.runId !== was.runId, noSave && noSave.runId);

  /* ── ㉯ **날짜가 뒤로 갔다**(옛 세이브를 열었다) ────────────────────────
     ⚠ 앞 절이 목록을 비웠으므로 **가짜 장부 하나를 다시 넣고** 잰다(§L 과 같은 지름길). */
  await page.eval(`(()=>{const m=JSON.parse(localStorage.getItem('byeot.month'));
    m.log = [{count:1, net:-1, cashFrom:1, cashTo:0, fromDay:0, toDay:1, days:1,
              rent:0, living:0, power:0, bought:0, veg:0, plant:0, income:0, saved:0,
              ateG:{}, gotG:{}, harvests:0, gap:0, prevNet:null, period:30}];
    localStorage.setItem('byeot.month', JSON.stringify(m));})()`, false);
  const was2 = await page.eval(`JSON.parse(localStorage.getItem('byeot.month')).runId`);
  /* 쌓인 달의 시작일이 지금 살림 날짜보다 앞날이면 다른 판이다. 이건 **확실히** 잰다. */
  await page.eval(`(()=>{const m=JSON.parse(localStorage.getItem('byeot.month'));
    m.cur.fromDay = 9999;                     /* 앞날을 가리키게 만든다 */
    localStorage.setItem('byeot.month', JSON.stringify(m));})()`, false);
  await boot(false);                          /* ⚠ localStorage 를 **안 지운다** */
  const now = await page.eval(`(()=>{const m=JSON.parse(localStorage.getItem('byeot.month'));
    return m ? {n:m.log.length, runId:m.runId, from:m.cur.fromDay} : null;})()`);
  ok('★★★ ㉯ **날짜가 뒤로 갔으면 쌓인 장부를 버린다**', !!now && now.n === 0,
     now && `${now.n}달`);
  ok('★★ ㉯ 판 도장이 새로 찍혔다', !!now && now.runId !== was2, now && now.runId);
  ok('  이번 달도 지금 날짜에서 다시 연다', !!now && now.from < 9999, now && String(now.from));
  await openTab('bag');
  const b = await page.eval(`(()=>{const e=document.getElementById('ledgerBack');
    return {dis:e.disabled, hint:(document.getElementById('ledgerBackHint').textContent||'').trim()};})()`);
  ok('  단추도 다시 회색으로 돌아가고 까닭을 적는다', b.dis === true && /월세/.test(b.hint), b.hint);
  await page.eval(`window.__byeotSheet.close()`, false); await sleep(300);
  /* ⚠ **주문 개수 기억은 판이 바뀌어도 남아야 한다** — 손버릇이지 살림이 아니다 */
  ok('  ⚠ 주문 개수 기억(`byeot.lastOrderQty`)은 **그대로 남는다** (손버릇이라 그렇다)',
     await page.eval(`localStorage.getItem('byeot.lastOrderQty') !== null ||
                      localStorage.getItem('byeot.month') !== null`));
}

console.log('\n== 부팅·조작 중 던진 예외 ==');
ok('★ 예외가 하나도 없다', errs.length === 0, errs.slice(0, 3).join(' | '));

console.log(`\n잰 것 ${seen}개 · 어긋난 것 ${bad}개`);
await page.close();
process.exit(bad ? 1 : 0);
