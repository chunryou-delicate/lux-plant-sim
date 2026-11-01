/* 총괄 D100 ③ · [plan] plan-to-core-d100 §0 · §4 걸어서 재는 자(core 11-01) — 390×844 · 판: 총괄 humanQ g premove(반지하 Day 134 · 화분 1 · 삽수 0)
   손: [상점] [몬스테라 내놓기] → 창 → 연락 날을 내일로(날 건너뛰기 손질) [다음 날] → [거래하기] → 창 [그래도 판다]
       → 이사(지갑 손질 · 창 [그래도 간다]) → 원룸 → 가방에 몬스테라 씨앗 1 · 검은 모종포트 1(재고 손질 — 주문은 다른 자가 잰다)
       → 가방 화분 칸 누르기(빈 화분 놓기) → 방 🌱 말풍선 진짜 탭(씨앗 심기)
   ㉮ 거래 뒤 판이 닫히고 몬이 sold_last_varie(«무늬가 남은 게 없어») 가 «보인다»
   ㉯ 원룸에서 무늬 줄 넷이 닫힌다(questsClosed) · 닫힘 배너가 선다
   ㉰ 할 일: 씨앗 줄 · 내 집 자금이 열리고 닫힌 줄은 안 열린다
   ㉱ 빈 화분에 «🌱 씨앗 심기» 말풍선이 화면에 선다(비판 #21)
   ㉲ 말풍선을 누르면 심어진다 — 화분 1 · 빈 화분 0 · 씨앗 줄 끝 · 첫 화분이 그 씨앗 그루 · 무늬 원천 셈이 그 그루를 본다(잎 0 → 원천 0)
   예외 0 */
import fs from 'node:fs';
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9450', OUT = process.env.OUT || null;
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
await page.goto(`${BASE}/game.html`); await page.waitFor('window.__byeotBooted === true', 300000, 500); await page.waitFor('!!window.__rv', 240000, 500); await sleep(4000);
const lines = [];
const grab = async () => { const t = await J(`(()=>({ on: document.getElementById('stage').classList.contains('talking'), l: (document.getElementById('dlgText')||{}).textContent || '' }))()`); if (t.on && t.l && lines[lines.length - 1] !== t.l) lines.push(t.l); return t; };
const dlgOnly = async () => { for (let i = 0; i < 80; i++) { const t = await grab(); if (!t.on) return; await page.eval(`(()=>{ const b=document.getElementById('dlgBox'); if(b) b.click(); return 1; })()`, false); await sleep(300); } };
await dlgOnly();
const m = (type, x, y, buttons) => page.send('Input.dispatchMouseEvent', { type, x: Math.round(x), y: Math.round(y), button: 'left', buttons, clickCount: 1 });
const tapAt = async (x, y) => { await m('mouseMoved', x, y, 0); await m('mousePressed', x, y, 1); await sleep(60); await m('mouseReleased', x, y, 0); };
const tapSel = async (sel) => {
  /* ★ 11-01 총괄 — 시트가 올라오는 중에 굴리고 누르면 칸이 화면 밖(y 999.8 · 668)이었다 · 화면 안 + 멎음(두 번 잰 y 가 같음)까지 굴림 다시 */
  const measureAt = () => J(`(()=>{ const b=document.querySelector(${JSON.stringify(sel)}); if (!b) return null; b.scrollIntoView({ block: 'center' }); const q=b.getBoundingClientRect(); const x=q.left+q.width/2, y=q.top+q.height/2; const top=document.elementFromPoint(x,y); return { x, y, hit: !!(top && (top===b || b.contains(top))), t: (b.textContent||'').replace(/\\s+/g,' ').slice(0,60) }; })()`);
  let r = null;
  for (let k = 0; k < 15; k++) { const a = await measureAt(); await sleep(300); const b = await measureAt();
    r = b; if (!a || !b || b.탈) continue; if (b.hit && b.y > 10 && b.y < 834 && Math.abs(a.y - b.y) < 2) break; }
  if (r && r.hit) await tapAt(r.x, r.y);
  return r;
};
const banners = [];
const bannerNow = async () => { const t = await J(`(()=>{ const e=document.getElementById('event'); return e && e.classList.contains('on') ? (e.innerText||'').replace(/\\s+/g,' ').slice(0,140) : ''; })()`); if (t && banners[banners.length - 1] !== t) banners.push(t); return t; };
/* ① 내놓기 */
await page.eval(`(()=>{ window.__byeotSheet.open('shop'); return 1; })()`, false); await sleep(1200);
await tapSel('#sellPlant'); await sleep(900);
await tapSel('#varieAskGo'); await sleep(1200); await dlgOnly();
await J(`(()=>{ const S=window.__S(); for (const l of (S.shop.listings||[])) if (l.kind==='pot') l.contactOnDay = S.day + 1; return 1; })()`);
await page.eval(`(()=>{ window.__byeotSheet.close(); return 1; })()`, false); await sleep(600);
await page.eval(`(()=>{ const b=document.getElementById('next'); b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})); b.click(); return 1; })()`, false);
await sleep(1500); await page.eval(`(()=>{ const g=document.getElementById('mealGo'); if (g && g.offsetParent) g.click(); return 1; })()`, false);
await sleep(3000); await dlgOnly(); await sleep(1500); await dlgOnly();
/* ② 거래 */
await page.eval(`(()=>{ window.__byeotSheet.open('shop'); return 1; })()`, false); await sleep(1200);
const td = await tapSel('#marketList [data-deal]'); await sleep(900);
await tapSel('#varieAskGo'); await sleep(1500);
const afterDeal = await J(`(()=>{ const dlg=document.getElementById('dlgBox'); const talking=document.getElementById('stage').classList.contains('talking'); let seen=false;
  if (talking && dlg) { const r=dlg.getBoundingClientRect(); const top=document.elementFromPoint(r.left+r.width/2, r.top+Math.min(30,r.height/2)); seen = !!(top && top.closest && top.closest('#dlgBox')); }
  return { pots: (window.__S().pots||[]).length, sheet: document.documentElement.classList.contains('sheetopen'), talking, seen, l: (document.getElementById('dlgText')||{}).textContent || '' }; })()`);
console.log('  거래 뒤', JSON.stringify({ tap: td && td.hit, ...afterDeal }));
if (OUT) await page.shot(`${OUT}/390_d100b_sold.png`);
ok(afterDeal.pots === 0, '판 — 모그루가 팔렸다', String(afterDeal.pots));
ok(afterDeal.talking && afterDeal.seen && /무늬가 남은 게 없어/.test(afterDeal.l), '㉮ 거래 뒤 판이 닫히고 몬이 «이제 무늬가 남은 게 없어»가 보인다', JSON.stringify(afterDeal));
await dlgOnly();
/* ③ 이사 */
const hintOn = (goId) => J(`(()=>{ const h=document.getElementById('hint'); const on=!!(h && h.classList.contains('on')); const t=document.querySelector('.hintTarget'); const g=document.getElementById(${JSON.stringify(goId)}); return { on, say: on ? (h.textContent||'').replace(/\s+/g,' ').slice(0,50) : '', onGo: !!(on && t && g && (t===g || g.contains(t))) }; })()`);
let moveHint = null;
await J(`(()=>{ const ts=window.__S().tutorial; ts.cashWon = ts.rules.moveOutCostWon + 302780; window.__redraw(); return 1; })()`);
for (let i = 0; i < 6; i++) {
  const mv = await J(`(()=>({ moved: !!window.__S().tutorial.movedOut, panel: document.getElementById('movePanel').classList.contains('on') }))()`);
  if (mv.moved) break;
  if (mv.panel) { await sleep(700); moveHint = await hintOn('moveGo'); moveHint.go = await J(`(document.getElementById('moveGo')||{}).textContent || ''`);
                  await page.eval(`(()=>{ document.getElementById('moveGo').click(); return 1; })()`, false); }
  else await page.eval(`(()=>{ window.__byeotSheet.tab('room'); document.getElementById('moveOut').click(); return 1; })()`, false);
  await sleep(1200); await dlgOnly();
}
for (let i = 0; i < 30; i++) { await bannerNow(); await sleep(400); }
await page.waitFor('!!window.__rv', 240000, 500);
for (let i = 0; i < 10; i++) { await bannerNow(); await grab(); await sleep(300); }
await dlgOnly();
for (let i = 0; i < 10; i++) { await bannerNow(); await sleep(300); }
/* 원룸 첫날 — 방에 놓인 시루가 없으면 날을 못 넘긴다(첫 플레이 문 «가방의 시루를 먼저 방 안에 놓아 주세요») · 사람처럼 가구 → 이삿짐 시루 하나 */
for (let i = 0; i < 12; i++) {
  const uid = await J(`(()=>{ window.__byeotSheet.open('bag'); const b=document.querySelector('#bagGrid [data-furnbag]'); return b ? b.getAttribute('data-furnbag') : null; })()`);
  if (!uid) break;
  await page.eval(`(()=>{ const b=document.querySelector('#bagGrid [data-furnbag="${uid}"]'); if (b) b.click(); return 1; })()`, false);
  await sleep(2500); await dlgOnly();
  const still = await J(`(()=>!!document.querySelector('#bagGrid [data-furnbag="${uid}"]'))()`);
  if (still) break;
}
for (let i = 0; i < 3; i++) {
  const sel = await J(`(()=>{ window.__byeotSheet.open('bag'); const g=document.getElementById('bagGrid'); return g.querySelector('[data-place="box:beansprout"]') ? 'box:beansprout' : (g.querySelector('[data-place="box:musun"]') ? 'box:musun' : null); })()`);
  if (!sel) break;
  await page.eval(`(()=>{ const c=document.querySelector('#bagGrid [data-place="${sel}"]'); if (c) c.click(); return 1; })()`, false);
  await sleep(1500);
  const conf = await J(`document.getElementById('stage').classList.contains('confirming')`);
  if (!conf) break;
  await page.eval(`(()=>{ document.getElementById('placeOk').click(); return 1; })()`, false);
  for (let k = 0; k < 5; k++) { await bannerNow(); await sleep(260); }   /* 놓은 뒤 할 일 걸음 — 닫힘 배너가 여기서 선다 */
  await dlgOnly();
}
for (let i = 0; i < 6; i++) { await bannerNow(); await sleep(300); }
/* 원룸 첫 아침 — 닫힘은 할 일 걸음(아침 · 손)에서 선다(도착 장면엔 할 일 걸음이 없다) */
const day0 = await J(`(()=>({ day: window.__S().day, next: (()=>{ const b=document.getElementById('next'); return b ? { dis: b.disabled, t: b.textContent } : null; })(), talking: document.getElementById('stage').classList.contains('talking'), sheet: document.documentElement.classList.contains('sheetopen') }))()`);
await page.eval(`(()=>{ try { window.__byeotSheet.close(); } catch (e) { void e; } const b=document.getElementById('next'); b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})); b.click(); return 1; })()`, false);
for (let i = 0; i < 6; i++) { await sleep(500); const d = await J(`window.__S().day`); if (d !== day0.day) break; await dlgOnly(); await page.eval(`(()=>{ const b=document.getElementById('next'); if (b && !b.disabled) { b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})); b.click(); } return 1; })()`, false); }
console.log('  원룸 첫 [다음 날]', JSON.stringify(day0), '→ day', await J(`window.__S().day`));
for (let i = 0; i < 8; i++) { await bannerNow(); await sleep(300); }
await page.eval(`(()=>{ const g=document.getElementById('mealGo'); if (g && g.offsetParent) g.click(); return 1; })()`, false);
for (let i = 0; i < 20; i++) { await bannerNow(); await grab(); await sleep(300); }
await dlgOnly();
for (let i = 0; i < 10; i++) { await bannerNow(); await sleep(300); }
const qv = async () => J(`(async()=>{ const q = await import('/src/game/quest.js'); const S = window.__S(); const v = q.questView(S, window.__questSnap());
  return { room: S.home && S.home.room, closed: (S.stamina.questsClosed||[]).slice(), open: v.open.slice(), chip: v.chip && v.chip.id, chipTodo: v.chip && v.chip.todo, taken: (S.stamina.questsTaken||[]).filter(x=>/^oneroom_/.test(x)) }; })()`);
const q1 = await qv();
console.log('  원룸 할 일', JSON.stringify(q1), '· 배너', JSON.stringify(banners.slice(-6)));
ok(q1.room === 'oneroom', '판 — 원룸', String(q1.room));
/* ★ 총괄 11-01 MAJOR — 원천 0 이사 창([그래도 간다]) 위에서 손가락이 그 단추를 짚지 않는다 */
ok(!!moveHint && !moveHint.탈 && /그래도 간다/.test(moveHint.go) && !moveHint.onGo, '㉳ 원천 0 이사 창 — 손가락이 [그래도 간다]를 안 짚는다', JSON.stringify(moveHint));
ok(['oneroom_root_bright', 'oneroom_settle_cutting', 'oneroom_recut', 'oneroom_sell'].every(id => q1.closed.includes(id)), '㉯ 무늬 줄 넷이 닫혔다', JSON.stringify(q1.closed));
ok(banners.some(b => /무늬를 늘리는 할 일이 닫혔습니다/.test(b)), '㉯ 닫힘 배너가 섰다', JSON.stringify(banners.slice(-6)));
ok(q1.open.includes('oneroom_seed_restart') && q1.open.includes('oneroom_home_fund') && !q1.open.includes('oneroom_root_bright'), '㉰ 씨앗 줄 · 내 집 자금이 열리고 닫힌 줄은 안 열린다', JSON.stringify(q1.open));
/* ④ 씨앗 · 화분(재고 손질) → 가방 화분 칸 누르기 */
await J(`(()=>{ const S=window.__S(); S.shop.stock.monstera_seed=(S.shop.stock.monstera_seed||0)+1; S.shop.stock.pot=(S.shop.stock.pot||0)+1; window.__redraw(); return 1; })()`);
await sleep(600);
const cell = await J(`(()=>{ window.__byeotSheet.open('bag'); const c=document.querySelector('#bagGrid [data-place^="monsteraSeed"]'); return c ? c.getAttribute('data-place') : null; })()`);
await sleep(600);
if (cell) await page.eval(`(()=>{ const c=document.querySelector('#bagGrid [data-place^="monsteraSeed"]'); if (c) c.click(); return 1; })()`, false);
await sleep(2000); await dlgOnly(); await bannerNow();
await page.eval(`(()=>{ try { window.__byeotSheet.close(); } catch (e) { void e; } return 1; })()`, false); await sleep(1500);
const ep = await J(`(()=>{ const S=window.__S(); const e=(S.emptyPots||[])[0]; const marks=[...document.querySelectorAll('#marks .mark')].map(m=>{ const r=m.getBoundingClientRect(); return { key: m.dataset.key, ko: m.getAttribute('aria-label'), shown: m.style.display !== 'none' && r.width > 0, x: r.left + r.width/2, y: r.top + r.height/2 }; });
  return { cell: ${JSON.stringify(cell)}, empty: (S.emptyPots||[]).length, id: e && e.id, marks }; })()`);
const seedMark = (ep.marks || []).find(mk => /씨앗 심기/.test(mk.ko || '') && ep.id && String(mk.key).includes(ep.id));
console.log('  빈 화분', JSON.stringify({ cell: ep.cell, empty: ep.empty, id: ep.id, seedMark }));
if (OUT) await page.shot(`${OUT}/390_d100b_empty.png`);
ok(ep.empty === 1, '판 — 빈 화분이 방에 놓였다(가방 화분 칸 누르기)', JSON.stringify({ cell: ep.cell, empty: ep.empty }));
ok(!!seedMark && seedMark.shown, '㉱ 빈 화분에 «🌱 씨앗 심기» 말풍선이 화면에 선다', JSON.stringify(seedMark || ep.marks.slice(0, 4)));
if (seedMark && seedMark.shown) { await tapAt(seedMark.x, seedMark.y); await sleep(2500); await dlgOnly(); }
const after = await J(`(()=>({ pots: (window.__S().pots||[]).length, empty: (window.__S().emptyPots||[]).length, p0: ((window.__S().pots||[])[0]||{}).id || null, src: window.__byeotVarieSources() }))()`);
const q2 = await qv();
console.log('  심은 뒤', JSON.stringify(after), JSON.stringify({ taken: q2.taken, open: q2.open, chip: q2.chip }));
ok(after.pots === 1 && after.empty === 0, '㉲ 말풍선을 누르면 심어진다(화분 1 · 빈 화분 0)', JSON.stringify(after));
ok(q2.taken.includes('oneroom_seed_restart'), '㉲ 씨앗 줄이 끝났다', JSON.stringify(q2.taken));
ok(after.p0 === ep.id && after.src && after.src.a === 0, '㉲ 첫 화분이 그 씨앗 그루 · 원천 셈이 그 그루를 본다(잎 0 → 무늬 그루 0)', JSON.stringify(after));
ok(exc.length === 0, '처리 안 된 예외 0', exc.slice(0, 3).join(' / '));
console.log('  대사', JSON.stringify(lines.slice(-8)));
console.log(bad ? `probe_d100b: 빨강 ${bad}` : 'probe_d100b: 다 통과');
await page.close(); process.exit(bad ? 1 : 0);
