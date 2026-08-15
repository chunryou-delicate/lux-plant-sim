/* ============================================================
   test_market — **중고 거래**가 실제로 도나 (2026-08-17 신설)
   ------------------------------------------------------------
   박사님 확정: *"판매는 상점에 파는 게 아니라 **당근 같은 곳에 올려서 판다**는 개념으로
   했으면 좋겠어. **일주일 정도 안에 랜덤으로 연락 와서 거래**하게. 그리고 그 기능은
   **잎이 2장 이상**일 때 열리게?"* · *"**몬스테라 연관된 것 자체가 다 상점에는 그냥 안
   팔리게** 해 줘."*

   ⚠⚠ **이 검사가 못 박는 것은 「바뀐 약속」이다.**
     저장소의 검사 일곱 벌이 *「누르면 그 자리에서 돈이 들어온다」*를 못 박고 있었다
     (`test_saleledger:59` · `test_escapecut:75` · `test_cutting_wiring:180,315` ·
      `test_banjiha_routes:235,367` · `test_balance_routes:188,255` ·
      `test_ending_flow:296,307` · `test_dialogue_coverage:239`).
     그 약속이 여기서 바뀐다. 그러니 **새 약속을 여기에 적어 둔다.**

     A  ⛔ **상점 창구가 없어졌다** — `sellPot`·`sellCutting` 은 부르면 던진다
     B  ★★ **세 걸음** — 올리기 → 연락 → 거래. 돈은 마지막 걸음에서만 움직인다
     C  ★★ **1~7일** — 연락은 반드시 오고, 7일을 안 넘긴다 · 같은 판은 같은 날에 온다
     D  ★★ **잎 2장** — 문이 그때 열리고, **한 번 열리면 안 닫힌다**
     E  ★ **취소** — 내리면 아무 일도 없던 것이 된다 (물건도 지갑도 그대로)
     F  ★★ **세이브** — 올려 둔 것이 저장 왕복에서 살아난다 · 옛 판이 안 깨진다
     G  ★ **하루 루프에 붙어 있나** — `loop.nextDay` 가 연락을 가져오나
     H  ★ **값은 안 흔들린다** — 올릴 때 매긴 값이 그대로 들어온다
     I  ★ **판 돈 통** — 갈래가 안 늘었다. 그루는 pot, 삽수는 cutting 그대로다

     node tools/test_market.mjs
============================================================ */
import assert from 'node:assert';
import fs from 'node:fs';
import { newState } from '../src/game/state.js';
import { createTutorialState, hasSoldVarieCutting } from '../src/game/tutorial.js';
import {
  shopOf, saleLedgerOf, SALE_KINDS, priceOf,
  listPot, listCutting, stepMarket, dealListing, cancelListing,
  marketGate, marketStatus, marketOf, listingOf, listingFor, isListed,
  marketWaitKo, MARKET_MIN_LEAVES, MARKET_CONTACT_DAYS, MARKET_KINDS,
  sellPot, sellCutting
} from '../src/game/shop.js';
import { takeCutting, stepCuttings } from '../src/game/propagation.js';
import { serialize, deserialize as _deserialize } from '../src/game/save.js';

/* 형태(growth)는 여기서 재는 것이 아니다 — 그 계약은 tools/test_save.mjs 가 고정한다 */
const deserialize = (blob) => _deserialize(blob, { allowMissingGrowth: true });

const results = [];
const check = (name, fn) => { try { fn(); results.push(['PASS', name]); }
                              catch (e) { results.push(['FAIL', name, e.message]); } };
const info = (s) => results.push(['INFO', '  ' + s]);
const won = n => Math.round(n).toLocaleString() + '원';

function newGame(seed = 12345) {
  const S = newState({ room: 'banjiha', mode: 'novice' });
  S.day = 1;
  S.sim.seed = seed;
  S.tutorial = createTutorialState({ enabled: true });
  S.tutorial.day = 1;
  S.tutorial.cashWon = 0;
  S.pots = [{ id: 'pot_01', species: 'monstera', at: null, slotId: null, cuts: [] }];
  return S;
}
const give = (S, item, n = 1) => { const sh = shopOf(S); sh.stock[item] = (sh.stock[item] || 0) + n; };
/* ⚠ **문을 손으로 연다.** 이 하네스에는 growth 가 없어 잎을 세어 줄 창구가 없다 —
   마디 목록을 손으로 지어내는 것과 같은 지름길이다. 화면은 `drawShop` 이 잎 수를 넘긴다.
   ★ §D 만은 이 지름길을 안 쓴다 — 거기서 재는 것이 바로 그 문이다. */
const openMarket = (S) => marketGate(S, { leaves: MARKET_MIN_LEAVES });
const nodesOf = (leaves, varie) => ([
  { nodeId: 'n0#0', stem: 'pink', leaves: 3, variegatedLeaves: 0, growthDays: 100 },
  { nodeId: 'n0#1', stem: 'pink', leaves, variegatedLeaves: varie, growthDays: 100 }
]);
/* 뿌리내릴 때까지 하루씩 흘린다. ★ `stepMarket` 도 같이 돈다 — 하루의 일이다 */
function tick(S) { S.day += 1; S.tutorial.day += 1; stepCuttings(S); return stepMarket(S); }
function rootedCutting(S, { leaves = 1, varie = 0 } = {}) {
  give(S, 'jar');
  const c = takeCutting(S, { nodes: nodesOf(leaves, varie), nodeId: 'n0#1', container: 'jar' });
  for (let i = 0; i < 400 && c.status === 'rooting'; i++) tick(S);
  return c;
}

/* ══ A · ⛔ 상점 창구가 없어졌다 ═══════════════════════════════════════ */
check('A ⛔ 몬스테라 것은 상점에서 안 팔린다 — 옛 창구는 던진다', () => {
  const S = newGame();
  for (const [ko, fn] of [['sellPot', () => sellPot(S, { leaves: 3 })],
                          ['sellCutting', () => sellCutting(S, 'x')]]) {
    let msg = null;
    try { fn(); } catch (e) { msg = e.message; }
    assert.ok(msg, `★${ko} 이(가) 아직 조용히 돕니다 — 누르면 바로 팔리는 길이 남아 있습니다`);
    /* ★ 던지는 것만으로는 모자라다 — **어디로 가야 하는지**가 그 말 안에 있어야 한다 */
    assert.ok(/listPot|listCutting/.test(msg) && /dealListing/.test(msg),
      `★${ko} 이 던지기는 하는데 옮겨 갈 길을 안 알려 줍니다: ${msg}`);
  }
  info('sellPot·sellCutting — 둘 다 던지고, 그 말이 listPot/listCutting → dealListing 을 가리킨다');
});

/* ══ B · ★★ 세 걸음 — 돈은 마지막 걸음에서만 움직인다 ═══════════════════ */
check('B ★★올리기 → 연락 → 거래. **올려도 돈이 안 들어온다**', () => {
  const S = newGame(); openMarket(S);
  const c = rootedCutting(S, { leaves: 1, varie: 1 });
  const cash0 = S.tutorial.cashWon, earned0 = shopOf(S).earnedWon;

  const r = listCutting(S, c.id);
  assert.equal(S.tutorial.cashWon, cash0, '★올렸는데 지갑이 움직였습니다');
  assert.equal(shopOf(S).earnedWon, earned0, '★올렸는데 판 돈이 늘었습니다');
  assert.ok((S.cuttings || []).some(x => x.id === c.id), '★올렸는데 삽수가 사라졌습니다');
  assert.equal(r.listing.status, 'waiting', '★올리자마자 연락이 왔습니다');

  /* 연락 전에는 못 판다 — 그리고 그 까닭을 말한다 */
  let msg = null; try { dealListing(S, r.listing.listingId); } catch (e) { msg = e.message; }
  assert.ok(msg && /연락/.test(msg), `★연락도 안 왔는데 거래가 됐습니다 (${msg})`);

  while (marketStatus(S).contacted.length === 0) tick(S);
  assert.equal(S.tutorial.cashWon, cash0, '★연락만 왔는데 돈이 들어왔습니다');

  const d = dealListing(S, r.listing.listingId);
  assert.equal(S.tutorial.cashWon, cash0 + d.won, '★거래했는데 들어온 돈이 다릅니다');
  assert.equal((S.cuttings || []).some(x => x.id === c.id), false, '★거래했는데 삽수가 남아 있습니다');
  assert.equal(marketOf(S).length, 0, '★거래했는데 게시글이 남아 있습니다');
  info(`올림 0원 → 연락 0원 → 거래 ${won(d.won)} — 돈은 **마지막 걸음**에서만 움직인다`);
});

check('B-2 ★그루도 같다 — 올려도 방에서 안 없어진다', () => {
  const S = newGame(); openMarket(S);
  const r = listPot(S, { leaves: 11, variegatedLeaves: 3 });
  assert.equal((S.pots || []).length, 1, '★올렸는데 화분이 방에서 사라졌습니다');
  assert.equal(isListed(S, S.pots[0]), true, '★올렸는데 화분이 올라간 줄 모릅니다');
  /* ★ 3D 는 **거래할 때** 지운다 — 올릴 때 지우면 취소가 되살릴 수 없다 */
  assert.equal(!!r.growthNeedsReset, false, '★올리기만 했는데 growth 를 지우라고 합니다');
  while (marketStatus(S).contacted.length === 0) tick(S);
  const d = dealListing(S, r.listing.listingId);
  assert.equal((S.pots || []).length, 0, '★거래했는데 화분이 남아 있습니다');
  assert.equal(d.growthNeedsReset, true, '★그루를 팔았는데 growth 를 안 지웁니다 — 유령이 남습니다');
  info(`그루 ${won(d.won)} — 올릴 때는 방에 있고, 거래해야 나간다`);
});

/* ══ C · ★★ 1~7일 ═════════════════════════════════════════════════════ */
check('C ★★연락은 반드시 오고, **7일을 안 넘긴다**', () => {
  const spread = new Map();
  for (let seed = 1; seed <= 200; seed++) {
    const S = newGame(seed); openMarket(S);
    const r = listPot(S, { leaves: 3, variegatedLeaves: 0 });
    const w = r.listing.waitDays;
    assert.ok(w >= MARKET_CONTACT_DAYS.min && w <= MARKET_CONTACT_DAYS.max,
      `★대기 ${w}일 — ${MARKET_CONTACT_DAYS.min}~${MARKET_CONTACT_DAYS.max}일 밖입니다`);
    spread.set(w, (spread.get(w) || 0) + 1);
  }
  /* ★ 「랜덤」이라면 한 값에 몰리면 안 된다 — 일곱 값이 다 나와야 한다 */
  assert.equal(spread.size, MARKET_CONTACT_DAYS.max - MARKET_CONTACT_DAYS.min + 1,
    `★대기 일수가 ${spread.size}가지뿐입니다 — 랜덤이 아닙니다`);
  const rows = [...spread.entries()].sort((a, b) => a[0] - b[0]);
  const avg = rows.reduce((n, [d, c]) => n + d * c, 0) / 200;
  info(`씨앗 200판 대기 분포 — ${rows.map(([d, c]) => `${d}일:${c}`).join(' · ')} · 평균 ${avg.toFixed(2)}일`);
  info(`화면에 뜨는 말: "${marketWaitKo()}" — ★며칠인지는 **안 적는다**(랜덤이 요점이다)`);
});

check('C-2 ★같은 판은 같은 날에 온다 — 씨앗 난수다(Math.random 이 아니다)', () => {
  const days = [0, 1].map(() => {
    const S = newGame(777); openMarket(S);
    return listPot(S, { leaves: 3, variegatedLeaves: 0 }).listing.contactOnDay;
  });
  assert.equal(days[0], days[1], '★같은 씨앗인데 연락 오는 날이 다릅니다 — 세이브를 다시 열면 달라집니다');
  const other = (() => { const S = newGame(778); openMarket(S);
    return listPot(S, { leaves: 3, variegatedLeaves: 0 }).listing.waitDays; })();
  info(`씨앗 777 → Day ${days[0]} (두 번 다 같다) · 씨앗 778 → ${other}일 대기`);
});

/* ══ D · ★★ 잎 2장 — 문 ══════════════════════════════════════════════ */
check('D ★★잎 2장이 되어야 열린다 — 그리고 **왜인지를 말한다**', () => {
  const S = newGame();
  const g0 = marketGate(S, { leaves: 1 });
  assert.equal(g0.open, false, `★잎 1장인데 열렸습니다`);
  assert.ok(g0.reason && g0.reason.includes(String(MARKET_MIN_LEAVES)),
    `★문턱이 안 적혀 있습니다: ${g0.reason}`);
  /* ⚠ 던지는 말도 그 까닭을 들고 있어야 한다 — 「왜 안 팔리지」가 안 생기게 */
  let msg = null;
  try { listPot(S, { leaves: 1, variegatedLeaves: 0 }); } catch (e) { msg = e.message; }
  assert.ok(msg && msg.includes(String(MARKET_MIN_LEAVES)),
    `★잎이 모자란데 까닭을 안 말합니다: ${msg}`);

  const g1 = marketGate(S, { leaves: MARKET_MIN_LEAVES });
  assert.equal(g1.open, true, '★잎 2장인데 안 열립니다');
  assert.equal(g1.openedOnDay, S.day, '★열린 날이 안 적혔습니다');
  info(`잎 1장: "${g0.reason}"`);
  info(`잎 ${MARKET_MIN_LEAVES}장: 열림 (Day ${g1.openedOnDay}) — ` +
       `★프롤로그가 잎 2·3장에 무늬를 보장하므로 **무늬가 처음 나는 날**과 같은 날이다`);
});

check('D-2 ★★한 번 열리면 안 닫힌다 — 그루를 팔아도 삽수는 팔 수 있다', () => {
  const S = newGame(); marketGate(S, { leaves: MARKET_MIN_LEAVES });
  /* ⚠ 삽수를 **먼저** 손에 쥔다 — 자르려면 모주가 있어야 한다(propagation §자를 모주) */
  const c = rootedCutting(S, { leaves: 1, varie: 1 });
  const r = listPot(S, { leaves: 3, variegatedLeaves: 0 });
  while (!listingOf(S, r.listing.listingId) || listingOf(S, r.listing.listingId).status !== 'contacted') tick(S);
  dealListing(S, r.listing.listingId);
  assert.equal((S.pots || []).length, 0, '하네스가 틀렸습니다 — 그루가 안 팔렸습니다');
  /* 이제 잎을 셀 그루가 없다. 그래도 문은 열려 있어야 한다 */
  const g = marketGate(S, {});
  assert.equal(g.open, true,
    '★그루를 팔았더니 문이 닫혔습니다 — 판 것 때문에 못 팔게 되는 것은 말이 안 됩니다');
  listCutting(S, c.id);                       // 던지면 여기서 실패한다
  info(`그루를 판 뒤에도 삽수를 올릴 수 있다 (문이 열린 날 Day ${g.openedOnDay})`);
});

/* ══ E · ★ 취소 ═══════════════════════════════════════════════════════ */
check('E ★내리면 아무 일도 없던 것이 된다 — 물건도 지갑도 그대로', () => {
  const S = newGame(); openMarket(S);
  const c = rootedCutting(S, { leaves: 1, varie: 1 });
  const cash0 = S.tutorial.cashWon;
  const l = listCutting(S, c.id).listing;
  while (marketStatus(S).contacted.length === 0) tick(S);      // 연락이 와도 무를 수 있다
  cancelListing(S, l.listingId);
  assert.equal(S.tutorial.cashWon, cash0, '★내렸는데 지갑이 움직였습니다');
  assert.equal(marketOf(S).length, 0, '★내렸는데 게시글이 남아 있습니다');
  assert.ok((S.cuttings || []).some(x => x.id === c.id), '★내렸는데 삽수가 사라졌습니다');
  assert.equal(isListed(S, S.cuttings.find(x => x.id === c.id)), false,
    '★내렸는데 삽수가 아직 올라간 줄 압니다 — 다시 못 올립니다');
  assert.equal(hasSoldVarieCutting(S.tutorial), false, '★내렸는데 「무늬 삽수를 판 적」이 생겼습니다');
  /* 다시 올릴 수 있어야 한다 — 못 올리면 그 삽수는 갇힌 것이다 */
  const again = listCutting(S, c.id).listing;
  assert.ok(again.listingId !== l.listingId, '★같은 게시글 번호가 다시 났습니다');
  info('내리기 — 지갑 0원 · 삽수 그대로 · 다시 올릴 수 있다');
});

check('E-2 ★같은 물건을 두 번 못 올린다 — 두 벌로 팔리면 값이 두 배가 된다', () => {
  const S = newGame(); openMarket(S);
  const c = rootedCutting(S, { leaves: 1, varie: 1 });
  listCutting(S, c.id);
  let msg = null; try { listCutting(S, c.id); } catch (e) { msg = e.message; }
  assert.ok(msg && /이미/.test(msg), `★같은 삽수를 두 번 올릴 수 있습니다 (${msg})`);
  let msg2 = null;
  try { listPot(S, { leaves: 3, variegatedLeaves: 0 }); listPot(S, { leaves: 3, variegatedLeaves: 0 }); }
  catch (e) { msg2 = e.message; }
  assert.ok(msg2 && /이미/.test(msg2), `★같은 그루를 두 번 올릴 수 있습니다 (${msg2})`);
  info('두 번째 올리기는 던진다 — 삽수도 그루도');
});

check('E-3 ★팔 물건이 없어지면 게시글이 **말하면서** 내려간다', () => {
  const S = newGame(); openMarket(S);
  const c = rootedCutting(S, { leaves: 1, varie: 0 });
  listCutting(S, c.id);
  /* 분갈이를 안 하면 시든다(propagation §혹) — 그때 게시글이 어떻게 되나 */
  let withdrawn = null;
  for (let i = 0; i < 400 && !withdrawn; i++) {
    const r = tick(S);
    if (r.withdrawn.length) withdrawn = r;
  }
  assert.ok(withdrawn, '★삽수가 시들었는데 게시글이 그대로 남았습니다 — 유령 게시글입니다');
  assert.equal(marketOf(S).length, 0, '★내려갔다면서 게시글이 남아 있습니다');
  assert.ok(withdrawn.events.some(e => e.id === 'market_withdrawn'),
    '★게시글이 **조용히** 사라졌습니다 — 사건으로 말해야 합니다');
  info(`시든 삽수의 게시글 — "${withdrawn.events[0].ko}"`);
});

/* ══ F · ★★ 세이브 ═══════════════════════════════════════════════════ */
check('F ★★올려 둔 것이 저장 왕복에서 살아난다', () => {
  const S = newGame(4242); openMarket(S);
  const c = rootedCutting(S, { leaves: 1, varie: 1 });
  const l = listCutting(S, c.id).listing;
  const potL = listPot(S, { leaves: 5, variegatedLeaves: 2 }).listing;

  const S2 = deserialize(serialize(S));
  const m2 = marketStatus(S2);
  assert.equal(m2.count, 2, `★게시글 2건을 저장했는데 ${m2.count}건이 열렸습니다`);
  const back = listingOf(S2, l.listingId);
  assert.ok(back, '★삽수 게시글이 사라졌습니다');
  assert.equal(back.won, l.won, '★저장 왕복에 값이 달라졌습니다');
  assert.equal(back.contactOnDay, l.contactOnDay, '★연락 오는 날이 밀렸습니다');
  assert.equal(back.buyerKo, l.buyerKo, '★연락한 사람이 바뀌었습니다');
  /* ★ 표도 같이 살아야 한다 — 안 그러면 화면이 [올리기]를 또 내민다 */
  assert.equal(isListed(S2, (S2.cuttings || []).find(x => x.id === c.id)), true,
    '★삽수가 자기가 올라간 줄 모릅니다');
  assert.equal(isListed(S2, S2.pots[0]), true, '★그루가 자기가 올라간 줄 모릅니다');
  assert.equal(shopOf(S2).marketOpenedOnDay, shopOf(S).marketOpenedOnDay, '★문이 열린 날이 안 살았습니다');
  /* 그리고 열린 판에서 그대로 거래가 된다 */
  while (listingOf(S2, potL.listingId).status !== 'contacted') tick(S2);
  const d = dealListing(S2, potL.listingId);
  assert.equal(d.won, potL.won, '★열어서 판 값이 다릅니다');
  info(`게시글 2건 · 값 ${won(l.won)}/${won(potL.won)} · 연락일·산 사람까지 그대로 살아난다`);
});

check('F-2 ★★옛 세이브(게시글 칸이 없는 판)가 그대로 열린다', () => {
  const S = newGame();
  /* ⚠ `serialize` 가 내는 것은 **봉투**다 — 상태는 `blob.state` 아래에 있다 */
  const blob = JSON.parse(JSON.stringify(serialize(S)));
  /* 옛 판 흉내 — 상점에서 중고 거래 칸을 통째로 뺀다 */
  delete blob.state.shop.listings; delete blob.state.shop.listSeq;
  delete blob.state.shop.marketOpenedOnDay;
  const S2 = deserialize(blob);
  assert.deepEqual(marketOf(S2), [], '★옛 판에 게시글이 생겼습니다');
  assert.equal(shopOf(S2).marketOpenedOnDay ?? null, null, '★옛 판인데 문이 열려 있습니다');
  assert.equal(marketGate(S2, {}).open, false, '★옛 판인데 문이 열려 있습니다');
  info('옛 판 — 게시글 0건 · 문은 잎 2장을 보면 그때 열린다 (던지지 않는다)');
});

check('F-3 ★한쪽만 남은 판을 고친다 — 유령 게시글도, 유령 표시도 안 남는다', () => {
  const S = newGame(); openMarket(S);
  const c = rootedCutting(S, { leaves: 1, varie: 0 });
  const l = listCutting(S, c.id).listing;
  const blob = JSON.parse(JSON.stringify(serialize(S)));
  /* ㉮ 물건이 없는 게시글 — 삽수만 지운다 */
  const a = JSON.parse(JSON.stringify(blob)); a.state.cuttings = [];
  const Sa = deserialize(a);
  assert.equal(marketOf(Sa).length, 0, '★팔 물건이 없는 게시글이 살아 있습니다');
  /* ㉯ 게시글이 없는 표시 — 게시글만 지운다 */
  const b = JSON.parse(JSON.stringify(blob)); b.state.shop.listings = [];
  const Sb = deserialize(b);
  assert.equal(isListed(Sb, (Sb.cuttings || [])[0]), false, '★없는 게시글을 가리키는 표시가 남았습니다');
  assert.equal((Sb.cuttings || [])[0].listing, undefined, '★표시가 안 지워졌습니다');
  info(`한쪽만 남은 판 둘 — 게시글 ${l.listingId} 은 내려가고, 표시는 지워진다`);
});

/* ══ G · ★ 하루 루프에 붙어 있나 ══════════════════════════════════════
   ⚠ `loop.nextDay` 는 조도·생장 창구를 요구한다. 여기서 재는 것은 **배선 한 줄**이므로
     통째로 부르지 않고 `loop.js` 가 그 줄을 갖고 있는지를 **글자로** 확인한다.
   ⇒ 실제로 도는지는 `test_cutting_wiring §F`(하루씩 흘려 연락을 받는다)와
     `test_banjiha_routes`(240일 재현)가 잰다. 여기서는 **줄이 사라지는 것**만 막는다. */
check('G ★loop.nextDay 가 stepMarket 을 부른다 (배선이 사라지면 조용히 안 팔린다)', () => {
  const src = fs.readFileSync(new URL('../src/game/loop.js', import.meta.url), 'utf8');
  assert.ok(/stepMarket\s*\(/.test(src), '★loop.js 가 stepMarket 을 안 부릅니다 — 연락이 영영 안 옵니다');
  assert.ok(/turn\.market/.test(src), '★turn.market 이 안 실립니다 — 배너가 연락을 못 말합니다');
  info('loop.js — stepShop 바로 뒤에 stepMarket · turn.market 이 사건 목록에 실린다');
});

/* ══ H · ★ 값은 안 흔들린다 ══════════════════════════════════════════ */
check('H ★★올릴 때 매긴 값이 **그대로** 들어온다 — 깎는 사람이 없다', () => {
  const S = newGame(); openMarket(S);
  const want = priceOf({ leaves: 11, variegatedLeaves: 3 }).won;
  const r = listPot(S, { leaves: 11, variegatedLeaves: 3 });
  assert.equal(r.listing.won, want, '★올리는 자리에서 값이 달라졌습니다');
  while (marketStatus(S).contacted.length === 0) tick(S);
  const d = dealListing(S, r.listing.listingId);
  assert.equal(d.won, want, '★거래에서 값이 달라졌습니다 — 화면이 적은 값과 들어온 돈이 갈립니다');
  assert.equal(S.tutorial.cashWon, want, '★지갑에 들어온 값이 다릅니다');
  info(`하프문(잎 11장 중 무늬 3장) ${won(want)} — 올릴 때와 받을 때가 **한 원도** 안 다르다`);
  info(`⇒ 이사비 2,000,000원까지 여유 ${won(want - 2_000_000)} (${((want / 2e6 - 1) * 100).toFixed(1)}%) — ` +
       `**값을 ±10% 흔들면 탈출이 동전던지기가 된다.** 그래서 안 흔들었다`);
});

/* ══ I · ★ 판 돈 통 ══════════════════════════════════════════════════ */
check('I ★갈래가 안 늘었다 — 그루는 pot, 삽수는 cutting 그대로다', () => {
  assert.deepEqual([...MARKET_KINDS], ['pot', 'cutting'], '★게시 갈래가 바뀌었습니다');
  for (const k of MARKET_KINDS)
    assert.ok(SALE_KINDS.includes(k), `★게시 갈래 ${k} 가 SALE_KINDS 에 없습니다 — credit 이 던집니다`);

  const S = newGame(); openMarket(S);
  const c = rootedCutting(S, { leaves: 1, varie: 1 });
  const lc = listCutting(S, c.id).listing;
  const lp = listPot(S, { leaves: 3, variegatedLeaves: 0 }).listing;
  while (marketStatus(S).contacted.length < 2) tick(S);
  const dc = dealListing(S, lc.listingId), dp = dealListing(S, lp.listingId);

  const L = saleLedgerOf(S);
  assert.equal(L.byKind.cutting, dc.won, '★삽수 통이 안 맞습니다');
  assert.equal(L.byKind.pot, dp.won, '★그루 통이 안 맞습니다');
  assert.equal(L.plantWon, dc.won + dp.won, '★「식물 판 것」이 안 맞습니다');
  assert.equal(L.balanced, true, '★합계와 갈래별 합이 갈렸습니다');
  info(`중고로 팔아도 통은 그대로 — 삽수 ${won(L.byKind.cutting)} · 그루 ${won(L.byKind.pot)} · ` +
       `식물 ${won(L.plantWon)} (갈래 ${SALE_KINDS.length}가지 그대로)`);
});

check('I-2 ★유리병은 거래할 때 돌아온다 (올릴 때가 아니다)', () => {
  const S = newGame(); openMarket(S);
  const c = rootedCutting(S, { leaves: 1, varie: 0 });
  const jar0 = shopOf(S).stock.jar || 0;
  const l = listCutting(S, c.id).listing;
  assert.equal(shopOf(S).stock.jar || 0, jar0, '★올리기만 했는데 병이 돌아왔습니다');
  while (marketStatus(S).contacted.length === 0) tick(S);
  const d = dealListing(S, l.listingId);
  assert.equal(shopOf(S).stock.jar || 0, jar0 + 1, '★거래했는데 병이 안 돌아왔습니다');
  assert.equal(d.containerReturned, 'jar', '★무엇이 돌아왔는지 안 알려 줍니다');
  info('물꽂이 병 — 거래한 날 하나 돌아온다');
});

/* ══ 출력 ══════════════════════════════════════════════════════════════ */
let fail = 0;
for (const [tag, name, msg] of results) {
  if (tag === 'INFO') { console.log(name); continue; }
  if (tag === 'FAIL') fail++;
  console.log(`${tag}  ${name}${msg ? '\n      → ' + msg : ''}`);
}
console.log(`\nmarket: ${fail ? `FAIL (${fail}건)` : 'PASS'}`);
process.exit(fail ? 1 : 0);
