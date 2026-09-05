/* tools/probe_longwalk.mjs — **세 바퀴 «너머»를 걷는다: 손가락이 있으면 손가락을, 없으면 «할 일 줄»을 따라** (2026-09-06 밤 · 총괄 ①)
   ------------------------------------------------------------------
   probe_force5 는 손가락만 따르므로 세팅 끝 뒤(자유 구간)는 못 걷는다. 이 자는 그 뒤를 잇는다:
     ① 손가락이 있으면 그대로 따른다(끌어 보세요 → 끈다 · 첫 플레이의 강제 구간)
     ② 손가락이 없으면 «살림»을 한다 — [식물] 줄의 [거두기]·[심기]·[물 주기]를 «코어가 살아 있다고 한 것만» 누른다
     ③ 그리고 «할 일 줄»(#quest)을 읽어 그 일을 한다 — 「시루를 N으로」 ⇒ 사고 놓는다 · 「무순/한 상에 두 가지」 ⇒ 판·씨앗을 사고 놓고 심는다
     ④ 할 일이 없거나 오늘 더 할 수 없으면 [다음 날]
   재는 것: 퀘스트가 «뜬 날·끝난 날»(세팅 끝 → siru5 끝 → crop_mix → radish5 → siru8) · 어디서 «막히나»(돈·씨앗·체력·자리) · 하루마다 무엇을 했나
   판: W×H(밑값 1770×1188) · 새 판 · 진짜 마우스(손가락·가방 칸) + 시트 줄 단추는 DOM 누름(위임 click) · ★ 연출 생략(setActInstant) — 헤드리스는 연출이 열 몇 초라
   ⛔ 값을 안 바꾼다. 막히면 «적는다». */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8972';
const W = Number(process.env.W || 1770), H = Number(process.env.H || 1188);
const DAYS = Number(process.env.DAYS || 90);
const STOP_AT = process.env.STOP_AT || 'siru8';          /* 이 줄이 끝나면 멈춘다 */
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 2400000);
wd.unref && wd.unref();
const page = await launch({ width: W, height: H, dpr: 1 });
await page.goto(`${BASE}/game.html`);
await page.eval('localStorage.clear()', false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 150000, 300);
await sleep(4000);
await page.eval(`(()=>{ try { window.__rv.setActInstant(true); } catch(e){} })()`, false);
const m = (type, x, y, buttons) => page.send('Input.dispatchMouseEvent',
  { type, x: Math.round(x), y: Math.round(y), button: 'left', buttons, clickCount: 1 });
const tapAt = async (x, y) => { await m('mouseMoved', x, y, 0); await m('mousePressed', x, y, 1);
  await sleep(80); await m('mouseReleased', x, y, 0); await sleep(700); };
const clearDlg = async () => { for (let i = 0; i < 40; i++) {
  const t = await page.eval(`String(document.getElementById('stage').classList.contains('talking'))`);
  if (t !== 'true') return true;
  await page.eval(`(()=>{ const x=document.getElementById('dlgBox'); if (x) x.click(); })()`, false);
  await sleep(150); } return false; };
const quiet = async () => { for (let i = 0; i < 2; i++) { await clearDlg(); await sleep(400); } };
const J = async (js, ms = 30000) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, ms));
const fingerAt = () => page.eval(`(()=>{ const h=document.getElementById('hint');
  if (!h || !h.classList.contains('on')) return 'null';
  const r=h.getBoundingClientRect(); const t=document.querySelector('.hintTarget'); const tr=t?t.getBoundingClientRect():null;
  const d=document.getElementById('hintDim'); const hole=(d&&d.dataset.hole||'').split(',').map(Number);
  const at = tr && tr.width ? { x:tr.left+tr.width/2, y:tr.top+tr.height/2 }
           : (hole.length===3 && hole.every(Number.isFinite)) ? { x:hole[0], y:hole[1] } : { x:r.left+r.width/2, y:r.top+r.height/2 };
  return JSON.stringify({ x:at.x, y:at.y, 짚는것: t ? (t.id || (t.className||'').split(' ')[0]) : '(점)',
    말: ((h.querySelector('.say')||{}).textContent||'').trim().slice(0,34) }); })()`);
const state = () => J(`(async()=>{ const fp=await import('/src/game/first_play.js'); const S=window.__S();
  const rows=[]; try { for (const r of (fp.cropPotList(S.firstPlay,S.day)||[])) rows.push({ 종:r.kind, 놓임:!!r.placed, 심어야:!!(r.needsSow||r.needsResow), 물:!!r.needsWater, 익음:!!r.ready, 자람:!!r.growing }); } catch(e){}
  const stm=await import('/src/game/stamina.js'); let sv=null; try { sv=stm.staminaView(S); } catch(e){}
  return { 날:S.day, 할일:(document.getElementById('quest').textContent||'').trim().slice(0,30),
    체력:sv?(sv.left??sv.now):null, 최대:sv?sv.max:null, 돈:(S.tutorial&&S.tutorial.cashWon)??null,
    줄:rows, 뜬:(S.stamina&&S.stamina.questsOpenedOn)||{}, 끝:(S.stamina&&S.stamina.questsTaken)||[],
    가방: { 시루: (S.shop&&S.shop.stock&&S.shop.stock.siru)||0, 판:(S.shop&&S.shop.stock&&S.shop.stock.sprout_tray)||0,
            콩씨:(S.shop&&S.shop.stock&&S.shop.stock.bean_seed)||0, 무씨:(S.shop&&S.shop.stock&&S.shop.stock.radish_seed)||0 },
    주문:(S.shop&&S.shop.orders||[]).map(o=>o.itemId+':'+(o.arrivesOnDay-S.day)) }; })()`);
const banner = () => page.eval(`((document.getElementById('banner')||{}).textContent||'').trim().slice(0,70)`);
const domClick = (sel) => page.eval(`(()=>{ const b=document.querySelector(${JSON.stringify(sel)}); if(!b||b.disabled) return 'no'; b.click(); return 'ok'; })()`);
const tapEl = async (sel) => { const r = JSON.parse(await page.eval(`(()=>{ const b=document.querySelector(${JSON.stringify(sel)}); if(!b) return 'null';
  const r=b.getBoundingClientRect(); if(!(r.width>0)) return 'null'; return JSON.stringify({x:r.left+r.width/2,y:r.top+r.height/2}); })()`));
  if (!r) return false; await tapAt(r.x, r.y); return true; };
const openTab = async (tabId, navId) => {
  const sel = await page.eval(`(()=>{ const t=document.getElementById('${tabId}'); return t && t.getAttribute('aria-selected')==='true' ? 'on' : 'off'; })()`);
  if (sel === 'on') return;
  if (!await tapEl('#' + navId)) await tapEl('#' + tabId);
  await sleep(500);
};
/* ── 손가락 따르기(끌기 포함 · probe_force5 와 같은 손) ── */
const followFinger = async (log) => {
  const f = JSON.parse(await fingerAt());
  if (!f) return false;
  if (/끌어/.test(String(f.말 || ''))) {
    const gp = JSON.parse(await page.eval(`(()=>{ const S=window.__S(); const p=(S.pots||[])[0]; const rv=window.__rv, c=document.getElementById('roomCanvas');
      if(!c) return 'null'; const r=c.getBoundingClientRect(); let sp=null;
      try { if (p && p.slotId && rv && rv.screenPosOf) sp = rv.screenPosOf(p.slotId); } catch(e){}
      if (sp) return JSON.stringify({ x:Math.round(r.left+sp.x), y:Math.round(r.top+sp.y) });
      return JSON.stringify({ x:Math.round(r.left+r.width*0.5), y:Math.round(r.top+r.height*0.62) }); })()`));
    if (gp) {
      await m('mouseMoved', gp.x, gp.y, 0); await m('mousePressed', gp.x, gp.y, 1);
      for (let k = 1; k <= 12; k++) { await m('mouseMoved', gp.x + (f.x - gp.x) * k / 12, gp.y + (f.y - gp.y) * k / 12, 1); await sleep(40); }
      await sleep(250); await m('mouseReleased', f.x, f.y, 0); await sleep(1200);
      log.push(`👉 끌기 「${f.말}」`); return true;
    }
  }
  await tapAt(f.x, f.y); await quiet();
  log.push(`👉 ${f.짚는것} 「${f.말}」`);
  return true;
};
/* ── 살림: 코어가 살아 있다고 한 줄 단추만 ── */
const upkeep = async (log) => {
  let did = 0;
  for (const act of ['harvest', 'sow', 'plant', 'water']) {
    for (let i = 0; i < 8; i++) {
      const st = await state();
      if (st.체력 != null && st.체력 <= 0) { log.push('⛔ 체력 0 — 오늘은 여기까지'); return did; }
      /* 심기는 씨앗이 있어야 «먹는다» — 단추는 잠기지 않아 씨앗 없이 누르면 아무 일도 안 난다(실측: 하루 서른 번 헛눌렀다) */
      if ((act === 'sow' || act === 'plant') && st.가방.콩씨 <= 0 && st.가방.무씨 <= 0) break;
      const before = JSON.stringify([st.줄, st.체력]);
      const r = await domClick(`#siruList button[data-act="${act}"]:not([disabled])`);
      if (r !== 'ok') break;
      await sleep(350); await quiet();
      const after = await state();
      if (JSON.stringify([after.줄, after.체력]) === before) { log.push(`⚠ ${act} 눌렀는데 판이 안 바뀜 · ${await banner()}`); break; }
      did++;
      log.push(`🔧 ${act} · ${await banner()}`);
    }
  }
  return did;
};
/* ── 할 일 줄을 따라 ── */
const buy = async (itemId, log) => {
  await openTab('tabShop', 'navShop');
  const r = await domClick(`#shopList [data-buy="${itemId}"]`);
  if (r !== 'ok') { log.push(`⛔ 상점에 [${itemId}] 단추가 없거나 잠김`); return false; }
  await sleep(400);
  const go = await domClick('#buyGo');
  await sleep(500); await quiet();
  const b = await banner();
  log.push(`🛒 ${itemId} → ${go} · ${b}`);
  return /주문했습니다/.test(b);
};
const placeFromBag = async (thumbId, log) => {
  await openTab('tabBag', 'openBag');
  if (!await tapEl('#' + thumbId)) { log.push(`⛔ 가방 칸 #${thumbId} 이 안 보인다`); return false; }
  await sleep(900);
  const ok = await tapEl('#placeOk');
  await sleep(700); await quiet();
  log.push(`📦 #${thumbId} 놓기 → [확인] ${ok ? '눌림' : '없음'} · ${await banner()}`);
  return ok;
};
const goal = async (st, log) => {
  const todo = st.할일 || '';
  const beans = st.줄.filter(r => r.종 === 'beansprout').length;
  const musuns = st.줄.filter(r => r.종 === 'musun');
  const ordered = (id) => st.주문.some(o => o.startsWith(id + ':'));
  /* 씨앗 — 심어야 하는 줄이 있는데 씨앗이 없으면 시킨다 */
  if (st.줄.some(r => r.종 === 'beansprout' && r.심어야) && st.가방.콩씨 <= 0 && !ordered('bean_seed')) return buy('bean_seed', log);
  const mN = /시루를\s*(\d+)/.exec(todo);
  if (mN) {
    const want = Number(mN[1]);
    if (beans < want) {
      if (st.가방.시루 > 0) return placeFromBag('cropThumb', log);
      if (!ordered('siru')) return buy('siru', log);
      log.push('⏳ 시루 오는 중'); return false;
    }
  }
  if (/무순|두 가지/.test(todo)) {
    if (!musuns.length) {
      if (st.가방.판 > 0) return placeFromBag('musunThumb', log);
      if (!ordered('sprout_tray')) return buy('sprout_tray', log);
      log.push('⏳ 재배판 오는 중'); return false;
    }
    if (musuns.some(r => r.심어야) && st.가방.무씨 <= 0 && !ordered('radish_seed')) return buy('radish_seed', log);
    const mM = /무순.*?(\d+)/.exec(todo);
    if (mM && musuns.length < Number(mM[1])) {
      if (st.가방.판 > 0) return placeFromBag('musunThumb', log);
      if (!ordered('sprout_tray')) return buy('sprout_tray', log);
    }
  }
  return false;
};
const nextDay = async () => {
  for (let k = 0; k < 6; k++) {
    await quiet();
    const go = JSON.parse(await page.eval(`(()=>{ const pop=document.querySelector('.pop.on');
      const b = pop ? [...pop.querySelectorAll('button.go')].find(x=>!x.disabled) : null;
      const n = b || document.getElementById('next'); if(!n || n.disabled) return 'null';
      const r=n.getBoundingClientRect(); return JSON.stringify({ x:r.left+r.width/2, y:r.top+r.height/2, id:n.id }); })()`));
    if (!go) { await sleep(400); continue; }
    const before = await page.eval(`String(window.__S().day)`);
    if (go.id === 'next') await domClick('#next'); else await tapAt(go.x, go.y);
    await quiet();
    if (await page.eval(`String(window.__S().day)`) !== before) return true;
  }
  return false;
};
/* ── 걷기 ── */
await quiet();
const days = [], seen = { opened: {}, done: {} };
let stuck = 0;
for (let d = 0; d < DAYS; d++) {
  const log = [];
  let st = await state();
  for (const [id, on] of Object.entries(st.뜬 || {})) if (seen.opened[id] == null) seen.opened[id] = on;
  for (const id of st.끝 || []) if (seen.done[id] == null) seen.done[id] = st.날;
  if (seen.done[STOP_AT] != null) { console.log(`★ ${STOP_AT} 끝 — Day ${st.날} 에서 멈춘다`); break; }
  /* ① 손가락 */
  for (let i = 0, same = 0; i < 16; i++) {
    const n0 = log.length;
    if (!await followFinger(log)) break;
    /* 같은 것을 네 번 짚었는데 판이 안 바뀌면 그 손가락은 오늘 «못 따르는» 것이다 — 살림으로 넘어간다(제자리걸음 막기) */
    if (log.length > n0 && log[log.length - 1] === log[log.length - 2]) { if (++same >= 3) { log.push('⛔ 같은 손가락 네 번 — 살림으로'); break; } } else same = 0;
    const s2 = await state(); if (s2.날 !== st.날) { log.push(`(손가락이 하루를 넘겼다 → Day ${s2.날})`); st = s2; }
  }
  st = await state(); if (st.날 !== days.length + (days[0] ? days[0].날 : 0) && days.length && st.날 !== days[days.length - 1].날 + 1) { /* 손가락이 하루를 넘겼다 */ }
  /* ② 살림 ③ 할 일 — 몇 번 돌려 본다(산 것이 오면 놓고, 놓으면 심고…) */
  for (let r = 0; r < 4; r++) {
    const did = await upkeep(log);
    st = await state();
    const g = await goal(st, log);
    if (!did && !g) break;
  }
  st = await state();
  const sig = JSON.stringify([st.할일, st.줄.length, st.가방, st.끝.length]);
  days.push({ 날: st.날, 할일: st.할일, 체력: `${st.체력}/${st.최대}`, 돈: st.돈, 줄: st.줄.length, 가방: st.가방, 주문: st.주문.join(','), log });
  console.log(`Day ${String(st.날).padStart(3)} · ${st.체력}/${st.최대} · ₩${st.돈} · 시루${st.줄.filter(r => r.종 === 'beansprout').length} 무순${st.줄.filter(r => r.종 === 'musun').length} · 「${st.할일}」` + (log.length ? '\n     ' + log.join('\n     ') : ''));
  if (days.length >= 2 && JSON.stringify([days[days.length - 2].할일, days[days.length - 2].줄, days[days.length - 2].가방]) === JSON.stringify([st.할일, st.줄.length, st.가방]) && !log.some(l => /🔧|🛒|📦|👉/.test(l))) stuck++; else stuck = 0;
  if (stuck >= 12) { console.log('⛔⛔ 열두 날 내리 아무것도 못 했다 — 여기가 막힌 데다'); break; }
  if (!await nextDay()) { console.log('⚠ 하루를 못 넘겼다'); break; }
}
const fin = await state();
for (const [id, on] of Object.entries(fin.뜬 || {})) if (seen.opened[id] == null) seen.opened[id] = on;
for (const id of fin.끝 || []) if (seen.done[id] == null) seen.done[id] = fin.날;
console.log('');
console.log('=== ★ 퀘스트가 «뜬 날» · «끝난 날» (걸어서) ===');
const q = await J(`(async()=>{ const Q=await import('/src/game/quest.js'); return Q.QUESTS.map(x=>({id:x.id, ko:x.ko, after:x.after||null})); })()`);
for (const x of q) console.log(`  ${x.id.padEnd(14)} 뜬 ${seen.opened[x.id] != null ? 'd' + seen.opened[x.id] : 'd—'}  끝 ${seen.done[x.id] != null ? 'd' + seen.done[x.id] : 'd—'}   ${x.ko}`);
console.log('');
console.log('=== 막힌 데 ===');
const blocks = days.flatMap(dd => dd.log.filter(l => /⛔|⏳/.test(l)).map(l => `d${dd.날} ${l}`));
console.log(blocks.length ? blocks.slice(0, 40).map(b => '  ' + b).join('\n') : '  없음');
await page.shot('docs/handoff/img/longwalk.png').catch(() => {});
await page.close(); clearTimeout(wd);
