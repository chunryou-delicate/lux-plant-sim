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
     N ★가서·하고·끝난다(actAt) — 가서 서서 끝난다 · 못 가는 자리면 실패한다 ·
        빨리감기에서는 연출을 건너뛴다 · **연출이 끝난 뒤에 논리가 돈다**
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

/* ★★ 진짜 폰처럼 누른다 (2026-08-03 · 박사님 "캐릭 이동 안 됨")
   ------------------------------------------------------------
   위의 tap/drag 은 **마우스만** 쏜다. 그건 폰 게임을 절반만 재는 것이다 —
   실제로 이 파일이 21/21 을 통과하는 동안 폰에서는 캐릭터가 안 걸었다.

   폰에서 다른 점이 둘이다. 둘 다 여기서 재현한다.
     ① 이벤트 종류가 touchstart/touchmove/touchend 다
     ② ★터치가 끝나면 브라우저가 **호환용 마우스 이벤트**를 뒤따라 쏜다.
       합성 TouchEvent 는 그걸 안 만들므로 **손으로 쏴 줘야** 폰과 같아진다.
       이걸 안 쏘면 "고르고 곧바로 되푸는" 버그가 검사에 안 잡힌다(안 잡혔다). */
const T = (page, type, x, y) => page.eval(`(()=>{ const c=document.getElementById('roomCanvas');
  const t=new Touch({identifier:1,target:c,clientX:${x},clientY:${y}});
  c.dispatchEvent(new TouchEvent('${type}',{bubbles:true,cancelable:true,
    touches:'${type}'==='touchend'?[]:[t],targetTouches:'${type}'==='touchend'?[]:[t],changedTouches:[t]})); })()`, false);

/* ghost=true 면 폰처럼 호환 마우스까지 뒤따라 쏜다 */
async function touchTap(page, x, y, ghost = true) {
  await T(page, 'touchstart', x, y); await sleep(60);
  await T(page, 'touchend', x, y);
  if (ghost) {
    await sleep(40);
    await page.eval(`(()=>{ const c=document.getElementById('roomCanvas');
      c.dispatchEvent(new MouseEvent('mousedown',{clientX:${x},clientY:${y},bubbles:true}));
      window.dispatchEvent(new MouseEvent('mouseup',{clientX:${x},clientY:${y},bubbles:true})); })()`, false);
  }
  await sleep(250);
}
async function touchDrag(page, x0, y0, x1, y1, steps = 8, ghost = true) {
  await T(page, 'touchstart', x0, y0); await sleep(40);
  for (let i = 1; i <= steps; i++) {
    await T(page, 'touchmove', Math.round(x0 + (x1 - x0) * i / steps), Math.round(y0 + (y1 - y0) * i / steps));
    await sleep(24);
  }
  await T(page, 'touchend', x1, y1);
  if (ghost) {
    await sleep(40);
    await page.eval(`(()=>{ const c=document.getElementById('roomCanvas');
      c.dispatchEvent(new MouseEvent('mousedown',{clientX:${x1},clientY:${y1},bubbles:true}));
      window.dispatchEvent(new MouseEvent('mouseup',{clientX:${x1},clientY:${y1},bubbles:true})); })()`, false);
  }
  await sleep(120);
}

/* ★★ 걷는 동안 매 프레임 자리·몸방향을 **브라우저 안에서** 찍는다
   ------------------------------------------------------------
   (2026-08-06 · K 가 네 번에 한 번 "안 움직여 못 쟀습니다"로 떨어지던 것)
   전에는 node 에서 page.eval 로 두 번만 찍어 그 차이를 썼다. 그 두 표본이
   출발 직전(몸만 도는 구간)·도착 직후·CDP 왕복이 늦은 프레임에 걸리면
   이동량이 0 이 되어 **걷기는 멀쩡한데 검사만** 떨어졌다.
   여기서는 rAF 마다 찍으므로 왕복 지연에 안 흔들리고, 표본이 아주 많아
   그 중 "실제로 움직인" 구간만 골라 쓸 수 있다.

   ★ 걷기를 다 삼키지 않는다 — 쓸 만한 걸음이 wantSteps 개 모이면 곧바로 멈춘다.
     (뒤따르는 E 는 **걷는 동안** 하루빛이 도는지를 봐야 한다) */
const MIN_STEP = 0.05;                       // 이만큼은 움직여야 방향을 잰다(전과 같은 문턱)
async function sampleWalk(page, id, { wantSteps = 8, maxMs = 4000 } = {}) {
  await page.eval(`(()=>{
    window.__K = { s: [], steps: 0, done: false };
    const id = ${JSON.stringify(id)}, t0 = performance.now();
    let ax = null, az = null;
    const tick = () => {
      const c = window.view.characters().find(x => x.id === id);
      const now = performance.now() - t0;
      if (c) {
        window.__K.s.push({ t: +now.toFixed(1), x: c.pos.x, z: c.pos.z, yaw: c.yaw });
        if (ax === null) { ax = c.pos.x; az = c.pos.z; }
        else if (Math.hypot(c.pos.x - ax, c.pos.z - az) >= ${MIN_STEP}) {
          ax = c.pos.x; az = c.pos.z; window.__K.steps++;
        }
      }
      if (window.__K.steps >= ${wantSteps} || !window.view.isWalking(id) || now > ${maxMs}) {
        window.__K.done = true; return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick); return 1; })()`);
  for (let i = 0; i < Math.ceil(maxMs / 60) + 10; i++) {
    if (await page.eval(`window.__K.done ? 1 : 0`)) break;
    await sleep(60);
  }
  return page.eval(`window.__K.s`);
}

/* 표본 줄에서 **실제로 움직인 구간**만 골라 (진행 방향 vs 몸 방향) 어긋남을 잰다.
   안 움직인 표본은 방향을 못 주므로 버리고 다음 표본을 본다 — 검사를 무르게
   하는 게 아니라, 잴 수 없는 표본을 안 쓰는 것이다. */
function facingSteps(samples, minStep = MIN_STEP) {
  const norm = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
  const out = [];
  let a = null;
  for (const s of samples) {
    if (!a) { a = s; continue; }
    const dx = s.x - a.x, dz = s.z - a.z;
    if (Math.hypot(dx, dz) < minStep) continue;       // 아직 덜 움직였다 — 다음 표본으로
    const travel = Math.atan2(dx, dz);                // 캐릭터의 앞은 로컬 +Z
    out.push({ t: s.t, travel, yaw: s.yaw, off: Math.abs(norm(travel - s.yaw)) });
    a = s;
  }
  return out;
}

/* 갈 수 있는 자리 중 ref 에서 **가장 먼 곳**으로 다시 걷게 한다.
   K 가 표본을 못 건졌을 때(걷기가 이미 끝나 있었다) 다시 찍기 위한 것.
   ref 에서 먼 곳을 고르므로 뒤따르는 C-3(실제로 자리를 옮겼다)도 안 흔들린다. */
async function walkFarFrom(page, id, ref) {
  return page.eval(`(()=>{
    const rc = document.getElementById('roomCanvas').getBoundingClientRect();
    const f = window.view.characterScreenPos(${JSON.stringify(id)});
    if (!f) return null;
    const FX = rc.left + f.x, FY = rc.top + f.y, out = [];
    for (const [dx,dy] of [[0,55],[45,45],[-45,45],[70,20],[-70,20],[0,90],[60,80],[-60,80],[90,-20],[-90,-20],[110,45],[-110,45]]) {
      const t = window.view.previewWalk(${JSON.stringify(id)}, FX+dx, FY+dy);
      if (t && t.ok) out.push({dx,dy,x:t.x,z:t.z});
    }
    window.view.previewWalk(${JSON.stringify(id)}, null, null);
    if (!out.length) return null;
    out.sort((a,b) => Math.hypot(b.x-(${ref.x}), b.z-(${ref.z})) - Math.hypot(a.x-(${ref.x}), a.z-(${ref.z})));
    const g = out[0];
    return { r: window.view.walkTo(${JSON.stringify(id)}, FX+g.dx, FY+g.dy), x:g.x, z:g.z };
  })()`);
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
     ★ 방향은 눈으로만 보면 놓친다. **자리 차이**로 진행 방향을 구하고 그때의 yaw 와
       비교한다. 캐릭터의 앞은 로컬 +Z 라 yaw = atan2(dx, dz) 여야 한다.

     표본은 rAF 마다 브라우저 안에서 찍고(sampleWalk), 그 중 **실제로 움직인 걸음**만
     골라 쓴다. 못 건지면 다시 걷게 해서 다시 찍는다 — 잴 수 없는 표본을 버릴 뿐
     문턱은 그대로다(어긋남 0.7rad = 40°).
     ★ 여러 걸음의 **중앙값**으로 본다. 뒷걸음질이면 모든 걸음이 180° 어긋나므로
       반드시 걸린다. 코너에서 몸을 트는 한두 걸음에는 안 흔들린다. */
  const norm = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
  const TURN_MS = 300;                      // 출발할 때 몸이 도는 데 0.3~0.4초 걸린다
  let backwards = null;
  {
    let steps = [], why = '걷지 않아 못 쟀습니다';
    for (let tries = 0; tries < 3 && steps.length < 3; tries++) {
      if (!(await page.eval(`window.view.isWalking('jachwi')`))) {
        /* 걷기가 이미 끝나 있었다 — 다시 보낸다(=표본을 다시 찍는다) */
        const again = await walkFarFrom(page, 'jachwi', before);
        if (!again || !again.r || again.r.ok !== true) { why = `다시 걷게 못 했습니다: ${JSON.stringify(again && again.r)}`; break; }
        await sleep(120);
      }
      const raw = await sampleWalk(page, 'jachwi');
      const all = facingSteps(raw);
      /* 출발 회전 구간은 몸이 아직 도는 중이라 뺀다. 뺀 뒤 너무 적으면 전부 쓴다. */
      const late = all.length ? all.filter(o => o.t >= all[0].t + TURN_MS) : [];
      steps = late.length >= 3 ? late : all;
      if (steps.length < 3) why = `표본 ${raw.length}개 중 ${MIN_STEP}m 넘게 움직인 걸음이 ${all.length}개뿐입니다`;
    }
    if (steps.length >= 3) {
      const offs = steps.map(o => o.off).sort((a, b) => a - b);
      const med = offs[offs.length >> 1];
      backwards = med;
      const last = steps[steps.length - 1];
      ok('K 가는 쪽을 보고 걷는다 (뒷걸음질이 아니다)', med < 0.7,
         `걸음 ${offs.length}개 · 어긋남 중앙값 ${(med * 180 / Math.PI).toFixed(0)}° ` +
         `(최소 ${(offs[0] * 180 / Math.PI).toFixed(0)}° 최대 ${(offs[offs.length - 1] * 180 / Math.PI).toFixed(0)}°) · ` +
         `마지막 진행 ${(last.travel * 180 / Math.PI).toFixed(0)}° vs 몸 ${(last.yaw * 180 / Math.PI).toFixed(0)}°`);
    } else ok('K 가는 쪽을 보고 걷는다 (뒷걸음질이 아니다)', false, why);
  }

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

  /* ══ M ★ 터치로도 같은 것이 된다 (폰) ═══════════════════════════════════
     ★ 마우스만 재는 검사는 폰 게임을 절반만 재는 것이다. 여기서 나머지 절반을 잰다. */
  await page.eval(`window.view.stopWalk('jachwi'); window.view.selectCharacter(null); 1`);
  await sleep(400);
  const tf = await page.eval(`window.view.characterScreenPos('jachwi')`);
  if (!tf) {
    ok('M-1 터치로 캐릭터를 고른다', false, '캐릭터가 화면에 안 잡힙니다');
    ok('M-2 터치 뒤 유령 마우스가 고르기를 풀지 않는다', false, '위와 같음');
    ok('M-3 터치로 끌면 걸어간다', false, '위와 같음');
    ok('M-4 고르기 전 터치 드래그는 카메라를 돌린다', false, '위와 같음');
  } else {
    const TX = Math.round(canvasRect.left + tf.x), TY = Math.round(canvasRect.top + tf.y);

    /* M-4 먼저 — 아직 아무도 안 골랐을 때 끌면 카메라가 돈다 */
    const camT0 = await page.eval(`window.view.camera()`);
    await touchDrag(page, Math.round(canvasRect.left + canvasRect.w * 0.5),
                          Math.round(canvasRect.top + canvasRect.h * 0.75),
                          Math.round(canvasRect.left + canvasRect.w * 0.5) + 110,
                          Math.round(canvasRect.top + canvasRect.h * 0.75));
    await sleep(500);
    const camT1 = await page.eval(`window.view.camera()`);
    ok('M-4 고르기 전 터치 드래그는 카메라를 돌린다 (걷지 않는다)',
       Math.abs(camT1.az - camT0.az) > 1e-3 && !(await page.eval(`window.view.isWalking('jachwi')`)),
       `az ${camT0.az.toFixed(3)}→${camT1.az.toFixed(3)}`);

    /* M-1·M-2 터치 탭 — 유령 마우스까지 포함해서 */
    await page.eval(`window.view.selectCharacter(null)`);
    const tf2 = await page.eval(`window.view.characterScreenPos('jachwi')`);
    const AX2 = Math.round(canvasRect.left + tf2.x), AY2 = Math.round(canvasRect.top + tf2.y);
    await touchTap(page, AX2, AY2, false);            // 터치만
    const selPure = await page.eval(`window.view.selectedCharacter()`);
    ok('M-1 터치로 캐릭터를 고른다', selPure === 'jachwi', `selected=${selPure}`);

    await page.eval(`window.view.selectCharacter(null)`);
    await sleep(200);
    await touchTap(page, AX2, AY2, true);             // ★ 폰처럼 유령 마우스까지
    const selGhost = await page.eval(`window.view.selectedCharacter()`);
    ok('M-2 ★터치 뒤 따라오는 유령 마우스가 고르기를 풀지 않는다 (폰에서 게임이 막히던 원인)',
       selGhost === 'jachwi', `selected=${selGhost} — null 이면 폰에서 아무도 안 골라진 채가 된다`);

    /* M-3 터치로 걷기 — 마우스와 **같은 목표**로 간다(목표가 다르면 비교가 안 된다) */
    const beforeT = await page.eval(`window.view.characters().find(c=>c.id==='jachwi').pos`);
    const footT = await page.eval(`window.view.characterScreenPos('jachwi')`);
    const FX2 = Math.round(canvasRect.left + footT.x), FY2 = Math.round(canvasRect.top + footT.y);
    const spotT = await page.eval(`(()=>{
      const out = [];
      for (const [dx,dy] of [[0,55],[45,45],[-45,45],[70,20],[-70,20],[0,90],[60,80],[-60,80]]) {
        const t = window.view.previewWalk('jachwi', ${FX2}+dx, ${FY2}+dy);
        if (t && t.ok) out.push({dx,dy,x:t.x,z:t.z});
      }
      window.view.previewWalk('jachwi', null, null);
      return out;
    })()`);
    const tgt = spotT.sort((a, b) =>
      Math.hypot(b.x - beforeT.x, b.z - beforeT.z) - Math.hypot(a.x - beforeT.x, a.z - beforeT.z))[0];
    if (!tgt) ok('M-3 터치로 끌면 걸어간다', false, '갈 수 있는 자리를 못 찾았습니다');
    else {
      await touchDrag(page, FX2, FY2, FX2 + tgt.dx, FY2 + tgt.dy, 10);
      for (let i = 0; i < 120 && await page.eval(`window.view.isWalking('jachwi')`); i++) await sleep(100);
      const afterT = await page.eval(`window.view.characters().find(c=>c.id==='jachwi').pos`);
      const movedT = Math.hypot(afterT.x - beforeT.x, afterT.z - beforeT.z);
      ok('M-3 터치로 끌면 걸어간다 (마우스와 같은 자리로)', movedT > 0.25, `${movedT.toFixed(2)}m`);
    }
  }

  /* ══ N 가서 · 하고 · 끝난다 — actAt (2026-08-04) ═══════════════════════════
     박사님: "씨앗심기 / 물주기 / 수확하기는 캐릭이 그 위치로 가서 뭔가 모션하면서
              게이지 차면서 완료되게 해줘."
     ★ 여기서 재는 것은 셋이다(지시 그대로).
       ① 가서 → 서서 → 끝난다        ② 못 가는 자리면 실패한다
       ③ 빨리감기에서는 연출을 건너뛴다
     그리고 이 셋보다 더 중요한 것 하나를 더 잰다 —
       ④ **연출이 끝난 뒤에 논리가 돈다.** 중간에 끊기면 논리는 안 돈다(반쯤 준 물은 없다). */
  {
    /* 무대 정리 — 걷기 검사가 남긴 상태를 씻는다 */
    await page.eval(`window.view.stopWalk('jachwi'); window.view.selectCharacter(null); 1`);
    await page.eval(`window.view.setActInstant(false)`);
    await sleep(400);

    /* 동작 하나를 걸고 끝날 때까지 기다린다. 무슨 일이 어떤 **순서**로 났는지 남긴다. */
    const runAct = async (key, kind, extra = '') => {
      await page.eval(`(()=>{ window.__A = { log: [], prog: [], res: null };
        const L = window.__A;
        const p = window.view.actAt(${JSON.stringify('KEY')}.replace('KEY', ${JSON.stringify(key)}), ${JSON.stringify(kind)}, {
          ${extra}
          onProgress: (v, ph) => { L.prog.push([ph, +v.toFixed(3)]); L.log.push('P:' + ph); },
          onArrive:   () => L.log.push('ARRIVE'),
          onDone:     () => L.log.push('DONE'),
          onFail:     (r) => L.log.push('FAIL:' + r) });
        window.__AP = p;
        p.then(r => L.res = r, e => L.res = { threw: String(e && e.message) });
        return 1; })()`);
      for (let i = 0; i < 250; i++) {
        await sleep(100);
        if (await page.eval(`(window.__A.res ? 1 : 0)`)) break;
      }
      return page.eval(`window.__A`);
    };
    /* 씬에 물뿌리개(userData.tip 을 단 그룹)와 물줄기(Points)가 몇 개 떠 있나 */
    const FX = `(()=>{ let pts=0, can=0; window.view.three.scene.traverse(o=>{
        if (o.isPoints) pts++; if (o.isGroup && o.userData && o.userData.tip) can++; });
      return pts * 10 + can; })()`;

    const SLOT = await page.eval(`(()=>{ const s = window.view.slots().find(v => !v.occupied); return s ? s.slotId : null; })()`);
    await page.eval(`window.view.setPlant(${JSON.stringify(SLOT)}, {kind:'beansprout', progress01:0.5, band:'good'}) && 1`);
    await sleep(500);

    /* ── N-1·N-2·N-3 물주기 한 번 ── */
    const A = await runAct(SLOT, 'water');
    const target = await page.eval(`window.view.resolveKey(${JSON.stringify(SLOT)})`);
    const me = await page.eval(`window.view.characters().find(c=>c.id==='jachwi').pos`);
    const gap = Math.hypot(me.x - target.pos.x, me.z - target.pos.z);
    ok('N-1 가서 → 서서 → 끝난다 (물주기)',
       A.res && A.res.ok === true && A.log.includes('DONE'), JSON.stringify(A.res));
    ok('N-1b 대상 곁에 서 있다 (손이 닿는 거리)', gap < 1.45, `${gap.toFixed(2)}m`);
    ok('N-1c 걷는 구간과 모션 구간이 갈린다',
       A.prog.some(p => p[0] === 'walk') && A.prog.some(p => p[0] === 'act'),
       A.prog.slice(0, 3).map(p => p.join('=')).join(' '));

    /* ★ 이 한 줄이 제일 중요하다 — 게이지가 다 찬 **뒤에** 논리가 돈다 */
    const iArrive = A.log.indexOf('ARRIVE'), iDone = A.log.indexOf('DONE');
    const actProg = A.prog.filter(p => p[0] === 'act').map(p => p[1]);
    ok('N-2 ★연출이 끝난 뒤에 논리가 돈다 (ARRIVE → 게이지 → DONE 순서)',
       iArrive >= 0 && iDone > iArrive && A.log[A.log.length - 1] === 'DONE',
       A.log.slice(-4).join(' → '));
    ok('N-3 게이지가 0 에서 1 까지 고르게 찬다',
       actProg.length >= 5 && actProg[0] < 0.35 && actProg[actProg.length - 1] === 1
       && actProg.every((v, i) => i === 0 || v >= actProg[i - 1] - 1e-6),
       `${actProg.length}표본 ${actProg[0]}…${actProg[actProg.length - 1]}`);

    /* ── N-4 물뿌리개·물줄기는 뜨고, 끝나면 사라진다 ── */
    await page.eval(`(()=>{ window.__F = { mid: 0, end: 0 };
      window.view.actAt(${JSON.stringify(SLOT)}, 'water', { onDone: () => 1 })
        .then(() => { window.__F.done = 1; }); return 1; })()`);
    for (let i = 0; i < 250; i++) {
      await sleep(80);
      const st = await page.eval(`JSON.stringify(window.view.actState())`);
      const s = JSON.parse(st || 'null');
      if (s && s.phase === 'act' && s.p01 > 0.3 && s.p01 < 0.8) {
        await page.eval(`window.__F.mid = ${FX}`); break;
      }
      if (await page.eval(`window.__F.done ? 1 : 0`)) break;
    }
    for (let i = 0; i < 250 && !(await page.eval(`window.__F.done ? 1 : 0`)); i++) await sleep(100);
    await sleep(400);
    const F = await page.eval(`(()=>{ window.__F.end = ${FX}; return window.__F; })()`);
    ok('N-4 물주기에는 물뿌리개와 물줄기가 뜬다', F.mid === 11, `pts*10+can = ${F.mid} (11 이어야 한다)`);
    ok('N-4b 끝나면 둘 다 치운다 (드로우콜이 안 샌다)', F.end === 0, `끝난 뒤 ${F.end}`);

    /* ── N-5 못 가는 자리면 실패한다 ──
       ★ 가구 뒤 구석에 화분을 놓는다. floor_nav 의 path 는 못 가는 곳이라도 최대한
         다가간 경로를 주므로, '못 갔다'는 **다 걷고 난 뒤의 거리**로만 잡힌다. */
    const put = await page.eval(`window.view.setPlantAt('probe_far', {x:2.35,y:0,z:1.85,rotY:0},
      {kind:'beansprout', progress01:0.4, band:'good'}).then(()=>'ok', e=>'거절:'+e.message)`);
    if (put !== 'ok') ok('N-5 못 가는 자리면 실패한다', false, `구석에 화분을 못 놓았습니다: ${put}`);
    else {
      await sleep(400);
      const B = await runAct('free:probe_far', 'water');
      ok('N-5 ★못 가는 자리면 실패한다 (가구 뒤 구석)',
         B.res && B.res.ok === false && /못 갑니다|설 데가 없습니다/.test(B.res.reason || ''),
         JSON.stringify(B.res));
      ok('N-5b 실패하면 논리가 안 돈다 (onDone 대신 onFail)',
         !B.log.includes('DONE') && B.log.some(s => String(s).startsWith('FAIL:')),
         B.log.slice(-3).join(' → '));
      ok('N-5c 실패한 뒤에도 이펙트가 안 남는다', (await page.eval(FX)) === 0);
      await page.eval(`window.view.setPlantAt('probe_far', null, null).then(()=>1,()=>1)`);
      await sleep(300);
    }

    /* ── N-6 빨리감기에서는 연출을 건너뛴다 ── */
    const posBefore = await page.eval(`window.view.characters().find(c=>c.id==='jachwi').pos`);
    const t0 = Date.now();
    const C = await runAct(SLOT, 'water', 'instant: true,');
    const dtMs = Date.now() - t0;
    const posAfter = await page.eval(`window.view.characters().find(c=>c.id==='jachwi').pos`);
    const moved = Math.hypot(posAfter.x - posBefore.x, posAfter.z - posBefore.z);
    ok('N-6 ★빨리감기(instant)는 연출을 건너뛴다 — 걷지도 않고 곧바로 끝난다',
       C.res && C.res.ok === true && C.res.instant === true && C.res.ms < 50 && moved < 0.02,
       `${JSON.stringify(C.res)} · 이동 ${moved.toFixed(3)}m · 벽시계 ${dtMs}ms`);
    ok('N-6b 건너뛰어도 논리는 돈다 (DONE 은 그대로 불린다)', C.log.includes('DONE'), C.log.join(' → '));
    ok('N-6c 건너뛰면 걷는 구간이 아예 없다',
       !C.prog.some(p => p[0] === 'walk'), JSON.stringify(C.prog));

    /* setActInstant — 호출마다 안 넘겨도 되는 전역 스위치 */
    await page.eval(`window.view.setActInstant(true)`);
    const D = await runAct(SLOT, 'harvest');
    await page.eval(`window.view.setActInstant(false)`);
    ok('N-6d setActInstant(true) 도 같은 길로 간다 (빨리감기 스위치)',
       D.res && D.res.ok === true && D.res.instant === true && D.res.ms < 50,
       JSON.stringify(D.res));

    /* ── N-7 취소하면 논리가 안 돈다 ── */
    await page.eval(`(()=>{ window.__A = { log: [], prog: [], res: null };
      const L = window.__A;
      const p = window.view.actAt(${JSON.stringify(SLOT)}, 'sow', {
        onDone: () => L.log.push('DONE'), onFail: r => L.log.push('FAIL:' + r) });
      p.then(r => L.res = r, e => L.res = { threw: String(e && e.message) });
      window.__AP = p; return 1; })()`);
    await sleep(700);
    await page.eval(`window.__AP.cancel('검사 취소') && 1`);
    for (let i = 0; i < 60 && !(await page.eval(`window.__A.res ? 1 : 0`)); i++) await sleep(100);
    const E = await page.eval(`window.__A`);
    ok('N-7 ★취소하면 논리가 안 돈다 (반쯤 준 물은 없다)',
       E.res && E.res.ok === false && !E.log.includes('DONE') && E.log.includes('FAIL:검사 취소'),
       `${JSON.stringify(E.res)} · ${E.log.join(' → ')}`);
    ok('N-7b 취소한 뒤에도 이펙트가 안 남는다', (await page.eval(FX)) === 0);

    /* ── N-8 모르는 이름은 던진다(조용히 넘어가지 않는다) ── */
    ok('N-8 모르는 동작 이름은 던진다',
       /모르는 동작/.test(await page.eval(`window.view.actAt(${JSON.stringify(SLOT)},'춤',{}).then(()=>'풀림',e=>e.message)`)));
    ok('N-8b 모르는 슬롯은 던진다',
       /모르는 슬롯/.test(await page.eval(`window.view.actAt('없는자리','water',{}).then(()=>'풀림',e=>e.message)`)));

    /* ── N-9 사람이 없어도 논리는 돈다 ── */
    await page.eval(`window.view.setCharacter(null).then(()=>1)`);
    await sleep(400);
    const G = await runAct(SLOT, 'harvest');
    ok('N-9 캐릭터가 없으면 연출 없이 논리만 돈다 (게임이 막히지 않는다)',
       G.res && G.res.ok === true && G.res.instant === true && G.log.includes('DONE'),
       JSON.stringify(G.res));
    await page.eval(`window.view.setCharacter('jachwi').then(()=>1)`);
    await sleep(500);
  }

  const hard = errs.filter(e => !/favicon/.test(e));
  ok('J 콘솔에 처리 안 된 예외가 없다', hard.length === 0, hard.slice(0, 3).join(' | '));

  await page.close();
  console.log(`\nroomview_walk: ${fail ? 'FAIL' : 'PASS'}  (${pass}/${pass + fail})`);
  process.exit(fail ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
