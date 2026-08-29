/* tools/probe_moveremount.mjs — **이사하면 원룸 3D 가 «다시 서나»**
   ------------------------------------------------------------------
   ⚠ probe_placecost 에서 이사 10초 뒤 `window.__rv` 가 «null» 이었다.
     probe_furnbag 에서는 180초를 기다려도 «안 섰다».
   ⇒ 그러면 「가구 하나 놓는 데 31초」는 놓기 값이 아니라 ★ 「이사 뒤 방이 안 서는 것」이었다.
   재는 것: 이사를 누르고 ① 방이 서나(`__rv`) ② 몇 초 만에 ③ 안 서면 «무슨 말»이 찍혔나
   ⛔ 값은 안 바꾼다. */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8972';
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 300000);
wd.unref && wd.unref();
const page = await launch({ width: 390, height: 844, dpr: 1 });
await page.goto(`${BASE}/game.html`);
await page.eval('localStorage.clear()', false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 150000, 300);
await sleep(4000);
for (let i = 0; i < 40; i++) {
  const b = await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');
    return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`);
  if (b !== 'true') break;
  await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s)s.click();
    const x=document.getElementById('dlgBox'); if(x)x.click();
    const g=document.getElementById('guideClose'); if(g)g.click();})()`, false);
  await sleep(250);
}
/* 말을 다 받아 적는다 — 안 서면 «무슨 말이 찍혔나»가 답이다 */
await page.eval(`(()=>{ window.__logs=[];
  for (const k of ['warn','error']) { const o=console[k].bind(console);
    console[k]=(...a)=>{ try{ window.__logs.push(k+' | '+a.map(x=>{
      try { return (x && x.message) ? x.message : String(x); } catch { return '?'; } }).join(' ')); }catch{} o(...a); }; }
  addEventListener('error', e=>window.__logs.push('던짐 | '+(e.message||'')));
  addEventListener('unhandledrejection', e=>window.__logs.push('약속깨짐 | '+((e.reason&&e.reason.message)||e.reason)));
})()`, false);
await page.eval(`(()=>{ const S=window.__S(); const ts=S.tutorial;
  ts.cashWon = ts.rules.moveOutCostWon + 100000;
  ts.varieLeaf = { ever:true, count:1, firstOnDay:S.day }; window.__redraw(); })()`, false);
await sleep(600);
const t0 = Date.now();
await page.eval(`(()=>{ const b=document.getElementById('moveOut'); if(b){ b.disabled=false; b.click(); } })()`, false);
console.log('■ 이사 눌렀습니다');
let stood = null;
for (let i = 0; i < 120; i++) {          /* 최대 2분 */
  await sleep(1000);
  await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s)s.click();
    const x=document.getElementById('dlgBox'); if(x)x.click();})()`, false);
  const v = await page.eval(`String(!!window.__rv)`);
  if (v === 'true') { stood = Date.now() - t0; break; }
}
console.log('■ 방 —', stood == null ? '★★ 2분을 기다려도 «안 섰습니다»' : `${stood} ms 만에 섰습니다`);
console.log('■ 판 —', await page.eval(`(()=>{ const S=window.__S();
  return JSON.stringify({ 방:S.home.room,
    'stage.room-ok': document.getElementById('stage').classList.contains('room-ok'),
    가방:((S.home||{}).furnitureBag||[]).length,
    가구:(window.__io.light.room.def.furniture||[]).length }); })()`));
console.log('■ 덮개에 뭐라 적혔나 —', await page.eval(`(()=>{ const fb=document.getElementById('roomFallback');
  return JSON.stringify({ 보이나: !!(fb && fb.style.display !== 'none'),
    말: fb ? (fb.textContent||'').trim().slice(0,160) : null }); })()`));
console.log('');
console.log('=== ★ 한 번 «더» 지어 보면 서나 ===');
{
  const t = Date.now();
  await page.eval(`(async()=>{ try{ await window.__remount(); }catch(e){ window.__logs.push('다시짓기 던짐 | '+e.message); } })()`, false);
  let ok = null;
  for (let i = 0; i < 90; i++) { await sleep(1000); if (await page.eval(`String(!!window.__rv)`) === 'true') { ok = Date.now() - t; break; } }
  console.log(' ', ok == null ? '★ 두 번째도 «안 섰습니다»' : `두 번째는 ${ok} ms 만에 섰습니다`);
}
console.log('■ 찍힌 말 —');
const logs = JSON.parse(await page.eval(`JSON.stringify(window.__logs||[])`));
for (const l of logs.slice(0, 40)) console.log('   ', l);
if (!logs.length) console.log('    (없음)');
await page.close(); clearTimeout(wd);
