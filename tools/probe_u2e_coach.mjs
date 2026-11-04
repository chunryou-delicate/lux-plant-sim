/* U2-e 자(총괄 11-04 · 8aa170ce 끝 걸음 사진 probe_day_walk/moved_boot) — 조작 쪽지(가까이 볼 수 있습니다)가 떠 있는 동안 손가락은 쉰다(§coach ⓑ)
   판: 이사 다음 날 원룸(shop45_g_moved · 8aa170ce 하네스 dump 복사 · 몬스테라 창턱 놓임 · fp.completed · 방 탭 안 봄) · 쪽지 기록 비움(zoomTip 안 봄)
   손: probe_day_walk 와 같은 부팅(세이브 심기 → game.html → __rv → 5초 → 대사 넘김) · 처음부터 프레임마다 재는 기록기(addScriptToEvaluateOnNewDocument)
   단언(390 · 360)
     ㉮ 쪽지 zoomTip 이 떴다(기록기 · 판이 맞는지)
     ㉯ #coach.on 과 #hint.on 이 함께 선 번 = 0 — 클래스가 바뀔 때마다 그 자리에서 보는 기록기(MutationObserver · 한 차례 손이 끝난 뒤 상태 = 그 다음 그림) · 대사 닫힌 순간 상태도 함께
        (rAF 프레임 기록기는 적기만 — 헤드리스에서 틈을 놓칠 수 있다 · a1154216 360 에서 0프레임인데 그 순간 상태는 둘 다 섬)
     ㉰ 쪽지가 걷힌 뒤(10초) 손가락이 다시 선다(무엇을 짚나 적기 · 손가락이 영영 사라지지 않음)
   예외 0 · J 단언엔 !탈 · 빨강 먼저: a1154216(고치기 전) */
import fs from 'node:fs';
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9451', OUT = process.env.OUT || null;
const SAVE_T = process.env.SAVE || 'C:/Users/pc/byeot-core-keep/u2e/moved_8aa170ce.json';
if (OUT) fs.mkdirSync(OUT, { recursive: true });
let bad = 0; const ok = (c, m, d = '') => { console.log(`${c ? '  OK' : 'FAIL'}  ${m}${d ? '  → ' + d : ''}`); if (!c) bad++; };
if (!fs.existsSync(SAVE_T)) { ok(false, '세이브 없음', SAVE_T); process.exit(1); }
const exc = [];
const REC = `window.__byeotSkipDayAnim=true;
(() => { const R = window.__u2e = { frames: 0, both: 0, bothMs: 0, firstBoth: null, coachSeen: [], hintWhileCoach: [], t0: 0 };
  let last = 0;
  const tick = (t) => { requestAnimationFrame(tick);
    const c = document.getElementById('coach'), h = document.getElementById('hint');
    if (!c || !h) { last = t; return; }
    R.frames++;
    const cOn = c.classList.contains('on'), hOn = h.classList.contains('on');
    if (cOn) { const ti = (document.getElementById('coachTitle') || {}).textContent || ''; if (!R.coachSeen.includes(ti)) R.coachSeen.push(ti); }
    if (cOn && hOn) { R.both++; R.bothMs += last ? Math.min(100, t - last) : 0;
      const tg = document.querySelector('.hintTarget'); const s = ((h.querySelector('.say') || {}).textContent || '').trim();
      const k = ((tg && (tg.id || tg.getAttribute('data-place'))) || '?') + ' «' + s + '»' + (h.classList.contains('mute') ? ' (mute)' : '');
      if (!R.hintWhileCoach.includes(k)) R.hintWhileCoach.push(k);
      if (R.firstBoth == null) R.firstBoth = Math.round(t); }
    last = t; };
  requestAnimationFrame(tick);
  const M = R.mo = { both: 0, bothMs: 0, cur: null, keys: [] };
  const check = () => { const c = document.getElementById('coach'), h = document.getElementById('hint'); if (!c || !h) return;
    const b = c.classList.contains('on') && h.classList.contains('on'), now = performance.now();
    if (b && M.cur == null) { M.cur = now; M.both++;
      const tg = document.querySelector('.hintTarget'); const s = ((h.querySelector('.say') || {}).textContent || '').trim();
      const k = ((tg && (tg.id || tg.getAttribute('data-place'))) || '?') + ' «' + s + '»'; if (!M.keys.includes(k)) M.keys.push(k); }
    else if (!b && M.cur != null) { M.bothMs += now - M.cur; M.cur = null; } };
  const start = () => { const c = document.getElementById('coach'), h = document.getElementById('hint'); if (!c || !h) { setTimeout(start, 50); return; }
    const mo = new MutationObserver(check); mo.observe(c, { attributes: true, attributeFilter: ['class'] }); mo.observe(h, { attributes: true, attributeFilter: ['class'] }); check(); };
  start(); })();`;
let page = null;
const fresh = async (w) => { if (page) { try { await page.close(); } catch (e) { console.log('  (탭 닫기 탈)', e.message); } }
  page = await launch({ width: w, height: w === 360 ? 780 : 844, dpr: 2 });
  page.on((method, p) => { if (method === 'Runtime.exceptionThrown') exc.push(((p.exceptionDetails.exception && p.exceptionDetails.exception.description) || p.exceptionDetails.text || '').split('\n')[0].slice(0, 200)); });
  await page.send('Runtime.enable');
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: REC }); };
const J = async (js) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, 120000));
const H = `(()=>{ const h=document.getElementById('hint'), t=document.querySelector('.hintTarget'), c=document.getElementById('coach');
  return { coach: c.classList.contains('on') ? (document.getElementById('coachTitle')||{}).textContent : null, now: window.__byeotCoach && window.__byeotCoach.now(),
           hint: h.classList.contains('on') ? ((t && (t.id || t.getAttribute('data-place'))) || '?') + ' «' + ((h.querySelector('.say')||{}).textContent||'').trim() + '»' : null,
           talking: document.getElementById('stage').classList.contains('talking'), seen: window.__byeotCoach && window.__byeotCoach.seen() }; })()`;
for (const W of [390, 360]) {
  await fresh(W);
  await page.goto(`${BASE}/data/balance/homes.json`);
  await page.eval(`(()=>{ localStorage.clear(); localStorage.setItem('byeot/save/1', ${JSON.stringify(fs.readFileSync(SAVE_T, 'utf8'))}); return 1; })()`, false);
  await page.goto(`${BASE}/game.html`); await page.waitFor('!!window.__rv', 600000, 500); await sleep(5000);
  let n = 0; for (; n < 80; n++) { const t = await J(`document.getElementById('stage').classList.contains('talking')`); if (t !== true) break; await page.eval(`(()=>{ const b=document.getElementById('dlgBox'); if(b) b.click(); return 1; })()`, false); await sleep(160); }
  const h0 = await J(H);
  if (OUT) await page.shot(`${OUT}/${W}_u2e_boot.png`);
  await sleep(1500);
  const h1 = await J(H);
  if (OUT) await page.shot(`${OUT}/${W}_u2e_1500.png`);
  /* 쪽지(10초)가 걷힐 때까지 · 그 뒤 1.5초 */
  for (let i = 0; i < 30; i++) { const c = await J(`document.getElementById('coach').classList.contains('on')`); if (c !== true) break; await sleep(500); }
  await sleep(1500);
  const h2 = await J(H);
  if (OUT) await page.shot(`${OUT}/${W}_u2e_after.png`);
  const R = await J(`(()=>{ const R = window.__u2e; const M = R.mo; return Object.assign({}, R, { mo: { both: M.both, bothMs: Math.round(M.bothMs + (M.cur != null ? performance.now() - M.cur : 0)), open: M.cur != null, keys: M.keys } }); })()`);
  console.log(`  ${W} 대사 ${n}번 넘김`);
  console.log(`  ${W} 대사 닫힌 순간`, JSON.stringify(h0));
  console.log(`  ${W} 1.5초 뒤`, JSON.stringify(h1));
  console.log(`  ${W} 쪽지 걷힌 뒤`, JSON.stringify(h2));
  console.log(`  ${W} 기록기`, JSON.stringify(R));
  ok(!R.탈 && Array.isArray(R.coachSeen) && R.coachSeen.includes('가까이 볼 수 있습니다'), `㉮ ${W} 쪽지 «가까이 볼 수 있습니다»가 떴다(판이 맞음)`, JSON.stringify(R.coachSeen));
  const snapBoth = !!(h0.coach && h0.hint);
  console.log(`  ${W} 프레임 기록기(적기만) ${R.both}프레임 · ${Math.round(R.bothMs || 0)}ms`, JSON.stringify(R.hintWhileCoach));
  ok(!R.탈 && R.mo && R.mo.both === 0 && !snapBoth, `㉯ ${W} 쪽지와 손가락이 함께 선 번 0(클래스 기록기 ${R.mo ? R.mo.both : '?'}번 · ${R.mo ? R.mo.bothMs : '?'}ms · 대사 닫힌 순간 ${snapBoth ? '둘 다' : '하나 이하'})`, JSON.stringify({ mo: R.mo, h0 }));
  ok(!h2.탈 && !h2.coach && !!h2.hint, `㉰ ${W} 쪽지가 걷힌 뒤 손가락이 다시 선다(${h2.hint})`, JSON.stringify(h2));
}
ok(exc.length === 0, '처리 안 된 예외 0', exc.slice(0, 3).join(' / '));
try { await page.close(); } catch (e) { console.log('  (탭 닫기 탈)', e.message); }
console.log(bad ? `probe_u2e_coach: 빨강 ${bad}` : 'probe_u2e_coach: 다 통과');
process.exit(bad ? 1 : 0);
