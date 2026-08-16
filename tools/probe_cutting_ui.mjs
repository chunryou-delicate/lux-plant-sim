/* ============================================================
   tools/probe_cutting_ui.mjs — 삽수를 **실제로 눌러서** 되나
   ------------------------------------------------------------
   "코드가 있다"와 "눌러진다"는 다르다. tools/test_cutting_wiring.mjs 는 규칙과 값을 재고,
   여기는 헤드리스 크롬으로 game.html 을 띄워 **손가락이 하는 것과 같은 순서**로 누른다.

     ① 삽수 상자가 열리나 · 자를 마디가 뜨나
     ② [병에] 를 누르면 캐릭터가 걸어가 자르고 S.cuttings 에 하나가 생기나
     ③ 혹이 날 때까지 굴리면 ★말풍선이 뜨나 (안 뜨면 플레이어는 죽는 줄도 모른다)
     ④ [분갈이] 를 누르면 사는가 · 유리병이 돌아오나
     ⑤ [팔기] 를 누르면 지갑이 느는가

   ★ 부팅·시루 놓기·몬스테라 도착 경로는 tools/probe_growth_visible.mjs 를 그대로 따랐다.

     python tools/serve.py 8971 .   (다른 창에서)
     node tools/probe_cutting_ui.mjs
============================================================ */
import { launch, sleep } from './test_cdp.mjs';

/* ★자가 제한 — 재는 도구가 재는 대상보다 오래 살면 안 된다.
   ★ unref 를 빠뜨리면 다 재고도 제한 시간까지 프로세스가 안 죽는다(전에 당했다). */
const _WATCHDOG_MS = +(process.env.BYEOT_PROBE_TIMEOUT_MS || 420000);
const _wd = setTimeout(() => {
  console.error('⏱ 자가 제한 ' + Math.round(_WATCHDOG_MS / 1000) + '초를 넘겨 멈춥니다 — 재는 중에 멈춘 것입니다.');
  process.exit(2);
}, _WATCHDOG_MS);
_wd.unref && _wd.unref();
process.on('exit', () => clearTimeout(_wd));

const BASE = process.env.BYEOT_URL || 'http://localhost:8971';
const out = [];
const say = (ok, name, extra) => {
  out.push([ok, name, extra]);
  console.log(`${ok ? '✔' : '✘'} ${name}${extra ? ' — ' + extra : ''}`);
};

const page = await launch({ width: 390, height: 844, dpr: 2, mobile: false });
const errs = [];
page.on((m, p) => { if (m === 'Runtime.exceptionThrown')
  errs.push(p.exceptionDetails.text + ' ' + ((p.exceptionDetails.exception || {}).description || '')); });

await page.goto(`${BASE}/game.html`);
await page.eval('localStorage.clear()', false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 150000, 300);
await sleep(6000);
const click = (id) => page.eval(`(()=>{try{document.getElementById('${id}').click()}catch{}})()`, false);
const skipTalk = async () => {
  for (let i = 0; i < 14; i++) {
    const t = await page.eval(`document.getElementById('stage').classList.contains('talking')`);
    if (!t) break;
    await page.eval(`document.getElementById('dlgBox').click()`, false);
    await sleep(220);
  }
};
await click('dlgSkip'); await sleep(1000);
await click('guideClose'); await sleep(600);

/* ★ 보이지 않는 버튼은 절대 누르지 않는다.
   `display:none` 이어도 `.click()` 은 핸들러를 부르고, 거둘 때가 안 된
   수확 버튼을 누르면 game.html 이 판을 **통째로 잠그다**(hardLock=1).
   손가락으로는 일어날 수 없는 일이라 재는 쪽이 맞춰야 한다. */
const clickIfShown = async (id) => {
  const on = await page.eval(`(()=>{ const e=document.getElementById('${id}');
    return !!e && e.style.display !== 'none' && !e.disabled; })()`);
  if (on) { await click(id); return true; }
  return false;
};
/* 동작(걸어가기+모션)이 끝날 때까지 기다린다.
   ⚠⚠ 2026-08-16 — **하단 막대로 재면 안 된다.** 누른 자리에 말풍선이 있으면 진행은
     거기 그려지고 막대는 **아예 안 뜬다**(game.html §actBar). 그래서 이 자는 걷는 내내
     「안 바쁘다」고 답했고, 그 뒤 줄이 **일이 끝나기도 전에** 상태를 읽었다 —
     분갈이·팔기가 그래서 빨갰다(고장이 아니라 자가 일찍 본 것이다).
   ⇒ **하는 중인가**를 곧바로 묻는다(`__byeotWalkSfx().acting`). 그 값이 정본이다.
   ⚠ 시작이 한 틱 늦을 수 있으므로 **켜지는 것을 먼저 기다린 뒤** 꺼지는 것을 기다린다. */
const waitAct = async (ms = 15000) => {
  const t0 = Date.now();
  const acting = () => page.eval(`(()=>{ try { return !!window.__byeotWalkSfx().acting; }
    catch { return document.getElementById('actBar').style.display !== 'none'; } })()`);
  for (let i = 0; i < 6; i++) { if (await acting()) break; await sleep(120); }
  while (Date.now() - t0 < ms) {
    if (!(await acting())) { await sleep(250); return true; }
    await sleep(250);
  }
  return false;
};

/* ── 시루를 어두운 자리에 놓고 → **세 번** 거두면 몬스테라가 온다 ──
   (first_play.MONSTERA_ARRIVAL_RULE.harvestCount = 3)
   ⚠ 첫 플레이 중에는 상점 상자가 안 열려 [다시 심기] 버튼이 잠겨 있다
     (drawShop 이 firstPlay.completed 전에는 그 버튼을 안 열어 준다).
     여기서 재는 것은 **삽수 배선**이지 콩나물 회전이 아니므로 씨앗과 잠금만 풀어 놓고
     그 다음부터는 손으로 누르는 것과 같은 길로 간다. */
await page.eval(`(()=>{ const rv=window.__rv, c=document.getElementById('roomCanvas').getBoundingClientRect();
  const sp=rv.screenPosOf('banjiha-dresser:1');
  window.__drag.begin('beansprout', document.getElementById('cropThumb').src, {clientX:c.left+c.width*0.9, clientY:c.top+40});
  window.__drag.move({clientX:c.left+sp.x, clientY:c.top+sp.y}); window.__drag.end(); })()`, false);
await sleep(1200);
await page.eval(`(()=>{ const S=window.__S(); S.shop.stock.bean_seed = 9; })()`, false);

/* ★★ 2026-08-16 — **이 자가 낡아 있었다.** 40일을 굴려도 `beansprout.ageDays` 가 **0**이었다
   (재서 잡았다). 까닭: 2026-08-16 에 시루가 **놓기 → 심기 두 걸음**이 됐는데(`76d3145` —
   "씨앗이 자동으로 들어감 → 화분만 놓이게") 이 자는 놓기만 하고 **심기를 한 번도 안 눌렀다.**
   ⇒ 콩나물이 영영 안 자라고, 그래서 수확도 몬스테라 도착도 없었다.
   ⚠ 이건 코드 고장이 아니라 **재는 자가 옛 세상을 재고 있던 것**이다(START-HERE §2.9-④).
     [심기]는 이제 **놓인 시루 줄**에 붙는다(`#siruList [data-act="plant"]`). */
/* ★★ 시루 줄의 단추를 누른다 — `#siruList [data-act=…]`.
   아래 버튼(`#waterCrop`·`#harvestCrop`)은 **말풍선이 같은 말을 하면 감춰진다**(§markSays)
   므로 그것만 누르는 자는 아무것도 못 누른다. 줄 단추는 늘 거기 있다. */
const rowAct = async (act) => {
  let n = 0;
  for (let k = 0; k < 8; k++) {
    const hit = await page.eval(`(()=>{ const b=[...document.querySelectorAll(
      '#siruList button[data-act="${act}"]')].find(x=>!x.disabled); if(!b) return false; b.click(); return true; })()`);
    if (!hit) break;
    n++; await waitAct(); await sleep(500); await skipTalk();
  }
  return n;
};
await page.eval(`window.__byeotSheet.open('plants')`, false); await sleep(500);

for (let i = 0; i < 60; i++) {
  if (await page.eval(`window.__S().pots.length > 0`)) break;
  /* 손이 모자라 못 누르는 것은 이 검사의 대상이 아니다 — 재려는 것은 삽수 배선이다 */
  await page.eval(`(()=>{const S=window.__S(); if(S.stamina) S.stamina.usedToday=0;})()`, false);
  await rowAct('plant');              /* 놓기·심기 두 걸음(2026-08-16) — 심기가 따로다 */
  await rowAct('water');
  await rowAct('harvest');
  await rowAct('sow');                /* 거둔 시루를 그 자리에 다시 심는다 */
  await click('next'); await sleep(1000); await skipTalk();
  if (process.env.BYEOT_DEBUG) console.log('  boot', i, await page.eval(`(()=>{const S=window.__S();const b=S.firstPlay.beansprout;
    const one=(b.pots||[])[0]||{};
    return JSON.stringify({d:S.day,age:one.ageDays,sown:one.sown,n:b.harvestCount,pots:S.pots.length,lock:document.body.dataset.hardLock||''})})()`));
}
const arrived = await page.eval(`(()=>{ const S=window.__S(); return { day:S.day, pots:S.pots.length,
  completed: !!(S.firstPlay && S.firstPlay.completed) }; })()`);
say(arrived.pots > 0, '몬스테라가 도착했다', JSON.stringify(arrived));
if (!arrived.pots) { console.log('예외', JSON.stringify(errs.slice(0, 3))); await page.close(); process.exit(1); }

/* ── 모주를 밝은 자리로 · 등을 켜고 · 잎이 둘 이상이 될 때까지 굴린다 ──
   ★ 그냥 자를 수가 없다. 도착 개체는 45일이라 잎이 한 장이고,
     한 장짜리를 자르면 모주가 끝나므로 **초보에서는 규칙이 막는다.**
     이것도 재서 알아낸 것이다 — 배선이 틀린 게 아니라 아직 자를 때가 아니었다. */
await page.eval(`(()=>{ const S=window.__S();
  S.shop.stock.jar = 2; S.shop.stock.pot = 2;
  S.tutorial.cashWon = Math.max(S.tutorial.cashWon, 100000);
  S.lamps.count = 2; S.lamps.litHours = 14; S.tutorial.lamp.owned = 2;
  window.__io.light.clearCache(); })()`, false);
await page.eval(`(()=>{ const s=document.getElementById('slot'); s.value='banjiha-sill:0';
  s.dispatchEvent(new Event('change',{bubbles:true})); })()`, false);
await sleep(1500); await skipTalk();
/* ★ [30일 자동]은 첫 플레이가 끝나기 전에는 잠겨 있다 — [다음 날]로 밀어야 한다.
   자를 마디가 하나라도 살아나면 멈춘다(그 날이 곷 "삽수가 열리는 날"이다). */
/* ★★ 2026-08-16 — **모주에 물을 줘야 자란다.** 이 자는 [다음 날]만 눌렀고, 그래서
   기록에 「⏸ 흙이 말랐습니다 — 74일째」가 쌓이는 동안 잎이 한 장도 안 났다(재서 잡았다).
   마른 날은 **하루가 통째로 안 세어진다**(state.js §몬스테라 물주기) — 규칙대로다.
   ⚠ `#waterPot` 는 말풍선이 같은 말을 하면 감춰지고 `canWater` 가 아니면 잠긴다.
     여기서 재려는 것은 물주기가 아니라 **삽수 배선**이라 잠금만 풀고 누른다. */
const waterPotNow = async () => {
  const hit = await page.eval(`(()=>{ const b=document.getElementById('waterPot');
    if(!b) return false; b.disabled=false; b.style.display=''; b.click(); return true; })()`);
  if (hit) { await waitAct(); await sleep(350); await skipTalk(); }
};
let openedOnDay = null;
for (let d = 0; d < 150; d++) {
  const on = await page.eval(`(()=>[...document.querySelectorAll('#cutNodes [data-cut]')].some(x=>!x.disabled))()`);
  if (on) { openedOnDay = await page.eval(`window.__S().day`); break; }
  await page.eval(`(()=>{const S=window.__S(); if(S.stamina) S.stamina.usedToday=0;})()`, false);
  await waterPotNow();
  await click('next'); await sleep(560); await skipTalk();
  if (d % 10 === 9) {
    await page.eval(`(()=>{ window.__byeotSheet.open(); window.__byeotSheet.tab('room'); })()`, false);
    await sleep(300);
    if (process.env.BYEOT_DEBUG) console.log('  grow', d, await page.eval(`(()=>{const S=window.__S();
      let ls=null; try{ls=window.__io.growth.leafStats()}catch{}
      return JSON.stringify({d:S.day, leaves:ls&&ls.leaves,
        btns:[...document.querySelectorAll('#cutNodes [data-cut]')].filter(x=>!x.disabled).length})})()`));
  }
}
say(openedOnDay != null, '★자를 마디가 생겼다 — 모주가 잎을 한 장 더 낸 뒤에야 열린다',
    openedOnDay != null ? ('Day ' + openedOnDay + ' 에 열렸다') : '150일을 밀어도 안 열렸다');

/* ── ① 삽수 상자 ────────────────────────────────────────────────────────
   ★ 재고는 상점에서 사야 하지만 배송 2일 + 돈이 필요하다. 여기서 재는 것은 **배선**이라
     주문 경로(shop.js 검사가 이미 본다) 대신 재고를 직접 채워 넣는다. */
await page.eval(`(()=>{ window.__byeotSheet.open(); window.__byeotSheet.tab('room'); })()`, false);
await sleep(500);
const box = await page.eval(`(()=>{ const b=document.getElementById('cutBox');
  const btns=[...document.querySelectorAll('#cutNodes [data-cut]')].map(x=>({node:x.dataset.cut,cont:x.dataset.cont,off:x.disabled}));
  return { shown: !!b && b.style.display !== 'none', rows: document.querySelectorAll('#cutNodes .cutRow').length,
           btns, hint: (document.getElementById('cutHint')||{}).textContent||'' }; })()`);
say(box.shown, '삽수 상자가 화면에 있다');
say(box.btns.length > 0 && box.btns.some(b => !b.off),
    '자를 마디에 [병에]/[흙에] 버튼이 살아 있다', JSON.stringify(box.btns.slice(0, 4)));
console.log('  안내 —', box.hint);
if (!box.btns.length) { console.log('예외', JSON.stringify(errs.slice(0, 3))); await page.close(); process.exit(1); }

/* ── ② 자르기 ── */
await page.eval(`(()=>{ window.__byeotSheet.close();
  const b=[...document.querySelectorAll('#cutNodes [data-cut]')].find(x=>x.dataset.cont==='jar' && !x.disabled);
  if (b) b.click(); })()`, false);
await waitAct(); await sleep(1200);                    /* 걸어가고 · 모션하고 · 게이지가 찬다 */
const cut = await page.eval(`(()=>{ const S=window.__S();
  const c=S.cuttings[0]||null;
  return { n:S.cuttings.length, id:c&&c.id, status:c&&c.status, cont:c&&c.container,
           leaves:c&&c.source.leaves, slot:c&&c.slotId, jar:S.shop.stock.jar,
           in3d: !!(c && window.__rv.plants().some(p=>p.potId===c.id)) }; })()`);
if (process.env.BYEOT_DEBUG) console.log('  cut-dbg', await page.eval(`(()=>{const S=window.__S();
  return JSON.stringify({log:(S.log||[]).slice(-6).map(x=>x.msg||x),
    err:[...document.querySelectorAll('#side .err')].slice(-2).map(e=>e.textContent),
    lock:document.body.dataset.hardLock||'',
    ev:(document.getElementById('event')||{}).textContent||'',
    btn: !!document.querySelector('#cutNodes [data-cut]')})})()`));
say(cut.n === 1 && cut.cont === 'jar', '[병에] 를 누르니 물꽂이 삽수가 하나 생겼다', JSON.stringify(cut));
say(cut.jar === 1, '유리병 재고가 하나 줄었다 (공짜로 안 나온다)', '남은 병 ' + cut.jar);
/* ══ ★★★ 2026-08-16 — **계약이 뒤집혔다** (박사님: *"드래그하기 전에 자동배치되면 안 되지"*)
   ------------------------------------------------------------
   여기 있던 두 줄은 「자른 순간 방에 서 있다」를 못 박고 있었다. 그것이 **고장이었다** —
   자를 때 게임이 빈 자리를 아무거나 골라 세우고 있었고, 박사님 화면에 화분이 저절로 늘었다.
   ⇒ 이제 재는 것은 **정반대**다: 자른 직후에는 **자리가 없어야** 하고, 가방 칸이 서야 하고,
     끌어 놓아야 비로소 방에 선다. 시루·화분과 같은 손버릇이다. */
say(!cut.slot && !cut.at, '★자른 직후에는 **자리를 안 받는다** (자동 배치를 안 한다)',
    JSON.stringify({ slot: cut.slot, at: cut.at }));
say(!cut.in3d, '★그래서 방에도 아직 안 선다');

/* ── ②-b 가방 칸이 서고 · 손잡이가 잡히나 ── */
await page.eval(`(()=>{ window.__byeotSheet.open('bag'); })()`, false);
await sleep(700);
const bagCell = await page.eval(`(()=>{ const el=document.querySelector('.bagslot[data-place^="cutting:"]');
  if(!el) return JSON.stringify({ cell:false });
  const img=el.querySelector('img'); const r=img?img.getBoundingClientRect():{width:0,height:0};
  return JSON.stringify({ cell:true, place:el.dataset.place,
    handle: Math.round(r.width)+'×'+Math.round(r.height), ko:(el.textContent||'').trim() }); })()`)
  .then(s => JSON.parse(s));
say(bagCell.cell, '★가방에 「자른 삽수」 칸이 선다', JSON.stringify(bagCell));
say(bagCell.cell && /^\d+×\d+$/.test(bagCell.handle) && parseInt(bagCell.handle) > 0,
    '★그 칸의 그림이 **크기를 갖는다** (숨은 그림에 손잡이가 걸리지 않았다)', bagCell.handle);

/* ── ②-c 끌어다 놓으면 방에 선다 ── */
const dropped = await page.eval(`(()=>{ const rv=window.__rv,
    c=document.getElementById('roomCanvas').getBoundingClientRect();
  const el=document.querySelector('.bagslot[data-place^="cutting:"]'); if(!el) return 'no-cell';
  const sp=rv.screenPosOf('banjiha-etagere:0') || rv.screenPosOf('banjiha-desk:0'); if(!sp) return 'no-slot';
  const img=el.querySelector('img'); const b=img.getBoundingClientRect();
  window.__drag.begin(el.dataset.place, img.src, {clientX:b.left+b.width/2, clientY:b.top+b.height/2});
  window.__drag.move({clientX:c.left+sp.x, clientY:c.top+sp.y}); window.__drag.end();
  return 'dropped'; })()`);
await sleep(1400);
const placed = await page.eval(`(()=>{ const S=window.__S(); const c=S.cuttings[0]||null;
  return JSON.stringify({ drop:'${dropped}', at: !!(c&&c.at), slot: c&&c.slotId,
    in3d: !!(c && window.__rv.plants().some(p=>p.potId===c.id)),
    stillInBag: !!document.querySelector('.bagslot[data-place^="cutting:"]') }); })()`)
  .then(s => JSON.parse(s));
say(placed.at || !!placed.slot, '★★끌어다 놓으면 **그때** 자리를 받는다', JSON.stringify(placed));
say(placed.in3d, '★그리고 방 화면에 선다 (말풍선·걸어가기가 이걸 탄다)');
say(!placed.stillInBag, '★놓은 뒤에는 가방 칸이 사라진다 (두 곳이 딴말 안 한다)');

/* ── ③ 혹이 날 때까지 굴린다 → 말풍선 ── */
await page.eval(`(()=>{ window.__byeotSheet.close(); })()`, false);
/* ★ [30일 자동]으로 밀면 **삽수가 그사이에 죽는다** — 혼(32일) 뒤 유예 16일이라
   60일을 통째로 넘기면 기한을 지나친다(실제로 그러고 사라졌다).
   하루씩 밀면서 **혼이 난 그 날에 멈춘다** — 손으로 하는 것과 같은 순서다. */
let nodeOnDay = null;
for (let d = 0; d < 45; d++) {
  if (await page.eval(`window.__S().cuttings.some(c=>c.status==='node')`)) { nodeOnDay = await page.eval(`window.__S().day`); break; }
  if (!(await page.eval(`window.__S().cuttings.length`))) break;      // 죽었거나 사라졌다
  await click('next'); await sleep(560); await skipTalk();
}
const node = await page.eval(`(()=>{ const S=window.__S(); const c=S.cuttings[0]||null;
  return { day:S.day, status:c&&c.status, days:c&&c.days, left:c&&c.deadlineDay!=null?c.deadlineDay-S.day:null,
           warned:c&&c.warned.length }; })()`);
say(node.status === 'node', '32일이 지나 혹이 났다 (분갈이 기한이 돈다)', JSON.stringify(node));
say((node.warned || 0) > 0, '★죽기 전에 경고가 나갔다', '경고 ' + node.warned + '회');

const marks = await page.eval(`(()=>{ const l=window.__marks.list();
  return { busy: window.__marks.busy(), list: l.map(m=>({key:m.key, ko:m.ko, tone:m.tone})),
           dom: [...document.querySelectorAll('#marks .mark')].map(e=>e.textContent) }; })()`);
say(marks.list.some(m => /분갈이|팔기/.test(m.ko)),
    '★말풍선이 분갈이(또는 팔기)를 알린다 — 남은 날짜까지', JSON.stringify(marks.list));
say(marks.dom.length > 0, '말풍선이 DOM 에 실제로 그려졌다', JSON.stringify(marks.dom));

/* ── ★파산 탈출구 — 포트를 못 사는 플레이어에게도 길이 남나 ──
   shop.js §파산이 "파산해도 막히지 않는다"를 약속했는데, 분갈이에 포트가 든다.
   포트를 못 사면 삽수가 죽는 것처럼 보이지만 — 혼 난 삽수는 **팔 수 있다**(12,000원).
   그 길을 말풍선이 실제로 말하는지를 여기서 본다. */
const potWas = await page.eval(`window.__S().shop.stock.pot||0`);
await page.eval(`(()=>{ window.__S().shop.stock.pot = 0; })()`, false);
const escape = await page.eval(`(()=>window.__marks.list().map(m=>({ko:m.ko,tone:m.tone})))()`);
await page.eval(`(()=>{ window.__S().shop.stock.pot = ${potWas}; })()`, false);
say(escape.some(m => /팔기/.test(m.ko)),
    '★포트가 없으면 말풍선이 [팔기] 로 바뀐다 (파산해도 안 막힌다)', JSON.stringify(escape));

/* ── ④ 말풍선을 눌러서 분갈이 ── */
const before = await page.eval(`window.__S().shop.stock.jar||0`);
await page.eval(`(()=>{ const e=[...document.querySelectorAll('#marks .mark')].find(x=>/분갈이/.test(x.textContent));
  if (e) e.click(); else { const b=document.querySelector('#cutList [data-repot]'); if (b) b.click(); } })()`, false);
await waitAct(); await sleep(1200);
const repot = await page.eval(`(()=>{ const S=window.__S(); const c=S.cuttings[0]||null;
  return { status:c&&c.status, cont:c&&c.container, deadline:c&&c.deadlineDay,
           jar:S.shop.stock.jar||0, pot:S.shop.stock.pot||0 }; })()`);
say(repot.status === 'established' && repot.deadline == null,
    '★[분갈이] 를 누르니 삽수가 살았다 (기한이 사라졌다)', JSON.stringify(repot));
say(repot.jar === before + 1, '유리병이 돌아왔다', `${before} → ${repot.jar}`);

/* ── ⑤ 팔기 ── */
await page.eval(`(()=>{ window.__byeotSheet.open(); window.__byeotSheet.tab('room'); })()`, false);
await sleep(600);
const cash0 = await page.eval(`window.__S().tutorial.cashWon`);
const sellBtn = await page.eval(`(()=>{ const b=document.querySelector('#cutList [data-sell]');
  if (!b) return null; const t=b.textContent; b.click(); return t; })()`);
await sleep(1500);
const sold = await page.eval(`(()=>{ const S=window.__S();
  return { n:S.cuttings.length, cash:S.tutorial.cashWon,
           in3d: window.__rv.plants().filter(p=>String(p.potId||'').startsWith('cut_')).length }; })()`);
say(!!sellBtn && sold.n === 0 && sold.cash > cash0,
    '★[팔기] 를 누르니 삽수가 팔리고 지갑이 늘었다',
    `${sellBtn} · ${cash0.toLocaleString()} → ${sold.cash.toLocaleString()}원`);
say(sold.in3d === 0, '판 삽수는 방에서도 사라졌다 (유령이 안 남는다)');

console.log('');
console.log('예외', JSON.stringify(errs.slice(0, 4)));
const fail = out.filter(r => !r[0]).length;
console.log(fail ? `${fail}건 실패` : '전부 통과');
await page.close();
process.exit(fail ? 1 : 0);
