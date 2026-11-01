/* 비판 다섯째 판 #14 자(core 11-01) — «상점이 주문마다 닫히거나(손가락 길) 반대로 열린 채 남음(🛒 길)» — 390×844
   판: 하네스 humanQ 씨앗 g(자가 하네스를 돌려 뜬다)
   ㉮ 이끈 주문(첫 플레이 · 첫 수확 뒤) — Day 29 무순: 손가락 [상점] → 새싹 재배판 [주문] → [주문] 창 → 그 뒤 손가락이 상점 안 다음 줄(무 씨앗 [주문])을 짚으면 시트가 열린 채(한 번 열어 여러 개)
   ㉯ 🛒 지름길 — Day 36(첫 플레이 뒤): 콩 씨앗 재고 0(손질 · 지름길이 서는 판) → 시루 줄 «🛒 … 주문» → [주문] → 시트가 닫힌다(온 자리로)
   예외 0 · J 단언엔 !탈 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9451', OUT = process.env.OUT || null;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const DUMP = process.env.M14_DUMP_DIR || path.join(os.tmpdir(), 'byeot-minor5-14b');
if (OUT) fs.mkdirSync(OUT, { recursive: true });
execFileSync(process.execPath, [path.join(HERE, 'probe_branches.mjs'), '--one', JSON.stringify({ name: 'humanQ', seed: 'g', days: 37, dump: DUMP, dumpDays: [29, 36] })], { maxBuffer: 256 << 20, stdio: ['ignore', 'pipe', 'pipe'] });
let bad = 0; const ok = (c, m, d = '') => { console.log(`${c ? '  OK' : 'FAIL'}  ${m}${d ? '  → ' + d : ''}`); if (!c) bad++; };
const exc = [];
let page = null;
const J = async (js) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, 120000));
const boot = async (day) => {
  if (page) await page.close();
  page = await launch({ width: 390, height: 844, dpr: 2 });
  page.on((method, p) => { if (method === 'Runtime.exceptionThrown') exc.push(((p.exceptionDetails.exception && p.exceptionDetails.exception.description) || p.exceptionDetails.text || '').split('\n')[0].slice(0, 200)); });
  await page.send('Runtime.enable');
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true;` });
  await page.goto(`${BASE}/data/balance/homes.json`);
  await page.eval(`(()=>{ localStorage.clear(); localStorage.setItem('byeot/save/1', ${JSON.stringify(fs.readFileSync(path.join(DUMP, `humanQ_g_d${day}.json`), 'utf8'))}); localStorage.setItem('byeot.guideSeen','1'); return 1; })()`, false);
  await page.goto(`${BASE}/game.html`); await page.waitFor('window.__byeotBooted === true', 300000, 500); await page.waitFor('!!window.__rv', 240000, 500); await sleep(3500);
  for (let i = 0; i < 80; i++) { const t = await J(`document.getElementById('stage').classList.contains('talking')`); if (t !== true) break; await page.eval(`(()=>{ const b=document.getElementById('dlgBox'); if(b) b.click(); return 1; })()`, false); await sleep(250); }
};
const sheetState = () => J(`(()=>({ open: document.documentElement.classList.contains('sheetopen'), tab: (document.querySelector('#sheet [aria-selected="true"]')||{}).textContent || null,
  hint: (()=>{ const h=document.getElementById('hint'); const t=document.querySelector('.hintTarget'); const sl=document.getElementById('shopList');
    return h && h.classList.contains('on') && t ? { t: (t.textContent||t.id||'').trim().slice(0,20), buy: t.dataset ? (t.dataset.buy || null) : null, inShop: !!(sl && sl.contains(t)), say: ((h.querySelector('.say')||{}).textContent||'').slice(0,40) } : null; })(),
  orders: (window.__S().shop.orders||[]).map(o=>o.itemId) }))()`);

/* ── ㉮ 이끈 주문 · Day 29 ── */
await boot(29);
const h0 = await J(`(()=>{ const t=document.querySelector('.hintTarget'); return t ? (t.textContent||'').trim().slice(0,12) : null; })()`);
await page.eval(`(()=>{ const t=document.querySelector('.hintTarget'); if (t && /상점/.test(t.textContent||'')) t.click(); else window.__byeotSheet.open('shop'); return 1; })()`, false);
await sleep(2500);
/* 손가락이 짚은 [주문]을 누른다(못 짚으면 사람처럼 새싹 재배판 줄 [주문]을 찾는다) */
const pick = await J(`(()=>{ const t=document.querySelector('.hintTarget'); const b = (t && t.dataset && t.dataset.buy) ? t : document.querySelector('#shopList [data-buy="sprout_tray"]'); if (!b) return null; b.scrollIntoView({ block: 'center' }); const via = b === t ? 'finger' : 'self'; b.click(); return { buy: b.dataset.buy, via }; })()`);
await sleep(1200);
await page.eval(`(()=>{ const g=document.getElementById('buyGo'); if (g && !g.disabled) g.click(); return 1; })()`, false);
let sA = null;
for (let i = 0; i < 8; i++) { await sleep(400); sA = await sheetState(); }
console.log('  ㉮', JSON.stringify({ h0, pick, sA }));
if (OUT) await page.shot(`${OUT}/390_m14_guided.png`);
ok(!!pick && !pick.탈 && sA && !sA.탈 && (sA.orders || []).includes('sprout_tray'), '판 — Day 29 새싹 재배판을 주문했다', JSON.stringify({ pick, orders: sA && sA.orders }));
ok(!!sA && !sA.탈 && sA.open === true && !!sA.hint && sA.hint.inShop === true && sA.hint.buy === 'radish_seed', '㉮ 이끈 주문 뒤 손가락이 상점 안 다음 줄(무 씨앗 [주문])을 짚고 시트가 열려 있다', JSON.stringify(sA));

/* ── ㉯ 🛒 지름길 · Day 36(첫 플레이 뒤 — 비판 판 Day 36 · 콩 씨앗 주문이 오는 중이 아닌 날 · 오는 중이면 «오는 중» 회색이다) ──
   ⚠ 첫 플레이 «중»(Day 32)엔 옛 «이끈 주문 닫힘»이 이 길도 닫아 작업 전 판도 초록이었다(대조가 안 섬) */
await boot(36);
/* 익은 시루가 나올 때까지 [다음 날](게임은 스스로 씨앗을 안 시킨다) → 시루 줄 [거두기] → 거둔 빈 시루 + 콩 씨앗 0(손질) → 줄에 «🛒 … 주문» */
const skip = async () => { for (let i = 0; i < 60; i++) { const st = await J(`(()=>({ t: document.getElementById('stage').classList.contains('talking'), meal: !!(document.getElementById('mealGo')||{}).offsetParent, mon: document.getElementById('monthPanel').classList.contains('on'), ev: !!document.querySelector('#evPanel.on') }))()`);
  if (st.t === true) { await page.eval(`(()=>{ const b=document.getElementById('dlgBox'); if(b) b.click(); return 1; })()`, false); await sleep(220); continue; }
  if (st.meal) { await page.eval(`(()=>{ document.getElementById('mealGo').click(); return 1; })()`, false); await sleep(800); continue; }
  if (st.mon) { await page.eval(`(()=>{ document.getElementById('monthGo').click(); return 1; })()`, false); await sleep(400); continue; }
  if (st.ev) { await page.eval(`(()=>{ const a=document.getElementById('evA'); if (a) a.click(); return 1; })()`, false); await sleep(600); continue; }
  return; } };
let harvested = false;
for (let k = 0; k < 6 && !harvested; k++) {
  const hv = await J(`(()=>{ window.__byeotSheet.open('plants'); const b=[...document.querySelectorAll('#siruList button[data-act="harvest"]')].find(x=>!x.disabled); if (!b) return false; b.click(); return true; })()`);
  if (hv === true) {
    for (let i = 0; i < 40 && !harvested; i++) { await sleep(400); await skip(); harvested = await J(`!!document.querySelector('#siruList [data-act="sow"], #siruList [data-act="buyseed"]')`) === true; }
    break;
  }
  await page.eval(`(()=>{ try { window.__byeotSheet.close(); } catch (e) { void e; } const b=document.getElementById('next'); b.click(); return 1; })()`, false);
  await sleep(1500); await skip(); await sleep(800);
}
await J(`(()=>{ const S=window.__S(); S.shop.stock.bean_seed = 0; window.__redraw(); return 1; })()`);
await sleep(800);
const sc = await J(`(()=>{ window.__byeotSheet.open('plants'); const b=document.querySelector('#siruList [data-act="buyseed"]'); return b ? (b.textContent||'').trim().slice(0,30) : null; })()`);
console.log('  ㉯ 판', JSON.stringify({ harvested, day: await J(`window.__S().day`), sc }));
await page.eval(`(()=>{ const b=document.querySelector('#siruList [data-act="buyseed"]'); if (b) b.click(); return 1; })()`, false);
await sleep(1200);
const mid = await sheetState();
await page.eval(`(()=>{ const g=document.getElementById('buyGo'); if (g && !g.disabled) g.click(); return 1; })()`, false);
let sB = null;
for (let i = 0; i < 6; i++) { await sleep(400); sB = await sheetState(); }
console.log('  ㉯', JSON.stringify({ sc, mid, sB }));
if (OUT) await page.shot(`${OUT}/390_m14_shortcut.png`);
ok(typeof sc === 'string' && /🛒/.test(sc) && mid && mid.open === true && (sB.orders || []).includes('bean_seed'), '판 — 🛒 지름길로 상점이 열려 콩 씨앗을 주문했다', JSON.stringify({ sc, mid: mid && mid.open, orders: sB && sB.orders }));
ok(!!sB && !sB.탈 && sB.open === false, '㉯ 🛒 지름길 주문 뒤엔 시트가 닫힌다(온 자리로)', JSON.stringify(sB));
ok(exc.length === 0, '처리 안 된 예외 0', exc.slice(0, 3).join(' / '));
console.log(bad ? `probe_minor5_14: 빨강 ${bad}` : 'probe_minor5_14: 다 통과');
await page.close(); process.exit(bad ? 1 : 0);
