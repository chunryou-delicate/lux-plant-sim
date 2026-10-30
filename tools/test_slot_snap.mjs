/* ============================================================
   tools/test_slot_snap.mjs — 화면 점 가까이의 빈 이름 자리(view.slotNearScreen · [house] · 2026-10-30 · 총괄 D90 #1)
   ------------------------------------------------------------
     BYEOT_URL=http://127.0.0.1:9330 node tools/test_slot_snap.mjs     (헤드리스 크롬 하나 · 폰 390×844)
   왜: 반지하 창턱 받침 둘레는 유리(광선이 지나감)·벽이라 surfaceAt 이 «벽에는 못 놓습니다»로 일찍 돌아가고 nearest 도 안 낸다.
       그래서 붙이기(game.html freePlace.snap · SNAP_PX 44)가 창턱에서 한 번도 안 걸리고, 폰에서 과녁이 받침 윗면(약 12×10px) 그대로였다
       (첫 플레이 두 판 · 종합 «고칠 차례» 4). core 가 그 갈래에서 이 손으로 붙인다.
   진짜 방 뷰(tools/room_view_demo.html?room=banjiha&engine=1)에서:
     A 창턱 자리 화면점에서 부르면 banjiha-sill:0 · 돌려주는 onUid·occIdx·maxPotD·pos 가 자리 표와 같다
     B 창턱 둘레 44px 안에 surfaceAt 이 ok:false(벽·유리)인 점이 있다 — 그 점에서 이 손은 창턱을 돌려준다
     C 넓이 — 44px 동그라미 안에서 «창턱에 놓이는 점»이 surfaceAt 만으로는 몇 px² · 이 손을 더하면 몇 px²
     D 44px 밖은 null · 안 들어가는 화분(지름 0.40 > 받침 0.27)은 창턱을 안 준다 · maxPx 를 줄이면 그만큼만
     E 찬 자리 — freeOnly(기본)면 빼고 except 면 넣는다(옮기는 화분의 원래 자리)
============================================================ */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9330';
const SHOT = process.env.SHOT || null;
let pass = 0, fail = 0;
const ok = (label, cond, extra = '') => { if (cond) { pass++; console.log(`PASS  ${label}`); } else { fail++; console.log(`FAIL  ${label}${extra ? '  — ' + extra : ''}`); } };
const J = v => JSON.stringify(v);
const SILL = 'banjiha-sill:0';

let stage = '크롬 띄우기', page = null;
try {
  page = await launch({ width: 390, height: 844, dpr: 1 });
  stage = '반지하 열기';
  await page.goto(`${BASE}/tools/room_view_demo.html?room=banjiha&engine=1`);
  for (let i = 0; i < 90; i++) { let t = ''; try { t = await page.eval('document.title'); } catch { /* 옛 문서가 사라지는 중 */ } if (/DONE/.test(String(t))) break; await sleep(400); }
  await sleep(1500);

  stage = 'A 자리 화면점';
  const A = await page.eval(`(() => { const v = window.view, c = document.getElementById('roomCanvas').getBoundingClientRect();
    const s = v.slots().find(x => x.slotId === '${SILL}'), sp = v.screenPosOf('${SILL}');
    const cx = c.left + sp.x, cy = c.top + sp.y;
    return { s, cx, cy, n: v.slotNearScreen(cx, cy, { potD: 0.2, except: s.occupied ? '${SILL}' : undefined }), canvas: { w: c.width, h: c.height } }; })()`);
  console.log('  창턱 자리', J(A.s), '화면', A.cx.toFixed(1), A.cy.toFixed(1), '캔버스', J(A.canvas));
  ok('A 창턱 자리 화면점에서 부르면 banjiha-sill:0 · 거리 0px', !!A.n && A.n.slotId === SILL && A.n.distPx <= 1, J(A.n));
  ok('A onUid banjiha-sill · occIdx 정수 · maxPotD·pos 가 자리 표와 같다',
     !!A.n && A.n.onUid === 'banjiha-sill' && Number.isInteger(A.n.occIdx) && A.n.maxPotD === A.s.maxPotD &&
     Math.abs(A.n.pos.x - A.s.pos.x) < 1e-9 && Math.abs(A.n.pos.y - A.s.pos.y) < 1e-9 && Math.abs(A.n.pos.z - A.s.pos.z) < 1e-9, J([A.n, A.s]));

  stage = 'B·C 44px 동그라미 훑기';
  const C = await page.eval(`(() => { const v = window.view, cx = ${A.cx}, cy = ${A.cy}, ex = ${A.s.occupied ? `'${SILL}'` : 'undefined'};
    let n = 0, onSill = 0, miss = 0, missToSill = 0, firstMiss = null, other = 0;
    for (let dy = -44; dy <= 44; dy += 2) for (let dx = -44; dx <= 44; dx += 2) {
      if (dx * dx + dy * dy > 44 * 44) continue;
      n++;
      const px = cx + dx, py = cy + dy, h = v.surfaceAt(px, py, { potD: 0.2 });
      const hitSill = !!(h && h.ok && (h.snappedTo === '${SILL}' || h.onUid === 'banjiha-sill'));
      if (hitSill) { onSill++; continue; }
      if (h && h.ok) { other++; continue; }
      miss++;
      const s = v.slotNearScreen(px, py, { potD: 0.2, except: ex });
      if (s && s.slotId === '${SILL}') { missToSill++; if (!firstMiss) firstMiss = { dx, dy, reason: h && h.reason, s }; }
    }
    return { n, onSill, other, miss, missToSill, firstMiss }; })()`);
  const px2 = k => k * 4;   // 2px 눈금 한 점 = 4px²
  console.log(`  44px 동그라미 ${C.n}점(2px 눈금) · surfaceAt 이 창턱 ${C.onSill} · 다른 면 ${C.other} · 못 놓음(벽·유리) ${C.miss} → 이 손이 창턱으로 ${C.missToSill}`);
  console.log(`  창턱에 놓이는 넓이: 고치기 전 ${px2(C.onSill)}px² → 이 손을 더하면 ${px2(C.onSill + C.missToSill)}px² (지름 40px 동그라미 = ${Math.round(Math.PI * 400)}px²)`);
  ok('B 창턱 둘레 44px 안에 surfaceAt 이 못 놓는(벽·유리) 점이 있다 — 그 점에서 이 손은 창턱을 돌려준다',
     C.miss > 0 && !!C.firstMiss && C.firstMiss.s.slotId === SILL && /벽|면이 없/.test(String(C.firstMiss.reason || '')), J(C.firstMiss));
  ok('C 고치기 전 창턱 넓이가 손가락(지름 40px)보다 작다', px2(C.onSill) < Math.PI * 400, `${px2(C.onSill)}px²`);
  ok('C 이 손을 더하면 손가락(지름 40px)보다 넓다', px2(C.onSill + C.missToSill) >= Math.PI * 400, `${px2(C.onSill + C.missToSill)}px²`);

  stage = 'D 밖 · 안 들어감 · maxPx';
  const D = await page.eval(`(() => { const v = window.view, cx = ${A.cx}, cy = ${A.cy}, ex = ${A.s.occupied ? `'${SILL}'` : 'undefined'};
    return { far: v.slotNearScreen(cx, cy - 80, { potD: 0.2, except: ex }), big: v.slotNearScreen(cx, cy - 20, { potD: 0.40, except: ex }),
             tight: v.slotNearScreen(cx, cy - 20, { potD: 0.2, maxPx: 10, except: ex }), near: v.slotNearScreen(cx, cy - 20, { potD: 0.2, maxPx: 25, except: ex }) }; })()`);
  ok('D 창턱에서 80px 위(창·벽)는 null', D.far === null, J(D.far));
  ok('D 지름 0.40 화분은 창턱(받침 0.27)을 안 준다', !D.big || D.big.slotId !== SILL, J(D.big));
  ok('D maxPx 10 이면 20px 떨어진 창턱은 안 준다 · 25 면 준다', (!D.tight || D.tight.slotId !== SILL) && !!D.near && D.near.slotId === SILL, J([D.tight, D.near]));

  stage = 'E 찬 자리';
  const E = await page.eval(`(() => { const v = window.view, cx = ${A.cx}, cy = ${A.cy};
    const occ = v.slots().find(x => x.slotId === '${SILL}').occupied;
    return { occ, free: v.slotNearScreen(cx, cy, { potD: 0.2 }), all: v.slotNearScreen(cx, cy, { potD: 0.2, freeOnly: false }),
             ex: v.slotNearScreen(cx, cy, { potD: 0.2, except: '${SILL}' }) }; })()`);
  ok(`E 찬 자리(지금 창턱 ${E.occ ? '참' : '빔'}) — 기본은 ${E.occ ? '뺀다' : '준다'} · freeOnly:false 와 except 면 준다`,
     (E.occ ? (!E.free || E.free.slotId !== SILL) : (!!E.free && E.free.slotId === SILL)) && !!E.all && E.all.slotId === SILL && !!E.ex && E.ex.slotId === SILL, J(E));
  if (SHOT) await page.shot(SHOT);
} catch (e) {
  fail++; console.log(`FAIL  던짐 — ${stage} 단계: ${String((e && e.message) || e).slice(0, 300)}`);
} finally { if (page) { try { await page.close(); } catch { /* 이미 닫힘 */ } } }
console.log(`\n${fail ? '❌' : '✅'} 통과 ${pass} · 실패 ${fail}`);
console.log(`slot_snap: ${fail ? 'FAIL' : 'PASS'} (${pass}/${pass + fail})`);   // run_house_checks 가 이 줄을 센다(PASS|FAIL)
process.exit(fail ? 1 : 0);
