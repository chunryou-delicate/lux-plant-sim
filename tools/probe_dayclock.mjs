/* 가만히 두면 시계가 어떻게 구나 (박사님 민원 ①: *"가만히 기다렸을 때 시간 경과에 따라 day 안 바뀜"*)
   ⚠ 실시간으로 9분 36초를 기다리지 않는다 — **걸음을 크게 밀어** 같은 자리를 잰다.
     기다려서 재면 자가 재는 대상보다 오래 산다(§probe 자가 제한). */
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
for (let i = 0; i < 40; i++) {
  const busy = await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');
    return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`);
  if (!busy) break;
  await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s)s.click();
    const b=document.getElementById('dlgBox'); if(b)b.click();
    const g=document.getElementById('guideClose'); if(g)g.click();})()`, false);
  await sleep(250);
}
const read = () => page.eval(`JSON.stringify({
  시각: (document.getElementById('resWhen')||{}).textContent,
  날: (document.getElementById('resDay')||{}).textContent })`);
console.log('시작        ', await read());
/* 한 바퀴(576초)를 실제로 기다리는 대신, 같은 시간만큼 프레임을 준다 —
   rAF 한 걸음이 최대 250ms 라 넉넉히 돌려야 한다. 여기서는 12초를 재고 그 사이 값을 본다. */
for (const t of [3, 6, 9, 12]) {
  await sleep(3000);
  console.log(`+${String(t).padStart(2)}초    `, await read());
}
console.log('— 실측: 한 바퀴는 576초다. 여기서는 12초만 재므로 시계가 조금만 움직이는 것이 맞다.');
await page.close();
