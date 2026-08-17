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

/* ── 판을 짓는다 — 몬스테라 둘 · 빈 화분 · 시루 · 무순 판을 한 방에 ─────── */
await page.eval(`(()=>{ const S=window.__S();
  if (S.firstPlay && S.firstPlay.monstera) S.firstPlay.monstera.arrived = true;
  S.shop.stock.pot = 1; S.shop.stock.pot_concrete_square = 1;
  S.shop.stock.monstera_seed = 3; S.shop.stock.sprout_tray = 1; S.shop.stock.radish_seed = 1;
  S.shop.stock.siru = 1; S.shop.stock.bean_seed = 3;
  if (S.stamina) S.stamina.usedToday = 0; window.__redraw && window.__redraw(); })()`, false);
await sleep(700);
/* 선물 몬스테라를 창턱에 */
await page.eval(`(()=>{ const s=document.getElementById('slot'); if(!s) return;
  s.value='banjiha-sill:0'; s.dispatchEvent(new Event('change',{bubbles:true})); })()`, false);
await sleep(1400); await clear();
/* 씨앗 화분 하나를 3단 선반 위에 심는다 — ★ 씨앗 관련 건이 여기 있다 */
const sown = await page.eval(`(()=>{ try {
  const S=window.__S(), io=window.__io;
  const sl=(io.light.room.slots||[]).find(x=>/desk:0$/.test(x.slotId));
  if(!sl) return 'no-slot';
  const r = window.__placePot('monsteraSeed:pot_concrete_square');
  const ep=(S.emptyPots||[])[0];
  if(!ep) return 'no-emptypot '+JSON.stringify(r);
  window.__setPotAtForProbe ? 0 : 0;
  return JSON.stringify({ 놓기:r, 빈화분:{id:ep.id,itemId:ep.itemId,potAsset:ep.potAsset} });
} catch(e){ return 'ERR '+e.message; } })()`);
console.log('씨앗 화분 놓기 :', sown);
await sleep(1200); await clear();

/* ⚠ 화분을 **밀 그 가구 위**에 올려야 뜻이 있다. 처음에 3단 선반에 올려 두고 책상을
   밀었다가 「안 따라왔다」는 거짓 결론을 냈다 — 안 따라오는 것이 맞는 상황이었다. */
console.log('선반 위로     :', await page.eval(`(()=>{ try {
  const S=window.__S(), io=window.__io;
  const ep=(S.emptyPots||[])[0]; if(!ep) return 'no-pot';
  const sl=(io.light.room.slots||[]).find(x=>/desk:0$/.test(x.slotId));
  const r = window.__moveEmptyForProbe ? null : null;
  ep.slotId = sl.slotId; ep.at = { x: sl.x, y: sl.y, z: sl.z, onUid: 'banjiha-desk', occIdx: sl.occIdx ?? null };
  window.__redraw && window.__redraw();
  return JSON.stringify({ 자리: ep.slotId, at:{x:+ep.at.x.toFixed(2), y:+ep.at.y.toFixed(2), z:+ep.at.z.toFixed(2)} });
} catch(e){ return 'ERR '+e.message; } })()`));
await sleep(1200);
/* 거기에 심는다 — 씨앗이 실제로 들어가고 그릇이 그대로인가 */
await page.eval(`(()=>{ const S=window.__S(); const ep=(S.emptyPots||[])[0];
  if(ep) window.__sowForProbe = ep.id; })()`, false);
console.log('심기          :', await page.eval(`(()=>{ try {
  const S=window.__S(); const before={씨앗:S.shop.stock.monstera_seed, 그루:S.pots.length};
  const b=[...document.querySelectorAll('#emptyPotList [data-sow]')][0];
  if(!b) return 'no-btn';
  b.click();
  return JSON.stringify({전:before});
} catch(e){ return 'ERR '+e.message; } })()`));
await sleep(1400);
await page.eval(`(()=>{ for(const b of document.querySelectorAll('button')){
  if(/몬스테라/.test(b.textContent||'') && b.offsetParent && !b.disabled){ b.click(); return; } } })()`, false);
await sleep(1600); await clear();
console.log('심은 뒤       :', await page.eval(`(()=>{ const S=window.__S();
  return JSON.stringify({ 씨앗:S.shop.stock.monstera_seed, 사각:S.shop.stock.pot_concrete_square,
    그루:S.pots.map(p=>({id:p.id, slot:p.slotId, asset:p.potAsset})) }); })()`));

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
const posOf = () => page.eval(`(()=>{ const rv=window.__rv;
  return JSON.stringify(rv.plants().map(r=>({key:r.key, kind:r.kind,
    x:+r.pos.x.toFixed(3), y:+r.pos.y.toFixed(3), z:+r.pos.z.toFixed(3)}))); })()`);
for (const uid of ['banjiha-desk']) {
  const before = JSON.parse(await posOf());
  /* ⚠⚠ **화면이 쓰는 그 길**로 옮긴다. 처음에 `io.light.moveFurniture` 를 직접 불렀다가
     「안 따라온다」는 거짓 결론을 냈다 — 따라오게 하는 장치(`furnPicked.afterMove` →
     `followFreeOnFurniture`)가 그 아래에 있는데 건너뛴 것이다(§2.9 ④ 자가 딴 길을 잰다). */
  const moved = await page.eval(`(async ()=>{ try {
    const io=window.__io, rv=window.__rv;
    const f=(io.light.furnitureList()||[]).find(x=>x.uid===${JSON.stringify(uid)});
    if(!f) return 'no-furn';
    const r = await rv.commitFurnitureAt(${JSON.stringify(uid)}, { x: f.x + 0.5, z: f.z, rot: f.rot||0 });
    window.__furn.afterMove(r, '');
    return JSON.stringify({ from:{x:+r.from.x.toFixed(2), z:+r.from.z.toFixed(2)},
                            to:{x:+r.to.x.toFixed(2), z:+r.to.z.toFixed(2)} });
  } catch(e){ return 'ERR '+(e&&e.message); } })()`);
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
    const on = Math.abs(b.y) > 0.05;      /* 바닥이 아니면 가구 위다 */
    if (!on) continue;
    const ok = Math.abs(d - want) < 0.02;
    if (ok) follow++; else stay++;
    console.log(`    ${ok ? '✔' : '✘'} ${a.key}(${a.kind}) y ${b.y} · Δx ${d} (가구는 ${want})${ok ? '' : ' ← 안 따라왔다'}`);
  }
  console.log(`    ${stay ? '✘' : '✔'} 위에 있던 것 ${follow + stay}개 중 ${follow}개가 따라왔다`);
}

console.log('');
console.log('예외', errs.length, errs.slice(0, 3).join(' | '));
await page.close();
