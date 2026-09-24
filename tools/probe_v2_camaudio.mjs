/* ============================================================
   tools/probe_v2_camaudio.mjs — v2 카메라 연출 · 방 소리를 «실제 게임에서» 잰다
   ------------------------------------------------------------
   재는 것
     C-1 대화가 열리면 카메라가 말하는 쪽으로 다가간다(거리 ≈ 0.90×) · 방위는 그대로
     C-2 대화가 닫히면 제자리로 돌아온다(거리·보는 점)
     C-3 대화 중 사람이 끌면 연출을 버린다 — 닫혀도 안 되돌린다(사람이 놓은 방위 그대로)
     C-4 물 주기 손이 닿으면 살짝 밀었다가(0.94×) 동작이 끝나기 전에 제자리
     A-1 첫 손짓 뒤 방 소리가 켜진다(음악과 같은 ctx) · 노드 수 · 마스터 세기
     A-2 탭이 숨으면 멎고, 돌아오면 다시 켜진다
     A-3 ♪ 로 끄면 같이 멎는다
     A-4 OfflineAudioContext 로 구워 음악과 RMS 를 견준다(낮 · 비 오는 밤)
     E   페이지 예외 · console.error 0건
     ?v2=0 이면 카메라·소리 둘 다 안 움직인다(A/B)
   쓰기
     python tools/serve.py 8986
     BYEOT_URL=http://localhost:8986 node tools/probe_v2_camaudio.mjs [--size 390x844] [--shots DIR]
============================================================ */
import { launch, sleep } from './test_cdp.mjs';

const BASE = process.env.BYEOT_URL || 'http://localhost:8986';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const [W, H] = String(arg('size', '390x844')).split('x').map(Number);
const SHOTS = arg('shots', null);

let pass = 0, fail = 0;
const ok = (c, t, why) => { (c ? pass++ : fail++); console.log((c ? '  OK   ' : '  FAIL ') + t + (why != null ? '  → ' + why : '')); };

async function open(q) {
  const page = await launch({ width: W, height: H, dpr: 2, mobile: false });
  const errs = [];
  page.on((m, p) => {
    if (m === 'Runtime.exceptionThrown')
      errs.push('EXC ' + (p.exceptionDetails.text + ' ' + ((p.exceptionDetails.exception || {}).description || '')).slice(0, 300));
    if (m === 'Runtime.consoleAPICalled' && p.type === 'error')
      errs.push('ERR ' + (p.args || []).map(a => a.value || a.description || '').join(' ').slice(0, 300));
  });
  await page.goto(`${BASE}/game.html${q || ''}`);
  await page.eval(`localStorage.clear()`, false);
  await page.goto(`${BASE}/game.html${q || ''}`);
  await page.waitFor('!!window.__rv', 180000, 300);
  await page.waitFor('window.__byeotBooted === true', 180000, 300);
  await page.waitFor(`(window.__rv.characters()||[]).some(c=>c.id==='jachwi')`, 60000, 300);
  return { page, errs };
}
const camOf = (page) => page.eval(`(()=>{ const c=window.__rv.camera(); return { ...c, k:+(c.dist/c.fit).toFixed(4) }; })()`);
const talking = (page) => page.eval(`document.getElementById('stage').classList.contains('talking')`);
async function skipTalk(page) {
  await page.eval(`(()=>{ const e=document.getElementById('dlgSkip'); if(e) e.click(); })()`, false);
  for (let i = 0; i < 40; i++) {
    if (!(await talking(page))) return true;
    await page.eval(`document.getElementById('dlgBox').click()`, false);
    await sleep(150);
  }
  return !(await talking(page));
}
async function openTalk(page) {
  for (const id of ['rentSoon', 'learnHarvest', 'learnSpear', 'monsteraStalled', 'brokeTalk', 'learnCropDark']) {
    const r = await page.eval(`window.__dlgOpen(${JSON.stringify(id)})`);
    if (r === true && await talking(page)) return id;
  }
  return null;
}
async function mouse(page, type, x, y, buttons) {
  await page.send('Input.dispatchMouseEvent', { type, x: Math.round(x), y: Math.round(y),
    button: type === 'mouseMoved' && !buttons ? 'none' : 'left',
    buttons: buttons ?? (type === 'mousePressed' ? 1 : 0), clickCount: type === 'mouseMoved' ? 0 : 1 });
}
const tgtD = (a, b) => Math.hypot(a.target.x - b.target.x, a.target.y - b.target.y, a.target.z - b.target.z);
const shot = async (page, name) => { if (SHOTS) await page.shot(`${SHOTS}/${name}.png`); };

/* ══ ① v2 켠 판 ══════════════════════════════════════════════ */
console.log(`\n══ v2 켬 (${W}x${H}) ══`);
{
  const { page, errs } = await open('');
  await sleep(2500);
  ok(await page.eval(`!!(window.__v2 && window.__v2.cam && window.__v2.cam.stats().on)`), 'C-0 카메라 연출이 붙었다');

  /* 먼저 조용한 판을 만든다 — 서막이 열려 있으면 닫는다 */
  await skipTalk(page); await page.eval(`(()=>{ const e=document.getElementById('guideClose'); if(e) e.click(); })()`, false);
  await sleep(1400);
  await page.eval(`window.__rv.selectCharacter(null)`, false);
  const home = await camOf(page);
  await shot(page, '01_home');

  /* C-1 */
  const id = await openTalk(page);
  ok(!!id, 'C-1a 대사를 열었다', id);
  await sleep(250);
  const mid = await camOf(page);
  await sleep(1100);
  const inn = await camOf(page);
  await shot(page, '02_talk_in');
  const st1 = await page.eval(`window.__v2.cam.stats()`);
  ok(st1.talkIn >= 1 && inn.k < home.k * 0.93 && inn.k > home.k * 0.85,
     'C-1 대화가 열리면 다가간다 (거리 0.85~0.93×)', `${home.k} → ${inn.k} · 보는 점 ${tgtD(home, inn).toFixed(3)}m 옮김`);
  ok(Math.abs(inn.az - home.az) < 1e-6 && Math.abs(inn.el - home.el) < 1e-6, 'C-1b 방위·상하각은 안 건드린다',
     `az ${home.az.toFixed(4)}→${inn.az.toFixed(4)}`);
  ok(mid.k < home.k && mid.k > inn.k, 'C-1c 순간이동이 아니라 트윈이다 (250ms 에 중간값)', `${home.k} → ${mid.k} → ${inn.k}`);

  /* C-2 — 느린 기계(헤드리스 소프트웨어 GL)에서는 트윈의 마지막 장이 늦게 그려진다: 트윈이 끝날 때까지 기다린다 */
  await skipTalk(page);
  await sleep(1150);
  await page.waitFor(`!window.__rv.camBusy().tween`, 8000, 100).catch(() => { });
  const back = await camOf(page);
  await shot(page, '03_talk_out');
  ok(Math.abs(back.k - home.k) < 1e-3 && tgtD(back, home) < 1e-3, 'C-2 닫히면 제자리로 돌아온다',
     `k ${back.k} (처음 ${home.k}) · 보는 점 차 ${tgtD(back, home).toFixed(4)}m`);

  /* C-3 — 대화 중 끌기 */
  await openTalk(page); await sleep(1300);
  const pt = await page.eval(`(()=>{ const r=document.getElementById('roomCanvas').getBoundingClientRect();
    for (const fy of [0.25,0.18,0.32,0.4]) for (const fx of [0.5,0.3,0.7]) {
      const x=r.left+r.width*fx, y=r.top+r.height*fy;
      if (document.elementFromPoint(x,y) === document.getElementById('roomCanvas')) return { x, y }; }
    return null; })()`);
  ok(!!pt, 'C-3a 대화 중에도 방을 잡을 자리가 있다', JSON.stringify(pt));
  if (pt) {
    await mouse(page, 'mouseMoved', pt.x, pt.y, 0);
    await mouse(page, 'mousePressed', pt.x, pt.y, 1);
    for (let i = 1; i <= 8; i++) { await mouse(page, 'mouseMoved', pt.x + i * 12, pt.y, 1); await sleep(35); }
    await mouse(page, 'mouseReleased', pt.x + 96, pt.y, 0);
    await sleep(600);
    const dragged = await camOf(page);
    await skipTalk(page);
    await sleep(1200);
    const after = await camOf(page);
    const st3 = await page.eval(`window.__v2.cam.stats()`);
    ok(Math.abs(dragged.az - home.az) > 0.05, 'C-3b 끌면 실제로 돈다', `${home.az.toFixed(3)} → ${dragged.az.toFixed(3)}`);
    ok(st3.lost >= 1 && Math.abs(after.az - dragged.az) < 1e-6 && Math.abs(after.k - dragged.k) < 1e-3,
       'C-3 사람이 만지면 연출을 버린다 (닫혀도 안 되돌린다)', `lost=${st3.lost} · az ${dragged.az.toFixed(4)}→${after.az.toFixed(4)} · k ${dragged.k}→${after.k}`);
  }

  /* C-4 — 물 주기 (game.html doAct 의 onArrive 와 같은 한 줄로) */
  await page.eval(`window.__rv.focusSlot(null, true)`, false);
  await sleep(500);
  const h4 = await camOf(page);
  const key = await page.eval(`(()=>{ const ps=window.__rv.plants()||[]; if (ps.length) return ps[0].key;
    const s=(window.__rv.slots ? window.__rv.slots() : []).filter(x=>x.pos.y<1.2)
      .sort((a,b)=>Math.abs(a.pos.y-0.7)-Math.abs(b.pos.y-0.7));
    return (s[0]&&s[0].slotId) || 'banjiha-desk:0'; })()`);
  console.log('       물 줄 자리:', key);
  await page.eval(`(()=>{ window.__p4 = { arrive:null, samples:[] };
    const t0 = performance.now();
    window.__rv.actAt(${JSON.stringify(key)}, 'water', {
      onArrive: () => { window.__p4.arrive = performance.now(); window.__v2.cam.act('water', ${JSON.stringify(key)});
        for (const ms of [450, 700, 1450]) setTimeout(() => { const c=window.__rv.camera();
          window.__p4.samples.push({ ms, k: c.dist/c.fit, az: c.az }); }, ms); },
      onDone: () => { const c=window.__rv.camera(); window.__p4.done = { ms: performance.now()-window.__p4.arrive, k: c.dist/c.fit }; },
      onFail: (why) => { window.__p4.err = 'onFail ' + why; }
    }).catch(e => { window.__p4.err = String(e && e.message || e); });
  })()`, false);
  await page.waitFor(`window.__p4 && (window.__p4.done || window.__p4.err)`, 90000, 200).catch(() => { });
  await sleep(400);
  const p4 = await page.eval(`window.__p4`);
  const st4 = await page.eval(`window.__v2.cam.stats()`);
  const s450 = (p4.samples || []).find(s => s.ms === 450), s1450 = (p4.samples || []).find(s => s.ms === 1450);
  ok(!p4.err && st4.actPush >= 1 && s450 && s450.k < h4.k * 0.96, 'C-4a 손이 닿으면 살짝 민다 (≈0.94×)',
     `home ${h4.k} · +450ms ${s450 && s450.k.toFixed(4)} · ${p4.err || ''}`);
  ok(s1450 && Math.abs(s1450.k - h4.k) < 2e-3 && p4.done && Math.abs(p4.done.k - h4.k) < 2e-3,
     'C-4b 동작이 끝나기 전에 제자리 (+1.45s · 끝날 때)', `+1450ms ${s1450 && s1450.k.toFixed(4)} · 끝(${p4.done && Math.round(p4.done.ms)}ms) ${p4.done && p4.done.k.toFixed(4)}`);

  /* A-1 — 첫 손짓(진짜 마우스)으로 음악과 함께 켜진다 */
  const cx = W / 2, cy = 30;
  await mouse(page, 'mouseMoved', cx, cy, 0); await mouse(page, 'mousePressed', cx, cy, 1); await mouse(page, 'mouseReleased', cx, cy, 0);
  await sleep(3200);
  const a1 = await page.eval(`(()=>{ const a=window.__v2.amb; return a ? a.stats() : null; })()`);
  ok(a1 && a1.playing && a1.ctxState === 'running' && a1.master > 0.2, 'A-1 첫 손짓 뒤 방 소리가 켜진다', JSON.stringify(a1));
  await sleep(6000);
  const a1b = await page.eval(`window.__v2.amb.stats()`);
  console.log('       노드·사건 (10초 뒤):', JSON.stringify(a1b));
  ok(a1b.nodes < 120, 'A-1b 노드가 쌓이지 않는다 (<120)', a1b.nodes);

  /* A-2 — 탭 숨김 (document.hidden 을 흉내) */
  await page.eval(`(()=>{ Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});
    Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'hidden'});
    document.dispatchEvent(new Event('visibilitychange')); })()`, false);
  await sleep(700);
  const a2 = await page.eval(`window.__v2.amb.stats()`);
  ok(!a2.playing && a2.hiddenPause && a2.persistent === 0, 'A-2a 탭이 숨으면 멎는다 (원천도 멈춤)', JSON.stringify({ playing: a2.playing, persistent: a2.persistent, master: a2.master }));
  await page.eval(`(()=>{ delete document.hidden; delete document.visibilityState;
    document.dispatchEvent(new Event('visibilitychange')); })()`, false);
  await sleep(600);
  const a2b = await page.eval(`window.__v2.amb.stats()`);
  ok(a2b.playing, 'A-2b 돌아오면 다시 켜진다', a2b.playing);

  /* A-3 — ♪ 끄기 */
  await page.eval(`document.getElementById('btnMusic').click()`, false);
  await sleep(900);
  const a3 = await page.eval(`({ amb: window.__v2.amb.stats(), key: localStorage.getItem('byeot.music') })`);
  ok(!a3.amb.playing && a3.key === 'off' && a3.amb.master < 0.01, 'A-3 ♪ 로 끄면 같이 멎는다', JSON.stringify({ playing: a3.amb.playing, key: a3.key, master: a3.amb.master }));
  await page.eval(`document.getElementById('btnMusic').click()`, false);
  await sleep(600);
  ok(await page.eval(`window.__v2.amb.isPlaying()`), 'A-3b ♪ 로 다시 켜면 같이 켜진다');

  /* A-4 — 구워서 잰다 */
  const bake = await page.eval(`(async () => {
    const { createMusic } = await import('./src/game/music.js');
    const { createAmbience } = await import('./src/game/ambience.js');
    const SR = 22050, SEC = 40;
    const stat = (buf) => { let s=0, pk=0, n=0; for (let c=0;c<buf.numberOfChannels;c++){ const d=buf.getChannelData(c);
      for (let i=0;i<d.length;i++){ const v=Math.abs(d[i]); s+=v*v; if(v>pk) pk=v; n++; } } return { rms: Math.sqrt(s/n), peak: pk }; };
    const out = {};
    { const ctx = new OfflineAudioContext(2, SR*SEC, SR); const m = createMusic(ctx); m._pumpUntil(SEC); out.music = stat(await ctx.startRendering()); }
    for (const [name, phase, rain] of [['day', 0.45, false], ['rainNight', 0.9, true]]) {
      const ctx = new OfflineAudioContext(2, SR*SEC, SR);
      const a = createAmbience(ctx, { rain, seed: 7 }); a._renderPlan(SEC, phase, 3);
      out[name] = { ...stat(await ctx.startRendering()), fired: a.stats().fired };
    }
    return out; })()`);
  const db = (x) => (20 * Math.log10(x)).toFixed(1);
  console.log('       구운 값:', JSON.stringify(bake));
  ok(bake.day.rms > 0.002, 'A-4a 낮 방 소리가 실제로 난다 (RMS>0.002)', bake.day.rms.toFixed(4));
  ok(bake.day.rms < bake.music.rms * 0.35 && bake.rainNight.rms < bake.music.rms * 0.45,
     'A-4b 음악 밑에 깔린다 (낮 −9dB 아래 · 비 밤 −7dB 아래)',
     `음악 ${db(bake.music.rms)}dB · 낮 ${db(bake.day.rms)}dB · 비 밤 ${db(bake.rainNight.rms)}dB`);
  ok(bake.day.peak < 0.5 && bake.rainNight.peak < 0.5, 'A-4c 튀는 소리가 없다 (최대 < 0.5)', `${bake.day.peak.toFixed(3)} · ${bake.rainNight.peak.toFixed(3)}`);
  ok(bake.day.fired.steps + bake.day.fired.car + bake.day.fired.moto >= 1, 'A-4d 40초 안에 창 너머 사건이 한 번은 난다', JSON.stringify(bake.day.fired));

  const fps = await page.eval(`window.__rv.stats().fps`);
  console.log('       fps(끝):', fps);
  ok(errs.length === 0, 'E 예외 · console.error 0건', errs.length ? errs.join('\n        ') : '0');
  await page.close();
}

/* ══ ② ?v2=0 — A/B ══════════════════════════════════════════ */
console.log('\n══ ?v2=0 ══');
{
  const { page, errs } = await open('?v2=0');
  await sleep(2500);
  await skipTalk(page); await page.eval(`(()=>{ const e=document.getElementById('guideClose'); if(e) e.click(); })()`, false);
  await sleep(1400);
  const home = await camOf(page);
  const id = await openTalk(page);
  await sleep(1400);
  const inn = await camOf(page);
  ok(!!id && Math.abs(inn.k - home.k) < 1e-4 && tgtD(inn, home) < 1e-4, 'B-1 ?v2=0 이면 대화에 카메라가 안 움직인다', `${home.k} → ${inn.k}`);
  await skipTalk(page);
  await mouse(page, 'mouseMoved', W / 2, 30, 0); await mouse(page, 'mousePressed', W / 2, 30, 1); await mouse(page, 'mouseReleased', W / 2, 30, 0);
  await sleep(1500);
  const r = await page.eval(`({ amb: window.__v2 && window.__v2.amb, v2: window.__v2 })`);
  ok(!r.amb && r.v2 && r.v2.v2amb === false && r.v2.v2cam === false, 'B-2 ?v2=0 이면 방 소리도 안 만든다', JSON.stringify(r.v2));
  ok(errs.length === 0, 'B-E 예외 0건', errs.length ? errs.join('\n        ') : '0');
  await page.close();
}

console.log(`\n${pass}/${pass + fail} 통과${fail ? ' — ✘ ' + fail : ''}`);
process.exit(fail ? 1 : 0);
