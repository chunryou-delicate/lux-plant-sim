/* ============================================================
   probe_add_furniture_light.mjs — 「가구를 «더하면» 빛이 어디서 얼마나 바뀌나」 ([House] · 2026-10-04)
   ------------------------------------------------------------
   방 데이터를 «안» 고치고(사본 위에 얹어) 전후를 칸 단위로 낸다:
     ① 이름 붙은 자리 전부 — 등 0·1·2·3 · avg7 = 자연광 peak × 0.643 + 등 DLI 그대로
     ② 바닥 0.25m 격자(y 0.10 · 등 0) — 값이 바뀐 칸 · 가장 크게 준 칸 · 콩나물 쪽(≤0.3) 칸 수
   ★ 처음 쓴 일: 반지하 소품 넷(건조대·난방기·쓰레기봉투·배낭)을 «진짜 가구»로 만들 때(박사님 2026-10-04)
   ⚠ 대리 상자로 `drying_rack` 빌더를 쓴다 — size={w,h,d} 만 내고 자리(slots)는 안 낸다.
     ⛔ 프리셋에 빌더가 없으면 buildFurniture 가 «빈 그룹»을 내서 가림·충돌이 «조용히» 빠진다(furniture_pastel:1271).
        이 자는 상자로 재므로 «넣은 뒤» 진짜 빌더로 같은 수가 나오는지 run_house_checks 와 함께 다시 봐야 한다.
   ⚠ 맑음·여름 «한 칸»이다. real 400일은 [growth] 자로.
   쓰기:  node tools/probe_add_furniture_light.mjs              (넷 다)
          ONLY=rack RACK_H=0.72 node tools/probe_add_furniture_light.mjs
============================================================ */
import fs from "node:fs"; import vm from "node:vm"; import path from "node:path";
import { pathToFileURL } from "node:url";
const ROOT="c:/Users/pc/Desktop/빛식물/lux-plant-sim";
const dataOf=r=>JSON.parse(fs.readFileSync(path.join(ROOT,"data",r),"utf8"));
const sc=()=>new Proxy({},{get:(t,k)=>{if(k==="createImageData"||k==="getImageData")return(w=1,h=1)=>({data:new Uint8ClampedArray(Math.max(1,w*h*4)),width:w,height:h});if(k==="createLinearGradient"||k==="createRadialGradient")return()=>({addColorStop(){}});if(k==="measureText")return()=>({width:0});return()=>{};}});
const se=()=>({style:{},dataset:{},appendChild(){},setAttribute(){},getContext:()=>sc(),width:0,height:0});
globalThis.document={createElement:se,body:se(),getElementById:()=>se()}; globalThis.window=globalThis;
vm.runInThisContext(fs.readFileSync(path.join(ROOT,"vendor/three/three.min.js"),"utf8"));
const {createLightEngine}=await import(pathToFileURL(path.join(ROOT,"src/game/light_adapter.js")).href);
const D={winPresets:dataOf("window_presets.json").presets,doorPresets:dataOf("door_presets.json").presets,finishes:dataOf("room_finishes.json"),furnPresets:dataOf("furniture_presets.json").presets,lightPresets:dataOf("lighting_presets.json"),shadePresets:dataOf("shading_presets.json"),lightTh:dataOf("balance/light_thresholds.json"),weatherBalance:dataOf("balance/weather.json")};
const H0=dataOf("house_rooms.json"); const E=0.643;
/* 대리 상자 — B.drying_rack 은 size={w,h,d} 만 내고 자리(slots)는 안 낸다 */
const box=(uid,x,z,rot,w,d,h)=>({uid,preset:"drying_rack",x,z,rot,w,d,h});
const RACK_H=Number(process.env.RACK_H||1.0);
const PROPS=[
  box("banjiha-drying-rack",-1.10,-1.42,90, 0.90,0.55,RACK_H),
  box("banjiha-heater",     -2.19, 0.52,90, 0.40,0.25,0.50),
  box("banjiha-trash",      -2.21, 1.53, 0, 0.40,0.40,0.40),
  box("banjiha-backpack",   -0.72, 1.64,90, 0.35,0.25,0.36),
];
const ONLY=process.env.ONLY;  /* uid 일부로 하나만 */ const add=ONLY?PROPS.filter(p=>p.uid.includes(ONLY)):PROPS;
const build=(extra)=>{const H=JSON.parse(JSON.stringify(H0)); H.rooms.banjiha.furniture.push(...extra);
  const eng=createLightEngine({houseRooms:H,...D}); const r=eng.build("banjiha"); return {eng,r};};
const S={weather:"clear",season:"summer",litHours:12};
const slotTab=({eng,r})=>{const m={}; for(const s of r.slots){ m[s.slotId]=[0,1,2,3].map(n=>{eng.clearCache();const o=eng.dliAt({x:s.x,y:s.y,z:s.z},{...S,lampCount:n,occIdx:s.occIdx});return (o.dli_daylight??0)*E+(o.dli_lamp??0);}); } return m;};
const floorTab=({eng})=>{const m={}; for(let x=-2.375;x<=2.38;x+=0.25) for(let z=-1.875;z<=1.88;z+=0.25){ try{ eng.clearCache(); const o=eng.dliAt({x,y:0.10,z},{...S,lampCount:0}); m[x.toFixed(3)+","+z.toFixed(3)]=(o.dli_daylight??0)*E; }catch(e){} } return m;};
const A=build([]), B=build(add);
const sa=slotTab(A), sb=slotTab(B);
console.log("반지하 · 맑음·여름 · avg7 = 자연광×0.643 + 등DLI · 헤드리스 · 건조대 높이 "+RACK_H+" · 넣은 것 "+add.map(p=>p.uid.replace("banjiha-","")).join(",")); 
console.log("자리 "+A.r.slots.length+" → "+B.r.slots.length+" · 가림 "+(A.r.built.occluders||[]).length+" → "+(B.r.built.occluders||[]).length);
console.log("\n■ 자리 15칸 — 바뀐 칸만 (등0 / 등1 / 등2 / 등3)");
let ch=0; for(const id of Object.keys(sa)){ const a=sa[id], b=sb[id]; if(!b) {console.log("  ⛔ "+id+" 사라짐"); continue;}
  if(a.some((v,i)=>Math.abs(v-b[i])>0.005)){ ch++; console.log("  "+id.replace("banjiha-","").padEnd(14)+a.map((v,i)=>v.toFixed(2)+"→"+b[i].toFixed(2)).join("  ")); } }
console.log("  ⇒ 바뀐 자리 "+ch+"/"+Object.keys(sa).length);
const fa=floorTab(A), fb=floorTab(B);
let fc=0, gone=0, worst=0, wk=""; const drops=[];
for(const k of Object.keys(fa)){ if(!(k in fb)){gone++;continue;} const d=fb[k]-fa[k]; if(Math.abs(d)>0.005){fc++; drops.push([k,fa[k],fb[k]]); if(d<worst){worst=d;wk=k;}} }
console.log("\n■ 바닥 격자 0.25m (y 0.10 · 등0 · 자연광 avg7) — "+Object.keys(fa).length+"칸");
console.log("  값이 바뀐 칸 "+fc+" · 가장 크게 준 칸 "+wk+" "+(worst).toFixed(3)+(gone?" · 잴 수 없게 된 칸 "+gone:""));
drops.sort((p,q)=>(p[2]-p[1])-(q[2]-q[1])); for(const [k,a,b] of drops.slice(0,6)) console.log("     "+k.padEnd(14)+a.toFixed(3)+" → "+b.toFixed(3));
const kong=(m)=>Object.values(m).filter(v=>v<=0.3).length;
console.log("  ⚠ 바닥은 원래 거의 다 콩나물 쪽(≤0.3): 전 "+kong(fa)+" · 후 "+kong(fb)+" / "+Object.keys(fa).length);
