/* ============================================================
   tools/probe_qa_perf.mjs — 언제 프레임이 떨어지나를 **숫자로** 잰다 (QA 전용)
   rAF 간격과 longtask 를 페이지 안에서 직접 재고, 동작마다 구간을 끊어 최악값을 낸다.
============================================================ */
import { launch, sleep } from './test_cdp.mjs';
import fs from 'node:fs';

const _WATCHDOG_MS = +(process.env.BYEOT_PROBE_TIMEOUT_MS || 900000);
const _wd = setTimeout(() => { console.error('⏱ 자가 제한을 넘겨 멈춥니다.'); process.exit(2); }, _WATCHDOG_MS);
_wd.unref && _wd.unref();
process.on('exit', () => clearTimeout(_wd));

const BASE = process.env.BYEOT_URL || 'https://chunryou-delicate.github.io/lux-plant-sim';
const CPU = +(process.env.QA_CPU || 1);
const OUT = 'docs/engine/shots/qa';
const TAG = process.env.QA_TAG || ('perf-cpu' + CPU);

const page = await launch({ width: 390, height: 844, dpr: 2, mobile: true,
  throttle: CPU > 1 ? { cpu: CPU } : null });
await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });

const cap = (label, pr, ms = 20000) => Promise.race([pr,
  new Promise(r => { const t = setTimeout(() => { console.error('  ⏱멈춤 ' + label); r('TIMEOUT'); }, ms); t.unref && t.unref(); })]);
const down = (x, y) => cap('down', page.send('Input.dispatchTouchEvent',
  { type: 'touchStart', touchPoints: [{ x, y, id: 1, radiusX: 8, radiusY: 8, force: 1 }] }));
const move = (x, y) => cap('move', page.send('Input.dispatchTouchEvent',
  { type: 'touchMove', touchPoints: [{ x, y, id: 1, radiusX: 8, radiusY: 8, force: 1 }] }));
const up = () => cap('up', page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }));
const rectOf = id => cap('rect', page.eval(`(()=>{const e=document.getElementById(${JSON.stringify(id)});
  if(!e) return null; const r=e.getBoundingClientRect();
  return {x:r.left+r.width/2,y:r.top+r.height/2,vis:e.offsetParent!==null&&r.width>0,dis:!!e.disabled};})()`))
  .then(v => v === 'TIMEOUT' ? null : v);
async function tapXY(x, y, hold = 70, after = 200) { await down(Math.round(x), Math.round(y)); await sleep(hold); await up(); await sleep(after); }
async function tap(id) { const r = await rectOf(id); if (!r || !r.vis || r.dis) return { id, ok: false, r }; await tapXY(r.x, r.y); return { id, ok: true }; }

const T = []; const log = s => { T.push(s); console.log(s); };

await page.goto(`${BASE}/game.html`); await sleep(1800);
await page.eval(`(()=>{try{localStorage.clear()}catch(e){}})()`, false);
await page.goto(`${BASE}/game.html`);
await page.waitFor(`!!window.__rv`, 600000, 500); await sleep(3000);

/* ── 프레임 재기 설치 ── */
await page.eval(`(()=>{ const P = window.__perf = { f: [], long: [], mark: [], last: performance.now() };
  const tick = () => { const t = performance.now(); P.f.push(t - P.last); P.last = t; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) P.long.push([Math.round(e.startTime), Math.round(e.duration)]); })
        .observe({ entryTypes: ['longtask'] }); } catch(e) { P.noLongtask = String(e); }
  P.cut = (ko) => { const f=P.f.splice(0); f.sort((a,b)=>b-a);
    const n=f.length, sum=f.reduce((a,b)=>a+b,0);
    return { 구간:ko, 프레임수:n, 초:+(sum/1000).toFixed(1),
             평균fps:+(n/(sum/1000)).toFixed(1),
             /* ⚠ 숫자로 시작하는 이름은 **따옴표 없이 객체 열쇠로 못 쓴다** — 여기서
                Uncaught SyntaxError 가 나서 이 자가 17초 만에 즉사하고 있었다(2026-08-23 [growth]).
                판이 아니라 자가 죽은 것이고, 스크립트로 돌리면 그냥 빨간 줄 하나로 지나간다. */
             최악ms:+(f[0]||0).toFixed(0), '2위':+(f[1]||0).toFixed(0), '3위':+(f[2]||0).toFixed(0),
             '16ms초과':f.filter(x=>x>16.7).length, '100ms초과':f.filter(x=>x>100).length,
             '1초초과':f.filter(x=>x>1000).length }; };
})()`, false);
const cut = ko => cap('cut', page.eval(`window.__perf.cut(${JSON.stringify(ko)})`)).then(v => v === 'TIMEOUT' ? { 구간: ko, err: 'TIMEOUT' } : v);

async function clearTalk(max = 25) {
  for (let i = 0; i < max; i++) {
    if (!await page.eval(`document.getElementById('stage').classList.contains('talking')`)) return;
    const r = await rectOf('dlgBox'); if (!(r && r.vis)) break; await tapXY(r.x, r.y, 60, 250);
  }
}
await sleep(2500); log('① 대사 대기 ' + JSON.stringify(await cut('대사 떠 있는 동안')));
await clearTalk();
{ const g = await rectOf('guideClose'); if (g && g.vis) await tapXY(g.x, g.y); }
await sleep(3000); log('② 가만히 ' + JSON.stringify(await cut('아무것도 안 함 3초')));

/* 방을 손가락으로 돌린다 */
await down(195, 500); await sleep(60);
for (let i = 0; i < 20; i++) { await move(195 + i * 7, 500); await sleep(30); }
await up(); await sleep(600);
log('③ 방 돌리기 ' + JSON.stringify(await cut('방 회전 드래그')));

/* 가방을 연다 */
await tap('openBag'); await sleep(1200);
log('④ 가방 열기 ' + JSON.stringify(await cut('가방 열기')));

/* ★시루 끌기 — 여기가 제일 무겁다 */
const th = await rectOf('cropThumb');
if (th && th.vis) {
  const t0 = Date.now();
  await down(Math.round(th.x), Math.round(th.y)); await sleep(250);
  log('   drag.begin 뒤 ' + JSON.stringify(await cut('drag.begin')));
  for (let i = 1; i <= 8; i++) {
    const mt = Date.now();
    await move(Math.round(th.x + (195 - th.x) * i / 8), Math.round(th.y + (430 - th.y) * i / 8));
    log(`   move#${i} 응답 ${Date.now() - mt}ms`);
    await sleep(40);
  }
  log('   끄는 중 ' + JSON.stringify(await cut('끄는 동안 8번')));
  const ut = Date.now(); await up();
  log(`   touchend 응답 ${Date.now() - ut}ms · 총 ${Date.now() - t0}ms`);
  await sleep(2500);
  log('⑤ 놓기 ' + JSON.stringify(await cut('놓은 뒤')));
}
await clearTalk();

/* 하루 넘기기 */
for (let i = 0; i < 3; i++) {
  await cut('버림');
  const t0 = Date.now(); await tap('next'); await sleep(2500); await clearTalk();
  log(`⑥ 다음날 ${i + 1} (${Date.now() - t0}ms) ` + JSON.stringify(await cut('다음 날')));
}

/* 물 주기 — 캐릭터가 걷는 동안 */
{
  await cut('버림');
  const r = await rectOf('waterCrop');
  if (r && r.vis && !r.dis) { await tapXY(r.x, r.y); await sleep(5000); await clearTalk();
    log('⑦ 물 주기(걷기+모션) ' + JSON.stringify(await cut('물 주기'))); }
  else log('⑦ 물 주기 못 함 ' + JSON.stringify(r));
}

/* 확대 화면 */
{
  await cut('버림');
  const t0 = Date.now();
  await page.eval(`(()=>{try{window.__byeotZoom.open()}catch(e){}})()`, false);
  await sleep(4000);
  log(`⑧ 확대 열기(${Date.now() - t0}ms) ` + JSON.stringify(await cut('확대 화면')));
  await page.shot(`${OUT}/${TAG}_zoom.png`);
  /* 확대 안에서 돌려 보기 */
  await down(195, 500); await sleep(60);
  for (let i = 0; i < 16; i++) { await move(195 + i * 8, 500); await sleep(30); }
  await up(); await sleep(800);
  log('⑨ 확대에서 회전 ' + JSON.stringify(await cut('확대 회전')));
  await page.eval(`(()=>{try{window.__byeotZoom.close()}catch(e){}})()`, false);
  await sleep(1500);
}

/* 빨리감기 */
{
  await cut('버림');
  const fr = await tap('ff'); await sleep(6000);
  log('⑩ 빨리감기 ' + JSON.stringify(fr) + ' ' + JSON.stringify(await cut('빨리감기')));
  await tap('ff'); await sleep(1000); await clearTalk();
}

const lt = await page.eval(`(()=>{const P=window.__perf; return {longtask수:P.long.length,
  최악:P.long.slice().sort((a,b)=>b[1]-a[1]).slice(0,8), noLongtask:P.noLongtask||null};})()`);
log('longtask ' + JSON.stringify(lt));
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(`${OUT}/${TAG}_log.txt`, T.join('\n'), 'utf8');
await page.close();
