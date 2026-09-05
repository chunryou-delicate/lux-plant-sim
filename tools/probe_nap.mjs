/* tools/probe_nap.mjs — **⑦ 침대 눕기·낮잠 · 의자 앉기가 «걸어서» 되나** (2026-09-04 · plan-nap-and-sit)
   ------------------------------------------------------------------
   재는 것:
     ① 의자를 누르면 메뉴에 [앉기]가 뜨고 ⇒ 누르면 사람이 의자 «한가운데»로 가 앉아 «있는다»(restingOn) ⇒ 다시 누르면 [일어서기]
     ② 침대 [눕기] ⇒ 침대 «위»(y 가 바닥보다 높다)에 누워 있는다 ⇒ [일어나기]
     ③ 침대 [낮잠자기] ⇒ 체력 +올림(max×몫) · 시계 두 시간 · 같은 날 또 누르면 「오늘은 이미 잤습니다 — 내일 다시」(잠김) · 세이브에 nappedOnDay
     ④ 앉아 있다가 바닥을 누르면 일어나서 간다
   판: 1770×1188 · 새 판(localStorage 비움) · 진짜 마우스(CDP). 값(10%·2시간)은 침대 프리셋 것 — 여기서 «읽기만» 한다.
   ⚠ 사람 자리는 «방뷰가 말하는 것»(restingOn · 캐릭터 root)으로 재고, 그림은 docs/handoff/img/nap_*.png 로 남긴다. */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8972';
const W = Number(process.env.W || 1770), H = Number(process.env.H || 1188);
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 480000);
wd.unref && wd.unref();
const page = await launch({ width: W, height: H, dpr: 1 });
await page.goto(`${BASE}/game.html`);
await page.eval('localStorage.clear()', false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 150000, 300);
await sleep(4000);
const m = (type, x, y, buttons) => page.send('Input.dispatchMouseEvent',
  { type, x: Math.round(x), y: Math.round(y), button: 'left', buttons, clickCount: 1 });
const tapAt = async (x, y) => { await m('mouseMoved', x, y, 0); await m('mousePressed', x, y, 1);
  await sleep(80); await m('mouseReleased', x, y, 0); await sleep(700); };
const clearDlg = async () => { for (let i = 0; i < 40; i++) {
  const t = await page.eval(`String(document.getElementById('stage').classList.contains('talking'))`);
  if (t !== 'true') return true;
  await page.eval(`(()=>{ const x=document.getElementById('dlgBox'); if (x) x.click(); })()`, false);
  await sleep(200); } return false; };
await clearDlg(); await sleep(500); await clearDlg();
/* ⚠ 손가락이 떠 있는 동안은 울타리가 가구 누르기를 «막는다»(뜻대로). 그러니 test_uiwire 와 같이 첫 플레이를 끄고 잰다 —
   앉기·눕기·낮잠은 «자유» 구간의 것이다. */
await page.eval(`(()=>{ try { const S=window.__S(); if (S.firstPlay) S.firstPlay.enabled = false;
  window.__byeotHint && window.__byeotHint(); window.__redraw && window.__redraw(); } catch(e) {} })()`, false);
await sleep(800);
const J =async (js) => JSON.parse(await page.eval(`(()=>{ try { return JSON.stringify((${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`));
const btn = async (id) => J(`(()=>{ const b=document.getElementById('${id}'); if(!b) return null; const r=b.getBoundingClientRect();
  return { 보임: r.width>0 && getComputedStyle(b).display!=='none', 글: b.textContent.trim(), 잠김: !!b.disabled, x:r.left+r.width/2, y:r.top+r.height/2 }; })()`);
const presets = JSON.parse(await page.eval(`(async()=>{ const r = await fetch('/data/furniture_presets.json'); return JSON.stringify(await r.json()); })()`, true, 30000));
const furn = await J(`window.__rv.furniture()`);
const typeOf = f => { try { return ((presets && (presets.presets || presets))[f.preset] || {}).type || null; } catch { return null; } };
const chair = furn.find(f => typeOf(f) === 'chair'), bed = furn.find(f => typeOf(f) === 'bed');
console.log('■ 가구 —', furn.map(f => `${f.uid}(${typeOf(f) || '-'})`).join(' · '));
const out = []; const ok = (ko, v, why) => { out.push([ko, !!v, why]); console.log(`  ${v ? 'OK  ' : 'FAIL'} ${ko}  → ${why}`); };
const charPos = async () => J(`(()=>{ const c=window.__rv.charInfo ? window.__rv.charInfo('jachwi') : null; return c; })()`);
const pickFurn = async (f) => {
  const p = await J(`window.__rv.screenPosOf('${f.uid}')`);
  const cr = await J(`(()=>{ const r=document.getElementById('roomCanvas').getBoundingClientRect(); return {l:r.left,t:r.top}; })()`);
  if (!p) return null;
  /* 한가운데가 다른 것(사람·벽)에 가리면 둘레를 짚어 본다 — test_uiwire §tapPick 과 같은 손 */
  let lastGot = null;
  for (const [dx, dy] of [[0, 0], [0, 18], [18, 0], [-18, 0], [0, -18], [24, 24], [-24, 24], [0, -40], [0, 40], [-40, 0], [40, 0]]) {
    await tapAt(cr.l + p.x + dx, cr.t + p.y + dy); await sleep(450);
    const got = await J(`(()=>{ return { 골림: document.getElementById('stage').classList.contains('furnpicked'), uid: window.__furn ? window.__furn.uid : null,
      이름: (document.getElementById('furnName')||{}).textContent||'', 무대: document.getElementById('stage').className }; })()`);
    lastGot = got;
    if (got && got.골림 && (!got.uid || got.uid === f.uid)) return p;
    await page.eval(`(()=>{ try { window.__furn && window.__furn.clear(); } catch(e){} const c=document.getElementById('furnClose'); if (c) c.click(); })()`, false);
  }
  console.log(`   ⚠ ${f.uid} 를 못 골랐다 — 화면 자리 ${JSON.stringify(p)} · 마지막 ${JSON.stringify(lastGot)}`);
  return null;
};
/* 동작이 끝나기를 기다린다 — 걷기·클립까지. 무엇이 났나(배너·상태)를 같이 적는다 */
/* ⚠ 헤드리스는 그림이 느려(2fps 안팎) 사람 걸음의 dt 가 0.1초로 잘린다 — 1.6초 클립이 열 몇 초 걸린다. 넉넉히 기다린다. */
const waitAct = async (ms = 90000) => {
  const t0 = Date.now(); let last = null;
  while (Date.now() - t0 < ms) {
    last = await J(`(()=>{ return { st: window.__rv.actState(), on: window.__rv.restingOn(),
      배너: ((document.getElementById('banner')||{}).textContent||'').trim().slice(0, 80) }; })()`);
    if (last && !last.st && (last.on || Date.now() - t0 > 2500)) break;
    await sleep(300);
  }
  if (last) last.걸린초 = +((Date.now() - t0) / 1000).toFixed(1);
  return last;
};
/* ① 의자 */
if (chair) {
  const p = await pickFurn(chair);
  const b = await btn('furnSit');
  ok('의자를 누르면 [앉기]가 뜬다', p && b && b.보임 && b.글 === '앉기', JSON.stringify(b));
  if (b && b.보임) {
    await tapAt(b.x, b.y);
    const w = await waitAct(); const on = w && w.on, st = w && w.st;
    ok('앉아 «있는다»(restingOn = 의자 · 동작 끝)', on && on.key === chair.uid && on.kind === 'sit' && !st, JSON.stringify(w));
    /* ★ [char] c53e661 이 잰 것: 앉는 면 y(surfaceTopAt) 와 사람 pos.y — 높이는 가구에게 묻는다 */
    const sy = await J(`(()=>{ const c=(window.__rv.characters()||[]).find(x=>x.id==='jachwi'); const t=window.__rv.surfaceTopAt(${chair.x}, ${chair.z});
      return { 사람y: c ? +c.pos.y.toFixed(3) : null, 앉는면y: t ? +(+t.y).toFixed(3) : null, ground: c && c.ground ? c.ground : null }; })()`);
    ok('앉는 높이 = 의자 앉는 면(surfaceTopAt)', sy && sy.사람y != null && sy.앉는면y != null && Math.abs(sy.사람y - sy.앉는면y) < 0.02, JSON.stringify(sy));
    await page.shot('docs/handoff/img/nap_sit.png').catch(() => {});
    const p2 = await pickFurn(chair);
    const b2 = await btn('furnSit');
    ok('앉은 채 의자를 누르면 [일어서기]', p2 && b2 && b2.글 === '일어서기', JSON.stringify(b2));
    /* ④ 바닥을 누르면 일어나서 간다 — 사람을 고른 뒤 바닥 */
    await page.eval(`document.getElementById('furnClose').click()`, false); await sleep(300);
    const r = await J(`(()=>{ const w = window.__rv.walkTo('jachwi', ${Math.round(W * 0.45)}, ${Math.round(H * 0.62)}); return w; })()`);
    await sleep(2500);
    const on2 = await J(`window.__rv.restingOn()`);
    ok('바닥으로 걸어가라 하면 «일어나서» 간다', r && r.ok !== false && !on2, JSON.stringify({ r, on2 }));
  }
} else ok('방에 의자가 있다', false, '없음');
/* ② 침대 눕기 */
if (bed) {
  await clearDlg();
  const p = await pickFurn(bed);
  const b = await btn('furnLie'), n0 = await btn('furnNap');
  ok('침대를 누르면 [눕기]·[낮잠자기]가 뜬다', p && b && b.보임 && b.글 === '눕기' && n0 && n0.보임 && n0.글 === '낮잠자기', JSON.stringify({ b, n0 }));
  if (b && b.보임) {
    await tapAt(b.x, b.y);
    const w = await waitAct(); const on = w && w.on;
    console.log('   ↳ 눕기 뒤 —', JSON.stringify(w));
    const y = await J(`(()=>{ const c = (window.__rv.characters() || []).find(x => x.id === 'jachwi'); return c ? c.pos.y : null; })()`);
    ok('누워 «있는다»(restingOn = 침대)', on && on.key === bed.uid && on.kind === 'sleep', JSON.stringify(on));
    ok('침대 «위»에 눕는다(사람 y > 0.15)', y == null || y > 0.15, `y=${y}` + (y == null ? ' (charInfo 없음 — 그림으로 본다)' : ''));
    await page.shot('docs/handoff/img/nap_sleep.png').catch(() => {});
    const p2 = await pickFurn(bed);
    const b2 = await btn('furnLie');
    ok('누운 채 침대를 누르면 [일어나기]', p2 && b2 && b2.글 === '일어나기', JSON.stringify(b2));
    if (b2 && b2.보임) { await tapAt(b2.x, b2.y); await sleep(1200); }
    const on3 = await J(`window.__rv.restingOn()`);
    ok('[일어나기]로 일어난다', !on3, JSON.stringify(on3));
  }
  /* ③ 낮잠 — 체력을 먼저 쓴다(가득이면 +0 이라 잰 것이 없다) */
  await clearDlg();
  const before = await J(`(()=>{ const s=window.__S(); return { left:s.stamina.left, max:s.stamina.max, day:s.day, clock: window.__dayClock().elapsed01, napped: s.stamina.nappedOnDay }; })()`);
  if (before.left >= before.max) {
    await page.eval(`(async()=>{ const m = await import('/src/game/stamina.js'); m.spend(window.__S(), 'water'); m.spend(window.__S(), 'water'); })()`, true, 20000);
  }
  const b0 = await J(`(()=>{ const s=window.__S(); return { left:s.stamina.left, max:s.stamina.max, clock: window.__dayClock().elapsed01 }; })()`);
  const pb = await pickFurn(bed);
  const n = await btn('furnNap');
  if (pb && n && n.보임) {
    await tapAt(n.x, n.y); await sleep(1500);
    const a = await J(`(()=>{ const s=window.__S(); return { left:s.stamina.left, max:s.stamina.max, day:s.day, clock: window.__dayClock().elapsed01, napped: s.stamina.nappedOnDay, 배너: (document.getElementById('banner')||{}).textContent||'' }; })()`);
    const frac = ((presets.presets || presets)[bed.preset] || {}).nap_recover_frac, hours = ((presets.presets || presets)[bed.preset] || {}).nap_hours;
    const want = Math.min(Math.ceil(b0.max * frac), b0.max - b0.left);
    ok(`낮잠 — 체력 +올림(max ${b0.max} × ${frac}) = +${want}`, a.left === b0.left + want, `${b0.left} → ${a.left} (max ${a.max})`);
    ok(`낮잠 — 시계가 ${hours}시간 간다`, Math.abs((a.clock - b0.clock) - hours / 24) < 0.012 /* 재는 사이에도 시계는 돈다(576초/하루 · 헤드리스는 재는 데 3~5초 ≈ 0.006~0.009) */, `${b0.clock.toFixed(4)} → ${a.clock.toFixed(4)} (Δ ${(a.clock - b0.clock).toFixed(4)} · 바람 ${(hours / 24).toFixed(4)})`);
    ok('낮잠 — 잔 날이 적힌다(nappedOnDay = 오늘)', a.napped === a.day, `nappedOnDay ${a.napped} · day ${a.day}`);
    const w2 = await waitAct(); const on = w2 && w2.on;
    ok('낮잠 — 누워 있는 그림', on && on.key === bed.uid && on.kind === 'sleep', JSON.stringify(w2));
    await page.shot('docs/handoff/img/nap_nap.png').catch(() => {});
    /* 같은 날 또 */
    const pb2 = await pickFurn(bed);
    const n2 = await btn('furnNap');
    ok('같은 날 또 누르면 「오늘은 이미 잤습니다 — 내일 다시」(잠김)', pb2 && n2 && /오늘은 이미 잤습니다/.test(n2.글) && n2.잠김, JSON.stringify(n2));
    await page.eval(`document.getElementById('furnClose').click()`, false);
    /* 세이브에 실리나 */
    const rt = JSON.parse(await page.eval(`(async()=>{ try { const sv=await import('/src/game/save.js'); const raw=sv.serialize(window.__S()); const o=(typeof raw==='string')?JSON.parse(raw):raw;
      return JSON.stringify({ 실림: o.state && o.state.stamina && o.state.stamina.nappedOnDay }); } catch(e) { return JSON.stringify({ 탈: e.message }); } })()`, true, 30000));
    ok('세이브에 nappedOnDay 가 실린다', rt && rt.실림 === a.day, JSON.stringify(rt));
  } else ok('침대 메뉴에 [낮잠자기]', false, JSON.stringify(n));
} else ok('방에 침대가 있다', false, '없음');
console.log('');
const bad = out.filter(o => !o[1]).length;
console.log(bad ? `⛔ ${bad}개가 떨어졌습니다` : `★ ${out.length}/${out.length} 통과`);
await page.close(); clearTimeout(wd);
