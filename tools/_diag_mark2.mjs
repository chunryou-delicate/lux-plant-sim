/* 선물 몬스테라가 **가방에 남아 있나** — 하루가 가도 자동으로 안 앉는가 */
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
const waitAct=async(ms=15000)=>{const t0=Date.now();const a=()=>page.eval(`(()=>{try{return !!window.__byeotWalkSfx().acting}catch{return false}})()`);
  for(let i=0;i<6;i++){if(await a())break;await sleep(120);} while(Date.now()-t0<ms){if(!(await a())){await sleep(250);return}await sleep(250);}};
const rowAct=async(act)=>{for(let k=0;k<8;k++){const hit=await page.eval(`(()=>{const b=[...document.querySelectorAll('#siruList button[data-act="${act}"]')].find(x=>!x.disabled); if(!b)return false; b.click(); return true;})()`); if(!hit)break; await waitAct(); await sleep(350); await clear();}};
await page.eval(`(()=>{const rv=window.__rv,c=document.getElementById('roomCanvas').getBoundingClientRect();
  const sp=rv.screenPosOf('banjiha-dresser:1');
  window.__drag.begin('beansprout',document.getElementById('cropThumb').src,{clientX:c.left+c.width*0.9,clientY:c.top+40});
  window.__drag.move({clientX:c.left+sp.x,clientY:c.top+sp.y});window.__drag.end();})()`,false);
await sleep(1300);
await page.eval(`(()=>{const S=window.__S(); S.shop.stock.bean_seed=9;})()`,false);
await page.eval(`(()=>{const b=document.getElementById('placeOk'); if(b&&b.offsetParent)b.click();})()`,false);
await sleep(900); await clear();
await page.eval(`window.__byeotSheet.open('plants')`,false); await sleep(500);
for(let i=0;i<60;i++){ if(await page.eval(`window.__S().pots.length>0`))break;
  await page.eval(`(()=>{const S=window.__S(); if(S.stamina)S.stamina.usedToday=0;})()`,false);
  await rowAct('plant'); await rowAct('water'); await rowAct('harvest'); await rowAct('sow');
  await page.eval(`(()=>{try{document.getElementById('next').click()}catch{}})()`,false); await sleep(900); await clear(); }

/* ── 재는 것 ①  자리 없이 좌표로만 선 그루가 말을 하나 ─────────────── */
console.log('① 자리 없는 그루의 말풍선');
console.log(await page.eval(`(()=>{ const S=window.__S(); const p=S.pots[0];
  if(!p) return '그루 없음';
  p.slotId=null; p.at={x:-0.6,z:0.4}; p.placedOnce=true;
  const w=(window.__potWaterNow?window.__potWaterNow(p):null);
  const m=window.__potMarks();
  return JSON.stringify({자리:p.slotId, 좌표:!!p.at, 말풍선수:m.length, 말:m[0]?m[0].ko:null}); })()`));
/* 마를 때까지 굴려 본다 — 문턱을 넘겨야 말이 난다 */
for(let i=0;i<14;i++){ await page.eval(`(()=>{try{document.getElementById('next').click()}catch{}})()`,false); await sleep(950); await clear();
  const r=JSON.parse(await page.eval(`(()=>{const S=window.__S();const m=window.__potMarks();
    return JSON.stringify({일:S.day, 수:m.length, 말:m[0]?m[0].ko:null});})()`));
  if(r.수>0){ console.log(`   → ${r.일}일에 났다 · ${r.말}`); break; }
  if(i===13) console.log('   ✘ 열나흘을 굴려도 말이 없다');
}
/* ── 재는 것 ②  시루 회수 ────────────────────────────────────── */
console.log('② 시루 회수');
console.log(await page.eval(`(()=>{ const S=window.__S();
  const before=window.__cropRows? null : null;
  return 'skip'; })()`));
await page.close();
