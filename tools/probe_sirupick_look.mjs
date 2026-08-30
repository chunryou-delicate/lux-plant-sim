/* tools/probe_sirupick_look.mjs — **시루 셋 중 셋째가 왜 «안 눌리나»**
   ------------------------------------------------------------------
   `test_siru_pick` A 가 `free:crop_01_03` 발밑에서 떨어진다(골라진 것이 null).
   ⇒ 검사는 「안 눌린다」까지만 말한다. 여기서는 ★ 「그 점에 «무엇이» 있나」를 본다.
   ⛔ 값도 코드도 안 바꾼다. */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8972';
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 300000);
wd.unref && wd.unref();
const page = await launch({ width: 390, height: 844, dpr: 2, mobile: true });
await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
await page.goto(`${BASE}/game.html`);
await page.waitFor('window.__byeotBooted === true', 120000);
await page.waitFor('!!window.__rv && !!window.__S && !!window.__picked', 60000);
await sleep(1500);
/* 검사와 «같은 판»을 세운다 — 몬스테라(책상) + 바닥 자유 좌표 시루 셋 */
await page.eval(`(async () => {
  const st = await import('./src/game/state.js');
  const S = window.__S(), io = window.__io;
  if (!S.pots.length) st.givePlant(S, io, { slotId: 'banjiha-desk:0' });
  const fp = S.firstPlay, m = fp.monstera;
  fp.beansprout.harvested = true;
  m.arrived = true; m.slotId = 'banjiha-desk:0'; m.at = null;
  fp.phase = 'move_monstera';
  const b = fp.beansprout, base = b.pots[0];
  const spots = [{ x: -0.7, z: 0.5 }, { x: 0.0, z: 0.9 }, { x: 0.7, z: 0.5 }];
  b.pots = spots.map((s, i) => ({
    ...base, id: 'crop_01_0' + (i + 1), slotId: 'free:crop_01_0' + (i + 1),
    at: { x: s.x, y: 0, z: s.z, rotY: 0, onUid: null, occIdx: null },
    startedOnDay: 1, ageDays: 1, harvested: false
  }));
  window.__redraw();
})()`);
await page.waitFor(`window.__rv.plants().filter(p => p.kind === 'beansprout').length === 3`, 30000);
await sleep(2200);
const tap = async (x, y) => {
  await page.eval(`window.__picked.clear()`);
  /* ★ 「고르기를 푼 «뒤»」에 그 점에 무엇이 있나 — 이게 검사가 실제로 누르는 순간이다.
     앞에서 읽은 것은 «풀기 전»이라 메뉴가 아직 떠 있는 것이 당연하다(내 자의 순서 탓). */
  const afterClear = await page.eval(`(() => { const el=document.elementFromPoint(${Math.round(x)}, ${Math.round(y)});
    const pa=document.getElementById('plantActions');
    return JSON.stringify({ 그점: el ? (el.id || el.tagName) : null,
      '메뉴 보이나': !!(pa && pa.offsetParent !== null),
      'stage.picked': document.getElementById('stage').classList.contains('picked') }); })()`);
  console.log('    · 푼 뒤 —', afterClear);
  /* ★ 누르는 동안 「고르기」가 몇 번 서고 몇 번 풀리나 — 부르는 «순서»를 적는다 */
  await page.eval(`(()=>{ const P=window.__picked; if(P.__hooked) { window.__trace=[]; return; }
    P.__hooked = true; window.__trace = [];
    const sel = P.select.bind(P), clr = P.clear.bind(P);
    P.select = function(k){ window.__trace.push('select ' + k); return sel(k); };
    P.clear  = function(){ window.__trace.push('clear ← ' +
      ((new Error()).stack||'').split(String.fromCharCode(10)).slice(1,4)
        .map(l=>l.trim().replace(/^at /,'').split(' ')[0]).join(' < ')); return clr(); };
  })()`, false);
  await page.send('Input.dispatchTouchEvent',
    { type: 'touchStart', touchPoints: [{ x: Math.round(x), y: Math.round(y), id: 1, radiusX: 8, radiusY: 8, force: 1 }] });
  await sleep(60);
  await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(200);
  return page.eval(`(() => JSON.stringify({ picked: window.__picked && window.__picked.slotId,
    name: (document.getElementById('pickedName')||{}).textContent,
    부른순서: (window.__trace||[]).slice(-6) }))()`);
};
console.log('■ 화면 —', await page.eval(`JSON.stringify({ w:innerWidth, h:innerHeight,
  '오류상자 떴나': !!(document.getElementById('errBox')||{}).classList &&
    document.getElementById('errBox').classList.contains('on') })`));
for (const key of ['free:crop_01_01', 'free:crop_01_02', 'free:crop_01_03']) {
  const at = JSON.parse(await page.eval(`(() => { const c=document.getElementById('roomCanvas');
    const r=c.getBoundingClientRect(); let s=null;
    try{ s=window.__rv.screenPosOf(${JSON.stringify(key)}); }catch(e){}
    return JSON.stringify(s? { x:r.left+s.x, y:r.top+s.y } : null); })()`));
  if (!at) { console.log(key, '— 화면에 안 잡힘'); continue; }
  const what = await page.eval(`(() => { const el=document.elementFromPoint(${Math.round(at.x)}, ${Math.round(at.y)});
    return el ? (el.id || (el.tagName + '.' + (el.className||''))) : 'null'; })()`);
  const r = await tap(at.x, at.y);
  console.log(` ${key}  자리 (${Math.round(at.x)},${Math.round(at.y)})  그 점의 것 「${what}」  →`, r);
}
await page.close(); clearTimeout(wd);
