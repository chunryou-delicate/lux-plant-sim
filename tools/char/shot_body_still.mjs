/* 맨몸을 **가만히 선 채로** 찍는다 — 클립을 «안» 얹는다.
 *
 * 2026-09-07 · [Char] · 크레딧 0
 *
 * ■ 왜 따로 짓나
 *
 * 「몸이 잘 나왔나」와 「움직이면 어떤가」는 **다른 물음**이다.
 * 클립을 얹은 그림으로는 «생김새»를 못 본다 — 터지면 몸이 안 보인다.
 * ⇒ ★ 그래서 이 자는 three.js 로 GLB 를 «그대로» 띄운다. 뷰어를 안 거친다.
 *
 * ■ ⚠ 배경을 «짙게» 둔다
 *
 * 살구색 맨몸은 밝은 바탕에 묻힌다. 2026-09-07 에 두 번 겪었다 —
 * 한 번은 「아무도 안 그려졌다」로 잘못 읽었고, 한 번은 몸매를 «13배 적게» 봤다.
 * ⇒ ★★ 물건을 재기 전에 «찍는 자리»를 먼저 정해야 한다.
 */
import { launch } from '../test_cdp.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.BYEOT_URL || 'http://localhost:8000';
const OUT = join('docs', 'handoff', 'img', 'bodytest');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const GLB = process.argv[2] || '_bodybase/char_yeoja_base_tpose.glb';
const TAG = process.argv[3] || 'still';
/* 정면 · 측면 · 3/4 — 세 장이면 넉넉하다 */
const VIEWS = [['front', 0], ['left', 90], ['back', 180], ['q34', 35]];

const WANT_CLIP = sys_wantClip();
function sys_wantClip(){ return process.argv.includes('--clip'); }

const HTML = `<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;background:#1b2620;overflow:hidden}
/* ⛔ setPixelRatio 가 캔버스를 «CSS 크기»까지 키운다 ⇒ 뷰포트의 왼쪽 위 1/4 만 찍혔다.
   ⇒ ★ CSS 크기를 못 박아 둔다. 2026-09-07 에 여기서 두 장 버렸다. */
canvas{display:block;width:900px !important;height:1200px !important}</style>
<canvas id="c" width="900" height="1200"></canvas>
<script src="../../vendor/three/three.min.js"></script>
<script src="../../vendor/three/GLTFLoader.js"></script>
<script>
const WANT_CLIP=${JSON.stringify(WANT_CLIP)};
const cv=document.getElementById('c');
const r=new THREE.WebGLRenderer({canvas:cv,antialias:true});
r.setPixelRatio(2); r.outputEncoding=THREE.sRGBEncoding;
const sc=new THREE.Scene(); sc.background=new THREE.Color(0x1b2620);
sc.add(new THREE.AmbientLight(0xffffff,0.62));
sc.add(new THREE.HemisphereLight(0xffffff,0x30402f,0.35));
const d=new THREE.DirectionalLight(0xffffff,0.75); d.position.set(2,4,3); sc.add(d);
const d2=new THREE.DirectionalLight(0xffffff,0.25); d2.position.set(-3,2,-2); sc.add(d2);
const cam=new THREE.PerspectiveCamera(30,900/1200,0.01,5000);
window.__ready=false;
new THREE.GLTFLoader().load(${JSON.stringify(GLB)}, g=>{
  const m=g.scene;
  /* ★ 클립을 «안» 얹는다. 바인드 포즈 그대로 본다 */
  m.traverse(o=>{ if(o.isMesh){ o.frustumCulled=false;
    o.material=new THREE.MeshLambertMaterial({color:0xe9bda3}); } });
  sc.add(m); window.__m=m;
  /* ★ --clip 을 주면 «그 파일에 든» 클립을 얹는다.
     ⇒ 메시가 «자기 리깅에 딸려 준» 클립을 «자기 메시»에 얹으면
       「리깅 자체가 잘못됐나 / 우리 클립과 어긋나나」가 갈린다. */
  window.__clipInfo=null;
  if(WANT_CLIP && g.animations && g.animations.length){
    const mx=new THREE.AnimationMixer(m);
    const a=g.animations[0]; mx.clipAction(a).play(); mx.setTime(0);
    window.__mx=mx; window.__dur=a.duration;
    window.__clipInfo={name:a.name, dur:+a.duration.toFixed(2), tracks:a.tracks.length};
    window.__seek=function(t){ mx.setTime(t); m.updateMatrixWorld(true); return t; };
  }
  window.__look=function(deg){
    m.updateMatrixWorld(true);        /* ★ 안 부르면 matrixWorld 가 낡아 카메라가 어긋난다 */
    const box=new THREE.Box3(); const p=[];
    m.traverse(o=>{ if(o.isBone) p.push(o.getWorldPosition(new THREE.Vector3())); });
    /* ⛔ setFromObject 는 «인덱스에 안 쓰인» 정점도 센다.
       ⇒ 조각을 지운 뒤에도 상자가 안 줄어 카메라가 엉뚱한 데를 봤다.
       ⇒ ★ 그려지는 «삼각형의 정점»만 모아 상자를 만든다. */
    const pts=[];
    m.traverse(o=>{ if(!o.isMesh) return;
      const g2=o.geometry, pa=g2.attributes.position, ix=g2.index;
      if(!pa) return;
      if(ix){ const seen=new Set();
        for(let i=0;i<ix.count;i++){ const v=ix.getX(i); if(seen.has(v))continue; seen.add(v);
          pts.push(new THREE.Vector3(pa.getX(v),pa.getY(v),pa.getZ(v)).applyMatrix4(o.matrixWorld)); } }
      else for(let i=0;i<pa.count;i++)
        pts.push(new THREE.Vector3(pa.getX(i),pa.getY(i),pa.getZ(i)).applyMatrix4(o.matrixWorld));
    });
    /* ★★ 차례가 중요하다 —
       ⛔ 스킨드 메시는 POSITION 이 «바인드 포즈 원점 근처»라 정점으로 상자를 잡으면 rad 0.01 이 나온다.
         (뷰어 주석에도 「지오메트리 바운딩 0.017m, 원점 부근」이라 적혀 있다)
       ⇒ ★ 뼈가 있으면 «뼈»로. 뼈가 없을 때만 «그려지는 삼각형의 정점»으로. */
    /* ★★★ 스킨드 메시는 «뼈»로도 «정점»으로도 정확히 못 잡는다.
       ⛔ 뼈로 잡으니 사람이 «점»처럼 작게 찍혔다(2026-09-07 · v3t).
         뼈가 메시보다 크게 퍼져 있어 상자가 부풀었기 때문이다.
       ⇒ ★ 그러니 «실제로 스키닝한 정점»을 뽑아 잡는다 — three 가 그 계산을 해 준다.
         (skinnedMesh.applyBoneTransform · 옛 판은 boneTransform) */
    const sp=[];
    m.traverse(o=>{
      if(!o.isSkinnedMesh) return;
      const g2=o.geometry, pa=g2.attributes.position, ix=g2.index;
      const fn = o.applyBoneTransform ? 'applyBoneTransform' : (o.boneTransform ? 'boneTransform' : null);
      if(!pa || !fn) return;
      const v=new THREE.Vector3();
      const step=Math.max(1, Math.floor(pa.count/4000));   /* 4천 점이면 넉넉하다 */
      const seen=new Set();
      const push=k=>{ if(seen.has(k))return; seen.add(k);
        v.fromBufferAttribute(pa,k); o[fn](k,v); sp.push(v.clone().applyMatrix4(o.matrixWorld)); };
      if(ix) for(let i=0;i<ix.count;i+=step*3) push(ix.getX(i));
      else   for(let i=0;i<pa.count;i+=step)   push(i);
    });
    if(sp.length>20) box.setFromPoints(sp);
    else if(p.length>2) box.setFromPoints(p);
    else if(pts.length>2) box.setFromPoints(pts);
    else box.setFromObject(m);
    const c=box.getCenter(new THREE.Vector3());
    const rad=Math.max(box.getBoundingSphere(new THREE.Sphere()).radius,0.01);
    const dist=rad/Math.sin((30*Math.PI/180)/2)*0.92;
    const a=deg*Math.PI/180;
    cam.position.set(c.x+Math.sin(a)*dist, c.y+rad*0.02, c.z+Math.cos(a)*dist);
    cam.lookAt(c); cam.near=dist/500; cam.far=dist*500; cam.updateProjectionMatrix();
    r.render(sc,cam);
    /* ★ 「말이 되나」 칸 — 사람 반지름이 5cm 일 리 없다 */
    return JSON.stringify({rad:+rad.toFixed(4), cy:+c.y.toFixed(4),
      bones:p.length, sane: rad>0.05});
  };
  window.__ready=true;
}, undefined, e=>{ window.__err=String(e&&(e.message||e.type)); });
</script>`;

async function main() {
  mkdirSync(OUT, { recursive: true });
  const page = join('assets', 'characters', '_still.html');
  writeFileSync(page, HTML, 'utf8');
  const p = await launch({ width: 900, height: 1200, dpr: 2 });
  try {
    await p.goto(BASE + '/assets/characters/_still.html');
    await p.waitFor('!!window.__ready || !!window.__err', 90000, 500);
    const err = await p.eval('window.__err || ""');
    if (err) { console.log('⛔ 못 실었다: ' + err); return; }
    const ci = await p.eval('JSON.stringify(window.__clipInfo)');
    if (WANT_CLIP) console.log('  클립: ' + ci);
    const TIMES = WANT_CLIP ? [0, 0.25, 0.5, 0.75] : [null];
    const dur = WANT_CLIP ? JSON.parse(await p.eval('JSON.stringify(window.__dur||0)')) : 0;
    for (const frac of TIMES) {
      if (frac !== null) await p.eval('window.__seek(' + (dur * frac).toFixed(3) + ')');
      for (const [nm, deg] of VIEWS) {
        const info = JSON.parse(await p.eval('window.__look(' + deg + ')'));
        await sleep(500);
        const suffix = frac === null ? '' : '_t' + String(Math.round(frac * 100)).padStart(2, '0');
        const f = join(OUT, 'body_' + TAG + '_' + nm + suffix + '.png');
        await p.shot(f);
        console.log('  ' + nm.padEnd(6) + (suffix || '     ') + ' rad ' + info.rad
          + ' · 뼈 ' + info.bones + (info.sane ? '' : '  ⛔ 상자가 «너무 작다» — 말이 안 된다') + '  → ' + f);
      }
    }
  } finally { try { await p.close(); } catch {} }
  console.log('⛔ 이 자는 «잘 나왔나»를 판정하지 않는다. ★ 눈으로 볼 것.');
}
main();
