/* 비판 7판 7C7 자(core 11-02 · 총괄 가름) — 씨앗이 모자란 날 손가락이 바닥 🛒 를 짚나
   ⛔ 비판 7판 A Day 10(d10_001): 바닥 «🛒 콩 씨앗 주문 · 500원 (내일 심을 씨앗이 모자랍니다)»는 섰는데 손가락은 [다음 날] «자라는 중입니다 — 내일이면 거둡니다»
      — «씨앗을 사러» 갈래(seedNeed)의 문이 «놓인 줄 가운데 harvestCount > 0 ∨ 거둔 줄»이었고 cropPotList 줄에 harvestCount 칸이 없어 거둔 줄 0 인 날 꺼졌다
   판: 비판 6판 A100 세이브(C:/Users/pc/byeot-core-keep/critic6/ · 프로필은 안 건드림) — 손질(Day 10 꼴): 체력 가득 · 콩 씨앗 0 · 콩 씨앗 주문 없음 ·
       콩나물 시루 · 무순 재배판은 다 «막 심은» 꼴(거둔 줄 0) 가운데 crop_01_02 만 내일 익음(ageDays = 거둘 날 − 1) — 자리 사본 harvestCount 는 그대로(≥ 1)
   단언
     ㉮ Day 10 꼴 — 바닥 🛒(data-buy bean_seed)가 서고 손가락이 그것을 «씨앗을 사러 갑니다»로 짚는다([다음 날] 아님)
     ㉯ 같은 판에 익은 시루가 하나 더 있으면 손가락은 먼저 거두기(돌봄 뒤에 🛒)
     ㉰ 🛒 를 누르면 주문 창 · 개수 = 모자란 수 · 손가락 [주문] → 주문하면 🛒 가 걷히고 손가락 [다음 날]
     ㉱ 씨앗이 넉넉하면(🛒 없음) 손가락은 예전처럼 [다음 날] «자라는 중입니다 — 내일이면 거둡니다» · 예외 0 · J 단언엔 !탈 */
import fs from 'node:fs';
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9451', OUT = process.env.OUT || null;
const SAVE_A = process.env.SAVE_A || 'C:/Users/pc/byeot-core-keep/critic6/saveA_d100.json';
if (OUT) fs.mkdirSync(OUT, { recursive: true });
let bad = 0; const ok = (c, m, d = '') => { console.log(`${c ? '  OK' : 'FAIL'}  ${m}${d ? '  → ' + d : ''}`); if (!c) bad++; };
if (!fs.existsSync(SAVE_A)) { ok(false, '세이브 없음', SAVE_A); process.exit(1); }
const stage = ({ seed, ripe }) => { const w = JSON.parse(fs.readFileSync(SAVE_A, 'utf8')); const s = w.state;
  s.stamina.left = s.stamina.max; s.shop.stock.bean_seed = seed; s.shop.orders = (s.shop.orders || []).filter(o => o.itemId !== 'bean_seed');
  const hd = s.firstPlay.beansprout.harvestDays || 5;
  for (const p of s.firstPlay.beansprout.pots) {
    if (!p.slotId) continue;
    const age = p.id === 'crop_01_02' ? hd - 1 : (ripe && p.id === 'crop_01_03') ? hd : 0;
    Object.assign(p, { sown: true, harvested: false, ageDays: age, startedOnDay: s.day - age, idleSinceDay: s.day - age });
  }
  for (const v of Object.values(s.firstPlay.crops || {})) for (const p of ((v && v.pots) || [])) if (p.slotId) Object.assign(p, { sown: true, harvested: false, ageDays: 0, startedOnDay: s.day, idleSinceDay: s.day });
  return JSON.stringify(w); };
const exc = [];
const page = await launch({ width: 390, height: 844, dpr: 2 });
page.on((method, p) => { if (method === 'Runtime.exceptionThrown') exc.push(((p.exceptionDetails.exception && p.exceptionDetails.exception.description) || p.exceptionDetails.text || '').split('\n')[0].slice(0, 200)); });
await page.send('Runtime.enable');
await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true;` });
const J = async (js) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, 120000));
const dlg = async () => { for (let i = 0; i < 80; i++) { const t = await J(`document.getElementById('stage').classList.contains('talking')`); if (t !== true) break; await page.eval(`(()=>{ const b=document.getElementById('dlgBox'); if(b) b.click(); return 1; })()`, false); await sleep(250); } };
const boot = async (txt) => {
  await page.goto(`${BASE}/data/balance/homes.json`);
  await page.eval(`(()=>{ localStorage.clear(); localStorage.setItem('byeot/save/1', ${JSON.stringify(txt)}); localStorage.setItem('byeot.guideSeen','1'); return 1; })()`, false);
  await page.goto(`${BASE}/game.html`); await page.waitFor('window.__byeotBooted === true', 300000, 500); await page.waitFor('!!window.__rv', 240000, 500); await sleep(3500);
  await dlg(); await J(`(()=>{ try { window.__byeotSheet.close(); } catch (e) { void e; } return 1; })()`); await sleep(1200);
  /* 카메라가 멎고(§probe-wait-camera-still) 손가락이 설 때까지 — 부팅 직후엔 손가락이 꺼져 있다 */
  let n = 0; for (let i = 0; i < 60 && n < 2; i++) { const b = await J(`(()=>{ try { return !!window.__rv.camBusy(); } catch (e) { return false; } })()`); n = b === false ? n + 1 : 0; await sleep(200); }
  for (let i = 0; i < 30; i++) { const on = await J(`(()=>{ try { window.__byeotHint(); } catch (e) { void e; } return document.getElementById('hint').classList.contains('on'); })()`); if (on === true) break; await sleep(300); }
};
const HINT = `(async()=>{ try { window.__byeotHint(); } catch (e) { void e; } await new Promise(r=>setTimeout(r,900));
  const h=document.getElementById('hint'), t=document.querySelector('.hintTarget'), rb=document.getElementById('resow');
  return { on: h.classList.contains('on'), tid: t ? t.id || null : null, tcls: t ? (t.className||'').toString().slice(0,40) : null, say: (h.querySelector('.say')||{}).textContent,
    resow: rb ? { shown: rb.style.display !== 'none' && !!rb.offsetParent, buy: rb.dataset.buy || null, t: (rb.textContent||'').trim().slice(0,40) } : null }; })()`;
/* ㉮ Day 10 꼴 */
await boot(stage({ seed: 0, ripe: false }));
const a = await J(HINT);
console.log('  ㉮ Day 10 꼴', JSON.stringify(a));
if (OUT) await page.shot(`${OUT}/390_c7b_d10.png`);
ok(!a.탈 && a.resow && a.resow.shown && a.resow.buy === 'bean_seed', '㉮ 판 — 바닥 🛒 콩 씨앗 주문(내일 심을 씨앗이 모자랍니다)이 섰다', JSON.stringify(a.resow));
ok(!a.탈 && a.on && a.tid === 'resow' && a.say === '씨앗을 사러 갑니다', '㉮ 손가락이 바닥 🛒 를 «씨앗을 사러 갑니다»로 짚는다([다음 날] 아님)', JSON.stringify({ tid: a.tid, say: a.say }));
/* ㉰ 누르면 주문 창 → 주문 → [다음 날] */
await J(`(()=>{ document.getElementById('resow').click(); return 1; })()`); await sleep(1500);
const b = await J(`(async()=>{ const x = await (${HINT}); return { ...x, count: (document.getElementById('buyCount')||{}).textContent, panel: document.getElementById('buyPanel').classList.contains('on') }; })()`);
console.log('  ㉰ 🛒 누른 뒤', JSON.stringify(b));
ok(!b.탈 && b.panel && b.count === '1개' && b.tid === 'buyGo', '㉰ 🛒 를 누르면 주문 창 · 개수 1(내일 익을 시루 1 − 씨앗 0) · 손가락 [주문]', JSON.stringify({ panel: b.panel, count: b.count, tid: b.tid, say: b.say }));
await J(`(()=>{ document.getElementById('buyGo').click(); return 1; })()`); await sleep(1800); await dlg();
const c = await J(HINT);
console.log('  ㉰ 주문 뒤', JSON.stringify(c));
if (OUT) await page.shot(`${OUT}/390_c7b_ordered.png`);
ok(!c.탈 && c.on && c.tid === 'next' && !(c.resow && c.resow.shown && c.resow.buy), '㉰ 주문하면 🛒 가 걷히고 손가락은 [다음 날](씨앗이 오는 중 · 시루는 자라는 중)', JSON.stringify({ tid: c.tid, say: c.say, resow: c.resow }));
/* ㉯ 익은 시루가 하나 더 */
await boot(stage({ seed: 0, ripe: true }));
const d = await J(HINT);
console.log('  ㉯ 익은 시루 있음', JSON.stringify(d));
ok(!d.탈 && d.on && d.tid !== 'resow' && /거둘/.test(d.say || ''), '㉯ 익은 시루가 있으면 손가락은 먼저 거두기(🛒 는 돌봄 뒤)', JSON.stringify({ tid: d.tid, tcls: d.tcls, say: d.say }));
/* ㉱ 씨앗 넉넉 */
await boot(stage({ seed: 10, ripe: false }));
const e = await J(HINT);
console.log('  ㉱ 씨앗 넉넉', JSON.stringify(e));
ok(!e.탈 && e.on && e.tid === 'next' && e.say === '자라는 중입니다 — 내일이면 거둡니다' && !(e.resow && e.resow.shown && e.resow.buy), '㉱ 씨앗 넉넉하면 🛒 없음 · 손가락 [다음 날] «자라는 중입니다 — 내일이면 거둡니다»', JSON.stringify({ tid: e.tid, say: e.say, resow: e.resow }));
ok(exc.length === 0, '처리 안 된 예외 0', exc.slice(0, 3).join(' / '));
try { await page.close(); } catch (e2) { console.log('  (탭 닫기 탈)', e2.message); }
console.log(bad ? `probe_critic7_b: 빨강 ${bad}` : 'probe_critic7_b: 다 통과');
process.exit(bad ? 1 : 0);
