/* ============================================================
   tools/test_bagcell.mjs — 가방은 **빈 시루**만 · 게이지는 **칸**이다 · 2026-08-09 신설
   ------------------------------------------------------------
     python tools/serve.py 8963
     BYEOT_URL=http://127.0.0.1:8963 node tools/test_bagcell.mjs

   ★ 왜 이 검사가 생겼나 — **한 번 반쯤 고치고 「고쳤다」고 보고한 적이 있다.**
     박사님 원문: *"가방에 열린 콩나물 시루가 있으면 안 되지. 콩나물시루 아이템만 있어서
     그걸 드래그 하면 하나씩 따로따로 설치되게."*
     그때 카드의 **자리**(가방↔식물)만 옮기고 카드를 눌러 열리는 **상세 창의 내용**은
     그대로 뒀다. 그래서 박사님이 「자란 날 1/5일 · 받은 빛 · 품질」이 적힌
     「열린 콩나물 시루」를 폰에서 **똑같이 다시 보셨다.**
     ⇒ 이 검사는 **화면에 실제로 찍힌 글자**를 읽는다. 상태 값이 아니라 textContent 다.

     그리고 두 번째 지시: *"콩나물 시루에 콩 심으면 5칸짜리 빈 게이지가 생기고 날이 지나면
     1칸씩 차도록 직관적으로 하자."*
     ⇒ 매끈한 막대는 "며칠 남았나"를 안 말한다. 칸이라야 세어서 읽힌다.

   ══ 무엇을 보나 ═══════════════════════════════════════════════════════════
     B  가방 카드 상세 — 제목이 「콩나물 시루」고 **자란 날·받은 빛·품질이 없다**
     G  놓은 시루의 게이지가 **주기만큼의 칸**이다 (콩나물 5칸)
     W  ★ **물을 안 주면 칸이 안 찬다** — 그 상태가 빈 게이지와 **화면에서 갈린다**
     D  ★ [다음 날] 한 번에 **정확히 한 칸**이 찬다
     M  ★ **무순은 7칸**이다 — 5를 박아 두면 여기서 걸린다
     H  끌기가 살아 있다 (`#cropThumb` 이 손잡이다 — 이걸 죽이면 게임을 못 한다)

   ⚠ `BYEOT_URL` 은 **서버 주소**다(페이지 주소를 넣으면 404 로 죽는다).
============================================================ */
import { launch, sleep } from './test_cdp.mjs';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const SHOTS = !process.argv.includes('--no-shots');
const SHOT_DIR = fileURLToPath(new URL('../docs/engine/shots/', import.meta.url));

const _WATCHDOG_MS = +(process.env.BYEOT_PROBE_TIMEOUT_MS || 420000);
const _wd = setTimeout(() => { console.error('⏱ 자가 제한을 넘겨 멈춥니다.'); process.exit(2); }, _WATCHDOG_MS);
_wd.unref && _wd.unref();
process.on('exit', () => clearTimeout(_wd));

let bad = 0, seen = 0;
const ok = (name, cond, got) => {
  seen++;
  console.log(`${cond ? '  OK' : 'FAIL'}  ${name}${got == null || got === '' ? '' : '  → ' + got}`);
  if (!cond) bad++;
};

const page = await launch({ width: 390, height: 844, dpr: 2, mobile: false });
await page.goto(`${BASE}/game.html`);
await page.eval(`localStorage.clear()`, false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 180000, 300);
await page.waitFor('window.__byeotBooted === true', 180000, 300);
await sleep(3500);

const clickId = (id) => page.eval(`(()=>{const e=document.getElementById('${id}');
  if(!e||e.disabled) return false; e.click(); return true;})()`);
const skipTalk = async () => {
  for (let i = 0; i < 25; i++) {
    const t = await page.eval(`document.getElementById('stage').classList.contains('talking')`);
    if (!t) return;
    await page.eval(`document.getElementById('dlgBox').click()`, false);
    await sleep(200);
  }
};
await clickId('dlgSkip'); await sleep(700); await skipTalk();
await clickId('guideClose'); await sleep(500);

const shot = async (name) => {
  if (!SHOTS) return;
  try { await page.shot(SHOT_DIR + name + '.png');
        console.log(`        · 찍음 docs/engine/shots/${name}.png`); }
  catch (e) { console.log('       ↳ 못 찍음 — ' + (e && e.message)); }
};

/* ══ B. 가방 카드 상세 — 여기가 박사님이 보신 그 창이다 ══════════════════ */
console.log('\n══ B. 가방 카드는 **빈 시루**를 말한다 ═════════════════════════');
const openCrop = () => page.eval(`(()=>{
  const c = document.getElementById('cropCard');
  if (!c) return null;
  c.click();
  const d = document.getElementById('detail');
  return {
    on: d.classList.contains('on'),
    title: (document.getElementById('dTitle').textContent||'').trim(),
    sub: (document.getElementById('dSub').textContent||'').trim(),
    body: (document.getElementById('dBody').textContent||'').replace(/\\s+/g,' ').trim()
  }; })()`);
const closeDetail = () => page.eval(`(()=>{document.getElementById('dClose').click();return true;})()`, false);

/* ★ 그림도 같은 말을 해야 한다 (2026-08-10 신설).
     글은 「빈 시루」라고 하는데 그림이 **콩나물이 다 자란 열린 시루**였다 —
     B-1~B-7 이 글만 읽어서 그 어긋남을 통째로 놓쳤다. 그림은 글보다 먼저 읽힌다.
   ⚠ `src` 가 아니라 `currentSrc`·`naturalWidth` 를 본다. src 는 문자열일 뿐이고,
     파일이 없어도 통과한다 — **브라우저가 실제로 받아 그린 것**을 재야 한다.
   ⚠ 방에 서는 시루는 그대로 **열린** 시루다(3D `container_siru_open.glb`). 가방만 뚜껑이다. */
const BAG_PIC = 'container_siru_closed.png';   // 뚜껑 덮인 = 아직 안 심은 빈 용기
const picOf = s => (s || '').replace(/^.*\//, '').replace(/\?.*$/, '');
const headPic = await page.eval(`(()=>{const e=document.getElementById('cropThumb');
  return e ? { pic:e.currentSrc||e.src, w:e.naturalWidth } : null;})()`);
ok('B-a ★★ 가방 카드 머리 그림이 **뚜껑 덮인 시루**다',
   picOf(headPic && headPic.pic) === BAG_PIC, picOf(headPic && headPic.pic));
ok('B-b ★ 그 그림이 실제로 로드됐다 (깨진 경로가 아니다)',
   (headPic && headPic.w) > 0, headPic && headPic.w);

let d = await openCrop();
ok('B-0 가방 카드를 누르면 상세 창이 뜬다', !!(d && d.on), JSON.stringify(d && d.title));
await shot('bagcard_empty');
const detPic = await page.eval(`(()=>{const a=document.getElementById('dArt');
  return a ? { pic:a.currentSrc||a.src, w:a.naturalWidth } : null;})()`);
ok('B-c ★ 상세 창 그림도 **뚜껑 덮인 시루**다',
   picOf(detPic && detPic.pic) === BAG_PIC, picOf(detPic && detPic.pic));
ok('B-d ★ 상세 창 그림도 로드됐다', (detPic && detPic.w) > 0, detPic && detPic.w);
/* 가방 **격자**(BAG_ART) 칸은 맨 끝에서 본다 — §A. 상점 재고를 넣어야 그려지는데,
   여기서 넣으면 뒤따르는 G·W·D 가 세는 개수가 같이 움직인다. */
ok('B-1 제목이 「콩나물 시루」다 (「열린」이 안 붙는다)',
   d.title === '콩나물 시루', d.title);
ok('B-2 ★ 「자란 날」이 **없다**', !/자란\s*날/.test(d.body), d.body.slice(0, 90));
ok('B-3 ★ 「품질」이 **없다**', !/품질/.test(d.body), d.body.slice(0, 90));
ok('B-4 ★ 「받은 빛」이 **없다**', !/받은\s*빛/.test(d.body), d.body.slice(0, 90));
ok('B-5 「가방에 몇 개」를 말한다', /가방/.test(d.sub) && /가방에 남은 것/.test(d.body),
   `${d.sub} | ${d.body.slice(0, 40)}`);
ok('B-6 「끌어다 놓으라」고 안내한다', /끌어다/.test(d.body), '');
ok('B-7 칸 게이지를 미리 말해 준다 (5칸)', /5칸/.test(d.body), '');
await closeDetail(); await sleep(300);

/* ══ H·G. 끌어다 놓고 · 칸을 센다 ═══════════════════════════════════════ */
console.log('\n══ H·G. 끌기는 살아 있고, 놓으면 **칸**이 생긴다 ═══════════════');
const pickFloor = (potD) => page.eval(`(()=>{ const rv=window.__rv;
  const c=document.getElementById('roomCanvas').getBoundingClientRect();
  for (const fy of [0.80,0.74,0.68,0.86,0.62]) for (const fx of [0.5,0.38,0.62,0.28,0.72]) {
    const x=c.left+c.width*fx, y=c.top+c.height*fy;
    let h=null; try{ h=rv.surfaceAt(x,y,{ potD:${potD} }); }catch(e){}
    if(!h||!h.ok) continue;
    return { x, y };
  }
  return null; })()`);
const dropAt = (x, y) => page.eval(`(()=>{
  const t = document.getElementById('cropThumb');
  window.__drag.begin('beansprout', t.src, { clientX:${x}, clientY:${y} });
  if (!window.__drag.on) return { began:false };
  window.__drag.move({ clientX:${x}, clientY:${y} });
  window.__drag.end();
  return { began:true }; })()`);

/* 칸을 **화면에서 센다.** 상태를 되읽으면 아무것도 안 재는 검사가 된다. */
const cellsOf = (sel) => page.eval(`(()=>{
  const box = document.querySelector(${JSON.stringify(sel)});
  if (!box) return null;
  const cells = [...box.querySelectorAll(':scope > i')];
  return {
    n: cells.length,
    on: cells.filter(c => c.classList.contains('on')).length,
    dry: box.classList.contains('dry'),
    done: box.classList.contains('done'),
    /* 물을 안 준 칸과 그냥 빈 칸이 **눈으로 갈리나** — 실제로 칠해진 값을 읽는다 */
    paint: cells.length ? getComputedStyle(cells[0]).boxShadow : ''
  }; })()`);
const lineOf = (sel) => page.eval(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});
  return e ? (e.textContent||'').replace(/\\s+/g,' ').trim() : null;})()`);

const spot = await pickFloor(0.24);
ok('H-0 방바닥에 놓을 자리를 찾았다', !!spot, JSON.stringify(spot));
if (!spot) { await page.close(); process.exit(1); }
const drag = await dropAt(spot.x, spot.y);
ok('H-1 ★ `#cropThumb` 끌기가 여전히 시작된다', drag.began === true, JSON.stringify(drag));
await sleep(1400); await skipTalk(); await sleep(600);
await page.eval(`(()=>{ try{ window.__byeotSheet.open(); window.__byeotSheet.tab && window.__byeotSheet.tab('plants'); }catch(e){} })()`, false);
await sleep(600);

let g = await cellsOf('#siruList .siru .cells');
ok('G-1 놓으면 게이지가 **칸으로** 생긴다', !!g, JSON.stringify(g));
ok('G-2 ★ 콩나물은 **5칸**이다 (주기 5일)', g && g.n === 5, g && g.n);
ok('G-3 심자마자는 **빈 칸 5개**다 (찬 칸 0)', g && g.on === 0, g && g.on);

/* ══ W. 물을 안 주면 칸이 안 찬다 — 그게 화면에서 갈려야 한다 ═══════════ */
console.log('\n══ W. 물을 안 준 시루는 **화면에서 갈린다** ═══════════════════');
ok('W-1 ★ 물 대기 상태가 게이지 옷으로 표시된다 (.cells.dry)', g && g.dry === true, g && g.dry);
const line0 = await lineOf('#siruList .siru .siruline');
ok('W-2 옆줄이 「물을 주면 …」이라 말한다', /물을 주면/.test(line0 || ''), line0);
await shot('cells_dry');

const nextDay = async () => {
  await clickId('next');
  await sleep(1600); await skipTalk(); await sleep(600);
  await page.eval(`(()=>{ try{ window.__byeotSheet.open(); window.__byeotSheet.tab && window.__byeotSheet.tab('plants'); }catch(e){} })()`, false);
  await sleep(500);
};
/* ★ 물을 안 준 채 하루를 넘겨 본다 — 칸이 **안 차야** 한다 */
await nextDay();
g = await cellsOf('#siruList .siru .cells');
ok('W-3 ★★ 물을 안 줬으면 하루가 가도 칸이 **안 찬다**', g && g.on === 0 && g.dry === true,
   JSON.stringify(g));

/* 물을 준다 — 그 시루의 [💧 물 주기] 버튼을 실제로 누른다 */
const waterFirst = () => page.eval(`(()=>{
  const b = document.querySelector('#siruList .siru button[data-act="water"]');
  if (!b) return false; b.click(); return true; })()`);
ok('W-4 그 시루의 [물 주기] 버튼이 있다', await waterFirst() === true, '');
/* ⚠ **바로 안 젖는다.** 물주기는 자취생이 그 시루까지 **걸어가서** 하는 일이라
   (probe_water_walk) 누른 순간과 젖는 순간 사이에 걸음이 있다. 시간을 박아 두면
   느린 기계에서 헛되이 실패한다 — 젖을 때까지 기다린다. */
for (let i = 0; i < 40; i++) {
  await sleep(400); await skipTalk();
  await page.eval(`(()=>{ try{ window.__byeotSheet.open(); window.__byeotSheet.tab && window.__byeotSheet.tab('plants'); }catch(e){} })()`, false);
  g = await cellsOf('#siruList .siru .cells');
  if (g && g.dry === false) break;
}
ok('W-5 물을 준 날은 **0일차** — 칸은 아직 0이되 마름 표시가 걷힌다',
   g && g.on === 0 && g.dry === false, JSON.stringify(g));
await shot('cells_watered');

/* ══ D. 하루에 한 칸 ════════════════════════════════════════════════════ */
console.log('\n══ D. [다음 날] 한 번에 **한 칸** ═════════════════════════════');
await nextDay();
g = await cellsOf('#siruList .siru .cells');
ok('D-1 ★★ 하루를 넘기면 **정확히 한 칸**이 찬다', g && g.n === 5 && g.on === 1, JSON.stringify(g));
const line1 = await lineOf('#siruList .siru .siruline');
ok('D-2 옆줄도 칸으로 말한다 (1/5칸)', /1\/5칸/.test(line1 || ''), line1);
await shot('cells_day1');

await nextDay();
g = await cellsOf('#siruList .siru .cells');
ok('D-3 이틀째도 한 칸만 는다 (2/5)', g && g.on === 2, JSON.stringify(g));

await nextDay(); await nextDay(); await nextDay();
g = await cellsOf('#siruList .siru .cells');
ok('D-4 ★ 다섯 날이면 **다 찬다** (5/5)', g && g.on === 5, JSON.stringify(g));
const lineF = await lineOf('#siruList .siru .siruline');
ok('D-5 다 차면 「거둘 때」라고 말한다', /거둘 때/.test(lineF || ''), lineF);
await shot('cells_full');

/* ══ M. 무순은 7칸 ══════════════════════════════════════════════════════ */
console.log('\n══ M. 무순은 **7칸**이다 (주기가 작물마다 다르다) ═══════════════');
/* 무순 칸은 몬스테라가 온 뒤에 열린다 — 여기서 볼 것은 **칸 수**뿐이라 문만 연다 */
await page.eval(`(()=>{ const S=window.__S();
  S.firstPlay.monstera = S.firstPlay.monstera || {};
  S.firstPlay.monstera.arrived = true;
  window.__redraw(); return true; })()`, false);
await sleep(700);
await page.eval(`(()=>{ try{ window.__byeotSheet.open(); window.__byeotSheet.tab && window.__byeotSheet.tab('plants'); }catch(e){} })()`, false);
await sleep(500);
/* 눈으로도 봐야 한다 — 칸이 화면 밖에 있으면 사진이 아무것도 증명 못 한다.
   ⚠ 안 놓은 재배판 카드는 **[가방]** 에 산다(holdCard) — [식물] 을 아무리 훑어도 없다 */
await page.eval(`(()=>{ try{ window.__byeotSheet.open(); window.__byeotSheet.tab && window.__byeotSheet.tab('bag'); }catch(e){}
  const c=document.getElementById('musunCard');
  if (c) c.scrollIntoView({ block:'center' }); return true; })()`, false);
await sleep(600);
const m = await cellsOf('#musunGauge .cells');
ok('M-1 무순 칸에도 칸 게이지가 있다', !!m, JSON.stringify(m));
ok('M-2 ★★ 무순은 **7칸**이다 (5를 박아 뒀으면 여기서 걸린다)', m && m.n === 7, m && m.n);
ok('M-3 안 심었으면 찬 칸이 0이다', m && m.on === 0, m && m.on);
await shot('cells_musun7');

/* ══ A. 가방 **격자** 칸도 빈 용기다 ═══════════════════════════════════
   상점에서 사서 쟁여 둔 것도 「아직 안 심은 것」이다 — 격자는 `BAG_ART` 를 읽는다.
   ⚠ 격자는 **상점 재고가 있어야** 그려진다(`drawBag` 의 `have>0`). 첫 플레이가 들고
     시작하는 시루는 상점 재고가 아니라서, 재고를 넣어야 이 칸이 화면에 선다.
   ⚠ 그래서 **맨 끝**에 둔다 — 재고를 넣으면 앞의 개수 검사들이 같이 움직인다. */
console.log('\n══ A. 가방 격자 칸도 **빈 용기**다 ════════════════════════════');
await page.eval(`(()=>{ const S=window.__S();
  S.shop = S.shop || {}; S.shop.stock = S.shop.stock || {};
  S.shop.stock.siru = (S.shop.stock.siru||0) + 3;
  window.__redraw();
  try{ window.__byeotSheet.open(); window.__byeotSheet.tab && window.__byeotSheet.tab('bag'); }catch(e){}
  const g=document.getElementById('bagGrid'); if(g) g.scrollIntoView({block:'center'});
  return true; })()`, false);
await sleep(1000);
const slotPic = await page.eval(`(()=>{ const b=[...document.querySelectorAll('.bagslot')]
    .find(v=>/시루/.test(v.getAttribute('title')||''));
  if(!b) return null; const i=b.querySelector('img');
  return i ? { pic:i.currentSrc||i.src, w:i.naturalWidth } : { pic:null, w:0 }; })()`);
ok('A-1 가방 격자에 시루 칸이 섰다', !!slotPic, JSON.stringify(slotPic));
ok('A-2 ★★ 격자 칸 그림도 **뚜껑 덮인 시루**다', !!slotPic && picOf(slotPic.pic) === BAG_PIC,
   slotPic && picOf(slotPic.pic));
ok('A-3 ★ 그 그림이 실제로 로드됐다', !!slotPic && slotPic.w > 0, slotPic && slotPic.w);
await shot('baggrid_empty_siru');

/* ══ 콘솔에 처리 안 된 예외가 없다 ═════════════════════════════════════ */
console.log('');
console.log(`잰 것 ${seen}개 · 어긋난 것 ${bad}개`);
await page.close();
process.exit(bad ? 1 : 0);
