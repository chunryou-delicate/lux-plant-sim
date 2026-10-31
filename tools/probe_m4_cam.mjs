/* 비판 셋째 판 MAJOR #4 자(core 10-31) — 몬스테라를 창턱에 놓은 뒤 카메라가 화분 근접에 붙어 «새로 고침»으로만 풀림(A Day 11~14)
   판: 반지하 Day 16 세이브(몬스테라 창턱) · 390×844 · 진짜 마우스
   걸음: 몬스테라 당기기(§focusOnMonstera — 창턱에 처음 놓은 날 · 새순 · 무늬 장면이 부르는 그것 · 진단 손잡이 __focusSpear)
         → 당겨진 사이(유지 3.6초 안) 사람이 그 화분을 눌러 물건 메뉴를 연다(대사 넘기다 방을 누르는 손 · 비판 판 그대로)
         → 유지 시간이 지난 뒤 메뉴 [✕]
   ㉮ 메뉴를 닫으면 카메라가 방 전체로 돌아온다(focused=false)
   ㉯ 메뉴가 열린 채여도 [다음 날]을 넘기면 방 전체다
   예외 0 */
import fs from 'node:fs';
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9300', OUT = process.env.OUT || null;
const SAVE = process.env.SAVE || 'C:/Users/pc/AppData/Local/Temp/byeot-core/dmid/big_g_d16.json';
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
const dlgOnly = async () => { for (let i = 0; i < 80; i++) { const t = await J(`document.getElementById('stage').classList.contains('talking')`); if (!t) return; await page.eval(`(()=>{ const s=document.getElementById('dlgSkip'); if(s) s.click(); const b=document.getElementById('dlgBox'); if(b) b.click(); return 1; })()`, false); await sleep(250); } };
await dlgOnly(); await sleep(1500);
const m = (type, x, y, buttons) => page.send('Input.dispatchMouseEvent', { type, x: Math.round(x), y: Math.round(y), button: 'left', buttons, clickCount: 1 });
const tapAt = async (x, y) => { await m('mouseMoved', x, y, 0); await m('mousePressed', x, y, 1); await sleep(80); await m('mouseReleased', x, y, 0); };
const cam = () => J(`(()=>{ const c=window.__rv.camBusy(); const pa=document.getElementById('plantActions'); return { focused: c.focused, tween: c.tween, menu: !!(pa && getComputedStyle(pa).display !== 'none' && pa.getBoundingClientRect().height > 0), day: window.__S().day }; })()`);
const key = await J(`(()=>{ const p=window.__S().pots[0]; return p ? (p.at ? 'free:' + p.id : p.slotId) : null; })()`);
console.log('  그루 자리', key, JSON.stringify(await cam()));
ok(!!key, '판 — 방에 선 몬스테라', String(key));
/* 당기기 */
await page.eval(`(()=>{ window.__focusSpear(); return 1; })()`, false);
await sleep(1800);
const c1 = await cam();
ok(c1.focused, '판 — 당겼다(focused)', JSON.stringify(c1));
/* 당겨진 사이 그 화분을 누른다 */
const sp = await J(`(()=>{ const r=document.getElementById('roomCanvas').getBoundingClientRect(); const q=window.__rv.screenPosOf(${JSON.stringify(key)}); return q ? { x: r.left + q.x, y: r.top + q.y } : null; })()`);
if (OUT) await page.shot(`${OUT}/390_m4_focused.png`);
/* 그루 몸통을 누른다 — 받침 점(screenPosOf)에서 위로 올라가며 메뉴가 열릴 때까지(사람은 잎을 누른다) */
let c2 = null;
for (const dy of [-40, -80, -120, -20, -160]) {
  if (!sp) break;
  await tapAt(sp.x, sp.y + dy); await sleep(900);
  c2 = await cam(); if (c2.menu) { console.log('  눌러 연 높이', dy); break; }
  await page.eval(`(()=>{ const e=document.getElementById('event'); if (e && e.classList.contains('on')) e.click(); return 1; })()`, false);
}
console.log('  누름', JSON.stringify(sp), JSON.stringify(c2));
ok(c2.menu, '판 — 당겨진 사이 화분을 눌러 물건 메뉴가 열렸다', JSON.stringify(c2));
await sleep(4500);
const c3 = await cam();
console.log('  유지 뒤', JSON.stringify(c3));
if (OUT) await page.shot(`${OUT}/390_m4_menu.png`);
await page.eval(`(()=>{ document.getElementById('pickClose').click(); return 1; })()`, false);
let c4 = null;
for (let i = 0; i < 12; i++) { await sleep(500); c4 = await cam(); if (!c4.focused) break; }
if (OUT) await page.shot(`${OUT}/390_m4_closed.png`);
ok(!c4.focused && !c4.menu, '㉮ 메뉴를 닫으면 카메라가 방 전체로 돌아온다', JSON.stringify(c4));
/* ㉯ 다시 당기고 메뉴를 연 채 [다음 날] */
await page.eval(`(()=>{ window.__focusSpear(); return 1; })()`, false);
await sleep(1800);
const sp2 = await J(`(()=>{ const r=document.getElementById('roomCanvas').getBoundingClientRect(); const q=window.__rv.screenPosOf(${JSON.stringify(key)}); return q ? { x: r.left + q.x, y: r.top + q.y } : null; })()`);
for (const dy of [-40, -80, -120, -20, -160]) { if (!sp2) break; await tapAt(sp2.x, sp2.y + dy); await sleep(900); if ((await cam()).menu) break; }
await sleep(5000);
await page.eval(`(()=>{ const b=document.getElementById('next'); b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})); b.click(); return 1; })()`, false);
await sleep(1500); await page.eval(`(()=>{ const g=document.getElementById('mealGo'); if (g && g.offsetParent) g.click(); return 1; })()`, false);
await sleep(3000); await dlgOnly();
let c5 = null;
for (let i = 0; i < 12; i++) { await sleep(500); c5 = await cam(); if (!c5.focused) break; }
console.log('  다음 날 뒤', JSON.stringify(c5));
ok(!c5.focused, '㉯ 메뉴를 연 채 하루를 넘겨도 방 전체로 돌아온다', JSON.stringify(c5));
ok(exc.length === 0, '처리 안 된 예외 0', exc.slice(0, 3).join(' / '));
console.log(bad ? `probe_m4_cam: 빨강 ${bad}` : 'probe_m4_cam: 다 통과');
await page.close(); process.exit(bad ? 1 : 0);
