/* ============================================================
   tools/probe_questvoice.mjs — **초반 사슬 여덟 줄이 화면에서 말하는가** · 2026-08-16 신설
   ------------------------------------------------------------
     python tools/serve.py 8963
     BYEOT_URL=http://localhost:8963 node tools/probe_questvoice.mjs

   ★★★ 이 자가 재는 것 하나 — **「대사 파일에 있다」와 「화면이 말한다」는 다르다.**
     `tools/test_quest.mjs ⑹` 은 **코어**가 대사 id 를 내는지를 잰다(헤드리스).
     그런데 이 저장소가 열여섯 번 밟은 자리는 그 사이다 — 코어는 id 를 내는데
     화면이 안 부르거나(`dlgOpen` 배선), 부르는데 상자에 글자가 안 뜨거나(`dlgPaint`),
     `SCRIPTS` 의 이름이 한 글자 달라 `scriptOf` 가 **조용히 null 을 돌려주는** 경우다.
     ⚠ 마지막 것이 제일 위험하다 — `dialogue.js §QUEST_OPEN_SCRIPT` 가
       *"여기 없는 questId 는 조용히 지나간다"* 를 **계약**으로 적어 두었기 때문에,
       id 를 틀리면 **아무 오류 없이 그냥 조용하다.**
   ⇒ 그래서 이 자는 **`#dlgText` 에 실제로 뜬 글자**만 센다. 상태도 이벤트도 안 믿는다.

   ══ 어떻게 재나 ═══════════════════════════════════════════════════════════
     ① 대사를 **건너뛰지 않는다.** `#dlgSkip` 을 누르면 중간 줄이 안 그려져서
        「화면에 떴다」를 못 잰다. `#dlgBox` 를 **한 줄씩** 눌러 넘기며 글자를 받아 적는다.
     ② 받아 적은 글자를 `dialogue.SCRIPTS` 의 줄과 **글자 그대로** 맞춘다.
        ⚠ 화면은 `**굵게**` 를 `<b>` 로 바꿔 그리므로 별표를 떼고 견준다.
     ③ 첫 플레이의 실제 손짓을 그대로 밟는다 — 끌어 놓기 → [심기] → [물] → [수확] →
        [다시 심기] → 시루 하나 더 → 몬스테라를 창턱으로 → 잎 셋.

   ⚠ 켠 것과 끈 것 (START-HERE §2 첫째 규칙)
     켠 것 — `game.html` 전부(실제 화면·실제 코어·실제 조도). 대사는 손으로 안 띄운다.
     끈 것 ⓐ **체력** — 걸음마다 `usedToday = 0` 으로 되돌린다. 재는 것은 「말이 뜨나」이지
            「손이 모자라나」가 아니다(그건 `test_stamina` 것이다).
     끈 것 ⓑ **씨앗값·상점 재고** — 첫 플레이 중에는 상점이 안 열려서 다시 심기가 막힌다.
            재고만 채워 넣고 나머지는 손으로 누르는 것과 같은 길로 간다
            (`probe_cutting_ui.mjs` 가 같은 이유로 같은 짓을 한다).
     끈 것 ⓒ **잎이 며칠에 나나** — 밝은 자리에 두고 등을 켜서 **빨리** 자라게 한다.
            여기서 재는 것은 「잎 두 장·세 장이 됐을 때 말이 뜨나」이지 「며칠인가」가 아니다.
   ⚠ 그러니 아래 표의 「걸음」은 **달력 날짜가 아니다.**
============================================================ */
import { launch, sleep } from './test_cdp.mjs';
import { SCRIPTS, QUEST_OPEN_SCRIPT, QUEST_DONE_SCRIPT } from '../src/game/dialogue.js';
import { FIRST_PLAY_CHAIN_IDS, questOf } from '../src/game/quest.js';

const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
let bad = 0, seen = 0;
const ok = (name, cond, got) => {
  seen++;
  console.log(`${cond ? '  OK' : 'FAIL'}  ${name}${got == null || got === '' ? '' : '  → ' + got}`);
  if (!cond) bad++;
};
/* 별표(굵게)를 뗀다 — 화면은 `<b>` 로 그리고 textContent 에는 별표가 안 남는다 */
const plain = s => String(s).replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();

const page = await launch({ width: 390, height: 844, dpr: 2, mobile: false });
const errs = [];
page.on(m => {
  if (m.method === 'Runtime.exceptionThrown')
    errs.push((m.params.exceptionDetails.exception || {}).description || m.params.exceptionDetails.text);
});
await page.goto(`${BASE}/game.html`);
await page.eval(`localStorage.clear()`, false);          // ⚠ goto 뒤에 (START-HERE §2.9)
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 180000, 300);
await page.waitFor('window.__byeotBooted === true', 180000, 300);
await sleep(6000);

/* ══ ★★★ 받아 적는 자 — **화면에 실제로 뜬 글자만** ════════════════════════
   ⚠ `#dlgSkip` 을 누르지 않는다. 건너뛰면 `dlg.skip()` 이 끝으로 점프해서
     중간 줄이 **한 번도 안 그려진다** — 그러면 「화면이 말했다」를 못 잰다. */
const shown = [];
async function drain(max = 400) {
  for (let i = 0; i < max; i++) {
    const raw = await page.eval(`(()=>{ const s=document.getElementById('stage');
      if(!s || !s.classList.contains('talking')) return null;
      const w=document.getElementById('dlgWho'), t=document.getElementById('dlgText');
      return JSON.stringify({ who:((w&&w.textContent)||'').trim(),
                              text:((t&&t.textContent)||'').trim() }); })()`);
    if (!raw) break;
    const o = JSON.parse(raw);
    if (o.text && (!shown.length || shown[shown.length - 1].text !== o.text)) shown.push(o);
    await page.eval(`(()=>{const b=document.getElementById('dlgBox'); if(b) b.click();})()`, false);
    await sleep(80);
  }
  /* 가이드 판이 떠 있으면 닫는다 — 대사와 다른 창이라 따로 걷는다 */
  await page.eval(`(()=>{const g=document.getElementById('guideClose'); if(g) g.click();})()`, false);
  await sleep(120);
}
const said = () => shown.map(l => l.text);
/* 그 대사가 **통째로** 화면에 떴나 — 줄이 하나라도 빠지면 거짓이다 */
function onScreen(scriptId) {
  const lines = SCRIPTS[scriptId];
  if (!lines || !lines.length) return false;
  const pool = said();
  return lines.every(l => pool.includes(plain(l.text)));
}

const freeHands = () => page.eval(`(()=>{const S=window.__S(); if(S.stamina) S.stamina.usedToday=0;})()`, false);
const click = (id) => page.eval(`(()=>{const b=document.getElementById('${id}');
  if(!b||b.disabled) return false; b.click(); return true;})()`);
/* 동작(걸어가기+모션)이 끝날 때까지. ⚠ 하단 막대로 재면 안 된다(START-HERE §2.9-⑥) */
const waitAct = async (ms = 15000) => {
  const t0 = Date.now();
  const acting = () => page.eval(`(()=>{ try { return !!window.__byeotWalkSfx().acting; } catch { return false; } })()`);
  for (let i = 0; i < 6; i++) { if (await acting()) break; await sleep(120); }
  while (Date.now() - t0 < ms) { if (!(await acting())) { await sleep(200); return true; } await sleep(200); }
  return false;
};
/* 시루 줄의 단추 — `#siruList [data-act=…]`. 아래 단추(`#waterCrop`)는 말풍선이 같은 말을
   하면 감춰지므로 그것만 누르는 자는 아무것도 못 누른다(START-HERE §2.9-⑥). */
const rowAct = async (act, cap = 8) => {
  let n = 0;
  for (let k = 0; k < cap; k++) {
    await freeHands();
    const hit = await page.eval(`(()=>{ const b=[...document.querySelectorAll(
      '#siruList button[data-act="${act}"]')].find(x=>!x.disabled); if(!b) return false; b.click(); return true; })()`);
    if (!hit) break;
    n++; await waitAct(); await sleep(400); await drain();
  }
  return n;
};
const nextDay = async () => { await freeHands(); await click('next'); await sleep(900); await drain(); };
/* ★★ **모주에 물을 준다.** ⚠ 이걸 빼면 ⑦⑧ 이 영영 안 온다 — 마른 날은 유효 생장일로
   안 세어져서 잎이 안 난다(START-HERE §2.9-⑥ 이 같은 함정을 이미 적어 두었다).
   이 자를 처음 돌렸을 때 **116일을 굴렸는데 잎이 1장 그대로**였다. 실측으로 잡았다.
   ⚠ 안 보이는 단추는 안 누른다 — `display:none` 인 것을 누르면 판이 통째로 잠긴다
     (`probe_cutting_ui §clickIfShown` 의 그 사고). 콩나물 물과 **다른 단추**다. */
const waterMother = async () => {
  await freeHands();
  const on = await page.eval(`(()=>{ const e=document.getElementById('waterPot');
    return !!e && e.style.display !== 'none' && !e.disabled; })()`);
  if (!on) return false;
  await click('waterPot'); await waitAct(); await sleep(300); await drain();
  return true;
};
const snap = async () => JSON.parse(await page.eval(`(()=>{ const S=window.__S();
  const b=(S.firstPlay&&S.firstPlay.beansprout)||{}, v=window.__questView();
  return JSON.stringify({ day:S.day, sirus:(b.pots||[]).length, harv:b.harvestCount||0,
    pots:S.pots.length, leaves:(window.__questSnap()||{}).motherLeaves,
    done:v.done, next:v.next&&v.next.id }); })()`));

/* ── 시루를 끌어 어두운 자리에 놓는다 (실제 손짓과 같은 길) ───────────────
   ⚠ `#cropThumb` 은 **가방을 열어야 생긴다** — 2026-08-10 에 카드에서 가방 격자 칸으로
     옮겨 갔고(game.html:1930 · 8834), 그 칸은 `drawBag` 이 그릴 때 노드가 새로 난다.
     안 열고 부르면 `null.src` 로 터진다(이 자를 처음 돌렸을 때 실제로 그랬다). */
const dragSiruTo = async (slotId) => {
  /* ⚠ 한 번 열고 바로 묻지 않는다 — `drawBag` 이 칸을 그리기 전에 물으면 없다고 나온다.
     ★ **생길 때까지 기다린다.** 이 자를 처음 돌렸을 때 700ms 로는 모자랐다(실측).
   ⚠⚠ **`tab('bag')` 만으로는 다시 안 그린다.** 열려 있는 시트에서 칸만 바꾸면
     `drawBag` 이 안 돌아 **직전에 그린 HTML 이 그대로 남는다** — 두 번째 시루를 넣고
     열었더니 가방이 「콩 씨앗 ×37」(옛 값)을 그린 채 시루 칸이 없었다. 살아 있는 상태는
     `siru: 4` 였다. **재는 자가 옛 화면을 읽고 「가방에 시루가 없다」고 답한 것**이다
     (START-HERE §2.9-⑥ 과 같은 결). ⇒ **닫았다 열고 다시 그리게 한다.** */
  let has = false;
  for (let i = 0; i < 20 && !has; i++) {
    await page.eval(`(()=>{ try{ window.__byeotSheet.close(); }catch{} })()`, false);
    await sleep(200);
    await page.eval(`(()=>{ try{ window.__redraw && window.__redraw();
      window.__byeotSheet.open(); window.__byeotSheet.tab('bag'); }catch{} })()`, false);
    await sleep(400);
    has = await page.eval(`!!document.getElementById('cropThumb')`);
  }
  if (!has) {
    console.log('   ⚠ 가방 상태 — ' + await page.eval(`(()=>{ const s=document.getElementById('sheet');
      return JSON.stringify({ sheet: s ? s.className : null, slots: document.querySelectorAll('.bagslot').length,
        imgs: [...document.querySelectorAll('img[id]')].map(e=>e.id).join(','),
        talking: document.getElementById('stage').className,
        bag: [...document.querySelectorAll('.bagslot')].map(e=>e.outerHTML.slice(0,200)),
        S: (()=>{const S=window.__S(); const b=(S.firstPlay&&S.firstPlay.beansprout)||{};
             return { day:S.day, pots:S.pots.length, sirus:(b.pots||[]).length,
                      bagKeys:Object.keys((S.bag&&S.bag.items)||S.bag||{}).join(','),
                      stock:JSON.stringify(S.shop&&S.shop.stock) };})(),
        guide: (document.getElementById('guide')||{}).className || null }); })()`));
  }
  await page.eval(`(()=>{
    const rv=window.__rv, c=document.getElementById('roomCanvas').getBoundingClientRect();
    const sp=rv.screenPosOf('${slotId}'), th=document.getElementById('cropThumb');
    if(!th) throw new Error('가방에 시루 칸이 없다');
    window.__drag.begin('beansprout', th.src, {clientX:c.left+c.width*0.9, clientY:c.top+40});
    window.__drag.move({clientX:c.left+sp.x, clientY:c.top+sp.y}); window.__drag.end(); })()`, false);
  await sleep(1200);
  await page.eval(`(()=>{ try{ window.__byeotSheet.close(); }catch{} })()`, false);
  await sleep(300); await drain();
};

console.log('\n══ A. 켠 첫 순간 — ①이 열려 있나 · 화면이 그리나 ══════════════');
await drain();                                   /* 오프닝(intro) */
const bootLines = shown.length;
{
  const s = await snap();
  ok('A-1 첫 순간에 ①이 열려 있다 (할 일 창 쪽)', s.next === 'place_siru', `지금 할 일 ${s.next}`);
  ok('A-2 ★★★ **화면 대사 상자에 글자가 떴다** (오프닝이 실제로 그려졌다)',
     shown.length > 0, `${shown.length}줄`);
  /* ★ 여기서는 **재기만 한다.** 「떠야 한다/뜨면 안 된다」를 이 자리에서 못 박지 않는다 —
     `checkQuests` 를 부르는 자리가 여섯인데 **부팅은 그중에 없다**(game.html 실측:
     자르기·하루넘김·수확 둘·거래). 그러니 ① 은 첫 손짓 뒤에 말한다. 판정은 §C 가 한다. */
  console.log(`   · 켠 순간 ① 열림 대사 — ${onScreen('questPlaceSiru') ? '떴다' : '아직 안 떴다'}` +
              ` (부팅 때는 checkQuests 가 안 돈다)`);
}

console.log('\n══ B. 사슬을 실제로 밟는다 ════════════════════════════════════');
/* ① 놓기 */
await dragSiruTo('banjiha-dresser:1');
await page.eval(`(()=>{ const S=window.__S(); S.shop.stock.bean_seed = 40; })()`, false);
await page.eval(`window.__byeotSheet.open('plants')`, false); await sleep(500); await drain();
await rowAct('plant');                      /* 놓기 → 심기 두 걸음(2026-08-16) */
await nextDay();
/* ② 물 → ③ 수확 → ④ 다시 심기 를 회전이 돌 때까지 */
for (let i = 0; i < 40; i++) {
  await rowAct('water'); await rowAct('harvest'); await rowAct('sow');
  const s = await snap();
  if (s.done.includes('resow_siru')) break;
  await nextDay();
}
/* ⑤ 시루를 하나 더 */
await page.eval(`(()=>{ const S=window.__S(); S.shop.stock.siru = 4; S.shop.stock.bean_seed = 40;
  if (S.tutorial) S.tutorial.cashWon = Math.max(S.tutorial.cashWon, 200000); })()`, false);
await dragSiruTo('banjiha-dresser:0'); await sleep(1200); await drain();
await rowAct('plant'); await rowAct('water'); await nextDay();
/* ⑥ 몬스테라가 올 때까지 굴린다 */
for (let i = 0; i < 60; i++) {
  const s = await snap();
  if (s.pots > 0) break;
  await rowAct('water'); await rowAct('harvest'); await rowAct('sow');
  await nextDay();
}
{
  const s = await snap();
  ok('B-1 몬스테라가 왔다', s.pots > 0, JSON.stringify(s));
}
/* ⑥ 밝은 자리로 옮긴다 — 사람이 쓰는 길(자리 고르개)로 */
await page.eval(`(()=>{ const s=document.getElementById('slot'); if(!s) return false;
  s.value='banjiha-sill:0'; s.dispatchEvent(new Event('change',{bubbles:true})); return true; })()`, false);
await sleep(1200); await drain();
/* ⑦⑧ 잎 둘·셋 — ★ 등을 켜서 **빨리** 자라게 한다(끈 것 ⓒ). 며칠인가는 안 잰다 */
await page.eval(`(()=>{ const S=window.__S();
  S.lamps.count = 2; S.lamps.litHours = 14; if (S.tutorial) S.tutorial.lamp.owned = 2;
  window.__io.light.clearCache(); })()`, false);
for (let i = 0; i < 150; i++) {
  const s = await snap();
  if (s.done.includes('leaf_three')) break;
  await waterMother();                      /* ★ 이것이 빠지면 잎이 영영 안 난다 */
  /* 시루는 사흘에 한 번만 돌본다 — 여기서 재는 것은 모주의 잎이지 콩나물 회전이 아니다 */
  if (i % 3 === 0) { await rowAct('water', 2); await rowAct('harvest', 2); await rowAct('sow', 2); }
  await nextDay();
}

/* ★★ **꼬리를 마저 받아 적는다.** 사슬이 끝나는 그 걸음의 대사는 `commitNextDay` 가
   밥·가계부 연출을 지나 **조금 늦게** 밀어 넣는다 — 그 전에 `drain` 이 빠져나가면
   마지막 한 마디를 놓친다. 실제로 첫 판에서 `questDoneLeafThree` 하나만 안 잡혔다.
   ⚠ 이건 화면이 안 말한 것이 아니라 **재는 자가 일찍 본 것**이다(START-HERE §2.9-⑥). */
await sleep(1500); await drain();
await nextDay(); await sleep(1200); await drain();

console.log('\n══ C. ★★★ 열여섯 자리가 **화면에서** 말했나 ══════════════════');
const rows = [];
for (const id of FIRST_PLAY_CHAIN_IDS) {
  const o = QUEST_OPEN_SCRIPT[id], d = QUEST_DONE_SCRIPT[id];
  rows.push({ id, ko: (questOf(id) || {}).ko, open: o, done: d,
              openSaid: o ? onScreen(o) : false, doneSaid: d ? onScreen(d) : false });
}
for (const r of rows)
  console.log(`   ${r.openSaid ? '✓' : '·'} 열림 ${r.doneSaid ? '✓' : '·'} 완료   ${r.id} — ${r.ko}`);
/* ★ 안 뜬 것은 **어느 줄이 없었는지**까지 적는다. 「안 떴다」만으로는 다음 사람이
   「대사가 없다」와 「자가 놓쳤다」를 못 가른다 — 이 저장소가 제일 자주 헷갈리는 자리다. */
for (const r of rows) for (const [what, id] of [['열림', r.open], ['완료', r.done]]) {
  if (!id || (what === '열림' ? r.openSaid : r.doneSaid)) continue;
  const miss = SCRIPTS[id].filter(l => !said().includes(plain(l.text))).map(l => plain(l.text));
  console.log(`   ⚠ ${r.id} ${what}(${id}) — ${SCRIPTS[id].length}줄 중 ${miss.length}줄이 안 떴다: ${miss.join(' / ')}`);
}

const final = await snap();
ok('C-1 ★★ 사슬 여덟이 전부 끝났다', FIRST_PLAY_CHAIN_IDS.every(i => final.done.includes(i)),
   JSON.stringify(final));
ok('C-2 ★★★ **열림 대사 여덟이 전부 화면에 떴다**', rows.every(r => r.openSaid),
   rows.filter(r => !r.openSaid).map(r => r.id).join(' · ') || '여덟 다');
ok('C-3 ★★★ **완료 대사 여덟이 전부 화면에 떴다**', rows.every(r => r.doneSaid),
   rows.filter(r => !r.doneSaid).map(r => r.id).join(' · ') || '여덟 다');
ok('C-4 ★ 그날 한 화면에 같은 말이 두 번 안 났다',
   said().every((t, i) => i === 0 || said()[i - 1] !== t), `${shown.length}줄`);
/* ★★ 순서 — **열림이 완료보다 먼저** 떠야 한다. 뒤집히면 「다 했다」를 듣고 나서
   「이걸 해라」를 듣는다. `EVENT_ORDER` 가 `quest_done → quest_opened` 라서,
   한 줄이 **같은 걸음에 열리고 끝나면** 실제로 뒤집힌다(그 순서는 «①을 끝냈다 →
   그래서 ②가 열린다»를 위한 것이라 옳고, 뒤집히는 것은 그 옆의 자리다). */
{
  const at = t => said().indexOf(plain(t));
  const flipped = [];
  for (const id of FIRST_PLAY_CHAIN_IDS) {
    const o = QUEST_OPEN_SCRIPT[id], d = QUEST_DONE_SCRIPT[id];
    if (!o || !d || !onScreen(o) || !onScreen(d)) continue;
    if (at(SCRIPTS[o][0].text) > at(SCRIPTS[d][0].text)) flipped.push(id);
  }
  ok('C-6 ★★ 줄마다 **열림 대사가 완료 대사보다 먼저** 떴다',
     flipped.length === 0, flipped.join(' · ') || '여덟 다');
}
console.log(`   · 오프닝까지 ${bootLines}줄 · 그 뒤 ${shown.length - bootLines}줄`);
ok('C-5 ★ game.html 예외가 없다', errs.length === 0, `${errs.length}건 ${errs.slice(0, 2).join(' | ')}`);

console.log(`\n  화면에 뜬 대사 줄 ${shown.length}개 (달력 ${final.day}일)`);
if (process.env.BYEOT_DEBUG) for (const l of shown) console.log(`    ${l.who}: ${l.text}`);
console.log(bad ? `\n⛔ ${seen - bad}/${seen} 통과` : `\n★ ${seen}/${seen} 통과`);
await page.close();
process.exit(bad ? 1 : 0);
