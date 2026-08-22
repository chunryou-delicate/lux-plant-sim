/* tools/probe_qa_ghostmouse.mjs — 터치로 고른 것이 **유령 마우스**에 풀리나 (QA 전용)
   ★진짜 터치 입력이라 크롬이 touchend 뒤에 호환 mousedown/mouseup/click 을 실제로 쏜다.
   화분이 오기 전에도 되는 시험이라 첫 화면에서 바로 돌린다 — 가구와 캐릭터를 고른다. */
import { launch, sleep } from './test_cdp.mjs';
import fs from 'node:fs';

const _WATCHDOG_MS = +(process.env.BYEOT_PROBE_TIMEOUT_MS || 1200000);
const _wd = setTimeout(() => { console.error('⏱ 자가 제한을 넘겨 멈춥니다.'); process.exit(2); }, _WATCHDOG_MS);
_wd.unref && _wd.unref();
process.on('exit', () => clearTimeout(_wd));

const BASE = process.env.BYEOT_URL || 'https://chunryou-delicate.github.io/lux-plant-sim';
const OUT = 'docs/engine/shots/qa';
const TAG = process.env.QA_TAG || 'ghost';

const page = await launch({ width: 390, height: 844, dpr: 2, mobile: true });
await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
const errs = [];
page.on((m, p) => { if (m === 'Runtime.exceptionThrown')
  errs.push(((p.exceptionDetails.text || '') + ' ' + ((p.exceptionDetails.exception || {}).description || '')).slice(0, 200)); });

const cap = (l, pr, ms = 20000) => Promise.race([pr,
  new Promise(r => { const t = setTimeout(() => { console.error('  ⏱멈춤 ' + l); r('TIMEOUT'); }, ms); t.unref && t.unref(); })]);
const down = (x, y) => cap('down', page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1, radiusX: 8, radiusY: 8, force: 1 }] }));
const up = () => cap('up', page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }));
const rectOf = id => cap('rect:' + id, page.eval(`(()=>{const e=document.getElementById(${JSON.stringify(id)});
  if(!e) return null; const r=e.getBoundingClientRect();
  return {x:r.left+r.width/2,y:r.top+r.height/2,vis:e.offsetParent!==null&&r.width>0,dis:!!e.disabled};})()`))
  .then(v => v === 'TIMEOUT' ? null : v);
async function tapXY(x, y, hold = 80, after = 250) { await down(Math.round(x), Math.round(y)); await sleep(hold); await up(); await sleep(after); }
async function clearTalk(max = 30) {
  for (let i = 0; i < max; i++) {
    if (!await page.eval(`document.getElementById('stage').classList.contains('talking')`)) return;
    const r = await rectOf('dlgBox'); if (!(r && r.vis)) break; await tapXY(r.x, r.y, 70, 300);
  }
}
const T = []; const log = s => { T.push(s); console.log(s); };

await page.goto(`${BASE}/game.html`); await sleep(2000);
await page.eval(`(()=>{try{localStorage.clear()}catch(e){}})()`, false);
await page.goto(`${BASE}/game.html`);
await page.waitFor(`!!window.__rv`, 600000, 500); await sleep(4000);
log('부팅 끝');
await clearTalk();
{ const g = await rectOf('guideClose'); if (g && g.vis) await tapXY(g.x, g.y); }

/* 쏘아진 이벤트를 모두 적어 둔다 — 유령 마우스가 진짜로 오는지 눈으로 본다 */
await page.eval(`(()=>{ window.__ev=[]; const c=document.getElementById('roomCanvas');
  ['touchstart','touchend','pointerdown','pointerup','mousedown','mouseup','click'].forEach(t=>{
    c.addEventListener(t, e=>window.__ev.push(t+(e.pointerType?':'+e.pointerType:'')), true); });
})()`, false);

const st = () => page.eval(`(()=>{const v=id=>{const e=document.getElementById(id);
    return !!(e&&e.offsetParent!==null)};
  return { 가구판:v('furnActions'), 가구이름:(document.getElementById('furnName')||{}).textContent,
           화분판:v('plantActions'),
           고른캐릭:(()=>{try{return window.__rv.selectedCharacter()}catch(e){return 'ERR'}})() };})()`);

/* ── ① 가구를 터치로 고른다 ── */
const spots = [[195, 660], [150, 620], [260, 600], [230, 700], [120, 690], [300, 660]];
for (const [x, y] of spots) {
  await page.eval(`window.__ev=[]`, false);
  await tapXY(x, y, 90, 500);
  const a = await st();
  await sleep(1400);                       /* ★유령 마우스가 오는 시간을 준다 */
  const b = await st();
  const ev = await page.eval(`window.__ev.join(' ')`);
  log(`가구탭 (${x},${y}) 바로=${JSON.stringify(a)} 1.4초뒤=${JSON.stringify(b)}`);
  log(`        이벤트: ${ev}`);
  if (a.가구판) { await page.shot(`${OUT}/${TAG}_furn_${x}_${y}.png`); break; }
}

/* ── ② 캐릭터를 터치로 고른다 ── */
{
  const p = await cap('char', page.eval(`(()=>{try{const c=document.getElementById('roomCanvas').getBoundingClientRect();
    const s=window.__rv.characterScreenPos('jachwi'); return {x:c.left+s.x, y:c.top+s.y};}catch(e){return {err:String(e)}}})()`));
  log('캐릭터 화면좌표 ' + JSON.stringify(p));
  if (p && p.x) {
    await page.eval(`(()=>{try{window.__rv.selectCharacter(null)}catch(e){}})()`, false);
    await page.eval(`window.__ev=[]`, false);
    await tapXY(p.x, p.y, 90, 400);
    const a = await st();
    await sleep(1500);
    const b = await st();
    log(`캐릭터탭 바로=${JSON.stringify(a)} 1.5초뒤=${JSON.stringify(b)}`);
    log('        이벤트: ' + await page.eval(`window.__ev.join(' ')`));
    await page.shot(`${OUT}/${TAG}_char.png`);
  }
}

/* ── ③ 시루를 놓고, 놓인 시루를 터치로 고를 수 있나 ── */
{
  const ob = await rectOf('openBag'); if (ob && ob.vis) await tapXY(ob.x, ob.y, 80, 800);
  const th = await rectOf('cropThumb');
  if (th && th.vis) {
    await down(Math.round(th.x), Math.round(th.y)); await sleep(250);
    for (let i = 1; i <= 10; i++) {
      await cap('move', page.send('Input.dispatchTouchEvent', { type: 'touchMove',
        touchPoints: [{ x: Math.round(th.x + (195 - th.x) * i / 10), y: Math.round(th.y + (430 - th.y) * i / 10), id: 1 }] }));
      await sleep(50);
    }
    await up(); await sleep(3500);
  }
  await clearTalk();
  const sp = await cap('crop', page.eval(`(()=>{try{const c=document.getElementById('roomCanvas').getBoundingClientRect();
    const b=window.__S().firstPlay.beansprout; const k=b.slotId||'free:crop_01';
    const p=window.__rv.screenPosOf(k); return p?{x:c.left+p.x,y:c.top+p.y,key:k}:{none:k};}catch(e){return {err:String(e)}}})()`));
  log('시루 화면좌표 ' + JSON.stringify(sp));
  if (sp && sp.x) {
    await page.eval(`window.__ev=[]`, false);
    await tapXY(sp.x, sp.y, 90, 400);
    const a = await st();
    await sleep(1500);
    const b = await st();
    log(`시루탭 바로=${JSON.stringify(a)} 1.5초뒤=${JSON.stringify(b)}`);
    log('        이벤트: ' + await page.eval(`window.__ev.join(' ')`));
    await page.shot(`${OUT}/${TAG}_crop.png`);
  }
}

log('예외 ' + JSON.stringify(errs.slice(0, 6)));
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(`${OUT}/${TAG}_log.txt`, T.join('\n'), 'utf8');
await page.close();
