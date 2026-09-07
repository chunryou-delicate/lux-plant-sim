import { launch, sleep } from '../test_cdp.mjs';
import fs from 'node:fs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const SAVE = fs.readFileSync('docs/handoff/saves/leaf_sill.json','utf8');
const page = await launch({ width:390, height:844, dpr:1 });
await page.send('Page.addScriptToEvaluateOnNewDocument', { source:
  `try{ localStorage.setItem('byeot/save/1', ${JSON.stringify(SAVE)}); }catch(e){}` });
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv',150000,300); await sleep(9000);
console.log('판:', await page.eval(`(()=>{try{const S=window.__S();return JSON.stringify({day:S.day,slot:(S.pots||[])[0].slotId});}catch(e){return 'ERR';}})()`));
console.log('★ 단계:', await page.eval(`(()=>{try{return JSON.stringify(window.__io.growth.growthPhase());}catch(e){return 'ERR '+e.message;}})()`));
console.log('★ 유효 생장일:', await page.eval(`(()=>{try{return String(window.__io.growth.growthDays());}catch(e){return 'ERR '+e.message;}})()`));
console.log('★ 달력일:', await page.eval(`(()=>{try{return String(window.__io.growth.calendarDay());}catch(e){return 'ERR '+e.message;}})()`));
console.log('막혔나:', await page.eval(`(()=>{try{return JSON.stringify(window.__io.growth.growthBlocked());}catch(e){return 'ERR '+e.message;}})()`));
console.log('잎 줄:', await page.eval(`(()=>{try{return JSON.stringify(window.__io.growth.leafState());}catch(e){return 'ERR';}})()`));
/* ★ 하루씩 걸으며 progress 가 «얼마나» 오르나 — 남은 날을 셈한다 */
const quiet=async()=>{for(let k=0;k<3;k++){for(let i=0;i<40;i++){
  if(await page.eval(`String(document.getElementById('stage').classList.contains('talking'))`)!=='true')break;
  await page.eval(`(()=>{const x=document.getElementById('dlgBox'); if(x)x.click();})()`,false); await sleep(170);} await sleep(400);}};
const nextDay=()=>page.eval(`(()=>{for(const id of ['mealGo','next']){const b=document.getElementById(id);
  if(b&&!b.disabled&&b.offsetParent!==null){b.click();return id;}}return 'none';})()`);
const now=()=>page.eval(`(()=>{try{const g=window.__io.growth;const p=g.growthPhase();
  return JSON.stringify({단계:p.phaseId, 진행:+p.progress01.toFixed(4), 유효:g.growthDays(), 달력:g.calendarDay(), day:window.__S().day});}catch(e){return '{}';}})()`);
await quiet();
console.log('');
console.log('── 하루씩 걸으며 본다 ──');
let prev=null;
for(let d=0; d<26; d++){
  const s=JSON.parse(await now());
  if(d%2===0||s.단계!=='spear_furled') console.log(`  +${String(d).padStart(2)}일  ${JSON.stringify(s)}`);
  if(s.단계!=='spear_furled'){ console.log('  ★ 단계가 «바뀌었다»'); break; }
  prev=s;
  const r=await nextDay(); if(r==='none'){ await quiet(); await sleep(200); }
  await sleep(420);
  if(d%8===7) await quiet();
}
const last=JSON.parse(await now());
console.log('마지막:', JSON.stringify(last));
if(last.진행>0){ const per=last.진행/Math.max(1,(last.유효-70));
  console.log(`★ 유효 하루에 진행 ${(per*100).toFixed(2)}% ⇒ 남은 유효일 대략 ${Math.ceil((1-last.진행)/per)}일`); }
else console.log('⛔ 진행이 «0 그대로»다 — 유효일은 도는데 새순이 안 편다');
await page.close();
