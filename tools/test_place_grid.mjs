/* ============================================================
   tools/test_place_grid.mjs — 놓는 걸음(배치 격자) 재현
   ------------------------------------------------------------
   박사님 2026-08-07:
     ② "그 배치 스냅 간격이 너무 촘촘한 거 같아. 밑에 그리드의 절반 정도로 해줘."
     ③ "바닥 그리드 간격만치 책상 위나 가구 위에 배치도 그만큼 많이 배치할 수 있게,
        가구 크기만큼 또는 살짝 더 작게 맞게 그리드를 배치해줘."

   여기서 보는 것은 다섯이다.
     P 바닥에서 걸음이 **보이는 칸의 절반(0.125m)** 인가 · 화분 크기와 무관한가
     Q 가구 상판에서도 같은 걸음인가 · 한 상판에 자리가 **여럿** 나오는가
     R 격자에 물린 **뒤에도** 상판 밖으로 안 나가는가
     S 추천 자리는 한 톨도 안 움직이는가 · 그 자리 DLI 가 그대로인가
     T 시루 무리(12개 · 지름 0.97m)도 놓이는가

   ★ 이 파일은 계약을 재는 자리다. 판정을 느슨하게 해서 통과시키지 않는다 —
     못 지나가면 그건 코드가 틀린 것이거나 **못 쟀다**고 적을 일이다.

     python tools/serve.py 8985
     BYEOT_URL=http://127.0.0.1:8985 node tools/test_place_grid.mjs
============================================================ */
import { launch, sleep } from './test_cdp.mjs';

const BASE = process.env.BYEOT_URL || 'http://localhost:8971';
/* ?engine=1 — 조도 엔진을 붙여서 띄운다. S 블록(추천 자리 DLI)이 그걸 쓴다. */
const URL_ = `${BASE}/tools/room_view_demo.html?room=banjiha&engine=1`;

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log(`PASS  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}${extra ? '  — ' + extra : ''}`); }
};

/* 월드 좌표 → 화면 좌표. 방 뷰는 슬롯만 screenPosOf 로 내주므로(그게 맞다) 여기서 직접 쏜다. */
const INSTALL = `(() => {
  window.__sp = (x, y, z) => {
    const p = new THREE.Vector3(x, y, z).project(window.view.three.cam);
    const r = document.getElementById('roomCanvas').getBoundingClientRect();
    return { x: r.left + (p.x * 0.5 + 0.5) * r.width,
             y: r.top + (-p.y * 0.5 + 0.5) * r.height, behind: p.z > 1 };
  };
  /* 상판 좌표계로 되돌린 국소 좌표 — 격자 원점이 그 가구 한가운데인지 보는 자다.
     변환 규약은 room_view.snapOnSurface 와 같다(house.js 슬롯 변환의 역). */
  window.__local = (hit) => {
    const f = hit.surface;
    if (!f) return null;
    const c = Math.cos(f.rot), s = Math.sin(f.rot);
    const dx = hit.x - f.x, dz = hit.z - f.z;
    return { u: dx * c - dz * s, v: dx * s + dz * c, w: f.w, d: f.d };
  };
  return true;
})()`;

/* 값이 걸음의 배수인가. 좌표는 소수 넷째 자리로 반올림돼 나오므로(surfaceAt) 그만큼만 봐준다. */
const MULT_EPS = 1e-3;

async function main() {
  const page = await launch({ width: 390, height: 844, dpr: 2, mobile: false });
  const errs = [];
  page.on((m, p) => {
    if (m === 'Runtime.exceptionThrown')
      errs.push(p.exceptionDetails.text + ' ' + ((p.exceptionDetails.exception || {}).description || ''));
  });

  await page.goto(URL_);
  await page.waitFor('!!window.view', 120000, 200);
  await page.eval(INSTALL);
  await sleep(400);

  const g = await page.eval(`window.view.grid()`);

  /* ══ P 바닥 걸음 ═══════════════════════════════════════════════════════ */
  ok('P-1 놓는 걸음이 보이는 칸의 절반이다 (0.25 → 0.125m)',
     g.step === g.cell / 2 && g.step === 0.125, JSON.stringify(g));

  /* 바닥을 훑어 나온 좌표가 전부 걸음 배수인가 — 화분 크기를 바꿔 가며 본다.
     ★ 예전 규약(발자국 모서리 맞춤)이면 0.18 짜리가 0.125k+0.10 으로 어긋났다. */
  const floor = await page.eval(`(() => {
    const v = window.view, rc = document.getElementById('roomCanvas').getBoundingClientRect();
    const st = v.grid().step, rows = [];
    for (const potD of [0.202, 0.18, 0.30]) {
      const xs = [];
      for (let i = 2; i < 15; i++) for (let j = 12; j < 22; j++) {
        const t = v.surfaceAt(rc.left + rc.width * i / 16, rc.top + rc.height * j / 24, { potD });
        if (!t.ok || t.onUid !== null || t.snappedTo) continue;
        xs.push({ x: t.x, z: t.z, step: t.cells.step });
      }
      const off = xs.map(p => Math.max(Math.abs(p.x / st - Math.round(p.x / st)),
                                       Math.abs(p.z / st - Math.round(p.z / st))));
      rows.push({ potD, n: xs.length, maxOff: Math.max(0, ...off),
                  step: xs.length ? xs[0].step : null });
    }
    return rows;
  })()`);
  ok('P-2 바닥 좌표가 걸음 배수에 앉는다 — 화분 크기(0.202·0.18·0.30)와 무관하다',
     floor.length === 3 && floor.every(r => r.n > 5 && r.maxOff * 0.125 < MULT_EPS && r.step === 0.125),
     floor.map(r => `${r.potD}: ${r.n}점 · 어긋남 ${(r.maxOff * 0.125).toExponential(1)}m`).join(' | '));

  /* 손가락을 조금씩 옮기면 좌표가 **한 걸음씩** 뛴다 — 연속이면 걸음이 0 으로 나온다.
     화면 한 줄을 1px 씩 훑어 서로 다른 x 사이의 **제일 작은 간격**을 잰다. */
  const jump = await page.eval(`(() => {
    const v = window.view, rc = document.getElementById('roomCanvas').getBoundingClientRect();
    const gaps = [];
    let n = 0;
    for (const fy of [0.62, 0.70, 0.78, 0.86]) {
      const y = rc.top + rc.height * fy;
      let prev = null;
      for (let px = rc.left + 30; px < rc.right - 30; px += 1) {
        const t = v.surfaceAt(px, y, { potD: 0.202 });
        if (!t.ok || t.onUid !== null || t.snappedTo) { prev = null; continue; }
        if (prev !== null && Math.abs(t.x - prev) > 1e-9) gaps.push(+Math.abs(t.x - prev).toFixed(4));
        if (prev === null || Math.abs(t.x - prev) > 1e-9) n++;
        prev = t.x;
      }
    }
    return { n, min: gaps.length ? Math.min(...gaps) : null,
             uniq: [...new Set(gaps)].sort((a, b) => a - b).slice(0, 5) };
  })()`);
  ok('P-3 화면을 1px 씩 훑어도 좌표는 한 걸음(0.125m)보다 잘게 안 움직인다',
     jump.min !== null && jump.min >= 0.125 - MULT_EPS,
     `${jump.n}자리 · 제일 작은 간격 ${jump.min}m · 나온 간격들 ${JSON.stringify(jump.uniq)}`);

  /* ══ Q·R 가구 상판 ════════════════════════════════════════════════════ */
  /* 가구 상판을 촘촘히 쏴서 나온 자유 좌표(추천 자리가 아닌 것)를 모은다. */
  const tops = await page.eval(`(() => {
    const v = window.view, out = {};
    for (const f of v.furniture()) {
      const hits = [];
      for (let a = -0.48; a <= 0.481; a += 0.06) for (let b = -0.48; b <= 0.481; b += 0.06) {
        const sp = window.__sp(f.x + a * f.size.w, f.size.h + 0.004, f.z + b * f.size.d);
        if (sp.behind) continue;
        const t = v.surfaceAt(sp.x, sp.y, { potD: 0.202 });
        if (!t.ok || t.onUid !== f.uid || t.snappedTo || !t.surface) continue;
        const L = window.__local(t);
        hits.push({ x: t.x, z: t.z, u: +L.u.toFixed(5), v: +L.v.toFixed(5),
                    w: L.w, d: L.d, step: t.cells.step });
      }
      if (hits.length) out[f.uid] = hits;
    }
    return out;
  })()`);
  const topUids = Object.keys(tops);
  const allTop = topUids.flatMap(u => tops[u]);
  ok('Q-1 가구 상판에서도 자유 좌표가 나온다 (추천 자리 밖)',
     topUids.length > 0 && allTop.length > 0,
     `가구 ${topUids.length}개 · 자리 ${allTop.length}곳 — ${topUids.join(', ')}`);

  const offGrid = allTop.filter(h => {
    const ku = h.u / h.step, kv = h.v / h.step;
    return Math.abs(ku - Math.round(ku)) * h.step > MULT_EPS
        || Math.abs(kv - Math.round(kv)) * h.step > MULT_EPS;
  });
  ok('Q-2 상판 좌표도 같은 걸음 배수다 — 원점은 **그 가구 한가운데**다',
     allTop.length > 0 && offGrid.length === 0 && allTop.every(h => h.step === 0.125),
     `${allTop.length - offGrid.length}/${allTop.length} · 어긋난 것 ` +
     JSON.stringify(offGrid.slice(0, 3)));

  /* 한 상판에서 **서로 다른 자리**가 몇 곳 나오나 — ③ 「다양한 위치」가 이 숫자다.
     추천 자리(slots)만 있던 때는 가구 하나에 2~4칸뿐이었다. */
  const spread = topUids.map(uid => {
    /* 상판이 여러 판인 가구가 있다(침대는 매트리스·프레임·베개 셋). 판마다 제 격자라
       판 크기까지 열쇠에 넣어야 서로 다른 자리가 같은 자리로 세어지지 않는다. */
    const set = new Set(tops[uid].map(h => `${h.w}×${h.d}|${h.u}|${h.v}`));
    return { uid, spots: set.size, w: tops[uid][0].w, d: tops[uid][0].d };
  }).sort((a, b) => b.spots - a.spots);
  ok('Q-3 한 상판에 자리가 여러 곳 난다 (제일 넓은 상판이 4곳 넘는다)',
     spread.length > 0 && spread[0].spots >= 4,
     spread.slice(0, 5).map(s => `${s.uid} ${s.spots}곳(${s.w}×${s.d}m)`).join(' · '));

  /* ★ R — 격자에 물린 뒤에도 상판 밖으로 안 나간다. 화분 반지름까지 다 재서 본다. */
  const outside = allTop.filter(h =>
    Math.abs(h.u) > h.w / 2 - 0.101 + 1e-4 || Math.abs(h.v) > h.d / 2 - 0.101 + 1e-4);
  ok('R-1 격자에 물린 뒤에도 화분이 상판 밖으로 안 나간다 (반지름까지 안쪽)',
     allTop.length > 0 && outside.length === 0,
     `${allTop.length - outside.length}/${allTop.length} · 삐져나온 것 ` +
     JSON.stringify(outside.slice(0, 3)));

  /* ★ 격자가 자리를 얼마나 끌어당기나 — **재서** 못 박는다.
     같은 화면 점을 두 번 쏜다: opt.grid:false(광선이 맞은 날것) 와 그냥(격자에 앉힌 것).
     끌어당기는 양의 한도는 「화분 반지름 + 한 걸음」이다. 그보다 멀리 끌면 그건 안내가
     아니라 순간이동이고, 손가락이 가리킨 곳과 다른 가구로 넘어갈 수 있다.
     ⚠ 「가구 옆 허공을 쏘면 거절한다」로는 못 잰다 — 원근 때문에 가구 밖 월드 좌표를
       투영한 화면 점이 여전히 그 가구 상판을 맞는다(실제로 그래서 한 번 헛짚었다). */
  const pull = await page.eval(`(() => {
    const v = window.view, out = [];
    for (const f of v.furniture()) {
      for (let a = -0.48; a <= 0.481; a += 0.06) for (let b = -0.48; b <= 0.481; b += 0.06) {
        const sp = window.__sp(f.x + a * f.size.w, f.size.h + 0.004, f.z + b * f.size.d);
        if (sp.behind) continue;
        const raw = v.surfaceAt(sp.x, sp.y, { potD: 0.202, grid: false });
        const snp = v.surfaceAt(sp.x, sp.y, { potD: 0.202 });
        if (!snp.ok || snp.onUid !== f.uid || snp.snappedTo || !snp.surface || !raw.surface) continue;
        const A = window.__local(raw), B = window.__local(snp);
        out.push({ uid: f.uid, sameSurface: raw.onUid === snp.onUid,
                   du: +Math.abs(B.u - A.u).toFixed(4), dv: +Math.abs(B.v - A.v).toFixed(4) });
      }
    }
    return out;
  })()`);
  /* 한 축이 끌리는 양의 이론 한도 = 화분 반지름 + 한 걸음.
     (안쪽 한계선이 화분 반지름만큼 들어와 있고, 거기서 다시 한 걸음 안까지 내려앉는다) */
  const LIMIT = 0.202 / 2 + 0.125;
  const yanked = pull.filter(p => !p.sameSurface || p.du > LIMIT + 1e-4 || p.dv > LIMIT + 1e-4);
  ok(`R-2 격자가 자리를 한 축에 화분 반지름+한 걸음(${LIMIT.toFixed(3)}m)보다 멀리 끌어당기지 않는다`,
     pull.length > 0 && yanked.length === 0,
     `${pull.length}점 · 제일 많이 끌린 축 ${Math.max(0, ...pull.map(p => Math.max(p.du, p.dv)))}m · ` +
     JSON.stringify(yanked.slice(0, 3)));

  /* ══ S 추천 자리는 안 움직인다 ═══════════════════════════════════════ */
  const slots = await page.eval(`(() => {
    const v = window.view, rc = document.getElementById('roomCanvas').getBoundingClientRect();
    const rows = [];
    for (const s of v.slots()) {
      const sp = v.screenPosOf(s.slotId);
      if (!sp) { rows.push({ id: s.slotId, err: '화면에 안 잡힘' }); continue; }
      const t = v.surfaceAt(rc.left + sp.x, rc.top + sp.y, { potD: 0.202 });
      rows.push({ id: s.slotId, ok: t.ok, snappedTo: t.snappedTo,
                  dx: +(t.x - s.pos.x).toFixed(6), dy: +(t.y - s.pos.y).toFixed(6),
                  dz: +(t.z - s.pos.z).toFixed(6),
                  got: { x: t.x, y: t.y, z: t.z, occIdx: t.occIdx },
                  want: { x: s.pos.x, y: s.pos.y, z: s.pos.z } });
    }
    return rows;
  })()`);
  const moved = slots.filter(r => r.err || !(r.dx === 0 && r.dy === 0 && r.dz === 0));
  ok('S-1 추천 자리 정중앙을 쏘면 좌표가 한 톨도 안 움직인다 (dx=dy=dz=0)',
     slots.length >= 14 && moved.length === 0,
     `${slots.length - moved.length}/${slots.length} · 움직인 것 ` + JSON.stringify(moved.slice(0, 3)));

  /* 좌표가 그대로면 DLI 도 그대로다 — 조도는 처음부터 좌표 함수였다(light_adapter.dliAt).
     ★ 「그럴 것이다」로 두지 않고 **재서** 확인한다. 재는 것은 두 값이다.
         계약값   dliOfSlot(slotId)          추천 자리 목록을 타는 길 (세이브·DLI·자리 등급)
         좌표값   dliAt(surfaceAt 이 낸 자리) 격자를 거쳐 놓았을 때의 길
       이 둘이 **정확히 같아야** 격자가 자리를 안 건드린 것이다. 반올림 여유를 안 준다. */
  const dli = await page.eval(`(() => {
    const v = window.view, e = window.engine;
    if (!e || !e.room) return { err: '조도 엔진이 안 붙었습니다' };
    const rc = document.getElementById('roomCanvas').getBoundingClientRect();
    const o = { weather: 'clear', season: 'summer', lampCount: 0, litHours: 12 };
    const rows = [];
    for (const s of v.slots()) {
      const sp = v.screenPosOf(s.slotId);
      if (!sp) continue;
      const t = v.surfaceAt(rc.left + sp.x, rc.top + sp.y, { potD: 0.202 });
      const a = e.dliOfSlot(s.slotId, o);
      const b = e.dliAt({ x: t.x, y: t.y, z: t.z }, { ...o, occIdx: t.occIdx }).dli;
      rows.push({ id: s.slotId, slot: a, surf: b, same: a === b });
    }
    return { rows };
  })()`);
  if (dli.err) ok('S-2 추천 자리 DLI 가 좌표 DLI 와 정확히 같다', false, dli.err);
  else {
    const diff = dli.rows.filter(r => !r.same);
    ok('S-2 추천 자리 DLI 가 그 좌표의 DLI 와 **정확히** 같다 (격자가 자리를 안 건드린다)',
       dli.rows.length >= 14 && diff.length === 0,
       `${dli.rows.length - diff.length}/${dli.rows.length} · 다른 것 ` + JSON.stringify(diff.slice(0, 3)));
    console.log('      추천 자리 DLI — ' +
      dli.rows.slice(0, 6).map(r => `${r.id} ${r.slot.toFixed(2)}`).join(' · '));
  }

  /* ══ T 시루 무리 ══════════════════════════════════════════════════════
     ★ 회전무관 지름 규약 그대로다 — 12개 무리는 지름이 커진다(0.97m). 격자 한 칸에
       안 들어간다고 못 놓게 만들면 안 된다. 걸음은 자리의 간격이지 크기 한도가 아니다. */
  const siru = await page.eval(`(() => {
    const v = window.view, rc = document.getElementById('roomCanvas').getBoundingClientRect();
    const st = v.grid().step, out = [];
    for (let i = 2; i < 15; i++) for (let j = 10; j < 23; j++) {
      const t = v.surfaceAt(rc.left + rc.width * i / 16, rc.top + rc.height * j / 24, { potD: 0.97 });
      if (!t.ok) continue;
      out.push({ x: t.x, z: t.z, onUid: t.onUid, snappedTo: t.snappedTo,
                 offX: Math.abs(t.x / st - Math.round(t.x / st)),
                 offZ: Math.abs(t.z / st - Math.round(t.z / st)) });
    }
    return out;
  })()`);
  /* ★ 바닥 자리만 방 격자 배수다. 상판은 **그 가구 한가운데**가 원점이라 방 격자와 어긋나는
     게 정상이고(Q-2 가 상판 쪽을 따로 잰다), 0.97m 무리는 어느 상판에도 한 칸이 안 나와
     상판 한가운데 하나로 앉는다. 그걸 방 격자로 재면 틀렸다고 말하게 된다. */
  const siruFloor = siru.filter(s => !s.snappedTo && s.onUid === null);
  ok('T-1 시루 무리(지름 0.97m)도 놓을 자리가 있다',
     siru.length > 0, `${siru.length}곳 (바닥 자유 좌표 ${siruFloor.length}곳)`);
  ok('T-2 시루 무리의 바닥 좌표도 같은 걸음 배수다',
     siruFloor.length > 0 && siruFloor.every(s => s.offX * 0.125 < MULT_EPS && s.offZ * 0.125 < MULT_EPS),
     `${siruFloor.length}곳 · 최대 어긋남 ` +
     (Math.max(0, ...siruFloor.map(s => Math.max(s.offX, s.offZ))) * 0.125).toExponential(1) + 'm');

  /* ══ U 자리 네모의 크기 ═══════════════════════════════════════════════
     ★ 박사님 2026-08-07: *"책상이랑 서랍장 위에는 여전히 저래."* 금색 네모가 상판을
       통째로 덮고 있었다. 크기를 **그 자리의 maxPotD**(책상 0.57)로 재고 있었기 때문이다.
       네모는 「그 물건이 실제로 먹는 자리」여야 한다 — 끌고 있는 것의 지름으로 잰다. */
  const marks = await page.eval(`(() => {
    const v = window.view, out = [];
    for (const potD of [0.202, 0.24, 0.97]) {
      v.showSlotRings(true, { potD });
      const st = v.slotRings();
      out.push({ potD, halves: [...new Set(st.map(r => r.half))], n: st.length });
    }
    v.showSlotRings(false);
    return out;
  })()`);
  /* 격자 칸에 물린 반너비 = ceil 아닌 round 로 칸을 센다(room_view.squareHalf) */
  const wantHalf = potD => Math.max(1, Math.round(potD / 0.25)) * 0.25 / 2;
  const badMark = marks.filter(m => m.halves.length !== 1
                                 || Math.abs(m.halves[0] - wantHalf(m.potD)) > 1e-6);
  ok('U-1 자리 네모 크기가 **끌고 있는 것**으로 정해진다 (자리마다 다르지 않다)',
     marks.length === 3 && badMark.length === 0,
     marks.map(m => `${m.potD} → ${JSON.stringify(m.halves)} (기대 ${wantHalf(m.potD)})`).join(' | '));
  ok('U-2 시루 한 개(0.24m)면 한 칸 · 무리(0.97m)면 네 칸이다',
     marks[0] && marks[1] && marks[2] &&
     marks[1].halves[0] === 0.125 && marks[2].halves[0] === 0.5,
     marks.map(m => `${m.potD} → 반너비 ${m.halves[0]}m`).join(' · '));

  /* ══ V 바닥 턱(걸레받이) ══════════════════════════════════════════════
     ★ 박사님 2026-08-07: *"저 바닥에 턱을 좀 없애줄래? 가구가 박혀버리네."*
       벽 안쪽 면보다 방 안으로 튀어나온 **바닥에 붙은 띠**가 없어야 한다.
     ⚠ 벽 두께(WT 0.2)는 안 건드린다 — 방 치수가 바뀌면 조도·자리·세이브가 흔들린다.
       그래서 재는 것은 「벽 안쪽 면(치수/2 − 0.1)보다 안쪽으로 튀어나온 것이 있나」다. */
  const ledge = await page.eval(`(() => {
    const v = window.view, b = v.roomSize(), out = [];
    const inX = b.w / 2 - 0.1, inZ = b.d / 2 - 0.1;      // 벽 안쪽 면
    v.three.scene.traverse(o => {
      if (!o.isMesh || !o.geometry || !o.geometry.parameters) return;
      const p = o.geometry.parameters;
      if (!(p.height > 0.02 && p.height < 0.40)) return;                 // 낮은 띠
      if (!(Math.min(p.width, p.depth) < 0.12)) return;                  // 얇은 띠
      if (Math.max(p.width, p.depth) < 0.5) return;                      // 길게 도는 것만
      const w = new THREE.Vector3(); o.updateWorldMatrix(true, false); o.getWorldPosition(w);
      if (Math.abs(w.y - p.height / 2) > 0.03) return;                   // 바닥에 붙은 것만
      /* 벽 안쪽 면보다 **방 안쪽**으로 넘어온 양. 얇은 축이 벽에 수직인 축이다. */
      const into = (p.width < p.depth)
        ? inX - (Math.abs(w.x) - p.width / 2)      // 좌·우 벽을 따라 도는 띠
        : inZ - (Math.abs(w.z) - p.depth / 2);     // 앞·뒤 벽을 따라 도는 띠
      if (into > 0.002) out.push({ w: p.width, h: p.height, d: p.depth,
                                   x: +w.x.toFixed(3), z: +w.z.toFixed(3), into: +into.toFixed(3) });
    });
    return out;
  })()`);
  ok('V-1 벽 안쪽 면보다 방 안으로 튀어나온 바닥 턱이 없다',
     ledge.length === 0, `${ledge.length}조각 — ` + JSON.stringify(ledge.slice(0, 3)));

  ok('H 콘솔에 처리 안 된 예외가 없다', errs.length === 0, errs.slice(0, 3).join(' | '));

  await page.close();
  console.log(`\nplace_grid: ${fail === 0 ? 'PASS' : 'FAIL'}  (${pass}/${pass + fail})`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
