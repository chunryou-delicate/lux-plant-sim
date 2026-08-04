/* 폰 세로에서 대화 초상화가 실제로 몇 픽셀로 그려지는지 잰다.
   ★상자 크기가 아니라 **그림이 실제로 차지하는 크기**를 본다 —
     background-size:contain 이라 상자와 원본의 비율이 다르면 그림은 상자보다 작다. */
import { launch, sleep } from './test_cdp.mjs';

/* ★자가 제한 — 재는 도구가 재는 대상보다 오래 살면 안 된다.
   이게 없어서 측정 하나가 21시간 매달려 있었다. 헤드리스 크롬은 무언가를
   기다리다 영영 안 끝나는 일이 실제로 생긴다. 시간은 환경변수로 늘릴 수 있다. */
const _WATCHDOG_MS = +(process.env.BYEOT_PROBE_TIMEOUT_MS || 300000);
const _wd = setTimeout(() => {
  console.error('⏱ 자가 제한 ' + Math.round(_WATCHDOG_MS / 1000) + '초를 넘겨 멈춥니다 — 재는 중에 멈춘 것입니다.');
  process.exit(2);
}, _WATCHDOG_MS);
/* ★타이머가 프로세스를 붙잡으면 안 된다 — unref 를 빠뜨려서
   재기를 다 끝낸 도구가 제한 시간까지 안 죽고 매달려 있었다(넣자마자 났다). */
_wd.unref && _wd.unref();
process.on('exit', () => clearTimeout(_wd));

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
