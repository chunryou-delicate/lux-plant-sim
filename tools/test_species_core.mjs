/* tools/test_species_core.mjs — 새 두 종을 «판»에 잇는 코어(src/game/species.js · 총괄 D45) — 노드만 · 크롬 없음
   A 규칙이 선다 · 가방 그루는 하루가 안 간다
   B PP 가 자란다 · 분홍 잎 2장째 경고(pp_pink_warn) · 3장이면 시듦(pp_tip_withered)
   C AL 상점 구근 → 싹(al_sprout) → 겨울 잠(al_asleep · 구근 찾음) → 봄 깸(al_wake first) · 스냅샷 칸
   D PP 자르기 — 산반·하프문 마디면 ppPinkHoldCuts · 윗부분은 새 그루(가방)
   E PP 교환 — 원룸 30일 + ③ 끝 + 뿌리낸 무늬 삽수 → 물음 · 예 → 삽수 하나를 내주고 그루 · 아니오 둘 → 상점 진열
   F 값 — 잎 값 합 × 1.4 · 잠든 AL 은 못 판다
   G 세이브 — 싸고 풀면 같다 */
import assert from 'node:assert';
import * as SP from '../src/game/species.js';
import { seasonOf } from '../src/engine/weather.js';

let bad = 0;
const T = (name, fn) => { try { fn(); console.log('PASS ', name); } catch (e) { bad++; console.log('FAIL ', name, '\n     ', e && e.message); } };
const newS = () => ({ day: 0, sim: { seed: 7 }, tutorial: { enabled: true, movedOut: true }, story: { movedInOnDay: 0 }, stamina: { questsTaken: [] }, cuttings: [] });
const run = (S, days, dliOf, y0 = 0) => {
  const evs = [];
  for (let d = 0; d < days; d++) { S.day += 1; const r = SP.stepSpecies(S, { lightOf: dliOf, season: seasonOf((y0 + S.day) % 360), day: S.day }); evs.push(...r.events.map(e => ({ ...e, day: S.day }))); }
  return evs;
};

T('A 규칙이 선다 · 가방 그루는 하루가 안 간다', () => {
  assert.ok(SP.speciesReady(), '규칙 없음');
  const S = newS();
  const q = SP.addSpeciesPot(S, 'pink_princess', { origin: 'trade' });
  const n0 = q.plant.leaves.length;
  run(S, 120, () => 8);
  assert.strictEqual(q.plant.leaves.length, n0, '가방 속에서 잎이 났다');
  assert.strictEqual(q.plant.day, 0);
});

T('B PP 가 자란다 · 분홍 잎 경고 · 시듦', () => {
  const S = newS();
  const q = SP.addSpeciesPot(S, 'pink_princess', { origin: 'trade', newPlant: { pinks: [0.85, 0.95] } });
  SP.setSpeciesAt(S, q.id, { slotId: 'oneroom-sill:0', at: null });
  const evs = run(S, 200, () => 8, 90);
  console.log('      잎', q.plant.leaves.length, '사건', evs.map(e => e.id + '@' + e.day).join(' '));
  assert.ok(q.plant.leaves.length > 2 || evs.some(e => e.id === 'pp_tip_withered'), '안 자랐다');
  if (evs.some(e => e.id === 'pp_tip_withered')) assert.ok(evs.some(e => e.id === 'pp_pink_warn'), '시들기 전에 경고가 없었다');
});

T('C AL 구근 → 싹 → 잠(구근) → 깸', () => {
  const S = newS();
  S.shop = { stock: { al_corm: 1 } };
  const stockOf = (S, id) => (S.shop.stock[id] || 0), take = (S, id, n) => { S.shop.stock[id] -= n; };
  const q = SP.unpackSpeciesStock(S, 'al_corm', stockOf, take);
  assert.strictEqual(S.shop.stock.al_corm, 0);
  assert.strictEqual(q.plant.phase, 'corm');
  SP.setSpeciesAt(S, q.id, { slotId: 'oneroom-sill:1', at: null });
  /* 봄(0)부터 한 해 반 — 겨울(270~359)에 잠 · 다음 봄 깸 */
  const evs = run(S, 460, (qq) => 9, 0);
  const ids = evs.map(e => e.id);
  console.log('      사건', evs.map(e => `${e.id}@${e.day}${e.corms != null ? '(' + e.corms + ')' : ''}${e.first != null ? (e.first ? '★' : '') : ''}`).join(' '));
  assert.ok(ids.includes('al_sprout'), '싹이 안 났다');
  assert.ok(ids.includes('al_asleep'), '안 잤다');
  assert.ok(ids.includes('al_wake'), '안 깼다');
  const w = evs.find(e => e.id === 'al_wake'); assert.strictEqual(w.first, true);
  const snap = SP.speciesSnapshot(S);
  console.log('      스냅샷', JSON.stringify(snap), '구근', S.species.corms.length);
  assert.strictEqual(snap.alWokeCount, 1);
  assert.strictEqual(snap.alCormsFound, S.species.corms.length);
  if (S.species.corms.length) {
    const c = S.species.corms[0];
    const np = SP.plantCorm(S, c.id);
    assert.strictEqual(np.plant.phase, 'corm');
    assert.strictEqual(SP.speciesSnapshot(S).alFoundCormsPlanted, 1);
  }
});

T('D PP 자르기 — 산반 마디면 곁줄 수 · 윗부분은 가방 그루', () => {
  const S = newS();
  const q = SP.addSpeciesPot(S, 'pink_princess', { origin: 'trade', newPlant: { pinks: [0.3, 0.4, 0.35] } });
  const nodes = SP.ppCuttableNodes(q);
  assert.ok(nodes.length >= 1, '자를 마디 없음');
  const n = nodes.find(x => x.grade === 'marble') || nodes[0];
  const r = SP.cutSpecies(S, q.id, n.no);
  assert.strictEqual(r.cutting.origin, 'cut');
  assert.ok(!SP.speciesPlaced(r.cutting));
  assert.strictEqual(S.species.n.ppPinkHoldCuts, r.grade === 'marble' || r.grade === 'heavy' ? 1 : 0);
  assert.strictEqual(q.plant.leaves.length + r.cutting.plant.leaves.length, 3);
});

T('E PP 교환 — 때 · 예 · 아니오 둘', () => {
  const S = newS();
  S.cuttings = [{ id: 'cut_01', varieFromCut: true, status: 'rooting' }];
  let evs = run(S, 40, () => 8);
  assert.ok(!evs.some(e => e.id === 'pp_trade_offer'), '③ 전에 물었다');
  S.stamina.questsTaken.push('oneroom_settle_cutting');
  evs = run(S, 5, () => 8);
  assert.ok(!evs.some(e => e.id === 'pp_trade_offer'), '내줄 뿌리낸 삽수가 없는데 물었다');
  S.cuttings[0].status = 'rooted';
  evs = run(S, 2, () => 8);
  const o = evs.find(e => e.id === 'pp_trade_offer');
  assert.ok(o && o.again === false, '물음이 안 났다');
  assert.ok(SP.ppTradePending(S));
  const a = SP.answerPPTrade(S, true);
  assert.strictEqual(a.events[0].id, 'pp_trade_done');
  assert.strictEqual(S.cuttings.length, 0, '삽수를 안 내줬다');
  assert.strictEqual(SP.speciesSnapshot(S).ppPlants, 1);
  evs = run(S, 60, () => 8);
  assert.ok(!evs.some(e => e.id === 'pp_trade_offer'), '교환 뒤에 또 물었다');
  /* 아니오 둘 */
  const S2 = newS(); S2.stamina.questsTaken.push('oneroom_settle_cutting'); S2.cuttings = [{ id: 'c', varieFromCut: true, status: 'node' }];
  let e2 = run(S2, 31, () => 8);
  assert.ok(e2.some(e => e.id === 'pp_trade_offer'));
  assert.strictEqual(SP.answerPPTrade(S2, false).events[0].last, false);
  assert.ok(!SP.speciesShopOpen(S2, 'pp_young'));
  e2 = run(S2, 25, () => 8);
  const o2 = e2.find(e => e.id === 'pp_trade_offer'); assert.ok(o2 && o2.again === true, '두 번째 물음');
  assert.strictEqual(SP.answerPPTrade(S2, false).events[0].last, true);
  assert.ok(SP.speciesShopOpen(S2, 'pp_young'), '두 번 거절했는데 상점에 없다');
  e2 = run(S2, 60, () => 8);
  assert.ok(!e2.some(e => e.id === 'pp_trade_offer'), '세 번째로 물었다');
});

T('F 값 — 잎 값 합 × 1.4 · 잠든 AL 은 못 판다', () => {
  const S = newS();
  const q = SP.addSpeciesPot(S, 'pink_princess', { origin: 'trade', newPlant: { pinks: [0.3, 0.7] } });
  const p = SP.speciesPriceOf(q);
  const W = SP.SPECIES_GAME.leafWon.pink_princess;
  assert.strictEqual(p.won, Math.round((W.marble + W.heavy) * 1.4), JSON.stringify(p));
  const a = SP.addSpeciesPot(S, 'alocasia_frydek', { origin: 'shop', newPlant: { origin: 'shop' } });
  assert.ok(SP.speciesSellBlockedReason(a), '구근인데 팔린다');
  assert.throws(() => SP.takeSpeciesForSale(S, a.id));
  const r = SP.takeSpeciesForSale(S, q.id);
  assert.strictEqual(r.won, p.won);
  assert.strictEqual(SP.speciesPotOf(S, q.id), null);
});

T('G 세이브 — 싸고 풀면 같다', () => {
  const S = newS();
  const q = SP.addSpeciesPot(S, 'pink_princess', { origin: 'trade' });
  SP.setSpeciesAt(S, q.id, { slotId: 's:0', at: null });
  run(S, 50, () => 8, 90);
  S.species.corms.push({ id: 'cm_09', seed: 5, origin: 'from_varie_mother', motherKind: 'marble', foundDay: 3 });
  const raw = JSON.parse(JSON.stringify(SP.packSpecies(S.species)));
  const back = SP.unpackSpecies(raw);
  assert.deepStrictEqual(SP.packSpecies(back), SP.packSpecies(S.species));
  /* 풀린 그루가 같은 날을 산다 */
  const S2 = { ...newS(), day: S.day, species: back };
  const e1 = run(S, 40, () => 8, 90), e2 = run(S2, 40, () => 8, 90);
  assert.deepStrictEqual(S2.species.pots[0].plant, S.species.pots[0].plant);
  assert.deepStrictEqual(e2.map(e => e.id), e1.map(e => e.id));
});

console.log(bad ? `species_core: FAIL (${bad})` : 'species_core: PASS');
process.exit(bad ? 1 : 0);
