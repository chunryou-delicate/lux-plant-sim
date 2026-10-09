/* 방 화면에서 새 주인공(hero2 · ?hero2=1)이 실제로 서고 · 걷고 · 물 주고 · 몸짓하는가 — 크레딧 0.

   2026-10-09 · [Char] · 기본(hero.glb)은 안 바꾼 채 «켜서» 본다.
   잰 것:
     ① 어느 파일을 받았나(네트워크) · hero 메시 정점 수(hero2 27,621 · hero 25,478)
     ② 발바닥 — 클립마다 잰 바닥 보정(characters().ground) · 서 있을 때 발 높이
     ③ 걷기 — walkTo 로 1.2m 걸어 끝까지 가나 · 걸린 시간
     ④ 물주기 — actAt(창턱 자리, 'water') 가 끝나나(onDone) · 실패 이유
     ⑤ 환호 — emote('jachwi','cheer') 가 다 틀렸나
     ⑥ 콘솔 예외 0
   쓰기  BYEOT_URL=http://localhost:9351 node tools/char/probe_hero2_ingame.mjs [--base]   (--base: hero2 끄고 같은 걸음 — 견줌용)
*/
import { launch, sleep } from '../test_cdp.mjs';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.BYEOT_URL || 'http://localhost:8971';
const OFF = process.argv.includes('--base');
const OUT = join('docs', 'handoff', 'img', 'bodytest');

async function main() {
  mkdirSync(OUT, { recursive: true });
  const page = await launch({ width: 1000, height: 800, dpr: 1 });
  const errs = [], net = [];
  page.on((m, p) => {
    if (m === 'Runtime.exceptionThrown') errs.push(String(p.exceptionDetails && (p.exceptionDetails.exception && p.exceptionDetails.exception.description || p.exceptionDetails.text)).slice(0, 200));
    if (m === 'Network.requestWillBeSent' && /assets\/v2\/char\//.test(p.request.url)) net.push(p.request.url.split('/').pop());
  });
  const R = {};
  try {
    await page.goto(`${BASE}/tools/room_view_demo.html?room=banjiha${OFF ? '' : '&hero2=1'}`);
    await page.waitFor('!!window.view', 120000, 200);
    await page.eval(`window.view.setContinuous(true)`);
    await page.eval(`window.view.setCharacter('jachwi').then(()=>1)`);
    await sleep(3000);
    R.file = [...new Set(net)];
    R.mesh = JSON.parse(await page.eval(`JSON.stringify((()=>{ let n=0, v=0; window.view.three.scene.traverse(o=>{ if(o.isSkinnedMesh){ n++; v=o.geometry.attributes.position.count; } }); return {skinned:n, verts:v}; })())`));
    const ch = () => page.eval(`JSON.stringify(window.view.characters().find(c=>c.id==='jachwi'))`).then(JSON.parse);
    const c0 = await ch();
    R.stand = { y: +c0.pos.y.toFixed(4), hipsY: c0.hipsY, ground: c0.ground && { y: c0.ground.y, target: c0.ground.target } };
    // ③ 걷기
    const t0 = Date.now();
    /* ⛔ walkTo 는 «화면 좌표»를 받는다(test_roomview_walk 와 같이) — 첫 판은 월드 좌표를 넘겨 두 몸 다 즉시 거절됐다 */
    R.walk = JSON.parse(await page.eval(`(async()=>{ const f = window.view.characterScreenPos('jachwi'); const c0 = window.view.characters().find(c=>c.id==='jachwi').pos;
      for (const [dx,dy] of [[0,90],[0,-90],[110,0],[-110,0],[80,80],[-80,-80]]) {
        const r = await window.view.walkTo('jachwi', f.x + dx, f.y + dy);
        if (r && r.ok) {
          /* walkTo 는 «출발»을 바로 돌려준다 — 걸음이 멎을 때까지 기다린다(최대 15초) */
          const tw = performance.now(); await new Promise(res => { const k = () => (!window.view.isWalking('jachwi') && performance.now() - tw > 300) || performance.now() - tw > 15000 ? res() : setTimeout(k, 100); k(); });
          const c1 = window.view.characters().find(c=>c.id==='jachwi').pos;
          return JSON.stringify({ ok: true, dx, dy, moved: +Math.hypot(c1.x-c0.x, c1.z-c0.z).toFixed(3) }); }
      } return JSON.stringify({ ok: false, why: '여섯 방향 다 못 감' }); })()`));
    R.walk.ms = Date.now() - t0;
    await sleep(500);
    // ④ 물주기 — 창턱 자리
    R.water = JSON.parse(await page.eval(`new Promise(res => { const t0 = performance.now();
      try { window.view.actAt('banjiha-sill:0', 'water', { onDone: () => res(JSON.stringify({ ok: true, ms: Math.round(performance.now()-t0) })),
                                                           onFail: w => res(JSON.stringify({ ok: false, why: String(w) })) }); }
      catch (e) { res(JSON.stringify({ ok: false, why: 'throw ' + e.message })); }
      setTimeout(() => res(JSON.stringify({ ok: false, why: 'timeout 40s' })), 40000); })`));
    await sleep(800);
    await page.eval(`window.view.redraw()`);
    await page.shot(join(OUT, `hero2_ingame_${OFF ? 'base' : 'h2'}_after_water.png`));
    // ⑤ 환호
    R.cheer = await page.eval(`window.view.emote('jachwi','cheer').then(r=>String(r))`);
    const c1 = await ch();
    R.groundClips = c1.ground && c1.ground.clips;
    R.errors = errs;
  } finally { try { await page.close(); } catch {} }
  console.log(JSON.stringify(R, null, 1));
}
main();
