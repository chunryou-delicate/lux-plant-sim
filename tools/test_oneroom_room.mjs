/* ============================================================
   tools/test_oneroom_room.mjs — 원룸 방 데이터 (house 소유)
   ------------------------------------------------------------
     node tools/test_oneroom_room.mjs

   증명 대상 (docs/handoff/oneroomfix-to-plan.md · docs/handoff/oneroomlamp-to-plan.md):

     ① uid      원룸 슬롯이 **명시 uid** 위에 있다 — `TEMP~` 가 하나도 없다
     ② 자리     큰 창 앞에 화분 자리가 생겼다. 자연광 최고가 반지하보다 밝고 아파트보다 어둡다
     ③ 빈 집    원룸에는 식물등 기구가 **하나도 없다** — 새 집은 원래 비어 있다
     ④ 문턱     원룸 자연광이 무늬종 최소(4.2)는 넘고 갈라짐(6.0)은 **못 넘는다**
     ⑤ 과하지   원룸의 어떤 자리도 반지하 최고를 넘지 않는다. 무늬종 갈라짐(8.4)은 못 넘는다
     ⑥ 회귀     **반지하 14칸이 한 톨도 안 바뀐다** — 아래 표와 정확히 같다(허용 오차 없음)

   ★★ 2026-08-07 (oneroomlamp) — ③ 과 ④ 가 **뒤집혔다.** 왜:
     박사님 확정: *"이사 가면 기존 짐 가지고 가는 형태. 새 집은 원래 비어 있고."*
     2026-08-06 에는 「산 등이 이사를 따라온다」를 **원룸 데이터에 등 기구 2개를 박아 두고
     켜지는 개수만 `ts.lamp.owned` 로 막는 것**으로 구현했었다. 그런데 그러면
       · 튜토가 꺼진 판(`ts.enabled` 가 아닌 판)에서는 `owned = rigs` 로 떨어져 **2개가 공짜**고,
       · 「새 집은 비어 있다」는 확정과도 어긋난다.
     그래서 원룸의 `oneroom-growlight-bar`·`oneroom-growlight-clip` 을 뺐다.
     반지하 둘은 그대로 둔다 — 거기는 「등을 사서 켜 본다」를 가르치는 방이고, 그 등이
     곧 **살 수 있는 자리**다(그래서 「산 개수가 천장」 검사는 ③-2 에서 반지하로 옮겨 살렸다).
   ⏸ 그 결과 원룸에는 지금 「등으로 문턱을 넘는다」가 **없다.** 산 등을 들고 가서
     설치하는 길이 아직 없기 때문이다 — 박사님 판단 자리다(oneroomlamp-to-plan §못 한 것).

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
  /* ★ 2026-08-07 — [0,1,2] 를 달라고 해도 [0] 만 나온다. `light_adapter.profile` 이
     `lampCounts.filter(n => n <= growRigs.length)` 로 **없는 등을 안 지어내기** 때문이다.
     원룸 기구가 0개가 됐으니 이것이 맞는 값이다(옛 값 [0,1,2] · [0,20,32]W). */
  assert.deepEqual(p.lampCounts, [0]);
  assert.deepEqual(p.lampWatts, [0]);
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

/* ══ ③ 새 집은 비어 있다 ═══════════════════════════════════════════════════
   2026-08-07 확정: *"이사 가면 기존 짐 가지고 가는 형태. 새 집은 원래 비어 있고."*
   원룸에 미리 놓여 있던 식물등 2개를 뺐다. 반지하 둘은 그대로다 —
   거기는 「등을 사서 켜 본다」를 가르치는 방이고, 그 등이 곧 살 수 있는 자리다. */
check('③ 빈 집 — 원룸에는 식물등 기구가 하나도 없다 (반지하 2개는 그대로)', () => {
  eng.build('oneroom');
  assert.equal(eng.growLampCount(), 0,
    '★ 원룸에 식물등 기구가 다시 생겼습니다 — 새 집은 원래 비어 있습니다(2026-08-07 확정)');
  assert.deepEqual(eng.lampList().map(l => l.preset), [],
    '★ 원룸 등 목록이 안 비었습니다');
  /* 데이터 쪽도 본다 — 프리셋 이름으로 되살아나는 것을 막는다 */
  const orLamps = (HOUSE.rooms.oneroom.furniture || [])
    .filter(f => /^growlight/.test(String(f.preset || '')));
  assert.deepEqual(orLamps.map(f => f.uid), [],
    `★ house_rooms.json 원룸에 growlight 가 남아 있습니다: ${orLamps.map(f => f.uid).join(', ')}`);

  /* 반지하는 손대지 않았다 — 같은 짝이 같은 순서로 그대로 있어야 한다 */
  eng.build('banjiha');
  const bj = eng.lampList();
  assert.equal(eng.growLampCount(), 2, '★ 반지하 식물등 기구가 2개가 아닙니다 — 튜토가 죽습니다');
  assert.deepEqual(bj.map(l => l.preset), ['growlight_bar', 'growlight_clip']);
  /* ⚠ 바 등은 **못 겨눈다.** 그것이 튜토의 긴장이다(growlight_aim.md §2 §7) */
  assert.equal(bj.find(l => l.uid === 'banjiha-growlight-bar').aimable, false,
    '★ 반지하 바 등이 겨눠집니다 — 튜토의 긴장이 깨졌습니다');
  assert.equal(bj.find(l => l.uid === 'banjiha-growlight-clip').aimable, true,
    '★ 반지하 집게등을 못 겨눕니다');
  eng.build('oneroom');
  info(`원룸 등 0개 · 반지하 등 ${bj.map(l => `${l.uid}[${l.preset}]`).join(' · ')}`);
});

check('③ -2 산 개수가 천장이다 — 안 샀으면 기구가 있어도 못 켠다 (반지하에서 잰다)', () => {
  /* ★ 이 검사는 원래 원룸에서 돌았다(2026-08-06 lampecon 의 구멍 막음). 원룸에 기구가
     0개가 되어 「기구는 있는데 안 샀다」를 원룸에서는 더 못 보인다 — 그래서 **반지하로
     옮겨 그대로 살렸다.** 판정을 뺀 것이 아니다: 같은 셈(lightGateOf.canTurnOn =
     min(기구 수, 산 개수))을 기구가 남아 있는 방에서 잠근다. */
  const S = newState({ room: 'banjiha', mode: 'real' });
  S.pots.push({ id: 'pot_01', plantId: 'monstera_deliciosa', slotId: null, at: null, variegated: false });
  S.tutorial = createTutorialState({ enabled: true });
  eng.build('banjiha');

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
  const V = newState({ room: 'banjiha', mode: 'real' });
  V.pots.push({ id: 'pot_01', plantId: 'monstera_deliciosa', slotId: null, at: null, variegated: false });
  const gv = lightGateOf(V, { light: eng }, { season: 'summer', lampCount: 0 });
  assert.equal(gv.ownedLamps, null, '튜토 없는 판에서 「0개 샀다」로 말합니다');
  assert.equal(gv.canTurnOn, 2);
  assert.match(gv.why, /2개 더 켤 수 있습니다/);

  /* 원룸 쪽은 **기구가 없다**고 말해야 한다 — 「더 사라」로 말하면 거짓 조언이 된다.
     (등을 두 개 사서 이사해도 켤 자리가 없다. 그 사실을 화면이 그대로 말하는지 본다.) */
  const O = newState({ room: 'oneroom', mode: 'real' });
  O.pots.push({ id: 'pot_01', plantId: 'monstera_deliciosa', slotId: null, at: null, variegated: false });
  O.tutorial = createTutorialState({ enabled: true });
  O.tutorial.lamp.owned = 2;
  eng.build('oneroom');
  const go = lightGateOf(O, { light: eng }, { season: 'summer', lampCount: 0 });
  assert.equal(go.growRigs, 0);
  assert.equal(go.canTurnOn, 0);
  assert.match(go.why, /이 방에는 식물등 기구가 하나도 없습니다/,
    `★ 등 2개를 산 채로 원룸에 왔는데 화면이 이렇게 말합니다 — "${go.why}"`);
  info(`⏸ 등 2개를 사서 이사해도 원룸에서 켤 자리가 0개다 — "${go.why}"`);
});

/* ══ ④ 갈라짐 문턱 ═══════════════════════════════════════════════════════
   ⏸★ 2026-08-07 — 이 검사가 **뒤집혔다.** 원래는 "등 1개로 문턱 6.0 을 넘는다"였고,
     등을 빼면서 그 길이 데이터에서 사라졌다. 문턱 6.0 은 한 톨도 안 건드렸다
     (data/balance/light_thresholds.json). 숫자를 낮춰 맞춘 것이 아니라,
     **넘던 수단이 없어진 것**을 그대로 적는다. 박사님 판단 자리다. */
check('④ 문턱 — 자연광이 무늬종 최소(4.2)는 넘고, 갈라짐(6.0)은 지금 아무 수로도 못 넘는다', () => {
  const S = newState({ room: 'oneroom', mode: 'real' });
  S.pots.push({ id: 'pot_01', plantId: 'monstera_deliciosa', slotId: null, at: null, variegated: false });
  eng.build('oneroom');

  const g0 = lightGateOf(S, { light: eng }, { season: 'summer', lampCount: 0 });
  assert.equal(g0.fenestrate, FEN, '갈라짐 문턱이 light_thresholds.json 값이 아닙니다');
  assert.equal(g0.canGrow, true, `★ 원룸 자연광이 min ${g0.min} 도 못 넘습니다 (${g0.best.avg7})`);
  assert.equal(g0.canVarie, true,
    `★ 원룸 자연광(${g0.best.avg7})이 무늬종 최소 ${g0.varieMin} 에 못 닿습니다 — ` +
    `그것마저 없으면 원룸이 반지하와 다를 것이 없습니다`);
  assert.equal(g0.canFenestrate, false,
    `★ 자연광만으로 갈라집니다 (${g0.best.avg7}) — skyViewK 1.18 은 그 아래로 잡은 값입니다`);

  /* ⏸ 등 개수를 뭘로 주든 값이 안 움직인다 — 켤 기구가 없기 때문이다.
     "등을 켰다고 치면"이 조용히 값을 올리는 일이 없어야 셈을 믿을 수 있다. */
  for (const n of [1, 2]) {
    const g = lightGateOf(S, { light: eng }, { season: 'summer', lampCount: n });
    assert.equal(g.best.avg7, g0.best.avg7,
      `★ 기구가 0개인데 lampCount ${n} 에서 값이 움직였습니다 (${g0.best.avg7} → ${g.best.avg7})`);
    assert.equal(g.canFenestrate, false);
  }
  assert.equal(countAvg7Over(OR.out, 2, FEN), 0,
    '★ 등 기구가 0개인 원룸에 갈라지는 칸이 있습니다 — 셈이 틀린 것입니다');

  /* 반지하보다 **넓다** — 자연광만으로 자랄 수 있는 칸 수로 잰다(⑤ 가 최고값을 잠근다).
     이것이 지금 원룸에 남은 유일한 「나아짐」이다. */
  assert.ok(countAvg7Over(OR.out, 0, g0.min) > countAvg7Over(BJ.out, 0, g0.min),
    '★ 자연광만으로 자랄 수 있는 칸이 반지하보다 안 많습니다');
  assert.ok(countAvg7Over(OR.out, 0, g0.varieMin) > countAvg7Over(BJ.out, 0, g0.varieMin),
    `★ 무늬종 최소(${g0.varieMin})를 넘는 칸이 반지하보다 안 많습니다`);

  info(`원룸 자연광 최고 ${g0.best.avg7} @ ${g0.best.slotId} — ` +
       `자람 ${g0.min} 넘음 · 무늬종 최소 ${g0.varieMin} 넘음 · 갈라짐 ${FEN} 못 넘음`);
  info(`  ⏸ ${g0.why}`);
  info(`  칸 수 — 자람(${g0.min}) 원룸 ${countAvg7Over(OR.out, 0, g0.min)}칸 vs 반지하 ${countAvg7Over(BJ.out, 0, g0.min)}칸 · ` +
       `무늬종 최소(${g0.varieMin}) 원룸 ${countAvg7Over(OR.out, 0, g0.varieMin)}칸 vs 반지하 ${countAvg7Over(BJ.out, 0, g0.varieMin)}칸 · ` +
       `갈라짐(${FEN}) 원룸 0칸`);
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
