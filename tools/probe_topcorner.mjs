/* 「격자가 상판보다 크다」를 좌표로 가른다.
   상판 칸이 앉은 자리(guideCells)와 **가구가 실제로 서 있는 자리**(rv.furniture())를 견준다.
   ⚠ 눈으로 보면 3/4 시점 때문에 늘 어긋나 보인다 — 그래서 좌표로 잰다. */
import { launch, sleep } from './test_cdp.mjs';
const _wd = setTimeout(() => { console.error('⏱ 자가 제한 초과'); process.exit(2); }, 300000);
_wd.unref && _wd.unref(); process.on('exit', () => clearTimeout(_wd));

const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const POTD = +(process.env.BYEOT_POTD || 0.20);

const page = await launch({ width: 1280, height: 900, dpr: 3, mobile: false });
await page.goto(`${BASE}/game.html`);
await page.eval(`localStorage.clear()`, false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 180000, 300);
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

const out = await page.eval(`(()=>{ try {
  const rv = window.__rv;
  const potD = ${POTD};
  rv.showSlotRings(true, { potD });
  const cells = rv.guideCells({ potD });
  const rings = rv.slotRings();
  const furn = rv.furniture();
  const by = new Map();
  for (const c of cells) {
    const k = (c.uid || 'x') + '@' + c.y;
    if (!by.has(k)) by.set(k, { uid: c.uid, y: c.y, w: c.rectW, d: c.rectD, cw: c.cw, cd: c.cd, xs: [], zs: [] });
    const g = by.get(k); g.xs.push(c.x); g.zs.push(c.z);
  }
  const rows = [];
  for (const g of by.values()) {
    const f = furn.find(x => x.uid === g.uid) || null;
    /* 칸이 덮는 월드 범위 = 칸 한가운데의 최소·최대 ± 칸/2. 회전은 90° 단위라 축이 안 섞인다. */
    const xr = [Math.min(...g.xs), Math.max(...g.xs)];
    const zr = [Math.min(...g.zs), Math.max(...g.zs)];
    rows.push({
      uid: g.uid, y: g.y, 칸수: g.xs.length,
      가구: f ? { x: f.x, z: f.z, rot: f.rot, size: [f.size.w, f.size.d] } : null,
      상판rect: [+g.w.toFixed(4), +g.d.toFixed(4)], 칸: [+g.cw.toFixed(4), +g.cd.toFixed(4)],
      칸중심x: [+xr[0].toFixed(4), +xr[1].toFixed(4)],
      칸중심z: [+zr[0].toFixed(4), +zr[1].toFixed(4)],
      /* 칸 무리의 한가운데 — 가구 한가운데와 다르면 그만큼 상판을 벗어나 있다 */
      칸무리중심: [+((xr[0] + xr[1]) / 2).toFixed(4), +((zr[0] + zr[1]) / 2).toFixed(4)]
    });
  }
  return JSON.stringify({ potD, rows,
    링: rings.map(r => ({ id: r.slotId, half: r.half, halfV: r.halfV, fits: r.fits })) }, null, 1);
} catch (e) { return 'ERR ' + e.message + '\\n' + e.stack; } })()`);
console.log(out);
await sleep(800);
await page.shot(process.argv[2] || 'docs/handoff/img/topcell/corners.png');
await page.close();
