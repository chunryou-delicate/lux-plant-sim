/* tools/leaf/_check_reload_gate.mjs — «세이브로 켠 직후 [다음 날]이 열려 있나 · 첫 화분이 제 생장일로 그려지나» ([leaf] 10-08)
   _walk_twopots DUMP= 로 뜬 «씨앗을 심은 뒤» 세이브를 넣고 켠다. 화면 손질 0 — 켜고 재고 찍기만.
   SAVE= (필수) · OUTDIR= (필수 · 비어 있어야) · BYEOT_URL=(기본 127.0.0.1:9340 · 서버는 tools/serve.py) */
import fs from 'node:fs';
import { launch, sleep } from '../test_cdp.mjs';
const OUTDIR = process.env.OUTDIR, SAVEF = process.env.SAVE;
if (!OUTDIR || !SAVEF) { console.error('⛔ SAVE= OUTDIR='); process.exit(2); }
fs.mkdirSync(OUTDIR, { recursive: true }); if (fs.readdirSync(OUTDIR).length) { console.error('⛔ 비어 있지 않다'); process.exit(2); }
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9340';
const SAVE = fs.readFileSync(SAVEF, 'utf8');
const page = await launch({ width: 390, height: 844, dpr: 1 });
await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__leafLog=[]; for(const k of ['warn','error']){ const o=console[k].bind(console); console[k]=(...a)=>{ try{ window.__leafLog.push(k+' | '+a.map(x=>(x&&x.message)?(x.message+' @@ '+String(x.stack||'').split(String.fromCharCode(10)).slice(1,5).map(l=>l.trim().split('/').slice(-1)[0]).join(' <- ')):String(x)).join(' ').slice(0,600)); }catch(_){} o(...a); }; } try{ if(!sessionStorage.__c){ localStorage.clear(); localStorage.setItem('byeot/save/1', ${JSON.stringify(SAVE)}); sessionStorage.__c='1'; } }catch(e){}` });
await page.goto(`${BASE}/game.html`);
{ let ok = false; for (let i = 0; i < 100; i++) { await sleep(3000); if (await page.eval('String(!!window.__rv)') === 'true') { ok = true; console.log('켜짐', i * 3 + 3, '초'); break; } }
  if (!ok) { console.error('⛔ 안 섬'); await page.close(); process.exit(4); } }
await sleep(8000);
const J = async (js) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, 60000));
console.log('켠 뒤 —', JSON.stringify(await J(`(async()=>{ const S=window.__S(), io=window.__io; const n=document.getElementById('next');
  return { 날:S.day, next잠김:!!(n&&n.disabled), hardLock:document.body.dataset.hardLock||null, 꽂힌그루:io.growth.current&&io.growth.current(),
    화분:S.pots.map(p=>({id:p.id, gid:p.growthId||'__main__'})),
    방:(window.__rv.plants()||[]).filter(r=>r.kind==='monstera'||r.kind==='emptypot').map(r=>({potId:r.potId, kind:r.kind, 생장일:r.growthDays})),
    기록:(S.log||[]).slice(-3).map(x=>String(typeof x==='string'?x:(x&&(x.msg||x.text||x.ko))||JSON.stringify(x)).slice(0,120)) }; })()`)));
await page.eval(`(()=>{try{const p=window.__S().pots[0]; window.__rv.focusSlot(p.slotId||p.at,true);}catch(e){}})()`, false);
for (let i = 0; i < 30; i++) { if (await page.eval(`(()=>{try{return String(!!window.__rv.camBusy());}catch(e){return 'false';}})()`) === 'false') break; await sleep(300); }
await page.eval(`(()=>{try{window.__rv.camTo({dist:3.0, el:0.55}, 150);}catch(e){}})()`, false);
for (let i = 0; i < 20; i++) { if (await page.eval(`(()=>{try{return String(!!window.__rv.camBusy());}catch(e){return 'false';}})()`) === 'false') break; await sleep(250); }
await sleep(1500); await page.eval(`(()=>{try{window.__rv.redraw();}catch(e){}})()`, false); await sleep(500);
await page.shot(`${OUTDIR}/room_pot0_reload.png`);
console.log('콘솔:', await page.eval(`JSON.stringify((window.__leafLog||[]).slice(-6))`));
await page.close();
