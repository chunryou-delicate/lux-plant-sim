/* 비판 8판 8C4 (가) 자(core 11-03 · 총괄 가름) — 투룸 첫날 짐 풀기: 서는 자리 · 자동 자리 · 손가락 · 길 경고가 «놓을 수 있는 칸» 한 자
   ⛔ 비판 8판 MAJOR #4(A_043 · 048 · 049 · 051z · 052 · 057 · 058 · 067): 삽수 → 어두운 칸 + «제일 밝은 데는 3단 선반 8번 칸» · 몬스테라 → «가구 N번 칸… 문 앞 길이 막혀» ·
      손가락 «여기로 끌어 보세요 — 3단 선반 8번 칸» 세 번(그 칸엔 이미 삽수 · 진열대에 막혀 손이 안 닿는 칸)
   뿌리(core 진단 11-03): 투룸 현관 앞이 침대 · 소파 · 낮은 선반에 둘러싸여 섬(house 배치 몫) — 가게 방에 선 주인공은 놓기 전부터 현관에 못 감 →
      확인 바가 무엇을 놓든 «여기 두면 문 앞 길이 막힙니다»(놓은 탓 아님) · 글 · 손가락 · 자동 자리가 자 셋(손 안 닿는 3단 선반 · 찬 칸을 권함)
   판: 투룸 가게 첫날 세이브(C:/Users/pc/byeot-core-keep/critic8/tworoom_shop_first.json · 비판 8판 ready_d445 → [계약한다] → [가게를 연다] · core 가 떴다 · 프로필 안 건드림)
   단언(390)
     ㉮ 주인공은 가게 방(칸막이 왼쪽)에 서고 진열대 칸에 닿는다(서는 자리를 현관 섬으로 옮기는 고침을 잡는다 · 총괄 11-03)
     ㉯ 가방 삽수 [누름] — 놓인 칸에 사람이 닿고 · 알림이 손 안 닿는 «3단 선반» 칸을 «제일 밝은 데»로 안 말함
     ㉰ 가방 몬스테라 [누름] — 확인 바가 «문 앞 길이 막힙니다»를 안 말함(놓기 전부터 막힌 것을 놓은 탓으로 안 말함)
     ㉱ 놓은 몬스테라 [옮기기] — 손가락 «여기로 끌어 보세요 — X» · 아래글 «X이 제일 밝습니다»의 X 가 같고 · 3단 선반이 아니고 · 그 칸이 비어 있음
     ㉳ 6판 S90 꼴(원룸 · 화분 어둠 · 창턱 1번 칸에 무순 판 · 어두운 빈 칸 하나 · 다른 빈 칸 다 어두움) — 경고 goBestTaken «… 제일 밝은 {칸}에는 {무순 판|시루}가 있습니다»(§11 · 놓을 수 있는 best 로 좁히다 죽었던 것)
     ㉴ 투룸 몬스테라를 어두운 칸으로 옮기면 — «… 놓을 수 있는 제일 밝은 자리는 {칸}입니다»(§11 글)
     ㉵ 360 — [옮기기] 아래글 «놓을 수 있는 데는 {X}이 제일 밝습니다»가 한 줄
     ㉲ 참 경고(총괄 조건 2) — 원룸(현관과 이어진 판 · 비판 6판 S Day 97 세이브)에서 빈 화분을 문 앞 바닥에 놓으면 길 경고는 그대로 «문 앞 길이 막힙니다»
     예외 0 · J 단언엔 !탈 */
import fs from 'node:fs';
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9451', OUT = process.env.OUT || null;
const SAVE = process.env.SAVE || 'C:/Users/pc/byeot-core-keep/critic8/tworoom_shop_first.json';
const SAVE_S = process.env.SAVE_S || 'C:/Users/pc/byeot-core-keep/critic6/saveS_d97.json';
if (OUT) fs.mkdirSync(OUT, { recursive: true });
let bad = 0; const ok = (c, m, d = '') => { console.log(`${c ? '  OK' : 'FAIL'}  ${m}${d ? '  → ' + d : ''}`); if (!c) bad++; };
if (!fs.existsSync(SAVE)) { ok(false, '세이브 없음', SAVE); process.exit(1); }
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
await page.goto(`${BASE}/data/balance/homes.json`);
await page.eval(`(()=>{ localStorage.clear(); localStorage.setItem('byeot/save/1', ${JSON.stringify(fs.readFileSync(SAVE, 'utf8'))}); localStorage.setItem('byeot.guideSeen','1'); return 1; })()`, false);
await page.goto(`${BASE}/game.html`); await page.waitFor('window.__byeotBooted === true', 300000, 500); await page.waitFor('!!window.__rv', 240000, 500); await sleep(4000);
await dlg(); await bannerOff(); await sleep(1200);
/* ═══ ㉮ ═══ */
const a = await J(`(()=>{ const rv=window.__rv; const r = rv.reach ? rv.reach('tworoom-shop-display:7') : null; return { door: rv.doorReach ? rv.doorReach() : null, person: rv.personAt ? rv.personAt() : null, display: r ? r.ok !== false : null, room: window.__S().home.room }; })()`);
console.log('  ㉮ 켜자마자', JSON.stringify(a));
if (OUT) await page.shot(`${OUT}/390_c8c_start.png`);
ok(!a.탈 && a.room === 'tworoom' && !!a.person && a.person.x < -0.6 && a.display === true, '㉮ 주인공은 가게 방(칸막이 x -0.6 왼쪽)에 서고 진열대 칸(가구 8번)에 닿는다', JSON.stringify({ person: a.person, display: a.display, door: a.door }));
/* ═══ ㉯ 삽수 ═══ */
await J(`(()=>{ window.__byeotSheet.open('bag'); return 1; })()`); await sleep(1500); await settle();
const tb = await J(`(()=>{ const c=document.querySelector('#pageBag .bagslot[data-place="cutting:cut_01"]'); if (c) c.click(); return !!c; })()`); await sleep(2000); await settle();
const b = await J(`(()=>{ const c=(window.__S().cuttings||[]).find(x=>x.id==='cut_01'); const sid=c ? c.slotId : null; const r = sid && window.__rv.reach ? window.__rv.reach(sid) : null;
  return { slot: sid, reach: r ? r.ok !== false : null, ev: (document.getElementById('event').innerText||'').replace(/\\s+/g,' ').slice(0,200) }; })()`);
console.log('  ㉯ 삽수 누름', JSON.stringify({ tb, b }));
if (OUT) await page.shot(`${OUT}/390_c8c_cut.png`);
ok(!b.탈 && tb && !!b.slot && b.reach === true, '㉯ 가방 삽수 [누름] — 놓인 칸에 사람이 닿는다', JSON.stringify({ slot: b.slot, reach: b.reach }));
ok(!b.탈 && !/3단 선반/.test(b.ev || ''), '㉯ 알림이 손 안 닿는 «3단 선반» 칸을 «제일 밝은 데»로 안 말함', JSON.stringify(b.ev));
await bannerOff();
/* ═══ ㉰ 몬스테라 ═══ */
await J(`(()=>{ window.__byeotSheet.open('bag'); return 1; })()`); await sleep(1500); await settle();
const tc = await J(`(()=>{ const c=[...document.querySelectorAll('#pageBag .bagslot')].find(e=>/축복받은/.test(e.textContent||'')); if (c) c.click(); return c ? (c.dataset.place || 'x') : null; })()`); await sleep(2200); await settle();
const c = await J(`(()=>{ const pc=document.getElementById('placeConfirm'); return { confirm: !!(pc && pc.offsetParent), who: (document.getElementById('placeConfirmWho')||{}).textContent || null, warn: (document.getElementById('placeConfirmWarn')||{}).textContent || '' }; })()`);
console.log('  ㉰ 몬스테라 누름', JSON.stringify({ tc, c }));
if (OUT) await page.shot(`${OUT}/390_c8c_pot.png`);
ok(!c.탈 && c.confirm && !/문 앞 길이 막/.test(c.warn), '㉰ 가방 몬스테라 [누름] — 확인 바가 «문 앞 길이 막힙니다»를 안 말함', JSON.stringify({ who: c.who, warn: c.warn }));
await J(`(()=>{ const b=document.getElementById('placeOk'); if (b && b.offsetParent) b.click(); return !!b; })()`); await sleep(2000); await dlg(); await bannerOff();
/* ═══ ㉱ [옮기기] 손가락 · 아래글 ═══ */
const key = await J(`(()=>{ const p=(window.__S().pots||[])[0]; if (!p) return null; const rows = window.__rv.plants ? window.__rv.plants() : []; const r = rows.find(q => q && q.potId === p.id); return r ? r.key : (p.slotId || null); })()`);
await J(`(()=>{ window.__picked.select(${JSON.stringify(key)}); return 1; })()`); await sleep(900); await settle();
await J(`(()=>{ const b=document.getElementById('pickMove'); if (b && b.offsetParent) b.click(); return !!b; })()`); await sleep(1200); await settle();
const d = await J(`(async()=>{ try { window.__byeotHint(); } catch (e) { void e; } await new Promise(r=>setTimeout(r,900));
  const h=document.getElementById('hint'); const say=(h.querySelector('.say')||{}).textContent || ''; const lab=(document.getElementById('dropLabel')||{}).textContent || '';
  const m=/여기로 끌어 보세요 — (.+)$/.exec(say); const g = window.__byeotGuideBright ? window.__byeotGuideBright() : null;
  const S=window.__S(); const taken = [...(S.cuttings||[]).map(x=>x.slotId), ...(S.pots||[]).map(x=>x.slotId)].filter(Boolean);
  return { on: h.classList.contains('on'), say, lab, goal: m ? m[1] : null, usable: g && g.usable, taken }; })()`);
console.log('  ㉱ [옮기기]', JSON.stringify({ key, d }));
if (OUT) await page.shot(`${OUT}/390_c8c_move.png`);
ok(!d.탈 && d.on && !!d.goal && !/3단 선반/.test(d.goal), '㉱ [옮기기] 손가락 «여기로 끌어 보세요 — X» — X 가 손 안 닿는 3단 선반이 아님', JSON.stringify({ say: d.say }));
ok(!d.탈 && !!d.goal && d.lab === `놓을 수 있는 데는 ${d.goal}${/[가-힣]/.test(d.goal.slice(-1)) && (d.goal.slice(-1).charCodeAt(0) - 0xac00) % 28 ? '이' : '가'} 제일 밝습니다`, '㉱ 아래글이 손가락과 같은 칸 «놓을 수 있는 데는 X이 제일 밝습니다»(§11)', JSON.stringify({ goal: d.goal, lab: d.lab }));
ok(!d.탈 && !!d.usable && !d.taken.includes(d.usable), '㉱ 손가락이 짚는 칸(§usableBrightSlot)은 비어 있음(삽수 · 화분이 앉은 칸 아님)', JSON.stringify({ usable: d.usable, taken: d.taken }));
await J(`(()=>{ const b=document.getElementById('placeCancel') || document.getElementById('pickCancel'); if (b && b.offsetParent) b.click(); try { window.__picked.clear(); } catch (e) { void e; } return 1; })()`); await sleep(1000);
/* ═══ ㉴ 투룸 몬스테라 → 어두운 칸([📍 자리] 목록에서 가장 어두운 줄) — «놓을 수 있는 제일 밝은 자리는» ═══ */
await J(`(()=>{ window.__picked.select(${JSON.stringify(key)}); return 1; })()`); await sleep(900); await settle();
await J(`(()=>{ const b=document.getElementById('pickWhere'); if (b && b.offsetParent) b.click(); return !!b; })()`); await sleep(1200); await settle();
const dk = await J(`(()=>{ const rows=[...document.querySelectorAll('#slotList [data-slot]')].filter(b=>!b.disabled); rows.sort((a,b)=>(+a.dataset.dli||0)-(+b.dataset.dli||0)); const r=rows[0]; if (r) r.click(); return r ? r.dataset.slot : null; })()`); await sleep(1500);
const f = await J(`(()=>{ const p=(window.__S().pots||[])[0]; return { slot: p && p.slotId, warn: p && window.__byeotDarkWarn ? window.__byeotDarkWarn(p.id) : null }; })()`);
console.log('  ㉴ 어두운 칸으로', JSON.stringify({ dk, f }));
ok(!f.탈 && f.slot === dk && /^여기는 몬스테라가 자라기엔 어둡습니다 — 놓을 수 있는 제일 밝은 자리는 .+입니다$/.test(f.warn || '') && !/3단 선반/.test(f.warn || ''), '㉴ 투룸 몬스테라를 어두운 칸으로 — «… 놓을 수 있는 제일 밝은 자리는 {칸}입니다»(§11 · 3단 선반 아님)', JSON.stringify(f));
await bannerOff();
/* ═══ ㉳ 6판 S90 꼴 — goBestTaken(critic6_a ㉳-2 와 같은 손질 S97y: 화분 ↔ 책상 시루 맞바꿈) ═══ */
{ const w = JSON.parse(fs.readFileSync(SAVE_S, 'utf8')); const st = w.state; const fp = st.firstPlay;
  const all = [...fp.beansprout.pots, ...Object.values(fp.crops).flatMap(v => (v && v.pots) || [])];
  const pot = st.pots[0], siru = all.find(x => x.slotId === 'banjiha-desk:0');
  const ps = pot.slotId, pa = pot.at; pot.slotId = siru.slotId; pot.at = { ...siru.at }; siru.slotId = ps; siru.at = { ...pa };
  /* plan §11 ㉲ «다른 빈 칸이 다 어두우면» — 어두운 아랫단 칸(banjiha-etagere:2 · 하루 빛 0.08) 하나를 비운다(그 시루는 가방으로).
     ⚠ 빈 칸이 아예 없으면 놓을 수 있는 best 가 없어 옛 자로 떨어져 되돌림을 못 잡았다(11-03 첫 잼 · §11 전 판도 초록) */
  { const low = all.find(x => x.slotId === 'banjiha-etagere:2'); if (low) { low.slotId = null; low.at = null; } }
  await page.goto(`${BASE}/data/balance/homes.json`);
  await page.eval(`(()=>{ localStorage.clear(); localStorage.setItem('byeot/save/1', ${JSON.stringify(JSON.stringify(w))}); localStorage.setItem('byeot.guideSeen','1'); return 1; })()`, false);
  await page.goto(`${BASE}/game.html`); await page.waitFor('window.__byeotBooted === true', 300000, 500); await page.waitFor('!!window.__rv', 240000, 500); await sleep(4000);
  await dlg(); await bannerOff(); await sleep(1200); }
const y = await J(`(()=>{ const S=window.__S(); const p=(S.pots||[])[0]; const g = window.__byeotGuideBright ? window.__byeotGuideBright() : null;
  return { pd: window.__byeotPotDark ? window.__byeotPotDark() : null, warn: window.__byeotDarkWarn && p ? window.__byeotDarkWarn(p.id) : null, usable: g ? (g.usable === undefined ? '창구 없음' : g.usable) : null }; })()`);
console.log('  ㉳ 6판 S90 꼴', JSON.stringify(y));
ok(!y.탈 && y.pd && y.pd.kind === 'clear', '㉳ 판 — 화분 어둠 · 밝은 칸은 다 참(작물) · 어두운 빈 칸 하나', JSON.stringify({ pd: y.pd, usable: y.usable }));
ok(!y.탈 && /^여기는 몬스테라가 자라기엔 어둡습니다 — 제일 밝은 .+에는 (무순 판|시루)가 있습니다$/.test(String(y.warn)), '㉳ goBestTaken «제일 밝은 {칸}에는 {무순 판|시루}가 있습니다»(6판 S90 · §11)', String(y.warn));
/* ═══ ㉲ 참 경고 — 원룸(현관과 이어진 판)에서 빈 화분을 문 앞 바닥에 ═══ */
{ const w = JSON.parse(fs.readFileSync(SAVE_S, 'utf8')); w.state.shop.stock.pot = 2;
  for (const p of w.state.firstPlay.beansprout.pots) if (p.slotId) Object.assign(p, { sown: true, harvested: false, ageDays: 1, startedOnDay: w.state.day - 1, idleSinceDay: w.state.day - 1 });
  for (const v of Object.values(w.state.firstPlay.crops || {})) for (const p of ((v && v.pots) || [])) if (p.slotId) Object.assign(p, { sown: true, harvested: false, ageDays: 1, startedOnDay: w.state.day - 1, idleSinceDay: w.state.day - 1 });
  await page.goto(`${BASE}/data/balance/homes.json`);
  await page.eval(`(()=>{ localStorage.clear(); localStorage.setItem('byeot/save/1', ${JSON.stringify(JSON.stringify(w))}); localStorage.setItem('byeot.guideSeen','1'); return 1; })()`, false);
  await page.goto(`${BASE}/game.html`); await page.waitFor('window.__byeotBooted === true', 300000, 500); await page.waitFor('!!window.__rv', 240000, 500); await sleep(4000);
  await dlg(); await bannerOff(); await sleep(1200); }
const e = await J(`(async()=>{ const S=window.__S(); const room=S.home.room; const H = await (await fetch('data/house_rooms.json')).json(); const sz = H.rooms[room].size;
  const door0 = (window.__rv.doorReach ? window.__rv.doorReach() : [])[0]; if (!door0) return { noDoor: true, room };
  const inward=0.38+0.125+0.1; const at = door0.wall === 'front' ? { x: door0.cu, y: 0, z: sz.d/2 - inward } : door0.wall === 'back' ? { x: door0.cu, y: 0, z: -sz.d/2 + inward } : door0.wall === 'left' ? { x: -sz.w/2 + inward, y: 0, z: door0.cu } : { x: sz.w/2 - inward, y: 0, z: door0.cu };
  const before = (S.emptyPots||[]).length; const r = window.__byeotCommitPlace('monsteraSeed:pot', at); await new Promise(res=>setTimeout(res, 1500));
  const ep = (window.__S().emptyPots||[]).slice(-1)[0]; const n = (window.__S().emptyPots||[]).length;
  return { room, door0, at, r, placed: n > before, ep: ep ? ep.id : null, warn: ep ? window.__byeotReachWarn(ep.id) : null, door2: window.__rv.doorReach() }; })()`);
console.log('  ㉲ 원룸 문 앞 빈 화분', JSON.stringify(e));
if (OUT) await page.shot(`${OUT}/390_c8c_doorpot.png`);
ok(!e.탈 && e.room === 'oneroom' && e.door0 && e.door0.ok === true, '㉲ 판 — 원룸은 놓기 전 문 앞까지 길이 있다', JSON.stringify({ room: e.room, door0: e.door0 }));
ok(!e.탈 && e.placed && /문 앞 길이 막/.test(e.warn || ''), '㉲ 참 경고 — 빈 화분을 문 앞 바닥에 놓으면 «문 앞 길이 막힙니다»는 그대로', JSON.stringify({ warn: e.warn, door2: e.door2 }));
/* ═══ ㉵ 360 — [옮기기] 아래글 한 줄 ═══ */
{ const p3 = await launch({ width: 360, height: 844, dpr: 2 });
  await p3.send('Runtime.enable'); await p3.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true;` });
  const J3 = async (js) => JSON.parse(await p3.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, 120000));
  await p3.goto(`${BASE}/data/balance/homes.json`);
  await p3.eval(`(()=>{ localStorage.clear(); localStorage.setItem('byeot/save/1', ${JSON.stringify(fs.readFileSync(SAVE, 'utf8'))}); localStorage.setItem('byeot.guideSeen','1'); return 1; })()`, false);
  await p3.goto(`${BASE}/game.html`); await p3.waitFor('window.__byeotBooted === true', 300000, 500); await p3.waitFor('!!window.__rv', 240000, 500); await sleep(4000);
  for (let i = 0; i < 160; i++) { const t = await J3(`document.getElementById('stage').classList.contains('talking')`); if (t !== true) break; await p3.eval(`(()=>{ const b=document.getElementById('dlgBox'); if(b) b.click(); return 1; })()`, false); await sleep(250); }
  await J3(`(()=>{ window.__byeotSheet.open('bag'); return 1; })()`); await sleep(1500);
  await J3(`(()=>{ const c=[...document.querySelectorAll('#pageBag .bagslot')].find(e=>/축복받은/.test(e.textContent||'')); if (c) c.click(); return !!c; })()`); await sleep(2200);
  await J3(`(()=>{ const b=document.getElementById('placeOk'); if (b && b.offsetParent) b.click(); return 1; })()`); await sleep(1800);
  for (let i = 0; i < 160; i++) { const t = await J3(`document.getElementById('stage').classList.contains('talking')`); if (t !== true) break; await p3.eval(`(()=>{ const b=document.getElementById('dlgBox'); if(b) b.click(); return 1; })()`, false); await sleep(250); }
  const k3 = await J3(`(()=>{ const p=(window.__S().pots||[])[0]; const r=(window.__rv.plants()||[]).find(q=>q&&q.potId===p.id); return r ? r.key : null; })()`);
  await J3(`(()=>{ window.__picked.select(${JSON.stringify(k3)}); return 1; })()`); await sleep(900);
  await J3(`(()=>{ const b=document.getElementById('pickMove'); if (b && b.offsetParent) b.click(); return !!b; })()`); await sleep(1500);
  const g = await J3(`(()=>{ const el=document.getElementById('dropLabel'); if (!el) return { none: true }; const rg=document.createRange(); rg.selectNodeContents(el);
    const tops=new Set([...rg.getClientRects()].filter(q=>q.width>0).map(q=>Math.round(q.top))); const r=el.getBoundingClientRect(); return { t: el.textContent, lines: tops.size, box: [Math.round(r.left), Math.round(r.right)], vw: innerWidth }; })()`);
  console.log('  ㉵ 360 아래글', JSON.stringify(g));
  if (OUT) await p3.shot(`${OUT}/360_c8c_drop.png`);
  ok(!g.탈 && !g.none && /^놓을 수 있는 데는 .+ 제일 밝습니다$/.test(g.t || '') && g.lines === 1, '㉵ 360 — 아래글 «놓을 수 있는 데는 X이 제일 밝습니다» 한 줄', JSON.stringify(g));
  try { await p3.close(); } catch (e3) { void e3; } }
ok(exc.length === 0, '처리 안 된 예외 0', exc.slice(0, 3).join(' / '));
try { await page.close(); } catch (e2) { void e2; }
console.log(bad ? `\nprobe_critic8_c: 빨강 ${bad}` : '\nprobe_critic8_c: 다 통과');
process.exit(bad ? 1 : 0);
