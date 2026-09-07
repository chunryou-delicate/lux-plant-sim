/* 맨몸 GLB 를 «네 각도»로 한 장에 찍는다 — 정면·좌측면·후면·3/4.
   ⛔ 왜 또 지었나 (2026-09-07 · 총괄)
     기존 shot 자들이 «스킨드 메시»의 크기를 뼈 상자로 잡아 ⇒ 사람이 «점»처럼 찍혔다([char] 실측).
     그리고 setPixelRatio(2) 가 캔버스 CSS 크기까지 키워 «왼쪽 위 1/4»만 찍힌 일도 있었다.
   ★ 그래서 _turn.html 은 «스킨을 적용한 정점»으로 상자를 잡고 dpr 을 1 로 못 박았다.

   쓰기
     node tools/char/shot_turn.mjs [GLB경로(assets/characters/ 기준)] [나갈.png]
   ⚠ 이 자가 «안» 하는 것
     · 그림이 «맞는지»는 안 본다. 찍고 나서 반드시 열어 봐라(61).
     · 클립을 안 얹는다. 가만히 선 몸만 본다. */
import { launch, sleep } from '../test_cdp.mjs';

const SRC = process.argv[2] || '_bodybase/char_yeoja_base_v3t_rigged.glb';
const OUT = process.argv[3] || 'docs/handoff/img/bodytest/turn_yeoja_v3t.png';
const BASE = process.env.BYEOT_URL || 'https://chunryou-delicate.github.io/lux-plant-sim';

const wd = setTimeout(() => { console.error('⏱ 제한'); process.exit(2); }, 180000);
wd.unref && wd.unref();

const page = await launch({ width: 2320, height: 940, dpr: 1 });
await page.goto(`${BASE}/assets/characters/_turn.html?src=${encodeURIComponent(SRC)}`);
await page.waitFor('window.__done === true', 120000, 400);

const err = await page.eval('window.__err');
if (err && err !== 'null') { console.error('⛔', err); process.exit(1); }
const box = await page.eval('JSON.stringify(window.__box)');
console.log('■ 상자', box);

await sleep(1200);
await page.shot(OUT);
console.log('✔ 찍음 →', OUT);
process.exit(0);
