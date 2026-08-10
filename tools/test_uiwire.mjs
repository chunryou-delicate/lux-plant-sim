/* ============================================================
   tools/test_uiwire.mjs — 화면 배선 셋 (game.html 소유)
   ------------------------------------------------------------
     python tools/serve.py 8989
     BYEOT_URL=http://127.0.0.1:8989 node tools/test_uiwire.mjs

   증명 대상 (docs/handoff/uiwire-to-plan.md · 박사님 2026-08-08)

     S  산 시루가 **저절로 안 선다.** 가방에 남아 있다가 **끌어다 놓을 때** 판에 선다
        ("시루를 샀는데 자동 배치가 되는데 이상하게 배치되고.
          애초에 인벤에서 끌어서 배치하도록 해")
     F  가구를 누르면 **가구가 밝아지고** 그 **옆에** 메뉴가 뜬다. 시점을 돌리면 따라오고,
        메뉴를 눌러도 밑의 캔버스가 눌림을 안 가져간다(카메라가 안 돈다)
        ("가구가 살짝 밝아지면서 활성화된 것처럼 되면서 그 옆으로 선택 가능 메뉴들이")
     P  포인터 **상대 이동**을 설정에서 고를 수 있고, 켠 값을 기억한다
        ("클릭을 터치 또는 그 커서를 상대 이동으로 움직이게 설정에서 고를 수 있게")

   ★★ 이 검사는 **사람이 하는 일**을 한다. 규칙 함수를 직접 부르지 않는다 —
     ① 시루를 **끌어다 놓는다**(`__drag.begin/move/end` = bindDrag 가 부르는 그 셋)
     ② 가구를 **진짜 마우스로 누른다**(CDP `Input.dispatchMouseEvent`)
     자동 배치를 없앤 뒤로는 「놓는 손」이 없으면 시루가 영영 안 선다. 검사가 그 손을
     안 가지면 검사가 사람보다 게으른 것이고, 그때 통과는 아무것도 말하지 않는다.

   ⚠ 재고(시루·씨앗)는 상점을 안 거치고 직접 넣는다. 주문에는 배송일이 붙어 있고
     여기서 볼 것은 **놓는 손**이지 주문이 아니다 — `test_siru_add.mjs` 가 규칙 쪽에서
     같은 이유로 같은 방식을 쓴다.
   ⚠ `BYEOT_URL` 은 **서버 주소**다(페이지 주소를 넣으면 404 로 죽는다).
============================================================ */
import { launch, sleep } from './test_cdp.mjs';

const BASE = process.env.BYEOT_URL || 'http://localhost:8971';

let bad = 0, seen = 0;
/* ★ **잰 값은 통과해도 찍는다.** 이 검사가 내는 숫자가 곧 인계에 적는 값이라,
   실패했을 때만 보여 주면 "왜 그 숫자인지"를 다시 재야 한다. */
const ok = (name, cond, got) => {
  seen++;
  console.log(`${cond ? '  OK' : 'FAIL'}  ${name}${got == null || got === '' ? '' : '  → ' + got}`);
  if (!cond) bad++;
};
const near = (a, b, tol) => Math.abs(a - b) <= tol;

const page = await launch({ width: 390, height: 844, dpr: 2, mobile: false });
/* 판을 새로 깐다 — 남은 세이브·설정이 있으면 무엇을 재는지가 흐려진다 */
await page.goto(`${BASE}/game.html`);
await page.eval(`localStorage.clear()`, false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 180000, 300);
await page.waitFor('window.__byeotBooted === true', 180000, 300);
await sleep(3500);

/* 대사·안내를 걷는다 — 덮개가 남아 있으면 진짜 마우스가 방에 닿지 않는다 */
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
await page.eval(`(()=>{ try{ window.__byeotSheet.close(); }catch(e){} })()`, false);
await sleep(400);

/* ── 진짜 마우스 (CDP) ── 합성 이벤트가 아니라 브라우저가 만드는 입력이다.
   그래야 "메뉴를 누르면 밑의 캔버스가 가져간다"를 실제로 잴 수 있다. */
async function mouse(type, x, y, buttons) {
  await page.send('Input.dispatchMouseEvent', {
    type, x: Math.round(x), y: Math.round(y),
    button: type === 'mouseMoved' && !buttons ? 'none' : 'left',
    buttons: buttons ?? (type === 'mousePressed' ? 1 : 0),
    clickCount: type === 'mouseMoved' ? 0 : 1
  });
}
async function tap(x, y) {
  await mouse('mouseMoved', x, y, 0);
  await mouse('mousePressed', x, y, 1);
  await sleep(40);
  await mouse('mouseReleased', x, y, 0);
}
/* ★★ 진짜 마우스를 쓰기 전에는 **화면이 숨을 고를 때까지 기다린다.**
   방을 다시 조립하는 동안(시루를 놓은 직후가 그렇다) 본줄기가 막히는데, 그때 누르면
   누름과 뗌 사이가 400ms 를 넘어 `bindFurnitureTap` 이 「끈 것(카메라 조작)」으로 읽는다.
   실제로 재 보니 그 틈이 **8.3초**였다 — 검사가 실패한 것이 아니라 화면이 아직 안 돌아왔던 것이다.
   ⚠ 이건 검사 쪽 사정이다. 사람은 화면이 멈춘 동안 안 누른다(누를 것이 안 보인다). */
async function settle(ms = 15000) {
  const t0 = Date.now();
  let last = -1;
  while (Date.now() - t0 < ms) {
    last = await page.eval(`new Promise(r=>{ const a=performance.now();
      requestAnimationFrame(()=>requestAnimationFrame(()=>r(+(performance.now()-a).toFixed(1)))); })`);
    if (last >= 0 && last < 90) return last;
    await sleep(250);
  }
  return last;
}
async function dragMouse(x0, y0, x1, y1, steps = 6) {
  await mouse('mouseMoved', x0, y0, 0);
  await mouse('mousePressed', x0, y0, 1);
  for (let i = 1; i <= steps; i++)
    await mouse('mouseMoved', x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps, 1);
  await sleep(60);
  await mouse('mouseReleased', x1, y1, 0);
}

const setStock = (siru, seed) => page.eval(`(()=>{ const S=window.__S();
  S.shop = S.shop || {};
  S.shop.stock = { ...(S.shop.stock||{}), siru:${siru}, bean_seed:${seed} };
  window.__redraw();
  return { siru:S.shop.stock.siru, seed:S.shop.stock.bean_seed }; })()`);

/* ★★ 2026-08-09 — **선 시루 수를 세는 법이 바뀌었다**(first_play §자리는 시루마다 따로다).
   예전에는 그루 하나에 `count: N` 이 실려 있어 그 수를 읽었다(무리 짓기). 이제 시루 하나가
   그루 하나이므로 **그루를 센다.** 열쇠도 같이 모은다 — 각개의 증거는 「열쇠가 다르다」다. */
const cropSnap = () => page.eval(`(()=>{ const S=window.__S();
  const b = S.firstPlay && S.firstPlay.beansprout;
  const rv = window.__rv;
  let shown = 0; const keys = [];
  try { for (const p of (rv.plants()||[])) if (p.kind==='beansprout') { shown++; keys.push(p.key); } } catch(e){}
  /* ★★ 2026-08-10 — 「가방 카드」가 없어졌다. 손잡이는 **가방 격자의 시루 칸**이다
     (박사님: "맨 위 콩나물 시루 큰 칸으로 된 저게 안 보이고, 밑에 그냥 콩나물 시루 ×4
     된 걸 누르거나 드래그할 때마다 1개씩 배치"). 이 검사가 지키던 뜻은 그대로다 —
     **가방에 세울 시루가 있으면 손잡이가 보이고, 없으면 사라진다.** 보는 곳만 옮긴다. */
  const cell = [...document.querySelectorAll('.bagslot[data-place="beansprout"]')]
               .find(v=>/시루/.test(v.getAttribute('title')||'')) || null;
  const pots = (b && b.pots) || [];
  return {
    pots: pots.length,
    placed: pots.filter(p=>p && (p.slotId||p.at)).length,
    potSlots: pots.map(p=>p && p.slotId || null),
    at: b && b.at ? { x:+b.at.x.toFixed(4), z:+b.at.z.toFixed(4) } : null,
    slotId: b && b.slotId || null,
    stockSiru: (S.shop && S.shop.stock && S.shop.stock.siru) || 0,
    stockSeed: (S.shop && S.shop.stock && S.shop.stock.bean_seed) || 0,
    shown, keys,
    rows: document.querySelectorAll('#siruList .siru').length,
    cellQty: cell ? (cell.querySelector('.qty')||{}).textContent : null,
    cellHost: cell && cell.closest('#bagGrid') ? 'bagGrid' : null,
    cellShown: !!cell,
    /* 손잡이가 죽지 않았는지 — 끌기가 붙잡는 그 id 가 칸 안에 살아 있나 */
    thumbInCell: !!(cell && cell.querySelector('#cropThumb')),
    resowShown: document.getElementById('resow').style.display !== 'none',
    resowText: document.getElementById('resow').textContent
  }; })()`);

/* 방 안에서 **안 붙는**(추천 자리에 스냅 안 되는) 바닥 점을 하나 고른다.
   붙어 버리면 "떨군 자리에 섰나"를 잴 수 없다 — 붙은 자리는 다른 점이기 때문이다. */
const pickFloor = (potD) => page.eval(`(()=>{ const rv=window.__rv;
  const c=document.getElementById('roomCanvas').getBoundingClientRect();
  for (const fy of [0.80,0.74,0.68,0.86,0.62]) for (const fx of [0.5,0.38,0.62,0.28,0.72]) {
    const x=c.left+c.width*fx, y=c.top+c.height*fy;
    let h=null; try{ h=rv.surfaceAt(x,y,{ potD:${potD} }); }catch(e){}
    if(!h||!h.ok) continue;
    /* 추천 자리가 화면에서 44px 안이면 끌기가 거기 붙인다(freePlace.snap SNAP_PX) */
    if (h.nearest){ let sp=null; try{ sp=rv.screenPosOf(h.nearest.slotId); }catch(e){}
      if (sp && Math.hypot(c.left+sp.x-x, c.top+sp.y-y) <= 44) continue; }
    return { x, y, hx:+h.x.toFixed(4), hz:+h.z.toFixed(4) };
  }
  return null; })()`);

const dropAt = (x, y) => page.eval(`(()=>{
  const t = document.getElementById('cropThumb');
  window.__drag.begin('beansprout', t.src, { clientX:${x}, clientY:${y} });
  if (!window.__drag.on) return { began:false };
  window.__drag.move({ clientX:${x}, clientY:${y} });
  const label = document.getElementById('dropLabel').textContent;
  window.__drag.end();
  return { began:true, label }; })()`);

console.log('\n══ S. 산 시루 — 저절로 안 선다 · 끌면 **하나씩** 선다 ══════════════');
/* ★★ 2026-08-09 재작성 (박사님 지시 "콩나물시루 하나하나가 각개 움직이고").
   ------------------------------------------------------------
   이 절이 지키던 옛 약속은 「끌어다 놓으면 가방의 시루가 **전부** 선다」였다.
   그것이 바로 박사님이 폰에서 보신 「뭉태기로 설치」다 — 검사가 그 동작을 지키고 있었다.
   ⇒ 새 약속: **한 번 끌면 하나가 서고, 나머지는 가방에 남는다.**
     각개의 증거는 셋이다: ① 판에 선 수가 1씩 는다 ② 그루 열쇠가 시루마다 다르다
     ③ 재고가 1씩만 빠진다. */

/* 먼저 첫 시루를 방에 놓는다(사람이 하는 첫 일이다) */
let spot = await pickFloor(0.24);
ok('S-0 방바닥에 놓을 자리를 찾았다', !!spot, String(spot));
if (!spot) { console.log('\n방을 못 읽어 나머지를 못 잽니다'); await page.close(); process.exit(1); }
await dropAt(spot.x, spot.y);
await sleep(1200); await skipTalk(); await sleep(400);

let s = await cropSnap();
ok('S-1 첫 시루가 방에 섰다 (1개)', s.placed === 1 && s.shown === 1, JSON.stringify(s));
ok('S-2 다 놓으면 가방의 시루 칸이 **사라진다** (빈 용기가 없으므로)',
   s.cellShown === false, `칸=${s.cellShown} · ×${s.cellQty}`);
ok('S-2b [식물]에 그 시루 한 줄이 생겼다', s.rows === 1, s.rows);

/* 시루 2개 · 씨앗 5봉지를 산 상태로 만든다 */
await setStock(2, 5);
await sleep(400);
s = await cropSnap();
ok('S-3 시루를 사도 판에 선 수는 그대로 1이다 (자동 배치가 없다)',
   s.placed === 1 && s.shown === 1, JSON.stringify({ placed: s.placed, shown: s.shown }));
ok('S-4 산 시루가 있으면 칸이 **가방 격자에서 다시 보인다** (끌기 손잡이째로)',
   s.cellHost === 'bagGrid' && s.cellShown === true && s.thumbInCell === true,
   `${s.cellHost} · ${s.cellQty} · thumb=${s.thumbInCell}`);
ok('S-5 [심기] 버튼이 산 시루를 말하지 않는다', !/새 시루/.test(s.resowText), s.resowText);

/* [심기]를 눌러도 산 시루가 안 나간다 — 이 버튼은 거둔 것만 다시 심는다 */
await clickId('resow'); await sleep(600);
s = await cropSnap();
ok('S-6 [심기]를 눌러도 시루 재고가 안 줄고 판에도 안 선다',
   s.stockSiru === 2 && s.placed === 1, JSON.stringify({ stock: s.stockSiru, placed: s.placed }));

/* ★ 놓는 손 — 여기서 처음으로 산 시루가 판에 선다. **한 개씩** 이다 */
const potD1 = await page.eval(`window.__rv.plantPotD('beansprout',1)`);
const spot3 = await pickFloor(potD1);
ok('S-7 시루 한 개가 들어갈 바닥 점이 있다', !!spot3, `시루 지름 ${potD1}m`);
const drop = spot3 ? await dropAt(spot3.x, spot3.y) : { began: false };
ok('S-8 산 시루가 있으면 **끌기가 시작된다**', drop.began === true, JSON.stringify(drop));
ok('S-9 놓기 전에 **하나가 선다**고 말한다 (씨앗 1봉지 · 가방에 1개 남음)',
   !!(drop.label && /시루 1개/.test(drop.label) && /씨앗 1봉지/.test(drop.label)
      && /1개 남음/.test(drop.label)), drop.label);
await sleep(1400); await skipTalk(); await sleep(400);

s = await cropSnap();
ok('S-10 끌어다 놓으면 **하나만** 는다 (1 → 2)', s.placed === 2, s.placed);
ok('S-11 방에도 2개가 **각각** 서 있다 (열쇠가 다르다)',
   s.shown === 2 && new Set(s.keys).size === 2, JSON.stringify(s.keys));
ok('S-12 시루 재고가 **1개만** 빠진다 (2 → 1)', s.stockSiru === 1, s.stockSiru);
ok('S-13 씨앗도 **1봉지만** 나간다 (5 → 4)', s.stockSeed === 4, s.stockSeed);
ok('S-13b [식물]의 줄도 2개다', s.rows === 2, s.rows);
/* ★ 떨군 자리에 선 것은 **방금 놓은 그 시루**다. 자리 사본(`b.at`)은 대표 시루 것이라
   여기서 안 본다 — 대표가 방금 놓은 것이 아닐 수 있다. */
const lastAt = await page.eval(`(()=>{ const b=window.__S().firstPlay.beansprout;
  const p=(b.pots||[])[b.pots.length-1];
  return p && p.at ? { x:+p.at.x.toFixed(4), z:+p.at.z.toFixed(4) } : null; })()`);
const dist = spot3 && lastAt ? Math.hypot(lastAt.x - spot3.hx, lastAt.z - spot3.hz) : Infinity;
ok('S-14 **떨군 자리**에 섰다 (0.05m 안)', dist <= 0.05,
   `${dist.toFixed(4)}m · 시루 지름 ${(+potD1).toFixed(3)}m`);

/* 씨앗이 모자라면 — 시루가 사라지지 않는다 */
await setStock(2, 0);
await sleep(300);
const before = await cropSnap();
const spot2 = await pickFloor(potD1);
if (spot2) { await dropAt(spot2.x, spot2.y); await sleep(1200); await skipTalk(); }
s = await cropSnap();
ok('S-15 씨앗이 모자라면 시루가 **안 없어진다**', s.stockSiru === 2, s.stockSiru);
ok('S-16 그때 판에 선 수도 안 늘어난다', s.placed === before.placed, `${before.placed} → ${s.placed}`);

console.log('\n══ W. 물 주기 말풍선이 죽지 않는다 (QA 2026-08-08 §3-A) ══════════');
/* ★★ 무엇을 재나 — **「말풍선이 떠 있는 동안 그 버튼이 잠겨 있지 않은가」**.
   말풍선이 하는 일은 `$('waterCrop').click()` 이고, `disabled` 인 버튼은 `click()` 을 불러도
   핸들러가 안 돈다. 그래서 「눌러도 아무 일이 없다」가 났다 — 회전마다 하루~이틀이 사라졌다.
   ⚠ 「눌러 보니 되더라」로 끝내지 않는다. 물이 **실제로 들어갔는지**(회전이 시작됐는지)를
     상태에서 확인한다. 화면 글자는 증거가 아니다. */
const waterSnap = () => page.eval(`(()=>{ const S=window.__S();
  const b = S.firstPlay && S.firstPlay.beansprout;
  const wb = document.getElementById('waterCrop');
  return { day:S.day,
           started:((b&&b.pots)||[]).map(p=>p.startedOnDay),
           mark:[...document.querySelectorAll('#marks .mark')].map(e=>e.textContent).join('|'),
           disabled: wb.disabled, shown: wb.style.display !== 'none' }; })()`);
const tapWaterMark = () => page.eval(`(()=>{
  const el = [...document.querySelectorAll('#marks .mark')].find(e=>/물/.test(e.textContent||''));
  if (!el) return false;
  el.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:1,pointerType:'mouse'}));
  return true; })()`);
const watered = () => page.eval(`(()=>{ const b=window.__S().firstPlay.beansprout;
  return ((b.pots)||[]).some(p=>p.startedOnDay != null); })()`);

let w = await waterSnap();
ok('W-1 물 주기 말풍선이 떠 있다', /물/.test(w.mark), w.mark || '(없음)');
ok('W-2 말풍선이 떠 있어도 그 버튼은 **안 잠겨 있다**', w.disabled === false, JSON.stringify(w));

/* ★★ 누르는 동안 말풍선이 **도망가지 않는가** (QA §3-D · PC 에서 61.6px 이 났다).
   ══════════════════════════════════════════════════════════════════
   말풍선은 `<button>` 이고 제 자리를 `transform:translate(-50%,-100%)` 로 잡는다.
   전역 누름 효과(`button:active{transform:translateY(2px)}`)가 그 변형을 통째로
   갈아 끼우면 자리가 사라져 (폭/2, 높이+2) 만큼 튄다.
   ⚠ 평소에는 `markBob` 애니메이션이 transform 을 계속 써서 그 효과를 이긴다. 안내 손가락이
     가리켜 `.hintTarget` 이 붙으면 애니메이션이 `hintGlow` 로 바뀌어 **방패가 벗겨진다** —
     그 상태를 여기서 그대로 만든다(게임이 실제로 만드는 상태다 · hintAt §hintTarget).
   ★ 그리고 이 누름이 곧 아래 W-3 의 물 주기다 — 재는 김에 실제로 눌러 본다. */
await page.eval(`(()=>{ const el=[...document.querySelectorAll('#marks .mark')].find(e=>/물/.test(e.textContent||''));
  if (el) el.classList.add('hintTarget'); })()`, false);
const markBox = () => page.eval(`(()=>{ const el=[...document.querySelectorAll('#marks .mark')].find(e=>/물/.test(e.textContent||''));
  if(!el) return null; const r=el.getBoundingClientRect();
  return { x:+(r.left+r.width/2).toFixed(1), y:+(r.top+r.height/2).toFixed(1),
           tf:getComputedStyle(el).transform }; })()`);
const d0 = await markBox();
ok('D-0 말풍선을 잡았다 (안내 손가락이 가리킨 상태)', !!d0, JSON.stringify(d0));
let drift = null;
if (d0) {
  await mouse('mouseMoved', d0.x, d0.y, 0);
  await mouse('mousePressed', d0.x, d0.y, 1);
  await sleep(140);
  const d1 = await markBox();
  await mouse('mouseReleased', d0.x, d0.y, 0);
  drift = d1 ? +Math.hypot(d1.x - d0.x, d1.y - d0.y).toFixed(1) : null;
  ok('D-1 ★누르는 0.14초 동안 말풍선이 **안 움직인다** (예전엔 61.6px)',
     drift != null && drift <= 1, `${drift}px · ${d1 && d1.tf}`);
}
try { await page.waitFor(`window.__S().firstPlay.beansprout.pots.some(p=>p.startedOnDay!=null)`, 12000, 200); } catch { }
ok('W-3 말풍선을 누르면 물이 **실제로 들어간다**', await watered(), JSON.stringify(await waterSnap()));
/* ⚠ 물은 **시루 하나씩** 들어간다(시차를 만드는 손이 그것이다 — state §물주기).
   그래서 세 개를 다 채우려면 세 번 눌러야 한다. 한 번 누르고 "다 줬다"로 세면 안 된다. */
for (let i = 0; i < 4; i++) {
  if (await page.eval(`window.__S().firstPlay.beansprout.pots.every(p=>p.startedOnDay!=null)`)) break;
  if (!await tapWaterMark()) break;
  try { await page.waitFor(`window.__S().firstPlay.beansprout.pots.filter(p=>p.startedOnDay!=null).length > ${i + 1}`, 12000, 200); } catch { }
}
await sleep(700);
w = await waterSnap();
ok('W-4 다 준 뒤에는 잠긴다 (줄 것이 없다)',
   w.disabled === true && w.started.every(v => v != null), JSON.stringify(w));

/* 다음 회전 — 여기가 예전에 죽던 자리다. 회전을 되돌려 「또 물을 줘야 하는 날」로 만든다 */
await page.eval(`(()=>{ const S=window.__S();
  for (const p of (S.firstPlay.beansprout.pots||[])) { p.startedOnDay = null; p.idleSinceDay = S.day; }
  window.__redraw(); })()`, false);
await sleep(700);
w = await waterSnap();
ok('W-5 다음 회전에도 말풍선이 뜬다', /물/.test(w.mark), w.mark || '(없음)');
ok('W-6 ★그때 버튼이 **다시 풀린다** (예전에는 true 로 굳었다)', w.disabled === false, JSON.stringify(w));
await tapWaterMark();
try { await page.waitFor(`window.__S().firstPlay.beansprout.pots.some(p=>p.startedOnDay!=null)`, 12000, 200); } catch { }
ok('W-7 ★두 번째 회전에서도 물이 들어간다', await watered(), JSON.stringify(await waterSnap()));

console.log('\n══ F. 가구 — 밝아지고 옆에 메뉴가 뜬다 ══════════════════════════');
const frame = await settle();
ok('F-A 방이 숨을 골랐다 (한 프레임 90ms 안) — 진짜 마우스를 쓸 준비',
   frame >= 0 && frame < 90, `${frame}ms`);

/* 화면에서 실제로 집히는 가구 자리들을 모은다 — 눌러서 잡히지 않으면 잴 것이 없다.
   ⚠ **사람과 화분 앞은 뺀다.** 방뷰가 먼저 그 탭을 가져가면(onCharacterTap·onSlotTap)
     가구 고르기는 60ms 문턱에서 조용히 건너뛴다(bindFurnitureTap §lastRoomTap).
     실제로 그래서 한 번 헛짚었다 — 캐릭터가 침대 앞에 서 있었다. */
const spots = await page.eval(`(()=>{ const rv=window.__rv;
  const c=document.getElementById('roomCanvas').getBoundingClientRect();
  const busy=[];
  const add=(id)=>{ let p=null; try{ p=rv.screenPosOf(id); }catch(e){} if(p) busy.push([c.left+p.x, c.top+p.y]); };
  for (const ch of (rv.characters()||[])) add(ch.id);
  for (const pl of (rv.plants()||[])) add(pl.id || pl.potId || pl.key);
  const far=(x,y)=>busy.every(b=>Math.hypot(b[0]-x,b[1]-y)>70);
  const out=[];
  for (const f of (rv.furniture()||[])) {
    let p=null; try{ p=rv.screenPosOf(f.uid); }catch(e){}
    if(!p) continue;
    for (const dy of [-18,-30,-8,-44,0]) {
      const x=c.left+p.x, y=c.top+p.y+dy;
      if (x<c.left+10||x>c.right-10||y<c.top+10||y>c.bottom-10) continue;
      if (!far(x,y)) continue;
      let hit=null; try{ hit=rv.pickFurnitureAt(x,y); }catch(e){}
      if(hit && hit.uid===f.uid){ out.push({ uid:f.uid, name:f.name, x, y }); break; }
    }
  }
  return out; })()`);

/* 진짜로 눌러서 잡히는 것을 고른다. 잡히는지는 **눌러 봐야** 안다 */
async function tapPick(uid, x, y, tries = 3) {
  for (let i = 0; i < tries; i++) {
    await settle();
    await tap(x, y);
    await sleep(400);
    if (await page.eval(`window.__furn.uid === ${JSON.stringify(uid)}`)) return true;
    await page.eval(`(()=>{ window.__furn.clear(); })()`, false);
  }
  return false;
}
let target = null;
for (const cand of spots) {
  if (await tapPick(cand.uid, cand.x, cand.y)) { target = cand; break; }
}
ok('F-0 눌러서 골라지는 가구를 찾았다', !!target,
   `후보 ${spots.length}개 — ${spots.map(s => s.uid).join(', ')}`);

const menuBox = () => page.eval(`(()=>{ const el=document.getElementById('furnActions');
  const r=el.getBoundingClientRect(); const c=document.getElementById('roomCanvas').getBoundingClientRect();
  let p=null; try{ p=window.__rv.screenPosOf(window.__furn.uid); }catch(e){}
  return { on: document.getElementById('stage').classList.contains('furnpicked'),
           vis: getComputedStyle(el).visibility,
           x:+r.left.toFixed(1), y:+r.top.toFixed(1), w:+r.width.toFixed(1), h:+r.height.toFixed(1),
           cw:+c.width.toFixed(1),
           d: p ? +Math.hypot(r.left+r.width/2-(c.left+p.x), r.top+r.height/2-(c.top+p.y)).toFixed(1) : null,
           lit: (()=>{ try{ return window.__rv.highlightedFurniture(); }catch(e){ return 'ERR'; } })(),
           uid: window.__furn.uid }; })()`);

if (target) {
  let m = await menuBox();
  ok('F-1 가구를 누르면 그 가구가 **밝아진다**', m.lit === target.uid, `${m.lit} (기대 ${target.uid})`);
  ok('F-2 메뉴가 뜬다', m.on === true && m.vis !== 'hidden', JSON.stringify({ on: m.on, vis: m.vis }));
  /* ★ 바깥 도구는 「보이나」를 `offsetParent !== null` 로 잰다(QA 프로브 §v).
     `position:fixed` 면 그 값이 **언제나 null** 이라 판이 떠 있어도 「안 뜸」으로 찍힌다 —
     실제로 한 번 그렇게 찍혔다. 자리를 옮기면서 그 약속을 깨지 않았는지 여기서 지킨다. */
  ok('F-2b 바깥에서도 「보인다」로 읽힌다 (offsetParent 가 살아 있다)',
     await page.eval(`document.getElementById('furnActions').offsetParent !== null`),
     'offsetParent = ' + await page.eval(`(()=>{const p=document.getElementById('furnActions').offsetParent; return p?(p.id||p.tagName):'null'})()`));
  /* 「밑에 뜨는 띠」가 아니라 「옆에 뜨는 상자」다 — 폭이 화면을 안 채운다 */
  ok('F-3 아래 고정 띠가 아니다 (폭이 캔버스의 70% 미만)', m.w < m.cw * 0.7,
     `상자 ${m.w}×${m.h}px · 캔버스 폭 ${m.cw}px`);
  ok('F-4 메뉴가 **가구 옆**에 있다 (중심까지 200px 안)', m.d != null && m.d <= 200,
     `${m.d}px (${target.uid})`);

  /* 눌리는 자리가 보이는 것보다 넓나 — 버튼 사이 틈과 테두리 바깥이 캔버스로 안 샌다 */
  const hitTest = await page.eval(`(()=>{ const el=document.getElementById('furnActions');
    const r=el.getBoundingClientRect();
    const own=(x,y)=>{ const t=document.elementFromPoint(x,y); return !!(t && (t===el || el.contains(t))); };
    const btn=document.getElementById('furnMove').getBoundingClientRect();
    return { onButton: own(btn.left+btn.width/2, btn.top+btn.height/2),
             onEdge:   own(r.left-6, r.top+r.height/2),
             onTopEdge:own(r.left+r.width/2, r.top-6) }; })()`);
  ok('F-5 버튼 한가운데는 **버튼이** 받는다 (넓힌 판이 안 덮는다)', hitTest.onButton === true, JSON.stringify(hitTest));
  ok('F-6 상자 **바깥 6px 도** 메뉴가 받는다 (밑 캔버스로 안 샌다)',
     hitTest.onEdge === true && hitTest.onTopEdge === true, JSON.stringify(hitTest));

  /* ★ 아래 띠를 **덮지 않는가** — 예전 하단 고정 띠가 실제로 [다음 날]·[빨리감기] 를 덮어
     못 누르게 만든 적이 있다(2026-08-06 박사님 · #plantActions §pickLift).
     자리를 옮겼으니 그 사고가 되살아나지 않았는지 **재서** 확인한다. */
  const cover = await page.eval(`(()=>{ const f=document.getElementById('furnActions').getBoundingClientRect();
    const out={};
    for (const id of ['next','ff','openBag']) {
      const e=document.getElementById(id); if(!e || e.offsetParent===null){ out[id]='없음'; continue; }
      const r=e.getBoundingClientRect();
      const 덮나 = !(f.right<=r.left||r.right<=f.left||f.bottom<=r.top||r.bottom<=f.top);
      const t=document.elementFromPoint(r.left+r.width/2, r.top+r.height/2);
      out[id]= 덮나 ? ('덮음·맨위=' + (t?(t.id||t.tagName):'없음')) : '안덮음';
    }
    return out; })()`);
  ok('F-4b 메뉴가 [다음 날]·[빨리감기]·[가방]을 **안 막는다**',
     Object.values(cover).every(v => v === '안덮음' || v === '없음' || /맨위=(next|ff|openBag)$/.test(v)),
     JSON.stringify(cover));

  /* 크기가 변하면 안 된다 — 커지면 그만큼 밀려나 다음 클릭이 빗나간다(.mark 에서 겪었다).
     ⚠ 누르는 자리는 **아무 일도 안 하는 곳**이어야 한다. 버튼을 누르면 그 자리에서
       옮기기·돌리기로 넘어가 메뉴가 감춰지므로(furnmoving) 잴 상자가 사라진다 —
       처음에 그렇게 짜서 0×0 이 나왔다. 이름표(.who) 는 눌러도 아무 일이 없다. */
  const b0 = await menuBox();
  const btn = await page.eval(`(()=>{ const r=document.getElementById('furnName').getBoundingClientRect();
    return { x:r.left+r.width/2, y:r.top+r.height/2 }; })()`);
  await mouse('mouseMoved', btn.x, btn.y, 0);
  await mouse('mousePressed', btn.x, btn.y, 1);
  await sleep(120);
  const b1 = await menuBox();
  await mouse('mouseReleased', btn.x, btn.y, 0);
  await sleep(200);
  ok('F-7 누르는 동안 상자 **크기가 안 변한다**',
     near(b0.w, b1.w, 0.6) && near(b0.h, b1.h, 0.6), `${b0.w}×${b0.h} → ${b1.w}×${b1.h}`);
  ok('F-8 누르는 동안 상자 **자리도 안 밀린다**',
     near(b0.x, b1.x, 0.6) && near(b0.y, b1.y, 0.6), `(${b0.x},${b0.y}) → (${b1.x},${b1.y})`);
  /* [돌리기]를 눌렀으니 돌리기 모드다 — 풀고 다시 고른다 */
  await page.eval(`(()=>{ window.dispatchEvent(new Event('blur')); })()`, false);
  await sleep(300);
  await page.eval(`(()=>{ window.__furn.clear(); })()`, false);
  await sleep(200);
  ok('F-8b 같은 자리를 다시 눌러도 다시 골라진다',
     await tapPick(target.uid, target.x, target.y), await page.eval(`window.__furn.uid`));
  await sleep(300);

  /* 시점을 돌린다 — 메뉴가 따라와야 한다.
     ⚠ **끄는 중에 잰다.** 손을 떼면 방뷰가 8방으로 각을 되돌려 놓아(settleCam)
       az 가 원래 값으로 돌아온다 — 그러면 "안 돌았다"로 보인다(실제로 그렇게 헛짚었다). */
  /* ⚠ **고른 캐릭터를 먼저 푼다.** 사람이 골라져 있으면 캔버스를 끄는 것이 시점 회전이
     아니라 **걷기 끌기**(walkDrag)가 된다 — 그러면 카메라가 한 톨도 안 돈다.
     후보를 눌러 보는 동안 방뷰가 사람을 골랐을 수 있다(실제로 그랬다). */
  await page.eval(`(()=>{ try{ window.__rv.selectCharacter(null); }catch(e){} })()`, false);
  await sleep(200);
  const cam0 = await page.eval(`window.__rv.camera().az`);
  /* ⚠ **메뉴를 안 덮는 점**에서 끌어야 한다. 메뉴는 이제 방 한복판에 떠 있어서,
     화면 가운데를 잡으면 메뉴가 그 누름을 가져간다(그게 F-6 이 지키는 성질이다) —
     그러면 카메라가 안 돌고, 안 돈 채로 F-10 이 저절로 통과해 버린다. */
  const c = await page.eval(`(()=>{ const r=document.getElementById('roomCanvas').getBoundingClientRect();
    for (const fy of [0.30,0.22,0.40,0.16]) for (const fx of [0.5,0.2,0.8,0.35,0.65]) {
      const x=r.left+r.width*fx, y=r.top+r.height*fy;
      if (document.elementFromPoint(x,y) === document.getElementById('roomCanvas')) return { x, y };
    }
    return null; })()`);
  ok('F-9a 메뉴를 안 덮는 자리에서 방을 잡을 수 있다', !!c, JSON.stringify(c));
  if (!c) throw new Error('방을 잡을 자리를 못 찾았습니다');
  await mouse('mouseMoved', c.x, c.y, 0);
  await mouse('mousePressed', c.x, c.y, 1);
  for (let i = 1; i <= 8; i++) { await mouse('mouseMoved', c.x + i * 14, c.y, 1); await sleep(40); }
  await sleep(250);
  const cam1 = await page.eval(`window.__rv.camera().az`);
  m = await menuBox();
  await mouse('mouseReleased', c.x + 112, c.y, 0);
  await sleep(400);
  ok('F-9 방을 끌면 시점이 실제로 돈다 (잴 준비가 됐다)', Math.abs(cam1 - cam0) > 0.02,
     `${cam0.toFixed(3)} → ${cam1.toFixed(3)}`);
  ok('F-10 시점을 돌려도 메뉴가 **가구를 따라간다**', m.d != null && m.d <= 200, `${m.d}px`);
  ok('F-11 돌리는 동안 고른 가구가 안 풀린다', m.uid === target.uid && m.lit === target.uid,
     JSON.stringify({ uid: m.uid, lit: m.lit }));

  /* 메뉴를 눌러도 카메라가 안 돈다 — 「떠 있는 것을 누르면 밑이 가져간다」의 정면 검사다 */
  const az0 = await page.eval(`window.__rv.camera().az`);
  const mv = await page.eval(`(()=>{ const r=document.getElementById('furnMove').getBoundingClientRect();
    return { x:r.left+r.width/2, y:r.top+r.height/2 }; })()`);
  await dragMouse(mv.x, mv.y, mv.x + 24, mv.y + 6, 4);
  await sleep(400);
  const az1 = await page.eval(`window.__rv.camera().az`);
  ok('F-12 메뉴를 눌러 끌어도 **카메라가 안 돈다**', Math.abs(az1 - az0) < 1e-6,
     `${az0.toFixed(4)} → ${az1.toFixed(4)}`);
  const mode = await page.eval(`window.__furn.mode`);
  ok('F-13 그 누름은 **[옮기기]로 확정된다** (뗄 때가 아니라 누를 때)', mode === 'move', String(mode));

  await page.eval(`(()=>{ window.dispatchEvent(new Event('blur')); window.__furn.clear(); })()`, false);
  await sleep(400);
  const off = await page.eval(`(()=>({ lit:(()=>{try{return window.__rv.highlightedFurniture();}catch(e){return 'ERR';}})(),
    on: document.getElementById('stage').classList.contains('furnpicked') }))()`);
  ok('F-14 닫으면 밝기가 **꺼진다**', off.lit === null, String(off.lit));
  ok('F-15 닫으면 메뉴도 사라진다', off.on === false, String(off.on));
}

console.log('\n══ P. 포인터 「상대 이동」 ═════════════════════════════════════');

const ptr = () => page.eval(`(()=>({ mode: window.__rv.pointerMode(),
  sel: document.getElementById('ptrMode').value,
  saved: localStorage.getItem('byeot.pointerMode') }))()`);
let p = await ptr();
ok('P-1 기본은 direct 다 (지금 손버릇을 안 바꾼다)',
   p.mode === 'direct' && p.sel === 'direct', JSON.stringify(p));

/* 가구를 잡았을 때 **얼마나 튀나** — direct 는 잡은 자리로 가고 relative 는 안 간다.
   가구 발밑에서 비껴 잡아야 차이가 보인다(제자리를 잡으면 둘이 같다). */
const jumpOf = async (uid, tapX, tapY) => page.eval(`(()=>{ const rv=window.__rv, f=window.__furn;
  const g=(rv.furniture()||[]).find(a=>a.uid==='${uid}'); if(!g) return null;
  f.clear();
  f.select(g, ${tapX}, ${tapY});
  f.beginMove();
  f.down({ clientX:${tapX}, clientY:${tapY} });        /* 손가락을 **하나도 안 움직였다** */
  const gh = f.ghost;
  const d = gh ? Math.hypot(gh.x-g.x, gh.z-g.z) : null;
  f.mode=null; f.ghost=null; f.clear();
  document.getElementById('stage').classList.remove('furnmoving');
  return d==null?null:+d.toFixed(4); })()`);

if (target) {
  /* 발밑에서 비껴 잡는다 — 그 가구 위이되 중심이 아닌 점 */
  const off = await page.eval(`(()=>{ const rv=window.__rv;
    const c=document.getElementById('roomCanvas').getBoundingClientRect();
    for (const dx of [26,-26,34,-34,18,-18]) {
      const x=${target.x}+dx, y=${target.y};
      let h=null; try{ h=rv.pickFurnitureAt(x,y); }catch(e){}
      if(h && h.uid==='${target.uid}') return { x, y, dx };
    }
    return { x:${target.x}, y:${target.y}, dx:0 }; })()`);
  const dDirect = await jumpOf(target.uid, off.x, off.y);
  ok('P-2 direct 에서는 잡은 자리로 **튄다** (예전 그대로다)',
     dDirect != null && dDirect > 0.02, `${dDirect}m (${target.uid} · 비껴 잡은 px ${off.dx})`);

  await page.eval(`(()=>{ const s=document.getElementById('ptrMode');
    s.value='relative'; s.dispatchEvent(new Event('change',{bubbles:true})); })()`, false);
  await sleep(300);
  p = await ptr();
  ok('P-3 고르개를 바꾸면 방뷰 모드가 바뀐다', p.mode === 'relative', JSON.stringify(p));
  ok('P-4 켠 값을 기억한다 (localStorage)', p.saved === 'relative', String(p.saved));

  const dRel = await jumpOf(target.uid, off.x, off.y);
  ok('P-5 relative 에서는 **안 움직이면 안 움직인다** (0.01m 안)',
     dRel != null && dRel <= 0.01, `${dRel}m`);

  /* 새로고침해도 기억한다 — 설정이 한 판짜리면 설정이 아니다 */
  await page.goto(`${BASE}/game.html`);
  await page.waitFor('!!window.__rv', 180000, 300);
  await page.waitFor('window.__byeotBooted === true', 180000, 300);
  await sleep(2500);
  p = await ptr();
  ok('P-6 새로고침해도 relative 가 남는다',
     p.mode === 'relative' && p.sel === 'relative', JSON.stringify(p));
}

console.log(bad ? `\n${bad}/${seen}개 떨어졌습니다` : `\n${seen}개 모두 통과`);
await page.close();
process.exit(bad ? 1 : 0);
