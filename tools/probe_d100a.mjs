/* 총괄 D100 ① · #2 자(core 11-01 · 비판 다섯째 판 ⑤ #1 · #2 · #3 · #4 손 순서) — 390×844
   판: 총괄 humanQ g premove(반지하 Day 134 · 화분 1 · 삽수 0 · 무늬 모그루 = 무늬 원천 1)
   손: [상점] 판 → [몬스테라 내놓기] 진짜 탭 → (창 [그래도 내놓는다] · 작업 전 판은 한 번 더 탭)
       → 연락 날을 내일로 당겨(날 건너뛰기 손질 · 연락은 원래 무작위 며칠 뒤) [다음 날] → [상점] [거래하기] 진짜 탭 → (창 [그래도 판다])
   ㉮ 첫 탭에 «보이는» 확인 창이 서고 «무늬 원천 0» 줄이 있다(#4 대사가 판 뒤에 숨음 · #1 미리 알림)
   ㉯ 단추 글 값 = 올라간 값(#2 · 872,500 vs 1,960,000)
   ㉰ [거래하기] 첫 탭에 확인 창(#3 — 확인 없이 바로 팔림)
   ㉱ 거래 뒤 [상점] 단추가 «내놓는 중»으로 남지 않는다(#3 d95_after)
   예외 0 */
import fs from 'node:fs';
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9448', OUT = process.env.OUT || null;
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
const dlgOnly = async () => { for (let i = 0; i < 80; i++) { const t = await J(`document.getElementById('stage').classList.contains('talking')`); if (!t) return; await page.eval(`(()=>{ const s=document.getElementById('dlgSkip'); if(s) s.click(); const b=document.getElementById('dlgBox'); if(b) b.click(); return 1; })()`, false); await sleep(250); } };
await dlgOnly();
const m = (type, x, y, buttons) => page.send('Input.dispatchMouseEvent', { type, x: Math.round(x), y: Math.round(y), button: 'left', buttons, clickCount: 1 });
const tapAt = async (x, y) => { await m('mouseMoved', x, y, 0); await m('mousePressed', x, y, 1); await sleep(60); await m('mouseReleased', x, y, 0); };
/* 진짜 탭 — 보이게 굴린 뒤 그 점에서 잡히는 것이 그 단추인지까지 본다 */
const tapSel = async (sel) => {
  const r = await J(`(()=>{ const b=document.querySelector(${JSON.stringify(sel)}); if (!b) return null; b.scrollIntoView({ block: 'center' }); const q=b.getBoundingClientRect(); const x=q.left+q.width/2, y=q.top+q.height/2; const top=document.elementFromPoint(x,y); return { x, y, hit: !!(top && (top===b || b.contains(top))), t: (b.textContent||'').replace(/\\s+/g,' ').slice(0,60) }; })()`);
  if (r && r.hit) await tapAt(r.x, r.y);
  return r;
};
const seen = () => J(`(()=>{ const ask=document.getElementById('varieAsk'); const askOn = !!(ask && ask.classList.contains('on'));
  let askSeen = false; if (askOn) { const c=ask.querySelector('.popcard').getBoundingClientRect(); const top=document.elementFromPoint(c.left+c.width/2, c.top+20); askSeen = !!(top && ask.contains(top)); }
  const dlg=document.getElementById('dlgBox'); const talking=document.getElementById('stage').classList.contains('talking');
  let talkSeen=false; if (talking && dlg) { const r=dlg.getBoundingClientRect(); const top=document.elementFromPoint(r.left+r.width/2, r.top+Math.min(30,r.height/2)); talkSeen = !!(top && top.closest && top.closest('#dlgBox')); }
  const lines = askOn ? [...document.querySelectorAll('#varieAskLines > div')].map(d=>d.textContent) : [];
  return { askOn, askSeen, talking, talkSeen, talk: talking ? (document.getElementById('dlgText')||{}).textContent : '', lines, sell: (document.getElementById('sellPlant')||{}).textContent || '' }; })()`);
const listing = () => J(`(()=>{ const S=window.__S(); const L=(S.shop&&S.shop.listings)||[]; return L.map(l=>({ id:l.listingId, kind:l.kind, won:l.won, status:l.status, contactOnDay:l.contactOnDay })); })()`);

await page.eval(`(()=>{ window.__byeotSheet.open('shop'); return 1; })()`, false); await sleep(1200);
const before = await J(`(()=>{ const b=document.getElementById('sellPlant'); return { t: (b.textContent||''), dis: b.disabled, pots: (window.__S().pots||[]).length }; })()`);
const btnWon = +((before.t.match(/\(([\d,]+)원\)/) || [])[1] || '').replace(/,/g, '');
console.log('  내놓기 단추', JSON.stringify(before));
const hintOn = (goId) => J(`(()=>{ const h=document.getElementById('hint'); const on=!!(h && h.classList.contains('on')); const t=document.querySelector('.hintTarget'); const g=document.getElementById(${JSON.stringify(goId)}); return { on, say: on ? (h.textContent||'').replace(/\s+/g,' ').slice(0,50) : '', onGo: !!(on && t && g && (t===g || g.contains(t))) }; })()`);
const t1 = await tapSel('#sellPlant'); await sleep(900);
const s1 = await seen();
const h1 = await hintOn('varieAskGo');
console.log('  첫 탭 뒤', JSON.stringify({ tap: t1, ...s1 }));
if (OUT) await page.shot(`${OUT}/390_d100_list1.png`);
ok(s1.askOn && s1.askSeen, '㉮ 첫 탭에 «보이는» 확인 창이 선다(대사가 판 뒤에 숨지 않는다)', JSON.stringify({ askOn: s1.askOn, askSeen: s1.askSeen, talking: s1.talking, talkSeen: s1.talkSeen, sell: s1.sell }));
ok(s1.lines.some(l => /무늬 원천 0/.test(l)), '㉮ 창에 «무늬 원천 0» 줄(이사 창과 같은 말)', JSON.stringify(s1.lines));
/* ★ 총괄 11-01 MAJOR — 경고 창 위에서 손가락이 [그래도 내놓는다]를 짚지 않는다(창 글과 반대 말) */
ok(s1.askOn && !h1.탈 && !h1.onGo, '㉲ 원천 0 경고 창 — 손가락이 [그래도 내놓는다]를 안 짚는다', JSON.stringify(h1));
if (s1.askOn) { await tapSel('#varieAskGo'); await sleep(1200); }
else { await dlgOnly(); await tapSel('#sellPlant'); await sleep(1200); await dlgOnly(); }   /* 작업 전 판 — 비판 판처럼 한 번 더 */
let L = await listing();
if (!L.some(l => l.kind === 'pot')) { await dlgOnly(); await tapSel('#sellPlant'); await sleep(1200); await dlgOnly(); L = await listing(); }
const pl = L.find(l => l.kind === 'pot');
console.log('  올린 것', JSON.stringify(L), '단추 값', btnWon);
ok(!!pl, '판 — 모그루가 올라갔다', JSON.stringify(L));
ok(!!pl && Number.isFinite(btnWon) && btnWon === pl.won, '㉯ 단추 글 값 = 올라간 값(#2)', `단추 ${btnWon} · 올린 ${pl && pl.won}`);
/* 연락 날을 내일로(날 건너뛰기 손질) → [다음 날] */
await J(`(()=>{ const S=window.__S(); for (const l of (S.shop.listings||[])) if (l.kind==='pot') l.contactOnDay = S.day + 1; return 1; })()`);
await page.eval(`(()=>{ window.__byeotSheet.close(); return 1; })()`, false); await sleep(600);
await page.eval(`(()=>{ const b=document.getElementById('next'); b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})); b.click(); return 1; })()`, false);
await sleep(1500); await page.eval(`(()=>{ const g=document.getElementById('mealGo'); if (g && g.offsetParent) g.click(); return 1; })()`, false);
await sleep(3000); await dlgOnly(); await sleep(1500); await dlgOnly();
console.log('  연락 뒤', JSON.stringify(await listing()));
await page.eval(`(()=>{ window.__byeotSheet.open('shop'); return 1; })()`, false); await sleep(1200);
const t2 = await tapSel('#marketList [data-deal]'); await sleep(900);
const s2 = await seen();
const h2 = await hintOn('varieAskGo');
const sold0 = await J(`(()=>(window.__S().pots||[]).length)()`);
console.log('  [거래하기] 탭 뒤', JSON.stringify({ tap: t2, ...s2, pots: sold0 }));
if (OUT) await page.shot(`${OUT}/390_d100_deal1.png`);
ok(!!t2 && t2.hit, '판 — [거래하기]가 보이고 눌렸다', JSON.stringify(t2));
ok(s2.askOn && s2.askSeen && sold0 >= 1, '㉰ [거래하기] 첫 탭에 확인 창 · 아직 안 팔림(#3)', JSON.stringify({ askOn: s2.askOn, askSeen: s2.askSeen, pots: sold0 }));
ok(s2.lines.some(l => /무늬 원천 0/.test(l)), '㉰ 창에 «무늬 원천 0» 줄', JSON.stringify(s2.lines));
ok(s2.askOn && !h2.탈 && !h2.onGo, '㉲ 원천 0 경고 창 — 손가락이 [그래도 판다]를 안 짚는다', JSON.stringify(h2));
if (s2.askOn) { await tapSel('#varieAskGo'); await sleep(1500); }
await dlgOnly(); await sleep(800);
await page.eval(`(()=>{ window.__byeotSheet.open('shop'); return 1; })()`, false); await sleep(1000);
const s3 = await seen();
const pots3 = await J(`(()=>(window.__S().pots||[]).length)()`);
console.log('  거래 뒤', JSON.stringify({ sell: s3.sell, pots: pots3 }));
if (OUT) await page.shot(`${OUT}/390_d100_after.png`);
ok(pots3 === 0, '판 — 모그루가 팔렸다(창 [그래도 판다] · 작업 전 판은 바로)', String(pots3));
ok(!/내놓는 중/.test(s3.sell), '㉱ 거래 뒤 [상점] 단추가 «내놓는 중»으로 남지 않는다', s3.sell);
ok(exc.length === 0, '처리 안 된 예외 0', exc.slice(0, 3).join(' / '));
console.log(bad ? `probe_d100a: 빨강 ${bad}` : 'probe_d100a: 다 통과');
await page.close(); process.exit(bad ? 1 : 0);
