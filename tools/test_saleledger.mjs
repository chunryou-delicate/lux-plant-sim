/* ============================================================
   tools/test_saleledger.mjs — **판 돈이 갈래별로 갈라져 있나**
   ------------------------------------------------------------
   2026-08-13 박사님 확정: *"㉯ 로 하자. 그리고 미리 해 둬, 다양해질 테니"*

   `shop.earnedWon` 한 칸에 판 돈이 전부 몰려 있어서, 가계부가 「식물 판 것」을
   **뺄셈**(전체 − 채소)으로 구했다. 갈래가 하나 늘면 그것이 조용히 식물에 섞인다.

     A  ★★ 합계 = 갈래별 합 — **이 검사의 전부다**
     B  지갑에 들어오는 총액이 한 원도 안 달라진다
     C  ★ 모르는 갈래는 **던진다** (새 판매가 조용히 섞이지 못한다)
     D  ★★ 옛 세이브 — 갈래 칸이 없으면 「예전 판 · 종류 모름」으로 옮긴다
     E  ★ 갈래 합이 더 **큰** 판은 안 만진다 — 조용히 맞추면 원인이 묻힌다
     F  ⏸ 곳간과 잉여는 **지금 같은 통**이다 (그 사실을 못 박는다) · 받는 쪽은 뚫려 있다

     node tools/test_saleledger.mjs
============================================================ */
import assert from 'node:assert';

import { newState } from '../src/game/state.js';
import { createTutorialState } from '../src/game/tutorial.js';
import {
  SALE_KINDS, createShopState, shopOf, shopStatus, saleLedgerOf, earnedByOf,
  listPot, listCutting, stepMarket, dealListing, marketGate, MARKET_MIN_LEAVES,
  creditCropSurplus, priceOf
} from '../src/game/shop.js';

/* ══ ★★ 2026-08-17 — **파는 것이 두 걸음이 됐다** (shop.js §⑦-0) ═══════════════════
   ------------------------------------------------------------
   예전에는 이 파일이 `sellCutting(S, id)` · `sellPot(S, …)` 한 줄로 팔았고,
   **그 한 줄이 「누르면 그 자리에서 돈이 들어온다」를 못 박고 있었다.** 그것이 이번에
   바뀐 약속이다 — 몬스테라 것은 상점이 안 사고 중고 거래로만 나간다.
   ⇒ 여기가 재는 것은 **「어느 통에 담기나」**이지 「며칠 걸리나」가 아니므로
     (그건 `test_market` · `test_banjiha_routes` 가 잰다) 날짜만 앞으로 밀어 거래까지 간다.
   ⚠ **지름길이다. 그래서 적는다.** 밀고 나서 되돌린다 — 이 검사의 다른 절이 날짜를 안 본다. */
/* ⚠ **문을 손으로 연다.** 중고 거래는 모주 잎이 2장이 되면 열리는데(shop.js §marketGate),
   이 하네스에는 growth 가 없어 잎을 세어 줄 창구가 없다 — 마디 목록(`nodes()`)을 손으로
   지어내는 것과 **같은 지름길**이다. 화면에서는 `drawShop` 이 매번 잎 수를 넘겨 연다. */
const openMarket = (S) => marketGate(S, { leaves: MARKET_MIN_LEAVES });

function dealNow(S, listing) {
  const back = S.day;
  S.day = Math.max(S.day, listing.contactOnDay);
  stepMarket(S);
  const r = dealListing(S, listing.listingId);
  S.day = back;
  return r;
}
const sellCuttingNow = (S, id) => (openMarket(S), dealNow(S, listCutting(S, id).listing));
const sellPotNow = (S, opt) => (openMarket(S), dealNow(S, listPot(S, opt).listing));
import { takeCutting, stepCuttings } from '../src/game/propagation.js';
import { serialize, deserialize as _deserialize } from '../src/game/save.js';

/* 형태(growth)는 여기서 재는 것이 아니다 — 그 계약은 tools/test_save.mjs 가 고정한다 */
const deserialize = (blob) => _deserialize(blob, { allowMissingGrowth: true });

const results = [];
const check = (name, fn) => { try { fn(); results.push(['PASS', name]); }
                              catch (e) { results.push(['FAIL', name, e.message]); } };
const info = (s) => results.push(['INFO', '  ' + s]);
const won = n => Math.round(n).toLocaleString() + '원';

function newGame() {
  const S = newState({ room: 'banjiha', mode: 'novice' });
  S.day = 1;
  S.tutorial = createTutorialState({ enabled: true });
  S.tutorial.day = 1;
  S.tutorial.cashWon = 0;
  S.pots = [{ id: 'pot_01', species: 'monstera', at: null, slotId: null, cuts: [] }];
  return S;
}
const give = (S, item, n = 1) => { const sh = shopOf(S); sh.stock[item] = (sh.stock[item] || 0) + n; };
const nodes = () => ([
  { nodeId: 'n0#0', stem: 'pink', leaves: 3, variegatedLeaves: 0, growthDays: 100 },
  { nodeId: 'n0#1', stem: 'pink', leaves: 1, variegatedLeaves: 0, growthDays: 100 }
]);

/* 판매 세 갈래를 실제로 한 번씩 돌린다. 반환 { S, potWon, cutWon, cropWon } */
function sellAllThree() {
  const S = newGame();
  give(S, 'jar');
  const c = takeCutting(S, { nodes: nodes(), nodeId: 'n0#1', container: 'jar' });
  for (let i = 0; i < 400 && c.status === 'rooting'; i++) { S.day += 1; stepCuttings(S); }
  const cutWon = sellCuttingNow(S, c.id).won;
  const cropWon = creditCropSurplus(S, 3_000).won;
  const potWon = sellPotNow(S, { leaves: 3, variegatedLeaves: 0 }).won;
  return { S, potWon, cutWon, cropWon };
}

/* ══ A · ★★ 합계 = 갈래별 합 ═══════════════════════════════════════════ */
check('A ★★합계(earnedWon) = 갈래별 합 — 세 갈래를 실제로 팔아 본다', () => {
  const { S, potWon, cutWon, cropWon } = sellAllThree();
  const L = saleLedgerOf(S);
  assert.equal(L.byKind.pot, potWon, '그루 통이 안 맞습니다');
  assert.equal(L.byKind.cutting, cutWon, '삽수 통이 안 맞습니다');
  assert.equal(L.byKind.crop, cropWon, '채소 통이 안 맞습니다');
  assert.equal(L.totalWon, shopOf(S).earnedWon, '★갈래별 합이 합계와 다릅니다');
  assert.equal(L.balanced, true);
  /* ★ 가계부가 **뺄셈을 안 해도** 되는가 — 그게 이 일의 목적이다 */
  assert.equal(L.plantWon, potWon + cutWon, '식물 판 것이 덧셈으로 안 나옵니다');
  assert.equal(L.cropWon, cropWon, '채소 판 것이 덧셈으로 안 나옵니다');
  info(`그루 ${won(potWon)} · 삽수 ${won(cutWon)} · 채소 ${won(cropWon)} ` +
       `⇒ 식물 ${won(L.plantWon)} · 합계 ${won(L.totalWon)}`);
  /* 화면이 읽는 창구에도 실려 나온다 */
  assert.equal(shopStatus(S).sales.plantWon, L.plantWon, 'shopStatus 가 갈래를 안 냅니다');
});

/* ══ B · 총액이 안 달라진다 ════════════════════════════════════════════ */
check('B 지갑에 들어온 총액 = 판 값의 합 (통을 나눠도 한 원도 안 달라진다)', () => {
  const { S, potWon, cutWon, cropWon } = sellAllThree();
  assert.equal(S.tutorial.cashWon, potWon + cutWon + cropWon, '★지갑 금액이 달라졌습니다');
  assert.equal(shopOf(S).earnedWon, potWon + cutWon + cropWon, '★상점 합계가 달라졌습니다');
  /* ⚠ `ts.crop.soldWon` 은 이름이 「채소」인데 **판 것 전부**를 받는다 — 그 사실을 못 박는다.
     값은 안 건드렸다(shop.js §credit 의 ⚠ 주석 참고). 뜻을 좁히는 것은 plan 판단이다. */
  assert.equal(S.tutorial.crop.soldWon, potWon + cutWon + cropWon,
    '⚠ ts.crop.soldWon 의 뜻이 조용히 바뀌었습니다 — 지금 계약은 「판 것 전부」입니다');
});

/* ══ C · 모르는 갈래는 던진다 ══════════════════════════════════════════ */
check('C ★모르는 갈래는 던진다 — 새 판매가 조용히 남의 통에 섞이지 못한다', () => {
  const S = newGame();
  /* ⚠ 2026-08-17 — 예전에 여기 적혀 있던 보기는 `'furniture'` 였는데 **그날 실제 갈래가 됐다**
     (가구를 사고 팔게 되면서 `SALE_KINDS` 에 올라갔다). 그대로 두면 이 검사가
     「모르는 갈래도 통과한다」로 빨개진다 — 고장이 아니라 **자가 낡은 것**이다.
     ⇒ 보기를 아직 없는 이름으로 바꿨다. `SALE_KINDS` 에 절대 안 올릴 이름이라야 한다. */
  assert.ok(!SALE_KINDS.includes('__없는갈래__'), '보기로 쓴 이름이 실제 갈래가 됐습니다');
  assert.throws(() => creditCropSurplus(S, 1_000, { kind: '__없는갈래__' }),
    /모르는 판매 갈래/, '★모르는 갈래가 조용히 통과했습니다');
  assert.equal(shopOf(S).earnedWon, 0, '던졌는데 돈이 들어갔습니다');
  info(`아는 갈래 — ${SALE_KINDS.join(' · ')}`);
});

/* ══ D · ★★ 옛 세이브 이관 ═══════════════════════════════════════════ */
/* 옛 판을 만드는 법: 정상 세이브에서 `shop.earnedBy` 칸을 통째로 지운다 */
function oldSaveOf(S) {
  const blob = JSON.parse(JSON.stringify(serialize(S)));
  delete blob.state.shop.earnedBy;
  return blob;
}

check('D ★★옛 세이브 — 번 돈이 사라지지 않고 「종류 모름」으로 열린다', () => {
  const { S, potWon, cutWon, cropWon } = sellAllThree();
  const total = potWon + cutWon + cropWon;
  const S2 = deserialize(oldSaveOf(S));
  const L = saleLedgerOf(S2);
  assert.equal(shopOf(S2).earnedWon, total, '합계가 달라졌습니다');
  assert.equal(L.unknownWon, total, '★옛 판의 번 돈이 「종류 모름」에 안 들어왔습니다');
  assert.equal(L.totalWon, total, '★갈래별 합이 합계와 다릅니다 — 돈이 사라져 보입니다');
  assert.equal(L.balanced, true);
  assert.equal(L.plantWon, 0, '모르는 것을 식물로 세면 안 됩니다');
  info(`옛 판 ${won(total)} 이 전부 「예전 판 · 종류 모름」으로 열린다`);
});

check('D-2 지금 판은 이관이 안 걸린다 — 갈래가 그대로 살아 돌아온다', () => {
  const { S, potWon, cutWon, cropWon } = sellAllThree();
  const S2 = deserialize(JSON.parse(JSON.stringify(serialize(S))));
  const L = saleLedgerOf(S2);
  assert.deepEqual([L.byKind.pot, L.byKind.cutting, L.byKind.crop, L.byKind.unknown],
                   [potWon, cutWon, cropWon, 0], '★저장 왕복에서 갈래가 흐트러졌습니다');
});

check('D-3 갈래 합이 모자란 판은 **그 차이만** 옮긴다', () => {
  const { S, potWon, cutWon, cropWon } = sellAllThree();
  const blob = JSON.parse(JSON.stringify(serialize(S)));
  blob.state.shop.earnedBy.crop = 0;                      // 채소 통만 잃어버린 판
  const L = saleLedgerOf(deserialize(blob));
  assert.equal(L.byKind.pot, potWon, '멀쩡한 통까지 건드렸습니다');
  assert.equal(L.byKind.cutting, cutWon, '멀쩡한 통까지 건드렸습니다');
  assert.equal(L.unknownWon, cropWon, '잃어버린 몫만 옮겨야 합니다');
  assert.equal(L.balanced, true);
});

/* ══ E · 반대 방향은 안 만진다 ═════════════════════════════════════════ */
check('E ★갈래 합이 **더 큰** 판은 조용히 맞추지 않는다 — 드러나게 둔다', () => {
  const { S } = sellAllThree();
  const blob = JSON.parse(JSON.stringify(serialize(S)));
  blob.state.shop.earnedWon = 1;                          // 누가 합계를 깎았다
  const L = saleLedgerOf(deserialize(blob));
  assert.equal(L.balanced, false, '★어긋난 것을 조용히 맞춰 버렸습니다 — 원인이 묻힙니다');
  assert.ok(L.totalWon > L.earnedWon);
});

/* ══ F · 곳간과 잉여 ═══════════════════════════════════════════════════ */
check('F ⏸곳간과 잉여는 지금 **같은 통**이다 — 받는 쪽만 뚫려 있다', () => {
  const S = newGame();
  creditCropSurplus(S, 1_000);                            // 잉여 (state.sellCropSurplus 가 부르는 모양)
  creditCropSurplus(S, 2_000);                            // 곳간 (state.sellPantryCrop 도 똑같이 부른다)
  assert.equal(earnedByOf(S).crop, 3_000, '지금 계약은 「둘이 한 통」입니다');
  assert.equal(earnedByOf(S).cropPantry, 0, '아직 아무도 곳간 통을 안 씁니다');
  /* ★ 가르는 길은 이미 뚫려 있다 — `state.sellPantryCrop` 이 kind 를 넘기면 그날부터 갈린다 */
  creditCropSurplus(S, 5_000, { kind: 'cropPantry' });
  assert.equal(earnedByOf(S).cropPantry, 5_000, '★kind 를 넘겨도 안 갈립니다');
  assert.equal(saleLedgerOf(S).cropWon, 8_000, '채소 합계가 둘을 안 더합니다');
  assert.equal(saleLedgerOf(S).balanced, true);
  info('곳간·잉여의 정본은 first_play.food.totalPantrySoldWon / totalSurplusSoldWon 에 이미 따로 있다');
});

/* ══ 결과 ═════════════════════════════════════════════════════════════ */
let fail = 0;
for (const [tag, name, msg] of results) {
  if (tag === 'INFO') { console.log('     ' + name); continue; }
  console.log(`${tag}  ${name}` + (msg ? `\n      → ${msg}` : ''));
  if (tag === 'FAIL') fail++;
}
console.log(`\nsaleledger: ${fail ? `FAIL (${fail}건)` : 'PASS'}`);
process.exit(fail ? 1 : 0);
