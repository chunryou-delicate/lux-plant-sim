/* tools/test_f1b_prologue.mjs — F1-b 프롤로그는 튜토 모그루에만(core 11-04 · 총괄 흠 가름) · node 만
   프롤로그(잎 1 무지 · 잎 2 산반 · 잎 3 하프문 · why 'prologue' · «무늬를 처음 본 날» 장면)는 «튜토 선물 모그루(생장 그루 id __main__)»의 것이다.
   예전엔 «첫 화분(pots[0])»으로 갈라, 모그루를 판 뒤 씨앗 그루가 첫 화분이 되면 그 그루에 옮겨 붙었다.
   ㉮ 씨앗 그루가 첫 화분 — 잎 2 · 3 등급은 빛(why light)으로 정해진다
   ㉯ 씨앗 그루가 첫 화분 — 빛으로 이미 정해진 잎 2 가 드러날 때 why 는 light 다(prologue 로 되짚지 않음 · game 장면 'seen' 이 안 걸림)
   ㉰ 씨앗 그루가 첫 화분 — 값 다리(§prologueLeafGradeListOf)를 안 탄다
   ㉱ 막이(고치기 전에도 초록): 모그루(첫 화분 · 옛 세이브 growthId 없음)는 그대로 프롤로그 · 모그루가 있을 때 둘째 화분 씨앗 그루는 빛 · 튜토 꺼지면 모그루도 빛
   ㉲ shop §PROLOGUE_GROWTH_ID 가 state §MAIN_GROWTH_ID 와 같은 글이다(shop 은 state 를 못 들인다 — 고리)
   빨강 먼저: F1 판(고치기 전 — ㉮ ㉯ ㉰ ㉲ 빨강) */
import assert from 'node:assert/strict';
import * as SH from '../src/game/shop.js';
import { MAIN_GROWTH_ID } from '../src/game/state.js';
const results = [];
const check = (name, fn) => { try { fn(); results.push(['OK  ', name]); } catch (e) { results.push(['FAIL', name, (e && e.message || String(e)).split('\n')[0].slice(0, 260)]); } };
const mother = (o = {}) => ({ id: 'pot_01', growthId: MAIN_GROWTH_ID, ...o });
const seedPot = (o = {}) => ({ id: 'pot_02', growthId: 'g:pot_02', ...o });
const St = (pots, tut = true) => ({ day: 300, sim: { seed: 0 }, tutorial: { enabled: tut }, pots });
const rows = (mat = false) => [{ leafBirth: 10, varie: false, matured: true }, { leafBirth: 20, varie: true, matured: mat }, { leafBirth: 30, varie: true, matured: mat }];
const run = (S, pot, mat = false) => SH.assignPotLeafGrades(S, { pot, leafState: rows(mat), step: 'mid' });

check('㉮ 씨앗 그루가 첫 화분(모그루 팔림) — 잎 2 · 3 등급은 빛으로', () => {
  const p = seedPot(); const r = run(St([p]), p);
  assert.deepEqual(r.graded.map(g => [g.leafNo, g.why]), [[2, 'light'], [3, 'light']], JSON.stringify(r.graded));
});
check('㉯ 씨앗 그루가 첫 화분 — 빛으로 정해진 잎 2 가 드러날 때 why light', () => {
  const p = seedPot({ leafGrades: { 20: 'sanban', 30: 'sanban' } }); const r = run(St([p]), p, true);
  assert.deepEqual(r.assigned.map(a => [a.leafNo, a.why]), [[2, 'light'], [3, 'light']], JSON.stringify(r.assigned.map(a => [a.leafNo, a.grade, a.why])));
});
check('㉰ 씨앗 그루가 첫 화분 — 값 다리(§prologueLeafGradeListOf)를 안 탄다', () => {
  const p = seedPot(); assert.equal(SH.prologueLeafGradeListOf(St([p]), p, 3, 2), null);
});
check('㉱ 막이 — 모그루 · 옛 세이브 모그루는 프롤로그 · 둘째 화분 씨앗 그루는 빛 · 튜토 끄면 빛', () => {
  const m = mother(); const r = run(St([m, seedPot()]), m);
  assert.deepEqual(r.graded.map(g => [g.leafNo, g.grade, g.why]), [[2, 'sanban', 'prologue'], [3, 'halfmoon', 'prologue']], JSON.stringify(r.graded));
  const old = { id: 'pot_01' }; const r2 = run(St([old]), old);
  assert.deepEqual(r2.graded.map(g => g.why), ['prologue', 'prologue'], '옛 세이브(growthId 없음) ' + JSON.stringify(r2.graded));
  const s2 = seedPot(); const r3 = run(St([mother(), s2]), s2);
  assert.deepEqual(r3.graded.map(g => g.why), ['light', 'light'], '둘째 화분 ' + JSON.stringify(r3.graded));
  const m4 = mother(); const r4 = run(St([m4], false), m4);
  assert.deepEqual(r4.graded.map(g => g.why), ['light', 'light'], '튜토 꺼짐 ' + JSON.stringify(r4.graded));
  const m5 = mother(); assert.ok(Array.isArray(SH.prologueLeafGradeListOf(St([m5]), m5, 3, 2)), '모그루 값 다리');
});
check('㉲ shop PROLOGUE_GROWTH_ID === state MAIN_GROWTH_ID', () => {
  assert.equal(SH.PROLOGUE_GROWTH_ID, MAIN_GROWTH_ID);
});

let fail = 0;
for (const [st, name, msg] of results) { if (st === 'FAIL') fail++; console.log(`${st}  ${name}${msg ? '\n      → ' + msg : ''}`); }
console.log(fail ? `\ntest_f1b_prologue: 빨강 ${fail}` : '\ntest_f1b_prologue: 다 통과');
process.exit(fail ? 1 : 0);
