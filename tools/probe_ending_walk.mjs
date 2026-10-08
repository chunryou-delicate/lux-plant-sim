/* tools/probe_ending_walk.mjs — **④ 내 집 마련 뼈대를 화면에서 끝까지 걷는다** (2026-10-08 · 총괄 07:20 ③ · [plan] plan-ending-home ③-4)
   ------------------------------------------------------------------
   재는 것:
     ① 목표가 없으면(깃발 없음) 이사 뒤에도 내 집 줄·단추가 «안 뜬다»
     ② ?endingTarget=N — 이사 뒤 할 일 머리에 「내 집 마련까지 …」 줄 · 모자라면 단추가 잠김
     ③ 현금이 닿은 날 대사 차례 — (같은 턴이면) 퀘스트 끝 줄 뒤에 endingReady 한 줄 · 그날 장면은 안 열린다(닿음 ≠ 끝냄)
     ④ 단추 → 되묻기(「계약금 …원을 냅니다. 되돌릴 수 없습니다.」) → [계약한다] → 덮개 + endingHome 열세 줄 · 그동안 [다음 날]·알약·손가락 숨김
     ⑤ 대사가 끝나면 마무리 카드(반지하에서 {d}일 …) → [다음] → 덮개 닫힘 · 다음 장 표지 job_select · 계약금이 빠졌다
   ⚠ 판은 지름길로 세운다(선물 그루 · 이사 조건을 상태로 채움) — 배선만 본다. 날짜·살림은 probe_oneroom_econ 몫.
   판: 폰 390×844. ⛔ 값 0(목표는 깃발로만 · 세이브에 안 남는다). */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:9300';
const TARGET = Number(process.env.TARGET || 3000000);
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 600000);
wd.unref && wd.unref();
let fail = 0;
const ok = (c, msg, got) => { console.log(`  ${c ? 'OK  ' : 'FAIL'} ${msg}${got !== undefined ? ' → ' + JSON.stringify(got) : ''}`); if (!c) fail++; };
async function boot(q) {
  const page = await launch({ width: 390, height: 844, dpr: 1 });
  await page.goto(`${BASE}/game.html${q}`);
  await page.eval('localStorage.clear()', false);
  await page.goto(`${BASE}/game.html${q}`);
  await page.waitFor('!!window.__rv', 240000, 500);
  await sleep(3500);
  return page;
}
const mk = (page) => {
  const J = async (e) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${e})); } catch(e) { return JSON.stringify({ 탈:e.message }); } })()`, true, 60000));
  const clearDlg = async (max = 80) => { const seen = []; for (let i = 0; i < max; i++) { const t = await page.eval(`document.getElementById('stage').classList.contains('talking')`); if (t !== true) return seen;
    seen.push(await page.eval(`(()=>{ const b=document.getElementById('dlgBox'); return b ? (b.textContent||'').replace(/\\s+/g,' ').trim().slice(0,40) : ''; })()`));
    await page.eval(`(()=>{ const x=document.getElementById('dlgBox'); if (x) x.click(); })()`, false); await sleep(140); } return seen; };
  /* 지름길 — 선물 그루 · 이사 조건(돈 · 무늬 삽수를 판 적)을 상태로 채우고 화면의 [원룸으로 이사] 를 누른다 */
  const m = (type, x, y, buttons) => page.send('Input.dispatchMouseEvent', { type, x: Math.round(x), y: Math.round(y), button: 'left', buttons, clickCount: 1 });
  const tapAt = async (x, y) => { await m('mouseMoved', x, y, 0); await m('mousePressed', x, y, 1); await sleep(80); await m('mouseReleased', x, y, 0); await sleep(700); };
  const moveIn = async () => {
    await clearDlg();
    /* 첫날 [다음 날] 문지기는 «방에 선 시루»를 본다 — 손가락대로 시루를 놓는다(probe_walk_trap ① 과 같은 걸음) */
    for (let i = 0; i < 8; i++) {
      const placed = await J(`(()=>{ try { return window.__S().firstPlay.beansprout.pots.some(p=>p && (p.slotId || p.at)); } catch(e) { return false; } })()`);
      const say = await J(`(()=>{ const h=document.getElementById('hint'); return h ? ((h.querySelector('.say')||{}).textContent||'').trim() : ''; })()`);
      if (placed && !/둘까요/.test(say)) break;
      const at = await J(`(()=>{ const t=document.querySelector('.hintTarget'); if(!t) return null; const r=t.getBoundingClientRect(); return r.width>0 ? { x:r.left+r.width/2, y:r.top+r.height/2 } : null; })()`);
      if (!at) break; await tapAt(at.x, at.y); await clearDlg();
    }
    const r = await J(`(async()=>{ const st=await import('/src/game/state.js'); const S=window.__S();
      if(!(S.pots||[]).length) st.givePlant(S, window.__io, { slotId:'banjiha-sill:0' });
      S.firstPlay.monstera.arrived = true;
      const ts=S.tutorial; ts.cashWon = Math.max(ts.cashWon, (ts.rules.moveOutCostWon||2000000) + 100000);
      ts.varieSale = { ...(ts.varieSale||{}), count: Math.max(1, (ts.varieSale&&ts.varieSale.count)||0) };
      window.__redraw(); const b=document.getElementById('moveOut'); if (b) { b.disabled=false; b.click(); }
      return { room:S.home.room, movedOut: ts.movedOut, cash: ts.cashWon }; })()`);
    await sleep(2500); await clearDlg();
    return r;
  };
  const goal = () => J(`(()=>{ window.__redraw(); const g=document.getElementById('questGoalTab'); const m=document.getElementById('monthGoal');
    const b=document.querySelector('#questGoalTab [data-act="homeAsk"]');
    return { shown: !!(g && g.style.display !== 'none'), text: g ? (g.textContent||'').replace(/\\s+/g,' ').trim() : null,
             btn: b ? { text:(b.textContent||'').trim(), disabled: b.disabled } : null,
             month: m ? { shown: m.style.display !== 'none', text:(m.textContent||'').replace(/\\s+/g,' ').trim() } : null }; })()`);
  return { J, clearDlg, moveIn, goal, tapAt };
};

/* ① 깃발 없음 — 목표 미정이면 안 뜬다 */
{
  console.log('■ ① 목표 없음(지금 게임 그대로)');
  const page = await boot('');
  const { moveIn, goal } = mk(page);
  const mv = await moveIn();
  const g = await goal();
  ok(mv.movedOut === true, '이사했다(지름길)', mv);
  ok(!g.btn && !(g.shown && /내 집/.test(g.text || '')), '목표가 없으면 내 집 줄·단추가 안 뜬다', g);
  await page.close();
}
/* ②~⑤ 깃발 있음 */
{
  console.log(`■ ②~⑤ ?endingTarget=${TARGET}`);
  const page = await boot(`?endingTarget=${TARGET}`);
  const { J, clearDlg, moveIn, goal, tapAt } = mk(page);
  const mv = await moveIn();
  ok(mv.movedOut === true, '이사했다(지름길)', mv);
  await J(`(()=>{ const ts=window.__S().tutorial; ts.cashWon = ${Math.round(TARGET / 2)}; return 1; })()`);
  const g1 = await goal();
  ok(/내 집 마련까지/.test(g1.text || '') && g1.btn && g1.btn.disabled === true, '② 모자라면 「내 집 마련까지 …」 · 단추 잠김', g1);
  /* ③ 닿게 한 뒤 하루를 넘긴다(돈이 바뀌는 자리 = checkQuests 가 불리는 자리) */
  const dl0 = await J(`(window.__dlgLog||[]).length`);
  await J(`(()=>{ const ts=window.__S().tutorial; ts.cashWon = ${TARGET + 500000}; return 1; })()`);
  /* 원룸에서는 짐(그루·시루)이 가방에 있다 — 짐 풀기는 끌어 놓기라 이 자는 «상태로» 푼다(모주 창턱 · 시루 하나). 배선만 본다 */
  console.log('    짐 풀기 —', JSON.stringify(await J(`(async()=>{ const st=await import('/src/game/state.js'); const fpm=await import('/src/game/first_play.js');
    const S=window.__S(); const slots=window.__io.light.room.slots; const r={};
    try { st.setPotSlot(S, S.pots[0], 'oneroom-sill:0', slots); r.pot='oneroom-sill:0'; } catch(e) { r.pot=e.message.slice(0,60); }
    try { fpm.placeBeansprout(S.firstPlay, 'oneroom-sill:1', { slots }); r.siru='oneroom-sill:1'; } catch(e) { r.siru=e.message.slice(0,60); }
    try { window.__redraw(); } catch(e) {} return r; })()`)));
  console.log('    [다음 날] —', JSON.stringify(await J(`(()=>{ const n=document.getElementById('next'); const e=document.getElementById('errBox');
    return { disabled:n.disabled, text:(n.textContent||'').trim(), title:n.title||null, vis:getComputedStyle(n).visibility, pops:[...document.querySelectorAll('.pop.on')].map(x=>x.id),
             err: e ? (e.textContent||'').trim().slice(0,120) : null, talking: document.getElementById('stage').classList.contains('talking'), cls: document.documentElement.className.slice(0,80) }; })()`)));
  const day0 = await J(`window.__S().day`);
  for (let k = 0; k < 6; k++) {
    await J(`(()=>{ const p=document.querySelector('.pop.on'); const g=p ? [...p.querySelectorAll('button.go,button.primary')].find(x=>!x.disabled) : null; if (g) { g.click(); return 'pop'; }
      const n=document.getElementById('next'); if (n && !n.disabled) n.click(); return 1; })()`);
    await sleep(1500);
    if ((await J(`window.__S().day`)) !== day0) break;
  }
  await sleep(1500);
  console.log('    하루 —', day0, '→', await J(`window.__S().day`), '· 오류 —', await J(`(document.getElementById('errBox')||{}).textContent || ''`),
              '· 시루 —', JSON.stringify(await J(`(async()=>{ const fpm=await import('/src/game/first_play.js'); const S=window.__S(); return (fpm.cropPotList(S.firstPlay,S.day)||[]).map(r=>({placed:r.placed, slot:r.slotId||null})); })()`)));
  const said = await J(`(window.__dlgLog||[]).slice(${dl0}).map(x=>x.id)`);
  await clearDlg();
  const iR = said.indexOf('endingReady'), iQ = said.findIndex(id => /^questDone/.test(id));
  ok(iR >= 0, '③ 닿은 날 endingReady 한 줄', said);
  ok(iQ < 0 || iQ < iR, '③ 같은 턴의 퀘스트 끝 줄이 먼저다(있으면)', { questDone: iQ, endingReady: iR });
  const scene0 = await J(`document.getElementById('homeScene').classList.contains('on')`);
  ok(scene0 === false, '③ 닿은 날 장면은 안 열린다(닿음 ≠ 끝냄)', scene0);
  const g2 = await goal();
  ok(g2.btn && g2.btn.disabled === false && /내 집 마련하기/.test(g2.btn.text), '③ 단추 「내 집 마련하기」가 열린다', g2);
  /* ④ 단추 → 되묻기 → [계약한다] */
  await J(`(()=>{ const b=document.querySelector('#questGoalTab [data-act="homeAsk"]'); if (b) b.click(); return 1; })()`);
  await sleep(500);
  const ask = await J(`(()=>{ const p=document.getElementById('homePanel'); return { on:p.classList.contains('on'), text:(document.getElementById('homeAsk').textContent||'') }; })()`);
  ok(ask.on && /되돌릴 수 없습니다/.test(ask.text) && /계약금/.test(ask.text), '④ 되묻기 창', ask);
  const cashBefore = await J(`window.__S().tutorial.cashWon`);
  const dl1 = await J(`(window.__dlgLog||[]).length`);
  await J(`(()=>{ document.getElementById('homeGo').click(); return 1; })()`);
  await sleep(1800);
  const during = await J(`(()=>{ const vis = id => { const e=document.getElementById(id); return e ? getComputedStyle(e).visibility : null; };
    return { scene: document.getElementById('homeScene').classList.contains('on'), talking: document.getElementById('stage').classList.contains('talking'),
             next: vis('next'), hint: vis('hint'), chip: vis('questChip'), card: document.getElementById('homeCard').style.display }; })()`);
  ok(during.scene && during.talking && during.next === 'hidden' && during.hint === 'hidden' && during.card === 'none', '④ 덮개 + 대사 · [다음 날]·손가락 숨김 · 카드는 아직', during);
  const lines = await clearDlg(60);
  const said2 = await J(`(window.__dlgLog||[]).slice(${dl1}).map(x=>x.id)`);
  ok(said2.includes('endingHome'), '④ endingHome 대사', said2);
  ok(lines.length >= 13, `④ 열세 줄을 넘겼다(${lines.length}줄) · 첫 줄 「${lines[0]}」 · 끝 줄 「${lines[lines.length - 1]}」`);
  await sleep(500);
  const card = await J(`(()=>({ shown: document.getElementById('homeCard').style.display !== 'none', rows: (document.getElementById('homeCardRows').textContent||'').replace(/\\s+/g,' ').trim() }))()`);
  ok(card.shown && /반지하에서 \d+일/.test(card.rows), '⑤ 마무리 카드(수는 상태에서)', card);
  const cashAfter = await J(`window.__S().tutorial.cashWon`);
  ok(cashBefore - cashAfter === TARGET, `⑤ 계약금이 빠졌다(${cashBefore} → ${cashAfter})`);
  await J(`(()=>{ document.getElementById('homeNext').click(); return 1; })()`);
  await sleep(600);
  const end = await J(`(()=>({ scene: document.getElementById('homeScene').classList.contains('on'), cls: document.documentElement.classList.contains('homescene'),
    next: window.__byeotNextChapter || null, goal: (document.getElementById('questGoalTab')||{}).textContent || null }))()`);
  ok(!end.scene && !end.cls && end.next === 'job_select', '⑤ [다음] → 덮개 닫힘 · 다음 장 job_select', end);
  if (process.env.SHOT) { await page.shot(process.env.SHOT); }
  await page.close();
}
clearTimeout(wd);
console.log(fail ? `\nprobe_ending_walk: FAIL ${fail}` : '\nprobe_ending_walk: PASS');
process.exit(fail ? 1 : 0);
