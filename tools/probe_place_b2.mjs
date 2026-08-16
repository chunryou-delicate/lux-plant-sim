/* B-1 을 지름별로 훑고, B-3 의 붉은 칸이 「스냅 뒤 판정」과 얼마나 다른지 잰다.
   B-5 는 **겹치지 않는 자리**로 다시 잰다(앞 probe 는 의자와 겹쳐 못 옮겼다). */
import { launch, sleep } from './test_cdp.mjs';
const _wd = setTimeout(() => { console.error('⏱'); process.exit(2); }, 420000); _wd.unref && _wd.unref();
const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const page = await launch({ width: 1280, height: 900, dpr: 1, mobile: false });
await page.goto(`${BASE}/game.html`);
await page.eval(`localStorage.clear()`, false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 180000, 300);
await page.waitFor('window.__byeotBooted === true', 180000, 300);
await sleep(6000);
await page.eval(`(()=>{ for(let i=0;i<40;i++){ try{ document.getElementById('dlgSkip').click() }catch{} } })()`, false);
await sleep(1500);
const J = s => JSON.parse(s);

console.log('■ B-1 · 지름별 「상판에 그려지는 표시 수」 (칸 + 자리)');
console.log('  ★ 어긋난자리 = 그 상판의 칸 한가운데에 안 앉은 추천 자리 = 남는 표시');
for (const potD of [0.20, 0.24, 0.30, 0.42, 0.517, 0.97]) {
  const r = J(await page.eval(`(()=>{ const rv=window.__rv;
    rv.showSlotRings(true, { potD: ${potD} });
    const cells = rv.guideCells({ potD: ${potD} });
    const slots = rv.slots().map(s=>({ slotId:s.slotId, x:s.pos.x, y:s.pos.y, z:s.pos.z,
                                       uid:String(s.slotId).slice(0,String(s.slotId).lastIndexOf(':')) }));
    const out = {};
    for (const uid of ['banjiha-desk','banjiha-dresser','banjiha-etagere','banjiha-sill']) {
      const cs = cells.filter(c=>c.uid===uid), ss = slots.filter(s=>s.uid===uid);
      /* 이 상판의 칸 격자를 자리 쪽에서 되짚는다 — 자리가 칸 한가운데면 그 칸은 안 그려진다(CELL_SAME) */
      const bad = ss.filter(s => cs.some(c=>Math.abs(c.y-s.y)<0.06) === false ? false
        : cs.filter(c=>Math.abs(c.y-s.y)<0.06).every(c=>Math.hypot(c.x-s.x,c.z-s.z) > 0.13));
      out[uid] = { 칸: cs.length, 자리: ss.length, 표시: cs.length+ss.length,
                   어긋난자리: bad.length ? bad.map(b=>b.slotId) : 0 };
    }
    return JSON.stringify(out); })()`));
  console.log(`  potD ${potD} ` + JSON.stringify(r));
}

console.log('\n■ B-3 · 붉은 칸 — 「칸 한가운데 그대로」 판정 vs 「스냅 뒤」 판정');
for (const uid of ['banjiha-bed', 'banjiha-desk', 'banjiha-dresser', 'banjiha-chair']) {
  const r = J(await page.eval(`(()=>{ const rv=window.__rv;
    const g = rv.grid(); const inn = g.room.inner; const CELL=g.cell, step=rv.moveStep();
    const f = (rv.furniture()||[]).find(x=>x.uid==='${uid}'); if(!f) return JSON.stringify(null);
    let raw=0, snapped=0, total=0, diff=0;
    const nx=g.room.cols, nz=g.room.rows;
    for(let i=0;i<nx;i++) for(let j=0;j<nz;j++){
      const cx=inn.x0+(i+0.5)*CELL, cz=inn.z0+(j+0.5)*CELL;
      total++;
      const a = rv.furnitureFit('${uid}',{x:cx,z:cz,rot:f.rot}).ok;
      const sn = rv.snapFurniture('${uid}',{x:cx,z:cz,rot:f.rot,step});
      const b = rv.furnitureFit('${uid}',{x:sn.x,z:sn.z,rot:sn.rot}).ok;
      if(!a) raw++; if(!b) snapped++; if(a!==b) diff++;
    }
    return JSON.stringify({ uid:'${uid}', 크기:f.size, 전체칸:total,
                            붉은_지금:raw, 붉은_스냅뒤:snapped, 판정이바뀌는칸:diff }); })()`));
  console.log('  ' + JSON.stringify(r));
}

console.log('\n■ B-5 · 책상을 x 로만 옮긴다(겹치지 않는 자리)');
const b5 = J(await page.eval(`(async()=>{ const rv=window.__rv;
  const spec = { kind:'monstera', days: 60 };
  const s0 = rv.slots().find(s=>s.slotId==='banjiha-desk:0');
  await rv.setPlant('banjiha-desk:0', spec);
  const cells = rv.guideCells({ potD: 0.20 }).filter(c=>c.uid==='banjiha-desk' && c.fits);
  const c = cells[0];
  await rv.setPlantAt('probe-free', { x:c.x, y:c.y, z:c.z, rotY:0, onUid:'banjiha-desk', occIdx:null }, spec);
  const pick = ()=> rv.plants().map(p=>({ key:p.key, x:+p.pos.x.toFixed(3), y:+p.pos.y.toFixed(3), z:+p.pos.z.toFixed(3) }));
  const before = { desk: rv.furniture().find(f=>f.uid==='banjiha-desk'), pots: pick(),
                   riders: rv.ridersOf('banjiha-desk'),
                   clip: rv.lightRigs().find(r=>r.uid==='banjiha-growlight-clip').pos };
  const f = before.desk;
  let err=null, res=null;
  try { res = await rv.commitFurnitureAt('banjiha-desk', { x: f.x-0.5, z: f.z, rot: f.rot, step: rv.moveStep() }); }
  catch(e){ err=e.message; }
  const after = { desk: rv.furniture().find(x=>x.uid==='banjiha-desk'), pots: pick(),
                  clip: rv.lightRigs().find(r=>r.uid==='banjiha-growlight-clip').pos };
  return JSON.stringify({ before, res, err, after }); })()`));
console.log('  전 ' + JSON.stringify(b5.before));
console.log('  결과 ' + JSON.stringify(b5.res) + ' 오류 ' + b5.err);
console.log('  후 ' + JSON.stringify(b5.after));

console.log('\n■ B-5b · 책상을 90° 돌린다');
const b5b = J(await page.eval(`(async()=>{ const rv=window.__rv;
  const pick = ()=> rv.plants().map(p=>({ key:p.key, x:+p.pos.x.toFixed(3), y:+p.pos.y.toFixed(3), z:+p.pos.z.toFixed(3), yaw:+(p.yaw||0).toFixed(3) }));
  const f = rv.furniture().find(x=>x.uid==='banjiha-desk');
  const before = { desk:f, pots: pick() };
  let err=null,res=null;
  try { res = await rv.commitFurnitureAt('banjiha-desk', { x:f.x, z:f.z, rot: (f.rot||0)+90, step: rv.moveStep() }); }
  catch(e){ err=e.message; }
  return JSON.stringify({ before, res, err,
    after: { desk: rv.furniture().find(x=>x.uid==='banjiha-desk'), pots: pick() } }); })()`));
console.log('  전 ' + JSON.stringify(b5b.before));
console.log('  결과 ' + JSON.stringify(b5b.res) + ' 오류 ' + b5b.err);
console.log('  후 ' + JSON.stringify(b5b.after));
await page.close();
