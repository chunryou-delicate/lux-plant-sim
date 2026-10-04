/* ============================================================
   probe_add_furniture_light.mjs — 「가구를 «더하면» 빛이 어디서 얼마나 바뀌나」 ([House] · 2026-10-04)
   ------------------------------------------------------------
   방 데이터를 «안» 고치고 전후를 칸 단위로 낸다:
     ① 이름 붙은 자리 전부 — 등 0·1·2·3 · avg7 = 자연광 peak × 0.643 + 등 DLI 그대로
     ② 바닥 0.25m 격자(y 0.10 · 등 0) — 값이 바뀐 칸 · 가장 크게 준 칸 · 콩나물 쪽(≤0.3) 칸 수
     ③ 자리 판정 — 방 안쪽 면(바깥 치수 − 벽 반두께 0.1) · 문 폭 · 이웃 가구와 박힘 · 가림·충돌 상자가 «생겼나»
   ★ 처음 쓴 일: 반지하 소품 넷(건조대·난방기·쓰레기봉투·배낭)을 «진짜 가구»로 만들 때(박사님 2026-10-04)
   ★ 두 판으로 돈다 — 방 데이터를 보고 스스로 고른다:
       넣기 «전»  house_rooms 에 NEW 의 uid 가 없다 ⇒ 사본에 NEW 를 얹는다(프리셋이 없으면 아래 DRAFT 를 사본에 꽂는다)
       넣은 «뒤»  uid 가 다 있다 ⇒ «전» = 그 uid 를 뺀 방 · «후» = 방 그대로(데이터 프리셋 그대로)
     ⇒ 넣은 뒤에 같은 자로 다시 돌려 «사본으로 잰 수 = 진짜 데이터로 잰 수» 를 본다.
   ⛔ 프리셋에 빌더가 없으면 buildFurniture 가 «빈 그룹»을 내서 가림·충돌이 «조용히» 빠진다(furniture_pastel §buildFurniture).
      ③ 이 «가림 상자가 생겼나»를 uid 마다 본다 — 빈 그룹이면 여기서 ⛔ 가 뜬다.
   ⚠ 맑음·여름 «한 칸»이다. real 400일은 [growth] 자로.
   쓰기:  node tools/probe_add_furniture_light.mjs              (넷 다)
          ONLY=rack node tools/probe_add_furniture_light.mjs   (uid 일부로 하나만)
          ONLY=rack RACK_H=1.0 node tools/probe_add_furniture_light.mjs   (건조대 높이만 바꿔 견준다)
============================================================ */
import fs from "node:fs"; import vm from "node:vm"; import path from "node:path";
import { pathToFileURL } from "node:url";
const ROOT="c:/Users/pc/Desktop/빛식물/lux-plant-sim";
const dataOf=r=>JSON.parse(fs.readFileSync(path.join(ROOT,"data",r),"utf8"));
const sc=()=>new Proxy({},{get:(t,k)=>{if(k==="createImageData"||k==="getImageData")return(w=1,h=1)=>({data:new Uint8ClampedArray(Math.max(1,w*h*4)),width:w,height:h});if(k==="createLinearGradient"||k==="createRadialGradient")return()=>({addColorStop(){}});if(k==="measureText")return()=>({width:0});return()=>{};}});
const se=()=>({style:{},dataset:{},appendChild(){},setAttribute(){},getContext:()=>sc(),width:0,height:0});
globalThis.document={createElement:se,body:se(),getElementById:()=>se()}; globalThis.window=globalThis;
const _warn=console.warn; const warns=[]; console.warn=(...a)=>{warns.push(a.join(" "));};
vm.runInThisContext(fs.readFileSync(path.join(ROOT,"vendor/three/three.min.js"),"utf8"));
const {createLightEngine}=await import(pathToFileURL(path.join(ROOT,"src/game/light_adapter.js")).href);
const FP=dataOf("furniture_presets.json").presets;
const D={winPresets:dataOf("window_presets.json").presets,doorPresets:dataOf("door_presets.json").presets,finishes:dataOf("room_finishes.json"),lightPresets:dataOf("lighting_presets.json"),shadePresets:dataOf("shading_presets.json"),lightTh:dataOf("balance/light_thresholds.json"),weatherBalance:dataOf("balance/weather.json")};
const H0=dataOf("house_rooms.json"); const E=0.643; const ROOM="banjiha";

/* 넣을 것 — 크기는 GLB 실측 상자 × k(높이에 맞춘 같은 배율). 자리 rot = 그림(furniture_dress PROPS)의 yaw */
const NEW=[
  {uid:"banjiha-drying-rack", preset:"drying_rack", x:-1.10,  z:-1.42, rot:90, w:0.913, d:0.498, h:0.72},
  {uid:"banjiha-heater",      preset:"heater",      x:-2.19,  z: 0.52, rot:90},
  {uid:"banjiha-trash",       preset:"trash",       x:-2.225, z: 1.53, rot:0},
  {uid:"banjiha-backpack",    preset:"backpack",    x:-0.35,  z: 1.64, rot:90},   /* 그림 −0.72 는 문 앞 길을 끊었다(§길) */
];
/* 데이터에 프리셋이 아직 없을 때만 사본에 꽂는 초안 — 넣을 때 furniture_presets.json 에 같은 값을 적는다 */
const sz=(w,d,h)=>({w,d,h,size_m:{w,d,h}});
const DRAFT={
  heater:  {type:"heater",  name_ko:"라디에이터 난방기", ...sz(0.517,0.38,0.5)},
  trash:   {type:"trash",   name_ko:"쓰레기봉투·폐지",   ...sz(0.334,0.603,0.4)},
  backpack:{type:"backpack",name_ko:"배낭과 운동화",     ...sz(0.397,0.628,0.36)},
};
const ONLY=process.env.ONLY; const pick=ONLY?NEW.filter(p=>p.uid.includes(ONLY)):NEW;
const rf=H0.rooms[ROOM].furniture; const inData=pick.every(p=>rf.some(f=>f.uid===p.uid));
const presets={...DRAFT,...FP};   /* 데이터가 이긴다 */
const build=(furn)=>{const H=JSON.parse(JSON.stringify(H0)); H.rooms[ROOM].furniture=furn;
  const eng=createLightEngine({houseRooms:H,furnPresets:presets,...D}); const r=eng.build(ROOM); return {eng,r};};
const uids=new Set(pick.map(p=>p.uid));
/* RACK_H — 건조대 «높이만» 바꿔 본다(발자국 그대로). 높이를 고를 때 «같은 판»에서 견주려고 둔다 */
const RACK_H=process.env.RACK_H?Number(process.env.RACK_H):null;
const rackH=fs_=>fs_.map(f=>RACK_H!=null&&f.uid==="banjiha-drying-rack"?{...f,h:RACK_H}:f);
const A=build(inData?rf.filter(f=>!uids.has(f.uid)):rf.slice());
const B=build(rackH(inData?rf.slice():[...rf,...pick]));
if(RACK_H!=null) console.log("⚠ RACK_H="+RACK_H+" — 건조대 높이만 바꿔 쟀다(데이터 값 아님)");
console.log("반지하 · 맑음·여름 · avg7 = 자연광×0.643 + 등DLI · 헤드리스 · 판: "+(inData?"넣은 뒤(데이터 그대로 · 전 = 고른 것을 뺀 방)":"넣기 전(사본에 얹음)")+" · 넣은 것 "+pick.map(p=>p.uid.replace("banjiha-","")).join(","));
const S={weather:"clear",season:"summer",litHours:12};
const slotTab=({eng,r})=>{const m={}; for(const s of r.slots){ m[s.slotId]=[0,1,2,3].map(n=>{eng.clearCache();const o=eng.dliAt({x:s.x,y:s.y,z:s.z},{...S,lampCount:n,occIdx:s.occIdx});return (o.dli_daylight??0)*E+(o.dli_lamp??0);}); } return m;};
const floorTab=({eng})=>{const m={}; for(let x=-2.375;x<=2.38;x+=0.25) for(let z=-1.875;z<=1.88;z+=0.25){ try{ eng.clearCache(); const o=eng.dliAt({x,y:0.10,z},{...S,lampCount:0}); m[x.toFixed(3)+","+z.toFixed(3)]=(o.dli_daylight??0)*E; }catch(e){} } return m;};
const occ=r=>(r.built.occluders||[]).filter(o=>o.src==="furniture").length, col=r=>(r.built.colliders||[]).filter(c=>c.kind==="furn").length;
console.log("자리 "+A.r.slots.length+" → "+B.r.slots.length+" · 가구 가림 "+occ(A.r)+" → "+occ(B.r)+" · 가구 충돌 "+col(A.r)+" → "+col(B.r));

/* ③ 자리 판정 */
console.log("\n■ 자리 판정 (방 좌표 m · 안쪽 면 = 바깥 치수/2 − 0.1)");
const def=H0.rooms[ROOM], hw=def.size.w/2-0.1, hd=def.size.d/2-0.1;
const doors=(def.doors||[]).filter(d=>d.wall==="front"||d.wall==="back").map(d=>({x0:d.cu-d.w/2,x1:d.cu+d.w/2,wall:d.wall}));
const groups=[]; B.r.built.furniture.traverse(o=>{ if(o.userData&&o.userData.uid&&o.userData.size&&o.parent===B.r.built.furniture) groups.push(o); });
const box=g=>{const s=g.userData.size, q=Math.round(((g.rotation.y*180/Math.PI)%180+180)%180/90)%2; const W=q?s.d:s.w, Dd=q?s.w:s.d;
  return {uid:g.userData.uid, x0:g.position.x-W/2,x1:g.position.x+W/2,z0:g.position.z-Dd/2,z1:g.position.z+Dd/2,y0:g.position.y,y1:g.position.y+s.h,
          flat:s.h<=0.05, wall:g.userData.mount==="wall"||!!g.userData.hangFromCeiling};};
const boxes=groups.map(box); let bad=0;
for(const p of pick){
  const g=groups.find(o=>o.userData.uid===p.uid); if(!g){console.log("  ⛔ "+p.uid+" 가 지어지지 않았다"); bad++; continue;}
  const b=box(g), f=v=>v.toFixed(3);
  const occOk=g.userData.occIdx!=null, colOk=(B.r.built.colliders||[]).some(c=>c.kind==="furn"&&Math.abs(c.x-p.x)<1e-6&&Math.abs(c.z-p.z)<1e-6);
  const inX=Math.min(b.x0+hw, hw-b.x1), inZ=Math.min(b.z0+hd, hd-b.z1);
  /* 문 앞 = 문 폭 × 문 폭 깊이(여닫는 반경). 문에서 그보다 먼 것은 문을 안 막는다 */
  const dz=doors.map(d=>{ const near=d.wall==="front"?hd-b.z1:b.z0+hd; const ov=Math.min(b.x1,d.x1)-Math.max(b.x0,d.x0); return {ov,near,far:near>=d.x1-d.x0};});
  const clash=boxes.filter(o=>o.uid!==b.uid&&!o.flat&&!o.wall&&Math.min(b.x1,o.x1)-Math.max(b.x0,o.x0)>1e-6&&Math.min(b.z1,o.z1)-Math.max(b.z0,o.z0)>1e-6&&Math.min(b.y1,o.y1)-Math.max(b.y0,o.y0)>1e-6).map(o=>o.uid.replace("banjiha-",""));
  const near=boxes.filter(o=>o.uid!==b.uid&&!o.wall).map(o=>({u:o.uid.replace("banjiha-",""),gap:Math.max(Math.max(o.x0-b.x1,b.x0-o.x1),Math.max(o.z0-b.z1,b.z0-o.z1))})).sort((a,c)=>a.gap-c.gap)[0];
  const ok=inX>=0&&inZ>=0&&dz.every(d=>d.far||d.ov<=0)&&!clash.length&&occOk&&colOk; if(!ok) bad++;
  console.log("  "+(ok?"✔":"✘")+" "+p.uid.replace("banjiha-","").padEnd(12)+" x "+f(b.x0)+".."+f(b.x1)+" z "+f(b.z0)+".."+f(b.z1)+" h "+(b.y1-b.y0).toFixed(3)
    +" | 벽까지 x "+(inX*100).toFixed(1)+"cm z "+(inZ*100).toFixed(1)+"cm | 문 앞 "+dz.map(d=>d.far?"멂("+(d.near*100).toFixed(0)+"cm)":d.ov>0?"⛔ "+(d.ov*100).toFixed(1)+"cm 걸침":"비킴 "+(-d.ov*100).toFixed(1)+"cm").join(",")
    +" | 박힘 "+(clash.length?"⛔ "+clash.join(","):"0")+" · 가장 가까운 "+near.u+" "+(near.gap*100).toFixed(1)+"cm | 가림 "+(occOk?"있음":"⛔ 없음")+" · 충돌 "+(colOk?"있음":"⛔ 없음"));
}
const unk=warns.filter(w=>/알 수 없는 종류/.test(w)); if(unk.length) { console.log("  ⛔ 빌더 없음: "+[...new Set(unk)].join(" / ")); bad++; }
console.log("  ⇒ 자리 판정 "+(pick.length-Math.min(bad,pick.length))+"/"+pick.length+(bad?" ⛔":""));

/* ④ 길 — ★ 2026-10-04 덧. 위 「문 앞 비킴 11.6cm」 는 **문 폭만** 봤다. 사람은 몸 반지름(room_view BODY_R 0.38)만큼
   가구에서 떨어져야 선다 — 그 자로 재니 배낭(x −0.72)·난방기 모서리가 문 앞 통로 세 칸을 방에서 끊었고,
   캐릭터가 처음 서는 자리(standSpot)가 바로 그 주머니라 첫 판이 Day 0 에서 갇혔다(probe_force5 제자리걸음).
   ⇒ room_view 와 같은 floor_nav 로 «덩어리»를 세고, 서는 자리가 큰 덩어리에 붙었나 본다. standSpot 셈도 room_view 그대로다. */
const {createFloorNav}=await import(pathToFileURL(path.join(ROOT,"src/render3d/floor_nav.js")).href);
const BODY_R=0.38;
const navOf=({r})=>{ const b=r.built, S=b.size, nav=createFloorNav({colliders:b.colliders,size:S,radius:BODY_R});
  let wx=0,wz=-S.d/2; const win=(b.luxWins||[]).filter(w=>w.wall&&w.wall!=="ceiling");
  if(win.length){ let big=win[0],ar=0; for(const w of win){const a=(w.w||0)*(w.h||0); if(a>ar){ar=a;big=w;}}
    if(big.wall==="back"){wx=big.cu||0;wz=-S.d/2;} else if(big.wall==="front"){wx=big.cu||0;wz=S.d/2;} else if(big.wall==="left"){wx=-S.w/2;wz=big.cu||0;} else {wx=S.w/2;wz=big.cu||0;} }
  let st=null,bs=-Infinity;
  for(let x=-S.w/2+0.34;x<=S.w/2-0.34;x+=0.20) for(let z=-S.d/2+0.34;z<=S.d/2-0.34;z+=0.20){
    if(nav.blocked(x,z,BODY_R)) continue; let dS=Infinity; for(const s of r.slots) dS=Math.min(dS,Math.hypot(s.x-x,s.z-z)); if(dS<0.55) continue;
    const dW=Math.min(S.w/2-Math.abs(x),S.d/2-Math.abs(z)), sc=Math.min(dS,2)+Math.min(Math.hypot(wx-x,wz-z),3)*0.55-dW*0.9; if(sc>bs){bs=sc;st={x,z};} }
  const n=Math.ceil(S.w/0.25), m=Math.ceil(S.d/0.25), x0=-S.w/2, z0=-S.d/2, F=(i,j)=>!nav.blocked(x0+(i+.5)*.25,z0+(j+.5)*.25);
  const C=new Int32Array(n*m).fill(-1), sizes=[];
  for(let j=0;j<m;j++) for(let i=0;i<n;i++) if(F(i,j)&&C[j*n+i]<0){ const q=[[i,j]]; C[j*n+i]=sizes.length; let c=0;
    while(q.length){ const [a,bb]=q.pop(); c++; for(const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){ const p=a+di,qq=bb+dj;
      if(p<0||qq<0||p>=n||qq>=m||!F(p,qq)||C[qq*n+p]>=0) continue; if(di&&dj&&(!F(p,bb)||!F(a,qq))) continue; C[qq*n+p]=sizes.length; q.push([p,qq]); } }
    sizes.push(c); }
  const sc_=st?C[Math.floor((st.z-z0)/.25)*n+Math.floor((st.x-x0)/.25)]:-1, big=sizes.indexOf(Math.max(...sizes));
  return {free:sizes.reduce((a,c)=>a+c,0), sizes, st, stIn:sc_, stOk:sc_===big};
};
const na=navOf(A), nb=navOf(B);
console.log("\n■ 길 (몸 반지름 "+BODY_R+" · 0.25 칸 · room_view standSpot 그대로)");
for(const [k,v] of [["전",na],["후",nb]]) console.log("  "+k+" 설 수 있는 칸 "+v.free+" · 덩어리 "+v.sizes.length+" ("+v.sizes.join(", ")+") · 처음 서는 자리 ("+(v.st?v.st.x.toFixed(2)+", "+v.st.z.toFixed(2):"없음")+") "+(v.stOk?"✔ 큰 덩어리":"⛔ 끊긴 주머니(크기 "+(v.sizes[v.stIn]??"?")+")"));
const navBad=!nb.stOk||nb.sizes.length>na.sizes.length; if(navBad) bad++;
console.log("  ⇒ 길 "+(navBad?"⛔ 끊겼다 — 첫 판이 서는 자리에서 못 나간다":"이어져 있다"));

const sa=slotTab(A), sb=slotTab(B);
console.log("\n■ 자리 "+Object.keys(sa).length+"칸 — 바뀐 칸만 (등0 / 등1 / 등2 / 등3)");
let ch=0; for(const id of Object.keys(sa)){ const a=sa[id], b=sb[id]; if(!b) {console.log("  ⛔ "+id+" 사라짐"); continue;}
  if(a.some((v,i)=>Math.abs(v-b[i])>0.005)){ ch++; console.log("  "+id.replace("banjiha-","").padEnd(14)+a.map((v,i)=>v.toFixed(2)+"→"+b[i].toFixed(2)).join("  ")); } }
console.log("  ⇒ 바뀐 자리 "+ch+"/"+Object.keys(sa).length);
/* 창턱은 house_rooms note 의 자(peak · 게임이 novice 로 켜므로 그날 값 = peak)로도 따로 낸다 — 여유 0.02 짜리 */
const peakAt=({eng,r},id)=>{const s=r.slots.find(q=>q.slotId===id); return [0,1,2,3].map(n=>{eng.clearCache();const o=eng.dliAt({x:s.x,y:s.y,z:s.z},{...S,lampCount:n,occIdx:s.occIdx});return (o.dli_daylight??0)+(o.dli_lamp??0);});};
const sill=Object.keys(sa).find(k=>/sill/.test(k)); if(sill) console.log("  창턱 "+sill+" peak(note 의 자) : "+peakAt(A,sill).map(v=>v.toFixed(2)).join(" / ")+"  →  "+peakAt(B,sill).map(v=>v.toFixed(2)).join(" / ")+"   (등1 이 갈라짐 문턱 6.0 을 지켜야 한다 — 여유 0.02)");
const fa=floorTab(A), fb=floorTab(B);
let fc=0, gone=0, worst=0, wk=""; const drops=[];
for(const k of Object.keys(fa)){ if(!(k in fb)){gone++;continue;} const d=fb[k]-fa[k]; if(Math.abs(d)>0.005){fc++; drops.push([k,fa[k],fb[k]]); if(d<worst){worst=d;wk=k;}} }
console.log("\n■ 바닥 격자 0.25m (y 0.10 · 등0 · 자연광 avg7) — "+Object.keys(fa).length+"칸");
console.log("  값이 바뀐 칸 "+fc+" · 가장 크게 준 칸 "+wk+" "+(worst).toFixed(3)+(gone?" · 잴 수 없게 된 칸 "+gone:""));
drops.sort((p,q)=>(p[2]-p[1])-(q[2]-q[1])); for(const [k,a,b] of drops.slice(0,6)) console.log("     "+k.padEnd(14)+a.toFixed(3)+" → "+b.toFixed(3));
const kong=(m)=>Object.values(m).filter(v=>v<=0.3).length;
console.log("  ⚠ 바닥은 원래 거의 다 콩나물 쪽(≤0.3): 전 "+kong(fa)+" · 후 "+kong(fb)+" / "+Object.keys(fa).length);
if(process.env.FLOOR_OUT){ fs.writeFileSync(process.env.FLOOR_OUT, JSON.stringify(drops.map(([k,a,b])=>({cell:k,before:+a.toFixed(4),after:+b.toFixed(4)})),null,1)); console.log("  바뀐 칸 목록 → "+process.env.FLOOR_OUT); }
console.warn=_warn;
