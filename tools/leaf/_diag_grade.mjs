import { launch, sleep } from '../test_cdp.mjs';
import fs from 'node:fs';
const BASE='http://localhost:8963';
const SAVE=fs.readFileSync(process.env.SAVE,'utf8');
const page=await launch({width:390,height:844,dpr:1});
await page.send('Page.addScriptToEvaluateOnNewDocument',{source:`try{localStorage.setItem('byeot/save/1', ${JSON.stringify(SAVE)});}catch(e){}`});
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv',150000,300); await sleep(8000);
console.log(process.env.SAVE, '⇒ 게임 안 leafGrades:', await page.eval(`(()=>{try{
  const p=(window.__S().pots||[])[0]; return JSON.stringify(p.leafGrades);}catch(e){return 'ERR';}})()`));
console.log('  leafState grade 칸:', await page.eval(`(()=>{try{
  const l=window.__io.growth.leafState({grades:(window.__S().pots||[])[0].leafGrades});
  return JSON.stringify(l.map(r=>({생:r.leafBirth,무늬:r.varie,등급:r.grade})));}catch(e){return 'ERR '+e.message;}})()`));
await page.close();
