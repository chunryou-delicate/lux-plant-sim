/* 「캐릭 이동 튜토가 없다」 — 정말 없나, 있는데 안 뜨나 (박사님 민원 ③)
   ⚠ `COACH_NOTES.walkTip` 은 2026-08-17 에 이미 들어와 있다. 그러니 물음은
     「없다」가 아니라 **「왜 안 보이나」**다. 뜨는 순간을 지켜본다. */
import { launch, sleep } from './test_cdp.mjs';
const _wd = setTimeout(() => { console.error('⏱ 자가 제한 초과'); process.exit(2); }, 400000);
_wd.unref && _wd.unref(); process.on('exit', () => clearTimeout(_wd));
const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const page = await launch({ width: 1280, height: 900, dpr: 1, mobile: false });
await page.goto(`${BASE}/game.html`);
await page.eval(`localStorage.clear()`, false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('window.__byeotBooted === true', 180000, 300);
await sleep(6000);
/* 쪽지가 뜨는 순간을 **놓치지 않게** 지켜본다 — 10초 뒤 저절로 사라지므로 나중에 물으면 늦다 */
await page.eval(`(()=>{ window.__coachLog = [];
  const el = document.getElementById('coach');
  new MutationObserver(() => { window.__coachLog.push({
    on: el.classList.contains('on'),
    글: (document.getElementById('coachTitle').textContent||'').slice(0,20) }); })
    .observe(el, { attributes:true, attributeFilter:['class'] });
  /* ⚠ coach() 는 **모듈 안의 지역 함수**다. window.__byeotCoach.show 를 바꿔 봐야
     안쪽 호출은 안 걸린다 — 그렇게 짰다가 「한 번도 안 불렸다」는 거짓 답을 받았다.
     ⇒ 여기서는 **화면(#coach 클래스)과 localStorage 자국**만 믿는다. */
})()`, false);
for (let i = 0; i < 40; i++) {
  const busy = await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');
    return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`);
  if (!busy) break;
  await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s)s.click();
    const b=document.getElementById('dlgBox'); if(b)b.click();
    const g=document.getElementById('guideClose'); if(g)g.click();})()`, false);
  await sleep(250);
}
/* 실제 손짓 — 시루를 끌어 놓고 [확인] 을 누른다(walkTip 이 걸린 자리다) */
await page.eval(`(()=>{ const rv=window.__rv, c=document.getElementById('roomCanvas').getBoundingClientRect();
  const sp=rv.screenPosOf('banjiha-sill:0');
  window.__drag.begin('beansprout','', {clientX:c.left+c.width*0.9, clientY:c.top+40});
  window.__drag.move({clientX:c.left+sp.x, clientY:c.top+sp.y}); window.__drag.end(); })()`, false);
await sleep(1400);
/* 실제 사람과 같은 차례 — 대사를 먼저 넘기고 나서 [확인] 을 누른다 */
for (let i = 0; i < 30; i++) {
  const busy = await page.eval(`document.getElementById('stage').classList.contains('talking')`);
  if (!busy) break;
  await page.eval(`(()=>{const b=document.getElementById('dlgBox'); if(b)b.click();})()`, false);
  await sleep(300);
}
await sleep(500);
console.log('확인 누르기 직전 —', await page.eval(`(()=>{const st=document.getElementById('stage');
  return JSON.stringify({ 말하는중: st.classList.contains('talking'),
                          confirming: st.classList.contains('confirming') });})()`));
await page.eval(`(()=>{const b=document.getElementById('placeOk'); if(b&&b.offsetParent)b.click();})()`, false);
/* walkTip 은 900ms 뒤에 불린다 — 그 앞뒤를 다 지켜본다 */
for (const t of [600, 1200, 2000, 4000]) {
  await sleep(t === 600 ? 600 : t - 600);
  console.log(`+${t}ms`, await page.eval(`JSON.stringify({
    말하는중: document.getElementById('stage').classList.contains('talking'),
    쪽지떴나: document.getElementById('coach').classList.contains('on'),
    본것: JSON.parse(localStorage.getItem('byeot.coach')||'[]'),
    바뀐기록: window.__coachLog })`));
}
await page.shot('docs/handoff/img/topcell/walktip.png');
await page.close();
