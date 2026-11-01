/* 비판 6판 가름 C 묶음 ㉡(core 11-02 · 총괄 C4 · C8 · [plan] P1 · P2 · P7 · 글 507ba40d · e28ad6e1) — 390×844
   판(비판 6판 크롬 프로필 localStorage 를 새 이름 복사본에서 읽어 낸 세이브 — C:/Users/pc/byeot-core-keep/critic6/ · 프로필은 안 건드림):
     A100 = 비판 A Day 100(반지하 · 안 팖 · 다 자란 무늬 잎 0/2 · 잎 136 굴림 9번 실패 · 게이지 0.617)   SAVE_A
     S97  = 비판 S Day 97(원룸 · 통째 판 · 무늬 원천 0)                                                   SAVE_S
   ㉮ C4 · P1 A100: 확대 줄 «자르기 — 다 자란 무늬 잎 2장 · 지금 0/2 · 다음 기회 약 d일 뒤 · 한 번에 q%»(d · q 는 plant_grow 정본 셈과 같음) ·
         [식물] 카드 «자르기 — … · 다음 기회 약 d일 뒤» · 칩 «기다리는 중 — 다 자란 무늬 잎 2장 · 지금 0/2» · 할 일 판 «자르기 — …» ·
         [다음 날] d 번 뒤 그 잎에 기회(굴림)가 실제로 왔다 · leaf_two 오른쪽 글 «무늬가 날 자리가 생깁니다» · 상점 내놓기 막힘 글(node · marketGate)
   ㉯ C8 A100C(세이브 손질: 놓인 시루 셋을 «한 번도 안 심음»으로 · 나머지는 자라는 중 · 체력 18): 바닥 «🌱 콩 씨앗 심기 (3개 — 물 줄 체력 3 남김)» →
         누르면 셋이 심기고(첫 심기는 체력 안 듦) «콩 씨앗을 심었습니다»
   ㉰ P7 A100: 내놓기 → 연락(contactOnDay 손질 · probe_d100b 와 같은 손) → 거래 → [다음 날] 월세 날까지 → 가계부 견줌 «그루 판 돈을 빼면 …»
   ㉱ P2 S97: 할 일 판 «내 집 자금을 모은다» 줄 까닭이 무늬 원천 0 판 글(«남는 채소를 팔고, 씨앗에서 키운 그루를 …»)
   예외 0 · J 단언엔 !탈 */
import fs from 'node:fs';
import { launch, sleep } from './test_cdp.mjs';
import { marketGate } from '../src/game/shop.js';
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9453', OUT = process.env.OUT || null;
const SAVE_A = process.env.SAVE_A || 'C:/Users/pc/byeot-core-keep/critic6/saveA_d100.json';
const SAVE_S = process.env.SAVE_S || 'C:/Users/pc/byeot-core-keep/critic6/saveS_d97.json';
const MONTH_A = process.env.MONTH_A || 'C:/Users/pc/byeot-core-keep/critic6/monthA_d100.json';   /* 가계부 달 장부(localStorage byeot.month · 같은 프로필 복사본에서) */
if (OUT) fs.mkdirSync(OUT, { recursive: true });
let bad = 0; const ok = (c, m, d = '') => { console.log(`${c ? '  OK' : 'FAIL'}  ${m}${d ? '  → ' + d : ''}`); if (!c) bad++; };
const exc = [];
let page = null, J = null;
const boot = async (saveText, monthText = null) => {
  if (page) { try { await page.close(); } catch (e) { console.log('  (탭 닫기 탈)', e.message); } }
  page = await launch({ width: 390, height: 844, dpr: 2 });
  page.on((method, p) => { if (method === 'Runtime.exceptionThrown') exc.push(((p.exceptionDetails.exception && p.exceptionDetails.exception.description) || p.exceptionDetails.text || '').split('\n')[0].slice(0, 200)); });
  await page.send('Runtime.enable');
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true;` });
  J = async (js) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, 120000));
  await page.goto(`${BASE}/data/balance/homes.json`);
  await page.eval(`(()=>{ localStorage.clear(); localStorage.setItem('byeot/save/1', ${JSON.stringify(saveText)}); localStorage.setItem('byeot.guideSeen','1'); ${monthText != null ? `localStorage.setItem('byeot.month', ${JSON.stringify(monthText)});` : ''} return 1; })()`, false);
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
const chipNow = () => J(`(()=>({ head: ((document.querySelector('#questChip b')||{}).textContent||''), body: ((document.getElementById('questChipText')||{}).textContent||'') }))()`);
/* 하루 넘김 — [다음 날] → 밥상 창 [이대로 다음 날] → 대사 · 사건 카드(첫 단추) · 가계부 창(글을 남기고 닫음) */
const monthSums = [];
const nextDay = async () => {
  /* 사람 손: 몬스테라 물이 되면 준다(마른 날은 자라지 않아 굴림 기회도 안 온다 — «약 d일»은 돌봄이 이어질 때의 수) */
  const wp = await J(`(()=>{ const b=document.getElementById('waterPot'); return !!(b && b.style.display !== 'none' && b.offsetParent && !b.disabled && !b.classList.contains('done') && !b.classList.contains('tired')); })()`);
  if (wp === true) { await tapSel('#waterPot'); await sleep(1500); for (let k = 0; k < 20; k++) { const a = await J(`(()=>{ const b=document.getElementById('actBar'); return !!(b && b.style.display !== 'none'); })()`); if (!a || a.탈) break; await sleep(500); } await dlgOnly(); }
  const d0 = await J(`window.__S().day`);
  await page.eval(`(()=>{ try { window.__byeotSheet.close(); } catch (e) { void e; } const b=document.getElementById('next'); b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})); b.click(); return 1; })()`, false);
  for (let k = 0; k < 40; k++) {
    await sleep(700);
    const st = await J(`(()=>{ const pop=document.querySelector('.pop.on'); return { day: window.__S().day, talking: document.getElementById('stage').classList.contains('talking'), pop: pop ? pop.id : null,
      month: (document.getElementById('monthPanel')||{}).classList && document.getElementById('monthPanel').classList.contains('on') ? (document.getElementById('monthSum')||{}).textContent : null }; })()`);
    if (st.탈) break;
    if (st.month != null) { monthSums.push({ day: st.day, sum: st.month }); await page.eval(`(()=>{ const c=document.getElementById('monthClose'); if (c) c.click(); return 1; })()`, false); continue; }
    if (st.pop === 'mealPanel') { await page.eval(`(()=>{ const g=document.getElementById('mealGo'); if (g) g.click(); return 1; })()`, false); continue; }
    if (st.pop === 'evPanel') { await page.eval(`(()=>{ const b=document.querySelector('#evPanel .pbtns button:not([disabled])') || document.querySelector('#evPanel button:not([disabled])'); if (b) b.click(); return 1; })()`, false); continue; }
    if (st.pop) { await page.eval(`(()=>{ const p=document.querySelector('.pop.on'); const b=p && (p.querySelector('button.ghost') || p.querySelector('button')); if (b) b.click(); return 1; })()`, false); continue; }
    if (st.talking) { await dlgOnly(); continue; }
    if (st.day > d0) { await sleep(600); const t2 = await J(`document.getElementById('stage').classList.contains('talking') || !!document.querySelector('.pop.on')`); if (!t2) break; }
  }
  return J(`window.__S().day`);
};
const saveA = fs.readFileSync(SAVE_A, 'utf8'), saveS = fs.readFileSync(SAVE_S, 'utf8');

/* ═══ ㉮ C4 · P1 — A100 ═══ */
await boot(saveA);
await dlgOnly(); await page.eval(`(()=>{ try { window.__byeotSheet.close(); } catch (e) { void e; } return 1; })()`, false); await sleep(1500);
const eng = await J(`(()=>{ const fr=[...document.querySelectorAll('iframe')].find(f=>/plant_grow/.test(f.src||'')); const w=fr&&fr.contentWindow; if(!w) return { 탈:'iframe 없음' };
  const v=w.varieStateAll().filter(x=>x.varie).map(x=>x.leafBirth); const mats=w.matStateAll();
  const rows=v.map(b=>({ b, g: w.matGaugeOf(b), m: (mats.find(e=>e.leafBirth===b)||null) })); return { step: w.matGaugeStep(), prob: w.calcMatureProb(w.lightCtx()), rows }; })()`);
const cw = await J(`window.__byeotCutWait ? window.__byeotCutWait() : { 없음: true }`);
const chipA = await chipNow();
await page.eval(`(()=>{ window.__byeotSheet.open('quest'); return 1; })()`, false); await sleep(1200);
const qrows = await J(`(()=>{ const r = id => { const e=document.querySelector('#questListTab [data-qid="'+id+'"]'); return e ? { todo: ((e.querySelector('.qtodo')||{}).textContent||''), rew: ((e.querySelector('.qrew')||{}).textContent||'') } : null; };
  return { wait: r('wait_varie'), leafTwo: r('leaf_two') }; })()`);
await page.eval(`(()=>{ window.__byeotSheet.open('plants'); return 1; })()`, false); await sleep(1200);
if (OUT) await page.shot(`${OUT}/390_c6b_c4_card.png`);
const card = await J(`(document.getElementById('mcVarie')||{}).textContent || ''`);
await page.eval(`(()=>{ window.__byeotSheet.close(); return 1; })()`, false); await sleep(800);
console.log('  ㉮ 엔진', JSON.stringify(eng));
console.log('  ㉮ 글', JSON.stringify({ cw, chipA, qrows, card }));
const roll = (eng.rows || []).filter(r => r.g && !r.g.locked).map(r => ({ b: r.b, d: Math.max(1, Math.ceil((1 - r.g.gauge) / eng.step - 1e-9)), rolls: r.g.rolls })).sort((a, b) => a.d - b.d)[0];
const q = Math.round(eng.prob * 100);
ok(!eng.탈 && roll && eng.step > 0, '판 ㉮ — 굴림에 든 무늬 잎(잎 136 · 6판 진단)이 있다', JSON.stringify({ roll, step: eng.step }));
const wantLine = roll ? `자르기 — 다 자란 무늬 잎 2장 · 지금 0/2 · ${roll.d <= 1 ? '다음 기회 내일' : `다음 기회 약 ${roll.d}일 뒤`} · 한 번에 ${q}%` : '?';
ok(!cw.탈 && cw.line === wantLine, '㉮ C4 확대 줄 «자르기 — 다 자란 무늬 잎 2장 · 지금 0/2 · 다음 기회 약 d일 뒤 · 한 번에 q%»(정본 셈과 같은 d · q)', JSON.stringify({ line: cw.line, wantLine }));
ok(roll && card.includes(`자르기 — 다 자란 무늬 잎 2장 · 지금 0/2 · ${roll.d <= 1 ? '다음 기회 내일' : `다음 기회 약 ${roll.d}일 뒤`}`), '㉮ C4 [식물] 카드 «자르기 — … · 다음 기회 약 d일 뒤»', card);
ok(!chipA.탈 && chipA.body === '기다리는 중 — 다 자란 무늬 잎 2장 · 지금 0/2', '㉮ P1 칩 «기다리는 중 — 다 자란 무늬 잎 2장 · 지금 0/2»', JSON.stringify(chipA));
ok(!qrows.탈 && qrows.leafTwo && qrows.leafTwo.rew === '무늬가 날 자리가 생깁니다', '㉮ P1 §1-4 leaf_two 오른쪽 글 «무늬가 날 자리가 생깁니다»', JSON.stringify(qrows.leafTwo));
{ const g = marketGate({ day: 30, shop: {} }, { leaves: 2 }); const g0 = marketGate({ day: 30, shop: {} }, {});
  ok(g.reason === '아직 내놓을 수 없습니다 — 내놓기는 잎 3장부터 · 지금 잎 2장' && g0.reason === '아직 내놓을 수 없습니다 — 내놓기는 몬스테라 잎 3장부터', '㉮ P1 §1-3 내놓기 막힘 «내놓기는 잎 3장부터 · 지금 잎 2장»', JSON.stringify([g.reason, g0.reason])); }
/* [다음 날] d 번 — 그 잎에 기회가 실제로 온다(굴림 수가 늘거나 다 자람) */
const rollAt = async () => J(`(()=>{ const fr=[...document.querySelectorAll('iframe')].find(f=>/plant_grow/.test(f.src||'')); const w=fr&&fr.contentWindow; if(!w) return null; const e=w.matStateAll().find(x=>x.leafBirth===${roll ? roll.b : -1}); return e ? { day: window.__S().day, gauge: e.gauge, rolls: e.rolls, matured: e.matured, dry: (()=>{ const b=document.getElementById('waterPot'); return b ? b.textContent.replace(/\s+/g,' ').slice(0,30) : null; })() } : null; })()`);
const trail = [];
if (roll) { for (let i = 0; i < roll.d; i++) { await nextDay(); trail.push(await rollAt()); } }
console.log('  ㉮ 날마다', JSON.stringify(trail));
const eng2 = await J(`(()=>{ const fr=[...document.querySelectorAll('iframe')].find(f=>/plant_grow/.test(f.src||'')); const w=fr&&fr.contentWindow; if(!w) return { 탈:'iframe 없음' };
  return { day: window.__S().day, m: w.matStateAll().find(e=>e.leafBirth===${roll ? roll.b : -1}) || null }; })()`);
console.log('  ㉮ d 날 뒤', JSON.stringify(eng2));
ok(!eng2.탈 && roll && eng2.m && (eng2.m.matured || eng2.m.rolls > roll.rolls), `㉮ C4 «다음 기회 약 ${roll ? roll.d : '?'}일 뒤» — 그만큼 넘기면 굴림이 실제로 왔다`, JSON.stringify({ before: roll, after: eng2.m }));

/* ═══ ㉯ C8 — A100C ═══ */
const wC = JSON.parse(saveA); { const st = wC.state; const pots = st.firstPlay.beansprout.pots;
  let n = 0; for (const p of pots) { if (p.slotId && n < 3) { Object.assign(p, { sown: false, harvested: false, ageDays: 0, dliHist: [], startedOnDay: null, idleSinceDay: st.day }); n++; }
    else Object.assign(p, { harvested: false }); }
  for (const v of Object.values(st.firstPlay.crops || {})) for (const p of ((v && v.pots) || [])) p.harvested = false;   /* 무순 판도 거둔 것 없음 — 단추가 콩 씨앗 종류를 고르게 */
  st.shop.stock.bean_seed = 8;   /* 콩 씨앗 보유 8(비판 판은 0 · 8 이 오는 중) */
  st.stamina.left = 18; }
await boot(JSON.stringify(wC));
await dlgOnly(); await page.eval(`(()=>{ try { window.__byeotSheet.close(); } catch (e) { void e; } return 1; })()`, false); await sleep(2000);
const c8a = await J(`(()=>{ const b=document.getElementById('resow'); const S=window.__S(); const pots=S.firstPlay.beansprout.pots;
  return { shown: !!(b && b.style.display !== 'none' && b.offsetParent), t: b ? (b.textContent||'').replace(/\\s+/g,' ').trim() : null, left: S.stamina.left, unsown: pots.filter(p=>p.slotId && !p.sown && !p.harvested).length, seeds: (S.shop.stock||{}).bean_seed }; })()`);
if (OUT) await page.shot(`${OUT}/390_c6b_c8_btn.png`);
await tapSel('#resow');
/* 사람이 걸어가 심는다(걷기 몇 초) — 다 심길 때까지 15초 */
for (let k = 0; k < 30; k++) { await sleep(500); const u = await J(`window.__S().firstPlay.beansprout.pots.filter(p=>p.slotId && !p.sown && !p.harvested).length`); if (u === 0 || (u && u.탈)) break; }
await sleep(300);
const c8b = await J(`(()=>{ const S=window.__S(); const pots=S.firstPlay.beansprout.pots; const ev=document.getElementById('event');
  return { left: S.stamina.left, unsown: pots.filter(p=>p.slotId && !p.sown && !p.harvested).length, banner: ev && ev.classList.contains('on') ? (ev.innerText||'').replace(/\\s+/g,' ').slice(0,80) : '' }; })()`);
console.log('  ㉯ C8', JSON.stringify({ c8a, c8b }));
ok(!c8a.탈 && c8a.unsown === 3, '판 ㉯ — 놓였고 한 번도 안 심은 시루 셋', JSON.stringify(c8a));
ok(!c8a.탈 && c8a.shown && /^🌱 콩 씨앗 심기 ?\(3개 — 물 줄 체력 3 남김\)$/.test(c8a.t), '㉯ C8 바닥 «🌱 콩 씨앗 심기 (3개 — 물 줄 체력 3 남김)»(첫 심기는 체력 안 듦 · «체력 0» 뺌)', JSON.stringify(c8a));
ok(!c8b.탈 && c8b.unsown === 0 && c8b.left === c8a.left, '㉯ C8 한 번 누르면 셋이 다 심긴다(체력 그대로)', JSON.stringify(c8b));
ok(!c8b.탈 && /콩 씨앗을 심었습니다/.test(c8b.banner), '㉯ C8 배너 «콩 씨앗을 심었습니다»', c8b.banner);

/* ═══ ㉰ P7 — A100 내놓기 → 거래 → 월세 날 가계부(달 장부도 같은 프로필에서 — 지난달 +319,760) ═══ */
await boot(saveA, fs.readFileSync(MONTH_A, 'utf8'));
await dlgOnly(); await page.eval(`(()=>{ try { window.__byeotSheet.close(); } catch (e) { void e; } return 1; })()`, false); await sleep(1500);
await page.eval(`(()=>{ window.__byeotSheet.open('shop'); return 1; })()`, false); await sleep(1200);
await tapSel('#sellPlant'); await sleep(1000);
await tapSel('#varieAskGo'); await sleep(1200); await dlgOnly();
await J(`(()=>{ const S=window.__S(); for (const l of (S.shop.listings||[])) if (l.kind==='pot') l.contactOnDay = S.day + 1; return 1; })()`);
await nextDay();
await page.eval(`(()=>{ window.__byeotSheet.open('shop'); return 1; })()`, false); await sleep(1200);
await tapSel('#marketList [data-deal]'); await sleep(900);
await tapSel('#varieAskGo'); await sleep(1500); await dlgOnly(); await sleep(800); await dlgOnly();
const sold = await J(`(()=>({ day: window.__S().day, pots: (window.__S().pots||[]).length, due: window.__S().tutorial.rent.nextDueDay }))()`);
console.log('  ㉰ 판 뒤', JSON.stringify(sold));
for (let i = 0; i < 40 && !monthSums.some(x => x.day >= sold.due); i++) await nextDay();
if (OUT) await page.shot(`${OUT}/390_c6b_p7_after.png`);
console.log('  ㉰ 가계부', JSON.stringify(monthSums));
const ms = monthSums.filter(x => x.day >= sold.due)[0];
ok(!sold.탈 && sold.pots === 0, '판 ㉰ — 모그루를 거래로 팔았다', JSON.stringify(sold));
ok(!!ms && /그루 판 돈을 빼면 지난달보다/.test(ms.sum), '㉰ P7 그 달 가계부 견줌 «그루 판 돈을 빼면 지난달보다 …»(한 번 들어온 돈)', JSON.stringify(ms));
/* [plan] §13-5 · P2 — 무늬 원천 0 으로 이사하면 도착 대사 끝이 «응. 그건 나간 거 맞아.» · «잘라 늘리는 거야» 두 줄 없음 */
await page.eval(`(()=>{ try { window.__byeotSheet.close(); } catch (e) { void e; } return 1; })()`, false); await sleep(800); await dlgOnly();
await page.eval(`(()=>{ window.__byeotSheet.tab('room'); document.getElementById('moveOut').click(); return 1; })()`, false); await sleep(1500); await dlgOnly(); await sleep(800);
await page.eval(`(()=>{ const g=document.getElementById('moveGo'); if (g && g.offsetParent) g.click(); return 1; })()`, false); await sleep(2500);
const arrive = [];
for (let i = 0; i < 160; i++) { const t = await J(`(()=>({ on: document.getElementById('stage').classList.contains('talking'), l: (document.getElementById('dlgText')||{}).textContent || '', moved: !!window.__S().tutorial.movedOut }))()`);
  if (t.탈) break; if (t.on && t.l && arrive[arrive.length - 1] !== t.l) arrive.push(t.l);
  if (!t.on && t.moved && i > 10) { const t2 = await J(`document.getElementById('stage').classList.contains('talking')`); if (!t2) break; }
  if (t.on) await page.eval(`(()=>{ const b=document.getElementById('dlgBox'); if(b) b.click(); return 1; })()`, false);
  await sleep(320); }
console.log('  ㉰ 도착 대사', JSON.stringify(arrive.slice(-14)));
const iEnd = arrive.indexOf('응. 그건 나간 거 맞아.');
ok(iEnd >= 0 && !arrive.some(l => /잘라 늘리는 거야|자르는 데부터네/.test(l)), '㉰ P2 무늬 원천 0 이사 — 도착 대사에 «응. 그건 나간 거 맞아.» · «잘라 늘리는 거야/자르는 데부터네» 없음', JSON.stringify(arrive.slice(Math.max(0, iEnd - 3), iEnd + 2)));

/* ═══ ㉲ [plan] §4 고침 — S97z(화분을 어두운 자리로 · 세이브 손질 · probe_critic6_a ㉳-3 과 같은 손): 자리 창 둘째 줄 · 낱말 자 = 어두운 화분 할 일 자 ═══ */
{ const w = JSON.parse(saveS); const st = w.state; const fp = st.firstPlay; const all = [...fp.beansprout.pots, ...Object.values(fp.crops).flatMap(v => (v && v.pots) || [])];
  const pot = st.pots[0], siru = all.find(x => x.slotId === 'banjiha-desk:0'), tray = all.find(x => x.slotId === 'oneroom-sill:0');
  pot.slotId = siru.slotId; pot.at = { ...siru.at }; siru.slotId = 'free:' + siru.id; siru.at = { ...siru.at, x: 2.375, z: 1.875 }; tray.slotId = 'free:' + tray.id; tray.at = { ...siru.at, x: 2.625, z: 1.875 };
  await boot(JSON.stringify(w)); }
await dlgOnly(); await page.eval(`(()=>{ window.__byeotSheet.open('plants'); return 1; })()`, false); await sleep(1200);
await tapSel('[data-plantwhere]'); await sleep(1500);
const sw = await J(`(()=>({ sub: (document.getElementById('slotSub')||{}).innerText || '', rows: [...document.querySelectorAll('#slotList [data-slot]')].map(b=>({ s: b.dataset.slot, here: b.disabled, small: (b.querySelector('small')||{}).textContent||'' })), pd: window.__byeotPotDark() }))()`);
if (OUT) await page.shot(`${OUT}/390_c6b_where_note.png`);
console.log('  ㉲ §4', JSON.stringify(sw));
ok(!sw.탈 && /밝기는 이 철 여러 날 평균입니다/.test(sw.sub), '㉲ §4 고침 ③ 원룸 자리 창 둘째 줄 «밝기는 이 철 여러 날 평균입니다»', sw.sub);
ok(!sw.탈 && sw.pd && sw.pd.kind === 'go' && sw.rows.some(r => !r.here && /밝음/.test(r.small)) && sw.rows.some(r => r.here && /그늘|어둠/.test(r.small)), '㉲ §4 고침 ④ 할 일 ㉮ 가 선 판 — 목록에 «밝음» 줄 · 지금 줄은 «그늘/어둠»(같은 자)', JSON.stringify(sw.rows));

/* ═══ ㉱ P2 — S97 할 일 판 집 자금 줄 까닭 ═══ */
await boot(saveS);
await dlgOnly(); await page.eval(`(()=>{ window.__byeotSheet.open('quest'); return 1; })()`, false); await sleep(1500);
const hf = await J(`(()=>{ const e=document.querySelector('#questListTab [data-qid="oneroom_home_fund"]'); return e ? ((e.querySelector('.qwhy')||{}).textContent||'') : null; })()`);
if (OUT) await page.shot(`${OUT}/390_c6b_p2_board.png`);
console.log('  ㉱ P2', JSON.stringify(hf));
ok(hf === '남는 채소를 팔고, 씨앗에서 키운 그루를 내놓아 팔면 그 돈이 내 집 자금이 됩니다.', '㉱ P2 무늬 원천 0 판 집 자금 줄 까닭', String(hf));

try { await page.close(); } catch (e) { console.log('  (탭 닫기 탈)', e.message); }
ok(exc.length === 0, '처리 안 된 예외 0', JSON.stringify(exc.slice(0, 5)));
console.log(bad ? `probe_critic6_b: 빨강 ${bad}` : 'probe_critic6_b: 다 통과');
process.exit(bad ? 1 : 0);
