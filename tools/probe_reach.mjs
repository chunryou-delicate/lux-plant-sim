/* ============================================================
   tools/probe_reach.mjs — 자리마다 「설 수 있는 가장 가까운 데」가 몇 m 인가
   ------------------------------------------------------------
   G-9 「물주러 못 간다 — 거기까지 못 갑니다 (1.56m)」의 근거를 뽑는다.

   무엇을 켜고 무엇을 껐나 (START-HERE §2.9 ①)
     · 실제 게임(game.html) · localStorage 비우고 새로 시작 · 반지하
     · 자리는 **자르지 않는다** — slots() 가 주는 것 전부를 돈다
     · 캐릭터를 방 여러 곳에 세워 두고 잰다(출발점이 결과를 바꾸므로)

   내는 값 (room_view §standProbe 와 같은 뜻)
     nearest  연속 좌표에서 제일 가까운 설 자리 [m]  ← 「이론상 한도」
     cellNear 걸어서 닿는 제일 가까운 데 [m]         ← 「진짜 한도」(격자 0.25)
     chosenR  standNear 가 고른 자리의 반지름 [m]
     gap      ★ **고침 전** — 첫 후보를 그냥 믿었을 때 서게 되는 데 → 대상 거리 [m]
     bestGap  ★ **고침 후** — pickStand 가 고른 후보로 갔을 때의 거리 [m]
   ⇒ 두 값이 ACT_REACH 와 겨룬다. gap 이 넘고 bestGap 이 안 넘으면 「고르는 법」이 범인이다.
============================================================ */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8963';

const page = await launch({ width: 1280, height: 900, dpr: 1, mobile: false });
await page.goto(`${BASE}/game.html`);
await page.eval(`localStorage.clear()`, false);          // ⚠ goto 뒤에 부른다
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 180000, 300);
await page.waitFor('window.__byeotBooted === true', 180000, 300);
await sleep(6000);

/* 캐릭터를 여러 자리에 세워 놓고 잰다 — 출발점이 다르면 BFS 가 다른 칸을 준다 */
const raw = await page.eval(`(() => {
  const rv = window.__rv;
  const slots = rv.slots();
  const size = rv.roomSize();
  /* 출발점 다섯: 지금 선 자리 · 방 네 귀퉁이 안쪽 */
  const c0 = (rv.characters().find(c => c.walkable) || { pos: { x: 0, z: 0 } }).pos;
  const m = 0.6;
  const froms = [ { x: c0.x, z: c0.z },
                  { x: -size.w / 2 + m, z: -size.d / 2 + m },
                  { x:  size.w / 2 - m, z: -size.d / 2 + m },
                  { x: -size.w / 2 + m, z:  size.d / 2 - m },
                  { x:  size.w / 2 - m, z:  size.d / 2 - m } ];
  const rows = [];
  for (const s of slots) {
    const per = froms.map(f => rv.standProbe(s.slotId, f)).filter(Boolean);
    if (!per.length) continue;
    const worst = per.reduce((a, b) => (b.gap > a.gap ? b : a));
    rows.push({
      slotId: s.slotId, name: s.name,
      y: +s.pos.y.toFixed(2),
      nearest: per[0].nearest ? per[0].nearest.d : null,
      cellNearMax: +Math.max(...per.map(p => p.cellNear.d)).toFixed(2),
      cellNearMin: +Math.min(...per.map(p => p.cellNear.d)).toFixed(2),
      chosenRMax: +Math.max(...per.map(p => p.chosenR ?? 0)).toFixed(2),
      gapMax: +Math.max(...per.map(p => p.gap ?? 0)).toFixed(2),
      gapMin: +Math.min(...per.map(p => p.gap ?? 0)).toFixed(2),
      bestGapMax: +Math.max(...per.map(p => p.bestGap ?? 0)).toFixed(2),
      reach: per[0].reach,
      worstFrom: { x: worst.from.x, z: worst.from.z }
    });
  }
  return JSON.stringify({ room: rv.roomId, size, rows });
})()`);

const out = JSON.parse(raw);
const R = out.rows[0] ? out.rows[0].reach : null;
console.log(`\n방 ${out.room} · 자리 ${out.rows.length}곳 · ACT_REACH ${R}\n`);
const pad = (s, n) => String(s).padEnd(n);
const num = (v, n = 6) => String(v == null ? '-' : v.toFixed ? v.toFixed(2) : v).padStart(n);
console.log(pad('자리', 24) + num('nearest') + num('cellMin') + num('cellMax')
          + num('chosenR') + num('gapMin') + num('gapMax') + num('bestMax') + '  판정');
console.log('-'.repeat(90));
let worst = 0, bad = 0, worstBest = 0;
for (const r of out.rows.sort((a, b) => b.gapMax - a.gapMax)) {
  const ok = r.gapMax <= r.reach;
  if (!ok) bad++;
  worst = Math.max(worst, r.gapMax);
  worstBest = Math.max(worstBest, r.bestGapMax);
  console.log(pad(r.slotId, 24) + num(r.nearest) + num(r.cellNearMin) + num(r.cellNearMax)
            + num(r.chosenRMax) + num(r.gapMin) + num(r.gapMax) + num(r.bestGapMax)
            + '  ' + (ok ? '✔' : `✘ ${r.gapMax.toFixed(2)}m`));
}
console.log('-'.repeat(90));
console.log(`제일 먼 gap  ${worst.toFixed(2)}m   (ACT_REACH ${R} · 넘는 자리 ${bad}곳)`);
console.log(`후보를 전부 걸어 봤을 때 제일 먼 gap  ${worstBest.toFixed(2)}m`);
console.log(`\nJSON=${raw}`);
await page.close();
