/* 비판 8판 8C4 (나) 자(core 11-03 · 총괄 가름) — 방에서 고른 삽수 · 새 종에도 [📍 자리] 목록
   ⛔ 비판 8판 MAJOR #8(A_d462_cut3 · B_d450_cal3 · B_d465_mv4): 맡은 그루 · 삽수를 집고 [📍 자리] → 아무것도 안 열림(몬스테라 화분만 목록이 열렸다)
   판: 투룸 가게 첫날 세이브(C:/Users/pc/byeot-core-keep/critic8/tworoom_shop_first.json · 프로필 안 건드림) — 가방 [누름]으로 삽수 cut_01 · 알로카시아 sp_01 을 놓은 뒤
   단언(390)
     ㉮ 삽수를 방에서 고르고 [📍 자리] — 자리 창이 열리고 제목 «삽수 — 어디에 둘까요» · 줄 하나 이상 · 지금 칸은 «지금 여기 있습니다»(누를 수 없음)
     ㉯ 다른 줄을 누르면 그 칸으로 옮겨짐(세이브 slotId) · 알림 «… 옮겼습니다»
     ㉰ 알로카시아(새 종)도 같은 길 — 제목 «알로카시아 — 어디에 둘까요» · 옮겨짐
     ㉱ 몬스테라 화분 [📍 자리]는 예전 그대로(제목 «어디에 둘까요» · 몬스테라 목록)
       (11-03 §12 ㉶ 투룸 가방 이름이 «몬스테라 {n}» — 칸은 글 대신 data-potbag="pot_01" 로 콕 집고 · 없으면 «칸 없음» 빨강으로 끝)
     ㉲ §11(plan a8f0d8bf ㉡) — 옮긴 뒤 아래 줄 · 기록: 삽수 «삽수는 그날 빛으로 판정해 다음 날 바로 새 자리 값이 됩니다» · «🪴 삽수를 …» / 새 종 «빛 판정은 7일 평균이라 …» · «🪴 알로카시아를 …»
     예외 0 · J 단언엔 !탈 */
import fs from 'node:fs';
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9451', OUT = process.env.OUT || null;
const SAVE = process.env.SAVE || 'C:/Users/pc/byeot-core-keep/critic8/tworoom_shop_first.json';
if (OUT) fs.mkdirSync(OUT, { recursive: true });
let bad = 0; const ok = (c, m, d = '') => { console.log(`${c ? '  OK' : 'FAIL'}  ${m}${d ? '  → ' + d : ''}`); if (!c) bad++; };
if (!fs.existsSync(SAVE)) { ok(false, '세이브 없음', SAVE); process.exit(1); }
const exc = [];
const page = await launch({ width: 390, height: 844, dpr: 2 });
page.on((method, p) => { if (method === 'Runtime.exceptionThrown') exc.push(((p.exceptionDetails.exception && p.exceptionDetails.exception.description) || p.exceptionDetails.text || '').split('\n')[0].slice(0, 200)); });
await page.send('Runtime.enable');
await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true;` });
const J = async (js) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, 120000));
const dlg = async () => { for (let i = 0; i < 160; i++) { const t = await J(`document.getElementById('stage').classList.contains('talking')`); if (t !== true) break; await page.eval(`(()=>{ const b=document.getElementById('dlgBox'); if(b) b.click(); return 1; })()`, false); await sleep(250); } };
const bannerOff = async () => { for (let i = 0; i < 20; i++) { const on = await J(`document.getElementById('event').classList.contains('on')`); if (on !== true) return; await J(`(()=>{ document.getElementById('event').click(); return 1; })()`); await sleep(400); } };
const settle = async () => { await J(`(()=>{ for (const a of document.getAnimations()) { try { a.finish(); } catch (e) { void e; } } return 1; })()`);
  await page.send('Page.captureScreenshot', { format: 'jpeg', quality: 10, clip: { x: 0, y: 0, width: 10, height: 10, scale: 1 } }); await sleep(300); };
await page.goto(`${BASE}/data/balance/homes.json`);
await page.eval(`(()=>{ localStorage.clear(); localStorage.setItem('byeot/save/1', ${JSON.stringify(fs.readFileSync(SAVE, 'utf8'))}); localStorage.setItem('byeot.guideSeen','1'); return 1; })()`, false);
await page.goto(`${BASE}/game.html`); await page.waitFor('window.__byeotBooted === true', 300000, 500); await page.waitFor('!!window.__rv', 240000, 500); await sleep(4000);
await dlg(); await bannerOff(); await sleep(1200);
/* 가방에서 놓기 */
const place = async (sel) => { await J(`(()=>{ window.__byeotSheet.open('bag'); return 1; })()`); await sleep(1500); await settle();
  const r = await J(`(()=>{ const c=document.querySelector('#pageBag .bagslot[data-place="${sel}"]'); if (c) c.click(); return !!c; })()`); await sleep(2200); await settle();
  await J(`(()=>{ const b=document.getElementById('placeOk'); if (b && b.offsetParent) b.click(); return 1; })()`); await sleep(1200); await dlg(); await bannerOff(); return r; };
const keyOf = (id) => J(`(()=>{ const rows = window.__rv.plants ? window.__rv.plants() : []; const r = rows.find(q => q && (q.potId === ${JSON.stringify(id)} || q.key === 'free:' + ${JSON.stringify(id)})); return r ? r.key : null; })()`);
const openWhere = async (key) => { await J(`(()=>{ window.__picked.select(${JSON.stringify(key)}); return 1; })()`); await sleep(900); await settle();
  await J(`(()=>{ const b=document.getElementById('pickWhere'); if (b && b.offsetParent) b.click(); return !!b; })()`); await sleep(1200); await settle();
  return J(`(()=>{ const p=document.getElementById('slotPanel'); const rows=[...document.querySelectorAll('#slotList [data-slot]')]; return { on: !!(p && p.classList.contains('on')), title: (document.getElementById('slotTitle')||{}).textContent || '',
    n: rows.length, here: rows.filter(b=>b.disabled).map(b=>b.dataset.slot), hereTxt: rows.filter(b=>b.disabled).map(b=>(b.querySelector('small')||{}).textContent||''), first: (rows.find(b=>!b.disabled)||{dataset:{}}).dataset.slot || null }; })()`); };
/* ═══ ㉮ ㉯ 삽수 ═══ */
const pc = await place('cutting:cut_01');
const ck = await keyOf('cut_01');
const c0 = await J(`(()=>{ const c=(window.__S().cuttings||[]).find(x=>x.id==='cut_01'); return c ? c.slotId || null : null; })()`);
const a = await openWhere(ck);
console.log('  ㉮ 삽수 [📍 자리]', JSON.stringify({ pc, ck, c0, a }));
if (OUT) await page.shot(`${OUT}/390_c8d_cut_where.png`);
ok(!a.탈 && a.on && a.title === '삽수 — 어디에 둘까요' && a.n >= 1, '㉮ 삽수를 방에서 고르고 [📍 자리] — 자리 창 «삽수 — 어디에 둘까요» · 줄 하나 이상', JSON.stringify({ on: a.on, title: a.title, n: a.n }));
ok(!a.탈 && a.on && (!c0 || (a.here.includes(c0) && /지금 여기 있습니다/.test(a.hereTxt[0] || ''))), '㉮ 지금 칸은 «지금 여기 있습니다»(누를 수 없음)', JSON.stringify({ c0, here: a.here, hereTxt: a.hereTxt }));
const go = a.first;
await J(`(()=>{ const b=document.querySelector('#slotList [data-slot="${go}"]'); if (b) b.click(); return !!b; })()`); await sleep(1500);
const b = await J(`(()=>{ const c=(window.__S().cuttings||[]).find(x=>x.id==='cut_01'); return { slot: c ? c.slotId || null : null, ev: (document.getElementById('event').innerText||'').replace(/\\s+/g,' ').slice(0,160), panel: document.getElementById('slotPanel').classList.contains('on'), log: (window.__S().log||[]).slice(-4).map(x=>(x||{}).msg||'') }; })()`);
console.log('  ㉯ 삽수 옮김', JSON.stringify({ go, b }));
ok(!b.탈 && !!go && b.slot === go && /옮겼습니다/.test(b.ev) && !b.panel, '㉯ 다른 줄을 누르면 그 칸으로 옮겨짐 · 알림 «… 옮겼습니다» · 창 닫힘', JSON.stringify({ go, slot: b.slot, ev: b.ev }));
ok(!b.탈 && /삽수는 그날 빛으로 판정해 다음 날 바로 새 자리 값이 됩니다/.test(b.ev) && !/7일 평균/.test(b.ev) && (b.log || []).some(m => /^🪴 삽수를 .+ 옮겼습니다$/.test(m)), '㉲ 삽수 옮긴 뒤 — 아래 줄 «삽수는 그날 빛으로 판정해 …» · 기록 «🪴 삽수를 …»(§11)', JSON.stringify({ ev: b.ev, log: b.log }));
await bannerOff();
/* ═══ ㉰ 알로카시아 ═══ */
const ps = await place('species:sp_01');
const sk = await keyOf('sp_01');
const s0 = await J(`(()=>{ const q=(window.__S().species && window.__S().species.pots || []).find(x=>x.id==='sp_01'); return q ? q.slotId || null : null; })()`);
const c = await openWhere(sk);
console.log('  ㉰ 알로카시아 [📍 자리]', JSON.stringify({ ps, sk, s0, c }));
if (OUT) await page.shot(`${OUT}/390_c8d_sp_where.png`);
ok(!c.탈 && c.on && c.title === '알로카시아 — 어디에 둘까요' && c.n >= 1, '㉰ 알로카시아도 [📍 자리] — 자리 창 «알로카시아 — 어디에 둘까요»', JSON.stringify({ on: c.on, title: c.title, n: c.n }));
const go2 = c.first;
await J(`(()=>{ const b=document.querySelector('#slotList [data-slot="${go2}"]'); if (b) b.click(); return !!b; })()`); await sleep(1500);
const d = await J(`(()=>{ const rows = window.__rv.plants ? window.__rv.plants() : []; const S=window.__S(); const pots = (S.species && S.species.pots) || []; const q = pots.find(x=>x.id==='sp_01');
  return { slot: q ? q.slotId || null : null, ev: (document.getElementById('event').innerText||'').replace(/\\s+/g,' ').slice(0,160), log: (S.log||[]).slice(-4).map(x=>(x||{}).msg||'') }; })()`);
console.log('  ㉰ 알로카시아 옮김', JSON.stringify({ go2, d }));
ok(!d.탈 && !!go2 && d.slot === go2 && /옮겼습니다/.test(d.ev), '㉰ 알로카시아 — 그 칸으로 옮겨짐 · 알림 «… 옮겼습니다»', JSON.stringify({ go2, slot: d.slot, ev: d.ev }));
ok(!d.탈 && /빛 판정은 7일 평균이라/.test(d.ev) && (d.log || []).some(m => /^🪴 알로카시아를 .+ 옮겼습니다$/.test(m)), '㉲ 새 종 옮긴 뒤 — 아래 줄 «빛 판정은 7일 평균이라 …» · 기록 «🪴 알로카시아를 …»(§11 · 조사)', JSON.stringify({ ev: d.ev, log: d.log }));
await bannerOff();
/* ═══ ㉱ 몬스테라는 예전 그대로 ═══ */
await J(`(()=>{ window.__byeotSheet.open('bag'); return 1; })()`); await sleep(1200); await settle();
const pf = await J(`(()=>{ const c=document.querySelector('#pageBag .bagslot[data-potbag="pot_01"]'); if (c) c.click(); return !!c; })()`);
if (pf !== true) { ok(false, '㉱ 칸 없음 — 가방에 [data-potbag="pot_01"] 칸이 없습니다(몬스테라를 못 집음)', JSON.stringify(pf)); try { await page.close(); } catch (e2) { void e2; } console.log(`\nprobe_critic8_d: 빨강 ${bad}`); process.exit(1); }
await sleep(2200); await settle();
await J(`(()=>{ const b=document.getElementById('placeOk'); if (b && b.offsetParent) b.click(); return 1; })()`); await sleep(1500); await dlg(); await bannerOff();
const pk = await keyOf('pot_01');
const e = await openWhere(pk);
console.log('  ㉱ 몬스테라 [📍 자리]', JSON.stringify({ pk, e }));
ok(!e.탈 && e.on && e.title === '어디에 둘까요' && e.n >= 1, '㉱ 몬스테라 화분 [📍 자리]는 예전 그대로(제목 «어디에 둘까요»)', JSON.stringify({ title: e.title, n: e.n }));
ok(exc.length === 0, '처리 안 된 예외 0', exc.slice(0, 3).join(' / '));
try { await page.close(); } catch (e2) { void e2; }
console.log(bad ? `\nprobe_critic8_d: 빨강 ${bad}` : '\nprobe_critic8_d: 다 통과');
process.exit(bad ? 1 : 0);
