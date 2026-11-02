/* 비판 6판 넷째 묶음 자(core 11-02 · 총괄 · [plan] f373262a 대조 §16 6a69e18a) — 390(범례는 360 도)
   판: 비판 6판 A100 세이브(C:/Users/pc/byeot-core-keep/critic6/ · 프로필은 안 건드림) — 손질은 줄마다 적음
   ㉮ P6 반찬가게(§16 ④ · 총괄 잣대 «묶음 단추 = 손으로 하나씩 한 것과 같은 결과») — «6판 Day 90 꼴» 손질:
        neighborOrderDay 없음 · 오늘 꾸러미는 어제로 · 체력 가득 · 콩나물 시루 셋 익힘 · 반찬가게 대사는 «본 대사»에서 뺌(6판 A 는 Day 90 에 들었다)
      하나씩(식물 판 줄 [거두기] 셋) · 묶음(바닥 [거두기] 한 번) — 가져간 꾸러미 · 남은 오늘 꾸러미 · 배너 · 대사 첫 줄(서는 때)을 적는다
      단언: 둘의 끝 판이 같다(돈 +200,000 · 오늘 꾸러미 2 남음) · 배너 둘째 줄 «+200,000원 — 전에 거둔 채소는 그대로 있습니다»(전 꾸러미가 남음)
        ⛔ f373262a 는 꾸러미에 없는 g 칸으로 세어 늘 «+200,000원»만 섰다
   ㉯ P8(§16 ① ②) — 이사 창(이사비 손질 · probe_critic6_c ㉱ 와 같은 손): 시루 하나를 [회수]한 꼴(slotId · at = null)에서도 «시루 n개» = 콩나물 줄 + 시루 재고
        ⛔ 예전 «시루 17개»(실제 16 · 회수한 것을 두 번) · «두고 가는 것 — 벽 · 창 · 천장에 붙은 가구 2개»
   ㉰ P10(§16 ③) — 빛 범례 넷째 줄 «어둠 0.3까지 · 밝음 2.7부터 · 아주 밝음 6부터» · 다섯째 줄 «칸의 수는 하루 빛 양(DLI)» · 두 줄 다 한 줄 상자(낱말 안 꺾임 0) — 360 · 390
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
    banners: [...document.querySelectorAll('#event > *')].map(e=>({ t: ((e.querySelector('b,strong,.t,.title')||e.firstChild||{}).textContent||'').trim(), all: (e.textContent||'').replace(/\\s+/g,' ').trim() })).slice(0,6) }; })()`);
  const waitHarvested = async (ids) => { for (let i = 0; i < 60; i++) { const r = await J(`(()=>{ const S=window.__S(); return ${JSON.stringify(ids)}.every(id => (S.firstPlay.beansprout.pots.find(p=>p.id===id)||{}).harvested); })()`); if (r === true) break; await sleep(400); }
    for (let i = 0; i < 20; i++) { const t = await J(`document.getElementById('stage').classList.contains('talking')`); if (t === true) return true; await sleep(200); } return false; };
  const NB = /🧺 반찬가게가 오늘 거둔 채소를 사 갔습니다/;
  /* 하나씩 */
  await boot(staged); await dlgLines();
  const one0 = await snap(); const oneSteps = [];
  for (const id of RIPE) {
    await page.eval(`(()=>{ try { window.__byeotSheet.open('plants'); } catch (e) { void e; } return 1; })()`, false); await sleep(1200);
    const hit = await J(`(()=>{ const b=document.querySelector('#siruList button[data-siru="${id}"][data-act="harvest"]'); if (!b) return false; b.click(); return true; })()`);
    const talk = await waitHarvested([id]); const sn = await snap(); const lines = await dlgLines();
    oneSteps.push({ id, hit, talk, nod: sn.nod, cash: sn.cash, todayLots: sn.todayLots, lots: sn.lots, nb: (sn.banners.find(b => NB.test(b.all)) || {}).all || null, 대사: lines[0] || null });
    if (OUT && id === RIPE[0]) await page.shot(`${OUT}/390_c6e_p6_one.png`);
    await page.eval(`(()=>{ try { window.__byeotSheet.close(); } catch (e) { void e; } return 1; })()`, false); await sleep(800);
  }
  console.log('  ㉮ P6 하나씩', JSON.stringify({ 전: { nod: one0.nod, cash: one0.cash, todayLots: one0.todayLots, lots: one0.lots }, 걸음: oneSteps }));
  /* 묶음 */
  await boot(staged); await dlgLines();
  const bat0 = await snap();
  const bt = await J(`(()=>{ const b=document.getElementById('harvestCrop'); if (!b || b.style.display==='none') return null; const t=(b.textContent||'').trim(); b.click(); return t; })()`);
  const btalk = await waitHarvested(RIPE); const bat1 = await snap(); const blines = await dlgLines();
  if (OUT) await page.shot(`${OUT}/390_c6e_p6_batch.png`);
  const batNb = (bat1.banners.find(b => NB.test(b.all)) || {}).all || null;
  console.log('  ㉮ P6 묶음', JSON.stringify({ 전: { nod: bat0.nod, cash: bat0.cash, todayLots: bat0.todayLots, lots: bat0.lots }, 단추: bt, talk: btalk, nod: bat1.nod, cash: bat1.cash, todayLots: bat1.todayLots, lots: bat1.lots, 배너: bat1.banners.map(b => b.all), 대사: blines[0] || null }));
  const oneEnd = oneSteps[oneSteps.length - 1] || {};
  const firstNb = oneSteps[0] && oneSteps[0].nb;
  ok(!one0.탈 && oneSteps.length === 3 && oneSteps.every(x => x.hit === true) && oneSteps[0].nod === 100 && oneSteps[0].todayLots === 0 && oneSteps[0].대사 === '아랫길 반찬가게 사장님이 오늘 거둔 걸 다 사 가셨다.',
     '㉮ 하나씩 — 첫 [거두기]에 반찬가게가 그날 거둔 것(첫 그릇 몫)을 사 가고 대사가 그 자리에서 선다', JSON.stringify(oneSteps[0]));
  ok(!bat1.탈 && bt && bat1.nod === 100 && bat1.cash - bat0.cash === oneEnd.cash - one0.cash && bat1.todayLots === oneEnd.todayLots && bat1.lots === oneEnd.lots,
     '㉮ 묶음 [거두기] = 하나씩 셋의 끝 판(돈 · 남은 오늘 꾸러미 · 꾸러미 수 같음)', JSON.stringify({ 하나씩: { cash: oneEnd.cash - one0.cash, todayLots: oneEnd.todayLots, lots: oneEnd.lots }, 묶음: { cash: bat1.cash - bat0.cash, todayLots: bat1.todayLots, lots: bat1.lots } }));
  const SUB = /\+200,000원 — 전에 거둔 채소는 그대로 있습니다$/;
  ok(!!firstNb && SUB.test(firstNb) && !!batNb && SUB.test(batNb), '㉮ 배너 둘째 줄 «+200,000원 — 전에 거둔 채소는 그대로 있습니다»(전 꾸러미가 남은 판 · 하나씩 · 묶음)', JSON.stringify({ firstNb, batNb }));
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
    return { lines, rows: segs.map(rowsOf), wb: getComputedStyle(cap).wordBreak, w: Math.round(cap.getBoundingClientRect().width) }; })()`);
  console.log(`  ㉰ P10 ${w}`, JSON.stringify(lg));
  if (OUT) await page.shot(`${OUT}/${w}_c6e_legend.png`);
  const i4 = (lg.lines || []).findIndex(l => l === '어둠 0.3까지 · 밝음 2.7부터 · 아주 밝음 6부터');
  ok(!lg.탈 && !lg.없음 && i4 >= 0 && lg.lines[i4 + 1] === '칸의 수는 하루 빛 양(DLI)', `㉰ P10 ${w} 범례 넷째 줄 «어둠 0.3까지 · 밝음 2.7부터 · 아주 밝음 6부터» · 다섯째 줄 «칸의 수는 하루 빛 양(DLI)»`, JSON.stringify(lg.lines));
  ok(!lg.탈 && Array.isArray(lg.rows) && lg.rows.length >= 5 && lg.rows[lg.rows.length - 2] === 1 && lg.rows[lg.rows.length - 1] === 1 && lg.wb === 'keep-all', `㉰ P10 ${w} 넷째 · 다섯째 줄이 한 줄 상자(안 꺾임) · word-break keep-all`, JSON.stringify({ rows: lg.rows, wb: lg.wb, w: lg.w }));
  try { await page.close(); } catch (e) { console.log('  (탭 닫기 탈)', e.message); }
}
ok(exc.length === 0, '처리 안 된 예외 0', exc.slice(0, 3).join(' / '));
console.log(bad ? `probe_critic6_e: 빨강 ${bad}` : 'probe_critic6_e: 다 통과');
process.exit(bad ? 1 : 0);
