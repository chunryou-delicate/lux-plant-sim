/* tools/probe_furn_focus.mjs — **화분을 받는 가구를 누르면 그 가구로 다가가나 · 닫으면 돌아오나** (2026-10-09 · core · 총괄 D46 덤 · house §D46 셈)
   ------------------------------------------------------------
   판: 새 판(반지하) — 3단 에타지에(banjiha-etagere · 자리 9) · 침대(자리 없음)
   잰다: ① 에타지에를 고르면(가구 메뉴 길 · window.__furn.select) 카메라가 다가간다(camFocused · 카메라 거리 줄어듦) · 찍음
         ② 담는 상자 — 꼭대기 ≥ 맨 윗자리 + 0.35 · 거리 0.6~3.6 · 세로가 화면에 다 든다(hh/tanV ≤ 거리)
         ③ 메뉴를 닫으면 방 전체로 돌아온다(카메라 거리 처음과 같음) · [옮기기]를 누르면 바로 돌아온다
         ④ 침대(자리 없음)는 다가가지 않는다
   OUTDIR= (선택) · BYEOT_URL=(기본 127.0.0.1:9300) */
import fs from 'node:fs';
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9300';
const OUTDIR = process.env.OUTDIR || null; if (OUTDIR) fs.mkdirSync(OUTDIR, { recursive: true });
const page = await launch({ width: 390, height: 844, dpr: 1 });
let bad = 0; const ok = (c, m) => { console.log(`  ${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) bad++; };
const J = async (js, ms = 120000) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, ms));
const camD = () => J(`(()=>{ const t=window.__rv.three; const c=t.cam; const o=t.controls && t.controls.target ? t.controls.target : null;
  return { x:+c.position.x.toFixed(3), y:+c.position.y.toFixed(3), z:+c.position.z.toFixed(3), r: +Math.hypot(c.position.x, c.position.y, c.position.z).toFixed(3) }; })()`);
const near = (a, b, e = 0.05) => a && b && Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < e;
try {
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true; try{ if(!sessionStorage.__ff){ localStorage.clear(); sessionStorage.__ff='1'; } }catch(e){}` });
  await page.goto(`${BASE}/game.html`); await page.waitFor('!!window.__rv', 600000, 500); await sleep(5000);
  for (let i = 0; i < 60; i++) { if (await page.eval(`String(document.getElementById('stage').classList.contains('talking'))`) !== 'true') break;
    await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s) s.click();})()`, false); await sleep(200); }
  await sleep(1500);
  const c0 = await camD();
  if (OUTDIR) await page.shot(`${OUTDIR}/0_room.png`);
  /* ① 고르기 */
  await J(`(()=>{ const f=(window.__rv.furniture()||[]).find(x=>x.uid==='banjiha-etagere'); const cr=document.getElementById('roomCanvas').getBoundingClientRect();
    window.__furn.select(f, cr.left+cr.width/2, cr.top+cr.height/2); return 1; })()`);
  let c1 = null;
  for (let i = 0; i < 12; i++) { await sleep(500); c1 = await camD(); if (!near(c0, c1)) { await sleep(1500); c1 = await camD(); break; } }   /* 다가가는 트윈을 기다린다 */
  const st = await J(`(()=>({ focused: !!window.__furn.camFocused, uid: window.__furn.uid }))()`);
  if (OUTDIR) await page.shot(`${OUTDIR}/1_etagere_focus.png`);
  console.log('① —', JSON.stringify({ c0, c1, st }));
  ok(st.focused && !near(c0, c1), '에타지에를 고르면 카메라가 다가간다');
  /* ② 셈 */
  const f = await J(`(()=>{ const r=window.__rv.focusFurniture('banjiha-etagere', true); const sl=(window.__io.light.room.slots||[]).filter(s=>String(s.slotId).startsWith('banjiha-etagere:'));
    const t=window.__rv.three.cam; const tanV=Math.tan(t.fov*Math.PI/360); return { r, topSlot: Math.max(...sl.map(s=>s.y)), tanV, aspect:t.aspect }; })()`);
  console.log('② —', JSON.stringify(f));
  ok(f.r && f.r.box.top >= f.topSlot + 0.35 - 1e-6, `꼭대기 ${f.r && f.r.box.top} ≥ 맨 윗자리 ${f.topSlot} + 0.35`);
  ok(f.r && f.r.want >= 0.6 && f.r.want <= 3.6, `거리 ${f.r && f.r.want} 가 0.6~3.6 안`);
  ok(f.r && ((f.r.box.top - f.r.box.minY) / 2 * 1.15) / f.tanV <= f.r.dist + 0.02, '세로(단)가 화면에 다 든다');
  /* ③ 닫기 → 돌아옴 */
  await page.eval(`(()=>{ window.__furn.clear(); })()`, false); await sleep(2500);
  const c2 = await camD();
  console.log('③ 닫음 —', JSON.stringify(c2));
  ok(near(c0, c2, 0.08), '메뉴를 닫으면 방 전체로 돌아온다');
  await J(`(()=>{ const f=(window.__rv.furniture()||[]).find(x=>x.uid==='banjiha-etagere'); const cr=document.getElementById('roomCanvas').getBoundingClientRect();
    window.__furn.select(f, cr.left+cr.width/2, cr.top+cr.height/2); return 1; })()`); await sleep(2000);
  await J(`(()=>{ window.__furn.beginMove(); return 1; })()`); await sleep(300);
  const c3 = await camD();
  console.log('③ 옮기기 —', JSON.stringify(c3));
  ok(near(c0, c3, 0.08), '[옮기기]를 누르면 바로 방 전체로 돌아온다');
  await page.eval(`(()=>{ window.__furn.mode=null; window.__furn.clear(); })()`, false); await sleep(1500);
  /* ④ 침대 */
  await J(`(()=>{ const f=(window.__rv.furniture()||[]).find(x=>x.uid==='banjiha-bed'); const cr=document.getElementById('roomCanvas').getBoundingClientRect();
    window.__furn.select(f, cr.left+cr.width/2, cr.top+cr.height/2); return 1; })()`); await sleep(2000);
  const c4 = await camD(); const st4 = await J(`(()=>({ focused: !!window.__furn.camFocused }))()`);
  ok(!st4.focused && near(c0, c4, 0.08), '침대(자리 없음)는 다가가지 않는다');
} catch (e) { console.log('  FAIL 탈 —', e && e.message); bad++; }
finally { await page.close(); }
console.log(bad ? `probe_furn_focus: FAIL (${bad})` : 'probe_furn_focus: PASS');
process.exit(bad ? 1 : 0);
