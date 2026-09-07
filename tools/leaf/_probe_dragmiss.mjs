/* tools/leaf/_probe_dragmiss.mjs — **빗나가게 끌면 무슨 일이 나나**
   ★ 고갱이: 빗나간 뒤 «손가락이 꺼지나». 꺼지면 아무도 안 잡아 준다.
   ⚠ 빗나감을 «먼저», 성공을 «나중»에 잰다 (되돌릴 수 없는 재기 — 차례가 답이다)
   ⛔ 아무것도 안 고친다. */
import { launch, sleep } from '../test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const wd=setTimeout(()=>{console.error('⏱ 자가 제한');process.exit(2);},555000); wd.unref?.();
const page = await launch({ width:390, height:844, dpr:1 });
await page.goto(`${BASE}/game.html`); await page.eval('localStorage.clear()',false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv',150000,300); await sleep(6000);
const mouse=(t,x,y,b)=>page.send('Input.dispatchMouseEvent',{type:t,x:Math.round(x),y:Math.round(y),button:'left',buttons:b,clickCount:1});
const realTap=async(x,y)=>{await mouse('mouseMoved',x,y,0);await mouse('mousePressed',x,y,1);await sleep(80);await mouse('mouseReleased',x,y,0);await sleep(430);};
const drag=async(x0,y0,x1,y1,steps=14)=>{
  await mouse('mouseMoved',x0,y0,0); await sleep(60);
  await mouse('mousePressed',x0,y0,1); await sleep(180);
  for(let i=1;i<=steps;i++){const t=i/steps; await mouse('mouseMoved',x0+(x1-x0)*t,y0+(y1-y0)*t,1); await sleep(38);}
  await sleep(220); await mouse('mouseReleased',x1,y1,0); await sleep(1000);
};
const quiet=async()=>{for(let k=0;k<3;k++){for(let i=0;i<40;i++){
  if(await page.eval(`String(document.getElementById('stage').classList.contains('talking'))`)!=='true')break;
  await page.eval(`(()=>{const x=document.getElementById('dlgBox'); if(x)x.click();})()`,false); await sleep(180);} await sleep(380);}};
const hint=()=>page.eval(`(()=>{const h=document.getElementById('hint');
  const on=!!(h&&h.classList.contains('on'));
  return JSON.stringify({on,say:on?((h.querySelector('.say')||{}).textContent||'').trim():''});})()`);
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
  return p?JSON.stringify({slot:p.slotId||null,자유:!!p.at}):'null';}catch(e){return 'ERR';}})()`);
const potXY=()=>page.eval(`(()=>{try{const rv=window.__rv,p=(window.__S().pots||[])[0];
  const s=rv.screenPosOf(p.slotId||p.at); return s?JSON.stringify(s):'null';}catch(e){return 'null';}})()`);

await quiet();
let found=false;
for(let i=0;i<90 && !found;i++){
  const h=JSON.parse(await hint());
  if(h.on && /창턱/.test(h.say)){ found=true; console.log(`★ [${i}] 「${h.say}」`); break; }
  if(h.on) await clickHint(); else { const r=await nextDay(); if(r==='none') await sleep(400); }
  await sleep(250); await quiet();
}
if(!found){ console.log('⛔ 창턱 안내 못 만남'); await page.close(); process.exit(3); }
const S=JSON.parse(await page.eval(`(()=>{try{return JSON.stringify(window.__rv.screenPosOf('banjiha-sill:0'));}catch(e){return 'null';}})()`));
console.log('창턱 화면 자리:', JSON.stringify(S), '· 그루 자리(전):', await slot());
console.log('');
console.log('── ★ 빗나감을 «먼저» 잰다 — 큰 것부터 ──');
const offs=[[0,-100],[100,0],[0,-40],[26,-26],[0,-24],[14,-14],[0,-12]];
for(let t=0;t<offs.length;t++){
  const p=await potXY(); if(p==='null'){console.log('  그루 자리 못 찾음'); break;}
  const q=JSON.parse(p); const [dx,dy]=offs[t];
  await realTap(q.x,q.y); await sleep(280);
  await page.eval(`(()=>{const b=document.getElementById('pickMove'); if(b&&b.offsetParent!==null&&!b.disabled)b.click();})()`,false);
  await sleep(450);
  await drag(q.x,q.y, S.x+dx, S.y+dy);
  await quiet();
  const now=JSON.parse(await slot()); const h=JSON.parse(await hint());
  const 창턱=now.slot==='banjiha-sill:0';
  console.log(`  빗나감 ${String(Math.round(Math.hypot(dx,dy))).padStart(3)}화소 → ${JSON.stringify(now)}  ·  손가락 ${h.on?'★켜짐':'⛔꺼짐'} 「${(h.say||'—').slice(0,26)}」${창턱?'   ⇐ ⚠ 그래도 창턱에 들어감':''}`);
  if(창턱){ console.log('  ⇒ ⚠ 창턱에 들어가 버렸다 — 여기서 빗나감 재기는 끝난다'); break; }
}
console.log('');
console.log('── 마지막으로 «정확히» 끈다 (성공을 나중에) ──');
const p=await potXY();
if(p!=='null'){ const q=JSON.parse(p);
  await realTap(q.x,q.y); await sleep(280);
  await page.eval(`(()=>{const b=document.getElementById('pickMove'); if(b&&b.offsetParent!==null&&!b.disabled)b.click();})()`,false);
  await sleep(450); await drag(q.x,q.y,S.x,S.y); await quiet(); }
console.log('★ 정확히 끈 뒤:', await slot());
const h=JSON.parse(await hint()); console.log('★ 그때 손가락:', h.on?`켜짐 「${h.say.slice(0,26)}」`:'꺼짐');
await page.shot('docs/handoff/img/varie/dragmiss_end.png');
await page.close();
