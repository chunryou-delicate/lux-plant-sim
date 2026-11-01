/* 비판 다섯째 판 #10 가름 자(core 11-01) — «상점 손가락 말풍선이 다른 줄 [주문]을 덮음»(Day 5 · 11 · 15 · 30) — 390×844
   판: 하네스 humanQ 씨앗 g 의 Day 4 · 5 · 10 · 11 · 14 · 15 · 29 · 30 아침 세이브(자가 하네스를 돌려 뜬다)
   손: 세이브마다 [상점]을 열고 손가락을 다시 묻는다(window.__byeotHint) — 손가락이 상점 줄의 단추를 짚으면 그 말풍선이 «다른 단추»를 덮나 잰다
   잰다: 짚는 것 · 말풍선 네모 · 겹친 다른 단추(글 · 겹친 넓이) — 사진(OUT)
   단언(11-01 고침 · Day 29 무순 새싹 재배판): ㉮ [상점]을 열면 손가락이 사야 할 줄 [주문]을 짚는다(줄이 화면 밖이면 굴려서 — 예전엔 손가락이 꺼졌다)
         ㉯ 그 말풍선이 다른 단추(다음 줄 [주문] 등)를 안 덮는다(예전엔 아래 줄 [주문]을 100% 덮음) · 예외 0 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9451', OUT = process.env.OUT || null;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const DUMP = process.env.M10_DUMP_DIR || path.join(os.tmpdir(), 'byeot-minor5-10');
const DAYS = (process.env.M10_DAYS || '29').split(',').map(Number);   /* 가름 때는 '4,5,10,11,14,15,29,30' — 손가락이 상점 안을 짚은 날은 29 */
if (OUT) fs.mkdirSync(OUT, { recursive: true });
execFileSync(process.execPath, [path.join(HERE, 'probe_branches.mjs'), '--one', JSON.stringify({ name: 'humanQ', seed: 'g', days: Math.max(...DAYS) + 1, dump: DUMP, dumpDays: DAYS })],
  { maxBuffer: 256 << 20, stdio: ['ignore', 'pipe', 'pipe'] });
let bad = 0; const ok = (c, m, d = '') => { console.log(`${c ? '  OK' : 'FAIL'}  ${m}${d ? '  → ' + d : ''}`); if (!c) bad++; };
const exc = [];
const page = await launch({ width: 390, height: 844, dpr: 2 });
page.on((method, p) => { if (method === 'Runtime.exceptionThrown') exc.push(((p.exceptionDetails.exception && p.exceptionDetails.exception.description) || p.exceptionDetails.text || '').split('\n')[0].slice(0, 200)); });
await page.send('Runtime.enable');
await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true;` });
const J = async (js) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, 120000));
const dlgOnly = async () => { for (let i = 0; i < 80; i++) { const t = await J(`document.getElementById('stage').classList.contains('talking')`); if (t !== true) return; await page.eval(`(()=>{ const b=document.getElementById('dlgBox'); if(b) b.click(); return 1; })()`, false); await sleep(250); } };
const measure = () => J(`(()=>{ const h=document.getElementById('hint'); const t=document.querySelector('.hintTarget'); if (!h || !h.classList.contains('on') || !t) return { on: false, t: t ? (t.id || t.className) : null };
  const hr=h.getBoundingClientRect(); const sl=document.getElementById('shopList'); const inShop=!!(sl && sl.contains(t));
  const area=(a,b)=>Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
  const others=[...document.querySelectorAll('#sheet button')].filter(b=>b!==t && b.offsetParent).map(b=>({ b, r:b.getBoundingClientRect() })).filter(x=>x.r.width && area(hr,x.r)>0)
    .map(x=>({ t:(x.b.textContent||'').trim().slice(0,24), a:Math.round(area(hr,x.r)), of:Math.round(100*area(hr,x.r)/(x.r.width*x.r.height)) }));
  return { on: true, inShop, target: (t.textContent||t.id||'').trim().slice(0,30), say: ((h.querySelector('.say')||{}).textContent||'').slice(0,40), cls: h.className,
           hint: [Math.round(hr.left),Math.round(hr.top),Math.round(hr.right),Math.round(hr.bottom)], tr: (()=>{ const q=t.getBoundingClientRect(); return [Math.round(q.left),Math.round(q.top),Math.round(q.right),Math.round(q.bottom)]; })(), others }; })()`);
for (const d of DAYS) {
  const f = path.join(DUMP, `humanQ_g_d${d}.json`);
  if (!fs.existsSync(f)) { console.log(`Day ${d} 세이브 없음`); continue; }
  await page.goto(`${BASE}/data/balance/homes.json`);
  await page.eval(`(()=>{ localStorage.clear(); localStorage.setItem('byeot/save/1', ${JSON.stringify(fs.readFileSync(f, 'utf8'))}); localStorage.setItem('byeot.guideSeen','1'); return 1; })()`, false);
  await page.goto(`${BASE}/game.html`); await page.waitFor('window.__byeotBooted === true', 300000, 500); await page.waitFor('!!window.__rv', 240000, 500); await sleep(3500);
  await dlgOnly();
  const before = await measure();
  /* 사람처럼 손가락이 짚은 [상점] 탭을 누른다(짚은 것이 없으면 상점을 연다) · 시트가 다 펴질 때까지 기다린 뒤 다시 묻는다 */
  await page.eval(`(()=>{ const t=document.querySelector('.hintTarget'); if (t && /상점/.test(t.textContent||'')) t.click(); else window.__byeotSheet.open('shop'); return 1; })()`, false); await sleep(2500);
  await page.eval(`(()=>{ try { window.__byeotHint(); } catch (e) { void e; } return 1; })()`, false); await sleep(1200);
  let m = await measure();
  if (!m.on) { await sleep(1500); m = await measure(); m.last = await J(`window.__hintLast || null`); }
  console.log(`Day ${d}`, JSON.stringify({ before: before.on ? before.target : null, ...m }));
  if (process.env.M10_DBG && m.on) console.log('  점 검사', JSON.stringify(await J(`(()=>{ const t=document.querySelector('.hintTarget'); const r=t.getBoundingClientRect(); const out=[];
    for (const b of [...document.querySelectorAll('#shopList button')]) { const q=b.getBoundingClientRect(); if (Math.abs(q.top-r.top)>130 || b===t) continue;
      const e=document.elementFromPoint(q.left+q.width/2, q.top+q.height/2); out.push({ t:(b.textContent||'').trim(), y:Math.round(q.top), at: e ? (e.id || e.className || e.tagName) : null, same: e===b || b.contains(e) }); }
    const sh=document.getElementById('sheet').getBoundingClientRect(); const sl=document.getElementById('shopList').getBoundingClientRect(); const pops=[...document.querySelectorAll('.pop.on')].map(x=>x.id); return { err: window.__hintAvoidErr || null, sheet:[Math.round(sh.top),Math.round(sh.bottom)], shopList:[Math.round(sl.left),Math.round(sl.top),Math.round(sl.right),Math.round(sl.bottom)], pops, out }; })()`)));
  if (OUT && m.on && m.inShop) await page.shot(`${OUT}/390_m10_d${d}.png`);
  if (d === 29) {
    ok(!m.탈 && m.on === true && m.inShop === true && /주문/.test(m.target || ''), '㉮ Day 29 [상점]을 열면 손가락이 사야 할 줄 [주문]을 짚는다', JSON.stringify({ on: m.on, inShop: m.inShop, target: m.target, say: m.say }));
    ok(!m.탈 && m.on === true && Array.isArray(m.others) && m.others.length === 0, '㉯ 그 말풍선이 다른 단추를 안 덮는다', JSON.stringify({ cls: m.cls, hint: m.hint, others: m.others }));
  }
}
ok(exc.length === 0, '처리 안 된 예외 0', exc.slice(0, 3).join(' / '));
console.log(bad ? `probe_minor5_10: 빨강 ${bad}` : 'probe_minor5_10: 다 통과');
await page.close(); process.exit(bad ? 1 : 0);
