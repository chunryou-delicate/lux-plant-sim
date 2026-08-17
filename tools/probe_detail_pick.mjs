/* [자세히] 창이 **누른 그 그루**를 보여 주나 (2026-08-17)
   ══════════════════════════════════════════════════════════════════
   박사님: *"새로 심은 몬스테라는 안 자라는 거 같어 53%에서 멈춰 있어… 광량은 2.9지점"*
           *"오늘 받은 빛에 충분히 받았다고 되어 있잖아, 그림."*
   그 3.68 은 **창턱에 있는 첫 그루** 값이었다. 카드가 늘 `pot0(S)` 만 봤기 때문이다.

   ⚠ 이 자는 「빛이 다르다」로 판정하지 않는다 — 두 그루가 우연히 같은 밝기일 수 있다.
     **줄의 자리 이름과 카드의 자리 이름이 같은가**로 판정한다. 카드가 첫 그루에 박혀
     있으면 둘째 줄을 눌러도 첫 그루의 자리가 뜨므로, 이 견줌은 반드시 갈린다.
   ⚠ §2.9 ⑦ — 찍히는 칸이 내가 생각한 칸인가. 그래서 줄의 `data-plantzoom`(개체 id)과
     `S.pots[i].id` 를 같이 찍는다. */
import { launch, sleep } from './test_cdp.mjs';

const _WATCHDOG_MS = +(process.env.BYEOT_PROBE_TIMEOUT_MS || 420000);
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
await page.waitFor('!!window.__rv', 180000, 300);
await page.waitFor('window.__byeotBooted === true', 180000, 300);
await sleep(6000);

const clearTalk = async () => {
  for (let i = 0; i < 40; i++) {
    const busy = await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');
      return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`);
    if (!busy) return;
    await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s)s.click();
      const b=document.getElementById('dlgBox'); if(b)b.click();
      const g=document.getElementById('guideClose'); if(g)g.click();})()`, false);
    await sleep(220);
  }
};
await clearTalk();

/* ① 선물 몬스테라를 부른다 — 시루를 어두운 자리에 놓고 **세 번** 거둔다.
   ⚠⚠ 이 대문은 `tools/probe_cutting_ui.mjs` 의 것을 **그대로 베꼈다.** 스스로 지어냈다가
     스무 날을 헛돌았다 — 시루는 2026-08-16 부터 **놓기 → 심기 두 걸음**이고, 그 [심기]는
     `#siruList button[data-act="plant"]` 에 붙는다(§2.9 ④ 자가 옛 세상을 잰다). */
const waitAct = async (ms = 15000) => {
  const t0 = Date.now();
  const acting = () => page.eval(`(()=>{ try { return !!window.__byeotWalkSfx().acting; }
    catch { return document.getElementById('actBar').style.display !== 'none'; } })()`);
  for (let i = 0; i < 6; i++) { if (await acting()) break; await sleep(120); }
  while (Date.now() - t0 < ms) { if (!(await acting())) { await sleep(250); return true; } await sleep(250); }
  return false;
};
const rowAct = async (act) => {
  let n = 0;
  for (let k = 0; k < 8; k++) {
    const hit = await page.eval(`(()=>{ const b=[...document.querySelectorAll(
      '#siruList button[data-act="${act}"]')].find(x=>!x.disabled); if(!b) return false; b.click(); return true; })()`);
    if (!hit) break;
    n++; await waitAct(); await sleep(400); await clearTalk();
  }
  return n;
};
await page.eval(`(()=>{ const rv=window.__rv, c=document.getElementById('roomCanvas').getBoundingClientRect();
  const sp=rv.screenPosOf('banjiha-dresser:1');
  window.__drag.begin('beansprout', document.getElementById('cropThumb').src, {clientX:c.left+c.width*0.9, clientY:c.top+40});
  window.__drag.move({clientX:c.left+sp.x, clientY:c.top+sp.y}); window.__drag.end(); })()`, false);
await sleep(1200);
await page.eval(`(()=>{ const S=window.__S(); S.shop.stock.bean_seed = 9; })()`, false);
await page.eval(`window.__byeotSheet.open('plants')`, false); await sleep(500);
for (let i = 0; i < 60; i++) {
  if (await page.eval(`window.__S().pots.length > 0`)) break;
  await page.eval(`(()=>{const S=window.__S(); if(S.stamina) S.stamina.usedToday=0;})()`, false);
  await rowAct('plant'); await rowAct('water'); await rowAct('harvest'); await rowAct('sow');
  await page.eval(`(()=>{try{document.getElementById('next').click()}catch{}})()`, false);
  await sleep(1000); await clearTalk();
}
console.log('도착   :', await page.eval(`(()=>{ const S=window.__S();
  return JSON.stringify({ day:S.day, pots:S.pots.length }); })()`));

/* ② 첫 그루는 창턱(밝다) */
await page.eval(`(()=>{ const s=document.getElementById('slot'); if(!s) return;
  s.value='banjiha-sill:0'; s.dispatchEvent(new Event('change',{bubbles:true})); })()`, false);
await sleep(1500); await clearTalk();

/* ③ 둘째 그루 — 씨앗을 심는다. 화면 길이 아니라 **코어 창구**를 쓴다(자가 아니라 판을 짓는 일) */
await page.eval(`(()=>{ const S=window.__S();
  S.shop.stock['monstera_seed']=1; S.shop.stock['pot']=1;
  if (S.stamina) S.stamina.usedToday=0; })()`, false);
await sleep(300);
const planted = await page.eval(`JSON.stringify(window.__placePot('monsteraSeed:pot'))`);
await sleep(1600); await clearTalk();
/* ★ 화분은 **놓기 → 심기 두 걸음**이다(박사님 확정). 놓인 빈 화분 줄의 [🌱 심기]를 누른다. */
await page.eval(`window.__byeotSheet.open('plants')`, false); await sleep(700);
console.log('빈화분 :', await page.eval(`(()=>{ const S=window.__S();
  return JSON.stringify({ 빈:(S.emptyPots||[]).map(e=>({id:e.id,slot:e.slotId})),
    줄:[...document.querySelectorAll('#emptyPotList [data-sow]')].map(b=>b.dataset.sow) }); })()`));
await page.eval(`(()=>{ const b=document.querySelector('#emptyPotList [data-sow]'); if(b) b.click(); })()`, false);
await sleep(1500); await clearTalk();
/* 씨앗을 고르는 팝업이 뜨면 몬스테라를 고른다 */
await page.eval(`(()=>{ for (const b of document.querySelectorAll('button')) {
  if(/몬스테라/.test(b.textContent||'') && b.offsetParent && !b.disabled) { b.click(); return; } } })()`, false);
await sleep(1800); await waitAct(); await clearTalk();
await page.eval(`document.getElementById('next').click()`, false); await sleep(1400); await clearTalk();

const pots = await page.eval(`(()=>{ const S=window.__S();
  return JSON.stringify(S.pots.map(p=>({ id:p.id, slotId:p.slotId }))); })()`);
console.log('화분   :', pots, '· 심기', planted);
if (JSON.parse(pots).length < 2) {
  console.log('✘ 그루가 둘이 안 됐습니다 — 이 자는 판정할 수 없습니다');
  console.log('예외', errs.length, errs.slice(0, 2).join(' | '));
  await page.close(); process.exit(1);
}

/* ④ [식물] 탭 → 줄마다 [자세히] */
await page.eval(`(()=>{ window.__byeotSheet.open(); window.__byeotSheet.tab('plants'); })()`, false);
await sleep(900);
const rows = JSON.parse(await page.eval(`(()=>{
  return JSON.stringify([...document.querySelectorAll('[data-plantzoom]')].map((b,i)=>({
    i, id: b.dataset.plantzoom,
    줄: (b.closest('.siruRow')||b.parentElement||{}).textContent ?
        (b.closest('.siruRow')||b.parentElement).textContent.replace(/\\s+/g,' ').trim().slice(0,60) : '' })));
})()`));
console.log('줄     :', JSON.stringify(rows, null, 0));
console.log('손      :', await page.eval(`(()=>{ const b=[...document.querySelectorAll('[data-plantzoom]')][1];
  return JSON.stringify({ id:b.dataset.plantzoom, on:String(b.onclick||'').replace(/\s+/g,' ').slice(0,180) }); })()`));

const read = async (i) => {
  await page.eval(`(()=>{ const b=[...document.querySelectorAll('[data-plantzoom]')][${i}];
    b.dispatchEvent(new MouseEvent('click',{bubbles:true})); })()`, false);
  await sleep(700);
  const r = JSON.parse(await page.eval(`(()=>{
    const g=id=>{const e=document.getElementById(id); return e?(e.textContent||'').replace(/\\s+/g,' ').trim():null;};
    const rowOf=k=>{ for (const r of document.querySelectorAll('#dBody .row')) {
        const s=r.querySelector('span'); if(s&&s.textContent.trim()===k) return (r.querySelector('b')||{}).textContent||''; }
      return null; };
    return JSON.stringify({ 이름:g('dTitle'), 자리:g('dSub'),
      빛:rowOf('오늘 받은 빛'), 상태:rowOf('상태'), 단계:rowOf('지금 단계'),
      막힘:rowOf('지금 막힌 것'), 속도:rowOf('자라는 속도'), 물:rowOf('물 준 지'),
      돌본날:rowOf('돌본 날') }); })()`));
  await page.eval(`(()=>{const c=document.getElementById('dClose'); if(c)c.click();})()`, false);
  await sleep(400);
  return r;
};

/* ★ 단추를 거치지 않고 **같은 함수**를 직접 불러 본다 — 갈라 보기(§2.9 ⑦) */
for (const id of ['pot_01','pot_02']) {
  console.log('   손잡이:', await page.eval(`JSON.stringify({ 있나: typeof window.__detailOpen,
    답: (typeof window.__detailOpen==='function') ? window.__detailOpen('monstera', {id:${JSON.stringify(id)}}) : null,
    화분: window.__S().pots.map(x=>x.id) })`));
  await sleep(400);
  console.log(`직접 ${id}:`, await page.eval(`(()=>{const t=document.getElementById('dTitle'),
    s=document.getElementById('dSub'); return JSON.stringify([t&&t.textContent, s&&s.textContent]); })()`));
  await page.eval(`(()=>{const c=document.getElementById('dClose'); if(c)c.click();})()`, false); await sleep(300);
}

const cards = [];
for (let i = 0; i < rows.length; i++) cards.push(await read(i));
for (let i = 0; i < cards.length; i++) console.log(`카드 ${i} :`, JSON.stringify(cards[i]));

/* ══ §C 확대창이 그루마다 뜨나 (2026-08-17 · 박사님: "몬스테라별 확대창") ═══════
   ⚠ 확대창은 `plant_grow.html` 이고 **지금 꽂힌 그루**를 그린다. 그래서 어느 줄에서
     열어도 첫 그루가 떴다. 여기서는 줄의 [🔍 확대]를 눌러 **꽂힌 그루가 바뀌는지**,
     그리고 닫으면 **제자리로 돌아오는지**를 본다(방이 딴 그루를 그리면 안 된다). */
console.log('');
console.log('── §C 확대창이 그루마다 뜨나 ────────────────────────────');
const cur = () => page.eval(`(()=>{ try { return window.__io.growth.current(); } catch(e){ return 'ERR '+e.message; } })()`);
console.log('  열기 전 :', await cur());
const zoomOf = async (potId) => {
  await page.eval(`window.__byeotSheet.open('plants')`, false); await sleep(600);
  const hit = await page.eval(`(()=>{ const b=document.querySelector('[data-plantbig="${potId}"]');
    if(!b) return false; b.click(); return true; })()`);
  await sleep(1400);
  const r = { 눌림: hit, 꽂힌그루: await cur(),
              확대열림: await page.eval(`document.getElementById('stage').classList.contains('zoom')`) };
  await page.eval(`(()=>{ try{ window.__byeotZoom.close() }catch{} })()`, false); await sleep(900);
  r.닫은뒤 = await cur();
  return r;
};
const zA = await zoomOf('pot_01'); console.log('  pot_01 :', JSON.stringify(zA));
const zB = await zoomOf('pot_02'); console.log('  pot_02 :', JSON.stringify(zB));
const zoomOk = zA.확대열림 && zB.확대열림 && zA.꽂힌그루 !== zB.꽂힌그루 && zA.닫은뒤 === zB.닫은뒤;
console.log(zoomOk ? '✔ 확대창이 그루마다 다른 그루를 꽂고, 닫으면 제자리로 돌아온다'
                   : '✘ 확대창이 같은 그루를 보여 주거나 닫아도 안 돌아온다');

/* ══ §B 마른 그루가 말을 하나 (2026-08-17) ════════════════════════════════
   딴 창이 재서 알아낸 것: 박사님의 씨앗 그루 둘은 **빛이 아니라 물** 때문에 멈춰
   있었고, 방은 **한마디도 안 했다** — 말풍선도 아래 단추도 `pot0` 만 봤기 때문이다.
   창턱 선물이 촉촉하니 화면은 「아직 촉촉합니다」라고 적혀 있었다.
   ⇒ 첫 그루에만 물을 주며 날을 넘겨, **둘째 그루가 마르면 화면이 말하는지** 본다. */
console.log('');
console.log('── §B 마른 그루가 말을 하나 ──────────────────────────────');
const dryProbe = { 말풍선: null, 아래단추: null, 카드: null };
for (let d = 0; d < 16; d++) {
  await page.eval(`window.__byeotSheet.open('plants')`, false); await sleep(300);
  /* 첫 그루에만 물을 준다 — 둘째는 일부러 말린다 */
  const hit = await page.eval(`(()=>{ const b=document.querySelector('[data-plantwater="pot_01"]');
    if(!b) return false; b.click(); return true; })()`);
  if (hit) { await waitAct(); await sleep(300); await clearTalk(); }
  await page.eval(`(()=>{ window.__byeotSheet.close(); })()`, false); await sleep(250);
  await page.eval(`(()=>{const S=window.__S(); if(S.stamina) S.stamina.usedToday=0;})()`, false);
  await page.eval(`(()=>{try{document.getElementById('next').click()}catch{}})()`, false);
  await sleep(1000); await clearTalk();
  const st = JSON.parse(await page.eval(`(()=>{ const S=window.__S();
    const t=(window.__lastTurnPeek||{});
    return JSON.stringify({ day:S.day,
      마름: S.pots.map(p=>p.id) }); })()`));
  const marks = await page.eval(`(()=>{ return JSON.stringify([...document.querySelectorAll('.mark,.potmark,[data-mark]')]
    .map(e=>(e.textContent||'').replace(/\s+/g,' ').trim()).filter(Boolean)); })()`);
  const btn = await page.eval(`(()=>{ const b=document.getElementById('waterPot');
    return JSON.stringify({ 보임: !!b && b.style.display!=='none', 글자:(b&&b.textContent||'').trim() }); })()`);
  if (/몬스테라 2/.test(marks) || /몬스테라 2/.test(btn)) {
    dryProbe.말풍선 = marks; dryProbe.아래단추 = JSON.parse(btn).글자;
    console.log(`  ${st.day}일 · 말풍선 ${marks} · 아래단추 ${JSON.parse(btn).글자}`);
    break;
  }
  if (d % 4 === 0) console.log(`  ${st.day}일 · 말풍선 ${marks} · 아래단추 ${JSON.parse(btn).글자}`);
}
/* 그 그루의 카드가 「지금 막힌 것」에 마름을 적나 */
await page.eval(`window.__detailOpen('monstera', {id:'pot_02'})`, false); await sleep(500);
dryProbe.카드 = JSON.parse(await page.eval(`(()=>{
  const rowOf=k=>{ for (const r of document.querySelectorAll('#dBody .row')) {
      const sp=r.querySelector('span'); if(sp&&sp.textContent.trim()===k) return (r.querySelector('b')||{}).textContent||''; }
    return null; };
  const t=document.getElementById('dTitle');
  return JSON.stringify({ 이름:t&&t.textContent, 막힘:rowOf('지금 막힌 것'), 물:rowOf('물 준 지') }); })()`));
await page.eval(`(()=>{const c=document.getElementById('dClose'); if(c)c.click();})()`, false); await sleep(300);
console.log('  카드 :', JSON.stringify(dryProbe.카드));
/* ★ 화면이 무엇을 보고 저렇게 적었나 — 턴 그대로를 옆에 놓고 견준다 */
console.log('  턴   :', await page.eval(`(()=>{ const t=window.__turn && window.__turn();
  if(!t) return 'null'; return JSON.stringify((t.plants||[]).map(r=>({ potId:r.potId,
    band:(r.growthSpeed||{}).band, 주기:(r.potWater||{}).interval, 마름:(r.potWater||{}).dryDays,
    막힘:r.potDry||r.headroomBlocked||r.growthBlocked||null }))); })()`));
const dryOk = !!(dryProbe.말풍선 && /몬스테라 2/.test(dryProbe.말풍선))
           || !!(dryProbe.아래단추 && /몬스테라 2/.test(dryProbe.아래단추));
console.log(dryOk ? '✔ 마른 둘째 그루를 화면이 말한다'
                  : '✘ 둘째 그루가 말라도 화면이 조용하다 — 첫 그루만 보고 있다');

/* ⑤ 판정 — 줄의 자리와 카드의 자리가 짝이 맞나 */
const slotKo = JSON.parse(await page.eval(`(()=>{ const S=window.__S();
  return JSON.stringify(S.pots.map(p=>p.slotId||null)); })()`));
let bad = 0;
for (let i = 0; i < cards.length; i++) {
  const same = cards[i].자리 && slotKo[i] && rows[i] && rows[i].id === JSON.parse(pots)[i].id;
  if (!same) { console.log(`   ⚠ ${i}번 줄의 개체 id 가 화분 순서와 안 맞습니다`); bad++; }
}
const uniq = new Set(cards.map(c => c.자리));
console.log(uniq.size === cards.length
  ? `✔ 카드 ${cards.length}장이 **서로 다른 자리**를 보여 줍니다 — 누른 그루가 뜹니다`
  : `✘ 카드 ${cards.length}장이 같은 자리(${[...uniq].join(' / ')})를 보여 줍니다 — 아직 첫 그루에 박혀 있습니다`);
console.log('예외', errs.length, errs.slice(0, 2).join(' | '));
await page.close();
process.exit(uniq.size === cards.length && !bad && dryOk && zoomOk ? 0 : 1);
