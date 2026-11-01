/* 비판 다섯째 판 #9 가름 자(core 11-01) — «연락이 와도 방 화면엔 안 보임» — 390×844
   판: 총괄 humanQ g premove(반지하 Day 134 · 모그루 하나) → [상점] 몬스테라 내놓기 → 창 [내놓는다] →
       연락 날을 내일로 당김(손질: listing.contactOnDay = 내일 · 며칠 기다리는 것을 줄일 뿐) → [다음 날]
   잰다: 연락 온 아침 0.25초마다 8초 — 배너(#event.on) 글 · 대사(#stage.talking) · 배너가 대사 «뒤»인가(배너 한가운데 점에 무엇이 잡히나)
         · 대사가 끝난 뒤 배너가 남았나 · [상점] 점(data-dot)
   사진(OUT): 아침 0.5초 · 2초 · 대사 끝 · 대사 끝 3초
   ㉮ 대사가 닫힌 뒤 배너가 2초 넘게 선다(11-01 #9 고침 — 대사 동안 배너는 대사 뒤로) · ㉯ 배너가 떠 있는 동안 [다음 날] 진짜 누름이 먹힌다(총괄 ①) · 예외 0 */
import fs from 'node:fs';
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9451', OUT = process.env.OUT || null;
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
const dlgOnly = async () => { for (let i = 0; i < 80; i++) { const t = await J(`document.getElementById('stage').classList.contains('talking')`); if (t !== true) return; await page.eval(`(()=>{ const b=document.getElementById('dlgBox'); if(b) b.click(); return 1; })()`, false); await sleep(300); } };
await dlgOnly();
await page.eval(`(()=>{ window.__byeotSheet.open('shop'); return 1; })()`, false); await sleep(1200);
await page.eval(`(()=>{ const b=document.getElementById('sellPlant'); if (b) b.click(); return 1; })()`, false); await sleep(900);
await page.eval(`(()=>{ const g=document.getElementById('varieAskGo'); if (g && document.getElementById('varieAsk').classList.contains('on')) g.click(); return 1; })()`, false); await sleep(1200); await dlgOnly();
const listed = await J(`(()=>{ const S=window.__S(); const ls=(S.shop.listings||[]); for (const l of ls) l.contactOnDay = S.day + 1; return ls.map(l=>({ id:l.listingId, kind:l.kind, st:l.status, on:l.contactOnDay })); })()`);
console.log('  내놓음', JSON.stringify(listed));
await page.eval(`(()=>{ try { window.__byeotSheet.close(); } catch (e) { void e; } const b=document.getElementById('next'); b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})); b.click(); return 1; })()`, false);
const samples = []; const t0 = Date.now(); let shot = 0;
for (let i = 0; i < 48; i++) {
  await sleep(250);
  const s = await J(`(()=>{ const ev=document.getElementById('event'); const on=!!(ev && ev.classList.contains('on')); let top=null;
    if (on) { const r=ev.getBoundingClientRect(); const e=document.elementFromPoint(r.left+r.width/2, r.top+Math.min(20,r.height/2)); top = e ? (e.closest('#event') ? 'event' : (e.id || e.className || e.tagName)) : null; }
    const meal=document.getElementById('mealPanel'); const pops=[...document.querySelectorAll('.pop.on')].map(x=>x.id);
    return { t: 0, day: window.__S().day, ev: on ? (ev.innerText||'').replace(/\\s+/g,' ').slice(0,90) : '', top, talking: document.getElementById('stage').classList.contains('talking'),
             dlg: (document.getElementById('dlgText')||{}).textContent || '', pops, dot: !!(document.getElementById('navShop')||{dataset:{}}).dataset.dot }; })()`);
  s.t = Math.round((Date.now() - t0) / 100) / 10;
  samples.push(s);
  if (OUT && (i === 2 || i === 8)) await page.shot(`${OUT}/390_m9_morning_${shot++}.png`);
  if (s.pops && s.pops.includes('mealPanel')) await page.eval(`(()=>{ const g=document.getElementById('mealGo'); if (g && g.offsetParent) g.click(); return 1; })()`, false);
}
for (const s of samples.filter((x, i) => i % 3 === 0)) console.log('  ', JSON.stringify(s));
await dlgOnly();
/* ㉮ 대사가 닫힌 뒤 배너가 사람 눈에 서 있나 — 0.25초마다 3초 · ㉯ 배너가 떠 있는 동안 [다음 날] 진짜 누름이 막히지 않나 */
const post = [];
for (let i = 0; i < 12; i++) { await sleep(250); post.push(await J(`(()=>{ const ev=document.getElementById('event'); return ev && ev.classList.contains('on') ? (ev.innerText||'').replace(/\\s+/g,' ').slice(0,90) : ''; })()`)); }
if (OUT) await page.shot(`${OUT}/390_m9_post.png`);
const postN = post.filter(t => /연락이 왔습니다/.test(t || '')).length;
console.log('  대사 뒤 3초', JSON.stringify({ postN, first: post[0], last: post[post.length - 1] }));
ok(postN >= 8, '㉮ 대사가 닫힌 뒤 «📩 연락이 왔습니다» 배너가 2초 넘게 서 있다(0.25초 표본 12 중 8 이상)', JSON.stringify({ postN, post: post.slice(0, 3) }));
const nb = await J(`(()=>{ const b=document.getElementById('next'); const r=b.getBoundingClientRect(); return { x:r.left+r.width/2, y:r.top+r.height/2, ev: document.getElementById('event').classList.contains('on'), day: window.__S().day }; })()`);
const m = (type, x, y, buttons) => page.send('Input.dispatchMouseEvent', { type, x: Math.round(x), y: Math.round(y), button: 'left', buttons, clickCount: 1 });
await m('mouseMoved', nb.x, nb.y, 0); await m('mousePressed', nb.x, nb.y, 1); await sleep(60); await m('mouseReleased', nb.x, nb.y, 0);
await sleep(1500);
const nx = await J(`(()=>({ day: window.__S().day, meal: !!(document.getElementById('mealGo')||{}).offsetParent, pops: [...document.querySelectorAll('.pop.on')].map(x=>x.id), dim: document.getElementById('hintDim') ? document.getElementById('hintDim').classList.contains('on') : null }))()`);
console.log('  [다음 날] 누름', JSON.stringify({ nb, nx }));
ok(!nx.탈 && (nx.day !== nb.day || nx.meal || (nx.pops || []).length > 0), '㉯ 배너가 떠 있는 동안에도 [다음 날] 진짜 누름이 먹힌다(밥상 창 또는 하루 넘김)', JSON.stringify({ nb, nx }));
const after = await J(`(()=>{ const ev=document.getElementById('event'); return { ev: ev && ev.classList.contains('on') ? (ev.innerText||'').replace(/\\s+/g,' ').slice(0,90) : '', dot: !!(document.getElementById('navShop')||{dataset:{}}).dataset.dot, title: (document.getElementById('navShop')||{}).title || '' }; })()`);
console.log('  대사 끝', JSON.stringify(after));
if (OUT) await page.shot(`${OUT}/390_m9_after.png`);
const seen = samples.filter(s => /연락이 왔습니다/.test(s.ev || ''));
console.log('  배너 «연락이 왔습니다» 뜬 표본', seen.length, '· 그중 대사 중', seen.filter(s => s.talking).length, '· 배너 위가 잡힌 것', JSON.stringify([...new Set(seen.map(s => s.top))]));
ok(exc.length === 0, '처리 안 된 예외 0', exc.slice(0, 3).join(' / '));
console.log(bad ? `probe_minor5_9: 빨강 ${bad}` : 'probe_minor5_9: 다 통과');
await page.close(); process.exit(bad ? 1 : 0);
