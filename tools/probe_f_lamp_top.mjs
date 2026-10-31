/* 총괄 F ② 자(core 11-01) — 식물등 위에는 화분이 안 올라간다
   판: tools/room_view_demo.html?room=banjiha&engine=1 (test_place_grid 와 같은 판)
   ㉮ 거치형 식물등(banjiha-growlight-stand) 머리 판 윗면을 쏘면 ok:false · 까닭 «식물등»
      (작업 전: 0.30×0.16 판이 «가구 윗면»으로 열려 ok:true — 화분이 등 위에 서고 반지름만큼 삐져나왔다 · test_place_grid R-1 1403/1408)
   ㉯ 같은 판 옆 바닥은 그대로 놓인다(바닥 판정은 안 건드렸다)
   ㉰ 머리 판 바로 밑 칸의 «윗면»(surfaceTopAt)이 등 머리가 아니라 바닥이다
   예외 0 */
import { launch, sleep } from 'file:///C:/Users/pc/Desktop/빛식물/lux-plant-sim/tools/test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9440';
let bad = 0; const ok = (c, m, d = '') => { console.log(`${c ? '  OK' : 'FAIL'}  ${m}${d ? '  → ' + d : ''}`); if (!c) bad++; };
const exc = [];
const page = await launch({ width: 390, height: 844, dpr: 2, mobile: false });
page.on((method, p) => { if (method === 'Runtime.exceptionThrown') exc.push(((p.exceptionDetails.exception && p.exceptionDetails.exception.description) || p.exceptionDetails.text || '').split('\n')[0].slice(0, 200)); });
await page.goto(`${BASE}/tools/room_view_demo.html?room=banjiha&engine=1`);
await page.waitFor('!!window.view', 120000, 200);
await sleep(1500);
const J = async (js) => JSON.parse(await page.eval(`(()=>{ try { return JSON.stringify((${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`));
const r = await J(`(() => {
  const v = window.view, ctx = v.three;
  let g = null; ctx.scene.traverse(o => { if (!g && o.userData && o.userData.uid === 'banjiha-growlight-stand') g = o; });
  if (!g) return { 없음: true };
  g.updateMatrixWorld(true);
  const h = (g.userData.size && g.userData.size.h) || 1.5;
  /* 머리 판(furniture_pastel growlight_stand panelL) — 국소 (0.28, h-0.12, 0) · 0.30×0.03×0.16 → 윗면 h-0.105
     팔(arm 0.34×0.05 · 국소 x -0.02~0.32 · 판 위 3cm)이 판 가운데를 덮으므로 팔 끝 너머(x 0.40)·팔 옆(z 0.05)을 쏜다 */
  const top = g.localToWorld(new THREE.Vector3(0.40, h - 0.105, 0.05));
  const rc = document.getElementById('roomCanvas').getBoundingClientRect();
  const sp = (w) => { const p = w.clone().project(ctx.cam); return { x: rc.left + (p.x * 0.5 + 0.5) * rc.width, y: rc.top + (-p.y * 0.5 + 0.5) * rc.height }; };
  const s = sp(top);
  const hit = v.surfaceAt(s.x, s.y, { potD: 0.202 });
  /* ㉯ 등 발치에서 방 안쪽(+x 0.6) 바닥 */
  const fl = g.localToWorld(new THREE.Vector3(0.75, 0, 0.0));
  const sf = sp(fl);
  const floor = v.surfaceAt(sf.x, sf.y, { potD: 0.202 });
  const st = v.surfaceTopAt ? v.surfaceTopAt(top.x, top.z) : null;
  return { top: { x: +top.x.toFixed(3), y: +top.y.toFixed(3), z: +top.z.toFixed(3) },
           hit: { ok: hit.ok, y: hit.y, onUid: hit.onUid, reason: hit.reason, surface: hit.surface },
           floor: { ok: floor.ok, onUid: floor.onUid, y: floor.y, reason: floor.reason },
           st };
})()`);
console.log('  잰 것', JSON.stringify(r));
ok(!r.없음 && !r.탈, '거치형 식물등을 찾았다', JSON.stringify(r).slice(0, 200));
const onLamp = r.hit && r.hit.ok && r.hit.onUid === 'banjiha-growlight-stand';
ok(!onLamp && /식물등/.test(String(r.hit && r.hit.reason)), '㉮ 등 머리 판 위는 못 놓는다 · 까닭 «식물등 위에는 못 놓습니다»', JSON.stringify(r.hit));
ok(!!(r.floor && r.floor.ok && !r.floor.onUid), '㉯ 등 옆 바닥은 그대로 놓인다', JSON.stringify(r.floor));
ok(!!(r.st && r.st.onUid !== 'banjiha-growlight-stand' && r.st.y < 0.1), '㉰ 머리 판 밑 칸의 윗면은 바닥(등 머리 아님)', JSON.stringify(r.st));
ok(exc.length === 0, '처리 안 된 예외 0', exc.slice(0, 3).join(' / '));
console.log(bad ? `probe_f_lamp_top: 빨강 ${bad}` : 'probe_f_lamp_top: 다 통과');
await page.close(); process.exit(bad ? 1 : 0);
