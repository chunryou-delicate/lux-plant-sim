/* ============================================================
   tools/probe_terms.mjs — **용어·안내·수확 글자**를 화면에서 잰다 (2026-08-16 신설)
   ------------------------------------------------------------
     python tools/serve.py 8963
     BYEOT_URL=http://localhost:8963 node tools/probe_terms.mjs --out docs/handoff/img/terms/before

   ★ 검사가 아니라 **자**다. 판정하지 않고 **지금 화면이 무엇을 말하나**를 그대로 받아 적는다.
     같은 자를 고치기 전·후에 대고 그 차이를 본다(이 저장소의 계율 — 「고쳤다」는 사진으로).

   무엇을 재나
     ① §G-18 **안내 통로 census** — 물을 준 뒤 「수확까지 며칠」을 지금 **무엇이** 말하나.
        통로마다 그 순간의 글자를 그대로 찍는다. 아무도 안 말하면 그 자리가 빈 자리다.
     ② §G-13 「곳간」 — 화면 글자에 그 말이 몇 번 뜨나 (상점·밥상 창·가방)
     ③ §G-14/§G-15 상점 하부 탭 이름과 갈래별 품목
     ④ §G-11 수확 — 거둔 순간 시루 위에 뜨는 것이 있나 (+ 사진)
     ⑤ §G-19 밥상 창 — 작물을 갈라 고를 손잡이가 있나
============================================================ */
import { launch, sleep } from './test_cdp.mjs';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const OUT = (process.argv.find(a => a.startsWith('--out=')) || '').slice(6) ||
            (process.argv[process.argv.indexOf('--out') + 1] || '').replace(/^--.*/, '') ||
            'docs/handoff/img/terms/now';
try { mkdirSync(OUT, { recursive: true }); } catch { }

const page = await launch({ width: 390, height: 844, dpr: 2, mobile: false });
const errs = [];
page.on(m => {
  if (m.method === 'Runtime.exceptionThrown')
    errs.push((m.params.exceptionDetails.exception || {}).description ||
              m.params.exceptionDetails.text);
});
await page.goto(`${BASE}/game.html`);
await page.eval(`localStorage.clear()`, false);          // ⚠ goto 뒤에
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 180000, 300);
await page.waitFor('window.__byeotBooted === true', 180000, 300);
await sleep(7000);

async function walk() {
  for (let i = 0; i < 80; i++) {
    const busy = await page.eval(`(()=>{const s=document.getElementById('stage'),
      g=document.getElementById('guide');
      return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`);
    if (!busy) return;
    await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s) s.click();
      const b=document.getElementById('dlgBox'); if(b) b.click();
      const g=document.getElementById('guideClose'); if(g) g.click();})()`, false);
    await sleep(280);
  }
}
/* ★ 팝업(가계부·할 일)을 걷는다 — 안 걷으면 방 위 사진이 팝업 사진이 된다 */
const closePops = async () => {
  for (let i = 0; i < 4; i++) {
    const any = await page.eval(`(()=>[...document.querySelectorAll('.pop.on')].length)()`);
    if (!any) return;
    await page.eval(`(()=>{const c=document.getElementById('monthClose'); if(c) c.click();
      try{ window.__byeotPopClose && window.__byeotPopClose(); }catch{}})()`, false);
    await sleep(280);
  }
};
await walk();

const freeHands = () => page.eval(`(()=>{const S=window.__S();
  if (S.stamina) S.stamina.usedToday = 0;})()`, false);
const redraw = async () => { await page.eval(`window.__redraw && window.__redraw()`, false); await sleep(350); };
const place = (slot) => page.eval(`(()=>{ const rv=window.__rv,
    c=document.getElementById('roomCanvas').getBoundingClientRect();
  const sp=rv.screenPosOf('${slot}'); if(!sp) return false;
  window.__drag.begin('beansprout', document.getElementById('cropThumb').src,
                      {clientX:c.left+c.width*0.9, clientY:c.top+40});
  window.__drag.move({clientX:c.left+sp.x, clientY:c.top+sp.y}); window.__drag.end(); return true;})()`);
const siruBtn = (act, i = 0) => page.eval(`(()=>{const b=[...document.querySelectorAll(
  '#siruList button[data-act="${act}"]')]; if(!b[${i}]) return false; b[${i}].click(); return true;})()`);
const click = (id) => page.eval(`(()=>{const b=document.getElementById('${id}');
  if(!b) return false; b.click(); return true;})()`);
const openTab = async (t) => { await page.eval(`window.__byeotSheet.open('${t}')`, false); await sleep(450); };
const closeSheet = async () => { await page.eval(`window.__byeotSheet.close()`, false); await sleep(450); };
const shot = (n) => page.shot(`${OUT}/${n}.png`);
/* ★ 동작이 **끝날 때까지** 기다린다 — 걸어가는 중에 [다음 날]을 누르면 그 동작이 취소된다.
   그러면 「물을 줬다」고 적어 놓고 실제로는 안 준 판을 재게 된다(재는 자의 거짓말). */
const calm = async (ms = 12000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const busy = await page.eval(`(()=>{const s=document.getElementById('stage');
      const m=[...document.querySelectorAll('#marks .mark')].some(e=>/가는 중|하는 중/.test(e.textContent||''));
      const a=document.getElementById('actBar');
      return m || !!(a && a.style.display!=='none') || !!(s&&s.classList.contains('talking'));})()`);
    if (!busy) return true;
    await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s) s.click();
      const b=document.getElementById('dlgBox'); if(b) b.click();})()`, false);
    await sleep(300);
  }
  return false;
};

/* ══ ① §G-18 census — 「며칠 남았나」를 지금 무엇이 말하나 ══════════════════
   ⚠ 통로 이름은 `guide-to-plan.md §0` 의 아홉 + 쪽지 하나를 그대로 쓴다. */
const census = () => page.eval(`(()=>{
  const t = e => e ? (e.textContent||'').replace(/\\s+/g,' ').trim() : null;
  const vis = e => { if(!e) return false; const r=e.getBoundingClientRect();
    return r.width>0 && r.height>0 && getComputedStyle(e).display!=='none'; };
  const S = window.__S();
  const hint = document.getElementById('hint');
  const marks = [...document.querySelectorAll('#marks .mark')].map(t);
  return JSON.stringify({
    day: S.day,
    q1_quest:  t(document.getElementById('quest')),
    q1_sheet:  t(document.getElementById('sheetQuest')),
    q2_hint:   hint && hint.classList.contains('on') ? t(hint.querySelector('.say')) : null,
    q3_marks:  marks,
    q5_banner: [...document.querySelectorAll('#event .ev')].map(t),
    next_txt:  t(document.getElementById('next')),
    next_off:  !!(document.getElementById('next')||{}).disabled,
    coach:     (window.__byeotCoach && window.__byeotCoach.now()) || null,
    siruLines: [...document.querySelectorAll('#siruList .siruline')].map(t),
    pickLine:  vis(document.getElementById('pickedName')) ? t(document.getElementById('pickedName')) : null
  });})()`);

const say = async (tag) => {
  const c = JSON.parse(await census());
  console.log(`\n── ${tag} (Day ${c.day}) ───────────────────────────────`);
  console.log(`  ① #quest        : ${c.q1_quest}`);
  console.log(`  ①' #sheetQuest  : ${c.q1_sheet}`);
  console.log(`  ② 손가락 #hint  : ${c.q2_hint}`);
  console.log(`  ③ 말풍선        : ${JSON.stringify(c.q3_marks)}`);
  console.log(`  ⑤ 배너          : ${JSON.stringify(c.q5_banner)}`);
  console.log(`  ⑩ 쪽지          : ${c.coach}`);
  console.log(`  [다음 날] 글자  : ${c.next_txt} (잠김 ${c.next_off})`);
  console.log(`  시트 시루 줄    : ${JSON.stringify(c.siruLines)}`);
  console.log(`  아래 한 줄      : ${c.pickLine}`);
  return c;
};

/* ── 판 세우기 — 시루 하나를 놓고 심고 물을 준다 (걸음은 전부 화면 단추) ── */
await page.eval(`(()=>{const S=window.__S(); S.shop.stock.siru=(S.shop.stock.siru||0)+1;
  S.shop.stock.bean_seed=(S.shop.stock.bean_seed||0)+8;})()`, false);
await redraw();
await place('banjiha-dresser:1'); await sleep(900); await walk(); await calm();
await freeHands();
await openTab('plants');
/* ⚠ 한 번 눌러서 안 되면 **다시 누른다** — 걷다가 끊기면 안 심고/안 준 판이 되는데
   화면은 조용하다. 그대로 재면 「물을 줬다」고 적어 놓고 안 준 판을 재게 된다. */
const siruUntil = async (act, want) => {
  for (let i = 0; i < 5; i++) {
    const now = await page.eval(`(()=>[...document.querySelectorAll('#siruList .siruline')]
      .map(e=>e.textContent).join(' | '))()`);
    if (new RegExp(want).test(now)) return true;
    await siruBtn(act, 0); await sleep(700); await calm(); await walk();
    await freeHands(); await redraw();
  }
  return false;
};
await siruUntil('plant', '물을 주면|칸 ·');
await siruUntil('water', '칸 ·');
console.log('  (판) 물을 준 뒤 시루 줄: ' + await page.eval(`(()=>[...document.querySelectorAll('#siruList .siruline')]
  .map(e=>e.textContent.replace(/\s+/g,' ').trim()).join(' | '))()`));
await closeSheet();

console.log('\n════ ① §G-18 안내 census — 물을 준 뒤 「며칠 남았나」를 누가 말하나 ════');
await say('물을 준 직후');
await shot('g18_watered');

/* 하루씩 넘기며 같은 자를 댄다 */
for (let d = 0; d < 2; d++) {
  await calm(); await freeHands(); await click('next'); await sleep(1400); await walk();
  await freeHands(); await click('next'); await sleep(1600); await walk(); await calm();
  await closePops(); await closeSheet();
  await say(`${d + 1}일 넘긴 뒤`);
}
await shot('g18_growing');

/* ★ [다음 날] 단추가 안 잘리나 — 세 폭에서 잰다(글자가 잘리면 그 줄이 거짓말이 된다) */
for (const w of [360, 390, 430]) {
  await page.send('Emulation.setDeviceMetricsOverride',
    { width: w, height: 844, deviceScaleFactor: 2, mobile: false });
  await sleep(400);
  const n = await page.eval(`(()=>{const b=document.getElementById('next');
    const r=b.getBoundingClientRect();
    return JSON.stringify({ txt:b.textContent.trim(), w:Math.round(r.width), h:Math.round(r.height),
      cut: b.scrollWidth > b.clientWidth+1 });})()`);
  console.log(`  [다음 날] ${w}px → ${n}`);
}
await page.send('Emulation.setDeviceMetricsOverride',
  { width: 390, height: 844, deviceScaleFactor: 2, mobile: false });
await sleep(400);

/* ★★ §G-18-b — **첫 플레이가 끝난 판**에서도 「며칠 남았나」를 누가 말하나.
   ⚠ 지름길이다(`firstPlay.completed = true`). 재려는 것은 「퀘스트가 ① 줄을 가로채면
     그 말이 어디로 가나」 하나뿐이라, 33일을 실제로 굴리는 것은 이 자의 대상이 아니다. */
console.log('\n════ ①-b 첫 플레이가 끝난 판 — ① 줄을 퀘스트가 가로채나 ════');
await page.eval(`(()=>{ const S=window.__S(); S.firstPlay.completed = true; })()`, false);
await redraw();
await say('첫 플레이가 끝난 판');
await page.eval(`(()=>{ const S=window.__S(); S.firstPlay.completed = false; })()`, false);
await redraw();

/* ══ ② §G-13 「곳간」이 화면 글자에 몇 번 뜨나 ═════════════════════════ */
console.log('\n════ ② §G-13 「곳간」이라는 말이 화면에 몇 번 뜨나 ════');
const gotgan = async (where) => {
  const r = await page.eval(`(()=>{
    const hits=[]; const walkEl=(el)=>{ for(const n of el.childNodes){
      if(n.nodeType===3){ const s=(n.textContent||'').replace(/\\s+/g,' ').trim();
        if(/곳간/.test(s)) hits.push(s.slice(0,60)); }
      else if(n.nodeType===1 && getComputedStyle(n).display!=='none') walkEl(n); } };
    walkEl(document.body); return JSON.stringify(hits);})()`);
  const hits = JSON.parse(r);
  console.log(`  [${where}] ${hits.length}곳`);
  for (const h of hits) console.log(`      · ${h}`);
  return hits;
};
await openTab('shop'); await gotgan('상점 탭'); await shot('g13_shop');
await openTab('bag');  await gotgan('가방 탭');
await closeSheet();

/* ══ ③ §G-14/§G-15 상점 하부 탭 ═════════════════════════════════════ */
console.log('\n════ ③ §G-14 상점 하부 탭 이름과 갈래별 품목 ════');
{
  /* 전부 열린 판에서 봐야 갈래가 다 보인다 — 첫 플레이를 끝난 것으로 세운다(검수 지름길) */
  await page.eval(`(()=>{const S=window.__S(); S.firstPlay.monstera.arrived = true;})()`, false);
  await redraw();
  await openTab('shop'); await sleep(400);
  const tabs = await page.eval(`(()=>[...document.querySelectorAll('#shopGroups [data-sg]')]
    .map(b=>b.textContent.replace(/\\s+/g,' ').trim()).join(' | '))()`);
  console.log(`  탭: ${tabs}`);
  for (const g of ['seed', 'grow', 'pot', 'lamp', 'all']) {
    const items = await page.eval(`(()=>{const b=document.querySelector('#shopGroups [data-sg="${g}"]');
      if(!b) return null; b.click();
      return [...document.querySelectorAll('#shopList .shopRow .nm')]
        .map(e=>e.textContent.replace(/\\s+/g,' ').trim()).join(' · ');})()`);
    if (items != null) console.log(`  [${g}] ${items}`);
  }
  await shot('g14_shoptabs');
  /* ★ 검수 판(첫 플레이 끔) — 잠긴 물건까지 다 보이는 자리에서 갈래를 다시 잰다.
     ⚠ 유리 수경병(삽수 그릇)이 [채소 키우는 그릇]에 남아 있으면 그 탭 이름이 거짓말이 된다 */
  await page.eval(`(()=>{const S=window.__S(); S.firstPlay.enabled=false;})()`, false);
  await redraw(); await sleep(400);
  console.log('  ── 검수 판(전부 보임) ──');
  const tabs2 = await page.eval(`(()=>[...document.querySelectorAll('#shopGroups [data-sg]')]
    .map(b=>b.textContent.replace(/\s+/g,' ').trim()).join(' | '))()`);
  console.log(`  탭: ${tabs2}`);
  for (const g of ['grow', 'pot', 'lamp']) {
    const items = await page.eval(`(()=>{const b=document.querySelector('#shopGroups [data-sg="${g}"]');
      if(!b) return null; b.click();
      return [...document.querySelectorAll('#shopList .shopRow .nm')]
        .map(e=>e.textContent.replace(/\s+/g,' ').trim()).join(' · ');})()`);
    console.log(`  [${g}] ${items}`);
  }
  const lampRow = await page.eval(`(()=>{const b=document.getElementById('buyLamp');
    if(!b) return 'none'; const r=b.getBoundingClientRect();
    return JSON.stringify({ where:(b.closest('.sheetpage')||{}).id, text:b.textContent.trim(),
      row:((b.closest('.shopRow')||{}).textContent||'(상점 줄이 아니다)').replace(/\s+/g,' ').trim(), h:Math.round(r.height), off:b.disabled });})()`);
  console.log(`  검수 판 #buyLamp: ${lampRow}`);
  await page.eval(`(()=>{const S=window.__S(); S.firstPlay.enabled=true;})()`, false);
  await redraw();
  /* ★ 가을에 풀린 판 — 그때 비로소 [식물등] 갈래가 선다 */
  await page.eval(`(()=>{const S=window.__S(); S.tutorial.lamp.unlocked=true;})()`, false);
  await redraw(); await sleep(400);
  const tabs3 = await page.eval(`(()=>[...document.querySelectorAll('#shopGroups [data-sg]')]
    .map(b=>b.textContent.replace(/\s+/g,' ').trim()).join(' | '))()`);
  const lamp3 = await page.eval(`(()=>{const b=document.getElementById('buyLamp');
    if(!b) return 'none'; return JSON.stringify({ text:b.textContent.trim(),
      row:((b.closest('.shopRow')||{}).textContent||'(상점 줄이 아니다)').replace(/\s+/g,' ').trim(),
      h:Math.round(b.getBoundingClientRect().height), off:b.disabled });})()`);
  console.log(`  ── 가을(해금) 판 ── 탭: ${tabs3}`);
  console.log(`  #buyLamp: ${lamp3}`);
  /* ★ 다섯 칸이 **다 보이나** — 잘리거나 줄 밖으로 밀리면 그 자체가 고장이다 */
  for (const w of [360, 390, 430]) {
    await page.send('Emulation.setDeviceMetricsOverride',
      { width: w, height: 844, deviceScaleFactor: 2, mobile: false });
    await sleep(400);
    const fit = await page.eval(`(()=>{const bar=document.getElementById('shopGroups');
      const br=bar.getBoundingClientRect();
      const out=[...bar.querySelectorAll('[data-sg]')].map(b=>{const r=b.getBoundingClientRect();
        return { ko:b.textContent.replace(/\s+/g,' ').trim(),
                 inView: r.left>=br.left-0.5 && r.right<=br.right+0.5 };});
      return JSON.stringify({ rows:Math.round(br.height), all:out.every(o=>o.inView),
        hidden: out.filter(o=>!o.inView).map(o=>o.ko),
        pageOverflow: document.documentElement.scrollWidth > innerWidth });})()`);
    console.log(`  갈래 줄 ${w}px → ${fit}`);
  }
  await page.send('Emulation.setDeviceMetricsOverride',
    { width: 390, height: 844, deviceScaleFactor: 2, mobile: false });
  await sleep(400);
  await shot('g15_lamptab');
  await page.eval(`(()=>{const S=window.__S(); S.tutorial.lamp.unlocked=false;})()`, false);
  await redraw();
  /* 식물등 단추가 어디 있나 */
  const lamp = await page.eval(`(()=>{const b=document.getElementById('buyLamp');
    if(!b) return 'none'; const r=b.getBoundingClientRect();
    const page=b.closest('.sheetpage'); return JSON.stringify({
      where: page ? page.id : (b.closest('#tutBox') ? 'tutBox' : '?'),
      text: b.textContent.replace(/\\s+/g,' ').trim(),
      w: Math.round(r.width), h: Math.round(r.height), off: b.disabled });})()`);
  console.log(`  #buyLamp: ${lamp}`);
  await closeSheet();
}

/* ══ ④ §G-11 수확 — 거둔 순간 시루 위에 무엇이 뜨나 ═══════════════════ */
console.log('\n════ ④ §G-11 거둔 순간 — 시루 위에 뜨는 글자가 있나 ════');
{
  /* 익을 때까지 넘긴다 */
  for (let d = 0; d < 8; d++) {
    await calm(); await freeHands(); await click('next'); await sleep(1300); await walk();
    await freeHands(); await click('next'); await sleep(1400); await walk(); await calm();
    await closePops(); await closeSheet();
    const ready = await page.eval(`(()=>[...document.querySelectorAll('#marks .mark')]
      .some(e=>/거두/.test(e.textContent||'')))()`);
    if (ready) break;
  }
  await closeSheet(); await closePops(); await freeHands(); await redraw();
  const before = JSON.parse(await census());
  console.log(`  거두기 전 말풍선: ${JSON.stringify(before.q3_marks)}`);
  await shot('g11_before');
  /* 방 위 말풍선으로 거둔다 — 사람이 쓰는 길 */
  await page.eval(`(()=>{const m=[...document.querySelectorAll('#marks .mark')]
    .find(e=>/거두/.test(e.textContent||'')); if(m) m.click();})()`, false);
  /* ★ 뜨는 글자는 1.6초만 산다 — **150ms 마다 엿본다.** 한 번만 찍으면 걷는 시간에
     따라 있는 것을 「없다」로 적게 된다(재는 자의 거짓말 ①). */
  const seen = [];
  let caught = null, follow = 'no-float', after = 'gone';
  for (let i = 0; i < 80; i++) {
    const now = await page.eval(`(()=>[...document.querySelectorAll('#floats .float')]
      .map(e=>{const r=e.getBoundingClientRect();
        return e.textContent+'@'+Math.round(r.x)+','+Math.round(r.y);}).join(' | '))()`);
    if (now) {
      if (!caught) {
        caught = now;
        /* ⚠ **사진보다 먼저 잰다** — 사진 한 장이 1.6초를 먹어 그 사이에 글자가 사라졌다
           (첫 판 실측: 잡은 뒤 사진을 찍고 물었더니 `no-float`). 재는 자가 대상을 죽인 꼴이다.
           ★★ **시점을 돌려도 그 시루를 따라오나** — 말풍선과 같은 결이라야 한다(§markTick).
           화면을 실제로 끌어 돌리고 글자의 `left` 가 `screenPosOf(열쇠)` 를 따라갔나를 본다. */
        follow = await page.eval(`(()=>{
          const el=document.querySelector('#floats .float'); if(!el) return 'no-float';
          const key=el.dataset.key, c=document.getElementById('roomCanvas');
          const r=c.getBoundingClientRect();
          const b={ left:Math.round(parseFloat(el.style.left)),
                    sp:Math.round((window.__rv.screenPosOf(key)||{}).x) };
          const ev=(t,x,y)=>c.dispatchEvent(new PointerEvent(t,{bubbles:true,clientX:x,clientY:y,
            pointerId:7,pointerType:'mouse',buttons:1,isPrimary:true}));
          ev('pointerdown', r.left+r.width*0.5, r.top+r.height*0.6);
          for(let i=1;i<=8;i++) ev('pointermove', r.left+r.width*0.5+i*14, r.top+r.height*0.6);
          ev('pointerup', r.left+r.width*0.5+112, r.top+r.height*0.6);
          return JSON.stringify({ key, before:b });})()`);
        await sleep(200);
        after = await page.eval(`(()=>{
          const el=document.querySelector('#floats .float'); if(!el) return 'gone';
          const key=el.dataset.key, sp=window.__rv.screenPosOf(key)||{};
          return JSON.stringify({ left:Math.round(parseFloat(el.style.left)), sp:Math.round(sp.x),
            same: Math.abs(parseFloat(el.style.left)-sp.x) < 1.5 });})()`);
        /* ★ 사진은 **돌린 뒤** 한 장이다 — 그 한 장이 두 가지를 같이 보인다:
           글자가 시루 위에 떠 있다 · 시점을 돌려도 그 시루를 따라간다.
           돌리기 전 자리는 위 `follow.before`(left ↔ screenPosOf)로 수로 남는다. */
        await shot('g11_float_turned');
      }
      seen.push(`${i * 100}ms ${now}`);
    } else if (caught) break;
    await sleep(100);
  }
  console.log(`  뜬 글자: ${caught || '(한 번도 안 떴다)'}`);
  console.log(`  떠 있던 동안: ${seen.length}번 엿봄 (${seen[0] || '—'} … ${seen[seen.length - 1] || '—'})`);
  console.log(`  (따라오나) 돌리기 전: ${follow}`);
  console.log(`  (따라오나) 돌린 뒤: ${after}`);
  const f3 = await page.eval(`(()=>document.querySelectorAll('#floats .float').length)()`);
  console.log(`  2.4초 뒤 남은 것: ${f3}개 (0 이라야 한다 — 사라지는 글자다)`);
}

/* ══ ⑤ §G-19 밥상 창 — 작물을 갈라 고를 손잡이가 있나 ═══════════════════ */
console.log('\n════ ⑤ §G-19 밥상 창 — 작물마다 고를 수 있나 ════');
{
  await freeHands(); await click('next'); await sleep(1400);
  const meal = await page.eval(`(()=>{const p=document.getElementById('mealPanel');
    if(!p || !p.classList.contains('on')) return JSON.stringify({open:false});
    return JSON.stringify({ open:true,
      sub: (document.getElementById('mealSub')||{}).textContent,
      rows: [...p.querySelectorAll('.lrow')].map(e=>e.textContent.replace(/\\s+/g,' ').trim()),
      knobs: [...p.querySelectorAll('button')].map(b=>b.id+':'+b.textContent.replace(/\\s+/g,' ').trim()),
      kindKnobs: [...p.querySelectorAll('[data-mealkind]')].length });})()`);
  console.log('  ' + meal.replace(/","/g, '",\n     "'));
  await shot('g19_meal');
}

console.log(`\n부팅/실행 중 JS 예외: ${errs.length}건`);
for (const e of errs.slice(0, 5)) console.log('   ! ' + String(e).split('\n')[0]);
console.log(`사진: ${OUT}`);
await page.close();
