/* 원룸 빈 화분 — 배너 · 할 일 · 손가락이 같은 말을 하나(core 11-01 · 총괄 사진 390_d100b_empty · 390_minor5_banner · [plan] 11-01 글) — 390×844
   판: 총괄 humanQ g premove(반지하 Day 134 · 화분 1 · 가방 검은 모종포트 1 · 몬스테라 씨앗 0) — probe_d100b 와 같은 손으로 모그루를 팔고 원룸에 든다(무늬 원천 0 → 씨앗 줄 열림)
   손(흔한 차례 · [plan]): 가방 화분 놓기 → 상점 몬스테라 씨앗 [주문] → [다음 날] → 방 🌱 진짜 탭 · (드문 차례) 화분 주문 → 다음 날 씨앗 주문 → 가방 화분 놓기
   ㉮ 씨앗 0 · 안 옴 — 배너 «상점에서 몬스테라 씨앗을 사세요» · 할 일 같은 말 · 🌱 말풍선 없음 · 손가락이 빈 화분을 안 짚음
   ㉯ 주문 뒤 할 일 «몬스테라 씨앗이 오면 🌱 을 눌러 심으세요»
   ㉰ 다음 날 🌱 말풍선 · 할 일 «빈 화분의 🌱 을 눌러 씨앗을 심으세요» · 손가락이 🌱(가방 속 이삿짐 채소보다 먼저 · 예전엔 [가방])
   ㉱ 🌱 탭 → 심어짐 · 손가락은 다시 짐 풀기
   ㉲ 씨앗이 오는 중에 가방 화분 놓기 — 배너 «몬스테라 씨앗이 오면 🌱 을 눌러 심으세요»
   ㉮′ (총괄 가름 · [plan]) 짐이 남은 채 씨앗 0 · 안 옴 → 배너 «짐을 푼 뒤, 상점에서 몬스테라 씨앗을 사세요» · 손가락은 짐 풀기([가방]) — 한 화면에서 다른 일을 안 시킴
   ㉳ 짐 풀기 손가락이 꺼진 판에서 씨앗 0 · 안 옴 → 배너 «상점에서 몬스테라 씨앗을 사세요» 그대로 · 손가락도 짐 풀기 아님
      판: 새 탭에 ㉮ 직전 세이브(Day 136 · 가방 화분 1 · 씨앗 0)를 띄우고 이삿짐 채소만 남아 oneroom_unpack 이 넘어갈 때까지 [다음 날] → 가방 화분 놓기(밝은 창턱)
      ⚠ 한 판에서 하지 않는 까닭: 밝은 자리는 창턱 둘(㉮ · ㉲)뿐 — 셋째 화분은 어두운 자리라 «⚠ 어둡습니다» 줄이 먼저 선다(의도)
   예외 0 · J 단언엔 !탈 */
import fs from 'node:fs';
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9450', OUT = process.env.OUT || null;
const SAVE = process.env.SAVE || 'C:/Users/pc/AppData/Local/Temp/byeot-master/d_66841206/humanQ/humanQ_g_premove.json';
if (OUT) fs.mkdirSync(OUT, { recursive: true });
let bad = 0; const ok = (c, m, d = '') => { console.log(`${c ? '  OK' : 'FAIL'}  ${m}${d ? '  → ' + d : ''}`); if (!c) bad++; };
const exc = [];
let page = await launch({ width: 390, height: 844, dpr: 2 });   /* ★ let — ㉳ 새 탭 */
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
if (OUT) await page.shot(`${OUT}/390_pot_sold.png`);
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
/* ══ 여기부터 이 자의 몫 — 빈 화분 배너 · 할 일 · 손가락이 같은 말을 하나 ══ */
await sleep(1200);
const SNAP = await J(`localStorage.getItem('byeot/save/1')`);   /* ★ ㉳ 새 탭에 띄울 ㉮ 직전 세이브(그릴 때마다 저장 · §saveSoon) */
const S0 = await J(`(()=>{ const S=window.__S(); return { day: S.day, seed: (S.shop.stock.monstera_seed||0), pot: (S.shop.stock.pot||0), coming: (S.shop.orders||[]).filter(o=>o.itemId==='monstera_seed').length, empty: (S.emptyPots||[]).length, pots: (S.pots||[]).length }; })()`);
console.log('  판', JSON.stringify(S0));
ok(!S0.탈 && S0.seed === 0 && S0.pot >= 1 && S0.coming === 0 && S0.empty === 0 && S0.pots === 0, '판 — 원룸 · 몬스테라 씨앗 0 · 오는 중 0 · 가방 화분 ≥ 1 · 화분 0', JSON.stringify(S0));
const seedTodo = () => J(`(async()=>{ const q = await import('/src/game/quest.js'); const v = q.questView(window.__S(), window.__questSnap()); const r = (v.all||[]).find(x=>x.id==='oneroom_seed_restart'); return { open: v.open.includes('oneroom_seed_restart'), todo: r ? r.todo : null }; })()`);
/* 손가락이 짚은 것(.hintTarget) — 빈 화분 🌱(data-pot)인가 · 가방 문인가 · 글 */
const fingerNow = () => J(`(()=>{ const h=document.getElementById('hint'); const on=!!(h && h.classList.contains('on')); const t=document.querySelector('.hintTarget');
  return { on, say: on ? ((h.querySelector('.say')||h).textContent||'').replace(/\\s+/g,' ').slice(0,50) : '', pot: !!(on && t && t.dataset && t.dataset.pot), id: t ? (t.id || t.getAttribute('data-place') || String(t.className||'')) : null, last: window.__hintLast ? window.__hintLast.say : null }; })()`);
const seedMarks = () => J(`(()=>[...document.querySelectorAll('#marks .mark')].filter(m=>m.dataset.pot).map(m=>{ const r=m.getBoundingClientRect(); return { pot: m.dataset.pot, ko: m.getAttribute('aria-label'), shown: getComputedStyle(m).display!=='none' && r.width>0, x: r.left+r.width/2, y: r.top+r.height/2 }; }))()`);
const placeBagPot = async () => {
  const cell = await J(`(()=>{ window.__byeotSheet.open('bag'); const c=document.querySelector('#bagGrid [data-place^="monsteraSeed"]'); return c ? c.getAttribute('data-place') : null; })()`);
  await sleep(600);
  if (cell && !cell.탈) await page.eval(`(()=>{ const c=document.querySelector('#bagGrid [data-place^="monsteraSeed"]'); if (c) c.click(); return 1; })()`, false);
  /* 배너는 놓은 순간 선다 — 대사 없이 곧장 읽는다 */
  const seen = [];
  for (let i = 0; i < 10; i++) { const b = await bannerNow(); if (b && /빈 화분을 놓았습니다/.test(b) && !seen.includes(b)) seen.push(b); await sleep(250); }
  await dlgOnly();
  await page.eval(`(()=>{ try { window.__byeotSheet.close(); } catch (e) { void e; } return 1; })()`, false); await sleep(1500);
  return { cell, seen };
};
const orderSeed = async () => {
  await page.eval(`(()=>{ window.__byeotSheet.open('shop'); return 1; })()`, false); await sleep(1200);
  const t = await tapSel('#shopList [data-buy="monstera_seed"]'); await sleep(900);
  const go = await J(`(()=>{ const g=document.getElementById('buyGo'); return g ? { on: !!g.offsetParent, dis: g.disabled } : null; })()`);
  if (go && go.on && !go.dis) await page.eval(`(()=>{ document.getElementById('buyGo').click(); return 1; })()`, false);
  await sleep(1200); await dlgOnly();
  await page.eval(`(()=>{ try { window.__byeotSheet.close(); } catch (e) { void e; } return 1; })()`, false); await sleep(1200);
  return { tap: t && t.hit, go, coming: await J(`(window.__S().shop.orders||[]).filter(o=>o.itemId==='monstera_seed').reduce((n,o)=>n+o.qty,0)`) };
};
const nextDayGo = async () => {
  const d0 = await J(`window.__S().day`);
  for (let i = 0; i < 8; i++) {
    await page.eval(`(()=>{ try { window.__byeotSheet.close(); } catch (e) { void e; } const b=document.getElementById('next'); if (b && !b.disabled) { b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})); b.click(); } return 1; })()`, false);
    await sleep(1500);
    await page.eval(`(()=>{ const g=document.getElementById('mealGo'); if (g && g.offsetParent) g.click(); return 1; })()`, false);
    await sleep(1500); await dlgOnly();
    if (await J(`window.__S().day`) !== d0) break;
  }
  for (let i = 0; i < 8; i++) { await bannerNow(); await sleep(300); }
  await dlgOnly();
  return J(`window.__S().day`);
};

/* ㉮ 흔한 차례 ① — 씨앗 0 · 안 옴 · 가방 화분 놓기 → 배너 «상점에서 몬스테라 씨앗을 사세요» · 할 일 같은 말 · 🌱 말풍선 없음(없는 단추를 누르라 하지 않는다) */
const pA = await placeBagPot();
const tA = await seedTodo(), mA = await seedMarks(), fA = await fingerNow();
console.log('  ㉮ 놓음', JSON.stringify({ pA, tA, mA, fA }));
if (OUT) await page.shot(`${OUT}/390_pot_a_buy.png`);
ok(!!pA.cell && !pA.cell.탈 && pA.seen.length > 0, '판 — 가방 화분 칸을 누르니 빈 화분 배너가 섰다', JSON.stringify(pA));
ok(pA.seen.some(b => /상점에서 몬스테라 씨앗을 사세요/.test(b)) && !pA.seen.some(b => /🌱 을 눌러 몬스테라 씨앗을 심으세요/.test(b)), '㉮ 씨앗 0 · 안 옴 — 배너가 «상점에서 몬스테라 씨앗을 사세요»(🌱 을 누르라 하지 않음)', JSON.stringify(pA.seen));
ok(!tA.탈 && tA.open && tA.todo === '상점에서 몬스테라 씨앗을 사세요', '㉮ 할 일도 «상점에서 몬스테라 씨앗을 사세요»', JSON.stringify(tA));
ok(Array.isArray(mA) && mA.length === 0 && !fA.탈 && !fA.pot, '㉮ 🌱 말풍선이 없고 손가락도 빈 화분을 안 짚는다', JSON.stringify({ mA, fA }));
/* ★ 총괄 가름 · [plan] — 짐 풀기 손가락이 살아 있으면 배너가 그 차례를 말한다 */
ok(pA.seen.some(b => /빈 화분을 놓았습니다 짐을 푼 뒤, 상점에서 몬스테라 씨앗을 사세요/.test(b)) && !fA.탈 && fA.on && /openBag|tabBag|box:/.test(String(fA.id)),
   '㉮′ 짐이 남은 채 씨앗 0 — 배너 «짐을 푼 뒤, 상점에서 몬스테라 씨앗을 사세요» · 손가락은 짐 풀기([가방])', JSON.stringify({ seen: pA.seen, fA }));

/* ㉯ 흔한 차례 ② — 씨앗 주문(상점 줄 → [주문]) → 할 일 «몬스테라 씨앗이 오면 🌱 을 눌러 심으세요» */
const oB = await orderSeed();
const tB = await seedTodo();
console.log('  ㉯ 주문', JSON.stringify({ oB, tB }));
ok(!oB.탈 && oB.coming >= 1, '판 — 상점에서 몬스테라 씨앗을 주문했다(오는 중)', JSON.stringify(oB));
ok(!tB.탈 && tB.open && tB.todo === '몬스테라 씨앗이 오면 🌱 을 눌러 심으세요', '㉯ 주문 뒤 할 일 «몬스테라 씨앗이 오면 🌱 을 눌러 심으세요»(«사세요» 아님)', JSON.stringify(tB));

/* ㉰ 다음 날 — 씨앗이 오면 🌱 말풍선 · 할 일 «빈 화분의 🌱 …» · 손가락이 그 🌱 을 짚는다(가방 속 이삿짐 채소보다 먼저) */
const dC = await nextDayGo();
let mC = [], fC = null;
for (let i = 0; i < 12; i++) { mC = await seedMarks(); fC = await fingerNow(); if (fC && fC.pot) break; await sleep(500); }
const tC = await seedTodo();
const boxLeft = await J(`(()=>{ const S=window.__S(); window.__byeotSheet.open('bag'); const n=document.querySelectorAll('#bagGrid [data-place^="box:"]').length; window.__byeotSheet.close(); return n; })()`);
await sleep(1200);
for (let i = 0; i < 12; i++) { fC = await fingerNow(); if (fC && fC.pot) break; await sleep(500); }
console.log('  ㉰ 다음 날', JSON.stringify({ dC, mC, tC, fC, boxLeft }));
if (OUT) await page.shot(`${OUT}/390_pot_c_sow.png`);
ok(dC === S0.day + 1, '판 — 하루 넘김', String(dC));
ok(Array.isArray(mC) && mC.length >= 1 && mC[0].shown, '㉰ 씨앗이 오자 빈 화분에 🌱 말풍선', JSON.stringify(mC));
ok(!tC.탈 && tC.todo === '빈 화분의 🌱 을 눌러 씨앗을 심으세요', '㉰ 할 일 «빈 화분의 🌱 을 눌러 씨앗을 심으세요»', JSON.stringify(tC));
ok(!!fC && !fC.탈 && fC.on && fC.pot, `㉰ 손가락이 빈 화분 🌱 을 짚는다(가방 이삿짐 ${boxLeft} 칸이 남아도)`, JSON.stringify(fC));

/* ㉱ 🌱 진짜 탭 → 심어진다 · 손가락은 다시 짐 풀기([가방])로 */
const tgt = (mC || []).find(x => x.shown);
if (tgt) { await tapAt(tgt.x, tgt.y); await sleep(2500); await dlgOnly(); }
let fD = null; for (let i = 0; i < 10; i++) { fD = await fingerNow(); if (fD && fD.on) break; await sleep(500); }
const aD = await J(`(()=>({ pots: (window.__S().pots||[]).length, empty: (window.__S().emptyPots||[]).length }))()`);
console.log('  ㉱ 심은 뒤', JSON.stringify({ aD, fD }));
ok(!aD.탈 && aD.pots === 1 && aD.empty === 0, '㉱ 🌱 을 누르니 심어졌다(화분 1 · 빈 화분 0)', JSON.stringify(aD));
ok(!!fD && !fD.탈 && !fD.pot && (boxLeft === 0 || (fD.on && /openBag|tabBag|box:/.test(String(fD.id)))), '㉱ 심은 뒤 손가락은 다시 짐 풀기(가방)로', JSON.stringify({ fD, boxLeft }));

/* ㉲ 드문 차례 — 가방에 화분이 있고 씨앗이 오는 중일 때 놓기 → 배너 «몬스테라 씨앗이 오면 🌱 을 눌러 심으세요»
     손: 화분 주문(상점) → 다음 날 화분이 오면 씨앗 주문 → 가방 화분 놓기 */
await page.eval(`(()=>{ window.__byeotSheet.open('shop'); return 1; })()`, false); await sleep(1200);
const tp = await tapSel('#shopList [data-buy="pot"]'); await sleep(900);
await page.eval(`(()=>{ const g=document.getElementById('buyGo'); if (g && g.offsetParent && !g.disabled) g.click(); return 1; })()`, false);
await sleep(1200); await dlgOnly();
await page.eval(`(()=>{ try { window.__byeotSheet.close(); } catch (e) { void e; } return 1; })()`, false); await sleep(800);
const potOrd = await J(`(window.__S().shop.orders||[]).filter(o=>o.itemId==='pot').map(o=>o.arrivesOnDay)`);
let dE = null;
for (let k = 0; k < 4; k++) { dE = await nextDayGo(); if (await J(`(window.__S().shop.stock.pot||0)`) >= 1) break; }
const oE = await orderSeed();
const pE = await placeBagPot();
console.log('  ㉲ 드문 차례', JSON.stringify({ tp: tp && tp.hit, potOrd, dE, oE, pE }));
if (OUT) await page.shot(`${OUT}/390_pot_e_coming.png`);
ok(!oE.탈 && oE.coming >= 1 && !!pE.cell && !pE.cell.탈, '판 — 씨앗이 오는 중 · 가방 화분을 놓았다', JSON.stringify({ potOrd, oE, cell: pE.cell }));
ok(pE.seen.some(b => /몬스테라 씨앗이 오면 🌱 을 눌러 심으세요/.test(b)), '㉲ 씨앗이 오는 중 — 배너 «몬스테라 씨앗이 오면 🌱 을 눌러 심으세요»', JSON.stringify(pE.seen));


/* ㉳ 새 탭 — ㉮ 직전 세이브 → 짐 풀기가 꺼질 때까지 [다음 날] → 가방 화분 놓기(씨앗 0 · 안 옴) → «상점에서 …» 그대로
     (같은 탭 두 번 부팅은 멎는다 — probe_minor5 와 같은 손 · 꺼진 까닭은 그 판 그대로 적는다) */
ok(typeof SNAP === 'string' && SNAP.length > 1000, '판 — ㉮ 직전 세이브를 떴다', String(SNAP && SNAP.length));
await page.close();
page = await launch({ width: 390, height: 844, dpr: 2 });
page.on((method, p) => { if (method === 'Runtime.exceptionThrown') exc.push(((p.exceptionDetails.exception && p.exceptionDetails.exception.description) || p.exceptionDetails.text || '').split('\n')[0].slice(0, 200)); });
await page.send('Runtime.enable');
await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true;` });
await page.goto(`${BASE}/data/balance/homes.json`);
await page.eval(`(()=>{ localStorage.clear(); localStorage.setItem('byeot/save/1', ${JSON.stringify(SNAP)}); localStorage.setItem('byeot.guideSeen','1'); return 1; })()`, false);
await page.goto(`${BASE}/game.html`); await page.waitFor('window.__byeotBooted === true', 300000, 500); await page.waitFor('!!window.__rv', 240000, 500); await sleep(4000);
await dlgOnly();
const bagState = () => J(`(()=>{ const S=window.__S(); window.__byeotSheet.open('bag'); const g=document.getElementById('bagGrid');
  const r = { day: S.day, seed: S.shop.stock.monstera_seed||0, coming: (S.shop.orders||[]).filter(o=>o.itemId==='monstera_seed').length, pot: S.shop.stock.pot||0,
    boxes: g.querySelectorAll('[data-place^="box:"]').length, plants: g.querySelectorAll('[data-potbag], [id="cropThumb"], [id="musunThumb"]').length,
    unpackTaken: ((S.stamina && S.stamina.questsTaken) || []).includes('oneroom_unpack'), pots: (S.pots||[]).length, empty: (S.emptyPots||[]).length };
  window.__byeotSheet.close(); return r; })()`);
let sF = await bagState(); const sF0 = sF;
for (let k = 0; k < 8 && !(sF && !sF.탈 && sF.unpackTaken); k++) { await nextDayGo(); await sleep(800); sF = await bagState(); }
await sleep(1000);
const pF = await placeBagPot();
const fF = await fingerNow();
const whyOff = sF.boxes > 0 && sF.plants === 0 && sF.unpackTaken ? '이삿짐 채소만 남아 넘어감(unpackPassedBoxesOnly)' : (sF.boxes === 0 && sF.plants === 0 ? '다 놓음(plantsLeft 0)' : '그 밖');
console.log('  ㉳ 꺼진 판', JSON.stringify({ sF0, sF, whyOff, pF, fF }));
if (OUT) await page.shot(`${OUT}/390_pot_f_off.png`);
ok(!sF.탈 && sF0.day === S0.day && sF.seed === 0 && sF.coming === 0 && sF.pots === 0 && sF.empty === 0 && !!pF.cell && !pF.cell.탈 && whyOff !== '그 밖',
   `판 — 새 탭 Day ${sF0.day} 세이브 → Day ${sF.day} 짐 풀기 손가락이 꺼진 판(${whyOff}) · 씨앗 0 · 안 옴 · 가방 화분을 놓았다`, JSON.stringify({ sF0, sF, cell: pF.cell }));
ok(pF.seen.some(b => /빈 화분을 놓았습니다 상점에서 몬스테라 씨앗을 사세요/.test(b)) && !pF.seen.some(b => /짐을 푼 뒤|어둡습니다/.test(b)), '㉳ 짐 풀기가 꺼진 판 — 배너 «상점에서 몬스테라 씨앗을 사세요» 그대로(«짐을 푼 뒤» 없음 · 밝은 자리)', JSON.stringify(pF.seen));
ok(!fF.탈 && !/들고 온|가방을 열어|놓으세요/.test(String(fF.say || '')), '㉳ 손가락도 짐 풀기를 안 짚는다', JSON.stringify(fF));

ok(exc.length === 0, '처리 안 된 예외 0', exc.slice(0, 3).join(' / '));
console.log(bad ? `probe_minor5_pot: 빨강 ${bad}` : 'probe_minor5_pot: 다 통과');
await page.close(); process.exit(bad ? 1 : 0);
