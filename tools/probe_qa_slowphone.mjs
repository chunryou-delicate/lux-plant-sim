/* tools/probe_qa_slowphone.mjs — 느린 폰에서 "물 주면 캐릭이 걸어가나"만 본다 (QA 전용)
   CPU 4배 느리게. 물 주기를 세 번(회전 3번) 눌러 매번 걸었는지 잰다. */
import { launch, sleep } from './test_cdp.mjs';
import fs from 'node:fs';

const _WATCHDOG_MS = +(process.env.BYEOT_PROBE_TIMEOUT_MS || 1500000);
const _wd = setTimeout(() => { console.error('⏱ 자가 제한을 넘겨 멈춥니다.'); process.exit(2); }, _WATCHDOG_MS);
_wd.unref && _wd.unref();
process.on('exit', () => clearTimeout(_wd));

const BASE = process.env.BYEOT_URL || 'https://chunryou-delicate.github.io/lux-plant-sim';
const CPU = +(process.env.QA_CPU || 4);
const OUT = 'docs/engine/shots/qa';
const TAG = process.env.QA_TAG || ('slow-cpu' + CPU);

const page = await launch({ width: 390, height: 844, dpr: 2, mobile: true, throttle: { cpu: CPU } });
await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
const errs = [];
page.on((m, p) => { if (m === 'Runtime.exceptionThrown')
  errs.push(((p.exceptionDetails.text || '') + ' ' + ((p.exceptionDetails.exception || {}).description || '')).slice(0, 200)); });

const cap = (l, pr, ms = 30000) => Promise.race([pr,
  new Promise(r => { const t = setTimeout(() => { console.error('  ⏱멈춤 ' + l); r('TIMEOUT'); }, ms); t.unref && t.unref(); })]);
const down = (x, y) => cap('down', page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1, radiusX: 8, radiusY: 8, force: 1 }] }));
const mv = (x, y) => cap('move', page.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y, id: 1, radiusX: 8, radiusY: 8, force: 1 }] }));
const up = () => cap('up', page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }));
const rectOf = id => cap('rect:' + id, page.eval(`(()=>{const e=document.getElementById(${JSON.stringify(id)});
  if(!e) return null; const r=e.getBoundingClientRect();
  return {x:r.left+r.width/2,y:r.top+r.height/2,vis:e.offsetParent!==null&&r.width>0,dis:!!e.disabled,
          txt:(e.textContent||'').trim().slice(0,30)};})()`)).then(v => v === 'TIMEOUT' ? null : v);
async function tapXY(x, y, hold = 90, after = 300) { await down(Math.round(x), Math.round(y)); await sleep(hold); await up(); await sleep(after); }
async function tap(id) { const r = await rectOf(id); if (!r) return { id, ok: false, why: '없음' };
  if (!r.vis) return { id, ok: false, why: '안보임' }; if (r.dis) return { id, ok: false, why: '비활성', txt: r.txt };
  await tapXY(r.x, r.y); return { id, ok: true, txt: r.txt }; }
async function clearTalk(max = 30) {
  for (let i = 0; i < max; i++) {
    if (!await page.eval(`document.getElementById('stage').classList.contains('talking')`)) return;
    const r = await rectOf('dlgBox'); if (!(r && r.vis)) break; await tapXY(r.x, r.y, 70, 350);
  }
}
const T = []; const log = s => { T.push(s); console.log(s); };

await page.goto(`${BASE}/game.html`); await sleep(3000);
await page.eval(`(()=>{try{localStorage.clear()}catch(e){}})()`, false);
const t0 = Date.now();
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 300000, 500);
log(`CPU x${CPU} 부팅 ${Date.now() - t0}ms`);
await sleep(6000);
await page.eval(`(()=>{ window.__qa={acts:[]}; const rv=window.__rv; if(!rv||!rv.actAt){window.__qa.no=1;return;}
  const o=rv.actAt.bind(rv);
  rv.actAt=function(k,kind,opt){ const rec={key:k,kind,t:Date.now(),walk:0,done:false,fail:null};
    window.__qa.acts.push(rec);
    return o(k,kind,Object.assign({},opt,{
      onProgress:(p,ph)=>{ if(ph==='walk') rec.walk=Math.max(rec.walk,p); rec.phase=ph; opt&&opt.onProgress&&opt.onProgress(p,ph); },
      onDone:()=>{ rec.done=true; rec.ms=Date.now()-rec.t; opt&&opt.onDone&&opt.onDone(); },
      onFail:(w)=>{ rec.fail=String(w); rec.ms=Date.now()-rec.t; opt&&opt.onFail&&opt.onFail(w); } })); }; })()`, false);
await clearTalk();
{ const g = await rectOf('guideClose'); if (g && g.vis) await tapXY(g.x, g.y); }

/* 시루를 놓는다 */
await tap('openBag'); await sleep(1200);
const th = await rectOf('cropThumb');
if (th && th.vis) {
  await down(Math.round(th.x), Math.round(th.y)); await sleep(300);
  for (let i = 1; i <= 10; i++) { await mv(Math.round(th.x + (195 - th.x) * i / 10), Math.round(th.y + (430 - th.y) * i / 10)); await sleep(60); }
  await up(); await sleep(4000);
}
await clearTalk();
log('시루 놓음 ' + JSON.stringify(await page.eval(`(()=>{const b=window.__S().firstPlay.beansprout;
  return {slotId:b.slotId, at:!!b.at};})()`)));

let seen = 0;
for (let d = 0; d < 14; d++) {
  const p0 = await cap('p0', page.eval(`(()=>{try{const p=window.__rv.characters().find(c=>c.id==='jachwi').pos;
    return {x:+p.x.toFixed(2),z:+p.z.toFixed(2)}}catch(e){return null}})()`));
  const w = await tap('waterCrop');
  if (w.ok) {
    await sleep(1200);
    const mid = await cap('mid', page.eval(`(()=>({bar:document.getElementById('actBar').offsetParent!==null,
      ko:(document.getElementById('actBar').querySelector('b')||{}).textContent}))()`));
    await sleep(9000);
    const p1 = await cap('p1', page.eval(`(()=>{try{const p=window.__rv.characters().find(c=>c.id==='jachwi').pos;
      return {x:+p.x.toFixed(2),z:+p.z.toFixed(2)}}catch(e){return null}})()`));
    const acts = await cap('acts', page.eval(`window.__qa.acts.slice(${seen})`)); seen += (acts && acts.length) || 0;
    const dist = (p0 && p1 && p0.x !== undefined && p1.x !== undefined) ? Math.hypot(p1.x - p0.x, p1.z - p0.z) : null;
    log(`물주기 #${d}: 게이지=${JSON.stringify(mid)} 이동=${dist == null ? '?' : dist.toFixed(2)} actAt=${JSON.stringify(acts)}`);
    await page.shot(`${OUT}/${TAG}_water${d}.png`);
  }
  await clearTalk();
  await tap('next'); await sleep(4000); await clearTalk();
  const h = await tap('harvestCrop');
  if (h.ok) { await sleep(9000); await clearTalk();
    const acts = await cap('acts2', page.eval(`window.__qa.acts.slice(${seen})`)); seen += (acts && acts.length) || 0;
    log(`거두기: ${JSON.stringify(h)} actAt=${JSON.stringify(acts)}`); }
  const s = await cap('s', page.eval(`(()=>{const S=window.__S(),b=S.firstPlay.beansprout;
    return {day:S.day,회전:b.harvestCount,재고:S.shop.stock};})()`));
  log(`  ${JSON.stringify(s)}`);
  if (s && s.회전 >= 1 && d > 6) break;
}
log('예외 ' + JSON.stringify(errs.slice(0, 6)));
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(`${OUT}/${TAG}_log.txt`, T.join('\n'), 'utf8');
await page.close();
