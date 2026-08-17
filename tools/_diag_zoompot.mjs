import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const page = await launch({ width: 390, height: 844, dpr: 2, mobile: false });
const urls=[]; const errs=[];
page.on((m,p)=>{ if(m==='Network.requestWillBeSent' && /\.glb/i.test(p.request?.url||'')) urls.push((p.request.url.split('/assets/')[1]||'').split('?')[0]);
  if(m==='Runtime.exceptionThrown') errs.push((p.exceptionDetails.exception||{}).description||''); });
await page.goto(`${BASE}/game.html`); await page.eval(`localStorage.clear()`,false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('window.__byeotBooted === true', 180000, 300); await sleep(7000);
const clear=async()=>{for(let i=0;i<30;i++){const b=await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`); if(!b)return;
  await page.eval(`(()=>{const g=document.getElementById('guideClose'); if(g&&g.offsetParent){g.click();return;} const b=document.getElementById('dlgBox'); if(b)b.click();})()`,false); await sleep(250);}};
await clear();
console.log('창구 있나:', await page.eval(`(()=>{ try{
  const f=document.getElementById('growth');
  return JSON.stringify({ setPotAsset: typeof (f&&f.contentWindow&&f.contentWindow.setPotAsset),
    어댑터: typeof (window.__io&&window.__io.growth&&window.__io.growth.setPotAsset) });
}catch(e){return 'ERR '+e.message;} })()`));
urls.length=0;
await page.eval(`(()=>{ window.__io.growth.setPotAsset('pots/pot_concrete_square.glb'); })()`,false);
await sleep(3500);
console.log('부른 GLB:', JSON.stringify([...new Set(urls)].filter(u=>/pot/i.test(u))));
console.log('확대창 화분:', await page.eval(`(()=>{ try{
  const w=document.getElementById('growth').contentWindow;
  return JSON.stringify({ 지금: w.__potAssetNowForProbe || null });
}catch(e){return 'ERR '+e.message;} })()`));
console.log('예외', errs.length, errs.slice(0,2).join(' | '));
await page.close();
