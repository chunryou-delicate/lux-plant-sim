/* D99 나 자(core 11-01) — 390×844 · 비판 넷째 판 ⑥ ⑦ ⑨
   ㉮ ⑨ 남는 채소 바닥 단추(총괄 humanQ g premove · 보유 채소 20kg · 남는 몫 있음): 단추가 서고 → 누르면 판매 창이 남는 판 수로 바로 → [이 값에 팔기] → 단추가 걷힘
   ㉯ ⑥ 혹 삽수 줄(손질: 그 판의 삽수 하나를 혹 · 포트 0): [내놓기]가 화면 안 · 이름 칸이 한 글자 폭이 아니다
   ㉰ ⑦ 씨앗 미리 알림(하네스 big g Day 16 · 손질: 콩 씨앗 0 · 내일 익는 시루 있음): 지금 심을 일이 없어도 🛒 콩 씨앗 주문 단추가 미리 선다
   예외 0 */
import fs from 'node:fs';
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9422', OUT = process.env.OUT || null;
const SAVE_A = process.env.SAVE || 'C:/Users/pc/AppData/Local/Temp/byeot-master/d_66841206/humanQ/humanQ_g_premove.json';
const SAVE_C = process.env.SAVE_C || 'C:/Users/pc/AppData/Local/Temp/byeot-core/dmid/big_g_d16.json';
if (OUT) fs.mkdirSync(OUT, { recursive: true });
let bad = 0; const ok = (c, m, d = '') => { console.log(`${c ? '  OK' : 'FAIL'}  ${m}${d ? '  → ' + d : ''}`); if (!c) bad++; };
const exc = [];
async function open(save) {
  const page = await launch({ width: 390, height: 844, dpr: 2 });
  page.on((method, p) => { if (method === 'Runtime.exceptionThrown') exc.push(((p.exceptionDetails.exception && p.exceptionDetails.exception.description) || p.exceptionDetails.text || '').split('\n')[0].slice(0, 200)); });
  await page.send('Runtime.enable');
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true;` });
  const J = async (js) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, 120000));
  await page.goto(`${BASE}/data/balance/homes.json`);
  await page.eval(`(()=>{ localStorage.clear(); localStorage.setItem('byeot/save/1', ${JSON.stringify(fs.readFileSync(save, 'utf8'))}); localStorage.setItem('byeot.guideSeen','1'); return 1; })()`, false);
  await page.goto(`${BASE}/game.html`); await page.waitFor('window.__byeotBooted === true', 300000, 500); await sleep(4000);
  const dlgOnly = async () => { for (let i = 0; i < 80; i++) { const t = await J(`document.getElementById('stage').classList.contains('talking')`);
    if (!t) { await page.eval(`(()=>{ const m=document.getElementById('monthPanel'); if (m && m.classList.contains('on')) { const g=document.getElementById('monthGo'); if (g) g.click(); } return 1; })()`, false); return; }
    await page.eval(`(()=>{ const s=document.getElementById('dlgSkip'); if(s) s.click(); const b=document.getElementById('dlgBox'); if(b) b.click(); return 1; })()`, false); await sleep(250); } };
  await dlgOnly(); await sleep(1500); await dlgOnly();
  return { page, J, dlgOnly };
}
/* ㉮ ⑨ */
{
  const { page, J } = await open(SAVE_A);
  const b0 = await J(`(()=>{ const b=document.getElementById('sellSurplusBtn'); return b ? { shown: b.style.display !== 'none', t: b.textContent } : null; })()`);
  console.log('  ⑨ 단추', JSON.stringify(b0));
  if (OUT) await page.shot(`${OUT}/390_d99_surplus.png`);
  ok(b0 && b0.shown && /남는 채소 \d+판 팔기/.test(b0.t), '㉮ 남는 몫이 있으면 바닥에 «남는 채소 N판 팔기»가 선다', JSON.stringify(b0));
  await page.eval(`(()=>{ document.getElementById('sellSurplusBtn').click(); return 1; })()`, false); await sleep(900);
  const p1 = await J(`(()=>{ const p=document.getElementById('pantryPanel'); return { on: !!(p && p.classList.contains('on')), n: (document.getElementById('pantryCount')||{}).textContent, q: (document.getElementById('pantryQuote')||{}).textContent }; })()`);
  console.log('  판매 창', JSON.stringify(p1).slice(0, 200));
  const lots = Number(((b0 && b0.t) || '').match(/(\d+)판/)?.[1] || NaN);
  ok(p1.on && new RegExp(`^${lots}판`).test(p1.n || ''), '㉮ 누르면 판매 창이 남는 판 수로 바로 열린다', JSON.stringify({ on: p1.on, n: p1.n, lots }));
  const cash0 = await J(`window.__S().tutorial.cashWon`);
  await page.eval(`(()=>{ document.getElementById('pantryGo').click(); return 1; })()`, false); await sleep(1500);
  const after = await J(`(()=>{ const b=document.getElementById('sellSurplusBtn'); return { cash: window.__S().tutorial.cashWon, shown: b.style.display !== 'none' }; })()`);
  ok(after.cash > cash0 && !after.shown, '㉮ 팔면 지갑이 늘고 단추가 걷힌다(남는 몫 0)', JSON.stringify({ cash0, ...after }));
  await page.close();
}
/* ㉯ ⑥ */
{
  const { page, J } = await open('C:/Users/pc/AppData/Local/Temp/byeot-core/d99_dump/humanQ_1_d128.json');
  await J(`(()=>{ const S=window.__S(); const c=(S.cuttings||[])[0]; if (!c) return null; c.status='node'; c.nodeOnDay=S.day; (S.shop.stock||{}).pot=0; window.__redraw(); return c.id; })()`);
  await page.eval(`(()=>{ window.__byeotSheet.open('plants'); return 1; })()`, false); await sleep(1200);
  const row = await J(`(()=>{ const rows=[...document.querySelectorAll('#cutList .cutRow')]; const r=rows.find(x=>x.querySelector('[data-repot]')); if (!r) return null; r.scrollIntoView({block:'center'});
    const nm=r.querySelector('.nm').getBoundingClientRect(); const bs=[...r.querySelectorAll('button')].map(b=>{ const q=b.getBoundingClientRect(); return { t: b.textContent.trim(), left: Math.round(q.left), right: Math.round(q.right), w: Math.round(q.width) }; });
    return { nmW: Math.round(nm.width), bs, vw: innerWidth }; })()`);
  console.log('  ⑥ 줄', JSON.stringify(row));
  if (OUT) await page.shot(`${OUT}/390_d99_noderow.png`);
  const sellB = row && row.bs.find(b => /내놓기/.test(b.t));
  ok(!!row && row.nmW >= 80 && (!sellB || sellB.right <= row.vw), '㉯ 혹 삽수 줄 — 이름 칸이 넓고 [내놓기]가 화면 안', JSON.stringify(row));
  await page.close();
}
/* ㉰ ⑦ */
{
  const { page, J } = await open(SAVE_C);
  const pre = await J(`(async()=>{ const fp = await import('/src/game/first_play.js'); const S=window.__S(); const rows=fp.cropPotList(S.firstPlay, S.day).filter(r=>r.kind==='beansprout'&&r.placed);
    return { day: S.day, seeds: (S.shop.stock||{}).bean_seed, harvested: rows.filter(r=>r.harvested).length, ready: rows.filter(r=>r.ready).length, soon: rows.filter(r=>r.growing&&!r.ready&&r.daysLeft<=1).length }; })()`);
  await J(`(()=>{ const S=window.__S(); S.shop.stock.bean_seed = 0; S.shop.orders = (S.shop.orders||[]).filter(o=>o.itemId!=='bean_seed'); window.__redraw(); return 1; })()`);
  await sleep(800);
  const b = await J(`(()=>{ const b=document.getElementById('resow'); return { shown: b.style.display !== 'none', t: b.textContent, buy: b.dataset.buy || null }; })()`);
  console.log('  ⑦', JSON.stringify({ pre, b }));
  if (OUT) await page.shot(`${OUT}/390_d99_seedsoon.png`);
  const want = pre.harvested + pre.ready + pre.soon;
  ok(want > 0 ? (b.shown && b.buy === 'bean_seed' && /콩 씨앗 주문/.test(b.t)) : true, '㉰ 내일 심을 몫이 있는데 씨앗이 모자라면 🛒 콩 씨앗 주문 단추가 미리 선다', JSON.stringify({ want, ...b }));
  await page.close();
}
ok(exc.length === 0, '처리 안 된 예외 0', exc.slice(0, 3).join(' / '));
console.log(bad ? `probe_d99c: 빨강 ${bad}` : 'probe_d99c: 다 통과');
process.exit(bad ? 1 : 0);
