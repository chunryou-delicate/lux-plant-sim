/* ============================================================
   tools/test_questui.mjs — **할 일 창** · **밥상 창의 표현** · 2026-08-18 신설
   ------------------------------------------------------------
     python tools/serve.py 8963
     BYEOT_URL=http://localhost:8963 node tools/test_questui.mjs

   ★ 왜 이 검사가 필요한가 — 박사님 두 마디다:
     *"요새 게임들 퀘스트창 파악해서 적당히 이쁘게 구현해."*
     *"밥상창이 (…) 팝업으로 뜨게 해 줘. 그리고 헷갈린데 지금 뜨는 게 표현이."*

   ⚠ `tools/test_quest.mjs` 와 **재는 것이 다르다.** 그쪽은 **판정**(스냅샷 → 열림/끝남)을
     코어에서 잰다. 여기는 **배선과 화면**을 잰다 — 판정이 아무리 맞아도 화면이 안 부르면
     한 줄도 안 열리기 때문이다(확정문 §5 가 「절반만 붙이면 안 된다」고 못 박은 그것).

   ══ 무엇을 보나 ═══════════════════════════════════════════════════════════
     A ★★★ **배선이 살아 있다** — 스냅샷이 실제 판의 사실을 읽고, 아래 한 줄이
        퀘스트를 말하고, 끝내면 **보상이 실제로 들어온다**
     B ★★ **Day 0 에 ③이 안 열린다** — 회귀. 확정문 코드를 그대로 붙였더니 첫날부터
        「잎 1장짜리 마디를 잘라 물에 꽂으세요」가 떴다(생장 창의 시연용 그루 때문)
     C ★★ **할 일 창** — 팝업 틀 · 진행도 · 여섯 줄 · 도장 · 보상 · 닫는 길 넷
     D ★★★ **밥상 창의 표현** — 몫이 보이나 · **두 수의 관계**가 보이나 ·
        ⚠ **거짓말을 안 하나**(곳간이 남았는데 「곳간이 없습니다」라고 하던 그 줄)
     E ★★ **콩나물+무순이 같이 있을 때** — 제일 헷갈릴 자리다
     W ★ 세 폭(360·390·430) — 잘리지 않고 · 가로로 안 넘치고 · 단추 44px

   ⚠ **밸런스를 한 톨도 안 잰다.** 액수의 옳고 그름은 `test_econ`·`test_crop_*` 것이다.
     여기는 **화면이 그 값을 어떻게 말하는가**만 본다.
============================================================ */
import { launch, sleep } from './test_cdp.mjs';
/* ★★ 2026-08-16 — **줄 수를 이 파일에 안 박는다.** 이날 다섯이 여섯이 됐고(`buy_lamp`),
   박아 둔 `=== 5` 넷이 한꺼번에 낡아 「고장」으로 읽혔다. 표가 정본이다(START-HERE §2.8).
   ⚠ 여기서 재야 하는 것은 「몇 줄인가」가 아니라 **「표에 있는 만큼 화면에 나오는가」**다. */
import { QUESTS } from '../src/game/quest.js';
import { STAMINA_RULES } from '../src/game/stamina.js';
const NQ = QUESTS.length;

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

const freeHands = () => page.eval(`(()=>{const S=window.__S(); if (S.stamina) S.stamina.usedToday = 0;})()`, false);
const redraw = async () => { await page.eval(`window.__redraw && window.__redraw()`, false); await sleep(300); };
const click = (id) => page.eval(`(()=>{const b=document.getElementById('${id}');
  if(!b||b.disabled) return false; b.click(); return true;})()`);
const on = (id) => page.eval(`(()=>{const e=document.getElementById('${id}');
  return !!(e && e.classList.contains('on'));})()`);
const txt = (sel) => page.eval(`(()=>{const e=document.querySelector('${sel}');
  return e ? (e.textContent||'').replace(/\\s+/g,' ').trim() : null;})()`);

/* ══ B. 회귀 — 첫날에 ③이 안 열린다 ═══════════════════════════════════════ */
console.log('\n══ B. ★★ 첫날 — 아직 아무것도 안 열린다 ══════════════════════');
{
  const v = await page.eval(`JSON.stringify(window.__questView())`);
  const s = await page.eval(`JSON.stringify(window.__questSnap())`);
  const view = JSON.parse(v), snap = JSON.parse(s);
  ok('B-1 ★ 화면이 퀘스트 상태를 낸다 (창구가 살아 있다)', !!view && view.all.length === NQ,
     `줄 ${view && view.all.length}개 / 표 ${NQ}개`);
  ok('B-2 ★★★ 몬스테라가 안 왔으면 **모주 잎이 0** 이다 ' +
     '(생장 창의 시연용 그루를 모주로 읽으면 안 된다)',
     snap.motherLeaves === 0, `잎 ${snap.motherLeaves} · 화분 ${JSON.stringify(snap.cropPots.length)}개`);
  /* ══ ★★★ 2026-08-16 — **이 줄의 계약이 뒤집혔다.** ══════════════════════════════
     여기 있던 것: 「첫날에는 **한 줄도 안 열린다**」. 그때는 퀘스트 여덟이 전부
     첫 플레이가 끝난 뒤(실측 Day 33)에 열렸고, 이 검사는 그 사실을 못 박고 있었다.
     ⇒ 박사님: *"**잎 3개 날 때까지 너무 이벤트가 없더라.** 퀘스트가 단계별로 풀려야
       되는데 지금 몇 개 없잖아.."* — **그 「한 줄도 안 열린다」가 곧 문제였다.**
     ⇒ 이제 초반 사슬이 첫날부터 돈다. 재는 것은 정반대다: **첫날에 첫 줄이 열려 있다.**
     ⚠ 「몇 개가 열리나」를 숫자로 박지 않는다 — 사슬이 자라도 안 낡게 **하나 이상**만 본다. */
  ok('B-3 ★★★ 첫날부터 **할 일이 있다** (2026-08-16 계약이 뒤집힌 자리)',
     view.open.length >= 1, `열린 것 ${JSON.stringify(view.open)}`);
  ok('B-3b ★ 그래도 **한꺼번에 다 열리지는 않는다** (단계로 푼다)',
     view.open.length < view.all.length, `${view.open.length}/${view.all.length}줄`);
  ok('B-4 ★★ 아래 한 줄이 아직 **첫 플레이 안내**다 (퀘스트가 안 가로챈다)',
     !/물에 꽂으세요/.test(await txt('#quest')), await txt('#quest'));
}

/* ══ C. 할 일 창 ═══════════════════════════════════════════════════════════ */
console.log('\n══ C. ★★ 할 일 창 — 팝업 틀 · 진행도 · 여섯 줄 · 도장 ════════');
{
  /* 사람이 쓰는 길로 연다 — [가방] 안의 단추다 */
  await page.eval(`(()=>{ window.__byeotSheet.open(); window.__byeotSheet.tab('bag'); })()`, false);
  await sleep(700);
  /* ★★ 2026-08-16 — **여는 문이 옮겨갔다.** 가방 안 [할 일] 단추를 걷고
     `#navbar` 의 다섯째 칸(`#navQuest`)으로 옮겼다(박사님: *"가방 탭에 할 일은 이제
     없어도 되지"* · 같은 창을 여는 문이 셋이었다).
     ⇒ 재는 대상을 그 칸으로 옮긴다. **문이 있나 · 44px 인가 · 눌러서 열리나**는 그대로 잰다.
     ⚠ 진행도 글자(C-2)는 이제 **안 적는다** — 나머지 넷이 글자만 있는 줄이라
       여기만 수가 붙으면 줄이 어긋난다. 몇 개인지는 열면 창이 말한다. */
  const btn = await page.eval(`(()=>{const b=document.getElementById('navQuest');
    if(!b) return null; const r=b.getBoundingClientRect();
    return JSON.stringify({ text:b.textContent, h:Math.round(r.height),
      inView: r.top >= 0 && r.bottom <= innerHeight, disabled:b.disabled });})()`);
  ok('C-1 ★★ 왼쪽 줄에 여는 칸이 있다 · 44px 이상 · 화면 안이다',
     !!btn && JSON.parse(btn).h >= 44 && JSON.parse(btn).inView && !JSON.parse(btn).disabled, btn);
  ok('C-2 ★ 칸에 이름이 적혀 있다 (무엇을 여는 문인지 읽힌다)',
     /할\s*일/.test(JSON.parse(btn || '{}').text || ''), JSON.parse(btn || '{}').text);

  ok('C-3 눌러서 열린다', (await click('navQuest')) && (await on('questPanel')));
  const cls = await page.eval(`(()=>{const e=document.getElementById('questPanel');
    return e.className + '|' + (e.querySelector('.popcard') ? 'popcard' : 'none');})()`);
  ok('C-4 ★★★ **팝업 틀을 새로 안 지었다** (`.pop` + `.popcard` — 여섯째다)',
     /\bpop\b/.test(cls) && /popcard/.test(cls), cls);

  const box = await page.eval(`(()=>{const c=document.querySelector('#questPanel .popcard');
    const r=c.getBoundingClientRect();
    const rows=[...c.querySelectorAll('.qrow')];
    return JSON.stringify({
      title:document.getElementById('questTitle').textContent,
      bar:document.querySelector('#questBar i').style.width,
      rows: rows.length,
      states: rows.map(e=>e.classList.contains('done')?'done':e.classList.contains('open')?'open':'lock'),
      marks: rows.map(e=>(e.querySelector('.qmark')||{}).textContent),
      rew: rows.map(e=>(e.querySelector('.qrew')||{}).textContent),
      more: rows.map(e=>e.classList.contains('qmore')),
      ids: rows.map(e=>e.dataset.qid||null),
      inView: r.top>=0 && r.bottom<=innerHeight,
      scroll: c.scrollHeight > c.clientHeight+1,
      btnH: Math.round(document.getElementById('questGo').getBoundingClientRect().height) });})()`);
  const B = JSON.parse(box);
  /* ══ ★★★ 2026-08-16 — **이 줄도 뒤집혔다.** ═══════════════════════════════════
     여기 있던 것: 「**${NQ}줄이 다 있다**(접기·탭 없이 한 화면)」. 줄이 다섯~여덟이던
     때는 맞는 말이었다. 그런데 초반 사슬이 붙어 **열여섯**이 되자, 다 그리면
     **잠긴 자물쇠 열 개가 먼저 눈에 든다** — 박사님이 *"그리고 한 번에 보여주고..."* 라고
     지적하신 것이 그것이다. 「단계적 목표」가 아니라 「끝없는 목록」으로 읽힌다.
     ⇒ 이제 화면은 셋으로 갈라 그린다(game.html §questRowsHtml):
         끝낸 것 = 한 줄로 접힘 · 열린 것 = 펼침 · 잠긴 것 = **다음 둘만** + 나머지는 접힘 한 줄
     ⇒ 재는 것도 그 계약으로 바꾼다. **다 있나**가 아니라 **덜 보이나 · 그래도 셈은 맞나**다.
     ⚠ 수를 박지 않는다 — 화면이 낸 상태를 세어 견준다(§2.8). */
  const shownLock = B.states.filter(x => x === 'lock').length;
  ok('C-5 ★★★ **한 번에 다 안 보여 준다** (2026-08-16 계약이 뒤집힌 자리)',
     B.rows < NQ, `${B.rows}줄만 그렸다 / 표 ${NQ}줄`);
  ok('C-5b ★★ 잠긴 줄은 **다음 몇 개만** 미리 보인다 (다음이 뭔지는 보여야 방향이 선다)',
     shownLock >= 1 && shownLock <= 3, `잠긴 줄 ${shownLock}개`);
  ok('C-5c ★ 접은 것을 **말한다** (조용히 빼면 「줄이 사라졌다」가 된다)',
     /더 있습니다/.test(await txt('#questList')), (await txt('#questList')).slice(-40));
  /* ⚠ 템플릿 문자열 안에서는 `\d` 가 그냥 `d` 가 된다 — 정규식으로 쓰려면 **두 번 젖혀야** 한다 */
  ok('C-6 ★★ 진행도를 **수로** 말한다', new RegExp(`\\d+\\s*/\\s*${NQ}`).test(B.title), B.title);
  ok('C-7 ★ 진행도 **띠**도 같은 값을 말한다', /^\d+%$/.test(B.bar), B.bar);
  /* ⚠ 2026-08-16 — 「${NQ}줄 전부」에서 **「그린 줄 전부」**로 바꿨다(위 C-5 와 같은 까닭).
     ★ 접힘 줄(`.qmore`)은 퀘스트가 아니라 안내라 보상 칸이 비는 것이 맞다 — 빼고 센다. */
  const rewReal = B.rew.filter((_, i) => !B.more[i]);
  ok('C-8 ★★★ **그린 줄에는 보상이 다 보인다** (하나도 빈칸이 아니다)',
     rewReal.length === B.rows - B.more.filter(Boolean).length &&
     rewReal.every(r => r && r.trim() && r.trim() !== '—'), JSON.stringify(B.rew));
  /* ⚠ 2026-08-16 — **3 을 박아 뒀다가 낡았다.** 시루 늘리기 둘이 붙어 다섯이 됐다.
     ⇒ `stamina` 표에서 **세어서** 견준다. 줄이 늘어도 안 낡는다(§2.8). */
  /* ⚠⚠ 2026-08-16 — **「표 전체의 체력 줄 수」와 못 견준다.** 화면이 이제 일부만 그리므로
     그 수는 원리적으로 안 맞는다. 재려던 것은 **「화면이 보상 문구를 지어내지 않는가」**였고,
     그것은 **그린 줄 하나하나를 정의와 대조**하면 그대로 잰다 — 오히려 더 촘촘하다. */
  const staOf = (id) => (STAMINA_RULES.quests || {})[id] || 0;
  const shownIds = B.ids || [];
  const mismatch = shownIds.map((id, i) => {
    const n = staOf(id), r = String(B.rew[i] || '');
    if (!id) return null;                       // 접힘 줄
    if (n > 0) return new RegExp(`체력 \+${n}`).test(r) ? null : `${id}: 체력 +${n} 인데 «${r}»`;
    return /체력 \+\d/.test(r) ? `${id}: 체력 0 인데 «${r}»` : null;
  }).filter(Boolean);
  ok('C-9 ★★ 보상 문구를 화면이 안 지어냈다 — 체력 값이 **정의에서** 나온다',
     mismatch.length === 0, mismatch.length ? JSON.stringify(mismatch) : JSON.stringify(B.rew));
  ok('C-10 ★★ 카드가 화면 안이고 **안 구른다** (모든 줄이 한눈에)',
     B.inView && B.scroll === false, `inView ${B.inView} · scroll ${B.scroll}`);
  ok('C-11 ★ 단추가 44px 이상', B.btnH >= 44, `${B.btnH}px`);

  /* 닫는 길 — [알겠습니다] · [✕] · 뒤 누르기 · Esc */
  await click('questGo');   await sleep(200);
  ok('C-12 [알겠습니다]로 닫힌다', !(await on('questPanel')));
  await page.eval(`window.__byeotQuestShow()`, false); await sleep(250);
  await click('questClose'); await sleep(200);
  ok('C-13 [✕]로도 닫힌다', !(await on('questPanel')));
  await page.eval(`window.__byeotQuestShow()`, false); await sleep(250);
  await page.eval(`(()=>{const e=document.getElementById('questPanel');
    e.dispatchEvent(new MouseEvent('click',{bubbles:true}));})()`, false);
  await sleep(250);
  ok('C-14 ★ 뒤를 눌러도 닫힌다 (닫는 길이 없으면 갇힌다)', !(await on('questPanel')));
  await page.eval(`window.__byeotQuestShow()`, false); await sleep(250);
  await page.eval(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))`, false);
  await sleep(250);
  ok('C-15 ★ `Esc`(안드로이드 뒤로가기)로도 닫힌다', !(await on('questPanel')));
  await page.eval(`window.__byeotSheet.close()`, false); await sleep(400);
}

/* ══ A. 배선 — 실제로 열리고 · 끝나고 · 보상이 들어온다 ══════════════════ */
console.log('\n══ A. ★★★ 배선이 살아 있다 ═════════════════════════════════');
{
  /* ⚠ 지름길 — 첫 플레이를 끝난 것으로 세운다. 33일을 실제로 굴리는 것은 이 검사의
     대상이 아니고(그건 `test_quest` 가 스냅샷으로 잰다), 여기서 재려는 것은
     **화면이 그 사실을 읽어 판정을 부르는가**다. 굴리는 길은 `_probe_quest_say` 가 맡는다. */
  const maxBefore = await page.eval(`window.__S().stamina.max`);
  await page.eval(`(()=>{ const S=window.__S(); S.firstPlay.completed = true; })()`, false);
  await redraw();
  const v1 = JSON.parse(await page.eval(`JSON.stringify(window.__questView())`));
  ok('A-1 ★★ 첫 플레이가 끝나면 ①이 **열린다**', v1.open.includes('crop_mix'),
     JSON.stringify(v1.open));
  ok('A-2 ★★★ 그러면 **아래 한 줄이 퀘스트를 말한다**(확정문 §4 — 퀘스트가 이긴다)',
     (await txt('#quest')) === (v1.next && v1.next.todo), await txt('#quest'));

  /* ★★ 하루가 간 직후에 판정이 도나(ⓒ-②) — 여기를 안 붙이면 뒤 세 줄이 영영 안 열린다.
     ①의 완료 조건은 「한 상에 두 작물이 올랐다」이고, 그건 **턴이 낸 사실**이라
     하루를 실제로 넘겨야만 재진다. 그래서 곳간에 두 작물을 넣고 하루를 넘긴다. */
  await page.eval(`(()=>{ const S=window.__S(), f=S.firstPlay.food, d=S.day;
    f.pantryLots = [{ kind:'beansprout', kindKo:'콩나물', won:4000, g:400, day:d },
                    { kind:'musun', kindKo:'무순', won:3000, g:300, day:d }];
    f.pantryWon = 7000;
    S.shop.stock.siru = (S.shop.stock.siru||0) + 1; })()`, false);
  await redraw();
  /* 시루를 방에 놓아야 [다음 날]이 열린다 */
  await page.eval(`(()=>{ const rv=window.__rv,
      c=document.getElementById('roomCanvas').getBoundingClientRect();
    const sp=rv.screenPosOf('banjiha-dresser:1'); if(!sp) return false;
    window.__drag.begin('beansprout', document.getElementById('cropThumb').src,
                        {clientX:c.left+c.width*0.9, clientY:c.top+40});
    window.__drag.move({clientX:c.left+sp.x, clientY:c.top+sp.y}); window.__drag.end(); return true;})()`);
  await sleep(1300); await walk(); await freeHands();

  const d0 = await page.eval(`window.__S().day`);
  await click('next'); await sleep(600);
  ok('A-3 ★ [다음 날] 첫 누름에 **밥상 팝업**이 뜬다 (이 손버릇을 안 깼다)',
     await on('mealPanel'));
  await click('mealGo');
  await page.waitFor(`window.__S().day === ${d0 + 1}`, 20000, 30);
  await sleep(800); await walk(); await sleep(400);

  const taken = JSON.parse(await page.eval(`JSON.stringify(window.__S().stamina.questsTaken)`));
  ok('A-4 ★★★ **하루가 간 직후 판정이 돈다**(ⓒ-② 가 붙었다) — ①이 끝났다',
     taken.includes('crop_mix'), JSON.stringify(taken));
  const maxAfter = await page.eval(`window.__S().stamina.max`);
  ok('A-5 ★★ **보상이 실제로 들어왔다** — 최대체력이 늘었다',
     maxAfter > maxBefore, `${maxBefore} → ${maxAfter}`);
  const v2 = JSON.parse(await page.eval(`JSON.stringify(window.__questView())`));
  ok('A-6 ★★ ①을 끝내면 ②가 **열린다** (다음 줄로 이어진다)',
     v2.open.includes('siru5_cycle5'), JSON.stringify(v2.open));
  ok('A-7 ★ 끝낸 줄은 **도장**이 찍힌다 (창에서)', await page.eval(`(()=>{
       window.__byeotQuestShow();
       const r=[...document.querySelectorAll('#questPanel .qrow.done')];
       return r.length === 1 && /✓/.test((r[0].querySelector('.qmark')||{}).textContent||'');})()`));
  await page.eval(`window.__byeotPopClose()`, false); await sleep(250);
}

/* ══ D·E. 밥상 창의 표현 ═══════════════════════════════════════════════════ */
console.log('\n══ D·E. ★★★ 밥상 창 — 몫이 보이나 · 거짓말을 안 하나 ═════════');
const putPantry = async (lots) => {
  await page.eval(`(()=>{ const S=window.__S(), f=S.firstPlay.food;
    const L = ${JSON.stringify(lots)};
    f.pantryLots = L.map(l => ({ kind:l.kind, kindKo:l.ko, won:l.g*10, g:l.g, day:S.day }));
    f.pantryWon = L.reduce((a,l)=>a+l.g*10, 0);
    if (S.stamina) S.stamina.usedToday = 0; })()`, false);
  await page.eval(`(()=>{const b=document.getElementById('mealCancel'); if(b) b.click();})()`, false);
  await sleep(150);
  await redraw();
  await click('next');
  await sleep(600);
};
const mealRead = () => page.eval(`(()=>{
  const t=(id)=>{const e=document.getElementById(id); return e?(e.textContent||'').replace(/\\s+/g,' ').trim():'';};
  const c=document.querySelector('#mealPanel .popcard'), r=c.getBoundingClientRect();
  return JSON.stringify({ title:t('mealTitle'), sub:t('mealSub'),
    rows:[...document.getElementById('mealRows').children]
          .map(e=>(e.textContent||'').replace(/\\s+/g,' ').trim()),
    say:t('mealSay'),
    inView: r.top>=0 && r.bottom<=innerHeight,
    scroll: c.scrollHeight > c.clientHeight+1,
    overflow: document.documentElement.scrollWidth > innerWidth });})()`);

{
  /* ── ⓐ 콩나물만 400g — **옛 화면이 거짓말하던 판** ───────────────────── */
  await putPantry([{ kind: 'beansprout', ko: '콩나물', g: 400 }]);
  ok('D-0 ★★ 밥상 창이 **팝업**으로 뜬다', await on('mealPanel'));
  const A = JSON.parse(await mealRead());
  const allA = A.rows.join(' | ') + ' || ' + A.say;
  ok('D-1 ★★ 제목이 **한 줄로 짧다** (예전엔 곳간·상한이 붙어 360px 에서 두 줄이었다)',
     A.title === '오늘 밥상', A.title);
  ok('D-2 ★★★ **「몫」이 화면에 있다** (규칙은 몫으로 도는데 예전 화면은 g 과 원만 말했다)',
     /몫/.test(allA), A.rows[1]);
  ok('D-3 ★★ **한 몫이 몇 g 인지**가 보인다', /첫 몫 · 콩나물 300g/.test(allA), A.rows[1]);
  ok('D-4 ★★★ **두 수의 관계를 말한다** — 하루 식비에서 아낀 것을 뺀 것이 지갑에서 나간다 ' +
     '(예전엔 하루 식비라는 수가 화면에 아예 없었다)',
     /하루 식비 [\d,]+원에서 아낀 [\d,]+원을 뺀 것/.test(allA),
     A.rows.find(r => /하루 식비/.test(r)));
  ok('D-5 ★★★ **거짓말을 안 한다** — 곳간이 남아 있는데 「곳간이 그만큼 없습니다」라고 ' +
     '하지 않는다 (옛 화면의 그 줄이다)',
     !/곳간이 그만큼 없습니다/.test(allA) && /남았는데 더 안 올립니다/.test(A.say), A.say);
  ok('D-6 ★★ 그러면서 **진짜 까닭**을 말한다 — 둘째 몫을 같은 작물로 채우면 파는 값보다 못하다',
     /같은 작물로 채우면/.test(A.say), A.say);
  ok('D-7 ★ 남는 것이 **버려지지 않는다**고 말한다', /쌓입니다|팔 수 있습니다/.test(allA),
     A.rows.find(r => /쌓/.test(r)) || A.say);

  /* ── ⓑ ★★ 콩나물 + 무순 — **제일 헷갈릴 자리** ──────────────────────── */
  await putPantry([{ kind: 'beansprout', ko: '콩나물', g: 400 },
                   { kind: 'musun', ko: '무순', g: 300 }]);
  const M = JSON.parse(await mealRead());
  const allM = M.rows.join(' | ') + ' || ' + M.say;
  ok('E-1 ★★★ 콩나물+무순이면 **몫이 두 줄로 갈려 보인다**',
     /첫 몫 · 콩나물/.test(allM) && /둘째 몫 · 무순/.test(allM),
     M.rows.filter(r => /몫 ·/.test(r)).join(' / '));
  ok('E-2 ★★ **작물마다 한 몫의 g 이 다르다**는 것이 그 자리에서 보인다 (300g · 200g)',
     /콩나물 300g/.test(allM) && /무순 200g/.test(allM));
  ok('E-3 ★★★ 섞어 먹으면 **더 아낀다**는 것이 보인다 — 콩나물만일 때보다 아끼는 값이 크다',
     (() => {
       const num = s => Number((String(s).match(/([\d,]+)원/) || [0, '0'])[1].replace(/,/g, ''));
       return num(M.rows.find(r => /아끼는 식비/.test(r))) >
              num(A.rows.find(r => /아끼는 식비/.test(r)));
     })(),
     `${A.rows.find(r => /아끼는 식비/.test(r))} → ${M.rows.find(r => /아끼는 식비/.test(r))}`);
  ok('E-4 ★★ 다 아낀 판에서는 **탓하는 말이 없다**',
     !/모자라|없습니다|안 올립니다/.test(M.say), M.say);
  ok('E-5 ★ 이 판에서도 **두 수의 관계**를 말한다',
     /하루 식비 [\d,]+원에서 아낀 [\d,]+원을 뺀 것/.test(allM));

  /* ── ⓒ 몫을 못 채우는 판 — 이때만 곳간을 탓해야 한다 ─────────────────── */
  await putPantry([{ kind: 'beansprout', ko: '콩나물', g: 150 }]);
  const P = JSON.parse(await mealRead());
  const allP = P.rows.join(' | ') + ' || ' + P.say;
  ok('D-8 ★★ 못 채운 몫은 **무엇의 몇 %인지**를 말한다 (「50%」만으로는 뜻을 모른다)',
     /한 몫 300g의 50%/.test(allP), P.rows.find(r => /몫 ·/.test(r)));
  ok('D-9 ★★ **이때만** 곳간을 탓한다 (진짜로 모자란 판이다)',
     /모자라/.test(P.say), P.say);
}

/* ══ W. 세 폭 ═════════════════════════════════════════════════════════════ */
console.log('\n══ W. 세 폭 — 360 · 390 · 430 ═══════════════════════════════');
for (const w of [360, 390, 430]) {
  await page.send('Emulation.setDeviceMetricsOverride',
    { width: w, height: 844, deviceScaleFactor: 2, mobile: false });
  await sleep(500);
  /* 밥상 창 — 콩나물+무순 판이 제일 길다 */
  await putPantry([{ kind: 'beansprout', ko: '콩나물', g: 400 },
                   { kind: 'musun', ko: '무순', g: 300 }]);
  const M = JSON.parse(await mealRead());
  ok(`W-${w} ★ 밥상 창이 화면 안이고 · 안 구르고 · 가로로 안 넘친다`,
     M.inView && !M.scroll && !M.overflow,
     `inView ${M.inView} · scroll ${M.scroll} · overflow ${M.overflow}`);
  const btns = await page.eval(`JSON.stringify([...document.querySelectorAll('#mealPanel button')]
    .map(b=>{const r=b.getBoundingClientRect();
      return Math.round(r.width)+'×'+Math.round(r.height);}))`);
  ok(`W-${w} ★ 밥상 단추가 전부 **44px 이상**`,
     JSON.parse(btns).every(s => Number(s.split('×')[1]) >= 44), btns);
  await page.eval(`(()=>{const b=document.getElementById('mealCancel'); if(b) b.click();})()`, false);
  await sleep(250);

  /* 할 일 창 */
  await page.eval(`window.__byeotQuestShow()`, false);
  await sleep(350);
  const Q = await page.eval(`(()=>{const c=document.querySelector('#questPanel .popcard');
    const r=c.getBoundingClientRect();
    const cut=[...c.querySelectorAll('.qrow')].some(e=>{const b=e.getBoundingClientRect();
      return b.left < -0.5 || b.right > innerWidth+0.5;});
    return JSON.stringify({ inView: r.top>=0 && r.bottom<=innerHeight,
      scroll: c.scrollHeight > c.clientHeight+1,
      overflow: document.documentElement.scrollWidth > innerWidth, cut,
      closeH: Math.round(document.getElementById('questClose').getBoundingClientRect().height) });})()`);
  const q = JSON.parse(Q);
  ok(`W-${w} ★★ 할 일 창 — ${NQ}줄 · 안 잘리고 가로로 안 넘친다`,
     /* ⚠ 2026-08-16 — **「안 구른다」를 걷었다.** 줄이 다섯에서 여덟이 됐다(시루 둘 · 등 하나).
        여덟 줄을 폰 한 화면에 억지로 욱여넣으면 글씨가 작아져 못 읽는다 —
        **구르는 것이 맞다.** 대신 **가로로 안 넘치고 · 안 잘리고 · 화면 안**은 그대로 잰다. */
     q.inView && !q.overflow && !q.cut, Q);
  ok(`W-${w} ★ [✕]가 44px 이상`, q.closeH >= 44, `${q.closeH}px`);
  await page.eval(`window.__byeotPopClose()`, false);
  await sleep(250);
}
await page.send('Emulation.setDeviceMetricsOverride',
  { width: 390, height: 844, deviceScaleFactor: 2, mobile: false });

console.log(`\n(부팅·플레이 중 예외 ${errs.length}건)`);
if (errs.length) console.log('  ' + errs.slice(0, 4).join('\n  '));
ok('H-1 ★ game.html 예외가 없다', errs.length === 0, `${errs.length}건`);

console.log(`\n${bad ? '⛔' : '★'} ${seen - bad}/${seen} 통과`);
await page.close();
process.exit(bad ? 1 : 0);
