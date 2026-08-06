/* ============================================================
   tools/test_floorlight.mjs — 층수로 밝기(skyViewK) · 방 다섯의 사다리
   ------------------------------------------------------------
     node tools/test_floorlight.mjs

   박사님 원문(2026-08-06): *"원룸의 빛의 양을 늘리면 어떻게 돼? 투룸은 더 늘리고 그 위에
   것들도 엘리베이션식으로 올라가면? 반지하는 주변에 건물이 있어서 최하인 거고,
   나머지들은 점점 더 고층이라 더 빛이 세다는 느낌"*

   ══ 무엇을 어디에 붙였나 ═══════════════════════════════════════════════
   `render3d/house.js` 의 `evScale` 에 곱한다. 그 칸은 이미 **「이 창이 하늘을 얼마나 보나」**
   를 담는 자리다 — 방위(orientK)와 차광막(shadeMult)이 거기서 곱해진다. 새 계통이 아니다.
   ⚠ 하늘(skyEvMax)에 곱하면 안 된다 — 하늘은 온 동네가 같이 쓰는 것이다.

   ★ `skyViewK` 는 **절대값이 아니라 배수**다. `1.00 = 지금까지 잰 값 그대로`.
     반지하는 tau 0.70 · 창턱 4.80 이 확정되어 못 움직이므로, 「반지하가 최하」를
     *반지하를 깎는 것*이 아니라 *나머지를 올리는 것*으로 쓴다.

   ══ 합격선 넷 (지시 그대로) ═══════════════════════════════════════════
     ① 반지하는 **한 톨도 안 바뀐다** — 14칸 DLI 가 얼린 표와 정확히 같다
     ② 원룸에서 몬스테라가 갈라짐 문턱 6.0 을 넘을 수 있다 (등으로)
     ③ 사다리가 **단조로 오르고** 단계마다 남는 것이 있다
     ④ 온실이 과광(monstera max 16.0)을 안 넘는다

   ⚠ 판정 단위는 7일 이동평균(avg7) = peak(맑음·여름) × weatherE('summer').
     하루 peak 가 아니다 — sim.fenestrationContrast · oneroom.lightGateOf 가 그렇게 가른다.
============================================================ */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const toUrl = (rel) => 'file:///' + path.join(ROOT, rel).replace(/\\/g, '/');
const dataOf = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', rel), 'utf8'));

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
/* 다른 방들의 「임시 uid」 경고를 삼킨다 — 이 검사가 고칠 것이 아니고, 삼키지 않으면
   진짜 실패가 100줄 경고에 묻힌다. 그 방들이 몇 칸인지는 아래에서 숫자로 남긴다. */
const realError = console.error, realWarn = console.warn;
console.error = () => {}; console.warn = () => {};
vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'vendor', 'three', 'three.min.js'), 'utf8'));

const { createLightEngine } = await import(toUrl('src/game/light_adapter.js'));
const { weatherE } = await import(toUrl('src/engine/weather.js'));
const HOUSE = dataOf('house_rooms.json');
const TH = dataOf('balance/light_thresholds.json');
const M = TH.plants.monstera_deliciosa;
const FEN = M.fenestrate, MIN = M.min, MAXLIGHT = M.max;
const VARIE_MIN = +(MIN * TH.variegated.need_mult).toFixed(4);
const VARIE_FEN = +(FEN * TH.variegated.need_mult).toFixed(4);

function makeEngine(overrideSkyView) {
  const hr = JSON.parse(JSON.stringify(HOUSE));
  if (overrideSkyView)
    for (const [k, v] of Object.entries(overrideSkyView)) if (hr.rooms[k]) hr.rooms[k].skyViewK = v;
  return createLightEngine({
    houseRooms: hr, winPresets: dataOf('window_presets.json').presets,
    doorPresets: dataOf('door_presets.json').presets, finishes: dataOf('room_finishes.json'),
    furnPresets: dataOf('furniture_presets.json').presets, lightPresets: dataOf('lighting_presets.json'),
    shadePresets: dataOf('shading_presets.json'), lightTh: TH,
    weatherBalance: dataOf('balance/weather.json')
  });
}
const eng = makeEngine();
console.error = realError; console.warn = realWarn;

const SKY = { weather: 'clear', season: 'summer', litHours: 12 };
const E = weatherE('summer');
const avg7 = (peak) => +(peak * E).toFixed(2);

/* 그 방의 슬롯 DLI — 등 0개(자연광)와 등 전부. */
function scan(roomId) {
  const room = eng.build(roomId);
  const n = room.growRigs.length;
  const d0 = [], dn = [];
  for (const s of room.slots) {
    eng.clearCache();
    d0.push(+eng.dliOfSlot(s.slotId, { ...SKY, lampCount: 0 }).toFixed(2));
    dn.push(n ? +eng.dliOfSlot(s.slotId, { ...SKY, lampCount: n }).toFixed(2) : d0[d0.length - 1]);
  }
  const best = Math.max(0, ...d0), bestN = Math.max(0, ...dn);
  return {
    id: roomId, label: room.def.label, skyViewK: room.def.skyViewK ?? 1,
    floorNo: room.def.floorNo ?? null, slots: room.slots.length, rigs: n,
    ids: room.slots.map(s => s.slotId), d0, dn,
    daylightBest: best, daylightAvg7: avg7(best),
    fullBest: bestN, fullAvg7: avg7(bestN),
    fenDaylight: d0.filter(v => avg7(v) >= FEN).length,
    fenFull: dn.filter(v => avg7(v) >= FEN).length,
    growDaylight: d0.filter(v => avg7(v) >= MIN).length,
    varieDaylight: d0.filter(v => avg7(v) >= VARIE_MIN).length,
    tempSlots: room.unstableSlots.length
  };
}

/* 가구 없는 공간 최고 — 과광 확인용(0.25m 격자 · 높이 0.10~1.80, measured.space 와 같은 방식) */
function spacePeak(roomId) {
  const room = eng.build(roomId);
  const { w, d } = room.size;
  let best = 0, at = null;
  for (let y = 0.10; y <= 1.80001; y += 0.25)
    for (let x = -w / 2 + 0.125; x < w / 2; x += 0.25)
      for (let z = -d / 2 + 0.125; z < d / 2; z += 0.25) {
        let v = 0;
        try { v = eng.dliAt({ x: +x.toFixed(3), y: +y.toFixed(3), z: +z.toFixed(3) }, { ...SKY, lampCount: 0 }).dli; }
        catch { continue; }
        if (v > best) { best = v; at = { x: +x.toFixed(2), y: +y.toFixed(2), z: +z.toFixed(2) }; }
      }
  return { peak: +best.toFixed(2), at };
}

const results = [];
const check = (name, fn) => { try { fn(); results.push(['PASS', name]); }
                              catch (e) { results.push(['FAIL', name, e.message]); } };
const info = (s) => results.push(['INFO', '  ' + s]);

/* ══ ① 반지하 회귀 ═══════════════════════════════════════════════════════
   ⚠ 값은 2026-08-06 main(등 옮기기까지) 에서 뜬 것이다. `test_lampaim` ①(안 겨눈 등 회귀)와
     `test_oneroom_room` ⑥ 이 같은 판을 다른 각도에서 잠근다. 셋이 다 같은 표를 본다. */
const BANJIHA_FROZEN = {
  'banjiha-sill:0':    [4.80,  5.19], 'banjiha-desk:0':    [0.61,  1.86],
  'banjiha-desk:1':    [0.17,  1.32], 'banjiha-dresser:0': [0.08,  0.19],
  'banjiha-dresser:1': [0.05,  0.13], 'banjiha-etagere:0': [0.13,  0.95],
  'banjiha-etagere:1': [0.14,  1.04], 'banjiha-etagere:2': [0.13,  0.99],
  'banjiha-etagere:3': [0.23,  2.01], 'banjiha-etagere:4': [0.22,  2.37],
  'banjiha-etagere:5': [0.21,  2.05], 'banjiha-etagere:6': [0.51,  6.06],
  'banjiha-etagere:7': [0.48, 12.41], 'banjiha-etagere:8': [0.48,  6.10]
};
const BJ = scan('banjiha');
check('① 회귀 — 반지하 14칸이 skyViewK 를 붙인 뒤에도 한 톨도 안 바뀐다', () => {
  assert.equal(BJ.slots, 14);
  assert.equal(BJ.skyViewK, 1, '★ 반지하에 skyViewK 가 붙었습니다 — 반지하는 기준(1.00)이라 못 건드립니다');
  assert.equal(HOUSE.rooms.banjiha.skyViewK, undefined,
    '★ house_rooms.json 의 banjiha 절이 수정되었습니다 (소유 밖)');
  for (const [id, [w0, wn]] of Object.entries(BANJIHA_FROZEN)) {
    const i = BJ.ids.indexOf(id);
    assert.ok(i >= 0, `★ 반지하 자리가 사라졌습니다: ${id}`);
    assert.deepEqual([BJ.d0[i], BJ.dn[i]], [w0, wn],
      `★ 반지하 ${id} 가 바뀌었습니다 — 얼렸을 때 [${w0}, ${wn}] · 지금 [${BJ.d0[i]}, ${BJ.dn[i]}]\n` +
      `  ⚠ 창턱이 등2 에서 6.78 로 나오면 **트리가 낡은 것**이다(2026-08-06 lampaim 의 ` +
      `BACK_REFLECT 0.18 이 없다). main 위에서 다시 돌려 보십시오.`);
  }
  info(`반지하 등0 최고 ${BJ.daylightBest} (7일평균 ${BJ.daylightAvg7}) · 등2 최고 ${BJ.fullBest} (${BJ.fullAvg7})`);
});

check('① -2 skyViewK 1.00 은 아무것도 안 바꾼다 — 안 적은 방과 같다', () => {
  /* 명시 1.00 과 미기재가 같은 값이어야 "기본이 안전"이 성립한다 */
  const e1 = makeEngine({ banjiha: 1.0 });
  const r = e1.build('banjiha');
  const got = r.slots.map(s => { e1.clearCache(); return +e1.dliOfSlot(s.slotId, { ...SKY, lampCount: 2 }).toFixed(2); });
  const want = r.slots.map(s => BANJIHA_FROZEN[s.slotId][1]);
  assert.deepEqual(got, want, 'skyViewK: 1.0 이 값을 움직였습니다');
});

check('① -3 조도는 skyViewK 에 **선형**이다 — 배수 그대로 움직인다', () => {
  /* 이 선형성이 있어야 "1.18 을 곱하면 4.30 이 된다"를 표로 예측할 수 있다.
     안 그러면 방마다 다시 다 재야 한다. */
  const a = makeEngine({ oneroom: 1.0 }), b = makeEngine({ oneroom: 2.0 });
  const ra = a.build('oneroom'); b.build('oneroom');
  let worst = 0, n = 0;
  for (const s of ra.slots) {
    a.clearCache(); b.clearCache();
    const va = a.dliOfSlot(s.slotId, { ...SKY, lampCount: 0 });
    const vb = b.dliOfSlot(s.slotId, { ...SKY, lampCount: 0 });
    /* ⚠ 어두운 칸은 빼고 본다 — `dliOfSlot` 이 **소수 둘째 자리로 반올림**해서 내주므로
       0.81 같은 값에서는 반올림만으로 ±0.6% 가 뜬다(0.8135 → 0.81, ×2 는 1.63).
       물리가 휜 것이 아니라 자릿수가 모자란 것이다. 1.0 이상만 보면 반올림 몫이 0.5% 아래다. */
    if (va < 1.0) continue;
    n++;
    worst = Math.max(worst, Math.abs(vb / va - 2) / 2);
  }
  assert.ok(n >= 8, '표본이 너무 적습니다');
  assert.ok(worst < 0.005, `선형이 아닙니다 — 최대 오차 ${(worst * 100).toFixed(2)}%`);
  info(`선형성 확인 — skyViewK ×2 에서 ${n}칸 최대 오차 ${(worst * 100).toFixed(2)}% (반올림 몫)`);
  eng.build('oneroom');
});

/* ══ ②③ 사다리 ═══════════════════════════════════════════════════════ */
const ROOMS = ['banjiha', 'oneroom', 'classroom', 'tworoom', 'apartment', 'greenhouse'];
const SC = {}; for (const r of ROOMS) SC[r] = r === 'banjiha' ? BJ : scan(r);

check('③ 사다리 — 반지하 < 원룸 < 학원교실 < 투룸 < 아파트 < 온실 (자연광 7일평균)', () => {
  const order = ['banjiha', 'oneroom', 'classroom', 'tworoom', 'apartment', 'greenhouse'];
  for (let i = 1; i < order.length; i++) {
    const lo = SC[order[i - 1]], hi = SC[order[i]];
    assert.ok(hi.daylightAvg7 > lo.daylightAvg7,
      `★ ${lo.label}(${lo.daylightAvg7}) 이 ${hi.label}(${hi.daylightAvg7}) 보다 어둡지 않습니다`);
  }
  for (const id of order) {
    const r = SC[id];
    info(`${String(r.label).padEnd(6)} ${r.floorNo == null ? ' -' : String(r.floorNo).padStart(2)}층 ` +
         `· skyViewK ${String(r.skyViewK).padEnd(4)} · 자리 ${String(r.slots).padStart(3)}칸 · 등 ${r.rigs}개 ` +
         `· 자연광 최고 ${String(r.daylightAvg7).padStart(5)} ` +
         `(자람 ${String(r.growDaylight).padStart(3)}칸 · 무늬 ${String(r.varieDaylight).padStart(3)}칸 · 갈라짐 ${String(r.fenDaylight).padStart(3)}칸)` +
         (r.rigs ? ` · 등 다 켜면 최고 ${r.fullAvg7} (갈라짐 ${r.fenFull}칸)` : ''));
  }
});

check('③ -2 단계마다 남는 것이 있다 — 다음 방이 처음 여는 것이 있다', () => {
  const bj = SC.banjiha, or = SC.oneroom, tw = SC.tworoom, ap = SC.apartment, gh = SC.greenhouse;
  /* 반지하 — 자연광으로는 무늬종 최소(4.2)에 못 닿는다 */
  assert.ok(bj.daylightAvg7 < VARIE_MIN, `반지하 자연광이 무늬종 최소(${VARIE_MIN})를 넘었습니다`);
  /* 원룸 — 무늬종 최소는 자연광으로 닿고, 갈라짐(6.0)은 **등이 있어야** 넘는다 */
  assert.ok(or.daylightAvg7 >= VARIE_MIN,
    `★ 원룸 자연광(${or.daylightAvg7})이 무늬종 최소 ${VARIE_MIN} 에 못 닿습니다 — 반지하와 다를 것이 없습니다`);
  assert.equal(or.fenDaylight, 0,
    `★ 원룸이 자연광만으로 갈라집니다 — 식물등을 산 뜻이 없어집니다`);
  assert.ok(or.fenFull >= 1, '★ 원룸이 등을 다 켜도 못 갈라집니다');
  /* 투룸 — 원룸보다 밝지만 자연광 갈라짐은 **아직** */
  assert.equal(tw.fenDaylight, 0, `★ 투룸이 자연광으로 갈라집니다 — 아파트가 처음 여는 것이 없어집니다`);
  /* 아파트 — ④ 의 보상. 자연광만으로 갈라진다 */
  assert.ok(ap.fenDaylight > 0,
    `★ 아파트가 자연광으로 못 갈라집니다 (${ap.daylightAvg7}) — ④ 에 보상이 없습니다`);
  /* 온실 — 무늬종 갈라짐(8.4)까지. 원룸·아파트는 못 닿아야 그것이 온실의 몫이 된다 */
  assert.ok(gh.daylightAvg7 >= VARIE_FEN, `온실이 무늬종 갈라짐(${VARIE_FEN})에 못 닿습니다`);
  assert.ok(or.fullAvg7 < VARIE_FEN,
    `★ 원룸이 무늬종 갈라짐(${VARIE_FEN})까지 됩니다 (${or.fullAvg7}) — 뒤 단계가 죽습니다`);
  assert.ok(ap.daylightAvg7 < VARIE_FEN, `아파트 자연광이 무늬종 갈라짐까지 갑니다`);
  info(`단계마다 처음 열리는 것 — 반지하: 등 1개로 몬스테라 갈라짐 1칸(${bj.fenFull}) · ` +
       `원룸: 자연광 무늬종 최소 ${VARIE_MIN} 도달(${or.daylightAvg7}) + 등으로 갈라짐 ${or.fenFull}칸 · ` +
       `투룸: 자연광 ${tw.daylightAvg7} (갈라짐은 아직) · ` +
       `아파트: 자연광 갈라짐 ${ap.fenDaylight}칸 · 온실: 자연광 무늬종 갈라짐 ${VARIE_FEN} 도달(${gh.daylightAvg7})`);
});

/* ══ ④ 온실 과광 ═════════════════════════════════════════════════════ */
check('④ 온실 — 과광선(monstera max 16.0)을 안 넘는다', () => {
  const sp = spacePeak('greenhouse');
  const margin = +(((MAXLIGHT - sp.peak) / MAXLIGHT) * 100).toFixed(1);
  assert.ok(sp.peak < MAXLIGHT,
    `★ 온실 공간 최고 ${sp.peak} 가 과광선 ${MAXLIGHT} 을 넘었습니다 — 잎이 탑니다`);
  assert.equal(SC.greenhouse.skyViewK, 1,
    '★ 온실에 skyViewK 가 1 이 아닌 값이 붙었습니다 — 여유가 6% 뿐이라 넘깁니다');
  info(`온실 공간 최고 ${sp.peak} @${JSON.stringify(sp.at)} · 과광선 ${MAXLIGHT} 까지 여유 ${margin}%`);
  /* 얼마나 위험한지 숫자로 남긴다 — 다음 창이 "조금 올려도 되겠지" 하지 않게 */
  const k = +(MAXLIGHT / sp.peak).toFixed(3);
  info(`  ⚠ 온실 skyViewK 를 ${k} 이상으로 올리면 그 순간 과광이다. 올릴 여지가 사실상 없다.`);
  eng.build('oneroom');
});

/* ══ 다른 방의 임시 uid — 숫자로 남긴다(이 창이 고칠 것은 아니다) ══════ */
check('⏸ 남은 임시 uid — 원룸은 0, 나머지는 아직 남았다(인계)', () => {
  assert.equal(SC.oneroom.tempSlots, 0, '원룸에 임시 uid 가 남았습니다');
  assert.equal(SC.banjiha.tempSlots, 0);
  for (const id of ['classroom', 'tworoom', 'apartment', 'greenhouse'])
    info(`${SC[id].label}: 임시 uid 슬롯 ${SC[id].tempSlots}/${SC[id].slots}칸 — 프로파일을 못 뽑는다`);
});

/* ---- 출력 ---- */
let fail = 0;
for (const r of results) {
  if (r[0] === 'INFO') { console.log('       ' + r[1]); continue; }
  if (r[0] === 'FAIL') fail++;
  console.log(`${r[0] === 'PASS' ? '  ✔' : '  ✘'} ${r[1]}${r[2] ? '\n      → ' + r[2] : ''}`);
}
const n = results.filter(r => r[0] !== 'INFO').length;
console.log(`\nfloorlight: ${fail ? 'FAIL' : 'PASS'}  (${n - fail}/${n})`);
process.exit(fail ? 1 : 0);
