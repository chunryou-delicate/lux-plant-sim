/* tools/probe_core_d11_13.mjs — **10-07 판 core 몫 셋을 «걸어서» 잰다** (D11 검수 숨김 · D12 첫날 진행 칩 · D13 밥상 한 줄)
   ------------------------------------------------------------------
   D11  주소에 ?dev=1 이 없으면 [검수] 탭·개발자 설정이 «안 보인다» · 기록(#log)은 [방] 탭 «기록»에 있다 · ?dev=1 이면 보인다
   D12  초반 사슬(5줄) 동안 칩 머리가 「📜 N/5 · …」 — 첫날 「1/5 · 시루 놓기」에서 걸음마다 오른다
   D13  밥상 창은 처음·달라진 날·모자란 날만 팝업. «어제와 같은» 날은 팝업 없이 배너 「오늘 밥상 — 어제와 같습니다」 한 줄로 넘어간다
   판: W×H(기본 폰 390×844) · 진짜 마우스 · 손가락을 따라 시루를 놓고 심고 물을 준 뒤 [다음 날]만 DAYS 번. ⛔ 값 0. */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:9300';
const W = Number(process.env.W || 390), H = Number(process.env.H || 844);
const DAYS = Number(process.env.DAYS || 12);
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 900000);
wd.unref && wd.unref();
let pass = 0, fail = 0;
const ok = (ko, v, why) => { v ? pass++ : fail++; console.log(`  ${v ? 'OK  ' : 'FAIL'} ${ko}  → ${why}`); };

const page = await launch({ width: W, height: H, dpr: 1 });
const J = async (e) => JSON.parse(await page.eval(`(()=>{ try { return JSON.stringify((${e})); } catch(e) { return JSON.stringify({ 탈:e.message }); } })()`));
const m = (type, x, y, buttons) => page.send('Input.dispatchMouseEvent', { type, x: Math.round(x), y: Math.round(y), button: 'left', buttons, clickCount: 1 });
const tapAt = async (x, y) => { await m('mouseMoved', x, y, 0); await m('mousePressed', x, y, 1); await sleep(80); await m('mouseReleased', x, y, 0); await sleep(700); };
const clearDlg = async () => { for (let i = 0; i < 40; i++) { const t = await page.eval(`document.getElementById('stage').classList.contains('talking')`); if (t !== true) return; await page.eval(`(()=>{ const x=document.getElementById('dlgBox'); if (x) x.click(); })()`, false); await sleep(150); } };
const vis = (sel) => `(()=>{ const e=document.querySelector(${JSON.stringify(sel)}); if(!e) return null; const cs=getComputedStyle(e); return cs.display!=='none' && cs.visibility!=='hidden'; })()`;
const chipHead = () => J(`(()=>{ const b=document.querySelector('#questChip b'); return b ? (b.textContent||'').trim() : null; })()`);

/* ── D11 · ?dev=1 판 먼저(보이나) ── */
await page.goto(`${BASE}/game.html?dev=1`);
await page.eval('localStorage.clear()', false);
await page.goto(`${BASE}/game.html?dev=1`);
await page.waitFor('!!window.__rv', 240000, 500);
await sleep(2000);
const dev1 = { tab: await J(vis('#tabDev')), roomDev: await J(vis('#roomDev')) };
console.log('■ D11 ?dev=1 —', JSON.stringify(dev1));
ok('D11 ?dev=1 이면 [검수] 탭이 보인다', dev1.tab === true, JSON.stringify(dev1));

/* ── 사람 판(?dev 없음) ── */
await page.goto(`${BASE}/game.html`);
await page.eval('localStorage.clear()', false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 240000, 500);
await sleep(3000);
const d11 = await J(`({ tab: ${vis('#tabDev')}, roomDev: ${vis('#roomDev')},
  logInRoom: !!document.querySelector('#pageRoom #logBox #log'), logInDev: !!document.querySelector('#pageDev #log'),
  devClass: document.documentElement.classList.contains('dev') })`);
console.log('■ D11 사람 판 —', JSON.stringify(d11));
ok('D11 [검수] 탭이 안 보인다', d11.tab === false, JSON.stringify(d11));
ok('D11 개발자 설정이 안 보인다', d11.roomDev === false, JSON.stringify(d11));
ok('D11 기록(#log)은 [방] 탭 «기록»에 있다(검수 탭엔 없다)', d11.logInRoom === true && d11.logInDev === false, JSON.stringify(d11));

await clearDlg();
const heads = [];
heads.push(await chipHead());
console.log('■ D12 첫 칩 머리 —', heads[0]);
ok('D12 첫날 칩 머리가 「📜 1/5 · 시루 놓기」', heads[0] === '📜 1/5 · 시루 놓기', String(heads[0]));

/* 손가락을 따라 시루를 놓고 심고 물을 준다(probe_zoom 과 같은 손) */
const tapHint = async () => {
  const at = await J(`(()=>{ const t=document.querySelector('.hintTarget'); const d=document.getElementById('hintDim'); const hole=(d&&d.dataset.hole||'').split(',').map(Number);
    if (t) { const r=t.getBoundingClientRect(); if (r.width>0) return { x:r.left+r.width/2, y:r.top+r.height/2 }; }
    if (hole.length===3 && hole.every(Number.isFinite)) return { x:hole[0], y:hole[1] }; return null; })()`);
  if (!at) return false; await tapAt(at.x, at.y); await clearDlg(); return true;
};
for (let i = 0; i < 14; i++) {
  const st = await J(`(()=>{ const S=window.__S(); const p=(S.firstPlay.beansprout.pots||[])[0]; return { 자람: !!(p && p.startedOnDay != null) }; })()`);
  const h = await chipHead(); if (h && h !== heads[heads.length - 1]) heads.push(h);
  if (st.자람) break;
  if (!await tapHint()) break;
}
{ const h = await chipHead(); if (h && h !== heads[heads.length - 1]) heads.push(h); }
console.log('■ D12 칩 머리 차례 —', JSON.stringify(heads));
ok('D12 걸음마다 칩 머리가 오른다(1/5 → 2/5 …)', heads.length >= 2 && /^📜 2\/5 · /.test(heads[1] || ''), JSON.stringify(heads));

/* ── D13 · [다음 날]만 누른다. 날마다 «팝업이 떴나 · 배너가 무엇인가»를 적는다 ── */
const quiet = async () => { await clearDlg(); for (let i = 0; i < 30; i++) { const b = await page.eval(`!!window.__dayAnimRunning || document.getElementById('stage').classList.contains('dayanim')`); if (!b) return; await sleep(200); } };
const nextBtn = () => J(`(()=>{ const n=document.getElementById('next'); if(!n||n.disabled) return null; const r=n.getBoundingClientRect(); return { x:r.left+r.width/2, y:r.top+r.height/2 }; })()`);
const rows = [];
/* D13_SEED=1 — 곳간을 «넉넉히» 채워 놓고 잰다(시루 하나 판은 수확이 닷새에 한 번이라 «어제와 같은 날»이 안 생긴다 · 잰 것).
   콩나물 꾸러미 3,000g(30,000원) 하나 — first_play §곳간 꾸러미 모양 그대로. 값이 아니라 판을 세우는 것이다 */
if (process.env.D13_SEED === '1') {
  console.log('■ D13 곳간 세움 —', JSON.stringify(await J(`(()=>{ const fp=window.__S().firstPlay; fp.food.pantryWon = 30000;
    fp.food.pantryLots = [{ kind:'beansprout', day: window.__S().day, won: 30000, meals: 3 }]; try { window.__redraw(); } catch(e){}
    return { pantryWon: fp.food.pantryWon }; })()`)));
}
for (let i = 0; i < DAYS; i++) {
  await quiet();
  /* 손가락을 따라 할 것을 한다(거두기·다시 심기·물 주기 …) — 손가락이 [다음 날]을 짚으면 멈춘다. 그래야 곳간이 차고 밥상이 선다 */
  for (let k = 0; k < 5; k++) {
    const tid = await J(`(()=>{ const t=document.querySelector('.hintTarget'); const h=document.getElementById('hint'); return (h && h.classList.contains('on')) ? (t ? (t.id || t.className.split(' ')[0]) : '(점)') : null; })()`);
    if (!tid || tid === 'next') break;
    if (!await tapHint()) break;
    await quiet();
  }
  const d0 = await J(`window.__S().day`);
  const n = await nextBtn(); if (!n) { console.log('  ⚠ [다음 날]이 안 눌린다'); break; }
  await tapAt(n.x, n.y); await sleep(500);
  const afterTap = await J(`({ pop: document.getElementById('mealPanel').classList.contains('on'), day: window.__S().day,
    other: [...document.querySelectorAll('.pop.on')].map(e=>e.id).filter(id=>id!=='mealPanel').join(',') || null,
    banner: (()=>{ const e=document.getElementById('event'); if (!e || !e.classList.contains('on')) return ''; return (e.innerText||'').trim().replace(/\\s*\\n\\s*/g,' / ').slice(0,80); })() })`);
  let popped = afterTap.pop;
  if (popped) {     /* 창이 떴으면 [이대로 다음 날 ▸] */
    const go = await J(`(()=>{ const b=document.getElementById('mealGo'); const r=b?b.getBoundingClientRect():null; return r&&r.width>0 ? { x:r.left+r.width/2, y:r.top+r.height/2 } : null; })()`);
    if (go) await tapAt(go.x, go.y);
  }
  await quiet(); await sleep(400);
  const d1 = await J(`window.__S().day`);
  const pantry = await J(`(()=>{ try { const fp=window.__S().firstPlay; return Math.round((fp.food&&fp.food.pantryGrams)||0); } catch(e) { return null; } })()`);
  /* 다른 창(첫 달 가계부 등)이 떠서 [다음 날]이 안 먹은 누름은 «다른 창 날»로 적는다 — 밥상과 무관하다(총괄 #9 그 창) */
  if (afterTap.other) { try { await page.eval(`(()=>{ const p=document.querySelector('.pop.on:not(#mealPanel)'); const b=p&&([...p.querySelectorAll('button.go,button.primary,button')].pop()); if(b) b.click(); })()`, false); } catch {} }
  rows.push({ d0, d1, popped, banner: afterTap.banner, pantry, other: afterTap.other });
  console.log(`  d${d0}→d${d1} · 밥상 ${popped ? '팝업' : '—'} · 배너 「${afterTap.banner}」`);
}
const meals = rows.filter(r => r.popped || /오늘 밥상/.test(r.banner));
const skipped = rows.filter(r => !r.popped && /어제와 같습니다/.test(r.banner));
ok('D13 처음 밥상 날은 팝업이다', meals.length > 0 && meals[0].popped === true, JSON.stringify(meals[0] || null));
ok('D13 어제와 같은 날은 팝업 없이 배너 한 줄로 넘어간다(한 번 이상)', skipped.length >= 1 && skipped.every(r => r.d1 === r.d0 + 1),
   `넘긴 날 ${skipped.length} · ${JSON.stringify(skipped.slice(0, 3))}`);
ok('D13 날이 매번 하루씩 간다(팝업 날·한 줄 날 모두 · 다른 창이 먹은 누름은 뺌)', rows.filter(r => !r.other).every(r => r.d1 === r.d0 + 1), JSON.stringify(rows.filter(r => r.d1 !== r.d0 + 1)));
console.log(`\n${fail === 0 ? '✅' : '❌'} 통과 ${pass} · 실패 ${fail}`);
await page.close(); clearTimeout(wd);
process.exit(fail === 0 ? 0 : 1);
