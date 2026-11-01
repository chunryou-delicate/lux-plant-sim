/* 총괄 D100 #7 · #17 · #8 ㉡ 자(core 11-01 · 비판 다섯째 판 ⑤ #7 d23_end · #17 d30_002 · #8 d36_room) — 390×844
   판: 총괄 humanQ g premove(반지하 Day 134 · 시루 여럿)
   손: 익은 시루를 [거두기]로 다 거둔다 → 체력을 5 로 세운다(손질 — 체력 값은 안 바꾸고 «남은 손»만) → [다시 심기] 진짜 탭
   ㉮ #7 다시 심기 단추 글이 «물 줄 체력 M 남김»을 말한다(빈 시루가 둘 이상일 때)
   ㉯ #7 다시 심은 뒤 남은 체력으로 그 시루들에 물을 다 줄 수 있다(심고 물 못 줌이 없다 · 물 기다리는 판 수 ≤ 남은 손)
   ㉰ #17 체력 0 이면 [다시 심기]가 «오늘 손이 …» 글 + 흐림(.tired)
   ㉱ #8 ㉡ [방]을 한 번 열면(아래 띠 [방] 진짜 탭) tutorial.roomTabSeen 이 켜지고 «여기서 살림을 봅니다» 손가락이 다시 안 선다
   예외 0 */
import fs from 'node:fs';
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9451', OUT = process.env.OUT || null;
const SAVE = process.env.SAVE || 'C:/Users/pc/AppData/Local/Temp/byeot-master/d_66841206/humanQ/humanQ_g_premove.json';
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
const dlgOnly = async () => { for (let i = 0; i < 80; i++) { const t = await J(`document.getElementById('stage').classList.contains('talking')`); if (!t) return; await page.eval(`(()=>{ const b=document.getElementById('dlgBox'); if(b) b.click(); return 1; })()`, false); await sleep(250); } };
await dlgOnly();
await page.eval(`(()=>{ try { window.__byeotSheet.close(); } catch (e) { void e; } return 1; })()`, false); await sleep(800);
const m = (type, x, y, buttons) => page.send('Input.dispatchMouseEvent', { type, x: Math.round(x), y: Math.round(y), button: 'left', buttons, clickCount: 1 });
const tapAt = async (x, y) => { await m('mouseMoved', x, y, 0); await m('mousePressed', x, y, 1); await sleep(60); await m('mouseReleased', x, y, 0); };
const tapId = async (id) => { const r = await J(`(()=>{ const b=document.getElementById(${JSON.stringify(id)}); if (!b || b.style.display==='none' || !b.offsetParent) return null; const q=b.getBoundingClientRect(); const x=q.left+q.width/2, y=q.top+q.height/2; const top=document.elementFromPoint(x,y); return { x, y, hit: !!(top && (top===b || b.contains(top))) }; })()`); if (r && r.hit) await tapAt(r.x, r.y); return r; };
const rows = () => J(`(async()=>{ const fp = await import('/src/game/first_play.js'); const S=window.__S(); const L = fp.cropPotList(S.firstPlay, S.day) || [];
  return { ready: L.filter(r=>r.ready).length, harvested: L.filter(r=>r.harvested).length, needsWater: L.filter(r=>r.needsWater).length, left: S.stamina.left, max: S.stamina.max }; })()`);
/* ㉱ #8 ㉡ */
await J(`(()=>{ const S=window.__S(); S.stamina.left = S.stamina.max; S.tutorial.roomTabSeen = false; window.__redraw(); return 1; })()`); await sleep(800);
const t0 = await tapId('navRoom'); await sleep(1200);
const seen = await J(`(()=>!!window.__S().tutorial.roomTabSeen)()`);
await page.eval(`(()=>{ try { window.__byeotSheet.close(); } catch (e) { void e; } return 1; })()`, false);
const hints = [];
for (let i = 0; i < 12; i++) { const h = await J(`(()=>{ const h=document.getElementById('hint'); return h && h.classList.contains('on') ? (h.textContent||'').replace(/\\s+/g,' ').slice(0,60) : ''; })()`); hints.push(h); await sleep(400); }
console.log('  [방] 탭', JSON.stringify({ tap: t0 && t0.hit, seen }), '손가락', JSON.stringify([...new Set(hints)]));
ok(!!(t0 && t0.hit) && seen === true, '㉱ #8 [방]을 한 번 열면 roomTabSeen 이 켜진다', JSON.stringify({ tap: t0, seen }));
ok(!hints.some(h => /여기서 살림을 봅니다|\[방\] 탭에서 살림을 봅니다/.test(h)), '㉱ #8 그 뒤 «여기서 살림을 봅니다» 손가락이 안 선다', JSON.stringify([...new Set(hints)]));
/* 익은 시루가 생길 때까지 날을 넘긴다(아침에 익은 것이 없을 수 있다 · 최대 6일) */
for (let d = 0; d < 6; d++) {
  const r = await rows(); if (r.ready >= 3) break;
  await page.eval(`(()=>{ try { window.__byeotSheet.close(); } catch (e) { void e; } const b=document.getElementById('next'); b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})); b.click(); return 1; })()`, false);
  await sleep(1500); await page.eval(`(()=>{ const g=document.getElementById('mealGo'); if (g && g.offsetParent) g.click(); return 1; })()`, false);
  await sleep(3000); await dlgOnly();
  await page.eval(`(()=>{ const g=document.getElementById('monthGo'); if (g && g.offsetParent) g.click(); return 1; })()`, false); await sleep(600); await dlgOnly();
}
/* 익은 것을 다 거둔다(손 넉넉히 · 거두기 단추) */
await J(`(()=>{ const S=window.__S(); S.stamina.left = S.stamina.max; window.__redraw(); return 1; })()`);
/* [식물] 판 시루 줄의 [거두기](사람 손 · 큰 단추는 말풍선이 같은 말을 하면 숨는다) */
for (let i = 0; i < 20; i++) { const r = await rows(); if (!r.ready) break; await J(`(()=>{ const S=window.__S(); S.stamina.left = S.stamina.max; return 1; })()`);
  const hit = await J(`(()=>{ window.__byeotSheet.open('plants'); const b=[...document.querySelectorAll('#siruList button[data-act="harvest"]')].find(x=>!x.disabled); if (!b) return false; b.click(); return true; })()`);
  if (!hit) break; await sleep(2500); await dlgOnly(); }
await page.eval(`(()=>{ try { window.__byeotSheet.close(); } catch (e) { void e; } return 1; })()`, false); await sleep(800);
const r0 = await rows();
console.log('  거둔 뒤', JSON.stringify(r0));
ok(r0.harvested >= 3, '판 — 다시 심을 빈 시루가 셋 이상', JSON.stringify(r0));
/* 남은 손 5 */
await J(`(()=>{ const S=window.__S(); S.stamina.left = 5; window.__redraw(); return 1; })()`); await sleep(800);
const lab = await J(`(()=>{ const b=document.getElementById('resow'); return b ? { t: (b.textContent||'').replace(/\\s+/g,' '), shown: b.style.display !== 'none' && !!b.offsetParent, tired: b.classList.contains('tired') } : null; })()`);
console.log('  다시 심기 단추(손 5)', JSON.stringify(lab));
ok(!!lab && /물 줄 체력 \d+ 남김/.test(lab.t), '㉮ #7 다시 심기 단추가 «물 줄 체력 M 남김»을 말한다', JSON.stringify(lab));
/* ⚠ 진짜 탭은 손가락이 딴 데를 짚을 때 «울타리»가 첫 누름을 막는다(이 자가 재는 것은 «몇 개를 심나») — 단추를 click() 으로 누르고 걸음이 끝나기를 기다린다 */
await page.eval(`(()=>{ const b=document.getElementById('resow'); if (b) b.click(); return 1; })()`, false);
for (let i = 0; i < 40; i++) { await sleep(300); const a = await J(`(()=>{ try { return !!window.__byeotWalkSfx().acting; } catch (e) { return false; } })()`); if (!a && i > 4) break; }
await sleep(800); await dlgOnly();
const r1 = await rows();
console.log('  다시 심은 뒤', JSON.stringify(r1));
ok(r1.needsWater > 0 && r1.needsWater <= r1.left, '㉯ #7 심은 시루에 물 줄 손이 남는다(물 기다리는 판 ≤ 남은 손)', JSON.stringify(r1));
const closeCard = async () => { for (let k = 0; k < 3; k++) {
  const on = await J(`(()=>{ const p=document.getElementById('evPanel'); if (!p || !p.classList.contains('on')) return false; const a=document.getElementById('evA'), b=document.getElementById('evB');
    const go = (a && !a.disabled) ? a : (b && getComputedStyle(b).display !== 'none' ? b : a); if (go) go.click(); return true; })()`);
  if (on !== true) return; await sleep(900); await dlgOnly(); } };
await closeCard();
if (OUT) await page.shot(`${OUT}/390_d100_7.png`);
/* ㉰ 손 0 */
await J(`(()=>{ const S=window.__S(); S.stamina.left = 0; window.__redraw(); return 1; })()`); await sleep(800);
const lab0 = await J(`(()=>{ const b=document.getElementById('resow'); return b ? { t: (b.textContent||'').replace(/\\s+/g,' '), shown: b.style.display !== 'none' && !!b.offsetParent, tired: b.classList.contains('tired'), op: getComputedStyle(b).opacity } : null; })()`);
console.log('  다시 심기 단추(손 0)', JSON.stringify(lab0));
ok(!!lab0 && /손이 다 떨어졌/.test(lab0.t) && lab0.tired && +lab0.op < 0.9, '㉰ #17 손 0 이면 «오늘 손이 …» + 흐림', JSON.stringify(lab0));
await closeCard();
if (OUT) await page.shot(`${OUT}/390_d100_17.png`);
ok(exc.length === 0, '처리 안 된 예외 0', exc.slice(0, 3).join(' / '));
console.log(bad ? `probe_d100_78: 빨강 ${bad}` : 'probe_d100_78: 다 통과');
await page.close(); process.exit(bad ? 1 : 0);
