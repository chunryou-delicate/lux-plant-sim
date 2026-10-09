/* tools/leaf/_shot_stand.mjs — «원룸 화분대에 키운 그루가 여럿» 을 폰 크기로 찍는다 ([leaf] 10-09 · D41 그림 보기)
   SAVE(_walk_stand DUMP) 로 켜고 찍는다(화면 손질 0):
     stand_0_room.png   방 기본(켜진 그대로)
     stand_1_etagere.png 에타제르에 카메라를 붙임(게임 열쇠로 첫 삽수 focusSlot → 거리 1.6 · 조금 위)
     stand_2_side.png    옆 각
     stand_3_cut.png     삽수 하나에 붙임(게임의 누름 열쇠 — rv.plants 줄의 key)
   방에 선 그루·삽수 줄(종류·생장일)과 삽수 상태를 같이 적는다.
   CUT=<삽수 id>(붙일 삽수 · 없으면 첫 삽수) · SAVE= OUTDIR= (필수 · 비어 있어야) · BYEOT_URL=(기본 127.0.0.1:9340 · tools/serve.py) */
import fs from 'node:fs';
import { launch, sleep } from '../test_cdp.mjs';
const OUTDIR = process.env.OUTDIR, SAVEF = process.env.SAVE;
if (!OUTDIR || !SAVEF) { console.error('⛔ SAVE= OUTDIR='); process.exit(2); }
fs.mkdirSync(OUTDIR, { recursive: true }); if (fs.readdirSync(OUTDIR).length) { console.error('⛔ 비어 있지 않다'); process.exit(2); }
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9340';
const SAVE = fs.readFileSync(SAVEF, 'utf8');
const page = await launch({ width: 390, height: 844, dpr: 2 });
await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `try{ if(!sessionStorage.__c){ localStorage.clear(); localStorage.setItem('byeot/save/1', ${JSON.stringify(SAVE)}); sessionStorage.__c='1'; } }catch(e){}` });
await page.goto(`${BASE}/game.html`);
{ let ok = false; for (let i = 0; i < 100; i++) { await sleep(3000); if (await page.eval('String(!!window.__rv)') === 'true') { ok = true; break; } }
  if (!ok) { console.error('⛔ 안 섬'); await page.close(); process.exit(4); } }
await sleep(8000);
const J = async (js) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, 60000));
const quiet = async () => { for (let i = 0; i < 40; i++) { const t = await page.eval(`(()=>{const s=document.getElementById('stage'); return String(!!(s&&s.classList.contains('talking')));})()`); if (t !== 'true') break;
  await page.eval(`(()=>{const b=document.getElementById('dlgBox'); if(b)b.click();})()`, false); await sleep(250); } };
const camWait = async () => { for (let i = 0; i < 30; i++) { if (await page.eval(`(()=>{try{return String(!!window.__rv.camBusy());}catch(e){return 'false';}})()`) === 'false') break; await sleep(300); } await sleep(1500);
  await page.eval(`(()=>{try{window.__rv.redraw();}catch(e){}})()`, false); await sleep(500); };
await quiet();
const info = await J(`(async()=>{ const S=window.__S(); return { 방:S.home.room, 날:S.day,
  줄:(window.__rv.plants()||[]).map(r=>({key:r.key, potId:r.potId, kind:r.kind, 생장일:r.growthDays})),
  삽수:(S.cuttings||[]).map(c=>({id:c.id, 상태:c.status, 그릇:c.container, 잎:(c.leafVarie||[]).length, 무늬잎:(c.leafVarie||[]).filter(Boolean).length, 자리:c.slotId||(c.at&&c.at.onUid)||null})) }; })()`);
console.log('판 —', JSON.stringify(info));
await page.shot(`${OUTDIR}/stand_0_room.png`);
const cutRows = (info.줄 || []).filter(r => /^cut/.test(r.kind || ''));
const k0 = process.env.CUT ? ('free:' + process.env.CUT) : (cutRows[0] && cutRows[0].key);   // CUT=cut_03 — 그 삽수에 붙인다
if (k0) {
  await page.eval(`(()=>{try{window.__rv.focusSlot(${JSON.stringify(k0)},true);}catch(e){}})()`, false); await camWait();
  await page.eval(`(()=>{try{window.__rv.camTo({dist:1.6, el:0.35}, 150);}catch(e){}})()`, false); await camWait();
  await page.shot(`${OUTDIR}/stand_1_etagere.png`);
  await page.eval(`(()=>{try{const c=window.__rv.camera(); window.__rv.camTo({dist:1.8, az:(c.az||0)+1.1, el:0.45}, 150);}catch(e){}})()`, false); await camWait();
  await page.shot(`${OUTDIR}/stand_2_side.png`);
  await page.eval(`(()=>{try{window.__rv.focusSlot(null,true);}catch(e){}})()`, false); await camWait();
  await page.eval(`(()=>{try{window.__rv.focusSlot(${JSON.stringify(k0)},true);}catch(e){}})()`, false); await camWait();
  console.log('삽수 누름 카메라 —', await page.eval(`JSON.stringify(window.__rv.camera())`));
  await page.shot(`${OUTDIR}/stand_3_cut.png`);
} else console.log('⛔ 방에 선 삽수가 없다');
await page.close();
