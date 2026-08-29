/* tools/probe_rebuild_split.mjs — **31초는 «어디서» 나나** (원룸 이사 ④의 뒤끝)
   ------------------------------------------------------------------
   [House] 가 갈라 재기를: 가구 하나 놓는 31,088 ms 중 «조도 몫» 5.74 ms(0.02%).
   ⇒ 그러면 나머지 31초는 «화면» 몫이다. 그 화면 몫을 더 갈라 본다.
   재는 것: ① 새 창구(`__rv.refreshFurniture`)가 «있나»
            ② 그 창구 하나가 «몇 ms» 인가 — 가구를 안 바꾸고 그냥 다시 짓기만 해도
            ③ 견줄 것: 이미 «가볍다»고 알려진 `commitFurnitureAt`(제자리로 옮기기)
   ⚠ ②③ 은 «같은 방·같은 가구 수»에서 잰다 — 하나만 다르게(견줌의 계율).
   ⛔ 값은 안 바꾼다. */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8972';
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 300000);
wd.unref && wd.unref();
const page = await launch({ width: 390, height: 844, dpr: 1 });
await page.goto(`${BASE}/game.html`);
await page.eval('localStorage.clear()', false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 150000, 300);
await sleep(5000);
console.log('■ 판 —', await page.eval(`(()=>{ const S=window.__S();
  return JSON.stringify({ 방:S.home.room,
    가구:(window.__io.light.room.def.furniture||[]).length,
    자리:(window.__io.light.room.slots||[]).length,
    화분:(S.pots||[]).length }); })()`));
console.log('');
console.log('=== ① 새 창구가 있나 ===');
console.log(' ', await page.eval(`JSON.stringify({
  refreshFurniture: typeof window.__rv.refreshFurniture,
  commitFurnitureAt: typeof window.__rv.commitFurnitureAt,
  moveFurniture: typeof window.__rv.moveFurniture })`));
console.log('');
console.log('=== ② 새 창구 하나 — 가구를 «안 바꾸고» 그냥 다시 짓기 ===');
for (let i = 0; i < 3; i++) {
  console.log('  ' + (i + 1) + '회 —', await page.eval(`(async()=>{ const t=performance.now();
    let r=null, err=null;
    try { r = await window.__rv.refreshFurniture(); } catch(e){ err = e.message; }
    return JSON.stringify({ ms: Math.round(performance.now()-t), 돌려준것: r, 탈: err });
  })()`, true, 200000));
}
console.log('');
console.log('=== ③ 견줌 — 가구 하나를 «제자리로» 옮기기(commitFurnitureAt) ===');
console.log(' ', await page.eval(`(async()=>{ const f=(window.__io.light.room.def.furniture||[])
    .find(x=>x&&x.uid&&x.x!=null);
  if(!f) return JSON.stringify({ 탈:'옮길 가구가 없다' });
  const t=performance.now(); let err=null;
  try { await window.__rv.commitFurnitureAt(f.uid, { x:f.x, z:f.z, rot:f.rot||0 }); }
  catch(e){ err=e.message; }
  return JSON.stringify({ uid:f.uid, ms: Math.round(performance.now()-t), 탈: err });
})()`, true, 200000));
await page.close(); clearTimeout(wd);
