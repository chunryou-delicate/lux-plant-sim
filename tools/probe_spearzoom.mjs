/* tools/probe_spearzoom.mjs — **말린 새순이 선 순간 화면이 «당겨졌다가 돌아오나»** (박사님 C4 ⓑ)
   ⚠ `focusSlot` 은 화면이 «한 번도 안 쓰던» 창구다 — 되돌아가는 손짓이 없으므로
     «스스로 돌아오는지»가 이 자의 핵심이다. 안 돌아오면 사람이 방에 갇힌다.
   재는 것: 카메라 자리가 ① 당기기 전 ② 당긴 뒤 ③ 머문 뒤 — 셋이 어떻게 갈리나
   ⛔ 값은 안 바꾼다. */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8972';
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
await page.eval(`(()=>{ const S=window.__S(); S.pots=S.pots||[]; S.pots.length=0;
  S.pots.push({ id:'pot_a', itemId:'pot', plantId:'monstera', leafGrades:{}, leafGradesSeen:{},
    cuts:[], daysPlanted:0, fedDays:0, arrivedOnDay:S.day, wateredOnDay:S.day,
    arrivalGrowthDays:45, dliHist:[], placedOnce:true, slotId:'banjiha-sill:0', at:null });
  try{ S.firstPlay.monstera.arrived=true; S.firstPlay.completed=true; }catch(e){}
  window.__redraw(); })()`, false);
await sleep(2500);
const cam = () => page.eval(`(()=>{ try{ const c=window.__rv.three.cam;
  return JSON.stringify({ x:+c.position.x.toFixed(2), y:+c.position.y.toFixed(2), z:+c.position.z.toFixed(2) });
} catch(e){ try{ const t=window.__rv.three; return 'three 열쇠: '+Object.keys(t||{}).slice(0,8).join(','); }
  catch(x){ return 'err '+e.message; } } })()`);
const sizeOnScreen = () => page.eval(`(()=>{ try{ const rv=window.__rv, THREE=rv.THREE||window.THREE;
  const cm=rv.three.cam, r=document.getElementById('roomCanvas').getBoundingClientRect();
  let root=null; rv.three.scene.traverse(o=>{ if(!root && o.userData && (o.userData.potId==='pot_a')) root=o; });
  if(!root) return '그루를 못 찾음';
  let minx=1e9,maxx=-1e9,miny=1e9,maxy=-1e9,n=0;
  root.updateWorldMatrix(true,true);
  root.traverse(o=>{ if(!o.isMesh||!o.geometry) return; const g=o.geometry;
    if(!g.boundingBox) g.computeBoundingBox(); const bb=g.boundingBox;
    for(let i=0;i<8;i++){ const v=new THREE.Vector3(i&1?bb.max.x:bb.min.x, i&2?bb.max.y:bb.min.y, i&4?bb.max.z:bb.min.z);
      o.localToWorld(v); v.project(cm); n++;
      const x=(v.x*0.5+0.5)*r.width, y=(-v.y*0.5+0.5)*r.height;
      if(x<minx)minx=x; if(x>maxx)maxx=x; if(y<miny)miny=y; if(y>maxy)maxy=y; } });
  return n? Math.round(maxx-minx)+' x '+Math.round(maxy-miny)+' px' : '메시 없음';
}catch(e){ return 'err '+e.message; } })()`);

console.log('=== ① 당기기 전 ===');
console.log('  카메라 —', await cam(), '· 그루 크기 —', await sizeOnScreen());
console.log('\n=== ② 「말린 새순」 턴 사건을 넣고 화면에 알린다 ===');
console.log('  ', await page.eval(`(()=>{ try{
  window.__byeotShowFP ? window.__byeotShowFP() : null;
  return 'hook 없음 — 아래에서 showFirstPlayEvents 를 직접 못 부른다';
}catch(e){ return 'err '+e.message; } })()`));
await page.eval(`(()=>{ try{ window.__focusSpear && window.__focusSpear(); }catch(e){} })()`, false);
await sleep(1500);
console.log('  당긴 뒤 카메라 —', await cam(), '· 그루 크기 —', await sizeOnScreen());
await sleep(4200);
console.log('\n=== ③ 머문 뒤 — 스스로 돌아오나 ===');
console.log('  카메라 —', await cam(), '· 그루 크기 —', await sizeOnScreen());
await page.close(); clearTimeout(wd);
