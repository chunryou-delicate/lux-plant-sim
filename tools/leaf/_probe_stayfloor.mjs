/* tools/leaf/_probe_stayfloor.mjs — **가르침을 «안 따르고» 버티면 잡아 주나**
   ------------------------------------------------------------------
   총괄이 물은 것: 「창턱으로 끌어 보세요」를 안 따르고 버티면 손가락이 계속 붙어 있나.
   ⇒ 붙어 있으면 ✔ 잡아 준다. 몇 걸음 뒤 사라지면 ⛔ 그때가 «벽»이다.
   ⛔ 아무것도 안 고친다. 누르고 세기만 한다. */
import { launch, sleep } from '../test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const DAYS = Number(process.env.DAYS || 90);
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 560000); wd.unref?.();
const page = await launch({ width: 390, height: 844, dpr: 1 });
await page.goto(`${BASE}/game.html`);
await page.eval('localStorage.clear()', false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 150000, 300);
await sleep(6000);
const quiet=async()=>{for(let k=0;k<3;k++){for(let i=0;i<40;i++){
  if(await page.eval(`String(document.getElementById('stage').classList.contains('talking'))`)!=='true')break;
  await page.eval(`(()=>{const x=document.getElementById('dlgBox'); if(x)x.click();})()`,false); await sleep(180);} await sleep(400);}};
/* ★ 손가락 — 짚는 «요소»가 있으면 그 요소를 바로 누른다(좌표 두드림이 오늘 안 먹혔다) */
const hint = () => page.eval(`(()=>{const h=document.getElementById('hint');
  const on=!!(h&&h.classList.contains('on'));
  const say=on?((h.querySelector('.say')||{}).textContent||'').trim():'';
  const t=document.querySelector('.hintTarget');
  return JSON.stringify({on, say, 테:t?(t.id||(t.className||'').split(' ')[0]):null});})()`);
/* ★ 섞어서 누른다 — «요소»면 DOM click, «판 위 점»이면 진짜 마우스.
   ⚠ 3D 판(roomCanvas)은 DOM click 을 안 받는다. 실측: 「사람을 눌러 보세요」에서 80걸음을 섰다 */
const mouse=(t,x,y,b)=>page.send('Input.dispatchMouseEvent',{type:t,x:Math.round(x),y:Math.round(y),button:'left',buttons:b,clickCount:1});
const realTap=async(x,y)=>{await mouse('mouseMoved',x,y,0);await mouse('mousePressed',x,y,1);await sleep(80);await mouse('mouseReleased',x,y,0);await sleep(420);};
const clickHint = async () => {
  const info = await page.eval(`(()=>{const t=document.querySelector('.hintTarget');
    if(t){ const r=t.getBoundingClientRect();
      const canv = t.id==='roomCanvas' || t.tagName==='CANVAS';
      return JSON.stringify({kind:canv?'pt':'el', id:t.id||t.className.split(' ')[0],
        x:r.left+r.width/2, y:r.top+r.height/2}); }
    const d=document.getElementById('hintDim'); const hole=(d&&d.dataset.hole||'').split(',').map(Number);
    if(hole.length===3&&hole.every(Number.isFinite)) return JSON.stringify({kind:'pt',id:'(점)',x:hole[0],y:hole[1]});
    const h=document.getElementById('hint'); if(h){const r=h.getBoundingClientRect();
      return JSON.stringify({kind:'pt',id:'(말풍선)',x:r.left+r.width/2,y:r.top+r.height/2});}
    return 'null';})()`);
  if (info==='null') return 'none';
  const q=JSON.parse(info);
  if (q.kind==='el') { await page.eval(`(()=>{const t=document.querySelector('.hintTarget'); if(t)t.click();})()`,false); await sleep(420); return 'el:'+q.id; }
  await realTap(q.x,q.y); return 'pt:'+q.id;
};
const nextDay = () => page.eval(`(()=>{for(const id of ['mealGo','next']){const b=document.getElementById(id);
  if(b&&!b.disabled&&b.offsetParent!==null){b.click();return id;}}return 'none';})()`);
const day = () => page.eval(`String((window.__S&&window.__S().day)??'?')`);
const potAt = () => page.eval(`(()=>{try{const S=window.__S();
  const p=(S.pots||[])[0]; if(!p)return 'null';
  return JSON.stringify({slot:p.slotId||null, free:!!p.at});}catch(e){return 'ERR';}})()`);

await quiet();
console.log('── ㉠ 손가락을 «따라» 걷는다 · 「창턱」이 나올 때까지 ──');
let sill=false;
for (let i=0;i<80 && !sill;i++){
  const h=JSON.parse(await hint());
  if (h.on && /창턱/.test(h.say)) { sill=true; console.log(`★ [${i}] Day ${await day()} 창턱 안내 뜸: 「${h.say}」 테:${h.테}`); break; }
  if (h.on) { const r=await clickHint(); if(i%6===0) console.log(`  [${i}] Day ${await day()} 「${h.say.slice(0,26)}」 테:${h.테} → ${r}`); }
  else { const r=await nextDay(); if(r==='none') await sleep(500); }
  await sleep(320); await quiet();
}
if (!sill) { console.log('⛔ 창턱 안내를 못 만났다'); await page.close(); process.exit(3); }
console.log('그루 자리:', await potAt());
console.log('');
console.log('── ㉡ 이제 «안 따른다». 날만 보낸다 — 손가락이 붙어 있나 ──');
let gone=-1;
for (let d=0; d<DAYS; d++){
  const h=JSON.parse(await hint());
  const dd=await day();
  const still = h.on && /창턱|끌어|밝은/.test(h.say);
  if (d<6 || d%10===0 || (!still && gone<0))
    console.log(`  +${String(d).padStart(3)}일  Day ${String(dd).padStart(3)}  손가락 ${h.on?'켜짐':'⛔꺼짐'}  「${(h.say||'—').slice(0,30)}」  테:${h.테}`);
  if (!still && gone<0) { gone=d; console.log(`  ⛔ ★ 창턱 안내가 «사라졌다» — 버틴 지 ${d}일`); }
  const r=await nextDay();
  if (r==='none'){ await quiet(); await sleep(200); }
  await sleep(300);
  if (d%12===11) await quiet();
}
console.log('');
console.log('★ 결과: 창턱 안내 사라진 때 =', gone<0?'끝까지 «붙어 있었다»':(gone+'일 뒤'));
console.log('★ 마지막 그루 자리:', await potAt(), '· Day', await day());
console.log('★ 잎:', await page.eval(`(()=>{try{const l=window.__io.growth.leafState();
  return JSON.stringify({줄:l?l.length:0, 안떨어진:l?l.filter(r=>r&&!r.dropped).length:0});}catch(e){return 'ERR';}})()`));
await page.shot('docs/handoff/img/varie/stayfloor_end.png');
await page.close();
