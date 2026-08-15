/* ============================================================
   tools/test_pots.mjs — 화분 종류: 지름을 **실제로 재고**, 자리 수를 못 박고,
                          옛 판(화분 하나)이 한 톨도 안 바뀌는지를 지킨다
   ------------------------------------------------------------
     node tools/test_pots.mjs          ← 화면도 서버도 필요 없다

   ★ 왜 크롬을 안 띄우나. 재려는 것이 「GLB 안의 꼭짓점」이라 렌더러가 필요 없다.
     크롬을 띄우면 이 셈이 맞는지가 아니라 **크롬이 뜨는지**를 재게 된다
     (tools/test_snap.mjs 가 같은 이유로 화면을 안 띄운다).

   ══ 무엇을 증명하나 ═════════════════════════════════════════════════════
     A  지름은 **잰 값이다.** GLB 를 직접 열어 `2 × max √(x²+z²)` 를 재고
        매니페스트의 `scale_to_real` 을 곱해 0.1mm 로 올린다. 그 값이 shop.POT_KINDS 와 같다
     B  색 판(민트·핑크)은 **지오메트리가 같아 지름이 같다** — 색은 자리를 못 바꾼다
     C  자리 — 반지하 14칸에서 종류마다 몇 칸에 올라가나. **네모 화분만 4칸이다**
     D  바꿔 끼기 규칙 — 재고·자리·같은 화분·색 바꾸기
     E  ★★ **회귀.** 옛 판(화분 하나)이 한 톨도 안 바뀐다. 이게 제일 중요하다

   ⚠ 이 검사가 재는 지름은 `room_view.rotationSafeDiameter` 와 **같은 정의**다.
     bbox 로 재면 안 된다 — `pot_concrete_square` 는 bbox 0.20 이라 창턱 0.21 을
     통과하는 것처럼 보이는데 대각선이 0.2755 라 실제로는 못 올라간다
     (core-to-house.md 2026-08-02 ④). 검사 A 가 그 차이를 숫자로 남긴다.
============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CATALOG, buyPriceOf, catalogList, cropBreakEvenRate,
  POT_KINDS, potKindList, potDiameterOf, potKindOfAsset, potColorOfAsset,
  knowsPotAsset, potSlotCount, canSwapPot, DEFAULT_POT_ASSET, ceilPotDiameter,
  createShopState
} from '../src/game/shop.js';
import { newState, givePlant, pot0, ARRIVAL } from '../src/game/state.js';
import { FIRST_PLAY_ASSETS, slotFitsDiameter } from '../src/game/first_play.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log(`PASS  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}${detail ? '\n      → ' + detail : ''}`); }
};
const info = (s) => console.log(`      ${s}`);
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

/* ============================================================
   GLB 를 직접 읽는다 — 의존성 0 (이 저장소에는 node_modules 가 없다)
   ------------------------------------------------------------
   glTF 2.0 바이너리는 헤더 12바이트 뒤에 청크가 이어진다. 각 청크는
   [길이 4][종류 4][내용] 이고 길이는 이미 4바이트 정렬돼 있다.
============================================================ */
function readGlb(file) {
  const b = fs.readFileSync(file);
  if (b.readUInt32LE(0) !== 0x46546C67) throw new Error(`glTF 가 아닙니다: ${file}`);
  let off = 12, json = null, bin = null;
  while (off + 8 <= b.length) {
    const len = b.readUInt32LE(off), type = b.readUInt32LE(off + 4);
    const chunk = b.subarray(off + 8, off + 8 + len);
    if (type === 0x4E4F534A) json = JSON.parse(chunk.toString('utf8'));      // 'JSON'
    else if (type === 0x004E4942) bin = chunk;                               // 'BIN\0'
    off += 8 + len;
  }
  if (!json) throw new Error(`JSON 청크가 없습니다: ${file}`);
  return { json, bin };
}

const NCOMP = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
const CBYTES = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };

/* POSITION 접근자를 float 셋씩 읽는다. 좌표는 규약상 늘 float32 다. */
function readPositions(g, bin, accIdx) {
  const acc = g.accessors[accIdx];
  if (acc.componentType !== 5126 || acc.type !== 'VEC3')
    throw new Error(`POSITION 이 float VEC3 가 아닙니다 (${acc.componentType}/${acc.type})`);
  const bv = g.bufferViews[acc.bufferView];
  const base = (bv.byteOffset || 0) + (acc.byteOffset || 0);
  const stride = bv.byteStride || NCOMP[acc.type] * CBYTES[acc.componentType];
  const dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
  const out = new Float64Array(acc.count * 3);
  for (let i = 0; i < acc.count; i++) {
    const o = base + i * stride;
    out[i * 3] = dv.getFloat32(o, true);
    out[i * 3 + 1] = dv.getFloat32(o + 4, true);
    out[i * 3 + 2] = dv.getFloat32(o + 8, true);
  }
  return out;
}

/* 열 우선 4×4 — glTF 의 `matrix` 규약과 같다(THREE 도 같다) */
function mul(a, b) {
  const o = new Float64Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
    o[c * 4 + r] = s;
  }
  return o;
}
const IDENT = () => new Float64Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);

function nodeMatrix(node) {
  if (node.matrix) return Float64Array.from(node.matrix);
  const t = node.translation || [0, 0, 0];
  const [x, y, z, w] = node.rotation || [0, 0, 0, 1];
  const s = node.scale || [1, 1, 1];
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2;
  const yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;
  const m = new Float64Array(16);
  m[0] = (1 - (yy + zz)) * s[0]; m[1] = (xy + wz) * s[0];     m[2] = (xz - wy) * s[0];
  m[4] = (xy - wz) * s[1];       m[5] = (1 - (xx + zz)) * s[1]; m[6] = (yz + wx) * s[1];
  m[8] = (xz + wy) * s[2];       m[9] = (yz - wx) * s[2];     m[10] = (1 - (xx + yy)) * s[2];
  m[12] = t[0]; m[13] = t[1]; m[14] = t[2]; m[15] = 1;
  return m;
}

/* ★ 회전 무관 지름 = 2 × max √(x²+z²)  (room_view.rotationSafeDiameter 와 같은 정의).
   같이 bbox 도 낸다 — 「bbox 로 재면 왜 안 되나」를 검사가 숫자로 보여 주기 위해서다. */
function measureGlb(file) {
  const { json: g, bin } = readGlb(file);
  let maxR2 = 0;
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  const scene = g.scenes[g.scene ?? 0];
  const walk = (ni, parent) => {
    const node = g.nodes[ni];
    const m = mul(parent, nodeMatrix(node));
    if (node.mesh != null) {
      for (const prim of g.meshes[node.mesh].primitives) {
        if (prim.attributes.POSITION == null) continue;
        const p = readPositions(g, bin, prim.attributes.POSITION);
        for (let i = 0; i < p.length; i += 3) {
          const x = p[i], y = p[i + 1], z = p[i + 2];
          const wx = m[0] * x + m[4] * y + m[8] * z + m[12];
          const wz = m[2] * x + m[6] * y + m[10] * z + m[14];
          const r2 = wx * wx + wz * wz;
          if (r2 > maxR2) maxR2 = r2;
          if (wx < minX) minX = wx; if (wx > maxX) maxX = wx;
          if (wz < minZ) minZ = wz; if (wz > maxZ) maxZ = wz;
        }
      }
    }
    for (const c of node.children || []) walk(c, m);
  };
  for (const ni of scene.nodes) walk(ni, IDENT());
  return { rotD: 2 * Math.sqrt(maxR2), bboxMax: Math.max(maxX - minX, maxZ - minZ) };
}

/* 매니페스트의 배율. **여기서 지어내지 않는다** — 없으면 그 화분은 못 잰 것이다. */
const MANIFEST = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'manifest.json'), 'utf8'));
function scaleToRealOf(assetPath) {
  const it = MANIFEST.items.find(x => x && x.path === assetPath);
  if (!it) throw new Error(`매니페스트에 없는 에셋입니다: ${assetPath}`);
  if (!Number.isFinite(it.scale_to_real))
    throw new Error(`${assetPath} 에 scale_to_real 이 없습니다 — 실제 크기를 못 잽니다`);
  return it.scale_to_real;
}
/* 실제 세계의 회전 무관 지름[m] */
function realRotDiameter(assetPath) {
  const m = measureGlb(path.join(ROOT, 'assets', assetPath));
  const k = scaleToRealOf(assetPath);
  return { real: m.rotD * k, raw: m.rotD, k, bboxReal: m.bboxMax * k };
}

/* ══ A 지름을 실제로 잰다 ═══════════════════════════════════════════════════ */
console.log('\n══ A  지름 — GLB 를 열어 직접 잰다 ══════════════════════════════════');
{
  for (const k of Object.values(POT_KINDS)) {
    const m = realRotDiameter(k.asset);
    ok(`A-1 ${k.ko} — 표의 지름이 잰 값과 같다`,
       near(k.measuredM, m.real, 5e-7) && near(k.diameterM, ceilPotDiameter(m.real)),
       `표 measuredM ${k.measuredM} / 잰 값 ${m.real.toFixed(6)} · ` +
       `표 diameterM ${k.diameterM} / 올림 ${ceilPotDiameter(m.real)}`);
    info(`${k.ko}: 원본 ${m.raw.toFixed(4)} × ${m.k} = ${m.real.toFixed(6)} m ` +
         `→ ${k.diameterM} m (bbox 로 재면 ${m.bboxReal.toFixed(4)})`);
  }
  /* ★ 네모 화분 — bbox 와 실제 지름이 갈리는 그 자리를 못 박는다.
     이게 안 갈리면 회전 무관 지름을 쓸 이유가 없어진다. */
  const sq = realRotDiameter(POT_KINDS.concrete_square.asset);
  ok('A-2 ★ 네모 화분은 bbox 로 재면 창턱(0.21)을 통과한다 — 대각선으로는 못 통과한다',
     sq.bboxReal <= 0.21 && sq.real > 0.21,
     `bbox ${sq.bboxReal.toFixed(4)} · 회전 무관 ${sq.real.toFixed(4)}`);
  /* 잰 값이 매니페스트가 적어 둔 real_max_m 과 크게 어긋나면 그건 배율이 틀린 것이다 */
  for (const k of Object.values(POT_KINDS)) {
    const it = MANIFEST.items.find(x => x.path === k.asset);
    ok(`A-3 ${k.ko} — 매니페스트 real_max_m 과 40% 안에서 맞는다 (배율이 맞다는 검산)`,
       Math.abs(k.diameterM - it.real_max_m) / it.real_max_m < 0.4,
       `표 ${k.diameterM} / real_max_m ${it.real_max_m}`);
  }
}

/* ══ B 색은 지름을 못 바꾼다 ════════════════════════════════════════════════ */
console.log('\n══ B  색 — 다시 칠한 판은 지오메트리가 같다 ═════════════════════════');
{
  for (const k of Object.values(POT_KINDS)) {
    for (const c of k.colors) {
      const m = realRotDiameter(c.asset);
      ok(`B-1 ${k.ko}/${c.ko} — 지름이 기본 판과 같다`,
         near(ceilPotDiameter(m.real), k.diameterM),
         `${ceilPotDiameter(m.real)} ≠ ${k.diameterM}`);
      ok(`B-2 ${k.ko}/${c.ko} — potDiameterOf 가 같은 값을 낸다`,
         near(potDiameterOf(c.asset), k.diameterM));
    }
  }
  ok('B-3 색 에셋도 제 종류를 안다', Object.values(POT_KINDS).every(
    k => k.colors.every(c => potKindOfAsset(c.asset) === k && potColorOfAsset(c.asset) === c)));
  ok('B-4 모르는 에셋은 **던진다** (조용히 기본 지름으로 안 떨어진다)',
     (() => { try { potDiameterOf('pots/없는화분.glb'); return false; } catch { return true; } })());
  ok('B-5 매달리는 화분·수경병은 표에 없다 (놓을 자리가 없거나 화분이 아니다)',
     !knowsPotAsset('pots/pot_macrame_hanging.glb') && !knowsPotAsset('pots/pot_glassjar.glb'));
}

/* ══ C 자리 — 반지하 14칸 ══════════════════════════════════════════════════ */
console.log('\n══ C  자리 — 지름이 바뀌면 놓을 수 있는 자리가 바뀐다 ═══════════════');
const PROFILE = JSON.parse(fs.readFileSync(
  path.join(ROOT, 'data', 'profiles', 'room_profile.banjiha.json'), 'utf8'));
const SLOTS = PROFILE.slots;
{
  ok('C-0 반지하 프로파일이 14칸이고 전부 maxPotD 를 갖고 있다',
     SLOTS.length === 14 && SLOTS.every(s => Number.isFinite(s.maxPotD)),
     `${SLOTS.length}칸`);
  const limits = {};
  for (const s of SLOTS) limits[s.maxPotD] = (limits[s.maxPotD] || 0) + 1;
  info('한도별 칸 수: ' + Object.entries(limits).map(([d, n]) => `${d}m ×${n}`).join(' · '));

  /* ★ 못 박는 표. 숫자를 여기 지어내지 않았다 — 위 A 가 잰 지름과 프로파일의 maxPotD 로만 난다. */
  const EXPECT = { nursery: 14, concrete_round: 14, terracotta: 14, ceramic: 14, concrete_square: 4 };
  for (const k of Object.values(POT_KINDS)) {
    const n = potSlotCount(k.diameterM, SLOTS);
    ok(`C-1 ${k.ko}(${k.diameterM}m) 가 올라가는 자리 ${EXPECT[k.id]}칸`,
       n === EXPECT[k.id], `${n}칸`);
  }
  const sill = SLOTS.find(s => s.slotId === 'banjiha-sill:0');
  ok('C-2 ★ 창턱(0.21m · 이 방에서 제일 밝은 자리)을 잃는 것은 네모 화분뿐이다',
     Object.values(POT_KINDS).filter(k => !slotFitsDiameter(sill, k.diameterM))
       .map(k => k.id).join(',') === 'concrete_square');
  info('★ 지금 있는 에셋으로는 자리 수가 14 아니면 4 둘뿐이다 — ' +
       '창턱만 잃는 중간(13칸·지름 0.21~0.25)에 해당하는 화분이 없다');
}

/* ══ D 바꿔 끼기 규칙 ══════════════════════════════════════════════════════ */
console.log('\n══ D  바꿔 끼기 — 무엇을 막고 무엇을 허용하나 ═══════════════════════');
{
  const stubGrowth = { growth: { setGrowth: () => ({ drawn: true }), has: (k) => k === 'setGrowth' } };
  const mk = (slotId) => {
    const S = newState({ room: 'banjiha', mode: 'novice' });
    givePlant(S, stubGrowth, { slotId });
    return S;
  };
  const give = (S, itemId, n = 1) => { S.shop = S.shop || createShopState();
                                       S.shop.stock[itemId] = (S.shop.stock[itemId] || 0) + n; };

  const S1 = mk('banjiha-sill:0');
  ok('D-1 재고가 없으면 못 바꾼다',
     canSwapPot(S1, 'pots/pot_concrete_round.glb', { slots: SLOTS }).ok === false);
  give(S1, 'pot_concrete_round');
  const r1 = canSwapPot(S1, 'pots/pot_concrete_round.glb', { slots: SLOTS });
  ok('D-2 재고가 있고 가늘어지는 쪽이면 창턱에서도 바꾼다', r1.ok === true, r1.reason);
  ok('D-2b 어디로 가는지도 같이 말한다 (지름·자리 수)',
     r1.diameterM === 0.1801 && r1.holdCount === 14 && r1.fromDiameterM === 0.202);

  const S2 = mk('banjiha-sill:0');
  give(S2, 'pot_concrete_square');
  const r2 = canSwapPot(S2, 'pots/pot_concrete_square.glb', { slots: SLOTS });
  ok('D-3 ★ 창턱에서 네모 화분으로는 **못 바꾼다** (몰래 옮기지도 않는다)',
     r2.ok === false && r2.wider === true && r2.holdCount === 4, JSON.stringify(r2));
  ok('D-3b 왜 안 되는지와 어디에는 되는지를 같이 말한다',
     /안 올라갑니다/.test(r2.reason) && /4칸/.test(r2.reason), r2.reason);
  ok('D-3c ★ 자리는 안 건드린다 — 판정만 하고 상태를 안 바꾼다',
     pot0(S2).potAsset === DEFAULT_POT_ASSET && pot0(S2).slotId === 'banjiha-sill:0');

  const S3 = mk('banjiha-desk:0');                 // 한도 0.57
  give(S3, 'pot_concrete_square');
  ok('D-4 책상(0.57m)에서는 네모 화분으로 바꾼다',
     canSwapPot(S3, 'pots/pot_concrete_square.glb', { slots: SLOTS }).ok === true);

  const S4 = mk('banjiha-sill:0');
  give(S4, 'pot_ceramic');
  ok('D-5 ★ 색만 바꾸는 것은 창턱에서도 된다 (지름이 그대로다)',
     canSwapPot(S4, 'monstera/pot_c1.glb', { slots: SLOTS }).ok === true);
  ok('D-6 같은 화분으로는 못 바꾼다', canSwapPot(S4, DEFAULT_POT_ASSET, { slots: SLOTS }).ok === false);
  ok('D-7 슬롯을 안 주면 「자리는 안 봤다」고 말한다 (봤다고 하지 않는다)',
     canSwapPot(S4, 'monstera/pot_c1.glb').fits === null);
  ok('D-8 그루가 없으면 못 바꾼다',
     canSwapPot(newState({ room: 'banjiha' }), 'monstera/pot_c1.glb').ok === false);
}

/* ══ E ★★ 회귀 — 옛 판이 한 톨도 안 바뀐다 ═══════════════════════════════ */
console.log('\n══ E  ★★ 회귀 — 화분 하나였던 판이 그대로인가 ═══════════════════════');
{
  ok('E-1 도착 화분 에셋이 그대로다', ARRIVAL.potAsset === 'monstera/pot.glb'
     && DEFAULT_POT_ASSET === ARRIVAL.potAsset,
     `${ARRIVAL.potAsset} / ${DEFAULT_POT_ASSET}`);
  ok('E-2 ★ 도착 화분의 지름이 예전 상수와 **한 자리도 안 다르다**',
     potDiameterOf(ARRIVAL.potAsset) === FIRST_PLAY_ASSETS.monsteraPotDiameterM
     && FIRST_PLAY_ASSETS.monsteraPotDiameterM === 0.202,
     `${potDiameterOf(ARRIVAL.potAsset)} / ${FIRST_PLAY_ASSETS.monsteraPotDiameterM}`);
  ok('E-3 potAsset 이 없는 아주 옛 세이브도 같은 지름이 된다', potDiameterOf(null) === 0.202);

  /* 기존 일곱 품목 — id·이름·정가·배송·사는 값을 통째로 못 박는다.
     ⚠ 이 표는 **손으로 적은 기대값**이다. 카탈로그에서 베껴 오면 검사가 아무것도 안 지킨다. */
  /* ★★ 2026-08-09 박사님 확정으로 두 줄이 움직였다 — **실구매가 기준으로 정하신 값**이다.
       콩 씨앗  정가 500 → **350** · 실구매 700 → **500**
       시루     정가 5,000 → **3,550** · 실구매 7,000 → **5,000**
     ⚠ 시루 정가가 3,500 이 아닌 이유 — 3,500 × 1.4 = 4,900 이고 4,900 은 이미 100원 단위라
       올림이 아무 일도 안 한다(실구매 4,900원이 된다). 5,000원을 내는 정가는
       3,500 < L ≤ 3,571 구간이고 3,550 이 그 안이다. `tools/test_econ.mjs §D` 가 같이 잰다.
     ★ 나머지 다섯 줄은 한 글자도 안 움직였다 — 그게 이 표가 지키는 것이다. */
  const BEFORE = [
    ['bean_seed',    '콩 씨앗 (1시루분)',      350, 1,  500],
    ['monstera_seed', '몬스테라 씨앗 (1립)',   1500, 1, 2100],
    ['siru',         '콩나물 시루 (차광 용기)', 3550, 2, 5000],
    ['pot',          '검은 모종포트',           5000, 2, 7000],
    ['jar',          '유리 수경병',             5000, 2, 7000],
    ['radish_seed',  '무 씨앗 (1판분)',          400, 1,  600],
    ['sprout_tray',  '새싹 재배판',             3000, 2, 4200]
  ];
  for (const [id, ko, listWon, leadDays, buyWon] of BEFORE) {
    const it = CATALOG[id];
    ok(`E-4 ${ko} — 값·배송이 그대로다`,
       !!it && it.ko === ko && it.listWon === listWon && it.leadDays === leadDays
       && buyPriceOf(id) === buyWon,
       it ? `${it.ko} ${it.listWon}/${it.leadDays}일/${buyPriceOf(id)}원` : '품목이 사라졌습니다');
  }
  ok('E-5 옛 품목이 하나도 안 사라졌고, 늘어난 것은 화분 넷뿐이다',
     catalogList().length === BEFORE.length + 4
     && ['pot_concrete_round', 'pot_terracotta', 'pot_ceramic', 'pot_concrete_square']
          .every(id => !!CATALOG[id]),
     `${catalogList().length}품목`);
  /* ★★ 2026-08-09 — **두 작물이 반대로 움직였다.**
       콩나물 700/3,000 = 23.3% → **500/3,000 = 16.7%**   (씨앗이 싸졌다)
       무순   600/2,000 = 30.0% → **600/1,867 = 32.1%**   (회전분이 2,800 × 질림 2/3 로 내려갔다)
     기대값을 여기 손으로 적는 규약은 그대로다 — 카탈로그에서 베껴 오면 아무것도 안 지킨다.

     ★★ 2026-08-16 — **콩나물만 또 움직였다.** 박사님이 수확을 그램으로 정하셨다:
       *"중간빛에서 300G고 좀더 어두울수록 +-100G"* · 10원 = 1g.
       ⇒ 콩나물 한 회전분(제일 좋은 경우 = **어두운 자리** 400g)이 **3,000 → 4,000원**.
         손익분기 **500/3,000 = 16.7% → 500/4,000 = 12.5%** (씨앗 건지기가 쉬워졌다)
       ⚠ **무순은 한 푼도 안 움직였다** — 1,867원은 10 으로 안 나누어떨어져서 그램을
         정본으로 삼으면 하루 몫이 조용히 밀린다(START-HERE §2.8 이 겪은 사고).
         그래서 무순은 원이 정본이고 g 은 표시다. 아래 줄이 그것을 지킨다.
       ★ 이 오름(+33%)은 **회귀가 아니라 박사님이 정하신 값**이다. 다만 값어치가 얕아지는
         쪽 지적이 있어 `bagcrop-to-plan.md §판단필요 1` 에 적어 뒀다. */
  ok('E-6 손익분기 — 씨앗값과 회전분이 움직인 만큼만 움직였다',
     near(cropBreakEvenRate('beansprout'), 500 / 4000, 1e-12)
     && near(cropBreakEvenRate('musun'), 600 / 1867, 1e-3),
     `${cropBreakEvenRate('beansprout')} / ${cropBreakEvenRate('musun')}`);

  /* 도착 자체 — 화분이 예전과 같은 모양으로 생긴다 */
  const stubGrowth = { growth: { setGrowth: () => ({ drawn: true }), has: (k) => k === 'setGrowth' } };
  const S = newState({ room: 'banjiha', mode: 'novice' });
  const p = givePlant(S, stubGrowth, { slotId: 'banjiha-sill:0' });
  ok('E-7 갓 도착한 화분이 예전 그대로다 (에셋·자리·지름)',
     p.potAsset === 'monstera/pot.glb' && p.slotId === 'banjiha-sill:0'
     && potDiameterOf(p.potAsset) === 0.202);
  ok('E-8 ★ 화분이 하나뿐인 판에서 자리 수가 예전과 같다 (14칸)',
     potSlotCount(potDiameterOf(p.potAsset), SLOTS) === 14
     && SLOTS.filter(s => slotFitsDiameter(s, FIRST_PLAY_ASSETS.monsteraPotDiameterM)).length === 14);

  /* 화분 넷을 늘렸다고 **재고가 저절로 생기지 않는다** — 새 판은 예전처럼 빈손이다 */
  ok('E-9 새 판의 재고가 그대로 비어 있다',
     Object.keys((S.shop && S.shop.stock) || {}).length === 0);
  ok('E-10 새 화분은 주문해야만 생긴다 (기본 소지품이 아니다)',
     canSwapPot(S, 'pots/pot_terracotta_wood.glb', { slots: SLOTS }).ok === false);
}

/* ══ 표 — 인계에 그대로 옮길 값 ═════════════════════════════════════════════ */
console.log('\n══ 화분 표 (잰 값) ══════════════════════════════════════════════════');
console.log('종류 | 한글 이름 | 잰 지름[m] | 표의 지름[m] | 살 때 | 반지하 자리 | 색');
for (const k of potKindList())
  console.log(`${k.id} | ${k.ko} | ${k.measuredM.toFixed(6)} | ${k.diameterM} | ` +
    `${k.buyWon.toLocaleString()}원 | ${potSlotCount(k.diameterM, SLOTS)}/14칸 | ` +
    k.colors.map(c => c.ko).join('·'));

console.log(`\npots: ${fail ? 'FAIL' : 'PASS'}  (${pass}/${pass + fail})`);
process.exit(fail ? 1 : 0);
