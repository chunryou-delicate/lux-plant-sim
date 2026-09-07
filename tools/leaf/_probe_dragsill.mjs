/* tools/leaf/_probe_dragsill.mjs — **「끌어서 창턱에 놓기」가 되나 · 몇 번 만에**
   ⛔ 아무것도 안 고친다. 끌고, 어디에 놓였나 보고, 또 끈다. */
import { launch, sleep } from '../test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const W=Number(process.env.W||390), H=Number(process.env.H||844);
const TRIES=Number(process.env.TRIES||8);
const wd=setTimeout(()=>{console.error('⏱ 자가 제한');process.exit(2);},555000); wd.unref?.();
const page = await launch({ width:W, height:H, dpr:1 });
await page.goto(`${BASE}/game.html`); await page.eval('localStorage.clear()',false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv',150000,300); await sleep(6000);
const mouse=(t,x,y,b)=>page.send('Input.dispatchMouseEvent',{type:t,x:Math.round(x),y:Math.round(y),button:'left',buttons:b,clickCount:1});
const realTap=async(x,y)=>{await mouse('mouseMoved',x,y,0);await mouse('mousePressed',x,y,1);await sleep(80);await mouse('mouseReleased',x,y,0);await sleep(430);};
/* ★ 사람 손처럼 끈다 — 누르고 · 조금씩 옮기고 · 뗀다 */
const drag=async(x0,y0,x1,y1,steps=14)=>{
  await mouse('mouseMoved',x0,y0,0); await sleep(60);
  await mouse('mousePressed',x0,y0,1); await sleep(180);
  for(let i=1;i<=steps;i++){
    const t=i/steps;
    await mouse('mouseMoved', x0+(x1-x0)*t, y0+(y1-y0)*t, 1);
    await sleep(38);
  }
  await sleep(220);
  await mouse('mouseReleased',x1,y1,0); await sleep(900);
};
const quiet=async()=>{for(let k=0;k<3;k++){for(let i=0;i<40;i++){
  if(await page.eval(`String(document.getElementById('stage').classList.contains('talking'))`)!=='true')break;
  await page.eval(`(()=>{const x=document.getElementById('dlgBox'); if(x)x.click();})()`,false); await sleep(180);} await sleep(380);}};
const hint=()=>page.eval(`(()=>{const h=document.getElementById('hint');
  const on=!!(h&&h.classList.contains('on')); const t=document.querySelector('.hintTarget');
  const d=document.getElementById('hintDim'); const ho=(d&&d.dataset.hole||'').split(',').map(Number);
  return JSON.stringify({on,say:on?((h.querySelector('.say')||{}).textContent||'').trim():'',
    테:t?(t.id||(t.className||'').split(' ')[0]):null,
    구멍:(ho.length===3&&ho.every(Number.isFinite))?{x:ho[0],y:ho[1]}:null});})()`);
const clickHint=async()=>{
  const i=await page.eval(`(()=>{const t=document.querySelector('.hintTarget');
    if(t){const r=t.getBoundingClientRect(); const c=t.id==='roomCanvas'||t.tagName==='CANVAS';
      return JSON.stringify({kind:c?'pt':'el',x:r.left+r.width/2,y:r.top+r.height/2});}
    const d=document.getElementById('hintDim'); const ho=(d&&d.dataset.hole||'').split(',').map(Number);
    if(ho.length===3&&ho.every(Number.isFinite))return JSON.stringify({kind:'pt',x:ho[0],y:ho[1]});
    return 'null';})()`);
  if(i==='null')return; const q=JSON.parse(i);
  if(q.kind==='el'){await page.eval(`(()=>{const t=document.querySelector('.hintTarget'); if(t)t.click();})()`,false); await sleep(420);}
  else await realTap(q.x,q.y);
};
const nextDay=()=>page.eval(`(()=>{for(const id of ['mealGo','next']){const b=document.getElementById(id);
  if(b&&!b.disabled&&b.offsetParent!==null){b.click();return id;}}return 'none';})()`);
const slot=()=>page.eval(`(()=>{try{const p=(window.__S().pots||[])[0];
  return p?JSON.stringify({slot:p.slotId||null,at:p.at?'자유':null}):'null';}catch(e){return 'ERR';}})()`);
const potXY=()=>page.eval(`(()=>{try{const rv=window.__rv,p=(window.__S().pots||[])[0];
  const s=rv.screenPosOf(p.slotId||p.at); return s?JSON.stringify(s):'null';}catch(e){return 'null';}})()`);

await quiet();
let goal=null;
for(let i=0;i<90 && !goal;i++){
  const h=JSON.parse(await hint());
  if(h.on && /창턱/.test(h.say)){ goal=h.구멍; console.log(`★ [${i}] 「${h.say}」 목표점:`,JSON.stringify(goal)); break; }
  if(h.on) await clickHint(); else { const r=await nextDay(); if(r==='none') await sleep(400); }
  await sleep(250); await quiet();
}
if(!goal){ console.log('⛔ 창턱 안내를 못 만났다'); await page.close(); process.exit(3); }
const sill=await page.eval(`(()=>{try{return JSON.stringify(window.__rv.screenPosOf('banjiha-sill:0'));}catch(e){return 'null';}})()`);
console.log('창턱 화면 자리:', sill, '· 그루 자리(전):', await slot());
const S=sill!=='null'?JSON.parse(sill):goal;
console.log('');
console.log('── 끌어 본다 · 폰 %dx%d ──', W, H);
const jit=[[0,0],[0,-8],[6,4],[-6,4],[0,10],[10,-6],[-10,-6],[0,-14]];
let ok=-1;
for(let t=0;t<TRIES;t++){
  const p=await potXY(); if(p==='null'){ console.log(`  [${t+1}] 그루 화면 자리를 못 찾음`); break; }
  const q=JSON.parse(p); const [dx,dy]=jit[t%jit.length];
  await realTap(q.x,q.y); await sleep(300);            // 먼저 고른다(사람이 하듯)
  const mv=await page.eval(`(()=>{const b=document.getElementById('pickMove');
    if(b&&b.offsetParent!==null&&!b.disabled){b.click();return 'ok';}return 'none';})()`);
  await sleep(500);
  await drag(q.x,q.y, S.x+dx, S.y+dy);
  await quiet();
  const now=JSON.parse(await slot());
  console.log(`  [${t+1}] 옮기기단추:${mv} · (${Math.round(q.x)},${Math.round(q.y)})→(${Math.round(S.x+dx)},${Math.round(S.y+dy)})  ⇒ ${JSON.stringify(now)}`);
  if(now.slot==='banjiha-sill:0'){ ok=t+1; console.log(`  ★ ✔ ${ok}번 만에 창턱에 놓였다`); break; }
}
console.log('');
console.log('★ 결과:', ok>0?`${ok}번 만에 됨`:`⛔ ${TRIES}번 다 «안 됐다»`);
console.log('★ 마지막 자리:', await slot());
await page.shot('docs/handoff/img/varie/dragsill_end.png');
await page.close();
