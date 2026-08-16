/* ============================================================
   tools/probe_lamphome_shot.mjs — **옮긴 등이 화면에 실제로 그렇게 서 있나** (G-16)
   ------------------------------------------------------------
   숫자(DLI)는 `probe_lampmovehome.mjs` · `probe_lamphome.mjs` 가 잰다.
   여기서 재는 것은 **화면**이다 — 이 저장소의 계율이 「고쳤다」를 화면 확인 없이
   못 쓰게 한다(START-HERE §2).

     ① 3D 노드가 데이터와 같은 자리에 있나 (계산과 화면이 안 갈렸나)
     ② 등을 켠 방 사진 — docs/handoff/img/midlamp/lamphome_after.png

     python tools/serve.py 8963
     BYEOT_URL=http://localhost:8963 node tools/probe_lamphome_shot.mjs
============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { launch, sleep } from './test_cdp.mjs';

const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const OUT = path.resolve('docs/handoff/img/midlamp');
fs.mkdirSync(OUT, { recursive: true });

const page = await launch({ width: 900, height: 900, dpr: 2, mobile: false });
const errs = [];
page.on(m => {
  if (m.method === 'Runtime.exceptionThrown')
    errs.push((m.params.exceptionDetails.exception || {}).description || m.params.exceptionDetails.text);
});
await page.goto(`${BASE}/game.html?engine=1&room=banjiha`);
await page.waitFor('!!window.__rv && !!window.__io && !!window.__io.light', 180000, 300);
await sleep(2500);

/* ⚠ 첫 대사가 방을 절반 덮는다 — 「건너뛰기」를 눌러 치운다.
   안 치우면 사진에 방이 안 보이고, 그걸 「확인했다」로 쓰면 그게 거짓말이다. */
for (let i = 0; i < 6; i++) {
  const done = await page.eval(`(() => {
    const b = [...document.querySelectorAll('button,a,div')]
      .find(e => /건너뛰기/.test(e.textContent || '') && e.offsetParent);
    if (b) { b.click(); return 'skip'; }
    const dlg = document.querySelector('#dialogue, .dialogue, #dlg');
    if (dlg && dlg.offsetParent) { dlg.click(); return 'tap'; }
    return 'none';
  })()`);
  if (done === 'none') break;
  await sleep(700);
}
await sleep(1200);

/* 등을 켠다 — 산 개수를 2 로 두면 방이 둘 다 켠다(game.html fillLamps) */
await page.eval(`(() => { const S = window.__S && window.__S();
  if (S) { S.lamps.count = 2; S.lamps.litHours = 12; }
  if (window.__rv && window.__rv.setLampsOn) window.__rv.setLampsOn(2);
  return true; })()`);
await sleep(1200);

const info = await page.eval(`(() => {
  const rv = window.__rv, L = window.__io.light;
  const rig = (L.room.growRigs || []).find(r => r.uid === 'banjiha-growlight-bar');
  const sill = (L.room.slots || []).find(s => s.slotId === 'banjiha-sill:0');
  /* 3D 쪽 — 방뷰가 그 등을 어디에 그렸나 */
  let node = null;
  try { const l = (rv.lightRigs ? rv.lightRigs() : []).find(r => r.uid === 'banjiha-growlight-bar');
        node = l ? { x: l.x, y: l.y, z: l.z } : null; } catch (e) { node = 'ERR ' + e.message; }
  return JSON.stringify({ data: rig ? { x: rig.pos.x, y: rig.pos.y, z: rig.pos.z } : null,
                          view: node, sill: sill ? { x: sill.x, y: sill.y, z: sill.z } : null });
})()`);
console.log('\n① 데이터 ↔ 화면 자리\n' + info);

const clip = JSON.parse(await page.eval(`(() => {
  const c = document.getElementById('roomCanvas'); if (!c) return 'null';
  const r = c.getBoundingClientRect();
  return JSON.stringify({ x: r.left, y: r.top, width: r.width, height: r.height, scale: 2 });
})()`));
if (clip) {
  const r = await page.send('Page.captureScreenshot', { format: 'png', clip });
  const f = path.join(OUT, 'lamphome_after.png');
  fs.writeFileSync(f, Buffer.from(r.data, 'base64'));
  console.log('\n② 사진: ' + f);
}
console.log(`\n예외 ${errs.length}건` + (errs.length ? '\n  ' + errs.join('\n  ') : ''));
await page.close();
