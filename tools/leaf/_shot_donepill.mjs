/* tools/leaf/_shot_donepill.mjs — **고쳐진 알약을 «찍어서» 잰다**
   ------------------------------------------------------------------
   [core] 가 9685e8d 로 `#waterCrop.done,#waterPot.done` 를 고쳤다
     (반투명 흰 글 --dim → 어두운 잉크 #0d2a33 + 옅은 흰 알약).
   ⚠ 나는 그것을 «코드 색으로 계산»만 했다. 화면에서 잰 적이 없다.
   ⇒ 여기서는 **억지로 세우지 않는다** — 손가락을 따라 걸어서
     `.done` 이 «저절로» 뜬 판을 찍는다. 그래야 뒤에 깔린 방이 진짜다.
   ⛔ 값은 아무것도 안 바꾼다. 찍기만 한다. */
import { launch, sleep } from '../test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const W = Number(process.env.W || 390), H = Number(process.env.H || 844);
const OUT = process.env.OUT || 'docs/handoff/img/phoneeye/donepill_shot.png';
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 540000); wd.unref?.();

const page = await launch({ width: W, height: H, dpr: 2 });
await page.goto(`${BASE}/game.html`);
await page.eval('localStorage.clear()', false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 150000, 300);
await sleep(6000);

const mouse = (type, x, y, buttons) => page.send('Input.dispatchMouseEvent',
  { type, x: Math.round(x), y: Math.round(y), button: 'left', buttons, clickCount: 1 });
const tap = async (x, y) => {
  await mouse('mouseMoved', x, y, 0); await mouse('mousePressed', x, y, 1);
  await sleep(70); await mouse('mouseReleased', x, y, 0); await sleep(700);
};
const clearDlg = async () => {
  for (let i = 0; i < 40; i++) {
    if (await page.eval(`String(document.getElementById('stage').classList.contains('talking'))`) !== 'true') return;
    await page.eval(`(()=>{const x=document.getElementById('dlgBox'); if(x)x.click();})()`, false);
    await sleep(200);
  }
};
const quiet = async () => { for (let i = 0; i < 3; i++) { await clearDlg(); await sleep(500); } };
const finger = () => page.eval(`(()=>{const h=document.getElementById('hint');
  if(!h||!h.classList.contains('on'))return 'null';
  const r=h.getBoundingClientRect(), t=document.querySelector('.hintTarget');
  const tr=t?t.getBoundingClientRect():null;
  const d=document.getElementById('hintDim'), hole=(d&&d.dataset.hole||'').split(',').map(Number);
  const at = tr&&tr.width ? {x:tr.left+tr.width/2,y:tr.top+tr.height/2}
     : (hole.length===3&&hole.every(Number.isFinite)) ? {x:hole[0],y:hole[1]}
     : {x:r.left+r.width/2,y:r.top+r.height/2};
  return JSON.stringify({x:at.x,y:at.y,짚는것:t?(t.id||(t.className||'').split(' ')[0]):'(점)'});})()`);
/* ★ 「.done 알약이 «보이나»」 — 이것이 멈추는 조건이다 */
const donePill = () => page.eval(`(()=>{ const out=[]; const WHY=(window.__why=[]);
  for (const id of ['waterCrop','waterPot']) { const b=document.getElementById(id);
    if(!b)continue;
    const r=b.getBoundingClientRect(); const cs=getComputedStyle(b);
    if(!b.classList.contains('done')){ if(WHY)WHY.push(id+':done아님('+(cs.display==='none'?'숨김':'보임')+')'); continue; }
    if(r.width<10||r.height<10){ if(WHY)WHY.push(id+':크기0'); continue; }
    if(cs.display==='none'||cs.visibility==='hidden'){ if(WHY)WHY.push(id+':done인데 숨김'); continue; }
    if(+cs.opacity<0.05){ if(WHY)WHY.push(id+':done인데 거의 안 보임'); continue; }
    out.push({id,x:r.left,y:r.top,w:r.width,h:r.height,말:(b.textContent||'').trim(),
              색:cs.color, 바탕:cs.backgroundColor, 흐림:cs.opacity,
              잠김:b.disabled}); }
  return JSON.stringify(out); })()`);

await quiet();
let found = null;
for (let step = 0; step < 60 && !found; step++) {
  const d = JSON.parse(await donePill());
  if (d.length) { found = d; break; }
  const why = await page.eval(`JSON.stringify(window.__why||[])`);
  const day = await page.eval(`String((window.__S&&window.__S().day)??'?')`);
  const f = await finger();
  if (f === 'null') {                       // 손가락이 없으면 [다음 날]을 스스로 누른다
    const n = await page.eval(`(()=>{const b=document.getElementById('mealGo')||document.getElementById('next');
      if(!b||b.disabled)return 'null'; const r=b.getBoundingClientRect();
      return JSON.stringify({x:r.left+r.width/2,y:r.top+r.height/2});})()`);
    if (n === 'null') { await sleep(800); continue; }
    const p = JSON.parse(n); await tap(p.x, p.y);
  } else { const p = JSON.parse(f); await tap(p.x, p.y); }
  await quiet();
  console.log('  %s걸음 Day %s | %s | 손가락 %s', String(step).padStart(2), day,
    JSON.parse(why).join(' · ')||'(알약 없음)',
    f==='null'?'없음':JSON.parse(f).짚는것);
}
console.log('');
if (!found) { console.log('⛔ .done 알약이 안 떴다 — 못 찍는다'); await page.close(); process.exit(3); }
const day = await page.eval(`String((window.__S&&window.__S().day)??'?')`);
console.log('★ 찍는다 · Day', day, '·', JSON.stringify(found));
await page.eval(`(()=>{const h=document.getElementById('hint'); if(h)h.classList.remove('on');
  const d=document.getElementById('hintDim'); if(d)d.style.display='none';})()`, false);
await sleep(400);
await page.shot(OUT);
console.log('BOX', JSON.stringify({ dpr: 2, day, pills: found }));
await page.close();
