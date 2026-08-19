/* [다음 날] 단추가 **해상도마다 실제로 눌리나** (박사님 민원 2026-08-18:
     *"해상도에 따라 하루 넘기기 버튼 클릭 오류 (pc)"*)
   ------------------------------------------------------------
   ⚠ 「보인다」와 「눌린다」는 다른 말이다. 여기서 재는 것은 **눌린다** 쪽이다 —
     그 자리 한가운데의 최상위 요소가 그 단추(또는 그 자손)인가를 묻는다.
     겹쳐 덮은 것이 있으면 눈에는 보이는데 손가락은 남의 것을 누른다. */
import { launch, sleep } from './test_cdp.mjs';
const _wd = setTimeout(() => { console.error('⏱ 자가 제한 초과'); process.exit(2); }, 900000);
_wd.unref && _wd.unref(); process.on('exit', () => clearTimeout(_wd));

const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
/* PC 에서 흔한 것들 + 세로 짧은 것(노트북) + 폰 하나(견주는 자) */
const SIZES = [[1920,1080],[1600,900],[1440,900],[1366,768],[1280,720],[1280,800],
               [1024,768],[1152,864],[800,600],[390,844]];
for (const [w, h] of SIZES) {
  const page = await launch({ width: w, height: h, dpr: 1, mobile: false });
  await page.goto(`${BASE}/game.html`);
  await page.eval(`localStorage.clear()`, false);
  await page.goto(`${BASE}/game.html`);
  await page.waitFor('window.__byeotBooted === true', 180000, 300);
  await sleep(6000);
  for (let i = 0; i < 40; i++) {
    const busy = await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');
      return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`);
    if (!busy) break;
    await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s)s.click();
      const b=document.getElementById('dlgBox'); if(b)b.click();
      const g=document.getElementById('guideClose'); if(g)g.click();})()`, false);
    await sleep(250);
  }
  /* ⚠ #next 는 시루를 놓기 전엔 disabled 다(§2.9). 놓고 나서 재야 참말이 나온다. */
  await page.eval(`(()=>{ const rv=window.__rv, c=document.getElementById('roomCanvas').getBoundingClientRect();
    const sp=rv.screenPosOf('banjiha-sill:0');
    window.__drag.begin('beansprout','', {clientX:c.left+c.width*0.9, clientY:c.top+40});
    window.__drag.move({clientX:c.left+sp.x, clientY:c.top+sp.y}); window.__drag.end(); })()`, false);
  await sleep(1200);
  await page.eval(`(()=>{const b=document.getElementById('placeOk'); if(b&&b.offsetParent)b.click();})()`, false);
  await sleep(1200);
  const r = await page.eval(`(()=>{
    const b = document.getElementById('next');
    const r = b.getBoundingClientRect();
    const cx = r.left + r.width/2, cy = r.top + r.height/2;
    const el = document.elementFromPoint(cx, cy);
    const who = el ? (el.id || el.className || el.tagName) : null;
    const mine = !!(el && (el === b || b.contains(el)));
    /* 네 귀퉁이도 본다 — 한가운데만 성하고 가장자리가 덮인 경우가 실제로 있다 */
    const corners = [[r.left+4,r.top+4],[r.right-4,r.top+4],[r.left+4,r.bottom-4],[r.right-4,r.bottom-4]]
      .map(([x,y]) => { const e = document.elementFromPoint(x,y); return !!(e && (e===b || b.contains(e))); });
    return JSON.stringify({
      화면:[innerWidth, innerHeight],
      단추:[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)],
      화면밖: r.right > innerWidth+0.5 || r.bottom > innerHeight+0.5 || r.left < -0.5 || r.top < -0.5,
      disabled: b.disabled, 보이나: !!b.offsetParent,
      한가운데눌리나: mine, 덮은것: mine ? null : who,
      귀퉁이: corners.filter(Boolean).length + '/4',
      /* ★ 덮은 것이 **정말 보이는 것**인가 — 안 보이는데 손가락만 먹는 상자면 그게 병이다 */
      덮은것상태: (() => { if (mine || !el) return null;
        const cs = getComputedStyle(el), rr = el.getBoundingClientRect();
        const st = document.getElementById('stage');
        return { display: cs.display, visibility: cs.visibility, opacity: cs.opacity,
                 pointerEvents: cs.pointerEvents, zIndex: cs.zIndex,
                 상자: [Math.round(rr.left),Math.round(rr.top),Math.round(rr.width),Math.round(rr.height)],
                 말하는중: !!(st && st.classList.contains('talking')),
                 글: (el.textContent||'').trim().slice(0,20) }; })()
    });
  })()`);
  console.log(`${String(w).padStart(4)}x${String(h).padStart(4)}`, r);
  await page.close();
}
