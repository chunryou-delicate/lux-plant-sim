/* U11 빛 보기 · U6 막힌 누름 자(core 11-03 · plan-ui-fun U 표 · 총괄 판정) — ⚠ 써 두기만(크롬은 새 종 덩이 · F3 뒤)
   판: N 새 판(Day 0 · 첫 플레이 · 세이브 없음) · T 투룸 가게 첫날 C:/Users/pc/byeot-core-keep/critic8/tworoom_shop_first.json
   단언(390 · 360)
     U6 ㉮ N — 손가락 · 울타리(#hintDim.on)가 선 동안 울타리 밖을 누르면 #hint 에 .knock 이 붙었다가 0.3초 안팎(≤ 0.6초)에 떨어진다(감시 줄 MutationObserver)
            · 그 누름은 안 먹힘(날 · 체력 그대로) · .say 깜빡 애니메이션(hintSayBlink)이 걸린다
     U6 ㉯ T — 손가락 없는 때 누르면 .knock 0
     U11 ㉮ N(세팅 끝 전) — 🔆 안 보임 · T — 🔆 보임 · «?» 왼쪽(겹침 0 · 같은 높이 · 34px) · 할 일 칩과 겹침 0 · 390 · 360
     U11 ㉯ T — 🔆 누름 → 빛 분포 켜짐 · .on · aria «빛 분포 끄기» · aria-pressed true · [식물] 판 #lightHeat 글 «끄기» · 다시 누름 → 꺼짐 · aria «빛 분포 보기»
     U11 ㉰ T — 켠 동안 범례 첫 줄이 낱말 판(«어둠 · 그늘 · 밝음 · 아주 밝음» 중) · 360 한 줄(사진)
     U11 ㉱ T — «?» 도움말 겹에 «빛 분포 — 누르면 자리마다 밝기를 봅니다» 한 줄이 화면 안(360)
     U11 ㉲ T — 배너가 선 동안 🔆 은 숨고(할 일 칩과 같은 결) · 배너가 걷히면 다시 선다(390 · 360 · 총괄 11-04 ㉠) · 배너 상자 폭 적기
   예외 0 · J 단언엔 !탈 */
import fs from 'node:fs';
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9451', OUT = process.env.OUT || null;
const SAVE_T = process.env.SAVE || 'C:/Users/pc/byeot-core-keep/critic8/tworoom_shop_first.json';
if (OUT) fs.mkdirSync(OUT, { recursive: true });
let bad = 0; const ok = (c, m, d = '') => { console.log(`${c ? '  OK' : 'FAIL'}  ${m}${d ? '  → ' + d : ''}`); if (!c) bad++; };
if (!fs.existsSync(SAVE_T)) { ok(false, '세이브 없음', SAVE_T); process.exit(1); }
const exc = [];
const page = await launch({ width: 390, height: 844, dpr: 2 });
page.on((method, p) => { if (method === 'Runtime.exceptionThrown') exc.push(((p.exceptionDetails.exception && p.exceptionDetails.exception.description) || p.exceptionDetails.text || '').split('\n')[0].slice(0, 200)); });
await page.send('Runtime.enable');
await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true;` });
const J = async (js) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, 120000));
const dlg = async () => { for (let i = 0; i < 160; i++) { const t = await J(`document.getElementById('stage').classList.contains('talking')`); if (t !== true) break; await page.eval(`(()=>{ const b=document.getElementById('dlgBox'); if(b) b.click(); return 1; })()`, false); await sleep(250); } };
const bannerOff = async () => { for (let i = 0; i < 20; i++) { const on = await J(`document.getElementById('event').classList.contains('on')`); if (on !== true) return; await J(`(()=>{ document.getElementById('event').click(); return 1; })()`); await sleep(400); } };
const W = async (w) => { await page.send('Emulation.setDeviceMetricsOverride', { width: w, height: w === 360 ? 780 : 844, deviceScaleFactor: 2, mobile: false }); await sleep(1300); };
const boot = async (raw) => {
  await W(390);
  await page.goto(`${BASE}/data/balance/homes.json`);
  await page.eval(`(()=>{ localStorage.clear(); ${raw ? `localStorage.setItem('byeot/save/1', ${JSON.stringify(raw)});` : ''} localStorage.setItem('byeot.guideSeen','1'); return 1; })()`, false);
  await page.goto(`${BASE}/game.html`); await page.waitFor('window.__byeotBooted === true', 300000, 500); await page.waitFor('!!window.__rv', 240000, 500); await sleep(4000);
  await dlg(); await bannerOff(); await sleep(1000);
};
const RECT = `(id => { const e=document.getElementById(id); if (!e) return null; const r=e.getBoundingClientRect(); const cs=getComputedStyle(e); return { l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height), vis: cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 }; })`;
const over = (a, b) => (a && b) ? Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t)) : 0;
/* .knock 감시 줄 — 붙은 때 · 떨어진 때(겹침 프레임 멈춤에도 흔들리지 않게 순간 값이 아니라 갈마듦을 적는다) */
const WATCH = `(()=>{ if (window.__u6w) return 1; const L = window.__u6w = []; const h = document.getElementById('hint'); let was = h.classList.contains('knock');
  new MutationObserver(() => { const now = h.classList.contains('knock'); if (now !== was) { L.push({ on: now, t: Math.round(performance.now()), say: (() => { const s=h.querySelector('.say'); return s ? getComputedStyle(s).animationName : null; })() }); was = now; } })
    .observe(h, { attributes: true, attributeFilter: ['class'] }); return 1; })()`;
const VAL = `(()=>{ const S0=window.__S(); return { day: S0.day, left: S0.stamina && S0.stamina.left, dim: document.getElementById('hintDim').classList.contains('on'), hint: document.getElementById('hint').classList.contains('on') }; })()`;
const tapAt = async (x, y) => { await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 }); await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }); };

/* ═══ N — 새 판 Day 0 ═══ */
await boot(null);
await J(WATCH);
const n0 = await J(VAL); const heatN = await J(`${RECT}('lightHeatOff')`);
/* 울타리 밖 — 방 아래 왼쪽 빈 바닥(손가락이 짚는 것 밖) */
const t0 = await J(`performance.now()`);
await tapAt(40, 700); await sleep(900);
const n1 = await J(VAL); const w1 = await J(`(window.__u6w||[]).slice()`);
if (OUT) await page.shot(`${OUT}/390_u6_knock.png`);
console.log('  U6 ㉮', JSON.stringify({ n0, n1, w1, heatN }));
const onE = (w1 || []).find(x => x.on), offE = (w1 || []).find(x => !x.on && onE && x.t >= onE.t);
ok(!n0.탈 && n0.dim === true && n0.hint === true && !!onE && !!offE && (offE.t - onE.t) >= 150 && (offE.t - onE.t) <= 600 && onE.say === 'hintSayBlink' && n1.day === n0.day && n1.left === n0.left,
   'U6 ㉮ 울타리에 막힌 누름 → .knock 붙음 → 0.3초 안팎에 떨어짐 · 말풍선 깜빡(hintSayBlink) · 날 · 체력 그대로', JSON.stringify({ n0, w1, n1 }));
ok(!heatN || heatN.vis === false, 'U11 ㉮ 첫 플레이 세팅 끝 전에는 🔆 안 보임', JSON.stringify(heatN));

/* ═══ T — 투룸 ═══ */
await boot(fs.readFileSync(SAVE_T, 'utf8'));
/* ★ 11-04 — 켠 순간 조작 쪽지(zoomTip · 쪽지 기록 비움)가 떠 있으면 #stage.coaching 이 «?» · 할 일 칩 · 🔆 을 숨긴다(옛 규칙) — 걷힐 때까지(12초까지) 기다린 뒤 잰다(red86 첫 판은 쪽지 동안 재서 셋 다 0) */
{ let cw = null; for (let i = 0; i < 24; i++) { cw = await J(`window.__byeotCoach ? window.__byeotCoach.now() : null`); if (!cw) break; await sleep(500); }
  console.log('  (쪽지 기다림)', JSON.stringify(cw)); await sleep(400); }
await J(WATCH);
const k0 = (await J(`(window.__u6w||[]).length`)) || 0;
const v0 = await J(VAL);
await tapAt(40, 700); await sleep(900);
const k1 = (await J(`(window.__u6w||[]).length`)) || 0;
ok(v0.dim === false ? k1 === k0 : true, 'U6 ㉯ 울타리 없는 때 누르면 .knock 0', JSON.stringify({ v0, k0, k1 }));
for (const w of [390, 360]) {
  await W(w); await sleep(600);
  const r = await J(`(()=>({ heat: ${RECT}('lightHeatOff'), help: ${RECT}('guideOpen'), chip: ${RECT}('questChip'),
    /* ★ 11-04 U11 꼬리(총괄 ㉠) — 기둥 단추를 옆에서 짚는 손가락 꼬리표 */
    say: (() => { const h=document.getElementById('hint'), t=document.querySelector('.hintTarget'), sy=h && h.querySelector('.say'); if (!h || !h.classList.contains('on') || !sy) return null;
      const q=sy.getBoundingClientRect(); const rg=document.createRange(); rg.selectNodeContents(sy); const tops=[...rg.getClientRects()].filter(x=>x.width>0).map(x=>x.top).sort((x,y)=>x-y);
      let k=0, st=null; for (const x of tops) { if (st===null || x-st>2) { k++; st=x; } }
      return { l: Math.round(q.left), t: Math.round(q.top), r: Math.round(q.right), b: Math.round(q.bottom), side: h.classList.contains('side'), nav: !!(t && t.closest && t.closest('#navbar')), target: t ? (t.id||t.className) : null,
               lines: k, wb: getComputedStyle(sy).wordBreak, mw: sy.style.maxWidth || null, text: (sy.textContent||'').trim() }; })() }))()`);
  if (OUT) await page.shot(`${OUT}/${w}_u11_icon.png`);
  console.log(`  U11 ㉮ ${w}`, JSON.stringify(r));
  ok(!r.탈 && r.heat && r.heat.vis && r.heat.w === 34 && r.heat.h === 34 && r.help && over(r.heat, r.help) === 0 && r.heat.r <= r.help.l && Math.abs(r.heat.t - r.help.t) <= 1 && over(r.heat, r.chip) === 0,
     `U11 ㉮ ${w} — 🔆 34px · «?» 왼쪽 같은 높이 · «?» · 할 일 칩과 안 겹침`, JSON.stringify(r));
  { const sy = r.say, navSide = !!(sy && sy.side && sy.nav);
    console.log(`  U11 ㉮ ${w} 꼬리표(적기만)`, JSON.stringify(sy));
    ok(!r.탈 && navSide && over(sy, r.heat) === 0 && over(sy, r.chip) === 0,
       `U11 ㉮ ${w} — 기둥 단추 손가락 꼬리표 × 🔆 겹침 0(${navSide ? over(sy, r.heat) : '꼬리표 없음'}px²) · 할 일 칩 겹침 0(${navSide ? over(sy, r.chip) : '-'}) · 줄 ${sy ? sy.lines : '-'} · ${sy ? sy.wb : '-'}`, JSON.stringify({ say: sy, heat: r.heat, chip: r.chip })); }
}
await W(390);
const HS = `(()=>{ const b=document.getElementById('lightHeatOff'); const p=document.getElementById('lightHeat'); return { heat: !!(window.__rv.lightHeatmap()||{}).on, on: b.classList.contains('on'), aria: b.getAttribute('aria-label'), pressed: b.getAttribute('aria-pressed'), t: (b.textContent||'').trim(), plants: p ? (p.textContent||'').trim() : null }; })()`;
await J(`(()=>{ document.getElementById('lightHeatOff').click(); return 1; })()`); await sleep(1800);
const h1 = await J(HS);
const leg = await J(`(()=>{ const d=document.querySelector('#stage .byeot-lightgrid > div:first-child'); if (!d) return null; const r=d.getBoundingClientRect(); return { txt: (d.innerText||'').split(String.fromCharCode(10)).slice(0, 3), w: Math.round(r.width) }; })()`);
if (OUT) await page.shot(`${OUT}/390_u11_on.png`);
await W(360); if (OUT) await page.shot(`${OUT}/360_u11_on.png`); await W(390);
await J(`(()=>{ document.getElementById('lightHeatOff').click(); return 1; })()`); await sleep(1500);
const h2 = await J(HS);
console.log('  U11 ㉯ ㉰', JSON.stringify({ h1, h2, leg }));
ok(!h1.탈 && h1.heat && h1.on && h1.aria === '빛 분포 끄기' && h1.pressed === 'true' && h1.t === '🔆' && /끄기/.test(h1.plants || '') && !h2.heat && !h2.on && h2.aria === '빛 분포 보기' && h2.pressed === 'false',
   'U11 ㉯ 🔆 누름 → 켜짐(.on · aria «빛 분포 끄기» · [식물] 판 단추 «끄기») · 다시 누름 → 꺼짐(aria «빛 분포 보기»)', JSON.stringify({ h1, h2 }));
ok(!!leg && !leg.탈 && /어둠|그늘|밝음/.test((leg.txt || []).join(' ')), 'U11 ㉰ 켠 동안 범례가 낱말 판', JSON.stringify(leg));
/* ㉱ 도움말 겹 — 화면 안(단언) · 둘레 겹침 px²(적기만 · plan 7f449579 «둘레 칩과 겹치는지는 잰다») — buildGuide 는 앞서 놓인 설명 줄만 피하고 테두리(.ghole)는 안 피한다 ⇒ 둘을 나눠 적는다 */
const GT = `(()=>{ const all=[...document.querySelectorAll('#guide .gtip')]; const g=all.find(e=>/빛 분포/.test(e.textContent||'')); if (!g) return { n: all.length, hit: null }; const r=g.getBoundingClientRect();
  const ov=(a,b)=>Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
  const tips=all.filter(e=>e!==g).map(e=>({ s:(e.textContent||'').trim().slice(0,10), px: Math.round(ov(r,e.getBoundingClientRect())) })).filter(x=>x.px>0);
  const hb=document.getElementById('lightHeatOff').getBoundingClientRect();
  const holes=[...document.querySelectorAll('#guide .ghole')].map(e=>e.getBoundingClientRect()).filter(b=>!(Math.abs(b.left-(hb.left-3))<2 && Math.abs(b.top-(hb.top-3))<2)).map(b=>({ box:[Math.round(b.left),Math.round(b.top),Math.round(b.right),Math.round(b.bottom)], px: Math.round(ov(r,b)) })).filter(x=>x.px>0);
  return { n: all.length, hit: (g.textContent||'').trim(), l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), b: Math.round(r.bottom), W: innerWidth, tipOver: tips, holeOver: holes }; })()`;
await W(360);
await J(`(()=>{ document.getElementById('guideOpen').click(); return 1; })()`); await sleep(1200);
const gt = await J(GT);
if (OUT) await page.shot(`${OUT}/360_u11_guide.png`);
await J(`(()=>{ const g=document.getElementById('guide'); if (g) g.click(); return 1; })()`); await sleep(600); await W(390);
await J(`(()=>{ document.getElementById('guideOpen').click(); return 1; })()`); await sleep(1200);
const gt390 = await J(GT);
if (OUT) await page.shot(`${OUT}/390_u11_guide.png`);
await J(`(()=>{ const g=document.getElementById('guide'); if (g) g.click(); return 1; })()`); await sleep(600);
console.log('  U11 ㉱', JSON.stringify(gt));
console.log('  U11 ㉱ 둘레 겹침 px²(적기만) 360', JSON.stringify({ tipOver: gt.tipOver, holeOver: gt.holeOver }), '· 390', JSON.stringify({ tipOver: gt390.tipOver, holeOver: gt390.holeOver, l: gt390.l, r: gt390.r, t: gt390.t }));
ok(!gt.탈 && gt.hit === '빛 분포 — 누르면 자리마다 밝기를 봅니다' && gt.l >= 0 && gt.r <= gt.W, 'U11 ㉱ «?» 도움말에 «빛 분포 — 누르면 자리마다 밝기를 봅니다» · 360 화면 안', JSON.stringify(gt));
/* ㉲ 배너 동안 🔆 숨음 · 걷히면 다시 섬(총괄 11-04 ㉠ · 예전엔 겹침 px 적기만) */
for (const w of [390, 360]) {
  await W(w);
  await J(`(()=>{ try { window.__byeotBannerTest && window.__byeotBannerTest([{ title: '📦 원룸으로 이사했습니다', sub: '반지하에서 배운 것을 가지고 갑니다' }]); } catch (e) { void e; } return 1; })()`); await sleep(700);
  const bo = await J(`(()=>({ heat: ${RECT}('lightHeatOff'), ev: ${RECT}('event'), on: document.getElementById('event').classList.contains('on') }))()`);
  if (OUT) await page.shot(`${OUT}/${w}_u11_banner.png`);
  await bannerOff(); await sleep(1300);
  const ba = await J(`(()=>({ heat: ${RECT}('lightHeatOff'), on: document.getElementById('event').classList.contains('on') }))()`);
  console.log(`  U11 ㉲ ${w}`, JSON.stringify({ bo, ba }));
  ok(!bo.탈 && !ba.탈 && bo.on && bo.heat && bo.heat.vis === false && !ba.on && ba.heat && ba.heat.vis === true,
     `U11 ㉲ ${w} — 배너 동안 🔆 숨음(${bo.heat && bo.heat.vis}) · 걷히면 다시 섬(${ba.heat && ba.heat.vis}) · 배너 폭 ${bo.ev && bo.ev.w}`, JSON.stringify({ bo, ba }));
}
await W(390);

ok(exc.length === 0, '처리 안 된 예외 0', exc.slice(0, 3).join(' / '));
try { await page.close(); } catch (e) { console.log('  (탭 닫기 탈)', e.message); }
console.log(bad ? `probe_u11_u6: 빨강 ${bad}` : 'probe_u11_u6: 다 통과');
process.exit(bad ? 1 : 0);
