/* tools/leaf/_shot_varieopen3.mjs — **물 주며 걸어서 무늬 새순을 편다**
   ★ [core] 가 짚어 준 것: 마른 날은 유효일이 «안 세어진다». 그래서 77 에서 얼었다
   ★ 내가 잰 것: 유효 76→77 에 진행 0.17→0.33 ⇒ 유효 하루에 «+0.17» ⇒ 100% 까지 유효 «4일쯤»
   ⇒ 그러니 물만 챙기면 금방이다.
   ⛔ 아무것도 안 고친다. */
import { launch, sleep } from '../test_cdp.mjs';
import fs from 'node:fs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const SAVE = fs.readFileSync(process.env.SAVE || 'docs/handoff/saves/leaf_sill.json','utf8');
const MAX = Number(process.env.MAX || 70);
const OUT = process.env.OUTSHOT || 'docs/handoff/img/varie/final_zoom.png';
const wd=setTimeout(()=>{console.error('⏱ 자가 제한');process.exit(2);},555000); wd.unref?.();
const page = await launch({ width:390, height:844, dpr:2 });
await page.send('Page.addScriptToEvaluateOnNewDocument', { source:
  `try{ localStorage.setItem('byeot/save/1', ${JSON.stringify(SAVE)}); }catch(e){}` });
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv',150000,300); await sleep(9000);
const quiet=async()=>{for(let k=0;k<4;k++){for(let i=0;i<40;i++){
  if(await page.eval(`String(document.getElementById('stage').classList.contains('talking'))`)!=='true')break;
  await page.eval(`(()=>{const x=document.getElementById('dlgBox'); if(x)x.click();})()`,false); await sleep(160);} await sleep(380);}};
/* ★ 물주기 — 단추가 살아 있으면 누른다. 말풍선이 대신 뜰 때는 그것도 누른다 */
const water=()=>page.eval(`(()=>{ let did=[];
  const b=document.getElementById('waterPot');
  if(b && !b.disabled && b.offsetParent!==null){ b.click(); did.push('단추'); }
  for(const m of document.querySelectorAll('.mark')){
    const t=(m.textContent||''); if(/몬스테라.*물|물.*몬스테라/.test(t)){ m.click(); did.push('말풍선'); break; } }
  return did.join('+')||'none'; })()`);
const nextDay=()=>page.eval(`(()=>{for(const id of ['mealGo','next']){const b=document.getElementById(id);
  if(b&&!b.disabled&&b.offsetParent!==null){b.click();return id;}}return 'none';})()`);
const now=()=>page.eval(`(()=>{try{const g=window.__io.growth;const p=g.growthPhase();
  return JSON.stringify({단계:p.phaseId,진행:+p.progress01.toFixed(2),유효:g.growthDays(),day:window.__S().day});}catch(e){return '{}';}})()`);
await quiet();
console.log('시작:', await now());
let s=null, w=0;
for(let d=0; d<MAX; d++){
  s=JSON.parse(await now());
  if(s.단계 && !/^spear_(furled|opening)$/.test(s.단계)){ console.log('★★ 펴졌다 — 단계:',s.단계); break; }
  const r=await water(); if(r!=='none') w++;
  if(d%5===0) console.log(`  +${String(d).padStart(2)}일 ${JSON.stringify(s)} 물:${r}`);
  const n=await nextDay(); if(n==='none'){ await quiet(); await sleep(200); }
  await sleep(400);
  if(d%8===7) await quiet();
}
console.log('마지막:', JSON.stringify(s), '· 물 준 횟수', w);
await quiet();
await page.eval(`(()=>{const h=document.getElementById('hint'); if(h)h.classList.remove('on');
  const d=document.getElementById('hintDim'); if(d)d.style.display='none';})()`,false);
await sleep(400);
const z=await page.eval(`(()=>{try{const b=[...document.querySelectorAll('button')].find(x=>/확대|크게/.test(x.textContent||''));
  if(b){b.click();return 'btn';} return 'none';}catch(e){return 'ERR';}})()`);
await sleep(11000);
await page.eval(`(()=>{for(const id of ['reliefBox','gameOver']){const e=document.getElementById(id); if(e)e.style.display='none';}})()`,false).catch(()=>{});
await sleep(500);
await page.shot(OUT);
console.log('확대:', z, '· 잎:', await page.eval(`(()=>{try{return JSON.stringify(window.__io.growth.leafState().map(r=>({생:r.leafBirth,무늬:r.varie,성숙:r.matured})));}catch(e){return 'ERR';}})()`));
await page.close();
