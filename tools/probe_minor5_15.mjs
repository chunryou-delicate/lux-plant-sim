/* 비판 다섯째 판 #15 가름 자(core 11-01) — «단추 · 글 잘림» — 390×844
   판: 총괄 humanQ g premove(반지하 Day 134) · 손 상태 셋(그대로 · 남은 손 2 · 남은 손 0 — 손질)
   잰다: 바닥 단추(#waterCrop · #harvestCrop · #waterPot · #resow · #sellSurplusBtn)마다 글 · 넓이(clientWidth) · 글 넓이(scrollWidth) · 잘림(scrollWidth > clientWidth + 1)
   단언(11-01 #15 고침): ㉮ 손 0 이면 바닥 단추 글이 안 잘리고([plan] «오늘 손이 다 떨어졌습니다 ([다음 날]을 누르면 다시 찹니다)» 두 줄) [다음 날]과도 안 겹친다 · 예외 0 */
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
for (let i = 0; i < 80; i++) { const t = await J(`document.getElementById('stage').classList.contains('talking')`); if (t !== true) break; await page.eval(`(()=>{ const b=document.getElementById('dlgBox'); if(b) b.click(); return 1; })()`, false); await sleep(250); }
const measure = () => J(`(()=>['waterCrop','harvestCrop','waterPot','resow','sellSurplusBtn'].map(id=>{ const b=document.getElementById(id); if (!b || !b.offsetParent || getComputedStyle(b).display==='none') return null;
  const r=b.getBoundingClientRect(), n=document.getElementById('next'), q=n && n.offsetParent ? n.getBoundingClientRect() : null;
  const overNext = !!(q && r.right > q.left && r.left < q.right && r.bottom > q.top && r.top < q.bottom);
  return { id, t: (b.innerText||'').replace(/\\s+/g,' ').trim(), w: b.clientWidth, sw: b.scrollWidth, cut: b.scrollWidth > b.clientWidth + 1, overNext, next: n ? (n.innerText||'').replace(/\\s+/g,' ').trim() : null }; }).filter(Boolean))()`);
for (const [tag, left] of [['그대로', null], ['남은 손 2', 2], ['남은 손 0', 0]]) {
  if (left != null) await J(`(()=>{ const S=window.__S(); S.stamina.left = ${left}; window.__redraw(); return 1; })()`);
  await sleep(900);
  const m = await measure();
  console.log(tag, JSON.stringify(m));
  if (OUT) await page.shot(`${OUT}/390_m15_${left == null ? 'base' : left}.png`);
  if (left === 0) {
    const tired = (m || []).filter(x => /손이 다 떨어졌/.test(x.t || ''));
    ok(!m.탈 && tired.length > 0, '판 — 손 0 바닥 단추가 섰다', JSON.stringify(m));
    ok(!m.탈 && (m || []).every(x => !x.cut), '㉮ 손 0 — 바닥 단추 글이 안 잘린다', JSON.stringify((m || []).filter(x => x.cut)));
    ok(!m.탈 && (m || []).every(x => !x.overNext), '㉮ 손 0 — 바닥 단추가 [다음 날]과 안 겹친다', JSON.stringify((m || []).filter(x => x.overNext).map(x => [x.id, x.next])));
  }
}
ok(exc.length === 0, '처리 안 된 예외 0', exc.slice(0, 3).join(' / '));
console.log(bad ? `probe_minor5_15: 빨강 ${bad}` : 'probe_minor5_15: 다 통과');
await page.close(); process.exit(bad ? 1 : 0);
