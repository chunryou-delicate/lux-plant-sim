/* tools/leaf/_shot_variesave.mjs — **무늬가 «게임 화면»에 뜨나** (세이브를 넣고 찍는다)
   ⇒ [core] 가 준 판: 반지하 Day 44 · 창턱 · 잎 2 · 무늬 1(sanban)
   ⛔ 아무것도 안 고친다. 넣고 · 기다리고 · 찍는다. */
import { launch, sleep } from '../test_cdp.mjs';
import fs from 'node:fs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const SAVE = fs.readFileSync('docs/handoff/saves/leaf_sill.json','utf8');
const wd=setTimeout(()=>{console.error('⏱ 자가 제한');process.exit(2);},400000); wd.unref?.();
const page = await launch({ width:390, height:844, dpr:2 });
/* ★★ 세이브를 «부팅 전»에 심는다.
   ⚠ 먼저 열고 나서 심으면 안 된다 — game.html:10381 이 `pagehide` 에 saveNow 를 걸어 둬서
     새로고침하는 «그 순간» 게임이 Day 0 을 내 세이브 위에 덮어쓴다(실측: 21206자 → 2838자). */
await page.send('Page.addScriptToEvaluateOnNewDocument', { source:
  `try{ localStorage.setItem('byeot/save/1', ${JSON.stringify(SAVE)}); }catch(e){}` });
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv',150000,300);
await sleep(10000);
const quiet=async()=>{for(let k=0;k<4;k++){for(let i=0;i<40;i++){
  if(await page.eval(`String(document.getElementById('stage').classList.contains('talking'))`)!=='true')break;
  await page.eval(`(()=>{const x=document.getElementById('dlgBox'); if(x)x.click();})()`,false); await sleep(180);} await sleep(500);}};
await quiet();
console.log('판:', await page.eval(`(()=>{try{const S=window.__S();
  const p=(S.pots||[])[0];
  return JSON.stringify({day:S.day, slot:p&&p.slotId, grades:p&&p.leafGrades});}catch(e){return 'ERR '+e.message;}})()`));
console.log('잎 줄:', await page.eval(`(()=>{try{const l=window.__io.growth.leafState();
  return JSON.stringify(l&&l.map(r=>({생:r.leafBirth,무늬:r.varie,성숙:r.matured,떨:r.dropped,등급:r.grade})));}catch(e){return 'ERR '+e.message;}})()`));
await page.eval(`(()=>{const h=document.getElementById('hint'); if(h)h.classList.remove('on');
  const d=document.getElementById('hintDim'); if(d)d.style.display='none';})()`,false);
await sleep(600);
await page.shot('docs/handoff/img/varie/save_room_1.png');
console.log('무늬 알림:', await page.eval(`(()=>{const t=[...document.querySelectorAll('div,span')]
  .map(e=>e.textContent||'').find(t=>/무늬 잎을 받는 중/.test(t)); return t?'★뜸':'없음';})()`));
await sleep(14000); await quiet();
await page.eval(`(()=>{const h=document.getElementById('hint'); if(h)h.classList.remove('on');})()`,false);
await page.shot('docs/handoff/img/varie/save_room_2.png');
/* ★ 그루를 확대해서도 본다 — 방에서 작으면 확대창에서라도 보이나 */
const z=await page.eval(`(()=>{try{ if(typeof openZoomFor==='function'){openZoomFor((window.__S().pots||[])[0]); return 'zoom';}
  const b=[...document.querySelectorAll('button')].find(x=>/확대|크게/.test(x.textContent||''));
  if(b){b.click();return 'btn';} return 'none';}catch(e){return 'ERR '+e.message;}})()`);
console.log('확대:', z);
await sleep(9000);
await page.shot('docs/handoff/img/varie/save_zoom.png');
console.log('경고:', await page.eval(`JSON.stringify((window.__errs||[]).slice(-5))`).catch(()=>'-'));
await page.close();
