/* ============================================================
   tools/test_lampmove.mjs — 식물등 옮기기 (house 소유)
   ------------------------------------------------------------
   증명 대상 (docs/handoff/lampmove-to-plan.md):

     1부 · 조도 (헤드리스, 브라우저 없이)
       ① 회귀    아무것도 안 옮기면 반지하 14칸 × 등 0/1/2개의 PPFD·DLI 가
                 **한 톨도 안 바뀐다**(test_lampaim 의 표와 같은 값, 허용치 없음)
       ② 물림    집게등을 창턱에 물리면 **창턱 DLI 가 무늬종 문턱 8.4 를 넘는다**
                 — 이 작업이 푸는 문제가 이 한 줄이다
       ③ 높이    `adjustable_height` 가 살아 있다 — 들어 올리면 값이 실제로 움직인다
       ④ 되돌림  덮어쓰기를 지우면 ① 표로 **정확히** 복귀한다
       ⑤ 세이브  자리가 `S.home.furniture[uid] = {x,z,rot,y}` 로 왕복한다
       ⑥ 바 등   붙박이다 — `movable` 이 없고 `liftRange` 도 없다
       ⑦ 스탠드  `y` 를 안 적으면 **바닥에 선다** = 가구 목록(furnNodes) 조건을 만족한다
                 ⇒ 스탠드는 새 길이 필요 없다. 기존 가구 옮기기가 이미 옮긴다

     2부 · 방 뷰 계약 (진짜 브라우저 · test_roomview_place 와 같은 방식)
       A 목록    `lamps()` 에 집게등만 있다 — **바 등·천장등은 없다**
       B 물림자리 `lampMounts()` 가 창턱·책상·서랍장·선반 3단을 낸다
       C 공중    못 물리는 자리는 **막힌다**(ok:false) — 방 한가운데 허공
       D 바 등   `commitLampAt` 이 **던진다**(조용히 무시하지 않는다)
       E 옮기기  옮기면 3D 도 `lightRigs()` 도 **같은 새 좌표**를 본다
       F 높이    범위 밖 lift 는 막힌다
       G 스크린샷 docs/engine/shots/lampmove_{before,after}.png
       H 콘솔    처리 안 된 예외가 없다

     node tools/test_lampmove.mjs                 ← 1부만 (브라우저 없이)
     python tools/serve.py 8967
     BYEOT_URL=http://localhost:8967 node tools/test_lampmove.mjs
   ⚠ BYEOT_URL 을 안 넘기면 2부를 건너뛴다 — 남의 포트에 붙어 **남의 코드를 재는 것**보다
     안 재는 편이 낫다. 건너뛴 사실은 끝에 크게 찍는다.
============================================================ */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const toUrl = (rel) => 'file:///' + path.join(ROOT, rel).replace(/\\/g, '/');
const dataOf = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', rel), 'utf8'));

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log(`PASS  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}${extra ? '  — ' + extra : ''}`); }
};

/* ── 캔버스·문서 스텁 (test_lampaim 과 같은 것) ── */
const stubCtx = () => new Proxy({}, { get: (t, k) => {
  if (k === 'createImageData' || k === 'getImageData')
    return (w = 1, h = 1) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h });
  if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop() {} });
  if (k === 'measureText') return () => ({ width: 0 });
  return () => {};
} });
const stubEl = () => ({ style: {}, dataset: {}, appendChild() {}, setAttribute() {},
                        addEventListener() {}, getContext: () => stubCtx() });
globalThis.document = {
  createElement: (t) => (t === 'canvas'
    ? { width: 1, height: 1, style: {}, getContext: () => stubCtx(), toDataURL: () => '' } : stubEl()),
  createElementNS: () => stubEl(), addEventListener() {}, getElementById: () => null,
  querySelector: () => null, querySelectorAll: () => [], body: stubEl(), documentElement: stubEl()
};
globalThis.window = globalThis;
globalThis.self = globalThis;
vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'vendor', 'three', 'three.min.js'), 'utf8'));

const { createLightEngine } = await import(toUrl('src/game/light_adapter.js'));
const { ppfdSum } = await import(toUrl('src/render3d/lighting_sim.js'));
const { newState, setFurniturePlacement } = await import(toUrl('src/game/state.js'));
const { serialize, deserialize } = await import(toUrl('src/game/save.js'));

const BASE_DATA = () => ({
  houseRooms: dataOf('house_rooms.json'), winPresets: dataOf('window_presets.json').presets,
  doorPresets: dataOf('door_presets.json').presets, finishes: dataOf('room_finishes.json'),
  furnPresets: dataOf('furniture_presets.json').presets, lightPresets: dataOf('lighting_presets.json'),
  shadePresets: dataOf('shading_presets.json'), lightTh: dataOf('balance/light_thresholds.json'),
  weatherBalance: dataOf('balance/weather.json')
});
const eng = createLightEngine(BASE_DATA());
eng.build('banjiha');

const CLIP = 'banjiha-growlight-clip', BAR = 'banjiha-growlight-bar';
const SILL = 'banjiha-sill:0';
const SKY = { weather: 'clear', season: 'summer', litHours: 12 };
/* ★★★ 2026-08-16 (G-16) — **문턱이 6.0 에서 8.4 로 올라갔다. 값이 아니라 자리가 바뀌어서다.**
   박사님이 첫 등을 「몬스테라 위쪽으로」 옮기라 하셔서 `banjiha-growlight-bar` 가
   3단 선반 밑 → 창 위 벽으로 갔다(`data/house_rooms.json`). 그래서 **붙박이 등만으로도
   창턱이 7.07** 이 되어 초록형 문턱 6.0 을 이미 넘는다.
   ⇒ 「등을 옮기면 창턱이 산다」를 재려면 이제 **무늬종 문턱 8.4**(6.0 × need_mult 1.4)를
     봐야 한다. 문턱을 낮춰 통과시키는 것이 아니라, **이 검사가 증명하던 그 일**
     (「옮겨야 넘는 선이 있다」)이 한 칸 위로 옮겨 간 것이다.
   ⚠ 6.0 을 그대로 두면 ② 가 「옮기기 전에 이미 넘었다」로 빨개지고, 그걸 통과시키려고
     옮기기 로직을 건드리면 **고장 안 난 것을 고치게 된다.** */
const THRESHOLD = 6.0 * 1.4;                 // 무늬종 갈라짐 8.4 (growth_tuning §variegated.need_mult)
const rigOf = (uid) => eng.room.built.lightRigs.find(r => r.uid === uid);
const reset = () => { eng.setFurnitureOverrides({}); eng.setLampAims({}); eng.clearCache(); };
/* ⚠ 겨누기도 같이 지운다 — 안 지우면 앞 검사가 돌려 놓은 각도가 다음 검사에 새어 든다
   (실제로 샜다: ②-d 의 훑기가 tilt 75° 를 남겨 ③ 의 값이 통째로 달랐다). */
const put = (over) => { eng.setFurnitureOverrides(over); eng.setLampAims({}); eng.clearCache(); };
const dli = (slotId, n) => eng.dliOfSlot(slotId, { ...SKY, lampCount: n });

/* ══ ① 회귀 ═══════════════════════════════════════════════════════════════
   test_lampaim.mjs §① 과 **글자 그대로 같은 표**다. 두 검사가 같은 값을 지킨다 —
   한쪽만 고쳐서 통과시키는 길을 막으려고 일부러 두 벌을 둔다. */
/* ★★ 2026-08-15 갱신 — 추천 자리를 칸 한가운데로 옮겼다(박사님 허락).
   까닭·폭은 `test_floorlight` §① 머리말, 「등 물리는 안 건드렸다」의 증거는
   `test_lampaim` §BEFORE 머리말에 적어 두었다. 여기는 값만 둔다.
   다시 뽑는 문: `BYEOT_REGEN=1 node tools/test_lampmove.mjs` (lampaim 것과 같은 표가 나와야 한다) */
/* ★★★ 2026-08-16 갱신 — **G-16. 첫 등을 몬스테라 위로 옮겼다.**
   까닭·갈라 적은 어긋남(어디까지가 G-16 이고 어디부터가 B-1·B-6 인지)은
   `test_lampaim` §BEFORE 머리말에 있다. 여기는 값만 둔다 — 두 표는 글자 그대로 같아야 한다. */
const BEFORE = {
  'banjiha-sill:0':     { ppfd: [0, 52.604525, 53.477745], dli: [4.8, 7.07, 7.11] },
  'banjiha-desk:0':     { ppfd: [0, 6.464065, 24.159566],  dli: [0.61, 0.89, 1.65] },
  'banjiha-desk:1':     { ppfd: [0, 3.261011, 26.510409],  dli: [0.18, 0.32, 1.32] },
  'banjiha-dresser:0':  { ppfd: [0, 1.216627, 2.266042],   dli: [0.06, 0.11, 0.16] },
  'banjiha-dresser:1':  { ppfd: [0, 0.901646, 1.544899],   dli: [0.04, 0.08, 0.11] },
  'banjiha-etagere:0':  { ppfd: [0, 3.94717, 5.541377],    dli: [0.13, 0.3, 0.37] },
  'banjiha-etagere:1':  { ppfd: [0, 4.172122, 6.161167],   dli: [0.14, 0.32, 0.4] },
  'banjiha-etagere:2':  { ppfd: [0, 4.287694, 6.813442],   dli: [0.13, 0.31, 0.42] },
  'banjiha-etagere:3':  { ppfd: [0, 5.591329, 7.341375],   dli: [0.22, 0.46, 0.54] },
  'banjiha-etagere:4':  { ppfd: [0, 6.054186, 8.297927],   dli: [0.22, 0.48, 0.58] },
  'banjiha-etagere:5':  { ppfd: [0, 6.300717, 9.264352],   dli: [0.21, 0.49, 0.61] },
  'banjiha-etagere:6':  { ppfd: [0, 8.419273, 10.267717],  dli: [0.51, 0.87, 0.95] },
  'banjiha-etagere:7':  { ppfd: [0, 9.51673, 11.927482],   dli: [0.48, 0.89, 1] },
  'banjiha-etagere:8':  { ppfd: [0, 10.140864, 13.409602], dli: [0.48, 0.92, 1.06] }
};

/* 새 값을 뽑을 때 쓴다: BYEOT_REGEN=1 node tools/test_lampmove.mjs
   ⚠ 손으로 숫자를 적지 마라. 이 표는 `test_lampaim` §① 과 **글자 그대로 같아야** 한다 —
     둘 다 이 문으로 뽑아라. */
if (process.env.BYEOT_REGEN) {
  reset();
  for (const s of eng.room.slots) {
    const pt = { x: s.x, y: s.y, z: s.z };
    const pp = [0, 1, 2].map(n => +ppfdSum(eng.room.growRigs.slice(0, n), pt).toFixed(6));
    const dd = [0, 1, 2].map(n => +dli(s.slotId, n).toFixed(6));
    console.log(`  '${s.slotId}':${' '.repeat(Math.max(0, 21 - s.slotId.length))}` +
                `{ ppfd: [${pp.join(', ')}], dli: [${dd.join(', ')}] },`);
  }
  process.exit(0);
}

function regressionDiff() {
  reset();
  const bad = [];
  for (const s of eng.room.slots) {
    const want = BEFORE[s.slotId];
    if (!want) { bad.push(`${s.slotId}: 표에 없는 자리`); continue; }
    const pt = { x: s.x, y: s.y, z: s.z };
    for (const n of [0, 1, 2]) {
      const p = +ppfdSum(eng.room.growRigs.slice(0, n), pt).toFixed(6);
      if (p !== want.ppfd[n]) bad.push(`${s.slotId} ppfd[${n}] ${p} ≠ ${want.ppfd[n]}`);
      const d = +dli(s.slotId, n).toFixed(6);
      if (d !== want.dli[n]) bad.push(`${s.slotId} dli[${n}] ${d} ≠ ${want.dli[n]}`);
    }
  }
  return bad;
}

console.log('── 1부 · 조도 (헤드리스) ─────────────────────────────────');
{
  const bad = regressionDiff();
  ok('① 회귀 — 아무것도 안 옮기면 14칸 × 등 0/1/2 가 한 톨도 안 바뀐다',
     bad.length === 0, bad.slice(0, 4).join(' / '));
}

/* ══ ② 물림 — 집게등을 창턱에 물리면 창턱이 산다 ═══════════════════════════ */
const SILL_TOP = 1.585;                       // banjiha-sill 상판 (plantSlots 에서 온 값)
const beforeSill = (() => { reset(); return [0, 1, 2].map(n => dli(SILL, n)); })();
put({ [CLIP]: { x: 0, z: -1.95, rot: 0, y: SILL_TOP } });
const afterSill = [0, 1, 2].map(n => dli(SILL, n));
ok(`② 물림 — 집게등을 창턱에 물리면 창턱 DLI 가 문턱 ${THRESHOLD} 을 넘는다 ` +
   `(${beforeSill[2]} → ${afterSill[2]})`,
   beforeSill[2] < THRESHOLD && afterSill[2] > THRESHOLD,
   `옮기기 전 ${beforeSill[2]} · 옮긴 뒤 ${afterSill[2]}`);
ok('②-b 등을 안 켜면 안 밝다 — 옮겨도 등 0개는 자연광 그대로',
   afterSill[0] === beforeSill[0], `${afterSill[0]} ≠ ${beforeSill[0]}`);
ok('②-c 붙박이 바 등만 켠 상태(등 1개)는 안 바뀐다 — 옮긴 것은 집게등이다',
   afterSill[1] === beforeSill[1], `${afterSill[1]} ≠ ${beforeSill[1]}`);

/* ★ 왜 「겨누기」만으로는 안 되나 — 재서 못 박는다.
   창턱은 집게등보다 **위**라 tilt 상한(75°)으로는 광축이 거기 못 닿는다. */
{
  reset();
  const range = eng.aimRangeOf(CLIP);
  const rig = rigOf(CLIP);
  const sill = eng.room.slots.find(s => s.slotId === SILL);
  const v = { x: sill.x - rig.pos.x, y: sill.y - rig.pos.y, z: sill.z - rig.pos.z };
  const len = Math.hypot(v.x, v.y, v.z);
  const needTilt = Math.acos(-v.y / len) * 180 / Math.PI;
  let best = beforeSill[2];
  for (let yaw = -180; yaw <= 180; yaw += 5) {
    eng.setLampAims({ [CLIP]: { yaw, tilt: range.tiltMax } }); eng.clearCache();
    best = Math.max(best, dli(SILL, 2));
  }
  ok(`②-d 제자리에서 **겨누기만** 해서는 못 넘는다 — 거리 ${len.toFixed(2)}m · ` +
     `필요한 tilt ${needTilt.toFixed(0)}° > 상한 ${range.tiltMax}° · 최대 DLI ${best.toFixed(2)}`,
     needTilt > range.tiltMax && best < THRESHOLD, `겨눠서 얻은 최대 ${best}`);
}

/* ══ ③ 높이 — adjustable_height 가 살아 있다 ══════════════════════════════ */
{
  const lifts = [0, 0.05, 0.1, 0.2].map(l => {
    put({ [CLIP]: { x: 0, z: -1.95, rot: 0, y: SILL_TOP + l } });
    return { lift: l, y: rigOf(CLIP).pos.y, dli: dli(SILL, 2) };
  });
  const strictlyDown = lifts.every((r, i) => i === 0 || r.dli < lifts[i - 1].dli);
  ok('③ 높이 — 들어 올리면 창턱이 실제로 어두워진다 ' +
     lifts.map(r => `+${r.lift}m→${r.dli}`).join(' · '),
     strictlyDown, JSON.stringify(lifts));
  ok('③-b 프리셋의 adjustable_height 가 rig 까지 온다 (liftRange)',
     !!(rigOf(CLIP).liftRange) && rigOf(CLIP).liftRange.max > 0,
     JSON.stringify(rigOf(CLIP).liftRange));
}

/* ══ ④ 되돌림 ═════════════════════════════════════════════════════════════ */
{
  const bad = regressionDiff();
  ok('④ 되돌림 — 덮어쓰기를 지우면 ① 표로 정확히 복귀한다', bad.length === 0,
     bad.slice(0, 3).join(' / '));
}

/* ══ ⑤ 세이브 왕복 — 등 자리는 **가구 자리표와 같은 표**를 쓴다 ═══════════ */
{
  const S = newState({ room: 'banjiha' });
  const spot = { x: 0, z: -1.95, rot: 0, y: SILL_TOP + 0.05 };
  setFurniturePlacement(S, CLIP, spot);
  put({ [CLIP]: spot });
  const want = dli(SILL, 2);

  reset();                                   // 방을 기본 자리로 되돌려 놓고 세이브를 연다
  /* ★ deserialize 가 조도 창에 자리표를 **직접 얹는다** — 왕복이 화면·계산까지 간다는 증명이다
     (opt.light 를 안 주면 save.js 가 "옮긴 가구가 있는 세이브"라고 아예 거절한다). */
  const round = deserialize(serialize(S), { light: eng });
  const got = round.home.furniture[CLIP];
  ok('⑤ 세이브 — 등 자리가 S.home.furniture 로 왕복한다 (가구 자리표와 같은 길)',
     !!got && got.x === spot.x && got.z === spot.z && got.rot === spot.rot && got.y === spot.y,
     JSON.stringify(got));
  ok('⑤-b 세이브를 열면 조도 엔진의 등이 그 자리에 가 있다',
     rigOf(CLIP).pos.x === 0 && rigOf(CLIP).pos.z === -1.95,
     JSON.stringify(rigOf(CLIP).pos));
  eng.clearCache();
  const back = dli(SILL, 2);
  ok('⑤-c 세이브에서 연 방이 저장 전과 같은 창턱 DLI 를 낸다',
     back === want && back > THRESHOLD, `${back} ≠ ${want}`);
  reset();
}

/* ══ ⑥ 바 등 — 붙박이 ═════════════════════════════════════════════════════ */
{
  const bar = rigOf(BAR);
  ok('⑥ 바 등 — movable 이 없다 (data/furniture_presets.json 에 안 켜져 있다)',
     bar.movable === false, JSON.stringify({ movable: bar.movable }));
  ok('⑥-b 바 등 — mount:"under-shelf" 가 rig 까지 온다 = 선반 밑 붙박이',
     bar.mount === 'under-shelf', String(bar.mount));
  ok('⑥-c 바 등 — liftRange 가 없다 (높이도 못 바꾼다)', bar.liftRange === null,
     JSON.stringify(bar.liftRange));
  const clip = rigOf(CLIP);
  ok('⑥-d 집게등 — movable 이 켜져 있고 붙박이 표시가 없다',
     clip.movable === true && clip.mount === null,
     JSON.stringify({ movable: clip.movable, mount: clip.mount }));
}

/* ══ ⑦ 스탠드등 — 바닥에 서는 등은 **이미 가구다** ════════════════════════
   방 데이터에 아직 스탠드가 없어서, 검사가 자기 자료로 하나 놓아 보고 본다
   (data 파일은 안 고친다 — 주입한 사본에만 넣는다).
   보는 것은 room_view.furnNodes() 의 조건 그대로다:
     uid 있고 · size 있고 · fixed 아니고 · mount·hangFromCeiling 없고 · y <= 0.02 */
{
  const d = BASE_DATA();
  const bj = d.houseRooms.rooms.banjiha;
  bj.furniture = [...bj.furniture,
    { preset: 'growlight_stand', x: 0.6, z: 0.4, spectrum: 'full', schedule: 'photo12',
      uid: 'banjiha-growlight-stand' }];
  const e2 = createLightEngine(d);
  const r2 = e2.build('banjiha');
  const node = r2.built.furniture.children.find(g => g.userData
    && g.userData.uid === 'banjiha-growlight-stand');
  const u = node ? node.userData : null;
  ok('⑦ 스탠드 — y 를 안 적으면 바닥에 선다 (position.y === 0)',
     !!node && node.position.y === 0, node ? String(node.position.y) : '없다');
  ok('⑦-b 스탠드 — furnNodes() 조건을 만족한다 = 기존 가구 옮기기가 이미 옮긴다',
     !!u && !!u.uid && !!u.size && !u.fixed && !u.mount && !u.hangFromCeiling
     && node.position.y <= 0.02,
     JSON.stringify(u && { uid: u.uid, size: u.size, fixed: u.fixed, mount: u.mount }));
  ok('⑦-c 스탠드 — movable 이 프리셋에서 rig 까지 온다',
     !!u && u.movable === true, JSON.stringify(u && u.movable));
}

/* ══ 2부 · 방 뷰 계약 (브라우저) ═════════════════════════════════════════ */
const BASE = process.env.BYEOT_URL || '';
if (!BASE) {
  console.log('\n── 2부 · 방 뷰 계약 ──────────────────────────────────────');
  console.log('SKIP  BYEOT_URL 을 안 넘겼습니다 — 2부를 건너뜁니다.');
  console.log('      python tools/serve.py 8967 뒤에');
  console.log('      BYEOT_URL=http://localhost:8967 node tools/test_lampmove.mjs');
} else {
  const { launch, sleep } = await import('./test_cdp.mjs');
  const URL_ = `${BASE}/tools/room_view_demo.html?room=banjiha&engine=1`;
  console.log(`\n── 2부 · 방 뷰 계약 (${URL_}) ──────────────────────────`);
  const page = await launch({ width: 900, height: 700, dpr: 1 });
  const errs = [];
  page.on((m, p) => {
    if (m === 'Runtime.exceptionThrown') errs.push(p.exceptionDetails?.text || '예외');
    if (m === 'Log.entryAdded' && p.entry?.level === 'error') errs.push(p.entry.text);
  });
  try {
    await page.goto(URL_);
    await page.waitFor('window.view && window.view.slots && window.view.slots().length > 0');
    const SHOTS = path.join(ROOT, 'docs', 'engine', 'shots');
    /* 방만 찍는다 — 데모의 조작 판이 화면 절반이라 그대로 찍으면 등이 안 보인다.
       캔버스 사각형만 잘라 낸다(카메라는 방 전체로 뺀다). */
    const shotRoom = async (file) => {
      /* ★ 방 전체로 빼고 **캔버스만** 잘라 찍는다. 데모의 조작 판이 화면 절반이라
         그대로 찍으면 등이 어디 있는지가 안 보인다(실제로 안 보였다). */
      await page.eval('window.view.focusSlot(null, true), window.view.redraw(), true');
      await sleep(450);
      await page.eval('window.view.redraw(), true');
      const clip = JSON.parse(await page.eval(`(() => {
        const r = document.getElementById('roomCanvas').getBoundingClientRect();
        return JSON.stringify({ x: r.left, y: r.top, width: r.width, height: r.height, scale: 2 });
      })()`));
      const r = await page.send('Page.captureScreenshot', { format: 'png', clip });
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
      return file;
    };
    /* 가로 화면 · 낮 — 창가 벽(책상·선반·창턱)이 한 장에 다 들어오는 틀이다 */
    await page.eval("document.getElementById('wide').click(), true");
    await sleep(400);
    await page.eval('window.view.setDaylight(0.42), true');
    await shotRoom(path.join(SHOTS, 'lampmove_before.png'));

    const lamps = await page.eval('JSON.stringify(window.view.lamps())');
    const L = JSON.parse(lamps);
    ok('A 목록 — lamps() 에 집게등이 있다', L.some(l => l.uid === CLIP), lamps);
    ok('A-b 목록 — 바 등은 없다 (붙박이라 애초에 안 나온다)', !L.some(l => l.uid === BAR), lamps);
    ok('A-c 목록 — 천장등도 없다 (조명이지만 옮기는 물건이 아니다)',
       !L.some(l => l.uid === 'banjiha-lamp-ceiling'), lamps);

    const mounts = JSON.parse(await page.eval('JSON.stringify(window.view.lampMounts())'));
    const ids = mounts.map(m => m.mountId);
    ok(`B 물림자리 — 상판이 ${mounts.length}군데 나온다 (창턱·책상·서랍장·선반 3단)`,
       mounts.length === 6 && ids.some(i => i.startsWith('banjiha-sill@'))
       && ids.some(i => i.startsWith('banjiha-desk@'))
       && ids.filter(i => i.startsWith('banjiha-etagere@')).length === 3,
       ids.join(', '));

    const air = JSON.parse(await page.eval(
      `JSON.stringify(window.view.lampFit('${CLIP}', { x: 0, z: 0.5 }))`));
    ok('C 공중 — 방 한가운데 허공에는 못 단다 (ok:false · 한국어 이유)',
       air.ok === false && /물릴 데가 없습니다/.test(air.reason || ''), JSON.stringify(air));

    const barThrew = await page.eval(
      `window.view.commitLampAt('${BAR}', { mountId: '${ids.find(i => i.startsWith('banjiha-sill@'))}' })` +
      `.then(() => 'NOTHROW').catch(e => e.message)`);
    ok('D 바 등 — commitLampAt 이 던진다 (조용히 무시하지 않는다)',
       typeof barThrew === 'string' && /붙박이/.test(barThrew), String(barThrew));

    const sillMount = ids.find(i => i.startsWith('banjiha-sill@'));
    const before = JSON.parse(await page.eval('JSON.stringify(window.view.lightRigs())'));
    const moved = JSON.parse(await page.eval(
      `window.view.commitLampAt('${CLIP}', { mountId: '${sillMount}', lift: 0 })` +
      `.then(r => JSON.stringify({ ok: true, r })).catch(e => JSON.stringify({ ok: false, e: e.message }))`));
    ok('E 옮기기 — commitLampAt 이 성공한다', moved.ok === true, JSON.stringify(moved));
    const after = JSON.parse(await page.eval('JSON.stringify(window.view.lightRigs())'));
    const b0 = before.find(r => r.id === 'growlight_clip');
    const a0 = after.find(r => r.id === 'growlight_clip');
    ok(`E-b 옮기기 — lightRigs() 가 새 좌표를 낸다 ` +
       `(${b0.pos.x}, ${b0.pos.y}, ${b0.pos.z}) → (${a0.pos.x}, ${a0.pos.y}, ${a0.pos.z})`,
       a0.pos.x === 0 && a0.pos.z === -1.95 && a0.pos.y > b0.pos.y,
       JSON.stringify({ b: b0.pos, a: a0.pos }));
    const node3d = JSON.parse(await page.eval(`(() => {
      const g = window.view.three.scene.getObjectByProperty('uuid', '') || null;
      let found = null;
      window.view.three.scene.traverse(o => {
        if (o.userData && o.userData.uid === '${CLIP}') found = found || o;
      });
      return JSON.stringify(found ? { x:+found.position.x.toFixed(3), y:+found.position.y.toFixed(3),
                                       z:+found.position.z.toFixed(3) } : null);
    })()`));
    ok('E-c 옮기기 — 3D 도 같은 자리로 움직인다 (화면과 계산이 안 갈린다)',
       !!node3d && node3d.x === 0 && node3d.z === -1.95 && Math.abs(node3d.y - SILL_TOP) < 0.001,
       JSON.stringify(node3d));
    const lamps2 = JSON.parse(await page.eval('JSON.stringify(window.view.lamps())'));
    const l2 = lamps2.find(l => l.uid === CLIP);
    ok('E-d 옮긴 뒤 lamps() 가 어느 상판에 물렸는지 안다',
       !!l2 && l2.mountId === sillMount && l2.lift === 0, JSON.stringify(l2));

    const tooHigh = JSON.parse(await page.eval(
      `JSON.stringify(window.view.lampFit('${CLIP}', { mountId: '${sillMount}', lift: 9 }))`));
    ok('F 높이 — 범위 밖은 막힌다', tooHigh.ok === false && /범위 밖/.test(tooHigh.reason || ''),
       JSON.stringify(tooHigh));
    const ceil = JSON.parse(await page.eval(
      `JSON.stringify(window.view.lampFit('${CLIP}', { mountId: '${sillMount}', lift: 0.42 }))`));
    ok('F-b 높이 — 천장을 뚫지 않는다', ceil.ok === false && /천장/.test(ceil.reason || ''),
       JSON.stringify(ceil));

    await shotRoom(path.join(SHOTS, 'lampmove_after.png'));
    ok('G 스크린샷 — lampmove_before.png · lampmove_after.png',
       fs.existsSync(path.join(SHOTS, 'lampmove_before.png'))
       && fs.existsSync(path.join(SHOTS, 'lampmove_after.png')));

    const real = errs.filter(e => !/favicon|Failed to load resource/.test(e));
    ok('H 콘솔 — 처리 안 된 예외가 없다', real.length === 0, real.slice(0, 2).join(' / '));
  } finally {
    await page.close();
  }
}

console.log(`\nlampmove: ${fail ? 'FAIL' : 'PASS'} — ${pass}/${pass + fail}`);
process.exit(fail ? 1 : 0);
