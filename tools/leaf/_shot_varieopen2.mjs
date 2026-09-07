/* tools/leaf/_shot_varieopen2.mjs — **무늬 새순이 «펴진 뒤» 찍는다**
   ★ 잰 것: 세이브(유효 70)는 spear_furled 이고 ⇒ 유효 «5일»에 spear_opening 으로 넘어간다
     (진행이 유효 하루에 0.2씩 오른다 — [core] 표의 14일이 아니다)
   ⇒ 그러니 게임일 «스물 남짓»이면 펴진다. 파산 전에 끝난다.
   ⛔ 아무것도 안 고친다. */
import { launch, sleep } from '../test_cdp.mjs';
import fs from 'node:fs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const SAVE = fs.readFileSync('docs/handoff/saves/leaf_sill.json','utf8');
const MAX = Number(process.env.MAX || 34);
const wd=setTimeout(()=>{console.error('⏱ 자가 제한');process.exit(2);},400000); wd.unref?.();
const page = await launch({ width:390, height:844, dpr:2 });
await page.send('Page.addScriptToEvaluateOnNewDocument', { source:
  `try{ localStorage.setItem('byeot/save/1', ${JSON.stringify(SAVE)}); }catch(e){}` });
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv',150000,300); await sleep(9000);
const quiet=async()=>{for(let k=0;k<4;k++){for(let i=0;i<40;i++){
  if(await page.eval(`String(document.getElementById('stage').classList.contains('talking'))`)!=='true')break;
  await page.eval(`(()=>{const x=document.getElementById('dlgBox'); if(x)x.click();})()`,false); await sleep(170);} await sleep(400);}};
const nextDay=()=>page.eval(`(()=>{for(const id of ['mealGo','next']){const b=document.getElementById(id);
  if(b&&!b.disabled&&b.offsetParent!==null){b.click();return id;}}return 'none';})()`);
const now=()=>page.eval(`(()=>{try{const g=window.__io.growth;const p=g.growthPhase();
  return JSON.stringify({단계:p.phaseId, 진행:+p.progress01.toFixed(2), 유효:g.growthDays(), day:window.__S().day});}catch(e){return '{}';}})()`);
await quiet();
console.log('시작:', await now());
let s=null;
for(let d=0; d<MAX; d++){
  s=JSON.parse(await now());
  if(d%4===0) console.log(`  +${String(d).padStart(2)}일 ${JSON.stringify(s)}`);
  if(s.단계 && !/^spear_(furled|opening)$/.test(s.단계)){ console.log('★ 펴진 뒤 단계:',s.단계); break; }
  const r=await nextDay(); if(r==='none'){ await quiet(); await sleep(200); }
  await sleep(420);
  if(d%8===7) await quiet();
}
console.log('마지막:', JSON.stringify(s));
await quiet();
await page.eval(`(()=>{const h=document.getElementById('hint'); if(h)h.classList.remove('on');
  const d=document.getElementById('hintDim'); if(d)d.style.display='none';})()`,false);
await sleep(500);
/* ★ 확대창을 «먼저» 연다 — 방은 작아서 무늬가 안 보인다 */
const z=await page.eval(`(()=>{try{const b=[...document.querySelectorAll('button')].find(x=>/확대|크게/.test(x.textContent||''));
  if(b){b.click();return 'btn';} return 'none';}catch(e){return 'ERR';}})()`);
console.log('확대:', z);
await sleep(11000);
await page.eval(`(()=>{for(const id of ['reliefBox','gameOver','detail']){const e=document.getElementById(id);
  if(e){e.style.display='none'; e.setAttribute('aria-hidden','true');}}})()`,false).catch(()=>{});
await sleep(600);
await page.shot('docs/handoff/img/varie/opened_zoom.png');
/* 옆·위에서도 한 장씩 — 잎이 가려질 수 있다 */
for (const [ko,re] of [['좌','좌'],['우','우'],['위','위']]) {
  const c=await page.eval(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.textContent||'').trim()==='${re}');
    if(b){b.click();return 'ok';} return 'none';})()`);
  if(c==='ok'){ await sleep(2200); await page.shot(`docs/handoff/img/varie/opened_${ko}.png`); }
}
console.log('잎 줄:', await page.eval(`(()=>{try{return JSON.stringify(window.__io.growth.leafState().map(r=>({생:r.leafBirth,무늬:r.varie,성숙:r.matured})));}catch(e){return 'ERR';}})()`));
await page.close();
