/* ============================================================
   test_lampaim.mjs — 식물등 겨누기 · 꼬리 (house 소유)
   ------------------------------------------------------------
   증명 대상 (docs/growlight_aim.md §2 §3):

     ① 회귀    안 겨눈 등은 **한 톨도 안 바뀐다** — 반지하 14칸의 PPFD·DLI 가
               고친 적 없는 값과 **정확히** 같다(반올림 허용치 없음).
               ★ 이게 이 작업의 절반이다. 창턱 등0 4.80 · 등1 6.64 는
                 창 tau 0.70 결정의 근거라, 흔들리면 그 결정이 무효가 된다.
     ② 항등    aim=(0,-1,0) 을 **명시해도** 등 아래쪽에서는 옛 식과 같은 값이다
               (분기가 아니라 식이 그렇게 된다는 증명)
     ③ 겨누기  집게 등을 돌리면 밝은 자리가 **실제로 옮겨 간다**
     ④ 바 등   못 겨눈다 — 조용히 무시하지 않고 **던진다**
     ⑤ 뒤쪽    겨눈 등의 뒤는 0 이다
     ⑥ 꼬리    t=0 그대로 · t<=1 **완전히** 그대로 · t>1.15 는 0 이 아니다 · 아주 멀면 0
     ⑦ 세이브  yaw·tilt 가 왕복에서 살아남고, **옛 세이브는 「안 겨눔」으로 열린다**
     ⑧ 프로파일 겨눈 상태에서는 안 뽑는다(옮긴 가구와 같은 규약)

   ★ 집 조립(THREE)을 헤드리스로 돌린다 — test_free_place.mjs 와 같은 방식이라
     브라우저와 **같은 코드**가 그대로 돈다.

     node tools/test_lampaim.mjs
============================================================ */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const toUrl = (rel) => 'file:///' + path.join(ROOT, rel).replace(/\\/g, '/');
const dataOf = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', rel), 'utf8'));

/* ── 캔버스·문서 스텁 (조도에 안 쓰이는 자리만 흉내) ── */
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
assert.ok(globalThis.THREE && globalThis.THREE.REVISION, 'vendor/three 로 전역 THREE 를 못 세웠습니다');

const { createLightEngine } = await import(toUrl('src/game/light_adapter.js'));
const { ppfdAt, ppfdSum, aimVector, offAxisFalloff, AIM_DOWN, TAIL_K }
  = await import(toUrl('src/render3d/lighting_sim.js'));
const { newState, setLampAim: stateSetLampAim } = await import(toUrl('src/game/state.js'));
const { serialize, deserialize } = await import(toUrl('src/game/save.js'));

function makeEngine() {
  return createLightEngine({
    houseRooms: dataOf('house_rooms.json'), winPresets: dataOf('window_presets.json').presets,
    doorPresets: dataOf('door_presets.json').presets, finishes: dataOf('room_finishes.json'),
    furnPresets: dataOf('furniture_presets.json').presets, lightPresets: dataOf('lighting_presets.json'),
    shadePresets: dataOf('shading_presets.json'), lightTh: dataOf('balance/light_thresholds.json'),
    weatherBalance: dataOf('balance/weather.json')
  });
}
const eng = makeEngine();
const room = eng.build('banjiha');
const CLIP = 'banjiha-growlight-clip', BAR = 'banjiha-growlight-bar';
const SKY = { weather: 'clear', season: 'summer', litHours: 12 };
const unaimed = () => { eng.setLampAims({}); eng.clearCache(); };
const dli = (slotId, lampCount) => eng.dliOfSlot(slotId, { ...SKY, lampCount });

const results = [];
const check = (name, fn) => { try { fn(); results.push(['PASS', name]); }
                              catch (e) { results.push(['FAIL', name, e.message]); } };

/* ══ ① 회귀 — 겨누기·꼬리를 넣기 **전에** 잰 값. 한 자리도 안 움직여야 한다 ══════
   뽑은 방법: 안 겨눈 상태에서 반지하 14칸 × 등 0/1/2개.
     ppfd = lighting_sim.ppfdSum(rigs, 점)          (소수 6자리)
     dli  = light_adapter.dliOfSlot(맑음·여름·12h)
   ⚠ 허용 오차를 두지 않는다. `assert.equal` 이다 — 마지막 자리가 흔들려도 잡는다.
     여기 숫자를 "새로 재서" 고치면 안 된다. 이 표가 움직였다는 것은
     안 겨눈 등의 물리가 바뀌었다는 뜻이고, 그러면 창 tau 0.70 결정이 무효가 된다. */
const BEFORE = {
  'banjiha-sill:0':     { ppfd: [0, 42.621255, 46.013589],   dli: [4.8, 6.64, 6.78] },
  'banjiha-desk:0':     { ppfd: [0, 11.45266, 28.997637],    dli: [0.61, 1.1, 1.86] },
  'banjiha-desk:1':     { ppfd: [0, 3.500658, 26.6363],      dli: [0.17, 0.32, 1.32] },
  'banjiha-dresser:0':  { ppfd: [0, 1.497063, 2.675664],     dli: [0.08, 0.14, 0.19] },
  'banjiha-dresser:1':  { ppfd: [0, 1.081963, 1.79312],      dli: [0.05, 0.1, 0.13] },
  'banjiha-etagere:0':  { ppfd: [0, 17.485103, 19.052515],   dli: [0.13, 0.89, 0.95] },
  'banjiha-etagere:1':  { ppfd: [0, 18.867116, 20.85616],    dli: [0.14, 0.95, 1.04] },
  'banjiha-etagere:2':  { ppfd: [0, 17.485103, 20.061482],   dli: [0.13, 0.88, 0.99] },
  'banjiha-etagere:3':  { ppfd: [0, 39.495924, 41.213474],   dli: [0.23, 1.94, 2.01] },
  'banjiha-etagere:4':  { ppfd: [0, 47.3445, 49.588241],     dli: [0.22, 2.27, 2.37] },
  'banjiha-etagere:5':  { ppfd: [0, 39.495924, 42.530647],   dli: [0.21, 1.92, 2.05] },
  'banjiha-etagere:6':  { ppfd: [0, 126.779329, 128.591455], dli: [0.51, 5.98, 6.06] },
  'banjiha-etagere:7':  { ppfd: [0, 273.707829, 276.11858],  dli: [0.48, 12.31, 12.41] },
  'banjiha-etagere:8':  { ppfd: [0, 126.779329, 130.135417], dli: [0.48, 5.95, 6.1] }
};

check('① 회귀 — 안 겨눈 14칸 PPFD·DLI 가 옛 값과 정확히 같다', () => {
  unaimed();
  assert.equal(room.slots.length, 14, '반지하 슬롯 14칸');
  for (const s of room.slots) {
    const want = BEFORE[s.slotId];
    assert.ok(want, `옛 값 표에 ${s.slotId} 가 없습니다 — 방이 바뀌었습니다`);
    const pt = { x: s.x, y: s.y, z: s.z };
    for (let n = 0; n <= 2; n++) {
      const got = +ppfdSum(eng.room.growRigs.slice(0, n).map(r => r), pt).toFixed(6);
      assert.equal(got, want.ppfd[n], `${s.slotId} 등${n}개 PPFD ${got} ≠ 옛값 ${want.ppfd[n]}`);
      const d = +dli(s.slotId, n).toFixed(6);
      assert.equal(d, want.dli[n], `${s.slotId} 등${n}개 DLI ${d} ≠ 옛값 ${want.dli[n]}`);
    }
  }
});

check('①-b 합격선 — 창턱 등0개 4.80 · 등1개 6.64 (창 tau 0.70 의 근거)', () => {
  unaimed();
  assert.equal(dli('banjiha-sill:0', 0), 4.8, '창턱 등 0개가 4.80 이 아닙니다');
  assert.equal(dli('banjiha-sill:0', 1), 6.64, '창턱 등 1개가 6.64 가 아닙니다');
  assert.ok(dli('banjiha-sill:0', 1) > 6.0, '갈라짐 문턱 6.0 을 넘어야 합니다');
});

/* ══ ② 항등 — aim 을 명시해도 등 **아래쪽**은 옛 식과 같다 ══════════════════
   옛 식:  off = hypot(dx,dz) · dist = hypot(|dy|, off)
   새 식:  along = v·aim · off = |v − along·aim| · dist = hypot(along, off)
   aim=(0,-1,0) 이면 둘이 대수적으로 같고, 부동소수까지 같다는 것을 여기서 못 박는다. */
check('② 항등 — aim=(0,-1,0) 을 명시해도 등 아래 지점은 옛 식과 비트 단위로 같다', () => {
  const v = aimVector(0, 0);
  assert.deepEqual(v, { x: 0, y: -1, z: 0 }, 'aimVector(0,0) 이 정확히 (0,-1,0) 이어야 합니다');
  assert.deepEqual({ ...AIM_DOWN }, { x: 0, y: -1, z: 0 });
  const fx = dataOf('lighting_presets.json').fixtures.growlight_bar;
  const rig = { fx, spec: { par_eff: 1 }, pos: { x: 0.3, y: 1.5, z: -0.4 } };
  for (const pt of [{ x: 0, y: 0, z: 0 }, { x: 1.2, y: 0.7, z: 0.9 }, { x: 0.3, y: 0.2, z: -0.4 },
                    { x: -2, y: 1.0, z: 2.5 }, { x: 0.31, y: 1.49, z: -0.41 }]) {
    /* 옛 식을 그대로 손으로 계산한다 */
    const dy = Math.abs(rig.pos.y - pt.y);
    const off = Math.hypot(rig.pos.x - pt.x, rig.pos.z - pt.z);
    const old = ppfdAt(fx, Math.hypot(dy, off), off, rig.spec);
    const now = ppfdSum([{ ...rig, aim: v }], pt);
    assert.equal(now, old, `(${pt.x},${pt.y},${pt.z}) 에서 ${now} ≠ 옛식 ${old}`);
  }
});

/* ══ ③ 겨누면 밝은 자리가 옮겨 간다 ════════════════════════════════════════
   집게 등은 (1.35, 1.14, -1.5) 에 있고 책상 두 칸이 그 앞뒤로 늘어서 있다.
   좌우로 돌리면 두 칸의 등 PPFD 가 **서로 반대로** 움직여야 한다. */
check('③ 집게 등을 겨누면 밝은 자리가 실제로 옮겨 간다', () => {
  const ppfdOf = (slotId) => {
    const s = room.slots.find(x => x.slotId === slotId);
    return ppfdSum(eng.room.growRigs.map((r, i) => i === 1 ? { ...r, aim: cur } : { ...r, on: false }),
                   { x: s.x, y: s.y, z: s.z });
  };
  let cur = aimVector(90, 60);
  const d0_right = ppfdOf('banjiha-desk:0'), d1_right = ppfdOf('banjiha-desk:1');
  cur = aimVector(-90, 60);
  const d0_left = ppfdOf('banjiha-desk:0'), d1_left = ppfdOf('banjiha-desk:1');
  assert.ok(d0_left > d0_right * 1.5,
    `desk:0 이 왼쪽으로 겨눌 때 더 밝아야 합니다 (좌 ${d0_left.toFixed(2)} vs 우 ${d0_right.toFixed(2)})`);
  assert.ok(d1_right > d1_left * 1.5,
    `desk:1 은 반대로 움직여야 합니다 (우 ${d1_right.toFixed(2)} vs 좌 ${d1_left.toFixed(2)})`);
  /* 게임 값(DLI)으로도 실제로 움직인다 */
  eng.setLampAim(CLIP, { yaw: -90, tilt: 60 }); eng.clearCache();
  const L = dli('banjiha-desk:0', 2);
  eng.setLampAim(CLIP, { yaw: 90, tilt: 60 }); eng.clearCache();
  const R = dli('banjiha-desk:0', 2);
  unaimed();
  assert.ok(L > R, `desk:0 DLI 가 겨누기로 움직여야 합니다 (좌 ${L} vs 우 ${R})`);
});

/* ══ ④ 바 등은 안 돌아간다 — **던진다** ═══════════════════════════════════
   ★ 무시가 아니라 던지기를 골랐다. 무시하면 화면은 손잡이를 보여 주는데 빛이 안 움직이고,
     세이브에는 값이 남아 "겨눴는데 안 먹는" 상태가 조용히 굳는다.
     바 등이 붙박이인 것은 버그가 아니라 설계(docs/growlight_aim.md §2)라 크게 말해야 한다. */
check('④ 바 등은 겨눌 수 없다 — 조용히 무시하지 않고 던진다', () => {
  unaimed();
  assert.equal(eng.aimRangeOf(BAR), null, '바 등에 겨누기 범위가 있으면 안 됩니다');
  assert.throws(() => eng.setLampAim(BAR, { yaw: 30, tilt: 20 }), /겨눌 수 없는 등/,
    '바 등을 겨눴는데 안 던졌습니다');
  assert.throws(() => eng.setLampAims({ [BAR]: { yaw: 0, tilt: 10 } }), /겨눌 수 없는 등/,
    '세이브 경로로 들어온 바 등 각도가 통과했습니다');
  const list = eng.lampList();
  assert.equal(list.find(l => l.uid === BAR).aimable, false, '바 등이 aimable 이면 안 됩니다');
  assert.equal(list.find(l => l.uid === CLIP).aimable, true, '집게 등은 aimable 이어야 합니다');
});

check('④-b 겨누기 범위 — 프리셋 표대로다 (집게 ±180/0~75 · 스탠드 ±180/0~60)', () => {
  const fxs = dataOf('lighting_presets.json').fixtures;
  assert.deepEqual(fxs.growlight_clip.aim, { yaw: 180, tilt_max: 75 });
  assert.deepEqual(fxs.growlight_stand.aim, { yaw: 180, tilt_max: 60 });
  assert.equal(fxs.growlight_bar.aim, undefined, '바 등에 aim 이 있으면 안 됩니다');
  /* adjustable_height 와 갈라지면 안 된다 — 새 구분을 짓지 않았다는 증명 */
  for (const [id, fx] of Object.entries(fxs))
    if (fx.grow) assert.equal(!!fx.aim, !!fx.adjustable_height,
      `${id}: aim 유무가 adjustable_height 와 다릅니다 — 새 구분을 지으면 안 됩니다`);
  unaimed();
  assert.throws(() => eng.setLampAim(CLIP, { yaw: 181, tilt: 0 }), /범위 밖/);
  assert.throws(() => eng.setLampAim(CLIP, { yaw: 0, tilt: 76 }), /범위 밖/);
  assert.throws(() => eng.setLampAim(CLIP, { yaw: 0, tilt: -1 }), /범위 밖/);
  eng.setLampAim(CLIP, { yaw: 180, tilt: 75 });          // 경계는 들어간다
  eng.setLampAim(CLIP, { yaw: -180, tilt: 0 });
  unaimed();
});

/* ⚠ `Number(x) || 0` 로 짜면 NaN 이 0 으로 삼켜져 "겨눴는데 아래를 본다"가 된다.
   조용히 0 이 되는 쪽이 던지는 쪽보다 훨씬 나쁘다 — 그래서 따로 못 박는다. */
check('④-c 숫자가 아닌 각도는 0 으로 삼키지 않고 던진다', () => {
  unaimed();
  for (const bad of [{ yaw: NaN, tilt: 0 }, { yaw: 0, tilt: NaN },
                     { yaw: '가', tilt: 0 }, { yaw: 0, tilt: Infinity }]) {
    assert.throws(() => eng.setLampAim(CLIP, bad), /유한한 숫자/,
      `${JSON.stringify(bad)} 가 조용히 통과했습니다`);
    assert.throws(() => stateSetLampAim({ lamps: { aim: {} } }, CLIP, bad), /유한한 숫자/,
      `state 쪽에서 ${JSON.stringify(bad)} 가 통과했습니다`);
  }
  assert.deepEqual(eng.lampAims(), {}, '던진 뒤에 값이 남으면 안 됩니다');
  /* 안 준 것은 0 이다 — 그건 삼키는 게 아니라 기본값이다 */
  assert.deepEqual(eng.setLampAim(CLIP, {}), { yaw: 0, tilt: 0 });
  unaimed();
});

/* setLampAims 는 세이브를 얹는 길이다. 반쯤 얹고 던지면
   "세이브는 못 읽었는데 등은 일부 돌아간" 상태가 남는다. */
check('④-d 표를 통째로 얹다 실패하면 아무것도 안 바뀐다(전부 아니면 전무)', () => {
  unaimed();
  eng.setLampAim(CLIP, { yaw: 20, tilt: 20 });
  const before = eng.lampAims();
  assert.throws(() => eng.setLampAims({ [CLIP]: { yaw: 0, tilt: 10 }, [BAR]: { yaw: 0, tilt: 5 } }));
  assert.deepEqual(eng.lampAims(), before, '실패했는데 표가 바뀌었습니다');
  assert.throws(() => eng.setLampAims({ [CLIP]: { yaw: 999, tilt: 0 } }), /범위 밖/);
  assert.deepEqual(eng.lampAims(), before, '범위 밖에서 실패했는데 표가 바뀌었습니다');
  unaimed();
});

/* ══ ⑤ 뒤쪽을 안 비춘다 ═══════════════════════════════════════════════════ */
check('⑤ 겨눈 등의 뒤쪽은 0 이다', () => {
  const fx = dataOf('lighting_presets.json').fixtures.growlight_clip;
  const rig = { fx, spec: { par_eff: 1 }, pos: { x: 0, y: 1.0, z: 0 }, aim: aimVector(0, 0) };
  assert.equal(ppfdSum([rig], { x: 0, y: 1.6, z: 0 }), 0, '바로 위가 0 이 아닙니다');
  assert.equal(ppfdSum([rig], { x: 0.4, y: 1.6, z: 0.2 }), 0, '뒤쪽 비스듬한 점이 0 이 아닙니다');
  assert.equal(ppfdSum([rig], { x: 0, y: 1.0, z: 0.5 }), 0, '옆(정확히 90°)이 0 이 아닙니다');
  assert.ok(ppfdSum([rig], { x: 0, y: 0.4, z: 0 }) > 0, '앞쪽이 0 이면 안 됩니다');
  /* 옆으로 겨누면 '뒤'도 같이 돈다 */
  const side = { ...rig, aim: aimVector(0, 90) };        // +z 수평
  assert.ok(ppfdSum([side], { x: 0, y: 1.0, z: 0.5 }) > 0, '겨눈 쪽이 밝아야 합니다');
  assert.equal(ppfdSum([side], { x: 0, y: 1.0, z: -0.5 }), 0, '반대쪽이 0 이 아닙니다');
});

/* ══ ⑥ 꼬리 ═══════════════════════════════════════════════════════════════ */
check('⑥ 꼬리 — t=0 그대로 · t<=1 완전히 그대로 · t>1.15 는 0 이 아니다 · 아주 멀면 0', () => {
  const OLD = (t) => (t <= 1 ? 1 - 0.45 * t * t : Math.max(0, 1.15 - t) * 0.5);
  assert.equal(offAxisFalloff(0), 1, 't=0 이 1 이어야 합니다');
  /* t<=1 은 "거의"가 아니라 **완전히** 같다 — 폭 0 이다.
     ⚠ t 를 0.001 씩 더해 가면 마지막이 1.0000000000000007 이 되어 t>1 가지로 넘어간다.
       그건 곡선이 아니라 반복문의 오차다 — 정수로 세서 t<=1 만 재게 한다. */
  for (let i = 0; i <= 1000; i++) {
    const t = i / 1000;
    assert.ok(t <= 1, 't 가 1 을 넘으면 안 됩니다');
    assert.equal(offAxisFalloff(t), OLD(t), `t=${t} 에서 옛 곡선과 다릅니다`);
  }
  /* 옛 곡선이 0 으로 끊던 자리 */
  assert.equal(OLD(1.15), 0, '옛 곡선은 t=1.15 에서 0 이었습니다');
  assert.ok(offAxisFalloff(1.15) > 0, 't=1.15 에서 0 이 아니어야 합니다');
  assert.ok(offAxisFalloff(2) > 0 && offAxisFalloff(5) > 0, '원뿔 밖이 0 이면 안 됩니다');
  /* 단조 감소 · 멀면 0 으로 */
  let prev = Infinity;
  for (const t of [1.0, 1.15, 1.5, 2, 3, 5, 10, 20, 50]) {
    const v = offAxisFalloff(t);
    assert.ok(v < prev, `t=${t} 에서 단조 감소가 깨집니다`);
    prev = v;
  }
  assert.ok(offAxisFalloff(50) < 0.002, '아주 멀면 0 에 가까워야 합니다');
  /* t=1 에서 값도 기울기도 이어진다 — 그게 K 를 고른 이유다 */
  assert.ok(Math.abs(offAxisFalloff(1) - offAxisFalloff(1.000001)) < 1e-5, 't=1 에서 값이 튑니다');
  const slope = (offAxisFalloff(1.000001) - offAxisFalloff(1)) / 0.000001;
  assert.ok(Math.abs(slope + 0.9) < 0.01, `t=1 오른쪽 기울기가 -0.9 이어야 합니다 (${slope})`);
  assert.ok(Math.abs(TAIL_K - 0.9 / 0.55) < 1e-12, 'TAIL_K 는 C¹ 조건의 해여야 합니다');
});

/* ══ ⑦ 세이브 왕복 ════════════════════════════════════════════════════════ */
check('⑦ 세이브 — yaw·tilt 가 왕복에서 살아남는다', () => {
  const S = newState({ room: 'banjiha' });
  stateSetLampAim(S, CLIP, { yaw: -35.5, tilt: 42 });
  const raw = JSON.stringify(serialize(S));
  assert.deepEqual(JSON.parse(raw).state.lamps.aim[CLIP], { yaw: -35.5, tilt: 42 },
    '세이브에 겨누기가 안 실렸습니다');
  const eng2 = makeEngine();
  const S2 = deserialize(raw, { light: eng2 });
  assert.deepEqual(S2.lamps.aim[CLIP], { yaw: -35.5, tilt: 42 }, '왕복에서 겨누기가 사라졌습니다');
  assert.deepEqual(eng2.lampAims()[CLIP], { yaw: -35.5, tilt: 42 }, '조도 창에 안 얹혔습니다');
});

check('⑦-b 옛 세이브 — aim 칸이 없으면 「안 겨눔」으로 열린다', () => {
  const S = newState({ room: 'banjiha' });
  const env = serialize(S);
  delete env.state.lamps.aim;                            // 겨누기 이전 세이브를 흉내
  const eng2 = makeEngine();
  const S2 = deserialize(JSON.stringify(env), { light: eng2 });
  assert.deepEqual(S2.lamps.aim, {}, '옛 세이브가 안 겨눔으로 안 열렸습니다');
  assert.deepEqual(eng2.lampAims(), {}, '조도 창에 유령 각도가 남았습니다');
  /* 그리고 그 상태의 빛은 옛 값 그대로여야 한다 */
  eng2.build('banjiha');
  assert.equal(eng2.dliOfSlot('banjiha-sill:0', { ...SKY, lampCount: 1 }), 6.64,
    '옛 세이브를 열었더니 창턱 밝기가 달라졌습니다');
});

check('⑦-c 새 세이브를 열면 직전 판에서 겨눈 각도가 안 남는다', () => {
  const eng2 = makeEngine();
  eng2.build('banjiha');
  eng2.setLampAim(CLIP, { yaw: 120, tilt: 70 });
  const fresh = JSON.stringify(serialize(newState({ room: 'banjiha' })));
  deserialize(fresh, { light: eng2 });
  assert.deepEqual(eng2.lampAims(), {}, '직전 판의 겨누기가 그대로 남았습니다');
});

/* ══ ⑧ 프로파일은 겨눈 상태에서 안 뽑는다 ═════════════════════════════════ */
check('⑧ 겨눈 상태에서는 방 프로파일을 안 뽑는다', () => {
  const eng2 = makeEngine();
  eng2.build('banjiha');
  assert.ok(eng2.profile([0, 1, 2]), '안 겨눈 상태에서는 뽑혀야 합니다');
  eng2.setLampAim(CLIP, { yaw: 10, tilt: 10 });
  assert.throws(() => eng2.profile([0, 1, 2]), /겨눠진 상태/, '겨눈 상태에서 프로파일이 뽑혔습니다');
});

/* ── 결과 ── */
let bad = 0;
for (const [st, name, msg] of results) {
  console.log(`${st}  ${name}${msg ? `\n      ${msg}` : ''}`);
  if (st === 'FAIL') bad++;
}
console.log(`\nlampaim: ${bad ? `FAIL (${bad}건)` : 'PASS'} — ${results.length - bad}/${results.length}`);
if (bad) process.exit(1);
