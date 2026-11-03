/* 비판 8판 §12 · §13 화면 글 자(core 11-03 · 총괄 가름 «바꾼 단언마다 고치기 전 빨강») — 대사 · 데이터 글은 node(test_dialogue_coverage) 몫, 여기는 화면에 서는 글
   판(프로필 안 건드림 · 값 손질 없음 · 사람 손만)
     A  비판 8판 ready_d445(원룸 · 500만 닿음) — C:/Users/pc/byeot-core-keep/critic8/ready_d445.json
     B  투룸 돌봄 첫날 — C:/Users/pc/byeot-core-keep/critic8/tworoom_care_first.json(맡은 칼라테아가 가방)
   단언(390)
     ㉮ A [내 집 마련] → [계약한다] → 진로 카드: 밑글 아래 «두고 가는 것 — 벽 · 창 · 천장에 붙은 가구 {n}개»(n ≥ 1 · 원룸 이사 창과 같은 셈 · 보이는 줄) — plan §13 ㉣
     ㉯ A 그날(Day 445) «많이 컸네! 이 칸이 좁아졌어 …»는 한 번까지 · [가게를 연다] 뒤(진로를 고른 날 · 짐 풀기 · 같은 날 다시 켬)엔 안 섬 — plan §12 ㉣
     ㉰ B 가방의 맡은 칼라테아 [누름] — 배너 아래 줄 «너무 밝으면 잎을 맙니다 — 알맞은 빛은 7일 평균 2~8입니다»(알로카시아 겨울잠 글 아님) — plan §12 ㉢
     ㉱ B 상점 주문 창 · 돈 모자람 — 끝 문장 «돈이 들어오면 시킬 수 있습니다 — 채소는 상점에 팔면 바로 들어옵니다.»(«며칠 지나야» 없음) — plan §13 ㉩
     예외 0 · J 단언엔 !탈 */
import fs from 'node:fs';
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9451', OUT = process.env.OUT || null;
const SAVE_A = process.env.SAVE_A || 'C:/Users/pc/byeot-core-keep/critic8/ready_d445.json';
const SAVE_B = process.env.SAVE_B || 'C:/Users/pc/byeot-core-keep/critic8/tworoom_care_first.json';
if (OUT) fs.mkdirSync(OUT, { recursive: true });
let bad = 0; const ok = (c, m, d = '') => { console.log(`${c ? '  OK' : 'FAIL'}  ${m}${d ? '  → ' + d : ''}`); if (!c) bad++; };
for (const f of [SAVE_A, SAVE_B]) if (!fs.existsSync(f)) { ok(false, '세이브 없음', f); process.exit(1); }
const exc = [];
const page = await launch({ width: 390, height: 844, dpr: 2 });
page.on((method, p) => { if (method === 'Runtime.exceptionThrown') exc.push(((p.exceptionDetails.exception && p.exceptionDetails.exception.description) || p.exceptionDetails.text || '').split('\n')[0].slice(0, 200)); });
await page.send('Runtime.enable');
await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true;` });
const J = async (js) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, 120000));
const talk = async (max = 160) => {
  const lines = [];
  for (let i = 0; i < max; i++) {
    const t = await J(`(()=>({ on: document.getElementById('stage').classList.contains('talking'), text: ((document.getElementById('dlgText') || {}).textContent || '').trim() }))()`);
    if (t.탈) { lines.push('탈:' + t.탈); break; }
    if (!t.on) { await sleep(700); const t2 = await J(`document.getElementById('stage').classList.contains('talking')`); if (t2 !== true) break; continue; }
    if (t.text && lines[lines.length - 1] !== t.text) lines.push(t.text);
    await page.eval(`(()=>{ const x=document.getElementById('dlgBox'); if (x) x.click(); })()`, false); await sleep(220);
  }
  return lines;
};
const bannerOff = async () => { for (let i = 0; i < 20; i++) { const on = await J(`document.getElementById('event').classList.contains('on')`); if (on !== true) return; await J(`(()=>{ document.getElementById('event').click(); return 1; })()`); await sleep(400); } };
/* 배너 글 적기(자 쪽 관찰 · 게임은 안 건드림) */
const watchBanners = () => J(`(()=>{ const e=document.getElementById('event'); window.__c8fBan = []; const mo = new MutationObserver(()=>{ const t=(e.textContent||'').trim(); if (t) window.__c8fBan.push(t); }); mo.observe(e, { childList:true, subtree:true, characterData:true }); return 1; })()`);
const load = async (file) => {
  await page.goto(`${BASE}/data/balance/homes.json`);
  await page.eval(`(()=>{ localStorage.clear(); localStorage.setItem('byeot/save/1', ${JSON.stringify(fs.readFileSync(file, 'utf8'))}); localStorage.setItem('byeot.guideSeen','1'); return 1; })()`, false);
  await page.goto(`${BASE}/game.html`); await page.waitFor('window.__byeotBooted === true', 300000, 500); await page.waitFor('!!window.__rv', 240000, 500); await sleep(4000);
};
const WIDE = '많이 컸네! 이 칸이 좁아졌어. 더 넓고 밝은 자리로 옮겨 주자.';

/* ═══ A — 진로 카드 · 진로 고른 날 ═══ */
await load(SAVE_A);
const a0 = await talk(); await bannerOff(); await sleep(1500);
const a0b = await talk();
const dayA = await J(`window.__S().day`);
await J(`(()=>{ window.__byeotSheet.open('quest'); return 1; })()`); await sleep(900);
await J(`(()=>{ const b=document.querySelector('[data-act="homeAsk"]'); if (b) b.click(); return !!b; })()`); await sleep(900);
await J(`(()=>{ const b=document.getElementById('homeGo'); if (b) b.click(); return !!b; })()`); await sleep(1500);
const a1 = await talk(); await sleep(800);
await J(`(()=>{ const b=document.getElementById('homeNext'); if (b && b.offsetParent) b.click(); return 1; })()`); await sleep(1500);
const a2 = await talk(); await sleep(600);
const ce = await J(`(()=>{ const el=document.getElementById('chapterEnd'), sub=document.getElementById('chapterEndSub'); const lv = sub && sub.querySelector('.jobLeave');
  const r = lv ? lv.getBoundingClientRect() : null;
  return { on: el.classList.contains('on'), sub: sub ? sub.textContent : null, leave: lv ? lv.textContent : null, vis: !!(r && r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom <= innerHeight),
           cards: [...document.querySelectorAll('#jobCards [data-job]')].map(b=>b.dataset.job) }; })()`);
console.log('  A 진로 카드', JSON.stringify(ce));
if (OUT) await page.shot(`${OUT}/390_c8f_jobcards.png`);
const mLeave = /두고 가는 것 — 벽 · 창 · 천장에 붙은 가구 (\d+)개/.exec((ce && ce.sub) || '');
ok(!ce.탈 && ce.on && !!mLeave && +mLeave[1] >= 1 && ce.vis, '㉮ 진로 카드 밑글 아래 «두고 가는 것 — 벽 · 창 · 천장에 붙은 가구 {n}개»(n ≥ 1 · 보이는 줄)', JSON.stringify({ sub: ce.sub, vis: ce.vis }));
await J(`(()=>{ const b=document.querySelector('#jobCards [data-job="shop"]'); if (b) b.click(); return !!b; })()`); await sleep(6000);
await page.waitFor('!!window.__rv', 240000, 500); await sleep(3000);
const a3 = await talk(); await bannerOff();
/* 짐 풀기 — 가방 삽수 · 그루를 사람 손([누름])으로 놓고 그리기가 몇 번 돈다(§draw → §maybeSayYoungWide) */
const a4 = [];
for (let k = 0; k < 4; k++) {
  await J(`(()=>{ window.__byeotSheet.open('bag'); return 1; })()`); await sleep(1200);
  const t = await J(`(()=>{ const c=document.querySelector('#pageBag .bagslot[data-place^="cutting:"], #pageBag [data-potbag]'); if (c) c.click(); return c ? (c.dataset.place || c.dataset.potbag || 'x') : null; })()`);
  await sleep(2200);
  await J(`(()=>{ const b=document.getElementById('placeOk'); if (b && b.offsetParent) b.click(); return 1; })()`); await sleep(1800);
  a4.push(...await talk()); await bannerOff();
  if (!t) break;
}
await J(`(()=>{ try { window.__byeotSheet.close(); } catch (e) { void e; } return 1; })()`); await sleep(2500);
a4.push(...await talk());
/* 같은 날 다시 켬(비판 A 는 다시 켤 때마다 메모리 칸이 비어 또 섰다) — 켜고 가방을 열었다 닫아 그리기가 돌게 */
await sleep(1500);
await page.goto(`${BASE}/game.html`); await page.waitFor('window.__byeotBooted === true', 300000, 500); await page.waitFor('!!window.__rv', 240000, 500); await sleep(4000);
a4.push(...await talk()); await bannerOff();
for (let k = 0; k < 2; k++) { await J(`(()=>{ window.__byeotSheet.open('bag'); return 1; })()`); await sleep(1200); await J(`(()=>{ try { window.__byeotSheet.close(); } catch (e) { void e; } return 1; })()`); await sleep(1800); a4.push(...await talk()); }
const dayA2 = await J(`window.__S().day`);
const before = [...a0, ...a0b, ...a1, ...a2].filter(t => t === WIDE).length, after = [...a3, ...a4].filter(t => t === WIDE).length;
console.log('  A 그날', JSON.stringify({ dayA, dayA2, before, after, a3: a3.slice(0, 8), a4: a4.slice(0, 8) }));
ok(dayA === dayA2 && before + after <= 1, `㉯ 그날 «많이 컸네! …»는 한 번까지(진로 고르기 전 ${before} · 뒤 ${after})`, JSON.stringify({ dayA, dayA2 }));
ok(after === 0, `㉯ 진로를 고른 날(짐 풀기) «많이 컸네! …»가 안 섬(센 수 ${after})`, JSON.stringify([...a3, ...a4].filter(t => t === WIDE)));

/* ═══ B — 맡은 칼라테아 놓기 글 · 주문 창 ═══ */
await load(SAVE_B);
await talk(); await bannerOff();
await watchBanners();
await J(`(()=>{ window.__byeotSheet.open('bag'); return 1; })()`); await sleep(1500);
const sp = await J(`(()=>{ const cs=[...document.querySelectorAll('#pageBag .bagslot[data-place^="species:"]')]; const c = cs.find(e=>/칼라테아/.test((e.getAttribute('title')||'') + (e.textContent||''))); if (c) c.click(); return { n: cs.length, hit: c ? c.dataset.place : null }; })()`);
await sleep(2500);
const ban = await J(`(window.__c8fBan || []).slice(-6)`);
console.log('  B 칼라테아 누름', JSON.stringify({ sp, ban }));
if (OUT) await page.shot(`${OUT}/390_c8f_calathea.png`);
ok(!sp.탈 && !!sp.hit && Array.isArray(ban) && ban.some(t => /너무 밝으면 잎을 맙니다 — 알맞은 빛은 7일 평균 2~8입니다/.test(t)) && !ban.some(t => /겨울엔 잎을 다 떨구고/.test(t)),
   '㉰ 맡은 칼라테아 [누름] — «너무 밝으면 잎을 맙니다 — 알맞은 빛은 7일 평균 2~8입니다»(알로카시아 겨울잠 글 아님)', JSON.stringify(ban));
await talk(); await bannerOff();
await J(`(()=>{ try { window.__byeotSheet.open('shop'); } catch (e) { void e; } return 1; })()`); await sleep(1500);
const ids = await J(`[...document.querySelectorAll('#shopList [data-buy]')].map(b=>b.dataset.buy)`);
let quote = null;
for (const id of (Array.isArray(ids) ? ids : [])) {
  const q = await J(`(async()=>{ const b=document.querySelector('#shopList [data-buy="${id}"]'); if (!b) return null; b.scrollIntoView({ block: 'center' }); b.click(); await new Promise(r=>setTimeout(r,500));
    const el=document.getElementById('buyQuote'); const r = { id: ${JSON.stringify(id)}, warn: !!(el && el.classList.contains('warn')), t: el ? el.textContent : null, vis: !!(el && el.offsetParent) };
    const c=document.getElementById('buyCancel'); if (c && c.offsetParent) c.click(); await new Promise(r=>setTimeout(r,300)); return r; })()`);
  if (q && q.warn && /돈이 모자랍니다/.test(q.t || '')) { quote = q; break; }
}
console.log('  B 주문 창', JSON.stringify({ n: Array.isArray(ids) ? ids.length : ids, quote }));
ok(!!quote && /돈이 들어오면 시킬 수 있습니다 — 채소는 상점에 팔면 바로 들어옵니다\.$/.test(quote.t || '') && !/며칠 지나야/.test(quote.t || ''),
   '㉱ 돈 모자란 주문 창 끝 문장 «돈이 들어오면 시킬 수 있습니다 — 채소는 상점에 팔면 바로 들어옵니다.»', JSON.stringify(quote));
ok(exc.length === 0, '처리 안 된 예외 0', exc.slice(0, 3).join(' / '));
try { await page.close(); } catch (e) { console.log('  (탭 닫기 탈)', e.message); }
console.log(bad ? `FAIL ${bad}` : 'ALL OK');
process.exit(bad ? 1 : 0);
