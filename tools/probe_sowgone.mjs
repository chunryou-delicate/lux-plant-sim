/* ============================================================
   tools/probe_sowgone.mjs — **씨앗 심기 버튼이 옮기기 뒤에 사라진다** (H-3 · 2026-08-16)
   ------------------------------------------------------------
     python tools/serve.py 8963
     BYEOT_URL=http://localhost:8963 node tools/probe_sowgone.mjs

   박사님: *"씨앗 심기 전 옮기기 하면 씨앗 심기 버튼이 사라져 버려."*

   ★ FIXLIST §H-3 이 짚어 둔 처방을 그대로 잰다 — **짐작을 재는 것이지 고치는 것이 아니다.**
     ① 옮긴 뒤 `window.__picked` 의 `mode`·`confirming` 을 찍는다
     ② [확인]을 누른 뒤 그 둘이 풀리는지 본다
     ③ `window.__marks.busy()`(=`stageBusy()`) 가 참인 동안 말풍선이 몇 개인지 센다
   ⚠ `stageBusy()` 를 그냥 느슨하게 하지 마라 — 끌고 있는 중에 말풍선이 뜨면 손이 겹친다.
============================================================ */
import { launch, sleep } from './test_cdp.mjs';

const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const page = await launch({ width: 390, height: 844, dpr: 2, mobile: false });
const errs = [];
page.on(m => {
  if (m.method === 'Runtime.exceptionThrown')
    errs.push((m.params.exceptionDetails.exception || {}).description || m.params.exceptionDetails.text);
});
await page.goto(`${BASE}/game.html`);
await page.eval(`localStorage.clear()`, false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 180000, 300);
await page.waitFor('window.__byeotBooted === true', 180000, 300);
await sleep(4500);

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

const state = (label) => page.eval(`(()=>{
  const p = window.__picked || {};
  const st = document.getElementById('stage');
  const vis = (id)=>{ const e=document.getElementById(id);
    return e ? (getComputedStyle(e).display!=='none' && e.getBoundingClientRect().width>0) : null; };
  return JSON.stringify({
    slotId: p.slotId || null, mode: p.mode || null, confirming: !!p.confirming,
    busy: (()=>{ try { return window.__marks.busy(); } catch(e) { return 'ERR '+e.message; } })(),
    modelMarks: (()=>{ try { return window.__marks.list().map(m=>m.ko); } catch(e) { return 'ERR '; } })(),
    domMarks: [...document.querySelectorAll('#marks .mark')].map(m=>(m.textContent||'').trim()),
    stage: st.className,
    bar: { pickBar: vis('pickBar'), placeConfirm: vis('placeConfirm') },
    siruBtns: [...document.querySelectorAll('#siruList button[data-act]')].map(b=>b.dataset.act)
  });})()`).then(s => ({ label, ...JSON.parse(s) }));

const show = (s) => {
  console.log(`\n── ${s.label} ──`);
  console.log(`  picked : slotId=${s.slotId} mode=${s.mode} confirming=${s.confirming}`);
  console.log(`  stageBusy=${s.busy}   stage.class=«${s.stage}»`);
  console.log(`  말풍선(모델) ${JSON.stringify(s.modelMarks)}`);
  console.log(`  말풍선(화면) ${JSON.stringify(s.domMarks)}`);
  console.log(`  확인바=${s.bar.placeConfirm}  시루단추 ${JSON.stringify(s.siruBtns)}`);
};

/* ── 시루 하나를 놓는다 (아직 심기 전이다 — 그게 박사님이 말한 그 상태다) ── */
await page.eval(`(()=>{ const S=window.__S();
  S.shop.stock.siru=(S.shop.stock.siru||0)+2; S.shop.stock.bean_seed=(S.shop.stock.bean_seed||0)+4; })()`, false);
const put = await page.eval(`(()=>{ const rv=window.__rv,
    c=document.getElementById('roomCanvas').getBoundingClientRect();
  const sp=rv.screenPosOf('banjiha-dresser:0'); if(!sp) return 'no-slot';
  window.__drag.begin('beansprout', document.getElementById('cropThumb').src,
                      {clientX:c.left+c.width*0.9, clientY:c.top+40});
  window.__drag.move({clientX:c.left+sp.x, clientY:c.top+sp.y}); window.__drag.end();
  return 'placed'; })()`);
console.log(`시루 놓기 → ${put}`);
await sleep(1600); await walk();
show(await state('① 놓은 직후 (아직 안 심었다)'));

/* ── 고르고 [옮기기] ── */
await page.eval(`(()=>{ const p=window.__picked; p.select('banjiha-dresser:0'); })()`, false);
await sleep(400);
show(await state('② 골랐다'));
await page.eval(`(()=>{const b=document.getElementById('pickMove'); if(b) b.click();})()`, false);
await sleep(500);
show(await state('③ [옮기기]를 눌렀다'));

/* ── 다른 자리로 옮긴다 ── */
const moved = await page.eval(`(()=>{ const rv=window.__rv,
    c=document.getElementById('roomCanvas').getBoundingClientRect();
  const sp=rv.screenPosOf('banjiha-dresser:1'); if(!sp) return 'no-slot';
  const ev=(x,y)=>({clientX:x, clientY:y, pointerId:1, button:0, bubbles:true});
  const cv=document.getElementById('roomCanvas');
  cv.dispatchEvent(new PointerEvent('pointerdown', ev(c.left+sp.x, c.top+sp.y)));
  cv.dispatchEvent(new PointerEvent('pointerup',   ev(c.left+sp.x, c.top+sp.y)));
  return 'tapped'; })()`);
console.log(`\n자리 찍기 → ${moved}`);
await sleep(900);
show(await state('④ 옮길 자리를 찍었다'));

/* ── [확인] ── */
await page.eval(`(()=>{const b=document.getElementById('placeOk'); if(b) b.click();})()`, false);
await sleep(900);
show(await state('⑤ ★★ [확인]을 눌렀다 — 여기서 심기 버튼이 살아 있어야 한다'));

/* ── 혹시 남아 있으면 무엇이 잡고 있나 ── */
await sleep(1500);
show(await state('⑥ 1.5초 더 기다렸다'));

console.log(`\n(예외 ${errs.length}건)`);
if (errs.length) console.log(errs.slice(0, 6).join('\n'));
await page.close();
process.exit(0);
