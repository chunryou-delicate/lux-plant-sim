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

   ★ O~R 은 **콩나물 시루**다 (2026-08-03). 화분만 자유 배치면 "모든 식물"이 아니다.
     시루는 S.pots 가 아니라 S.firstPlay.beansprout 에 사는데, 자리 모양(at)·불변식·계약 열쇠는
     화분과 **같은 것 하나**를 쓴다. 여기서 보는 것은 그 '하나'가 정말 하나인지다.

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
  newState, givePlant, pot0, rehomePot, migratePots, setPotAt, setPotSlot, setCropAt,
  placedItems, setFurniturePlacement, furnitureOverrides
} = await import(toUrl('src/game/state.js'));
const {
  BEANSPROUT_ID, cropDliFromReport, firstPlayRulesFromBalance, placeBeansprout
} = await import(toUrl('src/game/first_play.js'));

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
  /* 창턱은 한 칸이다 — 큰 화분은 후보에서 빠져야 한다 */
  const big = place.nearestSlot({ x: SILL.x, y: SILL.y, z: SILL.z }, room.slots, { potD: 0.5 });
  assert.notEqual(big && big.slot.slotId, 'banjiha-sill:0', `0.5m 화분이 ${SILL.maxPotD} 자리에 붙었습니다`);
  assert.equal(place.slotHolds(SILL, 0.202), true);
  /* ⚠⚠ 2026-08-17 (G-14) — **창턱 한도가 0.21 → 0.27 이 됐다.**
     받침을 방 쪽으로 0.20m 밀면서 깊이를 0.24 → 0.30 으로 키운 몫이다
     (`data/house_rooms.json §banjiha-sill` · 박사님 "조금만 민다로 하자").
     ⇒ **열린 콩나물 시루(0.24)가 창턱에 올라간다** — 예전에는 못 올라갔다.
       늘어난 것이지 깨진 것은 아니지만 **뜻이 바뀐 줄**이라 갈라 적는다:
       창턱은 이 방에서 제일 밝은 자리고 콩나물은 어두울수록 좋은 작물이다.
       「제일 밝은 자리에 시루를 올릴 수 있다」가 새로 열린 손짓이다.
     ⚠ 되돌리고 싶으면 깊이만 0.24 로 되돌리면 된다 — **밝기는 z 가 정하므로
       3.68·6.02 는 한 톨도 안 바뀐다.** 그때 이 줄도 false 로 되돌려라.
     ★ 네모 화분(0.2755)은 여전히 못 올라간다 — `test_pots C-2` 가 그것을 잡고 있다. */
  assert.equal(place.slotHolds(SILL, 0.24), true, '창턱 한도가 0.27 인데 시루(0.24)가 안 올라갑니다');
  assert.equal(place.slotHolds(SILL, 0.2755), false, '네모 화분(0.2755)이 창턱에 올라갔습니다');
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

  /* ★★★ 2026-08-30 — **여기 있던 「좌표가 이미 있으면 좌표가 이긴다」를 고쳐 쓴다.**
     ══════════════════════════════════════════════════════════════════
     2026-08-17 에 규칙이 바뀌었다(`state.js §migratePots · resnap`). 박사님 폰에서
     옛 판이 안 열린 날이다 — 자리를 칸 한가운데로 옮겼더니 세이브의 옛 좌표와
     `slotId` 가 갈려 조도가 던졌고 게임이 통째로 멈췄다.
     ⇒ 새 규칙: **그 화분은 그 자리에 있었다.** 자리가 움직였으면 화분도 따라간다.
     ⚠ 그런데 이 자는 옛 규칙을 그대로 들고 있었고, 게다가 «어긋난» 조합
       (slotId 는 창턱인데 at 은 책상)을 만들어 놓고 「안 덮어써야 한다」고 우겼다.
       그 조합이 바로 2026-08-17 이 고치려던 그 병이다. **자가 병을 요구하고 있었다.**
     ⇒ 뜻을 둘로 갈라 다시 적는다:
       ① slotId 와 **맞는** 좌표는 안 건드린다 (같은 물건 그대로다)
       ② slotId 와 **어긋난** 좌표는 slotId 쪽으로 따라가고, 조용히 하지 않는다 */
  const same = place.makeAt({ x: SILL.x, y: SILL.y, z: SILL.z,
                              onUid: 'banjiha-sill', occIdx: SILL.occIdx });
  S.pots[0].at = same;
  migratePots(S, room.slots);
  assert.equal(S.pots[0].at, same, '자리와 맞는 좌표를 괜히 갈아 끼웠습니다');

  const off = place.makeAt({ x: 1.0, y: 0.74, z: -1.4, onUid: 'banjiha-desk', occIdx: 2 });
  S.pots[0].at = off;
  const rOff = migratePots(S, room.slots);
  assert.notEqual(S.pots[0].at, off, '어긋난 좌표를 그대로 뒀습니다 — 옛 세이브가 안 열립니다');
  assert.deepEqual({ x: S.pots[0].at.x, y: S.pots[0].at.y, z: S.pots[0].at.z },
    { x: SILL.x, y: SILL.y, z: SILL.z }, '따라간 곳이 그 자리가 아닙니다');
  assert.equal((rOff.resnapped || []).length, 1, '옮겨 놓고 기록에 안 남겼습니다');

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
  /* ★★ 2026-08-30 — **원래 자리를 여기 «적지» 않는다. 방 데이터에 «묻는다».**
     여기 `{ x: 1.3, z: -1.5 }` 라고 적혀 있었는데, 2026-08-17 에 박사님이
     *"책상이 2*6 차지하는데 칸수는 2*5네"* 하셔서 책상이 **x 1.375 로 옮겨졌다**
     (`data/house_rooms.json §banjiha-desk`). 그날부터 이 자가 떨어져 있었다.
     ⚠ 재는 뜻은 「옮기기가 «옮기기 전» 자리를 옳게 돌려주나」다 — 그 값이 얼마인지가 아니다.
       ⇒ 값을 베끼면 데이터가 움직일 때마다 자가 거짓으로 떨어진다. **묻는다.** */
  const deskWas = (eng.room.def.furniture || []).find(f => f && f.uid === 'banjiha-desk');
  assert.ok(deskWas, '방 데이터에 banjiha-desk 가 없습니다 — 방이 바뀌었습니다');
  const mv = eng.moveFurniture('banjiha-desk', { x: 0, z: -1.75, rot: 0 });
  assert.deepEqual(mv.from, { x: deskWas.x, z: deskWas.z, rot: deskWas.rot || 0 },
    '원래 자리를 잘못 읽었습니다');
  assert.equal(eng.room.built.occluders.length, occBefore, '차폐체 개수가 달라졌습니다');
  /* 조립 결과가 갱신됐나 — 차폐체가 실제로 옮겨졌는지 본다.
     ★ 2026-08-30 — 여기도 폭을 `1.2` 로 «적어» 놓고 있었다. 책상 폭은 1.25 다.
       차폐체는 왼쪽 앞 귀를 적으므로(`house.js §occluders.push`: x = 가운데 − 폭/2)
       ⇒ **가운데를 되짚어** 본다. 폭이 얼마든 「옮긴 자리에 와 있나」는 그대로 잰다. */
  assert.ok(eng.room.built.occluders.some(o =>
      o.src === 'furniture' && Math.abs((o.x + (o.w || 0) / 2) - 0) < 1e-6
                            && Math.abs((o.z + (o.d || 0) / 2) - (-1.75)) < 1e-6),
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

/* ══════════════════════════════════════════════════════════════════════
   ★ 콩나물 시루 — 화분과 **같은 자리 모양**을 쓴다 (2026-08-03)
   ══════════════════════════════════════════════════════════════════════ */
const FP_RULES = firstPlayRulesFromBalance(dataOf('balance/characters.json'));
const newFP = () => newState({ room: 'banjiha', mode: 'novice',
                               firstPlay: true, firstPlayRules: FP_RULES });

/* ══ O · 자유 좌표 시루가 계약에 실리고 cropDliFromReport 가 찾는다 ═══════ */
check('O 자유 좌표 콩나물 — 그 자리 DLI 가 계약에 실리고 cropDliFromReport 가 찾는다', () => {
  const S = newFP();
  const spot = { x: -1.2, y: 0.9, z: -1.0 };          // 어느 추천 자리에도 안 붙는 점

  const r = setCropAt(S, spot, { size: eng.room.size, slots: eng.room.slots, snapDist: 0.15 });
  /* ★★ 2026-08-09 — 계약 열쇠가 **자리 이름에서 시루 이름으로** 내려왔다
     (first_play §자리는 시루마다 따로다). 자리 id 하나(`crop_01`)를 시루 열둘이 나눠 쓰면
     자유 열쇠가 `free:crop_01` 로 겹쳐 `light_adapter.slotsFor` 의 Map 에서 뒤엣것이
     앞엣것을 덮는다 — 그러면 시루마다 다른 자리의 DLI 를 못 찾는다.
     ⚠ 옛 세이브의 `free:crop_01` 은 그대로 산다(시루의 slotId 로 옮겨지고 그대로 쓰인다). */
  const CROP_KEY = `free:${S.firstPlay.beansprout.pots[0].id}`;
  assert.equal(r.slotId, CROP_KEY, `자유 좌표인데 slotId 가 ${r.slotId}`);
  assert.equal(S.firstPlay.beansprout.slotId, r.slotId, 'slotId 를 상태에 안 적었습니다');
  assert.deepEqual({ x: S.firstPlay.beansprout.at.x, y: S.firstPlay.beansprout.at.y,
                     z: S.firstPlay.beansprout.at.z }, spot, '좌표 정본이 안 세워졌습니다');
  assert.equal(S.firstPlay.phase, 'grow_beansprout', '자리를 정했는데 단계가 안 넘어갔습니다');

  const { report, check: c } = eng.daily(1, S);
  assert.equal(c.ok, true, '계약 검증에 걸렸습니다: ' + c.problems.join(' / '));

  const row = report.slots.find(s => s.slotId === r.slotId);
  assert.ok(row, '★ 자유 좌표 시루가 오늘 계약에 없습니다 — cropDliFromReport 가 못 찾습니다');
  assert.deepEqual(row.point, spot);
  /* 시루는 '자리'일 뿐이다 — 식물 id 를 지어내면 그 자리 밴드가 몬스테라 기준으로 나온다 */
  assert.equal(row.plantId, null, `시루 자리에 plantId 가 ${row.plantId} 로 실렸습니다`);

  const dli = cropDliFromReport(report, S.firstPlay.beansprout.slotId);
  assert.equal(dli, row.dli);
  assert.equal(dli, eng.dliAt(spot, SKY).dli, '계약의 DLI 와 미리보기 DLI 가 다릅니다');
  /* 상태 객체를 그대로 넘겨도 같은 답이어야 한다(호출부가 둘 중 아무거나 쓴다) */
  assert.equal(cropDliFromReport(report, S.firstPlay.beansprout), dli);

  /* 자유 좌표인데 계약에 안 실린 경우를 0(=암흑)으로 메꾸지 않는다 */
  assert.throws(() => cropDliFromReport({ slots: [] }, r.slotId), /계약에 없습니다/);

  /* 추천 자리 쪽으로 끌면 안정 slotId 를 되찾는다 — 화분(G)과 같은 규칙이다 */
  const back = setCropAt(S, { x: SILL.x + 0.04, y: SILL.y, z: SILL.z },
                         { size: eng.room.size, slots: eng.room.slots, snapDist: 0.15 });
  assert.equal(back.slotId, 'banjiha-sill:0', `붙었는데 slotId 가 ${back.slotId}`);
  assert.deepEqual({ x: back.at.x, y: back.at.y, z: back.at.z },
                   { x: SILL.x, y: SILL.y, z: SILL.z }, '붙었는데 좌표가 슬롯과 다릅니다');
  assert.equal(back.at.occIdx, SILL.occIdx, '자가차폐 번호를 안 가져왔습니다');

  /* 방 밖·NaN 은 시루에서도 못 넣는다 */
  assert.throws(() => setCropAt(S, { x: 99, y: 0, z: 0 }, { size: eng.room.size }), /방 밖/);
  assert.throws(() => setCropAt(S, { x: 0, y: NaN, z: 0 }), /NaN/);
  assert.throws(() => placeBeansprout(S.firstPlay, ''), /자리를 골라/);
});

/* ══ P · ★★ 시루도 물리는 하나다 ═══════════════════════════════════════ */
check('P 같은 좌표면 슬롯 경로와 자유 좌표 경로의 콩나물 DLI 가 같다', () => {
  const seen = [];
  for (const s of eng.room.slots) {
    /* ① 슬롯 경로 — 옛 호출부 그대로(이름 하나) */
    const S1 = newFP();
    placeBeansprout(S1.firstPlay, s.slotId, { slots: eng.room.slots });
    assert.equal(S1.firstPlay.beansprout.slotId, s.slotId);
    const bySlot = cropDliFromReport(eng.daily(1, S1).report, S1.firstPlay.beansprout.slotId);

    /* ② 자유 좌표 경로 — **같은 점**인데 계약 열쇠가 다르다(slots 를 안 주니 안 붙는다) */
    const S2 = newFP();
    const free = setCropAt(S2, { x: s.x, y: s.y, z: s.z,
                                 onUid: String(s.slotId).slice(0, String(s.slotId).lastIndexOf(':')),
                                 occIdx: Number.isInteger(s.occIdx) ? s.occIdx : null },
                           { size: eng.room.size });
    /* ★ 열쇠는 **시루 id** 다 (2026-08-09 · 위 O 의 그 이유) */
    assert.equal(free.slotId, `free:${S2.firstPlay.beansprout.pots[0].id}`,
                 '슬롯 목록을 안 줬는데 붙었습니다');
    const byPoint = cropDliFromReport(eng.daily(1, S2).report, free.slotId);

    assert.equal(byPoint, bySlot,
      `${s.slotId}: 슬롯 경로 ${bySlot} vs 자유 좌표 경로 ${byPoint} — 시루 물리가 둘로 갈렸습니다`);
    seen.push(bySlot);
  }
  results.push(['INFO', `  시루 ${seen.length}칸 전부 두 경로가 같은 값 ` +
                        `(창턱 ${Math.max(...seen)})`]);
});

/* ══ Q · 옛 세이브(slotId 만)의 시루가 좌표로 마이그레이션된다 ══════════ */
check('Q 옛 세이브 — 시루도 그 슬롯 좌표가 채워진다(slotId 는 안 버린다)', () => {
  const S = newFP();
  /* 2026-08-03 이전 세이브 모양: beansprout 에 at 칸 자체가 없다 */
  delete S.firstPlay.beansprout.at;
  S.firstPlay.beansprout.slotId = 'banjiha-desk:1';
  /* ★★ 2026-08-09 — 진행의 **정본이 시루로 내려왔다**(first_play §대표 칸).
     `beansprout.ageDays` 는 이제 `syncCropLead` 가 pots 에서 다시 세우는 사본이라,
     사본에만 적으면 마이그레이션 뒤에 정본 값(0)으로 되돌아간다. 정본에 적는다. */
  for (const p of S.firstPlay.beansprout.pots) { p.ageDays = 2; p.dliHist = [0.2, 0.2]; }
  S.firstPlay.beansprout.ageDays = 2;
  S.firstPlay.beansprout.dliHist = [0.2, 0.2];

  const r = migratePots(S, eng.room.slots);
  const desk = eng.room.slots.find(x => x.slotId === 'banjiha-desk:1');
  const at = S.firstPlay.beansprout.at;
  assert.ok(at, '★ 시루 좌표를 안 채웠습니다 — 화분만 챙기고 있습니다');
  assert.deepEqual({ x: at.x, y: at.y, z: at.z }, { x: desk.x, y: desk.y, z: desk.z });
  assert.equal(at.onUid, 'banjiha-desk');
  assert.equal(at.occIdx, desk.occIdx, '자가차폐 번호가 빠졌습니다');
  assert.equal(S.firstPlay.beansprout.slotId, 'banjiha-desk:1', 'slotId 를 버렸습니다(하위호환 파손)');
  /* ★★ 2026-08-09 — 채운 목록의 이름이 **시루 id** 다(자리 하나가 아니라 시루마다 채운다).
     자리 사본에만 자리가 적혀 있는 옛 모양은 `adoptCropSpotToPots` 가 시루로 내려 준 뒤 채운다. */
  assert.ok(r.filled.some(f => String(f.id).startsWith(BEANSPROUT_ID)),
    `채운 목록에 시루가 없습니다: ` + JSON.stringify(r.filled));
  assert.ok(S.firstPlay.beansprout.pots.every(p => p.at && p.slotId === 'banjiha-desk:1'),
    '★시루마다의 자리가 안 채워졌습니다 — 정본은 pots 입니다');
  assert.equal(S.firstPlay.beansprout.ageDays, 2, '마이그레이션이 자란 날을 건드렸습니다');

  /* 마이그레이션 뒤에도 계약이 그 자리를 한 이름으로만 부른다 */
  const { report } = eng.daily(1, S);
  const ids = report.slots.map(x => x.slotId);
  assert.equal(new Set(ids).size, ids.length, '계약에 같은 slotId 가 두 번 실렸습니다');
  assert.equal(ids.length, eng.room.slots.length, '슬롯 위 시루가 자리를 하나 더 만들었습니다');
  assert.equal(cropDliFromReport(report, 'banjiha-desk:1'), eng.dliOfSlot('banjiha-desk:1', SKY));

  /* 아직 안 놓은 시루는 '빠뜨린 것'이 아니다 — 건너뛴 사유 목록에도 안 들어간다 */
  const S2 = newFP();
  const r2 = migratePots(S2, eng.room.slots);
  assert.deepEqual([r2.filled.length, r2.skipped.length], [0, 0],
    '자리를 안 정한 시루가 마이그레이션 목록에 올랐습니다');

  /* 좌표가 이미 있으면 좌표가 이긴다 */
  const S3 = newFP();
  setCropAt(S3, { x: 0.2, y: 0.3, z: 0.4 }, { size: eng.room.size });
  const keep = S3.firstPlay.beansprout.at;
  migratePots(S3, eng.room.slots);
  assert.equal(S3.firstPlay.beansprout.at, keep, '있는 좌표를 덮어썼습니다');
});

/* ══ R · 화분과 시루가 계약에 각각 한 번씩만 실린다 ═════════════════════ */
check('R 화분·시루가 계약에 각각 한 번씩만 실린다', () => {
  const S = newFP();
  S.pots.push({ id: 'pot_01', slotId: null, plantId: 'monstera_deliciosa', variegated: false });
  setPotAt(S, 'pot_01', { x: 0, y: 1.2, z: -1.6 }, { size: eng.room.size, slots: eng.room.slots });
  setCropAt(S, { x: -1.0, y: 0.4, z: -1.0 }, { size: eng.room.size });

  assert.equal(placedItems(S).length, 2, `놓인 것이 ${placedItems(S).length}개 — 화분+시루 2개여야 합니다`);

  const { report, check: c } = eng.daily(1, S);
  assert.equal(c.ok, true, '계약 검증에 걸렸습니다: ' + c.problems.join(' / '));
  const ids = report.slots.map(s => s.slotId);
  assert.equal(new Set(ids).size, ids.length, '★ 계약에 같은 slotId 가 두 번 실렸습니다');
  assert.equal(ids.length, eng.room.slots.length + 2,
    `슬롯 ${eng.room.slots.length}칸 + 자유 2개가 아닙니다 (${ids.length}칸)`);
  assert.equal(ids.filter(i => i === 'free:pot_01').length, 1);
  /* ★ 열쇠는 **시루 id** 다 (2026-08-09 · 위 O 의 그 이유) */
  const CROP_KEY = `free:${S.firstPlay.beansprout.pots[0].id}`;
  assert.equal(ids.filter(i => i === CROP_KEY).length, 1);
  /* 둘이 서로의 값을 먹지 않는다 */
  assert.equal(cropDliFromReport(report, CROP_KEY),
               eng.dliAt({ x: -1.0, y: 0.4, z: -1.0 }, SKY).dli);
  assert.equal(report.slots.find(s => s.slotId === 'free:pot_01').dli,
               eng.dliAt({ x: 0, y: 1.2, z: -1.6 }, SKY).dli);

  /* 시루를 추천 자리로 되돌리면 자유 칸이 하나 줄어든다 — 빈 슬롯과 겹쳐 실리지 않는다 */
  placeBeansprout(S.firstPlay, 'banjiha-desk:1', { slots: eng.room.slots });
  const ids2 = eng.daily(2, S).report.slots.map(s => s.slotId);
  assert.equal(new Set(ids2).size, ids2.length, '슬롯으로 되돌렸더니 같은 자리가 두 번 실렸습니다');
  assert.equal(ids2.length, eng.room.slots.length + 1,
    `슬롯 ${eng.room.slots.length}칸 + 자유 화분 1개가 아닙니다 (${ids2.length}칸)`);

  /* ★ 어긋난 조합은 시루에서도 조용히 안 지나간다(K 와 같은 사상).
     ★★ 2026-08-09 — 망가뜨리는 칸이 **시루 쪽**이다. 자리 사본(`beansprout.slotId`)은
       이제 대표 시루를 비추는 읽기용이라, 거기만 어긋내면 계약이 시루를 보고 그냥 지나간다. */
  S.firstPlay.beansprout.pots[0].slotId = 'banjiha-sill:0';  // 창턱이라 말하고 책상에 있다
  S.firstPlay.beansprout.slotId = 'banjiha-sill:0';
  assert.throws(() => eng.daily(3, S), /자리가 어긋납니다/,
    '어긋난 시루 조합이 조용히 지나갔습니다');

  /* 첫 플레이가 꺼져 있으면 시루는 아예 안 실린다(빈 게임에 유령 자리가 안 생긴다) */
  const plain = newState({ room: 'banjiha', mode: 'novice' });
  assert.equal(placedItems(plain).length, 0);
  assert.equal(eng.daily(1, plain).report.slots.length, eng.room.slots.length);
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
