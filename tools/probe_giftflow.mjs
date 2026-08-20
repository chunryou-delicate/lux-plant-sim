/* 선물 몬스테라가 **어떻게 오나** (박사님 2026-08-20:
     *"몬스테라를 줄 때 가방에 템으로 들어와야 되는데 식물탭에 들어오잖아.
       템으로 들어오고 배치하면 식물탭에 생기는 것으로 해줘."*)
   ------------------------------------------------------------
   재는 것 넷:
     ① 도착이 **몇 바퀴째**에 나나 (규칙은 harvestCount:2)
     ② 도착한 순간 몬스테라 카드가 **어느 탭**에 있나 (가방 / 식물)
     ③ 그때 방에 이미 서 있나 (`placedOnce`·`slotId`·`at`)
     ④ 그날 대사가 **어떤 차례로** 큐에 들어가나 (`__dlgLog`)
   ⚠ 놓기 전과 놓은 뒤를 **갈라서** 잰다 — 안 가르면 「배치하면 식물탭에 생긴다」를 못 잰다. */
import { launch, sleep } from './test_cdp.mjs';
const _wd = setTimeout(() => { console.error('⏱ 자가 제한 초과'); process.exit(2); }, 900000);
_wd.unref && _wd.unref(); process.on('exit', () => clearTimeout(_wd));

const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const page = await launch({ width: 1280, height: 900, dpr: 1, mobile: false });
const errs = [];
page.on(m => { if (m.method === 'Runtime.exceptionThrown')
  errs.push((m.params.exceptionDetails.exception || {}).description || ''); });
await page.goto(`${BASE}/game.html`);
await page.eval(`localStorage.clear()`, false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('window.__byeotBooted === true', 180000, 300);
await sleep(6000);

const clear = async () => { for (let i = 0; i < 40; i++) {
  const b = await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');
    return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`);
  if (!b) return;
  await page.eval(`(()=>{const g=document.getElementById('guideClose'); if(g&&g.offsetParent){g.click();return;}
    const b=document.getElementById('dlgBox'); if(b)b.click();})()`, false);
  await sleep(220);
} };
await clear();

/* 어디에 있나 — 카드의 **부모**로 가른다. 화면이 실제로 어느 탭에 그렸나가 그것이다. */
const where = async () => JSON.parse(await page.eval(`(()=>{
  const c = document.getElementById('plantCard');
  const S = window.__S();
  const p = (S.pots || [])[0] || null;
  return JSON.stringify({
    카드부모: c ? (c.parentElement && c.parentElement.id) : null,
    카드보이나: !!(c && c.style.display !== 'none'),
    /* ★ [식물] 탭의 몬스테라 목록 — 「배치하면 식물탭에 생긴다」를 재는 자다 */
    식물목록: (() => { const b = document.getElementById('plantBox');
      return { 보이나: !!(b && b.style.display !== 'none'),
               줄수: document.querySelectorAll('#plantList > *').length }; })(),
    손가락: (() => { try { window.__byeotHint(); } catch {}
      const h = document.getElementById('hint');
      return h && h.classList.contains('on')
        ? (h.querySelector('.say') || {}).textContent : null; })(),
    바퀴: (S.firstPlay && S.firstPlay.beansprout && S.firstPlay.beansprout.harvestCount) || 0,
    도착: !!(S.firstPlay && S.firstPlay.monstera && S.firstPlay.monstera.arrived),
    그루: p ? { id: p.id, slotId: p.slotId || null, at: p.at ? '있다' : null,
                placedOnce: p.placedOnce === undefined ? '(칸 없음)' : p.placedOnce } : null,
    방에선것: (window.__rv ? window.__rv.plants().length : null),
    /* ★ 내 칸이 다른 칸과 **같은 크기**인가 — 눈으로는 모달·상세에 가려 못 가른다 */
    칸크기: [...document.querySelectorAll('#bagGrid .bagslot')].map(c => {
      const r = c.getBoundingClientRect();
      return ((c.querySelector('small') || {}).textContent || '?') +
             ' ' + Math.round(r.width) + 'x' + Math.round(r.height); }),
    가방칸: [...document.querySelectorAll('#bagGrid .bagcell, #bagGrid [data-buy], #bagGrid img')]
      .map(e => e.id || e.getAttribute('alt') || '').filter(Boolean).slice(0, 8)
  });
})()`));

/* 대사를 큐에 넣은 차례 — 화면이 아니라 **넣는 자리**에서 적힌 것을 읽는다(§__dlgLog) */
const dlg = async () => await page.eval(`(()=>{ try {
  return JSON.stringify((window.__dlgLog || []).slice(-14).map(d =>
    (d.who || '?') + ': ' + String(d.ko || d.text || '').replace(/\\s+/g,' ').slice(0, 34)));
} catch (e) { return '[]'; } })()`);

/* ── 2바퀴까지 굴린다 — 손가락이 시키는 그 손짓만 쓴다 ── */
const rowAct = async (act) => {
  for (let k = 0; k < 8; k++) {
    const hit = await page.eval(`(()=>{ const b=[...document.querySelectorAll(
      '#siruList button[data-act="${act}"]')].find(x=>!x.disabled); if(!b) return false; b.click(); return true; })()`);
    if (!hit) break;
    await sleep(1500); await clear();
  }
};
/* 시루를 놓는다 */
await page.eval(`(()=>{ const rv=window.__rv, c=document.getElementById('roomCanvas').getBoundingClientRect();
  const sp=rv.screenPosOf('banjiha-dresser:1');
  window.__drag.begin('beansprout','', {clientX:c.left+c.width*0.9, clientY:c.top+40});
  window.__drag.move({clientX:c.left+sp.x, clientY:c.top+sp.y}); window.__drag.end(); })()`, false);
await sleep(1400); await clear();
await page.eval(`(()=>{const b=document.getElementById('placeOk'); if(b&&b.offsetParent)b.click();})()`, false);
await sleep(1200); await clear();
await page.eval(`(()=>{const c=document.getElementById('coachClose'); if(c)c.click();})()`, false);
await page.eval(`(()=>{ const S=window.__S(); S.shop.stock.bean_seed = 9; })()`, false);
await page.eval(`window.__byeotSheet.open('plants')`, false); await sleep(500);

let arrivedAt = null;
for (let d = 0; d < 40 && !arrivedAt; d++) {
  await page.eval(`(()=>{const S=window.__S(); if(S.stamina) S.stamina.usedToday=0;})()`, false);
  await rowAct('plant'); await rowAct('water'); await rowAct('harvest'); await rowAct('sow');
  const w = await where();
  if (w.도착) { arrivedAt = w; break; }
  await page.eval(`(()=>{try{document.getElementById('next').click()}catch{}})()`, false);
  await sleep(1400); await clear();
}

/* ⚠ 손가락은 **가방을 연 판**에서도 재야 한다 — 다른 탭만 열어 놓고 재면
   「손가락이 없다」가 탭 탓인지 배선 탓인지 안 갈린다. */
await page.eval(`window.__byeotSheet.open('bag')`, false); await sleep(700);
const 가방연뒤 = await where();
console.log('■ 가방을 연 판 · 손가락 —', JSON.stringify(가방연뒤.손가락), '· 칸크기', JSON.stringify(가방연뒤.칸크기), '· 식물목록', JSON.stringify(가방연뒤.식물목록));
await page.shot('docs/handoff/img/gift/bag_hint.png');
console.log('■ 도착한 순간 (놓기 전)');
console.log('   ', JSON.stringify(arrivedAt || await where()));
console.log('■ 그날 대사 차례');
console.log('   ', await dlg());
await page.shot('docs/handoff/img/gift/arrive_before.png');

/* ── 놓아 본다 — 놓으면 식물탭으로 가나 ── */
await page.eval(`(()=>{ const rv=window.__rv, S=window.__S(), p=(S.pots||[])[0];
  const c=document.getElementById('roomCanvas').getBoundingClientRect();
  const sp=rv.screenPosOf('banjiha-sill:0');
  window.__drag.begin('monstera','', {clientX:c.left+c.width*0.9, clientY:c.top+40});
  window.__drag.move({clientX:c.left+sp.x, clientY:c.top+sp.y}); window.__drag.end(); })()`, false);
await sleep(1600); await clear();
await page.eval(`(()=>{const b=document.getElementById('placeOk'); if(b&&b.offsetParent)b.click();})()`, false);
await sleep(1400); await clear();
console.log('■ 놓은 뒤');
console.log('   ', JSON.stringify(await where()));
await page.shot('docs/handoff/img/gift/arrive_after.png');
console.log('■ 콘솔 예외', errs.length, errs.slice(0, 2).join(' | '));
await page.close();
