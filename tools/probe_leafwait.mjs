/* tools/probe_leafwait.mjs — **진짜 생장 창에서 turn.leafWait 칸이 읽히나** (2026-10-08 · [plan] plan-leafwait ③)
   ------------------------------------------------------------------
   칸 셈 자체는 tools/test_leaf_wait.mjs(가짜 하루)가 본다. 여기는 «배선»만 본다:
     ① 잎 줄을 생장 창(leafOnPlant)에서 읽나 — leaves·youngestLeafM 이 null 이 아닌가
     ② 창턱 · 밴드 낱말 · 자란 날 · 기다린 날이 하루마다 움직이나
     ③ 확대창을 열면 zoomOpenedSinceArrival 이 참이 되나
     ④ 상태 줄(status*)이 대사 기록(__dlgLog)에 나오나 — 나오면 어느 날 무엇이
   ⚠ 판은 «지름길»로 세운다: 선물 그루를 창턱(banjiha-sill:0)에 바로 주고 arrived 를 켠다. 물은 사흘마다 준다.
     그래서 이 자는 «보통 판의 날짜»를 안 잰다 — 그것은 night_play guided(총괄)가 잰다.
   판: 폰 390×844. DAYS(기본 24). ⛔ 값 0. */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:9300';
const DAYS = Number(process.env.DAYS || 24);
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 900000);
wd.unref && wd.unref();
const page = await launch({ width: 390, height: 844, dpr: 1 });
await page.goto(`${BASE}/game.html`);
await page.eval('localStorage.clear()', false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 240000, 500);
await sleep(3500);
const J = async (e) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${e})); } catch(e) { return JSON.stringify({ 탈:e.message }); } })()`, true, 60000));
const clearDlg = async () => { for (let i = 0; i < 60; i++) { const t = await page.eval(`document.getElementById('stage').classList.contains('talking')`); if (t !== true) return; await page.eval(`(()=>{ const x=document.getElementById('dlgBox'); if (x) x.click(); })()`, false); await sleep(120); } };
await clearDlg();
/* 첫날 [다음 날] 문지기는 «방에 선 시루»를 본다 — 손가락대로 시루를 놓는다(probe_walk_trap ① 과 같은 걸음) */
const m = (type, x, y, buttons) => page.send('Input.dispatchMouseEvent', { type, x: Math.round(x), y: Math.round(y), button: 'left', buttons, clickCount: 1 });
const tapAt = async (x, y) => { await m('mouseMoved', x, y, 0); await m('mousePressed', x, y, 1); await sleep(80); await m('mouseReleased', x, y, 0); await sleep(700); };
for (let i = 0; i < 8; i++) {
  const placed = await J(`(()=>{ try { return window.__S().firstPlay.beansprout.pots.some(p=>p && (p.slotId || p.at)); } catch(e) { return false; } })()`);
  const say = await J(`(()=>{ const h=document.getElementById('hint'); return h ? ((h.querySelector('.say')||{}).textContent||'').trim() : ''; })()`);
  if (placed && !/둘까요/.test(say)) break;
  const at = await J(`(()=>{ const t=document.querySelector('.hintTarget'); if(!t) return null; const r=t.getBoundingClientRect(); return r.width>0 ? { x:r.left+r.width/2, y:r.top+r.height/2 } : null; })()`);
  if (!at) break; await tapAt(at.x, at.y); await clearDlg();
}
console.log('■ 시루 놓음 —', await J(`window.__S().firstPlay.beansprout.pots.some(p=>p && (p.slotId || p.at))`));
console.log('■ 판 세우기 —', JSON.stringify(await J(`(async()=>{ const st=await import('/src/game/state.js'); const S=window.__S();
  if(!(S.pots||[]).length) st.givePlant(S, window.__io, { slotId:'banjiha-sill:0' });
  const p=S.pots[0]; S.firstPlay.monstera.arrived=true; p.arrivedOnDay=S.day;
  try { window.__redraw && window.__redraw(); } catch(e){}
  return { day:S.day, pot:p.id, slotId:p.slotId, arrivedOnDay:p.arrivedOnDay }; })()`)));
await sleep(1500);
const nextDay = async () => {
  await clearDlg();
  const d0 = await J(`window.__S().day`);
  /* 카메라·창이 늦게 서면 한 번에 안 넘어간다 — 날이 바뀔 때까지 다시 누른다(최대 여덟 번) */
  for (let k = 0; k < 8; k++) {
    if (k) { await sleep(700); if ((await J(`window.__S().day`)) !== d0) break; }
    const r = await J(`(()=>{ const p=document.querySelector('.pop.on'); const b=p ? [...p.querySelectorAll('button.go,button.primary')].find(x=>!x.disabled) : null;
      if (b) { b.click(); return 'pop'; } const n=document.getElementById('next'); if(!n||n.disabled) return null; n.click(); return 'next'; })()`);
    await sleep(900); await clearDlg();
    if (r !== 'pop' && (await J(`window.__S().day`)) !== d0) break;
  }
};
const rows = [];
let zoomed = false;
for (let i = 0; i < DAYS; i++) {
  /* 물 — 사흘마다(마른 날은 grew 가 거짓이 된다 · 이 자는 배선만 본다) */
  if (i % 3 === 0) await J(`(async()=>{ const st=await import('/src/game/state.js'); try { st.waterPot(window.__S()); return true; } catch(e) { return e.message; } })()`);
  const d0 = await J(`window.__S().day`);
  await nextDay();
  const d1 = await J(`window.__S().day`);
  const lw = await J(`window.__leafWait()`);
  const said = await J(`(window.__dlgLog||[]).filter(x=>x.day===${d1}).map(x=>x.id)`);
  rows.push({ day: d1, lw, said });
  const s = lw ? `잎 ${lw.leaves} · 새잎 ${lw.newLeafToday} · 기다림 ${lw.leafWaitDays} · 어린잎M ${lw.youngestLeafM == null ? null : lw.youngestLeafM.toFixed(2)} · 자람 ${lw.growStreak} · 창턱 ${lw.potOnSill} · 빛 ${lw.band} · 확대 ${lw.zoomOpenedSinceArrival} · 거둠 ${lw.harvestedToday}/${lw.harvestsSinceArrival}` : 'null';
  console.log(`  d${d0}→${d1} ${s}${said.length ? ' · 말: ' + said.join(',') : ''}`);
  if (d1 === d0) {
    const why = await J(`(()=>{ const n=document.getElementById('next'); const p=[...document.querySelectorAll('.pop.on')].map(x=>x.id||x.className);
      const e=document.getElementById('errBox'); const h=document.getElementById('hint');
      return { next: n ? { disabled:n.disabled, text:(n.textContent||'').trim().slice(0,40), vis:getComputedStyle(n).visibility } : null, pops:p,
               err: e ? (e.textContent||'').trim().slice(0,160) : null, hint: h ? ((h.querySelector('.say')||{}).textContent||'').trim() : null,
               talking: document.getElementById('stage').classList.contains('talking'), sheet: document.documentElement.classList.contains('sheetopen') }; })()`);
    console.log('  ⚠ 하루가 안 넘어갔다 — 멈춤 ·', JSON.stringify(why)); break; }
  /* ③ 확대창 — 닷새째에 한 번 연다 */
  if (i === 5 && !zoomed) {
    zoomed = true;
    await page.eval(`(()=>{ try { const S=window.__S(); window.__byeotZoom.open(S.pots[0].slotId); } catch(e){} })()`, false);
    await sleep(1200);
    const w = await J(`window.__S().firstPlay.monstera.watch`);
    await page.eval(`(()=>{ try { window.__byeotZoom.close(); } catch(e){} })()`, false);
    await sleep(600);
    console.log('  ■ 확대창을 열었다 — watch.zoomOpened =', w && w.zoomOpened);
  }
}
let fail = 0;
const ok = (c, msg) => { console.log(`  ${c ? 'OK  ' : 'FAIL'} ${msg}`); if (!c) fail++; };
const lws = rows.map(r => r.lw).filter(Boolean);
ok(lws.length === rows.length && rows.length > 0, `① 날마다 칸이 있다(${lws.length}/${rows.length})`);
ok(lws.every(l => Number.isInteger(l.leaves) && l.leaves >= 1), '① 잎 수를 생장 창에서 읽는다(null 아님)');
ok(lws.some(l => typeof l.youngestLeafM === 'number'), '① 가장 어린 잎 leafM 을 읽는다');
ok(lws.every(l => l.potOnSill === true), '② 창턱');
ok(lws.every(l => ['dark', 'mid', 'bright'].includes(l.band)), `② 빛 낱말 — ${[...new Set(lws.map(l => l.band))].join(',')}`);
ok(lws.slice(1).some(l => l.newLeafToday === false || l.newLeafToday === true), '② 둘째 날부터 새 잎 칸이 참·거짓으로 선다');
ok(lws[lws.length - 1].zoomOpenedSinceArrival === true && lws[0].zoomOpenedSinceArrival === false, '③ 확대창을 열기 전 false · 연 뒤 true');
const statusSaid = rows.flatMap(r => r.said.filter(id => /^status/.test(id)).map(id => `d${r.day}:${id}`));
console.log('■ 상태 줄 —', statusSaid.length ? statusSaid.join(' · ') : '(없음)');
console.log('■ 새 잎 난 날 —', rows.filter(r => r.lw && r.lw.newLeafToday === true).map(r => 'd' + r.day).join(' ') || '(없음)');
await page.close(); clearTimeout(wd);
console.log(fail ? `\nprobe_leafwait: FAIL ${fail}` : '\nprobe_leafwait: PASS');
process.exit(fail ? 1 : 0);
