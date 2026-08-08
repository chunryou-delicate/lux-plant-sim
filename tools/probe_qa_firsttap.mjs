/* ============================================================
   tools/probe_qa_firsttap.mjs — 「말풍선을 처음 누르면 한 번 씹힌다」를 좁혀서 잰다
   ------------------------------------------------------------
   ★ probe_qa_full 이 폰에서 두 번 같은 자리에서 잡았다:
       일 6 다시심기 → 일 7 물 주기 말풍선 첫 탭 = 안 먹음 → 일 8 같은 손짓 = 먹음
       일 14 다시심기 → 일 15 첫 탭 = 안 먹음
     시루를 막 놓은 **일 0** 에도 같은 모양이 났다.
   ★ 여기서는 **탭이 어디까지 갔는지**를 잰다 — 짐작하지 않는다:
       ① 말풍선의 go() 가 불렸나            (drawMarks 가 붙인 onpointerdown)
       ② $('waterCrop').click() 이 갔나      (go 가 하는 일)
       ③ roomView.actAt 이 불렸나           (걸어가서 하는 일)
       ④ actAt 이 onDone 했나 onFail 했나
     ①~④ 중 어디서 끊기는지가 답이다.
   고치지 않는다. 잴 뿐이다.

   쓰는 법
     python tools/serve.py 8991
     BYEOT_URL=http://127.0.0.1:8991 QA_VIEW=phone node tools/probe_qa_firsttap.mjs
============================================================ */
import { launch, sleep } from './test_cdp.mjs';
import fs from 'node:fs';

const _wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); },
  +(process.env.BYEOT_PROBE_TIMEOUT_MS || 900000));
_wd.unref && _wd.unref();

const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:8991';
const VIEW = (process.env.QA_VIEW || 'phone').toLowerCase();
const PC = VIEW === 'pc';
const OUT = 'docs/engine/shots/qa';
const TAG = process.env.QA_TAG || ('firsttap-' + VIEW);

const page = await launch({ width: PC ? 1440 : 390, height: PC ? 900 : 844, dpr: PC ? 1 : 2, mobile: !PC });
if (!PC) await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });

const errs = [];
page.on((m, p) => { if (m === 'Runtime.exceptionThrown')
  errs.push(((p.exceptionDetails.text || '') + ' ' + ((p.exceptionDetails.exception || {}).description || '')).slice(0, 300)); });

const cap = (l, pr, ms = 20000) => Promise.race([pr,
  new Promise(r => { const t = setTimeout(() => { console.error(' ⏱' + l); r('TIMEOUT'); }, ms); t.unref && t.unref(); })]);
const M = (type, x, y, extra = {}) => cap('m', page.send('Input.dispatchMouseEvent',
  { type, x: Math.round(x), y: Math.round(y), button: 'left', clickCount: 1, ...extra }));
const T2 = (type, pts) => cap('t', page.send('Input.dispatchTouchEvent', { type, touchPoints: pts }));
const pt = (x, y) => [{ x: Math.round(x), y: Math.round(y), id: 1, radiusX: 8, radiusY: 8, force: 1 }];
async function down(x, y) { PC ? await M('mousePressed', x, y, { buttons: 1 }) : await T2('touchStart', pt(x, y)); }
async function up(x, y) { PC ? await M('mouseReleased', x, y, { buttons: 0 }) : await T2('touchEnd', []); }
async function tapXY(x, y, hold = 80, after = 250) { await down(x, y); await sleep(hold); await up(x, y); await sleep(after); }

const rectOf = id => cap('r:' + id, page.eval(`(()=>{const e=document.getElementById(${JSON.stringify(id)});
  if(!e) return null; const r=e.getBoundingClientRect();
  return {x:+(r.left+r.width/2).toFixed(1),y:+(r.top+r.height/2).toFixed(1),w:+r.width.toFixed(1),
          vis:e.offsetParent!==null&&r.width>0,dis:!!e.disabled};})()`)).then(v => v === 'TIMEOUT' ? null : v);
const marks = () => page.eval(`(()=>[...document.getElementById('marks').children].map(el=>{
  const r=el.getBoundingClientRect();
  return {txt:(el.textContent||'').trim().slice(0,24), x:+(r.left+r.width/2).toFixed(1),
          y:+(r.top+r.height/2).toFixed(1), vis:el.style.display!=='none'&&r.width>0};}))()`);
const st = () => page.eval(`(()=>{const S=window.__S(); const b=(S.firstPlay||{}).beansprout||{};
  return {day:S.day, 물준날:b.wateredOnDay, 나이:b.ageDays, 회전:b.harvestCount,
    시루:!!(b.slotId||b.at), 자리:b.slotId||(b.at?'free':null),
    체력:(document.getElementById('resSta')||{}).textContent,
    재고:S.shop&&S.shop.stock,
    배너:(document.getElementById('event').textContent||'').trim().slice(0,80),
    stage:document.getElementById('stage').className,
    acting:document.getElementById('actBar').offsetParent!==null};})()`);
/* 씨앗을 산다 — 되묻는 버튼이라 두 번 누른다(game.html §confirmOnce) */
async function 씨앗사기() {
  const ob = await rectOf('openBag');
  if (ob && ob.vis) await tapXY(ob.x, ob.y, 70, 900);
  const tb = await rectOf('tabShop');
  if (tb && tb.vis) await tapXY(tb.x, tb.y, 70, 900);
  const r = await page.eval(`(()=>{const b=document.querySelector('[data-buy="bean_seed"]');
    if(!b) return null; b.scrollIntoView({block:'center'}); const q=b.getBoundingClientRect();
    return {x:+(q.left+q.width/2).toFixed(1), y:+(q.top+q.height/2).toFixed(1), dis:!!b.disabled,
            vis:b.offsetParent!==null&&q.height>0};})()`);
  if (!r || !r.vis || r.dis) { log('  씨앗 못 삼 ' + JSON.stringify(r)); return false; }
  await tapXY(r.x, r.y, 70, 600);
  await tapXY(r.x, r.y, 70, 1200);
  await page.eval(`(()=>{try{window.__byeotSheet.close()}catch(e){}})()`, false);
  await sleep(700);
  log('  씨앗 주문 뒤 ' + JSON.stringify(await st()));
  return true;
}
async function clearTalk(max = 30) {
  for (let i = 0; i < max; i++) {
    if (!await page.eval(`document.getElementById('stage').classList.contains('talking')`)) return i;
    const r = await rectOf('dlgBox'); if (!(r && r.vis)) break;
    await tapXY(r.x, r.y, 60, 280);
  } return -1;
}
const T = []; const log = (...a) => { const s = a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' '); T.push(s); console.log(s); };

/* ── 부팅 ── */
await page.goto(`${BASE}/game.html`); await sleep(1500);
await page.eval(`(()=>{try{localStorage.clear()}catch(e){}})()`, false);
await page.goto(`${BASE}/game.html`);
await page.waitFor(`!!window.__rv`, 300000, 500); await sleep(3500);
await clearTalk();
{ const g = await rectOf('guideClose'); if (g && g.vis) await tapXY(g.x, g.y, 70, 400); }

/* ── ★ 도청기를 단다. **아무것도 안 바꾼다** — 부르고 그대로 통과시킨다 ── */
await page.eval(`(()=>{
  window.__tap = { click:[], act:[], down:[] };
  /* ② 아래 [물 주기] 버튼이 실제로 눌렸나 */
  const wc = document.getElementById('waterCrop');
  if (wc) { const orig = wc.click.bind(wc);
    wc.click = function(){ window.__tap.click.push({t:Date.now(), disabled:wc.disabled,
      vis:wc.offsetParent!==null}); return orig(); }; }
  /* ③④ actAt 이 불렸나 · 끝났나 */
  const rv = window.__rv;
  if (rv && rv.actAt) { const oa = rv.actAt.bind(rv);
    rv.actAt = function(key, kind, opt){
      const rec = {t:Date.now(), key, kind, done:false, fail:null, ms:null};
      window.__tap.act.push(rec);
      const o2 = Object.assign({}, opt, {
        onDone:()=>{ rec.done=true; rec.ms=Date.now()-rec.t; opt&&opt.onDone&&opt.onDone(); },
        onFail:(w)=>{ rec.fail=String(w); rec.ms=Date.now()-rec.t; opt&&opt.onFail&&opt.onFail(w); } });
      return oa(key, kind, o2); }; }
  /* ① 말풍선이 손가락을 받기는 하나 — 잡되 막지 않는다(capture, passive) */
  document.getElementById('marks').addEventListener('pointerdown', e=>{
    window.__tap.down.push({t:Date.now(), 표적:(e.target.textContent||'').trim().slice(0,20)});
  }, true);
})()`, false);

/* ── 시루를 놓는다 ── */
{
  const ob = await rectOf('openBag');
  if (ob && ob.vis) await tapXY(ob.x, ob.y, 70, 900);
  await sleep(600);
  const th = await rectOf('cropThumb');
  log('시루 썸네일 ' + JSON.stringify(th));
  const cr = await page.eval(`(()=>{const c=document.getElementById('roomCanvas').getBoundingClientRect();
    return {l:c.left,t:c.top,w:c.width,h:c.height};})()`);
  const tx = cr.l + cr.w * 0.5, ty = cr.t + cr.h * 0.62;
  await down(th.x, th.y); await sleep(250);
  for (let i = 1; i <= 16; i++) {
    const x = th.x + (tx - th.x) * i / 16, y = th.y + (ty - th.y) * i / 16;
    PC ? await M('mouseMoved', x, y, { buttons: 1 }) : await T2('touchMove', pt(x, y));
    await sleep(45);
  }
  await up(tx, ty); await sleep(2600);
  await clearTalk();
  log('놓은 뒤 ' + JSON.stringify(await st()));
}

/* ══ 곁다리 시험 — **놓인 것을 눌러서 골라지나** ══════════════════════
   ★ probe_qa_full 이 PC 에서 잡았다: 몬스테라를 눌렀는데 pickedName 이 '—' 였다(안 골라짐).
     폰에서는 같은 자리를 눌러 골라졌다. 몬스테라는 22일쯤 걸려서, **같은 길을 타는**
     시루로 일 0 에 잰다(둘 다 room_view 의 onPlantTap → picked.select 로 간다).
   ★ 자리는 세 군데를 눌러 본다 — 발밑 한 점만 눌러 놓고 "안 골라진다"고 하면 안 된다. */
{
  const b = await page.eval(`(()=>{const S=window.__S(); const bb=(S.firstPlay||{}).beansprout||{};
    return bb.slotId||null;})()`);
  const c = await page.eval(`(()=>{const q=document.getElementById('roomCanvas').getBoundingClientRect();
    return {l:q.left,t:q.top,w:q.width,h:q.height};})()`);
  const p = await page.eval(`(()=>{try{const q=window.__rv.screenPosOf(${JSON.stringify(b)});
    return q?{x:q.x,y:q.y}:null}catch(e){return null}})()`);
  log('');
  log(`── 곁다리: 놓인 시루(${b})를 눌러 골라지나 ──`);
  if (!p) log('  자리를 화면에서 못 찾았다(카메라 뒤)');
  else {
    for (const [이름, dy] of [['발밑', 0], ['조금 위', -18], ['더 위', -36]]) {
      const x = c.l + p.x, y = c.t + p.y + dy;
      await tapXY(x, y, 80, 900);
      const r = await page.eval(`(()=>({이름:(document.getElementById('pickedName')||{}).textContent,
        식물판:document.getElementById('plantActions').offsetParent!==null,
        가구판:document.getElementById('furnActions').offsetParent!==null,
        가구이름:(document.getElementById('furnName')||{}).textContent,
        stage:document.getElementById('stage').className,
        상세:document.getElementById('detail').getAttribute('aria-hidden')}))()`);
      log(`  ${이름}(${Math.round(x)},${Math.round(y)}) → ${JSON.stringify(r)}`);
      /* 무엇이 골라졌든 풀고 다음 자리로 */
      for (const id of ['pickClose', 'furnClose', 'dClose']) {
        const q = await rectOf(id); if (q && q.vis) await tapXY(q.x, q.y, 60, 350);
      }
      await clearTalk();
    }
  }
}

/* ══ 본 시험 — 말풍선이 **처음 뜬 날**의 첫 탭과 둘째 탭 ══════════════
   같은 자리를 두 번 누른다. 사이에 넉넉히 기다린다(걸어가는 데 4초쯤 걸린다).
   ★ 매번 ①~④ 를 함께 적는다 — 어디서 끊기는지가 답이다. */
async function 한번(라벨, 기다림 = 9000) {
  await page.eval(`(()=>{ window.__tap.click.length=0; window.__tap.act.length=0; window.__tap.down.length=0; })()`, false);
  const ms = await marks();
  const m = ms.find(x => x.vis && /물 주기/.test(x.txt));
  const b = await st();
  if (!m) { log(`${라벨}: 물 주기 말풍선이 없다 — 있는 것 ${JSON.stringify(ms.map(x => x.txt))} 상태 ${JSON.stringify(b)}`); return null; }
  await tapXY(m.x, m.y, 80, 300);
  const 곧바로 = await page.eval(`(()=>({down:window.__tap.down.length, click:window.__tap.click.length,
    act:window.__tap.act.length, acting:document.getElementById('actBar').offsetParent!==null}))()`);
  await sleep(기다림);
  await clearTalk();
  const a = await st();
  const 도청 = await page.eval(`window.__tap`);
  log(`${라벨}: 자리=${m.x},${m.y} 글='${m.txt}'`);
  log(`      0.3초 뒤 ${JSON.stringify(곧바로)}`);
  log(`      ${기다림}ms 뒤 물준날 ${b.물준날}→${a.물준날} · 나이 ${b.나이}→${a.나이}`);
  log(`      도청 ①손가락=${도청.down.length} ②버튼click=${JSON.stringify(도청.click)} ③④actAt=${JSON.stringify(도청.act)}`);
  return { 먹었나: a.물준날 !== b.물준날, before: b, after: a, 도청, 곧바로 };
}

const r1 = await 한번('첫 탭(말풍선이 막 뜬 날)');
const r2 = await 한번('둘째 탭(같은 날 · 같은 자리)');
log('');
log(`■ 첫 탭이 먹었나 = ${r1 ? r1.먹었나 : '못 쟀다'}`);
log(`■ 둘째 탭이 먹었나 = ${r2 ? r2.먹었나 : '못 쟀다(첫 탭이 이미 먹어 말풍선이 사라졌다면 정상)'}`);
await page.shot(`${OUT}/${TAG}_after.png`);

/* ── 다시 심은 다음 날에도 같은가 — full 프로브가 잡은 그 자리 ── */
log('');
log('── 다시 심은 다음 날로 가서 한 번 더 ──');
for (let d = 0; d < 22; d++) {
  await clearTalk();
  const s = await st();
  const ms = await marks();
  const hv = ms.find(x => x.vis && /거두기|수확/.test(x.txt));
  if (hv) { await tapXY(hv.x, hv.y, 80, 300); await sleep(9000); await clearTalk(); await 씨앗사기(); }
  const sw = (await marks()).find(x => x.vis && /^🌱 씨앗 심기/.test(x.txt));
  if (sw) {
    await tapXY(sw.x, sw.y, 80, 300); await sleep(6000); await clearTalk();
    /* 심은 그 다음 날로 넘긴다 */
    const n = await rectOf('next'); if (n && n.vis && !n.dis) await tapXY(n.x, n.y, 70, 2600);
    await clearTalk();
    log('다시 심고 하루 넘긴 뒤 ' + JSON.stringify(await st()));
    const a1 = await 한번('다시 심은 다음 날 · 첫 탭');
    const a2 = await 한번('다시 심은 다음 날 · 둘째 탭');
    log(`■ (다시심기 뒤) 첫 탭 먹었나 = ${a1 ? a1.먹었나 : '못 쟀다'} · 둘째 탭 = ${a2 ? a2.먹었나 : '못 쟀다'}`);
    break;
  }
  /* 물이 필요하면 준다(여기서는 재지 않는다 — 그냥 굴린다) */
  const w = (await marks()).find(x => x.vis && /물 주기/.test(x.txt));
  if (w) { await tapXY(w.x, w.y, 80, 300); await sleep(7000); await clearTalk();
           const w2 = (await marks()).find(x => x.vis && /물 주기/.test(x.txt));
           if (w2) { await tapXY(w2.x, w2.y, 80, 300); await sleep(7000); await clearTalk(); } }
  const n = await rectOf('next');
  if (!(n && n.vis && !n.dis)) { log('[다음 날]을 못 눌렀다 ' + JSON.stringify(n)); break; }
  await tapXY(n.x, n.y, 70, 2600);
  log(`  [일 ${(await st()).day}] ${JSON.stringify((await marks()).filter(x => x.vis).map(x => x.txt))}`);
}

/* ══ 셋째 시험 — **물 주기를 누르고 곧바로 [다음 날]** ══════════════════
   ★ actAt 이 끝나는 데 5초 넘게 걸린다(위에서 5449ms 로 쟀다). 사람은 그걸 안 기다린다.
     걸어가는 도중에 [다음 날]을 누르면 물이 들어가나 — 그것만 잰다. */
log('');
log('── 셋째 시험: 물 주기를 누르고 곧바로 [다음 날] ──');
for (let d = 0; d < 24; d++) {
  await clearTalk();
  const w = (await marks()).find(x => x.vis && /물 주기/.test(x.txt));
  if (w) {
    await page.eval(`(()=>{ window.__tap.act.length=0; })()`, false);
    const b = await st();
    await tapXY(w.x, w.y, 80, 300);
    await sleep(1200);                                  /* 아직 걸어가는 중이다 */
    const 중간 = await page.eval(`(()=>({acting:document.getElementById('actBar').offsetParent!==null,
      act:window.__tap.act.length}))()`);
    const n = await rectOf('next');
    const 눌림 = (n && n.vis && !n.dis);
    if (눌림) await tapXY(n.x, n.y, 70, 3000);
    await sleep(6000); await clearTalk();
    const a = await st();
    const 도청 = await page.eval(`window.__tap.act`);
    log(`걸어가는 중에 [다음 날]: 중간=${JSON.stringify(중간)} 눌림=${눌림}`);
    log(`   물준날 ${b.물준날}→${a.물준날} · 일 ${b.day}→${a.day} · actAt=${JSON.stringify(도청)}`);
    log(`■ 물이 들어갔나 = ${a.물준날 !== b.물준날}` +
        (a.물준날 === b.물준날 ? '  ← 「물 주기를 누르고 곧바로 다음 날을 누르면 물이 안 들어간다」' : ''));
    break;
  }
  /* 물이 필요할 때까지 굴린다 */
  const hv = (await marks()).find(x => x.vis && /거두기|수확/.test(x.txt));
  if (hv) { await tapXY(hv.x, hv.y, 80, 300); await sleep(8000); await clearTalk(); }
  const sw = (await marks()).find(x => x.vis && /심기/.test(x.txt));
  if (sw) { await tapXY(sw.x, sw.y, 80, 300); await sleep(8000); await clearTalk(); }
  const n = await rectOf('next');
  if (!(n && n.vis && !n.dis)) { log('[다음 날]을 못 눌렀다 ' + JSON.stringify(n)); break; }
  await tapXY(n.x, n.y, 70, 2600);
}

log('');
log('■ 예외 ' + JSON.stringify(errs.slice(0, 10)));
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(`${OUT}/${TAG}_log.txt`, T.join('\n'), 'utf8');
await page.close();
