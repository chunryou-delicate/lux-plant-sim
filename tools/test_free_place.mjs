/* ============================================================
   test_free_place.mjs — 자유 좌표 배치 (core 소유)
   ------------------------------------------------------------
   증명하려는 것은 하나다: **슬롯은 추천 자리 목록일 뿐, 물리는 원래 좌표 함수였다.**
   그래서 자유 배치는 새 물리가 아니라 같은 함수에 점을 하나 더 넣는 일이다.

     H  같은 좌표면 슬롯 경로와 자유 좌표 경로의 DLI 가 **같은 값**이다
     I  창가 자유 좌표가 방 안쪽 자유 좌표보다 밝다
     L  가구를 옮기면 그 뒤 그늘의 DLI 가 실제로 바뀐다
     F  옛 세이브(slotId 만)의 좌표가 정확히 채워진다
     A·B 좌표가 NaN·무한대·방 밖이면 조용히 통과하지 않는다

   ★ 집 조립(THREE)을 헤드리스로 돌린다.
     `vendor/three/three.min.js` 는 UMD 라 `vm.runInThisContext` 로 올리면 전역 THREE 가 선다.
     `house.js` 는 그 전역을 쓰므로 브라우저와 **같은 코드**가 그대로 돈다 —
     기하를 흉내 낸 스텁을 만들면 여기서 통과한 게 게임에서 통과한다는 보장이 사라진다.
     `document`·`canvas` 만 최소로 흉내 낸다(결 텍스처가 부르는 자리뿐이라 값이 안 쓰인다).

     node tools/test_free_place.mjs
============================================================ */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/* ── 캔버스·문서 스텁 ────────────────────────────────────────────────────
   textures.faintGrainTexture() 가 2D 캔버스에 결을 찍는다. 그 픽셀은 조도 계산에
   안 쓰이므로 "터지지만 않는" 최소 스텁이면 된다. */
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

const { createLightEngine } = await import(toUrl('src/game/light_adapter.js'));
const place = await import(toUrl('src/game/place.js'));
const {
  newState, givePlant, pot0, rehomePot, migratePots, setPotAt, setPotSlot,
  setFurniturePlacement, furnitureOverrides
} = await import(toUrl('src/game/state.js'));

function toUrl(rel) { return 'file:///' + path.join(ROOT, rel).replace(/\\/g, '/'); }
const dataOf = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', rel), 'utf8'));

const HOUSE_ROOMS_PATH = path.join(ROOT, 'data', 'house_rooms.json');
const HOUSE_ROOMS_BYTES = fs.readFileSync(HOUSE_ROOMS_PATH);

function makeEngine() {
  return createLightEngine({
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
}

/* 맑음·여름·등 0개 — 반지하 실측표(measured.slots)와 같은 조건 */
const SKY = { weather: 'clear', season: 'summer', lampCount: 0, litHours: 12 };

const eng = makeEngine();
const room = eng.build('banjiha');
const SILL = room.slots.find(s => s.slotId === 'banjiha-sill:0');
assert.ok(SILL, '반지하 창턱 슬롯(banjiha-sill:0)이 없습니다 — 방 데이터가 바뀌었습니다');

const results = [];
const check = (name, fn) => { try { fn(); results.push(['PASS', name]); }
                              catch (e) { results.push(['FAIL', name, e.message]); } };

/* ══ A · 자리 검증 — NaN·무한대·빠진 필드는 조용히 안 지나간다 ═══════════ */
check('A 자리 검증 — NaN·무한대·빠진 좌표는 던진다(0으로 안 메꾼다)', () => {
  assert.throws(() => place.makeAt({ x: NaN, y: 1, z: 0 }), /NaN/, 'NaN 이 통과했습니다');
  assert.throws(() => place.makeAt({ x: Infinity, y: 1, z: 0 }), /무한대/, '무한대가 통과했습니다');
  assert.throws(() => place.makeAt({ x: 0, y: 1 }), /z/, 'z 가 없는데 통과했습니다');
  assert.throws(() => place.makeAt({ x: '0', y: 1, z: 0 }), /숫자가 아닙니다/, '문자열이 통과했습니다');
  assert.throws(() => place.makeAt({ x: 0, y: 1, z: 0, rotY: NaN }), /rotY/, 'rotY NaN 이 통과했습니다');
  /* 바닥인데 자가차폐 제외 번호가 붙으면 남의 그림자를 지운다 — 조용히 밝아지는 유형 */
  assert.throws(() => place.makeAt({ x: 0, y: 0, z: 0, occIdx: 3 }), /occIdx/,
    '바닥(onUid=null)에 occIdx 가 붙었는데 통과했습니다');
  assert.throws(() => place.makeAt({ x: 0, y: 0, z: 0, onUid: 'a', occIdx: -1 }), /occIdx/);
  assert.throws(() => place.makeAt({ x: 0, y: 0, z: 0, onUid: 'a', occIdx: 1.5 }), /occIdx/);

  const at = place.makeAt({ x: 0.5, y: 0.74, z: -1.4, onUid: 'banjiha-desk', occIdx: 2 });
  assert.deepEqual(at, { x: 0.5, y: 0.74, z: -1.4, rotY: 0, onUid: 'banjiha-desk', occIdx: 2 });
  /* 검증만 하는 쪽은 던지지 않고 이유를 말한다 */
  assert.equal(place.validateAt({ x: 0, y: 0, z: 0 }).ok, true);
  assert.equal(place.validateAt({ x: 0, y: 0, z: NaN }).ok, false);
});

/* ══ B · 방 경계 — 방 밖 좌표는 조용히 통과하지 않는다 ═══════════════════ */
check('B 방 밖 좌표 — makeAt 도 dliAt 도 던진다', () => {
  const size = room.size;                       // 반지하 5 × 4 × 2.3
  assert.equal(place.inRoom({ x: 0, y: 1, z: 0 }, size), true);
  assert.equal(place.inRoom({ x: 2.5, y: 1, z: 0 }, size), true, '경계 위 점이 떨어졌습니다');
  assert.equal(place.inRoom({ x: 2.6, y: 1, z: 0 }, size), false);
  assert.equal(place.inRoom({ x: 0, y: 1, z: -2.4 }, size), false);
  assert.equal(place.inRoom({ x: 0, y: 2.9, z: 0 }, size), false, '천장을 뚫었는데 통과했습니다');
  assert.equal(place.inRoom({ x: 0, y: -0.5, z: 0 }, size), false, '바닥을 뚫었는데 통과했습니다');

  assert.throws(() => place.makeAt({ x: 9, y: 1, z: 0 }, { size }), /방 밖/);
  /* ★ 미리보기가 방 밖을 물으면 0(=어두운 자리)을 내면 안 된다. 그건 조용히 틀리는 답이다. */
  assert.throws(() => eng.dliAt({ x: 9, y: 1, z: 0 }, SKY), /방 밖/, 'dliAt 이 방 밖을 통과시켰습니다');
  assert.throws(() => eng.dliAt({ x: 0, y: NaN, z: 0 }, SKY), /NaN/, 'dliAt 이 NaN 을 통과시켰습니다');
  assert.throws(() => eng.dliAt({ x: 0, y: Infinity, z: 0 }, SKY), /무한대/);
});

/* ══ C · 추천 자리 → 좌표 ══════════════════════════════════════════════ */
check('C atFromSlot — 좌표·onUid·occIdx 를 슬롯에서 그대로 뽑는다', () => {
  const at = place.atFromSlot(SILL);
  assert.equal(at.x, SILL.x); assert.equal(at.y, SILL.y); assert.equal(at.z, SILL.z);
  assert.equal(at.onUid, 'banjiha-sill', `onUid 가 ${at.onUid}`);
  assert.equal(at.occIdx, SILL.occIdx, '자가차폐 번호가 안 넘어왔습니다');
  const desk = room.slots.find(s => s.slotId === 'banjiha-desk:1');
  assert.equal(place.atFromSlot(desk).onUid, 'banjiha-desk');
  /* 좌표가 없는 얇은 슬롯은 지어내지 않고 던진다 */
  assert.throws(() => place.atFromSlot({ slotId: 'x:0' }), /자리가 올바르지 않습니다/);
});

/* ══ D · 가까운 추천 자리 (UI 원형 가이딩) ══════════════════════════════ */
check('D nearestSlot — 제일 가까운 자리와 거리 · maxDist · 화분 지름 거르기', () => {
  const near = place.nearestSlot({ x: SILL.x + 0.03, y: SILL.y, z: SILL.z }, room.slots);
  assert.equal(near.slot.slotId, 'banjiha-sill:0', `가장 가까운 자리가 ${near.slot.slotId}`);
  assert.ok(Math.abs(near.dist - 0.03) < 1e-9, `거리가 ${near.dist}`);

  assert.equal(place.nearestSlot({ x: SILL.x + 0.03, y: SILL.y, z: SILL.z }, room.slots,
                                 { maxDist: 0.01 }), null, 'maxDist 를 넘었는데 붙었습니다');
  /* 창턱은 0.21 한 칸이다 — 큰 화분은 후보에서 빠져야 한다 */
  const big = place.nearestSlot({ x: SILL.x, y: SILL.y, z: SILL.z }, room.slots, { potD: 0.5 });
  assert.notEqual(big && big.slot.slotId, 'banjiha-sill:0', '0.5m 화분이 0.21 자리에 붙었습니다');
  assert.equal(place.slotHolds(SILL, 0.202), true);
  assert.equal(place.slotHolds(SILL, 0.24), false);
  /* maxPotD 를 모르면 '못 받는다'로 본다 — 결측을 관대하게 넘기지 않는다 */
  assert.equal(place.slotHolds({ maxPotD: null }, 0.1), false);
  assert.equal(place.nearestSlot({ x: 0, y: 0, z: 0 }, []), null);
  assert.throws(() => place.nearestSlot({ x: NaN, y: 0, z: 0 }, room.slots), /유한하지 않습니다/);
});

/* ══ E · 면 위에 들어가는가 ════════════════════════════════════════════ */
check('E fitsOn — 발자국이 면 밖이면 이유를 말한다 · 회전한 면도 본다', () => {
  const top = { uid: 't', x: 0, z: 0, w: 1.0, d: 0.5, rotY: 0, top: 0.75, maxPotD: null };
  const at = (x, z, y = 0.75) => ({ x, y, z, rotY: 0, onUid: 't', occIdx: null });
  assert.equal(fits(at(0, 0), 0.3, top).ok, true);
  assert.equal(fits(at(0.4, 0), 0.3, top).ok, false, '가로로 삐져나왔는데 통과했습니다');
  assert.equal(fits(at(0, 0.2), 0.3, top).ok, false, '세로로 삐져나왔는데 통과했습니다');
  assert.ok(fits(at(0, 0), 0.3, top).margin > 0.09, '여유 계산이 이상합니다');

  /* 90° 돌린 면 — 폭과 깊이가 바뀐다 */
  const rot = { ...top, rotY: Math.PI / 2 };
  assert.equal(fits(at(0.4, 0), 0.3, rot).ok, false);
  assert.equal(fits(at(0, 0.3), 0.3, rot).ok, true, '돌린 면의 긴 쪽으로 못 놨습니다');
  assert.equal(fits(at(0, 0.4), 0.3, rot).ok, false, '긴 쪽이라도 가장자리는 삐져나온다');

  /* 높이가 다르면 그건 다른 면이다 */
  assert.equal(fits(at(0, 0, 1.4), 0.3, top).ok, false, '상판과 0.65m 뜬 자리가 통과했습니다');
  /* 면이 정한 상한이 먼저다 */
  assert.equal(fits(at(0, 0), 0.3, { ...top, maxPotD: 0.21 }).ok, false);
  assert.equal(fits(at(0, 0), NaN, top).ok, false);
  assert.equal(fits(at(0, 0), 0.3, null).ok, false);

  /* 바닥 — 방 전체가 한 면이다 */
  const floor = place.floorSurface(room.size);
  assert.equal(fits({ x: 0, y: 0, z: 0, rotY: 0, onUid: null, occIdx: null }, 0.4, floor).ok, true);
  assert.equal(fits({ x: 2.45, y: 0, z: 0, rotY: 0, onUid: null, occIdx: null }, 0.4, floor).ok, false);

  /* 슬롯에서 면을 되만들 수도 있다(3D 없이 쓰는 우회로) */
  const s = place.surfaceFromSlots('banjiha-etagere', room.slots);
  assert.ok(s && s.w > 0 && s.d > 0, '슬롯으로 면을 못 만들었습니다');
  function fits(a, d, sur) { return place.fitsOn(a, d, sur); }
});

/* ══ F · ★ 옛 세이브 마이그레이션 ═══════════════════════════════════════ */
check('F 옛 세이브 — slotId 만 있으면 그 슬롯 좌표가 정확히 채워진다', () => {
  /* 2026-08-02 이전 세이브 모양: at 이 없다 */
  const S = newState({ room: 'banjiha' });
  S.pots.push({ id: 'pot_01', slotId: 'banjiha-sill:0', plantId: 'monstera_deliciosa',
                variegated: false, daysPlanted: 3 });
  const r = migratePots(S, room.slots);
  assert.equal(r.filled.length, 1, '좌표를 안 채웠습니다');
  const at = S.pots[0].at;
  assert.deepEqual({ x: at.x, y: at.y, z: at.z }, { x: SILL.x, y: SILL.y, z: SILL.z },
    '채운 좌표가 슬롯과 다릅니다');
  assert.equal(at.onUid, 'banjiha-sill');
  assert.equal(at.occIdx, SILL.occIdx, '자가차폐 번호가 빠졌습니다');
  assert.equal(S.pots[0].slotId, 'banjiha-sill:0', 'slotId 를 버렸습니다(하위호환 파손)');

  /* 좌표가 이미 있으면 좌표가 이긴다 — 덮어쓰지 않는다 */
  const keep = place.makeAt({ x: 1.0, y: 0.74, z: -1.4, onUid: 'banjiha-desk', occIdx: 2 });
  S.pots[0].at = keep;
  migratePots(S, room.slots);
  assert.equal(S.pots[0].at, keep, '이미 있는 좌표를 슬롯 값으로 덮어썼습니다');

  /* 모르는 슬롯·좌표 없는 슬롯은 지어내지 않고 건너뛴다(0,0,0 으로 메꾸면 순간이동한다) */
  const S2 = newState({ room: 'banjiha' });
  S2.pots.push({ id: 'pot_01', slotId: '없는-자리:0' });
  S2.pots.push({ id: 'pot_02', slotId: '얇은:0' });
  const r2 = migratePots(S2, [{ slotId: '얇은:0' }]);
  assert.equal(r2.filled.length, 0);
  assert.equal(r2.skipped.length, 2, `건너뛴 이유가 ${r2.skipped.length}건`);
  assert.equal(S2.pots[0].at, undefined);
});

/* ══ G · 쓰기 창구 — 붙으면 안정 id, 벗어나면 free: ═══════════════════ */
check('G setPotAt — 슬롯에 붙으면 안정 slotId · 벗어나면 free:{화분 id}', () => {
  const S = newState({ room: 'banjiha' });
  S.pots.push({ id: 'pot_01', slotId: null, plantId: 'monstera_deliciosa' });

  /* 자유 좌표 — 바닥 한가운데 */
  const free = setPotAt(S, 'pot_01', { x: 0.4, y: 0, z: 0.2 },
                        { size: room.size, slots: room.slots, snapDist: 0.15 });
  assert.equal(free.slotId, 'free:pot_01', `자유 좌표인데 slotId 가 ${free.slotId}`);
  assert.equal(place.isFreeSlotId(S.pots[0].slotId), true);
  assert.deepEqual({ x: S.pots[0].at.x, z: S.pots[0].at.z }, { x: 0.4, z: 0.2 });

  /* 추천 자리 근처로 끌면 그 자리로 붙고 안정 id 를 되찾는다 */
  const snap = setPotAt(S, 'pot_01', { x: SILL.x + 0.04, y: SILL.y, z: SILL.z },
                        { size: room.size, slots: room.slots, snapDist: 0.15 });
  assert.equal(snap.slotId, 'banjiha-sill:0', `붙었는데 slotId 가 ${snap.slotId}`);
  assert.deepEqual({ x: S.pots[0].at.x, y: S.pots[0].at.y, z: S.pots[0].at.z },
                   { x: SILL.x, y: SILL.y, z: SILL.z }, '붙었는데 좌표가 슬롯과 다릅니다');
  assert.equal(S.pots[0].at.occIdx, SILL.occIdx);

  /* 방 밖은 여기서도 못 넣는다 */
  assert.throws(() => setPotAt(S, 'pot_01', { x: 99, y: 0, z: 0 }, { size: room.size }), /방 밖/);
  assert.throws(() => setPotAt(S, '없는화분', { x: 0, y: 0, z: 0 }), /모르는 화분/);

  /* 예전 경로(자리 지정)도 좌표를 같이 세운다 */
  setPotSlot(S, 'pot_01', 'banjiha-desk:0', room.slots);
  assert.equal(S.pots[0].slotId, 'banjiha-desk:0');
  assert.equal(S.pots[0].at.onUid, 'banjiha-desk');
});

/* ══ H · ★★ 물리는 하나다 ═════════════════════════════════════════════ */
check('H 같은 좌표면 슬롯 경로와 자유 좌표 경로의 DLI 가 같다', () => {
  for (const s of room.slots) {
    const bySlot = eng.dliOfSlot(s.slotId, SKY);
    const byPoint = eng.dliAt({ x: s.x, y: s.y, z: s.z }, { ...SKY, occIdx: s.occIdx }).dli;
    assert.equal(byPoint, bySlot,
      `${s.slotId}: 슬롯 경로 ${bySlot} vs 자유 좌표 경로 ${byPoint} — 물리가 둘로 갈렸습니다`);
  }
  results.push(['INFO', `  슬롯 ${room.slots.length}칸 전부 두 경로가 같은 값 ` +
                        `(창턱 ${eng.dliOfSlot('banjiha-sill:0', SKY)})`]);

  /* ★ selfIdx(자가차폐 제외)가 실제로 쓰이는지 — 값으로 확인한다.
     daily_light.js 가 슬롯마다 `selfIdx: s.occIdx` 를 넘기고
     daylight_lux.isShadowed 가 `if (i === selfIdx) continue` 로 건너뛴다.
     안 넘기면 선반이 제 위 칸을 가려 0 이 된다. */
  const et = room.slots.find(s => s.slotId === 'banjiha-etagere:0');
  const withSelf = eng.dliAt({ x: et.x, y: et.y, z: et.z }, { ...SKY, occIdx: et.occIdx }).dli;
  const without = eng.dliAt({ x: et.x, y: et.y, z: et.z }, SKY).dli;
  assert.ok(withSelf > 0, '자가차폐를 뺐는데도 0 입니다');
  assert.equal(without, 0, `자가차폐를 안 뺐는데 ${without} — occIdx 가 안 쓰이고 있습니다`);
  results.push(['INFO', `  selfIdx 확인: banjiha-etagere:0 자기그림자 제외 ${withSelf} / 미제외 ${without}`]);
});

/* ══ I · 창가가 안쪽보다 밝다 ══════════════════════════════════════════ */
check('I 창가 자유 좌표가 방 안쪽 자유 좌표보다 밝다', () => {
  const y = 1.585;                            // 창턱 높이. 같은 높이에서 깊이만 바꾼다
  const byZ = [-1.9, -1.5, -1.0, 0, 1.0, 1.8].map(z => ({ z, dli: eng.dliAt({ x: 0, y, z }, SKY).dli }));
  for (let i = 1; i < byZ.length; i++)
    assert.ok(byZ[i].dli < byZ[i - 1].dli,
      `z=${byZ[i].z} (${byZ[i].dli}) 가 z=${byZ[i - 1].z} (${byZ[i - 1].dli}) 보다 안 어둡습니다`);
  assert.ok(byZ[0].dli > byZ[byZ.length - 1].dli * 10,
    `창가와 안쪽 차이가 ${byZ[0].dli} vs ${byZ[byZ.length - 1].dli} — 자리 선택이 안 생깁니다`);
  results.push(['INFO', '  창가→안쪽 DLI: ' + byZ.map(r => `z${r.z}=${r.dli}`).join(' · ')]);
});

/* ══ J · 하루 계약에 자유 좌표 화분이 실린다 ═══════════════════════════ */
check('J 자유 좌표 화분이 계약에 실린다 · 같은 자리가 두 번 안 실린다', () => {
  const S = newState({ room: 'banjiha', mode: 'novice' });
  S.pots.push({ id: 'pot_01', slotId: null, plantId: 'monstera_deliciosa', variegated: false });
  setPotAt(S, 'pot_01', { x: 0, y: 1.2, z: -1.6 }, { size: room.size, slots: room.slots });

  const { report, check: c } = eng.daily(1, S);
  assert.equal(c.ok, true, '계약 검증에 걸렸습니다: ' + c.problems.join(' / '));
  const ids = report.slots.map(s => s.slotId);
  assert.equal(new Set(ids).size, ids.length, '계약에 같은 slotId 가 두 번 실렸습니다');
  assert.equal(ids.length, room.slots.length + 1, `슬롯 ${room.slots.length}칸 + 자유 1개가 아닙니다`);

  const mine = report.slots.find(s => s.slotId === 'free:pot_01');
  assert.ok(mine, '자유 좌표 화분이 계약에 없습니다');
  assert.equal(mine.plantId, 'monstera_deliciosa', '식물 정보가 안 실렸습니다');
  assert.deepEqual(mine.point, { x: 0, y: 1.2, z: -1.6 });
  assert.equal(mine.dli, eng.dliAt({ x: 0, y: 1.2, z: -1.6 }, SKY).dli,
    '계약의 DLI 와 미리보기 DLI 가 다릅니다');

  /* 주간 통계 경로도 자유 좌표를 따라가야 한다(loop.expectedWeekStats 가 이렇게 부른다) */
  const byPot = eng.dliOfSlot(S.pots[0], SKY);
  assert.equal(byPot, mine.dli, `dliOfSlot(화분) 이 ${byPot} — 계약과 다릅니다`);
});

/* ══ K · 어긋난 조합은 조용히 안 지나간다 ══════════════════════════════ */
check('K slotId 는 슬롯인데 좌표는 딴 데 — 던진다(계약이 두 자리를 같은 이름으로 부른다)', () => {
  const S = newState({ room: 'banjiha', mode: 'novice' });
  S.pots.push({
    id: 'pot_01', slotId: 'banjiha-sill:0', plantId: 'monstera_deliciosa',
    at: place.makeAt({ x: 0, y: 0, z: 1.0 })         // 창턱이라 말하고 바닥에 있다
  });
  assert.throws(() => eng.daily(1, S), /자리가 어긋납니다/, '어긋난 조합이 조용히 지나갔습니다');
});

/* ══ L · ★★ 가구를 옮기면 그 뒤 그늘의 DLI 가 바뀐다 ═══════════════════ */
check('L 가구를 옮기면 그 뒤 지점의 DLI 가 실제로 바뀐다 · 되돌리면 원래대로', () => {
  eng.setFurnitureOverrides({});
  const shaded = { x: 0, y: 0.5, z: -1.4 };            // 책상을 창 앞에 놓으면 그늘에 든다
  const control = { x: SILL.x, y: SILL.y, z: SILL.z }; // 책상보다 높다 — 안 바뀌어야 한다

  const before = eng.dliAt(shaded, SKY).dli;
  const cBefore = eng.dliAt(control, { ...SKY, occIdx: SILL.occIdx }).dli;
  assert.ok(before > 0.2, `옮기기 전 그늘 후보가 ${before} — 대조가 안 됩니다`);

  const occBefore = eng.room.built.occluders.length;
  const mv = eng.moveFurniture('banjiha-desk', { x: 0, z: -1.75, rot: 0 });
  assert.deepEqual(mv.from, { x: 1.3, z: -1.5, rot: 0 }, '원래 자리를 잘못 읽었습니다');
  assert.equal(eng.room.built.occluders.length, occBefore, '차폐체 개수가 달라졌습니다');
  /* 조립 결과가 갱신됐나 — 차폐체가 실제로 옮겨졌는지 본다 */
  assert.ok(eng.room.built.occluders.some(o => Math.abs(o.x - (0 - 1.2 / 2)) < 1e-6),
    '가구는 옮겼는데 차폐체(occluders)가 그대로입니다');
  /* 추천 자리도 같이 따라갔나 */
  const deskSlot = eng.room.slots.find(s => s.slotId === 'banjiha-desk:0');
  assert.ok(Math.abs(deskSlot.z - (-1.75)) < 0.4 && Math.abs(deskSlot.x) < 0.7,
    `추천 자리가 안 따라왔습니다 — banjiha-desk:0 이 (${deskSlot.x}, ${deskSlot.z})`);

  const after = eng.dliAt(shaded, SKY).dli;
  const cAfter = eng.dliAt(control, { ...SKY, occIdx: SILL.occIdx }).dli;
  assert.ok(after < before * 0.5,
    `그늘에 들었는데 DLI 가 ${before} → ${after} — 가구 그림자가 조도에 안 먹었습니다`);
  assert.equal(cAfter, cBefore, `상관없는 자리가 ${cBefore} → ${cAfter} 로 흔들렸습니다`);
  results.push(['INFO', `  책상을 창 앞으로: 그늘 ${before} → ${after} / 창턱 ${cBefore} 그대로`]);

  /* 되돌리기 — 덮어쓰기 표를 비우면 house_rooms.json 기본값으로 돌아온다 */
  eng.setFurnitureOverrides({});
  assert.equal(eng.dliAt(shaded, SKY).dli, before, '되돌렸는데 값이 안 돌아왔습니다');

  /* 모르는 uid·NaN 은 던진다 */
  assert.throws(() => eng.moveFurniture('없는가구', { x: 0, z: 0 }), /모르는 uid/);
  assert.throws(() => eng.moveFurniture('banjiha-desk', { x: NaN, z: 0 }), /유한한 숫자가 아닙니다/);
  assert.throws(() => eng.moveFurniture('banjiha-desk', { x: 9, z: 0 }), /방 밖/);
});

/* ══ M · 데이터 파일은 안 고친다 ═══════════════════════════════════════ */
check('M 가구를 옮겨도 data/house_rooms.json 은 한 바이트도 안 바뀐다', () => {
  eng.moveFurniture('banjiha-bed', { x: 0.5, z: 0.5, rot: 90 });
  assert.ok(fs.readFileSync(HOUSE_ROOMS_PATH).equals(HOUSE_ROOMS_BYTES),
    '★ data/house_rooms.json 이 바뀌었습니다 — 이 파일은 house 소유라 게임이 못 고칩니다');
  /* 덮어쓰기 표에만 쌓인다 */
  assert.deepEqual(eng.furnitureOverrides()['banjiha-bed'], { x: 0.5, z: 0.5, rot: 90 });

  /* 세이브 쪽 표도 같은 모양이다 */
  const S = newState({ room: 'banjiha' });
  assert.deepEqual(S.home.furniture, {}, '새 게임의 가구 표는 비어 있어야 합니다(=기본값)');
  setFurniturePlacement(S, 'banjiha-bed', { x: 0.5, z: 0.5, rot: 90 }, { size: room.size });
  assert.deepEqual(furnitureOverrides(S), { 'banjiha-bed': { x: 0.5, z: 0.5, rot: 90 } });
  assert.throws(() => setFurniturePlacement(S, 'banjiha-bed', { x: NaN, z: 0 }), /유한한 숫자/);
  assert.throws(() => setFurniturePlacement(S, '', { x: 0, z: 0 }), /uid/);

  /* 영속 산출물(방 프로파일)은 옮긴 상태 위에서 못 뽑는다 */
  assert.throws(() => eng.profile(), /가구가 옮겨진 상태/, '옮긴 방을 프로파일로 굳혔습니다');
  eng.setFurnitureOverrides({});
});

/* ══ N · 회수 규칙 ════════════════════════════════════════════════════ */
check('N rehomePot — 받치던 가구가 사라지면 회수 · 그 밖에는 자유 좌표를 안 건드린다', () => {
  const S = newState({ room: 'banjiha' });
  S.pots.push({ id: 'pot_01', slotId: null, plantId: 'monstera_deliciosa' });
  setPotAt(S, 'pot_01', { x: 0.5, y: 0.74, z: -1.5, onUid: 'banjiha-desk', occIdx: 2 },
           { size: room.size, slots: room.slots });
  assert.equal(pot0(S).slotId, 'free:pot_01');

  /* ① 가구가 그대로면 슬롯 목록과 무관하게 자리를 안 건드린다 */
  const logs = [];
  rehomePot(S, room.slots, m => logs.push(m), eng.room);
  assert.equal(pot0(S).slotId, 'free:pot_01', '멀쩡한 자유 좌표를 회수했습니다');
  assert.equal(logs.length, 0, `조용해야 하는데 로그가 났습니다: ${logs.join(' / ')}`);

  /* ② 받치던 가구가 사라지면 회수하고 로그를 남긴다(조용히 옮기지 않는다) */
  const gone = { ...eng.room, surfaces: new Set([...eng.room.surfaces].filter(u => u !== 'banjiha-desk')) };
  rehomePot(S, room.slots, m => logs.push(m), gone);
  assert.equal(pot0(S).slotId, room.slots[0].slotId, '가구가 사라졌는데 안 옮겼습니다');
  assert.ok(pot0(S).at && pot0(S).at.x === room.slots[0].x, '회수했는데 좌표를 안 세웠습니다');
  assert.equal(logs.length, 2, `로그가 ${logs.length}건`);

  /* ③ 방이 바뀌어 좌표가 방 밖이면 회수한다 */
  const S2 = newState({ room: 'banjiha' });
  S2.pots.push({ id: 'pot_01', slotId: 'free:pot_01',
                 at: place.makeAt({ x: 2.4, y: 0, z: 1.9 }) });
  rehomePot(S2, room.slots, null, { ...eng.room, size: { w: 2, d: 2, h: 2.3 } });
  assert.equal(pot0(S2).slotId, room.slots[0].slotId, '방 밖 좌표를 그대로 뒀습니다');

  /* ④ 좌표가 없는 옛 화분은 예전 규칙 그대로 — 슬롯이 있으면 그대로 둔다 */
  const S3 = newState({ room: 'banjiha' });
  S3.pots.push({ id: 'pot_01', slotId: 'banjiha-desk:1' });
  rehomePot(S3, room.slots, null, eng.room);
  assert.equal(pot0(S3).slotId, 'banjiha-desk:1');
  assert.ok(pot0(S3).at, '회수 때 옛 세이브 좌표 채우기가 안 돌았습니다');
});

/* ── 보고 ─────────────────────────────────────────────────────────────── */
let fail = 0;
for (const [st, name, msg] of results) {
  if (st === 'INFO') { console.log(name); continue; }
  if (st === 'FAIL') fail++;
  console.log(`${st}  ${name}${msg ? '\n      → ' + msg : ''}`);
}
console.log(fail ? `\nfree_place: FAIL (${fail}건)` : '\nfree_place: PASS');
process.exit(fail ? 1 : 0);
