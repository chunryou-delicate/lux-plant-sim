/* ⛔⛔ 2026-08-28 **이 자는 믿지 말 것.** 씨점 하나에서 사방으로 걸어 재는데,
   씨점이 «안 먹는» 점이어도 그것을 안 묻고 걸어 **못 쓸 수를 낸다**(그루를 45일로
   세우자 그렇게 됐다). ⇒ ★ 대신 **`probe_pottap_map.mjs`** 를 썼라 — 격자를 통째로
   훑어 먹는 점을 모두 모은다. 이 파일은 «왜 그 자가 틀렸는가»의 기록으로만 남긴다. */
/* tools/probe_pottap_box.mjs — **방 안 화분의 «손가락 과녁»이 얼마나 큰가**
   probe_roomtap_split 실측: screenPosOf 가 준 (282,465) 는 «안 먹고», (273,482) 는 «먹는다».
   ⇒ 과녁이 작다는 뜻이다. 얼마나 작은지 «재서» 낸다 — 사람 손가락(권장 44px)과 견준다. */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8972';
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 480000);
wd.unref && wd.unref();
const page = await launch({ width: 390, height: 844, dpr: 1 });
try { await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 }); } catch {}
await page.goto(`${BASE}/game.html`);
await page.eval('localStorage.clear()', false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 150000, 300);
await sleep(5000);
for (let i = 0; i < 40; i++) {
  const busy = await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');
    return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`);
  if (busy !== 'true') break;
  await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s)s.click();
    const b=document.getElementById('dlgBox'); if(b)b.click();
    const g=document.getElementById('guideClose'); if(g)g.click();})()`, false);
  await sleep(250);
}
await page.eval(`(()=>{ const S=window.__S(); S.pots=S.pots||[];
  let p=S.pots[0];
  if(!p){ p={ id:'pot_probe', itemId:'pot', plantId:'monstera', leafGrades:{}, leafGradesSeen:{},
              cuts:[], daysPlanted:0, fedDays:0, arrivedOnDay:S.day, wateredOnDay:S.day,
              arrivalGrowthDays:0, dliHist:[] }; S.pots.push(p); }
  p.placedOnce=true; p.slotId='banjiha-desk:0'; p.at=null; window.__redraw(); })()`, false);
await sleep(2000);
/* ★★ 그루를 «실제 도착 나이»로 세운다 — ARRIVAL.growthDays = 45.
   ⚠ 0 으로 두면 싹이 그려져 과녁이 실제보다 «작게» 나온다. */
console.log('■ 45일로 세우기 —', await page.eval(`(()=>{ try{
  const g = window.__io && window.__io.growth; if(!g) return 'io.growth 없음';
  if (typeof g.setGrowth !== 'function') return 'setGrowth 없음 — ' + Object.keys(g).slice(0,14).join(',');
  const r = g.setGrowth(45); window.__redraw();
  return 'ok ' + JSON.stringify(r && r.leaves ? { leaves: r.leaves.length } : (r||{})).slice(0,80);
} catch(e){ return 'err '+e.message; } })()`));
await sleep(2500);
/* 그려진 식물의 «화면 파인 틀» — 보이는 크기와 과녁을 건줌다 */
console.log('■ 그려진 크기 —', await page.eval(`(()=>{ try{
  const rv=window.__rv, THREE=rv.THREE||window.THREE; const cam=rv.three.camera;
  let root=null; rv.three.scene.traverse(o=>{ if(!root && o.userData && o.userData.slotId==='banjiha-desk:0') root=o; });
  if(!root) return '그 자리의 물건을 못 찾음';
  const r=document.getElementById('roomCanvas').getBoundingClientRect();
  let minx=1e9,maxx=-1e9,miny=1e9,maxy=-1e9,n=0;
  root.updateWorldMatrix(true,true);
  root.traverse(o=>{ if(!o.isMesh||!o.geometry) return; const g=o.geometry;
    if(!g.boundingBox) g.computeBoundingBox(); const bb=g.boundingBox;
    for(let i=0;i<8;i++){ const v=new THREE.Vector3(i&1?bb.max.x:bb.min.x, i&2?bb.max.y:bb.min.y, i&4?bb.max.z:bb.min.z);
      o.localToWorld(v); v.project(cam); n++;
      const x=r.left+(v.x*0.5+0.5)*r.width, y=r.top+(-v.y*0.5+0.5)*r.height;
      if(x<minx)minx=x; if(x>maxx)maxx=x; if(y<miny)miny=y; if(y>maxy)maxy=y; } });
  if(!n) return '메시가 없다';
  return JSON.stringify({ 가로:Math.round(maxx-minx), 세로:Math.round(maxy-miny),
    x:Math.round((minx+maxx)/2), y:Math.round((miny+maxy)/2) });
} catch(e){ return 'err '+e.message; } })()`));

const tap = async (x, y) => {
  await page.eval(`(()=>{ try{ window.__picked.clear(); }catch(e){} })()`, false);
  await page.send('Input.dispatchTouchEvent', { type: 'touchStart',
    touchPoints: [{ x, y, radiusX: 12, radiusY: 12, force: 1, id: 1 }] });
  await sleep(50);
  await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(230);
  return (await page.eval(`(()=>{ const pk=window.__picked||{}; return pk.slotId||''; })()`)) === 'banjiha-desk:0';
};

const C = { x: 273, y: 482 };
console.log('■ 씨점 (273,482) 먹나 —', await tap(C.x, C.y));
/* 좌·우·위·아래로 한 칸(4px)씩 밀어 «끝»을 찾는다 */
const edge = async (dx, dy) => { let k = 0;
  for (; k < 40; k++) { const ok = await tap(C.x + dx * (k + 1) * 4, C.y + dy * (k + 1) * 4); if (!ok) break; }
  return (k + 1) * 4; };
const L = await edge(-1, 0), R = await edge(1, 0), U = await edge(0, -1), D = await edge(0, 1);
console.log(`■ 과녁 — 왼 ${L}px · 오른 ${R}px · 위 ${U}px · 아래 ${D}px`);
console.log(`■ ⇒ 가로 «${L + R}px» × 세로 «${U + D}px»  (폰 폭 390 · 권장 손가락 과녁 44)`);
await page.close(); clearTimeout(wd);
