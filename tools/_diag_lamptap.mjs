import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const page = await launch({ width: 390, height: 844, dpr: 2, mobile: false });
const errs=[]; page.on(m=>{ if(m.method==='Runtime.exceptionThrown') errs.push((m.params.exceptionDetails.exception||{}).description||''); });
await page.goto(`${BASE}/game.html`); await page.eval(`localStorage.clear()`,false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('window.__byeotBooted === true', 180000, 300); await sleep(6000);
const clear=async()=>{for(let i=0;i<30;i++){const b=await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`); if(!b)return;
  await page.eval(`(()=>{const g=document.getElementById('guideClose'); if(g&&g.offsetParent){g.click();return;} const b=document.getElementById('dlgBox'); if(b)b.click();})()`,false); await sleep(250);}};
await clear();
await page.eval(`(()=>{const S=window.__S(); S.tutorial.lamp.unlocked=true; S.tutorial.lamp.owned=2; S.lamps.count=2;
  window.__io.light.clearCache(); window.__redraw&&window.__redraw();})()`,false);
await sleep(1500);
const menu=async(t)=>console.log(t, await page.eval(`(()=>{
  const on=id=>{const e=document.getElementById(id); return e&&e.offsetParent?((e.textContent||'').trim()||true):false;};
  return JSON.stringify({이름:on('furnName'), 옮기기:on('furnMove'), 돌리기:on('furnTurn'),
    켜기끄기:on('furnLamp'), 까닭:on('furnWhy'), 메뉴:!!document.getElementById('stage').classList.contains('furnpicked')});})()`));
/* 등을 눌렀다고 코어에 알린다 — 3D 광선 대신 같은 창구를 직접 부른다 */
for (const uid of ['banjiha-growlight-bar','banjiha-growlight-clip']) {
  await page.eval(`(()=>{ const rv=window.__rv;
    const on = rv.lampOn(${JSON.stringify(uid)});
    const st = rv.lampSwitches().lamps.find(l=>l.uid===${JSON.stringify(uid)});
    window.__lampTap && window.__lampTap(${JSON.stringify(uid)}, on, st); })()`,false);
  await sleep(700); await menu(uid+' :');
  await page.eval(`(()=>{const b=document.getElementById('furnLamp'); if(b&&b.offsetParent)b.click();})()`,false);
  await sleep(700); await menu('  누른 뒤:');
  await page.eval(`(()=>{const b=document.getElementById('furnClose'); if(b)b.click();})()`,false); await sleep(400);
}
console.log('예외', errs.length, errs.slice(0,2).join(' | '));
await page.close();
