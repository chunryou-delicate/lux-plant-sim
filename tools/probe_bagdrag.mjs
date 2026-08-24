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

await page.close(); clearTimeout(wd);
