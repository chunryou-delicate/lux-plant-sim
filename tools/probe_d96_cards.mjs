/* D96 반지하 사건 카드 «실제 글» 사진(core 10-31 · 총괄 청) — 390×844 · override 없음 · plan a971b232 글
   판: 하네스 humanQ g 세이브(Day 36 · 60 · 74) · 손질(재는 것): S.tutorial.bjEvents 를 «내일 그 카드 하나만 설 수 있게» 맞춘다
       (다른 큰 차례는 본 것으로 · 되풀이 시계는 그 카드만) · 막는 날이면 [다음 날]을 사흘까지 더 누른다
   찍는 것: 카드 아홉 · 택배 체력 0 흐림(손질: 그날 체력 최대 0) · 고른 뒤 대사 · 김치 · 추석 음식 배너 · 트럭 첫 단추 뒤 빛 분포 + «색이 그대로네?» */
import fs from 'node:fs';
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9415', OUT = process.env.OUT || 'C:/Users/pc/AppData/Local/Temp/byeot-core/evcards';
const DUMP = 'C:/Users/pc/AppData/Local/Temp/byeot-core/evh_dump/';
fs.mkdirSync(OUT, { recursive: true });
let bad = 0; const ok = (c, m, d = '') => { console.log(`${c ? '  OK' : 'FAIL'}  ${m}${d ? '  → ' + d : ''}`); if (!c) bad++; };
const exc = [], shots = [];
const BIG = ['cat1', 'parcel', 'truck', 'grandma', 'kids1', 'chuseok'];
async function scene(name, save, key, opt = {}) {
  const page = await launch({ width: 390, height: 844, dpr: 2 });
  page.on((method, p) => { if (method === 'Runtime.exceptionThrown') exc.push(name + ': ' + ((p.exceptionDetails.exception && p.exceptionDetails.exception.description) || p.exceptionDetails.text || '').split('\n')[0].slice(0, 160)); });
  await page.send('Runtime.enable');
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true;` });
  const J = async (js) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, 120000));
  await page.goto(`${BASE}/data/balance/homes.json`);
  await page.eval(`(()=>{ localStorage.clear(); localStorage.setItem('byeot/save/1', ${JSON.stringify(fs.readFileSync(DUMP + save, 'utf8'))}); localStorage.setItem('byeot.guideSeen','1'); return 1; })()`, false);
  await page.goto(`${BASE}/game.html`); await page.waitFor('window.__byeotBooted === true', 300000, 500); await sleep(4000);
  const dlgOnly = async () => { for (let i = 0; i < 80; i++) { const t = await J(`document.getElementById('stage').classList.contains('talking')`);
    if (!t) { await page.eval(`(()=>{ const m=document.getElementById('monthPanel'); if (m && m.classList.contains('on')) { const g=document.getElementById('monthGo'); if (g) g.click(); } return 1; })()`, false); return; } await page.eval(`(()=>{ const s=document.getElementById('dlgSkip'); if(s) s.click(); const b=document.getElementById('dlgBox'); if(b) b.click(); return 1; })()`, false); await sleep(250); } };
  const shot = async (f) => { const p = `${OUT}/${f}.png`; await page.shot(p); shots.push(p); };
  const next = async () => { await page.eval(`(()=>{ const b=document.getElementById('next'); b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})); b.click(); return 1; })()`, false);
    await sleep(1500); await page.eval(`(()=>{ const g=document.getElementById('mealGo'); if (g && g.offsetParent) g.click(); return 1; })()`, false); await sleep(1500); };
  const banner = () => J(`(()=>{ const e=document.getElementById('event'); return e && e.classList.contains('on') ? (e.innerText||'').replace(/\\s+/g,' ').slice(0,140) : ''; })()`);
  await dlgOnly();
  /* 손질 — 내일 이 카드 하나만 */
  const stage = () => J(`(()=>{ const S=window.__S(), ts=S.tutorial; const key=${JSON.stringify(key)};
    const B = ts.bjEvents || (ts.bjEvents = { open:null, next:null, last:null, streak:0, seen:{}, choice:{}, card:null, cat:{due:null}, kids:{due:null}, pending:[] });
    B.open = Number.isInteger(B.open) ? Math.min(B.open, S.day) : S.day; B.next = S.day + 1; B.last = null; B.card = null; B.streak = 0; B.pending = [];
    B.seen = {}; for (const k of ${JSON.stringify(BIG)}) if (k !== key) B.seen[k] = 1;
    B.cat = { due: null }; B.kids = { due: null };
    if (key === 'cat2' || key === 'cat3') { B.seen.cat1 = 1; if (key === 'cat3') B.seen.cat2 = 2; B.cat.due = S.day + 1; B.seen.kids2 = 1; }
    if (key === 'kids2') { B.seen.kids1 = 1; B.kids.due = S.day + 1; B.seen.cat2 = 1; B.seen.cat3 = 1; }
    if (key !== 'cat2' && key !== 'cat3') { B.seen.cat2 = B.seen.cat2 || 1; B.seen.cat3 = B.seen.cat3 || 1; }
    if (key !== 'kids2') B.seen.kids2 = 1;
    ${opt.noStamina ? `S.stamina.max = 0; S.stamina.left = 0;` : ''}
    return { day: S.day, B }; })()`);
  await stage();
  let st = null;
  for (let d = 0; d < 5 && !(st && st.on); d++) {
    await next();
    for (let i = 0; i < 16; i++) { await sleep(500); await dlgOnly();
      st = await J(`(()=>{ const p=document.getElementById('evPanel'); return { day: window.__S().day, on: !!(p && p.classList.contains('on')), text: (document.getElementById('evText')||{}).innerText,
        a: (document.getElementById('evA')||{}).textContent, aDis: !!(document.getElementById('evA')||{}).disabled, b: getComputedStyle(document.getElementById('evB')).display !== 'none' ? document.getElementById('evB').textContent : null,
        note: getComputedStyle(document.getElementById('evNote')).display !== 'none' ? document.getElementById('evNote').textContent : null, ev: window.__byeotEvCard() }; })()`);
      if (st.on) break; }
    console.log('   날', JSON.stringify(await J(`(()=>{ const t=window.__turn(); const S=window.__S(); const B=S.tutorial.bjEvents||{}; return { day: S.day, ev: t ? (t.events||[]).map(e=>e.id).slice(0,12) : null, story: t && t.tutorial ? (t.tutorial.storyEvents||[]).map(e=>e.id) : null, card: B.card, next: B.next, last: B.last, pop: [...document.querySelectorAll('.pop.on')].map(x=>x.id), pend: window.__byeotEvCard().pending }; })()`)));
    if (!(st && st.on)) await stage();   /* 막힌 날 — 다시 맞춘다(B.next 는 그대로 오늘) */
  }
  console.log(`■ ${name}`, JSON.stringify({ day: st && st.day, on: st && st.on, shown: st && st.ev && st.ev.shown, text: st && st.text, a: st && st.a, aDis: st && st.aDis, b: st && st.b, note: st && st.note }));
  ok(!!(st && st.on && st.ev && st.ev.shown === key), `${name} — 카드가 뜬다(${key})`, JSON.stringify({ day: st && st.day, shown: st && st.ev && st.ev.shown }));
  await shot(`ev_${name}_card`);
  if (opt.after) await opt.after({ page, J, shot, next, banner, dlgOnly, st });
  await page.close();
  return st;
}
const chooseA = async ({ page, J, shot, dlgOnly }, tag) => {
  await page.eval(`(()=>{ document.getElementById('evA').click(); return 1; })()`, false); await sleep(1800);
  const t = await J(`(()=>({ talking: document.getElementById('stage').classList.contains('talking'), line: (document.getElementById('dlgText')||{}).textContent || '' }))()`);
  console.log(`  ${tag} 고른 뒤 대사`, JSON.stringify(t));
  if (t.talking) await shot(`ev_${tag}_after`);
  return t;
};
if (!process.env.ONLY || process.env.ONLY === 'cat1') await scene('cat1', 'humanQ_g_d36.json', 'cat1', { after: x => chooseA(x, 'cat1') });
if (!process.env.ONLY || process.env.ONLY === 'cat2') await scene('cat2', 'humanQ_g_d36.json', 'cat2');
if (!process.env.ONLY || process.env.ONLY === 'cat3') await scene('cat3', 'humanQ_g_d36.json', 'cat3');
if (!process.env.ONLY || process.env.ONLY === 'parcel') await scene('parcel', 'humanQ_g_d36.json', 'parcel', { after: async (x) => {
  await chooseA(x, 'parcel'); await x.dlgOnly(); await sleep(800);
  await x.next(); let b = '';
  for (let i = 0; i < 16 && !/김치/.test(b); i++) { await sleep(400); b = await x.banner(); if (!/김치/.test(b)) await x.dlgOnly(); }
  console.log('  김치 배너', b); ok(/김치/.test(b) && /\+[\d,]+원/.test(b), '택배 첫 단추 → 이튿날 김치 배너', b);
  await x.shot('ev_kimchi_banner'); } });
if (!process.env.ONLY || process.env.ONLY === 'parcel_nostamina') await scene('parcel_nostamina', 'humanQ_g_d36.json', 'parcel', { noStamina: true, after: async ({ st }) => {
  ok(st && st.aDis && /체력이 없습니다/.test(st.note || ''), '택배 체력 0 — 첫 단추 흐림 · 까닭 글', JSON.stringify({ aDis: st && st.aDis, note: st && st.note })); } });
if (!process.env.ONLY || process.env.ONLY === 'truck') await scene('truck', 'humanQ_g_d36.json', 'truck', { after: async (x) => {
  const t = await chooseA(x, 'truck');
  const heat = await x.J(`!!(window.__rv && window.__rv.lightHeatmap && window.__rv.lightHeatmap().on)`);
  ok(heat && /색이 그대로/.test(t.line), '트럭 첫 단추 → 빛 분포 켜짐 · «색이 그대로네?»', JSON.stringify({ heat, line: t.line }));
  for (let i = 0; i < 6; i++) { const l = await x.J(`(document.getElementById('dlgText')||{}).textContent || ''`); if (/색이 그대로/.test(l)) { await x.shot('ev_truck_color'); break; }
    await x.page.eval(`(()=>{ const b=document.getElementById('dlgBox'); if(b) b.click(); return 1; })()`, false); await sleep(700); } } });
if (!process.env.ONLY || process.env.ONLY === 'grandma') await scene('grandma', 'humanQ_g_d74.json', 'grandma', { after: x => chooseA(x, 'grandma') });
if (!process.env.ONLY || process.env.ONLY === 'kids1') await scene('kids1', 'humanQ_g_d36.json', 'kids1', { after: x => chooseA(x, 'kids1') });
if (!process.env.ONLY || process.env.ONLY === 'kids2') await scene('kids2', 'humanQ_g_d36.json', 'kids2');
if (!process.env.ONLY || process.env.ONLY === 'chuseok') await scene('chuseok', 'humanQ_g_d60.json', 'chuseok', { after: async (x) => {
  await chooseA(x, 'chuseok'); await x.dlgOnly(); await sleep(800);
  let b = '';
  for (let d = 0; d < 3 && !/추석 음식/.test(b); d++) { await x.next(); for (let i = 0; i < 12 && !/추석 음식/.test(b); i++) { await sleep(400); b = await x.banner(); if (!/추석 음식/.test(b)) await x.dlgOnly(); } }
  console.log('  추석 음식 배너', b); ok(/추석 음식/.test(b) && /\+[\d,]+원/.test(b), '추석 첫 단추 → 이틀 뒤 추석 음식 배너', b);
  await x.shot('ev_side_dish_banner'); } });
ok(exc.length === 0, '처리 안 된 예외 0', exc.slice(0, 3).join(' / '));
console.log('사진', shots.length); for (const s of shots) console.log('  ' + s);
console.log(bad ? `probe_d96_cards: 빨강 ${bad}` : 'probe_d96_cards: 다 통과');
process.exit(bad ? 1 : 0);
