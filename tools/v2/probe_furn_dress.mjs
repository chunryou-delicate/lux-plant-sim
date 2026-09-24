/* ══ 보이는 층 v2 · 가구 옷 재는 자 — «진짜 게임»에서 ═══════════════════════════
   BYEOT_URL=http://localhost:8984 node tools/v2/probe_furn_dress.mjs [--q v2furn=0] [--tag x] [--pots]

   무엇을 재나
     A  옷을 입은 가구마다 **자리(slot) 위에서** GLB 윗면을 층 1 광선으로 잰다
        → |GLB 윗면 − 자리 y| ≤ 0.01m  (화분이 뜨거나 파묻히지 않는다)
     B  같은 자리에서 **기본 광선(층 0)** 은 여전히 대리 상자 윗면을 맞춘다(= 자리 y)
        → 배치·칸·앉기 높이가 옛 그대로라는 뜻
     C  대리 메시는 material.visible=false 이고 g.visible 은 그대로다
     D  의자 좌판·침대 이불: surfaceTopAt(대리) 와 GLB 윗면 차이(앉기·눕기 높이가 맞나)
     E  옷 메시는 층 1 에만 있다(광선에 안 맞는다) · 소품도
     그림  방 전체·가구 가까이·문 쪽 — 캔버스만 따로 그린다(tools/_out/v2_furn/<tag>/)
   ⚠ 이 자는 «옷이 어디 붙었나»만 본다. 게임 흐름(대사·배치)은 tools/playshot.mjs 로 본다. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { launch, sleep } from '../test_cdp.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k);
  return i >= 0 ? (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true) : d; };
const BASE = process.env.BYEOT_URL || 'http://localhost:8984';
const Q = String(arg('q', ''));
const TAG = String(arg('tag', Q ? Q.replace(/[^a-z0-9]+/gi, '_') : 'on'));
const OUT = path.join(ROOT, 'tools', '_out', 'v2_furn', TAG);
fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) if (/\.(png|json)$/.test(f)) fs.unlinkSync(path.join(OUT, f));

const page = await launch({ width: 1280, height: 720, dpr: 1 });
const errs = [];
page.on((m, p) => {
  if (m === 'Runtime.exceptionThrown') errs.push('EXC ' + ((p.exceptionDetails.exception || {}).description || p.exceptionDetails.text));
  if (m === 'Runtime.consoleAPICalled' && p.type === 'error') errs.push('console.error ' + p.args.map(a => a.value ?? a.description).join(' '));
  if (m === 'Log.entryAdded' && p.entry.level === 'error' && !/favicon.ico/.test(p.entry.url || '')) errs.push('log ' + p.entry.text + ' ' + (p.entry.url || ''));
});
await page.goto(`${BASE}/game.html${Q ? '?' + Q : ''}`);
await page.eval(`localStorage.clear()`, false);
await page.goto(`${BASE}/game.html${Q ? '?' + Q : ''}`);
await page.waitFor('window.__byeotBooted === true', 180000, 300);
await sleep(4500);                                     // 소품은 방이 뜬 뒤 받는다

let pass = 0, fail = 0;
const ok = (name, cond, info) => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };

if (arg('pots')) {
  /* 상판 자리마다 시루를 올려 본다 — 뜨거나 파묻히나를 그림으로 */
  const r = await page.eval(`(async()=>{ const rv=window.__rv; const out=[];
    for (const s of rv.slots()) { if (!/desk|dresser|nightstand/.test(s.slotId)) continue;
      try { await rv.setPlant(s.slotId, { kind:'beansprout', progress01:0.6 }); out.push(s.slotId); } catch(e){ out.push('X '+s.slotId+' '+e.message); } }
    return JSON.stringify(out); })()`);
  console.log('시루 올림:', r);
  await sleep(1500);
}

const R = JSON.parse(await page.eval(`(()=>{
  const THREE = window.THREE, rv = window.__rv, T = rv.three;
  const rep = window.__v2 && window.__v2.furn ? window.__v2.furn.report() : null;
  const L1 = new THREE.Raycaster(); L1.layers.set(1);
  const L0 = new THREE.Raycaster();
  const down = new THREE.Vector3(0,-1,0);
  const groups = [];
  T.scene.traverse(o => { if (o.userData && o.userData.uid && o.userData.size && !o.userData.isPreview) groups.push(o); });
  const rows = [];
  for (const g of groups) {
    const dress = g.children.find(c => c.userData && c.userData.v2dress);
    const proxies = []; g.traverse(o => { if (o.isMesh && !(function(){ for(let p=o;p&&p!==g;p=p.parent) if(p.userData&&p.userData.v2dress) return true; return false; })()) proxies.push(o); });
    const row = { uid: g.userData.uid, type: g.userData.type, gVisible: g.visible, dressed: !!dress,
      proxies: proxies.length, proxiesHidden: proxies.filter(m => m.material && m.material.visible === false).length,
      dressLayersOk: true, slots: [] };
    if (dress) dress.traverse(o => { if (o.layers.mask !== 2) row.dressLayersOk = false; });
    g.updateWorldMatrix(true, true);
    for (const s of (g.userData.slots || [])) {
      const w = g.localToWorld(new THREE.Vector3(s.x, s.y, s.z));
      L1.set(new THREE.Vector3(w.x, w.y + 1.5, w.z), down);
      const h1 = dress ? L1.intersectObject(dress, true)[0] : null;
      L0.set(new THREE.Vector3(w.x, w.y + 1.5, w.z), down);
      const h0 = L0.intersectObject(g, true)[0];
      row.slots.push({ y: +w.y.toFixed(4), glb: h1 ? +h1.point.y.toFixed(4) : null,
                       proxy: h0 ? +h0.point.y.toFixed(4) : null,
                       proxyIsDress: h0 ? !!(function(){ for(let p=h0.object;p;p=p.parent) if(p.userData&&p.userData.v2dress) return true; return false; })() : null });
    }
    if (dress && /chair|bed/.test(g.userData.type)) {
      const lp = g.userData.type === 'chair' ? [0, 0.05] : [0, 0.25];
      const w = g.localToWorld(new THREE.Vector3(lp[0], 0, lp[1]));
      const st = rv.surfaceTopAt(w.x, w.z);
      L1.set(new THREE.Vector3(w.x, 3, w.z), down);
      const h1 = L1.intersectObject(dress, true)[0];
      row.seat = { surfaceTopAt: st && st.y, glb: h1 ? +h1.point.y.toFixed(4) : null };
    }
    rows.push(row);
  }
  let layerLeak = 0;
  const props = T.scene.getObjectByName('v2props');
  if (props) props.traverse(o => { if (o.isMesh && o.layers.mask !== 2) layerLeak++; });
  return JSON.stringify({ rep, rows, propsN: props ? props.children.length : 0, layerLeak,
                          camMask: T.cam.layers.mask, stats: rv.stats() });
})()`));
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(R, null, 1));

const on = !!(R.rep && R.rep.on);
console.log(`v2furn ${on ? '켬' : '끔'} · 삼각형 ${R.stats.triangles} · 콜 ${R.stats.calls} · 소품 ${R.propsN}`);
for (const r of R.rows) {
  if (!r.dressed && !on) continue;
  if (!r.dressed) continue;
  for (const [i, s] of r.slots.entries()) {
    ok(`A ${r.uid}:${i} GLB 윗면 = 자리 y (±0.01)`, s.glb != null && Math.abs(s.glb - s.y) <= 0.01, `자리 ${s.y} · GLB ${s.glb}`);
    ok(`B ${r.uid}:${i} 기본 광선은 대리를 맞춘다`, s.proxy != null && Math.abs(s.proxy - s.y) <= 0.002 && !s.proxyIsDress, `대리 ${s.proxy}`);
  }
  ok(`C ${r.uid} 대리 ${r.proxies}개 전부 숨김 · g.visible 그대로`, r.proxiesHidden === r.proxies && r.gVisible === true);
  ok(`E ${r.uid} 옷은 층 1 에만`, r.dressLayersOk);
  if (r.seat) ok(`D ${r.uid} 앉기/눕기 면(대리) ≈ GLB 윗면 (±0.02)`,
    r.seat.glb != null && Math.abs(r.seat.glb - r.seat.surfaceTopAt) <= 0.02, JSON.stringify(r.seat));
}
if (on) {
  ok('E 소품 메시도 층 1 에만', R.layerLeak === 0, `샌 것 ${R.layerLeak}`);
  ok('E 카메라가 층 0·1 을 본다', (R.camMask & 3) === 3, `mask ${R.camMask}`);
}

/* ── 그림 — 캔버스만 따로 그린다(카메라 여러 곳) ── */
const views = {
  overview: { pos: [4.2, 4.6, 5.4], look: [0, 0.3, 0], fov: 38 },
  desk:     { pos: [1.2, 1.7, 1.2],  look: [1.3, 0.55, -1.4], fov: 45 },
  bed:      { pos: [0.4, 1.9, 1.4],  look: [-1.8, 0.4, -0.8], fov: 45 },
  dresser:  { pos: [0.3, 1.6, 0.6],  look: [2.1, 0.6, 1.4], fov: 45 },
  door:     { pos: [0.9, 1.8, -0.4], look: [-1.5, 0.3, 1.2], fov: 50 },
  window:   { pos: [0.6, 1.5, 0.9],  look: [-0.7, 0.6, -1.6], fov: 50 }
};
for (const [name, v] of Object.entries(views)) {
  const data = await page.eval(`(()=>{ const THREE=window.THREE, T=window.__rv.three;
    const cv=T.renderer.domElement; const c=new THREE.PerspectiveCamera(${v.fov}, cv.width/cv.height, 0.05, 100);
    c.layers.mask = T.cam.layers.mask;
    c.position.set(${v.pos}); c.lookAt(${v.look}); c.updateMatrixWorld(true);
    T.renderer.render(T.scene, c); const u = cv.toDataURL('image/png');
    window.__rv.redraw(); return u; })()`);
  fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(data.split(',')[1], 'base64'));
}
await page.shot(path.join(OUT, 'screen.png'));
console.log(`\n콘솔 오류 ${errs.length}건${errs.length ? '\n  ' + errs.slice(0, 8).join('\n  ') : ''}`);
ok('콘솔 오류 0', errs.length === 0);
console.log(`\n${fail ? 'FAIL' : 'PASS'} ${pass}/${pass + fail} · 그림 ${OUT}`);
await page.close();
process.exit(fail ? 1 : 0);
