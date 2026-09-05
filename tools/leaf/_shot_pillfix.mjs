/* tools/leaf/_shot_pillfix.mjs — **흐림을 걷으면 살아나나** 를 같은 판에서 찍어 견준다
   ⛔ game.html 은 «안 고친다». 브라우저에서 CSS 한 줄만 얹어 보고 다시 걷는다. */
import { launch, sleep } from '../test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const page = await launch({ width: 390, height: 844, dpr: 2 });
await page.goto(`${BASE}/game.html`);
await page.eval('localStorage.clear()', false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 150000, 300);
await sleep(7000);
for (let i = 0; i < 20; i++) {
  if (await page.eval(`String(document.getElementById('stage').classList.contains('talking'))`) !== 'true') break;
  await page.eval(`(()=>{const x=document.getElementById('dlgBox'); if(x)x.click();})()`, false);
  await sleep(250);
}
await sleep(1500);
await page.eval(`(()=>{const h=document.getElementById('hint'); if(h)h.classList.remove('on');
  const d=document.getElementById('hintDim'); if(d)d.style.display='none';})()`, false);
const box = () => page.eval(`(()=>{const b=document.getElementById('waterCrop');
  if(!b||!b.classList.contains('done'))return 'null'; const r=b.getBoundingClientRect();
  const cs=getComputedStyle(b);
  return JSON.stringify({x:r.left,y:r.top,w:r.width,h:r.height,흐림:cs.opacity});})()`);
const mouse=(t,x,y,b)=>page.send('Input.dispatchMouseEvent',{type:t,x:Math.round(x),y:Math.round(y),button:'left',buttons:b,clickCount:1});
const tap=async(x,y)=>{await mouse('mouseMoved',x,y,0);await mouse('mousePressed',x,y,1);await sleep(70);await mouse('mouseReleased',x,y,0);await sleep(700);};
const quiet=async()=>{for(let k=0;k<3;k++){for(let i=0;i<40;i++){
  if(await page.eval(`String(document.getElementById('stage').classList.contains('talking'))`)!=='true')break;
  await page.eval(`(()=>{const x=document.getElementById('dlgBox'); if(x)x.click();})()`,false); await sleep(200);} await sleep(500);}};
const finger=()=>page.eval(`(()=>{const h=document.getElementById('hint');
  if(!h||!h.classList.contains('on'))return 'null';
  const r=h.getBoundingClientRect(), t=document.querySelector('.hintTarget');
  const tr=t?t.getBoundingClientRect():null;
  const d=document.getElementById('hintDim'), hole=(d&&d.dataset.hole||'').split(',').map(Number);
  const at=tr&&tr.width?{x:tr.left+tr.width/2,y:tr.top+tr.height/2}
    :(hole.length===3&&hole.every(Number.isFinite))?{x:hole[0],y:hole[1]}
    :{x:r.left+r.width/2,y:r.top+r.height/2};
  return JSON.stringify(at);})()`);
let b1='null';
for(let i=0;i<10 && b1==='null';i++){
  b1=await box(); if(b1!=='null')break;
  const f=await finger(); if(f!=='null'){const q=JSON.parse(f); await tap(q.x,q.y);} else await sleep(900);
  await quiet();
}
if (b1 === 'null') { console.log('⛔ .done 이 없다'); await page.close(); process.exit(3); }
await page.eval(`(()=>{const h=document.getElementById('hint'); if(h)h.classList.remove('on');
  const d=document.getElementById('hintDim'); if(d)d.style.display='none';})()`, false);
await sleep(400);
console.log('전 ', b1);
await page.shot('docs/handoff/img/phoneeye/pill_before.png');
/* ★ 고침 한 줄만 얹는다 — 값이 아니라 «보이기» 하나다 */
await page.eval(`(()=>{const s=document.createElement('style');
  s.textContent='#waterCrop.done,#waterPot.done{opacity:1}'; document.head.appendChild(s);})()`, false);
await sleep(700);
console.log('후 ', await box());
await page.shot('docs/handoff/img/phoneeye/pill_after.png');
await page.close();
