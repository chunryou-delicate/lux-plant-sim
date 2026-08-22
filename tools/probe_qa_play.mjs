/* ============================================================
   tools/probe_qa_play.mjs — 배포본을 **손가락으로** 끝까지 해 본다 (QA 전용)
   ------------------------------------------------------------
   ★진짜 터치 입력을 쓴다. DOM 이벤트를 흉내 내지 않고 CDP Input.dispatchTouchEvent
     로 넣는다 — 그래야 크롬이 touchend 뒤에 **호환 마우스 이벤트**까지 진짜로 쏜다.
     "유령 마우스"는 그 길로만 재현된다.
   고치지 않는다. 보고 적을 뿐이다.
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
const TAG = process.env.QA_TAG || ('cpu' + CPU);

const page = await launch({ width: 390, height: 844, dpr: 2, mobile: true,
  throttle: CPU > 1 ? { cpu: CPU } : null });
await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });

const errs = [], warns = [];
page.on((m, p) => {
  if (m === 'Runtime.exceptionThrown')
    errs.push((p.exceptionDetails.text || '') + ' ' + ((p.exceptionDetails.exception || {}).description || ''));
  if (m === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(p.type))
    warns.push(p.type + ': ' + (p.args || []).map(a => a.value ?? a.description ?? a.type).join(' ').slice(0, 200));
});

/* ── 손가락 ─────────────────────────────────────────── */
/* ★CDP 는 렌더러가 이벤트를 삼킬 때까지 답을 안 준다. 답이 영영 안 오면
   재는 도구가 통째로 멈춘다(실제로 12분 멈췄다). 그래서 하나하나에 시한을 건다. */
let STALLS = 0;
const cap = (label, pr, ms = 12000) => Promise.race([
  pr,
  new Promise(r => { const t = setTimeout(() => { STALLS++; console.error('  ⏱멈춤 ' + label); r('TIMEOUT'); }, ms); t.unref && t.unref(); })
]);
const touchDown = (x, y) => cap('down', page.send('Input.dispatchTouchEvent',
  { type: 'touchStart', touchPoints: [{ x, y, id: 1, radiusX: 8, radiusY: 8, force: 1 }] }));
const touchMove = (x, y) => cap('move', page.send('Input.dispatchTouchEvent',
  { type: 'touchMove', touchPoints: [{ x, y, id: 1, radiusX: 8, radiusY: 8, force: 1 }] }));
const touchUp = () => cap('up', page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }));

async function tapXY(x, y, hold = 70) {
  await touchDown(Math.round(x), Math.round(y)); await sleep(hold);
  await touchUp(); await sleep(180);
}
async function dragXY(x0, y0, x1, y1, steps = 12, holdMs = 60) {
  await touchDown(Math.round(x0), Math.round(y0)); await sleep(holdMs);
  for (let i = 1; i <= steps; i++) {
    await touchMove(Math.round(x0 + (x1 - x0) * i / steps), Math.round(y0 + (y1 - y0) * i / steps));
    await sleep(35);
  }
  await sleep(120); await touchUp(); await sleep(300);
}
const rectOf = id => cap('rect:' + id, page.eval(`(()=>{const e=document.getElementById(${JSON.stringify(id)});
  if(!e) return null; const r=e.getBoundingClientRect();
  return {x:r.left+r.width/2, y:r.top+r.height/2, w:r.width, h:r.height,
          vis:e.offsetParent!==null && r.width>0 && r.height>0, dis:!!e.disabled,
          txt:(e.textContent||'').trim().slice(0,26)};})()`)).then(v => v === 'TIMEOUT' ? null : v);
/* 손가락으로 누른다. 안 보이면 왜 못 눌렀는지 돌려준다. */
async function tap(id, hold = 70) {
  const r = await rectOf(id);
  if (!r) return { id, ok: false, why: '없음' };
  if (!r.vis) return { id, ok: false, why: '안보임' };
  if (r.dis) return { id, ok: false, why: '비활성', txt: r.txt };
  await tapXY(r.x, r.y, hold);
  return { id, ok: true, txt: r.txt };
}

/* ── 상태 읽기 ───────────────────────────────────────── */
const snap = () => page.eval(`(()=>{ const S=window.__S();
  const fp=S.firstPlay||{}, b=fp.beansprout||{};
  let ch=null; try{ ch=window.__rv.characters().find(c=>c.id==='jachwi').pos; }catch(e){}
  const vis=id=>{const e=document.getElementById(id); return !!(e&&e.offsetParent!==null);};
  const dis=id=>{const e=document.getElementById(id); return !!(e&&e.disabled);};
  const txt=id=>{const e=document.getElementById(id); return e?(e.textContent||'').trim().slice(0,40):null;};
  return { day:S.day, 돈:S.sim&&S.sim.money, money2:S.money, ledger:S.ledger&&S.ledger.length,
    회전:b.harvestCount, 시루:(b.slots||b.sirus||[]).length, phase:fp.phase, 완료:!!fp.completed,
    화분:(S.pots||[]).length, 삽수:(S.cuttings||[]).length, 램프:(S.lamps||[]).length,
    재고:S.shop&&S.shop.stock, 주문:S.shop&&(S.shop.pending||S.shop.orders),
    tut:S.tutorial&&{goal:S.tutorial.goal,season:S.tutorial.season,step:S.tutorial.step},
    캐릭:ch&&{x:+ch.x.toFixed(2),z:+ch.z.toFixed(2)},
    stage:document.getElementById('stage').className,
    quest:txt('quest'), actBar:vis('actBar')&&txt('actBar'),
    btn:{water:[vis('waterCrop'),dis('waterCrop'),txt('waterCrop')],
         harv:[vis('harvestCrop'),dis('harvestCrop'),txt('harvestCrop')],
         sow:[vis('resow'),dis('resow'),txt('resow')],
         next:[vis('next'),dis('next')], ff:[vis('ff'),dis('ff')]},
    marks:(()=>{try{return window.__marks.list().length}catch(e){return -1}})() }; })()`);

/* 대사창 치우기 — 진짜로 눌러서 치운다 */
async function clearTalk(max = 25) {
  for (let i = 0; i < max; i++) {
    const t = await page.eval(`document.getElementById('stage').classList.contains('talking')`);
    if (!t) return i;
    const r = await rectOf('dlgBox');
    if (r && r.vis) await tapXY(r.x, r.y, 60); else break;
    await sleep(260);
  }
  return -1;
}
async function clearGuide() {
  const r = await rectOf('guideClose');
  if (r && r.vis) { await tapXY(r.x, r.y); await sleep(300); return true; }
  return false;
}

const T = [];
const log = (...a) => { const s = a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' ');
  T.push(s); console.log(s); };

/* ── 부팅 ───────────────────────────────────────────── */
await page.goto(`${BASE}/game.html`);
await sleep(2000);
await page.eval(`(()=>{try{localStorage.clear()}catch(e){}})()`, false);
const t0 = Date.now();
await page.goto(`${BASE}/game.html`);
await page.waitFor(`!!window.__rv`, 600000, 500);
log('부팅 __rv ms=' + (Date.now() - t0));
await sleep(3500);

/* actAt 을 감싸서 무슨 일이 있었는지 본다 (읽기만 — 동작은 그대로 통과) */
await page.eval(`(()=>{ window.__qa = { acts: [] };
  const rv = window.__rv; if(!rv || !rv.actAt) { window.__qa.noActAt = true; return; }
  const orig = rv.actAt.bind(rv);
  rv.actAt = function(key, kind, opt){
    const rec = { key, kind, t: Date.now(), done:false, fail:null, walk:0, prog:0 };
    window.__qa.acts.push(rec);
    const o2 = Object.assign({}, opt, {
      onProgress:(p,ph)=>{ if(ph==='walk') rec.walk=Math.max(rec.walk,p); rec.prog=p; rec.phase=ph;
                           opt&&opt.onProgress&&opt.onProgress(p,ph); },
      onDone:()=>{ rec.done=true; rec.ms=Date.now()-rec.t; opt&&opt.onDone&&opt.onDone(); },
      onFail:(w)=>{ rec.fail=String(w); rec.ms=Date.now()-rec.t; opt&&opt.onFail&&opt.onFail(w); }
    });
    return orig(key, kind, o2);
  };
  /* 배너도 잡는다 */
  window.__qa.banners = [];
  const mo = new MutationObserver(()=>{ const e=document.getElementById('event');
    const t=(e&&e.textContent||'').trim(); if(t) window.__qa.banners.push(t.slice(0,80)); });
  const ev=document.getElementById('event'); if(ev) mo.observe(ev,{childList:true,subtree:true,characterData:true});
})()`, false);

log('첫 대사 넘김 ' + await clearTalk());
await clearGuide();
log('시작상태 ' + JSON.stringify(await snap()));
await page.shot(`${OUT}/${TAG}_01_start.png`);

/* ── ① 시루 놓기: 가방을 열고 **끌어서** 방에 놓는다 ── */
log('— 가방 열기 —', JSON.stringify(await tap('openBag')));
await sleep(700);
const thumb = await rectOf('cropThumb');
log('시루 썸네일', JSON.stringify(thumb));
await page.shot(`${OUT}/${TAG}_02_bag.png`);
if (thumb && thumb.vis) {
  /* 방 한가운데 조금 아래로 끈다 — 한 단계씩 무슨 일이 나는지 본다 */
  await touchDown(Math.round(thumb.x), Math.round(thumb.y));
  await sleep(200);
  log('  drag.on(누른 직후)=' + await cap('dragon', page.eval(`(()=>{try{return window.__drag.on}catch(e){return 'ERR'}})()`)));
  for (let i = 1; i <= 14; i++) {
    await touchMove(Math.round(thumb.x + (195 - thumb.x) * i / 14), Math.round(thumb.y + (430 - thumb.y) * i / 14));
    await sleep(50);
  }
  log('  drag.on(끄는 중)=' + await cap('dragon2', page.eval(`(()=>{try{return JSON.stringify({on:window.__drag.on,best:!!window.__drag.best,lb:document.getElementById('dropLabel').textContent})}catch(e){return 'ERR'}})()`)));
  await touchUp();
  await sleep(2500);
}
log('놓은 뒤 ' + JSON.stringify(await snap()));
await clearTalk(); await clearGuide();
log('놓은 뒤(대사후) ' + JSON.stringify(await snap()));
await page.shot(`${OUT}/${TAG}_03_placed.png`);

/* ── ② 회전 루프 ── */
let lastActs = 0;
for (let d = 0; d < 40; d++) {
  const before = await snap();
  /* 물 주기 — 캐릭터가 걸어가나 */
  const wr = await tap('waterCrop');
  let walked = null;
  if (wr.ok) {
    await sleep(500);
    const mid = await page.eval(`(()=>{ let ch=null; try{ch=window.__rv.characters().find(c=>c.id==='jachwi').pos}catch(e){}
      return { acting: document.getElementById('actBar').offsetParent!==null,
               bar: (document.getElementById('actBar').querySelector('b')||{}).textContent,
               pos: ch&&{x:+ch.x.toFixed(2),z:+ch.z.toFixed(2)} }; })()`);
    await sleep(3800);
    const after = await snap();
    const dist = (before.캐릭 && after.캐릭)
      ? Math.hypot(after.캐릭.x - before.캐릭.x, after.캐릭.z - before.캐릭.z) : null;
    walked = { mid, 이동: dist == null ? null : +dist.toFixed(2) };
  }
  const acts = await page.eval(`window.__qa.acts.slice(${lastActs})`);
  lastActs += acts.length;
  await clearTalk();

  const nr = await tap('next');
  await sleep(1800); await clearTalk();
  const hr = await tap('harvestCrop');
  if (hr.ok) await sleep(4200);
  await clearTalk();
  const acts2 = await page.eval(`window.__qa.acts.slice(${lastActs})`);
  lastActs += acts2.length;

  const s = await snap();
  log(`[일 ${s.day}] 물=${JSON.stringify(wr)} 걷기=${JSON.stringify(walked)} 다음=${JSON.stringify(nr)} 거두기=${JSON.stringify(hr)}`);
  log(`        actAt=${JSON.stringify(acts.concat(acts2))}`);
  log(`        ${JSON.stringify(s)}`);

  /* 씨앗이 필요하면 상점에서 산다 — ★가방을 열고 [방] 탭을 눌러야 상점이 화면에 있다 */
  if (s.btn.sow[0] && s.btn.sow[1]) {
    await tap('openBag'); await sleep(500);
    await tap('tabRoom'); await sleep(600);
    const info = await page.eval(`(()=>{const b=document.querySelector('[data-buy="bean_seed"]');
      if(!b) return {why:'버튼없음'};
      b.scrollIntoView({block:'center'});
      const r=b.getBoundingClientRect();
      return {x:r.left+r.width/2,y:r.top+r.height/2,vis:b.offsetParent!==null&&r.height>0,
              dis:!!b.disabled, txt:(b.textContent||'').trim().slice(0,40), title:b.title||''};})()`);
    log('        씨앗주문 버튼 ' + JSON.stringify(info));
    if (info && info.vis && !info.dis) { await tapXY(info.x, info.y); await sleep(900); }
    log('        주문 뒤 ' + JSON.stringify(await page.eval(`(()=>{const S=window.__S();
      return {돈:S.tutorial.cashWon, 재고:S.shop.stock, 주문:(S.shop.orders||[]).map(o=>o.itemId+'@'+o.arrivesOnDay),
              배너:(document.getElementById('event').textContent||'').trim().slice(0,60)};})()`)));
    await page.eval(`(()=>{try{window.__byeotSheet.close()}catch(e){}})()`, false);
    await sleep(500);
  }
  const sr = await tap('resow');
  if (sr.ok) { await sleep(4200); await clearTalk(); log('        다시심기 ' + JSON.stringify(sr) + ' → ' + JSON.stringify(await snap())); }

  if (s.화분 > 0) {
    log('★몬스테라 도착 일=' + s.day + ' 회전=' + s.회전);
    await page.shot(`${OUT}/${TAG}_04_arrival.png`);
    /* ── 도착 뒤: 화분을 탭해서 창가로 옮겨 본다 (손가락으로) ── */
    const sp = await cap('sp', page.eval(`(()=>{ try{ const c=document.getElementById('roomCanvas').getBoundingClientRect();
      const p=window.__rv.screenPosOf(window.__S().pots[0].slotId);
      return p?{x:c.left+p.x, y:c.top+p.y}:null; }catch(e){ return {err:String(e)} } })()`));
    log('  화분 화면좌표 ' + JSON.stringify(sp));
    if (sp && sp.x) {
      await tapXY(sp.x, sp.y, 80);
      await sleep(800);
      const pa = await rectOf('plantActions');
      const nm = await page.eval(`(document.getElementById('pickedName')||{}).textContent`);
      log('  화분 탭 → 잡이판 ' + JSON.stringify(pa) + ' 이름=' + nm);
      /* ★유령 마우스 시험 — 터치로 골랐는데 곧바로 풀리나 */
      await sleep(1200);
      const pa2 = await rectOf('plantActions');
      log('  1.2초 뒤에도 떠 있나 ' + JSON.stringify(pa2));
      if (pa2 && pa2.vis) {
        const mv = await tap('pickMove');
        log('  [옮기기] ' + JSON.stringify(mv));
        await sleep(600);
        /* 창가 쪽으로 끈다 */
        await dragXY(195, 430, 300, 330, 12, 200);
        await sleep(2000); await clearTalk();
        log('  옮긴 뒤 ' + JSON.stringify(await snap()));
        await page.shot(`${OUT}/${TAG}_05_moved.png`);
      }
    }
    break;
  }
}

log('배너 ' + JSON.stringify(await page.eval(`window.__qa.banners.slice(-15)`)));
log('예외 ' + JSON.stringify(errs.slice(0, 10)));
log('경고 ' + JSON.stringify([...new Set(warns)].slice(0, 15)));
await page.shot(`${OUT}/${TAG}_99_end.png`);
fs.mkdirSync('docs/engine/shots/qa', { recursive: true });
fs.writeFileSync(`${OUT}/${TAG}_log.txt`, T.join('\n'), 'utf8');
await page.close();
