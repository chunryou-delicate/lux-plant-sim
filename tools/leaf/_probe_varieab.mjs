/* tools/leaf/_probe_varieab.mjs — **「흰빛」이 «무늬» 탓인가 «어려서»인가**
   ⚠ 어린 몬스테라 잎은 원래 연하다. 그러니 색이 다르다고 무늬라 할 수 없다.
   ⇒ ★ 같은 판·같은 잎·같은 나이에서 «무늬만» 끄고 켜서 견준다. 다른 것이 하나도 없다.
   ⛔ 아무것도 안 고친다(브라우저 안에서만 뒤집는다). */
import { launch, sleep } from '../test_cdp.mjs';
import fs from 'node:fs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const SAVE = fs.readFileSync('docs/handoff/saves/leaf_sill.json','utf8');
const ON = process.env.VARIE !== '0';
const OUT = process.env.OUT || 'docs/handoff/img/varie/ab_on.png';
const wd=setTimeout(()=>{console.error('⏱ 자가 제한');process.exit(2);},390000); wd.unref?.();
const page = await launch({ width:390, height:844, dpr:2 });
/* ★ 세이브를 심고, 무늬를 끌 판이면 leafGrades 를 «비운다» — 잎·나이·자리는 그대로다 */
const save = ON ? SAVE : (()=>{ const j=JSON.parse(SAVE);
  for(const p of (j.state.pots||[])) p.leafGrades={};
  return JSON.stringify(j); })();
await page.send('Page.addScriptToEvaluateOnNewDocument', { source:
  `try{ localStorage.setItem('byeot/save/1', ${JSON.stringify(save)}); }catch(e){}` });
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv',150000,300); await sleep(9000);
const quiet=async()=>{for(let k=0;k<4;k++){for(let i=0;i<40;i++){
  if(await page.eval(`String(document.getElementById('stage').classList.contains('talking'))`)!=='true')break;
  await page.eval(`(()=>{const x=document.getElementById('dlgBox'); if(x)x.click();})()`,false); await sleep(170);} await sleep(400);}};
const nextDay=()=>page.eval(`(()=>{for(const id of ['mealGo','next']){const b=document.getElementById(id);
  if(b&&!b.disabled&&b.offsetParent!==null){b.click();return id;}}return 'none';})()`);
const now=()=>page.eval(`(()=>{try{const g=window.__io.growth;const p=g.growthPhase();
  return JSON.stringify({단계:p.phaseId,진행:+p.progress01.toFixed(2),유효:g.growthDays(),day:window.__S().day});}catch(e){return '{}';}})()`);
await quiet();
console.log('무늬', ON?'★켜짐':'⛔꺼짐', '· 시작:', await now());
console.log('잎 줄:', await page.eval(`(()=>{try{return JSON.stringify(window.__io.growth.leafState().map(r=>({생:r.leafBirth,무늬:r.varie})));}catch(e){return 'ERR';}})()`));
/* ★ 같은 자리까지 걷는다 — spear_opening 진행 0.33 (앞 판과 «같은 눈금») */
for(let d=0; d<34; d++){
  const s=JSON.parse(await now());
  if(s.단계==='spear_opening' && s.진행>=0.30) { console.log('★ 같은 눈금 도달:', JSON.stringify(s)); break; }
  const r=await nextDay(); if(r==='none'){ await quiet(); await sleep(200); }
  await sleep(400);
  if(d%8===7) await quiet();
}
console.log('멈춘 자리:', await now());
await quiet();
await page.eval(`(()=>{const h=document.getElementById('hint'); if(h)h.classList.remove('on');
  const d=document.getElementById('hintDim'); if(d)d.style.display='none';})()`,false);
await sleep(400);
const z=await page.eval(`(()=>{try{const b=[...document.querySelectorAll('button')].find(x=>/확대|크게/.test(x.textContent||''));
  if(b){b.click();return 'btn';} return 'none';}catch(e){return 'ERR';}})()`);
await sleep(11000);
await page.eval(`(()=>{for(const id of ['reliefBox','gameOver']){const e=document.getElementById(id);
  if(e){e.style.display='none';}}})()`,false).catch(()=>{});
await sleep(500);
await page.shot(OUT);
console.log('찍음:', OUT, '· 확대:', z);
await page.close();
