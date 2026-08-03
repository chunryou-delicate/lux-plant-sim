/* 폰 세로에서 대화 초상화가 실제로 몇 픽셀로 그려지는지 잰다.
   ★상자 크기가 아니라 **그림이 실제로 차지하는 크기**를 본다 —
     background-size:contain 이라 상자와 원본의 비율이 다르면 그림은 상자보다 작다. */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8971';
const SIZES = [[390, 844], [360, 780], [430, 932]];
for (const [w, h] of SIZES) {
  const page = await launch({ width: w, height: h, dpr: 2, mobile: true });
  await page.goto(`${BASE}/game.html`);
  await page.eval(`localStorage.removeItem('byeot/save/1')`, false);
  await page.goto(`${BASE}/game.html`);
  await page.waitFor('!!window.__byeotBooted', 90000, 300);
  await sleep(3500);
  const r = await page.eval(`(()=>{
    const g = id => document.getElementById(id);
    if (!g('stage').classList.contains('talking')) return { 대화중: false };
    const f = g('dlgFace').getBoundingClientRect();
    const b = g('dlgBox').getBoundingClientRect();
    const t = g('dlgText').getBoundingClientRect();
    /* 원본 비율로 실제 그려지는 크기를 낸다 (contain) */
    const AR = 600/800;
    const drawnH = Math.min(f.height, f.width / AR);
    const drawnW = drawnH * AR;
    return { 대화중: true, 화면: [innerWidth, innerHeight],
      상자칸: [Math.round(f.width), Math.round(f.height)],
      실제그림: [Math.round(drawnW), Math.round(drawnH)],
      화면대비: Math.round(drawnH / innerHeight * 100),
      글칸폭: Math.round(t.width),
      위로솟음: Math.round(b.top - (f.bottom - drawnH)),
      머리가천장밖: (f.bottom - drawnH) < 0 };
  })()`);
  console.log(`${w}x${h}`, JSON.stringify(r));
  await page.close();
}
