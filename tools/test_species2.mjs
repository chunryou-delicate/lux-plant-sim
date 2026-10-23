/* tools/test_species2.mjs — D71 새 두 종(스킨답서스 · 칼라테아)을 가게 판에 잇는 코어 뼈대(core · 2026-10-23 · 노드만)
   ⚠ growth 규칙(species_growth 의 SC · CA)이 오기 전 — 맞춘 입구(10-23 growth 회신 «최종 이름») 꼴의 **가짜 두 종**을 진짜 PP·AL 규칙 옆에 끼워 잰다.
     진짜가 오면 FAKE=0 으로 진짜 규칙을 잰다(가짜 칸이 진짜와 어긋나면 여기서 드러난다).
   A sc_ask — 단골 5 날 · 4 면 안 남 · 상점 «줄기 삽수» 진열 · special 손님은 주문 손님으로 안 뽑힘
   B ca_care — 단골 8 · sc_ask 이튿날부터(하루 하나) · 맡은 그루 = 가방 · 잎 다 말림 · 못 판다 · 주문 후보 아님 · 곁줄 칸 caCareOpen
   C ca_saved — 말린 잎 0 인 날 · 가게 것(팔 수 있음) · caSaved · 그 손님 «고맙다» 줄
   D 규칙이 그 종을 모르면 — 단골 10 이어도 사건 없음 · 상점에 안 뜸
   E 주문 sc_cutting · sc_pot — 원천(보낼 수 있는 수) · 마디 둘 · 길이 = 가장 긴 줄기 + 한 칸 · 어려움은 높은 자리 있을 때만 · 자리 모르면 안 냄 · 겨울 가드
   F 주문 ca_pot — 알맞은 자리가 있을 때만 · 말린 잎 · 맡은 그루는 후보 밖 · 어려움 «한 달 내내 말린 잎 없음»
   G 값 — SC 마디 × 마디값(그루 ×1.4 · 물꽂이 ×1.0) · CA 펴진 잎 × 잎값
   H 하루(stepSpecies) — 자라는 SC 는 받침 높이(dropM)를 넘김 · 못 재면 건너뜀 · 첫 뿌리만 sc_rooted · caPlants · caTooBright · flatSince
   I 자르기 — SC 도 같은 손(잘린 끝 = 물꽂이 줄기 삽수) · 물꽂이 중엔 못 자름
   J 스냅샷 scPlants · scLongVine · 세이브 왕복(care · flatSince · 가게 칸) · 옛 세이브(칸 없음)
   ★ 판은 «날을 걸어» 세운다(walk — 그루를 놓고 그 빛으로 하루씩). 그루 속 칸(잎 말림 · 줄기 길이)을 손으로 고치지 않는다 —
     그 칸은 growth 것이라 가짜와 진짜가 꼴이 다르다(10-23 FAKE=0 첫 판에서 넷이 «검사 손질» 탓으로 빨갰다) */
import assert from 'node:assert';
import fs from 'node:fs';
import * as JS from '../src/game/job_shop.js';
import * as SP from '../src/game/species.js';
import { createSpeciesRules } from '../src/growth/species_growth.js';

const FAKE = process.env.FAKE !== '0';
let bad = 0;
const T = (name, fn) => { try { fn(); console.log('PASS ', name); } catch (e) { bad++; console.log('FAIL ', name, '\n     ', e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e); } };

/* ── 가짜 두 종 — growth 회신 꼴(newPlant · stepDay{dli,season,dropM} · summary · leafRows · cutAbove · 수 함수) ── */
/* REAL = 지금 저장소의 규칙 · BASE = PP·AL 만(두 종을 모르는 판 — D · 가짜의 PP·AL 몫) */
const SPEC = JSON.parse(fs.readFileSync('data/growth_species.json', 'utf8')), TH = JSON.parse(fs.readFileSync('data/balance/light_thresholds.json', 'utf8'));
const REAL = createSpeciesRules(SPEC, TH);
const BASE = createSpeciesRules({ ...SPEC, species: Object.fromEntries(Object.entries(SPEC.species).filter(([k]) => k === 'pink_princess' || k === 'alocasia_frydek')) }, TH);
const F = { high: 0.75, over: 0.15, inter: 0.06, root: 12, gap: 13, lo: 3, hi: 8 };
const isFake = sp => sp === 'scindapsus' || sp === 'calathea';
const avg = p => p.hist.length ? p.hist.reduce((a, v) => a + v, 0) / p.hist.length : 0;
const fakeRules = {
  ...BASE,
  species: () => [...BASE.species(), 'scindapsus', 'calathea'],
  newPlant(sp, o = {}) {
    if (!isFake(sp)) return BASE.newPlant(sp, o);
    const base = { schema: 'species/1', species: sp, seed: (o.seed ?? 1) >>> 0, day: 0, step: 0, hist: [], births: 0 };
    if (sp === 'scindapsus') {
      const n = o.nodes ?? 2;
      return { ...base, phase: o.form === 'rooted' ? 'growing' : 'cutting', rootDays: 0, leaves: Array.from({ length: n }, (_, i) => ({ no: i + 1, born: 0, stage: 'young' })), lengthM: +(n * F.inter).toFixed(3) };
    }
    const n = o.leaves ?? 4, c = o.curled === 'all' || o.curled == null ? n : o.curled;
    return { ...base, leaves: Array.from({ length: n }, (_, i) => ({ no: i + 1, born: 0, stage: 'mature', curled: i < c })) };
  },
  assertPlant(p) { if (p && isFake(p.species)) { if (p.schema !== 'species/1' || !Array.isArray(p.leaves)) throw new Error('깨진 가짜 그루'); return p; } return BASE.assertPlant(p); },
  stepDay(p, o = {}) {
    if (!isFake(p.species)) return BASE.stepDay(p, o);
    if (!Number.isFinite(o.dli)) throw new Error('DLI 없음');
    p.day += 1; p.hist.push(o.dli); if (p.hist.length > 7) p.hist.shift();
    const ev = [];
    if (p.species === 'scindapsus') {
      if (p.phase === 'cutting') { p.rootDays += 1; if (p.rootDays >= F.root) { p.phase = 'growing'; p.step = 0; ev.push({ type: 'rooted' }); } return ev; }
      if (!Number.isFinite(o.dropM)) throw new Error('[가짜 SC] dropM 이 없다');
      const cap = fakeRules.scStemCapM(o.dropM);
      if (++p.step >= F.gap) { p.step = 0; const no = p.leaves.length + 1; p.leaves.push({ no, born: p.day, stage: 'young' }); ev.push({ type: 'node', no, lengthM: p.lengthM }); }
      const was = p.lengthM; p.lengthM = +Math.min(cap, Math.max(p.lengthM, p.lengthM + F.inter / F.gap)).toFixed(4);
      if (was < cap && p.lengthM >= cap) ev.push({ type: 'reached_floor', lengthM: p.lengthM });
      return ev;
    }
    const a = avg(p);
    if (a > F.hi) { const l = p.leaves.find(x => !x.curled); if (l) { l.curled = true; ev.push({ type: 'curl', curled: p.leaves.filter(x => x.curled).length }); } }
    else if (a >= F.lo) { const l = p.leaves.find(x => x.curled); if (l) { l.curled = false; const c = p.leaves.filter(x => x.curled).length; ev.push({ type: 'unfurl', no: l.no, curled: c }); if (!c) ev.push({ type: 'unfurled_all' }); } }
    return ev;
  },
  summary(p) {
    if (!isFake(p.species)) return BASE.summary(p);
    if (p.species === 'scindapsus') return { species: p.species, phase: p.phase, nodes: p.leaves.length, leaves: p.leaves.length, lengthM: p.lengthM, capM: null, atFloor: false };
    const a = avg(p);
    return { species: p.species, leaves: p.leaves.length, curled: p.leaves.filter(x => x.curled).length, tooBright: p.hist.length > 0 && a > F.hi, tooDark: p.hist.length > 0 && a < F.lo };
  },
  leafRows(p) { return isFake(p.species) ? p.leaves.map(l => ({ no: l.no, born: l.born, stage: l.stage, grade: 'plain', size_m: 0.1, asset: 'x' })) : BASE.leafRows(p); },
  cutAbove(p, no) {
    if (p.species !== 'scindapsus') return BASE.cutAbove(p, no);
    const keep = p.leaves.filter(l => l.no <= no), take = p.leaves.filter(l => l.no > no);
    if (!keep.length || !take.length) throw new Error('[가짜 SC] 못 자른다');
    p.leaves = keep; p.lengthM = +(keep.length * F.inter).toFixed(3);
    return { cutting: { schema: 'species/1', species: 'scindapsus', seed: p.seed ^ 7, day: 0, step: 0, hist: [], births: 0, phase: 'cutting', rootDays: 0,
                        leaves: take.map((l, i) => ({ ...l, no: i + 1 })), lengthM: +(take.length * F.inter).toFixed(3) }, saved: false };
  },
  scStemCapM: d => +(d + F.over).toFixed(3),
  scInternodeM: () => F.inter,
  isHighSpot: d => d >= F.high,
  longVineM: () => +(F.high + F.over).toFixed(3),
  bandOf: () => ({ lo: F.lo, hi: F.hi }),
  spotFit: (sp, dli) => dli > F.hi ? 'over' : dli >= F.lo ? 'fit' : dli >= 1 ? 'slow' : 'dark'
};
const knownReal = SP.speciesKnown('scindapsus') && SP.speciesKnown('calathea');
if (FAKE) SP.installSpeciesRules(fakeRules);
else if (!knownReal) { console.log('species2: SKIP — 진짜 규칙에 두 종이 아직 없다(FAKE=0)'); process.exit(2); }
console.log(FAKE ? '· 가짜 두 종(growth 회신 꼴)으로 잰다' : '· 진짜 growth 규칙으로 잰다');

/* ── 판 ── */
const cut = (id, o = {}) => ({ id, status: 'rooted', varieFromCut: false, leaves: 1, leafVarie: [false], leafGrade: [null], at: { x: 0, y: 1, z: 0 }, slotId: 's:' + id, ...o });
const newS = (o = {}) => ({ day: 300, sim: { seed: 11 }, story: {}, home: { room: 'tworoom' }, cuttings: [cut('c1')], pots: [], shop: { stock: {} },
                            tutorial: { enabled: true, lamp: { placed: 0 } }, ...o });
const openS = (o) => { const S = newS(o); JS.startShopJob(S); JS.openShop(S); return S; };
const regs = (S, n) => { S.jobShop.regulars = Array.from({ length: n }, (_, i) => 'r' + i); };
const day = (S, ctx = {}) => { S.day += 1; return JS.stepShopJob(S, ctx).events; };
const SPOTS = [{ dropM: 0.45, dli: 5 }, { dropM: 0.81, dli: 12 }, { dropM: 0.02, dli: 1.5 }];
const sum = q => SP.speciesRules().summary(q.plant);
let dayNo = 1000;
/* 그 그루를 받침 높이 y 에 놓고 dli 로 하루씩(다른 그루는 그날 빛이 없어 건너뜀) — until 이 참이면 멈춤 */
const walk = (S, q, { y = 0.5, dli = 5, until = null, max = 400 } = {}) => {
  SP.setSpeciesAt(S, q.id, { slotId: 'w:' + q.id, at: { x: 0, y, z: 0 } });
  for (let d = 0; d < max; d++) {
    if (until && until()) return d;
    SP.stepSpecies(S, { day: dayNo++, season: 'spring', lightOf: x => x === q ? dli : null, dropOf: x => x.at.y });
  }
  if (until && !until()) throw new Error(`${max}일 걸어도 안 됐다`);
  return max;
};

T('A sc_ask — 단골 5 · 진열 · special 손님은 주문에 안 뽑힘', () => {
  const S = openS();
  regs(S, 4);
  assert.ok(!day(S).some(e => e.id === 'sc_ask'), '단골 4 에 sc_ask');
  assert.strictEqual(SP.speciesShopOpen(S, 'sc_cutting'), false, '단골 4 인데 상점에 떴다');
  regs(S, 5);
  const ev = day(S), a = ev.find(e => e.id === 'sc_ask');
  assert.ok(a, '단골 5 에 sc_ask 가 안 났다');
  assert.strictEqual(a.customerId, 'sc_seeker'); assert.ok(/^사무실 첫 화분 찾는 손님 — /.test(a.ko), a.ko);
  assert.strictEqual(S.jobShop.scAskOn, S.day);
  assert.strictEqual(SP.speciesShopOpen(S, 'sc_cutting'), true);
  assert.ok(!day(S).some(e => e.id === 'sc_ask'), 'sc_ask 가 두 번');
  /* 주문 손님 — 300일 동안 special 둘은 안 나온다 */
  const S2 = openS();
  for (let i = 0; i < 300; i++) { day(S2); S2.jobShop.orders = []; }
  const used = new Set(S2.jobShop.seq ? [] : []);
  for (let i = 0; i < 40; i++) { S2.jobShop.nextOrderDay = S2.day + 1; day(S2); for (const o of S2.jobShop.orders) used.add(o.customerId); S2.jobShop.orders = []; }
  assert.ok(used.size > 0, '주문이 하나도 안 났다');
  assert.ok(!used.has('sc_seeker') && !used.has('ca_owner'), 'special 손님이 주문 손님으로: ' + [...used].join(','));
});

T('B ca_care — 단골 8 · 하루 하나 · 맡은 그루', () => {
  const S = openS();
  regs(S, 9);
  const d1 = day(S).map(e => e.id), d2 = day(S).map(e => e.id);
  assert.ok(d1.includes('sc_ask') && !d1.includes('ca_care'), '첫날: ' + d1.join(','));
  assert.ok(d2.includes('ca_care'), '이튿날 ca_care 가 없다: ' + d2.join(','));
  const q = SP.speciesPotOf(S, S.jobShop.caPotId);
  assert.ok(q && q.species === 'calathea' && q.care && q.care.customerId === 'ca_owner', JSON.stringify(q && q.care));
  assert.ok(!SP.speciesPlaced(q), '맡은 그루가 가방이 아니다');
  const s = SP.speciesRules().summary(q.plant);
  assert.ok(s.leaves > 0 && s.curled === s.leaves, `잎이 다 말리지 않았다 ${s.curled}/${s.leaves}`);
  assert.ok(/맡은 칼라테아/.test(SP.speciesSellBlockedReason(q)), '맡은 그루를 팔 수 있다');
  assert.throws(() => SP.takeSpeciesForSale(S, q.id));
  const snap = JS.jobShopSnapshot(S);
  assert.strictEqual(snap.caCareOpen, true); assert.strictEqual(snap.caSaved, false);
  /* 맡은 그루는 다 펴져도 ca_pot 후보가 아니다(가게 것이 되기 전) */
  walk(S, q, { dli: 5, until: () => sum(q).curled === 0 });
  assert.strictEqual(JS.candidatesFor(S, { kind: 'ca_pot', need: {}, premium: 1 }).length, 0, '맡은 그루가 후보로');
});

T('C ca_saved — 말린 잎 0 인 날 · 가게 것', () => {
  const S = openS();
  regs(S, 8); day(S); day(S);
  const q = SP.speciesPotOf(S, S.jobShop.caPotId);
  assert.ok(!day(S).some(e => e.id === 'ca_saved'), '말린 채인데 ca_saved');
  const took = walk(S, q, { dli: 5, until: () => sum(q).curled === 0 });
  console.log(`      맡은 칼라테아 — 알맞은 빛(DLI 5)에서 ${took}일에 다 펴짐`);
  const sv = day(S).find(e => e.id === 'ca_saved');
  assert.ok(sv && sv.potId === q.id, 'ca_saved 가 안 났다');
  assert.ok(/가게에 두라고/.test(sv.ko), sv.ko);
  assert.strictEqual(q.care, null);
  assert.strictEqual(SP.speciesSellBlockedReason(q), null, '가게 것이 됐는데 못 판다');
  const snap = JS.jobShopSnapshot(S);
  assert.strictEqual(snap.caCareOpen, false); assert.strictEqual(snap.caSaved, true);
  assert.ok(!day(S).some(e => e.id === 'ca_saved' || e.id === 'ca_care'), '두 번 났다');
});

T('D 규칙이 그 종을 모르면 — 사건 · 진열 없음', () => {
  SP.installSpeciesRules(BASE);
  try {
    const S = openS(); regs(S, 12);
    for (let i = 0; i < 5; i++) assert.ok(!day(S).some(e => /^(sc_ask|ca_care)$/.test(e.id)), '규칙 없이 사건');
    assert.strictEqual(SP.speciesShopOpen(S, 'sc_cutting'), false);
    assert.strictEqual(SP.speciesShopOpen({ ...S, tutorial: { enabled: false }, jobShop: { scAskOn: 1 } }, 'sc_cutting'), false, '첫 플레이 꺼진 판에서도 규칙 없으면 안 뜬다');
  } finally { SP.installSpeciesRules(FAKE ? fakeRules : REAL); }
});

T('E 주문 sc_cutting · sc_pot — 원천 · 길이 · 높은 자리 · 기한 안에 닿는 것만 · 겨울', () => {
  const S = openS(); S.sim.yearDay0 = 100;   /* 300 + 100 = 봄(기한 걸음이 오늘 철로 걷는다) */
  assert.strictEqual(JS.shopSources(S).sc_cutting, false, 'SC 없는데 원천');
  const c = SP.unpackSpeciesStock(S, 'sc_cutting', () => 1, () => {});
  assert.ok(SP.scRooting(c), '상점 삽수가 물꽂이가 아니다');
  let src = JS.shopSources(S, { spots: SPOTS });
  assert.ok(src.sc_cutting && src.sc2 && !src.sc_pot, JSON.stringify({ c: src.sc_cutting, s2: src.sc2, p: src.sc_pot }));
  assert.deepStrictEqual(JS.orderNeedFor('sc_cutting', 'normal', src), { nodes: 2 });
  assert.strictEqual(JS.candidatesFor(S, { kind: 'sc_cutting', need: { nodes: 2 }, premium: 1 }).length, 1);
  assert.strictEqual(JS.candidatesFor(S, { kind: 'sc_cutting', need: { nodes: 3 }, premium: 1 }).length, 0);
  /* 뿌리 → 그루: 길이 주문 */
  const rootIn = walk(S, c, { y: 0.45, until: () => !SP.scRooting(c) });
  console.log(`      줄기 삽수 — 물꽂이 ${rootIn}일에 뿌리`);
  assert.strictEqual(JS.shopSources(S, { spots: SPOTS }).sc_pot, false, '그루가 하나뿐인데 그루 주문 원천(몬스테라 그루 주문과 같은 자 — 둘 이상)');
  const second = SP.addSpeciesPot(S, 'scindapsus', { origin: 'cut', newPlant: { form: 'rooted', nodes: 2 } });
  src = { ...JS.shopSources(S, { spots: SPOTS }), day: 0, yd0: 60 };   /* 봄(겨울 가드 밖 — 겨울은 아래에서 따로) */
  assert.ok(src.sc_pot, '뿌리낸 그루 둘인데 원천으로 안 섰다');
  assert.ok(src.sc_cutting, '자를 마디가 있는 그루인데 줄기 삽수 원천이 아니다');
  const n = JS.orderNeedFor('sc_pot', 'normal', src);
  const R = SP.speciesRules();
  assert.ok(n && Math.abs(n.lengthM - (sum(c).lengthM + R.scInternodeM(c.plant))) < 1e-3, JSON.stringify(n));
  /* 어려움 — 막 뿌리낸 줄기는 45일에 «높은 자리에서만 닿는 길이»에 못 닿는다 → 안 낸다(10-23 하네스 sc_pot 8/8 기한 지남) */
  const h0 = JS.orderNeedFor('sc_pot', 'hard', src);
  assert.strictEqual(h0, null, '45일 안에 못 닿는 어려움 주문: ' + JSON.stringify(h0) + ' · 지금 ' + sum(c).lengthM);
  /* 높은 자리에서 걸어 «45일 안에 닿을» 때가 오면 열린다 — 열린 그 주문을 그 자리에서 45일 걸어 맞춘다(할 수 있는 주문인지 걸어서 잰다) */
  const HI = [{ dropM: 0.81, dli: 6 }];
  const sv = { ...sum(c) }, plantCopy = JSON.parse(JSON.stringify(c.plant));
  let hard = null, waited = 0;
  while (!hard && waited < 400) { walk(S, c, { y: 0.81, dli: 6, max: 5 }); waited += 5; hard = JS.orderNeedFor('sc_pot', 'hard', JS.shopSources(S, { spots: HI })); }
  console.log(`      어려움 sc_pot — 높은 자리 ${waited}일째에 열림 · 줄기 ${sum(c).lengthM}m → 요구 ${hard && hard.lengthM}m`);
  assert.ok(hard && hard.lengthM >= R.longVineM() - 1e-3 && sum(c).lengthM < hard.lengthM, JSON.stringify(hard));
  walk(S, c, { y: 0.81, dli: 6, max: 45 });
  assert.ok(sum(c).lengthM >= hard.lengthM - 1e-9, `열린 어려움 주문을 45일에 못 맞췄다 — ${sum(c).lengthM} < ${hard.lengthM}`);
  /* ★ D76 — 어려움은 «높은 자리에 놓인» 줄기만 후보 */
  assert.strictEqual(hard.high, true, '어려움 주문에 높은 자리 조건이 없다');
  assert.strictEqual(JS.candidatesFor(S, { kind: 'sc_pot', need: hard, premium: 1 }).filter(x => x.ref.id === c.id).length, 1, '높은 자리 긴 줄기가 후보가 아니다');
  SP.setSpeciesAt(S, c.id, { slotId: 'low:c', at: { x: 0, y: 0.3, z: 0 }, dropM: 0.3 });
  assert.strictEqual(JS.candidatesFor(S, { kind: 'sc_pot', need: hard, premium: 1 }).filter(x => x.ref.id === c.id).length, 0, '낮은 자리로 옮긴 줄기가 어려움 후보');
  assert.ok(/높은 자리에 걸려 줄기 \d+cm 이상 늘어진 스킨답서스 그루/.test(JS.orderWantKo({ kind: 'sc_pot', need: hard })), JS.orderWantKo({ kind: 'sc_pot', need: hard }));
  c.plant = plantCopy;   /* 아래(보통·겨울·후보)는 막 뿌리낸 그루로 */
  assert.strictEqual(sum(c).lengthM, sv.lengthM);
  assert.strictEqual(JS.orderNeedFor('sc_pot', 'hard', { ...JS.shopSources(S, { spots: SPOTS.filter(s => s.dropM < F.high) }), day: 0, yd0: 60 }), null, '높은 자리 없는 판에 어려움');
  assert.strictEqual(JS.orderNeedFor('sc_pot', 'normal', { ...JS.shopSources(S, {}), day: 0, yd0: 60 }), null, '자리를 모르는데 길이 주문');
  /* 겨울 — 등 2 아래면 길이 주문 없음 */
  const wint = { ...src, day: 0, yd0: 300, lamps: 1 };
  assert.strictEqual(JS.orderNeedFor('sc_pot', 'normal', wint), null, '겨울 · 등 1 인데 길이 주문');
  assert.ok(JS.orderNeedFor('sc_pot', 'normal', { ...wint, lamps: 2 }), '겨울 · 등 2 인데 막힘');
  /* 후보 — 길이 */
  walk(S, c, { y: 0.45, dli: 6, max: 60 });
  const L = sum(c).lengthM;
  assert.strictEqual(JS.candidatesFor(S, { kind: 'sc_pot', need: { lengthM: L }, premium: 1 }).length, 1);
  assert.strictEqual(JS.candidatesFor(S, { kind: 'sc_pot', need: { lengthM: L + 0.01 }, premium: 1 }).length, 0);
  assert.ok(/줄기 50cm 이상 스킨답서스 그루/.test(JS.orderWantKo({ kind: 'sc_pot', need: { lengthM: 0.5 } })));
  /* 걸린 주문만큼 원천이 준다 — 그루 둘에 걸린 주문 둘이면 더 안 낸다 */
  S.jobShop.orders.push({ id: 'x', kind: 'sc_pot', need: {}, customerId: 'k' });
  assert.strictEqual(JS.shopSources(S, { spots: SPOTS }).sc_pot, true, '그루 둘 · 걸린 주문 하나인데 막힘');
  S.jobShop.orders.push({ id: 'y', kind: 'sc_pot', need: {}, customerId: 'k2' });
  assert.strictEqual(JS.shopSources(S, { spots: SPOTS }).sc_pot, false, '그루 둘에 sc_pot 주문이 셋');
  void second;
});

T('F 주문 ca_pot — 알맞은 자리 · 말린 잎 · 한 달', () => {
  const S = openS();
  const q = SP.addSpeciesPot(S, 'calathea', { origin: 'care', newPlant: { leaves: 4, curled: 0 } });
  assert.ok(JS.shopSources(S, { spots: SPOTS }).ca_pot, '가게 것 · 다 펴진 칼라테아가 원천이 아니다');
  assert.strictEqual(JS.shopSources(S, { spots: SPOTS.map(s => ({ ...s, dli: 20 })) }).ca_pot, false, '알맞은 자리 없는 판에 ca_pot');
  assert.strictEqual(JS.shopSources(S, {}).ca_pot, false, '자리를 모르는데 ca_pot');
  const src = JS.shopSources(S, { spots: SPOTS });
  assert.deepStrictEqual(JS.orderNeedFor('ca_pot', 'normal', src), { leaves: 4 });
  assert.deepStrictEqual(JS.orderNeedFor('ca_pot', 'hard', { ...src, day: 0, yd0: 60, lamps: 0 }), { leaves: 5, flatDays: 30 }, '봄 어려움');
  assert.strictEqual(JS.orderNeedFor('ca_pot', 'hard', { ...src, day: 0, yd0: 300, lamps: 1 }), null, '겨울 · 등 1 인데 «잎 하나 더»');
  assert.deepStrictEqual(JS.orderNeedFor('ca_pot', 'normal', { ...src, day: 0, yd0: 300, lamps: 0 }), { leaves: 4 }, '보통(지금 잎 그대로)은 겨울 가드 밖');
  assert.strictEqual(JS.candidatesFor(S, { kind: 'ca_pot', need: { leaves: 4 }, premium: 1 }).length, 1);
  walk(S, q, { dli: 14, until: () => sum(q).curled >= 1 });
  assert.strictEqual(JS.candidatesFor(S, { kind: 'ca_pot', need: { leaves: 4 }, premium: 1 }).length, 0, '말린 잎이 있는데 후보');
  walk(S, q, { dli: 5, until: () => sum(q).curled === 0 });
  assert.ok(Number.isFinite(q.flatSince), '다시 펴졌는데 flatSince 가 없다');
  q.flatSince = S.day - 10;
  assert.strictEqual(JS.candidatesFor(S, { kind: 'ca_pot', need: { leaves: 4, flatDays: 30 }, premium: 1 }).length, 0, '한 달이 안 됐는데 후보');
  q.flatSince = S.day - 30;
  assert.strictEqual(JS.candidatesFor(S, { kind: 'ca_pot', need: { leaves: 4, flatDays: 30 }, premium: 1 }).length, 1);
  assert.ok(/한 달 내내 말린 잎이 없는 칼라테아 그루/.test(JS.orderWantKo({ kind: 'ca_pot', need: { leaves: 4, flatDays: 30 } })));
});

T('G 값 — SC 마디 · CA 펴진 잎', () => {
  const S = openS(), V = SP.SPECIES2;
  const c = SP.addSpeciesPot(S, 'scindapsus', { origin: 'shop', newPlant: { form: 'cutting', nodes: 2 } });
  assert.strictEqual(SP.speciesPriceOf(c).won, sum(c).nodes * V.scNodeWon, '물꽂이 삽수는 ×1.0');
  const g = SP.addSpeciesPot(S, 'scindapsus', { origin: 'shop', newPlant: { form: 'rooted', nodes: 2 } });
  assert.ok(!SP.scRooting(g), 'form rooted 가 물꽂이로');
  assert.strictEqual(SP.speciesPriceOf(g).won, Math.round(sum(g).nodes * V.scNodeWon * 1.4), '그루는 ×1.4');
  const a = SP.addSpeciesPot(S, 'calathea', { newPlant: { leaves: 5, curled: 2 } });
  assert.strictEqual(sum(a).curled, 2);
  assert.strictEqual(SP.speciesPriceOf(a).won, Math.round(3 * V.caLeafWon * 1.4), '말린 잎은 0');
  const z = SP.addSpeciesPot(S, 'calathea', { newPlant: { leaves: 3, curled: 'all' } });
  assert.ok(/다 말려/.test(SP.speciesSellBlockedReason(z) || ''), '다 말린 칼라테아를 판다');
  /* 차례(⚖ 박사님 «차례만») — SC 마디 < 몬스테라 무지 잎 2만 < CA 잎 < PP 산반 25만 */
  assert.ok(V.scNodeWon < 20_000 && 20_000 < V.caLeafWon && V.caLeafWon < SP.SPECIES_GAME.leafWon.pink_princess.marble, '값 차례가 어긋났다');
});

T('H 하루 — 받침 높이 · 첫 뿌리 · 칼라테아 칸', () => {
  const S = openS();
  const c = SP.addSpeciesPot(S, 'scindapsus', { origin: 'shop', newPlant: { form: 'cutting', nodes: 2 } });
  SP.setSpeciesAt(S, c.id, { slotId: 'tworoom-shop-display:6', at: { x: 0, y: 0.81, z: 0 } });
  const ids = [];
  for (let d = 0; d < 13; d++) ids.push(...SP.stepSpecies(S, { day: S.day + d, season: 'spring', lightOf: () => 6, dropOf: q => q.at.y }).events.map(e => e.id));
  assert.deepStrictEqual(ids.filter(x => /^sc_rooted/.test(x)), ['sc_rooted'], '첫 뿌리: ' + ids.join(','));
  assert.ok(!SP.scRooting(c));
  const r0 = SP.stepSpecies(S, { day: S.day + 20, season: 'spring', lightOf: () => 6 });
  assert.strictEqual(r0.missedDrop, 1, '받침 높이 없이 자랐다');
  assert.ok(!r0.events.some(e => e.id === 'species_error'), '못 잰 날을 규칙에 넘겨 던졌다');
  /* 두 번째 그루 뿌리 — sc_rooted 가 다시 안 난다 */
  const c2 = SP.addSpeciesPot(S, 'scindapsus', { origin: 'shop', newPlant: { form: 'cutting', nodes: 2 } });
  SP.setSpeciesAt(S, c2.id, { slotId: 'x', at: { x: 0, y: 0.4, z: 0 } });
  const ids2 = [];
  for (let d = 0; d < 13; d++) ids2.push(...SP.stepSpecies(S, { day: S.day + 30 + d, season: 'spring', lightOf: () => 6, dropOf: q => q.at.y }).events.map(e => e.id));
  assert.ok(!ids2.includes('sc_rooted') && ids2.includes('sc_rooted_again'), ids2.join(','));
  /* 칼라테아 — 놓인 수 · 너무 밝음 · 다 펴진 날부터 센다 */
  const a = SP.addSpeciesPot(S, 'calathea', { newPlant: { leaves: 2, curled: 'all' } });
  SP.setSpeciesAt(S, a.id, { slotId: 'y', at: { x: 0, y: 0.5, z: 0 } });
  let r = SP.stepSpecies(S, { day: 400, season: 'spring', lightOf: q => q.species === 'calathea' ? 12 : 6, dropOf: q => q.at.y });
  assert.strictEqual(r.caPlants, 1); assert.strictEqual(r.caTooBright, true);
  for (let d = 1; d <= 9; d++) r = SP.stepSpecies(S, { day: 400 + d, season: 'spring', lightOf: q => q.species === 'calathea' ? 5 : 6, dropOf: q => q.at.y });
  assert.strictEqual(r.caTooBright, false);
  assert.strictEqual(SP.speciesRules().summary(a.plant).curled, 0, '알맞은 빛인데 안 펴졌다');
  assert.ok(Number.isFinite(a.flatSince), 'flatSince 를 안 적었다');
  SP.bagSpecies(S, a.id);
  assert.strictEqual(SP.stepSpecies(S, { day: 420, season: 'spring', lightOf: () => 5, dropOf: q => q.at.y }).caPlants, 0, '가방 그루를 셌다');
});

T('I 자르기 — SC 같은 손 · 물꽂이 중엔 못 자름', () => {
  const S = openS();
  const c = SP.addSpeciesPot(S, 'scindapsus', { origin: 'shop', newPlant: { form: 'cutting', nodes: 4 } });
  assert.strictEqual(SP.ppCuttableNodes(c).length, 0, '물꽂이 중인데 자를 마디');
  assert.throws(() => SP.cutSpecies(S, c.id, 2), /뿌리/);
  const m = SP.addSpeciesPot(S, 'scindapsus', { origin: 'shop', newPlant: { form: 'rooted', nodes: 4 } });
  const nodes = SP.ppCuttableNodes(m);
  assert.strictEqual(nodes.length, 3, JSON.stringify(nodes));
  const r = SP.cutSpecies(S, m.id, nodes[1].no);
  assert.ok(SP.scRooting(r.cutting) && r.cutting.origin === 'cut', '잘린 끝이 물꽂이 삽수가 아니다');
  assert.strictEqual(sum(r.cutting).nodes, 2);
  assert.strictEqual(sum(m).nodes, 2);
});

T('J 스냅샷 · 세이브 · 옛 세이브', () => {
  const S = openS();
  assert.deepStrictEqual(SP.species2Snapshot(S), { scPlants: 0, scLongVine: 0 });
  const c = SP.addSpeciesPot(S, 'scindapsus', { origin: 'shop', newPlant: { form: 'rooted', nodes: 3 } });
  assert.deepStrictEqual(SP.species2Snapshot(S), { scPlants: 0, scLongVine: 0 }, '가방 그루를 «놓임»으로');
  const LV = SP.speciesRules().longVineM();
  const hi = walk(S, c, { y: 0.81, dli: 6, until: () => sum(c).lengthM >= LV - 1e-9, max: 900 });
  console.log(`      높은 자리(0.81m · DLI 6 · 봄) — 뿌리낸 줄기가 longVineM ${LV}m 에 ${hi}일`);
  assert.deepStrictEqual(SP.species2Snapshot(S), { scPlants: 1, scLongVine: 1 });
  const low = SP.addSpeciesPot(S, 'scindapsus', { origin: 'shop', newPlant: { form: 'rooted', nodes: 3 } });
  walk(S, low, { y: 0.45, dli: 6, max: 300 });
  console.log(`      낮은 자리(0.45m) 300일 — 줄기 ${sum(low).lengthM}m(longVineM ${LV}m${sum(low).lengthM >= LV ? ' 에 닿았지만' : ' 못 닿고'} · 높은 자리가 아니라 안 셈)`);
  /* ★ D76(총괄) — scLongVine 은 «높은 자리에 놓인» 줄기만 센다. 0.5 는 낮은 자리 상한으로도 닿을 수 있어 길이만으로는 못 가른다 */
  assert.deepStrictEqual(SP.species2Snapshot(S), { scPlants: 2, scLongVine: 1 }, '낮은 자리 줄기를 곁줄 셈에 넣었다');
  SP.setSpeciesAt(S, c.id, { slotId: 'low:c', at: { x: 0, y: 0.3, z: 0 }, dropM: 0.3 });
  assert.strictEqual(SP.species2Snapshot(S).scLongVine, 0, '낮은 자리로 옮긴 긴 줄기를 셌다');
  SP.setSpeciesAt(S, c.id, { slotId: 'hi:c', at: { x: 0, y: 0.81, z: 0 } });
  assert.strictEqual(SP.species2Snapshot(S).scLongVine, 0, '늘어지는 높이를 모르는데(옮긴 뒤 하루 전) 셌다');
  walk(S, c, { y: 0.81, dli: 6, max: 1 });
  assert.strictEqual(SP.species2Snapshot(S).scLongVine, 1, '높은 자리로 되돌린 이튿날 다시 셈');
  assert.ok('scPlants' in SP.speciesSnapshot(S) && 'scLongVine' in SP.speciesSnapshot(S), 'speciesSnapshot 에 칸이 없다');
  /* 세이브 왕복 */
  regs(S, 8); day(S); day(S);
  const a = SP.speciesPotOf(S, S.jobShop.caPotId); a.flatSince = 123;
  const back = SP.unpackSpecies(JSON.parse(JSON.stringify(SP.packSpecies(S.species))));
  const b = back.pots.find(q => q.id === a.id);
  assert.deepStrictEqual(b.care, a.care); assert.strictEqual(b.flatSince, 123);
  assert.ok(!('care' in back.pots.find(q => q.id === c.id)), '맡지 않은 그루에 care 칸');
  const J2 = JS.unpackJobShop(JSON.parse(JSON.stringify(JS.packJobShop(S.jobShop))));
  assert.strictEqual(J2.caPotId, S.jobShop.caPotId); assert.strictEqual(J2.scAskOn, S.jobShop.scAskOn);
  /* 옛 세이브(칸 없음) — 기본값 · 단골이 이미 넘었으면 이튿날부터 차례로 */
  const old = JS.unpackJobShop({ orders: [], regulars: ['a', 'b', 'c', 'd', 'e', 'f'], openedOn: 300 });
  assert.strictEqual(old.scAskOn, null); assert.strictEqual(old.caPotId, null);
  const S3 = newS({ story: { job: { id: 'shop', since: 300 } }, jobShop: old });
  assert.ok(day(S3).some(e => e.id === 'sc_ask'), '옛 세이브(단골 6)에 sc_ask 가 안 난다');
});

console.log(bad ? `species2: FAIL (${bad})` : 'species2: PASS');
process.exit(bad ? 1 : 0);
