/* tools/leaf/_perf_stand.mjs — «화분대에 키운 그루가 N 개일 때 방 화면이 무거워지나» ([leaf] 10-09 · D46 통과 기준 ⑤)
   SAVE(_walk_stand DUMP · 삽수 넷) 로 켜고, 삽수를 복제해 N 개로 채운다(⚠ 성능 재기 전용 세운 판 — 그림 판정에 쓰지 않는다).
   잰다(같은 판 · 같은 카메라 · 고치기 전/후를 이 자 하나로):
     ① 방 한 프레임: __rv.redraw() 를 R 번 — 한 번당 ms(중앙·평균) · 카메라 둘(방 기본 · 화분대에 붙임)
     ② 게임 그리기: __redraw()(draw → syncRoom · 그루를 다시 맞추는 길) D 번 — 한 번당 ms
     ③ 10초 rAF 간격(카메라를 천천히 돌리며) — ⚠ 헤드리스에선 33ms~수 초로 흔들려 참고만(10-09 세 판)
   ⚠ 헤드리스(swiftshader)라 절대값은 폰과 다르다 — «같은 판·같은 자로 전/후 비»만 읽는다. 세 번 돌려 중앙값을 쓴다.
   SAVE= (필수) · N=8 · R=60 · D=10 · BYEOT_URL=(기본 127.0.0.1:9340 · tools/serve.py) */
import fs from 'node:fs';
import { launch, sleep } from '../test_cdp.mjs';
const SAVEF = process.env.SAVE; if (!SAVEF) { console.error('⛔ SAVE='); process.exit(2); }
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9340', N = Number(process.env.N || 8), R = Number(process.env.R || 60), D = Number(process.env.D || 10);
const SAVE = fs.readFileSync(SAVEF, 'utf8');
const page = await launch({ width: 390, height: 844, dpr: 2 });
await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true; try{ if(!sessionStorage.__c){ localStorage.clear(); localStorage.setItem('byeot/save/1', ${JSON.stringify(SAVE)}); sessionStorage.__c='1'; } }catch(e){}` });
await page.goto(`${BASE}/game.html`);
{ let ok = false; for (let i = 0; i < 100; i++) { await sleep(3000); if (await page.eval('String(!!window.__rv)') === 'true') { ok = true; break; } }
  if (!ok) { console.error('⛔ 안 섬'); await page.close(); process.exit(4); } }
await sleep(8000);
const J = async (js, ms = 300000) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, ms));
for (let i = 0; i < 40; i++) { const t = await page.eval(`(()=>{const s=document.getElementById('stage'); return String(!!(s&&s.classList.contains('talking')));})()`); if (t !== 'true') break;
  await page.eval(`(()=>{const b=document.getElementById('dlgBox'); if(b)b.click();})()`, false); await sleep(250); }
/* 삽수를 N 개로 — 빈 에타제르 칸에 복제 */
console.log('세움 —', JSON.stringify(await J(`(async()=>{ const pr=await import('/src/game/propagation.js'); const S=window.__S(), io=window.__io; const slots=io.light.room.slots||[];
  const live=(S.cuttings||[]).filter(c=>c&&c.status!=='dead'); const used=new Set([...(S.cuttings||[]).map(c=>c.slotId), ...(S.pots||[]).map(p=>p.slotId)]);
  const fp=S.firstPlay&&S.firstPlay.beansprout; for (const c of ((fp&&fp.pots)||[])) used.add(c.slotId);
  const free=slots.filter(s=>/etagere|sill/.test(s.slotId) && !used.has(s.slotId));
  let k=0; while (live.length + k < ${N} && free.length) { const src=live[k % live.length]; const sl=free.shift();
    const c=JSON.parse(JSON.stringify(src)); c.id='cutp_'+(k+1); c.slotId=null; c.at=null; S.cuttings.push(c);
    pr.setCuttingAt(S, c, { x:sl.x, y:sl.y, z:sl.z }, { slots, size: io.light.room.size, snapDist: 0 }); k++; }
  try{window.__redraw()}catch(e){}
  return { 삽수:(S.cuttings||[]).filter(c=>c.status!=='dead').length, 방줄:(window.__rv.plants()||[]).filter(r=>/^cut/.test(r.kind||'')).length }; })()`)));
/* ★ 삽수 그림 짓기는 비동기라 느리다(한 그루 몇 초) — 방에 N 개가 다 설 때까지 기다린 뒤 잰다(10-09 첫 판은 4개 선 채로 쟀다) */
{ let n = 0; for (let i = 0; i < 40; i++) { n = Number(await page.eval(`String((window.__rv.plants()||[]).filter(r=>/^cut/.test(r.kind||'')).length)`)); if (n >= N) break; await sleep(1000); }
  console.log('방에 선 삽수 —', n); }
await sleep(3000);
const stats = a => { const s = [...a].sort((x, y) => x - y); const q = p => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return { 최소: +s[0].toFixed(2), p25: +q(0.25).toFixed(2), 중앙: +q(0.5).toFixed(2), 평균: +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(2), p95: +q(0.95).toFixed(2), n: a.length }; };   // 최소·p25 — 다른 창 부하에 덜 탄다
const out = {};
for (const [name, cam] of [['방기본', null], ['화분대', 'stand']]) {
  if (cam) { await page.eval(`(()=>{try{ const r=(window.__rv.plants()||[]).find(r=>/^cut/.test(r.kind||'')); if(r) window.__rv.focusSlot(r.key,true); window.__rv.camTo({dist:1.8, el:0.4},150);}catch(e){}})()`, false); await sleep(4000); }
  const fr = await J(`(async()=>{ const t=[]; for(let i=0;i<${R};i++){ const a=performance.now(); window.__rv.redraw(); t.push(performance.now()-a); await new Promise(r=>setTimeout(r,16)); } return t; })()`);
  const dr = await J(`(async()=>{ const t=[]; for(let i=0;i<${D};i++){ const a=performance.now(); window.__redraw(); t.push(performance.now()-a); await new Promise(r=>setTimeout(r,300)); } return t; })()`);
  const raf = await J(`(async()=>{ const rv=window.__rv; const c0=rv.camera(); const t=[]; let last=performance.now(); const end=last+10000; let k=0;
    await new Promise(res=>{ const f=(now)=>{ t.push(now-last); last=now; if((k++)%30===0){ try{ rv.camTo({az:(rv.camera().az||0)+0.05},0); }catch(e){} } if(now<end) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
    try{ rv.camTo({az:c0.az},0); }catch(e){} return t.slice(1); })()`);
  out[name] = { 방한프레임ms: stats(fr), 게임그리기ms: stats(dr), rAF간격ms: stats(raf) };
  console.log(name, JSON.stringify(out[name]));
}
console.log('★ 결과', JSON.stringify(out));
await page.close();
