/* 책상이 **바닥 격자에서 몇 칸을 먹나** (박사님 2026-08-18:
     *"밑에 그리드는 2*6 차지하는 거 같은데 상판은 2×5 크기인 거 같아서"*)
   ------------------------------------------------------------
   ⚠ 여기서 재는 것은 **셋이고 서로 다른 것**이다.
     ① 상판 칸   가구 상판을 제 눈금으로 나눈 것 (가구 한가운데에 물려 있다)
     ② 바닥 격자 **방 원점**에 물려 있다 — 가구와 위상이 다를 수 있다
     ③ 발자국    가구가 실제로 덮는 x·z 구간
   ①과 ③이 같아도 ②의 선이 어긋나 있으면 「바닥에서 한 칸 더 먹는」 그림이 된다. */
import { launch, sleep } from './test_cdp.mjs';
const _wd = setTimeout(() => { console.error('⏱ 자가 제한 초과'); process.exit(2); }, 300000);
_wd.unref && _wd.unref(); process.on('exit', () => clearTimeout(_wd));

const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const page = await launch({ width: 1280, height: 900, dpr: 2, mobile: false });
await page.goto(`${BASE}/game.html`);
await page.eval(`localStorage.clear()`, false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('window.__byeotBooted === true', 180000, 300);
await sleep(7000);
for (let i = 0; i < 40; i++) {
  const busy = await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');
    return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`);
  if (!busy) break;
  await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s)s.click();
    const b=document.getElementById('dlgBox'); if(b)b.click();
    const g=document.getElementById('guideClose'); if(g)g.click();})()`, false);
  await sleep(250);
}

console.log(await page.eval(`(()=>{ try {
  const rv = window.__rv;
  const g = rv.grid();
  const f = rv.furniture().find(x => x.uid === 'banjiha-desk');
  const cell = g.cell;
  const R = g.room;
  /* ⚠⚠ 격자 원점을 **밖에서 다시 계산하지 않는다.** 그렇게 짰다가 자가 옛 식을 들고 있어
     고친 뒤에도 「그대로다」로 나왔다(2026-08-18 · 실제로 났다). 엔진이 낸 값을 읽는다. */
  const x0 = R.origin ? R.origin.x : null, z0 = R.origin ? R.origin.z : null;
  const nx = R.cols, nz = R.rows;
  if (x0 == null) return 'ERR grid().room.origin 이 없다 — room_view 가 안 내준다';
  /* 가구 발자국 (rot 0 이라 축이 안 섞인다 — 90° 면 w·d 를 바꿔야 한다) */
  const rot = Math.round((f.rot || 0) / 90) % 2;
  const fw = rot ? f.size.d : f.size.w, fd = rot ? f.size.w : f.size.d;
  const xa = f.x - fw / 2, xb = f.x + fw / 2, za = f.z - fd / 2, zb = f.z + fd / 2;
  /* 그 구간이 걸치는 칸 번호 — 경계에 딱 맞으면 그 칸은 안 센다(1e-6) */
  const span = (a, b, o) => {
    const i0 = Math.floor((a - o) / cell + 1e-6), i1 = Math.ceil((b - o) / cell - 1e-6);
    return { i0, i1, n: i1 - i0, 선: [+(o + i0 * cell).toFixed(4), +(o + i1 * cell).toFixed(4)] };
  };
  return JSON.stringify({
    칸크기: cell,
    방안쪽: R.inner, 바닥칸수: [nx, nz], 바닥격자원점: [+x0.toFixed(4), +z0.toFixed(4)],
    책상: { x: f.x, z: f.z, rot: f.rot, size: [f.size.w, f.size.d] },
    발자국x: [+xa.toFixed(4), +xb.toFixed(4)], 발자국z: [+za.toFixed(4), +zb.toFixed(4)],
    걸치는칸x: span(xa, xb, x0), 걸치는칸z: span(za, zb, z0),
    상판칸: (() => { const c = rv.guideCells({ potD: 0.20 }).filter(c => c.uid === 'banjiha-desk');
      const xs = [...new Set(c.map(v => v.x))].sort((a, b) => a - b);
      const zs = [...new Set(c.map(v => v.z))].sort((a, b) => a - b);
      return { 가로: xs.length, 세로: zs.length, x: xs, z: zs }; })()
  }, null, 1);
} catch (e) { return 'ERR ' + e.message + '\\n' + e.stack; } })()`));

/* 그림도 남긴다 — 바닥 격자를 켜고 책상 밑을 본다 */
await page.eval(`window.__rv.showGrid(true, { uid: 'banjiha-desk' })`, false);
await sleep(1200);
await page.shot(process.argv[2] || 'docs/handoff/img/topcell/floorspan.png');
await page.close();
