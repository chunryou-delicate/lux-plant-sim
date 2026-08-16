/* 무늬 등급 — **개수가 아니라 종류다** (2026-08-17 확정문 검사)
 *
 *   node tools/test_variegrade.mjs
 *
 * 정본 둘을 다 본다:
 *   ① `docs/handoff/plan-2026-08-17-varie-grade.md`  — 박사님 확정문
 *   ② `data/balance/varie_grades.json`               — 그것을 옮긴 데이터 파일
 *
 * ★ 이 검사가 지키는 것 넷:
 *   A **밑값과 파일이 갈리지 않는다** — shop.js 안의 밑값은 파일을 못 읽었을 때만 사는 사본이다.
 *     둘이 갈리면 「파일을 고쳤는데 게임은 옛 값으로 돈다」가 조용히 성립한다(START-HERE §2.8).
 *   B **프롤로그 그루가 1,960,000원이다** — 확정문 §2 의 검산이 실제로 그 값을 내는가.
 *   G **에셋 갈래를 하나도 안 흘렸다** — `plant_grow.html` 의 `mon_*` 성숙 무늬가 전부
 *     어느 등급이거나 「아직 미배정」 목록에 있다. 조용히 사라진 갈래가 없는지 본다.
 *   H **옛 세이브가 열린다** — 등급 없는 판의 무늬 잎이 산반으로 읽히고, 그 사실이 기록에 남는다.
 *
 * ⚠ 브라우저를 안 쓴다(서버 필요 없음).
 */
import assert from 'node:assert';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  varieGradeRules, varieGradesFrom, installVarieGrades, VARIE_GRADES,
  priceOf, potPriceOf, cuttingPriceOf, varieLeavesNeededFor,
  varieGradeOf, varieGradeFromLight, varieLightStepOfBand, varieGradeExpectedWon,
  gradeOfMatNum, gradeOfSkinAsset, skinKeysOfGrade,
  midSkinKeysOfGrade, gradeOfMidNum, leafSkinsFor, potLeafSkinsOf,
  leafGradeListOf, legacyVarieGradeId, plainGradeId,
  assignPotLeafGrades, potLeafGradeListOf, potLeafGradesOf, prologueLeafGradeListOf
} from '../src/game/shop.js';
import { syncCuttingLeaves, cuttingStatsNow, cuttableNodesOfCutting,
         VARIE_LIGHT_BANDS } from '../src/game/propagation.js';
import { migrateVarieGrades } from '../src/game/save.js';

const ROOT = new URL('../', import.meta.url);
const J = (p) => JSON.parse(fs.readFileSync(new URL(p, ROOT), 'utf8'));
const T = (p) => fs.readFileSync(new URL(p, ROOT), 'utf8');
const won = (n) => (n == null ? '—' : n.toLocaleString() + '원');

let fails = 0, checks = 0;
const ok = (name, extra) => { checks++; console.log(`PASS  ${name}${extra ? '\n      ' + extra : ''}`); };
const bad = (name, why) => { checks++; fails++; console.log(`FAIL  ${name}\n      → ${why}`); };
function t(name, fn) {
  try { const e = fn(); ok(name, e || ''); }
  catch (e) { bad(name, e && e.message ? e.message : String(e)); }
}
const info = (s) => console.log('  ' + s);

console.log('=== 무늬 등급(종류) 검사 · 2026-08-17 확정문 ===\n');

const FILE = J('data/balance/varie_grades.json');
const R = varieGradeRules();

/* ══════════════════════════════════════════════════════════════════════════
   A. 파일이 실제로 쓰이고 있나 · 밑값과 갈리지 않았나
   ══════════════════════════════════════════════════════════════════════════ */
t('A-1 ★ shop.js 가 data/balance/varie_grades.json 을 실제로 읽고 있다', () => {
  assert.equal(R.source, 'data/balance/varie_grades.json',
    `읽은 데가 «${R.source}» 다 — 파일을 못 읽으면 박사님이 고쳐도 게임에 안 닿는다`);
  return `source = ${R.source} · schema = ${R.schema}`;
});

t('A-2 ★★ 밑값(shop.js)과 파일이 한 톨도 안 다르다', () => {
  /* 파일 없이 만든 규칙 = 밑값. 파일로 만든 규칙과 견준다.
     ⚠ 갈리면 「파일을 고쳤는데 게임은 옛 값」이 조용히 성립한다. 그 자리를 여기서 막는다. */
  const fromFile = varieGradesFrom(FILE);
  const fallback = varieGradesFrom(null);
  const flat = (x) => JSON.stringify({
    grades: x.grades.map(g => ({ ...g, assets: g.assets.map(a => ({ ...a })) })),
    sale: { ...x.sale, synergy: { ...x.sale.synergy } },
    lightGrade: x.lightGrade, lightBands: x.lightBands,
    legacyGradeId: x.legacyGradeId, prologueGrades: x.prologueGrades,
    unassignedAssets: x.unassignedAssets
  });
  assert.equal(flat(fallback), flat(fromFile),
    'shop.js §VARIE_GRADES_FALLBACK 과 data/balance/varie_grades.json 이 갈렸다 — ' +
    '파일을 고쳤으면 밑값도 같이 고쳐야 한다(둘 중 하나만 고치면 배선 없는 판이 옛 값으로 돈다)');
  return '밑값 ≡ 파일';
});

t('A-3 등급 셋 + 무지 하나 · 확률 줄마다 합이 1', () => {
  const varie = R.grades.filter(g => g.varie).map(g => g.id);
  assert.deepEqual(varie, ['sanban', 'halfmoon', 'fullmoon'],
    `무늬 등급이 ${varie.join('/')} 다 — 확정문 §1 은 산반·하프문·풀문 셋이다`);
  assert.ok(!R.byId.has('sector'), '「섹터」가 아직 살아 있다 — 확정문에서 없어진 갈래다');
  for (const [step, row] of Object.entries(R.lightGrade)) {
    const s = Object.values(row).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(s - 1) < 1e-9, `${step} 확률 합이 ${s} 다 (1 이라야 한다)`);
  }
  return `무늬 등급 ${varie.join(' · ')} · 밝기 ${Object.keys(R.lightGrade).join('/')}`;
});

t('A-4 밴드 묶음이 propagation 과 한 벌이다', () => {
  assert.deepEqual({ ...VARIE_LIGHT_BANDS }, { ...R.lightBands },
    'propagation.VARIE_LIGHT_BANDS 와 varie_grades.json 의 lightBands 가 갈렸다');
  assert.equal(varieLightStepOfBand('slow'), 'mid');
  assert.equal(varieLightStepOfBand('over'), 'bright');
  assert.equal(varieLightStepOfBand('unknown'), null, '모르는 밴드는 null 이라야 한다(안 정한다)');
  return '밴드 7개 → 밝기 3';
});

/* ══════════════════════════════════════════════════════════════════════════
   B. ★ 확정문 §6-1 — 프롤로그 그루가 1,960,000원인가
   ══════════════════════════════════════════════════════════════════════════ */
const PROLOGUE = ['plain', 'sanban', 'halfmoon'];
const MOVE_OUT_WON = 2_000_000;

t('B-1 ★★★ 프롤로그 그루 = 1,960,000원 (잎1 무지 · 잎2 산반 · 잎3 하프문 · 그루 ×1.4 · 시너지 ×1.25)', () => {
  const q = potPriceOf({ leaves: 3, leafGrades: PROLOGUE });
  assert.equal(q.leafSumWon, 1_120_000, `잎 값 합이 ${won(q.leafSumWon)} 다 (1,120,000 이라야 한다)`);
  assert.equal(q.formMult, 1.4, `그루 배수가 ${q.formMult} 다`);
  assert.equal(q.varieKinds, 2, `무늬 등급 종수가 ${q.varieKinds} 다 (산반·하프문 둘)`);
  assert.equal(q.synergy, 1.25, `시너지가 ${q.synergy} 다`);
  assert.equal(q.won, 1_960_000, `실측 ${won(q.won)} — 확정문 §2 는 1,960,000원이다`);
  return `${won(q.leafSumWon)} × ${q.formMult} × ${q.synergy} = ${won(q.won)}`;
});

t('B-2 ★ 프롤로그 그루가 이사비에 **40,000원 못 미친다** (확정문 §2 그림 그대로)', () => {
  const q = potPriceOf({ leaves: 3, leafGrades: PROLOGUE });
  assert.ok(q.won < MOVE_OUT_WON, `프롤로그 그루 하나로 이사가 된다(${won(q.won)}) — 확정문 그림과 다르다`);
  assert.equal(MOVE_OUT_WON - q.won, 40_000, `모자란 돈이 ${won(MOVE_OUT_WON - q.won)} 다`);
  return `이사비 ${won(MOVE_OUT_WON)} − 그루 ${won(q.won)} = ${won(MOVE_OUT_WON - q.won)} 모자란다`;
});

t('B-3 ★ 프롤로그 못박기가 코드가 아니라 파일에 있다 (확정문 §4)', () => {
  assert.deepEqual({ ...R.prologueGrades }, { 1: 'plain', 2: 'sanban', 3: 'halfmoon' });
  return '잎1 무지 · 잎2 산반 · 잎3 하프문';
});

/* ══════════════════════════════════════════════════════════════════════════
   C. 값 — 확정문 §2 의 표와 배수
   ══════════════════════════════════════════════════════════════════════════ */
const WANT_LEAF_WON = { plain: 20_000, sanban: 350_000, halfmoon: 750_000, fullmoon: 1_150_000 };

t('C-1 ★ 삽수 1잎 값이 확정문 §2 표와 같다', () => {
  const got = {};
  for (const g of R.grades) {
    got[g.id] = cuttingPriceOf({ leaves: 1, leafGrades: [g.id] }).won;
    assert.equal(got[g.id], WANT_LEAF_WON[g.id],
      `${g.ko} 1잎 삽수가 ${won(got[g.id])} 다 (${won(WANT_LEAF_WON[g.id])} 이라야 한다)`);
  }
  return R.grades.map(g => `${g.ko} ${won(got[g.id])}`).join(' · ');
});

t('C-2 ★ 그루는 삽수의 정확히 1.4배 (같은 잎 구성이면)', () => {
  for (const gid of Object.keys(WANT_LEAF_WON)) {
    const c = cuttingPriceOf({ leaves: 2, leafGrades: [gid, gid] }).won;
    const p = potPriceOf({ leaves: 2, leafGrades: [gid, gid] }).won;
    assert.equal(p, Math.round(c * 1.4), `${gid}: 삽수 ${won(c)} · 그루 ${won(p)}`);
  }
  return '삽수 ×1.0 · 그루 ×1.4';
});

t('C-3 ★ 시너지 — 무늬 등급 1종 ×1.0 · 2종 ×1.25 · 3종 ×1.50 (무지는 안 센다)', () => {
  const one = cuttingPriceOf({ leaves: 2, leafGrades: ['plain', 'sanban'] });
  assert.equal(one.varieKinds, 1, '무지가 종수에 섞였다');
  assert.equal(one.synergy, 1.0);
  const two = cuttingPriceOf({ leaves: 2, leafGrades: ['sanban', 'halfmoon'] });
  assert.equal(two.synergy, 1.25);
  const three = cuttingPriceOf({ leaves: 3, leafGrades: ['sanban', 'halfmoon', 'fullmoon'] });
  assert.equal(three.synergy, 1.5);
  assert.equal(three.won, Math.round((350_000 + 750_000 + 1_150_000) * 1.5));
  return `1종 ×1 · 2종 ×1.25 · 3종 ×1.5 (셋 다 모으면 ${won(three.won)})`;
});

t('C-4 ★ 등급 뚜껑(CUTTING_GRADE_CAP)이 없어졌다 — 잎 1장짜리 하프문 삽수가 제값을 받는다', () => {
  const q = cuttingPriceOf({ leaves: 1, leafGrades: ['halfmoon'] });
  assert.equal(q.won, 750_000, `잎1 하프문 삽수가 ${won(q.won)} 다`);
  assert.equal(q.gradeCapped, false);
  return `잎1 하프문 삽수 ${won(q.won)} (옛 규칙이면 산반 뚜껑에 걸려 80,000원이었다)`;
});

t('C-5 ★ 잎이 늘면 값이 반드시 는다 · 등급이 오르면 값이 반드시 오른다', () => {
  for (let n = 1; n <= 8; n++) {
    const a = cuttingPriceOf({ leaves: n, leafGrades: Array(n).fill('plain') }).won;
    const b = cuttingPriceOf({ leaves: n + 1, leafGrades: Array(n + 1).fill('plain') }).won;
    assert.ok(b > a, `잎 ${n}→${n + 1} 에서 값이 안 늘었다 (${won(a)} → ${won(b)})`);
  }
  const ladder = ['plain', 'sanban', 'halfmoon', 'fullmoon']
    .map(g => cuttingPriceOf({ leaves: 3, leafGrades: ['plain', 'plain', g] }).won);
  for (let i = 1; i < ladder.length; i++)
    assert.ok(ladder[i] > ladder[i - 1], `등급 사다리가 ${i} 에서 꺾였다: ${ladder.join(' → ')}`);
  return `사다리 ${ladder.map(won).join(' → ')}`;
});

t('C-6 ★ 떼어 팔기가 절대 이득이 아니다 (그루 ×1.4 와 시너지가 같이 빠진다)', () => {
  const kinds = ['plain', 'sanban', 'halfmoon', 'fullmoon'];
  let worst = 0;
  for (let n = 2; n <= 5; n++) {
    for (let trial = 0; trial < 60; trial++) {
      const list = Array.from({ length: n }, (_, i) => kinds[(trial * 7 + i * 3) % kinds.length]);
      const whole = potPriceOf({ leaves: n, leafGrades: list }).won;
      for (let cut = 1; cut < n; cut++) {
        const split = cuttingPriceOf({ leaves: cut, leafGrades: list.slice(0, cut) }).won +
                      cuttingPriceOf({ leaves: n - cut, leafGrades: list.slice(cut) }).won;
        assert.ok(split <= whole,
          `잎 ${n}(${list.join('/')})을 ${cut}+${n - cut} 로 쪼개면 ${won(split)} > 통째 ${won(whole)}`);
        worst = Math.max(worst, split / whole);
      }
    }
  }
  return `쪼갠 값 / 통째 값의 최대 = ${(worst * 100).toFixed(1)}% (100% 를 못 넘는다)`;
});

/* ══════════════════════════════════════════════════════════════════════════
   D. ★ 빛이 등급을 정한다 (확정문 §3)
   ══════════════════════════════════════════════════════════════════════════ */
const WANT_EXPECT = { dark: 394_000, mid: 490_000, bright: 630_000 };

t('D-1 ★★ 무늬 1장 기대값 — 어두움 394,000 · 중간 490,000 · 밝음 630,000', () => {
  const got = {};
  for (const step of Object.keys(WANT_EXPECT)) {
    got[step] = varieGradeExpectedWon(step);
    assert.equal(Math.round(got[step]), WANT_EXPECT[step],
      `${step} 기대값이 ${won(Math.round(got[step]))} 다 (${won(WANT_EXPECT[step])} 이라야 한다)`);
  }
  return Object.entries(got).map(([k, v]) => `${k} ${won(Math.round(v))}`).join(' · ');
});

t('D-2 ★ 밝은 자리가 어두운 자리의 1.6배다 (확정문 §3 의 결론)', () => {
  const r = varieGradeExpectedWon('bright') / varieGradeExpectedWon('dark');
  assert.ok(Math.abs(r - 1.6) < 0.02, `비가 ${r.toFixed(3)} 배다 — 확정문은 1.6배라 했다`);
  return `${varieGradeExpectedWon('bright').toLocaleString()} / ${varieGradeExpectedWon('dark').toLocaleString()} = ${r.toFixed(3)}배`;
});

t('D-3 ★ 어두운 자리에서도 풀문이 난다 (1%) · 밝은 자리에서도 산반이 제일 흔하다', () => {
  const N = 20000;
  const cnt = {};
  for (const step of ['dark', 'mid', 'bright']) {
    cnt[step] = { sanban: 0, halfmoon: 0, fullmoon: 0 };
    for (let i = 0; i < N; i++) cnt[step][varieGradeFromLight(step, (i + 0.5) / N)]++;
  }
  assert.ok(cnt.dark.fullmoon > 0, '어두운 자리에서 풀문이 한 번도 안 났다');
  assert.ok(cnt.bright.sanban >= cnt.bright.halfmoon, '밝은 자리에서 산반이 하프문보다 드물다');
  assert.equal(varieGradeFromLight('unknown', 0.5), null, '모르는 밝기는 null 이라야 한다(안 정한다)');
  return Object.entries(cnt).map(([k, v]) =>
    `${k} 산반 ${(v.sanban / N * 100).toFixed(0)}% · 하프문 ${(v.halfmoon / N * 100).toFixed(0)}% · 풀문 ${(v.fullmoon / N * 100).toFixed(0)}%`
  ).join('\n      ');
});

/* ══════════════════════════════════════════════════════════════════════════
   E. 잎별 장부 — 그루(pot.leafGrades)
   ══════════════════════════════════════════════════════════════════════════ */
const mkState = (over = {}) => ({
  day: 10, sim: { seed: 4242 }, tutorial: { enabled: true, cashWon: 100 },
  pots: [{ id: 'pot_01' }], cuttings: [], ...over
});
const leafRows = (n, varieFrom = 2) =>
  Array.from({ length: n }, (_, i) => ({ leafBirth: i * 100, varie: i + 1 >= varieFrom,
                                         matured: true, fade: 0, dropped: false }));

t('E-1 ★★ 프롤로그 못박기가 빛과 무관하게 먼저 걸린다 (첫 판은 늘 같은 그림)', () => {
  const S = mkState();
  const r = assignPotLeafGrades(S, { leafState: leafRows(3), band: null });   // 빛을 못 쟀다
  const list = potLeafGradeListOf(S.pots[0], 3, 2);
  assert.deepEqual(r.assigned.map(a => a.grade), ['sanban', 'halfmoon']);
  assert.equal(potPriceOf({ leaves: 3, variegatedLeaves: 2, leafGrades: list }).won, 1_960_000);
  return `빛 미정인데도 잎2 산반 · 잎3 하프문 → 그루 ${won(1_960_000)}`;
});

t('E-2 ★ 프롤로그가 아닌 그루는 **빛을 못 재면 안 정한다**', () => {
  const S = mkState();
  const r = assignPotLeafGrades(S, { leafState: leafRows(3), band: null, prologue: false });
  assert.equal(r.assigned.length, 0, '빛도 못 쟀는데 등급을 정했다');
  assert.equal(r.pending, 2, `미정이 ${r.pending}장이다 (2장이라야 한다)`);
  assert.equal(potLeafGradeListOf(S.pots[0], 3, 2), null, '빈 장부는 null 이라야 한다');
  return '미정 2장 — 다음 날 다시 묻는다';
});

t('E-3 ★ 한 번 정하면 안 바뀐다 (밝은 데로 옮겨도 옛 잎의 등급은 그대로)', () => {
  const S = mkState();
  assignPotLeafGrades(S, { leafState: leafRows(3), band: 'poor', prologue: false });
  const before = { ...potLeafGradesOf(S.pots[0]) };
  assignPotLeafGrades(S, { leafState: leafRows(3), band: 'best', prologue: false });
  assert.deepEqual({ ...potLeafGradesOf(S.pots[0]) }, before, '자리를 옮겼더니 옛 잎 등급이 바뀌었다');
  return `장부 ${JSON.stringify(before)}`;
});

t('E-4 ★ 같은 세이브면 같은 답이 나온다 (결정적 난수)', () => {
  const a = mkState(), b = mkState();
  assignPotLeafGrades(a, { leafState: leafRows(6), band: 'slow', prologue: false });
  assignPotLeafGrades(b, { leafState: leafRows(6), band: 'slow', prologue: false });
  assert.deepEqual({ ...potLeafGradesOf(a.pots[0]) }, { ...potLeafGradesOf(b.pots[0]) });
  const c = mkState({ sim: { seed: 999 } });
  assignPotLeafGrades(c, { leafState: leafRows(6), band: 'slow', prologue: false });
  return `씨앗 4242 → ${Object.values(potLeafGradesOf(a.pots[0])).join('/')}\n      ` +
         `씨앗 999  → ${Object.values(potLeafGradesOf(c.pots[0])).join('/')}`;
});

t('E-5 ★★ 배선이 오기 전의 다리 — 장부가 비어도 프롤로그 그루는 §4 대로 선다', () => {
  const S = mkState();
  /* 반지하 탈출판: 잎 11장 중 무늬 3장 */
  const bridge = prologueLeafGradeListOf(S, S.pots[0], 11, 3);
  assert.ok(bridge, '다리가 안 걸렸다');
  assert.deepEqual(bridge.slice(8), ['sanban', 'halfmoon', null],
    '제일 오래된 무늬 잎 둘이 잎2·잎3(산반·하프문)이라야 한다');
  const withBridge = potPriceOf({ leaves: 11, variegatedLeaves: 3, leafGrades: bridge }).won;
  const without = potPriceOf({ leaves: 11, variegatedLeaves: 3 }).won;
  assert.ok(withBridge >= MOVE_OUT_WON,
    `다리를 세워도 ${won(withBridge)} 라 이사비 ${won(MOVE_OUT_WON)} 에 못 닿는다`);
  assert.ok(without < MOVE_OUT_WON, `다리 없이도 ${won(without)} 로 이사가 된다 — 다리가 필요 없다`);
  /* 장부가 한 칸이라도 있으면 다리는 안 탄다 */
  S.pots[0].leafGrades = { 100: 'fullmoon' };
  assert.equal(prologueLeafGradeListOf(S, S.pots[0], 11, 3), null, '장부가 있는데 다리가 걸렸다');
  /* 프롤로그 그루가 아니면 안 탄다 */
  const S2 = mkState({ tutorial: { enabled: false } });
  assert.equal(prologueLeafGradeListOf(S2, S2.pots[0], 11, 3), null, '튜토가 꺼졌는데 다리가 걸렸다');
  return `잎11·무늬3 — 다리 없이 ${won(without)} · 다리 세워 ${won(withBridge)} (이사비 ${won(MOVE_OUT_WON)})`;
});

/* ══════════════════════════════════════════════════════════════════════════
   F. 잎별 장부 — 삽수(c.leafGrade)
   ══════════════════════════════════════════════════════════════════════════ */
t('F-1 ★ 하프문 잎을 자르면 하프문이 딸려간다 (개수만 넘기면 산반으로 떨어진다)', () => {
  const c = { id: 'cut_01', leafVarie: [false, true, true], leafGrade: [null, 'sanban', 'halfmoon'] };
  syncCuttingLeaves(c);
  const nodes = cuttableNodesOfCutting(c);
  const top = nodes.find(n => n.nodeId === 'cut_01#2');
  assert.deepEqual(top.leafGrades, ['halfmoon'], '맨 위 마디가 하프문을 안 들고 간다');
  const withGrade = cuttingPriceOf({ leaves: 1, leafGrades: top.leafGrades }).won;
  const without = cuttingPriceOf({ leaves: 1, variegatedLeaves: 1 }).won;
  assert.equal(withGrade, 750_000);
  assert.equal(without, 350_000);
  return `등급을 넘기면 ${won(withGrade)} · 개수만 넘기면 ${won(without)} (2.14배 차이)`;
});

t('F-2 ★ 자른 뒤 모주에 남은 잎의 등급이 안 밀린다', () => {
  const mom = { id: 'cut_01', leafVarie: [true, true, true],
                leafGrade: ['sanban', 'halfmoon', 'fullmoon'] };
  syncCuttingLeaves(mom);
  /* takeCutting 이 하는 일과 같은 자르기 — 마디 #2 위가 떨어져 나간다 */
  mom.leafVarie = mom.leafVarie.slice(0, 2);
  mom.leafGrade = mom.leafGrade.slice(0, 2);
  syncCuttingLeaves(mom);
  assert.deepEqual(mom.leafGrade, ['sanban', 'halfmoon']);
  return `남은 잎 ${mom.leafGrade.join('/')}`;
});

t('F-3 ★ 등급을 모르는 무늬 잎은 **null 로 남는다** (산반으로 굳히지 않는다)', () => {
  const c = { id: 'cut_09', leafVarie: [true, true], leafGrade: [null, 'sector_없는것'] };
  syncCuttingLeaves(c);
  assert.deepEqual(c.leafGrade, [null, null], '모르는 갈래 이름이 상태에 살아남았다');
  assert.deepEqual(cuttingStatsNow(c).leafGrades, [null, null]);
  /* 값을 매길 때만 산반으로 편다 */
  assert.equal(cuttingPriceOf({ leaves: 2, variegatedLeaves: 2, leafGrades: c.leafGrade }).won,
               350_000 * 2);
  return '상태는 미정 · 값은 산반으로 읽는다';
});

/* ══════════════════════════════════════════════════════════════════════════
   G. ★★ 3D 스킨과 값이 같은 것을 보나 — 에셋 갈래를 하나도 안 흘렸나
   ══════════════════════════════════════════════════════════════════════════ */
const GROW = T('plant_grow.html');
const MAT = [...GROW.matchAll(/leaf_mat(\d+)\s*:\s*'skins\/mon_([a-z0-9_]+?)(_v[12])?\.glb'/g)]
  .map(m => ({ n: +m[1], id: m[2], variant: m[3] || null }));

t('G-1 ★ 등급표의 matNum 이 plant_grow.html 의 leaf_mat 키와 실제로 맞는다', () => {
  assert.ok(MAT.length >= 50, `plant_grow.html 에서 leaf_mat 를 ${MAT.length}개밖에 못 읽었다`);
  const byNum = new Map(MAT.map(m => [m.n, m]));
  for (const g of R.grades) for (const a of g.assets) {
    const hit = byNum.get(a.matNum);
    assert.ok(hit, `${g.ko}/${a.ko}: leaf_mat${a.matNum} 이 plant_grow.html 에 없다`);
    assert.equal(hit.id, a.id,
      `${g.ko}/${a.ko}: leaf_mat${a.matNum} 은 mon_${hit.id} 인데 표는 ${a.id} 라 적었다`);
    assert.equal(hit.variant, null, `leaf_mat${a.matNum} 이 대표가 아니라 ${hit.variant} 본이다`);
  }
  return `등급표 ${R.grades.reduce((n, g) => n + g.assets.length, 0)}갈래 ↔ leaf_mat ${MAT.length}키`;
});

t('G-2 ★★ 성숙 무늬 갈래를 **하나도 안 흘렸다** (어느 등급이거나 미배정 목록에 있다)', () => {
  const reps = MAT.filter(m => !m.variant).map(m => m.id);
  const placed = new Set(R.grades.flatMap(g => g.assets.map(a => a.id)));
  const parked = new Set(R.unassignedAssets.map(a => a.id));
  const lost = reps.filter(id => !placed.has(id) && !parked.has(id));
  assert.equal(lost.length, 0,
    `어느 등급에도 없고 미배정 목록에도 없는 갈래: ${lost.join(', ')} — ` +
    `조용히 빠지면 그 무늬 잎이 값에서 산반으로 떨어진다`);
  return `성숙 무늬 ${reps.length}갈래 = 배정 ${placed.size} + 미배정 ${parked.size}\n      ` +
         `⚠ 미배정: ${R.unassignedAssets.map(a => `${a.ko}(leaf_mat${a.matNum})`).join(', ') || '없음'} ` +
         `— 확정문 §1 은 「18갈래」라 적었는데 실제로는 ${reps.length}갈래다`;
});

t('G-3 ★ 등급 ↔ 스킨 키를 양쪽으로 물어볼 수 있다 (화면이 값과 같은 것을 보게)', () => {
  assert.equal(gradeOfMatNum(34).id, 'halfmoon', 'leaf_mat34(하프문-그린흰)');
  assert.equal(gradeOfMatNum(35).id, 'halfmoon', '-쨍 본도 같은 등급이라야 한다');
  assert.equal(gradeOfMatNum(36).id, 'halfmoon', '-차분 본도 같은 등급이라야 한다');
  assert.equal(gradeOfMatNum(1).id, 'fullmoon', 'leaf_mat1(핑크-로즈핑크)');
  assert.equal(gradeOfSkinAsset('speckle_greencream').id, 'sanban');
  const keys = skinKeysOfGrade('fullmoon');
  /* ⚠ 갈래 수를 **박지 마라** — 2026-08-16 에 차콜이 풀문에 들어가 5 → 6 이 됐고
     이 줄만 낡아 「고장」으로 읽혔다. 표에서 읽으면 갈래가 늘어도 안 낡는다(§2.8). */
  const fullN = VARIE_GRADES.find(g => g.id === 'fullmoon').assets.length;
  assert.equal(keys.length, fullN * 3, `풀문 스킨 키가 ${keys.length}개다 (${fullN}갈래 × 3판)`);
  assert.ok(keys.includes('leaf_mat55'), 'fullalbo 대표가 빠졌다');
  return `풀문 스킨 키 ${keys.length}개 · 하프문 ${skinKeysOfGrade('halfmoon').length}개 · 산반 ${skinKeysOfGrade('sanban').length}개`;
});

/* ══════════════════════════════════════════════════════════════════════════
   G-mid. ★★ **중간잎도 같은 등급에서 고른다** (2026-08-16)
   ------------------------------------------------------------------------
   박사님: *"중간잎 말고 성숙잎 가는 것도 그럼 확정으로 해야겠네. 둘 다."*
   여기가 지키는 것: 42갈래를 **하나도 안 흘렸다** · 한 잎의 두 그림이 **같은 등급**이다 ·
   **같은 세이브면 같은 그림**이다.
   ══════════════════════════════════════════════════════════════════════════ */
const MID = [...GROW.matchAll(/(?<![A-Za-z0-9_])leaf_mid_albo(\d+)\s*:\s*'skins\/([A-Za-z0-9_]+?)(_v[12])?\.glb'/g)]
  .map(m => ({ n: +m[1], id: m[2], variant: m[3] || null }));

t('G-mid-1 ★ 등급표의 midNums 가 plant_grow.html 의 leaf_mid_albo 키와 실제로 맞는다', () => {
  assert.ok(MID.length >= 40, `plant_grow.html 에서 leaf_mid_albo 를 ${MID.length}개밖에 못 읽었다`);
  const byNum = new Map(MID.map(m => [m.n, m]));
  for (const g of R.grades) for (const a of (g.midAssets || [])) for (const n of a.midNums) {
    const hit = byNum.get(n);
    assert.ok(hit, `${g.ko}/${a.ko}: leaf_mid_albo${n} 이 plant_grow.html 에 없다`);
    assert.equal(hit.id, a.id,
      `${g.ko}/${a.ko}: leaf_mid_albo${n} 은 ${hit.id} 인데 표는 ${a.id} 라 적었다`);
  }
  const n = R.grades.reduce((s, g) => s + (g.midAssets || []).length, 0);
  return `등급표 ${n}갈래 ↔ leaf_mid_albo ${MID.length}키`;
});

t('G-mid-2 ★★ 중간 무늬 42키를 **하나도 안 흘렸다** (한 번씩만 들어 있다)', () => {
  const placed = [];
  for (const g of R.grades) for (const a of (g.midAssets || [])) placed.push(...a.midNums);
  const seen = new Set(placed);
  const lost = MID.map(m => m.n).filter(n => !seen.has(n));
  assert.equal(lost.length, 0,
    `어느 등급에도 없는 중간잎: ${lost.map(n => 'leaf_mid_albo' + n).join(', ')} — ` +
    `조용히 빠지면 그 잎은 중간에 무늬가 없거나 엉뚱한 등급 그림으로 뜬다`);
  assert.equal(placed.length, seen.size,
    `두 등급에 걸친 번호가 있다 — ${placed.length}개 적었는데 서로 다른 것은 ${seen.size}개다`);
  assert.equal(seen.size, MID.length, `표는 ${seen.size}키인데 plant_grow 는 ${MID.length}키다`);
  const tally = R.grades.map(g => `${g.ko} ${(g.midAssets || []).length}갈래`).join(' · ');
  return `중간 무늬 ${MID.length}키 = 등급에 전부 배정\n      ${tally}\n      ` +
         `⚠ 고르지 않다 — 잰 대로다(tools/probe_midalbo.mjs · docs/handoff/midalbo-to-plan.md)`;
});

t('G-mid-3 ★ 갈래마다 판이 셋이다 (그래야 「키를 고르게 = 갈래를 고르게」가 참이다)', () => {
  for (const g of R.grades) for (const a of (g.midAssets || []))
    assert.equal(a.midNums.length, 3,
      `${g.ko}/${a.ko} 이 ${a.midNums.length}판이다 — shop.js §⑥-4 의 ⚠ 가 이 자리를 가리킨다`);
  for (const g of R.grades)
    assert.equal(midSkinKeysOfGrade(g.id).length, (g.midAssets || []).length * 3, `${g.ko}`);
  return R.grades.filter(g => g.varie)
    .map(g => `${g.ko} ${midSkinKeysOfGrade(g.id).length}키`).join(' · ');
});

t('G-mid-4 ★★ 한 잎의 두 그림이 **같은 등급**이다 (중간에 점박이던 것이 반반이 안 된다)', () => {
  const seed = 4242;
  let n = 0;
  for (const g of R.grades.filter(x => x.varie)) for (let lb = 1; lb <= 60; lb++) {
    const s = leafSkinsFor(g.id, seed, 'potA', lb);
    assert.ok(s, `${g.ko} 의 그림이 안 나왔다`);
    assert.equal(gradeOfMidNum(+s.midSkin.slice('leaf_mid_albo'.length)).id, g.id,
      `${g.ko} 잎인데 중간잎 ${s.midSkin} 은 다른 등급이다`);
    assert.equal(gradeOfMatNum(+s.matSkin.slice('leaf_mat'.length)).id, g.id,
      `${g.ko} 잎인데 성숙잎 ${s.matSkin} 은 다른 등급이다`);
    n++;
  }
  assert.equal(leafSkinsFor(plainGradeId(), seed, 'potA', 1), null, '무지 잎에는 무늬 그림이 없다');
  return `${n}장 다 같은 등급 · 무지 잎은 null`;
});

t('G-mid-5 ★★ 같은 세이브면 **같은 그림**이다 (등급 굴림과 같은 marketHash)', () => {
  const a = leafSkinsFor('sanban', 777, 'pot1', 30);
  const b = leafSkinsFor('sanban', 777, 'pot1', 30);
  assert.deepEqual(a, b, '같은 열쇠인데 답이 달라졌다');
  const c = leafSkinsFor('sanban', 778, 'pot1', 30);
  const d = leafSkinsFor('sanban', 777, 'pot2', 30);
  const e = leafSkinsFor('sanban', 777, 'pot1', 31);
  assert.ok([c, d, e].some(x => x.midSkin !== a.midSkin || x.matSkin !== a.matSkin),
    '시드·화분·잎이 달라도 늘 같은 그림이면 굴림이 안 걸린 것이다');
  /* ★ 골고루 도나 — 한 갈래에 쏠리면 화면이 늘 같은 잎만 그린다 */
  const seen = new Set();
  for (let i = 0; i < 300; i++) seen.add(leafSkinsFor('sanban', 5, 'p', i).midSkin);
  assert.ok(seen.size >= 20, `산반 중간잎이 ${seen.size}가지밖에 안 나온다 (33키 중)`);
  return `같은 열쇠 = 같은 답 · 300장에 중간잎 ${seen.size}가지`;
});

t('G-mid-6 ★★ 등급을 정하는 그 자리에서 **그림 두 벌이 같이 나온다** (assignPotLeafGrades)', () => {
  const S = { sim: { seed: 31337 }, tutorial: { enabled: false }, pots: [{ id: 'p1' }] };
  const leafState = [{ leafBirth: 10, varie: false }, { leafBirth: 20, varie: true },
                     { leafBirth: 30, varie: true }];
  const r = assignPotLeafGrades(S, { leafState, band: 'best' });
  assert.equal(r.assigned.length, 2, '무늬 잎 둘에 등급이 붙어야 한다');
  for (const a of r.assigned) {
    assert.ok(a.midSkin && a.matSkin, `${a.leafNo}번째 잎에 그림이 안 붙었다`);
    assert.equal(gradeOfMidNum(+a.midSkin.slice('leaf_mid_albo'.length)).id, a.grade);
    assert.equal(gradeOfMatNum(+a.matSkin.slice('leaf_mat'.length)).id, a.grade);
  }
  /* 되뽑아도 같은 답이라야 한다 — 장부에 안 적고 등급에서 되뽑는 구조라(§⑥-4) */
  const again = potLeafSkinsOf(S, S.pots[0]);
  for (const a of r.assigned) {
    assert.equal(again[String(a.leafBirth)].midSkin, a.midSkin, '되뽑으니 중간잎이 달라졌다');
    assert.equal(again[String(a.leafBirth)].matSkin, a.matSkin, '되뽑으니 성숙잎이 달라졌다');
    assert.equal(again[String(a.leafBirth)].fromLegacy, false);
  }
  return r.assigned.map(a => `잎${a.leafNo} ${a.grade} → ${a.midSkin}/${a.matSkin}`).join(' · ');
});

t('G-mid-7 ★★ **옛 세이브**에 그 칸이 없으면 등급에서 되뽑고 **표시를 남긴다**', () => {
  const S = { sim: { seed: 9 }, pots: [{ id: 'old1' }] };   // 장부가 아예 없다
  const m2 = potLeafSkinsOf(S, S.pots[0], { varieLeafBirths: [12, 44] });
  assert.equal(Object.keys(m2).length, 2, '옛 판의 무늬 잎 둘이 채워져야 한다');
  for (const k of Object.keys(m2)) {
    assert.equal(m2[k].grade, legacyVarieGradeId(), '옛 판은 산반으로 읽는다(확정문 §5)');
    assert.equal(m2[k].fromLegacy, true, '★ 조용히 하면 안 된다 — 표시가 있어야 기록에 남는다');
    assert.ok(m2[k].midSkin && m2[k].matSkin);
  }
  return `옛 잎 2장 → ${legacyVarieGradeId()} · fromLegacy 표시 있음`;
});

/* ══════════════════════════════════════════════════════════════════════════
   H. ★ 옛 세이브 (확정문 §5)
   ══════════════════════════════════════════════════════════════════════════ */
t('H-1 ★★ 등급 없는 옛 판의 무늬 잎이 산반으로 읽힌다', () => {
  const list = leafGradeListOf({ leaves: 3, variegatedLeaves: 2 });
  assert.deepEqual(list, ['plain', 'sanban', 'sanban']);
  assert.equal(legacyVarieGradeId(), 'sanban');
  assert.equal(plainGradeId(), 'plain');
  return `잎3·무늬2 → ${list.join('/')} · 그루 ${won(potPriceOf({ leaves: 3, variegatedLeaves: 2 }).won)}`;
});

t('H-2 ★★ 옛 판을 열면 **기록에 남는다** (조용히 안 한다 — 확정문 §5 ★)', () => {
  const S = { pots: [{ id: 'pot_01', leafGrades: {} }],
              cuttings: [{ id: 'cut_01', leafVarie: [true, true], leafGrade: [null, null] }] };
  const raw = { pots: [{ id: 'pot_01' }], cuttings: [{ id: 'cut_01' }] };   // 옛 세이브 — 칸이 없다
  const lines = migrateVarieGrades(S, raw);
  assert.equal(lines.length, 2, `로그가 ${lines.length}줄이다 (삽수 한 줄 · 그루 한 줄)`);
  assert.ok(lines.some(l => l.includes('산반')), '「산반으로 읽는다」가 로그에 없다');
  /* ⚠ 값을 바꾸지는 않는다 — 「모른다」가 「산반으로 정해졌다」로 굳으면 안 된다 */
  assert.deepEqual(S.cuttings[0].leafGrade, [null, null], '이관이 값을 굳혀 버렸다');
  return lines.map(l => '· ' + l).join('\n      ');
});

t('H-3 ★ 새 판은 **조용하다** (칸이 있으면 옛 판이 아니다)', () => {
  const S = { pots: [{ id: 'pot_01', leafGrades: {} }], cuttings: [] };
  const raw = { pots: [{ id: 'pot_01', leafGrades: {} }], cuttings: [] };
  assert.deepEqual(migrateVarieGrades(S, raw), [], '새 판에서 이관 로그가 나왔다');
  return '로그 0줄';
});

/* ══════════════════════════════════════════════════════════════════════════
   I. 역산 · 표
   ══════════════════════════════════════════════════════════════════════════ */
t('I-1 ★ 역산이 등급마다 따로 나온다 (「무늬 잎 몇 장」은 이제 답이 하나가 아니다)', () => {
  const r = varieLeavesNeededFor(MOVE_OUT_WON, { leaves: 5, form: 'pot' });
  assert.equal(r.grade, 'sanban', '기본은 제일 흔한 등급(산반)이라야 한다');
  for (const g of R.grades.filter(x => x.varie))
    assert.ok(g.id in r.byGrade, `${g.ko} 가 byGrade 에 없다`);
  const s = r.byGrade;
  return `잎 5장 그루로 ${won(MOVE_OUT_WON)} 을 만들려면 — ` +
         R.grades.filter(g => g.varie).map(g =>
           `${g.ko} ${s[g.id].needVarieLeaves == null ? '불가' : s[g.id].needVarieLeaves + '장'}`).join(' · ');
});

t('I-2 ★ 파일을 갈아 끼우면 값이 실제로 따라온다 (박사님 손잡이가 산다)', () => {
  const twisted = JSON.parse(JSON.stringify(FILE));
  twisted.grades.find(g => g.id === 'sanban').leafWon = 1;
  installVarieGrades(twisted);
  const cheap = cuttingPriceOf({ leaves: 1, leafGrades: ['sanban'] }).won;
  assert.equal(cheap, 1, `파일을 고쳤는데 값이 ${won(cheap)} 다`);
  assert.equal(VARIE_GRADES.find(g => g.id === 'sanban').leafWon, 1, 'VARIE_GRADES 가 안 따라왔다');
  installVarieGrades(FILE);                       // 되돌린다
  assert.equal(cuttingPriceOf({ leaves: 1, leafGrades: ['sanban'] }).won, 350_000);
  return '산반 1원으로 바꾸니 값이 1원 · 되돌리니 350,000원';
});

t('I-3 모르는 등급 이름은 **던진다** (조용히 0원이 되지 않는다)', () => {
  assert.throws(() => cuttingPriceOf({ leaves: 1, leafGrades: ['없는등급'] }),
                /모르는 무늬 등급/);
  assert.equal(varieGradeOf('없는등급'), null);
  return 'priceOf 가 그 자리에서 던진다';
});

/* ══════════════════════════════════════════════════════════════════════════
   표 — 사람이 읽을 것
   ══════════════════════════════════════════════════════════════════════════ */
console.log('\n── 등급표 (정본: data/balance/varie_grades.json) ─────────────────────');
for (const g of R.grades)
  info(`${g.ko.padEnd(4)} 잎1 ${won(g.leafWon).padStart(12)} · 에셋 ${String(g.assets.length).padStart(2)}갈래` +
       (g.assets.length ? ` (${g.assets.map(a => a.ko).join(', ')})` : ''));

console.log('\n── 잎 구성별 값 (삽수 ×1.0 / 그루 ×1.4) ────────────────────────────');
const cases = [
  ['잎1 산반', ['sanban']],
  ['잎1 하프문', ['halfmoon']],
  ['잎1 풀문', ['fullmoon']],
  ['잎3 무지', ['plain', 'plain', 'plain']],
  ['★프롤로그(무지·산반·하프문)', PROLOGUE],
  ['잎3 전부 산반', ['sanban', 'sanban', 'sanban']],
  ['잎3 산반·하프문·풀문', ['sanban', 'halfmoon', 'fullmoon']],
  ['잎5 무지2 하프문3', ['plain', 'plain', 'halfmoon', 'halfmoon', 'halfmoon']]
];
for (const [ko, list] of cases) {
  const c = cuttingPriceOf({ leaves: list.length, leafGrades: list });
  const p = potPriceOf({ leaves: list.length, leafGrades: list });
  info(`${ko.padEnd(30)} 삽수 ${won(c.won).padStart(12)} · 그루 ${won(p.won).padStart(12)}` +
       `  (합 ${won(c.leafSumWon)} · 시너지 ×${c.synergy})`);
}

console.log('\n── 자리가 정하는 등급 (확정문 §3) ──────────────────────────────────');
for (const step of ['dark', 'mid', 'bright']) {
  const row = R.lightGrade[step];
  info(`${step.padEnd(6)} ` +
       Object.entries(row).map(([g, p]) => `${R.byId.get(g).ko} ${(p * 100).toFixed(0)}%`).join(' · ') +
       ` → 무늬 1장 기대값 ${won(Math.round(varieGradeExpectedWon(step)))}`);
}

console.log(`\nvariegrade: ${fails ? `FAIL (${fails}건 / ${checks}검사)` : `PASS (${checks}검사)`}`);
process.exit(fails ? 1 : 0);
