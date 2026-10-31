/* D99 다 재현 자(core 11-01) — 390×844 · 비판 넷째 판 ⑧ 둘
   판: 총괄 humanQ g premove(Day 134) · 지갑 손질 이사비 + 2,780(비판 판 꼴 · 못 버팀 → move_low_cash)
   ㉮ [방] 판을 굴려 [원룸으로 이사]를 사람 손(마우스)으로 «한 번» 누르면 반응이 있다(대사 · 창) — b011 «판 굴린 뒤 첫 누름이 먹힘»
   ㉯ [이사] → 대사 → 창 [아직] → 판 닫기 사이 몬이 «이사비 내면 …» 두 줄이 «한 번»만 선다 — b017
   예외 0 */
import fs from 'node:fs';
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9425', OUT = process.env.OUT || null;
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
await page.goto(`${BASE}/game.html`); await page.waitFor('window.__byeotBooted === true', 300000, 500); await sleep(4000);
const lines = [];
const grab = async () => { const t = await J(`(()=>({ on: document.getElementById('stage').classList.contains('talking'), l: (document.getElementById('dlgText')||{}).textContent || '' }))()`); if (t.on && t.l && lines[lines.length - 1] !== t.l) lines.push(t.l); return t; };
const dlgOnly = async () => { for (let i = 0; i < 80; i++) { const t = await grab(); if (!t.on) return;
  await page.eval(`(()=>{ const b=document.getElementById('dlgBox'); if(b) b.click(); return 1; })()`, false); await sleep(350); } };
await dlgOnly();
await J(`(()=>{ const ts=window.__S().tutorial; ts.cashWon = ts.rules.moveOutCostWon + 2780; window.__redraw(); return 1; })()`);
const m = (type, x, y, buttons) => page.send('Input.dispatchMouseEvent', { type, x: Math.round(x), y: Math.round(y), button: 'left', buttons, clickCount: 1 });
const tapAt = async (x, y) => { await m('mouseMoved', x, y, 0); await m('mousePressed', x, y, 1); await sleep(80); await m('mouseReleased', x, y, 0); };
/* [방] 판 열고 판을 굴려 단추까지 — 사람처럼 휠 */
await page.eval(`(()=>{ window.__byeotSheet.open('room'); return 1; })()`, false); await sleep(1200);
for (let i = 0; i < 6; i++) { await page.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 200, y: 600, deltaX: 0, deltaY: 400 }); await sleep(250); }
await sleep(700);
const r = await J(`(()=>{ const b=document.getElementById('moveOut'); const q=b.getBoundingClientRect(); return { x: q.left + q.width/2, y: q.top + q.height/2, vis: q.top > 0 && q.bottom < innerHeight, dis: b.disabled }; })()`);
console.log('  단추', JSON.stringify(r));
if (r.vis) await tapAt(r.x, r.y);
await sleep(1200);
const after1 = await J(`(()=>({ talking: document.getElementById('stage').classList.contains('talking'), panel: document.getElementById('movePanel').classList.contains('on'), ev: (document.getElementById('event')||{}).classList.contains('on') }))()`);
console.log('  첫 누름 뒤', JSON.stringify(after1));
if (OUT) await page.shot(`${OUT}/390_d99_movetap.png`);
ok(r.vis && (after1.talking || after1.panel), '㉮ 판을 굴린 뒤 [원룸으로 이사] 첫 누름에 반응(대사 또는 창)', JSON.stringify({ vis: r.vis, ...after1 }));
await dlgOnly(); await sleep(1500);
const p2 = await J(`(()=>({ panel: document.getElementById('movePanel').classList.contains('on') }))()`);
if (p2.panel) { await page.eval(`(()=>{ document.getElementById('moveCancel').click(); return 1; })()`, false); await sleep(800); }
await dlgOnly();
await page.eval(`(()=>{ window.__byeotSheet.close(); return 1; })()`, false); await sleep(1500);
await dlgOnly(); await sleep(1500); await dlgOnly();
const shortLines = lines.filter(l => /이사비 내면|첫 월세 날까지 모자라|조금만 더 모으고/.test(l));
console.log('  대사', JSON.stringify(lines));
ok(shortLines.length <= 2 && new Set(shortLines).size === shortLines.length, '㉯ 몬이 «이사비 내면 …» 두 줄이 한 번만', JSON.stringify(shortLines));
ok(exc.length === 0, '처리 안 된 예외 0', exc.slice(0, 3).join(' / '));
console.log(bad ? `probe_d99d: 빨강 ${bad}` : 'probe_d99d: 다 통과');
await page.close(); process.exit(bad ? 1 : 0);
