/* 점프와 걸어가기가 다른 잎 수를 내나 (2026-08-16) */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const page = await launch({ width: 390, height: 844, dpr: 2, mobile: false });
await page.goto(`${BASE}/game.html`);
await page.eval(`localStorage.clear()`, false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 180000, 300);
await page.waitFor('window.__byeotBooted === true', 180000, 300);
await sleep(5000);
const out = await page.eval(`(()=>{ const G = window.__io && window.__io.growth;
  if(!G) return 'no-growth';
  const r = {};
  /* ① 점프 — setGrowth(70) 한 번 */
  try { G.resetDailyLight && G.resetDailyLight();
        G.setGrowth(70); r.jump = G.leafStats().leaves; } catch(e) { r.jump = 'ERR '+e.message; }
  /* ② 걸어가기 — 45에서 시작해 70까지 하루씩 (빛 없이) */
  try { G.resetDailyLight && G.resetDailyLight();
        G.setGrowth(45);
        for (let d = 46; d <= 70; d++) G.advanceTo(d);
        r.walkNoLight = G.leafStats().leaves; } catch(e) { r.walkNoLight = 'ERR '+e.message; }
  /* ③ 걸어가기 + 창턱 밝기(DLI 3.77)를 매일 넘긴다 — 재현이 하는 그대로 */
  try { G.resetDailyLight && G.resetDailyLight();
        G.setGrowth(45);
        for (let d = 46; d <= 70; d++) { G.setDailyLight(3.77); G.advanceTo(d); }
        r.walkLit = G.leafStats().leaves; r.gd = G.growthDays(); } catch(e) { r.walkLit = 'ERR '+e.message; }
  /* ④ ★ 프롤로그 무늬 보장을 켜고 걸어간다 — 재현이 하는 그대로 */
  try { G.resetDailyLight && G.resetDailyLight();
        if (G.setPrologueVarieLeaf) G.setPrologueVarieLeaf([2,3]);
        G.setGrowth(45);
        for (let d = 46; d <= 70; d++) { G.setDailyLight(3.77); G.advanceTo(d); }
        const st = G.leafStats();
        r.walkPrologue = st.leaves; r.varie = st.variegatedLeaves; r.gd2 = G.growthDays();
      } catch(e) { r.walkPrologue = 'ERR '+e.message; }
  return JSON.stringify(r); })()`);
console.log(out);
await page.close();

/* ══ 잰 것 (2026-08-16) ═══════════════════════════════════════════════════
   브라우저(진짜 게임)에서 유효 45 → 70 까지:
     점프 setGrowth(70)                    잎 2장
     걸어가기 · 빛 없음                     잎 1장 (빛이 없으면 유효가 안 쌓인다)
     걸어가기 · DLI 3.77 매일               잎 2장
     걸어가기 · 프롤로그 무늬 보장 켜고      잎 2장 (무늬 1장)
   ⇒ **어느 길로 가도 유효 70일이면 잎 2장이다.**

   ⚠⚠ 그런데 `test_banjiha_routes`(헤드리스)는 같은 자리에서 **잎 3장 · 무늬 2장**이라 찍는다
     (`growthDays() 70 · calendarDay() 70`). 같은 엔진이라는데 답이 다르다.
   ★ 아직 원인을 못 밝혔다. 다만 방향은 분명하다 — **재현이 게임보다 잎을 한 장 더 준다.**
     그러면 재현의 이사 성공률·탈출 일수는 **실제보다 후하다.**
   ⇒ 다음 창이 이어받을 것: 헤드리스 로더가 브라우저와 무엇이 다른지(§2.9-④ 「자가 딴 세상 것」).
════════════════════════════════════════════════════════════════════════ */
