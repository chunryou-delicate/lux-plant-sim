/* tools/probe_qa_firstrun.mjs — 가방에 있는 [▶ 첫 플레이 자동 시뮬레이션]을 눌러 본다 (QA 전용)
   플레이어가 가방을 열면 보이는 초록 버튼이다. 누르면 무슨 일이 나나. */
import { launch, sleep } from './test_cdp.mjs';
import fs from 'node:fs';

const _WATCHDOG_MS = +(process.env.BYEOT_PROBE_TIMEOUT_MS || 1200000);
const _wd = setTimeout(() => { console.error('⏱ 자가 제한을 넘겨 멈춥니다.'); process.exit(2); }, _WATCHDOG_MS);
_wd.unref && _wd.unref();
process.on('exit', () => clearTimeout(_wd));

const BASE = process.env.BYEOT_URL || 'https://chunryou-delicate.github.io/lux-plant-sim';
const OUT = 'docs/engine/shots/qa';
const TAG = process.env.QA_TAG || 'firstrun';

const page = await launch({ width: 390, height: 844, dpr: 2, mobile: true });
await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
const errs = [];
page.on((m, p) => { if (m === 'Runtime.exceptionThrown')
  errs.push(((p.exceptionDetails.text || '') + ' ' + ((p.exceptionDetails.exception || {}).description || '')).slice(0, 300)); });

const cap = (l, pr, ms = 20000) => Promise.race([pr,
  new Promise(r => { const t = setTimeout(() => { console.error('  ⏱멈춤 ' + l); r('TIMEOUT'); }, ms); t.unref && t.unref(); })]);
const down = (x, y) => cap('down', page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1, radiusX: 8, radiusY: 8, force: 1 }] }));
const mv = (x, y) => cap('move', page.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y, id: 1, radiusX: 8, radiusY: 8, force: 1 }] }));
const up = () => cap('up', page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }));
const rectOf = id => cap('rect:' + id, page.eval(`(()=>{const e=document.getElementById(${JSON.stringify(id)});
  if(!e) return null; const r=e.getBoundingClientRect();
  return {x:r.left+r.width/2,y:r.top+r.height/2,w:+r.width.toFixed(0),h:+r.height.toFixed(0),
          vis:e.offsetParent!==null&&r.width>0,dis:!!e.disabled,txt:(e.textContent||'').trim().slice(0,40)};})()`))
  .then(v => v === 'TIMEOUT' ? null : v);
async function tapXY(x, y, hold = 80, after = 300) { await down(Math.round(x), Math.round(y)); await sleep(hold); await up(); await sleep(after); }
async function tap(id) { const r = await rectOf(id); if (!r) return { id, ok: false, why: '없음' };
  if (!r.vis) return { id, ok: false, why: '안보임' }; if (r.dis) return { id, ok: false, why: '비활성', txt: r.txt };
  await tapXY(r.x, r.y); return { id, ok: true, txt: r.txt }; }
async function clearTalk(max = 30) {
  for (let i = 0; i < max; i++) {
    if (!await page.eval(`document.getElementById('stage').classList.contains('talking')`)) return;
    const r = await rectOf('dlgBox'); if (!(r && r.vis)) break; await tapXY(r.x, r.y, 70, 300);
  }
}
const st = () => page.eval(`(()=>{const S=window.__S(),b=S.firstPlay.beansprout;
  const v=id=>{const e=document.getElementById(id); return e?[e.offsetParent!==null,!!e.disabled]:null};
  return {day:S.day, 돈:S.tutorial.cashWon, 회전:b.harvestCount, 시루자리:b.slotId||(b.at?'자유':null),
    화분:S.pots.length, 재고:S.shop.stock,
    hardLock:document.body.dataset.hardLock||null,
    btn:{next:v('next'),ff:v('ff'),firstRun:v('firstRun'),play:v('play')},
    firstResult:(document.getElementById('firstResult').textContent||'').trim().slice(0,120),
    err:document.querySelectorAll('.err').length,
    저장:(()=>{try{const r=localStorage.getItem('byeot/save/1');return r?JSON.parse(r).state.day:null}catch(e){return 'x'}})()};})()`);
const T = []; const log = s => { T.push(s); console.log(s); };

await page.goto(`${BASE}/game.html`); await sleep(2000);
await page.eval(`(()=>{try{localStorage.clear()}catch(e){}})()`, false);
await page.goto(`${BASE}/game.html`);
await page.waitFor(`!!window.__rv`, 600000, 500); await sleep(4000);
await clearTalk();
{ const g = await rectOf('guideClose'); if (g && g.vis) await tapXY(g.x, g.y); }

/* 시루를 놓고 며칠 굴려 "플레이 중인 판"을 만든다 */
await tap('openBag'); await sleep(800);
const th = await rectOf('cropThumb');
if (th && th.vis) {
  await down(Math.round(th.x), Math.round(th.y)); await sleep(250);
  for (let i = 1; i <= 12; i++) { await mv(Math.round(th.x + (195 - th.x) * i / 12), Math.round(th.y + (430 - th.y) * i / 12)); await sleep(45); }
  await up(); await sleep(3000);
}
await clearTalk();
await tap('waterCrop'); await sleep(6000); await clearTalk();
for (let i = 0; i < 2; i++) { await tap('next'); await sleep(2500); await clearTalk(); }
const before = await st();
log('누르기 전 ' + JSON.stringify(before));
await page.shot(`${OUT}/${TAG}_before.png`);

/* ★가방을 열고 초록 버튼을 손가락으로 누른다 */
await tap('openBag'); await sleep(900);
const fr = await rectOf('firstRun');
log('[첫 플레이 자동 시뮬레이션] 버튼 ' + JSON.stringify(fr));
await page.shot(`${OUT}/${TAG}_button.png`);
if (fr && fr.vis && !fr.dis) {
  await tapXY(fr.x, fr.y, 80, 1500);
  await sleep(12000);
  await clearTalk();
  const after = await st();
  log('누른 뒤 ' + JSON.stringify(after));
  log('예외 ' + JSON.stringify(errs.slice(0, 6)));
  await page.shot(`${OUT}/${TAG}_after.png`);
  /* 판이 다시 굴러가나 */
  const n = await tap('next'); await sleep(3000); await clearTalk();
  const after2 = await st();
  log(`그 뒤 [다음 날] ${JSON.stringify(n)} → 일 ${after.day}→${after2.day} hardLock=${after2.hardLock}`);
  await page.shot(`${OUT}/${TAG}_after_next.png`);
} else log('누를 수 없었다');

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(`${OUT}/${TAG}_log.txt`, T.join('\n'), 'utf8');
await page.close();
