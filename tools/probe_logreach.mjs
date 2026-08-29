/* tools/probe_logreach.mjs — **도착 로그를 «다시 볼 데»가 있나** ([Plan] 2026-08-29)
   ------------------------------------------------------------------
   [Plan]: *"배너는 «6초»에 사라진다. ⇒ ★ 「놓치면 «다시 볼 데»가 있습니까?」"*
   ⇒ ★ 기록(`#log`)은 `#pageDev`(검수 탭)의 `<details>` 안에 있다. 그것이 **첫 플레이에서
     손에 닿나**를 «눌러서» 본다 — 탭 단추가 보이나 · 열리나 · 열면 접혀 있나.
   ⛔ 값은 안 바꾼다. */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8972';
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 300000);
wd.unref && wd.unref();
const page = await launch({ width: 390, height: 844, dpr: 1 });
try { await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 }); } catch {}
await page.goto(`${BASE}/game.html`);
await page.eval('localStorage.clear()', false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 150000, 300);
await sleep(5000);
for (let i = 0; i < 40; i++) {
  const busy = await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');
    return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`);
  if (busy !== 'true') break;
  await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s)s.click();
    const b=document.getElementById('dlgBox'); if(b)b.click();
    const g=document.getElementById('guideClose'); if(g)g.click();})()`, false);
  await sleep(250);
}
console.log('■ 첫 플레이인가 —', await page.eval(`(()=>{ try{ const S=window.__S();
  return String(!!(S.firstPlay && S.firstPlay.enabled)); }catch(e){ return 'err'; } })()`));

const vis = (id) => page.eval(`(()=>{ const e=document.getElementById('${id}');
  if(!e) return '«없음»';
  const cs=getComputedStyle(e), r=e.getBoundingClientRect();
  const on = cs.display!=='none' && cs.visibility!=='hidden' && +cs.opacity>0.05 && r.width>0 && r.height>0;
  return (on?'★보임 ':'⛔안보임 ')+Math.round(r.width)+'x'+Math.round(r.height)
    +'@('+Math.round(r.left)+','+Math.round(r.top)+')'; })()`);

console.log('\n=== ① 아래 띠에 어떤 단추가 있나 (가방을 안 열었을 때) ===');
for (const id of ['openBag','navPlants','navShop','navRoom'])
  console.log('  ', id, '—', await vis(id));

console.log('\n=== ② 시트 안 탭 줄 — 「검수」가 손에 닿나 ===');
await page.eval(`try{ window.__byeotSheet.open('bag') }catch(e){}`, false);
await sleep(1500);
for (const id of ['tabBag','tabPlants','tabShop','tabRoom','tabQuest','tabDev'])
  console.log('  ', id, '—', await vis(id));

console.log('\n=== ③ 「검수」를 열어 본다 ===');
console.log('  누르기 —', await page.eval(`(()=>{ const b=document.getElementById('tabDev');
  if(!b) return '단추 «없음»';
  const cs=getComputedStyle(b); if(cs.display==='none') return '⛔ 숨어 있어 «못 누른다»';
  b.click(); return 'ok'; })()`));
await sleep(1200);
console.log('  pageDev —', await vis('pageDev'));
console.log('  #log —', await vis('log'));
console.log('  기록 접힘 —', await page.eval(`(()=>{ const d=[...document.querySelectorAll('#pageDev details')]
  .find(x=>/기록/.test(x.textContent||'')); return d? (d.open? '★펼쳐짐' : '⛔ «접혀» 있다 — 한 번 더 눌러야 한다') : '«못 찾음»'; })()`));
console.log('  로그 줄 수 —', await page.eval(`(()=>{ const e=document.getElementById('log');
  return e? String(e.children.length || (e.textContent||'').length) : '?'; })()`));

console.log('\n=== ④ 도착 로그가 실제로 그 안에 남나 ===');
console.log('  ', await page.eval(`(()=>{ try{
  const S=window.__S();
  const hit=(S.log||[]).filter(x=>/몬스테라|삽수/.test(typeof x==='string'?x:(x&&x.text)||''));
  return JSON.stringify({ 전체:(S.log||[]).length, 몬스테라줄:hit.length,
    보기:hit.slice(-2).map(x=>String(typeof x==='string'?x:(x&&x.text)||'').slice(0,50)) });
}catch(e){ return 'err '+e.message; } })()`));
await page.close(); clearTimeout(wd);
