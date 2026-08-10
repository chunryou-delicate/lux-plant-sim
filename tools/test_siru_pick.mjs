/* ============================================================
   tools/test_siru_pick.mjs — 방에 선 시루를 **손가락으로 고를 수 있나**
   ------------------------------------------------------------
   박사님 2026-08-09 제보: *"콩나물이 안 눌러지고 계속 몬스테라만 지정됨"*

   재서 알아낸 것(tools/probe_siru_tap.mjs)은 두 가지였고 **둘 다 참**이었다:

     ① 자유 좌표로 선 시루는 `pickSlotFuzzy` 의 그물(`slotById`)에 없어서
        **정확한 광선 하나로만** 잡혔다. 폰 390px 에서 표적이 ±6px 이었다
        (발밑에서 위로 10px · 옆으로 8px 이면 이미 못 잡았다. 손가락은 40px 을 덮는다).
        그리고 **못 잡은 탭은 아무 신호도 안 낸다** — 직전에 고른 것이 화면에 그대로 남는다.
        그래서 "계속 몬스테라만 지정됨"으로 보였다.
     ② 제대로 잡아도 아래 메뉴 이름이 **"몬스테라"** 였다. `slotLabel` 이 자유 좌표를
        `id === BEANSPROUT_ID`(=`crop_01`) 하나로만 갈랐는데, 「각개」(2026-08-09) 뒤로
        방에 서는 것은 시루 개체(`crop_01_01` …)라 전부 그 비교에서 떨어졌다.

   ★ 여기서 못 박는 것
     A. 시루 발밑에서 **±8px · 위로 16px** 안이면 그 시루가 골라진다
     B. 골라진 시루의 이름이 **시루마다 다르다**(몬스테라가 아니다)
     C. 시루를 고르면 몬스테라는 안 골라진다(반대도 같다)

   ⚠ 서버가 먼저 떠 있어야 한다.
       python tools/serve.py 8963
       BYEOT_URL=http://localhost:8963 node tools/test_siru_pick.mjs
============================================================ */
import { launch, sleep } from './test_cdp.mjs';
import assert from 'node:assert';

const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const page = await launch({ width: 390, height: 844, dpr: 2, mobile: true });
await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });

let pass = 0;
const ok = (name) => { pass++; console.log('PASS  ' + name); };

const tapXY = async (x, y) => {
  await page.send('Input.dispatchTouchEvent',
    { type: 'touchStart', touchPoints: [{ x: Math.round(x), y: Math.round(y), id: 1, radiusX: 8, radiusY: 8, force: 1 }] });
  await sleep(60);
  await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(180);
};
/* 누르기 전에 고르기를 푼다 — 안 풀면 「안 눌렸다」가 「전에 고른 것이 남았다」로 보인다.
   이 검사가 막으려는 버그가 바로 그것이라, 여기서 안 풀면 검사가 통째로 장식이 된다. */
async function tapAndRead(x, y) {
  await page.eval(`window.__picked.clear()`);
  await tapXY(x, y);
  return page.eval(`(() => ({
    picked: window.__picked && window.__picked.slotId,
    name: (document.getElementById('pickedName')||{}).textContent
  }))()`);
}

await page.goto(`${BASE}/game.html`);
await page.waitFor('window.__byeotBooted === true', 120000);
await page.waitFor('!!window.__rv && !!window.__S && !!window.__picked', 60000);
await sleep(1200);

/* ── 판: 몬스테라(책상) + 시루 3개(바닥 자유 좌표) ─────────────────────── */
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
/* 그루가 실제로 서고 자리가 안정될 때까지 기다린다 — nudgeIfOccluding 이 옮길 수 있다 */
await page.waitFor(`window.__rv.plants().filter(p => p.kind === 'beansprout').length === 3`, 30000);
await sleep(2200);

const keys = ['free:crop_01_01', 'free:crop_01_02', 'free:crop_01_03'];
const screenOf = (key) => page.eval(`(() => {
  const c = document.getElementById('roomCanvas'); const r = c.getBoundingClientRect();
  let s = null; try { s = window.__rv.screenPosOf(${JSON.stringify(key)}); } catch(e) {}
  return s ? { x: r.left + s.x, y: r.top + s.y } : null;
})()`);

/* ── A · B — 손가락 오차 안에서 그 시루가 잡히고, 이름이 시루마다 다르다 ── */
const names = new Set();
for (const key of keys) {
  const at = await screenOf(key);
  assert.ok(at, `${key} 가 화면에 안 잡힙니다 — 시점이 바뀌었거나 안 섰습니다`);
  for (const [dx, dy] of [[0, 0], [8, -6], [-8, -6], [0, -16]]) {
    const r = await tapAndRead(at.x + dx, at.y + dy);
    assert.equal(r.picked, key,
      `${key} 발밑에서 (${dx},${dy})px 을 눌렀는데 「${r.picked}」가 골라졌습니다 ` +
      `— 자유 좌표 그루가 퍼지 그물(pickSlotFuzzy)에 안 들어 있습니다`);
    assert.ok(r.name && !/몬스테라/.test(r.name),
      `${key} 를 골랐는데 이름이 「${r.name}」입니다 — slotLabel 이 시루 개체를 못 읽습니다`);
    names.add(r.name);
  }
}
ok('A 시루 발밑 ±8px · 위 16px 안이면 그 시루가 골라진다');
assert.equal(names.size, 3, `시루 셋의 이름이 서로 달라야 합니다 — 지금 ${[...names].join(' / ')}`);
ok('B 시루 이름이 시루마다 다르다 — ' + [...names].join(' / '));

/* ── C — 몬스테라를 눌렀을 때 시루가 안 골라진다(그 반대도) ─────────────── */
const potKey = await page.eval(`(() => {
  const S = window.__S(); const g = window.__rv.plants().find(p => p.potId === S.pots[0].id);
  return g ? g.key : null;
})()`);
assert.ok(potKey, '몬스테라가 방에 안 서 있습니다');
const pAt = await screenOf(potKey);
assert.ok(pAt, '몬스테라가 화면 밖입니다');
const got = await tapAndRead(pAt.x, pAt.y);
assert.equal(got.picked, potKey, `몬스테라를 눌렀는데 「${got.picked}」가 골라졌습니다`);
assert.ok(/몬스테라|칸|책상/.test(got.name), `몬스테라 이름이 「${got.name}」입니다`);
ok('C 몬스테라와 시루가 서로를 안 가로챈다');

console.log(`\n${pass}개 통과`);
await page.close();
