/* tools/probe_furnclear.mjs — **0원으로 정한 가구(쓰레기봉투)를 «눌러서» 치우면 말이 «치우기»로 나오나** (2026-10-04)
   ------------------------------------------------------------------
   [plan] docs/handoff/plan-zero-won-furniture.md 의 넷: ① 단추 「치우기」 ② 첫 탭 「치울까요?」
   ③ 배너 「…를 치웠습니다」(아랫줄 없음) ④ 로그 「🪑 …를 치웠습니다」(「— 0원」 없음)
   견줌: 값이 있는 가구(협탁)는 예전 말 그대로 — 「팔기」 · 「N원에 팔까요?」 · 「…를 팔았습니다 / N원이 들어왔습니다」
   판: W×H(기본 폰 390×844) · 단추는 진짜 마우스로 누른다 · 가구 고르기는 §furnPicked.select 그대로. ⛔ 값 0. */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8972';
const W = Number(process.env.W || 390), H = Number(process.env.H || 844);
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 300000);
wd.unref && wd.unref();
const page = await launch({ width: W, height: H, dpr: 1 });
await page.goto(`${BASE}/game.html`);
await page.eval('localStorage.clear()', false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 150000, 300);
await sleep(4000);
for (let i = 0; i < 40; i++) {
  const t = await page.eval(`document.getElementById('stage').classList.contains('talking')`);
  if (t !== true) break;
  await page.eval(`(()=>{ const s=document.getElementById('dlgSkip'); if(s) s.click(); const x=document.getElementById('dlgBox'); if(x) x.click(); })()`, false);
  await sleep(250);
}
/* 첫 플레이 울타리는 끈다 — 이 자는 가구 팔기 말만 본다 */
await page.eval(`(()=>{ try { const S=window.__S(); if (S.firstPlay) S.firstPlay.enabled=false; window.__redraw(); } catch(e){} })()`, false);
await sleep(500);
const J = async (e) => JSON.parse(await page.eval(`(()=>{ try { return JSON.stringify((${e})); } catch(e) { return JSON.stringify({ 탈:e.message }); } })()`));
const m = (type, x, y, buttons) => page.send('Input.dispatchMouseEvent', { type, x: Math.round(x), y: Math.round(y), button: 'left', buttons, clickCount: 1 });
const tapEl = async (id) => {
  const r = await J(`(()=>{ const b=document.getElementById(${JSON.stringify(id)}); if(!b) return null; const q=b.getBoundingClientRect(); return q.width>0 ? { x:q.left+q.width/2, y:q.top+q.height/2 } : null; })()`);
  if (!r) return false;
  await m('mouseMoved', r.x, r.y, 0); await m('mousePressed', r.x, r.y, 1); await sleep(60); await m('mouseReleased', r.x, r.y, 0); await sleep(500);
  return true;
};
const pick = (uid) => J(`(()=>{ const f=(window.__rv.furniture()||[]).find(x=>x.uid===${JSON.stringify(uid)});
  if(!f) return 'no'; window.__furn.clear(); window.__furn.select({ ...f, name: f.preset }, ${Math.round(W / 2)}, ${Math.round(H / 2)}); return 'ok'; })()`);
const btn = () => J(`(()=>{ const b=document.getElementById('furnSell'); return b ? { 글:(b.textContent||'').trim(), 보임: getComputedStyle(b).display!=='none' } : null; })()`);
const after = () => J(`({ 배너:((document.getElementById('event')||{}).innerText||'').trim().replace(/\\s*\\n\\s*/g,' / '),
  로그:(window.__S().log||[]).slice(-2).map(x=>typeof x==='string'?x:(x.msg||x.text||JSON.stringify(x))), 돈:(window.__S().tutorial||{}).cashWon })`);

let pass = 0, fail = 0;
const ok = (ko, v, why) => { v ? pass++ : fail++; console.log(`  ${v ? 'OK  ' : 'FAIL'} ${ko}  → ${why}`); };

for (const c of [
  { uid: 'banjiha-trash', ko: '쓰레기봉투(0원으로 정함)', clear: true },
  { uid: 'banjiha-nightstand', ko: '협탁(값 있음 · 견줌)', clear: false }
]) {
  console.log(`\n=== ${c.ko} — ${c.uid} ===`);
  console.log('  고르기 —', await pick(c.uid)); await sleep(500);
  const b0 = await btn(); const cash0 = (await J(`(window.__S().tutorial||{}).cashWon`));
  await tapEl('furnSell'); const b1 = await btn();
  await tapEl('furnSell'); await sleep(600); const a = await after();
  console.log('  단추', JSON.stringify(b0), '→ 첫 탭', JSON.stringify(b1), '· 뒤', JSON.stringify(a));
  if (c.clear) {
    ok('① 단추가 「치우기」', !!b0 && b0.보임 && b0.글 === '치우기', JSON.stringify(b0));
    ok('② 첫 탭이 「치울까요?」(값을 안 말한다)', !!b1 && /치울까요\?$/.test(b1.글) && !/원/.test(b1.글), JSON.stringify(b1));
    ok('③ 배너 「…를 치웠습니다」 한 줄(「0원이 들어왔습니다」 없음)', /치웠습니다$/.test(a.배너) && !/원이 들어왔습니다/.test(a.배너), a.배너);
    ok('④ 로그 「🪑 …를 치웠습니다」(「0원」·「넘겼습니다」 없음)',
       a.로그.some(x => /🪑.*치웠습니다$/.test(x)) && !a.로그.some(x => /0원|넘겼습니다/.test(x)), JSON.stringify(a.로그));
    ok('돈은 그대로', a.돈 === cash0, `${cash0} → ${a.돈}`);
  } else {
    ok('값 있는 가구는 예전 말 — 「팔기」 · 「N원…?」 · 「팔았습니다 / N원이 들어왔습니다」',
       !!b0 && b0.글 === '팔기' && !!b1 && /원/.test(b1.글) && /팔았습니다/.test(a.배너) && /원이 들어왔습니다/.test(a.배너),
       JSON.stringify({ b0: b0 && b0.글, b1: b1 && b1.글, 배너: a.배너 }));
  }
}
console.log(`\n${fail === 0 ? '✅' : '❌'} 통과 ${pass} · 실패 ${fail}`);
await page.close(); clearTimeout(wd);
process.exit(fail === 0 ? 0 : 1);
