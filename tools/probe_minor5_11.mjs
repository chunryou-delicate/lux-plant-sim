/* 비판 다섯째 판 #11 자(core 11-01) — «방이 말풍선으로 뒤덮임»(총괄: 두 사진 다 체력 0 — d30_002 0/12 · d100_pot1 0/17) — 390×844
   판: 하네스 humanQ 씨앗 g Day 30~40 세이브를 싣고 [다음 날] 한 번(하네스 «d<N>»은 그날 손 뒤라 다 «자라는 중») — 그 새 아침 가운데 작물 말풍선(💧 · 🌱 · 🥣)이 셋 넘게 서는 첫 날(자가 하네스를 돌려 뜬다) →
       체력 0(손질 · 비판 판과 같은 판 — S.stamina.left = 0)
   ㉮ 체력 0 이면 오늘 할 수 없는 작물 말풍선(💧 물 주기 · 🌱 씨앗 심기 · 🥣 거두기)이 안 선다(그 시루엔 작은 상태 표지) — 체력이 있을 땐 선다(판)
   ㉯ 체력 0 판에서 말풍선끼리 · 말풍선과 이름표가 안 겹친다
   ㉰ 손가락이 짚는 것이 있으면 그 점에서 정말 잡힌다(가린 것을 안 짚음)
   예외 0 · J 단언엔 !탈 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9451', OUT = process.env.OUT || null;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const DUMP = process.env.M11_DUMP_DIR || path.join(os.tmpdir(), 'byeot-minor5-11');
const DAYS = Array.from({ length: 11 }, (_, i) => 30 + i);
if (OUT) fs.mkdirSync(OUT, { recursive: true });
execFileSync(process.execPath, [path.join(HERE, 'probe_branches.mjs'), '--one', JSON.stringify({ name: 'humanQ', seed: 'g', days: 41, dump: DUMP, dumpDays: DAYS })], { maxBuffer: 256 << 20, stdio: ['ignore', 'pipe', 'pipe'] });
let bad = 0; const ok = (c, m, d = '') => { console.log(`${c ? '  OK' : 'FAIL'}  ${m}${d ? '  → ' + d : ''}`); if (!c) bad++; };
const exc = [];
let page = null;
const J = async (js) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, 120000));
const boot = async (file) => {
  if (page) await page.close();
  page = await launch({ width: 390, height: 844, dpr: 2 });
  page.on((method, p) => { if (method === 'Runtime.exceptionThrown') exc.push(((p.exceptionDetails.exception && p.exceptionDetails.exception.description) || p.exceptionDetails.text || '').split('\n')[0].slice(0, 200)); });
  await page.send('Runtime.enable');
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true;` });
  await page.goto(`${BASE}/data/balance/homes.json`);
  await page.eval(`(()=>{ localStorage.clear(); localStorage.setItem('byeot/save/1', ${JSON.stringify(fs.readFileSync(file, 'utf8'))}); localStorage.setItem('byeot.guideSeen','1'); return 1; })()`, false);
  await page.goto(`${BASE}/game.html`); await page.waitFor('window.__byeotBooted === true', 300000, 500); await page.waitFor('!!window.__rv', 240000, 500); await sleep(3500);
  for (let i = 0; i < 80; i++) { const t = await J(`document.getElementById('stage').classList.contains('talking')`); if (t !== true) break; await page.eval(`(()=>{ const b=document.getElementById('dlgBox'); if(b) b.click(); return 1; })()`, false); await sleep(250); }
  await page.eval(`(()=>{ try { window.__byeotSheet.close(); } catch (e) { void e; } return 1; })()`, false); await sleep(1500);
  /* ★ 하네스 «d<N>» 세이브는 그날 손(물 · 거두기 · 심기)이 끝난 판이라 다 «자라는 중» — [다음 날] 한 번으로 새 아침(익음 · 물 · 빈 것)을 연다 */
  const d0 = await J(`window.__S().day`);
  await page.eval(`(()=>{ const b=document.getElementById('next'); if (b) b.click(); return 1; })()`, false);
  for (let i = 0; i < 40; i++) { await sleep(400);
    const st = await J(`(()=>({ day: window.__S().day, meal: !!(document.getElementById('mealGo')||{}).offsetParent, mon: document.getElementById('monthPanel').classList.contains('on'), t: document.getElementById('stage').classList.contains('talking'), ev: !!document.querySelector('#evPanel.on') }))()`);
    if (st.meal) { await page.eval(`(()=>{ document.getElementById('mealGo').click(); return 1; })()`, false); continue; }
    if (st.mon) { await page.eval(`(()=>{ document.getElementById('monthGo').click(); return 1; })()`, false); continue; }
    if (st.ev) { await page.eval(`(()=>{ const a=document.getElementById('evA'); if (a) a.click(); return 1; })()`, false); continue; }
    if (st.t) { await page.eval(`(()=>{ const b=document.getElementById('dlgBox'); if(b) b.click(); return 1; })()`, false); continue; }
    if (st.day !== d0 && i > 6) break; }
  await page.eval(`(()=>{ try { window.__byeotSheet.close(); } catch (e) { void e; } return 1; })()`, false); await sleep(2500);
};
const ACT = '💧 물 주기|🌱 씨앗 심기|🥣 거두기';
const measure = () => J(`(()=>{ const vis=e=>{ const r=e.getBoundingClientRect(); const cs=getComputedStyle(e); return r.width>0 && r.height>0 && cs.display!=='none' && cs.visibility!=='hidden' && +cs.opacity>0.05 ? r : null; };
  const items=[]; for (const e of document.querySelectorAll('#marks .mark, #siruBadges .sbadge')) { const r=vis(e); if (r) items.push({ k: e.classList.contains('mark') ? 'mark' : e.classList.contains('sgroup') ? 'group' : 'badge', t:(e.getAttribute('aria-label')||e.textContent||'').trim().slice(0,24), tired: e.classList.contains('tired'), r:[Math.round(r.left),Math.round(r.top),Math.round(r.right),Math.round(r.bottom)] }); }
  const hit=(a,b)=>a.r[0]<b.r[2]-2 && a.r[2]>b.r[0]+2 && a.r[1]<b.r[3]-2 && a.r[3]>b.r[1]+2; const pairs=[];
  for (let i=0;i<items.length;i++) for (let j=i+1;j<items.length;j++) if ((items[i].k==='mark' || items[j].k==='mark') && hit(items[i],items[j])) pairs.push(items[i].t+' ✕ '+items[j].t);
  const t=document.querySelector('.hintTarget'); let hint=null; if (t) { const q=t.getBoundingClientRect(); const e=document.elementFromPoint(q.left+q.width/2, q.top+q.height/2); hint={ t:(t.getAttribute('aria-label')||t.textContent||t.id||'').trim().slice(0,24), seen: !!(e && (e===t || t.contains(e))) }; }
  const S=window.__S(); return { day:S.day, left: S.stamina && S.stamina.left, act: items.filter(x=>x.k==='mark' && new RegExp(${JSON.stringify(ACT)}).test(x.t)).length, marks: items.filter(x=>x.k==='mark').map(x=>x.t + (x.tired ? '(흐림)' : '')), badges: items.filter(x=>x.k!=='mark').map(x=>x.t), pairs, hint }; })()`);
let found = null, before = null;
for (const d of DAYS) {
  const f = path.join(DUMP, `humanQ_g_d${d}.json`);
  if (!fs.existsSync(f)) continue;
  await boot(f);
  const m = await measure();
  if (process.env.M11_DBG) console.log('    날', d, JSON.stringify({ act: m.act, marks: m.marks, badges: (m.badges||[]).slice(0,6), left: m.left }));
  if (!m.탈 && m.act >= 3) { found = d; before = m; break; }
}
console.log('  판 날', found, JSON.stringify(before && { act: before.act, marks: before.marks }));
ok(found != null, '판 — Day 30~40 에 작물 말풍선이 셋 넘게 서는 날이 있다(체력 있음)', JSON.stringify({ found }));
if (found != null) {
  if (OUT) await page.shot(`${OUT}/390_m11_d${found}_before.png`);
  await J(`(()=>{ const S=window.__S(); S.stamina.left = 0; window.__redraw(); return 1; })()`);
  await sleep(2500);
  const m0 = await measure();
  console.log('  체력 0', JSON.stringify(m0));
  if (OUT) await page.shot(`${OUT}/390_m11_d${found}_tired.png`);
  ok(!m0.탈 && m0.left === 0 && m0.act === 0, '㉮ 체력 0 이면 오늘 할 수 없는 작물 말풍선(💧 · 🌱 · 🥣)이 안 선다', JSON.stringify({ act: m0.act, marks: m0.marks }));
  ok(!m0.탈 && (m0.pairs || []).length === 0, '㉯ 체력 0 판에서 말풍선끼리 · 말풍선과 이름표가 안 겹친다', JSON.stringify((m0.pairs || []).slice(0, 6)));
  ok(!m0.탈 && (!m0.hint || m0.hint.seen), '㉰ 손가락이 짚는 것은 그 점에서 정말 잡힌다', JSON.stringify(m0.hint));
}
ok(exc.length === 0, '처리 안 된 예외 0', exc.slice(0, 3).join(' / '));
console.log(bad ? `probe_minor5_11: 빨강 ${bad}` : 'probe_minor5_11: 다 통과');
if (page) await page.close(); process.exit(bad ? 1 : 0);
