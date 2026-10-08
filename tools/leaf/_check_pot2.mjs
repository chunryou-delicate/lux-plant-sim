/* tools/leaf/_check_pot2.mjs — «둘째 화분(씨앗 그루)을 방과 확대창이 같은 잎으로 그리나» ([leaf] 10-08 · 갈래 ①)
   SAVE(화분 둘) 로 켜고 → __redraw → 방이 그 화분에 넘긴 것(rv.plants 줄 · 마지막에 지은 그루의 잎 = leafSkinsInRoom) ·
   [식물] 장 🔍(data-plantbig=둘째) 로 확대 → 확대창이 고른 잎 열쇠 · 둘을 견준다 · 찍기(방 그 화분 · 확대)
   ⚠ leafSkinsInRoom 은 화분마다가 아니다(방뷰 조립기 한 벌 · 마지막에 지은 것) — 그래서 «둘째 화분만 다시 지은 직후»에 읽는다(setPlantAt 을 그 화분 spec 으로 한 번 더)
   SAVE= (필수) · OUTDIR= (필수 · 비어 있어야) · POT=pot_02 · BYEOT_URL=(기본 127.0.0.1:9340 · tools/serve.py) */
import fs from 'node:fs';
import { launch, sleep } from '../test_cdp.mjs';
const OUTDIR = process.env.OUTDIR, SAVEF = process.env.SAVE, POT = process.env.POT || 'pot_02';
if (!OUTDIR || !SAVEF) { console.error('⛔ SAVE= OUTDIR='); process.exit(2); }
fs.mkdirSync(OUTDIR, { recursive: true }); if (fs.readdirSync(OUTDIR).length) { console.error('⛔ 비어 있지 않다'); process.exit(2); }
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9340';
const SAVE = fs.readFileSync(SAVEF, 'utf8');
const page = await launch({ width: 390, height: 844, dpr: 1 });
await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `try{ if(!sessionStorage.__c){ localStorage.clear(); localStorage.setItem('byeot/save/1', ${JSON.stringify(SAVE)}); sessionStorage.__c='1'; } }catch(e){}` });
await page.goto(`${BASE}/game.html`);
{ let ok = false; for (let i = 0; i < 100; i++) { await sleep(3000); if (await page.eval('String(!!window.__rv)') === 'true') { ok = true; break; } }
  if (!ok) { console.error('⛔ 안 섬'); await page.close(); process.exit(4); } }
await sleep(7000);
const J = async (js, ms = 120000) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message, st:(e.stack||'').slice(0,240)}); } })()`, true, ms));
const clear = async () => { for (let i = 0; i < 40; i++) {
  const b = await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');return String(!!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on')));})()`);
  if (b !== 'true') return;
  await page.eval(`(()=>{const g=document.getElementById('guideClose'); if(g&&g.offsetParent){g.click();return;} const b=document.getElementById('dlgBox'); if(b)b.click();})()`, false); await sleep(250); } };
await clear();
await page.eval(`(()=>{try{window.__redraw()}catch(e){}})()`, false); await sleep(4000);
const room = await J(`(async()=>{ const S=window.__S(), io=window.__io, rv=window.__rv; const p=(S.pots||[]).find(x=>x.id==='${POT}');
  const row=(rv.plants()||[]).find(r=>r.potId==='${POT}');
  let rs=null; try { rs=rv.leafSkinsInRoom(); } catch(e) { rs='ERR '+e.message; }
  return { 화분:p&&{id:p.id, gid:p.growthId, growthSeed:p.growthSeed??null, 자리:p.slotId}, 방줄:row&&{kind:row.kind, 생장일:row.growthDays}, 마지막조립잎:Array.isArray(rs)?rs.map(x=>x.leafBirth+':'+x.key):rs, 꽂힌:io.growth.current&&io.growth.current() }; })()`);
console.log('방 —', JSON.stringify(room));
/* 그 화분을 방에서 찍는다 */
const shot = async (file, dist) => {
  await page.eval(`(()=>{try{ window.__rv.focusSlot(${JSON.stringify(room.화분 && room.화분.자리)},true);}catch(e){}})()`, false);
  for (let i = 0; i < 30; i++) { if (await page.eval(`(()=>{try{return String(!!window.__rv.camBusy());}catch(e){return 'false';}})()`) === 'false') break; await sleep(300); }
  await page.eval(`(()=>{try{window.__rv.camTo({dist:${dist}, el:0.45}, 150);}catch(e){}})()`, false); await sleep(2500);
  await page.eval(`(()=>{try{window.__rv.redraw();}catch(e){}})()`, false); await sleep(500); await page.shot(file); };
await shot(`${OUTDIR}/room_pot2.png`, 1.3);
/* 확대 — [식물] 장 🔍 */
await page.eval(`window.__byeotSheet.open('plants')`, false); await sleep(900);
const hit = await page.eval(`(()=>{const b=[...document.querySelectorAll('[data-plantbig]')].find(x=>x.dataset.plantbig==='${POT}'); if(!b) return 'none'; b.click(); return 'click';})()`);
await sleep(10000); await clear();
const zoom = await J(`(async()=>{ const io=window.__io; return { 꽂힌:io.growth.current&&io.growth.current(), 잎:(io.growth.leafSkinUsedAll()||[]).map(x=>x.leafBirth+':'+x.key+(x.varie?'*':'')) }; })()`);
console.log('확대(' + hit + ') —', JSON.stringify(zoom));
await page.shot(`${OUTDIR}/zoom_pot2.png`);
await page.eval(`(()=>{try{window.__byeotZoom.close()}catch(e){} try{window.__byeotSheet.close()}catch(e){}})()`, false); await sleep(1500);
/* 방: 그 화분만 다시 지어 조립기 상태를 그 화분 것으로 — syncRoom 이 다시 맞춘 직후 마지막 조립을 읽는다 */
const room2 = await J(`(async()=>{ const rv=window.__rv; let rs=null; try { rs=rv.leafSkinsInRoom(); } catch(e) {} return Array.isArray(rs)?rs.map(x=>x.leafBirth+':'+x.key):rs; })()`);
console.log('방(확대 닫은 뒤 마지막 조립) —', JSON.stringify(room2));
await page.close();
