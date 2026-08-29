/* tools/probe_leafpx.mjs — **방 화면에서 몬스테라 «잎 한 장»이 몇 px 인가** ([leaf] 청)
   ------------------------------------------------------------------
   ⚠ 「환산」이 아니라 «화면에서 잰» 값을 낸다 — 카메라에 투영해서 잎마다 테두리를 잡는다.
   잎은 `userData.part === 'leaf'` 이고 `axisKey` 로 «한 장»이 묶인다(plant_assemble §627).
   두 판을 다 잰다:
     ① 멀리서 — 방 화면 그대로(390×844)
     ② 당겨서 — `focusSlot` 으로 당긴 판(새순 당기기와 같은 자리)
   ⛔ 값은 안 바꾼다. */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8972';
const DAYS = +(process.env.BYEOT_DAYS || 45);
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
console.log('■ 세우기 —', await page.eval(`(()=>{ const S=window.__S(); S.pots=S.pots||[]; S.pots.length=0;
  S.pots.push({ id:'pot_a', itemId:'pot', plantId:'monstera', leafGrades:{}, leafGradesSeen:{},
    cuts:[], daysPlanted:0, fedDays:0, arrivedOnDay:S.day, wateredOnDay:S.day,
    arrivalGrowthDays:${DAYS}, dliHist:[], placedOnce:true, slotId:'banjiha-sill:0', at:null });
  try{ S.firstPlay.monstera.arrived=true; }catch(e){}
  window.__redraw();
  try{ const r=window.__io.growth.setGrowth(${DAYS}); window.__redraw(); return JSON.stringify(r); }
  catch(e){ return 'growth err '+e.message; } })()`));
await sleep(3500);

const LEAVES = `(()=>{ try{
  const rv=window.__rv, THREE=rv.THREE||window.THREE, cam=rv.three.cam;
  const r=document.getElementById('roomCanvas').getBoundingClientRect();
  let root=null; rv.three.scene.traverse(o=>{ if(!root && o.userData && o.userData.potId==='pot_a') root=o; });
  if(!root) return JSON.stringify({err:'root not found'});
  root.updateWorldMatrix(true,true);
  /* ★ 'leaf' 는 «Group» 에 붙어 있다 — 그 아래 메시를 모아 한 장을 만든다 */
  const leaves=[];
  root.traverse(o=>{ const u=o.userData||{}; if(u.part!=='leaf') return;
    let minx=1e9,maxx=-1e9,miny=1e9,maxy=-1e9,n=0;
    o.traverse(m=>{ if(!m.isMesh||!m.geometry) return; const g=m.geometry;
      if(!g.boundingBox) g.computeBoundingBox(); const bb=g.boundingBox;
      for(let i=0;i<8;i++){ const v=new THREE.Vector3(i&1?bb.max.x:bb.min.x, i&2?bb.max.y:bb.min.y, i&4?bb.max.z:bb.min.z);
        m.localToWorld(v); v.project(cam); n++;
        const x=(v.x*0.5+0.5)*r.width, y=(-v.y*0.5+0.5)*r.height;
        if(x<minx)minx=x; if(x>maxx)maxx=x; if(y<miny)miny=y; if(y>maxy)maxy=y; } });
    if(n) leaves.push({ key: String(u.axisKey!=null?u.axisKey:o.id),
      w:Math.round(maxx-minx), h:Math.round(maxy-miny) });
  });
  leaves.sort((a,b)=>(b.w*b.h)-(a.w*a.h));
  /* ★ 그루 전체도 같은 자로 재 둔다 — 견줘 보려고 */
  let ax=1e9,bx=-1e9,ay=1e9,by=-1e9,an=0;
  root.traverse(m=>{ if(!m.isMesh||!m.geometry) return; const g=m.geometry;
    if(!g.boundingBox) g.computeBoundingBox(); const bb=g.boundingBox;
    for(let i=0;i<8;i++){ const v=new THREE.Vector3(i&1?bb.max.x:bb.min.x, i&2?bb.max.y:bb.min.y, i&4?bb.max.z:bb.min.z);
      m.localToWorld(v); v.project(cam); an++;
      const x=(v.x*0.5+0.5)*r.width, y=(-v.y*0.5+0.5)*r.height;
      if(x<ax)ax=x; if(x>bx)bx=x; if(y<ay)ay=y; if(y>by)by=y; } });
  return JSON.stringify({ count:leaves.length, leaves,
    rootLeaves: root.userData.leaves, whole: an? (Math.round(bx-ax)+'x'+Math.round(by-ay)) : '-' });
} catch(e){ return JSON.stringify({err:e.message}); } })()`;

console.log('TREE —', await page.eval(`(()=>{ try{
  const rv=window.__rv; let root=null;
  rv.three.scene.traverse(o=>{ if(!root && o.userData && o.userData.potId==='pot_a') root=o; });
  if(!root) return 'root not found';
  let mesh=0, node=0; const keys=new Set(), parts=new Set();
  root.traverse(o=>{ node++; if(o.isMesh) mesh++;
    for(const k of Object.keys(o.userData||{})) keys.add(k);
    if(o.userData && o.userData.part) parts.add(String(o.userData.part)); });
  return JSON.stringify({ nodes:node, meshes:mesh, keys:[...keys].slice(0,16), parts:[...parts] });
}catch(e){ return 'err '+e.message; } })()`));
console.log('\n=== ① 멀리서 — 방 화면 그대로 (390×844) ===');
console.log(' ', await page.eval(LEAVES));
console.log('\n=== ② 당겨서 — focusSlot (새순 당기기와 같은 자리) ===');
await page.eval(`(()=>{ try{ window.__rv.focusSlot('banjiha-sill:0', true); }catch(e){} })()`, false);
await sleep(2000);
console.log(' ', await page.eval(LEAVES));
await page.eval(`(()=>{ try{ window.__rv.focusSlot(null, true); }catch(e){} })()`, false);
await page.close(); clearTimeout(wd);
