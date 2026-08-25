/* ============================================================
   tools/probe_bagdrag.mjs — **가방 칸이 «끌리나»**
   ------------------------------------------------------------
   박사님 2026-08-25: *"인벤 몬스테라가 드래그가안됰"*
   ⚠ 되묻지 않고 «눌러서» 좁힌다. 갈래 셋 중 어느 것인지부터:
     ㉠ 잡히지도 않는다   ㉡ 잡히는데 안 놓인다   ㉢ 놓이는데 안 보인다
   ⇒ ★ 이 자는 ㉠ 을 «정확히» 가른다 — `bindDrag` 가 손잡이에 `draggable` 클래스를
     붙이기 때문이다(game.html:13516). 안 붙었으면 «끌기가 아예 안 걸린» 것이다.

   ★ 그리고 그 함수가 스스로 적어 둔 두 함정을 같이 본다:
     · 그림이 없으면 id 가 안 붙어 조용히 되돌아간다 ⇒ 칸을 손잡이로 삼는다
     · `display:none` 인 큰 카드 그림이 «살아 있어» $() 가 그걸 집는다 ⇒ 크기 0 이면 버린다
   ⇒ 그래서 **「걸렸나」만 보지 말고 「어디에 걸렸나」와 「그게 쓸 만한가」까지 본다.**

     python tools/serve.py 8972 .
     BYEOT_URL=http://localhost:8972 node tools/probe_bagdrag.mjs
============================================================ */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8972';
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 240000);
wd.unref && wd.unref();

const page = await launch({ width: 390, height: 844, dpr: 1 });
await page.goto(`${BASE}/game.html`);
await page.eval('localStorage.clear()', false);
await page.goto(`${BASE}/game.html`);
/* ⚠⚠⚠ **터치 흉내를 «켜야» 한다.** 안 켜면 `Input.dispatchTouchEvent` 가
   pointer 이벤트로 «안 바뀌고», 그러면 「터치에서 안 된다」가 **자 탓**이 된다.
   ⇒ ★ 오늘만 그 꼴을 여러 번 봤다 — 「판이 안 되는 것」과 「자가 못 재는 것」을 갈라야 한다. */
try {
  await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
  await page.send('Emulation.setEmitTouchEventsForMouse', { enabled: true, configuration: 'mobile' });
  console.log('■ 터치 흉내 — 켰다');
} catch (e) { console.log('⚠ 터치 흉내를 «못 켰다» —', e.message, '⇒ 아래 결과는 못 믿는다'); }
await page.waitFor('!!window.__rv', 150000, 300);
await sleep(4000);

/* ★ 가방에 물건을 «만들어 넣는다» — 판을 굴리지 않는다.
   ⚠ 값을 안 바꾼다. 「이 물건이 가방에 있으면 끌리나」만 본다. */
const seed = await page.eval(`(async()=>{ try{
  const S = window.__S();
  /* ① 화분 몇 가지 — 상점 재고로 넣는다(사는 길과 같은 자리) */
  const sh = S.shop || (S.shop = {});
  sh.stock = sh.stock || {};
  for (const id of ['pot','pot_terracotta','pot_ceramic','jar','sprout_tray','siru'])
    sh.stock[id] = (sh.stock[id] || 0) + 1;
  /* ② 삽수 하나 — 뿌리내린 것으로 세운다(가방 칸에 뜨는 조건) */
  S.cuttings = S.cuttings || [];
  S.cuttings.push({ id: 'cut_probe_01', container: 'jar', status: 'established',
                    variegated: true, nodeId: 'n1', leaves: 2, variegatedLeaves: 1,
                    startedOnDay: 1, slotId: null, at: null });
  window.__redraw();
  return JSON.stringify({ ok: true });
} catch(e){ return JSON.stringify({ err: e.message }); } })()`);
console.log('■ 가방 세우기 —', seed);

await page.eval(`window.__byeotSheet.open('bag')`, false);
await sleep(1200);

const rows = JSON.parse(await page.eval(`(()=>{ try{
  const out = [];
  for (const cell of document.querySelectorAll('.bagslot')) {
    const what = cell.getAttribute('data-place');
    const r = cell.getBoundingClientRect();
    const inner = cell.querySelector('.draggable');
    const self = cell.classList.contains('draggable');
    const img = cell.querySelector('img[id]');
    const ir = img ? img.getBoundingClientRect() : null;
    out.push({
      ko: (cell.querySelector('.nm')||{}).textContent || cell.getAttribute('title') || '?',
      what: what || null,
      cellSize: Math.round(r.width) + 'x' + Math.round(r.height),
      bound: self ? '칸' : (inner ? '그림' : null),
      imgId: img ? img.id : null,
      imgSize: ir ? (Math.round(ir.width) + 'x' + Math.round(ir.height)) : null,
      coming: cell.classList.contains('coming')
    });
  }
  return JSON.stringify(out);
} catch(e){ return JSON.stringify([{err:e.message}]); } })()`));

console.log('\n■ 가방 칸 — 「걸림」이 없으면 ㉠(잡히지도 않는다)');
let bad = 0;
for (const r of rows) {
  if (r.err) { console.log('  ✘', r.err); continue; }
  const ok = !!r.bound;
  if (r.what && !r.coming && !ok) bad += 1;
  console.log(`  ${ok ? '✔' : (r.coming ? '·' : '⛔')} ${String(r.ko).slice(0,14).padEnd(16)}` +
    ` place=${String(r.what).padEnd(22)} 칸 ${r.cellSize}` +
    ` · 걸림 ${r.bound || '«없음»'}` +
    (r.imgId ? ` · 그림 ${r.imgId} ${r.imgSize}` : ' · 그림 없음') +
    (r.coming ? ' (오는 중)' : ''));
}
console.log(`\n⇒ 놓을 수 있는데 «안 걸린» 칸 — ${bad}개`);

/* ══ ★★★ **터치로 눌러 본다** — 박사님은 «폰»으로 보고 계신다 ═══════════════
   PC(마우스)로는 위에서 다 걸렸다. 그러면 남은 것은 «터치»다.
   ★ 그런데 읽다가 하나 걸렸다:
     `bindDrag` 는 손잡이를 **`el`** 에 건다. `el` 은 대개 «그림(44×44)»이고 칸은 «80×76» 이다.
     그리고 `.draggable{touch-action:none}` 도 **그 그림에만** 걸린다.
     ⇒ ⇒ ★ 그러면 **칸 안이라도 그림 «밖»을 짚으면 아무 일도 안 난다.**
       손가락은 마우스보다 굵고, 폰에서 44px 은 작다.
   ⇒ ★★ 그래서 **두 점을 갈라 찍는다** — 그림 «한가운데»와 칸의 «귀퉁이».
     둘이 갈리면 그것이 답이다. */
const touchAt = async (x, y) => {
  const pt = [{ x, y, radiusX: 12, radiusY: 12, force: 1, id: 1 }];
  await page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt });
  await sleep(60);
  await page.send('Input.dispatchTouchEvent', { type: 'touchMove',
    touchPoints: [{ ...pt[0], x: x + 30, y: y - 30 }] });
  await sleep(60);
  /* ⚠ 판정 창구를 «넓게» 잡는다. 끌기가 두 길이라 하나만 보면 «자가 못 읽어»
     「안 잡혔다」로 나온다 — 오늘 그 꼴을 여러 번 봤다.
       ㉠ drag.on            — 방으로 끄는 길
       ㉡ #stage.placing     — 폰에서 「눌러서 놓기」로 들어간 길
       ㉢ .dragghost/미리보기 — 손에 붙은 그림 */
  const grabbed = await page.eval(`(()=>{ try{
    const d = window.__drag || {};
    const stage = document.getElementById('stage');
    const placing = !!(stage && stage.classList.contains('placing'));
    const ghost = !!document.querySelector('.dragghost, #dragGhost, .drag-preview');
    return JSON.stringify({ on: !!d.on, what: d.what || null, placing, ghost });
  } catch(e){ return JSON.stringify({err:e.message}) } })()`);
  await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(150);
  /* 「눌러서 놓기」로 들어갔으면 되돌린다 — 다음 칸 재기가 더러워진다 */
  await page.eval(`(()=>{ try{ const s=document.getElementById('stage');
    if (s && s.classList.contains('placing')) { document.body.click(); } } catch(e){} })()`, false);
  const g = JSON.parse(grabbed);
  return g;
};

console.log(String.fromCharCode(10) + '■ ★ 터치로 — 그림 한가운데 vs 칸 귀퍜이');


const targets = JSON.parse(await page.eval(`(()=>{
  const out = [];
  for (const cell of document.querySelectorAll('.bagslot[data-place]')) {
    const c = cell.getBoundingClientRect();
    const img = cell.querySelector('img[id]');
    const i = img ? img.getBoundingClientRect() : null;
    out.push({ ko: (cell.querySelector('.nm')||{}).textContent || '?',
               what: cell.getAttribute('data-place'),
               mid: i ? { x: Math.round(i.left + i.width/2), y: Math.round(i.top + i.height/2) } : null,
               corner: { x: Math.round(c.left + 8), y: Math.round(c.bottom - 8) } });
  }
  return JSON.stringify(out);
})()`));
for (const t of targets) {
  const a = t.mid ? await touchAt(t.mid.x, t.mid.y) : null;
  const b = await touchAt(t.corner.x, t.corner.y);
  const mark = (v) => v == null ? '–'
    : (v.err ? ('✘ ' + v.err)
      : (v.on || v.placing || v.ghost)
        ? ('✔ ' + [v.on ? 'drag' : '', v.placing ? 'placing' : '', v.ghost ? 'ghost' : ''].filter(Boolean).join('+'))
        : '⛔ 안 잡힘');
  const got = (v) => !!(v && !v.err && (v.on || v.placing || v.ghost));
  console.log(`  ${String(t.ko).slice(0,12).padEnd(14)} 그림 ${mark(a)} · 귀퉁이 ${mark(b)}` +
              (got(a) && !got(b) ? '   ← 갈린다' : ''));
}


/* ══ ★★★ **「눌러서 놓기」는 되나** — 이것이 흠의 «크기»를 정한다 ═══════════
   총괄 지적: 끄는 것은 안 되어도 «누르는» 길이 열려 있으면, 박사님은 «못 찾으신» 것이지
   «안 되는» 것이 아니다. ⇒ 그러면 고칠 것이 「드래그」가 아니라 «보이게 하는 것»이 된다.
   ⇒ ★ 그래서 «움직이지 않고» 짧게 톡 친다(touchStart → touchEnd). `pointerup` 이
     `moved` 를 거짓으로 보고 `onTap()` 을 부르는 길이 그것이다(game.html:13529). */
const tapAt = async (x, y) => {
  const pt = [{ x, y, radiusX: 12, radiusY: 12, force: 1, id: 1 }];
  await page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt });
  await sleep(80);
  await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(260);
  /* ⚠⚠⚠ 2026-08-25 정정 — **`#stage.placing` 은 톡 치기의 신호가 «아니다».**
     읽어 보니 `startPhonePlacePot` 은 「놓기 모드로 들어가는」 것이 아니라 **곧바로 놓는다**
     (`provisionalSpot()` 으로 자리를 «게임이» 정하고 `placeEmptyPot` 을 부른다).
     ⇒ ★ 그러니 앞서 낸 「톡 쳐서 놓기가 여섯 칸 전부 안 열린다」는 **자 탓**이었다.
       놓였는데 «내가 엉뚱한 곳을 봤다».
     ⇒ ⇒ ★★ 제대로 된 신호는 **「방에 물건이 늘었나」**다 — 화분 수·시루 수·삽수 자리. */
  const r = await page.eval(`(()=>{ try{
    const st = document.getElementById('stage');
    const sheet = document.getElementById('sheet');
    const S = window.__S();
    const fp = S.firstPlay || {};
    const sirus = (()=>{ try{ let n=0; for (const k of Object.keys(fp)) {
      const site = fp[k]; if (site && Array.isArray(site.pots))
        n += site.pots.filter(p=>p && (p.slotId||p.at)).length; } return n; } catch(e){ return -1 } })();
    return JSON.stringify({
      pots: (S.pots||[]).length,
      sirus,
      cutPlaced: (S.cuttings||[]).filter(c=>c && (c.slotId||c.at)).length,
      placing: !!(st && st.classList.contains('placing')),
      hint: ((document.getElementById('placeHint')||{}).textContent||'').replace(/\s+/g,' ').trim().slice(0,40),
      sheetOpen: !!(sheet && sheet.classList.contains('open'))
    });
  } catch(e){ return JSON.stringify({err:e.message}) } })()`);
  /* 되돌린다 — 다음 칸 재기가 더러워진다 */
  await page.eval(`(()=>{ try{ const s=document.getElementById('stage');
    if (s && s.classList.contains('placing')) { const c=document.getElementById('placeCancel');
      if (c) c.click(); else s.classList.remove('placing'); }
    window.__byeotSheet.open('bag'); } catch(e){} })()`, false);
  await sleep(500);
  return JSON.parse(r);
};

console.log(String.fromCharCode(10) + '■ ★★ 톡 쳐서 — 「눌러서 놓기」가 열리나 (이것이 흠의 크기를 정한다)');
for (const t of targets) {
  const p = t.mid || t.corner;
  const r = await tapAt(p.x, p.y);
  const ok = r && !r.err && r.placing;
  console.log(`  ${String(t.ko).slice(0,12).padEnd(14)} ${ok ? '✔ 열린다' : '⛔ 안 열린다'}` +
    (r && r.hint ? `  · 안내 「${r.hint}」` : '') + (r && r.err ? '  ✘ ' + r.err : ''));
}

console.log(String.fromCharCode(10) + '■ 손잡이가 «어디»에 붙었나 — 칸(80x76) 인가 그림(44x44) 인가');
console.log(await page.eval(`(()=>{
  const out = [];
  for (const cell of document.querySelectorAll('.bagslot[data-place]')) {
    const ko = ((cell.querySelector('.nm')||{}).textContent||'?').slice(0,12);
    const self = cell.classList.contains('draggable');
    const inner = cell.querySelector('.draggable');
    const r = (self ? cell : inner) ? (self ? cell : inner).getBoundingClientRect() : null;
    out.push('  ' + ko.padEnd(14) + (self ? 'CELL' : inner ? 'IMG ' : 'NONE') +
             (r ? '  ' + Math.round(r.width) + 'x' + Math.round(r.height) : ''));
  }
  return out.join(String.fromCharCode(10));
})()`));


/* ══ ★★★ **자를 먼저 시험한다** — 「터치가 아예 안 먹는 자」인지 가른다 ═══════════
   ⚠⚠ 위에서 「톡 쳐도 전부 안 열린다」가 나왔다. 그런데 그것이 «판»의 말인지
     «자»의 말인지 아직 모른다. ⇒ ★ 그래서 **틀림없이 되는 것**을 같은 손으로 눌러 본다.
     탭 단추가 터치로 안 눌리면 **자가 못 누르는 것**이고, 위 결과는 통째로 못 믿는다. */
console.log(String.fromCharCode(10) + '■ ★★★ 자 시험 — 틀림없이 되는 것을 같은 손으로 눌러 본다');
const ctl = JSON.parse(await page.eval(`(()=>{
  const b = document.getElementById('tabShop');
  if (!b) return JSON.stringify({ err: 'tabShop 없음' });
  const r = b.getBoundingClientRect();
  return JSON.stringify({ x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2) });
})()`));
if (ctl.err) console.log('  ✘', ctl.err);
else {
  await page.send('Input.dispatchTouchEvent', { type: 'touchStart',
    touchPoints: [{ x: ctl.x, y: ctl.y, radiusX: 12, radiusY: 12, force: 1, id: 1 }] });
  await sleep(80);
  await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(400);
  const sel = await page.eval(`(()=>{ const b=document.getElementById('tabShop');
    return b ? String(b.getAttribute('aria-selected')) : 'null'; })()`);
  console.log('  [상점] 탭을 터치로 눌렀다 ⇒ aria-selected =', sel,
    sel === 'true' ? '  ✔ 자는 터치로 누를 수 있다 — 위 결과를 믿어도 된다'
                   : '  ⛔ ★ 자가 터치로 못 누른다 — 위 결과는 «통째로» 못 믿는다');
  await page.eval(`window.__byeotSheet.open('bag')`, false); await sleep(400);
}


/* ══ ★★★ **그 점에서 «무엇이» 잡히나** — 덮인 것인지 가른다 ═══════════════════
   자가 터치로 [상점] 탭을 누를 수 있는 것은 확인했다(대조군 통과).
   그런데 가방 칸은 끌기도 누르기도 안 된다. ⇒ ★ 그러면 **손가락이 그 칸에 안 닿는** 것일 수 있다.
   ⇒ `document.elementFromPoint` 로 그 점에서 실제로 무엇이 잡히는지 본다.
     오늘 아침 「덮였나」를 재던 그 자와 같은 길이다. */
console.log(String.fromCharCode(10) + '■ ★★ 그 점에서 무엇이 잡히나 — 칸 자신이면 안 덮인 것이다');
console.log(await page.eval(`(()=>{
  const out = [];
  for (const cell of document.querySelectorAll('.bagslot[data-place]')) {
    const ko = ((cell.querySelector('.nm')||{}).textContent||'?').slice(0,12);
    const r = cell.getBoundingClientRect();
    const x = Math.round(r.left + r.width/2), y = Math.round(r.top + r.height/2);
    const hit = document.elementFromPoint(x, y);
    const inCell = !!(hit && cell.contains(hit));
    const tag = hit ? (hit.tagName.toLowerCase() + (hit.id ? '#' + hit.id : '') +
                       (hit.className && typeof hit.className === 'string'
                         ? '.' + hit.className.trim().split(/\s+/).slice(0,2).join('.') : '')) : 'null';
    out.push('  ' + ko.padEnd(14) + (inCell ? 'OK   ' : 'COVER') + '  ' + tag.slice(0, 46));
  }
  return out.join(String.fromCharCode(10));
})()`));


/* ══ ★★★★ **좌표를 «그때그때» 다시 읽고 다시 잰다** ═══════════════════════════
   ⚠⚠ 위 두 자리는 `targets` 를 **한 번 계산해 두고** 썼다. 그런데 그 사이에 시트를
     여닫았다 — 시트는 `transform` 으로 «미끄러진다». ⇒ ★ 오늘 아침 `settleSheet` 로
     겪은 그 병이다: **아직 미끄러지는 중에 찍으면 엉뚱한 자리를 짚는다.**
   ⇒ 그래서 다시 잰다 — **찍기 «직전»에 그 칸의 자리를 다시 읽고**, 시트가 멎었는지 보고. */
console.log(String.fromCharCode(10) + '■ ★★★★ 다시 — 자리를 그때그때 읽어서 (앞의 두 표는 못 믿는다)');
const settle = async () => {
  let last = null;
  for (let i = 0; i < 30; i++) {
    const t = await page.eval(`(()=>{const s=document.getElementById('sheet');
      return String(Math.round(s.getBoundingClientRect().top));})()`);
    if (t === last) return true;
    last = t; await sleep(100);
  }
  return false;
};
await page.eval(`window.__byeotSheet.open('bag')`, false);
await settle();
const names = JSON.parse(await page.eval(`(()=>JSON.stringify(
  [...document.querySelectorAll('.bagslot[data-place]')].map(c => c.getAttribute('data-place'))))()`));
for (const what of names) {
  await page.eval(`window.__byeotSheet.open('bag')`, false);
  await settle();
  const pt = JSON.parse(await page.eval(`(()=>{
    const c = document.querySelector('.bagslot[data-place="${what}"]');
    if (!c) return JSON.stringify({err:'칸 없음'});
    const h = c.querySelector('.draggable') || (c.classList.contains('draggable') ? c : null) || c;
    const r = h.getBoundingClientRect();
    const ko = ((c.querySelector('.nm')||{}).textContent||'?').slice(0,12);
    return JSON.stringify({ ko, x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2),
                            w: Math.round(r.width), h: Math.round(r.height) });
  })()`));
  if (pt.err) { console.log('  ✘', what, pt.err); continue; }
  const dragged = await touchAt(pt.x, pt.y);
  await page.eval(`window.__byeotSheet.open('bag')`, false); await settle();
  /* ★ 톡 치기는 「놓기 모드」가 아니라 «곧바로 놓기»다 ⇒ 「방에 물건이 늘었나」로 잰다 */
  const before = await tapAt(-1, -1);            /* 안 누르고 상태만 읽는다 */
  const tapped = await tapAt(pt.x, pt.y);
  const grew = (a, b) => b && a && !b.err && !a.err &&
    (b.pots > a.pots || b.sirus > a.sirus || b.cutPlaced > a.cutPlaced || b.placing);
  console.log(`  ${String(pt.ko).padEnd(14)} 손잡이 ${pt.w}x${pt.h} @${pt.x},${pt.y}` +
    `  · 끌기 ${dragged && dragged.on ? '✔ drag.on' : '⛔'}` +
    `  · 톡 ${grew(before, tapped) ? '✔ 놓였다' : '⛔'}` +
    (tapped && tapped.hint ? ` 「${tapped.hint}」` : ''));
}

await page.close(); clearTimeout(wd);
