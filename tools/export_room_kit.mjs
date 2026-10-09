/* ============================================================
   tools/export_room_kit.mjs — 유니티 몫 «모듈 조각»(벽 · 창 구멍 벽 · 문 구멍 벽 · 바닥 · 걸레받이)을
   **치수 그대로** GLB 로 낸다 ([house] · 2026-10-10 · 총괄 «유니티 판이 house 쪽에서 쓸 것» · 크레딧 0)
   ------------------------------------------------------------
     node tools/export_room_kit.mjs            → assets/unity/kit_modules/*.glb + index.json
   왜: 생성 모델(Tripo·Meshy)은 치수가 안 맞아 조각을 짜 맞출 수 없다. 웹 판(house.js)이 쓰는 치수를 그대로 쓴다.
     · 단위 m · 앞(+Z) = 방 안쪽 면 · 벽 두께 0.2(house.js WT)는 z −0.1 ~ +0.1 · 원점 = 바닥 높이 · 가로 가운데
     · 창·문 구멍 크기는 data/house_rooms.json + window/door 프리셋에서 읽는다(손으로 안 적는다)
     · UV = 미터(그 면을 따라 잰 거리) — 유니티에서 겉감 타일링을 «1 / 한 장 m»로 두면 웹과 같은 축척이 된다
       (반지하 벽지 1.5m · 원룸 벽지 1.2m · 마루 1.2m · docs/handoff/house-unity-kit-20261010.md)
   ⚠ 그림(재질)은 한 빛(밝은 회색)만 — 겉감은 유니티에서 4k 그림으로 입힌다. 창틀·문짝은 이미 있는 GLB
     (assets/v2/house/win_studio_cross.glb · win_semi_letterbox.glb · door_wood.glb)를 그 구멍에 끼운다.
============================================================ */
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'assets/unity/kit_modules');
const J = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const H = J('data/house_rooms.json').rooms;
const WT = 0.2;

/* ── 상자 → 면 24꼭짓점(면마다 법선·미터 UV) ── */
function boxGeo(x0, y0, z0, x1, y1, z1) {
  const P = [], N = [], U = [], I = [];
  const face = (corners, n, uAxis, vAxis) => {
    const b = P.length / 3;
    for (const c of corners) { P.push(...c); N.push(...n); U.push(c[uAxis], c[vAxis]); }
    I.push(b, b + 1, b + 2, b, b + 2, b + 3);
  };
  face([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], 0, 1);     // 앞(+Z · 방 쪽)
  face([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [0, 0, -1], 0, 1);    // 뒤
  face([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0], 2, 1);    // 왼
  face([[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [1, 0, 0], 2, 1);     // 오른
  face([[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [0, 1, 0], 0, 2);     // 위
  face([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0], 0, 2);    // 밑
  return { P, N, U, I };
}
function merge(list) {
  const out = { P: [], N: [], U: [], I: [] };
  for (const g of list) { const b = out.P.length / 3; out.P.push(...g.P); out.N.push(...g.N); out.U.push(...g.U); out.I.push(...g.I.map(i => i + b)); }
  return out;
}
/* 벽 한 판(가로 w · 높이 h) — 구멍(가로 가운데 cu · 아래 y0 · 위 y1 · 폭 hw)이 있으면 네 조각(왼·오른 기둥 · 위 인방 · 아래 턱) */
function wallPanel(w, h, hole = null) {
  const z0 = -WT / 2, z1 = WT / 2;
  if (!hole) return boxGeo(-w / 2, 0, z0, w / 2, h, z1);
  const hx0 = hole.cu - hole.w / 2, hx1 = hole.cu + hole.w / 2, hy0 = hole.y0, hy1 = hole.y1;
  const parts = [boxGeo(-w / 2, 0, z0, hx0, h, z1), boxGeo(hx1, 0, z0, w / 2, h, z1)];
  if (hy1 < h - 1e-6) parts.push(boxGeo(hx0, hy1, z0, hx1, h, z1));
  if (hy0 > 1e-6) parts.push(boxGeo(hx0, 0, z0, hx1, hy0, z1));
  return merge(parts);
}

/* ── GLB 쓰기(메시 하나 · 재질 하나) ── */
function writeGlb(file, geo, name, rgba = [0.86, 0.85, 0.83, 1]) {
  const f32 = a => Buffer.from(new Float32Array(a).buffer), u32 = a => Buffer.from(new Uint32Array(a).buffer);
  const pos = f32(geo.P), nor = f32(geo.N), uv = f32(geo.U), idx = u32(geo.I);
  const pad4 = b => Buffer.concat([b, Buffer.alloc((4 - (b.length % 4)) % 4)]);
  const bufs = [pos, nor, uv, idx].map(pad4);
  let off = 0; const views = bufs.map((b, i) => { const v = { buffer: 0, byteOffset: off, byteLength: [pos, nor, uv, idx][i].length, ...(i < 3 ? { target: 34962 } : { target: 34963 }) }; off += b.length; return v; });
  const n = geo.P.length / 3;
  const mn = [0, 1, 2].map(k => Math.min(...geo.P.filter((_, i) => i % 3 === k))), mx = [0, 1, 2].map(k => Math.max(...geo.P.filter((_, i) => i % 3 === k)));
  const json = {
    asset: { version: '2.0', generator: 'lux-plant-sim tools/export_room_kit.mjs (house)' },
    scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, name }],
    meshes: [{ name, primitives: [{ attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 }, indices: 3, material: 0 }] }],
    materials: [{ name: name + '_mat', pbrMetallicRoughness: { baseColorFactor: rgba, metallicFactor: 0, roughnessFactor: 0.9 } }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: n, type: 'VEC3', min: mn, max: mx },
      { bufferView: 1, componentType: 5126, count: n, type: 'VEC3' },
      { bufferView: 2, componentType: 5126, count: n, type: 'VEC2' },
      { bufferView: 3, componentType: 5125, count: geo.I.length, type: 'SCALAR' }],
    bufferViews: views, buffers: [{ byteLength: off }],
  };
  let js = Buffer.from(JSON.stringify(json)); js = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
  const bin = Buffer.concat(bufs);
  const head = Buffer.alloc(12); head.writeUInt32LE(0x46546C67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + bin.length, 8);
  const ch = (len, type) => { const b = Buffer.alloc(8); b.writeUInt32LE(len, 0); b.writeUInt32LE(type, 4); return b; };
  fs.writeFileSync(file, Buffer.concat([head, ch(js.length, 0x4E4F534A), js, ch(bin.length, 0x004E4942), bin]));
  return { file: path.relative(ROOT, file).replace(/\\/g, '/'), tris: geo.I.length / 3, size: mx.map((v, k) => +(v - mn[k]).toFixed(3)) };
}

fs.mkdirSync(OUT, { recursive: true });
const made = [];
const put = (id, geo, note) => { const r = writeGlb(path.join(OUT, id + '.glb'), geo, id); made.push({ id, ...r, note }); };
/* 벽 높이 — 방 데이터에서(반지하 2.3 · 원룸·투룸 2.5) */
const heights = [...new Set(['banjiha', 'oneroom', 'tworoom'].map(k => H[k].size.h))];
for (const h of heights) {
  for (const w of [1.0, 0.5]) put(`wall_${w}m_h${h}`, wallPanel(w, h), `민벽 ${w}m · 높이 ${h}m · 두께 ${WT}`);
}
/* 창 구멍 벽 — 방 데이터의 창(가운데 cy · 크기 w×h) 그대로, 판은 구멍 양옆 0.3m 씩 */
for (const [room, preset] of [['banjiha', 'win_semi_letterbox'], ['oneroom', 'win_studio_cross']]) {
  const R = H[room], win = R.windows.find(x => x.preset === preset), h = R.size.h;
  const w = +(win.w + 0.6).toFixed(3);
  put(`wall_window_${preset}_h${h}`, wallPanel(w, h, { cu: 0, w: win.w, y0: win.cy - win.h / 2, y1: win.cy + win.h / 2 }),
      `${room} 창 구멍 ${win.w}×${win.h} · 아랫변 ${(win.cy - win.h / 2).toFixed(3)} · 판 ${w}m · 창틀 GLB assets/v2/house/${preset}.glb`);
}
/* 문 구멍 벽 */
for (const room of ['banjiha', 'oneroom']) {
  const R = H[room], d = R.doors[0], h = R.size.h, w = +(d.w + 0.6).toFixed(3);
  put(`wall_door_${room}_h${h}`, wallPanel(w, h, { cu: 0, w: d.w, y0: 0, y1: d.h }), `${room} 문 구멍 ${d.w}×${d.h} · 판 ${w}m · 문짝 GLB assets/v2/house/door_wood.glb`);
}
put('floor_1x1', boxGeo(-0.5, -0.02, -0.5, 0.5, 0, 0.5), '바닥 1×1m · 윗면 y=0 · 두께 0.02');
put('ceiling_1x1', boxGeo(-0.5, 0, -0.5, 0.5, 0.02, 0.5), '천장 1×1m · 밑면 y=0(방 높이에 올린다)');
put('skirting_1m', boxGeo(-0.5, 0, 0, 0.5, 0.075, 0.012), '걸레받이 1m · 높이 0.075(웹 판 baseH) · 벽 앞면(z=+0.1)에 붙인다');
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify({ _what: '[house] 유니티 모듈 조각 — tools/export_room_kit.mjs · 단위 m · 앞 +Z(방 쪽) · 벽 두께 0.2 · UV 미터', made }, null, 1) + '\n');
for (const m of made) console.log(`${m.id.padEnd(34)} ${String(m.tris).padStart(4)}면  ${m.size.join('×')}  ${m.note}`);
