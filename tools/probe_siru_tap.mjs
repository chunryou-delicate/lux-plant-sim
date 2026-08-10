/* ============================================================
   tools/probe_siru_tap.mjs — 시루를 눌렀을 때 **무엇이 잡히나** (재기 전용)
   ------------------------------------------------------------
   박사님 제보 두 가지를 가른다.
     ① "콩나물이 안 눌러지고 계속 몬스테라만 지정됨"
     ② "창턱으로 옮겼다는데 빛은 옛 자리 값이다"

   고치지 않는다. 재서 적을 뿐이다. 그래서 이름이 probe_ 다.

     python tools/serve.py 8963
     BYEOT_URL=http://localhost:8963 node tools/probe_siru_tap.mjs

   ★ 재는 것
     ⓐ 방에 실제로 선 그루들의 열쇠(plants())
     ⓑ 그 그루가 화면에서 **몇 px 짜리 표적**인가 — 폰 390px 기준
     ⓒ 그 표적을 **진짜 손가락으로** 눌렀을 때 무엇이 골라지나(__picked.slotId)
        · 발밑을 눌렀을 때 · 표적 한가운데를 눌렀을 때 · 8px 빗나갔을 때
     ⓓ 몬스테라를 창턱으로 옮긴 뒤 상태·3D·조도가 **같은 자리**를 가리키나
============================================================ */
import { launch, sleep } from './test_cdp.mjs';

const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const URL_ = `${BASE}/game.html`;

const page = await launch({ width: 390, height: 844, dpr: 2, mobile: true });
await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });

const errs = [];
page.on((m, p) => {
  if (m === 'Runtime.exceptionThrown')
    errs.push((p.exceptionDetails.text || '') + ' ' +
              ((p.exceptionDetails.exception || {}).description || ''));
});

const tapXY = async (x, y) => {
  await page.send('Input.dispatchTouchEvent',
    { type: 'touchStart', touchPoints: [{ x: Math.round(x), y: Math.round(y), id: 1, radiusX: 8, radiusY: 8, force: 1 }] });
  await sleep(70);
  await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(200);
};
/* 한 점을 눌러 보고 무엇이 골라졌는지 — 누르기 전에 반드시 고르기를 푼다.
   안 풀면 「안 눌렸다」와 「전에 고른 것이 남았다」가 같은 그림이 된다(이 프로브가 그렇게 속았다). */
async function tapAndRead(x, y) {
  await page.eval(`window.__picked.clear()`);
  await tapXY(x, y);
  return page.eval(`(() => ({
    picked: window.__picked && window.__picked.slotId,
    name: (document.getElementById('pickedName')||{}).textContent,
    barOn: document.getElementById('stage').classList.contains('picked')
  }))()`);
}

await page.goto(URL_);
await page.waitFor('window.__byeotBooted === true', 120000);
await page.waitFor('!!window.__rv && !!window.__S', 60000);
await sleep(1200);

/* ── 판 깔기 — 몬스테라 1(책상) + 시루 3(바닥 자유 좌표) ────────────────── */
const setup = await page.eval(`(async () => {
  const st = await import('./src/game/state.js');
  const S = window.__S(), io = window.__io;
  if (!S.pots.length) st.givePlant(S, io, { slotId: 'banjiha-desk:0' });
  /* 첫 플레이 단계도 박사님 판과 같게 맞춘다 — 몬스테라가 와 있고 옮기기 전 */
  const fp = S.firstPlay, m = fp.monstera;
  fp.beansprout.harvested = true;
  m.arrived = true; m.slotId = 'banjiha-desk:0'; m.at = null;
  m.guide = m.guide || { days: 0, moved: false, movedDays: 0, grewOnce: false };
  fp.phase = 'move_monstera';
  const b = fp.beansprout;
  const base = b.pots[0];
  const spots = [{ x: -0.7, z: 0.5 }, { x: 0.0, z: 0.9 }, { x: 0.7, z: 0.5 }];
  b.pots = spots.map((s, i) => ({
    ...base,
    id: 'crop_01_0' + (i + 1),
    slotId: 'free:crop_01_0' + (i + 1),
    at: { x: s.x, y: 0, z: s.z, rotY: 0, onUid: null, occIdx: null },
    startedOnDay: 1, ageDays: 1, harvested: false
  }));
  window.__redraw();
  return { pot: S.pots[0] && { id: S.pots[0].id, slotId: S.pots[0].slotId, at: S.pots[0].at },
           sirus: b.pots.map(p => ({ id: p.id, slotId: p.slotId })) };
})()`);
console.log('판:', JSON.stringify(setup));
await sleep(2500);

const plants = JSON.parse(await page.eval(`JSON.stringify(window.__rv.plants().map(p =>
  ({ key: p.key, potId: p.potId, kind: p.kind, pos: p.pos })))`));
console.log('\nⓐ 방에 선 그루');
for (const p of plants) console.log('  ' + JSON.stringify(p));

/* ── ⓑ 표적 크기는 **눌러서** 잰다 ───────────────────────────────────────
   방뷰는 장면을 밖으로 안 내주므로 꼭짓점을 투영할 길이 없다. 그래서 크기를 재는 대신
   **발밑 둘레를 실제로 눌러 본다** — 어차피 알고 싶은 것은 「손가락이 닿나」이지 픽셀 수가 아니다. */
console.log('\nⓑ·ⓒ 눌러 보기 — 발밑 · 발밑에서 위로 6/10/16px · 옆으로 8px');
for (const p of plants) {
  const at = await page.eval(`(() => {
    const c = document.getElementById('roomCanvas'); const r = c.getBoundingClientRect();
    let s = null; try { s = window.__rv.screenPosOf(${JSON.stringify(p.key)}); } catch(e) {}
    if (!s) return null;
    return { x: r.left + s.x, y: r.top + s.y };
  })()`);
  if (!at) { console.log(`  ${p.key} → 화면 밖`); continue; }
  const offs = [[0, 0], [0, -6], [0, -10], [0, -16], [8, -6], [-8, -6]];
  const got = [];
  for (const [dx, dy] of offs) {
    const r = await tapAndRead(at.x + dx, at.y + dy);
    got.push(`(${dx},${dy})→${r.picked || 'null'}${r.picked ? '["' + r.name + '"]' : ''}`);
  }
  console.log(`  ${p.key} @발밑(${Math.round(at.x)},${Math.round(at.y)})`);
  console.log('     ' + got.join('  '));
}

/* ── ⓓ 창턱으로 옮긴 뒤 상태·3D·조도가 같은 자리인가 ────────────────────── */
console.log('\nⓓ 창턱으로 옮긴 뒤 — 상태 · 3D · 조도');
const read = () => page.eval(`(() => {
  const S = window.__S(), io = window.__io, p = S.pots[0];
  const rep = io.light.daily(S.day + 1, S).report;
  const row = (rep.slots||[]).find(s => s.slotId === p.slotId);
  const g = window.__rv.plants().find(x => x.potId === p.id);
  return { 상태_slotId: p.slotId, 상태_at: p.at, 오늘DLI: row && row.dli,
           방뷰_열쇠: g && g.key, 방뷰_좌표: g && g.pos,
           첫플레이_slotId: S.firstPlay.monstera.slotId,
           안내: (document.getElementById('quest')||{}).textContent };
})()`);
console.log('  전:', JSON.stringify(await read()));
console.log('  [자리] 목록에서 창턱 고르기:', JSON.stringify(await page.eval(`(() => {
  const sel = document.getElementById('slot');
  if (![...sel.options].some(o => o.value === 'banjiha-sill:0'))
    return { skipped: true, opts: [...sel.options].map(o => o.value) };
  sel.value = 'banjiha-sill:0';
  sel.dispatchEvent(new Event('change', { bubbles: true }));
  return { ok: true };
})()`)));
await sleep(2500);
console.log('  후:', JSON.stringify(await read()));

/* ── ⓔ 옮긴 뒤 7일평균이 언제 문턱을 넘나 ───────────────────────────────── */
console.log('\nⓔ 옮긴 뒤 하루씩 — 오늘 DLI 와 판정값(7일평균)');
for (let i = 0; i < 7; i++) {
  await page.eval(`(() => { const b = document.getElementById('play'); if (b && !b.disabled) b.click(); })()`);
  await sleep(1600);
  console.log('  ' + await page.eval(`(() => {
    const S = window.__S();
    let d7 = null; try { d7 = window.__io.growth.dli7(); } catch(e) {}
    return 'Day ' + S.day + ' · 이력끝 ' + JSON.stringify((S.dliHist||[]).slice(-3)) +
           ' · 7일평균 ' + (d7 == null ? 'null' : d7.toFixed(2));
  })()`));
}

if (errs.length) { console.log('\n⚠ 처리 안 된 예외'); errs.slice(0, 6).forEach(e => console.log('  ' + e.slice(0, 200))); }
await page.close();
