/* ★★★ 옮기기·심기 전수 검토 (2026-08-17 · 박사님: *"내가 얘기한 거 싹 다 수정하고
     니가 확인해서 검토해. 특히 몬스테라 이동이랑 씨앗 관련 건. 그리고 3단장이나 책상에
     화분 올리고 가구 이동하면 가구 따라가게 다시 검토해."*)
   ══════════════════════════════════════════════════════════════════
   이 저장소가 오늘만 **같은 뿌리를 셋** 뽑았다 — 「모르는 것이면 몬스테라」라는 밑값이
   화면 곳곳에 남아, 무엇을 집든 선물 몬스테라가 끌려갔다:
     ① 둘째 몬스테라  ② 빈 화분  ③ 무순 재배판
   ⇒ 그래서 이 자는 **놓인 것을 하나씩 다 집어 본다.** 「집은 것 = 붙든 것」이 아니면 빨갛다.
     하나만 재면 나머지가 조용히 남는다(오늘 세 번 그랬다).

   ★ 그리고 **가구를 옮기면 그 위의 것이 따라오나**를 잰다. 좌표로 잰다 —
     사진으로는 「따라온 것처럼」 보이는 것과 실제로 따라온 것을 못 가른다(§2.9 ②). */
import { launch, sleep } from './test_cdp.mjs';

const _WATCHDOG_MS = +(process.env.BYEOT_PROBE_TIMEOUT_MS || 900000);
const _wd = setTimeout(() => { console.error('⏱ 자가 제한을 넘겨 멈춥니다'); process.exit(2); }, _WATCHDOG_MS);
_wd.unref && _wd.unref();
process.on('exit', () => clearTimeout(_wd));

const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const page = await launch({ width: 390, height: 844, dpr: 2, mobile: false });
const errs = [];
page.on(m => { if (m.method === 'Runtime.exceptionThrown') errs.push((m.params.exceptionDetails.exception || {}).description || ''); });

await page.goto(`${BASE}/game.html`);
await page.eval(`localStorage.clear()`, false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('window.__byeotBooted === true', 180000, 300);
await sleep(6000);
const clear = async () => {
  for (let i = 0; i < 30; i++) {
    const b = await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');
      return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`);
    if (!b) return;
    await page.eval(`(()=>{const g=document.getElementById('guideClose'); if(g&&g.offsetParent){g.click();return;}
      const b=document.getElementById('dlgBox'); if(b)b.click();})()`, false);
    await sleep(250);
  }
};
await clear();

/* ══ 판을 짓는다 — **실제 첫 플레이로** 선물 몬스테라를 받는다 ══════════════
   ⚠ 상태만 만져서는 선물 그루가 안 생긴다(`givePlant` 이 첫 수확에서 부른다).
     그루가 하나뿐이면 「집은 것 = 붙든 것」이 시시해진다 — 오늘 뽑은 세 사고가 전부
     **둘 이상일 때**만 드러났다. 그래서 굴려서 받는다. */
const waitAct = async (ms = 15000) => {
  const t0 = Date.now();
  const acting = () => page.eval(`(()=>{ try { return !!window.__byeotWalkSfx().acting; } catch { return false; } })()`);
  for (let i = 0; i < 6; i++) { if (await acting()) break; await sleep(120); }
  while (Date.now() - t0 < ms) { if (!(await acting())) { await sleep(250); return true; } await sleep(250); }
  return false;
};
const rowAct = async (act) => {
  for (let k = 0; k < 8; k++) {
    const hit = await page.eval(`(()=>{ const b=[...document.querySelectorAll(
      '#siruList button[data-act="${act}"]')].find(x=>!x.disabled); if(!b) return false; b.click(); return true; })()`);
    if (!hit) break;
    await waitAct(); await sleep(350); await clear();
  }
};
await page.eval(`(()=>{ const rv=window.__rv, c=document.getElementById('roomCanvas').getBoundingClientRect();
  const sp=rv.screenPosOf('banjiha-dresser:1');
  window.__drag.begin('beansprout', document.getElementById('cropThumb').src, {clientX:c.left+c.width*0.9, clientY:c.top+40});
  window.__drag.move({clientX:c.left+sp.x, clientY:c.top+sp.y}); window.__drag.end(); })()`, false);
await sleep(1200);
await page.eval(`(()=>{ const S=window.__S(); S.shop.stock.bean_seed = 9; })()`, false);
await page.eval(`(()=>{const b=document.getElementById('placeOk'); if(b&&b.offsetParent)b.click();})()`, false);
await sleep(1000); await clear();
await page.eval(`window.__byeotSheet.open('plants')`, false); await sleep(500);
for (let i = 0; i < 60; i++) {
  if (await page.eval(`window.__S().pots.length > 0`)) break;
  await page.eval(`(()=>{const S=window.__S(); if(S.stamina) S.stamina.usedToday=0;})()`, false);
  await rowAct('plant'); await rowAct('water'); await rowAct('harvest'); await rowAct('sow');
  await page.eval(`(()=>{try{document.getElementById('next').click()}catch{}})()`, false);
  await sleep(900); await clear();
}
console.log('선물 도착     :', await page.eval(`(()=>{const S=window.__S();
  return JSON.stringify({day:S.day, 그루:S.pots.map(p=>p.id)});})()`));
/* 재고를 넣고 씨앗 화분·무순 판을 더 세운다 */
await page.eval(`(()=>{ const S=window.__S();
  S.shop.stock.pot_concrete_square = 1; S.shop.stock.monstera_seed = 3;
  S.shop.stock.pot = 1; S.shop.stock.sprout_tray = 1; S.shop.stock.radish_seed = 1;
  if (S.stamina) S.stamina.usedToday = 0; window.__redraw && window.__redraw(); })()`, false);
await sleep(600);
/* 씨앗 화분 → 책상 위에 심는다 (씨앗 관련 건) */
await page.eval(`window.__placePot('monsteraSeed:pot_concrete_square')`, false);
await sleep(1500); await clear();
await page.eval(`(()=>{ const S=window.__S(), io=window.__io;
  const ep=(S.emptyPots||[])[0]; if(!ep) return;
  const sl=(io.light.room.slots||[]).find(x=>/desk:0$/.test(x.slotId));
  if(!sl) return;
  ep.slotId = sl.slotId; ep.at = { x: sl.x, y: sl.y, z: sl.z, onUid: 'banjiha-desk', occIdx: sl.occIdx ?? null };
  window.__redraw && window.__redraw(); })()`, false);
await sleep(1000);
await page.eval(`window.__byeotSheet.open('plants')`, false); await sleep(700);
await page.eval(`(()=>{const b=[...document.querySelectorAll('#emptyPotList [data-sow]')][0]; if(b)b.click();})()`, false);
await sleep(1300);
await page.eval(`(()=>{ for(const b of document.querySelectorAll('button')){
  if(/몬스테라/.test(b.textContent||'') && b.offsetParent && !b.disabled){ b.click(); return; } } })()`, false);
await sleep(1600); await clear();
/* 빈 화분 하나 더(검은 모종포트) — 회수 단추를 잴 것이다 */
await page.eval(`window.__placePot('monsteraSeed:pot')`, false); await sleep(1400); await clear();
/* 무순 판 */
await page.eval(`(()=>{ const rv=window.__rv, c=document.getElementById('roomCanvas').getBoundingClientRect();
  const sp=rv.screenPosOf('banjiha-etagere:8');
  const t=document.getElementById('musunThumb');
  window.__drag.begin('musun', t?t.src:'', {clientX:c.left+20, clientY:c.top+20});
  window.__drag.move({clientX:c.left+sp.x, clientY:c.top+sp.y}); window.__drag.end(); })()`, false);
await sleep(1600); await clear();
await page.eval(`(()=>{ try{window.__byeotSheet.close()}catch{} })()`, false); await sleep(400);
console.log('판           :', await page.eval(`(()=>{const S=window.__S();
  return JSON.stringify({ 그루:S.pots.map(p=>({id:p.id,slot:p.slotId,asset:p.potAsset})),
    빈화분:(S.emptyPots||[]).map(e=>({id:e.id,itemId:e.itemId})),
    방:window.__rv.plants().map(r=>({key:r.key,kind:r.kind})) });})()`));

/* ── ⓪ 자리와 좌표가 서로 맞나 — **어긋나면 그 가구를 영영 못 옮긴다** ──────
   조도 엔진이 `slotId` 와 `at` 을 견주어 어긋나면 던진다. 실측에서 그 던짐 때문에
   3단 선반·서랍장이 **한 톨도 안 움직였다.** 옮기기 전에 먼저 본다. */
const slotAudit = async (tag) => {
  console.log('');
  console.log(`── ⓪ 자리와 좌표가 맞나 (${tag}) ──────────────────────`);
  const rows = JSON.parse(await page.eval(`(()=>{ const S=window.__S(), io=window.__io;
    const slots=io.light.room.slots||[];
    const out=[];
    const chk=(o,ko)=>{ if(!o||!o.slotId||!o.at) return;
      if(String(o.slotId).startsWith('free:')) return;
      const s=slots.find(x=>x.slotId===o.slotId); if(!s) return;
      const d=Math.max(Math.abs(s.x-o.at.x), Math.abs(s.z-o.at.z));
      out.push({ 것:ko+' '+o.id, 자리:o.slotId, 어긋남:+d.toFixed(3),
                 자리xz:[+s.x.toFixed(3),+s.z.toFixed(3)], atxz:[+o.at.x.toFixed(3),+o.at.z.toFixed(3)] }); };
    for(const p of (S.pots||[])) chk(p,'화분');
    for(const p of (S.emptyPots||[])) chk(p,'빈그릇');
    try { for(const site of [S.firstPlay.beansprout, S.firstPlay.musun].filter(Boolean)){
      chk(site,'자리'); for(const p of (site.pots||[])) chk(p,'작물'); } } catch {}
    return JSON.stringify(out); })()`));
  let off = 0;
  for (const r of rows) {
    const ok = r.어긋남 < 0.01;
    if (!ok) off++;
    console.log(`  ${ok ? '✔' : '✘'} ${r.것} · ${r.자리} · 어긋남 ${r.어긋남}m ${ok ? '' : `(자리 ${r.자리xz} vs at ${r.atxz})`}`);
  }
  console.log(off ? `✘ ${off}개가 어긋나 있다 — 그 가구는 못 옮긴다` : '✔ 전부 맞는다');
  return off;
};
await slotAudit('옮기기 전');

/* ── ① 놓인 것을 **하나씩 다 집어 본다** ───────────────────────────── */
console.log('');
console.log('── ① 집은 것과 붙든 것이 같은가 ────────────────────────');
const grabs = JSON.parse(await page.eval(`(()=>{ try {
  const rv=window.__rv, out=[];
  for (const r of rv.plants()) {
    window.__picked.clear();
    window.__picked.select(r.key);
    window.__picked.beginMove();
    out.push({ 열쇠:r.key, 방:r.kind, 방potId:r.potId,
               화면이본종류:window.__picked.kindAt(r.key), 붙든것:window.__picked.potId });
    window.__picked.clear();
  }
  return JSON.stringify(out);
} catch(e){ return JSON.stringify([{err:e.message}]); } })()`));
let bad = 0;
for (const g of grabs) {
  const want = g.방potId;
  const ok = !want || g.붙든것 === want;
  if (!ok) bad++;
  console.log(`  ${ok ? '✔' : '✘'} ${g.열쇠} · 방 ${g.방} → 화면 ${g.화면이본종류} · 붙든 것 ${g.붙든것}${ok ? '' : ` (마땅히 ${want})`}`);
}
console.log(bad ? `✘ ${bad}개가 딴 것을 붙든다` : '✔ 놓인 것 전부 제 것을 붙든다');

/* ── ② 가구를 옮기면 그 위의 것이 따라오나 ────────────────────────── */
console.log('');
console.log('── ② 가구를 옮기면 위의 것이 따라오나 ──────────────────');
/* ⚠⚠ **어느 가구 위인지**를 같이 잰다. 처음에 「바닥이 아니면 가구 위」로만 걸렀다가
   서랍장·3단 선반 위의 것을 「책상을 밀었는데 안 따라왔다」로 찍었다 — 안 따라오는 것이
   맞는 것들이었다. 자가 **엉뚱한 것을 세면 그 자체가 거짓 보고**다(§2.9 ⑦). */
const posOf = () => page.eval(`(()=>{ const rv=window.__rv, S=window.__S();
  const onOf = (key) => {
    const id = String(key).replace(/^free:/, '');
    const all = [...(S.pots||[]), ...(S.emptyPots||[]), ...(S.cuttings||[])];
    try { for (const site of (S.firstPlay ? [S.firstPlay.beansprout, S.firstPlay.musun].filter(Boolean) : []))
            all.push(...(site.pots||[])); } catch {}
    const o = all.find(x => x && (x.id === id || x.slotId === key));
    return (o && o.at && o.at.onUid) || null;
  };
  return JSON.stringify(rv.plants().map(r=>({key:r.key, kind:r.kind, on:onOf(r.key),
    x:+r.pos.x.toFixed(3), y:+r.pos.y.toFixed(3), z:+r.pos.z.toFixed(3)}))); })()`);
for (const uid of ['banjiha-desk', 'banjiha-etagere', 'banjiha-dresser']) {
  const before = JSON.parse(await posOf());
  /* ⚠⚠ **화면이 쓰는 그 길**로 옮긴다. 처음에 `io.light.moveFurniture` 를 직접 불렀다가
     「안 따라온다」는 거짓 결론을 냈다 — 따라오게 하는 장치(`furnPicked.afterMove` →
     `followFreeOnFurniture`)가 그 아래에 있는데 건너뛴 것이다(§2.9 ④ 자가 딴 길을 잰다). */
  /* ⚠ 한 방향이 막히면(다른 가구와 겹침) **반대쪽도 해 본다** — 못 움직이면 이 줄로는
     아무것도 못 재는데, 그것을 「따라왔다/안 따라왔다」로 적으면 그게 거짓 보고다. */
  const moved = await page.eval(`(async ()=>{ const io=window.__io, rv=window.__rv;
    const f=(io.light.furnitureList()||[]).find(x=>x.uid===${JSON.stringify(uid)});
    if(!f) return 'no-furn';
    let last='';
    for (const d of [0.5, -0.5, 0.25, -0.25]) {
      try {
        const r = await rv.commitFurnitureAt(${JSON.stringify(uid)}, { x: f.x + d, z: f.z, rot: f.rot||0 });
        window.__furn.afterMove(r, '');
        if (Math.abs(r.to.x - r.from.x) < 0.01) { last='안 움직임'; continue; }
        return JSON.stringify({ from:{x:+r.from.x.toFixed(2), z:+r.from.z.toFixed(2)},
                                to:{x:+r.to.x.toFixed(2), z:+r.to.z.toFixed(2)} });
      } catch(e){ last = (e&&e.message)||''; }
    }
    return 'ERR '+last; })()`);
  await page.eval(`(()=>{ try{ window.__redraw && window.__redraw(); }catch{} })()`, false);
  await sleep(1600);
  const after = JSON.parse(await posOf());
  console.log(`  ${uid} 를 밀었다 — ${moved}`);
  /* ⚠⚠ **가구가 실제로 움직인 만큼**과 견준다. 처음에 `0.5` 를 박아 두었다가
     「안 따라왔다」는 거짓 결론을 냈다 — 가구는 격자에 앉느라 0.39 만 갔고 화분은
     그만큼 따라왔는데, 자가 0.5 를 기다리고 있었다(§2.9 ⑧ 과 같은 결: 잘못된 기준). */
  let want = null;
  try { const m = JSON.parse(moved); want = +(m.to.x - m.from.x).toFixed(2); } catch { }
  if (want == null) { console.log('    ⚠ 가구가 안 움직였다 — 이 줄로는 못 잰다'); continue; }
  let follow = 0, stay = 0;
  for (const a of after) {
    const b = before.find(x => x.key === a.key);
    if (!b) continue;
    const d = +(a.x - b.x).toFixed(2);
    /* ★ **이 가구 위에 있는 것만** 센다. 다른 가구 위의 것은 안 따라오는 게 맞다 */
    if (b.on !== uid) continue;
    const ok = Math.abs(d - want) < 0.02;
    if (ok) follow++; else stay++;
    console.log(`    ${ok ? '✔' : '✘'} ${a.key}(${a.kind}) y ${b.y} · Δx ${d} (가구는 ${want})${ok ? '' : ' ← 안 따라왔다'}`);
  }
  console.log(`    ${stay ? '✘' : '✔'} 위에 있던 것 ${follow + stay}개 중 ${follow}개가 따라왔다`);
}

await slotAudit('옮긴 뒤');
console.log('');
console.log('예외', errs.length, errs.slice(0, 3).join(' | '));
await page.close();
