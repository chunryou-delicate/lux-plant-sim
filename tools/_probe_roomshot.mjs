/* 방만 띄워 시간을 바꿔 가며 찍는다 — playshot 은 시트가 방을 덮어 27/28 이 못 쓴다.
   D-2 「바닥 흰 얼룩」이 «빛»인지 «물건»인지 가른다: 해를 움직여 얼룩이 따라 움직이나. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { launch, sleep } from './test_cdp.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const OUT = path.join(ROOT, 'tools', '_out', 'roomshot');
fs.mkdirSync(OUT, { recursive: true });

const page = await launch({ width: 1100, height: 800, dpr: 1 });
try {
  /* ⚠⚠ localStorage 를 «먼저» 지운다. 화면 밝기는 밑값(1.5)을 localStorage 가 덮는데
     (room_view.js §BRIGHT_KEY), 앞서 돌린 값이 남아 있으면 **밑값을 잰 줄 알고 딴 값을 잰다.**
     그 파일 주석이 그 함정을 그대로 적어 뒀다: "고쳤는데 그대로다로 읽히면 그것을 먼저 의심하라". */
  await page.goto(`${BASE}/tools/room_view_demo.html?room=banjiha&engine=1`);
  try { await page.eval('localStorage.clear()', false); } catch {}
  await page.goto(`${BASE}/tools/room_view_demo.html?room=banjiha&engine=1`);
  await page.waitFor('window.view && window.view.slots && window.view.slots().length > 0', 120000, 300);
  await sleep(1200);
  try { await page.eval("document.getElementById('wide') && document.getElementById('wide').click(), true"); } catch {}
  /* ★ «어느 밝기에서 쟀는지»를 찍는다 — 안 적으면 다음 사람이 못 견준다 */
  try {
    const b = await page.eval("JSON.stringify({ api: (window.view&&window.view.brightness)?window.view.brightness():null, saved: localStorage.getItem('byeot.brightness') })");
    console.log('  화면 밝기 = ' + b);
  } catch { console.log('  화면 밝기 = (못 읽음)'); }
  await sleep(400);
  const shot = async (name) => {
    const clip = JSON.parse(await page.eval(`(() => {
      const r = document.getElementById('roomCanvas').getBoundingClientRect();
      return JSON.stringify({ x: r.left, y: r.top, width: r.width, height: r.height, scale: 2 });
    })()`));
    const r = await page.send('Page.captureScreenshot', { format: 'png', clip });
    const f = path.join(OUT, name + '.png');
    fs.writeFileSync(f, Buffer.from(r.data, 'base64'));
    console.log('  찍음 ' + name);
  };
  for (const d of [0.10, 0.30, 0.50, 0.75]) {
    await page.eval(`window.view.setDaylight(${d}), window.view.redraw(), true`);
    await sleep(700);
    await shot('bj_day' + String(Math.round(d * 100)).padStart(3, '0'));
  }
  console.log('산출: ' + OUT);
} finally { await page.close(); }
