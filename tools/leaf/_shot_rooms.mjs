/* tools/leaf/_shot_rooms.mjs — 방 셋을 «같은 각»으로 찍는다 (2026-08-30 · leaf)

   ① 반지하(지금)  ② 원룸 «비우기 전»(가구 13)  ③ 원룸 «지금»(창턱만)

   ★ ②는 «지어낸 것이 아니다» — 깃 `dc0a30d` 의 실제 데이터다.
   ⛔ `data/house_rooms.json` 은 «한 글자도» 안 건드린다 — 창 여럿이 같은 트리를 쓴다.

   ⚠⚠ 1판이 못 쓰는 판이었다 — 화면이 «다 뜬 뒤에» fetch 를 갈아 끼웠다.
     방 정의는 그전에 이미 메모리에 실려서, ②와 ③이 «똑같이 빈 방»으로 찍혔다.
     ⇒ ★ `Page.addScriptToEvaluateOnNewDocument` 로 **문서가 실리기 «전»에** 끼운다.
*/
import { launch, sleep } from '../test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const OUT  = process.argv[2] || '.';
const BEFORE = './assets/derived/_tmp_rooms_before.json';

const PATCH = `(()=>{ const of=window.fetch;
  window.fetch=(u,o)=>of(String(u).includes('house_rooms.json') ? '${BEFORE}' : u, o); })()`;

/* 캔버스 말고 다 감춘다 — 「stage 안의 것만」으로는 남는 것이 있었다(안내 말풍선·음악 단추) */
const HIDE = `(()=>{
  const cv=document.querySelector('canvas'); if(!cv) return 'no-canvas';
  const keep=new Set(); for(let e=cv;e;e=e.parentElement) keep.add(e);
  document.querySelectorAll('body *').forEach(e=>{ if(!keep.has(e)) e.style.visibility='hidden'; });
  cv.style.visibility='visible'; return 'ok';
})()`;

async function shoot(patchBefore, steps, out) {
  const page = await launch({ width: 390, height: 844, dpr: 2, mobile: false });
  if (patchBefore) await page.send('Page.addScriptToEvaluateOnNewDocument', { source: PATCH });
  await page.goto(`${BASE}/game.html`); await page.eval(`localStorage.clear()`, false);
  await page.goto(`${BASE}/game.html`);
  await page.waitFor('window.__byeotBooted === true', 180000, 300); await sleep(6500);
  for (let i = 0; i < 30; i++) {
    const b = await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`);
    if (!b) break;
    await page.eval(`(()=>{const g=document.getElementById('guideClose'); if(g&&g.offsetParent){g.click();return;} const b=document.getElementById('dlgBox'); if(b)b.click();})()`, false);
    await sleep(250);
  }
  for (const s of steps) { await page.eval(s, false); await sleep(5000); }
  console.log('    감추기:', await page.eval(HIDE));
  await sleep(600);
  await page.shot(out);
  /* ★ 무엇을 그렸는지 «화면에게 물어» 적는다 — 그림만 보고 「맞겠지」 하지 않는다 */
  const who = await page.eval(`(()=>{const b=window.__built||null; const S=window.__S&&window.__S();
    return JSON.stringify({room:(S&&S.room)||null, slots:(window.__rv&&window.__rv.slotIds&&window.__rv.slotIds().length)||null});})()`);
  console.log('    화면이 말한 것:', who);
  await page.close();
}
await shoot(false, [], `${OUT}/room_banjiha.png`);                          console.log('  ① 반지하');
await shoot(false, [`window.__rv.setRoom('oneroom')`], `${OUT}/room_oneroom_now.png`);   console.log('  ③ 원룸 지금');
await shoot(true,  [`window.__rv.setRoom('oneroom')`], `${OUT}/room_oneroom_before.png`);console.log('  ② 원룸 비우기 전');
