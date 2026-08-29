/* tools/probe_leafpixels.mjs — **창턱 그루의 잎 화소를 [leaf] 가 잴 수 있게 «판을 짜 준다»**
   ------------------------------------------------------------------
   [leaf] 청: 창턱 자리 잎 한 장의 «휘도비». 그쪽이 쓰던 판은 잎 화소가 «51개»뿐이었다.
   ⇒ ★ 여기서는 «멀리서»와 «당겨서» 두 판을 찍고, 잎마다 «화면 테두리»를 함께 낸다.
     ⇒ ⇒ 그러면 그쪽이 그 네모만 잘라 재면 된다. 자는 그쪽에 있다(㊷ — 자를 두 벌 만들지 않는다).
   ★ 「둘레(배경)」도 같이 낸다 — 그쪽 예측의 «방향»이 배경 휘도로 갈린다.
   ⛔ 값은 안 바꾼다. 화면만 찍는다. */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8972';
const DAYS = +(process.env.BYEOT_DAYS || 165);      /* 잎3 leaf_mid 한가운데 */
const OUT = 'docs/handoff/img/leafpx';
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 400000);
wd.unref && wd.unref();
const page = await launch({ width: 390, height: 844, dpr: 1 });
await page.goto(`${BASE}/game.html`);
await page.eval('localStorage.clear()', false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 150000, 300);
await sleep(5000);
for (let i = 0; i < 40; i++) {
  const b = await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');
    return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`);
  if (b !== 'true') break;
  await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s)s.click();
    const x=document.getElementById('dlgBox'); if(x)x.click();
    const g=document.getElementById('guideClose'); if(g)g.click();})()`, false);
  await sleep(250);
}
console.log('■ 세우기 — 창턱 · 낮 · 맑음 · 카메라 밑값');
await page.eval(`(()=>{ const S=window.__S(); S.pots=S.pots||[]; S.pots.length=0;
  S.pots.push({ id:'pot_a', itemId:'pot', plantId:'monstera', leafGrades:{}, leafGradesSeen:{},
    cuts:[], daysPlanted:0, fedDays:0, arrivedOnDay:S.day, wateredOnDay:S.day,
    arrivalGrowthDays:${DAYS}, dliHist:[], placedOnce:true, slotId:'banjiha-sill:0', at:null });
  try{ S.firstPlay.monstera.arrived=true; }catch(e){}
  window.__redraw();
  try{ window.__io.growth.setGrowth(${DAYS}); window.__redraw(); }catch(e){} })()`, false);
await sleep(3500);
console.log('  판 —', await page.eval(`(()=>{ const S=window.__S();
  return JSON.stringify({ 날씨:(S.sim||{}).weather, 계절:(S.sim||{}).season, 등:(S.lamps||{}).count,
    자리:(S.pots[0]||{}).slotId, 생장:${DAYS} }); })()`));

/* 잎마다 «화면 테두리» — [leaf] 가 그 네모만 잘라 재면 된다 */
const BOXES = `(()=>{ try{
  const rv=window.__rv, THREE=rv.THREE||window.THREE, cam=rv.three.cam;
  const r=document.getElementById('roomCanvas').getBoundingClientRect();
  let root=null; rv.three.scene.traverse(o=>{ if(!root && o.userData && o.userData.potId==='pot_a') root=o; });
  if(!root) return JSON.stringify({err:'root not found'});
  root.updateWorldMatrix(true,true);
  const out=[];
  root.traverse(o=>{ const u=o.userData||{}; if(u.part!=='leaf') return;
    let minx=1e9,maxx=-1e9,miny=1e9,maxy=-1e9,n=0;
    o.traverse(m=>{ if(!m.isMesh||!m.geometry) return; const g=m.geometry;
      if(!g.boundingBox) g.computeBoundingBox(); const bb=g.boundingBox;
      for(let i=0;i<8;i++){ const v=new THREE.Vector3(i&1?bb.max.x:bb.min.x, i&2?bb.max.y:bb.min.y, i&4?bb.max.z:bb.min.z);
        m.localToWorld(v); v.project(cam); n++;
        const x=r.left+(v.x*0.5+0.5)*r.width, y=r.top+(-v.y*0.5+0.5)*r.height;
        if(x<minx)minx=x; if(x>maxx)maxx=x; if(y<miny)miny=y; if(y>maxy)maxy=y; } });
    if(n) out.push({ leaf:String(u.axisKey!=null?u.axisKey:o.id),
      x:Math.round(minx), y:Math.round(miny), w:Math.round(maxx-minx), h:Math.round(maxy-miny) });
  });
  out.sort((a,b)=>(b.w*b.h)-(a.w*a.h));
  return JSON.stringify({ canvas:{x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height)},
    leaves: out, 그루: { varieLeafKeys: root.userData.varieLeafKeys || null,
      growthDays: root.userData.growthDays ?? null, seed: root.userData.seed ?? null,
      band: root.userData.band ?? null } });
} catch(e){ return JSON.stringify({err:e.message}); } })()`;

console.log('');
console.log('=== ① 멀리서 — 방 화면 그대로 ===');
console.log(' ', await page.eval(BOXES));
console.log('  찍음 —', await page.shot(`${OUT}/sill_far_g${DAYS}.png`));
console.log('');
console.log('=== ② 당겨서 — focusSlot (새순 당기기와 같은 자리) ===');
await page.eval(`(()=>{ try{ window.__rv.focusSlot('banjiha-sill:0', true); }catch(e){} })()`, false);
await sleep(2500);
console.log(' ', await page.eval(BOXES));
console.log('  찍음 —', await page.shot(`${OUT}/sill_near_g${DAYS}.png`));
await page.eval(`(()=>{ try{ window.__rv.focusSlot(null, true); }catch(e){} })()`, false);
console.log('');
console.log('■ dpr 1 이라 화면 좌표 = 그림 화소다. 위 네모를 그대로 잘라 쓰면 된다.');
await page.close(); clearTimeout(wd);
