/* 비판 8판 8C2 · 8C3 자(core 11-03 · 총괄 가름 · [plan] plan-to-core-critic8 §2) — 계약 뒤 엔딩 그림을 시트가 덮지 않음 · 자금 모인 날 칩 · 손가락이 [내 집 마련하기]
   ⛔ 비판 8판 MAJOR #2(A_011~013): [계약한다] 뒤 열려 있던 할 일 시트가 엔딩 그림 아래 2/3를 덮은 채 8초 넘게 그대로(시트 밖을 눌러야 대사 시작)
   ⛔ 비판 8판 MAJOR #3(A_001 · 005 · 008 · 009): Day 445 몬이 «집 계약은 네가 해» 뒤 손가락은 채소 팔기 → 물 → [방] · 칩은 «분홍이 섞인 마디 위에서 잘라 보세요»
   판: 비판 8판 ready 세이브(C:/Users/pc/AppData/Local/Temp/byeot-critic8/saves/ready_d445.json · Day 445 · 원룸 · 현금 5,063,924 · 프로필 안 건드림) — 손질: 작물은 다 자라는 중(돌봄 손가락 없음)
   단언
     ㉮ 8C3 — 할 일 칩 몸 «🏠 자금이 모였습니다 — 내 집을 계약하세요» · 손가락 기둥 [할 일] «내 집을 계약하러 갑니다» → 그 기둥이 연 할 일 창의 [내 집 마련하기] «누르면 계약 전에 한 번 더 묻습니다» → 누르면 계약 창(할 일 창은 닫힘)
     ㉯ 8C2 — [계약한다]를 누르면 시트가 닫히고 엔딩 그림이 선다(시트 밖을 안 눌러도 대사가 섬)
     ㉰ 계약 뒤 — 칩이 자금 글 아님
     ㉱ 자금이 목표에 1원 모자란 판 — 칩 · 손가락이 계약을 안 말함 · 예외 0 · J 단언엔 !탈
     ㉲ 칩을 말풍선 자리로 옮겨 — (가) 할 일 창(.pop.on) 밑이면 안 센다(말풍선 그대로) · (나) 창이 아닌 판 밑이면 전처럼 비킨다(fm47 c2211624+p31 빨강 → 고친 판 초록) */
import fs from 'node:fs';
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9451', OUT = process.env.OUT || null;
const SAVE = process.env.SAVE || 'C:/Users/pc/AppData/Local/Temp/byeot-critic8/saves/ready_d445.json';
if (OUT) fs.mkdirSync(OUT, { recursive: true });
let bad = 0; const ok = (c, m, d = '') => { console.log(`${c ? '  OK' : 'FAIL'}  ${m}${d ? '  → ' + d : ''}`); if (!c) bad++; };
if (!fs.existsSync(SAVE)) { ok(false, '세이브 없음', SAVE); process.exit(1); }
const CHIP = '🏠 자금이 모였습니다 — 내 집을 계약하세요', DOOR = '내 집을 계약하러 갑니다', BTN = '누르면 계약 전에 한 번 더 묻습니다';
const stage = (shortBy = 0) => { const w = JSON.parse(fs.readFileSync(SAVE, 'utf8')); const s = w.state;
  for (const p of s.firstPlay.beansprout.pots) if (p.slotId) Object.assign(p, { sown: true, harvested: false, ageDays: 1, startedOnDay: s.day - 1, idleSinceDay: s.day - 1 });
  for (const v of Object.values(s.firstPlay.crops || {})) for (const p of ((v && v.pots) || [])) if (p.slotId) Object.assign(p, { sown: true, harvested: false, ageDays: 1, startedOnDay: s.day - 1, idleSinceDay: s.day - 1 });
  if (shortBy) s.tutorial.cashWon = 5000000 - shortBy;
  return JSON.stringify(w); };
const exc = [];
const page = await launch({ width: 390, height: 844, dpr: 2 });
page.on((method, p) => { if (method === 'Runtime.exceptionThrown') exc.push(((p.exceptionDetails.exception && p.exceptionDetails.exception.description) || p.exceptionDetails.text || '').split('\n')[0].slice(0, 200)); });
await page.send('Runtime.enable');
await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true;` });
const J = async (js) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, 120000));
const dlg = async () => { for (let i = 0; i < 120; i++) { const t = await J(`document.getElementById('stage').classList.contains('talking')`); if (t !== true) break; await page.eval(`(()=>{ const b=document.getElementById('dlgBox'); if(b) b.click(); return 1; })()`, false); await sleep(250); } };
const bannerOff = async () => { for (let i = 0; i < 20; i++) { const on = await J(`document.getElementById('event').classList.contains('on')`); if (on !== true) return; await J(`(()=>{ document.getElementById('event').click(); return 1; })()`); await sleep(400); } };
const boot = async (txt) => {
  await page.goto(`${BASE}/data/balance/homes.json`);
  await page.eval(`(()=>{ localStorage.clear(); localStorage.setItem('byeot/save/1', ${JSON.stringify(txt)}); localStorage.setItem('byeot.guideSeen','1'); return 1; })()`, false);
  await page.goto(`${BASE}/game.html`); await page.waitFor('window.__byeotBooted === true', 300000, 500); await page.waitFor('!!window.__rv', 240000, 500); await sleep(3500);
  await dlg(); await J(`(()=>{ try { window.__byeotSheet.close(); } catch (e) { void e; } return 1; })()`); await sleep(1200); await bannerOff();
  let n = 0; for (let i = 0; i < 60 && n < 2; i++) { const b = await J(`(()=>{ try { return !!window.__rv.camBusy(); } catch (e) { return false; } })()`); n = b === false ? n + 1 : 0; await sleep(200); }
};
const H = `(async()=>{ try { window.__byeotHint(); } catch (e) { void e; } await new Promise(r=>setTimeout(r,900)); const h=document.getElementById('hint'), t=document.querySelector('.hintTarget');
  const rr=q=>q&&q.width?[Math.round(q.left),Math.round(q.top),Math.round(q.right),Math.round(q.bottom)]:null; const sayEl=h.querySelector('.say');
  /* 할 일 창 글(제목 · 머리 · 줄 이름)의 글자 네모 — 말풍선이 덮나 */
  const texts=[...document.querySelectorAll('#questPanel.on .ptitle, #questPanel.on #questSub, #questPanel.on #questHome, #questPanel.on #questList .qko, #questPanel.on #questList .qrew, #questPanel.on #questList .qwhy')].map(e=>{ const rg=document.createRange(); rg.selectNodeContents(e); return rr(rg.getBoundingClientRect()); }).filter(Boolean);
  return { chip: (document.getElementById('questChipText')||{}).textContent || '', on: h.classList.contains('on'), tid: t ? (t.id || (t.dataset && t.dataset.act) || null) : null, say: (sayEl||{}).textContent,
    sayR: rr(sayEl.getBoundingClientRect()), texts, panel: document.getElementById('homePanel').classList.contains('on') }; })()`;
const ovr = (a, b) => !!a && !!b && a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
/* ★ 11-03 core(regs13 ㉯-b 빨강 — sheet 닫힘(open 없음)인데 위 끝 264 · 내려가는 움직임이 헤드리스 프레임 멈춤에 걸림 · 8C2 자리는 이 판에서 안 건드림)
     ⇒ [계약한다] 뒤 시트 위 끝이 내려갈 때까지 최대 4초 동안 0.3초마다 10×10 찍기로 프레임을 밀며 다시 잰다(critic6_e ㉮ 와 같은 손) · 끝내 안 내려가면 빨강 그대로 · tries 적음 */
const AFTER_GO = `(()=>({ sheet: document.getElementById('sheet').classList.contains('open'), sheetTop: Math.round(document.getElementById('sheet').getBoundingClientRect().top), scene: document.getElementById('homeScene').classList.contains('on'), talking: document.getElementById('stage').classList.contains('talking') }))()`;
const afterGo = async () => { let q = null, tries = 0; const t0 = Date.now();
  for (; tries < 14; tries++) { q = await J(AFTER_GO); if (!q || q.탈 || q.sheet || q.sheetTop >= 800 || Date.now() - t0 > 4000) break;
    await page.send('Page.captureScreenshot', { format: 'jpeg', quality: 10, clip: { x: 0, y: 0, width: 10, height: 10, scale: 1 } }); await sleep(300); }
  if (q && !q.탈) q.tries = tries; return q; };
/* ㉲(총괄 11-03 · 회귀 빨강 critic6_e ㉮ · hint_chip #8 대조에서 나옴) — 칩을 말풍선 자리로 옮겨 «덮인 칩»을 가른다(칩 · 덮개는 끝에 되돌린다)
     (가) 칩이 할 일 창(.pop.on) 밑이면 안 센다 — 말풍선이 그 자리에 그대로 있어도 된다(8C3 · 깔린 칩에 막혀 말풍선이 첫 줄 이름을 덮었다)
     (나) 칩이 창이 아닌 다른 판(배너 #event 꼴) 밑이면 전처럼 센다 — 말풍선이 비킨다 · fm47(c2211624+p31 «그 점에서 칩이 잡힐 때만»)에서 빨강 */
const CHIPMOVE = (cover) => `(async()=>{ const c=document.getElementById('questChip'), s=document.querySelector('#hint .say'); const h0=s.getBoundingClientRect();
  const rr=q=>[Math.round(q.left),Math.round(q.top),Math.round(q.right),Math.round(q.bottom)];
  c.dataset.probeStyle = c.getAttribute('style') || ''; Object.assign(c.style, { position:'fixed', left:h0.left+'px', top:h0.top+'px', right:'auto', width:h0.width+'px', height:h0.height+'px', minWidth:'0', maxWidth:'none', overflow:'hidden', boxSizing:'border-box' });
  if (${cover ? 'true' : 'false'}) { const d=document.createElement('div'); d.id='probeCover'; Object.assign(d.style, { position:'fixed', left:(h0.left-4)+'px', top:(h0.top-4)+'px', width:(h0.width+8)+'px', height:(h0.height+8)+'px', zIndex:'60', background:'rgba(40,40,60,.55)', pointerEvents:'auto' }); document.body.appendChild(d); }
  const q=c.getBoundingClientRect(); const at=document.elementFromPoint(q.left+q.width/2, q.top+q.height/2);
  try { window.__byeotHint(); } catch (e) { void e; } await new Promise(r=>setTimeout(r,900));
  const h1=s.getBoundingClientRect(); const ox=Math.max(0,Math.min(h1.right,q.right)-Math.max(h1.left,q.left)), oy=Math.max(0,Math.min(h1.bottom,q.bottom)-Math.max(h1.top,q.top));
  return { before: rr(h0), after: rr(h1), chip: rr(q), under: at ? (at.id || ((at.closest && at.closest('[id]')) || {}).id || at.tagName) : null, inPop: !!(at && at.closest && at.closest('.pop.on')), atChip: !!(at && (at === c || c.contains(at))),
    overlapPct: Math.round(100*ox*oy/Math.max(1,q.width*q.height)), on: document.getElementById('hint').classList.contains('on'), say: s.textContent }; })()`;
const CHIPBACK = `(async()=>{ const c=document.getElementById('questChip'); c.setAttribute('style', c.dataset.probeStyle||''); const d=document.getElementById('probeCover'); if (d) d.remove(); try { window.__byeotHint(); } catch (e) { void e; } await new Promise(r=>setTimeout(r,900)); return 1; })()`;
const same = (p, q) => Array.isArray(p) && Array.isArray(q) && p.every((v, i) => Math.abs(v - q[i]) <= 2);
/* ═══ ㉮ ═══ */
await boot(stage(0));
const a = await J(H);
console.log('  ㉮ 처음', JSON.stringify(a));
if (OUT) await page.shot(`${OUT}/390_c8b_ready.png`);
ok(!a.탈 && a.chip === CHIP, `㉮ 할 일 칩 몸 «${CHIP}»`, JSON.stringify(a.chip));
ok(!a.탈 && a.on && a.tid === 'navQuest' && a.say === DOOR, `㉮ 손가락 기둥 [할 일] «${DOOR}»`, JSON.stringify({ tid: a.tid, say: a.say }));
{ const n = await J(CHIPMOVE(true));
  console.log('  ㉲(나) 칩을 말풍선 자리 · 다른 판 밑', JSON.stringify(n));
  if (OUT) await page.shot(`${OUT}/390_c8b_chip_cover.png`);
  ok(!n.탈 && n.under === 'probeCover' && !n.inPop && !n.atChip, '㉲(나) 판 — 옮긴 칩 가운데에 잡히는 것이 창이 아닌 덮개', JSON.stringify({ under: n.under, inPop: n.inPop }));
  ok(!n.탈 && n.on && n.say === DOOR && n.overlapPct === 0, '㉲(나) 칩이 창이 아닌 판(배너 꼴) 밑이면 전처럼 비킨다 — 말풍선이 칩 자리를 안 덮는다', JSON.stringify({ before: n.before, after: n.after, chip: n.chip, overlapPct: n.overlapPct }));
  await J(CHIPBACK); }
await J(`(()=>{ document.getElementById('navQuest').click(); return 1; })()`); await sleep(1600);
const b = await J(H);
console.log('  ㉮ 할 일 탭', JSON.stringify(b));
if (OUT) await page.shot(`${OUT}/390_c8b_tab.png`);
ok(!b.탈 && b.on && b.tid === 'homeAsk' && b.say === BTN, `㉮ 기둥 [할 일]이 연 할 일 창 — 손가락 [내 집 마련하기] «${BTN}»`, JSON.stringify({ tid: b.tid, say: b.say }));
ok(!b.탈 && Array.isArray(b.texts) && b.texts.length > 0 && !b.texts.some(q => ovr(b.sayR, q)), '㉮ 그 말풍선이 할 일 창 글(머리 · 첫 줄 이름)을 안 덮는다', JSON.stringify({ say: b.sayR, hits: (b.texts || []).filter(q => ovr(b.sayR, q)) }));
{ const g = await J(CHIPMOVE(false));
  console.log('  ㉲(가) 칩을 말풍선 자리 · 할 일 창 밑', JSON.stringify(g));
  if (OUT) await page.shot(`${OUT}/390_c8b_chip_pop.png`);
  ok(!g.탈 && g.inPop && !g.atChip, '㉲(가) 판 — 옮긴 칩 가운데에 잡히는 것이 할 일 창(.pop.on)', JSON.stringify({ under: g.under, inPop: g.inPop }));
  ok(!g.탈 && g.on && g.say === BTN && same(g.before, g.after), '㉲(가) 칩이 할 일 창 밑이면 안 센다 — 말풍선이 그 자리 그대로', JSON.stringify({ before: g.before, after: g.after, chip: g.chip }));
  await J(CHIPBACK); }
await J(`(()=>{ const x=[...document.querySelectorAll('[data-act="homeAsk"]')].find(e=>!e.disabled && e.offsetParent); if (x) x.click(); return !!x; })()`); await sleep(1200);
const c = await J(`(()=>({ panel: document.getElementById('homePanel').classList.contains('on'), quest: document.getElementById('questPanel').classList.contains('on'), sheet: document.getElementById('sheet').classList.contains('open') }))()`);
ok(!c.탈 && c.panel && !c.quest, '㉮ [내 집 마련하기]를 누르면 계약 창(할 일 창은 닫힘)', JSON.stringify(c));
/* ═══ ㉯ 8C2 ═══ */
await J(`(()=>{ document.getElementById('homeGo').click(); return 1; })()`); await sleep(900);
const d = await afterGo();
console.log('  ㉯ [계약한다] 뒤', JSON.stringify(c), JSON.stringify(d));
if (OUT) await page.shot(`${OUT}/390_c8b_scene.png`);
ok(!d.탈 && !d.sheet && d.sheetTop >= 800 && d.scene && d.talking, '㉯ [계약한다] 뒤 — 시트가 닫히고 엔딩 그림 · 대사가 섬(시트 밖을 안 눌러도)', JSON.stringify({ before: c, after: d }));
await dlg(); await sleep(800);
await J(`(()=>{ const b=document.getElementById('homeNext'); if (b && b.offsetParent) b.click(); return 1; })()`); await sleep(2500); await dlg();
await J(`(()=>{ document.getElementById('chapterLook').click(); return 1; })()`); await sleep(1500); await dlg(); await bannerOff();
const e = await J(H);
console.log('  ㉰ 계약 뒤', JSON.stringify(e));
ok(!e.탈 && e.chip !== CHIP && !(e.on && (e.say === DOOR || e.say === BTN)), '㉰ 계약 뒤 — 칩 · 손가락이 자금 · 계약을 안 말함', JSON.stringify({ chip: e.chip, tid: e.tid, say: e.say }));
/* ═══ ㉯-b 8C2 — 비판 판 길 그대로: 시트 [할 일] 탭 머리의 [내 집 마련하기] → [계약한다] — 그 시트가 엔딩 그림을 덮지 않는다 ═══ */
await boot(stage(0));
await J(`(()=>{ window.__byeotSheet.open('quest'); return 1; })()`); await sleep(1500);
const sb = await J(`(()=>{ const x=[...document.querySelectorAll('#pageQuest [data-act="homeAsk"]')].find(e=>!e.disabled && e.offsetParent); if (x) x.click(); return { 누름: !!x, sheet: document.getElementById('sheet').classList.contains('open') }; })()`); await sleep(1200);
await J(`(()=>{ document.getElementById('homeGo').click(); return 1; })()`); await sleep(900);
const g = await afterGo();
console.log('  ㉯-b 시트 탭 길', JSON.stringify({ sb, g }));
if (OUT) await page.shot(`${OUT}/390_c8b_scene_sheet.png`);
ok(!g.탈 && sb.누름 && sb.sheet && !g.sheet && g.sheetTop >= 800 && g.scene && g.talking, '㉯-b 시트 [할 일] 탭에서 계약 → [계약한다] 뒤 시트가 닫히고 엔딩 그림 · 대사(비판 A_011~013 길)', JSON.stringify({ sb, g }));
await dlg();
/* ═══ ㉱ 1원 모자람 ═══ */
await boot(stage(1));
const f = await J(H);
console.log('  ㉱ 1원 모자람', JSON.stringify(f));
ok(!f.탈 && f.chip !== CHIP && !(f.on && (f.say === DOOR || f.say === BTN)), '㉱ 자금이 1원 모자라면 칩 · 손가락이 계약을 안 말함', JSON.stringify({ chip: f.chip, tid: f.tid, say: f.say }));
ok(exc.length === 0, '처리 안 된 예외 0', exc.slice(0, 3).join(' / '));
try { await page.close(); } catch (e2) { console.log('  (탭 닫기 탈)', e2.message); }
console.log(bad ? `probe_critic8_b: 빨강 ${bad}` : 'probe_critic8_b: 다 통과');
process.exit(bad ? 1 : 0);
