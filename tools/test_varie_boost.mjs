/* ============================================================
   test_varie_boost.mjs — D40 «성숙 전 그루의 무늬 ×2 · 상한 0.9» 를 지킨다 ([growth] 소유 · 2026-10-09)
   ------------------------------------------------------------
   ★ D40(총괄 결정 · 박사님 «성숙잎 이전 잎, 적당히 비싼 것은 확률을 올려») — growth_tuning.json varie_boost
     { pre_mature_mult: 2, cap: 0.9 } · 모주는 plant_grow §calcVarieProb, 삽수는 core(propagation)가 같은 칸을 읽는다.
     «성숙 전» = 그 그루에 갈라진 잎(MAT_STATE matured)이 한 장도 없는 동안.
   ★ 무엇을 지키나(크롬 없음 · vm · 로더는 probe_leaf_health_year 것을 빌린다)
     ① 파일 값이 실제로 실렸다(GT.varieBoost = 2 · 0.9)
     ② 갈라진 잎이 없으면 calcVarieProb = max(기본, min(cap, 기본 × 2))
     ③ 갈라진 잎이 한 장이라도 생기면 = 기본(배율이 꺼진다)
     ④ 같은 씨앗 · 같은 빛에서 배율을 켜면 무늬 잎이 «줄지 않고» 판 합계로는 «는다»(굴림은 rng() < p 라 p 가 커지면 무늬가 늘 뿐이다)
   ⚠ vm 판은 날마다 leafStats() 를 불러 위상을 키운다(안 부르면 무늬가 «그날 빛»으로 안 굴린다 · 색인 ⑭).
     node tools/test_varie_boost.mjs
============================================================ */
import vm from 'node:vm';
import { loadGrowth } from './probe_leaf_health_year.mjs';
const G = loadGrowth();
for (let i = 0; i < 400 && !G.thLoaded(); i++) await new Promise(r => setImmediate(r));
const X = (src) => vm.runInContext(src, G);     // let 으로 선언된 GT·MAT_STATE 는 같은 vm 맥락에서만 보인다
const seedTo = v => { try { G.plantSeed(v); } catch (e) { /* vm — 그리기만 던진다 */ } };
let fail = 0;
const ok = (c, m) => { console.log((c ? '✅ ' : '⛔ ') + m); if (!c) fail++; };

ok(G.thLoaded(), '정본(growth_tuning.json)이 실렸다');
const B = X('JSON.stringify(GT.varieBoost)');
const b = JSON.parse(B);
ok(b.pre_mature_mult === 2 && b.cap === 0.9, `① 파일 값이 실렸다 — GT.varieBoost = ${B}`);

/* ②③ — 빛 이력을 넣어 dli7 이 서게 한 뒤, 배율을 껐다 켰다 하며 같은 순간의 확률을 맞댄다 */
seedTo(7919); G.setPrologueVarieLeaves([]); G.resetDailyLight(); G.setGrowth(0);
for (let k = 0; k < 10; k++) { G.setDailyLight(8); G.advanceTo(G.calendarDay() + 1); }
X('MAT_STATE.clear()');
const pBoost = G.calcVarieProb();
X('GT.varieBoost = Object.assign({}, GT.varieBoost, { pre_mature_mult: 1 })');
const pBase = G.calcVarieProb();
X(`GT.varieBoost = Object.assign({}, GT.varieBoost, { pre_mature_mult: ${b.pre_mature_mult} })`);
const want = Math.max(pBase, Math.min(b.cap, pBase * b.pre_mature_mult));
ok(pBase > 0 && Math.abs(pBoost - want) < 1e-12, `② 갈라진 잎 없음 — 기본 ${pBase.toFixed(4)} → ${pBoost.toFixed(4)} (기대 ${want.toFixed(4)})`);
X('MAT_STATE.set(424242, { gauge: 0, matured: true, rolls: 1, locked: false })');
const pAfter = G.calcVarieProb();
ok(Math.abs(pAfter - pBase) < 1e-12, `③ 갈라진 잎 한 장 — ${pAfter.toFixed(4)} = 기본 ${pBase.toFixed(4)}`);
X('MAT_STATE.clear()');

/* ④ — 같은 씨앗을 배율 켬/끔 두 번 걸어 무늬 잎을 센다 */
const walk = (mult) => {
  X(`GT.varieBoost = Object.assign({}, GT.varieBoost, { pre_mature_mult: ${mult} })`);
  const out = [];
  for (let s = 1; s <= 30; s++) {
    seedTo(s * 7919); G.setPrologueVarieLeaves([]); G.resetDailyLight(); G.setGrowth(0);
    for (let k = 0; k < 250; k++) { G.setDailyLight(6.0); G.advanceTo(G.calendarDay() + 1); G.leafStats(); }
    out.push(G.varieStateAll().filter(v => v.varie).length);
  }
  return out;
};
const off = walk(1), on = walk(b.pre_mature_mult);
X(`GT.varieBoost = Object.assign({}, GT.varieBoost, { pre_mature_mult: ${b.pre_mature_mult} })`);
const sOff = off.reduce((a, v) => a + v, 0), sOn = on.reduce((a, v) => a + v, 0);
const fewer = on.filter((v, i) => v < off[i]).length;
ok(fewer === 0 && sOn > sOff, `④ 씨앗 그루 30판 · 빛 6.0 · 250일 — 무늬 잎 끔 ${sOff} → 켬 ${sOn} · 판마다 줄어든 판 ${fewer}`);

console.log('\nvarie_boost: ' + (fail ? 'FAIL' : 'PASS'));
process.exitCode = fail ? 1 : 0;
