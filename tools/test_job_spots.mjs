/* ============================================================
   tools/test_job_spots.mjs — 간판·판이 «지금 선» 자리를 묻는 손([house] · 2026-10-24 · 총괄 청)
   ------------------------------------------------------------
     BYEOT_URL=http://127.0.0.1:9330 node tools/test_job_spots.mjs     (헤드리스 크롬 하나)
   끝맺음 선 자리(game.html endingStandAside · core)가 간판 자리값(furniture_dress PROPS)을 적어 쓰던 것을
   방 뷰의 공개 손 둘로 바꾼다 — view.signSpot() · view.boardSpot(). 둘 다 { x, y, z 밑 가운데 · w, d, h } · 안 섰으면 null.
   진짜 방 뷰(tools/room_view_demo.html?engine=1)에서:
     A 간판 — 깃발 꺼짐 null · 켜면 섬 · 그림을 받으면 ready · 자리 = 표(x −3.14 · z −0.95 · 바닥 · 높이 0.85) · 화면에 찍힘
     B 간판이 화분에 비켜 숨으면 null · 비키면 다시 · 끄면 null
     C 판 — 안 걸렸으면 null · 주문판을 판 자리에 걸면 그 자리(걸이 자리표 x·z · 크기 = 프리셋) · 메모판(육종)도 같은 손
     D 반지하 — 간판 소품이 없는 방이라 깃발을 켜도 null · 판 null
============================================================ */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9330';
let pass = 0, fail = 0;
const ok = (label, cond, extra = '') => { if (cond) { pass++; console.log(`PASS  ${label}`); } else { fail++; console.log(`FAIL  ${label}${extra ? '  — ' + extra : ''}`); } };
const near = (a, b, t) => typeof a === 'number' && Math.abs(a - b) <= t;
const J = v => JSON.stringify(v);

let stage = '크롬 띄우기', page = null;
async function openRoom(room) {
  await page.goto(`${BASE}/tools/room_view_demo.html?room=${room}&engine=1`);
  for (let i = 0; i < 90; i++) { let t = ''; try { t = await page.eval('document.title'); } catch { /* 옛 문서가 사라지는 중 */ } if (/DONE/.test(String(t))) break; await sleep(400); }
  await sleep(1500);
}
/* 판을 판 자리에 건다(가구점에서 산 줄과 같은 길). pose 를 주면 그 자리표 그대로 — 찬 자리에 바꿔 걸 때(hangPose 는 «다 찼습니다») */
const hang = (preset, pose = null) => page.eval(`(async () => { const v = window.view, e = window.engine;
  const p = ${pose ? J(pose) : `v.hangPose('tworoom-hang-order', '${preset}')`};
  e.setFurnitureEdits([], [{ uid: 'add-${preset}-1', preset: '${preset}', ...p }]);
  await v.refreshFurniture();
  return { p, b: v.boardSpot() }; })()`);
try {
  page = await launch({ width: 1100, height: 800, dpr: 1 });
  stage = '투룸 열기';
  await openRoom('tworoom');

  stage = 'A 간판';
  const A0 = await page.eval(`window.view.signSpot()`);
  ok('A 깃발을 안 켰으면 간판 null', A0 === null, J(A0));
  const A1 = await page.eval(`(() => { window.view.setShopSign(true); return window.view.signSpot(); })()`);
  ok('A 켜자마자 섰다(그림을 받는 중이면 표의 자리 ready:false)', !!A1 && A1.id === 'shop_sign' && (A1.ready === false ? near(A1.x, -3.14, 1e-6) && near(A1.z, -0.95, 1e-6) && A1.h === 0.85 : true), J(A1));
  let A2 = null;
  for (let i = 0; i < 40; i++) { A2 = await page.eval(`window.view.signSpot()`); if (A2 && A2.ready) break; await sleep(300); }
  console.log('  간판', J(A2));
  ok('A 그림을 받으면 ready — 그린 상자의 자리 = 표(x −3.14 · z −0.95 · 바닥 · 높이 0.85)',
     !!A2 && A2.ready === true && near(A2.x, -3.14, 0.01) && near(A2.z, -0.95, 0.01) && near(A2.y, 0, 0.01) && near(A2.h, 0.85, 0.01) && A2.w > 0.1 && A2.d > 0.1, J(A2));
  const Ar = await page.eval(`(() => { const r = window.__v2.furn.report(); return (r.props || []).find(p => p.id === 'shop_sign') || null; })()`);
  ok('A 옷 층 보고와 같은 간판(보임 · 발자국 가운데 같음)', !!Ar && Ar.visible === true && near(Ar.rect.x, A2.x, 0.01) && near(Ar.rect.z, A2.z, 0.01), J(Ar));
  const As = await page.eval(`(() => { const s = window.view.signSpot(), c = document.querySelector('canvas').getBoundingClientRect();
    const q = window.view.worldToScreen(s.x, s.y + s.h / 2, s.z); return { q, w: c.width, h: c.height }; })()`);
  ok('A 기본 카메라 화면 안에 찍힌다(worldToScreen)', !!As.q && As.q.x > 0 && As.q.x < As.w && As.q.y > 0 && As.q.y < As.h, J(As));

  stage = 'B 비켜 숨기 · 끄기';
  const B = await page.eval(`(() => { const f = window.__v2.furn, v = window.view, s = v.signSpot();
    f.yieldTo([{ plant: true, x: s.x, z: s.z, w: 0.4, d: 0.4 }]); const hid = v.signSpot();
    f.yieldTo([]); const back = v.signSpot();
    v.setShopSign(false); const off = v.signSpot();
    v.setShopSign(true); return { hid, back, off }; })()`);
  ok('B 화분이 그 자리에 오면 간판이 숨고 null', B.hid === null, J(B.hid));
  ok('B 화분이 비키면 다시 섰다', !!B.back && B.back.ready === true && near(B.back.x, A2.x, 1e-6), J(B.back));
  ok('B 깃발을 끄면 null', B.off === null, J(B.off));

  stage = 'C 판';
  const C0 = await page.eval(`window.view.boardSpot()`);
  ok('C 판이 안 걸렸으면 null', C0 === null, J(C0));
  const C1 = await hang('order_board');
  console.log('  판 자리표', J(C1.p), '판', J(C1.b));
  ok('C 주문판을 판 자리에 걸면 그 판(uid · preset)', !!C1.b && C1.b.uid === 'add-order_board-1' && C1.b.preset === 'order_board', J(C1.b));
  ok('C 판 자리 = 걸이 자리표 x·z · 크기 = 프리셋(너비 0.6 · 높이 0.45)',
     !!C1.b && near(C1.b.x, C1.p.x, 0.03) && near(C1.b.z, C1.p.z, 0.03) && near(C1.b.w, 0.6, 0.03) && near(C1.b.h, 0.45, 0.03), J([C1.p, C1.b]));
  ok('C 판 가운데 높이 = 걸이 높이 cy(밑 y = cy − h/2 · 걸이 자리표 y 는 가운데다)', !!C1.b && near(C1.b.y + C1.b.h / 2, C1.p.y, 0.01), J([C1.p.y, C1.b && C1.b.y, C1.b && C1.b.h]));
  const Cs = await page.eval(`(() => { const v = window.view, b = v.boardSpot(), q = v.worldToScreen(b.x, b.y + b.h / 2, b.z),
    c = document.querySelector('canvas').getBoundingClientRect(); return { q, w: c.width, h: c.height }; })()`);
  ok('C 기본 카메라 화면 안에 찍힌다', !!Cs.q && Cs.q.x > 0 && Cs.q.x < Cs.w && Cs.q.y > 0 && Cs.q.y < Cs.h, J(Cs));
  const C2 = await hang('memo_board', C1.p);   // 주문판 자리에 메모판으로 바꿔 건다(같은 크기 · 같은 자리표)
  ok('C 육종 메모판(D83)도 같은 손 · 같은 자리', !!C2.b && C2.b.preset === 'memo_board' && near(C2.b.x, C1.b.x, 0.01) && near(C2.b.z, C1.b.z, 0.01), J(C2.b));

  stage = 'D 반지하';
  await openRoom('banjiha');
  const D = await page.eval(`(() => { const v = window.view; v.setShopSign(true); return { s: v.signSpot(), b: v.boardSpot() }; })()`);
  ok('D 반지하 — 간판 소품이 없는 방이라 깃발을 켜도 null · 판 null', D.s === null && D.b === null, J(D));
} catch (e) {
  fail++; console.log(`FAIL  던짐 — ${stage} 단계: ${String((e && e.message) || e).slice(0, 300)}`);
} finally { if (page) { try { await page.close(); } catch { /* 이미 닫힘 */ } } }
console.log(`\n${fail ? '❌' : '✅'} 통과 ${pass} · 실패 ${fail}`);
console.log(`job_spots: ${fail ? 'FAIL' : 'PASS'} (${pass}/${pass + fail})`);   // run_house_checks 가 이 줄을 센다(PASS|FAIL)
process.exit(fail ? 1 : 0);
