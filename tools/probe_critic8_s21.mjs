/* 비판 8판 §13 ㉨ S21 자(core 11-03 · 총괄 «고치기 전 판에서 두 번 서는지 먼저 본다 — 안 서면 닫는다»)
   의심: 이정표 careMilestone30 과 할 일 끝 questDoneCareTown 은 두 줄이 글자까지 같다. 짝 거름(dialogue §scriptsForEvents)은 한 묶음 안에서만 본다.
         [돌려준다] 손(§returnCareNow)은 돌려줌 사건(이정표 포함)과 할 일(§checkQuests)을 따로 연다 → 같은 두 줄이 잇달아 두 번 설 수 있다.
   판: 하네스 careR · 씨앗 g · d720(살린 29 · 이튿날 cr_029 가 낫는다) — byeot-core-keep/critic8/careR_g_d720.json(프로필 안 건드림 · 값 손질 없음)
   걸음(사람 손만): 싣고 켬 → [다음 날] → 아침 대사 → [상점] 맡김판에서 나은 줄 [돌려준다] → 대사
   단언
     ㉠ 실은 판 상태(살린 29 · 이정표 30 · 할 일 끝 · 두 줄 모두 아직 안 섬 — 총괄 11-03)
     ㉮ 그날 «동네에서 식물이 아프면 여기래.»가 정확히 한 번 선다(== 1 · 0 이면 «안 섬» 빨강)
     ㉯ 살린 화분이 30 이 됐다(돌려준 손이 닿음)
     예외 0 · J 단언엔 !탈 */
import fs from 'node:fs';
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9451', OUT = process.env.OUT || null;
const SAVE = process.env.SAVE || 'C:/Users/pc/byeot-core-keep/critic8/careR_g_d720.json';
if (OUT) fs.mkdirSync(OUT, { recursive: true });
let bad = 0; const ok = (c, m, d = '') => { console.log(`${c ? '  OK' : 'FAIL'}  ${m}${d ? '  → ' + d : ''}`); if (!c) bad++; };
if (!fs.existsSync(SAVE)) { ok(false, '세이브 없음', SAVE); process.exit(1); }
const exc = [];
const page = await launch({ width: 390, height: 844, dpr: 2 });
page.on((method, p) => { if (method === 'Runtime.exceptionThrown') exc.push(((p.exceptionDetails.exception && p.exceptionDetails.exception.description) || p.exceptionDetails.text || '').split('\n')[0].slice(0, 200)); });
await page.send('Runtime.enable');
await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true;` });
const J = async (js) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, 120000));
const talk = async (max = 120) => {
  const lines = [];
  for (let i = 0; i < max; i++) {
    const t = await J(`(()=>({ on: document.getElementById('stage').classList.contains('talking'), text: ((document.getElementById('dlgText') || {}).textContent || '').trim() }))()`);
    if (t.탈) { lines.push('탈:' + t.탈); break; }
    if (!t.on) { await sleep(700); const t2 = await J(`document.getElementById('stage').classList.contains('talking')`); if (t2 !== true) break; continue; }
    if (t.text && lines[lines.length - 1] !== t.text) lines.push(t.text);
    await page.eval(`(()=>{ const x=document.getElementById('dlgBox'); if (x) x.click(); })()`, false); await sleep(220);
  }
  return lines;
};
const bannerOff = async () => { for (let i = 0; i < 20; i++) { const on = await J(`document.getElementById('event').classList.contains('on')`); if (on !== true) return; await J(`(()=>{ document.getElementById('event').click(); return 1; })()`); await sleep(400); } };
const digest = `(()=>{ const S=window.__S(); const C=S.jobCare||{}; return { day:S.day, saved:C.saved ?? null, ms: C.milestones || null,
  req:(C.requests||[]).map(r=>r.id+':'+r.problem+(r.savedOn!=null?'+':'')).join(','), done: ((S.stamina&&S.stamina.questsTaken)||[]).includes('care_town') }; })()`;
await page.goto(`${BASE}/data/balance/homes.json`);
await page.eval(`(()=>{ localStorage.clear(); localStorage.setItem('byeot/save/1', ${JSON.stringify(fs.readFileSync(SAVE, 'utf8'))}); localStorage.setItem('byeot.guideSeen','1'); return 1; })()`, false);
await page.goto(`${BASE}/game.html`); await page.waitFor('window.__byeotBooted === true', 300000, 500); await page.waitFor('!!window.__rv', 240000, 500); await sleep(4000);
const l0 = await talk(); await bannerOff();
const d0 = await J(digest); console.log('  실음', JSON.stringify(d0), '대사', JSON.stringify(l0));
const TOWN = '동네에서 식물이 아프면 여기래.';
/* 총괄 11-03 — 덤프 «d720»은 그날 하네스 손이 들어간 판일 수 있다 · 싣자마자 판 상태부터 */
ok(!d0.탈 && d0.saved === 29 && d0.ms && d0.ms['30'] == null && d0.done === false && !l0.includes(TOWN),
   '㉠ 실은 판: 살린 29 · 이정표 30 안 남 · 할 일 «동네 식물 의사» 안 끝남 · 그 두 줄 아직 안 섬', JSON.stringify({ d0, l0 }));
/* [다음 날] — 사람 손(누름 · 밥상 [확인]) */
await page.eval(`(()=>{ const b=document.getElementById('next'); b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})); b.click(); return 1; })()`, false);
await sleep(1500); await page.eval(`(()=>{ const g=document.getElementById('mealGo'); if (g && g.offsetParent) g.click(); return 1; })()`, false);
await sleep(4000);
const l1 = await talk(); await bannerOff(); await sleep(800);
const d1 = await J(digest); console.log('  다음 날', JSON.stringify(d1), '대사', JSON.stringify(l1));
/* 맡김판 — 나은 줄 [돌려준다] */
await page.eval(`(()=>{ window.__byeotSheet.open('shop'); return 1; })()`, false); await sleep(1200);
const rows = await J(`[...document.querySelectorAll('#orderBoard [data-careret]')].map(b=>({ id: b.dataset.careret, on: !b.disabled }))`);
console.log('  맡김판', JSON.stringify(rows));
const pick = (Array.isArray(rows) ? rows : []).find(r => r.on);
if (pick) await page.eval(`(()=>{ const b=document.querySelector('#orderBoard [data-careret="${pick.id}"]'); if (b) b.click(); return 1; })()`, false);
await sleep(2500);
const l2 = await talk(); await bannerOff(); await sleep(1000);
const l3 = await talk();
const d2 = await J(digest); console.log('  돌려준 뒤', JSON.stringify(d2), '대사', JSON.stringify([...l2, ...l3]));
if (OUT) await page.shot(`${OUT}/390_c8s21_after.png`);
const all = [...l1, ...l2, ...l3];
const n = all.filter(t => t === TOWN).length;
ok(!d2.탈 && d2.saved === 30 && !!pick, '㉯ [돌려준다]로 살린 화분 30', JSON.stringify({ pick, d2 }));
ok(n === 1, `㉮ 그날 «동네에서 식물이 아프면 여기래.» 정확히 한 번(센 수 ${n} · 0 이면 «안 섬» 빨강)`, JSON.stringify(all));
ok(exc.length === 0, '처리 안 된 예외 0', exc.slice(0, 3).join(' / '));
try { await page.close(); } catch (e) { console.log('  (탭 닫기 탈)', e.message); }
console.log(bad ? `FAIL ${bad}` : 'ALL OK');
process.exit(bad ? 1 : 0);
