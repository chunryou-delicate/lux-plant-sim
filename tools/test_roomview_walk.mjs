/* ============================================================
   tools/test_roomview_walk.mjs — 캐릭터 고르기·걷기 재현
   ------------------------------------------------------------
   진짜 브라우저(헤드리스 크롬)에서 방 뷰를 띄우고 계약을 하나씩 눌러 본다.
   3D 는 node:vm 으로 못 돌린다 — WebGL 이 필요하고, 걷기는 rAF 위에서 돈다.

     python tools/serve.py 8971
     node tools/test_roomview_walk.mjs

   ★ 여기서 보는 것 (박사님 지시 그대로)
     A 캐릭터를 탭하면 골라진다(주황 링) · 다시 탭하면 풀린다
     B 고르기 **전에** 끌면 카메라가 돈다 — 걷지 않는다
     C 고른 **뒤에** 끌면 걷는다 — 카메라는 안 돈다
     D 가구·벽 안으로는 못 간다
     E 걷는 동안에도 setDaylight(하루빛)이 계속 돈다
     F 화분을 가리고 서면 비켜선다
     G 걷기 클립은 경량 파생본(35KB)을 쓴다 — 2.4MB 짜리를 안 받는다
============================================================ */
import { launch, sleep } from './test_cdp.mjs';

const BASE = process.env.BYEOT_URL || 'http://localhost:8971';
const URL_ = `${BASE}/tools/room_view_demo.html?room=banjiha`;

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log(`PASS  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}${extra ? '  — ' + extra : ''}`); }
};

/* 폰처럼 누른다 — 마우스 이벤트를 캔버스에 직접 흘린다.
   room_view 는 mousedown/mousemove/mouseup 을 그대로 듣는다. */
async function drag(page, x0, y0, x1, y1, steps = 8) {
  await page.eval(`(()=>{ const c=document.getElementById('roomCanvas');
    c.dispatchEvent(new MouseEvent('mousedown',{clientX:${x0},clientY:${y0},bubbles:true})); })()`, false);
  for (let i = 1; i <= steps; i++) {
    const x = Math.round(x0 + (x1 - x0) * i / steps), y = Math.round(y0 + (y1 - y0) * i / steps);
    await page.eval(`window.dispatchEvent(new MouseEvent('mousemove',{clientX:${x},clientY:${y},bubbles:true}))`, false);
    await sleep(16);
  }
  await page.eval(`window.dispatchEvent(new MouseEvent('mouseup',{clientX:${x1},clientY:${y1},bubbles:true}))`, false);
  await sleep(60);
}
async function tap(page, x, y) {
  await page.eval(`(()=>{ const c=document.getElementById('roomCanvas');
    c.dispatchEvent(new MouseEvent('mousedown',{clientX:${x},clientY:${y},bubbles:true}));
    window.dispatchEvent(new MouseEvent('mouseup',{clientX:${x},clientY:${y},bubbles:true})); })()`, false);
  await sleep(80);
}

async function main() {
  const page = await launch({ width: 390, height: 844, dpr: 2, mobile: false });
  const errs = [];
  page.on((m, p) => {
    if (m === 'Runtime.exceptionThrown')
      errs.push(p.exceptionDetails.text + ' ' + ((p.exceptionDetails.exception || {}).description || ''));
  });
  const netUrls = [];
  page.on((m, p) => { if (m === 'Network.requestWillBeSent') netUrls.push(p.request.url); });

  await page.goto(URL_);
  await page.waitFor('!!window.view', 120000, 200);
  await page.eval(`window.view.setContinuous(true)`);      // rAF 를 계속 돌린다
  /* ★ .then(()=>1) 을 붙인다 — setCharacter 는 THREE.Group 을 돌려주는데
     그걸 그대로 직렬화하려 들면 CDP 가 "참조 사슬이 너무 길다"로 죽는다(실제로 죽었다). */
  await page.eval(`window.view.setCharacter('jachwi').then(()=>1)`);
  await page.eval(`window.view.setCharacter('moni').then(()=>1)`);
  await sleep(700);

  const canvasRect = await page.eval(`(()=>{ const r=document.getElementById('roomCanvas').getBoundingClientRect();
    return {left:r.left, top:r.top, w:r.width, h:r.height}; })()`);
  const charPos = await page.eval(`window.view.characterScreenPos('jachwi')`);
  if (!charPos) { console.log('FAIL  캐릭터가 화면에 안 잡힙니다 — 나머지를 못 봅니다'); process.exit(1); }
  const CX = Math.round(canvasRect.left + charPos.x), CY = Math.round(canvasRect.top + charPos.y);

  /* ── B 고르기 전에 끌면 카메라가 돈다 ── */
  const cam0 = await page.eval(`window.view.camera()`);
  await drag(page, Math.round(canvasRect.left + canvasRect.w * 0.5), Math.round(canvasRect.top + canvasRect.h * 0.75),
                   Math.round(canvasRect.left + canvasRect.w * 0.5) + 110, Math.round(canvasRect.top + canvasRect.h * 0.75));
  await sleep(500);
  const cam1 = await page.eval(`window.view.camera()`);
  const p0 = await page.eval(`window.view.characters().find(c=>c.id==='jachwi').pos`);
  ok('B 고르기 전 드래그 = 카메라 회전 (걷지 않는다)',
     Math.abs(cam1.az - cam0.az) > 1e-3 && !(await page.eval(`window.view.isWalking('jachwi')`)),
     `az ${cam0.az.toFixed(3)}→${cam1.az.toFixed(3)}`);

  /* ── A 캐릭터를 탭하면 골라진다 ── */
  const cp2 = await page.eval(`window.view.characterScreenPos('jachwi')`);
  const AX = Math.round(canvasRect.left + cp2.x), AY = Math.round(canvasRect.top + cp2.y);
  await tap(page, AX, AY);
  const sel1 = await page.eval(`window.view.selectedCharacter()`);
  ok('A-1 캐릭터 탭 → 골라진다', sel1 === 'jachwi', `selected=${sel1}`);
  const tapped = await page.eval(`window.__lastCharTap || null`);
  ok('A-2 onCharacterTap 이 불린다(첫 인자 = 골라진 결과)', tapped === 'jachwi', `${tapped}`);
  ok('A-2b 둘째 인자로 눌린 id 도 온다',
     (await page.eval(`window.__lastCharTapped || null`)) === 'jachwi');
  const ringOn = await page.eval(`(()=>{ let n=0; window.view.three.scene.traverse(o=>{
      if(o.isMesh && o.material && o.material.color && o.material.color.getHex()===0xffb454 && o.visible) n++; }); return n; })()`);
  ok('A-3 발밑 주황 링(0xffb454)이 보인다', ringOn >= 1, `${ringOn}개`);

  await tap(page, AX, AY);
  /* ★ 데모는 game.html 과 같은 배선(호스트가 결과를 되돌려 selectCharacter)을 쓴다.
     첫 인자가 '눌린 id' 였을 때는 여기서 호스트가 도로 골라 버려 해제가 안 됐다. */
  ok('A-4 다시 탭하면 풀린다 (호스트가 결과를 되돌려도)',
     (await page.eval(`window.view.selectedCharacter()`)) === null,
     `onCharacterTap 첫 인자=${await page.eval(`String(window.__lastCharTap)`)}`);

  /* ── C 고른 뒤에 끌면 걷는다 · 카메라는 안 돈다 ── */
  await page.eval(`window.view.selectCharacter('jachwi')`);
  const cam2 = await page.eval(`window.view.camera()`);
  const before = await page.eval(`window.view.characters().find(c=>c.id==='jachwi').pos`);
  /* 갈 수 있는 자리를 먼저 찾는다 — 아무 데나 끌면 가구 위일 수 있고, 그때
     "안 걷는 게 맞다". 계약이 지켜지는지 보려면 갈 수 있는 자리로 끌어야 한다.
     ★ 기준점은 **발밑**이다(characterScreenPos). 0,0 으로 끌면 제자리여야 한다. */
  const foot = await page.eval(`window.view.characterScreenPos('jachwi')`);
  const FX = Math.round(canvasRect.left + foot.x), FY = Math.round(canvasRect.top + foot.y);
  const spot = await page.eval(`(()=>{
    const out = [];
    for (const [dx,dy] of [[0,55],[45,45],[-45,45],[70,20],[-70,20],[0,90],[60,80],[-60,80],[90,-20],[-90,-20]]) {
      const t = window.view.previewWalk('jachwi', ${FX}+dx, ${FY}+dy);
      if (t && t.ok) { out.push({dx,dy,x:t.x,z:t.z}); }
    }
    window.view.previewWalk('jachwi', null, null);
    return out;
  })()`);
  ok('C-0 갈 수 있는 자리를 미리보기가 찾아 준다', spot.length > 0, `${spot.length}곳`);
  /* 지금 서 있는 자리에서 충분히 떨어진 곳으로 */
  const target = spot.sort((a, b) =>
    Math.hypot(b.x - before.x, b.z - before.z) - Math.hypot(a.x - before.x, a.z - before.z))[0]
    || { dx: 0, dy: 55 };
  await drag(page, FX, FY, FX + target.dx, FY + target.dy, 10);
  const cam3 = await page.eval(`window.view.camera()`);
  ok('C-1 고른 뒤 드래그 = 카메라가 안 돈다', Math.abs(cam3.az - cam2.az) < 1e-6,
     `az ${cam2.az.toFixed(4)}→${cam3.az.toFixed(4)}`);
  await sleep(150);
  const walking = await page.eval(`window.view.isWalking('jachwi')`);
  ok('C-2 손을 떼면 걸어간다', walking === true);

  /* ── K 가는 쪽을 보고 걷는다 (뒷걸음질 금지) ──
     ★ 방향은 눈으로만 보면 놓친다. 두 시점의 **자리 차이**로 진행 방향을 구하고
       그때의 yaw 와 비교한다. 캐릭터의 앞은 로컬 +Z 라 yaw = atan2(dx, dz) 여야 한다. */
  const norm = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
  let backwards = null;
  if (walking) {
    await sleep(320);                       // 몸이 다 돌 때까지 기다린다(0.4초쯤 걸린다)
    const k0 = await page.eval(`window.view.characters().find(c=>c.id==='jachwi')`);
    await sleep(260);
    const k1 = await page.eval(`window.view.characters().find(c=>c.id==='jachwi')`);
    const mx = k1.pos.x - k0.pos.x, mz = k1.pos.z - k0.pos.z;
    if (Math.hypot(mx, mz) > 0.05) {
      const travel = Math.atan2(mx, mz);
      const off = Math.abs(norm(travel - k1.yaw));
      backwards = off;
      ok('K 가는 쪽을 보고 걷는다 (뒷걸음질이 아니다)', off < 0.7,
         `진행 ${(travel * 180 / Math.PI).toFixed(0)}° vs 몸 ${(k1.yaw * 180 / Math.PI).toFixed(0)}° = ${(off * 180 / Math.PI).toFixed(0)}° 어긋남`);
    } else ok('K 가는 쪽을 보고 걷는다 (뒷걸음질이 아니다)', false, '두 표본 사이에 안 움직여 못 쟀습니다');
  } else ok('K 가는 쪽을 보고 걷는다 (뒷걸음질이 아니다)', false, '걷지 않아 못 쟀습니다');

  /* ── E 걷는 동안에도 하루빛이 돈다 ── */
  let daylightMoved = false;
  if (walking) {
    const l1 = await page.eval(`window.view.setDaylight(0.25)`);
    await sleep(120);
    const l2 = await page.eval(`window.view.setDaylight(0.60)`);
    daylightMoved = l1 !== l2;
    ok('E 걷는 동안에도 setDaylight 이 돈다', daylightMoved, `${l1} → ${l2}`);
  } else ok('E 걷는 동안에도 setDaylight 이 돈다', false, '걷지 않아 못 쟀습니다');

  /* 도착까지 기다린다 */
  for (let i = 0; i < 120 && await page.eval(`window.view.isWalking('jachwi')`); i++) await sleep(100);
  const after = await page.eval(`window.view.characters().find(c=>c.id==='jachwi').pos`);
  const moved = Math.hypot(after.x - before.x, after.z - before.z);
  ok('C-3 실제로 자리를 옮겼다', moved > 0.25, `${moved.toFixed(2)}m`);

  /* ── L 도착하면 카메라(플레이어) 쪽으로 돌아선다 ──
     "아무 데나 보고 서 있으면 어색합니다." 마지막 웨이포인트가 옆걸음이면 벽을 보고 서게 된다. */
  await sleep(700);                          // 돌아서는 데 0.4초쯤
  const land = await page.eval(`(()=>{
    const c = window.view.characters().find(x=>x.id==='jachwi');
    const p = window.view.three.cam.position;
    return { yaw: c.yaw, want: Math.atan2(p.x - c.pos.x, p.z - c.pos.z) };
  })()`);
  ok('L 도착하면 카메라 쪽을 보고 선다', Math.abs(norm(land.want - land.yaw)) < 0.25,
     `몸 ${(land.yaw * 180 / Math.PI).toFixed(0)}° vs 카메라 ${(land.want * 180 / Math.PI).toFixed(0)}°`);

  /* ── D 가구·벽 안으로는 못 간다 ── */
  const wallHit = await page.eval(`(()=>{
    /* 화면 맨 위(벽·천장 쪽)를 찍는다 — 바닥 평면과의 교점이 방 밖으로 나간다 */
    const r = document.getElementById('roomCanvas').getBoundingClientRect();
    return window.view.walkTo('jachwi', r.left + r.width*0.5, r.top + 8);
  })()`);
  ok('D-1 방 밖(벽 너머)은 거절한다', wallHit && wallHit.ok === false, JSON.stringify(wallHit));
  for (let i = 0; i < 80 && await page.eval(`window.view.isWalking('jachwi')`); i++) await sleep(100);
  const end = await page.eval(`window.view.characters().find(c=>c.id==='jachwi').pos`);
  const size = await page.eval(`window.view.roomSize()`);
  ok('D-2 걸은 끝자리가 방 안이다',
     Math.abs(end.x) <= size.w / 2 + 0.02 && Math.abs(end.z) <= size.d / 2 + 0.02,
     `(${end.x.toFixed(2)}, ${end.z.toFixed(2)}) / 방 ${size.w}×${size.d}`);

  /* ── F 화분을 가리면 비켜선다 ──
     일부러 화분 앞을 막고 서게 한 뒤, 비켜서는지 본다. 그림으로만 확인하면
     "가린 적이 없어서 통과"인지 "비켜서서 통과"인지 못 가른다 — 먼저 가리게 만든다. */
  const setup = await page.eval(`(async ()=>{
    const S = window.view.slots();
    /* 바닥에서 가까운 자리에 놓아야 사람이 앞을 막을 수 있다(선반 위는 못 막는다) */
    const cand = S.filter(s=>!s.occupied).sort((a,b)=>(a.pos.y)-(b.pos.y));
    const s = cand[0] || S[0];
    await window.view.setPlant(s.slotId, { kind:'monstera', growthDays: 200, seed: 92158, band:'good' });
    return { slot: s.slotId, y: s.pos.y };
  })()`);
  /* 화분 화면 위치 바로 아래(=카메라 쪽)로 걸어 보내 가리게 만든다 */
  const blocked = await page.eval(`(()=>{
    const r = document.getElementById('roomCanvas').getBoundingClientRect();
    const p = window.view.screenPosOf('${setup.slot}');
    if (!p) return null;
    const out = [];
    for (const dy of [10, 24, 40, 56, 72]) for (const dx of [0, -18, 18, -34, 34]) {
      const t = window.view.previewWalk('jachwi', r.left+p.x+dx, r.top+p.y+dy);
      if (t && t.ok) out.push({dx,dy});
    }
    window.view.previewWalk('jachwi', null, null);
    if (!out.length) return null;
    const g = out[0];
    return { r: window.view.walkTo('jachwi', r.left+p.x+g.dx, r.top+p.y+g.dy), at: g };
  })()`);
  for (let i = 0; i < 100 && await page.eval(`window.view.isWalking('jachwi')`); i++) await sleep(100);
  const wasOcc = await page.eval(`window.view.isOccludingPlant('jachwi')`);
  const posBefore = await page.eval(`window.view.characters().find(c=>c.id==='jachwi').pos`);
  const nMoved = await page.eval(`window.view.nudgeCharacters()`);
  for (let i = 0; i < 100 && await page.eval(`window.view.isWalking('jachwi')`); i++) await sleep(100);
  const nowOcc = await page.eval(`window.view.isOccludingPlant('jachwi')`);
  const posAfter = await page.eval(`window.view.characters().find(c=>c.id==='jachwi').pos`);
  const stepped = Math.hypot(posAfter.x - posBefore.x, posAfter.z - posBefore.z);
  ok('F-1 화분 앞을 막고 서게 만들 수 있다(=판정이 실제로 작동한다)', wasOcc === true,
     `${setup.slot} · ${JSON.stringify(blocked && blocked.at)}`);
  ok('F-2 비켜서면 더 이상 안 가린다', wasOcc ? (nowOcc === false && stepped > 0.15) : true,
     `${nMoved}명 이동 · ${stepped.toFixed(2)}m · 아직가림=${nowOcc}`);

  /* ── G 걷기 클립은 35KB 짜리 파생본을 쓴다 ── */
  const usedLight = netUrls.some(u => /derived\/char_clips\/char_\w+_walking\.glb/.test(u));
  const usedHeavy = netUrls.some(u => /characters\/3d\/lq\/char_\w+_walking\.glb/.test(u));
  ok('G 걷기 클립 = assets/derived/char_clips (35KB). 2.4MB 원본을 안 받는다',
     usedLight && !usedHeavy, `light=${usedLight} heavy=${usedHeavy}`);

  /* ── 모니는 못 보낸다 ── */
  const moni = await page.eval(`(()=>{ const r=document.getElementById('roomCanvas').getBoundingClientRect();
    return window.view.walkTo('moni', r.left+r.width*0.5, r.top+r.height*0.72); })()`);
  ok('H 몬이는 따로 못 보낸다(사람을 따라다닌다)', moni && moni.ok === false, JSON.stringify(moni));

  /* ── 진행 표시 ── */
  const t = await page.eval(`window.view.bootTimings()`);
  ok('I bootTimings 가 이정표를 남긴다', t && t.ready != null,
     JSON.stringify(t));

  const hard = errs.filter(e => !/favicon/.test(e));
  ok('J 콘솔에 처리 안 된 예외가 없다', hard.length === 0, hard.slice(0, 3).join(' | '));

  await page.close();
  console.log(`\nroomview_walk: ${fail ? 'FAIL' : 'PASS'}  (${pass}/${pass + fail})`);
  process.exit(fail ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
