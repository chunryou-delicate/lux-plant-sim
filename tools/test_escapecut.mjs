/* ============================================================
   tools/test_escapecut.mjs — **반지하 탈출의 둘째 축**이 실제로 도는가
   ------------------------------------------------------------
   2026-08-13 박사님 확정: *"탈출 조건을 2개로 하지. 돈이랑 무늬 삽수 팔기."*

       탈출 = 돈(이사비)  AND  무늬 삽수를 판 적이 있다

   여기서 재는 것은 **조건의 모양**이지 밸런스가 아니다(며칠 걸리나는
   tools/test_banjiha_routes.mjs · test_ending_flow.mjs 가 잰다).

     A  조건의 모양 — 한 축씩으로는 안 열리고, 둘이 차면 열린다
     B  ★ 뜻과 손이 안 갈린다 — `shop.sellCutting` 이 적는 것과
        `tutorial.noteVarieCuttingSale` 이 적는 것이 **같은 값**이다
     C  ★★ 판정 근거는 **「무늬로 값이 매겨져 팔린 삽수」** 하나다 —
        고스트도 쳐지고, 민무늬는 안 쳐지고, **안 판 것**도 안 쳐진다
     D  세이브 왕복 — 판 사실이 살아난다
     E  ★★ 옛 세이브(칸 없음)가 방에 갇히지 않는다 — 이관 네 갈래
     F  화면이 말한다 — 잠긴 사유가 바뀔 때마다 사건이 난다

     node tools/test_escapecut.mjs
============================================================ */
import assert from 'node:assert';

import { newState } from '../src/game/state.js';
import {
  TUTORIAL_RULES, createTutorialState, canMoveOut, moveOut, tutorialGoal,
  noteVarieCuttingSale, hasSoldVarieCutting, createVarieSaleState, noteLearning
} from '../src/game/tutorial.js';
import { takeCutting, stepCuttings } from '../src/game/propagation.js';
import { listCutting, stepMarket, dealListing, cancelListing, marketGate, MARKET_MIN_LEAVES,
         shopOf, priceOf } from '../src/game/shop.js';

/* ══ ★★ 2026-08-17 — **파는 것이 두 걸음이 됐다** (shop.js §⑦-0) ═══════════════════
   ------------------------------------------------------------
   예전 이 파일은 `sellCutting(S, c.id)` 한 줄로 팔았고, **그 한 줄이 「누르면 그 자리에서
   돈이 들어오고 그때 깃발이 선다」를 못 박고 있었다.** 그것이 이번에 바뀐 약속이다.
   ★★ 이 검사에 **새 절이 하나 늘었다** — B-2. 깃발이 **어느 걸음**에서 서는지를 못 박는다:
     올리기만 해서는 **안 선다**(올렸다 내리면 아무 일도 없어야 한다) · 거래에서 선다.
   ⚠ 여기서 재는 것은 **조건의 모양**이지 며칠 걸리나가 아니므로 날짜만 밀어 거래까지 간다
     (그건 `test_market` · `test_banjiha_routes` 가 잰다). **지름길이라 적는다.**
   ⚠ **문을 손으로 연다** — 이 하네스에는 growth 가 없어 잎을 세어 줄 창구가 없다
     (마디 목록 `nodesOf` 를 손으로 지어내는 것과 같은 지름길이다). */
const openMarket = (S) => marketGate(S, { leaves: MARKET_MIN_LEAVES });
function dealNow(S, listing) {
  const back = S.day;
  S.day = Math.max(S.day, listing.contactOnDay);
  stepMarket(S);
  const r = dealListing(S, listing.listingId);
  S.day = back;
  return r;
}
const sellCutting = (S, id) => (openMarket(S), dealNow(S, listCutting(S, id).listing));
import { serialize, deserialize as _deserialize } from '../src/game/save.js';

/* ★ 형태(growth)는 여기서 재는 것이 아니다 — 화분이 있는 세이브라 창을 요구하는데,
   그 계약은 tools/test_save.mjs 가 따로 고정한다. 여기서는 **명시적으로** 없이 연다. */
const deserialize = (blob) => _deserialize(blob, { allowMissingGrowth: true });

const results = [];
const check = (name, fn) => { try { fn(); results.push(['PASS', name]); }
                              catch (e) { results.push(['FAIL', name, e.message]); } };
const info = (s) => results.push(['INFO', '  ' + s]);

/* ── 판 하나 ────────────────────────────────────────────────────────────
   ★ `tutorial.enabled` 를 켜야 지갑이 돌고(shop.credit) 이 조건이 산다.
     첫 플레이는 안 켠다 — 여기서 재는 것은 콩나물이 아니다. */
function newGame({ cash = 0 } = {}) {
  const S = newState({ room: 'banjiha', mode: 'novice' });
  S.day = 1;
  S.tutorial = createTutorialState({ enabled: true });
  S.tutorial.day = 1;
  S.tutorial.cashWon = cash;
  S.pots = [{ id: 'pot_01', species: 'monstera', at: null, slotId: null, cuts: [] }];
  return S;
}
const give = (S, item, n = 1) => { const sh = shopOf(S); sh.stock[item] = (sh.stock[item] || 0) + n; };

/* growth 가 낼 법한 마디 목록. ★잎 수는 지어내는 것이 아니라 **인자로 받는다** —
   이 파일이 재는 것은 잎 수가 아니라 「무늬가 실린 판매인가」다. */
const nodesOf = (leaves, varie) => ([
  { nodeId: 'n0#0', stem: 'pink', leaves, variegatedLeaves: varie, growthDays: 100 },
  { nodeId: 'n0#1', stem: 'pink', leaves: 1, variegatedLeaves: varie >= 1 ? 1 : 0, growthDays: 100 }
]);

/* 삽수 하나를 **팔 수 있는 데까지** 굴린다. 날짜는 propagation 이 정한다 —
   여기서 12 를 적지 않는다(그 값이 바뀌면 이 검사가 조용히 거짓말한다). */
function growUntilSellable(S, c) {
  for (let i = 0; i < 400 && c.status === 'rooting'; i++) { S.day += 1; stepCuttings(S); }
  return c;
}

/* 무늬 삽수를 한 개 잘라서 판다. 반환 { won, price } */
function cutAndSellVarie(S, { varie = 1 } = {}) {
  give(S, 'jar');
  const c = takeCutting(S, { nodes: nodesOf(3, varie), nodeId: 'n0#1', container: 'jar' });
  growUntilSellable(S, c);
  return sellCutting(S, c.id);
}

/* ══ A · 조건의 모양 ═══════════════════════════════════════════════════ */
check('A 한 축씩으로는 안 열린다 · 둘이 차면 열린다', () => {
  const a = createTutorialState({ enabled: true });
  a.cashWon = TUTORIAL_RULES.moveOutCostWon;
  assert.equal(canMoveOut(a).ok, false, '★돈만으로 열렸습니다');
  assert.equal(canMoveOut(a).money, true);
  assert.equal(canMoveOut(a).varie, false);

  const b = createTutorialState({ enabled: true });
  noteVarieCuttingSale(b, { variegatedLeaves: 1, won: 80_000 });
  assert.equal(canMoveOut(b).ok, false, '★무늬 삽수만으로 열렸습니다');

  b.cashWon = TUTORIAL_RULES.moveOutCostWon;
  assert.equal(canMoveOut(b).ok, true, '둘 다 찼는데 안 열립니다');
  assert.doesNotThrow(() => moveOut(b));
  assert.equal(b.movedOut, true);
});

/* ★ 배움 넷은 **조건에서 빠졌지만 계통은 살아 있다.** 지우면 확정 무늬(튜토의 마지막 장면)와
   화면 체크리스트가 같이 죽는다 — tutorial.js §두 축. */
check('A-2 ★배움 넷은 조건에서만 빠졌다 — 계통은 그대로 살아 있다', () => {
  const ts = createTutorialState({ enabled: true });
  assert.equal(canMoveOut(ts).learningLeft.length, 4, '배움 목록이 사라졌습니다');
  noteLearning(ts, { harvested: true, foodSavedWon: 5000, cropAvgDli: 0.1,
                     plantDli7: 3.8, plantMinDli: 3.0, spearFurled: true });
  assert.equal(canMoveOut(ts).learningLeft.length, 0);
  /* ★ 배움을 다 채워도 **문은 안 열린다** — 그것이 이번에 바뀐 약속이다 */
  ts.cashWon = TUTORIAL_RULES.moveOutCostWon;
  assert.equal(canMoveOut(ts).ok, false, '★배움 넷 + 돈으로 열렸습니다 — 옛 조건이 살아 있습니다');
});

/* ══ B · 뜻과 손이 안 갈린다 ═══════════════════════════════════════════
   ⚠ 적는 곳이 둘이다 — 뜻은 `tutorial.noteVarieCuttingSale`, 손은 `shop.dealListing` 안의
     여섯 줄(순환 import 를 피하려고 그렇게 뒀다 · tutorial.js §누가 적나).
     **둘이 갈리면 조용히 틀린다.** 그래서 여기서 등식을 고정한다. */
check('B ★파는 자리(shop)와 뜻을 가진 자리(tutorial)가 같은 값을 적는다', () => {
  const byShop = newGame();
  const r = cutAndSellVarie(byShop, { varie: 1 });
  assert.ok(r.price.variegatedLeaves >= 1, '무늬가 안 실린 판매였습니다 — 하네스가 틀렸습니다');

  const byCore = createTutorialState({ enabled: true });
  byCore.day = byShop.tutorial.day;
  noteVarieCuttingSale(byCore, { variegatedLeaves: r.price.variegatedLeaves, won: r.won });

  assert.deepEqual(
    { count: byShop.tutorial.varieSale.count, wonTotal: byShop.tutorial.varieSale.wonTotal,
      firstDay: byShop.tutorial.varieSale.firstDay },
    { count: byCore.varieSale.count, wonTotal: byCore.varieSale.wonTotal,
      firstDay: byCore.varieSale.firstDay },
    '★shop 이 적은 것과 tutorial 이 적는 것이 다릅니다 — 두 곳이 갈렸습니다');
  info(`무늬 삽수 한 장 ${r.won.toLocaleString()}원 (잎 ${r.price.leaves}장 중 무늬 ${r.price.variegatedLeaves}장)`);
});

/* ══ B-2 · ★★★ **깃발은 어느 걸음에서 서나** (2026-08-17 신설) ═══════════════════
   판매가 두 걸음이 되면서(shop.js §⑦-0) 이 질문이 새로 생겼다: 올리는 순간인가,
   돈이 들어오는 순간인가. **돈이 들어오는 순간**으로 정했고(§⑦-2), 여기서 못 박는다.
   ⚠ 안 박아 두면 언젠가 「올리기」 쪽으로 옮겨 붙고, 그러면 **올렸다 내리기만 해도**
     반지하 문이 열린다 — 「무늬 삽수를 판 적이 있다」가 그 자리에서 거짓이 된다. */
check('B-2 ★★올리기만으로는 안 열린다 — 돈이 들어오는 순간에 선다', () => {
  const S = newGame();
  openMarket(S);
  give(S, 'jar');
  const c = takeCutting(S, { nodes: nodesOf(3, 1), nodeId: 'n0#1', container: 'jar' });
  growUntilSellable(S, c);
  const l = listCutting(S, c.id).listing;
  assert.equal(hasSoldVarieCutting(S.tutorial), false,
    '★올리기만 했는데 축이 열렸습니다 — 올렸다 내리면 아무 일도 없어야 합니다');
  /* 연락이 와도 아직이다 — 「연락」은 사건이지 판매가 아니다 */
  S.day = l.contactOnDay; stepMarket(S);
  assert.equal(hasSoldVarieCutting(S.tutorial), false, '★연락만 왔는데 축이 열렸습니다');
  const r = dealListing(S, l.listingId);
  assert.equal(hasSoldVarieCutting(S.tutorial), true, '★거래했는데 축이 안 열립니다');
  info(`올림 → 연락 → 거래 ${r.won.toLocaleString()}원 — 축은 **마지막 걸음**에서만 열린다`);
});

/* ★ 내렸다 다시 올려도 판 것이 아니다 — 취소가 값을 만들지 않는다 */
check('B-3 ★내리면 아무 일도 없던 것이 된다 — 지갑도 축도 안 움직인다', () => {
  const S = newGame();
  openMarket(S);
  give(S, 'jar');
  const c = takeCutting(S, { nodes: nodesOf(3, 1), nodeId: 'n0#1', container: 'jar' });
  growUntilSellable(S, c);
  const cash0 = S.tutorial.cashWon, earned0 = shopOf(S).earnedWon;
  const l = listCutting(S, c.id).listing;
  S.day = l.contactOnDay; stepMarket(S);
  cancelListing(S, l.listingId);
  assert.equal(S.tutorial.cashWon, cash0, '★내렸는데 지갑이 움직였습니다');
  assert.equal(shopOf(S).earnedWon, earned0, '★내렸는데 판 돈이 늘었습니다');
  assert.equal(hasSoldVarieCutting(S.tutorial), false, '★내렸는데 축이 열렸습니다');
  assert.ok((S.cuttings || []).some(x => x.id === c.id), '★내렸는데 삽수가 사라졌습니다');
  info('내리기 — 지갑 0원 · 판 돈 0원 · 삽수 그대로');
});

/* ══ C · 판정 근거 하나 ════════════════════════════════════════════════ */
check('C-1 민무늬 삽수를 팔면 안 열린다', () => {
  const S = newGame();
  const r = cutAndSellVarie(S, { varie: 0 });
  assert.equal(r.price.variegatedLeaves, 0, '하네스가 무늬를 실었습니다');
  assert.equal(hasSoldVarieCutting(S.tutorial), false, '★민무늬를 팔았는데 조건이 열렸습니다');
  info(`민무늬 삽수 ${r.won.toLocaleString()}원 — 값은 되지만 축은 안 연다`);
});

check('C-2 ★★고스트도 「무늬 삽수」로 친다 — 계통이 아니라 **값**으로 잰다', () => {
  const S = newGame();
  give(S, 'jar');
  /* 달린 잎이 전부 무늬면 `w = 1` 이라 고스트가 확정이다(propagation §키메라 세 갈래).
     실측으로 지금 나는 무늬 삽수는 전부 이것이다(prologuevarie-to-plan §3-2). */
  const c = takeCutting(S, { nodes: nodesOf(3, 1), nodeId: 'n0#1', container: 'jar', lineage: 'ghost' });
  assert.equal(c.lineage, 'ghost', '고스트로 안 잘렸습니다 — 하네스가 틀렸습니다');
  growUntilSellable(S, c);
  const r = sellCutting(S, c.id);
  assert.equal(hasSoldVarieCutting(S.tutorial), true,
    '★고스트를 팔았는데 축이 안 열립니다 — 지금 나는 무늬 삽수는 전부 고스트라 아무도 못 나갑니다');
  info(`고스트 무늬 삽수 ${r.won.toLocaleString()}원 — 계통은 끊기지만 **판 적은 있다**`);
});

check('C-3 자르기만 해서는 안 열린다 — **판** 적이 있어야 한다', () => {
  const S = newGame();
  give(S, 'jar');
  const c = takeCutting(S, { nodes: nodesOf(3, 1), nodeId: 'n0#1', container: 'jar' });
  growUntilSellable(S, c);
  assert.equal(hasSoldVarieCutting(S.tutorial), false, '★안 팔았는데 열렸습니다');
  sellCutting(S, c.id);
  assert.equal(hasSoldVarieCutting(S.tutorial), true, '팔았는데 안 열립니다');
});

/* ══ D · 세이브 왕복 ═══════════════════════════════════════════════════ */
check('D 판 사실이 저장 왕복에서 살아난다', () => {
  const S = newGame({ cash: TUTORIAL_RULES.moveOutCostWon });
  cutAndSellVarie(S, { varie: 1 });
  assert.equal(canMoveOut(S.tutorial).ok, true);

  const blob = serialize(S);
  const S2 = deserialize(JSON.parse(JSON.stringify(blob)));
  assert.equal(S2.tutorial.varieSale.count, S.tutorial.varieSale.count, '판 횟수가 사라졌습니다');
  assert.equal(S2.tutorial.varieSale.firstDay, S.tutorial.varieSale.firstDay, '판 날이 사라졌습니다');
  assert.equal(S2.tutorial.varieSale.migrated, null, '실제로 판 것인데 이관 표시가 붙었습니다');
  assert.equal(canMoveOut(S2.tutorial).ok, true, '★이어하기에서 이사가 도로 잠겼습니다');
});

/* ══ E · ★★ 옛 세이브 이관 ═══════════════════════════════════════════
   옛 판을 만드는 법: **정상 세이브에서 `tutorial.varieSale` 칸을 통째로 지운다.**
   그것이 옛 저장본의 모양이다(그 칸이 없던 시절에 쓰인 것). */
function oldSaveOf(S) {
  const blob = JSON.parse(JSON.stringify(serialize(S)));
  delete blob.state.tutorial.varieSale;
  return blob;
}

check('E-0 옛 세이브가 그대로 열린다 (던지지 않는다)', () => {
  const S = newGame({ cash: 100 });
  const S2 = deserialize(oldSaveOf(S));
  assert.ok(S2.tutorial, '옛 세이브가 안 열렸습니다');
  assert.equal(S2.tutorial.varieSale.count, 0, '아무 근거도 없는데 열렸습니다');
  assert.equal(canMoveOut(S2.tutorial).varie, false);
});

check('E-1 ★이미 이사한 옛 판 — 되돌아가지 않는다', () => {
  const S = newGame({ cash: 500_000 });
  S.tutorial.movedOut = true;
  const S2 = deserialize(oldSaveOf(S));
  assert.equal(hasSoldVarieCutting(S2.tutorial), true, '★이미 나간 판이 도로 잠겼습니다');
  assert.equal(S2.tutorial.varieSale.migrated, 'moved-out');
});

check('E-2 ★옛 조건(돈 + 배움 넷)이 이미 참이던 판 — 약속을 안 뺏는다', () => {
  const S = newGame({ cash: TUTORIAL_RULES.moveOutCostWon });
  noteLearning(S.tutorial, { harvested: true, foodSavedWon: 5000, cropAvgDli: 0.1,
                             plantDli7: 3.8, plantMinDli: 3.0, spearFurled: true });
  const S2 = deserialize(oldSaveOf(S));
  assert.equal(canMoveOut(S2.tutorial).ok, true,
    '★저장할 때 [이사]가 열려 있던 판인데 이어하기에서 잠겼습니다');
  assert.equal(S2.tutorial.varieSale.migrated, 'old-gate');
});

check('E-3 ★확정 무늬 마디를 잘랐는데 그 삽수가 없는 판 — 판 것으로 친다', () => {
  const S = newGame({ cash: 100 });
  /* 확정 무늬를 한 장 받았고(count 1), 지금 모주에 붙어 있는 것은 없다(nodeIds 0)
     = 그 마디를 잘라냈다는 뜻이다. 그런데 살아 있는 무늬 삽수도 없다 ⇒ 손을 떠났다. */
  S.tutorial.varieGrant = { nodeIds: [], count: 1, lastDay: 40 };
  const S2 = deserialize(oldSaveOf(S));
  assert.equal(hasSoldVarieCutting(S2.tutorial), true, '★판 흔적이 있는데 안 열렸습니다');
  assert.equal(S2.tutorial.varieSale.migrated, 'varie-cut-gone');
});

check('E-4 ★아직 손에 들고 있으면 안 연다 — 관대하되 지어내지는 않는다', () => {
  const S = newGame({ cash: 100 });
  S.tutorial.varieGrant = { nodeIds: [], count: 1, lastDay: 40 };
  give(S, 'jar');
  takeCutting(S, { nodes: nodesOf(3, 1), nodeId: 'n0#1', container: 'jar' });   // 무늬 삽수를 들고 있다
  const S2 = deserialize(oldSaveOf(S));
  assert.equal(hasSoldVarieCutting(S2.tutorial), false,
    '★아직 안 판 삽수를 들고 있는데 「판 적 있다」가 됐습니다');
});

check('E-5 ★이관은 한 번뿐이다 — 이미 칸이 있는 세이브는 다시 안 연다', () => {
  const S = newGame({ cash: TUTORIAL_RULES.moveOutCostWon });
  noteLearning(S.tutorial, { harvested: true, foodSavedWon: 5000, cropAvgDli: 0.1,
                             plantDli7: 3.8, plantMinDli: 3.0, spearFurled: true });
  /* 칸은 있는데 0건이다 = 새 규칙으로 진행 중이고 아직 안 판 판이다. 열면 안 된다. */
  S.tutorial.varieSale = createVarieSaleState();
  const S2 = deserialize(JSON.parse(JSON.stringify(serialize(S))));
  assert.equal(hasSoldVarieCutting(S2.tutorial), false,
    '★「없다」와 「0건이다」를 뭉갰습니다 — 안 판 판이 저절로 열립니다');
});

/* ══ F · 화면이 말한다 ═════════════════════════════════════════════════
   ⚠ loop.narrativeEvents 는 안 export 되어 있다. 그래서 **문구를 내는 창구**
     (`canMoveOut.why` · `tutorialGoal`)를 직접 잰다 — 화면이 읽는 것이 그 둘이다. */
check('F 잠긴 까닭이 두 축으로 갈려서 나온다', () => {
  const ts = createTutorialState({ enabled: true });
  assert.match(canMoveOut(ts).why, /모자라고/, '둘 다 모자란데 한쪽만 말합니다');

  ts.cashWon = TUTORIAL_RULES.moveOutCostWon;
  assert.equal(canMoveOut(ts).why, '무늬 삽수를 아직 못 팔았습니다');
  assert.equal(tutorialGoal(ts).id, 'learn', '배움이 남았으면 그것부터 말해야 합니다');
  noteLearning(ts, { harvested: true, foodSavedWon: 5000, cropAvgDli: 0.1,
                     plantDli7: 3.8, plantMinDli: 3.0, spearFurled: true });
  assert.equal(tutorialGoal(ts).id, 'varie', '배움을 다 채웠으면 삽수를 말해야 합니다');

  noteVarieCuttingSale(ts, { variegatedLeaves: 1, won: 80_000 });
  ts.cashWon = 1_000;
  assert.match(canMoveOut(ts).why, /이사 자금이/, '돈만 모자란데 삽수를 말합니다');
  assert.equal(tutorialGoal(ts).id, 'money');

  ts.cashWon = TUTORIAL_RULES.moveOutCostWon;
  assert.equal(canMoveOut(ts).why, null, '열렸는데 사유가 남아 있습니다');
  assert.equal(tutorialGoal(ts).id, 'ready');
});

/* ── 결과 ─────────────────────────────────────────────────────────────── */
let fail = 0;
for (const [tag, name, msg] of results) {
  if (tag === 'INFO') { console.log('     ' + name); continue; }
  console.log(`${tag}  ${name}` + (msg ? `\n      → ${msg}` : ''));
  if (tag === 'FAIL') fail++;
}
console.log(`\nescapecut: ${fail ? `FAIL (${fail}건)` : 'PASS'}`);
process.exit(fail ? 1 : 0);
