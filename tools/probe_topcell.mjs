/* 상판 칸이 실제 상판을 벗어나나 — 박사님 "격자가 상판보다 크다"(두 번 지적)
   ------------------------------------------------------------
   ⚠ 여기서 재는 것은 셋이고 **서로 다른 것**이다. 섞어 읽으면 또 헛짚는다.
     ① 가구 크기   `userData.size` — 상점·조도가 쓰는 값
     ② 상판 메시   meshRect(눈에 보이는 판때기) — 칸이 깔리는 바탕
     ③ 칸          guideCells() — ②를 surfaceAxis 로 나눈 것
   ①≠② 면 「격자가 상판보다 크다」가 조도 쪽에서 나온 것이고,
   ②≠③ 면 그리는 쪽이다. 갈라 놓지 않으면 어느 쪽인지 모른다. */
import { launch, sleep } from './test_cdp.mjs';

const _WATCHDOG_MS = +(process.env.BYEOT_PROBE_TIMEOUT_MS || 300000);
const _wd = setTimeout(() => { console.error('⏱ 자가 제한 초과'); process.exit(2); }, _WATCHDOG_MS);
_wd.unref && _wd.unref();
process.on('exit', () => clearTimeout(_wd));

const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const POTD = +(process.env.BYEOT_POTD || 0.20);

const page = await launch({ width: 1280, height: 900, dpr: 1, mobile: false });
await page.goto(`${BASE}/game.html`);
await page.eval(`localStorage.clear()`, false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 180000, 300);
await page.waitFor('window.__byeotBooted === true', 180000, 300);
await sleep(7000);
/* 말풍선·안내가 떠 있으면 방이 안 보인다 — 걷어낸다 */
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
  const rv = window.__rv, io = window.__io;
  const potD = ${POTD};
  rv.showSlotRings(true, { potD });
  const cells = rv.guideCells({ potD });
  /* 가구가 스스로 말하는 크기 */
  const furn = (io.light.furnitureList() || []).map(f => ({ uid: f.uid, preset: f.preset, x: f.x, z: f.z }));
  /* 칸을 상판(uid+rect)별로 묶는다 */
  const by = new Map();
  for (const c of cells) {
    const k = (c.uid || 'x') + '@' + c.y;
    if (!by.has(k)) by.set(k, { uid: c.uid, y: c.y, rectW: c.rectW, rectD: c.rectD, cw: c.cw, cd: c.cd, n: 0,
                                us: [], vs: [], snapErrMax: 0, ng: 0 });
    const g = by.get(k);
    g.n++; g.us.push(c.u); g.vs.push(c.v);
    g.snapErrMax = Math.max(g.snapErrMax, c.snapErr || 0);
    if (!c.fits) g.ng++;
  }
  const rows = [];
  for (const g of by.values()) {
    /* 칸이 덮는 바깥 끝 = |가장 바깥 칸 한가운데| + 칸/2. 상판 반너비보다 크면 삐져나온 것이다 */
    const uOut = Math.max(...g.us.map(Math.abs)) + g.cw / 2;
    const vOut = Math.max(...g.vs.map(Math.abs)) + g.cd / 2;
    const f = furn.find(x => x.uid === g.uid) || {};
    rows.push({
      uid: g.uid, preset: f.preset || null, y: g.y, 칸수: g.n,
      상판: [+g.rectW.toFixed(4), +g.rectD.toFixed(4)],
      칸크기: [+g.cw.toFixed(4), +g.cd.toFixed(4)],
      칸이덮는범위: [+(uOut * 2).toFixed(4), +(vOut * 2).toFixed(4)],
      삐져나옴: [+(uOut * 2 - g.rectW).toFixed(4), +(vOut * 2 - g.rectD).toFixed(4)],
      못앉는칸: g.ng, snapErrMax: +g.snapErrMax.toFixed(6)
    });
  }
  /* ② 상판 메시 vs ① 가구 크기 — 가구 그룹을 훑어 제일 높은 위로 향한 면을 찾는다 */
  const sizes = [];
  for (const f of furn) {
    const s = rv.__furnSize ? rv.__furnSize(f.uid) : null;
    sizes.push({ uid: f.uid, preset: f.preset, size: s });
  }
  return JSON.stringify({ potD, rows, sizes }, null, 1);
} catch (e) { return 'ERR ' + e.message + '\\n' + e.stack; } })()`);
console.log(out);

await sleep(1200);
await page.shot(process.argv[2] || 'docs/handoff/img/topcell/cells_potd020.png');
await page.close();
