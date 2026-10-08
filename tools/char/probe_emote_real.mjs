/* 게임의 «진짜 길»(room_view.emote → v2_hero actClip → runClip)로 cheer·wave 를 틀고
   매 프레임 «몸짓 무게가 켜졌나»를 적는다 — 크레딧 0.

   2026-10-08 · [Char] · core 6ac5b754 가 emote 를 붙인 뒤
   ■ probe_emote_ingame.mjs 와 다른 점: 그것은 «내 믹서»로 틀었다. 이것은 게임 믹서·게임 루프 그대로다.
   ■ 재는 것: 그리는 프레임마다 (시각, 몸짓 무게 켜짐) — hero 메시의 onBeforeRender 를 감싸 «원래 것을 먼저 부르고» 적는다.
     ✔ 기대: 몸짓 동안 켜지고, 끝나 기본 자세로 돌아오면 꺼진다.

   쓰기   BYEOT_URL=http://localhost:9351 node tools/char/probe_emote_real.mjs [cheer|wave]
   나오는 것: stdout 한 줄 JSON + docs/handoff/img/bodytest/emote_real_<kind>_<mid|end>.png (사람 둘레)
*/
import { launch, sleep } from '../test_cdp.mjs';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.BYEOT_URL || 'http://localhost:8971';
const KIND = process.argv[2] || 'cheer';
const OUT = join('docs', 'handoff', 'img', 'bodytest');

async function main() {
  mkdirSync(OUT, { recursive: true });
  const page = await launch({ width: 1000, height: 800, dpr: 1 });
  try {
    await page.goto(`${BASE}/tools/room_view_demo.html?room=banjiha`);
    await page.waitFor('!!window.view', 120000, 200);
    await page.eval(`window.view.setContinuous(true)`);
    await page.eval(`window.view.setCharacter('jachwi').then(()=>1)`);
    await sleep(2500);
    const ok = await page.eval(`(()=>{
      let mesh = null; window.view.three.scene.traverse(o => { if (!mesh && o.isSkinnedMesh && o.userData.emoteSkin) mesh = o; });
      if (!mesh) return false;
      const orig = mesh.onBeforeRender, log = [];
      mesh.onBeforeRender = function () { const r = orig.apply(this, arguments); log.push([performance.now(), mesh.userData.emoteSkin() ? 1 : 0]); return r; };
      window.__er = { log, t0: null, t1: null, res: null };
      return true; })()`);
    if (!ok) { console.log(JSON.stringify({ err: '몸짓 무게를 건 hero 메시가 없다' })); return; }
    await page.eval(`(()=>{ const E = window.__er; E.t0 = performance.now();
      window.view.emote('jachwi', ${JSON.stringify(KIND)}).then(r => { E.res = r; E.t1 = performance.now(); }); return 1; })()`);
    const dur = KIND === 'wave' ? 5.37 : 2.97;
    await sleep(dur * 500);
    await page.eval(`window.view.redraw()`);
    await page.shot(join(OUT, `emote_real_${KIND}_mid.png`));
    await page.waitFor('window.__er.res !== null', 30000, 200);
    await sleep(1500);
    await page.eval(`window.view.redraw()`);
    await page.shot(join(OUT, `emote_real_${KIND}_end.png`));
    const r = await page.eval(`(()=>{ const E = window.__er, L = E.log.filter(x => x[0] >= E.t0 - 200);
      const during = L.filter(x => x[0] >= E.t0 && x[0] <= E.t1), after = L.filter(x => x[0] > E.t1 + 600);
      const on = during.filter(x => x[1]);
      return JSON.stringify({ kind: ${JSON.stringify(KIND)}, played: E.res, ms: Math.round(E.t1 - E.t0),
        frames_during: during.length, on_during: on.length,
        first_on_ms: on.length ? Math.round(on[0][0] - E.t0) : null, last_on_ms: on.length ? Math.round(on[on.length - 1][0] - E.t0) : null,
        frames_after: after.length, on_after: after.filter(x => x[1]).length,
        before: L.filter(x => x[0] < E.t0).map(x => x[1]).slice(-3) }); })()`);
    console.log(r);
  } finally { try { await page.close(); } catch {} }
}
main();
