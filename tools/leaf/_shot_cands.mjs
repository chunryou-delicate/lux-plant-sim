/* tools/leaf/_shot_cands.mjs — 원룸 「기준 배치 후보」를 «같은 시점»으로 찍는다 (2026-09-06 · leaf)
   ⛔ data/house_rooms.json 은 안 건드린다. [house] 가 낸 임시 json 으로 fetch 만 돌린다. */
import { launch, sleep } from '../test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const OUT  = process.argv[2] || '.';
const W    = Number(process.argv[3] || 390);
const CANDS = (process.argv[4] || 'A,B,C').split(',');

const HIDE = `(()=>{ const cv=document.querySelector('canvas'); if(!cv) return 'no-canvas';
  const keep=new Set(); for(let e=cv;e;e=e.parentElement) keep.add(e);
  document.querySelectorAll('body *').forEach(e=>{ if(!keep.has(e)) e.style.visibility='hidden'; });
  cv.style.visibility='visible'; return 'ok'; })()`;

for (const c of CANDS) {
  const src = `./assets/derived/_tmp_rooms_${c}.json`;
  const page = await launch({ width: W, height: Math.round(W * 844 / 390), dpr: 2, mobile: false });
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source:
    `(()=>{ const of=window.fetch; window.fetch=(u,o)=>of(String(u).includes('house_rooms.json')?'${src}':u,o); })()` });
  await page.goto(`${BASE}/game.html`); await page.eval(`localStorage.clear()`, false);
  await page.goto(`${BASE}/game.html`);
  await page.waitFor('window.__byeotBooted === true', 180000, 300); await sleep(6500);
  for (let i = 0; i < 30; i++) {
    const b = await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`);
    if (!b) break;
    await page.eval(`(()=>{const g=document.getElementById('guideClose'); if(g&&g.offsetParent){g.click();return;} const b=document.getElementById('dlgBox'); if(b)b.click();})()`, false);
    await sleep(250);
  }
  await page.eval(`window.__rv.setRoom('oneroom')`, false); await sleep(5200);
  await page.eval(HIDE); await sleep(500);
  await page.shot(`${OUT}/cand_${c}_${W}.png`);
  console.log(`  ${c} · 폭 ${W} 찍음`);
  await page.close();
}
