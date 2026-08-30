/* tools/probe_siruhands.mjs — **시루 하나를 세우는 데 «손»이 몇인가**
   ------------------------------------------------------------------
   총괄 ⓑ: 「놓기 1 + 심기 1 + 물 1 = 셋인가」. 「하루에 하나씩」 규칙의 밑돌이 될 수다.
   재는 법: **손가락이 짚는 것을 그대로 따라간다.** 안내가 곧 길이므로(§lamp-is-the-path),
     손가락이 짚는 것을 한 번 누르는 것이 곧 「손 하나」다. 물이 들어갈 때까지 센다.
   재는 것: ① 콩나물 시루 하나에 손 몇 ② 무순 재배판 하나에 손 몇
            ③ 그 손들이 «같은 날»에 다 들어가나 ④ 다섯 시루면 손 몇
   ⛔ 값은 안 바꾼다. 「하루에 몇」을 정하는 것은 [Plan] 몫이다. 여기는 수만 낸다. */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8972';
const W = Number(process.env.W || 390), H = Number(process.env.H || 844);
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 420000);
wd.unref && wd.unref();
const page = await launch({ width: W, height: H, dpr: 1 });
await page.goto(`${BASE}/game.html`);
await page.eval('localStorage.clear()', false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 150000, 300);
await sleep(5000);
const mouse = (type, x, y, buttons) => page.send('Input.dispatchMouseEvent',
  { type, x: Math.round(x), y: Math.round(y), button: 'left', buttons, clickCount: 1 });
const tapPoint = async (x, y) => {
  await mouse('mouseMoved', x, y, 0);
  await mouse('mousePressed', x, y, 1);
  await sleep(70);
  await mouse('mouseReleased', x, y, 0);
  await sleep(700);
};
/* ⚠ 대사 중에는 손가락이 «일부러» 꺼진다. 안 걷고 세면 0이 나온다. */
const clearDlg = async () => {
  for (let i = 0; i < 40; i++) {
    const t = await page.eval(`String(document.getElementById('stage').classList.contains('talking'))`);
    if (t !== 'true') return true;
    await page.eval(`(()=>{ const x=document.getElementById('dlgBox'); if (x) x.click(); })()`, false);
    await sleep(220);
  }
  return false;
};
const quiet = async () => { for (let i = 0; i < 4; i++) { await clearDlg(); await sleep(700); } };
/* 손가락이 지금 짚는 «점» — 요소든 점이든 화면 좌표 하나로 받는다 */
const fingerAt = () => page.eval(`(()=>{ const h=document.getElementById('hint');
  if (!h || !h.classList.contains('on')) return 'null';
  const r=h.getBoundingClientRect();
  const t=document.querySelector('.hintTarget');
  const tr=t?t.getBoundingClientRect():null;
  /* ⚠ «점»으로 짚을 때는 손가락 그림이 그 점 «옆»에 선다 — 그림 한가운데를 누르면 빗나간다.
     ⇒ 덮개가 뚫어 둔 구멍의 «한가운데»가 곧 그 점이다(§dimAt 이 dataset.hole 에 적어 둔다). */
  const d=document.getElementById('hintDim');
  const hole=(d&&d.dataset.hole||'').split(',').map(Number);
  const at = tr && tr.width ? { x:tr.left+tr.width/2, y:tr.top+tr.height/2 }
           : (hole.length===3 && hole.every(Number.isFinite)) ? { x:hole[0], y:hole[1] }
           : { x:r.left+r.width/2, y:r.top+r.height/2 };
  return JSON.stringify({ x:at.x, y:at.y,
    짚는것: t ? (t.id || (t.className||'').split(' ')[0]) : '(점)',
    말: ((h.querySelector('.say')||{}).textContent||'').trim().slice(0,26) }); })()`);
/* 지금 시루 줄이 어떤가 — 코어에게 묻는다(화면을 긁지 않는다) */
const rows = () => page.eval(`(async()=>{ const fp=await import('/src/game/first_play.js');
  const S=window.__S();
  const rs=fp.cropPotList(S.firstPlay, S.day)||[];
  return JSON.stringify({ 날:S.day, 줄: rs.map(r=>({ id:r.id, 종:r.kind, 놓임:!!r.placed,
    심어야:!!r.needsSow, 물:!!r.watered, 거둠:!!r.harvested })) }); })()`, true, 30000);
console.log('■ 켠 직후 —', await rows());
await quiet();
console.log('');
console.log('=== ① 콩나물 시루 하나 — 손가락을 따라 세어 본다 ===');
let hands = 0; const path = []; const days = new Set();
for (let i = 0; i < 14; i++) {
  await quiet();
  const st = JSON.parse(await rows());
  days.add(st.날);
  const done = (st.줄 || []).some(r => r.놓임 && r.물);
  if (done) { console.log(`  ✔ 물까지 들어갔다 — 손 ${hands}개`); break; }
  const f = JSON.parse(await fingerAt());
  if (!f) { console.log('  ⛔ 손가락이 없다 — 여기서 길이 끊긴다', JSON.stringify(st)); break; }
  path.push(`${hands + 1}. ${f.짚는것} 「${f.말}」`);
  await tapPoint(f.x, f.y);
  hands++;
}
for (const p of path) console.log('   ' + p);
console.log('  · 지나온 날 —', [...days].join(', '));
console.log('  · 끝난 뒤 —', await rows());
console.log('');
console.log('=== ② 「놓기 = 심기」인가 (콩나물) ===');
console.log(' ', await page.eval(`(async()=>{ const st=await import('/src/game/state.js');
  return JSON.stringify({ '놓기 문': typeof st.placeSiru,
    '심기 문': typeof st.sowCrop,
    뜻: '콩나물 시루는 놓기가 곧 심기다 — 심기 문은 재배판(무순)이 쓴다' }); })()`, true, 30000));
console.log('');
console.log('=== ③ 다섯이면 손 몇인가 (지금 셈으로) ===');
console.log(`  · 콩나물 시루 하나 = 손 ${hands}개 ⇒ 다섯이면 ${hands * 5}개`);
console.log('  ⚠ 무순 재배판은 여기에 [심기] 한 손이 더 붙는다(놓기 → 심기 → 물).');
await page.shot('docs/handoff/img/siruhands.png').catch(() => {});
await page.close(); clearTimeout(wd);
