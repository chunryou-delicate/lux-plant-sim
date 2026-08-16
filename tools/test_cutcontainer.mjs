/* ============================================================
   tools/test_cutcontainer.mjs — **삽수와 용기를 두 걸음으로 가른다** (2026-08-17)
   ------------------------------------------------------------
   박사님 원문(여섯 줄):
     ① 삽수하면 삽수된 줄기·잎은 **템 형식으로 가방에** 들어오도록
     ② **유리병을 먼저 가구처럼 배치**하고 거기다 넣고 싶은 삽수를 넣을 수 있도록
     ③ **수경은 다음 혹이 나면 성장을 멈추고**
     ④ 수경 중 팝업에 **다시 삽수 인벤으로**
     ⑤ **화분 배치 후 거기다가 심을 수 있도록**
     ⑥ **유리병도 클릭 시 인벤 회수 버튼**
   그리고 같은 날 추가: *"삽수 후 수경 안 하고 바로 화분 심는 것도 가능하도록 **동일하게**."*

   ★ 여기서 재는 것은 **코어뿐**이다 — 브라우저도 growth 창도 안 띄운다.
     잎 수는 지어내도 되는 자리다(마디 목록을 손으로 넘기는 것이 `takeCutting` 의 계약이고,
     실제 growth 마디로 재는 것은 `tools/test_cutting_wiring.mjs` 가 이미 한다).

     ① 용기 없이 자르면 삽수가 나고 **재고가 안 깎인다** · 자를 때 정해지는 것은 그대로 적힌다
     ② 빈 용기를 놓으면 재고가 깎이고, 걷으면 돌아온다 (jar · soil 둘 다)
     ③ 넣으면 물꽂이가 **그때부터** 돈다 (가방에 오래 둬도 기한이 안 앞당겨진다)
     ④ ★수경은 혹이 나면 잎이 안 는다 · **흙은 계속 자란다**(대조군)
     ⑤ 기한(죽는 것)이 그대로 돈다 — 걷지 않았다
     ⑥ 회수하면 가방으로 가고 **용기는 방에 빈 채로 남는다**
     ⑦ 삽수가 든 용기를 걷으려 하면 던진다
     ⑧ 옛 세이브·옛 호출부(용기를 정해 자른 판)가 그대로 돈다 · 세이브 왕복
     ⑨ ★흙도 **똑같이 두 걸음**이다 — 놓고 → 심고 → 45일 혹 · 안 죽는다
     ⑩ 잎 여러 장짜리는 **병에는 안 들어가고 화분에는 들어간다** (§WATER_LEAF_MAX)

     node tools/test_cutcontainer.mjs
============================================================ */
import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const _WATCHDOG_MS = +(process.env.BYEOT_PROBE_TIMEOUT_MS || 120000);
const _wd = setTimeout(() => {
  console.error('⏱ 자가 제한을 넘겨 멈춥니다 — 재는 중에 멈춘 것입니다.');
  process.exit(2);
}, _WATCHDOG_MS);
_wd.unref && _wd.unref();
process.on('exit', () => clearTimeout(_wd));

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const toUrl = (rel) => 'file:///' + path.join(ROOT, rel).replace(/\\/g, '/');

const P = await import(toUrl('src/game/propagation.js'));
const SH = await import(toUrl('src/game/shop.js'));
const ST = await import(toUrl('src/game/state.js'));
const SV = await import(toUrl('src/game/save.js'));

const results = [];
const check = (name, fn) => { try { fn(); results.push(['PASS', name]); }
                              catch (e) { results.push(['FAIL', name, e.message]); } };
const info = (s) => results.push(['INFO', s]);

/* ── 판 하나 ─────────────────────────────────────────────────────────────
   ★ 표 머리에 무엇을 켜고 껐는지 적는다(START-HERE §2 규칙 1):
     방 = 반지하 · 모드 = novice(기본) · 튜토 지갑 켬 · firstPlay 는 **끔**
     빛 = `lightOf` 를 아래 tick 이 넘긴다(하네스가 정한다 — 아래 ★빛 참고) */
function newGame({ novice = true, cash = 0 } = {}) {
  const S = ST.newState({ room: 'banjiha', mode: novice ? 'novice' : 'real' });
  S.day = 1;
  S.tutorial.enabled = true;
  S.tutorial.cashWon = cash;
  if (!novice) { S.sim.mode = 'real'; S.tutorial.movedOut = true; S.story.ending.doneOnDay = 0; }
  S.pots.push({ id: 'pot_01', plantId: 'monstera', slotId: 'banjiha-sill:0',
                at: null, variegated: false, gen: 0 });
  return S;
}
const give = (S, itemId, n = 1) => { SH.shopOf(S).stock[itemId] = (SH.shopOf(S).stock[itemId] || 0) + n; };
const stock = (S, itemId) => SH.stockOf(S, itemId);

/* 마디 하나 — growth 가 내는 모양 그대로(assertCutNode 를 통과한다) */
const node = (id, leaves, varie = 0, stem = 'thick', extra = {}) =>
  ({ nodeId: id, stem, leaves, variegatedLeaves: varie, growthDays: 143, ...extra });
const mother = (total, cut = 1, varie = 0) =>
  [node('n0#0', total, 0, 'main'), node('n0#1', cut, varie), node('n0#2', cut, varie)];
const PIECE = 'n0#1';
/* ★ 둘째 마디 — **같은 마디를 두 번 못 자른다**(§유한성 · `cutBlockedReason`).
   삽수 둘이 필요한 검사에서는 이 이름을 쓴다. 안 그러면 재는 자가 그 규칙에 걸려
   「용기 규칙을 잰다」고 해 놓고 **자르기 규칙을 재게** 된다. */
const PIECE2 = 'n0#2';

/* ★빛 — **하네스가 정한다.** 코어는 빛을 안 재고(`opt.lightOf` 로 받는다) 여기서는
   「자라는 빛」을 늘 준다. 안 주면 잎이 한 장도 안 나서 ④ 가 통째로 무의미해진다.
   ⚠ 밴드는 `best` 다 — 무늬 소질을 정하는 축(propagation §③)도 이 값을 본다. */
const LIT = () => ({ dli: 8, grows: true, band: 'best' });
function tick(S, opt = {}) {
  S.day++;
  return P.stepCuttings(S, { lightOf: LIT, ...opt });
}
/* 자리 하나 — 방 밖 검사를 안 타는 자유 좌표(place.resolvePlacement 의 free 길) */
const AT = (x = 1) => ({ x, y: 0.8, z: 1 });

/* ============================================================
   ① 용기 없이 자른다 — 가방으로 온다
============================================================ */
check('① 용기 없이 자르면 삽수가 나고 **재고가 한 톨도 안 깎인다**', () => {
  const S = newGame();
  give(S, 'jar', 3); give(S, 'pot', 3);
  const before = { jar: stock(S, 'jar'), pot: stock(S, 'pot') };
  const c = P.takeCutting(S, { nodes: mother(6, 2), nodeId: PIECE });
  assert.equal(c.status, 'bag', `가방이 아니라 ${c.status} 입니다`);
  assert.equal(c.container, null, '용기를 안 정했는데 용기가 적혔습니다');
  assert.equal(c.method, null, '용기를 안 정했는데 방식이 적혔습니다');
  assert.equal(c.at, null); assert.equal(c.slotId, null);
  assert.equal(stock(S, 'jar'), before.jar, '★유리병이 깎였습니다 — 용기는 놓을 때 깎습니다');
  assert.equal(stock(S, 'pot'), before.pot, '★모종포트가 깎였습니다');
  assert.equal(S.cuttings.length, 1);
});

check('① 자를 때 정해지는 것은 **그대로 다 적힌다** (무늬·등급·모주 생장일·씨앗)', () => {
  const S = newGame();
  const nodes = [node('n0#0', 6, 0, 'main'),
                 node('n0#1', 2, 1, 'thick', { leafGrades: [null, 'halfmoon'] })];
  const c = P.takeCutting(S, { nodes, nodeId: 'n0#1',
                               motherGrowthDays: 143.5, motherSeed: 92158, varieChance: 0.42 });
  assert.equal(c.source.leaves, 2);
  assert.equal(c.source.variegatedLeaves, 1);
  assert.equal(c.source.motherGrowthDays, 143.5, '모주 생장일이 안 적혔습니다 — 방이 그 가지를 못 그립니다');
  assert.equal(c.source.motherSeed, 92158, '모주 씨앗이 안 적혔습니다');
  assert.equal(c.variegated, true, '무늬 마디인데 무지로 났습니다');
  assert.equal(c.varieFromCut, true, '빛 판정 대상 표시가 안 붙었습니다');
  assert.equal(c.varieChance, 0.42, '모주 무늬율이 안 물려졌습니다');
  assert.deepEqual(c.leafGrade, [null, 'halfmoon'], '딸려온 잎 등급이 안 따라왔습니다');
  assert.equal(c.cutW, 0.5, 'cutW 가 안 적혔습니다');
  info(`  용기 없이 자른 삽수 — 잎 ${c.leaves}장(무늬 ${c.variegatedLeaves}) · ` +
       `등급 ${JSON.stringify(c.leafGrade)} · 모주 143.5일/seed 92158 · status=${c.status}`);
});

check('① 가방에 있는 동안은 **하루가 안 간다** (기한도 안 붙는다)', () => {
  const S = newGame();
  const c = P.takeCutting(S, { nodes: mother(6), nodeId: PIECE });
  for (let i = 0; i < 50; i++) tick(S);
  assert.equal(c.days, 0, `가방에서 ${c.days}일이 갔습니다 — 시계는 넣을 때 시작합니다`);
  assert.equal(c.status, 'bag');
  assert.equal(c.deadlineDay, null, '가방에 기한이 붙었습니다');
  assert.equal(S.cuttings.length, 1, '가방의 삽수가 사라졌습니다');
});

/* ============================================================
   ② 빈 용기를 놓고 · 걷는다
============================================================ */
check('② 빈 용기를 놓으면 재고가 깎이고, 걷으면 돌아온다 (jar · soil 둘 다)', () => {
  for (const kind of ['jar', 'soil']) {
    const itemId = P.CONTAINERS[kind].itemId;
    const S = newGame(); give(S, itemId, 2);
    const before = stock(S, itemId);
    const t = P.placeCutContainer(S, kind, AT());
    assert.equal(stock(S, itemId), before - 1,
      `${kind}: 놓았는데 재고가 안 깎였습니다 (${before} → ${stock(S, itemId)})`);
    assert.equal(P.cutContainersOf(S).length, 1, `${kind}: 방에 안 놓였습니다`);
    assert.ok(t.at && t.slotId, `${kind}: 자리가 안 잡혔습니다`);
    const r = P.removeContainer(S, t.id);
    assert.equal(r.returned, true, `${kind}: 안 쓴 용기를 걷었는데 안 돌아왔습니다`);
    assert.equal(stock(S, itemId), before, `${kind}: 걷었는데 재고가 안 돌아왔습니다`);
    assert.equal(P.cutContainersOf(S).length, 0, `${kind}: 걷었는데 방에 남아 있습니다`);
  }
});

check('② 재고가 없으면 못 놓는다 — 그리고 **아무것도 안 바뀐다**', () => {
  const S = newGame();
  assert.throws(() => P.placeCutContainer(S, 'jar', AT()), /유리 수경병|재고|주문/);
  assert.equal(P.cutContainersOf(S).length, 0, '못 놓았는데 목록에 남았습니다');
});

/* ============================================================
   ③ 넣으면 **그때부터** 돈다
============================================================ */
check('③ 넣으면 물꽂이가 그때부터 돈다 — days 가 넣은 날 기준이다', () => {
  const S = newGame(); give(S, 'jar');
  const c = P.takeCutting(S, { nodes: mother(6), nodeId: PIECE });
  for (let i = 0; i < 10; i++) tick(S);              // 가방에서 열흘
  const putDay = S.day;
  const t = P.placeCutContainer(S, 'jar', AT());
  P.putCuttingIn(S, c.id, t.id);
  assert.equal(c.status, 'rooting');
  assert.equal(c.days, 0, '넣었는데 days 가 0 이 아닙니다');
  assert.equal(c.clockOnDay, putDay, '시계 기준일이 넣은 날이 아닙니다');
  assert.equal(t.id, P.containerHolding(S, c.id).id, '용기가 삽수를 안 물고 있습니다');
  assert.deepEqual({ at: c.at, slotId: c.slotId }, { at: t.at, slotId: t.slotId },
    '삽수가 용기 자리로 안 갔습니다');
  const seen = {};
  for (let i = 0; i < 40; i++) { tick(S); if (!seen[c.status]) seen[c.status] = c.days; }
  assert.equal(seen.rooted, P.METHODS.water.rootDays,
    `뿌리가 넣고 ${seen.rooted}일에 났습니다 (${P.METHODS.water.rootDays}일이라야 합니다)`);
  assert.equal(seen.node, P.METHODS.water.nodeDays,
    `혹이 넣고 ${seen.node}일에 났습니다 (${P.METHODS.water.nodeDays}일이라야 합니다)`);
  info(`  가방 10일 → Day ${putDay} 에 병에 꽂음 → 뿌리 ${seen.rooted}일째 · 혹 ${seen.node}일째 ` +
       `(자른 날이 아니라 **넣은 날** 기준)`);
});

check('③ 한 용기에 하나 — 이미 든 병에 또 넣으면 던진다', () => {
  const S = newGame(); give(S, 'jar');
  const a = P.takeCutting(S, { nodes: mother(6), nodeId: PIECE });
  const b = P.takeCutting(S, { nodes: mother(6), nodeId: PIECE2, id: 'cut_09' });
  const t = P.placeCutContainer(S, 'jar', AT());
  P.putCuttingIn(S, a.id, t.id);
  let err = null;
  try { P.putCuttingIn(S, b.id, t.id); } catch (e) { err = e; }
  assert.ok(err, '한 병에 둘이 들어갔습니다');
  assert.ok(err.tutorialInput, '입력 오류인데 tutorialInput 이 안 붙었습니다 — 화면이 판을 잠급니다');
  assert.equal(b.status, 'bag', '실패했는데 둘째 삽수가 바뀌었습니다');
  assert.equal(P.containerHolding(S, a.id).id, t.id, '실패가 첫째를 밀어냈습니다');
});

/* ============================================================
   ④ ★수경은 혹이 나면 잎이 멈춘다 · 흙은 계속 자란다
============================================================ */
check('④ ★수경은 혹이 난 뒤 잎이 안 는다 (그리고 애초에 물꽂이는 잎을 안 낸다)', () => {
  const S = newGame(); give(S, 'jar');
  const c = P.takeCutting(S, { nodes: mother(6), nodeId: PIECE });   // 잎 1장
  const t = P.placeCutContainer(S, 'jar', AT());
  P.putCuttingIn(S, c.id, t.id);
  const row = [];
  for (let i = 0; i < 34; i++) {                    // 초보 기한(20+16=36)보다 짧게
    tick(S);
    if ([1, 12, 19, 20, 21, 28, 34].includes(c.days)) row.push(`${c.days}일:${c.leaves}장`);
  }
  assert.ok(c.nodeOnDay != null, '혹이 안 났습니다 — 재는 자가 못 미친 것입니다');
  assert.equal(c.leaves, 1, `물꽂이에서 잎이 ${c.leaves}장으로 늘었습니다`);
  assert.equal(c.grewLeaves, 0, '물꽂이가 잎을 냈습니다');
  assert.equal(P.leafGrowthStopped(c), true, '혹이 났는데 멈춤 표시가 안 섰습니다');
  info(`  물꽂이 잎 수 — ${row.join(' · ')} (혹 ${c.nodeOnDay ? '남' : '안 남'}) ⇒ 내내 평평하다`);
});

check('④ 대조군 — **흙은 혹이 나도 계속 자란다**(박사님 ③ 은 수경만이다)', () => {
  const S = newGame(); give(S, 'pot');
  const c = P.takeCutting(S, { nodes: mother(6, 2), nodeId: PIECE });   // 잎 2장(흙만 받는다)
  const t = P.placeCutContainer(S, 'soil', AT());
  P.putCuttingIn(S, c.id, t.id);
  const row = [];
  let atNode = null;
  for (let i = 0; i < 80; i++) {
    tick(S);
    if (c.nodeOnDay != null && atNode == null) atNode = c.leaves;
    if ([24, 43, 45, 63, 80].includes(c.days)) row.push(`${c.days}일:${c.leaves}장`);
  }
  assert.equal(c.nodeOnDay != null, true, '흙에서 혹이 안 났습니다');
  assert.equal(P.leafGrowthStopped(c), false, '★흙이 혹으로 멈췄습니다 — 박사님 ③ 은 수경만입니다');
  assert.ok(c.leaves > atNode,
    `★혹이 난 뒤(잎 ${atNode}장) 잎이 안 늘었습니다 — 지금 ${c.leaves}장`);
  info(`  흙 잎 수 — ${row.join(' · ')} · 혹 Day ${c.nodeOnDay} 에 ${atNode}장 → 80일에 ${c.leaves}장`);
});

check('④ 멈춤 규칙은 **수경에만** 걸린다 (leafGrowthStopped 계약)', () => {
  assert.equal(P.leafGrowthStopped({ method: 'water', nodeOnDay: 5 }), true);
  assert.equal(P.leafGrowthStopped({ method: 'water', nodeOnDay: null }), false);
  assert.equal(P.leafGrowthStopped({ method: 'pot', nodeOnDay: 5 }), false, '흙을 멈춰 세웠습니다');
  assert.equal(P.leafGrowthStopped({ method: null, nodeOnDay: 5 }), false, '가방을 멈춤으로 봤습니다');
});

/* ============================================================
   ⑤ 기한은 그대로 — 걷지 않았다
============================================================ */
check('⑤ 기한(죽는 것)이 **그대로 돈다** — 혹이 나면 멈추되 기한은 그대로다', () => {
  for (const novice of [true, false]) {
    const S = newGame({ novice }); give(S, 'jar');
    const c = P.takeCutting(S, { nodes: mother(6), nodeId: PIECE });
    for (let i = 0; i < 7; i++) tick(S);                 // 가방에서 이레
    const putDay = S.day;
    const t = P.placeCutContainer(S, 'jar', AT());
    P.putCuttingIn(S, c.id, t.id);
    const grace = novice ? P.METHODS.water.graceDaysNovice : P.METHODS.water.graceDays;
    let warns = 0, died = null;
    for (let i = 0; i < 80 && !died; i++) {
      const r = tick(S);
      warns += r.warnings.length;
      if (r.died.length) died = S.day;
    }
    assert.ok(died, `${novice ? '초보' : '자유'}: 분갈이를 안 했는데 안 죽었습니다 — 기한이 걷혔습니다`);
    assert.equal(died, putDay + P.METHODS.water.nodeDays + grace,
      `${novice ? '초보' : '자유'}: Day ${died} 에 죽었습니다 ` +
      `(넣은 날 ${putDay} + 혹 ${P.METHODS.water.nodeDays} + 유예 ${grace} 라야 합니다)`);
    assert.ok(warns >= (novice ? 5 : 2), `${novice ? '초보' : '자유'}: 경고가 ${warns}번뿐입니다`);
    /* ★ 병은 남는다 — 삽수만 시들었다 */
    assert.equal(P.cutContainersOf(S).length, 1, '삽수가 죽으면서 병까지 사라졌습니다');
    info(`  ${novice ? '초보' : '자유'} — 넣은 날 ${putDay} · 유예 ${grace}일 · Day ${died} 사망 · 경고 ${warns}회`);
  }
});

check('⑤ 가방에 오래 둬도 **기한이 앞당겨지지 않는다** (옛 판이면 첫날 죽었을 것)', () => {
  const S = newGame(); give(S, 'jar');
  const c = P.takeCutting(S, { nodes: mother(6), nodeId: PIECE });
  for (let i = 0; i < 60; i++) tick(S);                  // 가방에서 두 달
  const t = P.placeCutContainer(S, 'jar', AT());
  P.putCuttingIn(S, c.id, t.id);
  for (let i = 0; i < 21; i++) tick(S);
  assert.equal(c.status, 'node', `넣고 21일에 ${c.status} 입니다`);
  assert.ok(c.deadlineDay > S.day,
    `기한이 이미 지났습니다 (Day ${c.deadlineDay} · 오늘 ${S.day}) — 자른 날로 셈한 것입니다`);
  info(`  가방 60일 → 넣고 21일 · 기한 Day ${c.deadlineDay}(오늘 ${S.day}) — 남은 ${c.deadlineDay - S.day}일`);
});

/* ============================================================
   ⑥ 회수 — 가방으로, 용기는 남는다
============================================================ */
check('⑥ 회수하면 가방으로 가고 **용기는 방에 빈 채로 남는다**', () => {
  const S = newGame(); give(S, 'jar');
  const c = P.takeCutting(S, { nodes: mother(6), nodeId: PIECE });
  const t = P.placeCutContainer(S, 'jar', AT());
  P.putCuttingIn(S, c.id, t.id);
  while (c.status !== 'node') tick(S);                   // 박사님 ④ 의 그 순간
  const jarBefore = stock(S, 'jar');
  const r = P.takeCuttingOut(S, c.id);
  assert.equal(c.status, 'bag', `회수했는데 ${c.status} 입니다`);
  assert.equal(c.container, null); assert.equal(c.method, null);
  assert.equal(c.deadlineDay, null, '가방에 기한이 남았습니다 — 죽을 수 있습니다');
  assert.equal(c.at, null, '가방에 있는데 자리가 남았습니다');
  assert.equal(P.cutContainersOf(S).length, 1, '★용기가 같이 사라졌습니다');
  assert.equal(P.cutContainerOf(S, r.containerId).cuttingId, null, '용기가 아직 물고 있습니다');
  assert.equal(stock(S, 'jar'), jarBefore, '회수했는데 병이 재고로 갔습니다 — 방에 남아야 합니다');
  /* 그리고 안 죽는다 */
  for (let i = 0; i < 60; i++) tick(S);
  assert.equal(S.cuttings.length, 1, '가방으로 뺐는데 시들었습니다');
  /* 다시 넣으면 처음부터 */
  P.putCuttingIn(S, c.id, r.containerId);
  assert.equal(c.days, 0, '다시 넣었는데 시계가 안 돌아갔습니다');
  assert.equal(c.status, 'rooting');
  info(`  혹 난 삽수를 가방으로 → 병은 방에 남고 재고는 그대로 · 다시 넣으면 0일부터`);
});

check('⑥ 회수는 **살아 있으면 언제든** 된다 (뿌리 전에도)', () => {
  const S = newGame(); give(S, 'jar');
  const c = P.takeCutting(S, { nodes: mother(6), nodeId: PIECE });
  const t = P.placeCutContainer(S, 'jar', AT());
  P.putCuttingIn(S, c.id, t.id);
  tick(S);
  assert.equal(c.status, 'rooting');
  P.takeCuttingOut(S, c.id);                              // 던지면 여기서 잡힌다
  assert.equal(c.status, 'bag');
  /* 이미 가방인 것을 또 빼면 안내(tutorialInput)로 막는다 */
  let err = null;
  try { P.takeCuttingOut(S, c.id); } catch (e) { err = e; }
  assert.ok(err && err.tutorialInput, '가방의 삽수를 또 뺐습니다');
});

/* ============================================================
   ⑦ 든 용기는 못 걷는다
============================================================ */
check('⑦ 삽수가 든 용기를 걷으려 하면 **던진다** — 먼저 빼야 한다', () => {
  const S = newGame(); give(S, 'jar');
  const c = P.takeCutting(S, { nodes: mother(6), nodeId: PIECE });
  const t = P.placeCutContainer(S, 'jar', AT());
  P.putCuttingIn(S, c.id, t.id);
  const before = stock(S, 'jar');
  let err = null;
  try { P.removeContainer(S, t.id); } catch (e) { err = e; }
  assert.ok(err, '삽수가 든 병이 걷혔습니다');
  assert.ok(err.tutorialInput, '안내가 아니라 사고로 났습니다 — 화면이 판을 잠급니다');
  assert.equal(P.cutContainersOf(S).length, 1, '던졌는데 목록에서 빠졌습니다');
  assert.equal(stock(S, 'jar'), before, '던졌는데 재고가 늘었습니다');
  /* 빼면 걷힌다 */
  P.takeCuttingOut(S, c.id);
  P.removeContainer(S, t.id);
  assert.equal(stock(S, 'jar'), before + 1, '빼고 걷었는데 병이 안 돌아왔습니다');
});

check('⑦ 한 번 쓴 모종포트는 걷어도 **안 돌아온다** (흙째 쓰는 소모품이다)', () => {
  const S = newGame(); give(S, 'pot', 2);
  const c = P.takeCutting(S, { nodes: mother(6, 2), nodeId: PIECE });
  const t = P.placeCutContainer(S, 'soil', AT());
  P.putCuttingIn(S, c.id, t.id);
  P.takeCuttingOut(S, c.id);
  const before = stock(S, 'pot');
  const r = P.removeContainer(S, t.id);
  assert.equal(r.returned, false, '★쓴 포트가 돌아왔습니다 — 「심고 빼고 걷고」로 포트가 공짜가 됩니다');
  assert.equal(stock(S, 'pot'), before, '쓴 포트가 재고로 갔습니다');
});

/* ============================================================
   ⑧ 옛 길 · 옛 세이브
============================================================ */
check('⑧ 옛 호출부(자르면서 용기를 정한다)가 **그대로 돈다**', () => {
  for (const [kind, itemId] of [['jar', 'jar'], ['soil', 'pot']]) {
    const S = newGame(); give(S, itemId);
    const before = stock(S, itemId);
    const c = P.takeCutting(S, { nodes: mother(6), nodeId: PIECE, container: kind });
    assert.equal(c.status, 'rooting', `${kind}: 옛 길인데 ${c.status} 입니다`);
    assert.equal(c.container, kind);
    assert.equal(stock(S, itemId), before - 1, `${kind}: 옛 길인데 재고가 안 깎였습니다`);
    assert.equal(c.clockOnDay, c.cutOnDay, `${kind}: 옛 길인데 기준일이 자른 날과 다릅니다`);
    assert.equal(P.cutContainersOf(S).length, 0, `${kind}: 옛 길이 방에 그릇을 세웠습니다`);
  }
  /* 옛 길로 담긴 물꽂이의 기한이 예전 값 그대로인가 (test_cutting_wiring 검사 A 와 같은 식) */
  const S = newGame(); give(S, 'jar');
  const c = P.takeCutting(S, { nodes: mother(6), nodeId: PIECE, container: 'jar' });
  while (c.status !== 'node') tick(S);
  assert.equal(c.deadlineDay,
    c.cutOnDay + P.METHODS.water.nodeDays + P.METHODS.water.graceDaysNovice,
    `옛 길의 기한이 Day ${c.deadlineDay} 로 달라졌습니다`);
});

check('⑧ 옛 길로 담긴 것도 회수된다 — **그 자리에 빈 병이 선다**(병이 안 사라진다)', () => {
  const S = newGame(); give(S, 'jar');
  const c = P.takeCutting(S, { nodes: mother(6), nodeId: PIECE, container: 'jar', at: AT() });
  const before = stock(S, 'jar');
  const r = P.takeCuttingOut(S, c.id);
  assert.equal(c.status, 'bag');
  assert.equal(P.cutContainersOf(S).length, 1, '★옛 길의 병이 조용히 사라졌습니다');
  assert.equal(stock(S, 'jar'), before, '회수가 재고를 만들어 냈습니다');
  const t = P.cutContainerOf(S, r.containerId);
  assert.equal(t.container, 'jar');
  assert.equal(t.cuttingId, null);
});

check('⑧ 세이브 왕복 — 가방 삽수 · 빈 용기 · 든 용기가 그대로 열린다', () => {
  const S = newGame(); give(S, 'jar', 2); give(S, 'pot');
  const bag = P.takeCutting(S, { nodes: mother(6), nodeId: PIECE });
  const inJar = P.takeCutting(S, { nodes: mother(6), nodeId: PIECE2, id: 'cut_09' });
  const t1 = P.placeCutContainer(S, 'jar', AT(1));
  const t2 = P.placeCutContainer(S, 'jar', AT(2));       // 빈 채로 남길 것
  for (let i = 0; i < 5; i++) tick(S);
  P.putCuttingIn(S, inJar.id, t1.id);
  for (let i = 0; i < 3; i++) tick(S);

  const raw = JSON.parse(JSON.stringify(SV.serialize(S)));
  const S2 = SV.deserialize(raw, { allowMissingGrowth: true });
  const b2 = S2.cuttings.find(x => x.id === bag.id);
  const j2 = S2.cuttings.find(x => x.id === inJar.id);
  assert.equal(b2.status, 'bag', '가방 삽수가 가방으로 안 열렸습니다');
  assert.equal(b2.container, null, '가방 삽수에 용기가 붙었습니다');
  assert.equal(b2.method, null, '가방 삽수에 방식이 붙었습니다');
  assert.equal(j2.status, 'rooting');
  assert.equal(j2.days, inJar.days, `날 수가 ${j2.days} 로 달라졌습니다 (${inJar.days} 라야 합니다)`);
  assert.equal(j2.clockOnDay, inJar.clockOnDay, '시계 기준일이 안 실렸습니다');
  assert.equal(j2.inContainerId, t1.id, '삽수와 병의 연결이 끊겼습니다');
  assert.equal(P.cutContainersOf(S2).length, 2, `방의 용기가 ${P.cutContainersOf(S2).length}개로 열렸습니다`);
  assert.equal(P.cutContainerOf(S2, t1.id).cuttingId, inJar.id, '병이 삽수를 안 물고 있습니다');
  assert.equal(P.cutContainerOf(S2, t2.id).cuttingId, null, '빈 병이 뭔가를 물고 있습니다');
  assert.equal(P.cutContainerOf(S2, t1.id).usedOnDay != null, true, '쓴 표시가 안 실렸습니다');
  assert.equal(P.cutContainerOf(S2, t2.id).usedOnDay, null, '안 쓴 병에 쓴 표시가 붙었습니다');
  /* 두 번 왕복해도 안 흔들린다 */
  const raw2 = JSON.parse(JSON.stringify(SV.serialize(S2)));
  assert.deepEqual(raw2.state.cutContainers, raw.state.cutContainers, '두 번 저장하니 용기가 흔들립니다');
  assert.deepEqual(raw2.state.cuttings, raw.state.cuttings, '두 번 저장하니 삽수가 흔들립니다');
});

check('⑧ **옛 세이브**(용기를 정해 자른 판 · 새 칸이 통째로 없다)가 그대로 열린다', () => {
  const S = newGame(); give(S, 'jar');
  const c = P.takeCutting(S, { nodes: mother(6), nodeId: PIECE, container: 'jar', at: AT() });
  for (let i = 0; i < 15; i++) tick(S);
  const raw = JSON.parse(JSON.stringify(SV.serialize(S)));
  /* ★ 옛 판을 흉내 낸다 — 2026-08-17 에 생긴 칸을 **지운다**(세이브에 아예 없던 상태) */
  delete raw.state.cutContainers;
  for (const q of raw.state.cuttings) { delete q.inContainerId; delete q.clockOnDay; }
  const S2 = SV.deserialize(raw, { allowMissingGrowth: true });
  const c2 = S2.cuttings[0];
  assert.equal(S2.cutContainers.length, 0, '옛 판에 없던 용기가 생겼습니다');
  assert.equal(c2.container, 'jar', '옛 판의 용기가 사라졌습니다');
  assert.equal(c2.method, 'water');
  assert.equal(c2.days, c.days, `옛 판의 날 수가 ${c2.days} 로 달라졌습니다`);
  assert.equal(c2.clockOnDay, null, '없던 기준일이 지어내졌습니다');
  assert.equal(P.clockDayOf(c2), c2.cutOnDay, '기준일이 없으면 자른 날로 읽어야 합니다');
  /* 이어서 굴려도 예전 기한 그대로 */
  while (c2.status !== 'node' && S2.day < 200) { S2.day++; P.stepCuttings(S2, { lightOf: LIT }); }
  assert.equal(c2.deadlineDay,
    c2.cutOnDay + P.METHODS.water.nodeDays + P.METHODS.water.graceDaysNovice,
    `옛 판의 기한이 Day ${c2.deadlineDay} 로 달라졌습니다`);
  info(`  옛 세이브 — 새 칸 셋을 지워도 그대로 열리고 기한이 Day ${c2.deadlineDay} 로 같다`);
});

/* ============================================================
   ⑨ ★흙도 똑같이 두 걸음이다 (2026-08-17 박사님 추가)
============================================================ */
check('⑨ ★흙도 **동일하게** 두 걸음 — 빈 포트를 놓고 → 심고 → 45일 혹 · 안 죽는다', () => {
  const S = newGame(); give(S, 'pot');
  const c = P.takeCutting(S, { nodes: mother(6, 3), nodeId: PIECE });   // 잎 3장
  assert.equal(c.status, 'bag');
  const t = P.placeCutContainer(S, 'soil', AT());
  const putDay = S.day;
  P.putCuttingIn(S, c.id, t.id);
  const seen = {};
  for (let i = 0; i < 120; i++) { tick(S); if (!seen[c.status]) seen[c.status] = c.days; }
  assert.equal(seen.established, P.METHODS.pot.rootDays,
    `자리를 ${seen.established}일에 잡았습니다 (${P.METHODS.pot.rootDays}일이라야 합니다)`);
  assert.equal(c.nodeOnDay, putDay + P.METHODS.pot.nodeDays,
    `혹이 Day ${c.nodeOnDay} 에 났습니다 (넣은 날 ${putDay} + ${P.METHODS.pot.nodeDays} 라야 합니다)`);
  assert.equal(c.deadlineDay, null, '흙에 기한이 붙었습니다');
  assert.equal(S.cuttings.length, 1, '흙 직삽이 죽었습니다 — 기한이 없어야 합니다');
  info(`  흙 — 놓고 → 심고 → 뿌리 ${P.METHODS.pot.rootDays}일 · 혹 ${P.METHODS.pot.nodeDays}일 · ` +
       `120일을 굴려도 안 죽는다 (병 ${P.METHODS.water.nodeDays}일과 ` +
       `${P.METHODS.pot.nodeDays - P.METHODS.water.nodeDays}일 차이)`);
});

/* ============================================================
   ⑩ 잎 수 — 병에는 1장, 화분에는 여러 장
============================================================ */
check('⑩ 잎 여러 장짜리는 **병에는 안 들어가고 화분에는 들어간다**', () => {
  const S = newGame(); give(S, 'jar'); give(S, 'pot');
  const c = P.takeCutting(S, { nodes: mother(6, 2), nodeId: PIECE });   // 잎 2장
  const jar = P.placeCutContainer(S, 'jar', AT(1));
  const soil = P.placeCutContainer(S, 'soil', AT(2));
  let err = null;
  try { P.putCuttingIn(S, c.id, jar.id); } catch (e) { err = e; }
  assert.ok(err, `잎 2장짜리가 병에 들어갔습니다 (물꽂이는 ${P.WATER_LEAF_MAX}장까지)`);
  assert.ok(err.tutorialInput, '안내가 아니라 사고로 났습니다');
  assert.equal(c.status, 'bag', '던졌는데 삽수가 바뀌었습니다');
  assert.equal(P.cutContainerOf(S, jar.id).cuttingId, null, '던졌는데 병이 물었습니다');
  P.putCuttingIn(S, c.id, soil.id);
  assert.equal(c.method, 'pot', '잎 2장짜리가 화분에 안 들어갔습니다');
  info(`  물꽂이는 잎 ${P.WATER_LEAF_MAX}장까지 · 여러 장짜리는 화분으로 — 사유: ${err.message.slice(0, 70)}…`);
});

/* ============================================================
   결과
============================================================ */
console.log('');
let fail = 0;
for (const r of results) {
  if (r[0] === 'INFO') console.log(r[1]);
  else { console.log(`${r[0] === 'PASS' ? '✔' : '✘'} ${r[1]}${r[2] ? ' — ' + r[2] : ''}`); if (r[0] === 'FAIL') fail++; }
}
console.log(fail ? `\n${fail}건 실패` : '\n전부 통과');
process.exit(fail ? 1 : 0);
