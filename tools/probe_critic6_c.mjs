/* 비판 6판 가름 C 묶음 ㉢(core 11-02 · 총괄 C11 · C12 · [plan] P6 · P8 · P9 · P10 · 글 507ba40d) — 390×844
   판(비판 6판 세이브 — C:/Users/pc/byeot-core-keep/critic6/ · 프로필은 안 건드림): A100 = 비판 A Day 100(반지하 · 안 팖 · 체력 0 · 등 1)
   ㉮ #18 [방] 판 «밥으로 아낀 식비 +n원 아낌» · P10 빛 범례 넷째 줄 «어둠 0.3까지 · 밝음 2.7부터 · 아주 밝음 6부터» · 다섯째 줄 «칸의 수는 하루 빛 양(DLI)»(11-02 §16 ③ 두 줄) ·
      #8 놓인 등 메뉴가 왼쪽 탭 기둥과 안 겹침 · #15 «몬스테라 내놓기» 설명(#sellHint)이 그 단추 바로 밑 · #13 할 일 창에서 손가락이 [✕]를 안 짚음 ·
      #16 같은 순간(1.5초 안) 알림 둘은 합쳐 보이고 그 뒤 것은 갈아 끼움 · [확인] 바 동안 쪽지는 안 보임 · #17 반찬가게 배너 글([plan] P6)
   ㉯ #20 밥상 창 밖을 누르면 창만 닫히고 날은 그대로 → [다음 날]을 다시 누르면 이어진다
   ㉰ P9 A100Q(세이브 손질: «열여섯까지 늘린다»를 안 끝낸 꼴) — 할 일 판 그 줄에 «체력 18이면 시루 · 재배판을 합쳐 하루 6개씩 …» · [방] 판과 같은 수
   ㉱ P8 A100(이사비 손질 · probe_minor5_pot 과 같은 손) — 이사 창에 «가져가는 것 — …» · «시루 · 재배판은 이삿짐이 되어 …» · «두고 가는 것 — …»
   ㉳ 총괄 0400a798 사진 넷: [식물] 손가락 가로 · 자리 줄 말풍선은 그 줄 안 · [다음 날] 말풍선이 바닥 단추 글을 안 덮음 · 빛 분포 동안 알림은 범례 밑
   ㉲ C12 / #14 A100L(등 안 단 꼴): 가방 안내에 «식물등 칸을 누르면 …» · 바닥 [🧺 남는 채소 N판 팔기] 창에 «다음부터 묻지 않고 바로 팔기»(기본 꺼짐) →
      켜고 한 판 덜 팔면 → 다음 누름은 창 없이 «🧺 남는 채소 n판을 팔았습니다» · [방] 판 «🧺 남는 채소는 묻지 않고 바로 팝니다» · [다시 묻기]
   ㉴ [plan] 18405b99 고침 둘: C9 진행 줄은 할 일 탭 · [가방] 단추 밑 머리도 그 글 그대로(«지금 할 것 —» 없음 · 익은 시루 판은 그대로) ·
      «가장 밝은 칸»(guideBrightSlot)은 보통 날 자(growBandAt) — 등 단 원룸에서 [다음 날]을 넘기며 내일 흐림 · 비이고 두 자가 갈린 날을 찾아 잰다(못 찾으면 적음)
   예외 0 · J 단언엔 !탈 */
import fs from 'node:fs';
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9454', OUT = process.env.OUT || null;
const SAVE_A = process.env.SAVE_A || 'C:/Users/pc/byeot-core-keep/critic6/saveA_d100.json';
if (OUT) fs.mkdirSync(OUT, { recursive: true });
let bad = 0; const ok = (c, m, d = '') => { console.log(`${c ? '  OK' : 'FAIL'}  ${m}${d ? '  → ' + d : ''}`); if (!c) bad++; };
const exc = [];
let page = null, J = null;
const boot = async (saveText) => {
  if (page) { try { await page.close(); } catch (e) { console.log('  (탭 닫기 탈)', e.message); } }
  page = await launch({ width: 390, height: 844, dpr: 2 });
  page.on((method, p) => { if (method === 'Runtime.exceptionThrown') exc.push(((p.exceptionDetails.exception && p.exceptionDetails.exception.description) || p.exceptionDetails.text || '').split('\n')[0].slice(0, 200)); });
  await page.send('Runtime.enable');
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true;` });
  J = async (js) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, 120000));
  await page.goto(`${BASE}/data/balance/homes.json`);
  await page.eval(`(()=>{ localStorage.clear(); localStorage.setItem('byeot/save/1', ${JSON.stringify(saveText)}); localStorage.setItem('byeot.guideSeen','1'); return 1; })()`, false);
  await page.goto(`${BASE}/game.html`); await page.waitFor('window.__byeotBooted === true', 300000, 500); await page.waitFor('!!window.__rv', 240000, 500); await sleep(4000);
};
const dlgOnly = async () => { for (let i = 0; i < 80; i++) { const t = await J(`document.getElementById('stage').classList.contains('talking')`); if (!t || t.탈) return; await page.eval(`(()=>{ const b=document.getElementById('dlgBox'); if(b) b.click(); return 1; })()`, false); await sleep(280); } };
const m = (type, x, y, buttons) => page.send('Input.dispatchMouseEvent', { type, x: Math.round(x), y: Math.round(y), button: 'left', buttons, clickCount: 1 });
const tapAt = async (x, y) => { await m('mouseMoved', x, y, 0); await m('mousePressed', x, y, 1); await sleep(60); await m('mouseReleased', x, y, 0); };
const tapSel = async (sel) => {
  const measureAt = () => J(`(()=>{ const b=document.querySelector(${JSON.stringify(sel)}); if (!b) return null; b.scrollIntoView({ block: 'center' }); const q=b.getBoundingClientRect(); const x=q.left+q.width/2, y=q.top+q.height/2; const top=document.elementFromPoint(x,y); return { x, y, hit: !!(top && (top===b || b.contains(top))), t: (b.textContent||'').replace(/\\s+/g,' ').slice(0,60) }; })()`);
  let r = null;
  for (let k = 0; k < 15; k++) { const a = await measureAt(); await sleep(300); const b = await measureAt();
    r = b; if (!a || !b || b.탈) continue; if (b.hit && b.y > 10 && b.y < 834 && Math.abs(a.y - b.y) < 2) break; }
  if (r && r.hit) await tapAt(r.x, r.y);
  return r;
};
const camStill = async () => { let n = 0; for (let i = 0; i < 60 && n < 2; i++) { const b = await J(`(()=>{ try { return !!window.__rv.camBusy(); } catch (e) { return false; } })()`); n = b === false ? n + 1 : 0; await sleep(200); } };
const hintNow = () => J(`(()=>{ const h=document.getElementById('hint'); const on=!!(h && h.classList.contains('on')); const t=document.querySelector('.hintTarget'); return { on, tid: t ? (t.id || t.className) : null }; })()`);
const saveA = fs.readFileSync(SAVE_A, 'utf8');

/* ═══ ㉮ A100 — 글 · 자리 ═══ */
await boot(saveA);
await dlgOnly(); await page.eval(`(()=>{ try { window.__byeotSheet.close(); } catch (e) { void e; } return 1; })()`, false); await camStill(); await sleep(1000);
await page.eval(`(()=>{ window.__byeotSheet.open('room'); return 1; })()`, false); await sleep(1200);
const room = await J(`(()=>{ const t=(document.getElementById('pageRoom')||{}).innerText||''; const i=t.indexOf('아낀 식비'); const j=t.indexOf('콩나물로 아낌'); return { row: i >= 0 ? t.slice(i - 4, i + 30).replace(/\\s+/g,' ') : null, old: j >= 0 }; })()`);
ok(!room.탈 && room.row && /밥으로 아낀 식비 (\+[\d,]+원 아낌|—)/.test(room.row) && !room.old, '㉮ #18 [방] 판 «밥으로 아낀 식비 +n원 아낌»(«콩나물로 아낌 −» 아님)', JSON.stringify(room));
await page.eval(`(()=>{ window.__byeotSheet.open('shop'); return 1; })()`, false); await sleep(1200);
const sh = await J(`(()=>{ const h=document.getElementById('sellHint'); const prev=h && h.previousElementSibling; return { afterPlant: !!(prev && prev.querySelector && prev.querySelector('#sellPlant')), text: h ? (h.textContent||'').slice(0,60) : null }; })()`);
ok(!sh.탈 && sh.afterPlant, '㉮ #15 «몬스테라 내놓기» 설명(#sellHint)이 그 단추 바로 밑', JSON.stringify(sh));
await page.eval(`(()=>{ window.__byeotSheet.open('plants'); return 1; })()`, false); await sleep(1200);
await tapSel('#lightHeat'); await sleep(2500); await dlgOnly();
const leg = await J(`(()=>{ const c=[...document.querySelectorAll('.byeot-lightgrid div')].map(e=>e.innerText||'').find(s=>/칸의 수는/.test(s)) || ''; const lines=c.split('\\n'); return { line: lines.find(l=>/^어둠 /.test(l)) || null, line5: lines.find(l=>/칸의 수는/.test(l)) || null, all: c.slice(0,200) }; })()`);
if (OUT) await page.shot(`${OUT}/390_c6c_legend.png`);
/* ★ 11-02 넷째 묶음 [plan] §16 ③ — 넷째 줄을 둘로(«—» 뺌) */
ok(!leg.탈 && leg.line === '어둠 0.3까지 · 밝음 2.7부터 · 아주 밝음 6부터' && leg.line5 === '칸의 수는 하루 빛 양(DLI)', '㉮ P10 빛 범례 넷째 · 다섯째 줄', JSON.stringify(leg));
await page.eval(`(()=>{ const b=document.getElementById('lightHeatOff'); if (b && b.style.display !== 'none') b.click(); return 1; })()`, false); await sleep(1200);
await page.eval(`(()=>{ try { window.__byeotSheet.close(); } catch (e) { void e; } return 1; })()`, false); await camStill(); await sleep(800);
/* #8 등 메뉴 */
const rig = await J(`(()=>{ const rv=window.__rv; const c=document.getElementById('roomCanvas').getBoundingClientRect(); const r=(rv.lightRigs()||[]).filter(x=>x.grow)[0]; if(!r) return null; const s=rv.worldToScreen(r.pos.x, r.pos.y, r.pos.z); return s ? { x: c.left + s.x, y: c.top + s.y } : null; })()`);
if (rig && !rig.탈) { await tapAt(rig.x, rig.y); await sleep(1000); }
const fa = await J(`(()=>{ const f=document.getElementById('furnActions'); const n=document.getElementById('navbar'); const on=document.getElementById('stage').classList.contains('furnpicked'); const a=f.getBoundingClientRect(), b=n.getBoundingClientRect();
  return { on, name: (document.getElementById('furnName')||{}).textContent, faL: Math.round(a.left), faT: Math.round(a.top), faB: Math.round(a.bottom), nvR: Math.round(b.right), nvT: Math.round(b.top), nvB: Math.round(b.bottom) }; })()`);
if (OUT) await page.shot(`${OUT}/390_c6c_lamp_menu.png`);
const vOverlap = fa && !fa.탈 && fa.faT < fa.nvB && fa.faB > fa.nvT;
ok(!fa.탈 && fa.on && (!vOverlap || fa.faL >= fa.nvR), '㉮ #8 놓인 등 메뉴가 왼쪽 탭 기둥에 안 가린다', JSON.stringify(fa));
await page.eval(`(()=>{ const c=document.getElementById('furnClose'); if (c && c.offsetParent) c.click(); return 1; })()`, false); await sleep(800);
/* #13 할 일 창 */
await page.eval(`(()=>{ const q=document.getElementById('questChip'); if (q) q.click(); return 1; })()`, false); await sleep(400);
await page.eval(`(()=>{ try { window.__byeotSheet.close(); } catch (e) { void e; } if (typeof openQuestPanel === 'function') openQuestPanel(); return 1; })()`, false);
await tapSel('#navQuest'); await sleep(1200);
const qp = await J(`(()=>({ on: (document.getElementById('questPanel')||{}).classList ? document.getElementById('questPanel').classList.contains('on') : false, sheetQuest: !!document.querySelector('#sheet.open') }))()`);
let hq = null; for (let i = 0; i < 4; i++) { hq = await hintNow(); await sleep(400); }
console.log('  ㉮ #13', JSON.stringify({ qp, hq }));
ok(!hq.탈 && !(hq.on && /Close|close/.test(hq.tid || '')), '㉮ #13 할 일 창에서 손가락이 [✕]를 안 짚는다', JSON.stringify({ qp, hq }));
await page.eval(`(()=>{ document.querySelectorAll('.pop.on').forEach(p=>{ const c=p.querySelector('[id$="Close"], button.ghost'); if (c) c.click(); }); try { window.__byeotSheet.close(); } catch (e) { void e; } return 1; })()`, false); await sleep(1500);
/* #16 알림 합치기 · 쪽지 숨김 · #17 글 */
const b1 = await J(`(async()=>{ const a = window.__byeotBannerTest([{ title: '시험 가', sub: '하나' }]); await new Promise(r=>setTimeout(r, 300)); const b = window.__byeotBannerTest([{ title: '시험 나', sub: '둘' }]);
  await new Promise(r=>setTimeout(r, 1800)); const c = window.__byeotBannerTest([{ title: '시험 다', sub: '셋' }]); return { a, b, c }; })()`);
ok(!b1.탈 && /시험 가/.test(b1.b) && /시험 나/.test(b1.b), '㉮ #16 같은 순간 알림 둘은 합쳐 보인다(먼저 선 것이 남음)', JSON.stringify(b1));
ok(!b1.탈 && /시험 다/.test(b1.c) && !/시험 가/.test(b1.c), '㉮ #16 1.5초 뒤 알림은 갈아 끼운다', JSON.stringify(b1));
const co = await J(`(()=>{ const st=document.getElementById('stage'), c=document.getElementById('coach'); c.classList.add('on'); st.classList.add('confirming'); const v=getComputedStyle(c).visibility; st.classList.remove('confirming'); const v2=getComputedStyle(c).visibility; c.classList.remove('on'); return { during: v, after: v2 }; })()`);
ok(!co.탈 && co.during === 'hidden' && co.after !== 'hidden', '㉮ #16 [확인] 바(confirming) 동안 쪽지는 안 보인다', JSON.stringify(co));
const nb = await J(`window.__byeotNeighborBanner(200000)`);
ok(!nb.탈 && nb[0] && nb[0].title === '🧺 반찬가게가 오늘 거둔 채소를 사 갔습니다' && /^\+200,000원( — 전에 거둔 채소는 그대로 있습니다)?$/.test(nb[0].sub), '㉮ #17 · P6 반찬가게 배너 «… 사 갔습니다» · «+200,000원 …»', JSON.stringify(nb));

/* ═══ ㉯ #20 밥상 창 밖 ═══ */
const d0 = await J(`window.__S().day`);
await page.eval(`(()=>{ const b=document.getElementById('next'); b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})); b.click(); return 1; })()`, false); await sleep(1500);
const mp1 = await J(`(()=>({ on: document.getElementById('mealPanel').classList.contains('on'), day: window.__S().day }))()`);
const outPt = await J(`(()=>{ const p=document.getElementById('mealPanel'); const c=p && p.querySelector('.popcard'); if (!p || !c) return null; const pr=p.getBoundingClientRect(), cr=c.getBoundingClientRect();
  const y = cr.top - 30 > pr.top + 10 ? cr.top - 30 : Math.min(pr.bottom - 10, cr.bottom + 30); const top=document.elementFromPoint(pr.left + pr.width / 2, y); return { x: pr.left + pr.width / 2, y, top: top ? (top.id || top.className) : null }; })()`);
console.log('  ㉯ 창 밖 점', JSON.stringify(outPt));
if (outPt && !outPt.탈) await tapAt(outPt.x, outPt.y); await sleep(1200);   /* 창 밖(스크림) — 사람 손으로 */
const mp2 = await J(`(()=>({ on: document.getElementById('mealPanel').classList.contains('on'), day: window.__S().day }))()`);
await page.eval(`(()=>{ const b=document.getElementById('next'); b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})); b.click(); return 1; })()`, false); await sleep(1500);
const mp3 = await J(`(()=>({ on: document.getElementById('mealPanel').classList.contains('on'), day: window.__S().day }))()`);
await page.eval(`(()=>{ const g=document.getElementById('mealGo'); if (g && g.offsetParent) g.click(); return 1; })()`, false); await sleep(3500); await dlgOnly();
const mp4 = await J(`window.__S().day`);
console.log('  ㉯ #20', JSON.stringify({ d0, mp1, mp2, mp3, mp4 }));
ok(mp1.on && !mp2.on && mp2.day === d0 && mp3.on && mp4 === d0 + 1, '㉯ #20 밥상 창 밖을 누르면 창만 닫히고 → [다음 날]을 다시 누르면 창 → 날이 넘어간다', JSON.stringify({ d0, mp1, mp2, mp3, mp4 }));

/* ═══ ㉰ P9 — A100Q ═══ */
/* 시루를 열 개로 줄인 판(세이브 손질) — «열여섯까지 늘린다»가 열린 채 남는다(questsTaken 만 지우면 켤 때 시루 16 이라 바로 다시 끝난다) */
const wQ = JSON.parse(saveA); wQ.state.stamina.questsTaken = (wQ.state.stamina.questsTaken || []).filter(x => x !== 'siru16');
wQ.state.firstPlay.beansprout.pots = wQ.state.firstPlay.beansprout.pots.slice(0, 10);
await boot(JSON.stringify(wQ));
await dlgOnly(); await page.eval(`(()=>{ window.__byeotSheet.open('quest'); return 1; })()`, false); await sleep(1500);
const cap = await J(`(()=>{ const e=document.querySelector('#questListTab [data-qid="siru16"]'); return e ? { cls: e.className, cap: ((e.querySelector('.qcap')||{}).textContent||null) } : null; })()`);
await page.eval(`(()=>{ window.__byeotSheet.open('room'); return 1; })()`, false); await sleep(1200);
const led = await J(`(()=>{ const t=((document.getElementById('pageRoom')||{}).textContent||'').replace(/\\s+/g,' '); const m=t.match(/체력 (\\d+)이?면 하루 (\\d+)개씩/); return m ? { max: +m[1], perDay: +m[2] } : null; })()`);
const sv = await J(`(()=>({ max: window.__S().stamina.max }))()`);
if (OUT) await page.shot(`${OUT}/390_c6c_p9_room.png`);
console.log('  ㉰ P9', JSON.stringify({ cap, led, sv }));
const capM = cap && cap.cap ? cap.cap.match(/^체력 (\d+)이?면 시루 · 재배판을 합쳐 하루 (\d+)개씩 한 바퀴\(거두기 · 다시 심기 · 물\) 돌립니다$/) : null;
ok(!cap.탈 && cap && /open/.test(cap.cls) && !!capM && +capM[1] === sv.max, '㉰ P9 열린 «열여섯까지 늘린다» 줄에 «체력 n이면 시루 · 재배판을 합쳐 하루 m개씩 …»', JSON.stringify(cap));
/* [방] 판 천장 줄은 물 안 준 시루가 있으면 다른 갈래(«아직 물을 안 받았습니다»)가 서서 이 판엔 없을 수 있다 — 있으면 같은 수 · 늘 체력 표의 수(최대 체력 · ⌊체력 ÷ 손 셋⌋) */
ok(!!capM && +capM[1] === sv.max && +capM[2] === Math.floor(sv.max / 3) && (!led || (+capM[1] === led.max && +capM[2] === led.perDay)), '㉰ P9 수가 체력 표와 [방] 판 천장 셈(한 함수 §handCapNow)과 같다', JSON.stringify({ capM: capM && capM.slice(1), led, sv }));

/* ═══ ㉱ P8 — 이사 창 줄 ═══ */
await boot(saveA);
await dlgOnly(); await page.eval(`(()=>{ try { window.__byeotSheet.close(); } catch (e) { void e; } return 1; })()`, false); await sleep(1000);
await J(`(()=>{ const ts=window.__S().tutorial; ts.cashWon = ts.rules.moveOutCostWon + 400000; window.__redraw(); return 1; })()`);
await sleep(800); await dlgOnly();
await page.eval(`(()=>{ window.__byeotSheet.tab('room'); document.getElementById('moveOut').click(); return 1; })()`, false); await sleep(1500); await dlgOnly(); await sleep(800);
const mv = await J(`(()=>({ on: document.getElementById('movePanel').classList.contains('on'), lines: [...document.querySelectorAll('#moveAsk div')].map(d=>d.textContent) }))()`);
if (OUT) await page.shot(`${OUT}/390_c6c_p8_move.png`);
console.log('  ㉱ P8', JSON.stringify(mv));
const L = (mv.lines || []);
const iCarry = L.findIndex(t => /^가져가는 것 — /.test(t)), iBox = L.findIndex(t => t === '시루 · 재배판은 이삿짐이 되어, 원룸에 놓을 때까지 자라지 않습니다'),
      iLeave = L.findIndex(t => /^두고 가는 것 — 벽 · 창 · 천장에 붙은 가구 \d+개$/.test(t)),   /* ★ 11-02 [plan] §16 ① */ iSrc = L.findIndex(t => /^무늬 원천/.test(t));
ok(!mv.탈 && mv.on && iCarry >= 0 && /시루 \d+개/.test(L[iCarry]) && /몬스테라 1그루/.test(L[iCarry]), '㉱ P8 «가져가는 것 — 가구 … · 시루 … · 몬스테라 1그루 …»', JSON.stringify(L[iCarry]));
ok(iBox > iCarry && (iLeave < 0 || iLeave > iBox) && iSrc > Math.max(iBox, iLeave), '㉱ P8 줄 차례 carry → boxed → leave → 무늬 원천', JSON.stringify({ iCarry, iBox, iLeave, iSrc }));
await page.eval(`(()=>{ const c=document.getElementById('moveCancel'); if (c) c.click(); return 1; })()`, false); await sleep(800);

/* ═══ ㉲ C12 · #14 — A100L ═══ */
const wL = JSON.parse(saveA); wL.state.tutorial.lamp.placed = 0; wL.state.lamps.count = 0;
/* 남는 몫이 있는 판(세이브 손질 — 보유 채소 꾸러미를 세 벌로 · 6판 A 는 날마다 팔아 Day 100 엔 남는 몫이 없다) */
{ const f = wL.state.firstPlay.food; const lots = (f.pantryLots || []).slice(); f.pantryLots = [...lots, ...lots.map(l => ({ ...l })), ...lots.map(l => ({ ...l }))];
  f.pantryWon = f.pantryLots.reduce((a, l) => a + (l.won || 0), 0); }
await boot(JSON.stringify(wL));
await dlgOnly(); await page.eval(`(()=>{ window.__byeotSheet.open('bag'); return 1; })()`, false); await sleep(1500);
const bh = await J(`[...document.querySelectorAll('#pageBag .baghelp')].map(e=>(e.textContent||'').slice(0,40))`);
console.log('  ㉲ #14', JSON.stringify(bh));
ok(!bh.탈 && bh.some(t => /^식물등 칸을 누르면/.test(t)), '㉲ #14 가방 안내에 «식물등 칸을 누르면 …»(등 칸이 있을 때)', JSON.stringify(bh));
await page.eval(`(()=>{ try { window.__byeotSheet.close(); } catch (e) { void e; } return 1; })()`, false); await sleep(1200);
const s0 = await J(`(()=>{ const b=document.getElementById('sellSurplusBtn'); return { shown: !!(b && b.style.display !== 'none' && b.offsetParent), t: b ? b.textContent : '' }; })()`);
console.log('  ㉲ 바닥', JSON.stringify(s0));
if (s0.shown) {
  await tapSel('#sellSurplusBtn'); await sleep(1200);
  const p1 = await J(`(()=>{ const r=document.getElementById('pantryNoAskRow'), cb=document.getElementById('pantryNoAsk'); return { row: !!(r && r.style.display !== 'none' && r.offsetParent), checked: !!(cb && cb.checked), text: r ? (r.textContent||'').replace(/\\s+/g,' ').trim() : null, n: (document.getElementById('pantryCount')||{}).textContent }; })()`);
  if (OUT) await page.shot(`${OUT}/390_c6c_c12_popup.png`);
  ok(!p1.탈 && p1.row && !p1.checked && /다음부터 묻지 않고 바로 팔기/.test(p1.text) && /이레치 밥상 몫은 늘 남깁니다/.test(p1.text), '㉲ C12 바닥 단추 창에 «다음부터 묻지 않고 바로 팔기»(기본 꺼짐)', JSON.stringify(p1));
  await J(`(()=>{ document.getElementById('pantryNoAsk').checked = true; const mi=document.getElementById('pantryMinus'); if (mi && !mi.disabled) mi.click(); return 1; })()`);
  await tapSel('#pantryGo'); await sleep(1500);
  const f1 = await J(`(()=>({ flag: !!window.__S().tutorial.sellNoAsk, btn: (()=>{ const b=document.getElementById('sellSurplusBtn'); return !!(b && b.style.display !== 'none' && b.offsetParent); })() }))()`);
  ok(!f1.탈 && f1.flag, '㉲ C12 켜고 팔면 깃발(tutorial.sellNoAsk)이 선다', JSON.stringify(f1));
  if (f1.btn) {
    const lots = await J(`(document.getElementById('sellSurplusBtn').textContent.match(/(\\d+)판/)||[])[1] || null`);
    await tapSel('#sellSurplusBtn'); await sleep(1200);
    const d1 = await J(`(()=>({ pop: !!document.querySelector('.pop.on'), ev: (()=>{ const e=document.getElementById('event'); return e && e.classList.contains('on') ? (e.innerText||'').replace(/\\s+/g,' ') : ''; })() }))()`);
    console.log('  ㉲ 바로 팔기', JSON.stringify({ lots, d1 }));
    ok(!d1.탈 && !d1.pop && new RegExp(`🧺 남는 채소 ${lots}판을 팔았습니다`).test(d1.ev) && /이레치 밥상 몫은 남겼습니다/.test(d1.ev), '㉲ C12 다음 누름은 창 없이 «🧺 남는 채소 n판을 팔았습니다 · … 이레치 밥상 몫은 남겼습니다»', JSON.stringify(d1));
  } else ok(false, '㉲ C12 한 판 덜 판 뒤 바닥 단추가 남는다(판 세우기)', JSON.stringify(f1));
  await page.eval(`(()=>{ window.__byeotSheet.open('room'); return 1; })()`, false); await sleep(1200);
  const rb = await J(`(()=>{ const b=document.getElementById('sellNoAskBox'); return { shown: !!(b && b.style.display !== 'none' && b.offsetParent), t: b ? (b.textContent||'').replace(/\\s+/g,' ').trim() : null }; })()`);
  ok(!rb.탈 && rb.shown && /🧺 남는 채소는 묻지 않고 바로 팝니다/.test(rb.t) && /다시 묻기/.test(rb.t), '㉲ C12 [방] 판 «🧺 남는 채소는 묻지 않고 바로 팝니다» + [다시 묻기]', JSON.stringify(rb));
  await tapSel('#sellNoAskOff'); await sleep(800);
  const off = await J(`(()=>({ flag: !!window.__S().tutorial.sellNoAsk, shown: (()=>{ const b=document.getElementById('sellNoAskBox'); return !!(b && b.style.display !== 'none' && b.offsetParent); })() }))()`);
  ok(!off.탈 && !off.flag && !off.shown, '㉲ C12 [다시 묻기]를 누르면 다시 묻는다(깃발 내림 · 줄 숨김)', JSON.stringify(off));
} else ok(false, '판 ㉲ — 바닥 [🧺 남는 채소 N판 팔기]가 선 판', JSON.stringify(s0));

/* ═══ ㉳ 총괄 0400a798 사진 넷 — 손가락 · 알림 자리 ═══ */
const SAVE_S = process.env.SAVE_S || 'C:/Users/pc/byeot-core-keep/critic6/saveS_d97.json';
{ const w = JSON.parse(fs.readFileSync(SAVE_S, 'utf8')); const st = w.state; const fp = st.firstPlay; const all = [...fp.beansprout.pots, ...Object.values(fp.crops).flatMap(v => (v && v.pots) || [])];
  const pot = st.pots[0], siru = all.find(x => x.slotId === 'banjiha-desk:0'), tray = all.find(x => x.slotId === 'oneroom-sill:0');
  pot.slotId = siru.slotId; pot.at = { ...siru.at }; siru.slotId = 'free:' + siru.id; siru.at = { ...siru.at, x: 2.375, z: 1.875 }; tray.slotId = 'free:' + tray.id; tray.at = { ...siru.at, x: 2.625, z: 1.875 };
  await boot(JSON.stringify(w)); }
await dlgOnly(); await page.eval(`(()=>{ try { window.__byeotSheet.close(); } catch (e) { void e; } return 1; })()`, false); await camStill(); await sleep(1500);
const hpose = () => J(`(()=>{ const h=document.getElementById('hint'); const t=document.querySelector('.hintTarget'); const hb=h.getBoundingClientRect(); const say=h.querySelector('.say').getBoundingClientRect();
  const chip=document.getElementById('questChip').getBoundingClientRect(); const tr=t?t.getBoundingClientRect():null;
  return { on: h.classList.contains('on'), cls: h.className, tid: t ? (t.id || t.dataset.slot || t.className) : null, say: [Math.round(say.left),Math.round(say.top),Math.round(say.right),Math.round(say.bottom)], chip: [Math.round(chip.left),Math.round(chip.top),Math.round(chip.right),Math.round(chip.bottom)], tr: tr ? [Math.round(tr.left),Math.round(tr.top),Math.round(tr.right),Math.round(tr.bottom)] : null }; })()`);
const ov = (a, b) => a && b && a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
let p1 = null; for (let i = 0; i < 8; i++) { p1 = await hpose(); if (p1 && p1.tid === 'navPlants') break; await sleep(400); }
await sleep(800); p1 = await hpose();
if (OUT) await page.shot(`${OUT}/390_c6c_nav_finger.png`);
console.log('  ㉳ [식물] 손가락', JSON.stringify(p1));
ok(!p1.탈 && p1.tid === 'navPlants' && /side/.test(p1.cls) && /toRight/.test(p1.cls) && !ov(p1.say, p1.chip) && p1.say[1] < p1.tr[3] && p1.say[3] > p1.tr[1], '㉳ 사진 c3_dark — [식물] 손가락이 옆(가로)에서 짚고 말풍선이 할 일 칩 · 다음 칸을 안 덮는다', JSON.stringify(p1));
await tapSel('#navPlants'); await sleep(1500); await tapSel('[data-plantwhere]'); await sleep(1500);
let p2 = null; for (let i = 0; i < 8; i++) { p2 = await hpose(); if (p2 && p2.on) break; await sleep(400); }
const rowsR = await J(`[...document.querySelectorAll('#slotList [data-slot]')].map(b=>{ const q=b.getBoundingClientRect(); const sm=(b.querySelector('small')||b).getBoundingClientRect(); return { s: b.dataset.slot, here: b.disabled, r: [Math.round(q.left),Math.round(q.top),Math.round(q.right),Math.round(q.bottom)], txt: [Math.round(sm.left),Math.round(sm.top),Math.round(sm.right),Math.round(sm.bottom)] }; })`);
if (OUT) await page.shot(`${OUT}/390_c6c_where_finger.png`);
console.log('  ㉳ 자리 줄 손가락', JSON.stringify({ p2, rowsR }));
const tgt = (rowsR || []).find(x => x.s === p2.tid), others = (rowsR || []).filter(x => x.s !== p2.tid);
ok(!p2.탈 && tgt && p2.say[1] >= tgt.r[1] - 2 && p2.say[3] <= tgt.r[3] + 2 && !others.some(o => ov(p2.say, o.txt)), '㉳ 사진 c3_where2 — 자리 창 말풍선이 짚는 줄 안에 서고 다른 줄 글(«지금 여기 있습니다 · …»)을 안 덮는다', JSON.stringify({ say: p2.say, tgt: tgt && tgt.r }));
await page.eval(`(()=>{ const c=document.getElementById('slotCancel'); if (c) c.click(); try { window.__byeotSheet.close(); } catch (e) { void e; } return 1; })()`, false); await sleep(1000);
/* c7_zero · c5_lamp — A100(체력 0): [다음 날] 말풍선이 바닥 단추 글을 안 덮는다 · 빛 분포 켠 채 알림은 범례 밑 */
await boot(saveA);
await dlgOnly(); await page.eval(`(()=>{ try { window.__byeotSheet.close(); } catch (e) { void e; } return 1; })()`, false); await camStill(); await sleep(1500);
const p3 = await J(`(()=>{ const h=document.getElementById('hint'); const say=h.querySelector('.say').getBoundingClientRect(); const t=document.querySelector('.hintTarget');
  const texts=['harvestCrop','waterCrop','waterPot','resow','sellSurplusBtn'].map(id=>document.getElementById(id)).filter(b=>b && b.style.display!=='none' && b.offsetParent).map(b=>{ const rg=document.createRange(); rg.selectNodeContents(b); const q=rg.getBoundingClientRect(); return { id: b.id, r: [Math.round(q.left),Math.round(q.top),Math.round(q.right),Math.round(q.bottom)] }; });
  return { on: h.classList.contains('on'), tid: t ? t.id : null, say: [Math.round(say.left),Math.round(say.top),Math.round(say.right),Math.round(say.bottom)], texts }; })()`);
if (OUT) await page.shot(`${OUT}/390_c6c_next_finger.png`);
console.log('  ㉳ [다음 날] 손가락', JSON.stringify(p3));
ok(!p3.탈 && (!p3.on || !p3.texts.some(x => ov(p3.say, x.r))), '㉳ 사진 c7_zero — 손가락 말풍선이 바닥 단추 글(«몬스테라는 아직 촉촉합니다» 등)을 안 덮는다', JSON.stringify(p3));
await page.eval(`(()=>{ window.__byeotSheet.open('plants'); return 1; })()`, false); await sleep(1200);
await tapSel('#lightHeat'); await sleep(2500); await dlgOnly();
const p4 = await J(`(async()=>{ window.__byeotBannerTest([{ title: '벽부형 식물등을 달았습니다', sub: '누르면 켜고 끌 수 있습니다' }]); await new Promise(r=>setTimeout(r, 600));
  const e=document.getElementById('event').getBoundingClientRect(); const cap=document.querySelector('.byeot-lightgrid > div'); const c=cap?cap.getBoundingClientRect():null;
  return { ev: [Math.round(e.left),Math.round(e.top),Math.round(e.right),Math.round(e.bottom)], cap: c ? [Math.round(c.left),Math.round(c.top),Math.round(c.right),Math.round(c.bottom)] : null }; })()`);
if (OUT) await page.shot(`${OUT}/390_c6c_banner_legend.png`);
console.log('  ㉳ 알림 · 범례', JSON.stringify(p4));
ok(!p4.탈 && p4.cap && !ov(p4.ev, p4.cap), '㉳ 사진 c5_lamp — 빛 분포가 켜진 동안 알림이 범례를 안 덮는다', JSON.stringify(p4));

/* ═══ ㉴ [plan] 18405b99 고침 둘 ═══ */
/* 하루 넘김(사람 손) — [다음 날] → 밥상 창 → 대사 · 사건 카드 · 가계부 */
const nextDay = async () => {
  const d0 = await J(`window.__S().day`);
  await page.eval(`(()=>{ try { window.__byeotSheet.close(); } catch (e) { void e; } const b=document.getElementById('next'); b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})); b.click(); return 1; })()`, false);
  for (let k = 0; k < 40; k++) {
    await sleep(700);
    const st = await J(`(()=>{ const pop=document.querySelector('.pop.on'); return { day: window.__S().day, talking: document.getElementById('stage').classList.contains('talking'), pop: pop ? pop.id : null }; })()`);
    if (st.탈) break;
    if (st.pop === 'mealPanel') { await page.eval(`(()=>{ const g=document.getElementById('mealGo'); if (g) g.click(); return 1; })()`, false); continue; }
    if (st.pop === 'evPanel') { await page.eval(`(()=>{ const b=document.querySelector('#evPanel .pbtns button:not([disabled])') || document.querySelector('#evPanel button:not([disabled])'); if (b) b.click(); return 1; })()`, false); continue; }
    if (st.pop) { await page.eval(`(()=>{ const p=document.querySelector('.pop.on'); const b=p && (p.querySelector('[id$="Close"]') || p.querySelector('button.ghost') || p.querySelector('button')); if (b) b.click(); return 1; })()`, false); continue; }
    if (st.talking) { await dlgOnly(); continue; }
    if (st.day > d0) { await sleep(600); const t2 = await J(`document.getElementById('stage').classList.contains('talking') || !!document.querySelector('.pop.on')`); if (!t2) break; }
  }
};
/* 1) C9 머리 — A100C9(세이브 손질: 씨앗 주문 줄을 안 끝낸 꼴 · 거둔 횟수 1) */
const mkC9 = (ready) => { const w = JSON.parse(saveA); const st = w.state; st.stamina.questsTaken = (st.stamina.questsTaken || []).filter(x => x !== 'order_seed');
  const pots = st.firstPlay.beansprout.pots; pots.forEach((p, i) => { p.harvestCount = i === 0 ? 1 : 0; });
  for (const v of Object.values(st.firstPlay.crops || {})) for (const p of ((v && v.pots) || [])) p.harvestCount = 0;
  if (ready) { const p = pots[1]; Object.assign(p, { sown: true, harvested: false, ageDays: 9, startedOnDay: st.day - 9 }); }
  else for (const p of pots) if (p.sown && !p.harvested && (p.ageDays || 0) >= 4) p.ageDays = 2;   /* 익은 · 내일 익을 시루 없음(자라는 중) */
  return JSON.stringify(w); };
const heads = () => J(`(async()=>{ const chip=(document.getElementById('questChipText')||{}).textContent||''; window.__byeotSheet.open('quest'); await new Promise(r=>setTimeout(r,900));
  const tab=(document.getElementById('questSubTab')||{}).textContent||''; const row=document.querySelector('#questListTab [data-qid="order_seed"]'); const rowTodo=row?((row.querySelector('.qtodo')||{}).textContent||''):null;
  window.__byeotSheet.open('bag'); await new Promise(r=>setTimeout(r,700)); const bag=(document.getElementById('questBackHint')||{}).textContent||'';
  window.__byeotSheet.close(); await new Promise(r=>setTimeout(r,500));
  return { chip, tab, rowTodo, bag, bagEl: !!document.getElementById('questBackHint') }; })()`);
await boot(mkC9(false));
await dlgOnly(); await page.eval(`(()=>{ try { window.__byeotSheet.close(); } catch (e) { void e; } return 1; })()`, false); await sleep(1500);
const h9 = await heads();
console.log('  ㉴ C9 머리', JSON.stringify(h9));
const PROG = /^거둔 횟수 1\/3 — (씨앗이 오는 중|시루가 익는 중)$/;
ok(!h9.탈 && PROG.test(h9.rowTodo || ''), '㉴ C9 판 줄 «거둔 횟수 1/3 — …»(«기다리는 중 —» 아님)', JSON.stringify(h9.rowTodo));
/* ⚠ [가방] 할 일 단추(#questBack · #questBackHint)는 지금 화면에 없다(그리는 코드만 남음 · 요소 없음) — 있으면 같은 글인지 본다 */
ok(!h9.탈 && (!PROG.test(h9.chip) || (h9.tab === h9.chip && (!h9.bagEl || h9.bag === h9.chip))), '㉴ [plan] 18405b99 — 칩이 진행 줄이면 할 일 탭 머리(· [가방] 단추 밑이 있으면 그것도)가 그 글 그대로(«지금 할 것 —» 없음)', JSON.stringify(h9));
ok(!h9.탈 && !/^지금 할 것 — 씨앗을 주문한다$/.test(h9.tab), '㉴ 할 일 탭 머리가 진행 줄 판에 «지금 할 것 — 씨앗을 주문한다»가 아님', h9.tab);
await boot(mkC9(true));
await dlgOnly(); await page.eval(`(()=>{ try { window.__byeotSheet.close(); } catch (e) { void e; } return 1; })()`, false); await sleep(1500);
const h9r = await heads();
console.log('  ㉴ C9 익은 시루', JSON.stringify(h9r));
ok(!h9r.탈 && h9r.rowTodo === '익은 시루부터 거두세요', '㉴ 익은 시루 판은 그대로 «익은 시루부터 거두세요»', JSON.stringify(h9r));
/* 2) «가장 밝은 칸» 자 — 등 단 원룸(6판 S 꼴 · S97z 손질)에서 [다음 날]을 넘기며 내일 흐림 · 비인 날 · 고른 칸 = 보통 날 가장 밝은 칸 */
{ const w = JSON.parse(fs.readFileSync(SAVE_S, 'utf8')); const st = w.state; const fp = st.firstPlay; const all = [...fp.beansprout.pots, ...Object.values(fp.crops).flatMap(v => (v && v.pots) || [])];
  const pot = st.pots[0], siru = all.find(x => x.slotId === 'banjiha-desk:0'), tray = all.find(x => x.slotId === 'oneroom-sill:0');
  pot.slotId = siru.slotId; pot.at = { ...siru.at }; siru.slotId = 'free:' + siru.id; siru.at = { ...siru.at, x: 2.375, z: 1.875 }; tray.slotId = 'free:' + tray.id; tray.at = { ...siru.at, x: 2.625, z: 1.875 };
  await boot(JSON.stringify(w)); }
await dlgOnly(); await page.eval(`(()=>{ try { window.__byeotSheet.close(); } catch (e) { void e; } return 1; })()`, false); await sleep(1500);
const gtrail = []; let diverge = null;
for (let i = 0; i < 12; i++) {
  const g = await J(`window.__byeotGuideBright ? window.__byeotGuideBright() : { 없음: true }`);
  const w2 = await J(`(()=>{ const S=window.__S(); const p=(S.pots||[])[0]; return { warn: window.__byeotDarkWarn && p ? window.__byeotDarkWarn(p.id) : null, pd: window.__byeotPotDark ? window.__byeotPotDark() : null, lamps: S.lamps && S.lamps.count }; })()`);
  gtrail.push({ ...g, ...w2 });
  if (g && !g.탈 && /cloud|rain|overcast|흐|비/.test(String(g.weather)) && g.growBest !== g.dailyBest) { diverge = gtrail[gtrail.length - 1]; break; }
  await nextDay();
}
console.log('  ㉴ 가장 밝은 칸 날마다', JSON.stringify(gtrail.map(x => ({ day: x.day, w: x.weather, guide: x.guide, grow: x.growBest, daily: x.dailyBest, lamps: x.lamps }))));
console.log('  ㉴ 갈린 판', JSON.stringify(diverge));
ok(gtrail.length > 0 && gtrail.every(x => !x.탈 && x.guide === x.growBest), '㉴ [plan] 18405b99 — «가장 밝은 칸»(guideBrightSlot)은 날마다 보통 날(growBandAt) 가장 밝은 칸', JSON.stringify(gtrail.map(x => [x.day, x.weather, x.guide, x.growBest, x.dailyBest])));
if (!diverge) console.log('  ㉴ 내일 흐림 · 비이면서 두 자가 갈린 판: 못 찾음(12일 · 등 ' + (gtrail[0] && gtrail[0].lamps) + '개)');

try { await page.close(); } catch (e) { console.log('  (탭 닫기 탈)', e.message); }
ok(exc.length === 0, '처리 안 된 예외 0', JSON.stringify(exc.slice(0, 5)));
console.log(bad ? `probe_critic6_c: 빨강 ${bad}` : 'probe_critic6_c: 다 통과');
process.exit(bad ? 1 : 0);
