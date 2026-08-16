/* ============================================================
   tools/probe_lampmovehome.mjs — **첫 등을 몬스테라 위로 옮기면 무엇이 흔들리나** (G-16)
   ------------------------------------------------------------
   박사님 §D-2: *"식물등 최초 위치 이상, **몬스테라 위쪽으로**."*

   `guide-to-plan.md §2 D-2` 가 자리를 재 두었지만, 그때는 **창턱 자연광이 3.68 로
   내려앉아 있던 판**이었다(`bba1f7f` 로 4.80 복구됨). 그래서 **다시 잰다.**

   이 도구는 `data/house_rooms.json` 을 **안 고친다.** 메모리 위에서 `banjiha-growlight-bar`
   의 좌표만 갈아 끼우고 14칸 DLI 를 등 0/1/2 개로 다시 뽑는다 — 그래야 후보를 여럿 재고
   **고를 값을 재서 정할 수 있다**(START-HERE §2 넷째 규칙: 고친 값도 재라).

     node tools/probe_lampmovehome.mjs
     node tools/probe_lampmovehome.mjs --y 2.00 --z -1.85     (한 후보만)
============================================================ */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/* ── 캔버스·문서 스텁 (tools/test_headroom.mjs 와 같은 것) ───────────── */
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

const toUrl = (rel) => 'file:///' + path.join(ROOT, rel).replace(/\\/g, '/');
const dataOf = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', rel), 'utf8'));
const { createLightEngine } = await import(toUrl('src/game/light_adapter.js'));
const H = await import(toUrl('src/game/headroom.js'));

const argv = process.argv.slice(2);
const argOf = (k, d) => { const i = argv.indexOf(k); return i < 0 ? d : +argv[i + 1]; };

const BASE_ROOMS = dataOf('house_rooms.json');
const TH = dataOf('balance/light_thresholds.json');
/* 문턱 — 몬스테라 초록형. 무늬종은 need_mult 1.4 배다(growth_tuning §variegated) */
const GT = dataOf('growth_tuning.json');
const FEN = GT.thresholds.fenestrate, MAXL = GT.thresholds.max;
const BEST_LO = GT.thresholds.best_lo, MIN = GT.thresholds.min;
const VMULT = GT.variegated.need_mult;

function build(patch) {
  /* 방 데이터 사본에 등 좌표만 갈아 끼운다 (원본 파일은 안 건드린다) */
  const rooms = JSON.parse(JSON.stringify(BASE_ROOMS));
  if (patch) {
    const f = rooms.rooms.banjiha.furniture.find(x => x.uid === 'banjiha-growlight-bar');
    if (!f) throw new Error('banjiha-growlight-bar 를 못 찾았습니다');
    for (const k of ['x', 'y', 'z']) if (patch[k] != null) f[k] = patch[k];
  }
  const eng = createLightEngine({
    houseRooms: rooms,
    winPresets: dataOf('window_presets.json').presets,
    doorPresets: dataOf('door_presets.json').presets,
    finishes: dataOf('room_finishes.json'),
    furnPresets: dataOf('furniture_presets.json').presets,
    lightPresets: dataOf('lighting_presets.json'),
    shadePresets: dataOf('shading_presets.json'),
    lightTh: TH,
    weatherBalance: dataOf('balance/weather.json')
  });
  const room = eng.build('banjiha');
  return { eng, room };
}

/* 자리별 DLI — 게임이 쓰는 그 길(`dliOfSlot` · 맑음·여름·점등 12h)로 뽑는다.
   ⚠ 새 식을 쓰지 않는다. 검사(test_lampswitch F-4)가 보는 값과 같은 값이라야 한다. */
function dliTable(eng, room) {
  return room.slots.map(s => ({
    slotId: s.slotId,
    dli: [0, 1, 2].map(n => eng.dliOfSlot(s.slotId,
      { weather: 'clear', season: 'summer', lampCount: n, litHours: 12 }))
  }));
}

const KEYS = ['banjiha-sill:0', 'banjiha-desk:0', 'banjiha-etagere:6',
              'banjiha-etagere:7', 'banjiha-etagere:8'];

function measure(label, patch) {
  const { eng, room } = build(patch);
  const rig = room.growRigs.find(r => r.uid === 'banjiha-growlight-bar');
  const rows = dliTable(eng, room);
  const at = (id) => rows.find(r => r.slotId === id);
  const sill = at('banjiha-sill:0');
  const grow1 = rows.filter(r => r.dli[1] >= MIN).length;
  const fen1 = rows.filter(r => r.dli[1] >= FEN).length;
  const vfen1 = rows.filter(r => r.dli[1] >= FEN * VMULT).length;
  const over1 = rows.filter(r => r.dli[1] > MAXL).length;
  return {
    label,
    '등 발광점 y': rig ? +rig.pos.y.toFixed(3) : null,
    '창턱 등0': +sill.dli[0].toFixed(2),
    '창턱 등1': +sill.dli[1].toFixed(2),
    '창턱 등2': +sill.dli[2].toFixed(2),
    '책상 등1': +at('banjiha-desk:0').dli[1].toFixed(2),
    '선반맨위 등1': +at('banjiha-etagere:7').dli[1].toFixed(2),
    '등1 자람칸': grow1, '등1 갈라짐칸': fen1, '등1 무늬갈라짐칸': vfen1, '등1 과광칸': over1,
    rows
  };
}

const cands = [
  ['① 지금 (선반 밑 붙박이)', null],
  ['② 창턱 위 0.32m', { x: 0, y: 1.86, z: -1.85 }],
  ['③ 창턱 위 0.46m (원룸과 같은 띄움)', { x: 0, y: 2.00, z: -1.85 }],
  ['④ 창턱 위 0.61m (창 위 벽)', { x: 0, y: 2.15, z: -1.85 }],
  ['⑤ 창턱 위 0.46m · 창 개구부 안(z −1.95)', { x: 0, y: 2.00, z: -1.95 }]
];
if (argv.includes('--y')) cands.length = 0;
if (argv.includes('--y'))
  cands.push([`직접 지정 y=${argOf('--y', 2)} z=${argOf('--z', -1.85)}`,
              { x: argOf('--x', 0), y: argOf('--y', 2), z: argOf('--z', -1.85) }]);

console.log('\n══ G-16 첫 등을 몬스테라 위로 — 후보별 실측 ══');
console.log(`문턱: 자람 ${MIN} · 갈라짐 ${FEN} · 무늬종 갈라짐 ${(FEN * VMULT).toFixed(1)} · 과광 ${MAXL}`);
console.log('창턱(banjiha-sill:0) 이 몬스테라가 가야 할 자리다. 슬롯 y 1.585 · 방 높이 2.3\n');

const out = cands.map(([l, p]) => measure(l, p));
console.table(out.map(({ rows, ...r }) => r));

console.log('\n── 14칸 전체 (등1) ──');
const full = {};
for (const o of out) for (const r of o.rows) {
  full[r.slotId] = full[r.slotId] || { slotId: r.slotId };
  full[r.slotId][o.label] = +r.dli[1].toFixed(2);
}
console.table(Object.values(full));

/* 머리공간 — 등을 창턱 위에 두면 몬스테라가 그 등을 뚫고 자라나 */
const { room: room0 } = build(null);
const CTX = { size: room0.size, occluders: room0.built.occluders, slots: room0.slots, potD: 0.20 };
const sill = room0.slots.find(s => s.slotId === 'banjiha-sill:0');
console.log(`\n창턱 머리공간 ${H.headroomAt({ x: sill.x, y: sill.y, z: sill.z }, CTX).toFixed(3)}m ` +
            `(천장 ${room0.size.h} − 슬롯 ${sill.y})`);
console.log('⚠ 머리공간은 **등을 차폐체로 안 센다**(headroom.js 는 가구·천장만 본다).');
console.log('  등을 창턱 위 0.46m 에 두면 그루가 유효 300일쯤부터 그 자리를 지나간다 — 원룸도 같은 조건이다.\n');
