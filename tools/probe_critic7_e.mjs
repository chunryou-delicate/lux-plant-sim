/* 비판 7판 7C4 자(core 11-02 · 총괄 가름 · [plan] plan-to-core-critic7 §2 ㉠) — 다시 심기가 이미 심은 줄의 물 몫까지 쓰지 않게
   ⛔ 비판 7판 A Day 29(d29_end · d30_end): 바닥 [🌱 다시 심기]가 «물 줄 체력 N 남김»으로 심을 수를 맞췄는데, 누른 뒤 방금 심은 줄의 물 몫을 안 빼고 다시 세어
      단추가 또 섰고 한 번 더 누르면 그 몫까지 심기에 썼다 → 체력 0 · «물 주기 11개 중 2개» · 이튿날 물 못 준 시루
   판: 비판 6판 A100 세이브(C:/Users/pc/byeot-core-keep/critic6/saveA_d100.json · 프로필 안 건드림) — 손질: 콩 씨앗 20 · 무순 판은 다 자라는 중 ·
       콩나물 시루 16 가운데 판마다 거둔 것(harvested) · 물 기다리는 것(심음 · 시작 전) · 새 빈 시루(sown:false) 수와 체력을 정함 · 나머지는 자라는 중
   단언(체력 값은 다 1 — data/balance/stamina.json · 회색 ⇔ 남은 체력 ≤ 물 기다리는 줄 W)
     ㉮ 거둔 6 · 체력 6: 첫 단추 «(6개 중 3개 · 체력 3 — 물 줄 체력 3 남김)» → 한 번 누름(3 심음 · 체력 3 · W 3) →
        단추 회색(.tired) «🌱 콩나물 다시 심기 (남은 체력은 물 줄 몫 — 💧 먼저)» · 손가락은 다시 심기 아님 · [💧 물 주기]가 보임 ·
        회색을 누르면 배너 «물 줄 체력을 남겨 둡니다» / «심은 시루에 먼저 💧 물을 주세요 — 물을 받아야 자랍니다» · 체력 · 거둔 수 그대로
     ㉯ 거둔 4 · W 2 · 체력 5: 단추 초록 «(4개 중 1개 · 체력 1 — 물 줄 체력 3 남김)»(남은 체력에서 W 를 먼저 뺀 셈 · 꼬리 N = W + m)
     ㉰ 새 빈 시루 2 · W 2 · 체력 2: 회색 아님 «🌱 콩 씨앗 심기 (1개 · 물은 내일)»
     ㉮-끝 회색 동안 다른 단추 안 감춤 · 물을 다 준 뒤(체력 0) «오늘 손이 다 떨어졌습니다» 단추 하나(§tiredOne) · 몬스테라 단추 그대로
     ㉱ 360 · 390 — 회색 단추 꼬리 «…» 없음 · 회색 동안 손가락은 거둔 시루 «씨앗 심기» 말풍선 · 다시 심기가 아니라 물 쪽 · 예외 0 · J 단언엔 !탈 */
import fs from 'node:fs';
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9451', OUT = process.env.OUT || null;
const SAVE_A = process.env.SAVE_A || 'C:/Users/pc/byeot-core-keep/critic6/saveA_d100.json';
if (OUT) fs.mkdirSync(OUT, { recursive: true });
let bad = 0; const ok = (c, m, d = '') => { console.log(`${c ? '  OK' : 'FAIL'}  ${m}${d ? '  → ' + d : ''}`); if (!c) bad++; };
if (!fs.existsSync(SAVE_A)) { ok(false, '세이브 없음', SAVE_A); process.exit(1); }
const stage = ({ harv = 0, idle = 0, fresh = 0, left }) => { const w = JSON.parse(fs.readFileSync(SAVE_A, 'utf8')); const s = w.state;
  s.stamina.left = left; s.shop.stock.bean_seed = 20; s.shop.orders = (s.shop.orders || []).filter(o => o.itemId !== 'bean_seed');
  let i = 0;
  for (const p of s.firstPlay.beansprout.pots) {
    if (!p.slotId) continue;
    const role = i < harv ? 'harv' : i < harv + idle ? 'idle' : i < harv + idle + fresh ? 'fresh' : 'grow'; i++;
    if (role === 'harv') Object.assign(p, { sown: true, harvested: true, startedOnDay: null, ageDays: 0 });
    else if (role === 'idle') Object.assign(p, { sown: true, harvested: false, startedOnDay: null, ageDays: 0, idleSinceDay: s.day });
    else if (role === 'fresh') Object.assign(p, { sown: false, harvested: false, startedOnDay: null, ageDays: 0 });
    else Object.assign(p, { sown: true, harvested: false, ageDays: 1, startedOnDay: s.day - 1, idleSinceDay: s.day - 1 });
  }
  for (const v of Object.values(s.firstPlay.crops || {})) for (const p of ((v && v.pots) || [])) if (p.slotId) Object.assign(p, { sown: true, harvested: false, ageDays: 1, startedOnDay: s.day - 1, idleSinceDay: s.day - 1 });
  return JSON.stringify(w); };
const exc = [];
const open = async (wd) => {
  const page = await launch({ width: wd, height: 844, dpr: 2 });
  page.on((method, p) => { if (method === 'Runtime.exceptionThrown') exc.push(((p.exceptionDetails.exception && p.exceptionDetails.exception.description) || p.exceptionDetails.text || '').split('\n')[0].slice(0, 200)); });
  await page.send('Runtime.enable');
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true;` });
  const J = async (js) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, 120000));
  const dlg = async () => { for (let i = 0; i < 80; i++) { const t = await J(`document.getElementById('stage').classList.contains('talking')`); if (t !== true) break; await page.eval(`(()=>{ const b=document.getElementById('dlgBox'); if(b) b.click(); return 1; })()`, false); await sleep(250); } };
  const boot = async (txt) => {
    await page.goto(`${BASE}/data/balance/homes.json`);
    await page.eval(`(()=>{ localStorage.clear(); localStorage.setItem('byeot/save/1', ${JSON.stringify(txt)}); localStorage.setItem('byeot.guideSeen','1'); return 1; })()`, false);
    await page.goto(`${BASE}/game.html`); await page.waitFor('window.__byeotBooted === true', 300000, 500); await page.waitFor('!!window.__rv', 240000, 500); await sleep(3500);
    await dlg(); await J(`(()=>{ try { window.__byeotSheet.close(); } catch (e) { void e; } return 1; })()`); await sleep(1200);
    let n = 0; for (let i = 0; i < 60 && n < 2; i++) { const b = await J(`(()=>{ try { return !!window.__rv.camBusy(); } catch (e) { return false; } })()`); n = b === false ? n + 1 : 0; await sleep(200); }
    for (let i = 0; i < 20; i++) { const on = await J(`document.getElementById('event').classList.contains('on')`); if (on !== true) break; await J(`(()=>{ document.getElementById('event').click(); return 1; })()`); await sleep(400); }
  };
  return { page, J, boot, dlg };
};
const BTN = `(async()=>{ try { window.__byeotHint(); } catch (e) { void e; } await new Promise(r=>setTimeout(r,900));
  const b=document.getElementById('resow'), wb=document.getElementById('waterCrop'), h=document.getElementById('hint'), t=document.querySelector('.hintTarget'), tail=b.querySelector('.btnTail');
  const S=window.__S(), rows=S.firstPlay.beansprout.pots.filter(p=>p.slotId);
  return { shown: b.style.display !== 'none' && !!b.offsetParent, t: (b.textContent||'').replace(/\\s+/g,' ').trim(), tired: b.classList.contains('tired'), owed: b.dataset.owed || null,
    tailCut: tail ? tail.scrollWidth > tail.clientWidth + 1 : null, btnCut: b.scrollWidth > b.clientWidth + 1,
    water: wb && wb.style.display !== 'none' && !!wb.offsetParent ? (wb.textContent||'').replace(/\\s+/g,' ').trim() : null,
    hint: { on: h.classList.contains('on'), tid: t ? (t.id || (t.className||'').toString().slice(0,30)) : null, say: (h.querySelector('.say')||{}).textContent },
    left: S.stamina.left, harv: rows.filter(p=>p.harvested).length, idle: rows.filter(p=>!p.harvested && p.sown !== false && p.startedOnDay == null).length }; })()`;
const press = async (J, id, before) => { await J(`(()=>{ document.getElementById('${id}').click(); return 1; })()`);
  for (let i = 0; i < 60; i++) { await sleep(400); const s = await J(`(()=>({ left: window.__S().stamina.left, acting: document.getElementById('stage').classList.contains('acting') }))()`); if (s.left !== before && !s.acting) break; }
  await sleep(1500); };
/* ═══ ㉮ ═══ */
{
  const { page, J, boot, dlg } = await open(390);
  await boot(stage({ harv: 6, left: 6 }));
  const a0 = await J(BTN);
  console.log('  ㉮ 처음', JSON.stringify(a0));
  ok(!a0.탈 && a0.shown && a0.t === '🌱 콩나물 다시 심기 (6개 중 3개 · 체력 3 — 물 줄 체력 3 남김)' && !a0.tired, '㉮ 판 — 거둔 6 · 체력 6 «(6개 중 3개 · 체력 3 — 물 줄 체력 3 남김)»', JSON.stringify(a0));
  await press(J, 'resow', a0.left); await dlg();
  for (let i = 0; i < 20; i++) { const on = await J(`document.getElementById('event').classList.contains('on')`); if (on !== true) break; await J(`(()=>{ document.getElementById('event').click(); return 1; })()`); await sleep(400); }
  const a1 = await J(BTN);
  console.log('  ㉮ 한 번 누른 뒤', JSON.stringify(a1));
  if (OUT) await page.shot(`${OUT}/390_c7e_owed.png`);
  ok(!a1.탈 && a1.left === 3 && a1.idle === 3 && a1.harv === 3, '㉮ 한 번 누르면 3 심음 · 체력 3 · 물 기다림 3 · 거둔 것 3', JSON.stringify({ left: a1.left, idle: a1.idle, harv: a1.harv }));
  ok(!a1.탈 && a1.shown && a1.tired && a1.t === '🌱 콩나물 다시 심기 (남은 체력은 물 줄 몫 — 💧 먼저)', '㉮ 단추가 회색 «🌱 콩나물 다시 심기 (남은 체력은 물 줄 몫 — 💧 먼저)»', JSON.stringify({ t: a1.t, tired: a1.tired }));
  ok(!a1.탈 && a1.hint.tid !== 'resow' && !!a1.water && /물 주기/.test(a1.water), '㉮ 손가락은 다시 심기 아님 · [💧 물 주기]가 보임', JSON.stringify({ hint: a1.hint, water: a1.water }));
  await J(`(()=>{ document.getElementById('resow').click(); return 1; })()`); await sleep(1500);
  const bn = await J(`(()=>{ const e=document.getElementById('event'); const S=window.__S(); return { on: e.classList.contains('on'), t: (e.innerText||'').replace(/\\s+/g,' ').trim(), left: S.stamina.left, harv: S.firstPlay.beansprout.pots.filter(p=>p.slotId && p.harvested).length }; })()`);
  console.log('  ㉮ 회색 누름', JSON.stringify(bn));
  if (OUT) await page.shot(`${OUT}/390_c7e_owed_tap.png`);
  ok(!bn.탈 && bn.on && bn.t === '물 줄 체력을 남겨 둡니다 심은 시루에 먼저 💧 물을 주세요 — 물을 받아야 자랍니다' && bn.left === 3 && bn.harv === 3, '㉮ 회색을 누르면 배너 «물 줄 체력을 남겨 둡니다» · 체력 · 거둔 수 그대로', JSON.stringify(bn));
  /* ㉮-끝 총괄(plan a471092e) — §tiredOne(바닥 .tired 하나만)이 회색 다시 심기 때문에 다른 단추를 감추지 않나: 회색 동안(체력 3) · 물을 다 준 뒤(체력 0) 바닥 단추 판 */
  const TB = `(()=>{ const v=id=>{ const b=document.getElementById(id); return b && b.style.display !== 'none' && !!b.offsetParent ? { t: (b.textContent||'').replace(/\s+/g,' ').trim(), tired: b.classList.contains('tired') } : null; };
    return { left: window.__S().stamina.left, harvest: v('harvestCrop'), water: v('waterCrop'), resow: v('resow'), pot: v('waterPot') }; })()`;
  const t1 = await J(TB);
  console.log('  ㉮-끝 회색 동안 바닥', JSON.stringify(t1));
  ok(!t1.탈 && t1.resow && t1.resow.tired && t1.water && !t1.water.tired && !!t1.pot, '㉮-끝 회색 동안(체력 > 0) 다른 단추는 안 감춤 — [💧 물 주기] 초록 · 몬스테라 단추 보임(§tiredOne 은 체력 0 단추만 셋 가운데 하나로)', JSON.stringify(t1));
  for (let i = 0; i < 20; i++) { const on = await J(`document.getElementById('event').classList.contains('on')`); if (on !== true) break; await J(`(()=>{ document.getElementById('event').click(); return 1; })()`); await sleep(400); }
  await press(J, 'waterCrop', 3); await dlg();
  const t2 = await J(TB);
  const tiredN = ['harvest', 'water', 'resow'].filter(k => t2[k] && t2[k].tired).length;
  console.log('  ㉮-끝 물 다 준 뒤(체력 0) 바닥', JSON.stringify(t2), 'tired', tiredN);
  if (OUT) await page.shot(`${OUT}/390_c7e_zero.png`);
  ok(!t2.탈 && t2.left === 0 && tiredN === 1 && ['harvest', 'water', 'resow'].some(k => t2[k] && t2[k].tired && /오늘 손이 다 떨어졌습니다/.test(t2[k].t)) && !(t2.resow && /물 줄 몫/.test(t2.resow.t)) && !!t2.pot,
     '㉮-끝 체력 0 이 된 순간 — 회색 «물 줄 몫» 글은 안 서고 «오늘 손이 다 떨어졌습니다» 단추 하나 · 몬스테라 단추는 그대로', JSON.stringify({ t2, tiredN }));
  try { await page.close(); } catch (e) { console.log('  (탭 닫기 탈)', e.message); }
}
/* ═══ ㉯ ㉰ ㉱ ═══ */
{
  const { page, J, boot } = await open(390);
  await boot(stage({ harv: 4, idle: 2, left: 5 }));
  const b = await J(BTN);
  console.log('  ㉯ 거둔 4 · W 2 · 체력 5', JSON.stringify(b));
  ok(!b.탈 && b.shown && !b.tired && b.t === '🌱 콩나물 다시 심기 (4개 중 1개 · 체력 1 — 물 줄 체력 3 남김)', '㉯ 남은 체력에서 W 를 먼저 뺀 셈 «(4개 중 1개 · 체력 1 — 물 줄 체력 3 남김)»', JSON.stringify({ t: b.t, tired: b.tired }));
  await boot(stage({ fresh: 2, idle: 2, left: 2 }));
  const c = await J(BTN);
  console.log('  ㉰ 새 빈 2 · W 2 · 체력 2', JSON.stringify(c));
  ok(!c.탈 && c.shown && !c.tired && c.t === '🌱 콩 씨앗 심기 (1개 · 물은 내일)', '㉰ 새 빈 시루만 — 회색 아님 «🌱 콩 씨앗 심기 (1개 · 물은 내일)»', JSON.stringify({ t: c.t, tired: c.tired }));
  try { await page.close(); } catch (e) { console.log('  (탭 닫기 탈)', e.message); }
}
for (const wd of [360, 390]) {
  const { page, J, boot } = await open(wd);
  await boot(stage({ harv: 3, idle: 3, left: 3 }));
  const d = await J(BTN);
  console.log(`  ㉱ ${wd} 회색`, JSON.stringify(d));
  if (OUT) await page.shot(`${OUT}/${wd}_c7e_tail.png`);
  ok(!d.탈 && d.shown && d.tired && d.tailCut === false && d.btnCut === false, `㉱ ${wd} 회색 단추 꼬리 «…» 없음`, JSON.stringify({ t: d.t, tailCut: d.tailCut, btnCut: d.btnCut }));
  ok(!d.탈 && d.hint.on && d.hint.tid !== 'resow' && d.hint.say !== '씨앗 심기' && /물/.test(d.hint.say || ''), `㉱ ${wd} 회색 동안 손가락은 거둔 시루 «씨앗 심기» · 다시 심기가 아니라 물 쪽`, JSON.stringify(d.hint));
  try { await page.close(); } catch (e) { console.log('  (탭 닫기 탈)', e.message); }
}
ok(exc.length === 0, '처리 안 된 예외 0', exc.slice(0, 3).join(' / '));
console.log(bad ? `probe_critic7_e: 빨강 ${bad}` : 'probe_critic7_e: 다 통과');
process.exit(bad ? 1 : 0);
