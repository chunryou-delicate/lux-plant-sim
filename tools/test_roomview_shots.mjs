/* ============================================================
   tools/test_roomview_shots.mjs — 방 뷰 데모를 실제로 찍는다
   ------------------------------------------------------------
     python tools/serve.py 8971
     node tools/test_roomview_shots.mjs [charsel walkprev walking …]

   docs/engine/shots/roomview3_*.png 로 남긴다.
   ★ 데모가 시나리오를 다 돌면 <title> 을 'DONE · …' 으로 바꾼다. 그걸 기다린 뒤
     한 번 더 쉬었다 찍는다 — GLB 가 늦게 붙으면 반쯤 빈 그림이 나온다.
============================================================ */
import { launch, sleep } from './test_cdp.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.BYEOT_URL || 'http://localhost:8971';
const OUT = path.join(ROOT, 'docs', 'engine', 'shots');

const SHOTS = process.argv.slice(2).filter(a => !a.startsWith('--'));
const WANT = SHOTS.length ? SHOTS : ['charsel', 'walkprev', 'walking'];

async function shoot(name, query, size) {
  const page = await launch({ width: size[0], height: size[1], dpr: 2, mobile: false });
  const errs = [];
  page.on((m, p) => { if (m === 'Runtime.exceptionThrown') errs.push(p.exceptionDetails.text); });
  await page.goto(`${BASE}/tools/room_view_demo.html?${query}`);
  try { await page.waitFor(`/^DONE/.test(document.title)`, 180000, 300); }
  catch (e) { console.log(`  ★ ${name}: 시나리오가 안 끝났습니다 — ${e.message}`); }
  /* 로딩이 끝나고 3~4초 기다렸다 찍는다(박사님 지시). idle·걷기가 실제로 돌아가야
     허수아비가 아닌 그림이 나온다. 걷는 그림은 도착해 버리기 전에 찍는다. */
  /* ★ 걷는 그림만 예외다. 여기서 3초를 더 기다리면 도착해 버려서
     "걷는 중"이 아니라 "서 있는" 그림이 된다 — 데모 쪽에서 이미 걷는 도중에 멈춰 뒀다. */
  const settle = name === 'walking' ? 0 : 3400;
  const t0 = Date.now();
  while (Date.now() - t0 < settle) { await sleep(90); await page.eval(`window.view && window.view.redraw()`, false); }
  await page.eval(`window.view && window.view.redraw()`, false);
  const file = path.join(OUT, `roomview3_${name}.png`);
  await page.shot(file);
  const info = await page.eval(`(()=>{ const v=window.view; if(!v) return null;
    return { sel: v.selectedCharacter(), chars: v.characters().map(c=>({id:c.id, walking:c.walking, sel:c.selected})),
             boot: v.bootTimings() }; })()`);
  console.log(`  ${name} → ${path.relative(ROOT, file)}   ${JSON.stringify(info && info.chars)} sel=${info && info.sel}`);
  if (errs.length) console.log(`  ★ 예외: ${errs.slice(0, 2).join(' | ')}`);
  await page.close();
}

const SIZE_PHONE = [390, 844];
for (const s of WANT) {
  console.log(`\n촬영: ${s}`);
  await shoot(s, `room=banjiha&shot=${s}&t=0.42`, SIZE_PHONE);
}
console.log('\n끝');
