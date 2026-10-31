/* D99 다 · 비판 넷째 판 b011 · b017 자(core 11-01 · 총괄이 판 기록으로 준 손 순서 그대로) — 390×844
   판: 총괄 humanQ g premove(Day 134) · 지갑 2,007,818(이사는 되지만 버팀은 거짓 — low-cash)
   손: [방] 판 열기 → 판 굴림 → [원룸으로 이사] → (창) [아직] → 이사 단추 두 번(218ms) → [아직] → [방] 판 닫기
   ㉮ 첫 누름에 «보이는» 반응 — 시트가 대사를 덮으므로 확인 창이 바로 선다(b011: 대사가 시트 밑에 깔려 아무 일 없음처럼 보였다)
   ㉯ 판을 닫은 뒤 «이사비 내면 첫 월세 날까지 모자라» 대사가 두 벌 연달아 서지 않는다(b017)
   예외 0 */
import fs from 'node:fs';
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9427', OUT = process.env.OUT || null;
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
await J(`(()=>{ const ts=window.__S().tutorial; ts.cashWon = 2007818; window.__redraw(); return 1; })()`);
const m = (type, x, y, buttons) => page.send('Input.dispatchMouseEvent', { type, x: Math.round(x), y: Math.round(y), button: 'left', buttons, clickCount: 1 });
const tapAt = async (x, y) => { await m('mouseMoved', x, y, 0); await m('mousePressed', x, y, 1); await sleep(60); await m('mouseReleased', x, y, 0); };
const tapEl = async (id) => { const r = await J(`(()=>{ const b=document.getElementById(${JSON.stringify(id)}); if (!b) return null; const q=b.getBoundingClientRect(); return { x: q.left + q.width/2, y: q.top + q.height/2, vis: q.width > 0 && q.top >= 0 && q.bottom <= innerHeight }; })()`); if (r && r.vis) await tapAt(r.x, r.y); return r; };
const st = () => J(`(()=>{ const dlg=document.getElementById('dlgBox'); const r=dlg.getBoundingClientRect(); const top=document.elementFromPoint(r.left + r.width/2, r.top + Math.min(30, r.height/2));
  return { talking: document.getElementById('stage').classList.contains('talking'), talkSeen: !!(top && top.closest && top.closest('#dlgBox')), panel: document.getElementById('movePanel').classList.contains('on'), moved: !!window.__S().tutorial.movedOut, sheet: document.documentElement.classList.contains('sheetopen') }; })()`);
/* [방] 판 열고 굴림 */
await page.eval(`(()=>{ window.__byeotSheet.open('room'); return 1; })()`, false); await sleep(1200);
for (let i = 0; i < 6; i++) { await page.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 200, y: 600, deltaX: 0, deltaY: 300 }); await sleep(200); }
await sleep(800);
await tapEl('moveOut'); await sleep(1500);
const s1 = await st(); await grab();
console.log('  첫 누름 뒤', JSON.stringify(s1));
if (OUT) await page.shot(`${OUT}/390_b011_first.png`);
ok(s1.panel || (s1.talking && s1.talkSeen), '㉮ 판이 떠 있어도 첫 누름에 «보이는» 반응(확인 창 · 또는 보이는 대사)', JSON.stringify(s1));
/* 창이 안 떴으면(작업 전 판) 비판 판처럼 한 번 더 */
if (!s1.panel) { await tapEl('moveOut'); await sleep(1500); }
await grab();
if ((await st()).panel) { await tapEl('moveCancel'); await sleep(900); }
await tapEl('moveOut'); await sleep(218); await tapEl('moveOut'); await sleep(1500); await grab();
if ((await st()).panel) { await tapEl('moveCancel'); await sleep(900); }
await page.eval(`(()=>{ window.__byeotSheet.close(); return 1; })()`, false); await sleep(1500);
await dlgOnly(); await sleep(1500); await dlgOnly();
const lowLines = lines.filter(l => /이사비 내면 첫 월세 날까지 모자라/.test(l));
const sAfter = await st();
console.log('  대사', JSON.stringify(lines), '이사함', sAfter.moved);
ok(lowLines.length <= 1, '㉯ «이사비 내면 첫 월세 날까지 모자라»가 두 벌 연달아 서지 않는다', JSON.stringify(lowLines));
ok(!sAfter.moved, '이사하지 않았다([아직]만 눌렀다)', String(sAfter.moved));
ok(exc.length === 0, '처리 안 된 예외 0', exc.slice(0, 3).join(' / '));
console.log(bad ? `probe_d99d: 빨강 ${bad}` : 'probe_d99d: 다 통과');
await page.close(); process.exit(bad ? 1 : 0);
