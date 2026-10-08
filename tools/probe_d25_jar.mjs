/* tools/probe_d25_jar.mjs — **수경병은 «지금 자를 수 있을 때»만 보이나** (2026-10-08 · 총괄 D25)
   ------------------------------------------------------------------
   옛 열쇠(first_cut 이 열렸나 = 모주 잎 ≥ 2 · Day 37)는 박사님 자르기 문(무늬 다 자란 잎 ≥ 2)보다 80일 남짓 일렀다 —
   병을 사도 [병에]가 「아직 이릅니다」로 잠겼다. 이제 열쇠는 freeCutNodeCount()(✂ 말풍선과 같은 자) > 0 이거나 «한 번 자른 사람».
   재는 것:
     ① 갓 도착(잎 1장 · 자를 마디 0) — 상점에 수경병이 없다
     ② 퀘스트 스냅샷에 motherVarieMatured 가 실린다(자르기 문과 같은 수 · 0)
     ③ first_cut 을 끝낸 사람(한 번 자른 사람) — 자를 마디가 없어도 수경병이 보인다
   ⚠ «자를 마디 > 0 → 보인다»는 무늬 잎이 다 자라야(수십~백여 일) 서는 판이라 여기서 안 세운다 — 같은 함수를 ✂ 말풍선이 쓰고,
     그 날짜는 night_play guided(총괄)·growth 가 잰다.
   판: 폰 390×844. ⛔ 값 0. */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:9300';
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 400000);
wd.unref && wd.unref();
const page = await launch({ width: 390, height: 844, dpr: 1 });
await page.goto(`${BASE}/game.html`);
await page.eval('localStorage.clear()', false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 240000, 500);
await sleep(3500);
const J = async (e) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${e})); } catch(e) { return JSON.stringify({ 탈:e.message }); } })()`, true, 60000));
const clearDlg = async () => { for (let i = 0; i < 60; i++) { const t = await page.eval(`document.getElementById('stage').classList.contains('talking')`); if (t !== true) return; await page.eval(`(()=>{ const x=document.getElementById('dlgBox'); if (x) x.click(); })()`, false); await sleep(120); } };
let fail = 0;
const ok = (c, msg, got) => { console.log(`  ${c ? 'OK  ' : 'FAIL'} ${msg}${got !== undefined ? ' → ' + JSON.stringify(got) : ''}`); if (!c) fail++; };
await clearDlg();
await J(`(async()=>{ const st=await import('/src/game/state.js'); const S=window.__S();
  if(!(S.pots||[]).length) st.givePlant(S, window.__io, { slotId:'banjiha-sill:0' });
  S.firstPlay.monstera.arrived=true; try { window.__redraw && window.__redraw(); } catch(e){} return 1; })()`);
await sleep(1500);
/* 상점을 열어 그린 목록을 읽는다(그룹 «전부») */
const shopJar = async () => {
  await page.eval(`(()=>{ try { document.getElementById('tabShop').click(); } catch(e){} })()`, false);
  await sleep(700);
  await page.eval(`(()=>{ const b=[...document.querySelectorAll('[data-shopgroup],[data-group]')].find(x=>/all|전부/.test(x.dataset.shopgroup||x.dataset.group||x.textContent)); if (b) b.click(); })()`, false);
  await sleep(400);
  return J(`(()=>({ jar: !!document.querySelector('#shopList [data-buy="jar"]'), items: [...document.querySelectorAll('#shopList [data-buy]')].map(b=>b.dataset.buy) }))()`);
};
const a = await shopJar();
const free0 = await J(`window.__cutFree()`);
const snap = await J(`window.__questSnap()`);
console.log('■ 갓 도착 — 상점 품목', JSON.stringify(a.items), '· 자를 마디', free0);
ok(!a.jar && free0 === 0, '① 자를 마디 0 · 상점에 수경병이 없다', { jar: a.jar, free: free0 });
ok('motherVarieMatured' in snap && (snap.motherVarieMatured === 0 || snap.motherVarieMatured === null),
   '② 퀘스트 스냅샷에 motherVarieMatured(자르기 문과 같은 수)', snap.motherVarieMatured);
ok(a.items.length > 0, '① 상점 목록은 그려졌다(빈 목록으로 «없다»를 재지 않는다)', a.items.length);
/* 상점은 draw() 때 다시 그려진다(탭을 누르는 것은 안 그린다) — 칸을 바꾼 뒤 한 번 그린다 */
await J(`(()=>{ const S=window.__S(); S.stamina.questsTaken = [...(S.stamina.questsTaken||[]), 'first_cut']; window.__redraw(); return 1; })()`);
await page.eval(`(()=>{ try { document.getElementById('tabPlants').click(); } catch(e){} })()`, false);
await sleep(400);
const b = await shopJar();
ok(b.jar, '③ 한 번 자른 사람(first_cut 끝남)은 자를 마디가 없어도 수경병이 보인다', { jar: b.jar });
await page.close(); clearTimeout(wd);
console.log(fail ? `\nprobe_d25_jar: FAIL ${fail}` : '\nprobe_d25_jar: PASS');
process.exit(fail ? 1 : 0);
