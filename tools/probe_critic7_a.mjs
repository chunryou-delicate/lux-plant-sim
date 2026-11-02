/* 비판 7판 7C1 자(core 11-02 · 총괄 가름 · [plan] plan-to-core-critic7 §1 ebe8b78e) — 주문 창 [전부] 덫 → «모자란 만큼»
   ⛔ 비판 7판 A Day 13(d13_seed_all): [전부] = 소지금 전부 «2324개 · 1,162,000원 · 주문하면 333원이 남습니다» 에 손가락이 그대로 [2324개 주문]
   판: 비판 6판 A100 세이브(C:/Users/pc/byeot-core-keep/critic6/ · 프로필은 안 건드림) — 손질: 체력 가득 · 콩 씨앗 재고 n · 콩 씨앗 주문 없음 ·
       콩나물 시루 · 무순 재배판은 다 «막 심은» 꼴(ageDays 0 — 내일 안 익음) 가운데 crop_01_02 · 03 은 거둔 채 · crop_01_04 · 05 는 안 심은 새 시루(needsSow)
       ⇒ 오늘 · 내일 심을 시루 w = 거둔 + 안 심은 수(판에서 셈) · 손가락은 __byeotHint() 로 다시 묻는다
   단언(plan 잴 차례 ㉮~㉲ · 총괄 ㉮ ㉯)
     ㉮ 거둔 2 · 새 2 · 씨앗 0 · 390 — 바닥 🛒 → 창: 넷째 칸 «모자란 만큼» · 개수 줄 «오늘 · 내일 심을 시루 4개 — 씨앗 4개가 모자랍니다» · 기본 개수 4 · 손가락 [주문]
        · 한 셈: 창 w = §seedTomorrowOf want(«씨앗을 사러» 손가락 · 바닥 🛒 미리) = 판에서 센 수(두 번 안 셈)
     ㉯ 같은 판 [＋] 로 5 → 손가락 [모자란 만큼] «모자란 만큼으로 맞춥니다» · 누르면 4 · 손가락 [주문]
     ㉰ 씨앗 10 · 상점 [주문]으로 연 창 — [모자란 만큼] 회색 · «… — 씨앗은 모자라지 않습니다» · 기본 1 · 손가락 [그만두기] «닫아도 됩니다»
     ㉱ 새 시루만 2 · 씨앗 0 — 개수 줄 «오늘 · 내일 심을 시루 2개 — 씨앗 2개가 모자랍니다»(«모자라지 않습니다» 아님 · 안 심은 줄을 셈)
     ㉲ 360 — 넷째 칸 글 두 줄 안 · 낱말 안 꺾임 없음 · 씨앗 아닌 품목(시루)은 넷째 칸 없음 · 예외 0 · J 단언엔 !탈
     ㉳ 총괄 덤(7C1 꼬리) — 씨앗 넉넉한 창은 [그만두기]가 주 단추(주황) · [주문]은 보통 단추 — 모자랄 때(㉮)와 단추 판이 뒤바뀜(6판 #24 · C10 경고 창과 같은 꼴) */
import fs from 'node:fs';
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9451', OUT = process.env.OUT || null;
const SAVE_A = process.env.SAVE_A || 'C:/Users/pc/byeot-core-keep/critic6/saveA_d100.json';
if (OUT) fs.mkdirSync(OUT, { recursive: true });
let bad = 0; const ok = (c, m, d = '') => { console.log(`${c ? '  OK' : 'FAIL'}  ${m}${d ? '  → ' + d : ''}`); if (!c) bad++; };
if (!fs.existsSync(SAVE_A)) { ok(false, '세이브 없음', SAVE_A); process.exit(1); }
const HARV = ['crop_01_02', 'crop_01_03'], NEW = ['crop_01_04', 'crop_01_05'];
const stage = ({ seed, harv }) => { const w = JSON.parse(fs.readFileSync(SAVE_A, 'utf8')); const s = w.state;
  s.stamina.left = s.stamina.max; s.shop.stock.bean_seed = seed; s.shop.orders = (s.shop.orders || []).filter(o => o.itemId !== 'bean_seed');
  for (const p of s.firstPlay.beansprout.pots) {
    if (!p.slotId) continue;
    if (harv && HARV.includes(p.id)) Object.assign(p, { sown: true, harvested: true });
    else if (NEW.includes(p.id)) Object.assign(p, { sown: false, harvested: false, ageDays: 0, startedOnDay: null });
    else Object.assign(p, { sown: true, harvested: false, ageDays: 0, startedOnDay: s.day, idleSinceDay: s.day });
  }
  /* 무순 재배판도 다 «막 심은» 꼴 — 바닥 단추가 무순 다시 심기 · 물로 안 가게(콩 씨앗 🛒 만 남게) */
  for (const v of Object.values(s.firstPlay.crops || {})) for (const p of ((v && v.pots) || [])) if (p.slotId) Object.assign(p, { sown: true, harvested: false, ageDays: 0, startedOnDay: s.day, idleSinceDay: s.day });
  return JSON.stringify(w); };
const exc = [];
const open = async (w) => {
  const page = await launch({ width: w, height: 844, dpr: 2 });
  page.on((method, p) => { if (method === 'Runtime.exceptionThrown') exc.push(((p.exceptionDetails.exception && p.exceptionDetails.exception.description) || p.exceptionDetails.text || '').split('\n')[0].slice(0, 200)); });
  await page.send('Runtime.enable');
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true;` });
  const J = async (js) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, 120000));
  const boot = async (txt) => {
    await page.goto(`${BASE}/data/balance/homes.json`);
    await page.eval(`(()=>{ localStorage.clear(); localStorage.setItem('byeot/save/1', ${JSON.stringify(txt)}); localStorage.setItem('byeot.guideSeen','1'); return 1; })()`, false);
    await page.goto(`${BASE}/game.html`); await page.waitFor('window.__byeotBooted === true', 300000, 500); await page.waitFor('!!window.__rv', 240000, 500); await sleep(3500);
    for (let i = 0; i < 80; i++) { const t = await J(`document.getElementById('stage').classList.contains('talking')`); if (t !== true) break; await page.eval(`(()=>{ const b=document.getElementById('dlgBox'); if(b) b.click(); return 1; })()`, false); await sleep(250); }
    await J(`(()=>{ try { window.__byeotSheet.close(); } catch (e) { void e; } return 1; })()`); await sleep(1000);
  };
  return { page, J, boot };
};
/* 창 잼 — 넷째 칸 · 개수 줄 · 개수 · 손가락 · 판에서 센 w · §seedTomorrowOf */
const PANEL = `(async()=>{ try { window.__byeotHint(); } catch (e) { void e; } await new Promise(r=>setTimeout(r,900));
  const p=document.getElementById('buyPanel'), all=document.getElementById('buyAll'), need=document.getElementById('buyNeed'), h=document.getElementById('hint'), t=document.querySelector('.hintTarget');
  const S=window.__S(); const pots=S.firstPlay.beansprout.pots.filter(x=>x.slotId); const counted=pots.filter(x=>(!x.sown && !x.harvested) || x.harvested).length;
  const st=window.__byeotSeedTomorrow ? window.__byeotSeedTomorrow('beansprout') : null;
  let rows=null, breaks=[]; if (all && all.offsetParent) { const tn=all.firstChild; if (tn && tn.nodeType===3) { const rg=document.createRange(); let prev=null; rows=0; for (let i=0;i<tn.textContent.length;i++) { rg.setStart(tn,i); rg.setEnd(tn,i+1); const q=rg.getBoundingClientRect(); if (!q.width) continue; const m=q.top+q.height/2; if (prev==null) rows=1; else if (m-prev>6) { rows++; breaks.push([tn.textContent[i-1]||'', tn.textContent[i]]); } prev=m; } } }
  return { on: !!(p && p.classList.contains('on')), title: (document.getElementById('buyTitle')||{}).textContent,
    all: all ? { shown: all.style.display !== 'none' && !!all.offsetParent, text: (all.textContent||'').trim(), dis: all.disabled, rows, breaks } : null,
    need: need && need.style.display !== 'none' ? (need.textContent||'') : null, count: (document.getElementById('buyCount')||{}).textContent,
    hint: { on: h.classList.contains('on'), tid: t ? t.id || null : null, say: (h.querySelector('.say')||{}).textContent },
    bg: { go: getComputedStyle(document.getElementById('buyGo')).backgroundImage, cancel: getComputedStyle(document.getElementById('buyCancel')).backgroundImage },
    counted, seedTomorrow: st }; })()`;

let needBg = null;   /* ㉮ 판(모자람)의 단추 판 — ㉳ 에서 견줌 */
/* ═══ ㉮ ㉯ ㉲ — 거둔 2 · 새 2 · 씨앗 0 ═══ */
for (const w of [390, 360]) {
  const { page, J, boot } = await open(w);
  await boot(stage({ seed: 0, harv: true }));
  const btn = await J(`(()=>{ const b=document.getElementById('resow'); if (!b || b.style.display==='none') return { 없음: true }; const t=(b.textContent||'').trim(), buy=b.dataset.buy||null; b.click(); return { t, buy }; })()`);
  await sleep(1500);
  const a = await J(PANEL);
  console.log(`  ㉮ ${w} 바닥 🛒 → 창`, JSON.stringify({ btn, ...a }));
  if (OUT) await page.shot(`${OUT}/${w}_c7a_need.png`);
  if (w === 390) {
    ok(!a.탈 && btn.buy === 'bean_seed' && a.on && a.all && a.all.shown && a.all.text === '모자란 만큼', '㉮ 바닥 🛒 로 연 콩 씨앗 창 — 넷째 칸 «모자란 만큼»(소지금 [전부] 아님)', JSON.stringify({ btn, all: a.all }));
    ok(!a.탈 && a.need === '오늘 · 내일 심을 시루 4개 — 씨앗 4개가 모자랍니다' && a.count === '4개', '㉮ 개수 줄 «오늘 · 내일 심을 시루 4개 — 씨앗 4개가 모자랍니다» · 기본 개수 4', JSON.stringify({ need: a.need, count: a.count }));
    ok(!a.탈 && a.hint.on && a.hint.tid === 'buyGo' && a.hint.say === '개수를 정하고 [주문] — 내일 옵니다', '㉮ 개수 = 모자란 수 → 손가락 [주문]', JSON.stringify(a.hint));
    needBg = a.bg;
    ok(!a.탈 && a.counted === 4 && a.seedTomorrow && a.seedTomorrow.want === 4 && a.seedTomorrow.have === 0, '㉮ 한 셈 — 창 w = §seedTomorrowOf want = 판에서 센 거둔 + 안 심은 수(두 번 안 셈)', JSON.stringify({ counted: a.counted, seedTomorrow: a.seedTomorrow }));
    /* ㉯ [＋] 로 5 */
    await J(`(()=>{ document.getElementById('buyPlus').click(); return 1; })()`); await sleep(500);
    const b = await J(PANEL);
    console.log('  ㉯ [＋] 뒤', JSON.stringify(b));
    if (OUT) await page.shot(`${OUT}/${w}_c7a_over.png`);
    ok(!b.탈 && b.count === '5개' && b.hint.tid === 'buyAll' && b.hint.say === '모자란 만큼으로 맞춥니다', '㉯ 개수 > 모자란 수 → 손가락 [모자란 만큼] «모자란 만큼으로 맞춥니다»', JSON.stringify({ count: b.count, hint: b.hint }));
    await J(`(()=>{ document.getElementById('buyAll').click(); return 1; })()`); await sleep(500);
    const c = await J(PANEL);
    ok(!c.탈 && c.count === '4개' && c.hint.tid === 'buyGo', '㉯ [모자란 만큼]을 누르면 4개 · 손가락 [주문]', JSON.stringify({ count: c.count, hint: c.hint }));
  } else {
    ok(!a.탈 && a.all && a.all.shown && a.all.rows >= 1 && a.all.rows <= 2 && a.all.breaks.every(([x, y]) => /\s/.test(x) || /\s/.test(y)), '㉲ 360 넷째 칸 «모자란 만큼» 두 줄 안 · 낱말 안 꺾임 없음', JSON.stringify(a.all));
  }
  try { await page.close(); } catch (e) { console.log('  (탭 닫기 탈)', e.message); }
}
/* ═══ ㉰ 씨앗 넉넉 · 상점 [주문] · 씨앗 아닌 품목 ═══ */
{
  const { page, J, boot } = await open(390);
  await boot(stage({ seed: 10, harv: true }));
  await J(`(()=>{ window.__byeotSheet.open('shop'); return 1; })()`); await sleep(1500);
  await J(`(()=>{ const b=document.querySelector('#shopList [data-buy="bean_seed"]'); if (b) b.click(); return !!b; })()`); await sleep(1200);
  const d = await J(PANEL);
  console.log('  ㉰ 씨앗 넉넉', JSON.stringify(d));
  if (OUT) await page.shot(`${OUT}/390_c7a_enough.png`);
  ok(!d.탈 && d.on && d.all && d.all.shown && d.all.dis === true && d.need === '오늘 · 내일 심을 시루 4개 — 씨앗은 모자라지 않습니다' && d.count === '1개', '㉰ 씨앗 넉넉 — [모자란 만큼] 회색 · «… — 씨앗은 모자라지 않습니다» · 기본 1', JSON.stringify({ all: d.all, need: d.need, count: d.count }));
  ok(!d.탈 && d.hint.on && d.hint.tid === 'buyCancel' && d.hint.say === '닫아도 됩니다', '㉰ 손가락 [그만두기] «닫아도 됩니다»', JSON.stringify(d.hint));
  ok(!d.탈 && !!needBg && !!d.bg && d.bg.cancel === needBg.go && d.bg.go === needBg.cancel && needBg.go !== needBg.cancel, '㉳ 씨앗 넉넉한 창은 [그만두기]가 주 단추 · [주문]은 보통 단추(모자랄 때와 뒤바뀜)', JSON.stringify({ need: needBg, enough: d.bg }));
  await J(`(()=>{ document.getElementById('buyCancel').click(); return 1; })()`); await sleep(800);
  await J(`(()=>{ const b=document.querySelector('#shopList [data-buy="siru"]'); if (b) b.click(); return !!b; })()`); await sleep(1200);
  const e = await J(PANEL);
  console.log('  ㉲ 시루(씨앗 아님)', JSON.stringify({ title: e.title, all: e.all, need: e.need }));
  ok(!e.탈 && e.on && /시루/.test(e.title || '') && e.all && e.all.shown === false && e.need === null, '㉲ 씨앗 아닌 품목(시루)은 넷째 칸 없음 · 개수 줄 없음', JSON.stringify({ title: e.title, all: e.all, need: e.need }));
  try { await page.close(); } catch (e2) { console.log('  (탭 닫기 탈)', e2.message); }
}
/* ═══ ㉱ 새 시루만 · 씨앗 0 ═══ */
{
  const { page, J, boot } = await open(390);
  await boot(stage({ seed: 0, harv: false }));
  const btn = await J(`(()=>{ const b=document.getElementById('resow'); if (!b || b.style.display==='none') return { 없음: true }; const t=(b.textContent||'').trim(), buy=b.dataset.buy||null; b.click(); return { t, buy }; })()`);
  await sleep(1500);
  const f = await J(PANEL);
  console.log('  ㉱ 새 시루만', JSON.stringify({ btn, ...f }));
  if (OUT) await page.shot(`${OUT}/390_c7a_newonly.png`);
  ok(!f.탈 && f.on && f.need === '오늘 · 내일 심을 시루 2개 — 씨앗 2개가 모자랍니다' && f.count === '2개', '㉱ 새 시루만 · 씨앗 0 — «오늘 · 내일 심을 시루 2개 — 씨앗 2개가 모자랍니다»(안 심은 줄을 셈)', JSON.stringify({ btn, need: f.need, count: f.count }));
  try { await page.close(); } catch (e) { console.log('  (탭 닫기 탈)', e.message); }
}
ok(exc.length === 0, '처리 안 된 예외 0', exc.slice(0, 3).join(' / '));
console.log(bad ? `probe_critic7_a: 빨강 ${bad}` : 'probe_critic7_a: 다 통과');
process.exit(bad ? 1 : 0);
