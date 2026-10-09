/* tools/probe_d47_furnshop.mjs — **가구점: 사서 · 받아서 · 놓는다** (2026-10-09 · core · 총괄 D47)
   ------------------------------------------------------------
   판 세우기(값 0 · 세운 판): 새 판 → 가구점 문 열기(식물등 해금 = 가을 · ts.lamp.unlocked) · 지갑 넉넉히.
   잰다(화면 손 그대로):
     ① [상점] → [가구] 갈래 — 가구 줄이 서고 줄마다 그림(assets/v2/thumbs/furn)이 붙는다 · 찍음(1_shop_furn.png)
     ② 화분대 줄의 [주문] → 개수 창 [주문] → 오는 중 1 · 지갑이 그 값만큼 준다
     ③ 날을 보낸다(코어 runDays · 도착까지) → [가방] «가구» 칸에 «산 가구» 칸이 선다 · 찍음(2_bag_bought.png)
     ④ 그 칸을 누른다 → 방 가구 목록에 add-<프리셋>-n 이 서고 재고가 0 · 찍음(3_placed.png)
   OUTDIR= (필수 · 비어 있어야) · BYEOT_URL=(기본 127.0.0.1:9300) · W/H(기본 390×844) · PICK=(살 프리셋 정규식 · 기본 stand) */
import fs from 'node:fs';
import { launch, sleep } from './test_cdp.mjs';
const OUTDIR = process.env.OUTDIR;
if (!OUTDIR) { console.error('⛔ OUTDIR='); process.exit(2); }
fs.mkdirSync(OUTDIR, { recursive: true }); if (fs.readdirSync(OUTDIR).length) { console.error('⛔ OUTDIR 가 비어 있지 않다'); process.exit(2); }
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9300';
const W = Number(process.env.W || 390), H = Number(process.env.H || 844);
const PICK = new RegExp(process.env.PICK || 'stand');
const page = await launch({ width: W, height: H, dpr: 1 });
let bad = 0; const ok = (c, m) => { console.log(`  ${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) bad++; };
try {
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true; try{ if(!sessionStorage.__c){ localStorage.clear(); sessionStorage.__c='1'; } }catch(e){}` });
  await page.goto(`${BASE}/game.html`);
  await page.waitFor('!!window.__rv', 300000, 500); await sleep(5000);
  const J = async (js, ms = 120000) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, ms));
  const skip = async () => { for (let i = 0; i < 100; i++) { const b = await page.eval(`String(document.getElementById('stage').classList.contains('talking'))`); if (b !== 'true') return;
    await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s)s.click();})()`, false); await sleep(200); } };
  await skip();
  await page.eval(`(()=>{ const S=window.__S(); S.tutorial.lamp.unlocked=true; S.tutorial.cashWon=3000000; window.__redraw(); })()`, false);
  await sleep(500);
  /* ① 상점 · 가구 갈래 */
  await page.eval(`(()=>{ window.__byeotSheet.open('shop'); })()`, false); await sleep(800);
  await page.eval(`(()=>{ const b=[...document.querySelectorAll('#shopGroups [data-sg]')].find(x=>x.dataset.sg==='furn'); if(b) b.click(); })()`, false); await sleep(1200);
  const rows = await J(`(()=>{ const rs=[...document.querySelectorAll('#shopList .shopRow')]; return { n: rs.length, img: document.querySelectorAll('#shopList .fthumb').length,
    tabs: [...document.querySelectorAll('#shopGroups [data-sg]')].map(b=>b.dataset.sg), ids: rs.map(r=>{ const b=r.querySelector('[data-buy]'); return b ? b.dataset.buy : null; }).filter(Boolean) }; })()`);
  console.log('가구 갈래 —', JSON.stringify({ n: rows.n, img: rows.img, tabs: rows.tabs, first: rows.ids.slice(0, 4) }));
  await page.shot(`${OUTDIR}/1_shop_furn.png`);
  ok(rows.tabs.includes('furn'), '상점에 [가구] 갈래가 선다');
  ok(rows.n >= 10 && rows.img >= 10, `가구 줄이 서고 그림이 붙는다(줄 ${rows.n} · 그림 ${rows.img})`);
  const pick = rows.ids.find(id => PICK.test(id)) || rows.ids[0];
  /* ② 주문 */
  const before = await J(`(()=>{ const S=window.__S(); return { cash:S.tutorial.cashWon }; })()`);
  await page.eval(`(()=>{ const b=document.querySelector('#shopList [data-buy="${pick}"]'); if(b){ b.scrollIntoView({block:'center'}); b.click(); } })()`, false); await sleep(900);
  await page.eval(`(()=>{ const g=document.getElementById('buyGo'); if(g && g.offsetParent) g.click(); })()`, false); await sleep(900);
  await skip();
  const ordered = await J(`(async()=>{ const sh=await import('/src/game/shop.js'); const S=window.__S(); return { cash:S.tutorial.cashWon, incoming: sh.incomingOf(S, ${JSON.stringify(pick)}), stock: sh.stockOf(S, ${JSON.stringify(pick)}) }; })()`);
  console.log('주문 —', pick, JSON.stringify({ before, ordered }));
  ok(ordered.incoming === 1, `${pick} 오는 중 1`);
  ok(ordered.cash < before.cash, `지갑이 줄었다(${before.cash} → ${ordered.cash})`);
  /* ③ 도착까지 */
  for (let d = 0; d < 5; d++) {
    const st = await J(`(async()=>{ const sh=await import('/src/game/shop.js'); const loop=await import('/src/game/loop.js'); const S=window.__S();
      if (sh.stockOf(S, ${JSON.stringify(pick)}) > 0) return { stock: 1 }; loop.runDays(S, window.__io, 1); try{window.__redraw();}catch(e){} return { stock: sh.stockOf(S, ${JSON.stringify(pick)}) }; })()`);
    if (st.stock > 0) break;
  }
  await skip();
  await page.eval(`(()=>{ window.__byeotSheet.open('bag'); })()`, false); await sleep(1000);
  const cell = await J(`(()=>{ const c=document.querySelector('#bagGrid [data-furnstock="${pick}"]'); if(!c) return null; c.scrollIntoView({block:'center'}); const r=c.getBoundingClientRect(); return { x:r.left+r.width/2, y:r.top+r.height/2, text:(c.textContent||'').trim().slice(0,40) }; })()`);
  await sleep(400);
  await page.shot(`${OUTDIR}/2_bag_bought.png`);
  ok(!!cell, `가방 «가구» 칸에 산 가구가 섰다 ${cell ? '«' + cell.text + '»' : ''}`);
  /* ④ 놓기 */
  if (cell) {
    await page.eval(`(()=>{ const c=document.querySelector('#bagGrid [data-furnstock="${pick}"]'); if(c) c.click(); })()`, false);
    await sleep(4000); await skip();
    const placed = await J(`(async()=>{ const sh=await import('/src/game/shop.js'); const st=await import('/src/game/state.js'); const S=window.__S();
      const added=(st.addedFurniture(S)||[]).map(f=>f.uid); const inRoom=(window.__rv.furniture()||[]).map(f=>f.uid);
      return { stock: sh.stockOf(S, ${JSON.stringify(pick)}), added, inRoom: inRoom.filter(u=>/^add-/.test(u)) }; })()`);
    console.log('놓음 —', JSON.stringify(placed));
    await page.shot(`${OUTDIR}/3_placed.png`);
    ok(placed.stock === 0, '재고가 하나 줄었다(0)');
    ok(placed.added.some(u => /^add-/.test(u)) && placed.inRoom.length >= 1, `방에 섰다(${placed.inRoom.join(', ')})`);
  }
} catch (e) { console.log('  FAIL 탈 —', e && e.message); bad++; }
finally { await page.close(); }
console.log(bad ? `probe_d47_furnshop: FAIL (${bad})` : 'probe_d47_furnshop: PASS');
process.exit(bad ? 1 : 0);
