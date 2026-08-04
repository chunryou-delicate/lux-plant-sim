/* 폰에서 안내판의 설명·테두리가 실제 버튼 자리에 맞나.
   ★박사님: "가이드 버튼이나 지정하는 위치가 좀 안 맞더라". 눈이 아니라 픽셀로 잰다. */
import { launch, sleep } from './test_cdp.mjs';

/* ★자가 제한 — 재는 도구가 재는 대상보다 오래 살면 안 된다.
   이게 없어서 측정 하나가 21시간 매달려 있었다. 헤드리스 크롬은 무언가를
   기다리다 영영 안 끝나는 일이 실제로 생긴다. 시간은 환경변수로 늘릴 수 있다. */
const _WATCHDOG_MS = +(process.env.BYEOT_PROBE_TIMEOUT_MS || 300000);
const _wd = setTimeout(() => {
  console.error('⏱ 자가 제한 ' + Math.round(_WATCHDOG_MS / 1000) + '초를 넘겨 멈춥니다 — 재는 중에 멈춘 것입니다.');
  process.exit(2);
}, _WATCHDOG_MS);
process.on('exit', () => clearTimeout(_wd));

const BASE = process.env.BYEOT_URL || 'http://localhost:8971';
for (const [w, h] of [[390, 844], [360, 780], [430, 932]]) {
  const page = await launch({ width: w, height: h, dpr: 2, mobile: false });
  await page.goto(`${BASE}/game.html`);
  await page.eval(`localStorage.clear()`, false);
  await page.goto(`${BASE}/game.html`);
  await page.waitFor('!!window.__byeotBooted', 120000, 300);
  await sleep(4000);
  await page.eval(`(()=>{try{document.getElementById('dlgSkip').click()}catch{}})()`, false);
  await sleep(1200);
  await page.eval(`(()=>{try{document.getElementById('guideOpen').click()}catch{}})()`, false);
  await sleep(800);
  const r = await page.eval(`(()=>{
    const gv = document.getElementById('guide');
    if (!gv.classList.contains('on')) return { 열림: false };
    const holes = [...gv.querySelectorAll('.ghole')].map(h => h.getBoundingClientRect());
    const tips  = [...gv.querySelectorAll('.gtip')].map(t => ({ r: t.getBoundingClientRect(), s: t.innerText.replace(/\s+/g,' ').trim() }));
    /* 테두리가 실제 대상 위에 있나 — 그 자리 한가운데의 최상위 요소가 대상인지 본다 */
    const wrong = [];
    holes.forEach((b, i) => {
      const cx = b.left + b.width/2, cy = b.top + b.height/2;
      const el = document.elementFromPoint(cx, cy);
      if (!el) wrong.push({ i, why: '화면 밖', box: [Math.round(b.left), Math.round(b.top)] });
    });
    const off = [];
    holes.forEach((b,i) => { if (b.left < 0 || b.top < 0 || b.right > innerWidth || b.bottom > innerHeight)
      off.push({ i, box: [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)] }); });
    const tipOff = tips.filter(t => t.r.left < 0 || t.r.right > innerWidth || t.r.top < 0 || t.r.bottom > innerHeight)
                       .map(t => ({ s: t.s.slice(0,14), box: [Math.round(t.r.left), Math.round(t.r.right)] }));
    /* 설명과 그 테두리의 거리 — 너무 멀면 무엇을 가리키는지 안 보인다 */
    const far = [];
    tips.forEach((t,i) => { const b = holes[i]; if (!b) return;
      const d = Math.hypot((t.r.left+t.r.width/2)-(b.left+b.width/2), (t.r.top+t.r.height/2)-(b.top+b.height/2));
      if (d > 120) far.push({ s: t.s.slice(0,14), 거리: Math.round(d) }); });
    return { 열림:true, 화면:[innerWidth,innerHeight], 테두리:holes.length, 설명:tips.length,
             테두리가화면밖: off, 설명이화면밖: tipOff, 대상없음: wrong, 너무멂: far };
  })()`);
  console.log(`${w}x${h}`, JSON.stringify(r));
  await page.shot(`docs/engine/shots/guide_${w}.png`);
  await page.close();
}
