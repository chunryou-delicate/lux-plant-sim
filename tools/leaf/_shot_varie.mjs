/* tools/leaf/_shot_varie.mjs — **무늬가 «게임 화면»에 뜨나** 를 찍는다
   ------------------------------------------------------------------
   ⚠ 방 데모(varie_room/*.png)에서는 난다. 그런데 그건 데모지 게임이 아니다.
   ⇒ 여기서는 «게임»을 열고, 그루가 생긴 뒤 그 잎 등급을 무늬로 바꿔 다시 짓게 하고 찍는다.
   ⛔ 밸런스 값은 안 건드린다. 저장도 안 한다 — 화면에 «그려지나»만 본다. */
import { launch, sleep } from '../test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 560000); wd.unref?.();
const page = await launch({ width: 390, height: 844, dpr: 2 });
await page.goto(`${BASE}/game.html`);
await page.eval('localStorage.clear()', false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 150000, 300);
await sleep(6000);
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
/* 그루가 «잎을 갖고 방에 놓일» 때까지 걷는다 */
/* ★ 잎은 그루가 아니라 «생장 엔진»에 산다 — io.growth.leafState() 가 정본이다 */
const potState = () => page.eval(`(()=>{ try{ const S=window.__S();
  const at=(S.pots||[]).some(p=>p&&(p.at||p.slotId));
  let ls=null; try{ ls=window.__io.growth.leafState(); }catch(e){}
  return JSON.stringify({day:S.day, 놓임:at, 잎줄:ls?ls.length:null,
    무늬:ls?ls.filter(r=>r&&r.varie).length:null}); }catch(e){return 'ERR '+e.message;} })()`);
await quiet();
let ok=null;
for (let i=0;i<60 && !ok;i++){
  const st=JSON.parse(await potState().catch(()=> '{"pots":[]}'));
  if (st.놓임 && (st.잎줄||0) >= 1) { ok=st; console.log('★ 찾았다', JSON.stringify(st)); break; }
  if (i%8===0) console.log('  %d걸음 %s', i, JSON.stringify(st));
  const f=await finger();
  if (f!=='null'){ const q=JSON.parse(f); await tap(q.x,q.y); }
  else {
    const n=await page.eval(`(()=>{const b=document.getElementById('mealGo')||document.getElementById('next');
      if(!b||b.disabled)return 'null'; const r=b.getBoundingClientRect();
      return JSON.stringify({x:r.left+r.width/2,y:r.top+r.height/2});})()`);
    if(n==='null'){ await sleep(800); } else { const q=JSON.parse(n); await tap(q.x,q.y); }
  }
  await quiet();
}
if(!ok){ console.log('⛔ 잎 두 줄 이상인 그루가 방에 안 놓였다'); await page.close(); process.exit(3); }
/* ★ 놓기 창이 떠 있으면 «화분을 가린다». 확인을 눌러 닫고, 시트도 닫는다 */
const clearUI = async () => {
  for (let k=0;k<12;k++){
    const hit = await page.eval(`(()=>{
      const t=[...document.querySelectorAll('button')].filter(b=>{
        const r=b.getBoundingClientRect(); if(r.width<8||r.height<8) return false;
        const s=(b.textContent||'').trim();
        return /^확인$/.test(s)||/^닫기$/.test(s)||b.id==='placeOk'||b.id==='sheetClose'||/^×$/.test(s);
      });
      if(!t.length) return 'null';
      const r=t[0].getBoundingClientRect();
      return JSON.stringify({x:r.left+r.width/2,y:r.top+r.height/2,ko:(t[0].textContent||t[0].id).trim().slice(0,8)});
    })()`);
    if (hit==='null') break;
    const q=JSON.parse(hit); console.log('   닫는다:',q.ko); await tap(q.x,q.y); await quiet();
  }
  await page.eval(`(()=>{const h=document.getElementById('hint'); if(h)h.classList.remove('on');
    const d=document.getElementById('hintDim'); if(d)d.style.display='none';
    for(const id of ['sheet','detail','mark','hint']){const e=document.getElementById(id); if(e&&e.classList.contains('on'))e.classList.remove('on');}
    document.querySelectorAll('.mark').forEach(e=>e.style.display='none');})()`,false);
  await sleep(900);
};
await clearUI();
/* ★★ 날을 보낸다 — Day 11 몬스테라는 «잎이 없다»(찍어서 확인했다). 잎이 날 때까지 넘긴다 */
const leafRows = () => page.eval(`(()=>{ try{ const l=window.__io.growth.leafState();
  const S=window.__S(); return JSON.stringify({day:S.day, 줄:l?l.length:0,
    안떨어진:l?l.filter(r=>r&&!r.dropped).length:0, 성숙:l?l.filter(r=>r&&r.matured).length:0});
 }catch(e){return '{"day":-1,"줄":0}';} })()`);
const nextDay = () => page.eval(`(()=>{ for(const id of ['mealGo','next']){ const b=document.getElementById(id);
  if(b && !b.disabled && b.offsetParent!==null){ b.click(); return id; } } return 'none'; })()`);
let last=null;
for (let day=0; day<220; day++){
  const st=JSON.parse(await leafRows());
  last=st;
  if (st.안떨어진 >= 3) { console.log('★ 잎이 났다', JSON.stringify(st)); break; }
  if (day%20===0) console.log('   날 보냄 %s', JSON.stringify(st));
  const r=await nextDay();
  if (r==='none'){ await clearUI(); await sleep(300); }
  await sleep(420);
  if (day%12===11) await clearUI();
}
console.log('마지막:', JSON.stringify(last));
await clearUI();
/* 그루가 화면 어디 있나 — 자리를 적어 둔다(나중에 그 자리만 확대한다) */
const where = await page.eval(`(()=>{ try{
  const rv=window.__rv; if(!rv||!rv.potScreenPos) return 'no-api';
  return JSON.stringify(rv.potScreenPos());
}catch(e){return 'ERR '+e.message;} })()`);
console.log('그루 자리:', where);
await page.shot('docs/handoff/img/varie/varie_game_plain.png');
console.log('찍음: 무지');
/* ★ 생장 엔진이 내는 잎 줄에 «무늬»를 얹는다 — 방이 그 줄을 보고 그리는지가 물음이다 */
const set = await page.eval(`(()=>{ try{ const g=window.__io.growth; const orig=g.leafState.bind(g);
  const G=['sanban','halfmoon','fullmoon'];
  g.leafState = (o)=>{ const r=orig(o); if(!Array.isArray(r)) return r;
    return r.map((x,i)=> x && !x.dropped ? {...x, varie:true, grade:G[i%3]} : x); };
  const now=g.leafState();
  return JSON.stringify({줄:now.length, 무늬:now.filter(x=>x.varie).length,
    등급:now.map(x=>x.grade).slice(0,6)});
 }catch(e){return 'ERR '+e.message;} })()`);
console.log('먹인 등급:', set);
/* 다시 그리게 한다 — 방은 leafState 가 바뀌면 스스로 다시 짓는다(room_view §3079) */
await page.eval(`(()=>{ try{ if(typeof window.__redraw==='function') window.__redraw();
  if(window.__rv&&window.__rv.refresh) window.__rv.refresh(); }catch(e){} })()`,false);
await sleep(12000);
await clearUI();
console.log('무늬 알림 떴나:', await page.eval(`(()=>{const t=[...document.querySelectorAll('div,span')]
  .map(e=>e.textContent||'').find(t=>/무늬 잎을 받는 중/.test(t)); return t?'예':'아니오';})()`));
await page.shot('docs/handoff/img/varie/varie_game_after1.png');
await sleep(9000);
await page.shot('docs/handoff/img/varie/varie_game_after2.png');
console.log('경고:', await page.eval(`JSON.stringify((window.__errs||[]).slice(-6))`).catch(()=>'-'));
await page.close();
