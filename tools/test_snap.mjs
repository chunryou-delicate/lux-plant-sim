/* ============================================================
   test_snap.mjs — 옮길 때의 걸음(SNAP_DIV) · 화면 없이 잰다
   ------------------------------------------------------------
   박사님 지시(2026-08-06): "이동을 한 격자 단위나 1/2 격자 단위로 옮겨지게 하자."

   증명하려는 것은 넷이다.
     A  걸음을 안 주면 예전(place.snapSpan · 0.05m)과 **한 자리도 안 다르다**
     B  걸음을 주면 발자국 앞 모서리가 그 걸음 선에 정확히 떨어진다
     C  걸음 안에서 끌면 안 움직이고, 걸음을 넘기면 딱 한 걸음 움직인다 (계단이다)
     D  걸음을 바꾸는 손잡이는 SNAP_DIV 하나뿐이다 (한 칸 = 반 칸의 두 배)

   ★ 화면을 안 띄운다. room_view.js 가 내보내는 스냅 함수를 그대로 불러서 잰다 —
     크롬을 띄우면 이 셈이 맞는지가 아니라 크롬이 뜨는지를 재게 된다.
   ⚠ room_view.js 는 house.js 를 통해 전역 THREE 를 쓴다. test_free_place.mjs 와
     **같은 방법**으로 vendor/three 를 올린다(스텁을 새로 짜면 두 벌이 된다).

     node tools/test_snap.mjs
============================================================ */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const toUrl = rel => 'file:///' + path.join(ROOT, rel).replace(/\\/g, '/');

/* ── 캔버스·문서 스텁 (test_free_place.mjs 와 같은 최소 흉내) ── */
const stubCtx = () => new Proxy({}, {
  get: (t, k) => {
    if (k === 'createImageData' || k === 'getImageData')
      return (w = 1, h = 1) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h });
    if (k === 'createLinearGradient' || k === 'createRadialGradient')
      return () => ({ addColorStop() {} });
    if (k === 'measureText') return () => ({ width: 0 });
    return () => {};
  }
});
const stubEl = () => ({ style: {}, dataset: {}, appendChild() {}, setAttribute() {},
                        addEventListener() {}, getContext: () => stubCtx() });
globalThis.document = {
  createElement: t => (t === 'canvas'
    ? { width: 1, height: 1, style: {}, getContext: () => stubCtx(), toDataURL: () => '' }
    : stubEl()),
  createElementNS: () => stubEl(),
  addEventListener() {}, getElementById: () => null,
  querySelector: () => null, querySelectorAll: () => [],
  body: stubEl(), documentElement: stubEl()
};
globalThis.window = globalThis;
globalThis.self = globalThis;
vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'vendor', 'three', 'three.min.js'), 'utf8'));

const { GRID_UNIT, GRID_CELL, snapSpan, unitsFor } = await import(toUrl('src/game/place.js'));
const { SNAP_DIV, MOVE_STEP, snapSpanStep } = await import(toUrl('src/game/room_view.js'));

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log(`PASS  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}${detail ? '  — ' + detail : ''}`); }
};

/* 이 저장소에 실제로 있는 치수들 — 지어낸 숫자가 아니다(docs/handoff/roomview-grid.md 표) */
const SIZES = [
  ['침대',        1.10], ['침대(깊이)', 2.00], ['책상', 1.20], ['책상(깊이)', 0.60],
  ['서랍장',      0.90], ['의자',       0.44], ['선반', 0.72], ['창턱 받침',  0.36],
  ['몬스테라 화분', 0.202], ['식물등-바', 0.70], ['식물등-클립', 0.20]
];
const CENTERS = [-2.37, -1.04, -0.33, 0, 0.07, 0.41, 1.13, 2.28];
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

/* ══ A 걸음을 안 주면 예전 그대로 ══════════════════════════════════════════ */
{
  const bad = [];
  for (const [ko, size] of SIZES) for (const c of CENTERS) {
    const was = snapSpan(c, size), now = snapSpanStep(c, size);
    if (!near(was, now)) bad.push(`${ko} ${c} → ${was} ≠ ${now}`);
  }
  ok('A-1 걸음을 안 주면 place.snapSpan 과 같은 값이다 (예전 길이 그대로)',
     bad.length === 0, bad.slice(0, 3).join(' · '));
  ok('A-2 걸음을 0.05 로 명시해도 같다',
     SIZES.every(([, s]) => CENTERS.every(c => near(snapSpanStep(c, s, GRID_UNIT), snapSpan(c, s)))));
}

/* ══ B 걸음을 주면 앞 모서리가 그 선에 떨어진다 ═════════════════════════════ */
{
  for (const div of [1, 2]) {
    const step = GRID_CELL / div;
    const bad = [];
    for (const [ko, size] of SIZES) for (const c of CENTERS) {
      const x = snapSpanStep(c, size, step);
      const edge = x - unitsFor(size, GRID_UNIT) * GRID_UNIT / 2;   // 발자국 앞 모서리
      const k = edge / step;
      if (!near(k, Math.round(k), 1e-9)) bad.push(`${ko} ${c} → 모서리 ${edge.toFixed(6)}`);
    }
    ok(`B-${div} 걸음 ${step}m 에서 발자국 앞 모서리가 격자선에 떨어진다`,
       bad.length === 0, bad.slice(0, 3).join(' · '));
  }
}

/* ══ C 계단이다 — 걸음 안에서는 안 움직이고, 넘기면 딱 한 걸음 ═══════════════ */
{
  const step = MOVE_STEP, size = 1.10;           // 침대 한 변
  const base = snapSpanStep(0, size, step);
  const still = [], jump = [];
  for (let i = 1; i <= 40; i++) {
    const d = (step / 2) * (i / 41);             // 한 걸음의 절반 아래로만 민다
    if (!near(snapSpanStep(base + d, size, step), base)) still.push(d.toFixed(4));
    if (!near(snapSpanStep(base - d, size, step), base)) still.push((-d).toFixed(4));
  }
  for (let n = 1; n <= 8; n++) {
    const got = snapSpanStep(base + step * n, size, step);
    if (!near(got, base + step * n, 1e-9)) jump.push(`${n}걸음 → ${got}`);
  }
  ok('C-1 걸음의 절반 안에서 끌면 제자리다 (덜덜 안 떨린다)', still.length === 0,
     still.slice(0, 3).join(' · '));
  ok('C-2 걸음을 n 번 넘기면 정확히 n 걸음 간다', jump.length === 0, jump.slice(0, 3).join(' · '));

  /* 걸음 사이의 어떤 값도 걸음 격자 위에만 선다 */
  const offs = [];
  for (let i = 0; i < 200; i++) {
    const x = snapSpanStep(-2.5 + i * 0.0237, size, step);
    const edge = (x - unitsFor(size, GRID_UNIT) * GRID_UNIT / 2) / step;
    if (!near(edge, Math.round(edge), 1e-9)) offs.push(x);
  }
  ok('C-3 어떤 좌표를 넣어도 걸음 격자 밖에는 안 선다 (200점)', offs.length === 0,
     offs.slice(0, 3).join(' · '));
}

/* ══ D 손잡이는 SNAP_DIV 하나 ═══════════════════════════════════════════════ */
{
  ok('D-1 MOVE_STEP 은 보이는 칸(0.25m)을 SNAP_DIV 로 나눈 값이다',
     near(MOVE_STEP, GRID_CELL / SNAP_DIV), `SNAP_DIV=${SNAP_DIV} · MOVE_STEP=${MOVE_STEP}`);
  ok('D-2 기본은 반 칸 0.125m 다 (SNAP_DIV = 2)',
     SNAP_DIV === 2 && near(MOVE_STEP, 0.125), `${MOVE_STEP}m`);
  /* place.cellBox 는 i0 = round((x − n·u/2)/u) 로 칸 번호를 낸다. 그 나눗셈이 딱 떨어지면
     칸 번호가 **어림이 아니라 정확한 값**이고, 겹침 판정이 한 치도 안 흔들린다. */
  const cellIndexExact = (x, size, u = GRID_UNIT) => {
    const k = (x - unitsFor(size, u) * u / 2) / u;
    return near(k, Math.round(k), 1e-9);
  };
  ok('D-3 한 칸(0.25m)이면 칸 번호가 정확한 정수다 — 0.25 는 0.05 의 배수라서',
     SIZES.every(([, s]) => CENTERS.every(c => cellIndexExact(snapSpanStep(c, s, GRID_CELL), s))));
  /* ⚠ 반 칸(0.125m)은 0.05 의 배수가 아니다. 모르고 쓰면 place.cellBox 의 칸 번호가
     반올림으로 최대 0.025m 어긋난다 — 알고 쓰는 것과 모르고 쓰는 것은 다르므로 못 박는다. */
  const halfOff = [];
  for (const [ko, s] of SIZES) for (const c of CENTERS)
    if (!cellIndexExact(snapSpanStep(c, s, MOVE_STEP), s)) halfOff.push(ko);
  ok('D-4 ⚠ 반 칸은 칸 번호가 반올림된다 (겹침 판정이 최대 0.025m 어긋난다 — 알고 쓴다)',
     halfOff.length > 0, `어림으로 세는 자리 ${halfOff.length}/${SIZES.length * CENTERS.length}`);
}

/* ══ E 던져야 할 때 던진다 ═════════════════════════════════════════════════ */
{
  const throws = fn => { try { fn(); return false; } catch { return true; } };
  ok('E-1 좌표가 유한하지 않으면 던진다', throws(() => snapSpanStep(NaN, 1, MOVE_STEP))
     && throws(() => snapSpanStep(Infinity, 1, MOVE_STEP)));
  ok('E-2 걸음이 0 이하면 던진다', throws(() => snapSpanStep(0, 1, 0))
     && throws(() => snapSpanStep(0, 1, -0.1)));
}

console.log(`\nsnap: ${fail ? 'FAIL' : 'PASS'}  (${pass}/${pass + fail})`);
process.exit(fail ? 1 : 0);
