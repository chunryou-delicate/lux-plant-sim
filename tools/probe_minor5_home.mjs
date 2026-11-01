/* ③ 내 집 뒤 가계부 자(core 11-01 · 총괄 결정 · [plan] 11-01 글) — 390×844
   판: 하네스 careR 씨앗 g «ready»(500만 닿음 · 엔딩 전 · Day 445 · 월세 날 451) — 자가 하네스를 돌려 뜬다(probe_care_walk 와 같은 판)
   손: 하루 넘김 한 번(그 달 장부가 선다 — 세이브는 장부를 안 싣는다) → 할 일 [내 집 마련] → [계약한다] → 장면 → 진로 카드 [돌봄을 시작한다] → 날 넘김(옛 월세 날 박자)
   ⚠ 날 넘김은 밥상 [이대로 다음 날](mealGo = goNextDay) — 하네스 careR 세이브는 시루가 반지하 자리 이름을 들고 있어 원룸 [다음 날] 시루 문에 걸린다(probe_care_walk 와 같은 길)
   ㉮ 집 산 달 가계부(옛 월세 날 451): «나간 돈 · 내 집 마련 {집값}원» · «장부에 안 잡힌 것»이 집값만큼 안 뜸 · 견줌 «내 집 마련을 빼면 …» · 밑 글 «내 집을 마련한 달입니다 — …»
   ㉯ 그 뒤 달(481): «월세 | 없습니다 (내 집)» · 부제 «가계부는 30일마다 나옵니다» · 제목 수 이어 셈(앞 달 + 1) · «장부에 안 잡힌 것»은 파산 클램프(0원 밑) 몫만
   ㉰ 진로 수입 달 — 판: 하네스 careR 씨앗 g «care10_pre»(돌봄 · Day 510 · 월세 날 511): 30일 달에 돌봄 수고비(order 통)가 들면 «진로 수입» 줄 · «장부에 안 잡힌 것» 없음
   예외 0 · J 단언엔 !탈 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9451', OUT = process.env.OUT || null;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const DUMP = process.env.END_DUMP_DIR || path.join(os.tmpdir(), 'byeot-minor5-end');
if (OUT) fs.mkdirSync(OUT, { recursive: true });
let bad = 0; const ok = (c, m, d = '') => { console.log(`${c ? '  OK' : 'FAIL'}  ${m}${d ? '  → ' + d : ''}`); if (!c) bad++; };
const run = JSON.parse(execFileSync(process.execPath, [path.join(HERE, 'probe_branches.mjs'), '--one', JSON.stringify({ name: 'careR', seed: 'g', targets: [5000000], days: 520, dump: DUMP })],
  { maxBuffer: 256 << 20, stdio: ['ignore', 'pipe', 'pipe'] }).toString());
const SAVE = path.join(DUMP, 'careR_g_ready.json');
const SAVE2 = path.join(DUMP, 'careR_g_care10_pre.json');
if (!(run.dumps && run.dumps.ready) || !fs.existsSync(SAVE) || !fs.existsSync(SAVE2)) { console.log('FAIL  하네스가 ready 세이브를 못 냈다', JSON.stringify(run.dumps || null)); process.exit(1); }
const exc = [];
const page = await launch({ width: 390, height: 844, dpr: 2 });
page.on((method, p) => { if (method === 'Runtime.exceptionThrown') exc.push(((p.exceptionDetails.exception && p.exceptionDetails.exception.description) || p.exceptionDetails.text || '').split('\n')[0].slice(0, 200)); });
await page.send('Runtime.enable');
await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true;` });
const J = async (js) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, 120000));
await page.goto(`${BASE}/data/balance/homes.json`);
await page.eval(`(()=>{ localStorage.clear(); localStorage.setItem('byeot/save/1', ${JSON.stringify(fs.readFileSync(SAVE, 'utf8'))}); localStorage.setItem('byeot.guideSeen','1'); return 1; })()`, false);
await page.goto(`${BASE}/game.html`); await page.waitFor('window.__byeotBooted === true', 300000, 500); await page.waitFor('!!window.__rv', 600000, 500); await sleep(5000);
const dlgOnly = async () => { for (let i = 0; i < 120; i++) { const t = await J(`document.getElementById('stage').classList.contains('talking')`); if (t !== true) return; await page.eval(`(()=>{ const b=document.getElementById('dlgBox'); if(b) b.click(); return 1; })()`, false); await sleep(220); } };
const monthRead = () => J(`(()=>({ title: (document.getElementById('monthTitle')||{}).textContent || '', sub: (document.getElementById('monthSub')||{}).textContent || '', rows: (document.getElementById('monthRows')||{}).innerText || '', sum: (document.getElementById('monthSum')||{}).textContent || '', note: (document.getElementById('monthNote')||{}).textContent || '', day: window.__S().day }))()`);
const nextDay = async () => {
  const d0 = await J(`window.__S().day`);
  await page.eval(`(()=>{ try { window.__byeotSheet.close(); } catch (e) { void e; } const g=document.getElementById('mealGo'); if (g) g.click(); return 1; })()`, false);
  let month = null;
  for (let i = 0; i < 40; i++) {
    await sleep(400);
    const st = await J(`(()=>({ day: window.__S().day, meal: !!(document.getElementById('mealGo')||{}).offsetParent, month: document.getElementById('monthPanel').classList.contains('on'), talking: document.getElementById('stage').classList.contains('talking'), ev: !!document.querySelector('#evPanel.on') }))()`);
    if (st.month && !month) { month = await monthRead(); if (OUT) await page.shot(`${OUT}/390_home_month_d${st.day}.png`); }
    if (st.meal) { await page.eval(`(()=>{ const g=document.getElementById('mealGo'); if (g && g.offsetParent) g.click(); return 1; })()`, false); continue; }
    if (st.month) { await page.eval(`(()=>{ const g=document.getElementById('monthGo'); if (g && g.offsetParent) g.click(); return 1; })()`, false); continue; }
    if (st.ev) { await page.eval(`(()=>{ const a=document.getElementById('evA'); if (a) a.click(); return 1; })()`, false); continue; }
    if (st.talking) { await dlgOnly(); continue; }
    if (st.day !== d0 && i > 6) break;
  }
  await dlgOnly();
  return { day: await J(`window.__S().day`), month };
};
await dlgOnly();
const d1 = await nextDay();
await page.eval(`(()=>{ window.__byeotSheet.open('quest'); return 1; })()`, false); await sleep(900);
const ask = await J(`(()=>{ const b=document.querySelector('[data-act="homeAsk"]'); return { has: !!b, off: b ? b.disabled : null }; })()`);
await page.eval(`(()=>{ const b=document.querySelector('[data-act="homeAsk"]'); if (b) b.click(); return 1; })()`, false); await sleep(900);
await page.eval(`(()=>{ const b=document.getElementById('homeGo'); if (b) b.click(); return 1; })()`, false); await sleep(1500);
await dlgOnly(); await sleep(800);
await page.eval(`(()=>{ const b=document.getElementById('homeNext'); if (b && b.offsetParent) b.click(); return 1; })()`, false); await sleep(1500);
await dlgOnly(); await sleep(600);
const done = await J(`(()=>{ const S=window.__S(); let m=null; try { m=JSON.parse(localStorage.getItem('byeot.month')); } catch (e) { m={탈:e.message}; } return { day:S.day, owned: !!S.tutorial.homeOwned, due: S.tutorial.rent.nextDueDay, home: m && m.cur && m.cur.run ? (m.cur.run.home || 0) : null }; })()`);
console.log('  집 계약 뒤', JSON.stringify({ d1, ask, done }));
ok(ask.has && !ask.off && done.home > 0 && !done.탈, '판 — [내 집 마련] → [계약한다] · 그 달 장부에 집값', JSON.stringify({ ask, done }));
await page.eval(`(()=>{ const b=document.querySelector('#jobCards [data-job="care"]'); if (b) b.click(); return 1; })()`, false); await sleep(1500);
await dlgOnly();
const months = [];
for (let k = 0; k < 40 && months.length < 2; k++) { const dd = await nextDay(); if (dd.month) months.push(dd.month); }
const won = (s) => s ? +String(s).replace(/[^\d]/g, '') : 0;
const m1 = months[0] || null, m2 = months[1] || null;
console.log('  첫 달', JSON.stringify(m1 && { ...m1, rows: m1.rows.replace(/\s+/g, ' ').slice(0, 400) }));
console.log('  둘째 달', JSON.stringify(m2 && { ...m2, rows: m2.rows.replace(/\s+/g, ' ').slice(0, 400) }));
const gapOf = (m) => { const g = m && m.rows.match(/장부에 안 잡힌 것\s*[−-]?([\d,]+)/); return g ? won(g[1]) : 0; };
ok(!!m1 && /내 집 마련\s*[\d,]+/.test(m1.rows) && won((m1.rows.match(/내 집 마련\s*([\d,]+)/) || [])[1]) === done.home, '㉮ 집 산 달 «나간 돈 · 내 집 마련 {집값}원»', JSON.stringify(m1 && { day: m1.day, title: m1.title }));
ok(!!m1 && gapOf(m1) < done.home, '㉮ «장부에 안 잡힌 것»이 집값만큼 안 뜬다', String(gapOf(m1)));
ok(!!m1 && /내 집 마련을 빼면|견주지 않습니다|견줄 것이 없습니다/.test(m1.sum), '㉮ 견줌이 집값을 뺀 순이익(«내 집 마련을 빼면 …») 또는 견줄 것 없음', m1 && m1.sum);
/* ★ 11-01 [plan] — 둘째 달 넘어서 지난달 값이 없을 때 «첫 달이라»는 제목(«16번째 달»)과 부딪혔다 */
ok(!!m1 && !(/(\d+)번째 달/.test(m1.title) && /첫 달이라/.test(m1.sum)), '㉮ «N번째 달»에 «첫 달이라»가 안 붙는다', JSON.stringify({ title: m1 && m1.title, sum: m1 && m1.sum }));
ok(!!m1 && /내 집을 마련한 달입니다 — 이제 월세가 나가지 않습니다\./.test(m1.note), '㉮ 밑 글 «내 집을 마련한 달입니다 — …»', m1 && m1.note);
const n1 = m1 ? +((m1.title.match(/(\d+)번째/) || [])[1] || 0) : 0, n2 = m2 ? +((m2.title.match(/(\d+)번째/) || [])[1] || 0) : 0;
ok(!!m2 && /월세\s*없습니다 \(내 집\)/.test(m2.rows), '㉯ 그 뒤 달 «월세 | 없습니다 (내 집)»', JSON.stringify(m2 && { day: m2.day, rows: m2.rows.replace(/\s+/g, ' ').slice(0, 120) }));
ok(!!m2 && /가계부는 \d+일마다 나옵니다/.test(m2.sub), '㉯ 부제 «가계부는 30일마다 나옵니다»', m2 && m2.sub);
ok(!!m1 && !!m2 && n1 > 0 && n2 === n1 + 1, '㉯ 제목 수 이어 셈(앞 달 + 1)', JSON.stringify({ t1: m1 && m1.title, t2: m2 && m2.title }));
if (process.env.HOME_DBG) console.log('  기록', JSON.stringify(await J(`(()=>{ const S=window.__S(); return { earnedBy: S.shop.earnedBy, log: (S.log||[]).map(x=>typeof x==='string'?x:(x&&(x.text||x.ko||x.msg))||'').filter(t=>/원/.test(t)).slice(-40) }; })()`)));
/* ★ 11-01 [plan] — 굶음 카드가 서면 그날 사는 방(내 집)으로 말한다(예전엔 늘 «반지하에서») */
const go = await J(`(()=>{ const g=document.getElementById('gameOver'); return g && g.classList.contains('on') ? ((document.getElementById('gameOverWhy')||{}).textContent || '') : null; })()`);
console.log('  굶음 카드', JSON.stringify(go));
ok(go === null || (!go.탈 && /내 집에서 \d+일을 굶었습니다/.test(go)), '㉯ 굶음 카드가 서면 «내 집에서 N일을 굶었습니다»', JSON.stringify(go));
const rep2 = await J(`(()=>{ try { const m=JSON.parse(localStorage.getItem('byeot.month')); const L=(m && m.log) || []; return L[L.length - 1] || null; } catch (e) { return { 탈: e.message }; } })()`);
console.log('  둘째 달 장부', JSON.stringify(rep2 && { job: rep2.job, furn: rep2.furn, gap: rep2.gap, rent: rep2.rent, home: rep2.home, count: rep2.count }));
if (process.env.HOME_DBG) { console.log('  둘째 달 장부 전체', JSON.stringify(rep2)); console.log('  둘째 달 줄', JSON.stringify(m2 && m2.rows)); }
/* ⚠ 이 판은 집을 산 뒤 지갑 32,700원에 손을 안 써(거두기 · 팔기 · 돌봄 없음) 0원에 닿는다 — 그 몫(파산 클램프)은 «장부에 안 잡힌 것»이 맞다(밑 글이 말함) */
const clamp2 = rep2 && !rep2.탈 && rep2.cashTo === 0 ? Math.max(0, (rep2.rent + rep2.living + rep2.power + rep2.bought) - (rep2.veg + rep2.plant + (rep2.job || 0) + (rep2.furn || 0) + rep2.income) - rep2.cashFrom) : 0;
ok(!!m2 && !!rep2 && !rep2.탈 && Math.abs((rep2.gap || 0) - clamp2) < 1000, '㉯ 그 뒤 달 «장부에 안 잡힌 것»은 파산 클램프 몫뿐', JSON.stringify({ gap: rep2 && rep2.gap, clamp2, cashTo: rep2 && rep2.cashTo }));
ok(!!m2 && !!rep2 && (!(rep2.job > 0) || /진로 수입\s*[\d,]+/.test(m2.rows)), '㉯ 진로 수입이 있으면 «진로 수입» 줄이 선다', JSON.stringify({ job: rep2 && rep2.job, row: m2 && (m2.rows.match(/진로 수입\s*[\d,]+원?/) || [null])[0] }));
/* ── ㉰ 진로 수입 달 · careR care10_pre ── */
await page.goto(`${BASE}/data/balance/homes.json`);
await page.eval(`(()=>{ localStorage.clear(); localStorage.setItem('byeot/save/1', ${JSON.stringify(fs.readFileSync(SAVE2, 'utf8'))}); localStorage.setItem('byeot.guideSeen','1'); return 1; })()`, false);
await page.goto(`${BASE}/game.html`); await page.waitFor('window.__byeotBooted === true', 300000, 500); await page.waitFor('!!window.__rv', 600000, 500); await sleep(5000);
await dlgOnly();
const months3 = [];
for (let k = 0; k < 40 && months3.length < 2; k++) { const dd = await nextDay(); if (dd.month) months3.push(dd.month); }
const reps = await J(`(()=>{ try { const m=JSON.parse(localStorage.getItem('byeot.month')); return ((m && m.log) || []).slice(-2); } catch (e) { return { 탈: e.message }; } })()`);
const r30 = Array.isArray(reps) ? reps.find(x => x && x.days >= 25) : null;
const m30 = r30 ? months3.find(x => x && x.day === r30.toDay + 0) || months3[months3.length - 1] : null;
console.log('  ㉰ 30일 달', JSON.stringify(r30 && { from: r30.fromDay, to: r30.toDay, days: r30.days, job: r30.job, furn: r30.furn, gap: r30.gap, cashFrom: r30.cashFrom, cashTo: r30.cashTo }), JSON.stringify(m30 && m30.rows.replace(/\s+/g, ' ').slice(0, 300)));
ok(!!r30 && !r30.탈 && (r30.job || 0) > 0, '판 — 30일 달에 돌봄 수고비(진로 수입)가 들었다', JSON.stringify(r30 && { job: r30.job, days: r30.days }));
ok(!!r30 && !!m30 && /진로 수입\s*[\d,]+/.test(m30.rows), '㉰ «들어온 돈 · 진로 수입» 줄', JSON.stringify(m30 && (m30.rows.match(/진로 수입\s*[\d,]+원?/) || [null])[0]));
ok(!!r30 && !r30.탈 && r30.cashTo > 0 && Math.abs(r30.gap || 0) < 1000, '㉰ «장부에 안 잡힌 것» 없음(진로 수입이 장부 안)', JSON.stringify({ gap: r30 && r30.gap }));
ok(exc.length === 0, '처리 안 된 예외 0', exc.slice(0, 3).join(' / '));
console.log(bad ? `probe_minor5_home: 빨강 ${bad}` : 'probe_minor5_home: 다 통과');
await page.close(); process.exit(bad ? 1 : 0);
