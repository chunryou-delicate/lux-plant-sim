/* tools/lib/drop_table.mjs — 방 자리마다 «늘어지는 줄기가 떨어질 높이»(house dropM · high)를 노드에서 뽑는다(core · 2026-10-23 · D71)
   ------------------------------------------------------------------
   하네스(byeot_harness)의 빛은 방 프로필(정적 표)이라 자리에 dropM 이 없다. 게임은 house.js(dropBelow · built.plantSlots)가 낸다.
   ⇒ 같은 house 코드로 그 방을 한 번 지어 자리마다 dropM · high 를 JSON 으로 찍는다(조도 검사 test_oneroom_room 과 같은 결 · THREE 는 vendor 전역).
   전역(document · THREE)을 흉내 내야 해서 **자식 프로세스로만** 부른다 — 하네스 프로세스에 전역을 안 남긴다.
     node tools/lib/drop_table.mjs tworoom   →  {"room":"tworoom","slots":{"<slotId>":{"dropM":..,"high":..}}}
   ⛔ 값을 안 바꾼다 · 파일을 안 쓴다(표준 출력만). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const roomId = process.argv[2] || 'tworoom';
const toUrl = (rel) => 'file:///' + path.join(ROOT, rel).replace(/\\/g, '/');
const dataOf = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', rel), 'utf8'));

const stubCtx = () => new Proxy({}, { get: (t, k) => {
  if (k === 'createImageData' || k === 'getImageData') return (w = 1, h = 1) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h });
  if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop() {} });
  if (k === 'measureText') return () => ({ width: 0 });
  return () => {};
} });
const stubEl = () => ({ style: {}, dataset: {}, appendChild() {}, setAttribute() {}, addEventListener() {}, getContext: () => stubCtx() });
globalThis.document = {
  createElement: (t) => (t === 'canvas' ? { width: 1, height: 1, style: {}, getContext: () => stubCtx(), toDataURL: () => '' } : stubEl()),
  createElementNS: () => stubEl(), addEventListener() {}, getElementById: () => null,
  querySelector: () => null, querySelectorAll: () => [], body: stubEl(), documentElement: stubEl()
};
globalThis.window = globalThis;
globalThis.self = globalThis;
vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'vendor', 'three', 'three.min.js'), 'utf8'));

const { createLightEngine } = await import(toUrl('src/game/light_adapter.js'));
/* 프로필(tools/gen_room_profile)과 같은 판 — 기준 배치(reference_layout)가 있으면 얹은 사본 */
const HOUSE = dataOf('house_rooms.json');
const withRef = (hr) => {
  const out = JSON.parse(JSON.stringify(hr));
  for (const r of Object.values(out.rooms || {}))
    if (r && r.reference_layout && Array.isArray(r.reference_layout.furniture)) r.furniture = [...(r.furniture || []), ...r.reference_layout.furniture];
  return out;
};
const eng = createLightEngine({
  houseRooms: withRef(HOUSE), winPresets: dataOf('window_presets.json').presets, doorPresets: dataOf('door_presets.json').presets,
  finishes: dataOf('room_finishes.json'), furnPresets: dataOf('furniture_presets.json').presets, lightPresets: dataOf('lighting_presets.json'),
  shadePresets: dataOf('shading_presets.json'), lightTh: dataOf('balance/light_thresholds.json'), weatherBalance: dataOf('balance/weather.json')
});
const room = eng.build(roomId);
const slots = {};
for (const s of (room.built && room.built.plantSlots) || []) slots[s.slotId] = { dropM: Number.isFinite(s.dropM) ? s.dropM : null, high: s.high === true, y: s.y };
process.stdout.write(JSON.stringify({ room: roomId, slots }) + '\n');
