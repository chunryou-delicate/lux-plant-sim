/* ============================================================
   render3d/furniture.js — 저폴리 가구 (형태감 있게)
   ------------------------------------------------------------
   ※ 지금은 기준 씬을 그대로 재현(침대·책상·책장·테이블+몬스테라·
     바닥화분·천장등). STEP4 이후 catalog.json 기반 스폰으로 확장 예정.
   반환: { clShade } — 천장등 갓 (updateLight에서 발광 갱신)
============================================================ */
import { mat, box, col } from './util.js';
import { fabricTexture } from './textures.js';

export function buildFurniture(room, TEX){
  // 러그
  const rug=new THREE.Mesh(new THREE.CircleGeometry(1.7,40),
    new THREE.MeshStandardMaterial({ map:fabricTexture('#c25a4a'), roughness:1 }));
  rug.rotation.x=-Math.PI/2; rug.position.set(0.4,0.02,0.9); rug.receiveShadow=true; room.add(rug);

  // 침대
  const bed=new THREE.Group();
  bed.add(box(2,0.5,2.6,mat('#7a5a44',0.8,TEX.woodDark),0,0.25,0));
  bed.add(box(1.85,0.35,2.4,new THREE.MeshStandardMaterial({ map:fabricTexture('#4a5568'), roughness:0.95 }),0,0.62,0.05));
  bed.add(box(1.85,0.28,1.3,new THREE.MeshStandardMaterial({ map:fabricTexture('#3a4456'), roughness:0.95 }),0,0.72,0.6));
  bed.add(box(0.8,0.24,0.5,mat('#f0ebe0',0.9),-0.45,0.82,-0.85));
  bed.add(box(0.8,0.24,0.5,mat('#e8e0d2',0.9),0.45,0.82,-0.85));
  bed.add(box(2.1,1.2,0.2,mat('#6a4a36',0.8,TEX.woodDark),0,0.9,-1.3));
  bed.position.set(1.8,0,1.2); room.add(bed);

  // 책상 + 의자 (창 밑)
  const desk=new THREE.Group();
  desk.add(box(2,0.1,0.9,mat('#8a6248',0.7,TEX.woodDark),0,1.1,0));
  desk.add(box(0.1,1.1,0.8,mat('#6a4a36',0.8),-0.9,0.55,0));
  desk.add(box(0.1,1.1,0.8,mat('#6a4a36',0.8),0.9,0.55,0));
  desk.add(box(0.9,0.55,0.06,mat('#1a1a22',0.4),0,1.5,-0.25));
  const screen=new THREE.Mesh(new THREE.PlaneGeometry(0.82,0.47),mat('#1a2a3a',0.3));
  screen.position.set(0,1.5,-0.21); desk.add(screen);
  const chair=new THREE.Group();
  chair.add(box(0.5,0.08,0.5,mat('#2a2a32',0.6),0,0.6,0));
  chair.add(box(0.5,0.6,0.08,mat('#33333c',0.6),0,0.9,-0.24));
  chair.position.set(0,0,0.7); desk.add(chair);
  desk.position.set(-1.5,0,-1.9); room.add(desk);

  // 책장
  const shelf=new THREE.Group();
  shelf.add(box(0.4,2.4,1.6,mat('#7a5638',0.8,TEX.woodDark),0,1.2,0));
  for(let k=0;k<4;k++) shelf.add(box(0.42,0.05,1.5,mat('#5a3e28',0.8),0.01,0.5+k*0.55,0));
  const bookCols=['#a04638','#3a5a68','#c8964a','#4a6a4a','#8a4a6a'];
  for(let k=0;k<3;k++) for(let b=0;b<4;b++)
    shelf.add(box(0.28,0.32+Math.random()*0.1,0.14,mat(bookCols[(k*4+b)%5],0.85),0.05,0.72+k*0.55,-0.5+b*0.28));
  shelf.position.set(-3.1,0,1.4); room.add(shelf);

  // 테이블 + 몬스테라
  const table=new THREE.Group();
  const top=new THREE.Mesh(new THREE.CylinderGeometry(0.75,0.75,0.1,28),mat('#c89a68',0.6,TEX.woodFloor));
  top.position.y=0.85; top.castShadow=top.receiveShadow=true; table.add(top);
  const leg=new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.1,0.85,10),mat('#8a6642',0.7));
  leg.position.y=0.42; leg.castShadow=true; table.add(leg);
  table.add(new THREE.Mesh(new THREE.CylinderGeometry(0.4,0.45,0.05,16),mat('#8a6642',0.7)));
  table.position.set(0.5,0,0.9); room.add(table);

  const monstera=buildMonstera();   // { group, leafMats } — 조도 반응(발광)용
  room.add(monstera.group);

  // 바닥 화분
  const fp=new THREE.Group();
  fp.add(new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.24,0.5,14),mat('#a86848',0.7)));
  for(let k=0;k<5;k++){ const blade=box(0.06,0.9+Math.random()*0.5,0.12,mat('#5a9a5a',0.7),
    (Math.random()-0.5)*0.3,0.6,(Math.random()-0.5)*0.3); blade.rotation.z=(Math.random()-0.5)*0.5; fp.add(blade); }
  fp.position.set(-2.8,0.25,-1.2); fp.traverse(o=>{ if(o.isMesh)o.castShadow=true; }); room.add(fp);

  // 천장등 (봉 + 갓)
  const cl=new THREE.Group();
  cl.add(box(0.06,0.4,0.06,mat('#3a3a42',0.5),0,3.8,0));
  const clShade=new THREE.Mesh(new THREE.CylinderGeometry(0.35,0.5,0.35,20,1,true),
    new THREE.MeshStandardMaterial({ color:col('#f0e0c0'), roughness:0.6, side:THREE.DoubleSide,
      emissive:col('#3a2e18'), emissiveIntensity:0.2 }));
  clShade.position.y=3.5; cl.add(clShade);
  room.add(cl);

  // 그림자 캐스팅
  [bed,desk,shelf].forEach(gr=>gr.traverse(o=>{ if(o.isMesh)o.castShadow=true; }));

  return { clShade, monstera };   // monstera = { group, leafMats } (STEP4 조도 반응용)
}

// 몬스테라 (하트+결각 잎 셰이프)
function buildMonstera(){
  const plant=new THREE.Group();
  const pot=new THREE.Mesh(new THREE.CylinderGeometry(0.28,0.22,0.4,16),mat('#b87050',0.7));
  pot.position.y=0.2; pot.castShadow=true; plant.add(pot);
  const soil=new THREE.Mesh(new THREE.CylinderGeometry(0.26,0.26,0.05,16),mat('#3a2a1e',1));
  soil.position.y=0.4; plant.add(soil);

  const s=new THREE.Shape();
  s.moveTo(0,0);
  s.bezierCurveTo(0.15,0.15, 0.35,0.25, 0.42,0.5);
  s.lineTo(0.30,0.52);
  s.bezierCurveTo(0.34,0.62, 0.36,0.72, 0.28,0.85);
  s.lineTo(0.20,0.78);
  s.bezierCurveTo(0.22,0.9, 0.16,1.0, 0.0,1.06);
  s.bezierCurveTo(-0.16,1.0, -0.22,0.9, -0.20,0.78);
  s.lineTo(-0.28,0.85);
  s.bezierCurveTo(-0.36,0.72, -0.34,0.62, -0.30,0.52);
  s.lineTo(-0.42,0.5);
  s.bezierCurveTo(-0.35,0.25, -0.15,0.15, 0,0);
  const leafGeo=new THREE.ShapeGeometry(s);
  const leafMats=[
    new THREE.MeshStandardMaterial({ color:col('#3d8a4a'), roughness:0.55, side:THREE.DoubleSide }),
    new THREE.MeshStandardMaterial({ color:col('#4fa05a'), roughness:0.55, side:THREE.DoubleSide }),
    new THREE.MeshStandardMaterial({ color:col('#2f6e3a'), roughness:0.55, side:THREE.DoubleSide }),
  ];
  const leaves=[ // [방위각, 처짐, 크기, 높이]
    [0.0,0.55,0.95,0.35],[0.9,0.75,0.85,0.5],[1.8,0.4,0.9,0.3],[2.7,0.9,0.8,0.55],
    [3.5,0.5,0.92,0.4],[4.3,0.8,0.82,0.5],[5.2,0.35,0.88,0.32],[5.9,1.0,0.75,0.6],
  ];
  leaves.forEach(([az,droop,sz,h],i)=>{
    const leaf=new THREE.Mesh(leafGeo, leafMats[i%3]);
    leaf.scale.set(sz,sz,sz);
    const px=Math.cos(az)*0.12, pz=Math.sin(az)*0.12;
    leaf.position.set(px, 0.44+h, pz);
    leaf.rotation.y=az; leaf.rotation.x=droop; leaf.rotation.z=(Math.random()-0.5)*0.3;
    leaf.castShadow=true; plant.add(leaf);
    const stemLen=0.25+h*0.2;
    const stem=new THREE.Mesh(new THREE.CylinderGeometry(0.012,0.018,stemLen,6),mat('#4a7a3a',0.7));
    stem.position.set(px*0.5,0.44+h*0.6,pz*0.5);
    stem.rotation.z=Math.cos(az)*0.8; stem.rotation.x=Math.sin(az)*0.8;
    stem.castShadow=true; plant.add(stem);
  });
  plant.position.set(0.5,0.85,0.9);
  return { group:plant, leafMats };
}
