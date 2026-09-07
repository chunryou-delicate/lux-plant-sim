/* tools/leaf/_probe_movepot.mjs — **「창턱으로 옮기라」는 말을 «따를 수 있나»**
   ① 끌어서 되나  ② 골라서 되나(#slotPanel)  ③ ★ 그 «고르는 길»에 닿나(손가락이 짚나)
   ⛔ 아무것도 안 고친다. */
import { launch, sleep } from '../test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 555000); wd.unref?.();
const page = await launch({ width: 390, height: 844, dpr: 1 });
await page.goto(`${BASE}/game.html`); await page.eval('localStorage.clear()', false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 150000, 300); await sleep(6000);
const mouse=(t,x,y,b)=>page.send('Input.dispatchMouseEvent',{type:t,x:Math.round(x),y:Math.round(y),button:'left',buttons:b,clickCount:1});
const realTap=async(x,y)=>{await mouse('mouseMoved',x,y,0);await mouse('mousePressed',x,y,1);await sleep(80);await mouse('mouseReleased',x,y,0);await sleep(450);};
const quiet=async()=>{for(let k=0;k<3;k++){for(let i=0;i<40;i++){
  if(await page.eval(`String(document.getElementById('stage').classList.contains('talking'))`)!=='true')break;
  await page.eval(`(()=>{const x=document.getElementById('dlgBox'); if(x)x.click();})()`,false); await sleep(180);} await sleep(380);}};
const hint=()=>page.eval(`(()=>{const h=document.getElementById('hint');
  const on=!!(h&&h.classList.contains('on'));
  const t=document.querySelector('.hintTarget');
  return JSON.stringify({on, say:on?((h.querySelector('.say')||{}).textContent||'').trim():'',
    테:t?(t.id||(t.className||'').split(' ')[0]):null});})()`);
const clickHint=async()=>{
  const info=await page.eval(`(()=>{const t=document.querySelector('.hintTarget');
    if(t){const r=t.getBoundingClientRect(); const c=t.id==='roomCanvas'||t.tagName==='CANVAS';
      return JSON.stringify({kind:c?'pt':'el',id:t.id||t.className.split(' ')[0],x:r.left+r.width/2,y:r.top+r.height/2});}
    const d=document.getElementById('hintDim'); const ho=(d&&d.dataset.hole||'').split(',').map(Number);
    if(ho.length===3&&ho.every(Number.isFinite))return JSON.stringify({kind:'pt',id:'(점)',x:ho[0],y:ho[1]});
    return 'null';})()`);
  if(info==='null')return 'none';
  const q=JSON.parse(info);
  if(q.kind==='el'){await page.eval(`(()=>{const t=document.querySelector('.hintTarget'); if(t)t.click();})()`,false); await sleep(420); return 'el:'+q.id;}
  await realTap(q.x,q.y); return 'pt:'+q.id;
};
const nextDay=()=>page.eval(`(()=>{for(const id of ['mealGo','next']){const b=document.getElementById(id);
  if(b&&!b.disabled&&b.offsetParent!==null){b.click();return id;}}return 'none';})()`);
const potSlot=()=>page.eval(`(()=>{try{const p=(window.__S().pots||[])[0];
  return p?JSON.stringify({slot:p.slotId||null,free:!!p.at}):'null';}catch(e){return 'ERR';}})()`);
const vis=(id)=>page.eval(`(()=>{const b=document.getElementById('${id}');
  if(!b)return 'none'; const r=b.getBoundingClientRect();
  return JSON.stringify({보임:b.offsetParent!==null&&r.width>4, 잠김:!!b.disabled, 글:(b.textContent||'').trim().slice(0,14)});})()`);

await quiet();
console.log('── ㉠ 창턱 안내까지 걷는다 · ★ 손가락이 «무엇을» 짚는지 다 적는다 ──');
const seen=[]; let sill=false;
for(let i=0;i<90 && !sill;i++){
  const h=JSON.parse(await hint());
  if(h.on){ seen.push(h.테||'(점)');
    if(/창턱/.test(h.say)){ sill=true; console.log(`★ [${i}] 창턱 안내: 「${h.say}」 테:${h.테}`); break; }
    await clickHint();
  } else { const r=await nextDay(); if(r==='none') await sleep(400); }
  await sleep(260); await quiet();
}
if(!sill){ console.log('⛔ 창턱 안내 못 만남'); await page.close(); process.exit(3); }
console.log('손가락이 짚은 것들:', [...new Set(seen)].join(' · '));
console.log('★③ 손가락이 «자리 고르기»(pickWhere)를 짚은 적:',
  seen.includes('pickWhere')?'✔ 있다':'⛔ ★ 한 번도 «없다»');
console.log('그루 자리(전):', await potSlot());
console.log('  #pickWhere :', await vis('pickWhere'));
console.log('  #slotPanel 열림:', await page.eval(`String(document.getElementById('slotPanel').getAttribute('aria-hidden'))`));
console.log('');
console.log('── ㉡ ② «골라서» 옮겨 본다 ──');
/* 방에서 그루를 눌러 고른다 → [📍 자리] → 목록에서 창턱 */
const pot=await page.eval(`(()=>{try{const rv=window.__rv;
  const p=(window.__S().pots||[])[0];
  const s=rv.screenPosOf&&p&&(p.slotId||p.at)?rv.screenPosOf(p.slotId||p.at):null;
  return s?JSON.stringify(s):'null';}catch(e){return 'ERR '+e.message;}})()`);
console.log('  그루 화면 자리:', pot);
if(pot!=='null'&&!pot.startsWith('ERR')){ const q=JSON.parse(pot); await realTap(q.x,q.y); await sleep(700); }
console.log('  누른 뒤 #pickWhere:', await vis('pickWhere'));
const pw=await page.eval(`(()=>{const b=document.getElementById('pickWhere');
  if(!b||b.offsetParent===null)return 'none'; b.click(); return 'clicked';})()`);
console.log('  [📍 자리] 누름:', pw); await sleep(900);
console.log('  #slotPanel:', await page.eval(`String(document.getElementById('slotPanel').getAttribute('aria-hidden'))`));
const rows=await page.eval(`(()=>{const l=document.getElementById('slotList'); if(!l)return 'none';
  return JSON.stringify([...l.querySelectorAll('button')].map(b=>(b.textContent||'').trim().replace(/\s+/g,' ').slice(0,30)));})()`);
console.log('  고를 수 있는 자리:', rows);
const picked=await page.eval(`(()=>{const l=document.getElementById('slotList'); if(!l)return 'none';
  const b=[...l.querySelectorAll('button')].find(x=>/창턱/.test(x.textContent||''));
  if(!b)return '창턱없음'; b.click(); return (b.textContent||'').trim().replace(/\s+/g,' ').slice(0,24);})()`);
console.log('  창턱 골라 누름:', picked); await sleep(1200); await quiet();
console.log('★② 결과 — 그루 자리(후):', await potSlot());
await page.shot('docs/handoff/img/varie/movepot_after.png');
await page.close();
