/* D99 가 자(core 11-01) — 390×844 · 비판 넷째 판 ② ③ ④ ⑤ · plan-to-core-d99 §3
   판 A: 총괄 humanQ premove(반지하 Day 134 · 무늬 그루 · 이사비 근처)
     ㉮ [방] 판 월세 줄 «월세 200,000원 · 다음 월세 날 … — 이사해도 같은 날 같은 월세입니다»
     ㉯ [방] 판 «오늘 실제로 나가는 돈» = 엔진 셈(dailyCashOutWon − 아낀 것 + 전기) — 예전 식비만(2,500)이 아니다
     ㉰ 아침엔 못 버팀(지갑 손질: 이사비 + 236,364 · 비판 판 그 수) → 낮에 지갑이 늘고(손질 +70,000 · 거래가 하는 일) 할 일 셈이 돌면(사람 손: 가방 열고 닫기 아님 — 보유 채소 1판 팔기)
        «이제 첫 월세까지 버틸 만해»(move_ready_ok)가 그날 낮에 선다
   판 B: humanQ g Day 36 dump(반지하 · 무늬 삽수 있음이면) — 무늬 삽수 칸 누르기 · 할 일 글 · 손가락
     ㉱ 뿌리 전 무늬 삽수를 누르면 밝은 빈자리가 없을 때 «밝은 빈자리가 없습니다»를 말한다
   예외 0 */
import fs from 'node:fs';
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9420', OUT = process.env.OUT || null;
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
const dlgOnly = async () => { for (let i = 0; i < 80; i++) { const t = await J(`(()=>({ on: document.getElementById('stage').classList.contains('talking'), l: (document.getElementById('dlgText')||{}).textContent || '' }))()`);
  if (!t.on) { await page.eval(`(()=>{ const m=document.getElementById('monthPanel'); if (m && m.classList.contains('on')) { const g=document.getElementById('monthGo'); if (g) g.click(); } return 1; })()`, false); return; }
  if (t.l && lines[lines.length - 1] !== t.l) lines.push(t.l);
  await page.eval(`(()=>{ const b=document.getElementById('dlgBox'); if(b) b.click(); return 1; })()`, false); await sleep(300); } };
await dlgOnly();
/* 아침 — 지갑 손질(이사비 + 236,364) 뒤 [다음 날] */
await J(`(()=>{ const ts=window.__S().tutorial; ts.cashWon = ts.rules.moveOutCostWon + 236364; window.__redraw(); return 1; })()`);
await page.eval(`(()=>{ const b=document.getElementById('next'); b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})); b.click(); return 1; })()`, false);
await sleep(1500); await page.eval(`(()=>{ const g=document.getElementById('mealGo'); if (g && g.offsetParent) g.click(); return 1; })()`, false);
await sleep(3500); await dlgOnly(); await sleep(1500); await dlgOnly();
const room = await J(`(()=>{ window.__byeotSheet.tab('room'); const rl=document.getElementById('rentLine'); const led=document.getElementById('ledger');
  const rows=[...(led ? led.querySelectorAll('.lrow') : [])].map(r=>r.innerText.replace(/\\s+/g,' '));
  const ts=window.__S().tutorial; return { rent: rl && rl.style.display!=='none' ? rl.textContent : null, rows, cash: ts.cashWon, short: !!ts.moveShortSeen, said: !!ts.moveReadyOkSaid, day: window.__S().day }; })()`);
console.log('  [방]', JSON.stringify(room));
if (OUT) await page.shot(`${OUT}/390_d99_room.png`);
ok(/^월세 200,000원 · 다음 월세 날 (오늘|내일|\d+일 뒤) — 이사해도 같은 날 같은 월세입니다$/.test(room.rent || ''), '㉮ 반지하 [방] 판 월세 줄', room.rent);
const outRow = (room.rows || []).find(r => /오늘 실제로 나가는 돈/.test(r)) || '';
const outWon = Number((outRow.match(/([\d,]+)원/) || [])[1]?.replace(/,/g, '') || NaN);
const eng = await J(`(async()=>{ const m = await import('/src/game/tutorial.js'); const S=window.__S(); const ts=S.tutorial; return { base: m.dailyCashOutWon(ts), saved: (S.firstPlay.food && S.firstPlay.food.lastFoodSavedWon) || 0 }; })()`);
ok(Number.isFinite(outWon) && outWon >= Math.max(0, eng.base - eng.saved), '㉯ «오늘 실제로 나가는 돈»이 엔진 셈(관리비 · 공과 포함)', JSON.stringify({ outRow, eng }));
ok(room.short && !room.said, '㉰ 판 — 아침엔 못 버팀(moveShortSeen)', JSON.stringify({ short: room.short, said: room.said, cash: room.cash }));
/* 낮 — 지갑이 늘고(손질 · 거래가 하는 일) 사람 손으로 할 일 셈이 도는 자리(보유 채소 1판 팔기 · 없으면 [가방] 무늬 확인 아님 → 시루 물) */
await J(`(()=>{ const ts=window.__S().tutorial; ts.cashWon += 70000; return 1; })()`);
const sold = await J(`(()=>{ window.__byeotSheet.open('shop'); const b=document.getElementById('sellPantry'); if (b && !b.disabled) { b.click(); return 'open'; } return null; })()`);
await sleep(800);
const go = await J(`(()=>{ const g=document.getElementById('pantryGo'); if (g && !g.disabled && g.offsetParent) { g.click(); return true; } return false; })()`);
await sleep(1500);
if (!go) console.log('  ⚠ 팔 보유 채소가 없음 — 이 판으로는 낮 길을 못 잰다');
await sleep(1500);
const lines0 = lines.length;
await dlgOnly();
const said = await J(`(()=>({ said: !!window.__S().tutorial.moveReadyOkSaid }))()`);
const okLine = lines.slice(lines0 > 0 ? lines0 - 1 : 0).concat(lines).find(l => /버틸 만해/.test(l));
console.log('  낮', JSON.stringify({ sold, go, said, lines: lines.slice(-4) }));
ok(said.said && !!okLine, '㉰ 낮에 버틸 만해지면 «이제 첫 월세까지 버틸 만해»가 그날 선다', JSON.stringify({ said: said.said, okLine: okLine || null, go }));
ok(exc.length === 0, '처리 안 된 예외 0', exc.slice(0, 3).join(' / '));
console.log(bad ? `probe_d99a: 빨강 ${bad}` : 'probe_d99a: 다 통과');
await page.close(); process.exit(bad ? 1 : 0);
