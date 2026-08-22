/* ============================================================
   tools/probe_lampaim.mjs — **집게등을 실제로 겨눠서 어디에 붙나**
   ------------------------------------------------------------
   `tools/probe_lampfit.mjs`(house)는 `lampFit` 을 **베껴 적어** 재는 자다. 그래서
   「고치면 100% 가 된다」는 말해 주지만 **게임이 실제로 고쳐졌는지는 못 말한다.**
   여기는 game.html 을 띄워 **화면의 그 손짓**(`furnPicked.lampDragTo`)을 부른다.

     python tools/serve.py 8972 .
     BYEOT_URL=http://localhost:8972 node tools/probe_lampaim.mjs

   ★ 겨누는 곳은 **화면 좌표**다 — 사람이 손가락을 얹는 그 점이다.
   ⚠ 서버가 없으면 **즉시 죽는다**(멈추지 않는다).
============================================================ */
import { launch, sleep } from './test_cdp.mjs';

const BASE = process.env.BYEOT_URL || 'http://localhost:8972';
const CLIP = process.env.BYEOT_LAMP || 'banjiha-growlight-clip';
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 300000);
wd.unref && wd.unref();

try {
  const r = await fetch(`${BASE}/game.html`, { method: 'HEAD' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
} catch (e) {
  console.error(`✘ ${BASE} 에 game.html 이 없습니다 — ${e.message}`);
  console.error('  python tools/serve.py 8972 . 를 먼저 띄우십시오.');
  process.exit(2);
}
console.log(`■ 보고 있는 서버 — ${BASE}`);

const page = await launch({ width: 390, height: 844, dpr: 2 });
await page.goto(`${BASE}/game.html`);
await page.eval('localStorage.clear()', false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 150000, 300);
await sleep(5000);

/* 한 점을 겨눠 보고 **어디에 붙을지**를 돌려준다 — 붙는 곳은 `commitLampAt(uid, ghost)` 이
   쓰는 그 `ghost` 로 판정한다(미리보기와 붙는 곳이 같은 값이라는 것도 여기서 같이 재진다). */
const aimAt = async (slotId) => page.eval(`(()=>{
  const rv = window.__rv, F = window.__furn;
  const c = document.getElementById('roomCanvas').getBoundingClientRect();
  let sp = null; try { sp = rv.screenPosOf(${JSON.stringify(slotId)}); } catch(e) { return JSON.stringify({err:e.message}); }
  if (!sp) return JSON.stringify({err:'화면 위치를 못 얻었습니다: ' + ${JSON.stringify(slotId)}});
  F.uid = ${JSON.stringify(CLIP)}; F.mode = 'lampmove';
  try { F.beginLampMove(); } catch(e) { return JSON.stringify({err:'beginLampMove ' + e.message}); }
  F.originX = 0; F.originY = 0;              /* 절대 화면 좌표로 겨눈다 */
  try { F.lampDragTo(c.left + sp.x, c.top + sp.y); } catch(e) { return JSON.stringify({err:'lampDragTo ' + e.message}); }
  const g = F.ghost;
  let fit = null; try { fit = g ? rv.lampFit(${JSON.stringify(CLIP)}, g) : null; } catch(e) { fit = {err:e.message}; }
  return JSON.stringify({ ghost: g, mount: fit && fit.mountId, ok: fit && fit.ok,
                          label: (document.getElementById('dropLabel')||{}).textContent });
})()`);

const nodeY = await page.eval(`(()=>{ try {
  const m=(window.__rv.lampMounts()||[]); return JSON.stringify(m.map(x=>({id:x.mountId,y:x.y})));
} catch(e){ return '[]' } })()`);
console.log('  물릴 수 있는 상판 —', nodeY);

const TARGETS = ['banjiha-sill:0', 'banjiha-etagere:0', 'banjiha-desk:0', 'banjiha-dresser:0', 'banjiha-nightstand:0'];
const out = [];
for (const t of TARGETS) {
  const r = JSON.parse(await aimAt(t));
  const want = t.slice(0, t.lastIndexOf(':'));
  const got = r.mount ? String(r.mount).split('@')[0] : null;
  const ok = got === want;
  out.push({ t, want, got, ok, ghostY: r.ghost && r.ghost.y, err: r.err, label: r.label });
  console.log(`${ok ? '✔' : '✘'} ${t} 를 겨눔 → ${got || r.err || '없음'}` +
              (r.ghost && r.ghost.y != null ? ` (넘긴 높이 ${r.ghost.y})` : ' (높이를 안 넘김)'));
}

/* ★ 되먹임 — 서랍장에 한 번 붙였다가 창턱을 다시 겨눈다 */
await page.eval(`(()=>{ try { const m=(window.__rv.lampMounts()||[])
  .find(x=>String(x.mountId).startsWith('banjiha-dresser@'));
  if (m) window.__rv.commitLampAt(${JSON.stringify(CLIP)}, { mountId: m.mountId, lift: 0 }); } catch {} })()`, false);
await sleep(800);
const again = JSON.parse(await aimAt('banjiha-sill:0'));
const againOk = again.mount && String(again.mount).startsWith('banjiha-sill@');
console.log(`${againOk ? '✔' : '✘'} 되먹임 — 서랍장에 붙인 뒤 창턱을 다시 겨눔 → ` +
            (again.mount ? String(again.mount).split('@')[0] : again.err));

const bad = out.filter(x => !x.ok).length + (againOk ? 0 : 1);
console.log(`\n합계 — ${TARGETS.length + 1 - bad}/${TARGETS.length + 1} 맞음`);
await page.close();
clearTimeout(wd);
process.exit(bad ? 1 : 0);
