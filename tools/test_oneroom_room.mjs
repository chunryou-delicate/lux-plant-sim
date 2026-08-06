/* ============================================================
   tools/test_oneroom_room.mjs — 원룸 방 데이터 (house 소유)
   ------------------------------------------------------------
     node tools/test_oneroom_room.mjs

   증명 대상 (docs/handoff/oneroomfix-to-plan.md):

     ① uid      원룸 슬롯이 **명시 uid** 위에 있다 — `TEMP~` 가 하나도 없다
     ② 자리     큰 창 앞에 화분 자리가 생겼다. 자연광 최고가 반지하보다 밝고 아파트보다 어둡다
     ③ 등       원룸에도 식물등 기구가 **반지하와 같은 2개** 있다 — 산 등이 이사를 따라온다
     ④ 문턱     몬스테라가 원룸에서 갈라짐 문턱 6.0 을 **등 1개로** 넘는다.
                자연광만으로는 **못 넘는다**(등이 값을 하는 자리가 남아 있어야 한다)
     ⑤ 과하지   원룸의 어떤 자리도 반지하 최고를 넘지 않는다. 무늬종 갈라짐(8.4)은 못 넘는다 → ④가 산다
     ⑥ 회귀     **반지하 14칸이 한 톨도 안 바뀐다** — 아래 표와 정확히 같다(허용 오차 없음)

   ★ 집 조립(THREE)을 헤드리스로 돌린다 — tools/test_lampaim.mjs 와 같은 방식이라
     브라우저와 **같은 코드**가 그대로 돈다.

   ⚠ 판정 단위는 **7일 이동평균(avg7)** 이다. 하루 peak 가 아니다 —
     `sim.fenestrationContrast` 도 `oneroom.lightGateOf` 도 avg7 로 가른다.
     avg7 = peak(맑음·여름) × weatherE('summer'). 여기서 그 계수를 안 박고 weather.js 에서 읽는다.
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

const { createLightEngine, TEMP_UID } = await import(toUrl('src/game/light_adapter.js'));
const { newState } = await import(toUrl('src/game/state.js'));
const { weatherE } = await import(toUrl('src/engine/weather.js'));
const { lightGateOf } = await import(toUrl('src/game/oneroom.js'));
const { createTutorialState } = await import(toUrl('src/game/tutorial.js'));

const HOUSE = dataOf('house_rooms.json');
const TH = dataOf('balance/light_thresholds.json');
function makeEngine() {
  return createLightEngine({
    houseRooms: JSON.parse(JSON.stringify(HOUSE)),
    winPresets: dataOf('window_presets.json').presets,
    doorPresets: dataOf('door_presets.json').presets, finishes: dataOf('room_finishes.json'),
    furnPresets: dataOf('furniture_presets.json').presets, lightPresets: dataOf('lighting_presets.json'),
    shadePresets: dataOf('shading_presets.json'), lightTh: TH,
    weatherBalance: dataOf('balance/weather.json')
  });
}
const eng = makeEngine();
const SKY = { weather: 'clear', season: 'summer', litHours: 12 };
const E = weatherE('summer');
const FEN = TH.plants.monstera_deliciosa.fenestrate;      // 6.0 — 여기서 안 짓는다
const VARIE_FEN = +(FEN * TH.variegated.need_mult).toFixed(4);   // 8.4
const OVERLIGHT = TH.plants.monstera_deliciosa.max;              // 16.0 — 넘으면 잎이 탄다

/* 그 방의 슬롯별 peak DLI(맑음·여름). 등 개수를 바꿔 가며 잰다. */
function tableOf(roomId, lamps) {
  const room = eng.build(roomId);
  const out = new Map();
  for (const s of room.slots) {
    eng.clearCache();
    out.set(s.slotId, lamps.map(n => +eng.dliOfSlot(s.slotId, { ...SKY, lampCount: n }).toFixed(2)));
  }
  return { room, out };
}
const avg7 = (peak) => +(peak * E).toFixed(2);
const maxOf = (t, i) => Math.max(...[...t.values()].map(v => v[i]));
const countAvg7Over = (t, i, th) => [...t.values()].filter(v => avg7(v[i]) >= th).length;

const results = [];
const check = (name, fn) => { try { fn(); results.push(['PASS', name]); }
                              catch (e) { results.push(['FAIL', name, e.message]); } };
const info = (s) => results.push(['INFO', '  ' + s]);

/* ══ ⑥ 회귀 — 반지하 14칸이 한 톨도 안 바뀐다 ════════════════════════════
   ★ 이게 이 작업의 절반이다. 이 창은 house_rooms.json 의 `oneroom` 절과
     furniture_presets.json 의 **새 프리셋 하나**만 건드렸으므로 반지하는
     구조상 안 바뀌어야 한다. "안 바뀌어야 한다"를 믿지 않고 잰다.
   ⚠ 값은 2026-08-06 main(729109c, 등 옮기기까지) 에서 뜬 것이다. tools/test_lampaim.mjs
     ①(안 겨눈 등 회귀)과 같은 판을 다른 각도에서 한 번 더 잠근다. */
const BANJIHA_FROZEN = {
  /* slotId              [등0,   등1,   등2  ] */
  'banjiha-sill:0':      [4.80,  5.15,  5.19],
  'banjiha-bed:0':       null,   // 침대는 슬롯을 안 낸다 — 아래에서 "없어야 한다"로 쓴다
  'banjiha-desk:0':      [0.61,  1.10,  1.86],
  'banjiha-desk:1':      [0.17,  0.32,  1.32],
  'banjiha-dresser:0':   [0.08,  0.14,  0.19],
  'banjiha-dresser:1':   [0.05,  0.10,  0.13],
  'banjiha-etagere:0':   [0.13,  0.89,  0.95],
  'banjiha-etagere:1':   [0.14,  0.95,  1.04],
  'banjiha-etagere:2':   [0.13,  0.88,  0.99],
  'banjiha-etagere:3':   [0.23,  1.94,  2.01],
  'banjiha-etagere:4':   [0.22,  2.27,  2.37],
  'banjiha-etagere:5':   [0.21,  1.92,  2.05],
  'banjiha-etagere:6':   [0.51,  5.98,  6.06],
  'banjiha-etagere:7':   [0.48, 12.31, 12.41],
  'banjiha-etagere:8':   [0.48,  5.95,  6.10]
};

const BJ = tableOf('banjiha', [0, 1, 2]);
check('⑥ 회귀 — 반지하 14칸 DLI 가 정확히 같다 (반올림 허용치 없음)', () => {
  assert.equal(BJ.room.slots.length, 14, `반지하 슬롯 수가 14 가 아닙니다 (${BJ.room.slots.length})`);
  assert.equal(BJ.room.growRigs.length, 2, '반지하 식물등 기구가 2개가 아닙니다');
  assert.equal(BJ.room.unstableSlots.length, 0, '반지하에 임시 uid 슬롯이 생겼습니다');
  for (const [slotId, want] of Object.entries(BANJIHA_FROZEN)) {
    if (want == null) { assert.ok(!BJ.out.has(slotId), `${slotId} 가 새로 생겼습니다`); continue; }
    const got = BJ.out.get(slotId);
    assert.ok(got, `★ 반지하 자리가 사라졌습니다: ${slotId}`);
    assert.deepEqual(got, want,
      `★ 반지하 ${slotId} 가 바뀌었습니다 — 얼렸을 때 [${want}] · 지금 [${got}]\n` +
      `  ⚠ 창턱(banjiha-sill:0)이 등1 에서 6.64 로 나오면 **트리가 낡은 것**이다 ` +
      `(2026-08-06 lampaim 의 BACK_REFLECT 0.18 이 없다). main 위에서 다시 돌려 보십시오.`);
  }
  const extra = [...BJ.out.keys()].filter(k => !(k in BANJIHA_FROZEN));
  assert.deepEqual(extra, [], `반지하에 없던 자리가 늘었습니다: ${extra.join(', ')}`);
  info(`반지하 등0 최고 ${maxOf(BJ.out, 0).toFixed(2)} · 등1 ${maxOf(BJ.out, 1).toFixed(2)} · ` +
       `등2 ${maxOf(BJ.out, 2).toFixed(2)} (7일평균 ${avg7(maxOf(BJ.out, 2))})`);
});

/* ══ ① uid — 임시 uid 가 하나도 없다 ═════════════════════════════════════ */
const OR = tableOf('oneroom', [0, 1, 2]);
check('① 안정 slotId — 원룸 슬롯에 TEMP~ 가 하나도 없다', () => {
  assert.equal(OR.room.unstableSlots.length, 0,
    `★ 아직 임시 uid 위입니다: ${OR.room.unstableSlots.join(', ')}`);
  assert.equal(OR.room.dupSlots.length, 0, `slotId 가 겹칩니다: ${OR.room.dupSlots.join(', ')}`);
  for (const s of OR.room.slots)
    assert.ok(!String(s.slotId).startsWith(TEMP_UID), `임시 uid: ${s.slotId}`);
  /* 데이터 쪽도 본다 — 슬롯을 안 내는 가구(침대·옷장)도 uid 가 있어야 자유 좌표가 산다 */
  const noUid = (HOUSE.rooms.oneroom.furniture || []).filter(f => !f.uid).map(f => f.preset);
  assert.deepEqual(noUid, [], `house_rooms.json 의 원룸 가구에 uid 가 없습니다: ${noUid.join(', ')}`);
  info(`원룸 가구 ${HOUSE.rooms.oneroom.furniture.length}개 전부 명시 uid · 슬롯 ${OR.room.slots.length}칸`);
});

check('① -2 프로파일을 뽑을 수 있다 — 임시 uid 면 던지던 곳이 안 던진다', () => {
  const p = eng.build('oneroom') && eng.profile([0, 1, 2]);
  assert.equal(p.room, 'oneroom');
  assert.equal(p.uidStable, true);
  assert.equal(p.slots.length, 15);
  assert.deepEqual(p.lampCounts, [0, 1, 2]);
  assert.deepEqual(p.lampWatts, [0, 20, 32]);   // 바 20W + 집게 12W — 반지하와 같다
  info(`원룸 프로파일 뽑힘 — 슬롯 ${p.slots.length}칸 · 등 ${p.lampCounts.join('/')}개 · ` +
       `${p.lampWatts.join('/')}W`);
});

/* ══ ② 창가 자리 ═════════════════════════════════════════════════════════ */
check('② 창가 자리 — 창턱 4칸이 생겼고, 자연광 최고가 반지하보다 밝고 아파트보다 어둡다', () => {
  const sill = [...OR.out.keys()].filter(k => k.startsWith('oneroom-sill:'));
  assert.equal(sill.length, 4, `창턱이 4칸이 아닙니다 (${sill.length})`);
  const orBest = maxOf(OR.out, 0), bjBest = maxOf(BJ.out, 0);
  assert.ok(orBest > bjBest,
    `★ 원룸 자연광 최고(${orBest})가 반지하(${bjBest})보다 안 밝습니다 — 이사가 벌입니다`);
  /* 아파트는 ④ 다. 원룸이 거기까지 가면 ④ 가 죽는다 — 자연광 천장을 아파트 아래로 둔다.
     ★ 사다리 전체(반지하<원룸<학원<투룸<아파트<온실)는 tools/test_floorlight.mjs 가 잠근다. */
  const AP = tableOf('apartment', [0]);
  const apBest = maxOf(AP.out, 0);
  assert.ok(orBest < apBest,
    `★ 원룸 자연광 최고(${orBest})가 아파트(${apBest})를 넘었습니다 — ④ 가 죽습니다`);
  info(`자연광 최고 peak — 반지하 ${bjBest.toFixed(2)} < 원룸 ${orBest.toFixed(2)} < 아파트 ${apBest.toFixed(2)}`);
  info(`  7일평균으로는 ${avg7(bjBest)} < ${avg7(orBest)} < ${avg7(apBest)}`);
  /* 다시 원룸으로 돌려 놓는다 — 아래 검사들이 이 엔진을 계속 쓴다 */
  eng.build('oneroom');
});

/* ══ ③ 산 등이 이사를 따라온다 ═══════════════════════════════════════════ */
check('③ 등 — 원룸에도 반지하와 **같은 종류가 같은 순서로** 2개 있다', () => {
  eng.build('banjiha');
  const bjOrder = eng.lampList().map(l => l.preset);
  eng.build('oneroom');
  assert.equal(eng.growLampCount(), 2,
    '★ 원룸 식물등 기구가 2개가 아닙니다 — 반지하에서 산 등이 이사에서 사라집니다');
  const orOrder = eng.lampList().map(l => l.preset);
  /* ★ 순서까지 같아야 한다 — light_adapter.rigsOn 이 **앞에서부터** 켠다.
     순서가 다르면 반지하에서 바(180)를 사고 원룸에서 집게(120)가 켜지는 조용한 강등이 된다. */
  assert.deepEqual(orOrder, bjOrder,
    `★ 등 종류·순서가 반지하와 다릅니다 — 반지하 [${bjOrder}] · 원룸 [${orOrder}]`);
  assert.deepEqual(orOrder, ['growlight_bar', 'growlight_clip']);
  /* ⚠ 바 등은 두 방 모두 **못 겨눈다.** 그것이 튜토의 긴장이다(growlight_aim.md §2 §7) */
  const list = eng.lampList();
  assert.equal(list[0].aimable, false, '★ 원룸 바 등이 겨눠집니다 — 붙박이여야 합니다');
  assert.equal(list[1].aimable, true, '★ 원룸 집게등을 못 겨눕니다');
  eng.build('banjiha');
  assert.equal(eng.lampList().find(l => l.uid === 'banjiha-growlight-bar').aimable, false,
    '★ 반지하 바 등이 겨눠집니다 — 튜토의 긴장이 깨졌습니다');
  eng.build('oneroom');
  info(`원룸 등 ${list.map(l => `${l.uid}[${l.preset}]`).join(' · ')} — 반지하와 같은 짝`);
});

check('③ -2 산 개수가 천장이다 — 안 샀으면 방에 기구가 있어도 못 켠다', () => {
  /* game.html fillLamps 와 같은 셈을 코어 쪽에서 확인한다(lightGateOf.canTurnOn) */
  const S = newState({ room: 'oneroom', mode: 'real' });
  S.pots.push({ id: 'pot_01', plantId: 'monstera_deliciosa', slotId: null, at: null, variegated: false });
  S.tutorial = createTutorialState({ enabled: true });
  eng.build('oneroom');

  S.tutorial.lamp.owned = 0;
  const g0 = lightGateOf(S, { light: eng }, { season: 'summer', lampCount: 0 });
  assert.equal(g0.growRigs, 2);
  assert.equal(g0.ownedLamps, 0);
  assert.equal(g0.canTurnOn, 0, '★ 안 산 등을 켤 수 있다고 말합니다');
  assert.match(g0.why, /더 사야 켭니다/, `안 샀는데 켜라고 합니다 — "${g0.why}"`);

  S.tutorial.lamp.owned = 1;
  const g1 = lightGateOf(S, { light: eng }, { season: 'summer', lampCount: 0 });
  assert.equal(g1.canTurnOn, 1);
  assert.match(g1.why, /1개 더 켤 수 있습니다/);

  /* 튜토가 없는 판(검수)은 예전 그대로 — 기구 수가 곧 천장이다 */
  const V = newState({ room: 'oneroom', mode: 'real' });
  V.pots.push({ id: 'pot_01', plantId: 'monstera_deliciosa', slotId: null, at: null, variegated: false });
  const gv = lightGateOf(V, { light: eng }, { season: 'summer', lampCount: 0 });
  assert.equal(gv.ownedLamps, null, '튜토 없는 판에서 「0개 샀다」로 말합니다');
  assert.equal(gv.canTurnOn, 2);
  assert.match(gv.why, /2개 더 켤 수 있습니다/);
});

/* ══ ④ 갈라짐 문턱 ═══════════════════════════════════════════════════════ */
check('④ 문턱 — 자연광만으로는 못 넘고, 등 1개로 넘는다', () => {
  const S = newState({ room: 'oneroom', mode: 'real' });
  S.pots.push({ id: 'pot_01', plantId: 'monstera_deliciosa', slotId: null, at: null, variegated: false });
  eng.build('oneroom');

  const g0 = lightGateOf(S, { light: eng }, { season: 'summer', lampCount: 0 });
  assert.equal(g0.fenestrate, FEN, '갈라짐 문턱이 light_thresholds.json 값이 아닙니다');
  assert.equal(g0.canGrow, true, `★ 원룸 자연광이 min ${g0.min} 도 못 넘습니다 (${g0.best.avg7})`);
  assert.equal(g0.canFenestrate, false,
    `★ 자연광만으로 갈라집니다 (${g0.best.avg7}) — 그러면 등을 산 뜻이 없습니다`);

  const g1 = lightGateOf(S, { light: eng }, { season: 'summer', lampCount: 1 });
  assert.equal(g1.canFenestrate, true,
    `★ 등 1개로도 갈라짐 문턱 ${FEN} 을 못 넘습니다 (${g1.best.avg7} @ ${g1.best.slotId})`);
  assert.equal(g1.why, null);

  const g2 = lightGateOf(S, { light: eng }, { season: 'summer', lampCount: 2 });
  assert.equal(g2.canFenestrate, true);

  /* 반지하보다 **넓다** — 최고값이 아니라 칸 수로 잰다(⑤ 가 최고값을 잠근다) */
  assert.ok(countAvg7Over(OR.out, 2, FEN) >= 2,
    `★ 등 둘을 다 켜도 갈라지는 칸이 ${countAvg7Over(OR.out, 2, FEN)}개뿐입니다 — 반지하(1칸)보다 넓어야 합니다`);
  assert.ok(countAvg7Over(OR.out, 0, g0.min) > countAvg7Over(BJ.out, 0, g0.min),
    '★ 자연광만으로 자랄 수 있는 칸이 반지하보다 안 많습니다');

  info(`원룸 갈라짐(문턱 ${FEN}) — 등0 ${g0.best.avg7} 불가 · 등1 ${g1.best.avg7} 가능(${g1.best.slotId}) · ` +
       `등2 ${g2.best.avg7} 가능`);
  info(`  문턱 넘는 칸 수 — 등0 ${countAvg7Over(OR.out, 0, FEN)} · ` +
       `등1 ${countAvg7Over(OR.out, 1, FEN)} · 등2 ${countAvg7Over(OR.out, 2, FEN)}칸 ` +
       `(반지하는 등1 ${countAvg7Over(BJ.out, 1, FEN)} · 등2 ${countAvg7Over(BJ.out, 2, FEN)}칸)`);
  info(`  자랄 수 있는 칸(min ${g0.min}) — 원룸 등0 ${countAvg7Over(OR.out, 0, g0.min)}칸 · ` +
       `반지하 등0 ${countAvg7Over(BJ.out, 0, g0.min)}칸`);
});

/* ══ ⑤ 반지하보다 낫되 과하지 않다 ═══════════════════════════════════════ */
check('⑤ 과하지 않다 — 원룸 최고가 반지하 최고를 안 넘고, 무늬종 갈라짐은 못 넘는다', () => {
  /* ★ 반지하 최고(등 밑 0.23m 짜리 한 칸)를 천장으로 쓴다. 그 한 칸이 이 게임에서 등이
     낼 수 있는 가장 센 값이고, 원룸이 그것을 넘으면 「등을 어디 두느냐」의 교훈이 뒤집힌다. */
  for (const n of [1, 2]) {
    const or = maxOf(OR.out, n), bj = maxOf(BJ.out, n);
    assert.ok(or < bj,
      `★ 등 ${n}개에서 원룸 최고(${or})가 반지하 최고(${bj})를 넘었습니다 — 과합니다`);
  }
  const best2 = avg7(maxOf(OR.out, 2));
  assert.ok(best2 < VARIE_FEN,
    `★ 원룸에서 무늬종 갈라짐(${VARIE_FEN})까지 됩니다 (${best2}) — 뒤 단계가 죽습니다`);
  /* 과광(16.0)도 본다 — 등을 창턱에 너무 가까이 두면 자리가 상이 아니라 벌이 된다 */
  const over = [...OR.out.entries()].filter(([, v]) => v[2] >= OVERLIGHT);
  assert.deepEqual(over.map(([k]) => k), [],
    `★ 등 둘을 켠 원룸에 과광(${OVERLIGHT}) 자리가 있습니다: ${over.map(([k, v]) => `${k} ${v[2]}`).join(', ')}`);
  info(`등 켠 최고 peak — 원룸 등1 ${maxOf(OR.out, 1).toFixed(2)} < 반지하 ${maxOf(BJ.out, 1).toFixed(2)} · ` +
       `원룸 등2 ${maxOf(OR.out, 2).toFixed(2)} < 반지하 ${maxOf(BJ.out, 2).toFixed(2)}`);
  info(`무늬종 갈라짐 ${VARIE_FEN} — 원룸 최고 7일평균 ${best2} 로 못 넘는다(온실 몫) · ` +
       `과광 ${OVERLIGHT} 넘는 칸 0`);
});

/* ══ 원룸 자리표 — 숫자를 남긴다 ═════════════════════════════════════════ */
check('원룸 15칸 자리표 (맑음·여름 peak / 7일평균)', () => {
  const rows = [...OR.out.entries()].sort((a, b) => b[1][2] - a[1][2]);
  for (const [id, v] of rows)
    info(`${id.padEnd(22)} peak ${v.map(x => String(x).padStart(6)).join('')}  ` +
         `avg7 ${v.map(x => String(avg7(x)).padStart(6)).join('')}`);
  assert.equal(rows.length, 15);
});

/* ---- 출력 ---- */
let fail = 0;
for (const r of results) {
  if (r[0] === 'INFO') { console.log('       ' + r[1]); continue; }
  if (r[0] === 'FAIL') fail++;
  console.log(`${r[0] === 'PASS' ? '  ✔' : '  ✘'} ${r[1]}${r[2] ? '\n      → ' + r[2] : ''}`);
}
const n = results.filter(r => r[0] !== 'INFO').length;
console.log(`\noneroom_room: ${fail ? 'FAIL' : 'PASS'}  (${n - fail}/${n})`);
process.exit(fail ? 1 : 0);
