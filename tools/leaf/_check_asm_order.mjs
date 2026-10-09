/* tools/leaf/_check_asm_order.mjs — «조립기가 앞 그루보다 어린 그루를 지으면 무늬가 빠지나» ([leaf] 10-09 · 재현 도구)
   방 조립기(plant_assemble · 한 인스턴스)는 assemble 마다 plantSeed → __setLeafState → setLeafSkins → setGrowth(days) 차례로 꽂는다.
   plant_grow.setGrowth 는 «뒤로 가면»(days < 지금 GROWTH) matResetAll() 을 부른다 — 방금 꽂은 잎 상태·그림표가 지워져 무늬 잎이 민잎(leaf_mid1)으로 그려진다.
   ⇒ 같은 인자라도 «바로 앞에 지은 그루가 더 늙었으면» 무늬가 빠진다(모주 417일 뒤 삽수 62일 · 삽수 75일 뒤 62일 · 두 화분도 같은 길).
   잰다: ① 1일 그루 뒤 · 400일 그루 뒤에 같은 62일 화분(assemble · 무늬 잎 1) ② 같은 순서로 작은 그루(youngPlantOf · 무늬 1장)
   10-09: ① 1일 뒤 albo7 · 400일 뒤 leaf_mid1 ② 같음. 방에서는 무늬 삽수 cut_01·cut_04 가 60초 뒤에도 민잎(cut_02 만 무늬 · 75일이라 앞보다 늙음).
   SAVE=(아무 세이브 · 없으면 새 판) · BYEOT_URL=(기본 127.0.0.1:9340 · tools/serve.py) */
import fs from 'node:fs';
import { launch, sleep } from '../test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9340';
const SAVE = process.env.SAVE ? fs.readFileSync(process.env.SAVE, 'utf8') : null;
const page = await launch({ width: 390, height: 844, dpr: 1 });
if (SAVE) await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `try{ if(!sessionStorage.__c){ localStorage.clear(); localStorage.setItem('byeot/save/1', ${JSON.stringify(SAVE)}); sessionStorage.__c='1'; } }catch(e){}` });
await page.goto(`${BASE}/game.html`);
{ let ok = false; for (let i = 0; i < 100; i++) { await sleep(3000); if (await page.eval('String(!!window.__rv)') === 'true') { ok = true; break; } }
  if (!ok) { console.error('⛔ 안 섬'); await page.close(); process.exit(4); } }
await sleep(8000);
const r = await page.eval(`(async()=>{ const pa=await import('/src/render3d/plant_assemble.js'); const asm=await pa.getPlantAssembler({});
  const keys=p=>{ const ks=[]; if(p) p.traverse(x=>{ const k=x.userData&&x.userData.assetKey; if(k&&/^leaf/.test(k)) ks.push(k); }); return ks; };
  const SEED=4154389251, SKIN='leaf_mid_albo7';
  const pot=()=>keys(asm.assemble({ growthDays:62, seed:SEED, leafState:[{leafBirth:36, varie:true}], leafSkins:[{leafBirth:36, mid:SKIN, mat:'leaf_mat7'}] }));
  const young=()=>keys(asm.youngPlantOf({ seed:SEED, leaves:[{varie:true, midSkin:SKIN, matSkin:'leaf_mat7', matured:false}], nextLeaf01:0.45, potD:0.12, grewLeaves:0, species:'monstera', withPot:false }));
  const out={};
  /* 그림을 먼저 받아 둔다(한 번 지어 받게 하고 다 올 때까지) — 늦게 와서 민잎인 것과 가르려고 */
  asm.assemble({ growthDays:1, seed:999 }); pot(); for (let i=0; i<200 && asm.skinsPending(); i++) await new Promise(r=>setTimeout(r,100));
  asm.assemble({ growthDays:1, seed:999 });      out['① 1일 뒤 화분'] = pot();
  asm.assemble({ growthDays:400, seed:12345 });  out['① 400일 뒤 화분'] = pot();
  asm.assemble({ growthDays:1, seed:999 });      out['② 1일 뒤 작은 그루'] = young();
  asm.assemble({ growthDays:400, seed:12345 });  out['② 400일 뒤 작은 그루'] = young();
  return JSON.stringify(out); })()`, true, 120000);
const o = JSON.parse(r); for (const [k, v] of Object.entries(o)) console.log(k, '—', v.join(','), v.some(x => /albo/.test(x)) ? '✅ 무늬' : '❌ 민잎');
await page.close();
