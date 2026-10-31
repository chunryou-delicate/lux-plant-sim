/* D99 다 자(core 11-01) — 390×844 · 비판 넷째 판 ⑧
   판: 총괄 humanQ g premove(Day 134) → 이사(지갑 손질 · 창 [이사한다]) → 원룸
   ㉮ 원룸 손가락 꼬리표(«가방을 열어 보세요 — 반지하에서 가져온 것이 다 있습니다» 꼴)가 화면 안(b104)
   ㉯ 가방 가구 칸을 누르면 배너가 사람 말 가구 이름(«3단 선반을 놓았습니다» 꼴 · 프리셋 이름 «선반-다단-3단» 아님 · b111)
   예외 0 */
import fs from 'node:fs';
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9425', OUT = process.env.OUT || null;
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
await J(`(()=>{ const ts=window.__S().tutorial; ts.cashWon = ts.rules.moveOutCostWon + 302780; window.__redraw(); return 1; })()`);
for (let i = 0; i < 6; i++) {
  const mv = await J(`(()=>({ moved: !!window.__S().tutorial.movedOut, panel: document.getElementById('movePanel').classList.contains('on') }))()`);
  if (mv.moved) break;
  if (mv.panel) await page.eval(`(()=>{ document.getElementById('moveGo').click(); return 1; })()`, false);
  else await page.eval(`(()=>{ window.__byeotSheet.tab('room'); document.getElementById('moveOut').click(); return 1; })()`, false);
  await sleep(1200); await dlgOnly();
}
await sleep(6000); await page.waitFor('!!window.__rv', 240000, 500); await sleep(3000); await dlgOnly();
await page.eval(`(()=>{ window.__byeotSheet.close(); return 1; })()`, false); await sleep(2500);
const tag = await J(`(()=>{ const h=document.getElementById('hint'); if (!h || !h.classList.contains('on')) return null; const s=h.querySelector('.say'); const r=s.getBoundingClientRect(); return { t: s.textContent, left: Math.round(r.left), right: Math.round(r.right), vw: innerWidth }; })()`);
console.log('  꼬리표', JSON.stringify(tag));
if (OUT) await page.shot(`${OUT}/390_d99_tag.png`);
ok(!tag || (tag.right <= tag.vw && tag.left >= 0), '㉮ 원룸 손가락 꼬리표가 화면 안', JSON.stringify(tag));
/* ㉯ 가방 가구 칸 하나 누르기 */
/* 첫 가구는 «가구가 빛을 가립니다»(§5-3)가 먼저 서므로 둘째 가구의 배너를 본다 · 3단 선반을 찾아 누른다 */
await J(`(()=>{ window.__byeotSheet.open('bag'); const b=document.querySelector('#bagGrid [data-furnbag]'); if (b) b.click(); return 1; })()`);
await sleep(3000); await page.eval(`(()=>{ const e=document.getElementById('event'); if (e) e.click(); return 1; })()`, false); await sleep(600);
const uid = await J(`(()=>{ window.__byeotSheet.open('bag'); const all=[...document.querySelectorAll('#bagGrid [data-furnbag]')]; const b=all.find(x=>/etagere/.test(x.getAttribute('data-furnbag'))) || all[0]; if (!b) return null; b.click(); return b.getAttribute('data-furnbag'); })()`);
let bn = '';
for (let i = 0; i < 12 && !bn; i++) { await sleep(400); bn = await J(`(()=>{ const e=document.getElementById('event'); return e && e.classList.contains('on') ? (e.innerText||'').replace(/\\s+/g,' ').slice(0,140) : ''; })()`); }
console.log('  가구', uid, bn);
ok(!!bn && /놓았습니다/.test(bn) && !/[가-힣]+-[가-힣0-9]+/.test(bn.split('놓았습니다')[0]), '㉯ 가구 배너가 사람 말 이름(프리셋 이름 아님)', bn);
ok(exc.length === 0, '처리 안 된 예외 0', exc.slice(0, 3).join(' / '));
console.log(bad ? `probe_d99e: 빨강 ${bad}` : 'probe_d99e: 다 통과');
await page.close(); process.exit(bad ? 1 : 0);
