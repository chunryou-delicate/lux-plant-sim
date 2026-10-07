/* tools/leaf/_shot_matgrid.mjs — 성숙 무늬 19가족을 «한 번 띄워» 차례로 찍는다 (D4 눈검사 재료)
   plant_grow 를 헤드리스로 열고 · 잎을 다 무늬로 켜고 · 성숙까지 세우고 · matAlboPick 을 갈아 끼우며 찍는다.
   ⛔ 파일은 안 고친다. OUTDIR= (필수 · 없으면 만든다 · 안에 파일이 있으면 안 돈다) · G= 생장일 · SEED= */
import { launch, sleep } from '../test_cdp.mjs';
import fs from 'node:fs';
const OUTDIR = process.env.OUTDIR; if (!OUTDIR) { console.error('⛔ OUTDIR='); process.exit(2); }
fs.mkdirSync(OUTDIR, { recursive: true });
if (fs.readdirSync(OUTDIR).length) { console.error('⛔ 비어 있지 않다', OUTDIR); process.exit(2); }
const G = Number(process.env.G || 420), SEED = Number(process.env.SEED || 7);
const NUMS = (process.env.NUMS || '1,4,7,10,13,16,19,22,25,28,31,34,37,40,43,46,49,52,55').split(',').map(Number);
const page = await launch({ width: 600, height: 600, dpr: 1 });
await page.goto('http://localhost:9340/plant_grow.html');
await page.waitFor(`typeof ASSETS!=='undefined' && Object.keys(ASSETS).length>20`, 150000, 300);
await sleep(1500);
console.log('세움:', await page.eval(`(()=>{try{ P.varieProb=1; P.alboMidPick=0; P.matAlboPick=${NUMS[0]};
  plantSeed(${SEED}); const s=setGrowth(${G});
  /* ★ 무늬·성숙은 빛 이력이 있어야 난다(캐논) — 헤드리스엔 이력이 없으니 «잎마다» 둘 다 켠다 */
  for(const r of (leafSkinUsedAll()||[])){ VARIE_STATE.set(r.leafBirth,true);
    MAT_STATE.set(r.leafBirth,{gauge:0, matured:true, rolls:1, locked:false}); }
  redraw();
  return JSON.stringify({s:s.drawn, 잎:(leafSkinUsedAll()||[]).length});}catch(e){return 'ERR '+e.message;}})()`));
/* 판(UI) 숨기기 */
await page.eval(`(()=>{ const c=document.querySelector('canvas'); if(!c) return;
  const keep=new Set(); let e=c; while(e){ keep.add(e); e=e.parentElement; }
  for(const el of document.body.querySelectorAll('*')) if(!keep.has(el) && el.tagName!=='CANVAS') el.style.visibility='hidden'; })()`, false);
for (const n of NUMS) {
  await page.eval(`(()=>{try{ P.matAlboPick=${n}; redraw(); }catch(e){}})()`, false);
  for (let i = 0; i < 40; i++) { const p = await page.eval(`String(skinsPending())`); if (p === '0') break; await sleep(400); }
  await page.eval(`(()=>{try{ redraw(); }catch(e){}})()`, false);
  await sleep(900);
  const used = await page.eval(`(()=>{try{return JSON.stringify((leafSkinUsedAll()||[]).map(r=>r.key).filter(k=>k&&/leaf_mat/.test(k)));}catch(e){return '[]';}})()`);
  await page.shot(`${OUTDIR}/mat_${String(n).padStart(2,'0')}.png`);
  console.log(`  mat${n} 찍음 · 쓰인 그림 ${used}`);
}
await page.close();
