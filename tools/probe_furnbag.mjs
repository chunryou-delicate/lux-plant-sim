/* tools/probe_furnbag.mjs — **이사하면 반지하 가구가 «가방에» 오고, 눌러서 «방에 놓이나»**
   ------------------------------------------------------------------
   박사님: *"반지하 있던 가구만 «인벤에 넣어서 가져와서» 플레이어가 «배치»하도록 해."*
   재는 것: ① 이사 뒤 가방에 «몇 개»가 오나 · 무엇이 «두고 가나»
            ② 가방 칸이 «뜨나» · ③ 누르면 «방에 서나» · ④ 방을 다시 짓는 데 «얼마나» 걸리나
   ⛔ 값은 안 바꾼다. */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8972';
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 400000);
wd.unref && wd.unref();
const page = await launch({ width: 390, height: 844, dpr: 1 });
try { await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 }); } catch {}
await page.goto(`${BASE}/game.html`);
await page.eval('localStorage.clear()', false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 150000, 300);
await sleep(5000);
for (let i = 0; i < 40; i++) {
  const b = await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');
    return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`);
  if (b !== 'true') break;
  await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s)s.click();
    const x=document.getElementById('dlgBox'); if(x)x.click();
    const g=document.getElementById('guideClose'); if(g)g.click();})()`, false);
  await sleep(250);
}
console.log('■ 이사 전 —', await page.eval(`(()=>{ const S=window.__S();
  return JSON.stringify({ 방:S.home.room, 가구:(window.__io.light.room.def.furniture||[]).length,
    자리:(window.__io.light.room.slots||[]).length,
    가방가구:((S.home||{}).furnitureBag||[]).length }); })()`));
/* 이사 조건을 세운다 — 돈만 채운다(판정은 코어가 한다) */
/* ⚠ 이사는 «돈»만으로 안 열린다 — 둘째 축이 「무늬 잎을 낸 적」이다(tutorial §canMoveOut).
   ⇒ 그래서 그 깃발도 같이 세운다. ⛔ 값은 안 바꾼다 — 판을 그 자리에 «세우는» 것뿐이다. */
console.log('■ 이사 조건 —', await page.eval(`(()=>{ try{ const S=window.__S();
  const ts=S.tutorial;
  ts.cashWon = ts.rules.moveOutCostWon + 100000;
  ts.varieLeaf = { ever: true, count: 1, firstOnDay: S.day };
  window.__redraw();
  const b=document.getElementById('moveOut');
  return JSON.stringify({ 지갑:ts.cashWon, 단추막힘:!!(b&&b.disabled) });
}catch(e){ return 'err '+e.message; } })()`));
await sleep(800);
await page.eval(`(()=>{ const b=document.getElementById('moveOut'); if(b){ b.disabled=false; b.click(); } })()`, false);
await sleep(6000);
for (let i = 0; i < 20; i++) {
  const b = await page.eval(`(()=>{const s=document.getElementById('stage');
    return !!(s&&s.classList.contains('talking'));})()`);
  if (b !== 'true') break;
  await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s)s.click();
    const x=document.getElementById('dlgBox'); if(x)x.click();})()`, false);
  await sleep(250);
}
await sleep(3000);
console.log('');
console.log('=== ① 이사 뒤 ===');
console.log(' ', await page.eval(`(()=>{ const S=window.__S();
  const bag=(S.home||{}).furnitureBag||[];
  return JSON.stringify({ 방:S.home.room, 자리:(window.__io.light.room.slots||[]).length,
    '가방 가구': bag.length, 들고온것: bag.map(f=>f.uid) }); })()`));
/* ★★★ 2026-08-30 — **방이 다 설 때까지 기다린다.** ⛔ 안 기다리면 이사 뒤 방을 다시 짓는
   «그 시간»이 눌러 놓는 시간에 얹혀 잡힌다 — 처음에 31,088 ms 로 적었던 것이 그 탈이었다.
   ★ 그때 `window.__rv` 는 «null» 이었다(probe_placecost). 즉 재던 것은 놓기가 아니라 «이사»였다. */
{
  const t = Date.now();
  await page.waitFor('!!window.__rv', 180000, 500);
  await sleep(1500);
  console.log('  · 이사 뒤 방이 다시 서기까지 —', Date.now() - t, 'ms (⚠ 이건 «놓기»가 아니라 «이사» 몫)');
}
console.log('');
console.log('=== ② 가방 칸이 뜨나 ===');
await page.eval(`try{ window.__byeotSheet.open('bag') }catch(e){}`, false);
await sleep(1600);
console.log(' ', await page.eval(`(()=>{ const cs=[...document.querySelectorAll('[data-furnbag]')];
  return JSON.stringify({ 칸수:cs.length,
    첫칸: cs[0]? ((cs[0].querySelector('.nm')||{}).textContent||'?').trim() : null,
    안내: cs[0]? ((cs[0].querySelector('.eta')||{}).textContent||'').trim() : null }); })()`));
console.log('');
console.log('=== ③ 첫 칸을 누른다 — 방에 서나 · ④ 얼마나 걸리나 ===');
const t0 = Date.now();
await page.eval(`(()=>{ const c=document.querySelector('[data-furnbag]'); if(c) c.click(); })()`, false);
await sleep(500);
for (let i = 0; i < 60; i++) {
  const done = await page.eval(`(()=>{ try{ const S=window.__S();
    return String((S.home.furnitureAdded||[]).length > 0 && !!window.__rv); }catch(e){ return 'false'; } })()`);
  if (done === 'true') break;
  await sleep(500);
}
const ms = Date.now() - t0;
console.log(' ', await page.eval(`(()=>{ const S=window.__S();
  return JSON.stringify({ '가방 남은 것':((S.home||{}).furnitureBag||[]).length,
    '방에 놓은 것':((S.home||{}).furnitureAdded||[]).map(f=>f.uid),
    '방 가구':(window.__io.light.room.def.furniture||[]).length,
    자리:(window.__io.light.room.slots||[]).length }); })()`));
console.log('  ★ 누르고 방이 다시 설 때까지 —', ms, 'ms');
await page.close(); clearTimeout(wd);
