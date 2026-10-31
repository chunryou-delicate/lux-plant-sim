/* D99 가 자 둘(core 11-01) — 390×844 · 비판 넷째 판 ④ ⑤ · plan-to-core-d99 §2 · §4
   판: D99 하네스 humanQ 씨앗 1 Day 124 dump(반지하 · 무늬 삽수 cut_01 창턱 밖에서 뿌리내리는 중 · 등 1 · varie_bright 열림)
   ㉮ 할 일 «무늬 삽수 뿌리내리기» todo 가 밝은 빈자리 없음 갈래(«밝은 빈자리가 없습니다 — 식물등을 더 다세요»)
   ㉯ 손가락이 식물등(상점 식물등 · [상점] 문)을 짚는다 — 돈이 모자라면 짚지 않는다(살 수 없는 것)
   ㉰ 손질(재는 것): cut_02 를 가방으로 → 가방 칸 누르기 → «밝은 빈자리가 없습니다» 배너 · 무늬 띠 말이 먼저(§2-2 · «여기서 뿌리내리면 무늬가 잘 안 납니다»)
   ㉱ [다음 날]을 넘겨 cut_01 이 뿌리내리면 할 일이 끝난다(어디서든 · D99 ⑤) — 사흘까지
   예외 0 */
import fs from 'node:fs';
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9420', OUT = process.env.OUT || null;
const SAVE = process.env.SAVE || 'C:/Users/pc/AppData/Local/Temp/byeot-core/d99_dump/humanQ_1_d128.json';
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
const dlgOnly = async () => { for (let i = 0; i < 80; i++) { const t = await J(`document.getElementById('stage').classList.contains('talking')`);
  if (!t) { await page.eval(`(()=>{ const m=document.getElementById('monthPanel'); if (m && m.classList.contains('on')) { const g=document.getElementById('monthGo'); if (g) g.click(); } const e=document.getElementById('evPanel'); if (e && e.classList.contains('on')) { const a=document.getElementById('evA'); if (a && !a.disabled) a.click(); } return 1; })()`, false); return; }
  await page.eval(`(()=>{ const s=document.getElementById('dlgSkip'); if(s) s.click(); const b=document.getElementById('dlgBox'); if(b) b.click(); return 1; })()`, false); await sleep(250); } };
await dlgOnly(); await sleep(1500); await dlgOnly();
const qv = async () => J(`(async()=>{ const q = await import('/src/game/quest.js'); const S=window.__S(); const v = q.questView(S, window.__questSnap()); const x = (v.all||[]).find(a => a.id === 'varie_bright');
  return { state: x && x.state, todo: x && x.todo, ko: x && x.ko, brightFree: window.__questSnap().brightFree, taken: (S.stamina.questsTaken||[]).includes('varie_bright'), cash: S.tutorial.cashWon, lamp: S.tutorial.lamp }; })()`);
const q0 = await qv();
console.log('  할 일', JSON.stringify(q0));
if (q0.state !== 'open') console.log('  ⚠ 이 판은 게임 셈으로 할 일이 잠김(다 자란 무늬 잎 1) — ㉮ ㉯ ㉱ 는 재지 못함 · node test_quest 가 못 박음');
else ok(q0.state === 'open' && q0.brightFree === false && /^밝은 빈자리가 없습니다 — 식물등을 (더 )?다세요$/.test(q0.todo || ''), '㉮ 밝은 빈자리 없음 → todo 식물등 갈래', JSON.stringify({ state: q0.state, brightFree: q0.brightFree, todo: q0.todo }));
ok(q0.ko === '무늬 삽수 뿌리내리기', '㉮ 할 일 이름', q0.ko);
/* ㉯ 손가락 — 사람처럼 [다음 날] 없이 지금 짚는 것 */
await page.eval(`(()=>{ window.__byeotSheet.close(); return 1; })()`, false); await sleep(1500);
const hint = async () => J(`(()=>{ const t=document.querySelector('.hintTarget'); const h=document.getElementById('hint'); return { target: t ? (t.id || t.className.split(' ')[0]) : null, say: h && h.classList.contains('on') ? (h.querySelector('.say')||{}).textContent : null }; })()`);
let h0 = await hint();
console.log('  손가락', JSON.stringify(h0));
const lampAfford = await J(`(()=>{ const b=document.getElementById('buyLamp'); window.__byeotSheet.open('shop'); const b2=document.getElementById('buyLamp'); const r = !!(b2 && !b2.disabled); window.__byeotSheet.close(); return r; })()`);
await sleep(1200); h0 = await hint();
if (q0.state === 'open') ok(lampAfford ? /navShop|tabShop|buyLamp/.test(String(h0.target)) : true, '㉯ 밝은 빈자리가 없으면 손가락이 식물등 쪽(살 수 있을 때)', JSON.stringify({ lampAfford, ...h0 }));
if (OUT) await page.shot(`${OUT}/390_d99_lampfinger.png`);
/* ㉰ 손질 — cut_02 를 가방으로 → 가방 칸 누르기 */
const moved = await J(`(()=>{ const S=window.__S(); const c=(S.cuttings||[]).find(x=>x && x.id==='cut_02' && x.status==='rooting'); if (!c) return null; delete c.at; c.slotId = null; window.__redraw(); return c.id; })()`);
await sleep(1200);
await J(`(()=>{ window.__byeotSheet.open('bag'); const el=document.querySelector('#bagGrid [data-place="cutting:cut_02"]'); if (el) el.scrollIntoView({ block: 'center' }); return 1; })()`);
await sleep(700);
const tap = await J(`(()=>{ const el=document.querySelector('#bagGrid [data-place="cutting:cut_02"] img') || document.querySelector('#bagGrid [data-place="cutting:cut_02"]'); if (!el) return null; const r=el.getBoundingClientRect(); return { x: r.left + r.width/2, y: r.top + r.height/2, h: innerHeight }; })()`);
console.log('  칸 자리', JSON.stringify(tap));
let bn = '';
if (tap) {
  const m = (type, x, y, buttons) => page.send('Input.dispatchMouseEvent', { type, x: Math.round(x), y: Math.round(y), button: 'left', buttons, clickCount: 1 });
  await m('mouseMoved', tap.x, tap.y, 0); await m('mousePressed', tap.x, tap.y, 1); await sleep(80); await m('mouseReleased', tap.x, tap.y, 0);
  for (let i = 0; i < 12 && !bn; i++) { await sleep(400); bn = await J(`(()=>{ const e=document.getElementById('event'); return e && e.classList.contains('on') ? (e.innerText||'').replace(/\\s+/g,' ').slice(0,200) : ''; })()`); }
}
const where = await J(`(()=>{ const c=(window.__S().cuttings||[]).find(x=>x && x.id==='cut_02'); return c ? { slot: c.slotId || null, at: !!c.at } : null; })()`);
console.log('  삽수 누르기', JSON.stringify({ moved, tap: !!tap, bn, where }));
if (OUT) await page.shot(`${OUT}/390_d99_cuttap.png`);
ok(/밝은 빈자리가 없습니다/.test(bn) && /여기서 뿌리내리면 무늬가 잘 안 납니다/.test(bn), '㉰ 뿌리 전 무늬 삽수 누르기 — «밝은 빈자리가 없습니다» · 무늬 띠 말이 먼저', bn);
/* ㉱ [다음 날] 사흘까지 — 어디서든 뿌리내리면 할 일 끝 */
let q1 = null;
for (let d = 0; d < 8; d++) {
  await page.eval(`(()=>{ window.__byeotSheet.close(); const b=document.getElementById('next'); b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})); b.click(); return 1; })()`, false);
  await sleep(1500); await page.eval(`(()=>{ const g=document.getElementById('mealGo'); if (g && g.offsetParent) g.click(); return 1; })()`, false);
  await sleep(3000); await dlgOnly(); await sleep(1000); await dlgOnly();
  q1 = await qv();
  const cuts = await J(`(window.__S().cuttings||[]).map(c=>c.id+':'+c.status+':'+(c.varieLightBand||'-'))`);
  console.log('  날', JSON.stringify({ day: await J(`window.__S().day`), taken: q1.taken, cuts }));
  if (q1.taken) break;
}
if (q0.state === 'open') ok(q1 && q1.taken, '㉱ 무늬 삽수가 어디서든 뿌리내리면 할 일이 끝난다', JSON.stringify(q1 && { taken: q1.taken, state: q1.state }));
ok(exc.length === 0, '처리 안 된 예외 0', exc.slice(0, 3).join(' / '));
console.log(bad ? `probe_d99b: 빨강 ${bad}` : 'probe_d99b: 다 통과');
await page.close(); process.exit(bad ? 1 : 0);
