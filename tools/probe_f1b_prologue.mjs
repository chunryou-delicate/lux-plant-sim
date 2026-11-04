/* F1-b 프롤로그는 튜토 모그루에만(core 11-04 · 총괄 흠 가름) — 모그루를 판 뒤 씨앗 그루가 첫 화분이 된 판(probe_d100b 판의 결)
   판: switchW_g_breedReg_pre(투룸 Day 1400 · 등 3 · d_f2394317 하네스 dump · 씨앗 g) — ⚠ 씨앗만 박음(심는 날 · 자리 · 씨앗 고름) · 나머지 사람 손(probe_f1_unfurl CASE=one 과 같은 손)
     - 박는 것: 심는 손 하나 — state §plantMonsteraSeed(S, io, { at: SLOT 자리(가게 진열대 7 · 그 판 빈 자리 중 가장 밝은 데), seed: 4 }) · 재고(씨앗 1 · 그릇 1) 채움(D82 probe_seed_ledger 결)
       같은 함수(→ growth.addPlant({ seed })) · 다른 값(게임 §sowEmptyPot 은 §newGrowthSeed 의 uint32 · 이 자는 4)
     - 사람 손: 물(#waterPot) · [다음 날] · 모그루 팔기 [상점] [몬스테라 내놓기] → 창 → 연락 올 때까지 [다음 날] → [거래하기] → 창
     - 씨앗 4: 복사본 node 어림에서 잎 1 은 무지 · 심은 뒤 88일 잎 2 가 첫 무늬로 성숙 — 그날 ✂ 문(다 자란 무늬 잎 둘 · §halfSceneDue)이 안 열려
       «무늬를 처음 본 날» 장면이 ✂ 하프문 장면에 안 가려진다(씨앗 12 판은 잎 1 · 2 가 다 하프문이라 그날 ✂ 장면이 'seen' 을 덮어 ㉰ 를 못 갈랐다 · red100)
   단언(390)
     ㉯ 씨앗 그루 잎 2 가 드러날 때 프롤로그 길이 아니다 — F1 펼침 줄(S.unfurl)에 서고 그날 ✨ 배너에 그 잎이 없다(프롤로그 잎은 줄에 안 서고 곧장 배너 · 총괄 F1 가름)
        ⚠ 드러남 표지(leafGradesSeen)는 줄에 넣는 날에도 참이 된다(shop §assignPotLeafGrades) — 그것으로 안 가른다
     ㉰ 심은 뒤 «무늬를 처음 본 날» 장면 0(__stageLog leaf:seen) · ✂ 문이 연 날(cutGate due) 밖의 «하프문» 장면 0(leaf:half)
     ㉮(적기만) 씨앗 그루 잎 2 · 3 장부 등급과 그 잎의 빛 등급 후보(shop §varieGradeFromLight × 세 띠) — 빛이 산반을 낼 수도 있어 빨강 먼저를 못 보임 · 등급 셈은 node test_f1b_prologue
   판 확인: 씨앗 그루가 섰다 · 모그루가 사람 손으로 팔렸다 · 잎 2 가 MAXD 안에 드러날 차례가 됐다
   예외 0 · J 단언엔 !탈 · 빨강 먼저: F1 판(고치기 전 — 잎 2 가 곧장 배너 · leaf:seen) */
import fs from 'node:fs';
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9451', OUT = process.env.OUT || null;
const SAVE_T = process.env.SAVE || 'C:/Users/pc/AppData/Local/Temp/byeot-master/d_f2394317/switchW/switchW_g_breedReg_pre.json';
const SEED = Number(process.env.SEED || 4);
const SLOT = process.env.SLOT || 'tworoom-shop-display:7';   /* 박는 자리(심는 손의 일부) — 복사본 node 어림에서 그 판 빈 자리 중 오늘 · 60일 평균 가장 밝은 데 */
const MAXD = Number(process.env.MAXD || 115);
if (OUT) fs.mkdirSync(OUT, { recursive: true });
let bad = 0; const ok = (c, m, d = '') => { console.log(`${c ? '  OK' : 'FAIL'}  ${m}${d ? '  → ' + d : ''}`); if (!c) bad++; return c; };
if (!fs.existsSync(SAVE_T)) { ok(false, '세이브 없음', SAVE_T); process.exit(1); }
const exc = [];
const page = await launch({ width: 390, height: 844, dpr: 2 });
page.on((method, p) => { if (method === 'Runtime.exceptionThrown') exc.push(((p.exceptionDetails.exception && p.exceptionDetails.exception.description) || p.exceptionDetails.text || '').split('\n')[0].slice(0, 200)); });
await page.send('Runtime.enable');
await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true;` });
const J = async (js) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, 120000));
const shot = async n => { if (OUT) await page.shot(`${OUT}/${n}.png`); };
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
const lines = [];
const talk = async (max = 120) => { for (let i = 0; i < max; i++) { const t = await J(`(()=>({ on: document.getElementById('stage').classList.contains('talking'), l: (document.getElementById('dlgText')||{}).textContent || '' }))()`); if (!t || t.on !== true) return i;
  if (t.l && lines[lines.length - 1] !== t.l) lines.push(t.l);
  await page.eval(`(()=>{ const b=document.getElementById('dlgBox'); if(b) b.click(); return 1; })()`, false); await sleep(180); } return max; };
const bannerOff = async () => { for (let i = 0; i < 20; i++) { const on = await J(`document.getElementById('event').classList.contains('on')`); if (on !== true) return; await J(`(()=>{ document.getElementById('event').click(); return 1; })()`); await sleep(350); } };
const shut = async () => { for (let i = 0; i < 8; i++) { const r = await J(`(()=>{ const p=document.querySelector('.pop.on'); if(!p) return 'none'; if (p.id==='evPanel') { const b=p.querySelector('button'); if (b) { b.click(); return 'ev'; } }
    if (p.id==='monthPanel') { const c=document.getElementById('monthClose'); if (c) { c.click(); return 'month'; } }
    if (p.id==='breedNamePanel') { const g=document.getElementById('breedNameGo'); if (g) { g.click(); return 'breedName'; } }   /* 사람 손 — 기본 이름 그대로 [이 이름으로 등록] */
    if (p.id==='questPanel') { const g=document.getElementById('questGo'); if (g) { g.click(); return 'quest'; } }
    const x=p.querySelector('.close,[data-close],button.ghost,button.no,button.cancel'); if(x){ x.click(); return p.id; } return 'stuck:' + p.id; })()`); if (r === 'none' || /^stuck/.test(r)) return r; await sleep(350); } return 'many'; };
const quiet = async () => { await talk(); await bannerOff(); await shut(); await talk(); };
let watered = 0;
const water = async () => { const r = await J(`(()=>{ const b=document.getElementById('waterPot'); if (!b || b.disabled || b.style.display==='none' || !b.offsetParent) return false; b.click(); return true; })()`); if (r === true) { watered++; await sleep(500); await talk(); } };
const evAll = [];
const nextDay = async () => {
  await water();
  const d0 = await J(`window.__S().day`);
  await page.eval(`(()=>{ window.__u1ev = []; const ev=document.getElementById('event'); if (!window.__u1mo) { window.__u1mo = new MutationObserver(()=>{ if (ev.classList.contains('on')) (window.__u1ev ||= []).push(ev.innerText); }); window.__u1mo.observe(ev, { attributes: true, childList: true, subtree: true }); } return 1; })()`, false);
  await page.eval(`(()=>{ const n=document.getElementById('next'); if(n && !n.disabled) n.click(); return 1; })()`, false); await sleep(900);
  if ((await J(`window.__S().day`)) === d0) await page.eval(`(()=>{ const g=document.getElementById('mealGo'); const p=g && g.closest('.pop'); if(g && (!p || p.classList.contains('on'))) g.click(); return 1; })()`, false);
  await sleep(2200);
  const evText = await J(`(window.__u1ev || []).join(' ¦ ')`); if (evText) evAll.push(evText);
  await quiet();
  return { d0, d1: await J(`window.__S().day`), evText };
};
const UF = `(window.__byeotUnfurl ? window.__byeotUnfurl() : null)`;
const POT = (id) => `(()=>{ const S=window.__S(); const p=(S.pots||[]).find(x=>x&&x.id===${JSON.stringify(id)}); if (!p) return null; return { idx: S.pots.indexOf(p), n: S.pots.length, growthId: p.growthId || null, grades: p.leafGrades || {}, seen: p.leafGradesSeen || {}, water: p.wateredOnDay, day: S.day }; })()`;
const SCENES = `(window.__stageLog||[]).filter(x=>x && (x.kind==='leaf:seen' || x.kind==='leaf:half' || (x.kind==='cutGate' && x.due))).map(x=>({ day: x.day, kind: x.kind }))`;

await page.goto(`${BASE}/data/balance/homes.json`);
await page.eval(`(()=>{ localStorage.clear(); localStorage.setItem('byeot/save/1', ${JSON.stringify(fs.readFileSync(SAVE_T, 'utf8'))}); localStorage.setItem('byeot.guideSeen','1'); return 1; })()`, false);
await page.goto(`${BASE}/game.html`); await page.waitFor('window.__byeotBooted === true', 300000, 500); await page.waitFor('!!window.__rv', 240000, 500); await sleep(4000);
await quiet();
const day0 = await J(`window.__S().day`);
console.log('  실음', JSON.stringify({ day: day0, pots: await J(`(window.__S().pots||[]).map(p=>[p.id, p.growthId||null])`), scenes: await J(SCENES) }));
/* ═══ 씨앗 그루 — 심는 손만 박음 ═══ */
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
if (!ok(sown && sown.potId && !sown.탈 && !sown.err, `판 — 씨앗 그루가 섰다(${sown && sown.slot} · DLI ${sown && sown.dli} · 씨앗 ${SEED} 박음 · ${sown && sown.growthId})`, JSON.stringify(sown))) { await page.close().catch(() => {}); process.exit(1); }
await sleep(1500); await quiet();
const scenes0 = await J(SCENES);
/* ═══ 모그루를 사람 손으로 판다 ═══ */
const mother = await J(`(window.__S().pots||[])[0].id`);
/* [몬스테라 내놓기] → 창 — 늦게 서는 창이 덮으면 못 누른다: 매물이 섰는지 보고 창 닫고 다시(세 번까지 · red99 거래 0) */
let listed = [];
for (let k = 0; k < 3 && !listed.some(l => l.refId === mother); k++) {
  await quiet();
  await page.eval(`(()=>{ window.__byeotSheet.open('shop'); return 1; })()`, false); await sleep(1200);
  const t1 = await tapSel('#sellPlant'); await sleep(900);
  const t2 = await tapSel('#varieAskGo'); await sleep(1200); await talk();
  listed = await J(`(window.__S().shop.listings||[]).filter(l=>l.kind==='pot').map(l=>({ id: l.listingId, refId: l.refId, contact: l.contactOnDay, status: l.status }))`); if (!Array.isArray(listed)) listed = [];
  console.log('  [내놓기]', JSON.stringify({ mother, try: k + 1, t1: t1 && t1.hit, t2: t2 && t2.hit, listed }));
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
console.log('  [판 뒤]', JSON.stringify({ mother, sold, deals, p1 }));
if (!ok(sold === true && p1 && p1.idx === 0 && p1.n === 1, `판 — 모그루가 사람 손으로 팔렸다(씨앗 그루가 첫 화분 · Day ${p1 && p1.day})`, JSON.stringify({ sold, deals, p1 }))) { await page.close().catch(() => {}); process.exit(1); }
/* ═══ 잎 2 가 드러날 차례까지 ═══ */
let hit = null, i = 0;
for (; i < MAXD; i++) {
  const pn = await J(POT(sown.potId)), u = await J(UF);
  const keys = Object.keys((pn && pn.grades) || {}).map(Number).sort((a, b) => a - b);
  /* 잎 번호는 생장 정본 줄 차례(shop §assignPotLeafGrades 와 같은 셈) — 판 뒤엔 씨앗 그루가 첫 화분이라 지금 꽂힌 그루(state §selectLeadPlant)다 · 읽기만 */
  const rows = await J(`(()=>{ const g=window.__io.growth; const cur = typeof g.current==='function' ? g.current() : null; const ls=(g.leafState()||[]).filter(r=>r&&Number.isFinite(r.leafBirth)).sort((a,b)=>a.leafBirth-b.leafBirth);
    return { cur, rows: ls.map((r,k)=>({ no: k+1, lb: r.leafBirth, varie: !!r.varie, matured: !!r.matured })) }; })()`);
  const tgt = rows && !rows.탈 && rows.cur === sown.growthId ? (rows.rows || []).find(r => (r.no === 2 || r.no === 3) && r.varie && pn && pn.grades[r.lb] != null) : null;
  const lb2 = tgt ? tgt.lb : null;
  if (i % 10 === 0) console.log(`  · 잎 줄 ${JSON.stringify(rows && rows.rows)} · 꽂힌 그루 ${rows && rows.cur}`);
  if (lb2 != null) {
    const inUf = !!(u && !u.탈 && u.list && u.list.some(x => x.potId === sown.potId && +x.leafBirth === lb2));
    const seen2 = !!(pn.seen && pn.seen[lb2]);
    if (inUf || seen2) { hit = { lb2, no: tgt.no, inUf, seen2, pn, u, keys, l23: (rows.rows || []).filter(r => (r.no === 2 || r.no === 3) && pn.grades[r.lb] != null).map(r => r.lb) }; break; }
  }
  if (i % 10 === 0) console.log(`  · Day ${pn && pn.day} — 씨앗 그루 장부 ${JSON.stringify(pn && pn.grades)} · 드러남 ${JSON.stringify(pn && pn.seen)} · 물 누름 ${watered}`);
  const nd = await nextDay(); if (nd.d1 === nd.d0) { console.log('  [다음 날] 막힘', JSON.stringify(nd)); break; }
}
const dayHit = await J(`window.__S().day`);
console.log('  잎 2', JSON.stringify({ i, dayHit, hit: hit && { lb2: hit.lb2, inUf: hit.inUf, seen2: hit.seen2, grades: hit.pn.grades, list: hit.u && hit.u.list } }));
if (!ok(!!hit, `판 — 씨앗 그루 잎 2 가 ${MAXD}일 안에 드러날 차례가 됐다(Day ${dayHit} · ${i}번 넘김)`)) { await page.close().catch(() => {}); console.log(`probe_f1b_prologue: 빨강 ${bad}`); process.exit(1); }
await shot('f1b_leaf2');
/* ㉮ 적기만 — 장부 등급 · 빛 등급 후보 */
const cand = await J(`(async()=>{ const sh=await import('/src/game/shop.js'); const S=window.__S(); const seed=(S.sim&&S.sim.seed)||0; const out={};
  for (const lb of ${JSON.stringify(hit.l23)}) { const roll=sh.marketHash(seed, 'LG${sown.potId}#'+lb, 21); out[lb]={ dark: sh.varieGradeFromLight('dark', roll), mid: sh.varieGradeFromLight('mid', roll), bright: sh.varieGradeFromLight('bright', roll) }; }
  return out; })()`);
console.log('  ㉮(적기만) 장부', JSON.stringify(hit.pn.grades), '· 빛 후보', JSON.stringify(cand));
const lightOk = hit.l23.every(lb => cand && cand[lb] && Object.values(cand[lb]).includes(hit.pn.grades[lb]));
console.log(`  ·  ㉮(적기만) 씨앗 그루 잎 2 · 3 장부 등급이 빛 등급 후보 안에 있다: ${lightOk}`);
/* ㉯ 잎 2 는 F1 펼침 줄로 */
const evDay = evAll.length ? evAll[evAll.length - 1] : '';
ok(hit.inUf === true && !new RegExp('✨ ' + hit.no + '번째 잎').test(evDay), `㉯ 씨앗 그루 잎 ${hit.no} 가 드러날 때 프롤로그 길이 아니다 — 펼침 줄에 섰고 그날 ✨ 배너에 없다(곧장 드러남 아님)`, JSON.stringify({ inUf: hit.inUf, seen2: hit.seen2, ev: evDay.slice(0, 200) }));
/* ㉰ 장면 0 */
const scenes = await J(SCENES);
const sc = (Array.isArray(scenes) ? scenes : []).filter(x => x.day >= day0).filter(x => !(scenes0 || []).some(y => y.day === x.day && y.kind === x.kind));
const cutDays = new Set(sc.filter(x => x.kind === 'cutGate').map(x => x.day));
const after = sc.filter(x => x.kind === 'leaf:seen' || (x.kind === 'leaf:half' && !cutDays.has(x.day)));
const seenLine = lines.find(l => /무늬/.test(l) && /처음/.test(l)) || null;
ok(Array.isArray(scenes) && after.length === 0, '㉰ 심은 뒤 «무늬를 처음 본 날» 장면 0 · ✂ 문 날 밖 «하프문» 장면 0(__stageLog leaf:seen · leaf:half)', JSON.stringify({ after, cut: [...cutDays], seenLine }));
ok(exc.length === 0, '처리 안 된 예외 0', exc.slice(0, 3).join(' / '));
try { await page.close(); } catch (e) { console.log('  (탭 닫기 탈)', e.message); }
console.log(bad ? `probe_f1b_prologue: 빨강 ${bad}` : 'probe_f1b_prologue: 다 통과');
process.exit(bad ? 1 : 0);
