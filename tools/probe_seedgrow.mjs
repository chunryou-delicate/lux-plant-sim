/* ============================================================
   tools/probe_seedgrow.mjs — **씨앗으로 심은 몬스테라가 왜 53% 에서 멈추나** (2026-08-17)
   ------------------------------------------------------------
   박사님 실측 제보: *"새로 심은 몬스테라는 안 자라는 거 같어. 53%에서 멈춰 있어.
   광량은 2.9 지점에 2개 해놨는데 둘 다 동일해, 한 20일 지나도."*

   ══ 이 자가 세우는 판 ═══════════════════════════════════════════════════════
   박사님의 「2.9 지점」을 **실제로 만들어서** 잰다. 그 자리는 기본 배치에 없다 —
   **3단 선반을 서랍장 위에 얹어 창 쪽으로 밀어야** 맨 윗단이 2.87~2.95 가 된다
   (`light_thresholds.json §monstera_deliciosa` 의 min 2.7 주석이 말하는 바로 그 자리다).
   기본 배치의 선반 맨 윗단은 0.48~0.51 이라 씨앗이 **한 걸음도** 못 걷는다.

   ══ 무엇을 가르나 ═══════════════════════════════════════════════════════════
     선물 그루 (창턱 3.68 · 물 준다)      ← 잘 자라는 대조군
     씨앗 그루 A (선반 위 2.9 · 물 준다)
     씨앗 그루 B (선반 위 2.9 · **물 안 준다**)
   A 와 B 가 갈리면 **물**이고, 둘 다 같이 멈추면 **빛이나 머리공간**이다.

   ══ 같이 재는 것 ════════════════════════════════════════════════════════════
     · **화면 칸(빛 분포)의 숫자**와 **그 자리의 판정값(dliOfSlot)** 이 같은가
     · 선반을 올렸을 때 슬롯 DLI 가 따라 오르는가
     · 날마다: 유효 생장일 · dli7 · 밴드 · growthBlocked · 물 마른 날 · 머리공간

     python tools/serve.py 8963 .   (다른 창에서)
     node tools/probe_seedgrow.mjs

   ⚠ 해가 뜨고 지는 시계는 안 쓴다 — DLI 는 **하루치**라 시각 인자가 없다(`dliAt`).
     사진을 안 찍으므로 `waitNoon` 이 필요 없다.
============================================================ */
import { launch, sleep } from './test_cdp.mjs';

const _WATCHDOG_MS = +(process.env.BYEOT_PROBE_TIMEOUT_MS || 900000);
const _wd = setTimeout(() => {
  console.error('⏱ 자가 제한을 넘겨 멈춥니다 — 재는 중에 멈춘 것입니다.');
  process.exit(2);
}, _WATCHDOG_MS);
_wd.unref && _wd.unref();
process.on('exit', () => clearTimeout(_wd));

const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const DAYS = +(process.env.BYEOT_DAYS || 26);
const say = (ok, name, extra) =>
  console.log(`${ok ? '✔' : '✘'} ${name}${extra ? ' — ' + extra : ''}`);

const page = await launch({ width: 390, height: 844, dpr: 2, mobile: false });
const errs = [];
page.on((m, p) => { if (m === 'Runtime.exceptionThrown')
  errs.push(p.exceptionDetails.text + ' ' + ((p.exceptionDetails.exception || {}).description || '')); });

await page.goto(`${BASE}/game.html`);
await page.eval('localStorage.clear()', false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 150000, 300);
await sleep(6000);

const click = (id) => page.eval(`(()=>{try{document.getElementById('${id}').click()}catch{}})()`, false);
const skipTalk = async () => {
  for (let i = 0; i < 14; i++) {
    if (!(await page.eval(`document.getElementById('stage').classList.contains('talking')`))) break;
    await page.eval(`document.getElementById('dlgBox').click()`, false);
    await sleep(200);
  }
};
/* 동작이 끝날 때까지 — 하단 막대가 아니라 **하는 중인가**를 묻는다(START-HERE §2.9-⑥) */
const waitAct = async (ms = 15000) => {
  const t0 = Date.now();
  const acting = () => page.eval(`(()=>{ try { return !!window.__byeotWalkSfx().acting; } catch { return false; } })()`);
  for (let i = 0; i < 6; i++) { if (await acting()) break; await sleep(120); }
  while (Date.now() - t0 < ms) { if (!(await acting())) { await sleep(200); return true; } await sleep(200); }
  return false;
};
const dayNow = () => page.eval(`window.__S().day`);
/* [다음날] — **날짜가 실제로 올랐는지** 확인한다. 안 보면 안 간 날을 간 날로 읽는다 */
const nextDay = async () => {
  const d0 = await dayNow();
  for (let k = 0; k < 8; k++) {
    await click('next'); await sleep(700); await skipTalk();
    if ((await dayNow()) > d0) return true;
    await page.eval(`(()=>{const S=window.__S(); if(S.stamina) S.stamina.usedToday=0;})()`, false);
  }
  return false;
};
await click('dlgSkip'); await sleep(900);
await click('guideClose'); await sleep(500);

/* ══ ① 선물 몬스테라가 올 때까지 — 첫 플레이를 실제로 돈다 ═══════════════════
   (경로는 tools/probe_cutting_ui.mjs 를 그대로 따랐다. 시루는 **놓기 → 심기 두 걸음**이다) */
await page.eval(`(()=>{ const rv=window.__rv, c=document.getElementById('roomCanvas').getBoundingClientRect();
  const sp=rv.screenPosOf('banjiha-dresser:1');
  window.__drag.begin('beansprout', document.getElementById('cropThumb').src, {clientX:c.left+c.width*0.9, clientY:c.top+40});
  window.__drag.move({clientX:c.left+sp.x, clientY:c.top+sp.y}); window.__drag.end(); })()`, false);
await sleep(1200);
await page.eval(`(()=>{ const S=window.__S(); S.shop.stock.bean_seed = 9; })()`, false);
const rowAct = async (act) => {
  for (let k = 0; k < 8; k++) {
    const hit = await page.eval(`(()=>{ const b=[...document.querySelectorAll(
      '#siruList button[data-act="${act}"]')].find(x=>!x.disabled); if(!b) return false; b.click(); return true; })()`);
    if (!hit) break;
    await waitAct(); await sleep(400); await skipTalk();
  }
};
await page.eval(`window.__byeotSheet.open('plants')`, false); await sleep(400);
for (let i = 0; i < 60; i++) {
  if (await page.eval(`window.__S().pots.length > 0`)) break;
  await page.eval(`(()=>{const S=window.__S(); if(S.stamina) S.stamina.usedToday=0;})()`, false);
  await rowAct('plant'); await rowAct('water'); await rowAct('harvest'); await rowAct('sow');
  await nextDay();
}
const arrived = await page.eval(`(()=>{const S=window.__S();
  return {day:S.day, pots:S.pots.length, slot:(S.pots[0]||{}).slotId};})()`);
say(arrived.pots > 0, '선물 몬스테라가 도착했다', JSON.stringify(arrived));
if (!arrived.pots) { console.log('예외', JSON.stringify(errs.slice(0, 3))); await page.close(); process.exit(1); }

/* 선물 그루를 **창턱**으로 — 박사님 판과 같게(3.68 DLI · 느림) */
await page.eval(`(()=>{ const s=document.getElementById('slot'); s.value='banjiha-sill:0';
  s.dispatchEvent(new Event('change',{bubbles:true})); })()`, false);
await waitAct(); await sleep(800); await skipTalk();

/* ══ ② 「2.9 지점」을 만든다 — 서랍장을 창 밑으로, 그 위에 3단 선반 ═════════
   ⚠ 가구를 **화면과 조도가 같이** 움직이는 문(`__rv.commitFurnitureAt`)으로만 옮긴다.
     `io.light.moveFurniture` 만 부르면 조도는 옮겨지고 그림은 그대로라, 그 뒤의
     끌어 놓기가 **옛 자리**에 떨어진다(재는 자가 거짓말하는 길 하나). */
const slotDli = () => page.eval(`(()=>{ const io=window.__io;
  const c={weather:'clear',season:'summer',lampCount:0,litHours:0}; io.light.clearCache();
  return (io.light.room.slots||[]).map(s=>({ id:s.slotId, y:+s.y.toFixed(3),
    dli:+io.light.dliOfSlot(s.slotId,c).toFixed(3) })); })()`);
/* 화면 칸 값 — 빛 분포를 켜고 그 가구 위 칸을 읽는다(게임이 켜는 그 조건 그대로) */
const heatOf = (uid) => page.eval(`(()=>{ const rv=window.__rv, S=window.__S();
  rv.setLightHeatmap(true, {weather:'clear',season:'summer',
    lampCount:(S.lamps&&S.lamps.count)||0, litHours:(S.lamps&&S.lamps.litHours)||0});
  const cells=rv.lightHeatmapCells().filter(c=>c.onUid===${JSON.stringify(uid)});
  rv.setLightHeatmap(false);
  return cells.map(c=>({y:+c.y.toFixed(3), x:+c.x.toFixed(3), v:+c.value.toFixed(3)}))
              .sort((a,b)=>a.y-b.y||a.x-b.x); })()`);

const before = { slot: await slotDli(), heat: await heatOf('banjiha-etagere') };
const mv = (uid, x, z, rot) => page.eval(`(async()=>{ try{
  const r = await window.__rv.commitFurnitureAt('${uid}', {x:${x}, z:${z}, rot:${rot}});
  return {ok:true, to:r&&r.to}; }catch(e){ return {ok:false, e:e.message}; } })()`);
say((await mv('banjiha-etagere', 0.9, 1.2, 0)).ok, '3단 선반을 잠시 비켰다'); await sleep(1200);
/* ★ x −0.6 은 **재서 고른 자리**다. 창 한가운데(x 0)에 세우면 맨 윗단이 2.87~2.95 로 제일 밝지만
   **창턱이 3.68 → 0 으로 죽는다**(선반이 창을 가린다). x −0.6 이면 창턱은 3.68 그대로이고
   맨 윗단 두 칸이 2.87·2.94 — 박사님 판(선물은 창턱에서 잘 자라고 씨앗은 2.9)과 같아진다. */
say((await mv('banjiha-dresser', -0.6, -1.65, 0)).ok, '서랍장을 창 밑으로 옮겼다'); await sleep(1200);
const stacked = await mv('banjiha-etagere', -0.6, -1.775, 0); await sleep(1500);
say(stacked.ok, '3단 선반을 서랍장 위에 얹었다', JSON.stringify(stacked.to || stacked.e));

/* ⚠ 가구를 옮기면 그 위에 얹혀 있던 시루의 `at` 이 옛 자리에 남는다 — 그대로 두면 조도 계약이
   던지고 **그 뒤의 모든 놓기가 막힌다**(실측). 하루를 돌리면 `reseatAllOnSlots` 가 맞춰 준다. */
await nextDay(); await sleep(600); await skipTalk();

const after = { slot: await slotDli(), heat: await heatOf('banjiha-etagere') };
const eta = (rows) => rows.filter(s => s.id.startsWith('banjiha-etagere:'));
console.log('\n══ ① 자리 판정값(dliOfSlot) — 선반을 얹기 전·후 ══');
const bi = new Map(before.slot.map(s => [s.id, s]));
console.table(eta(after.slot).map(s => ({
  자리: s.id, '전 y': bi.get(s.id) ? bi.get(s.id).y : null, '전 DLI': bi.get(s.id) ? bi.get(s.id).dli : null,
  '후 y': s.y, '후 DLI': s.dli })));
console.log('\n══ ② 화면 칸(빛 분포) — 선반을 얹은 뒤 ══');
console.table(after.heat);
console.log('  (얹기 전 화면 칸: ' + JSON.stringify(before.heat.map(c => c.v)) + ')');

/* ══ ③ 씨앗을 **둘** 심는다 — 선반 맨 윗단의 두 칸 ═══════════════════════════ */
const topY = Math.max(...eta(after.slot).map(s => s.y));
const topIds = eta(after.slot).filter(s => Math.abs(s.y - topY) < 1e-3).map(s => s.id);
say(topIds.length >= 2, '선반 맨 윗단에 칸이 둘 이상 있다', topIds.join(', '));
/* ★ 창 쪽 두 칸을 쓴다 — 그 둘이 2.87·2.94 다(안쪽 칸은 2.63 이라 정체 밴드다).
   ⚠ 선반을 창 한가운데에 세우면 맨 윗단(y 1.594)이 창턱(y 1.585)과 9mm 차이라
     끝 칸을 겨눈 광선이 **창턱**을 맞는다 — x −0.6 으로 비켜 세운 까닭 중 하나다. */
const seat = [topIds[topIds.length - 2], topIds[topIds.length - 1]];

await page.eval(`(()=>{ const S=window.__S();
  S.shop.stock.monstera_seed = 4; S.shop.stock.pot = 4;
  if (S.stamina) S.stamina.usedToday = 0; })()`, false);
await page.eval(`window.__byeotSheet.open('plants')`, false); await sleep(400);

for (const id of seat) {
  /* 손이 모자라 못 놓는 것은 이 검사의 대상이 아니다 — 놓기·심기 둘 다 체력을 쓴다 */
  await page.eval(`(()=>{const S=window.__S(); if(S.stamina) S.stamina.usedToday=0;})()`, false);
  /* 가방에서 화분을 끌어 그 칸에 놓는다 — 손짓 그대로 */
  const r = await page.eval(`(()=>{ try{
    const rv=window.__rv, c=document.getElementById('roomCanvas').getBoundingClientRect();
    const sp=rv.screenPosOf(${JSON.stringify(id)});
    if(!sp) return {ok:false, why:'screenPosOf null'};
    window.__drag.begin('monsteraSeed:pot', '', {clientX:c.left+c.width*0.9, clientY:c.top+40});
    window.__drag.move({clientX:c.left+sp.x, clientY:c.top+sp.y}); window.__drag.end();
    return {ok:true};
  } catch(e){ return {ok:false, why:e.message}; } })()`);
  await sleep(900);
  await page.eval(`(()=>{const S=window.__S(); if(S.stamina) S.stamina.usedToday=0;})()`, false);
  await page.eval(`window.__byeotSheet.open('plants')`, false); await sleep(500);
  const sown = await page.eval(`(()=>{ const b=[...document.querySelectorAll('#emptyPotList [data-sow]')][0];
    if(!b) return {ok:false, why:'심기 단추가 없다'}; b.click(); return {ok:true}; })()`);
  await waitAct(); await sleep(900); await skipTalk();
  say(!!sown.ok, `${id} 자리에 씨앗을 심었다`, JSON.stringify({ drag: r, sown }));
}

const potsNow = await page.eval(`(()=>{ const S=window.__S(), io=window.__io;
  const c={weather:'clear',season:'summer',lampCount:0,litHours:0};
  return S.pots.map(p=>({id:p.id, slot:p.slotId, y:p.at? +p.at.y.toFixed(3):null,
    seed:!!p.fromSeed, watered:p.wateredOnDay,
    dli:(()=>{ try{ return +io.light.dliOfSlot(p.at?p:p.slotId, c).toFixed(3);}catch(e){return 'ERR';} })() })); })()`);
console.log('\n══ 심긴 화분 ══');
console.table(potsNow);
if (potsNow.length < 3) { console.log('예외', JSON.stringify(errs.slice(0, 3))); await page.close(); process.exit(1); }

const seedPots = potsNow.filter(p => p.seed).map(p => p.id);
const GIFT = potsNow[0].id, WET = seedPots[0], DRY = seedPots[1];
console.log(`\n선물: ${GIFT} · 물 주는 씨앗: ${WET} · 물 안 주는 씨앗: ${DRY}\n`);

/* ══ ④ 날마다 찍는다 ════════════════════════════════════════════════════════ */
const probeDay = `(async()=>{
  const S=window.__S(), io=window.__io, g=io.growth;
  const H = await import('/src/game/headroom.js');
  const room = io.light.room;
  const cur = g.current();
  const rows = [];
  for (const p of S.pots) {
    const gid = p.growthId || '__main__';
    let gd=null, d7=null, blk=null, ph=null, band=null;
    try { g.select(gid);
      gd=g.growthDays(); d7=g.dli7(); blk=g.growthBlocked(); ph=g.growthPhase();
      band = d7==null? null : ((g.bandOf&&g.bandOf(d7,p.variegated))||{}).band;
    } catch(e) { blk='SELECT ERR '+e.message; }
    let hr=null;
    try { hr = p.at ? H.headroomCheck(p.at, gd, { size:room.size,
            occluders:(room.built&&room.built.occluders)||[], slots:room.slots||[], potD:0.20 }) : null;
    } catch(e) { hr={err:e.message}; }
    const hist = p.dliHist||[];
    rows.push({ day:S.day, pot:p.id, slot:p.slotId,
      dliToday: hist.length? +Number(hist[hist.length-1]).toFixed(3) : null,
      growthDays: gd, dli7: d7==null?null:+d7.toFixed(3), band,
      phase: ph? ph.phaseId+' '+Math.round(ph.progress01*100)+'%' : null,
      blocked: blk, dryDays: S.day-(p.wateredOnDay==null?S.day:p.wateredOnDay),
      headBlocked: hr? !!hr.blocked : null, headM: hr? hr.headroomM : null,
      cared: p.daysPlanted, fedDays: p.fedDays });
  }
  try { g.select(cur); } catch {}
  return rows;
})()`;

const log = [];
for (let d = 0; d < DAYS; d++) {
  await page.eval(`(()=>{const S=window.__S(); if(S.stamina) S.stamina.usedToday=0;})()`, false);
  /* 선물 그루와 WET 그루에만 물을 준다 — 줄 수 있을 때만 그 줄에 단추가 선다 */
  for (const id of [GIFT, WET]) {
    const hit = await page.eval(`(()=>{ const b=document.querySelector(
      '#plantList [data-plantwater="${id}"]'); if(!b||b.disabled) return false; b.click(); return true; })()`);
    if (hit) { await waitAct(); await sleep(300); await skipTalk(); }
  }
  await page.eval(`(()=>{const S=window.__S(); if(S.stamina) S.stamina.usedToday=0;})()`, false);
  if (!(await nextDay())) { console.log('  ⚠ 날짜가 안 올랐습니다 — 여기서 멈춥니다'); break; }
  const rows = await page.eval(probeDay);
  log.push(...rows);
  console.log(`  day ${rows[0].day}  ` + rows.map(r =>
    `${r.pot} ${r.growthDays}일(${r.dli7} ${r.band}) 물${r.dryDays}${r.blocked ? ' ✖빛' : ''}${r.headBlocked ? ' ✖머리' : ''}`).join(' | '));
}

/* == (5) **마른 그루에 물을 주면 다시 자라나** ================================
   여기까지가 "왜 멈추나" 이고, 이 절이 "어떻게 풀리나" 다. 박사님 화면에는
   「물 준 지 3/9일」이 찍혀 있었다 — 물을 줬는데도 안 자란다면 원인이 하나 더 있다는 뜻이다. */
const btnBack = await page.eval(`(()=>{ const b=document.querySelector(
  '#plantList [data-plantwater="${DRY}"]');
  return { there: !!b, disabled: b? !!b.disabled : null }; })()`);
say(btnBack.there && !btnBack.disabled, `${DRY} 줄에 [물 주기] 단추가 서 있다`, JSON.stringify(btnBack));
await page.eval(`(()=>{const S=window.__S(); if(S.stamina) S.stamina.usedToday=0;})()`, false);
await page.eval(`(()=>{ const b=document.querySelector('#plantList [data-plantwater="${DRY}"]');
  if(b) b.click(); })()`, false);
await waitAct(); await sleep(500); await skipTalk();
for (let k = 0; k < 4; k++) {
  await page.eval(`(()=>{const S=window.__S(); if(S.stamina) S.stamina.usedToday=0;})()`, false);
  if (!(await nextDay())) break;
  const rows = await page.eval(probeDay);
  log.push(...rows);
  console.log(`  (물 준 뒤) day ${rows[0].day}  ` + rows.map(r =>
    `${r.pot} ${r.growthDays}일 물${r.dryDays}${r.blocked ? ' 빛막힘' : ''}`).join(' | '));
}

console.log('\n══ 날마다 ══');
const cols = ['day', 'pot', 'slot', 'dliToday', 'dli7', 'band', 'growthDays', 'phase',
              'blocked', 'dryDays', 'headBlocked', 'headM', 'cared', 'fedDays'];
console.log(cols.join('\t'));
for (const r of log) console.log(cols.map(c => r[c] == null ? '' : r[c]).join('\t'));

const last = {};
for (const r of log) last[r.pot] = r;
console.log('\n══ 마지막 날 ══');
console.table(Object.values(last).map(r => ({
  화분: r.pot, 자리: r.slot, '오늘DLI': r.dliToday, dli7: r.dli7, 밴드: r.band,
  유효생장일: r.growthDays, 단계: r.phase, 막힘: r.blocked, '마른 날': r.dryDays,
  머리막힘: r.headBlocked, 머리공간: r.headM, '돌본 날': r.cared })));
console.log('\n예외:', JSON.stringify(errs.slice(0, 5)));
await page.close();
