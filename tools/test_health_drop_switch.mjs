/* ============================================================
   test_health_drop_switch.mjs — 낙엽 켜기/끄기 창구(setHealthDrop)를 지킨다 ([growth] · 2026-10-09 · core D59 청)
   ------------------------------------------------------------
   ★ D59 식물 가게 «초보 보호 끝: 낙엽 켜짐» — 게임이 진로 [가게를 연다] 순간에 plant_grow.setHealthDrop(true) 를 부른다.
   ★ 무엇을 지키나(크롬 없음 · vm · 로더는 probe_leaf_health_year 것을 빌린다)
     ① 기본은 값 파일 그대로(꺼짐) — 아무도 안 부르면 예전과 같다
     ② 값 파일이 «늦게» 와도 밖에서 정한 값을 안 덮는다(부팅 직후 core 가 세이브대로 켜는 순서)
     ③ 켜면 어두운 데서 다 바랜 잎이 실제로 떨어진다 · 끄면(같은 씨앗·같은 빛) 하나도 안 떨어진다 · 마지막 한 장은 안 떨어진다
     ④ 그루가 여럿이어도 걸린다(그루를 갈아 꽂아도 그대로)
     ⑤ setHealthDrop(null) 이면 파일 값으로 돌아간다
     node tools/test_health_drop_switch.mjs
============================================================ */
import vm from 'node:vm';
import { loadGrowth } from './probe_leaf_health_year.mjs';
let fail = 0;
const ok = (c, m) => { console.log((c ? '✅ ' : '⛔ ') + m); if (!c) fail++; };
const seedTo = (G, v) => { try { G.plantSeed(v); } catch (e) { /* vm — 그리기만 던진다 */ } };

/* ② 먼저 — 파일이 오기 «전에» 켠다 */
const G2 = loadGrowth();
const early = G2.setHealthDrop(true);
for (let i = 0; i < 400 && !G2.thLoaded(); i++) await new Promise(r => setImmediate(r));
ok(G2.thLoaded() && early === true && G2.healthDropEnabled() === true, `② 값 파일보다 먼저 켜도(그때 ${early}) 파일이 온 뒤 그대로 켜짐(${G2.healthDropEnabled()})`);

/* ① ⑤ */
const G = loadGrowth();
for (let i = 0; i < 400 && !G.thLoaded(); i++) await new Promise(r => setImmediate(r));
const X = src => vm.runInContext(src, G);
ok(G.healthDropEnabled() === false && X('GT.health.drop_enabled') === false, '① 기본은 값 파일 그대로 — 꺼짐');

/* ③ 같은 씨앗 · 같은 어둠으로 켬/끔 */
const walk = (on) => {
  G.setHealthDrop(on);
  seedTo(G, 4242); G.setPrologueVarieLeaves([]); G.resetDailyLight(); G.setGrowth(300); G.leafStats();
  for (let d = 0; d < 120; d++) { G.setDailyLight(0.3); G.advanceTo(G.calendarDay() + 1); G.leafStats(); }
  const hs = G.leafHealthAll();
  return { dropped: hs.filter(h => h.dropped).length, live: G.leafStats().leaves, faded: hs.filter(h => h.fade >= 1).length };
};
const on = walk(true), off = walk(false);
ok(on.dropped > 0 && off.dropped === 0 && on.live >= 1,
  `③ 어둠(DLI 0.3) 120일 — 켬: 떨어진 잎 ${on.dropped} · 남은 잎 ${on.live}(마지막 한 장은 남음) · 끔: 떨어진 잎 ${off.dropped}(다 바랜 잎 ${off.faded})`);

/* ④ 그루가 여럿 */
G.setHealthDrop(true);
G.addPlant({ id: 'p2', seed: 77, day: 120 });
G.selectPlant('p2');
const a = G.healthDropEnabled();
G.selectPlant(null);
ok(a === true && G.healthDropEnabled() === true, `④ 둘째 그루로 갈아 꽂아도 켜짐 그대로(${a})`);

/* ⑤ */
const back = G.setHealthDrop(null);
ok(back === false && G.healthDropEnabled() === false, `⑤ null 이면 파일 값(꺼짐)으로 — ${back}`);

console.log('\nhealth_drop_switch: ' + (fail ? 'FAIL' : 'PASS'));
process.exitCode = fail ? 1 : 0;
