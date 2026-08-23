/* ============================================================
   tools/probe_slot_cell.mjs — **자리가 «칸» 한가운데에 앉나** (house 소유)
   ------------------------------------------------------------
   ★ 2026-08-23 승격. 원래 이름은 `_probe_tiercell.mjs` 였고 **미추적 임시 도구**였다.
     그런데 `docs/engine/slot_cell_align.md`(정본)가 «잰 자는 여기 있다»로 이 파일을
     가리키고 있었다. ⇒ **정본이 없는 파일을 증거로 대고 있었다.** 그래서 실재하게 만든다.

   무엇을 재나 — 화면이 쓰는 것과 «같은 자»로, 추천 자리가 칸 한가운데에 앉는지.
     `room_view` 의 `tierRectOf` / `meshRect` / `surfaceAxis` 를 그대로 옮겨 적었다.

   ⚠⚠ **「가구 발자국」(built.occluders)으로 재면 안 된다.** 화면은 발자국이 아니라
     **광선이 맞은 판때기**로 칸을 그린다. 책장은 밑단이 통짜(1.00)고 위 단은 측판 사이(0.93)라
     **한 가구 안에서 자가 다르다.** 발자국 하나로 재면 답이 통째로 틀린다 —
     실제로 「34칸 중 16칸」이 나왔고, 제대로 재니 **325칸 중 137칸**이었다.
   ⚠ 헤드리스에서는 `root.updateMatrixWorld(true)` 를 **먼저 불러야** 한다.
     안 부르면 광선이 가구를 다 놓치고 바닥을 맞는다(315/325 가 그렇게 나왔다).

     node tools/probe_slot_cell.mjs
============================================================ */
import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataOf = r => JSON.parse(fs.readFileSync(path.join(ROOT,'data',r),'utf8'));
const stubCtx = () => new Proxy({}, { get: (t,k) => {
  if (k==='createImageData'||k==='getImageData') return (w=1,h=1)=>({data:new Uint8ClampedArray(Math.max(1,w*h*4)),width:w,height:h});
  if (k==='createLinearGradient'||k==='createRadialGradient') return ()=>({addColorStop(){}});
  if (k==='measureText') return ()=>({width:0});
  return ()=>{}; } });
const stubEl = () => ({ style:{}, dataset:{}, appendChild(){}, setAttribute(){}, getContext:()=>stubCtx(), width:0, height:0 });
globalThis.document = { createElement: stubEl, body: stubEl(), getElementById: ()=>stubEl() };
globalThis.window = globalThis;
vm.runInThisContext(fs.readFileSync(path.join(ROOT,'vendor/three/three.min.js'),'utf8'));
const { createLightEngine } = await import(pathToFileURL(path.join(ROOT,'src/game/light_adapter.js')).href);
const HOUSE = dataOf('house_rooms.json'), TH = dataOf('balance/light_thresholds.json');
const mk = mutate => { const hr = JSON.parse(JSON.stringify(HOUSE)); mutate(hr);
  return createLightEngine({ houseRooms:hr, winPresets:dataOf('window_presets.json').presets,
    doorPresets:dataOf('door_presets.json').presets, finishes:dataOf('room_finishes.json'),
    furnPresets:dataOf('furniture_presets.json').presets, lightPresets:dataOf('lighting_presets.json'),
    shadePresets:dataOf('shading_presets.json'), lightTh:TH, weatherBalance:dataOf('balance/weather.json') }); };
const SKY = { weather:'clear', season:'summer' };
const read = eng => { const r = eng.build('banjiha');
  return r.slots.map(s => { eng.clearCache(); return [s.slotId, +eng.dliOfSlot(s.slotId,{...SKY,lampCount:2}).toFixed(4)]; }); };


/* ★ 화면과 **같은 자**로 잰다 — room_view 의 tierRectOf/meshRect/surfaceAxis 를 그대로 옮겼다.
   ⚠ 「가구 발자국(occluders)」으로 재면 안 된다. 선반은 단마다 판때기가 다르다 —
     밑단은 통짜(1.00), 중간단은 측판 사이(0.93)다. 발자국 하나로 재면 절반이 거짓 실패다. */
const TOP_CELL = 0.25, POT = 0.24, GOVERN = 0.04;
const surfaceAxis = (len, potD) => {
  const L = Number.isFinite(len) && len>0 ? len : TOP_CELL;
  let n = Math.max(1, Math.round(L/TOP_CELL));
  if (potD>0) n = Math.min(n, Math.max(1, Math.floor(L/potD + 1e-9)));
  return { n, cell:L/n, at:i=>(i+0.5)*(L/n)-L/2 };
};
const _nmat=new THREE.Matrix3(), _nrm=new THREE.Vector3();
const _wp=new THREE.Vector3(), _wq=new THREE.Quaternion(), _ws=new THREE.Vector3(), _weu=new THREE.Euler();
const meshRect = obj => {
  if(!obj.geometry) return null;
  if(!obj.geometry.boundingBox) obj.geometry.computeBoundingBox();
  const bb=obj.geometry.boundingBox;
  obj.updateWorldMatrix(true,false); obj.matrixWorld.decompose(_wp,_wq,_ws);
  _weu.setFromQuaternion(_wq,'YXZ');
  const rot=_weu.y, c=Math.cos(rot), s=Math.sin(rot);
  const cu=(bb.max.x+bb.min.x)/2*_ws.x, cv=(bb.max.z+bb.min.z)/2*_ws.z;
  return { x:_wp.x+cu*c+cv*s, z:_wp.z-cu*s+cv*c,
           w:(bb.max.x-bb.min.x)*Math.abs(_ws.x), d:(bb.max.z-bb.min.z)*Math.abs(_ws.z), rot };
};
const ray = new THREE.Raycaster();
const DOWN = new THREE.Vector3(0,-1,0);
const tierRectOf = (root, s) => {
  ray.set(new THREE.Vector3(s.x, s.y+0.12, s.z), DOWN);
  ray.near=0; ray.far=0.26;
  let hits=[]; try{ hits=ray.intersectObject(root,true); }catch{ hits=[]; }
  for(const h of hits){
    if(!h.face || !h.object.isMesh) continue;
    let hid=false; for(let p=h.object;p;p=p.parent) if(p.visible===false){hid=true;break;}
    if(hid) continue;
    if(Math.abs(h.point.y-s.y)>0.06) continue;
    _nmat.getNormalMatrix(h.object.matrixWorld);
    _nrm.copy(h.face.normal).applyMatrix3(_nmat).normalize();
    if(_nrm.y<=0.6) continue;
    const rect=meshRect(h.object);
    if(rect && rect.w>0 && rect.d>0) return rect;
  }
  return null;
};
const eng = mk(()=>{});
let tot=0, bad=0, noRect=0; const byShape=new Map();
for(const room of ['banjiha','oneroom','classroom','tworoom','apartment','greenhouse']){
  const r = eng.build(room); r.built.room.updateMatrixWorld(true); const hits=[];
  for(const s of r.slots){
    const rect = tierRectOf(r.built.room, s);
    if(!rect){ noRect++; continue; }
    tot++;
    const c=Math.cos(rect.rot||0), si=Math.sin(rect.rot||0);
    const dx=s.x-rect.x, dz=s.z-rect.z;
    const u=dx*c-dz*si, v=dx*si+dz*c;
    const U=surfaceAxis(rect.w,POT), V=surfaceAxis(rect.d,POT);
    const nu=U.at(Math.max(0,Math.min(U.n-1,Math.round((u+rect.w/2)/U.cell-0.5))));
    const nv=V.at(Math.max(0,Math.min(V.n-1,Math.round((v+rect.d/2)/V.cell-0.5))));
    const err=Math.hypot(u-nu,v-nv);
    if(err>GOVERN){ bad++;
      const key=`${rect.w.toFixed(2)}x${rect.d.toFixed(2)} 칸 ${U.n}x${V.n}`;
      byShape.set(key,(byShape.get(key)||0)+1);
      hits.push(`    ${s.slotId.padEnd(34)} 상판 ${key}  어긋남 ${err.toFixed(4)}`); }
  }
  console.log(`${room.padEnd(11)} ${String(r.slots.length).padStart(3)}칸 · 상판 못 찾음 ? · 안 붙는 자리 ${hits.length}`);
  hits.slice(0,8).forEach(h=>console.log(h));
  if(hits.length>8) console.log(`    ... 그 밖 ${hits.length-8}`);
}
console.log(`
상판을 찾은 ${tot}칸 중 ${bad}칸이 SLOT_GOVERN_R ${GOVERN} 밖 (상판 못 찾음 ${noRect}칸)`);
console.log('모양별:'); [...byShape].sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>console.log('  ',k,'→',v,'칸'));
