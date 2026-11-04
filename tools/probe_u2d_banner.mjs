/* U2-d 자(총괄 11-04 · 8aa170ce 끝 걸음 사진 ca8_bag) — 배너가 선 뒤 손가락 · 시트가 움직이면 배너 폭을 다시 맞춘다(좁은 기둥으로 남지 않음 · 시트에 안 덮임)
   판: 투룸 가게 첫날(tworoom_shop_first · 가방에 새 식물 · 이삿짐 — 손가락이 [가방]을 짚는 판) · 가방 시트 닫힘
   손: 배너(게임 재는 손잡이 __byeotBannerTest · 주문 도착 꼴 «📦 주문한 것이 왔습니다 / 콩 씨앗 (1시루분) — [가방]에 들어왔습니다»)를 세움 → 곧바로 가방 시트를 엶 → 1.5초
   단언(390 · 360)
     ㉮ 시트가 열린 뒤 배너 제목이 한 줄(TLINES · <b> 처음 ~ <i> 앞 · top 2px 묶음)
     ㉯ 시트가 열린 뒤 배너와 시트 사각형 겹침 px² = 0(배너 아랫줄이 시트에 안 덮임)
     ㉰ 시트를 연 뒤 둘레가 멎은 채 3초 동안 배너 다시 맞춤(#event._fitKey 바뀜)이 1번 이하 · 배너 사각형이 안 바뀜(배너 ↔ 말풍선 · 손이 번갈아 피하는 되풀이 없음 · 총괄 11-04)
     적기만: 시트 열기 전 배너 폭 · 제목 줄 · 손가락이 짚는 것 · 시트 연 뒤 같은 것
   예외 0 · J 단언엔 !탈 · 빨강 먼저: 6b9b4721(고치기 전) */
import fs from 'node:fs';
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9451', OUT = process.env.OUT || null;
const SAVE_T = process.env.SAVE || 'C:/Users/pc/byeot-core-keep/critic8/tworoom_shop_first.json';
if (OUT) fs.mkdirSync(OUT, { recursive: true });
let bad = 0; const ok = (c, m, d = '') => { console.log(`${c ? '  OK' : 'FAIL'}  ${m}${d ? '  → ' + d : ''}`); if (!c) bad++; };
if (!fs.existsSync(SAVE_T)) { ok(false, '세이브 없음', SAVE_T); process.exit(1); }
const exc = [];
let page = null;
const fresh = async (w) => { if (page) { try { await page.close(); } catch (e) { console.log('  (탭 닫기 탈)', e.message); } }
  page = await launch({ width: w, height: w === 360 ? 780 : 844, dpr: 2 });
  page.on((method, p) => { if (method === 'Runtime.exceptionThrown') exc.push(((p.exceptionDetails.exception && p.exceptionDetails.exception.description) || p.exceptionDetails.text || '').split('\n')[0].slice(0, 200)); });
  await page.send('Runtime.enable');
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true;` }); };
const J = async (js) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, 120000));
const TLINES = `(b => { if (!b) return null; const i = b.querySelector(':scope > i'); const rg = document.createRange(); rg.setStart(b, 0);
  if (i) rg.setEndBefore(i); else rg.setEnd(b, b.childNodes.length);
  const tops = [...rg.getClientRects()].filter(q => q.width > 0 && q.height > 0).map(q => q.top).sort((x, y) => x - y);
  let n = 0, start = null; for (const t of tops) { if (start === null || t - start > 2) { n++; start = t; } } return n; })`;
const M = `(()=>{ const ev=document.getElementById('event'), sh=document.getElementById('sheet'), h=document.getElementById('hint'), t=document.querySelector('.hintTarget');
  const r=q=>[Math.round(q.left),Math.round(q.top),Math.round(q.right),Math.round(q.bottom)]; const e=ev.getBoundingClientRect(), s=sh.getBoundingClientRect();
  const shOpen = sh.classList.contains('open'); const ov = shOpen ? Math.max(0,Math.min(e.right,s.right)-Math.max(e.left,s.left))*Math.max(0,Math.min(e.bottom,s.bottom)-Math.max(e.top,s.top)) : 0;
  const b = ev.querySelector(':scope > b');
  return { on: ev.classList.contains('on'), w: Math.round(e.width), ev: r(e), sheet: shOpen ? r(s) : null, shOpen, overlap: Math.round(ov), tLines: ${TLINES}(b),
           title: b && b.firstChild && b.firstChild.nodeType===3 ? b.firstChild.textContent.trim() : null, hint: h.classList.contains('on') ? ((t && (t.id || t.getAttribute('data-place'))) || '?') + ' «' + ((h.querySelector('.say')||{}).textContent||'').trim() + '»' : null }; })()`;
for (const W of [390, 360]) {
  await fresh(W);
  await page.goto(`${BASE}/data/balance/homes.json`);
  await page.eval(`(()=>{ localStorage.clear(); localStorage.setItem('byeot/save/1', ${JSON.stringify(fs.readFileSync(SAVE_T, 'utf8'))}); localStorage.setItem('byeot.guideSeen','1'); return 1; })()`, false);
  await page.goto(`${BASE}/game.html`); await page.waitFor('window.__byeotBooted === true', 300000, 500); await page.waitFor('!!window.__rv', 240000, 500); await sleep(4000);
  for (let i = 0; i < 160; i++) { const t = await J(`document.getElementById('stage').classList.contains('talking')`); if (t !== true) break; await page.eval(`(()=>{ const b=document.getElementById('dlgBox'); if(b) b.click(); return 1; })()`, false); await sleep(250); }
  for (let i = 0; i < 20; i++) { const on = await J(`document.getElementById('event').classList.contains('on')`); if (on !== true) break; await J(`(()=>{ document.getElementById('event').click(); return 1; })()`); await sleep(400); }
  await sleep(2500);
  await J(`(()=>{ window.__byeotBannerTest([{ title: '📦 주문한 것이 왔습니다', sub: '콩 씨앗 (1시루분) — [가방]에 들어왔습니다' }]); return 1; })()`); await sleep(700);
  const m0 = await J(M);
  if (OUT) await page.shot(`${OUT}/${W}_u2d_before.png`);
  await J(`(()=>{ window.__byeotSheet.open('bag'); return 1; })()`); await sleep(1500);
  const m1 = await J(M);
  if (OUT) await page.shot(`${OUT}/${W}_u2d_bag.png`);
  /* ㉰ 3초 동안 0.1초마다: 다시 맞춤 열쇠(_fitKey) 바뀜 수 · 배너 사각형 */
  const st = await J(`new Promise(res => { const ev=document.getElementById('event'); let k=ev._fitKey, kc=0; const q0=ev.getBoundingClientRect(); const r0=[q0.left,q0.top,q0.right,q0.bottom].map(Math.round).join(','); const rs=new Set([r0]); let n=0;
    const t=setInterval(() => { n++; if (ev._fitKey !== k) { kc++; k=ev._fitKey; } const q=ev.getBoundingClientRect(); rs.add([q.left,q.top,q.right,q.bottom].map(Math.round).join(','));
      if (n >= 30) { clearInterval(t); res({ refits: kc, rects: [...rs], on: ev.classList.contains('on') }); } }, 100); })`);
  console.log(`  ${W} ㉰ 3초`, JSON.stringify(st));
  ok(!st.탈 && st.refits <= 1 && Array.isArray(st.rects) && st.rects.length === 1, `㉰ ${W} 시트를 연 뒤 3초 — 다시 맞춤 ${st.refits}번 · 배너 사각형 ${st.rects ? st.rects.length : '?'}가지(되풀이 없음)`, JSON.stringify(st));
  if (OUT) await page.shot(`${OUT}/${W}_u2d_bag_3s.png`);
  console.log(`  ${W} 시트 열기 전`, JSON.stringify(m0));
  console.log(`  ${W} 시트 연 뒤`, JSON.stringify(m1));
  ok(!m1.탈 && m1.on === true && m1.shOpen === true && m1.tLines === 1, `㉮ ${W} 시트가 열린 뒤 배너 제목이 한 줄(폭 ${m1.w} · 열기 전 ${m0.w} · ${m0.tLines}줄)`, JSON.stringify({ before: { w: m0.w, t: m0.tLines, hint: m0.hint }, after: { w: m1.w, t: m1.tLines, hint: m1.hint } }));
  ok(!m1.탈 && m1.on === true && m1.overlap === 0, `㉯ ${W} 시트가 열린 뒤 배너와 시트 겹침 px² = 0(${m1.overlap})`, JSON.stringify({ ev: m1.ev, sheet: m1.sheet }));
}
ok(exc.length === 0, '처리 안 된 예외 0', exc.slice(0, 3).join(' / '));
try { await page.close(); } catch (e) { console.log('  (탭 닫기 탈)', e.message); }
console.log(bad ? `probe_u2d_banner: 빨강 ${bad}` : 'probe_u2d_banner: 다 통과');
process.exit(bad ? 1 : 0);
