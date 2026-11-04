/* F1-b 덧 — [나] 창 «새 잎 직접 펼치기» 단추가 지금 상태를 말한다(core 11-04 · 총괄) · 390 · 사람 손(진짜 탭)
   ㉮ 켠 판(기본): 단추 글 «켜짐» · aria-pressed true · 회색 판 아님(button.ghost · button_plate_slate 아님)
   ㉯ 누른 뒤: «꺼짐» · aria-pressed false · 회색 판(button_plate_slate) · 흐림(opacity < 1) · byeot.unfurl '0'
   ㉰ 다시 누름: «켜짐» · 회색 아님 · byeot.unfurl '1'
   셋 다 단추가 화면 맨 위(elementFromPoint) · 예외 0 · 빨강 먼저: F1 672b5634(글 «켬 · 끔» · 꺼져도 주황) */
import fs from 'node:fs';
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9451', OUT = process.env.OUT || null;
const SAVE_T = process.env.SAVE || 'C:/Users/pc/byeot-core-keep/u2e/moved_8aa170ce.json';
if (OUT) fs.mkdirSync(OUT, { recursive: true });
let bad = 0; const ok = (c, m, d = '') => { console.log(`${c ? '  OK' : 'FAIL'}  ${m}${d ? '  → ' + d : ''}`); if (!c) bad++; return c; };
if (!fs.existsSync(SAVE_T)) { ok(false, '세이브 없음', SAVE_T); process.exit(1); }
const exc = [];
const page = await launch({ width: 390, height: 844, dpr: 2 });
page.on((method, p) => { if (method === 'Runtime.exceptionThrown') exc.push(((p.exceptionDetails.exception && p.exceptionDetails.exception.description) || p.exceptionDetails.text || '').split('\n')[0].slice(0, 200)); });
await page.send('Runtime.enable');
await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true;` });
const J = async (js) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, 120000));
const m = (type, x, y, buttons) => page.send('Input.dispatchMouseEvent', { type, x: Math.round(x), y: Math.round(y), button: 'left', buttons, clickCount: 1 });
const tapAt = async (x, y) => { await m('mouseMoved', x, y, 0); await m('mousePressed', x, y, 1); await sleep(60); await m('mouseReleased', x, y, 0); };
const talk = async () => { for (let i = 0; i < 120; i++) { const t = await J(`document.getElementById('stage').classList.contains('talking')`); if (t !== true) return; await page.eval(`(()=>{ const b=document.getElementById('dlgBox'); if(b) b.click(); return 1; })()`, false); await sleep(180); } };
const READ = `(()=>{ const b=document.getElementById('setUnfurl'); if (!b) return null; b.scrollIntoView({ block: 'center' }); const r=b.getBoundingClientRect(); const x=r.left+r.width/2, y=r.top+r.height/2; const t=document.elementFromPoint(x,y); const cs=getComputedStyle(b);
  return { t: b.textContent, p: b.getAttribute('aria-pressed'), ghost: b.classList.contains('ghost'), slate: /button_plate_slate/.test(cs.backgroundImage), op: +cs.opacity, ls: localStorage.getItem('byeot.unfurl'), top: !!(t && (t===b || b.contains(t))), x, y }; })()`;
await page.goto(`${BASE}/data/balance/homes.json`);
await page.eval(`(()=>{ localStorage.clear(); localStorage.setItem('byeot/save/1', ${JSON.stringify(fs.readFileSync(SAVE_T, 'utf8'))}); localStorage.setItem('byeot.guideSeen','1'); return 1; })()`, false);
await page.goto(`${BASE}/game.html`); await page.waitFor('window.__byeotBooted === true', 300000, 500); await page.waitFor('!!window.__rv', 240000, 500); await sleep(4000); await talk();
await J(`(()=>{ window.__detailOpen('me'); return 1; })()`); await sleep(800);
const s0 = await J(READ);
if (OUT) await page.shot(`${OUT}/390_f1b_set_on.png`);
if (s0 && !s0.탈) { await tapAt(s0.x, s0.y); await sleep(500); }
const s1 = await J(READ);
if (OUT) await page.shot(`${OUT}/390_f1b_set_off.png`);
if (s1 && !s1.탈) { await tapAt(s1.x, s1.y); await sleep(500); }
const s2 = await J(READ);
console.log('  단추', JSON.stringify({ s0, s1, s2 }));
ok(!!s0 && !s0.탈 && s0.top && s0.t === '켜짐' && s0.p === 'true' && !s0.ghost && !s0.slate, '㉮ 켠 판 — 단추 글 «켜짐» · aria-pressed true · 회색 판 아님 · 화면 맨 위', JSON.stringify(s0));
ok(!!s1 && !s1.탈 && s1.top && s1.t === '꺼짐' && s1.p === 'false' && s1.slate && s1.op < 1 && s1.ls === '0', '㉯ 누른 뒤 — «꺼짐» · aria-pressed false · 회색 판(slate) · 흐림 · byeot.unfurl 0', JSON.stringify(s1));
ok(!!s2 && !s2.탈 && s2.top && s2.t === '켜짐' && s2.p === 'true' && !s2.slate && s2.ls === '1', '㉰ 다시 누름 — «켜짐» · 회색 아님 · byeot.unfurl 1', JSON.stringify(s2));
ok(exc.length === 0, '처리 안 된 예외 0', exc.slice(0, 3).join(' / '));
try { await page.close(); } catch (e) { console.log('  (탭 닫기 탈)', e.message); }
console.log(bad ? `probe_f1b_setting: 빨강 ${bad}` : 'probe_f1b_setting: 다 통과');
process.exit(bad ? 1 : 0);
