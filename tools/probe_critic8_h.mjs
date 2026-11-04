/* 비판 8판 §16 갈림 C · §17 새 식물 자(core 11-03 · 총괄 가름 · plan f633091f · 752cad07 · 33062fea) — 산 집으로 옮긴 날 짐 풀기 손가락
   ⛔ 투룸 첫날(원룸에서 oneroom_unpack 을 받은 판) — 삽수 · 몬스테라 다음에 짐 풀기 손가락이 꺼졌다(§unpackPassedBoxesOnly · MINOR ②) ·
      이삿짐 21개가 안내 없이 가방에 남았고(가방에선 안 자람) · 칩 «가방의 식물을 새 집에 놓으세요»(home_unpack 끝 bagGrowers 가 새 종을 셈)는 기다리는데
      손가락은 새 식물을 한 번도 안 짚었다(셈 §unpackCountsNow 가 새 종을 안 셈 · core band2 · band4)
   ⇒ 갈림 C: 산 집으로 옮긴 날(story.homeOnDay === S.day)엔 넘기지 않는다 · §17: 새 종도 센다 · 차례 삽수 → 몬스테라 → 새 식물 → 이삿짐 · 시루
   판(프로필 안 건드림)
     T 투룸 가게 첫날 세이브 그대로(C:/Users/pc/byeot-core-keep/critic8/tworoom_shop_first.json · 가방 빈 시루 없음)
     O 원룸 S Day 97(C:/Users/pc/byeot-core-keep/critic6/saveS_d97.json) — 작물을 다 이삿짐으로(critic8_e ㉱ 와 같은 손질 · 덧붙임 없음) · oneroom_unpack 넘어감 · 이삿짐만 남음
   단언(390)
     ㉮ T 손가락대로 걷기 — 삽수 → 몬스테라 → 새 식물마다 «{종}를 놓으세요»(가방 새 종 수만큼 · 390 · 360 한 줄) → [한꺼번에 놓기 (N개)] «빛이 맞는 빈 자리에 바로 놓습니다»(plan §16 ㉱ · §17 ㉮)
     ㉯ T 마지막 그루(새 식물)를 놓고 [확인]한 «그 순간» home_unpack 이 끝난다(stamina.questsTaken · 칩이 다음 할 일) — 새 종 누름 길은 확인 바(11-03 plan §18) · 할 일은 [확인]에서 센다
     ㉰ T [한꺼번에 놓기] 한 번 — 이삿짐 0 · 기록 «📦 이삿짐 N개를 한꺼번에 놓았습니다»(배너는 늦춘 새 종 배너 뒤에 설 수 있어 기록 줄로 본다)
        (11-03 총괄 · reg55 가름) 고리는 하나씩 방 뷰에 설 때까지 기다리는 비동기라 끝나는 때가 판마다 다르다 ⇒ 맺음 기록 줄이 설 때까지(최대 40초) 기다린 뒤 잰다 ·
        40초가 지나도 없으면 빨강(기록 끝 줄) · 맺음 줄 N = 놓인 수
     ㉱ T′ 같은 판에서 이삿짐을 하나만 놓고 [다음 날](작물이 하나도 안 놓였으면 [다음 날]은 «가방의 시루를 먼저 방 안에 놓아 주세요»로 막힌다 — firstPlay 문 · 사람 손 — 울타리에 막히면 날이 넘어갈 때까지 최대 4번 · 넘어가면 멈춤 · 445 → 446 꼭 하루) — 이튿날 손가락이 짐 풀기 갈래(이삿짐 칸 · [한꺼번에 놓기])에 묶이지 않는다(plan §16 ㉲)
     ㉲ O 원룸 판(oneroom_unpack 넘어감 · 이삿짐만) — 손가락이 이삿짐 칸 · [한꺼번에 놓기]를 안 짚는다(ae32f79c 꼴 그대로 · plan §16 ㉳)
     ㉳ T″ 삽수가 마지막인 판 — 사람 손으로 몬스테라 · 새 식물을 먼저 놓고(울타리면 최대 4번) 손가락대로 삽수를 마지막에 놓으면 그 «순간» home_unpack 이 끝난다(총괄 11-03 ①)
     예외 0 · J 단언엔 !탈 */
import fs from 'node:fs';
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9451', OUT = process.env.OUT || null;
const SAVE_T = process.env.SAVE || 'C:/Users/pc/byeot-core-keep/critic8/tworoom_shop_first.json';
const SAVE_O = process.env.SAVE_S || 'C:/Users/pc/byeot-core-keep/critic6/saveS_d97.json';
if (OUT) fs.mkdirSync(OUT, { recursive: true });
let bad = 0; const ok = (c, m, d = '') => { console.log(`${c ? '  OK' : 'FAIL'}  ${m}${d ? '  → ' + d : ''}`); if (!c) bad++; };
for (const f of [SAVE_T, SAVE_O]) if (!fs.existsSync(f)) { ok(false, '세이브 없음', f); process.exit(1); }
const exc = [];
const page = await launch({ width: 390, height: 844, dpr: 2 });
page.on((method, p) => { if (method === 'Runtime.exceptionThrown') exc.push(((p.exceptionDetails.exception && p.exceptionDetails.exception.description) || p.exceptionDetails.text || '').split('\n')[0].slice(0, 200)); });
await page.send('Runtime.enable');
await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true;` });
const J = async (js) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, 120000));
const dlg = async () => { for (let i = 0; i < 160; i++) { const t = await J(`document.getElementById('stage').classList.contains('talking')`); if (t !== true) break; await page.eval(`(()=>{ const b=document.getElementById('dlgBox'); if(b) b.click(); return 1; })()`, false); await sleep(250); } };
const bannerOff = async () => { for (let i = 0; i < 20; i++) { const on = await J(`document.getElementById('event').classList.contains('on')`); if (on !== true) return; await J(`(()=>{ document.getElementById('event').click(); return 1; })()`); await sleep(400); } };
const settle = async () => { await J(`(()=>{ for (const a of document.getAnimations()) { try { a.finish(); } catch (e) { void e; } } return 1; })()`);
  await page.send('Page.captureScreenshot', { format: 'jpeg', quality: 10, clip: { x: 0, y: 0, width: 10, height: 10, scale: 1 } }); await sleep(300); };
const boot = async (w) => {
  await page.goto(`${BASE}/data/balance/homes.json`);
  await page.eval(`(()=>{ localStorage.clear(); localStorage.setItem('byeot/save/1', ${JSON.stringify(JSON.stringify(w))}); localStorage.setItem('byeot.guideSeen','1'); return 1; })()`, false);
  await page.goto(`${BASE}/game.html`); await page.waitFor('window.__byeotBooted === true', 300000, 500); await page.waitFor('!!window.__rv', 240000, 500); await sleep(4000);
  await dlg(); await bannerOff(); await sleep(1200);
};
const LOOK = `(()=>{ const h=document.getElementById('hint'); const t=document.querySelector('.hintTarget'); const s=h.querySelector('.say'); const S0=window.__S();
  let lines = null; if (h.classList.contains('on') && s && s.textContent) { const rg=document.createRange(); rg.selectNodeContents(s); lines = new Set([...rg.getClientRects()].filter(q=>q.width>0).map(q=>Math.round(q.top))).size; }
  const cell = t ? (t.closest && t.closest('.bagslot[data-place]')) : null;
  const fp=S0.firstPlay; const all=[...((fp.beansprout||{}).pots||[]), ...Object.values(fp.crops||{}).flatMap(v=>(v&&v.pots)||[])];
  return { on: h.classList.contains('on'), say: h.classList.contains('on') ? ((s||{}).textContent||null) : null, lines,
    target: t ? (t.getAttribute('data-act') || (t.dataset && t.dataset.boxpot ? 'boxpot:' + t.dataset.boxpot : (cell ? cell.getAttribute('data-place') : (t.id || String(t.className).slice(0, 40))))) : null,
    chip: ((document.getElementById('questChipText')||{}).textContent||'').trim(), room: (S0.home||{}).room || null, day: S0.day,
    boxes: all.filter(p => p.moveBox && !p.slotId && !p.at).length, spBag: ((S0.species && S0.species.pots) || []).filter(q => q && !q.slotId && !q.at).length,
    taken: ((S0.stamina && S0.stamina.questsTaken) || []).filter(q => /unpack/.test(q)) }; })()`;
const nextDay = async () => {
  const d0 = await J(`window.__S().day`);
  const press = () => page.eval(`(()=>{ try { window.__byeotSheet.close(); } catch (e) { void e; } const b=document.getElementById('next'); b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})); b.click(); return 1; })()`, false);
  /* ★ 11-03 총괄 ② — 사람 손: 손가락이 다른 것을 짚으면 첫 누름이 울타리에 막힌다 · 날이 넘어갈 때까지(또는 대사 · 창이 설 때까지) 최대 4번 누르고 멈춘다 */
  let presses = 0;
  for (; presses < 4; ) {
    await press(); presses++; await sleep(1200);
    const st0 = await J(`(()=>({ day: window.__S().day, busy: document.getElementById('stage').classList.contains('talking') || !!document.querySelector('.pop.on') || !!(document.getElementById('monthPanel') && document.getElementById('monthPanel').classList.contains('on')) }))()`);
    if (st0.탈 || st0.day > d0 || st0.busy) break;
  }
  const seen = [];
  for (let k = 0; k < 50; k++) {
    await sleep(700);
    const st = await J(`(()=>{ const pop=document.querySelector('.pop.on'); return { day: window.__S().day, talking: document.getElementById('stage').classList.contains('talking'), pop: pop ? pop.id : null,
      month: !!(document.getElementById('monthPanel') && document.getElementById('monthPanel').classList.contains('on')) }; })()`);
    if (st.탈) { seen.push('탈'); break; }
    if (st.month) { seen.push('month'); await page.eval(`(()=>{ const c=document.getElementById('monthClose'); if (c) c.click(); return 1; })()`, false); continue; }
    if (st.pop === 'mealPanel') { seen.push('meal'); await page.eval(`(()=>{ const g=document.getElementById('mealGo'); if (g) g.click(); return 1; })()`, false); continue; }
    if (st.pop === 'evPanel') { seen.push('ev'); await page.eval(`(()=>{ const b=document.querySelector('#evPanel .pbtns button:not([disabled])') || document.querySelector('#evPanel button:not([disabled])'); if (b) b.click(); return 1; })()`, false); continue; }
    if (st.pop) { seen.push('pop ' + st.pop); await page.eval(`(()=>{ const p=document.querySelector('.pop.on'); const b=p && (p.querySelector('button.ghost') || p.querySelector('button')); if (b) b.click(); return 1; })()`, false); continue; }
    if (st.talking) { seen.push('talk'); await dlg(); continue; }
    if (st.day > d0) { await sleep(600); const t2 = await J(`document.getElementById('stage').classList.contains('talking') || !!document.querySelector('.pop.on')`); if (!t2) break; }
  }
  await bannerOff();
  return { d0, d1: await J(`window.__S().day`), presses, seen };
};
/* 손가락대로 — 짚은 것을 누르고(확인 바가 서면 [확인]) · 새 식물 칸이면 360 한 줄도 잰다 · until(lk) 가 참이면 멈춤 */
const follow = async (until, tag) => {
  const trail = []; let lk = null;
  for (let k = 0; k < 18; k++) {
    await J(`(()=>{ window.__byeotSheet.open('bag'); return 1; })()`); await sleep(1300); await settle(); await sleep(700);
    lk = await J(LOOK);
    const row = { target: lk.target, say: lk.say, lines: lk.lines, chip: lk.chip, taken: lk.taken, spBag: lk.spBag, boxes: lk.boxes };
    if (!lk.탈 && /^species:/.test(lk.target || '')) {
      await page.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 780, deviceScaleFactor: 2, mobile: false }); await sleep(1300);
      try { await J(`(()=>{ window.__byeotHint(); return 1; })()`); } catch (e) { void e; } await sleep(900); await settle();
      const l360 = await J(LOOK); row.say360 = l360.say; row.lines360 = l360.lines;
      if (OUT) await page.shot(`${OUT}/360_c8h_${tag}_${String(lk.target).replace(/[^\w]/g, '_')}.png`);
      await page.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: false }); await sleep(1300);
      try { await J(`(()=>{ window.__byeotHint(); return 1; })()`); } catch (e) { void e; } await sleep(900); await settle();
      if (OUT) await page.shot(`${OUT}/390_c8h_${tag}_${String(lk.target).replace(/[^\w]/g, '_')}.png`);
    }
    trail.push(row);
    if (lk.탈 || !lk.target || until(lk)) break;
    const r = await J(`(()=>{ const t=document.querySelector('.hintTarget'); if (!t) return null; const c = t.closest('.bagslot[data-place]') || t; c.click(); return c.getAttribute('data-place') || c.id || null; })()`);
    await sleep(1500); await settle();
    if (OUT && typeof r === 'string' && /^species:/.test(r)) await page.shot(`${OUT}/390_c8h_${tag}_placed_${r.replace(/[^\w]/g, '_')}.png`);   /* 총괄 — 새 종을 놓은 뒤 배너(확인 바 없음) */
    await J(`(()=>{ const b=document.getElementById('placeOk'); if (b && b.offsetParent) b.click(); return 1; })()`); await sleep(1200); await dlg(); await bannerOff(); await sleep(600);
  }
  return { trail, lk };
};
const isUnpackBox = lk => !!lk && (lk.target === 'boxAll' || /^boxpot:/.test(lk.target || ''));

/* ═══ T 투룸 첫날 ═══ */
const wT = JSON.parse(fs.readFileSync(SAVE_T, 'utf8'));
const sp0 = ((wT.state.species && wT.state.species.pots) || []).filter(q => q && !q.slotId && !q.at);
await boot(wT);
const T = await follow(lk => isUnpackBox(lk), 'T');
console.log('  T 손가락 길', JSON.stringify(T.trail));
if (OUT) await page.shot(`${OUT}/390_c8h_T_box.png`);
const tr = T.trail.filter(r => r.target);
const iMon = tr.findIndex(r => r.say === '몬스테라를 밝은 자리에 놓으세요');
const spRows = tr.filter(r => /^species:/.test(r.target || ''));
const iSp0 = tr.findIndex(r => /^species:/.test(r.target || ''));
const iBox = tr.findIndex(r => isUnpackBox(r));
ok(!T.lk || !T.lk.탈, 'T 판 — 걷기 탈 없음', JSON.stringify(T.lk && T.lk.탈));
ok(sp0.length > 0 && spRows.length === sp0.length && iMon >= 0 && iSp0 > iMon && iBox > iSp0
   && spRows.every(r => /^(핑크프린세스|알로카시아|스킨답서스|칼라테아)를 놓으세요$/.test(r.say || '') && r.lines === 1 && r.say360 === r.say && r.lines360 === 1)
   && tr[iBox].target === 'boxAll' && tr[iBox].say === '빛이 맞는 빈 자리에 바로 놓습니다',
   `㉮ 투룸 첫날 — 몬스테라 → 새 식물 ${sp0.length}(«{종}를 놓으세요» 390 · 360 한 줄) → [한꺼번에 놓기] «빛이 맞는 빈 자리에 바로 놓습니다»`,
   JSON.stringify({ sp0: sp0.map(q => q.species), order: tr.map(r => [r.target, r.say]) }));
const UNPACK_CHIP = '가방의 식물을 새 집에 놓으세요';
const after = iBox >= 0 ? tr[iBox] : (tr[tr.length - 1] || {});   /* 마지막 새 식물을 놓은 «바로 다음» 줄(그 사이 다른 손 없음) */
ok(sp0.length > 0 && after.spBag === 0 && Array.isArray(after.taken) && after.taken.includes('home_unpack') && after.chip !== UNPACK_CHIP,
   '㉯ 마지막 그루(새 식물)를 놓고 [확인]한 그 순간 home_unpack 이 끝난다(칩이 다음 할 일 · 11-03 새 종 확인 바)', JSON.stringify({ spBag: after.spBag, taken: after.taken, chip: after.chip }));
console.log('  ㉯ 칩이 넘어간 때', JSON.stringify(tr.map(r => [r.target, r.chip, (r.taken || []).join(',')])));
const b0 = await J(LOOK);
/* 기록은 200줄에서 앞을 덜어 낸다(state §pushLog) — 자리 번호로 자르지 않고 «누르기 전 맺음 줄 수»를 센다(판: 0) */
const sum0 = await J(`(window.__S().log||[]).filter(x => x && typeof x.msg === 'string' && x.msg.includes('한꺼번에 놓았습니다')).length`);
await J(`(()=>{ const b=document.querySelector('#pageBag [data-act="boxAll"]'); if (b) b.click(); return !!b; })()`);
/* ★ 11-03 총괄(reg55 ㉰ 가름) — 고리(§placeAllBoxes)가 끝나야 맺음 기록 줄 · 배너가 선다 ⇒ 그 줄이 설 때까지(최대 40초) 기다린다 */
let sumLine = null; const tw0 = Date.now();
while (Date.now() - tw0 < 40000) {
  const nl = await J(`(window.__S().log||[]).map(x => x && x.msg).filter(m => typeof m === 'string' && m.includes('한꺼번에 놓았습니다'))`);
  if (nl.탈) break;
  if (Array.isArray(nl) && nl.length > (typeof sum0 === 'number' ? sum0 : 0)) { sumLine = nl[nl.length - 1]; break; }
  await sleep(200);
}
const waited = Date.now() - tw0;
await sleep(600); await dlg();
const ev = await J(`(document.getElementById('event').innerText||'').replace(/\\s+/g,' ').slice(0,160)`);
await bannerOff(); await sleep(800);
const b1 = await J(LOOK);
if (OUT) await page.shot(`${OUT}/390_c8h_T_after.png`);
const lg = await J(`(window.__S().log||[]).slice(-16).map(x => x && x.msg)`);
const placedN = (b0.boxes || 0) - (b1.boxes || 0);
const sumN = sumLine ? parseInt(String(sumLine).split('이삿짐 ')[1], 10) : null;
console.log('  ㉰ 맺음 줄까지', JSON.stringify({ sum0, waited, sumLine, sumN, placedN }));
ok(!b0.탈 && !b1.탈 && !lg.탈 && sum0 === 0 && b0.boxes > 0 && b1.boxes === 0 && !!sumLine && sumN === placedN && Array.isArray(lg) && lg.includes(`📦 이삿짐 ${b0.boxes}개를 한꺼번에 놓았습니다`),
   `㉰ [한꺼번에 놓기] 한 번 — 맺음 기록 줄이 설 때까지(최대 40초) 기다린 뒤 이삿짐 ${b0.boxes} → 0 · 맺음 줄 N = 놓인 수`,
   JSON.stringify({ before: b0.boxes, after: b1.boxes, waited, sumLine, sumN, placedN, ev, chip: b1.chip, logTail: Array.isArray(lg) ? lg.slice(-4) : lg }));

/* ═══ T′ 같은 판 · 이삿짐을 안 놓고 [다음 날] ═══ */
await boot(wT);
const T2 = await follow(lk => isUnpackBox(lk), 'T2');   /* 고친 판은 [한꺼번에 놓기]에서 멈춤 · HEAD 는 손가락이 꺼져 멈춤 */
/* 이삿짐 칸 하나만 누르고 [확인](울타리면 최대 4번) — 작물이 하나도 안 놓였으면 [다음 날]이 막히므로(firstPlay 문) 사람은 하나는 놓는다 */
const one = await (async () => { const b = (await J(LOOK)).boxes; let n = 0;
  for (; n < 4; n++) {
    await J(`(()=>{ window.__byeotSheet.open('bag'); return 1; })()`); await sleep(1200); await settle();
    const r = await J(`(()=>{ const c=document.querySelector('#pageBag .bagslot[data-boxpot]'); if (!c) return null; c.click(); return c.dataset.boxpot; })()`);
    if (!r || r.탈) break; await sleep(1500); await settle();
    await J(`(()=>{ const b=document.getElementById('placeOk'); if (b && b.offsetParent) b.click(); return 1; })()`); await sleep(1200); await dlg(); await bannerOff(); await sleep(500);
    const b2 = (await J(LOOK)).boxes; if (b2 < b) return { n: n + 1, before: b, after: b2 };
  }
  return { n, before: b, after: (await J(LOOK)).boxes }; })();
const nd = await nextDay();
await J(`(()=>{ window.__byeotSheet.open('bag'); return 1; })()`); await sleep(1500); await settle(); await sleep(700);
const n1 = await J(LOOK);
await J(`(()=>{ window.__byeotSheet.close(); return 1; })()`); await sleep(1500); await settle();
const n2 = await J(LOOK);
if (OUT) await page.shot(`${OUT}/390_c8h_T2_nextday.png`);
console.log('  ㉱ 이튿날', JSON.stringify({ nd, bagOpen: n1, bagClosed: n2 }));
const doorUnpack = s => /^(들고 온 채소를 놓으세요|이제 식물과 시루를 놓으세요|시루를 놓으세요)$/.test(s || '');
ok(!n1.탈 && !n2.탈 && one.after === one.before - 1 && nd.d0 === 445 && nd.d1 === 446 && n1.boxes > 0 && !isUnpackBox(n1) && !(n2.target === 'openBag' && doorUnpack(n2.say)),
   `㉱ 이삿짐을 하나만 놓고(${one.before} → ${one.after}) [다음 날](누름 ${nd.presses}번 · ${nd.d0} → ${nd.d1}) — 이튿날 손가락이 짐 풀기 갈래(이삿짐 칸 · [한꺼번에 놓기] · [가방] 문 말)에 안 묶임`, JSON.stringify({ nd, n1: [n1.target, n1.say, n1.boxes], n2: [n2.target, n2.say] }));

/* ═══ T″ 삽수가 마지막 — 몬스테라 · 새 식물을 사람 손으로 먼저(울타리면 최대 4번) ═══ */
{ await boot(wT);
  const tapUntil = async (sel, doneJs) => { let n = 0; for (; n < 4; n++) {
      await J(`(()=>{ window.__byeotSheet.open('bag'); return 1; })()`); await sleep(1200); await settle();
      const r = await J(`(()=>{ const c=document.querySelector(${JSON.stringify(sel)}); if (!c) return null; c.click(); return c.getAttribute('data-place') || c.getAttribute('data-potbag') || 1; })()`);
      if (!r || r.탈) return { n, r }; await sleep(1500); await settle();
      await J(`(()=>{ const b=document.getElementById('placeOk'); if (b && b.offsetParent) b.click(); return 1; })()`); await sleep(1200); await dlg(); await bannerOff(); await sleep(500);
      if (await J(doneJs) === true) return { n: n + 1, r }; }
    return { n, r: '안 됨' }; };
  const potDone = `(window.__S().pots||[]).every(p => !!(p.slotId || p.at))`;
  const spDone = `((window.__S().species && window.__S().species.pots) || []).every(q => !!(q.slotId || q.at))`;
  const tp = await tapUntil('#pageBag .bagslot[data-potbag]', potDone);
  const ts = []; for (let k = 0; k < 4; k++) { const r = await tapUntil('#pageBag .bagslot[data-place^="species:"]', spDone); ts.push(r); if (await J(spDone) === true || !r.r) break; }
  const T3 = await follow(lk => isUnpackBox(lk) || (!lk.on && lk.spBag === 0), 'T3');
  const rows = T3.trail.filter(r => r.target);
  const iCutLast = rows.map(r => /^cutting:/.test(r.target || '')).lastIndexOf(true);
  const nx = rows[iCutLast + 1] || T3.trail[T3.trail.length - 1] || {};
  console.log('  ㉳ 삽수가 마지막', JSON.stringify({ tp, ts, trail: T3.trail.map(r => [r.target, r.say, r.chip, (r.taken || []).join(',')]) }));
  ok(iCutLast >= 0 && rows.filter(r => /^cutting:/.test(r.target || '')).length >= 1 && rows.slice(0, iCutLast + 1).every(r => /^cutting:/.test(r.target || '')) && Array.isArray(nx.taken) && nx.taken.includes('home_unpack') && nx.chip !== UNPACK_CHIP,
     '㉳ 삽수가 마지막 그루인 판 — 손가락대로 마지막 삽수를 놓은 그 순간 home_unpack 이 끝난다(칩이 다음 할 일)', JSON.stringify({ pot: tp, sp: ts, next: nx }));
}
/* ═══ O 원룸 — oneroom_unpack 넘어감 · 이삿짐만 ═══ */
{ const w = JSON.parse(fs.readFileSync(SAVE_O, 'utf8')); const st = w.state; const fp = st.firstPlay; const day = st.day;
  for (const pp of [...fp.beansprout.pots, ...Object.values(fp.crops || {}).flatMap(v => (v && v.pots) || [])])
    Object.assign(pp, { slotId: null, at: null, moveBox: true, sown: true, harvested: false, ageDays: 1, startedOnDay: day - 1, idleSinceDay: day - 1 });
  await boot(w);
  await J(`(()=>{ window.__byeotSheet.open('bag'); return 1; })()`); await sleep(1500); await settle(); await sleep(700);
  const o1 = await J(LOOK);
  await J(`(()=>{ window.__byeotSheet.close(); return 1; })()`); await sleep(1500); await settle();
  const o2 = await J(LOOK);
  if (OUT) await page.shot(`${OUT}/390_c8h_O.png`);
  console.log('  ㉲ 원룸', JSON.stringify({ bagOpen: o1, bagClosed: o2 }));
  ok(!o1.탈 && !o2.탈 && o1.room === 'oneroom' && o1.boxes > 0 && o1.spBag === 0 && (o1.taken || []).includes('oneroom_unpack') && !isUnpackBox(o1) && !(o2.target === 'openBag' && doorUnpack(o2.say)),
     '㉲ 원룸(oneroom_unpack 넘어감 · 이삿짐만 · 새 종 0) — 손가락이 이삿짐 칸 · [한꺼번에 놓기] · [가방] 짐 풀기 문 말을 안 짚음(ae32f79c 꼴 그대로)', JSON.stringify({ o1: [o1.target, o1.say, o1.boxes, o1.taken], o2: [o2.target, o2.say] }));
}
ok(exc.length === 0, '처리 안 된 예외 0', exc.slice(0, 3).join(' / '));
try { await page.close(); } catch (e) { console.log('  (탭 닫기 탈)', e.message); }
console.log(bad ? `probe_critic8_h: 빨강 ${bad}` : 'probe_critic8_h: 다 통과');
process.exit(bad ? 1 : 0);
