/* D29 사진 자(총괄 11-04 · plan 44a362ed probe_bag_cut_deadline 의 화면 짝) — 혹 난 물꽂이의 분갈이 기한이 화면에 어떻게 서나 사진 둘(①④)
   판: shop45_g_premove(8aa170ce 하네스 dump 복사 · 반지하 Day 149 · cut_01 물꽂이 유리병 뿌리 내리는 중 · 창턱) — 판 세우기는 사람 손뿐(손질 깃발 없음 · staged-setup-human-actions)
   손: [다음 날]을 눌러 cut_01 에 혹이 날 때까지(분갈이 기한이 생김) → ① [자세히] «분갈이 기한 n일 남음» · ④ 방 말풍선 «🪴 분갈이 D-n»(그림만 · 글은 aria-label · 08-17)
   ⚠ 사진 ②(가방 사흘) · ③(놓은 뒤)는 없다(총괄 11-04 ㉡) — 놓인 삽수를 가방에 넣는 단추가 없어 이사로만 가방에 드는데,
     사람 손만으로는 «혹 난 물꽂이가 가방에 든 판»이 안 선다(혹 난 날 지갑 1,678,426원 < 이사비 200만 · 원룸 → 투룸은 500만). 가방 동안 기한 멈춤 갈림은 node 자(probe_bag_cut_deadline · 진짜 함수)로 잰다
   단언: 판 확인(혹이 났다 · 남은 날 > 0) · 처리 안 된 예외 0. ① [자세히] 남은 날 · ④ 말풍선 D-n 이 판의 남은 날과 같은지는 적기만(D29 와 무관한 화면 일치라 빨강 먼저를 못 보인다) */
import fs from 'node:fs';
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9451', OUT = process.env.OUT || null;
const SAVE_T = process.env.SAVE || 'C:/Users/pc/byeot-core-keep/d29/premove_8aa170ce.json';
const CUT = process.env.CUT || 'cut_01';
if (OUT) fs.mkdirSync(OUT, { recursive: true });
let bad = 0; const ok = (c, m, d = '') => { console.log(`${c ? '  OK' : 'FAIL'}  ${m}${d ? '  → ' + d : ''}`); if (!c) bad++; };
if (!fs.existsSync(SAVE_T)) { ok(false, '세이브 없음', SAVE_T); process.exit(1); }
const exc = [];
const page = await launch({ width: 390, height: 844, dpr: 2 });
page.on((method, p) => { if (method === 'Runtime.exceptionThrown') exc.push(((p.exceptionDetails.exception && p.exceptionDetails.exception.description) || p.exceptionDetails.text || '').split('\n')[0].slice(0, 200)); });
await page.send('Runtime.enable');
await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true;` });
const J = async (js) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, 120000));
const shot = async n => { if (OUT) await page.shot(`${OUT}/${n}.png`); };
const talk = async (max = 120) => { for (let i = 0; i < max; i++) { const t = await J(`document.getElementById('stage').classList.contains('talking')`); if (t !== true) return i;
  await page.eval(`(()=>{ const b=document.getElementById('dlgBox'); if(b) b.click(); return 1; })()`, false); await sleep(180); } return max; };
const bannerOff = async () => { for (let i = 0; i < 20; i++) { const on = await J(`document.getElementById('event').classList.contains('on')`); if (on !== true) return; await J(`(()=>{ document.getElementById('event').click(); return 1; })()`); await sleep(350); } };
const shut = async () => { for (let i = 0; i < 8; i++) { const r = await J(`(()=>{ const p=document.querySelector('.pop.on'); if(!p) return 'none'; if (p.id==='evPanel') { const b=p.querySelector('button'); if (b) { b.click(); return 'ev'; } }
    if (p.id==='monthPanel') { const c=document.getElementById('monthClose'); if (c) { c.click(); return 'month'; } }
    const x=p.querySelector('.close,[data-close],button.ghost,button.no,button.cancel'); if(x){ x.click(); return p.id; } return 'stuck:' + p.id; })()`); if (r === 'none' || /^stuck/.test(r)) return r; await sleep(350); } return 'many'; };
const quiet = async () => { await talk(); await bannerOff(); await shut(); await talk(); };
const CUTV = `(()=>{ const S=window.__S(); const c=(S.cuttings||[]).find(x=>x && x.id===${JSON.stringify(CUT)}); if (!c) return { gone: true, day: S.day };
  return { day: S.day, room: S.home && S.home.room, status: c.status, at: !!c.at, slot: c.slotId || null, deadline: Number.isFinite(c.deadlineDay) ? c.deadlineDay : null,
           left: Number.isFinite(c.deadlineDay) ? c.deadlineDay - S.day : null, clock: c.clockOnDay }; })()`;
const nextDay = async () => {
  const d0 = await J(`window.__S().day`);
  await page.eval(`(()=>{ const n=document.getElementById('next'); if(n && !n.disabled) n.click(); return 1; })()`, false); await sleep(900);
  if ((await J(`window.__S().day`)) === d0) await page.eval(`(()=>{ const g=document.getElementById('mealGo'); const p=g && g.closest('.pop'); if(g && (!p || p.classList.contains('on'))) g.click(); return 1; })()`, false);
  await sleep(2200); await quiet();
  return { d0, d1: await J(`window.__S().day`) };
};
/* [자세히] 삽수 카드 «분갈이 기한 n일 남음» 줄 */
const CARD = `(async()=>{ window.__detailOpen('cutting', { id: ${JSON.stringify(CUT)} }); await new Promise(r=>setTimeout(r,700));
  const body=(document.getElementById('dBody')||document.getElementById('detail')).innerText||''; const m=body.match(/분갈이 기한\\s*(\\d+)일 남음/);
  return { on: document.getElementById('detail').classList.contains('on'), left: m ? +m[1] : null, title: (document.getElementById('dTitle')||{}).textContent, sub: (document.getElementById('dSub')||{}).textContent }; })()`;
const closeCard = async () => { await J(`(()=>{ const x=document.getElementById('dClose'); if (x) x.click(); return 1; })()`); await sleep(500); };
/* 방 말풍선 — 화면엔 그림만 · 글은 aria-label · title(08-17 박사님 «말풍선은 아이콘만») */
const MARK = `(()=>{ const all=[...document.querySelectorAll('#marks .mark')].map(m=>(m.getAttribute('aria-label') || m.title || m.textContent || '').trim()); const ms=all.filter(t=>/분갈이/.test(t)); const m=(ms[0]||'').match(/D-(\\d+)/); return { marks: ms, all: all.slice(0, 8), left: m ? +m[1] : null }; })()`;

await page.goto(`${BASE}/data/balance/homes.json`);
await page.eval(`(()=>{ localStorage.clear(); localStorage.setItem('byeot/save/1', ${JSON.stringify(fs.readFileSync(SAVE_T, 'utf8'))}); localStorage.setItem('byeot.guideSeen','1'); return 1; })()`, false);
await page.goto(`${BASE}/game.html`); await page.waitFor('window.__byeotBooted === true', 300000, 500); await page.waitFor('!!window.__rv', 240000, 500); await sleep(4000);
await quiet();
console.log('  실음', JSON.stringify(await J(CUTV)));
let v = null;
for (let i = 0; i < 40; i++) { v = await J(CUTV); if (v.gone || v.status === 'node') break; const nd = await nextDay(); if (nd.d1 === nd.d0) { console.log('  [다음 날] 막힘', JSON.stringify(nd)); break; } }
console.log('  혹', JSON.stringify(v));
ok(!v.탈 && !v.gone && v.status === 'node' && v.left > 0, `판 확인 — 혹이 났다(Day ${v.day} · 남은 날 ${v.left})`, JSON.stringify(v));
const c1 = await J(CARD); await shot('d29_1_detail_node'); await closeCard(); await quiet();
await sleep(800); const m4 = await J(MARK); await shot('d29_4_marks');
console.log(`  ① [자세히] «분갈이 기한 ${c1.left}일 남음» · 판 ${v.left} · ${c1.left === v.left ? '같음' : '다름'}(적기만)`, JSON.stringify(c1));
console.log(`  ④ 방 말풍선 «${m4.marks[0] || '-'}» · 판 ${v.left} · ${m4.left === v.left ? '같음' : '다름'}(적기만)`, JSON.stringify(m4));
ok(exc.length === 0, '처리 안 된 예외 0', exc.slice(0, 3).join(' / '));
try { await page.close(); } catch (e) { console.log('  (탭 닫기 탈)', e.message); }
console.log(bad ? `probe_d29_bag_photos: 빨강 ${bad}` : 'probe_d29_bag_photos: 다 통과');
process.exit(bad ? 1 : 0);
