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
    for (const [k, v] of Object.entries(overrideSkyView)) {
      if (!hr.rooms[k]) continue;
      /* null 은 **키를 지운다** — 「안 적은 방」을 만들 수 있어야 ①-2 가 성립한다.
         값만 넣을 수 있으면 그 검사는 자기 이름대로 잴 수가 없다. */
      if (v === null) delete hr.rooms[k].skyViewK; else hr.rooms[k].skyViewK = v;
    }
  return createLightEngine({
    houseRooms: hr, winPresets: dataOf('window_presets.json').presets,
    doorPresets: dataOf('door_presets.json').presets, finishes: dataOf('room_finishes.json'),
    furnPresets: dataOf('furniture_presets.json').presets, lightPresets: dataOf('lighting_presets.json'),
    shadePresets: dataOf('shading_presets.json'), lightTh: TH,
    weatherBalance: dataOf('balance/weather.json')
  });
}
/* 방 데이터를 통째로 갈아끼운 엔진 — `makeEngine` 은 skyViewK 만 만진다.
   ⑤(자리 이름 안정) 가 「가구를 끼운 방」을 지어 보려면 이쪽이 필요하다. */
function makeEngineWith(houseRooms) {
  return createLightEngine({
    houseRooms, winPresets: dataOf('window_presets.json').presets,
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
   ⚠ `test_lampaim` ①(안 겨눈 등 회귀)와 `test_oneroom_room` ⑥ 이 같은 판을 다른 각도에서
     잠근다. 셋이 다 같은 표를 본다.

   ★★ **2026-08-15 갱신 — 추천 자리를 칸 한가운데로 옮겼다**(박사님 허락).
   ------------------------------------------------------------
   검사가 무르익어서 고친 것이 아니라 **입력(자리 좌표)이 바뀌어서** 다시 뜬 것이다.
   `render3d/furniture_pastel.tierSlots` 의 가장자리 여백이 상수 0.09 였는데, 그것이
     ① 화면이 그리는 칸과 최대 0.0671m 어긋나 있었고(SLOT_GOVERN_R 0.04 를 넘는다)
     ② 시루 반지름 0.12 보다 작아 **14칸 중 10칸이 시루를 상판 밖으로 3cm 내보냈다**
   ⇒ 여백을 **칸 반쪽**으로 바꿔 자리를 칸 한가운데에 앉혔다. 14칸 전부 어긋남 0.000 ·
     상판을 넘는 칸 0개다. 자리가 움직였으니 그 자리의 밝기도 움직인다.

   ★ 값은 지어낸 것이 아니라 **다시 뽑은 것**이다: `BYEOT_REGEN=1 node tools/test_floorlight.mjs`
   ★ 창턱(4.80/5.19)은 **한 톨도 안 움직였다** — 자리가 1칸뿐이라 어긋남이 0 이었다.
     tau 0.70 · 창턱 4.80 · 등2 5.19 에 걸린 밸런스는 그대로다.
   ⚠ 움직인 폭: 등 0개는 최대 0.02(desk:1 0.17→0.19). 등을 켜면 최대 **0.71**
     (etagere:6 6.06→6.77 · :8 6.10→6.80) — 선반 양끝 자리가 바 등 쪽으로 3cm 다가섰다.
   옛 값(2026-08-06 main): sill [4.80,5.19] · desk:0 [0.61,1.86] · desk:1 [0.17,1.32] ·
     dresser:0 [0.08,0.19] · dresser:1 [0.05,0.13] · etagere:0~2 [0.13,0.95]/[0.14,1.04]/[0.13,0.99] ·
     etagere:3~5 [0.23,2.01]/[0.22,2.37]/[0.21,2.05] · etagere:6~8 [0.51,6.06]/[0.48,12.41]/[0.48,6.10] */
/* ★★★ 2026-08-16 갱신 — **G-16 · 첫 등을 몬스테라 위로 옮겼다** (박사님 지시).
   ------------------------------------------------------------
   `banjiha-growlight-bar` 가 3단 선반 밑(y 1.02)에서 **창 위 벽**(0, 2.15, -1.85)으로 갔다.
   ⇒ 등2 열이 통째로 움직인다. **창턱 5.19 → 7.11 · 선반 맨 윗칸 12.41 → 1.00.**
     그것이 이 변경의 전부이자 맞바꿈이다(까닭·표는 `data/house_rooms.json §banjiha-growlight-bar`).
   ⚠⚠ **등0 열도 조금 움직였는데 그건 내 것이 아니다** — `desk:0` 0.60→0.61 ·
     `desk:1` 0.19→0.18 · `dresser:*` 는 **B-1·B-6**(가구를 모서리로 붙이고 상판 자리를
     칸 한가운데로 옮긴 것 · `d1986cd`)이 낸 값이고, 이 표는 그때 안 갱신돼 **이미 빨갰다.**
     내 변경 전에 재서 확인했다(`docs/handoff/midlamp-to-plan.md §검사 전·후`).
   ★ 값은 지어낸 것이 아니라 다시 뽑았다: `BYEOT_REGEN=1 node tools/test_floorlight.mjs`
   옛 값(G-16 전): sill [4.80,5.19] · etagere:6 [0.51,6.77] · :7 [0.48,12.41] · :8 [0.48,6.80] */
  /* ★★ 2026-08-17 늦게 (G-14) — **창턱 받침을 방 쪽으로 0.20m 밀었다.**
     박사님: *"창턱이 덜 튀어나와 있어서 식물이 창문 위턱에 걸려서 뚫어버려서 …"* →
     0.25 를 재서 표로 올리자 *"**조금만 민다로 하자**"*. `banjiha-sill` 이
     z −1.95·깊이 0.24(벽에서 0.07 나옴) 에서 **z −1.85·깊이 0.30(0.20 나옴)** 이 됐다.
     ⇒ **움직인 칸은 둘뿐이다**: `sill:0` 과 `desk:0`. 나머지 열세 칸은 한 톨도 안 바뀌었다.
     ⚠⚠ 창턱 **등 1개 7.07 → 6.02**. 갈라짐 문턱 6.0 을 **여유 0.02** 로 지킨다 —
       G-16 이 식물등을 창 위로 옮겨 세운 것이 그 값이라, **여기가 이 방에서 제일 얇은 얼음**이다.
       이 방에 그림자를 하나라도 더 놓거나 창턱을 더 밀면 그 자리에서 깨진다.
     ★ 값은 손으로 안 적었다: `BYEOT_REGEN=1` 로 다시 뽑았다. */
/* ★★ 2026-08-23 다시 얼렸다 — **무엇이 왜 움직였는지 적는다.**
   ------------------------------------------------------------
   ⚠ [Plan] 이 못박은 것: ***"기준선을 말없이 갱신하는 것은 검사를 끄는 것과 같다."***
     그래서 아래 표가 왜 바뀌었는지를 여기 남긴다. 값은 손으로 안 적었다 —
     `BYEOT_REGEN=1 node tools/test_floorlight.mjs`.

   움직인 것 셋. 전부 **다른 데서 한 일**이고, 그때 이 표를 아무도 안 얼렸다.

   ① `d0bc365` 반지하에 **셋째 등**(거치형 growlight_stand)이 생겼다.
      이 표의 둘째 칸은 「등 **전부**」다 — 곧 등2 → 등3 이 되었다. 그래서 **둘째 칸이
      통째로 올랐다**(창턱 6.06→6.17 · etagere:0 0.37→0.85). 첫째 칸(자연광)은 안 흔들린다.
      ⚠ 이 칸이 등 개수를 따라간다는 것을 모르면 「빛이 세졌다」로 오해하기 쉽다.
   ② `ca3f8f8` 협탁을 0.42×0.36 → **0.50×0.50**(2×2 칸)으로, 책상을 여섯 열 → 다섯 열로.
      desk:0/desk:1/nightstand:0 이 그때 움직였는데 표는 그대로였다.
   ③ 2026-08-23 **자리를 칸 한가운데로 옮겼다**(`furniture_pastel §tierSlots`).
      협탁 자리가 칸 **경계**에 앉아 겨눠도 안 붙던 것을 고쳤다 — nightstand:0 0.38→0.44.
      ★ **자리 수는 안 늘렸다**(반지하 15칸 그대로 · 여섯 방 325칸 그대로).
      ★ 여섯 방 자연광 최고도 전부 그대로다(3.68·6.69·7.21·7.89·9.75·14.55) — 사다리 불변.

   ⚠ ①-2 는 이 표를 **안 본다.** 예전에는 봤고, 그래서 표가 낡기만 해도 skyViewK 에게
     없는 죄가 씌워졌다. 그 검사는 이제 「키를 지운 방 vs 1.00 을 적은 방」을 직접 견준다. */
const BANJIHA_FROZEN = {
  'banjiha-sill:0':      [3.68, 6.17],
  'banjiha-desk:0':      [0.56, 2.06],
  'banjiha-desk:1':      [0.16, 1.25],
  'banjiha-dresser:0':   [0.06, 0.27],
  'banjiha-dresser:1':   [0.04, 0.20],
  'banjiha-etagere:0':   [0.13, 0.85],
  'banjiha-etagere:1':   [0.14, 0.83],
  'banjiha-etagere:2':   [0.13, 0.80],
  'banjiha-etagere:3':   [0.22, 1.17],
  'banjiha-etagere:4':   [0.22, 1.13],
  'banjiha-etagere:5':   [0.21, 1.08],
  'banjiha-etagere:6':   [0.51, 1.75],
  'banjiha-etagere:7':   [0.48, 1.67],
  'banjiha-etagere:8':   [0.48, 1.62],
  'banjiha-nightstand:0':[0.44, 1.36]
};
const BJ = scan('banjiha');

/* 새 값을 뽑을 때 쓴다: BYEOT_REGEN=1 node tools/test_floorlight.mjs
   ⚠ 손으로 적지 마라 — §2 넷째 규칙("고친 값도 재라")이 여기서 깨졌던 자리다. */
if (process.env.BYEOT_REGEN) {
  for (let i = 0; i < BJ.ids.length; i++)
    console.log(`  '${BJ.ids[i]}':${' '.repeat(Math.max(0, 20 - BJ.ids[i].length))}` +
                `[${BJ.d0[i].toFixed(2)}, ${BJ.dn[i].toFixed(2)}],`);
  process.exit(0);
}

check('① 회귀 — 반지하 15칸이 skyViewK 를 붙인 뒤에도 한 톨도 안 바뀐다', () => {
  assert.equal(BJ.slots, 15);   // 2026-08-17 협탁이 들어와 14 → 15 (위 얼린 표 머리말)
  assert.equal(BJ.skyViewK, 1, '★ 반지하에 skyViewK 가 붙었습니다 — 반지하는 기준(1.00)이라 못 건드립니다');
  /* ★ 2026-08-07 — `undefined` 에서 **`=== 1` 로 좁혔다.**
     반지하가 기준 1.00 인 것이 파일에 안 적혀 암묵이었는데(안 적으면 house.js 가 1 로 읽는다),
     기준이 데이터에 안 보이면 다음 사람이 「반지하는 이 계통 밖」으로 읽는다. 그래서 명시했다.
     ⚠ 느슨해진 것이 아니다 — 예전에는 "적지 마라"였고 지금은 **"1 말고 다른 값이면 안 된다"**다.
       막으려던 것(반지하 밝기가 움직이는 것)은 그대로 막힌다. 아래 14칸 얼린 값이 진짜 자물쇠고,
       그 줄은 한 톨도 안 건드렸다. */
  assert.equal(HOUSE.rooms.banjiha.skyViewK, 1,
    '★ 반지하 skyViewK 가 1 이 아닙니다 — 반지하는 기준값이라 못 움직입니다');
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

/* ★★ ①-1 자리가 칸 한가운데에 앉아 있나 (2026-08-15 신설)
   ------------------------------------------------------------
   위 ① 은 **값**을 잠근다. 값이 왜 그 값이어야 하는지는 안 잠근다 —— 그래서 자리가
   조용히 어긋나 있어도 「그 어긋난 값이 정상」으로 굳는 사고가 났다(0.09 상수, 아홉 달).
   여기서는 **뜻**을 잠근다: 자리는 상판을 시루(0.24)로 나눈 칸의 한가운데에 앉고,
   자리에 놓은 시루는 상판 밖으로 안 나간다.

   ⚠ 자는 **엔진이 낸 차폐 상자**(built.occluders)다. `furniture_pastel` 의 셈을 여기로
     베껴 오면 틀려도 0 이 나온다 — 일부러 다른 데서 가져온다.
   ⚠ 이 검사는 **반지하만** 본다. 다른 방에는 상판 = 발자국이 아닌 가구(사다리형 등)가 있어
     이 자로 재면 거짓 실패가 난다. 그건 그 방을 정비할 때 함께 볼 일이다. */
check('①-1 ★ 반지하 15칸이 칸 한가운데에 앉는다 · 시루가 상판 밖으로 안 나간다', () => {
  const CELL = 0.25, POT = 0.24;                 // place.GRID_CELL · 열린 콩나물 시루
  const ax = (L) => {
    const n = Math.max(1, Math.min(Math.round(L / CELL), Math.max(1, Math.floor(L / POT + 1e-9))));
    return { n, cell: L / n, at: i => (i + 0.5) * (L / n) - L / 2 };
  };
  const r = eng.build('banjiha');
  let worst = 0, worstId = null, over = [];
  for (const s of r.slots) {
    const o = r.built.occluders[s.occIdx];
    assert.ok(o, `${s.slotId}: 차폐 상자를 못 찾았습니다`);
    /* occluders 의 x·z 는 **최소 모서리**다(재서 확인: 책상 0.70/-1.80 = 1.30∓0.60/0.30) */
    const dx = s.x - (o.x + o.w / 2), dz = s.z - (o.z + o.d / 2);
    const c = Math.cos(o.rot || 0), si = Math.sin(o.rot || 0);
    const u = dx * c - dz * si, v = dx * si + dz * c;      // 가구 로컬(면) 좌표
    const U = ax(o.w), V = ax(o.d);
    const nu = U.at(Math.max(0, Math.min(U.n - 1, Math.round((u + o.w / 2) / U.cell - 0.5))));
    const nv = V.at(Math.max(0, Math.min(V.n - 1, Math.round((v + o.d / 2) / V.cell - 0.5))));
    const err = Math.hypot(u - nu, v - nv);
    if (err > worst) { worst = err; worstId = s.slotId; }
    const ou = Math.abs(u) + POT / 2 - o.w / 2, ov = Math.abs(v) + POT / 2 - o.d / 2;
    if (ou > 1e-6 || ov > 1e-6) over.push(`${s.slotId} +${Math.max(ou, ov).toFixed(3)}m`);
  }
  assert.ok(worst < 1e-6,
    `★ 자리가 칸 한가운데에서 벗어났습니다 — 최대 ${worst.toFixed(4)}m @ ${worstId}\n` +
    `  ⚠ SLOT_GOVERN_R 0.04 를 넘으면 그 자리 네모를 겨눠도 자리로 안 붙습니다.\n` +
    `  고칠 곳: src/render3d/furniture_pastel.js §tierSlots (여백은 칸 반쪽이어야 한다)`);
  assert.equal(over.length, 0,
    `★ 자리에 놓은 시루가 상판 밖으로 나갑니다: ${over.join(' · ')}`);
  info(`반지하 15칸 어긋남 0 · 상판 넘침 0 (칸 기준: 시루 ${POT}m)`);
});

check('① -2 skyViewK 1.00 은 아무것도 안 바꾼다 — 안 적은 방과 같다', () => {
  /* 명시 1.00 과 미기재가 같은 값이어야 "기본이 안전"이 성립한다.

     ⚠ 2026-08-23 고침 — 전에는 이 검사가 **얼린 표**(BANJIHA_FROZEN)와 견주었다.
       그러면 위 ① 과 같은 것을 재는 셈이고, 표가 낡기만 해도
       「skyViewK: 1.0 이 값을 움직였습니다」라는 **없는 죄**가 떴다. 실제로 그렇게 떴다 —
       ca3f8f8 이 협탁을 2×2 로, 책상을 다섯 열로 바꾸고 표를 다시 안 얼렸다.
       그런데 붉은 글씨는 skyViewK 를 가리켰다. 자가 엉뚱한 데를 가리키면
       **고칠 곳을 못 찾는 것보다 나쁘다** — 안 틀린 곳을 고치게 된다.
     ⚠ 게다가 예전 `makeEngine` 은 값을 **넣을** 수만 있어서 「안 적은 방」을 못 만들었다.
       곧 이 검사는 제 이름에 적힌 것을 애초에 잴 수가 없었다.
     ⇒ 이제 두 벌을 **직접** 견준다 — 키를 지운 방과 1.00 을 적은 방. 표를 안 본다. */
  const del = makeEngine({ banjiha: null }), one = makeEngine({ banjiha: 1.0 });
  const a = del.build('banjiha'), b = one.build('banjiha');
  assert.deepEqual(b.slots.map(s => s.slotId), a.slots.map(s => s.slotId),
    '★ 자리 목록부터 다릅니다 — skyViewK 이전에 방이 다르게 지어졌습니다');
  const read = (e, r) => r.slots.map(s => {
    e.clearCache(); return +e.dliOfSlot(s.slotId, { ...SKY, lampCount: 2 }).toFixed(4);
  });
  const got = read(one, b), want = read(del, a);
  assert.deepEqual(got, want, 'skyViewK: 1.0 이 값을 움직였습니다 — 기본이 안전하지 않습니다');
  info(`skyViewK 미기재 = 명시 1.00 — 반지하 ${a.slots.length}칸 한 톨도 안 다르다`);
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

/* ══ ⑤ 자리 이름이 흔들리지 않는다 ═════════════════════════════════════
   ★★ 2026-08-23 — **여섯 방 전부 uid 를 박았다.** 그 전에는 반지하·원룸만이었고
     나머지 넷은 `TEMP~` 였다(온실 64/64 · 아파트 83/83 · 학원 128/128 · 투룸 20/20).

   무엇이 문제였나 — `light_adapter` 는 uid 가 없으면 **로드 순번**으로 이름을 짓는다.
   곧 `house_rooms.json` 에 가구를 **하나만 끼워도 뒤 이름이 통째로 밀린다.**
   화분은 `slotId` 로 자리를 기억하므로, 밀리는 순간 **어느 자리에 있었는지를 잃는다.**
   실제로 그런 적이 있다(`oneroom-shelf-15:5` → `-6:5`).

   ⚠ **여기서 「TEMP~ 가 없다」만 재면 모자란다** — 그건 이름이 예쁜지를 볼 뿐이다.
     뜻은 **「가구를 끼워도 안 밀린다」**이므로 **실제로 끼워 보고** 잰다.
     방 맨 앞에 가구를 하나 넣는다. 순번으로 짓는 이름이라면 여기서 전부 밀린다.
   ⚠ 한 번 박은 uid 는 바꾸지 마라 — 세이브가 그 이름으로 자리를 찾는다. */
check('⑤ ★ 여섯 방 전부 자리 이름이 안정하다 — 가구를 끼워도 안 밀린다', () => {
  const HR = dataOf('house_rooms.json');
  const bad = [];
  for (const id of ROOMS) {
    assert.equal(SC[id].tempSlots, 0,
      `★ ${SC[id].label} 에 임시 uid 슬롯이 ${SC[id].tempSlots}칸 있습니다 — ` +
      `house_rooms.json §${id}.furniture 의 그 가구에 uid 를 박으십시오`);
    const before = eng.build(id).slots.map(s => s.slotId);
    const hr = JSON.parse(JSON.stringify(HR));
    hr.rooms[id].furniture.unshift(
      { preset: 'shelf_stool_1', uid: 'PROBE-first', x: 0, z: 0, rot: 0 });
    const e2 = makeEngineWith(hr);
    const after = e2.build(id).slots.map(s => s.slotId)
      .filter(i => !String(i).startsWith('PROBE-'));
    const moved = before.filter((v, i) => v !== after[i]);
    if (moved.length) bad.push(`${SC[id].label}: ${moved.length}칸 밀림 (예: ${moved.slice(0, 2).join(' · ')})`);
  }
  assert.equal(bad.length, 0,
    `★ 가구를 하나 끼웠더니 자리 이름이 밀렸습니다:\n      ${bad.join('\n      ')}`);
  info(`여섯 방 ${ROOMS.reduce((a, id) => a + SC[id].slots, 0)}칸 — 임시 uid 0 · 가구를 끼워도 이름 그대로`);
  eng.build('oneroom');
});

/* ══ ⑥ 시루가 오를 수 있는 칸 — **세기만 한다. 안 떨어뜨린다** ════════════
   ★★ 2026-08-23 밤 — **세우자마자 물렸다. 근거가 틀렸다. 적어 둔다.**

   처음엔 이렇게 세웠다: *"퀘스트 `siru5_cycle5` 는 놓인 시루 다섯을 요구하므로
   다섯 칸이 필요하다. 지금 여섯이니 여유가 한 칸이다"* → **여섯 아래면 붉어지게** 했다.

   ⛔ **두 군데가 틀렸다.**
     ① `quest.js:474` 의 `done` 은 `cropPots` 를 **`kind` 와 `harvestCount` 로만** 거른다.
        **`placed` 를 안 본다.** 곧 「놓인 다섯 칸」을 요구하지 않는다.
     ② 박사님: *"**시루는 땅바닥에 놓으면 되는데**.. 그림처럼 한 건 **몬스테라 자라는 빛
        맞추려고** 그렇게 올려친 건데.."* ⇒ **바닥에 놓을 수 있다.** 상판 칸이 벽이 아니다.

   ⇒ 곧 **「여유 한 칸」이라는 벽은 없었다.** 내가 남의 영역(퀘스트)의 뜻을 **짐작으로 읽고**
     그 위에 자를 세웠다. ㉘ 이 말하는 그것이다 — **자를 의심하기 전에 「무엇을 재는지」를
     의심했어야 했다.**

   ★ 그래도 **재는 것 자체는 남긴다.** 「자리 15칸」과 「시루가 오르는 칸 6칸」이 **다른 수**인
     것은 참이고, 그걸 모르면 자리 수만 보고 셈을 하게 된다(계율 ㉟).
     ⇒ **찍기만 하고 안 떨어뜨린다.** 벽인지 아닌지는 퀘스트 쪽이 정한다.
   ⚠ 다시 자로 세우려면 **먼저 `siru5_cycle5` 가 바닥 배치를 세는지**를 확인하라.
     그 답이 나오기 전에는 여기 숫자를 못박지 마라. */
check('⑥ 시루가 오르는 칸을 센다 (기록만 — 벽인지는 퀘스트 쪽이 정한다)', () => {
  const SIRU = 0.24;                        // 열린 콩나물 시루 (docs/engine/rooms_spec.md §8)
  const r = eng.build('banjiha');
  const fit = r.slots.filter(s => Number.isFinite(s.maxPotD) && s.maxPotD >= SIRU - 1e-9);
  info(`시루(${SIRU})가 오르는 «상판» 칸 ${fit.length}/${r.slots.length} — ` +
       fit.map(s => `${s.slotId}(${s.maxPotD})`).join(' · '));
  info(`  ⚠ 나머지 ${r.slots.length - fit.length}칸은 3단선반(0.22)이라 시루가 안 오른다. ` +
       `**「자리 수」와 「시루 칸」은 다른 수다**(계율 ㉟).`);
  info(`  ⚠ 다만 **바닥에는 놓을 수 있다** — 상판 칸이 시루의 천장이 아니다(박사님 2026-08-23).`);
  assert.ok(r.slots.length > 0, '반지하에 자리가 없습니다');   // 이 절이 실제로 돌았다는 것만 잠근다
  eng.build('oneroom');
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
