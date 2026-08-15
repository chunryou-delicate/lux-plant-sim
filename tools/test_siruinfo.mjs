/* ============================================================
   tools/test_siruinfo.mjs — **그 시루의 생장정보** (2026-08-18 신설)
   ------------------------------------------------------------
     python tools/serve.py 8963
     BYEOT_URL=http://localhost:8963 node tools/test_siruinfo.mjs

   박사님: *"콩나물 시루를 클릭하고 자세히 누르면 내용에 그 [식물] 탭에 있는
            그 시루 번호의 생장정보도 같이 뜨도록 해 줘."*
           *"그리고 그 클릭했을 때 하단 요약에 생장정보가 요약돼서 뜨도록 해 줘.
            지금은 남은 일수만 뜨는데."*

   ══ 고치기 전에 잰 것 ═══════════════════════════════════════════════════
     · [자세히] 카드 = **가방의 빈 시루** 카드였다. 시루 셋을 따로 눌러도 **셋 다
       같은 글**이 떴다(「가방에 남은 것 1개 / 방에 서 있는 것 3개」). 몇 번 시루인지도,
       며칠차인지도 한 글자도 없었다.
     · 아래 한 줄(`#pickedName`) = **자리 이름 하나**였다(「서랍장 2번 칸」).

   ══ 무엇을 못 박나 ═══════════════════════════════════════════════════════
     A  ★★ **시루마다 다른 카드**가 뜬다 — 제목에 그 시루 번호가 있고, 셋을 눌렀을 때
        셋 다 다른 제목이다
     B  ★★★ **[식물] 탭과 한 글자도 안 어긋난다** — 카드의 「자란 칸」·「남은 날」이
        같은 시루의 탭 줄이 말하는 값과 같다. **두 곳이 따로 세지 않는다**
     C  ★★ **아래 한 줄이 그 시루를 말한다** — 시루 번호 + 지금 상태. 시루마다 다르다
     D  ★★ **360·390·430 셋 다 안 잘린다** — 띠가 가로로 안 넘치고, 카드가 화면 안이며
        단추가 44px 아래로 안 내려간다
     E  ★ **가방의 빈 시루 카드는 그대로다** — 거기 「자란 날」·「품질」이 되살아나면
        2026-08-09 의 그 사고(「가방에 콩나물이 자라고 있다」)가 다시 난다
     F  ★ **몬스테라·가구는 예전 그대로** 자리 이름을 낸다

   ⚠ **숫자를 이 파일에 안 박는다.** 칸 수도 남은 날도 화면 두 곳에서 뽑아 서로
     맞는지만 본다 — START-HERE §2.8 의 사고가 그 반대다.
   ★ 지름길은 **시루·씨앗 재고 둘뿐**이다(배송 이틀은 이 일과 무관하다).
     놓기·심기·물주기·[다음 날]은 전부 화면 단추로 밟는다.
============================================================ */
import { launch, sleep } from './test_cdp.mjs';
import fs from 'node:fs';

const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const SHOTS = 'docs/engine/shots/siruinfo';
fs.mkdirSync(SHOTS, { recursive: true });

let bad = 0, seen = 0;
const ok = (name, cond, got) => {
  seen++;
  console.log(`${cond ? '  OK' : 'FAIL'}  ${name}${got == null || got === '' ? '' : '  → ' + got}`);
  if (!cond) bad++;
};

const WIDTHS = [360, 390, 430];
const errsAll = [];

for (const W of WIDTHS) {
  console.log(`\n████ ${W} × 844 ████████████████████████████████████████`);
  const page = await launch({ width: W, height: 844, dpr: 2, mobile: false });
  page.on(m => {
    if (m.method === 'Runtime.exceptionThrown')
      errsAll.push(`${W}: ` + ((m.params.exceptionDetails.exception || {}).description ||
                               m.params.exceptionDetails.text));
  });
  await page.goto(`${BASE}/game.html`);
  await page.eval(`localStorage.clear()`, false);            // ⚠ goto 뒤에
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
  await walk();

  const freeHands = () => page.eval(`(()=>{const S=window.__S(); if (S.stamina) S.stamina.usedToday = 0;})()`, false);
  const redraw = async () => { await page.eval(`window.__redraw && window.__redraw()`, false); await sleep(350); };
  const place = (slot) => page.eval(`(()=>{ const rv=window.__rv,
      c=document.getElementById('roomCanvas').getBoundingClientRect();
    const sp=rv.screenPosOf('${slot}'); if(!sp) return false;
    window.__drag.begin('beansprout', document.getElementById('cropThumb').src,
                        {clientX:c.left+c.width*0.9, clientY:c.top+40});
    window.__drag.move({clientX:c.left+sp.x, clientY:c.top+sp.y}); window.__drag.end(); return true;})()`);
  const act = (id, a) => page.eval(`(()=>{const b=document.querySelector(
    '#siruList button[data-siru="${id}"][data-act="${a}"]'); if(!b) return false; b.click(); return true;})()`);
  const click = (id) => page.eval(`(()=>{const b=document.getElementById('${id}');
    if(!b) return false; b.click(); return true;})()`);
  const shot = (n) => page.shot(`${SHOTS}/${n}_${W}.png`);

  /* ── 판 세우기: 시루 셋. 둘은 심고 물 주고 이틀 굴리고, 하나는 **안 심은 채**로 둔다
       (상태가 갈려야 문장이 갈린다) ─────────────────────────────────────── */
  await page.eval(`(()=>{const S=window.__S(); S.shop.stock.siru=(S.shop.stock.siru||0)+3;
    S.shop.stock.bean_seed=(S.shop.stock.bean_seed||0)+9;})()`, false);
  await redraw();
  for (const s of ['banjiha-dresser:1', 'banjiha-dresser:0', 'banjiha-desk:1']) {
    await place(s); await sleep(900); await walk();
  }
  await freeHands(); await redraw();
  await page.eval(`window.__byeotSheet.open('plants')`, false); await sleep(600);
  for (const id of ['crop_01_01', 'crop_01_02']) {
    await act(id, 'plant'); await sleep(1200); await freeHands(); await redraw();
  }
  for (const id of ['crop_01_01', 'crop_01_02']) {
    await act(id, 'water'); await sleep(1400); await freeHands(); await redraw();
  }
  await page.eval(`window.__byeotSheet.close()`, false); await sleep(400);
  for (let d = 0; d < 2; d++) {
    await freeHands(); await click('next'); await sleep(1500); await walk();
    await freeHands(); await click('next'); await sleep(1500); await walk();
  }
  await redraw();

  /* ── [식물] 탭이 말하는 것 — **정본**이다. 카드·아래 한 줄이 이것과 맞아야 한다 ── */
  await page.eval(`window.__byeotSheet.open('plants')`, false); await sleep(700);
  const tab = await page.eval(`(()=>[...document.querySelectorAll('#siruList .siru')].map(e=>({
    id:e.dataset.siru,
    name:((e.querySelector('.siruhead b')||{}).textContent||'').trim(),
    where:((e.querySelector('.siruhead span')||{}).textContent||'').trim(),
    line:((e.querySelector('.siruline')||{}).textContent||'').replace(/\\s+/g,' ').trim(),
    cells:e.querySelector('.cells') ? e.querySelector('.cells').getAttribute('aria-label') : ''
  })))()`);
  console.log('\n[식물] 탭 —');
  for (const r of tab) console.log('   ', r.name, '|', r.where, '|', r.cells, '|', r.line);
  ok('판이 섰다 — 시루 셋', tab.length === 3, tab.length + '개');
  await page.eval(`window.__byeotSheet.close()`, false); await sleep(500);

  const keys = await page.eval(`(()=>{const S=window.__S(); const out=[];
    for(const p of (S.firstPlay.beansprout.pots||[])) out.push({id:p.id, slotId:p.slotId});
    return out;})()`);

  /* ══ A·B·C — 시루마다 눌러 본다 ═══════════════════════════════════════ */
  console.log('\n== A·B·C. 시루마다 아래 한 줄과 [자세히] 카드 ==');
  const briefs = new Set(), titles = new Set();
  for (const k of keys) {
    const key = k.slotId || ('free:' + k.id);
    const t = tab.find(r => r.id === k.id);
    await page.eval(`window.__picked.clear()`, false);
    await page.eval(`window.__picked.select('${key}')`, false);
    await sleep(400);
    const bar = await page.eval(`(()=>{const pa=document.getElementById('plantActions'),
      who=document.getElementById('pickedName');
      const r=pa.getBoundingClientRect();
      return { who:(who.textContent||'').replace(/\\s+/g,' ').trim(),
        whoLines: Math.round(who.getBoundingClientRect().height / 18),
        overflowX: pa.scrollWidth - pa.clientWidth,
        inX: r.x >= 0 && r.x + r.width <= innerWidth,
        inY: r.y >= 0 && r.y + r.height <= innerHeight,
        btnMin: Math.min(...[...pa.querySelectorAll('button')]
                  .map(b=>Math.round(b.getBoundingClientRect().height))) };})()`);
    console.log(`\n  ${t.name} — 아래 한 줄: ${JSON.stringify(bar.who)}`);
    briefs.add(bar.who);
    ok(`C-1 ${t.name} · 아래 한 줄이 **그 시루 번호**를 말한다`,
       bar.who.startsWith(t.name), bar.who);
    ok(`D-1 ${t.name} · 띠가 가로로 안 넘친다`, bar.overflowX <= 0, bar.overflowX + 'px');
    ok(`D-2 ${t.name} · 띠가 화면 안이다`, bar.inX && bar.inY);
    ok(`D-3 ${t.name} · 띠 단추가 44px 이상`, bar.btnMin >= 44, bar.btnMin + 'px');

    await click('pickZoom'); await sleep(700);
    const det = await page.eval(`(()=>{const d=document.getElementById('detail');
      const c=document.querySelector('#detail .dcard');
      const r=c?c.getBoundingClientRect():null;
      const rows={};
      for(const e of document.querySelectorAll('#dBody .row'))
        rows[(e.querySelector('span')||{}).textContent.trim()] =
          (e.querySelector('b')||{}).textContent.replace(/\\s+/g,' ').trim();
      return { on:d.classList.contains('on'),
        title:(document.getElementById('dTitle').textContent||'').trim(),
        sub:(document.getElementById('dSub').textContent||'').trim(),
        rows,
        ps:[...document.querySelectorAll('#dBody p')].map(p=>p.textContent.replace(/\\s+/g,' ').trim()),
        btns:[...document.querySelectorAll('#dBtns button')].map(b=>b.textContent.trim()),
        btnMin: Math.min(999, ...[...document.querySelectorAll('#dBtns button')]
                  .map(b=>Math.round(b.getBoundingClientRect().height))),
        inX: r ? (r.x >= -0.5 && r.x + r.width <= innerWidth + 0.5) : false,
        inY: r ? (r.y >= -0.5 && r.bottom <= innerHeight + 0.5) : false,
        cut: c ? (c.scrollHeight > c.clientHeight + 1) : false,
        overflowX: c ? c.scrollWidth - c.clientWidth : 0 };})()`);
    console.log('    카드 제목:', JSON.stringify(det.title), '· 자리', JSON.stringify(det.sub));
    console.log('    카드 줄:', JSON.stringify(det.rows));
    console.log('    카드 글:', JSON.stringify(det.ps));
    titles.add(det.title);
    ok(`A-1 ${t.name} · 카드가 열린다`, det.on);
    ok(`A-2 ★★ ${t.name} · 카드 제목에 **그 시루 번호**가 있다`,
       det.title.includes(t.name), det.title);
    ok(`A-3 ${t.name} · 카드가 그 시루의 **자리**를 말한다`, det.sub === t.where,
       det.sub + ' vs ' + t.where);
    /* ★★ B — [식물] 탭과 대조한다. 숫자를 이 파일이 갖지 않는다 */
    const cells = (t.cells || '').replace('칸', '');            // "4/5"
    const cardCells = (det.rows['자란 칸'] || '').replace(/\s|칸/g, '');   // "4/5"
    ok(`B-1 ★★★ ${t.name} · 카드의 「자란 칸」이 탭 게이지와 같다`,
       cardCells === cells, `카드 ${cardCells} · 탭 ${cells}`);
    const mLeft = /(\d+)일 남음/.exec(t.line);
    if (mLeft) ok(`B-2 ★★★ ${t.name} · 카드의 「남은 날」이 탭 줄과 같다`,
       det.rows['남은 날'] === mLeft[1] + '일', `카드 ${det.rows['남은 날']} · 탭 ${mLeft[1]}일`);
    /* ★ 자라는 중이면 카드는 그 문장을 **일부러 안 싣는다**(줄 둘이 이미 같은 말이다).
       그 밖의 상태에서는 까닭이 붙은 그 문장을 **탭 줄 그대로** 실어야 한다. */
    if (mLeft) ok(`B-3 ${t.name} · 자라는 중이면 같은 말을 두 번 안 한다`,
       !det.ps.some(p => /칸 ·.*남음/.test(p)), det.ps.join(' / '));
    else ok(`B-3 ${t.name} · 카드가 탭 줄의 **그 문장**을 그대로 싣는다`,
       det.ps.some(p => t.line.startsWith(p.replace(/\s+/g, ' '))), det.ps[0]);
    ok(`D-4 ${t.name} · 카드가 화면 안이다`, det.inX && det.inY);
    ok(`D-5 ${t.name} · 카드가 가로로 안 넘친다`, det.overflowX <= 0, det.overflowX + 'px');
    ok(`D-6 ${t.name} · 카드 단추가 44px 이상`, det.btnMin >= 44, det.btnMin + 'px');
    if (k.id === 'crop_01_01') await shot('detail_siru1');
    await page.eval(`(()=>{const b=document.getElementById('dClose'); if(b) b.click();})()`, false);
    await sleep(300);
  }
  ok('C-2 ★★ 아래 한 줄이 **시루마다 다르다**', briefs.size === keys.length,
     [...briefs].join(' / '));
  ok('A-4 ★★ 카드 제목이 **시루마다 다르다**', titles.size === keys.length,
     [...titles].join(' / '));

  /* 아래 한 줄이 보이는 그림 */
  await page.eval(`window.__picked.clear(); window.__picked.select('${keys[0].slotId}')`, false);
  await sleep(500);
  await shot('pickbar');

  /* ══ E — 가방의 빈 시루 카드는 그대로다 ══════════════════════════════ */
  console.log('\n== E. 가방의 빈 시루 카드는 한 글자도 안 바뀌었다 ==');
  await page.eval(`window.__picked.clear()`, false);
  await page.eval(`window.__byeetNoop=0; window.__byeotSheet.open('bag')`, false); await sleep(700);
  const bagCard = await page.eval(`(()=>{const b=document.querySelector('#bagGrid .bagslot .info');
    if(!b) return null; b.click();
    return { title:(document.getElementById('dTitle').textContent||'').trim(),
      body:(document.getElementById('dBody').textContent||'').replace(/\\s+/g,' ').trim() };})()`);
  if (bagCard) {
    ok('E-1 가방 칸 카드 제목이 「콩나물 시루」 그대로다', bagCard.title === '콩나물 시루', bagCard.title);
    ok('E-2 ★ 거기 「자란 날」이 없다', !/자란\s*날/.test(bagCard.body));
    ok('E-3 ★ 거기 「품질」이 없다', !/품질/.test(bagCard.body));
  } else ok('E-0 가방 칸을 못 찾았다(건너뜀)', true, '없음');
  await page.eval(`(()=>{const b=document.getElementById('dClose'); if(b) b.click();})()`, false);
  await page.eval(`window.__byeotSheet.close()`, false); await sleep(400);

  /* ══ F — 시루가 아닌 것은 예전 그대로 ═══════════════════════════════ */
  console.log('\n== F. 시루가 아닌 자리는 예전 그대로 자리 이름이다 ==');
  const other = await page.eval(`(()=>{ window.__picked.clear();
    window.__picked.select('banjiha-desk:0');
    return (document.getElementById('pickedName').textContent||'').trim();})()`);
  ok('F-1 빈 자리를 고르면 자리 이름이 뜬다(시루 문장이 안 뜬다)',
     !!other && !/칸 ·|남음|안 심었/.test(other), other);

  await page.close();
}

console.log(`\n★ game.html 부팅 예외 ${errsAll.length}건`);
for (const e of errsAll) console.log('   ', e);
ok('★ 부팅 예외 0', errsAll.length === 0, errsAll.length + '건');

console.log(`\n잰 것 ${seen}개 · 어긋난 것 ${bad}개`);
process.exit(bad ? 1 : 0);
