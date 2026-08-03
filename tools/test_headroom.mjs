/* ============================================================
   test_headroom.mjs — 머리공간 정지 (core 소유)
   ------------------------------------------------------------
   증명하려는 것은 하나다: **위가 막힌 자리에서는 어느 크기부터 더 못 자란다.**
   죽지 않는다. 그냥 멈춘다. 옮기면 다시 오른다.

     A  반지하 슬롯 14칸의 머리공간이 **실제 기하**와 맞는다
     B  선반 아래 칸이 위 칸보다 작고, **바닥이 제일 크다**
     C  ★화분 높이를 안 빠뜨렸다 — 잎만 보면 안 막히는 자리가 화분까지 보면 막힌다
     D  도착 개체(유효 143일)는 창턱에 들어가고, 에타제르 아래 칸에는 **처음부터** 못 들어간다
     E  ★창턱에서 막히는 정확한 날 = **유효 454일**
     F  루프 — 막히면 유효 생장일이 **더 안 오른다**(달력은 가고 화분·상태는 그대로다)
     G  바닥으로 옮기면 **다시 오른다**
     H  머리공간 정지와 빛 부족 정지가 **다른 칸**에 실린다(처방이 정반대라서)
     I  못 재면 막지 않는다 — 방 치수가 없는 정적 프로파일 경로

   ★ 집 조립(THREE)을 헤드리스로 돌린다. test_free_place.mjs 와 같은 방식이다 —
     기하를 흉내 낸 스텁을 만들면 여기서 통과한 게 게임에서 통과한다는 보장이 사라진다.

   ★ 키 곡선(headroom.plantTopM)의 **근거**는 헤드리스 크롬 실측이다(docs/headroom.md).
     여기서는 그 실측값 몇 점을 못 박아 표가 조용히 흔들리는 것을 막는다.

     node tools/test_headroom.mjs
============================================================ */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/* ── 캔버스·문서 스텁 (test_free_place.mjs 와 같은 것) ─────────────────── */
const stubCtx = () => new Proxy({}, {
  get: (t, k) => {
    if (k === 'createImageData' || k === 'getImageData')
      return (w = 1, h = 1) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h });
    if (k === 'createLinearGradient' || k === 'createRadialGradient')
      return () => ({ addColorStop() {} });
    if (k === 'measureText') return () => ({ width: 0 });
    return () => {};
  }
});
const stubEl = () => ({ style: {}, dataset: {}, appendChild() {}, setAttribute() {},
                        addEventListener() {}, getContext: () => stubCtx() });
globalThis.document = {
  createElement: (t) => (t === 'canvas'
    ? { width: 1, height: 1, style: {}, getContext: () => stubCtx(), toDataURL: () => '' }
    : stubEl()),
  createElementNS: () => stubEl(),
  addEventListener() {}, getElementById: () => null,
  querySelector: () => null, querySelectorAll: () => [],
  body: stubEl(), documentElement: stubEl()
};
globalThis.window = globalThis;
globalThis.self = globalThis;

vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'vendor', 'three', 'three.min.js'), 'utf8'));
assert.ok(globalThis.THREE && globalThis.THREE.REVISION,
  'vendor/three/three.min.js 로 전역 THREE 를 세우지 못했습니다');

function toUrl(rel) { return 'file:///' + path.join(ROOT, rel).replace(/\\/g, '/'); }
const dataOf = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', rel), 'utf8'));

const { createLightEngine } = await import(toUrl('src/game/light_adapter.js'));
const H = await import(toUrl('src/game/headroom.js'));
const { newState, setPotAt } = await import(toUrl('src/game/state.js'));
const { nextDay } = await import(toUrl('src/game/loop.js'));

const eng = createLightEngine({
  houseRooms: dataOf('house_rooms.json'),
  winPresets: dataOf('window_presets.json').presets,
  doorPresets: dataOf('door_presets.json').presets,
  finishes: dataOf('room_finishes.json'),
  furnPresets: dataOf('furniture_presets.json').presets,
  lightPresets: dataOf('lighting_presets.json'),
  shadePresets: dataOf('shading_presets.json'),
  lightTh: dataOf('balance/light_thresholds.json'),
  weatherBalance: dataOf('balance/weather.json')
});
const room = eng.build('banjiha');
const CTX = { size: room.size, occluders: room.built.occluders, slots: room.slots, potD: 0.20 };

const slotAt = (id) => {
  const s = room.slots.find(x => x.slotId === id);
  assert.ok(s, `반지하 슬롯 ${id} 이 없습니다 — 방 데이터가 바뀌었습니다`);
  return { x: s.x, y: s.y, z: s.z };
};
const hr = (id) => H.headroomAt(slotAt(id), CTX);

const results = [];
const check = (name, fn) => { try { fn(); results.push(['PASS', name]); }
                              catch (e) { results.push(['FAIL', name, e.message]); } };
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (허용 ${tol})`);

/* ══ A · 실제 기하와 맞는가 ════════════════════════════════════════════ */
check('A 반지하 14칸의 머리공간이 실제 기하와 맞는다', () => {
  /* 방은 5×4×**2.3** — 반지하라 천장이 낮다. 이게 모든 값의 뿌리다 */
  assert.equal(room.size.h, 2.3, `방 높이가 ${room.size.h}`);

  /* 창턱 — 슬롯 y 1.585, 위로 아무것도 없다 ⇒ 천장까지 0.715 */
  near(hr('banjiha-sill:0'), 2.3 - 1.585, 1e-6, '창턱 머리공간');
  assert.equal(H.headroomDetailAt(slotAt('banjiha-sill:0'), CTX).by, 'ceiling');

  /* 책상(0.74)·서랍장(0.8) — 위가 통째로 트여 있다 */
  near(hr('banjiha-desk:0'), 2.3 - 0.74, 1e-6, '책상 머리공간');
  near(hr('banjiha-dresser:1'), 2.3 - 0.8, 1e-6, '서랍장 머리공간');

  /* 에타제르 3단 — 단 상판 y 는 0.03 / 0.412 / 0.794. 아래 두 칸의 천장은 **윗단 밑면**이다.
     ★ 이 값은 차폐체에 없다(가구 하나 = 통짜 상자 하나). 슬롯 단 높이로만 알 수 있다. */
  const step = 0.412 - 0.03;
  near(hr('banjiha-etagere:0'), step - H.SHELF_BOARD_M, 1e-6, '에타제르 1단 머리공간');
  near(hr('banjiha-etagere:4'), step - H.SHELF_BOARD_M, 1e-6, '에타제르 2단 머리공간');
  assert.equal(H.headroomDetailAt(slotAt('banjiha-etagere:0'), CTX).by, 'tier:banjiha-etagere',
    '선반 윗단이 아니라 다른 것에 걸렸습니다');
  /* 맨 윗단은 위가 트여 천장까지 */
  near(hr('banjiha-etagere:7'), 2.3 - 0.794, 1e-6, '에타제르 맨 윗단 머리공간');

  /* 차폐체도 실제로 본다 — 창턱 받침(y0 1.55) 아래 바닥은 그 받침이 천장이다 */
  const underSill = H.headroomDetailAt({ x: 0, y: 0, z: -1.95 }, CTX);
  near(underSill.m, 1.55, 1e-6, '창턱 받침 밑 바닥의 머리공간');
  assert.equal(underSill.by, 'occluder:furniture', `무엇에 걸렸는지가 ${underSill.by}`);

  results.push(['INFO', '  머리공간[m] — 창턱 0.715 · 책상 1.56 · 서랍장 1.50 · ' +
                        '에타제르 1·2단 0.352 · 3단 1.506 · 바닥 2.30']);
});

/* ══ B · 아래 칸 < 위 칸 · 바닥이 제일 크다 ═════════════════════════════ */
check('B 선반 아래 칸이 위 칸보다 작다 · 바닥이 제일 크다', () => {
  const low = hr('banjiha-etagere:1'), mid = hr('banjiha-etagere:4'), top = hr('banjiha-etagere:7');
  assert.ok(low < top, `아래 칸 ${low} 가 맨 윗칸 ${top} 보다 안 작습니다`);
  assert.equal(low, mid, '같은 선반의 1·2단은 단 간격이 같으므로 머리공간도 같아야 합니다');

  /* 가구가 없는 바닥 = 천장 전부. 방 안 어느 슬롯보다 크다 */
  const floor = H.headroomAt({ x: 0, y: 0, z: 0 }, CTX);
  assert.equal(floor, room.size.h, `바닥 머리공간이 ${floor}`);
  for (const s of room.slots) {
    const v = hr(s.slotId);
    assert.ok(v < floor, `${s.slotId} (${v}) 가 바닥(${floor})보다 작지 않습니다`);
  }
  /* 높이 순서가 뒤집히지 않는다 — 같은 기둥 위에서는 높이 올릴수록 머리공간이 준다 */
  const col = [0, 0.5, 1.0, 1.5, 2.0].map(y => H.headroomAt({ x: 0, y, z: 0 }, CTX));
  for (let i = 1; i < col.length; i++)
    assert.ok(col[i] < col[i - 1], `방 한가운데 y=${i} 에서 머리공간이 안 줄었습니다: ${col}`);
});

/* ══ C · ★ 화분 높이를 빠뜨리지 않았다 ═════════════════════════════════ */
check('C 화분 높이가 들어 있다 — 잎만 보면 안 막히는 자리가 화분까지 보면 막힌다', () => {
  /* 유효 0일 = 씨앗. 잎은 없는데 **화분이 이미 0.13m** 다 */
  const pot = H.plantTopM(0, { potD: 0.20 });
  near(pot, 0.1332, 0.005, '화분만 있는 날(유효 0일)의 높이');
  assert.ok(pot > 0.10, `★화분 높이가 ${pot} — 화분을 빼고 재고 있습니다`);

  /* 창턱에서 막히는 그 날, **화분 몫(0.133)을 빼면 안 막힌다.**
     그게 이 검사의 전부다 — 잎 높이만 보면 창턱 위 화분이 천장을 뚫는다. */
  const sill = H.headroomAt(slotAt('banjiha-sill:0'), CTX);
  const total = H.plantTopM(454, { potD: 0.20 });
  assert.equal(H.blockedBy(total, sill).blocked, true, '화분 포함 키로도 안 막혔습니다');
  assert.equal(H.blockedBy(total - pot, sill).blocked, false,
    '★화분 몫을 빼도 막힙니다 — 이 검사가 화분 높이를 못 잡아냅니다(표본을 다시 고르세요)');

  /* 화분 지름에 선형이다 — 작은 화분에 심으면 그루 전체가 작아진다(plant_assemble 이 통째로 줄인다) */
  near(H.plantTopM(143, { potD: 0.10 }), H.plantTopM(143, { potD: 0.20 }) / 2, 1e-3,
    '화분 지름 절반일 때 키');
  results.push(['INFO', `  화분(지름 0.20m) 자체 높이 ${pot}m · 유효 143일 총 키 ` +
                        `${H.plantTopM(143, { potD: 0.20 })}m`]);
});

/* ══ D · 도착 개체가 어디에 들어가나 ═══════════════════════════════════ */
check('D 도착 개체(유효 143일)는 창턱에 들어가고 에타제르 아래 칸에는 처음부터 못 들어간다', () => {
  const top143 = H.plantTopM(143, { potD: 0.20 });
  /* ★ 실측 대조 — 헤드리스 크롬에서 잰 값은 0.5403m(seed 92158 · potD 0.20).
     표를 줄이면서 생긴 오차만 허용한다. 이 줄이 깨지면 표가 흔들린 것이다. */
  near(top143, 0.5403, 0.01, '유효 143일 실측 대조');

  const sill = H.headroomCheck(slotAt('banjiha-sill:0'), 143, CTX);
  assert.equal(sill.blocked, false, '도착 개체가 창턱에 못 들어갑니다');
  near(sill.marginM, 0.175, 0.01, '창턱 여유');

  const low = H.headroomCheck(slotAt('banjiha-etagere:1'), 143, CTX);
  assert.equal(low.blocked, true, '★0.352m 칸에 0.54m 개체가 들어갔습니다');
  assert.ok(/삽수/.test(low.reason), `안내에 대안이 없습니다: ${low.reason}`);

  /* 이 자리에 심으면 며칠까지 자라나 — 도착(143)보다 한참 전이다 */
  assert.equal(H.maxGrowthDaysFor(hr('banjiha-etagere:1'), { potD: 0.20 }), 52);
  assert.equal(H.maxGrowthDaysFor(hr('banjiha-etagere:7'), { potD: 0.20 }), null,
    '맨 윗단이 3년(1095일) 안에 막힙니다');
  assert.equal(H.maxGrowthDaysFor(room.size.h, { potD: 0.20 }), null, '바닥이 막힙니다');
});

/* ══ E · ★★ 창턱에서 막히는 정확한 날 ══════════════════════════════════ */
check('E 창턱에서 막히는 날 = 유효 454일 (453일까지는 안 막힌다)', () => {
  const at = slotAt('banjiha-sill:0');
  assert.equal(H.headroomCheck(at, 453, CTX).blocked, false, '453일에 벌써 막혔습니다');
  assert.equal(H.headroomCheck(at, 454, CTX).blocked, true, '454일에 안 막혔습니다');
  assert.equal(H.maxGrowthDaysFor(hr('banjiha-sill:0'), { potD: 0.20 }), 453);

  /* 갑자기 서지 않는다 — 막히기 전에 경고 띠가 먼저 켜진다 */
  const warn = H.headroomCheck(at, 400, CTX);
  assert.equal(warn.blocked, false);
  assert.equal(warn.warn, true, '막히기 직전인데 경고가 안 켜집니다');
  assert.ok(!/빛/.test(warn.reason), `경고 문구에 '빛'이 들어 있습니다: ${warn.reason}`);

  results.push(['INFO', `  창턱(머리공간 0.715m): 도착 143일 → 유효 454일에 정지 ` +
                        `(311일치 더 자란다) · 경고는 유효 ${firstWarnDay(at)}일부터`]);
  function firstWarnDay(a) {
    for (let d = 143; d <= 1095; d++) if (H.headroomCheck(a, d, CTX).warn) return d;
    return null;
  }
});

/* ══════════════════════════════════════════════════════════════════════
   루프 — 진짜로 안 자라는가
   ══════════════════════════════════════════════════════════════════════ */
/* 빛은 늘 넉넉히 준다. 그래야 **머리공간만** 재는 실험이 된다 —
   반지하 바닥은 실제로 어두워서(§docs/headroom.md) 빛까지 섞으면 무엇이 멈춘 건지 모른다. */
function makeIo(growth0) {
  let cal = growth0, growth = growth0, todayDli = 12;
  const g = {
    assertContract() {},
    setGrowth(d) { cal = d; growth = d; return { growth, calDay: cal, drawn: true }; },
    setDailyLight(dli) { todayDli = dli; g.lightCalls++; },
    calendarDay() { return cal; },
    growthDays() { return growth; },
    advanceTo(day) {
      assert.equal(day, cal + 1, 'advanceTo 가 하루씩이 아닙니다');
      cal = day; g.advanceCalls++;
      growth++;
      return { calDay: cal, growth, grew: true, blocked: null, drawn: true };
    },
    growthBlocked() { return null; },
    growthPhase() { return { phaseId: 'leaf_mid', phaseKo: '중간잎', progress01: 0.5 }; },
    dli7() { return todayDli; }, dliCV() { return 0; }, ageOf(d) { return d; },
    lightCalls: 0, advanceCalls: 0
  };
  return { light: eng, growth: g };
}
function newGame(spot, growth0) {
  const io = makeIo(growth0);
  const S = newState({ room: 'banjiha', mode: 'novice' });
  S.pots.push({ id: 'pot_01', slotId: null, plantId: 'monstera_deliciosa',
                variegated: false, daysPlanted: 0 });
  setPotAt(S, 'pot_01', spot, { size: room.size, slots: room.slots, snapDist: 0.02 });
  return { S, io };
}

/* ══ F · 막히면 유효 생장일이 더 안 오른다 ═════════════════════════════ */
check('F 막힌 자리 — 유효 생장일이 더 안 오른다. 달력은 가고 화분은 그대로다(죽지 않는다)', () => {
  const { S, io } = newGame(slotAt('banjiha-sill:0'), 452);
  const seen = [];
  for (let i = 0; i < 6; i++) seen.push(nextDay(S, io).turn);

  const eff = seen.map(t => t.effectiveGrowthDays);
  assert.deepEqual(eff, [453, 454, 454, 454, 454, 454],
    `유효 생장일이 ${JSON.stringify(eff)} — 454 에서 멈춰야 합니다`);
  assert.equal(seen[1].headroomBlocked, null, '454 로 올라간 그 날은 아직 안 막힌 날입니다');
  assert.ok(seen[2].headroomBlocked, '★454 일이 됐는데 안 막혔습니다');
  assert.equal(seen[5].grew, false, '막혔는데 grew 가 false 가 아닙니다');

  /* 달력(코어 날짜)은 간다 — 시간이 멈추는 규칙이 아니다 */
  assert.equal(S.day, 6, `코어 날짜가 ${S.day}`);
  /* 돌본 날도 센다. 죽지 않는다 — 화분도 상태도 그대로다 */
  assert.equal(S.pots.length, 1, '★막혔다고 화분이 사라졌습니다');
  assert.equal(S.pots[0].daysPlanted, 6, `돌본 날이 ${S.pots[0].daysPlanted}`);
  assert.equal(S.desync, undefined, '머리공간 정지가 어긋남(desync)으로 잡혔습니다');

  /* 빛은 막힌 날에도 넘긴다 — 이력이 사실이어야 자리를 옮긴 뒤 판정이 맞는다 */
  assert.equal(io.growth.lightCalls, 6, `setDailyLight 이 ${io.growth.lightCalls}번`);
  assert.equal(io.growth.advanceCalls, 2, `advanceTo 가 ${io.growth.advanceCalls}번 — 막힌 날에도 불렀습니다`);

  /* 기록에 남는다. 다만 매일 도배하지 않는다 */
  const lines = S.log.map(l => l.msg).filter(m => /머리|천장|위가 막/.test(m));
  assert.equal(lines.length, 2,
    `머리공간 기록이 ${lines.length}줄 — 경고 1줄 + 정지 1줄이어야 합니다: ${lines.join(' / ')}`);
  /* ★ 갑자기 서지 않는다 — 경고가 먼저다 */
  assert.ok(/곧 더 못 자랍니다/.test(lines[0]), `첫 줄이 경고가 아닙니다: ${lines[0]}`);
  assert.ok(/위가 막혔습니다/.test(lines[1]), `둘째 줄이 정지가 아닙니다: ${lines[1]}`);
  for (const l of lines) assert.ok(!/빛/.test(l), `기록 문구에 '빛'이 섞였습니다: ${l}`);
  results.push(['INFO', '  ' + lines.join('\n  ')]);
});

/* ══ G · 바닥으로 옮기면 다시 오른다 ═══════════════════════════════════ */
check('G 바닥(위가 트인 자리)으로 옮기면 다시 오른다', () => {
  const { S, io } = newGame(slotAt('banjiha-sill:0'), 454);
  for (let i = 0; i < 3; i++) nextDay(S, io);
  assert.equal(io.growth.growthDays(), 454, '창턱에서 자랐습니다');

  /* 위가 트인 바닥으로 내린다 */
  setPotAt(S, 'pot_01', { x: 0, y: 0, z: 0 }, { size: room.size, slots: room.slots });
  const after = [];
  for (let i = 0; i < 3; i++) after.push(nextDay(S, io).turn);

  assert.deepEqual(after.map(t => t.effectiveGrowthDays), [455, 456, 457],
    '★바닥으로 내렸는데 다시 안 자랍니다');
  assert.equal(after[0].headroomBlocked, null, '바닥인데 아직 막혔다고 합니다');
  assert.equal(after[0].headroom.headroomM, 2.3, `바닥 머리공간이 ${after[0].headroom.headroomM}`);
  assert.ok(S.log.some(l => /위가 트였습니다/.test(l.msg)), '다시 자란다는 기록이 없습니다');

  /* 반대로 다시 낮은 칸에 올리면 또 멈춘다 — 되돌릴 수 있는 규칙이다(죽음이 아니다) */
  setPotAt(S, 'pot_01', slotAt('banjiha-etagere:1'), { size: room.size, slots: room.slots, snapDist: 0.02 });
  const back = nextDay(S, io).turn;
  assert.ok(back.headroomBlocked, '0.352m 칸에 올렸는데 안 막혔습니다');
  assert.equal(back.effectiveGrowthDays, 457, '막혔는데 자랐습니다');
});

/* ══ H · 두 정지가 섞이지 않는다 ═══════════════════════════════════════ */
check('H 머리공간 정지와 빛 부족 정지가 다른 칸에 실린다', () => {
  /* ① 머리공간만 막힌 경우 — growth 쪽은 "빛 문제 없음"이라고 말한다 */
  const a = newGame(slotAt('banjiha-sill:0'), 460);
  const t1 = nextDay(a.S, a.io).turn;
  assert.ok(t1.headroomBlocked, '머리공간이 안 막혔습니다');
  assert.equal(t1.growthBlocked, null, `빛 칸에 ${t1.growthBlocked} 가 실렸습니다 — 두 사유가 섞였습니다`);
  assert.equal(t1.headroom.kind, H.HEADROOM_BLOCK);

  /* ② 빛만 막힌 경우 — 머리공간 칸은 비어 있어야 한다 */
  const b = newGame({ x: 0, y: 0, z: 0 }, 100);
  b.io.growth.advanceTo = (day) => { b.io.growth.calendarDay(); return null; };
  b.io.growth.advanceTo = function (day) {
    return { calDay: day, growth: 100, grew: false, blocked: '빛 부족 — 7일평균 0.20 < 최소 3', drawn: true };
  };
  const t2 = nextDay(b.S, b.io).turn;
  assert.equal(t2.headroomBlocked, null, '바닥인데 머리공간 칸에 값이 실렸습니다');
  assert.ok(/빛 부족/.test(t2.growthBlocked), '빛 칸이 비었습니다');
});

/* ══ I · 못 재면 막지 않는다 ═══════════════════════════════════════════ */
check('I 방 기하를 모르면 막지 않는다 — 근거 없이 멈추면 아무도 못 고친다', () => {
  /* 정적 프로파일 경로(room_profile.createProfileLight)의 room 에는 size·occluders 가 없다 */
  assert.equal(H.headroomAt(slotAt('banjiha-sill:0'), { slots: room.slots }), null);
  const r = H.blockedBy(9.9, null);
  assert.equal(r.blocked, false, '★못 쟀는데 막았습니다');
  assert.equal(r.known, false);
  assert.equal(r.marginM, null, '못 쟀는데 여유를 숫자로 지어냈습니다');

  /* 좌표가 이상해도 지어내지 않는다 */
  assert.equal(H.headroomAt({ x: NaN, y: 0, z: 0 }, CTX), null);
  assert.equal(H.plantTopM(NaN), null);
  assert.equal(H.plantTopM(undefined), null);

  /* 그리고 실제로 루프가 안 막는다 — 좌표 없는 옛 화분 */
  const io = makeIo(900);
  const S = newState({ room: 'banjiha', mode: 'novice' });
  S.pots.push({ id: 'pot_01', slotId: 'banjiha-etagere:1', plantId: 'monstera_deliciosa' });
  /* rehomePot 이 좌표를 채우므로 여기서는 막히는 게 맞다 — 채우기 전 상태만 직접 확인한다 */
  assert.equal(S.pots[0].at, undefined);
  const t = nextDay(S, io).turn;
  assert.ok(t.headroom, '좌표가 채워졌으면 판정이 있어야 합니다');
  assert.equal(t.headroomBlocked !== null, true, '좌표를 채운 뒤에도 판정을 안 했습니다');
});

/* ── 보고 ─────────────────────────────────────────────────────────────── */
let fail = 0;
for (const [st, name, msg] of results) {
  if (st === 'INFO') { console.log(name); continue; }
  if (st === 'FAIL') fail++;
  console.log(`${st}  ${name}${msg ? '\n      → ' + msg : ''}`);
}
console.log(fail ? `\nheadroom: FAIL (${fail}건)` : '\nheadroom: PASS');
process.exit(fail ? 1 : 0);
