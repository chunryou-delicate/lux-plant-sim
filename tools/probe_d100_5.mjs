/* 총괄 D100 #5 자(core 11-01 · 비판 다섯째 판 ⑤ #5 d96_placed) — 390×844
   판: 총괄 humanQ g premove(반지하 Day 134) → [다음 날] → 이사(probe_b2_unpack 과 같은 손 · 지갑 손질) → 원룸 첫날
   손: [가방] 들고 온 가구 칸을 FURN_MAX 개(기본 1)만 누른다(자리가 모자란 판) → 이삿짐 콩나물 · 재배판 칸을 차례로 누르고 [확인]
   ㉮ 게임이 고른 자리의 [확인] 바 빛 줄이 그 작물 «가장 낮은 등급»(tone bad — 콩나물 초록·쓴맛 · 무순 웃자라 밍밍)이 아니다
   ㉯ 맞는 자리가 없으면 놓지 않고 말한다(«맞는 자리가 없습니다» 또는 «빈 자리가 없습니다» — «못 찾았습니다» 아님)
   예외 0 */
import fs from 'node:fs';
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9448', OUT = process.env.OUT || null;
const SAVE = process.env.SAVE || 'C:/Users/pc/AppData/Local/Temp/byeot-master/d_66841206/humanQ/humanQ_g_premove.json';
const FURN_MAX = +(process.env.FURN_MAX || 1);
if (OUT) fs.mkdirSync(OUT, { recursive: true });
let bad = 0; const ok = (c, m, d = '') => { console.log(`${c ? '  OK' : 'FAIL'}  ${m}${d ? '  → ' + d : ''}`); if (!c) bad++; };
const exc = [];
const page = await launch({ width: 390, height: 844, dpr: 2 });
page.on((method, p) => { if (method === 'Runtime.exceptionThrown') exc.push(((p.exceptionDetails.exception && p.exceptionDetails.exception.description) || p.exceptionDetails.text || '').split('\n')[0].slice(0, 200)); });
await page.send('Runtime.enable');
await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true;` });
const J = async (js) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, 120000));
await page.goto(`${BASE}/data/balance/homes.json`);
await page.eval(`(()=>{ localStorage.clear(); localStorage.setItem('byeot/save/1', ${JSON.stringify(fs.readFileSync(SAVE, 'utf8'))}); localStorage.setItem('byeot.guideSeen','1'); return 1; })()`, false);
await page.goto(`${BASE}/game.html`); await page.waitFor('window.__byeotBooted === true', 300000, 500); await page.waitFor('!!window.__rv', 240000, 500); await sleep(4000);
const dlgOnly = async () => { for (let i = 0; i < 80; i++) { const t = await J(`document.getElementById('stage').classList.contains('talking')`); if (!t) return; await page.eval(`(()=>{ const s=document.getElementById('dlgSkip'); if(s) s.click(); const b=document.getElementById('dlgBox'); if(b) b.click(); return 1; })()`, false); await sleep(250); } };
await dlgOnly();
/* 이사(probe_b2_unpack 과 같은 손) */
await page.eval(`(()=>{ const b=document.getElementById('next'); b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})); b.click(); return 1; })()`, false);
await sleep(1500); await page.eval(`(()=>{ const g=document.getElementById('mealGo'); if (g && g.offsetParent) g.click(); return 1; })()`, false);
await sleep(4000); await dlgOnly();
await J(`(()=>{ const ts=window.__S().tutorial; ts.cashWon = ts.rules.moveOutCostWon + 302780; window.__redraw(); return 1; })()`);
for (let i = 0; i < 6; i++) {
  const mv = await J(`(()=>({ moved: !!window.__S().tutorial.movedOut, panel: document.getElementById('movePanel').classList.contains('on') }))()`);
  if (mv.moved) break;
  if (mv.panel) await page.eval(`(()=>{ document.getElementById('moveGo').click(); return 1; })()`, false);
  else await page.eval(`(()=>{ window.__byeotSheet.tab('room'); document.getElementById('moveOut').click(); return 1; })()`, false);
  await sleep(1200); await dlgOnly();
}
await sleep(6000); await page.waitFor('!!window.__rv', 240000, 500); await sleep(3000); await dlgOnly();
const banner = () => J(`(()=>{ const e=document.getElementById('event'); return e && e.classList.contains('on') ? (e.innerText||'').replace(/\\s+/g,' ').slice(0,120) : ''; })()`);
const bagState = () => J(`(()=>{ window.__byeotSheet.open('bag'); const g=document.getElementById('bagGrid');
  return { furn: [...g.querySelectorAll('[data-furnbag]')].map(b=>b.getAttribute('data-furnbag')), boxB: (g.querySelector('[data-place="box:beansprout"] .qty')||{}).textContent || null, boxM: (g.querySelector('[data-place="box:musun"] .qty')||{}).textContent || null }; })()`);
const room0 = await J(`(()=>({ room: window.__S().home.room, day: window.__S().day }))()`);
ok(room0.room === 'oneroom', '판 — 원룸 이사 직후', JSON.stringify(room0));
for (let i = 0; i < FURN_MAX; i++) {
  const st = await bagState(); if (!st.furn.length) break;
  await page.eval(`(()=>{ const b=document.querySelector('#bagGrid [data-furnbag="${st.furn[0]}"]'); if (b) b.click(); return 1; })()`, false);
  await sleep(2500); await dlgOnly();
}
const placedLog = []; let stop = null;
for (let i = 0; i < 40; i++) {
  const st = await bagState();
  const sel = st.boxB ? 'box:beansprout' : (st.boxM ? 'box:musun' : null);
  if (!sel) break;
  await page.eval(`(()=>{ const c=document.querySelector('#bagGrid [data-place="${sel}"]'); if (c) c.click(); return 1; })()`, false);
  await sleep(1500);
  const cf = await J(`(()=>{ const c=document.getElementById('stage').classList.contains('confirming'); const f=document.getElementById('placeConfirmFit'); return { c, who: (document.getElementById('placeConfirmWho')||{}).textContent || '', fit: f && f.style.display !== 'none' ? f.textContent : '', tone: f ? (f.classList.contains('bad') ? 'bad' : f.classList.contains('mid') ? 'mid' : 'ok') : null }; })()`);
  if (!cf.c) { stop = { sel, banner: await banner() }; break; }
  placedLog.push({ sel, who: cf.who, tone: cf.tone, fit: cf.fit.slice(0, 40) });
  await page.eval(`(()=>{ document.getElementById('placeOk').click(); return 1; })()`, false);
  await sleep(1300); await dlgOnly();
}
console.log('  놓은 것', JSON.stringify(placedLog));
console.log('  멈춤', JSON.stringify(stop));
if (OUT) await page.shot(`${OUT}/390_d100_5.png`);
const badOnes = placedLog.filter(p => p.tone === 'bad');
ok(placedLog.length > 0 || !!stop, '판 — 이삿짐 칸을 눌러 봤다', JSON.stringify({ n: placedLog.length, stop }));
ok(badOnes.length === 0, '㉮ 게임이 고른 자리가 그 작물 가장 낮은 등급(bad)이 아니다', JSON.stringify(badOnes.slice(0, 4)));
ok(!stop || /맞는 자리가 없습니다|빈 자리가 없습니다/.test(stop.banner), '㉯ 못 놓으면 «맞는 자리가 없습니다 / 빈 자리가 없습니다»라고 말한다', JSON.stringify(stop));
ok(exc.length === 0, '처리 안 된 예외 0', exc.slice(0, 3).join(' / '));
console.log(bad ? `probe_d100_5: 빨강 ${bad}` : 'probe_d100_5: 다 통과');
await page.close(); process.exit(bad ? 1 : 0);
