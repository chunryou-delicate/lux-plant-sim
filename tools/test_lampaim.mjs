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
const { ppfdAt, ppfdSum, aimVector, offAxisFalloff, AIM_DOWN, TAIL_K, BACK_REFLECT }
  = await import(toUrl('src/render3d/lighting_sim.js'));
const TAIL_BACK = BACK_REFLECT;
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
     안 겨눈 등의 물리가 바뀌었다는 뜻이다.

   ★★ **§반사광 — 2026-08-06 에 그 물리를 의도해서 바꿨다**(박사님 확정).
     ------------------------------------------------------------
     옛 식은 `Math.abs(dy)` 라 등이 **자기 위쪽도 똑같이** 비췄다. 그런데 `banjiha-sill:0` 은
     두 식물등보다 **0.56m 위**에 있어서, 창턱의 등 PPFD 42.62 가 전부 "등이 아래에서 위로
     쏜 빛"이었다. 그게 창 tau 0.70 결정의 근거이기도 했다.
     ⇒ 박사님 판단: *"반사광도 OK인데 반사광은 좀 많이 약하게 해 주고 밑은 세고,
       근데 대가리를 식물 바라보게 하면 직광 아닌가"*
     ⇒ 뒤쪽은 0 도 아니고 그대로도 아닌 **`BACK_REFLECT`(직광의 18%)** 다.
       그래서 창턱만 42.62 → 8.20 으로 내려앉았고, **나머지 13칸은 한 톨도 안 바뀌었다** —
       그 칸들은 전부 등 **아래**라 직광이기 때문이다. 그 "13칸 불변"이 이 변경이
       정확히 의도한 자리에만 걸렸다는 증거다.
     ⇒ 창턱이 문턱 6.0 을 넘는 길은 이제 **집게등을 창턱 가까이 옮겨 다는 것**이다
       (0.5m 안쪽 6.67 · 0.3m 9.98 — 재서 확인). `growlight_clip` 에 `movable:true` 를 켠 이유다.
     ⚠ **이 표가 또 움직이면 그때는 사고다.** 위 한 줄(창턱)만 바뀌었고 나머지는 옛 값 그대로다. */
/* ★★ **2026-08-15 갱신 — 자리를 옮겼다. 등의 물리는 안 건드렸다.**
   ------------------------------------------------------------
   위 「이 표가 또 움직이면 그때는 사고다」는 **등 물리**를 두고 한 말이다. 이번에 바뀐 것은
   `render3d/furniture_pastel.tierSlots` 가 내는 **자리 좌표**다 — 상수 여백 0.09 를
   칸 반쪽으로 바꿔 추천 자리를 칸 한가운데에 앉혔다(까닭·폭은 `test_floorlight` §① 머리말).
   ★ **자리가 안 움직인 넷은 값도 한 톨도 안 움직였다** — `banjiha-sill:0` ·
     `etagere:1` · `:4` · `:7`. 그 넷이 이 변경이 좌표에만 걸렸다는 증거다.
     (등 물리가 바뀌었다면 14칸이 다 움직였어야 한다)
   ★ 다시 뽑는 문: `BYEOT_REGEN=1 node tools/test_lampaim.mjs` — `test_lampmove` §① 이
     같은 문으로 뽑은 같은 표를 들고 있다. 한쪽만 고쳐서 통과시키는 길은 그대로 막혀 있다.
   옛 값(2026-08-06 main): desk:0 {ppfd [0,11.45266,28.997637], dli [0.61,1.1,1.86]} ·
     desk:1 {[0,3.500658,26.6363], [0.17,0.32,1.32]} · dresser:0 {[0,1.497063,2.675664], [0.08,0.14,0.19]} ·
     dresser:1 {[0,1.081963,1.79312], [0.05,0.1,0.13]} · etagere:0 {[0,17.485103,19.052515], [0.13,0.89,0.95]} ·
     etagere:2 {[0,17.485103,20.061482], [0.13,0.88,0.99]} · etagere:3 {[0,39.495924,41.213474], [0.23,1.94,2.01]} ·
     etagere:5 {[0,39.495924,42.530647], [0.21,1.92,2.05]} · etagere:6 {[0,126.779329,128.591455], [0.51,5.98,6.06]} ·
     etagere:8 {[0,126.779329,130.135417], [0.48,5.95,6.1]} */
const BEFORE = {
  /* ★★ 창턱만 바뀌었다 — 42.621255 → 8.195413 (DLI 6.64 → 5.15).
     **의도한 변경이다**(2026-08-06 박사님 확정 · 반사광 도입). 아래 §반사광 참고. */
  'banjiha-sill:0':     { ppfd: [0, 8.195413, 9.068633],     dli: [4.8, 5.15, 5.19] },
  'banjiha-desk:0':     { ppfd: [0, 10.660643, 29.003899],   dli: [0.6, 1.06, 1.85] },
  'banjiha-desk:1':     { ppfd: [0, 3.565306, 27.619401],    dli: [0.19, 0.34, 1.38] },
  'banjiha-dresser:0':  { ppfd: [0, 1.455611, 2.579889],     dli: [0.07, 0.14, 0.19] },
  'banjiha-dresser:1':  { ppfd: [0, 1.110425, 1.848864],     dli: [0.05, 0.1, 0.13] },
  'banjiha-etagere:0':  { ppfd: [0, 17.758409, 19.366252],   dli: [0.13, 0.9, 0.97] },
  'banjiha-etagere:1':  { ppfd: [0, 18.867116, 20.85616],    dli: [0.14, 0.95, 1.04] },
  'banjiha-etagere:2':  { ppfd: [0, 17.758409, 20.259313],   dli: [0.13, 0.9, 1] },
  'banjiha-etagere:3':  { ppfd: [0, 40.923135, 42.689764],   dli: [0.22, 1.99, 2.07] },
  'banjiha-etagere:4':  { ppfd: [0, 47.3445, 49.588241],     dli: [0.22, 2.27, 2.37] },
  'banjiha-etagere:5':  { ppfd: [0, 40.923135, 43.852098],   dli: [0.21, 1.98, 2.11] },
  'banjiha-etagere:6':  { ppfd: [0, 142.980784, 144.847794], dli: [0.51, 6.68, 6.77] },
  'banjiha-etagere:7':  { ppfd: [0, 273.707829, 276.11858],  dli: [0.48, 12.31, 12.41] },
  'banjiha-etagere:8':  { ppfd: [0, 142.980784, 146.207098], dli: [0.48, 6.66, 6.8] }
};

/* 새 값을 뽑을 때 쓴다: BYEOT_REGEN=1 node tools/test_lampaim.mjs */
if (process.env.BYEOT_REGEN) {
  unaimed();
  for (const s of room.slots) {
    const pt = { x: s.x, y: s.y, z: s.z };
    const pp = [0, 1, 2].map(n => +ppfdSum(eng.room.growRigs.slice(0, n), pt).toFixed(6));
    const dd = [0, 1, 2].map(n => +dli(s.slotId, n).toFixed(6));
    console.log(`  '${s.slotId}':${' '.repeat(Math.max(0, 22 - s.slotId.length))}` +
                `{ ppfd: [${pp.join(', ')}], dli: [${dd.join(', ')}] },`);
  }
  process.exit(0);
}

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

/* ★ 합격선이 바뀌었다 — 창턱은 이제 **등을 옮겨 달아야** 문턱을 넘는다(위 §반사광).
   ⚠ 자연광 4.80 은 그대로다. 그게 창 tau 0.70 의 남은 근거고, 여기가 흔들리면 그 결정이 무효다. */
check('①-b 합격선 — 창턱 자연광 4.80 · 등은 붙박이로는 문턱을 못 넘는다', () => {
  unaimed();
  assert.equal(dli('banjiha-sill:0', 0), 4.8, '창턱 자연광이 4.80 이 아닙니다');
  assert.ok(dli('banjiha-sill:0', 1) < 6.0,
    '창턱이 붙박이 등만으로 문턱을 넘습니다 — 등을 옮길 이유가 사라집니다');
  assert.ok(dli('banjiha-sill:0', 1) > dli('banjiha-sill:0', 0),
    '등을 켰는데 창턱이 하나도 안 밝아졌습니다 — 반사광이 0 이 되었습니다');
});

/* ★★ 그러면 창턱은 **어떻게** 넘나 — 집게등을 옮겨 달면 넘는다.
   이 검사가 그 길이 실제로 열려 있음을 못 박는다. 안 열려 있으면 창턱은 죽은 자리다. */
check('①-c ★집게등을 창턱 0.5m 안쪽에 달면 문턱 6.0 을 넘는다', () => {
  const fx = dataOf('lighting_presets.json').fixtures.growlight_clip;
  const sill = room.slots.find(s => s.slotId === 'banjiha-sill:0');
  const at = (d) => ({ x: sill.x, y: sill.y + d, z: sill.z });
  const aimDown = aimVector(0, 0);
  const ppfdOf = (d) => ppfdSum([{ fx, spec: { par_eff: 1 }, pos: at(d), aim: aimDown }],
                                { x: sill.x, y: sill.y, z: sill.z });
  /* 자연광 4.80 에 등 몫을 더한다. 환산비는 이 방의 실측에서 나온다(42.621255 PPFD = 1.84 DLI) */
  const K = 1.84 / 42.621255;
  assert.ok(4.8 + ppfdOf(0.5) * K > 6.0, `0.5m 위에 달아도 문턱을 못 넘습니다`);
  assert.ok(4.8 + ppfdOf(1.0) * K < 6.0, `1.0m 위에서도 넘습니다 — 거리가 뜻이 없습니다`);
  /* 그리고 그 등은 실제로 **옮길 수 있어야** 한다 */
  const fp = dataOf('furniture_presets.json').presets || dataOf('furniture_presets.json');
  assert.equal(fp.growlight_clip.movable, true, '집게등을 못 옮기면 위 길이 막힙니다');
  assert.notEqual(fp.growlight_bar.movable, true, '바 등은 붙박이여야 합니다(튜토의 긴장)');
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
/* ★★ 뒤쪽은 **0 이 아니라 반사광**이다 (2026-08-06 · 위 §반사광).
   0 으로 자르면 계산은 편하지만 "방은 반사광으로 밝다"는 사실이 게임에서 사라진다.
   대신 **직광보다 훨씬 약해야** 한다 — 그 둘을 여기서 같이 못 박는다. */
check('⑤ 겨눈 등의 뒤쪽은 반사광이다 — 0 이 아니고, 직광보다 훨씬 약하다', () => {
  const fx = dataOf('lighting_presets.json').fixtures.growlight_clip;
  const rig = { fx, spec: { par_eff: 1 }, pos: { x: 0, y: 1.0, z: 0 }, aim: aimVector(0, 0) };
  const up = ppfdSum([rig], { x: 0, y: 1.6, z: 0 });      // 바로 위 0.6m
  const down = ppfdSum([rig], { x: 0, y: 0.4, z: 0 });    // 바로 아래 0.6m — 같은 거리
  assert.ok(up > 0, '뒤쪽이 0 입니다 — 반사광이 사라졌습니다');
  assert.ok(down > 0, '앞쪽이 0 이면 안 됩니다');
  /* 같은 거리인데 앞이 훨씬 세야 한다. 그게 「밑은 세고 반사는 약하게」다 */
  assert.ok(down > up * 4, `앞뒤 차이가 ${(down / up).toFixed(1)}배뿐입니다 — 반사광이 너무 셉니다`);
  assert.equal(+(up / down).toFixed(6), TAIL_BACK,
    `뒤/앞 비가 ${(up / down).toFixed(6)} 입니다 — BACK_REFLECT 와 달라졌습니다`);
  /* 옆으로 겨누면 '뒤'도 같이 돈다 */
  const side = { ...rig, aim: aimVector(0, 90) };        // +z 수평
  const front = ppfdSum([side], { x: 0, y: 1.0, z: 0.5 });
  const back = ppfdSum([side], { x: 0, y: 1.0, z: -0.5 });
  assert.ok(front > 0, '겨눈 쪽이 밝아야 합니다');
  assert.ok(back > 0 && back < front, '반대쪽이 0 이거나 앞보다 밝습니다');
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
  /* ★ 6.64 → 5.15 (위 §반사광). 옛 세이브라고 옛 물리로 도는 것이 아니라,
     **안 겨눔으로 열려서 지금 물리의 안 겨눔 값**이 나오는 것이 맞다. */
  assert.equal(eng2.dliOfSlot('banjiha-sill:0', { ...SKY, lampCount: 1 }), 5.15,
    '옛 세이브를 열었더니 창턱 밝기가 지금 물리의 안 겨눔 값과 다릅니다');
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
