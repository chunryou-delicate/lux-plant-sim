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
     ⑥ 회귀     **반지하 15칸이 한 톨도 안 바뀐다** — 아래 표와 정확히 같다(허용 오차 없음)

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
/* ★ 2026-10-08 — 원룸은 빈 방이다. 가구는 사람이 가방에서 꺼내 놓는다. 그래서 이 검사는
   **기준 배치**(`rooms.oneroom.reference_layout` · D5 = D 에타제르 창 앞)를 «얹은 사본» 위에서 잰다 —
   프로필(tools/gen_room_profile.mjs)과 «같은 판»이다. 방 정의 furniture 는 안 고친다(가방 uid 와 두 벌). */
const withReferenceLayout = (hr) => {
  const out = JSON.parse(JSON.stringify(hr));
  for (const r of Object.values(out.rooms || {}))
    if (r && r.reference_layout && Array.isArray(r.reference_layout.furniture))
      r.furniture = [...(r.furniture || []), ...r.reference_layout.furniture];
  return out;
};
const REF = HOUSE.rooms.oneroom.reference_layout;
function makeEngine() {
  return createLightEngine({
    houseRooms: withReferenceLayout(HOUSE),
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
/* ★ 2026-10-08 — real(여름) 7일평균 = **자연광 peak × E + 등 DLI** (D7 · 등에는 날씨 계수를 «안» 곱한다).
   자리마다 자연광과 등을 «나눠» 받는다(light_adapter §dliAt). 같은 자리의 합이 dliOfSlot 과 같은지도 잰다. */
function realOf(roomId, lamps) {
  const room = eng.build(roomId);
  const out = new Map(); let worstGap = 0;
  for (const s of room.slots) {
    const row = lamps.map(n => {
      eng.clearCache();
      const o = eng.dliAt({ x: s.x, y: s.y, z: s.z }, { ...SKY, lampCount: n, occIdx: s.occIdx });
      eng.clearCache();
      const tot = eng.dliOfSlot(s.slotId, { ...SKY, lampCount: n });
      worstGap = Math.max(worstGap, Math.abs(((o.dli_daylight ?? 0) + (o.dli_lamp ?? 0)) - tot));
      return +(((o.dli_daylight ?? 0) * E) + (o.dli_lamp ?? 0)).toFixed(2);
    });
    out.set(s.slotId, row);
  }
  return { room, out, worstGap };
}
const maxReal = (t, i) => Math.max(...[...t.values()].map(v => v[i]));
const countRealOver = (t, i, th) => [...t.values()].filter(v => v[i] >= th).length;
/* ⛔⛔ 2026-08-30 — **이 줄이 «등을 켠 칸»에서 틀린다.** (★ 2026-10-08 고침 — 아래 끝 문단)
   ------------------------------------------------------------
   `src/engine/weather.js §weekStats` 가 «이미» 경고해 두었다:
     *"mean 은 해석적 기댓값이라 dliOf 가 '날씨 계수에 선형'일 때만 맞다.
       자연광만이면 정확하지만 «식물등을 섞으면 틀린다» — 등 DLI 는 날씨와 무관한데
       맑음 값에 E 를 곱해 버린다."*
   ⇒ ★ 맞는 셈은 **`자연광 peak × E + 등 DLI`** 다. 등에는 E 를 «안» 곱한다.

   [잰 것 · 맑음·여름·12시간]
     자리·등수        검사 avg7   맞는 avg7    차
     반지하 sill 등1     3.87       4.71     +0.84
     반지하 sill 등3     3.97       4.86     +0.89
     원룸  sill 등1     6.87       8.29     +1.42
     ★원룸 sill 등2     7.15      ★8.72     +1.57   ⇐ ★★ 무늬 갈라짐 «8.4 를 넘는다»
   ⇒ ⇒ ★★★ 그러면 ⑤의 *"무늬종 갈라짐은 못 넘는다 → 온실 몫이 남는다"* 가
     **이미 깨져 있다.** 검사가 «못 봐서» 초록일 뿐이다.

   ★★ 2026-10-08 — **결정이 났다**(D7 · 총괄 · 박사님 위임 · master-campaign-20261007 §3):
     「원룸 검사는 real 이 주, novice(맑음·여름 peak)는 참고」. ⇒ 원룸 판정(④⑤)은 위 `realOf`
     (자연광 × E + 등)로 옮겼다. 환산·모드·⑤의 식을 «한 번에» 고쳤다(house-night-20260906 §② ㉠).
   ⚠ 아래 `avg7`(peak×E)은 ⑥ 반지하 정보 줄과 «novice 참고» 표에만 남는다 — 등을 켠 칸에선 낮게 나온다. */
const avg7 = (peak) => +(peak * E).toFixed(2);
const maxOf = (t, i) => Math.max(...[...t.values()].map(v => v[i]));
const countAvg7Over = (t, i, th) => [...t.values()].filter(v => avg7(v[i]) >= th).length;

const results = [];
const check = (name, fn) => { try { fn(); results.push(['PASS', name]); }
                              catch (e) { results.push(['FAIL', name, e.message]); } };
const info = (s) => results.push(['INFO', '  ' + s]);

/* ══ ⑥ 회귀 — 반지하 15칸이 한 톨도 안 바뀐다 ════════════════════════════
   ★ 이게 이 작업의 절반이다. 이 창은 house_rooms.json 의 `oneroom` 절과
     furniture_presets.json 의 **새 프리셋 하나**만 건드렸으므로 반지하는
     구조상 안 바뀌어야 한다. "안 바뀌어야 한다"를 믿지 않고 잰다.
   ⚠ 값은 2026-08-06 main(729109c, 등 옮기기까지) 에서 뜬 것이다. tools/test_lampaim.mjs
     ①(안 겨눈 등 회귀)과 같은 판을 다른 각도에서 한 번 더 잠근다. */
/* ★★ 2026-08-23 다시 얼렸다 — **말없이 갱신하지 않는다.**
   ------------------------------------------------------------
   ⚠ [Plan]: ***"기준선을 말없이 갱신하는 것은 검사를 끄는 것과 같다."***
   값은 손으로 안 적었다: `BYEOT_REGEN=1 node tools/test_oneroom_room.mjs`.
   ⚠ 침대 줄(null)은 규약대로 되살려 두었다 — 그건 「없어야 한다」를 재는 줄이다.

   왜 움직였나 — 셋 다 **다른 데서 한 일**이다.
   ① `23521a1` 반지하에 **협탁**이 들어와 14 → **15칸**이 되었다. 이 검사는 「14칸」을
      숫자로 못박고 있어서, 자리가 는 순간부터 **표를 보기도 전에** 떨어졌다.
   ② `d0bc365` 반지하 **셋째 등**(거치형). 기구 수 못박음도 2 → **3** 이다.
      ⚠ 표의 칸은 여전히 [등0, 등1, 등2] 다 — `tableOf('banjiha',[0,1,2])` 가 그렇게 부른다.
        곧 **기구가 셋인데 둘까지만 켜 본다.** 셋째 등을 켠 값은 `test_floorlight` §① 의
        둘째 칸(「등 전부」)이 잰다. 두 표가 다른 것을 재고 있다는 뜻이니 헷갈리지 마라.
   ③ 2026-08-23 자리를 **칸 한가운데**로 옮겼다(`furniture_pastel §tierSlots` — 협탁 자리가
      칸 경계에 앉아 겨눠도 안 붙었다). nightstand:0 이 그때 움직였다.
      ★ 자리 **수는 안 늘렸다** — 여섯 방 325칸 그대로, 자연광 최고 여섯 개 다 그대로.

   옛 값(2026-08-06 main): sill [4.80,5.15,5.19] · desk:0 [0.61,1.10,1.86] · desk:1 [0.17,0.32,1.32] ·
     dresser:0 [0.08,0.14,0.19] · dresser:1 [0.05,0.10,0.13] ·
     etagere:6~8 [0.51,5.98,6.06]/[0.48,12.31,12.41]/[0.48,5.95,6.10] */
const BANJIHA_FROZEN = {
  /* slotId                [등0,   등1,   등2  ] */
  'banjiha-sill:0':        [ 3.68,  6.02,  6.06],
  'banjiha-bed:0':         null,   // 침대는 슬롯을 안 낸다 — 아래에서 "없어야 한다"로 쓴다
  'banjiha-desk:0':        [ 0.56,  0.83,  1.77],
  'banjiha-desk:1':        [ 0.16,  0.29,  1.11],
  'banjiha-dresser:0':     [ 0.06,  0.11,  0.16],
  'banjiha-dresser:1':     [ 0.04,  0.08,  0.11],
  'banjiha-etagere:0':     [ 0.13,  0.30,  0.37],
  'banjiha-etagere:1':     [ 0.14,  0.32,  0.40],
  'banjiha-etagere:2':     [ 0.13,  0.31,  0.42],
  'banjiha-etagere:3':     [ 0.22,  0.46,  0.54],
  'banjiha-etagere:4':     [ 0.22,  0.48,  0.58],
  'banjiha-etagere:5':     [ 0.21,  0.49,  0.61],
  'banjiha-etagere:6':     [ 0.51,  0.87,  0.95],
  'banjiha-etagere:7':     [ 0.48,  0.89,  1.00],
  'banjiha-etagere:8':     [ 0.48,  0.92,  1.06],
  'banjiha-nightstand:0':  [ 0.44,  0.70,  0.95]
};

const BJ = tableOf('banjiha', [0, 1, 2]);

/* 새 값을 뽑을 때 쓴다: BYEOT_REGEN=1 node tools/test_oneroom_room.mjs
   ⚠ 손으로 적지 마라. 침대 줄(null)은 그대로 두고 나온 줄만 갈아 끼워라. */
if (process.env.BYEOT_REGEN) {
  for (const [id, v] of BJ.out)
    console.log(`  '${id}':${' '.repeat(Math.max(0, 22 - id.length))}` +
                `[${v.map(x => x.toFixed(2).padStart(5)).join(', ')}],`);
  process.exit(0);
}

check('⑥ 회귀 — 반지하 15칸 DLI 가 정확히 같다 (반올림 허용치 없음)', () => {
  assert.equal(BJ.room.slots.length, 15, `반지하 슬롯 수가 15 가 아닙니다 (${BJ.room.slots.length})`);   // 23521a1 협탁
  assert.equal(BJ.room.growRigs.length, 3, '반지하 식물등 기구가 3개가 아닙니다');   // d0bc365 거치등
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
/* 원룸은 «등 자리 수만큼» 켜 본다(D6-가 · 반지하와 같은 셋). 판정 표는 real(ORR), peak(OR)는 참고 */
const OR_LAMPS = Array.from({ length: (eng.build('oneroom').growRigs || []).length + 1 }, (_, i) => i);
const OR = tableOf('oneroom', OR_LAMPS);
const ORR = realOf('oneroom', OR_LAMPS);
const BJ_LAMPS = Array.from({ length: (eng.build('banjiha').growRigs || []).length + 1 }, (_, i) => i);
const BJR = realOf('banjiha', BJ_LAMPS);
eng.build('oneroom');
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
  eng.build('banjiha');
  const pb = eng.profile(BJ_LAMPS);
  const p = eng.build('oneroom') && eng.profile(OR_LAMPS);
  assert.equal(p.room, 'oneroom');
  assert.equal(p.uidStable, true);
  /* 자리 수는 «기준 배치»가 정한다 — 창턱 4 + 에타제르 9 + 책상 2 + 협탁 1 + 서랍장 2 = 18 (D) */
  assert.equal(p.slots.length, OR.room.slots.length);
  assert.equal(REF && REF.id, 'D', '★ 원룸 기준 배치가 D 가 아닙니다 (D5)');
  assert.equal(p.slots.length, 18, `★ 기준 배치 D 의 자리가 18 이 아닙니다 (${p.slots.length})`);
  /* 등 수·와트는 «반지하와 같다» — 산 등이 이사를 따라오므로(③). 숫자를 박지 않고 반지하 것과 견준다 */
  assert.deepEqual(p.lampCounts, pb.lampCounts, `★ 등 수가 반지하와 다릅니다 — 원룸 [${p.lampCounts}] · 반지하 [${pb.lampCounts}]`);
  assert.deepEqual(p.lampWatts, pb.lampWatts, `★ 등 와트가 반지하와 다릅니다 — 원룸 [${p.lampWatts}] · 반지하 [${pb.lampWatts}]`);
  info(`원룸 프로파일 뽑힘 — 기준 배치 ${REF.id} · 슬롯 ${p.slots.length}칸 · 등 ${p.lampCounts.join('/')}개 · ` +
       `${p.lampWatts.join('/')}W (반지하와 같다)`);
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
/* ★ 2026-10-08 D6-가 — 「2개」는 셋째 등(거치형 · 2026-08-17 d0bc365) «전»에 쓴 글자였다. 반지하가 셋이면
   원룸이 둘일 때 셋째 등을 산 사람이 이사에서 등 하나를 «조용히» 잃는다. ⇒ 수와 차례를 «반지하에서» 읽는다.
   ⚠ 원룸을 비운 뒤(08-30) 등 자리가 0 이라 이 칸이 붉었다 — 걸어서 잰 까닭은 house_rooms §oneroom-growlight-bar note. */
check('③ 등 — 원룸에도 반지하와 **같은 종류가 같은 순서로 같은 수** 있다', () => {
  eng.build('banjiha');
  const bjOrder = eng.lampList().map(l => l.preset);
  eng.build('oneroom');
  assert.equal(eng.growLampCount(), bjOrder.length,
    `★ 원룸 식물등 기구가 ${eng.growLampCount()}개 — 반지하(${bjOrder.length})와 다릅니다. 반지하에서 산 등이 이사에서 사라집니다`);
  const orOrder = eng.lampList().map(l => l.preset);
  /* ★ 순서까지 같아야 한다 — light_adapter.rigsOn 이 **앞에서부터** 켠다.
     순서가 다르면 반지하에서 바(180)를 사고 원룸에서 집게(120)가 켜지는 조용한 강등이 된다. */
  assert.deepEqual(orOrder, bjOrder,
    `★ 등 종류·순서가 반지하와 다릅니다 — 반지하 [${bjOrder}] · 원룸 [${orOrder}]`);
  assert.deepEqual(orOrder.slice(0, 2), ['growlight_bar', 'growlight_clip']);
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

  const NR = eng.growLampCount();
  S.tutorial.lamp.owned = 0;
  const g0 = lightGateOf(S, { light: eng }, { season: 'summer', lampCount: 0 });
  assert.equal(g0.growRigs, NR);
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
  assert.equal(gv.canTurnOn, NR);
  assert.match(gv.why, new RegExp(`${NR}개 더 켤 수 있습니다`));
});

/* ══ ④ 갈라짐 문턱 ═══════════════════════════════════════════════════════ */
check('④ 문턱 — 자연광만으로는 못 넘고, 등 1개로 넘는다', () => {
  const S = newState({ room: 'oneroom', mode: 'real' });
  S.pots.push({ id: 'pot_01', plantId: 'monstera_deliciosa', slotId: null, at: null, variegated: false });
  eng.build('oneroom');

  const g0 = lightGateOf(S, { light: eng }, { season: 'summer', lampCount: 0 });
  assert.equal(g0.fenestrate, FEN, '갈라짐 문턱이 light_thresholds.json 값이 아닙니다');
  const g1 = lightGateOf(S, { light: eng }, { season: 'summer', lampCount: 1 });
  const g2 = lightGateOf(S, { light: eng }, { season: 'summer', lampCount: 2 });

  /* ★ 2026-10-08 D7 — 판정은 real(자연광×E + 등). 게임 화면의 판정(lightGateOf)이 real 과 같은 답을 내는지는
     ④-2 가 따로 본다(⚠ 그 안의 셈이 아직 peak×E — core 에 고침을 부탁했다). 여기는 «방이 그렇게 생겼나»만 잰다. */
  assert.ok(maxReal(ORR.out, 0) >= g0.min, `★ real 원룸 자연광이 min ${g0.min} 도 못 넘습니다 (${maxReal(ORR.out, 0)})`);
  assert.ok(maxReal(ORR.out, 0) < FEN, `★ real 자연광만으로 갈라집니다 (${maxReal(ORR.out, 0)}) — 등을 산 뜻이 없습니다`);
  assert.ok(maxReal(ORR.out, 1) >= FEN, `★ real 등 1개로 갈라짐 ${FEN} 을 못 넘습니다 (${maxReal(ORR.out, 1)})`);
  /* 반지하보다 **넓다** — 최고값이 아니라 칸 수로 잰다(⑤ 가 최고값을 잠근다) */
  assert.ok(countRealOver(ORR.out, 2, FEN) >= 2,
    `★ 등 둘을 켜도 갈라지는 칸이 ${countRealOver(ORR.out, 2, FEN)}개뿐입니다 — 반지하보다 넓어야 합니다`);
  assert.ok(countRealOver(ORR.out, 0, g0.min) > countRealOver(BJR.out, 0, g0.min),
    '★ 자연광만으로 자랄 수 있는 칸이 반지하보다 안 많습니다');

  info(`[real 여름 avg7] 원룸 갈라짐(문턱 ${FEN}) — 등0 ${maxReal(ORR.out, 0)} 불가 · ` +
       OR_LAMPS.slice(1).map(n => `등${n} ${maxReal(ORR.out, n)}`).join(' · '));
  info(`  문턱 넘는 칸 수 — ` + OR_LAMPS.map(n => `등${n} ${countRealOver(ORR.out, n, FEN)}`).join(' · ') + `칸 ` +
       `(반지하 ` + BJ_LAMPS.slice(1).map(n => `등${n} ${countRealOver(BJR.out, n, FEN)}`).join(' · ') + `칸)`);
  info(`  자랄 수 있는 칸(min ${g0.min}) — 원룸 등0 ${countRealOver(ORR.out, 0, g0.min)}칸 · ` +
       `반지하 등0 ${countRealOver(BJR.out, 0, g0.min)}칸`);
  info(`[novice 참고 · 게임 판정 lightGateOf(peak×E)] 등0 ${g0.best.avg7} · 등1 ${g1.best.avg7}(${g1.best.slotId}) · 등2 ${g2.best.avg7}`);
  info(`  자연광+등 나눠 받은 합 ≒ dliOfSlot — 최대 차 ${ORR.worstGap.toExponential(2)} (0 이면 같은 자)`);
});

/* ④-2 게임 화면이 같은 답을 내나 — lightGateOf(core · oneroom.js)가 real 과 «같은 판정»을 내야 한다.
   ⚠ 2026-10-08 지금은 그 셈이 peak×E 라 등을 켠 칸을 낮게 본다(등 1개 5.93 · real 6.84). 그러면 사람 화면이
     「등 1개로는 못 갈라진다」고 말한다. ⇒ core 몫으로 넘겼다. 고쳐지면 이 칸이 초록이 된다. */
check('④ -2 게임 판정(lightGateOf)이 real 과 같은 답 — 등0 못 넘고 등1 넘는다', () => {
  const S = newState({ room: 'oneroom', mode: 'real' });
  S.pots.push({ id: 'pot_01', plantId: 'monstera_deliciosa', slotId: null, at: null, variegated: false });
  eng.build('oneroom');
  const g0 = lightGateOf(S, { light: eng }, { season: 'summer', lampCount: 0 });
  const g1 = lightGateOf(S, { light: eng }, { season: 'summer', lampCount: 1 });
  assert.equal(g0.canGrow, maxReal(ORR.out, 0) >= g0.min, `자랄 수 있나가 갈립니다 — 게임 ${g0.best.avg7} · real ${maxReal(ORR.out, 0)}`);
  assert.equal(g0.canFenestrate, false, `★ 게임이 자연광만으로 갈라진다고 합니다 (${g0.best.avg7})`);
  assert.equal(g1.canFenestrate, maxReal(ORR.out, 1) >= FEN,
    `★ 게임 판정과 real 이 갈립니다 — 게임 등1 ${g1.best.avg7}(${g1.best.slotId}) · real ${maxReal(ORR.out, 1)} · 문턱 ${FEN}`);
  assert.equal(g1.why, null, `게임이 등1 에서 까닭을 답니다: ${g1.why}`);
});

/* ══ ⑤ 반지하보다 낫되 과하지 않다 ═══════════════════════════════════════ */
/* ★ 2026-10-08 — ⑤를 «식»에서 «뜻»으로 고쳐 썼다(D7 · house-night-20260906 §② ㉠).
   옛 식 「원룸 등n 최고 < 반지하 등n 최고」는 어느 모드에서도 ④(원룸이 등1 로 6.0 을 넘어야)와 부딪혔다 —
   반지하는 등 셋으로도 6.0 에 못 닿으니 «빈 구간»이 생긴다. 그 식이 지키려던 «뜻» 셋만 남긴다:
     ⑤-1 무늬종 갈라짐(8.4)은 원룸에서 못 넘는다 — 그건 뒤 단계(온실) 몫이다
     ⑤-2 과광(16.0)이 없다 — 등이 상이 아니라 벌이 되는 자리가 없다(맑은 날 peak 로 잰다 · 타는 것은 «그날» 일이다)
     ⑤-3 «등 없는 이사가 반지하 등을 지우지 않는다» — 원룸 자연광(등0)이 반지하 «등 다 켠» 최고보다 낮다.
         높으면 반지하에서 산 등이 이사하는 순간 뜻을 잃는다 */
check('⑤ 과하지 않다 — 무늬종 갈라짐·과광은 못 넘고, 등 없는 이사가 반지하 등을 지우지 않는다', () => {
  const last = OR_LAMPS.length - 1, bjLast = BJ_LAMPS.length - 1;
  const bestAll = maxReal(ORR.out, last);
  assert.ok(bestAll < VARIE_FEN,
    `★ 원룸에서 등 ${last}개로 무늬종 갈라짐(${VARIE_FEN})까지 됩니다 (real ${bestAll}) — 뒤 단계가 죽습니다`);
  const over = [...OR.out.entries()].filter(([, v]) => v[last] >= OVERLIGHT);
  assert.deepEqual(over.map(([k]) => k), [],
    `★ 등 ${last}개를 켠 원룸에 과광(${OVERLIGHT}) 자리가 있습니다: ${over.map(([k, v]) => `${k} ${v[last]}`).join(', ')}`);
  const or0 = maxReal(ORR.out, 0), bjAll = maxReal(BJR.out, bjLast);
  assert.ok(or0 < bjAll,
    `★ 원룸 자연광(${or0})이 반지하 등 ${bjLast}개 최고(${bjAll})를 넘습니다 — 이사가 반지하 등을 지웁니다`);
  info(`[real 여름 avg7] 무늬종 갈라짐 ${VARIE_FEN} — 원룸 등${last} 최고 ${bestAll} 로 못 넘는다(온실 몫) · ` +
       `과광 ${OVERLIGHT} 넘는 칸 0(peak)`);
  info(`  등 없는 이사 — 원룸 등0 ${or0} < 반지하 등${bjLast} ${bjAll}`);
  info(`[novice 참고 · peak] 원룸 ` + OR_LAMPS.map(n => `등${n} ${maxOf(OR.out, n).toFixed(2)}`).join(' · ') +
       ` · 반지하 ` + BJ_LAMPS.map(n => `등${n} ${maxReal(BJR.out, n)}`).join(' · ') + ' (반지하는 real)');
});

/* ══ 원룸 자리표 — 숫자를 남긴다 ═════════════════════════════════════════ */
check('원룸 자리표 — 기준 배치 D (등 0~3 · 맑음·여름 peak / real 7일평균 = 자연광×E + 등)', () => {
  const last = OR_LAMPS.length - 1;
  const rows = [...OR.out.entries()].sort((a, b) => b[1][last] - a[1][last]);
  for (const [id, v] of rows)
    info(`${id.padEnd(22)} peak ${v.map(x => String(x).padStart(6)).join('')}  ` +
         `real ${ORR.out.get(id).map(x => String(x).padStart(6)).join('')}`);
  assert.equal(rows.length, OR.room.slots.length);
  assert.equal(rows.length, 18);
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
