/* 비판 셋째 판 B1 BLOCKER 자(core 10-31) — «이사 확인 창 없이 이사»(⑤ #1 · #9) · 390×844
   판: 총괄 humanQ premove(Day 134) → [다음 날] → 지갑을 이사비 + 2,780원으로(비판 판 꼴 · 재는 손질 · left < 월세라 몬이 대사가 먼저 선다)
   ㉮ [원룸으로 이사]를 «두 번» 눌러도(대사가 아직 떠 있는 사이 · 울타리 버릇) 이사하지 않는다 — 확인 창이 보인다
   ㉯ 확인 창에 D95 ⑧ 두 줄(남는 돈 · 첫 월세 · 모자라면 한 줄)
   ㉰ 확인 창 [아직] → 그대로 반지하 · 다시 눌러 [그래도 간다/이사한다] → 그때만 이사
   ㉱ 이사비 모자랄 때 [원룸으로 이사]를 누르면 «이사비 2,000,000원 · 지금 N원 · N원 모자랍니다»를 말한다(회색이어도 말한다)
   예외 0 */
import fs from 'node:fs';
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9300', OUT = process.env.OUT || null;
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
const dlgOnly = async () => { for (let i = 0; i < 80; i++) { const t = await J(`document.getElementById('stage').classList.contains('talking')`); if (!t) return; await page.eval(`(()=>{ const s=document.getElementById('dlgSkip'); if(s) s.click(); const b=document.getElementById('dlgBox'); if(b) b.click(); return 1; })()`, false); await sleep(250); } };
await dlgOnly();
await page.eval(`(()=>{ const b=document.getElementById('next'); b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})); b.click(); return 1; })()`, false);
await sleep(1500); await page.eval(`(()=>{ const g=document.getElementById('mealGo'); if (g && g.offsetParent) g.click(); return 1; })()`, false);
await sleep(4000); await dlgOnly();
const state = () => J(`(()=>{ const ts=window.__S().tutorial; const p=document.getElementById('movePanel'); const mv=document.getElementById('moveOut');
  return { day: window.__S().day, moved: !!ts.movedOut, cash: ts.cashWon, panel: !!(p && p.classList.contains('on')), lines: [...document.querySelectorAll('#moveAsk > div')].map(d=>d.textContent),
    talking: document.getElementById('stage').classList.contains('talking'), dlg: (document.getElementById('dlgText')||{}).textContent || '',
    btn: mv ? { dis: mv.disabled, t: mv.textContent, cls: mv.className } : null,
    banner: (()=>{ const e=document.getElementById('event'); return e && e.classList.contains('on') ? (e.innerText||'').replace(/\\s+/g,' ').slice(0,120) : ''; })() }; })()`);
const press = () => page.eval(`(()=>{ window.__byeotSheet.tab('room'); const b=document.getElementById('moveOut'); b.click(); return 1; })()`, false);

/* ㉱ 모자랄 때 — 먼저 지갑을 이사비 − 120,000 으로 */
await J(`(()=>{ const ts=window.__S().tutorial; ts.cashWon = ts.rules.moveOutCostWon - 120000; window.__redraw(); return 1; })()`);
await sleep(600);
await press(); await sleep(900);
const s0 = await state();
console.log('  모자람', JSON.stringify({ btn: s0.btn, banner: s0.banner, moved: s0.moved }));
if (OUT) await page.shot(`${OUT}/390_b1_short.png`);
ok(!s0.moved && /이사비 2,000,000원/.test(s0.banner) && /지금 [\d,]+원/.test(s0.banner) && /120,000원 모자랍니다/.test(s0.banner), '㉱ 모자랄 때 누르면 «이사비 · 지금 · 모자란 돈»을 말한다', s0.banner || '(배너 없음)');
const ml0 = await J(`(()=>{ window.__byeotSheet.tab('room'); const e=document.getElementById('moveMoneyLine'); return e && e.style.display!=='none' ? e.textContent : null; })()`);
ok(/^이사비 2,000,000원 · 지금 1,880,000원 — 120,000원 모자랍니다$/.test(ml0 || ''), '㉲ [방] 판 단추 위 줄(모자람) — plan 문안', ml0);
await page.eval(`(()=>{ const e=document.getElementById('event'); if (e) e.click(); return 1; })()`, false); await sleep(400);

/* ㉮ 두 번 누름 — 지갑 이사비 + 2,780(비판 판) */
await J(`(()=>{ const ts=window.__S().tutorial; ts.cashWon = ts.rules.moveOutCostWon + 2780; window.__redraw(); return 1; })()`);
await sleep(600);
await press(); await sleep(250);
const s1 = await state();
await press(); await sleep(300); await press(); await sleep(1200);
const s2 = await state();
console.log('  두 번 누름', JSON.stringify({ first: { talking: s1.talking, panel: s1.panel, dlg: s1.dlg.slice(0, 40) }, after: { moved: s2.moved, cash: s2.cash, panel: s2.panel, talking: s2.talking } }));
if (OUT) await page.shot(`${OUT}/390_b1_double.png`);
ok(!s2.moved, '㉮ [원룸으로 이사]를 거듭 눌러도 확인 창 없이 이사하지 않는다', JSON.stringify({ moved: s2.moved, cash: s2.cash }));
await dlgOnly(); await sleep(800);
const s3 = await state();
ok(s3.panel && !s3.moved, '㉮ 확인 창이 보인다', JSON.stringify({ panel: s3.panel, moved: s3.moved }));
const ml1 = await J(`(()=>{ const e=document.getElementById('moveMoneyLine'); return e && e.style.display!=='none' ? e.textContent : null; })()`);
ok(/^이사하면 남는 돈 2,780원 · 원룸 첫 월세 200,000원은 /.test(ml1 || '') && /월세 날까지 채소를 팔아 채워야 합니다/.test(ml1 || ''), '㉲ [방] 판 줄(됨 · 못 버팀) — 이사 창 두 줄과 같은 말', ml1);
ok(s3.lines.some(t => /^이사하면 남는 돈 2,780원 · 원룸 첫 월세 200,000원은 /.test(t)) && s3.lines.some(t => /^월세 날까지 채소를 팔아 채워야 합니다/.test(t)), '㉯ 창에 남는 돈 · 첫 월세 · 모자람 줄', JSON.stringify(s3.lines));
if (OUT) await page.shot(`${OUT}/390_b1_panel.png`);
/* ㉰ [아직] → 그대로 · 다시 → [그래도/이사한다] */
await page.eval(`(()=>{ document.getElementById('moveCancel').click(); return 1; })()`, false); await sleep(600);
const s4 = await state();
ok(!s4.moved && !s4.panel, '㉰ [아직] → 반지하 그대로 · 창 닫힘', JSON.stringify({ moved: s4.moved, panel: s4.panel }));
await press(); await sleep(400); await dlgOnly(); await sleep(800);
const s5 = await state();
await page.eval(`(()=>{ document.getElementById('moveGo').click(); return 1; })()`, false); await sleep(2500); await dlgOnly();
const s6 = await state();
ok(s5.panel && s6.moved && s6.cash === 2780, '㉰ 창의 [이사한다/그래도 간다]로만 이사(남는 돈 2,780원)', JSON.stringify({ panelBefore: s5.panel, moved: s6.moved, cash: s6.cash }));
let homeB = '';
for (let i = 0; i < 20 && !/내 집 마련/.test(homeB); i++) { await dlgOnly(); await sleep(500); homeB = (await state()).banner; }
ok(/^🏠 다음 목표 — 내 집 마련 [\d,]+원/.test(homeB), '㉳ 원룸 도착 대사 뒤 «다음 목표 — 내 집 마련» 배너', homeB);
ok(exc.length === 0, '처리 안 된 예외 0', exc.slice(0, 3).join(' / '));
console.log(bad ? `probe_b1_move: 빨강 ${bad}` : 'probe_b1_move: 다 통과');
await page.close(); process.exit(bad ? 1 : 0);
