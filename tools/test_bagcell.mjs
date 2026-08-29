/* ============================================================
   tools/test_bagcell.mjs — 가방은 **빈 시루**만 · 게이지는 **칸**이다 · 2026-08-09 신설
   ------------------------------------------------------------
   ⚠★ **이 검사는 `docs/engine/shots/` 의 문서 그림을 덮어쓴다.** 돌린 뒤 뜻이 없으면
     `git checkout -- docs/engine/shots` 로 되돌려라 — 안 그러면 다른 창의 리베이스를 막는다
     (2026-08-29 에 실제로 그랬다). 안 찍고 돌리려면 `--no-shots`.
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

   ★★ 2026-08-10 · 셋째 지시로 **P·A 절이 늘었다**
     원문: *"가방을 열었을 때 맨 위 콩나물 시루 큰 칸으로 된 저게 안 보이고, 밑에 그냥
     콩나물 시루 ×4 된 걸 누르거나 드래그할 때마다 1개씩 배치되면 좋겠어."*
     같은 시루가 **큰 카드**와 **격자 칸**으로 두 번 떠 있었다(카드가 화면 절반).
     ⇒ 큰 카드를 없애고 격자 칸을 손잡이로 삼았다.
     ⚠ 이 검사가 큰 카드를 재고 있었다(옛 B-0 이 `#cropCard` 를 눌렀다). **코드가 옳고
       검사가 낡은 것**이라 보는 자리만 옮겼다 — 지키던 뜻(창의 내용 · 끌기가 산다)은 그대로다.

   ══ 무엇을 보나 ═══════════════════════════════════════════════════════════
     P  ★ 가방을 열면 **큰 카드가 없고 격자만** 있다 · 칸이 곧 손잡이다 · 안내가 안 사라졌다
     B  가방 칸의 상세 창 — 제목이 「콩나물 시루」고 **자란 날·받은 빛·품질이 없다**
     G  놓은 시루의 게이지가 **주기만큼의 칸**이다 (콩나물 5칸)
     W  ★ **물을 안 주면 칸이 안 찬다** — 그 상태가 빈 게이지와 **화면에서 갈린다**
     D  ★ [다음 날] 한 번에 **정확히 한 칸**이 찬다
     M  ★ **무순은 7칸**이다 — 5를 박아 두면 여기서 걸린다
     H  끌기가 살아 있다 (`#cropThumb` 이 손잡이다 — 이걸 죽이면 게임을 못 한다)
     A  ★ 칸을 **끌면·누르면** 한 개씩 서고 **×N 이 준다** · 0개가 되면 칸이 사라진다

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

let shotCount = 0;                     /* ★ 몇 장을 덮어썼나 — 끝에서 말해 준다(§머리말 ⚠) */
const shot = async (name) => {
  if (!SHOTS) return;
  try { await page.shot(SHOT_DIR + name + '.png'); shotCount += 1;
        console.log(`        · 찍음 docs/engine/shots/${name}.png`); }
  catch (e) { console.log('       ↳ 못 찍음 — ' + (e && e.message)); }
};

/* 가방을 연다 — 격자를 눈으로 보는 절이 여럿이라 한 곳에 둔다.
   ⚠ 안내 손가락을 **같이 다시 그린다.** 실제 [가방] 버튼은 열면서 `__byeotHint` 를
     부르는데(§openSheet), 여기서는 그 버튼을 안 거치므로 손가락이 옛 자리를 가리킨
     채로 사진에 찍힌다 — 사진이 거짓말을 하면 사진을 증거로 못 쓴다. */
const openBag = () => page.eval(`(()=>{ try{ window.__byeotSheet.open();
  window.__byeotSheet.tab && window.__byeotSheet.tab('bag'); }catch(e){}
  const g=document.getElementById('bagGrid'); if(g) g.scrollIntoView({block:'start'});
  try{ window.__byeotHint && window.__byeotHint(); }catch(e){}
  return true; })()`, false);
/* 화면에 실제로 찍힌 시루 칸 — 개수 배지까지 **글자로** 읽는다(상태를 되읽지 않는다).
   ⚠ 칸 이름(`.nm`)으로 고른다. `title` 로 고르면 **「콩 씨앗 (1시루분)」이 걸린다** —
     그 이름에도 「시루」가 들어 있어서, 시루 칸이 사라진 판에서 씨앗 칸을 시루로 읽는다
     (2026-08-10 에 실제로 A-13 이 그렇게 헛통과할 뻔했다). */
const CELL_PICK = `[...document.querySelectorAll('.bagslot')].find(v=>((v.querySelector('.nm')||{}).textContent||'').trim()==='콩나물 시루')`;
const siruCell = () => page.eval(`(()=>{
  const b = ${CELL_PICK};
  if (!b) return null;
  const img = b.querySelector('img');
  const r = b.getBoundingClientRect();
  return {
    qty: (b.querySelector('.qty')||{}).textContent || null,
    act: b.classList.contains('act'),
    place: b.getAttribute('data-place'),
    hasThumb: !!(img && img.id === 'cropThumb'),
    hasInfo: !!b.querySelector('button.info'),
    pic: img ? (img.currentSrc||img.src) : null, w: img ? img.naturalWidth : 0,
    box: { x:Math.round(r.x), y:Math.round(r.y), w:Math.round(r.width), h:Math.round(r.height) }
  }; })()`);

/* ══ P. ★★ 가방을 열면 **격자만** 있다 (2026-08-10 · 이번 지시의 본문) ═══════
   박사님 원문: *"가방을 열었을 때 맨 위 콩나물 시루 큰 칸으로 된 저게 안 보이고,
   밑에 그냥 콩나물 시루 ×4 된 걸 누르거나 드래그할 때마다 1개씩 배치되면 좋겠어."*
   ⇒ 같은 시루가 큰 카드와 격자 칸으로 **두 번** 떠 있던 것을 하나로 합쳤다.
     이 절이 지키는 것은 「합쳐졌나」이지 「예뻐졌나」가 아니다. */
console.log('\n══ P. 가방을 열면 **큰 카드가 없고 격자만** 있다 ════════════════');
await openBag(); await sleep(600);
const gone = await page.eval(`({
  card: !!document.getElementById('cropCard'),
  placeBtn: !!document.getElementById('cropPlaceStart'),
  dropBtn: !!document.getElementById('placeCrop'),
  heldShown: [...document.getElementById('bagHold').children]
             .filter(c=>getComputedStyle(c).display!=='none').length,
  help: (document.querySelector('#bagGrid .baghelp')||{}).textContent || null
})`);
ok('P-1 ★★ 콩나물 시루 **큰 카드가 아예 없다**', gone.card === false, `cropCard=${gone.card}`);
ok('P-2 ★ 그 카드에 달려 있던 [📍 방에 배치하기]도 없다', gone.placeBtn === false);
ok('P-3 ★ [하나 두기] 드롭다운 단추도 없다 (길이 하나로 줄었다)', gone.dropBtn === false);
ok('P-4 ★ 가방 맨 위에 보이는 카드가 하나도 없다 (격자만 남았다)',
   gone.heldShown === 0, `보이는 카드 ${gone.heldShown}장`);
let cell = await siruCell();
/* ⚠ 여기가 핵심이다 — 첫 플레이의 시루는 **상점 재고가 아니다**(개체가 이미 있다).
     칸이 재고만 세면 이 순간 칸이 아예 안 그려져서 **첫 시루를 못 놓는다.** */
ok('P-5 ★★ 격자에 「콩나물 시루」 칸이 섰다 (재고 0인 첫 시루도 센다)', !!cell, JSON.stringify(cell));
ok('P-6 그 칸이 **가진 수**를 말한다 (×1)', cell && cell.qty === '×1', cell && cell.qty);
ok('P-7 ★★ 그 칸이 **끄는 칸**이다 (`#cropThumb` 이 칸 안에 있다)',
   !!cell && cell.hasThumb === true && cell.act === true && cell.place === 'beansprout',
   JSON.stringify({ thumb: cell && cell.hasThumb, act: cell && cell.act }));
ok('P-8 ★ 없어진 카드의 안내(「한 번에 하나씩」)가 격자 아래에 남아 있다',
   /하나씩/.test(gone.help || '') && /끌거나 누르면/.test(gone.help || ''), gone.help);
ok('P-9 ★ 상세 창으로 가는 [i] 가 칸에 있다 (카드를 누르면 뜨던 그 창)',
   !!cell && cell.hasInfo === true);
/* 폰 폭 390 — 칸이 화면 밖으로 안 나간다 */
ok('P-10 칸이 폰 폭(390) 안에 있다',
   !!cell && cell.box.x >= 0 && cell.box.x + cell.box.w <= 390, JSON.stringify(cell.box));
await shot('bag_grid_only');

/* ══ B. 가방 칸 상세 — 여기가 박사님이 보신 그 창이다 ══════════════════ */
console.log('\n══ B. 가방 칸의 상세 창은 **빈 시루**를 말한다 ═════════════════');
/* ★ 2026-08-10 — 누르는 자리가 카드에서 **칸의 [i]** 로 옮겨졌다. 칸을 그냥 누르면
     이제 **배치**로 간다(박사님 "누르거나 드래그할 때마다 1개씩 배치"). 상세 창은
     [i] 뒤에 산다 — 창의 **내용**은 한 글자도 안 줄었다(아래 B-1~B-7 이 그걸 잰다). */
const openCrop = () => page.eval(`(()=>{
  const b = ${CELL_PICK};
  const c = b && b.querySelector('button.info');
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
ok('B-a ★★ 가방 격자 칸의 시루 그림이 **뚜껑 덮인 시루**다',
   picOf(headPic && headPic.pic) === BAG_PIC, picOf(headPic && headPic.pic));
ok('B-b ★ 그 그림이 실제로 로드됐다 (깨진 경로가 아니다)',
   (headPic && headPic.w) > 0, headPic && headPic.w);

let d = await openCrop();
ok('B-0 칸의 [i] 를 누르면 상세 창이 뜬다', !!(d && d.on), JSON.stringify(d && d.title));
await shot('bagcard_empty');
const detPic = await page.eval(`(()=>{const a=document.getElementById('dArt');
  return a ? { pic:a.currentSrc||a.src, w:a.naturalWidth } : null;})()`);
ok('B-c ★ 상세 창 그림도 **뚜껑 덮인 시루**다',
   picOf(detPic && detPic.pic) === BAG_PIC, picOf(detPic && detPic.pic));
ok('B-d ★ 상세 창 그림도 로드됐다', (detPic && detPic.w) > 0, detPic && detPic.w);
/* 격자 칸이 **손잡이로서** 도는지는 맨 끝에서 본다 — §A. 상점 재고를 넣어야 하는데,
   여기서 넣으면 뒤따르는 G·W·D 가 세는 개수가 같이 움직인다. */
ok('B-1 제목이 「콩나물 시루」다 (「열린」이 안 붙는다)',
   d.title === '콩나물 시루', d.title);
ok('B-2 ★ 「자란 날」이 **없다**', !/자란\s*날/.test(d.body), d.body.slice(0, 90));
ok('B-3 ★ 「품질」이 **없다**', !/품질/.test(d.body), d.body.slice(0, 90));
ok('B-4 ★ 「받은 빛」이 **없다**', !/받은\s*빛/.test(d.body), d.body.slice(0, 90));
ok('B-5 「가방에 몇 개」를 말한다', /가방/.test(d.sub) && /가방에 남은 것/.test(d.body),
   `${d.sub} | ${d.body.slice(0, 40)}`);
/* ★ 2026-08-10 — 길이 둘이 됐다(끌기 · 누르기). 창이 **둘 다** 말해야 한다 —
     폰에서는 끌기가 힘들어서 누르기만 아는 사람이 있고, 그 반대도 있다. */
ok('B-6 「끌거나 누르면 하나씩 선다」고 안내한다',
   /끌거나/.test(d.body) && /누르면/.test(d.body) && /한 개씩/.test(d.body), d.body.slice(0, 120));
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

/* ★★★ 2026-08-16 — **놓기와 심기가 갈렸다** (박사님: *"콩나물 시루가 콩씨앗이 없어도
   설치되게 해줘. 그리고 용기에 씨 심기 해서 심도록"*). 그래서 이 절 앞에 **심는 걸음**이
   하나 붙는다 — 예전에는 놓으면 곧 심긴 것이라 바로 물 대기였다.
   ⚠ 이 절이 재는 것은 「게이지가 칸인가 · 하루에 한 칸인가」이지 「언제 심는가」가 아니다.
     그래서 지키던 뜻은 한 글자도 안 무르고, 앞에 손 하나를 더 밟는다.
   ⚠ 걸음이 있다(doAct — 자취생이 시루까지 걸어간다). 시간을 박지 않고 **기다린다**. */
const sowFirst = () => page.eval(`(()=>{
  const b = document.querySelector('#siruList .siru button[data-act="plant"]');
  if (!b) return false; b.click(); return true; })()`);
ok('G-0 ★ 놓은 시루에 [🌱 심기] 단추가 있다 (씨앗은 놓은 뒤에 뿌린다)',
   await sowFirst() === true, '');
for (let i = 0; i < 40; i++) {
  await sleep(400); await skipTalk();
  await page.eval(`(()=>{ try{ window.__byeotSheet.open(); window.__byeotSheet.tab && window.__byeotSheet.tab('plants'); }catch(e){} })()`, false);
  const sown = await page.eval(`(()=>{const b=window.__S().firstPlay.beansprout;
    return ((b.pots)||[]).some(p=>p.sown !== false && (p.slotId||p.at));})()`);
  if (sown) break;
}

let g = await cellsOf('#siruList .siru .cells');
ok('G-1 심으면 게이지가 **칸으로** 생긴다', !!g, JSON.stringify(g));
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

/* ══ A. ★★ 가방 격자 칸이 **곧 손잡이다** (2026-08-10) ══════════════════
   박사님 원문: *"콩나물 시루 ×4 된 걸 누르거나 드래그할 때마다 1개씩 배치되면 좋겠어."*
   ⇒ 재는 것은 셋이다: ① 끌면 하나 선다 ② 누르면 하나 선다 ③ 그때마다 **×N 이 준다**
     ④ 0개가 되면 칸이 사라진다(예전엔 카드째 숨었다).
   ⚠ 재고를 넣는 절이라 **맨 끝**에 둔다 — 앞의 개수 검사들이 같이 움직인다.
   ⚠ 씨앗도 같이 넣는다. 재고에서 시루를 꺼내 세우는 길은 씨앗 한 봉지를 쓴다
     (§sowOnDropPlan) — 안 넣으면 끌기가 막혀 이 절이 아무것도 못 잰다. */
console.log('\n══ A. 가방 격자 칸이 **곧 손잡이다** ═══════════════════════════');
const placedNow = () => page.eval(`(()=>{ const b=window.__S().firstPlay.beansprout;
  return ((b&&b.pots)||[]).filter(p=>p&&(p.slotId||p.at)).length; })()`);
await page.eval(`(()=>{ const S=window.__S();
  S.shop = S.shop || {}; S.shop.stock = S.shop.stock || {};
  S.shop.stock.siru = (S.shop.stock.siru||0) + 3;
  S.shop.stock.bean_seed = (S.shop.stock.bean_seed||0) + 5;
  window.__redraw(); return true; })()`, false);
await openBag(); await sleep(1000);
cell = await siruCell();
ok('A-1 가방 격자에 시루 칸이 섰다', !!cell, JSON.stringify(cell && cell.qty));
ok('A-2 ★★ 격자 칸 그림도 **뚜껑 덮인 시루**다', !!cell && picOf(cell.pic) === BAG_PIC,
   cell && picOf(cell.pic));
ok('A-3 ★ 그 그림이 실제로 로드됐다', !!cell && cell.w > 0, cell && cell.w);
ok('A-4 산 시루 3개가 칸에 **×3** 으로 뜬다', cell && cell.qty === '×3', cell && cell.qty);
await shot('baggrid_empty_siru');

/* ── ① 끌면 하나 선다 · ×3 → ×2 ───────────────────────────────────────── */
const placed0 = await placedNow();
const spot2 = await pickFloor(0.24);
ok('A-5 방바닥에 또 놓을 자리를 찾았다', !!spot2, JSON.stringify(spot2));
const drag2 = spot2 ? await dropAt(spot2.x, spot2.y) : { began: false };
ok('A-6 ★★ **격자 칸을 끌면** 끌기가 시작된다 (칸이 곧 손잡이다)',
   drag2.began === true, JSON.stringify(drag2));
await sleep(1600); await skipTalk(); await sleep(600);
const placed1 = await placedNow();
ok('A-7 ★★ 한 번 끌면 **한 개만** 선다', placed1 === placed0 + 1, `${placed0} → ${placed1}`);
await openBag(); await sleep(700);
cell = await siruCell();
ok('A-8 ★★ 그때 칸의 개수가 **하나 준다** (×3 → ×2)', cell && cell.qty === '×2', cell && cell.qty);
await shot('baggrid_after_drag');

/* ── ② 누르면 하나 선다 · ×2 → ×1 ──────────────────────────────────────
   ⚠ 누름은 **바로 굳지 않는다.** 임시로 서고 이동 상태로 들어간다 —
     예전 [📍 방에 배치하기]가 하던 그 흐름 그대로다(§startPhonePlace). */
const tapCell = () => page.eval(`(()=>{
  const b = ${CELL_PICK};
  if (!b || !b.hasAttribute('data-place')) return false; b.click(); return true; })()`);
ok('A-9 격자 칸을 누를 수 있다', await tapCell() === true);
await sleep(1700); await skipTalk();
let mv = await page.eval(`({ moving: document.getElementById('stage').classList.contains('moving'),
  placed: ((window.__S().firstPlay.beansprout.pots)||[]).filter(p=>p&&(p.slotId||p.at)).length })`);
ok('A-10 ★★ **누르면** 방에 하나가 임시로 서고 곧바로 이동 상태가 된다',
   mv.placed === placed1 + 1 && mv.moving === true, JSON.stringify(mv));
/* 자리를 조금 옮기고 [확인] — 흐름이 끝까지 도는지 본다 */
await page.eval(`(()=>{ const c=document.getElementById('roomCanvas').getBoundingClientRect();
  const x=c.left+c.width*0.5, y=c.top+c.height*0.62;
  window.__picked.down({clientX:x, clientY:y});
  window.__picked.move({clientX:x+26, clientY:y+20});
  window.__picked.up(); })()`, false);
await sleep(1400); await skipTalk();
ok('A-11 ★ [확인]이 떠서 흐름이 끝까지 돈다', await clickId('placeOk') === true);
await sleep(1200); await skipTalk();
await openBag(); await sleep(700);
cell = await siruCell();
ok('A-12 ★★ 눌러서 세운 뒤에도 칸이 **하나 준다** (×2 → ×1)',
   cell && cell.qty === '×1', cell && cell.qty);

/* ── ③ 0개가 되면 칸이 사라진다 (예전엔 카드째 숨었다) ─────────────────── */
await page.eval(`(()=>{ const S=window.__S();
  S.shop.stock.siru = 0; window.__redraw(); return true; })()`, false);
await openBag(); await sleep(800);
cell = await siruCell();
const help0 = await page.eval(`(()=>{const h=document.querySelector('#bagGrid .baghelp');
  return h ? h.textContent : null;})()`);
ok('A-13 ★★ 빈 시루가 **0개가 되면 칸이 통째로 사라진다**', cell === null, JSON.stringify(cell));
ok('A-14 ★ 그때 「끌어 보세요」 안내도 같이 걷힌다 (못 끄는데 끌라고 하면 고장이다)',
   help0 === null, help0);
await shot('baggrid_empty_zero');

/* ══ 콘솔에 처리 안 된 예외가 없다 ═════════════════════════════════════ */
console.log('');
console.log(`잰 것 ${seen}개 · 어긋난 것 ${bad}개`);
/* ★★★ 2026-08-29 — **덮어쓴 것을 «스스로 말한다»**(계율 ㊹ 「경고문은 못 막는다 — 자가 던지게 하라」).
   ⚠ 머리말에 적어 두는 것만으로는 안 막힌다 — 2026-08-29 에 [core] 가 그 머리말을 «안 읽고»
     돌려서 문서 그림 열 장이 더러워졌고, 그것이 다른 창의 리베이스를 막았다.
   ⛔ 저절로 되돌리지 않는다. 찍는 자리도 안 옮긴다 — 그건 계약이다(문서가 이 그림을 가리킨다).
   ★ 하는 일은 하나뿐 — **돌린 사람이 «알게» 한다.** */
if (shotCount) {
  console.log('');
  console.log(`⚠ 문서 그림 ${shotCount}장을 덮어썼습니다 — docs/engine/shots/`);
  console.log('   뜻이 없으면 되돌리십시오:  git checkout -- docs/engine/shots');
  console.log('   안 찍고 돌리려면:          node tools/test_bagcell.mjs --no-shots');
}
await page.close();
process.exit(bad ? 1 : 0);
