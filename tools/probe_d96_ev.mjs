/* D96 반지하 사건 카드 자(core 10-31) — 390×844 · 하네스 humanQ g Day 36 세이브(다음 날 사건 차례 · 트럭)
   글은 plan 몫이라 아직 없을 수 있다 — 검사 손잡이 window.__byeotEvCardsOverride 로 임시 글을 넣고 카드 길만 잰다
   ㉮ [다음 날] → 조용한 때 카드가 뜬다(#evPanel.on) · 글 · 단추 둘 · 첫 단추가 «빛 지도» 쪽
   ㉯ 카드 동안 손가락이 카드 밖 무엇도 안 짚는다(물러섬) · 카드가 [다음 날]을 덮는다(.pop)
   ㉰ 첫 단추 → 카드 닫힘 · 빛 지도가 켜짐(트럭 a) · 코어에 고른 것이 적힘(choice.truck = 0) · 세이브 왕복에도 남음
   ㉱ ?ev=0 이면 같은 판에서 카드 0
   ㉲ 처리 안 된 예외 0 */
import fs from 'node:fs';
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9300', OUT = process.env.OUT || null;
const SAVE = process.env.SAVE || 'C:/Users/pc/AppData/Local/Temp/byeot-core/ev/dump/humanQ_g_d36.json';
if (OUT) fs.mkdirSync(OUT, { recursive: true });
let bad = 0; const ok = (c, m, d = '') => { console.log(`${c ? '  OK' : 'FAIL'}  ${m}${d ? '  → ' + d : ''}`); if (!c) bad++; };
const CARDS = { truck: { text: '(검사 글) 창 앞에 트럭이 섰다.', a: '빛 지도를 켜 본다', b: '그냥 둔다' },
                cat1: { text: '(검사 글) 고양이', a: '내민다', b: '본다' }, parcel: { face: 'elder', text: '(검사 글) 택배', a: '올려다 드린다 (체력 1)', b: '쪽지' },
                kids1: { text: '(검사 글) 아이들', a: '흔든다', b: '모른 척' }, chuseok: { text: '(검사 글) 추석', a: '받는다', b: '괜찮다' } };
const exc = [];
async function run(q) {
  const page = await launch({ width: 390, height: 844, dpr: 2 });
  page.on((method, p) => { if (method === 'Runtime.exceptionThrown') exc.push(((p.exceptionDetails.exception && p.exceptionDetails.exception.description) || p.exceptionDetails.text || '').split('\n')[0].slice(0, 200)); });
  await page.send('Runtime.enable');
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true; window.__byeotEvCardsOverride=${JSON.stringify(CARDS)};` });
  const J = async (js) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, 120000));
  await page.goto(`${BASE}/data/balance/homes.json`);
  await page.eval(`(()=>{ localStorage.clear(); localStorage.setItem('byeot/save/1', ${JSON.stringify(fs.readFileSync(SAVE, 'utf8'))}); localStorage.setItem('byeot.guideSeen','1'); return 1; })()`, false);
  await page.goto(`${BASE}/game.html${q || ''}`); await page.waitFor('window.__byeotBooted === true', 300000, 500); await sleep(4000);
  const dlgOnly = async () => { for (let i = 0; i < 80; i++) { const t = await J(`document.getElementById('stage').classList.contains('talking')`); if (!t) return; await page.eval(`(()=>{ const s=document.getElementById('dlgSkip'); if(s) s.click(); const b=document.getElementById('dlgBox'); if(b) b.click(); return 1; })()`, false); await sleep(250); } };
  await dlgOnly();
  let st = null;
  /* 세이브를 연 첫 아침은 «이사 자금이 모자랍니다»(상태가 바뀐 날만 · 세이브에 안 남는 칸이라 한 번 다시 선다)가 카드를 하루 민다 — 카드가 뜰 때까지 [다음 날](사흘까지) */
  for (let d = 0; d < 4 && !(st && st.on); d++) {
  await page.eval(`(()=>{ const b=document.getElementById('next'); b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})); b.click(); return 1; })()`, false);
  await sleep(1500); await page.eval(`(()=>{ const g=document.getElementById('mealGo'); if (g && g.offsetParent) g.click(); return 1; })()`, false);
  for (let i = 0; i < 20; i++) { await sleep(500); await dlgOnly();
    st = await J(`(()=>{ const p=document.getElementById('evPanel'); const h=document.getElementById('hint'); const t=document.querySelector('.hintTarget');
      const n=document.getElementById('next').getBoundingClientRect(); const top=document.elementFromPoint(n.left+n.width/2, n.top+n.height/2);
      return { day: window.__S().day, on: !!(p && p.classList.contains('on')), text: (document.getElementById('evText')||{}).textContent, a: (document.getElementById('evA')||{}).textContent,
        b: (document.getElementById('evB')||{}).textContent, bShown: getComputedStyle(document.getElementById('evB')).display !== 'none',
        hintOn: !!(h && h.classList.contains('on')), hintTarget: t ? (t.id || t.className.split(' ')[0]) : null, hintInCard: !!(t && t.closest && t.closest('#evPanel')),
        nextCovered: !!(top && top.closest && top.closest('#evPanel')), ev: window.__byeotEvCard() }; })()`);
    if (st.on || (i > 8 && !(st.ev && st.ev.pending))) break; }
  }
  return { page, J, st };
}
/* ── 켠 판 ── */
{
  const { page, J, st } = await run('');
  console.log('  턴', JSON.stringify(await J(`(()=>{ const t=window.__turn(); return t ? { ev: (t.events||[]).map(e=>e.id), story: ((t.tutorial||{}).storyEvents||[]).map(e=>e.id), bjErr: t.bjError || null, bj: window.__S().tutorial.bjEvents, en: window.__S().tutorial.enabled, mo: window.__S().tutorial.movedOut } : null; })()`)));
  console.log('  카드', JSON.stringify({ day: st.day, on: st.on, text: st.text, a: st.a, b: st.b, hint: st.hintOn, target: st.hintTarget, ev: st.ev && { pending: st.ev.pending, shown: st.ev.shown, card: st.ev.state && st.ev.state.card } }));
  if (OUT) await page.shot(`${OUT}/390_ev_card.png`);
  /* ★ D98 — 어느 카드가 먼저 서나는 막는 날(시루 재촉 · 할 일 끝)에 따라 바뀐다 — 선 카드로 잰다(트럭 빛 분포는 probe_d96_cards) */
  const K = st.ev && st.ev.shown;
  ok(st.on && !!K && !!CARDS[K], '㉮ [다음 날] 뒤 조용한 때 사건 카드가 뜬다', JSON.stringify({ day: st.day, shown: K }));
  ok(!!K && st.text === CARDS[K].text && st.a === CARDS[K].a && (CARDS[K].b ? st.b === CARDS[K].b && st.bShown : !st.bShown), '㉮ 글 · 단추(검사 글)', JSON.stringify({ text: st.text, a: st.a, b: st.b }));
  ok(!st.hintOn, '㉯ 카드 동안 손가락이 물러선다(고르기 단추 어느 쪽도 안 짚는다)', JSON.stringify({ hint: st.hintOn, target: st.hintTarget }));
  ok(st.nextCovered, '㉯ 카드가 [다음 날]을 덮는다(덮개 위 창)', String(st.nextCovered));
  await page.eval(`(()=>{ document.getElementById('evA').click(); return 1; })()`, false);
  await sleep(2500);
  const after = await J(`(()=>({ on: document.getElementById('evPanel').classList.contains('on'), heat: !!(window.__rv && window.__rv.lightHeatmap && window.__rv.lightHeatmap().on),
    choice: (window.__S().tutorial.bjEvents||{}).choice, card: (window.__S().tutorial.bjEvents||{}).card }))()`);
  console.log('  고른 뒤', JSON.stringify(after));
  ok(!after.on && after.choice && after.choice[K] === 0 && after.card === null, '㉰ 첫 단추 → 카드 닫힘 · 코어에 고른 것(choice[선 카드] = 0)', JSON.stringify(after));
  if (K === 'truck') ok(after.heat, '㉰ 트럭 첫 단추 → 빛 지도가 켜졌다', String(after.heat));
  if (OUT) await page.shot(`${OUT}/390_ev_after.png`);
  /* 세이브 왕복 */
  const rt = await J(`(()=>{ const raw=localStorage.getItem('byeot/save/1'); const j=raw?JSON.parse(raw):null; return j && j.state && j.state.tutorial ? j.state.tutorial.bjEvents : null; })()`);
  ok(!!(rt && rt.choice && rt.choice[K] === 0 && rt.seen && Number.isInteger(rt.seen[K])), '㉰ 게임 세이브(localStorage)에 본 것 · 고른 것이 실린다', JSON.stringify(rt).slice(0, 160));
  await page.close();
}
/* ── ?ev=0 ── */
{
  const { page, st } = await run('?ev=0');
  console.log('  ?ev=0', JSON.stringify({ day: st.day, on: st.on, ev: st.ev && { pending: st.ev.pending, shown: st.ev.shown, seen: st.ev.state && st.ev.state.seen } }));
  ok(!st.on && !(st.ev && st.ev.state && st.ev.state.seen && Object.keys(st.ev.state.seen).length), '㉱ ?ev=0 이면 카드 0 · 본 것 0', JSON.stringify(st.ev && st.ev.state && st.ev.state.seen));
  await page.close();
}
ok(exc.length === 0, '㉲ 처리 안 된 예외 0', exc.slice(0, 3).join(' / '));
console.log(bad ? `probe_d96_ev: 빨강 ${bad}` : 'probe_d96_ev: 다 통과');
process.exit(bad ? 1 : 0);
