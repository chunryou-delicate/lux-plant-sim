/* ============================================================
   tools/probe_qa_break.mjs — 배포본을 **부수려고** 눌러 본다 (QA 전용, 읽기만)
   진짜 터치 입력(CDP Input.dispatchTouchEvent)만 쓴다.
============================================================ */
import { launch, sleep } from './test_cdp.mjs';
import fs from 'node:fs';

const _WATCHDOG_MS = +(process.env.BYEOT_PROBE_TIMEOUT_MS || 1500000);
const _wd = setTimeout(() => { console.error('⏱ 자가 제한을 넘겨 멈춥니다.'); process.exit(2); }, _WATCHDOG_MS);
_wd.unref && _wd.unref();
process.on('exit', () => clearTimeout(_wd));

const BASE = process.env.BYEOT_URL || 'https://chunryou-delicate.github.io/lux-plant-sim';
const CPU = +(process.env.QA_CPU || 1);
const OUT = 'docs/engine/shots/qa';
const TAG = process.env.QA_TAG || ('break-cpu' + CPU);

const page = await launch({ width: 390, height: 844, dpr: 2, mobile: true,
  throttle: CPU > 1 ? { cpu: CPU } : null });
await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });

const errs = [], warns = [];
page.on((m, p) => {
  if (m === 'Runtime.exceptionThrown')
    errs.push(((p.exceptionDetails.text || '') + ' ' + ((p.exceptionDetails.exception || {}).description || '')).slice(0, 300));
  if (m === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(p.type))
    warns.push(p.type + ': ' + (p.args || []).map(a => a.value ?? a.description ?? a.type).join(' ').slice(0, 200));
});

/* CDP 는 렌더러가 이벤트를 삼킬 때까지 답을 안 준다 — 시한을 걸어 둔다 */
const cap = (label, pr, ms = 15000) => Promise.race([pr,
  new Promise(r => { const t = setTimeout(() => { console.error('  ⏱멈춤 ' + label); r('TIMEOUT'); }, ms); t.unref && t.unref(); })]);
const touchDown = (x, y) => cap('down', page.send('Input.dispatchTouchEvent',
  { type: 'touchStart', touchPoints: [{ x, y, id: 1, radiusX: 8, radiusY: 8, force: 1 }] }));
const touchMove = (x, y) => cap('move', page.send('Input.dispatchTouchEvent',
  { type: 'touchMove', touchPoints: [{ x, y, id: 1, radiusX: 8, radiusY: 8, force: 1 }] }));
const touchUp = () => cap('up', page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }));
async function tapXY(x, y, hold = 70, after = 180) {
  await touchDown(Math.round(x), Math.round(y)); await sleep(hold);
  await touchUp(); await sleep(after);
}
async function dragXY(x0, y0, x1, y1, steps = 14, holdMs = 150) {
  await touchDown(Math.round(x0), Math.round(y0)); await sleep(holdMs);
  for (let i = 1; i <= steps; i++) {
    await touchMove(Math.round(x0 + (x1 - x0) * i / steps), Math.round(y0 + (y1 - y0) * i / steps));
    await sleep(35);
  }
  await sleep(150); await touchUp(); await sleep(400);
}
const rectOf = id => cap('rect:' + id, page.eval(`(()=>{const e=document.getElementById(${JSON.stringify(id)});
  if(!e) return null; const r=e.getBoundingClientRect();
  return {x:r.left+r.width/2, y:r.top+r.height/2, w:+r.width.toFixed(1), h:+r.height.toFixed(1),
          vis:e.offsetParent!==null && r.width>0, dis:!!e.disabled, txt:(e.textContent||'').trim().slice(0,30)};})()`))
  .then(v => v === 'TIMEOUT' ? null : v);
async function tap(id, hold = 70, after = 180) {
  const r = await rectOf(id);
  if (!r) return { id, ok: false, why: '없음' };
  if (!r.vis) return { id, ok: false, why: '안보임' };
  if (r.dis) return { id, ok: false, why: '비활성', txt: r.txt };
  await tapXY(r.x, r.y, hold, after);
  return { id, ok: true, txt: r.txt };
}
const st = () => page.eval(`(()=>{ const S=window.__S(); const fp=S.firstPlay||{}, b=fp.beansprout||{};
  const v=id=>{const e=document.getElementById(id); return e?[e.offsetParent!==null, !!e.disabled, (e.textContent||'').trim().slice(0,30)]:null;};
  return { day:S.day, 돈:S.tutorial&&S.tutorial.cashWon, 회전:b.harvestCount,
    시루:(b.pots||[]).length, 물준날:b.wateredOnDay, 나이:b.ageDays, 거둠:b.harvested,
    화분:(S.pots||[]).length, 삽수:(S.cuttings||[]).length,
    재고:S.shop&&S.shop.stock, 주문:(S.shop&&S.shop.orders||[]).map(o=>o.itemId+'@'+o.arrivesOnDay),
    hardLock:document.body.dataset.hardLock||null,
    stage:document.getElementById('stage').className,
    btn:{next:v('next'),ff:v('ff'),water:v('waterCrop'),harv:v('harvestCrop'),sow:v('resow')},
    marks:(()=>{try{return window.__marks.list().map(m=>m.ko)}catch(e){return ['?']}})(),
    banner:(document.getElementById('event').textContent||'').trim().slice(0,90) }; })()`);
async function clearTalk(max = 25) {
  for (let i = 0; i < max; i++) {
    if (!await page.eval(`document.getElementById('stage').classList.contains('talking')`)) return i;
    const r = await rectOf('dlgBox'); if (!(r && r.vis)) break;
    await tapXY(r.x, r.y, 60, 250);
  }
  return -1;
}
const T = []; const log = (...a) => { const s = a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' '); T.push(s); console.log(s); };

/* ── 부팅 ── */
await page.goto(`${BASE}/game.html`); await sleep(1800);
await page.eval(`(()=>{try{localStorage.clear()}catch(e){}})()`, false);
await page.goto(`${BASE}/game.html`);
await page.waitFor(`!!window.__rv`, 600000, 500); await sleep(3500);
await clearTalk();
{ const g = await rectOf('guideClose'); if (g && g.vis) await tapXY(g.x, g.y); }

/* ── 시루 놓기 ── */
await tap('openBag'); await sleep(600);
const th = await rectOf('cropThumb');
if (th && th.vis) await dragXY(th.x, th.y, 195, 430, 16, 200);
await sleep(1200); await clearTalk();
log('A. 시루 놓음 ' + JSON.stringify(await st()));

/* ══ 시험 1 — [다음 날]을 빨리 두 번 ══ */
{
  const s0 = await st();
  const r = await rectOf('next');
  await touchDown(Math.round(r.x), Math.round(r.y)); await sleep(50); await touchUp();
  await sleep(70);
  await touchDown(Math.round(r.x), Math.round(r.y)); await sleep(50); await touchUp();
  await sleep(2500); await clearTalk();
  const s1 = await st();
  log(`시험1 [다음날] 연타: 일 ${s0.day}→${s1.day} (기대 +1) hardLock=${s1.hardLock} 배너=${s1.banner}`);
}

/* ══ 시험 2 — [물 주기]를 빨리 두 번 ══ */
{
  await clearTalk();
  const s0 = await st();
  const r = await rectOf('waterCrop');
  if (r && r.vis && !r.dis) {
    await touchDown(Math.round(r.x), Math.round(r.y)); await sleep(50); await touchUp();
    await sleep(90);
    await touchDown(Math.round(r.x), Math.round(r.y)); await sleep(50); await touchUp();
    await sleep(5000); await clearTalk();
    const s1 = await st();
    log(`시험2 [물주기] 연타: 물준날 ${s0.물준날}→${s1.물준날} 나이 ${s0.나이}→${s1.나이} hardLock=${s1.hardLock} 배너=${s1.banner}`);
    log('       actAt 호출수 ' + await page.eval(`(window.__qaActs||[]).length||'미계측'`));
  } else log('시험2 건너뜀 — 물주기 버튼 상태 ' + JSON.stringify(r));
}

/* ══ 시험 3 — 동작 중에 다른 버튼 ══ */
{
  await clearTalk();
  const s0 = await st();
  const r = await rectOf('waterCrop');
  if (r && r.vis && !r.dis) {
    await tapXY(r.x, r.y, 60, 400);          /* 물 주기 시작 — 캐릭터가 걷는 중 */
    const mid = await page.eval(`document.getElementById('actBar').offsetParent!==null`);
    const nr = await tap('next');            /* 걷는 도중 다음 날 */
    await sleep(5000); await clearTalk();
    const s1 = await st();
    log(`시험3 동작중 [다음날]: 게이지떴나=${mid} 눌림=${JSON.stringify(nr)} 일 ${s0.day}→${s1.day} 물준날 ${s0.물준날}→${s1.물준날} hardLock=${s1.hardLock}`);
  } else log('시험3 건너뜀 ' + JSON.stringify(r));
}

/* ══ 시험 4 — 돈을 다 쓰고 주문 ══ */
{
  await page.eval(`(()=>{ window.__byeotSheet.open(); window.__byeotSheet.tab('room'); })()`, false);
  await sleep(700);
  const before = await st();
  /* 소지금을 700원 밑으로 내린다 — 상태만 만지고(플레이로는 며칠이 걸린다) 그 뒤엔 손으로 누른다 */
  await page.eval(`(()=>{ window.__S().tutorial.cashWon = 300; })()`, false);
  await sleep(400);
  await page.eval(`(()=>{ try{ window.__byeotSheet.tab('room'); }catch(e){} })()`, false);
  /* 다시 그리게 아무 것도 안 바뀌는 조작 하나 */
  await tap('tabBag'); await sleep(300); await tap('tabRoom'); await sleep(600);
  const shopBtn = await page.eval(`(()=>{ const b=document.querySelector('[data-buy="bean_seed"]');
    if(!b) return null; const r=b.getBoundingClientRect();
    return {x:r.left+r.width/2,y:r.top+r.height/2,vis:b.offsetParent!==null,dis:!!b.disabled,
            txt:(b.textContent||'').trim().slice(0,40), title:b.title||''};})()`);
  log('시험4 돈 300원일 때 [콩 씨앗] 버튼 ' + JSON.stringify(shopBtn));
  if (shopBtn && shopBtn.vis) { await tapXY(shopBtn.x, shopBtn.y); await sleep(900); }
  const s1 = await st();
  log(`       누른 뒤: 돈=${s1.돈} hardLock=${s1.hardLock} next=${JSON.stringify(s1.btn.next)} 배너=${s1.banner}`);
  /* 돈을 되돌린다 — 이 뒤 시험이 돈 때문에 막히면 안 된다 */
  await page.eval(`(()=>{ window.__S().tutorial.cashWon = ${before.돈}; })()`, false);
  await page.eval(`(()=>{ window.__byeotSheet.close(); })()`, false); await sleep(500);
}

/* ══ 시험 5 — 대사창이 떠 있을 때 뒤를 누르면 ══ */
{
  const talking = await page.eval(`document.getElementById('stage').classList.contains('talking')`);
  log('시험5 준비 talking=' + talking);
  /* 대사를 일부러 띄운다 — 다음 날을 눌러 이벤트 대사를 받는다 */
  await tap('next'); await sleep(1200);
  const t2 = await page.eval(`document.getElementById('stage').classList.contains('talking')`);
  if (t2) {
    const before = await st();
    const nr = await rectOf('next');
    await tapXY(nr.x, nr.y, 60, 700);   /* 대사 뒤의 [다음 날] 자리를 누른다 */
    const s1 = await st();
    log(`시험5 대사 중 [다음날] 자리 탭: 일 ${before.day}→${s1.day} (기대 그대로) talking=${s1.stage}`);
  } else log('시험5 대사가 안 떠서 못 함');
  await clearTalk();
}

/* ══ 시험 6 — 빨리감기 도중에 누르기 ══ */
{
  await clearTalk();
  const s0 = await st();
  const fr = await tap('ff');
  await sleep(500);
  const during = await page.eval(`(()=>{ const v=id=>{const e=document.getElementById(id);
      return e?[e.offsetParent!==null,!!e.disabled]:null};
    return { next:v('next'), water:v('waterCrop'), harv:v('harvestCrop'), sow:v('resow'),
      marks:(()=>{try{return window.__marks.list().length}catch(e){return -1}})(),
      day:window.__S().day }; })()`);
  /* 빨리감기 중에 거두기·물주기를 눌러 본다 */
  const hv = await tap('harvestCrop', 60, 300);
  const wv = await tap('waterCrop', 60, 300);
  await sleep(4000);
  await tap('ff', 60, 600);   /* 멈춰 본다 */
  await sleep(1500); await clearTalk();
  const s1 = await st();
  log(`시험6 빨리감기: 시작=${JSON.stringify(fr)} 도중버튼=${JSON.stringify(during)} 거두기=${JSON.stringify(hv)} 물주기=${JSON.stringify(wv)}`);
  log(`       일 ${s0.day}→${s1.day} hardLock=${s1.hardLock} 배너=${s1.banner} btn=${JSON.stringify(s1.btn)}`);
}

/* ══ 시험 7 — 저장: 껐다 켜면 이어지나 ══ */
{
  await clearTalk();
  const before = await st();
  await sleep(900);
  const saved = await page.eval(`(()=>{ const raw=localStorage.getItem('byeot/save/1');
    return raw ? {len:raw.length, day:(JSON.parse(raw).state||JSON.parse(raw)).day} : null; })()`);
  await page.goto(`${BASE}/game.html`);
  await page.waitFor(`!!window.__rv`, 600000, 500); await sleep(4000);
  await clearTalk();
  const after = await st();
  log('시험7 저장 ' + JSON.stringify(saved));
  log(`       재시작 전 ${JSON.stringify({day:before.day,돈:before.돈,회전:before.회전,시루:before.시루,재고:before.재고})}`);
  log(`       재시작 후 ${JSON.stringify({day:after.day,돈:after.돈,회전:after.회전,시루:after.시루,재고:after.재고})}`);
  await page.shot(`${OUT}/${TAG}_resume.png`);
}

/* ══ 시험 8 — [초기화]가 진짜 처음으로 돌리나 ══ */
{
  await page.eval(`(()=>{ window.__byeotSheet.open(); window.__byeotSheet.tab('room'); })()`, false);
  await sleep(800);
  const r = await rectOf('reset');
  log('시험8 [초기화] 버튼 ' + JSON.stringify(r));
  if (r && r.vis) {
    await page.eval(`(()=>{ window.confirm = ()=>true; })()`, false);
    await tapXY(r.x, r.y, 70, 2500);
    await sleep(3000); await clearTalk();
    const s1 = await st();
    log('       초기화 뒤 ' + JSON.stringify(s1));
    const raw = await page.eval(`(()=>{const k=localStorage.getItem('byeot/save/1');
      return {세이브있나:!!k, 키들:Object.keys(localStorage)};})()`);
    log('       localStorage ' + JSON.stringify(raw));
    await page.shot(`${OUT}/${TAG}_afterreset.png`);
  }
}

/* ══ 시험 9 — 오류 안내가 화면에 뜨나 (#side 가 있나) ══ */
{
  const side = await page.eval(`(()=>({ side: !!document.getElementById('side'),
    err: document.querySelectorAll('.err').length }))()`);
  log('시험9 #side 존재 ' + JSON.stringify(side));
}

/* ══ 시험 10 — 첫 플레이가 끝난 뒤 [빨리감기] ══
   ★정직하게 적는다: 여기까지 손으로 오려면 20일이 넘게 걸려서
     firstPlay.completed 만 메모리에서 켜고 눌렀다. 상태를 만진 시험이다. */
{
  await clearTalk();
  const b0 = await st();
  await page.eval(`(()=>{ window.__S().firstPlay.completed = true; })()`, false);
  await sleep(300);
  const fr = await tap('ff', 70, 1500);
  await sleep(1500);
  const s1 = await st();
  const shown = await page.eval(`(()=>({ err:document.querySelectorAll('.err').length,
    lastLog:(document.getElementById('log').textContent||'').trim().slice(-120),
    banner:(document.getElementById('event').textContent||'').trim().slice(0,80) }))()`);
  log(`시험10 첫플레이 완료 뒤 [빨리감기]: 눌림=${JSON.stringify(fr)} hardLock=${s1.hardLock}`);
  log(`        next=${JSON.stringify(s1.btn.next)} ff=${JSON.stringify(s1.btn.ff)} 화면에 뜬 안내=${JSON.stringify(shown)}`);
  log(`        (참고) 누르기 전 hardLock=${b0.hardLock}`);
  await page.shot(`${OUT}/${TAG}_ff_lock.png`);
  /* 잠긴 뒤에 [다음 날]이 살아나나 */
  const nr = await tap('next', 70, 2000);
  const s2 = await st();
  log(`        그 뒤 [다음 날] = ${JSON.stringify(nr)} 일 ${s1.day}→${s2.day}`);
}

log('예외 ' + JSON.stringify(errs.slice(0, 12)));
log('경고 ' + JSON.stringify([...new Set(warns)].slice(0, 18)));
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(`${OUT}/${TAG}_log.txt`, T.join('\n'), 'utf8');
await page.close();
