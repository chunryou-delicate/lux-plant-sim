/* 비판 7판 7C9 자(core 11-03 · 총괄 가름 · 비판 7판 MINOR #13 runS_95) — 원룸 «씨앗부터 다시 키운다»: 빈 화분이 오는 중이면 할 일이 «화분을 사세요»라 하지 않는다
   ⛔ 비판 7판 S: Day 94 화분 주문(2일 뒤) → Day 95 할 일 칩 «상점에서 화분을 사세요»(오는 중인 화분을 안 셈 · 두 번 사게 함)
   판: 비판 6판 S Day 97 세이브(C:/Users/pc/byeot-core-keep/critic6/saveS_d97.json · 원룸 · oneroom_seed_restart 열림 84일 · 프로필 안 건드림)
       손질: 몬스테라 화분 0(그루를 판 판 꼴) · 삽수 0 · 빈 화분 0 · «씨앗부터 다시 키운다» 끝 표 뺌 · 작물은 다 자라는 중(돌봄 손가락 없음) · 체력 가득
   단언
     ㉮ 씨앗 2 · 화분 주문 1(2일 뒤 도착) — 할 일 칩 몸 «화분이 오는 중 — 2일 뒤» · 손가락이 화분을 사러 가라 하지 않음 · 360 칩 사진
     ㉯ 씨앗 0 · 씨앗 주문 없음 · 화분 주문 1 — 칩 «상점에서 몬스테라 씨앗을 사세요»(화분은 오는 중이라 씨앗만)
     ㉰ 씨앗 0 · 씨앗 주문 1 · 화분 주문 1(1일 뒤) — 칩 «화분이 오는 중 — 1일 뒤»
     ㉱ 대조 — 씨앗 2 · 화분 주문 없음 — 칩은 옛 글 «상점에서 화분을 사세요» 그대로
     예외 0 · J 단언엔 !탈 */
import fs from 'node:fs';
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9451', OUT = process.env.OUT || null;
const SAVE = process.env.SAVE || 'C:/Users/pc/byeot-core-keep/critic6/saveS_d97.json';
if (OUT) fs.mkdirSync(OUT, { recursive: true });
let bad = 0; const ok = (c, m, d = '') => { console.log(`${c ? '  OK' : 'FAIL'}  ${m}${d ? '  → ' + d : ''}`); if (!c) bad++; };
if (!fs.existsSync(SAVE)) { ok(false, '세이브 없음', SAVE); process.exit(1); }
const stage = ({ seeds = 2, potIn = 2, seedIn = 0 } = {}) => { const w = JSON.parse(fs.readFileSync(SAVE, 'utf8')); const s = w.state;
  s.stamina.left = s.stamina.max;
  for (const p of s.firstPlay.beansprout.pots) if (p.slotId) Object.assign(p, { sown: true, harvested: false, ageDays: 1, startedOnDay: s.day - 1, idleSinceDay: s.day - 1 });
  for (const v of Object.values(s.firstPlay.crops || {})) for (const p of ((v && v.pots) || [])) if (p.slotId) Object.assign(p, { sown: true, harvested: false, ageDays: 1, startedOnDay: s.day - 1, idleSinceDay: s.day - 1 });
  s.pots = []; s.cuttings = []; s.emptyPots = [];
  /* 이 세이브는 화분을 들인 뒤라 «씨앗부터 다시 키운다»가 끝난 줄(questsTaken)에 들어 있다 — 끝 표를 빼야 칩이 그 줄을 말한다(열린 날 84 는 그대로) */
  s.stamina.questsTaken = (s.stamina.questsTaken || []).filter(id => id !== 'oneroom_seed_restart');
  if (Array.isArray(s.stamina.questsClosed)) s.stamina.questsClosed = s.stamina.questsClosed.filter(id => id !== 'oneroom_seed_restart');
  s.shop.stock.monstera_seed = seeds; s.shop.stock.pot = 0;
  const orders = []; let seq = (s.shop.seq || 0);
  const od = (itemId, qty, unitWon, days) => { seq += 1; orders.push({ orderId: `ord_${String(seq).padStart(3, '0')}`, itemId, qty, unitWon, totalWon: unitWon * qty, orderedOnDay: s.day, arrivesOnDay: s.day + days }); };
  if (potIn) od('pot', 1, 3000, potIn);
  if (seedIn) od('monstera_seed', 1, 5000, seedIn);
  s.shop.orders = orders; s.shop.seq = seq;
  return JSON.stringify(w); };
const exc = [];
const open = async (W) => {
  const page = await launch({ width: W, height: 844, dpr: 2 });
  page.on((method, p) => { if (method === 'Runtime.exceptionThrown') exc.push(((p.exceptionDetails.exception && p.exceptionDetails.exception.description) || p.exceptionDetails.text || '').split('\n')[0].slice(0, 200)); });
  await page.send('Runtime.enable');
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true;` });
  const J = async (js) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, 120000));
  const boot = async (txt) => {
    await page.goto(`${BASE}/data/balance/homes.json`);
    await page.eval(`(()=>{ localStorage.clear(); localStorage.setItem('byeot/save/1', ${JSON.stringify(txt)}); localStorage.setItem('byeot.guideSeen','1'); return 1; })()`, false);
    await page.goto(`${BASE}/game.html`); await page.waitFor('window.__byeotBooted === true', 300000, 500); await page.waitFor('!!window.__rv', 240000, 500); await sleep(3500);
    for (let i = 0; i < 120; i++) { const t = await J(`document.getElementById('stage').classList.contains('talking')`); if (t !== true) break; await page.eval(`(()=>{ const b=document.getElementById('dlgBox'); if(b) b.click(); return 1; })()`, false); await sleep(250); }
    await J(`(()=>{ try { window.__byeotSheet.close(); } catch (e) { void e; } return 1; })()`); await sleep(1200);
    let n = 0; for (let i = 0; i < 60 && n < 2; i++) { const b = await J(`(()=>{ try { return !!window.__rv.camBusy(); } catch (e) { return false; } })()`); n = b === false ? n + 1 : 0; await sleep(200); }
    for (let i = 0; i < 20; i++) { const on = await J(`document.getElementById('event').classList.contains('on')`); if (on !== true) break; await J(`(()=>{ document.getElementById('event').click(); return 1; })()`); await sleep(400); }
    await sleep(800);
  };
  const H = () => J(`(async()=>{ try { window.__byeotHint(); } catch (e) { void e; } await new Promise(r=>setTimeout(r,900)); const h=document.getElementById('hint'), t=document.querySelector('.hintTarget');
    const c=document.getElementById('questChip'), ct=document.getElementById('questChipText'), q=c.getBoundingClientRect();
    const S=window.__S ? window.__S() : null;
    return { chip: (ct||{}).textContent || '', quest: (document.getElementById('quest')||{}).textContent || '', on: h.classList.contains('on'), tid: t ? (t.id || (t.dataset && t.dataset.act) || null) : null,
      say: (h.querySelector('.say')||{}).textContent, chipBox: [Math.round(q.left), Math.round(q.top), Math.round(q.right), Math.round(q.bottom)],
      chipClip: !!(ct && ct.scrollWidth > ct.clientWidth + 1), day: S ? S.day : null, pots: S ? (S.pots||[]).length : null, orders: S ? (S.shop.orders||[]).map(o=>o.itemId+'×'+o.qty+'@'+o.arrivesOnDay) : null }; })()`);
  return { page, J, boot, H };
};
const BUY = /사세요|사러/;
/* ═══ ㉮ ㉯ ㉰ ㉱ — 390 ═══ */
{
  const { page, boot, H } = await open(390);
  await boot(stage({ seeds: 2, potIn: 2 }));
  const a = await H();
  console.log('  ㉮ 씨앗 2 · 화분 오는 중(2일)', JSON.stringify(a));
  if (OUT) await page.shot(`${OUT}/390_c7h_coming.png`);
  ok(!a.탈 && a.pots === 0 && Array.isArray(a.orders) && a.orders.length === 1, '㉮ 판 — 몬스테라 화분 0 · 화분 주문 하나', JSON.stringify({ pots: a.pots, orders: a.orders }));
  ok(!a.탈 && a.chip === '화분이 오는 중 — 2일 뒤', '㉮ 할 일 칩 몸 «화분이 오는 중 — 2일 뒤»', JSON.stringify(a.chip));
  ok(!a.탈 && !(a.on && BUY.test(a.say || '') && /화분/.test(a.say || '')), '㉮ 손가락이 화분을 사러 가라 하지 않음', JSON.stringify({ tid: a.tid, say: a.say }));
  await boot(stage({ seeds: 0, potIn: 2 }));
  const b = await H();
  console.log('  ㉯ 씨앗 0 · 화분 오는 중', JSON.stringify(b));
  ok(!b.탈 && b.chip === '상점에서 몬스테라 씨앗을 사세요', '㉯ 씨앗이 없고 안 오면 — 칩 «상점에서 몬스테라 씨앗을 사세요»(화분은 오는 중)', JSON.stringify(b.chip));
  await boot(stage({ seeds: 0, potIn: 1, seedIn: 1 }));
  const c = await H();
  console.log('  ㉰ 씨앗 · 화분 둘 다 오는 중(1일)', JSON.stringify(c));
  ok(!c.탈 && c.chip === '화분이 오는 중 — 1일 뒤', '㉰ 씨앗도 오는 중이면 — 칩 «화분이 오는 중 — 1일 뒤»', JSON.stringify(c.chip));
  await boot(stage({ seeds: 2, potIn: 0 }));
  const d = await H();
  console.log('  ㉱ 씨앗 2 · 화분 주문 없음', JSON.stringify(d));
  ok(!d.탈 && d.chip === '상점에서 화분을 사세요', '㉱ 대조 — 화분 주문이 없으면 옛 글 «상점에서 화분을 사세요» 그대로', JSON.stringify(d.chip));
  try { await page.close(); } catch (e) { void e; }
}
/* ═══ ㉮ 360 ═══ */
{
  const { page, boot, H } = await open(360);
  await boot(stage({ seeds: 2, potIn: 2 }));
  const a3 = await H();
  console.log('  ㉮ 360', JSON.stringify(a3));
  if (OUT) await page.shot(`${OUT}/360_c7h_coming.png`);
  ok(!a3.탈 && a3.chip === '화분이 오는 중 — 2일 뒤' && !a3.chipClip, '㉮ 360 — 칩 글이 안 잘림', JSON.stringify({ chip: a3.chip, clip: a3.chipClip, box: a3.chipBox }));
  try { await page.close(); } catch (e) { void e; }
}
ok(exc.length === 0, '처리 안 된 예외 0', exc.slice(0, 3).join(' / '));
console.log(bad ? `\nprobe_critic7_h: 빨강 ${bad}` : '\nprobe_critic7_h: 다 통과');
process.exit(bad ? 1 : 0);
