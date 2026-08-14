/* ============================================================
   tools/probe_outside.mjs — 창밖 동네(src/game/outside.js)가 **공짜인지** 잰다
   ------------------------------------------------------------
   이 도구가 답해야 하는 질문은 "예쁜가"가 아니라 셋이다.

     ① 빛을 건드렸나       씬의 광원 개수·세기·그림자 설정이 붙이기 전후로
                          **비트 단위로 같은가.** 하나라도 다르면 실패다.
                          (조도 엔진 자체는 씬을 아예 안 본다 — occluders 는
                           buildHouse 가 JSON 에서 만든 배열이다. 그래서 여기서는
                           **그림**을 흔드는 경로만 막으면 된다.)
     ② 얼마나 무거운가     삼각형·드로우콜·재질 개수 전/후
     ③ 어떻게 보이나       폰 크기(390×844) 낮·밤 스크린샷

   쓰는 법
     python tools/serve.py 8971
     node tools/probe_outside.mjs                 # 반지하
     node tools/probe_outside.mjs --room oneroom
     node tools/probe_outside.mjs --shot out/     # 스크린샷 폴더

   ⚠ 기본 포트 8981 에 낡은 서버가 물려 있으면 죽는다. BYEOT_URL 로 바꿔라.
============================================================ */
import { launch, sleep } from './test_cdp.mjs';
import { mkdirSync } from 'node:fs';

/* ★자가 제한 — 재는 도구가 재는 대상보다 오래 살면 안 된다.
   헤드리스 크롬은 무언가를 기다리다 영영 안 끝나는 일이 실제로 생긴다. */
const _WATCHDOG_MS = +(process.env.BYEOT_PROBE_TIMEOUT_MS || 300000);
const _wd = setTimeout(() => {
  console.error('⏱ 자가 제한 ' + Math.round(_WATCHDOG_MS / 1000) + '초를 넘겨 멈춥니다 — 재는 중에 멈춘 것입니다.');
  process.exit(2);
}, _WATCHDOG_MS);
/* ★타이머가 프로세스를 붙잡으면 안 된다 — unref 를 빠뜨리면 다 끝낸 도구가 안 죽는다. */
_wd.unref && _wd.unref();
process.on('exit', () => clearTimeout(_wd));

const BASE = process.env.BYEOT_URL || 'http://localhost:8971';
const argv = process.argv.slice(2);
const argOf = (k, d) => { const i = argv.indexOf(k); return i < 0 ? d : argv[i + 1]; };
const ROOM = argOf('--room', 'banjiha');
const SHOT = argOf('--shot', null);
/* ★ --grid <폴더> — 배율×상하각 격자로 찍는다 (2026-08-15)
   "축소했을 때 배경이 차도록"이 이 저장소에서 제일 위험한 요구다. 창밖을 키우면
   방 지붕 위로 솟아 화면을 덮는다. 그러니 **한 각도 한 배율로 확인하면 안 된다** —
   줌 최소·기본·최대 × 상하각 16°·기본·54° 를 전부 찍어 놓고 본다.
   ⚠ 카메라를 코드로 밀어 넣지 않는다. 실제 입력(휠·세로끌기)으로 움직여서
     플레이어가 갈 수 있는 자리만 찍는다 — 못 가는 자리를 찍어 놓고 안심하면 헛일이다. */
const GRID = argOf('--grid', null);
/* 창 크기 — 폰 세로가 기본. --wide 면 PC 가로(줌 아웃 한계가 1.15 → 2.00 으로 다르다) */
const WIDE = argv.includes('--wide');
/* --as-is — 밖에서 붙이지 않는다. **게임이 지금 보여 주는 그대로**를 잰다.
   (이 도구는 원래 room_view 가 안 붙였으면 대신 붙여 봤다. 그러면 room_view 가 붙인 것과
    겹쳐 두 벌이 동시에 서는 수가 있는데, 그 상태를 "지금 화면"이라 부르면 거짓말이 된다) */
const AS_IS = argv.includes('--as-is');

/* 씬의 빛 상태를 하나의 문자열로 굳힌다 — 비교는 눈이 아니라 문자열이 한다 */
const LIGHTS = `(() => {
  const out = [];
  window.view.three.scene.traverse(o => {
    if (!o.isLight) return;
    out.push([o.type, o.name || '', +o.intensity.toFixed(9),
              o.color ? o.color.getHexString() : '',
              o.position.toArray().map(v => +v.toFixed(6)).join(','),
              !!o.castShadow, o.distance == null ? '' : +(o.distance || 0).toFixed(6),
              o.decay == null ? '' : +(o.decay || 0).toFixed(6)].join('|'));
  });
  const r = window.view.three.renderer;
  out.push('renderer|' + r.toneMapping + '|' + (+r.toneMappingExposure.toFixed(9)) +
           '|' + r.shadowMap.enabled + '|' + r.shadowMap.type);
  const s = window.view.three.scene;
  out.push('bg|' + (s.background && s.background.getHexString ? s.background.getHexString() : 'none'));
  out.push('fog|' + (s.fog ? s.fog.color.getHexString() + ',' + s.fog.near + ',' + s.fog.far : 'none'));
  return out.sort().join('\\n');
})()`;

/* 한 장 그린 뒤 renderer.info — ★ 반드시 redraw 와 같은 틱이어야 한다 */
const INFO = `(() => {
  const v = window.view, r = v.three.renderer;
  v.redraw();
  const mats = new Set(); let meshes = 0;
  v.three.scene.traverse(o => { if (o.isMesh || o.isLine || o.isPoints) { meshes++;
    (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m && mats.add(m.uuid)); } });
  return { tris: r.info.render.triangles, calls: r.info.render.calls,
           progs: r.info.programs ? r.info.programs.length : -1,
           meshes, mats: mats.size,
           geos: r.info.memory.geometries, texs: r.info.memory.textures };
})()`;

const num = (v) => String(v).padStart(8);

/* ── 카메라를 실제 입력으로 몬다 ────────────────────────────────
   방뷰에는 카메라를 각도로 세우는 창구가 없다(일부러 없다 — 손가락으로만 돈다).
   그래서 휠과 세로끌기를 그대로 흉내 낸다. 한 번에 못 맞으면 몇 번 더 민다. */
/* ★ 한 번 크게 나갔다 돌아온다.
   방뷰는 **28px 을 못 넘긴 마우스 움직임을 「탭」으로 읽는다**(TAP_PX_MOUSE).
   상하각을 조금만 바꾸려면 22px 이면 되는데, 그러면 회전이 아니라 클릭이 되어
   각이 그대로다 — 처음에 이걸 몰라 54°(EL_MAX)에 영영 못 갔다(49°에서 멈췄다).
   그래서 한 제스처 안에서 150px 더 갔다가 목표로 되돌아온다. 문턱은 넘고 값은 정확하다. */
const DRAG = (dy) => `(()=>{ const c=document.getElementById('roomCanvas');
  const far = (${dy}) + 150 * ((${dy}) >= 0 ? 1 : -1);
  c.dispatchEvent(new MouseEvent('mousedown',{clientX:195,clientY:420,bubbles:true}));
  for (let i=1;i<=8;i++) window.dispatchEvent(new MouseEvent('mousemove',
    {clientX:195,clientY:420+far*i/8,bubbles:true}));
  for (let i=1;i<=8;i++) window.dispatchEvent(new MouseEvent('mousemove',
    {clientX:195,clientY:420+far+((${dy})-far)*i/8,bubbles:true}));
  window.dispatchEvent(new MouseEvent('mouseup',{clientX:195,clientY:420+(${dy}),bubbles:true})); })()`;
const WHEEL = (n) => `(()=>{ const c=document.getElementById('roomCanvas');
  for (let i=0;i<${Math.abs(n)};i++)
    c.dispatchEvent(new WheelEvent('wheel',{deltaY:${n >= 0 ? 120 : -120},bubbles:true,cancelable:true})); })()`;

async function driveCam(page, elWant, zoomWant) {
  /* elWant: 라디안 · zoomWant: 'in' | 'fit' | 'out' | 숫자(fit 대비 배율) */
  for (let round = 0; round < 4; round++) {
    const c = await page.eval(`window.view.camera()`);
    const zr = zoomWant === 'in' ? 0.58 : zoomWant === 'out' ? 99 : zoomWant === 'fit' ? 1 : +zoomWant;
    const distWant = (c.fit || c.dist) * zr;
    const dEl = elWant - c.el;
    if (Math.abs(dEl) > 0.01) { await page.eval(DRAG(dEl / 0.004), false); await sleep(420); }
    const c2 = await page.eval(`window.view.camera()`);
    const ratio = distWant / c2.dist;
    if (Math.abs(Math.log(ratio)) > 0.02) {
      const n = Math.round(Math.log(ratio) / Math.log(1.08));
      await page.eval(WHEEL(n), false); await sleep(320);
    }
    const c3 = await page.eval(`window.view.camera()`);
    if (Math.abs(c3.el - elWant) < 0.02 && Math.abs(Math.log(distWant / c3.dist)) < 0.05) break;
  }
  await sleep(300);
  return page.eval(`window.view.camera()`);
}

async function main() {
  const page = await launch(WIDE ? { width: 1280, height: 800, dpr: 1, mobile: false }
                                 : { width: 390, height: 844, dpr: 2, mobile: false });
  page.on((m, p) => { if (m === 'Runtime.exceptionThrown') console.log('EX ' + p.exceptionDetails.text); });
  await page.goto(`${BASE}/tools/room_view_demo.html?room=${ROOM}`);
  await page.waitFor('!!window.view', 180000, 200);
  /* ★ 데모는 캔버스를 **폰 틀**(390×844) 안에 넣는다. 창을 넓혀도 캔버스는 그대로라
     줌 아웃 한계가 폰 값(1.15)에서 안 움직인다 — 그걸 모르고 "PC 도 1.15 더라"고
     적을 뻔했다. 넓은 화면은 데모의 .wide 틀(844×475)로 바꿔야 한다. */
  if (WIDE) {
    await page.eval(`(() => { document.getElementById('phone').classList.add('wide');
                              window.view.resize(); window.view.redraw(); return 1; })()`);
    await sleep(400);
  }
  await page.eval(`window.view.focusSlot(null, true); window.view.redraw(); 1`);
  await sleep(500);

  console.log(`\n방=${ROOM} · 390×844 dpr2 · ${BASE}`);

  /* ── 붙이기 전 ── */
  const before = { info: await page.eval(INFO), lights: await page.eval(LIGHTS) };

  /* ── 붙인다 ──
     room_view.js 가 이미 붙여 놓았으면 그것을 잰다(그게 진짜 게임 화면이다).
     아직 안 붙었으면 여기서 **밖에서** 붙여 본다 — 그 파일은 다른 작업자 것이라
     이 도구가 그 편집을 기다리지 않아도 되게 해 둔다.
     ★ 창 치수는 유리 메시가 아니라 **방 데이터**에서 읽는다. 유리는 창틀 두께만큼
       작아서(banjiha 0.55 → 0.37) 창턱 높이가 9cm 어긋난다. */
  const attached = await page.eval(`(async () => {
    const v = window.view, b = v.roomSize();
    if (v.three.outside) return { already: true, stats: v.three.outside.stats };
    if (${AS_IS}) return { already: true, asIs: true, stats: { note: 'room_view 가 안 붙였다', tris: 0 } };
    const j = await fetch(new URL('../data/house_rooms.json', location.href)).then(r => r.json());
    const raw = (j.rooms || j)['${ROOM}'];
    const wins = (raw.windows || []).map(w => ({ wall: w.wall, cu: w.cu || 0, cy: w.cy, w: w.w, h: w.h }));
    window.__win = wins.slice().sort((a, c) => c.w * c.h - a.w * a.h)[0];
    const m = await import('../src/game/outside.js');
    const h = m.attachOutside(v.three, { size: b, luxWins: wins }, '${ROOM}',
                              () => window.__t == null ? 0.5 : window.__t);
    return { already: false, wins, stats: h && h.stats };
  })()`);
  /* room_view 가 이미 붙여 놓았다면 창 정보를 여기서 따로 읽어 둔다(눈높이 촬영용) */
  await page.eval(`(async () => {
    if (window.__win) return 1;
    const j = await fetch(new URL('../data/house_rooms.json', location.href)).then(r => r.json());
    const raw = (j.rooms || j)['${ROOM}'];
    window.__win = (raw.windows || []).map(w => ({ wall: w.wall, cu: w.cu || 0, cy: w.cy, w: w.w, h: w.h }))
                    .sort((a, c) => c.w * c.h - a.w * a.h)[0];
    return 1;
  })()`);
  if (!attached || !attached.stats) { console.log('★ 붙이지 못했습니다', JSON.stringify(attached)); await page.close(); process.exit(1); }
  console.log(attached.already ? '(room_view 가 이미 붙여 놓았다 — 그것을 잰다)'
                               : '창 ' + JSON.stringify(attached.wins));
  console.log('창밖: ' + JSON.stringify(attached.stats));

  await sleep(200);
  const after = { info: await page.eval(INFO), lights: await page.eval(LIGHTS) };

  /* ── ① 빛 ── */
  console.log('\n── ① 빛을 건드렸나 ─────────────────────────────');
  if (before.lights === after.lights) {
    console.log('  ✔ 광원·노출·그림자·배경·안개 — 붙이기 전후 **글자 하나까지 같다**');
  } else {
    console.log('  ✘ 달라졌다:');
    const A = before.lights.split('\n'), Bl = after.lights.split('\n');
    const all = new Set([...A, ...Bl]);
    for (const l of all) if (!A.includes(l) || !Bl.includes(l))
      console.log('     ' + (A.includes(l) ? '- ' : '+ ') + l);
  }
  const cast = await page.eval(`(() => { const m = window.view.three.scene.getObjectByName('__outside');
    return m ? { castShadow: m.castShadow, receiveShadow: m.receiveShadow,
                 lit: !!(m.material.lights), type: m.material.type,
                 raycastNoop: m.raycast.toString().length < 40 } : null; })()`);
  console.log('  창밖 메시: ' + JSON.stringify(cast));
  if (cast && (cast.castShadow || cast.lit)) console.log('  ✘ 그림자를 던지거나 빛을 받는다 — 방이 어두워진다');

  /* ── ② 무게 ── */
  console.log('\n── ② 얼마나 무거운가 ────────────────────────────');
  console.log('구간         삼각형  드로우콜   메시   재질  지오메트리  텍스처');
  const row = (n, i) => `${n.padEnd(10)}${num(i.tris)}${num(i.calls)}${num(i.meshes)}${num(i.mats)}${num(i.geos)}${num(i.texs)}`;
  console.log(row('전', before.info));
  console.log(row('후', after.info));
  const d = {
    tris: after.info.tris - before.info.tris, calls: after.info.calls - before.info.calls,
    meshes: after.info.meshes - before.info.meshes, mats: after.info.mats - before.info.mats
  };
  console.log(row('차이', { tris: (d.tris >= 0 ? '+' : '') + d.tris, calls: (d.calls >= 0 ? '+' : '') + d.calls,
                            meshes: (d.meshes >= 0 ? '+' : '') + d.meshes, mats: (d.mats >= 0 ? '+' : '') + d.mats,
                            geos: after.info.geos - before.info.geos, texs: after.info.texs - before.info.texs }));
  const bad = [];
  if (d.tris > 3000) bad.push(`삼각형 +${d.tris} — 예산 3000 초과`);
  if (d.calls > 8) bad.push(`드로우콜 +${d.calls} — 예산 8 초과`);
  if (after.info.texs !== before.info.texs) bad.push('텍스처가 늘었다 — 에셋 금지');
  if (before.lights !== after.lights) bad.push('빛이 달라졌다');
  console.log(bad.length ? '  ✘ ' + bad.join(' · ') : '  ✔ 예산 안 (삼각형 ≤3000 · 드로우콜 ≤8 · 텍스처 0)');

  /* ── ③ 낮밤 ── */
  console.log('\n── ③ 낮밤이 따라오나 ───────────────────────────');
  const sample = async (t) => page.eval(`(() => {
    window.__t = ${t};
    window.view.setDaylight(${t});
    window.view.redraw();
    const cv = document.getElementById('roomCanvas');
    const c2 = document.createElement('canvas');
    const g2 = c2.getContext('2d', { willReadFrequently: true });
    c2.width = cv.width; c2.height = cv.height;
    g2.drawImage(cv, 0, 0);
    /* 창 유리 한가운데 — 창밖이 찍히는 자리 */
    const out = [];
    for (const g of (window.view.three.glassMeshes || [])) {
      const p = new THREE.Vector3(); g.getWorldPosition(p);
      const q = p.clone().project(window.view.three.cam);
      const sx = Math.round((q.x * 0.5 + 0.5) * c2.width), sy = Math.round((-q.y * 0.5 + 0.5) * c2.height);
      const n = 26, x0 = Math.max(0, sx - 13), y0 = Math.max(0, sy - 13);
      const dd = g2.getImageData(x0, y0, Math.min(n, c2.width - x0), Math.min(n, c2.height - y0)).data;
      let s = 0, k = 0;
      for (let i = 0; i < dd.length; i += 4) { s += 0.2126 * dd[i] + 0.7152 * dd[i + 1] + 0.0722 * dd[i + 2]; k++; }
      if (k) out.push(+(s / k).toFixed(1));
    }
    return out.length ? out[0] : null;
  })()`);
  const dayL = await sample(0.45), nightL = await sample(0.92);
  console.log(`  창유리 휘도  낮(t=0.45) ${dayL}   밤(t=0.92) ${nightL}` +
              (dayL != null && nightL != null ? `   밤/낮 ${(nightL / dayL * 100).toFixed(0)}%` : ''));
  if (dayL != null && nightL != null && nightL >= dayL)
    console.log('  ✘ 밤이 낮보다 밝다 — 창밖 색표를 다시 보라');

  /* ── ④ 지나가는 발 ── */
  console.log('\n── ④ 지나가는 발 ────────────────────────────────');
  const walk = await page.eval(`(async () => {
    const h = window.view.three.outside;
    if (!h || !h.stats.walker) return { has: false };
    /* 좌표가 실제로 움직이나 — 그린 프레임에 얹혀서만 움직여야 한다 */
    const m = window.view.three.scene.getObjectByName('__outside');
    const P = m.geometry.attributes.position.array;
    const snap = () => Array.from(P.slice(P.length - 120)).map(v => +v.toFixed(4)).join(',');
    /* 먼저 몇 장 그려 둔다 — 0.25초 넘게 안 그리면 "방이 놀고 있었다"로 보고
       걷던 사람을 치우게 돼 있다. 그 규칙 때문에 식은 상태에서 부르면 바로 접힌다. */
    for (let i = 0; i < 6; i++) { window.view.redraw(); await new Promise(r => setTimeout(r, 30)); }
    /* ① 그리는 동안에는 움직인다 */
    h.walkNow();
    const seen = new Set();
    for (let i = 0; i < 14; i++) { window.view.redraw(); await new Promise(r => setTimeout(r, 40)); seen.add(snap()); }
    /* ② 안 그리는 동안에는 멈춰 있다 — 다시 그려 달라고 안 하기 때문이다 */
    const a = snap();
    await new Promise(r => setTimeout(r, 700));
    return { has: true, stillFrozen: snap() === a, poses: seen.size, walking: h.walking() };
  })()`);
  if (!walk.has) console.log('  이 방에는 안 넣었다 (지상층 — 창이 길보다 3.6m 위라 발이 안 보인다)');
  else {
    console.log(`  안 그리는 동안 멈춰 있나 ${walk.stillFrozen ? '✔ 예' : '✘ 아니오 — 놀 때도 움직인다'}`);
    console.log(`  그리는 동안 자세가 바뀌나 ${walk.poses > 3 ? '✔ 예 (' + walk.poses + '가지)' : '✘ 아니오 (' + walk.poses + ')'}`);
    if (!walk.stillFrozen) bad.push('노는 화면에서도 움직인다 — needsRender 절약이 깨진다');
    if (!(walk.poses > 3)) bad.push('그려도 발이 안 움직인다');
  }

  /* ── ⑤ 그림 ── */
  if (SHOT) {
    mkdirSync(SHOT, { recursive: true });
    for (const [t, tag] of [[0.45, 'day'], [0.92, 'night']]) {
      await page.eval(`(() => { window.__t = ${t}; window.view.setDaylight(${t}); window.view.redraw(); })()`, false);
      await sleep(250);
      const f = `${SHOT}/outside-${ROOM}-${tag}.png`;
      await page.shot(f);
      console.log('  📷 ' + f);
    }

    /* ★ 창 자리에 카메라를 두고 밖을 본다.
       "반지하의 눈높이에서 그렸나"는 게임 카메라(45° 위)로는 확인이 안 된다.
       창 안쪽에 서서 밖을 봐야 길바닥이 눈높이인지가 보인다.
       ⚠ 방 뷰의 카메라를 직접 옮긴다 — 찍고 나서 방 뷰가 다시 잡으므로 되돌릴 필요는 없다. */
    for (const [t, tag] of [[0.45, 'day'], [0.92, 'night']]) {
      /* ★ rAF 루프를 먼저 멈춘다 — 안 그러면 찍기 전에 방 뷰가 제 카메라로 다시 그린다
         (처음에 이걸 빠뜨려 눈높이 사진이 평범한 방 사진으로 나왔다) */
      await page.eval(`window.view.setPaused(true)`, false);
      await page.eval(`(() => {
        window.__t = ${t}; window.view.setDaylight(${t});
        const v = window.view, ctx = v.three, b = v.roomSize();
        const j = window.__win;
        const c = ctx.cam, fov0 = c.fov;
        /* 창 중심에서 방 안쪽으로 0.45m — 사람이 창에 붙어 밖을 보는 자리 */
        const N = { back: [0, 0, 1], front: [0, 0, -1], left: [1, 0, 0], right: [-1, 0, 0] }[j.wall];
        const half = (j.wall === 'back' || j.wall === 'front') ? b.d / 2 : b.w / 2;
        const o = [ -N[0] * half, j.cy, -N[2] * half ];
        if (j.wall === 'back' || j.wall === 'front') o[0] += j.cu; else o[2] += j.cu;
        c.position.set(o[0] + N[0] * 0.45, j.cy, o[2] + N[2] * 0.45);
        c.lookAt(o[0] - N[0] * 6, j.cy - 0.55, o[2] - N[2] * 6);
        c.fov = 62; c.updateProjectionMatrix(); c.updateMatrixWorld();
        ctx.renderer.render(ctx.scene, c);
        c.fov = fov0; c.updateProjectionMatrix();
      })()`, false);
      await sleep(150);
      const f = `${SHOT}/outside-${ROOM}-eye-${tag}.png`;
      await page.shot(f);
      console.log('  📷 ' + f + '  (창 눈높이)');
      await page.eval(`window.view.setPaused(false)`, false);
    }

    /* 지나가는 발 — 창 눈높이에서 걸어가는 중을 한 장 */
    const gotWalk = await page.eval(`!!(window.view.three.outside && window.view.three.outside.stats.walker)`);
    if (gotWalk) {
      await page.eval(`window.view.setPaused(true)`, false);
      await page.eval(`(() => {
        window.__t = 0.45; window.view.setDaylight(0.45);
        const v = window.view, ctx = v.three, b = v.roomSize(), j = window.__win;
        const c = ctx.cam, N = { back: [0,0,1], front: [0,0,-1], left: [1,0,0], right: [-1,0,0] }[j.wall];
        const half = (j.wall === 'back' || j.wall === 'front') ? b.d / 2 : b.w / 2;
        const o = [-N[0] * half, j.cy, -N[2] * half];
        if (j.wall === 'back' || j.wall === 'front') o[0] += j.cu; else o[2] += j.cu;
        c.position.set(o[0] + N[0] * 0.45, j.cy, o[2] + N[2] * 0.45);
        c.lookAt(o[0] - N[0] * 6, j.cy - 0.55, o[2] - N[2] * 6);
        c.fov = 62; c.updateProjectionMatrix(); c.updateMatrixWorld();
        window.__eyeDraw = () => { c.updateMatrixWorld(); ctx.renderer.render(ctx.scene, c); };
        window.__eyeDraw();
      })()`, false);
      /* ★ 먼저 **꾸준히 그려** 둔다 — 0.25초 넘게 안 그리면 걷던 사람을 치우는 규칙이 있어서
         식은 상태에서 walkNow 를 부르면 첫 프레임에 바로 접힌다(찍어 보고 알았다). */
      for (let i = 0; i < 8; i++) { await page.eval(`window.__eyeDraw()`, false); await sleep(40); }
      await page.eval(`window.view.three.outside.walkNow()`, false);
      /* ★ 실제 시간이 흘러야 사람이 걷는다(그린 프레임 사이의 실제 시간으로만 움직인다).
         한 틱에 몰아 그리면 제자리다 — 화면 한가운데(절반쯤)에 올 때까지 실제로 기다린다. */
      for (let i = 0; i < 30; i++) { await page.eval(`window.__eyeDraw()`, false); await sleep(50); }
      await sleep(40);
      const f = `${SHOT}/outside-${ROOM}-eye-walk.png`;
      await page.shot(f);
      console.log('  📷 ' + f + '  (지나가는 발)');
      await page.eval(`window.view.setPaused(false)`, false);
    }
  }

  /* ── ⑥ 배율×상하각 격자 ── ★ "축소하면 배경이 차도록"을 확인하는 자 ── */
  if (GRID) {
    mkdirSync(GRID, { recursive: true });
    await page.eval(`(() => { window.__t = 0.45; window.view.setDaylight(0.45); })()`, false);
    console.log('\n── ⑥ 배율×상하각 격자 ' + (WIDE ? '(PC 1280×800)' : '(폰 390×844)') + ' ──');
    const ELS = [['low', 0.28], ['mid', 0.86], ['high', 0.95]];
    const ZS = [['in', 'in'], ['fit', 'fit'], ['out', 'out']];
    for (const [en, ev] of ELS) for (const [zn, zv] of ZS) {
      const c = await driveCam(page, ev, zv);
      await page.eval(`window.view.redraw()`, false);
      await sleep(160);
      const f = `${GRID}/grid-${WIDE ? 'pc' : 'phone'}-${en}-${zn}.png`;
      await page.shot(f);
      console.log(`  📷 ${f}   상하각 ${(c.el * 180 / Math.PI).toFixed(0)}° · 거리 ${c.dist.toFixed(2)}m (fit ${(c.fit || 0).toFixed(2)} · ×${(c.dist / (c.fit || c.dist)).toFixed(2)})`);
    }
  }

  await page.close();
  process.exit(bad.length ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
