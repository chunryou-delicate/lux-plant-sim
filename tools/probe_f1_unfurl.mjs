/* F1 새 잎 펼치기 자(core 11-04 · plan-ui-fun §F1 · 총괄 가름 · 글 총괄 11-04 · 판 총괄 11-04 ㉡)
   판: switchW_g_breedReg_pre(투룸 Day 1400 · 등 3 · d_f2394317 하네스 dump · 씨앗 g) — ⚠ 씨앗만 박음(심는 날 · 자리 · 씨앗 고름) · 나머지 사람 손
     - 박는 것: 심는 손 하나 — state §plantMonsteraSeed(S, io, { at: SLOT 자리, seed: SEED }) · 재고(씨앗 1 · 그릇 1)를 채워 그 손이 쓰게 함(probe_seed_ledger D82 와 같은 결)
       자리 SLOT(가게 진열대 7)은 그 판 빈 자리(그루 · 삽수 · 새 종 화분 · 빈 화분 뺌) 중 오늘 · 60일 평균 가장 밝은 데 — 차 있으면 «판 못 섬»으로 멈춘다
     - 박은 씨앗은 게임이 그날 냈을 씨앗과 같은 꼴이다: 같은 함수(plantMonsteraSeed → growth.addPlant({ seed })) · 다른 값
       (게임 손 §sowEmptyPot 은 opt.seed 를 안 줘 state §newGrowthSeed(그루 id + 그날)의 uint32 를 쓰고, 이 자는 SEED(12)를 준다 — 둘 다 opt.seed >>> 0 길)
     - SEED 12: 복사본 node 어림(_scout_f1 · 같은 판 등 · 진짜 날씨 · 물 날마다)에서 심은 뒤 50일에 1번째 잎 · 92일에 2번째 잎이 무늬로 성숙
     - 사람 손: 물(#waterPot 누름) · [다음 날] · 💠 누름 · [나] 창 단추 · (한 그루 판) 모그루 팔기 [상점] [몬스테라 내놓기] → 창 → 연락 올 때까지 [다음 날] → [거래하기] → 창
   CASE=two(기본): 모그루 + 씨앗 그루(둘째 화분) — 1번째 잎 → ㉲ ㉴(앞붙임 «2째 몬스테라 · ») ㉰ ㉯ → ㉵
   CASE=one: 모그루를 사람 손으로 판 뒤(씨앗 그루가 첫 화분) — 1번째 잎 → ㉲ ㉴(앞붙임 없음) ㉮
     ⚠ 두 판 모두 «1번째 잎»으로 잰다. 씨앗 그루가 첫 화분이 되면 잎 2·3 은 shop §assignPotLeafGrades 가 프롤로그(usePrologue · 첫 화분)로 읽어 지금처럼 바로 배너다(F1 밖 · 예전부터)
   단언(390)
     ㉮ 누름 → 배너 제목 = 줄 제목 · 처음 보는 꼴이면 아래 줄 «처음 보는 꼴입니다» · album 에 그 꼴 · 줄에서 빠짐 · 3D 그 잎 성숙 그림(held 아님) · 기록 leaf:open
     ㉯ 안 누르고 [다음 날] → 그 아침 배너에 그 제목 · 줄 0 · 💠 0 · 기록 leaf:shown
     ㉰ 저장 → 다시 켜도 줄 · 💠 그대로
     ㉲ 펼치기 전: 3D 그 잎 matSkin = midSkin(held) · 그 날 ✨ 배너에 그 잎 제목이 없음
     ㉴ 💠 aria-label = «💠 {앞붙임}{n}번째 잎 펼치기» · 배너 제목 «✨ {앞붙임}{n}번째 잎 — …» 과 앞붙임이 같다(총괄 11-04 · 한 그루 · 두 그루)
     ㉵ [나] 창 «새 잎 직접 펼치기» 단추 켬 → 끔(aria-pressed · localStorage byeot.unfurl) → 다시 켬 · 아래 줄 «끄면 무늬가 바로 드러납니다»
   판 확인: 씨앗 그루가 섰다 · (one) 모그루가 팔렸다 · 그 잎이 MAXD 안에 드러날 차례가 됐다(줄에 섬 또는 곧장 드러남 — 고치기 전 판은 곧장)
   예외 0 · J 단언엔 !탈 · 빨강 먼저: 72bfab29(고치기 전 · 줄 없음 · 곧장 배너) */
import fs from 'node:fs';
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9451', OUT = process.env.OUT || null;
const SAVE_T = process.env.SAVE || 'C:/Users/pc/AppData/Local/Temp/byeot-master/d_f2394317/switchW/switchW_g_breedReg_pre.json';
const CASE = process.env.CASE === 'one' ? 'one' : 'two';
const SEED = Number(process.env.SEED || 12);
const SLOT = process.env.SLOT || 'tworoom-shop-display:7';   /* 박는 자리(심는 손의 일부) — 복사본 node 어림에서 그 판 빈 자리 중 오늘 · 60일 평균 가장 밝은 데 */
const MAXD = Number(process.env.MAXD || 75);
if (OUT) fs.mkdirSync(OUT, { recursive: true });
let bad = 0; const ok = (c, m, d = '') => { console.log(`${c ? '  OK' : 'FAIL'}  ${m}${d ? '  → ' + d : ''}`); if (!c) bad++; return c; };
if (!fs.existsSync(SAVE_T)) { ok(false, '세이브 없음', SAVE_T); process.exit(1); }
const exc = [];
const page = await launch({ width: 390, height: 844, dpr: 2 });
page.on((method, p) => { if (method === 'Runtime.exceptionThrown') exc.push(((p.exceptionDetails.exception && p.exceptionDetails.exception.description) || p.exceptionDetails.text || '').split('\n')[0].slice(0, 200)); });
await page.send('Runtime.enable');
await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true;` });
const J = async (js) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, 120000));
const shot = async n => { if (OUT) await page.shot(`${OUT}/${n}_${CASE}.png`); };
const m = (type, x, y, buttons) => page.send('Input.dispatchMouseEvent', { type, x: Math.round(x), y: Math.round(y), button: 'left', buttons, clickCount: 1 });
const tapAt = async (x, y) => { await m('mouseMoved', x, y, 0); await m('mousePressed', x, y, 1); await sleep(60); await m('mouseReleased', x, y, 0); };
const tapSel = async (sel) => {
  const measureAt = () => J(`(()=>{ const b=document.querySelector(${JSON.stringify(sel)}); if (!b) return null; b.scrollIntoView({ block: 'center' }); const q=b.getBoundingClientRect(); const x=q.left+q.width/2, y=q.top+q.height/2; const top=document.elementFromPoint(x,y); return { x, y, hit: !!(top && (top===b || b.contains(top))) }; })()`);
  let r = null;
  for (let k = 0; k < 15; k++) { const a = await measureAt(); await sleep(300); const b = await measureAt();
    r = b; if (!a || !b || b.탈) continue; if (b.hit && b.y > 10 && b.y < 834 && Math.abs(a.y - b.y) < 2) break; }
  if (r && r.hit) await tapAt(r.x, r.y);
  return r;
};
const talk = async (max = 120) => { for (let i = 0; i < max; i++) { const t = await J(`document.getElementById('stage').classList.contains('talking')`); if (t !== true) return i;
  await page.eval(`(()=>{ const b=document.getElementById('dlgBox'); if(b) b.click(); return 1; })()`, false); await sleep(180); } return max; };
const bannerOff = async () => { for (let i = 0; i < 20; i++) { const on = await J(`document.getElementById('event').classList.contains('on')`); if (on !== true) return; await J(`(()=>{ document.getElementById('event').click(); return 1; })()`); await sleep(350); } };
const shut = async () => { for (let i = 0; i < 8; i++) { const r = await J(`(()=>{ const p=document.querySelector('.pop.on'); if(!p) return 'none'; if (p.id==='evPanel') { const b=p.querySelector('button'); if (b) { b.click(); return 'ev'; } }
    if (p.id==='monthPanel') { const c=document.getElementById('monthClose'); if (c) { c.click(); return 'month'; } }
    if (p.id==='breedNamePanel') { const g=document.getElementById('breedNameGo'); if (g) { g.click(); return 'breedName'; } }   /* 사람 손 — 기본 이름 그대로 [이 이름으로 등록] */
    if (p.id==='questPanel') { const g=document.getElementById('questGo'); if (g) { g.click(); return 'quest'; } }
    const x=p.querySelector('.close,[data-close],button.ghost,button.no,button.cancel'); if(x){ x.click(); return p.id; } return 'stuck:' + p.id; })()`); if (r === 'none' || /^stuck/.test(r)) return r; await sleep(350); } return 'many'; };
const quiet = async () => { await talk(); await bannerOff(); await shut(); await talk(); };
/* 물 — 사람 손(#waterPot · 묶음 단추 · 줄 수 있을 때만) */
let watered = 0;
const water = async () => { const r = await J(`(()=>{ const b=document.getElementById('waterPot'); if (!b || b.disabled || b.style.display==='none' || !b.offsetParent) return false; b.click(); return true; })()`); if (r === true) { watered++; await sleep(500); await talk(); } };
/* [다음 날] — 그 아침 배너 글(배너가 걷히기 전에 읽는다) */
const nextDay = async () => {
  await water();
  const d0 = await J(`window.__S().day`);
  await page.eval(`(()=>{ window.__u1ev = []; const ev=document.getElementById('event'); if (!window.__u1mo) { window.__u1mo = new MutationObserver(()=>{ if (ev.classList.contains('on')) (window.__u1ev ||= []).push(ev.innerText); }); window.__u1mo.observe(ev, { attributes: true, childList: true, subtree: true }); } return 1; })()`, false);
  await page.eval(`(()=>{ const n=document.getElementById('next'); if(n && !n.disabled) n.click(); return 1; })()`, false); await sleep(900);
  if ((await J(`window.__S().day`)) === d0) await page.eval(`(()=>{ const g=document.getElementById('mealGo'); const p=g && g.closest('.pop'); if(g && (!p || p.classList.contains('on'))) g.click(); return 1; })()`, false);
  await sleep(2200);
  const evText = await J(`(window.__u1ev || []).join(' ¦ ')`);
  await quiet();
  return { d0, d1: await J(`window.__S().day`), evText };
};
const UF = `(window.__byeotUnfurl ? window.__byeotUnfurl() : null)`;
/* vis — 그려짐 · top — 그 자리 맨 위가 그 말풍선(창에 덮이면 거짓 · 사람 눈에 보이는가) */
const MARKS = `(()=>[...document.querySelectorAll('#marks .mark')].map(m=>{ const r=m.getBoundingClientRect(); const t=r.width>0 ? document.elementFromPoint(r.left+r.width/2, r.top+r.height/2) : null;
  return { a: m.getAttribute('aria-label') || m.title || '', vis: m.style.display !== 'none' && m.offsetParent !== null, top: !!(t && (t===m || m.contains(t))) }; }))()`;
const SKIN = (lb) => `(()=>{ const L=window.__leafSkinsLast; if (!L) return null; const x=(L.list||[]).find(r=>+r.leafBirth===+${JSON.stringify(lb)}); return x ? { potId: L.potId, ...x } : { potId: L.potId, none: true }; })()`;
const HEAD = `(potId)=>{ const S=window.__S(); const p=(S.pots||[]).find(x=>x&&x.id===potId); if (!p) return null; return p === S.pots[0] ? '' : ((S.pots||[]).indexOf(p)+1)+'째 몬스테라 · '; }`;
const POT = (id) => `(()=>{ const S=window.__S(); const p=(S.pots||[]).find(x=>x&&x.id===${JSON.stringify(id)}); if (!p) return null; return { idx: S.pots.indexOf(p), n: S.pots.length, slot: p.slotId || null, grades: p.leafGrades || {}, seen: p.leafGradesSeen || {}, water: p.wateredOnDay, day: S.day }; })()`;
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

await page.goto(`${BASE}/data/balance/homes.json`);
await page.eval(`(()=>{ localStorage.clear(); localStorage.setItem('byeot/save/1', ${JSON.stringify(fs.readFileSync(SAVE_T, 'utf8'))}); localStorage.setItem('byeot.guideSeen','1'); return 1; })()`, false);
await page.goto(`${BASE}/game.html`); await page.waitFor('window.__byeotBooted === true', 300000, 500); await page.waitFor('!!window.__rv', 240000, 500); await sleep(4000);
await quiet();
console.log('  실음', JSON.stringify({ case: CASE, day: await J(`window.__S().day`), pots: await J(`(window.__S().pots||[]).map(p=>p.id)`), uf: await J(UF) }));

/* ═══ 씨앗 그루 — 심는 손만 박음(D82 probe_seed_ledger 와 같은 결) ═══ */
const sown = await J(`(async()=>{ const st=await import('/src/game/state.js'); const SPM=await import('/src/game/species.js'); const loop=await import('/src/game/loop.js');
  const S=window.__S(), io=window.__io, slots=io.light.room.slots||[], size=io.light.room.size; const sky=io.light.skyFor(S.day,S.sim);
  const occ=new Set([...(S.pots||[]).map(p=>p.slotId), ...(S.cuttings||[]).map(c=>c.slotId), ...SPM.speciesPotsOf(S).map(q=>q.slotId), ...(S.emptyPots||[]).map(e=>e.slotId)].filter(Boolean));
  const b = slots.find(sl => sl.slotId === ${JSON.stringify(SLOT)}); if (!b) return { err: '박는 자리가 방에 없음' }; if (occ.has(b.slotId)) return { err: '박는 자리가 차 있음' };
  let bd=-1; try{ bd=io.light.dliOfSlot(b.slotId, loop.lightOptsOf(S, sky)); }catch(e){ bd=-1; }
  let top=null, td=-1; for (const sl of slots){ if(occ.has(sl.slotId)) continue; let d=-1; try{ d=io.light.dliOfSlot(sl.slotId, loop.lightOptsOf(S, sky)); }catch(e){ d=-1; } if(d>td){td=d;top=sl.slotId;} }
  S.shop.stock[st.SEED_ITEM_ID]=(S.shop.stock[st.SEED_ITEM_ID]||0)+1; S.shop.stock[st.SEED_POT_ITEM_ID]=(S.shop.stock[st.SEED_POT_ITEM_ID]||0)+1;
  const pot = st.plantMonsteraSeed(S, io, { slots, size, at: { x:b.x, y:b.y, z:b.z }, log: ()=>{}, seed: ${SEED} });
  pot.slotId = b.slotId; window.__redraw && window.__redraw();
  return { potId: pot.id, growthId: pot.growthId, slot: b.slotId, dli: +bd.toFixed(2), top, topDli: +td.toFixed(2), pots: S.pots.length, day: S.day }; })()`);
console.log('  [심음]', JSON.stringify(sown));
if (!ok(sown && sown.potId && !sown.탈 && !sown.err, `판 — 씨앗 그루가 섰다(${sown && sown.slot} · DLI ${sown && sown.dli} · 씨앗 ${SEED} 박음)`, JSON.stringify(sown))) { await page.close().catch(() => {}); process.exit(1); }
await sleep(1500); await quiet();

/* ═══ (one) 모그루를 사람 손으로 판다 ═══ */
if (CASE === 'one') {
  const mother = await J(`(window.__S().pots||[])[0].id`);
  /* [몬스테라 내놓기] → 창 — 그 순간 늦게 서는 창(품종 이름 등)이 덮으면 못 누른다: 매물이 섰는지 보고 창 닫고 다시(세 번까지 · red99 F1-b 판 거래 0) */
  let listed = [], tries = 0;
  for (; tries < 3 && !listed.some(l => l.refId === mother); tries++) {
    await quiet();
    await page.eval(`(()=>{ window.__byeotSheet.open('shop'); return 1; })()`, false); await sleep(1200);
    const t1 = await tapSel('#sellPlant'); await sleep(900);
    const t2 = await tapSel('#varieAskGo'); await sleep(1200); await talk();
    listed = await J(`(window.__S().shop.listings||[]).filter(l=>l.kind==='pot').map(l=>({ id: l.listingId, refId: l.refId, contact: l.contactOnDay, status: l.status }))`); if (!Array.isArray(listed)) listed = [];
    console.log('  [내놓기]', JSON.stringify({ mother, try: tries + 1, t1: t1 && t1.hit, t2: t2 && t2.hit, listed }));
    await page.eval(`(()=>{ try { window.__byeotSheet.close(); } catch (e) { void e; } return 1; })()`, false); await sleep(600);
  }
  let sold = false, deals = 0;
  for (let i = 0; i < 12 && !sold; i++) {
    await nextDay();
    await page.eval(`(()=>{ window.__byeotSheet.open('shop'); return 1; })()`, false); await sleep(1200);
    /* 모그루 매물(kind pot · refId 모그루)의 [거래하기]만 — 다른 매물(삽수)은 안 판다 */
    const lid = await J(`(()=>{ const l=(window.__S().shop.listings||[]).find(x=>x && x.kind==='pot' && x.refId===${JSON.stringify(mother)}); return l ? l.listingId : null; })()`);
    const dsel = typeof lid === 'string' ? `#marketList [data-deal="${lid}"]` : null;
    const has = dsel ? await J(`!!document.querySelector(${JSON.stringify(dsel)})`) : false;
    if (has === true) { deals++; await tapSel(dsel); await sleep(900); await tapSel('#varieAskGo'); await sleep(1500); await talk(); }
    sold = await J(`!(window.__S().pots||[]).some(p=>p.id===${JSON.stringify(mother)})`);
    await page.eval(`(()=>{ try { window.__byeotSheet.close(); } catch (e) { void e; } return 1; })()`, false); await sleep(600); await quiet();
  }
  const p1 = await J(POT(sown.potId));
  console.log('  [판 뒤]', JSON.stringify({ sold, deals, p1 }));
  if (!ok(sold === true && p1 && p1.idx === 0 && p1.n === 1, `판 — 모그루가 사람 손으로 팔렸다(씨앗 그루가 첫 화분 · Day ${p1 && p1.day})`, JSON.stringify({ sold, deals, p1 }))) { await page.close().catch(() => {}); process.exit(1); }
}

/* ═══ 그 잎이 드러날 차례까지 [다음 날] — 줄에 서거나(고친 판) 곧장 드러나거나(고치기 전 판) ═══ */
const seen0 = Object.keys((await J(POT(sown.potId))).seen || {});
let hit = null, i = 0, lastEv = '';
for (; i < MAXD; i++) {
  const u = await J(UF);
  if (u && !u.탈 && u.list && u.list.some(x => x.potId === sown.potId)) { hit = { via: 'unfurl', e: u.list.find(x => x.potId === sown.potId), u }; break; }
  const pnow = await J(POT(sown.potId));
  const newSeen = Object.keys((pnow && pnow.seen) || {}).filter(k => !seen0.includes(k));
  if (newSeen.length) { hit = { via: 'shown', lb: +newSeen[0], p: pnow, ev: lastEv }; break; }
  if (i % 10 === 0) console.log(`  · Day ${pnow && pnow.day} — 씨앗 그루 등급 ${JSON.stringify(pnow && pnow.grades)} · 물 ${pnow && pnow.water} · 물 누름 ${watered}`);
  const nd = await nextDay(); lastEv = nd.evText || '';
  if (nd.d1 === nd.d0) { console.log('  [다음 날] 막힘', JSON.stringify(nd)); break; }
}
const dayHit = await J(`window.__S().day`);
console.log('  잎', JSON.stringify({ i, dayHit, via: hit && hit.via, e: hit && hit.e, lb: hit && hit.lb }));
if (!ok(!!hit, `판 — 씨앗 그루 잎이 ${MAXD}일 안에 드러날 차례가 됐다(Day ${dayHit} · ${i}번 넘김 · ${hit ? hit.via : '없음'})`)) { await page.close().catch(() => {}); console.log(`probe_f1_unfurl(${CASE}): 빨강 ${bad}`); process.exit(1); }
await sleep(1500); await quiet(); await sleep(600);   /* 그 날 늦게 서는 창(가계부 · 품종 이름)을 닫고 잰다 — 사진이 그 창에 덮였다(red97) */
const ea = hit.e || null;
const lb = ea ? ea.leafBirth : hit.lb;
const head = await J(`(${HEAD})(${JSON.stringify(sown.potId)})`);
const wantHead = CASE === 'one' ? '' : `${sown.pots}째 몬스테라 · `;
const mk = await J(MARKS);
const sk = await J(SKIN(lb));
const evNow = hit.via === 'shown' ? hit.ev : await J(`(window.__u1ev || []).join(' ¦ ')`);
await shot('f1_a_mark');
console.log('  ㉲ ㉴', JSON.stringify({ head, wantHead, mk, sk, evNow: (evNow || '').slice(0, 200), title: ea && ea.title }));
ok(head === wantHead, `판 — 앞붙임 자가 ${CASE === 'one' ? '첫 화분(없음)' : `«${wantHead}»`}를 낸다`, JSON.stringify(head));
const titleRe = new RegExp('✨ ' + esc(wantHead) + '\\d+번째 잎');
ok(!!sk && !sk.탈 && !sk.none && sk.held === true && sk.matSkin === sk.midSkin, `㉲ 펼치기 전 3D — 그 잎 성숙 그림 자리에 중간 그림(held · ${sk && sk.matSkin})`, JSON.stringify(sk));
ok(!titleRe.test(evNow || ''), '㉲ 그 날 ✨ 배너에 그 잎 제목이 없다', (evNow || '').slice(0, 200));
const wantMark = ea ? `💠 ${wantHead}${ea.leafNo}번째 잎 펼치기` : `💠 ${wantHead}`;
ok(!!ea && Array.isArray(mk) && mk.some(x => x.a === wantMark && x.vis && x.top) && (ea.title || '').startsWith(`✨ ${wantHead}${ea.leafNo}번째 잎`),
   `㉴ 💠 «${wantMark}»(화면 맨 위) · 배너 제목 앞붙임 같음(${CASE === 'one' ? '한 그루 · 없음' : `두 그루 · «${wantHead}»`})`, JSON.stringify({ mk, title: ea && ea.title }));
if (CASE === 'two') {
  /* ㉰ 다시 켜기 */
  await sleep(1500);
  await page.goto(`${BASE}/game.html`); await page.waitFor('window.__byeotBooted === true', 300000, 500); await page.waitFor('!!window.__rv', 240000, 500); await sleep(4000);
  await quiet(); await sleep(800);
  const ur = await J(UF), mkr = await J(MARKS);
  ok(!!ea && !!ur && !ur.탈 && ur.list.some(x => x.potId === ea.potId && x.leafBirth === ea.leafBirth) && mkr.some(x => x.a === wantMark && x.vis && x.top),
     '㉰ 저장 → 다시 켜도 줄 · 💠 그대로', JSON.stringify({ list: ur && ur.list, mkr }));
  /* ㉯ 안 누르고 [다음 날] */
  const nd = await nextDay();
  const ub = await J(UF), mkb = await J(MARKS), log = await J(`(window.__stageLog||[]).filter(x=>x && /^leaf:/.test(x.kind)).slice(-3)`);
  console.log('  ㉯', JSON.stringify({ nd, ub: ub && ub.list, log }));
  ok(!!ea && !!ub && !ub.탈 && !ub.list.some(x => x.leafBirth === lb) && !mkb.some(x => x.a === wantMark) && (nd.evText || '').includes((ea.title || '').replace(/^✨ /, ''))
     && Array.isArray(log) && log.some(x => x.kind === 'leaf:shown' && +x.leafBirth === +lb),
     `㉯ 안 누르고 [다음 날] — 아침 배너에 «${ea && ea.title}» · 줄 · 💠 에서 빠짐 · 기록 leaf:shown`, JSON.stringify({ ev: (nd.evText || '').slice(0, 200), list: ub && ub.list }));
  await shot('f1_b_shown');
  /* ═══ ㉵ [나] 창 설정 ═══ */
  await quiet(); await J(`(()=>{ window.__detailOpen('me'); return 1; })()`); await sleep(700);
  const s0 = await J(`(()=>{ const b=document.getElementById('setUnfurl'); const n=document.querySelector('#dBody .setNote'); if (!b) return null; b.scrollIntoView({ block: 'center' }); const r=b.getBoundingClientRect(); const t=document.elementFromPoint(r.left+r.width/2, r.top+r.height/2); return { t: b.textContent, p: b.getAttribute('aria-pressed'), note: n && n.textContent, ls: localStorage.getItem('byeot.unfurl'), top: !!(t && (t===b || b.contains(t))) }; })()`);
  await J(`(()=>{ const b=document.getElementById('setUnfurl'); if (b) b.click(); return 1; })()`); await sleep(300);
  const s1 = await J(`(()=>{ const b=document.getElementById('setUnfurl'); return b ? { t: b.textContent, p: b.getAttribute('aria-pressed'), ls: localStorage.getItem('byeot.unfurl') } : null; })()`);
  await shot('f1_me_off');
  await J(`(()=>{ const b=document.getElementById('setUnfurl'); if (b) b.click(); return 1; })()`); await sleep(300);
  const s2 = await J(`(()=>{ const b=document.getElementById('setUnfurl'); return b ? { t: b.textContent, p: b.getAttribute('aria-pressed'), ls: localStorage.getItem('byeot.unfurl') } : null; })()`);
  console.log('  ㉵', JSON.stringify({ s0, s1, s2 }));
  ok(!!s0 && !s0.탈 && s0.top === true && s0.t === '켬' && s0.p === 'true' && s0.note === '끄면 무늬가 바로 드러납니다' && !!s1 && s1.t === '끔' && s1.p === 'false' && s1.ls === '0' && !!s2 && s2.t === '켬' && s2.ls === '1',
     '㉵ [나] 창 «새 잎 직접 펼치기» 켬 → 끔(byeot.unfurl 0) → 켬 · 아래 줄 «끄면 무늬가 바로 드러납니다»', JSON.stringify({ s0, s1, s2 }));
} else {
  /* ㉮ 💠 누름(진짜 탭) */
  const albumBefore = (hit.u && hit.u.album) || {};
  const fresh = !!(ea && ea.card) && albumBefore[ea.card] == null;
  const pos = await J(`(()=>{ const m=[...document.querySelectorAll('#marks .mark')].find(x=>(x.getAttribute('aria-label')||'')===${JSON.stringify(wantMark)}); if (!m) return null; const r=m.getBoundingClientRect(); return { x: r.left + r.width/2, y: r.top + r.height/2 }; })()`);
  if (pos && !pos.탈) await tapAt(pos.x, pos.y);
  await sleep(700);
  const ev = await J(`(()=>{ const e=document.getElementById('event'); return { on: e.classList.contains('on'), text: e.innerText, img: !!e.querySelector('img.bcard') }; })()`);
  await shot('f1_b_open');
  const ua = await J(UF), sk2 = await J(SKIN(lb)), log = await J(`(window.__stageLog||[]).filter(x=>x && /^leaf:/.test(x.kind)).slice(-2)`);
  /* 카메라 — §focusOnMonstera 는 0.9초 뒤 당긴다(SPEAR_ZOOM_WAIT_MS) · 방뷰가 지금 들어가 있는 자리(focusedSlot)가 그 그루 열쇠(자유 좌표면 free:{id})인가 */
  await sleep(900);
  const cam = await J(`(()=>{ const rv=window.__rv; return { f: rv ? rv.focusedSlot : null }; })()`);
  await shot('f1_b_cam');
  const camOk = !!cam && !cam.탈 && (cam.f === `free:${sown.potId}` || cam.f === sown.slot);
  console.log('  ㉮', JSON.stringify({ pos, ev, ua, sk2, log, fresh, cam }));
  ok(!!ea && !!pos && !pos.탈 && !ev.탈 && ev.on && (ev.text || '').includes((ea.title || '').replace(/^✨ /, '')) && (!fresh || (ev.text || '').includes('처음 보는 꼴입니다'))
     && !!ua && !ua.list.some(x => x.leafBirth === lb) && (!ea.card || ua.album[ea.card] != null)
     && !!sk2 && !sk2.none && sk2.held === false && Array.isArray(log) && log.some(x => x.kind === 'leaf:open' && +x.leafBirth === +lb) && camOk,
     `㉮ 💠 탭 → 배너 «${ea && ea.title}»${fresh ? ' + «처음 보는 꼴입니다»' : ''} · album · 줄에서 빠짐 · 3D 성숙 그림 · 기록 leaf:open · 카메라 그 그루(${cam && cam.f})`, JSON.stringify({ ev, album: ua && ua.album, sk2, cam }));
  await bannerOff(); await quiet();
}
ok(exc.length === 0, '처리 안 된 예외 0', exc.slice(0, 3).join(' / '));
try { await page.close(); } catch (e) { console.log('  (탭 닫기 탈)', e.message); }
console.log(bad ? `probe_f1_unfurl(${CASE}): 빨강 ${bad}` : `probe_f1_unfurl(${CASE}): 다 통과`);
process.exit(bad ? 1 : 0);
