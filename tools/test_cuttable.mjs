/* ============================================================
   test_cuttable.mjs — 삽수용 마디 접근자 `cuttableNodes()` (growth 소유)
   ------------------------------------------------------------
   증명하려는 것은 하나다: **이 목록은 실제로 자란 그 식물에서 읽은 것이다.**
   박사님 확정이 "삽수는 실제 자랐던 거를 각각 잘라서" 이므로, 잎 수 하나라도
   지어낸 값이면 이 기능은 그 자리에서 존재 이유가 없어진다.

     A  143일 도착 개체가 실제 마디를 낸다 — 빈 배열이 아니고 등급이 캐논 넷 안이다
     B  ★잎 수가 지어낸 값이 아니다 — 밑동 마디의 잎 수 = axisTimeline 이 세는 살아있는 잎 수
     C  ★쌍혹(main) 개체는 axisTimeline 보다 잎이 많다 — 두 경로의 차이를 여기 고정한다
     D  포함 관계 — 위 마디가 품은 잎은 아래 마디 이하 · 밑동이 그루 전체
     E  ★무늬가 지어낸 값이 아니다 — 무늬 잎 비율이 calcVarieProb 과 맞고 빛 따라 움직인다
     F  ★더 자란 개체가 마디를 더 많이 내고, 먼저 난 마디의 이름은 그대로다
     G  ★nodeId 안정 — 같은 SEED·같은 생장일이면 다시 그려도 같다
     H  코어 계약 — propagation.assertCutNode 를 전부 통과한다
     I  ★성장 결과 불변 — 매 턴 불러도 유효 생장·성숙·잎 상태가 한 글자도 안 바뀐다
     J  잎이 떨어지면 잎 수도 준다 · 씨앗 단계에는 마디가 없다

   같은 성격의 접근자 `leafStats()` — 파는 값(단위기본가 × 크기 × (1+60·v²))의 크기와 v 를 낸다.
     K  ★자를 때 본 잎 수와 팔 때 본 잎 수가 같다 — cuttableNodes 의 밑동 마디와 일치한다
     L  ★무늬 잎 비율이 calcVarieProb 과 맞는다 (E 와 같은 방식)
     M  ★성숙 잎 수가 MAT_STATE 와 맞는다 — 파는 순간 새로 굴리지 않는다
     N  ★매 턴 leafStats() 를 불러도 성장 결과가 안 바뀐다 (I 와 같은 방식)

   ★ 헤드리스 방식은 tools/test_maturation.mjs 와 같다(3D 만 걷어낸다).

     node tools/test_cuttable.mjs
============================================================ */
import assert from 'node:assert';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const toUrl = (rel) => 'file:///' + path.join(ROOT, rel).replace(/\\/g, '/');
const { assertCutNode, CUTTABLE_STEMS, isCuttableStem } = await import(toUrl('src/game/propagation.js'));

/* ── THREE 스텁 (test_maturation.mjs 와 같다) ───────────────────────────── */
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
    crossVectors(a, b) {
      return this.set(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
    }
    lerp(v, t) { this.x += (v.x - this.x) * t; this.y += (v.y - this.y) * t; this.z += (v.z - this.z) * t; return this; }
    applyAxisAngle() { return this; }
    distanceTo(v) { return this.clone().sub(v).length(); }
  }
  const nop = function () { return new Proxy({}, handler); };
  const handler = {
    get(t, k) {
      if (k === 'then') return undefined;
      if (k === Symbol.toPrimitive) return () => 0;
      if (!(k in t)) t[k] = new Proxy(nop, handler);
      return t[k];
    },
    apply() { return new Proxy({}, handler); },
    construct() { return new Proxy({ position: new V3(), rotation: new V3(), scale: new V3(1, 1, 1) }, handler); }
  };
  return new Proxy({ Vector3: V3, Vector2: V3 }, handler);
}

/* ── plant_grow.html 의 본문 스크립트만 뽑아 vm 에 올린다 ─────────────────── */
function loadGrowth({ seed = 92158, tuningPatch = null } = {}) {
  const html = fs.readFileSync(path.join(ROOT, 'plant_grow.html'), 'utf8');
  const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  const main = blocks[blocks.length - 1];
  assert.ok(main && main.length > 20000, 'plant_grow.html 본문 스크립트를 못 찾았습니다');
  const src = main.replace(/\n\s*init\(\);\s*updateCam\(\);\s*$/, '\n/* init() 제거(헤드리스) */\n');
  assert.notEqual(src, main, 'init() 호출부를 못 찾았습니다 — 파일 끝이 바뀌었습니다');

  let tuning = fs.readFileSync(path.join(ROOT, 'data', 'growth_tuning.json'), 'utf8');
  if (tuningPatch) { const t = JSON.parse(tuning); tuningPatch(t); tuning = JSON.stringify(t); }
  const el = () => ({
    value: '', textContent: '', checked: false, dataset: {}, style: {}, classList: { add() {}, remove() {}, toggle() {} },
    appendChild() {}, addEventListener() {}, removeEventListener() {}, setAttribute() {}, getAttribute() { return null; },
    querySelector() { return null; }, querySelectorAll() { return []; }, insertAdjacentHTML() {}, focus() {}, remove() {}
  });
  const warnings = [], errors = [];
  const ctx = {
    THREE: makeThree(),
    console: { log() {}, warn: (...a) => warnings.push(a.join(' ')), error: (...a) => errors.push(a.join(' ')) },
    document: {
      getElementById() { return null; }, createElement: el, querySelector() { return null; },
      querySelectorAll() { return []; }, addEventListener() {}, body: el(), documentElement: el()
    },
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
  ctx.seedTo = (v) => { try { ctx.plantSeed(v); } catch (e) { /* 그리기 실패는 무시 */ } };
  if (seed != null) ctx.seedTo(seed);
  return ctx;
}
async function ready(g) {
  for (let i = 0; i < 50 && !g.thLoaded(); i++) await new Promise(r => setImmediate(r));
  assert.ok(g.thLoaded(), '임계값 정본이 안 실렸습니다: ' + g._errors.join(' | '));
  return g;
}

/* 한 개체를 세운다 — 씨앗·빛·진행도를 그 자리에 꽂는다(형태 배치용 점프) */
function stand(g, { seed = 92158, dli = 3.77, day = 143 } = {}) {
  g.seedTo(seed); g.matResetAll();
  if (dli == null) g.resetDailyLight(); else g.setDailyLightSteady(dli);
  g.setGrowth(day);
  return g.cuttableNodes();
}
/* ★대조군 — cuttableNodes 와 **다른 코드 경로**로 지금 달려 있는 잎을 센다.
   test_maturation 의 낙엽 검사(M)가 쓰는 바로 그 식이다. */
function liveLeaves(g) {
  const age = g.ageOf(g.growthDays());
  return g.axisTimeline(age).filter(a => a.birth <= age && age >= a.leafBirth && !g.leafDroppedOf(a.leafBirth)).length;
}
const rootNode = (nodes) => nodes.find(n => n.nodeId === 'n0#0');
const hasTwin = (nodes) => nodes.some(n => n.stem === 'main' || n.nodeId.includes(':'));

const results = [];
const check = (name, fn) => { try { fn(); results.push(['PASS', name]); }
                              catch (e) { results.push(['FAIL', name, e.message]); } };
const info = (s) => results.push(['INFO', s]);

const g = await ready(loadGrowth());

/* ══ A · 143일 도착 개체가 실제 마디를 낸다 ═══════════════════════════════ */
check('A 143일 도착 개체 — 마디 목록이 비어 있지 않고 등급이 캐논 넷 안이다', () => {
  const nodes = stand(g, { day: 143 });
  assert.ok(Array.isArray(nodes), 'cuttableNodes() 가 배열이 아닙니다: ' + nodes);
  assert.ok(nodes.length > 0, '★143일 개체인데 마디가 하나도 없습니다 — 자르기 UI 를 못 엽니다');
  const KNOWN = ['petiole', 'pink', 'thick', 'main'];
  for (const n of nodes)
    assert.ok(KNOWN.includes(n.stem), `모르는 stem 등급입니다: ${n.stem} (${n.nodeId})`);
  assert.ok(nodes.some(n => isCuttableStem(n.stem)),
    `★자를 수 있는 마디(${CUTTABLE_STEMS.join('/')})가 하나도 없습니다`);
  info('  143일(SEED 92158 · DLI 3.77) 마디 ' + nodes.length + '개');
  for (const n of nodes)
    info(`    ${n.nodeId.padEnd(10)} ${n.stem.padEnd(8)} 잎 ${n.leaves} (무늬 ${n.variegatedLeaves}) · ${n.growthDays}일`);
});

/* ══ B · ★잎 수가 지어낸 값이 아니다 ════════════════════════════════════
   밑동 마디를 자르면 그루가 통째로 딸려온다 → 그 잎 수는 **지금 달려 있는 잎 수**여야 한다.
   대조군은 axisTimeline 이다 — cuttableNodes 와 다른 코드 경로다. */
check('B ★밑동 마디의 잎 수 = 실제로 달려 있는 잎 수 (쌍혹 없는 개체 전수)', () => {
  let n = 0;
  for (const day of [143, 200, 300, 500]) {
    for (let s = 1; s <= 200; s++) {
      const nodes = stand(g, { seed: s, day });
      if (hasTwin(nodes)) continue;                 // 쌍혹은 C 에서 따로 본다
      const root = rootNode(nodes);
      assert.ok(root, `밑동 마디(n0#0)가 없습니다 — seed ${s} · ${day}일`);
      assert.equal(root.leaves, liveLeaves(g),
        `★seed ${s} · ${day}일: 밑동 마디가 잎 ${root.leaves}장이라는데 실제로 달린 잎은 ${liveLeaves(g)}장입니다`);
      n++;
    }
  }
  assert.ok(n > 200, '대조한 개체가 너무 적습니다: ' + n);
  info(`  개체 ${n}건에서 밑동 마디 잎 수가 axisTimeline 과 정확히 같음`);
});

/* ══ C · ★쌍혹 개체는 axisTimeline 보다 잎이 많다 (두 경로의 차이) ═════════
   axisTimeline 은 혹 하나에 가지 하나만 세지만, 실제로 자라는 것(buildPlant·growTopology)은
   doubleBud 확률로 **가지 둘**을 낸다. cuttableNodes 는 실제로 자란 쪽을 읽는다. */
check('C 쌍혹(main) 개체 — 실제 잎이 axisTimeline 이 세는 것보다 많다', () => {
  let twin = 0, more = 0;
  for (let s = 1; s <= 200; s++) {
    const nodes = stand(g, { seed: s, day: 500 });
    if (!hasTwin(nodes)) continue;
    twin++;
    const root = rootNode(nodes);
    if (root.leaves > liveLeaves(g)) more++;
  }
  assert.ok(twin > 0, '200 시드에 쌍혹 개체가 하나도 없습니다 — doubleBud 가 0 입니까?');
  assert.equal(more, twin,
    `쌍혹 개체 ${twin}건 중 ${more}건만 잎이 더 많습니다 — 두 경로의 차이가 설명되지 않습니다`);
  info(`  쌍혹 개체 ${twin}건 전부 axisTimeline 보다 잎이 많음 (가지가 둘 나므로 당연하다)`);
});

/* ══ D · 포함 관계 — 위로 갈수록 딸려오는 것이 줄어든다 ═══════════════════ */
check('D 같은 축에서 위 마디가 품은 잎은 아래 마디 이하다 · 무늬는 잎을 못 넘는다', () => {
  for (const day of [143, 300, 700]) {
    for (const s of [92158, 1, 7, 33, 101]) {
      const nodes = stand(g, { seed: s, day });
      const byAxis = new Map();
      for (const n of nodes) {
        const [ax, i] = n.nodeId.slice(1).split('#');
        const arr = byAxis.get(ax) || []; arr[+i] = n; byAxis.set(ax, arr);
      }
      for (const [ax, arr] of byAxis) for (let i = 1; i < arr.length; i++) {
        if (!arr[i] || !arr[i - 1]) continue;
        assert.ok(arr[i].leaves <= arr[i - 1].leaves,
          `★${ax} 축: 위 마디 ${arr[i].nodeId}(잎 ${arr[i].leaves})가 아래 마디 ${arr[i - 1].nodeId}(잎 ${arr[i - 1].leaves})보다 많습니다`);
        assert.ok(arr[i].growthDays <= arr[i - 1].growthDays,
          `★${arr[i].nodeId} 이 아래 마디보다 오래 자랐습니다`);
      }
      for (const n of nodes) {
        assert.ok(n.variegatedLeaves <= n.leaves, `★${n.nodeId}: 무늬 ${n.variegatedLeaves} > 잎 ${n.leaves}`);
        assert.ok(n.leaves >= 0 && n.growthDays >= 0, `${n.nodeId}: 음수 값`);
      }
    }
  }
});

/* ══ E · ★무늬가 지어낸 값이 아니다 ══════════════════════════════════════
   무늬는 잎마다 calcVarieProb 로 굴린 결과다(캐논). 목록이 그걸 그대로 읽은 것이라면
   **밑동 마디의 무늬 잎 비율이 calcVarieProb 에 수렴**해야 한다. 상수를 박아 넣으면 못 맞춘다. */
check('E ★무늬 잎 비율이 calcVarieProb 과 맞는다 · 빛 따라 움직인다', () => {
  const seen = [];
  for (const dli of [0.6, 3.77, 12.16]) {
    g.seedTo(1); g.setDailyLightSteady(dli);
    const p = g.calcVarieProb(g.lightCtx());
    let leaves = 0, varie = 0;
    for (let s = 1; s <= 400; s++) {
      const root = rootNode(stand(g, { seed: s, dli, day: 500 }));
      leaves += root.leaves; varie += root.variegatedLeaves;
    }
    assert.ok(leaves > 2000, '표본이 너무 적습니다: ' + leaves);
    const obs = varie / leaves;
    assert.ok(Math.abs(obs - p) < 0.02,
      `★DLI ${dli}: 확률은 ${p.toFixed(4)} 인데 실제 무늬 비율이 ${obs.toFixed(4)} 입니다 — 읽은 값이 아닙니다`);
    seen.push({ dli, p, obs, leaves, varie });
    info(`  DLI ${dli}: calcVarieProb ${p.toFixed(4)} · 실제 ${obs.toFixed(4)} (${varie}/${leaves}장)`);
  }
  assert.equal(seen[0].varie, 0, '★빛이 없다시피 한데 무늬 잎이 났습니다');
  assert.ok(seen[2].obs > seen[1].obs, '밝은 자리가 어두운 자리보다 무늬가 안 많습니다');
});

/* ══ F · ★더 자라면 마디가 늘고, 먼저 난 마디의 이름은 그대로다 ═══════════ */
check('F 더 자란 개체가 마디를 더 많이 낸다 · 먼저 난 마디의 nodeId 는 안 바뀐다', () => {
  const days = [143, 200, 300, 500, 800];
  const sets = days.map(d => stand(g, { day: d }).map(n => n.nodeId));
  for (let i = 1; i < days.length; i++) {
    assert.ok(sets[i].length > sets[i - 1].length,
      `${days[i]}일(${sets[i].length}개)이 ${days[i - 1]}일(${sets[i - 1].length}개)보다 마디가 많지 않습니다`);
    for (const id of sets[i - 1])
      assert.ok(sets[i].includes(id),
        `★${days[i - 1]}일에 있던 마디 ${id} 가 ${days[i]}일에는 없습니다 — nodeId 가 흔들립니다`);
  }
  info('  마디 수 ' + days.map((d, i) => `${d}일 ${sets[i].length}`).join(' → '));
});

/* ══ G · ★nodeId 안정 — 다시 그려도·다른 개체를 거쳐도 같다 ═══════════════ */
check('G ★같은 SEED·같은 생장일이면 목록이 통째로 같다', () => {
  const a = JSON.stringify(stand(g, { day: 143 }));
  const b = JSON.stringify(g.cuttableNodes());                       // 그냥 한 번 더
  assert.equal(b, a, '★같은 자리에서 두 번 불렀는데 값이 다릅니다');
  stand(g, { seed: 777, day: 900 });                                 // 딴 개체를 거쳐 온다
  const c = JSON.stringify(stand(g, { day: 143 }));
  assert.equal(c, a, '★다른 개체를 거쳐 돌아오니 값이 달라졌습니다');
});
{ /* 창을 새로 올려도 같은가 — 세이브에 들어가는 값이라 이게 진짜 시험이다 */
  const g2 = await ready(loadGrowth());
  check('G2 ★새로 올린 창에서도 같은 SEED·같은 생장일이면 목록이 같다', () => {
    const a = JSON.stringify(stand(g, { day: 143 }));
    const b = JSON.stringify(stand(g2, { day: 143 }));
    assert.equal(b, a, '★창을 새로 올리니 마디 목록이 달라졌습니다 — 세이브를 못 믿습니다');
  });
}

/* ══ H · 코어 계약 — 코어의 검사기를 그대로 통과한다 ══════════════════════ */
check('H propagation.assertCutNode 를 전 마디가 통과한다', () => {
  for (const day of [143, 300, 900]) for (const s of [92158, 5, 42]) {
    const nodes = stand(g, { seed: s, dli: 12.16, day });
    nodes.forEach((n, i) => assertCutNode(n, `seed${s}/${day}일/nodes[${i}]`));
    // 잎 없는 조각은 자를 수 없다(§3) — 자를 수 있는 마디는 잎을 하나는 품어야 한다
    for (const n of nodes) if (isCuttableStem(n.stem))
      assert.ok(n.leaves >= 1, `★자를 수 있다는 ${n.nodeId} 가 잎을 하나도 안 품었습니다`);
  }
});

/* ══ I · ★성장 결과 불변 — 읽기만 하는지 확인한다 ════════════════════════
   접근자가 난수 스트림이나 상태를 건드리면 그날부터 형태가 조용히 달라진다. */
check('I ★매 턴 cuttableNodes 를 불러도 성장 결과가 한 글자도 안 바뀐다', () => {
  const run = (probe) => {
    g.seedTo(92158); g.matResetAll(); g.setGrowth(0);
    const turns = [];
    for (let i = 0; i < 220; i++) {
      g.setDailyLightSteady(i < 120 ? 12.16 : 0.6);
      turns.push(g.advanceTo(g.calendarDay() + 1));
      if (probe) g.cuttableNodes();
    }
    return JSON.stringify({
      turns, growth: g.growthDays(), cal: g.calendarDay(),
      mat: g.matStateAll(), health: g.leafHealthAll(),
      timeline: g.axisTimeline(g.ageOf(g.growthDays())).map(a => [a.birth, a.leafBirth, a.segs.length])
    });
  };
  const plain = run(false), probed = run(true);
  assert.equal(probed, plain, '★cuttableNodes 를 부른 쪽의 성장 결과가 다릅니다 — 읽기 전용이 아닙니다');
});

/* ══ J · 잎이 떨어지면 잎 수가 준다 · 씨앗 단계에는 마디가 없다 ═══════════ */
{
  const g2 = await ready(loadGrowth({ tuningPatch: t => { t.health.drop_enabled = true; t.health.drop_hold_days = 3; } }));
  check('J 낙엽을 켜면 딸려가는 잎 수가 실제로 준다', () => {
    g2.seedTo(92158); g2.matResetAll(); g2.setGrowth(0);
    for (let i = 0; i < 260; i++) { g2.setDailyLightSteady(12.16); g2.advanceTo(g2.calendarDay() + 1); }
    const before = rootNode(g2.cuttableNodes()).leaves;
    assert.ok(before >= 2, '적정광 260일인데 잎이 ' + before + '장뿐입니다');
    let dropped = 0;
    for (let i = 0; i < 400; i++) { g2.setDailyLightSteady(0.6);
      dropped += (g2.advanceTo(g2.calendarDay() + 1).leaves || []).filter(x => x.kind === 'drop').length; }
    assert.ok(dropped > 0, '400일 동안 떨어진 잎이 없습니다 — 이 블록이 아무것도 안 재고 있습니다');
    const after = rootNode(g2.cuttableNodes()).leaves;
    assert.ok(after < before, `★잎이 ${dropped}장 떨어졌는데 딸려가는 잎은 ${before} → ${after} 로 그대로입니다`);
    assert.equal(after, liveLeaves(g2), `떨어진 뒤 잎 수가 안 맞습니다: ${after} vs ${liveLeaves(g2)}`);
    info(`  낙엽 ${dropped}장 뒤 밑동 마디 잎 ${before} → ${after}`);
    // ★ 파는 값도 같이 준다 — 떨어진 잎을 팔 수는 없다
    assert.equal(g2.leafStats().leaves, after,
      `★잎이 떨어졌는데 leafStats 는 ${g2.leafStats().leaves}장이라고 합니다 (실제 ${after}장)`);
  });
}
check('J2 씨앗 단계에는 마디가 없다 — 빈 배열이지 null 이 아니다', () => {
  for (const d of [0, 1, 3]) {
    const nodes = stand(g, { day: d });
    assert.ok(Array.isArray(nodes) && nodes.length === 0, `${d}일에 마디가 ${nodes && nodes.length}개 나왔습니다`);
  }
});

/* ══════════════════════════════════════════════════════════════════════
   leafStats() — 파는 값이 쓰는 잎 집계
   ══════════════════════════════════════════════════════════════════════ */

/* ══ K · ★자를 때 본 잎 수 = 팔 때 본 잎 수 ══════════════════════════════
   밑동 마디를 자르면 그루가 통째로 딸려온다. 그러니 두 접근자가 같은 트리를 본다면
   leafStats().leaves 는 cuttableNodes() 의 n0#0 잎 수와 **항상** 같아야 한다.
   여기가 갈리면 "잘라 판 것"과 "판 것"이 다른 그루가 된다. */
check('K ★leafStats().leaves 가 cuttableNodes() 의 밑동 마디와 항상 같다', () => {
  let n = 0, twin = 0;
  for (const dli of [0.6, 3.77, 12.16]) for (const day of [30, 143, 300, 700]) {
    for (let s = 1; s <= 60; s++) {
      const nodes = stand(g, { seed: s, dli, day });
      const st = g.leafStats();
      const root = rootNode(nodes);
      assert.equal(st.leaves, root ? root.leaves : 0,
        `★seed ${s} · ${day}일 · DLI ${dli}: 팔 때 ${st.leaves}장인데 자를 때 ${root && root.leaves}장입니다`);
      assert.equal(st.variegatedLeaves, root ? root.variegatedLeaves : 0,
        `★seed ${s} · ${day}일: 무늬 잎 수가 두 접근자에서 다릅니다`);
      assert.equal(st.growthDays, g.growthDays(), 'growthDays 가 유효 생장일과 다릅니다');
      assert.ok(st.matureLeaves <= st.leaves, `★성숙 잎이 전체 잎보다 많습니다: ${JSON.stringify(st)}`);
      assert.ok(st.variegatedLeaves <= st.leaves, `★무늬 잎이 전체 잎보다 많습니다: ${JSON.stringify(st)}`);
      n++; if (hasTwin(nodes)) twin++;
    }
  }
  assert.ok(n > 700 && twin > 0, `표본이 모자랍니다: ${n}건(쌍혹 ${twin}건)`);
  info(`  개체 ${n}건(쌍혹 ${twin}건 포함) 전부 두 접근자가 같은 잎을 셈`);
  const st = stand(g, { day: 143 }) && g.leafStats();
  info(`  143일(SEED 92158 · DLI 3.77) leafStats = ${JSON.stringify(st)}`);
});

/* ══ L · ★무늬 잎 비율이 calcVarieProb 과 맞는다 (E 와 같은 방식) ═════════ */
check('L ★leafStats 의 무늬 잎 비율이 calcVarieProb 과 맞는다 · 빛 따라 움직인다', () => {
  const seen = [];
  for (const dli of [0.6, 3.77, 12.16]) {
    g.seedTo(1); g.setDailyLightSteady(dli);
    const p = g.calcVarieProb(g.lightCtx());
    let leaves = 0, varie = 0;
    for (let s = 1; s <= 400; s++) {
      stand(g, { seed: s, dli, day: 500 });
      const st = g.leafStats(); leaves += st.leaves; varie += st.variegatedLeaves;
    }
    assert.ok(leaves > 2000, '표본이 너무 적습니다: ' + leaves);
    const obs = varie / leaves;
    assert.ok(Math.abs(obs - p) < 0.02,
      `★DLI ${dli}: 확률은 ${p.toFixed(4)} 인데 실제 무늬 비율이 ${obs.toFixed(4)} 입니다 — 읽은 값이 아닙니다`);
    seen.push(obs);
    info(`  DLI ${dli}: calcVarieProb ${p.toFixed(4)} · 실제 ${obs.toFixed(4)} (${varie}/${leaves}장)`);
  }
  assert.equal(seen[0], 0, '★빛이 없다시피 한데 무늬 잎이 났습니다');
  assert.ok(seen[2] > seen[1], '밝은 자리가 어두운 자리보다 무늬가 안 많습니다');
});

/* ══ M · ★성숙 잎 수가 MAT_STATE 와 맞는다 ═══════════════════════════════
   갈라짐의 정본은 MAT_STATE 다. leafStats 가 파는 순간 새로 굴리면 "팔려니까 갈라졌다"가 된다.
   대조군은 axisTimeline(다른 코드 경로) × matureOf 다. */
check('M ★성숙 잎 수가 MAT_STATE 와 맞는다 — 여기서 새로 굴리지 않는다', () => {
  let exact = 0, someMature = 0;
  const age = () => g.ageOf(g.growthDays());
  const liveMature = () => g.axisTimeline(age()).filter(a => a.birth <= age() && age() >= a.leafBirth
    && !g.leafDroppedOf(a.leafBirth) && g.matureOf(a.leafBirth)).length;
  for (const s of [92158, 1, 5, 7, 33, 42, 101, 555]) {
    // ① 점프로 세운 개체 ② 하루씩 걸어온 개체 — 둘 다 본다
    for (const walked of [false, true]) {
      if (walked) {
        g.seedTo(s); g.matResetAll(); g.setGrowth(0);
        for (let i = 0; i < 300; i++) { g.setDailyLightSteady(12.16); g.advanceTo(g.calendarDay() + 1); }
      } else stand(g, { seed: s, dli: 12.16, day: 500 });
      const st = g.leafStats(), nodes = g.cuttableNodes();
      const matured = new Set(g.matStateAll().filter(e => e.matured).map(e => e.leafBirth));
      if (st.matureLeaves > 0) {
        someMature++;
        assert.ok(matured.size > 0,
          `★seed ${s}: 성숙 잎 ${st.matureLeaves}장이라는데 MAT_STATE 에 성숙한 잎이 없습니다`);
      }
      if (hasTwin(nodes))                       // 쌍혹은 leafBirth 를 공유해 한 칸을 둘이 쓴다(C 참고)
        assert.ok(st.matureLeaves >= liveMature(), `★seed ${s}: 성숙 잎이 대조군보다 적습니다`);
      else { assert.equal(st.matureLeaves, liveMature(),
        `★seed ${s}(walked=${walked}): 성숙 잎 ${st.matureLeaves} vs 대조군 ${liveMature()}`); exact++; }
    }
  }
  assert.ok(exact > 0 && someMature > 0,
    `적정광인데 성숙 잎이 하나도 안 나왔습니다(exact ${exact} · mature ${someMature})`);
  // 어두운 자리면 성숙 잎이 확 준다 — 상수가 아니라 상태를 읽는다는 증거
  let bright = 0, dark = 0;
  for (let s = 1; s <= 60; s++) {
    stand(g, { seed: s, dli: 12.16, day: 500 }); bright += g.leafStats().matureLeaves;
    stand(g, { seed: s, dli: 3.77, day: 500 }); dark += g.leafStats().matureLeaves;
  }
  assert.ok(bright > dark, `밝은 자리 성숙 잎 ${bright} 이 어두운 자리 ${dark} 보다 많지 않습니다`);
  info(`  성숙 잎 합계 — 밝음(12.16) ${bright} · 어두움(3.77) ${dark}`);
});

/* ══ N · ★성장 결과 불변 — leafStats 도 읽기만 하는지 확인한다 ═══════════ */
check('N ★매 턴 leafStats 를 불러도 성장 결과가 한 글자도 안 바뀐다', () => {
  const run = (probe) => {
    g.seedTo(92158); g.matResetAll(); g.setGrowth(0);
    const turns = [];
    for (let i = 0; i < 220; i++) {
      g.setDailyLightSteady(i < 120 ? 12.16 : 0.6);
      turns.push(g.advanceTo(g.calendarDay() + 1));
      if (probe) { g.leafStats(); g.cuttableNodes(); }      // 둘 다 매 턴 부른다
    }
    return JSON.stringify({
      turns, growth: g.growthDays(), cal: g.calendarDay(),
      mat: g.matStateAll(), health: g.leafHealthAll(),
      timeline: g.axisTimeline(g.ageOf(g.growthDays())).map(a => [a.birth, a.leafBirth, a.segs.length])
    });
  };
  assert.equal(run(true), run(false), '★접근자를 부른 쪽의 성장 결과가 다릅니다 — 읽기 전용이 아닙니다');
});

/* ── 보고 ─────────────────────────────────────────────────────────────── */
let fail = 0;
for (const [st, name, msg] of results) {
  if (st === 'INFO') { console.log(name); continue; }
  if (st === 'FAIL') fail++;
  console.log(`${st}  ${name}${msg ? '\n      → ' + msg : ''}`);
}
console.log(fail ? `\ncuttable: FAIL (${fail}건)` : '\ncuttable: PASS');
process.exit(fail ? 1 : 0);
