/* ============================================================
   tools/probe_varie_grade.mjs — 등급 매기기 도구를 실제로 띄워 확인한다. 2026-08-09

     python tools/serve.py 8963
     node tools/probe_varie_grade.mjs

   무엇을 재나 (전부 「눈으로 확인했다」의 증거다)
     ① 몇 종이 실제로 격자에 뜨나 · 갈래별로 몇 종인가
     ② 썸네일 34장이 다 뜨나 · 몇 픽셀인가 (안 뜨면 무늬를 못 가린다)
     ③ 값 표가 priceOf 와 같은 값을 내나 (표를 손으로 안 적었다는 증거)
     ④ 등급을 고르고 **새로고침해도 남나**
     ⑤ 내보내기가 JSON·마크다운 둘 다 나오나
     ⑥ 폰 폭(390px)에서 가로로 안 넘치나

   그림은 BYEOT_SHOTS(없으면 임시 폴더)에 남긴다 — 저장소를 안 더럽힌다.
============================================================ */
import { launch, sleep } from './test_cdp.mjs';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const OUT = process.env.BYEOT_SHOTS || path.join(os.tmpdir(), 'byeot-varie-shots');
const URL = `${BASE}/tools/varie_grade.html`;

const ok = (m) => console.log('  ✓ ' + m);

async function open(page) {
  await page.goto(URL);
  await page.waitFor(`document.querySelectorAll('.card').length > 0`, 30000, 150);
  /* 게으른 그림은 화면에 안 들어오면 안 받는다 — 재려면 다 받게 한다 */
  await page.eval(`(async()=>{ const I=[...document.querySelectorAll('.card .thumb img')];
    I.forEach(i=>i.loading='eager');
    await Promise.all(I.map(i=> i.complete && i.naturalWidth ? 1 : new Promise(r=>{i.onload=r;i.onerror=r;})));
    return 1; })()`);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  console.log(`대상 ${URL}\n그림 ${OUT}\n`);

  /* ── 데스크톱 ─────────────────────────────────────────── */
  let page = await launch({ width: 1280, height: 900, dpr: 1 });
  page.on((m, p) => { if (m === 'Runtime.exceptionThrown') console.log('EX ' + p.exceptionDetails.text); });
  await page.eval(`localStorage.clear()`).catch(() => { });
  await open(page);

  /* ① 몇 종인가 */
  const groups = await page.eval(`(()=>{
    const out=[]; document.querySelectorAll('h2.sec').forEach(h=>{
      out.push([h.textContent, h.parentNode.querySelector('h2.sec + .grid, h2.sec + .secnote + .grid')]);
    });
    return [...document.querySelectorAll('h2.sec')].map(h=>h.textContent);
  })()`);
  const cards = await page.eval(`document.querySelectorAll('.card').length`);
  console.log('① 갈래');
  groups.forEach(g => console.log('     ' + g));
  ok(`격자에 뜬 것 ${cards}종`);
  assert.strictEqual(cards, 34, '변이 34종이 다 떠야 한다');

  /* ①-2 색변형까지 켜면 100종 · 다시 끄면 34종 */
  const withRe = await page.eval(`(()=>{ document.getElementById('t-recolor').click();
    return document.querySelectorAll('.card').length; })()`);
  const backOff = await page.eval(`(()=>{ document.getElementById('t-recolor').click();
    return document.querySelectorAll('.card').length; })()`);
  assert.strictEqual(withRe, 100, '색변형까지 켜면 100종이라야 한다');
  assert.strictEqual(backOff, 34);
  ok(`[색변형도 보기] → ${withRe}종 · 다시 누르면 ${backOff}종`);

  /* ② 썸네일 */
  const thumbs = await page.eval(`(()=>{ const I=[...document.querySelectorAll('.card .thumb img')];
    return { n:I.length, bad:I.filter(i=>!i.naturalWidth).length,
             sizes:[...new Set(I.map(i=>i.naturalWidth+'x'+i.naturalHeight))] }; })()`);
  console.log('② 썸네일');
  ok(`${thumbs.n}장 중 깨진 것 ${thumbs.bad}장 · 크기 ${thumbs.sizes.join(', ')}`);
  assert.strictEqual(thumbs.bad, 0, '썸네일이 깨지면 무늬를 못 가린다');

  /* ③ 값 표 = priceOf */
  const price = await page.eval(`(async()=>{
    const m = await import('/src/game/shop.js');
    const leaves = 8;
    const mine = m.VARIE_GRADES.map(g => m.priceOf({species:'monstera', leaves, variegatedLeaves:g.minVarieLeaves}).won);
    const shown = [...document.querySelectorAll('#pricetable tr')].slice(1)
      .map(tr => Number(tr.cells[3].textContent.replace(/[^0-9]/g,'')));
    return { mine, shown };
  })()`);
  console.log('③ 값 표 (잎 8장)');
  assert.deepStrictEqual(price.shown, price.mine, '표가 priceOf 와 갈렸다');
  ok('priceOf 와 같다 — ' + price.mine.map(n => n.toLocaleString('ko-KR')).join(' / '));

  /* ④ 고른 것이 새로고침을 견디나 */
  const first = await page.eval(`document.querySelector('.card .name').textContent`);
  await page.eval(`(()=>{ document.querySelectorAll('.card')[0].querySelectorAll('.picks button')[3].click(); return 1; })()`);
  const stored = await page.eval(`localStorage.getItem('byeot.varie_grade.v1')`);
  await page.shot(path.join(OUT, 'desktop_picked.png'));
  await open(page);   // 새로고침
  const after = await page.eval(`(()=>{ const b=[...document.querySelectorAll('.card')[0].querySelectorAll('.picks button')]
    .findIndex(x=>x.classList.contains('on')); return { idx:b, name:document.querySelector('.card .name').textContent,
    done:document.querySelectorAll('.card.done').length }; })()`);
  console.log('④ 새로고침');
  assert.strictEqual(after.idx, 3, '새로고침 뒤에도 고른 등급(하프문)이 켜져 있어야 한다');
  assert.strictEqual(after.name, first);
  ok(`「${first}」에 하프문을 찍고 새로고침 → 그대로 · 저장값 ${stored}`);

  /* ⑤ 내보내기 */
  const exp = await page.eval(`(()=>{ document.getElementById('go-export').click();
    const j = document.getElementById('out').value;
    document.getElementById('e-md').click();
    const m = document.getElementById('out').value;
    return { j, m }; })()`);
  console.log('⑤ 내보내기');
  assert.ok(exp.j.includes('"halfmoon"'), 'JSON 에 고른 등급이 들어가야 한다');
  assert.ok(exp.m.includes('| 하프문 |'), '마크다운 표에 고른 등급이 들어가야 한다');
  ok('JSON · 마크다운 둘 다 나온다');
  console.log(exp.m.split('\n').slice(0, 4).map(s => '     ' + s).join('\n'));
  await page.shot(path.join(OUT, 'desktop_export.png'));
  await page.close();

  /* ⑥ 폰 폭 390 */
  page = await launch({ width: 390, height: 844, dpr: 2, mobile: true });
  await open(page);
  const fit = await page.eval(`(()=>{
    const cs=[...document.querySelectorAll('.card')].map(c=>c.getBoundingClientRect());
    const box=document.querySelector('.tablescroll'), tb=document.getElementById('pricetable');
    return { scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth,
             cols: new Set(cs.map(r=>Math.round(r.left))).size,
             cardW: Math.round(cs[0].width), cardH: Math.round(cs[0].height),
             tableW: Math.round(tb.getBoundingClientRect().width), boxW: Math.round(box.clientWidth),
             minBtnH: Math.min(...[...document.querySelectorAll('.picks button')].map(b=>Math.round(b.getBoundingClientRect().height))) }; })()`);
  console.log('⑥ 폰 폭 390');
  assert.ok(fit.scrollW <= fit.clientW + 1, `가로로 넘친다: ${fit.scrollW} > ${fit.clientW}`);
  /* ★ 값 표가 칸 안에 다 들어와야 한다 — 잘리면 「값이 얼마가 되나」를 못 본다 */
  assert.ok(fit.tableW <= fit.boxW + 1, `값 표가 잘린다: ${fit.tableW} > ${fit.boxW}`);
  ok(`가로 안 넘침(${fit.scrollW}≤${fit.clientW}) · 값 표 ${fit.tableW}≤${fit.boxW} · ` +
     `${fit.cols}단 · 칸 ${fit.cardW}×${fit.cardH} · 단추 높이 ${fit.minBtnH}px`);
  await page.shot(path.join(OUT, 'phone_top.png'));
  await page.eval(`window.scrollTo(0, 620)`, false); await sleep(300);
  await page.shot(path.join(OUT, 'phone_grid.png'));
  /* 크게 보기 */
  await page.eval(`document.querySelectorAll('.card .thumb')[0].click()`, false);
  await sleep(700);
  const bigOk = await page.eval(`(()=>{ const d=document.getElementById('big');
    const i=document.getElementById('bigimg');
    return { open:d.open, w:i.naturalWidth, h:i.naturalHeight, src:i.getAttribute('src') }; })()`);
  await page.shot(path.join(OUT, 'phone_big.png'));
  console.log('   크게 보기');
  assert.ok(bigOk.open && bigOk.w > 512, '크게 보기는 원본을 띄워야 한다');
  ok(`원본 ${bigOk.w}×${bigOk.h} — ${decodeURIComponent(bigOk.src)}`);
  await page.close();

  console.log('\n전부 통과. 그림: ' + OUT);
}

main().catch(e => { console.error('실패: ' + e.message); process.exit(1); });
