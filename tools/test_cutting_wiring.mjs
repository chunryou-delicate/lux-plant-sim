/* ============================================================
   tools/test_cutting_wiring.mjs — 삽수 계통이 **플레이어에게 실제로 열려 있나**
   ------------------------------------------------------------
   기존 tools/test_propagation.mjs 는 규칙(propagation.js)이 맞는지를 본다.
   여기는 다른 것을 본다 — **그 규칙을 손으로 굴릴 수 있나**, 그리고 **굴리면 얼마가 되나.**

     A  물꽂이 한살이 — 12일 뿌리 · **20일 혹** · 기한 28일(초보 36일)  ← 2026-08-17
     B  ★분갈이 안 하면 죽는다 — 그리고 죽기 전에 경고가 몇 번 나가나
     C  분갈이하면 산다 — 죽기 하루 전에 해도 산다
     D  직삽 24일 — 기한도 죽음도 없다
     E  ★용기가 없으면 못 자른다 · 못 옮긴다 (파산 잠김이 진짜인가)
     F  ★파산 탈출구 — 포트를 못 사도 **혹 난 삽수를 팔면** 돈이 된다
     G  값 — 잎 수·무늬 잎 수별 판매가
     H  ★30일 삽수 수입 — 실제 growth 엔진이 낸 마디로 잘라서 판다
     I  ★이사비 150만까지 며칠 — 삽수만 · 콩나물만 · 둘 다

   ★ 잎 수는 지어내지 않는다. plant_grow.html 을 헤드리스로 올려 실제 마디를 읽는다
     (tools/test_cuttable.mjs 와 같은 방식 — THREE 만 스텁으로 걷어낸다).

     node tools/test_cutting_wiring.mjs
============================================================ */
import assert from 'node:assert';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/* ★자가 제한 — 재는 도구가 재는 대상보다 오래 살면 안 된다.
   ★ unref 를 빠뜨리면 다 재고도 제한 시간까지 프로세스가 안 죽는다(전에 당했다). */
const _WATCHDOG_MS = +(process.env.BYEOT_PROBE_TIMEOUT_MS || 300000);
const _wd = setTimeout(() => {
  console.error('⏱ 자가 제한 ' + Math.round(_WATCHDOG_MS / 1000) + '초를 넘겨 멈춥니다 — 재는 중에 멈춘 것입니다.');
  process.exit(2);
}, _WATCHDOG_MS);
_wd.unref && _wd.unref();
process.on('exit', () => clearTimeout(_wd));

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const toUrl = (rel) => 'file:///' + path.join(ROOT, rel).replace(/\\/g, '/');

const P = await import(toUrl('src/game/propagation.js'));
const SH = await import(toUrl('src/game/shop.js'));
const ST = await import(toUrl('src/game/state.js'));
const TU = await import(toUrl('src/game/tutorial.js'));

/* ── 검사 틀 (tools/test_cuttable.mjs 와 같은 모양) ────────────────────── */
const results = [];
const check = (name, fn) => { try { fn(); results.push(['PASS', name]); }
                              catch (e) { results.push(['FAIL', name, e.message]); } };
const info = (s) => results.push(['INFO', s]);
const won = n => Math.round(n).toLocaleString() + '원';

/* ── 판 하나 세우기 ──────────────────────────────────────────────────────
   ★ `tutorial.enabled` 를 켜야 지갑(cashWon)이 돈다 — shop.credit 이 거기에 넣는다.
     끄면 판 값이 어디에도 안 쌓여 "30일에 얼마 버나"가 0 으로 나온다. */
function newGame({ novice = true, cash = 0 } = {}) {
  /* ★ firstPlay 는 안 켠다 — 밸런스 계약(rules)이 필요하고, 여기서 재는 것은 콩나물이 아니다.
     지갑은 아래에서 튜토리얼만 켜서 돌린다(shop.credit 이 보는 곳이 거기다). */
  const S = ST.newState({ room: 'banjiha', mode: novice ? 'novice' : 'real' });
  S.day = 1;
  S.tutorial.enabled = true;
  S.tutorial.cashWon = cash;
  /* 초보 판정은 `sim.mode==='novice'` 이거나 **스토리가 도는 중**이다(propagation.isNoviceMode).
     자유 모드를 재려면 둘 다 꺼야 한다 — 하나만 끄면 여전히 초보로 읽힌다.
     ★ 2026-08-05 — 예전에는 `movedOut = true` 로 껐다. 그건 ② 탈출이지 스토리의 끝이 아니다
       (story_arc.md §0 은 ④ 엔딩까지 초보라고 못 박았다). 스토리를 끝내는 사실은
       `story.ending.doneOnDay` 하나다 — tools/test_oneroom.mjs 검사 F 가 그 등식을 고정한다. */
  if (!novice) { S.sim.mode = 'real'; S.tutorial.movedOut = true; S.story.ending.doneOnDay = 0; }
  S.pots.push({ id: 'pot_01', plantId: 'monstera', slotId: 'banjiha-sill:0',
                at: null, variegated: false, gen: 0 });
  return S;
}
/* 재고를 직접 채운다 — 주문·배송은 shop.js 검사가 이미 본다. 여기서 재는 것은 삽수다. */
const give = (S, itemId, n = 1) => { SH.shopOf(S).stock[itemId] = (SH.shopOf(S).stock[itemId] || 0) + n; };
/* 마디 하나. 값은 growth 가 낸 모양 그대로다(assertCutNode 를 통과한다). */
const node = (id, leaves, varie = 0, stem = 'thick') =>
  ({ nodeId: id, stem, leaves, variegatedLeaves: varie, growthDays: 143 });
/* 모주가 잎 N장이라고 말하는 목록. 밑동(n0#0)이 그루 전체다 — test_cuttable 검사 K 의 등식.
   ★ 위쪽 마디 하나(n0#1)를 항상 같이 낸다. 밑동을 자르면 그루가 통째로 딸려가 **초보에서는
     그 자체가 막힌다**(모주가 끝난다) — 여기서 재려는 것은 그 규칙이 아니라 한살이다. */
const mother = (total, cut = 1) => [node('n0#0', total, 0, 'main'), node('n0#1', cut)];
const PIECE = 'n0#1';

/* 하루를 넘긴다 — loop.nextDay 와 **같은 순서**다(날짜를 올린 뒤 상점, 그 다음 삽수). */
function tick(S, log) {
  S.day++;
  SH.stepShop(S, { log });
  /* ★ 2026-08-17 — **중고 거래 연락도 하루의 일이다**(loop.nextDay 가 stepShop 바로 뒤에서
     부른다 · shop.js §⑦-1). 여기 없으면 이 하네스에서는 연락이 영영 안 와서
     「올려 두면 팔린다」가 하네스 안에서만 거짓이 된다 — 실제로 그렇게 한 번 헛짚었다. */
  SH.stepMarket(S, { log });
  return P.stepCuttings(S, { log });
}

/* ============================================================
   A~D  한살이
============================================================ */
check('A 물꽂이 — 12일에 뿌리 · 20일에 혹 · 기한이 그때 선다', () => {
  const S = newGame(); give(S, 'jar');
  const c = P.takeCutting(S, { nodes: mother(6), nodeId: PIECE, container: 'jar' });
  assert.equal(c.status, 'rooting');
  const seen = {};
  for (let i = 0; i < 40; i++) { tick(S); if (!seen[c.status]) seen[c.status] = c.days; }
  assert.equal(seen.rooted, 12, `뿌리가 ${seen.rooted}일에 났습니다 (12일이라야 합니다)`);
  /* ⚠⚠ 2026-08-17 — 혹이 32 → **20** 으로 당겨졌다(박사님). 유예는 그대로라
     기한이 48 → **36**(초보) 이 됐다. 숫자를 박지 않고 정본에서 읽는다. */
  assert.equal(P.METHODS.water.nodeDays, 20, '혹이 20일이 아닙니다');
  assert.equal(seen.node, P.METHODS.water.nodeDays,
    `혹이 ${seen.node}일에 났습니다 (${P.METHODS.water.nodeDays}일이라야 합니다)`);
  assert.equal(c.deadlineDay, 1 + P.METHODS.water.nodeDays + P.METHODS.water.graceDaysNovice,
    `기한이 Day ${c.deadlineDay} 입니다`);
});

check('B ★분갈이를 안 하면 죽는다 — 그리고 죽기 전에 경고가 나간다', () => {
  for (const novice of [true, false]) {
    const S = newGame({ novice }); give(S, 'jar');
    const c = P.takeCutting(S, { nodes: mother(6), nodeId: PIECE, container: 'jar' });
    let warns = 0, died = null;
    for (let i = 0; i < 60 && !died; i++) {
      const r = tick(S);
      warns += r.warnings.length;
      if (r.died.length) died = S.day;
    }
    const grace = novice ? 16 : 8;
    assert.ok(died, `${novice ? '초보' : '자유'}: 분갈이를 안 했는데 안 죽었습니다`);
    assert.equal(died, 1 + P.METHODS.water.nodeDays + grace,
      `${novice ? '초보' : '자유'}: Day ${died} 에 죽었습니다`);
    assert.ok(warns >= (novice ? 5 : 2),
      `${novice ? '초보' : '자유'}: 경고가 ${warns}번뿐입니다 — 조용히 죽었습니다`);
    assert.equal(S.cuttings.length, 0, '죽은 삽수가 배열에 남아 있습니다');
    info(`  ${novice ? '초보' : '자유'} — 유예 ${grace}일 · Day ${died} 사망 · 경고 ${warns}회`);
  }
});

check('C 분갈이하면 산다 — 기한 하루 전에 해도 산다', () => {
  const S = newGame(); give(S, 'jar'); give(S, 'pot');
  const c = P.takeCutting(S, { nodes: mother(6), nodeId: PIECE, container: 'jar' });
  /* 기한 하루 전 — 혹(20) + 초보 유예(16) − 1 */
  while (S.day < c.cutOnDay + P.METHODS.water.nodeDays + P.METHODS.water.graceDaysNovice - 1) tick(S);
  assert.equal(c.status, 'node');
  P.repotCutting(S, c.id);
  assert.equal(c.status, 'established');
  assert.equal(c.deadlineDay, null);
  for (let i = 0; i < 40; i++) tick(S);
  assert.equal(S.cuttings.length, 1, '분갈이했는데 사라졌습니다');
  /* ★ 병이 돌아왔나 — 물꽂이는 병에서 뽑아 옮겨 심는다(propagation §용기값) */
  assert.equal(SH.stockOf(S, 'jar'), 1, '분갈이했는데 유리병이 안 돌아왔습니다');
});

check('D 직삽 24일 — 기한도 죽음도 없다', () => {
  const S = newGame(); give(S, 'pot');
  const c = P.takeCutting(S, { nodes: mother(6), nodeId: PIECE, container: 'soil' });
  for (let i = 0; i < 24; i++) tick(S);
  assert.equal(c.status, 'established');
  assert.equal(c.deadlineDay, null);
  for (let i = 0; i < 60; i++) tick(S);
  assert.equal(S.cuttings.length, 1, '직삽이 죽었습니다 — 기한이 없어야 합니다');
});

/* ============================================================
   E~F  막힘과 탈출구
============================================================ */
check('E ★용기가 없으면 못 자른다 — 이게 파산 잠김의 정체다', () => {
  const S = newGame({ cash: 0 });
  assert.throws(() => P.takeCutting(S, { nodes: mother(6), nodeId: PIECE, container: 'jar' }),
    /유리 수경병/, '병 없이 잘렸습니다 — 경제가 샙니다');
  assert.throws(() => P.takeCutting(S, { nodes: mother(6), nodeId: PIECE, container: 'soil' }),
    /모종포트/, '포트 없이 잘렸습니다');
  /* 분갈이도 포트를 쓴다 — 병만 있고 포트가 없으면 **혹이 나도 못 옮긴다** */
  give(S, 'jar');
  const c = P.takeCutting(S, { nodes: mother(6), nodeId: PIECE, container: 'jar' });
  while (c.status !== 'node') tick(S);
  assert.throws(() => P.repotCutting(S, c.id), /모종포트/,
    '포트 없이 분갈이가 됐습니다');
  info(`  병 ${won(SH.buyPriceOf('jar'))} · 포트 ${won(SH.buyPriceOf('pot'))} — ` +
       `물꽂이 한 개를 살리려면 ${won(SH.buyPriceOf('jar') + SH.buyPriceOf('pot'))} 가 든다`);
});

/* ══ ★★★ F — **파산 탈출구가 이제 하루 만에 안 돈다** (2026-08-17 고쳐 씀) ═══════
   ------------------------------------------------------------
   ⚠ 예전 이 절은 `SH.sellCutting(S, c.id)` 한 줄이었고, **그 한 줄이 「혹 난 삽수는 누르면
     그 자리에서 돈이 된다」를 못 박고 있었다.** 그것이 이번에 바뀐 약속이다 — 몬스테라 것은
     중고 거래로만 나가고, 연락은 **1~7일** 뒤에 온다(shop.js §⑦-0).
   ★★ 그래서 이 절이 재는 것이 하나 늘었다: **기다리는 동안 삽수가 안 죽나.**
     혹 난 삽수는 분갈이 유예 안에 안 고치면 시든다 — 초보 16일 · 자유 8일이고,
     연락은 아무리 늦어도 7일이다. **둘 다 7일보다 길어 탈출구가 닫히지 않는다.**
     ⇒ 그 여유가 사라지는 날(유예를 줄이거나 대기를 늘리는 날) 이 검사가 먼저 깨진다. */
check('F ★탈출구 — 포트를 못 사도 혹 난 삽수를 내놓으면 돈이 된다 (기다리는 동안 안 죽는다)', () => {
  const S = newGame({ cash: 0 }); give(S, 'jar');
  const c = P.takeCutting(S, { nodes: mother(6), nodeId: PIECE, container: 'jar' });
  while (c.status !== 'node') tick(S);
  assert.ok(SH.SELLABLE_CUTTING_STATUS.includes('node'), '혹 난 삽수를 못 팝니다');
  SH.marketGate(S, { leaves: SH.MARKET_MIN_LEAVES });      // 문 — 하네스에 growth 가 없다
  const l = SH.listCutting(S, c.id).listing;
  /* ★ 지름길이 없다 — **하루씩 실제로 흘린다.** 그 사이 시들면 거기서 잡힌다. */
  let waited = 0;
  while (SH.marketStatus(S).contacted.length === 0 && waited < 30) { tick(S); waited++; }
  assert.ok((S.cuttings || []).some(x => x.id === c.id),
    `★연락을 ${waited}일 기다리는 사이에 삽수가 시들었습니다 — 파산 탈출구가 닫혔습니다 ` +
    `(유예 ${P.graceDaysOf('water', false)}일 · 자유 모드)`);
  const r = SH.dealListing(S, l.listingId);
  assert.ok(r.won >= SH.buyPriceOf('pot'),
    `혹 난 삽수를 팔아도 ${won(r.won)} 뿐이라 포트(${won(SH.buyPriceOf('pot'))})를 못 삽니다`);
  assert.equal(SH.stockOf(S, 'jar'), 1, '판 뒤에 병이 안 돌아왔습니다');
  info(`  잎 ${c.source.leaves}장 삽수를 혹 단계에서 내놓으면 ${waited}일 뒤 연락 → ${won(r.won)} · ` +
       `병도 돌아온다 ⇒ 포트값 ${won(SH.buyPriceOf('pot'))} 를 못 대도 길이 안 막힌다 ` +
       `(분갈이 유예 ${P.graceDaysOf('water', false)}일 > 최대 대기 ${SH.MARKET_CONTACT_DAYS.max}일)`);
});

/* 민무늬 잎 한 장 값 — 정본에서 읽는다(수를 박지 않는다) */
const LEAF1 = SH.priceOf({ leaves: 1, variegatedLeaves: 0 }).won;

check('G 값 — 잎 수와 무늬 잎 수', () => {
  const rows = [];
  for (const [l, v] of [[1, 0], [1, 1], [2, 0], [2, 1], [3, 0], [3, 1], [6, 0], [6, 2]]) {
    const q = SH.priceOf({ leaves: l, variegatedLeaves: v });
    rows.push(`잎${l}·무늬${v} ${won(q.won)}(${q.grade})`);
  }
  info('  ' + rows.join(' · '));
  /* ★★ 2026-08-16 — **박아 둔 12,000 이 낡았다.** 옛 사다리는 「잎 1~2장은 삽수 단가 12,000 ·
     3장부터 성체 10,000」이라 **작게 잘라 파는 쪽이 잎당 유리했다.** 무늬 등급 확정문이
     그 축을 걷었다 — 잎당 값은 어디서나 같고, 삽수와 그루는 **파는 길**(×1.0 대 ×1.4)이 가른다.
     ⇒ 재야 하는 것은 「12,000 인가」가 아니라 **「쪼개는 쪽이 이득이 아닌가」**다.
     ⚠ 값을 임의로 낮춘 것이 아니다. 무지 1잎은 정본(`varie_grades.json`)의 20,000원이다. */
  const one = SH.priceOf({ leaves: 1, variegatedLeaves: 0 }).won;
  assert.ok(one > 0, '민무늬 잎1 값이 0 입니다');
  assert.ok(SH.priceOf({ leaves: 2, variegatedLeaves: 0 }).won >= one * 2,
    '★잎 2장을 1+1 로 쪼개는 쪽이 이득입니다 — 잘 키운 벌이 돌아왔습니다');
  /* ★ 그루가 삽수보다 비싸다 — 「키워서 통째로 판다」가 성립하는 근거다 */
  assert.ok(SH.priceOf({ leaves: 3, variegatedLeaves: 0, form: 'pot' }).won >
            SH.priceOf({ leaves: 3, variegatedLeaves: 0, form: 'cutting' }).won,
    '★그루가 삽수보다 안 비쌉니다');
});

/* ============================================================
   ★ 여기부터 실제 growth 엔진 — 잎 수를 지어내지 않는다
============================================================ */
function makeThree() {
  class V3 {
    constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
    set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
    clone() { return new V3(this.x, this.y, this.z); }
    copy(v) { return this.set(v.x, v.y, v.z); }
    add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
    sub(v) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; }
    addScaledVector(v, s) { this.x += v.x * s; this.y += v.y * s; this.z += v.z * s; return this; }
    multiplyScalar(s) { this.x *= s; this.y *= s; this.z *= s; return this; }
    lengthSq() { return this.x ** 2 + this.y ** 2 + this.z ** 2; }
    length() { return Math.sqrt(this.lengthSq()); }
    normalize() { const l = this.length() || 1; return this.multiplyScalar(1 / l); }
    crossVectors(a, b) { return this.set(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x); }
    lerp(v, t) { this.x += (v.x - this.x) * t; this.y += (v.y - this.y) * t; this.z += (v.z - this.z) * t; return this; }
    applyAxisAngle() { return this; }
    distanceTo(v) { return this.clone().sub(v).length(); }
  }
  const handler = {
    get(t, k) {
      if (k in t) return t[k];
      const f = function () { return new Proxy({}, handler); };
      f.prototype = {};
      return new Proxy(f, handler);
    },
    construct() { return new Proxy({}, handler); },
    apply() { return new Proxy({}, handler); }
  };
  return new Proxy({ Vector3: V3, Vector2: V3 }, handler);
}
function loadGrowth(seed = 92158) {
  const html = fs.readFileSync(path.join(ROOT, 'plant_grow.html'), 'utf8');
  const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  const main = blocks[blocks.length - 1];
  const src = main.replace(/\n\s*init\(\);\s*updateCam\(\);\s*$/, '\n/* init() 제거(헤드리스) */\n');
  const tuning = fs.readFileSync(path.join(ROOT, 'data', 'growth_tuning.json'), 'utf8');
  const el = () => ({
    value: '', textContent: '', checked: false, dataset: {}, style: {}, classList: { add() {}, remove() {}, toggle() {} },
    appendChild() {}, addEventListener() {}, removeEventListener() {}, setAttribute() {}, getAttribute() { return null; },
    querySelector() { return null; }, querySelectorAll() { return []; }, insertAdjacentHTML() {}, focus() {}, remove() {}
  });
  const warnings = [], errors = [];
  const ctx = {
    THREE: makeThree(),
    console: { log() {}, warn: (...a) => warnings.push(a.join(' ')), error: (...a) => errors.push(a.join(' ')) },
    document: { getElementById() { return null; }, createElement: el, querySelector() { return null; },
                querySelectorAll() { return []; }, addEventListener() {}, body: el(), documentElement: el() },
    location: { search: '', href: 'http://localhost/plant_grow.html' },
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    requestAnimationFrame() { return 0; }, cancelAnimationFrame() {},
    setTimeout, clearTimeout, setInterval() { return 0; }, clearInterval() {},
    fetch: () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(tuning)) }),
    Math, JSON, Date, Object, Array, Number, String, Boolean, Map, Set, Error, isFinite, isNaN, parseFloat, parseInt,
    _warnings: warnings, _errors: errors
  };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(src, ctx, { filename: 'plant_grow.html' });
  try { ctx.plantSeed(seed); } catch { /* 그리기 실패는 무시 — 형태 시뮬만 쓴다 */ }
  return ctx;
}
async function ready(g) {
  for (let i = 0; i < 80 && !g.thLoaded(); i++) await new Promise(r => setImmediate(r));
  assert.ok(g.thLoaded(), '임계값 정본이 안 실렸습니다: ' + g._errors.join(' | '));
  return g;
}

const g = await ready(loadGrowth());
/* 도착 개체 = 143일 · 반지하 창가 DLI 3.77 (test_cuttable.mjs 가 쓰는 그 기준) */
g.matResetAll(); g.setDailyLightSteady(3.77); g.setGrowth(143);
info(`\n★ 모주 — 143일 개체(SEED 92158 · DLI 3.77) · ` +
     `잎 ${g.leafStats().leaves}장(무늬 ${g.leafStats().variegatedLeaves}) · ` +
     `자를 수 있는 마디 ${g.cuttableNodes().length}개`);

/* ============================================================
   H  ★30일 삽수 수입 — 실제 마디를 잘라서 판다
   ------------------------------------------------------------
   ★ 굴리는 순서는 화면과 같다: [자르기(가능하면)] → [다음 날](상점·삽수 진행) → [팔기].
   ★ growth 는 잘린 것을 모른다(propagation §유한성). 그래서 총량 제약(cuttableNow)이
     실제로 물린다 — 모주가 새 잎을 낼 때까지 다음 자르기가 안 열린다. 그게 곧 수입 속도다.
============================================================ */
function runCuttings({ days = 30, dli = 3.77, container = 'jar', repot = false,
                       jars = 1, startDay = 143, novice = true } = {}) {
  const G = loadGrowthSync(); G.matResetAll(); G.setDailyLightSteady(dli); G.setGrowth(startDay);
  const S = newGame({ novice, cash: 0 });
  const contItem = P.CONTAINERS[container].itemId;
  give(S, contItem, jars);
  if (repot) give(S, 'pot', 99);           // 분갈이용은 넉넉히 — 여기서 재는 것은 수입이지 원가가 아니다
  let cuts = 0, sold = 0, soldWon = 0, died = 0;
  const spent = jars * SH.buyPriceOf(contItem);
  for (let d = 0; d < days; d++) {
    /* ① 자를 수 있으면 자른다 — 잎이 적은 마디부터(잎당 값이 같고 총량을 아낀다) */
    for (;;) {
      let nodes = null;
      try { nodes = G.cuttableNodes(); } catch { nodes = null; }
      if (!nodes) break;
      const ok = P.cuttableNow(S, nodes, { potId: 'pot_01' })
                  .slice().sort((a, b) => a.leaves - b.leaves);
      if (!ok.length) break;
      if (SH.stockOf(S, contItem) < 1) break;
      try { P.takeCutting(S, { nodes, nodeId: ok[0].nodeId, container }); cuts++; }
      catch { break; }
    }
    /* ② 하루가 간다 */
    G.setDailyLightSteady(dli); G.advanceTo(G.calendarDay() + 1);
    const r = tick(S);
    died += r.died.length;
    /* ③ 분갈이(하기로 했으면) → 팔기. **뿌리내린 것만 팔린다** */
    for (const c of [...S.cuttings]) {
      if (repot && c.status === 'node') { try { P.repotCutting(S, c.id); } catch { } }
    }
    /* ★★ 2026-08-17 — 파는 것이 **두 걸음**이다(shop.js §⑦-0): 올리고 → 연락 → 거래.
       ⚠ 지름길이 없다. 이 재현이 재는 것이 **꾸준수입**이라, 기다리는 날을 건너뛰면
         「하루에 얼마 버나」가 그만큼 부풀려진다. 날짜는 위 ②에서 실제로 흐른다. */
    SH.marketGate(S, { leaves: SH.MARKET_MIN_LEAVES });    // 문 — 하네스에 growth 창구가 없다
    for (const c of [...S.cuttings]) {
      if (!SH.SELLABLE_CUTTING_STATUS.includes(c.status)) continue;
      if (SH.listingFor(S, c)) continue;                   // 이미 올려 뒀다
      try { SH.listCutting(S, c.id); } catch { }
    }
    for (const l of SH.marketStatus(S).contacted) {
      try { const q = SH.dealListing(S, l.listingId); sold++; soldWon += q.won; } catch { }
    }
  }
  return { cuts, sold, soldWon, spent, net: soldWon - spent, died, days,
           leaves: G.leafStats().leaves, cash: S.tutorial.cashWon };
}
/* loadGrowth 는 fetch 를 기다려야 임계값이 실린다. 매 판마다 await 하기 번거로우니 한 번 만들어 쓴다 */
let _gPool = [];
function loadGrowthSync() {
  const ctx = _gPool.pop();
  if (ctx) return ctx;
  throw new Error('growth 판이 모자랍니다');
}
for (let i = 0; i < 16; i++) _gPool.push(await ready(loadGrowth()));

console.log('');
console.log('══ H  30일 삽수 수입 (모주 = 143일 개체 · 병 1개로 시작 · 자르자마자 다시 꽂는다) ══');
const H = [];
for (const [ko, opt] of [
  ['물꽂이 · 병 1개', { container: 'jar', jars: 1 }],
  ['물꽂이 · 병 2개', { container: 'jar', jars: 2 }],
  ['물꽂이 · 병 3개', { container: 'jar', jars: 3 }],
  ['직삽 · 포트 1개', { container: 'soil', jars: 1 }],
  ['직삽 · 포트 3개', { container: 'soil', jars: 3 }]
]) {
  const r = runCuttings({ days: 30, ...opt });
  H.push([ko, r]);
  console.log(`  ${ko.padEnd(16)} | 자른 것 ${r.cuts} · 판 것 ${r.sold} · 매출 ${won(r.soldWon)} · ` +
              `용기값 ${won(r.spent)} · 순액 ${won(r.net)} · 하루평균 ${won(r.net / r.days)}`);
}

/* ★ 왜 병을 더 사도 수입이 안 느나 — 병이 아니라 **모주 잎**이 병목이기 때문이다.
   propagation §유한성: 잘라낸 잎의 합 ≤ 모주의 잎 수. 즉 수입 상한은 통째로
   "모주가 30일에 잎을 몇 장 내나 × 12,000원" 이다. 그 잎을 여기서 직접 센다. */
console.log('');
console.log('══ H-2  병목은 병이 아니라 모주 잎이다 — 30일에 잎이 몇 장 나나 ══');
for (const dli of [1.5, 3.77, 6, 12]) {
  const G = loadGrowthSync(); G.matResetAll(); G.setDailyLightSteady(dli); G.setGrowth(143);
  const a = G.leafStats().leaves;
  for (let i = 0; i < 30; i++) { G.setDailyLightSteady(dli); G.advanceTo(G.calendarDay() + 1); }
  const b = G.leafStats().leaves;
  for (let i = 0; i < 60; i++) { G.setDailyLightSteady(dli); G.advanceTo(G.calendarDay() + 1); }
  const c = G.leafStats().leaves;
  console.log(`  DLI ${String(dli).padEnd(5)} | 143일 ${a}장 → 173일 ${b}장 → 233일 ${c}장 · ` +
              /* ⚠ 잎당 값도 박지 마라 — 정본(`varie_grades.json`)에서 읽는다(위 ★★) */
              `30일 새 잎 ${b - a}장 ⇒ 삽수 수입 상한 ${won((b - a) * LEAF1)}/30일 ` +
              `(하루 ${won((b - a) * LEAF1 / 30)})`);
}
console.log('  ⤷ ★병을 3개 사도 30일 매출이 24,000원 그대로다 — 자를 잎이 없기 때문이다.');
console.log('    용기를 늘리는 것은 수입을 늘리지 않는다.');

/* ============================================================
   ★★ H-3  꾸준수입이 **정말 꾸준한가** — 이게 이 측정의 핵심이다
   ------------------------------------------------------------
   propagation §유한성의 부등식은
       잘라낸 잎의 **누적 합**(pendingCutLoss.leaves) ≤ 모주의 **지금** 잎 수
   다. 왼쪽은 영영 안 줄고 오른쪽은 낙엽 때문에 어느 값에서 평평해진다.
   그러면 어느 순간 부등식이 영구히 막히고, 그때부터 삽수 수입은 **0** 이 된다.
   "꾸준수입"이라는 말이 성립하려면 여기서 막히면 안 된다 — 그래서 길게 재 본다.
============================================================ */
console.log('');
console.log('══ H-3 ★꾸준한가 — 180일을 굴리면 몇 번이나 자를 수 있나 ══');
for (const dli of [3.77, 12]) {
  const r = runCuttings({ days: 180, dli, container: 'jar', jars: 2 });
  console.log(`  DLI ${String(dli).padEnd(5)} | 180일 · 자른 것 ${r.cuts}회 · 매출 ${won(r.soldWon)} · ` +
              `순액 ${won(r.net)} · 하루평균 ${won(r.net / r.days)} · 끝날 때 모주 잎 ${r.leaves}장`);
}

console.log('');
console.log('══ I  이사비 150만까지 며칠 ══');
/* 콩나물 시차 수입 — probe_crop_cycle.mjs 가 이미 잰 값이다. 여기서 다시 시뮬하지 않고
   그 도구가 낸 "하루 960원"을 그대로 쓴다(값을 두 곳에서 만들지 않는다). */
const CROP_PER_DAY = 960;
const MOVE = TU.TUTORIAL_RULES ? TU.TUTORIAL_RULES.moveOutCostWon : 1_500_000;
const best = H.reduce((a, b) => (b[1].net > a[1].net ? b : a));
const cutPerDay = best[1].net / best[1].days;
const line = (ko, perDay) => console.log(
  `  ${ko.padEnd(28)} | 하루 ${won(perDay)} → 150만까지 ` +
  (perDay > 0 ? `${Math.ceil(MOVE / perDay)}일` : '영영 (수입이 없다)'));
/* ★ 30일치와 180일치를 **둘 다** 낸다. 30일만 보면 거짓말이 된다 —
   첫 30일은 도착 개체가 이미 갖고 있던 잎을 털어 파는 것이라 한 번뿐이고,
   그 뒤로는 모주가 새 잎을 내는 속도(H-2)가 곧 수입 속도다. */
const long180 = runCuttings({ days: 180, dli: 3.77, container: 'jar', jars: 2 });
const cutLong = long180.net / long180.days;
line('삽수만 · 첫 30일 (' + best[0] + ')', cutPerDay);
line('삽수만 · 180일 평균', cutLong);
line('콩나물 시차만', CROP_PER_DAY);
line('★둘 다 (삽수는 180일 평균)', cutLong + CROP_PER_DAY);
console.log(`  ⤷ 이사비 ${won(MOVE)} · 콩나물 하루 ${won(CROP_PER_DAY)} 는 ` +
            `tools/probe_crop_cycle.mjs 가 잰 값(시루 5개·하루씩 어긋나게)이다.`);
console.log(`  ⤷ ★첫 30일 ${won(cutPerDay)} 은 **한 번뿐**이다 — 도착 개체가 이미 달고 온 잎을 터는 것이다.`);
console.log(`    이어지는 속도는 ${won(cutLong)}/일 이고, 그 상한은 모주가 새 잎을 내는 속도가 정한다(H-2).`);

/* ============================================================
   결과
============================================================ */
/* ═══════════════════════════════════════════════════════════════════════════
   J · ★★★ **삽수도 식물등 빛을 받는다** (2026-08-09 · 급한 버그 수정)
   ------------------------------------------------------------
   ⚠⚠ 무엇이 잘못됐나 — `loop.js` 가 삽수의 빛을 재는 데 **빈 옵션을 넘겼다**:
       화분: dliOfSlot(ref, { weather, season, lampCount, litHours })   ← 네 개를 다 넘김
       삽수: dliOfSlot(c, {})                                          ← 하나도 안 넘김
     ⇒ 삽수와 그걸로 키운 새 모주가 **식물등 빛을 아예 못 받았다.**
       등 밑 선반이 12.31 인데 0.48 로 재졌다(25.6배). 최소 DLI 3 이니 영영 안 자란다.
   ★ 고친 방법 — 베끼지 않고 **옵션을 짓는 일을 한 곳으로** 묶었다(`loop.lightOptsOf`).
     두 부르는 데가 하는 일은 다르다(「오늘」 vs 「그 날씨라면」) — 함수를 통째로 묶을 수는 없으므로
     **같은 칸을 짓는 것**을 묶는다. 칸이 하나 늘어도 두 곳이 같이 따라온다.
   ═══════════════════════════════════════════════════════════════════════════ */
{
  const { lightOptsOf } = await import('../src/game/loop.js');
  const { createProfileLight } = await import('../src/game/room_profile.js');
  const jj = (rp) => JSON.parse(fs.readFileSync(new URL(rp, import.meta.url), 'utf8'));
  const light = createProfileLight(jj('../data/profiles/room_profile.banjiha.json'),
    { lightTh: jj('../data/balance/light_thresholds.json'),
      weatherBalance: jj('../data/balance/weather.json') });
  const TH = jj('../data/balance/light_thresholds.json').plants.monstera_deliciosa;
  const MIN = TH.min, FEN = TH.fenestrate;
  const S = { lamps: { count: 1, litHours: 12 } };
  const sky = { weather: 'clear', season: 'summer' };
  const opt = lightOptsOf(S, sky);

  /* ① 짓는 칸이 화분 쪽이 넘기던 그것과 **띄어쓰기까지 같은가** */
  const same = opt.weather === sky.weather && opt.season === sky.season
            && opt.lampCount === S.lamps.count && opt.litHours === S.lamps.litHours;
  results.push([same ? 'PASS' : 'FAIL',
    'J-1 ★삽수와 화분이 **같은 칸**을 넘긴다 (날씨·계절·등·시간)', JSON.stringify(opt)]);

  /* ② 빈 옵션과 고친 옵션의 차이 — 이것이 버그의 크기다.
     ★★ 2026-08-16 (G-16) — **자리를 이름으로 박지 않는다.** 첫 등이 3단 선반 밑에서
       창 위로 옮겨졌다(`data/house_rooms.json`). 옛 코드는 `banjiha-etagere:7` 을 박아
       두었는데, 그 칸은 이제 등을 켜도 0.89 다. **박아 둔 이름이 곧 낡은 자다.**
       ⇒ 「등 몫이 제일 큰 칸」을 그 자리에서 골라 잰다 — 등이 어디로 가든 참이다. */
  const gains = light.room.slots.map(s => ({
    slotId: s.slotId, before: light.dliOfSlot(s.slotId, {}), after: light.dliOfSlot(s.slotId, opt)
  })).map(r => ({ ...r, gain: r.after - r.before }));
  const top = gains.reduce((a, b) => (b.gain > a.gain ? b : a));
  const KEY = top.slotId, before = top.before, after = top.after;
  results.push([after > before ? 'PASS' : 'FAIL',
    'J-2 ★★등 몫이 **살아난다** (빈 옵션이면 잠긴다)',
    `${KEY} ${before.toFixed(2)} → ${after.toFixed(2)} (+${top.gain.toFixed(2)})`]);
  /* ★ 등이 사는 것은 이제 「최소 DLI」가 아니라 **「갈라짐 문턱」**이다 —
     첫 등이 창턱을 맡으면서 그 칸은 자연광만으로도 이미 min 3 을 넘고 있다(4.80).
     그래서 등이 무엇을 바꾸는지는 6.0 에서 잰다. 문턱을 낮춘 것이 아니라 **잴 선이 올라갔다.** */
  results.push([before < FEN && after >= FEN ? 'PASS' : 'FAIL',
    'J-3 ★그래서 등을 사면 **잎이 갈라진다** (갈라짐 문턱을 넘는다)',
    `문턱 ${FEN} · 전 ${before.toFixed(2)}(안 갈라짐) → 후 ${after.toFixed(2)}(갈라진다) @ ${KEY}`]);

  /* ③ 자리가 진짜 상한이다 — 등 1개에서 자라는 칸이 몇인가 */
  const grow = light.room.slots.filter(s => light.dliOfSlot(s.slotId, opt) >= MIN).map(s => s.slotId);
  results.push(['INFO', `  ★ 등 1개에서 몬스테라가 자라는 자리 ${grow.length}곳: ${grow.join(' · ')}`]);
  results.push([grow.length > 0 ? 'PASS' : 'FAIL',
    'J-4 고친 뒤에는 자라는 자리가 있다', `${grow.length}곳`]);

  /* ④ ★ 등을 더 사도 거의 안 오른다 — 다음 사람이 헛돈 안 쓰게 적어 둔다 */
  const l1 = light.dliOfSlot(KEY, lightOptsOf({ lamps: { count: 1, litHours: 12 } }, sky));
  const l2 = light.dliOfSlot(KEY, lightOptsOf({ lamps: { count: 2, litHours: 12 } }, sky));
  results.push(['INFO', `  ★ 등 1개 ${l1.toFixed(2)} → 2개 ${l2.toFixed(2)} ` +
    `(${((l2 / l1 - 1) * 100).toFixed(1)}%) — 등을 더 사도 거의 안 오른다. ` +
    `모주를 늘리려면 **가구가 밝은 칸을 만들어야** 한다`]);
}

console.log('');
let fail = 0;
for (const r of results) {
  if (r[0] === 'INFO') console.log(r[1]);
  else { console.log(`${r[0] === 'PASS' ? '✔' : '✘'} ${r[1]}${r[2] ? ' — ' + r[2] : ''}`); if (r[0] === 'FAIL') fail++; }
}
console.log(fail ? `\n${fail}건 실패` : '\n전부 통과');
process.exit(fail ? 1 : 0);
