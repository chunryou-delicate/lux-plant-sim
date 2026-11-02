/* 비판 6판 넷째 묶음 자(core 11-02 · 총괄 · [plan] f373262a 대조 §16 6a69e18a) — 390(범례는 360 도)
   판: 비판 6판 A100 세이브(C:/Users/pc/byeot-core-keep/critic6/ · 프로필은 안 건드림) — 손질은 줄마다 적음
   ㉮ P6 반찬가게(§16 ④ · 총괄 잣대 «묶음 단추 = 손으로 하나씩 한 것과 같은 결과» · 글은 [plan] §17 6efb5c8f 세 길 한 글) — «6판 Day 90 꼴» 손질:
        neighborOrderDay 없음 · 오늘 꾸러미는 어제로 · 체력 가득 · 콩나물 시루 셋 익힘 · 반찬가게 대사는 «본 대사»에서 뺌(6판 A 는 Day 90 에 들었다)
      하나씩(식물 판 줄 [거두기] 셋) · 묶음(바닥 [거두기] 한 번) — 가져간 꾸러미 · 남은 오늘 꾸러미 · 배너 · 대사 첫 줄(서는 때)을 적는다
      단언: 둘의 끝 판이 같다(돈 +200,000 · 오늘 꾸러미 2 남음) · 배너 둘째 줄 «+200,000원 · 오늘 거둔 1판» + «나머지는 그대로 있습니다»(전 꾸러미가 남음 · §17)
        ⛔ f373262a 는 꾸러미에 없는 g 칸으로 세어 늘 «+200,000원»만 섰다
      §17: 배너 «🧺 반찬가게에 채소를 팔았습니다» / «+200,000원 · 오늘 거둔 1판»<br>«나머지는 그대로 있습니다» · 대사 첫 줄 «아랫길 반찬가게 사장님이 우리 채소를 사 가셨다.» ·
        [방] 기록 «🧺 반찬가게에 채소를 팔았습니다 — 오늘 거둔 1판 · +200,000원» — 하나씩 · 묶음 같은 넷 · 보유 채소 0 판은 «나머지» 줄 없음 · 결산 길 손잡이 «가장 최근에 거둔 2판»
   ㉲ 배너 상자 폭(총괄) — 360 · 390 · 430 에서 반찬가게 · 이사 · 체력 · 쌓인 둘: 탭 기둥 · [?] · 보이는 할 일 칩과 겹침 0 · 한 줄에 드는 «📦 원룸으로 이사했습니다»는 한 줄 · 제목 줄 수를 적음
        · 바닥 체력 줄(#staText)이 낱말 안에서 안 꺾임(총괄 사진 430 «최 / 대») · ㉮ 묶음 판의 쌓인 배너도 [?] · 탭 기둥과 안 겹침(총괄 사진 390_c6e_p6_batch)
        ⛔ `left:50%` 뒤 남은 폭(화면 반 · 390 에서 194 css)에 묶여 제목이 거의 다 두세 줄
   ㉯ P8(§16 ① ②) — 이사 창(이사비 손질 · probe_critic6_c ㉱ 와 같은 손): 시루 하나를 [회수]한 꼴(slotId · at = null)에서도 «시루 n개» = 콩나물 줄 + 시루 재고
        ⛔ 예전 «시루 17개»(실제 16 · 회수한 것을 두 번) · «두고 가는 것 — 벽 · 창 · 천장에 붙은 가구 2개»
   ㉰ P10(§16 ③) — 빛 범례 넷째 줄 «어둠 0.3까지 · 밝음 2.7부터 · 아주 밝음 6부터» · 다섯째 줄 «칸의 수는 하루 빛 양(DLI)» · 두 줄 다 한 줄 상자(낱말 안 꺾임 0) — 360 · 390
   ㉳ 판매 창 체크 글(총괄 사진 390_c6c_c12_popup) — «다음부터 묻지 않고 바로 팔기»가 390 · 430 에서 한 줄(전역 label>span 78px 기둥에서 꺾이던 것) · 360 은 적음
   ㉱ 사진 next_finger(§16 ⑤) — A100(체력 0) [다음 날] 말풍선 · 손이 빨간 체력 줄(#staText)과 바닥 왼쪽 단추 글을 안 덮고 손은 [다음 날]에 닿는다
   예외 0 · J 단언엔 !탈 */
import fs from 'node:fs';
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9451', OUT = process.env.OUT || null;
const SAVE_A = process.env.SAVE_A || 'C:/Users/pc/byeot-core-keep/critic6/saveA_d100.json';
if (OUT) fs.mkdirSync(OUT, { recursive: true });
let bad = 0; const ok = (c, m, d = '') => { console.log(`${c ? '  OK' : 'FAIL'}  ${m}${d ? '  → ' + d : ''}`); if (!c) bad++; };
if (!fs.existsSync(SAVE_A)) { ok(false, '세이브 없음', SAVE_A); process.exit(1); }
const saveA = fs.readFileSync(SAVE_A, 'utf8');
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
  };
  const dlgLines = async () => { const out = []; for (let i = 0; i < 80; i++) {
    const t = await J(`(()=>({ talking: document.getElementById('stage').classList.contains('talking'), txt: (document.getElementById('dlgText')||{}).textContent||'' }))()`);
    if (t.탈 || !t.talking) break; if (t.txt && out[out.length - 1] !== t.txt) out.push(t.txt);
    await page.eval(`(()=>{ const b=document.getElementById('dlgBox'); if(b) b.click(); return 1; })()`, false); await sleep(300); } return out; };
  const camStill = async () => { let n = 0; for (let i = 0; i < 60 && n < 2; i++) { const b = await J(`(()=>{ try { return !!window.__rv.camBusy(); } catch (e) { return false; } })()`); n = b === false ? n + 1 : 0; await sleep(200); } };
  return { page, J, boot, dlgLines, camStill };
};

/* ═══ ㉮ P6 ═══ */
{
  const RIPE = ['crop_01_03', 'crop_01_04', 'crop_01_05'];
  const w = JSON.parse(saveA); const s = w.state;
  s.tutorial.neighborOrderDay = null; s.stamina.left = s.stamina.max;
  if (s.talk) for (const k of ['seen', 'recent']) if (Array.isArray(s.talk[k])) s.talk[k] = s.talk[k].filter(x => x !== 'neighborOrder');
  for (const l of s.firstPlay.food.pantryLots) if (l.day === s.day) l.day = s.day - 1;
  for (const p of s.firstPlay.beansprout.pots) if (RIPE.includes(p.id)) { p.ageDays = 6; p.startedOnDay = s.day - 6; p.sown = true; p.harvested = false; }
  const staged = JSON.stringify(w);
  const { page, J, boot, dlgLines } = await open(390);
  const snap = () => J(`(()=>{ const S=window.__S(); const lots=(S.firstPlay.food.pantryLots||[]); return { nod: S.tutorial.neighborOrderDay, cash: S.tutorial.cashWon,
    todayLots: lots.filter(l=>l.day===S.day).length, lots: lots.length,
    banners: [...document.querySelectorAll('#event > *')].map(e=>({ t: ((e.firstChild && e.firstChild.nodeType===3) ? e.firstChild.textContent : '').trim(), sub: ((e.querySelector('i')||{}).innerHTML||''), all: (e.textContent||'').replace(/\\s+/g,' ').trim() })).slice(0,6),
    log: ((S.log||[]).filter(x=>/반찬가게/.test(x.msg||'')).pop()||{}).msg || null }; })()`);
  const waitHarvested = async (ids) => { for (let i = 0; i < 60; i++) { const r = await J(`(()=>{ const S=window.__S(); return ${JSON.stringify(ids)}.every(id => (S.firstPlay.beansprout.pots.find(p=>p.id===id)||{}).harvested); })()`); if (r === true) break; await sleep(400); }
    for (let i = 0; i < 20; i++) { const t = await J(`document.getElementById('stage').classList.contains('talking')`); if (t === true) return true; await sleep(200); } return false; };
  const NB = /🧺 반찬가게에 채소를 팔았습니다/;
  /* 하나씩 */
  await boot(staged); await dlgLines();
  const one0 = await snap(); const oneSteps = [];
  for (const id of RIPE) {
    await page.eval(`(()=>{ try { window.__byeotSheet.open('plants'); } catch (e) { void e; } return 1; })()`, false); await sleep(1200);
    const hit = await J(`(()=>{ const b=document.querySelector('#siruList button[data-siru="${id}"][data-act="harvest"]'); if (!b) return false; b.click(); return true; })()`);
    const talk = await waitHarvested([id]); const sn = await snap(); const lines = await dlgLines();
    await sleep(1500);   /* 대사 뒤 손가락이 다시 서기를(기둥 [식물] «한 번 더 누르면 닫힙니다») */
    const hob = await J(`(()=>{ const h=document.getElementById('hint'), ev=document.getElementById('event'); if (!h.classList.contains('on') || !ev.classList.contains('on')) return { both: false };
      const rg=document.createRange(); rg.selectNodeContents(h.querySelector('.hand')); const q=rg.getBoundingClientRect(), b=ev.getBoundingClientRect();
      const a=Math.max(0,Math.min(q.right,b.right)-Math.max(q.left,b.left))*Math.max(0,Math.min(q.bottom,b.bottom)-Math.max(q.top,b.top));
      return { both: true, a: Math.round(a), hand: [Math.round(q.left),Math.round(q.top),Math.round(q.right),Math.round(q.bottom)], ev: [Math.round(b.left),Math.round(b.top),Math.round(b.right),Math.round(b.bottom)], say: (h.querySelector('.say')||{}).textContent, cls: h.className }; })()`);
    const nbb = sn.banners.find(b => NB.test(b.all)) || {};
    oneSteps.push({ id, hit, talk, nod: sn.nod, cash: sn.cash, todayLots: sn.todayLots, lots: sn.lots, nb: nbb.all || null, nbT: nbb.t || null, nbSub: nbb.sub || null, log: sn.log, 대사: lines[0] || null, hob });
    if (OUT && id === RIPE[0]) await page.shot(`${OUT}/390_c6e_p6_one.png`);
    await page.eval(`(()=>{ try { window.__byeotSheet.close(); } catch (e) { void e; } return 1; })()`, false); await sleep(800);
  }
  console.log('  ㉮ P6 하나씩', JSON.stringify({ 전: { nod: one0.nod, cash: one0.cash, todayLots: one0.todayLots, lots: one0.lots }, 걸음: oneSteps }));
  /* 묶음 */
  await boot(staged); await dlgLines();
  const bat0 = await snap();
  const bt = await J(`(()=>{ const b=document.getElementById('harvestCrop'); if (!b || b.style.display==='none') return null; const t=(b.textContent||'').trim(); b.click(); return t; })()`);
  const btalk = await waitHarvested(RIPE); const bat1 = await snap();
  /* ★ 11-02 총괄 사진 — 배너 둘 쌓인 판의 상자 · [?](쪽지 동안 숨어 있으면 잠깐 켜서 자리만) · 탭 기둥 */
  const stackGeo = await J(`(()=>{ const R=q=>[Math.round(q.left),Math.round(q.top),Math.round(q.right),Math.round(q.bottom)]; const ev=document.getElementById('event'); const box=ev.getBoundingClientRect();
    const g=document.getElementById('guideOpen'); let gq=g.getBoundingClientRect(); const gHidden=getComputedStyle(g).display==='none'; if (gHidden) { const w=g.style.display; g.style.display='block'; gq=g.getBoundingClientRect(); g.style.display=w; }
    const nq=document.getElementById('navbar').getBoundingClientRect(); const area=(a,b)=>Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
    return { n: ev.querySelectorAll(':scope > b').length, box: R(box), guide: R(gq), gHidden, coaching: document.getElementById('stage').classList.contains('coaching'), hitGuide: Math.round(area(box,gq)), hitNav: Math.round(area(box,nq)) }; })()`);
  console.log('  ㉮ P6 묶음 쌓인 배너', JSON.stringify(stackGeo));
  ok(!stackGeo.탈 && stackGeo.n >= 2 && stackGeo.hitGuide <= 4 && stackGeo.hitNav <= 4, '㉮ 쌓인 배너(반찬가게 + 거둠) 상자가 [?] · 탭 기둥과 안 겹친다(총괄 사진 390_c6e_p6_batch)', JSON.stringify(stackGeo));
  const blines = await dlgLines();
  if (OUT) await page.shot(`${OUT}/390_c6e_p6_batch.png`);
  const batB = bat1.banners.find(b => NB.test(b.all)) || {}; const batNb = batB.all || null;
  console.log('  ㉮ P6 묶음', JSON.stringify({ 전: { nod: bat0.nod, cash: bat0.cash, todayLots: bat0.todayLots, lots: bat0.lots }, 단추: bt, talk: btalk, nod: bat1.nod, cash: bat1.cash, todayLots: bat1.todayLots, lots: bat1.lots, 배너: bat1.banners.map(b => b.all), 대사: blines[0] || null }));
  const oneEnd = oneSteps[oneSteps.length - 1] || {};
  const firstNb = oneSteps[0] && oneSteps[0].nb;
  ok(!one0.탈 && oneSteps.length === 3 && oneSteps.every(x => x.hit === true) && oneSteps[0].nod === 100 && oneSteps[0].todayLots === 0 && oneSteps[0].대사 === '아랫길 반찬가게 사장님이 우리 채소를 사 가셨다.',
     '㉮ 하나씩 — 첫 [거두기]에 반찬가게가 그날 거둔 것(첫 그릇 몫)을 사 가고 대사가 그 자리에서 선다', JSON.stringify(oneSteps[0]));
  ok(!bat1.탈 && bt && bat1.nod === 100 && bat1.cash - bat0.cash === oneEnd.cash - one0.cash && bat1.todayLots === oneEnd.todayLots && bat1.lots === oneEnd.lots,
     '㉮ 묶음 [거두기] = 하나씩 셋의 끝 판(돈 · 남은 오늘 꾸러미 · 꾸러미 수 같음)', JSON.stringify({ 하나씩: { cash: oneEnd.cash - one0.cash, todayLots: oneEnd.todayLots, lots: oneEnd.lots }, 묶음: { cash: bat1.cash - bat0.cash, todayLots: bat1.todayLots, lots: bat1.lots } }));
  ok(!!oneSteps[0] && !!oneSteps[0].hob && !oneSteps[0].hob.탈 && (oneSteps[0].hob.both === false || oneSteps[0].hob.a <= 4), '㉮ [식물] 창 판에서 거둔 뒤 손가락(손 👉)이 배너 위에 안 앉는다(plan §18 덤 ③ 사진 390_c6e_p6_one)', JSON.stringify(oneSteps[0] && oneSteps[0].hob));
  const T17 = '🧺 반찬가게에 채소를 팔았습니다', SUB17 = '+200,000원 · 오늘 거둔&nbsp;1판<br>나머지는 그대로 있습니다', LOG17 = '🧺 반찬가게에 채소를 팔았습니다 — 오늘 거둔 1판 · +200,000원';
  ok(!!firstNb && oneSteps[0].nbT === T17 && oneSteps[0].nbSub === SUB17 && batB.t === T17 && batB.sub === SUB17,
     '㉮ §17 배너 «🧺 반찬가게에 채소를 팔았습니다» / «+200,000원 · 오늘 거둔 1판» + «나머지는 그대로 있습니다»(전 꾸러미가 남은 판 · 하나씩 · 묶음)', JSON.stringify({ one: [oneSteps[0].nbT, oneSteps[0].nbSub], batch: [batB.t, batB.sub] }));
  ok(oneSteps[0].log === LOG17 && bat1.log === LOG17 && blines[0] === '아랫길 반찬가게 사장님이 우리 채소를 사 가셨다.',
     '㉮ §17 [방] 기록 «🧺 반찬가게에 채소를 팔았습니다 — 오늘 거둔 1판 · +200,000원» · 묶음도 대사 첫 줄 «… 우리 채소를 사 가셨다.»', JSON.stringify({ oneLog: oneSteps[0].log, batLog: bat1.log, batLine: blines[0] }));
  if (OUT) await page.shot(`${OUT}/390_c6e_p6_batch2.png`);
  /* 보유 채소 0 판 — 그릇 하나만 거두면 «나머지» 줄이 없다 */
  { const w0 = JSON.parse(staged); w0.state.firstPlay.food.pantryLots = []; w0.state.firstPlay.food.pantryWon = 0;
    await boot(JSON.stringify(w0)); await dlgLines();
    await page.eval(`(()=>{ try { window.__byeotSheet.open('plants'); } catch (e) { void e; } return 1; })()`, false); await sleep(1200);
    await J(`(()=>{ const b=document.querySelector('#siruList button[data-siru="${RIPE[0]}"][data-act="harvest"]'); if (b) b.click(); return !!b; })()`);
    await waitHarvested([RIPE[0]]); const z = await snap(); await dlgLines();
    const zb = z.banners.find(b => NB.test(b.all)) || {};
    console.log('  ㉮ P6 보유 채소 0', JSON.stringify({ todayLots: z.todayLots, lots: z.lots, t: zb.t, sub: zb.sub }));
    ok(zb.t === T17 && zb.sub === '+200,000원 · 오늘 거둔&nbsp;1판', '㉮ §17 보유 채소 0 에서 하나만 거두면 둘째 줄은 «+200,000원 · 오늘 거둔 1판» 하나', JSON.stringify({ t: zb.t, sub: zb.sub, lots: z.lots }));
    if (OUT) await page.shot(`${OUT}/390_c6e_p6_zero.png`); }
  /* 결산 길(Day 110 · lastDay) — 손잡이로 글만 */
  { const lb = await J(`window.__byeotNeighborBanner(200000, { lastDay: true, takenLots: 2 })`);
    ok(!lb.탈 && lb[0] && lb[0].title === T17 && /^\+200,000원 · 가장 최근에 거둔 2판(<br>나머지는 그대로 있습니다)?$/.test(lb[0].sub), '㉮ §17 결산 길 배너 «+200,000원 · 가장 최근에 거둔 2판»(손잡이)', JSON.stringify(lb)); }
  try { await page.close(); } catch (e) { console.log('  (탭 닫기 탈)', e.message); }
}

/* ═══ ㉯ P8 · ㉱ next_finger ═══ */
{
  const { page, J, boot, dlgLines, camStill } = await open(390);
  const recalled = (() => { const w = JSON.parse(saveA); const p = w.state.firstPlay.beansprout.pots.find(x => x.id === 'crop_01_16'); p.slotId = null; p.at = null; return JSON.stringify(w); })();
  for (const [name, txt] of [['손질 없음', saveA], ['회수 하나', recalled]]) {
    await boot(txt); await dlgLines(); await page.eval(`(()=>{ try { window.__byeotSheet.close(); } catch (e) { void e; } return 1; })()`, false); await sleep(1000);
    await J(`(()=>{ const ts=window.__S().tutorial; ts.cashWon = ts.rules.moveOutCostWon + 400000; window.__redraw(); return 1; })()`);
    await sleep(800); await dlgLines();
    await page.eval(`(()=>{ window.__byeotSheet.tab('room'); document.getElementById('moveOut').click(); return 1; })()`, false); await sleep(1500); await dlgLines(); await sleep(800);
    const mv = await J(`(()=>{ const S=window.__S(); const pots=S.firstPlay.beansprout.pots; const stock=(S.shop.stock||{});
      return { on: document.getElementById('movePanel').classList.contains('on'), lines: [...document.querySelectorAll('#moveAsk div')].map(d=>d.textContent),
               real: pots.length + (stock.siru||0), unplaced: pots.filter(p=>!p.slotId).length }; })()`);
    console.log(`  ㉯ P8 ${name}`, JSON.stringify(mv));
    if (OUT && name === '회수 하나') await page.shot(`${OUT}/390_c6e_p8_move.png`);
    const L = mv.lines || []; const carry = L.find(t => /^가져가는 것 — /.test(t)) || ''; const m = carry.match(/시루 (\d+)개/);
    ok(!mv.탈 && mv.on && !!m && +m[1] === mv.real, `㉯ P8 ${name} — «시루 n개» = 콩나물 줄 + 시루 재고`, JSON.stringify({ carry, real: mv.real, unplaced: mv.unplaced }));
    ok(!mv.탈 && L.includes('두고 가는 것 — 벽 · 창 · 천장에 붙은 가구 2개'), `㉯ P8 ${name} — «두고 가는 것 — 벽 · 창 · 천장에 붙은 가구 2개»`, JSON.stringify(L.filter(t => /^두고 가는/.test(t))));
    await page.eval(`(()=>{ const c=document.getElementById('moveCancel'); if (c) c.click(); return 1; })()`, false); await sleep(800);
  }
  /* ㉱ next_finger — A100(체력 0) [다음 날] 손가락 */
  await boot(saveA); await dlgLines(); await page.eval(`(()=>{ try { window.__byeotSheet.close(); } catch (e) { void e; } return 1; })()`, false); await camStill(); await sleep(1500);
  const nf = await J(`(()=>{ const R=q=>[Math.round(q.left),Math.round(q.top),Math.round(q.right),Math.round(q.bottom)];
    const area=(a,b)=>Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
    const h=document.getElementById('hint'); const t=document.querySelector('.hintTarget'); if (!h || !h.classList.contains('on') || !t) return { on:false };
    const sayR=h.querySelector('.say').getBoundingClientRect(); const handG=(()=>{ const rg=document.createRange(); rg.selectNodeContents(h.querySelector('.hand')); return rg.getBoundingClientRect(); })();
    const tb=e=>{ const rg=document.createRange(); rg.selectNodeContents(e); return rg.getBoundingClientRect(); };
    const texts=[['staText',document.getElementById('staText')], ...['harvestCrop','waterCrop','waterPot','resow','sellSurplusBtn'].map(id=>[id,document.getElementById(id)])]
      .filter(([,e])=>e && e.offsetParent && getComputedStyle(e).display!=='none').map(([id,e])=>({ id, q: tb(e) })).filter(x=>x.q.width>0);
    const hits=[]; for (const [pn,pr] of [['말',sayR],['손',handG]]) for (const x of texts) { const a=area(pr,x.q); if (a>4) hits.push({ p:pn, id:x.id, a:Math.round(a) }); }
    const tr=t.getBoundingClientRect(); const gap=Math.max(0, tr.left-handG.right, handG.left-tr.right, tr.top-handG.bottom, handG.top-tr.bottom);
    return { on:true, tid:t.id, say:(h.querySelector('.say').textContent||''), cls:h.className, say_r:R(sayR), hand_r:R(handG), target:R(tr), sta: (texts.find(x=>x.id==='staText')||{}).q ? R(texts.find(x=>x.id==='staText').q) : null, hits, handGap:Math.round(gap) }; })()`);
  console.log('  ㉱ next_finger', JSON.stringify(nf));
  if (OUT) await page.shot(`${OUT}/390_c6e_next_finger.png`);
  ok(!nf.탈 && nf.on === true && nf.tid === 'next', '㉱ A100(체력 0) 손가락이 [다음 날]을 짚는다', JSON.stringify({ on: nf.on, tid: nf.tid, say: nf.say }));
  ok(!nf.탈 && nf.on === true && Array.isArray(nf.hits) && nf.hits.length === 0, '㉱ 말풍선 · 손이 빨간 체력 줄과 바닥 왼쪽 단추 글을 안 덮는다', JSON.stringify({ hits: nf.hits, say: nf.say_r, sta: nf.sta, cls: nf.cls }));
  ok(!nf.탈 && nf.on === true && nf.handGap <= 14, '㉱ 손이 [다음 날]에 닿는다(틈 ≤ 14px · 흔들림 6px 포함)', JSON.stringify({ gap: nf.handGap, hand: nf.hand_r, target: nf.target }));
  try { await page.close(); } catch (e) { console.log('  (탭 닫기 탈)', e.message); }
}

/* ═══ ㉰ P10 — 360 · 390 ═══ */
for (const w of [360, 390]) {
  const { page, J, boot, dlgLines } = await open(w);
  await boot(saveA); await dlgLines();
  await page.eval(`(()=>{ window.__byeotSheet.open('plants'); return 1; })()`, false); await sleep(1200);
  await page.eval(`(()=>{ const b=document.getElementById('lightHeat'); if (b) b.click(); return 1; })()`, false); await sleep(2500); await dlgLines();
  const lg = await J(`(()=>{ const cap=[...document.querySelectorAll('.byeot-lightgrid div')].find(e=>/칸의 수는/.test(e.textContent||'')); if (!cap) return { 없음: true };
    const lines=(cap.innerText||'').split('\\n');
    /* 줄마다 그 글이 몇 줄 상자에 걸쳤나 — <br> 로 가른 마디의 글자 네모 꼭대기 수 */
    const segs=[]; let cur=[]; for (const n of cap.childNodes) { if (n.nodeName==='BR') { segs.push(cur); cur=[]; } else cur.push(n); } segs.push(cur);
    const rowsOf=nodes=>{ const mids=[]; for (const n of nodes) { const rg=document.createRange(); rg.selectNodeContents(n); for (const q of rg.getClientRects()) if (q.width>0.5) mids.push(q.top+q.height/2); }
      mids.sort((a,b)=>a-b); let k=mids.length?1:0; for (let i=1;i<mids.length;i++) if (mids[i]-mids[i-1]>8) k++; return k; };   /* 줄 상자 = 가운데 높이가 8px 넘게 벌어진 무리 수(작은 글 · 큰 글 섞여도 한 줄) */
    /* ★ [plan] §18 덤 ① — 첫 줄 «… 등 {n}개»의 «등»과 «개»가 같은 줄 상자인가 */
    const lampSame=(()=>{ const tw=document.createTreeWalker(cap,NodeFilter.SHOW_TEXT); let n; while((n=tw.nextNode())) { const i=n.textContent.search(/등.[0-9]+개/); if (i<0) continue;
        const j=n.textContent.indexOf('개',i); const r1=document.createRange(); r1.setStart(n,i); r1.setEnd(n,i+1); const r2=document.createRange(); r2.setStart(n,j); r2.setEnd(n,j+1);
        const a=r1.getBoundingClientRect(), b=r2.getBoundingClientRect(); return Math.abs((a.top+a.height/2)-(b.top+b.height/2))<=8; } return null; })();
    return { lines, rows: segs.map(rowsOf), wb: getComputedStyle(cap).wordBreak, w: Math.round(cap.getBoundingClientRect().width), lampSame }; })()`);
  console.log(`  ㉰ P10 ${w}`, JSON.stringify(lg));
  if (OUT) await page.shot(`${OUT}/${w}_c6e_legend.png`);
  const i4 = (lg.lines || []).findIndex(l => l === '어둠 0.3까지 · 밝음 2.7부터 · 아주 밝음 6부터');
  ok(!lg.탈 && !lg.없음 && i4 >= 0 && lg.lines[i4 + 1] === '칸의 수는 하루 빛 양(DLI)', `㉰ P10 ${w} 범례 넷째 줄 «어둠 0.3까지 · 밝음 2.7부터 · 아주 밝음 6부터» · 다섯째 줄 «칸의 수는 하루 빛 양(DLI)»`, JSON.stringify(lg.lines));
  ok(!lg.탈 && lg.lampSame !== false, `㉰ ${w} 범례 첫 줄 «등 1개»가 안 갈린다([plan] §18 덤 ①)`, JSON.stringify({ lampSame: lg.lampSame, head: (lg.lines || [])[0] }));
  ok(!lg.탈 && Array.isArray(lg.rows) && lg.rows.length >= 5 && lg.rows[lg.rows.length - 2] === 1 && lg.rows[lg.rows.length - 1] === 1 && lg.wb === 'keep-all', `㉰ P10 ${w} 넷째 · 다섯째 줄이 한 줄 상자(안 꺾임) · word-break keep-all`, JSON.stringify({ rows: lg.rows, wb: lg.wb, w: lg.w }));
  try { await page.close(); } catch (e) { console.log('  (탭 닫기 탈)', e.message); }
}
/* ═══ ㉲ 배너 상자 폭 — 360 · 390 · 430 · A100 · 손잡이(__byeotBannerTest)로 하나씩 ═══ */
for (const w of [360, 390, 430]) {
  const { page, J, boot, dlgLines, camStill } = await open(w);
  await boot(saveA); await dlgLines(); await page.eval(`(()=>{ try { window.__byeotSheet.close(); } catch (e) { void e; } return 1; })()`, false); await camStill(); await sleep(1200);
  const BN = [
    { key: 'neighbor', title: '🧺 반찬가게에 채소를 팔았습니다', sub: '+200,000원 · 오늘 거둔 1판<br>나머지는 그대로 있습니다' },
    { key: 'move', title: '📦 원룸으로 이사했습니다', sub: '반지하에서 배운 것을 가지고 갑니다' },
    { key: 'stamina', title: '✨ 체력이 늘었습니다 — 하루 18번', sub: '돌본 만큼 늘었습니다' },
    { key: 'stack', list: [{ title: '🧺 반찬가게에 채소를 팔았습니다', sub: '+200,000원 · 오늘 거둔 1판<br>나머지는 그대로 있습니다' }, { title: '🥣 콩나물 시루 3개를 거뒀습니다', sub: '하얗고 아삭 · 3kg' }] }
  ];
  const rows = [];
  for (const b of BN) {
    await page.eval(`(()=>{ const e=document.getElementById('event'); if (e && e.classList.contains('on')) e.click(); return 1; })()`, false); await sleep(700);
    await J(`window.__byeotBannerTest(${JSON.stringify(b.list || [{ title: b.title, sub: b.sub }])})`); await sleep(900);
    const m = await J(`(()=>{ const ev=document.getElementById('event'); const bb=ev.querySelector('b'); if (!bb) return { 없음: true };
      const R=q=>[Math.round(q.left),Math.round(q.top),Math.round(q.right),Math.round(q.bottom)];
      const tn=bb.firstChild && bb.firstChild.nodeType===3 ? bb.firstChild : null; const rg=document.createRange(); if (tn) rg.selectNodeContents(tn);
      const mids=tn?[...rg.getClientRects()].filter(q=>q.width>0.5).map(q=>q.top+q.height/2).sort((a,b)=>a-b):[]; let lines=mids.length?1:0; for (let i=1;i<mids.length;i++) if (mids[i]-mids[i-1]>8) lines++;
      const area=(a,b)=>Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
      const box=ev.getBoundingClientRect(); const vis=e=>{ if(!e) return null; const cs=getComputedStyle(e); if (cs.display==='none'||cs.visibility==='hidden'||+cs.opacity<0.05) return null; const q=e.getBoundingClientRect(); return q.width>1?q:null; };
      const hits=[['탭 기둥','navbar'],['[?]','guideOpen'],['할 일 칩','questChip']].map(([ko,id])=>{ const q=vis(document.getElementById(id)); return q && area(box,q)>4 ? ko : null; }).filter(Boolean);
      return { lines, box: R(box), w: Math.round(box.width), hits }; })()`);
    rows.push({ key: b.key, ...m });
    if (OUT) await page.shot(`${OUT}/${w}_c6e_banner_${b.key}.png`);
  }
  console.log(`  ㉲ 배너 폭 ${w}`, JSON.stringify(rows));
  /* ★ 11-02 총괄 사진(430) — 바닥 체력 줄(#staText)이 낱말 안에서 안 꺾인다(«최 / 대» 꼴) · 줄 끝 글자와 다음 줄 첫 글자 사이가 빈칸인가 */
  const sta = await J(`(()=>{ const e=document.getElementById('staText'); if (!e || !e.offsetParent) return { 없음: true }; const t=e.firstChild; if (!t || t.nodeType!==3) return { 없음: true };
    const s=t.textContent; const rg=document.createRange(); const breaks=[]; let prevMid=null;
    for (let i=0;i<s.length;i++) { rg.setStart(t,i); rg.setEnd(t,i+1); const q=rg.getBoundingClientRect(); if (!q.width) continue; const mid=q.top+q.height/2;
      if (prevMid!=null && mid-prevMid>8) breaks.push([s[i-1]||'', s[i]]); prevMid=mid; }
    return { breaks, ws: getComputedStyle(e).wordBreak }; })()`);
  ok(!sta.탈 && (sta.없음 || (sta.breaks || []).every(([a, b]) => /\s/.test(a) || /\s/.test(b) || /[·—,.]/.test(a))), `㉲ ${w} 바닥 체력 줄이 낱말 안에서 안 꺾인다(«최 / 대» 꼴 없음)`, JSON.stringify(sta));
  ok(rows.every(r => !r.탈 && !r.없음 && Array.isArray(r.hits) && r.hits.length === 0), `㉲ ${w} 배너 상자가 탭 기둥 · [?] · 보이는 할 일 칩과 안 겹친다`, JSON.stringify(rows.map(r => [r.key, r.hits, r.box])));
  ok(rows.every(r => !r.탈) && (rows.find(r => r.key === 'move') || {}).lines === 1, `㉲ ${w} 한 줄에 드는 «📦 원룸으로 이사했습니다»는 한 줄(제목 줄 수 ${rows.map(r => r.key + ' ' + r.lines).join(' · ')})`, JSON.stringify(rows.map(r => [r.key, r.lines, r.w])));
  try { await page.close(); } catch (e) { console.log('  (탭 닫기 탈)', e.message); }
}
/* ═══ ㉳ 판매 창 체크 글 — A100 · 보유 채소 꾸러미 세 벌(probe_critic6_c ㉲ 와 같은 손질) · 바닥 [🧺 남는 채소 N판 팔기] ═══ */
for (const w of [360, 390, 430]) {
  const { page, J, boot, dlgLines } = await open(w);
  const wL = JSON.parse(saveA); { const f = wL.state.firstPlay.food; const lots = (f.pantryLots || []).slice(); f.pantryLots = [...lots, ...lots.map(l => ({ ...l })), ...lots.map(l => ({ ...l }))]; f.pantryWon = f.pantryLots.reduce((a, l) => a + (l.won || 0), 0); }
  await boot(JSON.stringify(wL)); await dlgLines(); await page.eval(`(()=>{ try { window.__byeotSheet.close(); } catch (e) { void e; } return 1; })()`, false); await sleep(1200);
  await J(`(()=>{ const b=document.getElementById('sellSurplusBtn'); if (b && b.style.display !== 'none' && b.offsetParent) b.click(); return 1; })()`); await sleep(1500);
  const nr = await J(`(()=>{ const row=document.getElementById('pantryNoAskRow'); if (!row || !row.offsetParent) return { 없음: true }; const sp=row.querySelector('span'), sm=row.querySelector('small');
    const rowsOf=e=>{ const rg=document.createRange(); rg.selectNodeContents(e); const mids=[...rg.getClientRects()].filter(q=>q.width>0.5).map(q=>q.top+q.height/2).sort((a,b)=>a-b); let k=mids.length?1:0; for (let i=1;i<mids.length;i++) if (mids[i]-mids[i-1]>8) k++; return k; };
    const q=sp.getBoundingClientRect(), qs=sm?sm.getBoundingClientRect():null;
    return { span: (sp.textContent||'').trim(), spanRows: rowsOf(sp), spanW: Math.round(q.width), smallRows: sm ? rowsOf(sm) : null, smallBelow: qs ? qs.top >= q.bottom - 2 : null, smallFont: sm ? getComputedStyle(sm).fontSize : null }; })()`);
  console.log(`  ㉳ 판매 창 체크 글 ${w}`, JSON.stringify(nr));
  if (OUT) await page.shot(`${OUT}/${w}_c6e_noask.png`);
  if (w !== 360) ok(!nr.탈 && !nr.없음 && nr.span === '다음부터 묻지 않고 바로 팔기' && nr.spanRows === 1 && nr.smallBelow === true, `㉳ ${w} 판매 창 체크 글 «다음부터 묻지 않고 바로 팔기»가 한 줄 · 밑줄은 그 아래 작은 글`, JSON.stringify(nr));
  try { await page.close(); } catch (e) { console.log('  (탭 닫기 탈)', e.message); }
}
ok(exc.length === 0, '처리 안 된 예외 0', exc.slice(0, 3).join(' / '));
console.log(bad ? `probe_critic6_e: 빨강 ${bad}` : 'probe_critic6_e: 다 통과');
process.exit(bad ? 1 : 0);
