/* tools/leaf/_shot_halfmoon.mjs — 하프문 중간잎(29)을 «그려서» 본다
   plant_grow 를 헤드리스로 열고, 모든 잎을 무늬로 · 중간잎 그림을 하나로 고정해 찍는다.
   ⛔ 파일은 안 고친다(브라우저 안에서만 손잡이를 돌린다).
   OUT= 나갈 자리 (필수 · 이미 있으면 안 돈다) · PICK= 중간잎 번호 · BLADE= bladeR 덮어쓰기(선택) */
import { launch, sleep } from '../test_cdp.mjs';
import fs from 'node:fs';
const OUT = process.env.OUT; if (!OUT) { console.error('⛔ OUT='); process.exit(2); }
if (fs.existsSync(OUT)) { console.error('⛔ 이미 있다', OUT); process.exit(2); }
const PICK = Number(process.env.PICK || 29), G = Number(process.env.G || 130);
const BASE = 'http://localhost:9340';
const page = await launch({ width: 700, height: 700, dpr: 1 });
await page.goto(`${BASE}/plant_grow.html`);
await page.waitFor(`typeof ASSETS!=='undefined' && Object.keys(ASSETS).length>20`, 120000, 300);
await sleep(1500);
const r = await page.eval(`(()=>{ try{
  P.varieProb=1; P.alboMidPick=${PICK}; P.matAlboPick=0;
  ${process.env.FILE ? `ASSET_FILES['leaf_mid_albo${PICK}']='${process.env.FILE}';` : ''}
  ${process.env.BLADE ? `ADJ['leaf_mid_albo${PICK}']=Object.assign({},ADJ['leaf_mid_albo${PICK}']||{}, {bladeR:${Number(process.env.BLADE)}});` : ''}
  plantSeed(${Number(process.env.SEED||7)});
  const s=setGrowth(${G});
  return JSON.stringify({s, adj: ADJ['leaf_mid_albo${PICK}']});
}catch(e){ return 'ERR '+e.message; } })()`);
console.log('세움:', r);
for (let i = 0; i < 20; i++) {
  const p = await page.eval(`(()=>{try{return String(skinsPending());}catch(e){return '?';}})()`);
  if (p === '0') break; await sleep(500);
}
/* ★ 무늬는 빛 이력이 있어야 난다(캐논) — 헤드리스엔 이력이 없으니 «잎마다» 무늬 판정을 켠다 */
console.log('무늬 켬:', await page.eval(`(()=>{try{ let n=0;
  for(const r of (leafSkinUsedAll()||[])){ VARIE_STATE.set(r.leafBirth,true); n++; }
  redraw(); return String(n);}catch(e){return 'ERR '+e.message;}})()`));
for (let i = 0; i < 30; i++) {
  const p = await page.eval(`(()=>{try{return String(skinsPending());}catch(e){return '?';}})()`);
  if (p === '0') break; await sleep(500);
}
await page.eval(`(()=>{try{ if(typeof PET_CACHE!=='undefined') PET_CACHE={}; ensureLeafShape&&ensureLeafShape(); redraw(); }catch(e){}})()`, false);
await sleep(2500);
console.log('쓰는 그림:', await page.eval(`(()=>{try{return JSON.stringify((leafSkinUsedAll()||[]).map(r=>r.key).filter(Boolean));}catch(e){return 'ERR '+e.message;}})()`));
/* 판(UI)을 숨기고 그림판만 남긴다 */
await page.eval(`(()=>{ const c=document.querySelector('canvas'); if(!c) return;
  const keep=new Set(); let e=c; while(e){ keep.add(e); e=e.parentElement; }
  for(const el of document.body.querySelectorAll('*')) if(!keep.has(el) && !el.contains(c) && el!==c && !(el.tagName==='CANVAS')) el.style.visibility='hidden';
})()`, false);
await sleep(800);
await page.shot(OUT);
console.log('찍음', OUT);
await page.close();
