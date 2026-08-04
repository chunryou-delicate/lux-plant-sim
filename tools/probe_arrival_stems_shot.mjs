/* 진행도별 모습을 눈으로 본다 — "줄기 1개"의 정의를 화면으로 확인하려고.
   쓰기: node tools/probe_arrival_stems_shot.mjs [일수,일수,...]  */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8971';
const DAYS = (process.argv[2] || '20,30,38,45,51,58,62,75,100,143').split(',').map(Number);
const OUT = process.env.BYEOT_SHOT_DIR || 'docs/engine/shots/arrival';

const page = await launch({ width: 900, height: 760, dpr: 1 });
await page.goto(`${BASE}/plant_grow.html`);
await page.waitFor(`typeof setGrowth === 'function' && typeof topologyNow === 'function'`, 120000, 300);
await sleep(6000);   // GLB 로딩
/* 튜닝 패널이 3D 를 가린다 — 눈으로 형태를 보려는 것이므로 치운다 */
await page.eval(`(()=>{ const p=document.getElementById('panel'); if(p) p.style.display='none'; })()`, false);

for (const d of DAYS) {
  const info = await page.eval(`(()=>{ matResetAll&&matResetAll(); setGrowth(${d});
    const g=ageOf(${d}), ax=topologyNow(g).filter(a=>a.birth<=g), ls=leafStats(), ph=growthPhase();
    return { d:${d}, 축:ax.length, 잎:ls.leaves, 단계:ph.phaseKo }; })()`);
  await sleep(1400);
  const f = await page.shot(`${OUT}/g${String(d).padStart(3, '0')}.png`);
  console.log(JSON.stringify(info), '→', f);
}
await page.close();
